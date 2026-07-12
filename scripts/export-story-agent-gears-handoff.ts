import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function main(): Promise<void> {
  const projectId = process.argv[2];
  if (!projectId) {
    throw new Error('Usage: tsx scripts/export-story-agent-gears-handoff.ts <project-id>');
  }

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  process.env.KB_ROOT ||= path.join(repoRoot, 'data');
  process.env.WEB_GENERATED_ROOT ||= path.join(repoRoot, 'web', 'generated');
  const {
    exportProjectGearsExternalCallbackHandoff,
    getProjectProductionReadiness,
  } = await import(
    '../web/server/src/services/project-service.js'
  );
  const result = await exportProjectGearsExternalCallbackHandoff(projectId);
  if (!result.ok || !result.data) {
    throw new Error(result.error?.message ?? `Unable to export GEARS handoff for ${projectId}`);
  }

  const outputDir = path.join(repoRoot, 'web', 'generated', 'projects', projectId, 'production-board');
  const jsonPath = path.join(outputDir, 'gears-external-callback-handoff.json');
  const markdownPath = path.join(outputDir, 'gears-external-callback-handoff.md');
  const { markdown, ...machinePackage } = result.data;

  await fs.mkdir(outputDir, { recursive: true });
  await Promise.all([
    fs.writeFile(jsonPath, `${JSON.stringify(machinePackage, null, 2)}\n`, 'utf8'),
    fs.writeFile(markdownPath, `${markdown.trim()}\n`, 'utf8'),
  ]);

  const readiness = await getProjectProductionReadiness(projectId);
  const gearsLane = readiness.data?.lanes.find(lane => lane.key === 'gears_execution');

  console.log(JSON.stringify({
    project_id: projectId,
    json_path: path.relative(repoRoot, jsonPath),
    markdown_path: path.relative(repoRoot, markdownPath),
    pending_external_artifact_count: result.data.pending_external_artifact_count,
    local_acceptance_ready_count: result.data.local_acceptance_ready_count,
    external_ready_count: result.data.external_ready_count,
    readiness_status: readiness.data?.summary.status,
    gears_lane_status: gearsLane?.status,
    ready_without_external_gears_artifact_count:
      readiness.data?.summary.ready_without_external_gears_artifact_count,
  }, null, 2));
}

void main();
