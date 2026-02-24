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

const MAX_STEPS = 20;
const MAX_FILE_SIZE = 15_000;

function buildSystemPrompt(appDir, idea) {
  const ideaInfo = idea
    ? `\nAPP: "${idea.name}" — ${idea.description}\nArchitecture: ${idea.architecture}, Domain: ${idea.domain}, Style: ${idea.twist}`
    : '';

  return `You are a senior React Native developer editing an Expo app.${ideaInfo}

App directory: ${appDir}

You have these tools. Use them by including the XML tags in your response:

<read_file>relative/path.js</read_file>
  Read a file. Path is relative to the app directory.

<write_file path="relative/path.js">
file contents here
</write_file>
  Write/overwrite a file. Include the COMPLETE file content.

<list_files>relative/dir</list_files>
  List files in a directory (or "." for root).

<search>pattern</search>
  Search all JS files for a string/pattern. Returns matching lines with file:line context.

<run_test></run_test>
  Run bundle compilation test. Use after making changes to verify they work.

<done>Brief summary of what you changed and why</done>
  Signal that you're finished. Always include a clear summary.

RULES:
- Read files BEFORE editing them. Understand the code first.
- When writing files, output the COMPLETE file. No partial patches or "... rest stays the same".
- After significant edits, run the test to verify nothing is broken.
- If a test fails, read the error, fix it, and test again.
- Keep the same code patterns: React functional components, StyleSheet.create, context hooks.
- Preserve all testID and accessibilityLabel attributes.
- If the user's request is unclear, make your best judgment and explain what you did.
- Use the existing color theme. Don't randomly change colors unless asked.
- Max ${MAX_STEPS} tool calls. Be efficient.
- When done, always use <done> tag.

CRITICAL: Use the tools IMMEDIATELY in your very first response. Do not describe plans. ACT.

EXAMPLE — if asked "make the header blue":

<list_files>src/screens</list_files>
<read_file>App.js</read_file>

Then after seeing the files:

<write_file path="App.js">
...complete updated file with blue header...
</write_file>
<run_test></run_test>

Then after test passes:

<done>Changed header background to blue in App.js</done>

START by listing files and reading the relevant ones. Every response MUST contain tool XML tags.`;
}

// ── Tool execution ───────────────────────────────────────────────────────────

function executeTools(response, appDir) {
  const results = [];

  // read_file
  const readMatches = response.matchAll(/<read_file>(.*?)<\/read_file>/gs);
  for (const m of readMatches) {
    const relPath = m[1].trim();
    const fullPath = path.join(appDir, relPath);
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
    const content = m[2];
    const fullPath = path.join(appDir, relPath);
    try {
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');
      results.push({ tool: 'write_file', path: relPath, result: `Written: ${relPath} (${content.length} chars)` });
    } catch (e) {
      results.push({ tool: 'write_file', path: relPath, result: `ERROR: ${e.message}` });
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

async function runCodeAgent({ appDir, task, model, idea, onProgress, maxSteps }) {
  const systemPrompt = buildSystemPrompt(appDir, idea);
  const steps = maxSteps || MAX_STEPS;
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: task },
  ];

  const filesChanged = new Set();
  let summary = '';

  for (let step = 0; step < steps; step++) {
    if (onProgress) onProgress(`Thinking... (step ${step + 1})`);

    let response;
    try {
      response = await chat(messages, {
        model: model || 'google/gemini-3-flash-preview',
        temperature: 0.4,
        max_tokens: 4000,
        timeout: 60_000,
      });
    } catch (e) {
      return { ok: false, error: `LLM error: ${e.message}`, filesChanged: [...filesChanged], summary: '' };
    }

    messages.push({ role: 'assistant', content: response });

    const toolResults = executeTools(response, appDir);

    if (toolResults.length === 0) {
      // LLM responded with text but no tool calls — nudge it to act
      if (step < steps - 1) {
        messages.push({
          role: 'user',
          content: 'Use the tools now. Start by reading the relevant files with <read_file>, then make your changes with <write_file>. Do not just describe what you would do — actually do it.',
        });
        continue;
      }
      summary = response.replace(/<[^>]+>/g, '').trim().slice(0, 500);
      break;
    }

    // Check for done
    const doneResult = toolResults.find(r => r.tool === 'done');
    if (doneResult) {
      summary = doneResult.result;
      break;
    }

    // Track written files
    for (const r of toolResults) {
      if (r.tool === 'write_file' && !r.result.startsWith('ERROR')) {
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

module.exports = { runCodeAgent };
