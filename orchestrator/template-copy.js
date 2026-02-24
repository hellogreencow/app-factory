#!/usr/bin/env node
/**
 * Template Copy: routes to correct architecture template, copies src + App.js + deps.
 * Usage: node template-copy.js <appDir> <architecture> [slug]
 * Architecture: feed | dashboard | tracker | reference | generic (default)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEMPLATES = path.join(ROOT, 'templates');
const VALID_ARCHS = ['feed', 'dashboard', 'tracker', 'reference', 'generic'];

const NAV_DEPS = {
  '@react-navigation/native': '^7.1.28',
  '@react-navigation/native-stack': '^7.13.0',
  '@react-navigation/bottom-tabs': '^7.14.0',
  'react-native-screens': '~4.4.0',
  'react-native-safe-area-context': '4.12.0',
  '@react-native-async-storage/async-storage': '1.23.1',
};

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src)) {
    const s = path.join(src, e);
    const d = path.join(dest, e);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function copyTemplate(appDir, refDir, slug) {
  copyDir(path.join(refDir, 'src'), path.join(appDir, 'src'));
  const refApp = path.join(refDir, 'App.js');
  if (fs.existsSync(refApp)) fs.copyFileSync(refApp, path.join(appDir, 'App.js'));

  const pkgPath = path.join(appDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.dependencies = { ...pkg.dependencies, ...NAV_DEPS };
  pkg.name = slug;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  const appJsonPath = path.join(appDir, 'app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  appJson.expo.name = slug;
  appJson.expo.slug = slug;
  appJson.expo.ios = appJson.expo.ios || {};
  appJson.expo.ios.bundleIdentifier = `com.iosappfactory.${slug.replace(/[^a-z0-9]/gi, '')}`;
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
}

function main() {
  const appDir = process.argv[2];
  const arch = process.argv[3] || 'generic';
  if (!appDir || !fs.existsSync(appDir)) {
    console.error('Usage: template-copy.js <appDir> <architecture>');
    process.exit(1);
  }

  const slug = path.basename(appDir);
  const resolved = VALID_ARCHS.includes(arch) ? arch : 'generic';
  const refDir = path.join(TEMPLATES, resolved);

  if (!fs.existsSync(refDir)) {
    const fallback = path.join(TEMPLATES, 'generic');
    if (fs.existsSync(fallback)) {
      copyTemplate(appDir, fallback, slug);
      console.log(JSON.stringify({ copied: true, architecture: 'generic', slug, fallback: true }));
    } else {
      console.log(JSON.stringify({ copied: false, reason: 'no template found' }));
    }
    return;
  }

  copyTemplate(appDir, refDir, slug);
  console.log(JSON.stringify({ copied: true, architecture: resolved, slug }));
}

main();
