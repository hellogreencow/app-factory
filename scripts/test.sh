#!/usr/bin/env bash
# Run E2E: scaffold (if needed), then start Expo in iOS simulator
# Usage: ./scripts/test.sh [theme]
# Example: ./scripts/test.sh crypto-portfolio

set -e
THEME="${1:-crypto-portfolio}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${ROOT}/apps/${THEME}"

if [ ! -d "$APP_DIR" ]; then
  echo "App not found. Scaffolding ${THEME}..."
  "$ROOT/scripts/scaffold-minimal.sh" "$THEME"
fi

echo "Starting Expo for ${THEME} on port 8086..."
cd "$APP_DIR"
npx expo start --ios --port 8086
