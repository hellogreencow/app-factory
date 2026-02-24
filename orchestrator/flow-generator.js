#!/usr/bin/env node
/**
 * Flow Generator: generates Maestro E2E YAML flows per architecture.
 *
 * Key property: flows are generated to match the *actual app code*.
 * If stable ids exist (testID/tabBarButtonTestID), flows prefer ids.
 * If not, flows fall back to visible text for tab navigation + titles.
 *
 * Usage: node flow-generator.js <appDir>
 */

const fs = require('fs');
const path = require('path');

function getAppId(appDir) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(appDir, 'app.json'), 'utf8'));
    return cfg?.expo?.ios?.bundleIdentifier || 'com.iosappfactory.app';
  } catch {
    return 'com.iosappfactory.app';
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
  const ids = new Set();
  const files = [];

  const appJs = path.join(appDir, 'App.js');
  if (fs.existsSync(appJs)) files.push(appJs);

  const srcDir = path.join(appDir, 'src');
  if (fs.existsSync(srcDir)) files.push(...walkJsFiles(srcDir));

  const reTestId1 = /\btestID\s*=\s*["']([^"']+)["']/g;
  const reTestId2 = /\btestID\s*=\s*\{\s*["']([^"']+)["']\s*\}/g;
  const reTabId = /\btabBarButtonTestID\s*:\s*["']([^"']+)["']/g;

  for (const fp of files) {
    let code = '';
    try { code = fs.readFileSync(fp, 'utf8'); } catch { continue; }
    for (const m of code.matchAll(reTestId1)) ids.add(m[1]);
    for (const m of code.matchAll(reTestId2)) ids.add(m[1]);
    for (const m of code.matchAll(reTabId)) ids.add(m[1]);
  }

  return ids;
}

function pick(knownIds, preferredId, fallbackText) {
  if (preferredId && knownIds.has(preferredId)) return { id: preferredId };
  return { text: fallbackText };
}

function selLine(sel) {
  if (sel.id) return `      id: "${sel.id}"`;
  return `      text: "${sel.text}"`;
}

function stepWaitVisible(sel, timeoutMs) {
  return `- extendedWaitUntil:
    visible:
${selLine(sel)}
    timeout: ${timeoutMs}
`;
}

function stepAssertVisible(sel) {
  return `- assertVisible:
${sel.id ? `    id: "${sel.id}"` : `    text: "${sel.text}"`}
`;
}

function stepTapOn(sel) {
  return `- tapOn:
${sel.id ? `    id: "${sel.id}"` : `    text: "${sel.text}"`}
`;
}

function feedFlows(appId, knownIds) {
  const tabProfile = pick(knownIds, 'tab-profile', 'Profile');
  const tabSettings = pick(knownIds, 'tab-settings', 'Settings');
  const settingsTitle = pick(knownIds, 'settings-title', 'Settings');

  return {
    'feed-view': `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'compose-btn' }, 15000)}${stepAssertVisible({ id: 'compose-btn' })}`,

    compose: `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'compose-btn' }, 15000)}${stepTapOn({ id: 'compose-btn' })}${stepWaitVisible({ id: 'input-body' }, 5000)}${stepTapOn({ id: 'input-body' })}- inputText: "Hello from E2E"
${stepTapOn({ id: 'post-btn' })}${stepWaitVisible({ id: 'compose-btn' }, 5000)}- assertVisible:
    text: "Hello from E2E"
`,

    profile: `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'compose-btn' }, 15000)}${stepTapOn(tabProfile)}${stepWaitVisible({ id: 'post-count' }, 5000)}${stepAssertVisible({ id: 'post-count' })}`,

    settings: `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'compose-btn' }, 15000)}${stepTapOn(tabSettings)}${stepWaitVisible(settingsTitle, 5000)}${stepAssertVisible(settingsTitle)}`,
  };
}

function dashboardFlows(appId, knownIds) {
  const tabHistory = pick(knownIds, 'tab-history', 'History');
  const tabSettings = pick(knownIds, 'tab-settings', 'Settings');
  const historyTitle = pick(knownIds, 'history-title', 'History');
  const settingsTitle = pick(knownIds, 'settings-title', 'Settings');

  return {
    overview: `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'metric-total' }, 15000)}${stepAssertVisible({ id: 'metric-total' })}${stepAssertVisible({ id: 'mini-chart' })}`,

    'add-entry': `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'metric-total' }, 15000)}${stepTapOn({ id: 'add-entry' })}${stepWaitVisible({ id: 'input-value' }, 5000)}${stepTapOn({ id: 'input-value' })}- inputText: "75"
${stepTapOn({ id: 'save-entry' })}${stepWaitVisible({ id: 'metric-total' }, 5000)}`,

    history: `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'metric-total' }, 15000)}${stepTapOn(tabHistory)}${stepWaitVisible(historyTitle, 5000)}${stepAssertVisible(historyTitle)}`,

    settings: `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'metric-total' }, 15000)}${stepTapOn(tabSettings)}${stepWaitVisible(settingsTitle, 5000)}${stepAssertVisible(settingsTitle)}`,
  };
}

function trackerFlows(appId, knownIds) {
  const tabStats = pick(knownIds, 'tab-stats', 'Stats');
  const tabSettings = pick(knownIds, 'tab-settings', 'Settings');
  const settingsTitle = pick(knownIds, 'settings-title', 'Settings');

  return {
    calendar: `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'add-entry' }, 15000)}${stepAssertVisible({ id: 'streak' })}${stepAssertVisible({ id: 'add-entry' })}`,

    'day-entry': `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'add-entry' }, 15000)}${stepTapOn({ id: 'add-entry' })}${stepWaitVisible({ id: 'input-note' }, 5000)}${stepTapOn({ id: 'mood-great' })}${stepTapOn({ id: 'input-note' })}- inputText: "E2E test day"
${stepTapOn({ id: 'save-entry' })}${stepWaitVisible({ id: 'add-entry' }, 5000)}`,

    stats: `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'add-entry' }, 15000)}${stepTapOn(tabStats)}${stepWaitVisible({ id: 'stat-streak' }, 5000)}${stepAssertVisible({ id: 'stat-streak' })}`,

    settings: `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'add-entry' }, 15000)}${stepTapOn(tabSettings)}${stepWaitVisible(settingsTitle, 5000)}${stepAssertVisible(settingsTitle)}`,
  };
}

function referenceFlows(appId, knownIds) {
  const tabBookmarks = pick(knownIds, 'tab-bookmarks', 'Bookmarks');
  const tabSettings = pick(knownIds, 'tab-settings', 'Settings');
  const bookmarksTitle = pick(knownIds, 'bookmarks-title', 'Bookmarks');
  const settingsTitle = pick(knownIds, 'settings-title', 'Settings');

  return {
    browse: `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'search-input' }, 15000)}${stepAssertVisible({ id: 'search-input' })}`,

    'item-detail': `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'search-input' }, 15000)}${stepTapOn({ id: 'item-1' })}${stepWaitVisible({ id: 'toggle-bookmark' }, 5000)}${stepAssertVisible({ id: 'toggle-bookmark' })}`,

    bookmarks: `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'search-input' }, 15000)}${stepTapOn(tabBookmarks)}${stepWaitVisible(bookmarksTitle, 5000)}${stepAssertVisible(bookmarksTitle)}`,

    settings: `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'search-input' }, 15000)}${stepTapOn(tabSettings)}${stepWaitVisible(settingsTitle, 5000)}${stepAssertVisible(settingsTitle)}`,
  };
}

function genericFlows(appId, knownIds) {
  const tabSettings = pick(knownIds, 'tab-settings', 'Settings');
  const settingsTitle = pick(knownIds, 'settings-title', 'Settings');
  const detailTitle = pick(knownIds, 'detail-title', 'Detail');

  return {
    'list-view': `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'add-item' }, 15000)}${stepAssertVisible({ id: 'add-item' })}`,

    'add-item': `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'add-item' }, 15000)}${stepTapOn({ id: 'add-item' })}${stepWaitVisible({ id: 'input-name' }, 5000)}${stepTapOn({ id: 'input-name' })}- inputText: "Test"
${stepTapOn({ id: 'input-value' })}- inputText: "1"
${stepTapOn({ id: 'save-item' })}${stepWaitVisible({ id: 'add-item' }, 5000)}- assertVisible:
    text: "Test"
`,

    'detail-view': `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'add-item' }, 15000)}${stepTapOn({ id: 'add-item' })}${stepWaitVisible({ id: 'input-name' }, 5000)}${stepTapOn({ id: 'input-name' })}- inputText: "DetailTest"
${stepTapOn({ id: 'input-value' })}- inputText: "42"
${stepTapOn({ id: 'save-item' })}${stepWaitVisible({ id: 'add-item' }, 5000)}- tapOn:
    text: "DetailTest"
${stepWaitVisible(detailTitle, 5000)}${stepAssertVisible(detailTitle)}`,

    settings: `appId: ${appId}
---
- launchApp
${stepWaitVisible({ id: 'add-item' }, 15000)}${stepTapOn(tabSettings)}${stepWaitVisible(settingsTitle, 5000)}${stepAssertVisible(settingsTitle)}`,
  };
}

const ARCH_FLOW_MAP = { feed: feedFlows, dashboard: dashboardFlows, tracker: trackerFlows, reference: referenceFlows, generic: genericFlows };

function generateFlows(appDir, features, architecture) {
  const appId = getAppId(appDir);
  const knownIds = collectKnownIds(appDir);
  const flowFn = ARCH_FLOW_MAP[architecture] || ARCH_FLOW_MAP.generic;
  const templates = flowFn(appId, knownIds);
  const flowsDir = path.join(appDir, 'maestro', 'flows');
  fs.mkdirSync(flowsDir, { recursive: true });
  let i = 1;
  for (const f of features) {
    const yaml = templates[f];
    if (!yaml) continue;
    fs.writeFileSync(path.join(flowsDir, `${String(i).padStart(2, '0')}-${f}.yaml`), yaml);
    i++;
  }
  return flowsDir;
}

function main() {
  const appDir = process.argv[2];
  if (!appDir || !fs.existsSync(appDir)) {
    console.error('Usage: flow-generator.js <appDir>');
    process.exit(1);
  }

  const featuresPath = path.join(appDir, 'features.json');
  let features = ['list-view', 'add-item', 'detail-view', 'settings'];
  let architecture = 'generic';
  if (fs.existsSync(featuresPath)) {
    const data = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));
    features = data.features || features;
    architecture = data.architecture || 'generic';
  }

  const flowsDir = generateFlows(appDir, features, architecture);
  console.log(JSON.stringify({ flowsDir, features, architecture }));
}

main();
