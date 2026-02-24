#!/bin/bash
# OpenClaw + iOS App Factory — One-command setup
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/user/ios-app-factory/main/openclaw/setup.sh | bash
#   OR
#   bash openclaw/setup.sh https://github.com/user/ios-app-factory.git
#
# What it does:
#   1. Checks prerequisites (Node.js, OpenClaw, macOS)
#   2. Clones the factory repo (or uses current dir)
#   3. Installs dependencies
#   4. Copies SOUL.md + TOOLS.md to OpenClaw workspace
#   5. Patches openclaw.json to point at the factory
#   6. Prompts for API keys
#   7. Restarts OpenClaw gateway

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

info() { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[x]${NC} $1"; exit 1; }

OPENCLAW_DIR="${HOME}/.openclaw"
OPENCLAW_WORKSPACE="${OPENCLAW_DIR}/workspace"
OPENCLAW_CONFIG="${OPENCLAW_DIR}/openclaw.json"
REPO_URL="${1:-}"
FACTORY_DIR=""

echo -e "\n${BOLD}iOS App Factory — OpenClaw Setup${NC}\n"

# ── Prerequisites ────────────────────────────────────────────────────────────

if [[ "$(uname)" != "Darwin" ]]; then
  fail "macOS required (iOS simulator + Xcode toolchain)"
fi

if ! command -v node &>/dev/null; then
  fail "Node.js not found. Install: brew install node"
fi

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if (( NODE_MAJOR < 20 )); then
  warn "Node.js $NODE_MAJOR detected. 20+ recommended."
fi

if ! command -v openclaw &>/dev/null; then
  info "Installing OpenClaw..."
  npm install -g @anthropic/openclaw || fail "OpenClaw install failed"
fi

if ! command -v xcrun &>/dev/null; then
  warn "Xcode command line tools not found. Simulator screenshots won't work."
  warn "Install: xcode-select --install"
fi

# ── Get the factory ──────────────────────────────────────────────────────────

if [[ -f "orchestrator/run-loop.js" ]]; then
  FACTORY_DIR="$(pwd)"
  info "Using current directory as factory: ${FACTORY_DIR}"
elif [[ -n "${REPO_URL}" ]]; then
  FACTORY_DIR="${HOME}/ios-app-factory"
  if [[ -d "${FACTORY_DIR}" ]]; then
    info "Factory already exists at ${FACTORY_DIR}, pulling latest..."
    cd "${FACTORY_DIR}" && git pull 2>/dev/null || true
  else
    info "Cloning factory..."
    git clone "${REPO_URL}" "${FACTORY_DIR}" || fail "Clone failed"
  fi
else
  fail "Run from inside the factory repo, or pass a git URL:\n  bash setup.sh https://github.com/user/ios-app-factory.git"
fi

# ── Install dependencies ─────────────────────────────────────────────────────

info "Installing factory dependencies..."
cd "${FACTORY_DIR}"
npm install --silent 2>/dev/null || npm install

# ── Setup .env ───────────────────────────────────────────────────────────────

if [[ ! -f "${FACTORY_DIR}/.env" ]]; then
  cp "${FACTORY_DIR}/.env.example" "${FACTORY_DIR}/.env"
  info "Created .env from template"

  echo ""
  echo -e "${BOLD}API Keys needed:${NC}"
  echo ""

  read -p "OpenRouter API key (get free at openrouter.ai/keys): " OPENROUTER_KEY
  if [[ -n "${OPENROUTER_KEY}" ]]; then
    sed -i '' "s/^OPENROUTER_API_KEY=.*/OPENROUTER_API_KEY=${OPENROUTER_KEY}/" "${FACTORY_DIR}/.env"
    info "OpenRouter key saved"
  fi

  read -p "Telegram bot token (from @BotFather, or press Enter to skip): " TELEGRAM_TOKEN
  if [[ -n "${TELEGRAM_TOKEN}" ]]; then
    sed -i '' "s/^TELEGRAM_BOT_TOKEN=.*/TELEGRAM_BOT_TOKEN=${TELEGRAM_TOKEN}/" "${FACTORY_DIR}/.env"
    info "Telegram token saved"
  fi

  echo ""
  warn "Apple Developer credentials are optional (for TestFlight deploys)."
  warn "Edit ${FACTORY_DIR}/.env later to add them."
else
  info ".env already exists, skipping key setup"
fi

# ── Configure OpenClaw ───────────────────────────────────────────────────────

info "Configuring OpenClaw..."

mkdir -p "${OPENCLAW_WORKSPACE}"
mkdir -p "${OPENCLAW_WORKSPACE}/memory"

cp "${FACTORY_DIR}/openclaw/SOUL.md" "${OPENCLAW_WORKSPACE}/SOUL.md"
info "Copied SOUL.md to OpenClaw workspace"

cp "${FACTORY_DIR}/openclaw/TOOLS.md" "${OPENCLAW_WORKSPACE}/TOOLS.md"
info "Copied TOOLS.md to OpenClaw workspace"

if [[ ! -f "${OPENCLAW_WORKSPACE}/IDENTITY.md" ]]; then
  cat > "${OPENCLAW_WORKSPACE}/IDENTITY.md" << 'EOF'
# Identity

name: App Factory
emoji: :hammer:
EOF
  info "Created IDENTITY.md"
fi

if [[ ! -f "${OPENCLAW_WORKSPACE}/USER.md" ]]; then
  cat > "${OPENCLAW_WORKSPACE}/USER.md" << 'EOF'
# User

You are helping a developer build iOS apps using the iOS App Factory pipeline.
Be direct, concise, and helpful. Ask clarifying questions when an app idea is vague.
EOF
  info "Created USER.md"
fi

# Patch or create openclaw.json
if [[ -f "${OPENCLAW_CONFIG}" ]]; then
  info "openclaw.json exists. You may need to manually set:"
  echo "  agent.workspace: \"${FACTORY_DIR}\""
  echo "  tools.profile: \"coding\""
else
  cat > "${OPENCLAW_CONFIG}" << ENDJSON
{
  "agent": {
    "workspace": "${FACTORY_DIR}"
  },
  "tools": {
    "profile": "coding",
    "allow": ["group:fs", "group:runtime", "group:sessions", "web_search", "web_fetch"]
  },
  "agents": {
    "defaults": {
      "model": "anthropic/claude-sonnet-4-20250514",
      "imageModel": "anthropic/claude-sonnet-4-20250514"
    }
  }
}
ENDJSON
  info "Created openclaw.json"
fi

# ── Restart OpenClaw if running ──────────────────────────────────────────────

if pgrep -f "openclaw" >/dev/null 2>&1; then
  info "Restarting OpenClaw gateway..."
  openclaw gateway restart 2>/dev/null || true
else
  info "OpenClaw gateway not running. Start with: openclaw"
fi

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}Setup complete.${NC}"
echo ""
echo "  Start building apps:"
echo ""
echo "    ${BOLD}Option 1: Telegram bot${NC}"
echo "    cd ${FACTORY_DIR} && npm run bot"
echo "    Then message your bot on Telegram."
echo ""
echo "    ${BOLD}Option 2: OpenClaw (any channel)${NC}"
echo "    openclaw"
echo "    Then tell your agent: \"build me a mood tracker\""
echo ""
echo "    ${BOLD}Option 3: Direct pipeline${NC}"
echo "    cd ${FACTORY_DIR}"
echo "    npm run factory"
echo ""
echo "  Preview any built app:"
echo "    cd ${FACTORY_DIR}/apps/<slug> && npx expo start"
echo ""
