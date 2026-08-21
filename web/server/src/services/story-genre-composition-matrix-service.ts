import type {
  CreationUseCase,
  CulturalStorySourceKind,
  EntryDetail,
  PresentationStyle,
  SupportedDuration,
  TruthMode,
  VideoType,
} from '@shared/types.js';
import { generateChinaCultureLocalStoryAssembly } from '../domains/china-culture/story-local-generation-service.js';
import {
  EXPANDED_NARRATIVE_PATTERN_IDS,
  NARRATIVE_PATTERN_LIBRARY,
} from './narrative-pattern-library.js';
import { resolveGenreStoryMatrix } from './genre-story-profiles.js';
import { buildStoryGenreComposition } from './story-genre-composition-service.js';

const SOURCE_KINDS = [
  'myth',
  'folk_legend',
  'historical_event',
  'historical_figure',
  'local_anecdote',
  'classic_literature',
  'heritage_memory',
  'user_original',
] as const satisfies readonly CulturalStorySourceKind[];

const SOURCE_LABELS: Record<CulturalStorySourceKind, string> = {
  myth: '神话规则',
  folk_legend: '民间传说',
  historical_event: '历史事件',
  historical_figure: '历史人物',
  local_anecdote: '地方掌故',
  classic_literature: '经典文本',
  heritage_memory: '非遗记忆',
  user_original: '用户原创',
};

type ExpandedPatternId = typeof EXPANDED_NARRATIVE_PATTERN_IDS[number];

const SECONDARY_BY_PRIMARY: Record<ExpandedPatternId, ExpandedPatternId> = {
  archaeological_mystery_expedition: 'team_heist_operation',
  clan_legacy_conspiracy: 'family_saga_generations',
  fair_play_detective: 'folk_supernatural_investigation',
  mythic_voyage_homecoming: 'road_companion_quest',
  historical_faction_epic: 'war_strategy_campaign',
  mythic_hero_quest: 'survival_expedition',
  folk_supernatural_investigation: 'fair_play_detective',
  survival_expedition: 'mythic_hero_quest',
  conspiracy_puzzle_thriller: 'courtroom_case_procedural',
  courtroom_case_procedural: 'conspiracy_puzzle_thriller',
  team_heist_operation: 'archaeological_mystery_expedition',
  tragic_romance_choice: 'folk_satirical_comedy',
  family_saga_generations: 'clan_legacy_conspiracy',
  road_companion_quest: 'mythic_voyage_homecoming',
  war_strategy_campaign: 'historical_faction_epic',
  folk_satirical_comedy: 'tragic_romance_choice',
};

const MIXED_SOURCE_PAIRS: Array<[CulturalStorySourceKind, CulturalStorySourceKind]> = [
  ['myth', 'folk_legend'],
  ['historical_event', 'historical_figure'],
  ['local_anecdote', 'heritage_memory'],
  ['classic_literature', 'user_original'],
  ['myth', 'historical_event'],
  ['folk_legend', 'local_anecdote'],
  ['historical_figure', 'classic_literature'],
  ['heritage_memory', 'user_original'],
];

const MATRIX_DURATIONS = ['30秒', '1分钟', '3分钟'] as const satisfies readonly SupportedDuration[];
const DURATION_SECONDS: Record<typeof MATRIX_DURATIONS[number], number> = {
  '30秒': 30,
  '1分钟': 60,
  '3分钟': 180,
};

interface CompatibleVideoTypeProfile {
  video_type: VideoType;
  presentation_style: PresentationStyle;
  source_kinds: CulturalStorySourceKind[];
  creation_use_case: CreationUseCase;
  truth_mode: TruthMode;
  primary_pattern_id: ExpandedPatternId;
  secondary_pattern_id: ExpandedPatternId;
}

const COMPATIBLE_VIDEO_TYPE_PROFILES: CompatibleVideoTypeProfile[] = [
  {
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    source_kinds: ['user_original'],
    creation_use_case: 'original_ai_comic',
    truth_mode: 'inspired_by_material',
    primary_pattern_id: 'archaeological_mystery_expedition',
    secondary_pattern_id: 'team_heist_operation',
  },
  {
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_kinds: ['historical_figure'],
    creation_use_case: 'institutional_promo',
    truth_mode: 'inspired_by_material',
    primary_pattern_id: 'tragic_romance_choice',
    secondary_pattern_id: 'folk_satirical_comedy',
  },
  {
    video_type: 'historical_drama',
    presentation_style: 'cinematic',
    source_kinds: ['historical_event', 'historical_figure'],
    creation_use_case: 'documentary_short',
    truth_mode: 'inspired_by_material',
    primary_pattern_id: 'historical_faction_epic',
    secondary_pattern_id: 'war_strategy_campaign',
  },
  {
    video_type: 'legend_story',
    presentation_style: 'animation_2d',
    source_kinds: ['myth', 'folk_legend'],
    creation_use_case: 'original_ai_comic',
    truth_mode: 'inspired_by_material',
    primary_pattern_id: 'mythic_voyage_homecoming',
    secondary_pattern_id: 'road_companion_quest',
  },
];

interface MatrixCaseSpec {
  case_id: string;
  suite: 'mechanism_coverage' | 'compatibility_duration';
  source_kinds: CulturalStorySourceKind[];
  creation_use_case: CreationUseCase;
  truth_mode: TruthMode;
  primary_pattern_id: ExpandedPatternId;
  secondary_pattern_id: ExpandedPatternId;
  video_type: VideoType;
  presentation_style: PresentationStyle;
  target_duration: typeof MATRIX_DURATIONS[number];
}

export interface StoryGenreCompositionMatrixCaseResult extends MatrixCaseSpec {
  status: 'passed' | 'failed';
  fusion_status: string;
  warning_ids: string[];
  scene_count: number;
  secondary_scene_ids: number[];
  checks: {
    primary_opening_realized: boolean;
    primary_ending_realized: boolean;
    secondary_realized_once: boolean;
    full_text_synchronized: boolean;
    gears_synchronized: boolean;
    fact_boundary_complete: boolean;
    fiction_boundary_complete: boolean;
    genre_matrix_compatible: boolean;
    secondary_uses_middle_scene: boolean;
    duration_aligned: boolean;
  };
  issues: string[];
}

export interface StoryGenreCompositionMatrixReport {
  schema_version: 'story-genre-composition-matrix/v2';
  generated_at: string;
  status: 'passed' | 'failed';
  summary: {
    case_count: number;
    passed_case_count: number;
    mechanism_coverage_case_count: number;
    compatibility_duration_case_count: number;
    source_kind_coverage: string;
    primary_pattern_coverage: string;
    secondary_pattern_coverage: string;
    mixed_source_case_count: number;
    semantic_tension_rule_count: number;
    compatible_video_type_coverage: string;
    duration_coverage: string;
    video_type_duration_cell_coverage: string;
    capacity_conflict_skeleton_coverage: string;
    capacity_conflict_fail_closed: boolean;
  };
  cases: StoryGenreCompositionMatrixCaseResult[];
  boundaries: {
    external_model_invoked: false;
    human_review_complete: false;
    professional_credit_granted: false;
    real_production_credit_granted: false;
    province_markdown_written: false;
  };
}

function buildCaseSpecs(): MatrixCaseSpec[] {
  const mechanismCoverageCases: MatrixCaseSpec[] = EXPANDED_NARRATIVE_PATTERN_IDS.map((primaryPatternId, index) => ({
    case_id: `composition-${String(index + 1).padStart(2, '0')}-${primaryPatternId}`,
    suite: 'mechanism_coverage',
    source_kinds: index < SOURCE_KINDS.length
      ? [SOURCE_KINDS[index]]
      : [...MIXED_SOURCE_PAIRS[index - SOURCE_KINDS.length]],
    primary_pattern_id: primaryPatternId,
    secondary_pattern_id: SECONDARY_BY_PRIMARY[primaryPatternId],
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    target_duration: '3分钟',
    creation_use_case: 'original_ai_comic',
    truth_mode: 'inspired_by_material',
  }));
  const compatibilityDurationCases: MatrixCaseSpec[] = COMPATIBLE_VIDEO_TYPE_PROFILES.flatMap(profile => (
    MATRIX_DURATIONS.map((targetDuration, durationIndex) => ({
      case_id: `compatibility-${profile.video_type}-${durationIndex + 1}-${targetDuration}`,
      suite: 'compatibility_duration' as const,
      source_kinds: [...profile.source_kinds],
      creation_use_case: profile.creation_use_case,
      truth_mode: profile.truth_mode,
      primary_pattern_id: profile.primary_pattern_id,
      secondary_pattern_id: profile.secondary_pattern_id,
      video_type: profile.video_type,
      presentation_style: profile.presentation_style,
      target_duration: targetDuration,
    }))
  ));
  return [...mechanismCoverageCases, ...compatibilityDurationCases];
}

function fixtureEntry(spec: MatrixCaseSpec): EntryDetail {
  const sourceLabel = spec.source_kinds.map(kind => SOURCE_LABELS[kind]).join('与');
  return {
    name: `${sourceLabel}组合压力样本`,
    province: '虚构测试区',
    region: '组合矩阵测试空间',
    type: sourceLabel,
    summary: `${sourceLabel}围绕一件待核文化物件、一次人物选择和一项公共责任展开。`,
    story: '测试材料明确区分可核线索、口述版本与原创补足；人物必须通过行动保护文化证据，并承担选择后果。',
    culturalSignificance: '仅用于机器组合合同压力测试，不构成真实文化事实或人工审校结论。',
    relatedLocations: [{ name: '测试驿站', description: '可见行动发生的虚构测试空间。' }],
    keywords: [...spec.source_kinds.map(kind => SOURCE_LABELS[kind]), '文化物件', '公共责任'],
    sources: ['fixture://story-genre-composition-matrix'],
    credibility: spec.source_kinds.includes('user_original') ? '用户提供' : '待核实',
    verificationMethod: '本矩阵只验证机器生成合同，真实事实需另行来源核验。',
    unverifiedPoints: ['人物、对白、行动与因果连接均为测试性戏剧化补足。'],
  };
}

function evaluateCase(spec: MatrixCaseSpec): StoryGenreCompositionMatrixCaseResult {
  const entry = fixtureEntry(spec);
  const genreMatrix = resolveGenreStoryMatrix({
    videoType: spec.video_type,
    creationUseCase: spec.creation_use_case,
    truthMode: spec.truth_mode,
    storyStructure: 'single_event_drama',
    narrativePatternIds: [spec.primary_pattern_id, spec.secondary_pattern_id],
  });
  const composition = buildStoryGenreComposition({
    entry,
    videoType: spec.video_type,
    truthMode: spec.truth_mode,
    requestedSourceKinds: spec.source_kinds,
    narrativePatternIds: genreMatrix.resolved_narrative_pattern_ids,
  });
  const generated = generateChinaCultureLocalStoryAssembly({
    entry,
    centralEvent: `围绕${entry.name}完成一次可审计行动`,
    videoType: spec.video_type,
    presentationStyle: spec.presentation_style,
    storyStructure: 'single_event_drama',
    targetDuration: spec.target_duration,
    tone: '行动具体、因果清楚、边界明确',
    genreComposition: composition,
  });
  if (!generated.ok) {
    return {
      ...spec,
      status: 'failed',
      fusion_status: composition.fusion_plan.status,
      warning_ids: composition.fusion_plan.conflicts.map(item => item.conflict_id),
      scene_count: 0,
      secondary_scene_ids: [],
      checks: {
        primary_opening_realized: false,
        primary_ending_realized: false,
        secondary_realized_once: false,
        full_text_synchronized: false,
        gears_synchronized: false,
        fact_boundary_complete: false,
        fiction_boundary_complete: false,
        genre_matrix_compatible: false,
        secondary_uses_middle_scene: false,
        duration_aligned: false,
      },
      issues: [generated.message],
    };
  }

  const story = generated.storyResult;
  const primaryPattern = NARRATIVE_PATTERN_LIBRARY[spec.primary_pattern_id];
  const secondaryPattern = NARRATIVE_PATTERN_LIBRARY[spec.secondary_pattern_id];
  const secondaryScenes = story.scene_breakdown.filter(scene => (
    scene.fictionalized_elements?.some(item => item.includes(`“${secondaryPattern.label}”副机制`))
  ));
  const totalDurationSeconds = story.scene_breakdown.reduce(
    (sum, scene) => sum + scene.duration_sec,
    0,
  );
  const checks = {
    primary_opening_realized: story.scene_breakdown[0]?.dramatic_function === primaryPattern.pacing_pattern[0],
    primary_ending_realized: story.scene_breakdown.at(-1)?.dramatic_function === primaryPattern.pacing_pattern.at(-1),
    secondary_realized_once: secondaryScenes.length === 1,
    full_text_synchronized: secondaryScenes.length === 1 && story.full_text.includes(secondaryScenes[0].plot),
    gears_synchronized: story.gears_segments.length === story.scene_breakdown.length
      && story.gears_segments.every((segment, index) => (
        segment.purpose === story.scene_breakdown[index].dramatic_function
        && segment.script_text.includes(story.scene_breakdown[index].plot)
      )),
    fact_boundary_complete: story.scene_breakdown.every(scene => Boolean(scene.factual_basis?.trim())),
    fiction_boundary_complete: story.scene_breakdown.every(scene => Boolean(scene.fictionalized_elements?.length)),
    genre_matrix_compatible: genreMatrix.compatible_use_case
      && genreMatrix.compatible_truth_mode
      && genreMatrix.rejected_narrative_pattern_ids.length === 0
      && genreMatrix.resolved_narrative_pattern_ids[0] === spec.primary_pattern_id
      && genreMatrix.resolved_narrative_pattern_ids[1] === spec.secondary_pattern_id,
    secondary_uses_middle_scene: secondaryScenes.length === 1
      && secondaryScenes[0].scene_id !== story.scene_breakdown[0]?.scene_id
      && secondaryScenes[0].scene_id !== story.scene_breakdown.at(-1)?.scene_id,
    duration_aligned: totalDurationSeconds === DURATION_SECONDS[spec.target_duration],
  };
  const issues = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([checkId]) => checkId);

  return {
    ...spec,
    status: issues.length === 0 ? 'passed' : 'failed',
    fusion_status: composition.fusion_plan.status,
    warning_ids: composition.fusion_plan.conflicts.map(item => item.conflict_id),
    scene_count: story.scene_breakdown.length,
    secondary_scene_ids: secondaryScenes.map(scene => scene.scene_id),
    checks,
    issues,
  };
}

function capacityConflictFailsClosed(spec: MatrixCaseSpec): boolean {
  const entry = fixtureEntry(spec);
  const genreMatrix = resolveGenreStoryMatrix({
    videoType: spec.video_type,
    creationUseCase: spec.creation_use_case,
    truthMode: spec.truth_mode,
    storyStructure: 'single_event_drama',
    narrativePatternIds: [...EXPANDED_NARRATIVE_PATTERN_IDS],
  });
  const composition = buildStoryGenreComposition({
    entry,
    videoType: spec.video_type,
    truthMode: spec.truth_mode,
    requestedSourceKinds: spec.source_kinds,
    narrativePatternIds: genreMatrix.resolved_narrative_pattern_ids,
  });
  const generated = generateChinaCultureLocalStoryAssembly({
    entry,
    centralEvent: '验证副机制场景容量门禁',
    videoType: spec.video_type,
    presentationStyle: spec.presentation_style,
    storyStructure: 'single_event_drama',
    targetDuration: spec.target_duration,
    tone: '边界明确',
    genreComposition: composition,
  });
  return !generated.ok && generated.reason === 'genre_fusion_conflict';
}

export function buildStoryGenreCompositionMatrixReport(): StoryGenreCompositionMatrixReport {
  const cases = buildCaseSpecs().map(evaluateCase);
  const mechanismCases = cases.filter(item => item.suite === 'mechanism_coverage');
  const compatibilityCases = cases.filter(item => item.suite === 'compatibility_duration');
  const coveredSourceKinds = new Set(mechanismCases.flatMap(item => item.source_kinds));
  const coveredPrimaryPatterns = new Set(mechanismCases.map(item => item.primary_pattern_id));
  const coveredSecondaryPatterns = new Set(mechanismCases.map(item => item.secondary_pattern_id));
  const semanticTensionRules = new Set(mechanismCases.flatMap(item => item.warning_ids));
  const coveredVideoTypes = new Set(compatibilityCases.map(item => item.video_type));
  const coveredDurations = new Set(compatibilityCases.map(item => item.target_duration));
  const coveredVideoTypeDurationCells = new Set(compatibilityCases.map(
    item => `${item.video_type}:${item.target_duration}`,
  ));
  const capacitySpecs = buildCaseSpecs().filter(item => item.suite === 'compatibility_duration');
  const capacityPassedCount = capacitySpecs.filter(capacityConflictFailsClosed).length;
  const capacityFailClosed = capacityPassedCount === capacitySpecs.length;
  const passedCaseCount = cases.filter(item => item.status === 'passed').length;
  const passed = passedCaseCount === cases.length
    && coveredSourceKinds.size === SOURCE_KINDS.length
    && coveredPrimaryPatterns.size === EXPANDED_NARRATIVE_PATTERN_IDS.length
    && coveredSecondaryPatterns.size === EXPANDED_NARRATIVE_PATTERN_IDS.length
    && mechanismCases.filter(item => item.source_kinds.length > 1).length >= 8
    && semanticTensionRules.size === 4
    && coveredVideoTypes.size === COMPATIBLE_VIDEO_TYPE_PROFILES.length
    && coveredDurations.size === MATRIX_DURATIONS.length
    && coveredVideoTypeDurationCells.size === COMPATIBLE_VIDEO_TYPE_PROFILES.length * MATRIX_DURATIONS.length
    && capacityFailClosed;

  return {
    schema_version: 'story-genre-composition-matrix/v2',
    generated_at: '2026-08-21T00:00:00.000+08:00',
    status: passed ? 'passed' : 'failed',
    summary: {
      case_count: cases.length,
      passed_case_count: passedCaseCount,
      mechanism_coverage_case_count: mechanismCases.length,
      compatibility_duration_case_count: compatibilityCases.length,
      source_kind_coverage: `${coveredSourceKinds.size}/${SOURCE_KINDS.length}`,
      primary_pattern_coverage: `${coveredPrimaryPatterns.size}/${EXPANDED_NARRATIVE_PATTERN_IDS.length}`,
      secondary_pattern_coverage: `${coveredSecondaryPatterns.size}/${EXPANDED_NARRATIVE_PATTERN_IDS.length}`,
      mixed_source_case_count: mechanismCases.filter(item => item.source_kinds.length > 1).length,
      semantic_tension_rule_count: semanticTensionRules.size,
      compatible_video_type_coverage: `${coveredVideoTypes.size}/${COMPATIBLE_VIDEO_TYPE_PROFILES.length}`,
      duration_coverage: `${coveredDurations.size}/${MATRIX_DURATIONS.length}`,
      video_type_duration_cell_coverage: `${coveredVideoTypeDurationCells.size}/${COMPATIBLE_VIDEO_TYPE_PROFILES.length * MATRIX_DURATIONS.length}`,
      capacity_conflict_skeleton_coverage: `${capacityPassedCount}/${capacitySpecs.length}`,
      capacity_conflict_fail_closed: capacityFailClosed,
    },
    cases,
    boundaries: {
      external_model_invoked: false,
      human_review_complete: false,
      professional_credit_granted: false,
      real_production_credit_granted: false,
      province_markdown_written: false,
    },
  };
}
