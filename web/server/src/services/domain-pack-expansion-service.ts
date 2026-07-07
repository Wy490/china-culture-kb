import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  DomainPackExpansionReviewStateBulkUpdateRequest,
  DomainPackExpansionReviewStateBulkUpdateResult,
  DomainPackExpansionReviewStateItem,
  DomainPackExpansionReviewStateUpdateRequest,
  DomainPackExpansionReviewStatus,
  DomainPackExpansionWritebackDraftFilter,
  DomainPackExpansionWritebackDraftItem,
  DomainPackExpansionWritebackDraftPackage,
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
  candidate_markdown: string;
  review_status?: DomainPackExpansionReviewStatus;
  review_note?: string;
  reviewed_at?: string;
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
  batches: DomainPackExpansionBatchSummary[];
  issues: DomainPackExpansionCandidateIssue[];
  review_packet: DomainPackExpansionReviewPacket;
  markdown?: string;
}

type DomainPackExpansionCandidateReportDraft = Omit<
  DomainPackExpansionCandidateReport,
  'markdown' | 'review_packet'
>;
type DomainPackExpansionReviewItemDraft = Omit<DomainPackExpansionReviewItem, 'candidate_markdown'>;

interface DomainPackExpansionReviewStateFile {
  schema_version?: string;
  updated_at?: string;
  items?: unknown[];
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
  reviewState: Map<string, DomainPackExpansionReviewStateItem> = new Map(),
): DomainPackExpansionCandidateReport {
  const reviewPacket = buildDomainPackExpansionReviewPacket(report, sourceBatches, includeMarkdown, reviewState);
  const reportWithPacket: Omit<DomainPackExpansionCandidateReport, 'markdown'> = {
    ...report,
    review_packet: reviewPacket,
  };

  return includeMarkdown
    ? { ...reportWithPacket, markdown: renderDomainPackExpansionCandidateMarkdown(reportWithPacket) }
    : reportWithPacket;
}

function buildDomainPackExpansionReviewPacket(
  report: DomainPackExpansionCandidateReportDraft,
  sourceBatches: ExpansionBatch[],
  includeMarkdown: boolean,
  reviewState: Map<string, DomainPackExpansionReviewStateItem>,
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
  reviewState: Map<string, DomainPackExpansionReviewStateItem>,
): DomainPackExpansionReviewItem {
  const reviewItemId = `${batch.batch_id}::target_${String(index + 1).padStart(2, '0')}`;
  const stateItem = reviewState.get(reviewItemId);
  const reviewStatus = stateItem?.review_status ?? 'candidate_review';
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
    review_status: reviewStatus,
    review_note: stateItem?.review_note,
    reviewed_at: stateItem?.reviewed_at,
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
    `- review_packet_schema_version: ${report.review_packet.schema_version}`,
    `- review_packet_item_count: ${report.review_packet.review_item_count}`,
    `- review_packet_markdown: ${report.review_packet.markdown ? 'included' : 'omitted'}`,
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
    '',
    ...batchSections,
  ].join('\n').trim() + '\n';
}

function renderDomainPackExpansionReviewItemMarkdown(
  item: DomainPackExpansionReviewItemDraft,
): string {
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
    `- candidate_draft_only: true`,
    `- direct_writeback_to_province_markdown: false`,
    ...(item.reviewed_at ? [`- reviewed_at: ${item.reviewed_at}`] : []),
    ...(item.writeback_status ? [`- writeback_status: ${item.writeback_status}`] : []),
    '',
    'Recommended fields:',
    ...markdownList(item.recommended_fields),
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

  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const currentItems = loadDomainPackExpansionReviewStateItems();
  const nextItems = new Map(currentItems.map(item => [item.review_item_id, item]));
  const existing = nextItems.get(input.review_item_id);
  const reviewStatus = input.review_status;
  const reviewNote = input.review_note?.trim() || undefined;
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

  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const currentItems = loadDomainPackExpansionReviewStateItems();
  const nextItems = new Map(currentItems.map(item => [item.review_item_id, item]));
  const reviewNote = input.review_note?.trim() || undefined;
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
      review_note: reviewNote,
      reviewed_at: updatedAt,
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
      writeback_status: item.writeback_status ?? 'draft_ready',
      writeback_note: item.writeback_note,
      suggested_file_path: suggestedProvinceFilePath(item.province),
      suggested_section_heading: `### ${item.entry_name}`,
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
  return [
    `### ${item.entry_name}｜扩库候选审稿草案`,
    '',
    `> source: domain-pack-expansion-review-packet/v1`,
    `> review_item_id: ${item.review_item_id}`,
    `> pack_id: ${item.pack_id}`,
    `> province: ${item.province}`,
    `> review_status: ${item.review_status ?? 'candidate_review'}`,
    `> direct_writeback_to_province_markdown: false`,
    '',
    '#### 待补生产字段',
    ...markdownList(item.recommended_fields),
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

function loadDomainPackExpansionReviewStateMap(): Map<string, DomainPackExpansionReviewStateItem> {
  return new Map(loadDomainPackExpansionReviewStateItems().map(item => [item.review_item_id, item]));
}

function loadDomainPackExpansionReviewStateItems(): DomainPackExpansionReviewStateItem[] {
  const file = loadDomainPackExpansionReviewStateFile();
  if (!file || file.schema_version !== 'domain-pack-expansion-review-state/v1' || !Array.isArray(file.items)) {
    return [];
  }
  return file.items
    .map(normalizeReviewStateItem)
    .filter((item): item is DomainPackExpansionReviewStateItem => Boolean(item));
}

function loadDomainPackExpansionReviewStateFile(): DomainPackExpansionReviewStateFile | undefined {
  const filePath = reviewStateFilePath();
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
