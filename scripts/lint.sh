#!/usr/bin/env bash
# Run ESLint on app source using factory-root ESLint installation.
# Usage: ./scripts/lint.sh [theme]

set -e
THEME="${1:-crypto-portfolio}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${ROOT}/apps/${THEME}"
ESLINT="${ROOT}/node_modules/.bin/eslint"

if [ ! -d "$APP_DIR" ]; then
  echo "App not found: ${APP_DIR}"
  exit 1
fi

if [ ! -x "$ESLINT" ]; then
  echo "ESLint not found at factory root. Run: cd ${ROOT} && npm install"
  exit 1
fi

# Write config next to the app if missing
if [ ! -f "${APP_DIR}/.eslintrc.cjs" ]; then
  cat > "${APP_DIR}/.eslintrc.cjs" << 'ESLINT_CFG'
module.exports = {
  env: { browser: true, es2021: true, node: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: '18' } },
  rules: { 'no-unused-vars': 'off', 'no-empty': 'warn', 'react/prop-types': 'off', 'react/react-in-jsx-scope': 'off' },
};
ESLINT_CFG
fi

cd "$APP_DIR"
"$ESLINT" "src" "App.js" --ext .js,.jsx --ignore-pattern "node_modules" --max-warnings 999 2>&1
exit $?
