// web/shared/schemas.ts — Zod validation schemas for Web API

import { z } from 'zod';

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

export const KnowledgeDomainSchema = z.enum([
  'core_china_culture',
  'era_setting',
  'regional_culture',
  'folklore_zhiyi',
  'gears_asset',
]);

export const KnowledgeEntryRoleSchema = z.enum([
  'core_entry',
  'setting_pack',
  'motif_pack',
  'asset_pack',
  'regional_pack',
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
]);

export const KnowledgeAssetSplitSchema = z.object({
  characters: z.array(z.string()),
  scenes: z.array(z.string()),
  character_props: z.array(z.string()),
  scene_props: z.array(z.string()),
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
  knowledge_pack: z.object({
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
  }).optional(),
  // New fields for story structure and creative reference (Phase 5)
  story_structure: StoryStructureTypeSchema.optional(),
  creative_reference_ids: z.array(z.string()).optional(),
  style_pack_ids: z.array(z.string()).optional(),
  reference_strength: ReferenceStrengthSchema.optional(),
  genre_strictness: GenreStrictnessSchema.optional().default('balanced'),
  auto_repair: z.boolean().optional().default(false),
  story_priority: StoryGenerationPrioritySchema.optional().default('balanced'),
}).refine(
  (data) => data.entry_name || data.knowledge_pack || data.outline,
  { message: 'At least one of entry_name, knowledge_pack, or outline must be provided', path: ['entry_name'] },
).refine(
  (data) => data.generation_type || data.video_type,
  { message: 'Either generation_type or video_type must be provided', path: ['video_type'] },
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
});

// ---------------------------------------------------------------------------
// Multi-entry match request
// ---------------------------------------------------------------------------

export const MultiMatchRequestSchema = z.object({
  outline: z.string().min(1, 'outline cannot be empty'),
  knowledge_needs: z.array(KnowledgeNeedSchema).min(1, 'at least one knowledge_need required'),
  limit_per_need: z.number().int().min(1).max(20).optional().default(5),
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
  })),
});

export const AiComicSeriesProjectSaveRequestSchema = z.object({
  series_project_id: AiComicSeriesProjectIdValueSchema.optional(),
  plan: AiComicSeriesPlanSchema,
  generated_episode_story_ids: z.record(z.string(), StoryIdValueSchema).optional(),
  continuity_ledger: AiComicContinuityLedgerSchema.optional(),
});

export const AiComicSeriesLedgerRebuildRequestSchema = z.object({
  from_episode_no: z.number().int().min(1).max(120).optional().default(1),
});

export const AiComicEpisodeGenerateRequestSchema = z.object({
  series_plan: AiComicSeriesPlanSchema,
  episode_no: z.number().int().min(1).max(120),
  series_project_id: AiComicSeriesProjectIdValueSchema.optional(),
  model_profile_id: z.string().optional(),
  output_gears_segments: z.boolean().optional().default(true),
  knowledge_pack: AiComicKnowledgePackSchema.optional(),
  auto_audit_continuity: z.boolean().optional().default(true),
  auto_repair_episode: z.boolean().optional().default(false),
}).refine(
  data => data.episode_no <= data.series_plan.episode_count,
  { message: 'episode_no cannot exceed series_plan.episode_count', path: ['episode_no'] },
);
