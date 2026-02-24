#!/usr/bin/env node
/**
 * Feature Agent: writes features.json based on architecture from idea.
 * Usage: node feature-agent.js <appDir> <architecture> [ideaJson]
 */

const fs = require('fs');
const path = require('path');

const ARCH_FEATURES = {
  feed: ['feed-view', 'compose', 'profile', 'settings'],
  dashboard: ['overview', 'add-entry', 'history', 'settings'],
  tracker: ['calendar', 'day-entry', 'stats', 'settings'],
  reference: ['browse', 'item-detail', 'bookmarks', 'settings'],
  generic: ['list-view', 'add-item', 'detail-view', 'settings'],
};

function main() {
  const appDir = process.argv[2];
  const arch = process.argv[3] || 'generic';
  const ideaJson = process.argv[4];
  if (!appDir || !fs.existsSync(appDir)) {
    console.error('Usage: feature-agent.js <appDir> <architecture> [ideaJson]');
    process.exit(1);
  }

  let name = path.basename(appDir);
  let description = `${arch} app`;
  let architecture = ARCH_FEATURES[arch] ? arch : 'generic';

  if (ideaJson) {
    try {
      const idea = JSON.parse(ideaJson);
      name = idea.name || name;
      description = idea.description || description;
      if (idea.architecture && ARCH_FEATURES[idea.architecture]) {
        architecture = idea.architecture;
      }
    } catch {}
  }

  const features = ARCH_FEATURES[architecture];
  const featuresPath = path.join(appDir, 'features.json');
  fs.writeFileSync(featuresPath, JSON.stringify({ name, description, features, architecture }, null, 2));
  console.log(JSON.stringify({ featuresPath, features, architecture }));
}

main();
