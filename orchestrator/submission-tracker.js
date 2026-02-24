#!/usr/bin/env node
/**
 * Submission Tracker — polls Expo GraphQL API for submission status.
 *
 * Runs as a background daemon after eas submit --no-wait.
 * Polls every 30s, notifies via macOS notification + logs on state change.
 * Exits when all tracked submissions reach terminal state (FINISHED/ERRORED/CANCELED).
 *
 * Usage:
 *   node submission-tracker.js <projectId> [submissionId]
 *   node submission-tracker.js <projectId> --all       (track all pending)
 *   node submission-tracker.js <projectId> --daemon     (background mode, writes to log)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const POLL_INTERVAL_MS = 30_000;
const MAX_POLL_TIME_MS = 45 * 60 * 1000; // 45 min hard cap
const TERMINAL_STATES = new Set(['FINISHED', 'ERRORED', 'CANCELED']);

function loadSession() {
  const statePath = path.join(process.env.HOME, '.expo', 'state.json');
  if (!fs.existsSync(statePath)) throw new Error('No Expo session at ~/.expo/state.json — run `eas login`');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const secret = state?.auth?.sessionSecret;
  if (!secret) throw new Error('No sessionSecret in ~/.expo/state.json — run `eas login`');
  return secret;
}

function graphql(session, query, variables = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const req = https.request({
      hostname: 'api.expo.dev',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'expo-session': session,
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.errors?.length) reject(new Error(parsed.errors[0].message));
          else resolve(parsed.data);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getSubmissions(session, projectId, limit = 10) {
  const data = await graphql(session, `
    query ($appId: String!, $limit: Int!) {
      app {
        byId(appId: $appId) {
          id
          name
          submissions(offset: 0, limit: $limit, filter: { platform: IOS }) {
            id
            status
            platform
            createdAt
            updatedAt
            completedAt
            error { message errorCode }
          }
        }
      }
    }
  `, { appId: projectId, limit });
  return data.app.byId;
}

function notify(title, msg) {
  try {
    execSync(`osascript -e 'display notification "${msg.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}" sound name "Glass"'`);
  } catch {}
}

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  const line = `[${ts}] [tracker] ${msg}`;
  process.stdout.write(line + '\n');
}

function statusIcon(status) {
  switch (status) {
    case 'FINISHED': return 'OK';
    case 'ERRORED': return 'FAIL';
    case 'CANCELED': return 'CANCEL';
    case 'IN_PROGRESS': return 'PROGRESS';
    case 'IN_QUEUE': return 'QUEUE';
    case 'AWAITING_BUILD': return 'WAITING';
    default: return status;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function track(projectId, targetIds, appName) {
  const session = loadSession();
  const tracked = new Map();
  const startTime = Date.now();

  log(`Tracking ${targetIds.length ? targetIds.length + ' submission(s)' : 'all pending'} for ${appName || projectId}`);

  while (Date.now() - startTime < MAX_POLL_TIME_MS) {
    try {
      const app = await getSubmissions(session, projectId);
      const subs = app.submissions;

      const relevant = targetIds.length
        ? subs.filter(s => targetIds.includes(s.id))
        : subs.filter(s => !TERMINAL_STATES.has(s.status));

      if (relevant.length === 0 && targetIds.length === 0) {
        log('No pending submissions found');
        break;
      }

      let allDone = true;

      for (const sub of relevant) {
        const prev = tracked.get(sub.id);
        const changed = !prev || prev !== sub.status;

        if (changed) {
          tracked.set(sub.id, sub.status);
          const age = sub.createdAt
            ? Math.round((Date.now() - new Date(sub.createdAt).getTime()) / 60000)
            : '?';
          log(`[${statusIcon(sub.status)}] ${sub.id.slice(0, 8)} — ${sub.status} (age: ${age}m)`);

          if (sub.status === 'FINISHED') {
            const msg = `${app.name} submitted to TestFlight. Check your TestFlight app.`;
            notify('iOS App Factory', msg);
            log(msg);
          } else if (sub.status === 'ERRORED') {
            const errMsg = sub.error?.message || 'Unknown error';
            const msg = `${app.name} submission FAILED: ${errMsg}`;
            notify('iOS App Factory', msg);
            log(msg);
          } else if (sub.status === 'IN_PROGRESS' && prev === 'IN_QUEUE') {
            notify('iOS App Factory', `${app.name} submission now processing...`);
          }
        }

        if (!TERMINAL_STATES.has(sub.status)) allDone = false;
      }

      if (allDone && targetIds.length > 0) {
        log('All tracked submissions reached terminal state');
        break;
      }
    } catch (e) {
      log(`Poll error: ${e.message}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  if (Date.now() - startTime >= MAX_POLL_TIME_MS) {
    log('Hard timeout reached (45 min). Exiting tracker.');
    notify('iOS App Factory', 'Submission tracker timed out after 45 min. Check expo.dev manually.');
  }

  // Final summary
  const session2 = loadSession();
  try {
    const final = await getSubmissions(session2, projectId);
    const summary = final.submissions.slice(0, 5).map(s =>
      `  ${statusIcon(s.status).padEnd(8)} ${s.id.slice(0, 8)} (${s.status})`
    ).join('\n');
    log(`Final status:\n${summary}`);
  } catch {}
}

async function cancelSubmission(session, submissionId) {
  const data = await graphql(session, `
    mutation ($id: ID!) {
      submission {
        cancelSubmission(submissionId: $id) { id status }
      }
    }
  `, { id: submissionId });
  return data.submission.cancelSubmission;
}

async function cancelStale(projectId, maxAgeMinutes = 60) {
  const session = loadSession();
  const app = await getSubmissions(session, projectId);
  const now = Date.now();
  let cancelled = 0;

  for (const sub of app.submissions) {
    if (TERMINAL_STATES.has(sub.status)) continue;
    const age = (now - new Date(sub.createdAt).getTime()) / 60000;
    if (age > maxAgeMinutes) {
      log(`Canceling stale submission ${sub.id.slice(0, 8)} (age: ${Math.round(age)}m)...`);
      try {
        await cancelSubmission(session, sub.id);
        cancelled++;
      } catch (e) {
        log(`Failed to cancel ${sub.id.slice(0, 8)}: ${e.message}`);
      }
    }
  }

  log(cancelled > 0 ? `Cancelled ${cancelled} stale submission(s)` : 'No stale submissions to cancel');
  return cancelled;
}

async function showStatus(projectId) {
  const session = loadSession();
  const app = await getSubmissions(session, projectId);
  log(`Submissions for ${app.name}:`);
  for (const sub of app.submissions) {
    const age = Math.round((Date.now() - new Date(sub.createdAt).getTime()) / 60000);
    const err = sub.error?.message || '';
    log(`  ${statusIcon(sub.status).padEnd(8)} ${sub.id.slice(0, 8)} ${sub.status.padEnd(12)} age=${age}m ${err}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: submission-tracker.js <projectId> [submissionId|--all|--status|--cancel-stale]');
    process.exit(1);
  }

  const projectId = args[0];
  const flags = args.slice(1);

  if (flags.includes('--status')) {
    return await showStatus(projectId);
  }

  if (flags.includes('--cancel-stale')) {
    return await cancelStale(projectId);
  }

  const trackAll = flags.includes('--all');
  const targetIds = flags.filter(f => !f.startsWith('--'));

  // Get app name for notifications
  let appName = projectId;
  try {
    const session = loadSession();
    const app = await getSubmissions(session, projectId, 1);
    appName = app.name || projectId;
  } catch {}

  // Cancel stale submissions before tracking to avoid queue bloat
  try { await cancelStale(projectId, 60); } catch {}

  if (trackAll || targetIds.length === 0) {
    await track(projectId, [], appName);
  } else {
    await track(projectId, targetIds, appName);
  }
}

main().catch(e => {
  log(`Fatal: ${e.message}`);
  process.exit(1);
});
