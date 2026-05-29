#!/usr/bin/env node
/**
 * OpenClaw Bridge — lets any OpenClaw agent drive the iOS App Factory.
 *
 * Commands:
 *   node openclaw/bridge.js build "A mood journal for tracking daily feelings"
 *   node openclaw/bridge.js edit my-app "add a search bar"
 *   node openclaw/bridge.js test my-app
 *   node openclaw/bridge.js list
 *   node openclaw/bridge.js status my-app
 *   node openclaw/bridge.js preview my-app
 *
 * Returns structured JSON on stdout.
 */

require('../orchestrator/lib/env').loadEnv();

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chat: llmChat } = require('../orchestrator/lib/llm');
const { runCodeAgent } = require('../orchestrator/code-agent');
const { designApp } = require('../orchestrator/designer-agent');
const { run: runAppGenerator } = require('../orchestrator/app-generator');

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
  const model = process.env.CODE_MODEL || 'google/gemini-2.0-flash-001';

  // Generate idea spec
  const prompt = `You are designing a unique, feature-rich iOS app. Here's what the user wants:

"${description}"

Output ONLY valid JSON:
{
  "name": "Human Readable Name",
  "slug": "kebab-case-slug",
  "description": "One compelling line",
  "domain": "single-word category",
  "twist": "visual style notes",
  "style_notes": "Brief visual direction"
}`;

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
  log(`Spec: ${idea.name} → apps/${idea.slug}`);
  out({ stage: 'spec', idea });

  // Scaffold
  log('Scaffolding...');
  const scaffR = await exec(path.join(ROOT, 'scripts', 'scaffold-minimal.sh'), [idea.slug], { timeout: 180_000 });
  if (!scaffR.ok) { out({ ok: false, stage: 'scaffold', error: scaffR.stderr.slice(0, 200) }); return; }

  // Design
  log('Designing app...');
  let design;
  try {
    design = await designApp(idea, { model });
    fs.writeFileSync(path.join(appDir, 'design.json'), JSON.stringify(design, null, 2), 'utf8');
    log(`Design: ${design.screens.length} screens`);
  } catch (e) {
    out({ ok: false, stage: 'design', error: e.message });
    return;
  }

  // Generate
  log('Generating app...');
  const genR = await runAppGenerator(appDir, design, {
    model,
    onProgress: (m) => log(m),
  });
  log(`Generator: ${genR.passed}/${genR.total} screens, bundle ${genR.bundleOk ? 'OK' : 'FAIL'}`);

  // Taste polish
  log('Polishing...');
  await exec('node', [path.join(ROOT, 'orchestrator', 'taste-agent.js'), appDir, JSON.stringify(idea)], { timeout: 60_000 });

  // Bundle test
  log('Testing bundle...');
  const testR = await exec('node', [path.join(ROOT, 'orchestrator', 'expo-go-test.js'), appDir], { timeout: 60_000 });

  const screenNames = design.screens.map(s => s.name);
  const featureCount = design.screens.reduce((a, s) => a + s.features.length, 0);

  out({
    ok: testR.ok,
    stage: 'complete',
    app: {
      name: idea.name,
      slug: idea.slug,
      description: idea.description,
      path: appDir,
      screens: screenNames,
      featureCount,
    },
    generation: {
      screensBuilt: genR.passed,
      screensTotal: genR.total,
      bundleOk: genR.bundleOk,
      duration: genR.duration,
    },
    bundleTest: testR.ok ? 'passed' : 'failed',
    preview: `cd ${appDir} && npx expo start`,
  });
}

async function cmdEdit(slug, editRequest) {
  const appDir = path.join(ROOT, 'apps', slug);
  if (!fs.existsSync(appDir)) { out({ ok: false, error: `App not found: apps/${slug}` }); return; }

  log(`Editing ${slug}: ${editRequest}`);

  let idea = null;
  const fp = path.join(appDir, 'design.json');
  if (fs.existsSync(fp)) { try { idea = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch {} }

  const result = await runCodeAgent({
    appDir,
    task: editRequest,
    idea,
    model: process.env.CODE_MODEL || 'google/gemini-2.0-flash-001',
    onProgress: (m) => log(m),
  });

  if (result.ok) {
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
  const bundleR = await exec('node', [path.join(ROOT, 'orchestrator', 'expo-go-test.js'), appDir], { timeout: 60_000 });

  out({
    ok: bundleR.ok,
    bundle: bundleR.ok ? 'passed' : 'failed',
  });
}

function cmdList() {
  const appsDir = path.join(ROOT, 'apps');
  if (!fs.existsSync(appsDir)) { out({ ok: true, apps: [] }); return; }

  const apps = fs.readdirSync(appsDir)
    .filter(d => fs.existsSync(path.join(appsDir, d, 'package.json')))
    .map(slug => {
      const dp = path.join(appsDir, slug, 'design.json');
      const fp = path.join(appsDir, slug, 'features.json');
      let info = {};
      if (fs.existsSync(dp)) { try { info = JSON.parse(fs.readFileSync(dp, 'utf8')); } catch {} }
      else if (fs.existsSync(fp)) { try { info = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch {} }
      return {
        slug,
        name: info.name || slug,
        description: info.description || '',
        screens: info.screens?.length || 0,
      };
    });

  out({ ok: true, count: apps.length, apps });
}

function cmdStatus(slug) {
  const appDir = path.join(ROOT, 'apps', slug);
  if (!fs.existsSync(appDir)) { out({ ok: false, error: `App not found: apps/${slug}` }); return; }

  const dp = path.join(appDir, 'design.json');
  let design = {};
  if (fs.existsSync(dp)) { try { design = JSON.parse(fs.readFileSync(dp, 'utf8')); } catch {} }

  out({
    ok: true,
    slug,
    name: design.name || slug,
    description: design.description || '',
    screens: design.screens?.length || 0,
    features: design.screens?.reduce((a, s) => a + (s.features?.length || 0), 0) || 0,
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
    ],
    command: `cd ${appDir} && npx expo start`,
  });
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  switch (cmd) {
    case 'build': await cmdBuild(args.join(' ')); break;
    case 'edit': await cmdEdit(args[0], args.slice(1).join(' ')); break;
    case 'test': await cmdTest(args[0]); break;
    case 'list': cmdList(); break;
    case 'status': cmdStatus(args[0]); break;
    case 'preview': cmdPreview(args[0]); break;
    default:
      out({
        ok: false,
        error: 'Unknown command',
        usage: {
          build: 'node openclaw/bridge.js build "description"',
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
