import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  field_supplement_candidate_count?: number;
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
  field_workbench_item_count?: number;
  field_supplement_candidate_count?: number;
  field_missing_candidate_count?: number;
  field_candidate_completion_percent?: number;
  field_review_ready_count?: number;
  field_review_blocker_count?: number;
  field_review_ready_percent?: number;
  review_status_counts: Record<DomainPackExpansionReviewStatus, number>;
  approved_writeback_draft_count: number;
  writeback_status_counts: Record<KnowledgeWritebackStatus, number>;
}

interface DomainPackExpansionReviewFieldGroup {
  group_id: string;
  candidate_fields: string[];
  review_questions: string[];
}

type DomainPackExpansionFieldSupplementStatus =
  | 'needs_candidate'
  | 'candidate_draft';

interface DomainPackExpansionFieldWorkbenchItem {
  field_id: string;
  supplement_status: DomainPackExpansionFieldSupplementStatus;
  candidate_value?: string;
  evidence_level?: string;
  source_refs: string[];
  review_questions: string[];
  writeback_hint?: string;
  verification_note?: string;
  review_ready: boolean;
  review_ready_missing: string[];
}

interface DomainPackExpansionFieldSupplementTarget {
  review_item_id: string;
  batch_id: string;
  pack_id: string;
  entry_name: string;
  province: string;
  priority: string;
  target_video_types: string[];
  review_status: DomainPackExpansionReviewStatus;
  writeback_status?: KnowledgeWritebackStatus;
  field_id: string;
  priority_score: number;
  priority_video_types: string[];
  priority_video_type_count: number;
  reason: string;
  review_questions: string[];
  forbidden_direct_claims: string[];
  recommended_action: string;
}

interface DomainPackExpansionReviewReadyTarget {
  review_item_id: string;
  batch_id: string;
  pack_id: string;
  entry_name: string;
  province: string;
  priority: string;
  target_video_types: string[];
  review_status: DomainPackExpansionReviewStatus;
  writeback_status?: KnowledgeWritebackStatus;
  recommended_fields: string[];
  priority_score: number;
  priority_video_types: string[];
  priority_video_type_count: number;
  field_workbench_item_count: number;
  field_review_ready_count: number;
  field_review_blocker_count: number;
  field_review_ready_percent: number;
  review_questions: string[];
  forbidden_direct_claims: string[];
  reason: string;
  recommended_action: string;
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
  review_state_source: DomainPackExpansionReviewStateSource;
  review_state_overrides_seed: boolean;
  review_state_seed_status?: DomainPackExpansionReviewStatus;
  review_state_seed_writeback_status?: KnowledgeWritebackStatus;
  review_state_runtime_status?: DomainPackExpansionReviewStatus;
  review_state_runtime_writeback_status?: KnowledgeWritebackStatus;
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

export type DomainPackExpansionReviewStatus =
  | 'candidate_review'
  | 'approved'
  | 'rejected'
  | 'needs_revision';

type DomainPackExpansionReviewStateSource =
  | 'none'
  | 'seed'
  | 'runtime';

type DomainPackExpansionPipelineStage =
  | 'candidate_setup'
  | 'field_supplement'
  | 'review_readiness'
  | 'human_review'
  | 'writeback_queue'
  | 'complete';

export type KnowledgeWritebackStatus =
  | 'draft_ready'
  | 'queued'
  | 'written_back'
  | 'needs_revision';

type KnowledgeSupplementTaskStatus =
  | 'open'
  | 'resolved';

type KnowledgeSupplementTaskSource =
  | 'knowledge_pack_missing_need'
  | 'material_sufficiency_missing_item'
  | 'production_material_missing_field';

type MaterialBlockingLevel =
  | 'blocking'
  | 'risk'
  | 'optional';

interface DomainPackExpansionReviewStateItem {
  review_item_id: string;
  review_status: DomainPackExpansionReviewStatus;
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
}

interface DomainPackExpansionResolvedReviewStateItem extends DomainPackExpansionReviewStateItem {
  review_state_source: DomainPackExpansionReviewStateSource;
  review_state_overrides_seed: boolean;
  review_state_seed_status?: DomainPackExpansionReviewStatus;
  review_state_seed_writeback_status?: KnowledgeWritebackStatus;
  review_state_runtime_status?: DomainPackExpansionReviewStatus;
  review_state_runtime_writeback_status?: KnowledgeWritebackStatus;
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
  reviewer_id?: string;
  reviewer_name?: string;
  reviewed_by?: string;
  signoff_batch_id?: string;
  signoff_batch_note?: string;
  review_state_source: DomainPackExpansionReviewStateSource;
  review_state_overrides_seed: boolean;
  review_state_seed_status?: DomainPackExpansionReviewStatus;
  review_state_seed_writeback_status?: KnowledgeWritebackStatus;
  review_state_runtime_status?: DomainPackExpansionReviewStatus;
  review_state_runtime_writeback_status?: KnowledgeWritebackStatus;
  writeback_status?: KnowledgeWritebackStatus;
  writeback_note?: string;
  suggested_file_path: string;
  suggested_section_heading: string;
  field_workbench?: DomainPackExpansionFieldWorkbenchItem[];
  field_supplement_candidate_count?: number;
  field_missing_candidate_count?: number;
  field_candidate_completion_percent?: number;
  field_review_ready_count?: number;
  field_review_blocker_count?: number;
  field_review_ready_percent?: number;
  review_ready?: boolean;
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

type DomainPackExpansionDevelopmentTaskStatus = 'ready' | 'in_progress' | 'blocked' | 'complete';

interface DomainPackExpansionNextDevelopmentTask {
  task_id: string;
  title: string;
  priority: 'P0' | 'P1' | 'P2';
  status: DomainPackExpansionDevelopmentTaskStatus;
  progress_percent: number;
  progress_note: string;
  related_plan_items: number[];
  target_video_types: string[];
  description: string;
  acceptance_checks: string[];
  direct_writeback_to_province_markdown: false;
}

interface DomainPackExpansionWritebackPreflightSummary {
  schema_version: 'domain-pack-expansion-writeback-preflight/v1';
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  approved_draft_count: number;
  draft_ready_count: number;
  queued_count: number;
  written_back_count: number;
  needs_revision_count: number;
  target_file_count: number;
  target_files: string[];
  manual_review_required_count: number;
  blocked_direct_writeback_count: number;
  ready_for_unified_export: boolean;
  safety_checks: string[];
}

interface DomainPackExpansionReviewClosureBatchSummary {
  signoff_batch_id: string;
  signoff_batch_note?: string;
  item_count: number;
  ready_for_signoff_count: number;
  blocked_for_signoff_count: number;
  review_note_count: number;
  missing_review_note_count: number;
  reviewer_identity_count: number;
  missing_reviewer_identity_count: number;
  source_ref_count: number;
  candidate_field_count: number;
  review_status_counts: Record<DomainPackExpansionReviewStatus, number>;
  writeback_status_counts: Record<KnowledgeWritebackStatus, number>;
}

interface DomainPackExpansionReviewClosureSummary {
  schema_version: 'domain-pack-expansion-review-closure/v1';
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  ready_for_human_handoff: boolean;
  review_item_count: number;
  approved_count: number;
  draft_ready_count: number;
  queued_count: number;
  written_back_count: number;
  needs_revision_count: number;
  review_ready_item_count: number;
  review_blocked_item_count: number;
  review_note_count: number;
  missing_review_note_count: number;
  reviewer_identity_count: number;
  missing_reviewer_identity_count: number;
  signoff_batch_count: number;
  missing_signoff_batch_count: number;
  runtime_override_count: number;
  seed_sourced_count: number;
  source_ref_count: number;
  candidate_field_count: number;
  manual_writeback_required_count: number;
  ready_for_signoff_count: number;
  blocked_for_signoff_count: number;
  signoff_batch_summaries: DomainPackExpansionReviewClosureBatchSummary[];
  closure_checks: string[];
}

interface DomainPackExpansionWritebackHandoffSummary {
  schema_version: 'domain-pack-expansion-writeback-handoff-summary/v1';
  ready_for_unified_export: boolean;
  target_file_count: number;
  target_files: string[];
  approved_draft_count: number;
  signoff_batch_count: number;
  ready_for_signoff_count: number;
  blocked_for_signoff_count: number;
  source_ref_count: number;
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  writeback_queue_path: '/knowledge-writeback-queue';
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
  pipeline_progress_percent: number;
  pipeline_stage: DomainPackExpansionPipelineStage;
  field_workbench_item_count?: number;
  field_supplement_candidate_count?: number;
  field_missing_candidate_count?: number;
  field_candidate_completion_percent?: number;
  field_review_ready_count?: number;
  field_review_blocker_count?: number;
  field_review_ready_percent?: number;
  review_ready_item_count?: number;
  review_blocked_item_count?: number;
  field_supplement_priority_target_count: number;
  field_supplement_priority_targets: DomainPackExpansionFieldSupplementTarget[];
  review_ready_priority_target_count: number;
  review_ready_priority_targets: DomainPackExpansionReviewReadyTarget[];
  video_type_coverage_count: number;
  coverage_by_video_type: DomainPackExpansionVideoTypeCoverageSummary[];
  writeback_preflight: DomainPackExpansionWritebackPreflightSummary;
  review_closure: DomainPackExpansionReviewClosureSummary;
  writeback_handoff: DomainPackExpansionWritebackHandoffSummary;
  next_development_tasks: DomainPackExpansionNextDevelopmentTask[];
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

interface StorySupplementCandidateTask {
  task_id: string;
  label: string;
  description?: string;
  category?: string;
  stage?: MaterialSufficiencyStage;
  blocking_level: MaterialBlockingLevel;
  affects?: string[];
  recommended_question?: string;
  recommended_fields?: string[];
  intake_prompt?: string;
  status: KnowledgeSupplementTaskStatus;
  source: KnowledgeSupplementTaskSource;
  created_at?: string;
  updated_at?: string;
  resolved_at?: string;
  supplement_note?: string;
  supplement_field_values?: Record<string, string>;
  knowledge_candidate_markdown?: string;
  knowledge_candidate_review_status?: string;
  knowledge_candidate_review_note?: string;
  knowledge_writeback_draft_markdown?: string;
  knowledge_writeback_status?: KnowledgeWritebackStatus;
  knowledge_writeback_note?: string;
}

interface StorySupplementCandidatePackageItem {
  task_key: string;
  project_id: string;
  current_story_id?: string;
  project_title: string;
  source_entry: string;
  video_type?: string;
  target_province?: string;
  suggested_file_path: string;
  updated_at?: string;
  task: StorySupplementCandidateTask;
}

interface StorySupplementCandidatePackageFilters {
  project_id?: string;
  video_type?: string;
  province?: string;
  status?: KnowledgeSupplementTaskStatus;
  stage?: MaterialSufficiencyStage;
  blocking_level?: MaterialBlockingLevel;
  source?: KnowledgeSupplementTaskSource;
  search_query?: string;
  task_key_count?: number;
}

interface StorySupplementCandidatePackage {
  schema_version: 'project-supplement-candidate-package/v1';
  exported_at: string;
  filters: StorySupplementCandidatePackageFilters;
  task_count: number;
  open_task_count: number;
  blocking_open_count: number;
  risk_open_count: number;
  optional_open_count: number;
  project_count: number;
  target_files: string[];
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  items: StorySupplementCandidatePackageItem[];
  markdown: string;
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

interface KnowledgeWritebackQueueExportTargetFilePreflight {
  target_file: string;
  project_draft_count: number;
  expansion_draft_count: number;
  total_draft_count: number;
  expansion_candidate_field_count: number;
  expansion_field_missing_count: number;
  expansion_source_ref_count: number;
  source_ref_coverage_percent: number;
  source_ref_quality_level: KnowledgeWritebackSourceRefQualityLevel;
  source_ref_blocker_count: number;
  source_ref_warning_count: number;
  writeback_status_counts: Record<KnowledgeWritebackStatus, number>;
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  safety_note: string;
}

interface KnowledgeWritebackQueueReviewHandoffItem {
  handoff_id: string;
  source_kind: 'project' | 'domain_pack_expansion';
  title: string;
  target_file: string;
  writeback_status: KnowledgeWritebackStatus;
  province?: string;
  project_id?: string;
  task_id?: string;
  review_item_id?: string;
  pack_id?: string;
  target_video_types: string[];
  review_state_source?: DomainPackExpansionReviewStateSource;
  review_state_overrides_seed?: boolean;
  review_note?: string;
  reviewer_id?: string;
  reviewer_name?: string;
  reviewed_by?: string;
  signoff_batch_id?: string;
  signoff_batch_note?: string;
  writeback_note?: string;
  candidate_field_count: number;
  source_ref_count: number;
  required_action: string;
}

interface KnowledgeWritebackQueueSignoffBatchSummary {
  signoff_batch_id: string;
  signoff_batch_note?: string;
  item_count: number;
  project_handoff_count: number;
  expansion_handoff_count: number;
  requires_manual_signoff_count: number;
  review_note_count: number;
  missing_review_note_count: number;
  reviewer_identity_count: number;
  missing_reviewer_identity_count: number;
  source_ref_count: number;
  candidate_field_count: number;
  status_counts: Record<KnowledgeWritebackStatus, number>;
  ready_for_signoff_count: number;
  blocked_for_signoff_count: number;
}

interface KnowledgeWritebackQueueReviewSignoffManifest {
  schema_version: 'knowledge-writeback-queue-signoff-manifest/v1';
  manifest_id: string;
  generated_at: string;
  sha256: string;
  item_count: number;
  target_file_count: number;
  source_ref_count: number;
  requires_manual_signoff_count: number;
  signoff_batch_ids: string[];
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
}

interface KnowledgeWritebackQueueReviewHandoff {
  schema_version: 'knowledge-writeback-queue-review-handoff/v1';
  signoff_manifest: KnowledgeWritebackQueueReviewSignoffManifest;
  total_handoff_count: number;
  project_handoff_count: number;
  expansion_handoff_count: number;
  runtime_override_count: number;
  seed_sourced_count: number;
  review_note_count: number;
  missing_review_note_count: number;
  reviewer_identity_count: number;
  missing_reviewer_identity_count: number;
  signoff_batch_count: number;
  missing_signoff_batch_count: number;
  signoff_batch_ids: string[];
  signoff_batch_summaries: KnowledgeWritebackQueueSignoffBatchSummary[];
  source_ref_count: number;
  candidate_field_count: number;
  requires_manual_signoff_count: number;
  status_counts: Record<KnowledgeWritebackStatus, number>;
  operator_checklist: string[];
  items: KnowledgeWritebackQueueReviewHandoffItem[];
}

interface KnowledgeWritebackQueueSignoffPackage {
  schema_version: 'knowledge-writeback-queue-signoff-package/v1';
  exported_at: string;
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  filters: KnowledgeWritebackQueueExportFilters;
  signoff_manifest: KnowledgeWritebackQueueReviewSignoffManifest;
  status_counts: Record<KnowledgeWritebackStatus, number>;
  signoff_batch_summaries: KnowledgeWritebackQueueSignoffBatchSummary[];
  operator_checklist: string[];
  handoff_item_count: number;
  handoff_items: KnowledgeWritebackQueueReviewHandoffItem[];
}

type KnowledgeWritebackSourceRefQualityLevel = 'pass' | 'warning' | 'blocker';
type KnowledgeWritebackSourceRefCheckStatus = 'pass' | 'warning' | 'blocker';
type KnowledgeWritebackSourceRefCheckReason =
  | 'local_file_exists'
  | 'local_file_exists_no_anchor'
  | 'local_file_missing'
  | 'anchor_found'
  | 'anchor_missing_manual_review'
  | 'external_source_ref'
  | 'project_markdown_reference'
  | 'unparsed_source_ref';

interface KnowledgeWritebackSourceRefCheck {
  source_ref: string;
  source_kind: 'project' | 'domain_pack_expansion';
  item_id: string;
  target_file: string;
  local_path?: string;
  anchor?: string;
  file_exists: boolean;
  anchor_checked: boolean;
  anchor_found: boolean;
  status: KnowledgeWritebackSourceRefCheckStatus;
  reason: KnowledgeWritebackSourceRefCheckReason;
}

interface KnowledgeWritebackSourceRefQualityItem {
  item_id: string;
  source_kind: 'project' | 'domain_pack_expansion';
  title: string;
  target_file: string;
  candidate_field_count: number;
  checked_field_count: number;
  covered_field_count: number;
  source_ref_count: number;
  missing_source_ref_field_count: number;
  missing_verification_note_field_count: number;
  missing_writeback_hint_field_count: number;
  coverage_percent: number;
  quality_level: KnowledgeWritebackSourceRefQualityLevel;
  blocker_reasons: string[];
  warning_reasons: string[];
}

interface KnowledgeWritebackSourceRefQualitySummary {
  schema_version: 'knowledge-writeback-source-ref-quality/v1';
  total_item_count: number;
  project_item_count: number;
  expansion_item_count: number;
  checked_field_count: number;
  covered_field_count: number;
  source_ref_count: number;
  missing_source_ref_field_count: number;
  missing_verification_note_field_count: number;
  missing_writeback_hint_field_count: number;
  coverage_percent: number;
  pass_item_count: number;
  warning_item_count: number;
  blocker_item_count: number;
  source_ref_check_count: number;
  source_ref_check_pass_count: number;
  source_ref_check_warning_count: number;
  source_ref_check_blocker_count: number;
  local_source_ref_count: number;
  file_missing_source_ref_count: number;
  anchor_missing_source_ref_count: number;
  source_ref_checks: KnowledgeWritebackSourceRefCheck[];
  items: KnowledgeWritebackSourceRefQualityItem[];
}

interface KnowledgeWritebackManualPatchTarget {
  target_file: string;
  patch_applyable: false;
  manual_apply_only: true;
  ready_for_manual_apply: boolean;
  project_patch_count: number;
  expansion_patch_count: number;
  total_patch_count: number;
  source_ref_count: number;
  candidate_field_count: number;
  source_ref_coverage_percent: number;
  source_ref_quality_level: KnowledgeWritebackSourceRefQualityLevel;
  blocker_reasons: string[];
  warning_reasons: string[];
  append_markdown: string;
  review_diff: string;
  diff_preview_lines: string[];
  diff_preview_truncated: boolean;
  safety_checks: string[];
}

interface KnowledgeWritebackManualPatchManifest {
  schema_version: 'knowledge-writeback-manual-patch-manifest/v1';
  manifest_id: string;
  generated_at: string;
  sha256: string;
  target_file_count: number;
  ready_target_file_count: number;
  blocked_target_file_count: number;
  total_patch_count: number;
  source_ref_check_warning_count: number;
  source_ref_check_blocker_count: number;
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  patch_applyable: false;
  manual_apply_only: true;
  target_files: string[];
}

interface KnowledgeWritebackManualPatchClosureCertificate {
  schema_version: 'knowledge-writeback-manual-patch-closure-certificate/v1';
  certificate_id: string;
  generated_at: string;
  sha256: string;
  status: 'ready_for_operator_apply' | 'blocked';
  ready_for_operator_apply: boolean;
  manual_patch_manifest_id: string;
  manual_patch_manifest_sha256: string;
  signoff_manifest_id: string;
  signoff_manifest_sha256: string;
  target_file_count: number;
  ready_target_file_count: number;
  blocked_target_file_count: number;
  total_patch_count: number;
  source_ref_check_warning_count: number;
  source_ref_check_blocker_count: number;
  blocker_reason_count: number;
  warning_reason_count: number;
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  patch_applyable: false;
  manual_apply_only: true;
  operator_required_actions: string[];
}

interface KnowledgeWritebackManualPatchPackage {
  schema_version: 'knowledge-writeback-manual-patch-package/v1';
  exported_at: string;
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  patch_applyable: false;
  manual_apply_only: true;
  ready_for_manual_apply: boolean;
  target_file_count: number;
  target_files: string[];
  ready_target_file_count: number;
  blocked_target_file_count: number;
  total_patch_count: number;
  project_patch_count: number;
  expansion_patch_count: number;
  source_ref_count: number;
  candidate_field_count: number;
  source_ref_quality: KnowledgeWritebackSourceRefQualitySummary;
  manual_patch_manifest: KnowledgeWritebackManualPatchManifest;
  manual_patch_closure_certificate: KnowledgeWritebackManualPatchClosureCertificate;
  ready_reasons: string[];
  blocker_reasons: string[];
  warning_reasons: string[];
  safety_checks: string[];
  operator_checklist: string[];
  target_patches: KnowledgeWritebackManualPatchTarget[];
}

interface KnowledgeWritebackQueueExportPreflight {
  schema_version: 'knowledge-writeback-queue-export-preflight/v1';
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  target_file_count: number;
  target_files: string[];
  total_draft_count: number;
  project_draft_count: number;
  expansion_draft_count: number;
  expansion_candidate_field_count: number;
  expansion_field_missing_count: number;
  expansion_source_ref_count: number;
  source_ref_quality: KnowledgeWritebackSourceRefQualitySummary;
  manual_review_required_count: number;
  blocked_direct_writeback_count: number;
  ready_for_manual_export: boolean;
  target_file_preflight: KnowledgeWritebackQueueExportTargetFilePreflight[];
  review_handoff: KnowledgeWritebackQueueReviewHandoff;
  safety_checks: string[];
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
  preflight: KnowledgeWritebackQueueExportPreflight;
  signoff_package: KnowledgeWritebackQueueSignoffPackage;
  manual_patch_package: KnowledgeWritebackManualPatchPackage;
  project_patch: ProjectKnowledgeWritebackPatchPackage;
  expansion_draft: DomainPackExpansionWritebackDraftToolResult;
  markdown: string;
}

export type KnowledgeWritebackQueueExportToolResult =
  Omit<KnowledgeWritebackQueueExportPackage, 'markdown'> & { markdown?: string };

export type StorySupplementCandidatePackageToolResult =
  Omit<StorySupplementCandidatePackage, 'markdown'> & { markdown?: string };

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

export interface StorySupplementCandidatePackageToolInput {
  include_markdown?: boolean;
  project_id?: string;
  video_type?: string;
  province?: string;
  status?: KnowledgeSupplementTaskStatus;
  stage?: MaterialSufficiencyStage;
  blocking_level?: MaterialBlockingLevel;
  source?: KnowledgeSupplementTaskSource;
  search_query?: string;
  project_task_keys?: string[];
}

export interface DomainPackExpansionReviewStateUpdateInput {
  review_item_id: string;
  review_status: DomainPackExpansionReviewStatus;
  review_note?: string;
  reviewer_id?: string;
  reviewer_name?: string;
  reviewed_by?: string;
  signoff_batch_id?: string;
  signoff_batch_note?: string;
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
  reviewer_id?: string;
  reviewer_name?: string;
  reviewed_by?: string;
  signoff_batch_id?: string;
  signoff_batch_note?: string;
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
const DOMAIN_PACK_EXPANSION_REVIEW_STATE_SEED_FILE_NAME = 'china-culture-production-expansion-review-state.seed.json';

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

const KNOWLEDGE_SUPPLEMENT_TASK_STATUSES: KnowledgeSupplementTaskStatus[] = [
  'open',
  'resolved',
];

const KNOWLEDGE_SUPPLEMENT_TASK_SOURCES: KnowledgeSupplementTaskSource[] = [
  'knowledge_pack_missing_need',
  'material_sufficiency_missing_item',
  'production_material_missing_field',
];

const MATERIAL_BLOCKING_LEVELS: MaterialBlockingLevel[] = [
  'blocking',
  'risk',
  'optional',
];

const UNASSIGNED_SIGNOFF_BATCH_ID = 'unassigned_signoff_batch';
const MANUAL_DIFF_PREVIEW_LINE_LIMIT = 80;

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
  'review_packet'
  | 'video_type_coverage_count'
  | 'coverage_by_video_type'
  | 'writeback_preflight'
  | 'review_closure'
  | 'writeback_handoff'
  | 'next_development_tasks'
  | 'field_supplement_priority_target_count'
  | 'field_supplement_priority_targets'
  | 'review_ready_priority_target_count'
  | 'review_ready_priority_targets'
  | 'pipeline_progress_percent'
  | 'pipeline_stage'
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
  reviewState: Map<string, DomainPackExpansionResolvedReviewStateItem> = new Map(),
): DomainPackExpansionCandidateReport {
  const reviewPacket = buildDomainPackExpansionReviewPacket(report, sourceBatches, includeMarkdown, reviewState);
  const coverageByVideoType = buildExpansionVideoTypeCoverage(sourceBatches, reviewPacket);
  const fieldSupplementPriorityTargets = buildExpansionFieldSupplementPriorityTargets(reviewPacket);
  const reviewReadyPriorityTargets = buildExpansionReviewReadyPriorityTargets(reviewPacket);
  const pipelineProgress = buildExpansionPipelineProgress(report, reviewPacket);
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
  const writebackPreflight = buildExpansionWritebackPreflightSummary(reportCore);
  const reviewClosure = buildExpansionReviewClosureSummary(reportCore, writebackPreflight);
  const writebackHandoff = buildExpansionWritebackHandoffSummary(writebackPreflight, reviewClosure);
  return {
    ...reportCore,
    writeback_preflight: writebackPreflight,
    review_closure: reviewClosure,
    writeback_handoff: writebackHandoff,
    next_development_tasks: buildExpansionNextDevelopmentTasks(reportCore, writebackPreflight, reviewClosure),
  };
}

function buildExpansionWritebackPreflightSummary(
  report: Omit<DomainPackExpansionCandidateReport, 'writeback_preflight' | 'review_closure' | 'writeback_handoff' | 'next_development_tasks'>,
): DomainPackExpansionWritebackPreflightSummary {
  const approvedItems = report.review_packet.batches.flatMap(batch =>
    batch.review_items.filter(item => item.review_status === 'approved' && Boolean(item.writeback_draft_markdown)),
  );
  const writebackCounts = countExpansionReviewItemWritebackStatuses(approvedItems);
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

function buildExpansionReviewClosureSummary(
  report: Omit<DomainPackExpansionCandidateReport, 'writeback_preflight' | 'review_closure' | 'writeback_handoff' | 'next_development_tasks'>,
  preflight: DomainPackExpansionWritebackPreflightSummary,
): DomainPackExpansionReviewClosureSummary {
  const reviewItems = report.review_packet.batches.flatMap(batch => batch.review_items);
  const approvedItems = reviewItems.filter(item => item.review_status === 'approved');
  const writebackCounts = countExpansionReviewItemWritebackStatuses(approvedItems);
  const reviewNoteCount = reviewItems.filter(item => Boolean(item.review_note?.trim())).length;
  const reviewerIdentityCount = reviewItems.filter(item => Boolean(reviewerDisplayName(item))).length;
  const signoffBatchCount = new Set(reviewItems
    .map(item => item.signoff_batch_id?.trim())
    .filter((id): id is string => Boolean(id))).size;
  const missingSignoffBatchCount = reviewItems.filter(item => !item.signoff_batch_id?.trim()).length;
  const runtimeOverrideCount = reviewItems.filter(item =>
    item.review_state_source === 'runtime' || item.review_state_overrides_seed,
  ).length;
  const seedSourcedCount = reviewItems.filter(item => item.review_state_source === 'seed').length;
  const sourceRefCount = reviewItems.reduce((sum, item) =>
    sum + item.field_workbench.reduce((fieldSum, field) => fieldSum + field.source_refs.length, 0), 0);
  const candidateFieldCount = reviewItems.reduce((sum, item) => sum + item.field_workbench.length, 0);
  const readyForSignoffCount = reviewItems.filter(isExpansionReviewClosureItemReadyForSignoff).length;
  const blockedForSignoffCount = reviewItems.length - readyForSignoffCount;
  const missingReviewNoteCount = reviewItems.length - reviewNoteCount;
  const missingReviewerIdentityCount = reviewItems.length - reviewerIdentityCount;
  const readyForHumanHandoff = reviewItems.length > 0
    && preflight.ready_for_unified_export
    && preflight.blocked_direct_writeback_count === 0
    && report.review_packet.field_review_blocker_count === 0
    && readyForSignoffCount === reviewItems.length
    && missingReviewNoteCount === 0
    && missingReviewerIdentityCount === 0
    && missingSignoffBatchCount === 0;

  return {
    schema_version: 'domain-pack-expansion-review-closure/v1',
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    ready_for_human_handoff: readyForHumanHandoff,
    review_item_count: reviewItems.length,
    approved_count: approvedItems.length,
    draft_ready_count: writebackCounts.draft_ready,
    queued_count: writebackCounts.queued,
    written_back_count: writebackCounts.written_back,
    needs_revision_count: writebackCounts.needs_revision,
    review_ready_item_count: report.review_packet.review_ready_item_count ?? 0,
    review_blocked_item_count: report.review_packet.review_blocked_item_count ?? 0,
    review_note_count: reviewNoteCount,
    missing_review_note_count: missingReviewNoteCount,
    reviewer_identity_count: reviewerIdentityCount,
    missing_reviewer_identity_count: missingReviewerIdentityCount,
    signoff_batch_count: signoffBatchCount,
    missing_signoff_batch_count: missingSignoffBatchCount,
    runtime_override_count: runtimeOverrideCount,
    seed_sourced_count: seedSourcedCount,
    source_ref_count: sourceRefCount,
    candidate_field_count: candidateFieldCount,
    manual_writeback_required_count: preflight.manual_review_required_count,
    ready_for_signoff_count: readyForSignoffCount,
    blocked_for_signoff_count: blockedForSignoffCount,
    signoff_batch_summaries: buildExpansionReviewClosureBatchSummaries(reviewItems),
    closure_checks: [
      'direct_writeback_to_province_markdown=false',
      'province_markdown_written=false',
      `ready_for_human_handoff=${readyForHumanHandoff}`,
      `review_notes_covered=${reviewNoteCount}/${reviewItems.length}`,
      `reviewer_identities_covered=${reviewerIdentityCount}/${reviewItems.length}`,
      `signoff_batches_covered=${reviewItems.length - missingSignoffBatchCount}/${reviewItems.length}`,
      `ready_for_signoff=${readyForSignoffCount}/${reviewItems.length}`,
      `manual_writeback_required=${preflight.manual_review_required_count}`,
      'province_markdown_waits_for_manual_writeback=true',
    ],
  };
}

function buildExpansionReviewClosureBatchSummaries(
  reviewItems: DomainPackExpansionReviewItem[],
): DomainPackExpansionReviewClosureBatchSummary[] {
  const batches = new Map<string, {
    signoffBatchNote?: string;
    items: DomainPackExpansionReviewItem[];
  }>();
  for (const item of reviewItems) {
    const signoffBatchId = item.signoff_batch_id?.trim() || 'unassigned_signoff_batch';
    const current = batches.get(signoffBatchId) ?? { items: [] };
    if (!current.signoffBatchNote && item.signoff_batch_note?.trim()) {
      current.signoffBatchNote = item.signoff_batch_note.trim();
    }
    current.items.push(item);
    batches.set(signoffBatchId, current);
  }

  return [...batches.entries()]
    .map(([signoffBatchId, summary]) => {
      const items = summary.items;
      const reviewNoteCount = items.filter(item => Boolean(item.review_note?.trim())).length;
      const reviewerIdentityCount = items.filter(item => Boolean(reviewerDisplayName(item))).length;
      const sourceRefCount = items.reduce((sum, item) =>
        sum + item.field_workbench.reduce((fieldSum, field) => fieldSum + field.source_refs.length, 0), 0);
      const candidateFieldCount = items.reduce((sum, item) => sum + item.field_workbench.length, 0);
      const readyForSignoffCount = items.filter(isExpansionReviewClosureItemReadyForSignoff).length;
      return {
        signoff_batch_id: signoffBatchId,
        ...(summary.signoffBatchNote ? { signoff_batch_note: summary.signoffBatchNote } : {}),
        item_count: items.length,
        ready_for_signoff_count: readyForSignoffCount,
        blocked_for_signoff_count: items.length - readyForSignoffCount,
        review_note_count: reviewNoteCount,
        missing_review_note_count: items.length - reviewNoteCount,
        reviewer_identity_count: reviewerIdentityCount,
        missing_reviewer_identity_count: items.length - reviewerIdentityCount,
        source_ref_count: sourceRefCount,
        candidate_field_count: candidateFieldCount,
        review_status_counts: countExpansionReviewStatuses(items),
        writeback_status_counts: countExpansionReviewItemWritebackStatuses(items.filter(item =>
          item.review_status === 'approved',
        )),
      };
    })
    .sort((a, b) => {
      if (a.signoff_batch_id === 'unassigned_signoff_batch') return 1;
      if (b.signoff_batch_id === 'unassigned_signoff_batch') return -1;
      return a.signoff_batch_id.localeCompare(b.signoff_batch_id);
    });
}

function buildExpansionWritebackHandoffSummary(
  preflight: DomainPackExpansionWritebackPreflightSummary,
  reviewClosure: DomainPackExpansionReviewClosureSummary,
): DomainPackExpansionWritebackHandoffSummary {
  return {
    schema_version: 'domain-pack-expansion-writeback-handoff-summary/v1',
    ready_for_unified_export: preflight.ready_for_unified_export,
    target_file_count: preflight.target_file_count,
    target_files: preflight.target_files,
    approved_draft_count: preflight.approved_draft_count,
    signoff_batch_count: reviewClosure.signoff_batch_count,
    ready_for_signoff_count: reviewClosure.ready_for_signoff_count,
    blocked_for_signoff_count: reviewClosure.blocked_for_signoff_count,
    source_ref_count: reviewClosure.source_ref_count,
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    writeback_queue_path: '/knowledge-writeback-queue',
  };
}

function isExpansionReviewClosureItemReadyForSignoff(item: DomainPackExpansionReviewItem): boolean {
  return item.review_status === 'approved'
    && item.review_ready
    && item.field_review_blocker_count === 0
    && Boolean(item.review_note?.trim())
    && Boolean(reviewerDisplayName(item))
    && Boolean(item.signoff_batch_id?.trim())
    && (item.writeback_status ?? 'draft_ready') !== 'needs_revision';
}

function buildExpansionNextDevelopmentTasks(
  report: Omit<DomainPackExpansionCandidateReport, 'writeback_preflight' | 'review_closure' | 'writeback_handoff' | 'next_development_tasks'>,
  preflight: DomainPackExpansionWritebackPreflightSummary,
  reviewClosure: DomainPackExpansionReviewClosureSummary,
): DomainPackExpansionNextDevelopmentTask[] {
  const coreVideoTypes = ['explainer_video', 'heritage_promo', 'documentary_short', 'ai_comic_drama'];
  const thirdBatchComplete = (report.review_packet.approved_writeback_draft_count ?? 0) >= 100;
  const mvpSurfaceComplete = report.pipeline_stage === 'complete' && reviewClosure.ready_for_human_handoff;
  return [
    {
      task_id: 'field_workbench_controls',
      title: '字段级补库工作台增强',
      priority: 'P0',
      status: report.pipeline_stage === 'complete' ? 'complete' : 'ready',
      progress_percent: 100,
      progress_note: '扩库审稿页和统一写回队列已有 pack/video/province/status/source/handoff 筛选、字段级预览、复核人身份、审签批次归档、批次完成率汇总、批量写回状态操作、导出预检、签收清单、canonical signoff package 和前端下载归档。',
      related_plan_items: [1],
      target_video_types: coreVideoTypes,
      description: '增强筛选、字段预览、批量审稿和写回状态操作，让 100 条草案可被人工高效复核。',
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
      status: reviewClosure.ready_for_human_handoff ? 'complete' : 'ready',
      progress_percent: reviewClosure.ready_for_human_handoff ? 100 : 99,
      progress_note: '运行态 review-state 覆盖 seed、退回原因模板、复核备注汇总、复核人身份归档、审签批次 ID/备注、批次 ready/blocked 汇总、source 筛选、人工签收 manifest、canonical signoff package、下载归档和 review_closure 结案摘要已可见；正式省份 Markdown 仍等待人工写回。',
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
      status: preflight.ready_for_unified_export ? 'complete' : 'blocked',
      progress_percent: 100,
      progress_note: '统一导出 preflight 已结构化展示目标文件、字段差异、来源引用、source_ref check 分级、人工交接、复核人身份覆盖率、审签批次归档、签收 manifest/sha256、canonical signoff package、manual patch manifest、signoff safety checks 和不可直写提示。',
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
      task_id: 'third_batch_real_candidates',
      title: '第三批真实补库候选',
      priority: 'P1',
      status: thirdBatchComplete ? 'complete' : 'ready',
      progress_percent: thirdBatchComplete ? 100 : 99,
      progress_note: '当前 100 条已形成 approved 草案并进入人工交接闭环；第三批闭环包继续覆盖非遗宣传、微纪录、AI 漫剧和知识讲解，正式落库仍保持人工写回边界。',
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
      status: mvpSurfaceComplete ? 'complete' : 'blocked',
      progress_percent: mvpSurfaceComplete ? 100 : 99,
      progress_note: 'MVP 已接入扩库 complete、100 条写回草案计数、review_closure 结案摘要、复核交接签收 manifest/canonical signoff package、manual patch manifest、manual patch closure certificate、source_ref check 分级、supplement candidate package、复核人身份覆盖率、审签批次归档、批次 ready/blocked 汇总、下载归档证据、runtime 覆盖证据和 1-5 项百分比；明确显示“完成候选但待人工写回”。',
      related_plan_items: [5],
      target_video_types: coreVideoTypes,
      description: '把“扩库候选完成但未写入正式知识库”的真实状态接入 Story Agent MVP 与生产健康面板。',
      acceptance_checks: [
        'MVP 证据显示 pipeline complete 与 approved writeback drafts。',
        'MVP 证据显示 Story supplement candidate package ready 与 province_markdown_written=false。',
        '同时提示正式知识库仍需人工写回。',
        '生产健康报告保留只读写回草案边界。',
      ],
      direct_writeback_to_province_markdown: false,
    },
  ];
}

function buildExpansionFieldSupplementPriorityTargets(
  reviewPacket: DomainPackExpansionReviewPacket,
): DomainPackExpansionFieldSupplementTarget[] {
  return reviewPacket.batches
    .flatMap(batch => batch.review_items.flatMap(item =>
      item.field_workbench
        .filter(field => field.supplement_status === 'needs_candidate')
        .map(field => {
          const priorityScore = expansionFieldSupplementPriorityScore(item);
          const priorityVideoTypes = matchedExpansionPriorityVideoTypes(item.target_video_types);
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
            reason: expansionFieldSupplementPriorityReason(item, field.field_id, priorityScore),
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

function buildExpansionReviewReadyPriorityTargets(
  reviewPacket: DomainPackExpansionReviewPacket,
): DomainPackExpansionReviewReadyTarget[] {
  return reviewPacket.batches
    .flatMap(batch => batch.review_items
      .filter(item => item.review_ready && (item.review_status ?? 'candidate_review') === 'candidate_review')
      .map(item => {
        const priorityScore = expansionReviewReadyPriorityScore(item);
        const priorityVideoTypes = matchedExpansionPriorityVideoTypes(item.target_video_types);
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
          reason: expansionReviewReadyPriorityReason(item, priorityScore),
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

function expansionFieldSupplementPriorityScore(item: DomainPackExpansionReviewItem): number {
  const videoTypeScore = Math.max(0, ...item.target_video_types.map(expansionVideoTypePriorityScore));
  const priorityVideoTypeCoverageScore = matchedExpansionPriorityVideoTypes(item.target_video_types).length * 4;
  const packPriorityScore = item.priority === 'P0' ? 40 : item.priority === 'P1' ? 20 : 10;
  const reviewScore = (item.review_status ?? 'candidate_review') === 'candidate_review' ? 6 : 0;
  return videoTypeScore + priorityVideoTypeCoverageScore + packPriorityScore + reviewScore;
}

function expansionReviewReadyPriorityScore(item: DomainPackExpansionReviewItem): number {
  const videoTypeScore = Math.max(0, ...item.target_video_types.map(expansionVideoTypePriorityScore));
  const priorityVideoTypeCoverageScore = matchedExpansionPriorityVideoTypes(item.target_video_types).length * 4;
  const packPriorityScore = item.priority === 'P0' ? 40 : item.priority === 'P1' ? 20 : 10;
  const reviewStatusScore = (item.review_status ?? 'candidate_review') === 'candidate_review' ? 8 : 0;
  const readinessScore = item.review_ready ? 12 : 0;
  return videoTypeScore + priorityVideoTypeCoverageScore + packPriorityScore + reviewStatusScore + readinessScore;
}

function matchedExpansionPriorityVideoTypes(videoTypes: string[]): string[] {
  const priorityVideoTypes = new Set(['explainer_video', 'heritage_promo', 'documentary_short', 'ai_comic_drama']);
  return videoTypes.filter(videoType => priorityVideoTypes.has(videoType));
}

function expansionVideoTypePriorityScore(videoType: string): number {
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

function expansionFieldSupplementPriorityReason(
  item: DomainPackExpansionReviewItem,
  fieldId: string,
  priorityScore: number,
): string {
  const videoTypes = item.target_video_types.join('/');
  return `${item.priority} · ${videoTypes} · ${item.entry_name} 缺 ${fieldId} 候选值，priority_score=${priorityScore}`;
}

function expansionReviewReadyPriorityReason(
  item: DomainPackExpansionReviewItem,
  priorityScore: number,
): string {
  const priorityVideoTypes = matchedExpansionPriorityVideoTypes(item.target_video_types).join('/') || 'none';
  return `${item.priority} · priority_video_types=${priorityVideoTypes} · 字段送审 ${item.field_review_ready_count}/${item.field_workbench.length} · ${item.entry_name} 等待人工审稿，priority_score=${priorityScore}`;
}

function buildDomainPackExpansionReviewPacket(
  report: DomainPackExpansionCandidateReportDraft,
  sourceBatches: ExpansionBatch[],
  includeMarkdown: boolean,
  reviewState: Map<string, DomainPackExpansionResolvedReviewStateItem>,
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
  reviewState: Map<string, DomainPackExpansionResolvedReviewStateItem>,
): DomainPackExpansionReviewItem {
  const reviewItemId = `${batch.batch_id}::target_${String(index + 1).padStart(2, '0')}`;
  const stateItem = reviewState.get(reviewItemId);
  const reviewStatus = stateItem?.review_status ?? 'candidate_review';
  const fieldWorkbench = buildExpansionFieldWorkbench(batch, target);
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

function buildExpansionPipelineProgress(
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

type ExpansionFieldReviewReadyCandidate = Pick<
  DomainPackExpansionFieldWorkbenchItem,
  'supplement_status'
  | 'candidate_value'
  | 'evidence_level'
  | 'source_refs'
  | 'writeback_hint'
  | 'verification_note'
>;

function expansionFieldReviewReadyMissing(field: ExpansionFieldReviewReadyCandidate): string[] {
  const missing: string[] = [];
  if (field.supplement_status !== 'candidate_draft') missing.push('candidate_draft');
  if (!field.candidate_value?.trim()) missing.push('candidate_value');
  if (!field.evidence_level?.trim()) missing.push('evidence_level');
  if (field.source_refs.length === 0) missing.push('source_refs');
  if (!field.writeback_hint?.trim()) missing.push('writeback_hint');
  if (!field.verification_note?.trim()) missing.push('verification_note');
  return missing;
}

function buildExpansionFieldWorkbench(
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
      const reviewReadyMissing = expansionFieldReviewReadyMissing(field);
      return {
        ...field,
        review_ready: reviewReadyMissing.length === 0,
        review_ready_missing: reviewReadyMissing,
      };
    });
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
  const preflight = report.writeback_preflight;
  const reviewClosure = report.review_closure;
  const writebackHandoff = report.writeback_handoff;
  const priorityTargetLines = renderExpansionFieldSupplementPriorityTargetLines(report.field_supplement_priority_targets.slice(0, 24));
  const reviewReadyTargetLines = renderExpansionReviewReadyPriorityTargetLines(report.review_ready_priority_targets.slice(0, 24));
  const nextDevelopmentTaskLines = renderExpansionNextDevelopmentTaskLines(report.next_development_tasks);

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
    `- review_packet_approved_count: ${report.review_packet.review_status_counts?.approved ?? 0}`,
    `- approved_writeback_draft_count: ${report.review_packet.approved_writeback_draft_count ?? 0}`,
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
    '## Review Closure',
    '',
    `- schema_version: ${reviewClosure.schema_version}`,
    `- ready_for_human_handoff: ${reviewClosure.ready_for_human_handoff}`,
    `- review_item_count: ${reviewClosure.review_item_count}`,
    `- approved_count: ${reviewClosure.approved_count}`,
    `- draft_ready_count: ${reviewClosure.draft_ready_count}`,
    `- queued_count: ${reviewClosure.queued_count}`,
    `- written_back_count: ${reviewClosure.written_back_count}`,
    `- needs_revision_count: ${reviewClosure.needs_revision_count}`,
    `- review_note_count: ${reviewClosure.review_note_count}`,
    `- missing_review_note_count: ${reviewClosure.missing_review_note_count}`,
    `- reviewer_identity_count: ${reviewClosure.reviewer_identity_count}`,
    `- missing_reviewer_identity_count: ${reviewClosure.missing_reviewer_identity_count}`,
    `- signoff_batch_count: ${reviewClosure.signoff_batch_count}`,
    `- missing_signoff_batch_count: ${reviewClosure.missing_signoff_batch_count}`,
    `- ready_for_signoff_count: ${reviewClosure.ready_for_signoff_count}`,
    `- blocked_for_signoff_count: ${reviewClosure.blocked_for_signoff_count}`,
    `- runtime_override_count: ${reviewClosure.runtime_override_count}`,
    `- seed_sourced_count: ${reviewClosure.seed_sourced_count}`,
    `- source_ref_count: ${reviewClosure.source_ref_count}`,
    `- candidate_field_count: ${reviewClosure.candidate_field_count}`,
    `- manual_writeback_required_count: ${reviewClosure.manual_writeback_required_count}`,
    ...reviewClosure.closure_checks.map(check => `- closure_check: ${check}`),
    ...renderExpansionReviewClosureBatchSummaryLines(reviewClosure.signoff_batch_summaries),
    '',
    '## Writeback Handoff',
    '',
    `- writeback_handoff_schema: ${writebackHandoff.schema_version}`,
    `- writeback_handoff_ready_for_unified_export: ${writebackHandoff.ready_for_unified_export}`,
    `- writeback_handoff_target_file_count: ${writebackHandoff.target_file_count}`,
    `- writeback_handoff_target_files: ${writebackHandoff.target_files.join(', ') || 'none'}`,
    `- writeback_handoff_approved_draft_count: ${writebackHandoff.approved_draft_count}`,
    `- writeback_handoff_signoff_batch_count: ${writebackHandoff.signoff_batch_count}`,
    `- writeback_handoff_ready_for_signoff_count: ${writebackHandoff.ready_for_signoff_count}`,
    `- writeback_handoff_blocked_for_signoff_count: ${writebackHandoff.blocked_for_signoff_count}`,
    `- writeback_handoff_source_ref_count: ${writebackHandoff.source_ref_count}`,
    `- writeback_handoff_direct_writeback_to_province_markdown: ${writebackHandoff.direct_writeback_to_province_markdown}`,
    `- writeback_handoff_province_markdown_written: ${writebackHandoff.province_markdown_written}`,
    `- writeback_handoff_queue_path: ${writebackHandoff.writeback_queue_path}`,
    '',
    '## Next Development Tasks',
    '',
    ...nextDevelopmentTaskLines,
    '',
    '## Video Type Coverage',
    '',
    ...renderExpansionVideoTypeCoverageLines(report.coverage_by_video_type),
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
  ].join('\n').trim() + '\n';
}

function renderExpansionReviewClosureBatchSummaryLines(
  summaries: DomainPackExpansionReviewClosureBatchSummary[],
): string[] {
  if (summaries.length === 0) return ['- signoff_batch: none'];
  return summaries.map(summary =>
    `- signoff_batch: ${summary.signoff_batch_id}, items=${summary.item_count}, ready=${summary.ready_for_signoff_count}, blocked=${summary.blocked_for_signoff_count}, notes=${summary.review_note_count}/${summary.item_count}, reviewers=${summary.reviewer_identity_count}/${summary.item_count}, source_refs=${summary.source_ref_count}`,
  );
}

function renderExpansionNextDevelopmentTaskLines(tasks: DomainPackExpansionNextDevelopmentTask[]): string[] {
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

function renderExpansionFieldSupplementPriorityTargetLines(
  targets: DomainPackExpansionFieldSupplementTarget[],
): string[] {
  if (targets.length === 0) return ['- none'];
  return targets.map(target =>
    `- score=${target.priority_score} · priority_video_types=${target.priority_video_type_count}(${target.priority_video_types.join('/') || 'none'}) · ${target.priority} · ${target.pack_id} · ${target.entry_name} · ${target.field_id} · ${target.province} · ${target.target_video_types.join('/')}`,
  );
}

function renderExpansionReviewReadyPriorityTargetLines(
  targets: DomainPackExpansionReviewReadyTarget[],
): string[] {
  if (targets.length === 0) return ['- none'];
  return targets.map(target =>
    `- score=${target.priority_score} · priority_video_types=${target.priority_video_type_count}(${target.priority_video_types.join('/') || 'none'}) · ${target.priority} · ${target.pack_id} · ${target.entry_name} · ${target.province} · fields=${target.field_review_ready_count}/${target.field_workbench_item_count} · ${target.target_video_types.join('/')}`,
  );
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
    `- ${item.video_type}: batches=${item.batch_count}, targets=${item.seed_target_count}, fields=${item.candidate_field_count}, field_workbench=${item.field_workbench_item_count ?? 0}, field_samples=${item.field_supplement_candidate_count ?? 0}, field_missing=${item.field_missing_candidate_count ?? 0}, field_completion=${item.field_candidate_completion_percent ?? 100}%, field_review_ready=${item.field_review_ready_count ?? 0}, field_review_blockers=${item.field_review_blocker_count ?? 0}, field_review_ready_percent=${item.field_review_ready_percent ?? 100}%, approved=${item.review_status_counts.approved}, drafts=${item.approved_writeback_draft_count}, packs=${item.pack_ids.join(', ') || 'none'}, provinces=${item.provinces.join(', ') || 'none'}`,
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
    `- field_workbench_item_count: ${packet.field_workbench_item_count ?? 0}`,
    `- field_supplement_candidate_count: ${packet.field_supplement_candidate_count ?? 0}`,
    `- field_missing_candidate_count: ${packet.field_missing_candidate_count ?? 0}`,
    `- field_candidate_completion_percent: ${packet.field_candidate_completion_percent ?? 100}`,
    `- field_review_ready_count: ${packet.field_review_ready_count ?? 0}`,
    `- field_review_blocker_count: ${packet.field_review_blocker_count ?? 0}`,
    `- field_review_ready_percent: ${packet.field_review_ready_percent ?? 100}`,
    `- review_ready_item_count: ${packet.review_ready_item_count ?? 0}`,
    `- review_blocked_item_count: ${packet.review_blocked_item_count ?? 0}`,
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
  const fieldWorkbenchLines = item.field_workbench.length
    ? item.field_workbench.flatMap(renderExpansionFieldWorkbenchMarkdown)
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

function renderExpansionFieldWorkbenchMarkdown(item: DomainPackExpansionFieldWorkbenchItem): string[] {
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
  const preflight = buildKnowledgeWritebackQueueExportPreflight({
    exportedAt,
    targetFiles,
    projectItems: projectPatch.items,
    expansionItems: expansionDraft.items,
    statusCounts: statusCounts.total,
  });
  const filters = buildKnowledgeWritebackQueueExportFilters(input);
  const signoffPackage = buildKnowledgeWritebackQueueSignoffPackage(exportedAt, filters, preflight.review_handoff);
  const manualPatchPackage = buildKnowledgeWritebackManualPatchPackage({
    exportedAt,
    targetFiles,
    projectItems: projectPatch.items,
    expansionItems: expansionDraft.items,
    preflight,
  });
  const packageWithoutMarkdown: Omit<KnowledgeWritebackQueueExportPackage, 'markdown'> = {
    schema_version: 'knowledge-writeback-queue-export/v1',
    exported_at: exportedAt,
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    filters,
    approved_count: projectPatch.approved_count + expansionDraft.approved_count,
    project_approved_count: projectPatch.approved_count,
    expansion_approved_count: expansionDraft.approved_count,
    project_count: projectPatch.project_count ?? 0,
    target_files: targetFiles,
    status_counts: statusCounts,
    preflight,
    signoff_package: signoffPackage,
    manual_patch_package: manualPatchPackage,
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

export function getStorySupplementCandidatePackageToolResult(
  input: StorySupplementCandidatePackageToolInput = {},
): StorySupplementCandidatePackageToolResult {
  const exportedAt = new Date().toISOString();
  const projectTaskKeySet = new Set(normalizeFilterValues(input.project_task_keys));
  const statusFilter = input.status ?? 'open';
  const searchQuery = input.search_query?.trim().toLowerCase();
  const items: StorySupplementCandidatePackageItem[] = [];
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
    const currentStoryId = nonEmptyString(project.current_story_id) ?? nonEmptyString(story.story_id);
    const projectUpdatedAt = nonEmptyString(project.updated_at) ?? nonEmptyString(story.updated_at);
    const tasks = Array.isArray(story.supplement_tasks) ? story.supplement_tasks : [];

    for (const rawTask of tasks) {
      if (!isRecord(rawTask)) continue;

      const taskStatus = normalizeSupplementTaskStatus(rawTask.status);
      if (taskStatus !== statusFilter) continue;

      const stage = normalizeSupplementStage(rawTask.stage);
      if (input.stage && input.stage !== stage) continue;

      const blockingLevel = normalizeSupplementBlockingLevel(rawTask.blocking_level);
      if (input.blocking_level && input.blocking_level !== blockingLevel) continue;

      const source = normalizeSupplementSource(rawTask.source);
      if (input.source && input.source !== source) continue;

      const taskId = nonEmptyString(rawTask.task_id) ?? `task_${items.length + 1}`;
      const taskKey = `${projectId}::${taskId}`;
      if (projectTaskKeySet.size > 0 && !projectTaskKeySet.has(taskKey)) continue;

      const task = normalizeStorySupplementCandidateTask(rawTask, {
        taskId,
        taskStatus,
        stage,
        blockingLevel,
        source,
      });
      const item: StorySupplementCandidatePackageItem = {
        task_key: taskKey,
        project_id: projectId,
        current_story_id: currentStoryId,
        project_title: projectTitle,
        source_entry: sourceEntry,
        video_type: videoType,
        target_province: target.province,
        suggested_file_path: target.filePath,
        updated_at: task.updated_at ?? projectUpdatedAt,
        task,
      };
      if (searchQuery && !storySupplementCandidateSearchText(item).includes(searchQuery)) continue;

      projectIds.add(projectId);
      items.push(item);
    }
  }

  items.sort((a, b) => [
    a.suggested_file_path,
    a.project_title,
    a.task.label,
  ].join('\u0000').localeCompare([
    b.suggested_file_path,
    b.project_title,
    b.task.label,
  ].join('\u0000'), 'zh-CN'));

  const targetFiles = [...new Set(items.map(item => item.suggested_file_path))].sort((a, b) => a.localeCompare(b));
  const openItems = items.filter(item => item.task.status === 'open');
  const packageWithoutMarkdown: Omit<StorySupplementCandidatePackage, 'markdown'> = {
    schema_version: 'project-supplement-candidate-package/v1',
    exported_at: exportedAt,
    filters: buildStorySupplementCandidatePackageFilters(input, projectTaskKeySet.size, statusFilter),
    task_count: items.length,
    open_task_count: openItems.length,
    blocking_open_count: openItems.filter(item => item.task.blocking_level === 'blocking').length,
    risk_open_count: openItems.filter(item => item.task.blocking_level === 'risk').length,
    optional_open_count: openItems.filter(item => item.task.blocking_level === 'optional').length,
    project_count: projectIds.size,
    target_files: targetFiles,
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    items,
  };

  return input.include_markdown === false
    ? packageWithoutMarkdown
    : {
      ...packageWithoutMarkdown,
      markdown: renderStorySupplementCandidatePackageMarkdown(packageWithoutMarkdown),
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
  const approvalBlocker = expansionReviewApprovalBlockerMessage(input.review_status, [currentItem]);
  if (approvalBlocker) {
    return {
      schema_version: 'domain-pack-expansion-review-state-update/v1',
      updated_at: updatedAt,
      ok: false,
      review_item_id: input.review_item_id,
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
      message: approvalBlocker,
    };
  }

  const currentItems = loadDomainPackExpansionReviewStateItems();
  const nextItems = new Map(currentItems.map(item => [item.review_item_id, item]));
  const existing = nextItems.get(input.review_item_id);
  const reviewNote = input.review_note?.trim() || undefined;
  const reviewerId = input.reviewer_id?.trim() || existing?.reviewer_id;
  const reviewerName = input.reviewer_name?.trim() || existing?.reviewer_name;
  const reviewedBy = input.reviewed_by?.trim() || reviewerName || existing?.reviewed_by || reviewerId;
  const signoffBatchId = input.signoff_batch_id?.trim() || existing?.signoff_batch_id;
  const signoffBatchNote = input.signoff_batch_note?.trim() || existing?.signoff_batch_note;
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
  const approvalBlocker = expansionReviewApprovalBlockerMessage(
    input.review_status,
    uniqueReviewItemIds.map(reviewItemId => itemById.get(reviewItemId)).filter((item): item is DomainPackExpansionReviewItem => Boolean(item)),
  );
  if (approvalBlocker) {
    return {
      schema_version: 'domain-pack-expansion-review-state-bulk-update/v1',
      updated_at: updatedAt,
      ok: false,
      updated_count: 0,
      missing_review_item_ids: [],
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
      message: approvalBlocker,
    };
  }

  const currentItems = loadDomainPackExpansionReviewStateItems();
  const nextItems = new Map(currentItems.map(item => [item.review_item_id, item]));
  const reviewNote = input.review_note?.trim() || undefined;
  const reviewerId = input.reviewer_id?.trim() || undefined;
  const reviewerName = input.reviewer_name?.trim() || undefined;
  const reviewedBy = input.reviewed_by?.trim() || reviewerName || reviewerId;
  const signoffBatchId = input.signoff_batch_id?.trim() || undefined;
  const signoffBatchNote = input.signoff_batch_note?.trim() || undefined;
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
      review_note: reviewNote ?? existing?.review_note,
      reviewed_at: updatedAt,
      reviewer_id: reviewerId ?? existing?.reviewer_id,
      reviewer_name: reviewerName ?? existing?.reviewer_name,
      reviewed_by: reviewedBy ?? existing?.reviewed_by,
      signoff_batch_id: signoffBatchId ?? existing?.signoff_batch_id,
      signoff_batch_note: signoffBatchNote ?? existing?.signoff_batch_note,
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

function normalizeSupplementTaskStatus(value: unknown): KnowledgeSupplementTaskStatus {
  return KNOWLEDGE_SUPPLEMENT_TASK_STATUSES.includes(value as KnowledgeSupplementTaskStatus)
    ? value as KnowledgeSupplementTaskStatus
    : 'open';
}

function normalizeSupplementStage(value: unknown): MaterialSufficiencyStage | undefined {
  return PACK_HEALTH_GATE_STAGES.includes(value as MaterialSufficiencyStage)
    ? value as MaterialSufficiencyStage
    : undefined;
}

function normalizeSupplementBlockingLevel(value: unknown): MaterialBlockingLevel {
  return MATERIAL_BLOCKING_LEVELS.includes(value as MaterialBlockingLevel)
    ? value as MaterialBlockingLevel
    : 'optional';
}

function normalizeSupplementSource(value: unknown): KnowledgeSupplementTaskSource {
  return KNOWLEDGE_SUPPLEMENT_TASK_SOURCES.includes(value as KnowledgeSupplementTaskSource)
    ? value as KnowledgeSupplementTaskSource
    : 'knowledge_pack_missing_need';
}

function normalizeStorySupplementCandidateTask(
  task: JsonRecord,
  normalized: {
    taskId: string;
    taskStatus: KnowledgeSupplementTaskStatus;
    stage?: MaterialSufficiencyStage;
    blockingLevel: MaterialBlockingLevel;
    source: KnowledgeSupplementTaskSource;
  },
): StorySupplementCandidateTask {
  const writebackStatusText = nonEmptyString(task.knowledge_writeback_status);
  return {
    task_id: normalized.taskId,
    label: nonEmptyString(task.label) ?? normalized.taskId,
    description: nonEmptyString(task.description),
    category: nonEmptyString(task.category),
    stage: normalized.stage,
    blocking_level: normalized.blockingLevel,
    affects: storySupplementStringArray(task.affects),
    recommended_question: nonEmptyString(task.recommended_question),
    recommended_fields: storySupplementStringArray(task.recommended_fields),
    intake_prompt: nonEmptyString(task.intake_prompt),
    status: normalized.taskStatus,
    source: normalized.source,
    created_at: nonEmptyString(task.created_at),
    updated_at: nonEmptyString(task.updated_at),
    resolved_at: nonEmptyString(task.resolved_at),
    supplement_note: nonEmptyString(task.supplement_note),
    supplement_field_values: storySupplementFieldValues(task.supplement_field_values),
    knowledge_candidate_markdown: nonEmptyString(task.knowledge_candidate_markdown),
    knowledge_candidate_review_status: nonEmptyString(task.knowledge_candidate_review_status),
    knowledge_candidate_review_note: nonEmptyString(task.knowledge_candidate_review_note),
    knowledge_writeback_draft_markdown: nonEmptyString(task.knowledge_writeback_draft_markdown),
    knowledge_writeback_status: writebackStatusText ? normalizeKnowledgeWritebackStatus(writebackStatusText) : undefined,
    knowledge_writeback_note: nonEmptyString(task.knowledge_writeback_note),
  };
}

function storySupplementStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean);
  return values.length ? [...new Set(values)] : undefined;
}

function storySupplementFieldValues(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value)
    .map(([field, fieldValue]) => [
      field.trim(),
      typeof fieldValue === 'string' ? fieldValue.trim() : '',
    ] as const)
    .filter(([field, fieldValue]) => Boolean(field && fieldValue));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function storySupplementCandidateSearchText(item: StorySupplementCandidatePackageItem): string {
  return [
    item.task_key,
    item.project_id,
    item.current_story_id ?? '',
    item.project_title,
    item.source_entry,
    item.video_type ?? '',
    item.target_province ?? '',
    item.suggested_file_path,
    item.task.task_id,
    item.task.label,
    item.task.description ?? '',
    item.task.category ?? '',
    item.task.stage ?? '',
    item.task.blocking_level,
    item.task.source,
    item.task.recommended_question ?? '',
    ...(item.task.affects ?? []),
    ...(item.task.recommended_fields ?? []),
    item.task.intake_prompt ?? '',
    item.task.supplement_note ?? '',
    ...Object.entries(item.task.supplement_field_values ?? {}).flatMap(([field, value]) => [field, value]),
    item.task.knowledge_candidate_markdown ?? '',
    item.task.knowledge_candidate_review_status ?? '',
    item.task.knowledge_candidate_review_note ?? '',
    item.task.knowledge_writeback_draft_markdown ?? '',
    item.task.knowledge_writeback_status ?? '',
    item.task.knowledge_writeback_note ?? '',
  ].join(' ').toLowerCase();
}

function buildStorySupplementCandidatePackageFilters(
  input: StorySupplementCandidatePackageToolInput,
  taskKeyCount: number,
  statusFilter: KnowledgeSupplementTaskStatus,
): StorySupplementCandidatePackageFilters {
  return {
    ...(input.project_id ? { project_id: input.project_id } : {}),
    ...(input.video_type ? { video_type: input.video_type } : {}),
    ...(input.province ? { province: input.province } : {}),
    status: statusFilter,
    ...(input.stage ? { stage: input.stage } : {}),
    ...(input.blocking_level ? { blocking_level: input.blocking_level } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(input.search_query?.trim() ? { search_query: input.search_query.trim() } : {}),
    ...(taskKeyCount > 0 ? { task_key_count: taskKeyCount } : {}),
  };
}

function renderStorySupplementCandidatePackageMarkdown(
  pkg: Omit<StorySupplementCandidatePackage, 'markdown'>,
): string {
  return [
    '# Story Agent 素材补库候选包',
    '',
    `> schema_version: ${pkg.schema_version}`,
    `> exported_at: ${pkg.exported_at}`,
    `> direct_writeback_to_province_markdown: ${pkg.direct_writeback_to_province_markdown}`,
    `> province_markdown_written: ${pkg.province_markdown_written}`,
    '',
    '## 筛选与统计',
    '',
    `- 项目筛选：${pkg.filters.project_id ?? '全部项目'}`,
    `- 片型筛选：${pkg.filters.video_type ?? 'all'}`,
    `- 省份筛选：${pkg.filters.province ?? 'all'}`,
    `- 任务状态：${pkg.filters.status ?? 'open'}`,
    `- 阶段筛选：${pkg.filters.stage ?? 'all'}`,
    `- 分级筛选：${pkg.filters.blocking_level ?? 'all'}`,
    `- 来源筛选：${pkg.filters.source ?? 'all'}`,
    `- 搜索条件：${pkg.filters.search_query ?? '无'}`,
    `- 可见任务键：${pkg.filters.task_key_count ? `${pkg.filters.task_key_count} 条` : '未指定'}`,
    `- 候选任务：${pkg.task_count}`,
    `- open 任务：${pkg.open_task_count}`,
    `- blocking/risk/optional：${pkg.blocking_open_count}/${pkg.risk_open_count}/${pkg.optional_open_count}`,
    `- 涉及项目：${pkg.project_count}`,
    `- 目标文件：${pkg.target_files.length}`,
    '',
    '## 只读写回策略',
    '',
    '- 只生成候选稿、审稿材料和人工写回草案。',
    '- 不直接修改 data/provinces/*.md。',
    '- 进入正式素材库前必须人工核源、补齐来源与版权边界。',
    '',
    '## 目标文件',
    '',
    ...markdownList(pkg.target_files),
    '',
    '## 候选任务',
    '',
    ...(pkg.items.length ? pkg.items.flatMap(renderStorySupplementCandidateItemMarkdown) : ['- none']),
  ].join('\n').trim() + '\n';
}

function renderStorySupplementCandidateItemMarkdown(
  item: StorySupplementCandidatePackageItem,
  index: number,
): string[] {
  const fieldValueLines = Object.entries(item.task.supplement_field_values ?? {})
    .map(([field, value]) => `- ${field}: ${value}`);
  return [
    `### ${index + 1}. ${item.task.label}`,
    '',
    `- task_key: ${item.task_key}`,
    `- project_id: ${item.project_id}`,
    `- current_story_id: ${item.current_story_id ?? '未记录'}`,
    `- project_title: ${item.project_title}`,
    `- source_entry: ${item.source_entry}`,
    `- video_type: ${item.video_type ?? '未记录'}`,
    `- target_province: ${item.target_province ?? '待确认'}`,
    `- suggested_file_path: ${item.suggested_file_path}`,
    `- status: ${item.task.status}`,
    `- source: ${item.task.source}`,
    `- stage: ${item.task.stage ?? '未记录'}`,
    `- blocking_level: ${item.task.blocking_level}`,
    `- updated_at: ${item.updated_at ?? '未记录'}`,
    '',
    '#### 缺口说明',
    '',
    item.task.description ?? '- 未填写',
    '',
    '#### 建议采集',
    '',
    item.task.recommended_question ? `- 问题：${item.task.recommended_question}` : '- 问题：未填写',
    ...(item.task.recommended_fields?.length
      ? item.task.recommended_fields.map(field => `- 字段：${field}`)
      : ['- 字段：未填写']),
    ...(item.task.affects?.length
      ? item.task.affects.map(field => `- 影响：${field}`)
      : []),
    ...(item.task.intake_prompt ? [`- 采集提示：${item.task.intake_prompt}`] : []),
    '',
    '#### 已补材料',
    '',
    item.task.supplement_note ? `- 备注：${item.task.supplement_note}` : '- 备注：未填写',
    ...(fieldValueLines.length ? fieldValueLines : ['- 字段值：未填写']),
    '',
    '#### 审稿与写回草案',
    '',
    `- candidate_review_status: ${item.task.knowledge_candidate_review_status ?? '未提交'}`,
    `- candidate_review_note: ${item.task.knowledge_candidate_review_note ?? '未填写'}`,
    `- writeback_status: ${item.task.knowledge_writeback_status ?? '未入队'}`,
    `- writeback_note: ${item.task.knowledge_writeback_note ?? '未填写'}`,
    '',
    ...(item.task.knowledge_candidate_markdown
      ? ['```markdown', item.task.knowledge_candidate_markdown, '```', '']
      : []),
    ...(item.task.knowledge_writeback_draft_markdown
      ? ['```markdown', item.task.knowledge_writeback_draft_markdown, '```', '']
      : []),
  ];
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
    `- preflight_target_files: ${pkg.preflight.target_file_count}`,
    `- preflight_total_drafts: ${pkg.preflight.total_draft_count}`,
    `- preflight_expansion_candidate_fields: ${pkg.preflight.expansion_candidate_field_count}`,
    `- preflight_expansion_source_refs: ${pkg.preflight.expansion_source_ref_count}`,
    `- preflight_source_ref_coverage: ${pkg.preflight.source_ref_quality.coverage_percent}%`,
    `- preflight_source_ref_blockers: ${pkg.preflight.source_ref_quality.blocker_item_count}`,
    `- preflight_source_ref_warnings: ${pkg.preflight.source_ref_quality.warning_item_count}`,
    `- preflight_source_ref_check_warnings: ${pkg.preflight.source_ref_quality.source_ref_check_warning_count}`,
    `- preflight_source_ref_check_blockers: ${pkg.preflight.source_ref_quality.source_ref_check_blocker_count}`,
    `- preflight_manual_review_required: ${pkg.preflight.manual_review_required_count}`,
    `- manual_patch_package: ${pkg.manual_patch_package.schema_version}`,
    `- manual_patch_manifest_id: ${pkg.manual_patch_package.manual_patch_manifest.manifest_id}`,
    `- manual_patch_closure_certificate_id: ${pkg.manual_patch_package.manual_patch_closure_certificate.certificate_id}`,
    `- manual_patch_ready: ${pkg.manual_patch_package.ready_for_manual_apply}`,
    `- manual_patch_target_files: ${pkg.manual_patch_package.target_file_count}`,
    `- manual_patch_total_patches: ${pkg.manual_patch_package.total_patch_count}`,
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
    `- source_ref_check_count: ${pkg.preflight.source_ref_quality.source_ref_check_count}`,
    `- source_ref_check_pass_count: ${pkg.preflight.source_ref_quality.source_ref_check_pass_count}`,
    `- source_ref_check_warning_count: ${pkg.preflight.source_ref_quality.source_ref_check_warning_count}`,
    `- source_ref_check_blocker_count: ${pkg.preflight.source_ref_quality.source_ref_check_blocker_count}`,
    `- file_missing_source_ref_count: ${pkg.preflight.source_ref_quality.file_missing_source_ref_count}`,
    `- anchor_missing_source_ref_count: ${pkg.preflight.source_ref_quality.anchor_missing_source_ref_count}`,
    `- blocked_direct_writeback_count: ${pkg.preflight.blocked_direct_writeback_count}`,
    ...pkg.preflight.safety_checks.map(check => `- ${check}`),
    '',
    '### Target File Preflight',
    '',
    ...renderKnowledgeWritebackTargetFilePreflightLines(pkg.preflight.target_file_preflight),
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
    `- ready_target_file_count: ${pkg.manual_patch_package.ready_target_file_count}`,
    `- blocked_target_file_count: ${pkg.manual_patch_package.blocked_target_file_count}`,
    `- total_patch_count: ${pkg.manual_patch_package.total_patch_count}`,
    `- project_patch_count: ${pkg.manual_patch_package.project_patch_count}`,
    `- expansion_patch_count: ${pkg.manual_patch_package.expansion_patch_count}`,
    `- source_ref_count: ${pkg.manual_patch_package.source_ref_count}`,
    `- candidate_field_count: ${pkg.manual_patch_package.candidate_field_count}`,
    `- source_ref_coverage_percent: ${pkg.manual_patch_package.source_ref_quality.coverage_percent}`,
    `- source_ref_blocker_items: ${pkg.manual_patch_package.source_ref_quality.blocker_item_count}`,
    `- source_ref_warning_items: ${pkg.manual_patch_package.source_ref_quality.warning_item_count}`,
    `- source_ref_check_warning_count: ${pkg.manual_patch_package.source_ref_quality.source_ref_check_warning_count}`,
    `- source_ref_check_blocker_count: ${pkg.manual_patch_package.source_ref_quality.source_ref_check_blocker_count}`,
    `- manual_patch_manifest_id: ${pkg.manual_patch_package.manual_patch_manifest.manifest_id}`,
    `- manual_patch_manifest_sha256: ${pkg.manual_patch_package.manual_patch_manifest.sha256}`,
    `- closure_certificate_schema: ${pkg.manual_patch_package.manual_patch_closure_certificate.schema_version}`,
    `- closure_certificate_id: ${pkg.manual_patch_package.manual_patch_closure_certificate.certificate_id}`,
    `- closure_certificate_sha256: ${pkg.manual_patch_package.manual_patch_closure_certificate.sha256}`,
    `- closure_certificate_status: ${pkg.manual_patch_package.manual_patch_closure_certificate.status}`,
    `- closure_certificate_ready: ${pkg.manual_patch_package.manual_patch_closure_certificate.ready_for_operator_apply}`,
    `- closure_certificate_signoff_manifest_id: ${pkg.manual_patch_package.manual_patch_closure_certificate.signoff_manifest_id}`,
    `- closure_certificate_manual_patch_manifest_id: ${pkg.manual_patch_package.manual_patch_closure_certificate.manual_patch_manifest_id}`,
    ...pkg.manual_patch_package.ready_reasons.map(reason => `- ready_reason: ${reason}`),
    ...pkg.manual_patch_package.blocker_reasons.map(reason => `- blocker_reason: ${reason}`),
    ...pkg.manual_patch_package.warning_reasons.map(reason => `- warning_reason: ${reason}`),
    ...pkg.manual_patch_package.safety_checks.map(check => `- safety_check: ${check}`),
    '',
    '### Manual Patch Operator Checklist',
    '',
    ...pkg.manual_patch_package.operator_checklist.map(item => `- ${item}`),
    '',
    '### Manual Patch Closure Certificate',
    '',
    ...pkg.manual_patch_package.manual_patch_closure_certificate.operator_required_actions.map(item => `- ${item}`),
    '',
    '### Target Review Diffs',
    '',
    ...renderKnowledgeWritebackManualPatchTargetLines(pkg.manual_patch_package.target_patches),
    '',
    '### Operator Checklist',
    '',
    ...pkg.preflight.review_handoff.operator_checklist.map(item => `- ${item}`),
    '',
    '### Signoff Batch Summaries',
    '',
    ...renderKnowledgeWritebackSignoffBatchSummaryLines(pkg.preflight.review_handoff.signoff_batch_summaries),
    '',
    '### Handoff Items',
    '',
    ...renderKnowledgeWritebackReviewHandoffLines(pkg.preflight.review_handoff.items),
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

function renderKnowledgeWritebackManualPatchTargetLines(
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
    const appendMarkdown = renderKnowledgeWritebackManualPatchAppendMarkdown(targetFile, projectItems, expansionItems);
    const reviewDiff = renderKnowledgeWritebackManualReviewDiff(targetFile, appendMarkdown);
    const sourceRefQuality = buildKnowledgeWritebackSourceRefQualitySummary(projectItems, expansionItems);
    const blockerReasons = knowledgeWritebackTargetManualPatchBlockerReasons(targetFile, projectItems, expansionItems, sourceRefQuality);
    const warningReasons = knowledgeWritebackTargetManualPatchWarningReasons(sourceRefQuality);
    const sourceRefCount = countDomainPackExpansionSourceRefs(expansionItems);
    const candidateFieldTotal = expansionItems.reduce((sum, item) =>
      sum + (item.field_supplement_candidate_count ?? domainPackExpansionCandidateFieldCount(item)), 0);
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
      source_ref_quality_level: knowledgeWritebackSourceRefQualityLevel(sourceRefQuality),
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
  const readyTargetFileCount = targetPatches.filter(item => item.ready_for_manual_apply).length;
  const blockedTargetFileCount = targetPatches.length - readyTargetFileCount;
  const readyForSignoffCount = input.preflight.review_handoff.signoff_batch_summaries
    .reduce((sum, item) => sum + item.ready_for_signoff_count, 0);
  const blockerReasons = knowledgeWritebackManualPatchPackageBlockerReasons({
    totalPatchCount,
    preflight: input.preflight,
    readyForSignoffCount,
  });
  const warningReasons = knowledgeWritebackManualPatchPackageWarningReasons(input.preflight.source_ref_quality);
  const readyForManualApply = blockerReasons.length === 0;
  const manualPatchManifest = buildKnowledgeWritebackManualPatchManifest({
    exportedAt: input.exportedAt,
    targetPatches,
    sourceRefQuality: input.preflight.source_ref_quality,
    readyTargetFileCount,
    blockedTargetFileCount,
  });
  const manualPatchClosureCertificate = buildKnowledgeWritebackManualPatchClosureCertificate({
    exportedAt: input.exportedAt,
    manualPatchManifest,
    signoffManifest: input.preflight.review_handoff.signoff_manifest,
    readyForManualApply,
    readyTargetFileCount,
    blockedTargetFileCount,
    targetFileCount: targetPatches.length,
    totalPatchCount,
    sourceRefQuality: input.preflight.source_ref_quality,
    blockerReasons,
    warningReasons,
  });
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
    direct_writeback_to_province_markdown: false as const,
    province_markdown_written: false as const,
    patch_applyable: false as const,
    manual_apply_only: true as const,
    ready_for_manual_apply: readyForManualApply,
    target_file_count: targetPatches.length,
    target_files: input.targetFiles,
    ready_target_file_count: readyTargetFileCount,
    blocked_target_file_count: blockedTargetFileCount,
    total_patch_count: totalPatchCount,
    project_patch_count: input.projectItems.length,
    expansion_patch_count: input.expansionItems.length,
    source_ref_count: countDomainPackExpansionSourceRefs(input.expansionItems),
    candidate_field_count: input.expansionItems.reduce((sum, item) =>
      sum + (item.field_supplement_candidate_count ?? domainPackExpansionCandidateFieldCount(item)), 0),
    source_ref_quality: input.preflight.source_ref_quality,
    manual_patch_manifest: manualPatchManifest,
    manual_patch_closure_certificate: manualPatchClosureCertificate,
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
      `ready_target_files=${readyTargetFileCount}`,
      `blocked_target_files=${blockedTargetFileCount}`,
      `total_patch_count=${totalPatchCount}`,
      `manual_patch_manifest_id=${manualPatchManifest.manifest_id}`,
      `manual_patch_manifest_sha256=${manualPatchManifest.sha256}`,
      `manual_patch_closure_certificate_id=${manualPatchClosureCertificate.certificate_id}`,
      `manual_patch_closure_certificate_sha256=${manualPatchClosureCertificate.sha256}`,
      `manual_patch_closure_certificate_ready=${manualPatchClosureCertificate.ready_for_operator_apply}`,
      `review_handoff_ready_for_signoff=${readyForSignoffCount}/${input.preflight.review_handoff.total_handoff_count}`,
      `source_ref_coverage=${input.preflight.source_ref_quality.coverage_percent}%`,
      `source_ref_blocker_items=${input.preflight.source_ref_quality.blocker_item_count}`,
      `source_ref_check_warnings=${input.preflight.source_ref_quality.source_ref_check_warning_count}`,
      `source_ref_check_blockers=${input.preflight.source_ref_quality.source_ref_check_blocker_count}`,
    ],
    operator_checklist: [
      '先核对 signoff manifest、review_note、reviewer_identity 和 signoff_batch_id。',
      '保存 manual_patch_closure_certificate，用 certificate_id/sha256 对齐 signoff manifest 与 manual patch manifest。',
      '逐个打开 target_file，对照 append_markdown 与 review_diff 人工合并。',
      '合并前再次核对 source_refs、字段边界和 forbidden_direct_claims。',
      '本包不是 git apply 补丁；patch_applyable=false，只作为人工写回审阅材料。',
      '人工写回完成后再单独把对应任务标记为 written_back。',
    ],
    target_patches: targetPatches,
  };
}

function buildKnowledgeWritebackManualPatchManifest(input: {
  exportedAt: string;
  targetPatches: Array<Pick<
    KnowledgeWritebackManualPatchTarget,
    'target_file' | 'ready_for_manual_apply' | 'total_patch_count' | 'review_diff' | 'blocker_reasons' | 'warning_reasons'
  >>;
  sourceRefQuality: KnowledgeWritebackSourceRefQualitySummary;
  readyTargetFileCount: number;
  blockedTargetFileCount: number;
}): KnowledgeWritebackManualPatchManifest {
  const targetFiles = input.targetPatches.map(item => item.target_file);
  const payload = {
    schema_version: 'knowledge-writeback-manual-patch-manifest/v1',
    generated_at: input.exportedAt,
    target_files: targetFiles,
    targets: input.targetPatches.map(item => ({
      target_file: item.target_file,
      ready_for_manual_apply: item.ready_for_manual_apply,
      total_patch_count: item.total_patch_count,
      blocker_reasons: item.blocker_reasons,
      warning_reasons: item.warning_reasons,
      review_diff_sha256: createHash('sha256').update(item.review_diff).digest('hex'),
    })),
    source_ref_check_warning_count: input.sourceRefQuality.source_ref_check_warning_count,
    source_ref_check_blocker_count: input.sourceRefQuality.source_ref_check_blocker_count,
    direct_writeback_to_province_markdown: false as const,
    province_markdown_written: false as const,
    patch_applyable: false as const,
    manual_apply_only: true as const,
  };
  const sha256 = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return {
    schema_version: 'knowledge-writeback-manual-patch-manifest/v1',
    manifest_id: `kwb-manual-patch-${sha256.slice(0, 12)}`,
    generated_at: input.exportedAt,
    sha256,
    target_file_count: targetFiles.length,
    ready_target_file_count: input.readyTargetFileCount,
    blocked_target_file_count: input.blockedTargetFileCount,
    total_patch_count: input.targetPatches.reduce((sum, item) => sum + item.total_patch_count, 0),
    source_ref_check_warning_count: input.sourceRefQuality.source_ref_check_warning_count,
    source_ref_check_blocker_count: input.sourceRefQuality.source_ref_check_blocker_count,
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    patch_applyable: false,
    manual_apply_only: true,
    target_files: targetFiles,
  };
}

function buildKnowledgeWritebackManualPatchClosureCertificate(input: {
  exportedAt: string;
  manualPatchManifest: KnowledgeWritebackManualPatchManifest;
  signoffManifest: KnowledgeWritebackQueueReviewSignoffManifest;
  readyForManualApply: boolean;
  targetFileCount: number;
  readyTargetFileCount: number;
  blockedTargetFileCount: number;
  totalPatchCount: number;
  sourceRefQuality: KnowledgeWritebackSourceRefQualitySummary;
  blockerReasons: string[];
  warningReasons: string[];
}): KnowledgeWritebackManualPatchClosureCertificate {
  const operatorRequiredActions = [
    input.readyForManualApply
      ? 'ready_for_operator_apply=true：可进入人工合并前最终复核。'
      : 'ready_for_operator_apply=false：先处理 blocker_reasons 后再人工写回。',
    '核对 signoff_manifest_id/sha256 与人工签收包一致。',
    '核对 manual_patch_manifest_id/sha256 与人工 patch 包一致。',
    '逐项复核 source_ref_check warning/blocker 后再人工编辑目标 Markdown。',
    '保持 patch_applyable=false，不使用 git apply 或自动写入 data/provinces/*.md。',
  ];
  const status: KnowledgeWritebackManualPatchClosureCertificate['status'] = input.readyForManualApply
    ? 'ready_for_operator_apply'
    : 'blocked';
  const payload = {
    schema_version: 'knowledge-writeback-manual-patch-closure-certificate/v1' as const,
    generated_at: input.exportedAt,
    status,
    ready_for_operator_apply: input.readyForManualApply,
    manual_patch_manifest_id: input.manualPatchManifest.manifest_id,
    manual_patch_manifest_sha256: input.manualPatchManifest.sha256,
    signoff_manifest_id: input.signoffManifest.manifest_id,
    signoff_manifest_sha256: input.signoffManifest.sha256,
    target_file_count: input.targetFileCount,
    ready_target_file_count: input.readyTargetFileCount,
    blocked_target_file_count: input.blockedTargetFileCount,
    total_patch_count: input.totalPatchCount,
    source_ref_check_warning_count: input.sourceRefQuality.source_ref_check_warning_count,
    source_ref_check_blocker_count: input.sourceRefQuality.source_ref_check_blocker_count,
    blocker_reason_count: input.blockerReasons.length,
    warning_reason_count: input.warningReasons.length,
    direct_writeback_to_province_markdown: false as const,
    province_markdown_written: false as const,
    patch_applyable: false as const,
    manual_apply_only: true as const,
    operator_required_actions: operatorRequiredActions,
  };
  const sha256 = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return {
    ...payload,
    certificate_id: `kwb-manual-closure-${sha256.slice(0, 12)}`,
    sha256,
  };
}

function renderKnowledgeWritebackManualPatchAppendMarkdown(
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

function renderKnowledgeWritebackManualReviewDiff(targetFile: string, appendMarkdown: string): string {
  const diffLines = appendMarkdown.trimEnd().split('\n').map(line => `+${line}`);
  return [
    `diff --git a/${targetFile} b/${targetFile}`,
    `--- a/${targetFile}`,
    `+++ b/${targetFile}`,
    '@@ manual_append_review_only @@',
    ...diffLines,
  ].join('\n') + '\n';
}

function renderKnowledgeWritebackTargetFilePreflightLines(
  items: KnowledgeWritebackQueueExportTargetFilePreflight[],
): string[] {
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

function renderKnowledgeWritebackSignoffBatchSummaryLines(
  items: KnowledgeWritebackQueueSignoffBatchSummary[],
): string[] {
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

function renderKnowledgeWritebackReviewHandoffLines(
  items: KnowledgeWritebackQueueReviewHandoffItem[],
): string[] {
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

function buildKnowledgeWritebackQueueExportPreflight(input: {
  exportedAt: string;
  targetFiles: string[];
  projectItems: ProjectKnowledgeWritebackPatchItem[];
  expansionItems: DomainPackExpansionWritebackDraftItem[];
  statusCounts: Record<KnowledgeWritebackStatus, number>;
}): KnowledgeWritebackQueueExportPreflight {
  const targetFilePreflight = input.targetFiles.map(targetFile =>
    buildKnowledgeWritebackTargetFilePreflight(targetFile, input.projectItems, input.expansionItems),
  );
  const expansionCandidateFieldCount = input.expansionItems
    .reduce((sum, item) => sum + (item.field_supplement_candidate_count ?? 0), 0);
  const expansionFieldMissingCount = input.expansionItems
    .reduce((sum, item) => sum + (item.field_missing_candidate_count ?? 0), 0);
  const expansionSourceRefCount = countDomainPackExpansionSourceRefs(input.expansionItems);
  const totalDraftCount = input.projectItems.length + input.expansionItems.length;
  const manualReviewRequiredCount = totalDraftCount - (input.statusCounts.written_back ?? 0);
  const reviewHandoff = buildKnowledgeWritebackReviewHandoff(
    input.projectItems,
    input.expansionItems,
    input.exportedAt,
    input.targetFiles,
  );
  const sourceRefQuality = buildKnowledgeWritebackSourceRefQualitySummary(input.projectItems, input.expansionItems);

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
    blocked_direct_writeback_count: totalDraftCount,
    ready_for_manual_export: totalDraftCount > 0
      && input.targetFiles.length > 0
      && expansionFieldMissingCount === 0
      && sourceRefQuality.blocker_item_count === 0
      && sourceRefQuality.source_ref_check_blocker_count === 0,
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
      `source_ref_check_warnings=${sourceRefQuality.source_ref_check_warning_count}`,
      `source_ref_check_blockers=${sourceRefQuality.source_ref_check_blocker_count}`,
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

function buildKnowledgeWritebackReviewHandoff(
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
      required_action: knowledgeWritebackReviewHandoffRequiredAction(status, Boolean(item.review_note?.trim()), 0),
    };
  });

  const expansionHandoffItems = expansionItems.map<KnowledgeWritebackQueueReviewHandoffItem>(item => {
    const status = item.writeback_status ?? 'draft_ready';
    const sourceRefCount = domainPackExpansionItemSourceRefCount(item);
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
      candidate_field_count: item.field_supplement_candidate_count ?? domainPackExpansionCandidateFieldCount(item),
      source_ref_count: sourceRefCount,
      required_action: knowledgeWritebackReviewHandoffRequiredAction(
        status,
        Boolean(item.review_note?.trim()),
        sourceRefCount,
        Boolean(reviewerDisplayName(item)),
      ),
    };
  });

  const items = [...projectHandoffItems, ...expansionHandoffItems];
  const statusCounts = normalizeKnowledgeWritebackStatusCounts();
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
  const signoffBatchSummaries = buildKnowledgeWritebackSignoffBatchSummaries(items);
  const signoffManifest = buildKnowledgeWritebackReviewSignoffManifest({
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

function buildKnowledgeWritebackSignoffBatchSummaries(
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
      status_counts: normalizeKnowledgeWritebackStatusCounts(),
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
    if (isKnowledgeWritebackHandoffItemReadyForSignoff(item)) summary.ready_for_signoff_count += 1;
    else summary.blocked_for_signoff_count += 1;
  }

  return [...summaries.values()].sort((a, b) => {
    if (a.signoff_batch_id === UNASSIGNED_SIGNOFF_BATCH_ID) return 1;
    if (b.signoff_batch_id === UNASSIGNED_SIGNOFF_BATCH_ID) return -1;
    return a.signoff_batch_id.localeCompare(b.signoff_batch_id);
  });
}

function isKnowledgeWritebackHandoffItemReadyForSignoff(item: KnowledgeWritebackQueueReviewHandoffItem): boolean {
  return Boolean(item.signoff_batch_id?.trim())
    && item.writeback_status !== 'needs_revision'
    && Boolean(item.review_note?.trim())
    && Boolean(reviewerDisplayName(item))
    && (item.source_kind === 'project' || item.source_ref_count > 0);
}

function buildKnowledgeWritebackReviewSignoffManifest(input: {
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

function knowledgeWritebackReviewHandoffRequiredAction(
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

function buildKnowledgeWritebackSourceRefQualitySummary(
  projectItems: ProjectKnowledgeWritebackPatchItem[],
  expansionItems: DomainPackExpansionWritebackDraftItem[],
): KnowledgeWritebackSourceRefQualitySummary {
  const items = [
    ...projectItems.map(knowledgeWritebackProjectSourceRefQualityItem),
    ...expansionItems.map(knowledgeWritebackExpansionSourceRefQualityItem),
  ];
  const checkedFieldCount = items.reduce((sum, item) => sum + item.checked_field_count, 0);
  const coveredFieldCount = items.reduce((sum, item) => sum + item.covered_field_count, 0);
  const sourceRefCount = new Set([
    ...projectItems.flatMap(knowledgeWritebackProjectStructuredSourceRefs),
    ...expansionItems.flatMap(item => (item.field_workbench ?? []).flatMap(field => field.source_refs)),
  ]).size;
  const sourceRefChecks = buildKnowledgeWritebackSourceRefChecks(projectItems, expansionItems);
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
    source_ref_check_count: sourceRefChecks.length,
    source_ref_check_pass_count: sourceRefChecks.filter(item => item.status === 'pass').length,
    source_ref_check_warning_count: sourceRefChecks.filter(item => item.status === 'warning').length,
    source_ref_check_blocker_count: sourceRefChecks.filter(item => item.status === 'blocker').length,
    local_source_ref_count: sourceRefChecks.filter(item => item.local_path).length,
    file_missing_source_ref_count: sourceRefChecks.filter(item => item.reason === 'local_file_missing').length,
    anchor_missing_source_ref_count: sourceRefChecks.filter(item => item.reason === 'anchor_missing_manual_review').length,
    source_ref_checks: sourceRefChecks,
    items,
  };
}

function buildKnowledgeWritebackSourceRefChecks(
  projectItems: ProjectKnowledgeWritebackPatchItem[],
  expansionItems: DomainPackExpansionWritebackDraftItem[],
): KnowledgeWritebackSourceRefCheck[] {
  return [
    ...projectItems.flatMap(item => knowledgeWritebackProjectStructuredSourceRefs(item).map(sourceRef =>
      resolveKnowledgeWritebackSourceRefCheck({
        sourceRef,
        sourceKind: 'project',
        itemId: item.task_key ?? `${item.project_id ?? 'project'}::${item.task_id}`,
        targetFile: item.suggested_file_path,
      }),
    )),
    ...expansionItems.flatMap(item => (item.field_workbench ?? [])
      .flatMap(field => field.source_refs)
      .map(sourceRef => resolveKnowledgeWritebackSourceRefCheck({
        sourceRef,
        sourceKind: 'domain_pack_expansion',
        itemId: item.review_item_id,
        targetFile: item.suggested_file_path,
      }))),
  ];
}

function resolveKnowledgeWritebackSourceRefCheck(input: {
  sourceRef: string;
  sourceKind: KnowledgeWritebackSourceRefCheck['source_kind'];
  itemId: string;
  targetFile: string;
}): KnowledgeWritebackSourceRefCheck {
  if (input.sourceKind === 'project') {
    return {
      source_ref: input.sourceRef,
      source_kind: input.sourceKind,
      item_id: input.itemId,
      target_file: input.targetFile,
      file_exists: false,
      anchor_checked: false,
      anchor_found: false,
      status: 'warning',
      reason: 'project_markdown_reference',
    };
  }

  const parsed = parseKnowledgeWritebackLocalSourceRef(input.sourceRef);
  if (!parsed) {
    return {
      source_ref: input.sourceRef,
      source_kind: input.sourceKind,
      item_id: input.itemId,
      target_file: input.targetFile,
      file_exists: false,
      anchor_checked: false,
      anchor_found: false,
      status: /^https?:\/\//.test(input.sourceRef) ? 'pass' : 'warning',
      reason: /^https?:\/\//.test(input.sourceRef) ? 'external_source_ref' : 'unparsed_source_ref',
    };
  }

  const localPath = path.resolve(getKbRoot(), parsed.localPath.replace(/^data\//, ''));
  if (!existsSync(localPath)) {
    return {
      source_ref: input.sourceRef,
      source_kind: input.sourceKind,
      item_id: input.itemId,
      target_file: input.targetFile,
      local_path: parsed.localPath,
      anchor: parsed.anchor,
      file_exists: false,
      anchor_checked: Boolean(parsed.anchor),
      anchor_found: false,
      status: 'blocker',
      reason: 'local_file_missing',
    };
  }

  if (!parsed.anchor) {
    return {
      source_ref: input.sourceRef,
      source_kind: input.sourceKind,
      item_id: input.itemId,
      target_file: input.targetFile,
      local_path: parsed.localPath,
      file_exists: true,
      anchor_checked: false,
      anchor_found: false,
      status: 'pass',
      reason: 'local_file_exists_no_anchor',
    };
  }

  const anchorFound = knowledgeWritebackSourceAnchorExists(localPath, parsed.anchor);
  return {
    source_ref: input.sourceRef,
    source_kind: input.sourceKind,
    item_id: input.itemId,
    target_file: input.targetFile,
    local_path: parsed.localPath,
    anchor: parsed.anchor,
    file_exists: true,
    anchor_checked: true,
    anchor_found: anchorFound,
    status: anchorFound ? 'pass' : 'warning',
    reason: anchorFound ? 'anchor_found' : 'anchor_missing_manual_review',
  };
}

function parseKnowledgeWritebackLocalSourceRef(sourceRef: string): { localPath: string; anchor?: string } | undefined {
  const [rawPath, rawAnchor] = sourceRef.split('#');
  if (!rawPath.startsWith('data/')) return undefined;
  return {
    localPath: rawPath,
    anchor: rawAnchor ? decodeURIComponent(rawAnchor).trim() : undefined,
  };
}

function knowledgeWritebackSourceAnchorExists(localPath: string, anchor: string): boolean {
  try {
    const content = readFileSync(localPath, 'utf8');
    return content.includes(anchor)
      || content.includes(anchor.replace(/：/g, ':'))
      || content.includes(anchor.replace(/:/g, '：'));
  } catch {
    return false;
  }
}

function knowledgeWritebackProjectSourceRefQualityItem(
  item: ProjectKnowledgeWritebackPatchItem,
): KnowledgeWritebackSourceRefQualityItem {
  const sourceRefs = knowledgeWritebackProjectStructuredSourceRefs(item);
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

function knowledgeWritebackExpansionSourceRefQualityItem(
  item: DomainPackExpansionWritebackDraftItem,
): KnowledgeWritebackSourceRefQualityItem {
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

function knowledgeWritebackProjectStructuredSourceRefs(item: ProjectKnowledgeWritebackPatchItem): string[] {
  const sourceLines = item.append_markdown
    .split('\n')
    .filter(line => /source_refs?|来源|参考|出处/i.test(line));
  return [...new Set(sourceLines.map(line => line.trim()).filter(Boolean))];
}

function knowledgeWritebackSourceRefQualityLevel(
  summary: KnowledgeWritebackSourceRefQualitySummary,
): KnowledgeWritebackSourceRefQualityLevel {
  if (summary.blocker_item_count > 0) return 'blocker';
  if (summary.warning_item_count > 0) return 'warning';
  return 'pass';
}

function knowledgeWritebackManualPatchPackageBlockerReasons(input: {
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
    input.preflight.source_ref_quality.source_ref_check_blocker_count > 0
      ? `source_ref_check_blockers=${input.preflight.source_ref_quality.source_ref_check_blocker_count}`
      : undefined,
  ].filter((reason): reason is string => Boolean(reason));
}

function knowledgeWritebackManualPatchPackageWarningReasons(
  sourceRefQuality: KnowledgeWritebackSourceRefQualitySummary,
): string[] {
  return [
    sourceRefQuality.warning_item_count > 0 ? `source_ref_quality_warnings=${sourceRefQuality.warning_item_count}` : undefined,
    sourceRefQuality.source_ref_check_warning_count > 0
      ? `source_ref_check_warnings=${sourceRefQuality.source_ref_check_warning_count}`
      : undefined,
    sourceRefQuality.missing_verification_note_field_count > 0
      ? `missing_verification_notes=${sourceRefQuality.missing_verification_note_field_count}`
      : undefined,
    sourceRefQuality.missing_writeback_hint_field_count > 0
      ? `missing_writeback_hints=${sourceRefQuality.missing_writeback_hint_field_count}`
      : undefined,
  ].filter((reason): reason is string => Boolean(reason));
}

function knowledgeWritebackTargetManualPatchBlockerReasons(
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
    sourceRefQuality.source_ref_check_blocker_count > 0
      ? `target_source_ref_check_blockers=${sourceRefQuality.source_ref_check_blocker_count}`
      : undefined,
  ].filter((reason): reason is string => Boolean(reason));
}

function knowledgeWritebackTargetManualPatchWarningReasons(
  sourceRefQuality: KnowledgeWritebackSourceRefQualitySummary,
): string[] {
  return knowledgeWritebackManualPatchPackageWarningReasons(sourceRefQuality);
}

function reviewerDisplayName(item: {
  reviewed_by?: string;
  reviewer_name?: string;
  reviewer_id?: string;
}): string | undefined {
  return item.reviewed_by?.trim() || item.reviewer_name?.trim() || item.reviewer_id?.trim() || undefined;
}

function domainPackExpansionCandidateFieldCount(item: DomainPackExpansionWritebackDraftItem): number {
  return (item.field_workbench ?? []).filter(field => field.supplement_status === 'candidate_draft').length;
}

function domainPackExpansionItemSourceRefCount(item: DomainPackExpansionWritebackDraftItem): number {
  return new Set((item.field_workbench ?? []).flatMap(field => field.source_refs)).size;
}

function buildKnowledgeWritebackTargetFilePreflight(
  targetFile: string,
  projectItems: ProjectKnowledgeWritebackPatchItem[],
  expansionItems: DomainPackExpansionWritebackDraftItem[],
): KnowledgeWritebackQueueExportTargetFilePreflight {
  const projectFileItems = projectItems.filter(item => item.suggested_file_path === targetFile);
  const expansionFileItems = expansionItems.filter(item => item.suggested_file_path === targetFile);
  const statusCounts = normalizeKnowledgeWritebackStatusCounts();
  for (const item of [...projectFileItems, ...expansionFileItems]) {
    statusCounts[item.writeback_status ?? 'draft_ready'] += 1;
  }
  const expansionCandidateFieldCount = expansionFileItems
    .reduce((sum, item) => sum + (item.field_supplement_candidate_count ?? 0), 0);
  const expansionFieldMissingCount = expansionFileItems
    .reduce((sum, item) => sum + (item.field_missing_candidate_count ?? 0), 0);
  const sourceRefQuality = buildKnowledgeWritebackSourceRefQualitySummary(projectFileItems, expansionFileItems);

  return {
    target_file: targetFile,
    project_draft_count: projectFileItems.length,
    expansion_draft_count: expansionFileItems.length,
    total_draft_count: projectFileItems.length + expansionFileItems.length,
    expansion_candidate_field_count: expansionCandidateFieldCount,
    expansion_field_missing_count: expansionFieldMissingCount,
    expansion_source_ref_count: countDomainPackExpansionSourceRefs(expansionFileItems),
    source_ref_coverage_percent: sourceRefQuality.coverage_percent,
    source_ref_quality_level: knowledgeWritebackSourceRefQualityLevel(sourceRefQuality),
    source_ref_blocker_count: sourceRefQuality.blocker_item_count,
    source_ref_warning_count: sourceRefQuality.warning_item_count,
    writeback_status_counts: statusCounts,
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    safety_note: '仅导出人工写回草案和字段差异，不直接修改省份 Markdown。',
  };
}

function countDomainPackExpansionSourceRefs(items: DomainPackExpansionWritebackDraftItem[]): number {
  return new Set(items.flatMap(item =>
    (item.field_workbench ?? []).flatMap(field => field.source_refs),
  )).size;
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
  const candidateFields = item.field_workbench.filter(field => field.supplement_status === 'candidate_draft');
  const missingFields = item.field_workbench.filter(field => field.supplement_status !== 'candidate_draft');
  const candidateFieldLines = candidateFields.length
    ? candidateFields.flatMap(renderExpansionFieldWorkbenchMarkdown)
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

function loadDomainPackExpansionReviewStateMap(): Map<string, DomainPackExpansionResolvedReviewStateItem> {
  return new Map(loadDomainPackExpansionResolvedReviewStateItems().map(item => [item.review_item_id, item]));
}

function findDomainPackExpansionReviewItem(
  report: DomainPackExpansionCandidateReport,
  reviewItemId: string,
): DomainPackExpansionReviewItem | undefined {
  return report.review_packet.batches
    .flatMap(batch => batch.review_items)
    .find(item => item.review_item_id === reviewItemId);
}

function expansionReviewApprovalBlockerMessage(
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

function loadDomainPackExpansionReviewStateItems(): DomainPackExpansionReviewStateItem[] {
  return loadDomainPackExpansionResolvedReviewStateItems().map(stripResolvedExpansionReviewStateMetadata);
}

function loadDomainPackExpansionResolvedReviewStateItems(): DomainPackExpansionResolvedReviewStateItem[] {
  const mergedItems = new Map<string, DomainPackExpansionReviewStateItem>();
  const seedItems = new Map<string, DomainPackExpansionReviewStateItem>();
  const runtimeItems = new Map<string, DomainPackExpansionReviewStateItem>();
  for (const [source, filePath] of [
    ['seed', domainPackExpansionReviewStateSeedFilePath()],
    ['runtime', domainPackExpansionReviewStateFilePath()],
  ] as const) {
    const file = loadDomainPackExpansionReviewStateFile(filePath);
    if (!file || file.schema_version !== 'domain-pack-expansion-review-state/v1' || !Array.isArray(file.items)) {
      continue;
    }
    for (const item of file.items) {
      const normalized = normalizeExpansionReviewStateItem(item);
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

function stripResolvedExpansionReviewStateMetadata(
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
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
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

function generatedRoot(): string {
  return process.env.WEB_GENERATED_ROOT || path.resolve(getKbRoot(), '..', 'web', 'generated');
}

function domainPackExpansionReviewStateFilePath(): string {
  return path.resolve(generatedRoot(), 'domain-pack-expansion', DOMAIN_PACK_EXPANSION_REVIEW_STATE_FILE_NAME);
}

function domainPackExpansionReviewStateSeedFilePath(): string {
  return path.resolve(getKbRoot(), 'domain-packs', DOMAIN_PACK_EXPANSION_REVIEW_STATE_SEED_FILE_NAME);
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
    field_supplement_candidates: Array.isArray(value.field_supplement_candidates)
      ? value.field_supplement_candidates
        .map(normalizeExpansionFieldSupplementCandidate)
        .filter((candidate): candidate is ExpansionFieldSupplementCandidate => Boolean(candidate))
      : [],
  };
}

function normalizeExpansionFieldSupplementCandidate(value: unknown): ExpansionFieldSupplementCandidate | undefined {
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
    field_supplement_candidate_count: batch.seed_targets.reduce(
      (sum, target) => sum + target.field_supplement_candidates.length,
      0,
    ),
    seed_target_count: batch.seed_targets.length,
    provinces: [...new Set(batch.seed_targets.map(target => target.province))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
  };
}
