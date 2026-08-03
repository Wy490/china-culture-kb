import { mkdir, writeFile } from 'node:fs/promises';
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
  const report = await buildChinaCultureStoryKnowledgeContractMigrationAudit();
  await mkdir(resolve(dataRoot, 'reports'), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
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
