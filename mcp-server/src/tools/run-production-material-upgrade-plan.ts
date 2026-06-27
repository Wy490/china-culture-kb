import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planProductionMaterialUpgrade } from './plan-production-material-upgrade.js';

async function main(): Promise<void> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const plan = await planProductionMaterialUpgrade();
  const docsPath = path.join(repoRoot, 'docs', 'knowledge-base-production-upgrade-plan.md');
  const dataDir = path.join(repoRoot, 'data', 'reports');
  const dataPath = path.join(dataDir, 'knowledge-base-production-upgrade-plan.json');
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(docsPath, plan.markdown, 'utf8');
  await fs.writeFile(dataPath, JSON.stringify({ ...plan, markdown: undefined }, null, 2), 'utf8');
  console.log(JSON.stringify({
    batches: plan.summary.planned_batches,
    actions: plan.summary.planned_entry_actions,
    format_only_actions: plan.summary.format_only_actions,
    docsPath,
    dataPath,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
