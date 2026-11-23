// FxTwitter Archive Studio - Frontend Application Logic
// Created by Hikaproj
// Supports both Rust Desktop Native (Tauri IPC) and Node.js Web Server

document.addEventListener('DOMContentLoaded', () => {
  const isTauri = typeof window !== 'undefined' && Boolean(window.__TAURI__?.core?.invoke);
  console.log(`[FxTwitter Studio] Runtime mode: ${isTauri ? 'Rust Desktop Native (Tauri)' : 'Node.js Web'}`);

  // Connection Indicator
  const connectionDot = document.getElementById('connection-dot');
  const connectionText = document.getElementById('connection-text');
  if (isTauri && connectionText) {
    connectionText.textContent = 'RUST NATIVE ENGINE';
    if (connectionDot) connectionDot.classList.add('online');
  }

  // ==========================================================================
  // Tauri Native Event Streaming Listeners (Live Feed, Logs, State)
  // ==========================================================================
  if (isTauri && window.__TAURI__?.event?.listen) {
    window.__TAURI__.event.listen('task-tweet', (e) => {
      renderFeedTweet(e.payload);
    });

    window.__TAURI__.event.listen('task-state', (e) => {
      const data = e.payload;
      if (data.metrics) updateTelemetry(data.metrics, data.state);
      if (data.state === 'FETCHING' || data.state === 'DOWNLOADING_MEDIA' || data.state === 'MONITORING') {
        setRunningUI(true);
      } else if (data.state === 'COMPLETED' || data.state === 'STOPPED') {
        setRunningUI(false);
      }
      if (data.archive_path) {
        lastGeneratedArchive = data.archive_path;
        archiveDownloadWrap.classList.remove('hidden');
        archiveDownloadText.textContent = `出力完了: ${data.archive_path}`;
        archiveDownloadLink.onclick = async (ev) => {
          ev.preventDefault();
          try {
            await window.__TAURI__.core.invoke('open_in_viewer', { archivePath: data.archive_path });
          } catch (_) {
            window.open('viewer.html', '_blank');
          }
        };
      }
    });

    window.__TAURI__.event.listen('task-log', (e) => {
      const data = e.payload;
      appendTerminalLog(data.message, data.level || 'INFO');
    });
  }

  // ==========================================================================
  // Launch Standalone Dedicated Viewer Window
  // ==========================================================================
  const openViewerWindowBtn = document.getElementById('openViewerWindowBtn');
  if (openViewerWindowBtn) {
    openViewerWindowBtn.addEventListener('click', async () => {
      if (isTauri) {
        try {
          await window.__TAURI__.core.invoke('open_viewer_window');
        } catch (e) {
          console.error('Failed to open native viewer window:', e);
          window.open('viewer.html', '_blank');
        }
      } else {
        window.open('viewer.html', '_blank');
      }
    });
  }

  // ==========================================================================
  // Theme Switching (Default: Light Mode)
  // ==========================================================================
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeToggleLabel = document.getElementById('themeToggleLabel');

  function applyAppTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fxtweet_theme', theme);
    if (theme === 'dark') {
      if (themeToggleLabel) themeToggleLabel.textContent = 'ライト';
      if (themeToggleBtn) {
        themeToggleBtn.querySelector('svg').innerHTML = `
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        `;
      }
    } else {
      if (themeToggleLabel) themeToggleLabel.textContent = 'ダーク';
      if (themeToggleBtn) {
        themeToggleBtn.querySelector('svg').innerHTML = `
          <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        `;
      }
    }
  }

  const initialTheme = localStorage.getItem('fxtweet_theme') || 'light';
  applyAppTheme(initialTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      applyAppTheme(current === 'light' ? 'dark' : 'light');
    });
  }

  // ==========================================================================
  // DOM Elements
  // ==========================================================================
  const screenNameInput = document.getElementById('screenNameInput');
  const inspectUserBtn = document.getElementById('inspectUserBtn');
  const outputDirInput = document.getElementById('outputDirInput');
  const exportFormatSelect = document.getElementById('exportFormatSelect');
  const startTaskBtn = document.getElementById('startTaskBtn');
  const pauseTaskBtn = document.getElementById('pauseTaskBtn');
  const stopExportBtn = document.getElementById('stopExportBtn');
  const cancelTaskBtn = document.getElementById('cancelTaskBtn');

  // Multi-Account & Concurrency
  const maxConcurrentAccountsInput = document.getElementById('maxConcurrentAccountsInput');
  const concurrentAccountsVal = document.getElementById('concurrentAccountsVal');
  const multiAccountTray = document.getElementById('multiAccountTray');
  const multiAccountActiveCount = document.getElementById('multiAccountActiveCount');
  const multiAccountList = document.getElementById('multiAccountList');

  if (maxConcurrentAccountsInput && concurrentAccountsVal) {
    maxConcurrentAccountsInput.addEventListener('input', (e) => {
      concurrentAccountsVal.textContent = e.target.value;
    });
  }

  // Profile Preview
  const profilePreviewArea = document.getElementById('profilePreviewArea');
  const previewAvatarImg = document.getElementById('previewAvatarImg');
  const previewName = document.getElementById('previewName');
  const previewScreenName = document.getElementById('previewScreenName');
  const previewProtectedBadge = document.getElementById('previewProtectedBadge');
  const previewBio = document.getElementById('previewBio');
  const previewLocation = document.getElementById('previewLocation');
  const previewUrl = document.getElementById('previewUrl');
  const previewFollowers = document.getElementById('previewFollowers');
  const previewTweetCount = document.getElementById('previewTweetCount');

  // Media Config
  const downloadImagesToggle = document.getElementById('downloadImagesToggle');
  const imageQualitySelect = document.getElementById('imageQualitySelect');
  const downloadVideosToggle = document.getElementById('downloadVideosToggle');
  const videoQualitySelect = document.getElementById('videoQualitySelect');
  const mediaConcurrencyInput = document.getElementById('mediaConcurrencyInput');

  // Filters & Range
  const filterOriginals = document.getElementById('filterOriginals');
  const filterReplies = document.getElementById('filterReplies');
  const filterReposts = document.getElementById('filterReposts');
  const filterQuotes = document.getElementById('filterQuotes');
  const dateFromInput = document.getElementById('dateFromInput');
  const dateToInput = document.getElementById('dateToInput');

  // Profile Toggles
  const profHeader = document.getElementById('profHeader');
  const profAvatar = document.getElementById('profAvatar');
  const profUserId = document.getElementById('profUserId');
  const profBio = document.getElementById('profBio');
  const profBirthday = document.getElementById('profBirthday');
  const profUrl = document.getElementById('profUrl');
  const profLocation = document.getElementById('profLocation');
  const profPinned = document.getElementById('profPinned');

  // Locked & Continuous
  const continuousModeToggle = document.getElementById('continuousModeToggle');
  const retryOnLockedToggle = document.getElementById('retryOnLockedToggle');
  const startOnLockedToggle = document.getElementById('startOnLockedToggle');

  // Status & Telemetry
  const statusCalloutCard = document.getElementById('statusCalloutCard');
  const taskStateLabel = document.getElementById('taskStateLabel');
  const taskStatusSub = document.getElementById('taskStatusSub');
  const archiveDownloadWrap = document.getElementById('archiveDownloadWrap');
  const archiveDownloadLink = document.getElementById('archiveDownloadLink');
  const archiveDownloadText = document.getElementById('archiveDownloadText');
  const openInViewerAfterExportBtn = document.getElementById('openInViewerAfterExportBtn');

  const mTweetsCount = document.getElementById('mTweetsCount');
  const mSpeedText = document.getElementById('mSpeedText');
  const mMediaCount = document.getElementById('mMediaCount');
  const mMediaBytes = document.getElementById('mMediaBytes');
  const mFoundMedia = document.getElementById('mFoundMedia');
  const mFoundMediaSub = document.getElementById('mFoundMediaSub');
  const mProfUpdates = document.getElementById('mProfUpdates');
  const mLockRetries = document.getElementById('mLockRetries');
  const mLockStatusText = document.getElementById('mLockStatusText');

  const mediaProgressBar = document.getElementById('mediaProgressBar');
  const mediaProgressPercent = document.getElementById('mediaProgressPercent');

  // Tabs & Views
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabViews = document.querySelectorAll('.tab-view');
  const tweetsFeedGrid = document.getElementById('tweetsFeedGrid');
  const terminalLogs = document.getElementById('terminalLogs');
  const historyList = document.getElementById('historyList');
  const feedCount = document.getElementById('feedCount');
  const logCount = document.getElementById('logCount');

  let tweetCounter = 0;
  let logCounter = 0;
  let isTaskRunning = false;
  let lastGeneratedArchive = null;

  // Segmented direction control
  document.querySelectorAll('.segmented-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.segmented-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    });
  });

  // Tab switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabViews.forEach(v => v.classList.add('hidden'));

      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      if (targetTab === 'feed') document.getElementById('tabContentFeed')?.classList.remove('hidden');
      if (targetTab === 'logs') document.getElementById('tabContentLogs')?.classList.remove('hidden');
      if (targetTab === 'config') document.getElementById('tabContentConfig')?.classList.remove('hidden');
      if (targetTab === 'history') {
        document.getElementById('tabContentHistory')?.classList.remove('hidden');
        loadHistory();
      }
    });
  });

  // ==========================================================================
  // Profile Inspection
  // ==========================================================================
  inspectUserBtn?.addEventListener('click', async () => {
    const rawVal = screenNameInput.value.trim();
    const handle = rawVal.split(/[,\s\n]+/)[0]?.replace(/^@/, '').trim();
    if (!handle) {
      alert('ユーザー名を入力してください');
      screenNameInput.focus();
      return;
    }

    inspectUserBtn.disabled = true;
    inspectUserBtn.textContent = '確認中...';

    try {
      let user = null;
      if (isTauri) {
        user = await window.__TAURI__.core.invoke('inspect_profile', { handle });
      } else {
        const res = await fetch(`/api/profile/${encodeURIComponent(handle)}`);
        const text = await res.text();
        if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
          throw new Error('FxTwitter API またはサーバーが HTML を返しました (鍵垢・APIレート制限の可能性があります)');
        }
        user = JSON.parse(text);
      }
      renderProfilePreview(user);
    } catch (err) {
      alert(`プロフィール取得エラー: ${err.message || err}`);
    } finally {
      inspectUserBtn.disabled = false;
      inspectUserBtn.textContent = 'プロフィール確認';
    }
  });

  function renderProfilePreview(user) {
    if (!user) return;
    profilePreviewArea.classList.remove('hidden');
    previewName.textContent = user.name || user.screen_name;
    previewScreenName.textContent = `@${user.screen_name}`;

    if (user.avatar_url) {
      previewAvatarImg.src = user.avatar_url;
      previewAvatarImg.classList.remove('hidden');
    } else {
      previewAvatarImg.classList.add('hidden');
    }

    if (user.protected) {
      previewProtectedBadge.textContent = '鍵垢 (非公開)';
      previewProtectedBadge.className = 'badge badge-locked';
    } else {
      previewProtectedBadge.textContent = '公開';
      previewProtectedBadge.className = 'badge badge-public';
    }

    previewBio.textContent = user.description || '(プロフィール文なし)';

    if (user.location) {
      previewLocation.querySelector('.meta-val').textContent = user.location;
      previewLocation.classList.remove('hidden');
    } else {
      previewLocation.classList.add('hidden');
    }

    if (user.website) {
      const displayUrl = typeof user.website === 'object' ? (user.website.display_url || user.website.url) : user.website;
      previewUrl.querySelector('.meta-val').textContent = displayUrl || '';
      previewUrl.classList.remove('hidden');
    } else {
      previewUrl.classList.add('hidden');
    }

    previewFollowers.textContent = Number(user.followers || 0).toLocaleString();
    previewTweetCount.textContent = Number(user.statuses || user.media_count || 0).toLocaleString();
  }

  // ==========================================================================
  // Gather Form Data
  // ==========================================================================
  function getFormData() {
    const directionRadio = document.querySelector('input[name="directionRadio"]:checked');
    const rawInput = screenNameInput.value.trim();
    const handles = rawInput.split(/[,\s\n]+/)
      .map(h => h.replace(/^@/, '').trim())
      .filter(Boolean);

    const maxConcurrent = maxConcurrentAccountsInput ? (parseInt(maxConcurrentAccountsInput.value, 10) || 3) : 3;
    const outputDir = outputDirInput ? (outputDirInput.value.trim() || 'output') : 'output';

    return {
      screenNames: handles,
      screenName: handles.length > 0 ? handles[0] : '',
      outputDir: outputDir,
      maxConcurrentAccounts: maxConcurrent,
      downloadImages: downloadImagesToggle?.checked ?? true,
      imageQuality: imageQualitySelect?.value || 'orig',
      downloadVideos: downloadVideosToggle?.checked ?? true,
      videoQuality: videoQualitySelect?.value || 'highest',
      mediaConcurrency: parseInt(mediaConcurrencyInput?.value, 10) || 8,
      includeOriginals: filterOriginals?.checked ?? true,
      includeReplies: filterReplies?.checked ?? true,
      includeReposts: filterReposts?.checked ?? true,
      includeQuotes: filterQuotes?.checked ?? true,
      direction: directionRadio ? directionRadio.value : 'newest',
      dateFrom: dateFromInput?.value || null,
      dateTo: dateToInput?.value || null,
      continuous: continuousModeToggle?.checked ?? false,
      retryOnLocked: retryOnLockedToggle?.checked ?? true,
      startOnLocked: startOnLockedToggle?.checked ?? true,
      exportFormat: exportFormatSelect?.value || 'xarchpjzip',
      profileToggles: {
        header_image: profHeader?.checked ?? true,
        avatar_image: profAvatar?.checked ?? true,
        user_id: profUserId?.checked ?? true,
        bio: profBio?.checked ?? true,
        birthday: profBirthday?.checked ?? true,
        url: profUrl?.checked ?? true,
        location: profLocation?.checked ?? true,
        pinned_tweet: profPinned?.checked ?? true
      }
    };
  }

  function setRunningUI(running) {
    isTaskRunning = running;
    startTaskBtn.disabled = running;
    pauseTaskBtn.disabled = !running;
    stopExportBtn.disabled = !running;
    cancelTaskBtn.disabled = !running;

    if (running) {
      statusCalloutCard.className = 'status-callout state-fetching';
      taskStateLabel.textContent = 'タイムライン取得・メディア収集処理中...';
      taskStatusSub.textContent = 'FxTwitter v2 API からポストおよび画像・動画を取得しています';
    } else {
      statusCalloutCard.className = 'status-callout state-completed';
      taskStateLabel.textContent = '待機中 (処理完了)';
      taskStatusSub.textContent = '出力アーカイブをビューアーで閲覧するか、新規タスクを実行できます';
    }
  }

  function updateTelemetry(metrics, state, extra = {}) {
    if (!metrics) return;
    if (mTweetsCount) mTweetsCount.textContent = Number(metrics.tweets_processed || metrics.totalTweets || 0).toLocaleString();
    if (mSpeedText) mSpeedText.textContent = `${(metrics.speed || metrics.speed_tweets_per_sec || 0).toFixed(1)} tw/s`;
    if (mMediaCount) mMediaCount.textContent = Number(metrics.media_downloaded || metrics.mediaDownloaded || 0).toLocaleString();
    if (mMediaBytes) mMediaBytes.textContent = formatBytes(metrics.total_bytes || metrics.bytesDownloaded || 0);

    const photos = metrics.images_found || metrics.photosCount || 0;
    const videos = metrics.videos_found || metrics.videosCount || 0;
    if (mFoundMedia) mFoundMedia.textContent = Number(photos + videos).toLocaleString();
    if (mFoundMediaSub) mFoundMediaSub.textContent = `画像 ${photos} / 動画 ${videos}`;

    if (mProfUpdates) mProfUpdates.textContent = Number(metrics.profile_updates || metrics.profileUpdatesCount || 0).toLocaleString();
    if (mLockRetries) mLockRetries.textContent = Number(metrics.lock_retries || metrics.lockRetriesCount || 0).toLocaleString();

    // Progress Bar
    const total = (photos + videos) || (metrics.totalTweets || 100);
    const done = (metrics.media_downloaded || metrics.mediaDownloaded || 0);
    let pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    if (state === 'COMPLETED' || state === 'FINALIZING') pct = 100;
    if (mediaProgressBar) mediaProgressBar.style.width = `${pct}%`;
    if (mediaProgressPercent) mediaProgressPercent.textContent = `${pct}%`;
  }

  function renderFeedTweet(tweet) {
    if (!tweetsFeedGrid || !tweet) return;
    const placeholder = tweetsFeedGrid.querySelector('.feed-placeholder');
    if (placeholder) placeholder.remove();

    const box = document.createElement('div');
    box.className = 'tweet-box';
    const author = tweet.author || {};
    const text = tweet.text || '';
    const dateStr = tweet.created_at ? new Date(tweet.created_at).toLocaleTimeString('ja-JP') : '';

    let mediaHtml = '';
    const photos = tweet.media?.photos || [];
    if (photos.length > 0) {
      mediaHtml = `<div class="tweet-thumbs-strip">${photos.slice(0, 3).map(p => `<img src="${escapeHtml(p.url)}" class="tweet-thumb-img" alt="media" loading="lazy">`).join('')}</div>`;
    }

    box.innerHTML = `
      <div class="tweet-box-top">
        <div class="tweet-author-block">
          ${author.avatar_url ? `<img src="${escapeHtml(author.avatar_url)}" class="tweet-author-avatar" alt="avatar">` : ''}
          <div>
            <span class="tweet-author-label">${escapeHtml(author.name || author.screen_name || 'User')}</span>
            <span class="tweet-author-sub mono">@${escapeHtml(author.screen_name || '')}</span>
          </div>
        </div>
        <span class="tweet-timestamp mono">${escapeHtml(dateStr)}</span>
      </div>
      <div class="tweet-body">${escapeHtml(text)}</div>
      ${mediaHtml}
      <div class="tweet-meta-footer mono">
        <span>Fav: ${Number(tweet.likes || 0).toLocaleString()}</span>
        <span>RT: ${Number(tweet.retweets || tweet.reposts || 0).toLocaleString()}</span>
        ${tweet.is_retweet ? '<span class="tag-pill">リポスト</span>' : ''}
        ${tweet.replying_to ? '<span class="tag-pill">返信</span>' : ''}
      </div>
    `;

    tweetsFeedGrid.insertBefore(box, tweetsFeedGrid.firstChild);
    tweetCounter++;
    if (feedCount) feedCount.textContent = tweetCounter.toLocaleString();
  }

  // ==========================================================================
  // Start Backup Task
  // ==========================================================================
  startTaskBtn.addEventListener('click', async () => {
    const config = getFormData();
    if (!config.screenNames || config.screenNames.length === 0) {
      alert('Twitter/X ユーザー名を入力してください');
      screenNameInput.focus();
      return;
    }

    tweetsFeedGrid.innerHTML = '';
    tweetCounter = 0;
    if (feedCount) feedCount.textContent = '0';
    archiveDownloadWrap.classList.add('hidden');

    if (isTauri) {
      // Execute via Rust Native Engine
      setRunningUI(true);
      appendTerminalLog(`Starting backup via Rust Native Engine for @${config.screenName}...`, 'INFO');
      appendTerminalLog(`Output destination: ${config.outputDir} (${config.exportFormat})`, 'INFO');

      try {
        const finalPath = await window.__TAURI__.core.invoke('start_backup', {
          config: {
            screen_name: config.screenName,
            download_images: config.downloadImages,
            image_quality: config.imageQuality,
            download_videos: config.downloadVideos,
            video_quality: config.videoQuality,
            date_from: config.dateFrom,
            date_to: config.dateTo,
            direction: config.direction,
            include_replies: config.includeReplies,
            include_reposts: config.includeReposts,
            include_quotes: config.includeQuotes,
            include_originals: config.includeOriginals,
            retry_on_locked: config.retryOnLocked,
            start_on_locked: config.startOnLocked,
            export_format: config.exportFormat,
            media_concurrency: config.mediaConcurrency,
            max_tweets: 0,
            continuous: config.continuous,
            continuous_interval: 30,
            output_dir: config.outputDir
          }
        });

        setRunningUI(false);
        lastGeneratedArchive = finalPath;

        archiveDownloadWrap.classList.remove('hidden');
        archiveDownloadText.textContent = `出力完了: ${finalPath}`;
        archiveDownloadLink.href = '#';
        archiveDownloadLink.onclick = async (e) => {
          e.preventDefault();
          try {
            await window.__TAURI__.core.invoke('open_in_viewer', { archivePath: finalPath });
          } catch (err) {
            window.open(`viewer.html?archive=${encodeURIComponent(finalPath)}`, '_blank');
          }
        };

        appendTerminalLog(`Backup completed successfully at: ${finalPath}`, 'SUCCESS');
      } catch (err) {
        setRunningUI(false);
        alert(`Rust エンジン実行エラー: ${err}`);
        appendTerminalLog(`Error: ${err}`, 'ERROR');
      }
      return;
    }

    // Node.js Web Server Execution
    try {
      setRunningUI(true);
      const res = await fetch('/api/task/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (!res.ok) {
        setRunningUI(false);
        alert(data.error || 'タスク開始エラー');
        return;
      }
      appendTerminalLog(`Task initiated: ${data.message || ''}`, 'INFO');
    } catch (err) {
      setRunningUI(false);
      alert(`通信エラー: ${err.message}`);
    }
  });

  // ==========================================================================
  // Task Control Buttons (Pause, Stop, Cancel)
  // ==========================================================================
  pauseTaskBtn?.addEventListener('click', async () => {
    if (isTauri) {
      appendTerminalLog('Pause is handled automatically in native batching.', 'INFO');
      return;
    }
    try {
      await fetch('/api/task/pause', { method: 'POST' });
      appendTerminalLog('Task paused.', 'WARN');
    } catch (err) {
      console.error(err);
    }
  });

  stopExportBtn?.addEventListener('click', async () => {
    appendTerminalLog('Stop and export requested...', 'WARN');
    if (isTauri) {
      try {
        await window.__TAURI__.core.invoke('stop_backup');
        appendTerminalLog('Stop signal sent to native engine.', 'INFO');
      } catch (e) {
        console.error(e);
      }
      return;
    }
    try {
      await fetch('/api/task/stop-export', { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  });

  cancelTaskBtn?.addEventListener('click', async () => {
    if (!confirm('本当に取得タスクを中止しますか？')) return;
    appendTerminalLog('Task cancellation requested.', 'WARN');
    if (isTauri) {
      try {
        await window.__TAURI__.core.invoke('stop_backup');
        setRunningUI(false);
        appendTerminalLog('Native task cancelled.', 'WARN');
      } catch (e) {
        console.error(e);
      }
      return;
    }
    try {
      await fetch('/api/task/cancel', { method: 'POST' });
      setRunningUI(false);
    } catch (err) {
      console.error(err);
    }
  });

  openInViewerAfterExportBtn?.addEventListener('click', async () => {
    if (isTauri) {
      try {
        if (lastGeneratedArchive) {
          await window.__TAURI__.core.invoke('open_in_viewer', { archivePath: lastGeneratedArchive });
        } else {
          await window.__TAURI__.core.invoke('open_viewer_window');
        }
      } catch (err) {
        window.open(lastGeneratedArchive ? `viewer.html?archive=${encodeURIComponent(lastGeneratedArchive)}` : 'viewer.html', '_blank');
      }
    } else {
      window.open(lastGeneratedArchive ? `viewer.html?archive=${encodeURIComponent(lastGeneratedArchive)}` : 'viewer.html', '_blank');
    }
  });

  // ==========================================================================
  // SSE Event Stream for Live Progress, Logs, and Feed in Web Mode
  // ==========================================================================
  if (!isTauri && typeof EventSource !== 'undefined') {
    const evtSource = new EventSource('/api/task/events');

    evtSource.addEventListener('state', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.metrics) updateTelemetry(data.metrics, data.state);
        if (data.state === 'FETCHING' || data.state === 'MONITORING') {
          setRunningUI(true);
        } else if (data.state === 'COMPLETED' || data.state === 'STOPPED') {
          setRunningUI(false);
        }
        if (data.archiveResult) {
          archiveDownloadWrap.classList.remove('hidden');
          archiveDownloadText.textContent = `出力完了: ${data.archiveResult.filename} (${data.archiveResult.size_formatted || ''})`;
          archiveDownloadLink.href = data.archiveResult.url || `/output/${encodeURIComponent(data.archiveResult.filename)}`;
          archiveDownloadLink.download = data.archiveResult.filename;
        }
      } catch (err) {
        console.error('SSE state parse error:', err);
      }
    });

    evtSource.addEventListener('log', (e) => {
      try {
        const data = JSON.parse(e.data);
        appendTerminalLog(data.message, data.level || 'INFO');
      } catch (err) {
        console.error('SSE log parse error:', err);
      }
    });

    evtSource.addEventListener('tweet', (e) => {
      try {
        const tweet = JSON.parse(e.data);
        renderFeedTweet(tweet);
      } catch (err) {
        console.error('SSE tweet parse error:', err);
      }
    });

    evtSource.addEventListener('archive_complete', (e) => {
      try {
        const data = JSON.parse(e.data);
        setRunningUI(false);
        archiveDownloadWrap.classList.remove('hidden');
        archiveDownloadText.textContent = `出力完了: ${data.filename}`;
        archiveDownloadLink.href = data.url;
        archiveDownloadLink.download = data.filename;
        appendTerminalLog(`Archive created: ${data.filename}`, 'SUCCESS');
      } catch (err) {
        console.error(err);
      }
    });
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================
  function appendTerminalLog(msg, level = 'INFO') {
    if (!terminalLogs) return;
    const entry = document.createElement('div');
    entry.className = `log-entry log-level-${level.toLowerCase()}`;
    const ts = new Date().toLocaleTimeString('ja-JP');
    entry.innerHTML = `<span class="log-timestamp">[${ts}]</span> [${level}] ${escapeHtml(msg)}`;
    terminalLogs.appendChild(entry);
    terminalLogs.scrollTop = terminalLogs.scrollHeight;
    logCounter++;
    if (logCount) logCount.textContent = logCounter;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0.0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  window.openArchiveInViewer = async function(archivePath) {
    if (isTauri) {
      try {
        await window.__TAURI__.core.invoke('open_in_viewer', { archivePath });
        return;
      } catch (e) {
        console.error('Failed to open archive in native viewer:', e);
      }
    }
    window.open(`viewer.html?archive=${encodeURIComponent(archivePath)}`, '_blank');
  };

  async function loadHistory() {
    if (!historyList) return;
    if (isTauri) {
      try {
        const backups = await window.__TAURI__.core.invoke('list_backups', { outputDir: outputDirInput?.value?.trim() || 'output' });
        if (!Array.isArray(backups) || backups.length === 0) {
          historyList.innerHTML = '<p class="helper-text" style="padding: 1rem;">バックアップ履歴はありません (output フォルダ内が空です)</p>';
          return;
        }
        historyList.innerHTML = backups.map(item => `
          <div class="history-card">
            <div>
              <div class="history-title">${escapeHtml(item.name)}</div>
              <div class="helper-text">${escapeHtml(item.created_at || '')} · ${escapeHtml(item.size_formatted || (item.size_mb + ' MB'))}</div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-primary btn-sm" onclick="openArchiveInViewer('${escapeHtml(item.path.replace(/\\/g, '/'))}')">ビューアーで開く</button>
            </div>
          </div>
        `).join('');
      } catch (err) {
        historyList.innerHTML = `<p class="helper-text" style="padding: 1rem;">バックアップ取得エラー: ${escapeHtml(err.message || String(err))}</p>`;
      }
      return;
    }
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.backups || []);
      if (!Array.isArray(items) || items.length === 0) {
        historyList.innerHTML = '<p class="helper-text" style="padding: 1rem;">バックアップ履歴はありません</p>';
        return;
      }
      historyList.innerHTML = items.map(item => `
        <div class="history-card">
          <div>
            <div class="history-title">${escapeHtml(item.name)}</div>
            <div class="helper-text">${escapeHtml(item.created_at || '')} · ${item.size_mb || 0} MB</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <a href="viewer.html?archive=${encodeURIComponent(item.name)}" target="_blank" class="btn btn-primary btn-sm">ビューアーで開く</a>
            <a href="/output/${encodeURIComponent(item.name)}" download class="btn btn-secondary btn-sm">ダウンロード</a>
          </div>
        </div>
      `).join('');
    } catch (e) {
      historyList.innerHTML = '<p class="helper-text" style="padding: 1rem;">履歴の取得に失敗しました</p>';
    }
  }
});