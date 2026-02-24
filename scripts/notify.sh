#!/usr/bin/env bash
# macOS system notification with sound
# Usage: ./scripts/notify.sh "Title" "Message"

TITLE="${1:-iOS App Factory}"
MSG="${2:-Done}"

if command -v osascript &>/dev/null; then
  osascript -e "display notification \"${MSG}\" with title \"${TITLE}\" sound name \"Glass\""
elif command -v terminal-notifier &>/dev/null; then
  terminal-notifier -title "${TITLE}" -message "${MSG}" -sound Glass
else
  echo "[${TITLE}] ${MSG}"
fi
