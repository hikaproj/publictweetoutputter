import fs from 'node:fs';
import path from 'node:path';

/**
 * Sanitize a string to be safely used as a filename/directory name.
 */
export function sanitizeFilename(str) {
  if (!str) return 'unnamed';
  return str
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .trim()
    .slice(0, 100);
}

/**
 * Convert tweet data into a clean CSV row.
 */
export function tweetsToCsv(tweets) {
  const headers = [
    'id',
    'created_at',
    'created_timestamp',
    'author_screen_name',
    'author_name',
    'text',
    'is_reply',
    'replying_to',
    'is_repost',
    'reposted_by',
    'is_quote',
    'quote_url',
    'likes',
    'retweets',
    'replies',
    'quotes',
    'views',
    'media_types',
    'media_urls',
    'tweet_url'
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = [headers.join(',')];

  for (const t of tweets) {
    const mediaList = t.media?.all || [];
    const mediaTypes = mediaList.map(m => m.type || 'unknown').join(';');
    const mediaUrls = mediaList.map(m => m.url || '').join(';');

    const row = [
      escapeCsv(t.id),
      escapeCsv(t.created_at),
      escapeCsv(t.created_timestamp),
      escapeCsv(t.author?.screen_name || ''),
      escapeCsv(t.author?.name || ''),
      escapeCsv(t.text || ''),
      escapeCsv(Boolean(t.replying_to)),
      escapeCsv(t.replying_to || ''),
      escapeCsv(Boolean(t.reposted_by)),
      escapeCsv(t.reposted_by?.screen_name || ''),
      escapeCsv(Boolean(t.quote)),
      escapeCsv(t.quote?.url || ''),
      escapeCsv(t.likes || 0),
      escapeCsv(t.retweets || t.reposts || 0),
      escapeCsv(t.replies || 0),
      escapeCsv(t.quotes || 0),
      escapeCsv(t.views || ''),
      escapeCsv(mediaTypes),
      escapeCsv(mediaUrls),
      escapeCsv(t.url || '')
    ];
    rows.push(row.join(','));
  }

  return rows.join('\r\n');
}

/**
 * Format bytes to human readable string (KB, MB, GB).
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Sleep helper.
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Ensure a directory exists.
 */
export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

/**
 * Generate formatted timestamp string for filenames: YYYYMMDD_HHmmss.
 */
export function getFormattedDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}${m}${d}_${hh}${mm}${ss}`;
}
