import fs from 'node:fs';
import path from 'node:path';
import { ZipArchive, TarArchive } from 'archiver';
import { tweetsToCsv, ensureDir, formatBytes } from './utils.js';

/**
 * Write all JSON, CSV, and summary files for the task.
 */
export async function writeExportFiles(taskDir, taskData) {
  ensureDir(taskDir);

  const {
    tweets,
    profile,
    profileHistory,
    summary,
    readmeText
  } = taskData;

  // 1. tweets.json
  const tweetsJsonPath = path.join(taskDir, 'tweets.json');
  fs.writeFileSync(tweetsJsonPath, JSON.stringify(tweets, null, 2), 'utf-8');

  // 2. tweets.csv
  const tweetsCsvPath = path.join(taskDir, 'tweets.csv');
  const csvContent = tweetsToCsv(tweets);
  fs.writeFileSync(tweetsCsvPath, '\uFEFF' + csvContent, 'utf-8'); // Add BOM for Excel UTF-8 support

  // 3. profile.json
  const profileJsonPath = path.join(taskDir, 'profile.json');
  fs.writeFileSync(profileJsonPath, JSON.stringify(profile || {}, null, 2), 'utf-8');

  // 4. profile_history.json
  if (profileHistory && profileHistory.length > 0) {
    const profileHistoryPath = path.join(taskDir, 'profile_history.json');
    fs.writeFileSync(profileHistoryPath, JSON.stringify(profileHistory, null, 2), 'utf-8');
  }

  // 5. summary.json
  const summaryJsonPath = path.join(taskDir, 'summary.json');
  fs.writeFileSync(summaryJsonPath, JSON.stringify(summary, null, 2), 'utf-8');

  // 6. README.txt
  const readmePath = path.join(taskDir, 'README.txt');
  fs.writeFileSync(readmePath, readmeText || '', 'utf-8');

  // 7. Standalone X-like offline viewer & offline decompression helper
  const viewerSrc = path.resolve('public', 'viewer.html');
  if (fs.existsSync(viewerSrc)) {
    fs.copyFileSync(viewerSrc, path.join(taskDir, 'viewer.html'));
  }
  const jszipSrc = path.resolve('public', 'js', 'jszip.min.js');
  if (fs.existsSync(jszipSrc)) {
    ensureDir(path.join(taskDir, 'js'));
    fs.copyFileSync(jszipSrc, path.join(taskDir, 'js', 'jszip.min.js'));
  }

  return {
    tweetsJsonPath,
    tweetsCsvPath,
    profileJsonPath,
    summaryJsonPath,
    readmePath
  };
}

/**
 * Package a folder into an archive (.zip, .tar.gz, .tar).
 * @param {string} sourceDir - Directory to archive
 * @param {string} outPath - Destination archive path
 * @param {'zip'|'tar.gz'|'tar'} format - Archive format
 * @param {(progress: { percentage: number, processedBytes: number }) => void} [onProgress]
 */
export function createArchive(sourceDir, outPath, format = 'zip', onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(outPath));
    const output = fs.createWriteStream(outPath);

    let archive;
    if (format === 'zip' || format === 'xarchpjzip') {
      archive = new ZipArchive({ zlib: { level: 9 } });
    } else if (format === 'tar.gz') {
      archive = new TarArchive({
        gzip: true,
        gzipOptions: { level: 9 }
      });
    } else if (format === 'tar') {
      archive = new TarArchive();
    } else {
      return reject(new Error(`Unsupported archive format: ${format}`));
    }

    output.on('close', () => {
      resolve({
        archivePath: outPath,
        totalBytes: archive.pointer(),
        formattedSize: formatBytes(archive.pointer())
      });
    });

    archive.on('progress', (data) => {
      const percentage = data.entries.total ? (data.entries.processed / data.entries.total) * 100 : 0;
      onProgress({
        percentage,
        processedBytes: data.fs.processedBytes,
        totalEntries: data.entries.total,
        processedEntries: data.entries.processed
      });
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Archive directory contents under root
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}
