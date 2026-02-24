#!/usr/bin/env bash
# Paranoid audit runner.
# Usage:
#   ./scripts/audit.sh
#   ./scripts/audit.sh --arch tracker --full
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node "${ROOT}/orchestrator/audit-all.js" "$@"

