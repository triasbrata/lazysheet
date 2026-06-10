#!/usr/bin/env bash
# drag-out.sh — perform a native OS drag from the lazysheet file button to the browser dropzone
# Usage: bash drag-out.sh <btnX> <btnY> <dropX> <dropY> <stepMs>
set -euo pipefail

if [[ $# -ne 5 ]]; then
  echo "Usage: $0 <btnX> <btnY> <dropX> <dropY> <stepMs>" >&2
  exit 1
fi

btnX=$1
btnY=$2
dropX=$3
dropY=$4
stepMs=$5

# Compute 3 evenly-spaced intermediate points (integer math)
mid1X=$(( btnX + (dropX - btnX) * 1 / 4 ))
mid1Y=$(( btnY + (dropY - btnY) * 1 / 4 ))

mid2X=$(( btnX + (dropX - btnX) * 2 / 4 ))
mid2Y=$(( btnY + (dropY - btnY) * 2 / 4 ))

mid3X=$(( btnX + (dropX - btnX) * 3 / 4 ))
mid3Y=$(( btnY + (dropY - btnY) * 3 / 4 ))

# Run ONE cliclick invocation: hover -> press -> drag through midpoints -> release
cliclick \
  -e 200 \
  -w "${stepMs}" \
  "m:${btnX},${btnY}" \
  "dd:${btnX},${btnY}" \
  "dm:${mid1X},${mid1Y}" \
  "dm:${mid2X},${mid2Y}" \
  "dm:${mid3X},${mid3Y}" \
  "dm:${dropX},${dropY}" \
  "du:${dropX},${dropY}"
