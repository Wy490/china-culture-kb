import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getKbRoot } from '../lib/provinces.js';

export type PackHealthStatus = 'passed' | 'warning' | 'failed';
type IssueSeverity = 'warning' | 'error';
type MaterialSufficiencyStage = 'minimum_viable_story' | 'script_ready' | 'production_ready';
type JsonRecord = Record<string, unknown>;

interface ProductionMaterialPack {
  video_type: string;
  label: string;
  goal?: string;
  material_template: {
    required_fields: string[];
    prompt_layers?: string[];
    minimum_viable_story_gate: string[];
    script_ready_gate: string[];
    production_ready_gate: string[];
    supplement_questions: string[];
  };
  sample_entries: unknown[];
}

interface ProductionMaterialPackHealthIssue {
  severity: IssueSeverity;
  issue_type:
    | 'missing_required_video_type'
    | 'unknown_required_field'
    | 'duplicate_required_field'
    | 'underfilled_prompt_layers'
    | 'underfilled_sample_entries'
    | 'underfilled_supplement_questions'
    | 'underfilled_gate_items';
  video_type?: string;
  message: string;
  details?: string[];
}

interface ProductionMaterialPackHealthSummary {
  video_type: string;
  label: string;
  required_field_count: number;
  prompt_layer_count: number;
  sample_entry_count: number;
  supplement_question_count: number;
  gate_item_counts: Record<MaterialSufficiencyStage, number>;
  unknown_required_fields: string[];
  duplicate_required_fields: string[];
  status: PackHealthStatus;
}

export interface ProductionMaterialPackHealthReport {
  schema_version: 'production-material-pack-health/v1';
  generated_at: string;
  status: PackHealthStatus;
  pack_count: number;
  required_video_types: string[];
  covered_required_video_types: string[];
  missing_required_video_types: string[];
  core_video_types: string[];
  production_ready_core_video_types: string[];
  high_frequency_video_types: string[];
  packs: ProductionMaterialPackHealthSummary[];
  issues: ProductionMaterialPackHealthIssue[];
}

interface DomainPackSeed {
  entry_name: string;
  domain: string;
  role: string;
  type?: string;
  region?: string;
  summary?: string;
  keywords?: string[];
  asset_usage: string[];
  trigger_words: string[];
  production_prompts?: string[];
  review_boundaries?: string[];
}

interface DomainPackFile {
  domain_id?: string;
  version?: string;
  entries?: unknown[];
}

interface RequiredProductionDomainPack {
  pack_id: string;
  entry_name: string;
  expected_asset_usage: string[];
}

interface DomainPackProductionHealthIssue {
  severity: IssueSeverity;
  issue_type:
    | 'missing_required_pack'
    | 'duplicate_entry_name'
    | 'underfilled_trigger_words'
    | 'underfilled_production_prompts'
    | 'underfilled_review_boundaries'
    | 'missing_expected_asset_usage';
  pack_id?: string;
  entry_name?: string;
  message: string;
  details?: string[];
}

interface DomainPackProductionHealthSummary {
  pack_id: string;
  entry_name: string;
  domain: string;
  role: string;
  trigger_word_count: number;
  production_prompt_count: number;
  review_boundary_count: number;
  asset_usage: string[];
  status: PackHealthStatus;
}

export interface DomainPackProductionHealthReport {
  schema_version: 'domain-pack-production-health/v1';
  generated_at: string;
  domain_id: string;
  version: string;
  status: PackHealthStatus;
  pack_count: number;
  production_pack_count: number;
  required_pack_ids: string[];
  covered_required_pack_ids: string[];
  missing_required_pack_ids: string[];
  production_ready_pack_ids: string[];
  packs: DomainPackProductionHealthSummary[];
  issues: DomainPackProductionHealthIssue[];
}

interface DomainPackExpansionCandidateIssue {
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

interface DomainPackExpansionBatchSummary {
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

interface DomainPackExpansionVideoTypeCoverageSummary {
  video_type: string;
  batch_count: number;
  seed_target_count: number;
  candidate_field_count: number;
  pack_ids: string[];
  batch_ids: string[];
  provinces: string[];
  review_status_counts: Record<DomainPackExpansionReviewStatus, number>;
  approved_writeback_draft_count: number;
  writeback_status_counts: Record<KnowledgeWritebackStatus, number>;
}

interface DomainPackExpansionReviewFieldGroup {
  group_id: string;
  candidate_fields: string[];
  review_questions: string[];
}

interface DomainPackExpansionReviewItem {
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

interface DomainPackExpansionReviewBatch {
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

interface DomainPackExpansionReviewPacket {
  schema_version: 'domain-pack-expansion-review-packet/v1';
  generated_at: string;
  source_schema_version: string;
  domain_id: string;
  status: PackHealthStatus;
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

export type DomainPackExpansionReviewStatus =
  | 'candidate_review'
  | 'approved'
  | 'rejected'
  | 'needs_revision';

export type KnowledgeWritebackStatus =
  | 'draft_ready'
  | 'queued'
  | 'written_back'
  | 'needs_revision';

interface DomainPackExpansionReviewStateItem {
  review_item_id: string;
  review_status: DomainPackExpansionReviewStatus;
  review_note?: string;
  reviewed_at?: string;
  writeback_status?: KnowledgeWritebackStatus;
  writeback_note?: string;
  writeback_updated_at?: string;
}

interface DomainPackExpansionReviewStateFile {
  schema_version?: string;
  updated_at?: string;
  items?: unknown[];
}

interface DomainPackExpansionWritebackDraftItem {
  review_item_id: string;
  batch_id: string;
  pack_id: string;
  entry_name: string;
  province: string;
  target_video_types: string[];
  review_status: DomainPackExpansionReviewStatus;
  review_note?: string;
  writeback_status?: KnowledgeWritebackStatus;
  writeback_note?: string;
  suggested_file_path: string;
  suggested_section_heading: string;
  append_markdown: string;
  writeback_draft_markdown: string;
}

interface DomainPackExpansionWritebackDraftFilter {
  review_item_ids?: string[];
  pack_ids?: string[];
  video_types?: string[];
  provinces?: string[];
  writeback_statuses?: KnowledgeWritebackStatus[];
}

export interface DomainPackExpansionWritebackDraftPackage {
  schema_version: 'domain-pack-expansion-writeback-draft/v1';
  exported_at: string;
  domain_id: string;
  direct_writeback_to_province_markdown: false;
  filters: DomainPackExpansionWritebackDraftFilter;
  approved_count: number;
  target_files: string[];
  status_counts: Record<KnowledgeWritebackStatus, number>;
  markdown: string;
  items: DomainPackExpansionWritebackDraftItem[];
}

export interface DomainPackExpansionCandidateReport {
  schema_version: 'domain-pack-expansion-candidates-report/v1';
  generated_at: string;
  source_schema_version: string;
  updated_at: string;
  domain_id: string;
  status: PackHealthStatus;
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
  video_type_coverage_count: number;
  coverage_by_video_type: DomainPackExpansionVideoTypeCoverageSummary[];
  batches: DomainPackExpansionBatchSummary[];
  issues: DomainPackExpansionCandidateIssue[];
  review_packet: DomainPackExpansionReviewPacket;
}

export type ProductionMaterialPackHealthToolResult = ProductionMaterialPackHealthReport & { markdown?: string };
export type DomainPackProductionHealthToolResult = DomainPackProductionHealthReport & { markdown?: string };
export type DomainPackExpansionCandidateToolResult = DomainPackExpansionCandidateReport & { markdown?: string };
export type DomainPackExpansionWritebackDraftToolResult =
  Omit<DomainPackExpansionWritebackDraftPackage, 'markdown'> & { markdown?: string };

interface ProjectKnowledgeWritebackPatchItem {
  task_key?: string;
  project_id?: string;
  project_title?: string;
  video_type?: string;
  target_province?: string;
  task_id: string;
  label: string;
  source_entry: string;
  suggested_file_path: string;
  suggested_section_heading: string;
  review_note?: string;
  writeback_status?: KnowledgeWritebackStatus;
  writeback_note?: string;
  append_markdown: string;
  writeback_draft_markdown: string;
}

interface ProjectKnowledgeWritebackPatchFilters {
  project_id?: string;
  video_type?: string;
  province?: string;
  knowledge_writeback_status?: KnowledgeWritebackStatus;
  search_query?: string;
  task_key_count?: number;
}

interface ProjectKnowledgeWritebackPatchPackage {
  schema_version: 'project-knowledge-writeback-patch/v1';
  exported_at: string;
  project_id: string;
  project_title: string;
  source_entry: string;
  filters?: ProjectKnowledgeWritebackPatchFilters;
  approved_count: number;
  project_count?: number;
  status_counts?: Record<KnowledgeWritebackStatus, number>;
  target_files: string[];
  pr_title: string;
  pr_body: string;
  markdown: string;
  items: ProjectKnowledgeWritebackPatchItem[];
}

interface KnowledgeWritebackQueueExportFilters {
  project_id?: string;
  video_type?: string;
  province?: string;
  knowledge_writeback_status?: KnowledgeWritebackStatus;
  search_query?: string;
  project_task_key_count?: number;
  expansion_review_item_count?: number;
}

interface KnowledgeWritebackQueueExportStatusCounts {
  project: Record<KnowledgeWritebackStatus, number>;
  expansion: Record<KnowledgeWritebackStatus, number>;
  total: Record<KnowledgeWritebackStatus, number>;
}

interface KnowledgeWritebackQueueExportPackage {
  schema_version: 'knowledge-writeback-queue-export/v1';
  exported_at: string;
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  filters: KnowledgeWritebackQueueExportFilters;
  approved_count: number;
  project_approved_count: number;
  expansion_approved_count: number;
  project_count: number;
  target_files: string[];
  status_counts: KnowledgeWritebackQueueExportStatusCounts;
  project_patch: ProjectKnowledgeWritebackPatchPackage;
  expansion_draft: DomainPackExpansionWritebackDraftToolResult;
  markdown: string;
}

export type KnowledgeWritebackQueueExportToolResult =
  Omit<KnowledgeWritebackQueueExportPackage, 'markdown'> & { markdown?: string };

export interface KnowledgeWritebackQueueExportToolInput {
  include_markdown?: boolean;
  project_id?: string;
  video_type?: string;
  province?: string;
  knowledge_writeback_status?: KnowledgeWritebackStatus;
  search_query?: string;
  project_task_keys?: string[];
  expansion_review_item_ids?: string[];
}

export interface DomainPackExpansionReviewStateUpdateInput {
  review_item_id: string;
  review_status: DomainPackExpansionReviewStatus;
  review_note?: string;
  writeback_status?: KnowledgeWritebackStatus;
  writeback_note?: string;
  include_markdown?: boolean;
}

export interface DomainPackExpansionReviewStateUpdateToolResult {
  schema_version: 'domain-pack-expansion-review-state-update/v1';
  updated_at: string;
  ok: boolean;
  review_item_id: string;
  review_status?: DomainPackExpansionReviewStatus;
  writeback_status?: KnowledgeWritebackStatus;
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  message: string;
  report?: DomainPackExpansionCandidateToolResult;
  writeback_draft?: DomainPackExpansionWritebackDraftToolResult;
}

export interface DomainPackExpansionReviewStateBulkUpdateInput {
  review_item_ids: string[];
  review_status: DomainPackExpansionReviewStatus;
  review_note?: string;
  writeback_status?: KnowledgeWritebackStatus;
  writeback_note?: string;
  include_markdown?: boolean;
}

export interface DomainPackExpansionReviewStateBulkUpdateToolResult {
  schema_version: 'domain-pack-expansion-review-state-bulk-update/v1';
  updated_at: string;
  ok: boolean;
  updated_count: number;
  missing_review_item_ids: string[];
  review_status?: DomainPackExpansionReviewStatus;
  writeback_status?: KnowledgeWritebackStatus;
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  message: string;
  report?: DomainPackExpansionCandidateToolResult;
  writeback_draft?: DomainPackExpansionWritebackDraftToolResult;
}

const CORE_PRODUCTION_READY_VIDEO_TYPES = [
  'heritage_promo',
  'documentary_short',
  'ai_comic_drama',
  'explainer_video',
] as const;

const HIGH_FREQUENCY_PRODUCTION_VIDEO_TYPES = [
  ...CORE_PRODUCTION_READY_VIDEO_TYPES,
  'children_story',
  'social_short',
  'lecture_video',
  'education_training',
] as const;

const PACK_HEALTH_GATE_STAGES: MaterialSufficiencyStage[] = [
  'minimum_viable_story',
  'script_ready',
  'production_ready',
];

const KNOWN_PRODUCTION_MATERIAL_FIELD_IDS = new Set([
  'ambient_sound',
  'analogy_or_visual_metaphor',
  'argument_points',
  'assessment_check',
  'audience_age_band',
  'audience_level',
  'audience_takeaway',
  'b_roll_plan',
  'beat_interval',
  'case_examples',
  'character_stability_tags',
  'child_safe_conflict',
  'comment_prompt',
  'communication_goal',
  'community_or_practitioner_consent',
  'concept_definitions',
  'concrete_examples',
  'confirmed_status_and_sources',
  'core_question',
  'diagram_or_caption_plan',
  'dialogue_bubbles',
  'documentary_question',
  'documentation_assets',
  'emotion_beats',
  'emotional_resolution',
  'ending_hook',
  'episode_hook',
  'fact_boundary_card',
  'field_notes',
  'forbidden_claims',
  'hand_actions',
  'heritage_or_craft_type',
  'identity_motion_consistency_plan',
  'interview_clip_selection',
  'knowledge_outline',
  'knowledge_steps',
  'learner_profile',
  'learning_objective',
  'materials',
  'misconception_or_boundary',
  'modern_connection',
  'multi_shot_continuity',
  'official_catalog_or_resource_links',
  'opening_hook',
  'opponent_or_pressure',
  'parent_teacher_note',
  'platform_context',
  'practice_task',
  'practitioner_or_transmission_line',
  'present_day_trace',
  'process_steps',
  'production_risks',
  'project_name',
  'protagonist_choice',
  'protagonist_goal',
  'real_world_site_or_object',
  'recap_sentence',
  'reconstruction_boundary',
  'reference_images_or_keyframes',
  'relationship_collision',
  'scene_anchor',
  'share_trigger',
  'shot_prompt_layers',
  'single_shot_test',
  'slide_or_board_assets',
  'sound_or_texture_details',
  'source_cues',
  'source_quotes_or_source_cues',
  'speaker_position',
  'step_sequence',
  'timeline',
  'tools',
  'transition_plan',
  'vertical_shot_plan',
  'visual_symbols',
  'what_must_not_be_claimed',
  'witness_or_expert_roles',
  'wonder_or_cultural_symbol',
  'world_and_truth_mode',
]);

const REQUIRED_PRODUCTION_DOMAIN_PACKS: RequiredProductionDomainPack[] = [
  {
    pack_id: 'heritage_process_pack',
    entry_name: '非遗流程生产包——材料工具、工序动作与授权边界',
    expected_asset_usage: ['source_grounding', 'credibility_boundary'],
  },
  {
    pack_id: 'documentary_source_pack',
    entry_name: '纪录片来源包——现实现场、来源线索与再现边界',
    expected_asset_usage: ['source_grounding', 'credibility_boundary'],
  },
  {
    pack_id: 'ai_comic_storyboard_pack',
    entry_name: 'AI漫剧分镜包——关键帧、表情节拍与连续性验收',
    expected_asset_usage: ['visual_style', 'gears_delivery'],
  },
  {
    pack_id: 'era_and_costume_pack',
    entry_name: '朝代服饰与器物包——时代称谓、服装道具和事实边界',
    expected_asset_usage: ['character_clothing', 'credibility_boundary'],
  },
  {
    pack_id: 'explainer_knowledge_structure_pack',
    entry_name: '讲解知识结构包——核心问题、层级例子与图示字幕',
    expected_asset_usage: ['source_grounding', 'visual_style'],
  },
  {
    pack_id: 'children_adaptation_safety_pack',
    entry_name: '儿童改写规则包——年龄分层、善意张力与事实边界',
    expected_asset_usage: ['safety_boundary', 'credibility_boundary'],
  },
  {
    pack_id: 'short_video_hook_pack',
    entry_name: '短视频钩子包——三秒问题、对比反转与平台节奏',
    expected_asset_usage: ['visual_style', 'credibility_boundary'],
  },
  {
    pack_id: 'education_training_structure_pack',
    entry_name: '宣讲培训结构包——论点案例、练习复盘与行动转化',
    expected_asset_usage: ['source_grounding', 'safety_boundary'],
  },
];

const REQUIRED_EXPANSION_PACK_IDS = [
  'heritage_process_pack',
  'documentary_source_pack',
  'ai_comic_storyboard_pack',
  'era_and_costume_pack',
  'explainer_knowledge_structure_pack',
  'children_adaptation_safety_pack',
  'short_video_hook_pack',
  'education_training_structure_pack',
] as const;

const DOMAIN_PACK_EXPANSION_REVIEW_STATE_FILE_NAME = 'review-state.json';

const DOMAIN_PACK_EXPANSION_REVIEW_STATUSES: DomainPackExpansionReviewStatus[] = [
  'candidate_review',
  'approved',
  'rejected',
  'needs_revision',
];

const KNOWLEDGE_WRITEBACK_STATUSES: KnowledgeWritebackStatus[] = [
  'draft_ready',
  'queued',
  'written_back',
  'needs_revision',
];

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readJsonRecordFile(filePath: string): JsonRecord | undefined {
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
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

function healthStatusFromIssues(issues: Array<{ severity: IssueSeverity }>): PackHealthStatus {
  if (issues.some(issue => issue.severity === 'error')) return 'failed';
  if (issues.length > 0) return 'warning';
  return 'passed';
}

function readDataJsonRecord(...segments: string[]): JsonRecord | undefined {
  try {
    const parsed = JSON.parse(readFileSync(path.join(getKbRoot(), ...segments), 'utf8')) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isProductionMaterialPack(value: unknown): value is ProductionMaterialPack {
  if (!isRecord(value)) return false;
  const template = value.material_template;
  return Boolean(
    typeof value.video_type === 'string'
    && typeof value.label === 'string'
    && isRecord(template)
    && isStringArray(template.required_fields)
    && (!('prompt_layers' in template) || isStringArray(template.prompt_layers))
    && isStringArray(template.minimum_viable_story_gate)
    && isStringArray(template.script_ready_gate)
    && isStringArray(template.production_ready_gate)
    && isStringArray(template.supplement_questions)
    && Array.isArray(value.sample_entries),
  );
}

function loadProductionMaterialPacks(): ProductionMaterialPack[] {
  const file = readDataJsonRecord('production-packs', 'video-type-material-supplement-packs.json');
  return Array.isArray(file?.packs)
    ? file.packs.filter(isProductionMaterialPack)
    : [];
}

function gateItemsForStage(pack: ProductionMaterialPack, stage: MaterialSufficiencyStage): string[] {
  if (stage === 'minimum_viable_story') return pack.material_template.minimum_viable_story_gate;
  if (stage === 'script_ready') return pack.material_template.script_ready_gate;
  return pack.material_template.production_ready_gate;
}

export function getProductionMaterialPackHealthReport(): ProductionMaterialPackHealthReport {
  const requiredVideoTypes = [...HIGH_FREQUENCY_PRODUCTION_VIDEO_TYPES];
  const coreVideoTypes = [...CORE_PRODUCTION_READY_VIDEO_TYPES];
  const packs = loadProductionMaterialPacks();
  const packsByType = new Map(packs.map(pack => [pack.video_type, pack]));
  const issues: ProductionMaterialPackHealthIssue[] = [];

  for (const videoType of requiredVideoTypes) {
    if (!packsByType.has(videoType)) {
      issues.push({
        severity: 'error',
        issue_type: 'missing_required_video_type',
        video_type: videoType,
        message: `缺少 ${videoType} 的 ProductionMaterialPack。`,
      });
    }
  }

  const summaries = packs
    .map((pack): ProductionMaterialPackHealthSummary => {
      const fields = pack.material_template.required_fields;
      const unknownRequiredFields = fields.filter(fieldId => !KNOWN_PRODUCTION_MATERIAL_FIELD_IDS.has(fieldId));
      const duplicateRequiredFields = duplicateStrings(fields);
      const promptLayerCount = pack.material_template.prompt_layers?.length ?? 0;
      const sampleEntryCount = pack.sample_entries.length;
      const supplementQuestionCount = pack.material_template.supplement_questions.length;
      const gateItemCounts: Record<MaterialSufficiencyStage, number> = {
        minimum_viable_story: pack.material_template.minimum_viable_story_gate.length,
        script_ready: pack.material_template.script_ready_gate.length,
        production_ready: pack.material_template.production_ready_gate.length,
      };
      const beforeIssueCount = issues.length;

      if (unknownRequiredFields.length > 0) {
        issues.push({
          severity: 'error',
          issue_type: 'unknown_required_field',
          video_type: pack.video_type,
          message: `${pack.video_type} 包含 readiness 未识别的 required_fields。`,
          details: unknownRequiredFields,
        });
      }
      if (duplicateRequiredFields.length > 0) {
        issues.push({
          severity: 'error',
          issue_type: 'duplicate_required_field',
          video_type: pack.video_type,
          message: `${pack.video_type} 包含重复 required_fields。`,
          details: duplicateRequiredFields,
        });
      }
      if (promptLayerCount < 4) {
        issues.push({
          severity: 'warning',
          issue_type: 'underfilled_prompt_layers',
          video_type: pack.video_type,
          message: `${pack.video_type} prompt layers 低于 4 层。`,
          details: [`current=${promptLayerCount}`],
        });
      }
      if (supplementQuestionCount < 4) {
        issues.push({
          severity: 'warning',
          issue_type: 'underfilled_supplement_questions',
          video_type: pack.video_type,
          message: `${pack.video_type} 补充问题低于 4 条。`,
          details: [`current=${supplementQuestionCount}`],
        });
      }

      const minimumSampleEntries = coreVideoTypes.includes(pack.video_type as typeof CORE_PRODUCTION_READY_VIDEO_TYPES[number])
        ? 10
        : requiredVideoTypes.includes(pack.video_type as typeof HIGH_FREQUENCY_PRODUCTION_VIDEO_TYPES[number])
          ? 2
          : 1;
      if (sampleEntryCount < minimumSampleEntries) {
        issues.push({
          severity: 'warning',
          issue_type: 'underfilled_sample_entries',
          video_type: pack.video_type,
          message: `${pack.video_type} 样板条目低于 ${minimumSampleEntries} 条。`,
          details: [`current=${sampleEntryCount}`],
        });
      }

      for (const stage of PACK_HEALTH_GATE_STAGES) {
        const gateItemCount = gateItemsForStage(pack, stage).length;
        if (gateItemCount < 3) {
          issues.push({
            severity: 'warning',
            issue_type: 'underfilled_gate_items',
            video_type: pack.video_type,
            message: `${pack.video_type} ${stage} gate 低于 3 条。`,
            details: [`current=${gateItemCount}`],
          });
        }
      }

      return {
        video_type: pack.video_type,
        label: pack.label,
        required_field_count: fields.length,
        prompt_layer_count: promptLayerCount,
        sample_entry_count: sampleEntryCount,
        supplement_question_count: supplementQuestionCount,
        gate_item_counts: gateItemCounts,
        unknown_required_fields: unknownRequiredFields,
        duplicate_required_fields: duplicateRequiredFields,
        status: healthStatusFromIssues(issues.slice(beforeIssueCount)),
      };
    })
    .sort((a, b) => a.video_type.localeCompare(b.video_type));

  return {
    schema_version: 'production-material-pack-health/v1',
    generated_at: new Date().toISOString(),
    status: healthStatusFromIssues(issues),
    pack_count: packs.length,
    required_video_types: requiredVideoTypes,
    covered_required_video_types: requiredVideoTypes.filter(videoType => packsByType.has(videoType)),
    missing_required_video_types: requiredVideoTypes.filter(videoType => !packsByType.has(videoType)),
    core_video_types: coreVideoTypes,
    production_ready_core_video_types: coreVideoTypes.filter(videoType =>
      summaries.some(summary => summary.video_type === videoType && summary.status === 'passed'),
    ),
    high_frequency_video_types: [...HIGH_FREQUENCY_PRODUCTION_VIDEO_TYPES],
    packs: summaries,
    issues,
  };
}

export function renderProductionMaterialPackHealthMarkdown(report: ProductionMaterialPackHealthReport): string {
  const issueLines = report.issues.length
    ? report.issues.map(issue =>
      `- ${issue.severity} · ${issue.issue_type}${issue.video_type ? ` · ${issue.video_type}` : ''}: ${issue.message}`,
    )
    : ['- none'];
  const packLines = report.packs.length
    ? report.packs.map(pack =>
      `- ${pack.status} · ${pack.video_type} · fields=${pack.required_field_count} prompts=${pack.prompt_layer_count} samples=${pack.sample_entry_count}`,
    )
    : ['- none'];

  return [
    '# Production Material Pack Health',
    '',
    `> schema_version: ${report.schema_version}`,
    `> generated_at: ${report.generated_at}`,
    `> status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- pack_count: ${report.pack_count}`,
    `- required_video_types: ${report.required_video_types.length}`,
    `- covered_required_video_types: ${report.covered_required_video_types.length}`,
    `- missing_required_video_types: ${report.missing_required_video_types.join(', ') || 'none'}`,
    `- core_ready: ${report.production_ready_core_video_types.length}/${report.core_video_types.length}`,
    `- issue_count: ${report.issues.length}`,
    '',
    '## Packs',
    '',
    ...packLines,
    '',
    '## Issues',
    '',
    ...issueLines,
  ].join('\n').trim() + '\n';
}

export function getProductionMaterialPackHealthToolResult(input: {
  include_markdown?: boolean;
} = {}): ProductionMaterialPackHealthToolResult {
  const report = getProductionMaterialPackHealthReport();
  return input.include_markdown === false
    ? report
    : { ...report, markdown: renderProductionMaterialPackHealthMarkdown(report) };
}

function isDomainPackSeed(value: unknown): value is DomainPackSeed {
  if (!isRecord(value)) return false;
  return Boolean(
    typeof value.entry_name === 'string'
    && typeof value.domain === 'string'
    && typeof value.role === 'string'
    && isStringArray(value.asset_usage)
    && isStringArray(value.trigger_words)
    && (!('production_prompts' in value) || isStringArray(value.production_prompts))
    && (!('review_boundaries' in value) || isStringArray(value.review_boundaries)),
  );
}

function loadDomainPackFile(): { domain_id: string; version: string; seeds: DomainPackSeed[] } {
  const file = readDataJsonRecord('domain-packs', 'china-culture.json') as DomainPackFile | undefined;
  return {
    domain_id: typeof file?.domain_id === 'string' ? file.domain_id : 'china_culture',
    version: typeof file?.version === 'string' ? file.version : 'unknown',
    seeds: Array.isArray(file?.entries) ? file.entries.filter(isDomainPackSeed) : [],
  };
}

export function getDomainPackProductionHealthReport(): DomainPackProductionHealthReport {
  const file = loadDomainPackFile();
  const seedByName = new Map(file.seeds.map(seed => [seed.entry_name, seed]));
  const issues: DomainPackProductionHealthIssue[] = [];
  const duplicateNames = duplicateStrings(file.seeds.map(seed => seed.entry_name));

  for (const entryName of duplicateNames) {
    issues.push({
      severity: 'error',
      issue_type: 'duplicate_entry_name',
      entry_name: entryName,
      message: `Domain Pack 存在重复 entry_name：${entryName}。`,
    });
  }

  const summaries: DomainPackProductionHealthSummary[] = [];
  for (const contract of REQUIRED_PRODUCTION_DOMAIN_PACKS) {
    const seed = seedByName.get(contract.entry_name);
    if (!seed) {
      issues.push({
        severity: 'error',
        issue_type: 'missing_required_pack',
        pack_id: contract.pack_id,
        entry_name: contract.entry_name,
        message: `缺少生产提示 Domain Pack：${contract.entry_name}。`,
      });
      continue;
    }

    const beforeIssueCount = issues.length;
    const triggerWordCount = seed.trigger_words.length;
    const productionPromptCount = seed.production_prompts?.filter(item => item.trim()).length ?? 0;
    const reviewBoundaryCount = seed.review_boundaries?.filter(item => item.trim()).length ?? 0;
    const missingAssetUsage = contract.expected_asset_usage.filter(usage => !seed.asset_usage.includes(usage));

    if (triggerWordCount < 8) {
      issues.push({
        severity: 'warning',
        issue_type: 'underfilled_trigger_words',
        pack_id: contract.pack_id,
        entry_name: seed.entry_name,
        message: `${seed.entry_name} trigger_words 低于 8 个。`,
        details: [`current=${triggerWordCount}`],
      });
    }
    if (productionPromptCount < 3) {
      issues.push({
        severity: 'warning',
        issue_type: 'underfilled_production_prompts',
        pack_id: contract.pack_id,
        entry_name: seed.entry_name,
        message: `${seed.entry_name} production_prompts 低于 3 条。`,
        details: [`current=${productionPromptCount}`],
      });
    }
    if (reviewBoundaryCount < 3) {
      issues.push({
        severity: 'warning',
        issue_type: 'underfilled_review_boundaries',
        pack_id: contract.pack_id,
        entry_name: seed.entry_name,
        message: `${seed.entry_name} review_boundaries 低于 3 条。`,
        details: [`current=${reviewBoundaryCount}`],
      });
    }
    if (missingAssetUsage.length > 0) {
      issues.push({
        severity: 'warning',
        issue_type: 'missing_expected_asset_usage',
        pack_id: contract.pack_id,
        entry_name: seed.entry_name,
        message: `${seed.entry_name} 缺少预期 asset_usage 标记。`,
        details: missingAssetUsage,
      });
    }

    summaries.push({
      pack_id: contract.pack_id,
      entry_name: seed.entry_name,
      domain: seed.domain,
      role: seed.role,
      trigger_word_count: triggerWordCount,
      production_prompt_count: productionPromptCount,
      review_boundary_count: reviewBoundaryCount,
      asset_usage: seed.asset_usage,
      status: healthStatusFromIssues(issues.slice(beforeIssueCount)),
    });
  }

  const coveredRequiredPackIds = summaries.map(summary => summary.pack_id);
  const missingRequiredPackIds = REQUIRED_PRODUCTION_DOMAIN_PACKS
    .filter(contract => !coveredRequiredPackIds.includes(contract.pack_id))
    .map(contract => contract.pack_id);
  const productionReadyPackIds = summaries
    .filter(summary => summary.status === 'passed')
    .map(summary => summary.pack_id);

  return {
    schema_version: 'domain-pack-production-health/v1',
    generated_at: new Date().toISOString(),
    domain_id: file.domain_id,
    version: file.version,
    status: healthStatusFromIssues(issues),
    pack_count: file.seeds.length,
    production_pack_count: file.seeds.filter(seed =>
      Boolean(seed.production_prompts?.some(item => item.trim()))
      || Boolean(seed.review_boundaries?.some(item => item.trim())),
    ).length,
    required_pack_ids: REQUIRED_PRODUCTION_DOMAIN_PACKS.map(contract => contract.pack_id),
    covered_required_pack_ids: coveredRequiredPackIds,
    missing_required_pack_ids: missingRequiredPackIds,
    production_ready_pack_ids: productionReadyPackIds,
    packs: summaries,
    issues,
  };
}

export function renderDomainPackProductionHealthMarkdown(report: DomainPackProductionHealthReport): string {
  const issueLines = report.issues.length
    ? report.issues.map(issue =>
      `- ${issue.severity} · ${issue.issue_type}${issue.pack_id ? ` · ${issue.pack_id}` : ''}: ${issue.message}`,
    )
    : ['- none'];
  const packLines = report.packs.length
    ? report.packs.map(pack =>
      `- ${pack.status} · ${pack.pack_id} · triggers=${pack.trigger_word_count} prompts=${pack.production_prompt_count} boundaries=${pack.review_boundary_count}`,
    )
    : ['- none'];

  return [
    '# Domain Pack Production Health',
    '',
    `> schema_version: ${report.schema_version}`,
    `> generated_at: ${report.generated_at}`,
    `> domain_id: ${report.domain_id}`,
    `> version: ${report.version}`,
    `> status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- pack_count: ${report.pack_count}`,
    `- production_pack_count: ${report.production_pack_count}`,
    `- required_pack_count: ${report.required_pack_ids.length}`,
    `- covered_required_pack_count: ${report.covered_required_pack_ids.length}`,
    `- missing_required_pack_ids: ${report.missing_required_pack_ids.join(', ') || 'none'}`,
    `- production_ready_pack_count: ${report.production_ready_pack_ids.length}/${report.required_pack_ids.length}`,
    `- issue_count: ${report.issues.length}`,
    '',
    '## Packs',
    '',
    ...packLines,
    '',
    '## Issues',
    '',
    ...issueLines,
  ].join('\n').trim() + '\n';
}

export function getDomainPackProductionHealthToolResult(input: {
  include_markdown?: boolean;
} = {}): DomainPackProductionHealthToolResult {
  const report = getDomainPackProductionHealthReport();
  return input.include_markdown === false
    ? report
    : { ...report, markdown: renderDomainPackProductionHealthMarkdown(report) };
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

type DomainPackExpansionCandidateReportDraft = Omit<
  DomainPackExpansionCandidateReport,
  'review_packet' | 'video_type_coverage_count' | 'coverage_by_video_type'
>;
type DomainPackExpansionReviewItemDraft = Omit<DomainPackExpansionReviewItem, 'candidate_markdown'>;

export function getDomainPackExpansionCandidateReport(): DomainPackExpansionCandidateReport {
  const file = readDataJsonRecord('domain-packs', 'china-culture-production-expansion-candidates.json');
  const issues: DomainPackExpansionCandidateIssue[] = [];
  const reviewState = loadDomainPackExpansionReviewStateMap();

  if (!file) {
    issues.push({
      severity: 'error',
      issue_type: 'missing_candidate_file',
      message: '缺少 Domain Pack 扩库候选文件：data/domain-packs/china-culture-production-expansion-candidates.json。',
    });
    return withExpansionReviewPacket({
      schema_version: 'domain-pack-expansion-candidates-report/v1',
      generated_at: new Date().toISOString(),
      source_schema_version: 'missing',
      updated_at: 'unknown',
      domain_id: 'china_culture',
      status: healthStatusFromIssues(issues),
      required_pack_ids: [...REQUIRED_EXPANSION_PACK_IDS],
      covered_required_pack_ids: [],
      missing_required_pack_ids: [...REQUIRED_EXPANSION_PACK_IDS],
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
    }, [], false, reviewState);
  }

  if (file.schema_version !== 'domain-pack-expansion-candidates/v1') {
    issues.push({
      severity: 'error',
      issue_type: 'invalid_schema_version',
      message: `Domain Pack 扩库候选文件 schema_version 应为 domain-pack-expansion-candidates/v1，当前为 ${typeof file.schema_version === 'string' ? file.schema_version : 'missing'}。`,
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
    ? file.batches.map(normalizeExpansionBatch).filter((batch): batch is ExpansionBatch => Boolean(batch))
    : [];
  for (const batchId of duplicateStrings(batches.map(batch => batch.batch_id))) {
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

  const batchSummaries = batches.map(summarizeExpansionBatch);
  return withExpansionReviewPacket({
    schema_version: 'domain-pack-expansion-candidates-report/v1',
    generated_at: new Date().toISOString(),
    source_schema_version: typeof file.schema_version === 'string' ? file.schema_version : 'missing',
    updated_at: typeof file.updated_at === 'string' ? file.updated_at : 'unknown',
    domain_id: typeof file.domain_id === 'string' ? file.domain_id : 'china_culture',
    status: healthStatusFromIssues(issues),
    required_pack_ids: [...REQUIRED_EXPANSION_PACK_IDS],
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
  }, batches, false, reviewState);
}

function withExpansionReviewPacket(
  report: DomainPackExpansionCandidateReportDraft,
  sourceBatches: ExpansionBatch[],
  includeMarkdown = false,
  reviewState: Map<string, DomainPackExpansionReviewStateItem> = new Map(),
): DomainPackExpansionCandidateReport {
  const reviewPacket = buildDomainPackExpansionReviewPacket(report, sourceBatches, includeMarkdown, reviewState);
  const coverageByVideoType = buildExpansionVideoTypeCoverage(sourceBatches, reviewPacket);
  return {
    ...report,
    video_type_coverage_count: coverageByVideoType.length,
    coverage_by_video_type: coverageByVideoType,
    review_packet: reviewPacket,
  };
}

function buildDomainPackExpansionReviewPacket(
  report: DomainPackExpansionCandidateReportDraft,
  sourceBatches: ExpansionBatch[],
  includeMarkdown: boolean,
  reviewState: Map<string, DomainPackExpansionReviewStateItem>,
): DomainPackExpansionReviewPacket {
  const reviewBatches = sourceBatches.map(batch => {
    const reviewItems = batch.seed_targets.map((target, index) =>
      buildExpansionReviewItem(batch, target, index, reviewState),
    );
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
    review_status_counts: countExpansionReviewStatuses(reviewItems),
    approved_writeback_draft_count: reviewItems.filter(item =>
      item.review_status === 'approved' && Boolean(item.writeback_draft_markdown),
    ).length,
  };

  return includeMarkdown
    ? { ...packet, markdown: renderDomainPackExpansionReviewPacketMarkdown(packet) }
    : packet;
}

function buildExpansionReviewItem(
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

export function renderDomainPackExpansionCandidateMarkdown(report: DomainPackExpansionCandidateReport): string {
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
    `- video_type_coverage_count: ${report.video_type_coverage_count}`,
    `- review_packet_schema_version: ${report.review_packet.schema_version}`,
    `- review_packet_item_count: ${report.review_packet.review_item_count}`,
    `- review_packet_approved_count: ${report.review_packet.review_status_counts?.approved ?? 0}`,
    `- approved_writeback_draft_count: ${report.review_packet.approved_writeback_draft_count ?? 0}`,
    `- review_packet_markdown: ${report.review_packet.markdown ? 'included' : 'omitted'}`,
    '',
    '## Video Type Coverage',
    '',
    ...renderExpansionVideoTypeCoverageLines(report.coverage_by_video_type),
    '',
    '## Batches',
    '',
    ...batchLines,
    '',
    '## Issues',
    '',
    ...issueLines,
  ].join('\n').trim() + '\n';
}

function buildExpansionVideoTypeCoverage(
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
        pack_ids: [...item.packIds].sort((a, b) => a.localeCompare(b)),
        batch_ids: [...item.batchIds].sort((a, b) => a.localeCompare(b)),
        provinces: [...item.provinces].sort((a, b) => a.localeCompare(b, 'zh-CN')),
        review_status_counts: countExpansionReviewStatuses(item.reviewItems),
        approved_writeback_draft_count: approvedItems.filter(reviewItem =>
          Boolean(reviewItem.writeback_draft_markdown),
        ).length,
        writeback_status_counts: countExpansionReviewItemWritebackStatuses(approvedItems),
      };
    })
    .sort((a, b) => a.video_type.localeCompare(b.video_type));
}

function renderExpansionVideoTypeCoverageLines(
  coverage: DomainPackExpansionVideoTypeCoverageSummary[],
): string[] {
  if (coverage.length === 0) return ['- none'];
  return coverage.map(item =>
    `- ${item.video_type}: batches=${item.batch_count}, targets=${item.seed_target_count}, fields=${item.candidate_field_count}, approved=${item.review_status_counts.approved}, drafts=${item.approved_writeback_draft_count}, packs=${item.pack_ids.join(', ') || 'none'}, provinces=${item.provinces.join(', ') || 'none'}`,
  );
}

export function renderDomainPackExpansionReviewPacketMarkdown(
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
    `- candidate_review: ${packet.review_status_counts?.candidate_review ?? 0}`,
    `- approved: ${packet.review_status_counts?.approved ?? 0}`,
    `- rejected: ${packet.review_status_counts?.rejected ?? 0}`,
    `- needs_revision: ${packet.review_status_counts?.needs_revision ?? 0}`,
    `- approved_writeback_draft_count: ${packet.approved_writeback_draft_count ?? 0}`,
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

export function getDomainPackExpansionCandidateToolResult(input: {
  include_markdown?: boolean;
} = {}): DomainPackExpansionCandidateToolResult {
  const report = getDomainPackExpansionCandidateReport();
  return input.include_markdown === false
    ? report
    : withExpansionCandidateMarkdown(report);
}

function withExpansionCandidateMarkdown(
  report: DomainPackExpansionCandidateReport,
): DomainPackExpansionCandidateToolResult {
  const reviewPacket: DomainPackExpansionReviewPacket = {
    ...report.review_packet,
    markdown: renderDomainPackExpansionReviewPacketMarkdown(report.review_packet),
  };
  const reportWithMarkdownPacket: DomainPackExpansionCandidateReport = {
    ...report,
    review_packet: reviewPacket,
  };

  return {
    ...reportWithMarkdownPacket,
    markdown: renderDomainPackExpansionCandidateMarkdown(reportWithMarkdownPacket),
  };
}

export function getDomainPackExpansionWritebackDraftToolResult(input: {
  include_markdown?: boolean;
  review_item_ids?: string[];
  pack_ids?: string[];
  video_types?: string[];
  provinces?: string[];
  writeback_statuses?: KnowledgeWritebackStatus[];
} = {}): DomainPackExpansionWritebackDraftToolResult {
  const exportedAt = new Date().toISOString();
  const filters = normalizeExpansionWritebackDraftFilters(input);
  const report = getDomainPackExpansionCandidateReport();
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
    .filter(item => matchesExpansionWritebackDraftFilters(item, filters));
  const packageWithoutMarkdown: Omit<DomainPackExpansionWritebackDraftPackage, 'markdown'> = {
    schema_version: 'domain-pack-expansion-writeback-draft/v1',
    exported_at: exportedAt,
    domain_id: report.domain_id,
    direct_writeback_to_province_markdown: false,
    filters,
    approved_count: items.length,
    target_files: [...new Set(items.map(item => item.suggested_file_path))].sort((a, b) => a.localeCompare(b)),
    status_counts: countExpansionWritebackStatuses(items),
    items,
  };

  return input.include_markdown === false
    ? packageWithoutMarkdown
    : {
      ...packageWithoutMarkdown,
      markdown: renderDomainPackExpansionWritebackDraftPackageMarkdown(packageWithoutMarkdown),
    };
}

export function getKnowledgeWritebackQueueExportToolResult(
  input: KnowledgeWritebackQueueExportToolInput = {},
): KnowledgeWritebackQueueExportToolResult {
  const exportedAt = new Date().toISOString();
  const projectPatch = getProjectKnowledgeWritebackPatchPackage(input, exportedAt);
  const expansionDraft = input.project_id
    ? emptyDomainPackExpansionWritebackDraftToolResult(exportedAt, input.include_markdown)
    : getDomainPackExpansionWritebackDraftToolResult({
      include_markdown: input.include_markdown,
      review_item_ids: input.expansion_review_item_ids,
      video_types: input.video_type ? [input.video_type] : undefined,
      provinces: input.province ? [input.province] : undefined,
      writeback_statuses: input.knowledge_writeback_status ? [input.knowledge_writeback_status] : undefined,
    });
  const targetFiles = [...new Set([
    ...projectPatch.target_files,
    ...expansionDraft.target_files,
  ])].sort((a, b) => a.localeCompare(b));
  const statusCounts = {
    project: normalizeKnowledgeWritebackStatusCounts(projectPatch.status_counts),
    expansion: normalizeKnowledgeWritebackStatusCounts(expansionDraft.status_counts),
    total: mergeKnowledgeWritebackStatusCounts(projectPatch.status_counts, expansionDraft.status_counts),
  };
  const packageWithoutMarkdown: Omit<KnowledgeWritebackQueueExportPackage, 'markdown'> = {
    schema_version: 'knowledge-writeback-queue-export/v1',
    exported_at: exportedAt,
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    filters: buildKnowledgeWritebackQueueExportFilters(input),
    approved_count: projectPatch.approved_count + expansionDraft.approved_count,
    project_approved_count: projectPatch.approved_count,
    expansion_approved_count: expansionDraft.approved_count,
    project_count: projectPatch.project_count ?? 0,
    target_files: targetFiles,
    status_counts: statusCounts,
    project_patch: projectPatch,
    expansion_draft: expansionDraft,
  };

  return input.include_markdown === false
    ? packageWithoutMarkdown
    : {
      ...packageWithoutMarkdown,
      markdown: renderKnowledgeWritebackQueueExportMarkdown(packageWithoutMarkdown),
    };
}

export function updateDomainPackExpansionReviewStateToolResult(
  input: DomainPackExpansionReviewStateUpdateInput,
  options: { updated_at?: string } = {},
): DomainPackExpansionReviewStateUpdateToolResult {
  const updatedAt = options.updated_at ?? new Date().toISOString();
  const baseReport = getDomainPackExpansionCandidateReport();
  const currentItem = findDomainPackExpansionReviewItem(baseReport, input.review_item_id);
  if (!currentItem) {
    return {
      schema_version: 'domain-pack-expansion-review-state-update/v1',
      updated_at: updatedAt,
      ok: false,
      review_item_id: input.review_item_id,
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
      message: `未找到扩库候选审稿项：${input.review_item_id}。`,
    };
  }

  const currentItems = loadDomainPackExpansionReviewStateItems();
  const nextItems = new Map(currentItems.map(item => [item.review_item_id, item]));
  const existing = nextItems.get(input.review_item_id);
  const reviewNote = input.review_note?.trim() || undefined;
  const writebackStatus = input.review_status === 'approved'
    ? (input.writeback_status ?? existing?.writeback_status ?? 'draft_ready')
    : undefined;
  const writebackNote = input.review_status === 'approved'
    ? (input.writeback_note?.trim() || existing?.writeback_note)
    : undefined;

  nextItems.set(input.review_item_id, {
    review_item_id: input.review_item_id,
    review_status: input.review_status,
    review_note: reviewNote,
    reviewed_at: updatedAt,
    writeback_status: writebackStatus,
    writeback_note: writebackNote,
    writeback_updated_at: writebackStatus ? updatedAt : undefined,
  });
  saveDomainPackExpansionReviewStateItems([...nextItems.values()], updatedAt);

  const report = getDomainPackExpansionCandidateToolResult({
    include_markdown: input.include_markdown,
  });

  return {
    schema_version: 'domain-pack-expansion-review-state-update/v1',
    updated_at: updatedAt,
    ok: true,
    review_item_id: input.review_item_id,
    review_status: input.review_status,
    writeback_status: writebackStatus,
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    message: '扩库候选审稿状态已更新；正式省份 Markdown 未被写入。',
    report,
    writeback_draft: input.review_status === 'approved'
      ? getDomainPackExpansionWritebackDraftToolResult({ include_markdown: input.include_markdown })
      : undefined,
  };
}

export function updateDomainPackExpansionReviewStateBulkToolResult(
  input: DomainPackExpansionReviewStateBulkUpdateInput,
  options: { updated_at?: string } = {},
): DomainPackExpansionReviewStateBulkUpdateToolResult {
  const updatedAt = options.updated_at ?? new Date().toISOString();
  const uniqueReviewItemIds = [...new Set(input.review_item_ids.map(id => id.trim()).filter(Boolean))];
  if (uniqueReviewItemIds.length === 0) {
    return {
      schema_version: 'domain-pack-expansion-review-state-bulk-update/v1',
      updated_at: updatedAt,
      ok: false,
      updated_count: 0,
      missing_review_item_ids: [],
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
      message: '批量扩库审稿项不能为空。',
    };
  }

  const baseReport = getDomainPackExpansionCandidateReport();
  const itemById = new Map(baseReport.review_packet.batches
    .flatMap(batch => batch.review_items)
    .map(item => [item.review_item_id, item]));
  const missingReviewItemIds = uniqueReviewItemIds.filter(reviewItemId => !itemById.has(reviewItemId));
  if (missingReviewItemIds.length > 0) {
    return {
      schema_version: 'domain-pack-expansion-review-state-bulk-update/v1',
      updated_at: updatedAt,
      ok: false,
      updated_count: 0,
      missing_review_item_ids: missingReviewItemIds,
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
      message: `未找到 ${missingReviewItemIds.length} 个扩库候选审稿项：${missingReviewItemIds.slice(0, 5).join(', ')}。`,
    };
  }

  const currentItems = loadDomainPackExpansionReviewStateItems();
  const nextItems = new Map(currentItems.map(item => [item.review_item_id, item]));
  const reviewNote = input.review_note?.trim() || undefined;
  const explicitWritebackNote = input.review_status === 'approved'
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
      writeback_note: writebackStatus ? (explicitWritebackNote ?? existing?.writeback_note) : undefined,
      writeback_updated_at: writebackStatus ? updatedAt : undefined,
    });
  }

  saveDomainPackExpansionReviewStateItems([...nextItems.values()], updatedAt);
  const report = getDomainPackExpansionCandidateToolResult({
    include_markdown: input.include_markdown,
  });
  const writebackDraft = input.review_status === 'approved'
    ? getDomainPackExpansionWritebackDraftToolResult({ include_markdown: input.include_markdown })
    : undefined;

  return {
    schema_version: 'domain-pack-expansion-review-state-bulk-update/v1',
    updated_at: updatedAt,
    ok: true,
    updated_count: uniqueReviewItemIds.length,
    missing_review_item_ids: [],
    review_status: input.review_status,
    writeback_status: input.review_status === 'approved' ? input.writeback_status : undefined,
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    message: '扩库候选审稿状态已批量更新；正式省份 Markdown 未被写入。',
    report,
    writeback_draft: writebackDraft,
  };
}

function getProjectKnowledgeWritebackPatchPackage(
  input: KnowledgeWritebackQueueExportToolInput,
  exportedAt: string,
): ProjectKnowledgeWritebackPatchPackage {
  const projectTaskKeySet = new Set(normalizeFilterValues(input.project_task_keys));
  const items: ProjectKnowledgeWritebackPatchItem[] = [];
  const projectIds = new Set<string>();
  const projectsDir = path.resolve(generatedRoot(), 'projects');

  let entries: string[] = [];
  try {
    entries = readdirSync(projectsDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch {
    entries = [];
  }

  for (const projectDirName of entries) {
    const projectDir = path.resolve(projectsDir, projectDirName);
    const project = readJsonRecordFile(path.resolve(projectDir, 'project.json'));
    if (!project) continue;

    const projectId = nonEmptyString(project.project_id) ?? projectDirName;
    if (input.project_id && input.project_id !== projectId) continue;

    const story = readCurrentProjectStoryRecord(projectDir, project);
    if (!story) continue;

    const videoType = nonEmptyString(story.video_type) ?? nonEmptyString(project.video_type);
    if (input.video_type && input.video_type !== videoType) continue;

    const sourceEntry = nonEmptyString(story.source_entry)
      ?? nonEmptyString(project.source_entry)
      ?? '未记录来源条目';
    const target = inferProjectKnowledgeWritebackTarget(story, sourceEntry);
    if (input.province && input.province !== target.province) continue;

    const projectTitle = nonEmptyString(project.title)
      ?? nonEmptyString(story.title)
      ?? projectId;
    const tasks = Array.isArray(story.supplement_tasks) ? story.supplement_tasks : [];
    for (const rawTask of tasks) {
      if (!isRecord(rawTask) || !isProjectKnowledgeWritebackReadyTask(rawTask)) continue;
      const taskId = nonEmptyString(rawTask.task_id) ?? `task_${items.length + 1}`;
      const taskKey = `${projectId}::${taskId}`;
      if (projectTaskKeySet.size > 0 && !projectTaskKeySet.has(taskKey)) continue;
      const writebackStatus = normalizeKnowledgeWritebackStatus(rawTask.knowledge_writeback_status);
      if (input.knowledge_writeback_status && input.knowledge_writeback_status !== writebackStatus) continue;
      if (input.search_query && !projectWritebackSearchText({
        projectId,
        projectTitle,
        videoType,
        sourceEntry,
        target,
        task: rawTask,
      }).includes(input.search_query.trim().toLowerCase())) continue;

      projectIds.add(projectId);
      const label = nonEmptyString(rawTask.label) ?? taskId;
      const writebackDraft = nonEmptyString(rawTask.knowledge_writeback_draft_markdown) ?? '';
      items.push({
        task_key: taskKey,
        project_id: projectId,
        project_title: projectTitle,
        video_type: videoType,
        target_province: target.province,
        task_id: taskId,
        label,
        source_entry: sourceEntry,
        suggested_file_path: target.filePath,
        suggested_section_heading: target.sectionHeading,
        review_note: nonEmptyString(rawTask.knowledge_candidate_review_note),
        writeback_status: writebackStatus,
        writeback_note: nonEmptyString(rawTask.knowledge_writeback_note),
        append_markdown: renderProjectKnowledgeWritebackAppendMarkdown({
          projectId,
          projectTitle,
          videoType,
          sourceEntry,
          target,
          taskId,
          label,
          writebackStatus,
          reviewNote: nonEmptyString(rawTask.knowledge_candidate_review_note),
          writebackNote: nonEmptyString(rawTask.knowledge_writeback_note),
          writebackDraft,
          exportedAt,
        }),
        writeback_draft_markdown: writebackDraft,
      });
    }
  }

  items.sort((a, b) => [
    a.suggested_file_path,
    a.project_title ?? '',
    a.label,
  ].join('\u0000').localeCompare([
    b.suggested_file_path,
    b.project_title ?? '',
    b.label,
  ].join('\u0000'), 'zh-CN'));

  const targetFiles = [...new Set(items.map(item => item.suggested_file_path))].sort((a, b) => a.localeCompare(b));
  const filters = buildProjectKnowledgeWritebackPatchFilters(input, projectTaskKeySet.size);
  const statusCounts = countProjectKnowledgeWritebackStatuses(items);
  const prTitle = input.project_id
    ? `补充 ${items[0]?.project_title ?? input.project_id} 写回队列候选稿`
    : '批量补充 Story Agent 写回队列候选稿';
  const prBody = [
    '## 变更目的',
    '',
    '将 MCP 只读扫描到的 Story Agent 写回队列候选稿整理为省份知识库写入草案。',
    '',
    '## 导出范围',
    '',
    `- 项目筛选：${input.project_id ?? '全部项目'}`,
    `- 片型筛选：${input.video_type ?? 'all'}`,
    `- 省份筛选：${input.province ?? 'all'}`,
    `- 写回状态：${input.knowledge_writeback_status ?? 'all'}`,
    `- 搜索条件：${input.search_query?.trim() || '无'}`,
    `- 可见任务键：${projectTaskKeySet.size ? `${projectTaskKeySet.size} 条` : '未指定'}`,
    `- 涉及项目：${projectIds.size}`,
    `- 状态汇总：${formatKnowledgeWritebackStatusCounts(statusCounts)}`,
    '',
    '## 待写入文件',
    '',
    ...(targetFiles.length ? targetFiles.map(file => `- ${file}`) : ['- 暂无可写入草案']),
    '',
    '## 人工核实要求',
    '',
    '- 补齐正式来源、地点、核实方法和待核点。',
    '- 确认内容适用于原始文化条目，而不只是当前项目。',
    '- 只在人工审稿后复制 append_markdown 到省份 Markdown。',
  ].join('\n');

  const packageWithoutMarkdown = {
    schema_version: 'project-knowledge-writeback-patch/v1' as const,
    exported_at: exportedAt,
    project_id: input.project_id ?? 'multiple-projects',
    project_title: input.project_id ? items[0]?.project_title ?? input.project_id : 'Story Agent 写回队列',
    source_entry: input.project_id ? '项目写回队列' : '多个项目',
    filters,
    approved_count: items.length,
    project_count: projectIds.size,
    status_counts: statusCounts,
    target_files: targetFiles,
    pr_title: prTitle,
    pr_body: prBody,
    items,
  };

  return {
    ...packageWithoutMarkdown,
    markdown: renderProjectKnowledgeWritebackPatchMarkdown(packageWithoutMarkdown),
  };
}

function readCurrentProjectStoryRecord(projectDir: string, project: JsonRecord): JsonRecord | undefined {
  const currentVersionId = nonEmptyString(project.current_version_id);
  if (currentVersionId) {
    const version = readJsonRecordFile(path.resolve(projectDir, 'versions', `${currentVersionId}.json`));
    const story = isRecord(version?.story) ? version.story : undefined;
    if (story && Object.keys(story).length > 0) return story;
  }
  const embeddedStory = isRecord(project.current_story) ? project.current_story : undefined;
  return embeddedStory && Object.keys(embeddedStory).length > 0 ? embeddedStory : undefined;
}

function isProjectKnowledgeWritebackReadyTask(task: JsonRecord): boolean {
  return task.knowledge_candidate_review_status === 'approved'
    && Boolean(nonEmptyString(task.knowledge_writeback_draft_markdown));
}

function inferProjectKnowledgeWritebackTarget(
  story: JsonRecord,
  sourceEntry: string,
): { filePath: string; sectionHeading: string; province?: string } {
  const province = nonEmptyString(story.province)
    ?? firstKnowledgeEntryProvince(story.knowledge_pack);
  return {
    filePath: suggestedProvinceFilePath(province ?? '待确认'),
    sectionHeading: `### ${sourceEntry}`,
    province,
  };
}

function firstKnowledgeEntryProvince(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const primaryEntries = Array.isArray(value.primary_entries) ? value.primary_entries : [];
  const supportingEntries = Array.isArray(value.supporting_entries) ? value.supporting_entries : [];
  for (const entry of [...primaryEntries, ...supportingEntries]) {
    if (isRecord(entry)) {
      const province = nonEmptyString(entry.province);
      if (province) return province;
    }
  }
  return undefined;
}

function projectWritebackSearchText(params: {
  projectId: string;
  projectTitle: string;
  videoType?: string;
  sourceEntry: string;
  target: { filePath: string; sectionHeading: string; province?: string };
  task: JsonRecord;
}): string {
  return [
    params.projectId,
    params.projectTitle,
    params.videoType ?? '',
    params.sourceEntry,
    params.target.province ?? '',
    params.target.filePath,
    nonEmptyString(params.task.label) ?? '',
    nonEmptyString(params.task.description) ?? '',
    nonEmptyString(params.task.knowledge_candidate_review_note) ?? '',
    nonEmptyString(params.task.knowledge_writeback_note) ?? '',
    nonEmptyString(params.task.knowledge_writeback_draft_markdown) ?? '',
    ...(Array.isArray(params.task.recommended_fields) ? params.task.recommended_fields.filter((item): item is string => typeof item === 'string') : []),
  ].join(' ').toLowerCase();
}

function renderProjectKnowledgeWritebackAppendMarkdown(params: {
  projectId: string;
  projectTitle: string;
  videoType?: string;
  sourceEntry: string;
  target: { filePath: string; sectionHeading: string; province?: string };
  taskId: string;
  label: string;
  writebackStatus: KnowledgeWritebackStatus;
  reviewNote?: string;
  writebackNote?: string;
  writebackDraft: string;
  exportedAt: string;
}): string {
  return [
    `### 补录候选：${params.label}`,
    '',
    `> source: project-knowledge-writeback-patch/v1`,
    `> project_id: ${params.projectId}`,
    `> project_title: ${params.projectTitle}`,
    `> task_id: ${params.taskId}`,
    `> source_entry: ${params.sourceEntry}`,
    `> video_type: ${params.videoType ?? '未记录'}`,
    `> target_province: ${params.target.province ?? '待确认'}`,
    `> suggested_file_path: ${params.target.filePath}`,
    `> writeback_status: ${params.writebackStatus}`,
    `> exported_at: ${params.exportedAt}`,
    `> direct_writeback_to_province_markdown: false`,
    '',
    '#### 审稿备注',
    params.reviewNote ? `- ${params.reviewNote}` : '- 未填写',
    '',
    '#### 入库备注',
    params.writebackNote ? `- ${params.writebackNote}` : '- 未填写',
    '',
    '#### 正式知识库写入草案',
    '',
    params.writebackDraft,
  ].join('\n');
}

function renderProjectKnowledgeWritebackPatchMarkdown(
  pkg: Omit<ProjectKnowledgeWritebackPatchPackage, 'markdown'>,
): string {
  return [
    '# Story Agent 写回队列 Patch 草案',
    '',
    `- 导出时间：${pkg.exported_at}`,
    `- 项目筛选：${pkg.filters?.project_id ?? '全部项目'}`,
    `- 片型筛选：${pkg.filters?.video_type ?? 'all'}`,
    `- 省份筛选：${pkg.filters?.province ?? 'all'}`,
    `- 写回状态：${pkg.filters?.knowledge_writeback_status ?? 'all'}`,
    `- 搜索条件：${pkg.filters?.search_query ?? '无'}`,
    `- 可见任务键：${pkg.filters?.task_key_count ? `${pkg.filters.task_key_count} 条` : '未指定'}`,
    `- 涉及项目：${pkg.project_count ?? 0}`,
    `- 状态汇总：${formatKnowledgeWritebackStatusCounts(pkg.status_counts ?? normalizeKnowledgeWritebackStatusCounts())}`,
    `- 已通过候选稿：${pkg.approved_count}`,
    `- 目标文件数：${pkg.target_files.length}`,
    '',
    '## PR 草案',
    '',
    '### Title',
    '',
    pkg.pr_title,
    '',
    '### Body',
    '',
    pkg.pr_body,
    '',
    '## 文件 Patch 草案',
    '',
    ...(pkg.items.length ? pkg.items.flatMap((item, index) => [
      `### ${index + 1}. ${item.label}`,
      '',
      `- 项目：${item.project_title || item.project_id || '未记录'}`,
      `- 成片类型：${item.video_type || '未记录'}`,
      `- 来源条目：${item.source_entry}`,
      `- 目标省份：${item.target_province || '待确认'}`,
      `- 建议文件：${item.suggested_file_path}`,
      `- 建议位置：${item.suggested_section_heading}`,
      `- 审稿备注：${item.review_note || '未填写'}`,
      `- 入库状态：${item.writeback_status || 'draft_ready'}`,
      `- 入库备注：${item.writeback_note || '未填写'}`,
      '',
      '```markdown',
      item.append_markdown,
      '```',
      '',
    ]) : ['- none']),
  ].join('\n').trim() + '\n';
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
    '',
    '## Filters',
    '',
    ...renderKnowledgeWritebackQueueFilterLines(pkg.filters),
    '',
    '## Writeback Status Counts',
    '',
    ...KNOWLEDGE_WRITEBACK_STATUSES.map(status => (
      `- ${status}: total=${pkg.status_counts.total[status]}; project=${pkg.status_counts.project[status]}; expansion=${pkg.status_counts.expansion[status]}`
    )),
    '',
    '## Review Gate',
    '',
    '- 项目草案来源：仅包含候选稿已 approved 且生成正式写回草案的补充任务。',
    '- 扩库草案来源：仅包含 Domain Pack 扩库候选已 approved 且生成写回草案的审稿项。',
    '- 本导出只服务人工核实、PR 草案和外部审稿工具，不直接写入 data/provinces/*.md。',
    '',
    '## Project Writeback Patch',
    '',
    pkg.project_patch.approved_count > 0 ? pkg.project_patch.markdown.trim() : '- none',
    '',
    '## Domain Pack Expansion Writeback Draft',
    '',
    pkg.expansion_draft.approved_count > 0 ? pkg.expansion_draft.markdown?.trim() ?? '- markdown omitted' : '- none',
  ].join('\n').trim() + '\n';
}

function buildProjectKnowledgeWritebackPatchFilters(
  input: KnowledgeWritebackQueueExportToolInput,
  taskKeyCount: number,
): ProjectKnowledgeWritebackPatchFilters {
  return {
    ...(input.project_id ? { project_id: input.project_id } : {}),
    ...(input.video_type ? { video_type: input.video_type } : {}),
    ...(input.province ? { province: input.province } : {}),
    ...(input.knowledge_writeback_status ? { knowledge_writeback_status: input.knowledge_writeback_status } : {}),
    ...(input.search_query?.trim() ? { search_query: input.search_query.trim() } : {}),
    ...(taskKeyCount > 0 ? { task_key_count: taskKeyCount } : {}),
  };
}

function buildKnowledgeWritebackQueueExportFilters(
  input: KnowledgeWritebackQueueExportToolInput,
): KnowledgeWritebackQueueExportFilters {
  return {
    ...(input.project_id ? { project_id: input.project_id } : {}),
    ...(input.video_type ? { video_type: input.video_type } : {}),
    ...(input.province ? { province: input.province } : {}),
    ...(input.knowledge_writeback_status ? { knowledge_writeback_status: input.knowledge_writeback_status } : {}),
    ...(input.search_query?.trim() ? { search_query: input.search_query.trim() } : {}),
    ...(input.project_task_keys?.length ? { project_task_key_count: input.project_task_keys.length } : {}),
    ...(input.expansion_review_item_ids?.length ? { expansion_review_item_count: input.expansion_review_item_ids.length } : {}),
  };
}

function renderKnowledgeWritebackQueueFilterLines(filters: KnowledgeWritebackQueueExportFilters): string[] {
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

function countProjectKnowledgeWritebackStatuses(
  items: ProjectKnowledgeWritebackPatchItem[],
): Record<KnowledgeWritebackStatus, number> {
  const counts = normalizeKnowledgeWritebackStatusCounts();
  for (const item of items) {
    counts[item.writeback_status ?? 'draft_ready'] += 1;
  }
  return counts;
}

function normalizeKnowledgeWritebackStatus(value: unknown): KnowledgeWritebackStatus {
  return KNOWLEDGE_WRITEBACK_STATUSES.includes(value as KnowledgeWritebackStatus)
    ? value as KnowledgeWritebackStatus
    : 'draft_ready';
}

function normalizeKnowledgeWritebackStatusCounts(
  counts?: Partial<Record<KnowledgeWritebackStatus, number>>,
): Record<KnowledgeWritebackStatus, number> {
  return Object.fromEntries(
    KNOWLEDGE_WRITEBACK_STATUSES.map(status => [status, counts?.[status] ?? 0]),
  ) as Record<KnowledgeWritebackStatus, number>;
}

function mergeKnowledgeWritebackStatusCounts(
  projectCounts?: Partial<Record<KnowledgeWritebackStatus, number>>,
  expansionCounts?: Partial<Record<KnowledgeWritebackStatus, number>>,
): Record<KnowledgeWritebackStatus, number> {
  return Object.fromEntries(KNOWLEDGE_WRITEBACK_STATUSES.map(status => [
    status,
    (projectCounts?.[status] ?? 0) + (expansionCounts?.[status] ?? 0),
  ])) as Record<KnowledgeWritebackStatus, number>;
}

function formatKnowledgeWritebackStatusCounts(counts: Record<KnowledgeWritebackStatus, number>): string {
  return KNOWLEDGE_WRITEBACK_STATUSES.map(status => `${status}=${counts[status] ?? 0}`).join(', ');
}

function emptyDomainPackExpansionWritebackDraftToolResult(
  exportedAt: string,
  includeMarkdown?: boolean,
): DomainPackExpansionWritebackDraftToolResult {
  const result: Omit<DomainPackExpansionWritebackDraftPackage, 'markdown'> = {
    schema_version: 'domain-pack-expansion-writeback-draft/v1',
    exported_at: exportedAt,
    domain_id: 'china_culture',
    direct_writeback_to_province_markdown: false,
    filters: {},
    approved_count: 0,
    target_files: [],
    status_counts: normalizeKnowledgeWritebackStatusCounts(),
    items: [],
  };
  return includeMarkdown === false
    ? result
    : {
      ...result,
      markdown: renderDomainPackExpansionWritebackDraftPackageMarkdown(result),
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
  const filterLines = renderExpansionWritebackDraftFilterLines(pkg.filters);
  const statusSummary = KNOWLEDGE_WRITEBACK_STATUSES.map(status => `- ${status}: ${pkg.status_counts[status] ?? 0}`);
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

function normalizeExpansionWritebackDraftFilters(input: {
  review_item_ids?: string[];
  pack_ids?: string[];
  video_types?: string[];
  provinces?: string[];
  writeback_statuses?: KnowledgeWritebackStatus[];
}): DomainPackExpansionWritebackDraftFilter {
  const filters: DomainPackExpansionWritebackDraftFilter = {};
  const reviewItemIds = normalizeFilterValues(input.review_item_ids);
  const packIds = normalizeFilterValues(input.pack_ids);
  const videoTypes = normalizeFilterValues(input.video_types);
  const provinces = normalizeFilterValues(input.provinces);
  const writebackStatuses = normalizeFilterValues(input.writeback_statuses)
    .filter((status): status is KnowledgeWritebackStatus =>
      KNOWLEDGE_WRITEBACK_STATUSES.includes(status as KnowledgeWritebackStatus),
    );

  if (reviewItemIds.length > 0) filters.review_item_ids = reviewItemIds;
  if (packIds.length > 0) filters.pack_ids = packIds;
  if (videoTypes.length > 0) filters.video_types = videoTypes;
  if (provinces.length > 0) filters.provinces = provinces;
  if (writebackStatuses.length > 0) filters.writeback_statuses = writebackStatuses;
  return filters;
}

function matchesExpansionWritebackDraftFilters(
  item: DomainPackExpansionWritebackDraftItem,
  filters: DomainPackExpansionWritebackDraftFilter,
): boolean {
  return (!filters.review_item_ids?.length || filters.review_item_ids.includes(item.review_item_id))
    && (!filters.pack_ids?.length || filters.pack_ids.includes(item.pack_id))
    && (!filters.video_types?.length || item.target_video_types.some(type => filters.video_types?.includes(type)))
    && (!filters.provinces?.length || filters.provinces.includes(item.province))
    && (!filters.writeback_statuses?.length || filters.writeback_statuses.includes(item.writeback_status ?? 'draft_ready'));
}

function renderExpansionWritebackDraftFilterLines(filters: DomainPackExpansionWritebackDraftFilter): string[] {
  const lines = [
    filters.review_item_ids?.length ? `- review_item_ids: ${filters.review_item_ids.join(', ')}` : undefined,
    filters.pack_ids?.length ? `- pack_ids: ${filters.pack_ids.join(', ')}` : undefined,
    filters.video_types?.length ? `- video_types: ${filters.video_types.join(', ')}` : undefined,
    filters.provinces?.length ? `- provinces: ${filters.provinces.join(', ')}` : undefined,
    filters.writeback_statuses?.length ? `- writeback_statuses: ${filters.writeback_statuses.join(', ')}` : undefined,
  ].filter((line): line is string => Boolean(line));
  return lines.length ? lines : ['- none'];
}

function countExpansionReviewStatuses(
  items: DomainPackExpansionReviewItem[],
): Record<DomainPackExpansionReviewStatus, number> {
  const counts = Object.fromEntries(
    DOMAIN_PACK_EXPANSION_REVIEW_STATUSES.map(status => [status, 0]),
  ) as Record<DomainPackExpansionReviewStatus, number>;
  for (const item of items) {
    counts[item.review_status ?? 'candidate_review'] += 1;
  }
  return counts;
}

function countExpansionWritebackStatuses(
  items: DomainPackExpansionWritebackDraftItem[],
): Record<KnowledgeWritebackStatus, number> {
  const counts = Object.fromEntries(
    KNOWLEDGE_WRITEBACK_STATUSES.map(status => [status, 0]),
  ) as Record<KnowledgeWritebackStatus, number>;
  for (const item of items) {
    counts[item.writeback_status ?? 'draft_ready'] += 1;
  }
  return counts;
}

function countExpansionReviewItemWritebackStatuses(
  items: DomainPackExpansionReviewItem[],
): Record<KnowledgeWritebackStatus, number> {
  const counts = Object.fromEntries(
    KNOWLEDGE_WRITEBACK_STATUSES.map(status => [status, 0]),
  ) as Record<KnowledgeWritebackStatus, number>;
  for (const item of items) {
    counts[item.writeback_status ?? 'draft_ready'] += 1;
  }
  return counts;
}

function loadDomainPackExpansionReviewStateMap(): Map<string, DomainPackExpansionReviewStateItem> {
  return new Map(loadDomainPackExpansionReviewStateItems().map(item => [item.review_item_id, item]));
}

function findDomainPackExpansionReviewItem(
  report: DomainPackExpansionCandidateReport,
  reviewItemId: string,
): DomainPackExpansionReviewItem | undefined {
  return report.review_packet.batches
    .flatMap(batch => batch.review_items)
    .find(item => item.review_item_id === reviewItemId);
}

function loadDomainPackExpansionReviewStateItems(): DomainPackExpansionReviewStateItem[] {
  const file = loadDomainPackExpansionReviewStateFile();
  if (!file || file.schema_version !== 'domain-pack-expansion-review-state/v1' || !Array.isArray(file.items)) {
    return [];
  }
  return file.items
    .map(normalizeExpansionReviewStateItem)
    .filter((item): item is DomainPackExpansionReviewStateItem => Boolean(item));
}

function loadDomainPackExpansionReviewStateFile(): DomainPackExpansionReviewStateFile | undefined {
  try {
    const parsed = JSON.parse(readFileSync(domainPackExpansionReviewStateFilePath(), 'utf8')) as unknown;
    return isRecord(parsed) ? parsed as DomainPackExpansionReviewStateFile : undefined;
  } catch {
    return undefined;
  }
}

function saveDomainPackExpansionReviewStateItems(
  items: DomainPackExpansionReviewStateItem[],
  updatedAt: string,
): void {
  const filePath = domainPackExpansionReviewStateFilePath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  const sortedItems = [...items].sort((a, b) => a.review_item_id.localeCompare(b.review_item_id));
  writeFileSync(filePath, `${JSON.stringify({
    schema_version: 'domain-pack-expansion-review-state/v1',
    updated_at: updatedAt,
    direct_writeback_to_province_markdown: false,
    items: sortedItems,
  }, null, 2)}\n`);
}

function normalizeExpansionReviewStateItem(value: unknown): DomainPackExpansionReviewStateItem | undefined {
  if (!isRecord(value) || typeof value.review_item_id !== 'string' || typeof value.review_status !== 'string') {
    return undefined;
  }
  if (!DOMAIN_PACK_EXPANSION_REVIEW_STATUSES.includes(value.review_status as DomainPackExpansionReviewStatus)) {
    return undefined;
  }
  const writebackStatus = typeof value.writeback_status === 'string'
    && KNOWLEDGE_WRITEBACK_STATUSES.includes(value.writeback_status as KnowledgeWritebackStatus)
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

function generatedRoot(): string {
  return process.env.WEB_GENERATED_ROOT || path.resolve(getKbRoot(), '..', 'web', 'generated');
}

function domainPackExpansionReviewStateFilePath(): string {
  return path.resolve(generatedRoot(), 'domain-pack-expansion', DOMAIN_PACK_EXPANSION_REVIEW_STATE_FILE_NAME);
}

function markdownList(items: string[]): string[] {
  return items.length ? items.map(item => `- ${item}`) : ['- none'];
}

function normalizeFilterValues(values: string[] | undefined): string[] {
  if (!values) return [];
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function normalizeExpansionBatch(value: unknown): ExpansionBatch | undefined {
  if (!isRecord(value)) return undefined;
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
    field_groups: Array.isArray(value.field_groups)
      ? value.field_groups.map(normalizeExpansionFieldGroup).filter((group): group is ExpansionFieldGroup => Boolean(group))
      : [],
    seed_targets: Array.isArray(value.seed_targets)
      ? value.seed_targets.map(normalizeExpansionSeedTarget).filter((target): target is ExpansionSeedTarget => Boolean(target))
      : [],
  };
}

function normalizeExpansionFieldGroup(value: unknown): ExpansionFieldGroup | undefined {
  if (!isRecord(value) || typeof value.group_id !== 'string') return undefined;
  return {
    group_id: value.group_id,
    candidate_fields: isStringArray(value.candidate_fields) ? value.candidate_fields : [],
    review_questions: isStringArray(value.review_questions) ? value.review_questions : [],
  };
}

function normalizeExpansionSeedTarget(value: unknown): ExpansionSeedTarget | undefined {
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

function summarizeExpansionBatch(batch: ExpansionBatch): DomainPackExpansionBatchSummary {
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
