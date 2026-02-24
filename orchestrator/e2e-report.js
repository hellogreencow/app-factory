#!/usr/bin/env node
/**
 * Parse Maestro JUnit report for per-flow pass/fail.
 * Usage: node e2e-report.js <path-to-report.xml>
 * Output: JSON { flows: [{ name, ok }], allPassed }
 */

const fs = require('fs');
const path = require('path');

function parseJunit(xmlPath) {
  if (!fs.existsSync(xmlPath)) return { flows: [], allPassed: false };
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const flows = [];
  const re = /<testcase\s+[^>]*name="([^"]+)"[^>]*(?:status="([^"]*)")?[^>]*\/?>|<\/testcase>/g;
  const testcaseBlocks = xml.split(/<testcase\s+/);
  for (let i = 1; i < testcaseBlocks.length; i++) {
    const block = testcaseBlocks[i];
    const nameMatch = block.match(/name="([^"]+)"/);
    const statusMatch = block.match(/status="([^"]+)"/);
    const hasFailure = block.includes('<failure');
    const name = nameMatch ? nameMatch[1] : `flow-${i}`;
    const status = statusMatch ? statusMatch[1] : (hasFailure ? 'FAILED' : 'SUCCESS');
    flows.push({ name, ok: status === 'SUCCESS' && !hasFailure });
  }
  return { flows, allPassed: flows.length > 0 && flows.every((f) => f.ok) };
}

function main() {
  const reportPath = process.argv[2] || path.join(__dirname, '..', 'apps', 'crypto-portfolio', 'maestro-reports', 'report.xml');
  const out = parseJunit(reportPath);
  console.log(JSON.stringify(out, null, 2));
}

main();
