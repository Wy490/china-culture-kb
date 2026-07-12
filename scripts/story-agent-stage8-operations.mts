import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStage8Operations } from '../web/server/src/services/stage8-operations-service.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.resolve(repoRoot, 'data/reports/story-agent-stage8-operations-readiness.json');
const fixedNow = '2026-07-12T21:00:00.000Z';
const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : '';
if (!mode) throw new Error('usage: story-agent-stage8-operations.mts --write|--check');

const operations = await getStage8Operations({ repoRoot, now: fixedNow });
const report = {
  schema_version: 'story-agent-stage8-operations-readiness/v1',
  generated_at: fixedNow,
  policy: operations.policy,
  summary: operations.summary,
  handoff_canonical_sha256: operations.handoff_canonical_sha256,
  source_bindings: operations.source_bindings,
  lanes: operations.lanes,
  projects: operations.projects,
};
const expected = `${JSON.stringify(report, null, 2)}\n`;
if (mode === 'write') {
  await writeFile(reportPath, expected, 'utf8');
  console.log(JSON.stringify({ report_written: true, summary: report.summary, handoff_canonical_sha256: report.handoff_canonical_sha256 }, null, 2));
} else {
  if (await readFile(reportPath, 'utf8') !== expected) throw new Error('stage8_operations_readiness_stale');
  console.log(JSON.stringify({ checked: true, summary: report.summary, handoff_canonical_sha256: report.handoff_canonical_sha256 }, null, 2));
}
