#!/usr/bin/env node
require('../orchestrator/lib/env').loadEnv();
const { build } = require('../orchestrator/pipeline');

const idea = {
  name: 'SettleSnap',
  slug: 'settleSnap',
  description: 'Split bills, track shared expenses, and auto-settle debts with smart scanning and payment reminders.',
  domain: 'finance',
  twist: 'minimal',
  architecture: 'dashboard',
  style_notes: 'Sleek, clean, trust-inducing. Dark accents on white. Numbers front and centre.',
};

build(idea, {
  tier: 'pro',
  onProgress: (msg) => process.stdout.write('[progress] ' + msg + '\n'),
}).then(r => {
  process.stdout.write('DONE: ' + JSON.stringify({ ok: r.ok, phase: r.phase, errors: r.errors?.slice(0, 3) }) + '\n');
  process.exit(r.ok ? 0 : 1);
}).catch(e => {
  process.stdout.write('CRASH: ' + e.message + '\n');
  process.exit(1);
});
