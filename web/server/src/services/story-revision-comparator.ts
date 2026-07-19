import type { StoryQualityReport } from '@shared/types.js';

interface StoryRevisionComparable {
  title: string;
  logline: string;
  theme: string;
  full_text: string;
  scene_breakdown: unknown[];
}

const PROTECTED_QUALITY_FIELDS: Array<keyof StoryQualityReport> = [
  'hasCentralEvent',
  'hasConflict',
  'hasProtagonistChoice',
  'hasSceneAction',
  'hasClimax',
  'hasEndingTheme',
  'isNotBiographySummary',
];

export interface StoryRevisionComparison {
  content_changed: boolean;
  target_issue_count_reduced: boolean;
  genre_score_improved: boolean;
  protected_quality_regressed: boolean;
}

export function compareStoryRevision(input: {
  before: StoryRevisionComparable;
  after: StoryRevisionComparable;
  beforeQuality: StoryQualityReport;
  afterQuality: StoryQualityReport;
}): StoryRevisionComparison {
  const beforeIssues = qualityIssueVector(input.beforeQuality);
  const afterIssues = qualityIssueVector(input.afterQuality);
  return {
    content_changed: storyAssemblyFingerprint(input.before) !== storyAssemblyFingerprint(input.after),
    target_issue_count_reduced: afterIssues.size < beforeIssues.size
      && [...beforeIssues].some(issue => !afterIssues.has(issue)),
    genre_score_improved: (input.afterQuality.genre_score ?? 0) > (input.beforeQuality.genre_score ?? 0),
    protected_quality_regressed: PROTECTED_QUALITY_FIELDS.some(field => input.beforeQuality[field] === true && input.afterQuality[field] !== true),
  };
}

function storyAssemblyFingerprint(assembly: StoryRevisionComparable): string {
  return JSON.stringify({
    title: assembly.title,
    logline: assembly.logline,
    theme: assembly.theme,
    full_text: assembly.full_text,
    scene_breakdown: assembly.scene_breakdown,
  });
}

function qualityIssueVector(report: StoryQualityReport): Set<string> {
  return new Set([
    ...(report.issues ?? []).map(issue => `issue:${issue}`),
    ...(report.missing_required_elements ?? []).map(issue => `missing:${issue}`),
    ...(report.weak_beats ?? []).map(issue => `weak:${issue}`),
    ...(report.forbidden_patterns_found ?? []).map(issue => `forbidden:${issue}`),
  ]);
}
