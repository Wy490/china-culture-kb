import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanImportResidue } from './clean-import-residue.js';

function parseArgs(argv: string[]): { apply: boolean; provinces?: string[] } {
  const apply = argv.includes('--apply');
  const provinceArg = argv.find(arg => arg.startsWith('--provinces='));
  const provinces = provinceArg
    ? provinceArg.replace(/^--provinces=/, '').split(',').map(item => item.trim()).filter(Boolean)
    : undefined;
  return { apply, provinces };
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const { apply, provinces } = parseArgs(process.argv.slice(2));
  const report = await cleanImportResidue({ apply, provinces });
  const docsPath = path.join(repoRoot, 'docs', 'knowledge-base-import-residue-cleanup.md');
  const dataDir = path.join(repoRoot, 'data', 'reports');
  const dataPath = path.join(dataDir, 'knowledge-base-import-residue-cleanup.json');
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(docsPath, report.markdown, 'utf8');
  await fs.writeFile(dataPath, JSON.stringify({ ...report, markdown: undefined }, null, 2), 'utf8');
  console.log(JSON.stringify({
    apply: report.apply,
    files_scanned: report.totals.files_scanned,
    files_changed: report.totals.files_changed,
    entries_changed: report.totals.entries_changed,
    removed_invalid_source_lines: report.totals.removed_invalid_source_lines,
    removed_invalid_location_lines: report.totals.removed_invalid_location_lines,
    docsPath,
    dataPath,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
