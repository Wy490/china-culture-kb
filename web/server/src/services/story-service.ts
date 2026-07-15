// Compatibility facade for the legacy Story service import path.
export {
  generateAndStoreChinaCultureStory as generateAndStoreStory,
} from '../domains/china-culture/story-generation-service.js';
export { getStory, listStories } from '../platform/story-read-service.js';
export {
  getGearsDeliveryPackage,
  getGearsSegments,
  getSeedancePromptPackage,
  updateGearsDeliveryMarkdown,
  updateGearsVideoReady,
} from '../platform/story-delivery-service.js';
export {
  isModelSceneBreakdownCompatible,
  mergeCharacterHintsIntoStoryResult,
  mergeModelOutputOntoLocalSkeleton,
} from '../platform/story-model-output-merge.js';
