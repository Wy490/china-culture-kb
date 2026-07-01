import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planAssetSplitSuggestions } from './plan-asset-split-suggestions.js';

async function main(): Promise<void> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const report = await planAssetSplitSuggestions();
  const docsPath = path.join(repoRoot, 'docs', 'knowledge-base-asset-split-suggestions.md');
  const dataDir = path.join(repoRoot, 'data', 'reports');
  const dataPath = path.join(dataDir, 'knowledge-base-asset-split-suggestions.json');
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(docsPath, report.markdown, 'utf8');
  await fs.writeFile(dataPath, JSON.stringify({ ...report, markdown: undefined }, null, 2), 'utf8');
  console.log(JSON.stringify({
    entries_scanned: report.totals.entries_scanned,
    entries_without_asset_split: report.totals.entries_without_asset_split,
    entries_with_suggestions: report.totals.entries_with_suggestions,
    ready_for_editor_review: report.totals.ready_for_editor_review,
    needs_source_or_location_backfill: report.totals.needs_source_or_location_backfill,
    low_confidence_hold: report.totals.low_confidence_hold,
    docsPath,
    dataPath,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
