import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  buildStoryKnowledgeGenerationShadowAuditReport,
} from '../src/domains/china-culture/story-knowledge-generation-shadow-audit-service.js';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const dataRoot = resolve(repositoryRoot, 'data');
const reportPath = resolve(
  dataRoot,
  'reports/story-agent-story-knowledge-generation-shadow-v1.json',
);
const originalKbRoot = process.env.KB_ROOT;
process.env.KB_ROOT = dataRoot;

try {
  const report = await buildStoryKnowledgeGenerationShadowAuditReport();
  const reportText = `${JSON.stringify(report, null, 2)}\n`;

  if (process.argv.includes('--check')) {
    const existing = await readFile(reportPath, 'utf8').catch(() => '');
    if (existing !== reportText) {
      throw new Error(`Story knowledge generation shadow baseline is stale; rerun with --write: ${reportPath}`);
    }
  } else if (process.argv.includes('--write')) {
    if (report.status !== 'passed') {
      throw new Error('Story knowledge generation shadow gates did not pass');
    }
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, reportText, 'utf8');
  }

  console.log(JSON.stringify({
    schema_version: report.schema_version,
    status: report.status,
    report_path: reportPath,
    corpus_sha256: report.corpus_sha256,
    summary: report.summary,
    gate_checks: report.gate_checks,
    boundary: report.boundary,
  }, null, 2));
  if (report.status !== 'passed') process.exitCode = 1;
} finally {
  if (originalKbRoot === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = originalKbRoot;
}
