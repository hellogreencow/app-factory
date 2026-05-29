#!/usr/bin/env node
/**
 * Functional Correctness Analyzer
 *
 * Reads generated app code and a design.json spec, then identifies:
 * 1. Screens that exist in design but have no/empty component files
 * 2. Navigation routes that don't resolve to real screens
 * 3. Screens with UI but no state/hooks (static dead screens)
 * 4. Missing loading/empty/error states
 * 5. Incomplete data flow: state defined but never rendered
 *
 * No simulator needed. No Expo Go needed. Pure static analysis + LLM review.
 */

require('./lib/env').loadEnv();

const fs = require('fs');
const path = require('path');
const { chat } = require('./lib/llm');

function log(msg) { process.stdout.write(`[analyzer] ${msg}\n`); }

// ── Code Analysis ──────────────────────────────────────────────────────

function findAllSourceFiles(appDir) {
  const files = [];
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '.expo' || e.name === '.qa-bundle') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (/\.(js|jsx)$/.test(e.name) && !e.name.includes('.test.')) files.push(full);
    }
  };
  walk(appDir);
  return files;
}

function readDesignJson(appDir) {
  const designPath = path.join(appDir, 'design.json');
  if (!fs.existsSync(designPath)) return null;
  try { return JSON.parse(fs.readFileSync(designPath, 'utf8')); } catch { return null; }
}

function analyzeScreenFile(filePath, code) {
  const rel = path.relative(process.cwd(), filePath);
  const issues = [];

  const hasJSX = /<[A-Z]\w*|<\w+[^>]*>/.test(code);
  const hasDefaultExport = /export\s+default\s+|module\.exports\s*=/.test(code);
  const hasNamedExports = /export\s+(const|function|class)\s+|export\s*\{/.test(code);
  const hasStyleSheet = /StyleSheet\.create/.test(code);
  const hasUseState = /useState/.test(code);
  const hasUseEffect = /useEffect/.test(code);
  const hasUseContext = /useContext/.test(code);
  const hasNavigation = /navigation\.|route\.params|useNavigation/.test(code);
  const hasScrollView = /ScrollView|FlatList|SectionList/.test(code);
  const hasTouchable = /Touchable|Pressable|onPress/.test(code);
  const hasText = /<Text[>\s]/.test(code);
  const hasImage = /<Image[>\s]/.test(code);
  const hasTextInput = /TextInput/.test(code);

  // Screen file must have JSX
  if (!hasJSX) {
    return { rel: '', issues: [], hasContent: false, hasInteractivity: false, hasStateManagement: false, hasStyling: false };
  }

  // Must have an export (only flag for JSX files — utility/context files may export differently)
  if (!hasDefaultExport && !hasNamedExports) {
    issues.push({ severity: 'critical', message: 'Component with JSX but no export — cannot be imported as a screen' });
  }

  // Screen with no state and no props likely a dead template
  if (!hasUseState && !hasUseEffect && !hasUseContext && !hasNavigation) {
    issues.push({ severity: 'warning', message: 'No hooks — screen may be a static placeholder' });
  }

  // Screen with no touchable/interactive elements
  if (!hasTouchable && !hasTextInput) {
    issues.push({ severity: 'info', message: 'No interactive elements — screen may be read-only' });
  }

  // Check for common crash patterns
  if (hasScrollView && !/<FlatList|<SectionList/.test(code)) {
    // ScrollView without nested content is fine, but check for map without guard
    const unguardedMap = /\b(\w+)\.map\s*\(/.test(code) && !/(\w+)\s*\?\?\s*\[\]/.test(code) && !/(\w+)\s*\|\|\s*\[\]/.test(code);
    if (unguardedMap) {
      issues.push({ severity: 'critical', message: 'Unguarded .map() call — will crash on null/undefined' });
    }
  }

  return { rel, issues, hasContent: hasJSX && (hasDefaultExport || hasNamedExports), hasInteractivity: hasTouchable || hasTextInput, hasStateManagement: hasUseState || hasUseContext, hasStyling: hasStyleSheet };
}

function checkNavigationCoverage(appDir, design, sourceFiles) {
  const issues = [];
  if (!design?.navigation?.tabs && !design?.navigation?.screens) return issues;

  const allScreens = [
    ...(design.navigation.tabs || []).map(t => t.screen),
    ...(design.navigation.screens || []).map(s => s.name),
  ];

  const fileNames = sourceFiles.map(f => path.basename(f, path.extname(f)).toLowerCase());

  for (const screenName of allScreens) {
    const normalized = screenName.toLowerCase().replace(/screen$/i, '');
    const found = fileNames.some(f => {
      const fn = f.toLowerCase().replace(/screen$/i, '');
      return fn === normalized || fn.includes(normalized) || normalized.includes(fn);
    });

    if (!found) {
      issues.push({
        severity: 'critical',
        message: `Screen "${screenName}" in design.json has no matching source file`,
      });
    }
  }

  return issues;
}

async function llmFunctionalReview(appDir, design, fileAnalyses) {
  // Use LLM to check for deeper issues: data flow, edge case handling, completeness
  const problematicFiles = fileAnalyses
    .filter(f => f.issues.some(i => i.severity === 'critical' || i.severity === 'warning'))
    .slice(0, 5);

  if (problematicFiles.length === 0) return [];

  log(`LLM review of ${problematicFiles.length} problematic files...`);

  const issues = [];

  for (const analysis of problematicFiles) {
    const filePath = path.resolve(appDir, analysis.rel);
    if (!fs.existsSync(filePath)) continue;

    const code = fs.readFileSync(filePath, 'utf8');
    if (code.length < 100) continue;

    const prompt = `Analyze this React Native screen for functional correctness. List ONLY concrete bugs that would prevent the app from working correctly.

FILE: ${analysis.rel}
APP: ${design?.name || 'Unknown'}
EXPECTED BEHAVIOR: This screen should ${analysis.rel.toLowerCase().includes('map') ? 'show a map with interactive markers' : analysis.rel.toLowerCase().includes('profile') ? 'show user profile with editable fields' : analysis.rel.toLowerCase().includes('list') ? 'show a scrollable list of items' : 'display meaningful content and respond to user interaction'}

CODE:
\`\`\`
${code.slice(0, 6000)}
\`\`\`

OUTPUT FORMAT: Return a JSON array of bugs. Each bug: {"severity": "critical|high|medium|low", "category": "crash|usability|completeness|performance", "message": "..."}
Only report REAL bugs. Do not report style preferences or suggestions.

JSON:` ;

    try {
      const result = await chat([{ role: 'user', content: prompt }], {
        model: 'google/gemini-2.0-flash-001',
        temperature: 0.1,
        max_tokens: 2000,
        timeout: 30_000,
      });

      // Parse JSON from response
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const bugs = JSON.parse(jsonMatch[0]);
          for (const bug of bugs) {
            issues.push({
              file: analysis.rel,
              severity: bug.severity || 'medium',
              category: bug.category || 'unknown',
              message: bug.message,
              source: 'llm',
            });
          }
        } catch {}
      }
    } catch (e) {
      log(`  LLM review failed for ${analysis.rel}: ${e.message.slice(0, 80)}`);
    }
  }

  return issues;
}

// ── Scoring ────────────────────────────────────────────────────────────

function calculateHealthScore(errors, warnings, infoCount) {
  // 100 = perfect, 0 = completely broken
  let score = 100;
  score -= errors * 20;    // Each critical error: -20
  score -= warnings * 5;   // Each warning: -5
  score -= infoCount * 1;  // Each info: -1
  return Math.max(0, Math.min(100, score));
}

// ── Main ───────────────────────────────────────────────────────────────

async function analyzeApp(appDir, opts = {}) {
  const useLLM = opts.llm !== false;
  log(`Analyzing: ${path.basename(appDir)}`);

  const design = readDesignJson(appDir);
  if (!design) {
    return { ok: false, error: 'No design.json found', phase: 'validate' };
  }

  log(`App: "${design.name}" — ${design.navigation?.type || 'unknown'} navigation, ${(design.navigation?.tabs || design.navigation?.screens || []).length} screens`);

  // Phase 1: Find and analyze all source files
  const sourceFiles = findAllSourceFiles(appDir);
  log(`Found ${sourceFiles.length} source files`);

  const fileAnalyses = [];
  for (const filePath of sourceFiles) {
    try {
      const code = fs.readFileSync(filePath, 'utf8');
      if (code.length < 50) continue;
      const analysis = analyzeScreenFile(filePath, code);
      analysis.rel = path.relative(appDir, filePath);
      fileAnalyses.push(analysis);
    } catch (e) {
      fileAnalyses.push({
        rel: path.relative(appDir, filePath),
        issues: [{ severity: 'critical', message: `Cannot read file: ${e.message}` }],
        hasContent: false,
      });
    }
  }

  // Phase 2: Check navigation coverage
  const navIssues = checkNavigationCoverage(appDir, design, sourceFiles);
  const allIssues = [
    ...navIssues.map(i => ({ ...i, file: 'design.json', source: 'navigation' })),
    ...fileAnalyses.flatMap(f => (f.issues || []).map(i => ({ ...i, file: f.rel, source: 'static' }))),
  ];

  // Phase 3: LLM review of problematic files
  let llmIssues = [];
  if (useLLM) {
    llmIssues = await llmFunctionalReview(appDir, design, fileAnalyses);
    allIssues.push(...llmIssues);
  }

  // Score
  const criticalErrors = allIssues.filter(i => i.severity === 'critical');
  const warnings = allIssues.filter(i => i.severity === 'warning');
  const infoIssues = allIssues.filter(i => i.severity === 'info');

  const healthScore = calculateHealthScore(criticalErrors.length, warnings.length, infoIssues.length);
  const screensWithContent = fileAnalyses.filter(f => f.hasContent).length;
  const screensWithInteractivity = fileAnalyses.filter(f => f.hasInteractivity).length;
  const screensWithState = fileAnalyses.filter(f => f.hasStateManagement).length;
  const totalScreens = design.navigation?.tabs?.length || design.navigation?.screens?.length || fileAnalyses.length;

  return {
    ok: criticalErrors.length === 0,
    phase: criticalErrors.length === 0 ? 'healthy' : 'broken',
    appName: design.name,
    healthScore,
    summary: {
      totalScreens: totalScreens || 'unknown',
      screensWithContent,
      screensWithInteractivity,
      screensWithState,
      criticalErrors: criticalErrors.length,
      warnings: warnings.length,
      info: infoIssues.length,
    },
    issues: allIssues.map(i => ({
      severity: i.severity,
      category: i.category || i.source || 'unknown',
      file: i.file,
      message: i.message,
    })),
    fileAnalyses: fileAnalyses.map(f => ({
      file: f.rel,
      hasContent: f.hasContent,
      hasInteractivity: f.hasInteractivity,
      hasStateManagement: f.hasStateManagement,
      issueCount: (f.issues || []).length,
    })),
  };
}

// ── Bulk Analysis ──────────────────────────────────────────────────────

async function analyzeAllApps(factoryDir, opts = {}) {
  const appsDir = path.join(factoryDir, 'apps');
  if (!fs.existsSync(appsDir)) return [];

  const appDirs = fs.readdirSync(appsDir)
    .filter(d => fs.existsSync(path.join(appsDir, d, 'design.json')))
    .map(d => path.join(appsDir, d));

  log(`Analyzing ${appDirs.length} apps...`);

  const results = [];
  for (const appDir of appDirs) {
    try {
      const result = await analyzeApp(appDir, opts);
      results.push(result);
      log(`  ${result.appName}: score=${result.healthScore} (${result.summary.criticalErrors} critical)`);
    } catch (e) {
      results.push({ ok: false, error: e.message, appName: path.basename(appDir), healthScore: 0 });
    }
  }

  return results;
}

// ── CLI ────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const factoryRoot = path.join(__dirname, '..');

  if (args.includes('--all')) {
    analyzeAllApps(factoryRoot, { llm: !args.includes('--no-llm') }).then(results => {
      console.log(JSON.stringify({
        total: results.length,
        healthy: results.filter(r => r.ok).length,
        broken: results.filter(r => !r.ok).length,
        avgScore: Math.round(results.reduce((s, r) => s + (r.healthScore || 0), 0) / results.length),
        results: results.map(r => ({
          name: r.appName,
          score: r.healthScore,
          ok: r.ok,
          critical: r.summary?.criticalErrors || 0,
          issues: (r.issues || []).filter(i => i.severity === 'critical').slice(0, 3).map(i => i.message),
        })),
      }, null, 2));
    });
  } else if (args[0]) {
    const appDir = path.resolve(args[0]);
    analyzeApp(appDir, { llm: !args.includes('--no-llm') }).then(r => {
      console.log(JSON.stringify(r, null, 2));
      process.exit(r.ok ? 0 : 1);
    });
  } else {
    console.log('Usage: node functional-analyzer.js <appDir> [--no-llm]');
    console.log('       node functional-analyzer.js --all [--no-llm]');
  }
}

module.exports = { analyzeApp, analyzeAllApps };