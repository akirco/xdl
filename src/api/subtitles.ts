import { BROWSER_HEADERS } from "./headers.js";

export interface SubtitleTrack {
	language: string;
	url: string;
}

// Pull subtitle track list out of Twitter's video_info object
export function extractSubtitleTracks(
	videoInfo: Record<string, unknown>,
): SubtitleTrack[] {
	const raw: unknown[] = (videoInfo?.subtitles as unknown[]) ?? [];
	return raw
		.filter(
			(s): s is Record<string, unknown> =>
				typeof s === "object" &&
				s !== null &&
				typeof (s as Record<string, unknown>).language === "string" &&
				typeof (s as Record<string, unknown>).url === "string",
		)
		.map((s) => ({
			language: (s.language as string).toLowerCase(),
			url: s.url as string,
		}));
}

// Download the raw .srt text from a Twitter CDN subtitle URL
export async function fetchSubtitleContent(url: string): Promise<string> {
	const res = await fetch(url, {
		headers: { ...BROWSER_HEADERS, Referer: "https://twitter.com/" },
	});
	if (!res.ok) throw new Error(`Subtitle fetch failed: HTTP ${res.status}`);
	return res.text();
}
