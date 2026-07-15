/**
 * Domain-neutral Story Agent platform contracts.
 *
 * These interfaces intentionally contain no culture-, police- or
 * adaptation-specific field names. Domain models extend them in types.ts or
 * in a future Domain Pack. `sourceDomain` is optional only so legacy snapshots
 * remain readable; newly created platform resources must persist it.
 */

export interface BaseEntry {
  name: string;
  type: string;
  summary: string;
  keywords: string[];
  sourceDomain?: string;
}

export interface DomainEntryTypeDescriptor {
  name: string;
  description: string;
  recommended_generation_types: string[];
  recommended_video_types: string[];
  recommended_presentation_styles: string[];
}

export interface DomainGenerationTypeDescriptor {
  id: string;
  group: string;
  label: string;
  description: string;
  default_presentation_style: string;
  default_duration: string | number;
  compatible_entry_types: string[];
}

export interface BaseStoryScene {
  scene_id: number;
  title: string;
  duration_sec: number;
  location: string;
  time_of_day: string;
  dramatic_function: string;
  plot: string;
  key_action: string;
  characters: string[];
  visual_prompt: string;
  camera_suggestion: string;
}

export interface BaseGearsSegment {
  segment_id: number;
  source_scene_id: number;
  duration_sec: number;
  panel_count: number;
  script_text: string;
  purpose: string;
  visual_focus: string[];
  /** Required on the exported GEARS v2 subtype; optional on legacy storage. */
  constraint_note?: string[];
}

export interface BaseStory<
  TScene extends BaseStoryScene = BaseStoryScene,
  TSegment extends BaseGearsSegment = BaseGearsSegment,
> {
  storyId: string;
  sourceDomain?: string;
  title: string;
  generation_type: string;
  video_type: string;
  presentation_style: string;
  source_entry: string;
  logline: string;
  full_text: string;
  scene_breakdown: TScene[];
  gears_segments: TSegment[];
  gears_segments_url: string;
  credibility_note: string;
}
