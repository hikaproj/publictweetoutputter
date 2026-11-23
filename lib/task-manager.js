import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { getProfile, getStatuses, getSingleTweet, filterProfileData } from './fxtwitter.js';
import { MediaDownloader, selectImageUrl, selectVideoUrl } from './media-downloader.js';
import { writeExportFiles, createArchive } from './exporter.js';
import { ensureDir, sanitizeFilename, formatBytes, getFormattedDate, sleep } from './utils.js';

export class ScrapeTask extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      screenName: options.screenName ? options.screenName.replace(/^@/, '').trim() : '',
      downloadImages: options.downloadImages ?? true,
      imageQuality: options.imageQuality || 'orig', // 'orig', 'large', 'medium', 'small'
      downloadVideos: options.downloadVideos ?? true,
      videoQuality: options.videoQuality || 'highest', // 'highest', '1080p', '720p', '480p', 'lowest'
      dateFrom: options.dateFrom || null, // YYYY-MM-DD
      dateTo: options.dateTo || null, // YYYY-MM-DD
      direction: options.direction || 'newest', // 'newest' | 'oldest'
      includeReplies: options.includeReplies ?? true,
      includeReposts: options.includeReposts ?? true,
      includeQuotes: options.includeQuotes ?? true,
      includeOriginals: options.includeOriginals ?? true,
      retryOnLocked: options.retryOnLocked ?? true,
      lockedPollingInterval: Math.max(3, options.lockedPollingInterval || 6), // seconds
      startOnLocked: options.startOnLocked ?? true,
      profileToggles: options.profileToggles || {
        header_image: true,
        avatar_image: true,
        user_id: true,
        bio: true,
        birthday: true,
        url: true,
        location: true,
        pinned_tweet: true
      },
      exportFormat: options.exportFormat || 'zip', // 'zip', 'tar.gz', 'tar', 'folder'
      mediaConcurrency: options.mediaConcurrency || 8,
      apiDelay: options.apiDelay || 100, // ms between pagination requests
      maxTweets: options.maxTweets || 0, // 0 = unlimited
      continuous: options.continuous ?? false, // 常時監視・継続取得モード
      continuousInterval: Math.max(5, options.continuousInterval || 30) // seconds between polls
    };

    this.id = `${sanitizeFilename(this.options.screenName)}_${getFormattedDate()}`;
    this.outputDir = path.resolve(options.outputBaseDir || options.outputDir || 'output', this.id);

    // Runtime state
    this.state = 'INITIALIZING'; // 'INITIALIZING', 'FETCHING', 'MONITORING', 'LOCKED_WAITING', 'LOCKED_WAITING_RESUME', 'DOWNLOADING_MEDIA', 'FINALIZING', 'COMPLETED', 'STOPPED', 'ERROR'
    this.isStopping = false;
    this.isPaused = false;
    this.stopRequestedEarlyExport = false;

    // Data stores
    this.profile = null;
    this.profileHistory = [];
    this.lastProfileRaw = null;
    this.tweets = [];
    this.tweetIdSet = new Set();
    this.cursor = null;
    this.pagesFetched = 0;

    // Performance & metrics
    this.startTime = null;
    this.endTime = null;
    this.metrics = {
      tweetsProcessed: 0,
      tweetsMatching: 0,
      imagesFound: 0,
      videosFound: 0,
      mediaDownloaded: 0,
      mediaFailed: 0,
      totalBytesDownloaded: 0,
      profileUpdatesDetected: 0,
      lockRetries: 0,
      speedTweetsPerSec: 0
    };

    this.mediaDownloader = null;
    this.archiveResult = null;
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logEntry = { timestamp, level, message };
    this.emit('log', logEntry);
  }

  emitState(extra = {}) {
    this.emit('state', {
      taskId: this.id,
      state: this.state,
      screenName: this.options.screenName,
      metrics: this.metrics,
      pagesFetched: this.pagesFetched,
      cursor: this.cursor,
      profile: this.profile,
      archiveResult: this.archiveResult,
      ...extra
    });
  }

  async run() {
    this.startTime = Date.now();
    ensureDir(this.outputDir);

    this.log(`Starting backup task for @${this.options.screenName}`, 'INFO');
    this.emitState();

    try {
      // Step 1: Initial Profile Fetch & Locked Check
      let profileResult = await this._checkProfile();
      if (!profileResult.found) {
        this.state = 'ERROR';
        this.log(`Target user @${this.options.screenName} was not found on Twitter/X.`, 'ERROR');
        this.emitState({ error: 'User not found' });
        return;
      }

      // Step 2: Handle Initial Locked Account
      if (profileResult.protected) {
        if (!this.options.startOnLocked) {
          this.state = 'STOPPED';
          this.log(`User @${this.options.screenName} is currently private/locked. "Start on locked" is disabled.`, 'WARN');
          this.emitState();
          return;
        }

        this.state = 'LOCKED_WAITING';
        this.log(`User @${this.options.screenName} is currently locked (鍵垢). Entering unlock-waiting loop...`, 'WARN');
        this.emitState();

        const unlocked = await this._waitForUnlock();
        if (!unlocked) {
          if (this.isStopping) {
            this.state = 'STOPPED';
            this.log(`Task stopped while waiting for unlock.`, 'INFO');
          } else {
            this.state = 'ERROR';
            this.log(`Unlock waiting failed or aborted.`, 'ERROR');
          }
          this.emitState();
          return;
        }
      }

      // Step 3: Fetch Timeline / Tweets with pagination
      this.state = 'FETCHING';
      this.log(`Beginning ultra-fast tweet collection for @${this.options.screenName}...`, 'SUCCESS');
      this.emitState();

      await this._fetchTimeline();

      if (this.isStopping && !this.stopRequestedEarlyExport) {
        this.state = 'STOPPED';
        this.log(`Task was cancelled by user.`, 'WARN');
        this.emitState();
        return;
      }

      // Step 4: Sort Tweets if direction is 'oldest'
      if (this.options.direction === 'oldest') {
        this.log(`Sorting ${this.tweets.length} tweets in chronological order (oldest first)...`, 'INFO');
        this.tweets.sort((a, b) => (a.created_timestamp || 0) - (b.created_timestamp || 0));
      } else {
        // Ensure newest first
        this.tweets.sort((a, b) => (b.created_timestamp || 0) - (a.created_timestamp || 0));
      }

      // Step 5: Media Queue & Concurrent Download
      if (this.options.downloadImages || this.options.downloadVideos || this.options.profileToggles.avatar_image || this.options.profileToggles.header_image) {
        this.state = 'DOWNLOADING_MEDIA';
        this.log(`Queueing media files for download (concurrency: ${this.options.mediaConcurrency})...`, 'INFO');
        this.emitState();

        await this._downloadAllMedia();
      }

      // Step 5.5: Continuous Monitoring Loop (if enabled)
      if (this.options.continuous && !this.isStopping) {
        this.state = 'MONITORING';
        this.log(`Initial archive complete. Entering continuous monitoring mode (poll interval: ${this.options.continuousInterval}s)...`, 'SUCCESS');
        this.emitState();

        await this._continuousMonitoringLoop();
      }

      // Step 6: Finalize files and archive
      this.state = 'FINALIZING';
      this.log(`Generating metadata, CSV, and export packages...`, 'INFO');
      this.emitState();

      await this._finalizeExport();

      this.endTime = Date.now();
      const elapsedSec = ((this.endTime - this.startTime) / 1000).toFixed(1);
      this.state = 'COMPLETED';
      this.log(`Backup completed successfully in ${elapsedSec}s! Processed ${this.tweets.length} tweets, downloaded ${this.metrics.mediaDownloaded} media files.`, 'SUCCESS');
      this.emitState();

    } catch (err) {
      this.state = 'ERROR';
      this.log(`Unexpected task error: ${err.message}`, 'ERROR');
      this.emitState({ error: err.message });
    }
  }

  /**
   * Check profile and record any updates.
   */
  async _checkProfile() {
    const res = await getProfile(this.options.screenName);
    if (!res.found) return res;

    const user = res.user;

    // Check for profile updates if we have prior profile data
    if (this.lastProfileRaw) {
      const diff = this._computeProfileDiff(this.lastProfileRaw, user);
      if (diff) {
        this.metrics.profileUpdatesDetected++;
        const updateEntry = {
          timestamp: new Date().toISOString(),
          diff,
          updated_fields: Object.keys(diff),
          profile: user
        };
        this.profileHistory.push(updateEntry);
        this.log(`[PROFILE UPDATE DETECTED] Fields changed: ${Object.keys(diff).join(', ')}`, 'SUCCESS');
        this.emit('profile_update', updateEntry);

        // If avatar or header changed, queue them with timestamp
        if (diff.avatar_url && this.options.profileToggles.avatar_image) {
          this._queueProfileMedia(diff.avatar_url.to, 'avatar', true);
        }
        if (diff.banner_url && this.options.profileToggles.header_image) {
          this._queueProfileMedia(diff.banner_url.to, 'banner', true);
        }
      }
    } else {
      // First time setting profile
      this.profile = filterProfileData(user, this.options.profileToggles);
      if (user.avatar_url && this.options.profileToggles.avatar_image) {
        this._queueProfileMedia(user.avatar_url, 'avatar', false);
      }
      if (user.banner_url && this.options.profileToggles.header_image) {
        this._queueProfileMedia(user.banner_url, 'banner', false);
      }
    }

    this.lastProfileRaw = { ...user };
    this.profile = filterProfileData(user, this.options.profileToggles);
    return res;
  }

  /**
   * Continuous monitoring loop: periodically checks for new posts and profile updates.
   */
  async _continuousMonitoringLoop() {
    let checkCount = 0;
    while (!this.isStopping) {
      await sleep(this.options.continuousInterval * 1000);
      if (this.isStopping) break;

      checkCount++;
      this.log(`Checking for new posts & profile updates (check #${checkCount})...`, 'INFO');

      try {
        // 1. Profile check
        const profCheck = await this._checkProfile();
        if (profCheck.found && profCheck.protected) {
          this.log(`[LOCKED ACCOUNT DETECTED] @${this.options.screenName} became locked during monitoring.`, 'WARN');
          if (this.options.retryOnLocked) {
            this.state = 'LOCKED_WAITING_RESUME';
            this.emitState();
            const unlocked = await this._waitForUnlock();
            if (unlocked) {
              this.state = 'MONITORING';
              this.emitState();
            } else {
              break;
            }
          } else {
            this.log(`Account locked and retry is OFF. Finalizing data.`, 'INFO');
            break;
          }
        }

        // 2. Fetch latest page of statuses
        const latestPage = await getStatuses(this.options.screenName);
        if (latestPage.ok && latestPage.results?.length > 0) {
          const newTweets = [];
          for (const item of latestPage.results) {
            if (this.tweetIdSet.has(item.id)) continue;
            this.tweetIdSet.add(item.id);

            // Filter checks
            const isReply = Boolean(item.replying_to || item.replying_to_status);
            const isRepost = Boolean(item.reposted_by);
            const isQuote = Boolean(item.quote);
            const isOriginal = !isReply && !isRepost && !isQuote;

            if (isReply && !this.options.includeReplies) continue;
            if (isRepost && !this.options.includeReposts) continue;
            if (isQuote && !this.options.includeQuotes) continue;
            if (isOriginal && !this.options.includeOriginals) continue;

            const photos = item.media?.photos || [];
            const videos = item.media?.videos || [];
            this.metrics.imagesFound += photos.length;
            this.metrics.videosFound += videos.length;

            newTweets.push(item);
            this.emit('tweet', item);
          }

          if (newTweets.length > 0) {
            this.log(`[NEW POSTS] Captured ${newTweets.length} new post(s) in real-time!`, 'SUCCESS');
            this.tweets.push(...newTweets);
            this.metrics.tweetsMatching += newTweets.length;

            if (this.options.direction === 'oldest') {
              this.tweets.sort((a, b) => (a.created_timestamp || 0) - (b.created_timestamp || 0));
            } else {
              this.tweets.sort((a, b) => (b.created_timestamp || 0) - (a.created_timestamp || 0));
            }

            // Immediately download media for new posts
            if (this.options.downloadImages || this.options.downloadVideos) {
              await this._downloadAllMedia();
            }

            this.emitState();
          }
        }
      } catch (err) {
        this.log(`Monitoring check error: ${err.message}`, 'WARN');
      }
    }
  }

  _computeProfileDiff(oldP, newP) {
    const keysToCheck = ['name', 'description', 'location', 'website', 'avatar_url', 'banner_url', 'birthday'];
    const diff = {};
    let hasDiff = false;

    for (const key of keysToCheck) {
      const oldVal = oldP[key] ? JSON.stringify(oldP[key]) : '';
      const newVal = newP[key] ? JSON.stringify(newP[key]) : '';
      if (oldVal !== newVal) {
        diff[key] = { from: oldP[key], to: newP[key] };
        hasDiff = true;
      }
    }

    return hasDiff ? diff : null;
  }

  _profileMediaToDownload = [];
  _queueProfileMedia(url, type, isUpdate = false) {
    if (!url) return;
    // Extract a clean file extension or default to jpg
    let ext = 'jpg';
    try {
      const pathname = new URL(url).pathname;
      const match = pathname.match(/\.(jpg|jpeg|png|webp|gif)$/i);
      if (match) {
        ext = match[1].toLowerCase();
      }
    } catch (e) {}

    const timestampSuffix = isUpdate ? `_${getFormattedDate()}` : '';
    const filename = `${type}${timestampSuffix}.${ext}`;
    const destPath = path.join(this.outputDir, 'profile_media', filename);

    this._profileMediaToDownload.push({
      url,
      destPath,
      filename,
      type: `profile_${type}`
    });
  }

  /**
   * Unlock waiting loop. Polls profile endpoint until public or stopped.
   */
  async _waitForUnlock() {
    while (!this.isStopping) {
      await sleep(this.options.lockedPollingInterval * 1000);
      if (this.isStopping) return false;

      this.metrics.lockRetries++;
      this.log(`Checking if @${this.options.screenName} has become public (retry #${this.metrics.lockRetries})...`, 'INFO');
      this.emitState();

      try {
        const check = await this._checkProfile();
        if (check.found && !check.protected) {
          this.log(`@${this.options.screenName} is now PUBLIC! Resuming collection.`, 'SUCCESS');
          return true;
        }
      } catch (e) {
        this.log(`Error checking profile status: ${e.message}`, 'WARN');
      }
    }
    return false;
  }

  /**
   * Paginate through timeline statuses using FxTwitter.
   */
  async _fetchTimeline() {
    let hasMore = true;
    let consecutiveFails = 0;

    // Convert date range strings to timestamps if provided
    const dateFromTs = this.options.dateFrom ? Math.floor(new Date(this.options.dateFrom).getTime() / 1000) : null;
    const dateToTs = this.options.dateTo ? Math.floor(new Date(`${this.options.dateTo}T23:59:59Z`).getTime() / 1000) : null;

    while (hasMore && !this.isStopping) {
      if (this.isPaused) {
        await sleep(500);
        continue;
      }

      // Check max tweets limit if specified
      if (this.options.maxTweets > 0 && this.tweets.length >= this.options.maxTweets) {
        this.log(`Reached requested maximum tweet limit (${this.options.maxTweets}). Stopping timeline scan.`, 'INFO');
        break;
      }

      this.pagesFetched++;
      const pageResult = await getStatuses(this.options.screenName, this.cursor);

      // Handle locked midway or API error
      if (!pageResult.ok) {
        // Verify if user just locked their account
        const profileCheck = await this._checkProfile();
        if (profileCheck.found && profileCheck.protected) {
          this.log(`[LOCKED ACCOUNT DETECTED] @${this.options.screenName} just locked their account during retrieval!`, 'WARN');

          if (this.options.retryOnLocked) {
            this.state = 'LOCKED_WAITING_RESUME';
            this.emitState();

            const unlocked = await this._waitForUnlock();
            if (unlocked) {
              this.state = 'FETCHING';
              this.emitState();
              continue; // Retry fetching current page
            } else {
              // User stopped or early export requested
              if (this.stopRequestedEarlyExport) {
                this.log(`User requested to finalize and export retrieved data so far.`, 'INFO');
                return;
              }
              break;
            }
          } else {
            // Early export configured when locked
            this.log(`Account locked and retry is OFF. Finalizing ${this.tweets.length} tweets retrieved so far.`, 'INFO');
            return;
          }
        }

        consecutiveFails++;
        this.log(`Page fetch failed (attempt ${consecutiveFails}): ${pageResult.message}`, 'WARN');
        if (consecutiveFails >= 4) {
          this.log(`Reached maximum consecutive page failures. Stopping fetch loop.`, 'WARN');
          break;
        }
        await sleep(1500 * consecutiveFails);
        continue;
      }

      consecutiveFails = 0;
      const results = pageResult.results || [];
      if (results.length === 0) {
        this.log(`No more tweets found in timeline.`, 'INFO');
        break;
      }

      // Process tweets in this page
      let pageNewMatchingCount = 0;
      let oldestTimestampInBatch = Infinity;

      for (const item of results) {
        this.metrics.tweetsProcessed++;

        // Dedup by tweet ID
        if (this.tweetIdSet.has(item.id)) continue;
        this.tweetIdSet.add(item.id);

        const createdTs = item.created_timestamp || 0;
        if (createdTs < oldestTimestampInBatch) {
          oldestTimestampInBatch = createdTs;
        }

        // Date range checks
        if (dateToTs && createdTs > dateToTs) {
          // Newer than dateTo; skip
          continue;
        }
        if (dateFromTs && createdTs < dateFromTs) {
          // Older than dateFrom; skip
          continue;
        }

        // Type filter checks
        const isReply = Boolean(item.replying_to || item.replying_to_status);
        const isRepost = Boolean(item.reposted_by);
        const isQuote = Boolean(item.quote);
        const isOriginal = !isReply && !isRepost && !isQuote;

        if (isReply && !this.options.includeReplies) continue;
        if (isRepost && !this.options.includeReposts) continue;
        if (isQuote && !this.options.includeQuotes) continue;
        if (isOriginal && !this.options.includeOriginals) continue;

        // Count media
        const photos = item.media?.photos || [];
        const videos = item.media?.videos || [];
        this.metrics.imagesFound += photos.length;
        this.metrics.videosFound += videos.length;

        this.tweets.push(item);
        this.metrics.tweetsMatching++;
        pageNewMatchingCount++;

        this.emit('tweet', item);
      }

      // Calculate speed
      const elapsed = (Date.now() - this.startTime) / 1000;
      if (elapsed > 0) {
        this.metrics.speedTweetsPerSec = parseFloat((this.metrics.tweetsProcessed / elapsed).toFixed(1));
      }

      this.log(`Page ${this.pagesFetched}: +${pageNewMatchingCount} tweets added (Total: ${this.tweets.length})`, 'INFO');
      this.emitState();

      // Check if we passed dateFromTs (timeline goes from newest to oldest)
      if (dateFromTs && oldestTimestampInBatch !== Infinity && oldestTimestampInBatch < dateFromTs) {
        this.log(`Reached posts older than Date From (${this.options.dateFrom}). Early exit.`, 'SUCCESS');
        break;
      }

      // Check cursor
      const nextCursor = pageResult.cursor?.bottom;
      if (!nextCursor || nextCursor === this.cursor) {
        this.log(`Reached end of timeline cursor.`, 'INFO');
        break;
      }

      this.cursor = nextCursor;
      await sleep(this.options.apiDelay);
    }
  }

  /**
   * Download all queued media concurrently.
   */
  async _downloadAllMedia() {
    this.mediaDownloader = new MediaDownloader({
      concurrency: this.options.mediaConcurrency,
      outputDir: path.join(this.outputDir, 'media'),
      onProgress: (stats) => {
        this.metrics.mediaDownloaded = stats.completed;
        this.metrics.mediaFailed = stats.failed;
        this.metrics.totalBytesDownloaded = stats.totalBytes;
        this.emitState();
      },
      onLog: (msg, level) => this.log(msg, level)
    });

    // 1. Enqueue profile media
    for (const item of this._profileMediaToDownload) {
      this.mediaDownloader.enqueue(item);
    }

    // 2. Enqueue tweet photos & videos
    for (const tweet of this.tweets) {
      const tweetId = tweet.id;
      const media = tweet.media || {};

      // Images
      if (this.options.downloadImages && media.photos) {
        media.photos.forEach((photo, idx) => {
          const rawUrl = photo.url;
          const adjustedUrl = selectImageUrl(rawUrl, this.options.imageQuality);
          let ext = 'jpg';
          try {
            const pathname = new URL(rawUrl).pathname;
            const match = pathname.match(/\.(jpg|jpeg|png|webp|gif)$/i);
            if (match) {
              ext = match[1].toLowerCase();
            } else {
              const fmt = new URL(rawUrl).searchParams.get('format');
              if (fmt) ext = fmt.toLowerCase();
            }
          } catch (e) {}

          const filename = `${tweetId}_photo_${idx + 1}.${ext}`;
          const destPath = path.join(this.outputDir, 'media', filename);

          this.mediaDownloader.enqueue({
            url: adjustedUrl,
            destPath,
            filename,
            type: 'photo',
            tweetId
          });
        });
      }

      // Videos
      if (this.options.downloadVideos && media.videos) {
        media.videos.forEach((video, idx) => {
          const targetUrl = selectVideoUrl(video, this.options.videoQuality);
          if (targetUrl) {
            const filename = `${tweetId}_video_${idx + 1}.mp4`;
            const destPath = path.join(this.outputDir, 'media', filename);

            this.mediaDownloader.enqueue({
              url: targetUrl,
              destPath,
              filename,
              type: 'video',
              tweetId
            });
          }
        });
      }
    }

    this.log(`Total media items to download: ${this.mediaDownloader.queue.length}`, 'INFO');
    await this.mediaDownloader.start();
  }

  /**
   * Finalize export files and generate archive.
   */
  async _finalizeExport() {
    const summary = {
      task_id: this.id,
      target_user: this.options.screenName,
      author: 'Hikaproj',
      created_at: new Date().toISOString(),
      duration_seconds: Math.round(((Date.now() - this.startTime) / 1000)),
      total_tweets_collected: this.tweets.length,
      metrics: this.metrics,
      options: this.options
    };

    const readmeText = `=====================================================
FxTwitter Archive Studio / PublicTweetOutputter
Created by Hikaproj
=====================================================
Target Handle: @${this.options.screenName}
Export Date:   ${new Date().toLocaleString()}
Total Tweets:  ${this.tweets.length}
Media Files:   ${this.metrics.mediaDownloaded} (${formatBytes(this.metrics.totalBytesDownloaded)})
Profile Changes Detected: ${this.metrics.profileUpdatesDetected}

Contents:
- viewer.html          : Standalone X-like offline viewer (open directly in any browser!)
- tweets.json          : Full structured tweets array
- tweets.csv           : Spreadsheet-compatible CSV of all posts
- profile.json         : Filtered user profile details
- profile_history.json : Profile modifications observed during extraction (if any)
- summary.json         : Extraction telemetry & configuration
- media/               : Downloaded images and videos
- profile_media/       : Profile avatar and banner images

Powered by FixTweet / FxTwitter API & PublicTweetOutputter (by Hikaproj)
=====================================================`;

    await writeExportFiles(this.outputDir, {
      tweets: this.tweets,
      profile: this.profile,
      profileHistory: this.profileHistory,
      summary,
      readmeText
    });

    // Create archive if format is zip, tar.gz, or tar
    if (this.options.exportFormat !== 'folder') {
      const ext = this.options.exportFormat === 'tar.gz' ? 'tar.gz' : this.options.exportFormat;
      const archiveFilename = `${this.id}.${ext}`;
      const archiveOutPath = path.join(path.dirname(this.outputDir), archiveFilename);

      this.log(`Compressing backup into ${archiveFilename}...`, 'INFO');
      this.archiveResult = await createArchive(this.outputDir, archiveOutPath, this.options.exportFormat, (prog) => {
        this.emit('archive_progress', prog);
      });
      this.log(`Archive created: ${archiveFilename} (${this.archiveResult.formattedSize})`, 'SUCCESS');
    }
  }

  /**
   * Pause execution.
   */
  pause() {
    this.isPaused = true;
    this.log(`Task paused.`, 'WARN');
    this.emitState();
  }

  /**
   * Resume execution.
   */
  resume() {
    this.isPaused = false;
    this.log(`Task resumed.`, 'INFO');
    this.emitState();
  }

  /**
   * Stop immediately and finalize what has been retrieved so far.
   */
  async stopAndExport() {
    this.log(`User requested stop & export. Finalizing current progress...`, 'WARN');
    this.isStopping = true;
    this.stopRequestedEarlyExport = true;
    if (this.mediaDownloader) {
      this.mediaDownloader.abort();
    }
  }

  /**
   * Cancel and abort task completely.
   */
  cancel() {
    this.log(`Task cancelled.`, 'WARN');
    this.isStopping = true;
    this.state = 'STOPPED';
    if (this.mediaDownloader) {
      this.mediaDownloader.abort();
    }
    this.emitState();
  }
}

/**
 * MultiAccountManager: Orchestrates concurrent tasks across multiple accounts.
 */
export class MultiAccountManager extends EventEmitter {
  constructor(baseOptions = {}) {
    super();
    this.baseOptions = baseOptions;
    this.maxConcurrent = Math.max(1, baseOptions.maxConcurrentAccounts || 3);
    this.tasks = new Map(); // screenName -> ScrapeTask
    this.activeWorkers = 0;
    this.queue = [];
    this.isStoppingAll = false;
  }

  setAccounts(accounts = []) {
    this.queue = accounts
      .map(a => a.replace(/^@/, '').trim())
      .filter(a => a.length > 0);
  }

  getTask(screenName) {
    const clean = screenName.replace(/^@/, '').trim().toLowerCase();
    return this.tasks.get(clean);
  }

  getAllTasks() {
    return Array.from(this.tasks.values()).map(t => ({
      screenName: t.options.screenName,
      taskId: t.id,
      state: t.state,
      metrics: t.metrics,
      pagesFetched: t.pagesFetched,
      archiveResult: t.archiveResult
    }));
  }

  async start() {
    this.isStoppingAll = false;
    const workers = [];
    const count = Math.min(this.maxConcurrent, this.queue.length);
    for (let i = 0; i < count; i++) {
      workers.push(this._worker());
    }
    await Promise.all(workers);
  }

  async _worker() {
    while (this.queue.length > 0 && !this.isStoppingAll) {
      const screenName = this.queue.shift();
      if (!screenName) break;

      const clean = screenName.toLowerCase();
      const task = new ScrapeTask({
        ...this.baseOptions,
        screenName
      });

      this.tasks.set(clean, task);

      // Forward events
      task.on('state', (state) => this.emit('task_state', state));
      task.on('log', (log) => this.emit('task_log', { screenName, ...log }));
      task.on('tweet', (tweet) => this.emit('task_tweet', { screenName, tweet }));
      task.on('profile_update', (upd) => this.emit('task_profile_update', { screenName, ...upd }));

      this.activeWorkers++;
      try {
        await task.run();
      } catch (err) {
        console.error(`Task for @${screenName} failed:`, err);
      } finally {
        this.activeWorkers--;
      }
    }
  }

  async stopAllAndExport() {
    this.isStoppingAll = true;
    const promises = [];
    for (const task of this.tasks.values()) {
      promises.push(task.stopAndExport());
    }
    await Promise.all(promises);
  }

  cancelAll() {
    this.isStoppingAll = true;
    for (const task of this.tasks.values()) {
      task.cancel();
    }
  }
}

