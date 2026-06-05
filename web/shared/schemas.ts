// web/shared/schemas.ts — Zod validation schemas for Web API

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Generation type (3 modes)
// ---------------------------------------------------------------------------

export const GenerationTypeSchema = z.enum([
  'character_story',
  'culture_promo',
  'scene_short',
]);

// ---------------------------------------------------------------------------
// Duration & panel count
// ---------------------------------------------------------------------------

export const DurationSchema = z.enum(['30秒', '1分钟', '3分钟', '5分钟']);

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
});

// ---------------------------------------------------------------------------
// Story generate request
// ---------------------------------------------------------------------------

export const StoryGenerateRequestSchema = z.object({
  entry_name: z.string().min(1, 'entry_name cannot be empty'),
  generation_type: GenerationTypeSchema,
  selected_event: z.string().optional(),
  target_video_duration: DurationSchema.optional(),
  tone: z.string().optional(),
  output_gears_segments: z.boolean().optional().default(true),
});

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
// Story ID param (path param)
// ---------------------------------------------------------------------------

// storyId format: YYYYMMDD-story-{hash36}
// Example: 20260603-story-abc123def456ghi789jkl012mno345pqr
// The hash36 part uses base-36 characters (0-9, a-z) and is variable length
export const StoryIdParamSchema = z.string().regex(
  /^\d{8}-story-[0-9a-z]+$/,
  'storyId must match format YYYYMMDD-story-{hash36}',
);