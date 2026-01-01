#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$ROOT_DIR/dist/chrome" "$ROOT_DIR/dist/firefox"

cp "$ROOT_DIR/manifest/chrome.json" "$ROOT_DIR/dist/chrome/manifest.json"
cp "$ROOT_DIR/manifest/firefox.json" "$ROOT_DIR/dist/firefox/manifest.json"

# TODO: Replace with real bundling when TypeScript modules are introduced.
cp "$ROOT_DIR/src/content/index.ts" "$ROOT_DIR/dist/chrome/content.js"
cp "$ROOT_DIR/src/content/index.ts" "$ROOT_DIR/dist/firefox/content.js"

cp "$ROOT_DIR/src/background/index.ts" "$ROOT_DIR/dist/chrome/background.js"
cp "$ROOT_DIR/src/background/index.ts" "$ROOT_DIR/dist/firefox/background.js"

echo "Build complete: dist/chrome and dist/firefox"
