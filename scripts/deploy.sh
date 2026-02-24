#!/usr/bin/env bash
# Deploy to TestFlight via EAS Build + Submit
# Uses EXPO_ASC_* env vars for API key auth (builds + submission).
# Uses EXPO_APPLE_APP_SPECIFIC_PASSWORD for app creation on ASC when needed.
# Usage: ./scripts/deploy.sh <slug> [--dry-run]
#        ./scripts/deploy.sh --dry-run <slug>
set -euo pipefail

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
  SLUG="${2:?Usage: deploy.sh --dry-run <slug>}"
else
  SLUG="${1:?Usage: deploy.sh <slug> [--dry-run]}"
  [ "${2:-}" = "--dry-run" ] && DRY_RUN=true
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${ROOT}/apps/${SLUG}"

# ── Load .env ────────────────────────────────────────────────────────────────
if [ -f "${ROOT}/.env" ]; then
  set -a
  source <(grep -v '^#' "${ROOT}/.env" | grep -v '^\s*$')
  set +a
fi

# ── Validate required vars ───────────────────────────────────────────────────
for var in EXPO_APPLE_TEAM_ID EXPO_ASC_KEY_ID EXPO_ASC_ISSUER_ID EXPO_ASC_API_KEY_PATH; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: ${var} not set. Add it to .env (see .env.example)."
    exit 1
  fi
done

if [ ! -f "${EXPO_ASC_API_KEY_PATH}" ]; then
  echo "ERROR: API key file not found at ${EXPO_ASC_API_KEY_PATH}"
  exit 1
fi

if [ ! -d "${APP_DIR}" ]; then
  echo "ERROR: App not found at ${APP_DIR}"
  exit 1
fi

cd "${APP_DIR}"

# ── Ensure eas.json exists ───────────────────────────────────────────────────
if [ ! -f "eas.json" ]; then
  cp "${ROOT}/config/eas.json" eas.json
fi

# ── Ensure git repo (EAS requirement) ────────────────────────────────────────
if [ ! -d ".git" ]; then
  git init -q
  echo "node_modules/" > .gitignore
  echo ".expo/" >> .gitignore
  echo "ios/" >> .gitignore
  echo "android/" >> .gitignore
  git add -A
  git commit -q -m "initial commit"
fi

# ── Ensure EAS project is linked ─────────────────────────────────────────────
if ! grep -q "extra.*eas.*projectId" app.json 2>/dev/null; then
  npx eas init --non-interactive --force 2>&1
  git add -A && git commit -q -m "link eas project" --allow-empty
fi

# ── Ensure app.json has owner + correct bundle ID + compliance ───────────────
node -e "
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('app.json', 'utf8'));
cfg.expo.owner = cfg.expo.owner || 'olimorley';
cfg.expo.ios = cfg.expo.ios || {};
cfg.expo.ios.bundleIdentifier = cfg.expo.ios.bundleIdentifier || 'com.iosappfactory.' + '${SLUG}'.replace(/[^a-zA-Z0-9]/g, '');
cfg.expo.ios.infoPlist = cfg.expo.ios.infoPlist || {};
cfg.expo.ios.infoPlist.ITSAppUsesNonExemptEncryption = false;
fs.writeFileSync('app.json', JSON.stringify(cfg, null, 2));
"

# ── Check if app exists on ASC (via review agent) ────────────────────────────
BUNDLE_ID=$(node -e "const c=JSON.parse(require('fs').readFileSync('app.json','utf8'));console.log(c.expo.ios.bundleIdentifier)")
ASC_APP_ID=$(node "${ROOT}/orchestrator/asc-api.js" find-app "${BUNDLE_ID}" 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log(j.found?j.id:'')}catch{console.log('')}})")

# ── Configure submit profile with API key + ascAppId ─────────────────────────
echo "[deploy] Configuring submit profile..."
node -e "
const fs = require('fs');
const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
eas.submit = eas.submit || {};
eas.submit.production = eas.submit.production || {};
eas.submit.production.ios = eas.submit.production.ios || {};
eas.submit.production.ios.ascApiKeyPath = '${EXPO_ASC_API_KEY_PATH}';
eas.submit.production.ios.ascApiKeyIssuerId = '${EXPO_ASC_ISSUER_ID}';
eas.submit.production.ios.ascApiKeyId = '${EXPO_ASC_KEY_ID}';
if ('${ASC_APP_ID}') eas.submit.production.ios.ascAppId = '${ASC_APP_ID}';
fs.writeFileSync('eas.json', JSON.stringify(eas, null, 2));
"
if [ -n "${ASC_APP_ID}" ]; then
  echo "[deploy] App found on ASC: ${ASC_APP_ID}"
fi
git add -A && git commit -q -m "configure submit profile" --allow-empty 2>/dev/null || true

# ── Dry run: stop before build/upload ─────────────────────────────────────────
if [ "$DRY_RUN" = true ]; then
  echo "[deploy] DRY RUN enabled — skipping EAS build + upload"
  echo "[deploy] Checks passed: env vars, asc-api lookup, eas.json submit profile configured"
  exit 0
fi

# ── EAS Build (production, iOS, blocking) ────────────────────────────────────
echo "[deploy] Building ${SLUG} for iOS via EAS..."
npx eas build \
  --platform ios \
  --profile production \
  --non-interactive 2>&1

# ── Download IPA from EAS build ───────────────────────────────────────────────
echo "[deploy] Fetching latest build artifact..."
IPA_URL=$(npx eas build:list --platform ios --limit 1 --non-interactive 2>&1 | grep "Application Archive URL" | awk '{print $NF}')
if [ -z "${IPA_URL}" ]; then
  echo "ERROR: Could not find IPA URL from latest build"
  exit 1
fi

IPA_PATH="/tmp/${SLUG}.ipa"
echo "[deploy] Downloading IPA..."
curl -sL "${IPA_URL}" -o "${IPA_PATH}"
if [ ! -f "${IPA_PATH}" ] || [ ! -s "${IPA_PATH}" ]; then
  echo "ERROR: Failed to download IPA from ${IPA_URL}"
  exit 1
fi
echo "[deploy] IPA downloaded: $(du -h "${IPA_PATH}" | awk '{print $1}')"

# ── Direct submit to Apple via altool (bypasses EAS submit queue) ────────────
echo "[deploy] Uploading ${SLUG} to Apple (direct via altool)..."
xcrun altool --upload-app \
  -f "${IPA_PATH}" \
  -t ios \
  --apiKey "${EXPO_ASC_KEY_ID}" \
  --apiIssuer "${EXPO_ASC_ISSUER_ID}" \
  2>&1

SUBMIT_EXIT=$?
rm -f "${IPA_PATH}"

if [ ${SUBMIT_EXIT} -ne 0 ]; then
  echo "[deploy] Direct upload failed (exit ${SUBMIT_EXIT})"
  # Fallback to EAS submit if direct upload fails
  echo "[deploy] Falling back to EAS submit..."
  npx eas submit --platform ios --latest --non-interactive --no-wait 2>&1
  SUBMIT_EXIT=$?
  if [ ${SUBMIT_EXIT} -ne 0 ]; then
    echo "[deploy] EAS submit fallback also failed"
    exit 1
  fi
  echo "[deploy] ${SLUG} queued via EAS submit (fallback). May take 30+ min."
else
  echo "[deploy] ${SLUG} uploaded to Apple. TestFlight processing in 5-15 min."
fi
