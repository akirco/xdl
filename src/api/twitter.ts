import { BROWSER_HEADERS } from "./headers.js";
import { extractSubtitleTracks, type SubtitleTrack } from "./subtitles.js";

export interface VideoVariant {
	url: string;
	contentType: "video/mp4" | "application/x-mpegURL";
	bitrate: number; // 0 for HLS
	width?: number;
	height?: number;
	quality: string; // e.g. "720p", "HLS"
}

export interface PhotoInfo {
	url: string;
	width?: number;
	height?: number;
}

export interface TweetData {
	id: string;
	text: string;
	authorName: string;
	authorUsername: string;
	createdAt: string;
	videoVariants: VideoVariant[];
	photos: PhotoInfo[];
	duration?: number; // milliseconds
	thumbnailUrl?: string;
	subtitleTracks: SubtitleTrack[];
}

/** Try syndication first, fall back to fxtwitter if it fails */
export async function fetchTweetData(tweetId: string): Promise<TweetData> {
	const errors: string[] = [];

	try {
		return await fetchViaSyndication(tweetId);
	} catch (e) {
		errors.push(`Syndication: ${(e as Error).message}`);
	}

	try {
		return await fetchViaFxTwitter(tweetId);
	} catch (e) {
		errors.push(`FxTwitter: ${(e as Error).message}`);
	}

	throw new Error(`Could not fetch tweet.\n  ${errors.join("\n  ")}`);
}

async function fetchViaSyndication(
	tweetId: string,
	retryCount = 0,
): Promise<TweetData> {
	// The token param isn't validated server-side — any number works
	const token = Math.floor(Math.random() * 999983) + 17;
	const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}&lang=en`;

	const res = await fetch(url, {
		headers: {
			...BROWSER_HEADERS,
			Origin: "https://platform.twitter.com",
			Referer: "https://platform.twitter.com/",
		},
	});

	if (res.status === 429) {
		if (retryCount >= 3) {
			throw new Error("Rate-limited by Syndication (429)");
		}
		const delay = 2 ** retryCount * 2000;
		await new Promise((resolve) => setTimeout(resolve, delay));
		return fetchViaSyndication(tweetId, retryCount + 1);
	}

	if (res.status === 404) throw new Error("Tweet not found (404)");
	if (!res.ok) throw new Error(`HTTP ${res.status}`);

	const data = (await res.json()) as {
		__typename?: string;
		mediaDetails?: Array<{
			type: string;
			media_url_https?: string;
			video_info?: {
				variants?: Array<{
					content_type?: string;
					bitrate?: number;
					url?: string;
				}>;
				duration_millis?: number;
			};
			sizes?: { large?: { w?: number; h?: number } };
		}>;
		text?: string;
		user?: { name?: string; screen_name?: string };
		created_at?: string;
	};
	if (!data || data.__typename === "TweetTombstone")
		throw new Error("Tweet deleted or restricted");

	const allMedia = data.mediaDetails ?? [];

	// Extract video
	const videoMedia = allMedia.find(
		(m) => m.type === "video" || m.type === "animated_gif",
	);
	const variants: VideoVariant[] = videoMedia
		? parseSyndicationVariants(
				videoMedia.video_info?.variants ?? [],
				videoMedia.sizes,
			)
		: [];

	// Extract photos
	const photos: PhotoInfo[] = allMedia
		.filter((m) => m.type === "photo")
		.map((m) => ({
			url: m.media_url_https as string,
			width: m.sizes?.large?.w as number | undefined,
			height: m.sizes?.large?.h as number | undefined,
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
		duration: videoMedia?.video_info?.duration_millis as number | undefined,
		thumbnailUrl: videoMedia?.media_url_https as string | undefined,
		subtitleTracks: videoMedia
			? extractSubtitleTracks(videoMedia.video_info)
			: [],
	};
}

function parseSyndicationVariants(
	raw: Array<{
		content_type?: string;
		bitrate?: number;
		url?: string;
	}>,
	sizes: { large?: { w?: number; h?: number } } | undefined,
): VideoVariant[] {
	return raw
		.filter(
			(v) => v.content_type === "video/mp4" && typeof v.bitrate === "number",
		)
		.map((v) => {
			// Resolution is usually embedded in the URL like /1280x720/
			const m = (v.url as string).match(/\/(\d+)x(\d+)\//);
			const w = m ? parseInt(m[1], 10) : sizes?.large?.w;
			const h = m ? parseInt(m[2], 10) : sizes?.large?.h;
			return {
				url: v.url as string,
				contentType: "video/mp4" as const,
				bitrate: v.bitrate as number,
				width: w,
				height: h,
				quality: h ? `${h}p` : bitrateToQuality(v.bitrate as number),
			};
		})
		.sort((a, b) => b.bitrate - a.bitrate); // highest bitrate first
}

async function fetchViaFxTwitter(
	tweetId: string,
	retryCount = 0,
): Promise<TweetData> {
	const res = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
		headers: BROWSER_HEADERS,
	});

	if (res.status === 429) {
		if (retryCount >= 3) {
			throw new Error("Rate-limited by FxTwitter (429)");
		}
		const delay = 2 ** retryCount * 2000;
		await new Promise((resolve) => setTimeout(resolve, delay));
		return fetchViaFxTwitter(tweetId, retryCount + 1);
	}

	if (!res.ok) throw new Error(`HTTP ${res.status}`);

	const { tweet } = (await res.json()) as {
		tweet?: {
			text?: string;
			author?: { name?: string; screen_name?: string };
			created_at?: string;
			media?: {
				videos?: Array<{
					url?: string;
					bitrate?: number;
					width?: number;
					height?: number;
				}>;
				photos?: Array<{
					url?: string;
					width?: number;
					height?: number;
				}>;
				duration?: number;
				thumbnail_url?: string;
				subtitles?: Record<string, string>;
			};
		};
	};
	if (!tweet) throw new Error("No tweet data in response");

	const videos: VideoVariant[] = (tweet.media?.videos ?? []).map((v) => ({
		url: v.url as string,
		contentType: "video/mp4" as const,
		bitrate: v.bitrate ?? 0,
		width: v.width,
		height: v.height,
		quality: v.height ? `${v.height}p` : "best",
	}));
	videos.sort((a, b) => (b.height ?? 0) - (a.height ?? 0));

	const photos: PhotoInfo[] = (tweet.media?.photos ?? []).map((p) => ({
		url: p.url as string,
		width: p.width as number | undefined,
		height: p.height as number | undefined,
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
		duration: tweet.media?.duration ? tweet.media.duration * 1000 : undefined,
		thumbnailUrl: tweet.media?.thumbnail_url,
		// fxtwitter exposes subtitles as { lang: url } map under media.subtitles
		subtitleTracks: Object.entries(
			tweet.media?.subtitles ?? ({} as Record<string, string>),
		)
			.filter(([, url]) => typeof url === "string")
			.map(([lang, url]) => ({
				language: lang.toLowerCase(),
				url: url as string,
			})),
	};
}

function bitrateToQuality(bitrate: number): string {
	if (bitrate >= 2_000_000) return "720p";
	if (bitrate >= 800_000) return "480p";
	return "360p";
}

/** Pick the variant closest to the requested quality string ("720p", "best", "worst") */
export function selectVariant(
	variants: VideoVariant[],
	quality: string,
): VideoVariant {
	if (!variants.length) throw new Error("No variants available");

	const q = quality.toLowerCase();
	if (q === "best" || q === "") return variants[0];
	if (q === "worst") return variants[variants.length - 1];

	const heightMatch = q.match(/^(\d+)p?$/);
	if (heightMatch) {
		const target = parseInt(heightMatch[1], 10);
		const exact = variants.find((v) => v.height === target);
		if (exact) return exact;
		// Nothing exact — pick closest height
		return variants.reduce((prev, curr) =>
			Math.abs((curr.height ?? 0) - target) <
			Math.abs((prev.height ?? 0) - target)
				? curr
				: prev,
		);
	}

	return variants[0];
}
