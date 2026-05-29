#!/usr/bin/env bash
# Rich scaffold: creates Expo app with full library palette for ground-up generation
# Usage: ./scripts/scaffold-minimal.sh <slug>

set -e
THEME="${1:-my-app}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${ROOT}/apps/${THEME}"

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

cat > package.json << PKG
{
  "name": "${PKG_NAME}",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "expo start",
    "ios": "expo start --ios",
    "tunnel": "expo start --tunnel"
  },
  "dependencies": {
    "expo": "~54.0.0"
  },
  "private": true
}
PKG

cat > app.json << APP
{
  "expo": {
    "name": "${DISPLAY_NAME}",
    "slug": "${PKG_NAME}",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.iosappfactory.${BUNDLE_SUFFIX}",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "This app uses your location to show nearby content.",
        "NSCameraUsageDescription": "This app uses the camera to capture photos.",
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    "plugins": [
      "expo-asset",
      "expo-location",
      "expo-camera",
      [
        "expo-image-picker",
        { "photosPermission": "Allow access to select photos." }
      ]
    ]
  }
}
APP

node -e "
const fs = require('fs');
const name = process.argv[1];
fs.writeFileSync('App.js', \`import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>\${name}</Text>
      <StatusBar style=\"auto\" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
});
\`);
" "$DISPLAY_NAME"

cat > index.js << 'IDX'
import { registerRootComponent } from 'expo';
import App from './App';
registerRootComponent(App);
IDX

cat > babel.config.js << 'BABEL'
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
BABEL

echo "Installing dependencies..."
npm install --legacy-peer-deps

echo "Installing Expo modules..."
npx expo install \
  react \
  react-native \
  expo-status-bar \
  expo-asset \
  expo-location \
  expo-camera \
  expo-haptics \
  expo-image-picker \
  expo-linear-gradient \
  expo-blur \
  expo-clipboard \
  expo-sharing \
  expo-file-system \
  expo-constants \
  @expo/vector-icons \
  expo-font \
  @react-navigation/native \
  @react-navigation/native-stack \
  @react-navigation/bottom-tabs \
  react-native-screens \
  react-native-safe-area-context \
  react-native-gesture-handler \
  react-native-reanimated \
  react-native-maps \
  @react-native-async-storage/async-storage \
  react-native-svg \
  react-native-webview \
  react-native-worklets \
  date-fns \
  -- --legacy-peer-deps

echo "Installing backend client (Supabase)..."
npm install --save --legacy-peer-deps @supabase/supabase-js react-native-url-polyfill

# babel-preset-expo is nested inside expo/node_modules but must be at root for babel.config.js.
# Install it explicitly as a regular dep at the version expo ships.
BABEL_VERSION=$(node -e "try{console.log(require('./node_modules/expo/node_modules/babel-preset-expo/package.json').version)}catch{console.log('latest')}")
npm install --save --legacy-peer-deps "babel-preset-expo@${BABEL_VERSION}"

npm install --save-dev --legacy-peer-deps @expo/ngrok

echo "Done. Run: cd ${APP_DIR} && npx expo start --ios"
