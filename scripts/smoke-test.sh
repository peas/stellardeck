#!/usr/bin/env bash
set -euo pipefail

# Visual smoke test: render test presentations and capture screenshots.
#
# Usage:
#   ./scripts/smoke-test.sh [--open]
#
# Captures screenshots of key slides into test/screenshots/ via decktape.
# With --open, opens the screenshot directory in Finder after capture.
#
# Requirements: npx, Google Chrome, free port 3031

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SCREENSHOTS_DIR="$PROJECT_DIR/test/screenshots"
PORT=3031
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

usage() {
  echo "Usage: $0 [--open]"
  echo ""
  echo "Run visual smoke tests by capturing slide screenshots."
  echo "Screenshots go to test/screenshots/"
  echo ""
  echo "Options:"
  echo "  --open    Open screenshots directory after capture"
  echo "  --help    Show this help"
  exit 0
}

[[ "${1:-}" == "--help" || "${1:-}" == "-h" ]] && usage

OPEN_AFTER=false
[[ "${1:-}" == "--open" ]] && OPEN_AFTER=true

# Test decks to capture
DECKS=(
  "test/smoke-test.md"
  "test/smoke-test-sweden.md"
  "vibe-coding/vibe-coding.md"
)

# Start server
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

cd "$PROJECT_DIR"
lsof -ti:$PORT | xargs kill 2>/dev/null || true
sleep 0.5
python3 -m http.server "$PORT" --bind 127.0.0.1 &>/dev/null &
SERVER_PID=$!
sleep 1

if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/viewer.html"; then
  echo "Error: Could not start HTTP server on port $PORT"
  exit 1
fi

# Clean and recreate screenshots dir
rm -rf "$SCREENSHOTS_DIR"
mkdir -p "$SCREENSHOTS_DIR"

echo "Running smoke tests..."
echo ""

for deck in "${DECKS[@]}"; do
  name=$(basename "$deck" .md)
  echo "  Capturing: $deck"

  npx decktape reveal \
    --size 1280x720 \
    --chrome-path "$CHROME_PATH" \
    --pause 1500 \
    --load-pause 2000 \
    --screenshots \
    --screenshots-directory "$SCREENSHOTS_DIR" \
    --screenshots-format png \
    "http://127.0.0.1:$PORT/viewer.html?file=$deck" \
    "$name.pdf" 2>&1 | { grep -E "Printed|Error" || true; }

  rm -f "$name.pdf"
  slides=$(ls "$SCREENSHOTS_DIR"/${name}*.png 2>/dev/null | wc -l | tr -d ' ')
  echo "    → $slides screenshots"
  echo ""
done

# Summary
total=$(find "$SCREENSHOTS_DIR" -name '*.png' | wc -l | tr -d ' ')
echo "Done: $total screenshots in test/screenshots/"

# Quick validation: check for very small screenshots (likely broken/empty slides)
echo ""
echo "Checking for anomalies..."
anomalies=0
while IFS= read -r f; do
  size=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null)
  if [ "$size" -lt 5000 ]; then
    echo "  ⚠ Suspiciously small: $(basename "$f") (${size}B)"
    anomalies=$((anomalies + 1))
  fi
done < <(find "$SCREENSHOTS_DIR" -name '*.png')

if [ "$anomalies" -eq 0 ]; then
  echo "  All screenshots look OK"
fi

$OPEN_AFTER && open "$SCREENSHOTS_DIR"
