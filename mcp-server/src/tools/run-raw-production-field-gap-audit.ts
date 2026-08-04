import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditRawProductionFieldGaps } from './audit-raw-production-field-gaps.js';

async function main(): Promise<void> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const report = await auditRawProductionFieldGaps();
  const docsPath = path.join(repoRoot, 'docs', 'knowledge-base-raw-production-field-gap-governance.md');
  const dataPath = path.join(repoRoot, 'data', 'reports', 'knowledge-base-raw-production-field-gap-governance.json');
  const checkOnly = process.argv.includes('--check');
  if (checkOnly) {
    const current = JSON.parse(await fs.readFile(dataPath, 'utf8')) as Record<string, unknown>;
    const expected = { ...report, generated_at: undefined, markdown: undefined };
    const actual = { ...current, generated_at: undefined };
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error('Raw production field gap governance report is stale; rerun without --check.');
    }
  } else {
    await fs.mkdir(path.dirname(dataPath), { recursive: true });
    await fs.writeFile(docsPath, report.markdown, 'utf8');
    await fs.writeFile(dataPath, JSON.stringify({ ...report, markdown: undefined }, null, 2), 'utf8');
  }
  console.log(JSON.stringify({
    status: 'passed',
    mode: checkOnly ? 'check' : 'write',
    raw_gap_count: report.totals.raw_gap_count,
    affected_entry_count: report.totals.affected_entry_count,
    recovered_from_raw_markdown: report.totals.source_authored_fields_recovered_from_raw_markdown,
    docsPath,
    dataPath,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
