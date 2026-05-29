/**
 * build-memory.js — Persistent build memory for cross-session learning.
 *
 * Tracks: successful patterns, common errors and their fixes, screen generation
 * success rates, and per-user preferences. Used to prime future build prompts
 * with evidence from past builds.
 */

const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(__dirname, '..', '..', '.data', 'build-memory.json');
const MAX_PATTERNS = 200;
const MAX_ERRORS = 100;

function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_PATH)) {
      return JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
    }
  } catch (e) { process.stderr.write(`[build-memory] Load failed: ${e.message}\n`); }
  return { patterns: [], errors: [], stats: { builds: 0, screens: 0, repairs: 0, successes: 0 } };
}

function saveMemory(mem) {
  try {
    const dir = path.dirname(MEMORY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(mem, null, 2), 'utf8');
  } catch (e) { process.stderr.write(`[build-memory] Save failed: ${e.message}\n`); }
}

/**
 * Record a successful build pattern.
 */
function recordSuccess(buildResult) {
  const mem = loadMemory();
  mem.stats.builds++;
  if (buildResult.ok) mem.stats.successes++;

  if (buildResult.design) {
    const pattern = {
      type: 'design',
      ts: Date.now(),
      name: buildResult.design.name,
      screens: buildResult.design.screens?.length || 0,
      navigation: buildResult.design.navigation?.type,
      libs: [...new Set((buildResult.design.screens || []).flatMap(s =>
        (s.features || []).flatMap(f => f.libraries || [])
      ))],
    };
    mem.patterns.push(pattern);
  }

  if (mem.patterns.length > MAX_PATTERNS) mem.patterns = mem.patterns.slice(-MAX_PATTERNS);
  saveMemory(mem);
}

/**
 * Record a repair that fixed an error (so we can prevent it next time).
 */
function recordErrorFix(errorMessage, fix) {
  const mem = loadMemory();
  mem.stats.repairs++;

  const shortErr = String(errorMessage).slice(0, 300);
  const existing = mem.errors.find(e => e.error === shortErr);
  if (existing) {
    existing.count++;
    existing.lastFix = fix;
    existing.lastTs = Date.now();
  } else {
    mem.errors.push({
      error: shortErr,
      fix: String(fix).slice(0, 500),
      count: 1,
      lastTs: Date.now(),
    });
  }

  if (mem.errors.length > MAX_ERRORS) {
    mem.errors.sort((a, b) => b.count - a.count);
    mem.errors = mem.errors.slice(0, MAX_ERRORS);
  }
  saveMemory(mem);
}

/**
 * Get a prompt section with known error patterns to avoid.
 */
function getErrorAvoidanceContext() {
  const mem = loadMemory();
  const topErrors = mem.errors
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (!topErrors.length) return '';

  return '\nKNOWN ERROR PATTERNS (avoid these):\n' +
    topErrors.map(e => `- Error: ${e.error}\n  Fix: ${e.fix}`).join('\n') + '\n';
}

/**
 * Get build statistics for display.
 */
function getStats() {
  return loadMemory().stats;
}

module.exports = {
  recordSuccess,
  recordErrorFix,
  getErrorAvoidanceContext,
  getStats,
  loadMemory,
};
