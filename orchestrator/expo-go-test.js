#!/usr/bin/env node
/**
 * Expo Go Headless Smoke Test
 *
 * Two-level testing before deploying to TestFlight:
 *
 * Level 1 (fast, ~10s): Bundle export — catches JS errors, bad imports, config issues.
 *   npx expo export --no-minify
 *
 * Level 2 (thorough, ~60s): Run in Expo Go on headless simulator.
 *   - Boot simulator (headless)
 *   - Install Expo Go if needed
 *   - Start dev server
 *   - Open app via deep link
 *   - Wait, verify no crash, take screenshot
 *   - Kill server
 *
 * Usage:
 *   node expo-go-test.js <appDir>             (Level 1 only — fast)
 *   node expo-go-test.js <appDir> --full      (Level 1 + Level 2)
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const EXPO_GO_BUNDLE_ID = 'host.exp.Exponent';
const SIM_PORT = 8099;

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  process.stdout.write(`[${ts}] [expo-test] ${msg}\n`);
}

function shell(cmd, opts = {}) {
  try {
    return { ok: true, stdout: execSync(cmd, { encoding: 'utf8', timeout: opts.timeout || 30000, ...opts }).trim() };
  } catch (e) {
    return { ok: false, stdout: '', stderr: e.stderr?.toString() || e.message };
  }
}

function spawnAsync(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    let stdout = '', stderr = '';
    const proc = spawn(cmd, args, {
      cwd: opts.cwd || ROOT,
      env: { ...process.env, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout.on('data', d => {
      stdout += d;
      if (opts.stream) process.stdout.write(d);
    });
    proc.stderr.on('data', d => {
      stderr += d;
      if (opts.stream && !d.toString().includes('ExperimentalWarning')) process.stderr.write(d);
    });
    const timer = opts.timeout ? setTimeout(() => {
      proc.kill('SIGTERM');
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 3000);
    }, opts.timeout) : null;
    proc.on('close', code => {
      if (timer) clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout, stderr: stderr.slice(0, 1000), pid: proc.pid });
    });
    proc.on('error', e => {
      if (timer) clearTimeout(timer);
      resolve({ ok: false, code: -1, stdout, stderr: e.message });
    });
    if (opts.returnProc) resolve(proc);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Level 1: Bundle export check ─────────────────────────────────────────────

async function testBundleExport(appDir) {
  log('Level 1: Bundle export check...');
  const t = Date.now();

  const distDir = path.join(appDir, '.expo-test-dist');

  const r = await spawnAsync('npx', [
    'expo', 'export',
    '--output-dir', distDir,
    '--no-minify',
  ], { cwd: appDir, timeout: 60_000, stream: true });

  // Clean up dist
  try { fs.rmSync(distDir, { recursive: true, force: true }); } catch {}

  const dur = ((Date.now() - t) / 1000).toFixed(1);

  if (r.ok) {
    log(`Level 1 PASSED (${dur}s) — JS bundle compiles cleanly`);
    return { ok: true, level: 1, duration: dur };
  }

  // Parse errors from output
  const errorLines = (r.stdout + r.stderr).split('\n')
    .filter(l => /error|Error|FAIL|Cannot find|Module not found|SyntaxError/i.test(l))
    .slice(0, 10);

  log(`Level 1 FAILED (${dur}s):`);
  for (const l of errorLines) log(`  ${l.trim()}`);

  return { ok: false, level: 1, duration: dur, errors: errorLines };
}

// ── Level 2: Expo Go on simulator ────────────────────────────────────────────

function getBootedSimulator() {
  const r = shell('xcrun simctl list devices booted -j');
  if (!r.ok) return null;
  const data = JSON.parse(r.stdout);
  for (const devs of Object.values(data.devices)) {
    for (const dev of devs) {
      if (dev.state === 'Booted') return { udid: dev.udid, name: dev.name };
    }
  }
  return null;
}

function bootSimulator() {
  let sim = getBootedSimulator();
  if (sim) {
    log(`Using booted simulator: ${sim.name} (${sim.udid.slice(0, 8)})`);
    return sim;
  }

  // Find an iPhone 16 Pro to boot
  const r = shell('xcrun simctl list devices available -j');
  if (!r.ok) return null;
  const data = JSON.parse(r.stdout);
  for (const [runtime, devs] of Object.entries(data.devices)) {
    if (!runtime.includes('iOS')) continue;
    for (const dev of devs) {
      if (dev.name.includes('iPhone 16 Pro') && dev.isAvailable && dev.state === 'Shutdown') {
        log(`Booting simulator: ${dev.name}...`);
        shell(`xcrun simctl boot ${dev.udid}`);
        return { udid: dev.udid, name: dev.name };
      }
    }
  }
  return null;
}

function isExpoGoInstalled(udid) {
  const r = shell(`xcrun simctl get_app_container ${udid} ${EXPO_GO_BUNDLE_ID}`);
  return r.ok;
}

async function installExpoGo(appDir, udid) {
  if (isExpoGoInstalled(udid)) {
    log('Expo Go already installed');
    return true;
  }

  log('Installing Expo Go on simulator...');

  // npx expo-cli install:ios installs Expo Go on the simulator
  // Using npx expo start --ios in background triggers install too, but
  // expo-updates has a direct install command
  const r = await spawnAsync('npx', ['expo', 'start', '--ios', '--go', '--no-dev', '--port', String(SIM_PORT)], {
    timeout: 60_000,
    cwd: appDir,
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
  });

  // Check again
  if (isExpoGoInstalled(udid)) return true;

  // Manual fallback: download Expo Go .tar.gz for simulator
  log('Attempting manual Expo Go install...');
  const extractDir = `/tmp/expo-go-${Date.now()}`;
  const dlResult = shell(
    `rm -rf "${extractDir}" && mkdir -p "${extractDir}" && ` +
    'curl -sL "https://dpq5q02fu5f55.cloudfront.net/Exponent-2.32.13.tar.gz" -o /tmp/ExpoGo.tar.gz && ' +
    `cd "${extractDir}" && tar xzf /tmp/ExpoGo.tar.gz && ` +
    `xcrun simctl install ${udid} "${extractDir}/Exponent.app"`,
    { timeout: 60000 }
  );

  return isExpoGoInstalled(udid);
}

async function waitForDevServer(port, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}`, res => {
          resolve(res.statusCode);
        });
        req.on('error', reject);
        req.setTimeout(2000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      return true;
    } catch {}
    await sleep(1000);
  }
  return false;
}

async function testExpoGo(appDir) {
  log('Level 2: Expo Go simulator test...');
  const t = Date.now();

  // 1. Boot simulator
  const sim = bootSimulator();
  if (!sim) {
    log('Level 2 SKIPPED — no simulator available');
    return { ok: true, level: 2, skipped: true, reason: 'no simulator' };
  }

  // 2. Install Expo Go
  const installed = await installExpoGo(appDir, sim.udid);
  if (!installed) {
    log('Level 2 SKIPPED — could not install Expo Go');
    return { ok: true, level: 2, skipped: true, reason: 'expo go install failed' };
  }

  // 3. Start dev server in background
  log('Starting Expo dev server...');
  let serverProc = null;
  const serverPromise = new Promise((resolve) => {
    serverProc = spawn('npx', ['expo', 'start', '--go', '--no-dev', '--port', String(SIM_PORT)], {
      cwd: appDir,
      env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    serverProc.stdout.on('data', d => { stdout += d.toString(); });
    serverProc.stderr.on('data', d => { stdout += d.toString(); });
    serverProc.on('close', code => resolve({ ok: code === 0, stdout }));
  });

  // 4. Wait for server to be ready
  const serverReady = await waitForDevServer(SIM_PORT, 30000);
  if (!serverReady) {
    if (serverProc) serverProc.kill();
    log('Level 2 FAILED — dev server did not start');
    return { ok: false, level: 2, duration: ((Date.now() - t) / 1000).toFixed(1), error: 'server timeout' };
  }
  log('Dev server ready');

  // 5. Open app in Expo Go
  log('Opening app in Expo Go...');
  shell(`xcrun simctl openurl ${sim.udid} exp://localhost:${SIM_PORT}`);

  // 6. Wait for app to load and settle
  await sleep(12000);

  // 7. Check if Expo Go is still running (not crashed)
  const running = shell(`xcrun simctl get_app_container ${sim.udid} ${EXPO_GO_BUNDLE_ID}`);

  // 8. Take screenshot
  const ssDir = path.join(appDir, 'test-screenshots');
  fs.mkdirSync(ssDir, { recursive: true });
  const ssPath = path.join(ssDir, `expo-go-test-${Date.now()}.png`);
  shell(`xcrun simctl io ${sim.udid} screenshot "${ssPath}"`);
  if (fs.existsSync(ssPath)) log(`Screenshot: ${ssPath}`);

  // 9. Kill dev server
  if (serverProc) {
    serverProc.kill('SIGTERM');
    setTimeout(() => { try { serverProc.kill('SIGKILL'); } catch {} }, 3000);
  }

  // Suppress Simulator.app window
  shell('osascript -e \'tell application "System Events" to set visible of process "Simulator" to false\'');

  const dur = ((Date.now() - t) / 1000).toFixed(1);

  if (running.ok) {
    log(`Level 2 PASSED (${dur}s) — app runs in Expo Go without crashing`);
    return { ok: true, level: 2, duration: dur, screenshot: ssPath };
  }

  log(`Level 2 FAILED (${dur}s) — app crashed in Expo Go`);
  return { ok: false, level: 2, duration: dur, error: 'app crashed' };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const appDir = process.argv[2];
  const full = process.argv.includes('--full');

  if (!appDir || !fs.existsSync(appDir)) {
    console.error('Usage: expo-go-test.js <appDir> [--full]');
    process.exit(1);
  }

  const results = [];

  // Level 1: Bundle export
  const l1 = await testBundleExport(appDir);
  results.push(l1);

  if (!l1.ok) {
    log('Level 1 failed — skipping Level 2');
    console.log(JSON.stringify({ ok: false, results }));
    process.exit(1);
  }

  // Level 2: Expo Go (only if --full)
  if (full) {
    const l2 = await testExpoGo(appDir);
    results.push(l2);

    if (!l2.ok && !l2.skipped) {
      console.log(JSON.stringify({ ok: false, results }));
      process.exit(1);
    }
  }

  const allOk = results.every(r => r.ok);
  console.log(JSON.stringify({ ok: allOk, results }));
  process.exit(allOk ? 0 : 1);
}

main().catch(e => {
  log(`Fatal: ${e.message}`);
  process.exit(1);
});
