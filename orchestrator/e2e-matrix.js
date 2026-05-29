#!/usr/bin/env node
/**
 * End-to-end matrix runner for factory readiness.
 *
 * Validates:
 * 1) Build-path quality gate works (preflight + strict)
 * 2) Telegram action paths are aligned to unified gate
 * 3) Legacy QA references are removed from bot action paths
 * 4) Process-control hooks for stop/cancel exist
 *
 * Usage:
 *   node orchestrator/e2e-matrix.js --slug near-fear
 *   node orchestrator/e2e-matrix.js --app apps/near-fear
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { enforceQualityGate } = require('./quality-gate');

const ROOT = path.join(__dirname, '..');

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

function resolveAppDir() {
  const appArg = argValue('--app');
  if (appArg) return path.isAbsolute(appArg) ? appArg : path.join(ROOT, appArg);
  const slug = argValue('--slug');
  if (slug) return path.join(ROOT, 'apps', slug);
  return null;
}

function checkNodeSyntax(absPath) {
  const r = spawnSync('node', ['--check', absPath], { encoding: 'utf8' });
  return {
    ok: r.status === 0,
    message: r.status === 0 ? 'syntax-ok' : (r.stderr || r.stdout || 'syntax check failed').slice(0, 400),
  };
}

function runCheck(name, fn, results) {
  try {
    const res = fn();
    results.push({ name, ...res });
  } catch (e) {
    results.push({ name, ok: false, message: e.message.slice(0, 300) });
  }
}

async function main() {
  const appDir = resolveAppDir();
  if (!appDir || !fs.existsSync(appDir)) {
    console.error('Usage: node orchestrator/e2e-matrix.js --slug <slug> | --app <appDir>');
    process.exit(1);
  }

  const telegramPath = path.join(ROOT, 'bot', 'telegram.js');
  const gatePath = path.join(ROOT, 'orchestrator', 'quality-gate.js');
  const runtimeQaPath = path.join(ROOT, 'orchestrator', 'runtime-qa.js');
  const telegram = fs.readFileSync(telegramPath, 'utf8');

  const checks = [];

  runCheck('syntax:telegram', () => checkNodeSyntax(telegramPath), checks);
  runCheck('syntax:quality-gate', () => checkNodeSyntax(gatePath), checks);
  runCheck('syntax:runtime-qa', () => checkNodeSyntax(runtimeQaPath), checks);

  runCheck('integration:uses-enforceQualityGate', () => {
    const uses = (telegram.match(/enforceQualityGate\(/g) || []).length;
    return {
      ok: uses >= 4,
      message: `enforceQualityGate calls: ${uses}`,
    };
  }, checks);

  runCheck('integration:no-legacy-functional-test', () => {
    const has = telegram.includes('functional-test.js');
    return { ok: !has, message: has ? 'found functional-test.js reference' : 'none' };
  }, checks);

  runCheck('integration:no-legacy-expo-go-test', () => {
    const has = telegram.includes('expo-go-test.js');
    return { ok: !has, message: has ? 'found expo-go-test.js reference' : 'none' };
  }, checks);

  runCheck('integration:no-test-screenshots', () => {
    const has = telegram.includes('test-screenshots');
    return { ok: !has, message: has ? 'found test-screenshots reference' : 'none' };
  }, checks);

  runCheck('process-control:registry-hooks', () => {
    const hasTrack = telegram.includes('function trackProcess(');
    const hasKill = telegram.includes('function killTrackedProcesses(');
    const stopUsesKill = telegram.includes('await killTrackedProcesses(chatId)');
    return {
      ok: hasTrack && hasKill && stopUsesKill,
      message: `track=${hasTrack} kill=${hasKill} stopUsesKill=${stopUsesKill}`,
    };
  }, checks);

  // Preflight gate
  const preflight = await enforceQualityGate(appDir, { mode: 'preflight', autofix: false });
  checks.push({
    name: 'gate:preflight',
    ok: preflight.ok,
    message: `static=${preflight.staticOk} bundle=${preflight.bundleOk} errors=${(preflight.errors || []).length}`,
  });

  // Strict gate
  const strict = await enforceQualityGate(appDir, { mode: 'strict', autofix: false });
  checks.push({
    name: 'gate:strict',
    ok: strict.ok,
    message: `static=${strict.staticOk} bundle=${strict.bundleOk} runtime=${strict.runtimeOk} errors=${(strict.errors || []).length}`,
  });

  const screenshots = strict.screenshots || [];
  checks.push({
    name: 'artifacts:qa-screenshots',
    ok: screenshots.length > 0,
    message: `screenshots=${screenshots.length}`,
  });

  const passed = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const ok = passed === total;

  const report = {
    ok,
    appDir,
    summary: `${passed}/${total} checks passed`,
    checks,
    strictDurationSec: strict.duration || null,
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(`matrix fatal: ${e.message}`);
  process.exit(1);
});

