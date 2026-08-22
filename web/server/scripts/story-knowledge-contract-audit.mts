import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  buildChinaCultureStoryKnowledgeContractMigrationAudit,
} from '../src/domains/china-culture/story-knowledge-contract-audit-service.js';

const repositoryRoot = resolve(import.meta.dirname, '..', '..', '..');
const dataRoot = resolve(repositoryRoot, 'data');
const reportPath = resolve(
  dataRoot,
  'reports',
  'story-agent-knowledge-contract-v1-audit.json',
);
const originalKbRoot = process.env.KB_ROOT;
process.env.KB_ROOT = dataRoot;

try {
  const checkOnly = process.argv.includes('--check');
  const existingText = checkOnly
    ? await readFile(reportPath, 'utf8').catch(() => '')
    : '';
  if (checkOnly && !existingText) {
    throw new Error(`Story knowledge contract audit baseline is missing: ${reportPath}`);
  }
  const existingGeneratedAt = checkOnly
    ? (JSON.parse(existingText) as { generated_at?: unknown }).generated_at
    : undefined;
  if (checkOnly && typeof existingGeneratedAt !== 'string') {
    throw new Error(`Story knowledge contract audit baseline has no generated_at: ${reportPath}`);
  }

  const report = await buildChinaCultureStoryKnowledgeContractMigrationAudit(
    typeof existingGeneratedAt === 'string' ? existingGeneratedAt : undefined,
  );
  const reportText = `${JSON.stringify(report, null, 2)}\n`;
  if (checkOnly) {
    if (existingText !== reportText) {
      throw new Error(`Story knowledge contract audit baseline is stale; rerun without --check: ${reportPath}`);
    }
  } else {
    await mkdir(resolve(dataRoot, 'reports'), { recursive: true });
    await writeFile(reportPath, reportText, 'utf8');
  }
  console.log(JSON.stringify({
    schema_version: report.schema_version,
    status: report.status,
    report_path: reportPath,
    totals: report.totals,
    missing_category_counts: report.missing_category_counts,
    invariants: report.invariants,
    boundary: report.boundary,
  }, null, 2));
  if (report.status === 'blocked') process.exitCode = 1;
} finally {
  if (originalKbRoot === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = originalKbRoot;
}
