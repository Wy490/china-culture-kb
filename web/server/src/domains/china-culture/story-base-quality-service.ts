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
import { validateStoryFamilyBaseQuality } from '../../services/story-family-quality-service.js';

export function validateChinaCultureStoryAssemblyBaseQuality(input: {
  storyResult: StoryAssembly;
  storyStructure: StoryStructureType;
  memoryMosaicSeed?: MemoryMosaicStorySeed;
  selectedEvent?: string;
  videoType: VideoType;
  truthMode: StoryGenerateResult['truth_mode'];
  materialSufficiency: MaterialSufficiencyReport;
}): StoryQualityReport {
  const baseReport = validateStoryFamilyBaseQuality({
    ...input.storyResult,
    video_type: input.videoType,
    story_structure: input.storyStructure,
    memory_mosaic_seed: input.memoryMosaicSeed,
  }, {
    selectedEvent: input.selectedEvent,
  });

  return attachCreationQualityContext(
    baseReport,
    input.truthMode,
    input.materialSufficiency,
  );
}
