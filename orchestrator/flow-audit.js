#!/usr/bin/env node
/**
 * Flow Audit — static verifier for Maestro flows.
 *
 * Ensures that every `id:` referenced in `maestro/flows/*.yaml`
 * exists in the app source as either:
 * - `testID="..."` / `testID={'...'}`
 * - `tabBarButtonTestID: '...'` (bottom-tab button ids)
 *
 * Usage: node flow-audit.js <appDir>
 * Output: JSON summary to stdout. Exit 0 if ok, else 1.
 */

const fs = require('fs');
const path = require('path');

function readJsonIfExists(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function walkJsFiles(rootDir) {
  const out = [];
  const skip = new Set(['node_modules', '.expo', 'ios', 'android', '.git', 'maestro-reports', 'test-screenshots']);

  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name.startsWith('.') && ent.name !== '.eslintrc.cjs') continue;
      if (skip.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.endsWith('.js')) out.push(full);
    }
  }

  walk(rootDir);
  return out;
}

function collectKnownIds(appDir) {
  const exact = new Set();
  const globs = new Set();
  const files = [];

  const appJs = path.join(appDir, 'App.js');
  if (fs.existsSync(appJs)) files.push(appJs);

  const srcDir = path.join(appDir, 'src');
  if (fs.existsSync(srcDir)) files.push(...walkJsFiles(srcDir));

  const reTestId1 = /\btestID\s*=\s*["']([^"']+)["']/g;
  const reTestId2 = /\btestID\s*=\s*\{\s*["']([^"']+)["']\s*\}/g;
  const reTestIdTpl = /\btestID\s*=\s*\{\s*`([^`]+)`\s*\}/g;
  const reTabId = /\btabBarButtonTestID\s*:\s*["']([^"']+)["']/g;

  for (const fp of files) {
    let code = '';
    try { code = fs.readFileSync(fp, 'utf8'); } catch { continue; }

    for (const m of code.matchAll(reTestId1)) exact.add(m[1]);
    for (const m of code.matchAll(reTestId2)) exact.add(m[1]);
    for (const m of code.matchAll(reTabId)) exact.add(m[1]);
    for (const m of code.matchAll(reTestIdTpl)) {
      const tmpl = m[1];
      const glob = tmpl.replace(/\$\{[^}]+\}/g, '*');
      if (glob.includes('*')) globs.add(glob);
      else exact.add(glob);
    }
  }

  return { exact, globs: [...globs] };
}

function matchesKnownId(knownIds, id) {
  if (knownIds.exact.has(id)) return true;
  for (const g of knownIds.globs) {
    const re = new RegExp(`^${g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')}$`);
    if (re.test(id)) return true;
  }
  return false;
}

function parseFlow(flowText) {
  const ids = [];
  const tapsUsingText = [];
  const appId = flowText.match(/^appId:\s*(.+)\s*$/m)?.[1]?.trim() || null;

  // Collect all id: "foo"
  for (const m of flowText.matchAll(/^\s*id:\s*["']([^"']+)["']\s*$/gm)) {
    ids.push(m[1]);
  }

  // Flag any tapOn/assertVisible that uses text: (brittle under customization)
  // (We keep it allowed for cases like tapping a newly-created item by name.)
  for (const m of flowText.matchAll(/^\s*-\s*(tapOn|assertVisible):\s*$/gm)) {
    const startIdx = m.index + m[0].length;
    const block = flowText.slice(startIdx, startIdx + 240);
    const text = block.match(/^\s*text:\s*["']?(.+?)["']?\s*$/m)?.[1];
    const id = block.match(/^\s*id:\s*["'](.+?)["']\s*$/m)?.[1];
    if (text && !id) tapsUsingText.push({ step: m[1], text });
  }

  return { appId, ids, tapsUsingText };
}

function main() {
  const appDir = process.argv[2];
  if (!appDir || !fs.existsSync(appDir)) {
    console.error('Usage: flow-audit.js <appDir>');
    process.exit(1);
  }

  const flowsDir = path.join(appDir, 'maestro', 'flows');
  if (!fs.existsSync(flowsDir)) {
    const out = { ok: false, reason: 'no flows directory', flowsDir };
    console.log(JSON.stringify(out));
    process.exit(1);
  }

  const expectedAppId = readJsonIfExists(path.join(appDir, 'app.json'))?.expo?.ios?.bundleIdentifier || null;
  const knownIds = collectKnownIds(appDir);

  const missing = [];
  const warnings = [];
  const flowSummaries = [];

  const flowFiles = fs.readdirSync(flowsDir).filter((f) => f.endsWith('.yaml')).sort();
  for (const f of flowFiles) {
    const fp = path.join(flowsDir, f);
    const txt = fs.readFileSync(fp, 'utf8');
    const parsed = parseFlow(txt);

    if (expectedAppId && parsed.appId && parsed.appId !== expectedAppId) {
      warnings.push({ flow: f, type: 'appId-mismatch', expected: expectedAppId, got: parsed.appId });
    }

    for (const id of parsed.ids) {
      if (!matchesKnownId(knownIds, id)) missing.push({ flow: f, id });
    }

    for (const t of parsed.tapsUsingText) {
      warnings.push({ flow: f, type: 'brittle-text-step', step: t.step, text: t.text });
    }

    flowSummaries.push({ flow: f, ids: parsed.ids.length, textSteps: parsed.tapsUsingText.length });
  }

  const ok = missing.length === 0;
  const out = {
    ok,
    flowsDir,
    flows: flowSummaries,
    missing,
    warnings,
    knownIdCount: knownIds.size,
  };
  console.log(JSON.stringify(out));
  process.exit(ok ? 0 : 1);
}

main();

