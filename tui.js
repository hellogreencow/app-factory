#!/usr/bin/env node
/**
 * iOS App Factory — Terminal UI
 * Pure Node.js, no deps. Live animated view of the factory pipeline.
 * Usage:
 *   node tui.js              # watch mode (reads benchmark/runs.json live)
 *   node tui.js --run        # watch + start factory in background
 *   node tui.js --run --llm  # watch + start factory with LLM ideas
 *   node tui.js --run --full # watch + full pipeline (lint + e2e + deploy)
 *   q / Ctrl-C to quit
 */

const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');

// --setup flag: hand off to wizard immediately, before any TUI init
if (process.argv.includes('--setup')) {
  const ROOT_EARLY = path.join(__dirname);
  const p = spawn('node', [path.join(ROOT_EARLY, 'scripts', 'setup.js')], { stdio: 'inherit', cwd: ROOT_EARLY });
  p.on('close', c => process.exit(c || 0));
  // Prevent rest of file from executing
  throw 0;
}

const ROOT = path.join(__dirname);
const BENCH_PATH = path.join(ROOT, 'benchmark', 'runs.json');

// ─── ANSI ─────────────────────────────────────────────────────────────────────
const ESC = '\x1b[';
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlack: '\x1b[40m',
  bgBlue: '\x1b[44m',
  bgCyan: '\x1b[46m',
  bgMagenta: '\x1b[45m',
  gray: '\x1b[90m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
};

const clearScreen = () => process.stdout.write('\x1b[2J\x1b[H');
const moveTo = (r, c) => process.stdout.write(`${ESC}${r};${c}H`);
const hideCursor = () => process.stdout.write('\x1b[?25l');
const showCursor = () => process.stdout.write('\x1b[?25h');
const write = (s) => process.stdout.write(s);
const writeln = (s = '') => process.stdout.write(s + '\n');

// ─── SPINNER ──────────────────────────────────────────────────────────────────
const SPINNERS = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  bar:  ['▰▱▱▱▱▱▱', '▰▰▱▱▱▱▱', '▰▰▰▱▱▱▱', '▰▰▰▰▱▱▱', '▰▰▰▰▰▱▱', '▰▰▰▰▰▰▱', '▰▰▰▰▰▰▰'],
  bounce: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
};
let spinFrame = 0;

// ─── STATE ────────────────────────────────────────────────────────────────────
let runs = [];
let factoryProc = null;
let factoryRunning = false;
let factoryArgs = [];
let factoryLog = [];
let tick = 0;
let cols = process.stdout.columns || 120;
let rows = process.stdout.rows || 40;

const STAGES = ['idea', 'scaffold', 'feature', 'flow', 'lint', 'review', 'e2e', 'deploy'];
const STAGE_ICONS = {
  idea: '💡', scaffold: '🔨', feature: '⚙️ ', flow: '🔀', lint: '🔍', review: '🛡', e2e: '🧪', deploy: '🚀',
};
const STAGE_SHORT = {
  idea: 'Idea', scaffold: 'Scaffold', feature: 'Feature', flow: 'Flow', lint: 'Lint', review: 'Review', e2e: 'E2E', deploy: 'Deploy',
};

// ─── DATA ─────────────────────────────────────────────────────────────────────
function loadRuns() {
  try {
    if (!fs.existsSync(BENCH_PATH)) return [];
    return JSON.parse(fs.readFileSync(BENCH_PATH, 'utf8')) || [];
  } catch { return []; }
}

function lastN(n) { return runs.slice(-n); }

function stageColor(stage, data) {
  if (!data) return C.gray;
  if (!data.ok) return C.red;
  if (stage === 'deploy') return C.brightGreen;
  return C.green;
}

function stageChar(stage, data) {
  if (!data) return '·';
  if (!data.ok && data.error === 'skipped') return C.gray + '─' + C.reset;
  if (!data.ok) return C.red + '✗' + C.reset;
  return C.green + '✓' + C.reset;
}

// ─── AUDIT RESULTS ────────────────────────────────────────────────────────────
const AUDIT = {
  issues: [
    { sev: 'CRITICAL', file: 'orchestrator/benchmark.js:37',    msg: 'Operator precedence bug: `stage === \'deploy\' || stage === \'e2e\' && !ok` — `&&` binds tighter, run never marks completed correctly. Fix: wrap in parens.' },
    { sev: 'CRITICAL', file: 'orchestrator/benchmark.js:36',    msg: '`ok === \'ok\'` compares string to string, fine. But `durationMs` is not validated — NaN if caller passes bad value.' },
    { sev: 'CRITICAL', file: 'scripts/scaffold-minimal.sh:22',  msg: 'package.json hardcodes name "crypto-portfolio" regardless of THEME arg. All scaffolded apps get wrong name in package.json.' },
    { sev: 'HIGH',     file: 'orchestrator/run-loop.js:spawnSync', msg: 'All child processes use spawnSync — blocks the event loop entirely. One slow build blocks everything. Use async spawn + stream for live log output.' },
    { sev: 'HIGH',     file: 'orchestrator/fix-agent.js:60',    msg: 'If no flowName matched, falls back to patching files[0] blindly — may patch unrelated flow with wrong fix.' },
    { sev: 'HIGH',     file: 'orchestrator/flow-generator.js',  msg: 'detail-view flow taps `id: "item-1"` which is hardcoded item ID. If seed data changes or list is empty, flow always fails.' },
    { sev: 'HIGH',     file: 'orchestrator/e2e-report.js',      msg: 'JUnit parser splits on <testcase — fails if attributes span multiple lines or XML is minified differently.' },
    { sev: 'HIGH',     file: 'orchestrator/lib/llm.js',         msg: 'FALLBACK_FREE_MODEL variable declared but no longer used after audit fix. Dead code.' },
    { sev: 'MEDIUM',   file: 'scripts/run-factory.sh',          msg: '`source .env` in bash exports secrets into child process envs, including npm scripts and any subshells. Use dotenv or explicit exports only.' },
    { sev: 'MEDIUM',   file: 'orchestrator/run-loop.js',        msg: 'No timeout guard on `spawnSync("sleep", ["30"])` — if process hangs before sleep, loop stalls silently.' },
    { sev: 'MEDIUM',   file: 'orchestrator/benchmark.js',       msg: 'Error field stores full npm stderr (~3KB per run) — benchmark/runs.json will grow unbounded and become slow to parse.' },
    { sev: 'MEDIUM',   file: 'orchestrator/idea-agent.js',      msg: 'LLM response not validated against schema — if model returns malformed JSON, JSON.parse throws and fallback triggers silently, hiding the error.' },
    { sev: 'MEDIUM',   file: 'scripts/e2e-test.sh',             msg: '`set -e` + `node -e ...` inline js for appId — if node fails, script exits without clear error message.' },
    { sev: 'LOW',      file: 'scripts/lint.sh',                 msg: 'ESLint installed per-app with `npm install --save-dev` — slow and adds dev deps to app packages. Should be at factory root.' },
    { sev: 'LOW',      file: 'orchestrator/run-loop.js',        msg: 'Benchmark report at end calls `run(node benchmark.js report)` but output is not printed (only written to stdout of spawnSync which is discarded).' },
    { sev: 'LOW',      file: 'orchestrator/template-copy.js',   msg: 'DEPS const declared but never used — dead code.' },
    { sev: 'LOW',      file: 'scripts/scaffold-minimal.sh',     msg: 'App.js title hardcoded to "Crypto Portfolio" regardless of theme. Generic apps show wrong title until feature agent overwrites.' },
    { sev: 'LOW',      file: 'orchestrator/run-loop.js',        msg: 'No uniqueness check — same slug can be generated twice if LLM/template produces same name, causing scaffold to exit 1 (dir exists).' },
  ],
};

// ─── RENDER ───────────────────────────────────────────────────────────────────
function pad(s, n, right = false) {
  const str = String(s);
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, '');
  const pad = Math.max(0, n - stripped.length);
  return right ? ' '.repeat(pad) + str : str + ' '.repeat(pad);
}

function bar(filled, total, width = 20) {
  const f = Math.round((filled / Math.max(total, 1)) * width);
  return C.brightGreen + '█'.repeat(f) + C.gray + '░'.repeat(width - f) + C.reset;
}

function formatMs(ms) {
  if (!ms || ms === 0) return C.gray + '  –' + C.reset;
  if (ms < 1000) return C.yellow + ms + 'ms' + C.reset;
  return C.cyan + (ms / 1000).toFixed(1) + 's' + C.reset;
}

function sevColor(sev) {
  if (sev === 'CRITICAL') return C.bold + C.red;
  if (sev === 'HIGH')     return C.red;
  if (sev === 'MEDIUM')   return C.yellow;
  return C.gray;
}

// ─── SECTIONS ─────────────────────────────────────────────────────────────────

function renderHeader() {
  const spin = C.brightCyan + SPINNERS.dots[spinFrame % SPINNERS.dots.length] + C.reset;
  const title = `${C.bold}${C.brightMagenta}  ◆ iOS App Factory${C.reset}`;
  const status = factoryRunning
    ? `${spin} ${C.brightGreen}RUNNING${C.reset}  ${C.gray}${factoryArgs.join(' ')}${C.reset}`
    : `${C.gray}IDLE — press ${C.brightWhite}r${C.reset}${C.gray} to run${C.reset}`;
  const time = C.gray + new Date().toLocaleTimeString() + C.reset;
  const w = cols;

  writeln(`${C.bgBlack}${C.brightCyan}${'─'.repeat(w)}${C.reset}`);
  writeln(`${title}   ${status}${' '.repeat(Math.max(0, w - 60))}${time}`);
  writeln(`${C.gray}${'─'.repeat(w)}${C.reset}`);
}

function renderPipeline(run) {
  if (!run) { writeln(`  ${C.gray}No runs yet. Press ${C.brightWhite}r${C.reset}${C.gray} to start.${C.reset}`); return; }

  const anim = SPINNERS.bounce[tick % SPINNERS.bounce.length];
  const activeStage = STAGES.find((s) => !run.stages?.[s]);
  const isDone = run.completed_at || !activeStage;

  writeln(`  ${C.bold}${C.brightWhite}${run.slug}${C.reset}  ${C.gray}started ${new Date(run.started_at).toLocaleTimeString()}${C.reset}`);

  // Stage pipeline bar
  write('  ');
  for (let i = 0; i < STAGES.length; i++) {
    const s = STAGES[i];
    const data = run.stages?.[s];
    const isActive = s === activeStage && factoryRunning;

    if (data?.ok) {
      write(`${C.brightGreen}${STAGE_SHORT[s]}${C.reset}`);
    } else if (data && !data.ok && data.error !== 'skipped') {
      write(`${C.red}${STAGE_SHORT[s]}${C.reset}`);
    } else if (isActive) {
      write(`${C.brightYellow}${C.bold}${anim} ${STAGE_SHORT[s]}${C.reset}`);
    } else {
      write(`${C.gray}${STAGE_SHORT[s]}${C.reset}`);
    }

    if (i < STAGES.length - 1) write(`${C.gray} → ${C.reset}`);
  }
  writeln();

  // Timing row
  write('  ');
  for (let i = 0; i < STAGES.length; i++) {
    const s = STAGES[i];
    const data = run.stages?.[s];
    const label = data ? formatMs(data.duration_ms) : C.gray + '    ' + C.reset;
    write(pad(label, STAGE_SHORT[s].length + 4));
    if (i < STAGES.length - 1) write('    ');
  }
  writeln();
}

function renderAllRuns() {
  const recent = lastN(6);
  if (!recent.length) { writeln(`  ${C.gray}No runs yet.${C.reset}`); return; }

  writeln(`  ${C.bold}${C.white}All Runs${C.reset}  ${C.gray}(${runs.length} total)${C.reset}`);
  const header = `  ${pad(C.gray + 'App', 26)}${STAGES.map((s) => pad(STAGE_SHORT[s], 10)).join('')}${C.reset}`;
  writeln(header);
  writeln(`  ${C.gray}${'─'.repeat(cols - 4)}${C.reset}`);

  for (const run of recent.reverse()) {
    const name = pad(C.brightWhite + run.slug + C.reset, 30);
    const stages = STAGES.map((s) => {
      const d = run.stages?.[s];
      if (!d) return pad(C.gray + '·' + C.reset, 10);
      if (d.error === 'skipped') return pad(C.gray + '─' + C.reset, 10);
      return pad((d.ok ? C.green + '✓ ' : C.red + '✗ ') + C.reset + formatMs(d.duration_ms), 10);
    }).join('');
    writeln(`  ${name}${stages}`);
  }
}

function renderStats() {
  const total = runs.length;
  const scaffoldOk = runs.filter((r) => r.stages?.scaffold?.ok).length;
  const featureOk = runs.filter((r) => r.stages?.feature?.ok).length;
  const e2eOk = runs.filter((r) => r.stages?.e2e?.ok).length;
  const deployOk = runs.filter((r) => r.stages?.deploy?.ok).length;
  const avgScaffold = total ? Math.round(runs.reduce((a, r) => a + (r.stages?.scaffold?.duration_ms || 0), 0) / total) : 0;

  writeln(`  ${C.bold}${C.white}Stats${C.reset}`);
  writeln(`  Total runs:  ${C.brightWhite}${total}${C.reset}    Scaffold: ${bar(scaffoldOk, total)} ${scaffoldOk}/${total}`);
  writeln(`  Feature:     ${bar(featureOk, total)} ${featureOk}/${total}    E2E: ${bar(e2eOk, total)} ${e2eOk}/${total}    Deploy: ${bar(deployOk, total)} ${deployOk}/${total}`);
  writeln(`  Avg scaffold time: ${formatMs(avgScaffold)}    Apps generated: ${C.brightGreen}${total}${C.reset}`);
}

function renderLog() {
  const lines = factoryLog.slice(-6);
  writeln(`  ${C.bold}${C.white}Live Output${C.reset}`);
  if (!lines.length) { writeln(`  ${C.gray}(no output yet)${C.reset}`); return; }
  for (const line of lines) {
    const stripped = line.replace(/\n/g, '').slice(0, cols - 4);
    if (!stripped.trim()) continue;
    // Colorize key patterns
    const colored = stripped
      .replace(/(✓)/g, C.green + '$1' + C.reset)
      .replace(/(✗)/g, C.red + '$1' + C.reset)
      .replace(/(ok)/g, C.green + '$1' + C.reset)
      .replace(/(fail|failed|error)/gi, C.red + '$1' + C.reset)
      .replace(/(\[.+?\])/g, C.gray + '$1' + C.reset)
      .replace(/(Idea:|Scaffold:|Flows:|Lint:|E2E:|Deploy:)/g, C.brightCyan + '$1' + C.reset);
    writeln(`  ${C.dim}▸${C.reset} ${colored}`);
  }
}

function renderAudit() {
  const crit = AUDIT.issues.filter((i) => i.sev === 'CRITICAL').length;
  const high = AUDIT.issues.filter((i) => i.sev === 'HIGH').length;
  const med = AUDIT.issues.filter((i) => i.sev === 'MEDIUM').length;
  const low = AUDIT.issues.filter((i) => i.sev === 'LOW').length;

  writeln(`  ${C.bold}${C.white}System Audit${C.reset}  ` +
    `${C.red}${C.bold}${crit} CRITICAL${C.reset}  ` +
    `${C.red}${high} HIGH${C.reset}  ` +
    `${C.yellow}${med} MEDIUM${C.reset}  ` +
    `${C.gray}${low} LOW${C.reset}`);

  const toShow = AUDIT.issues.slice(auditScroll, auditScroll + auditVisible);
  for (const issue of toShow) {
    const sevStr = pad(sevColor(issue.sev) + issue.sev + C.reset, 16);
    const file = C.gray + issue.file.slice(0, 40) + C.reset;
    writeln(`  ${sevStr} ${file}`);
    const msg = issue.msg.slice(0, cols - 6);
    writeln(`         ${C.dim}${msg}${C.reset}`);
  }
  if (AUDIT.issues.length > auditVisible) {
    writeln(`  ${C.gray}  ↑/↓ to scroll · ${AUDIT.issues.length - auditVisible} more${C.reset}`);
  }
}

function renderSetupBanner() {
  const setupPath = path.join(ROOT, '.setup-complete.json');
  if (fs.existsSync(setupPath)) return;
  writeln(`  ${C.bold}${C.yellow}⚠  First-run setup not complete.${C.reset}  Press ${C.brightWhite}S${C.reset} to run the setup wizard (Apple login, certs, TestFlight).`);
  writeln();
}

function renderKeys() {
  const keys = [
    ['r', 'Run factory'],
    ['R', 'Run --full --llm'],
    ['s', 'Stop'],
    ['S', 'Setup wizard'],
    ['↑/↓', 'Scroll audit'],
    ['q', 'Quit'],
  ];
  writeln(`${C.gray}${'─'.repeat(cols)}${C.reset}`);
  write(C.gray);
  for (const [k, d] of keys) write(`  ${C.brightWhite}${k}${C.gray} ${d}   `);
  writeln(C.reset);
}

// ─── SCROLL STATE ─────────────────────────────────────────────────────────────
let auditScroll = 0;
let auditVisible = 4;

// ─── FULL RENDER ──────────────────────────────────────────────────────────────
function render() {
  cols = process.stdout.columns || 120;
  rows = process.stdout.rows || 40;
  auditVisible = Math.max(3, Math.floor((rows - 28) / 2));

  clearScreen();
  renderHeader();
  writeln();

  const latest = runs[runs.length - 1];
  renderPipeline(latest);
  writeln();

  renderAllRuns();
  writeln();

  renderStats();
  writeln();

  renderLog();
  writeln();

  renderSetupBanner();
  renderAudit();

  renderKeys();
}

// ─── FACTORY PROCESS ──────────────────────────────────────────────────────────
function startFactory(args = []) {
  if (factoryRunning) return;
  factoryArgs = args;
  factoryLog = [];
  factoryRunning = true;

  const allArgs = ['orchestrator/run-loop.js', '--continuous', '--max', '999', ...args];
  factoryProc = spawn('node', allArgs, { cwd: ROOT, env: { ...process.env, MAX_APPS: '999' } });

  factoryProc.stdout.on('data', (d) => {
    const lines = d.toString().split('\n');
    factoryLog.push(...lines);
    factoryLog = factoryLog.slice(-200);
    runs = loadRuns();
  });

  factoryProc.stderr.on('data', (d) => {
    const lines = d.toString().split('\n').filter((l) => l.trim() && !l.includes('ExperimentalWarning') && !l.includes('npm warn'));
    factoryLog.push(...lines);
    factoryLog = factoryLog.slice(-200);
  });

  factoryProc.on('exit', () => {
    factoryRunning = false;
    factoryProc = null;
    factoryLog.push('[factory exited]');
    runs = loadRuns();
  });
}

function stopFactory() {
  if (factoryProc) {
    factoryProc.kill('SIGTERM');
    factoryRunning = false;
    factoryLog.push('[stopping…]');
  }
}

function launchSetup() {
  // Exit TUI raw mode, hand terminal to setup wizard, then re-enter TUI
  clearInterval(interval);
  showCursor();
  clearScreen();
  process.stdin.setRawMode(false);
  process.stdin.pause();

  const setup = spawn('node', [path.join(ROOT, 'scripts', 'setup.js')], {
    stdio: 'inherit',
    cwd: ROOT,
  });

  setup.on('close', () => {
    // Re-enter TUI
    process.stdin.setRawMode(true);
    process.stdin.resume();
    hideCursor();
    runs = loadRuns();
    render();
    setInterval(() => { tick++; spinFrame++; runs = loadRuns(); render(); }, 200);
  });
}

// ─── AUTO-RUN ─────────────────────────────────────────────────────────────────
const autoArgs = [];
if (process.argv.includes('--llm')) autoArgs.push('--llm');
if (process.argv.includes('--full')) autoArgs.push('--full');
if (process.argv.includes('--e2e')) autoArgs.push('--e2e');

if (process.argv.includes('--run')) {
  setTimeout(() => startFactory(autoArgs), 500);
}


// ─── INPUT ────────────────────────────────────────────────────────────────────
if (!process.stdin.isTTY) {
  console.error('tui.js requires an interactive terminal (TTY). Run: node tui.js');
  process.exit(1);
}
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', (key) => {
  if (key === 'q' || key === '\x03') {
    stopFactory();
    showCursor();
    clearScreen();
    process.exit(0);
  }
  if (key === 'r') startFactory([]);
  if (key === 'R') startFactory(['--llm', '--full']);
  if (key === 's') stopFactory();
  if (key === 'S') launchSetup();
  if (key === '\x1b[A') auditScroll = Math.max(0, auditScroll - 1);
  if (key === '\x1b[B') auditScroll = Math.min(AUDIT.issues.length - 1, auditScroll + 1);
  runs = loadRuns();
  render();
});

// ─── LOOP ─────────────────────────────────────────────────────────────────────
hideCursor();
runs = loadRuns();
render();

let interval = setInterval(() => {
  tick++;
  spinFrame++;
  runs = loadRuns();
  render();
}, 200);

process.on('exit', () => { showCursor(); clearScreen(); });
process.on('SIGINT', () => { stopFactory(); showCursor(); clearScreen(); process.exit(0); });
process.on('SIGTERM', () => { stopFactory(); showCursor(); clearScreen(); process.exit(0); });
process.stdout.on('resize', () => { cols = process.stdout.columns; rows = process.stdout.rows; });
