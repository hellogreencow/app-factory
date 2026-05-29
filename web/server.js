#!/usr/bin/env node
/**
 * Web UI server for iOS App Factory.
 *
 * Agent-style dashboard with real-time file watching, structured build events,
 * and conversational chat. Shows every file written, every command run,
 * every decision made -- like a real coding agent.
 */

require('../orchestrator/lib/env').loadEnv();

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const net = require('net');
const { spawn } = require('child_process');
const QRCode = require('qrcode');
const { build, PHASE } = require('../orchestrator/pipeline');
const { chat: llmChat, chatStream: llmStream } = require('../orchestrator/lib/llm');
const { runCodeAgent } = require('../orchestrator/code-agent');
const { getModels, TOKEN_BUDGETS } = require('../orchestrator/lib/models');

const TIER = 'pro';

const PORT = parseInt(process.env.WEB_PORT || '3700', 10);
const ROOT = path.join(__dirname, '..');
const APPS_DIR = path.join(ROOT, 'apps');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// On port bind races, ws re-emits the underlying server error.
// Handle it here so the retry logic in startServer can continue.
wss.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') return;
  const ts = new Date().toISOString().slice(11, 19);
  process.stderr.write(`[${ts}] [web] WebSocket error: ${err.message}\n`);
});

app.use(express.json());
app.use((req, _res, next) => {
  req.cookies = {};
  const c = req.headers.cookie;
  if (c) c.split(';').forEach(p => { const [k, v] = p.trim().split('='); if (k && v) req.cookies[k] = v; });
  next();
});
const FRONTEND_DIST = path.join(__dirname, 'frontend', 'dist');
const hasFrontend = fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));
if (hasFrontend) {
  app.use(express.static(FRONTEND_DIST));
} else {
  app.use(express.static(path.join(__dirname, 'public')));
}

// ── State ────────────────────────────────────────────────────────────────────

const builds = new Map();
let activeBuildId = null;
let activeBuildAborted = false;
const MAX_HISTORY = 30;

const sessions = new Map();
const APPS_CACHE_TTL_MS = 5000;
const appsCache = { ts: 0, value: [] };
const outgoingQueue = [];
let outgoingFlushTimer = null;
const telemetry = {
  queuedMessages: 0,
  sentMessages: 0,
  flushes: 0,
  lastFlushMs: 0,
  fileEvents: 0,
  stepEvents: 0,
  traceEvents: 0,
};

function getSession(id) {
  if (!id) id = crypto.randomUUID();
  if (!sessions.has(id)) {
    sessions.set(id, {
      id,
      chatHistory: [],
      appSlug: null,
      appDir: null,
      buildId: null,
      editInProgress: false,
    });
  }
  return sessions.get(id);
}

function getOrCreateSessionId(req) {
  let sid = req.cookies?.session || req.headers['x-session-id'];
  if (!sid || !sessions.has(sid)) {
    sid = crypto.randomUUID();
    sessions.set(sid, {
      id: sid,
      chatHistory: [],
      appSlug: null,
      appDir: null,
      buildId: null,
      editInProgress: false,
    });
  }
  return sid;
}

function flushOutgoingQueue() {
  outgoingFlushTimer = null;
  if (!outgoingQueue.length) return;
  const startedAt = Date.now();
  const payloads = outgoingQueue.splice(0, outgoingQueue.length);
  let activeClients = 0;
  for (const ws of wss.clients) {
    if (ws.readyState !== 1) continue;
    activeClients += 1;
    for (const payload of payloads) ws.send(payload);
  }
  telemetry.flushes += 1;
  telemetry.lastFlushMs = Date.now() - startedAt;
  telemetry.sentMessages += payloads.length * activeClients;
}

function broadcast(msg) {
  outgoingQueue.push(JSON.stringify(msg));
  telemetry.queuedMessages += 1;
  if (outgoingFlushTimer) return;
  outgoingFlushTimer = setTimeout(flushOutgoingQueue, 40);
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || `app-${Date.now().toString(36)}`;
}

function invalidateAppsCache() {
  appsCache.ts = 0;
  appsCache.value = [];
}

function isClarifyingReply(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  const sentences = t.split(/[.!]\s+/);
  const lastSentence = sentences[sentences.length - 1].trim();
  return lastSentence.endsWith('?');
}

// ── File watcher ─────────────────────────────────────────────────────────────

function startFileWatcher(buildId, appDir) {
  const known = new Map();
  const WATCH_EXTS = new Set(['.js', '.json', '.jsx', '.ts', '.tsx']);
  const IGNORE = new Set(['node_modules', '.bundle-check', '.expo', 'qa-screenshots']);
  const IGNORE_FILES = new Set(['package-lock.json']);

  async function emitFile(fullPath, relPath, isNew) {
    try {
      const stat = await fs.promises.stat(fullPath);
      const prev = known.get(relPath);
      if (prev && prev.mtime === stat.mtimeMs && prev.size === stat.size) return;
      const content = await fs.promises.readFile(fullPath, 'utf8');
      const lines = content.split('\n');
      const isStub = content.includes('// STUB') || lines.length < 8;
      if (isStub && prev) return;
      known.set(relPath, { mtime: stat.mtimeMs, size: stat.size });
      if (prev || (!prev && lines.length > 5)) {
        telemetry.fileEvents += 1;
        broadcast({
          type: 'build:file',
          id: buildId,
          path: relPath,
          lines: lines.length,
          size: content.length,
          preview: lines.slice(0, 12).join('\n'),
          isNew,
        });
      }
    } catch (e) { /* skip transient files */ }
  }

  const watcher = chokidar.watch(appDir, {
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
    ignored: (fullPath) => {
      const relPath = path.relative(appDir, fullPath);
      if (!relPath || relPath.startsWith('..')) return false;
      const segs = relPath.split(path.sep);
      if (segs.some(s => IGNORE.has(s) || s.startsWith('.'))) return true;
      const fileName = segs[segs.length - 1];
      if (IGNORE_FILES.has(fileName)) return true;
      return false;
    },
  });

  const onFile = (fullPath, isNew) => {
    const relPath = path.relative(appDir, fullPath).split(path.sep).join('/');
    const fileName = path.basename(relPath);
    const ext = path.extname(fileName);
    if (!WATCH_EXTS.has(ext) || IGNORE_FILES.has(fileName)) return;
    void emitFile(fullPath, relPath, isNew);
  };

  watcher.on('add', (fullPath) => onFile(fullPath, true));
  watcher.on('change', (fullPath) => onFile(fullPath, false));

  return () => {
    try { watcher.close(); } catch (e) { /* noop */ }
  };
}

// ── Chat Agent ───────────────────────────────────────────────────────────────

const AGENT_PROMPT = `You are the iOS App Factory assistant. You turn ideas into working iOS apps.

TONE: Direct, concise, warm. 1-3 sentences max. No corporate filler. No emoji.

ROUTING:
- Greeting with no app idea -> Short greeting + "what do you want to build?"
- Vague topic ("fitness app") -> Ask ONE question to get enough detail. Do NOT build yet.
- Clear idea ("pomodoro timer with stats and dark mode") -> Confirm briefly, then build.
- "surprise me" / "random" / "build something" -> Invent something specific and interesting, then build.
- Question -> Answer it. Do NOT build.
- Edit request on current app -> Use [EDIT:...].
- "stop" / "cancel" -> Acknowledge.

ACTIONS — append exactly one at the end of your reply when ready:
[BUILD:app name, concise description, visual style, key features comma-separated]
[EDIT:precise description of what to change]

BUILD when: user gave a concept + features/style, or said "surprise me".
DO NOT BUILD when: greeting only, pure question, single word with no features, or your reply asks a question.

RULES:
- Keep replies to 1-3 sentences. Get to the point.
- For "surprise me": invent something specific and unusual, not generic wellness/journal apps.
- Never expose [BUILD:...] or [EDIT:...] tags to the user.
- Never rebuild from scratch unless user says "rebuild" or "start over".
- If an app already exists in this session, use [EDIT:...] to modify it, not [BUILD:...].`;

async function discoverApps() {
  if (Date.now() - appsCache.ts < APPS_CACHE_TTL_MS) return appsCache.value;
  if (!fs.existsSync(APPS_DIR)) return [];
  try {
    const entries = await fs.promises.readdir(APPS_DIR, { withFileTypes: true });
    const apps = await Promise.all(entries
      .filter(d => d.isDirectory())
      .map(async (d) => {
        try {
          const raw = await fs.promises.readFile(path.join(APPS_DIR, d.name, 'design.json'), 'utf8');
          const design = JSON.parse(raw);
          return { slug: d.name, name: design.name, screens: design.screens?.length ?? 0 };
        } catch (e) { return null; }
      }));
    const value = apps.filter(Boolean);
    appsCache.ts = Date.now();
    appsCache.value = value;
    return value;
  } catch (e) {
    return [];
  }
}

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message required' });

  const sid = getOrCreateSessionId(req);
  const session = getSession(sid);
  res.setHeader('Set-Cookie', `session=${sid}; HttpOnly; SameSite=Lax; Max-Age=604800; Path=/`);

  session.chatHistory.push({ role: 'user', content: message });
  if (session.chatHistory.length > MAX_HISTORY * 2) session.chatHistory.splice(0, session.chatHistory.length - MAX_HISTORY);

  const apps = await discoverApps();
  const stateCtx = [
    activeBuildId ? 'STATUS: Currently building an app.' : 'STATUS: Idle.',
    session.appSlug ? `CURRENT SESSION APP: ${session.appSlug}` : 'No app in this session yet.',
    session.editInProgress ? 'STATUS: Edit in progress.' : '',
    apps.length ? `All built apps: ${apps.map(a => `${a.name} (${a.screens} screens)`).join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const models = getModels(TIER);
  const model = models.conversation || 'google/gemini-2.0-flash-001';

  try {
    broadcast({ type: 'chat:typing', sessionId: sid });

    const reply = await llmStream([
      { role: 'system', content: AGENT_PROMPT + '\n\n' + stateCtx },
      ...session.chatHistory,
    ], {
      model, temperature: 0.8, max_tokens: TOKEN_BUDGETS.conversation || 700, timeout: 30_000,
      onChunk(delta) {
        broadcast({ type: 'chat:delta', delta, sessionId: sid });
      },
    });

    broadcast({ type: 'chat:done', sessionId: sid });

    const buildMatch = reply.match(/\[BUILD:([\s\S]*?)\]\s*$/);
    const editMatch = reply.match(/\[EDIT:([\s\S]*?)\]\s*$/);
    const cleanReply = reply.replace(/\[(BUILD|EDIT):[\s\S]*?\]\s*$/, '').trim();

    session.chatHistory.push({ role: 'assistant', content: cleanReply });

    if (buildMatch && !activeBuildId && !isClarifyingReply(cleanReply)) {
      const desc = buildMatch[1].trim();
      const id = startBuildFromChat(desc, session);
      return res.json({ reply: cleanReply, buildStarted: true, buildId: id, sessionId: sid });
    }

    if (editMatch && session.appDir && !session.editInProgress && !activeBuildId) {
      const editDesc = editMatch[1].trim();
      runEdit(session, editDesc);
      return res.json({ reply: cleanReply, editStarted: true, sessionId: sid });
    }

    return res.json({ reply: cleanReply, sessionId: sid });
  } catch (e) {
    broadcast({ type: 'chat:done', sessionId: sid });
    return res.json({ reply: `Connection hiccup. Try again. (${e.message.slice(0, 60)})`, sessionId: sid });
  }
});

app.get('/api/session', (req, res) => {
  const sid = getOrCreateSessionId(req);
  const session = getSession(sid);
  res.setHeader('Set-Cookie', `session=${sid}; HttpOnly; SameSite=Lax; Max-Age=604800; Path=/`);
  res.json({ sessionId: sid, appSlug: session.appSlug, editInProgress: session.editInProgress });
});

function startBuildFromChat(description, session) {
  const appName = description.split(/[.!?\n]/)[0].trim().slice(0, 40) || 'New App';
  const slug = slugify(appName);
  const id = crypto.randomUUID();
  const idea = { name: appName, slug, description, domain: 'general', style_notes: 'modern dark' };
  const buildState = { id, idea, phase: PHASE.SCAFFOLD, logs: [], startedAt: Date.now(), result: null };
  builds.set(id, buildState);
  activeBuildId = id;
  activeBuildAborted = false;
  if (session) {
    session.buildId = id;
    session.appSlug = slug;
    session.appDir = path.join(APPS_DIR, slug);
  }
  broadcast({ type: 'build:start', id, idea, phase: PHASE.SCAFFOLD });
  runBuild(id, idea, session);
  return id;
}

async function runEdit(session, editDesc) {
  session.editInProgress = true;
  const editId = crypto.randomUUID().slice(0, 8);
  broadcast({ type: 'edit:start', editId, description: editDesc, slug: session.appSlug });

  const stopWatcher = startFileWatcher(editId, session.appDir);

  try {
    const models = getModels(TIER);
    const result = await runCodeAgent({
      appDir: session.appDir,
      task: editDesc,
      model: models.repair || models.codegen,
      onProgress: (msg) => {
        telemetry.stepEvents += 1;
        broadcast({ type: 'edit:step', editId, msg, kind: classifyEditMsg(msg) });
      },
      onTool: (toolEvent) => {
        telemetry.traceEvents += 1;
        broadcast({ type: 'edit:trace', editId, ...toolEvent });
      },
    });

    broadcast({ type: 'edit:done', editId, ok: result?.ok ?? true, slug: session.appSlug });
  } catch (e) {
    broadcast({ type: 'edit:done', editId, ok: false, error: e.message, slug: session.appSlug });
  } finally {
    stopWatcher();
    session.editInProgress = false;
  }
}

function classifyEditMsg(msg) {
  if (/^(Reading|Read)\b/.test(msg)) return 'read';
  if (/^(Writing|Wrote|Updated|Edited)\b/.test(msg)) return 'write';
  if (/^(Running|Bundle|Test|Checking)\b/.test(msg)) return 'cmd';
  if (/^(Searching|Found)\b/.test(msg)) return 'read';
  if (/^Thinking/.test(msg)) return 'think';
  return 'info';
}

function getMetricsSnapshot() {
  return {
    wsClients: [...wss.clients].filter(c => c.readyState === 1).length,
    queueDepth: outgoingQueue.length,
    queuedMessages: telemetry.queuedMessages,
    sentMessages: telemetry.sentMessages,
    flushes: telemetry.flushes,
    lastFlushMs: telemetry.lastFlushMs,
    fileEvents: telemetry.fileEvents,
    stepEvents: telemetry.stepEvents,
    traceEvents: telemetry.traceEvents,
    activeBuild: Boolean(activeBuildId),
    activeEdits: [...sessions.values()].filter(s => s.editInProgress).length,
    ts: Date.now(),
  };
}

// ── Auth API ─────────────────────────────────────────────────────────────────

const store = require('./lib/store');

app.post('/api/auth/signup', async (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const { user, error } = await store.signUp({ email, name, password });
    if (error) return res.status(409).json({ error });
    const { session: loginSession } = await store.signIn({ email, password });
    const token = loginSession?.access_token || crypto.randomUUID();
    res.setHeader('Set-Cookie', `session=${token}; HttpOnly; SameSite=Lax; Max-Age=604800; Path=/`);
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const { user, session, error } = await store.signIn({ email, password });
    if (error) return res.status(401).json({ error });
    const token = session?.access_token || crypto.randomUUID();
    res.setHeader('Set-Cookie', `session=${token}; HttpOnly; SameSite=Lax; Max-Age=604800; Path=/`);
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  const sid = req.cookies?.session;
  if (!sid) return res.json({ user: null });
  try {
    const user = await store.getProfileBySession(sid);
    res.json({ user: user || null });
  } catch (e) {
    res.json({ user: null });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', 'session=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/');
  res.json({ ok: true });
});

// ── REST API ─────────────────────────────────────────────────────────────────

app.get('/api/builds', (_req, res) => {
  const list = [...builds.values()]
    .sort((a, b) => b.startedAt - a.startedAt)
    .map(b => ({
      id: b.id, name: b.idea.name, slug: b.idea.slug, phase: b.phase,
      ok: b.result?.ok ?? null, startedAt: b.startedAt,
      duration: b.result?.duration ?? null,
      screenCount: b.result?.design?.screens?.length ?? null,
      screenshotCount: b.result?.screenshots?.length ?? 0,
      errors: b.result?.errors ?? [],
    }));
  res.json(list);
});

app.get('/api/builds/:id', (req, res) => {
  const b = builds.get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Build not found' });
  res.json(b);
});

app.get('/api/builds/:id/screenshots', (req, res) => {
  const b = builds.get(req.params.id);
  if (!b || !b.result?.screenshots?.length) return res.json([]);
  res.json(b.result.screenshots.map((p, i) => ({
    index: i, name: path.basename(p),
    url: `/api/builds/${req.params.id}/screenshots/${i}`,
  })));
});

app.get('/api/builds/:id/screenshots/:idx', (req, res) => {
  const b = builds.get(req.params.id);
  const idx = parseInt(req.params.idx, 10);
  if (!b || !b.result?.screenshots?.[idx]) return res.status(404).end();
  const filePath = b.result.screenshots[idx];
  if (!fs.existsSync(filePath)) return res.status(404).end();
  res.sendFile(filePath);
});

app.post('/api/build', (req, res) => {
  if (activeBuildId) return res.status(409).json({ error: 'A build is already running', buildId: activeBuildId });
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: 'description is required' });
  const id = startBuildFromChat(description);
  res.json({ id });
});

app.post('/api/builds/:id/abort', (req, res) => {
  if (activeBuildId !== req.params.id) return res.status(400).json({ error: 'Build is not active' });
  activeBuildAborted = true;
  broadcast({ type: 'build:aborted', id: req.params.id });
  res.json({ ok: true });
});

// ── Expo Preview ─────────────────────────────────────────────────────────────

let activePreview = null;

function ensureEntryPoint(appDir) {
  try {
    const pkgPath = path.join(appDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.main === 'expo-router/entry' && !fs.existsSync(path.join(appDir, 'app'))) {
      pkg.main = 'index.js';
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
    }
  } catch (e) { /* skip */ }
}

function purgeDevDeps(appDir) {
  try {
    const pkgPath = path.join(appDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const devDeps = pkg.devDependencies || {};
    const pruned = Object.entries(devDeps).filter(([k]) =>
      fs.existsSync(path.join(appDir, 'node_modules', ...k.split('/')))
    );
    if (pruned.length < Object.keys(devDeps).length) {
      pkg.devDependencies = Object.fromEntries(pruned);
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    }
  } catch (e) { /* skip */ }
}

function getLanIp() {
  const os = require('os');
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (name.startsWith('utun') || name.startsWith('bridge') || name.startsWith('lo')) continue;
    for (const a of addrs) {
      if (a.family === 'IPv4' && !a.internal) return a.address;
    }
  }
  return '127.0.0.1';
}

function ensureWebDeps(appDir) {
  const deps = ['react-dom', 'react-native-web', '@expo/metro-runtime'];
  const missing = deps.filter(d => !fs.existsSync(path.join(appDir, 'node_modules', ...d.split('/'))));
  if (!missing.length) return Promise.resolve();
  return new Promise((resolve) => {
    const p = spawn('npx', ['expo', 'install', ...missing], {
      cwd: appDir, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const t = setTimeout(() => { try { p.kill(); } catch (e) { /* skip */ } resolve(); }, 60000);
    p.on('exit', () => { clearTimeout(t); resolve(); });
    p.on('error', () => { clearTimeout(t); resolve(); });
  });
}

async function startExpoServer(appDir, port) {
  ensureEntryPoint(appDir);
  purgeDevDeps(appDir);
  await ensureWebDeps(appDir);

  return new Promise((resolve, reject) => {
    const env = { ...process.env, EXPO_NO_DOTENV: '1', REACT_NATIVE_PACKAGER_HOSTNAME: getLanIp() };
    delete env.CI;

    const proc = spawn('npx', ['expo', 'start', '--lan', '--port', String(port)], {
      cwd: appDir, env, stdio: ['ignore', 'pipe', 'pipe'],
    });

    let resolved = false;
    let output = '';
    const lanIp = getLanIp();
    const webUrl = `http://localhost:${port}`;

    const timeout = setTimeout(() => {
      if (!resolved) { proc.kill('SIGTERM'); reject(new Error('Expo start timed out (90s)')); }
    }, 90_000);

    const pollManifest = setInterval(async () => {
      if (resolved) { clearInterval(pollManifest); return; }
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 2000);
        const res = await fetch(`http://localhost:${port}`, {
          signal: ctrl.signal,
          headers: { 'expo-platform': 'ios' },
        });
        clearTimeout(t);
        const txt = await res.text();
        let data;
        try { data = JSON.parse(txt); } catch (e) { return; }
        const hostUri = data?.extra?.expoClient?.hostUri || data?.extra?.expoGo?.debuggerHost;
        if (hostUri) {
          resolved = true;
          clearInterval(pollManifest);
          clearTimeout(timeout);
          const host = hostUri.includes('127.0.0.1') ? `${lanIp}:${port}` : hostUri;
          resolve({ proc, url: `exp://${host}`, webUrl, port });
        }
      } catch (e) { /* not ready yet */ }
    }, 3000);

    function tryResolve(txt) {
      if (resolved) return;
      output += txt;
      const urlMatch = txt.match(/exp:\/\/[^\s"'`]+/i);
      if (urlMatch) {
        resolved = true;
        clearInterval(pollManifest);
        clearTimeout(timeout);
        resolve({ proc, url: urlMatch[0], webUrl, port });
      }
    }

    proc.stdout.on('data', c => tryResolve(c.toString()));
    proc.stderr.on('data', c => tryResolve(c.toString()));
    proc.on('error', e => { clearInterval(pollManifest); clearTimeout(timeout); if (!resolved) reject(e); });
    proc.on('exit', code => {
      clearInterval(pollManifest);
      if (!resolved) { clearTimeout(timeout); reject(new Error(`Expo exited (${code}): ${output.slice(-200)}`)); }
    });
  });
}

function killPreview() {
  if (!activePreview) return;
  try { activePreview.proc.kill('SIGTERM'); } catch (e) { /* skip */ }
  setTimeout(() => { try { activePreview?.proc.kill('SIGKILL'); } catch (e) { /* skip */ } }, 3000);
  activePreview = null;
}

app.post('/api/preview/start', async (req, res) => {
  const { slug } = req.body;
  if (!slug) return res.status(400).json({ error: 'slug required' });

  const appDir = path.join(APPS_DIR, slug);
  if (!fs.existsSync(appDir)) return res.status(404).json({ error: 'App not found' });

  killPreview();

  const port = 8091;
  broadcast({ type: 'preview:starting', slug });

  try {
    const { proc, url, webUrl } = await startExpoServer(appDir, port);
    const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#ffffff', light: '#00000000' } });
    activePreview = { proc, url, webUrl, port, slug, qrDataUrl };

    broadcast({ type: 'preview:ready', slug, url, webUrl, qrDataUrl });
    res.json({ url, webUrl, qrDataUrl });
  } catch (e) {
    broadcast({ type: 'preview:failed', slug, error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/preview/stop', (_req, res) => {
  killPreview();
  broadcast({ type: 'preview:stopped' });
  res.json({ ok: true });
});

app.get('/api/preview/status', (_req, res) => {
  if (!activePreview) return res.json({ active: false });
  res.json({ active: true, slug: activePreview.slug, url: activePreview.url, webUrl: activePreview.webUrl, qrDataUrl: activePreview.qrDataUrl });
});

// ── Build runner ─────────────────────────────────────────────────────────────

async function runBuild(id, idea, session) {
  const state = builds.get(id);
  const appDir = path.join(APPS_DIR, idea.slug);

  const stopWatcher = startFileWatcher(id, appDir);

  const phaseMap = {
    'Creating project': PHASE.SCAFFOLD,
    'Designing app': PHASE.DESIGN,
    'Designed': PHASE.DESIGN,
    'Building': PHASE.GENERATE,
    'Fixing:': PHASE.GENERATE,
    'Repairing': PHASE.REPAIR_GEN,
    'Repair round': PHASE.REPAIR_GEN,
    'Polishing': PHASE.TASTE,
    'Running strict': PHASE.QA,
    'QA failed': PHASE.REPAIR_QA,
  };

  function transformMsg(msg) {
    if (msg.startsWith('Building: ')) return 'Writing screen: ' + msg.slice(10);
    if (msg.startsWith('Building data layer')) return 'Writing data layer...';
    if (msg.startsWith('Building navigation')) return 'Writing navigation + App.js...';
    if (msg.startsWith('Building screens')) return 'Generating screens...';
    if (msg === 'Bundle OK' || msg === 'Bundle check passed') return 'Running bundle check... passed';
    if (msg.startsWith('Bundle check failed')) return 'Running bundle check... failed';
    if (msg.startsWith('Designing app')) return 'Thinking: designing architecture...';
    if (msg.startsWith('Creating project')) return 'Running scaffold: creating project...';
    if (msg.startsWith('Polishing copy')) return 'Running taste agent: polishing copy and colors...';
    if (msg.startsWith('Running strict quality gate')) return 'Running quality gate...';
    if (msg.startsWith('Quality gate:')) return msg;
    if (msg.startsWith('Scanning source')) return 'Reading source files for static analysis...';
    if (msg.startsWith('Checking bundle')) return 'Running bundle check...';
    if (msg.startsWith('Testing in simulator')) return 'Running simulator test...';
    if (msg.startsWith('Repairing')) return 'Running code-agent: ' + msg.toLowerCase();
    if (msg.startsWith('Repair round')) return 'Running code-agent: ' + msg.toLowerCase();
    if (msg.startsWith('Fixing:')) return 'Retrying screen: ' + msg.slice(8);
    return msg;
  }

  function classifyMsg(msg) {
    if (/^Building:\s/.test(msg) || /^Building data layer/.test(msg) || /^Building navigation/.test(msg)) return 'write';
    if (/^Wrote |^Updated |^Edited:/.test(msg)) return 'write';
    if (/^Fixing:/.test(msg)) return 'retry';
    if (/bundle|Bundle|^Checking |^Test /.test(msg)) return 'cmd';
    if (/^Creating project|^Installing/.test(msg)) return 'cmd';
    if (/^Designing|^Designed/.test(msg)) return 'think';
    if (/^Thinking/.test(msg)) return 'think';
    if (/^Reading |^Read /.test(msg)) return 'read';
    if (/^Searching|^Found /.test(msg)) return 'read';
    if (/^Repairing|^Repair round/.test(msg)) return 'repair';
    if (/^Polishing|^Running strict|^QA|^Quality gate/.test(msg)) return 'cmd';
    if (/^Building screens/.test(msg)) return 'tool';
    return 'info';
  }

  function onProgress(msg) {
    telemetry.stepEvents += 1;
    const entry = { ts: Date.now(), msg };
    state.logs.push(entry);
    if (state.logs.length > 500) state.logs = state.logs.slice(-400);

    const display = transformMsg(msg);
    const kind = classifyMsg(msg);
    broadcast({ type: 'build:step', id, msg: display, raw: msg, kind, ts: entry.ts });
    if (display !== msg) {
      telemetry.traceEvents += 1;
      broadcast({ type: 'build:trace', id, kind: 'raw', label: msg, ts: entry.ts });
    }

    if (msg.startsWith('Designed') && !state._designSent) {
      state._designSent = true;
      setTimeout(async () => {
        try {
          const designPath = path.join(appDir, 'design.json');
          if (fs.existsSync(designPath)) {
            const raw = await fs.promises.readFile(designPath, 'utf8');
            const design = JSON.parse(raw);
            broadcast({
              type: 'build:design', id,
              screens: (design.screens || []).map(s => ({ name: s.name, file: s.file })),
              entities: (design.dataModel?.entities || []).map(e => e.name),
              style: design.style,
            });
          }
        } catch (e) { /* skip */ }
      }, 500);
    }

    for (const [prefix, phase] of Object.entries(phaseMap)) {
      if (msg.startsWith(prefix) && state.phase !== phase) {
        state.phase = phase;
        broadcast({ type: 'build:phase', id, phase });
        break;
      }
    }
  }

  try {
    const result = await build(idea, { tier: TIER, onProgress, isAborted: () => activeBuildAborted });
    state.result = result;
    state.phase = result.phase;

    broadcast({
      type: 'build:done', id, ok: result.ok, phase: result.phase,
      duration: result.duration, screenCount: result.design?.screens?.length ?? 0,
      screenshotCount: result.screenshots?.length ?? 0, errors: result.errors ?? [],
      slug: idea.slug,
      genResult: result.genResult ? {
        passed: result.genResult.passed, total: result.genResult.total,
        stubs: result.genResult.stubs, bundleOk: result.genResult.bundleOk,
      } : null,
    });

    if (result.ok) {
      broadcast({ type: 'preview:starting', slug: idea.slug });
      try {
        killPreview();
        const port = 8091;
        const { proc, url, webUrl } = await startExpoServer(appDir, port);
        const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#ffffff', light: '#00000000' } });
        activePreview = { proc, url, webUrl, port, slug: idea.slug, qrDataUrl };
        broadcast({ type: 'preview:ready', slug: idea.slug, url, webUrl, qrDataUrl });
      } catch (e) {
        broadcast({ type: 'preview:failed', slug: idea.slug, error: e.message });
      }
    }
  } catch (e) {
    state.result = { ok: false, errors: [{ phase: 'fatal', message: e.message }], duration: ((Date.now() - state.startedAt) / 1000).toFixed(1) };
    state.phase = PHASE.FAILED;
    broadcast({ type: 'build:done', id, ok: false, phase: PHASE.FAILED, errors: [{ message: e.message }] });
  } finally {
    stopWatcher();
    activeBuildId = null;
    activeBuildAborted = false;
    invalidateAppsCache();
  }
}

// ── WebSocket ────────────────────────────────────────────────────────────────

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'system:metrics', ...getMetricsSnapshot() }));
  if (activeBuildId) {
    const state = builds.get(activeBuildId);
    if (state) {
      ws.send(JSON.stringify({ type: 'build:restore', id: activeBuildId, idea: state.idea, phase: state.phase, logs: state.logs.slice(-50) }));
    }
  }
});

setInterval(() => {
  if (!wss.clients.size) return;
  broadcast({ type: 'system:metrics', ...getMetricsSnapshot() });
}, 2500);

if (hasFrontend) {
  app.use((_req, res) => { res.sendFile(path.join(FRONTEND_DIST, 'index.html')); });
} else {
  app.get('/studio', (_req, res) => { res.sendFile(path.join(__dirname, 'public', 'studio.html')); });
  app.use((_req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => {
      probe.close(() => resolve(true));
    });
    probe.listen(port, '::');
  });
}

async function findAvailablePort(startPort, maxAttempts = 10) {
  for (let i = 0; i <= maxAttempts; i++) {
    const candidate = startPort + i;
    // eslint-disable-next-line no-await-in-loop
    const free = await isPortAvailable(candidate);
    if (free) return candidate;
    const ts = new Date().toISOString().slice(11, 19);
    process.stdout.write(`[${ts}] [web] Port ${candidate} busy, trying ${candidate + 1}...\n`);
  }
  throw new Error(`No open port found from ${startPort} to ${startPort + maxAttempts}`);
}

async function startServer() {
  const chosenPort = await findAvailablePort(PORT, 10);
  server.listen(chosenPort, () => {
    const ts = new Date().toISOString().slice(11, 19);
    process.stdout.write(`[${ts}] [web] Dashboard: http://localhost:${chosenPort}\n`);
  });
}

startServer().catch((err) => {
  const ts = new Date().toISOString().slice(11, 19);
  process.stderr.write(`[${ts}] [web] Failed to start: ${err.message}\n`);
  process.exit(1);
});
