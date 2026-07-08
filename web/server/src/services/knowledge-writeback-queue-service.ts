import { createHash } from 'node:crypto';
import type {
  DomainPackExpansionWritebackDraftItem,
  DomainPackExpansionWritebackDraftPackage,
  KnowledgeWritebackQueueExportFilters,
  KnowledgeWritebackManualPatchPackage,
  KnowledgeWritebackQueueExportPackage,
  KnowledgeWritebackQueueExportPreflight,
  KnowledgeWritebackQueueExportTargetFilePreflight,
  KnowledgeWritebackQueueReviewHandoff,
  KnowledgeWritebackQueueReviewHandoffItem,
  KnowledgeWritebackQueueReviewSignoffManifest,
  KnowledgeWritebackQueueSignoffBatchSummary,
  KnowledgeWritebackQueueSignoffPackage,
  KnowledgeWritebackSourceRefQualityItem,
  KnowledgeWritebackSourceRefQualityLevel,
  KnowledgeWritebackSourceRefQualitySummary,
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

const UNASSIGNED_SIGNOFF_BATCH_ID = 'unassigned_signoff_batch';
const MANUAL_DIFF_PREVIEW_LINE_LIMIT = 80;

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
    exportedAt,
    targetFiles,
    projectItems: projectPatchResult.data.items,
    expansionItems: expansionDraft.items,
    statusCounts: statusCounts.total,
  });
  const signoffPackage = buildKnowledgeWritebackQueueSignoffPackage(exportedAt, filters, preflight.review_handoff);
  const manualPatchPackage = buildKnowledgeWritebackManualPatchPackage({
    exportedAt,
    targetFiles,
    projectItems: projectPatchResult.data.items,
    expansionItems: expansionDraft.items,
    preflight,
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
    signoff_package: signoffPackage,
    manual_patch_package: manualPatchPackage,
    project_patch: projectPatchResult.data,
    expansion_draft: expansionDraft,
  };

  return {
    ...packageWithoutMarkdown,
    markdown: renderKnowledgeWritebackQueueExportMarkdown(packageWithoutMarkdown),
  };
}

function buildKnowledgeWritebackQueueSignoffPackage(
  exportedAt: string,
  filters: KnowledgeWritebackQueueExportFilters,
  handoff: KnowledgeWritebackQueueReviewHandoff,
): KnowledgeWritebackQueueSignoffPackage {
  return {
    schema_version: 'knowledge-writeback-queue-signoff-package/v1',
    exported_at: exportedAt,
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    filters,
    signoff_manifest: handoff.signoff_manifest,
    status_counts: handoff.status_counts,
    signoff_batch_summaries: handoff.signoff_batch_summaries,
    operator_checklist: handoff.operator_checklist,
    handoff_item_count: handoff.items.length,
    handoff_items: handoff.items,
  };
}

function buildKnowledgeWritebackManualPatchPackage(input: {
  exportedAt: string;
  targetFiles: string[];
  projectItems: ProjectKnowledgeWritebackPatchItem[];
  expansionItems: DomainPackExpansionWritebackDraftItem[];
  preflight: KnowledgeWritebackQueueExportPreflight;
}): KnowledgeWritebackManualPatchPackage {
  const targetPatches = input.targetFiles.map(targetFile => {
    const projectItems = input.projectItems.filter(item => item.suggested_file_path === targetFile);
    const expansionItems = input.expansionItems.filter(item => item.suggested_file_path === targetFile);
    const appendMarkdown = renderManualPatchAppendMarkdown(targetFile, projectItems, expansionItems);
    const reviewDiff = renderManualReviewDiff(targetFile, appendMarkdown);
    const sourceRefQuality = buildSourceRefQualitySummary(projectItems, expansionItems);
    const blockerReasons = targetManualPatchBlockerReasons(targetFile, projectItems, expansionItems, sourceRefQuality);
    const warningReasons = targetManualPatchWarningReasons(sourceRefQuality);
    const sourceRefCount = countExpansionSourceRefs(expansionItems);
    const candidateFieldTotal = expansionItems.reduce((sum, item) =>
      sum + (item.field_supplement_candidate_count ?? candidateFieldCount(item)), 0);
    const diffPreviewLines = reviewDiff.trimEnd().split('\n').slice(0, MANUAL_DIFF_PREVIEW_LINE_LIMIT);
    return {
      target_file: targetFile,
      patch_applyable: false as const,
      manual_apply_only: true as const,
      ready_for_manual_apply: blockerReasons.length === 0,
      project_patch_count: projectItems.length,
      expansion_patch_count: expansionItems.length,
      total_patch_count: projectItems.length + expansionItems.length,
      source_ref_count: sourceRefCount,
      candidate_field_count: candidateFieldTotal,
      source_ref_coverage_percent: sourceRefQuality.coverage_percent,
      source_ref_quality_level: sourceRefQualityLevel(sourceRefQuality),
      blocker_reasons: blockerReasons,
      warning_reasons: warningReasons,
      append_markdown: appendMarkdown,
      review_diff: reviewDiff,
      diff_preview_lines: diffPreviewLines,
      diff_preview_truncated: reviewDiff.trimEnd().split('\n').length > MANUAL_DIFF_PREVIEW_LINE_LIMIT,
      safety_checks: [
        'direct_writeback_to_province_markdown=false',
        'province_markdown_written=false',
        'patch_applyable=false',
        'manual_apply_only=true',
        `target_ready_for_manual_apply=${blockerReasons.length === 0}`,
        `project_patch_count=${projectItems.length}`,
        `expansion_patch_count=${expansionItems.length}`,
        `source_refs=${sourceRefCount}`,
        `source_ref_coverage=${sourceRefQuality.coverage_percent}%`,
        `source_ref_blockers=${sourceRefQuality.blocker_item_count}`,
        `source_ref_warnings=${sourceRefQuality.warning_item_count}`,
      ],
    };
  });
  const totalPatchCount = targetPatches.reduce((sum, item) => sum + item.total_patch_count, 0);
  const readyForSignoffCount = input.preflight.review_handoff.signoff_batch_summaries
    .reduce((sum, item) => sum + item.ready_for_signoff_count, 0);
  const blockerReasons = manualPatchPackageBlockerReasons({
    totalPatchCount,
    preflight: input.preflight,
    readyForSignoffCount,
  });
  const warningReasons = manualPatchPackageWarningReasons(input.preflight.source_ref_quality);
  const readyForManualApply = blockerReasons.length === 0;
  const readyReasons = readyForManualApply
    ? [
      'manual_patch_has_target_patches',
      'preflight_ready_for_manual_export=true',
      'review_handoff_ready_for_signoff=all',
      'source_ref_quality_blockers=0',
    ]
    : [];

  return {
    schema_version: 'knowledge-writeback-manual-patch-package/v1',
    exported_at: input.exportedAt,
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    patch_applyable: false,
    manual_apply_only: true,
    ready_for_manual_apply: readyForManualApply,
    target_file_count: targetPatches.length,
    target_files: input.targetFiles,
    total_patch_count: totalPatchCount,
    project_patch_count: input.projectItems.length,
    expansion_patch_count: input.expansionItems.length,
    source_ref_count: countExpansionSourceRefs(input.expansionItems),
    candidate_field_count: input.expansionItems.reduce((sum, item) =>
      sum + (item.field_supplement_candidate_count ?? candidateFieldCount(item)), 0),
    source_ref_quality: input.preflight.source_ref_quality,
    ready_reasons: readyReasons,
    blocker_reasons: blockerReasons,
    warning_reasons: warningReasons,
    safety_checks: [
      'direct_writeback_to_province_markdown=false',
      'province_markdown_written=false',
      'patch_applyable=false',
      'manual_apply_only=true',
      `ready_for_manual_apply=${readyForManualApply}`,
      `ready_blockers=${blockerReasons.length}`,
      `ready_warnings=${warningReasons.length}`,
      `target_files=${targetPatches.length}`,
      `total_patch_count=${totalPatchCount}`,
      `review_handoff_ready_for_signoff=${readyForSignoffCount}/${input.preflight.review_handoff.total_handoff_count}`,
      `source_ref_coverage=${input.preflight.source_ref_quality.coverage_percent}%`,
      `source_ref_blocker_items=${input.preflight.source_ref_quality.blocker_item_count}`,
    ],
    operator_checklist: [
      '先核对 signoff manifest、review_note、reviewer_identity 和 signoff_batch_id。',
      '逐个打开 target_file，对照 append_markdown 与 review_diff 人工合并。',
      '合并前再次核对 source_refs、字段边界和 forbidden_direct_claims。',
      '本包不是 git apply 补丁；patch_applyable=false，只作为人工写回审阅材料。',
      '人工写回完成后再单独把对应任务标记为 written_back。',
    ],
    target_patches: targetPatches,
  };
}

function renderManualPatchAppendMarkdown(
  targetFile: string,
  projectItems: ProjectKnowledgeWritebackPatchItem[],
  expansionItems: DomainPackExpansionWritebackDraftItem[],
): string {
  const sections = [
    `<!-- knowledge_writeback_manual_patch target_file="${targetFile}" direct_writeback_to_province_markdown="false" -->`,
    ...projectItems.flatMap(item => [
      '',
      `<!-- project_writeback task="${item.task_key ?? item.task_id}" status="${item.writeback_status ?? 'draft_ready'}" -->`,
      item.append_markdown.trim(),
    ]),
    ...expansionItems.flatMap(item => [
      '',
      `<!-- domain_pack_expansion_writeback review_item_id="${item.review_item_id}" status="${item.writeback_status ?? 'draft_ready'}" -->`,
      item.append_markdown.trim(),
    ]),
  ];
  return sections.join('\n').trim() + '\n';
}

function renderManualReviewDiff(targetFile: string, appendMarkdown: string): string {
  const diffLines = appendMarkdown.trimEnd().split('\n').map(line => `+${line}`);
  return [
    `diff --git a/${targetFile} b/${targetFile}`,
    `--- a/${targetFile}`,
    `+++ b/${targetFile}`,
    '@@ manual_append_review_only @@',
    ...diffLines,
  ].join('\n') + '\n';
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
  exportedAt: string;
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
  const reviewHandoff = buildReviewHandoff(input.projectItems, input.expansionItems, input.exportedAt, input.targetFiles);
  const sourceRefQuality = buildSourceRefQualitySummary(input.projectItems, input.expansionItems);

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
    source_ref_quality: sourceRefQuality,
    manual_review_required_count: manualReviewRequiredCount,
    blocked_direct_writeback_count: blockedDirectWritebackCount,
    ready_for_manual_export: totalDraftCount > 0
      && input.targetFiles.length > 0
      && expansionFieldMissingCount === 0
      && sourceRefQuality.blocker_item_count === 0,
    target_file_preflight: targetFilePreflight,
    review_handoff: reviewHandoff,
    safety_checks: [
      'direct_writeback_to_province_markdown=false',
      'province_markdown_written=false',
      `target_files=${input.targetFiles.length}`,
      `project_drafts=${input.projectItems.length}`,
      `expansion_drafts=${input.expansionItems.length}`,
      `expansion_candidate_fields=${expansionCandidateFieldCount}`,
      `expansion_source_refs=${expansionSourceRefCount}`,
      `source_ref_coverage=${sourceRefQuality.coverage_percent}%`,
      `source_ref_blocker_items=${sourceRefQuality.blocker_item_count}`,
      `source_ref_warning_items=${sourceRefQuality.warning_item_count}`,
      `review_handoff_items=${reviewHandoff.total_handoff_count}`,
      `review_handoff_requires_signoff=${reviewHandoff.requires_manual_signoff_count}`,
      `signoff_batch_summaries=${reviewHandoff.signoff_batch_summaries.length}`,
      `signoff_manifest_id=${reviewHandoff.signoff_manifest.manifest_id}`,
      `signoff_manifest_sha256=${reviewHandoff.signoff_manifest.sha256}`,
      `manual_review_required=${manualReviewRequiredCount}`,
      'default_action=export_only_no_file_write',
    ],
  };
}

function buildReviewHandoff(
  projectItems: ProjectKnowledgeWritebackPatchItem[],
  expansionItems: DomainPackExpansionWritebackDraftItem[],
  exportedAt: string,
  targetFiles: string[],
): KnowledgeWritebackQueueReviewHandoff {
  const projectHandoffItems = projectItems.map<KnowledgeWritebackQueueReviewHandoffItem>(item => {
    const status = item.writeback_status ?? 'draft_ready';
    return {
      handoff_id: item.task_key ?? `${item.project_id ?? 'project'}::${item.task_id}`,
      source_kind: 'project',
      title: item.label,
      target_file: item.suggested_file_path,
      writeback_status: status,
      province: item.target_province,
      project_id: item.project_id,
      task_id: item.task_id,
      target_video_types: item.video_type ? [item.video_type] : [],
      review_note: item.review_note,
      writeback_note: item.writeback_note,
      candidate_field_count: 0,
      source_ref_count: 0,
      required_action: reviewHandoffRequiredAction(status, Boolean(item.review_note?.trim()), 0),
    };
  });

  const expansionHandoffItems = expansionItems.map<KnowledgeWritebackQueueReviewHandoffItem>(item => {
    const status = item.writeback_status ?? 'draft_ready';
    const sourceRefCount = itemSourceRefCount(item);
    return {
      handoff_id: item.review_item_id,
      source_kind: 'domain_pack_expansion',
      title: item.entry_name,
      target_file: item.suggested_file_path,
      writeback_status: status,
      province: item.province,
      review_item_id: item.review_item_id,
      pack_id: item.pack_id,
      target_video_types: item.target_video_types,
      review_state_source: item.review_state_source,
      review_state_overrides_seed: item.review_state_overrides_seed,
      review_note: item.review_note,
      reviewer_id: item.reviewer_id,
      reviewer_name: item.reviewer_name,
      reviewed_by: item.reviewed_by,
      signoff_batch_id: item.signoff_batch_id,
      signoff_batch_note: item.signoff_batch_note,
      writeback_note: item.writeback_note,
      candidate_field_count: item.field_supplement_candidate_count ?? candidateFieldCount(item),
      source_ref_count: sourceRefCount,
      required_action: reviewHandoffRequiredAction(
        status,
        Boolean(item.review_note?.trim()),
        sourceRefCount,
        Boolean(reviewerDisplayName(item)),
      ),
    };
  });

  const items = [...projectHandoffItems, ...expansionHandoffItems];
  const statusCounts = normalizeStatusCounts();
  for (const item of items) {
    statusCounts[item.writeback_status] += 1;
  }

  const reviewNoteCount = items.filter(item => Boolean(item.review_note?.trim())).length;
  const reviewerIdentityCount = items.filter(item => Boolean(reviewerDisplayName(item))).length;
  const signoffBatchIds = [...new Set(items.map(item => item.signoff_batch_id?.trim()).filter((id): id is string => Boolean(id)))].sort((a, b) => a.localeCompare(b));
  const signoffBatchCount = items.filter(item => Boolean(item.signoff_batch_id?.trim())).length;
  const sourceRefCount = items.reduce((sum, item) => sum + item.source_ref_count, 0);
  const candidateFieldCount = items.reduce((sum, item) => sum + item.candidate_field_count, 0);
  const requiresManualSignoffCount = items.filter(item => item.writeback_status !== 'written_back').length;
  const signoffBatchSummaries = buildSignoffBatchSummaries(items);
  const signoffManifest = buildReviewSignoffManifest({
    exportedAt,
    items,
    targetFiles,
    sourceRefCount,
    requiresManualSignoffCount,
  });

  return {
    schema_version: 'knowledge-writeback-queue-review-handoff/v1',
    signoff_manifest: signoffManifest,
    total_handoff_count: items.length,
    project_handoff_count: projectHandoffItems.length,
    expansion_handoff_count: expansionHandoffItems.length,
    runtime_override_count: expansionHandoffItems.filter(item =>
      item.review_state_source === 'runtime' || item.review_state_overrides_seed,
    ).length,
    seed_sourced_count: expansionHandoffItems.filter(item => item.review_state_source === 'seed').length,
    review_note_count: reviewNoteCount,
    missing_review_note_count: items.length - reviewNoteCount,
    reviewer_identity_count: reviewerIdentityCount,
    missing_reviewer_identity_count: items.length - reviewerIdentityCount,
    signoff_batch_count: signoffBatchCount,
    missing_signoff_batch_count: items.length - signoffBatchCount,
    signoff_batch_ids: signoffBatchIds,
    signoff_batch_summaries: signoffBatchSummaries,
    source_ref_count: sourceRefCount,
    candidate_field_count: candidateFieldCount,
    requires_manual_signoff_count: requiresManualSignoffCount,
    status_counts: statusCounts,
    operator_checklist: [
      '逐条确认 target_file 与省份条目匹配。',
      '逐条核对 reviewer_identity、signoff_batch_id、review_note、writeback_note 和字段级 source_refs。',
      'runtime review-state 覆盖 seed 时，优先查看退回原因和复核备注。',
      '只把导出包作为人工写回草案；默认不直接写 data/provinces/*.md。',
    ],
    items,
  };
}

function buildSignoffBatchSummaries(
  items: KnowledgeWritebackQueueReviewHandoffItem[],
): KnowledgeWritebackQueueSignoffBatchSummary[] {
  const summaries = new Map<string, KnowledgeWritebackQueueSignoffBatchSummary>();
  const ensureSummary = (item: KnowledgeWritebackQueueReviewHandoffItem) => {
    const signoffBatchId = item.signoff_batch_id?.trim() || UNASSIGNED_SIGNOFF_BATCH_ID;
    const signoffBatchNote = item.signoff_batch_note?.trim();
    const current = summaries.get(signoffBatchId);
    if (current) {
      if (!current.signoff_batch_note && signoffBatchNote) current.signoff_batch_note = signoffBatchNote;
      return current;
    }
    const next: KnowledgeWritebackQueueSignoffBatchSummary = {
      signoff_batch_id: signoffBatchId,
      ...(signoffBatchNote ? { signoff_batch_note: signoffBatchNote } : {}),
      item_count: 0,
      project_handoff_count: 0,
      expansion_handoff_count: 0,
      requires_manual_signoff_count: 0,
      review_note_count: 0,
      missing_review_note_count: 0,
      reviewer_identity_count: 0,
      missing_reviewer_identity_count: 0,
      source_ref_count: 0,
      candidate_field_count: 0,
      status_counts: normalizeStatusCounts(),
      ready_for_signoff_count: 0,
      blocked_for_signoff_count: 0,
    };
    summaries.set(signoffBatchId, next);
    return next;
  };

  for (const item of items) {
    const summary = ensureSummary(item);
    summary.item_count += 1;
    if (item.source_kind === 'project') summary.project_handoff_count += 1;
    if (item.source_kind === 'domain_pack_expansion') summary.expansion_handoff_count += 1;
    if (item.writeback_status !== 'written_back') summary.requires_manual_signoff_count += 1;
    if (item.review_note?.trim()) summary.review_note_count += 1;
    else summary.missing_review_note_count += 1;
    if (reviewerDisplayName(item)) summary.reviewer_identity_count += 1;
    else summary.missing_reviewer_identity_count += 1;
    summary.source_ref_count += item.source_ref_count;
    summary.candidate_field_count += item.candidate_field_count;
    summary.status_counts[item.writeback_status] += 1;
    if (isHandoffItemReadyForSignoff(item)) summary.ready_for_signoff_count += 1;
    else summary.blocked_for_signoff_count += 1;
  }

  return [...summaries.values()].sort((a, b) => {
    if (a.signoff_batch_id === UNASSIGNED_SIGNOFF_BATCH_ID) return 1;
    if (b.signoff_batch_id === UNASSIGNED_SIGNOFF_BATCH_ID) return -1;
    return a.signoff_batch_id.localeCompare(b.signoff_batch_id);
  });
}

function isHandoffItemReadyForSignoff(item: KnowledgeWritebackQueueReviewHandoffItem): boolean {
  return Boolean(item.signoff_batch_id?.trim())
    && item.writeback_status !== 'needs_revision'
    && Boolean(item.review_note?.trim())
    && Boolean(reviewerDisplayName(item))
    && (item.source_kind === 'project' || item.source_ref_count > 0);
}

function buildReviewSignoffManifest(input: {
  exportedAt: string;
  items: KnowledgeWritebackQueueReviewHandoffItem[];
  targetFiles: string[];
  sourceRefCount: number;
  requiresManualSignoffCount: number;
}): KnowledgeWritebackQueueReviewSignoffManifest {
  const signoffBatchIds = [...new Set(input.items.map(item => item.signoff_batch_id?.trim()).filter((id): id is string => Boolean(id)))].sort((a, b) => a.localeCompare(b));
  const payload = {
    schema_version: 'knowledge-writeback-queue-signoff-manifest/v1',
    generated_at: input.exportedAt,
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    target_files: input.targetFiles,
    signoff_batch_ids: signoffBatchIds,
    items: input.items.map(item => ({
      handoff_id: item.handoff_id,
      source_kind: item.source_kind,
      target_file: item.target_file,
      writeback_status: item.writeback_status,
      candidate_field_count: item.candidate_field_count,
      source_ref_count: item.source_ref_count,
      review_state_source: item.review_state_source,
      review_state_overrides_seed: item.review_state_overrides_seed,
      reviewed_by: reviewerDisplayName(item),
      signoff_batch_id: item.signoff_batch_id,
    })),
  };
  const sha256 = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return {
    schema_version: 'knowledge-writeback-queue-signoff-manifest/v1',
    manifest_id: `kwb-signoff-${sha256.slice(0, 12)}`,
    generated_at: input.exportedAt,
    sha256,
    item_count: input.items.length,
    target_file_count: input.targetFiles.length,
    source_ref_count: input.sourceRefCount,
    requires_manual_signoff_count: input.requiresManualSignoffCount,
    signoff_batch_ids: signoffBatchIds,
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
  };
}

function reviewHandoffRequiredAction(
  status: KnowledgeWritebackStatus,
  hasReviewNote: boolean,
  sourceRefCount: number,
  hasReviewerIdentity = true,
): string {
  if (status === 'written_back') return '已标记写回，仍需人工确认省份 Markdown diff。';
  if (status === 'needs_revision') return '退回复核：按退回原因补来源、边界或写回范围。';
  if (!hasReviewNote) return '补充复核备注后再签收。';
  if (!hasReviewerIdentity) return '补充复核人身份后再签收。';
  if (sourceRefCount === 0) return '补充来源引用或人工证据链接后再签收。';
  if (status === 'queued') return '已入队，等待人工核对字段差异并执行外部写回。';
  return '草案就绪，等待人工签收或批量入队。';
}

function buildSourceRefQualitySummary(
  projectItems: ProjectKnowledgeWritebackPatchItem[],
  expansionItems: DomainPackExpansionWritebackDraftItem[],
): KnowledgeWritebackSourceRefQualitySummary {
  const items = [
    ...projectItems.map(projectSourceRefQualityItem),
    ...expansionItems.map(expansionSourceRefQualityItem),
  ];
  const checkedFieldCount = items.reduce((sum, item) => sum + item.checked_field_count, 0);
  const coveredFieldCount = items.reduce((sum, item) => sum + item.covered_field_count, 0);
  const sourceRefCount = new Set([
    ...projectItems.flatMap(projectStructuredSourceRefs),
    ...expansionItems.flatMap(item => (item.field_workbench ?? []).flatMap(field => field.source_refs)),
  ]).size;
  return {
    schema_version: 'knowledge-writeback-source-ref-quality/v1',
    total_item_count: items.length,
    project_item_count: projectItems.length,
    expansion_item_count: expansionItems.length,
    checked_field_count: checkedFieldCount,
    covered_field_count: coveredFieldCount,
    source_ref_count: sourceRefCount,
    missing_source_ref_field_count: items.reduce((sum, item) => sum + item.missing_source_ref_field_count, 0),
    missing_verification_note_field_count: items.reduce((sum, item) => sum + item.missing_verification_note_field_count, 0),
    missing_writeback_hint_field_count: items.reduce((sum, item) => sum + item.missing_writeback_hint_field_count, 0),
    coverage_percent: completionPercent(coveredFieldCount, checkedFieldCount),
    pass_item_count: items.filter(item => item.quality_level === 'pass').length,
    warning_item_count: items.filter(item => item.quality_level === 'warning').length,
    blocker_item_count: items.filter(item => item.quality_level === 'blocker').length,
    items,
  };
}

function projectSourceRefQualityItem(item: ProjectKnowledgeWritebackPatchItem): KnowledgeWritebackSourceRefQualityItem {
  const sourceRefs = projectStructuredSourceRefs(item);
  const warningReasons = sourceRefs.length > 0
    ? ['project_writeback_source_refs_extracted_from_markdown']
    : ['project_writeback_has_no_structured_source_refs'];
  return {
    item_id: item.task_key ?? `${item.project_id ?? 'project'}::${item.task_id}`,
    source_kind: 'project',
    title: item.label,
    target_file: item.suggested_file_path,
    candidate_field_count: 0,
    checked_field_count: 0,
    covered_field_count: 0,
    source_ref_count: sourceRefs.length,
    missing_source_ref_field_count: 0,
    missing_verification_note_field_count: 0,
    missing_writeback_hint_field_count: 0,
    coverage_percent: 100,
    quality_level: 'warning',
    blocker_reasons: [],
    warning_reasons: warningReasons,
  };
}

function expansionSourceRefQualityItem(item: DomainPackExpansionWritebackDraftItem): KnowledgeWritebackSourceRefQualityItem {
  const fields = (item.field_workbench ?? []).filter(field => field.supplement_status === 'candidate_draft');
  const checkedFieldCount = fields.length;
  const coveredFieldCount = fields.filter(field => field.source_refs.length > 0).length;
  const missingSourceRefFieldCount = fields.filter(field => field.source_refs.length === 0).length;
  const missingVerificationNoteFieldCount = fields.filter(field => !field.verification_note?.trim()).length;
  const missingWritebackHintFieldCount = fields.filter(field => !field.writeback_hint?.trim()).length;
  const sourceRefCount = new Set(fields.flatMap(field => field.source_refs)).size;
  const blockerReasons = [
    checkedFieldCount === 0 ? 'no_candidate_fields_to_verify' : undefined,
    missingSourceRefFieldCount > 0 ? `missing_source_refs=${missingSourceRefFieldCount}` : undefined,
  ].filter((reason): reason is string => Boolean(reason));
  const warningReasons = [
    missingVerificationNoteFieldCount > 0 ? `missing_verification_notes=${missingVerificationNoteFieldCount}` : undefined,
    missingWritebackHintFieldCount > 0 ? `missing_writeback_hints=${missingWritebackHintFieldCount}` : undefined,
  ].filter((reason): reason is string => Boolean(reason));
  return {
    item_id: item.review_item_id,
    source_kind: 'domain_pack_expansion',
    title: item.entry_name,
    target_file: item.suggested_file_path,
    candidate_field_count: item.field_supplement_candidate_count ?? fields.length,
    checked_field_count: checkedFieldCount,
    covered_field_count: coveredFieldCount,
    source_ref_count: sourceRefCount,
    missing_source_ref_field_count: missingSourceRefFieldCount,
    missing_verification_note_field_count: missingVerificationNoteFieldCount,
    missing_writeback_hint_field_count: missingWritebackHintFieldCount,
    coverage_percent: completionPercent(coveredFieldCount, checkedFieldCount),
    quality_level: blockerReasons.length > 0 ? 'blocker' : warningReasons.length > 0 ? 'warning' : 'pass',
    blocker_reasons: blockerReasons,
    warning_reasons: warningReasons,
  };
}

function projectStructuredSourceRefs(item: ProjectKnowledgeWritebackPatchItem): string[] {
  const sourceLines = item.append_markdown
    .split('\n')
    .filter(line => /source_refs?|来源|参考|出处/i.test(line));
  return [...new Set(sourceLines.map(line => line.trim()).filter(Boolean))];
}

function sourceRefQualityLevel(summary: KnowledgeWritebackSourceRefQualitySummary): KnowledgeWritebackSourceRefQualityLevel {
  if (summary.blocker_item_count > 0) return 'blocker';
  if (summary.warning_item_count > 0) return 'warning';
  return 'pass';
}

function completionPercent(completedCount: number, totalCount: number): number {
  if (totalCount <= 0) return 100;
  return Math.round((completedCount / totalCount) * 100);
}

function manualPatchPackageBlockerReasons(input: {
  totalPatchCount: number;
  preflight: KnowledgeWritebackQueueExportPreflight;
  readyForSignoffCount: number;
}): string[] {
  return [
    input.totalPatchCount === 0 ? 'no_manual_patch_items' : undefined,
    !input.preflight.ready_for_manual_export ? 'preflight_not_ready_for_manual_export' : undefined,
    input.readyForSignoffCount !== input.preflight.review_handoff.total_handoff_count
      ? `review_handoff_not_fully_ready=${input.readyForSignoffCount}/${input.preflight.review_handoff.total_handoff_count}`
      : undefined,
    input.preflight.review_handoff.missing_review_note_count > 0
      ? `missing_review_notes=${input.preflight.review_handoff.missing_review_note_count}`
      : undefined,
    input.preflight.review_handoff.missing_reviewer_identity_count > 0
      ? `missing_reviewer_identities=${input.preflight.review_handoff.missing_reviewer_identity_count}`
      : undefined,
    input.preflight.review_handoff.missing_signoff_batch_count > 0
      ? `missing_signoff_batches=${input.preflight.review_handoff.missing_signoff_batch_count}`
      : undefined,
    input.preflight.source_ref_quality.blocker_item_count > 0
      ? `source_ref_quality_blockers=${input.preflight.source_ref_quality.blocker_item_count}`
      : undefined,
  ].filter((reason): reason is string => Boolean(reason));
}

function manualPatchPackageWarningReasons(
  sourceRefQuality: KnowledgeWritebackSourceRefQualitySummary,
): string[] {
  return [
    sourceRefQuality.warning_item_count > 0 ? `source_ref_quality_warnings=${sourceRefQuality.warning_item_count}` : undefined,
    sourceRefQuality.missing_verification_note_field_count > 0
      ? `missing_verification_notes=${sourceRefQuality.missing_verification_note_field_count}`
      : undefined,
    sourceRefQuality.missing_writeback_hint_field_count > 0
      ? `missing_writeback_hints=${sourceRefQuality.missing_writeback_hint_field_count}`
      : undefined,
  ].filter((reason): reason is string => Boolean(reason));
}

function targetManualPatchBlockerReasons(
  targetFile: string,
  projectItems: ProjectKnowledgeWritebackPatchItem[],
  expansionItems: DomainPackExpansionWritebackDraftItem[],
  sourceRefQuality: KnowledgeWritebackSourceRefQualitySummary,
): string[] {
  return [
    projectItems.length + expansionItems.length === 0 ? `no_patch_items_for_target=${targetFile}` : undefined,
    sourceRefQuality.blocker_item_count > 0
      ? `target_source_ref_blockers=${sourceRefQuality.blocker_item_count}`
      : undefined,
  ].filter((reason): reason is string => Boolean(reason));
}

function targetManualPatchWarningReasons(
  sourceRefQuality: KnowledgeWritebackSourceRefQualitySummary,
): string[] {
  return manualPatchPackageWarningReasons(sourceRefQuality);
}

function reviewerDisplayName(item: {
  reviewed_by?: string;
  reviewer_name?: string;
  reviewer_id?: string;
  signoff_batch_id?: string;
  signoff_batch_note?: string;
}): string | undefined {
  return item.reviewed_by?.trim() || item.reviewer_name?.trim() || item.reviewer_id?.trim() || undefined;
}

function candidateFieldCount(item: DomainPackExpansionWritebackDraftItem): number {
  return (item.field_workbench ?? []).filter(field => field.supplement_status === 'candidate_draft').length;
}

function itemSourceRefCount(item: DomainPackExpansionWritebackDraftItem): number {
  return new Set((item.field_workbench ?? []).flatMap(field => field.source_refs)).size;
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
  const sourceRefQuality = buildSourceRefQualitySummary(projectFileItems, expansionFileItems);

  return {
    target_file: targetFile,
    project_draft_count: projectFileItems.length,
    expansion_draft_count: expansionFileItems.length,
    total_draft_count: projectFileItems.length + expansionFileItems.length,
    expansion_candidate_field_count: expansionCandidateFieldCount,
    expansion_field_missing_count: expansionFieldMissingCount,
    expansion_source_ref_count: countExpansionSourceRefs(expansionFileItems),
    source_ref_coverage_percent: sourceRefQuality.coverage_percent,
    source_ref_quality_level: sourceRefQualityLevel(sourceRefQuality),
    source_ref_blocker_count: sourceRefQuality.blocker_item_count,
    source_ref_warning_count: sourceRefQuality.warning_item_count,
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
    `- preflight_source_ref_coverage: ${pkg.preflight.source_ref_quality.coverage_percent}%`,
    `- preflight_source_ref_blockers: ${pkg.preflight.source_ref_quality.blocker_item_count}`,
    `- preflight_source_ref_warnings: ${pkg.preflight.source_ref_quality.warning_item_count}`,
    `- preflight_manual_review_required: ${pkg.preflight.manual_review_required_count}`,
    `- manual_patch_package: ${pkg.manual_patch_package.schema_version}`,
    `- manual_patch_ready: ${pkg.manual_patch_package.ready_for_manual_apply}`,
    `- manual_patch_target_files: ${pkg.manual_patch_package.target_file_count}`,
    `- manual_patch_total_patches: ${pkg.manual_patch_package.total_patch_count}`,
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
    `- source_ref_quality_schema: ${pkg.preflight.source_ref_quality.schema_version}`,
    `- source_ref_coverage_percent: ${pkg.preflight.source_ref_quality.coverage_percent}`,
    `- source_ref_blocker_items: ${pkg.preflight.source_ref_quality.blocker_item_count}`,
    `- source_ref_warning_items: ${pkg.preflight.source_ref_quality.warning_item_count}`,
    `- missing_source_ref_fields: ${pkg.preflight.source_ref_quality.missing_source_ref_field_count}`,
    `- missing_verification_note_fields: ${pkg.preflight.source_ref_quality.missing_verification_note_field_count}`,
    `- missing_writeback_hint_fields: ${pkg.preflight.source_ref_quality.missing_writeback_hint_field_count}`,
    `- blocked_direct_writeback_count: ${pkg.preflight.blocked_direct_writeback_count}`,
    ...pkg.preflight.safety_checks.map(check => `- ${check}`),
    '',
    '### Target File Preflight',
    '',
    ...renderTargetFilePreflightLines(pkg.preflight.target_file_preflight),
    '',
    '## Review Handoff',
    '',
    `- schema_version: ${pkg.preflight.review_handoff.schema_version}`,
    `- signoff_manifest_id: ${pkg.preflight.review_handoff.signoff_manifest.manifest_id}`,
    `- signoff_manifest_sha256: ${pkg.preflight.review_handoff.signoff_manifest.sha256}`,
    `- total_handoff_count: ${pkg.preflight.review_handoff.total_handoff_count}`,
    `- project_handoff_count: ${pkg.preflight.review_handoff.project_handoff_count}`,
    `- expansion_handoff_count: ${pkg.preflight.review_handoff.expansion_handoff_count}`,
    `- runtime_override_count: ${pkg.preflight.review_handoff.runtime_override_count}`,
    `- review_note_count: ${pkg.preflight.review_handoff.review_note_count}`,
    `- missing_review_note_count: ${pkg.preflight.review_handoff.missing_review_note_count}`,
    `- reviewer_identity_count: ${pkg.preflight.review_handoff.reviewer_identity_count}`,
    `- missing_reviewer_identity_count: ${pkg.preflight.review_handoff.missing_reviewer_identity_count}`,
    `- signoff_batch_count: ${pkg.preflight.review_handoff.signoff_batch_count}`,
    `- missing_signoff_batch_count: ${pkg.preflight.review_handoff.missing_signoff_batch_count}`,
    `- signoff_batch_ids: ${pkg.preflight.review_handoff.signoff_batch_ids.join(', ') || 'none'}`,
    `- signoff_batch_summary_count: ${pkg.preflight.review_handoff.signoff_batch_summaries.length}`,
    `- requires_manual_signoff_count: ${pkg.preflight.review_handoff.requires_manual_signoff_count}`,
    '',
    '## Signoff Package',
    '',
    `- schema_version: ${pkg.signoff_package.schema_version}`,
    `- handoff_item_count: ${pkg.signoff_package.handoff_item_count}`,
    `- signoff_manifest_id: ${pkg.signoff_package.signoff_manifest.manifest_id}`,
    `- signoff_manifest_sha256: ${pkg.signoff_package.signoff_manifest.sha256}`,
    `- signoff_manifest_batches: ${pkg.signoff_package.signoff_manifest.signoff_batch_ids.join(', ') || 'none'}`,
    `- signoff_batch_summary_count: ${pkg.signoff_package.signoff_batch_summaries.length}`,
    `- direct_writeback_to_province_markdown: ${pkg.signoff_package.direct_writeback_to_province_markdown}`,
    `- province_markdown_written: ${pkg.signoff_package.province_markdown_written}`,
    '',
    '## Manual Writeback Patch Package',
    '',
    `- schema_version: ${pkg.manual_patch_package.schema_version}`,
    `- direct_writeback_to_province_markdown: ${pkg.manual_patch_package.direct_writeback_to_province_markdown}`,
    `- province_markdown_written: ${pkg.manual_patch_package.province_markdown_written}`,
    `- patch_applyable: ${pkg.manual_patch_package.patch_applyable}`,
    `- manual_apply_only: ${pkg.manual_patch_package.manual_apply_only}`,
    `- ready_for_manual_apply: ${pkg.manual_patch_package.ready_for_manual_apply}`,
    `- target_file_count: ${pkg.manual_patch_package.target_file_count}`,
    `- total_patch_count: ${pkg.manual_patch_package.total_patch_count}`,
    `- project_patch_count: ${pkg.manual_patch_package.project_patch_count}`,
    `- expansion_patch_count: ${pkg.manual_patch_package.expansion_patch_count}`,
    `- source_ref_count: ${pkg.manual_patch_package.source_ref_count}`,
    `- candidate_field_count: ${pkg.manual_patch_package.candidate_field_count}`,
    `- source_ref_coverage_percent: ${pkg.manual_patch_package.source_ref_quality.coverage_percent}`,
    `- source_ref_blocker_items: ${pkg.manual_patch_package.source_ref_quality.blocker_item_count}`,
    `- source_ref_warning_items: ${pkg.manual_patch_package.source_ref_quality.warning_item_count}`,
    ...pkg.manual_patch_package.ready_reasons.map(reason => `- ready_reason: ${reason}`),
    ...pkg.manual_patch_package.blocker_reasons.map(reason => `- blocker_reason: ${reason}`),
    ...pkg.manual_patch_package.warning_reasons.map(reason => `- warning_reason: ${reason}`),
    ...pkg.manual_patch_package.safety_checks.map(check => `- safety_check: ${check}`),
    '',
    '### Manual Patch Operator Checklist',
    '',
    ...pkg.manual_patch_package.operator_checklist.map(item => `- ${item}`),
    '',
    '### Target Review Diffs',
    '',
    ...renderManualPatchTargetLines(pkg.manual_patch_package.target_patches),
    '',
    '### Operator Checklist',
    '',
    ...pkg.preflight.review_handoff.operator_checklist.map(item => `- ${item}`),
    '',
    '### Signoff Batch Summaries',
    '',
    ...renderSignoffBatchSummaryLines(pkg.preflight.review_handoff.signoff_batch_summaries),
    '',
    '### Handoff Items',
    '',
    ...renderReviewHandoffLines(pkg.preflight.review_handoff.items),
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

function renderManualPatchTargetLines(
  targets: KnowledgeWritebackManualPatchPackage['target_patches'],
): string[] {
  if (targets.length === 0) return ['- none'];
  return targets.flatMap(target => [
    `#### ${target.target_file}`,
    '',
    `- patch_applyable: ${target.patch_applyable}`,
    `- manual_apply_only: ${target.manual_apply_only}`,
    `- ready_for_manual_apply: ${target.ready_for_manual_apply}`,
    `- total_patch_count: ${target.total_patch_count}`,
    `- project_patch_count: ${target.project_patch_count}`,
    `- expansion_patch_count: ${target.expansion_patch_count}`,
    `- source_ref_count: ${target.source_ref_count}`,
    `- candidate_field_count: ${target.candidate_field_count}`,
    `- source_ref_quality: ${target.source_ref_quality_level}; coverage=${target.source_ref_coverage_percent}%`,
    ...target.blocker_reasons.map(reason => `- blocker_reason: ${reason}`),
    ...target.warning_reasons.map(reason => `- warning_reason: ${reason}`),
    ...target.safety_checks.map(check => `- safety_check: ${check}`),
    '',
    '```diff',
    ...target.diff_preview_lines,
    ...(target.diff_preview_truncated ? ['# diff preview truncated; use review_diff for full manual patch body'] : []),
    '```',
    '',
  ]);
}

function renderTargetFilePreflightLines(items: KnowledgeWritebackQueueExportTargetFilePreflight[]): string[] {
  if (items.length === 0) return ['- none'];
  return items.flatMap(item => [
    `- ${item.target_file}`,
    `  - drafts: total=${item.total_draft_count}; project=${item.project_draft_count}; expansion=${item.expansion_draft_count}`,
    `  - expansion_field_diff: candidates=${item.expansion_candidate_field_count}; missing=${item.expansion_field_missing_count}`,
    `  - expansion_source_refs: ${item.expansion_source_ref_count}`,
    `  - source_ref_quality: ${item.source_ref_quality_level}; coverage=${item.source_ref_coverage_percent}%; blockers=${item.source_ref_blocker_count}; warnings=${item.source_ref_warning_count}`,
    `  - direct_writeback_to_province_markdown: ${item.direct_writeback_to_province_markdown}`,
    `  - safety_note: ${item.safety_note}`,
  ]);
}

function renderSignoffBatchSummaryLines(items: KnowledgeWritebackQueueSignoffBatchSummary[]): string[] {
  if (items.length === 0) return ['- none'];
  return items.flatMap(item => [
    `- ${item.signoff_batch_id}`,
    ...(item.signoff_batch_note ? [`  - signoff_batch_note: ${item.signoff_batch_note}`] : []),
    `  - items: total=${item.item_count}; project=${item.project_handoff_count}; expansion=${item.expansion_handoff_count}`,
    `  - manual_signoff: required=${item.requires_manual_signoff_count}; ready=${item.ready_for_signoff_count}; blocked=${item.blocked_for_signoff_count}`,
    `  - review_notes: present=${item.review_note_count}; missing=${item.missing_review_note_count}`,
    `  - reviewer_identities: present=${item.reviewer_identity_count}; missing=${item.missing_reviewer_identity_count}`,
    `  - field_evidence: candidate_fields=${item.candidate_field_count}; source_refs=${item.source_ref_count}`,
    `  - status_counts: draft_ready=${item.status_counts.draft_ready}; queued=${item.status_counts.queued}; written_back=${item.status_counts.written_back}; needs_revision=${item.status_counts.needs_revision}`,
  ]);
}

function renderReviewHandoffLines(items: KnowledgeWritebackQueueReviewHandoffItem[]): string[] {
  if (items.length === 0) return ['- none'];
  return items.flatMap(item => [
    `- ${item.handoff_id}｜${item.title}`,
    `  - source_kind: ${item.source_kind}`,
    `  - target_file: ${item.target_file}`,
    `  - writeback_status: ${item.writeback_status}`,
    `  - candidate_fields: ${item.candidate_field_count}`,
    `  - source_refs: ${item.source_ref_count}`,
    ...(item.review_state_source ? [`  - review_state_source: ${item.review_state_source}`] : []),
    ...(typeof item.review_state_overrides_seed === 'boolean' ? [`  - review_state_overrides_seed: ${item.review_state_overrides_seed}`] : []),
    ...(reviewerDisplayName(item) ? [`  - reviewed_by: ${reviewerDisplayName(item)}`] : []),
    ...(item.signoff_batch_id ? [`  - signoff_batch_id: ${item.signoff_batch_id}`] : []),
    ...(item.signoff_batch_note ? [`  - signoff_batch_note: ${item.signoff_batch_note}`] : []),
    `  - required_action: ${item.required_action}`,
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
