import { Box } from "ink";
import type React from "react";
import { BatchCommand } from "./commands/BatchCommand.js";
import { DownloadCommand } from "./commands/DownloadCommand.js";
import { HistoryCommand } from "./commands/HistoryCommand.js";
import { ProfileCommand } from "./commands/ProfileCommand.js";
import { WatchCommand } from "./commands/WatchCommand.js";
import { Header } from "./components/Header.js";
import type { PostProcessOptions } from "./media/download.js";

export type AppMode = "download" | "history" | "watch" | "batch" | "profile";

interface Props {
	mode: AppMode;
	// download
	url?: string;
	quality: string;
	outputDir?: string;
	postProcess?: PostProcessOptions;
	sendNotify: boolean;
	subtitleLang?: string;
	libreUrl?: string;
	whisperUrl?: string;
	whisperKey?: string;
	// batch
	batchFile?: string;
	concurrent: number;
	// profile
	profileUser?: string;
	from?: string;
	to?: string;
	keyword?: string;
	video?: boolean;
	img?: boolean;
	retweets?: boolean;
	all?: boolean;
}

export const App: React.FC<Props> = ({
	mode,
	url,
	quality,
	outputDir,
	postProcess,
	sendNotify,
	subtitleLang,
	libreUrl,
	whisperUrl,
	whisperKey,
	batchFile,
	concurrent,
	profileUser,
	from,
	to,
	keyword,
	video,
	img,
	retweets,
	all,
}) => (
	<Box flexDirection="column">
		<Header />
		{mode === "download" && url && (
			<DownloadCommand
				rawUrl={url}
				outputDir={outputDir}
				quality={quality}
				postProcess={postProcess}
				sendNotify={sendNotify}
				subtitleLang={subtitleLang}
				libreUrl={libreUrl}
				whisperUrl={whisperUrl}
				whisperKey={whisperKey}
			/>
		)}
		{mode === "history" && <HistoryCommand />}
		{mode === "watch" && (
			<WatchCommand
				outputDir={outputDir}
				quality={quality}
				sendNotify={sendNotify}
			/>
		)}
		{mode === "batch" && batchFile && (
			<BatchCommand
				batchFile={batchFile}
				outputDir={outputDir}
				quality={quality}
				concurrent={concurrent}
				sendNotify={sendNotify}
			/>
		)}
		{mode === "profile" && profileUser && (
			<ProfileCommand
				username={profileUser}
				outputDir={outputDir}
				quality={quality}
				from={from}
				to={to}
				keyword={keyword}
				video={video}
				img={img}
				retweets={retweets}
				all={all}
				concurrent={concurrent}
				sendNotify={sendNotify}
			/>
		)}
	</Box>
);
