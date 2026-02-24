#!/usr/bin/env bash
# Headless E2E test runner. Boots simulator without GUI, runs tests, shuts down.
# Usage: ./scripts/e2e-test.sh [theme] [--no-build]

set -e
THEME="${1:-crypto-portfolio}"
NO_BUILD=false
[[ "$2" == "--no-build" ]] && NO_BUILD=true

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${ROOT}/apps/${THEME}"
FLOWS_DIR="${APP_DIR}/maestro/flows"
REPORT_DIR="${APP_DIR}/maestro-reports"
export PATH="$PATH:$HOME/.maestro/bin"

APP_ID="com.iosappfactory.app"
[[ -f "${APP_DIR}/app.json" ]] && APP_ID=$(node -e "console.log(require('${APP_DIR}/app.json').expo?.ios?.bundleIdentifier || 'com.iosappfactory.app')")

echo "E2E test for ${THEME} (appId: ${APP_ID})"

if [ ! -d "$FLOWS_DIR" ]; then
  echo "No flows at ${FLOWS_DIR}"
  exit 1
fi

# ── Headless simulator management ──
# Find or boot a simulator without opening Simulator.app
BOOTED_UDID=$(xcrun simctl list devices booted -j 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
for devs in d.get('devices',{}).values():
  for dev in devs:
    if dev['state']=='Booted': print(dev['udid']); exit()
" 2>/dev/null)

if [ -z "$BOOTED_UDID" ]; then
  echo "Booting headless simulator..."
  # Pick an iOS 18.x device first (better Maestro compat), fall back to any
  SIM_UDID=$(xcrun simctl list devices available -j 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
for rt, devs in d.get('devices',{}).items():
  if '18' in rt or 'iOS' in rt:
    for dev in devs:
      if dev.get('isAvailable') and 'iPhone' in dev.get('name',''):
        print(dev['udid']); exit()
for rt, devs in d.get('devices',{}).items():
  for dev in devs:
    if dev.get('isAvailable') and 'iPhone' in dev.get('name',''):
      print(dev['udid']); exit()
" 2>/dev/null)

  if [ -z "$SIM_UDID" ]; then
    echo "No available iPhone simulator found"
    exit 1
  fi

  # Boot without launching Simulator.app GUI
  xcrun simctl boot "$SIM_UDID" 2>/dev/null || true
  BOOTED_UDID="$SIM_UDID"
  sleep 5
fi

echo "Using simulator: ${BOOTED_UDID}"

# Ensure Simulator.app is NOT in foreground (keep headless)
osascript -e 'tell application "Simulator" to set visible of every window to false' 2>/dev/null || true

# Build unless --no-build
if [ "$NO_BUILD" = false ]; then
  echo "Building app..."
  (cd "$APP_DIR" && npx expo run:ios --no-build-cache --device "$BOOTED_UDID") || exit 1
fi

mkdir -p "$REPORT_DIR"

# Try Maestro (60s timeout), fall back to simctl runner
if timeout 60 maestro --device "$BOOTED_UDID" test "$FLOWS_DIR" --format junit --output "${REPORT_DIR}/report.xml" 2>/dev/null; then
  echo "E2E passed (Maestro)"
  exit 0
fi

# Fallback: simctl-based runner
node "${ROOT}/orchestrator/e2e-runner.js" "$APP_DIR" --device "$BOOTED_UDID"
EXIT=$?

if [ $EXIT -eq 0 ]; then
  echo "E2E passed (simctl)"
else
  echo "E2E failed (exit $EXIT)"
fi
exit $EXIT
