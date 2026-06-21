```
██╗  ██╗██████╗ ██╗
╚██╗██╔╝██╔══██╗██║
 ╚███╔╝ ██║  ██║██║
 ██╔██╗ ██║  ██║██║
██╔╝ ██╗██████╔╝███████╗
╚═╝  ╚═╝╚═════╝ ╚══════╝
```

**Download X / Twitter videos from your terminal beautifully.**

> this is a fork of [xvd-cli](https://github.com/ercan-er/xvd-cli)

## ✨ What it does

One command. Any X (Twitter) video. No API key. No browser extension. No nonsense.

```bash
xdl https://x.com/NASA/status/1902118174591521056
```

```
  Batch Download  ·  8 URLs  ·  4 concurrent
  ────────────────────────────────────────────────────────────
  ✓  @NASA           best   4.3 MB
  ✓  @SpaceX         720p   8.1 MB
  ⬇  @elonmusk       best   ████████████░░░░  74%  2.1 MB/s  ETA 3s
  ⟳  @NASA           best   fetching…
  ◌  …
  ────────────────────────────────────────────────────────────
  5/8   3 active   38.4 MB
```

---

## 💻 Install

```bash
bin install https://github.com/akirco/xdl
```

That's it. No Python, no yt-dlp, no API key.
_(ffmpeg optional, required only for GIF conversion, watermarks, subtitle burning, and HLS videos)_

---

## 📗 Usage

### Set token

> `F12` -> `Storage` -> `Cookies`

```
auth_token:"xxx"
ct0:"xxx"
```

```
export XDL_AUTH_TOKEN=""
export XDL_CT0=""
```

### Download a single video

```bash
xdl https://x.com/user/status/123456789
```

### Choose quality interactively

```bash
xdl https://x.com/user/status/123456789 --quality ask
```

```
  ┌────────────────────────────────────────┐
  │  @NASA · 2m 14s                        │
  │  Webb telescope reveals distant galaxy │
  └────────────────────────────────────────┘

  Select quality:
  ❯  1080p  (12.4 MB)
     720p   ( 6.2 MB)
     480p   ( 3.1 MB)
     360p   ( 1.8 MB)
```

### Save to a specific folder

```bash
xdl https://x.com/user/status/123 -o ~/Desktop
```

---

## 🔥 Power features

### `--watch` — Clipboard auto-downloader

Copy any X link. `xdl` downloads it automatically. No typing needed.

```bash
xdl --watch -o ~/Videos --notify
```

```
  ◎  Watch mode  ·  watching clipboard…

  ✓  @NASA           xdl_17291_best.mp4     4.3 MB
  ✓  @SpaceX         xdl_18841_720p.mp4     8.1 MB
  ⬇  @elonmusk       ████████░░░░░░░░  52%  2.1 MB/s
```

Just copy tweet URLs and watch them pile up in your folder.

---

### `--batch` — Download hundreds of videos in parallel

```bash
xdl --batch urls.txt -c 8
```

Put one URL per line in a text file (lines starting with `#` are ignored):

```
# Space agencies
https://x.com/NASA/status/1902118174591521056
https://x.com/SpaceX/status/1899847123456789012
https://x.com/ESA/status/1895123456789012345
```

Live TUI with per-row progress bars, speeds, and ETAs — up to 8 simultaneous downloads.

---

### `--profile` — Bulk-download an entire account's videos

```bash
xdl --profile @NASA -c 4
xdl --profile @NASA --from 2024-01-01 --to 2024-12-31
xdl --profile @NASA --keyword "telescope" -o ~/NASAVideos
```

Streams through up to 2,000 tweets, filters by date range and keyword, and downloads every video concurrently.

---

### `--gif` — Convert to animated GIF

```bash
xdl https://x.com/user/status/123 --gif
```

Two-pass GIF conversion with optimized palette — small file sizes, crisp colors. Requires `ffmpeg`.

---

### `--watermark` — Burn your logo into the video

```bash
xdl https://x.com/user/status/123 --watermark ~/logo.png --watermark-pos bottom-right
xdl https://x.com/user/status/123 --watermark ~/logo.png --watermark-size 120 --watermark-opacity 0.6
```

Positions: `top-left` `top-right` `bottom-left` `bottom-right` `center`

---

### `--subtitle` — Burn subtitles in any language

`xdl` can fetch subtitle tracks from the tweet, translate them to any language, and burn them permanently into the video.

```bash
# Burn existing subtitles without translating
xdl https://x.com/user/status/123 --subtitle en

# Translate to Turkish and burn
xdl https://x.com/user/status/123 --subtitle tr
```

**No subtitle tracks on the video?** Set your OpenAI API key and `xdl` will automatically transcribe the audio via [Whisper](https://platform.openai.com/docs/guides/speech-to-text):

**Step 1 — Get an API key**

Sign up at [platform.openai.com](https://platform.openai.com/api-keys) and create an API key.

**Step 2 — Add it to your shell (one-time setup)**

<details>
<summary>macOS / Linux (zsh / bash)</summary>

```bash
# Add to your shell profile so it's always available
echo 'export OPENAI_API_KEY="sk-..."' >> ~/.zshrc   # zsh (macOS default)
# or
echo 'export OPENAI_API_KEY="sk-..."' >> ~/.bashrc  # bash

# Apply immediately
source ~/.zshrc
```

</details>

<details>
<summary>Windows (PowerShell)</summary>

```powershell
# Set permanently for your user account
[System.Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "sk-...", "User")

# Re-open your terminal, then verify:
echo $env:OPENAI_API_KEY
```

</details>

**Step 3 — Use `--subtitle` as normal**

```bash
xdl https://x.com/user/status/123 --subtitle tr
```

`xdl` detects the key automatically — no extra flags needed. Translation is also free via [MyMemory](https://mymemory.translated.net/) and happens automatically when the source language differs from your target.

---

### `--history` — Browse everything you've downloaded

```bash
xdl --history
```

```
  DATE         USER           DURATION   SIZE    QUALITY   FILE
  2024-03-15   @NASA          2m 14s     4.3 MB  best      xdl_172914_best.mp4
  2024-03-14   @SpaceX        0m 48s     8.1 MB  720p      xdl_188417_720p.mp4
  2024-03-13   @elonmusk      1m 02s     5.7 MB  best      xdl_193821_best.mp4
```

Stores up to 200 entries in `~/.config/xdl/history.json`.

---

## 📖 All flags

| Flag                      | Short | Default        | Description                         |
| ------------------------- | ----- | -------------- | ----------------------------------- |
| `--output <dir>`          | `-o`  | `~/Movies`     | Save directory                      |
| `--quality <preset>`      | `-q`  | `best`         | `best` `worst` `1080p` `720p` `ask` |
| `--concurrent <n>`        | `-c`  | `4`            | Parallel downloads (batch/profile)  |
| `--gif`                   |       |                | Convert to animated GIF             |
| `--watermark <file>`      |       |                | PNG watermark path                  |
| `--watermark-pos <pos>`   |       | `bottom-right` | Watermark position                  |
| `--watermark-size <px>`   |       | `150`          | Watermark width in pixels           |
| `--watermark-opacity <n>` |       | `0.7`          | Watermark opacity (0.0–1.0)         |
| `--subtitle <lang>`       |       |                | Burn subtitles in target language   |
| `--notify`                |       |                | Desktop notification when done      |
| `--watch`                 |       |                | Auto-download from clipboard        |
| `--batch <file>`          |       |                | Path to URL list file               |
| `--profile <@user>`       |       |                | Download all videos from a profile  |
| `--from <YYYY-MM-DD>`     |       |                | Profile: start date filter          |
| `--to <YYYY-MM-DD>`       |       |                | Profile: end date filter            |
| `--keyword <text>`        |       |                | Profile: keyword filter             |
| `--history`               |       |                | Show download history               |

---

## 💻 Examples

```bash
# Single video, best quality
xdl https://x.com/NASA/status/1902118174591521056

# Save to desktop, convert to GIF, send notification
xdl https://x.com/user/status/123 -o ~/Desktop --gif --notify

# Burn a watermark
xdl https://x.com/user/status/123 --watermark ~/logo.png --watermark-size 120 --watermark-opacity 0.6

# Burn subtitles in Turkish
xdl https://x.com/user/status/123 --subtitle tr

# Watch mode — sit back, copy links
xdl --watch -o ~/Videos --notify

# Batch download, 8 at a time
xdl --batch urls.txt -c 8 -o ~/Downloads

# Download an entire profile filtered by year
xdl --profile @NASA --from 2024-01-01 --to 2024-12-31 -q 720p

# Interactive quality selector
xdl https://x.com/user/status/123 -q ask

# Show history
xdl --history
```

---

## ⚙️ ffmpeg

ffmpeg is **optional** but required for:

| Feature             | Requires ffmpeg |
| ------------------- | --------------- |
| MP4 direct download | ❌ No           |
| HLS/M3U8 streams    | ✅ Yes          |
| GIF conversion      | ✅ Yes          |
| Watermark overlay   | ✅ Yes          |
| Subtitle burning    | ✅ Yes          |

**Install ffmpeg:**

```bash
# Ubuntu / Debian
sudo apt install ffmpeg

# Windows
winget install ffmpeg
```

**macOS:**

```bash
brew install ffmpeg
```

> **Subtitle burning (`--subtitle`) requires a special ffmpeg build.**
> The standard Homebrew `ffmpeg` does **not** include libass, which is needed to burn subtitles into video. If you use `--subtitle` with the standard build, you'll get a `No such filter: 'subtitles'` error.

To enable subtitle burning on macOS, install the full build from the `homebrew-ffmpeg` tap:

```bash
# 1. Add the tap
brew tap homebrew-ffmpeg/ffmpeg

# 2. Remove the standard build first (required — two versions can't coexist)
brew uninstall ffmpeg

# 3. Install the full build (compiles from source, ~2 minutes)
brew install homebrew-ffmpeg/ffmpeg/ffmpeg
```

Verify it worked:

```bash
ffmpeg -filters | grep subtitles
# Expected:
# .. subtitles   V->V   Render text subtitles onto input video using the libass library.
```

> Downloads, GIFs, and watermarks work fine with the standard `brew install ffmpeg`. Only `--subtitle` needs the full build.

---

## 🛠 Build from source

```bash
git clone https://github.com/ercan-er/xdl-cli
cd xdl-cli
npm install
npm run build
npm install -g .
```

---

## 🧩 How it works

- **No API key needed** — Uses Twitter's public syndication endpoint (the same one powering tweet embeds)
- **HLS support** — Parses M3U8 playlists, downloads TS segments, concatenates with ffmpeg
- **Clipboard watcher** — Polls clipboard every 600ms, fires on new X URLs
- **Profile scraping** — Uses Twitter's internal GraphQL API with guest-token auth (same endpoints the web app uses)
- **Subtitle translation** — Fetches existing SRT tracks from the tweet, translates to any language, burns permanently with ffmpeg
- **History** — Stored locally in `~/.config/xdl/history.json`, never leaves your machine

---

## 🌐 Platform support

| Platform | Status                                                     |
| -------- | ---------------------------------------------------------- |
| macOS    | ✅ Fully tested                                            |
| Linux    | ✅ Supported                                               |
| Windows  | ⚠️ Mostly works (clipboard watch + notifications may vary) |

---

## 🔒 Privacy

`xdl` makes requests **only** to:

- `cdn.syndication.twimg.com` — video metadata
- `api.fxtwitter.com` — fallback metadata
- `twitter.com/i/api/graphql` — profile scraping (guest token, no login)
- Translation APIs — subtitle translation (only when `--subtitle` is used)
- The video/subtitle CDN URLs returned by the above

No telemetry. No tracking. All history is stored locally.

---

## 🤝 Contributing

Pull requests are welcome! Please open an issue first for large changes.

```bash
git clone https://github.com/ercan-er/xdl-cli
cd xdl-cli
npm install
npm run dev -- https://x.com/NASA/status/1902118174591521056
```

---

## ☕ Support

If xdl saved you time, a coffee is always appreciated!

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-yellow?logo=buymeacoffee&logoColor=white&style=for-the-badge)](https://buymeacoffee.com/kCoxX4RTh)

---

## 📄 License

MIT © 2026
