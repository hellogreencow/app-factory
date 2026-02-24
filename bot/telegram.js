#!/usr/bin/env node
/**
 * iOS App Factory — Conversational Telegram Bot
 *
 * Architecture:
 *   1. Every user message -> LLM conversation router (decides chat vs action)
 *   2. LLM emits [ACTION:...] when it's time to build/preview/deploy
 *   3. Bot executes the pipeline action, streams progress to user
 *   4. Action results are sent directly (NOT re-interpreted by LLM)
 *
 * Pipeline per app:
 *   Scaffold -> Template copy -> LLM customization -> npm install ->
 *   Bundle test -> Simulator screenshot -> Ready
 *
 * Models:
 *   Conversation: google/gemini-2.0-flash-001 ($0.10/M)
 *   Free fallback: meta-llama/llama-3.3-70b-instruct:free
 *   Code customization: openai/gpt-4o-mini (free) / anthropic/claude-sonnet-4 (premium)
 */

require('../orchestrator/lib/env').loadEnv();

const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { chat: llmChat } = require('../orchestrator/lib/llm');
const { runCodeAgent } = require('../orchestrator/code-agent');
const { run: runFeatureBuilder } = require('../orchestrator/feature-builder');

const ROOT = path.join(__dirname, '..');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN not set in .env');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

const CONV_MODEL = 'google/gemini-2.0-flash-001';
const CONV_MODEL_FREE = 'meta-llama/llama-3.3-70b-instruct:free';
const CODE_MODEL = 'google/gemini-3-flash-preview';
const CODE_MODEL_PREMIUM = 'anthropic/claude-sonnet-4.6';
const TASTE_MODEL = 'google/gemini-3-flash-preview';
const GEN_MODEL_FREE = 'google/gemini-3-flash-preview';
const GEN_MODEL_PREMIUM = 'anthropic/claude-sonnet-4.6';

const MAX_HISTORY = 30;

// Typing indicator: re-sends every 4s to stay visible during long operations
function startTyping(chatId) {
  bot.sendChatAction(chatId, 'typing').catch(() => {});
  const interval = setInterval(() => {
    bot.sendChatAction(chatId, 'typing').catch(() => {});
  }, 4000);
  return () => clearInterval(interval);
}

const SYSTEM_PROMPT = `You are the iOS App Factory bot. You build real, working iOS apps through conversation.

PERSONALITY: Thoughtful, sharp, curious. You're a product designer who happens to have a build pipeline. You care about why an app should exist, not just what it does. Direct but warm. Short messages (2-5 lines). No corporate speak or buzzwords. Occasionally wry.

YOUR CORE BELIEF: Every app should solve a genuine human need or bring something beautiful into someone's daily life. You'd rather spend 3 more messages refining an idea than build something mediocre.

CONVERSATION PHASES:

1. EXPLORING — User has a vague idea or none. Your job:
   - Ask one sharp question at a time. Never dump a list of 5 questions.
   - Probe what problem they actually face. "What's frustrating you right now?" beats "What category?"
   - Suggest unexpected angles. If they say "fitness app" — ask what part of fitness makes them give up.
   - Challenge obvious ideas gently. "There are 400 habit trackers. What would make yours the one you actually open?"

2. REFINING — You understand the core need. Now shape it:
   - Propose a concrete concept. Name it. One-line pitch.
   - Suggest a design philosophy (minimal, dark, playful, brutalist, warm)
   - Ask 1-2 specific design choices: "Should it nag you or stay quiet until you come to it?"
   - When the user seems happy, confirm the final spec and BUILD.

3. BUILDING — Idea is locked. The system handles updates. Keep your message brief.

4. READY — App is built. Suggest preview or deploy.

SURPRISE ME / RANDOM MODE:
When someone says "surprise me", "random", etc — think of a genuinely interesting underserved human need:
- The 20-minute spiral deciding what to eat
- Wanting to remember good parts of your day but hating journaling
- Splitting things fairly with friends without awkwardness
- Tracking not habits but how things make you feel
- A daily micro-adventure for people stuck in routines
Then trigger [ACTION:custom:your detailed concept here]. Include name, style, domain, key feature.
Do NOT just say "I'll build something" vaguely — describe what you're making in 2-3 lines, THEN trigger the action.

CUSTOMIZATION (explore during refinement):
- Visual style: minimal/clean, dark-mode, warm/organic, bold/brutalist, playful
- Personality: quiet/zen, encouraging, no-nonsense, witty
- Core interaction: daily ritual, on-demand tool, passive tracker, social/shared
- Signature feature: the ONE thing that makes this app worth downloading

Store evolving specs using [REFINE:...] as you shape them.

AVAILABLE ACTIONS (include EXACTLY ONE at the END of your message when ready):

[ACTION:custom:detailed description including name, style, domain, key feature, architecture hint]
[ACTION:edit:what the user wants changed in the current app]
[ACTION:preview]
[ACTION:deploy]
[ACTION:status]
[REFINE:{"name":"Name","description":"pitch","style":"minimal","personality":"quiet","core_interaction":"daily ritual","key_feature":"the hook"}]

CRITICAL RULES:
- Do NOT jump to building for vague ideas. Explore first. 2-4 messages of exploration is normal.
- DO build immediately when: user says "build it", "let's go", "surprise me", or gives a complete specific description.
- When triggering [ACTION:custom:...], include EVERYTHING: name, style, personality, key features, interaction model. This IS the build spec.
- When triggering [ACTION:preview] or [ACTION:deploy], keep your text VERY SHORT ("Getting your preview info..." or "Starting deploy..."). The system sends the real details. Do NOT make up QR codes, links, screenshots, or technical instructions — the system handles that.
- NEVER show or explain the action/refine syntax to users.
- If an app is currently building, tell them to wait. Do NOT trigger another action.
- Action results appear as separate messages from the system. Do NOT duplicate or reinterpret them.
- When the user has a built app and asks to change/edit/fix/add something, trigger [ACTION:edit:detailed description of the change]. Include specifics from the conversation.
- Users can ask about their app's code, request specific features, report bugs, ask for design changes. All of these are edit requests.
- "make the header blue" → [ACTION:edit:Change the header background color to blue across all screens]
- "add a search bar" → [ACTION:edit:Add a search/filter bar to the main browse/list screen]
- "the stats page feels empty" → [ACTION:edit:Improve the stats screen layout - add more visual elements, charts, or insights]
- Pricing: free = random/curated apps + Expo Go preview. Premium = custom apps, better AI, App Store deploy, in-app purchases.
- Keep messages SHORT. One question per message during exploration.

CURRENT STATE will be provided as context.`;

// ── Per-user sessions ────────────────────────────────────────────────────────

const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      tier: 'free',
      history: [],
      currentApp: null,
      building: false,
      ideaDraft: null,
      phase: 'idle',
    });
  }
  return sessions.get(chatId);
}

function addToHistory(session, role, content) {
  session.history.push({ role, content });
  if (session.history.length > MAX_HISTORY) {
    session.history = session.history.slice(-MAX_HISTORY);
  }
}

function sessionContext(session) {
  const parts = [];
  parts.push(`Phase: ${session.phase}`);

  if (session.ideaDraft) {
    parts.push(`Evolving idea draft: ${JSON.stringify(session.ideaDraft)}`);
    parts.push('(You are refining this idea. Keep probing or confirm and build.)');
  }

  const app = session.currentApp;
  if (app) {
    parts.push(`Current app: "${app.idea.name}"`);
    parts.push(`Stage: ${app.stage}`);
    parts.push(`Architecture: ${app.idea.architecture}`);
    parts.push(`Domain: ${app.idea.domain}`);
    parts.push(`Description: ${app.idea.description}`);
  }

  if (session.building) parts.push('STATUS: Currently building. Tell user to wait.');
  if (!app && !session.ideaDraft) parts.push('No app or idea in progress.');

  return parts.join('\n');
}

function log(chatId, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [${chatId}] ${msg}`);
}

// ── Exec helper ──────────────────────────────────────────────────────────────

function exec(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    let stdout = '', stderr = '';
    const proc = spawn(cmd, args, {
      cwd: opts.cwd || ROOT,
      env: { ...process.env, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout.on('data', d => stdout += d);
    proc.stderr.on('data', d => stderr += d);
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 3000);
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

// ── Pipeline: Build an app from idea spec ────────────────────────────────────

async function actionCustom(chatId, description) {
  const session = getSession(chatId);
  const isPremium = session.tier === 'premium';
  session.building = true;

  const stopTyping = startTyping(chatId);
  const model = isPremium ? GEN_MODEL_PREMIUM : GEN_MODEL_FREE;

  const prompt = `You are designing a beautiful, minimal iOS app. Here's what the user wants:

"${description}"

Create a precise app specification. The app should feel intentional and considered.

Output ONLY valid JSON:
{
  "name": "Human Readable Name",
  "slug": "kebab-case-slug",
  "description": "One compelling line that makes someone want to download it",
  "domain": "single-word category",
  "twist": "one of: minimal, dark-mode, offline-first, gamified, AI-assisted, voice-first, privacy-centric, streak-based, community-driven",
  "architecture": "one of: feed, dashboard, tracker, reference, generic",
  "style_notes": "Brief visual/UX direction"
}

Architecture guide:
- feed: scrollable content (posts, cards, timeline) — social, news, discovery
- dashboard: metrics + actions (overview, log, history) — finance, health, analytics
- tracker: time-based entries (calendar, daily log, stats) — habits, fitness, mood
- reference: browse + detail (browse, item detail, bookmarks) — recipes, guides, catalogs
- generic: list + create + detail — anything else

Output ONLY JSON.`;

  let idea;
  try {
    const raw = await llmChat([{ role: 'user', content: prompt }], { model, temperature: 0.8, max_tokens: 512 });
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON');
    idea = JSON.parse(jsonMatch[0]);
    if (!idea.slug) idea.slug = idea.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  } catch (e) {
    stopTyping();
    session.building = false;
    return `Couldn't parse that into an app spec: ${e.message}. Try describing it differently.`;
  }

  if (fs.existsSync(path.join(ROOT, 'apps', idea.slug))) {
    idea.slug = `${idea.slug}-${Date.now().toString(36).slice(-4)}`;
  }

  stopTyping();
  return await buildApp(chatId, idea);
}

async function buildApp(chatId, idea) {
  const session = getSession(chatId);
  session.currentApp = { idea, slug: idea.slug, stage: 'scaffolding', appDir: null };
  const stopTyping = startTyping(chatId);

  const card = `*${idea.name}*\n_${idea.description}_\n\`${idea.architecture}\` · \`${idea.domain}\` · \`${idea.twist}\``;
  await sendMsg(chatId, card);

  // ── Stage 1: Scaffold ──────────────────────────────────────────────────────
  await sendMsg(chatId, 'Creating project structure...');
  const appDir = path.join(ROOT, 'apps', idea.slug);
  if (!fs.existsSync(appDir)) {
    const scaffR = await exec(path.join(ROOT, 'scripts', 'scaffold-minimal.sh'), [idea.slug], { timeout: 90_000 });
    if (!scaffR.ok) {
      stopTyping(); session.building = false;
      session.currentApp.stage = 'failed';
      return `Scaffold failed. ${scaffR.stderr.slice(0, 150)}`;
    }
  }
  session.currentApp.appDir = appDir;

  // ── Stage 2: Template ──────────────────────────────────────────────────────
  session.currentApp.stage = 'template';
  await sendMsg(chatId, `Applying \`${idea.architecture}\` architecture...`);

  const arch = idea.architecture || 'generic';
  const copyR = await exec('node', [
    path.join(ROOT, 'orchestrator', 'template-copy.js'), appDir, arch,
  ], { timeout: 10_000 });
  if (!copyR.ok) {
    stopTyping(); session.building = false;
    session.currentApp.stage = 'failed';
    return 'Template copy failed.';
  }

  await exec('node', [
    path.join(ROOT, 'orchestrator', 'feature-agent.js'), appDir, arch, JSON.stringify(idea),
  ], { timeout: 10_000 });

  // ── Stage 2.5: E2E flows (Maestro) ─────────────────────────────────────────
  session.currentApp.stage = 'flows';
  await exec('node', [
    path.join(ROOT, 'orchestrator', 'flow-generator.js'), appDir,
  ], { timeout: 10_000 });

  // ── Stage 2.8: Dependencies (template deps) ────────────────────────────────
  session.currentApp.stage = 'dependencies';
  await sendMsg(chatId, 'Installing dependencies...');

  const npmR = await exec('npm', ['install'], { cwd: appDir, timeout: 90_000 });
  if (!npmR.ok) {
    stopTyping(); session.building = false;
    session.currentApp.stage = 'failed';
    return 'npm install failed.';
  }

  // ── Stage 3: LLM Code Customization ────────────────────────────────────────
  session.currentApp.stage = 'customizing';
  await sendMsg(chatId, `Writing custom code for *${idea.name}*...`);

  const customR = await exec('node', [
    path.join(ROOT, 'orchestrator', 'customize-agent.js'),
    appDir, arch, JSON.stringify(idea),
  ], { timeout: 90_000 });

  if (!customR.ok) {
    log(chatId, `Customize warning: ${customR.stderr.slice(0, 200)}`);
  }

  // ── Stage 3.3: Feature enrichment ─────────────────────────────────────────
  session.currentApp.stage = 'enriching';
  await sendMsg(chatId, `Building real features for *${idea.name}*...`);

  const enrichR = await runFeatureBuilder(appDir, idea, {
    model: isPremium ? GEN_MODEL_PREMIUM : CODE_MODEL,
    skipCustom: !isPremium,
    onProgress: (msg) => sendMsg(chatId, msg),
  });

  if (enrichR.ok) {
    const built = enrichR.features.filter(f => f.ok).map(f => f.name).join(', ');
    log(chatId, `Feature enrichment: ${enrichR.passed}/${enrichR.features.length} features — ${built}`);
    await sendMsg(chatId, `Built ${enrichR.passed} features: ${built}`);
  } else {
    log(chatId, `Feature enrichment: ${enrichR.passed} ok, ${enrichR.failed} failed`);
    if (enrichR.passed > 0) {
      const built = enrichR.features.filter(f => f.ok).map(f => f.name).join(', ');
      await sendMsg(chatId, `Built ${enrichR.passed} features (${enrichR.failed} skipped): ${built}`);
    }
  }

  // ── Stage 3.5: Taste review ────────────────────────────────────────────────
  session.currentApp.stage = 'taste';
  await sendMsg(chatId, 'Refining the feel...');

  const tasteR = await exec('node', [
    path.join(ROOT, 'orchestrator', 'taste-agent.js'),
    appDir, JSON.stringify(idea),
  ], { timeout: 60_000 });

  if (tasteR.ok) {
    try {
      const tr = JSON.parse(tasteR.stdout);
      if (tr.applied > 0) log(chatId, `Taste: ${tr.applied} refinements — ${tr.rationale}`);
    } catch {}
  }

  // ── Stage 4: Functional test + auto-fix ─────────────────────────────────────
  session.currentApp.stage = 'qa';
  await sendMsg(chatId, 'Running quality checks...');

  const qaR = await exec('node', [
    path.join(ROOT, 'orchestrator', 'functional-test.js'), appDir, '--strict',
  ], { timeout: 90_000 });

  if (!qaR.ok) {
    log(chatId, `QA found issues, auto-fix applied. Re-checking...`);
  }

  // ── Stage 6: Bundle test ───────────────────────────────────────────────────
  session.currentApp.stage = 'bundle-test';
  await sendMsg(chatId, 'Compiling JavaScript bundle...');

  const testR = await exec('node', [
    path.join(ROOT, 'orchestrator', 'expo-go-test.js'), appDir,
  ], { timeout: 60_000 });

  if (!testR.ok) {
    // If customized code broke the bundle, try reverting to template and re-testing
    log(chatId, 'Bundle failed after customization — attempting recovery');
    await sendMsg(chatId, 'Fixing a build issue...');

    await exec('node', [
      path.join(ROOT, 'orchestrator', 'template-copy.js'), appDir, arch,
    ], { timeout: 10_000 });

    const retryR = await exec('node', [
      path.join(ROOT, 'orchestrator', 'expo-go-test.js'), appDir,
    ], { timeout: 60_000 });

    if (!retryR.ok) {
      stopTyping(); session.building = false;
      session.currentApp.stage = 'failed';
      const errLines = (retryR.stdout + retryR.stderr).split('\n')
        .filter(l => /error|Error|fail/i.test(l)).slice(0, 3).join('\n');
      return `Bundle failed:\n\`\`\`\n${errLines || 'Unknown error'}\n\`\`\`\nDescribe a different app or say "try again".`;
    }
    log(chatId, 'Recovery succeeded with template code');
  }

  // ── Stage 7: Simulator screenshot ──────────────────────────────────────────
  session.currentApp.stage = 'screenshot';
  await sendMsg(chatId, 'Launching in simulator for a screenshot...');

  const ssR = await exec('node', [
    path.join(ROOT, 'orchestrator', 'expo-go-test.js'), appDir, '--full',
  ], { timeout: 120_000 });

  stopTyping();

  const ssDir = path.join(appDir, 'test-screenshots');
  let screenshotSent = false;
  if (fs.existsSync(ssDir)) {
    const shots = fs.readdirSync(ssDir)
      .filter(f => f.endsWith('.png'))
      .sort()
      .slice(-3);
    for (const s of shots) {
      try {
        await bot.sendPhoto(chatId, path.join(ssDir, s), {
          caption: `${idea.name} — live screenshot`,
        });
        screenshotSent = true;
      } catch (e) { log(chatId, `Screenshot send failed: ${e.message}`); }
    }
  }

  session.building = false;
  session.currentApp.stage = 'ready';

  const readyMsg = screenshotSent
    ? `*${idea.name}* is built and running.`
    : `*${idea.name}* compiles clean.`;

  return readyMsg + '\n\nSay "preview" to test on your phone, or "deploy" to ship to TestFlight.';
}

// ── Preview ──────────────────────────────────────────────────────────────────

async function actionPreview(chatId) {
  const session = getSession(chatId);
  const app = session.currentApp;
  if (!app?.appDir) return 'No app to preview. Build one first.';

  const appDir = app.appDir;

  const ssDir = path.join(appDir, 'test-screenshots');
  if (fs.existsSync(ssDir)) {
    const shots = fs.readdirSync(ssDir).filter(f => f.endsWith('.png')).slice(-3);
    for (const s of shots) {
      try { await bot.sendPhoto(chatId, path.join(ssDir, s)); } catch {}
    }
  }

  return [
    `*How to preview ${app.idea.name}:*`,
    '',
    '1. Install Expo Go from the App Store on your iPhone',
    '2. On your Mac, run this in Terminal:',
    '',
    `\`cd ${appDir} && npx expo start\``,
    '',
    '3. Scan the QR code that appears with your iPhone camera',
    '4. The app opens instantly in Expo Go',
  ].join('\n');
}

// ── Deploy ───────────────────────────────────────────────────────────────────

async function actionDeploy(chatId) {
  const session = getSession(chatId);
  if (!session.currentApp?.slug) return 'No app to deploy. Build one first.';
  if (session.building) return 'Already building. Hang tight.';

  session.building = true;
  session.currentApp.stage = 'deploying';
  const appName = session.currentApp.idea.name;

  await sendMsg(chatId, `Submitting *${appName}* to Apple...\nI'll send updates as it progresses.`);
  registerWebhook(session.currentApp.slug, chatId);

  const deployProc = spawn(
    path.join(ROOT, 'scripts', 'deploy.sh'),
    [session.currentApp.slug],
    { cwd: ROOT, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let stdout = '', stderr = '';
  let lastUpdate = Date.now();
  const milestones = new Set();
  session.deployStart = Date.now();

  function detectMilestone(chunk) {
    const text = chunk.toString();
    stdout += text;

    const checks = [
      [/eas build.*--platform ios/i, 'Cloud build started...'],
      [/build details/i, 'Build queued on EAS servers...'],
      [/build finished/i, 'Build complete. Downloading...'],
      [/downloading.*ipa|curl.*-o/i, 'Downloading IPA...'],
      [/altool.*--upload-app|uploading/i, 'Uploading to Apple...'],
      [/no errors uploading|upload.*success/i, 'Upload successful.'],
      [/eas submit/i, 'Submitting via EAS (fallback)...'],
    ];

    for (const [re, msg] of checks) {
      if (re.test(text) && !milestones.has(msg)) {
        milestones.add(msg);
        sendMsg(chatId, msg);
        lastUpdate = Date.now();
      }
    }
  }

  deployProc.stdout.on('data', detectMilestone);
  deployProc.stderr.on('data', d => { stderr += d; detectMilestone(d); });

  const heartbeat = setInterval(() => {
    if (Date.now() - lastUpdate >= 180_000) {
      sendMsg(chatId, `Still working... (${Math.round((Date.now() - session.deployStart) / 60_000)} min elapsed)`);
      lastUpdate = Date.now();
    }
  }, 60_000);

  const killTimer = setTimeout(() => {
    deployProc.kill('SIGTERM');
    setTimeout(() => { try { deployProc.kill('SIGKILL'); } catch {} }, 5000);
  }, 1_800_000);

  return new Promise((resolve) => {
    deployProc.on('close', (code) => {
      clearInterval(heartbeat);
      clearTimeout(killTimer);
      session.building = false;
      const elapsed = ((Date.now() - session.deployStart) / 1000).toFixed(0);

      if (code === 0) {
        session.currentApp.stage = 'deployed';
        resolve(`*${appName}* is on its way to Apple. (${elapsed}s)\n\nCheck TestFlight in 5-15 min.`);
      } else {
        session.currentApp.stage = 'deploy-failed';
        const errSnippet = (stderr || stdout).split('\n')
          .filter(l => /error|fail|reject/i.test(l)).slice(-3).join('\n');
        resolve(`Deploy failed after ${elapsed}s.\n\`\`\`\n${errSnippet.slice(0, 250) || 'Unknown error'}\n\`\`\`\nSay "deploy" to retry.`);
      }
    });
    deployProc.on('error', (e) => {
      clearInterval(heartbeat);
      clearTimeout(killTimer);
      session.building = false;
      session.currentApp.stage = 'deploy-failed';
      resolve(`Deploy process failed: ${e.message}`);
    });
  });
}

async function actionEdit(chatId, editRequest) {
  const session = getSession(chatId);
  if (!session.currentApp?.appDir) return 'No app to edit. Build one first.';
  if (session.building) return 'App is currently building. Wait for it to finish.';

  session.building = true;
  session.currentApp.stage = 'editing';
  const appDir = session.currentApp.appDir;
  const appName = session.currentApp.idea.name;
  const isPremium = session.tier === 'premium';

  await sendMsg(chatId, `Editing *${appName}*...`);
  const stopTyping = startTyping(chatId);

  const result = await runCodeAgent({
    appDir,
    task: editRequest,
    idea: session.currentApp.idea,
    model: isPremium ? CODE_MODEL_PREMIUM : CODE_MODEL,
    onProgress: (msg) => sendMsg(chatId, msg),
  });

  stopTyping();
  session.building = false;

  if (!result.ok) {
    session.currentApp.stage = 'ready';
    return `Edit failed: ${result.error || 'Unknown error'}. Try describing the change differently.`;
  }

  if (result.filesChanged.length === 0) {
    session.currentApp.stage = 'ready';
    return result.summary || 'No changes were needed.';
  }

  // Refresh E2E flows (keep them aligned with current app structure)
  await exec('node', [
    path.join(ROOT, 'orchestrator', 'flow-generator.js'), appDir,
  ], { timeout: 10_000 });

  if (result.filesChanged.includes('package.json')) {
    await sendMsg(chatId, 'Installing dependencies...');
    await exec('npm', ['install'], { cwd: appDir, timeout: 90_000 });
  }

  // Run functional test after edit
  const qaR = await exec('node', [
    path.join(ROOT, 'orchestrator', 'functional-test.js'), appDir, '--strict',
  ], { timeout: 60_000 });

  if (!qaR.ok) {
    log(chatId, 'Post-edit QA found issues');
  }

  // Take a fresh screenshot if simulator is available
  const ssR = await exec('node', [
    path.join(ROOT, 'orchestrator', 'expo-go-test.js'), appDir, '--full',
  ], { timeout: 120_000 });

  const ssDir = path.join(appDir, 'test-screenshots');
  if (fs.existsSync(ssDir)) {
    const shots = fs.readdirSync(ssDir).filter(f => f.endsWith('.png')).sort().slice(-1);
    for (const s of shots) {
      try { await bot.sendPhoto(chatId, path.join(ssDir, s), { caption: `${appName} — updated` }); } catch {}
    }
  }

  session.currentApp.stage = 'ready';
  const changedList = result.filesChanged.map(f => `\`${f}\``).join(', ');
  return `*Done.* ${result.summary}\n\nChanged: ${changedList}`;
}

function actionStatus(chatId) {
  const session = getSession(chatId);
  if (!session.currentApp) return 'No app in progress.';
  const a = session.currentApp;
  return `*${a.idea.name}* — stage: \`${a.stage}\`${session.building ? ' (building...)' : ''}`;
}

// ── Conversation engine ──────────────────────────────────────────────────────

async function converse(chatId, userMessage) {
  const session = getSession(chatId);
  addToHistory(session, 'user', userMessage);
  if (session.phase === 'idle') session.phase = 'exploring';

  const stopTyping = startTyping(chatId);

  const context = sessionContext(session);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + '\n\nCURRENT STATE:\n' + context },
    ...session.history,
  ];

  let response;
  try {
    response = await llmChat(messages, {
      model: CONV_MODEL,
      temperature: 0.75,
      max_tokens: 600,
    });
  } catch (e) {
    log(chatId, `Conv model failed: ${e.message}, trying free fallback`);
    try {
      response = await llmChat(messages, {
        model: CONV_MODEL_FREE,
        temperature: 0.75,
        max_tokens: 600,
      });
    } catch (e2) {
      log(chatId, `Free fallback also failed: ${e2.message}`);
      stopTyping();
      return sendMsg(chatId, "Something broke on my end. Try again in a sec.");
    }
  }

  stopTyping();

  // Parse REFINE block
  const refineMatch = response.match(/\[REFINE:([\s\S]*?)\]\s*$/);
  if (refineMatch) {
    try {
      const draft = JSON.parse(refineMatch[1]);
      session.ideaDraft = { ...session.ideaDraft, ...draft };
      session.phase = 'refining';
      log(chatId, `Refine: ${JSON.stringify(session.ideaDraft).slice(0, 120)}`);
    } catch {
      log(chatId, 'Refine parse failed, ignoring');
    }
  }

  // Parse ACTION block
  const actionMatch = response.match(/\[ACTION:(\w+)(?::(.+?))?\]\s*$/s);

  // Strip control blocks from user-visible text
  let cleanResponse = response
    .replace(/\[REFINE:[\s\S]*?\]\s*/g, '')
    .replace(/\[ACTION:\w+(?::.*?)?\]\s*$/s, '')
    .trim();

  if (cleanResponse) {
    addToHistory(session, 'assistant', cleanResponse);
    await sendMsg(chatId, cleanResponse);
  }

  if (actionMatch) {
    const action = actionMatch[1].toLowerCase();
    const param = actionMatch[2]?.trim();
    log(chatId, `Action: ${action}${param ? ` (${param.slice(0, 80)})` : ''}`);

    session.phase = 'building';
    let result;

    switch (action) {
      case 'custom': {
        let buildSpec = param || userMessage;
        if (session.ideaDraft) {
          const d = session.ideaDraft;
          const draftParts = [];
          if (d.name) draftParts.push(`Name: ${d.name}`);
          if (d.description) draftParts.push(`Description: ${d.description}`);
          if (d.style) draftParts.push(`Visual style: ${d.style}`);
          if (d.personality) draftParts.push(`Personality: ${d.personality}`);
          if (d.core_interaction) draftParts.push(`Core interaction: ${d.core_interaction}`);
          if (d.key_feature) draftParts.push(`Key feature: ${d.key_feature}`);
          if (draftParts.length) buildSpec = draftParts.join('. ') + '. ' + buildSpec;
        }
        result = await actionCustom(chatId, buildSpec);
        break;
      }
      case 'edit':
        result = await actionEdit(chatId, param || userMessage);
        break;
      case 'preview':
        result = await actionPreview(chatId);
        break;
      case 'deploy':
        result = await actionDeploy(chatId);
        break;
      case 'status':
        result = actionStatus(chatId);
        break;
      default:
        result = null;
    }

    if (result) {
      if (session.currentApp?.stage === 'ready' || session.currentApp?.stage === 'deployed') {
        session.phase = 'ready';
        session.ideaDraft = null;
      } else if (session.currentApp?.stage === 'failed') {
        session.phase = 'exploring';
      }
      addToHistory(session, 'assistant', result);
      await sendMsg(chatId, result);
    }
  }
}

async function sendMsg(chatId, text) {
  try {
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch {
    try { await bot.sendMessage(chatId, text); } catch (e) {
      log(chatId, `Send failed: ${e.message}`);
    }
  }
}

// ── Per-user message queue (prevents race conditions) ────────────────────────

const messageQueues = new Map();

function enqueue(chatId, fn) {
  if (!messageQueues.has(chatId)) messageQueues.set(chatId, Promise.resolve());
  const chain = messageQueues.get(chatId).then(fn).catch(e => {
    log(chatId, `Queue error: ${e.message}`);
  });
  messageQueues.set(chatId, chain);
}

// ── Message handler ──────────────────────────────────────────────────────────

bot.on('message', (msg) => {
  if (!msg.text) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  log(chatId, `<< ${text.slice(0, 100)}`);

  enqueue(chatId, async () => {
    if (text === '/start') {
      const session = getSession(chatId);
      session.history = [];
      session.ideaDraft = null;
      session.phase = 'idle';
      session.currentApp = null;
      session.building = false;
      await bot.sendMessage(chatId, [
        'Hey. I make iOS apps.',
        '',
        'Not mockups. Real ones you can put on your phone.',
        '',
        'Tell me about something that bugs you, an app you wish existed,',
        'or say "surprise me" and I\'ll build something you didn\'t know you wanted.',
      ].join('\n'));
      return;
    }

    await converse(chatId, text);
  });
});

// ── Error handling ───────────────────────────────────────────────────────────

bot.on('polling_error', (err) => {
  if (err.code === 'ETELEGRAM' && err.response?.statusCode === 409) {
    console.error('[bot] Another instance is running. Kill it first.');
    process.exit(1);
  }
  console.error('[bot] Polling error:', err.message);
});

// ── Webhook server ───────────────────────────────────────────────────────────

const WEBHOOK_PORT = parseInt(process.env.WEBHOOK_PORT || '9100', 10);
const webhookRegistry = new Map();

function registerWebhook(slug, chatId) {
  webhookRegistry.set(slug, chatId);
  log(chatId, `Webhook registered for ${slug}`);
}

const webhookServer = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/eas-webhook') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const slug = payload.metadata?.appName || payload.appSlug || '';
        const status = payload.status;
        const buildUrl = payload.artifacts?.buildUrl;

        console.log(`[webhook] EAS: ${slug} ${status}`);

        const chatId = webhookRegistry.get(slug);
        if (chatId) {
          const session = getSession(chatId);
          if (status === 'finished') {
            sendMsg(chatId, `EAS build for *${slug}* finished.${buildUrl ? `\nArtifact: ${buildUrl}` : ''}`);
            if (session.currentApp?.slug === slug) session.currentApp.stage = 'build-complete';
          } else if (status === 'errored') {
            sendMsg(chatId, `EAS build for *${slug}* failed.`);
          }
        }
      } catch (e) {
        console.error('[webhook] Parse error:', e.message);
      }
      res.writeHead(200);
      res.end('ok');
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', sessions: sessions.size, uptime: process.uptime() }));
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

// ── Startup ──────────────────────────────────────────────────────────────────

console.log('[bot] Starting...');

webhookServer.listen(WEBHOOK_PORT, () => {
  console.log(`[bot] Webhook: http://localhost:${WEBHOOK_PORT}`);
});

bot.getMe().then(me => {
  console.log(`[bot] Live as @${me.username}`);
}).catch(e => {
  console.error('[bot] Failed:', e.message);
  process.exit(1);
});
