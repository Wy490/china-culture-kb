import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  STORY_AGENT_15_TYPE_MATRIX_CASES,
  storyAgentMatrixGenerationRequest,
} from '../src/services/story-agent-15-type-matrix-service.js';
import { buildStoryDomainPack15TypeComparison } from '../src/services/story-domain-pack-comparison-service.js';

const repositoryRoot = resolve(import.meta.dirname, '..', '..', '..');
const reportPath = resolve(
  repositoryRoot,
  'data',
  'reports',
  'story-agent-writing-capability-m3-domain-pack-15-type-comparison.json',
);
const originalKbRoot = process.env.KB_ROOT;
process.env.KB_ROOT = resolve(repositoryRoot, 'data');

try {
  const report = await buildStoryDomainPack15TypeComparison({
    generatedAt: '2026-08-04T00:00:00.000+08:00',
    cases: STORY_AGENT_15_TYPE_MATRIX_CASES.map(matrixCase => ({
      case_id: `canonical-${matrixCase.video_type}`,
      request: storyAgentMatrixGenerationRequest(matrixCase),
    })),
  });

  if (report.status !== 'passed') {
    throw new Error(`Domain Pack 15-type comparison failed: ${report.failed_invariants.join(', ')}`);
  }

  if (process.argv.includes('--write')) {
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  if (process.argv.includes('--check')) {
    const written = JSON.parse(await readFile(reportPath, 'utf8')) as unknown;
    if (JSON.stringify(written) !== JSON.stringify(report)) {
      throw new Error('Domain Pack 15-type comparison baseline is stale; run with --write');
    }
  }

  console.log(JSON.stringify({ ...report, report_path: reportPath }, null, 2));
} finally {
  if (originalKbRoot === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = originalKbRoot;
}
