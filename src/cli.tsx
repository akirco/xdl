import chalk from "chalk";
import { render } from "ink";
import meow from "meow";
import { App } from "./App.js";
import type { WatermarkPosition } from "./media/ffmpeg.js";

// ── Beautiful help screen ─────────────────────────────────────

function printHelp(): void {
  const c = {
    // structural
    border: chalk.hex("#2a2a2a"),
    dim: chalk.hex("#555555"),
    // section header
    section: chalk.hex("#00d4ff").bold,
    // commands
    cmd: chalk.white.bold,
    cmdArg: chalk.hex("#88aaff"),
    // flags
    flag: chalk.hex("#7dd3fc").bold,
    short: chalk.hex("#38bdf8"),
    meta: chalk.hex("#94a3b8"),
    def: chalk.hex("#64748b"),
    // values / presets
    val: chalk.hex("#a3e635"),
    dot: chalk.hex("#334155"),
    // examples
    dollar: chalk.hex("#475569"),
    url: chalk.hex("#38bdf8"),
    arg: chalk.hex("#fbbf24"),
    // special
    req: chalk.hex("#f97316"), // "requires ffmpeg"
    header1: chalk.hex("#00d4ff").bold,
    header2: chalk.hex("#818cf8").bold,
  };

  const W = 62;
  const line = c.border("─".repeat(W));
  const blank = "";

  const row = (
    flag: string,
    short: string | null,
    meta: string | null,
    desc: string,
    def?: string,
  ) => {
    const f = c.flag(flag.padEnd(16));
    const s = short ? c.short(short.padEnd(4)) : "    ";
    const m = meta ? c.meta(meta.padEnd(14)) : "              ";
    const d = chalk.white(desc);
    const df = def ? c.def(`  [${def}]`) : "";
    return `  ${f} ${s} ${m} ${d}${df}`;
  };

  const ex = (cmd: string, comment?: string) => {
    // parse: split on spaces, colorize $ url flags
    const parts = cmd.split(" ");
    const colored = parts.map((p, i) => {
      if (p === "$") return c.dollar("$");
      if (p === "xdl") return chalk.white.bold("xdl");
      if (p.startsWith("https://")) return c.url(p);
      if (p.startsWith("--")) return c.arg(p);
      if (p.startsWith("-") && p.length <= 2) return c.arg(p);
      if (i > 0) return c.meta(p);
      return p;
    });
    const base = `  ${colored.join(" ")}`;
    return comment ? base + c.dim(`  # ${comment}`) : base;
  };

  const lines: string[] = [
    blank,
    // ── header ──
    "  " +
      c.header1("▸ XDL") +
      "  " +
      chalk.hex("#475569")("Download X / Twitter media from your terminal"),
    blank,
    line,
    blank,

    // ── USAGE ──
    `  ${c.section("USAGE")}`,
    blank,
    `  ${c.cmd("xdl")} ${c.cmdArg("<tweet-url>")}              ${chalk.white("Download a single video")}`,
    `  ${c.cmd("xdl")} ${c.flag("--watch")}                   ${chalk.white("Auto-download any X URL you copy")}`,
    `  ${c.cmd("xdl")} ${c.flag("--batch")} ${c.cmdArg("<file>")}             ${chalk.white("Download all URLs in a text file")}`,
    `  ${c.cmd("xdl")} ${c.flag("--profile")} ${c.cmdArg("<@user>")}           ${chalk.white("Download all videos from a profile")}`,
    `  ${c.cmd("xdl")} ${c.flag("--history")}                  ${chalk.white("Browse download history")}`,
    blank,
    line,
    blank,

    // ── OUTPUT ──
    `  ${c.section("OUTPUT")}`,
    blank,
    row("--output", "-o", "<dir>", "Save directory", "~/Movies"),
    row("--quality", "-q", "<preset>", "Video quality", "best"),
    `  ${"".padEnd(16)}  ${"".padEnd(4)}  ${c.val("best")}${c.dot(" · ")}${c.val("worst")}${c.dot(" · ")}${c.val("720p")}${c.dot(" · ")}${c.val("480p")}${c.dot(" · ")}${c.val("360p")}${c.dot(" · ")}${c.val("ask")}`,
    row("--concurrent", "-c", "<n>", "Parallel downloads", "4"),
    blank,
    line,
    blank,

    // ── POST-PROCESSING ──
    `  ${c.section("POST-PROCESSING")}  ${c.req("(requires ffmpeg)")}`,
    blank,
    row("--gif", null, null, "Convert to animated GIF"),
    row("--watermark", null, "<image.png>", "Burn PNG watermark into video"),
    row("--watermark-pos", null, "<pos>", "Watermark position", "bottom-right"),
    `  ${"".padEnd(16)}       ${c.val("top-left")}${c.dot(" · ")}${c.val("top-right")}${c.dot(" · ")}${c.val("bottom-left")}${c.dot(" · ")}${c.val("bottom-right")}${c.dot(" · ")}${c.val("center")}`,
    row(
      "--watermark-size",
      null,
      "<px>",
      "Scale watermark to this width",
      "150",
    ),
    row(
      "--watermark-opacity",
      null,
      "<0.0–1.0>",
      "Watermark transparency",
      "0.7",
    ),
    row(
      "--subtitle",
      null,
      "<lang>",
      "Burn subtitles in target lang",
      "e.g. tr",
    ),
    blank,
    line,
    blank,

    // ── FILTERS ──
    `  ${c.section("FILTERS")}  ${c.dim("(--profile only)")}`,
    blank,
    row("--from", null, "<YYYY-MM-DD>", "Only tweets after this date"),
    row("--to", null, "<YYYY-MM-DD>", "Only tweets before this date"),
    row("--keyword", null, "<text>", "Only tweets containing this text"),
    blank,
    row("--video", null, null, "Download videos only"),
    row("--img", null, null, "Download images only"),
    blank,
    row("--retweets", null, null, "Download retweets only"),
    row("--all", null, null, "Include all tweets (with retweets)"),
    blank,
    line,
    blank,

    // ── MISC ──
    `  ${c.section("MISC")}`,
    blank,
    row("--notify", null, null, "Desktop notification when done"),
    row("--version", null, null, "Print version"),
    row("--help", null, null, "Show this help"),
    blank,
    line,
    blank,

    // ── EXAMPLES ──
    `  ${c.section("EXAMPLES")}`,
    blank,
    ex("$ xdl https://x.com/NASA/status/1902118174591521056"),
    ex("$ xdl https://x.com/user/status/123 -o ~/Desktop --gif --notify"),
    ex(
      "$ xdl https://x.com/user/status/123 --watermark logo.png --watermark-pos bottom-right",
    ),
    ex("$ xdl https://x.com/user/status/123 -q ask", "interactive picker"),
    ex(
      "$ xdl https://x.com/user/status/123 --subtitle tr",
      "burn Turkish subtitles",
    ),
    ex(
      "$ xdl https://x.com/user/status/123 --subtitle en",
      "burn English subtitles",
    ),
    ex(
      "$ xdl https://x.com/user/status/123 --subtitle es",
      "burn Spanish subtitles",
    ),
    ex(
      "$ xdl https://x.com/user/status/123 --subtitle tr --gif",
      "subtitles + GIF",
    ),
    ex("$ xdl --watch -o ~/Videos --notify", "clipboard mode"),
    ex("$ xdl --batch urls.txt -c 8", "8 parallel downloads"),
    ex("$ xdl --profile @NASA --from 2024-01-01 -q 720p"),
    ex("$ xdl --profile @NASA --video", "videos only"),
    ex("$ xdl --profile @NASA --img", "images only"),
    ex("$ xdl --profile @NASA --retweets", "retweets only"),
    ex("$ xdl --profile @NASA --all", "all tweets + retweets"),
    ex("$ xdl --history"),
    blank,
  ];

  process.stdout.write(`${lines.join("\n")}\n`);
}

// ── CLI definition ────────────────────────────────────────────

const cli = meow("", {
  importMeta: import.meta,
  autoHelp: false,
  flags: {
    output: { type: "string", shortFlag: "o" },
    quality: { type: "string", shortFlag: "q", default: "best" },
    concurrent: { type: "number", shortFlag: "c", default: 4 },
    gif: { type: "boolean", default: false },
    watermark: { type: "string" },
    watermarkPos: { type: "string", default: "bottom-right" },
    watermarkSize: { type: "number", default: 150 },
    watermarkOpacity: { type: "number", default: 0.7 },
    subtitle: { type: "string" },
    libreUrl: { type: "string" },
    whisperUrl: { type: "string" },
    whisperKey: { type: "string" },
    notify: { type: "boolean", default: false },
    watch: { type: "boolean", default: false },
    batch: { type: "string" },
    profile: { type: "string" },
    from: { type: "string" },
    to: { type: "string" },
    keyword: { type: "string" },
    video: { type: "boolean", default: false },
    img: { type: "boolean", default: false },
    retweets: { type: "boolean", default: false },
    all: { type: "boolean", default: false },
    history: { type: "boolean", default: false },
    help: { type: "boolean", shortFlag: "h", default: false },
    version: { type: "boolean", shortFlag: "v", default: false },
  },
});

const url = cli.input[0];
const {
  output,
  quality,
  concurrent,
  gif,
  watermark,
  watermarkPos,
  watermarkSize,
  watermarkOpacity,
  subtitle,
  libreUrl,
  whisperUrl,
  whisperKey,
  notify,
  watch,
  batch,
  profile,
  from,
  to,
  keyword,
  video,
  img,
  retweets,
  all,
  history,
  help,
  version,
} = cli.flags;

// ── Version / help shortcuts ──────────────────────────────────

if (version) {
  const pkg = (await import("../package.json", { with: { type: "json" } }))
    .default;
  console.log(pkg.version);
  process.exit(0);
}

// ── Determine mode ────────────────────────────────────────────
type Mode = "download" | "history" | "watch" | "batch" | "profile";
let mode: Mode;

if (history) mode = "history";
else if (watch) mode = "watch";
else if (batch) mode = "batch";
else if (profile) mode = "profile";
else if (url) mode = "download";
else {
  printHelp();
  process.exit(0);
}

// show help AFTER mode check so "xdl --help" still works
if (help) {
  printHelp();
  process.exit(0);
}

// ── Validate required args ────────────────────────────────────
if (mode === "batch" && !batch) {
  console.error("Error: --batch requires a file path");
  process.exit(1);
}
if (mode === "profile" && !profile) {
  console.error("Error: --profile requires a username");
  process.exit(1);
}

// ── Build post-process options ────────────────────────────────
const postProcess =
  gif || watermark
    ? {
        gif: gif || false,
        watermark: watermark,
        watermarkPos: (watermarkPos as WatermarkPosition) ?? "bottom-right",
        watermarkSize: watermarkSize,
        watermarkOpacity: watermarkOpacity,
      }
    : undefined;

// ── Render ────────────────────────────────────────────────────
const { waitUntilExit } = render(
  <App
    mode={mode as Mode}
    url={url}
    quality={quality}
    outputDir={output}
    postProcess={postProcess}
    sendNotify={notify}
    subtitleLang={subtitle}
    libreUrl={libreUrl}
    whisperUrl={whisperUrl}
    whisperKey={whisperKey}
    batchFile={batch}
    concurrent={concurrent}
    profileUser={profile}
    from={from}
    to={to}
    keyword={keyword}
    video={video}
    img={img}
    retweets={retweets}
    all={all}
  />,
);

waitUntilExit()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
