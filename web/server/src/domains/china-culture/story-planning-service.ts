import { success, fail, ErrorCodes } from '@shared/types.js';
import type {
  ApiResponse,
  AvailableEvent,
  GenerationType,
  RecommendedPresentationStyle,
  RecommendedStoryStructure,
  RecommendedType,
  RecommendedVideoType,
  StoryPlanResult,
  SupportedDuration,
} from '@shared/types.js';
import {
  PRESENTATION_STYLE_CONFIG,
  STORY_STRUCTURE_CONFIG,
  VIDEO_TYPE_CONFIG,
} from '@shared/types.js';
import { conflictScore } from '../../services/dramatic-story.js';
import { recommendNarrativePatternsForEntry } from '../../services/genre-story-profiles.js';
import {
  convertChinaCultureFullEntryDetail as convertFullEntryDetail,
  getChinaCultureFullEntryDetail as mcpGetFullEntryDetail,
} from './knowledge-source-adapter.js';
import {
  buildChinaCulturePlanSupplementNeeds,
  computeChinaCulturePlanningRisks,
} from './planning-rules.js';
import {
  chinaCultureGenerationTypes,
  chinaCultureStoryStructures,
  chinaCultureVideoTypes,
} from './type-routing.js';

export function extractChinaCultureBoldEvents(storyText: string): string[] {
  const events: string[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  const skipFields = ['省份', '地区', '类型', '简介', '故事梗概', '文化意义', '相关地点', '关键词', '来源', '可信度', '核实方法', '待核实点'];
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(storyText)) !== null) {
    const name = match[1].trim();
    if (!skipFields.includes(name)) events.push(name);
  }
  return events;
}

function recommendDuration(entryType: string, eventCount: number): SupportedDuration {
  if (entryType === '历史人物' && eventCount >= 5) return '5分钟';
  if (entryType === '历史人物' && eventCount >= 3) return '3分钟';
  return '1分钟';
}

function recommendEventType(entryType: string): GenerationType {
  return chinaCultureGenerationTypes(entryType)[0] ?? 'character_story';
}

export async function planChinaCultureStory(
  entryName: string,
  originalUserQuery?: string,
): Promise<ApiResponse<StoryPlanResult>> {
  const mcpDetail = await mcpGetFullEntryDetail(entryName);
  if (!mcpDetail) {
    return fail(ErrorCodes.ENTRY_NOT_FOUND, `Entry "${entryName}" not found`);
  }

  const entry = convertFullEntryDetail(mcpDetail);
  const entryType = entry.type;
  const routedTypes = chinaCultureGenerationTypes(entryType);
  const recommendedTypes: RecommendedType[] = routedTypes.map((genType, index) => {
    const reasonMap: Record<string, string> = {
      character_story: `该条目类型"${entryType}"适合以人物/故事为核心的叙事`,
      culture_promo: `该条目类型"${entryType}"适合文化推广展示`,
      scene_short: `该条目类型"${entryType}"适合场景演绎短片`,
    };
    return { generation_type: genType, reason: reasonMap[genType] || `适合${genType}模式`, priority: index + 1 };
  });

  const routedVideoTypes = chinaCultureVideoTypes(entryType);
  const recommendedVideoTypes: RecommendedVideoType[] = routedVideoTypes.map((videoType, index) => {
    const meta = VIDEO_TYPE_CONFIG[videoType];
    const compatible = meta.compatible_entry_types.includes(entryType);
    return {
      video_type: videoType,
      reason: compatible
        ? `"${entryType}"条目适合${meta.label}——${meta.description}`
        : `${meta.label}——${meta.description}（可选）`,
      priority: index + 1,
    };
  });

  const recommendedPresentationStyles: RecommendedPresentationStyle[] = routedVideoTypes.slice(0, 3).map(videoType => {
    const meta = VIDEO_TYPE_CONFIG[videoType];
    const styleMeta = PRESENTATION_STYLE_CONFIG[meta.default_presentation_style];
    return {
      presentation_style: meta.default_presentation_style,
      reason: `${meta.label}默认表现形式: ${styleMeta.label}——${styleMeta.description}`,
    };
  });

  const boldEvents = extractChinaCultureBoldEvents(entry.story);
  const availableEvents: AvailableEvent[] = boldEvents.length > 0
    ? boldEvents.map(eventName => ({
        event: eventName,
        conflict_score: Math.max(1, Math.min(10, Math.round(conflictScore(eventName, entry.story) / 2))),
        recommended_duration: recommendDuration(entryType, boldEvents.length),
        recommended_type: recommendEventType(entryType),
        recommended_video_type: routedVideoTypes[0],
      }))
    : [{
        event: '整体故事',
        conflict_score: 1,
        recommended_duration: recommendDuration(entryType, 0),
        recommended_type: recommendEventType(entryType),
        recommended_video_type: routedVideoTypes[0],
      }];

  const routedStoryStructures = chinaCultureStoryStructures(entryType);
  const recommendedStoryStructures: RecommendedStoryStructure[] = routedStoryStructures.map((storyStructure, index) => {
    const meta = STORY_STRUCTURE_CONFIG[storyStructure];
    return {
      story_structure: storyStructure,
      reason: `"${entryType}"条目适合${meta.label}——${meta.description}`,
      priority: index + 1,
    };
  });

  return success({
    entry_name: entryName,
    entry_type: entryType,
    original_user_query: originalUserQuery ?? undefined,
    recommended_types: recommendedTypes,
    recommended_video_types: recommendedVideoTypes,
    recommended_presentation_styles: recommendedPresentationStyles,
    recommended_story_structures: recommendedStoryStructures,
    recommended_narrative_patterns: recommendNarrativePatternsForEntry({
      entry,
      videoTypes: routedVideoTypes,
      originalUserQuery,
    }),
    recommended_supplement_needs: buildChinaCulturePlanSupplementNeeds(entry),
    available_events: availableEvents,
    recommended_duration: recommendDuration(entryType, boldEvents.length),
    cultural_risks: computeChinaCulturePlanningRisks(entry),
  });
}
