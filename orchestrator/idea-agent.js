#!/usr/bin/env node
/**
 * Idea Agent v2: generates novel app ideas with diversity tracking + schema validation.
 * Outputs JSON: { name, slug, description, features, domain, twist }
 *
 * Modes:
 *   (default) — weighted random from template pool, avoids recent domains
 *   --llm     — uses OpenRouter with a research-grade prompt + schema gate
 */

require('./lib/env').loadEnv();

const fs = require('fs');
const path = require('path');

const HISTORY_PATH = path.join(__dirname, '..', 'benchmark', 'idea-history.json');

const DOMAINS = ['crypto', 'sci-fi', 'fitness', 'productivity', 'reading', 'gaming', 'social', 'music', 'cooking', 'travel', 'education', 'health', 'finance', 'art', 'language'];
const FORMATS = ['tracker', 'reader', 'journal', 'dashboard', 'explorer', 'collector', 'planner', 'companion', 'coach', 'analyzer'];
const TWISTS = ['minimal', 'dark-mode', 'offline-first', 'gamified', 'AI-assisted', 'voice-first', 'social-graph', 'privacy-centric', 'streak-based', 'community-driven'];
const ARCHITECTURES = ['feed', 'dashboard', 'tracker', 'reference', 'generic'];

const DOMAIN_TO_ARCH = {
  social: 'feed', music: 'feed', gaming: 'feed',
  finance: 'dashboard', crypto: 'dashboard', health: 'dashboard', fitness: 'dashboard',
  productivity: 'tracker', education: 'tracker', language: 'tracker',
  reading: 'reference', 'sci-fi': 'reference', cooking: 'reference', travel: 'reference', art: 'reference',
};

const FORMAT_TO_ARCH = {
  tracker: 'tracker', journal: 'tracker', planner: 'tracker',
  dashboard: 'dashboard', analyzer: 'dashboard', coach: 'dashboard',
  reader: 'reference', explorer: 'reference', collector: 'reference',
  companion: 'feed',
};

function pickArchitecture(domain, format) {
  return DOMAIN_TO_ARCH[domain] || FORMAT_TO_ARCH[format] || pick(ARCHITECTURES);
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function slugify(s) { return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40); }

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_PATH)) return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  } catch {}
  return { slugs: [], domains: [], lastN: [] };
}

function saveHistory(hist) {
  const dir = path.dirname(HISTORY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  hist.slugs = hist.slugs.slice(-100);
  hist.domains = hist.domains.slice(-20);
  hist.lastN = hist.lastN.slice(-20);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(hist, null, 2));
}

function getDiverseDomain(history) {
  const recentDomains = new Set(history.domains.slice(-5));
  const available = DOMAINS.filter((d) => !recentDomains.has(d));
  return available.length > 0 ? pick(available) : pick(DOMAINS);
}

function getFeaturesForArch(arch) {
  const archFeatures = {
    feed: ['feed-view', 'compose', 'profile', 'settings'],
    dashboard: ['overview', 'add-entry', 'history', 'settings'],
    tracker: ['calendar', 'day-entry', 'stats', 'settings'],
    reference: ['browse', 'item-detail', 'bookmarks', 'settings'],
    generic: ['list-view', 'add-item', 'detail-view', 'settings'],
  };
  return archFeatures[arch] || archFeatures.generic;
}

function validateIdea(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (typeof obj.name !== 'string' || obj.name.length < 2) return null;
  if (typeof obj.domain !== 'string') return null;
  obj.slug = slugify(obj.slug || obj.name);
  obj.description = String(obj.description || `${obj.domain} app`);
  obj.twist = String(obj.twist || 'minimal');
  const arch = ARCHITECTURES.includes(obj.architecture) ? obj.architecture : pickArchitecture(obj.domain, '');
  obj.architecture = arch;
  obj.features = getFeaturesForArch(arch);
  return obj;
}

function generateFromTemplates(history) {
  const domain = getDiverseDomain(history);
  const format = pick(FORMATS);
  const twist = pick(TWISTS);
  const architecture = pickArchitecture(domain, format);
  const name = `${domain}-${format}`;
  const slug = slugify(name);
  if (history.slugs.includes(slug)) {
    return generateFromTemplates(history);
  }
  const description = `${domain} ${format} app with ${twist} focus`;
  const features = getFeaturesForArch(architecture);
  return { name, slug, description, features, domain, twist, architecture };
}

async function generateWithLLM(history) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return generateFromTemplates(history);

  const { chat } = require('./lib/llm');
  const recentNames = history.lastN.slice(-8).map((i) => i.name).join(', ');
  const avoidDomains = [...new Set(history.domains.slice(-5))].join(', ');

  const prompt = `You are a creative app product researcher. Generate a NOVEL iOS app idea that has NOT been built before.

HARD CONSTRAINTS:
- DO NOT repeat or closely resemble these recent ideas: ${recentNames || 'none yet'}
- AVOID these recently used domains: ${avoidDomains || 'none'}
- Combine two unrelated fields (e.g. "astronomy + cooking", "philosophy + fitness")
- The app must be buildable as a simple list/detail/form mobile app

Output ONLY valid JSON (no markdown, no extra text):
{"name":"string","slug":"kebab-case","description":"one compelling line","domain":"string","twist":"string","architecture":"string"}

ARCHITECTURE must be one of: feed, dashboard, tracker, reference, generic
- feed: social-feed style (posts, compose, profile)
- dashboard: metrics/charts (overview, log entry, history)
- tracker: calendar/habit (calendar, day entry, stats)
- reference: browse/search/bookmarks (browse, detail, bookmarks)
- generic: simple list/add/detail

DOMAIN should be a single word (e.g. crypto, fitness, cooking, astronomy, philosophy).
TWIST: one of minimal, dark-mode, offline-first, gamified, AI-assisted, voice-first, social-graph, privacy-centric, streak-based, community-driven.

Think step by step about what would be genuinely novel, then output ONLY the JSON.`;

  try {
    const raw = await chat([{ role: 'user', content: prompt }], { temperature: 1.0, max_tokens: 512 });
    const cleaned = raw.replace(/^```\w*\n?|\n?```$/g, '').trim();
    // Extract JSON even if model wraps in text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object found in response');
    const parsed = JSON.parse(jsonMatch[0]);
    const idea = validateIdea(parsed);
    if (!idea) throw new Error('Schema validation failed');
    if (history.slugs.includes(idea.slug)) {
      idea.slug = `${idea.slug}-${Date.now().toString(36).slice(-4)}`;
    }
    return idea;
  } catch (err) {
    console.error('LLM idea failed, falling back to template:', err.message);
    return generateFromTemplates(history);
  }
}

async function main() {
  const useLLM = process.argv.includes('--llm');
  const history = loadHistory();
  const idea = useLLM ? await generateWithLLM(history) : generateFromTemplates(history);

  // Track history for diversity
  history.slugs.push(idea.slug);
  history.domains.push(idea.domain);
  history.lastN.push({ name: idea.name, domain: idea.domain, ts: new Date().toISOString() });
  saveHistory(history);

  console.log(JSON.stringify(idea, null, 0));
}

main().catch(console.error);
