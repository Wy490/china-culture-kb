import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStoryGenreCompositionMatrixReport } from '../src/services/story-genre-composition-matrix-service.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDir, '../../..');
const reportPath = resolve(
  repositoryRoot,
  'data/reports/story-agent-story-genre-composition-matrix.json',
);
const reportText = `${JSON.stringify(buildStoryGenreCompositionMatrixReport(), null, 2)}\n`;
const checkOnly = process.argv.includes('--check');

if (checkOnly) {
  const existing = await readFile(reportPath, 'utf8').catch(() => '');
  if (existing !== reportText) {
    throw new Error(`Story genre composition matrix report is stale: ${reportPath}`);
  }
} else {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, reportText, 'utf8');
}

const report = JSON.parse(reportText) as ReturnType<typeof buildStoryGenreCompositionMatrixReport>;
console.log(JSON.stringify({
  status: report.status,
  report_path: reportPath,
  summary: report.summary,
  boundaries: report.boundaries,
}, null, 2));

if (report.status !== 'passed') process.exitCode = 1;
