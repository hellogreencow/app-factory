#!/usr/bin/env node
/**
 * Autonomous App Factory Loop — async edition
 * Idea -> Scaffold -> Feature -> Flow -> Lint -> E2E (build + Maestro) -> Fix -> Deploy -> Notify
 *
 * All child processes are async (spawn, not spawnSync). Output streams to stdout in real time
 * so the TUI can pick it up. Timeouts are enforced per-stage with graceful kill.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const { preDeployAudit, postFailureDiagnosis } = require('./review-agent');

const ROOT = path.join(__dirname, '..');
const bus = new EventEmitter();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(stage, slug, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  const prefix = `[${ts}] ${slug ? slug + ' ' : ''}`;
  const line = `${prefix}${stage}: ${msg}`;
  process.stdout.write(line + '\n');
  bus.emit('log', { ts, stage, slug, msg });
}

function exec(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const cwd = opts.cwd || ROOT;
    const timeout = opts.timeout || 120_000;
    let stdout = '';
    let stderr = '';
    let killed = false;

    const proc = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (d) => {
      const chunk = d.toString();
      stdout += chunk;
      if (opts.stream) process.stdout.write(chunk);
    });

    proc.stderr.on('data', (d) => {
      const chunk = d.toString();
      stderr += chunk;
      // Filter npm noise from live output
      if (opts.stream && !chunk.includes('ExperimentalWarning') && !chunk.includes('npm warn')) {
        process.stderr.write(chunk);
      }
    });

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 5000);
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0 && !killed,
        code,
        stdout,
        stderr: stderr.slice(0, 500),
        killed,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, code: -1, stdout, stderr: err.message, killed: false });
    });
  });
}

async function benchmark(slug, stage, ok, duration, error) {
  await exec('node', [
    path.join(__dirname, 'benchmark.js'), 'log', slug, stage,
    ok ? 'ok' : 'fail', String(duration || 0), (error || '').slice(0, 200),
  ]);
}

async function notify(title, msg) {
  await exec(path.join(ROOT, 'scripts', 'notify.sh'), [title, msg]);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Pipeline stages ──────────────────────────────────────────────────────────

async function stageIdea(useLLM) {
  const t = Date.now();
  const args = [path.join(__dirname, 'idea-agent.js')];
  if (useLLM) args.push('--llm');
  const r = await exec('node', args, { timeout: 30_000 });
  if (!r.ok) return { ok: false, duration: Date.now() - t, error: r.stderr };
  try {
    const idea = JSON.parse(r.stdout.trim());
    return { ok: true, idea, duration: Date.now() - t };
  } catch (e) {
    return { ok: false, duration: Date.now() - t, error: `JSON parse: ${e.message}` };
  }
}

async function stageScaffold(slug) {
  const t = Date.now();
  const appDir = path.join(ROOT, 'apps', slug);
  if (fs.existsSync(appDir)) {
    log('Scaffold', slug, 'exists, skipping');
    return { ok: true, appDir, duration: 0, skipped: true };
  }
  const r = await exec(path.join(ROOT, 'scripts', 'scaffold-minimal.sh'), [slug], { timeout: 90_000 });
  return { ok: r.ok, appDir, duration: Date.now() - t, error: r.stderr };
}

async function stageFeature(slug, idea, appDir) {
  const t = Date.now();
  if (slug === 'crypto-portfolio') return { ok: true, duration: 0 };

  const arch = idea.architecture || 'generic';
  const copyR = await exec('node', [path.join(__dirname, 'template-copy.js'), appDir, arch], { timeout: 10_000 });
  if (!copyR.ok) return { ok: false, duration: Date.now() - t, error: copyR.stderr };

  await exec('node', [
    path.join(__dirname, 'feature-agent.js'), appDir, arch, JSON.stringify(idea),
  ], { timeout: 10_000 });

  const npmR = await exec('npm', ['install'], { cwd: appDir, timeout: 90_000 });
  return { ok: npmR.ok, duration: Date.now() - t, error: npmR.stderr };
}

async function stageFlow(slug, appDir) {
  const t = Date.now();
  const r = await exec('node', [path.join(__dirname, 'flow-generator.js'), appDir], { timeout: 10_000 });
  return { ok: r.ok, duration: Date.now() - t, error: r.stderr };
}

async function stageLint(slug, appDir) {
  const t = Date.now();
  const r = await exec(path.join(ROOT, 'scripts', 'lint.sh'), [slug], { timeout: 60_000 });
  return { ok: r.ok, duration: Date.now() - t, error: r.stderr };
}

async function ensureHeadlessSim() {
  // Hide Simulator.app window if it opened
  await exec('osascript', ['-e', 'tell application "System Events" to set visible of process "Simulator" to false']).catch(() => {});
}

async function stageE2E(slug, appDir) {
  const t = Date.now();
  log('E2E', slug, 'building (headless)...');

  // Build targeting whatever sim is booted (e2e-test.sh handles boot)
  const buildR = await exec('npx', ['expo', 'run:ios', '--no-build-cache'], {
    cwd: appDir, timeout: 600_000,
  });
  if (!buildR.ok) return { ok: false, duration: Date.now() - t, error: 'build failed: ' + buildR.stderr };

  await ensureHeadlessSim();

  const flowsDir = path.join(appDir, 'maestro', 'flows');
  let e2eOk = false;
  let lastError = '';

  for (let attempt = 0; attempt < 3; attempt++) {
    log('E2E', slug, attempt > 0 ? `retry ${attempt + 1}/3` : 'running tests...');
    const r = await exec(path.join(ROOT, 'scripts', 'e2e-test.sh'), [slug, '--no-build'], { timeout: 180_000 });
    if (r.ok) { e2eOk = true; break; }
    lastError = r.stderr;

    if (attempt < 2 && fs.existsSync(flowsDir)) {
      log('E2E', slug, 'applying fixes...');
      await exec('node', [path.join(__dirname, 'fix-agent.js'), lastError, flowsDir]);
    }
  }

  await ensureHeadlessSim();

  // Parse report
  const reportPath = path.join(appDir, 'maestro-reports', 'report.xml');
  if (fs.existsSync(reportPath)) {
    const rpt = await exec('node', [path.join(__dirname, 'e2e-report.js'), reportPath]);
    try {
      const report = JSON.parse(rpt.stdout);
      for (const f of report.flows || []) {
        log('E2E', slug, `  ${f.ok ? '✓' : '✗'} ${f.name}`);
      }
    } catch {}
  }

  return { ok: e2eOk, duration: Date.now() - t, error: lastError };
}

async function stageDeploy(slug) {
  const t = Date.now();
  // EAS free tier: 5-10 min queue + 5-10 min build. Submit uses --no-wait (instant).
  const r = await exec(path.join(ROOT, 'scripts', 'deploy.sh'), [slug], { timeout: 1_800_000, stream: true });
  if (r.ok) {
    await notify('iOS App Factory', `${slug} uploaded to Apple. TestFlight in 5-15 min.`);
  }
  return { ok: r.ok, duration: Date.now() - t, error: r.stderr };
}

// ─── Main loop ────────────────────────────────────────────────────────────────

async function runOne(opts) {
  const { useLLM, doLint, doE2E, doDeploy } = opts;
  const t0 = Date.now();

  // 1. Idea
  log('Idea', '', 'generating...');
  const ideaR = await stageIdea(useLLM);
  if (!ideaR.ok) {
    await benchmark('unknown', 'idea', false, ideaR.duration, ideaR.error);
    log('Idea', '', `FAILED: ${ideaR.error}`);
    return false;
  }
  const idea = ideaR.idea;
  let slug = idea.slug || idea.name?.toLowerCase().replace(/\s+/g, '-') || 'app';
  slug = slug.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 40);
  if (fs.existsSync(path.join(ROOT, 'apps', slug))) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }
  log('Idea', slug, `${idea.name} [${idea.architecture || 'generic'}] (${idea.domain}, ${idea.twist})`);
  await benchmark(slug, 'idea', true, ideaR.duration);
  await exec('node', [
    path.join(__dirname, 'benchmark.js'), 'meta', slug,
    JSON.stringify({ theme: idea.name, architecture: idea.architecture || 'generic', domain: idea.domain }),
  ]);

  // 2. Scaffold
  log('Scaffold', slug, 'starting...');
  const scaffR = await stageScaffold(slug);
  await benchmark(slug, 'scaffold', scaffR.ok, scaffR.duration, scaffR.error);
  if (!scaffR.ok) {
    log('Scaffold', slug, `FAILED: ${scaffR.error}`);
    return false;
  }
  log('Scaffold', slug, scaffR.skipped ? 'skipped (exists)' : 'ok');
  const appDir = scaffR.appDir;

  // 3. Feature (template copy + feature mapping + npm install)
  log('Feature', slug, 'applying template...');
  const featR = await stageFeature(slug, idea, appDir);
  await benchmark(slug, 'feature', featR.ok, featR.duration, featR.error);
  if (!featR.ok) { log('Feature', slug, `FAILED`); return false; }
  log('Feature', slug, 'ok');

  // 4. Flow generation
  log('Flow', slug, 'generating Maestro flows...');
  const flowR = await stageFlow(slug, appDir);
  await benchmark(slug, 'flow', flowR.ok, flowR.duration, flowR.error);
  if (!flowR.ok) log('Flow', slug, 'FAILED');
  else log('Flow', slug, 'ok');

  // 5. Lint
  if (doLint) {
    log('Lint', slug, 'running...');
    const lintR = await stageLint(slug, appDir);
    await benchmark(slug, 'lint', lintR.ok, lintR.duration, lintR.error);
    log('Lint', slug, lintR.ok ? 'ok' : 'FAILED');
  }

  // 5b. Expo Go smoke test (bundle check, optionally full sim test)
  {
    log('ExpoTest', slug, 'bundle export check...');
    const expoArgs = [path.join(__dirname, 'expo-go-test.js'), appDir];
    if (doE2E) expoArgs.push('--full');
    const t5b = Date.now();
    const expoR = await exec('node', expoArgs, { timeout: 120_000, stream: true });
    const expoOk = expoR.ok;
    await benchmark(slug, 'expo-test', expoOk, Date.now() - t5b, expoR.ok ? null : expoR.stderr);
    if (expoOk) {
      log('ExpoTest', slug, 'PASSED');
    } else {
      log('ExpoTest', slug, 'FAILED — bundle does not compile');
      if (doDeploy) {
        log('ExpoTest', slug, 'blocking deploy — fix JS errors first');
        return false;
      }
    }
  }

  // 6. Review (pre-deploy audit — validates config, deps, credentials, ASC state)
  if (doDeploy || doE2E) {
    log('Review', slug, 'pre-deploy audit...');
    const t6 = Date.now();
    const reviewR = await preDeployAudit(slug);
    await benchmark(slug, 'review', reviewR.summary.ready, Date.now() - t6,
      reviewR.summary.ready ? null : `${reviewR.summary.blockers} blockers, ${reviewR.summary.errors} errors`);

    if (reviewR.summary.actions_taken > 0) {
      log('Review', slug, `applied ${reviewR.summary.actions_taken} auto-fixes`);
    }

    if (!reviewR.summary.ready) {
      const blockerMsgs = reviewR.checks.filter(c => c.severity === 'blocker').map(c => c.msg);
      if (blockerMsgs.length > 0) {
        log('Review', slug, `BLOCKED: ${blockerMsgs[0]}`);
        await notify('iOS App Factory', `${slug} blocked: ${blockerMsgs[0].slice(0, 80)}`);
      }
    }
    log('Review', slug, reviewR.summary.ready ? 'READY' : 'NOT READY');
  }

  // 7. E2E (local build + test — optional, skip if deploy-only)
  let e2ePassed = true;
  if (doE2E) {
    const e2eR = await stageE2E(slug, appDir);
    await benchmark(slug, 'e2e', e2eR.ok, e2eR.duration, e2eR.error);
    log('E2E', slug, e2eR.ok ? 'PASSED' : 'FAILED');
    e2ePassed = e2eR.ok;
  } else {
    await benchmark(slug, 'e2e', true, 0, 'skipped');
    log('E2E', slug, 'skipped');
  }

  // 8. Deploy (EAS cloud build + TestFlight submit — independent of local E2E)
  if (doDeploy && (e2ePassed || !doE2E)) {
    log('Deploy', slug, 'EAS build + TestFlight submit...');
    const depR = await stageDeploy(slug);
    await benchmark(slug, 'deploy', depR.ok, depR.duration, depR.error);
    if (depR.ok) {
      log('Deploy', slug, 'SHIPPED');
    } else {
      log('Deploy', slug, 'FAILED — running post-failure diagnosis...');
      const diag = await postFailureDiagnosis(slug, depR.error || '');
      if (diag.actions.some(a => a.action !== 'needs-manual-app-creation')) {
        log('Deploy', slug, 'auto-fixes applied, retrying deploy...');
        const retryR = await stageDeploy(slug);
        await benchmark(slug, 'deploy-retry', retryR.ok, retryR.duration, retryR.error);
        log('Deploy', slug, retryR.ok ? 'SHIPPED (retry)' : 'FAILED (retry)');
      } else {
        for (const a of diag.actions) {
          if (a.instructions) {
            log('Deploy', slug, `MANUAL ACTION NEEDED: ${a.instructions}`);
            await notify('iOS App Factory', `${slug}: ${a.instructions.slice(0, 80)}`);
          }
        }
      }
    }
  }

  const total = ((Date.now() - t0) / 1000).toFixed(1);
  log('Done', slug, `completed in ${total}s`);
  return true;
}

async function main() {
  const maxApps = parseInt(process.env.MAX_APPS || '3', 10);
  const continuous = process.argv.includes('--continuous');
  const full = process.argv.includes('--full');
  const useLLM = process.argv.includes('--llm');
  const doE2E = process.argv.includes('--e2e') || full;
  const doDeploy = process.argv.includes('--deploy') || full;
  const doLint = process.argv.includes('--lint') || full;

  let count = 0;

  do {
    const ok = await runOne({ useLLM, doLint, doE2E, doDeploy });
    count++;

    if (!ok && continuous) {
      log('Loop', '', 'stage failed, retrying in 10s...');
      await sleep(10_000);
    } else if (continuous && count < maxApps) {
      log('Loop', '', `completed ${count}/${maxApps}, next in 5s...`);
      await sleep(5_000);
    }
  } while (continuous && count < maxApps);

  // Final report
  log('Report', '', 'generating...');
  const rpt = await exec('node', [path.join(__dirname, 'benchmark.js'), 'report']);
  process.stdout.write(rpt.stdout + '\n');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
