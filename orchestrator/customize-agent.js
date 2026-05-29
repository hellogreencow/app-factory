#!/usr/bin/env node
/**
 * Customize Agent: LLM-powered code customization for generated apps.
 *
 * Takes a template-copied app and rewrites key files to match the idea:
 *   - Context file: domain-specific seed data, field names, storage key
 *   - App.js: screen titles, color theme
 *   - Screens: labels, placeholders, empty states, section headers
 *
 * Usage: node customize-agent.js <appDir> <architecture> <ideaJson>
 *
 * Approach: targeted rewrite. Pass each file + idea spec to the LLM,
 * get back a customized version. Keeps structure/logic identical;
 * only changes strings, data, and colors.
 */

require('./lib/env').loadEnv();

const fs = require('fs');
const path = require('path');
const { chat } = require('./lib/llm');

const ARCH_FILES = {
  reference: {
    context: 'src/context/ReferenceContext.js',
    screens: ['src/screens/BrowseScreen.js', 'src/screens/ItemDetailScreen.js', 'src/screens/BookmarksScreen.js', 'src/screens/SettingsScreen.js'],
  },
  feed: {
    context: 'src/context/FeedContext.js',
    screens: ['src/screens/FeedScreen.js', 'src/screens/ComposeScreen.js', 'src/screens/ProfileScreen.js', 'src/screens/SettingsScreen.js'],
  },
  dashboard: {
    context: 'src/context/MetricsContext.js',
    screens: ['src/screens/OverviewScreen.js', 'src/screens/AddEntryScreen.js', 'src/screens/HistoryScreen.js', 'src/screens/SettingsScreen.js'],
  },
  tracker: {
    context: 'src/context/TrackerContext.js',
    screens: ['src/screens/CalendarScreen.js', 'src/screens/DayEntryScreen.js', 'src/screens/StatsScreen.js', 'src/screens/SettingsScreen.js'],
  },
  generic: {
    context: 'src/context/ItemsContext.js',
    screens: ['src/screens/ListScreen.js', 'src/screens/AddItemScreen.js', 'src/screens/DetailScreen.js', 'src/screens/SettingsScreen.js'],
  },
};

const STYLE_THEMES = {
  minimal: { bg: '#ffffff', card: '#f8f9fa', text: '#1a1a2e', accent: '#6366f1', tabBg: '#ffffff', tabBorder: '#e5e7eb', tabActive: '#6366f1', tabInactive: '#9ca3af', statusBar: 'dark' },
  'dark-mode': { bg: '#0d1117', card: '#161b22', text: '#e6edf3', accent: '#58a6ff', tabBg: '#161b22', tabBorder: '#30363d', tabActive: '#58a6ff', tabInactive: '#8b949e', statusBar: 'light' },
  'warm': { bg: '#fef7ed', card: '#fff7ed', text: '#451a03', accent: '#ea580c', tabBg: '#fff7ed', tabBorder: '#fed7aa', tabActive: '#ea580c', tabInactive: '#a8a29e', statusBar: 'dark' },
  'playful': { bg: '#fdf4ff', card: '#fae8ff', text: '#3b0764', accent: '#a855f7', tabBg: '#fdf4ff', tabBorder: '#e9d5ff', tabActive: '#a855f7', tabInactive: '#a8a29e', statusBar: 'dark' },
  'bold': { bg: '#18181b', card: '#27272a', text: '#fafafa', accent: '#ef4444', tabBg: '#18181b', tabBorder: '#3f3f46', tabActive: '#ef4444', tabInactive: '#71717a', statusBar: 'light' },
};

function sanitizeCode(code) {
  return code
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'")
    .replace(/\u201C/g, '"').replace(/\u201D/g, '"')
    .replace(/\u2014/g, '--').replace(/\u2013/g, '-')
    .replace(/\u2026/g, '...');
}

function getTheme(twist) {
  if (STYLE_THEMES[twist]) return STYLE_THEMES[twist];
  if (twist?.includes('dark') || twist?.includes('privacy')) return STYLE_THEMES['dark-mode'];
  if (twist?.includes('warm') || twist?.includes('organic')) return STYLE_THEMES['warm'];
  if (twist?.includes('playful') || twist?.includes('gamif')) return STYLE_THEMES['playful'];
  if (twist?.includes('bold') || twist?.includes('brutal')) return STYLE_THEMES['bold'];
  return STYLE_THEMES['minimal'];
}

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  process.stdout.write(`[${ts}] [customize] ${msg}\n`);
}

async function customizeContext(appDir, arch, idea, model) {
  const files = ARCH_FILES[arch];
  if (!files) return;

  const ctxPath = path.join(appDir, files.context);
  if (!fs.existsSync(ctxPath)) {
    log(`Context file not found: ${ctxPath}`);
    return;
  }

  const original = fs.readFileSync(ctxPath, 'utf8');

  const prompt = `You are customizing a React Native app's data context file.

APP IDEA:
- Name: ${idea.name}
- Description: ${idea.description}
- Domain: ${idea.domain}
- Style: ${idea.twist || 'minimal'}

ORIGINAL CODE:
\`\`\`javascript
${original}
\`\`\`

REWRITE this file so it fits the app idea. Rules:
1. Keep the EXACT same structure: imports, hooks, context provider, exports
2. Keep the EXACT same function signatures and return values
3. ONLY change:
   - SEED data: replace with 6-8 realistic, domain-specific items
   - Storage key string: rename to match the app
   - String content in seed entries should match the domain
4. CRITICAL — keep the same field names and types:
   - If the original uses mood with values ['great','good','okay','meh'], keep EXACTLY those values
   - If the original uses category strings, keep the same pattern
   - If the original has a generateSeed() function, keep ONE assignment per key (do NOT overwrite the same key multiple times in a loop)
   - All enum/choice values used in seed data MUST match any hardcoded arrays in the screens
5. Do NOT add new imports, dependencies, or change the component structure
6. Do NOT change AsyncStorage logic, useEffect patterns, or context API shape
7. Do NOT change any computed values logic (streak, total, etc.)
8. If there's a MOODS or similar constant array, keep the EXACT same values
9. CRITICAL: Use double quotes for any string containing an apostrophe. Write "Don't" not 'Don't'. This avoids JS syntax errors.

Output ONLY the complete JavaScript file. No markdown fences, no explanation.`;

  try {
    const result = await chat([{ role: 'user', content: prompt }], { model, temperature: 0.7, max_tokens: 2000 });
    const code = result.replace(/^```(?:javascript|js)?\n?/, '').replace(/\n?```$/, '').trim();

    if (code.includes('createContext') && code.includes('export')) {
      fs.writeFileSync(ctxPath, sanitizeCode(code), 'utf8');
      log(`Customized: ${files.context}`);
    } else {
      log(`Context customization produced invalid output, keeping original`);
    }
  } catch (e) {
    log(`Context customization failed: ${e.message}`);
  }
}

async function customizeAppJs(appDir, idea) {
  const appPath = path.join(appDir, 'App.js');
  if (!fs.existsSync(appPath)) return;

  let code = fs.readFileSync(appPath, 'utf8');
  const theme = getTheme(idea.twist);

  code = code.replace(/#0d1117/g, theme.bg);
  code = code.replace(/#161b22/g, theme.tabBg);
  code = code.replace(/#30363d/g, theme.tabBorder);
  code = code.replace(/#58a6ff/g, theme.tabActive);
  code = code.replace(/#8b949e/g, theme.tabInactive);

  // headerTintColor is the text/icon color on the header — must contrast with header bg
  const headerTextColor = theme.statusBar === 'light' ? '#ffffff' : theme.text;
  code = code.replace(/headerTintColor:\s*'#fff'/g, `headerTintColor: '${headerTextColor}'`);

  code = code.replace(/style="light"/, `style="${theme.statusBar}"`);

  fs.writeFileSync(appPath, code, 'utf8');
  log(`Themed App.js: ${idea.twist || 'minimal'}`);
}

async function customizeScreens(appDir, arch, idea, model) {
  const files = ARCH_FILES[arch];
  if (!files) return;

  for (const screenFile of files.screens) {
    if (screenFile.includes('Settings')) continue;

    const screenPath = path.join(appDir, screenFile);
    if (!fs.existsSync(screenPath)) continue;

    const original = fs.readFileSync(screenPath, 'utf8');
    const theme = getTheme(idea.twist);

    const prompt = `You are customizing a React Native screen for a specific app.

APP IDEA:
- Name: ${idea.name}
- Description: ${idea.description}
- Domain: ${idea.domain}
- Style: ${idea.twist || 'minimal'}

COLOR THEME:
- Background: ${theme.bg}
- Card/Surface: ${theme.card}
- Text: ${theme.text}
- Accent: ${theme.accent}

ORIGINAL SCREEN CODE:
\`\`\`javascript
${original}
\`\`\`

REWRITE this screen to fit the app idea. Rules:
1. Keep the EXACT same component structure, hooks, and navigation calls
2. Keep the EXACT same imports (do not add or remove any)
3. Keep the EXACT same context hook usage (field names must match exactly)
4. ONLY change:
   - Hardcoded color values (#hex) to match the color theme above
   - String literals (titles, labels, placeholders, empty state messages) to match the domain
   - Section headers, button labels, input placeholders — make them domain-appropriate
5. Do NOT change any logic, state management, or navigation
6. Do NOT add new imports or components
7. Keep testID and accessibilityLabel attributes if present
8. CRITICAL: If there are hardcoded arrays (like MOODS = ['great','good','okay','meh']), keep the EXACT SAME values. These must match the context file.
9. CRITICAL: All field names from the context hook (entries, streak, totalEntries, etc.) must be used EXACTLY as imported. Do not rename them.
10. CRITICAL: Use double quotes for any string containing an apostrophe. Write "Don't" not 'Don't'. This avoids JS syntax errors.

Output ONLY the complete JavaScript file. No markdown fences, no explanation.`;

    try {
      const result = await chat([{ role: 'user', content: prompt }], { model, temperature: 0.6, max_tokens: 3000 });
      const code = result.replace(/^```(?:javascript|js)?\n?/, '').replace(/\n?```$/, '').trim();

      if (!(code.includes('export') && (code.includes('Screen') || code.includes('function')))) {
        log(`Screen customization produced invalid output for ${screenFile}, keeping original`);
        continue;
      }

      // Verify imports were not renamed: every import path in the original must exist in the new code
      const origImports = [...original.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
      const newImports = [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
      const addedImports = newImports.filter(i => !origImports.includes(i) && !i.startsWith('react'));
      if (addedImports.length > 0) {
        log(`Screen ${screenFile}: LLM added new imports (${addedImports.join(', ')}) — keeping original`);
        continue;
      }
      const removedImports = origImports.filter(i => !newImports.includes(i));
      if (removedImports.length > 0) {
        log(`Screen ${screenFile}: LLM removed imports (${removedImports.join(', ')}) — keeping original`);
        continue;
      }

      fs.writeFileSync(screenPath, sanitizeCode(code), 'utf8');
      log(`Customized: ${screenFile}`);
    } catch (e) {
      log(`Screen customization failed for ${screenFile}: ${e.message}`);
    }
  }
}

async function main() {
  const appDir = process.argv[2];
  const arch = process.argv[3] || 'generic';
  const ideaRaw = process.argv[4];

  if (!appDir || !fs.existsSync(appDir)) {
    console.error('Usage: customize-agent.js <appDir> <architecture> <ideaJson>');
    process.exit(1);
  }

  let idea;
  try {
    idea = JSON.parse(ideaRaw);
  } catch {
    console.error('Invalid idea JSON');
    process.exit(1);
  }

  const model = process.env.CUSTOMIZE_MODEL || 'google/gemini-3-flash-preview';
  log(`Customizing ${idea.name} (${arch}) with ${model}`);

  const t = Date.now();

  // Run context and App.js customization in parallel
  await Promise.all([
    customizeContext(appDir, arch, idea, model),
    customizeAppJs(appDir, idea),
  ]);

  // Screens (sequential to avoid rate limits)
  await customizeScreens(appDir, arch, idea, model);

  const dur = ((Date.now() - t) / 1000).toFixed(1);
  log(`Done in ${dur}s`);

  console.log(JSON.stringify({ ok: true, duration: dur }));
}

main().catch(e => {
  log(`Fatal: ${e.message}`);
  process.exit(1);
});
