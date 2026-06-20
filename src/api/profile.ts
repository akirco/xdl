import { BROWSER_HEADERS } from "./headers.js";

// Twitter's public bearer token — the same one embedded in their web app.
// Override with XVD_BEARER_TOKEN env var if it ever rotates.
const BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

const activeBearer = process.env["XVD_BEARER_TOKEN"] ?? BEARER;
const authToken = process.env["XVD_AUTH_TOKEN"];
const ct0 = process.env["XVD_CT0"];

// ──────────────────────────────────────────────────────────────
// Twitter switched from v1.1 REST to internal GraphQL for the
// web timeline. Query IDs are baked into their JS bundle and
// rotate every few weeks. If you hit 400s, grab fresh IDs from
// https://github.com/zedeus/nitter/issues or similar trackers.
// ──────────────────────────────────────────────────────────────
const GQL_BASE = "https://twitter.com/i/api/graphql";

// Known working query IDs (as of 2025)
const QID_USER = "G3KGOASz96M-Qu0nwmGXNg"; // UserByScreenName
const QID_TWEETS = "V7H0Ap3_Hh2FyS75OCDO3Q"; // UserTweets
const QID_MEDIA = "aQQLnkexAl5z9ec_UgbEIA"; // UserMedia

// Feature flags required by both endpoints
const GQL_FEATURES = JSON.stringify({
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  rweb_video_timestamps_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_enhance_cards_enabled: false,
});

const GQL_HEADERS: Record<string, string> = {
  ...BROWSER_HEADERS,
  Authorization: `Bearer ${activeBearer}`,
  "x-twitter-active-user": "yes",
  "x-twitter-client-language": "en",
  Referer: "https://twitter.com/",
  Origin: "https://twitter.com",
};

if (authToken && ct0) {
  GQL_HEADERS["Cookie"] = `auth_token=${authToken}; ct0=${ct0}`;
  GQL_HEADERS["x-csrf-token"] = ct0;
  GQL_HEADERS["x-twitter-auth-type"] = "OAuth2Session";
}

export interface ProfileVideoTweet {
  id: string;
  text: string;
  createdAt: string;
  authorUsername: string;
  authorName: string;
  mediaType: "video" | "animated_gif" | "photo";
  width?: number;
  height?: number;
}

export interface ProfileFetchOptions {
  from?: string;
  to?: string;
  keyword?: string;
  maxTweets?: number;
}

// ── Auth ──────────────────────────────────────────────────────

async function activateGuestToken(retryCount = 0): Promise<string> {
  const res = await fetch("https://api.twitter.com/1.1/guest/activate.json", {
    method: "POST",
    headers: {
      ...BROWSER_HEADERS,
      Authorization: `Bearer ${activeBearer}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (res.status === 429) {
    if (retryCount >= 3) {
      throw new Error("Rate-limited by Twitter. Wait a moment and retry.");
    }
    const delay = Math.pow(2, retryCount) * 2000;
    console.log(
      `[Rate Limit] Twitter returned 429 on guest/activate. Retrying in ${delay / 1000}s...`,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    return activateGuestToken(retryCount + 1);
  }

  if (!res.ok)
    throw new Error(`Guest-token activation failed: HTTP ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  if (!data.guest_token)
    throw new Error(
      "Twitter did not return a guest_token — the bearer may have rotated.",
    );
  return data.guest_token as string;
}

// ── UserByScreenName ──────────────────────────────────────────

async function resolveUserId(
  username: string,
  guestToken?: string,
  retryCount = 0,
): Promise<string> {
  const variables = encodeURIComponent(
    JSON.stringify({
      screen_name: username,
      withSafetyModeUserFields: true,
    }),
  );

  const url = `${GQL_BASE}/${QID_USER}/UserByScreenName?variables=${variables}&features=${encodeURIComponent(GQL_FEATURES)}&fieldToggles=${encodeURIComponent(JSON.stringify({ withAuxiliaryUserLabels: false }))}`;

  const headers = { ...GQL_HEADERS };
  if (guestToken) {
    headers["x-guest-token"] = guestToken;
  }

  const res = await fetch(url, { headers });

  if (res.status === 400) {
    throw new Error(
      `GraphQL query IDs may have rotated (HTTP 400).\n` +
        `  → Check https://github.com/zedeus/nitter or similar for updated IDs.\n` +
        `  → Or authenticate via XVD_BEARER_TOKEN env var.`,
    );
  }

  if (res.status === 429) {
    if (retryCount >= 3) {
      throw new Error("Rate-limited by Twitter. Wait a moment and retry.");
    }
    const delay = Math.pow(2, retryCount) * 2000;
    console.log(
      `[Rate Limit] Twitter returned 429 on UserByScreenName. Retrying in ${delay / 1000}s...`,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    return resolveUserId(username, guestToken, retryCount + 1);
  }

  if (!res.ok) throw new Error(`UserByScreenName failed: HTTP ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  const userId: string | undefined = data?.data?.user?.result?.rest_id;

  if (!userId) {
    // Could be suspended, private, or doesn't exist
    const reason = data?.data?.user?.result?.reason ?? "not found";
    throw new Error(`User @${username} not found (${reason})`);
  }
  return userId;
}

// ── UserTweets paged fetch ────────────────────────────────────

interface TweetsPage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tweets: any[];
  nextCursor?: string;
}

async function fetchTweetsPage(
  userId: string,
  guestToken?: string,
  cursor?: string,
  retryCount = 0,
): Promise<TweetsPage> {
  const variables = encodeURIComponent(
    JSON.stringify({
      userId,
      count: 20,
      cursor,
      includePromotedContent: true,
      withQuickPromoteEligibilityTweetFields: true,
      withVoice: true,
      withV2Timeline: true,
    }),
  );

  const url = `${GQL_BASE}/${QID_TWEETS}/UserTweets?variables=${variables}&features=${encodeURIComponent(GQL_FEATURES)}`;

  const headers = { ...GQL_HEADERS };
  if (guestToken) {
    headers["x-guest-token"] = guestToken;
  }

  const res = await fetch(url, { headers });

  if (res.status === 400) {
    throw new Error(
      `GraphQL query ID for UserTweets may have rotated (HTTP 400).\n` +
        `  → Check https://github.com/zedeus/nitter for updated query IDs.`,
    );
  }

  if (res.status === 429) {
    if (retryCount >= 3) {
      throw new Error("Rate-limited by Twitter. Wait a moment and retry.");
    }
    // Exponential backoff: 2s, 4s, 8s
    const delay = Math.pow(2, retryCount) * 2000;
    console.log(
      `[Rate Limit] Twitter returned 429. Retrying in ${delay / 1000}s...`,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchTweetsPage(userId, guestToken, cursor, retryCount + 1);
  }

  if (!res.ok) throw new Error(`UserTweets failed: HTTP ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  const instructions: unknown[] =
    data?.data?.user?.result?.timeline_v2?.timeline?.instructions ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tweets: any[] = [];
  let nextCursor: string | undefined;

  for (const instruction of instructions) {
    const instr = instruction as any;
    if (instr.type !== "TimelineAddEntries") continue;

    for (const entry of instr.entries ?? []) {
      const id: string = entry.entryId ?? "";

      if (id.startsWith("tweet-")) {
        const result = entry.content?.itemContent?.tweet_results?.result;
        if (result) tweets.push(result);
      } else if (id.startsWith("cursor-bottom")) {
        nextCursor = entry.content?.value as string | undefined;
      }
    }
  }

  return { tweets, nextCursor };
}

// ── Tweet parser ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractVideoTweet(
  result: any,
  fallbackUsername: string,
): ProfileVideoTweet | null {
  // Some results are wrapped in a visibility container
  const tweet =
    result?.__typename === "TweetWithVisibilityResults" ? result.tweet : result;

  const legacy = tweet?.legacy;
  if (!legacy) return null;

  // Skip retweets (they don't belong in the user's own media tab)
  if (legacy.retweeted_status_result || legacy.retweeted_status_id_str) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const media: any[] =
    legacy.extended_entities?.media ?? legacy.entities?.media ?? [];
  if (!media.length) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const videoMedia = media.find(
    (m: any) => m.type === "video" || m.type === "animated_gif",
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photoMedia = media.find((m: any) => m.type === "photo");

  if (!videoMedia && !photoMedia) return null;

  const userLegacy = tweet?.core?.user_results?.result?.legacy;
  let mediaType: "video" | "animated_gif" | "photo" = "photo";
  let width: number | undefined;
  let height: number | undefined;

  if (videoMedia) {
    mediaType = videoMedia.type as "video" | "animated_gif";
    const variants: unknown[] = videoMedia?.video_info?.variants ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const best = (variants as any[])
      .filter((v) => v.content_type === "video/mp4")
      .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
    const resMatch = best?.url?.match(/\/(\d+)x(\d+)\//);
    width = resMatch ? parseInt(resMatch[1]) : undefined;
    height = resMatch ? parseInt(resMatch[2]) : undefined;
  } else if (photoMedia) {
    width = photoMedia.sizes?.large?.w as number | undefined;
    height = photoMedia.sizes?.large?.h as number | undefined;
  }

  return {
    id: legacy.id_str,
    text: legacy.full_text ?? legacy.text ?? "",
    createdAt: legacy.created_at ?? "",
    authorUsername: userLegacy?.screen_name ?? fallbackUsername,
    authorName: userLegacy?.name ?? fallbackUsername,
    mediaType,
    width,
    height,
  };
}

// ── Main export ───────────────────────────────────────────────

/** Async generator that yields every video tweet from a public profile */
export async function* fetchProfileVideoTweets(
  username: string,
  opts: ProfileFetchOptions = {},
): AsyncGenerator<ProfileVideoTweet> {
  const { from, to, keyword, maxTweets = 2000 } = opts;
  const fromMs = from ? new Date(from).getTime() : 0;
  const toMs = to ? new Date(to).getTime() : Infinity;

  const guestToken = authToken && ct0 ? undefined : await activateGuestToken();
  const userId = await resolveUserId(username, guestToken);

  let yielded = 0;
  let cursor: string | undefined;

  while (yielded < maxTweets) {
    const page = await fetchTweetsPage(userId, guestToken, cursor);
    if (!page.tweets.length) {
      break;
    }

    for (const result of page.tweets) {
      const tweet = extractVideoTweet(result, username);
      if (!tweet) continue;

      const tweetMs = new Date(tweet.createdAt).getTime();
      if (tweetMs < fromMs) {
        return; // walked past our window, stop entirely
      }
      if (tweetMs > toMs) continue;

      const text = tweet.text.toLowerCase();
      if (keyword && !text.includes(keyword.toLowerCase())) continue;

      yield tweet;
      yielded++;
      if (yielded >= maxTweets) return;
    }

    if (!page.nextCursor) {
      break;
    }
    cursor = page.nextCursor;
  }
}
