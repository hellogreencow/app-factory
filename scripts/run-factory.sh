#!/usr/bin/env bash
# Autonomous App Factory: run full loop
# Usage: ./scripts/run-factory.sh [--continuous] [--max N] [--full] [--e2e] [--deploy] [--lint] [--llm]
# --full: lint + e2e + deploy (validates every feature, notifies when ready for TestFlight)
# --e2e: run Maestro E2E (builds native app, ~5 min per app)
# --deploy: after E2E pass, run eas build + submit (requires --e2e)
# --lint: run ESLint before E2E
# --llm: use OpenRouter for idea generation

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Load .env if present
[[ -f "$ROOT/.env" ]] && set -a && source "$ROOT/.env" && set +a

MAX=3
EXTRA=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --continuous) export CONTINUOUS=1 ;;
    --max) MAX="$2"; shift ;;
    --full) EXTRA="$EXTRA --full" ;;
    --e2e) EXTRA="$EXTRA --e2e" ;;
    --deploy) EXTRA="$EXTRA --deploy" ;;
    --lint) EXTRA="$EXTRA --lint" ;;
    --llm) EXTRA="$EXTRA --llm" ;;
  esac
  shift
done

export MAX_APPS="$MAX"
node "$ROOT/orchestrator/run-loop.js" $([ -n "$CONTINUOUS" ] && echo --continuous) $EXTRA
