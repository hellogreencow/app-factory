/**
 * Data store for iOS App Factory.
 *
 * Dual-mode: uses Supabase when configured, falls back to local JSON files.
 * All functions are async to support both modes uniformly.
 * The server code should await all store calls.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { admin, anon, isConfigured } = require('./supabase');

const DATA_DIR = path.join(__dirname, '..', '..', '.data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const BUILDS_FILE = path.join(DATA_DIR, 'builds.json');
const CHAT_FILE = path.join(DATA_DIR, 'chat.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return {}; }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

const TIERS = {
  free:    { name: 'Free',    creditsPerMonth: 3,   maxApps: 2 },
  premium: { name: 'Premium', creditsPerMonth: 20,  maxApps: 10 },
  genius:  { name: 'Genius',  creditsPerMonth: 100, maxApps: -1 },
};

function nextMonthTimestamp() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════════

async function signUp({ email, name, password }) {
  if (isConfigured()) {
    const { data, error } = await admin.auth.admin.createUser({
      email, password,
      user_metadata: { name: name || email.split('@')[0] },
      email_confirm: true,
    });
    if (error) return { user: null, error: error.message };
    const profile = await getProfile(data.user.id);
    return { user: profile, error: null };
  }
  const users = readJson(USERS_FILE);
  if (users[email]) return { user: null, error: 'email already registered' };
  const passwordHash = crypto.createHash('sha256').update(password + 'iaf-salt').digest('hex');
  const user = {
    id: crypto.randomUUID(), email,
    name: name || email.split('@')[0],
    passwordHash, tier: 'free',
    credits: TIERS.free.creditsPerMonth,
    creditsResetAt: nextMonthTimestamp(),
    createdAt: Date.now(),
  };
  users[email] = user;
  writeJson(USERS_FILE, users);
  return { user: sanitizeUser(user), error: null };
}

async function signIn({ email, password }) {
  if (isConfigured()) {
    const client = anon || admin;
    const { data: signData, error: signErr } = await client.auth.signInWithPassword({ email, password });
    if (signErr) return { user: null, session: null, error: signErr.message };
    const profile = await getProfile(signData.user.id);
    return { user: profile, session: signData.session, error: null };
  }
  const users = readJson(USERS_FILE);
  const user = users[email];
  if (!user) return { user: null, session: null, error: 'invalid credentials' };
  const hash = crypto.createHash('sha256').update(password + 'iaf-salt').digest('hex');
  if (hash !== user.passwordHash) return { user: null, session: null, error: 'invalid credentials' };
  const session = { id: crypto.randomUUID(), userId: user.id };
  const sessions = readJson(SESSIONS_FILE);
  sessions[session.id] = { ...session, createdAt: Date.now(), lastActiveAt: Date.now() };
  writeJson(SESSIONS_FILE, sessions);
  return { user: sanitizeUser(user), session, error: null };
}

async function getProfile(userId) {
  if (isConfigured()) {
    const { data } = await admin.from('profiles').select('*').eq('id', userId).single();
    return data;
  }
  const users = readJson(USERS_FILE);
  const user = Object.values(users).find(u => u.id === userId);
  return user ? sanitizeUser(user) : null;
}

async function getProfileBySession(sessionId) {
  if (!sessionId) return null;
  if (isConfigured()) {
    const { data: { user } } = await admin.auth.getUser(sessionId);
    if (!user) return null;
    return getProfile(user.id);
  }
  const sessions = readJson(SESSIONS_FILE);
  const sess = sessions[sessionId];
  if (!sess) return null;
  return getProfile(sess.userId);
}

function sanitizeUser(u) {
  return { id: u.id, email: u.email, name: u.name, tier: u.tier, credits: u.credits };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREDITS
// ═══════════════════════════════════════════════════════════════════════════════

async function deductCredit(userId) {
  if (isConfigured()) {
    const { data, error } = await admin.rpc('deduct_credit', { p_user_id: userId });
    if (error) return { ok: false, error: error.message };
    return data;
  }
  const users = readJson(USERS_FILE);
  const user = Object.values(users).find(u => u.id === userId);
  if (!user) return { ok: false, error: 'User not found' };
  if (Date.now() >= (user.creditsResetAt || 0)) {
    const tierInfo = TIERS[user.tier] || TIERS.free;
    user.credits = tierInfo.creditsPerMonth;
    user.creditsResetAt = nextMonthTimestamp();
  }
  if (user.credits <= 0) return { ok: false, error: 'No credits remaining', tier: user.tier };
  user.credits -= 1;
  writeJson(USERS_FILE, users);
  return { ok: true, remaining: user.credits };
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPS
// ═══════════════════════════════════════════════════════════════════════════════

async function createApp({ userId, slug, name, description, design, styleNotes }) {
  if (isConfigured()) {
    const { data, error } = await admin.from('apps').insert({
      user_id: userId, slug, name,
      description, design, style_notes: styleNotes,
    }).select().single();
    if (error) return null;
    return data;
  }
  const apps = readJson(path.join(DATA_DIR, 'apps.json'));
  const app = {
    id: crypto.randomUUID(), user_id: userId, slug, name,
    description, design, style_notes: styleNotes,
    status: 'draft', screen_count: 0,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  apps[app.id] = app;
  writeJson(path.join(DATA_DIR, 'apps.json'), apps);
  return app;
}

async function getApp(appId) {
  if (isConfigured()) {
    const { data } = await admin.from('apps').select('*').eq('id', appId).single();
    return data;
  }
  const apps = readJson(path.join(DATA_DIR, 'apps.json'));
  return apps[appId] || null;
}

async function getAppBySlug(userId, slug) {
  if (isConfigured()) {
    const { data } = await admin.from('apps').select('*')
      .eq('user_id', userId).eq('slug', slug).single();
    return data;
  }
  const apps = readJson(path.join(DATA_DIR, 'apps.json'));
  return Object.values(apps).find(a => a.user_id === userId && a.slug === slug) || null;
}

async function listApps(userId) {
  if (isConfigured()) {
    const { data } = await admin.from('apps').select('*')
      .eq('user_id', userId).order('updated_at', { ascending: false });
    return data || [];
  }
  const apps = readJson(path.join(DATA_DIR, 'apps.json'));
  return Object.values(apps)
    .filter(a => a.user_id === userId)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

async function updateApp(appId, updates) {
  if (isConfigured()) {
    const { data } = await admin.from('apps').update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', appId).select().single();
    return data;
  }
  const apps = readJson(path.join(DATA_DIR, 'apps.json'));
  if (!apps[appId]) return null;
  Object.assign(apps[appId], updates, { updated_at: new Date().toISOString() });
  writeJson(path.join(DATA_DIR, 'apps.json'), apps);
  return apps[appId];
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILDS
// ═══════════════════════════════════════════════════════════════════════════════

async function createBuild({ appId, userId }) {
  if (isConfigured()) {
    const { data, error } = await admin.from('builds').insert({
      app_id: appId, user_id: userId,
    }).select().single();
    if (error) return null;
    return data;
  }
  const builds = readJson(BUILDS_FILE);
  const build = {
    id: crypto.randomUUID(), app_id: appId, user_id: userId,
    phase: 'scaffold', status: 'running',
    started_at: new Date().toISOString(), finished_at: null,
    duration_s: null, screen_count: null, screens_passed: null,
    error_message: null, result: null,
  };
  builds[build.id] = build;
  writeJson(BUILDS_FILE, builds);
  return build;
}

async function updateBuild(buildId, updates) {
  if (isConfigured()) {
    const { data } = await admin.from('builds').update(updates)
      .eq('id', buildId).select().single();
    return data;
  }
  const builds = readJson(BUILDS_FILE);
  if (!builds[buildId]) return null;
  Object.assign(builds[buildId], updates);
  writeJson(BUILDS_FILE, builds);
  return builds[buildId];
}

async function getBuild(buildId) {
  if (isConfigured()) {
    const { data } = await admin.from('builds').select('*').eq('id', buildId).single();
    return data;
  }
  const builds = readJson(BUILDS_FILE);
  return builds[buildId] || null;
}

async function listBuilds(userId, limit = 30) {
  if (isConfigured()) {
    const { data } = await admin.from('builds').select('*, apps(name, slug)')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit);
    return data || [];
  }
  const builds = readJson(BUILDS_FILE);
  return Object.values(builds)
    .filter(b => b.user_id === userId)
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
    .slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

async function saveMessage({ userId, sessionId, role, content, metadata }) {
  if (isConfigured()) {
    const { error } = await admin.from('chat_messages').insert({
      user_id: userId, session_id: sessionId, role, content, metadata,
    });
    if (error) process.stderr.write(`[store] chat save error: ${error.message}\n`);
    return;
  }
  const chat = readJson(CHAT_FILE);
  if (!chat[sessionId]) chat[sessionId] = [];
  chat[sessionId].push({ role, content, metadata, created_at: new Date().toISOString() });
  if (chat[sessionId].length > 200) chat[sessionId] = chat[sessionId].slice(-200);
  writeJson(CHAT_FILE, chat);
}

async function getChatHistory(userId, sessionId, limit = 50) {
  if (isConfigured()) {
    const { data } = await admin.from('chat_messages')
      .select('role, content, created_at')
      .eq('user_id', userId).eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);
    return data || [];
  }
  const chat = readJson(CHAT_FILE);
  return (chat[sessionId] || []).slice(-limit);
}

async function listChatSessions(userId, limit = 20) {
  if (isConfigured()) {
    const { data } = await admin.rpc('list_chat_sessions', { p_user_id: userId, p_limit: limit });
    return data || [];
  }
  const chat = readJson(CHAT_FILE);
  return Object.entries(chat)
    .filter(([, msgs]) => msgs.length > 0)
    .map(([sid, msgs]) => ({
      session_id: sid,
      last_message: msgs[msgs.length - 1].content.slice(0, 100),
      message_count: msgs.length,
      last_active: msgs[msgs.length - 1].created_at,
    }))
    .sort((a, b) => new Date(b.last_active) - new Date(a.last_active))
    .slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREENSHOTS
// ═══════════════════════════════════════════════════════════════════════════════

async function uploadScreenshot({ buildId, appId, filePath, screenName }) {
  if (!isConfigured()) return { url: null, storagePath: null };
  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath) || '.png';
  const storagePath = `${appId}/${buildId}/${screenName || crypto.randomUUID()}${ext}`;

  const { error: upErr } = await admin.storage
    .from('screenshots')
    .upload(storagePath, fileBuffer, { contentType: 'image/png', upsert: true });
  if (upErr) {
    process.stderr.write(`[store] screenshot upload error: ${upErr.message}\n`);
    return { url: null, storagePath: null };
  }

  const { data: { publicUrl } } = admin.storage.from('screenshots').getPublicUrl(storagePath);

  await admin.from('screenshots').insert({
    build_id: buildId, app_id: appId, storage_path: storagePath, screen_name: screenName,
  });

  return { url: publicUrl, storagePath };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  TIERS,
  isConfigured,
  signUp,
  signIn,
  getProfile,
  getProfileBySession,
  deductCredit,
  createApp,
  getApp,
  getAppBySlug,
  listApps,
  updateApp,
  createBuild,
  updateBuild,
  getBuild,
  listBuilds,
  saveMessage,
  getChatHistory,
  listChatSessions,
  uploadScreenshot,
};
