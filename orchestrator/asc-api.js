#!/usr/bin/env node
/**
 * App Store Connect API client — used by review-agent and deploy pipeline.
 * Handles JWT auth, bundle ID lookup, app existence check, and app creation attempts.
 *
 * Apple's ASC REST API does NOT support POST /v1/apps (returns 403 regardless of role).
 * App creation must happen through: ASC web UI, Xcode, or eas submit interactive mode.
 * This module detects that gap and provides actionable remediation.
 */

const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
    const m = l.match(/^([^#=]+)=(.+)/);
    if (m) env[m[1].trim()] = m[2].trim();
  });
  return env;
}

function toBase64Url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeJWT(env) {
  const pk = fs.readFileSync(env.EXPO_ASC_API_KEY_PATH, 'utf8');
  const h = toBase64Url(Buffer.from(JSON.stringify({ alg: 'ES256', kid: env.EXPO_ASC_KEY_ID, typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const p = toBase64Url(Buffer.from(JSON.stringify({
    iss: env.EXPO_ASC_ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1',
  })));
  const si = h + '.' + p;
  const sign = crypto.createSign('SHA256');
  sign.update(si);
  return si + '.' + toBase64Url(sign.sign({ key: pk, dsaEncoding: 'ieee-p1363' }));
}

function apiRequest(method, apiPath, jwt, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.appstoreconnect.apple.com',
      path: apiPath,
      method,
      headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);

    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(d) });
        } catch {
          resolve({ status: res.statusCode, data: d });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function validateCredentials() {
  const env = loadEnv();
  const issues = [];

  for (const v of ['EXPO_ASC_KEY_ID', 'EXPO_ASC_ISSUER_ID', 'EXPO_ASC_API_KEY_PATH', 'EXPO_APPLE_TEAM_ID', 'APPLE_ID']) {
    if (!env[v]) issues.push({ severity: 'error', field: v, msg: `Missing ${v} in .env` });
  }
  if (env.EXPO_ASC_API_KEY_PATH && !fs.existsSync(env.EXPO_ASC_API_KEY_PATH)) {
    issues.push({ severity: 'error', field: 'EXPO_ASC_API_KEY_PATH', msg: `Key file not found: ${env.EXPO_ASC_API_KEY_PATH}` });
  }

  if (issues.some(i => i.severity === 'error')) return { ok: false, issues, env };

  try {
    const jwt = makeJWT(env);
    const r = await apiRequest('GET', '/v1/bundleIds?limit=1', jwt);
    if (r.status === 200) {
      issues.push({ severity: 'ok', field: 'jwt', msg: 'JWT auth working' });
    } else {
      issues.push({ severity: 'error', field: 'jwt', msg: `Auth failed (${r.status}): ${JSON.stringify(r.data).slice(0, 200)}` });
    }
  } catch (e) {
    issues.push({ severity: 'error', field: 'network', msg: `API unreachable: ${e.message}` });
  }

  return { ok: !issues.some(i => i.severity === 'error'), issues, env };
}

async function findBundleId(identifier) {
  const env = loadEnv();
  const jwt = makeJWT(env);
  const r = await apiRequest('GET', `/v1/bundleIds?filter[identifier]=${identifier}&limit=5`, jwt);
  if (r.status === 200 && r.data.data?.length > 0) {
    return { found: true, id: r.data.data[0].id, identifier: r.data.data[0].attributes.identifier };
  }
  return { found: false };
}

async function findApp(bundleIdentifier) {
  const env = loadEnv();
  const jwt = makeJWT(env);
  const r = await apiRequest('GET', `/v1/apps?filter[bundleId]=${bundleIdentifier}&limit=5`, jwt);
  if (r.status === 200 && r.data.data?.length > 0) {
    const app = r.data.data[0];
    return { found: true, id: app.id, name: app.attributes.name, bundleId: app.attributes.bundleId };
  }
  return { found: false };
}

async function checkAppReadyForSubmit(slug) {
  const appDir = path.join(ROOT, 'apps', slug);
  const issues = [];

  // 1. App dir exists
  if (!fs.existsSync(appDir)) {
    return { ready: false, issues: [{ severity: 'error', check: 'appDir', msg: `App directory missing: ${appDir}` }] };
  }

  // 2. app.json valid
  const appJsonPath = path.join(appDir, 'app.json');
  if (!fs.existsSync(appJsonPath)) {
    issues.push({ severity: 'error', check: 'app.json', msg: 'app.json missing' });
  } else {
    try {
      const cfg = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      const expo = cfg.expo || {};
      if (!expo.ios?.bundleIdentifier) issues.push({ severity: 'error', check: 'bundleId', msg: 'Missing ios.bundleIdentifier' });
      if (!expo.owner) issues.push({ severity: 'warn', check: 'owner', msg: 'Missing expo.owner — deploy.sh will set it' });
      if (!expo.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false) {
        issues.push({ severity: 'warn', check: 'encryption', msg: 'Missing ITSAppUsesNonExemptEncryption flag' });
      }
      if (!expo.extra?.eas?.projectId) issues.push({ severity: 'warn', check: 'easProject', msg: 'EAS project not linked — deploy.sh will run eas init' });

      // 3. Check bundle ID registered on ASC
      const bundleId = expo.ios?.bundleIdentifier;
      if (bundleId) {
        const bid = await findBundleId(bundleId);
        if (bid.found) {
          issues.push({ severity: 'ok', check: 'bundleIdASC', msg: `Bundle ID registered: ${bid.identifier}` });
        } else {
          issues.push({ severity: 'warn', check: 'bundleIdASC', msg: `Bundle ID not on ASC — EAS build will register it` });
        }

        // 4. Check app exists on ASC
        const app = await findApp(bundleId);
        if (app.found) {
          issues.push({ severity: 'ok', check: 'appASC', msg: `App exists on ASC: ${app.name} (${app.id})`, ascAppId: app.id });
        } else {
          issues.push({
            severity: 'blocker',
            check: 'appASC',
            msg: `App NOT on App Store Connect. Apple API cannot create apps (platform limitation). ` +
                 `Create manually: appstoreconnect.apple.com → "+" → New App → ` +
                 `iOS, name="${expo.name || slug}", bundleId="${bundleId}", SKU="${slug}-001"`,
          });
        }
      }
    } catch (e) {
      issues.push({ severity: 'error', check: 'app.json', msg: `Parse error: ${e.message}` });
    }
  }

  // 5. eas.json exists
  if (!fs.existsSync(path.join(appDir, 'eas.json'))) {
    issues.push({ severity: 'warn', check: 'eas.json', msg: 'eas.json missing — deploy.sh will copy it' });
  }

  // 6. Credential validation
  const creds = await validateCredentials();
  if (!creds.ok) {
    issues.push({ severity: 'error', check: 'credentials', msg: 'Credential issues: ' + creds.issues.filter(i => i.severity === 'error').map(i => i.msg).join('; ') });
  }

  const hasBlocker = issues.some(i => i.severity === 'blocker');
  const hasError = issues.some(i => i.severity === 'error');

  return { ready: !hasBlocker && !hasError, issues };
}

// CLI usage
if (require.main === module) {
  const [cmd, ...args] = process.argv.slice(2);
  (async () => {
    if (cmd === 'check-creds') {
      const r = await validateCredentials();
      console.log(JSON.stringify(r, null, 2));
    } else if (cmd === 'find-app') {
      const r = await findApp(args[0]);
      console.log(JSON.stringify(r, null, 2));
    } else if (cmd === 'find-bundle') {
      const r = await findBundleId(args[0]);
      console.log(JSON.stringify(r, null, 2));
    } else if (cmd === 'check-ready') {
      const r = await checkAppReadyForSubmit(args[0]);
      console.log(JSON.stringify(r, null, 2));
    } else {
      console.error('Usage: asc-api.js <check-creds|find-app|find-bundle|check-ready> [args]');
    }
  })().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { validateCredentials, findBundleId, findApp, checkAppReadyForSubmit, loadEnv, makeJWT };
