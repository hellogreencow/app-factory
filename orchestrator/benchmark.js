#!/usr/bin/env node
/**
 * Benchmark: log pipeline results for each app
 * Usage: node benchmark.js log <idea_slug> <stage> <ok|fail> [duration_ms] [error]
 *        node benchmark.js report
 */

const fs = require('fs');
const path = require('path');

const BENCH_PATH = path.join(__dirname, '..', 'benchmark', 'runs.json');

function ensureDir() {
  const dir = path.dirname(BENCH_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(BENCH_PATH)) fs.writeFileSync(BENCH_PATH, '[]');
}

function load() {
  ensureDir();
  return JSON.parse(fs.readFileSync(BENCH_PATH, 'utf8'));
}

function save(data) {
  ensureDir();
  fs.writeFileSync(BENCH_PATH, JSON.stringify(data, null, 2));
}

function log(slug, stage, ok, durationMs, error) {
  const runs = load();
  let run = runs.find((r) => r.slug === slug && !r.completed_at);
  if (!run) {
    run = { slug, started_at: new Date().toISOString(), stages: {} };
    runs.push(run);
  }
  const isOk = ok === 'ok';
  const safeMs = Number.isFinite(durationMs) ? durationMs : 0;
  const safeErr = error ? String(error).slice(0, 200) : null;
  run.stages[stage] = { ok: isOk, duration_ms: safeMs, error: safeErr };

  if (stage === 'deploy' || stage === 'deploy-retry' || (stage === 'e2e' && !isOk)) {
    run.completed_at = new Date().toISOString();
    run.success = run.stages.e2e?.ok && (run.stages.deploy?.ok || run.stages['deploy-retry']?.ok || true);
  }
  save(runs);
  console.log(JSON.stringify({ slug, stage, ok, duration_ms: durationMs }));
}

function setMeta(slug, meta) {
  const runs = load();
  let run = runs.find((r) => r.slug === slug && !r.completed_at);
  if (!run) {
    run = { slug, started_at: new Date().toISOString(), stages: {} };
    runs.push(run);
  }
  if (meta.theme) run.theme = meta.theme;
  if (meta.architecture) run.architecture = meta.architecture;
  if (meta.domain) run.domain = meta.domain;
  save(runs);
}

function report() {
  const runs = load();
  const completed = runs.filter((r) => r.completed_at);
  const passed = completed.filter((r) => r.success);
  const scaffoldOk = runs.filter((r) => r.stages?.scaffold?.ok).length;
  const e2eOk = runs.filter((r) => r.stages?.e2e?.ok).length;
  console.log(JSON.stringify({
    total_runs: runs.length,
    completed: completed.length,
    passed: passed.length,
    scaffold_ok: scaffoldOk,
    e2e_ok: e2eOk,
    success_rate: completed.length ? (passed.length / completed.length * 100).toFixed(1) + '%' : 'N/A',
    last_5: runs.slice(-5),
  }, null, 2));
}

function main() {
  const [cmd, slug, ...rest] = process.argv.slice(2);
  if (cmd === 'log') {
    const [stage, ok, duration, error] = rest;
    log(slug, stage, ok, parseInt(duration, 10), error);
  } else if (cmd === 'meta') {
    try { setMeta(slug, JSON.parse(rest[0])); } catch (e) { console.error('meta parse error:', e.message); }
  } else if (cmd === 'report') {
    report();
  } else {
    console.error('Usage: benchmark.js log <slug> <stage> <ok|fail> [duration_ms] [error]');
    console.error('       benchmark.js meta <slug> \'{"theme":"...","architecture":"..."}\'');
    console.error('       benchmark.js report');
  }
}

main();
