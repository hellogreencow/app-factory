#!/usr/bin/env node
/**
 * Build Pipeline — self-healing, interface-agnostic app build lifecycle.
 *
 * Owns: scaffold -> design -> generate -> repair -> taste -> QA -> repair -> screenshots
 *
 * Every interface (Telegram, TUI, CLI, OpenClaw) calls pipeline.build(idea, opts)
 * and receives a result object. Zero knowledge of any UI layer.
 *
 * Self-healing: generation failures trigger code-agent repair + retry.
 * QA failures trigger code-agent repair + re-QA. Only reports failure
 * after repair attempts are exhausted.
 */

require('./lib/env').loadEnv();

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { designApp } = require('./designer-agent');
const { run: runAppGenerator } = require('./app-generator');
const { review: tasteReview, applyEdits: tasteApply } = require('./taste-agent');
const { enforceQualityGate } = require('./quality-gate');
const { runCodeAgent } = require('./code-agent');
const { getModels, DEFAULT_TIER } = require('./lib/models');
const { recordSuccess, recordErrorFix, getErrorAvoidanceContext } = require('./lib/build-memory');

const ROOT = path.join(__dirname, '..');

const PHASE = {
  SCAFFOLD: 'scaffold',
  DESIGN: 'design',
  GENERATE: 'generate',
  REPAIR_GEN: 'repair-gen',
  TASTE: 'taste',
  QA: 'qa',
  REPAIR_QA: 'repair-qa',
  SCREENSHOTS: 'screenshots',
  DONE: 'done',
  FAILED: 'failed',
};

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  process.stdout.write(`[${ts}] [pipeline] ${msg}\n`);
}

function exec(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    let stdout = '', stderr = '';
    const proc = spawn(cmd, args, {
      cwd: opts.cwd || ROOT,
      env: { ...process.env, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (opts.onSpawn) opts.onSpawn(proc);
    proc.stdout.on('data', d => stdout += d);
    proc.stderr.on('data', d => stderr += d);
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch (e) { process.stderr.write(`[pipeline] SIGKILL failed: ${e.message}\n`); } }, 3000);
    }, opts.timeout || 120_000);
    proc.on('close', code => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr: stderr.slice(0, 500) });
    });
    proc.on('error', e => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: e.message });
    });
  });
}

function collectScreenshots(appDir) {
  const ssDir = path.join(appDir, 'qa-screenshots');
  if (!fs.existsSync(ssDir)) return [];
  return fs.readdirSync(ssDir)
    .filter(f => f.endsWith('.png'))
    .sort()
    .map(f => path.join(ssDir, f));
}

function ensureExpoEntryPoint(appDir) {
  const pkgPath = path.join(appDir, 'package.json');
  const indexPath = path.join(appDir, 'index.js');
  const routerDir = path.join(appDir, 'app');
  if (!fs.existsSync(pkgPath) || !fs.existsSync(indexPath)) return { ok: true };
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const main = String(pkg.main || '');
    // Generated apps are classic Expo entry apps unless an Expo Router app/ tree exists.
    if (main === 'expo-router/entry' && !fs.existsSync(routerDir)) {
      pkg.main = 'index.js';
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
      log('Set package main to index.js (router entry was invalid for this app)');
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Unable to enforce package main entry: ${e.message}` };
  }
}

async function ensureMinimumExpoSdk(appDir, onProgress, onSpawn) {
  const pkgPath = path.join(appDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return { ok: true };
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const expoSpec = pkg.dependencies?.expo || pkg.devDependencies?.expo || '';
    const expoMajor = parseInt(String(expoSpec).match(/\d+/)?.[0] || '0', 10);
    if (expoMajor >= 54) return { ok: true };

    pkg.dependencies = pkg.dependencies || {};
    pkg.dependencies.expo = '~54.0.0';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
    log(`Upgraded Expo SDK floor to 54 (was "${expoSpec || 'missing'}")`);
    onProgress('Upgrading Expo SDK baseline to 54...');

    const npmR = await exec('npm', ['install'], { cwd: appDir, timeout: 180_000, onSpawn });
    if (!npmR.ok) return { ok: false, error: `npm install failed after Expo SDK bump: ${npmR.stderr}` };

    const expoR = await exec(
      'npx',
      ['expo', 'install', 'react', 'react-native', 'expo-status-bar', 'react-native-screens', 'react-native-safe-area-context', '@react-native-async-storage/async-storage'],
      { cwd: appDir, timeout: 180_000, onSpawn }
    );
    if (!expoR.ok) return { ok: false, error: `expo install failed after Expo SDK bump: ${expoR.stderr}` };

    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Unable to enforce Expo SDK floor: ${e.message}` };
  }
}

// ── Main build pipeline ──────────────────────────────────────────────────────

async function build(idea, opts = {}) {
  const tier = opts.tier || DEFAULT_TIER;
  const models = getModels(tier);
  // opts.model is a legacy override — if passed it applies to all roles.
  const legacyModel = opts.model;
  const m = (role) => legacyModel || models[role] || models.codegen;
  const onProgress = opts.onProgress || (() => {});
  const onSpawn = opts.onSpawn || (() => {});
  const isAborted = opts.isAborted || (() => false);
  const t0 = Date.now();

  const result = {
    ok: false,
    phase: PHASE.SCAFFOLD,
    appDir: null,
    design: null,
    genResult: null,
    qaResult: null,
    screenshots: [],
    errors: [],
    duration: null,
  };

  // ── Phase 1: Scaffold ────────────────────────────────────────────────────

  result.phase = PHASE.SCAFFOLD;
  onProgress('Creating project...');

  const appDir = opts.appDir || path.join(ROOT, 'apps', idea.slug);
  result.appDir = appDir;

  if (!fs.existsSync(appDir)) {
    const scaffR = await exec(
      path.join(ROOT, 'scripts', 'scaffold-minimal.sh'),
      [idea.slug],
      { timeout: 180_000, onSpawn }
    );
    if (!scaffR.ok) {
      result.phase = PHASE.FAILED;
      result.errors.push({ phase: 'scaffold', message: scaffR.stderr.slice(0, 200) });
      result.duration = elapsed(t0);
      return result;
    }
  }

  const sdkR = await ensureMinimumExpoSdk(appDir, onProgress, onSpawn);
  if (!sdkR.ok) {
    result.phase = PHASE.FAILED;
    result.errors.push({ phase: 'scaffold', message: sdkR.error.slice(0, 250) });
    result.duration = elapsed(t0);
    return result;
  }

  const entryR = ensureExpoEntryPoint(appDir);
  if (!entryR.ok) {
    result.phase = PHASE.FAILED;
    result.errors.push({ phase: 'scaffold', message: entryR.error.slice(0, 250) });
    result.duration = elapsed(t0);
    return result;
  }

  // Ensure newArchEnabled for Expo Go compatibility
  const appJsonPath = path.join(appDir, 'app.json');
  if (fs.existsSync(appJsonPath)) {
    try {
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      if (!appJson.expo?.newArchEnabled) {
        appJson.expo = appJson.expo || {};
        appJson.expo.newArchEnabled = true;
        fs.writeFileSync(appJsonPath, JSON.stringify(appJson));
        log('Set newArchEnabled in app.json');
      }
    } catch (e) { log(`Could not set newArchEnabled: ${e.message}`); }
  }

  if (isAborted()) return aborted(result, t0);

  // ── Phase 2: Design ──────────────────────────────────────────────────────

  result.phase = PHASE.DESIGN;
  onProgress('Designing app architecture...');

  let design;
  try {
    design = await designApp(idea, { model: m('design') });
    const designPath = path.join(appDir, 'design.json');
    fs.writeFileSync(designPath, JSON.stringify(design, null, 2), 'utf8');
    result.design = design;
    log(`Design: ${design.screens.length} screens, ${(design.dataModel?.entities || []).length} entities`);
    onProgress(`Designed ${design.screens.length} screens`);
  } catch (e) {
    result.phase = PHASE.FAILED;
    result.errors.push({ phase: 'design', message: e.message.slice(0, 300) });
    result.duration = elapsed(t0);
    return result;
  }

  if (isAborted()) return aborted(result, t0);

  // ── Phase 3: Generate ────────────────────────────────────────────────────

  result.phase = PHASE.GENERATE;
  onProgress('Building screens...');

  let genResult;
  try {
    genResult = await runAppGenerator(appDir, design, {
      model: m('codegen'),
      allowStubs: true,
      minScreenPassRatio: 0.5,
      onProgress,
    });
    result.genResult = genResult;
    log(`Generator: ${genResult.passed}/${genResult.total} screens, ${genResult.stubs || 0} stubs, bundle ${genResult.bundleOk ? 'OK' : 'FAIL'}`);
  } catch (e) {
    result.phase = PHASE.FAILED;
    result.errors.push({ phase: 'generate', message: e.message.slice(0, 300) });
    result.duration = elapsed(t0);
    return result;
  }

  if (isAborted()) return aborted(result, t0);

  // ── Phase 4: Repair generation failures ──────────────────────────────────

  const failedScreens = (genResult.screens || []).filter(s => s.stub || !s.ok);

  if (failedScreens.length > 0) {
    result.phase = PHASE.REPAIR_GEN;
    onProgress(`Repairing ${failedScreens.length} screen(s)...`);

    for (let repairRound = 1; repairRound <= 2; repairRound++) {
      const toRepair = (genResult.screens || []).filter(s => s.stub || !s.ok);
      if (toRepair.length === 0) break;

      log(`Repair round ${repairRound}: ${toRepair.length} screen(s) need work`);
      onProgress(`Repair round ${repairRound}: ${toRepair.map(s => s.name).join(', ')}`);

      const repairTask = buildRepairPrompt(design, toRepair);

      try {
        const repair = await runCodeAgent({
          appDir,
          task: repairTask,
          idea,
          model: m('repair'),
          onProgress,
        });
        log(`Repair round ${repairRound}: ${repair.filesChanged?.length || 0} files changed`);

        if (repair.filesChanged?.includes('package.json')) {
          onProgress('Installing dependencies after repair...');
          await exec('npm', ['install'], { cwd: appDir, timeout: 120_000 });
        }
      } catch (e) {
        log(`Repair round ${repairRound} crashed: ${e.message}`);
        result.errors.push({ phase: 'repair-gen', message: `Repair round ${repairRound} crashed: ${e.message.slice(0, 200)}` });
      }

      if (isAborted()) return aborted(result, t0);

      // Re-run generator to pick up repaired screens and verify bundle
      try {
        genResult = await runAppGenerator(appDir, design, {
          model: m('codegen'),
          allowStubs: false,
          minScreenPassRatio: 1,
          onProgress,
        });
        result.genResult = genResult;
        log(`Post-repair: ${genResult.passed}/${genResult.total} screens, bundle ${genResult.bundleOk ? 'OK' : 'FAIL'}`);

        if (genResult.ok) break;
      } catch (e) {
        log(`Post-repair generator failed: ${e.message}`);
      }
    }

    if (!genResult.ok) {
      const stillBroken = (genResult.screens || []).filter(s => !s.ok).map(s => s.name);
      result.phase = PHASE.FAILED;
      result.errors.push({
        phase: 'generate',
        message: `${stillBroken.length} screen(s) still broken after repair: ${stillBroken.join(', ')}`,
      });
      result.duration = elapsed(t0);
      return result;
    }
  }

  if (isAborted()) return aborted(result, t0);

  // ── Phase 5: Taste ───────────────────────────────────────────────────────

  result.phase = PHASE.TASTE;
  onProgress('Polishing copy and colors...');

  try {
    const reviewResult = await tasteReview(appDir, idea);
    if (reviewResult.ok && reviewResult.edits) {
      const { applied, skipped } = await tasteApply(appDir, reviewResult.edits);
      log(`Taste: ${applied} edits applied, ${skipped} skipped. ${reviewResult.rationale || ''}`);
    }
  } catch (e) {
    log(`Taste failed (non-fatal): ${e.message}`);
  }

  if (isAborted()) return aborted(result, t0);

  // ── Phase 6: Strict QA ───────────────────────────────────────────────────

  result.phase = PHASE.QA;
  onProgress('Running strict quality gate...');

  let qaResult;
  try {
    qaResult = await enforceQualityGate(appDir, {
      mode: 'strict',
      autofix: true,
      model: m('repair'),
      onProgress,
    });
    result.qaResult = qaResult;
    log(`QA: static=${qaResult.staticOk} bundle=${qaResult.bundleOk} runtime=${qaResult.runtimeOk} fixes=${qaResult.fixesApplied || 0}`);
  } catch (e) {
    log(`QA crashed: ${e.message}`);
    qaResult = { ok: false, staticOk: false, bundleOk: false, runtimeOk: false, errors: [{ phase: 'qa', message: `QA crashed: ${e.message}` }], screenshots: [] };
    result.qaResult = qaResult;
    result.errors.push({ phase: 'qa', message: `QA process crashed: ${e.message.slice(0, 200)}` });
  }

  if (isAborted()) return aborted(result, t0);

  // ── Phase 7: Repair QA failures ──────────────────────────────────────────

  if (!qaResult.ok) {
    result.phase = PHASE.REPAIR_QA;

    for (let qaRepairRound = 1; qaRepairRound <= 2; qaRepairRound++) {
      const qaErrors = (qaResult.errors || []).map(e => `- ${e.message || e}`).join('\n');
      onProgress(`QA failed. Repair attempt ${qaRepairRound}...`);
      log(`QA repair round ${qaRepairRound}`);

      try {
        const repair = await runCodeAgent({
          appDir,
          task: `Fix strict QA failures. Keep all features intact.\n\nErrors:\n${qaErrors || '- unknown'}\n\nRules:\n- Fix runtime/bundle/static errors.\n- Do not simplify screens into placeholders.\n- Keep navigation and context contracts stable.`,
          idea,
          model: m('repair'),
          onProgress,
        });

        if (repair.filesChanged?.includes('package.json')) {
          await exec('npm', ['install'], { cwd: appDir, timeout: 120_000 });
        }
      } catch (e) {
        log(`QA repair round ${qaRepairRound} crashed: ${e.message}`);
        result.errors.push({ phase: 'repair-qa', message: `QA repair round ${qaRepairRound} crashed: ${e.message.slice(0, 200)}` });
      }

      if (isAborted()) return aborted(result, t0);

      try {
        qaResult = await enforceQualityGate(appDir, {
          mode: 'strict',
          autofix: true,
          model: m('repair'),
          onProgress,
        });
        result.qaResult = qaResult;
        log(`Post-QA-repair: static=${qaResult.staticOk} bundle=${qaResult.bundleOk} runtime=${qaResult.runtimeOk}`);

        if (qaResult.ok) break;
      } catch (e) {
        log(`Post-QA-repair gate crashed: ${e.message}`);
        qaResult = { ok: false, staticOk: false, bundleOk: false, runtimeOk: false, errors: [{ phase: 'qa-repair', message: `QA crashed after repair: ${e.message}` }], screenshots: [] };
        result.qaResult = qaResult;
        result.errors.push({ phase: 'qa-repair', message: `Post-repair QA crashed: ${e.message.slice(0, 200)}` });
      }
    }

    if (!qaResult.ok) {
      const errSummary = (qaResult.errors || []).map(e => e.message?.slice(0, 100) || String(e)).slice(0, 5);
      result.phase = PHASE.FAILED;
      result.errors.push({ phase: 'qa', message: `Strict QA failed after repair: ${errSummary.join('; ')}` });
      result.duration = elapsed(t0);
      result.screenshots = collectScreenshots(appDir);
      return result;
    }
  }

  // ── Phase 8: Collect screenshots ─────────────────────────────────────────

  result.phase = PHASE.SCREENSHOTS;
  result.screenshots = (qaResult.screenshots || []).length > 0
    ? qaResult.screenshots
    : collectScreenshots(appDir);

  // ── Done ─────────────────────────────────────────────────────────────────

  result.ok = true;
  result.phase = PHASE.DONE;
  result.duration = elapsed(t0);
  log(`Pipeline complete in ${result.duration}s: ${design.screens.length} screens, QA passed`);

  try { recordSuccess({ ok: true, design, duration: result.duration }); } catch (e) { /* non-blocking */ }

  return result;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function elapsed(t0) {
  return ((Date.now() - t0) / 1000).toFixed(1);
}

function aborted(result, t0) {
  result.phase = PHASE.FAILED;
  result.errors.push({ phase: result.phase, message: 'Aborted by user' });
  result.duration = elapsed(t0);
  return result;
}

function buildRepairPrompt(design, failedScreens) {
  const screenList = failedScreens.map(s => {
    const spec = design.screens.find(ds => ds.name === s.name);
    if (!spec) return `- ${s.name}: no spec found`;
    const features = (spec.features || []).map(f => `${f.name}: ${f.description}`).join('; ');
    return `- ${s.name} (${spec.file}): ${spec.purpose}. Features: ${features}. Layout: ${spec.layout}`;
  }).join('\n');

  return `Production repair: implement all broken/stub screens as full-featured, production-quality React Native components.

BROKEN SCREENS:
${screenList}

DESIGN CONTEXT:
- Style: bg=${design.style.backgroundColor}, text=${design.style.textColor}, accent=${design.style.accentColor}, cards=${design.style.cardColor}
- Data hook: ${design.context?.hook || 'useAppData'} from ${design.context?.file || 'src/context/AppContext.js'}
- Entities: ${(design.dataModel?.entities || []).map(e => e.name).join(', ')}

RULES:
1. Read the existing context file and App.js FIRST to understand exact exports, hook name, and method names.
2. Each screen must have real UI with data interactions — not placeholder text.
3. Use only installed packages (check package.json).
4. Match the design style (colors, borderRadius, icons).
5. Use @expo/vector-icons for icons.
6. Handle empty states with helpful messages.
7. Every interactive element needs testID and accessibilityLabel.
8. Run <run_test></run_test> after writing each screen to verify bundle compiles.`;
}

// ── CLI mode ─────────────────────────────────────────────────────────────────

if (require.main === module) {
  const ideaArg = process.argv[2];
  if (!ideaArg) {
    console.error('Usage: pipeline.js <ideaJson>');
    process.exit(1);
  }

  const idea = JSON.parse(ideaArg);
  build(idea, {
    onProgress: (msg) => console.log(`  >> ${msg}`),
  }).then(r => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  }).catch(e => {
    console.error(`Fatal: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { build, PHASE };
