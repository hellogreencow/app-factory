#!/usr/bin/env node
/**
 * Review Agent — agentic audit phase that runs before/after deploy.
 *
 * Pre-deploy: validates config, deps, credentials, ASC state, known error patterns.
 * Post-failure: pattern-matches deploy/build errors and applies auto-fixes.
 * Runs continuously in the pipeline to catch issues before they waste build minutes.
 *
 * Usage:
 *   node review-agent.js pre-deploy <slug>    — full pre-deploy audit
 *   node review-agent.js post-failure <slug> <error_text>  — diagnose + fix
 *   node review-agent.js audit-all            — audit all apps in apps/
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { checkAppReadyForSubmit, findApp, validateCredentials } = require('./asc-api');

const ROOT = path.join(__dirname, '..');
const EXPO_SDK = '52';

const REQUIRED_DEPS_SDK52 = {
  'react-native-screens': '~4.4.0',
  'react-native-safe-area-context': '4.12.0',
  '@react-native-async-storage/async-storage': '1.23.1',
};

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

function execAsync(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    let stdout = '', stderr = '';
    const proc = spawn(cmd, args, { cwd: opts.cwd || ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stdout.on('data', d => stdout += d);
    proc.stderr.on('data', d => stderr += d);
    proc.on('close', code => resolve({ ok: code === 0, stdout, stderr }));
    proc.on('error', e => resolve({ ok: false, stdout, stderr: e.message }));
  });
}

// ─── Pre-deploy checks ──────────────────────────────────────────────────────

async function checkDependencyVersions(appDir) {
  const fixes = [];
  const pkgPath = path.join(appDir, 'package.json');
  const pkg = readJSON(pkgPath);
  if (!pkg) return [{ severity: 'error', check: 'package.json', msg: 'Missing or invalid package.json' }];

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [dep, expected] of Object.entries(REQUIRED_DEPS_SDK52)) {
    const actual = deps[dep];
    if (!actual) continue;
    const cleanExpected = expected.replace(/^[~^]/, '');
    const cleanActual = actual.replace(/^[~^]/, '');
    if (cleanActual !== cleanExpected && actual !== expected) {
      fixes.push({
        severity: 'error',
        check: 'depVersion',
        msg: `${dep}: ${actual} → ${expected} (SDK ${EXPO_SDK} compat)`,
        autofix: { pkg: dep, from: actual, to: expected },
      });
    }
  }
  return fixes;
}

async function checkEslint(appDir, slug) {
  const lintScript = path.join(ROOT, 'scripts', 'lint.sh');
  if (!fs.existsSync(lintScript)) return [{ severity: 'warn', check: 'lint', msg: 'lint.sh not found' }];

  const r = await execAsync(lintScript, [slug], { cwd: ROOT });
  if (r.ok) return [{ severity: 'ok', check: 'lint', msg: 'Lint passed' }];

  const errorLines = r.stdout.split('\n').filter(l => /\d+:\d+\s+error/.test(l));
  return [{
    severity: 'error',
    check: 'lint',
    msg: `Lint failed: ${errorLines.length} errors`,
    details: errorLines.slice(0, 10).join('\n'),
  }];
}

async function checkGitState(appDir) {
  const issues = [];
  if (!fs.existsSync(path.join(appDir, '.git'))) {
    issues.push({ severity: 'warn', check: 'git', msg: 'No git repo — deploy.sh will init one', autofix: 'git-init' });
  }
  return issues;
}

async function preDeployAudit(slug) {
  const appDir = path.join(ROOT, 'apps', slug);
  const results = { slug, timestamp: new Date().toISOString(), checks: [], actions: [] };

  console.log(`[review] Pre-deploy audit: ${slug}`);

  // 1. ASC readiness (credentials, bundle ID, app existence)
  const ascReady = await checkAppReadyForSubmit(slug);
  results.checks.push(...ascReady.issues);

  // 2. Dependency versions
  const depChecks = await checkDependencyVersions(appDir);
  results.checks.push(...depChecks);

  // Auto-fix dep versions
  const depFixes = depChecks.filter(c => c.autofix);
  if (depFixes.length > 0) {
    const pkgPath = path.join(appDir, 'package.json');
    const pkg = readJSON(pkgPath);
    if (pkg) {
      for (const fix of depFixes) {
        const { pkg: dep, to } = fix.autofix;
        if (pkg.dependencies?.[dep]) pkg.dependencies[dep] = to;
        if (pkg.devDependencies?.[dep]) pkg.devDependencies[dep] = to;
        results.actions.push({ action: 'fix-dep', dep, to });
      }
      writeJSON(pkgPath, pkg);
      console.log(`[review] Fixed ${depFixes.length} dependency versions`);

      await execAsync('npm', ['install'], { cwd: appDir });
      results.actions.push({ action: 'npm-install' });
    }
  }

  // 3. Lint check
  const lintChecks = await checkEslint(appDir, slug);
  results.checks.push(...lintChecks);

  // 4. Git state
  const gitChecks = await checkGitState(appDir);
  results.checks.push(...gitChecks);

  // 5. app.json completeness
  const appJson = readJSON(path.join(appDir, 'app.json'));
  if (appJson?.expo) {
    if (!appJson.expo.owner) {
      appJson.expo.owner = 'olimorley';
      writeJSON(path.join(appDir, 'app.json'), appJson);
      results.actions.push({ action: 'set-owner' });
    }
    if (!appJson.expo.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false) {
      appJson.expo.ios = appJson.expo.ios || {};
      appJson.expo.ios.infoPlist = appJson.expo.ios.infoPlist || {};
      appJson.expo.ios.infoPlist.ITSAppUsesNonExemptEncryption = false;
      writeJSON(path.join(appDir, 'app.json'), appJson);
      results.actions.push({ action: 'set-encryption-flag' });
    }
  }

  // Summary
  const blockers = results.checks.filter(c => c.severity === 'blocker');
  const errors = results.checks.filter(c => c.severity === 'error');
  const warnings = results.checks.filter(c => c.severity === 'warn');
  const ok = results.checks.filter(c => c.severity === 'ok');

  results.summary = {
    ready: blockers.length === 0 && errors.length === 0,
    blockers: blockers.length,
    errors: errors.length,
    warnings: warnings.length,
    passed: ok.length,
    actions_taken: results.actions.length,
  };

  // Print results
  for (const c of results.checks) {
    const icon = c.severity === 'ok' ? 'PASS' : c.severity === 'warn' ? 'WARN' : c.severity === 'blocker' ? 'BLOCK' : 'FAIL';
    console.log(`[review] [${icon}] ${c.check}: ${c.msg}`);
  }
  for (const a of results.actions) {
    console.log(`[review] [FIX] ${a.action}: ${a.dep || a.to || ''}`);
  }

  console.log(`[review] Summary: ${results.summary.ready ? 'READY' : 'NOT READY'} — ${results.summary.blockers} blockers, ${results.summary.errors} errors, ${results.summary.warnings} warnings, ${results.summary.passed} passed, ${results.summary.actions_taken} auto-fixes`);

  return results;
}

// ─── Post-failure diagnosis ──────────────────────────────────────────────────

const ERROR_PATTERNS = [
  {
    pattern: /pod install.*failed|Install pods.*failed/i,
    diagnosis: 'CocoaPods install failed — likely dependency version mismatch with Expo SDK',
    autofix: 'fix-deps',
  },
  {
    pattern: /Distribution Certificate is not validated/i,
    diagnosis: 'Distribution certificate not set up — needs interactive first-time setup via eas-build-interactive.exp',
    autofix: 'interactive-build',
  },
  {
    pattern: /Maximum number of Distribution Certificates/i,
    diagnosis: 'Hit certificate limit (max 3). NEVER auto-revoke. User must manually revoke an old cert in developer.apple.com',
    autofix: null,
  },
  {
    pattern: /ascAppId.*not set|Set ascAppId/i,
    diagnosis: 'App not on App Store Connect. Must be created manually in ASC web UI (Apple API does not support app creation)',
    autofix: 'create-app-asc',
  },
  {
    pattern: /app\.json.*missing.*ITSAppUsesNonExemptEncryption/i,
    diagnosis: 'Missing encryption compliance flag in app.json',
    autofix: 'set-encryption',
  },
  {
    pattern: /Must configure EAS project/i,
    diagnosis: 'EAS project not linked. Running eas init.',
    autofix: 'eas-init',
  },
  {
    pattern: /EAS_BUILD_PLATFORM.*not found|eas.*not found/i,
    diagnosis: 'eas-cli not installed',
    autofix: 'install-eas',
  },
  {
    pattern: /FORBIDDEN_ERROR.*apps.*does not allow.*CREATE/i,
    diagnosis: 'Apple ASC API does not support creating apps via REST. App must be created in ASC web UI.',
    autofix: 'create-app-asc',
  },
  {
    pattern: /Submission.*failed.*not found on App Store Connect/i,
    diagnosis: 'App not found on ASC for submission',
    autofix: 'create-app-asc',
  },
];

async function postFailureDiagnosis(slug, errorText) {
  const appDir = path.join(ROOT, 'apps', slug);
  const results = { slug, timestamp: new Date().toISOString(), diagnoses: [], actions: [] };

  console.log(`[review] Post-failure diagnosis: ${slug}`);

  for (const ep of ERROR_PATTERNS) {
    if (ep.pattern.test(errorText)) {
      results.diagnoses.push({ pattern: ep.pattern.source.slice(0, 50), diagnosis: ep.diagnosis, autofix: ep.autofix });
      console.log(`[review] MATCH: ${ep.diagnosis}`);

      if (ep.autofix === 'fix-deps') {
        const pkgPath = path.join(appDir, 'package.json');
        const pkg = readJSON(pkgPath);
        if (pkg) {
          for (const [dep, ver] of Object.entries(REQUIRED_DEPS_SDK52)) {
            if (pkg.dependencies?.[dep]) pkg.dependencies[dep] = ver;
          }
          writeJSON(pkgPath, pkg);
          await execAsync('npm', ['install'], { cwd: appDir });
          results.actions.push({ action: 'fixed-deps', deps: Object.keys(REQUIRED_DEPS_SDK52) });
          console.log('[review] [FIX] Fixed SDK 52 dependency versions + npm install');
        }
      }

      if (ep.autofix === 'set-encryption') {
        const appJsonPath = path.join(appDir, 'app.json');
        const cfg = readJSON(appJsonPath);
        if (cfg?.expo) {
          cfg.expo.ios = cfg.expo.ios || {};
          cfg.expo.ios.infoPlist = cfg.expo.ios.infoPlist || {};
          cfg.expo.ios.infoPlist.ITSAppUsesNonExemptEncryption = false;
          writeJSON(appJsonPath, cfg);
          results.actions.push({ action: 'set-encryption-flag' });
          console.log('[review] [FIX] Set ITSAppUsesNonExemptEncryption = false');
        }
      }

      if (ep.autofix === 'eas-init') {
        await execAsync('npx', ['eas', 'init', '--non-interactive', '--force'], { cwd: appDir });
        results.actions.push({ action: 'eas-init' });
        console.log('[review] [FIX] Ran eas init');
      }

      if (ep.autofix === 'create-app-asc') {
        const cfg = readJSON(path.join(appDir, 'app.json'));
        const name = cfg?.expo?.name || slug;
        const bundleId = cfg?.expo?.ios?.bundleIdentifier || `com.iosappfactory.${slug.replace(/[^a-z0-9]/g, '')}`;
        results.actions.push({
          action: 'needs-manual-app-creation',
          instructions: `Go to appstoreconnect.apple.com → "+" → New App → iOS, name="${name}", bundleId="${bundleId}", SKU="${slug}-001"`,
        });
        console.log(`[review] [MANUAL] Create app on ASC: name="${name}", bundleId="${bundleId}"`);
      }

      if (ep.autofix === 'interactive-build') {
        const expScript = path.join(ROOT, 'scripts', 'eas-build-interactive.exp');
        if (fs.existsSync(expScript)) {
          results.actions.push({ action: 'use-interactive-build', script: expScript });
          console.log('[review] [FIX] Use eas-build-interactive.exp for first-time credential setup');
        }
      }
    }
  }

  if (results.diagnoses.length === 0) {
    results.diagnoses.push({ pattern: 'unknown', diagnosis: 'No known pattern matched. Raw error logged for analysis.' });
    console.log('[review] No known error pattern matched');
  }

  return results;
}

// ─── Audit all apps ──────────────────────────────────────────────────────────

async function auditAll() {
  const appsDir = path.join(ROOT, 'apps');
  if (!fs.existsSync(appsDir)) { console.log('[review] No apps directory'); return; }

  const slugs = fs.readdirSync(appsDir).filter(f => fs.statSync(path.join(appsDir, f)).isDirectory());
  const summary = { total: slugs.length, ready: 0, blocked: 0, issues: [] };

  for (const slug of slugs) {
    const r = await preDeployAudit(slug);
    if (r.summary.ready) summary.ready++;
    else summary.blocked++;
    if (!r.summary.ready) summary.issues.push({ slug, blockers: r.summary.blockers, errors: r.summary.errors });
    console.log('');
  }

  console.log(`[review] === AUDIT COMPLETE ===`);
  console.log(`[review] ${summary.ready}/${summary.total} apps ready for deploy, ${summary.blocked} blocked`);
  return summary;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const [cmd, ...args] = process.argv.slice(2);
  (async () => {
    if (cmd === 'pre-deploy') {
      const r = await preDeployAudit(args[0]);
      process.exit(r.summary.ready ? 0 : 1);
    } else if (cmd === 'post-failure') {
      const slug = args[0];
      const errorText = args.slice(1).join(' ') || fs.readFileSync('/dev/stdin', 'utf8');
      await postFailureDiagnosis(slug, errorText);
    } else if (cmd === 'audit-all') {
      await auditAll();
    } else {
      console.error('Usage: review-agent.js <pre-deploy|post-failure|audit-all> [slug] [error]');
      process.exit(1);
    }
  })().catch(e => { console.error('Fatal:', e); process.exit(1); });
}

module.exports = { preDeployAudit, postFailureDiagnosis, auditAll };
