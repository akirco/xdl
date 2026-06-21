// URL

export { BROWSER_HEADERS } from "./api/headers.js";
export {
	fetchProfileVideoTweets,
	type ProfileFetchOptions,
	type ProfileVideoTweet,
} from "./api/profile.js";
export type { SubtitleTrack } from "./api/subtitles.js";
export {
	extractSubtitleTracks,
	fetchSubtitleContent,
} from "./api/subtitles.js";
export type { PhotoInfo, TweetData, VideoVariant } from "./api/twitter.js";
// API
export { fetchTweetData, selectVariant } from "./api/twitter.js";
export type {
	DownloadProgress,
	PostProcessOptions,
	ProgressCallback,
	SubtitleOptions,
} from "./media/download.js";

// Download
export {
	buildFilename,
	buildPhotoFilename,
	defaultOutputDir,
	downloadPhoto,
	downloadVideo,
} from "./media/download.js";
export type { GifOptions, WatermarkPosition } from "./media/ffmpeg.js";
export {
	addWatermark,
	burnSubtitles,
	concatSegments,
	convertToGif,
	ffmpegAvailable,
} from "./media/ffmpeg.js";
export type { HlsProgress } from "./media/hls.js";
export { downloadHls, isHlsUrl } from "./media/hls.js";
export { resolveWhisperConfig, transcribeToSrt } from "./media/transcribe.js";
export type { SrtSegment } from "./media/translate.js";
export {
	parseSrt,
	renderSrt,
	translateSrt,
	translateText,
} from "./media/translate.js";
export { extractTweetId, resolveShortUrl } from "./utils/url.js";
