#!/usr/bin/env bash
# run-showcase.sh — macOS showcase recording orchestrator for lazysheet
# Records a demo reel: keyboard feature showcase + native file drag-out to browser dropzone.
# Usage: bash scripts/showcase/run-showcase.sh
#        bun run showcase
set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve repo root (this script lives at <root>/scripts/showcase/run-showcase.sh)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}/../.."
REPO_ROOT="$(pwd)"

# ---------------------------------------------------------------------------
# Config — all overridable via environment variables
# ---------------------------------------------------------------------------
# Resolve app binary honoring CARGO_TARGET_DIR (cargo may redirect the target dir).
# Priority: explicit SHOWCASE_APP_BIN > $CARGO_TARGET_DIR/debug > src-tauri/target/debug
if [[ -z "${SHOWCASE_APP_BIN:-}" ]]; then
  if [[ -n "${CARGO_TARGET_DIR:-}" ]]; then
    SHOWCASE_APP_BIN="${CARGO_TARGET_DIR%/}/debug/lazysheet"
  else
    SHOWCASE_APP_BIN="src-tauri/target/debug/lazysheet"
  fi
fi
: "${SHOWCASE_PORT:=8777}"
: "${SHOWCASE_OUT_DIR:=scripts/showcase/recordings}"
: "${SHOWCASE_DEMO_FILE:=scripts/showcase/demo.csv}"
: "${SHOWCASE_BROWSER:=Google Chrome}"
: "${SHOWCASE_STEP_MS:=300}"
: "${SHOWCASE_REC_SECONDS:=60}"
# Calibration offsets: button center relative to app window top-left origin
: "${SHOWCASE_BTN_DX:=44}"
: "${SHOWCASE_BTN_DY:=18}"

# ---------------------------------------------------------------------------
# Cleanup trap — runs on EXIT
# ---------------------------------------------------------------------------
SERVER_PID=""
APP_PID=""
REC_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  # Optionally stop app (comment out if you want it to remain open after recording)
  if [[ -n "$APP_PID" ]]; then
    kill "$APP_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------

# 1. cliclick must be installed
if ! command -v cliclick >/dev/null 2>&1; then
  echo "ERROR: cliclick not found. Install it with:" >&2
  echo "  brew install cliclick" >&2
  exit 1
fi

# 2. Build the app if the binary is missing
if [[ ! -x "${SHOWCASE_APP_BIN}" ]]; then
  echo "INFO: App binary not found at '${SHOWCASE_APP_BIN}'. Building now..."
  bun run build:web
  cargo build --manifest-path src-tauri/Cargo.toml
  echo "INFO: Build complete."
fi

# 3. Permissions reminder (printed once; macOS will prompt automatically on first run)
echo ""
echo "NOTE: macOS Privacy permissions required for full showcase:"
echo "  System Settings → Privacy & Security → Accessibility    — allow Terminal (or iTerm2)"
echo "  System Settings → Privacy & Security → Screen Recording — allow Terminal (or iTerm2)"
echo "  (cliclick and osascript also need Accessibility access)"
echo ""

# 4. Ensure output directory exists
mkdir -p "${SHOWCASE_OUT_DIR}"

# ---------------------------------------------------------------------------
# Absolute-ify the demo file path
# ---------------------------------------------------------------------------
DEMO_ABS="${REPO_ROOT}/${SHOWCASE_DEMO_FILE}"
if [[ ! -f "${DEMO_ABS}" ]]; then
  # Allow caller to pass an already-absolute path via SHOWCASE_DEMO_FILE
  if [[ -f "${SHOWCASE_DEMO_FILE}" ]]; then
    DEMO_ABS="${SHOWCASE_DEMO_FILE}"
  else
    echo "ERROR: Demo file not found: ${DEMO_ABS}" >&2
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# Start local dropzone web server
# ---------------------------------------------------------------------------
python3 -m http.server "${SHOWCASE_PORT}" --directory scripts/showcase >/dev/null 2>&1 &
SERVER_PID=$!
echo "INFO: Local server started (PID ${SERVER_PID}) at http://localhost:${SHOWCASE_PORT}/dropzone.html"

# Open browser to the dropzone
open -a "${SHOWCASE_BROWSER}" "http://localhost:${SHOWCASE_PORT}/dropzone.html"
sleep 2

# ---------------------------------------------------------------------------
# Launch the app
# ---------------------------------------------------------------------------
echo "INFO: Launching app: ${SHOWCASE_APP_BIN}"
if [[ ! -x "${SHOWCASE_APP_BIN}" ]]; then
  echo "ERROR: App binary not found/executable at '${SHOWCASE_APP_BIN}'." >&2
  echo "       CARGO_TARGET_DIR=${CARGO_TARGET_DIR:-<unset>}" >&2
  echo "       Set SHOWCASE_APP_BIN explicitly, or build with the showcase flags." >&2
  exit 1
fi
"${SHOWCASE_APP_BIN}" >/dev/null 2>&1 &
APP_PID=$!
sleep 2
# Verify the app actually launched (raw debug binary can exit immediately if frontendDist missing)
if ! kill -0 "${APP_PID}" 2>/dev/null; then
  echo "ERROR: App process exited immediately after launch. Check dist/ exists and the binary runs:" >&2
  echo "       ${SHOWCASE_APP_BIN}" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Compute step delay in decimal seconds (for AppleScript)
# ---------------------------------------------------------------------------
stepSec=$(awk "BEGIN { printf \"%.3f\", ${SHOWCASE_STEP_MS} / 1000 }")

# ---------------------------------------------------------------------------
# Output file (timestamped .mov)
# ---------------------------------------------------------------------------
OUT="${SHOWCASE_OUT_DIR}/showcase-$(date +%Y%m%d-%H%M%S).mov"

# ---------------------------------------------------------------------------
# Start screen recording
# ---------------------------------------------------------------------------
echo "INFO: Starting screen recording -> ${OUT}"
screencapture -v -V"${SHOWCASE_REC_SECONDS}" -k "${OUT}" &
REC_PID=$!

# ---------------------------------------------------------------------------
# Run AppleScript choreography — positions windows, opens file, runs feature reel
# Capture the APP_BOUNDS line from its output
# ---------------------------------------------------------------------------
echo "INFO: Running choreography (step delay: ${stepSec}s)..."
BOUNDS_LINE=$(
  osascript \
    scripts/showcase/choreography.applescript \
    "lazysheet" \
    "${DEMO_ABS}" \
    "${stepSec}" \
  2>&1 | grep '^APP_BOUNDS' | tail -1
) || true

if [[ -z "${BOUNDS_LINE}" ]]; then
  echo "WARN: No APP_BOUNDS line received from choreography. Using fallback coords." >&2
  # Fallback: get screen info and place button at top-left quarter
  SCREEN_INFO=$(osascript -e 'tell application "Finder" to get bounds of window of desktop' 2>/dev/null || echo "0, 0, 1440, 900")
  screenW=$(echo "${SCREEN_INFO}" | awk -F'[, ]+' '{print $3}')
  screenH=$(echo "${SCREEN_INFO}" | awk -F'[, ]+' '{print $4}')
  appX=0
  appY=0
  appW=$(( screenW / 2 ))
  appH=${screenH}
else
  # Parse: APP_BOUNDS x y w h
  read -r _ appX appY appW appH <<< "${BOUNDS_LINE}"
fi

# ---------------------------------------------------------------------------
# Get screen dimensions for dropzone target coords
# ---------------------------------------------------------------------------
SCREEN_BOUNDS=$(osascript -e 'tell application "Finder" to get bounds of window of desktop' 2>/dev/null || echo "0, 0, 1440, 900")
screenW=$(echo "${SCREEN_BOUNDS}" | awk -F'[, ]+' '{print $3}')
screenH=$(echo "${SCREEN_BOUNDS}" | awk -F'[, ]+' '{print $4}')

# ---------------------------------------------------------------------------
# Compute drag coordinates
# Button position = app window origin + calibrated offsets
# Drop target = center of the right-half browser window
# ---------------------------------------------------------------------------
btnX=$(( appX + SHOWCASE_BTN_DX ))
btnY=$(( appY + SHOWCASE_BTN_DY ))
dropX=$(( screenW * 3 / 4 ))
dropY=$(( screenH / 2 ))

echo "INFO: Drag: button=(${btnX},${btnY}) -> dropzone=(${dropX},${dropY})"

# ---------------------------------------------------------------------------
# Execute native drag-out
# ---------------------------------------------------------------------------
bash scripts/showcase/drag-out.sh \
  "${btnX}" "${btnY}" \
  "${dropX}" "${dropY}" \
  "${SHOWCASE_STEP_MS}"

# Let drop render on camera
sleep 2

# ---------------------------------------------------------------------------
# Stop recording
# ---------------------------------------------------------------------------
echo "INFO: Stopping recording..."
kill -INT "${REC_PID}" 2>/dev/null || true
wait "${REC_PID}" 2>/dev/null || true
REC_PID=""

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo "Saved: ${OUT}"
