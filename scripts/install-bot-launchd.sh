#!/usr/bin/env bash
# Install launchd agent for the Telegram bot (macOS).
# Usage: ./scripts/install-bot-launchd.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node)"
PLIST_SRC="${ROOT}/scripts/com.iosappfactory.bot.plist"
PLIST_DEST="${HOME}/Library/LaunchAgents/com.iosappfactory.bot.plist"

mkdir -p "${ROOT}/logs"
sed -e "s|/Users/oli/.nvm/versions/node/v23.3.0/bin/node|${NODE}|g" \
    -e "s|/Users/oli/ios-app-factory|${ROOT}|g" \
    "$PLIST_SRC" > "$PLIST_DEST"

echo "Installed to ${PLIST_DEST}"
echo ""
echo "Commands:"
echo "  launchctl load ~/Library/LaunchAgents/com.iosappfactory.bot.plist   # start"
echo "  launchctl unload ~/Library/LaunchAgents/com.iosappfactory.bot.plist # stop"
echo "  launchctl kickstart -k gui/$(id -u)/com.iosappfactory.bot            # restart"
echo ""
echo "Logs: ${ROOT}/logs/bot.log"
