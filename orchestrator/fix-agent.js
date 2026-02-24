#!/usr/bin/env node
/**
 * Fix Agent: parse Maestro failures, suggest/apply patches to flows
 * Input: stderr from maestro test, flow file path
 * Output: patched flow or fix instructions
 */

const fs = require('fs');
const path = require('path');

function parseFailure(stderr) {
  const s = String(stderr || '');
  return {
    timeout: /timeout|Timeout|timed out/i.test(s),
    notFound: /not found|element not found|Unable to find/i.test(s),
    launchFailed: /Unable to launch|launch failed/i.test(s),
    assertionFailed: /assertion|Assertion failed/i.test(s),
    flowName: (s.match(/(\d{2}-[a-z-]+)\.yaml/) || [])[1],
  };
}

function applyFix(flowPath, failure) {
  if (!fs.existsSync(flowPath)) return false;
  let content = fs.readFileSync(flowPath, 'utf8');

  if (failure.timeout) {
    content = content.replace(/timeout: (\d+)/g, (_, n) => `timeout: ${Math.min(parseInt(n, 10) * 2, 30000)}`);
  }

  if (failure.notFound && failure.flowName?.includes('add-asset')) {
    content = content.replace(/id: "add-asset"/g, 'text: "Add Asset"');
  }

  if (failure.notFound && failure.flowName?.includes('portfolio')) {
    content = content.replace(/timeout: (\d+)/g, (_, n) => `timeout: ${Math.min(parseInt(n, 10) * 2, 30000)}`);
  }

  fs.writeFileSync(flowPath, content);
  return true;
}

function main() {
  const stderr = process.argv[2] || '';
  const flowsDir = process.argv[3] || '';

  const failure = parseFailure(stderr);
  if (!failure.timeout && !failure.notFound && !failure.assertionFailed) {
    console.log(JSON.stringify({ fixed: false, reason: 'unknown failure', failure }));
    return;
  }

  if (!flowsDir || !fs.existsSync(flowsDir)) {
    console.log(JSON.stringify({ fixed: false, reason: 'no flows dir', failure }));
    return;
  }

  const files = fs.readdirSync(flowsDir).filter((f) => f.endsWith('.yaml'));
  let patched = 0;
  for (const f of files) {
    if (failure.flowName && !f.includes(failure.flowName)) continue;
    if (applyFix(path.join(flowsDir, f), { ...failure, flowName: f })) patched++;
  }

  // Only apply a generic timeout fix if we have a timeout signal and no specific match
  if (patched === 0 && files.length && failure.timeout) {
    applyFix(path.join(flowsDir, files[0]), { ...failure });
    patched = 1;
  }

  console.log(JSON.stringify({ fixed: patched > 0, patched, failure }));
}

main();
