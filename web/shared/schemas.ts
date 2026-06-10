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

export const ProjectIdParamSchema = z.object({
  projectId: z.string().regex(
    /^\d{8}-story-[0-9a-z]+--[a-z_]+$/,
    'projectId must match format YYYYMMDD-story-{hash36}--{video_type}',
  ),
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
