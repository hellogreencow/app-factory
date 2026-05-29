#!/usr/bin/env node
/**
 * Code Agent — AI-powered iterative code editor for generated apps.
 *
 * Works like a lightweight Claude Code / Aider scoped to one app directory.
 * The LLM gets tools (read, write, list, search, test) and iterates
 * until the task is done or max steps reached.
 *
 * Usage:
 *   const { runCodeAgent } = require('./code-agent');
 *   const result = await runCodeAgent({
 *     appDir: '/path/to/apps/rewind',
 *     task: 'Add dark mode toggle to settings',
 *     model: 'google/gemini-3-flash-preview',
 *     onProgress: (msg) => sendToTelegram(chatId, msg),
 *   });
 *
 * Tool format in LLM output:
 *   <read_file>src/screens/CalendarScreen.js</read_file>
 *   <write_file path="src/screens/CalendarScreen.js">...code...</write_file>
 *   <list_files>src/screens</list_files>
 *   <search>backgroundColor</search>
 *   <run_test></run_test>
 *   <done>summary of changes</done>
 */

require('./lib/env').loadEnv();

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chat } = require('./lib/llm');
const { TOKEN_BUDGETS } = require('./lib/models');

const MAX_STEPS = 20;
const MAX_FILE_SIZE = 15_000;

function buildSystemPrompt(appDir, idea) {
  const ideaInfo = idea
    ? `\nAPP: "${idea.name}" — ${idea.description}\nArchitecture: ${idea.architecture}, Domain: ${idea.domain}, Style: ${idea.twist}`
    : '';

  return `You are a senior React Native developer editing an Expo app.${ideaInfo}

App directory: ${appDir}

TOOLS — include XML tags in your response to use them:

<read_file>relative/path.js</read_file>
  Read a file (relative to app directory).

<write_file path="relative/path.js">
complete file contents
</write_file>
  Write/overwrite a file. MUST contain the complete file.

<search_replace path="relative/path.js">
<<<
exact lines to find
===
replacement lines
>>>
</search_replace>
  Replace exact text in a file. Use for small, targeted edits instead of rewriting the whole file.

<list_files>relative/dir</list_files>
  List files in a directory (or "." for root).

<search>pattern</search>
  Search JS/JSON files for a pattern. Returns file:line:content matches.

<run_test></run_test>
  Run bundle compilation test. Use after edits to verify correctness.

<done>Brief summary of changes</done>
  Signal completion.

RULES:
1. Read files BEFORE editing. Understand the existing code first.
2. Prefer <search_replace> for targeted edits. Use <write_file> only for new files or large rewrites.
3. After edits, run <run_test>. If it fails, read the error, fix, and retest.
4. Keep existing patterns: functional components, StyleSheet.create, context hooks.
5. Preserve all testID and accessibilityLabel attributes.
6. Use the existing color theme unless asked to change it.
7. Max ${MAX_STEPS} tool calls. Be efficient.
8. EVERY response MUST include tool tags. No plain-text-only responses.
9. You MUST write code. Reading and saying "done" without edits = FAILURE.

EXAMPLE:
User: Change the header color to blue
Assistant:
<read_file>src/screens/HomeScreen.js</read_file>

[after reading the file]

<search_replace path="src/screens/HomeScreen.js">
<<<
    headerColor: '#FF5733',
===
    headerColor: '#3B82F6',
>>>
</search_replace>

<run_test></run_test>

[after test passes]

<done>Changed header color from orange (#FF5733) to blue (#3B82F6) in HomeScreen.</done>

WORKFLOW:
1. <list_files>.</list_files> + <read_file> relevant files
2. <search_replace> or <write_file> to implement changes
3. <run_test></run_test>
4. Fix if needed, then <done>summary</done>

START by reading files. Then make your changes.`;
}

// ── Tool execution ───────────────────────────────────────────────────────────

function sanitizeSmartQuotes(text) {
  return text
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'")
    .replace(/\u201C/g, '"').replace(/\u201D/g, '"')
    .replace(/\u2014/g, '--').replace(/\u2013/g, '-')
    .replace(/\u2026/g, '...');
}

function safePath(appDir, relPath) {
  const resolved = path.resolve(appDir, relPath);
  if (!resolved.startsWith(path.resolve(appDir) + path.sep) && resolved !== path.resolve(appDir)) {
    return null;
  }
  return resolved;
}

function executeTools(response, appDir) {
  const results = [];

  // read_file
  const readMatches = response.matchAll(/<read_file>(.*?)<\/read_file>/gs);
  for (const m of readMatches) {
    const relPath = m[1].trim();
    const fullPath = safePath(appDir, relPath);
    if (!fullPath) { results.push({ tool: 'read_file', path: relPath, result: 'ERROR: Path outside app directory' }); continue; }
    try {
      if (!fs.existsSync(fullPath)) {
        results.push({ tool: 'read_file', path: relPath, result: `ERROR: File not found: ${relPath}` });
      } else {
        let content = fs.readFileSync(fullPath, 'utf8');
        if (content.length > MAX_FILE_SIZE) {
          content = content.slice(0, MAX_FILE_SIZE) + '\n... (truncated)';
        }
        results.push({ tool: 'read_file', path: relPath, result: content });
      }
    } catch (e) {
      results.push({ tool: 'read_file', path: relPath, result: `ERROR: ${e.message}` });
    }
  }

  // write_file
  const writeMatches = response.matchAll(/<write_file\s+path="([^"]+)">([\s\S]*?)<\/write_file>/g);
  for (const m of writeMatches) {
    const relPath = m[1].trim();
    const fullPath = safePath(appDir, relPath);
    if (!fullPath) { results.push({ tool: 'write_file', path: relPath, result: 'ERROR: Path outside app directory' }); continue; }
    const content = sanitizeSmartQuotes(m[2]);
    try {
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');
      results.push({ tool: 'write_file', path: relPath, result: `Written: ${relPath} (${content.length} chars)` });
    } catch (e) {
      results.push({ tool: 'write_file', path: relPath, result: `ERROR: ${e.message}` });
    }
  }

  // search_replace
  const srMatches = response.matchAll(/<search_replace\s+path="([^"]+)">\s*<<<\n?([\s\S]*?)\n?===\n?([\s\S]*?)\n?>>>\s*<\/search_replace>/g);
  for (const m of srMatches) {
    const relPath = m[1].trim();
    const fullPath = safePath(appDir, relPath);
    if (!fullPath) { results.push({ tool: 'search_replace', path: relPath, result: 'ERROR: Path outside app directory' }); continue; }
    const find = m[2];
    const replace = sanitizeSmartQuotes(m[3]);
    try {
      if (!fs.existsSync(fullPath)) {
        results.push({ tool: 'search_replace', path: relPath, result: `ERROR: File not found: ${relPath}` });
        continue;
      }
      const original = fs.readFileSync(fullPath, 'utf8');
      if (!original.includes(find)) {
        results.push({ tool: 'search_replace', path: relPath, result: `ERROR: Search text not found in ${relPath}. Read the file first to get exact content.` });
        continue;
      }
      const updated = original.replace(find, replace);
      fs.writeFileSync(fullPath, updated, 'utf8');
      results.push({ tool: 'search_replace', path: relPath, result: `Replaced in ${relPath} (${find.split('\n').length} lines changed)` });
    } catch (e) {
      results.push({ tool: 'search_replace', path: relPath, result: `ERROR: ${e.message}` });
    }
  }

  // list_files
  const listMatches = response.matchAll(/<list_files>(.*?)<\/list_files>/gs);
  for (const m of listMatches) {
    const relDir = m[1].trim() || '.';
    const fullDir = path.join(appDir, relDir);
    try {
      if (!fs.existsSync(fullDir)) {
        results.push({ tool: 'list_files', path: relDir, result: `ERROR: Directory not found: ${relDir}` });
      } else {
        const entries = listRecursive(fullDir, appDir, 3);
        results.push({ tool: 'list_files', path: relDir, result: entries.join('\n') });
      }
    } catch (e) {
      results.push({ tool: 'list_files', path: relDir, result: `ERROR: ${e.message}` });
    }
  }

  // search
  const searchMatches = response.matchAll(/<search>(.*?)<\/search>/gs);
  for (const m of searchMatches) {
    const pattern = m[1].trim();
    try {
      const matches = searchFiles(appDir, pattern);
      results.push({ tool: 'search', pattern, result: matches.length ? matches.join('\n') : 'No matches found.' });
    } catch (e) {
      results.push({ tool: 'search', pattern, result: `ERROR: ${e.message}` });
    }
  }

  // run_test
  const testMatches = response.matchAll(/<run_test><\/run_test>|<run_test\/>/g);
  for (const _m of testMatches) {
    try {
      execSync(`npx expo export --output-dir .agent-test-dist --no-minify`, {
        cwd: appDir,
        timeout: 60_000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      try { fs.rmSync(path.join(appDir, '.agent-test-dist'), { recursive: true, force: true }); } catch {}
      results.push({ tool: 'run_test', result: 'PASSED: Bundle compiles successfully.' });
    } catch (e) {
      try { fs.rmSync(path.join(appDir, '.agent-test-dist'), { recursive: true, force: true }); } catch {}
      const errOutput = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
      const errLines = errOutput.split('\n')
        .filter(l => /error|Error|Cannot find|Module not found|SyntaxError/i.test(l))
        .slice(0, 8)
        .join('\n');
      results.push({ tool: 'run_test', result: `FAILED:\n${errLines || 'Unknown error'}` });
    }
  }

  // done
  const doneMatch = response.match(/<done>([\s\S]*?)<\/done>/);
  if (doneMatch) {
    results.push({ tool: 'done', result: doneMatch[1].trim() });
  }

  return results;
}

function listRecursive(dir, appDir, maxDepth, depth = 0) {
  if (depth >= maxDepth) return [];
  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.expo' || entry.name.startsWith('.')) continue;
    const rel = path.relative(appDir, path.join(dir, entry.name));
    if (entry.isDirectory()) {
      entries.push(`${rel}/`);
      entries.push(...listRecursive(path.join(dir, entry.name), appDir, maxDepth, depth + 1));
    } else {
      entries.push(rel);
    }
  }
  return entries;
}

function searchFiles(appDir, pattern) {
  const results = [];
  const re = new RegExp(pattern, 'i');

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.js') || entry.name.endsWith('.json')) {
        try {
          const lines = fs.readFileSync(full, 'utf8').split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (re.test(lines[i])) {
              const rel = path.relative(appDir, full);
              results.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
              if (results.length > 50) return;
            }
          }
        } catch {}
      }
    }
  }

  walk(appDir);
  return results.slice(0, 50);
}

// ── Agent loop ───────────────────────────────────────────────────────────────

function pruneContext(messages, maxChars) {
  let total = 0;
  for (const m of messages) total += m.content.length;
  if (total <= maxChars) return;

  for (let i = 1; i < messages.length - 4; i++) {
    if (messages[i].role === 'user' && messages[i].content.length > 2000 && messages[i].content.includes('[File:')) {
      const lines = messages[i].content.split('\n');
      if (lines.length > 20) {
        messages[i].content = lines.slice(0, 5).join('\n') + '\n... (pruned for context) ...\n' + lines.slice(-5).join('\n');
      }
      total = 0;
      for (const m of messages) total += m.content.length;
      if (total <= maxChars) return;
    }
  }
}

function takeSnapshot(appDir) {
  const snapshot = new Map();
  const srcDir = path.join(appDir, 'src');
  const appJs = path.join(appDir, 'App.js');
  function capture(dir) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) capture(full);
        else if (entry.name.endsWith('.js') || entry.name.endsWith('.json')) {
          try { snapshot.set(path.relative(appDir, full), fs.readFileSync(full, 'utf8')); } catch (e) { /* skip */ }
        }
      }
    } catch (e) { /* skip */ }
  }
  if (fs.existsSync(srcDir)) capture(srcDir);
  if (fs.existsSync(appJs)) snapshot.set('App.js', fs.readFileSync(appJs, 'utf8'));
  return snapshot;
}

function restoreSnapshot(appDir, snapshot) {
  for (const [relPath, content] of snapshot) {
    const full = path.join(appDir, relPath);
    try {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
    } catch (e) { process.stderr.write(`[code-agent] Restore failed: ${relPath}: ${e.message}\n`); }
  }
}

async function runCodeAgent({ appDir, task, model, idea, onProgress, onTool, maxSteps }) {
  const systemPrompt = buildSystemPrompt(appDir, idea);
  const steps = maxSteps || MAX_STEPS;
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: task },
  ];

  const snapshot = takeSnapshot(appDir);
  const filesChanged = new Set();
  let summary = '';

  for (let step = 0; step < steps; step++) {
    if (onProgress) onProgress(`Thinking... (step ${step + 1})`);

    let response;
    try {
      response = await chat(messages, {
        model: model || 'google/gemini-2.0-flash-001',
        temperature: 0.5,
        max_tokens: TOKEN_BUDGETS.repair,
        timeout: 180_000,
      });
    } catch (e) {
      return { ok: false, error: `LLM error: ${e.message}`, filesChanged: [...filesChanged], summary: '' };
    }

    messages.push({ role: 'assistant', content: response });
    pruneContext(messages, 120_000);

    const toolStartedAt = Date.now();
    const toolResults = executeTools(response, appDir);
    const toolDurationMs = Date.now() - toolStartedAt;
    if (onTool) {
      for (const r of toolResults) {
        onTool({
          step: step + 1,
          tool: r.tool,
          path: r.path || null,
          pattern: r.pattern || null,
          ok: !String(r.result || '').startsWith('ERROR') && !String(r.result || '').startsWith('FAILED'),
          result: String(r.result || '').slice(0, 500),
          durationMs: toolDurationMs,
        });
      }
    }

    if (toolResults.length === 0) {
      // LLM responded with text but no tool calls — nudge it to act
      if (step < steps - 1) {
        messages.push({
          role: 'user',
          content: 'Use the tools now. Start by reading the relevant files with <read_file>, then make changes with <search_replace> or <write_file>. Do not describe plans — act.',
        });
        continue;
      }
      summary = response.replace(/<[^>]+>/g, '').trim().slice(0, 500);
      break;
    }

    // Check for done
    const doneResult = toolResults.find(r => r.tool === 'done');
    if (doneResult) {
      if (filesChanged.size === 0 && step < steps - 2) {
        messages.push({
          role: 'user',
          content: 'You said done but changed no files. The task requires code edits. Use <read_file> then <search_replace> or <write_file> to implement. Act now.',
        });
        continue;
      }
      summary = doneResult.result;
      break;
    }

    for (const r of toolResults) {
      if ((r.tool === 'write_file' || r.tool === 'search_replace') && !r.result.startsWith('ERROR')) {
        filesChanged.add(r.path);
      }
    }

    // Report progress for writes and test results
    for (const r of toolResults) {
      if (r.tool === 'write_file' && onProgress) {
        onProgress(`Edited: \`${r.path}\``);
      }
      if (r.tool === 'run_test' && onProgress) {
        onProgress(r.result.startsWith('PASSED') ? 'Test passed.' : 'Test failed, fixing...');
      }
    }

    // Feed tool results back to LLM
    const toolFeedback = toolResults.map(r => {
      if (r.tool === 'read_file') return `[File: ${r.path}]\n${r.result}`;
      if (r.tool === 'write_file') return r.result;
      if (r.tool === 'search_replace') return r.result;
      if (r.tool === 'list_files') return `[Files in ${r.path}]\n${r.result}`;
      if (r.tool === 'search') return `[Search: ${r.pattern}]\n${r.result}`;
      if (r.tool === 'run_test') return `[Test result]\n${r.result}`;
      return r.result;
    }).join('\n\n');

    messages.push({ role: 'user', content: toolFeedback });
  }

  return {
    ok: true,
    filesChanged: [...filesChanged],
    summary: summary || 'Changes applied.',
    steps: messages.length,
  };
}

// ── CLI mode ─────────────────────────────────────────────────────────────────

if (require.main === module) {
  const appDir = process.argv[2];
  const task = process.argv.slice(3).join(' ');

  if (!appDir || !task) {
    console.error('Usage: code-agent.js <appDir> <task description>');
    process.exit(1);
  }

  let idea = null;
  const featuresPath = path.join(appDir, 'features.json');
  if (fs.existsSync(featuresPath)) {
    try { idea = JSON.parse(fs.readFileSync(featuresPath, 'utf8')); } catch {}
  }

  runCodeAgent({
    appDir,
    task,
    idea,
    model: process.env.CODE_AGENT_MODEL || 'google/gemini-2.0-flash-001',
    onProgress: (msg) => console.log(`  >> ${msg}`),
  }).then(result => {
    console.log('\n--- Result ---');
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }).catch(e => {
    console.error(`Fatal: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { runCodeAgent, takeSnapshot, restoreSnapshot };
