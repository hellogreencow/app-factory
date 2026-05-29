#!/usr/bin/env bash
# Install systemd user service for the Telegram bot.
# Usage: ./scripts/install-bot-service.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node || echo "/usr/bin/env node")"
SERVICE_NAME="app-factory-bot.service"
USER_DIR="${HOME}/.config/systemd/user"
SERVICE_SRC="${ROOT}/scripts/${SERVICE_NAME}"

mkdir -p "$USER_DIR"
sed -e "s|WorkingDirectory=.*|WorkingDirectory=${ROOT}|g" \
    -e "s|EnvironmentFile=.*|EnvironmentFile=-${ROOT}/.env|g" \
    -e "s|ExecStart=.*|ExecStart=${NODE} bot/telegram.js|g" \
    "$SERVICE_SRC" > "${USER_DIR}/${SERVICE_NAME}"

echo "Installed ${SERVICE_NAME} to ${USER_DIR}"
echo ""
echo "Commands:"
echo "  systemctl --user daemon-reload"
echo "  systemctl --user enable app-factory-bot"
echo "  systemctl --user start app-factory-bot"
echo "  systemctl --user status app-factory-bot"
echo "  systemctl --user restart app-factory-bot"
echo "  journalctl --user -u app-factory-bot -f"
