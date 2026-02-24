#!/usr/bin/env node
/**
 * OpenClaw Bridge — lets any OpenClaw agent drive the iOS App Factory.
 *
 * OpenClaw agents call this via `exec`:
 *   node openclaw/bridge.js build "A mood journal for tracking daily feelings"
 *   node openclaw/bridge.js edit my-app "add a search bar"
 *   node openclaw/bridge.js test my-app
 *   node openclaw/bridge.js list
 *   node openclaw/bridge.js status my-app
 *   node openclaw/bridge.js preview my-app
 *
 * Returns structured JSON on stdout for the agent to parse.
 */

require('../orchestrator/lib/env').loadEnv();

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chat: llmChat } = require('../orchestrator/lib/llm');
const { runCodeAgent } = require('../orchestrator/code-agent');
const { run: runFeatureBuilder } = require('../orchestrator/feature-builder');

const ROOT = path.join(__dirname, '..');

function exec(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    let stdout = '', stderr = '';
    const proc = spawn(cmd, args, {
      cwd: opts.cwd || ROOT,
      env: { ...process.env, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout.on('data', d => { stdout += d; if (opts.onData) opts.onData(d.toString()); });
    proc.stderr.on('data', d => { stderr += d; });
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 3000);
    }, opts.timeout || 120_000);
    proc.on('close', code => { clearTimeout(timer); resolve({ ok: code === 0, stdout, stderr: stderr.slice(0, 500) }); });
    proc.on('error', e => { clearTimeout(timer); resolve({ ok: false, stdout, stderr: e.message }); });
  });
}

function log(msg) { process.stderr.write(`[bridge] ${msg}\n`); }
function out(obj) { process.stdout.write(JSON.stringify(obj, null, 2) + '\n'); }

async function cmdBuild(description) {
  log(`Building: ${description}`);

  const model = process.env.CODE_MODEL || 'google/gemini-3-flash-preview';
  const prompt = `You are designing a beautiful, minimal iOS app. Here's what the user wants:

"${description}"

Create a precise app specification.

Output ONLY valid JSON:
{
  "name": "Human Readable Name",
  "slug": "kebab-case-slug",
  "description": "One compelling line",
  "domain": "single-word category",
  "twist": "minimal",
  "architecture": "one of: feed, dashboard, tracker, reference, generic",
  "style_notes": "Brief visual direction"
}

Architecture guide:
- feed: scrollable content (posts, cards, timeline)
- dashboard: metrics + actions (overview, log, history)
- tracker: time-based entries (calendar, daily log, stats)
- reference: browse + detail (browse, item detail, bookmarks)
- generic: list + create + detail

Output ONLY JSON.`;

  let idea;
  try {
    const raw = await llmChat([{ role: 'user', content: prompt }], { model, temperature: 0.8, max_tokens: 512 });
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    idea = JSON.parse(match[0]);
    if (!idea.slug) idea.slug = idea.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  } catch (e) {
    out({ ok: false, error: `Spec generation failed: ${e.message}` });
    return;
  }

  if (fs.existsSync(path.join(ROOT, 'apps', idea.slug))) {
    idea.slug = `${idea.slug}-${Date.now().toString(36).slice(-4)}`;
  }

  const appDir = path.join(ROOT, 'apps', idea.slug);
  const arch = idea.architecture || 'generic';

  log(`Spec: ${idea.name} (${arch}) → apps/${idea.slug}`);
  out({ stage: 'spec', idea });

  // Scaffold
  log('Scaffolding...');
  const scaffR = await exec(path.join(ROOT, 'scripts', 'scaffold-minimal.sh'), [idea.slug], { timeout: 90_000 });
  if (!scaffR.ok) { out({ ok: false, stage: 'scaffold', error: scaffR.stderr.slice(0, 200) }); return; }

  // Template
  log(`Applying ${arch} template...`);
  await exec('node', [path.join(ROOT, 'orchestrator', 'template-copy.js'), appDir, arch], { timeout: 10_000 });
  await exec('node', [path.join(ROOT, 'orchestrator', 'feature-agent.js'), appDir, arch, JSON.stringify(idea)], { timeout: 10_000 });

  // Flows
  log('Generating E2E flows...');
  await exec('node', [path.join(ROOT, 'orchestrator', 'flow-generator.js'), appDir], { timeout: 10_000 });

  // Dependencies
  log('Installing dependencies...');
  const npmR = await exec('npm', ['install'], { cwd: appDir, timeout: 90_000 });
  if (!npmR.ok) { out({ ok: false, stage: 'npm-install', error: 'npm install failed' }); return; }

  // Customize
  log('Customizing theme and content...');
  await exec('node', [path.join(ROOT, 'orchestrator', 'customize-agent.js'), appDir, arch, JSON.stringify(idea)], { timeout: 90_000 });

  // Feature enrichment
  log('Building real features...');
  const enrichR = await runFeatureBuilder(appDir, idea, {
    model,
    skipCustom: true,
    onProgress: (m) => log(m),
  });
  log(`Features: ${enrichR.passed}/${enrichR.features.length} built`);

  // Taste
  log('Polishing...');
  await exec('node', [path.join(ROOT, 'orchestrator', 'taste-agent.js'), appDir, JSON.stringify(idea)], { timeout: 60_000 });

  // QA
  log('Running QA...');
  await exec('node', [path.join(ROOT, 'orchestrator', 'functional-test.js'), appDir, '--strict'], { timeout: 90_000 });

  // Bundle test
  log('Testing bundle...');
  const testR = await exec('node', [path.join(ROOT, 'orchestrator', 'expo-go-test.js'), appDir], { timeout: 60_000 });

  const result = {
    ok: testR.ok,
    stage: 'complete',
    app: {
      name: idea.name,
      slug: idea.slug,
      architecture: arch,
      description: idea.description,
      path: appDir,
    },
    features: enrichR.features.filter(f => f.ok).map(f => f.name),
    bundleTest: testR.ok ? 'passed' : 'failed',
    preview: `cd ${appDir} && npx expo start`,
  };

  out(result);
}

async function cmdEdit(slug, editRequest) {
  const appDir = path.join(ROOT, 'apps', slug);
  if (!fs.existsSync(appDir)) { out({ ok: false, error: `App not found: apps/${slug}` }); return; }

  log(`Editing ${slug}: ${editRequest}`);

  let idea = null;
  const fp = path.join(appDir, 'features.json');
  if (fs.existsSync(fp)) { try { idea = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch {} }

  const result = await runCodeAgent({
    appDir,
    task: editRequest,
    idea,
    model: process.env.CODE_MODEL || 'google/gemini-3-flash-preview',
    onProgress: (m) => log(m),
  });

  if (result.ok) {
    await exec('node', [path.join(ROOT, 'orchestrator', 'functional-test.js'), appDir, '--strict'], { timeout: 60_000 });
    await exec('node', [path.join(ROOT, 'orchestrator', 'expo-go-test.js'), appDir], { timeout: 60_000 });
  }

  out({
    ok: result.ok,
    filesChanged: result.filesChanged,
    summary: result.summary,
    error: result.ok ? null : result.error,
  });
}

async function cmdTest(slug) {
  const appDir = path.join(ROOT, 'apps', slug);
  if (!fs.existsSync(appDir)) { out({ ok: false, error: `App not found: apps/${slug}` }); return; }

  log(`Testing ${slug}...`);
  const qaR = await exec('node', [path.join(ROOT, 'orchestrator', 'functional-test.js'), appDir, '--strict'], { timeout: 90_000 });
  const bundleR = await exec('node', [path.join(ROOT, 'orchestrator', 'expo-go-test.js'), appDir], { timeout: 60_000 });

  out({
    ok: qaR.ok && bundleR.ok,
    qa: qaR.ok ? 'passed' : 'issues found',
    bundle: bundleR.ok ? 'passed' : 'failed',
    details: (qaR.stdout + bundleR.stdout).split('\n').filter(l => /PASS|FAIL|error|warn/i.test(l)).slice(0, 10),
  });
}

function cmdList() {
  const appsDir = path.join(ROOT, 'apps');
  if (!fs.existsSync(appsDir)) { out({ ok: true, apps: [] }); return; }

  const apps = fs.readdirSync(appsDir)
    .filter(d => fs.existsSync(path.join(appsDir, d, 'package.json')))
    .map(slug => {
      const fp = path.join(appsDir, slug, 'features.json');
      let idea = {};
      if (fs.existsSync(fp)) { try { idea = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch {} }
      return {
        slug,
        name: idea.name || slug,
        architecture: idea.architecture || 'unknown',
        description: idea.description || '',
      };
    });

  out({ ok: true, count: apps.length, apps });
}

function cmdStatus(slug) {
  const appDir = path.join(ROOT, 'apps', slug);
  if (!fs.existsSync(appDir)) { out({ ok: false, error: `App not found: apps/${slug}` }); return; }

  const fp = path.join(appDir, 'features.json');
  let idea = {};
  if (fs.existsSync(fp)) { try { idea = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch {} }

  const hasScreenshots = fs.existsSync(path.join(appDir, 'test-screenshots'));
  const hasFlows = fs.existsSync(path.join(appDir, 'maestro', 'flows'));

  out({
    ok: true,
    slug,
    name: idea.name || slug,
    architecture: idea.architecture || 'unknown',
    description: idea.description || '',
    hasScreenshots,
    hasFlows,
    path: appDir,
    preview: `cd ${appDir} && npx expo start`,
  });
}

function cmdPreview(slug) {
  const appDir = path.join(ROOT, 'apps', slug);
  if (!fs.existsSync(appDir)) { out({ ok: false, error: `App not found: apps/${slug}` }); return; }

  out({
    ok: true,
    instructions: [
      '1. Install Expo Go from the App Store on your iPhone',
      `2. Run: cd ${appDir} && npx expo start`,
      '3. Scan the QR code with your iPhone camera',
      '4. The app opens instantly in Expo Go',
    ],
    command: `cd ${appDir} && npx expo start`,
  });
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  switch (cmd) {
    case 'build':
      await cmdBuild(args.join(' '));
      break;
    case 'edit':
      await cmdEdit(args[0], args.slice(1).join(' '));
      break;
    case 'test':
      await cmdTest(args[0]);
      break;
    case 'list':
      cmdList();
      break;
    case 'status':
      cmdStatus(args[0]);
      break;
    case 'preview':
      cmdPreview(args[0]);
      break;
    default:
      out({
        ok: false,
        error: 'Unknown command',
        usage: {
          build: 'node openclaw/bridge.js build "description of the app"',
          edit: 'node openclaw/bridge.js edit <slug> "what to change"',
          test: 'node openclaw/bridge.js test <slug>',
          list: 'node openclaw/bridge.js list',
          status: 'node openclaw/bridge.js status <slug>',
          preview: 'node openclaw/bridge.js preview <slug>',
        },
      });
  }
}

main().catch(e => {
  out({ ok: false, error: e.message });
  process.exit(1);
});
