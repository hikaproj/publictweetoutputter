import { sleep } from './utils.js';

const BASE_URL = 'https://api.fxtwitter.com';
const USER_AGENT = 'PublicTweetOutputter/1.0 (+https://github.com/FxEmbed/FxEmbed; ultra-fast twitter exporter)';

/**
 * Perform an HTTP request to FxTwitter with retry on transient failures.
 */
async function fetchFx(url, options = {}, retries = 3) {
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
        // Rate limited - wait and retry
        const retryAfter = parseInt(res.headers.get('retry-after') || '2', 10);
        await sleep(Math.max(1000, retryAfter * 1000));
        attempt++;
        continue;
      }

      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error(`Non-JSON response from ${url} (HTTP ${res.status}): ${text.slice(0, 100)}`);
      }

      return { status: res.status, ok: res.ok, data };
    } catch (err) {
      attempt++;
      if (attempt > retries) throw err;
      await sleep(1000 * Math.pow(2, attempt - 1));
    }
  }
}

/**
 * Fetch a user profile from FxTwitter API.
 * @param {string} screenName
 */
export async function getProfile(screenName) {
  const cleanName = screenName.replace(/^@/, '').trim();
  const url = `${BASE_URL}/2/profile/${encodeURIComponent(cleanName)}`;
  
  const res = await fetchFx(url);
  if (!res.ok) {
    if (res.status === 404) {
      return { found: false, protected: false, message: 'User not found' };
    }
    return {
      found: false,
      protected: false,
      error: res.data?.message || `HTTP ${res.status}`
    };
  }

  const user = res.data?.user;
  if (!user) {
    return { found: false, protected: false, message: 'Invalid profile response' };
  }

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

  // If status is 500 or results are empty when user might be protected
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      code: res.data?.code || res.status,
      message: res.data?.message || `HTTP ${res.status}`,
      results: [],
      cursor: null
    };
  }

  return {
    ok: true,
    code: res.data?.code || 200,
    results: res.data?.results || [],
    cursor: res.data?.cursor || null
  };
}

/**
 * Fetch a single tweet / post by ID (useful for pinned tweet enrichment or single lookup).
 * @param {string} id
 */
export async function getSingleTweet(id) {
  const url = `${BASE_URL}/2/status/${encodeURIComponent(id)}`;
  const res = await fetchFx(url);
  if (!res.ok) return null;
  return res.data?.status || res.data?.tweet || null;
}

/**
 * Extract profile object based on user-configured toggles.
 */
export function filterProfileData(user, profileToggles = {}) {
  if (!user) return {};

  const result = {};

  if (profileToggles.user_id !== false) {
    result.id = user.id;
  }
  if (profileToggles.bio !== false) {
    result.description = user.description;
  }
  if (profileToggles.location !== false) {
    result.location = user.location;
  }
  if (profileToggles.url !== false) {
    result.website = user.website;
  }
  if (profileToggles.birthday !== false) {
    result.birthday = user.birthday;
  }
  if (profileToggles.header_image !== false) {
    result.banner_url = user.banner_url;
  }
  if (profileToggles.avatar_image !== false) {
    result.avatar_url = user.avatar_url;
  }
  if (profileToggles.pinned_tweet !== false) {
    result.pinned_tweet = user.pinned_tweet;
  }

  // Always keep public identifiers
  result.screen_name = user.screen_name;
  result.name = user.name;
  result.protected = user.protected;
  result.joined = user.joined;
  result.followers = user.followers;
  result.following = user.following;
  result.statuses_count = user.statuses;

  return result;
}
