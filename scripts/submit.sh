#!/usr/bin/env bash
# Submit to TestFlight — clean interactive session.
# Opens in Terminal. You type your Apple ID, password, and 2FA code directly.
set -euo pipefail

SLUG="${1:-mythology-travel-planner}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${ROOT}/apps/${SLUG}"

# Load env (API key for the actual submission, not for login)
if [ -f "${ROOT}/.env" ]; then
  set -a
  source <(grep -v '^#' "${ROOT}/.env" | grep -v '^\s*$')
  set +a
fi

cd "${APP_DIR}"

printf '\033[1m\033[95m'
printf '\n  ╔════════════════════════════════════════════════╗\n'
printf '  ║  iOS App Factory — Submit to TestFlight        ║\n'
printf '  ╚════════════════════════════════════════════════╝\n'
printf '\033[0m\n'
printf '  App:  \033[96m%s\033[0m\n' "${SLUG}"
printf '  Dir:  \033[90m%s\033[0m\n\n' "${APP_DIR}"
printf '  \033[93mYou will be asked for:\033[0m\n'
printf '    1. Apple ID (email)\n'
printf '    2. Apple ID password\n'
printf '    3. 6-digit 2FA code from your iPhone\n\n'
printf '  Type them directly below when prompted.\n\n'
printf '\033[90m────────────────────────────────────────────────────\033[0m\n\n'

npx eas submit --platform ios --latest

printf '\n\033[90m────────────────────────────────────────────────────\033[0m\n'
printf '\033[92m  Done. Check TestFlight in 5-30 minutes.\033[0m\n\n'
