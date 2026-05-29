#!/usr/bin/env node
/**
 * iOS App Factory — Telegram Bot (thin interface layer)
 *
 * This file is ONLY the Telegram skin. All build logic lives in orchestrator/pipeline.js.
 *
 * Responsibilities:
 *   - Receive messages, route through LLM conversation engine
 *   - Call pipeline.build() for app creation
 *   - Manage preview servers (Expo tunnel)
 *   - Manage deploy (EAS Build + Submit)
 *   - Relay results back to user
 */

require('../orchestrator/lib/env').loadEnv();

const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { chat: llmChat } = require('../orchestrator/lib/llm');
const { runCodeAgent } = require('../orchestrator/code-agent');
const { enforceQualityGate } = require('../orchestrator/quality-gate');
const { build: pipelineBuild } = require('../orchestrator/pipeline');

const ROOT = path.join(__dirname, '..');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const HEADLESS_TEST = process.env.BOT_HEADLESS_TEST === '1';
const DRY_RUN = process.env.BOT_E2E_DRY_RUN === '1';

if (!TOKEN && !HEADLESS_TEST) {
  console.error('TELEGRAM_BOT_TOKEN not set in .env');
  process.exit(1);
}

const headlessMessages = [];
function createHeadlessBot() {
  return {
    sendMessage: async (chatId, text, opts = {}) => {
      headlessMessages.push({ kind: 'message', chatId, text, opts, ts: Date.now() });
      return { ok: true };
    },
    sendPhoto: async (chatId, photoPath, opts = {}) => {
      headlessMessages.push({ kind: 'photo', chatId, photoPath, opts, ts: Date.now() });
      return { ok: true };
    },
    sendChatAction: async () => ({ ok: true }),
    on: () => {},
    getMe: async () => ({ username: 'headless-test-bot' }),
  };
}

const bot = HEADLESS_TEST ? createHeadlessBot() : new TelegramBot(TOKEN, {
  polling: { params: { timeout: 2 } },
});

// ── Models ───────────────────────────────────────────────────────────────────

const { getModels, resolve: resolveModel, TOKEN_BUDGETS, TIER_INFO, DEFAULT_TIER } = require('../orchestrator/lib/models');

// Conversation always uses Flash — it doesn't benefit from bigger models.
const CONV_MODEL      = 'google/gemini-2.0-flash-001';
const CONV_MODEL_FREE = 'meta-llama/llama-3.3-70b-instruct:free';

const MAX_HISTORY = 30;
const TELEGRAM_MSG_SOFT_LIMIT = 3800;
const PROGRESS_MIN_INTERVAL_MS = 4500;

// ── Telegram helpers ─────────────────────────────────────────────────────────

function startTyping(chatId) {
  bot.sendChatAction(chatId, 'typing').catch(() => {});
  const interval = setInterval(() => {
    bot.sendChatAction(chatId, 'typing').catch(() => {});
  }, 4000);
  return () => clearInterval(interval);
}

function splitMessage(text, maxLen = TELEGRAM_MSG_SOFT_LIMIT) {
  const input = String(text ?? '');
  if (input.length <= maxLen) return [input];
  const chunks = [];
  let remaining = input;
  while (remaining.length > maxLen) {
    let idx = remaining.lastIndexOf('\n', maxLen);
    if (idx < Math.floor(maxLen * 0.6)) idx = remaining.lastIndexOf(' ', maxLen);
    if (idx < Math.floor(maxLen * 0.5)) idx = maxLen;
    chunks.push(remaining.slice(0, idx).trimEnd());
    remaining = remaining.slice(idx).trimStart();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

async function sendMsg(chatId, text) {
  const chunks = splitMessage(text);
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    try {
      await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' });
    } catch {
      try { await bot.sendMessage(chatId, chunk); } catch (e) {
        log(chatId, `Send failed: ${e.message}`);
      }
    }
  }
}

function createProgressReporter(chatId, opts = {}) {
  const minIntervalMs = opts.minIntervalMs || PROGRESS_MIN_INTERVAL_MS;
  const prefix = opts.prefix || 'Progress';
  let lastMsg = '';
  let lastTs = 0;
  return async (msg) => {
    const clean = String(msg ?? '').trim();
    if (!clean || clean === lastMsg) return;
    const now = Date.now();
    if (now - lastTs < minIntervalMs) return;
    lastMsg = clean;
    lastTs = now;
    await sendMsg(chatId, `${prefix}: ${clean}`);
  };
}

function log(chatId, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [${chatId}] ${msg}`);
}

// ── Process registry ─────────────────────────────────────────────────────────

const activeProcesses = new Map();

function trackProcess(chatId, proc, label = 'process') {
  if (!chatId || !proc) return;
  if (!activeProcesses.has(chatId)) activeProcesses.set(chatId, new Set());
  const set = activeProcesses.get(chatId);
  const entry = { proc, label, startedAt: Date.now() };
  set.add(entry);
  const cleanup = () => { set.delete(entry); if (set.size === 0) activeProcesses.delete(chatId); };
  proc.on('close', cleanup);
  proc.on('error', cleanup);
  log(chatId, `Tracked process: ${label}${proc.pid ? ` (pid ${proc.pid})` : ''}`);
}

async function killTrackedProcesses(chatId) {
  const set = activeProcesses.get(chatId);
  if (!set || set.size === 0) return 0;
  let killed = 0;
  for (const entry of Array.from(set)) {
    const { proc, label } = entry;
    if (!proc || proc.killed) continue;
    try {
      proc.kill('SIGTERM');
      killed++;
      log(chatId, `SIGTERM sent: ${label}${proc.pid ? ` (pid ${proc.pid})` : ''}`);
      setTimeout(() => { try { if (!proc.killed) proc.kill('SIGKILL'); } catch {} }, 3000);
    } catch {}
  }
  return killed;
}

// ── Sessions ─────────────────────────────────────────────────────────────────

const SESSIONS_FILE = path.join(ROOT, '.sessions.json');
const sessions = new Map();

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      for (const [id, s] of Object.entries(raw)) {
        s.building = false;
        sessions.set(Number(id), s);
      }
      console.log(`[bot] Restored ${sessions.size} sessions`);
    }
  } catch (e) { console.error(`[bot] Session restore failed: ${e.message}`); }
}

function saveSessions() {
  try {
    const obj = {};
    for (const [id, s] of sessions) obj[id] = { ...s, building: false };
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj));
  } catch {}
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; saveSessions(); }, 2000);
}

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      tier: DEFAULT_TIER, history: [], currentApp: null,
      building: false, aborted: false, ideaDraft: null, phase: 'idle',
    });
  }
  return sessions.get(chatId);
}

function addToHistory(session, role, content) {
  session.history.push({ role, content });
  if (session.history.length > MAX_HISTORY) session.history = session.history.slice(-MAX_HISTORY);
  scheduleSave();
}

function discoverApps() {
  const appsDir = path.join(ROOT, 'apps');
  if (!fs.existsSync(appsDir)) return [];
  return fs.readdirSync(appsDir)
    .filter(d => fs.existsSync(path.join(appsDir, d, 'package.json')))
    .map(slug => {
      const designFp = path.join(appsDir, slug, 'design.json');
      const legacyFp = path.join(appsDir, slug, 'features.json');
      let idea = {};
      try {
        if (fs.existsSync(designFp)) idea = JSON.parse(fs.readFileSync(designFp, 'utf8'));
        else if (fs.existsSync(legacyFp)) idea = JSON.parse(fs.readFileSync(legacyFp, 'utf8'));
      } catch {}
      return { slug, name: idea.name || slug, architecture: idea.architecture, description: idea.description };
    });
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
  if (session.building) parts.push('STATUS: Currently building. User can say "stop" or "no" to cancel.');
  const existingApps = discoverApps();
  if (existingApps.length > 0) {
    parts.push(`\nPreviously built apps (${existingApps.length}):`);
    for (const a of existingApps.slice(-10)) parts.push(`  - ${a.name} (${a.slug}) — ${a.architecture || '?'} — ${a.description || ''}`);
    parts.push('The user can ask to preview, edit, or rebuild any of these.');
  }
  if (!app && !session.ideaDraft && existingApps.length === 0) parts.push('No apps built yet. No idea in progress.');
  return parts.join('\n');
}

function ensurePreviewEntryPoint(appDir) {
  try {
    const pkgPath = path.join(appDir, 'package.json');
    const indexPath = path.join(appDir, 'index.js');
    const routerDir = path.join(appDir, 'app');
    if (!fs.existsSync(pkgPath) || !fs.existsSync(indexPath)) return;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const main = String(pkg.main || '');
    if (main === 'expo-router/entry' && !fs.existsSync(routerDir)) {
      pkg.main = 'index.js';
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
    }
  } catch {}
}

function pipelineHealthStatus() {
  const checks = [];
  const scaffoldPath = path.join(ROOT, 'scripts', 'scaffold-minimal.sh');
  const pipelinePath = path.join(ROOT, 'orchestrator', 'pipeline.js');
  const runsPath = path.join(ROOT, 'benchmark', 'runs.json');

  checks.push({ name: 'scaffold script', ok: fs.existsSync(scaffoldPath) });
  checks.push({ name: 'pipeline module', ok: fs.existsSync(pipelinePath) });

  let sdkOk = false;
  try {
    const scaffold = fs.readFileSync(scaffoldPath, 'utf8');
    const m = scaffold.match(/"expo"\s*:\s*"[^"]*?(\d+)\./);
    const major = parseInt(m?.[1] || '0', 10);
    sdkOk = major >= 54;
  } catch {}
  checks.push({ name: 'Expo SDK floor >=54', ok: sdkOk });

  let latestRun = null;
  try {
    const runs = JSON.parse(fs.readFileSync(runsPath, 'utf8'));
    if (Array.isArray(runs) && runs.length > 0) latestRun = runs[runs.length - 1];
  } catch {}

  const coreStages = ['idea', 'scaffold', 'feature', 'flow', 'expo-test', 'review'];
  const stageBits = [];
  if (latestRun?.stages) {
    for (const s of coreStages) {
      const st = latestRun.stages[s];
      if (st) stageBits.push(`${s}:${st.ok ? 'ok' : 'fail'}`);
    }
  }

  const okCount = checks.filter(c => c.ok).length;
  const baseHealthy = okCount === checks.length;
  const headline = baseHealthy
    ? 'Pipeline baseline looks healthy.'
    : 'Pipeline baseline has issues.';

  return [
    headline,
    `Checks: ${checks.map(c => `${c.name}=${c.ok ? 'ok' : 'fail'}`).join(', ')}`,
    latestRun ? `Latest run: ${latestRun.slug} @ ${latestRun.started_at}` : 'Latest run: unavailable',
    stageBits.length ? `Latest stage status: ${stageBits.join(', ')}` : 'Latest stage status: unavailable',
    'To verify now: run `npm run matrix` or trigger a fresh build.',
  ].join('\n');
}

// ── LLM System Prompt ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the iOS App Factory bot. You build real, working iOS apps through conversation.

PERSONALITY: Direct, sharp, zero bullshit. You're a product designer who ships. Short messages (1-4 lines). No corporate speak, no buzzwords, no inspirational fluff. If an idea is boring, say so. If it's good, get excited.

YOUR CORE BELIEF: Most apps are generic trash. Yours shouldn't be. Every app you build should have one clear reason to exist that isn't "it's a journal" or "it tracks habits." Push for the specific, the weird, the personal.

CONVERSATION PHASES:

1. EXPLORING — User has a vague idea or none. Your job:
   - Ask one sharp question. Never dump a list.
   - "What annoyed you this week?" beats "What category?"
   - Challenge generic ideas hard. "A gratitude journal? There are 10,000 of those. What's actually different?"

2. REFINING — You understand the need. Shape it fast:
   - Name it. One-line pitch. Style.
   - One design question max, then BUILD.

3. BUILDING — Idea locked. System handles updates. Keep quiet unless asked.

4. READY — App is built. Tell them to say "preview" to try it on their phone.

SURPRISE ME / RANDOM MODE:
When someone says "surprise me", "random", etc — be genuinely creative. NO gratitude journals, NO habit trackers, NO mood trackers, NO generic wellness apps. Those are boring. Think:
- A decision roulette for people paralyzed by choice (what to eat, watch, do)
- A dead simple IOU tracker that texts your friends automatically
- A "museum of your week" — 7 photos, one per day, presented like an art gallery
- A micro-dare app that gives you one tiny social challenge per day
- A price-per-use calculator for stuff you own (did that gym membership pay off?)
- A "how long since" tracker for weird personal milestones
- An app that generates a fake but plausible alibi/excuse when you need to bail
- A daily color — just one color, generated from the date, with its name and hex. Wallpaper mode.
- A "what would [person] do?" decision helper based on famous people's philosophies
Then trigger [ACTION:custom:...] with name, style, domain, key feature, architecture. Be specific and opinionated.

HANDLING "STOP" / "CANCEL" / "CLEAN UP":
If the user says no, stop, cancel, abort, nah, never mind, etc:
- If currently building: trigger [ACTION:stop] immediately. Do NOT continue the build.
- If not building: acknowledge and move on. "Got it. What else?"

AVAILABLE ACTIONS (include EXACTLY ONE at the END of your message when ready):

[ACTION:custom:detailed description including name, style, domain, key feature, architecture hint]
[ACTION:edit:task] or [ACTION:edit:app-slug: task] to edit a specific app by name
[ACTION:preview]
[ACTION:stop]
[ACTION:deploy]
[ACTION:status]
[REFINE:{"name":"Name","description":"pitch","style":"minimal","personality":"quiet","core_interaction":"daily ritual","key_feature":"the hook"}]

CRITICAL RULES:
- Do NOT build generic wellness/journaling/habit apps on "surprise me." Be weird and specific.
- DO build immediately on: "build it", "let's go", "surprise me", or a complete specific description.
- When triggering [ACTION:custom:...], include EVERYTHING: name, style, key features, architecture. This IS the spec.
- When triggering [ACTION:preview], say "Setting up your preview..." System sends a QR code to scan with Expo Go. Do NOT make up QR codes/links.
- When triggering [ACTION:stop], this cancels the current build OR kills the preview server. Use when user says stop, cancel, abort, clean up, nah, etc.
- NEVER show action/refine syntax to users.
- If building, [ACTION:stop] aborts it. Don't say "wait for it to finish."
- Action results appear as separate system messages. Do NOT duplicate them.
- Edit: Use [ACTION:edit:slug: task]. ALWAYS include the slug. Infer from conversation context which app the user means. "Fix the errors", "fix it", "fix what's broken" = fix THE APP WE JUST DISCUSSED. Look at the last few messages. If user asked about SplitSnap, then said "fix the errors", they mean SplitSnap (slug pipeline-test-01). Use the slug from CURRENT STATE's app list.
- Keep messages SHORT.

CURRENT STATE will be provided as context.`;

// ── Actions ──────────────────────────────────────────────────────────────────

async function actionCustom(chatId, description) {
  const session = getSession(chatId);
  session.building = true;
  killPreviewServer(chatId);

  const stopTyping = startTyping(chatId);
  const ideaModel = resolveModel(session.tier, 'idea');

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
    const raw = await llmChat([{ role: 'user', content: prompt }], { model: ideaModel, temperature: 0.8, max_tokens: TOKEN_BUDGETS.idea });
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
  return await actionBuild(chatId, idea);
}

async function actionBuild(chatId, idea) {
  const session = getSession(chatId);
  session.aborted = false;
  session.currentApp = { idea, slug: idea.slug, stage: 'building', appDir: null };
  const stopTyping = startTyping(chatId);
  const progress = createProgressReporter(chatId, { prefix: 'Build' });

  const tierInfo = TIER_INFO[session.tier] || TIER_INFO[DEFAULT_TIER];
  const card = `*${idea.name}*\n_${idea.description}_\n\`${idea.domain || 'general'}\``;
  await sendMsg(chatId, card);
  await sendMsg(chatId, `Building from scratch. This takes 2-5 min... _(${tierInfo.label} mode)_`);

  const result = await pipelineBuild(idea, {
    tier: session.tier,
    onProgress: progress,
    onSpawn: (proc) => trackProcess(chatId, proc, `pipeline:${idea.slug}`),
    isAborted: () => session.aborted,
  });

  stopTyping();
  session.building = false;

  if (!result.ok) {
    session.currentApp.stage = 'failed';
    const errMsgs = (result.errors || []).map(e => `- ${e.message}`).slice(0, 5).join('\n');
    return `Build failed (phase: ${result.phase}).\n${errMsgs}\n\nDuration: ${result.duration}s. Say "try again" or describe a different app.`;
  }

  session.currentApp.appDir = result.appDir;
  session.currentApp.stage = 'ready';

  // Send screenshots
  let screenshotSent = false;
  for (const ssPath of (result.screenshots || []).slice(0, 5)) {
    if (!fs.existsSync(ssPath)) continue;
    try {
      const tabName = path.basename(ssPath).replace(/^qa-tab-\d+-/, '').replace('.png', '');
      await bot.sendPhoto(chatId, ssPath, { caption: `${idea.name} — ${tabName}` });
      screenshotSent = true;
    } catch (e) { log(chatId, `Screenshot send failed: ${e.message}`); }
  }

  const design = result.design || {};
  const features = (design.screens || []).flatMap(s => (s.features || []).map(f => f.name));
  addToHistory(session, 'assistant', `Built ${idea.name}: ${(design.screens || []).length} screens, ${features.length} features`);

  const readyMsg = screenshotSent
    ? `*${idea.name}* is built.\n\n${(design.screens || []).length} screens, ${features.length} features. QA passed.`
    : `*${idea.name}* compiles. ${(design.screens || []).length} screens, ${features.length} features. QA passed.`;

  return readyMsg + `\nDuration: ${result.duration}s\n\nSay "preview" for a QR code to open it on your phone.`;
}

// ── Preview ──────────────────────────────────────────────────────────────────

const activeServers = new Map();
let nextPort = 8100;

function killPreviewServer(chatId) {
  const srv = activeServers.get(chatId);
  if (srv?.proc) {
    try { srv.proc.kill('SIGTERM'); } catch {}
    activeServers.delete(chatId);
    log(chatId, `Killed preview server on port ${srv.port}`);
  }
}

async function startExpoTunnel(appDir, port, chatId) {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['expo', 'start', '--tunnel', '--no-dev', '--port', String(port)], {
      cwd: appDir,
      env: { ...process.env, EXPO_NO_DOTENV: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (chatId) trackProcess(chatId, proc, `preview-tunnel:${port}`);
    let resolved = false;
    let output = '';
    const tryResolveFromOutput = (txt) => {
      if (resolved) return;
      const expUrl = txt.match(/exp:\/\/[^\s"'`]+/i)?.[0];
      if (expUrl && expUrl.includes('.exp.direct')) {
        resolved = true;
        clearInterval(pollManifest);
        clearTimeout(timeout);
        resolve({ proc, url: expUrl, port });
        return;
      }
      const host = txt.match(/([a-z0-9-]+\.exp\.direct(?::\d+)?)/i)?.[1];
      if (host) {
        resolved = true;
        clearInterval(pollManifest);
        clearTimeout(timeout);
        resolve({ proc, url: `exp://${host}`, port });
      }
    };
    const timeout = setTimeout(() => {
      if (!resolved) { proc.kill('SIGTERM'); reject(new Error('Tunnel timed out (60s)')); }
    }, 60_000);
    const pollManifest = setInterval(async () => {
      if (resolved) { clearInterval(pollManifest); return; }
      try {
        const res = await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(2000) });
        const data = await res.json();
        const host = data?.extra?.expoClient?.hostUri || data?.extra?.expoGo?.debuggerHost;
        if (host && host.includes('.exp.direct')) {
          resolved = true;
          clearInterval(pollManifest);
          clearTimeout(timeout);
          resolve({ proc, url: `exp://${host}`, port });
        }
      } catch {}
    }, 2000);
    proc.stdout.on('data', (c) => {
      const s = c.toString();
      output += s;
      tryResolveFromOutput(s);
    });
    proc.stderr.on('data', (c) => {
      const s = c.toString();
      output += s;
      tryResolveFromOutput(s);
    });
    proc.on('error', (e) => { clearInterval(pollManifest); clearTimeout(timeout); if (!resolved) reject(e); });
    proc.on('exit', (code) => {
      clearInterval(pollManifest);
      if (!resolved) { clearTimeout(timeout); reject(new Error(`Expo exited (${code}): ${output.slice(-300)}`)); }
    });
  });
}

async function ensureNgrokReady(appDir, chatId, force = false) {
  const ngrokPath = path.join(appDir, 'node_modules', '@expo', 'ngrok');
  if (!force && fs.existsSync(ngrokPath)) return;
  if (force) {
    await exec('npm', ['remove', '@expo/ngrok'], { cwd: appDir, timeout: 45_000, chatId, label: 'remove:@expo/ngrok' });
  }
  const r = await exec('npm', ['install', '--save-dev', '@expo/ngrok@latest'], {
    cwd: appDir,
    timeout: 90_000,
    chatId,
    label: force ? 'reinstall:@expo/ngrok' : 'install:@expo/ngrok',
  });
  if (!r.ok) throw new Error(`ngrok install failed: ${r.stderr || r.stdout || 'unknown error'}`);
}

// Strips devDependencies that npm can't resolve (peer dep conflicts) — they block expo start.
function purgeUnresolvableDevDeps(appDir) {
  const pkgPath = path.join(appDir, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const devDeps = pkg.devDependencies || {};
    const pruned = Object.entries(devDeps).filter(([k]) => {
      const modPath = path.join(appDir, 'node_modules', ...k.split('/'));
      return fs.existsSync(modPath);
    });
    if (pruned.length < Object.keys(devDeps).length) {
      pkg.devDependencies = Object.fromEntries(pruned);
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      return true;
    }
  } catch {}
  return false;
}

async function startExpoTunnelWithRetry(appDir, basePort, chatId, onProgress = () => {}) {
  const errors = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const port = basePort + (attempt - 1);
    try {
      if (attempt === 1) await ensureNgrokReady(appDir, chatId, false);
      if (attempt > 1) {
        onProgress(`Tunnel retry ${attempt}/3...`);
        await ensureNgrokReady(appDir, chatId, true);
      }
      const live = await startExpoTunnel(appDir, port, chatId);
      return live;
    } catch (e) {
      const msg = e.message || String(e);
      // Expo reports devDeps that npm can't resolve — strip them and retry immediately.
      if (/added as a dependency.*doesn.t seem to be installed/i.test(msg)) {
        const cleaned = purgeUnresolvableDevDeps(appDir);
        if (cleaned) {
          onProgress('Cleaned unresolvable devDependencies, retrying...');
          errors.push(msg);
          await killTrackedProcesses(chatId);
          continue;
        }
      }
      errors.push(msg);
      await killTrackedProcesses(chatId);
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  throw new Error(`Tunnel unavailable after retries: ${errors.slice(-2).join(' | ')}`);
}

async function startExpoLan(appDir, port, chatId) {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['expo', 'start', '--lan', '--no-dev', '--port', String(port)], {
      cwd: appDir,
      env: { ...process.env, EXPO_NO_DOTENV: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (chatId) trackProcess(chatId, proc, `preview-lan:${port}`);
    let resolved = false;
    let output = '';
    const timeout = setTimeout(() => {
      if (!resolved) { proc.kill('SIGTERM'); reject(new Error('LAN preview timed out (45s)')); }
    }, 45_000);

    const tryResolveFromOutput = (txt) => {
      if (resolved) return;
      const expUrl = txt.match(/exp:\/\/[^\s"'`]+/i)?.[0];
      if (expUrl) {
        resolved = true;
        clearInterval(pollManifest);
        clearTimeout(timeout);
        resolve({ proc, url: expUrl, port });
      }
    };

    const pollManifest = setInterval(async () => {
      if (resolved) { clearInterval(pollManifest); return; }
      try {
        const res = await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(2000) });
        const data = await res.json();
        const host = data?.extra?.expoClient?.hostUri || data?.extra?.expoGo?.debuggerHost;
        if (host) {
          resolved = true;
          clearInterval(pollManifest);
          clearTimeout(timeout);
          resolve({ proc, url: host.startsWith('exp://') ? host : `exp://${host}`, port });
        }
      } catch {}
    }, 2000);

    proc.stdout.on('data', (c) => { const s = c.toString(); output += s; tryResolveFromOutput(s); });
    proc.stderr.on('data', (c) => { const s = c.toString(); output += s; tryResolveFromOutput(s); });
    proc.on('error', (e) => { clearInterval(pollManifest); clearTimeout(timeout); if (!resolved) reject(e); });
    proc.on('exit', (code) => {
      clearInterval(pollManifest);
      if (!resolved) { clearTimeout(timeout); reject(new Error(`Expo exited (${code}): ${output.slice(-600)}`)); }
    });
  });
}

async function getTailscaleIPv4() {
  const r = await exec('tailscale', ['ip', '-4'], { timeout: 4000 });
  if (!r.ok) return null;
  const ip = String(r.stdout || '')
    .split('\n')
    .map(s => s.trim())
    .find(s => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(s));
  return ip || null;
}

function replaceExpHost(url, newHost) {
  const m = String(url || '').match(/^exp:\/\/([^/]+)(\/.*)?$/);
  if (!m) return null;
  const hostPort = m[1];
  const rest = m[2] || '';
  const port = hostPort.includes(':') ? hostPort.split(':').pop() : '';
  return `exp://${newHost}${port ? `:${port}` : ''}${rest}`;
}

function exec(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    let stdout = '', stderr = '';
    const proc = spawn(cmd, args, {
      cwd: opts.cwd || ROOT,
      env: { ...process.env, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (opts.chatId) trackProcess(opts.chatId, proc, opts.label || `${path.basename(cmd)} ${args.join(' ')}`.trim());
    proc.stdout.on('data', d => stdout += d);
    proc.stderr.on('data', d => stderr += d);
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 3000);
    }, opts.timeout || 120_000);
    proc.on('close', code => { clearTimeout(timer); resolve({ ok: code === 0, stdout, stderr: stderr.slice(0, 500) }); });
    proc.on('error', e => { clearTimeout(timer); resolve({ ok: false, stdout, stderr: e.message }); });
  });
}

async function actionPreview(chatId) {
  const session = getSession(chatId);
  const app = session.currentApp;
  if (!app?.appDir) return 'No app to preview. Build one first.';
  const progress = createProgressReporter(chatId, { prefix: 'Preview' });
  const appDir = app.appDir;
  const appName = app.idea?.name || 'your app';
  ensurePreviewEntryPoint(appDir);

  killPreviewServer(chatId);
  await sendMsg(chatId, `Starting preview server for *${appName}*...`);
  const port = nextPort++;
  if (nextPort > 8200) nextPort = 8100;

  try {
    const gate = await enforceQualityGate(appDir, {
      mode: 'preflight',
      autofix: true,
      model: resolveModel(session.tier, 'repair'),
      onProgress: progress,
    });
    if (!gate.ok) {
      const summary = (gate.errors || []).map(e => `- ${e.message}`).slice(0, 5).join('\n');
      return `Preview blocked: quality gate failed.\n${summary}\n\nSay "edit" with what to fix, then try preview again.`;
    }

    if (DRY_RUN) return `Preview dry-run OK for *${appName}* (quality gate passed).`;

    const { proc, url, port: livePort } = await startExpoTunnelWithRetry(appDir, port, chatId, progress);
    activeServers.set(chatId, { proc, port: livePort, url, appDir });
    log(chatId, `Preview tunnel live: ${url} (port ${livePort})`);

    const qrPath = path.join(appDir, 'preview-qr.png');
    await QRCode.toFile(qrPath, url, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } });

    const ssDir = path.join(appDir, 'qa-screenshots');
    if (fs.existsSync(ssDir)) {
      const shots = fs.readdirSync(ssDir).filter(f => f.endsWith('.png')).slice(-1);
      for (const s of shots) {
        try { await bot.sendPhoto(chatId, path.join(ssDir, s), { caption: `${appName} — simulator preview` }); } catch {}
      }
    }

    await bot.sendPhoto(chatId, qrPath, {
      caption: `Scan this QR code with your iPhone camera to open *${appName}* in Expo Go.\n\nURL: \`${url}\``,
      parse_mode: 'Markdown',
    });

    return `Preview is live. Server stays running until you build another app or say "stop".`;
  } catch (e) {
    if (/Tunnel unavailable after retries/i.test(e.message || '')) {
      try {
        progress('Tunnel down — trying LAN preview...');
        const lanPort = port + 10;
        const { proc, url } = await startExpoLan(appDir, lanPort, chatId);
        activeServers.set(chatId, { proc, port: lanPort, url, appDir });

        const qrLanPath = path.join(appDir, 'preview-qr-lan.png');
        await QRCode.toFile(qrLanPath, url, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
        await bot.sendPhoto(chatId, qrLanPath, {
          caption: `Tunnel is down. *LAN (Wi‑Fi)* preview.\nSame Wi‑Fi as this Mac.\n\nURL: \`${url}\``,
          parse_mode: 'Markdown',
        });

        const tsIp = await getTailscaleIPv4();
        const tsUrl = tsIp ? replaceExpHost(url, tsIp) : null;
        if (tsUrl) {
          const qrTsPath = path.join(appDir, 'preview-qr-tailscale.png');
          await QRCode.toFile(qrTsPath, tsUrl, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
          await bot.sendPhoto(chatId, qrTsPath, {
            caption: `*LAN (Tailscale)* preview.\nTurn on Tailscale on your iPhone.\n\nURL: \`${tsUrl}\``,
            parse_mode: 'Markdown',
          });
        }

        return `Preview (LAN) is live. Use Wi‑Fi or Tailscale. Say "stop" to shut it down.`;
      } catch (lanErr) {
        log(chatId, `LAN fallback failed: ${lanErr.message}`);
      }
    }
    log(chatId, `Preview failed: ${e.message}`);
    return `Preview failed: ${e.message}\n\nRun locally:\n\`cd ${appDir} && npx expo start\``;
  }
}

// ── Stop ─────────────────────────────────────────────────────────────────────

async function actionStop(chatId) {
  const session = getSession(chatId);
  const results = [];

  const killed = await killTrackedProcesses(chatId);
  if (killed > 0) results.push(`Stopped ${killed} active process${killed === 1 ? '' : 'es'}.`);

  if (session.building) {
    session.aborted = true;
    session.building = false;
    session.phase = 'idle';
    results.push('Build cancelled.');
    log(chatId, 'Build aborted by user');
  }

  if (activeServers.has(chatId)) {
    killPreviewServer(chatId);
    results.push('Preview server stopped.');
  }

  if (session.currentApp?.stage && !['ready', 'failed'].includes(session.currentApp.stage)) {
    const appDir = session.currentApp.appDir;
    if (appDir && fs.existsSync(appDir)) {
      const { execSync } = require('child_process');
      try { execSync(`rm -rf "${appDir}"`); } catch {}
      results.push(`Cleaned up partial build.`);
    }
    session.currentApp = null;
  }

  scheduleSave();
  return results.length > 0 ? results.join(' ') : 'Nothing to stop.';
}

// ── Edit ─────────────────────────────────────────────────────────────────────

async function actionEdit(chatId, editRequest) {
  const session = getSession(chatId);
  if (session.building) return 'App is currently building. Wait for it to finish.';

  // Parse "slug: task" or "slug task" to load a specific app by name
  let appDir = session.currentApp?.appDir;
  let task = String(editRequest || '').trim();
  const knownApps = discoverApps();
  for (const a of knownApps) {
    const slugLower = a.slug.toLowerCase();
    const inputLower = task.toLowerCase();
    if (inputLower === slugLower || inputLower.startsWith(slugLower + ':') || inputLower.startsWith(slugLower + ' ')) {
      const rest = task.slice(a.slug.length).replace(/^[:\s]+/, '').trim();
      task = rest || 'fix all runtime and bundle errors';
      appDir = path.join(ROOT, 'apps', a.slug);
      session.currentApp = {
        idea: { name: a.name },
        slug: a.slug,
        appDir,
        stage: 'ready',
      };
      break;
    }
  }
  if (!appDir) appDir = session.currentApp?.appDir;
  if (!task) task = 'fix all runtime and bundle errors';
  if (!appDir && knownApps.length > 0) {
    const withDir = knownApps.map(a => ({ ...a, dir: path.join(ROOT, 'apps', a.slug) }))
      .filter(a => fs.existsSync(a.dir));
    const pick = withDir.sort((a, b) => fs.statSync(b.dir).mtimeMs - fs.statSync(a.dir).mtimeMs)[0];
    if (pick) {
      appDir = pick.dir;
      session.currentApp = { idea: { name: pick.name }, slug: pick.slug, appDir, stage: 'ready' };
    }
  }
  if (!appDir || !fs.existsSync(appDir)) return 'No app to edit. Build one first, or say "edit pipeline-test-01: fix the errors" to target a specific app.';

  const appName = session.currentApp?.idea?.name || path.basename(appDir);

  session.building = true;
  session.currentApp.stage = 'editing';
  const progress = createProgressReporter(chatId, { prefix: 'Edit' });

  await sendMsg(chatId, `Editing *${appName}*...`);
  const stopTyping = startTyping(chatId);

  const result = await runCodeAgent({
    appDir,
    task,
    idea: session.currentApp.idea,
    model: resolveModel(session.tier, 'repair'),
    onProgress: progress,
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

  if (result.filesChanged.includes('package.json')) {
    await sendMsg(chatId, 'Installing dependencies...');
    await exec('npm', ['install'], { cwd: appDir, timeout: 90_000, chatId, label: 'install:app-deps' });
  }

  const gate = await enforceQualityGate(appDir, {
    mode: 'strict',
    autofix: true,
    model: resolveModel(session.tier, 'repair'),
    onProgress: progress,
  });
  if (!gate.ok) {
    const summary = (gate.errors || []).map(e => e.message).slice(0, 5).join('\n');
    await sendMsg(chatId, `Post-edit quality gate found issues:\n${summary}`);
  }

  const ssDir = path.join(appDir, 'qa-screenshots');
  if (fs.existsSync(ssDir)) {
    const shots = fs.readdirSync(ssDir).filter(f => f.endsWith('.png')).sort().slice(-2);
    for (const s of shots) {
      try { await bot.sendPhoto(chatId, path.join(ssDir, s), { caption: `${appName} — updated` }); } catch {}
    }
  }

  session.currentApp.stage = 'ready';
  const changedList = result.filesChanged.map(f => `\`${f}\``).join(', ');
  return `*Done.* ${result.summary}\n\nChanged: ${changedList}`;
}

// ── Deploy ───────────────────────────────────────────────────────────────────

async function actionDeploy(chatId) {
  const session = getSession(chatId);
  if (!session.currentApp?.slug) return 'No app to deploy. Build one first.';
  if (session.building) return 'Already building. Hang tight.';
  const progress = createProgressReporter(chatId, { prefix: 'Deploy' });

  session.building = true;
  session.currentApp.stage = 'deploying';
  const appName = session.currentApp.idea.name;
  const appDir = session.currentApp.appDir;

  const gate = await enforceQualityGate(appDir, {
    mode: 'strict',
    autofix: false,
    model: resolveModel(session.tier, 'repair'),
    onProgress: progress,
  });
  if (!gate.ok) {
    session.building = false;
    session.currentApp.stage = 'ready';
    const summary = (gate.errors || []).map(e => `- ${e.message}`).slice(0, 6).join('\n');
    return `Deploy blocked: quality gate failed.\n${summary}\n\nFix issues first, then say "deploy".`;
  }

  if (DRY_RUN) {
    session.building = false;
    session.currentApp.stage = 'ready';
    return `Deploy dry-run OK for *${appName}* (strict gate passed).`;
  }

  await sendMsg(chatId, `Submitting *${appName}* to Apple...\nI'll send updates as it progresses.`);
  registerWebhook(session.currentApp.slug, chatId);

  let stdout = '', stderr = '';
  const deployProc = spawn('bash', [path.join(ROOT, 'scripts', 'deploy.sh'), session.currentApp.slug], {
    cwd: ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  trackProcess(chatId, deployProc, `deploy:${session.currentApp.slug}`);

  session.deployStart = Date.now();
  deployProc.stdout.on('data', (d) => { stdout += d.toString(); });
  deployProc.stderr.on('data', (d) => { stderr += d.toString(); });

  const heartbeat = setInterval(() => {
    const elapsed = ((Date.now() - session.deployStart) / 1000).toFixed(0);
    sendMsg(chatId, `Deploy in progress... (${elapsed}s)`).catch(() => {});
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
        const errSnippet = (stderr || stdout).split('\n').filter(l => /error|fail|reject/i.test(l)).slice(-3).join('\n');
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

function actionStatus(chatId) {
  const session = getSession(chatId);
  const t = session.tier || DEFAULT_TIER;
  const tierLabel = (TIER_INFO[t] || TIER_INFO[DEFAULT_TIER]).label;
  const tierLine = `Model tier: *${tierLabel}*`;
  if (!session.currentApp) return `No app in progress.\n${tierLine}`;
  const a = session.currentApp;
  return `*${a.idea.name}* — stage: \`${a.stage}\`${session.building ? ' (building...)' : ''}\n${tierLine}`;
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
    response = await llmChat(messages, { model: CONV_MODEL, temperature: 0.75, max_tokens: TOKEN_BUDGETS.conversation });
  } catch (e) {
    log(chatId, `Conv model failed: ${e.message}, trying free fallback`);
    try {
      response = await llmChat(messages, { model: CONV_MODEL_FREE, temperature: 0.75, max_tokens: TOKEN_BUDGETS.conversation });
    } catch (e2) {
      log(chatId, `Free fallback also failed: ${e2.message}`);
      stopTyping();
      return sendMsg(chatId, "Something broke on my end. Try again in a sec.");
    }
  }

  stopTyping();

  const refineMatch = response.match(/\[REFINE:([\s\S]*?)\]\s*$/);
  if (refineMatch) {
    try {
      const draft = JSON.parse(refineMatch[1]);
      session.ideaDraft = { ...session.ideaDraft, ...draft };
      session.phase = 'refining';
      log(chatId, `Refine: ${JSON.stringify(session.ideaDraft).slice(0, 120)}`);
    } catch { log(chatId, 'Refine parse failed, ignoring'); }
  }

  const actionMatch = response.match(/\[ACTION:(\w+)(?::(.+?))?\]\s*$/s);

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
      case 'stop':
        result = await actionStop(chatId);
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

// ── Message queue ────────────────────────────────────────────────────────────

const messageQueues = new Map();

function enqueue(chatId, fn) {
  if (!messageQueues.has(chatId)) messageQueues.set(chatId, Promise.resolve());
  const chain = messageQueues.get(chatId).then(fn).catch(e => { log(chatId, `Queue error: ${e.message}`); });
  messageQueues.set(chatId, chain);
}

bot.on('message', (msg) => {
  if (!msg.text) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  log(chatId, `<< ${text.slice(0, 100)}`);

  enqueue(chatId, async () => {
    // ── Slash commands ─────────────────────────────────────────────────────
    if (text.startsWith('/')) {
      const cmd = text.split(/\s+/)[0].toLowerCase();
      switch (cmd) {
        case '/start': {
          const session = getSession(chatId);
          session.history = [];
          session.ideaDraft = null;
          session.phase = 'idle';
          session.currentApp = null;
          session.building = false;
          session.aborted = false;
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
        case '/help':
          await sendMsg(chatId, [
            '*/start* — Reset session, welcome',
            '*/status* — Current app and stage',
            '*/stop* — Cancel build, kill preview',
            '*/restart* — Restart the bot (exits process)',
            '',
            '*Model tiers* (type to switch):',
            '`tier eco` — Gemini Flash, fastest, cheapest (default)',
            '`tier standard` — Gemini 2.5 Flash, deeper reasoning',
            '`tier pro` — Claude Sonnet, maximum quality',
            '',
            'Or just chat: build, edit, preview, deploy.',
          ].join('\n'));
          return;
        case '/status': {
          const result = actionStatus(chatId);
          await sendMsg(chatId, result);
          return;
        }
        case '/stop': {
          const result = await actionStop(chatId);
          await sendMsg(chatId, result + ' What else?');
          return;
        }
        case '/restart':
          await sendMsg(chatId, 'Restarting in 10s...');
          log(chatId, 'Restart requested via /restart');
          try { fs.writeFileSync(path.join(ROOT, '.restart-chat.json'), JSON.stringify({ chatId })); } catch {}
          // 10s: ack update (poll timeout 2s) + let Telegram release old connection (avoids 409)
          setTimeout(() => process.kill(process.pid, 'SIGTERM'), 10000);
          return;
        default:
          break;
      }
    }

    // Tier switching — natural language or /tier command
    const tierCmd = text.match(/^(?:\/tier|tier|use|switch\s+to|set\s+model)\s+(eco|standard|pro)$/i);
    if (tierCmd) {
      const newTier = tierCmd[1].toLowerCase();
      const session = getSession(chatId);
      session.tier = newTier;
      scheduleSave();
      const info = TIER_INFO[newTier];
      await sendMsg(chatId, `Model tier set to *${info.label}*.\n${info.desc}\n\nTakes effect on the next build or edit.`);
      return;
    }
    if (/^(what|which)\s+(tier|model|mode)(\s+am\s+i\s+(using|on))?/i.test(text)) {
      const session = getSession(chatId);
      const t = session.tier || DEFAULT_TIER;
      const info = TIER_INFO[t] || TIER_INFO[DEFAULT_TIER];
      const models = getModels(t);
      await sendMsg(chatId, [
        `Current tier: *${info.label}*`,
        info.desc,
        '',
        `Design: \`${models.design}\``,
        `Code: \`${models.codegen}\``,
        `Repair: \`${models.repair}\``,
        '',
        'Switch with: `tier eco` / `tier standard` / `tier pro`',
      ].join('\n'));
      return;
    }

    const previewCmd = text.match(/^preview(?:\s+(.+))?$/i);
    if (previewCmd) {
      const target = previewCmd[1]?.trim();
      if (target) {
        const known = discoverApps();
        const t = target.toLowerCase();
        const pick = known.find(a => a.slug.toLowerCase() === t || (a.name || '').toLowerCase() === t)
          || known.find(a => a.slug.toLowerCase().includes(t) || (a.name || '').toLowerCase().includes(t));
        if (pick) {
          getSession(chatId).currentApp = {
            idea: { name: pick.name, architecture: pick.architecture, description: pick.description },
            slug: pick.slug,
            appDir: path.join(ROOT, 'apps', pick.slug),
            stage: 'ready',
          };
        }
      }
      const result = await actionPreview(chatId);
      addToHistory(getSession(chatId), 'assistant', result);
      await sendMsg(chatId, result);
      return;
    }

    const editCmd = text.match(/^edit\s+(.+)$/i);
    if (editCmd) {
      const result = await actionEdit(chatId, editCmd[1].trim());
      addToHistory(getSession(chatId), 'assistant', result);
      await sendMsg(chatId, result);
      return;
    }

    // "go" / "build it" / "yes" / "do it" when a draft is ready — fire build immediately.
    const goWords = /^(go|build\s+it|do\s+it|yes|yeah|yep|ok|okay|lets?\s+go|fire|ship\s+it|run\s+it)$/i;
    const sess = getSession(chatId);
    if (goWords.test(text) && sess.ideaDraft && sess.phase === 'refining' && !sess.building) {
      const d = sess.ideaDraft;
      const spec = [
        d.name && `Name: ${d.name}`,
        d.description && `Description: ${d.description}`,
        d.style && `Visual style: ${d.style}`,
        d.personality && `Personality: ${d.personality}`,
        d.core_interaction && `Core interaction: ${d.core_interaction}`,
        d.key_feature && `Key feature: ${d.key_feature}`,
      ].filter(Boolean).join('. ');
      const result = await actionCustom(chatId, spec);
      addToHistory(sess, 'assistant', result);
      await sendMsg(chatId, result);
      return;
    }

    const stopWords = /^(no|nope|stop|cancel|abort|clean\s*up|nah|never\s*mind|quit|nvm)$/i;
    if (stopWords.test(text)) {
      const result = await actionStop(chatId);
      await sendMsg(chatId, result + ' What else?');
      return;
    }

    if (/(build\s+pipeline|pipeline).*(ensured|ensure|ready|healthy|working)\??/i.test(text)) {
      await sendMsg(chatId, pipelineHealthStatus());
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
      } catch (e) { console.error('[webhook] Parse error:', e.message); }
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

// ── File watcher (replaces node --watch; SIGTERM works cleanly) ─────────────

function watchForCodeChanges() {
  if (HEADLESS_TEST) return;
  const dirs = [path.join(ROOT, 'bot'), path.join(ROOT, 'orchestrator')];
  let debounce = null;
  for (const dir of dirs) {
    try {
      fs.watch(dir, { recursive: true }, (ev, name) => {
        if (name && name.endsWith('.js')) {
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => {
            console.log('[bot] Code changed, exiting for launchd restart');
            process.exit(0);
          }, 1000);
        }
      });
    } catch (e) {}
  }
}

// ── Startup ──────────────────────────────────────────────────────────────────

function startBotRuntime() {
  console.log('[bot] Starting...');
  loadSessions();
  webhookServer.listen(WEBHOOK_PORT, () => { console.log(`[bot] Webhook: http://localhost:${WEBHOOK_PORT}`); });
  watchForCodeChanges();
  bot.getMe().then(async (me) => {
    console.log(`[bot] Live as @${me.username}`);
    const restartFp = path.join(ROOT, '.restart-chat.json');
    if (fs.existsSync(restartFp)) {
      try {
        const { chatId } = JSON.parse(fs.readFileSync(restartFp, 'utf8'));
        fs.unlinkSync(restartFp);
        await new Promise(r => setTimeout(r, 5000));
        await bot.sendMessage(chatId, 'Back online.');
        console.log(`[bot] Notified ${chatId} back online`);
      } catch (e) { console.error('[bot] Back-online send failed:', e.message); }
    }
  }).catch(e => { console.error('[bot] Failed:', e.message); process.exit(1); });
}

if (!HEADLESS_TEST && require.main === module) {
  startBotRuntime();
}

module.exports = {
  getSession, actionPreview, actionDeploy, actionStop, actionStatus, sendMsg,
  trackProcess, killTrackedProcesses,
  __test: {
    headlessMessages,
    clearHeadlessMessages: () => { headlessMessages.length = 0; },
    setCurrentApp: (chatId, app) => { const s = getSession(chatId); s.currentApp = app; return s; },
    isHeadless: HEADLESS_TEST,
    isDryRun: DRY_RUN,
  },
};
