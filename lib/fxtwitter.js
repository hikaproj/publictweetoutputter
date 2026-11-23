import { sleep } from './utils.js';

const BASE_URL = 'https://api.fxtwitter.com';
const USER_AGENT = 'FxTwitterArchiveStudio/1.0 (+https://github.com/Hikaproj/publictweetoutputter; ultra-fast twitter exporter by Hikaproj)';

/**
 * Perform an HTTP request to FxTwitter with retry on transient failures.
 */
async function fetchFx(url, options = {}, retries = 2) {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
          ...(options.headers || {})
        }
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '2', 10);
        await sleep(Math.max(1000, retryAfter * 1000));
        attempt++;
        continue;
      }

      const text = await res.text();
      const trimmed = text.trimStart();

      if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
        // Returned HTML (e.g. Cloudflare error or 404 page)
        return {
          status: res.status,
          ok: false,
          isHtml: true,
          error: `API returned HTML (Status ${res.status}). Service may be rate limited or endpoint changed.`
        };
      }

      let data = null;
      try {
        data = JSON.parse(text);
      } catch (err) {
        return {
          status: res.status,
          ok: false,
          isHtml: false,
          error: `Invalid JSON response: ${text.slice(0, 80)}`
        };
      }

      return { status: res.status, ok: res.ok, data };
    } catch (err) {
      attempt++;
      if (attempt > retries) {
        return { status: 0, ok: false, error: err.message };
      }
      await sleep(1000 * Math.pow(2, attempt - 1));
    }
  }
}

/**
 * Fetch a user profile from FxTwitter API with robust fallback.
 * @param {string} screenName
 */
export async function getProfile(screenName) {
  const cleanName = screenName.replace(/^@/, '').trim();
  if (!cleanName) {
    return { found: false, protected: false, message: 'ユーザー名が指定されていません' };
  }

  // Try candidate endpoints: 1. v2 profile, 2. direct root user
  const endpoints = [
    `${BASE_URL}/2/profile/${encodeURIComponent(cleanName)}`,
    `${BASE_URL}/${encodeURIComponent(cleanName)}`
  ];

  let lastError = '';

  for (const url of endpoints) {
    const res = await fetchFx(url);
    if (!res.ok) {
      lastError = res.error || `HTTP ${res.status}`;
      if (res.status === 404) continue;
      continue;
    }

    const user = res.data?.user || res.data?.data?.user;
    if (user) {
      return {
        found: true,
        protected: Boolean(user.protected),
        user: {
          screen_name: user.screen_name,
          name: user.name,
          id: user.id,
          description: user.description || '',
          raw_description: user.raw_description || null,
          location: user.location || '',
          banner_url: user.banner_url || null,
          avatar_url: user.avatar_url || null,
          joined: user.joined || null,
          birthday: user.birthday || user.birthdate || null,
          website: user.website || null,
          protected: Boolean(user.protected),
          followers: user.followers || 0,
          following: user.following || 0,
          likes: user.likes || 0,
          media_count: user.media_count || 0,
          statuses: user.statuses || 0,
          verification: user.verification || null,
          pinned_tweet: user.pinned_tweet || null
        }
      };
    }
  }

  return {
    found: false,
    protected: false,
    message: `ユーザー @${cleanName} の取得に失敗しました: ${lastError || 'ユーザーが見つかりません'}`
  };
}

/**
 * Fetch a page of tweets/statuses for a user.
 * @param {string} screenName
 * @param {string|null} cursor
 */
export async function getStatuses(screenName, cursor = null) {
  const cleanName = screenName.replace(/^@/, '').trim();
  let url = `${BASE_URL}/2/profile/${encodeURIComponent(cleanName)}/statuses`;
  if (cursor) {
    url += `?cursor=${encodeURIComponent(cursor)}`;
  }

  const res = await fetchFx(url);
  if (!res.ok) {
    throw new Error(res.error || `Failed to fetch statuses (HTTP ${res.status})`);
  }

  const data = res.data;
  return {
    results: Array.isArray(data?.results) ? data.results : [],
    cursor: data?.cursor || null
  };
}

/**
 * Fetch a single tweet by ID.
 * @param {string} tweetId
 * @param {string} screenName
 */
export async function getStatus(tweetId, screenName = 'i') {
  const url = `${BASE_URL}/${encodeURIComponent(screenName)}/status/${encodeURIComponent(tweetId)}`;
  const res = await fetchFx(url);
  if (!res.ok) {
    throw new Error(res.error || `Failed to fetch tweet ${tweetId} (HTTP ${res.status})`);
  }
  return res.data?.tweet || null;
}
