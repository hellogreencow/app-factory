#!/usr/bin/env bash
# Phase 1: Scaffold an Expo app from a theme
# Usage: ./scripts/scaffold.sh <theme>
# Example: ./scripts/scaffold.sh crypto-portfolio
# Uses minimal template (create-expo-app blank-typescript has TS install issues)

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/scaffold-minimal.sh" "$@"
