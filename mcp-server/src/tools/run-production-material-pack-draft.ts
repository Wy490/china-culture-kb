import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { draftProductionMaterialPack } from './draft-production-material-pack.js';

async function main(): Promise<void> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const videoType = argValue('--video-type') || process.env.VIDEO_TYPE || 'explainer_video';
  const label = argValue('--label');
  const goal = argValue('--goal');
  const observationsPath = argValue('--observations-json');
  const additionalObservations = observationsPath
    ? JSON.parse(await fs.readFile(path.resolve(process.cwd(), observationsPath), 'utf8'))
    : undefined;
  const report = await draftProductionMaterialPack({
    videoType,
    label,
    goal,
    additionalObservations,
  });
  const safeVideoType = videoType.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const docsPath = path.join(repoRoot, 'docs', `production-material-pack-draft-${safeVideoType}.md`);
  const dataDir = path.join(repoRoot, 'data', 'reports');
  const dataPath = path.join(dataDir, `production-material-pack-draft-${safeVideoType}.json`);

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(docsPath, report.markdown, 'utf8');
  await fs.writeFile(dataPath, JSON.stringify({ ...report, markdown: undefined }, null, 2), 'utf8');
  console.log(JSON.stringify({
    video_type: report.video_type,
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
  console.error(error);
  process.exit(1);
});
