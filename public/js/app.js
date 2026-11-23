// FxTwitter Archive Studio - Frontend Application Logic

document.addEventListener('DOMContentLoaded', () => {
  // Theme Switching (Default: Light Mode)
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

  // Elements
  const screenNameInput = document.getElementById('screenNameInput');
  const inspectUserBtn = document.getElementById('inspectUserBtn');
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
  const multiAccountsState = new Map(); // screenName -> state object

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
  const concurrencyVal = document.getElementById('concurrencyVal');

  // Filters & Range
  const filterOriginals = document.getElementById('filterOriginals');
  const filterReplies = document.getElementById('filterReplies');
  const filterReposts = document.getElementById('filterReposts');
  const filterQuotes = document.getElementById('filterQuotes');
  const dateFromInput = document.getElementById('dateFromInput');
  const dateToInput = document.getElementById('dateToInput');
  const dirOptionNewest = document.getElementById('dirOptionNewest');
  const dirOptionOldest = document.getElementById('dirOptionOldest');

  // Profile Toggles
  const profHeader = document.getElementById('profHeader');
  const profAvatar = document.getElementById('profAvatar');
  const profUserId = document.getElementById('profUserId');
  const profBio = document.getElementById('profBio');
  const profBirthday = document.getElementById('profBirthday');
  const profUrl = document.getElementById('profUrl');
  const profLocation = document.getElementById('profLocation');
  const profPinned = document.getElementById('profPinned');

  // Locked & Export & Continuous
  const continuousModeToggle = document.getElementById('continuousModeToggle');
  const retryOnLockedToggle = document.getElementById('retryOnLockedToggle');
  const startOnLockedToggle = document.getElementById('startOnLockedToggle');
  const exportFormatSelect = document.getElementById('exportFormatSelect');

  // Status & Telemetry
  const statusBanner = document.getElementById('statusBanner');
  const taskStateLabel = document.getElementById('taskStateLabel');
  const taskStatusSub = document.getElementById('taskStatusSub');
  const archiveDownloadWrap = document.getElementById('archiveDownloadWrap');
  const archiveDownloadLink = document.getElementById('archiveDownloadLink');
  const archiveDownloadText = document.getElementById('archiveDownloadText');

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

  const connectionDot = document.getElementById('connection-dot');
  const connectionText = document.getElementById('connection-text');

  let tweetCounter = 0;
  let logCounter = 0;
  let isTaskRunning = false;
  let isTaskPaused = false;

  // Segmented direction control
  if (dirOptionNewest && dirOptionOldest) {
    dirOptionNewest.addEventListener('click', () => {
      dirOptionNewest.classList.add('active');
      dirOptionOldest.classList.remove('active');
      dirOptionNewest.querySelector('input').checked = true;
    });
    dirOptionOldest.addEventListener('click', () => {
      dirOptionOldest.classList.add('active');
      dirOptionNewest.classList.remove('active');
      dirOptionOldest.querySelector('input').checked = true;
    });
  }

  // Concurrency slider
  mediaConcurrencyInput.addEventListener('input', (e) => {
    concurrencyVal.textContent = e.target.value;
  });

  // Presets handling
  const presetChips = document.querySelectorAll('.preset-chip');
  presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      presetChips.forEach(p => p.classList.remove('active'));
      chip.classList.add('active');
      applyPreset(chip.getAttribute('data-preset'));
    });
  });

  function applyPreset(presetId) {
    if (presetId === 'full') {
      downloadImagesToggle.checked = true;
      imageQualitySelect.value = 'orig';
      downloadVideosToggle.checked = true;
      videoQualitySelect.value = 'highest';
      filterOriginals.checked = true;
      filterReplies.checked = true;
      filterReposts.checked = true;
      filterQuotes.checked = true;
      retryOnLockedToggle.checked = true;
      startOnLockedToggle.checked = true;
      exportFormatSelect.value = 'zip';
    } else if (presetId === 'media_only') {
      downloadImagesToggle.checked = true;
      imageQualitySelect.value = 'orig';
      downloadVideosToggle.checked = true;
      videoQualitySelect.value = '1080p';
      filterOriginals.checked = true;
      filterReplies.checked = false;
      filterReposts.checked = false;
      filterQuotes.checked = true;
      retryOnLockedToggle.checked = true;
      startOnLockedToggle.checked = true;
      exportFormatSelect.value = 'zip';
    } else if (presetId === 'speed_light') {
      downloadImagesToggle.checked = false;
      downloadVideosToggle.checked = false;
      filterOriginals.checked = true;
      filterReplies.checked = true;
      filterReposts.checked = true;
      filterQuotes.checked = true;
      retryOnLockedToggle.checked = false;
      startOnLockedToggle.checked = false;
      exportFormatSelect.value = 'zip';
    } else if (presetId === 'archive_orig') {
      downloadImagesToggle.checked = true;
      imageQualitySelect.value = 'orig';
      downloadVideosToggle.checked = true;
      videoQualitySelect.value = 'highest';
      filterOriginals.checked = true;
      filterReplies.checked = false;
      filterReposts.checked = false;
      filterQuotes.checked = true;
      retryOnLockedToggle.checked = true;
      startOnLockedToggle.checked = true;
      exportFormatSelect.value = 'tar.gz';
    }
  }

  // Tab switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabViews.forEach(v => v.classList.add('hidden'));

      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      if (targetTab === 'feed') document.getElementById('tabContentFeed').classList.remove('hidden');
      if (targetTab === 'logs') document.getElementById('tabContentLogs').classList.remove('hidden');
      if (targetTab === 'history') {
        document.getElementById('tabContentHistory').classList.remove('hidden');
        loadHistory();
      }
    });
  });

  // Profile Inspection
  inspectUserBtn.addEventListener('click', async () => {
    const handle = screenNameInput.value.replace(/^@/, '').trim();
    if (!handle) {
      alert('ユーザー名を入力してください');
      screenNameInput.focus();
      return;
    }

    inspectUserBtn.disabled = true;
    inspectUserBtn.textContent = '確認中...';

    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(handle)}`);
      const data = await res.json();

      if (!data.found) {
        alert(`ユーザー @${handle} が見つかりませんでした: ${data.message || data.error}`);
        return;
      }

      renderProfilePreview(data.user);
    } catch (err) {
      alert(`プロフィール取得エラー: ${err.message}`);
    } finally {
      inspectUserBtn.disabled = false;
      inspectUserBtn.textContent = 'プロフィール確認';
    }
  });

  function renderProfilePreview(user) {
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
      previewUrl.querySelector('.meta-val').textContent = displayUrl;
      previewUrl.classList.remove('hidden');
    } else {
      previewUrl.classList.add('hidden');
    }

    previewFollowers.textContent = Number(user.followers || 0).toLocaleString();
    previewTweetCount.textContent = Number(user.statuses || 0).toLocaleString();
  }

  // Render Multi-Account Status Chips
  function renderMultiAccountChips() {
    if (!multiAccountList || !multiAccountTray) return;
    multiAccountList.innerHTML = '';
    let activeRunning = 0;

    multiAccountsState.forEach((info, handle) => {
      const chip = document.createElement('div');
      chip.className = 'account-status-chip';
      chip.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px; background-color: var(--bg-card); border: 1px solid var(--border-subtle); font-size: 11px;';

      let stateBadge = `<span style="color: var(--text-muted);">待機</span>`;
      if (['INITIALIZING', 'FETCHING', 'DOWNLOADING_MEDIA'].includes(info.state)) {
        stateBadge = `<span style="color: var(--accent-primary); font-weight: 600;">取得中</span>`;
        activeRunning++;
      } else if (['LOCKED_WAITING', 'LOCKED_WAITING_RESUME'].includes(info.state)) {
        stateBadge = `<span style="color: var(--accent-amber); font-weight: 600;">鍵垢待機</span>`;
        activeRunning++;
      } else if (info.state === 'COMPLETED') {
        stateBadge = `<span style="color: var(--accent-emerald); font-weight: 600;">完了</span>`;
      } else if (info.state === 'STOPPED') {
        stateBadge = `<span style="color: var(--text-muted); font-weight: 600;">中断</span>`;
      } else if (info.state === 'ERROR') {
        stateBadge = `<span style="color: var(--accent-rose); font-weight: 600;">エラー</span>`;
      }

      chip.innerHTML = `
        <span class="mono" style="font-weight: 600; color: var(--text-primary);">@${escapeHtml(info.screenName || handle)}</span>
        <span class="mono" style="font-size: 10px;">${stateBadge}</span>
        <span class="mono" style="color: var(--text-secondary); font-size: 10px;">${Number(info.tweets || 0).toLocaleString()} tw</span>
      `;
      multiAccountList.appendChild(chip);
    });

    if (multiAccountActiveCount) {
      multiAccountActiveCount.textContent = multiAccountsState.size;
    }
  }

  // Gather Config Form Data
  function getFormData() {
    const directionRadio = document.querySelector('input[name="directionRadio"]:checked');
    const rawInput = screenNameInput.value.trim();
    const handles = rawInput.split(/[,\s\n]+/)
      .map(h => h.replace(/^@/, '').trim())
      .filter(Boolean);

    const maxConcurrent = maxConcurrentAccountsInput ? (parseInt(maxConcurrentAccountsInput.value, 10) || 3) : 3;

    return {
      screenNames: handles,
      screenName: handles.length > 0 ? handles[0] : '',
      maxConcurrentAccounts: maxConcurrent,
      downloadImages: downloadImagesToggle.checked,
      imageQuality: imageQualitySelect.value,
      downloadVideos: downloadVideosToggle.checked,
      videoQuality: videoQualitySelect.value,
      mediaConcurrency: parseInt(mediaConcurrencyInput.value, 10) || 8,
      includeOriginals: filterOriginals.checked,
      includeReplies: filterReplies.checked,
      includeReposts: filterReposts.checked,
      includeQuotes: filterQuotes.checked,
      direction: directionRadio ? directionRadio.value : 'newest',
      dateFrom: dateFromInput.value || null,
      dateTo: dateToInput.value || null,
      continuous: continuousModeToggle ? continuousModeToggle.checked : false,
      retryOnLocked: retryOnLockedToggle.checked,
      startOnLocked: startOnLockedToggle.checked,
      exportFormat: exportFormatSelect.value,
      profileToggles: {
        header_image: profHeader.checked,
        avatar_image: profAvatar.checked,
        user_id: profUserId.checked,
        bio: profBio.checked,
        birthday: profBirthday.checked,
        url: profUrl.checked,
        location: profLocation.checked,
        pinned_tweet: profPinned.checked
      }
    };
  }

  // Start Task
  startTaskBtn.addEventListener('click', async () => {
    const config = getFormData();
    if (!config.screenNames || config.screenNames.length === 0) {
      alert('Twitter/X ユーザー名を入力してください');
      screenNameInput.focus();
      return;
    }

    // Reset feed & logs
    tweetsFeedGrid.innerHTML = '';
    tweetCounter = 0;
    feedCount.textContent = '0';
    archiveDownloadWrap.classList.add('hidden');

    if (config.screenNames.length > 1) {
      if (multiAccountTray) multiAccountTray.classList.remove('hidden');
      multiAccountsState.clear();
      config.screenNames.forEach(h => {
        multiAccountsState.set(h.toLowerCase(), { screenName: h, state: 'QUEUED', tweets: 0, media: 0 });
      });
      renderMultiAccountChips();
    } else {
      if (multiAccountTray) multiAccountTray.classList.add('hidden');
    }

    try {
      const res = await fetch('/api/task/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'タスク開始エラー');
        return;
      }

      setRunningUI(true);
    } catch (err) {
      alert(`通信エラー: ${err.message}`);
    }
  });

  // Pause Task
  pauseTaskBtn.addEventListener('click', async () => {
    if (isTaskPaused) {
      await fetch('/api/task/resume', { method: 'POST' });
      pauseTaskBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        一時停止
      `;
      isTaskPaused = false;
    } else {
      await fetch('/api/task/pause', { method: 'POST' });
      pauseTaskBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
        再開
      `;
      isTaskPaused = true;
    }
  });

  // Stop & Export Now
  stopExportBtn.addEventListener('click', async () => {
    if (!confirm('取得を中断して、現在までに取得できたデータのみを即座に出力しますか？')) {
      return;
    }
    stopExportBtn.disabled = true;
    stopExportBtn.textContent = '書き出し中...';
    await fetch('/api/task/stop-export', { method: 'POST' });
  });

  // Cancel Task
  cancelTaskBtn.addEventListener('click', async () => {
    if (!confirm('本当に取得タスクを中止しますか？')) {
      return;
    }
    await fetch('/api/task/cancel', { method: 'POST' });
  });

  function setRunningUI(running) {
    isTaskRunning = running;
    startTaskBtn.disabled = running;
    pauseTaskBtn.disabled = !running;
    stopExportBtn.disabled = !running;
    cancelTaskBtn.disabled = !running;
  }

  // Connect SSE
  function initSSE() {
    const eventSource = new EventSource('/api/task/events');

    eventSource.onopen = () => {
      connectionDot.style.backgroundColor = 'var(--accent-emerald)';
      connectionText.textContent = 'API CONNECTED';
    };

    eventSource.onerror = () => {
      connectionDot.style.backgroundColor = 'var(--accent-amber)';
      connectionText.textContent = 'RECONNECTING...';
    };

    eventSource.addEventListener('state', (e) => {
      const stateData = JSON.parse(e.data);
      updateTelemetryState(stateData);
    });

    eventSource.addEventListener('log', (e) => {
      const log = JSON.parse(e.data);
      appendTerminalLog(log);
    });

    eventSource.addEventListener('tweet', (e) => {
      const tweet = JSON.parse(e.data);
      appendTweetCard(tweet);
    });

    eventSource.addEventListener('profile_update', (e) => {
      const update = JSON.parse(e.data);
      appendTerminalLog({
        timestamp: update.timestamp,
        level: 'SUCCESS',
        message: `[PROFILE UPDATE] プロフィール変更を検知・保存しました: ${update.updated_fields.join(', ')}`
      });
    });

    eventSource.addEventListener('archive_progress', (e) => {
      const prog = JSON.parse(e.data);
      taskStatusSub.textContent = `アーカイブ作成中... (${Math.round(prog.percentage || 0)}%)`;
    });
  }

  function updateTelemetryState(stateData) {
    const { state, metrics, profile, archiveResult, screenName } = stateData;

    if (screenName) {
      multiAccountsState.set(screenName.toLowerCase(), {
        screenName,
        state,
        tweets: metrics?.tweetsMatching || 0,
        media: metrics?.mediaDownloaded || 0
      });
      if (multiAccountsState.size > 1 || (multiAccountTray && !multiAccountTray.classList.contains('hidden'))) {
        if (multiAccountTray) multiAccountTray.classList.remove('hidden');
        renderMultiAccountChips();
      }
    }

    statusBanner.className = 'status-callout';
    if (state === 'IDLE') {
      taskStateLabel.textContent = '待機中 (IDLE)';
      taskStatusSub.textContent = '対象ユーザーを入力して「一括取得を開始」を押してください';
      setRunningUI(false);
    } else if (state === 'INITIALIZING') {
      statusBanner.classList.add('state-fetching');
      taskStateLabel.textContent = '初期化中 (INITIALIZING)';
      taskStatusSub.textContent = `@${screenName} のプロフィールおよびステータスを確認中...`;
      setRunningUI(true);
    } else if (state === 'FETCHING') {
      statusBanner.classList.add('state-fetching');
      taskStateLabel.textContent = 'タイムライン取得中 (FETCHING)';
      taskStatusSub.textContent = `FxTwitter API経由でポストとメタデータをストリーミング取得しています...`;
      setRunningUI(true);
    } else if (state === 'LOCKED_WAITING') {
      statusBanner.classList.add('state-locked');
      taskStateLabel.textContent = '鍵垢検出・公開待機中 (LOCKED WAITING)';
      taskStatusSub.textContent = `@${screenName} は現在非公開です。公開アカウントに切り替わるまで自動待機中...`;
      mLockStatusText.textContent = '鍵垢待機中';
      mLockStatusText.style.color = 'var(--accent-amber)';
      setRunningUI(true);
    } else if (state === 'LOCKED_WAITING_RESUME') {
      statusBanner.classList.add('state-locked');
      taskStateLabel.textContent = '取得途中の鍵垢化・再開待機中';
      taskStatusSub.textContent = `取得中に鍵垢化しました。公開再開まで待機中。「中断して出力」で即座に保存可能。`;
      mLockStatusText.textContent = '鍵垢復帰待機';
      mLockStatusText.style.color = 'var(--accent-amber)';
      setRunningUI(true);
    } else if (state === 'DOWNLOADING_MEDIA') {
      statusBanner.classList.add('state-fetching');
      taskStateLabel.textContent = 'メディア保存中 (DOWNLOADING MEDIA)';
      taskStatusSub.textContent = `指定画質の画像・動画を並列ダウンロードしています...`;
      setRunningUI(true);
    } else if (state === 'FINALIZING') {
      statusBanner.classList.add('state-fetching');
      taskStateLabel.textContent = 'アーカイブ圧縮中 (FINALIZING)';
      taskStatusSub.textContent = `CSV, JSON, メディアをまとめて圧縮アーカイブを出力しています...`;
      setRunningUI(true);
    } else if (state === 'COMPLETED') {
      statusBanner.classList.add('state-completed');
      taskStateLabel.textContent = 'バックアップ完了 (COMPLETED)';
      taskStatusSub.textContent = `すべてのポスト・メディア・メタデータの保存が完了しました`;
      setRunningUI(false);
      if (archiveResult) {
        showArchiveDownload(archiveResult);
      }
    } else if (state === 'STOPPED') {
      taskStateLabel.textContent = '中断完了 (STOPPED)';
      taskStatusSub.textContent = `タスクが中断されました。取得済みデータは保存されています。`;
      setRunningUI(false);
      if (archiveResult) {
        showArchiveDownload(archiveResult);
      }
    } else if (state === 'ERROR') {
      statusBanner.classList.add('state-error');
      taskStateLabel.textContent = 'エラー発生 (ERROR)';
      taskStatusSub.textContent = `エラーが発生しました。ログコンソールをご確認ください。`;
      setRunningUI(false);
    }

    if (metrics) {
      mTweetsCount.textContent = Number(metrics.tweetsMatching || 0).toLocaleString();
      mSpeedText.textContent = `${metrics.speedTweetsPerSec || 0} tw/s`;
      mMediaCount.textContent = Number(metrics.mediaDownloaded || 0).toLocaleString();
      mMediaBytes.textContent = formatBytes(metrics.totalBytesDownloaded || 0);
      mFoundMedia.textContent = Number((metrics.imagesFound || 0) + (metrics.videosFound || 0)).toLocaleString();
      mFoundMediaSub.textContent = `画像 ${metrics.imagesFound || 0} / 動画 ${metrics.videosFound || 0}`;
      mProfUpdates.textContent = Number(metrics.profileUpdatesDetected || 0).toLocaleString();
      mLockRetries.textContent = Number(metrics.lockRetries || 0).toLocaleString();

      const totalMedia = (metrics.imagesFound || 0) + (metrics.videosFound || 0);
      if (totalMedia > 0) {
        const percent = Math.min(100, Math.round(((metrics.mediaDownloaded || 0) / totalMedia) * 100));
        mediaProgressBar.style.width = `${percent}%`;
        mediaProgressPercent.textContent = `${percent}% (${metrics.mediaDownloaded || 0} / ${totalMedia})`;
      } else {
        mediaProgressBar.style.width = '0%';
        mediaProgressPercent.textContent = '0%';
      }
    }

    if (profile && profilePreviewArea.classList.contains('hidden')) {
      renderProfilePreview(profile);
    }
  }

  function showArchiveDownload(archiveResult) {
    archiveDownloadWrap.classList.remove('hidden');
    const filename = archiveResult.archivePath.split(/[\\/]/).pop();
    archiveDownloadLink.href = `/api/download/${encodeURIComponent(filename)}`;
    archiveDownloadText.textContent = `ダウンロード: ${filename} (${archiveResult.formattedSize})`;
  }

  function appendTerminalLog(log) {
    logCounter++;
    logCount.textContent = logCounter;

    const line = document.createElement('div');
    const levelClass = `log-level-${(log.level || 'info').toLowerCase()}`;
    line.className = `log-entry ${levelClass}`;

    line.innerHTML = `<span class="log-timestamp mono">[${escapeHtml(log.timestamp || '')}]</span> <span class="mono">[${escapeHtml(log.level || 'INFO')}]</span> ${escapeHtml(log.message || '')}`;
    terminalLogs.appendChild(line);
    terminalLogs.scrollTop = terminalLogs.scrollHeight;
  }

  function appendTweetCard(tweet) {
    tweetCounter++;
    feedCount.textContent = tweetCounter;

    const placeholder = tweetsFeedGrid.querySelector('.feed-placeholder');
    if (placeholder) placeholder.remove();

    const card = document.createElement('div');
    card.className = 'tweet-box';

    const author = tweet.author || {};
    const dateStr = tweet.created_at ? new Date(tweet.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

    let tagsHtml = '';
    if (tweet.replying_to) tagsHtml += `<span class="tag-pill">返信 @${escapeHtml(tweet.replying_to)}</span>`;
    if (tweet.reposted_by) tagsHtml += `<span class="tag-pill">RT @${escapeHtml(tweet.reposted_by.screen_name)}</span>`;
    if (tweet.quote) tagsHtml += `<span class="tag-pill">引用</span>`;

    let mediaHtml = '';
    const photos = tweet.media?.photos || [];
    const videos = tweet.media?.videos || [];

    if (photos.length > 0 || videos.length > 0) {
      mediaHtml += `<div class="tweet-thumbs-strip">`;
      photos.slice(0, 4).forEach(p => {
        mediaHtml += `<img src="${escapeHtml(p.url)}" alt="photo" class="tweet-thumb-img" loading="lazy">`;
      });
      videos.slice(0, 2).forEach(v => {
        const thumb = v.thumbnail_url || '';
        mediaHtml += `<img src="${escapeHtml(thumb)}" alt="video thumbnail" class="tweet-thumb-img" loading="lazy">`;
      });
      mediaHtml += `</div>`;
    }

    card.innerHTML = `
      <div class="tweet-box-top">
        <div class="tweet-author-block">
          <img src="${escapeHtml(author.avatar_url || '')}" class="tweet-author-avatar" alt="Avatar">
          <div>
            <span class="tweet-author-label">${escapeHtml(author.name || author.screen_name || '')}</span>
            <span class="tweet-author-sub mono">@${escapeHtml(author.screen_name || '')}</span>
          </div>
        </div>
        <span class="tweet-timestamp mono">${escapeHtml(dateStr)}</span>
      </div>
      <div class="tweet-body">${escapeHtml(tweet.text || '')}</div>
      ${mediaHtml}
      <div class="tweet-meta-footer">
        ${tagsHtml}
        <span class="mono" style="display:inline-flex;align-items:center;gap:3px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:12px;height:12px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
          ${Number(tweet.likes || 0).toLocaleString()}
        </span>
        <span class="mono" style="display:inline-flex;align-items:center;gap:3px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:12px;height:12px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          ${Number(tweet.reposts || tweet.retweets || 0).toLocaleString()}
        </span>
      </div>
    `;

    tweetsFeedGrid.insertBefore(card, tweetsFeedGrid.firstChild);

    if (tweetsFeedGrid.children.length > 80) {
      tweetsFeedGrid.lastChild.remove();
    }
  }

  async function loadHistory() {
    historyList.innerHTML = '<p class="helper-text p-4">読み込み中...</p>';
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      const backups = data.backups || [];

      if (backups.length === 0) {
        historyList.innerHTML = '<p class="helper-text p-4">過去のバックアップはまだありません。</p>';
        return;
      }

      historyList.innerHTML = '';
      backups.forEach(b => {
        const item = document.createElement('div');
        item.className = 'history-card';

        if (b.type === 'archive') {
          item.innerHTML = `
            <div>
              <div class="history-title">${escapeHtml(b.filename)}</div>
              <div class="history-description mono">${escapeHtml(b.formattedSize)} · ${new Date(b.createdAt).toLocaleString()}</div>
            </div>
            <a href="/api/download/${encodeURIComponent(b.filename)}" class="btn btn-secondary btn-sm" download>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              保存
            </a>
          `;
        } else {
          item.innerHTML = `
            <div>
              <div class="history-title" style="display:inline-flex;align-items:center;gap:4px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:13px;height:13px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                ${escapeHtml(b.folderName)}
              </div>
              <div class="history-description mono">${b.summary?.total_tweets_collected || 0} 件 · ${new Date(b.createdAt).toLocaleString()}</div>
            </div>
            <span class="badge badge-public">フォルダ</span>
          `;
        }
        historyList.appendChild(item);
      });
    } catch (err) {
      historyList.innerHTML = `<p class="helper-text p-4 text-danger">履歴取得エラー: ${err.message}</p>`;
    }
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  // Start SSE connection
  initSSE();
});
