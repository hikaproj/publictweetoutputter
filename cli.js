#!/usr/bin/env node

import { ScrapeTask, MultiAccountManager } from './lib/task-manager.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    screenName: '',
    screenNames: [],
    maxConcurrentAccounts: 3,
    downloadImages: true,
    imageQuality: 'orig',
    downloadVideos: true,
    videoQuality: 'highest',
    dateFrom: null,
    dateTo: null,
    direction: 'newest',
    includeReplies: true,
    includeReposts: true,
    includeQuotes: true,
    includeOriginals: true,
    retryOnLocked: true,
    startOnLocked: true,
    exportFormat: 'zip',
    mediaConcurrency: 8,
    maxTweets: 0,
    continuous: false,
    continuousInterval: 30
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--user' || arg === '-u' || arg === '--users') {
      const val = args[++i] || '';
      options.screenNames = val.split(/[,\s]+/).map(h => h.replace(/^@/, '').trim()).filter(Boolean);
      options.screenName = options.screenNames[0] || '';
    } else if (arg === '--parallel-users' || arg === '--account-concurrency') {
      options.maxConcurrentAccounts = parseInt(args[++i], 10) || 3;
    } else if (arg === '--continuous' || arg === '-c') {
      options.continuous = true;
    } else if (arg === '--continuous-interval') {
      options.continuousInterval = parseInt(args[++i], 10) || 30;
    } else if (arg === '--no-images') {
      options.downloadImages = false;
    } else if (arg === '--image-quality') {
      options.imageQuality = args[++i];
    } else if (arg === '--no-videos') {
      options.downloadVideos = false;
    } else if (arg === '--video-quality') {
      options.videoQuality = args[++i];
    } else if (arg === '--from') {
      options.dateFrom = args[++i];
    } else if (arg === '--to') {
      options.dateTo = args[++i];
    } else if (arg === '--direction') {
      options.direction = args[++i];
    } else if (arg === '--no-replies') {
      options.includeReplies = false;
    } else if (arg === '--no-reposts') {
      options.includeReposts = false;
    } else if (arg === '--no-quotes') {
      options.includeQuotes = false;
    } else if (arg === '--no-retry-locked') {
      options.retryOnLocked = false;
    } else if (arg === '--format') {
      options.exportFormat = args[++i];
    } else if (arg === '--concurrency') {
      options.mediaConcurrency = parseInt(args[++i], 10) || 8;
    } else if (arg === '--max') {
      options.maxTweets = parseInt(args[++i], 10) || 0;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
FxTwitter Archive Studio CLI (by Hikaproj)
Usage: node cli.js --user <screen_name> [options]
       node cli.js --users "user1, user2, user3" [options]

Options:
  -u, --user <handle>        Twitter/X handle to backup (e.g. elonmusk, or comma-separated list)
  --parallel-users <num>     Concurrent accounts to process in parallel (default: 3)
  -c, --continuous           Continuous monitoring mode (keeps running indefinitely)
  --continuous-interval <s>  Polling interval in seconds for continuous mode (default: 30)
  --no-images                Disable image downloading
  --image-quality <q>        orig (default), large, medium, small
  --no-videos                Disable video downloading
  --video-quality <q>        highest (default), 1080p, 720p, 480p, lowest
  --from <YYYY-MM-DD>        Start date for post filtering
  --to <YYYY-MM-DD>          End date for post filtering
  --direction <dir>          newest (default) or oldest
  --no-replies               Exclude reply posts
  --no-reposts               Exclude reposted posts
  --no-quotes                Exclude quote posts
  --no-retry-locked          Stop immediately when account becomes locked
  --format <fmt>             zip (default), xarchpjzip, tar.gz, tar, folder
  --concurrency <num>        Concurrent media downloads per account (default: 8)
  --max <num>                Maximum number of tweets to fetch (0 = unlimited)
      `);
      process.exit(0);
    }
  }

  if (options.screenNames.length === 0) {
    console.error('Error: --user <screen_name> is required.');
    process.exit(1);
  }

  return options;
}

async function run() {
  const options = parseArgs();

  if (options.screenNames.length > 1) {
    console.log(`Starting multi-account monitoring for: ${options.screenNames.map(s => '@' + s).join(', ')} (concurrency: ${options.maxConcurrentAccounts})`);
    const multi = new MultiAccountManager(options);
    multi.setAccounts(options.screenNames);

    multi.on('task_log', (entry) => {
      console.log(`[@${entry.screenName}] [${entry.timestamp}] [${entry.level}] ${entry.message}`);
    });

    multi.on('task_state', (state) => {
      if (state.metrics?.speedTweetsPerSec > 0) {
        process.stdout.write(`\r[@${state.screenName}] Tweets: ${state.metrics.tweetsMatching} | Speed: ${state.metrics.speedTweetsPerSec} tw/s | Media: ${state.metrics.mediaDownloaded}   `);
      }
    });

    await multi.start();
    console.log('\nAll multi-account backup tasks completed.');
    return;
  }

  console.log(`Starting FxTwitter Archive Studio for @${options.screenName}...`);
  const task = new ScrapeTask(options);

  task.on('log', (entry) => {
    console.log(`[${entry.timestamp}] [${entry.level}] ${entry.message}`);
  });

  task.on('state', (state) => {
    if (state.metrics.speedTweetsPerSec > 0) {
      process.stdout.write(`\rTweets: ${state.metrics.tweetsMatching} | Speed: ${state.metrics.speedTweetsPerSec} tw/s | Media: ${state.metrics.mediaDownloaded}   `);
    }
  });

  await task.run();

  if (task.archiveResult) {
    console.log(`\n\nArchive ready at: ${task.archiveResult.archivePath} (${task.archiveResult.formattedSize})`);
  }
}

run().catch(console.error);
