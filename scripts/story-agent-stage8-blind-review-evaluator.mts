import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStage8BlindReviewEvaluatorReadiness } from '../web/server/src/services/stage8-blind-review-evaluator-service.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.resolve(repoRoot, 'data/reports/story-agent-stage8-blind-review-evaluator-readiness.json');
const fixedNow = '2026-07-12T17:00:00.000Z';
const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : '';
if (!mode) throw new Error('usage: story-agent-stage8-blind-review-evaluator.mts --write|--check');

const report = await getStage8BlindReviewEvaluatorReadiness({ repoRoot, now: fixedNow });
const expected = `${JSON.stringify(report, null, 2)}\n`;
if (mode === 'write') {
  await writeFile(reportPath, expected, 'utf8');
  console.log(JSON.stringify({ report_written: true, summary: report.summary }, null, 2));
} else {
  if (await readFile(reportPath, 'utf8') !== expected) throw new Error('stage8_blind_review_evaluator_readiness_stale');
  console.log(JSON.stringify({ checked: true, summary: report.summary }, null, 2));
}
