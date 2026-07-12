import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildStage6RealRevisionExitAudit,
  validateStage6RealRevisionExitAudit,
  type Stage6RealRevisionExitAuditReport,
} from '../web/server/src/services/stage6-real-revision-exit-audit-service.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.join(repoRoot, 'data/reports/story-agent-stage6-p3-real-revision-exit-audit.json');

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

async function main(): Promise<void> {
  const write = process.argv.includes('--write');
  const check = process.argv.includes('--check');
  const current = await buildStage6RealRevisionExitAudit({ repoRoot });
  const currentErrors = validateStage6RealRevisionExitAudit(current);
  if (currentErrors.length > 0) throw new Error(`Stage 6 P3 exit audit invalid: ${currentErrors.join(',')}`);

  if (write) {
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
  }

  if (check) {
    const stored = await readJson<Stage6RealRevisionExitAuditReport>(reportPath);
    const storedErrors = validateStage6RealRevisionExitAudit(stored);
    if (storedErrors.length > 0) throw new Error(`Stored Stage 6 P3 exit audit invalid: ${storedErrors.join(',')}`);
    if (JSON.stringify({ ...stored, generated_at: '' }) !== JSON.stringify({ ...current, generated_at: '' })) {
      throw new Error('Stage 6 P3 exit audit is stale for current P0/P1/P2 evidence');
    }
    if (stored.summary.professional_pass_count !== 0) {
      throw new Error('Stage 6 P3 exit audit cannot grant professional pass');
    }
  }

  console.log(JSON.stringify({
    written: write,
    checked: check,
    report_path: path.relative(repoRoot, reportPath),
    summary: current.summary,
  }, null, 2));
}

void main();
