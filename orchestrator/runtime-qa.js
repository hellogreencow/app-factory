#!/usr/bin/env node
/**
 * General-purpose headless QA for any Expo React Native app.
 *
 * No hardcoded features, screen names, navigation types, or app structure.
 * Works for any app: tabs, drawer, stack, single screen, whatever.
 *
 * Phases:
 *   1. Static scan — find all JS source files, check each for export + common crash patterns
 *   2. Bundle check — `expo export` catches import/syntax/config errors
 *   3. Runtime check — launch in simulator, capture ALL Metro output, detect ANY error
 *   4. Visual check — screenshot, detect error overlays via pixel analysis
 *   5. Auto-fix loop — if errors found, feed error+file to LLM, fix, re-run phases 1-4
 *
 * Usage:
 *   node runtime-qa.js <appDir>                 (full QA)
 *   node runtime-qa.js <appDir> --fix           (QA + auto-fix loop, max 5 rounds)
 *   node runtime-qa.js <appDir> --bundle-only   (just bundle check)
 */

require('./lib/env').loadEnv();

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { chat } = require('./lib/llm');

const EXPO_GO_BUNDLE = 'host.exp.Exponent';
const QA_PORT = 8098;
const MAX_FIX_ROUNDS = 5;

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  process.stdout.write(`[${ts}] [qa] ${msg}\n`);
}

function shell(cmd, opts = {}) {
  try {
    return { ok: true, stdout: execSync(cmd, { encoding: 'utf8', timeout: opts.timeout || 30000, stdio: 'pipe' }).trim() };
  } catch (e) {
    return { ok: false, stdout: '', stderr: (e.stderr?.toString() || e.message).slice(0, 500) };
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Phase 1: Static Scan ──────────────────────────────────────────────────────
// Scan ALL JS files in the project for structural problems.
// No assumptions about filenames, directories, or features.

function findAllSourceFiles(appDir) {
  const files = [];
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '.expo') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (/\.(js|jsx|ts|tsx)$/.test(e.name) && !e.name.includes('.test.')) {
        files.push(full);
      }
    }
  };
  walk(appDir);
  return files;
}

function staticScan(appDir) {
  log('Static scan...');
  const files = findAllSourceFiles(appDir);
  const issues = [];

  for (const filePath of files) {
    const rel = path.relative(appDir, filePath);
    let code;
    try { code = fs.readFileSync(filePath, 'utf8'); } catch { continue; }

    if (code.length < 50) continue;

    // Check: screen/component with JSX but no export
    const hasJSX = /<\w/.test(code);
    const hasDefaultExport = /export\s+default\s+|module\.exports\s*=/.test(code);
    const hasNamedExports = /export\s+(const|function|class)\s+/.test(code);
    const isProvider = /Provider|Context|createContext/i.test(code);
    if (hasJSX && !hasDefaultExport && !hasNamedExports && !isProvider && !/index\.(js|ts)/.test(rel)) {
      issues.push({ file: rel, message: 'Component file with JSX but no export', severity: 'error' });
    }

    // Check: import of a package not present in node_modules
    const importMatches = code.matchAll(/(?:import\s+.*?\s+from\s+|require\s*\(\s*)['"]([^./][^'"]*)['"]/g);
    for (const m of importMatches) {
      const pkg = m[1].split('/')[0].startsWith('@') ? m[1].split('/').slice(0, 2).join('/') : m[1].split('/')[0];
      const pkgDir = path.join(appDir, 'node_modules', pkg);
      if (!fs.existsSync(pkgDir) && !/^react$|^react-native$/.test(pkg)) {
        issues.push({ file: rel, message: `Import of missing package: ${pkg}`, severity: 'error' });
      }
    }

    // Check: .map/.filter/.forEach/.reduce on an expression that could be undefined
    // Pattern: someVar.map( where someVar is not guarded by || [] or ?? [] or ?.
    const mapRe = /\b(\w+)\.(?:map|filter|forEach|reduce|find|findIndex|some|every)\s*\(/g;
    for (const m of code.matchAll(mapRe)) {
      const varName = m[1];
      // Skip: React, styles, known-safe names, chained calls
      if (/^(React|Object|Array|Math|JSON|console|String|Number|styles|theme|colors|navigation|route|this|it|err|e|res|req)$/.test(varName)) continue;
      // Allow if preceded by `?.` (already safe) or `|| []` or `?? []`
      const before = code.slice(Math.max(0, code.indexOf(m[0]) - 20), code.indexOf(m[0]));
      if (before.includes('?.') || /\|\|\s*\[|\?\?\s*\[/.test(before)) continue;
      // Only warn if the var is declared from state/props/context (heuristic: useState, useContext, props., route.params)
      const statePattern = new RegExp(`const\\s+\\[?${varName}[,\\]]?\\s*=\\s*use(?:State|Context|Selector|Reducer)`, '');
      const paramsPattern = new RegExp(`(?:route\\.params|props).*\\.${varName}\\b`, '');
      if (statePattern.test(code) || paramsPattern.test(code)) {
        issues.push({ file: rel, message: `Unsafe array op: ${varName}.map/filter/etc — guard with (${varName} || [])`, severity: 'warning' });
      }
    }

    // Check: usage of catch {} (empty catch) — hides errors
    if (/\}\s*catch\s*\{\s*\}/.test(code)) {
      issues.push({ file: rel, message: 'Empty catch block hides runtime errors — use catch (e) {}', severity: 'warning' });
    }
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  log(`Static scan: ${files.length} files, ${issues.length} issues (${errorCount} errors)`);
  return { ok: errorCount === 0, files: files.length, issues };
}

// ── Phase 2: Bundle Check ─────────────────────────────────────────────────────

async function bundleCheck(appDir) {
  log('Bundle check...');
  const distDir = path.join(appDir, '.qa-bundle');
  try {
    const cleanEnv = { ...process.env, EXPO_NO_TELEMETRY: '1' };
    delete cleanEnv.CI;
    execSync(`npx expo export --output-dir "${distDir}" 2>&1`, {
      cwd: appDir, timeout: 60_000, stdio: 'pipe', encoding: 'utf8', env: cleanEnv,
    });
    return { ok: true, errors: [] };
  } catch (e) {
    const out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
    const errors = out.split('\n')
      .filter(l => /error|Error|SyntaxError|Cannot find|Unable to resolve|FAIL/i.test(l))
      .map(l => l.trim())
      .filter(l => l.length > 5)
      .slice(0, 15);
    return { ok: false, errors, raw: out.slice(-2000) };
  } finally {
    try { fs.rmSync(distDir, { recursive: true, force: true }); } catch {}
  }
}

// ── Phase 3: Runtime Check ────────────────────────────────────────────────────
// Launch app in simulator, capture Metro output, detect ANY error.

function getBootedSim() {
  const r = shell('xcrun simctl list devices booted -j');
  if (!r.ok) return null;
  try {
    const data = JSON.parse(r.stdout);
    for (const devs of Object.values(data.devices)) {
      for (const dev of devs) {
        if (dev.state === 'Booted') return dev;
      }
    }
  } catch {}
  return null;
}

function bootSim() {
  let sim = getBootedSim();
  if (sim) return sim;
  const r = shell('xcrun simctl list devices available -j');
  if (!r.ok) return null;
  try {
    const data = JSON.parse(r.stdout);
    for (const [runtime, devs] of Object.entries(data.devices)) {
      if (!runtime.includes('iOS')) continue;
      for (const dev of devs) {
        if (dev.name.includes('iPhone') && dev.isAvailable && dev.state === 'Shutdown') {
          shell(`xcrun simctl boot ${dev.udid}`);
          return dev;
        }
      }
    }
  } catch {}
  return null;
}

function takeScreenshot(sim, filepath) {
  shell(`xcrun simctl io ${sim.udid} screenshot "${filepath}"`);
  return fs.existsSync(filepath);
}

function parseMetroErrors(metroOutput) {
  const errors = [];
  const lines = metroOutput.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip noisy non-error lines
    if (/ExperimentalWarning|DeprecationWarning|npm warn|WARN\s+Possible Unhandled/i.test(line)) continue;

    // Catch ANY JavaScript error type
    const isJsError =
      /\b(TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError)\b:/.test(line) ||
      (/\bError\b:/.test(line) && !/ExperimentalWarning|DeprecationWarning|NetworkError/.test(line)) ||
      /Render Error|Invariant Violation|Cannot read prop|is not a function|is not defined|undefined is not an object|null is not an object|Maximum call stack/.test(line);

    if (isJsError) {
      let file = null, lineNum = null;
      for (let j = Math.max(0, i - 3); j < Math.min(lines.length, i + 10); j++) {
        const m = lines[j].match(/(?:at\s+|in\s+|from\s+)?(\S+\.(?:js|ts|jsx|tsx)):(\d+)/);
        if (m) { file = m[1]; lineNum = parseInt(m[2]); break; }
      }
      errors.push({
        message: line.trim().slice(0, 300),
        file: file || 'unknown',
        line: lineNum,
        raw: lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 8)).join('\n'),
      });
    }

    // Catch Metro ERROR log lines (not warnings)
    if (/^\s*ERROR\s+/i.test(line) && !/ExperimentalWarning|Warning:|WARN/i.test(line)) {
      const msg = line.replace(/^.*ERROR\s+/, '').trim();
      if (msg.length > 5) {
        let file = null;
        for (let j = i; j < Math.min(lines.length, i + 8); j++) {
          const m = lines[j].match(/(\S+\.(?:js|ts|jsx|tsx)):(\d+)/);
          if (m) { file = m[1]; break; }
        }
        errors.push({ message: msg.slice(0, 300), file: file || 'unknown', raw: lines.slice(i, i + 5).join('\n') });
      }
    }

    // Catch console.error lines — dev mode forwards these from the device
    // Format: " console.error: ..." or "LOG  [Error: ...]" or "ERROR  [Error: ...]"
    if (/console\.error\s*:/i.test(line) || /^\s*(LOG|ERROR)\s+\[Error:/i.test(line)) {
      const msg = line.replace(/^.*console\.error\s*:\s*/i, '').replace(/^\s*(LOG|ERROR)\s+/, '').trim();
      if (msg.length > 10 && !/VirtualizedList|setNativeProps|Each child|Encountered two children/.test(msg)) {
        let file = null;
        for (let j = i; j < Math.min(lines.length, i + 6); j++) {
          const m = lines[j].match(/(\S+\.(?:js|ts|jsx|tsx)):(\d+)/);
          if (m) { file = m[1]; break; }
        }
        errors.push({ message: `console.error: ${msg.slice(0, 250)}`, file: file || 'unknown', raw: lines.slice(i, i + 4).join('\n') });
      }
    }
  }

  // Deduplicate by first 80 chars of message
  const seen = new Set();
  return errors.filter(e => {
    const key = e.message.slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Phase 4: Visual Check ─────────────────────────────────────────────────────
// Detect error overlays in screenshots via pixel analysis.
// RN error overlays have a distinctive red banner — works for any app.

function screenshotHasErrorOverlay(filepath) {
  if (!fs.existsSync(filepath)) return false;

  // The RN error overlay has a VERY specific red: approximately #FF3B30 / #E74C3C
  // We check the top ~60px strip only (the error banner), and require a VERY high
  // concentration of this specific red to avoid false positives from dark themes,
  // red UI elements, or colored backgrounds.
  const tmp = `/tmp/qa-pixel-${Date.now()}`;
  try {
    execSync(`sips -c 60 400 -s format bmp "${filepath}" --out "${tmp}.bmp" 2>/dev/null`, { stdio: 'pipe' });
    const buf = fs.readFileSync(`${tmp}.bmp`);

    let errorRedPixels = 0, totalPixels = 0;
    for (let i = 54; i < buf.length - 2; i += 3) {
      totalPixels++;
      const b = buf[i], g = buf[i + 1], r = buf[i + 2];
      // RN error overlay red is specifically: R>220, G<80, B<80 (bright pure red)
      if (r > 220 && g < 80 && b < 80) errorRedPixels++;
    }

    // Require >25% of the top banner to be this specific error-red
    return totalPixels > 0 && (errorRedPixels / totalPixels) > 0.25;
  } catch { return false; }
  finally { try { fs.unlinkSync(`${tmp}.bmp`); } catch {} }
}

// ── Runtime Test ──────────────────────────────────────────────────────────────

async function runtimeTest(appDir, sim) {
  log('Runtime test...');

  // Kill stale processes
  shell(`lsof -ti:${QA_PORT} | xargs kill -9 2>/dev/null`, { timeout: 5000 });
  shell(`xcrun simctl terminate ${sim.udid} ${EXPO_GO_BUNDLE}`, { timeout: 5000 });
  await sleep(500);

  // Clear caches
  try {
    fs.rmSync(path.join(appDir, 'node_modules', '.cache'), { recursive: true, force: true });
    fs.rmSync(path.join(appDir, '.expo'), { recursive: true, force: true });
  } catch {}

  // Set a default location so location-dependent features don't hang
  shell(`xcrun simctl location ${sim.udid} set "37.7749,-122.4194"`, { timeout: 5000 });

  // Start Metro in dev mode so JS errors surface in logs and as red overlays.
  // --no-dev silently swallows runtime errors via the global error handler.
  let metroOutput = '';
  const env = { ...process.env, EXPO_NO_TELEMETRY: '1', EXPO_NO_DOTENV: '1' };
  delete env.CI;
  const proc = spawn('npx', ['expo', 'start', '--port', String(QA_PORT), '--clear'], {
    cwd: appDir, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout.on('data', d => { metroOutput += d.toString(); });
  proc.stderr.on('data', d => { metroOutput += d.toString(); });

  const kill = () => {
    try { proc.kill('SIGTERM'); } catch {}
    setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 3000);
  };

  // Wait for Metro ready
  log('Waiting for Metro...');
  const t0 = Date.now();
  let ready = false;
  for (let i = 0; i < 90; i++) {
    await sleep(1000);
    if (/Waiting on|Logs for your project/i.test(metroOutput)) { ready = true; break; }
    if (/Unable to resolve|Cannot find module/i.test(metroOutput)) break;
  }

  if (!ready) {
    kill();
    return { ok: false, errors: [{ message: 'Metro failed to start', file: 'unknown', raw: metroOutput.slice(-1000) }], screenshots: [] };
  }
  log(`Metro ready (${((Date.now() - t0) / 1000).toFixed(0)}s)`);

  // Launch app
  shell(`xcrun simctl openurl ${sim.udid} exp://localhost:${QA_PORT}`, { timeout: 10000 });

  // Wait for bundle delivery
  for (let i = 0; i < 45; i++) {
    await sleep(1000);
    if (/Bundled|index\.js/i.test(metroOutput)) break;
  }

  // Let the app settle
  log('Waiting for render...');
  await sleep(10000);

  // Dismiss any Expo Go modal
  const hasMaestro = shell('which maestro', { timeout: 3000 }).ok;
  if (hasMaestro) {
    const flowPath = path.join(appDir, '.qa-dismiss.yaml');
    fs.writeFileSync(flowPath, [
      `appId: ${EXPO_GO_BUNDLE}`,
      '---',
      '- swipe:',
      '    start: 50%, 40%',
      '    end: 50%, 95%',
      '- swipe:',
      '    start: 50%, 40%',
      '    end: 50%, 95%',
    ].join('\n') + '\n');
    shell(`maestro test "${flowPath}" 2>&1`, { timeout: 20000 });
    try { fs.unlinkSync(flowPath); } catch {}
    await sleep(2000);
  }

  // Collect Metro errors
  const errors = parseMetroErrors(metroOutput);

  // Screenshots
  const ssDir = path.join(appDir, 'qa-screenshots');
  try { fs.rmSync(ssDir, { recursive: true, force: true }); } catch {}
  fs.mkdirSync(ssDir, { recursive: true });

  const mainSS = path.join(ssDir, 'qa-main.png');
  takeScreenshot(sim, mainSS);

  if (screenshotHasErrorOverlay(mainSS)) {
    errors.push({ message: 'Error overlay detected on screen (red screen)', file: 'unknown', raw: 'Visual error overlay in qa-main.png' });
  }

  // Explore the app: tap around to trigger lazy-loaded screens
  if (hasMaestro) {
    log('Exploring app screens...');
    // Tap multiple positions across the bottom (common nav area) and center
    const tapPoints = [
      '10%, 95%', '30%, 95%', '50%, 95%', '70%, 95%', '90%, 95%', // bottom nav
      '50%, 50%',  // center
      '90%, 10%',  // top-right (common settings/menu)
    ];

    for (let i = 0; i < tapPoints.length; i++) {
      const flowPath = path.join(appDir, `.qa-explore-${i}.yaml`);
      fs.writeFileSync(flowPath, [
        `appId: ${EXPO_GO_BUNDLE}`,
        '---',
        `- tapOn:`,
        `    point: "${tapPoints[i]}"`,
      ].join('\n') + '\n');
      shell(`maestro test "${flowPath}" 2>&1`, { timeout: 10000 });
      try { fs.unlinkSync(flowPath); } catch {}
      await sleep(1500);

      // Check for new errors after each tap
      const newErrors = parseMetroErrors(metroOutput).filter(ne =>
        !errors.some(e => e.message.slice(0, 80) === ne.message.slice(0, 80))
      );
      if (newErrors.length > 0) {
        log(`  Error after tap ${tapPoints[i]}: ${newErrors[0].message.slice(0, 60)}`);
        errors.push(...newErrors);
      }

      // Screenshot after each bottom nav tap
      if (i < 5) {
        const ss = path.join(ssDir, `qa-explore-${i}.png`);
        takeScreenshot(sim, ss);
        if (screenshotHasErrorOverlay(ss)) {
          errors.push({ message: `Error overlay after exploring position ${tapPoints[i]}`, file: 'unknown' });
        }
      }
    }
  }

  // Final screenshot
  const finalSS = path.join(ssDir, 'qa-final.png');
  takeScreenshot(sim, finalSS);
  if (screenshotHasErrorOverlay(finalSS)) {
    if (!errors.some(e => e.message.includes('Error overlay'))) {
      errors.push({ message: 'Error overlay on final screenshot', file: 'unknown' });
    }
  }

  kill();
  await sleep(1000);

  // Collect all screenshots
  const screenshots = fs.readdirSync(ssDir).filter(f => f.endsWith('.png')).map(f => path.join(ssDir, f));

  return { ok: errors.length === 0, errors, screenshots, metroOutput: metroOutput.slice(-3000) };
}

// ── Auto-Fix ──────────────────────────────────────────────────────────────────

async function autoFix(appDir, errors, opts = {}) {
  const model = opts.model || 'google/gemini-2.0-flash-001';
  let fixed = 0;

  for (const error of errors) {
    // Find the source file — search broadly, no hardcoded paths
    let filePath = null;
    if (error.file && error.file !== 'unknown') {
      const basename = path.basename(error.file);
      const allFiles = findAllSourceFiles(appDir);
      filePath = allFiles.find(f => f.endsWith(error.file)) ||
                 allFiles.find(f => path.basename(f) === basename);
    }

    if (!filePath) {
      // Try to extract a filename from the error message
      const fnMatch = error.message.match(/(?:in|at|from)\s+(\w+\.(?:js|ts|jsx|tsx))/i) ||
                      error.raw?.match(/(\w+\.(?:js|ts|jsx|tsx)):(\d+)/);
      if (fnMatch) {
        const allFiles = findAllSourceFiles(appDir);
        filePath = allFiles.find(f => path.basename(f) === fnMatch[1]);
      }
    }

    if (!filePath) {
      log(`  Cannot locate file for: ${error.message.slice(0, 60)}`);
      continue;
    }

    const code = fs.readFileSync(filePath, 'utf8');
    const relPath = path.relative(appDir, filePath);

    const prompt = `Fix this React Native / Expo error. Output ONLY the complete fixed file. No markdown, no explanation, nothing before or after the code.

ERROR: ${error.message}
${error.raw ? `CONTEXT:\n${error.raw}` : ''}
${error.line ? `LINE: ${error.line}` : ''}

FILE: ${relPath}
\`\`\`
${code}
\`\`\`

RULES:
- Output the COMPLETE file. No truncation. Never end mid-expression, mid-object, or mid-StyleSheet.
- Fix the specific error. Do not simplify or remove features.
- If "Import of missing package: X": remove the import and replace all usage with inline alternatives.
- ARRAY SAFETY: All .map()/.filter()/.forEach()/.reduce() on state/context data must use (arr || []).map(...).
- OPTIONAL CHAINING: All property access on state/context/params must use ?. and ?? fallbacks.
- DATE SAFETY: const d = new Date(x); const safe = isNaN(d.getTime()) ? new Date() : d; — always before formatDistanceToNow / format.
- NAVIGATION PARAMS: const { id } = route?.params ?? {}; — always guard params.
- Do NOT add new package imports — only use what is already imported.
- Never write catch {} — always catch (e) { console.error(e); }.
- FUNCTION GUARDS: onPress?.() or if (typeof fn === 'function') fn() before calling any callback from props/state.`;

    try {
      let result = await chat([{ role: 'user', content: prompt }], {
        model, temperature: 0.2, max_tokens: 8000, timeout: 60_000,
      });

      result = result.replace(/^```(?:\w+)?\n?/m, '').replace(/\n?```\s*$/m, '').trim();
      result = result.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');

      if (result.length > 80 && (result.includes('export') || result.includes('module.exports'))) {
        fs.writeFileSync(filePath, result, 'utf8');
        log(`  Fixed: ${relPath}`);
        fixed++;
      } else {
        log(`  Fix output invalid for ${relPath}, skipping`);
      }
    } catch (e) {
      log(`  Fix failed for ${relPath}: ${e.message.slice(0, 80)}`);
    }
  }

  return fixed;
}

// ── Full QA Pipeline ──────────────────────────────────────────────────────────

async function runQA(appDir, opts = {}) {
  const autofix = opts.autofix !== false;
  const model = opts.model || 'google/gemini-2.0-flash-001';
  const onProgress = opts.onProgress || (() => {});
  const t0 = Date.now();

  const results = {
    rounds: [],
    staticOk: false,
    bundleOk: false,
    runtimeOk: false,
    errors: [],
    screenshots: [],
    fixesApplied: 0,
    ok: false,
  };

  // Phase 1: Static scan
  onProgress('Scanning source files...');
  const scan = staticScan(appDir);
  results.staticOk = scan.ok;
  if (!scan.ok) {
    const criticalIssues = scan.issues.filter(i => i.severity === 'error');
    log(`Static scan found ${criticalIssues.length} critical issue(s)`);

    if (autofix && criticalIssues.length > 0) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const toFix = (attempt === 0 ? criticalIssues : staticScan(appDir).issues.filter(i => i.severity === 'error'));
        if (toFix.length === 0) break;
        const count = await autoFix(appDir, toFix.map(i => ({
          message: i.message, file: i.file,
        })), { model });
        results.fixesApplied += count;
        if (count === 0) break;
      }

      const scan2 = staticScan(appDir);
      results.staticOk = scan2.ok;
      if (!scan2.ok) {
        for (const issue of scan2.issues.filter(i => i.severity === 'error')) {
          results.errors.push({ message: issue.message, file: issue.file, phase: 'static' });
        }
      }
    } else {
      for (const issue of criticalIssues) {
        results.errors.push({ message: issue.message, file: issue.file, phase: 'static' });
      }
    }
  }

  // Phase 2: Bundle check
  onProgress('Checking bundle...');
  const bc = await bundleCheck(appDir);
  results.bundleOk = bc.ok;

  if (!bc.ok) {
    log(`Bundle FAILED`);
    for (const err of bc.errors) {
      results.errors.push({ message: err, phase: 'bundle' });
    }

    if (autofix) {
      for (const err of bc.errors) {
        const fMatch = err.match(/(?:from\s+|in\s+)['"]?(\S+\.(?:js|ts|jsx|tsx))/);
        if (fMatch) {
          const count = await autoFix(appDir, [{ message: err, file: fMatch[1] }], { model });
          results.fixesApplied += count;
        }
      }
      const bc2 = await bundleCheck(appDir);
      results.bundleOk = bc2.ok;
      if (!bc2.ok) {
        results.duration = ((Date.now() - t0) / 1000).toFixed(1);
        return results;
      }
      results.errors = results.errors.filter(e => e.phase !== 'bundle');
    } else {
      results.duration = ((Date.now() - t0) / 1000).toFixed(1);
      return results;
    }
  }
  log('Bundle OK');

  // Phase 3+4: Runtime + visual check with fix loop
  const sim = bootSim();
  if (!sim) {
    log('No simulator available — marking runtime as SKIPPED (not OK)');
    results.runtimeOk = false;
    results.runtimeSkipped = true;
    results.errors.push({ message: 'No iOS simulator available for runtime testing', phase: 'runtime' });
    results.ok = false;
    results.duration = ((Date.now() - t0) / 1000).toFixed(1);
    return results;
  }

  const maxRounds = autofix ? MAX_FIX_ROUNDS : 1;
  for (let round = 0; round < maxRounds; round++) {
    onProgress(round === 0 ? 'Testing in simulator...' : `Fix round ${round + 1}...`);
    log(`Runtime round ${round + 1}/${maxRounds}...`);

    const rt = await runtimeTest(appDir, sim);

    results.rounds.push({
      round: round + 1,
      ok: rt.ok,
      errorCount: rt.errors.length,
      errors: rt.errors.map(e => e.message.slice(0, 120)),
    });
    results.screenshots = rt.screenshots || [];

    if (rt.ok) {
      log(`Runtime CLEAN (round ${round + 1})`);
      results.runtimeOk = true;
      break;
    }

    if (!autofix || round >= maxRounds - 1) {
      results.errors.push(...rt.errors.map(e => ({ ...e, phase: 'runtime' })));
      break;
    }

    // Auto-fix
    log(`${rt.errors.length} runtime error(s) — fixing...`);
    const count = await autoFix(appDir, rt.errors, { model });
    results.fixesApplied += count;

    // Re-check bundle after fix
    const bc3 = await bundleCheck(appDir);
    if (!bc3.ok) {
      log('Fix broke the bundle');
      results.errors.push(...bc3.errors.map(e => ({ message: e, phase: 'bundle-after-fix' })));
      break;
    }
  }

  results.ok = results.bundleOk && results.runtimeOk && results.errors.length === 0;
  results.duration = ((Date.now() - t0) / 1000).toFixed(1);

  log(`QA done in ${results.duration}s — ${results.ok ? 'PASS' : 'FAIL'} (${results.fixesApplied} fixes applied)`);
  return results;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const appDir = process.argv[2];
  const doFix = process.argv.includes('--fix');
  const bundleOnly = process.argv.includes('--bundle-only');

  if (!appDir || !fs.existsSync(appDir)) {
    console.error('Usage: runtime-qa.js <appDir> [--fix] [--bundle-only]');
    process.exit(1);
  }

  if (bundleOnly) {
    const bc = await bundleCheck(appDir);
    console.log(JSON.stringify(bc, null, 2));
    process.exit(bc.ok ? 0 : 1);
  }

  const results = await runQA(appDir, { autofix: doFix });
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.ok ? 0 : 1);
}

if (require.main === module) {
  main().catch(e => { log(`Fatal: ${e.message}`); process.exit(1); });
}

module.exports = { runQA, bundleCheck, staticScan };
