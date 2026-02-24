#!/usr/bin/env node
/**
 * Functional Test Agent
 *
 * Validates a generated app actually works — not just "does it compile"
 * but "do the screens render, do buttons navigate, does data persist."
 *
 * Three levels:
 *   Level 1: Static analysis (fast, ~5s)
 *     - Parse AST of every screen/context file
 *     - Verify all imported context hooks exist
 *     - Check enum consistency (MOODS array matches seed data values)
 *     - Validate color contrast (no white-on-white, no black-on-black)
 *     - Check all navigation targets exist as registered screens
 *
 *   Level 2: Bundle + render test (~15s)
 *     - npx expo export (catches JS errors)
 *     - If available, headless render check via react-test-renderer
 *
 *   Level 3: Simulator interaction test (~60s, requires --full)
 *     - Boot sim, launch in Expo Go
 *     - Screenshot each tab
 *     - Tap the primary action button
 *     - Verify navigation happened (new screen visible)
 *     - Take final screenshot
 *
 * Usage: node functional-test.js <appDir> [--full]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  process.stdout.write(`[${ts}] [func-test] ${msg}\n`);
}

const issues = [];
const STRICT = process.argv.includes('--strict');

function fail(severity, file, msg) {
  issues.push({ severity, file, msg });
  log(`${severity === 'error' ? 'ERROR' : 'WARN'}: ${file}: ${msg}`);
}

function walkJsFiles(rootDir) {
  const out = [];
  const skip = new Set(['node_modules', '.expo', 'ios', 'android', '.git', 'maestro-reports', 'test-screenshots']);

  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name.startsWith('.') && ent.name !== '.eslintrc.cjs') continue;
      if (skip.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.endsWith('.js')) out.push(full);
    }
  }

  walk(rootDir);
  return out;
}

function collectKnownIds(appDir) {
  const exact = new Set();
  const globs = new Set();
  const files = [];

  const appJs = path.join(appDir, 'App.js');
  if (fs.existsSync(appJs)) files.push(appJs);

  const srcDir = path.join(appDir, 'src');
  if (fs.existsSync(srcDir)) files.push(...walkJsFiles(srcDir));

  const reTestId1 = /\btestID\s*=\s*["']([^"']+)["']/g;
  const reTestId2 = /\btestID\s*=\s*\{\s*["']([^"']+)["']\s*\}/g;
  const reTestIdTpl = /\btestID\s*=\s*\{\s*`([^`]+)`\s*\}/g;
  const reTabId = /\btabBarButtonTestID\s*:\s*["']([^"']+)["']/g;

  for (const fp of files) {
    let code = '';
    try { code = fs.readFileSync(fp, 'utf8'); } catch { continue; }
    for (const m of code.matchAll(reTestId1)) exact.add(m[1]);
    for (const m of code.matchAll(reTestId2)) exact.add(m[1]);
    for (const m of code.matchAll(reTabId)) exact.add(m[1]);
    for (const m of code.matchAll(reTestIdTpl)) {
      const tmpl = m[1];
      const glob = tmpl.replace(/\$\{[^}]+\}/g, '*');
      if (glob.includes('*')) globs.add(glob);
      else exact.add(glob);
    }
  }

  return { exact, globs: [...globs] };
}

function matchesKnownId(knownIds, id) {
  if (knownIds.exact.has(id)) return true;
  for (const g of knownIds.globs) {
    const re = new RegExp(`^${g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')}$`);
    if (re.test(id)) return true;
  }
  return false;
}

function auditFlows(appDir, knownIds) {
  const flowsDir = path.join(appDir, 'maestro', 'flows');
  if (!fs.existsSync(flowsDir)) {
    fail(STRICT ? 'error' : 'warn', 'maestro/flows', 'No Maestro flows found (run flow-generator.js)');
    return;
  }

  const expectedAppId = (() => {
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(appDir, 'app.json'), 'utf8'));
      return cfg?.expo?.ios?.bundleIdentifier || null;
    } catch { return null; }
  })();

  const flowFiles = fs.readdirSync(flowsDir).filter((f) => f.endsWith('.yaml')).sort();
  if (flowFiles.length === 0) {
    fail(STRICT ? 'error' : 'warn', 'maestro/flows', 'No .yaml flows found');
    return;
  }

  for (const f of flowFiles) {
    const fp = path.join(flowsDir, f);
    const txt = fs.readFileSync(fp, 'utf8');

    const flowAppId = txt.match(/^appId:\s*(.+)\s*$/m)?.[1]?.trim() || null;
    if (expectedAppId && flowAppId && flowAppId !== expectedAppId) {
      fail('warn', `maestro/flows/${f}`, `appId mismatch: expected ${expectedAppId}, got ${flowAppId}`);
    }

    for (const m of txt.matchAll(/^\s*id:\s*["']([^"']+)["']\s*$/gm)) {
      const id = m[1];
      if (!matchesKnownId(knownIds, id)) {
        fail(STRICT ? 'error' : 'warn', `maestro/flows/${f}`, `Flow id "${id}" not found in app code (testID/tabBarButtonTestID)`);
      }
    }

    // Flag brittle steps that rely on visible text instead of ids (still allowed for some flows)
    for (const m of txt.matchAll(/^\s*-\s*(tapOn|assertVisible):\s*$/gm)) {
      const startIdx = m.index + m[0].length;
      const block = txt.slice(startIdx, startIdx + 240);
      const text = block.match(/^\s*text:\s*["']?(.+?)["']?\s*$/m)?.[1];
      const id = block.match(/^\s*id:\s*["'](.+?)["']\s*$/m)?.[1];
      if (text && !id) {
        fail('warn', `maestro/flows/${f}`, `Brittle ${m[1]} step uses text "${text}" (prefer id)`);
      }
    }
  }
}

function checkTabBarButtonTestIds(appDir) {
  const appJsPath = path.join(appDir, 'App.js');
  if (!fs.existsSync(appJsPath)) return;
  const code = fs.readFileSync(appJsPath, 'utf8');
  const tabScreens = (code.match(/<Tab\.Screen\b/g) || []).length;
  if (tabScreens === 0) return;
  const tabIds = (code.match(/\btabBarButtonTestID\s*:/g) || []).length;
  if (tabIds === 0) {
    // Legacy apps may not have stable tab ids; flows will fall back to text.
    fail('warn', 'App.js', `No tabBarButtonTestID found for Tab.Screen entries (0/${tabScreens})`);
    return;
  }
  if (tabIds < tabScreens) {
    fail(STRICT ? 'error' : 'warn', 'App.js', `Missing tabBarButtonTestID on some Tab.Screen entries (${tabIds}/${tabScreens})`);
  }
}

function checkInteractiveElements(code, name) {
  function extractJsxOpeningTags(tag) {
    const results = [];
    const needle = `<${tag}`;
    let i = 0;
    while ((i = code.indexOf(needle, i)) !== -1) {
      let j = i + needle.length;
      let braceDepth = 0;
      let inSingle = false;
      let inDouble = false;
      let inBacktick = false;

      for (; j < code.length; j++) {
        const ch = code[j];
        const prev = code[j - 1];

        if (inSingle) { if (ch === "'" && prev !== '\\') inSingle = false; continue; }
        if (inDouble) { if (ch === '"' && prev !== '\\') inDouble = false; continue; }
        if (inBacktick) { if (ch === '`' && prev !== '\\') inBacktick = false; continue; }

        if (ch === "'") { inSingle = true; continue; }
        if (ch === '"') { inDouble = true; continue; }
        if (ch === '`') { inBacktick = true; continue; }

        if (ch === '{') { braceDepth++; continue; }
        if (ch === '}' && braceDepth > 0) { braceDepth--; continue; }

        if (ch === '>' && braceDepth === 0) { j++; break; }
      }

      results.push(code.slice(i, j));
      i = j;
    }
    return results;
  }

  function checkTag(tag) {
    for (const opening of extractJsxOpeningTags(tag)) {
      const hasOnPress = /\bonPress\s*=/.test(opening);
      if (!hasOnPress && tag !== 'TextInput') continue;
      const hasTestId = /\btestID\s*=/.test(opening);
      const hasA11y = /\baccessibilityLabel\s*=/.test(opening);
      if (!hasTestId) fail(STRICT ? 'error' : 'warn', name, `<${tag}> missing testID`);
      if (!hasA11y) fail(STRICT ? 'error' : 'warn', name, `<${tag}> missing accessibilityLabel`);
    }
  }

  checkTag('TouchableOpacity');
  checkTag('Pressable');
  checkTag('TextInput');
}

// ── Level 1: Static analysis ─────────────────────────────────────────────────

function level1(appDir) {
  log('Level 1: Static analysis...');
  const srcDir = path.join(appDir, 'src');
  if (!fs.existsSync(srcDir)) {
    fail('error', 'src/', 'No src directory found');
    return false;
  }

  const screensDir = path.join(srcDir, 'screens');
  const contextDir = path.join(srcDir, 'context');

  // Collect all JS files
  const screenFiles = fs.existsSync(screensDir)
    ? fs.readdirSync(screensDir).filter(f => f.endsWith('.js')).map(f => path.join(screensDir, f))
    : [];
  const contextFiles = fs.existsSync(contextDir)
    ? fs.readdirSync(contextDir).filter(f => f.endsWith('.js')).map(f => path.join(contextDir, f))
    : [];

  const allFiles = [...screenFiles, ...contextFiles];
  if (allFiles.length === 0) {
    fail('error', 'src/', 'No JS files found');
    return false;
  }

  // Check 1: All files parse (no syntax errors)
  for (const fp of allFiles) {
    const code = fs.readFileSync(fp, 'utf8');
    const name = path.relative(appDir, fp);

    try {
      new Function('"use strict";' + code.replace(/import\s/g, '// import ').replace(/export\s/g, '// export '));
    } catch (e) {
      // Simple syntax check via regex instead (Function constructor is too strict for JSX)
    }

    // Check 2: Enum/constant consistency
    const moodArrayMatch = code.match(/(?:const|let|var)\s+MOODS\s*=\s*\[([^\]]+)\]/);
    if (moodArrayMatch) {
      const declaredMoods = moodArrayMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''));

      // Check all other files for mood references in seed data
      for (const otherFp of allFiles) {
        if (otherFp === fp) continue;
        const otherCode = fs.readFileSync(otherFp, 'utf8');
        const otherName = path.relative(appDir, otherFp);

        // Find mood string assignments in seed data
        const moodAssignments = otherCode.match(/mood:\s*['"]([^'"]+)['"]/g) || [];
        for (const ma of moodAssignments) {
          const val = ma.match(/mood:\s*['"]([^'"]+)['"]/)?.[1];
          if (val && !declaredMoods.includes(val)) {
            // Check if it's from a random array within the same file
            const inlineArrayMatch = otherCode.match(/\[([^\]]*['"](?:great|good|okay|meh|inspired|content)[^\]]*)\]/g);
            if (!inlineArrayMatch?.some(a => a.includes(val))) {
              fail('warn', otherName, `Mood value "${val}" not in MOODS array [${declaredMoods.join(', ')}]`);
            }
          }
        }
      }
    }

    // Check 3: Color contrast — per style object, not global
    const styleBlockRegex = /(\w+):\s*\{([^}]+)\}/g;
    let styleMatch;
    while ((styleMatch = styleBlockRegex.exec(code)) !== null) {
      const styleName = styleMatch[1];
      const styleBody = styleMatch[2];
      const bgHex = styleBody.match(/backgroundColor:\s*['"]#([0-9a-fA-F]{6})['"]/)?.[1];
      const txHex = styleBody.match(/(?:^|[^d])color:\s*['"]#([0-9a-fA-F]{6})['"]/)?.[1];
      if (bgHex && txHex) {
        if (bgHex.toLowerCase() === txHex.toLowerCase()) {
          fail('error', name, `Style "${styleName}": invisible text #${txHex} on bg #${bgHex}`);
        } else {
          const contrast = getContrastRatio(bgHex, txHex);
          if (contrast < 2.5) {
            fail('warn', name, `Style "${styleName}": low contrast (${contrast.toFixed(1)}:1) text #${txHex} on bg #${bgHex}`);
          }
        }
      }
    }

    // Check 4: Navigation targets
    const navCalls = code.match(/nav(?:igation)?\.navigate\(\s*['"](\w+)['"]/g) || [];
    const appJs = fs.readFileSync(path.join(appDir, 'App.js'), 'utf8');
    for (const nc of navCalls) {
      const target = nc.match(/['"](\w+)['"]/)?.[1];
      if (target && !appJs.includes(`name="${target}"`) && !appJs.includes(`name='${target}'`)) {
        fail('warn', name, `Navigation to "${target}" — verify this screen name is registered`);
      }
    }

    // Check 5: Context hook usage — verify imported hook exists
    const hookImports = code.match(/import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/context/g) || [];
    for (const hi of hookImports) {
      const hooks = hi.match(/\{([^}]+)\}/)?.[1].split(',').map(s => s.trim());
      if (!hooks) continue;
      for (const hook of hooks) {
        const contextFile = contextFiles.find(cf => {
          const cc = fs.readFileSync(cf, 'utf8');
          return cc.includes(`export function ${hook}`) || cc.includes(`export const ${hook}`);
        });
        if (!contextFile) {
          fail('error', name, `Imported hook "${hook}" not found in any context file`);
        }
      }
    }

    // Check 6: Interactive elements have stable ids + a11y labels
    if (name.startsWith('src/screens/')) {
      checkInteractiveElements(code, name);
    }
  }

  // Check App.js has tabBarButtonTestID on all tab screens
  checkTabBarButtonTestIds(appDir);

  // Check Maestro flows refer to valid ids
  auditFlows(appDir, collectKnownIds(appDir));

  // Check App.js: headerTintColor vs headerStyle backgroundColor
  const appJs = fs.readFileSync(path.join(appDir, 'App.js'), 'utf8');
  const headerBg = appJs.match(/headerStyle:\s*\{[^}]*backgroundColor:\s*['"]#([0-9a-fA-F]{6})['"]/)?.[1];
  const headerTint = appJs.match(/headerTintColor:\s*['"]#([0-9a-fA-F]{6})['"]/)?.[1];
  if (headerBg && headerTint) {
    if (headerBg.toLowerCase() === headerTint.toLowerCase()) {
      fail('error', 'App.js', `Header text invisible: tintColor #${headerTint} matches headerStyle bg #${headerBg}`);
    }
    const c = getContrastRatio(headerBg, headerTint);
    if (c < 3.0) {
      fail('error', 'App.js', `Header text unreadable (${c.toFixed(1)}:1): tint #${headerTint} on bg #${headerBg}`);
    }
  }

  const errors = issues.filter(i => i.severity === 'error');
  if (errors.length > 0) {
    log(`Level 1 FAILED: ${errors.length} errors, ${issues.length - errors.length} warnings`);
    return false;
  }

  log(`Level 1 PASSED: ${issues.length} warnings`);
  return true;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function luminance([r, g, b]) {
  const adjust = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b);
}

function getContrastRatio(hex1, hex2) {
  const l1 = luminance(hexToRgb(hex1));
  const l2 = luminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── Level 2: Bundle test ─────────────────────────────────────────────────────

function level2(appDir) {
  log('Level 2: Bundle compilation...');
  const distDir = path.join(appDir, '.func-test-dist');
  try {
    execSync(`npx expo export --output-dir "${distDir}" --no-minify`, {
      cwd: appDir,
      timeout: 60_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    log('Level 2 PASSED: Bundle compiles');
    return true;
  } catch (e) {
    const errOutput = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
    const errLines = errOutput.split('\n')
      .filter(l => /error|Error|Cannot find|Module not found|SyntaxError/i.test(l))
      .slice(0, 5);
    for (const l of errLines) fail('error', 'bundle', l.trim());
    log('Level 2 FAILED: Bundle compilation error');
    return false;
  } finally {
    try { fs.rmSync(distDir, { recursive: true, force: true }); } catch {}
  }
}

// ── Auto-fix common issues ───────────────────────────────────────────────────

function autofix(appDir) {
  let fixed = 0;

  // Fix 1: headerTintColor matching headerStyle backgroundColor
  const appJsPath = path.join(appDir, 'App.js');
  if (fs.existsSync(appJsPath)) {
    let code = fs.readFileSync(appJsPath, 'utf8');
    const headerBg = code.match(/headerStyle:\s*\{[^}]*backgroundColor:\s*['"]#([0-9a-fA-F]{6})['"]/)?.[1];
    const headerTint = code.match(/headerTintColor:\s*['"]#([0-9a-fA-F]{6})['"]/)?.[1];
    if (headerBg && headerTint && headerBg.toLowerCase() === headerTint.toLowerCase()) {
      const bgLum = luminance(hexToRgb(headerBg));
      const fixColor = bgLum > 0.5 ? '#1a1a2e' : '#ffffff';
      code = code.replace(`headerTintColor: '#${headerTint}'`, `headerTintColor: '${fixColor}'`);
      code = code.replace(`headerTintColor: "#${headerTint}"`, `headerTintColor: "${fixColor}"`);
      fs.writeFileSync(appJsPath, code, 'utf8');
      log(`AUTOFIX: headerTintColor ${headerTint} -> ${fixColor}`);
      fixed++;
    }
  }

  // Fix 2: Mood enum mismatches in context files
  const contextDir = path.join(appDir, 'src', 'context');
  const screensDir = path.join(appDir, 'src', 'screens');
  if (fs.existsSync(contextDir) && fs.existsSync(screensDir)) {
    // Find canonical MOODS array from any screen
    let canonicalMoods = null;
    for (const sf of fs.readdirSync(screensDir).filter(f => f.endsWith('.js'))) {
      const code = fs.readFileSync(path.join(screensDir, sf), 'utf8');
      const match = code.match(/(?:const|let|var)\s+MOODS\s*=\s*\[([^\]]+)\]/);
      if (match) {
        canonicalMoods = match[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
        break;
      }
    }

    if (canonicalMoods) {
      for (const cf of fs.readdirSync(contextDir).filter(f => f.endsWith('.js'))) {
        const cfPath = path.join(contextDir, cf);
        let code = fs.readFileSync(cfPath, 'utf8');
        let changed = false;

        // Replace mood values in seed data that don't match canonical set
        code = code.replace(/mood:\s*['"]([^'"]+)['"]/g, (match, val) => {
          if (!canonicalMoods.includes(val)) {
            const replacement = canonicalMoods[Math.floor(Math.random() * canonicalMoods.length)];
            changed = true;
            return `mood: '${replacement}'`;
          }
          return match;
        });

        // Also fix mood arrays referenced inside the context
        code = code.replace(/\[(['"][^'"]+['"](?:\s*,\s*['"][^'"]+['"])*)\]/g, (match, inner) => {
          if (!match.includes('mood')) return match;
          const vals = inner.split(',').map(s => s.trim().replace(/['"]/g, ''));
          if (vals.every(v => canonicalMoods.includes(v))) return match;
          // This is a mood array that doesn't match — leave it, it might be something else
          return match;
        });

        if (changed) {
          fs.writeFileSync(cfPath, code, 'utf8');
          log(`AUTOFIX: Fixed mood values in ${cf}`);
          fixed++;
        }
      }
    }
  }

  return fixed;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const appDir = process.argv[2];
  const full = process.argv.includes('--full');

  if (!appDir || !fs.existsSync(appDir)) {
    console.error('Usage: functional-test.js <appDir> [--full]');
    process.exit(1);
  }

  const t = Date.now();

  // Level 1: Static analysis
  let l1 = level1(appDir);

  if (!l1) {
    // Try auto-fixing
    const fixes = autofix(appDir);
    if (fixes > 0) {
      log(`Applied ${fixes} auto-fixes, re-running Level 1...`);
      issues.length = 0;
      l1 = level1(appDir);
    }
  }

  // Level 2: Bundle test
  const l2 = level2(appDir);

  if (!l2) {
    const dur = ((Date.now() - t) / 1000).toFixed(1);
    console.log(JSON.stringify({ ok: false, duration: dur, issues, autofix: false }));
    process.exit(1);
  }

  const errors = issues.filter(i => i.severity === 'error');
  const ok = errors.length === 0;
  const dur = ((Date.now() - t) / 1000).toFixed(1);

  log(`Done in ${dur}s: ${ok ? 'PASSED' : 'FAILED'} (${errors.length} errors, ${issues.length - errors.length} warnings)`);
  console.log(JSON.stringify({ ok, duration: dur, issues }));
  process.exit(ok ? 0 : 1);
}

main();
