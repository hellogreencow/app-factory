/**
 * docs-context.js — Fetches up-to-date library documentation via Context7 API.
 *
 * Provides grounded Expo/React Native patterns to the designer, generator,
 * and repair agents so they stop hallucinating APIs that don't exist.
 *
 * Caches responses to avoid redundant network calls within a build session.
 */

const CONTEXT7_BASE = 'https://context7.com';

const LIBRARY_IDS = {
  expo: '/expo/expo',
  expoFull: '/llmstxt/expo_dev_llms-full_txt',
  expoSdk: '/websites/expo_dev_versions_sdk',
};

const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(libId, query) { return `${libId}::${query}`; }

async function queryDocs(libraryId, query, tokens = 4000) {
  const key = cacheKey(libraryId, query);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.value;

  try {
    const url = `${CONTEXT7_BASE}/api/v1/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ libraryId, query, tokens }),
    });
    if (!res.ok) {
      process.stderr.write(`[docs-context] Context7 ${res.status} for ${query}\n`);
      return '';
    }
    const text = await res.text();
    cache.set(key, { ts: Date.now(), value: text });
    return text;
  } catch (e) {
    process.stderr.write(`[docs-context] Failed: ${e.message}\n`);
    return '';
  }
}

/**
 * Fetches navigation patterns for the designer agent.
 * Returns a string of Expo Router / React Navigation best practices.
 */
async function getNavigationDocs() {
  return queryDocs(LIBRARY_IDS.expo, 'React Navigation stack navigator tab navigator bottom tabs setup with expo-router', 3000);
}

/**
 * Fetches library-specific docs based on screen features.
 * E.g. if a screen uses maps, camera, or animations, fetch those docs.
 */
async function getScreenDocs(features) {
  if (!features || !features.length) return '';

  const featureQueries = {
    maps: 'react-native-maps MapView Marker Region expo setup',
    camera: 'expo-camera CameraView permissions photo capture',
    location: 'expo-location getCurrentPositionAsync requestForegroundPermissionsAsync',
    haptics: 'expo-haptics impactAsync notificationAsync',
    'image-picker': 'expo-image-picker launchImageLibraryAsync launchCameraAsync permissions',
    animation: 'react-native-reanimated useSharedValue useAnimatedStyle withTiming withSpring',
    gesture: 'react-native-gesture-handler GestureDetector Gesture Pan Swipe',
    gradient: 'expo-linear-gradient LinearGradient colors start end',
    blur: 'expo-blur BlurView intensity tint',
    storage: 'async-storage AsyncStorage getItem setItem removeItem',
    icons: '@expo/vector-icons Ionicons MaterialIcons FontAwesome usage',
    svg: 'react-native-svg Svg Path Circle Rect',
    sharing: 'expo-sharing shareAsync expo-clipboard',
    charts: 'react-native-svg chart line bar pie with data',
  };

  const queries = [];
  for (const feat of features) {
    const key = Object.keys(featureQueries).find(k =>
      feat.toLowerCase().includes(k)
    );
    if (key) queries.push(featureQueries[key]);
  }

  if (!queries.length) return '';

  const results = await Promise.all(
    queries.slice(0, 3).map(q => queryDocs(LIBRARY_IDS.expo, q, 2000))
  );
  return results.filter(Boolean).join('\n\n---\n\n');
}

/**
 * Fetches general Expo component patterns for codegen.
 */
async function getCodegenContext() {
  return queryDocs(LIBRARY_IDS.expo, 'React Native StyleSheet functional component ScrollView FlatList SafeAreaView TouchableOpacity best practices', 3000);
}

/**
 * Fetches error-specific docs for repair context.
 */
async function getRepairDocs(errorMessage) {
  if (!errorMessage) return '';
  const shortErr = errorMessage.slice(0, 200);
  return queryDocs(LIBRARY_IDS.expo, `fix error: ${shortErr}`, 2000);
}

function clearCache() { cache.clear(); }

module.exports = {
  getNavigationDocs,
  getScreenDocs,
  getCodegenContext,
  getRepairDocs,
  queryDocs,
  clearCache,
  LIBRARY_IDS,
};
