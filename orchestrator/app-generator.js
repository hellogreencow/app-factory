#!/usr/bin/env node
/**
 * App Generator — builds a complete app from a design spec using the code agent.
 *
 * Pipeline:
 *   1. Generate the data context (state management, persistence, seed data)
 *   2. Generate App.js (navigation, theming, provider wrapping)
 *   3. Generate each screen one by one (most complex first)
 *   4. Bundle test after each screen
 *   5. If a screen breaks the bundle, fix it or skip it
 *
 * Each generation step uses the code-agent in single-task mode.
 */

require('./lib/env').loadEnv();

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chat } = require('./lib/llm');
const { AVAILABLE_LIBRARIES } = require('./designer-agent');

const { TOKEN_BUDGETS, DEFAULT_TIER, getModels } = require('./lib/models');
const { getScreenDocs, getCodegenContext } = require('./lib/docs-context');
const { getErrorAvoidanceContext } = require('./lib/build-memory');
const CODE_MODEL = getModels(DEFAULT_TIER).codegen;

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  process.stdout.write(`[${ts}] [generator] ${msg}\n`);
}

function sanitize(code) {
  return code
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'")
    .replace(/\u201C/g, '"').replace(/\u201D/g, '"')
    .replace(/\u2014/g, '--').replace(/\u2013/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/```(?:javascript|js|jsx)?\n?/g, '')
    .replace(/\n?```$/g, '');
}

function bundleCheck(appDir, { ignoreUnresolvedModules = [] } = {}) {
  try {
    execSync(`npx expo export --dump-sourcemap --output-dir "${appDir}/.bundle-check" 2>&1`, {
      cwd: appDir, timeout: 45_000, stdio: 'pipe',
    });
    try { execSync(`rm -rf "${appDir}/.bundle-check"`); } catch {}
    return { ok: true };
  } catch (e) {
    try { execSync(`rm -rf "${appDir}/.bundle-check"`, { stdio: 'ignore' }); } catch {}
    const err = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
    let lines = err.split('\n').filter(l => /error|Error|SyntaxError|Cannot find|Unable to resolve/i.test(l));

    // Filter out "Unable to resolve module" errors for screen files not yet generated.
    // App.js imports all screens upfront, so missing future screens are expected mid-generation.
    if (ignoreUnresolvedModules.length > 0) {
      lines = lines.filter(l => {
        if (!/Unable to resolve module/i.test(l)) return true;
        return !ignoreUnresolvedModules.some(m => l.includes(m));
      });
    }

    lines = lines.slice(0, 5);
    if (lines.length === 0) return { ok: true };
    return { ok: false, error: lines.join('\n') || 'Unknown bundle error' };
  }
}

async function generateFile(appDir, filePath, purpose, context, design, model) {
  const fullPath = path.join(appDir, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const existingFiles = [];
  const srcDir = path.join(appDir, 'src');
  if (fs.existsSync(srcDir)) {
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.js')) {
          existingFiles.push({
            path: path.relative(appDir, p),
            content: fs.readFileSync(p, 'utf8'),
          });
        }
      }
    };
    walk(srcDir);
  }
  const appJs = path.join(appDir, 'App.js');
  if (fs.existsSync(appJs)) {
    existingFiles.push({ path: 'App.js', content: fs.readFileSync(appJs, 'utf8') });
  }

  const existingContext = existingFiles.length > 0
    ? '\n\nEXISTING FILES (reference these for imports and consistency):\n' +
      existingFiles.map(f => `--- ${f.path} ---\n${f.content.slice(0, 3000)}`).join('\n\n')
    : '';

  let libraryDocs = '';
  if (design.screens) {
    const screen = design.screens.find(s => s.file === filePath);
    if (screen?.features) {
      const libs = screen.features.flatMap(f => f.libraries || []);
      try { libraryDocs = await getScreenDocs(libs); } catch (e) { /* non-blocking */ }
    }
  }
  const docsSection = libraryDocs
    ? `\nLIBRARY REFERENCE (use these patterns, not guesses):\n${libraryDocs}\n`
    : '';
  const errorContext = getErrorAvoidanceContext();

  const prompt = `Generate a complete React Native / Expo file.

FILE: ${filePath}
PURPOSE: ${purpose}

APP DESIGN:
${JSON.stringify(design, null, 2)}

${AVAILABLE_LIBRARIES}
${docsSection}${errorContext}
${context}
${existingContext}

RULES:
1. Output ONLY the complete JavaScript file. No markdown, no explanation, no backticks.
2. Use double quotes for strings containing apostrophes ("Don't" not 'Don\\'t').
3. Use @expo/vector-icons: import { Ionicons } from '@expo/vector-icons';
4. Every interactive element needs testID and accessibilityLabel.
5. Follow the style from the design (colors, borderRadius).
6. Import from existing files correctly — match the exact export names.
7. Use the exact entity field names from the data model.
8. For dates: import { formatDistanceToNow, format } from 'date-fns';
9. For haptics: import * as Haptics from 'expo-haptics';
10. For gradients: import { LinearGradient } from 'expo-linear-gradient';
11. Make it visually RICH. Use spacing, gradients, icons, hierarchy.
12. Handle empty states with helpful messages and icons.
13. CRITICAL: Only import packages from this list: react, react-native, expo-status-bar, expo-location, expo-camera, expo-haptics, expo-image-picker, expo-linear-gradient, expo-blur, expo-clipboard, expo-sharing, expo-file-system, expo-constants, @expo/vector-icons, @react-navigation/native, @react-navigation/native-stack, @react-navigation/bottom-tabs, react-native-screens, react-native-safe-area-context, react-native-gesture-handler, react-native-reanimated, react-native-maps, @react-native-async-storage/async-storage, react-native-svg, react-native-webview, date-fns, @supabase/supabase-js. DO NOT import uuid, axios, lodash, moment, or any other package.
14. For generating IDs, use: Date.now().toString(36) + Math.random().toString(36).slice(2). Do NOT import uuid.
15. DATE SAFETY: new Date(string) can return Invalid Date. ALWAYS guard: const d = new Date(str); const safe = isNaN(d.getTime()) ? new Date() : d; Use safe before passing to formatDistanceToNow() or format(). Never pass raw strings to date functions.
16. ARRAY SAFETY: EVERY .map()/.filter()/.forEach()/.reduce() on data from state/context/props/params MUST use a null guard. Write: (items || []).map(...) not items.map(...). No exceptions.
17. OPTIONAL CHAINING: Every property access on data from context/state/params that may be null/undefined MUST use optional chaining: item?.name ?? 'Unknown', not item.name. Use ?? for fallbacks, not ||, when 0 or false are valid values.
18. NAVIGATION PARAMS: route.params may be undefined. Always destructure with a fallback: const { id } = route?.params ?? {}; then guard: if (!id) return null;
19. NO EMPTY CATCH: Never write catch {} — always catch (e) {} or catch (err) { console.error(err); }.
20. FUNCTION GUARDS: Before calling any function stored in state/props, check it exists: onPress?.() or typeof onPress === 'function' && onPress().
21. COMPLETE OUTPUT: Write the ENTIRE file with no truncation. If it is long, that is expected. Never end the file mid-expression, mid-object, or mid-StyleSheet.`;

  const raw = await chat([{ role: 'user', content: prompt }], {
    model, temperature: 0.5, max_tokens: TOKEN_BUDGETS.codegen, timeout: 180_000,
  });

  const code = sanitize(raw.trim());

  if (code.length < 100) throw new Error('Generated code too short');
  if (!code.includes('export') && !code.includes('module.exports')) {
    throw new Error('Generated code has no exports');
  }

  fs.writeFileSync(fullPath, code, 'utf8');
  return code;
}

async function run(appDir, design, opts = {}) {
  const model = opts.model || CODE_MODEL;
  const onProgress = opts.onProgress || (() => {});
  const allowStubs = opts.allowStubs !== false;
  const minScreenPassRatio = Number.isFinite(opts.minScreenPassRatio) ? opts.minScreenPassRatio : 0.6;
  const t0 = Date.now();
  const results = { screens: [], contextOk: false, appJsOk: false, bundleOk: false };

  // ── Step 0: Supabase client (if backend requires it) ───────────────────────
  const backend = design.backend || {};
  if (backend.type === 'supabase') {
    const { SUPABASE_CLIENT_TEMPLATE, AUTH_CONTEXT_TEMPLATE } = require('./lib/templates/supabase-client');
    const supabaseFile = path.join(appDir, 'src', 'lib', 'supabase.js');
    if (!fs.existsSync(supabaseFile)) {
      log('Writing Supabase client...');
      onProgress('Setting up Supabase client...');
      fs.mkdirSync(path.dirname(supabaseFile), { recursive: true });
      fs.writeFileSync(supabaseFile, SUPABASE_CLIENT_TEMPLATE, 'utf8');
    }
    if (backend.auth) {
      const authFile = path.join(appDir, 'src', 'context', 'AuthContext.js');
      if (!fs.existsSync(authFile)) {
        log('Writing auth context...');
        onProgress('Setting up authentication...');
        fs.mkdirSync(path.dirname(authFile), { recursive: true });
        fs.writeFileSync(authFile, AUTH_CONTEXT_TEMPLATE, 'utf8');
      }
    }
  }

  // ── Step 1: Data Context ──────────────────────────────────────────────────
  const contextFile = design.context?.file || 'src/context/AppContext.js';
  const contextFullPath = path.join(appDir, contextFile);

  if (fs.existsSync(contextFullPath) && fs.readFileSync(contextFullPath, 'utf8').length > 200) {
    log('Context exists, skipping');
    results.contextOk = true;
  } else {
    log('Generating data context...');
    onProgress('Building data layer...');

    const entities = (design.dataModel?.entities || []);
    const entityDesc = entities.map(e => e.name + ' (' + (e.fields || []).map(f => f.name).join(', ') + ')').join('; ');
    const supabaseInstructions = backend.type === 'supabase'
      ? `\nBACKEND: Supabase. Import { supabase } from '../lib/supabase'.
Use supabase.from('table').select/insert/update/delete for all data operations.
${backend.auth ? 'Import { useAuth } from "./AuthContext" for user-scoped queries. Filter by user.id.' : ''}
Tables: ${(backend.tables || []).map(t => t.name + '(' + (t.columns || []).map(c => c.name + ':' + c.type).join(', ') + ')').join('; ')}
FALLBACK: If Supabase URL is placeholder (__SUPABASE_URL__), fall back to AsyncStorage with seed data so the app works offline.`
      : `Use AsyncStorage for persistence. Load on mount, save on changes.
Generate realistic seed data (5-8 items) as the initial state so the app is not empty on first launch.`;

    const contextPurpose = `Data context with ${backend.type === 'supabase' ? 'Supabase + AsyncStorage fallback' : 'AsyncStorage persistence'}.
Entities: ${entityDesc}
Methods to export: ${design.context?.methods?.join(', ') || 'CRUD operations'}
Computed values: ${design.context?.computed?.join(', ') || design.context?.computedValues?.join(', ') || 'filtered lists, stats'}
${supabaseInstructions}

Must export a Provider component and a hook (e.g., ${design.context?.hook || 'useAppData'}).
Use React.createContext, useState, useEffect, useMemo, useCallback.
For generating IDs, use: Date.now().toString(36) + Math.random().toString(36).slice(2). Do NOT import uuid.

CRITICAL: The context value MUST include a theme object: { backgroundColor, textColor, accentColor, cardColor } from design.style. App.js uses useContext to get theme for StatusBar and tab bar styling. If theme is missing, the app crashes with "Cannot read property '_context' of undefined".`;

    try {
      await generateFile(appDir, contextFile, contextPurpose, '', design, model);
      results.contextOk = true;
      log('Context generated');
    } catch (e) {
      log(`Context failed: ${e.message}`);
      return { ...results, ok: false, error: `Context generation failed: ${e.message}` };
    }
  }

  // ── Step 2: App.js (navigation + theming) ──────────────────────────────────
  const appJsPath = path.join(appDir, 'App.js');
  const navTabs = design.navigation.tabs;
  const stackScreens = design.navigation.stackScreens || [];

  if (fs.existsSync(appJsPath) && fs.readFileSync(appJsPath, 'utf8').includes('NavigationContainer')) {
    log('App.js exists with navigation, skipping');
    results.appJsOk = true;
  } else {
    log('Generating App.js...');
    onProgress('Building navigation...');

    const appPurpose = `Main app entry point with navigation and theming.

Navigation structure:
- Bottom tabs: ${navTabs.map(t => `${t.name} (icon: ${t.icon}, screen: ${t.screen})`).join(', ')}
- Stack screens (modals/detail): ${stackScreens.map(s => `${s.name} in ${s.parentTab}`).join(', ') || 'none'}

Theme:
- Background: ${design.style.backgroundColor}
- Text: ${design.style.textColor}
- Accent: ${design.style.accentColor}
- Cards: ${design.style.cardColor}
- Tab bar styled to match theme

Wrap everything in the data Provider from ${contextFile}.
${backend.type === 'supabase' && backend.auth ? 'Also wrap in AuthProvider from src/context/AuthContext.js. Show a LoginScreen if user is not authenticated. AuthProvider goes outside the data Provider.' : ''}
The Provider MUST supply theme in its value (from design.style). Use: const { theme } = useContext(AppContext) in a child component for tab bar and StatusBar.
Use @react-navigation/native, @react-navigation/bottom-tabs, @react-navigation/native-stack.
Use Ionicons for tab bar icons.
Add tabBarButtonTestID to every Tab.Screen.
Set StatusBar style based on theme (light bg = dark status, dark bg = light status).`;

    try {
      await generateFile(appDir, 'App.js', appPurpose, '', design, model);
      results.appJsOk = true;
      log('App.js generated');
    } catch (e) {
      log(`App.js failed: ${e.message}`);
      return { ...results, ok: false, error: `App.js generation failed: ${e.message}` };
    }
  }

  // ── Step 3: Screens (one at a time) ────────────────────────────────────────

  // Pre-stub all screens so App.js can resolve them during per-screen bundle checks.
  // Real code overwrites each stub as generation succeeds.
  for (const screen of design.screens) {
    const screenPath = path.join(appDir, screen.file);
    if (!fs.existsSync(screenPath)) {
      const dir = path.dirname(screenPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const placeholder = `import React from 'react';\nimport { View } from 'react-native';\nexport default function ${screen.name}() { return <View />; } // STUB\n`;
      fs.writeFileSync(screenPath, placeholder, 'utf8');
    }
  }

  for (let i = 0; i < design.screens.length; i++) {
    const screen = design.screens[i];
    const label = `[${i + 1}/${design.screens.length}] ${screen.name}`;

    // Skip screens that already have real content (not stubs)
    const screenPath = path.join(appDir, screen.file);
    if (fs.existsSync(screenPath)) {
      const existing = fs.readFileSync(screenPath, 'utf8');
      if (existing.length > 500 && !existing.includes('// STUB')) {
        log(`${label}: already exists (${existing.length} chars), skipping`);
        results.screens.push({ name: screen.name, ok: true, stub: false });
        continue;
      }
    }

    log(`${label}: generating...`);
    onProgress(`Building: ${screen.name}`);

    const screenPurpose = `${screen.purpose}

FEATURES:
${screen.features.map(f => `- ${f.name}: ${f.description} (uses: ${f.libraries?.join(', ') || 'none'}) testIDs: ${f.testIDs?.join(', ') || 'auto-generate'}`).join('\n')}

LAYOUT:
${screen.layout}

Import the data hook from the context file. Use the exact method and value names from the design.
Make it visually polished — icons on everything, proper spacing, gradient accents where appropriate.`;

    try {
      let screenOk = false;
      let lastBundleErr = '';

      for (let attempt = 1; attempt <= 3; attempt++) {
        const extraContext = attempt === 1
          ? ''
          : `\nPREVIOUS ATTEMPT FAILED WITH:\n${lastBundleErr}\n\nThis is attempt ${attempt}/3. Fix imports/exports/hooks precisely. Keep full feature depth and do not simplify into placeholder UI.`;
        await generateFile(appDir, screen.file, screenPurpose, extraContext, design, model);
        log(`${label}: written (attempt ${attempt})`);

        const check = bundleCheck(appDir);
        if (check.ok) {
          screenOk = true;
          break;
        }

        lastBundleErr = check.error;
        log(`${label}: bundle failed on attempt ${attempt}`);
        if (attempt < 3) onProgress(`Fixing: ${screen.name} (${attempt + 1}/3)`);
      }

      if (!screenOk) {
        if (!allowStubs) {
          log(`${label}: failed after 3 attempts (stubs disabled)`);
          results.screens.push({ name: screen.name, ok: false, stub: false, error: lastBundleErr || 'Bundle failed after retries' });
          continue;
        }

        log(`${label}: still broken — writing minimal stub`);
        const stubCode = `import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ${screen.name}() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>${screen.name.replace(/Screen$/, '')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '${design.style.backgroundColor}', alignItems: 'center', justifyContent: 'center' },
  text: { color: '${design.style.textColor}', fontSize: 20, fontWeight: 'bold' },
});
`;
        fs.writeFileSync(path.join(appDir, screen.file), stubCode, 'utf8');
        results.screens.push({ name: screen.name, ok: false, stub: true, error: lastBundleErr || 'Bundle failed after retries' });
        continue;
      }

      results.screens.push({ name: screen.name, ok: true, stub: false });
      log(`${label}: done`);
    } catch (e) {
      log(`${label}: generation failed: ${e.message}`);
      results.screens.push({ name: screen.name, ok: false, error: e.message });
    }
  }

  // ── Final bundle check ─────────────────────────────────────────────────────
  const finalCheck = bundleCheck(appDir);
  results.bundleOk = finalCheck.ok;
  if (!finalCheck.ok) {
    log(`Final bundle failed: ${finalCheck.error}`);
  }

  const passed = results.screens.filter(s => s.ok).length;
  const stubs = results.screens.filter(s => s.stub).length;
  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  log(`Done in ${dur}s: ${passed}/${results.screens.length} screens, ${stubs} stubs, bundle ${results.bundleOk ? 'OK' : 'FAILED'}`);

  results.ok = results.bundleOk
    && passed >= Math.ceil(design.screens.length * minScreenPassRatio)
    && (allowStubs || stubs === 0);
  results.duration = dur;
  results.passed = passed;
  results.stubs = stubs;
  results.total = design.screens.length;

  return results;
}

if (require.main === module) {
  const appDir = process.argv[2];
  const designPath = process.argv[3];

  if (!appDir || !designPath) {
    console.error('Usage: app-generator.js <appDir> <design.json>');
    process.exit(1);
  }

  const design = JSON.parse(fs.readFileSync(designPath, 'utf8'));
  run(appDir, design, {
    onProgress: (msg) => console.log(`  >> ${msg}`),
  }).then(r => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  }).catch(e => {
    console.error(`Fatal: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { run };
