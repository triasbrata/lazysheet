# lazysheet Showcase Recording Toolkit

Records a polished demo reel of lazysheet's features, culminating in the marquee
**native file drag-out** from the app's TitleBar button onto a local browser dropzone.
Output: a timestamped `.mov` under `scripts/showcase/recordings/` (gitignored).

---

## What It Does

1. Starts a local HTTP server serving `dropzone.html` (the "website" drop target).
2. Opens a browser window on the right half of the screen showing the dropzone.
3. Launches the lazysheet app on the left half.
4. Runs a keyboard feature reel via AppleScript:
   - Opens `demo.csv` (Cmd+O + Go-to-path paste)
   - Find bar (Cmd+F → "Total" → Escape)
   - Summary / Group-by panel (Cmd+Shift+Y → Escape)
   - Zoom in × 2 (Cmd+=) then reset (Cmd+0)
   - Inline edit a cell (F2 → type → Enter) then undo (Cmd+Z)
5. Reads the app window's screen coordinates.
6. Executes a real OS-level mouse drag from the TitleBar file button to the browser
   dropzone via `cliclick`, causing the dropzone to display "✅ Dropped: demo.csv".
7. Saves the full screen recording to `scripts/showcase/recordings/showcase-<timestamp>.mov`.

---

## Prerequisites

### Tools

```bash
brew install cliclick
```

`cliclick` is required for the native drag sequence. Everything else (AppleScript /
`osascript`, `screencapture`, `python3`) ships with macOS.

### macOS Privacy Permissions

Grant the following in **System Settings → Privacy & Security**:

| Permission | Who needs it |
|---|---|
| **Accessibility** | Terminal (or iTerm2), and transitively `osascript` + `cliclick` |
| **Screen Recording** | Terminal (or iTerm2), `screencapture` |

On first run macOS will prompt you automatically. If the showcase runs silently but the
recording is blank or keystrokes don't land, check these panes.

---

## How to Run

```bash
# Via npm/bun script (from repo root)
bun run showcase

# Or directly
bash scripts/showcase/run-showcase.sh
```

The script will build the app automatically if the binary is missing.

---

## Environment Variables

All variables are optional — defaults are sensible for a standard macOS setup.

| Variable | Default | Meaning |
|---|---|---|
| `SHOWCASE_APP_BIN` | `src-tauri/target/debug/lazysheet` | Path to the built app binary |
| `SHOWCASE_PORT` | `8777` | Local HTTP port for the dropzone server |
| `SHOWCASE_OUT_DIR` | `scripts/showcase/recordings` | Output directory for `.mov` files |
| `SHOWCASE_DEMO_FILE` | `scripts/showcase/demo.csv` | Demo CSV to open in the app |
| `SHOWCASE_BROWSER` | `Google Chrome` | macOS app name for the browser to open |
| `SHOWCASE_STEP_MS` | `300` | Milliseconds between each choreography action |
| `SHOWCASE_REC_SECONDS` | `60` | Maximum recording duration (seconds) |
| `SHOWCASE_BTN_DX` | `44` | X offset (px) from app window origin to the file-drag button center |
| `SHOWCASE_BTN_DY` | `18` | Y offset (px) from app window origin to the file-drag button center |

Example — slow everything down and use Safari:

```bash
SHOWCASE_BROWSER=Safari SHOWCASE_STEP_MS=500 bun run showcase
```

---

## Calibration

The drag-out finale uses `SHOWCASE_BTN_DX` and `SHOWCASE_BTN_DY` to locate the TitleBar
file button relative to the top-left corner of the app window.

**If the drag misses the file button:**

1. Open lazysheet manually and note the pixel position of the file-drag button
   (FileSpreadsheet icon, near the top-left of the custom TitleBar).
2. Note the app window's top-left corner position (e.g., via the AppleScript bounds output).
3. Compute: `DX = buttonCenterX - windowX`, `DY = buttonCenterY - windowY`.
4. Re-run with the corrected offsets:

   ```bash
   SHOWCASE_BTN_DX=52 SHOWCASE_BTN_DY=22 bun run showcase
   ```

The choreography AppleScript always pins the app window to `(0, 0)` on the left half, so
`SHOWCASE_BTN_DX` and `SHOWCASE_BTN_DY` effectively equal the button's absolute screen coords
after placement.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Drop didn't register — dropzone stayed blank | Raise `SHOWCASE_STEP_MS` (e.g., `500` or `800`) to give the OS more time to process the drag events |
| Wrong window got repositioned | Close other apps before running; only lazysheet + one browser should be open |
| `cliclick: command not found` | `brew install cliclick` |
| Recording is blank / all black | Grant **Screen Recording** permission to Terminal in macOS Privacy settings |
| Keystrokes didn't land in the app | Grant **Accessibility** permission to Terminal; also check that lazysheet was in focus |
| App binary not found after auto-build | Ensure Rust toolchain (`cargo`) and `bun` are installed and on `PATH` |
| Browser shows "unable to connect" | Another process may be using port 8777; set `SHOWCASE_PORT=8778` (or any free port) |

---

## Notes

- This toolkit is **NOT** part of the automated test suite. Running `bun run test:e2e` does
  not invoke it, and it is not wired into CI.
- The showcase app is built **without** the `VITE_E2E` or `webdriver` flags — it is the
  real, non-instrumented binary.
- Feature flags used at build time: `VITE_FF_MULTI_LANG=true VITE_FF_INLINE_EDIT=true
  VITE_FF_UNDO=true` (required for the full feature reel).
- Recordings are gitignored (`scripts/showcase/recordings/*.mov`).
