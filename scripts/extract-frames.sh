#!/usr/bin/env bash
# ============================================================================
# extract-frames.sh — turn a video into a webp frame sequence
# ----------------------------------------------------------------------------
# Usage:
#   scripts/extract-frames.sh <VIDEO_PATH> <SEQUENCE_NAME> [FPS] [WIDTH]
#
# Examples:
#   scripts/extract-frames.sh ~/Desktop/orbit.mp4 hero
#   scripts/extract-frames.sh ~/Desktop/build.mov builder 24 1600
#
# Notes:
#   - Uses $FFMPEG if set, otherwise `ffmpeg` on PATH.
#   - Writes frames to public/sequences/<SEQUENCE_NAME>/frame_%04d.webp
#   - Prints the extracted frame count so you can update
#     public/sequences/manifest.json (set the sequence's "count" to this value).
# ============================================================================
set -euo pipefail

VIDEO="${1:-}"
NAME="${2:-}"
FPS="${3:-15}"
WIDTH="${4:-1440}"

if [[ -z "$VIDEO" || -z "$NAME" ]]; then
  echo "Usage: $0 <VIDEO_PATH> <SEQUENCE_NAME> [FPS=15] [WIDTH=1440]" >&2
  exit 1
fi

if [[ ! -f "$VIDEO" ]]; then
  echo "Error: video not found: $VIDEO" >&2
  exit 1
fi

FFMPEG_BIN="${FFMPEG:-ffmpeg}"
if ! command -v "$FFMPEG_BIN" >/dev/null 2>&1; then
  echo "Error: ffmpeg not found (set \$FFMPEG or install ffmpeg)." >&2
  exit 1
fi

# Resolve output dir relative to the repo root (parent of this script's dir).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$ROOT_DIR/public/sequences/$NAME"

mkdir -p "$OUT_DIR"

echo "Extracting frames → $OUT_DIR (fps=$FPS, width=$WIDTH)..."
"$FFMPEG_BIN" -hide_banner -loglevel error -y \
  -i "$VIDEO" \
  -vf "fps=$FPS,scale=$WIDTH:-2" \
  -c:v libwebp -quality 78 \
  "$OUT_DIR/frame_%04d.webp"

COUNT="$(find "$OUT_DIR" -maxdepth 1 -name 'frame_*.webp' | wc -l | tr -d ' ')"

echo ""
echo "Done. Extracted $COUNT frames into public/sequences/$NAME/"
echo "Update public/sequences/manifest.json → \"$NAME\": { \"count\": $COUNT, ... }"
