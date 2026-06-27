import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditProductionMaterials } from './audit-production-materials.js';

async function main(): Promise<void> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const report = await auditProductionMaterials();
  const docsPath = path.join(repoRoot, 'docs', 'knowledge-base-production-audit.md');
  const dataDir = path.join(repoRoot, 'data', 'reports');
  const dataPath = path.join(dataDir, 'knowledge-base-production-audit.json');
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(docsPath, report.markdown, 'utf8');
  await fs.writeFile(dataPath, JSON.stringify({ ...report, markdown: undefined }, null, 2), 'utf8');
  console.log(JSON.stringify({
    entries: report.totals.entries,
    missing_verification_method: report.totals.missing_verification_method,
    entries_with_asset_split: report.totals.entries_with_asset_split,
    docsPath,
    dataPath,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
