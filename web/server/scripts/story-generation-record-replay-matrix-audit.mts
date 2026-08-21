import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildStoryGenerationRecordReplayMatrixReport,
} from '../src/services/story-generation-record-replay-matrix-service.js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../../..');
const reportPath = resolve(
  repositoryRoot,
  'data/reports/story-agent-story-generation-record-replay-matrix.json',
);
const fixtureRoot = await mkdtemp(join(tmpdir(), 'story-generation-replay-matrix-'));

try {
  const report = await buildStoryGenerationRecordReplayMatrixReport({
    fixtureRoot,
    knowledgeRoot: resolve(repositoryRoot, 'data'),
  });
  const reportText = `${JSON.stringify(report, null, 2)}\n`;
  const checkOnly = process.argv.includes('--check');

  if (checkOnly) {
    const existing = await readFile(reportPath, 'utf8').catch(() => '');
    if (existing !== reportText) {
      throw new Error(`Story generation record replay matrix report is stale: ${reportPath}`);
    }
  } else {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, reportText, 'utf8');
  }

  console.log(JSON.stringify({
    status: report.status,
    report_path: reportPath,
    summary: report.summary,
    boundaries: report.boundaries,
  }, null, 2));
  if (report.status !== 'passed') process.exitCode = 1;
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
