// FxTwitter Archive Studio - Frontend Application Logic
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
  // Mode Switcher: Downloader ⇄ Integrated Viewer
  // ==========================================================================
  const appModeArchiveBtn = document.getElementById('appModeArchiveBtn');
  const appModeViewerBtn = document.getElementById('appModeViewerBtn');
  const viewArchiveSection = document.getElementById('viewArchiveSection');
  const viewViewerSection = document.getElementById('viewViewerSection');

  function switchAppMode(mode) {
    if (mode === 'viewer') {
      if (appModeArchiveBtn) appModeArchiveBtn.classList.remove('active');
      if (appModeViewerBtn) appModeViewerBtn.classList.add('active');
      if (viewArchiveSection) viewArchiveSection.classList.add('hidden');
      if (viewViewerSection) viewViewerSection.classList.remove('hidden');
    } else {
      if (appModeViewerBtn) appModeViewerBtn.classList.remove('active');
      if (appModeArchiveBtn) appModeArchiveBtn.classList.add('active');
      if (viewViewerSection) viewViewerSection.classList.add('hidden');
      if (viewArchiveSection) viewArchiveSection.classList.remove('hidden');
    }
  }

  if (appModeArchiveBtn) appModeArchiveBtn.addEventListener('click', () => switchAppMode('archive'));
  if (appModeViewerBtn) appModeViewerBtn.addEventListener('click', () => switchAppMode('viewer'));

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
  const multiAccountsState = new Map();

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
  let isTaskPaused = false;
  let lastGeneratedArchive = null;

  // Preset Buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-preset');
      if (p === 'fast_media') {
        downloadImagesToggle.checked = true;
        downloadVideosToggle.checked = true;
        filterOriginals.checked = true;
        filterReplies.checked = false;
        filterReposts.checked = false;
        filterQuotes.checked = true;
        exportFormatSelect.value = 'xarchpjzip';
      } else if (p === 'text_only') {
        downloadImagesToggle.checked = false;
        downloadVideosToggle.checked = false;
        filterOriginals.checked = true;
        filterReplies.checked = true;
        filterReposts.checked = true;
        filterQuotes.checked = true;
        exportFormatSelect.value = 'zip';
      } else if (p === 'archive_orig') {
        downloadImagesToggle.checked = true;
        imageQualitySelect.value = 'orig';
        downloadVideosToggle.checked = true;
        videoQualitySelect.value = 'highest';
        filterOriginals.checked = true;
        filterReplies.checked = true;
        filterReposts.checked = true;
        filterQuotes.checked = true;
        exportFormatSelect.value = 'xarchpjzip';
      }
    });
  });

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

  // ==========================================================================
  // Profile Inspection (Rust Native or Web Fallback)
  // ==========================================================================
  inspectUserBtn.addEventListener('click', async () => {
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
        // Rust Native IPC
        user = await window.__TAURI__.core.invoke('inspect_profile', { handle });
      } else {
        // Node.js Web Fallback with HTML Protection
        const res = await fetch(`/api/profile/${encodeURIComponent(handle)}`);
        const text = await res.text();
        if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
          throw new Error('FxTwitter API またはサーバーが HTML を返しました (鍵垢・APIレート制限の可能性があります)');
        }
        const data = JSON.parse(text);
        if (!data.found) {
          alert(`ユーザー @${handle} が見つかりませんでした: ${data.message || data.error}`);
          return;
        }
        user = data.user;
      }

      if (user) {
        renderProfilePreview(user);
      }
    } catch (err) {
      console.error('Inspect error:', err);
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

  function setRunningUI(running) {
    isTaskRunning = running;
    startTaskBtn.disabled = running;
    pauseTaskBtn.disabled = !running;
    stopExportBtn.disabled = !running;
    cancelTaskBtn.disabled = !running;

    if (running) {
      statusBanner.textContent = '取得中 (RUNNING)';
      statusBanner.className = 'badge badge-running';
      taskStateLabel.textContent = 'タイムライン取得・メディア保存中...';
      taskStatusSub.textContent = 'FxTwitter API からポストおよび画像・動画を最高速取得しています';
    } else {
      statusBanner.textContent = '完了 (DONE)';
      statusBanner.className = 'badge badge-public';
      taskStateLabel.textContent = '処理が完了しました';
      taskStatusSub.textContent = '出力アーカイブをダウンロードするか、X風ビューアーで閲覧できます';
    }
  }

  // ==========================================================================
  // Start Backup Task (Rust Native Engine or Node.js Web Server)
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
    feedCount.textContent = '0';
    archiveDownloadWrap.classList.add('hidden');

    if (isTauri) {
      // Execute via Rust Native Engine
      setRunningUI(true);
      appendTerminalLog('Starting backup via Rust Native ScrapeEngine...', 'INFO');

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
            continuous_interval: 30
          }
        });

        setRunningUI(false);
        lastGeneratedArchive = finalPath;
        archiveDownloadWrap.classList.remove('hidden');
        archiveDownloadText.textContent = `出力完了: ${finalPath}`;
        archiveDownloadLink.href = '#';
        archiveDownloadLink.onclick = (e) => {
          e.preventDefault();
          switchAppMode('viewer');
          loadArchiveNative(finalPath);
        };
        appendTerminalLog(`Backup completed successfully at: ${finalPath}`, 'SUCCESS');
      } catch (err) {
        setRunningUI(false);
        alert(`Rust エンジン実行エラー: ${err}`);
        appendTerminalLog(`Error: ${err}`, 'ERROR');
      }
      return;
    }

    // Node.js Web Execution
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

  if (openInViewerAfterExportBtn) {
    openInViewerAfterExportBtn.addEventListener('click', () => {
      switchAppMode('viewer');
      if (lastGeneratedArchive) {
        loadArchiveNative(lastGeneratedArchive);
      }
    });
  }

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

  // ==========================================================================
  // INTEGRATED X (TWITTER) VIEWER LOGIC
  // ==========================================================================
  let vTweets = [];
  let vProfile = null;
  let vFilter = 'all';
  const vMediaBlobMap = new Map();

  const viewerFilePicker = document.getElementById('viewerFilePicker');
  const viewerDropZone = document.getElementById('viewerDropZone');
  const viewerSearchInput = document.getElementById('viewerSearchInput');
  const viewerContentWrapper = document.getElementById('viewerContentWrapper');
  const viewerTweetsList = document.getElementById('viewerTweetsList');
  const viewerLoadedFilename = document.getElementById('viewerLoadedFilename');

  // File picker handler
  if (viewerFilePicker) {
    viewerFilePicker.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleIncomingArchive(file);
    });
  }

  // Drop zone handler
  if (viewerDropZone) {
    ['dragenter', 'dragover'].forEach(ev => {
      viewerDropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        viewerDropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(ev => {
      viewerDropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        viewerDropZone.classList.remove('drag-over');
      });
    });

    viewerDropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleIncomingArchive(files[0]);
      }
    });
  }

  // Search input filter
  if (viewerSearchInput) {
    viewerSearchInput.addEventListener('input', renderViewerTweets);
  }

  // Filter tabs
  document.querySelectorAll('.v-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.v-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      vFilter = tab.getAttribute('data-vfilter') || 'all';
      renderViewerTweets();
    });
  });

  async function handleIncomingArchive(file) {
    const nameLower = file.name.toLowerCase();
    if (viewerLoadedFilename) viewerLoadedFilename.textContent = `読み込み中: ${file.name}...`;

    if (nameLower.endsWith('.xarchpjzip') || nameLower.endsWith('.zip')) {
      await loadArchiveZip(file);
    } else if (nameLower.endsWith('.json')) {
      const text = await file.text();
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          vTweets = json;
        } else if (json.tweets) {
          vTweets = json.tweets;
          vProfile = json.profile || null;
        }
        renderViewerAll(file.name);
      } catch (err) {
        alert('JSON パースエラー: ' + err.message);
      }
    } else {
      alert('対応していない形式です。.xarchpjzip, .zip, または .json を指定してください。');
    }
  }

  // Rust Native Archive Loader
  async function loadArchiveNative(filePath) {
    if (!isTauri) return;
    try {
      if (viewerLoadedFilename) viewerLoadedFilename.textContent = `ネイティブ解凍中: ${filePath}...`;
      const res = await window.__TAURI__.core.invoke('open_archive_native', { filePath });
      if (res && res.success) {
        vTweets = res.tweets || [];
        vProfile = res.profile || null;
        renderViewerAll(res.filename);
      }
    } catch (err) {
      console.error('Native archive load error:', err);
      alert(`ネイティブ解凍エラー: ${err}`);
    }
  }

  // JSZip Archive Loader for Web / Fallback
  async function loadArchiveZip(file) {
    try {
      if (typeof JSZip === 'undefined') {
        throw new Error('JSZip ライブラリが読み込まれていません');
      }

      const zip = await JSZip.loadAsync(file);
      vMediaBlobMap.clear();

      let tweetsEntry = null;
      let profileEntry = null;
      const mediaTasks = [];

      zip.forEach((relPath, entry) => {
        const lower = relPath.toLowerCase();
        if (lower.endsWith('tweets.json') || lower === 'tweets.json') {
          tweetsEntry = entry;
        } else if (lower.endsWith('profile.json') || lower === 'profile.json') {
          profileEntry = entry;
        } else if (!entry.dir && (lower.startsWith('media/') || lower.startsWith('profile_media/'))) {
          mediaTasks.push(async () => {
            const blob = await entry.async('blob');
            const objUrl = URL.createObjectURL(blob);
            vMediaBlobMap.set(relPath, objUrl);
            vMediaBlobMap.set(relPath.split('/').pop(), objUrl);
          });
        }
      });

      if (!tweetsEntry) {
        throw new Error('アーカイブ内に tweets.json が見つかりませんでした');
      }

      const tweetsText = await tweetsEntry.async('text');
      vTweets = JSON.parse(tweetsText);

      if (profileEntry) {
        const profText = await profileEntry.async('text');
        vProfile = JSON.parse(profText);
      }

      await Promise.all(mediaTasks.map(t => t()));
      renderViewerAll(file.name);
    } catch (err) {
      console.error('Zip parse error:', err);
      alert(`アーカイブの展開に失敗しました: ${err.message}`);
    }
  }

  function resolveMedia(pathStr) {
    if (!pathStr) return '';
    if (vMediaBlobMap.has(pathStr)) return vMediaBlobMap.get(pathStr);
    const fname = pathStr.split('/').pop();
    if (vMediaBlobMap.has(fname)) return vMediaBlobMap.get(fname);
    return pathStr;
  }

  function renderViewerAll(filename) {
    if (viewerLoadedFilename) viewerLoadedFilename.textContent = `表示中: ${filename} (${vTweets.length.toLocaleString()} 件)`;
    if (viewerContentWrapper) viewerContentWrapper.classList.remove('hidden');

    // Profile Render
    const author = vProfile || vTweets[0]?.author || {};
    const vProfileName = document.getElementById('vProfileName');
    const vProfileHandle = document.getElementById('vProfileHandle');
    const vProfileBio = document.getElementById('vProfileBio');
    const vAvatarImg = document.getElementById('vAvatarImg');
    const vBannerImg = document.getElementById('vBannerImg');
    const vFollowersCount = document.getElementById('vFollowersCount');
    const vFollowingCount = document.getElementById('vFollowingCount');
    const vTweetCount = document.getElementById('vTweetCount');

    if (vProfileName) vProfileName.textContent = author.name || author.screen_name || 'X Archive';
    if (vProfileHandle) vProfileHandle.textContent = `@${author.screen_name || ''}`;
    if (vProfileBio) vProfileBio.textContent = author.description || '';
    if (vFollowersCount) vFollowersCount.textContent = Number(author.followers || 0).toLocaleString();
    if (vFollowingCount) vFollowingCount.textContent = Number(author.following || 0).toLocaleString();
    if (vTweetCount) vTweetCount.textContent = vTweets.length.toLocaleString();

    const avatarSrc = resolveMedia('profile_media/avatar.jpg') || author.avatar_url;
    if (vAvatarImg && avatarSrc) vAvatarImg.src = avatarSrc;

    const bannerSrc = resolveMedia('profile_media/banner.jpg') || author.banner_url;
    if (vBannerImg && bannerSrc) {
      vBannerImg.src = bannerSrc;
      document.getElementById('vBannerWrapper').style.display = 'block';
    } else {
      document.getElementById('vBannerWrapper').style.display = 'none';
    }

    renderViewerTweets();
  }

  function renderViewerTweets() {
    if (!viewerTweetsList) return;
    const query = (viewerSearchInput?.value || '').toLowerCase().trim();

    const filtered = vTweets.filter(t => {
      const hasPhotos = t.media?.photos?.length > 0;
      const hasVideos = t.media?.videos?.length > 0;

      if (vFilter === 'media' && !hasPhotos && !hasVideos) return false;
      if (vFilter === 'replies' && !t.replying_to) return false;

      if (query) {
        const textMatch = (t.text || '').toLowerCase().includes(query);
        const authorMatch = (t.author?.name || '').toLowerCase().includes(query) || (t.author?.screen_name || '').toLowerCase().includes(query);
        if (!textMatch && !authorMatch) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      viewerTweetsList.innerHTML = '<div class="p-6 text-center text-muted" style="color: var(--text-muted); font-size: 13px;">該当するポストはありません</div>';
      return;
    }

    viewerTweetsList.innerHTML = '';
    filtered.forEach(t => {
      const card = document.createElement('article');
      card.className = 'v-tweet-card';

      const author = t.author || vProfile || {};
      const avatarSrc = resolveMedia('profile_media/avatar.jpg') || author.avatar_url || '';
      const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

      // Media Grid
      let mediaHtml = '';
      const photos = t.media?.photos || [];
      const videos = t.media?.videos || [];

      if (photos.length > 0 || videos.length > 0) {
        mediaHtml += `<div class="v-t-media-grid">`;
        photos.forEach((p, idx) => {
          const localSrc = resolveMedia(`media/${t.id}_photo_${idx + 1}.jpg`) || resolveMedia(p.url);
          mediaHtml += `<img src="${localSrc}" alt="Photo" loading="lazy">`;
        });
        videos.forEach((v, idx) => {
          const localSrc = resolveMedia(`media/${t.id}_video_${idx + 1}.mp4`) || resolveMedia(v.url);
          mediaHtml += `<video controls preload="none"><source src="${localSrc}"></video>`;
        });
        mediaHtml += `</div>`;
      }

      card.innerHTML = `
        <img src="${escapeHtml(avatarSrc)}" class="v-t-avatar" alt="Avatar">
        <div class="v-t-content">
          <div class="v-t-header">
            <span class="v-t-name">${escapeHtml(author.name || author.screen_name || '')}</span>
            <span class="v-t-handle mono">@${escapeHtml(author.screen_name || '')}</span>
            <span class="v-t-date">· ${escapeHtml(dateStr)}</span>
          </div>
          <div class="v-t-body">${escapeHtml(t.text || '')}</div>
          ${mediaHtml}
          <div class="v-t-actions">
            <div class="v-t-action-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              <span>${Number(t.replies || 0).toLocaleString()}</span>
            </div>
            <div class="v-t-action-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              <span>${Number(t.retweets || t.reposts || 0).toLocaleString()}</span>
            </div>
            <div class="v-t-action-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
              <span>${Number(t.likes || 0).toLocaleString()}</span>
            </div>
            <div class="v-t-action-item btn-export-png" style="color: var(--accent-primary); font-weight: 600;" data-id="${t.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <span>画像出力 (PNG)</span>
            </div>
          </div>
        </div>
      `;

      card.querySelector('.btn-export-png')?.addEventListener('click', () => exportViewerTweetCard(t.id));
      viewerTweetsList.appendChild(card);
    });
  }

  // Export Tweet as 2x Retina PNG Card
  async function exportViewerTweetCard(tweetId) {
    const tweet = vTweets.find(x => String(x.id) === String(tweetId));
    if (!tweet) return;

    const author = tweet.author || vProfile || {};
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = 800;
    const padding = 36;
    const contentWidth = width - padding * 2;

    ctx.font = '20px Inter, sans-serif';
    const lines = [];
    const rawLines = (tweet.text || '').split('\n');
    rawLines.forEach(l => {
      let cur = '';
      for (let i = 0; i < l.length; i++) {
        if (ctx.measureText(cur + l[i]).width > contentWidth) {
          lines.push(cur);
          cur = l[i];
        } else {
          cur += l[i];
        }
      }
      lines.push(cur);
    });

    const textHeight = lines.length * 28;
    const height = padding * 2 + 60 + textHeight + 70;

    canvas.width = width * 2;
    canvas.height = height * 2;
    ctx.scale(2, 2);

    // Background
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.fillStyle = isDark ? '#111318' : '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = isDark ? '#2C3240' : '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    // Header
    ctx.fillStyle = isDark ? '#F3F4F6' : '#0F172A';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText(author.name || author.screen_name || 'User', padding, padding + 24);
    ctx.fillStyle = isDark ? '#6B7280' : '#64748B';
    ctx.font = '14px Fira Code, monospace';
    ctx.fillText(`@${author.screen_name || ''}`, padding, padding + 46);

    // Body
    ctx.fillStyle = isDark ? '#F3F4F6' : '#0F172A';
    ctx.font = '18px Inter, sans-serif';
    lines.forEach((ln, idx) => {
      ctx.fillText(ln, padding, padding + 80 + idx * 28);
    });

    // Watermark
    ctx.fillStyle = isDark ? '#4B5563' : '#94A3B8';
    ctx.font = '12px Fira Code, monospace';
    ctx.fillText('FxTwitter Archive Studio · by Hikaproj', padding, height - padding + 12);

    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tweet_${tweet.id}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
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

  // Load Past History (from /api/history when in Web mode)
  async function loadHistory() {
    if (!historyList) return;
    if (isTauri) {
      historyList.innerHTML = '<p class="helper-text p-4">デスクトップ版では output フォルダ内に保存された .xarchpjzip または ZIP を上のビューアーで直接開くことができます。</p>';
      return;
    }
    try {
      const res = await fetch('/api/history');
      const items = await res.json();
      if (!Array.isArray(items) || items.length === 0) {
        historyList.innerHTML = '<p class="helper-text p-4">バックアップ履歴はありません</p>';
        return;
      }
      historyList.innerHTML = items.map(item => `
        <div class="history-card">
          <div>
            <div class="history-title">${escapeHtml(item.name)}</div>
            <div class="history-description">${escapeHtml(item.created_at || '')} · ${item.size_mb || 0} MB</div>
          </div>
          <a href="/output/${encodeURIComponent(item.name)}" download class="btn btn-secondary btn-sm">ダウンロード</a>
        </div>
      `).join('');
    } catch (e) {
      historyList.innerHTML = '<p class="helper-text p-4">履歴の取得に失敗しました</p>';
    }
  }
});
