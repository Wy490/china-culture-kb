import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatProductionMaterialDraftCliError,
  loadProductionMaterialSourceObservationsFile,
} from '../lib/production-material-source-observations.js';
import { draftProductionMaterialPack } from './draft-production-material-pack.js';

async function main(): Promise<void> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const videoType = argValue('--video-type') || process.env.VIDEO_TYPE || 'explainer_video';
  const sourceDomain = argValue('--source-domain') || process.env.SOURCE_DOMAIN;
  const label = argValue('--label');
  const goal = argValue('--goal');
  const observationsPath = argValue('--observations-json');
  const additionalObservations = observationsPath
    ? await loadProductionMaterialSourceObservationsFile(path.resolve(process.cwd(), observationsPath))
    : undefined;
  const report = await draftProductionMaterialPack({
    videoType,
    sourceDomain,
    label,
    goal,
    additionalObservations,
  });
  const safeVideoType = videoType.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const safeSourceDomain = sourceDomain?.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const outputStem = `production-material-pack-draft-${safeVideoType}${safeSourceDomain ? `-${safeSourceDomain}` : ''}`;
  const docsPath = path.join(repoRoot, 'docs', `${outputStem}.md`);
  const dataDir = path.join(repoRoot, 'data', 'reports');
  const dataPath = path.join(dataDir, `${outputStem}.json`);

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(docsPath, report.markdown, 'utf8');
  await fs.writeFile(dataPath, JSON.stringify({ ...report, markdown: undefined }, null, 2), 'utf8');
  console.log(JSON.stringify({
    video_type: report.video_type,
    source_domain: report.source_domain,
    status: report.status,
    source_count: report.source_count,
    required_fields: report.draft_pack.material_template.required_fields.length,
    docsPath,
    dataPath,
  }, null, 2));
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

main().catch(error => {
  console.error(formatProductionMaterialDraftCliError(error));
  process.exit(1);
});
