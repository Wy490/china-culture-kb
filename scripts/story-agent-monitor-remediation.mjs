import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const generatedRoot = path.join(repoRoot, 'web', 'generated');
const seriesRoot = path.join(generatedRoot, 'ai-comic-series-projects');
const storiesRoot = path.join(generatedRoot, 'stories');
const shouldWrite = process.argv.includes('--write');

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function stringValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function readJson(filePath) {
  try {
    const value = JSON.parse(await fs.readFile(filePath, 'utf8'));
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

async function listJsonFiles(rootPath) {
  const files = [];
  async function visit(currentPath) {
    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.isFile() && entry.name.endsWith('.json')) files.push(entryPath);
    }
  }
  await visit(rootPath);
  return files.sort();
}

function generatedEpisodeStoryIds(record) {
  const value = record.generated_episode_story_ids;
  if (Array.isArray(value)) return value.map(stringValue).filter(Boolean);
  if (isRecord(value)) return Object.values(value).map(stringValue).filter(Boolean);
  return [];
}

function projectRecord(record) {
  return isRecord(record.project) ? record.project : record;
}

function planRecord(record) {
  return isRecord(record.plan) ? record.plan : {};
}

function ledgerUsable(ledger) {
  if (!isRecord(ledger)) return false;
  return ledger.status === 'ready' || ledger.status === 'planned';
}

function hasPathLikeOutput(ledger, fields) {
  return isRecord(ledger) && fields.some(field => Boolean(stringValue(ledger[field])));
}

function failureIsMarkedTestFixture(item) {
  const failureReason = stringValue(item.failure_reason) ?? '';
  const noteText = asArray(item.notes).map(stringValue).filter(Boolean).join(' ');
  return failureReason.includes('测试标记')
    || noteText.includes('测试标记')
    || (stringValue(item.provider_job_id) === 'seedance-job-failed' && noteText.includes('测试'));
}

function containsExactStorySnapshot(value, storyId, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  if (isRecord(value)) {
    const candidateId = stringValue(value.storyId ?? value.story_id);
    const hasStoryBody = Boolean(stringValue(value.full_text))
      || asArray(value.scene_breakdown).length > 0
      || asArray(value.gears_segments).length > 0;
    if (candidateId === storyId && hasStoryBody) return true;
    return Object.values(value).some(item => containsExactStorySnapshot(item, storyId, seen));
  }
  return value.some(item => containsExactStorySnapshot(item, storyId, seen));
}

function stableStorySuffix(storyId) {
  return storyId.replace(/^\d{8}-/, '');
}

function seriesAuditItem(dirName, record, availableStoryIds, availableStoryIdsBySuffix) {
  const project = projectRecord(record);
  const plan = planRecord(record);
  const projectId = stringValue(
    record.series_project_id
      ?? record.project_id
      ?? project.series_project_id
      ?? project.project_id
      ?? project.id,
  ) ?? dirName;
  const title = stringValue(record.title ?? project.title ?? plan.series_title ?? project.name);
  const storyIds = generatedEpisodeStoryIds(record);
  const missingStoryIds = storyIds.filter(storyId => !availableStoryIds.has(storyId));
  const productionItems = asArray(isRecord(record.seedance_production) ? record.seedance_production.items : undefined)
    .filter(isRecord);
  const readyProductionItems = productionItems.filter(item =>
    item.status === 'ready'
    && (
      Boolean(stringValue(item.video_url))
      || asArray(item.versions).filter(isRecord).some(version =>
        version.status === 'ready' && Boolean(stringValue(version.video_url)),
      )
    ),
  );
  const failedProductionItems = productionItems.filter(item => item.status === 'failed');
  const testFixtureFailureItems = failedProductionItems.filter(failureIsMarkedTestFixture);
  const thumbnailReadyCount = productionItems.filter(item => {
    const thumbnail = isRecord(item.thumbnail) ? item.thumbnail : undefined;
    return thumbnail?.status === 'ready' && Boolean(stringValue(thumbnail.output_path));
  }).length;
  const cutLedger = isRecord(record.seedance_cut_assembly) ? record.seedance_cut_assembly : undefined;
  const subtitleLedger = isRecord(record.seedance_subtitle_render) ? record.seedance_subtitle_render : undefined;
  const finalLedger = isRecord(record.seedance_final_delivery) ? record.seedance_final_delivery : undefined;
  const cutReady = ledgerUsable(cutLedger) && hasPathLikeOutput(cutLedger, ['output_path', 'concat_list_path']);
  const subtitleReady = ledgerUsable(subtitleLedger) && hasPathLikeOutput(subtitleLedger, ['output_path', 'srt_path']);
  const finalDeliveryOutputDeclared = ledgerUsable(finalLedger) && hasPathLikeOutput(finalLedger, ['output_path']);
  const finalDeliveryManifestReady = ledgerUsable(finalLedger) && hasPathLikeOutput(finalLedger, ['manifest_path']);
  const finalDeliveryReady = finalDeliveryOutputDeclared && finalDeliveryManifestReady;
  const finalDeliveryManifestMissing = finalDeliveryOutputDeclared && !finalDeliveryManifestReady;
  const contractEvidence = [
    productionItems.length > 0 ? 'seedance_production' : '',
    isRecord(record.gears_job_ledger) ? 'gears_job_ledger' : '',
    thumbnailReadyCount > 0 ? 'thumbnails' : '',
    cutReady ? 'cut_assembly' : '',
    subtitleReady ? 'subtitle_render' : '',
    finalDeliveryReady ? 'final_delivery' : finalDeliveryOutputDeclared ? 'final_delivery_plan' : '',
  ].filter(Boolean);
  const embeddedSnapshotStoryIds = missingStoryIds.filter(storyId => containsExactStorySnapshot(record, storyId));
  const unresolvedStoryIds = missingStoryIds.filter(storyId => !embeddedSnapshotStoryIds.includes(storyId));
  const potentialSuffixMatches = missingStoryIds.flatMap(storyId => {
    const candidateStoryIds = availableStoryIdsBySuffix.get(stableStorySuffix(storyId)) ?? [];
    return candidateStoryIds.length ? [{ missing_story_id: storyId, candidate_story_ids: candidateStoryIds }] : [];
  });

  return {
    project_id: projectId,
    title,
    created_at: stringValue(project.created_at ?? record.created_at),
    updated_at: stringValue(project.updated_at ?? record.updated_at),
    generated_episode_story_ids: storyIds,
    missing_story_ids: missingStoryIds,
    missing_story_id_count: missingStoryIds.length,
    contract_evidence: contractEvidence,
    contract_evidence_count: contractEvidence.length,
    production_item_count: productionItems.length,
    ready_production_item_count: readyProductionItems.length,
    failed_production_item_count: failedProductionItems.length,
    test_fixture_failure_item_count: testFixtureFailureItems.length,
    unmarked_failure_item_count: failedProductionItems.length - testFixtureFailureItems.length,
    seedance_failure_marker_present: JSON.stringify(record).includes('seedance-job-failed'),
    final_delivery_ready: finalDeliveryReady,
    final_delivery_manifest_ready: finalDeliveryManifestReady,
    final_delivery_manifest_missing: finalDeliveryManifestMissing,
    final_delivery_dry_run: finalLedger?.dry_run === true,
    embedded_snapshot_story_ids: embeddedSnapshotStoryIds,
    unresolved_story_ids: unresolvedStoryIds,
    potential_suffix_matches: potentialSuffixMatches,
    auto_recovery_safe: missingStoryIds.length > 0 && unresolvedStoryIds.length === 0,
  };
}

const storyFiles = await listJsonFiles(storiesRoot);
const availableStoryIds = new Set(storyFiles.map(filePath => path.basename(filePath, '.json')));
const availableStoryIdsBySuffix = new Map();
for (const storyId of availableStoryIds) {
  const suffix = stableStorySuffix(storyId);
  availableStoryIdsBySuffix.set(suffix, [...(availableStoryIdsBySuffix.get(suffix) ?? []), storyId].sort());
}
const seriesEntries = await fs.readdir(seriesRoot, { withFileTypes: true });
const seriesRecords = [];
for (const entry of seriesEntries.sort((a, b) => a.name.localeCompare(b.name))) {
  if (!entry.isDirectory()) continue;
  const record = await readJson(path.join(seriesRoot, entry.name, 'project.json'));
  if (record) seriesRecords.push(seriesAuditItem(entry.name, record, availableStoryIds, availableStoryIdsBySuffix));
}

const interrupted = seriesRecords.filter(item => item.missing_story_id_count > 0);
const relinkCandidates = interrupted.filter(item => item.contract_evidence_count > 0);
const archiveOrRebuildCandidates = interrupted.filter(item => item.contract_evidence_count === 0);
const failedProjects = seriesRecords.filter(item => item.failed_production_item_count > 0);
const testFixtureFailureProjects = seriesRecords.filter(item => item.test_fixture_failure_item_count > 0);
const failureMarkerProjects = seriesRecords.filter(item => item.seedance_failure_marker_present);
const finalDeliveryManifestGaps = seriesRecords.filter(item => item.final_delivery_manifest_missing);
const missingStoryReferenceCounts = new Map();
for (const item of interrupted) {
  for (const storyId of item.missing_story_ids) {
    missingStoryReferenceCounts.set(storyId, (missingStoryReferenceCounts.get(storyId) ?? 0) + 1);
  }
}
const duplicateMissingStoryIds = [...missingStoryReferenceCounts.entries()]
  .filter(([, referenceCount]) => referenceCount > 1)
  .map(([storyId, referenceCount]) => ({ story_id: storyId, reference_count: referenceCount }))
  .sort((a, b) => b.reference_count - a.reference_count || a.story_id.localeCompare(b.story_id));

for (const item of relinkCandidates) {
  item.action = item.auto_recovery_safe
    ? 'review_embedded_snapshot_then_restore_story_json'
    : 'recover_from_external_backup_or_reclassify_as_fixture';
  item.requires_operator_review = true;
}
for (const item of archiveOrRebuildCandidates) {
  item.action = 'exclude_from_gears_signoff_then_archive_or_rebuild';
  item.requires_operator_review = true;
}

const generatedAt = new Date().toISOString();
const report = {
  schema_version: 'story-agent-monitor-remediation-queue/v1',
  generated_at: generatedAt,
  source: 'web/generated read-only local scan',
  safety: {
    generated_project_records_modified: false,
    generated_handoff_files_written: false,
    province_markdown_modified: false,
    domain_pack_modified: false,
    automatic_relink_performed: false,
    automatic_archive_performed: false,
  },
  summary: {
    scanned_story_file_count: storyFiles.length,
    scanned_series_project_count: seriesRecords.length,
    interrupted_series_project_count: interrupted.length,
    relink_candidate_count: relinkCandidates.length,
    relink_auto_recovery_safe_count: relinkCandidates.filter(item => item.auto_recovery_safe).length,
    relink_potential_suffix_match_project_count: relinkCandidates.filter(item => item.potential_suffix_matches.length > 0).length,
    relink_potential_suffix_match_reference_count: relinkCandidates.reduce(
      (sum, item) => sum + item.potential_suffix_matches.length,
      0,
    ),
    archive_or_rebuild_candidate_count: archiveOrRebuildCandidates.length,
    other_series_project_count: seriesRecords.length - interrupted.length,
    missing_story_reference_count: interrupted.reduce((sum, item) => sum + item.missing_story_id_count, 0),
    unique_missing_story_id_count: missingStoryReferenceCounts.size,
    duplicate_missing_story_id_count: duplicateMissingStoryIds.length,
    seedance_failed_project_count: failedProjects.length,
    seedance_failed_item_count: seriesRecords.reduce((sum, item) => sum + item.failed_production_item_count, 0),
    seedance_failure_marker_project_count: failureMarkerProjects.length,
    seedance_test_fixture_failure_project_count: testFixtureFailureProjects.length,
    seedance_test_fixture_failure_item_count: seriesRecords.reduce(
      (sum, item) => sum + item.test_fixture_failure_item_count,
      0,
    ),
    seedance_unmarked_failure_item_count: seriesRecords.reduce(
      (sum, item) => sum + item.unmarked_failure_item_count,
      0,
    ),
    series_missing_final_delivery_manifest_count: finalDeliveryManifestGaps.length,
  },
  relink_candidates: relinkCandidates,
  archive_or_rebuild_candidates: archiveOrRebuildCandidates,
  final_delivery_manifest_gaps: finalDeliveryManifestGaps.map(item => ({
    project_id: item.project_id,
    title: item.title,
    updated_at: item.updated_at,
    final_delivery_dry_run: item.final_delivery_dry_run,
    remediation: 'rerun_final_delivery_export_to_generate_manifest_without_fabricating_delivery_evidence',
  })),
  duplicate_missing_story_ids: duplicateMissingStoryIds,
  notes: [
    'The queue is evidence-only and does not mutate web/generated.',
    'Relink is safe only when every missing story ID has an exact recoverable story snapshot; title or episode similarity is not sufficient.',
    'Potential suffix matches are review hints only; a repeated random suffix under a newer date does not prove story identity.',
    'Archive/rebuild candidates have broken story refs and no production/postproduction contract evidence.',
    'A final-delivery concat/output plan without manifest.json is tracked as incomplete and is not publishable delivery evidence.',
    'A real GEARS/Seedance callback still requires public external artifact URLs and is outside this local audit.',
  ],
};

if (shouldWrite) {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()).replaceAll('-', '');
  const outputPath = path.join(repoRoot, 'data', 'reports', `story-agent-monitor-remediation-queue-${date}.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output_path: path.relative(repoRoot, outputPath), summary: report.summary }, null, 2));
} else {
  console.log(JSON.stringify(report.summary, null, 2));
}
