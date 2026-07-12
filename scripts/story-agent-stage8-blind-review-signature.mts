import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStage8BlindReviewSignatureWorkspace } from '../web/server/src/services/stage8-blind-review-signature-service.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.resolve(repoRoot, 'data/reports/story-agent-stage8-blind-review-signature-readiness.json');
const fixedNow = '2026-07-12T17:30:00.000Z';
const sourcePaths = [
  'data/professional-benchmarks/all-format-stage8-blind-review-trust-policy.json',
  'data/reports/story-agent-stage8-blind-review-readiness.json',
  'data/reports/story-agent-stage8-blind-review-evaluator-readiness.json',
  'web/server/src/services/stage8-blind-review-signature-service.ts',
] as const;
const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : '';
if (!mode) throw new Error('usage: story-agent-stage8-blind-review-signature.mts --write|--check');

const workspace = await getStage8BlindReviewSignatureWorkspace({ repoRoot, now: fixedNow });
const sourceBindings = await Promise.all(sourcePaths.map(async relativePath => ({
  path: relativePath,
  sha256: createHash('sha256').update(await readFile(path.resolve(repoRoot, relativePath))).digest('hex'),
})));
const report = {
  schema_version: 'story-agent-stage8-blind-review-signature-readiness/v1',
  generated_at: fixedNow,
  policy: workspace.policy,
  trust_policy: workspace.trust_policy,
  summary: {
    ...workspace.summary,
    required_role_count: 3,
    valid_signature_fixture_count_excluded_from_real_signature: 1,
    attestation_persisted_count: 0,
    signed_release_count: 0,
  },
  source_bindings: sourceBindings,
  projects: workspace.projects,
};
const expected = `${JSON.stringify(report, null, 2)}\n`;
if (mode === 'write') {
  await writeFile(reportPath, expected, 'utf8');
  console.log(JSON.stringify({ report_written: true, summary: report.summary }, null, 2));
} else {
  if (await readFile(reportPath, 'utf8') !== expected) throw new Error('stage8_blind_review_signature_readiness_stale');
  console.log(JSON.stringify({ checked: true, summary: report.summary }, null, 2));
}
