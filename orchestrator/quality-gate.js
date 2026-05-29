#!/usr/bin/env node
/**
 * Unified quality gate for build/edit/preview/deploy.
 *
 * Modes:
 * - strict: static + bundle + runtime (full runQA)
 * - preflight: static + bundle only
 */

const { runQA, staticScan, bundleCheck } = require('./runtime-qa');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function exec(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    let stdout = '', stderr = '';
    const proc = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 3000);
    }, opts.timeout || 180_000);
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr: stderr.slice(0, 2000) });
    });
    proc.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: e.message });
    });
  });
}

function readJsonIfExists(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function extractPluginPackages(appDir) {
  const appJson = readJsonIfExists(path.join(appDir, 'app.json'));
  const plugins = appJson?.expo?.plugins;
  if (!Array.isArray(plugins)) return [];
  const pkgs = [];
  for (const p of plugins) {
    if (typeof p === 'string') pkgs.push(p);
    else if (Array.isArray(p) && typeof p[0] === 'string') pkgs.push(p[0]);
  }
  return Array.from(new Set(pkgs));
}

function extractMissingImportPackages(scan) {
  const pkgs = [];
  for (const i of (scan?.issues || [])) {
    const m = String(i.message || '').match(/Import of missing package:\s+(.+)$/);
    if (m?.[1]) pkgs.push(m[1].trim());
  }
  return Array.from(new Set(pkgs));
}

async function ensurePackagesInstalled(appDir, pkgs, onProgress) {
  if (!pkgs || pkgs.length === 0) return { ok: true };
  onProgress(`Installing missing deps: ${pkgs.join(', ')}`);
  const r = await exec('npx', ['expo', 'install', ...pkgs], {
    cwd: appDir,
    env: { EXPO_NO_TELEMETRY: '1', EXPO_NO_DOTENV: '1' },
    timeout: 240_000,
  });
  if (!r.ok) return { ok: false, error: r.stderr || r.stdout || 'expo install failed' };
  return { ok: true };
}

function toIssueMessages(issues = []) {
  return issues
    .filter((i) => i.severity === 'error')
    .map((i) => ({ phase: 'static', file: i.file, message: i.message }));
}

// Strips devDependencies that npm can't resolve — prevents expo start from refusing to launch.
function purgeUnresolvableDevDeps(appDir) {
  const pkgPath = path.join(appDir, 'package.json');
  try {
    const pkg = readJsonIfExists(pkgPath);
    if (!pkg) return false;
    const devDeps = pkg.devDependencies || {};
    const pruned = Object.entries(devDeps).filter(([k]) => {
      const modPath = path.join(appDir, 'node_modules', ...k.split('/'));
      return fs.existsSync(modPath);
    });
    if (pruned.length < Object.keys(devDeps).length) {
      pkg.devDependencies = Object.fromEntries(pruned);
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      return true;
    }
  } catch (e) { process.stderr.write(`[quality-gate] purgeUnresolvableDevDeps error: ${e.message}\n`); }
  return false;
}

async function enforceQualityGate(appDir, opts = {}) {
  const mode = opts.mode || 'strict';
  const autofix = opts.autofix !== false;
  const model = opts.model;
  const onProgress = opts.onProgress || (() => {});

  // Preflight self-heal: strip devDeps that can't be resolved by npm (blocks expo start).
  if (autofix) {
    purgeUnresolvableDevDeps(appDir);
  }

  // Preflight self-heal: ensure config plugin deps exist (prevents Expo start/config failures)
  if (autofix) {
    const pluginPkgs = extractPluginPackages(appDir);
    const missingPluginPkgs = pluginPkgs.filter((p) => !fs.existsSync(path.join(appDir, 'node_modules', p)));
    if (missingPluginPkgs.length > 0) {
      const r = await ensurePackagesInstalled(appDir, missingPluginPkgs, onProgress);
      if (!r.ok) {
        return { ok: false, mode, phase: 'deps', staticOk: false, bundleOk: false, runtimeOk: null, fixesApplied: 0, errors: [{ phase: 'deps', message: r.error }], screenshots: [], rounds: [] };
      }
    }
  }

  // Phase 1: static
  onProgress('Quality gate: static scan...');
  let scan = staticScan(appDir);
  let staticErrors = toIssueMessages(scan.issues);

  // Preflight self-heal: missing JS deps (safe, deterministic)
  if (autofix) {
    const missingPkgs = extractMissingImportPackages(scan);
    if (missingPkgs.length > 0) {
      const r = await ensurePackagesInstalled(appDir, missingPkgs, onProgress);
      if (!r.ok) {
        return { ok: false, mode, phase: 'deps', staticOk: false, bundleOk: false, runtimeOk: null, fixesApplied: 0, errors: [{ phase: 'deps', message: r.error }], screenshots: [], rounds: [] };
      }
      scan = staticScan(appDir);
      staticErrors = toIssueMessages(scan.issues);
    }
  }

  if (autofix && staticErrors.length > 0 && mode === 'strict') {
    onProgress('Quality gate: fixing static issues...');
    const qaFix = await runQA(appDir, { autofix: true, model, onProgress });
    const ok = qaFix.ok;
    return {
      ok,
      mode,
      phase: ok ? 'done' : 'runtime',
      staticOk: qaFix.staticOk,
      bundleOk: qaFix.bundleOk,
      runtimeOk: qaFix.runtimeOk,
      fixesApplied: qaFix.fixesApplied || 0,
      errors: qaFix.errors || [],
      screenshots: qaFix.screenshots || [],
      rounds: qaFix.rounds || [],
      duration: qaFix.duration,
    };
  }

  // Phase 2: bundle
  onProgress('Quality gate: bundle check...');
  const bundle = await bundleCheck(appDir);
  const bundleErrors = (bundle.errors || []).map((message) => ({ phase: 'bundle', message }));

  if (mode === 'preflight') {
    const ok = staticErrors.length === 0 && bundle.ok;
    return {
      ok,
      mode,
      phase: ok ? 'done' : 'preflight',
      staticOk: staticErrors.length === 0,
      bundleOk: bundle.ok,
      runtimeOk: null,
      fixesApplied: 0,
      errors: [...staticErrors, ...bundleErrors],
      screenshots: [],
      rounds: [],
    };
  }

  // strict: runtime
  onProgress('Quality gate: full runtime QA...');
  const qa = await runQA(appDir, { autofix, model, onProgress });
  return {
    ok: qa.ok,
    mode,
    phase: qa.ok ? 'done' : 'runtime',
    staticOk: qa.staticOk,
    bundleOk: qa.bundleOk,
    runtimeOk: qa.runtimeOk,
    fixesApplied: qa.fixesApplied || 0,
    errors: qa.errors || [],
    screenshots: qa.screenshots || [],
    rounds: qa.rounds || [],
    duration: qa.duration,
  };
}

module.exports = {
  enforceQualityGate,
};
