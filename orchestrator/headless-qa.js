#!/usr/bin/env node
/**
 * Headless QA v3 — uses iOS simulator via simctl without interference.
 *
 * Key insight: xcrun simctl commands work without the simulator window
 * being visible. We boot the simulator, immediately hide its window,
 * then run all testing via simctl. No window visible, no focus steal.
 *
 * Usage:
 *   node headless-qa.js <appDir>
 *   node headless-qa.js <appDir> --quick      (faster, fewer screens)
 *   node headless-qa.js <appDir> --no-auto     (don't auto-dismiss modals)
 */

require('./lib/env').loadEnv();

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const QA_PORT = 8099;
const EXPO_GO_BUNDLE = 'host.exp.Exponent';
const MAX_METRO_WAIT = 90;
const RENDER_WAIT_MS = 10000;
const SCREENSHOT_WAIT_MS = 1500;

function log(msg) { process.stdout.write(`[headless-qa] ${msg}\n`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function shell(cmd, opts = {}) {
  try {
    return { ok: true, stdout: execSync(cmd, { encoding: 'utf8', timeout: opts.timeout || 30000, stdio: 'pipe' }).trim() };
  } catch (e) {
    return { ok: false, stdout: '', stderr: (e.stderr?.toString() || e.message || '').slice(0, 500) };
  }
}

// ── Simulator Management ───────────────────────────────────────────────

function getAvailableSim() {
  const r = shell('xcrun simctl list devices available -j');
  if (!r.ok) return null;
  try {
    const data = JSON.parse(r.stdout);
    for (const [runtime, devs] of Object.entries(data.devices)) {
      if (!runtime.includes('iOS')) continue;
      for (const dev of devs) {
        if (dev.name.includes('iPhone') && dev.isAvailable && dev.state === 'Shutdown') {
          return dev;
        }
      }
    }
  } catch {}
  return null;
}

function bootSimQuiet(sim) {
  // Boot without opening a visible window by backgrounding Simulator.app
  shell(`xcrun simctl boot ${sim.udid}`, { timeout: 30000 });

  // Wait for boot state
  for (let i = 0; i < 30; i++) {
    const status = shell(`xcrun simctl list devices | grep "${sim.udid}"`, { timeout: 5000 });
    if (status.ok && status.stdout.includes('Booted')) {
      // Hide the simulator window immediately
      shell(`osascript -e 'tell application "Simulator" to set miniaturized of window 1 to true' 2>/dev/null`, { timeout: 5000 });
      log(`Simulator booted & hidden: ${sim.name}`);
      return true;
    }
    execSync('sleep 1', { stdio: 'pipe' });
  }
  return false;
}

function shutdownSim(sim) {
  shell(`xcrun simctl shutdown ${sim.udid}`, { timeout: 15000 });
  try { shell('killall "Simulator" 2>/dev/null', { timeout: 5000 }); } catch {}
}

function simScreenshot(sim, filepath) {
  shell(`xcrun simctl io ${sim.udid} screenshot "${filepath}"`, { timeout: 15000 });
  return fs.existsSync(filepath);
}

// ── Metro Error Parsing ────────────────────────────────────────────────

function parseMetroErrors(output) {
  const errors = [];
  const lines = output.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/ExperimentalWarning|DeprecationWarning|npm warn/i.test(line)) continue;

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
  }

  // Deduplicate
  const seen = new Set();
  return errors.filter(e => {
    const key = e.message.slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Screenshot Error Detection ─────────────────────────────────────────

function screenshotHasErrorOverlay(filepath) {
  if (!fs.existsSync(filepath)) return false;
  const tmp = `/tmp/qa-pixel-${Date.now()}`;
  try {
    execSync(`sips -c 60 400 -s format bmp "${filepath}" --out "${tmp}.bmp" 2>/dev/null`, { stdio: 'pipe' });
    const buf = fs.readFileSync(`${tmp}.bmp`);
    let errorRedPixels = 0, totalPixels = 0;
    for (let i = 54; i < buf.length - 2; i += 3) {
      totalPixels++;
      const b = buf[i], g = buf[i + 1], r = buf[i + 2];
      if (r > 220 && g < 80 && b < 80) errorRedPixels++;
    }
    return totalPixels > 0 && (errorRedPixels / totalPixels) > 0.25;
  } catch { return false; }
  finally { try { fs.unlinkSync(`${tmp}.bmp`); } catch {} }
}

// ── Runtime Test ───────────────────────────────────────────────────────

async function runtimeTest(appDir, sim) {
  log('Runtime test...');

  // Clean up
  shell(`lsof -ti:${QA_PORT} | xargs kill -9 2>/dev/null`, { timeout: 5000 });
  shell(`xcrun simctl terminate ${sim.udid} ${EXPO_GO_BUNDLE}`, { timeout: 5000 });
  await sleep(500);

  try {
    fs.rmSync(path.join(appDir, 'node_modules', '.cache'), { recursive: true, force: true });
    fs.rmSync(path.join(appDir, '.expo'), { recursive: true, force: true });
  } catch {}

  // Start Metro
  let metroOutput = '';
  const env = { ...process.env, EXPO_NO_TELEMETRY: '1', EXPO_NO_DOTENV: '1' };
  delete env.CI;

  const proc = spawn('npx', ['expo', 'start', '--port', String(QA_PORT), '--clear'], {
    cwd: appDir, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout.on('data', d => { metroOutput += d.toString(); });
  proc.stderr.on('data', d => { metroOutput += d.toString(); });

  const killMetro = () => {
    try { proc.kill('SIGTERM'); } catch {}
    setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 3000);
    shell(`lsof -ti:${QA_PORT} | xargs kill -9 2>/dev/null`, { timeout: 3000 });
  };

  // Wait for Metro
  log('Waiting for Metro...');
  let ready = false;
  for (let i = 0; i < MAX_METRO_WAIT; i++) {
    await sleep(1000);
    if (/Waiting on|Logs for your project/i.test(metroOutput)) { ready = true; break; }
    if (/Unable to resolve|Cannot find module/i.test(metroOutput)) break;
  }

  if (!ready) {
    killMetro();
    return { ok: false, errors: [{ message: 'Metro failed to start', file: 'unknown', raw: metroOutput.slice(-1000) }], screenshots: [] };
  }
  log('Metro ready');

  // Launch app
  shell(`xcrun simctl openurl ${sim.udid} exp://localhost:${QA_PORT}`, { timeout: 10000 });

  // Wait for bundle
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    if (/Bundled|index\.js/i.test(metroOutput)) break;
  }

  log('Waiting for render...');
  await sleep(RENDER_WAIT_MS);

  // Dismiss modals by tapping center
  shell(`xcrun simctl io ${sim.udid} tap 187 422`, { timeout: 5000 });
  await sleep(2000);

  // Collect errors
  const errors = parseMetroErrors(metroOutput);

  // Screenshots
  const ssDir = path.join(appDir, 'qa-screenshots');
  try { fs.rmSync(ssDir, { recursive: true, force: true }); } catch {}
  fs.mkdirSync(ssDir, { recursive: true });

  const mainSS = path.join(ssDir, 'qa-main.png');
  simScreenshot(sim, mainSS);
  await sleep(SCREENSHOT_WAIT_MS);

  if (screenshotHasErrorOverlay(mainSS)) {
    errors.push({ message: 'Red error overlay detected', file: 'unknown' });
  }

  // Explore tab bar — tap across the bottom
  const tapPoints = [
    { x: 50, y: 760, label: 'tab1' },
    { x: 120, y: 760, label: 'tab2' },
    { x: 195, y: 760, label: 'tab3' },
    { x: 270, y: 760, label: 'tab4' },
    { x: 340, y: 760, label: 'tab5' },
  ];

  for (let i = 0; i < tapPoints.length; i++) {
    const { x, y, label } = tapPoints[i];
    shell(`xcrun simctl io ${sim.udid} tap ${x} ${y}`, { timeout: 5000 });
    await sleep(SCREENSHOT_WAIT_MS);

    const ss = path.join(ssDir, `qa-${label}.png`);
    simScreenshot(sim, ss);

    if (screenshotHasErrorOverlay(ss)) {
      errors.push({ message: `Error overlay at ${label}`, file: 'unknown' });
    }

    // Check for new Metro errors
    const newErrors = parseMetroErrors(metroOutput).filter(ne =>
      !errors.some(e => e.message.slice(0, 80) === ne.message.slice(0, 80))
    );
    if (newErrors.length > 0) {
      log(`  Error after ${label}: ${newErrors[0].message.slice(0, 60)}`);
      errors.push(...newErrors);
    }
  }

  // Keep metroOutput for inspection
  const finalSS = path.join(ssDir, 'qa-final.png');
  simScreenshot(sim, finalSS);

  killMetro();
  await sleep(500);

  const screenshots = fs.readdirSync(ssDir).filter(f => f.endsWith('.png')).map(f => path.join(ssDir, f));

  return {
    ok: errors.length === 0,
    errors,
    screenshots,
    metroOutput: metroOutput.slice(-2000),
  };
}

// ── Static Scan ────────────────────────────────────────────────────────

function findAllSourceFiles(appDir) {
  const files = [];
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '.expo') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (/\.(js|jsx|ts|tsx)$/.test(e.name) && !e.name.includes('.test.')) files.push(full);
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

    // Missing exports
    const hasJSX = /<\w/.test(code);
    const hasDefaultExport = /export\s+default\s+|module\.exports\s*=/.test(code);
    const hasNamedExports = /export\s+(const|function|class)\s+/.test(code);
    const isProvider = /Provider|Context|createContext/i.test(code);
    if (hasJSX && !hasDefaultExport && !hasNamedExports && !isProvider && !/index\.(js|ts)/.test(rel)) {
      issues.push({ file: rel, message: 'Component with JSX but no export', severity: 'error' });
    }

    // Missing packages
    const importMatches = code.matchAll(/(?:import\s+.*?\s+from\s+|require\s*\(\s*)['"]([^./][^'"]*)['"]/g);
    for (const m of importMatches) {
      const pkg = m[1].split('/')[0].startsWith('@') ? m[1].split('/').slice(0, 2).join('/') : m[1].split('/')[0];
      if (!fs.existsSync(path.join(appDir, 'node_modules', pkg)) && !/^react$|^react-native$/.test(pkg)) {
        issues.push({ file: rel, message: `Import of missing package: ${pkg}`, severity: 'error' });
      }
    }

    // Unsafe array ops on state/context data
    const mapRe = /\b(\w+)\.(?:map|filter|forEach|reduce|find|findIndex|some|every)\s*\(/g;
    for (const m of code.matchAll(mapRe)) {
      const varName = m[1];
      if (/^(React|Object|Array|Math|JSON|console|String|Number|styles|theme|colors|navigation|route|this|it|err|e|res|req)$/.test(varName)) continue;
      const before = code.slice(Math.max(0, code.indexOf(m[0]) - 20), code.indexOf(m[0]));
      if (before.includes('?.') || /\|\|\s*\[|\?\?\s*\[/.test(before)) continue;
      // Heuristic: check if var comes from state/props/context
      const statePattern = new RegExp(`const\\s+\\[?${varName}[,\\]]?\\s*=\\s*use(?:State|Context|Selector|Reducer)`, '');
      const paramsPattern = new RegExp(`(?:route\\.params|props).*\\.${varName}\\b`, '');
      if (statePattern.test(code) || paramsPattern.test(code)) {
        issues.push({ file: rel, message: `Unsafe: ${varName}.map/filter — guard with (${varName} || [])`, severity: 'warning' });
      }
    }

    // Empty catch blocks
    if (/\}\s*catch\s*\{\s*\}/.test(code)) {
      issues.push({ file: rel, message: 'Empty catch block hides errors', severity: 'warning' });
    }
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  log(`Static: ${files.length} files, ${issues.length} issues (${errorCount} errors)`);
  return { ok: errorCount === 0, files: files.length, issues };
}

// ── Bundle Check ───────────────────────────────────────────────────────

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
      .map(l => l.trim()).filter(l => l.length > 5).slice(0, 15);
    return { ok: false, errors, raw: out.slice(-2000) };
  } finally {
    try { fs.rmSync(distDir, { recursive: true, force: true }); } catch {}
  }
}

// ── Full QA Pipeline ───────────────────────────────────────────────────

async function runHeadlessQA(appDir, opts = {}) {
  const quickMode = opts.quick || false;
  const t0 = Date.now();

  log(`QA: ${path.basename(appDir)}${quickMode ? ' (quick)' : ''}`);

  // Phase 1: Static
  const scan = staticScan(appDir);
  const staticErrors = (scan.issues || [])
    .filter(i => i.severity === 'error')
    .map(i => ({ message: `${i.file}: ${i.message}`, type: 'static' }));

  // Phase 2: Bundle
  const bundle = await bundleCheck(appDir);
  const bundleErrors = (bundle.errors || []).map(m => ({ message: m, type: 'bundle' }));

  // Phase 3: Runtime (only if static+bundle pass, or in strict mode)
  let runtimeResult = null;
  const preflightOk = staticErrors.length === 0 && bundle.ok;

  if (preflightOk || !quickMode) {
    const sim = getAvailableSim();
    if (sim && bootSimQuiet(sim)) {
      try {
        runtimeResult = await runtimeTest(appDir, sim);
      } finally {
        shutdownSim(sim);
      }
    } else {
      runtimeResult = { ok: false, errors: [{ message: 'No iOS simulator available', type: 'simulator' }], screenshots: [] };
    }
  }

  const allErrors = [
    ...staticErrors,
    ...bundleErrors,
    ...(runtimeResult?.errors || []),
  ];

  return {
    ok: allErrors.length === 0,
    phase: allErrors.length === 0 ? 'done' : (runtimeResult ? 'runtime' : 'preflight'),
    staticOk: staticErrors.length === 0,
    bundleOk: bundle.ok,
    runtimeOk: runtimeResult?.ok ?? null,
    errors: allErrors,
    screenshots: runtimeResult?.screenshots || [],
    duration: Date.now() - t0,
    appDir,
  };
}

// ── CLI ────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  if (!args[0]) { console.log('Usage: node headless-qa.js <appDir> [--quick]'); process.exit(0); }

  runHeadlessQA(path.resolve(args[0]), { quick: args.includes('--quick') }).then(r => {
    console.log(JSON.stringify({
      ok: r.ok,
      phase: r.phase,
      staticOk: r.staticOk,
      bundleOk: r.bundleOk,
      runtimeOk: r.runtimeOk,
      errors: r.errors.map(e => e.message).slice(0, 10),
      screenshots: r.screenshots.length,
      duration: `${(r.duration / 1000).toFixed(0)}s`,
    }, null, 2));
    process.exit(r.ok ? 0 : 1);
  });
}

module.exports = { runHeadlessQA };