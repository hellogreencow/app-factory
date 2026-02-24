#!/usr/bin/env bash
# Minimal scaffold: creates Expo app skeleton, runs npm install + expo install expo-asset
# Usage: ./scripts/scaffold-minimal.sh <theme>
# Example: ./scripts/scaffold-minimal.sh crypto-portfolio

set -e
THEME="${1:-crypto-portfolio}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${ROOT}/apps/${THEME}"

# Derive names from theme
PKG_NAME=$(echo "$THEME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')
BUNDLE_SUFFIX=$(echo "$THEME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g')
DISPLAY_NAME=$(echo "$THEME" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2); print}')

echo "Scaffolding ${THEME} in ${APP_DIR}"

if [ -d "$APP_DIR" ]; then
  echo "App already exists at ${APP_DIR}. Remove or use a different name."
  exit 1
fi

mkdir -p "$APP_DIR"
cd "$APP_DIR"

# ── package.json (uses variable expansion) ──
cat > package.json << PKG
{
  "name": "${PKG_NAME}",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-status-bar": "~2.0.0",
    "react": "18.3.1",
    "react-native": "0.76.5"
  },
  "private": true
}
PKG

# ── app.json (uses variable expansion) ──
cat > app.json << APP
{
  "expo": {
    "name": "${DISPLAY_NAME}",
    "slug": "${PKG_NAME}",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.iosappfactory.${BUNDLE_SUFFIX}"
    }
  }
}
APP

# ── App.js — write via node to avoid heredoc escaping issues ──
node -e "
const fs = require('fs');
const name = process.argv[1];
fs.writeFileSync('App.js', \`import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>\${name}</Text>
      <Text style={styles.subtitle}>iOS App Factory</Text>
      <StatusBar style=\"auto\" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
});
\`);
" "$DISPLAY_NAME"

# ── index.js (no variable expansion needed) ──
cat > index.js << 'IDX'
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
IDX

# ── babel.config.js ──
cat > babel.config.js << 'BABEL'
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
BABEL

echo "Installing dependencies..."
npm install

echo "Installing expo-asset..."
npx expo install expo-asset

echo "Done. Run: cd ${APP_DIR} && npx expo start --ios --port 8085"
