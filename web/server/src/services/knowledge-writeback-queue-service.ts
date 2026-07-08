import type {
  DomainPackExpansionWritebackDraftItem,
  DomainPackExpansionWritebackDraftPackage,
  KnowledgeWritebackQueueExportFilters,
  KnowledgeWritebackQueueExportPackage,
  KnowledgeWritebackQueueExportPreflight,
  KnowledgeWritebackQueueExportTargetFilePreflight,
  KnowledgeWritebackStatus,
  ProjectKnowledgeWritebackPatchItem,
  ProjectSupplementTaskListFilters,
  VideoType,
} from '@shared/types.js';
import { getDomainPackExpansionWritebackDraftPackage } from './domain-pack-expansion-service.js';
import { exportProjectKnowledgeWritebackQueuePatch } from './project-service.js';

const WRITEBACK_STATUSES: KnowledgeWritebackStatus[] = [
  'draft_ready',
  'queued',
  'written_back',
  'needs_revision',
];

export interface KnowledgeWritebackQueueExportInput {
  projectId?: string;
  videoType?: VideoType;
  province?: string;
  knowledgeWritebackStatus?: KnowledgeWritebackStatus;
  searchQuery?: string;
  projectTaskKeys?: string[];
  expansionReviewItemIds?: string[];
}

export async function getKnowledgeWritebackQueueExportPackage(
  input: KnowledgeWritebackQueueExportInput = {},
): Promise<KnowledgeWritebackQueueExportPackage> {
  const exportedAt = new Date().toISOString();
  const projectPatchResult = await exportProjectKnowledgeWritebackQueuePatch({
    project_id: input.projectId,
    video_type: input.videoType,
    province: input.province,
    knowledge_writeback_status: input.knowledgeWritebackStatus,
    search_query: input.searchQuery,
    task_keys: input.projectTaskKeys,
  } satisfies Pick<ProjectSupplementTaskListFilters, 'project_id' | 'video_type' | 'province' | 'knowledge_writeback_status' | 'search_query' | 'task_keys'>);
  if (!projectPatchResult.ok || !projectPatchResult.data) {
    throw new Error(projectPatchResult.error?.message ?? 'Failed to export project knowledge writeback queue');
  }

  const expansionDraft = input.projectId
    ? emptyExpansionDraftPackage(exportedAt)
    : getDomainPackExpansionWritebackDraftPackage({
      exportedAt,
      reviewItemIds: input.expansionReviewItemIds,
      videoTypes: input.videoType ? [input.videoType] : undefined,
      provinces: input.province ? [input.province] : undefined,
      writebackStatuses: input.knowledgeWritebackStatus ? [input.knowledgeWritebackStatus] : undefined,
    });

  const filters = buildFilters(input);
  const targetFiles = [...new Set([
    ...projectPatchResult.data.target_files,
    ...expansionDraft.target_files,
  ])].sort((a, b) => a.localeCompare(b));
  const projectCount = projectPatchResult.data.project_count
    ?? new Set(projectPatchResult.data.items.map(item => item.project_id).filter(Boolean)).size;
  const statusCounts = {
    project: normalizeStatusCounts(projectPatchResult.data.status_counts),
    expansion: normalizeStatusCounts(expansionDraft.status_counts),
    total: mergeStatusCounts(projectPatchResult.data.status_counts, expansionDraft.status_counts),
  };
  const preflight = buildUnifiedWritebackExportPreflight({
    targetFiles,
    projectItems: projectPatchResult.data.items,
    expansionItems: expansionDraft.items,
    statusCounts: statusCounts.total,
  });

  const packageWithoutMarkdown: Omit<KnowledgeWritebackQueueExportPackage, 'markdown'> = {
    schema_version: 'knowledge-writeback-queue-export/v1',
    exported_at: exportedAt,
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    filters,
    approved_count: projectPatchResult.data.approved_count + expansionDraft.approved_count,
    project_approved_count: projectPatchResult.data.approved_count,
    expansion_approved_count: expansionDraft.approved_count,
    project_count: projectCount,
    target_files: targetFiles,
    status_counts: statusCounts,
    preflight,
    project_patch: projectPatchResult.data,
    expansion_draft: expansionDraft,
  };

  return {
    ...packageWithoutMarkdown,
    markdown: renderKnowledgeWritebackQueueExportMarkdown(packageWithoutMarkdown),
  };
}

function buildFilters(input: KnowledgeWritebackQueueExportInput): KnowledgeWritebackQueueExportFilters {
  return {
    ...(input.projectId ? { project_id: input.projectId } : {}),
    ...(input.videoType ? { video_type: input.videoType } : {}),
    ...(input.province ? { province: input.province } : {}),
    ...(input.knowledgeWritebackStatus ? { knowledge_writeback_status: input.knowledgeWritebackStatus } : {}),
    ...(input.searchQuery ? { search_query: input.searchQuery } : {}),
    ...(input.projectTaskKeys?.length ? { project_task_key_count: input.projectTaskKeys.length } : {}),
    ...(input.expansionReviewItemIds?.length ? { expansion_review_item_count: input.expansionReviewItemIds.length } : {}),
  };
}

function buildUnifiedWritebackExportPreflight(input: {
  targetFiles: string[];
  projectItems: ProjectKnowledgeWritebackPatchItem[];
  expansionItems: DomainPackExpansionWritebackDraftItem[];
  statusCounts: Record<KnowledgeWritebackStatus, number>;
}): KnowledgeWritebackQueueExportPreflight {
  const targetFilePreflight = input.targetFiles.map(targetFile =>
    buildTargetFilePreflight(targetFile, input.projectItems, input.expansionItems),
  );
  const expansionCandidateFieldCount = input.expansionItems
    .reduce((sum, item) => sum + (item.field_supplement_candidate_count ?? 0), 0);
  const expansionFieldMissingCount = input.expansionItems
    .reduce((sum, item) => sum + (item.field_missing_candidate_count ?? 0), 0);
  const expansionSourceRefCount = countExpansionSourceRefs(input.expansionItems);
  const totalDraftCount = input.projectItems.length + input.expansionItems.length;
  const manualReviewRequiredCount = totalDraftCount - (input.statusCounts.written_back ?? 0);
  const blockedDirectWritebackCount = totalDraftCount;

  return {
    schema_version: 'knowledge-writeback-queue-export-preflight/v1',
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    target_file_count: input.targetFiles.length,
    target_files: input.targetFiles,
    total_draft_count: totalDraftCount,
    project_draft_count: input.projectItems.length,
    expansion_draft_count: input.expansionItems.length,
    expansion_candidate_field_count: expansionCandidateFieldCount,
    expansion_field_missing_count: expansionFieldMissingCount,
    expansion_source_ref_count: expansionSourceRefCount,
    manual_review_required_count: manualReviewRequiredCount,
    blocked_direct_writeback_count: blockedDirectWritebackCount,
    ready_for_manual_export: totalDraftCount > 0
      && input.targetFiles.length > 0
      && expansionFieldMissingCount === 0,
    target_file_preflight: targetFilePreflight,
    safety_checks: [
      'direct_writeback_to_province_markdown=false',
      'province_markdown_written=false',
      `target_files=${input.targetFiles.length}`,
      `project_drafts=${input.projectItems.length}`,
      `expansion_drafts=${input.expansionItems.length}`,
      `expansion_candidate_fields=${expansionCandidateFieldCount}`,
      `expansion_source_refs=${expansionSourceRefCount}`,
      `manual_review_required=${manualReviewRequiredCount}`,
      'default_action=export_only_no_file_write',
    ],
  };
}

function buildTargetFilePreflight(
  targetFile: string,
  projectItems: ProjectKnowledgeWritebackPatchItem[],
  expansionItems: DomainPackExpansionWritebackDraftItem[],
): KnowledgeWritebackQueueExportTargetFilePreflight {
  const projectFileItems = projectItems.filter(item => item.suggested_file_path === targetFile);
  const expansionFileItems = expansionItems.filter(item => item.suggested_file_path === targetFile);
  const statusCounts = normalizeStatusCounts();
  for (const item of [...projectFileItems, ...expansionFileItems]) {
    const status = item.writeback_status ?? 'draft_ready';
    statusCounts[status] += 1;
  }
  const expansionCandidateFieldCount = expansionFileItems
    .reduce((sum, item) => sum + (item.field_supplement_candidate_count ?? 0), 0);
  const expansionFieldMissingCount = expansionFileItems
    .reduce((sum, item) => sum + (item.field_missing_candidate_count ?? 0), 0);

  return {
    target_file: targetFile,
    project_draft_count: projectFileItems.length,
    expansion_draft_count: expansionFileItems.length,
    total_draft_count: projectFileItems.length + expansionFileItems.length,
    expansion_candidate_field_count: expansionCandidateFieldCount,
    expansion_field_missing_count: expansionFieldMissingCount,
    expansion_source_ref_count: countExpansionSourceRefs(expansionFileItems),
    writeback_status_counts: statusCounts,
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    safety_note: '仅导出人工写回草案和字段差异，不直接修改省份 Markdown。',
  };
}

function countExpansionSourceRefs(items: DomainPackExpansionWritebackDraftItem[]): number {
  return new Set(items.flatMap(item =>
    (item.field_workbench ?? []).flatMap(field => field.source_refs),
  )).size;
}

function normalizeStatusCounts(
  counts?: Partial<Record<KnowledgeWritebackStatus, number>>,
): Record<KnowledgeWritebackStatus, number> {
  return Object.fromEntries(WRITEBACK_STATUSES.map(status => [status, counts?.[status] ?? 0])) as Record<KnowledgeWritebackStatus, number>;
}

function mergeStatusCounts(
  projectCounts?: Partial<Record<KnowledgeWritebackStatus, number>>,
  expansionCounts?: Partial<Record<KnowledgeWritebackStatus, number>>,
): Record<KnowledgeWritebackStatus, number> {
  return Object.fromEntries(WRITEBACK_STATUSES.map(status => [
    status,
    (projectCounts?.[status] ?? 0) + (expansionCounts?.[status] ?? 0),
  ])) as Record<KnowledgeWritebackStatus, number>;
}

function renderKnowledgeWritebackQueueExportMarkdown(
  pkg: Omit<KnowledgeWritebackQueueExportPackage, 'markdown'>,
): string {
  return [
    '# Knowledge Writeback Queue Export',
    '',
    `> schema_version: ${pkg.schema_version}`,
    `> exported_at: ${pkg.exported_at}`,
    `> direct_writeback_to_province_markdown: ${pkg.direct_writeback_to_province_markdown}`,
    `> province_markdown_written: ${pkg.province_markdown_written}`,
    '',
    '## Summary',
    '',
    `- approved_count: ${pkg.approved_count}`,
    `- project_approved_count: ${pkg.project_approved_count}`,
    `- expansion_approved_count: ${pkg.expansion_approved_count}`,
    `- project_count: ${pkg.project_count}`,
    `- target_files: ${pkg.target_files.join(', ') || 'none'}`,
    `- preflight_target_files: ${pkg.preflight.target_file_count}`,
    `- preflight_total_drafts: ${pkg.preflight.total_draft_count}`,
    `- preflight_expansion_candidate_fields: ${pkg.preflight.expansion_candidate_field_count}`,
    `- preflight_expansion_source_refs: ${pkg.preflight.expansion_source_ref_count}`,
    `- preflight_manual_review_required: ${pkg.preflight.manual_review_required_count}`,
    '',
    '## Filters',
    '',
    ...renderFilterLines(pkg.filters),
    '',
    '## Writeback Status Counts',
    '',
    ...WRITEBACK_STATUSES.map(status => (
      `- ${status}: total=${pkg.status_counts.total[status]}; project=${pkg.status_counts.project[status]}; expansion=${pkg.status_counts.expansion[status]}`
    )),
    '',
    '## Review Gate',
    '',
    '- 项目草案来源：仅包含候选稿已 approved 且生成正式写回草案的补充任务。',
    '- 扩库草案来源：仅包含 Domain Pack 扩库候选已 approved 且生成写回草案的审稿项。',
    '- 本导出只服务人工核实、PR 草案和外部审稿工具，不直接写入 data/provinces/*.md。',
    '',
    '## Export Preflight',
    '',
    `- schema_version: ${pkg.preflight.schema_version}`,
    `- direct_writeback_to_province_markdown: ${pkg.preflight.direct_writeback_to_province_markdown}`,
    `- province_markdown_written: ${pkg.preflight.province_markdown_written}`,
    `- ready_for_manual_export: ${pkg.preflight.ready_for_manual_export}`,
    `- blocked_direct_writeback_count: ${pkg.preflight.blocked_direct_writeback_count}`,
    ...pkg.preflight.safety_checks.map(check => `- ${check}`),
    '',
    '### Target File Preflight',
    '',
    ...renderTargetFilePreflightLines(pkg.preflight.target_file_preflight),
    '',
    '## Project Writeback Patch',
    '',
    pkg.project_patch.approved_count > 0 ? pkg.project_patch.markdown.trim() : '- none',
    '',
    '## Domain Pack Expansion Writeback Draft',
    '',
    pkg.expansion_draft.approved_count > 0 ? pkg.expansion_draft.markdown.trim() : '- none',
  ].join('\n').trim() + '\n';
}

function renderTargetFilePreflightLines(items: KnowledgeWritebackQueueExportTargetFilePreflight[]): string[] {
  if (items.length === 0) return ['- none'];
  return items.flatMap(item => [
    `- ${item.target_file}`,
    `  - drafts: total=${item.total_draft_count}; project=${item.project_draft_count}; expansion=${item.expansion_draft_count}`,
    `  - expansion_field_diff: candidates=${item.expansion_candidate_field_count}; missing=${item.expansion_field_missing_count}`,
    `  - expansion_source_refs: ${item.expansion_source_ref_count}`,
    `  - direct_writeback_to_province_markdown: ${item.direct_writeback_to_province_markdown}`,
    `  - safety_note: ${item.safety_note}`,
  ]);
}

function emptyExpansionDraftPackage(exportedAt: string): DomainPackExpansionWritebackDraftPackage {
  return {
    schema_version: 'domain-pack-expansion-writeback-draft/v1',
    exported_at: exportedAt,
    domain_id: 'china_culture',
    direct_writeback_to_province_markdown: false,
    filters: {},
    approved_count: 0,
    target_files: [],
    status_counts: normalizeStatusCounts(),
    markdown: [
      '# Domain Pack Expansion Writeback Draft',
      '',
      `> schema_version: domain-pack-expansion-writeback-draft/v1`,
      `> exported_at: ${exportedAt}`,
      `> domain_id: china_culture`,
      `> direct_writeback_to_province_markdown: false`,
      '',
      '## Items',
      '',
      '- none',
    ].join('\n'),
    items: [],
  };
}

function renderFilterLines(filters: KnowledgeWritebackQueueExportFilters): string[] {
  const lines = [
    filters.project_id ? `- project_id: ${filters.project_id}` : undefined,
    filters.video_type ? `- video_type: ${filters.video_type}` : undefined,
    filters.province ? `- province: ${filters.province}` : undefined,
    filters.knowledge_writeback_status ? `- knowledge_writeback_status: ${filters.knowledge_writeback_status}` : undefined,
    filters.search_query ? `- search_query: ${filters.search_query}` : undefined,
    typeof filters.project_task_key_count === 'number' ? `- project_task_key_count: ${filters.project_task_key_count}` : undefined,
    typeof filters.expansion_review_item_count === 'number' ? `- expansion_review_item_count: ${filters.expansion_review_item_count}` : undefined,
  ].filter((line): line is string => Boolean(line));
  return lines.length ? lines : ['- none'];
}
