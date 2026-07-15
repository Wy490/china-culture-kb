import type {
  GearsSegment,
  PanelCount,
  PresentationStyle,
  StoryScene,
  VideoType,
} from '@shared/types.js';

const PANEL_COUNT_BY_DURATION: Record<number, PanelCount> = {
  12: 6, 15: 6, 20: 6, 25: 8, 30: 9, 36: 10, 43: 10, 45: 10,
  50: 10, 60: 12, 67: 12, 69: 12, 75: 12, 80: 12, 86: 12, 90: 12,
  96: 12, 100: 12, 109: 12, 113: 12, 120: 12,
};

export function buildPlatformGearsSegmentsFromScenes(
  scenes: StoryScene[],
  videoType: VideoType,
  presentationStyle: PresentationStyle,
): GearsSegment[] {
  return scenes.map((scene) => {
    const panelCount = PANEL_COUNT_BY_DURATION[scene.duration_sec] ?? 6;
    const scriptText = `【${scene.dramatic_function}】${scene.location}，${scene.time_of_day}。${scene.visual_prompt}。${scene.key_action}——${scene.title}。${scene.camera_suggestion}。`;
    const visualFocus = [
      scene.location,
      ...scene.visual_prompt.split(/[，、。]/).filter(value => value.length > 1 && value.length < 8).slice(0, 2),
    ];
    const segmentPromptHint = [
      scene.visual_prompt,
      scene.camera_suggestion,
      scene.characters?.length ? `主体：${scene.characters.join('、')}` : '',
      `动作：${scene.key_action}`,
    ].filter(Boolean).join('；');

    return {
      segment_id: scene.scene_id,
      source_scene_id: scene.scene_id,
      duration_sec: scene.duration_sec,
      panel_count: panelCount,
      script_text: scriptText,
      purpose: scene.dramatic_function,
      visual_focus: visualFocus.slice(0, 3),
      cultural_constraints: scene.cultural_note ? [scene.cultural_note] : [],
      video_type: videoType,
      presentation_style: presentationStyle,
      segment_prompt_hint: segmentPromptHint,
    };
  });
}
