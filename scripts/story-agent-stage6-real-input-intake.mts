import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Stage6RealInputIntake, Stage6RealInputReadinessReport } from '../web/shared/types.js';
import {
  buildStage6RealInputOperatorTemplate,
  validateStage6RealInputIntake,
  validateStage6RealInputReadinessReport,
} from '../web/server/src/services/professional-multi-round-revision-intake-service.js';
import type { MultiRoundRevisionSpecRegistry } from '../web/server/src/services/professional-multi-round-revision-execution-service.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(repoRoot, 'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json');
const templatePath = path.join(repoRoot, 'data/professional-benchmarks/all-format-stage6-p0-real-input-operator-template.json');
const defaultReportPath = path.join(repoRoot, 'data/reports/story-agent-stage6-p0-project-readiness.json');

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main(): Promise<void> {
  const registry = await readJson<MultiRoundRevisionSpecRegistry>(registryPath);
  const writeTemplate = process.argv.includes('--write-template');
  const check = process.argv.includes('--check');
  const requestedInput = argumentValue('--input');
  const requestedReport = argumentValue('--report');

  if (writeTemplate) {
    await writeJson(templatePath, buildStage6RealInputOperatorTemplate(registry));
  }

  const inputPath = requestedInput
    ? path.resolve(repoRoot, requestedInput)
    : templatePath;
  const intake = await readJson<Stage6RealInputIntake>(inputPath);
  const report = validateStage6RealInputIntake({
    intake,
    registry,
    repoRoot,
    sourceIntakePath: path.relative(repoRoot, inputPath),
  });

  if (requestedReport || writeTemplate) {
    const reportPath = requestedReport ? path.resolve(repoRoot, requestedReport) : defaultReportPath;
    await writeJson(reportPath, report);
  }

  if (check) {
    const storedReport = await readJson<Stage6RealInputReadinessReport>(requestedReport
      ? path.resolve(repoRoot, requestedReport)
      : defaultReportPath);
    const errors = validateStage6RealInputReadinessReport(storedReport);
    if (errors.length > 0) throw new Error(`Stage 6 readiness report invalid: ${errors.join(',')}`);
    if (storedReport.summary.project_count !== 15
      || storedReport.summary.completed_verified_revision_round_count !== 0
      || storedReport.summary.professional_pass_count !== 0) {
      throw new Error('Stage 6 readiness report violates zero-credit intake policy');
    }
    const comparableStored = { ...storedReport, generated_at: '' };
    const comparableCurrent = { ...report, generated_at: '' };
    if (JSON.stringify(comparableStored) !== JSON.stringify(comparableCurrent)) {
      throw new Error('Stage 6 readiness report is stale for the current intake or registry');
    }
  }

  console.log(JSON.stringify({
    input_path: path.relative(repoRoot, inputPath),
    template_written: writeTemplate,
    report_written: Boolean(requestedReport || writeTemplate),
    summary: report.summary,
    global_error_count: report.global_errors.length,
  }, null, 2));
}

void main();
