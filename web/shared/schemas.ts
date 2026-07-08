// web/shared/schemas.ts — Zod validation schemas for Web API

import { z } from 'zod';
import { GEARS_CALLBACK_BATCH_ITEM_LIMIT } from './types.js';

// ---------------------------------------------------------------------------
// Generation type (3 modes) — backward compat
// ---------------------------------------------------------------------------

export const GenerationTypeSchema = z.enum([
  'character_story',
  'culture_promo',
  'scene_short',
]);

// ---------------------------------------------------------------------------
// Video type (15 成片类型)
// ---------------------------------------------------------------------------

export const VideoTypeSchema = z.enum([
  'character_story',
  'historical_drama',
  'legend_story',
  'culture_promo',
  'heritage_promo',
  'city_brand_promo',
  'scene_short',
  'landscape_mood',
  'documentary_short',
  'explainer_video',
  'lecture_video',
  'education_training',
  'children_story',
  'social_short',
  'ai_comic_drama',
]);

export const NarrativePatternIdSchema = z.enum([
  'mortal_growth',
  'infinite_mission',
  'historical_causal_story',
  'power_strategy',
  'hero_choice',
  'folk_legend_trial',
  'mystery_reveal',
  'ensemble_threads',
  'object_clue_journey',
  'craft_mastery',
  'ritual_process',
  'brand_symbol',
  'city_day_journey',
  'social_hook_contrast',
  'documentary_investigation',
  'knowledge_gap_explainer',
  'lecture_case_argument',
  'training_loop',
  'space_walkthrough',
  'poetic_landscape',
  'children_fable',
  'novel_scene_compression',
  'character_arc_adaptation',
  'serial_hook_adaptation',
  'cinematic_setpiece_adaptation',
  'theme_preserving_adaptation',
  'source_fidelity_adaptation',
  'chapter_slice_adaptation',
  'dialogue_scene_adaptation',
  'worldbuilding_grounding',
  'platform_short_drama_hook',
  'wuxia_chivalric_epic',
  'wuxia_lone_blade_mystery',
  'wuxia_sect_growth',
  'wuxia_revenge_journey',
  'wuxia_court_jianghu',
  'wuxia_romance_honor',
]);

const RecommendedNarrativePatternSchema = z.object({
  video_type: VideoTypeSchema,
  pattern_id: NarrativePatternIdSchema,
  reason: z.string().min(1),
  priority: z.number().int().min(1),
  confidence: z.number().min(0).max(1),
  match_signals: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Presentation style (11 表现形式)
// ---------------------------------------------------------------------------

export const PresentationStyleSchema = z.enum([
  'cinematic',
  'documentary',
  'host_narration',
  'voiceover_montage',
  'vertical_drama',
  'ai_comic',
  'animation_2d',
  'ink_style',
  'children_animation',
  'museum_exhibit',
  'social_media_fastcut',
]);

// ---------------------------------------------------------------------------
// Story structure type (8 叙事结构) — Phase 5
// ---------------------------------------------------------------------------

export const StoryStructureTypeSchema = z.enum([
  'single_event_drama',
  'three_act_drama',
  'memory_mosaic_biography',
  'witness_testimony',
  'object_clue_journey',
  'before_after_transformation',
  'case_reconstruction',
  'lecture_argument',
]);

export const ReferenceStrengthSchema = z.enum(['light', 'medium', 'strong']);
export const GenreStrictnessSchema = z.enum(['loose', 'balanced', 'strict']);
export const StoryGenerationPrioritySchema = z.enum(['balanced', 'plot_first', 'knowledge_first']);
export const SourceMaterialModeSchema = z.enum(['generate_from_knowledge', 'adapt_user_novel']);
export const LocalizationModeSchema = z.enum(['allow_related_influence', 'strict_direct_events']);

export const KnowledgeDomainSchema = z.enum([
  'core_china_culture',
  'era_setting',
  'regional_culture',
  'folklore_zhiyi',
  'gears_asset',
  'narrative_pattern',
  'character_archetype',
  'conflict_pattern',
  'visual_style_pack',
  'safety_rule',
  'source_pack',
]);

export const KnowledgeEntryRoleSchema = z.enum([
  'core_entry',
  'setting_pack',
  'motif_pack',
  'asset_pack',
  'regional_pack',
  'pattern_pack',
  'archetype_pack',
  'conflict_pack',
  'style_pack',
  'rule_pack',
  'source_pack',
]);

export const KnowledgeAssetUsageSchema = z.enum([
  'character_clothing',
  'character_props',
  'scene_space',
  'scene_props',
  'story_motif',
  'dialogue_tone',
  'credibility_boundary',
  'gears_delivery',
  'plot_structure',
  'character_arc',
  'conflict_engine',
  'visual_style',
  'safety_boundary',
  'source_grounding',
]);

export const KnowledgeAssetSplitSchema = z.object({
  characters: z.array(z.string()),
  scenes: z.array(z.string()),
  character_props: z.array(z.string()),
  scene_props: z.array(z.string()),
});

export const CreationUseCaseSchema = z.enum([
  'original_ai_comic',
  'adapted_ai_comic',
  'institutional_promo',
  'documentary_short',
  'brand_commercial',
  'education_training',
  'public_service',
]);

export const TruthModeSchema = z.enum([
  'fictional_original',
  'inspired_by_material',
  'source_adaptation',
  'factual_reconstruction',
  'institutional_verified',
]);

export const KnowledgePackEntrySchema = z.object({
  entry_name: z.string(),
  province: z.string(),
  region: z.string(),
  type: z.string(),
  summary: z.string(),
  score: z.number(),
  role_in_story: z.string(),
  match_reason: z.string(),
  keywords: z.array(z.string()),
  knowledge_domain: KnowledgeDomainSchema.optional(),
  entry_role: KnowledgeEntryRoleSchema.optional(),
  era: z.string().optional(),
  asset_usage: z.array(KnowledgeAssetUsageSchema).optional(),
  asset_split: KnowledgeAssetSplitSchema.optional(),
  production_prompts: z.array(z.string()).optional(),
  review_boundaries: z.array(z.string()).optional(),
});

export const KnowledgePackMissingSchema = z.object({
  need_id: z.string(),
  label: z.string(),
  message: z.string(),
});

export const KnowledgePackSchema = z.object({
  primary_entries: z.array(KnowledgePackEntrySchema),
  supporting_entries: z.array(KnowledgePackEntrySchema),
  missing_needs: z.array(KnowledgePackMissingSchema),
  overall_confidence: z.number(),
});

export const MaterialPurposeSchema = z.enum([
  'fact_basis',
  'character_source',
  'visual_asset',
  'era_context',
  'regional_context',
  'cultural_background',
  'brand_info',
  'institutional_position',
  'source_work',
  'reference_style',
  'creative_boundary',
]);

export const MaterialSourceTypeSchema = z.enum([
  'knowledge_entry',
  'user_outline',
  'user_source_text',
  'brand_profile',
  'institution_profile',
  'visual_asset',
  'reference_style',
  'manual_note',
]);

export const MaterialPackEntrySchema = z.object({
  material_id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  source_type: MaterialSourceTypeSchema,
  purpose: z.array(MaterialPurposeSchema).min(1),
  confidence: z.number().optional(),
  role_in_story: z.string().optional(),
  provenance: z.string().optional(),
  linked_entry_name: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const MaterialSufficiencyMissingItemSchema = z.object({
  item_id: z.string(),
  label: z.string(),
  reason: z.string(),
  blocking_level: z.enum(['blocking', 'risk', 'optional']),
  affects: z.array(z.string()),
  recommended_question: z.string(),
});

export const MaterialSufficiencyStageReportSchema = z.object({
  stage: z.enum(['minimum_viable_story', 'script_ready', 'production_ready']),
  status: z.enum(['ready', 'needs_input', 'blocked']),
  score: z.number().min(0).max(100),
  can_proceed: z.boolean(),
  required_items: z.array(z.string()),
  available_outputs: z.array(z.string()),
  missing_items: z.array(MaterialSufficiencyMissingItemSchema),
  optional_items: z.array(MaterialSufficiencyMissingItemSchema),
  notes: z.array(z.string()),
});

export const MaterialSufficiencyReportSchema = z.object({
  schema_version: z.literal('material-sufficiency/v1'),
  stage: z.enum(['minimum_viable_story', 'script_ready', 'production_ready']),
  active_stage: z.enum(['minimum_viable_story', 'script_ready', 'production_ready']).optional(),
  score: z.number().min(0).max(100),
  can_generate: z.boolean(),
  can_generate_with_risks: z.boolean(),
  blocked: z.boolean(),
  needs_verification: z.boolean().optional(),
  generation_posture: z.enum([
    'ready',
    'draft_needs_verification',
    'script_ready_production_pending',
    'blocked_until_input',
  ]).optional(),
  next_stage: z.enum(['minimum_viable_story', 'script_ready', 'production_ready']).optional(),
  downgrade_reason: z.string().optional(),
  stage_reports: z.array(MaterialSufficiencyStageReportSchema).optional(),
  missing_items: z.array(MaterialSufficiencyMissingItemSchema),
  optional_items: z.array(MaterialSufficiencyMissingItemSchema),
  token_risk: z.enum(['low', 'medium', 'high']),
  recommended_next_questions: z.array(z.string()),
});

export const MaterialPackSchema = z.object({
  schema_version: z.literal('material-pack/v1'),
  primary_materials: z.array(MaterialPackEntrySchema),
  supporting_materials: z.array(MaterialPackEntrySchema),
  reference_materials: z.array(MaterialPackEntrySchema),
  brand_or_institution_profile: z.object({
    name: z.string().optional(),
    client_type: z.string().optional(),
    voice: z.string().optional(),
    verified_claims: z.array(z.string()).optional(),
    forbidden_claims: z.array(z.string()).optional(),
  }).optional(),
  source_work_profile: z.object({
    title: z.string().optional(),
    author: z.string().optional(),
    rights_note: z.string().optional(),
    adaptation_boundary: z.string().optional(),
    core_characters: z.array(z.string()).optional(),
    must_keep: z.array(z.string()).optional(),
  }).optional(),
  visual_assets: z.array(z.object({
    asset_id: z.string(),
    label: z.string(),
    kind: z.enum(['character', 'scene', 'prop', 'document', 'brand', 'other']),
    description: z.string(),
    source_material_id: z.string().optional(),
    file_url: z.string().optional(),
  })),
  verified_facts: z.array(z.string()),
  uncertain_claims: z.array(z.string()),
  creative_space: z.array(z.string()),
  missing_needs: z.array(KnowledgePackMissingSchema),
  overall_confidence: z.number(),
  token_budget_summary: z.object({
    estimated_input_tokens: z.number().optional(),
    strategy: z.string().optional(),
    notes: z.array(z.string()).optional(),
  }).optional(),
});

export const ProjectMaterialPackTargetSchema = z.enum([
  'primary_materials',
  'supporting_materials',
  'reference_materials',
]);

export const ProjectMaterialPackAddMaterialRequestSchema = z.object({
  target: ProjectMaterialPackTargetSchema.optional().default('supporting_materials'),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(1200),
  source_type: MaterialSourceTypeSchema.optional().default('manual_note'),
  purpose: z.array(MaterialPurposeSchema).min(1).max(6),
  confidence: z.number().min(0).max(1).optional(),
  role_in_story: z.string().trim().min(1).max(240).optional(),
  provenance: z.string().trim().min(1).max(240).optional(),
  linked_entry_name: z.string().trim().min(1).max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  mark_as_verified_fact: z.boolean().optional().default(false),
  remove_missing_need_id: z.string().trim().min(1).max(120).optional(),
});

// ---------------------------------------------------------------------------
// Duration & panel count
// ---------------------------------------------------------------------------

export const DurationSchema = z.enum(['30秒', '1分钟', '3分钟', '5分钟', '8分钟', '10分钟', '15分钟', '20分钟']);

export const PanelCountSchema = z.union([
  z.literal(4),
  z.literal(6),
  z.literal(8),
  z.literal(9),
  z.literal(10),
  z.literal(12),
]);

export const StoryDetectedCharacterSchema = z.object({
  name: z.string().min(1),
  role_position: z.enum(['主角', '反派', '配角', '路人', '群演']),
  character_kind: z.enum(['named_person', 'identity_role', 'group_role', 'supernatural_role']),
  source_text: z.string().min(1),
  asset_stability: z.enum(['recurring', 'single_scene']),
  age_range: z.enum(['儿童', '少年', '青年', '中年', '老年', '不适用']).optional(),
  gender: z.enum(['男', '女', '其他', '未指定', '不适用']).optional(),
});

// ---------------------------------------------------------------------------
// Story plan request
// ---------------------------------------------------------------------------

export const StoryPlanRequestSchema = z.object({
  entry_name: z.string().min(1, 'entry_name cannot be empty'),
  original_user_query: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Story generate request
// ---------------------------------------------------------------------------

export const StoryGenerateRequestSchema = z.object({
  entry_name: z.string().optional(),
  original_user_query: z.string().optional(),
  generation_type: GenerationTypeSchema.optional(),
  video_type: VideoTypeSchema.optional(),
  model_profile_id: z.string().optional(),
  selected_event: z.string().optional(),
  target_video_duration: DurationSchema.optional(),
  tone: z.string().optional(),
  presentation_style: PresentationStyleSchema.optional(),
  output_gears_segments: z.boolean().optional().default(true),
  // New fields for outline-driven multi-knowledge matching
  outline: z.string().optional(),
  character_hints: z.array(StoryDetectedCharacterSchema).optional(),
  knowledge_pack: KnowledgePackSchema.optional(),
  material_pack: MaterialPackSchema.optional(),
  creation_use_case: CreationUseCaseSchema.optional(),
  truth_mode: TruthModeSchema.optional(),
  client_type: z.string().trim().min(1).max(80).optional(),
  target_audience: z.string().trim().min(1).max(120).optional(),
  communication_goal: z.string().trim().min(1).max(240).optional(),
  // New fields for story structure and creative reference (Phase 5)
  story_structure: StoryStructureTypeSchema.optional(),
  creative_reference_ids: z.array(z.string()).optional(),
  style_pack_ids: z.array(z.string()).optional(),
  narrative_pattern_ids: z.array(NarrativePatternIdSchema).max(6).optional(),
  reference_strength: ReferenceStrengthSchema.optional(),
  genre_strictness: GenreStrictnessSchema.optional().default('balanced'),
  auto_repair: z.boolean().optional().default(false),
  story_priority: StoryGenerationPrioritySchema.optional().default('balanced'),
  source_material_mode: SourceMaterialModeSchema.optional().default('generate_from_knowledge'),
  localized_target_region: z.string().trim().min(1).max(40).optional(),
  localization_mode: LocalizationModeSchema.optional().default('allow_related_influence'),
}).refine(
  (data) => data.entry_name || data.knowledge_pack || data.material_pack || data.outline,
  { message: 'At least one of entry_name, knowledge_pack, material_pack, or outline must be provided', path: ['entry_name'] },
).refine(
  (data) => data.generation_type || data.video_type,
  { message: 'Either generation_type or video_type must be provided', path: ['video_type'] },
).refine(
  (data) => {
    if (!data.truth_mode || !data.video_type) return true;
    if (data.truth_mode === 'fictional_original') {
      return !['documentary_short', 'education_training', 'lecture_video', 'explainer_video'].includes(data.video_type);
    }
    if (data.truth_mode === 'institutional_verified') {
      return !['legend_story', 'children_story'].includes(data.video_type);
    }
    return true;
  },
  { message: 'truth_mode is not compatible with the selected video_type', path: ['truth_mode'] },
).refine(
  // memory_mosaic_biography only compatible with certain video_types
  (data) => {
    if (data.story_structure === 'memory_mosaic_biography') {
      const allowedVideoTypes = ['character_story', 'historical_drama', 'documentary_short', 'ai_comic_drama'];
      const resolvedVideoType = data.video_type ?? (data.generation_type ? { character_story: 'character_story', culture_promo: 'culture_promo', scene_short: 'scene_short' }[data.generation_type] : undefined);
      if (resolvedVideoType && !allowedVideoTypes.includes(resolvedVideoType)) {
        return false;
      }
    }
    return true;
  },
  { message: 'memory_mosaic_biography is only compatible with character_story, historical_drama, documentary_short, or ai_comic_drama', path: ['story_structure'] },
);

// ---------------------------------------------------------------------------
// Entry detail query (GET query params)
// ---------------------------------------------------------------------------

export const EntryDetailQuerySchema = z.object({
  name: z.string().min(1, 'name cannot be empty'),
});

// ---------------------------------------------------------------------------
// Entry search query (GET query params — all optional)
// ---------------------------------------------------------------------------

export const EntrySearchQuerySchema = z.object({
  keywords: z.string().optional(),
  type: z.string().optional(),
  province: z.string().optional(),
  region: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Entry match request (POST body — smart topic matching)
// ---------------------------------------------------------------------------

export const EntryMatchRequestSchema = z.object({
  query: z.string().min(1, 'query cannot be empty'),
  limit: z.number().int().min(1).max(20).optional().default(5),
  preferred_province: z.string().optional(),
  preferred_type: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Story ID param (path param)
// ---------------------------------------------------------------------------

export const StoryIdParamSchema = z.object({
  storyId: z.string().regex(
    /^\d{8}-story-[0-9a-z]+$/,
    'storyId must match format YYYYMMDD-story-{hash36}',
  ),
});

export const StoryIdValueSchema = z.string().regex(
  /^\d{8}-story-[0-9a-z]+$/,
  'storyId must match format YYYYMMDD-story-{hash36}',
);

const ProjectIdValueSchema = z.string().regex(
  /^\d{8}-story-[0-9a-z]+--[a-z_]+$/,
  'projectId must match format YYYYMMDD-story-{hash36}--{video_type}',
);

export const AiComicSeriesProjectIdValueSchema = z.string().regex(
  /^\d{8}-series-[0-9a-z]+$/,
  'seriesProjectId must match format YYYYMMDD-series-{hash36}',
);

export const ProjectIdParamSchema = z.object({
  projectId: ProjectIdValueSchema,
});

export const AiComicSeriesProjectIdParamSchema = z.object({
  seriesProjectId: AiComicSeriesProjectIdValueSchema,
});

export const ProjectBatchDeleteRequestSchema = z.object({
  project_ids: z.array(ProjectIdValueSchema).min(1, 'project_ids cannot be empty').max(200, 'cannot delete more than 200 projects at once'),
});

export const ProjectRetainRecentRequestSchema = z.object({
  keep_recent: z.number().int().min(0).max(1000),
});

const SeedanceAssetReferenceKindSchema = z.enum(['character', 'location', 'prop', 'camera', 'audio']);
const SeedanceAssetModalitySchema = z.enum(['image', 'video', 'audio']);
const SeedanceAssetUploadStatusSchema = z.enum(['pending_upload', 'uploaded', 'failed', 'external']);
const SeedanceAssetSlotRoleSchema = z.enum([
  'character_reference',
  'location_reference',
  'prop_reference',
  'camera_reference',
  'music_reference',
  'sound_reference',
]);

export const SeedanceAssetLibraryUpdateRequestSchema = z.object({
  items: z.array(z.object({
    asset_id: z.string().trim().min(1).max(160).optional(),
    label: z.string().trim().min(1).max(120),
    kind: SeedanceAssetReferenceKindSchema,
    modality: SeedanceAssetModalitySchema.optional(),
    role: SeedanceAssetSlotRoleSchema.optional(),
    reference_slot: z.string().trim().min(1).max(40).optional(),
    file_url: z.string().trim().min(1).max(1000).optional(),
    file_id: z.string().trim().min(1).max(160).optional(),
    local_path: z.string().trim().min(1).max(1000).optional(),
    original_filename: z.string().trim().min(1).max(255).optional(),
    mime_type: z.string().trim().min(1).max(120).optional(),
    size_bytes: z.number().int().min(0).max(200 * 1024 * 1024).optional(),
    provider: z.string().trim().min(1).max(80).optional(),
    provider_asset_id: z.string().trim().min(1).max(200).optional(),
    upload_status: SeedanceAssetUploadStatusSchema.optional(),
    upload_error: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().max(500).optional(),
  })).min(1).max(200),
});

const SeedanceAssetBatchImportItemSchema = z.object({
  asset_id: z.string().trim().min(1).max(160).optional(),
  label: z.string().trim().min(1).max(120).optional(),
  kind: SeedanceAssetReferenceKindSchema.optional(),
  modality: SeedanceAssetModalitySchema.optional(),
  role: SeedanceAssetSlotRoleSchema.optional(),
  reference_slot: z.string().trim().min(1).max(40).optional(),
  file_url: z.string().trim().min(1).max(1000).optional(),
  file_id: z.string().trim().min(1).max(160).optional(),
  local_path: z.string().trim().min(1).max(1000).optional(),
  original_filename: z.string().trim().min(1).max(255).optional(),
  mime_type: z.string().trim().min(1).max(120).optional(),
  size_bytes: z.number().int().min(0).max(200 * 1024 * 1024).optional(),
  provider: z.string().trim().min(1).max(80).optional(),
  provider_asset_id: z.string().trim().min(1).max(200).optional(),
  upload_status: SeedanceAssetUploadStatusSchema.optional(),
  upload_error: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(500).optional(),
}).refine(
  item => Boolean(item.asset_id || (item.label && item.kind)),
  'asset_id or label+kind is required',
).refine(
  item => Boolean(item.file_url || item.file_id || item.local_path || item.provider_asset_id || item.upload_status),
  'file_url, file_id, local_path, provider_asset_id or upload_status is required',
);

export const SeedanceAssetBatchImportRequestSchema = z.object({
  source_note: z.string().trim().min(1).max(500).optional(),
  items: z.array(SeedanceAssetBatchImportItemSchema).min(1).max(500),
});

export const SeedanceAssetReuseRequestSchema = z.object({
  source_project_id: ProjectIdValueSchema,
  source_asset_id: z.string().trim().min(1).max(160),
  target_asset_id: z.string().trim().min(1).max(160).optional(),
  target_label: z.string().trim().min(1).max(120).optional(),
  target_kind: SeedanceAssetReferenceKindSchema.optional(),
  reference_slot: z.string().trim().min(1).max(40).optional(),
  description: z.string().trim().max(500).optional(),
});

const GearsExecutionJobTypeSchema = z.enum([
  'storyboard_image',
  'character_image',
  'scene_image',
  'seedance_video',
  'subtitle_render',
  'audio_mix',
  'title_card_render',
  'final_assemble',
]);

const GearsExecutionFailureCategorySchema = z.enum([
  'asset_missing',
  'artifact_invalid',
  'artifact_upload_failed',
  'callback_delivery_failed',
  'output_missing',
  'payload_invalid',
  'content_policy',
  'provider_timeout',
  'provider_quota',
  'provider_auth',
  'provider_rate_limit',
  'provider_server_error',
  'render_failed',
  'worker_unavailable',
  'network_error',
  'unknown',
]);

const GearsExecutionCodeValueSchema = z.union([
  z.string().trim().min(1).max(120),
  z.number().int(),
]);

const GearsExecutionProgressValueSchema = z.union([
  z.number(),
  z.string().trim().min(1).max(40),
]);

const GearsExecutionTimestampValueSchema = z.union([
  z.string().trim().min(1).max(80),
  z.number().finite(),
]);

const GearsExecutionArtifactSchema = z.object({
  artifact_id: z.string().trim().min(1).max(160).optional(),
  kind: z.string().trim().min(1).max(80).optional(),
  url: z.string().trim().url(),
  role: z.string().trim().min(1).max(80).optional(),
  mime_type: z.string().trim().min(1).max(120).optional(),
  source_unit_id: z.string().trim().min(1).max(160).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const GearsJobSubmitRequestSchema = z.object({
  job_type: GearsExecutionJobTypeSchema.optional().default('seedance_video'),
  source_unit_ids: z.array(z.string().trim().min(1).max(160)).min(1).max(200).optional(),
  source_unit_id: z.string().trim().min(1).max(160).optional(),
  use_gears_api: z.boolean().optional().default(false),
  overwrite_existing: z.boolean().optional().default(false),
  payload: z.record(z.string(), z.unknown()).optional(),
  callback_url: z.string().trim().url().optional(),
  note: z.string().trim().min(1).max(500).optional(),
});

export const GearsJobStatusSyncRequestSchema = z.object({
  job_type: GearsExecutionJobTypeSchema.optional(),
  source_unit_ids: z.array(z.string().trim().min(1).max(160)).min(1).max(200).optional(),
  source_unit_id: z.string().trim().min(1).max(160).optional(),
  include_completed: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(200).optional().default(50),
  note: z.string().trim().min(1).max(500).optional(),
});

export const GearsJobLocalAcceptanceRequestSchema = z.object({
  job_type: GearsExecutionJobTypeSchema.optional(),
  source_unit_ids: z.array(z.string().trim().min(1).max(160)).min(1).max(200).optional(),
  source_unit_id: z.string().trim().min(1).max(160).optional(),
  include_completed: z.boolean().optional().default(false),
  include_external_jobs: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(200).optional().default(50),
  artifact_base_url: z.string().trim().url().optional(),
  artifact_url_map: z.record(z.string(), z.string().trim().url()).optional(),
  artifact_kind: z.string().trim().min(1).max(80).optional(),
  note: z.string().trim().min(1).max(500).optional(),
});

export const GearsExecutionLiveSmokeRunRequestSchema = z.object({
  execute: z.boolean().optional().default(false),
  poll_after_submit: z.boolean().optional().default(false),
  note: z.string().trim().min(1).max(500).optional(),
}).strict();

function isGearsCallbackObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const GEARS_CALLBACK_BATCH_ARRAY_KEYS = [
  'callbacks',
  'events',
  'jobs',
  'tasks',
  'items',
  'results',
];
const GEARS_CALLBACK_BATCH_CONTAINER_KEYS = [
  'data',
  'result',
  'response',
  'payload',
  'job',
  'task',
  'item',
  'record',
];

function countGearsCallbackBatchItems(value: unknown, depth = 0): number {
  if (depth > 5 || !isGearsCallbackObject(value)) return 0;
  let count = 0;
  for (const key of GEARS_CALLBACK_BATCH_ARRAY_KEYS) {
    const arrayValue = value[key];
    if (Array.isArray(arrayValue)) count += arrayValue.length;
  }
  for (const key of GEARS_CALLBACK_BATCH_CONTAINER_KEYS) {
    count += countGearsCallbackBatchItems(value[key], depth + 1);
  }
  return count;
}

function hasGearsCallbackIdentifier(value: unknown, depth = 0): boolean {
  if (depth > 5) return false;
  if (Array.isArray(value)) {
    return value.some(item => hasGearsCallbackIdentifier(item, depth + 1));
  }
  if (!isGearsCallbackObject(value)) return false;
  if (
    value.gears_job_id
    || value.gearsJobId
    || value.job_id
    || value.jobId
    || value.task_id
    || value.taskId
    || value.id
    || value.source_unit_id
    || value.sourceUnitId
    || value.external_id
    || value.externalId
    || value.custom_id
    || value.customId
    || value.shot_id
    || value.shotId
    || value.production_id
    || value.productionId
    || value.idempotency_key
    || value.idempotencyKey
  ) {
    return true;
  }
  return [
    'data',
    'result',
    'response',
    'payload',
    'job',
    'task',
    'item',
    'record',
    'callbacks',
    'events',
    'jobs',
    'tasks',
    'items',
    'results',
  ].some(key => hasGearsCallbackIdentifier(value[key], depth + 1));
}

export const GearsJobCallbackRequestSchema = z.object({
  gears_job_id: z.string().trim().min(1).max(160).optional(),
  gearsJobId: z.string().trim().min(1).max(160).optional(),
  job_id: z.string().trim().min(1).max(160).optional(),
  jobId: z.string().trim().min(1).max(160).optional(),
  task_id: z.string().trim().min(1).max(160).optional(),
  taskId: z.string().trim().min(1).max(160).optional(),
  id: z.string().trim().min(1).max(160).optional(),
  job_type: GearsExecutionJobTypeSchema.optional(),
  jobType: GearsExecutionJobTypeSchema.optional(),
  source_project_id: z.string().trim().min(1).max(180).optional(),
  sourceProjectId: z.string().trim().min(1).max(180).optional(),
  source_story_id: z.string().trim().min(1).max(120).optional(),
  sourceStoryId: z.string().trim().min(1).max(120).optional(),
  series_project_id: z.string().trim().min(1).max(180).optional(),
  seriesProjectId: z.string().trim().min(1).max(180).optional(),
  source_unit_id: z.string().trim().min(1).max(160).optional(),
  sourceUnitId: z.string().trim().min(1).max(160).optional(),
  external_id: z.string().trim().min(1).max(160).optional(),
  externalId: z.string().trim().min(1).max(160).optional(),
  custom_id: z.string().trim().min(1).max(160).optional(),
  customId: z.string().trim().min(1).max(160).optional(),
  shot_id: z.string().trim().min(1).max(120).optional(),
  shotId: z.string().trim().min(1).max(120).optional(),
  production_id: z.string().trim().min(1).max(160).optional(),
  productionId: z.string().trim().min(1).max(160).optional(),
  status: z.string().trim().min(1).max(80).optional(),
  task_status: z.string().trim().min(1).max(80).optional(),
  taskStatus: z.string().trim().min(1).max(80).optional(),
  state: z.string().trim().min(1).max(80).optional(),
  phase: z.string().trim().min(1).max(80).optional(),
  progress: GearsExecutionProgressValueSchema.optional(),
  progress_percent: GearsExecutionProgressValueSchema.optional(),
  progressPercent: GearsExecutionProgressValueSchema.optional(),
  percent: GearsExecutionProgressValueSchema.optional(),
  percentage: GearsExecutionProgressValueSchema.optional(),
  progress_ratio: GearsExecutionProgressValueSchema.optional(),
  progressRatio: GearsExecutionProgressValueSchema.optional(),
  provider_event_at: GearsExecutionTimestampValueSchema.optional(),
  providerEventAt: GearsExecutionTimestampValueSchema.optional(),
  event_time: GearsExecutionTimestampValueSchema.optional(),
  eventTime: GearsExecutionTimestampValueSchema.optional(),
  event_at: GearsExecutionTimestampValueSchema.optional(),
  eventAt: GearsExecutionTimestampValueSchema.optional(),
  timestamp: GearsExecutionTimestampValueSchema.optional(),
  created_at: GearsExecutionTimestampValueSchema.optional(),
  createdAt: GearsExecutionTimestampValueSchema.optional(),
  updated_at: GearsExecutionTimestampValueSchema.optional(),
  updatedAt: GearsExecutionTimestampValueSchema.optional(),
  completed_at: GearsExecutionTimestampValueSchema.optional(),
  completedAt: GearsExecutionTimestampValueSchema.optional(),
  finished_at: GearsExecutionTimestampValueSchema.optional(),
  finishedAt: GearsExecutionTimestampValueSchema.optional(),
  artifacts: z.array(GearsExecutionArtifactSchema).max(200).optional(),
  artifact_urls: z.array(z.string().trim().url()).max(200).optional(),
  artifactUrls: z.array(z.string().trim().url()).max(200).optional(),
  artifact_url: z.string().trim().url().optional(),
  artifactUrl: z.string().trim().url().optional(),
  video_url: z.string().trim().url().optional(),
  videoUrl: z.string().trim().url().optional(),
  output_url: z.string().trim().url().optional(),
  outputUrl: z.string().trim().url().optional(),
  file_url: z.string().trim().url().optional(),
  fileUrl: z.string().trim().url().optional(),
  manifest_url: z.string().trim().url().optional(),
  manifestUrl: z.string().trim().url().optional(),
  subtitle_url: z.string().trim().url().optional(),
  subtitleUrl: z.string().trim().url().optional(),
  srt_url: z.string().trim().url().optional(),
  srtUrl: z.string().trim().url().optional(),
  vtt_url: z.string().trim().url().optional(),
  vttUrl: z.string().trim().url().optional(),
  audio_url: z.string().trim().url().optional(),
  audioUrl: z.string().trim().url().optional(),
  image_url: z.string().trim().url().optional(),
  imageUrl: z.string().trim().url().optional(),
  thumbnail_url: z.string().trim().url().optional(),
  thumbnailUrl: z.string().trim().url().optional(),
  poster_url: z.string().trim().url().optional(),
  posterUrl: z.string().trim().url().optional(),
  url: z.string().trim().url().optional(),
  failure_category: GearsExecutionFailureCategorySchema.optional(),
  failureCategory: GearsExecutionFailureCategorySchema.optional(),
  failure_reason: z.string().trim().min(1).max(500).optional(),
  failureReason: z.string().trim().min(1).max(500).optional(),
  error_code: GearsExecutionCodeValueSchema.optional(),
  errorCode: GearsExecutionCodeValueSchema.optional(),
  provider_error_code: GearsExecutionCodeValueSchema.optional(),
  providerErrorCode: GearsExecutionCodeValueSchema.optional(),
  code: GearsExecutionCodeValueSchema.optional(),
  error: z.string().trim().min(1).max(500).optional(),
  message: z.string().trim().min(1).max(500).optional(),
  note: z.string().trim().min(1).max(500).optional(),
  event_id: z.string().trim().min(1).max(160).optional(),
  eventId: z.string().trim().min(1).max(160).optional(),
  callback_id: z.string().trim().min(1).max(160).optional(),
  callbackId: z.string().trim().min(1).max(160).optional(),
  idempotency_key: z.string().trim().min(1).max(160).optional(),
  idempotencyKey: z.string().trim().min(1).max(160).optional(),
  quality_score: z.number().min(0).max(100).optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  review_note: z.string().trim().min(1).max(500).optional(),
  reviewNote: z.string().trim().min(1).max(500).optional(),
  data: z.unknown().optional(),
  result: z.unknown().optional(),
  response: z.unknown().optional(),
  job: z.unknown().optional(),
  task: z.unknown().optional(),
  item: z.unknown().optional(),
  record: z.unknown().optional(),
  callbacks: z.unknown().optional(),
  events: z.unknown().optional(),
  jobs: z.unknown().optional(),
  tasks: z.unknown().optional(),
  items: z.unknown().optional(),
  results: z.unknown().optional(),
  output: z.unknown().optional(),
  outputs: z.unknown().optional(),
  files: z.unknown().optional(),
  media: z.unknown().optional(),
  assets: z.unknown().optional(),
  payload: z.unknown().optional(),
}).refine(
  data => hasGearsCallbackIdentifier(data),
  { message: 'GEARS callback requires gears_job_id/job_id, source_unit_id/external_id/shot_id, or idempotency_key' },
).refine(
  data => countGearsCallbackBatchItems(data) <= GEARS_CALLBACK_BATCH_ITEM_LIMIT,
  { message: `GEARS callback batch item count must be <= ${GEARS_CALLBACK_BATCH_ITEM_LIMIT}` },
);

const SeedanceShotProductionStatusSchema = z.enum([
  'not_started',
  'prompt_exported',
  'submitted',
  'processing',
  'ready',
  'failed',
  'skipped',
]);

const SeedanceShotProviderQueuePrioritySchema = z.enum(['low', 'normal', 'high']);
const SeedanceShotProviderRecoverableStatusSchema = z.enum(['submitted', 'processing']);
const SeedanceProviderFailureCategorySchema = z.enum([
  'asset_missing',
  'prompt_invalid',
  'content_policy',
  'provider_timeout',
  'provider_quota',
  'provider_auth',
  'provider_rate_limit',
  'provider_server_error',
  'network_error',
  'unknown',
]);
const SeedanceProviderCodeValueSchema = z.union([
  z.string().trim().min(1).max(120),
  z.number().int(),
]);

export const SeedanceShotStatusUpdateRequestSchema = z.object({
  shot_id: z.string().trim().min(1).max(80),
  status: SeedanceShotProductionStatusSchema,
  provider: z.string().trim().min(1).max(80).optional(),
  provider_job_id: z.string().trim().min(1).max(120).optional(),
  provider_queue_id: z.string().trim().min(1).max(120).optional(),
  provider_queue_position: z.number().int().min(1).max(10000).optional(),
  video_url: z.string().trim().url().optional(),
  failure_reason: z.string().trim().min(1).max(500).optional(),
  failure_category: SeedanceProviderFailureCategorySchema.optional(),
  provider_error_code: z.string().trim().min(1).max(120).optional(),
  note: z.string().trim().min(1).max(500).optional(),
  increment_retry: z.boolean().optional(),
  quality_score: z.number().min(0).max(100).optional(),
  review_note: z.string().trim().min(1).max(500).optional(),
});

export const SeedanceShotStatusBatchUpdateRequestSchema = z.object({
  updates: z.array(SeedanceShotStatusUpdateRequestSchema).min(1).max(200),
});

export const SeedanceShotVersionSelectRequestSchema = z.object({
  shot_id: z.string().trim().min(1).max(80),
  version_id: z.string().trim().min(1).max(120),
  note: z.string().trim().min(1).max(500).optional(),
});

export const SeedanceShotAutoSelectRequestSchema = z.object({
  min_quality_score: z.number().min(0).max(100).optional(),
  overwrite_manual: z.boolean().optional().default(false),
  note: z.string().trim().min(1).max(500).optional(),
});

export const SeedanceShotProviderSubmitRequestSchema = z.object({
  shot_ids: z.array(z.string().trim().min(1).max(80)).min(1).max(200).optional(),
  provider: z.string().trim().min(1).max(80).optional(),
  job_prefix: z.string().trim().min(1).max(80).optional(),
  queue_id: z.string().trim().min(1).max(120).optional(),
  queue_priority: SeedanceShotProviderQueuePrioritySchema.optional().default('normal'),
  use_provider_adapter: z.boolean().optional().default(false),
  overwrite_existing: z.boolean().optional().default(false),
  increment_retry: z.boolean().optional().default(false),
  note: z.string().trim().min(1).max(500).optional(),
});

export const SeedanceShotProviderRecoveryRequestSchema = z.object({
  timeout_minutes: z.number().int().min(1).max(10080).optional().default(120),
  statuses: z.array(SeedanceShotProviderRecoverableStatusSchema).min(1).max(2).optional(),
  mark_timed_out_failed: z.boolean().optional().default(false),
  note: z.string().trim().min(1).max(500).optional(),
});

export const SeedanceShotCallbackRequestSchema = z.object({
  shot_id: z.string().trim().min(1).max(80).optional(),
  shotId: z.string().trim().min(1).max(80).optional(),
  external_id: z.string().trim().min(1).max(80).optional(),
  externalId: z.string().trim().min(1).max(80).optional(),
  custom_id: z.string().trim().min(1).max(80).optional(),
  customId: z.string().trim().min(1).max(80).optional(),
  provider: z.string().trim().min(1).max(80).optional(),
  provider_job_id: z.string().trim().min(1).max(120).optional(),
  providerJobId: z.string().trim().min(1).max(120).optional(),
  job_id: z.string().trim().min(1).max(120).optional(),
  jobId: z.string().trim().min(1).max(120).optional(),
  task_id: z.string().trim().min(1).max(120).optional(),
  taskId: z.string().trim().min(1).max(120).optional(),
  request_id: z.string().trim().min(1).max(120).optional(),
  requestId: z.string().trim().min(1).max(120).optional(),
  id: z.string().trim().min(1).max(120).optional(),
  provider_queue_id: z.string().trim().min(1).max(120).optional(),
  providerQueueId: z.string().trim().min(1).max(120).optional(),
  queue_id: z.string().trim().min(1).max(120).optional(),
  queueId: z.string().trim().min(1).max(120).optional(),
  batch_id: z.string().trim().min(1).max(120).optional(),
  batchId: z.string().trim().min(1).max(120).optional(),
  provider_queue_position: z.number().int().min(1).max(10000).optional(),
  providerQueuePosition: z.number().int().min(1).max(10000).optional(),
  queue_position: z.number().int().min(1).max(10000).optional(),
  queuePosition: z.number().int().min(1).max(10000).optional(),
  position: z.number().int().min(1).max(10000).optional(),
  status: z.string().trim().min(1).max(80).optional(),
  task_status: z.string().trim().min(1).max(80).optional(),
  taskStatus: z.string().trim().min(1).max(80).optional(),
  state: z.string().trim().min(1).max(80).optional(),
  phase: z.string().trim().min(1).max(80).optional(),
  video_url: z.string().trim().url().optional(),
  videoUrl: z.string().trim().url().optional(),
  output_url: z.string().trim().url().optional(),
  outputUrl: z.string().trim().url().optional(),
  file_url: z.string().trim().url().optional(),
  fileUrl: z.string().trim().url().optional(),
  download_url: z.string().trim().url().optional(),
  downloadUrl: z.string().trim().url().optional(),
  result_url: z.string().trim().url().optional(),
  resultUrl: z.string().trim().url().optional(),
  url: z.string().trim().url().optional(),
  failure_reason: z.string().trim().min(1).max(500).optional(),
  failureReason: z.string().trim().min(1).max(500).optional(),
  error_message: z.string().trim().min(1).max(500).optional(),
  errorMessage: z.string().trim().min(1).max(500).optional(),
  reason: z.string().trim().min(1).max(500).optional(),
  failure_category: SeedanceProviderFailureCategorySchema.optional(),
  failureCategory: SeedanceProviderFailureCategorySchema.optional(),
  provider_error_code: SeedanceProviderCodeValueSchema.optional(),
  providerErrorCode: SeedanceProviderCodeValueSchema.optional(),
  error_code: SeedanceProviderCodeValueSchema.optional(),
  errorCode: SeedanceProviderCodeValueSchema.optional(),
  status_code: SeedanceProviderCodeValueSchema.optional(),
  statusCode: SeedanceProviderCodeValueSchema.optional(),
  code: SeedanceProviderCodeValueSchema.optional(),
  error: z.string().trim().min(1).max(500).optional(),
  message: z.string().trim().min(1).max(500).optional(),
  msg: z.string().trim().min(1).max(500).optional(),
  note: z.string().trim().min(1).max(500).optional(),
  increment_retry: z.boolean().optional(),
  incrementRetry: z.boolean().optional(),
  quality_score: z.number().min(0).max(100).optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  score: z.number().min(0).max(100).optional(),
  quality: z.number().min(0).max(100).optional(),
  review_note: z.string().trim().min(1).max(500).optional(),
  reviewNote: z.string().trim().min(1).max(500).optional(),
}).refine(
  data => Boolean(
    data.shot_id
    || data.shotId
    || data.external_id
    || data.externalId
    || data.custom_id
    || data.customId
    || data.provider_job_id
    || data.providerJobId
    || data.job_id
    || data.jobId
    || data.task_id
    || data.taskId
    || data.request_id
    || data.requestId
    || data.id
    || data.provider_queue_id
    || data.providerQueueId
    || data.queue_id
    || data.queueId
    || data.batch_id
    || data.batchId
  ),
  { message: 'callback requires shot_id, provider_job_id/job_id, or provider_queue_id/queue_id' },
);

export const SeedanceShotCallbackImportRequestSchema = z.object({
  callbacks: z.array(SeedanceShotCallbackRequestSchema).min(1).max(200),
});

export const SeedanceShotProviderCallbackRequestSchema = SeedanceShotCallbackRequestSchema.and(z.object({
  event_id: z.string().trim().min(1).max(160).optional(),
  eventId: z.string().trim().min(1).max(160).optional(),
  callback_id: z.string().trim().min(1).max(160).optional(),
  callbackId: z.string().trim().min(1).max(160).optional(),
  payload: z.unknown().optional(),
}));

export const SeedanceShotProviderPollRequestSchema = z.object({
  provider: z.string().trim().min(1).max(80).optional(),
  queue_id: z.string().trim().min(1).max(120).optional(),
  shot_ids: z.array(z.string().trim().min(1).max(80)).min(1).max(200).optional(),
  statuses: z.array(SeedanceShotProviderRecoverableStatusSchema).min(1).max(2).optional(),
  limit: z.number().int().min(1).max(200).optional().default(100),
  include_prompt: z.boolean().optional().default(false),
  use_provider_adapter: z.boolean().optional().default(false),
  provider_results: z.array(SeedanceShotProviderCallbackRequestSchema).min(1).max(200).optional(),
  note: z.string().trim().min(1).max(500).optional(),
});

export const SeedanceShotProviderQueueOverviewRequestSchema = z.object({
  provider: z.string().trim().min(1).max(80).optional(),
  queue_id: z.string().trim().min(1).max(120).optional(),
  timeout_minutes: z.number().int().min(1).max(10080).optional().default(120),
  include_completed: z.boolean().optional().default(false),
});

export const SeedanceShotProviderRetryPlanRequestSchema = z.object({
  provider: z.string().trim().min(1).max(80).optional(),
  queue_id: z.string().trim().min(1).max(120).optional(),
  timeout_minutes: z.number().int().min(1).max(10080).optional().default(120),
  max_retry_count: z.number().int().min(0).max(20).optional(),
  include_unsubmitted: z.boolean().optional().default(false),
  failure_categories: z.array(SeedanceProviderFailureCategorySchema).min(1).max(10).optional(),
});

export const SeedanceShotProviderRetrySubmitRequestSchema = SeedanceShotProviderRetryPlanRequestSchema.extend({
  target_queue_id: z.string().trim().min(1).max(120).optional(),
  queue_priority: SeedanceShotProviderQueuePrioritySchema.optional().default('normal'),
  job_prefix: z.string().trim().min(1).max(80).optional(),
  use_provider_adapter: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(200).optional(),
  note: z.string().trim().min(1).max(500).optional(),
});

export const StorySceneRegenerateRequestSchema = z.object({
  scene_id: z.number().int().min(1),
  intent: z.enum([
    'tighten_conflict',
    'rewrite_narration',
    'shift_emotion',
    'clarify_visuals',
    'custom',
  ]),
  user_note: z.string().trim().max(300).optional(),
  model_profile_id: z.string().optional(),
});

export const StoryQualityRepairRequestSchema = z.object({
  model_profile_id: z.string().optional(),
  genre_strictness: GenreStrictnessSchema.optional().default('balanced'),
  target_report: z.enum(['outline', 'pattern', 'gears', 'production_material', 'audience', 'combined']).optional(),
  repair_action_id: z.string().trim().min(1).max(80).optional(),
});

export const StoryQualityRepairPromptRequestSchema = StoryQualityRepairRequestSchema.extend({
  user_instruction: z.string().trim().max(800).optional(),
  include_story_json: z.boolean().optional().default(false),
  include_markdown: z.boolean().optional().default(true),
  max_actions: z.number().int().min(1).max(50).optional().default(12),
});

export const StoryQualityRepairApplyRequestSchema = z.object({
  repaired_story_json: z.string().trim().min(2).max(2_000_000),
  user_instruction: z.string().trim().max(800).optional(),
  apply: z.boolean().optional().default(false),
  allow_no_improvement: z.boolean().optional().default(false),
});

export const StoryProductionBoardRepairRequestSchema = z.object({
  task_ids: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  actions: z.array(z.enum([
    'normalize_period_costumes',
    'register_asset',
    'clean_prompt',
    'strengthen_filmability',
    'add_continuity',
    'split_duration',
  ])).max(6).optional(),
  categories: z.array(z.enum([
    'asset',
    'prompt',
    'filmability',
    'continuity',
    'period',
    'duration',
  ])).max(6).optional(),
  shot_ids: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  scene_ids: z.array(z.number().int().min(1)).max(50).optional(),
  priorities: z.array(z.enum(['P0', 'P1', 'P2'])).max(3).optional(),
  apply_all: z.boolean().optional().default(false),
});

export const ProductionReadinessAutomationRunRequestSchema = z.object({
  dry_run: z.boolean().optional().default(true),
  max_steps: z.number().int().min(1).max(12).optional().default(6),
  action_keys: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
  stop_on_error: z.boolean().optional().default(true),
});

export const ProductionReadinessPortfolioRunRequestSchema = z.object({
  dry_run: z.boolean().optional().default(true),
  include_archived_series: z.boolean().optional().default(false),
  max_targets: z.number().int().min(1).max(20).optional().default(5),
  per_target_max_steps: z.number().int().min(1).max(12).optional().default(4),
  min_priority_score: z.number().int().min(0).max(300).optional(),
  scopes: z.array(z.enum(['story_project', 'ai_comic_series'])).max(2).optional(),
  project_ids: z.array(z.string().trim().min(1).max(160)).max(50).optional(),
  action_keys: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
  stop_on_error: z.boolean().optional().default(true),
});

export const StoryAgentGeneratedGovernanceActionKeySchema = z.enum([
  'restore_or_relink_series_story_refs',
  'archive_or_rebuild_series_fixtures',
  'generate_first_series_episode',
  'repair_series_command_contracts',
  'repair_story_project_refs',
  'promote_ready_targets_for_gears_signoff',
]);

export const StoryAgentGeneratedGovernanceRunRequestSchema = z.object({
  dry_run: z.boolean().optional().default(true),
  action_keys: z.array(StoryAgentGeneratedGovernanceActionKeySchema).max(6).optional(),
  project_ids: z.array(z.string().trim().min(1).max(160)).max(100).optional(),
  max_targets: z.number().int().min(1).max(100).optional().default(20),
});

export const GearsDeliveryUpdateRequestSchema = z.object({
  markdown: z.string().min(1, 'markdown cannot be empty').max(120000, 'markdown is too long'),
});

const GearsVideoCallbackStatusSchema = z.enum([
  'processing',
  'ready',
  'failed',
  'queued',
  'running',
  'completed',
  'success',
  'done',
  'error',
]).transform((status) => {
  if (status === 'queued' || status === 'running') return 'processing';
  if (status === 'completed' || status === 'success' || status === 'done') return 'ready';
  if (status === 'error') return 'failed';
  return status;
});

function normalizeGearsVideoCallbackInput(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const raw = input as Record<string, unknown>;
  return {
    ...raw,
    storyId: raw.storyId ?? raw.story_id,
    video_url: raw.video_url ?? raw.videoUrl,
    status: typeof raw.status === 'string' ? raw.status.toLowerCase() : raw.status,
    thumbnail_url: raw.thumbnail_url ?? raw.thumbnailUrl,
  };
}

export const GearsVideoReadyCallbackRequestSchema = z.preprocess(
  normalizeGearsVideoCallbackInput,
  z.object({
    storyId: StoryIdValueSchema,
    video_url: z.string().url('video_url must be a valid URL').optional(),
    status: GearsVideoCallbackStatusSchema.default('ready'),
    thumbnail_url: z.string().url('thumbnail_url must be a valid URL').optional(),
  }),
).superRefine((data, ctx) => {
  if (data.status === 'ready' && !data.video_url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['video_url'],
      message: 'video_url is required when status is ready',
    });
  }
});

export const SupplementTaskIdParamSchema = ProjectIdParamSchema.extend({
  taskId: z.string().min(1, 'taskId cannot be empty'),
});

export const KnowledgeSupplementTaskUpdateRequestSchema = z.object({
  status: z.enum(['open', 'resolved']),
  supplement_note: z.string().trim().max(4000, 'supplement_note is too long').optional(),
  supplement_field_values: z.record(
    z.string().trim().min(1).max(120),
    z.string().trim().max(2000),
  ).optional(),
  knowledge_candidate_review_status: z.enum(['pending_review', 'approved', 'rejected']).optional(),
  knowledge_candidate_review_note: z.string().trim().max(2000, 'knowledge_candidate_review_note is too long').optional(),
  knowledge_writeback_status: z.enum(['draft_ready', 'queued', 'written_back', 'needs_revision']).optional(),
  knowledge_writeback_note: z.string().trim().max(2000, 'knowledge_writeback_note is too long').optional(),
});

export const DomainPackExpansionReviewStateUpdateRequestSchema = z.object({
  review_item_id: z.string().trim().min(1, 'review_item_id is required').max(240),
  review_status: z.enum(['candidate_review', 'approved', 'rejected', 'needs_revision']),
  review_note: z.string().trim().max(4000, 'review_note is too long').optional(),
  reviewer_id: z.string().trim().max(120, 'reviewer_id is too long').optional(),
  reviewer_name: z.string().trim().max(120, 'reviewer_name is too long').optional(),
  reviewed_by: z.string().trim().max(120, 'reviewed_by is too long').optional(),
  writeback_status: z.enum(['draft_ready', 'queued', 'written_back', 'needs_revision']).optional(),
  writeback_note: z.string().trim().max(2000, 'writeback_note is too long').optional(),
});

export const DomainPackExpansionReviewStateBulkUpdateRequestSchema = z.object({
  review_item_ids: z.array(
    z.string().trim().min(1, 'review_item_id is required').max(240),
  ).min(1, 'review_item_ids cannot be empty').max(200, 'review_item_ids is too large'),
  review_status: z.enum(['candidate_review', 'approved', 'rejected', 'needs_revision']),
  review_note: z.string().trim().max(4000, 'review_note is too long').optional(),
  reviewer_id: z.string().trim().max(120, 'reviewer_id is too long').optional(),
  reviewer_name: z.string().trim().max(120, 'reviewer_name is too long').optional(),
  reviewed_by: z.string().trim().max(120, 'reviewed_by is too long').optional(),
  writeback_status: z.enum(['draft_ready', 'queued', 'written_back', 'needs_revision']).optional(),
  writeback_note: z.string().trim().max(2000, 'writeback_note is too long').optional(),
});

// ---------------------------------------------------------------------------
// Story outline analyze request
// ---------------------------------------------------------------------------

export const KnowledgeNeedSchema = z.object({
  need_id: z.string().min(1),
  label: z.string().min(1),
  keywords: z.array(z.string()),
  required: z.boolean(),
});

export const StoryOutlineAnalyzeRequestSchema = z.object({
  outline: z.string().min(1, 'outline cannot be empty'),
  preferred_video_types: VideoTypeSchema.array().optional(),
  target_video_duration: DurationSchema.optional(),
  localized_target_region: z.string().trim().min(1).max(40).optional(),
});

// ---------------------------------------------------------------------------
// Multi-entry match request
// ---------------------------------------------------------------------------

export const MultiMatchRequestSchema = z.object({
  outline: z.string().min(1, 'outline cannot be empty'),
  knowledge_needs: z.array(KnowledgeNeedSchema).min(1, 'at least one knowledge_need required'),
  limit_per_need: z.number().int().min(1).max(20).optional().default(5),
  localized_target_region: z.string().trim().min(1).max(40).optional(),
  localization_mode: LocalizationModeSchema.optional().default('allow_related_influence'),
});

// ---------------------------------------------------------------------------
// AI comic series plan request
// ---------------------------------------------------------------------------

export const AiComicPacingProfileSchema = z.enum([
  'fast_hook',
  'balanced_drama',
  'slow_burn',
  'mystery_cliffhanger',
]);

export const AiComicGenerationScopeSchema = z.enum([
  'series_bible',
  'episode_cards',
  'full_planning',
]);

const AiComicKnowledgePackSchema = z.object({
  primary_entries: z.array(z.object({
    entry_name: z.string(),
    province: z.string(),
    region: z.string(),
    type: z.string(),
    summary: z.string(),
    score: z.number(),
    role_in_story: z.string(),
    match_reason: z.string(),
    keywords: z.array(z.string()),
    knowledge_domain: KnowledgeDomainSchema.optional(),
    entry_role: KnowledgeEntryRoleSchema.optional(),
    era: z.string().optional(),
    asset_usage: z.array(KnowledgeAssetUsageSchema).optional(),
    asset_split: KnowledgeAssetSplitSchema.optional(),
  })),
  supporting_entries: z.array(z.object({
    entry_name: z.string(),
    province: z.string(),
    region: z.string(),
    type: z.string(),
    summary: z.string(),
    score: z.number(),
    role_in_story: z.string(),
    match_reason: z.string(),
    keywords: z.array(z.string()),
    knowledge_domain: KnowledgeDomainSchema.optional(),
    entry_role: KnowledgeEntryRoleSchema.optional(),
    era: z.string().optional(),
    asset_usage: z.array(KnowledgeAssetUsageSchema).optional(),
    asset_split: KnowledgeAssetSplitSchema.optional(),
  })),
  missing_needs: z.array(z.object({
    need_id: z.string(),
    label: z.string(),
    message: z.string(),
  })),
  overall_confidence: z.number(),
});

export const AiComicSeriesPlanRequestSchema = z.object({
  outline: z.string().trim().min(1, 'outline cannot be empty').max(12000, 'outline is too long'),
  series_title: z.string().trim().min(1).max(80).optional(),
  episode_count: z.number().int().min(1).max(120),
  episode_duration_range_sec: z.object({
    min: z.number().int().min(30).max(1200),
    max: z.number().int().min(30).max(1200),
  }),
  pacing_profile: AiComicPacingProfileSchema.optional().default('balanced_drama'),
  generation_scope: AiComicGenerationScopeSchema.optional().default('full_planning'),
  narrative_pattern_ids: z.array(NarrativePatternIdSchema).max(6).optional(),
  knowledge_pack: AiComicKnowledgePackSchema.optional(),
  character_hints: z.array(StoryDetectedCharacterSchema).optional(),
}).refine(
  data => data.episode_duration_range_sec.min <= data.episode_duration_range_sec.max,
  { message: 'episode_duration_range_sec.min cannot be greater than max', path: ['episode_duration_range_sec'] },
);

const AiComicSeriesCharacterArcSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  starting_state: z.string().min(1),
  desire: z.string().min(1),
  long_arc: z.string().min(1),
  turning_points: z.array(z.object({
    episode_no: z.number().int().min(1),
    change: z.string().min(1),
  })),
  visual_signature: z.string().min(1),
});

const AiComicPlotThreadSchema = z.object({
  thread_id: z.string().min(1),
  title: z.string().min(1),
  setup_episode: z.number().int().min(1),
  payoff_episode: z.number().int().min(1),
  description: z.string().min(1),
  continuity_notes: z.array(z.string()),
});

const AiComicSeriesPhaseSchema = z.object({
  phase_id: z.string().min(1),
  episode_range: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  purpose: z.string().min(1),
  turning_point: z.string().min(1),
});

const AiComicSeriesSpineBeatSchema = z.object({
  beat_id: z.string().min(1),
  episode_range: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  story_function: z.string().min(1),
  central_question: z.string().min(1),
  required_turn: z.string().min(1),
  payoff_target: z.string().min(1),
});

const AiComicEndingHookTypeSchema = z.enum([
  'choice',
  'reveal',
  'danger',
  'emotional_question',
  'quiet_aftertaste',
  'final_echo',
]);

const AiComicEpisodePlanSchema = z.object({
  episode_no: z.number().int().min(1),
  title: z.string().min(1),
  target_duration_sec: z.number().int().min(30).max(1200),
  target_panel_count: z.number().int().min(1).max(240),
  story_phase: z.string().min(1),
  opening_hook: z.string().min(1).optional(),
  main_conflict: z.string().min(1),
  midpoint_turn: z.string().min(1).optional(),
  key_characters: z.array(z.string()),
  continuity_from_previous: z.array(z.string()),
  new_information: z.array(z.string()),
  foreshadowing: z.array(z.string()),
  payoff: z.array(z.string()),
  ending_hook: z.string().min(1),
  ending_hook_type: AiComicEndingHookTypeSchema.optional(),
  character_state_change: z.string().min(1).optional(),
  thread_action: z.string().min(1).optional(),
  knowledge_focus: z.array(z.string()),
  continuity_state_after: z.array(z.string()),
});

const AiComicContinuityRuleSchema = z.object({
  rule_id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
});

const AiComicSeriesMemoryCategorySchema = z.enum([
  'character',
  'relationship',
  'prop',
  'location',
  'visual_asset',
  'knowledge_boundary',
  'story_event',
]);

const AiComicSeriesMemoryItemSchema = z.object({
  memory_id: z.string().min(1),
  category: AiComicSeriesMemoryCategorySchema,
  label: z.string().min(1),
  status: z.string().min(1),
  first_episode_no: z.number().int().min(1).max(120).optional(),
  last_episode_no: z.number().int().min(1).max(120).optional(),
  related_episode_nos: z.array(z.number().int().min(1).max(120)),
  continuity_notes: z.array(z.string()),
  visual_anchor: z.string().optional(),
  knowledge_boundary: z.string().optional(),
});

const AiComicSeriesMemorySchema = z.object({
  schema_version: z.literal('ai-comic-series-memory/v1'),
  characters: z.array(AiComicSeriesMemoryItemSchema),
  relationships: z.array(AiComicSeriesMemoryItemSchema),
  props: z.array(AiComicSeriesMemoryItemSchema),
  locations: z.array(AiComicSeriesMemoryItemSchema),
  visual_assets: z.array(AiComicSeriesMemoryItemSchema),
  knowledge_boundaries: z.array(AiComicSeriesMemoryItemSchema),
  story_events: z.array(AiComicSeriesMemoryItemSchema),
  conflicts: z.array(z.string()),
});

const AiComicEpisodicMemorySourceSchema = z.enum([
  'scene',
  'dialogue',
  'gears_segment',
  'seedance_shot',
]);

const AiComicEpisodicMemoryItemSchema = z.object({
  episodic_memory_id: z.string().min(1),
  source: AiComicEpisodicMemorySourceSchema,
  episode_no: z.number().int().min(1).max(120),
  scene_id: z.string().optional(),
  shot_id: z.string().optional(),
  title: z.string().min(1),
  text: z.string().min(1),
  characters: z.array(z.string()),
  location: z.string().optional(),
  emotional_tone: z.string().optional(),
  keywords: z.array(z.string()),
  token_signature: z.array(z.string()),
  recall_notes: z.array(z.string()),
});

const AiComicEpisodicMemoryIndexSchema = z.object({
  schema_version: z.literal('ai-comic-episodic-memory/v1'),
  embedding_strategy: z.literal('lexical-token-signature/v1'),
  items: z.array(AiComicEpisodicMemoryItemSchema),
  updated_at: z.string().optional(),
});

const AiComicProductionConstraintCategorySchema = z.enum([
  'continuity',
  'negative',
  'camera',
  'asset',
  'cultural_boundary',
]);

const AiComicProductionConstraintSeveritySchema = z.enum(['must', 'should', 'watch']);

const AiComicProductionConstraintStatusSchema = z.enum(['active', 'resolved', 'needs_review']);

const AiComicProductionConstraintItemSchema = z.object({
  constraint_id: z.string().min(1),
  category: AiComicProductionConstraintCategorySchema,
  label: z.string().min(1),
  description: z.string().min(1),
  source: z.enum(['series_plan', 'gears_segment', 'seedance_shot', 'manual']),
  severity: AiComicProductionConstraintSeveritySchema,
  status: AiComicProductionConstraintStatusSchema,
  episode_no: z.number().int().min(1).max(120).optional(),
  scene_id: z.string().optional(),
  shot_id: z.string().optional(),
  related_memory_ids: z.array(z.string()).optional(),
  notes: z.array(z.string()),
});

const AiComicProductionConstraintsSchema = z.object({
  schema_version: z.literal('ai-comic-production-constraints/v1'),
  items: z.array(AiComicProductionConstraintItemSchema),
  conflicts: z.array(z.string()),
});

const AiComicSeriesPlanSchema = z.object({
  schema_version: z.literal('ai-comic-series-plan/v1'),
  series_title: z.string().min(1),
  episode_count: z.number().int().min(1).max(120),
  episode_duration_range_sec: z.object({
    min: z.number().int().min(30).max(1200),
    max: z.number().int().min(30).max(1200),
  }),
  pacing_profile: AiComicPacingProfileSchema,
  generation_scope: AiComicGenerationScopeSchema,
  narrative_pattern_ids: z.array(NarrativePatternIdSchema).max(6).optional(),
  recommended_narrative_patterns: z.array(RecommendedNarrativePatternSchema).optional(),
  premise: z.string().min(1).max(12000),
  logline: z.string().min(1),
  core_theme: z.string().min(1),
  main_characters: z.array(AiComicSeriesCharacterArcSchema),
  plot_threads: z.array(AiComicPlotThreadSchema),
  phases: z.array(AiComicSeriesPhaseSchema),
  series_spine: z.array(AiComicSeriesSpineBeatSchema).optional(),
  episodes: z.array(AiComicEpisodePlanSchema).min(1),
  continuity_rules: z.array(AiComicContinuityRuleSchema),
  recurring_motifs: z.array(z.string()),
  production_notes: z.array(z.string()),
}).refine(
  data => data.episode_duration_range_sec.min <= data.episode_duration_range_sec.max,
  { message: 'episode_duration_range_sec.min cannot be greater than max', path: ['episode_duration_range_sec'] },
);

const AiComicContinuityLedgerSchema = z.object({
  schema_version: z.literal('ai-comic-continuity-ledger/v1'),
  last_generated_episode_no: z.number().int().min(1).max(120).optional(),
  character_state_current: z.array(z.string()),
  open_threads: z.array(z.string()),
  paid_off_threads: z.array(z.string()),
  knowledge_used: z.array(z.string()),
  episode_records: z.array(z.object({
    episode_no: z.number().int().min(1).max(120),
    story_id: StoryIdValueSchema,
    title: z.string().min(1),
    generated_at: z.string().min(1),
    character_state: z.array(z.string()),
    opened_threads: z.array(z.string()),
    paid_off_threads: z.array(z.string()),
    pending_threads_after: z.array(z.string()),
    knowledge_used: z.array(z.string()),
    ending_hook: z.string().min(1),
    next_episode_memory: z.array(z.string()),
    memory_events: z.array(AiComicSeriesMemoryItemSchema).optional(),
  })),
  series_memory: AiComicSeriesMemorySchema.optional(),
  production_constraints: AiComicProductionConstraintsSchema.optional(),
  episodic_memory: AiComicEpisodicMemoryIndexSchema.optional(),
});

const AiComicSeriesMemoryRecallPreferencesSchema = z.object({
  locked_memory_ids: z.array(z.string().min(1)).max(30).optional(),
  excluded_memory_ids: z.array(z.string().min(1)).max(80).optional(),
  per_episode: z.record(z.string(), z.object({
    locked_memory_ids: z.array(z.string().min(1)).max(30).optional(),
    excluded_memory_ids: z.array(z.string().min(1)).max(80).optional(),
  })).optional(),
  updated_at: z.string().optional(),
}).optional();

export const AiComicSeriesProjectSaveRequestSchema = z.object({
  series_project_id: AiComicSeriesProjectIdValueSchema.optional(),
  plan: AiComicSeriesPlanSchema,
  generated_episode_story_ids: z.record(z.string(), StoryIdValueSchema).optional(),
  continuity_ledger: AiComicContinuityLedgerSchema.optional(),
  memory_recall_preferences: AiComicSeriesMemoryRecallPreferencesSchema,
});

export const AiComicSeriesProjectCopyRequestSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
});

export const AiComicSeriesProjectArchiveRequestSchema = z.object({
  archived: z.boolean().optional().default(true),
});

const AiComicSeedanceProductionStatusSchema = z.enum([
  'not_started',
  'prompt_exported',
  'submitted',
  'processing',
  'ready',
  'failed',
  'skipped',
]);

const AiComicSeedanceRecoverableProductionStatusSchema = z.enum(['submitted', 'processing']);

const AiComicSeedanceAssetReferenceKindSchema = z.enum(['character', 'location', 'unknown']);

export const AiComicSeedanceAssetLibraryUpdateRequestSchema = z.object({
  items: z.array(z.object({
    asset_id: z.string().trim().min(1).max(120).optional(),
    kind: AiComicSeedanceAssetReferenceKindSchema,
    label: z.string().trim().min(1).max(120),
    reference_slot: z.string().trim().min(1).max(40).optional(),
    file_url: z.string().trim().min(1).max(1000).optional(),
    file_id: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(500).optional(),
  })).min(1).max(200),
});

export const AiComicSeedanceProductionStatusUpdateRequestSchema = z.object({
  episode_no: z.number().int().min(1).max(120),
  shot_id: z.string().trim().min(1).max(80),
  status: AiComicSeedanceProductionStatusSchema,
  provider_job_id: z.string().trim().min(1).max(120).optional(),
  video_url: z.string().trim().url().optional(),
  failure_reason: z.string().trim().min(1).max(500).optional(),
  note: z.string().trim().min(1).max(500).optional(),
  increment_retry: z.boolean().optional(),
  quality_score: z.number().min(0).max(100).optional(),
  review_note: z.string().trim().min(1).max(500).optional(),
});

export const AiComicSeedanceProductionBatchUpdateRequestSchema = z.object({
  updates: z.array(AiComicSeedanceProductionStatusUpdateRequestSchema).min(1).max(200),
});

export const AiComicSeedanceRetrySubmitRequestSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  job_prefix: z.string().trim().min(1).max(80).optional(),
  use_provider_adapter: z.boolean().optional().default(false),
  note: z.string().trim().min(1).max(500).optional(),
});

export const AiComicSeedanceProviderRecoveryRequestSchema = z.object({
  timeout_minutes: z.number().int().min(0).max(10080).optional().default(120),
  statuses: z.array(AiComicSeedanceRecoverableProductionStatusSchema).min(1).max(2).optional(),
  mark_timed_out_failed: z.boolean().optional().default(false),
  failure_reason: z.string().trim().min(1).max(500).optional(),
});

export const AiComicSeedanceProductionCallbackRequestSchema = z.object({
  episode_no: z.number().int().min(1).max(120).optional(),
  episodeNo: z.number().int().min(1).max(120).optional(),
  shot_id: z.string().trim().min(1).max(80).optional(),
  shotId: z.string().trim().min(1).max(80).optional(),
  provider_job_id: z.string().trim().min(1).max(120).optional(),
  providerJobId: z.string().trim().min(1).max(120).optional(),
  job_id: z.string().trim().min(1).max(120).optional(),
  jobId: z.string().trim().min(1).max(120).optional(),
  status: z.string().trim().min(1).max(80).optional(),
  video_url: z.string().trim().url().optional(),
  videoUrl: z.string().trim().url().optional(),
  url: z.string().trim().url().optional(),
  failure_reason: z.string().trim().min(1).max(500).optional(),
  failureReason: z.string().trim().min(1).max(500).optional(),
  error: z.string().trim().min(1).max(500).optional(),
  message: z.string().trim().min(1).max(500).optional(),
  note: z.string().trim().min(1).max(500).optional(),
  quality_score: z.number().min(0).max(100).optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  review_note: z.string().trim().min(1).max(500).optional(),
  reviewNote: z.string().trim().min(1).max(500).optional(),
}).refine(
  data => Boolean(
    (data.episode_no ?? data.episodeNo) && (data.shot_id ?? data.shotId)
    || data.provider_job_id
    || data.providerJobId
    || data.job_id
    || data.jobId
  ),
  { message: 'callback requires episode_no + shot_id or provider_job_id/job_id' },
);

export const AiComicSeedanceProductionVersionSelectRequestSchema = z.object({
  episode_no: z.number().int().min(1).max(120),
  shot_id: z.string().trim().min(1).max(80),
  version_id: z.string().trim().min(1).max(120),
  note: z.string().trim().min(1).max(500).optional(),
});

export const AiComicSeedanceProductionAutoSelectRequestSchema = z.object({
  min_quality_score: z.number().min(0).max(100).optional(),
  overwrite_manual: z.boolean().optional().default(false),
  note: z.string().trim().min(1).max(500).optional(),
});

export const AiComicSeedanceThumbnailCaptureRequestSchema = z.object({
  dry_run: z.boolean().optional().default(false),
  overwrite: z.boolean().optional().default(false),
  episode_no: z.number().int().min(1).max(120).optional(),
  shot_id: z.string().trim().min(1).max(80).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const AiComicSeedanceCutAssemblyRequestSchema = z.object({
  dry_run: z.boolean().optional().default(false),
  overwrite: z.boolean().optional().default(false),
  episode_no: z.number().int().min(1).max(120).optional(),
  output_filename: z.string().trim().regex(/^[0-9A-Za-z._-]+\.mp4$/).optional(),
  assembly_mode: z.enum(['copy', 'transcode']).optional().default('copy'),
  output_profile: z.enum(['source_copy', 'mp4_h264_1080p', 'mp4_h264_720p']).optional(),
  fps: z.number().int().min(12).max(60).optional(),
  crf: z.number().int().min(14).max(32).optional(),
  preset: z.enum(['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow']).optional(),
});

export const AiComicSeedanceSubtitleExportRequestSchema = z.object({
  episode_no: z.number().int().min(1).max(120).optional(),
  output_filename: z.string().trim().regex(/^[0-9A-Za-z._-]+\.srt$/).optional(),
});

export const AiComicSeedanceSubtitleRenderRequestSchema = z.object({
  dry_run: z.boolean().optional().default(false),
  overwrite: z.boolean().optional().default(false),
  mode: z.enum(['sidecar', 'burn_in']).optional().default('sidecar'),
  episode_no: z.number().int().min(1).max(120).optional(),
  output_filename: z.string().trim().regex(/^[0-9A-Za-z._-]+\.(srt|mp4)$/).optional(),
  input_video_path: z.string().trim().min(1).max(500).optional(),
});

const AiComicSeedanceAudioKindSchema = z.enum(['dialogue', 'narration', 'music', 'sound_effect', 'ambient']);

export const AiComicSeedanceAudioLibraryUpdateRequestSchema = z.object({
  items: z.array(z.object({
    asset_id: z.string().trim().min(1).max(120).optional(),
    kind: AiComicSeedanceAudioKindSchema,
    label: z.string().trim().min(1).max(120),
    file_url: z.string().trim().min(1).max(1000).optional(),
    file_id: z.string().trim().min(1).max(160).optional(),
    duration_sec: z.number().min(0.1).max(7200).optional(),
    license_note: z.string().trim().max(500).optional(),
    loopable: z.boolean().optional(),
    bpm: z.number().min(20).max(260).optional(),
    mood_tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  })).min(1).max(300),
});

export const AiComicSeedanceAudioMixRequestSchema = z.object({
  dry_run: z.boolean().optional().default(true),
  overwrite: z.boolean().optional().default(false),
  episode_no: z.number().int().min(1).max(120).optional(),
  input_video_path: z.string().trim().min(1).max(500).optional(),
  output_filename: z.string().trim().regex(/^[0-9A-Za-z._-]+\.mp4$/).optional(),
  audio_profile: z.enum(['balanced_dialogue', 'music_forward', 'ambient_soft']).optional().default('balanced_dialogue'),
  include_original_audio: z.boolean().optional().default(false),
  original_audio_volume_db: z.number().min(-48).max(12).optional().default(0),
});

export const AiComicSeedanceTitleCardRenderRequestSchema = z.object({
  dry_run: z.boolean().optional().default(true),
  overwrite: z.boolean().optional().default(false),
  episode_no: z.number().int().min(1).max(120).optional(),
  output_profile: z.enum(['mp4_h264_1080p', 'mp4_h264_720p']).optional().default('mp4_h264_1080p'),
  font_path: z.string().trim().min(1).max(500).optional(),
});

export const AiComicSeedanceFinalDeliveryRequestSchema = z.object({
  dry_run: z.boolean().optional().default(true),
  overwrite: z.boolean().optional().default(false),
  include_subtitles: z.boolean().optional().default(true),
  include_audio_mix: z.boolean().optional().default(true),
  include_title_cards: z.boolean().optional().default(true),
  missing_dependency_mode: z.enum(['strict', 'tolerant']).optional().default('strict'),
  allow_open_final_reviews: z.boolean().optional().default(false),
  resolve_reassemble_reviews: z.boolean().optional().default(false),
  resolved_note: z.string().trim().min(1).max(500).optional(),
  output_profile: z.enum(['mp4_h264_1080p', 'mp4_h264_720p', 'source_copy']).optional().default('mp4_h264_1080p'),
  output_filename: z.string().trim().regex(/^[0-9A-Za-z._-]+\.mp4$/).optional(),
});

const AiComicSeedanceReviewTargetTypeSchema = z.enum(['shot', 'cut', 'final', 'subtitle', 'audio', 'title_card']);
const AiComicSeedanceReviewSeveritySchema = z.enum(['blocking', 'major', 'minor', 'note']);
const AiComicSeedanceReviewIssueTypeSchema = z.enum([
  'visual',
  'continuity',
  'subtitle',
  'audio',
  'pacing',
  'title_card',
  'technical',
  'compliance',
  'other',
]);
const AiComicSeedanceReviewRepairActionSchema = z.enum([
  'redo_shot',
  'reselect_version',
  'revise_subtitle',
  'adjust_audio',
  'revise_title_card',
  'reassemble_final',
  'manual_review',
]);

export const AiComicSeedanceReviewAddRequestSchema = z.object({
  target_type: AiComicSeedanceReviewTargetTypeSchema,
  target_id: z.string().trim().min(1).max(160).optional(),
  episode_no: z.number().int().min(1).max(120).optional(),
  shot_id: z.string().trim().min(1).max(80).optional(),
  severity: AiComicSeedanceReviewSeveritySchema,
  issue_type: AiComicSeedanceReviewIssueTypeSchema,
  note: z.string().trim().min(1).max(1000),
  repair_action: AiComicSeedanceReviewRepairActionSchema.optional(),
  created_by: z.string().trim().min(1).max(120).optional(),
}).refine(
  data => data.target_type !== 'shot' || Boolean(data.shot_id || data.target_id),
  { message: 'shot review requires shot_id or target_id' },
);

export const AiComicSeedanceReviewResolveRequestSchema = z.object({
  review_id: z.string().trim().min(1).max(120),
  status: z.enum(['resolved', 'wont_fix']).optional().default('resolved'),
  resolved_note: z.string().trim().min(1).max(1000).optional(),
});

export const AiComicSeriesLedgerRebuildRequestSchema = z.object({
  from_episode_no: z.number().int().min(1).max(120).optional().default(1),
});

const AiComicSeriesMemoryRecallControlsSchema = z.object({
  locked_memory_ids: z.array(z.string().min(1)).max(30).optional(),
  excluded_memory_ids: z.array(z.string().min(1)).max(80).optional(),
}).optional();

export const AiComicEpisodeContextPreviewRequestSchema = z.object({
  series_plan: AiComicSeriesPlanSchema,
  episode_no: z.number().int().min(1).max(120),
  series_project_id: AiComicSeriesProjectIdValueSchema.optional(),
  narrative_pattern_ids: z.array(NarrativePatternIdSchema).max(6).optional(),
  memory_recall_controls: AiComicSeriesMemoryRecallControlsSchema,
}).refine(
  data => data.episode_no <= data.series_plan.episode_count,
  { message: 'episode_no cannot exceed series_plan.episode_count', path: ['episode_no'] },
);

export const AiComicEpisodeGenerateRequestSchema = z.object({
  series_plan: AiComicSeriesPlanSchema,
  episode_no: z.number().int().min(1).max(120),
  series_project_id: AiComicSeriesProjectIdValueSchema.optional(),
  model_profile_id: z.string().optional(),
  output_gears_segments: z.boolean().optional().default(true),
  knowledge_pack: AiComicKnowledgePackSchema.optional(),
  narrative_pattern_ids: z.array(NarrativePatternIdSchema).max(6).optional(),
  memory_recall_controls: AiComicSeriesMemoryRecallControlsSchema,
  auto_audit_continuity: z.boolean().optional().default(true),
  auto_repair_episode: z.boolean().optional().default(false),
}).refine(
  data => data.episode_no <= data.series_plan.episode_count,
  { message: 'episode_no cannot exceed series_plan.episode_count', path: ['episode_no'] },
);
