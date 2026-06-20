import React, { useCallback, useEffect, useReducer } from 'react';
import { Box, Text, useApp } from 'ink';
import { Spinner } from '../components/Spinner.js';
import { TweetCard } from '../components/TweetCard.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { QualitySelector } from '../components/QualitySelector.js';
import { fetchTweetData, selectVariant, type TweetData, type VideoVariant, type PhotoInfo } from '../api/twitter.js';
import { downloadVideo, downloadPhoto, defaultOutputDir, buildFilename, buildPhotoFilename, type DownloadProgress, type PostProcessOptions, type SubtitleOptions } from '../media/download.js';
import { resolveWhisperConfig } from '../media/transcribe.js';
import { addEntry, getFileSize } from '../store/history.js';
import { extractTweetId, resolveShortUrl } from '../utils/url.js';
import { notifyDownloadDone } from '../platform/notify.js';
import path from 'path';

// ─── State machine ────────────────────────────────────────────

type Phase =
  | 'resolving'   // resolving short URL
  | 'fetching'    // fetching tweet metadata
  | 'selecting'   // interactive quality picker
  | 'downloading' // active download (video or photo)
  | 'done'        // success
  | 'error';      // fatal error

interface State {
  phase: Phase;
  tweet?: TweetData;
  selectedVariant?: VideoVariant;
  progress?: DownloadProgress;
  filePath?: string;
  error?: string;
  warning?: string;
  mediaType?: 'video' | 'photo';
  photoProgress?: { current: number; total: number };
}

type Action =
  | { type: 'RESOLVING' }
  | { type: 'FETCHING' }
  | { type: 'FETCHED'; tweet: TweetData; variant: VideoVariant; askQuality: boolean }
  | { type: 'SELECT'; index: number }
  | { type: 'DOWNLOADING' }
  | { type: 'PHOTO_READY'; total: number }
  | { type: 'PHOTO_PROGRESS'; current: number; total: number; progress: DownloadProgress }
  | { type: 'PROGRESS'; progress: DownloadProgress }
  | { type: 'DONE'; filePath: string }
  | { type: 'WARN'; message: string }
  | { type: 'ERROR'; message: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'RESOLVING': return { ...state, phase: 'resolving' };
    case 'FETCHING':  return { ...state, phase: 'fetching' };
    case 'FETCHED':
      return {
        ...state,
        phase: action.askQuality ? 'selecting' : 'downloading',
        tweet: action.tweet,
        selectedVariant: action.variant,
        mediaType: 'video',
      };
    case 'SELECT':
      return {
        ...state,
        phase: 'downloading',
        selectedVariant: state.tweet!.videoVariants[action.index],
      };
    case 'DOWNLOADING': return { ...state, phase: 'downloading' };
    case 'PHOTO_READY':
      return { ...state, phase: 'downloading', mediaType: 'photo', photoProgress: { current: 0, total: action.total } };
    case 'PHOTO_PROGRESS':
      return { ...state, phase: 'downloading', progress: action.progress, photoProgress: { current: action.current, total: action.total } };
    case 'PROGRESS':    return { ...state, phase: 'downloading', progress: action.progress };
    case 'DONE':        return { ...state, phase: 'done', filePath: action.filePath };
    case 'WARN':        return { ...state, warning: action.message };
    case 'ERROR':       return { ...state, phase: 'error', error: action.message };
    default:            return state;
  }
}

// ─── Component ────────────────────────────────────────────────

interface Props {
  rawUrl: string;
  outputDir?: string;
  quality: string;
  postProcess?: PostProcessOptions;
  sendNotify?: boolean;
  subtitleLang?: string;   // target language code, e.g. "tr"
  libreUrl?: string;       // LibreTranslate server URL
  whisperUrl?: string;     // Whisper-compatible transcription API URL
  whisperKey?: string;     // Bearer token for Whisper API (e.g. OpenAI key)
}

export const DownloadCommand: React.FC<Props> = ({ rawUrl, outputDir, quality, postProcess, sendNotify = false, subtitleLang, libreUrl, whisperUrl, whisperKey }) => {
  const { exit } = useApp();
  const [state, dispatch] = useReducer(reducer, { phase: 'resolving' });

  // ── Download worker ──────────────────────────────────────────
  const runDownload = useCallback(
    async (tweet: TweetData, variant: VideoVariant) => {
      dispatch({ type: 'DOWNLOADING' });
      const outDir = outputDir ?? defaultOutputDir();
      const filename = buildFilename(tweet.id, variant.quality);

      // Only build subtitle opts when we have something to work with:
      // existing tracks OR a Whisper server (explicit flag, XVD_WHISPER_URL env, or OPENAI_API_KEY env).
      // If nothing is available the warning was already shown and we skip.
      const hasWhisper = !!whisperUrl || !!resolveWhisperConfig();
      const canSubtitle = subtitleLang && (tweet.subtitleTracks.length > 0 || hasWhisper);
      const subtitleOpts: SubtitleOptions | undefined =
        canSubtitle
          ? { targetLang: subtitleLang!, libreUrl, whisperUrl, whisperKey, tracks: tweet.subtitleTracks }
          : undefined;

      const effectivePostProcess: PostProcessOptions | undefined =
        subtitleOpts ? { ...postProcess, subtitle: subtitleOpts } : postProcess;

      const filePath = await downloadVideo(
        variant.url,
        outDir,
        filename,
        (p) => dispatch({ type: 'PROGRESS', progress: p }),
        effectivePostProcess,
      );

      addEntry({
        tweetId: tweet.id,
        tweetUrl: `https://x.com/${tweet.authorUsername}/status/${tweet.id}`,
        authorName: tweet.authorName,
        authorUsername: tweet.authorUsername,
        tweetText: tweet.text,
        filePath,
        filename: path.basename(filePath),
        fileSize: getFileSize(filePath),
        quality: variant.quality,
        width: variant.width,
        height: variant.height,
        duration: tweet.duration,
        downloadedAt: new Date().toISOString(),
      });

      if (sendNotify) notifyDownloadDone(tweet.authorUsername, path.basename(filePath));
      dispatch({ type: 'DONE', filePath });
    },
    [outputDir, postProcess, sendNotify, subtitleLang, libreUrl],
  );

  // ── Photo download handler ───────────────────────────────────
  const runPhotoDownload = useCallback(
    async (tweet: TweetData) => {
      const outDir = outputDir ?? defaultOutputDir();
      const total = tweet.photos.length;

      dispatch({ type: 'PHOTO_READY', total });

      const filePaths: string[] = [];
      for (let i = 0; i < total; i++) {
        const photo = tweet.photos[i];
        const filename = buildPhotoFilename(tweet.id, i, photo.url);

        const fp = await downloadPhoto(
          photo.url,
          outDir,
          filename,
          (p) => dispatch({ type: 'PHOTO_PROGRESS', current: i + 1, total, progress: p }),
        );
        filePaths.push(fp);

        addEntry({
          tweetId: tweet.id,
          tweetUrl: `https://x.com/${tweet.authorUsername}/status/${tweet.id}`,
          authorName: tweet.authorName,
          authorUsername: tweet.authorUsername,
          tweetText: tweet.text,
          filePath: fp,
          filename: path.basename(fp),
          fileSize: getFileSize(fp),
          quality: 'photo',
          width: photo.width,
          height: photo.height,
          downloadedAt: new Date().toISOString(),
        });
      }

      if (sendNotify) notifyDownloadDone(tweet.authorUsername, `${total} photo${total > 1 ? 's' : ''}`);
      dispatch({ type: 'DONE', filePath: filePaths.join(', ') });
    },
    [outputDir, sendNotify],
  );

  // ── Main effect ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        // 1. Resolve short URL if needed
        dispatch({ type: 'RESOLVING' });
        const resolvedUrl = await resolveShortUrl(rawUrl);

        // 2. Extract tweet ID
        const tweetId = extractTweetId(resolvedUrl);
        if (!tweetId) {
          dispatch({ type: 'ERROR', message: `Could not parse tweet ID from:\n  ${rawUrl}` });
          return;
        }

        // 3. Fetch tweet metadata
        dispatch({ type: 'FETCHING' });
        const tweet = await fetchTweetData(tweetId);

        // 4. Route to video or photo flow
        if (tweet.videoVariants.length > 0) {
          // ── Video flow ──
          // Warn if subtitle was requested but no tracks and no Whisper source available
          if (subtitleLang && !tweet.subtitleTracks.length && !whisperUrl && !resolveWhisperConfig()) {
            dispatch({ type: 'WARN', message: `⚠  No subtitle tracks found for this video — downloading without subtitles.` });
          }

          const askQuality = quality.toLowerCase() === 'ask';
          const variant = askQuality
            ? tweet.videoVariants[0]
            : selectVariant(tweet.videoVariants, quality);

          dispatch({ type: 'FETCHED', tweet, variant, askQuality });

          if (!askQuality) {
            await runDownload(tweet, variant);
          }
        } else if (tweet.photos.length > 0) {
          // ── Photo flow ──
          await runPhotoDownload(tweet);
        } else {
          dispatch({ type: 'ERROR', message: 'This tweet has no downloadable media.' });
        }
      } catch (err) {
        dispatch({ type: 'ERROR', message: (err as Error).message });
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Quality selection callback ───────────────────────────────
  const handleQualitySelect = useCallback(
    async (index: number) => {
      if (!state.tweet) return;
      const variant = state.tweet.videoVariants[index];
      dispatch({ type: 'SELECT', index });
      try {
        await runDownload(state.tweet, variant);
      } catch (err) {
        dispatch({ type: 'ERROR', message: (err as Error).message });
      }
    },
    [state.tweet, runDownload],
  );

  // ── Auto-exit after done/error ───────────────────────────────
  useEffect(() => {
    if (state.phase === 'done') {
      setTimeout(() => exit(), 600);
    }
    if (state.phase === 'error') {
      setTimeout(() => exit(new Error(state.error)), 400);
    }
  }, [state.phase, exit, state.error]);

  // ─── Render ──────────────────────────────────────────────────

  return (
    <Box flexDirection="column" paddingLeft={2}>
      {/* Status line */}
      {state.phase === 'resolving' && (
        <Spinner label="Resolving URL…" />
      )}
      {state.phase === 'fetching' && (
        <Spinner label="Fetching tweet…" />
      )}

      {/* Tweet info */}
      {state.tweet && state.selectedVariant && (
        <TweetCard tweet={state.tweet} selectedVariant={state.selectedVariant} />
      )}
      {state.tweet && state.mediaType === 'photo' && (
        <Box
          borderStyle="round"
          borderColor="cyan"
          flexDirection="column"
          paddingX={2}
          paddingY={1}
          width={56}
          marginBottom={1}
        >
          <Box gap={2} marginBottom={1}>
            <Text color="yellow">◉ </Text>
            <Text bold color="white">
              {state.photoProgress?.total ?? state.tweet.photos.length} photo{state.tweet.photos.length > 1 ? 's' : ''}
            </Text>
          </Box>
          <Box>
            <Text color="#555555">  @</Text>
            <Text bold color="white">{state.tweet.authorUsername}</Text>
            {state.tweet.authorName !== state.tweet.authorUsername && (
              <Text color="#666666">{'  '}{state.tweet.authorName}</Text>
            )}
          </Box>
          {state.tweet.text && (
            <Box>
              <Text color="#555555">  </Text>
              <Text color="#888888" italic>"{(state.tweet.text.replace(/\n/g, ' ')).slice(0, 64)}"</Text>
            </Box>
          )}
        </Box>
      )}

      {/* Quality picker */}
      {state.phase === 'selecting' && state.tweet && (
        <QualitySelector
          variants={state.tweet.videoVariants}
          onSelect={handleQualitySelect}
        />
      )}

      {/* Download / post-processing progress */}
      {state.phase === 'downloading' && state.mediaType === 'photo' && state.photoProgress && (() => {
        const { current, total } = state.photoProgress;
        return (
          <Box flexDirection="column">
            <Spinner label={`Downloading photo ${current}/${total}…`} />
            {state.progress && (
              <Box marginTop={1}>
                <ProgressBar progress={state.progress} />
              </Box>
            )}
          </Box>
        );
      })()}
      {state.phase === 'downloading' && state.mediaType !== 'photo' && state.progress && (() => {
        const ph = state.progress.phase;
        const label =
          ph === 'hls'       ? 'Downloading HLS segments…' :
          ph === 'gif'       ? 'Converting to GIF…' :
          ph === 'watermark' ? 'Applying watermark…' :
          ph === 'subtitle'  ? 'Translating & burning subtitles…' :
                               'Downloading…';
        return (
          <Box flexDirection="column">
            <Spinner label={label} />
            <Box marginTop={1}>
              <ProgressBar progress={state.progress} />
            </Box>
          </Box>
        );
      })()}
      {state.phase === 'downloading' && !state.progress && state.mediaType !== 'photo' && (
        <Spinner label="Starting download…" />
      )}

      {/* Subtitle warning */}
      {state.warning && (
        <Text color="yellow">{state.warning}</Text>
      )}

      {/* Success */}
      {state.phase === 'done' && (
        <Box flexDirection="column" gap={1}>
          <Text color="green" bold>
            ✓  Download complete
          </Text>
          <Text color="#888888">
            {'   '}{state.filePath}
          </Text>
        </Box>
      )}

      {/* Error */}
      {state.phase === 'error' && (
        <Box
          borderStyle="round"
          borderColor="red"
          paddingX={2}
          paddingY={1}
          flexDirection="column"
          gap={1}
          width={56}
        >
          <Text color="red" bold>✗  Error</Text>
          <Text color="#cc4444">{state.error}</Text>
          <Text color="#555555" dimColor>
            Make sure the tweet URL is public and contains media.
          </Text>
        </Box>
      )}
    </Box>
  );
};
