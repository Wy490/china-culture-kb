import type {
  EntryDetail,
  KnowledgePack,
  MemoryMosaicStorySeed,
  PresentationStyle,
  ReferenceTrace,
  StoryStructureType,
  SupportedDuration,
  VideoType,
} from '@shared/types.js';
import type { StoryAssembly } from '../../platform/story-model-output-merge.js';
import { generateDramaticContent } from '../../services/dramatic-story.js';
import {
  buildMemoryMosaicSeed,
  generateMemoryMosaicContent,
} from '../../services/memory-mosaic-service.js';

export interface ChinaCultureLocalStoryGenerationSuccess {
  ok: true;
  storyResult: StoryAssembly;
  memoryMosaicSeed?: MemoryMosaicStorySeed;
  referenceTrace?: ReferenceTrace[];
}

export interface ChinaCultureLocalStoryGenerationFailure {
  ok: false;
  reason: 'memory_mosaic_witnesses_missing';
  message: string;
}

export type ChinaCultureLocalStoryGenerationResult =
  | ChinaCultureLocalStoryGenerationSuccess
  | ChinaCultureLocalStoryGenerationFailure;

export function generateChinaCultureLocalStoryAssembly(input: {
  entry: EntryDetail;
  centralEvent: string;
  videoType: VideoType;
  presentationStyle: PresentationStyle;
  storyStructure: StoryStructureType;
  targetDuration: SupportedDuration;
  tone: string;
  knowledgePack?: KnowledgePack;
  originalUserQuery?: string;
  stylePackIds?: string[];
}): ChinaCultureLocalStoryGenerationResult {
  if (input.storyStructure === 'memory_mosaic_biography') {
    const memoryMosaicSeed = buildMemoryMosaicSeed(
      input.entry,
      input.centralEvent,
      input.knowledgePack,
    );
    if (memoryMosaicSeed.witnesses.length === 0) {
      return {
        ok: false,
        reason: 'memory_mosaic_witnesses_missing',
        message: '回忆拼图结构需要至少一位可从资料中识别的见证人物，请补充人物关系或改用其他故事结构',
      };
    }
    const storyResult = generateMemoryMosaicContent({
      entry: input.entry,
      centralEvent: input.centralEvent,
      videoType: input.videoType,
      presentationStyle: input.presentationStyle,
      targetDuration: input.targetDuration,
      tone: input.tone,
      memorySeed: memoryMosaicSeed,
      knowledgePack: input.knowledgePack,
      originalUserQuery: input.originalUserQuery,
    });
    const appliedRules = [
      '用物件开场',
      '用见证人回忆推进',
      '结尾呼应物件',
      `${input.storyStructure}结构规则`,
    ];
    const referenceTrace = input.stylePackIds?.length
      ? input.stylePackIds.map(stylePackId => ({
          style_pack_id: stylePackId,
          applied_rules: appliedRules,
          source_story_structure: input.storyStructure,
        }))
      : [{
          applied_rules: appliedRules,
          source_story_structure: input.storyStructure,
        }];

    return { ok: true, storyResult, memoryMosaicSeed, referenceTrace };
  }

  const storyResult = generateDramaticContent({
    entry: input.entry,
    centralEvent: input.centralEvent,
    videoType: input.videoType,
    presentationStyle: input.presentationStyle,
    targetDuration: input.targetDuration,
    tone: input.tone,
    knowledgePack: input.knowledgePack,
    originalUserQuery: input.originalUserQuery,
  });
  const referenceTrace = input.stylePackIds?.length
    ? input.stylePackIds.map(stylePackId => ({
        style_pack_id: stylePackId,
        applied_rules: [
          `Using ${input.storyStructure} structure with ${input.videoType}/${input.presentationStyle}`,
        ],
        source_story_structure: input.storyStructure,
      }))
    : undefined;

  return { ok: true, storyResult, referenceTrace };
}
