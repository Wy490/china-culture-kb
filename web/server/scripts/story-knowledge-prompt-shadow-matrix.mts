import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStoryKnowledgePromptShadowMatrixReport } from '../src/domains/china-culture/story-knowledge-prompt-shadow-matrix-service.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDir, '..', '..', '..');
const reportPath = resolve(
  repositoryRoot,
  'data/reports/story-agent-story-knowledge-prompt-shadow-matrix-v1.json',
);
const writeMode = process.argv.includes('--write');
const checkMode = process.argv.includes('--check');
if (writeMode === checkMode) {
  throw new Error('Pass exactly one of --write or --check');
}

process.env.KB_ROOT = resolve(repositoryRoot, 'data');
const report = await buildStoryKnowledgePromptShadowMatrixReport();
if (report.status !== 'passed') {
  throw new Error('Story knowledge prompt shadow matrix did not pass all gates');
}
const bytes = `${JSON.stringify(report, null, 2)}\n`;

if (writeMode) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, bytes, 'utf8');
  console.log(`Wrote ${reportPath}`);
} else {
  const existing = await readFile(reportPath, 'utf8');
  if (existing !== bytes) {
    throw new Error(`Prompt shadow matrix report is stale: ${reportPath}`);
  }
  console.log(`Verified ${reportPath}`);
}

console.log(JSON.stringify({
  status: report.status,
  summary: report.summary,
  gate_checks: report.gate_checks,
  boundary: report.boundary,
}, null, 2));
