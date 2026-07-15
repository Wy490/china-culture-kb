import type {
  GearsDeliveryPackage,
  MaterialSufficiencyReport,
  NarrativePatternId,
  StoryBlueprint,
  StoryGenerateResult,
  StoryQualityReport,
} from '@shared/types.js';
import { validateGenreStoryQuality } from '../services/genre-quality-service.js';
import { enrichStoryQualityReport } from '../services/quality-workflow-service.js';

export function attachCreationQualityContext(
  report: StoryQualityReport,
  truthMode: StoryGenerateResult['truth_mode'],
  materialSufficiency: MaterialSufficiencyReport,
): StoryQualityReport {
  return {
    ...report,
    truth_mode: truthMode,
    material_sufficiency_report: materialSufficiency,
  };
}

export function evaluateStoryQualityReport(input: {
  story: StoryGenerateResult;
  baseReport: StoryQualityReport;
  blueprint: StoryBlueprint;
  narrativePatternIds: NarrativePatternId[];
  truthMode: StoryGenerateResult['truth_mode'];
  materialSufficiency: MaterialSufficiencyReport;
}): StoryQualityReport {
  let report: StoryQualityReport = validateGenreStoryQuality({
    story: input.story,
    baseReport: input.baseReport,
    blueprint: input.blueprint,
    narrativePatternIds: input.narrativePatternIds,
  });
  report = attachCreationQualityContext(
    report,
    input.truthMode,
    input.materialSufficiency,
  );
  report = enrichStoryQualityReport({
    story: input.story,
    qualityReport: report,
    narrativePatternIds: input.narrativePatternIds,
  });
  return attachCreationQualityContext(
    report,
    input.truthMode,
    input.materialSufficiency,
  );
}

export function enrichStoryQualityWithDelivery(input: {
  story: StoryGenerateResult;
  qualityReport: StoryQualityReport;
  narrativePatternIds: NarrativePatternId[];
  gearsDelivery: GearsDeliveryPackage;
  truthMode: StoryGenerateResult['truth_mode'];
  materialSufficiency: MaterialSufficiencyReport;
}): StoryQualityReport {
  const report = enrichStoryQualityReport({
    story: input.story,
    qualityReport: input.qualityReport,
    narrativePatternIds: input.narrativePatternIds,
    gearsDelivery: input.gearsDelivery,
  });
  return attachCreationQualityContext(
    report,
    input.truthMode,
    input.materialSufficiency,
  );
}
