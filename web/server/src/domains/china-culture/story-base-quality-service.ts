import type {
  MaterialSufficiencyReport,
  MemoryMosaicStorySeed,
  StoryGenerateResult,
  StoryQualityReport,
  StoryStructureType,
  VideoType,
} from '@shared/types.js';
import { attachCreationQualityContext } from '../../platform/story-quality-evaluation.js';
import type { StoryAssembly } from '../../platform/story-model-output-merge.js';
import { validateDramaticStory } from '../../services/dramatic-story.js';
import { validateMemoryMosaicStory } from '../../services/memory-mosaic-service.js';

export function validateChinaCultureStoryAssemblyBaseQuality(input: {
  storyResult: StoryAssembly;
  storyStructure: StoryStructureType;
  memoryMosaicSeed?: MemoryMosaicStorySeed;
  selectedEvent?: string;
  videoType: VideoType;
  truthMode: StoryGenerateResult['truth_mode'];
  materialSufficiency: MaterialSufficiencyReport;
}): StoryQualityReport {
  const baseReport = input.storyStructure === 'memory_mosaic_biography' && input.memoryMosaicSeed
    ? validateMemoryMosaicStory({
        full_text: input.storyResult.full_text,
        scene_breakdown: input.storyResult.scene_breakdown,
        memory_seed: input.memoryMosaicSeed,
      })
    : validateDramaticStory({
        full_text: input.storyResult.full_text,
        scene_breakdown: input.storyResult.scene_breakdown,
        title: input.storyResult.title,
        selectedEvent: input.selectedEvent,
        videoType: input.videoType,
      });

  return attachCreationQualityContext(
    baseReport,
    input.truthMode,
    input.materialSufficiency,
  );
}
