import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { ensureDir, sanitizeFilename } from './utils.js';

/**
 * Adjust image URL to match requested quality.
 * Supported qualities: 'orig', 'large', 'medium', 'small'
 */
export function selectImageUrl(rawUrl, quality = 'orig') {
  if (!rawUrl) return null;
  try {
    const urlObj = new URL(rawUrl);
    // Twitter pbs.twimg.com image URL handling
    if (urlObj.hostname.includes('twimg.com')) {
      urlObj.searchParams.set('name', quality);
      return urlObj.toString();
    }
    return rawUrl;
  } catch (e) {
    return rawUrl;
  }
}

/**
 * Select the best video URL matching user requested quality.
 * Formats: array of { url, bitrate, container, codec }
 */
export function selectVideoUrl(videoObj, quality = 'highest') {
  if (!videoObj) return null;

  const formats = videoObj.formats || [];
  // Only look at direct MP4 streams
  const mp4s = formats.filter(f => f.container === 'mp4' || (f.url && f.url.includes('.mp4')));

  if (mp4s.length === 0) {
    // Fallback to videoObj.url if it is an mp4
    if (videoObj.url && !videoObj.url.includes('.m3u8')) {
      return videoObj.url;
    }
    return null;
  }

  // Sort by bitrate ascending
  mp4s.sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));

  if (quality === 'lowest') {
    return mp4s[0].url;
  }
  if (quality === 'highest') {
    return mp4s[mp4s.length - 1].url;
  }

  // Parse resolution target (e.g. '1080p', '720p', '480p', '360p')
  const targetP = parseInt(quality.replace(/p$/, ''), 10) || 720;

  // Try to find the closest format <= targetP or matching URL text
  const match = mp4s.find(f => {
    if (f.url.includes(`x${targetP}`)) return true;
    return false;
  });

  if (match) return match.url;

  // If no exact match, pick the highest format that does not exceed target if possible
  // Estimate height from width/height or bitrate
  if (targetP <= 480) {
    return mp4s[0].url; // lower
  } else if (targetP <= 720) {
    // medium
    const midIndex = Math.min(mp4s.length - 1, Math.floor(mp4s.length / 2));
    return mp4s[midIndex].url;
  } else {
    // highest
    return mp4s[mp4s.length - 1].url;
  }
}

/**
 * High-speed concurrent media downloader with event progress emission.
 */
export class MediaDownloader {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 8;
    this.outputDir = options.outputDir;
    this.onProgress = options.onProgress || (() => {});
    this.onLog = options.onLog || (() => {});

    this.queue = [];
    this.activeWorkers = 0;
    this.isAborted = false;

    this.stats = {
      total: 0,
      completed: 0,
      failed: 0,
      totalBytes: 0
    };

    ensureDir(this.outputDir);
  }

  enqueue(item) {
    // item: { url, destPath, filename, type, tweetId }
    this.queue.push(item);
    this.stats.total++;
  }

  abort() {
    this.isAborted = true;
    this.queue = [];
  }

  async start() {
    const promises = [];
    const workerCount = Math.min(this.concurrency, Math.max(1, this.queue.length));

    for (let i = 0; i < workerCount; i++) {
      promises.push(this._worker());
    }

    await Promise.all(promises);
    return this.stats;
  }

  async _worker() {
    while (this.queue.length > 0 && !this.isAborted) {
      const item = this.queue.shift();
      if (!item) break;

      this.activeWorkers++;
      try {
        await this._downloadItem(item);
        this.stats.completed++;
        this.onProgress({ ...this.stats, currentItem: item.filename });
      } catch (err) {
        this.stats.failed++;
        this.onLog(`Download failed for ${item.filename}: ${err.message}`, 'WARN');
        this.onProgress({ ...this.stats, currentItem: item.filename });
      } finally {
        this.activeWorkers--;
      }
    }
  }

  async _downloadItem(item) {
    const destDir = path.dirname(item.destPath);
    ensureDir(destDir);

    if (fs.existsSync(item.destPath)) {
      // File already downloaded (resume / duplicate)
      const stat = fs.statSync(item.destPath);
      this.stats.totalBytes += stat.size;
      return;
    }

    const res = await fetch(item.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    const fileStream = fs.createWriteStream(item.destPath);
    const nodeStream = Readable.fromWeb(res.body);

    await finished(nodeStream.pipe(fileStream));
    this.stats.totalBytes += contentLength;
  }
}
