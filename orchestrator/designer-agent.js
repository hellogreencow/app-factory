#!/usr/bin/env node
/**
 * Designer Agent — generates a complete app architecture from an idea.
 *
 * Input: idea (name, description, domain, style)
 * Output: design.json with screens, data model, navigation, features, library choices
 */

require('./lib/env').loadEnv();

const fs = require('fs');
const path = require('path');
const { chat } = require('./lib/llm');
const { TOKEN_BUDGETS } = require('./lib/models');
const { getNavigationDocs } = require('./lib/docs-context');

const AVAILABLE_LIBRARIES = `
INSTALLED LIBRARIES (use freely):
- @expo/vector-icons (Ionicons, MaterialIcons, FontAwesome, Feather)
- expo-linear-gradient, expo-blur, expo-haptics
- expo-location, expo-camera, expo-image-picker
- expo-clipboard, expo-sharing, expo-file-system, expo-constants
- react-native-maps (MapView, Marker, Callout)
- react-native-reanimated (smooth animations)
- react-native-gesture-handler (swipe, pinch, long-press)
- react-native-svg (charts, shapes)
- react-native-webview (WebView for embedding web content)
- @react-native-async-storage/async-storage
- date-fns (formatting, relative time)
- @react-navigation/native, native-stack, bottom-tabs
- react-native-safe-area-context, react-native-screens
- @supabase/supabase-js (database, auth, storage, realtime)
`;

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  process.stdout.write(`[${ts}] [designer] ${msg}\n`);
}

const MAX_DESIGN_ATTEMPTS = 3;

async function designApp(idea, opts = {}) {
  const model = opts.model || 'google/gemini-2.0-flash-001';

  const prompt = `Design a production-quality iOS app. Output ONLY valid JSON — no markdown, no backticks, no comments.

APP: ${idea.name} — ${idea.description}
DOMAIN: ${idea.domain || 'general'}
STYLE: ${idea.twist || idea.style_notes || 'modern dark'}

${AVAILABLE_LIBRARIES}

RULES:
- 5-7 screens. Keep descriptions under 20 words each.
- NO seed data in this JSON (it will be generated separately).
- Use MapView if the concept involves location/local/nearby/map.
- Require @expo/vector-icons on every screen.
- Every feature description must be under 25 words.
- Every feature.libraries array must list actual installed packages.

OUTPUT THIS EXACT STRUCTURE:
{
  "name": "AppName",
  "description": "One line",
  "style": {
    "theme": "dark",
    "backgroundColor": "#hex",
    "cardColor": "#hex",
    "textColor": "#hex",
    "accentColor": "#hex",
    "secondaryAccent": "#hex",
    "borderRadius": 8
  },
  "navigation": {
    "type": "bottom-tabs",
    "tabs": [
      {"name": "TabName", "icon": "Ionicons/icon-name", "screen": "ScreenName"}
    ]
  },
  "dataModel": {
    "entities": [
      {
        "name": "EntityName",
        "storageKey": "@app_key",
        "fields": [
          {"name": "id", "type": "string"},
          {"name": "fieldName", "type": "string"}
        ]
      }
    ]
  },
  "screens": [
    {
      "name": "ScreenName",
      "file": "src/screens/ScreenName.js",
      "purpose": "Short purpose",
      "features": [
        {"name": "feature-id", "description": "Short desc", "libraries": ["package-name"]}
      ],
      "layout": "Brief layout desc"
    }
  ],
  "backend": {
    "type": "supabase|local",
    "auth": false,
    "tables": [
      {"name": "table_name", "columns": [{"name": "id", "type": "uuid"}, {"name": "col", "type": "text"}]}
    ],
    "storage": false,
    "realtime": false
  },
  "context": {
    "file": "src/context/AppContext.js",
    "hook": "useAppData",
    "methods": ["addItem", "deleteItem", "updateItem"],
    "computed": ["filteredItems", "stats"]
  }
}

BACKEND RULES:
- Set backend.type to "supabase" if the app needs user accounts, shared data, cloud storage, or multi-device sync.
- Set backend.type to "local" if the app is purely personal/offline (timer, calculator, personal journal).
- If backend.type is "supabase", set auth: true if users need accounts.
- List tables with columns. Use uuid for IDs, text/int4/bool/timestamptz for fields.
- If the app needs image/file uploads, set storage: true.
- If the app needs live updates (chat, collaboration), set realtime: true.`;

  let navDocs = '';
  try { navDocs = await getNavigationDocs(); } catch (e) { log(`Nav docs fetch failed: ${e.message}`); }

  const fullPrompt = navDocs
    ? prompt + `\n\nREFERENCE — Expo Navigation patterns (use these, not guesses):\n${navDocs}`
    : prompt;

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_DESIGN_ATTEMPTS; attempt++) {
    log(`Designing ${idea.name}... (attempt ${attempt}/${MAX_DESIGN_ATTEMPTS})`);

    try {
      const raw = await chat([{ role: 'user', content: fullPrompt }], {
        model,
        temperature: 0.7 + (attempt - 1) * 0.1,
        max_tokens: TOKEN_BUDGETS.design,
        timeout: 90_000,
      });

      log(`Raw output: ${raw.length} chars`);

      const design = repairAndParse(raw);
      if (!design) {
        lastError = new Error('Could not parse designer output as JSON');
        log(`Attempt ${attempt}: parse failed`);
        continue;
      }

      log(`Parsed keys: ${Object.keys(design).join(', ')}`);

      if (!design.screens || design.screens.length < 3) {
        lastError = new Error(`Design only has ${design.screens?.length || 0} screens`);
        log(`Attempt ${attempt}: ${lastError.message}`);
        continue;
      }
      if (!design.navigation?.tabs?.length) {
        lastError = new Error('Design has no navigation tabs');
        log(`Attempt ${attempt}: ${lastError.message}`);
        continue;
      }

      for (const s of design.screens) {
        if (!s.file) s.file = `src/screens/${s.name}.js`;
      }
      if (!design.context) {
        design.context = { file: 'src/context/AppContext.js', hook: 'useAppData', methods: [], computed: [] };
      }
      if (!design.context.file) design.context.file = 'src/context/AppContext.js';
      if (!design.context.hook) design.context.hook = 'useAppData';

      log(`Design: ${design.screens.length} screens, ${(design.dataModel?.entities || []).length} entities, ${design.navigation.tabs.length} tabs`);

      return design;
    } catch (e) {
      lastError = e;
      log(`Attempt ${attempt} failed: ${e.message.slice(0, 120)}`);
      if (attempt < MAX_DESIGN_ATTEMPTS) {
        log(`Retrying design in 3s...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  throw lastError || new Error('Design failed after all attempts');
}

function repairAndParse(raw) {
  // Find the JSON object boundaries
  const start = raw.indexOf('{');
  if (start < 0) return null;

  let s = raw.slice(start);

  // If there's a closing }, take everything up to the last one
  const end = s.lastIndexOf('}');
  if (end > 0) s = s.slice(0, end + 1);

  // Minimal cleanup: trailing commas only
  s = s.replace(/,(\s*[\]}])/g, '$1');

  try { return JSON.parse(s); } catch (e) { process.stderr.write(`[designer] Direct parse failed: ${e.message}\n`); }

  // Attempt 2: the text might be truncated — scan backwards removing lines until parseable
  const lines = s.split('\n');
  for (let i = lines.length; i > Math.floor(lines.length * 0.3); i--) {
    let attempt = lines.slice(0, i).join('\n');

    // Close any unclosed string
    const lastLine = attempt.split('\n').pop() || '';
    const quotes = (lastLine.match(/"/g) || []).length;
    if (quotes % 2 !== 0) attempt += '"';

    // Trim trailing comma
    attempt = attempt.replace(/,\s*$/, '');

    // Balance brackets
    const ob = (attempt.match(/\[/g) || []).length - (attempt.match(/\]/g) || []).length;
    const cb = (attempt.match(/\{/g) || []).length - (attempt.match(/\}/g) || []).length;
    for (let j = 0; j < ob; j++) attempt += ']';
    for (let j = 0; j < cb; j++) attempt += '}';

    // Remove trailing commas again after bracket close
    attempt = attempt.replace(/,(\s*[\]}])/g, '$1');

    try { return JSON.parse(attempt); } catch (e) { process.stderr.write(`[designer] Repair parse failed: ${e.message}\n`); }
  }

  return null;
}

async function main() {
  const ideaRaw = process.argv[2];
  if (!ideaRaw) {
    console.error('Usage: designer-agent.js <ideaJson>');
    process.exit(1);
  }

  const idea = JSON.parse(ideaRaw);
  const design = await designApp(idea);
  console.log(JSON.stringify(design, null, 2));
}

if (require.main === module) {
  main().catch(e => { console.error(`Fatal: ${e.message}`); process.exit(1); });
}

module.exports = { designApp, AVAILABLE_LIBRARIES, repairAndParse };
