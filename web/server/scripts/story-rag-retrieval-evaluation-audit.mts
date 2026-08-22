import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  StoryRetrievalEvaluationDatasetSchema,
  buildChinaCultureStoryRetrievalEvaluationReport,
} from '../src/domains/china-culture/story-retrieval-evaluation-service.js';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const dataRoot = resolve(repositoryRoot, 'data');
const fixturePath = resolve(
  dataRoot,
  'fixtures/story-agent-rag-retrieval-evaluation-v1.json',
);
const reportPath = resolve(
  dataRoot,
  'reports/story-agent-rag-retrieval-evaluation-v1.json',
);
const originalKbRoot = process.env.KB_ROOT;
process.env.KB_ROOT = dataRoot;

try {
  const dataset = StoryRetrievalEvaluationDatasetSchema.parse(
    JSON.parse(await readFile(fixturePath, 'utf8')),
  );
  const report = await buildChinaCultureStoryRetrievalEvaluationReport(dataset);
  const reportText = `${JSON.stringify(report, null, 2)}\n`;

  if (process.argv.includes('--check')) {
    const existing = await readFile(reportPath, 'utf8').catch(() => '');
    if (existing !== reportText) {
      throw new Error(`Story RAG retrieval evaluation baseline is stale; rerun with --write: ${reportPath}`);
    }
  } else if (process.argv.includes('--write')) {
    if (report.status !== 'passed') {
      throw new Error('Story RAG retrieval evaluation quality gates did not pass');
    }
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, reportText, 'utf8');
  }

  console.log(JSON.stringify({
    schema_version: report.schema_version,
    benchmark_id: report.benchmark_id,
    status: report.status,
    fixture_path: fixturePath,
    report_path: reportPath,
    dataset_sha256: report.dataset_sha256,
    corpus_sha256: report.corpus_sha256,
    metrics: report.metrics,
    gate_checks: report.gate_checks,
    boundary: report.boundary,
  }, null, 2));
  if (report.status !== 'passed') process.exitCode = 1;
} finally {
  if (originalKbRoot === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = originalKbRoot;
}
