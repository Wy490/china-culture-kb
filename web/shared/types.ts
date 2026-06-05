// web/shared/types.ts — Web API type definitions (independent, NOT reusing MCP types)

// ---------------------------------------------------------------------------
// Generation type (3 modes)
// ---------------------------------------------------------------------------

export type GenerationType = 'character_story' | 'culture_promo' | 'scene_short';

// ---------------------------------------------------------------------------
// Duration & panel count
// ---------------------------------------------------------------------------

export type SupportedDuration = '30秒' | '1分钟' | '3分钟' | '5分钟';

export type PanelCount = 4 | 6 | 8 | 9 | 10 | 12;

// ---------------------------------------------------------------------------
// Unified API response
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  ok: boolean;
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export const ErrorCodes = {
  ENTRY_NOT_FOUND: 'ENTRY_NOT_FOUND',
  INVALID_GENERATION_TYPE: 'INVALID_GENERATION_TYPE',
  INVALID_DURATION: 'INVALID_DURATION',
  STORY_GENERATION_FAILED: 'STORY_GENERATION_FAILED',
  STORY_NOT_FOUND: 'STORY_NOT_FOUND',
  GEARS_SEGMENTS_NOT_FOUND: 'GEARS_SEGMENTS_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

export function success<T>(data: T): ApiResponse<T> {
  return { ok: true, data, error: null };
}

export function fail<T = never>(
  code: ErrorCode,
  message: string,
  details?: unknown,
): ApiResponse<T> {
  return { ok: false, data: null, error: { code, message, details } };
}

// ---------------------------------------------------------------------------
// Story plan (preview recommendation)
// ---------------------------------------------------------------------------

export interface StoryPlanRequest {
  entry_name: string;
}

export interface RecommendedType {
  generation_type: GenerationType;
  reason: string;
  priority: number;
}

export interface AvailableEvent {
  event: string;
  conflict_score: number;
  recommended_duration: SupportedDuration;
  recommended_type: GenerationType;
}

export interface StoryPlanResult {
  entry_name: string;
  entry_type: string;
  recommended_types: RecommendedType[];
  available_events: AvailableEvent[];
  recommended_duration: SupportedDuration;
  cultural_risks: string[];
}

// ---------------------------------------------------------------------------
// Story generate
// ---------------------------------------------------------------------------

export interface StoryGenerateRequest {
  entry_name: string;
  generation_type: GenerationType;
  selected_event?: string;
  target_video_duration?: SupportedDuration;
  tone?: string;
  output_gears_segments?: boolean; // default true
}

// ---------------------------------------------------------------------------
// Story sub-structures
// ---------------------------------------------------------------------------

export interface StoryCharacter {
  name: string;
  role: string;
  description: string;
  arc?: string;
}

export interface ActBeat {
  act: number;
  beat: string;
  scene_ids: number[];
  purpose: string;
}

export interface ProtagonistArc {
  starting_state: string;
  turning_point: string;
  resolution: string;
}

export interface StoryScene {
  scene_id: number;
  location: string;
  duration_sec: number;
  description: string;
  key_action: string;
  characters: string[];
}

// ---------------------------------------------------------------------------
// GEARS segment
// ---------------------------------------------------------------------------

export interface GearsSegment {
  segment_id: number;
  source_scene_id: number;
  duration_sec: number;
  panel_count: PanelCount;
  script_text: string;
  purpose: string;
  visual_focus: string[];
  cultural_constraints: string[];
}

export interface GearsSegmentsResponse {
  schema_version: string;
  storyId: string;
  title: string;
  total_duration_sec: number;
  segments: GearsSegment[];
}

// ---------------------------------------------------------------------------
// Story generate result (full output)
// ---------------------------------------------------------------------------

export interface StoryGenerateResult {
  storyId: string;
  title: string;
  generation_type: GenerationType;
  source_entry: string;
  logline: string;
  theme: string;
  full_text: string;
  scene_breakdown: StoryScene[];
  gears_segments: GearsSegment[];
  gears_segments_url: string;
  cultural_constraints: string[];
  credibility_note: string;
  // Type-specific optional fields — character_story
  characters?: StoryCharacter[];
  act_structure?: ActBeat[];
  protagonist_arc?: ProtagonistArc[];
  // Type-specific optional fields — culture_promo
  visual_symbols?: string[];
  craft_or_ritual_process?: string;
  modern_connection?: string;
  // Type-specific optional fields — scene_short
  spatial_identity?: string;
  visual_route?: string[];
  time_layer?: string;
}

// ---------------------------------------------------------------------------
// Entry search & detail
// ---------------------------------------------------------------------------

export interface EntrySearchResult {
  name: string;
  province: string;
  region: string;
  type: string;
  summary: string;
  keywords: string[];
  credibility: string;
}

export interface EntryDetail {
  name: string;
  province: string;
  region: string;
  type: string;
  summary: string;
  story: string;
  culturalSignificance: string;
  relatedLocations: Array<{ name: string; description: string }>;
  keywords: string[];
  sources: string[];
  credibility: string;
  verificationMethod?: string;
  unverifiedPoints: string[];
}

// ---------------------------------------------------------------------------
// System info
// ---------------------------------------------------------------------------

export interface ProvinceInfo {
  name: string;
  entry_count: number;
}

export interface TypeInfo {
  name: string;
  recommended_generation_types: GenerationType[];
  description: string;
}