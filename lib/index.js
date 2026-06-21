// src/api/headers.ts
var BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json, */*",
  "Accept-Language": "en-US,en;q=0.9"
};

// src/api/profile.ts
var BEARER = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
var activeBearer = process.env.XVD_BEARER_TOKEN ?? BEARER;
var authToken = process.env.XDL_AUTH_TOKEN;
var ct0 = process.env.XDL_CT0;
var GQL_BASE = "https://twitter.com/i/api/graphql";
var QID_USER = "G3KGOASz96M-Qu0nwmGXNg";
var QID_TWEETS = "V7H0Ap3_Hh2FyS75OCDO3Q";
var GQL_FEATURES = JSON.stringify({
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
  responsive_web_enhance_cards_enabled: false
});
var GQL_HEADERS = {
  ...BROWSER_HEADERS,
  Authorization: `Bearer ${activeBearer}`,
  "x-twitter-active-user": "yes",
  "x-twitter-client-language": "en",
  Referer: "https://twitter.com/",
  Origin: "https://twitter.com"
};
if (authToken && ct0) {
  GQL_HEADERS.Cookie = `auth_token=${authToken}; ct0=${ct0}`;
  GQL_HEADERS["x-csrf-token"] = ct0;
  GQL_HEADERS["x-twitter-auth-type"] = "OAuth2Session";
}
async function activateGuestToken(retryCount = 0) {
  const res = await fetch("https://api.twitter.com/1.1/guest/activate.json", {
    method: "POST",
    headers: {
      ...BROWSER_HEADERS,
      Authorization: `Bearer ${activeBearer}`,
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });
  if (res.status === 429) {
    if (retryCount >= 3) {
      throw new Error("Rate-limited by Twitter. Wait a moment and retry.");
    }
    const delay = 2 ** retryCount * 2e3;
    console.log(
      `[Rate Limit] Twitter returned 429 on guest/activate. Retrying in ${delay / 1e3}s...`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    return activateGuestToken(retryCount + 1);
  }
  if (!res.ok)
    throw new Error(`Guest-token activation failed: HTTP ${res.status}`);
  const data = await res.json();
  if (!data.guest_token)
    throw new Error(
      "Twitter did not return a guest_token \u2014 the bearer may have rotated."
    );
  return data.guest_token;
}
async function resolveUserId(username, guestToken, retryCount = 0) {
  const variables = encodeURIComponent(
    JSON.stringify({
      screen_name: username,
      withSafetyModeUserFields: true
    })
  );
  const url = `${GQL_BASE}/${QID_USER}/UserByScreenName?variables=${variables}&features=${encodeURIComponent(GQL_FEATURES)}&fieldToggles=${encodeURIComponent(JSON.stringify({ withAuxiliaryUserLabels: false }))}`;
  const headers = { ...GQL_HEADERS };
  if (guestToken) {
    headers["x-guest-token"] = guestToken;
  }
  const res = await fetch(url, { headers });
  if (res.status === 400) {
    throw new Error(
      `GraphQL query IDs may have rotated (HTTP 400).
  \u2192 Check https://github.com/zedeus/nitter or similar for updated IDs.
  \u2192 Or authenticate via XVD_BEARER_TOKEN env var.`
    );
  }
  if (res.status === 429) {
    if (retryCount >= 3) {
      throw new Error("Rate-limited by Twitter. Wait a moment and retry.");
    }
    const delay = 2 ** retryCount * 2e3;
    console.log(
      `[Rate Limit] Twitter returned 429 on UserByScreenName. Retrying in ${delay / 1e3}s...`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    return resolveUserId(username, guestToken, retryCount + 1);
  }
  if (!res.ok) throw new Error(`UserByScreenName failed: HTTP ${res.status}`);
  const data = await res.json();
  const userId = data?.data?.user?.result?.rest_id;
  if (!userId) {
    const reason = data?.data?.user?.result?.reason ?? "not found";
    throw new Error(`User @${username} not found (${reason})`);
  }
  return userId;
}
async function fetchTweetsPage(userId, guestToken, cursor, retryCount = 0) {
  const variables = encodeURIComponent(
    JSON.stringify({
      userId,
      count: 20,
      cursor,
      includePromotedContent: true,
      withQuickPromoteEligibilityTweetFields: true,
      withVoice: true,
      withV2Timeline: true
    })
  );
  const url = `${GQL_BASE}/${QID_TWEETS}/UserTweets?variables=${variables}&features=${encodeURIComponent(GQL_FEATURES)}`;
  const headers = { ...GQL_HEADERS };
  if (guestToken) {
    headers["x-guest-token"] = guestToken;
  }
  const res = await fetch(url, { headers });
  if (res.status === 400) {
    throw new Error(
      `GraphQL query ID for UserTweets may have rotated (HTTP 400).
  \u2192 Check https://github.com/zedeus/nitter for updated query IDs.`
    );
  }
  if (res.status === 429) {
    if (retryCount >= 3) {
      throw new Error("Rate-limited by Twitter. Wait a moment and retry.");
    }
    const delay = 2 ** retryCount * 2e3;
    console.log(
      `[Rate Limit] Twitter returned 429. Retrying in ${delay / 1e3}s...`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchTweetsPage(userId, guestToken, cursor, retryCount + 1);
  }
  if (!res.ok) throw new Error(`UserTweets failed: HTTP ${res.status}`);
  const data = await res.json();
  const instructions = data?.data?.user?.result?.timeline_v2?.timeline?.instructions ?? [];
  const tweets = [];
  let nextCursor;
  for (const instruction of instructions) {
    const instr = instruction;
    if (instr.type !== "TimelineAddEntries") continue;
    const entries = instr.entries;
    for (const entry of entries ?? []) {
      const id = entry.entryId ?? "";
      if (id.startsWith("tweet-")) {
        const result = entry.content?.itemContent?.tweet_results?.result;
        if (result) tweets.push(result);
      } else if (id.startsWith("cursor-bottom")) {
        nextCursor = entry.content?.value;
      }
    }
  }
  return { tweets, nextCursor };
}
function extractVideoTweet(result, fallbackUsername) {
  const tweet = result?.__typename === "TweetWithVisibilityResults" ? result.tweet : result;
  const legacy = tweet?.legacy;
  if (!legacy) return null;
  const isRetweet = !!(legacy.retweeted_status_result || legacy.retweeted_status_id_str);
  const media = legacy.extended_entities?.media ?? legacy.entities?.media ?? [];
  if (!media.length) return null;
  const videoMedia = media.find(
    (m) => m.type === "video" || m.type === "animated_gif"
  );
  const photoMedia = media.find((m) => m.type === "photo");
  if (!videoMedia && !photoMedia) return null;
  const userLegacy = tweet?.core?.user_results?.result?.legacy;
  let mediaType = "photo";
  let width;
  let height;
  if (videoMedia) {
    mediaType = videoMedia.type;
    const variants = videoMedia?.video_info?.variants ?? [];
    const best = variants.filter((v) => v.content_type === "video/mp4").sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
    const resMatch = best?.url?.match(/\/(\d+)x(\d+)\//);
    width = resMatch ? parseInt(resMatch[1], 10) : void 0;
    height = resMatch ? parseInt(resMatch[2], 10) : void 0;
  } else if (photoMedia) {
    width = photoMedia.sizes?.large?.w;
    height = photoMedia.sizes?.large?.h;
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
    isRetweet
  };
}
async function* fetchProfileVideoTweets(username, opts = {}) {
  const {
    from,
    to,
    keyword,
    maxTweets = 2e3,
    onlyVideo,
    onlyPhoto,
    onlyRetweets,
    includeRetweets
  } = opts;
  const fromMs = from ? new Date(from).getTime() : 0;
  const toMs = to ? new Date(to).getTime() : Infinity;
  const guestToken = authToken && ct0 ? void 0 : await activateGuestToken();
  const userId = await resolveUserId(username, guestToken);
  let yielded = 0;
  let cursor;
  while (yielded < maxTweets) {
    const page = await fetchTweetsPage(userId, guestToken, cursor);
    if (!page.tweets.length) {
      break;
    }
    for (const result of page.tweets) {
      const tweet = extractVideoTweet(result, username);
      if (!tweet) continue;
      if (!includeRetweets && !onlyRetweets && tweet.isRetweet) continue;
      if (onlyRetweets && !tweet.isRetweet) continue;
      if (onlyVideo && tweet.mediaType === "photo") continue;
      if (onlyPhoto && (tweet.mediaType === "video" || tweet.mediaType === "animated_gif"))
        continue;
      const tweetMs = new Date(tweet.createdAt).getTime();
      if (tweetMs < fromMs) {
        return;
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

// src/api/subtitles.ts
function extractSubtitleTracks(videoInfo) {
  const raw = videoInfo?.subtitles ?? [];
  return raw.filter(
    (s) => typeof s === "object" && s !== null && typeof s.language === "string" && typeof s.url === "string"
  ).map((s) => ({
    language: s.language.toLowerCase(),
    url: s.url
  }));
}
async function fetchSubtitleContent(url) {
  const res = await fetch(url, {
    headers: { ...BROWSER_HEADERS, Referer: "https://twitter.com/" }
  });
  if (!res.ok) throw new Error(`Subtitle fetch failed: HTTP ${res.status}`);
  return res.text();
}

// src/api/twitter.ts
async function fetchTweetData(tweetId) {
  const errors = [];
  try {
    return await fetchViaSyndication(tweetId);
  } catch (e) {
    errors.push(`Syndication: ${e.message}`);
  }
  try {
    return await fetchViaFxTwitter(tweetId);
  } catch (e) {
    errors.push(`FxTwitter: ${e.message}`);
  }
  throw new Error(`Could not fetch tweet.
  ${errors.join("\n  ")}`);
}
async function fetchViaSyndication(tweetId, retryCount = 0) {
  const token = Math.floor(Math.random() * 999983) + 17;
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}&lang=en`;
  const res = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      Origin: "https://platform.twitter.com",
      Referer: "https://platform.twitter.com/"
    }
  });
  if (res.status === 429) {
    if (retryCount >= 3) {
      throw new Error("Rate-limited by Syndication (429)");
    }
    const delay = 2 ** retryCount * 2e3;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchViaSyndication(tweetId, retryCount + 1);
  }
  if (res.status === 404) throw new Error("Tweet not found (404)");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data || data.__typename === "TweetTombstone")
    throw new Error("Tweet deleted or restricted");
  const allMedia = data.mediaDetails ?? [];
  const videoMedia = allMedia.find(
    (m) => m.type === "video" || m.type === "animated_gif"
  );
  const variants = videoMedia ? parseSyndicationVariants(
    videoMedia.video_info?.variants ?? [],
    videoMedia.sizes
  ) : [];
  const photos = allMedia.filter((m) => m.type === "photo").map((m) => ({
    url: m.media_url_https,
    width: m.sizes?.large?.w,
    height: m.sizes?.large?.h
  }));
  if (!variants.length && !photos.length) {
    throw new Error("No downloadable media in this tweet");
  }
  return {
    id: tweetId,
    text: data.text ?? "",
    authorName: data.user?.name ?? "Unknown",
    authorUsername: data.user?.screen_name ?? "unknown",
    createdAt: data.created_at ?? "",
    videoVariants: variants,
    photos,
    duration: videoMedia?.video_info?.duration_millis,
    thumbnailUrl: videoMedia?.media_url_https,
    subtitleTracks: videoMedia ? extractSubtitleTracks(videoMedia.video_info ?? {}) : []
  };
}
function parseSyndicationVariants(raw, sizes) {
  return raw.filter(
    (v) => v.content_type === "video/mp4" && typeof v.bitrate === "number"
  ).map((v) => {
    const m = v.url.match(/\/(\d+)x(\d+)\//);
    const w = m ? parseInt(m[1], 10) : sizes?.large?.w;
    const h = m ? parseInt(m[2], 10) : sizes?.large?.h;
    return {
      url: v.url,
      contentType: "video/mp4",
      bitrate: v.bitrate,
      width: w,
      height: h,
      quality: h ? `${h}p` : bitrateToQuality(v.bitrate)
    };
  }).sort((a, b) => b.bitrate - a.bitrate);
}
async function fetchViaFxTwitter(tweetId, retryCount = 0) {
  const res = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
    headers: BROWSER_HEADERS
  });
  if (res.status === 429) {
    if (retryCount >= 3) {
      throw new Error("Rate-limited by FxTwitter (429)");
    }
    const delay = 2 ** retryCount * 2e3;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchViaFxTwitter(tweetId, retryCount + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { tweet } = await res.json();
  if (!tweet) throw new Error("No tweet data in response");
  const videos = (tweet.media?.videos ?? []).map((v) => ({
    url: v.url,
    contentType: "video/mp4",
    bitrate: v.bitrate ?? 0,
    width: v.width,
    height: v.height,
    quality: v.height ? `${v.height}p` : "best"
  }));
  videos.sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
  const photos = (tweet.media?.photos ?? []).map((p) => ({
    url: p.url,
    width: p.width,
    height: p.height
  }));
  if (!videos.length && !photos.length) {
    throw new Error("No downloadable media in this tweet");
  }
  return {
    id: tweetId,
    text: tweet.text ?? "",
    authorName: tweet.author?.name ?? "Unknown",
    authorUsername: tweet.author?.screen_name ?? "unknown",
    createdAt: tweet.created_at ?? "",
    videoVariants: videos,
    photos,
    duration: tweet.media?.duration ? tweet.media.duration * 1e3 : void 0,
    thumbnailUrl: tweet.media?.thumbnail_url,
    // fxtwitter exposes subtitles as { lang: url } map under media.subtitles
    subtitleTracks: Object.entries(
      tweet.media?.subtitles ?? {}
    ).filter(([, url]) => typeof url === "string").map(([lang, url]) => ({
      language: lang.toLowerCase(),
      url
    }))
  };
}
function bitrateToQuality(bitrate) {
  if (bitrate >= 2e6) return "720p";
  if (bitrate >= 8e5) return "480p";
  return "360p";
}
function selectVariant(variants, quality) {
  if (!variants.length) throw new Error("No variants available");
  const q = quality.toLowerCase();
  if (q === "best" || q === "") return variants[0];
  if (q === "worst") return variants[variants.length - 1];
  const heightMatch = q.match(/^(\d+)p?$/);
  if (heightMatch) {
    const target = parseInt(heightMatch[1], 10);
    const exact = variants.find((v) => v.height === target);
    if (exact) return exact;
    return variants.reduce(
      (prev, curr) => Math.abs((curr.height ?? 0) - target) < Math.abs((prev.height ?? 0) - target) ? curr : prev
    );
  }
  return variants[0];
}

// src/media/download.ts
import { createWriteStream as createWriteStream2, existsSync, unlinkSync as unlinkSync2 } from "fs";
import { mkdir, unlink as unlink2, writeFile } from "fs/promises";
import os3 from "os";
import path4 from "path";

// src/media/ffmpeg.ts
import { execFile, execFileSync } from "child_process";
import path from "path";
function ffmpegAvailable() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
function run(args) {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", ["-y", "-loglevel", "error", ...args], (err) => {
      if (err) reject(new Error(`ffmpeg error: ${err.message}`));
      else resolve();
    });
  });
}
async function convertToGif(inputPath, outputDir, opts = {}) {
  const { fps = 12, width = 480 } = opts;
  const base = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(outputDir, `${base}.gif`);
  const palettePath = path.join(outputDir, `${base}_palette.png`);
  await run([
    "-i",
    inputPath,
    "-vf",
    `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen`,
    palettePath
  ]);
  await run([
    "-i",
    inputPath,
    "-i",
    palettePath,
    "-filter_complex",
    `fps=${fps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse`,
    "-loop",
    "0",
    outputPath
  ]);
  try {
    const { unlinkSync: unlinkSync3 } = await import("fs");
    unlinkSync3(palettePath);
  } catch {
  }
  return outputPath;
}
var OVERLAY_EXPR = {
  "top-left": "overlay=10:10",
  "top-right": "overlay=W-w-10:10",
  "bottom-left": "overlay=10:H-h-10",
  "bottom-right": "overlay=W-w-10:H-h-10",
  center: "overlay=(W-w)/2:(H-h)/2"
};
async function addWatermark(videoPath, watermarkPath, position = "bottom-right", size = 150, opacity = 0.7) {
  const dir = path.dirname(videoPath);
  const base = path.basename(videoPath, path.extname(videoPath));
  const outPath = path.join(dir, `${base}_wm.mp4`);
  const alpha = Math.min(1, Math.max(0, opacity));
  await run([
    "-i",
    videoPath,
    "-i",
    watermarkPath,
    "-filter_complex",
    `[1:v]scale=${size}:-1,format=rgba,colorchannelmixer=aa=${alpha}[wm];[0:v][wm]${OVERLAY_EXPR[position]}`,
    "-codec:a",
    "copy",
    outPath
  ]);
  const { renameSync, unlinkSync: unlinkSync3 } = await import("fs");
  unlinkSync3(videoPath);
  renameSync(outPath, videoPath);
  return videoPath;
}
async function concatSegments(listPath, outputPath) {
  await run([
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    outputPath
  ]);
}
function srtToAss(srt) {
  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Default,Arial,22,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,35,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
  ].join("\n");
  function toAssTime(hms, ms) {
    const [hh, mm, ss] = hms.split(":");
    const cs = String(Math.floor(Number(ms) / 10)).padStart(2, "0");
    return `${Number(hh)}:${mm}:${ss}.${cs}`;
  }
  const dialogues = srt.trim().split(/\n\n+/).flatMap((block) => {
    const lines = block.trim().split("\n");
    if (lines.length < 3) return [];
    const m = lines[1].match(
      /(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/
    );
    if (!m) return [];
    const text = lines.slice(2).join("\\N");
    return [
      `Dialogue: 0,${toAssTime(m[1], m[2])},${toAssTime(m[3], m[4])},Default,,0,0,0,,${text}`
    ];
  });
  return `${header}
${dialogues.join("\n")}`;
}
async function burnSubtitles(videoPath, srtPath) {
  const dir = path.dirname(videoPath);
  const base = path.basename(videoPath, path.extname(videoPath));
  const outPath = path.join(dir, `${base}_sub.mp4`);
  const assPath = path.join(dir, `${base}_sub_tmp.ass`);
  const { readFileSync, writeFileSync: writeFileSync2, unlinkSync: unlinkSync3 } = await import("fs");
  writeFileSync2(assPath, srtToAss(readFileSync(srtPath, "utf8")));
  const assEscaped = assPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/,/g, "\\,").replace(/'/g, "\\'").replace(/ /g, "\\ ").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
  await run([
    "-i",
    videoPath,
    "-vf",
    `subtitles=filename=${assEscaped}`,
    "-c:a",
    "copy",
    outPath
  ]);
  unlinkSync3(assPath);
  const { renameSync } = await import("fs");
  unlinkSync3(videoPath);
  renameSync(outPath, videoPath);
  return videoPath;
}

// src/media/hls.ts
import {
  createWriteStream,
  mkdirSync,
  unlinkSync,
  writeFileSync
} from "fs";
import os from "os";
import path2 from "path";
var HLS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Referer: "https://twitter.com/"
};
function resolveUrl(base, relative) {
  if (relative.startsWith("http")) return relative;
  return base.substring(0, base.lastIndexOf("/") + 1) + relative;
}
function parseMasterPlaylist(content, baseUrl) {
  const lines = content.split("\n");
  const variants = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
    const bw = line.match(/BANDWIDTH=(\d+)/);
    const nextLine = lines[i + 1]?.trim();
    if (nextLine && !nextLine.startsWith("#")) {
      variants.push({
        url: resolveUrl(baseUrl, nextLine),
        bandwidth: bw ? parseInt(bw[1], 10) : 0
      });
    }
  }
  return variants.sort((a, b) => b.bandwidth - a.bandwidth);
}
function parseMediaPlaylist(content, baseUrl) {
  return content.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("#")).map((l) => resolveUrl(baseUrl, l));
}
async function downloadHls(m3u8Url, outputPath, onProgress) {
  const res = await fetch(m3u8Url, { headers: HLS_HEADERS });
  if (!res.ok) throw new Error(`HLS fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  let segmentUrls;
  if (text.includes("#EXT-X-STREAM-INF")) {
    const variants = parseMasterPlaylist(text, m3u8Url);
    if (!variants.length) throw new Error("No HLS variants found");
    const varRes = await fetch(variants[0].url, { headers: HLS_HEADERS });
    if (!varRes.ok) throw new Error("Could not fetch HLS variant playlist");
    segmentUrls = parseMediaPlaylist(await varRes.text(), variants[0].url);
  } else {
    segmentUrls = parseMediaPlaylist(text, m3u8Url);
  }
  if (!segmentUrls.length) throw new Error("No HLS segments found");
  const tmpDir = path2.join(os.tmpdir(), `xvd_hls_${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const segPaths = [];
  const listLines = [];
  try {
    for (let i = 0; i < segmentUrls.length; i++) {
      const segPath = path2.join(tmpDir, `seg_${String(i).padStart(5, "0")}.ts`);
      segPaths.push(segPath);
      const segRes = await fetch(segmentUrls[i], { headers: HLS_HEADERS });
      if (!segRes.ok)
        throw new Error(`Segment ${i} failed: HTTP ${segRes.status}`);
      const buf = await segRes.arrayBuffer();
      await new Promise((resolve, reject) => {
        const w = createWriteStream(segPath);
        w.write(Buffer.from(buf), (err) => {
          w.end();
          err ? reject(err) : resolve();
        });
      });
      listLines.push(`file '${segPath}'`);
      onProgress?.({
        segment: i + 1,
        total: segmentUrls.length,
        percentage: Math.round((i + 1) / segmentUrls.length * 100)
      });
    }
    const listPath = path2.join(tmpDir, "segments.txt");
    writeFileSync(listPath, listLines.join("\n"));
    await concatSegments(listPath, outputPath);
  } finally {
    for (const p of segPaths) {
      try {
        unlinkSync(p);
      } catch {
      }
    }
    try {
      unlinkSync(path2.join(tmpDir, "segments.txt"));
    } catch {
    }
    try {
      (await import("fs")).rmdirSync(tmpDir);
    } catch {
    }
  }
}
function isHlsUrl(url) {
  return url.includes(".m3u8");
}

// src/media/transcribe.ts
import { execFile as execFile2 } from "child_process";
import { readFile, unlink } from "fs/promises";
import os2 from "os";
import path3 from "path";
function extractAudio(videoPath) {
  const wavPath = path3.join(os2.tmpdir(), `xvd_audio_${Date.now()}.wav`);
  return new Promise((resolve, reject) => {
    execFile2(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-i",
        videoPath,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        wavPath
      ],
      (err) => err ? reject(new Error(`Audio extraction failed: ${err.message}`)) : resolve(wavPath)
    );
  });
}
var BUILTIN_WHISPER_URL = typeof __XDL_WHISPER_URL__ !== "undefined" ? __XDL_WHISPER_URL__ : "";
var BUILTIN_WHISPER_KEY = typeof __XVD_WHISPER_KEY__ !== "undefined" ? __XVD_WHISPER_KEY__ : "";
function resolveModel(whisperUrl) {
  if (whisperUrl.includes("api.openai.com")) return "whisper-1";
  return "Systran/faster-whisper-small";
}
var MAX_WHISPER_MB = 10;
async function transcribeToSrt(videoPath, whisperUrl, language, apiKey) {
  const wavPath = await extractAudio(videoPath);
  try {
    const audioBuffer = await readFile(wavPath);
    const sizeMb = audioBuffer.byteLength / (1024 * 1024);
    if (sizeMb > MAX_WHISPER_MB) {
      throw new Error(
        `Audio is ${sizeMb.toFixed(1)} MB \u2014 transcription is limited to ${MAX_WHISPER_MB} MB (~5 min). Download without --subtitle for longer videos.`
      );
    }
    const form = new FormData();
    form.append(
      "file",
      new Blob([audioBuffer], { type: "audio/wav" }),
      "audio.wav"
    );
    form.append("model", resolveModel(whisperUrl));
    form.append("response_format", "srt");
    if (language) form.append("language", language);
    const effectiveKey = apiKey || BUILTIN_WHISPER_KEY;
    const headers = {};
    if (effectiveKey) headers.Authorization = `Bearer ${effectiveKey}`;
    const res = await fetch(
      `${whisperUrl.replace(/\/$/, "")}/v1/audio/transcriptions`,
      {
        method: "POST",
        headers,
        body: form,
        signal: AbortSignal.timeout(18e4)
        // 3 min — long videos take a while
      }
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Whisper API HTTP ${res.status}${detail ? `: ${detail}` : ""}`
      );
    }
    return await res.text();
  } finally {
    await unlink(wavPath).catch(() => {
    });
  }
}
function resolveWhisperConfig() {
  if (BUILTIN_WHISPER_URL)
    return {
      url: BUILTIN_WHISPER_URL,
      apiKey: BUILTIN_WHISPER_KEY || void 0
    };
  const envUrl = process.env.XDL_WHISPER_URL;
  if (envUrl) return { url: envUrl };
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) return { url: "https://api.openai.com", apiKey: openaiKey };
  return void 0;
}

// src/media/translate.ts
function parseSrt(content) {
  const blocks = content.trim().split(/\n\s*\n/);
  const segments = [];
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    const index = parseInt(lines[0].trim(), 10);
    const timingMatch = lines[1].trim().match(
      /^(\d{2}:\d{2}:\d{2}[,.]\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}[,.]\d{3})/
    );
    if (!timingMatch || Number.isNaN(index)) continue;
    segments.push({
      index,
      start: timingMatch[1].replace(".", ","),
      end: timingMatch[2].replace(".", ","),
      lines: lines.slice(2).map((l) => l.trim()).filter(Boolean)
    });
  }
  return segments;
}
function renderSrt(segments) {
  return `${segments.map(
    (seg) => `${seg.index}
${seg.start} --> ${seg.end}
${seg.lines.join("\n")}`
  ).join("\n\n")}
`;
}
var BUILTIN_LIBRE_URL = typeof __XDL_LIBRE_URL__ !== "undefined" ? __XDL_LIBRE_URL__ : "";
var BUILTIN_LIBRE_KEY = typeof __XDL_LIBRE_KEY__ !== "undefined" ? __XDL_LIBRE_KEY__ : "";
async function translateViaLibre(text, source, target, libreUrl, apiKey) {
  const body = {
    q: text,
    source,
    target,
    format: "text"
  };
  const effectiveKey = apiKey || BUILTIN_LIBRE_KEY;
  if (effectiveKey) body.api_key = effectiveKey;
  const res = await fetch(`${libreUrl.replace(/\/$/, "")}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8e3)
  });
  if (!res.ok) throw new Error(`LibreTranslate HTTP ${res.status}`);
  const data = await res.json();
  if (!data.translatedText) throw new Error("Empty LibreTranslate response");
  return data.translatedText;
}
async function translateViaMyMemory(text, source, target) {
  const langpair = source === "auto" ? `en|${target}` : `${source}|${target}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8e3) });
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (!translated) throw new Error("Empty MyMemory response");
  return translated;
}
async function translateText(text, target, source = "auto", libreUrl) {
  if (!text.trim()) return text;
  const effectiveLibreUrl = libreUrl || BUILTIN_LIBRE_URL;
  if (effectiveLibreUrl) {
    try {
      return await translateViaLibre(
        text,
        source === "auto" ? "en" : source,
        target,
        effectiveLibreUrl
      );
    } catch {
    }
  }
  return translateViaMyMemory(text, source, target);
}
async function translateSrt(content, targetLang, sourceLang = "auto", libreUrl, onProgress) {
  const segments = parseSrt(content);
  let done = 0;
  for (const seg of segments) {
    const translated = [];
    for (const line of seg.lines) {
      translated.push(
        await translateText(line, targetLang, sourceLang, libreUrl)
      );
      await new Promise((r) => setTimeout(r, 80));
    }
    seg.lines = translated;
    done++;
    onProgress?.(done, segments.length);
  }
  return renderSrt(segments);
}

// src/media/download.ts
async function downloadMp4(url, filePath, onProgress) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Referer: "https://twitter.com/"
    }
  });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  if (!response.body) throw new Error("Empty response body");
  const total = parseInt(response.headers.get("content-length") ?? "0", 10);
  let downloaded = 0;
  let windowStart = Date.now();
  let windowBytes = 0;
  let speed = 0;
  const writer = createWriteStream2(filePath);
  const reader = response.body.getReader();
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      await new Promise((resolve, reject) => {
        writer.write(value, (err) => err ? reject(err) : resolve());
      });
      downloaded += value.length;
      windowBytes += value.length;
      const elapsed = (Date.now() - windowStart) / 1e3;
      if (elapsed >= 0.8) {
        speed = windowBytes / elapsed;
        windowStart = Date.now();
        windowBytes = 0;
      }
      onProgress?.({
        downloaded,
        total,
        speed,
        percentage: total > 0 ? Math.min(99, Math.round(downloaded / total * 100)) : 0,
        phase: "mp4"
      });
    }
    await new Promise((resolve, reject) => {
      writer.end((err) => err ? reject(err) : resolve());
    });
    onProgress?.({
      downloaded,
      total: downloaded,
      speed,
      percentage: 100,
      phase: "mp4"
    });
  } catch (err) {
    writer.destroy();
    if (existsSync(filePath)) unlinkSync2(filePath);
    throw err;
  }
}
async function downloadVideo(url, outputDir, filename, onProgress, postProcess) {
  await mkdir(outputDir, { recursive: true });
  const filePath = path4.join(outputDir, filename);
  const hasFfmpeg = ffmpegAvailable();
  if (isHlsUrl(url)) {
    if (!hasFfmpeg) {
      throw new Error(
        "This video uses HLS format and requires ffmpeg.\n  Install: brew install ffmpeg  (macOS)\n           apt install ffmpeg  (Linux)"
      );
    }
    let hlsTotal = 0;
    await downloadHls(url, filePath, (p) => {
      if (!hlsTotal) hlsTotal = p.total;
      onProgress?.({
        downloaded: p.segment,
        total: hlsTotal,
        speed: 0,
        percentage: p.percentage,
        phase: "hls"
      });
    });
  } else {
    await downloadMp4(url, filePath, onProgress);
  }
  let finalPath = filePath;
  if (postProcess?.watermark) {
    if (!hasFfmpeg)
      throw new Error("Watermark requires ffmpeg. Install it first.");
    onProgress?.({
      downloaded: 0,
      total: 1,
      speed: 0,
      percentage: 0,
      phase: "watermark"
    });
    finalPath = await addWatermark(
      filePath,
      postProcess.watermark,
      postProcess.watermarkPos ?? "bottom-right",
      postProcess.watermarkSize ?? 150,
      postProcess.watermarkOpacity ?? 0.7
    );
    onProgress?.({
      downloaded: 1,
      total: 1,
      speed: 0,
      percentage: 100,
      phase: "watermark"
    });
  }
  if (postProcess?.gif) {
    if (!hasFfmpeg)
      throw new Error("GIF conversion requires ffmpeg. Install it first.");
    onProgress?.({
      downloaded: 0,
      total: 1,
      speed: 0,
      percentage: 0,
      phase: "gif"
    });
    finalPath = await convertToGif(filePath, outputDir, {
      fps: postProcess.gifFps,
      width: postProcess.gifWidth
    });
    onProgress?.({
      downloaded: 1,
      total: 1,
      speed: 0,
      percentage: 100,
      phase: "gif"
    });
  }
  if (postProcess?.subtitle) {
    if (!hasFfmpeg)
      throw new Error("Subtitle burning requires ffmpeg. Install it first.");
    const {
      targetLang,
      sourceLang = "auto",
      libreUrl,
      whisperUrl,
      whisperKey,
      tracks
    } = postProcess.subtitle;
    onProgress?.({
      downloaded: 0,
      total: 1,
      speed: 0,
      percentage: 0,
      phase: "subtitle"
    });
    const track = tracks.find((t) => t.language === targetLang) ?? tracks.find(
      (t) => t.language.startsWith(sourceLang === "auto" ? "en" : sourceLang)
    ) ?? tracks[0];
    let srtContent;
    let trackLang;
    if (track) {
      srtContent = await fetchSubtitleContent(track.url);
      trackLang = track.language;
    } else {
      const whisperCfg = whisperUrl ? { url: whisperUrl, apiKey: whisperKey } : resolveWhisperConfig();
      if (!whisperCfg) {
        throw new Error(
          "No subtitle tracks found for this video.\n  Set OPENAI_API_KEY to transcribe automatically via OpenAI Whisper."
        );
      }
      srtContent = await transcribeToSrt(
        finalPath,
        whisperCfg.url,
        sourceLang === "auto" ? void 0 : sourceLang,
        whisperCfg.apiKey
      );
      trackLang = sourceLang === "auto" ? "auto" : sourceLang;
    }
    if (trackLang !== targetLang) {
      srtContent = await translateSrt(
        srtContent,
        targetLang,
        trackLang,
        libreUrl,
        (done, total) => onProgress?.({
          downloaded: done,
          total,
          speed: 0,
          percentage: Math.round(done / total * 100),
          phase: "subtitle"
        })
      );
    }
    const srtPath = path4.join(os3.tmpdir(), `xvd_sub_${Date.now()}.srt`);
    await writeFile(srtPath, srtContent, "utf-8");
    try {
      await burnSubtitles(finalPath, srtPath);
    } finally {
      await unlink2(srtPath).catch(() => {
      });
    }
    onProgress?.({
      downloaded: 1,
      total: 1,
      speed: 0,
      percentage: 100,
      phase: "subtitle"
    });
  }
  return finalPath;
}
function defaultOutputDir() {
  const home = os3.homedir();
  for (const candidate of [
    path4.join(home, "Movies"),
    path4.join(home, "Videos"),
    path4.join(home, "Downloads"),
    home
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return home;
}
function buildFilename(tweetId, quality) {
  return `xvd_${tweetId}_${quality.replace(/[^a-zA-Z0-9]/g, "")}.mp4`;
}
function buildPhotoFilename(tweetId, index, photoUrl) {
  const extMatch = photoUrl.match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i);
  const ext = extMatch ? extMatch[1] : "jpg";
  return `xvd_${tweetId}_${index + 1}.${ext}`;
}
async function downloadPhoto(url, outputDir, filename, onProgress) {
  await mkdir(outputDir, { recursive: true });
  const filePath = path4.join(outputDir, filename);
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Referer: "https://twitter.com/"
    }
  });
  if (!response.ok)
    throw new Error(`Photo download failed: HTTP ${response.status}`);
  if (!response.body) throw new Error("Empty response body");
  const total = parseInt(response.headers.get("content-length") ?? "0", 10);
  let downloaded = 0;
  let windowStart = Date.now();
  let windowBytes = 0;
  let speed = 0;
  const writer = createWriteStream2(filePath);
  const reader = response.body.getReader();
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      await new Promise((resolve, reject) => {
        writer.write(value, (err) => err ? reject(err) : resolve());
      });
      downloaded += value.length;
      windowBytes += value.length;
      const elapsed = (Date.now() - windowStart) / 1e3;
      if (elapsed >= 0.8) {
        speed = windowBytes / elapsed;
        windowStart = Date.now();
        windowBytes = 0;
      }
      onProgress?.({
        downloaded,
        total,
        speed,
        percentage: total > 0 ? Math.min(99, Math.round(downloaded / total * 100)) : 0,
        phase: "mp4"
      });
    }
    await new Promise((resolve, reject) => {
      writer.end((err) => err ? reject(err) : resolve());
    });
    onProgress?.({
      downloaded,
      total: downloaded,
      speed,
      percentage: 100,
      phase: "mp4"
    });
  } catch (err) {
    writer.destroy();
    if (existsSync(filePath)) unlinkSync2(filePath);
    throw err;
  }
  return filePath;
}

// src/utils/url.ts
function extractTweetId(input) {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const patterns = [
    /(?:twitter|x)\.com\/(?:#!\/)?(?:\w+)\/status(?:es)?\/(\d+)/i,
    /mobile\.twitter\.com\/\w+\/status(?:es)?\/(\d+)/i,
    /t\.co\/\w+/i
    // shortened – caller should resolve first
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}
async function resolveShortUrl(url) {
  if (!url.includes("t.co")) return url;
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return res.url || url;
  } catch {
    return url;
  }
}
export {
  BROWSER_HEADERS,
  addWatermark,
  buildFilename,
  buildPhotoFilename,
  burnSubtitles,
  concatSegments,
  convertToGif,
  defaultOutputDir,
  downloadHls,
  downloadPhoto,
  downloadVideo,
  extractSubtitleTracks,
  extractTweetId,
  fetchProfileVideoTweets,
  fetchSubtitleContent,
  fetchTweetData,
  ffmpegAvailable,
  isHlsUrl,
  parseSrt,
  renderSrt,
  resolveShortUrl,
  resolveWhisperConfig,
  selectVariant,
  transcribeToSrt,
  translateSrt,
  translateText
};
