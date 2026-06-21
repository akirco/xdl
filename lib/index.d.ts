declare const BROWSER_HEADERS: {
    "User-Agent": string;
    Accept: string;
    "Accept-Language": string;
};

interface ProfileVideoTweet {
    id: string;
    text: string;
    createdAt: string;
    authorUsername: string;
    authorName: string;
    mediaType: "video" | "animated_gif" | "photo";
    width?: number;
    height?: number;
    isRetweet: boolean;
}
interface ProfileFetchOptions {
    from?: string;
    to?: string;
    keyword?: string;
    maxTweets?: number;
    onlyVideo?: boolean;
    onlyPhoto?: boolean;
    onlyRetweets?: boolean;
    includeRetweets?: boolean;
}
/** Async generator that yields every video tweet from a public profile */
declare function fetchProfileVideoTweets(username: string, opts?: ProfileFetchOptions): AsyncGenerator<ProfileVideoTweet>;

interface SubtitleTrack {
    language: string;
    url: string;
}
declare function extractSubtitleTracks(videoInfo: Record<string, unknown>): SubtitleTrack[];
declare function fetchSubtitleContent(url: string): Promise<string>;

interface VideoVariant {
    url: string;
    contentType: "video/mp4" | "application/x-mpegURL";
    bitrate: number;
    width?: number;
    height?: number;
    quality: string;
}
interface PhotoInfo {
    url: string;
    width?: number;
    height?: number;
}
interface TweetData {
    id: string;
    text: string;
    authorName: string;
    authorUsername: string;
    createdAt: string;
    videoVariants: VideoVariant[];
    photos: PhotoInfo[];
    duration?: number;
    thumbnailUrl?: string;
    subtitleTracks: SubtitleTrack[];
}
/** Try syndication first, fall back to fxtwitter if it fails */
declare function fetchTweetData(tweetId: string): Promise<TweetData>;
/** Pick the variant closest to the requested quality string ("720p", "best", "worst") */
declare function selectVariant(variants: VideoVariant[], quality: string): VideoVariant;

declare function ffmpegAvailable(): boolean;
interface GifOptions {
    fps?: number;
    width?: number;
}
/** Two-pass GIF with palette gen for much better colour quality */
declare function convertToGif(inputPath: string, outputDir: string, opts?: GifOptions): Promise<string>;
type WatermarkPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
/**
 * Burn a PNG watermark into a video.
 * Replaces the original file in-place.
 *
 * @param size    Scale watermark to this pixel width (height auto). Default: 150
 * @param opacity 0.0 = invisible, 1.0 = fully opaque. Default: 0.7
 */
declare function addWatermark(videoPath: string, watermarkPath: string, position?: WatermarkPosition, size?: number, opacity?: number): Promise<string>;
/** Concatenate TS segment files into a single MP4 — used by the HLS downloader */
declare function concatSegments(listPath: string, outputPath: string): Promise<void>;
/**
 * Burn an .srt subtitle file into the video.
 * Replaces the original file in-place.
 */
declare function burnSubtitles(videoPath: string, srtPath: string): Promise<string>;

interface DownloadProgress {
    downloaded: number;
    total: number;
    speed: number;
    percentage: number;
    phase?: "mp4" | "hls" | "gif" | "watermark" | "subtitle";
}
type ProgressCallback = (p: DownloadProgress) => void;
interface SubtitleOptions {
    targetLang: string;
    sourceLang?: string;
    libreUrl?: string;
    whisperUrl?: string;
    whisperKey?: string;
    tracks: SubtitleTrack[];
}
interface PostProcessOptions {
    gif?: boolean;
    gifFps?: number;
    gifWidth?: number;
    watermark?: string;
    watermarkPos?: WatermarkPosition;
    watermarkSize?: number;
    watermarkOpacity?: number;
    subtitle?: SubtitleOptions;
    notify?: boolean;
}
declare function downloadVideo(url: string, outputDir: string, filename: string, onProgress?: ProgressCallback, postProcess?: PostProcessOptions): Promise<string>;
declare function defaultOutputDir(): string;
declare function buildFilename(tweetId: string, quality: string): string;
declare function buildPhotoFilename(tweetId: string, index: number, photoUrl: string): string;
declare function downloadPhoto(url: string, outputDir: string, filename: string, onProgress?: ProgressCallback): Promise<string>;

interface HlsProgress {
    segment: number;
    total: number;
    percentage: number;
}
declare function downloadHls(m3u8Url: string, outputPath: string, onProgress?: (p: HlsProgress) => void): Promise<void>;
declare function isHlsUrl(url: string): boolean;

declare function transcribeToSrt(videoPath: string, whisperUrl: string, language?: string, apiKey?: string): Promise<string>;
/**
 * Resolve the effective Whisper endpoint + API key using this priority:
 *   1. Explicit --whisper-url flag
 *   2. XDL_WHISPER_URL env variable (user's private server, hidden from docs)
 *   3. OPENAI_API_KEY env variable  →  OpenAI Whisper API
 *
 * Returns undefined when nothing is configured (caller decides what to do).
 */
declare function resolveWhisperConfig(): {
    url: string;
    apiKey?: string;
} | undefined;

interface SrtSegment {
    index: number;
    start: string;
    end: string;
    lines: string[];
}
declare function parseSrt(content: string): SrtSegment[];
declare function renderSrt(segments: SrtSegment[]): string;
declare function translateText(text: string, target: string, source?: string, libreUrl?: string): Promise<string>;
declare function translateSrt(content: string, targetLang: string, sourceLang?: string, libreUrl?: string, onProgress?: (done: number, total: number) => void): Promise<string>;

declare function extractTweetId(input: string): string | null;
/** Follow t.co redirects to get the real URL */
declare function resolveShortUrl(url: string): Promise<string>;

export { BROWSER_HEADERS, type DownloadProgress, type GifOptions, type HlsProgress, type PhotoInfo, type PostProcessOptions, type ProfileFetchOptions, type ProfileVideoTweet, type ProgressCallback, type SrtSegment, type SubtitleOptions, type SubtitleTrack, type TweetData, type VideoVariant, type WatermarkPosition, addWatermark, buildFilename, buildPhotoFilename, burnSubtitles, concatSegments, convertToGif, defaultOutputDir, downloadHls, downloadPhoto, downloadVideo, extractSubtitleTracks, extractTweetId, fetchProfileVideoTweets, fetchSubtitleContent, fetchTweetData, ffmpegAvailable, isHlsUrl, parseSrt, renderSrt, resolveShortUrl, resolveWhisperConfig, selectVariant, transcribeToSrt, translateSrt, translateText };
