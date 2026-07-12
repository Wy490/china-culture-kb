import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStage8FinalizationPreflightWorkspace } from '../web/server/src/services/stage8-finalization-preflight-service.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.resolve(repoRoot, 'data/reports/story-agent-stage8-finalization-preflight-readiness.json');
const templatePath = path.resolve(repoRoot, 'data/professional-benchmarks/all-format-stage8-finalization-operator-template.json');
const fixedNow = '2026-07-12T18:00:00.000Z';
const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : '';
if (!mode) throw new Error('usage: story-agent-stage8-finalization-preflight.mts --write|--check');

const workspace = await getStage8FinalizationPreflightWorkspace({ repoRoot, now: fixedNow });
const operatorTemplate = {
  schema_version: 'story-agent-stage8-finalization-operator-template/v1', generated_at: fixedNow, provenance: 'preparation_template',
  policy: workspace.policy,
  projects: workspace.projects.map(project => ({ benchmark_id: project.benchmark_id, video_type: project.video_type, source_entry: project.source_entry,
    finalization_input_file: '', external_trust_policy_file: 'data/professional-benchmarks/all-format-stage8-finalization-trust-policy.json',
    signed_release_record_file: '', operator_verified: false, professional_passed: false })),
};
const templateExpected = `${JSON.stringify(operatorTemplate, null, 2)}\n`;
const sourcePaths = ['web/server/src/services/professional-benchmark-finalization-service.ts', 'web/server/src/services/stage8-finalization-preflight-service.ts',
  'data/reports/story-agent-stage8-blind-review-readiness.json', 'data/reports/story-agent-stage8-blind-review-evaluator-readiness.json',
  'data/reports/story-agent-stage8-blind-review-signature-readiness.json', 'data/professional-benchmarks/all-format-stage8-finalization-trust-policy.json'] as const;
const sourceBindings = await Promise.all(sourcePaths.map(async relativePath => ({ path: relativePath,
  sha256: createHash('sha256').update(await readFile(path.resolve(repoRoot, relativePath))).digest('hex') })));
const report = { schema_version: 'story-agent-stage8-finalization-preflight-readiness/v1', generated_at: fixedNow, policy: workspace.policy,
  trust_policy: workspace.trust_policy, summary: workspace.summary, source_bindings: sourceBindings, projects: workspace.projects };
const reportExpected = `${JSON.stringify(report, null, 2)}\n`;
if (mode === 'write') {
  await writeFile(templatePath, templateExpected, 'utf8'); await writeFile(reportPath, reportExpected, 'utf8');
  console.log(JSON.stringify({ template_written: true, report_written: true, summary: report.summary }, null, 2));
} else {
  if (await readFile(templatePath, 'utf8') !== templateExpected) throw new Error('stage8_finalization_operator_template_stale');
  if (await readFile(reportPath, 'utf8') !== reportExpected) throw new Error('stage8_finalization_preflight_readiness_stale');
  console.log(JSON.stringify({ checked: true, summary: report.summary }, null, 2));
}
