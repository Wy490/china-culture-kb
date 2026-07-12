import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStage8DurableReleaseWorkspace } from '../web/server/src/services/stage8-durable-release-service.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.resolve(repoRoot, 'data/reports/story-agent-stage8-durable-release-readiness.json');
const templatePath = path.resolve(repoRoot, 'data/professional-benchmarks/all-format-stage8-durable-release-operator-template.json');
const fixedNow = '2026-07-12T20:00:00.000Z';
const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : '';
if (!mode) throw new Error('usage: story-agent-stage8-durable-release.mts --write|--check');

const workspace = await getStage8DurableReleaseWorkspace({ repoRoot, now: fixedNow });
const operatorTemplate = {
  schema_version: 'story-agent-stage8-durable-release-operator-template/v1', generated_at: fixedNow, provenance: 'preparation_template',
  policy: workspace.policy,
  authority_registry_file: 'data/professional-benchmarks/all-format-stage8-release-authority-registry.json',
  projects: workspace.projects.map(project => ({ benchmark_id: project.benchmark_id, video_type: project.video_type, source_entry: project.source_entry,
    finalization_decision_file: '', durable_release_record_file: '', external_durability_reference: '', operator_verified: false,
    release_record_imported: false, professional_passed: false })),
};
const sourcePaths = [
  'web/server/src/services/stage8-durable-release-service.ts',
  'web/server/src/services/professional-benchmark-finalization-service.ts',
  'data/reports/story-agent-stage8-finalization-preflight-readiness.json',
  'data/professional-benchmarks/all-format-stage8-release-authority-registry.json',
] as const;
const sourceBindings = await Promise.all(sourcePaths.map(async relativePath => ({ path: relativePath,
  sha256: createHash('sha256').update(await readFile(path.resolve(repoRoot, relativePath))).digest('hex') })));
const report = { schema_version: 'story-agent-stage8-durable-release-readiness/v1', generated_at: fixedNow,
  policy: workspace.policy, authority_registry: workspace.authority_registry, summary: workspace.summary,
  source_bindings: sourceBindings, projects: workspace.projects };
const templateExpected = `${JSON.stringify(operatorTemplate, null, 2)}\n`;
const reportExpected = `${JSON.stringify(report, null, 2)}\n`;
if (mode === 'write') {
  await writeFile(templatePath, templateExpected, 'utf8'); await writeFile(reportPath, reportExpected, 'utf8');
  console.log(JSON.stringify({ template_written: true, report_written: true, summary: report.summary }, null, 2));
} else {
  if (await readFile(templatePath, 'utf8') !== templateExpected) throw new Error('stage8_durable_release_operator_template_stale');
  if (await readFile(reportPath, 'utf8') !== reportExpected) throw new Error('stage8_durable_release_readiness_stale');
  console.log(JSON.stringify({ checked: true, summary: report.summary }, null, 2));
}
