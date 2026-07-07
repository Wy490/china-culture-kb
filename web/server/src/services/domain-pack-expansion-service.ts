import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DomainPackProductionHealthStatus } from '@shared/types.js';

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

const REQUIRED_EXPANSION_PACK_IDS = [
  'heritage_process_pack',
  'documentary_source_pack',
  'ai_comic_storyboard_pack',
  'era_and_costume_pack',
  'explainer_knowledge_structure_pack',
];

const CANDIDATE_FILE_NAME = 'china-culture-production-expansion-candidates.json';

export function getDomainPackExpansionCandidateReport(input: {
  includeMarkdown?: boolean;
  generatedAt?: string;
} = {}): DomainPackExpansionCandidateReport {
  const loaded = loadExpansionCandidateFile();
  const issues: DomainPackExpansionCandidateIssue[] = [];

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
    }, [], input.includeMarkdown);
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
  }, batches, input.includeMarkdown);
}

function withOptionalMarkdown(
  report: DomainPackExpansionCandidateReportDraft,
  sourceBatches: ExpansionBatch[],
  includeMarkdown = true,
): DomainPackExpansionCandidateReport {
  const reviewPacket = buildDomainPackExpansionReviewPacket(report, sourceBatches, includeMarkdown);
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
): DomainPackExpansionReviewPacket {
  const reviewBatches = sourceBatches.map(batch => {
    const reviewItems = batch.seed_targets.map((target, index) => buildReviewItem(batch, target, index));
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
  };

  return includeMarkdown
    ? { ...packet, markdown: renderDomainPackExpansionReviewPacketMarkdown(packet) }
    : packet;
}

function buildReviewItem(
  batch: ExpansionBatch,
  target: ExpansionSeedTarget,
  index: number,
): DomainPackExpansionReviewItem {
  const item: DomainPackExpansionReviewItemDraft = {
    review_item_id: `${batch.batch_id}::target_${String(index + 1).padStart(2, '0')}`,
    batch_id: batch.batch_id,
    pack_id: batch.pack_id,
    entry_name: target.entry_name,
    province: target.province,
    priority: batch.priority,
    target_video_types: batch.target_video_types,
    candidate_status: target.candidate_status,
    recommended_fields: target.recommended_fields,
    forbidden_direct_claims: target.forbidden_direct_claims,
  };

  return {
    ...item,
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
    `- candidate_draft_only: true`,
    `- direct_writeback_to_province_markdown: false`,
    '',
    'Recommended fields:',
    ...markdownList(item.recommended_fields),
    '',
    'Forbidden direct claims:',
    ...markdownList(item.forbidden_direct_claims),
    '',
    'Review notes:',
    '- 候选稿只记录待补字段、禁写断言和审稿问题，不得直接改写 data/provinces/*.md。',
    '- 进入正式知识库前必须补足来源级证据，并经人工审稿后进入写回队列。',
  ].join('\n');
}

function markdownList(items: string[]): string[] {
  return items.length ? items.map(item => `- ${item}`) : ['- none'];
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
