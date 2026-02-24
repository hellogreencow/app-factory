#!/usr/bin/env node
/**
 * Audit All — paranoid verification harness.
 *
 * What it does:
 * - Repo audit: verifies templates + scripts are in the expected shape.
 * - Pipeline audit: builds fresh apps and runs the same QA gates the bot uses.
 *
 * Usage:
 *   node orchestrator/audit-all.js
 *   node orchestrator/audit-all.js --arch tracker --full
 *   node orchestrator/audit-all.js --pipeline-only --no-llm
 *
 * Exit code:
 *   0 if all requested audits pass
 *   1 otherwise
 */

require('./lib/env').loadEnv();

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ARCHS = ['feed', 'dashboard', 'tracker', 'reference', 'generic'];

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  process.stdout.write(`[${ts}] [audit] ${msg}\n`);
}

function exec(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const cwd = opts.cwd || ROOT;
    const timeout = opts.timeout || 120_000;
    const env = { ...process.env, ...(opts.env || {}) };
    const stream = !!opts.stream;

    let stdout = '';
    let stderr = '';
    let killed = false;

    const proc = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });

    proc.stdout.on('data', (d) => {
      const s = d.toString();
      stdout += s;
      if (stream) process.stdout.write(s);
    });
    proc.stderr.on('data', (d) => {
      const s = d.toString();
      stderr += s;
      if (stream && !s.includes('ExperimentalWarning')) process.stderr.write(s);
    });

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 5000);
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0 && !killed, code, killed, stdout, stderr: stderr.slice(0, 2000) });
    });
    proc.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, code: -1, killed: false, stdout, stderr: e.message });
    });
  });
}

function parseArgs(argv) {
  const out = {
    archs: null,
    full: false,
    nativeE2E: false,
    keep: false,
    noLlm: false,
    noTaste: false,
    repoOnly: false,
    pipelineOnly: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--arch' && argv[i + 1]) {
      out.archs = argv[i + 1].split(',').map(s => s.trim()).filter(Boolean);
      i++;
    } else if (a === '--full') out.full = true;
    else if (a === '--native-e2e') out.nativeE2E = true;
    else if (a === '--keep') out.keep = true;
    else if (a === '--no-llm') out.noLlm = true;
    else if (a === '--no-taste') out.noTaste = true;
    else if (a === '--repo-only') out.repoOnly = true;
    else if (a === '--pipeline-only') out.pipelineOnly = true;
  }

  return out;
}

function isExecutable(p) {
  try {
    const st = fs.statSync(p);
    return (st.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function repoAudit() {
  const issues = [];

  const requiredScripts = [
    'scripts/scaffold-minimal.sh',
    'scripts/lint.sh',
    'scripts/e2e-test.sh',
    'scripts/deploy.sh',
    'scripts/notify.sh',
  ].map((p) => path.join(ROOT, p));

  for (const p of requiredScripts) {
    if (!fs.existsSync(p)) issues.push({ severity: 'error', area: 'scripts', msg: `Missing: ${path.relative(ROOT, p)}` });
    else if (!isExecutable(p)) issues.push({ severity: 'error', area: 'scripts', msg: `Not executable: ${path.relative(ROOT, p)} (chmod +x)` });
  }

  // Template invariants: stable tab ids + settings title id
  const templateChecks = [
    { file: 'templates/feed/App.js', mustInclude: 'tabBarButtonTestID' },
    { file: 'templates/dashboard/App.js', mustInclude: 'tabBarButtonTestID' },
    { file: 'templates/tracker/App.js', mustInclude: 'tabBarButtonTestID' },
    { file: 'templates/reference/App.js', mustInclude: 'tabBarButtonTestID' },
    { file: 'templates/generic/App.js', mustInclude: 'tabBarButtonTestID' },
    { file: 'templates/feed/src/screens/SettingsScreen.js', mustInclude: 'testID="settings-title"' },
    { file: 'templates/dashboard/src/screens/SettingsScreen.js', mustInclude: 'testID="settings-title"' },
    { file: 'templates/tracker/src/screens/SettingsScreen.js', mustInclude: 'testID="settings-title"' },
    { file: 'templates/reference/src/screens/SettingsScreen.js', mustInclude: 'testID="settings-title"' },
    { file: 'templates/generic/src/screens/SettingsScreen.js', mustInclude: 'testID="settings-title"' },
  ];

  for (const c of templateChecks) {
    const fp = path.join(ROOT, c.file);
    const code = readFileSafe(fp);
    if (!code) {
      issues.push({ severity: 'error', area: 'templates', msg: `Missing: ${c.file}` });
      continue;
    }
    if (!code.includes(c.mustInclude)) {
      issues.push({ severity: 'error', area: 'templates', msg: `${c.file} missing "${c.mustInclude}"` });
    }
  }

  // Scan for sync child-process usage (not fatal, but surfaced)
  const scanDirs = [path.join(ROOT, 'orchestrator'), path.join(ROOT, 'bot')];
  const syncHits = [];
  for (const dir of scanDirs) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
      if (dir.endsWith(path.sep + 'orchestrator') && f === 'audit-all.js') continue;
      const fp = path.join(dir, f);
      const code = readFileSafe(fp);
      if (code.includes('execSync(') || code.includes('spawnSync(')) {
        syncHits.push(path.relative(ROOT, fp));
      }
    }
  }
  if (syncHits.length) {
    issues.push({ severity: 'warn', area: 'code', msg: `Sync child_process usage found in: ${syncHits.join(', ')}` });
  }

  return { ok: issues.every((i) => i.severity !== 'error'), issues };
}

async function pipelineAuditOne(arch, opts) {
  const slug = `audit-${arch}-${Date.now().toString(36).slice(-6)}`;
  const appDir = path.join(ROOT, 'apps', slug);

  const idea = {
    name: `Audit ${arch}`,
    description: `End-to-end audit build for ${arch}`,
    architecture: arch,
    domain: 'audit',
    twist: 'minimal',
    slug,
  };

  const steps = [];
  const t0 = Date.now();

  const runStep = async (name, fn) => {
    const t = Date.now();
    log(`${slug} ${name}...`);
    const r = await fn();
    steps.push({ name, ok: r.ok, ms: Date.now() - t, meta: r.meta || null, stderr: r.ok ? null : r.stderr });
    if (!r.ok) throw new Error(`${name} failed: ${r.stderr || 'unknown error'}`);
  };

  try {
    await runStep('scaffold', async () => {
      const r = await exec(path.join(ROOT, 'scripts', 'scaffold-minimal.sh'), [slug], { timeout: 300_000, stream: true });
      return r;
    });

    await runStep('template-copy', async () => {
      const r = await exec('node', [path.join(ROOT, 'orchestrator', 'template-copy.js'), appDir, arch], { timeout: 30_000 });
      return r;
    });

    await runStep('feature-agent', async () => {
      const r = await exec('node', [path.join(ROOT, 'orchestrator', 'feature-agent.js'), appDir, arch, JSON.stringify(idea)], { timeout: 30_000 });
      return r;
    });

    await runStep('flow-generator', async () => {
      const r = await exec('node', [path.join(ROOT, 'orchestrator', 'flow-generator.js'), appDir], { timeout: 30_000 });
      return r;
    });

    await runStep('npm-install', async () => {
      const r = await exec('npm', ['install'], { cwd: appDir, timeout: 240_000, stream: true });
      return r;
    });

    if (!opts.noLlm) {
      await runStep('customize-agent', async () => {
        const r = await exec('node', [path.join(ROOT, 'orchestrator', 'customize-agent.js'), appDir, arch, JSON.stringify(idea)], { timeout: 150_000, stream: true });
        return r;
      });

      if (!opts.noTaste) {
        await runStep('taste-agent', async () => {
          const r = await exec('node', [path.join(ROOT, 'orchestrator', 'taste-agent.js'), appDir, JSON.stringify(idea)], { timeout: 90_000, stream: true });
          return r;
        });
      }
    }

    await runStep('functional-test', async () => {
      const r = await exec('node', [path.join(ROOT, 'orchestrator', 'functional-test.js'), appDir, '--strict'], { timeout: 120_000, stream: true });
      return r;
    });

    await runStep('lint', async () => {
      const r = await exec(path.join(ROOT, 'scripts', 'lint.sh'), [slug], { timeout: 120_000, stream: true });
      return r;
    });

    await runStep('expo-bundle', async () => {
      const r = await exec('node', [path.join(ROOT, 'orchestrator', 'expo-go-test.js'), appDir], { timeout: 120_000, stream: true });
      return r;
    });

    if (opts.full) {
      await runStep('expo-go-sim', async () => {
        const r = await exec('node', [path.join(ROOT, 'orchestrator', 'expo-go-test.js'), appDir, '--full'], { timeout: 240_000, stream: true });
        return r;
      });
    }

    if (opts.nativeE2E) {
      await runStep('native-e2e', async () => {
        const r = await exec(path.join(ROOT, 'scripts', 'e2e-test.sh'), [slug], { timeout: 900_000, stream: true });
        return r;
      });
    }

    const dur = Date.now() - t0;
    return { ok: true, slug, appDir, ms: dur, steps };
  } catch (e) {
    const dur = Date.now() - t0;
    return { ok: false, slug, appDir, ms: dur, steps, error: e.message };
  } finally {
    if (!opts.keep) {
      try { fs.rmSync(appDir, { recursive: true, force: true }); } catch {}
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const doRepo = !opts.pipelineOnly;
  const doPipeline = !opts.repoOnly;

  const archs = (opts.archs && opts.archs.length ? opts.archs : ARCHS)
    .map((a) => a.toLowerCase())
    .filter((a) => ARCHS.includes(a));

  const report = {
    ok: true,
    startedAt: new Date().toISOString(),
    opts,
    repo: null,
    pipeline: [],
  };

  if (doRepo) {
    log('Repo audit...');
    report.repo = repoAudit();
    report.ok = report.ok && report.repo.ok;
  }

  if (doPipeline) {
    for (const arch of archs) {
      const r = await pipelineAuditOne(arch, opts);
      report.pipeline.push({ arch, ...r });
      report.ok = report.ok && r.ok;
    }
  }

  report.finishedAt = new Date().toISOString();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error('Fatal audit error:', e.message);
  process.exit(1);
});

