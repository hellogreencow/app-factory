#!/usr/bin/env node
/**
 * Taste Agent — Reviews and refines the aesthetic quality of generated apps.
 *
 * Runs after code customization. Evaluates:
 *   - Copy quality: Do labels/placeholders feel human or template-y?
 *   - Color harmony: Does the palette feel intentional?
 *   - Empty states: What does the app look like with no data?
 *   - Seed data: Does it feel authentic or generated?
 *   - Overall feel: Would someone screenshot this? Does it spark anything?
 *
 * The taste agent reads the app code, critiques it, then makes targeted
 * edits to elevate the feel. It does NOT restructure — only refines.
 *
 * Usage: node taste-agent.js <appDir> <ideaJson>
 */

require('./lib/env').loadEnv();

const fs = require('fs');
const path = require('path');
const { chat } = require('./lib/llm');

const MODEL = process.env.TASTE_MODEL || 'google/gemini-3-flash-preview';

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  process.stdout.write(`[${ts}] [taste] ${msg}\n`);
}

function readAppFiles(appDir) {
  const files = {};

  const srcDir = path.join(appDir, 'src');
  if (!fs.existsSync(srcDir)) return files;

  for (const sub of ['context', 'screens']) {
    const dir = path.join(srcDir, sub);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
      const rel = `src/${sub}/${f}`;
      files[rel] = fs.readFileSync(path.join(dir, f), 'utf8');
    }
  }

  return files;
}

async function review(appDir, idea) {
  const files = readAppFiles(appDir);
  const fileList = Object.keys(files);

  if (fileList.length === 0) {
    log('No files to review');
    return { ok: false, reason: 'no files' };
  }

  const codeBlocks = Object.entries(files)
    .map(([name, code]) => `── ${name} ──\n${code}`)
    .join('\n\n');

  const prompt = `You are a design-obsessed creative director reviewing a mobile app. You have exacting taste.

APP: "${idea.name}" — ${idea.description}
Domain: ${idea.domain || 'general'}
Style intent: ${idea.twist || 'minimal'}

Here is the complete source code:

${codeBlocks}

Review this app and output ONLY a JSON object with targeted edits to elevate its feel.
Do not restructure, add dependencies, or change navigation. Only refine what exists.

Focus on:
1. COPY — Are labels, titles, placeholders, empty states human and evocative? Or generic/corporate?
2. SEED DATA — Does it feel like real entries from a real person? Or obviously fake?
3. COLOR NUANCE — Are there opportunities for subtle color variation (not just one accent everywhere)?
4. MICRO-MOMENTS — Button labels, confirmation text, section headers. Do they have personality?
5. EMPTY STATE — What message appears when there's no data? Make it inviting, not sterile.

Output format — a JSON object mapping file paths to an array of find/replace edits:
{
  "edits": {
    "src/screens/CalendarScreen.js": [
      { "find": "Add Entry", "replace": "Capture this moment" },
      { "find": "#f8f9fa", "replace": "#f0f0f5" }
    ],
    "src/context/TrackerContext.js": [
      { "find": "No note", "replace": "Just a quiet day" }
    ]
  },
  "rationale": "One sentence on the overall direction of these changes"
}

Rules:
- "find" must be an EXACT string that exists in the file. Not a regex, not approximate.
- Keep edits minimal and high-impact. 5-15 edits total, not 50.
- Do NOT change import statements, function names, hook names, or testID values.
- Do NOT change the MOODS array values or context field names.
- Do NOT change logic. Your edits must be limited to:
  - user-facing copy (JSX text nodes, string literals used for labels/placeholders/empty states)
  - hex colors (#RRGGBB)
  If your "find" contains "=" or "=>" or starts with "const/let/var/function/import/export", it will be rejected.
- Prefer edits that change the emotional register, not just the words.

Output ONLY the JSON. No markdown, no explanation outside the JSON.`;

  let result;
  try {
    const raw = await chat([{ role: 'user', content: prompt }], {
      model: MODEL,
      temperature: 0.8,
      max_tokens: 2000,
      timeout: 30_000,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    result = JSON.parse(jsonMatch[0]);
  } catch (e) {
    log(`Review failed: ${e.message}`);
    return { ok: false, reason: e.message };
  }

  return { ok: true, edits: result.edits || {}, rationale: result.rationale || '' };
}

async function applyEdits(appDir, edits) {
  let applied = 0;
  let skipped = 0;

  const dangerousFind = (find) => {
    if (!find) return true;
    if (/=>|=/.test(find)) return true;
    if (/\b(const|let|var|function|import|export|return)\b/.test(find)) return true;
    if (/\b(tabBarButtonTestID|Tab\.Screen|Stack\.Screen|NavigationContainer)\b/.test(find)) return true;
    if (/[{}\[\]();]/.test(find)) return true;
    if (/\b(true|false|null|undefined|NaN)\b/.test(find)) return true;
    return false;
  };

  const wouldCorruptCode = (code, find, replace) => {
    const idx = code.indexOf(find);
    if (idx === -1) return false;
    const before = code[idx - 1] || '';
    const after = code[idx + find.length] || '';
    const isInsideQuotes = (() => {
      let inSingle = false, inDouble = false, inBacktick = false;
      for (let i = 0; i < idx; i++) {
        if (code[i] === "'" && !inDouble && !inBacktick) inSingle = !inSingle;
        else if (code[i] === '"' && !inSingle && !inBacktick) inDouble = !inDouble;
        else if (code[i] === '`' && !inSingle && !inDouble) inBacktick = !inBacktick;
      }
      return inSingle || inDouble || inBacktick;
    })();
    if (!isInsideQuotes && /\w/.test(before)) return true;
    if (!isInsideQuotes && /\w/.test(after)) return true;
    if (replace.includes(' ') && !isInsideQuotes) return true;
    return false;
  };

  for (const [relPath, replacements] of Object.entries(edits)) {
    const fullPath = path.join(appDir, relPath);
    if (!fs.existsSync(fullPath)) {
      log(`Skip: ${relPath} not found`);
      skipped += replacements.length;
      continue;
    }

    let code = fs.readFileSync(fullPath, 'utf8');
    let fileChanged = false;

    for (const { find, replace } of replacements) {
      if (!find || !replace || find === replace) continue;
      if (dangerousFind(find)) {
        log(`Skip: unsafe edit in ${relPath}: "${find.slice(0, 60)}"`);
        skipped++;
        continue;
      }
      if (!code.includes(find)) {
        log(`Skip: "${find.slice(0, 40)}" not found in ${relPath}`);
        skipped++;
        continue;
      }
      if (wouldCorruptCode(code, find, replace)) {
        log(`Skip: would corrupt code in ${relPath}: "${find.slice(0, 40)}"`);
        skipped++;
        continue;
      }
      const safeReplace = replace
        .replace(/\u2018/g, "'").replace(/\u2019/g, "'")
        .replace(/\u201C/g, '"').replace(/\u201D/g, '"')
        .replace(/\u2014/g, '--').replace(/\u2013/g, '-')
        .replace(/\u2026/g, '...');
      code = code.replace(find, safeReplace);
      fileChanged = true;
      applied++;
      log(`Edit: ${relPath}: "${find.slice(0, 30)}" -> "${replace.slice(0, 30)}"`);
    }

    if (fileChanged) {
      fs.writeFileSync(fullPath, code, 'utf8');
    }
  }

  return { applied, skipped };
}

async function main() {
  const appDir = process.argv[2];
  const ideaRaw = process.argv[3];

  if (!appDir || !fs.existsSync(appDir)) {
    console.error('Usage: taste-agent.js <appDir> <ideaJson>');
    process.exit(1);
  }

  let idea;
  try {
    idea = JSON.parse(ideaRaw);
  } catch {
    const featuresPath = path.join(appDir, 'features.json');
    if (fs.existsSync(featuresPath)) {
      idea = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));
    } else {
      console.error('Need idea JSON as arg or features.json in app dir');
      process.exit(1);
    }
  }

  const t = Date.now();
  log(`Reviewing ${idea.name}...`);

  const reviewResult = await review(appDir, idea);
  if (!reviewResult.ok) {
    log(`Review failed: ${reviewResult.reason}`);
    console.log(JSON.stringify({ ok: false, reason: reviewResult.reason }));
    process.exit(1);
  }

  log(`Rationale: ${reviewResult.rationale}`);

  const { applied, skipped } = await applyEdits(appDir, reviewResult.edits);
  const dur = ((Date.now() - t) / 1000).toFixed(1);

  log(`Done in ${dur}s: ${applied} edits applied, ${skipped} skipped`);
  console.log(JSON.stringify({ ok: true, applied, skipped, rationale: reviewResult.rationale, duration: dur }));
}

if (require.main === module) {
  main().catch(e => {
    log(`Fatal: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { review, applyEdits };
