import type {
  StoryGenerateResult,
  StoryReferenceBaselineComparison,
  StoryReferenceBaselineQualityDimension,
} from '@shared/types.js';

type ComparableStory = Pick<
  StoryGenerateResult,
  | 'storyId'
  | 'source_entry'
  | 'original_user_query'
  | 'video_type'
  | 'presentation_style'
  | 'story_structure'
  | 'model_profile_id'
  | 'story_blueprint'
  | 'creation_use_case'
  | 'truth_mode'
  | 'client_type'
  | 'target_audience'
  | 'communication_goal'
  | 'reference_generation_recipe'
  | 'reference_trace'
  | 'quality_report'
>;

type QualityComparisonStory = Pick<
  StoryGenerateResult,
  'storyId' | 'quality_report'
>;

export interface ReferenceBaselineCompatibilityInput {
  baseline: ComparableStory;
  expected: {
    source_entry: string;
    original_user_query?: string;
    video_type: StoryGenerateResult['video_type'];
    presentation_style: StoryGenerateResult['presentation_style'];
    story_structure: StoryGenerateResult['story_structure'];
    model_profile_id: string;
    central_event: string;
    target_duration: NonNullable<StoryGenerateResult['story_blueprint']>['target_duration'];
    creation_use_case: StoryGenerateResult['creation_use_case'];
    truth_mode: StoryGenerateResult['truth_mode'];
    client_type?: string;
    target_audience?: string;
    communication_goal?: string;
  };
}

export function validateReferenceBaselineCompatibility(
  input: ReferenceBaselineCompatibilityInput,
): string[] {
  const baseline = input.baseline;
  const expected = input.expected;
  const mismatches: string[] = [];
  if (baseline.source_entry !== expected.source_entry) mismatches.push('source_entry');
  if (baseline.video_type !== expected.video_type) mismatches.push('video_type');
  if (baseline.presentation_style !== expected.presentation_style) {
    mismatches.push('presentation_style');
  }
  if (baseline.story_structure !== expected.story_structure) mismatches.push('story_structure');
  if (baseline.model_profile_id !== expected.model_profile_id) mismatches.push('model_profile_id');
  if (baseline.story_blueprint?.central_event !== expected.central_event) {
    mismatches.push('central_event');
  }
  if (baseline.story_blueprint?.target_duration !== expected.target_duration) {
    mismatches.push('target_duration');
  }
  if (baseline.creation_use_case !== expected.creation_use_case) {
    mismatches.push('creation_use_case');
  }
  if (baseline.truth_mode !== expected.truth_mode) mismatches.push('truth_mode');
  if (normalizeInput(baseline.client_type) !== normalizeInput(expected.client_type)) {
    mismatches.push('client_type');
  }
  if (
    normalizeInput(baseline.target_audience)
    !== normalizeInput(expected.target_audience)
  ) {
    mismatches.push('target_audience');
  }
  if (
    normalizeInput(baseline.communication_goal)
    !== normalizeInput(expected.communication_goal)
  ) {
    mismatches.push('communication_goal');
  }
  if (!baseline.quality_report) mismatches.push('baseline_machine_quality_available');
  if (
    normalizeInput(baseline.original_user_query)
    !== normalizeInput(expected.original_user_query)
  ) {
    mismatches.push('original_user_query');
  }
  if (baseline.reference_trace?.some(trace => (
    trace.application_status === 'external_prompt_injected'
  ))) {
    mismatches.push('baseline_reference_free');
  }
  if (baseline.reference_generation_recipe) {
    mismatches.push('baseline_recipe_free');
  }
  return mismatches;
}

export function buildStoryReferenceBaselineComparison(input: {
  baseline: QualityComparisonStory;
  referenceAssisted: QualityComparisonStory;
}): StoryReferenceBaselineComparison {
  const baselineDimensions = machineQualityDimensions(input.baseline);
  const assistedDimensions = machineQualityDimensions(input.referenceAssisted);
  const dimensions: StoryReferenceBaselineQualityDimension[] = [];
  for (const [dimension, baselineScore] of baselineDimensions) {
    const assistedScore = assistedDimensions.get(dimension);
    if (assistedScore === undefined) continue;
    dimensions.push({
      dimension,
      baseline_score: baselineScore,
      reference_assisted_score: assistedScore,
      delta: round(assistedScore - baselineScore),
    });
  }
  const baselineMachineScore = mean(dimensions.map(item => item.baseline_score));
  const referenceAssistedMachineScore = mean(
    dimensions.map(item => item.reference_assisted_score),
  );
  return {
    status: 'completed',
    baseline_story_id: input.baseline.storyId,
    reference_assisted_story_id: input.referenceAssisted.storyId,
    quality_delta: {
      schema_version: 'story-reference-baseline-quality-delta/v1',
      baseline_machine_score: baselineMachineScore,
      reference_assisted_machine_score: referenceAssistedMachineScore,
      aggregate_delta: round(referenceAssistedMachineScore - baselineMachineScore),
      dimensions,
      same_input_verified: true,
      machine_comparison_only: true,
    },
    comparison_credit_granted: false,
  };
}

function machineQualityDimensions(
  story: QualityComparisonStory,
): Map<StoryReferenceBaselineQualityDimension['dimension'], number> {
  const report = story.quality_report;
  const dimensions = new Map<
    StoryReferenceBaselineQualityDimension['dimension'],
    number
  >();
  if (!report) return dimensions;
  const coreChecks = [
    report.hasCentralEvent,
    report.hasConflict,
    report.hasProtagonistChoice,
    report.hasSceneAction,
    report.hasClimax,
    report.hasEndingTheme,
    report.isNotBiographySummary,
  ];
  dimensions.set(
    'core_story_checks',
    round(coreChecks.filter(Boolean).length / coreChecks.length * 100),
  );
  if (typeof report.genre_score === 'number') {
    dimensions.set('genre_score', round(report.genre_score));
  }
  if (typeof report.pattern_quality_report?.pattern_score === 'number') {
    dimensions.set('pattern_score', round(report.pattern_quality_report.pattern_score));
  }
  if (typeof report.outline_coverage_report?.coverage_score === 'number') {
    dimensions.set('outline_coverage', round(report.outline_coverage_report.coverage_score));
  }
  const familyChecks = report.family_quality_report?.checks;
  if (familyChecks?.length) {
    dimensions.set(
      'family_quality_checks',
      round(familyChecks.filter(check => check.status === 'passed').length
        / familyChecks.length * 100),
    );
  }
  if (report.quality_gates) {
    dimensions.set('story_publishable', report.quality_gates.story_publishable ? 100 : 0);
  }
  return dimensions;
}

function normalizeInput(value?: string): string {
  return (value ?? '').trim().replace(/\s+/gu, ' ');
}

function mean(values: number[]): number {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
