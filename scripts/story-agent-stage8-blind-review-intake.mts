import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStage8BlindReviewWorkspace } from '../web/server/src/services/stage8-blind-review-intake-service.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatePath = path.resolve(repoRoot, 'data/professional-benchmarks/all-format-stage8-blind-review-operator-template.json');
const reportPath = path.resolve(repoRoot, 'data/reports/story-agent-stage8-blind-review-readiness.json');
const fixedNow = '2026-07-12T16:00:00.000Z';
const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : '';

if (!mode) throw new Error('usage: story-agent-stage8-blind-review-intake.mts --write|--check');

const workspace = await getStage8BlindReviewWorkspace({ repoRoot, now: fixedNow });
const expectedTemplate = `${JSON.stringify(workspace.template, null, 2)}\n`;
const expectedReport = `${JSON.stringify(workspace.template_validation.report, null, 2)}\n`;

if (mode === 'write') {
  await Promise.all([
    writeFile(templatePath, expectedTemplate, 'utf8'),
    writeFile(reportPath, expectedReport, 'utf8'),
  ]);
  console.log(JSON.stringify({
    template_written: true,
    report_written: true,
    project_count: workspace.template.projects.length,
    summary: workspace.template_validation.report.summary,
  }, null, 2));
} else {
  const [actualTemplate, actualReport] = await Promise.all([
    readFile(templatePath, 'utf8'),
    readFile(reportPath, 'utf8'),
  ]);
  if (actualTemplate !== expectedTemplate) throw new Error('stage8_blind_review_operator_template_stale');
  if (actualReport !== expectedReport) throw new Error('stage8_blind_review_readiness_report_stale');
  console.log(JSON.stringify({
    checked: true,
    project_count: workspace.template.projects.length,
    summary: workspace.template_validation.report.summary,
  }, null, 2));
}
