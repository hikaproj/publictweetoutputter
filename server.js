import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ScrapeTask, MultiAccountManager } from './lib/task-manager.js';
import { getProfile } from './lib/fxtwitter.js';
import { formatBytes } from './lib/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const OUTPUT_DIR = path.resolve(__dirname, 'output');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/output', express.static(OUTPUT_DIR));

// In-memory active task reference and SSE subscribers
let currentTask = null;
let currentMultiManager = null;
const sseClients = new Set();

function broadcastSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// SSE stream for real-time live telemetry, logs, and tweet cards
app.get('/api/task/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);

  // Send initial current status
  if (currentTask) {
    res.write(`event: state\ndata: ${JSON.stringify({
      taskId: currentTask.id,
      state: currentTask.state,
      screenName: currentTask.options.screenName,
      metrics: currentTask.metrics,
      pagesFetched: currentTask.pagesFetched,
      profile: currentTask.profile,
      archiveResult: currentTask.archiveResult
    })}\n\n`);
  }

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Quick profile lookup/preview endpoint
app.get('/api/profile/:screen_name', async (req, res) => {
  try {
    const screenName = req.params.screen_name;
    const profile = await getProfile(screenName);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start backup task (supports single or multi-account concurrent monitoring)
app.post('/api/task/start', async (req, res) => {
  const options = req.body || {};
  const rawInput = options.screenNames || options.screenName || '';
  const handles = (Array.isArray(rawInput) ? rawInput : rawInput.split(/[,\s\n]+/))
    .map(h => h.replace(/^@/, '').trim())
    .filter(Boolean);

  if (handles.length === 0) {
    return res.status(400).json({ error: 'At least one screenName is required.' });
  }

  const targetBaseDir = options.outputDir ? path.resolve(options.outputDir) : OUTPUT_DIR;

  if (handles.length > 1) {
    // Multi-account concurrent monitoring
    const maxConcurrent = Math.max(1, parseInt(options.maxConcurrentAccounts, 10) || 3);
    currentMultiManager = new MultiAccountManager({
      ...options,
      maxConcurrentAccounts: maxConcurrent,
      outputBaseDir: targetBaseDir
    });

    currentMultiManager.setAccounts(handles);

    currentMultiManager.on('task_state', (state) => broadcastSSE('state', state));
    currentMultiManager.on('task_log', (log) => broadcastSSE('log', log));
    currentMultiManager.on('task_tweet', (data) => broadcastSSE('tweet', data.tweet));
    currentMultiManager.on('task_profile_update', (upd) => broadcastSSE('profile_update', upd));

    currentMultiManager.start().catch(console.error);

    return res.json({
      message: `Multi-account monitoring started (${handles.length} accounts, concurrency: ${maxConcurrent})`,
      accounts: handles,
      concurrency: maxConcurrent
    });
  }

  // Single account execution
  if (currentTask && ['INITIALIZING', 'FETCHING', 'MONITORING', 'LOCKED_WAITING', 'LOCKED_WAITING_RESUME', 'DOWNLOADING_MEDIA', 'FINALIZING'].includes(currentTask.state)) {
    return res.status(409).json({ error: 'A backup task is already actively running. Please stop it first.' });
  }

  currentTask = new ScrapeTask({
    ...options,
    screenName: handles[0],
    outputBaseDir: targetBaseDir
  });

  currentTask.on('log', (logEntry) => broadcastSSE('log', logEntry));
  currentTask.on('state', (stateData) => broadcastSSE('state', stateData));
  currentTask.on('tweet', (tweet) => broadcastSSE('tweet', tweet));
  currentTask.on('profile_update', (update) => broadcastSSE('profile_update', update));
  currentTask.on('archive_progress', (prog) => broadcastSSE('archive_progress', prog));

  currentTask.run().catch((err) => {
    console.error('Task error:', err);
  });

  res.json({
    message: 'Task initiated',
    taskId: currentTask.id,
    options: currentTask.options
  });
});

// Task controls
app.post('/api/task/pause', (req, res) => {
  if (currentTask) currentTask.pause();
  res.json({ success: true });
});

app.post('/api/task/resume', (req, res) => {
  if (currentTask) currentTask.resume();
  res.json({ success: true });
});

app.post('/api/task/stop-export', async (req, res) => {
  if (currentMultiManager) {
    await currentMultiManager.stopAllAndExport();
  }
  if (currentTask) {
    await currentTask.stopAndExport();
  }
  res.json({ success: true, message: 'Stopping and finalizing exports...' });
});

app.post('/api/task/cancel', (req, res) => {
  if (currentMultiManager) {
    currentMultiManager.cancelAll();
  }
  if (currentTask) {
    currentTask.cancel();
  }
  res.json({ success: true, message: 'Tasks cancelled.' });
});

app.get('/api/tasks', (req, res) => {
  if (currentMultiManager) {
    return res.json({
      type: 'multi',
      tasks: currentMultiManager.getAllTasks()
    });
  }
  if (currentTask) {
    return res.json({
      type: 'single',
      tasks: [{
        screenName: currentTask.options.screenName,
        taskId: currentTask.id,
        state: currentTask.state,
        metrics: currentTask.metrics
      }]
    });
  }
  res.json({ type: 'none', tasks: [] });
});

app.get('/api/task/status', (req, res) => {
  if (!currentTask) {
    return res.json({ state: 'IDLE' });
  }

  res.json({
    taskId: currentTask.id,
    state: currentTask.state,
    screenName: currentTask.options.screenName,
    metrics: currentTask.metrics,
    pagesFetched: currentTask.pagesFetched,
    profile: currentTask.profile,
    profileHistory: currentTask.profileHistory,
    archiveResult: currentTask.archiveResult,
    recentTweets: currentTask.tweets.slice(-20)
  });
});

// Download archive endpoint
app.get('/api/download/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(OUTPUT_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, filename);
});

// History endpoint listing past backup outputs
app.get('/api/history', (req, res) => {
  if (!fs.existsSync(OUTPUT_DIR)) {
    return res.json({ backups: [] });
  }

  const entries = fs.readdirSync(OUTPUT_DIR, { withFileTypes: true });
  const backups = [];

  for (const entry of entries) {
    const fullPath = path.join(OUTPUT_DIR, entry.name);
    const stat = fs.statSync(fullPath);

    if (entry.isFile() && (entry.name.endsWith('.zip') || entry.name.endsWith('.tar.gz') || entry.name.endsWith('.tar'))) {
      backups.push({
        filename: entry.name,
        type: 'archive',
        size: stat.size,
        formattedSize: formatBytes(stat.size),
        createdAt: stat.mtime
      });
    } else if (entry.isDirectory()) {
      const summaryFile = path.join(fullPath, 'summary.json');
      let summary = null;
      if (fs.existsSync(summaryFile)) {
        try {
          summary = JSON.parse(fs.readFileSync(summaryFile, 'utf-8'));
        } catch (e) {}
      }
      backups.push({
        folderName: entry.name,
        type: 'folder',
        createdAt: stat.mtime,
        summary
      });
    }
  }

  backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ backups });
});

// Presets endpoint
app.get('/api/presets', (req, res) => {
  res.json({
    presets: [
      {
        id: 'full',
        name: 'フルバックアップ (All-in)',
        description: 'すべてのポスト、最高画質画像、最高画質動画、全プロフィール項目を保存',
        config: {
          downloadImages: true,
          imageQuality: 'orig',
          downloadVideos: true,
          videoQuality: 'highest',
          includeReplies: true,
          includeReposts: true,
          includeQuotes: true,
          includeOriginals: true,
          retryOnLocked: true,
          startOnLocked: true,
          exportFormat: 'zip'
        }
      },
      {
        id: 'media_only',
        name: 'メディア重点 (Media Heavy)',
        description: '画像・動画を高画質で一括ダウンロード。リポストや返信は除外',
        config: {
          downloadImages: true,
          imageQuality: 'orig',
          downloadVideos: true,
          videoQuality: '1080p',
          includeReplies: false,
          includeReposts: false,
          includeQuotes: true,
          includeOriginals: true,
          retryOnLocked: true,
          startOnLocked: true,
          exportFormat: 'zip'
        }
      },
      {
        id: 'speed_light',
        name: '超高速・軽量 (Fast Text Only)',
        description: 'メディアダウンロードをOFFにし、ポスト本文とメタデータのみを超高速で収集',
        config: {
          downloadImages: false,
          downloadVideos: false,
          includeReplies: true,
          includeReposts: true,
          includeQuotes: true,
          includeOriginals: true,
          retryOnLocked: false,
          startOnLocked: false,
          exportFormat: 'zip'
        }
      },
      {
        id: 'archive_orig',
        name: '元投稿オンリー (Originals Only)',
        description: '本人の通常投稿と引用のみを対象とし、返信やリポストを完全スキップ',
        config: {
          downloadImages: true,
          imageQuality: 'orig',
          downloadVideos: true,
          videoQuality: 'highest',
          includeReplies: false,
          includeReposts: false,
          includeQuotes: true,
          includeOriginals: true,
          retryOnLocked: true,
          startOnLocked: true,
          exportFormat: 'tar.gz'
        }
      }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(` PublicTweetOutputter Web UI is running!`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
