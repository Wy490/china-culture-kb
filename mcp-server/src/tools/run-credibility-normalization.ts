import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCredibilitySections } from './normalize-credibility-sections.js';

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
  const report = await normalizeCredibilitySections({ apply, provinces });
  const docsPath = path.join(repoRoot, 'docs', 'knowledge-base-credibility-normalization.md');
  const dataDir = path.join(repoRoot, 'data', 'reports');
  const dataPath = path.join(dataDir, 'knowledge-base-credibility-normalization.json');
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(docsPath, report.markdown, 'utf8');
  await fs.writeFile(dataPath, JSON.stringify({ ...report, markdown: undefined }, null, 2), 'utf8');
  console.log(JSON.stringify({
    apply: report.apply,
    files_scanned: report.totals.files_scanned,
    files_changed: report.totals.files_changed,
    entries_changed: report.totals.entries_changed,
    docsPath,
    dataPath,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
