#!/usr/bin/env node
/**
 * Headless Telegram E2E scenario runner.
 *
 * Runs black-box-ish scenarios without live Telegram chat by loading bot runtime
 * in headless + dry-run mode and invoking public action handlers.
 *
 * Usage:
 *   BOT_HEADLESS_TEST=1 BOT_E2E_DRY_RUN=1 node orchestrator/telegram-e2e.js --slug near-fear
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');

if (process.env.BOT_HEADLESS_TEST !== '1') process.env.BOT_HEADLESS_TEST = '1';
if (process.env.BOT_E2E_DRY_RUN !== '1') process.env.BOT_E2E_DRY_RUN = '1';

const botRuntime = require('../bot/telegram');

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

async function run() {
  const appDir = resolveAppDir();
  if (!appDir || !fs.existsSync(appDir)) {
    console.error('Usage: BOT_HEADLESS_TEST=1 BOT_E2E_DRY_RUN=1 node orchestrator/telegram-e2e.js --slug <slug> | --app <appDir>');
    process.exit(1);
  }

  const slug = path.basename(appDir);
  const chatId = 999001;
  const checks = [];

  const session = botRuntime.__test.setCurrentApp(chatId, {
    slug,
    appDir,
    stage: 'ready',
    idea: { name: slug, architecture: 'generic', domain: 'test', description: 'headless e2e scenario' },
  });
  session.building = false;

  // 1) status works
  const status = botRuntime.actionStatus(chatId);
  checks.push({
    name: 'status:returns-current-app',
    ok: status.includes(slug),
    message: status.slice(0, 120),
  });

  // 2) preview path (preflight + dry-run) works
  const preview = await botRuntime.actionPreview(chatId);
  checks.push({
    name: 'preview:dry-run-after-preflight',
    ok: /dry-run OK/i.test(preview),
    message: preview.slice(0, 160),
  });

  // 3) deploy path (strict gate + dry-run) works
  const deploy = await botRuntime.actionDeploy(chatId);
  checks.push({
    name: 'deploy:dry-run-after-strict-gate',
    ok: /dry-run OK/i.test(deploy),
    message: deploy.slice(0, 160),
  });

  // 4) message chunking works
  botRuntime.__test.clearHeadlessMessages();
  const longMsg = 'A'.repeat(9000);
  await botRuntime.sendMsg(chatId, longMsg);
  const sentCount = botRuntime.__test.headlessMessages.filter((m) => m.kind === 'message').length;
  checks.push({
    name: 'messaging:chunking',
    ok: sentCount >= 3,
    message: `chunks=${sentCount}`,
  });

  // 5) stop kills tracked process
  const sleeper = spawn('sleep', ['30'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'ignore'] });
  botRuntime.trackProcess(chatId, sleeper, 'e2e-sleeper');
  const stopResult = await botRuntime.actionStop(chatId);
  await new Promise((r) => setTimeout(r, 300));
  const stopped = sleeper.killed || sleeper.exitCode !== null;
  checks.push({
    name: 'stop:kills-tracked-process',
    ok: stopped,
    message: stopResult.slice(0, 160),
  });

  const passed = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const ok = passed === total;

  const report = {
    ok,
    appDir,
    summary: `${passed}/${total} checks passed`,
    checks,
    headless: botRuntime.__test.isHeadless,
    dryRun: botRuntime.__test.isDryRun,
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(ok ? 0 : 1);
}

run().catch((e) => {
  console.error(`telegram-e2e fatal: ${e.message}`);
  process.exit(1);
});

