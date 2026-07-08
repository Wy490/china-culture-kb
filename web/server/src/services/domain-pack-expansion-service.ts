import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  DomainPackExpansionNextDevelopmentTask,
  DomainPackExpansionReviewStateBulkUpdateRequest,
  DomainPackExpansionReviewStateBulkUpdateResult,
  DomainPackExpansionReviewStateItem,
  DomainPackExpansionReviewStateSource,
  DomainPackExpansionReviewStateUpdateRequest,
  DomainPackExpansionReviewStatus,
  DomainPackExpansionFieldSupplementTarget,
  DomainPackExpansionFieldWorkbenchItem,
  DomainPackExpansionPipelineStage,
  DomainPackExpansionReviewReadyTarget,
  DomainPackExpansionVideoTypeCoverageSummary,
  DomainPackExpansionWritebackDraftFilter,
  DomainPackExpansionWritebackDraftItem,
  DomainPackExpansionWritebackDraftPackage,
  DomainPackExpansionWritebackPreflightSummary,
  DomainPackProductionHealthStatus,
  KnowledgeWritebackStatus,
} from '@shared/types.js';

type IssueSeverity = 'warning' | 'error';
type JsonRecord = Record<string, unknown>;

interface ExpansionCandidateFile {
  schema_version?: string;
  updated_at?: string;
  domain_id?: string;
  review_policy?: JsonRecord;
  batches?: unknown[];
}

interface ExpansionBatch {
  batch_id: string;
  pack_id: string;
  entry_name: string;
  priority: string;
  status: string;
  target_video_types: string[];
  field_groups: ExpansionFieldGroup[];
  seed_targets: ExpansionSeedTarget[];
}

interface ExpansionFieldGroup {
  group_id: string;
  candidate_fields: string[];
  review_questions: string[];
}

interface ExpansionSeedTarget {
  entry_name: string;
  province: string;
  recommended_fields: string[];
  candidate_status: string;
  forbidden_direct_claims: string[];
  field_supplement_candidates: ExpansionFieldSupplementCandidate[];
}

interface ExpansionFieldSupplementCandidate {
  field_id: string;
  candidate_value: string;
  evidence_level?: string;
  source_refs: string[];
  writeback_hint?: string;
  verification_note?: string;
}

export interface DomainPackExpansionCandidateIssue {
  severity: IssueSeverity;
  issue_type:
    | 'missing_candidate_file'
    | 'invalid_schema_version'
    | 'direct_writeback_enabled'
    | 'missing_required_pack'
    | 'duplicate_batch_id'
    | 'invalid_batch_status'
    | 'underfilled_field_group'
    | 'underfilled_seed_target';
  batch_id?: string;
  pack_id?: string;
  message: string;
  details?: string[];
}

export interface DomainPackExpansionBatchSummary {
  batch_id: string;
  pack_id: string;
  entry_name: string;
  priority: string;
  status: string;
  target_video_types: string[];
  field_group_count: number;
  candidate_field_count: number;
  field_supplement_candidate_count?: number;
  seed_target_count: number;
  provinces: string[];
}

export interface DomainPackExpansionReviewFieldGroup {
  group_id: string;
  candidate_fields: string[];
  review_questions: string[];
}

export interface DomainPackExpansionReviewItem {
  review_item_id: string;
  batch_id: string;
  pack_id: string;
  entry_name: string;
  province: string;
  priority: string;
  target_video_types: string[];
  candidate_status: string;
  recommended_fields: string[];
  forbidden_direct_claims: string[];
  field_workbench: DomainPackExpansionFieldWorkbenchItem[];
  field_supplement_candidate_count: number;
  field_missing_candidate_count: number;
  field_candidate_completion_percent: number;
  field_review_ready_count: number;
  field_review_blocker_count: number;
  field_review_ready_percent: number;
  review_ready: boolean;
  candidate_markdown: string;
  review_status?: DomainPackExpansionReviewStatus;
  review_note?: string;
  reviewed_at?: string;
  reviewer_id?: string;
  reviewer_name?: string;
  reviewed_by?: string;
  signoff_batch_id?: string;
  signoff_batch_note?: string;
  writeback_status?: KnowledgeWritebackStatus;
  writeback_note?: string;
  writeback_updated_at?: string;
  writeback_draft_markdown?: string;
}

export interface DomainPackExpansionReviewBatch {
  batch_id: string;
  pack_id: string;
  entry_name: string;
  priority: string;
  status: string;
  target_video_types: string[];
  field_groups: DomainPackExpansionReviewFieldGroup[];
  review_item_count: number;
  review_items: DomainPackExpansionReviewItem[];
}

export interface DomainPackExpansionReviewPacket {
  schema_version: 'domain-pack-expansion-review-packet/v1';
  generated_at: string;
  source_schema_version: string;
  domain_id: string;
  status: DomainPackProductionHealthStatus;
  review_policy: {
    direct_writeback_to_province_markdown: boolean;
    requires_candidate_markdown: boolean;
    requires_human_review: boolean;
    requires_source_level: boolean;
  };
  batch_count: number;
  review_item_count: number;
  candidate_field_count: number;
  field_workbench_item_count?: number;
  field_supplement_candidate_count?: number;
  field_missing_candidate_count?: number;
  field_candidate_completion_percent?: number;
  field_review_ready_count?: number;
  field_review_blocker_count?: number;
  field_review_ready_percent?: number;
  review_ready_item_count?: number;
  review_blocked_item_count?: number;
  batches: DomainPackExpansionReviewBatch[];
  review_status_counts?: Record<DomainPackExpansionReviewStatus, number>;
  approved_writeback_draft_count?: number;
  markdown?: string;
}

export interface DomainPackExpansionCandidateReport {
  schema_version: 'domain-pack-expansion-candidates-report/v1';
  generated_at: string;
  source_schema_version: string;
  updated_at: string;
  domain_id: string;
  status: DomainPackProductionHealthStatus;
  required_pack_ids: string[];
  covered_required_pack_ids: string[];
  missing_required_pack_ids: string[];
  review_policy: {
    direct_writeback_to_province_markdown: boolean;
    requires_candidate_markdown: boolean;
    requires_human_review: boolean;
    requires_source_level: boolean;
  };
  batch_count: number;
  seed_target_count: number;
  candidate_field_count: number;
  field_workbench_item_count?: number;
  field_supplement_candidate_count?: number;
  field_missing_candidate_count?: number;
  field_candidate_completion_percent?: number;
  field_review_ready_count?: number;
  field_review_blocker_count?: number;
  field_review_ready_percent?: number;
  review_ready_item_count?: number;
  review_blocked_item_count?: number;
  pipeline_progress_percent: number;
  pipeline_stage: DomainPackExpansionPipelineStage;
  field_supplement_priority_target_count: number;
  field_supplement_priority_targets: DomainPackExpansionFieldSupplementTarget[];
  review_ready_priority_target_count: number;
  review_ready_priority_targets: DomainPackExpansionReviewReadyTarget[];
  video_type_coverage_count: number;
  coverage_by_video_type: DomainPackExpansionVideoTypeCoverageSummary[];
  writeback_preflight: DomainPackExpansionWritebackPreflightSummary;
  next_development_tasks: DomainPackExpansionNextDevelopmentTask[];
  batches: DomainPackExpansionBatchSummary[];
  issues: DomainPackExpansionCandidateIssue[];
  review_packet: DomainPackExpansionReviewPacket;
  markdown?: string;
}

type DomainPackExpansionCandidateReportDraft = Omit<
  DomainPackExpansionCandidateReport,
  'markdown'
  | 'review_packet'
  | 'video_type_coverage_count'
  | 'coverage_by_video_type'
  | 'writeback_preflight'
  | 'next_development_tasks'
  | 'field_supplement_priority_target_count'
  | 'field_supplement_priority_targets'
  | 'review_ready_priority_target_count'
  | 'review_ready_priority_targets'
  | 'pipeline_progress_percent'
  | 'pipeline_stage'
>;
type DomainPackExpansionReviewItemDraft = Omit<DomainPackExpansionReviewItem, 'candidate_markdown'>;

interface DomainPackExpansionReviewStateFile {
  schema_version?: string;
  updated_at?: string;
  items?: unknown[];
}

interface DomainPackExpansionResolvedReviewStateItem extends DomainPackExpansionReviewStateItem {
  review_state_source: DomainPackExpansionReviewStateSource;
  review_state_overrides_seed: boolean;
  review_state_seed_status?: DomainPackExpansionReviewStatus;
  review_state_seed_writeback_status?: KnowledgeWritebackStatus;
  review_state_runtime_status?: DomainPackExpansionReviewStatus;
  review_state_runtime_writeback_status?: KnowledgeWritebackStatus;
}

interface DomainPackExpansionReviewStateUpdateResult {
  ok: boolean;
  message?: string;
  report?: DomainPackExpansionCandidateReport;
}

interface DomainPackExpansionReviewStateBulkUpdateServiceResult {
  ok: boolean;
  message?: string;
  result?: DomainPackExpansionReviewStateBulkUpdateResult;
}

interface DomainPackExpansionWritebackDraftPackageInput {
  exportedAt?: string;
  reviewItemIds?: string[];
  packIds?: string[];
  videoTypes?: string[];
  provinces?: string[];
  writebackStatuses?: KnowledgeWritebackStatus[];
}

const REQUIRED_EXPANSION_PACK_IDS = [
  'heritage_process_pack',
  'documentary_source_pack',
  'ai_comic_storyboard_pack',
  'era_and_costume_pack',
  'explainer_knowledge_structure_pack',
  'children_adaptation_safety_pack',
  'short_video_hook_pack',
  'education_training_structure_pack',
];

const CANDIDATE_FILE_NAME = 'china-culture-production-expansion-candidates.json';
const REVIEW_STATE_FILE_NAME = 'review-state.json';
const REVIEW_STATE_SEED_FILE_NAME = 'china-culture-production-expansion-review-state.seed.json';
const REVIEW_STATUSES: DomainPackExpansionReviewStatus[] = ['candidate_review', 'approved', 'rejected', 'needs_revision'];
const WRITEBACK_STATUSES: KnowledgeWritebackStatus[] = ['draft_ready', 'queued', 'written_back', 'needs_revision'];

export function getDomainPackExpansionCandidateReport(input: {
  includeMarkdown?: boolean;
  generatedAt?: string;
} = {}): DomainPackExpansionCandidateReport {
  const loaded = loadExpansionCandidateFile();
  const issues: DomainPackExpansionCandidateIssue[] = [];
  const reviewState = loadDomainPackExpansionReviewStateMap();

  if (!loaded.file) {
    issues.push({
      severity: 'error',
      issue_type: 'missing_candidate_file',
      message: `缺少 Domain Pack 扩库候选文件：data/domain-packs/${CANDIDATE_FILE_NAME}。`,
    });
    return withOptionalMarkdown({
      schema_version: 'domain-pack-expansion-candidates-report/v1',
      generated_at: input.generatedAt ?? new Date().toISOString(),
      source_schema_version: 'missing',
      updated_at: 'unknown',
      domain_id: 'china_culture',
      status: statusFromIssues(issues),
      required_pack_ids: REQUIRED_EXPANSION_PACK_IDS,
      covered_required_pack_ids: [],
      missing_required_pack_ids: REQUIRED_EXPANSION_PACK_IDS,
      review_policy: {
        direct_writeback_to_province_markdown: true,
        requires_candidate_markdown: false,
        requires_human_review: false,
        requires_source_level: false,
      },
      batch_count: 0,
      seed_target_count: 0,
      candidate_field_count: 0,
      batches: [],
      issues,
    }, [], input.includeMarkdown, reviewState);
  }

  const file = loaded.file;
  if (file.schema_version !== 'domain-pack-expansion-candidates/v1') {
    issues.push({
      severity: 'error',
      issue_type: 'invalid_schema_version',
      message: `Domain Pack 扩库候选文件 schema_version 应为 domain-pack-expansion-candidates/v1，当前为 ${file.schema_version ?? 'missing'}。`,
    });
  }

  const reviewPolicy = isRecord(file.review_policy) ? file.review_policy : {};
  const directWriteback = reviewPolicy.direct_writeback_to_province_markdown === true;
  if (directWriteback) {
    issues.push({
      severity: 'error',
      issue_type: 'direct_writeback_enabled',
      message: 'Domain Pack 扩库候选不允许 direct_writeback_to_province_markdown=true，必须先进入候选稿和人工审稿。',
    });
  }

  const batches = Array.isArray(file.batches)
    ? file.batches.map(normalizeBatch).filter((batch): batch is ExpansionBatch => Boolean(batch))
    : [];
  const duplicateBatchIds = duplicateStrings(batches.map(batch => batch.batch_id));
  for (const batchId of duplicateBatchIds) {
    issues.push({
      severity: 'error',
      issue_type: 'duplicate_batch_id',
      batch_id: batchId,
      message: `Domain Pack 扩库候选存在重复 batch_id：${batchId}。`,
    });
  }

  for (const batch of batches) {
    if (batch.status !== 'candidate_review') {
      issues.push({
        severity: 'error',
        issue_type: 'invalid_batch_status',
        batch_id: batch.batch_id,
        pack_id: batch.pack_id,
        message: `${batch.batch_id} 当前状态不是 candidate_review，素材扩库必须先保持候选审稿状态。`,
      });
    }

    for (const group of batch.field_groups) {
      if (group.candidate_fields.length === 0 || group.review_questions.length === 0) {
        issues.push({
          severity: 'warning',
          issue_type: 'underfilled_field_group',
          batch_id: batch.batch_id,
          pack_id: batch.pack_id,
          message: `${batch.batch_id}/${group.group_id} 缺少 candidate_fields 或 review_questions。`,
        });
      }
    }

    for (const target of batch.seed_targets) {
      if (
        target.candidate_status !== 'candidate_review'
        || target.recommended_fields.length === 0
        || target.forbidden_direct_claims.length === 0
      ) {
        issues.push({
          severity: 'warning',
          issue_type: 'underfilled_seed_target',
          batch_id: batch.batch_id,
          pack_id: batch.pack_id,
          message: `${batch.batch_id}/${target.entry_name} 缺少候选审稿状态、推荐字段或禁写断言。`,
        });
      }
    }
  }

  const coveredRequiredPackIds = REQUIRED_EXPANSION_PACK_IDS.filter(packId =>
    batches.some(batch => batch.pack_id === packId),
  );
  const missingRequiredPackIds = REQUIRED_EXPANSION_PACK_IDS.filter(packId =>
    !coveredRequiredPackIds.includes(packId),
  );
  for (const packId of missingRequiredPackIds) {
    issues.push({
      severity: 'error',
      issue_type: 'missing_required_pack',
      pack_id: packId,
      message: `首批 Domain Pack 扩库缺少候选批次：${packId}。`,
    });
  }

  const batchSummaries = batches.map(batch => summarizeBatch(batch));
  return withOptionalMarkdown({
    schema_version: 'domain-pack-expansion-candidates-report/v1',
    generated_at: input.generatedAt ?? new Date().toISOString(),
    source_schema_version: typeof file.schema_version === 'string' ? file.schema_version : 'missing',
    updated_at: typeof file.updated_at === 'string' ? file.updated_at : 'unknown',
    domain_id: typeof file.domain_id === 'string' ? file.domain_id : 'china_culture',
    status: statusFromIssues(issues),
    required_pack_ids: REQUIRED_EXPANSION_PACK_IDS,
    covered_required_pack_ids: coveredRequiredPackIds,
    missing_required_pack_ids: missingRequiredPackIds,
    review_policy: {
      direct_writeback_to_province_markdown: directWriteback,
      requires_candidate_markdown: reviewPolicy.requires_candidate_markdown === true,
      requires_human_review: reviewPolicy.requires_human_review === true,
      requires_source_level: reviewPolicy.requires_source_level === true,
    },
    batch_count: batchSummaries.length,
    seed_target_count: batchSummaries.reduce((sum, batch) => sum + batch.seed_target_count, 0),
    candidate_field_count: batchSummaries.reduce((sum, batch) => sum + batch.candidate_field_count, 0),
    batches: batchSummaries,
    issues,
  }, batches, input.includeMarkdown, reviewState);
}

function withOptionalMarkdown(
  report: DomainPackExpansionCandidateReportDraft,
  sourceBatches: ExpansionBatch[],
  includeMarkdown = true,
  reviewState: Map<string, DomainPackExpansionResolvedReviewStateItem> = new Map(),
): DomainPackExpansionCandidateReport {
  const reviewPacket = buildDomainPackExpansionReviewPacket(report, sourceBatches, includeMarkdown, reviewState);
  const coverageByVideoType = buildVideoTypeCoverage(sourceBatches, reviewPacket);
  const fieldSupplementPriorityTargets = buildFieldSupplementPriorityTargets(reviewPacket);
  const reviewReadyPriorityTargets = buildReviewReadyPriorityTargets(reviewPacket);
  const pipelineProgress = buildPipelineProgress(report, reviewPacket);
  const reportCore = {
    ...report,
    pipeline_progress_percent: pipelineProgress.percent,
    pipeline_stage: pipelineProgress.stage,
    field_workbench_item_count: reviewPacket.field_workbench_item_count ?? 0,
    field_supplement_candidate_count: reviewPacket.field_supplement_candidate_count ?? 0,
    field_missing_candidate_count: reviewPacket.field_missing_candidate_count ?? 0,
    field_candidate_completion_percent: reviewPacket.field_candidate_completion_percent ?? 100,
    field_review_ready_count: reviewPacket.field_review_ready_count ?? 0,
    field_review_blocker_count: reviewPacket.field_review_blocker_count ?? 0,
    field_review_ready_percent: reviewPacket.field_review_ready_percent ?? 100,
    review_ready_item_count: reviewPacket.review_ready_item_count ?? 0,
    review_blocked_item_count: reviewPacket.review_blocked_item_count ?? 0,
    field_supplement_priority_target_count: fieldSupplementPriorityTargets.length,
    field_supplement_priority_targets: fieldSupplementPriorityTargets,
    review_ready_priority_target_count: reviewReadyPriorityTargets.length,
    review_ready_priority_targets: reviewReadyPriorityTargets,
    video_type_coverage_count: coverageByVideoType.length,
    coverage_by_video_type: coverageByVideoType,
    review_packet: reviewPacket,
  };
  const writebackPreflight = buildWritebackPreflightSummary(reportCore);
  const reportWithPacket: Omit<DomainPackExpansionCandidateReport, 'markdown'> = {
    ...reportCore,
    writeback_preflight: writebackPreflight,
    next_development_tasks: buildNextDevelopmentTasks(reportCore, writebackPreflight),
  };

  return includeMarkdown
    ? { ...reportWithPacket, markdown: renderDomainPackExpansionCandidateMarkdown(reportWithPacket) }
    : reportWithPacket;
}

function buildWritebackPreflightSummary(
  report: Omit<DomainPackExpansionCandidateReport, 'markdown' | 'writeback_preflight' | 'next_development_tasks'>,
): DomainPackExpansionWritebackPreflightSummary {
  const approvedItems = report.review_packet.batches.flatMap(batch =>
    batch.review_items.filter(item => item.review_status === 'approved' && Boolean(item.writeback_draft_markdown)),
  );
  const writebackCounts = countApprovedReviewItemWritebackStatuses(approvedItems);
  const targetFiles = [...new Set(approvedItems.map(item => suggestedProvinceFilePath(item.province)))]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const manualReviewRequiredCount = approvedItems.filter(item => (item.writeback_status ?? 'draft_ready') !== 'written_back').length;
  const blockedDirectWritebackCount = report.review_policy.direct_writeback_to_province_markdown
    ? approvedItems.length
    : 0;

  return {
    schema_version: 'domain-pack-expansion-writeback-preflight/v1',
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    approved_draft_count: approvedItems.length,
    draft_ready_count: writebackCounts.draft_ready,
    queued_count: writebackCounts.queued,
    written_back_count: writebackCounts.written_back,
    needs_revision_count: writebackCounts.needs_revision,
    target_file_count: targetFiles.length,
    target_files: targetFiles,
    manual_review_required_count: manualReviewRequiredCount,
    blocked_direct_writeback_count: blockedDirectWritebackCount,
    ready_for_unified_export: approvedItems.length > 0
      && blockedDirectWritebackCount === 0
      && report.review_packet.field_review_blocker_count === 0,
    safety_checks: [
      'direct_writeback_to_province_markdown=false',
      'province_markdown_written=false',
      `approved_writeback_drafts=${approvedItems.length}`,
      `target_files=${targetFiles.length}`,
      `manual_review_required=${manualReviewRequiredCount}`,
      'requires_human_review_before_province_markdown=true',
    ],
  };
}

function buildNextDevelopmentTasks(
  report: Omit<DomainPackExpansionCandidateReport, 'markdown' | 'writeback_preflight' | 'next_development_tasks'>,
  preflight: DomainPackExpansionWritebackPreflightSummary,
): DomainPackExpansionNextDevelopmentTask[] {
  const coreVideoTypes = ['explainer_video', 'heritage_promo', 'documentary_short', 'ai_comic_drama'];
  return [
    {
      task_id: 'field_workbench_controls',
      title: '字段级补库工作台增强',
      priority: 'P0',
      status: report.pipeline_stage === 'complete' ? 'in_progress' : 'ready',
      progress_percent: 100,
      progress_note: '扩库审稿页和统一写回队列已有 pack/video/province/status/source/handoff 筛选、字段级预览、复核人身份、审签批次归档、批次完成率汇总、批量写回状态操作、导出预检、签收清单、canonical signoff package 和前端下载归档。',
      related_plan_items: [1],
      target_video_types: coreVideoTypes,
      description: '增强筛选、字段预览、批量审稿和写回状态操作，让 66 条草案可被人工高效复核。',
      acceptance_checks: [
        '支持 pack/video_type/province/review_status/writeback_status/field/search 联合筛选。',
        '单条候选展示字段级候选值、来源引用、核实备注和安全预检。',
        '批量操作仍只更新 review-state，不直接写 data/provinces/*.md。',
      ],
      direct_writeback_to_province_markdown: false,
    },
    {
      task_id: 'manual_review_closure',
      title: '人工复核闭环',
      priority: 'P0',
      status: 'ready',
      progress_percent: 99,
      progress_note: '运行态 review-state 覆盖 seed、退回原因模板、复核备注汇总、复核人身份归档、审签批次 ID/备注、批次 ready/blocked 汇总、source 筛选、人工签收 manifest、canonical signoff package 和下载归档已可见；剩余主要是实际人工落库执行。',
      related_plan_items: [2],
      target_video_types: coreVideoTypes,
      description: '把退回原因、运行态覆盖和复核备注显性化，方便人工把 seed 审稿结果退回、入队或标注需补证。',
      acceptance_checks: [
        '提供退回原因模板并写入 review_note。',
        '运行态 review-state 覆盖 seed 时在工作台可见。',
        '复核人身份随单条/批量审稿进入 runtime review-state 和写回交接包。',
        'needs_revision/rejected 不生成写回草案。',
      ],
      direct_writeback_to_province_markdown: false,
    },
    {
      task_id: 'writeback_safety_export',
      title: '写回导出安全预检',
      priority: 'P0',
      status: preflight.ready_for_unified_export ? 'in_progress' : 'blocked',
      progress_percent: 100,
      progress_note: '统一导出 preflight 已结构化展示目标文件、字段差异、来源引用、人工交接、复核人身份覆盖率、审签批次归档、签收 manifest/sha256、canonical signoff package、signoff safety checks 和不可直写提示。',
      related_plan_items: [3],
      target_video_types: coreVideoTypes,
      description: '在导出前展示目标省份文件、状态计数和禁止直写检查，统一接入 Knowledge Writeback Queue。',
      acceptance_checks: [
        '导出包必须包含 direct_writeback_to_province_markdown=false。',
        '显示 target_files 和 writeback status counts。',
        '统一导出只产生人工补库采集清单，不写正式省份 Markdown。',
      ],
      direct_writeback_to_province_markdown: false,
    },
    {
      task_id: 'second_batch_real_candidates',
      title: '第二批真实补库候选',
      priority: 'P1',
      status: 'ready',
      progress_percent: 99,
      progress_note: '当前 66 条已形成 approved 草案；本轮继续补入辰州傩戏、遵义会议、飞夺泸定桥和四渡赤水候选，覆盖 heritage_promo/documentary_short/ai_comic_drama/explainer_video。',
      related_plan_items: [4],
      target_video_types: coreVideoTypes,
      description: '继续扩展真实条目，优先讲解、非遗宣传、微纪录和 AI 漫剧，不跳过候选稿/审稿/草案流程。',
      acceptance_checks: [
        '新增候选必须包含 candidate_value、source_refs、writeback_hint 和 verification_note。',
        '每条候选必须标注事实/传说/改编边界。',
        '新增样板不得直接改写 data/provinces/*.md。',
      ],
      direct_writeback_to_province_markdown: false,
    },
    {
      task_id: 'mvp_completion_surface',
      title: 'MVP 与生产健康完成态',
      priority: 'P1',
      status: report.pipeline_stage === 'complete' ? 'ready' : 'blocked',
      progress_percent: 99,
      progress_note: 'MVP 已接入扩库 complete、66 条写回草案计数、复核交接签收 manifest/canonical signoff package、复核人身份覆盖率、审签批次归档、批次 ready/blocked 汇总、下载归档证据、runtime 覆盖证据和 1-5 项百分比；继续强调“完成候选但待人工写回”。',
      related_plan_items: [5],
      target_video_types: coreVideoTypes,
      description: '把“扩库候选完成但未写入正式知识库”的真实状态接入 Story Agent MVP 与生产健康面板。',
      acceptance_checks: [
        'MVP 证据显示 pipeline complete 与 approved writeback drafts。',
        '同时提示正式知识库仍需人工写回。',
        '生产健康报告保留只读写回草案边界。',
      ],
      direct_writeback_to_province_markdown: false,
    },
  ];
}

function buildFieldSupplementPriorityTargets(
  reviewPacket: DomainPackExpansionReviewPacket,
): DomainPackExpansionFieldSupplementTarget[] {
  return reviewPacket.batches
    .flatMap(batch => batch.review_items.flatMap(item =>
      item.field_workbench
        .filter(field => field.supplement_status === 'needs_candidate')
        .map(field => {
          const priorityScore = fieldSupplementPriorityScore(item);
          const priorityVideoTypes = matchedPriorityVideoTypes(item.target_video_types);
          return {
            review_item_id: item.review_item_id,
            batch_id: item.batch_id,
            pack_id: item.pack_id,
            entry_name: item.entry_name,
            province: item.province,
            priority: item.priority,
            target_video_types: item.target_video_types,
            review_status: item.review_status ?? 'candidate_review',
            writeback_status: item.writeback_status,
            field_id: field.field_id,
            priority_score: priorityScore,
            priority_video_types: priorityVideoTypes,
            priority_video_type_count: priorityVideoTypes.length,
            reason: fieldSupplementPriorityReason(item, field.field_id, priorityScore),
            review_questions: field.review_questions,
            forbidden_direct_claims: item.forbidden_direct_claims,
            recommended_action: `补 ${field.field_id} 的 candidate_value、source_refs、writeback_hint 和 verification_note；保持候选稿审稿，不直接写回 data/provinces/*.md。`,
          };
        }),
    ))
    .sort((a, b) =>
      b.priority_score - a.priority_score
      || a.priority.localeCompare(b.priority)
      || a.pack_id.localeCompare(b.pack_id)
      || a.entry_name.localeCompare(b.entry_name, 'zh-CN')
      || a.field_id.localeCompare(b.field_id),
    );
}

function buildReviewReadyPriorityTargets(
  reviewPacket: DomainPackExpansionReviewPacket,
): DomainPackExpansionReviewReadyTarget[] {
  return reviewPacket.batches
    .flatMap(batch => batch.review_items
      .filter(item => item.review_ready && (item.review_status ?? 'candidate_review') === 'candidate_review')
      .map(item => {
        const priorityScore = reviewReadyPriorityScore(item);
        const priorityVideoTypes = matchedPriorityVideoTypes(item.target_video_types);
        const reviewQuestions = [...new Set(item.field_workbench.flatMap(field => field.review_questions))];
        return {
          review_item_id: item.review_item_id,
          batch_id: item.batch_id,
          pack_id: item.pack_id,
          entry_name: item.entry_name,
          province: item.province,
          priority: item.priority,
          target_video_types: item.target_video_types,
          review_status: item.review_status ?? 'candidate_review',
          writeback_status: item.writeback_status,
          recommended_fields: item.recommended_fields,
          priority_score: priorityScore,
          priority_video_types: priorityVideoTypes,
          priority_video_type_count: priorityVideoTypes.length,
          field_workbench_item_count: item.field_workbench.length,
          field_review_ready_count: item.field_review_ready_count,
          field_review_blocker_count: item.field_review_blocker_count,
          field_review_ready_percent: item.field_review_ready_percent,
          review_questions: reviewQuestions,
          forbidden_direct_claims: item.forbidden_direct_claims,
          reason: reviewReadyPriorityReason(item, priorityScore),
          recommended_action: '人工审阅 candidate_markdown、source_refs、verification_note 和 forbidden_direct_claims；确认来源边界后再标记 approved 并进入写回草案，不直接写回 data/provinces/*.md。',
        };
      }))
    .sort((a, b) =>
      b.priority_score - a.priority_score
      || a.priority.localeCompare(b.priority)
      || a.pack_id.localeCompare(b.pack_id)
      || a.entry_name.localeCompare(b.entry_name, 'zh-CN'),
    );
}

function fieldSupplementPriorityScore(item: DomainPackExpansionReviewItem): number {
  const videoTypeScore = Math.max(0, ...item.target_video_types.map(videoTypePriorityScore));
  const priorityVideoTypeCoverageScore = matchedPriorityVideoTypes(item.target_video_types).length * 4;
  const packPriorityScore = item.priority === 'P0' ? 40 : item.priority === 'P1' ? 20 : 10;
  const reviewScore = (item.review_status ?? 'candidate_review') === 'candidate_review' ? 6 : 0;
  return videoTypeScore + priorityVideoTypeCoverageScore + packPriorityScore + reviewScore;
}

function reviewReadyPriorityScore(item: DomainPackExpansionReviewItem): number {
  const videoTypeScore = Math.max(0, ...item.target_video_types.map(videoTypePriorityScore));
  const priorityVideoTypeCoverageScore = matchedPriorityVideoTypes(item.target_video_types).length * 4;
  const packPriorityScore = item.priority === 'P0' ? 40 : item.priority === 'P1' ? 20 : 10;
  const reviewStatusScore = (item.review_status ?? 'candidate_review') === 'candidate_review' ? 8 : 0;
  const readinessScore = item.review_ready ? 12 : 0;
  return videoTypeScore + priorityVideoTypeCoverageScore + packPriorityScore + reviewStatusScore + readinessScore;
}

function matchedPriorityVideoTypes(videoTypes: string[]): string[] {
  const priorityVideoTypes = new Set(['explainer_video', 'heritage_promo', 'documentary_short', 'ai_comic_drama']);
  return videoTypes.filter(videoType => priorityVideoTypes.has(videoType));
}

function videoTypePriorityScore(videoType: string): number {
  const priorityScores: Record<string, number> = {
    explainer_video: 50,
    heritage_promo: 50,
    documentary_short: 50,
    ai_comic_drama: 50,
    education_training: 24,
    lecture_video: 20,
    social_short: 18,
    children_story: 16,
  };
  return priorityScores[videoType] ?? 8;
}

function fieldSupplementPriorityReason(
  item: DomainPackExpansionReviewItem,
  fieldId: string,
  priorityScore: number,
): string {
  const videoTypes = item.target_video_types.join('/');
  return `${item.priority} · ${videoTypes} · ${item.entry_name} 缺 ${fieldId} 候选值，priority_score=${priorityScore}`;
}

function reviewReadyPriorityReason(
  item: DomainPackExpansionReviewItem,
  priorityScore: number,
): string {
  const priorityVideoTypes = matchedPriorityVideoTypes(item.target_video_types).join('/') || 'none';
  return `${item.priority} · priority_video_types=${priorityVideoTypes} · 字段送审 ${item.field_review_ready_count}/${item.field_workbench.length} · ${item.entry_name} 等待人工审稿，priority_score=${priorityScore}`;
}

function buildDomainPackExpansionReviewPacket(
  report: DomainPackExpansionCandidateReportDraft,
  sourceBatches: ExpansionBatch[],
  includeMarkdown: boolean,
  reviewState: Map<string, DomainPackExpansionResolvedReviewStateItem>,
): DomainPackExpansionReviewPacket {
  const reviewBatches = sourceBatches.map(batch => {
    const reviewItems = batch.seed_targets.map((target, index) => buildReviewItem(batch, target, index, reviewState));
    return {
      batch_id: batch.batch_id,
      pack_id: batch.pack_id,
      entry_name: batch.entry_name,
      priority: batch.priority,
      status: batch.status,
      target_video_types: batch.target_video_types,
      field_groups: batch.field_groups.map(group => ({
        group_id: group.group_id,
        candidate_fields: group.candidate_fields,
        review_questions: group.review_questions,
      })),
      review_item_count: reviewItems.length,
      review_items: reviewItems,
    };
  });

  const reviewItems = reviewBatches.flatMap(batch => batch.review_items);
  const fieldWorkbenchItemCount = reviewItems.reduce((sum, item) => sum + item.field_workbench.length, 0);
  const fieldSupplementCandidateCount = reviewItems.reduce((sum, item) => sum + item.field_supplement_candidate_count, 0);
  const fieldMissingCandidateCount = reviewItems.reduce((sum, item) => sum + item.field_missing_candidate_count, 0);
  const fieldReviewReadyCount = reviewItems.reduce((sum, item) => sum + item.field_review_ready_count, 0);
  const fieldReviewBlockerCount = reviewItems.reduce((sum, item) => sum + item.field_review_blocker_count, 0);
  const packet: Omit<DomainPackExpansionReviewPacket, 'markdown'> = {
    schema_version: 'domain-pack-expansion-review-packet/v1',
    generated_at: report.generated_at,
    source_schema_version: report.source_schema_version,
    domain_id: report.domain_id,
    status: report.status,
    review_policy: report.review_policy,
    batch_count: reviewBatches.length,
    review_item_count: reviewBatches.reduce((sum, batch) => sum + batch.review_item_count, 0),
    candidate_field_count: report.candidate_field_count,
    field_workbench_item_count: fieldWorkbenchItemCount,
    field_supplement_candidate_count: fieldSupplementCandidateCount,
    field_missing_candidate_count: fieldMissingCandidateCount,
    field_candidate_completion_percent: completionPercent(fieldSupplementCandidateCount, fieldWorkbenchItemCount),
    field_review_ready_count: fieldReviewReadyCount,
    field_review_blocker_count: fieldReviewBlockerCount,
    field_review_ready_percent: completionPercent(fieldReviewReadyCount, fieldWorkbenchItemCount),
    review_ready_item_count: reviewItems.filter(item => item.review_ready).length,
    review_blocked_item_count: reviewItems.filter(item => !item.review_ready).length,
    batches: reviewBatches,
    review_status_counts: countReviewStatuses(reviewItems),
    approved_writeback_draft_count: reviewItems.filter(item =>
      item.review_status === 'approved' && Boolean(item.writeback_draft_markdown),
    ).length,
  };

  return includeMarkdown
    ? { ...packet, markdown: renderDomainPackExpansionReviewPacketMarkdown(packet) }
    : packet;
}

function buildReviewItem(
  batch: ExpansionBatch,
  target: ExpansionSeedTarget,
  index: number,
  reviewState: Map<string, DomainPackExpansionResolvedReviewStateItem>,
): DomainPackExpansionReviewItem {
  const reviewItemId = `${batch.batch_id}::target_${String(index + 1).padStart(2, '0')}`;
  const stateItem = reviewState.get(reviewItemId);
  const reviewStatus = stateItem?.review_status ?? 'candidate_review';
  const fieldWorkbench = buildFieldWorkbench(batch, target);
  const fieldSupplementCandidateCount = fieldWorkbench.filter(field => field.supplement_status === 'candidate_draft').length;
  const fieldMissingCandidateCount = Math.max(0, fieldWorkbench.length - fieldSupplementCandidateCount);
  const fieldReviewReadyCount = fieldWorkbench.filter(field => field.review_ready).length;
  const fieldReviewBlockerCount = Math.max(0, fieldWorkbench.length - fieldReviewReadyCount);
  const item: DomainPackExpansionReviewItemDraft = {
    review_item_id: reviewItemId,
    batch_id: batch.batch_id,
    pack_id: batch.pack_id,
    entry_name: target.entry_name,
    province: target.province,
    priority: batch.priority,
    target_video_types: batch.target_video_types,
    candidate_status: target.candidate_status,
    recommended_fields: target.recommended_fields,
    forbidden_direct_claims: target.forbidden_direct_claims,
    field_workbench: fieldWorkbench,
    field_supplement_candidate_count: fieldSupplementCandidateCount,
    field_missing_candidate_count: fieldMissingCandidateCount,
    field_candidate_completion_percent: completionPercent(fieldSupplementCandidateCount, fieldWorkbench.length),
    field_review_ready_count: fieldReviewReadyCount,
    field_review_blocker_count: fieldReviewBlockerCount,
    field_review_ready_percent: completionPercent(fieldReviewReadyCount, fieldWorkbench.length),
    review_ready: fieldReviewBlockerCount === 0,
    review_status: reviewStatus,
    review_note: stateItem?.review_note,
    reviewed_at: stateItem?.reviewed_at,
    reviewer_id: stateItem?.reviewer_id,
    reviewer_name: stateItem?.reviewer_name,
    reviewed_by: stateItem?.reviewed_by,
    signoff_batch_id: stateItem?.signoff_batch_id,
    signoff_batch_note: stateItem?.signoff_batch_note,
    review_state_source: stateItem?.review_state_source ?? 'none',
    review_state_overrides_seed: stateItem?.review_state_overrides_seed ?? false,
    review_state_seed_status: stateItem?.review_state_seed_status,
    review_state_seed_writeback_status: stateItem?.review_state_seed_writeback_status,
    review_state_runtime_status: stateItem?.review_state_runtime_status,
    review_state_runtime_writeback_status: stateItem?.review_state_runtime_writeback_status,
    writeback_status: reviewStatus === 'approved'
      ? (stateItem?.writeback_status ?? 'draft_ready')
      : undefined,
    writeback_note: reviewStatus === 'approved' ? stateItem?.writeback_note : undefined,
    writeback_updated_at: reviewStatus === 'approved' ? stateItem?.writeback_updated_at : undefined,
  };

  return {
    ...item,
    writeback_draft_markdown: reviewStatus === 'approved'
      ? renderDomainPackExpansionWritebackDraftMarkdown(item)
      : undefined,
    candidate_markdown: renderDomainPackExpansionReviewItemMarkdown(item),
  };
}

function completionPercent(completedCount: number, totalCount: number): number {
  if (totalCount <= 0) return 100;
  return Math.round((completedCount / totalCount) * 100);
}

function buildPipelineProgress(
  report: DomainPackExpansionCandidateReportDraft,
  reviewPacket: DomainPackExpansionReviewPacket,
): { percent: number; stage: DomainPackExpansionPipelineStage } {
  const hasReviewItems = reviewPacket.review_item_count > 0;
  const requiredPackCoveragePercent = completionPercent(
    report.covered_required_pack_ids.length,
    report.required_pack_ids.length,
  );
  const fieldCandidatePercent = hasReviewItems ? (reviewPacket.field_candidate_completion_percent ?? 0) : 0;
  const fieldReviewReadyPercent = hasReviewItems ? (reviewPacket.field_review_ready_percent ?? 0) : 0;
  const reviewReadyItemPercent = hasReviewItems
    ? completionPercent(reviewPacket.review_ready_item_count ?? 0, reviewPacket.review_item_count)
    : 0;
  const reviewApprovedPercent = hasReviewItems
    ? completionPercent(reviewPacket.review_status_counts?.approved ?? 0, reviewPacket.review_item_count)
    : 0;
  const writebackDraftPercent = hasReviewItems
    ? completionPercent(reviewPacket.approved_writeback_draft_count ?? 0, reviewPacket.review_item_count)
    : 0;
  const percent = Math.round(
    requiredPackCoveragePercent * 0.2
    + fieldCandidatePercent * 0.25
    + fieldReviewReadyPercent * 0.2
    + reviewReadyItemPercent * 0.1
    + reviewApprovedPercent * 0.15
    + writebackDraftPercent * 0.1,
  );
  const stage: DomainPackExpansionPipelineStage = requiredPackCoveragePercent < 100
    ? 'candidate_setup'
    : fieldCandidatePercent < 100
      ? 'field_supplement'
      : fieldReviewReadyPercent < 100 || reviewReadyItemPercent < 100
        ? 'review_readiness'
        : reviewApprovedPercent < 100
          ? 'human_review'
          : writebackDraftPercent < 100
            ? 'writeback_queue'
            : 'complete';
  return { percent, stage };
}

type FieldReviewReadyCandidate = Pick<
  DomainPackExpansionFieldWorkbenchItem,
  'supplement_status'
  | 'candidate_value'
  | 'evidence_level'
  | 'source_refs'
  | 'writeback_hint'
  | 'verification_note'
>;

function fieldReviewReadyMissing(field: FieldReviewReadyCandidate): string[] {
  const missing: string[] = [];
  if (field.supplement_status !== 'candidate_draft') missing.push('candidate_draft');
  if (!field.candidate_value?.trim()) missing.push('candidate_value');
  if (!field.evidence_level?.trim()) missing.push('evidence_level');
  if (field.source_refs.length === 0) missing.push('source_refs');
  if (!field.writeback_hint?.trim()) missing.push('writeback_hint');
  if (!field.verification_note?.trim()) missing.push('verification_note');
  return missing;
}

function buildFieldWorkbench(
  batch: ExpansionBatch,
  target: ExpansionSeedTarget,
): DomainPackExpansionFieldWorkbenchItem[] {
  const supplementByField = new Map(target.field_supplement_candidates.map(candidate => [candidate.field_id, candidate]));
  const fieldIds = [
    ...target.recommended_fields,
    ...target.field_supplement_candidates.map(candidate => candidate.field_id),
  ];

  return [...new Set(fieldIds)]
    .filter(Boolean)
    .map(fieldId => {
      const supplement = supplementByField.get(fieldId);
      const supplementStatus: DomainPackExpansionFieldWorkbenchItem['supplement_status'] = supplement
        ? 'candidate_draft'
        : 'needs_candidate';
      const reviewQuestions = batch.field_groups
        .filter(group => group.candidate_fields.includes(fieldId))
        .flatMap(group => group.review_questions);
      const field = {
        field_id: fieldId,
        supplement_status: supplementStatus,
        candidate_value: supplement?.candidate_value,
        evidence_level: supplement?.evidence_level,
        source_refs: supplement?.source_refs ?? [],
        review_questions: [...new Set(reviewQuestions)],
        writeback_hint: supplement?.writeback_hint,
        verification_note: supplement?.verification_note,
      };
      const reviewReadyMissing = fieldReviewReadyMissing(field);
      return {
        ...field,
        review_ready: reviewReadyMissing.length === 0,
        review_ready_missing: reviewReadyMissing,
      };
    });
}

function renderDomainPackExpansionCandidateMarkdown(
  report: Omit<DomainPackExpansionCandidateReport, 'markdown'>,
): string {
  const issueLines = report.issues.length
    ? report.issues.map(issue =>
      `- ${issue.severity} · ${issue.issue_type}${issue.pack_id ? ` · ${issue.pack_id}` : ''}: ${issue.message}`,
    )
    : ['- none'];
  const batchLines = report.batches.length
    ? report.batches.map(batch =>
      `- ${batch.priority} · ${batch.pack_id} · ${batch.batch_id}: targets=${batch.seed_target_count}, fields=${batch.candidate_field_count}, status=${batch.status}`,
    )
    : ['- none'];
  const preflight = report.writeback_preflight;
  const priorityTargetLines = renderFieldSupplementPriorityTargetLines(report.field_supplement_priority_targets.slice(0, 24));
  const reviewReadyTargetLines = renderReviewReadyPriorityTargetLines(report.review_ready_priority_targets.slice(0, 24));
  const nextDevelopmentTaskLines = renderNextDevelopmentTaskLines(report.next_development_tasks);

  return [
    '# Domain Pack Expansion Candidates',
    '',
    `> schema_version: ${report.schema_version}`,
    `> generated_at: ${report.generated_at}`,
    `> source_schema_version: ${report.source_schema_version}`,
    `> updated_at: ${report.updated_at}`,
    `> status: ${report.status}`,
    '',
    '## Review Gate',
    '',
    `- direct_writeback_to_province_markdown: ${report.review_policy.direct_writeback_to_province_markdown}`,
    `- requires_candidate_markdown: ${report.review_policy.requires_candidate_markdown}`,
    `- requires_human_review: ${report.review_policy.requires_human_review}`,
    `- requires_source_level: ${report.review_policy.requires_source_level}`,
    '',
    '## Coverage',
    '',
    `- required_pack_count: ${report.required_pack_ids.length}`,
    `- covered_required_pack_count: ${report.covered_required_pack_ids.length}`,
    `- missing_required_pack_ids: ${report.missing_required_pack_ids.join(', ') || 'none'}`,
    `- batch_count: ${report.batch_count}`,
    `- seed_target_count: ${report.seed_target_count}`,
    `- candidate_field_count: ${report.candidate_field_count}`,
    `- pipeline_progress_percent: ${report.pipeline_progress_percent}`,
    `- pipeline_stage: ${report.pipeline_stage}`,
    `- field_workbench_item_count: ${report.field_workbench_item_count ?? 0}`,
    `- field_supplement_candidate_count: ${report.field_supplement_candidate_count ?? 0}`,
    `- field_missing_candidate_count: ${report.field_missing_candidate_count ?? 0}`,
    `- field_candidate_completion_percent: ${report.field_candidate_completion_percent ?? 100}`,
    `- field_review_ready_count: ${report.field_review_ready_count ?? 0}`,
    `- field_review_blocker_count: ${report.field_review_blocker_count ?? 0}`,
    `- field_review_ready_percent: ${report.field_review_ready_percent ?? 100}`,
    `- review_ready_item_count: ${report.review_ready_item_count ?? 0}`,
    `- review_blocked_item_count: ${report.review_blocked_item_count ?? 0}`,
    `- field_supplement_priority_target_count: ${report.field_supplement_priority_target_count}`,
    `- review_ready_priority_target_count: ${report.review_ready_priority_target_count}`,
    `- video_type_coverage_count: ${report.video_type_coverage_count}`,
    `- review_packet_schema_version: ${report.review_packet.schema_version}`,
    `- review_packet_item_count: ${report.review_packet.review_item_count}`,
    `- review_packet_markdown: ${report.review_packet.markdown ? 'included' : 'omitted'}`,
    '',
    '## Writeback Safety Preflight',
    '',
    `- schema_version: ${preflight.schema_version}`,
    `- direct_writeback_to_province_markdown: ${preflight.direct_writeback_to_province_markdown}`,
    `- province_markdown_written: ${preflight.province_markdown_written}`,
    `- approved_draft_count: ${preflight.approved_draft_count}`,
    `- draft_ready_count: ${preflight.draft_ready_count}`,
    `- queued_count: ${preflight.queued_count}`,
    `- written_back_count: ${preflight.written_back_count}`,
    `- needs_revision_count: ${preflight.needs_revision_count}`,
    `- target_file_count: ${preflight.target_file_count}`,
    `- target_files: ${preflight.target_files.join(', ') || 'none'}`,
    `- manual_review_required_count: ${preflight.manual_review_required_count}`,
    `- blocked_direct_writeback_count: ${preflight.blocked_direct_writeback_count}`,
    `- ready_for_unified_export: ${preflight.ready_for_unified_export}`,
    ...preflight.safety_checks.map(check => `- safety_check: ${check}`),
    '',
    '## Next Development Tasks',
    '',
    ...nextDevelopmentTaskLines,
    '',
    '## Video Type Coverage',
    '',
    ...renderVideoTypeCoverageLines(report.coverage_by_video_type),
    '',
    '## Next Field Supplement Targets',
    '',
    `- shown: ${priorityTargetLines.length}/${report.field_supplement_priority_target_count}`,
    ...priorityTargetLines,
    '',
    '## Next Review Ready Targets',
    '',
    `- shown: ${reviewReadyTargetLines.length}/${report.review_ready_priority_target_count}`,
    ...reviewReadyTargetLines,
    '',
    '## Batches',
    '',
    ...batchLines,
    '',
    '## Issues',
    '',
    ...issueLines,
  ].join('\n');
}

function renderNextDevelopmentTaskLines(tasks: DomainPackExpansionNextDevelopmentTask[]): string[] {
  if (tasks.length === 0) return ['- none'];
  return tasks.flatMap(task => [
    `- ${task.priority} · ${task.status} · ${task.progress_percent}% · ${task.task_id}: ${task.title}`,
    `  - progress_percent: ${task.progress_percent}`,
    `  - progress_note: ${task.progress_note}`,
    `  - related_plan_items: ${task.related_plan_items.join(', ')}`,
    `  - target_video_types: ${task.target_video_types.join(', ') || 'none'}`,
    `  - direct_writeback_to_province_markdown: ${task.direct_writeback_to_province_markdown}`,
    `  - description: ${task.description}`,
    ...task.acceptance_checks.map(check => `  - acceptance: ${check}`),
  ]);
}

function renderFieldSupplementPriorityTargetLines(
  targets: DomainPackExpansionFieldSupplementTarget[],
): string[] {
  if (targets.length === 0) return ['- none'];
  return targets.map(target =>
    `- score=${target.priority_score} · priority_video_types=${target.priority_video_type_count}(${target.priority_video_types.join('/') || 'none'}) · ${target.priority} · ${target.pack_id} · ${target.entry_name} · ${target.field_id} · ${target.province} · ${target.target_video_types.join('/')}`,
  );
}

function renderReviewReadyPriorityTargetLines(
  targets: DomainPackExpansionReviewReadyTarget[],
): string[] {
  if (targets.length === 0) return ['- none'];
  return targets.map(target =>
    `- score=${target.priority_score} · priority_video_types=${target.priority_video_type_count}(${target.priority_video_types.join('/') || 'none'}) · ${target.priority} · ${target.pack_id} · ${target.entry_name} · ${target.province} · fields=${target.field_review_ready_count}/${target.field_workbench_item_count} · ${target.target_video_types.join('/')}`,
  );
}

function buildVideoTypeCoverage(
  batches: ExpansionBatch[],
  reviewPacket: DomainPackExpansionReviewPacket,
): DomainPackExpansionVideoTypeCoverageSummary[] {
  const reviewBatchById = new Map(reviewPacket.batches.map(batch => [batch.batch_id, batch]));
  const coverage = new Map<string, {
    packIds: Set<string>;
    batchIds: Set<string>;
    provinces: Set<string>;
    candidateFields: Set<string>;
    seedTargetCount: number;
    reviewItems: DomainPackExpansionReviewItem[];
  }>();

  for (const batch of batches) {
    const videoTypes = [...new Set(batch.target_video_types.map(type => type.trim()).filter(Boolean))];
    const batchCandidateFields = new Set<string>();
    for (const group of batch.field_groups) {
      for (const field of group.candidate_fields) batchCandidateFields.add(field);
    }
    for (const target of batch.seed_targets) {
      for (const field of target.recommended_fields) batchCandidateFields.add(field);
    }

    const reviewItems = reviewBatchById.get(batch.batch_id)?.review_items ?? [];
    for (const videoType of videoTypes) {
      const item = coverage.get(videoType) ?? {
        packIds: new Set<string>(),
        batchIds: new Set<string>(),
        provinces: new Set<string>(),
        candidateFields: new Set<string>(),
        seedTargetCount: 0,
        reviewItems: [],
      };
      item.packIds.add(batch.pack_id);
      item.batchIds.add(batch.batch_id);
      for (const target of batch.seed_targets) item.provinces.add(target.province);
      for (const field of batchCandidateFields) item.candidateFields.add(field);
      item.seedTargetCount += batch.seed_targets.length;
      item.reviewItems.push(...reviewItems);
      coverage.set(videoType, item);
    }
  }

  return [...coverage.entries()]
    .map(([videoType, item]) => {
      const approvedItems = item.reviewItems.filter(reviewItem => reviewItem.review_status === 'approved');
      return {
        video_type: videoType,
        batch_count: item.batchIds.size,
        seed_target_count: item.seedTargetCount,
        candidate_field_count: item.candidateFields.size,
        field_workbench_item_count: item.reviewItems.reduce((sum, reviewItem) => sum + reviewItem.field_workbench.length, 0),
        field_supplement_candidate_count: item.reviewItems.reduce((sum, reviewItem) => sum + reviewItem.field_supplement_candidate_count, 0),
        field_missing_candidate_count: item.reviewItems.reduce((sum, reviewItem) => sum + reviewItem.field_missing_candidate_count, 0),
        field_candidate_completion_percent: completionPercent(
          item.reviewItems.reduce((sum, reviewItem) => sum + reviewItem.field_supplement_candidate_count, 0),
          item.reviewItems.reduce((sum, reviewItem) => sum + reviewItem.field_workbench.length, 0),
        ),
        field_review_ready_count: item.reviewItems.reduce((sum, reviewItem) => sum + reviewItem.field_review_ready_count, 0),
        field_review_blocker_count: item.reviewItems.reduce((sum, reviewItem) => sum + reviewItem.field_review_blocker_count, 0),
        field_review_ready_percent: completionPercent(
          item.reviewItems.reduce((sum, reviewItem) => sum + reviewItem.field_review_ready_count, 0),
          item.reviewItems.reduce((sum, reviewItem) => sum + reviewItem.field_workbench.length, 0),
        ),
        pack_ids: [...item.packIds].sort((a, b) => a.localeCompare(b)),
        batch_ids: [...item.batchIds].sort((a, b) => a.localeCompare(b)),
        provinces: [...item.provinces].sort((a, b) => a.localeCompare(b, 'zh-CN')),
        review_status_counts: countReviewStatuses(item.reviewItems),
        approved_writeback_draft_count: approvedItems.filter(reviewItem =>
          Boolean(reviewItem.writeback_draft_markdown),
        ).length,
        writeback_status_counts: countApprovedReviewItemWritebackStatuses(approvedItems),
      };
    })
    .sort((a, b) => a.video_type.localeCompare(b.video_type));
}

function renderVideoTypeCoverageLines(coverage: DomainPackExpansionVideoTypeCoverageSummary[]): string[] {
  if (coverage.length === 0) return ['- none'];
  return coverage.map(item =>
    `- ${item.video_type}: batches=${item.batch_count}, targets=${item.seed_target_count}, fields=${item.candidate_field_count}, field_workbench=${item.field_workbench_item_count ?? 0}, field_samples=${item.field_supplement_candidate_count ?? 0}, field_missing=${item.field_missing_candidate_count ?? 0}, field_completion=${item.field_candidate_completion_percent ?? 100}%, field_review_ready=${item.field_review_ready_count ?? 0}, field_review_blockers=${item.field_review_blocker_count ?? 0}, field_review_ready_percent=${item.field_review_ready_percent ?? 100}%, approved=${item.review_status_counts.approved}, drafts=${item.approved_writeback_draft_count}, packs=${item.pack_ids.join(', ') || 'none'}, provinces=${item.provinces.join(', ') || 'none'}`,
  );
}

function renderDomainPackExpansionReviewPacketMarkdown(
  packet: Omit<DomainPackExpansionReviewPacket, 'markdown'>,
): string {
  const batchSections = packet.batches.length
    ? packet.batches.flatMap(batch => [
      `## ${batch.priority} · ${batch.pack_id} · ${batch.batch_id}`,
      '',
      `- entry_name: ${batch.entry_name}`,
      `- status: ${batch.status}`,
      `- target_video_types: ${batch.target_video_types.join(', ') || 'none'}`,
      `- review_item_count: ${batch.review_item_count}`,
      '',
      '### Field Groups',
      '',
      ...batch.field_groups.flatMap(group => [
        `#### ${group.group_id}`,
        '',
        'Candidate fields:',
        ...markdownList(group.candidate_fields),
        '',
        'Review questions:',
        ...markdownList(group.review_questions),
        '',
      ]),
      '### Candidate Review Items',
      '',
      ...batch.review_items.flatMap(item => [item.candidate_markdown, '']),
    ])
    : ['## Batches', '', '- none'];

  return [
    '# Domain Pack Expansion Review Packet',
    '',
    `> schema_version: ${packet.schema_version}`,
    `> generated_at: ${packet.generated_at}`,
    `> source_schema_version: ${packet.source_schema_version}`,
    `> domain_id: ${packet.domain_id}`,
    `> status: ${packet.status}`,
    '',
    '## Review Policy',
    '',
    `- direct_writeback_to_province_markdown: ${packet.review_policy.direct_writeback_to_province_markdown}`,
    `- requires_candidate_markdown: ${packet.review_policy.requires_candidate_markdown}`,
    `- requires_human_review: ${packet.review_policy.requires_human_review}`,
    `- requires_source_level: ${packet.review_policy.requires_source_level}`,
    '',
    '## Counts',
    '',
    `- batch_count: ${packet.batch_count}`,
    `- review_item_count: ${packet.review_item_count}`,
    `- candidate_field_count: ${packet.candidate_field_count}`,
    `- field_workbench_item_count: ${packet.field_workbench_item_count ?? 0}`,
    `- field_supplement_candidate_count: ${packet.field_supplement_candidate_count ?? 0}`,
    `- field_missing_candidate_count: ${packet.field_missing_candidate_count ?? 0}`,
    `- field_candidate_completion_percent: ${packet.field_candidate_completion_percent ?? 100}`,
    `- field_review_ready_count: ${packet.field_review_ready_count ?? 0}`,
    `- field_review_blocker_count: ${packet.field_review_blocker_count ?? 0}`,
    `- field_review_ready_percent: ${packet.field_review_ready_percent ?? 100}`,
    `- review_ready_item_count: ${packet.review_ready_item_count ?? 0}`,
    `- review_blocked_item_count: ${packet.review_blocked_item_count ?? 0}`,
    '',
    ...batchSections,
  ].join('\n').trim() + '\n';
}

function renderDomainPackExpansionReviewItemMarkdown(
  item: DomainPackExpansionReviewItemDraft,
): string {
  const fieldWorkbenchLines = item.field_workbench.length
    ? item.field_workbench.flatMap(renderFieldWorkbenchMarkdown)
    : ['- none'];
  return [
    `#### Candidate: ${item.entry_name}`,
    '',
    `- review_item_id: ${item.review_item_id}`,
    `- province: ${item.province}`,
    `- pack_id: ${item.pack_id}`,
    `- batch_id: ${item.batch_id}`,
    `- target_video_types: ${item.target_video_types.join(', ') || 'none'}`,
    `- candidate_status: ${item.candidate_status}`,
    `- review_status: ${item.review_status ?? 'candidate_review'}`,
    `- review_state_source: ${item.review_state_source}`,
    `- review_state_overrides_seed: ${item.review_state_overrides_seed}`,
    ...(item.review_state_seed_status ? [`- review_state_seed_status: ${item.review_state_seed_status}`] : []),
    ...(item.review_state_runtime_status ? [`- review_state_runtime_status: ${item.review_state_runtime_status}`] : []),
    `- candidate_draft_only: true`,
    `- direct_writeback_to_province_markdown: false`,
    ...(item.reviewed_at ? [`- reviewed_at: ${item.reviewed_at}`] : []),
    ...(reviewerDisplayName(item) ? [`- reviewed_by: ${reviewerDisplayName(item)}`] : []),
    ...(item.signoff_batch_id ? [`- signoff_batch_id: ${item.signoff_batch_id}`] : []),
    ...(item.signoff_batch_note ? [`- signoff_batch_note: ${item.signoff_batch_note}`] : []),
    ...(item.writeback_status ? [`- writeback_status: ${item.writeback_status}`] : []),
    '',
    'Recommended fields:',
    ...markdownList(item.recommended_fields),
    '',
    'Field supplement workbench:',
    `- completion: ${item.field_supplement_candidate_count}/${item.field_workbench.length} (${item.field_candidate_completion_percent}%), missing=${item.field_missing_candidate_count}`,
    `- review_ready: ${item.review_ready}`,
    `- review_ready_fields: ${item.field_review_ready_count}/${item.field_workbench.length} (${item.field_review_ready_percent}%), blockers=${item.field_review_blocker_count}`,
    ...fieldWorkbenchLines,
    '',
    'Forbidden direct claims:',
    ...markdownList(item.forbidden_direct_claims),
    '',
    'Review notes:',
    ...(item.review_note ? [`- 审稿备注：${item.review_note}`] : []),
    '- 候选稿只记录待补字段、禁写断言和审稿问题，不得直接改写 data/provinces/*.md。',
    '- 进入正式知识库前必须补足来源级证据，并经人工审稿后进入写回队列。',
  ].join('\n');
}

function renderFieldWorkbenchMarkdown(item: DomainPackExpansionFieldWorkbenchItem): string[] {
  return [
    `- ${item.field_id}: ${item.supplement_status}`,
    `  - review_ready: ${item.review_ready}`,
    ...(item.review_ready_missing.length ? [`  - review_ready_missing: ${item.review_ready_missing.join('；')}`] : []),
    ...(item.candidate_value ? [`  - 候选值：${item.candidate_value}`] : ['  - 候选值：待补']),
    ...(item.evidence_level ? [`  - evidence_level: ${item.evidence_level}`] : []),
    ...(item.source_refs.length ? [`  - source_refs: ${item.source_refs.join('；')}`] : []),
    ...(item.review_questions.length ? [`  - review_questions: ${item.review_questions.join('；')}`] : []),
    ...(item.writeback_hint ? [`  - writeback_hint: ${item.writeback_hint}`] : []),
    ...(item.verification_note ? [`  - verification_note: ${item.verification_note}`] : []),
  ];
}

function reviewerDisplayName(item: {
  reviewed_by?: string;
  reviewer_name?: string;
  reviewer_id?: string;
}): string | undefined {
  return item.reviewed_by?.trim() || item.reviewer_name?.trim() || item.reviewer_id?.trim() || undefined;
}

export function updateDomainPackExpansionReviewState(
  input: DomainPackExpansionReviewStateUpdateRequest,
  options: { updatedAt?: string } = {},
): DomainPackExpansionReviewStateUpdateResult {
  const baseReport = getDomainPackExpansionCandidateReport({ includeMarkdown: false });
  const currentItem = findReviewPacketItem(baseReport, input.review_item_id);
  if (!currentItem) {
    return {
      ok: false,
      message: `未找到扩库候选审稿项：${input.review_item_id}。`,
    };
  }
  const approvalBlocker = reviewApprovalBlockerMessage(input.review_status, [currentItem]);
  if (approvalBlocker) {
    return {
      ok: false,
      message: approvalBlocker,
    };
  }

  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const currentItems = loadDomainPackExpansionReviewStateItems();
  const nextItems = new Map(currentItems.map(item => [item.review_item_id, item]));
  const existing = nextItems.get(input.review_item_id);
  const reviewStatus = input.review_status;
  const reviewNote = input.review_note?.trim() || undefined;
  const reviewerId = input.reviewer_id?.trim() || existing?.reviewer_id;
  const reviewerName = input.reviewer_name?.trim() || existing?.reviewer_name;
  const reviewedBy = input.reviewed_by?.trim() || reviewerName || existing?.reviewed_by || reviewerId;
  const signoffBatchId = input.signoff_batch_id?.trim() || existing?.signoff_batch_id;
  const signoffBatchNote = input.signoff_batch_note?.trim() || existing?.signoff_batch_note;
  const writebackStatus = reviewStatus === 'approved'
    ? (input.writeback_status ?? existing?.writeback_status ?? 'draft_ready')
    : undefined;
  const writebackNote = reviewStatus === 'approved'
    ? (input.writeback_note?.trim() || existing?.writeback_note)
    : undefined;

  nextItems.set(input.review_item_id, {
    review_item_id: input.review_item_id,
    review_status: reviewStatus,
    review_note: reviewNote,
    reviewed_at: updatedAt,
    reviewer_id: reviewerId,
    reviewer_name: reviewerName,
    reviewed_by: reviewedBy,
    signoff_batch_id: signoffBatchId,
    signoff_batch_note: signoffBatchNote,
    writeback_status: writebackStatus,
    writeback_note: writebackNote,
    writeback_updated_at: writebackStatus ? updatedAt : undefined,
  });

  saveDomainPackExpansionReviewStateItems([...nextItems.values()], updatedAt);

  return {
    ok: true,
    report: getDomainPackExpansionCandidateReport({
      includeMarkdown: true,
      generatedAt: updatedAt,
    }),
  };
}

export function updateDomainPackExpansionReviewStateBulk(
  input: DomainPackExpansionReviewStateBulkUpdateRequest,
  options: { updatedAt?: string } = {},
): DomainPackExpansionReviewStateBulkUpdateServiceResult {
  const uniqueReviewItemIds = [...new Set(input.review_item_ids.map(id => id.trim()).filter(Boolean))];
  if (uniqueReviewItemIds.length === 0) {
    return {
      ok: false,
      message: '批量扩库审稿项不能为空。',
    };
  }

  const baseReport = getDomainPackExpansionCandidateReport({ includeMarkdown: false });
  const itemById = new Map(baseReport.review_packet.batches
    .flatMap(batch => batch.review_items)
    .map(item => [item.review_item_id, item]));
  const missingReviewItemIds = uniqueReviewItemIds.filter(reviewItemId => !itemById.has(reviewItemId));
  if (missingReviewItemIds.length > 0) {
    return {
      ok: false,
      message: `未找到 ${missingReviewItemIds.length} 个扩库候选审稿项：${missingReviewItemIds.slice(0, 5).join(', ')}。`,
    };
  }
  const approvalBlocker = reviewApprovalBlockerMessage(
    input.review_status,
    uniqueReviewItemIds.map(reviewItemId => itemById.get(reviewItemId)).filter((item): item is DomainPackExpansionReviewItem => Boolean(item)),
  );
  if (approvalBlocker) {
    return {
      ok: false,
      message: approvalBlocker,
    };
  }

  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const currentItems = loadDomainPackExpansionReviewStateItems();
  const nextItems = new Map(currentItems.map(item => [item.review_item_id, item]));
  const reviewNote = input.review_note?.trim() || undefined;
  const reviewerId = input.reviewer_id?.trim() || undefined;
  const reviewerName = input.reviewer_name?.trim() || undefined;
  const reviewedBy = input.reviewed_by?.trim() || reviewerName || reviewerId;
  const signoffBatchId = input.signoff_batch_id?.trim() || undefined;
  const signoffBatchNote = input.signoff_batch_note?.trim() || undefined;
  const writebackNote = input.review_status === 'approved'
    ? (input.writeback_note?.trim() || undefined)
    : undefined;

  for (const reviewItemId of uniqueReviewItemIds) {
    const existing = nextItems.get(reviewItemId);
    const writebackStatus = input.review_status === 'approved'
      ? (input.writeback_status ?? existing?.writeback_status ?? 'draft_ready')
      : undefined;
    nextItems.set(reviewItemId, {
      review_item_id: reviewItemId,
      review_status: input.review_status,
      review_note: reviewNote ?? existing?.review_note,
      reviewed_at: updatedAt,
      reviewer_id: reviewerId ?? existing?.reviewer_id,
      reviewer_name: reviewerName ?? existing?.reviewer_name,
      reviewed_by: reviewedBy ?? existing?.reviewed_by,
      signoff_batch_id: signoffBatchId ?? existing?.signoff_batch_id,
      signoff_batch_note: signoffBatchNote ?? existing?.signoff_batch_note,
      writeback_status: writebackStatus,
      writeback_note: writebackStatus ? (writebackNote ?? existing?.writeback_note) : undefined,
      writeback_updated_at: writebackStatus ? updatedAt : undefined,
    });
  }

  saveDomainPackExpansionReviewStateItems([...nextItems.values()], updatedAt);
  const report = getDomainPackExpansionCandidateReport({
    includeMarkdown: true,
    generatedAt: updatedAt,
  });

  return {
    ok: true,
    result: {
      schema_version: 'domain-pack-expansion-review-state-bulk-update/v1',
      updated_at: updatedAt,
      updated_count: uniqueReviewItemIds.length,
      missing_review_item_ids: [],
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
      report,
    },
  };
}

export function getDomainPackExpansionWritebackDraftPackage(
  input: DomainPackExpansionWritebackDraftPackageInput = {},
): DomainPackExpansionWritebackDraftPackage {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const filters = normalizeWritebackDraftFilters(input);
  const report = getDomainPackExpansionCandidateReport({
    includeMarkdown: false,
    generatedAt: exportedAt,
  });
  const approvedItems = report.review_packet.batches.flatMap(batch =>
    batch.review_items.filter(item => item.review_status === 'approved' && Boolean(item.writeback_draft_markdown)),
  );
  const items: DomainPackExpansionWritebackDraftItem[] = approvedItems
    .map(item => ({
      review_item_id: item.review_item_id,
      batch_id: item.batch_id,
      pack_id: item.pack_id,
      entry_name: item.entry_name,
      province: item.province,
      target_video_types: item.target_video_types,
      review_status: item.review_status ?? 'approved',
      review_note: item.review_note,
      reviewer_id: item.reviewer_id,
      reviewer_name: item.reviewer_name,
      reviewed_by: item.reviewed_by,
      signoff_batch_id: item.signoff_batch_id,
      signoff_batch_note: item.signoff_batch_note,
      review_state_source: item.review_state_source,
      review_state_overrides_seed: item.review_state_overrides_seed,
      review_state_seed_status: item.review_state_seed_status,
      review_state_seed_writeback_status: item.review_state_seed_writeback_status,
      review_state_runtime_status: item.review_state_runtime_status,
      review_state_runtime_writeback_status: item.review_state_runtime_writeback_status,
      writeback_status: item.writeback_status ?? 'draft_ready',
      writeback_note: item.writeback_note,
      suggested_file_path: suggestedProvinceFilePath(item.province),
      suggested_section_heading: `### ${item.entry_name}`,
      field_workbench: item.field_workbench,
      field_supplement_candidate_count: item.field_supplement_candidate_count,
      field_missing_candidate_count: item.field_missing_candidate_count,
      field_candidate_completion_percent: item.field_candidate_completion_percent,
      field_review_ready_count: item.field_review_ready_count,
      field_review_blocker_count: item.field_review_blocker_count,
      field_review_ready_percent: item.field_review_ready_percent,
      review_ready: item.review_ready,
      append_markdown: item.writeback_draft_markdown ?? renderDomainPackExpansionWritebackDraftMarkdown(item),
      writeback_draft_markdown: item.writeback_draft_markdown ?? renderDomainPackExpansionWritebackDraftMarkdown(item),
    }))
    .filter(item => matchesWritebackDraftFilters(item, filters));
  const statusCounts = countWritebackStatuses(items);

  const packageWithoutMarkdown: Omit<DomainPackExpansionWritebackDraftPackage, 'markdown'> = {
    schema_version: 'domain-pack-expansion-writeback-draft/v1',
    exported_at: exportedAt,
    domain_id: report.domain_id,
    direct_writeback_to_province_markdown: false,
    filters,
    approved_count: items.length,
    target_files: [...new Set(items.map(item => item.suggested_file_path))].sort((a, b) => a.localeCompare(b)),
    status_counts: statusCounts,
    items,
  };

  return {
    ...packageWithoutMarkdown,
    markdown: renderDomainPackExpansionWritebackDraftPackageMarkdown(packageWithoutMarkdown),
  };
}

function renderDomainPackExpansionWritebackDraftMarkdown(
  item: DomainPackExpansionReviewItemDraft,
): string {
  const candidateFields = item.field_workbench.filter(field => field.supplement_status === 'candidate_draft');
  const missingFields = item.field_workbench.filter(field => field.supplement_status !== 'candidate_draft');
  const candidateFieldLines = candidateFields.length
    ? candidateFields.flatMap(renderFieldWorkbenchMarkdown)
    : ['- none'];
  const missingFieldLines = missingFields.length
    ? missingFields.map(field => `- ${field.field_id}`)
    : ['- none'];

  return [
    `### ${item.entry_name}｜扩库候选审稿草案`,
    '',
    `> source: domain-pack-expansion-review-packet/v1`,
    `> review_item_id: ${item.review_item_id}`,
    `> pack_id: ${item.pack_id}`,
    `> province: ${item.province}`,
    `> review_status: ${item.review_status ?? 'candidate_review'}`,
    `> review_state_source: ${item.review_state_source}`,
    `> review_state_overrides_seed: ${item.review_state_overrides_seed}`,
    ...(reviewerDisplayName(item) ? [`> reviewed_by: ${reviewerDisplayName(item)}`] : []),
    ...(item.signoff_batch_id ? [`> signoff_batch_id: ${item.signoff_batch_id}`] : []),
    ...(item.signoff_batch_note ? [`> signoff_batch_note: ${item.signoff_batch_note}`] : []),
    `> direct_writeback_to_province_markdown: false`,
    '',
    '#### 待补生产字段',
    ...markdownList(item.recommended_fields),
    '',
    '#### 字段候选值',
    `- 完整度：${item.field_supplement_candidate_count}/${item.field_workbench.length}（${item.field_candidate_completion_percent}%）；缺口 ${item.field_missing_candidate_count} 个`,
    `- 审稿就绪：${item.review_ready}；字段 ${item.field_review_ready_count}/${item.field_workbench.length}（${item.field_review_ready_percent}%）；阻断 ${item.field_review_blocker_count} 个`,
    ...candidateFieldLines,
    '',
    '#### 仍需补候选值字段',
    ...missingFieldLines,
    '',
    '#### 禁写断言',
    ...markdownList(item.forbidden_direct_claims),
    '',
    '#### 审稿备注',
    item.review_note ? `- ${item.review_note}` : '- 待人工补充来源级证据和审稿意见。',
    '',
    '#### 写回边界',
    '- 本草案只作为人工补库采集清单，不是已核实事实内容。',
    '- 写入正式省份 Markdown 前必须补齐来源、核实方法和人工审稿记录。',
    '- 不得把禁写断言改写成事实，不得用候选字段替代来源证据。',
  ].join('\n');
}

function renderDomainPackExpansionWritebackDraftPackageMarkdown(
  pkg: Omit<DomainPackExpansionWritebackDraftPackage, 'markdown'>,
): string {
  const filterLines = renderWritebackDraftFilterLines(pkg.filters);
  const statusSummary = WRITEBACK_STATUSES.map(status => `- ${status}: ${pkg.status_counts[status] ?? 0}`);
  const itemSections = pkg.items.length
    ? pkg.items.flatMap(item => [
      `## ${item.suggested_file_path}`,
      '',
      `- review_item_id: ${item.review_item_id}`,
      `- writeback_status: ${item.writeback_status ?? 'draft_ready'}`,
      '',
      item.append_markdown,
      '',
    ])
    : ['## Items', '', '- none'];

  return [
    '# Domain Pack Expansion Writeback Draft',
    '',
    `> schema_version: ${pkg.schema_version}`,
    `> exported_at: ${pkg.exported_at}`,
    `> domain_id: ${pkg.domain_id}`,
    `> direct_writeback_to_province_markdown: ${pkg.direct_writeback_to_province_markdown}`,
    '',
    '## Summary',
    '',
    `- approved_count: ${pkg.approved_count}`,
    `- target_files: ${pkg.target_files.join(', ') || 'none'}`,
    '',
    '## Filters',
    '',
    ...filterLines,
    '',
    '## Writeback Status Counts',
    '',
    ...statusSummary,
    '',
    ...itemSections,
  ].join('\n').trim() + '\n';
}

function normalizeWritebackDraftFilters(
  input: DomainPackExpansionWritebackDraftPackageInput,
): DomainPackExpansionWritebackDraftFilter {
  const filters: DomainPackExpansionWritebackDraftFilter = {};
  const reviewItemIds = normalizeFilterValues(input.reviewItemIds);
  const packIds = normalizeFilterValues(input.packIds);
  const videoTypes = normalizeFilterValues(input.videoTypes);
  const provinces = normalizeFilterValues(input.provinces);
  const writebackStatuses = normalizeFilterValues(input.writebackStatuses)
    .filter((status): status is KnowledgeWritebackStatus => WRITEBACK_STATUSES.includes(status as KnowledgeWritebackStatus));

  if (reviewItemIds.length > 0) filters.review_item_ids = reviewItemIds;
  if (packIds.length > 0) filters.pack_ids = packIds;
  if (videoTypes.length > 0) filters.video_types = videoTypes;
  if (provinces.length > 0) filters.provinces = provinces;
  if (writebackStatuses.length > 0) filters.writeback_statuses = writebackStatuses;
  return filters;
}

function matchesWritebackDraftFilters(
  item: DomainPackExpansionWritebackDraftItem,
  filters: DomainPackExpansionWritebackDraftFilter,
): boolean {
  return (!filters.review_item_ids?.length || filters.review_item_ids.includes(item.review_item_id))
    && (!filters.pack_ids?.length || filters.pack_ids.includes(item.pack_id))
    && (!filters.video_types?.length || item.target_video_types.some(type => filters.video_types?.includes(type)))
    && (!filters.provinces?.length || filters.provinces.includes(item.province))
    && (!filters.writeback_statuses?.length || filters.writeback_statuses.includes(item.writeback_status ?? 'draft_ready'));
}

function renderWritebackDraftFilterLines(filters: DomainPackExpansionWritebackDraftFilter): string[] {
  const lines = [
    filters.review_item_ids?.length ? `- review_item_ids: ${filters.review_item_ids.join(', ')}` : undefined,
    filters.pack_ids?.length ? `- pack_ids: ${filters.pack_ids.join(', ')}` : undefined,
    filters.video_types?.length ? `- video_types: ${filters.video_types.join(', ')}` : undefined,
    filters.provinces?.length ? `- provinces: ${filters.provinces.join(', ')}` : undefined,
    filters.writeback_statuses?.length ? `- writeback_statuses: ${filters.writeback_statuses.join(', ')}` : undefined,
  ].filter((line): line is string => Boolean(line));
  return lines.length ? lines : ['- none'];
}

function findReviewPacketItem(
  report: DomainPackExpansionCandidateReport,
  reviewItemId: string,
): DomainPackExpansionReviewItem | undefined {
  return report.review_packet.batches
    .flatMap(batch => batch.review_items)
    .find(item => item.review_item_id === reviewItemId);
}

function reviewApprovalBlockerMessage(
  reviewStatus: DomainPackExpansionReviewStatus,
  items: DomainPackExpansionReviewItem[],
): string | undefined {
  if (reviewStatus !== 'approved') return undefined;
  const blockedItems = items.filter(item => !item.review_ready);
  if (blockedItems.length === 0) return undefined;
  const sample = blockedItems.slice(0, 5).map(item => {
    const blockerFields = item.field_workbench
      .filter(field => !field.review_ready)
      .slice(0, 3)
      .map(field => `${field.field_id}[${field.review_ready_missing.join('/') || 'unknown'}]`)
      .join('；');
    return `${item.review_item_id}：${blockerFields || `${item.field_review_blocker_count} 个字段阻断`}`;
  });
  return `扩库候选仍有字段审稿阻断，不能标记为 approved 或进入写回草案：${sample.join('；')}。请先补齐 candidate_value、evidence_level、source_refs、writeback_hint 和 verification_note。`;
}

function countReviewStatuses(items: DomainPackExpansionReviewItem[]): Record<DomainPackExpansionReviewStatus, number> {
  const counts = Object.fromEntries(REVIEW_STATUSES.map(status => [status, 0])) as Record<DomainPackExpansionReviewStatus, number>;
  for (const item of items) {
    counts[item.review_status ?? 'candidate_review'] += 1;
  }
  return counts;
}

function countWritebackStatuses(items: DomainPackExpansionWritebackDraftItem[]): Record<KnowledgeWritebackStatus, number> {
  const counts = Object.fromEntries(WRITEBACK_STATUSES.map(status => [status, 0])) as Record<KnowledgeWritebackStatus, number>;
  for (const item of items) {
    counts[item.writeback_status ?? 'draft_ready'] += 1;
  }
  return counts;
}

function countApprovedReviewItemWritebackStatuses(
  items: DomainPackExpansionReviewItem[],
): Record<KnowledgeWritebackStatus, number> {
  const counts = Object.fromEntries(WRITEBACK_STATUSES.map(status => [status, 0])) as Record<KnowledgeWritebackStatus, number>;
  for (const item of items) {
    counts[item.writeback_status ?? 'draft_ready'] += 1;
  }
  return counts;
}

function loadDomainPackExpansionReviewStateMap(): Map<string, DomainPackExpansionResolvedReviewStateItem> {
  return new Map(loadDomainPackExpansionResolvedReviewStateItems().map(item => [item.review_item_id, item]));
}

function loadDomainPackExpansionReviewStateItems(): DomainPackExpansionReviewStateItem[] {
  return loadDomainPackExpansionResolvedReviewStateItems().map(stripResolvedReviewStateMetadata);
}

function loadDomainPackExpansionResolvedReviewStateItems(): DomainPackExpansionResolvedReviewStateItem[] {
  const mergedItems = new Map<string, DomainPackExpansionReviewStateItem>();
  const seedItems = new Map<string, DomainPackExpansionReviewStateItem>();
  const runtimeItems = new Map<string, DomainPackExpansionReviewStateItem>();
  for (const [source, filePath] of [
    ['seed', reviewStateSeedFilePath()],
    ['runtime', reviewStateFilePath()],
  ] as const) {
    const file = loadDomainPackExpansionReviewStateFile(filePath);
    if (!file || file.schema_version !== 'domain-pack-expansion-review-state/v1' || !Array.isArray(file.items)) {
      continue;
    }
    for (const item of file.items) {
      const normalized = normalizeReviewStateItem(item);
      if (!normalized) continue;
      if (source === 'seed') seedItems.set(normalized.review_item_id, normalized);
      else runtimeItems.set(normalized.review_item_id, normalized);
      mergedItems.set(normalized.review_item_id, normalized);
    }
  }
  return [...mergedItems.values()].map(item => {
    const seedItem = seedItems.get(item.review_item_id);
    const runtimeItem = runtimeItems.get(item.review_item_id);
    const source: DomainPackExpansionReviewStateSource = runtimeItem
      ? 'runtime'
      : seedItem
        ? 'seed'
        : 'none';
    return {
      ...item,
      review_state_source: source,
      review_state_overrides_seed: Boolean(seedItem && runtimeItem),
      review_state_seed_status: seedItem?.review_status,
      review_state_seed_writeback_status: seedItem?.writeback_status,
      review_state_runtime_status: runtimeItem?.review_status,
      review_state_runtime_writeback_status: runtimeItem?.writeback_status,
    };
  });
}

function stripResolvedReviewStateMetadata(
  item: DomainPackExpansionResolvedReviewStateItem,
): DomainPackExpansionReviewStateItem {
  return {
    review_item_id: item.review_item_id,
    review_status: item.review_status,
    review_note: item.review_note,
    reviewed_at: item.reviewed_at,
    reviewer_id: item.reviewer_id,
    reviewer_name: item.reviewer_name,
    reviewed_by: item.reviewed_by,
    signoff_batch_id: item.signoff_batch_id,
    signoff_batch_note: item.signoff_batch_note,
    writeback_status: item.writeback_status,
    writeback_note: item.writeback_note,
    writeback_updated_at: item.writeback_updated_at,
  };
}

function loadDomainPackExpansionReviewStateFile(filePath: string): DomainPackExpansionReviewStateFile | undefined {
  if (!existsSync(filePath)) return undefined;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as DomainPackExpansionReviewStateFile;
  } catch {
    return undefined;
  }
}

function saveDomainPackExpansionReviewStateItems(
  items: DomainPackExpansionReviewStateItem[],
  updatedAt: string,
): void {
  const filePath = reviewStateFilePath();
  mkdirSync(resolve(filePath, '..'), { recursive: true });
  const sortedItems = [...items].sort((a, b) => a.review_item_id.localeCompare(b.review_item_id));
  writeFileSync(filePath, `${JSON.stringify({
    schema_version: 'domain-pack-expansion-review-state/v1',
    updated_at: updatedAt,
    direct_writeback_to_province_markdown: false,
    items: sortedItems,
  }, null, 2)}\n`);
}

function normalizeReviewStateItem(value: unknown): DomainPackExpansionReviewStateItem | undefined {
  if (!isRecord(value) || typeof value.review_item_id !== 'string' || typeof value.review_status !== 'string') {
    return undefined;
  }
  if (!REVIEW_STATUSES.includes(value.review_status as DomainPackExpansionReviewStatus)) return undefined;
  const writebackStatus = typeof value.writeback_status === 'string' && WRITEBACK_STATUSES.includes(value.writeback_status as KnowledgeWritebackStatus)
    ? value.writeback_status as KnowledgeWritebackStatus
    : undefined;

  return {
    review_item_id: value.review_item_id,
    review_status: value.review_status as DomainPackExpansionReviewStatus,
    review_note: typeof value.review_note === 'string' ? value.review_note : undefined,
    reviewed_at: typeof value.reviewed_at === 'string' ? value.reviewed_at : undefined,
    reviewer_id: typeof value.reviewer_id === 'string' ? value.reviewer_id : undefined,
    reviewer_name: typeof value.reviewer_name === 'string' ? value.reviewer_name : undefined,
    reviewed_by: typeof value.reviewed_by === 'string' ? value.reviewed_by : undefined,
    signoff_batch_id: typeof value.signoff_batch_id === 'string' ? value.signoff_batch_id : undefined,
    signoff_batch_note: typeof value.signoff_batch_note === 'string' ? value.signoff_batch_note : undefined,
    writeback_status: writebackStatus,
    writeback_note: typeof value.writeback_note === 'string' ? value.writeback_note : undefined,
    writeback_updated_at: typeof value.writeback_updated_at === 'string' ? value.writeback_updated_at : undefined,
  };
}

function suggestedProvinceFilePath(province: string): string {
  return `data/provinces/${province || '待确认'}.md`;
}

function markdownList(items: string[]): string[] {
  return items.length ? items.map(item => `- ${item}`) : ['- none'];
}

function normalizeFilterValues(values: string[] | undefined): string[] {
  if (!values) return [];
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function loadExpansionCandidateFile(): { file?: ExpansionCandidateFile } {
  try {
    const filePath = resolve(kbRoot(), 'domain-packs', CANDIDATE_FILE_NAME);
    return { file: JSON.parse(readFileSync(filePath, 'utf8')) as ExpansionCandidateFile };
  } catch {
    return {};
  }
}

function normalizeBatch(value: unknown): ExpansionBatch | undefined {
  if (!isRecord(value)) return undefined;
  const fieldGroups = Array.isArray(value.field_groups)
    ? value.field_groups.map(normalizeFieldGroup).filter((group): group is ExpansionFieldGroup => Boolean(group))
    : [];
  const seedTargets = Array.isArray(value.seed_targets)
    ? value.seed_targets.map(normalizeSeedTarget).filter((target): target is ExpansionSeedTarget => Boolean(target))
    : [];
  if (
    typeof value.batch_id !== 'string'
    || typeof value.pack_id !== 'string'
    || typeof value.entry_name !== 'string'
  ) return undefined;

  return {
    batch_id: value.batch_id,
    pack_id: value.pack_id,
    entry_name: value.entry_name,
    priority: typeof value.priority === 'string' ? value.priority : 'P2',
    status: typeof value.status === 'string' ? value.status : 'missing',
    target_video_types: isStringArray(value.target_video_types) ? value.target_video_types : [],
    field_groups: fieldGroups,
    seed_targets: seedTargets,
  };
}

function normalizeFieldGroup(value: unknown): ExpansionFieldGroup | undefined {
  if (!isRecord(value) || typeof value.group_id !== 'string') return undefined;
  return {
    group_id: value.group_id,
    candidate_fields: isStringArray(value.candidate_fields) ? value.candidate_fields : [],
    review_questions: isStringArray(value.review_questions) ? value.review_questions : [],
  };
}

function normalizeSeedTarget(value: unknown): ExpansionSeedTarget | undefined {
  if (!isRecord(value) || typeof value.entry_name !== 'string' || typeof value.province !== 'string') {
    return undefined;
  }
  return {
    entry_name: value.entry_name,
    province: value.province,
    recommended_fields: isStringArray(value.recommended_fields) ? value.recommended_fields : [],
    candidate_status: typeof value.candidate_status === 'string' ? value.candidate_status : 'missing',
    forbidden_direct_claims: isStringArray(value.forbidden_direct_claims) ? value.forbidden_direct_claims : [],
    field_supplement_candidates: Array.isArray(value.field_supplement_candidates)
      ? value.field_supplement_candidates
        .map(normalizeFieldSupplementCandidate)
        .filter((candidate): candidate is ExpansionFieldSupplementCandidate => Boolean(candidate))
      : [],
  };
}

function normalizeFieldSupplementCandidate(value: unknown): ExpansionFieldSupplementCandidate | undefined {
  if (!isRecord(value) || typeof value.field_id !== 'string' || typeof value.candidate_value !== 'string') {
    return undefined;
  }
  const fieldId = value.field_id.trim();
  const candidateValue = value.candidate_value.trim();
  if (!fieldId || !candidateValue) return undefined;
  return {
    field_id: fieldId,
    candidate_value: candidateValue,
    evidence_level: typeof value.evidence_level === 'string' ? value.evidence_level.trim() || undefined : undefined,
    source_refs: isStringArray(value.source_refs) ? value.source_refs.map(ref => ref.trim()).filter(Boolean) : [],
    writeback_hint: typeof value.writeback_hint === 'string' ? value.writeback_hint.trim() || undefined : undefined,
    verification_note: typeof value.verification_note === 'string' ? value.verification_note.trim() || undefined : undefined,
  };
}

function summarizeBatch(batch: ExpansionBatch): DomainPackExpansionBatchSummary {
  const candidateFields = new Set<string>();
  for (const group of batch.field_groups) {
    for (const field of group.candidate_fields) candidateFields.add(field);
  }
  for (const target of batch.seed_targets) {
    for (const field of target.recommended_fields) candidateFields.add(field);
  }

  return {
    batch_id: batch.batch_id,
    pack_id: batch.pack_id,
    entry_name: batch.entry_name,
    priority: batch.priority,
    status: batch.status,
    target_video_types: batch.target_video_types,
    field_group_count: batch.field_groups.length,
    candidate_field_count: candidateFields.size,
    field_supplement_candidate_count: batch.seed_targets.reduce(
      (sum, target) => sum + target.field_supplement_candidates.length,
      0,
    ),
    seed_target_count: batch.seed_targets.length,
    provinces: [...new Set(batch.seed_targets.map(target => target.province))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function duplicateStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort((a, b) => a.localeCompare(b));
}

function statusFromIssues(issues: DomainPackExpansionCandidateIssue[]): DomainPackProductionHealthStatus {
  if (issues.some(issue => issue.severity === 'error')) return 'failed';
  if (issues.length > 0) return 'warning';
  return 'passed';
}

function kbRoot(): string {
  return process.env.KB_ROOT || resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
}

function generatedRoot(): string {
  return process.env.WEB_GENERATED_ROOT || resolve(kbRoot(), '..', 'web', 'generated');
}

function reviewStateFilePath(): string {
  return resolve(generatedRoot(), 'domain-pack-expansion', REVIEW_STATE_FILE_NAME);
}

function reviewStateSeedFilePath(): string {
  return resolve(kbRoot(), 'domain-packs', REVIEW_STATE_SEED_FILE_NAME);
}
