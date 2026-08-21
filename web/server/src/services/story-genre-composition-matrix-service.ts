import type {
  CulturalStorySourceKind,
  EntryDetail,
} from '@shared/types.js';
import { generateChinaCultureLocalStoryAssembly } from '../domains/china-culture/story-local-generation-service.js';
import {
  EXPANDED_NARRATIVE_PATTERN_IDS,
  NARRATIVE_PATTERN_LIBRARY,
} from './narrative-pattern-library.js';
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

interface MatrixCaseSpec {
  case_id: string;
  source_kinds: CulturalStorySourceKind[];
  primary_pattern_id: ExpandedPatternId;
  secondary_pattern_id: ExpandedPatternId;
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
  };
  issues: string[];
}

export interface StoryGenreCompositionMatrixReport {
  schema_version: 'story-genre-composition-matrix/v1';
  generated_at: string;
  status: 'passed' | 'failed';
  summary: {
    case_count: number;
    passed_case_count: number;
    source_kind_coverage: string;
    primary_pattern_coverage: string;
    secondary_pattern_coverage: string;
    mixed_source_case_count: number;
    semantic_tension_rule_count: number;
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
  return EXPANDED_NARRATIVE_PATTERN_IDS.map((primaryPatternId, index) => ({
    case_id: `composition-${String(index + 1).padStart(2, '0')}-${primaryPatternId}`,
    source_kinds: index < SOURCE_KINDS.length
      ? [SOURCE_KINDS[index]]
      : [...MIXED_SOURCE_PAIRS[index - SOURCE_KINDS.length]],
    primary_pattern_id: primaryPatternId,
    secondary_pattern_id: SECONDARY_BY_PRIMARY[primaryPatternId],
  }));
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
  const composition = buildStoryGenreComposition({
    entry,
    videoType: 'ai_comic_drama',
    truthMode: 'inspired_by_material',
    requestedSourceKinds: spec.source_kinds,
    narrativePatternIds: [spec.primary_pattern_id, spec.secondary_pattern_id],
  });
  const generated = generateChinaCultureLocalStoryAssembly({
    entry,
    centralEvent: `围绕${entry.name}完成一次可审计行动`,
    videoType: 'ai_comic_drama',
    presentationStyle: 'ai_comic',
    storyStructure: 'single_event_drama',
    targetDuration: '3分钟',
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

function capacityConflictFailsClosed(): boolean {
  const spec = buildCaseSpecs()[0];
  const entry = fixtureEntry(spec);
  const composition = buildStoryGenreComposition({
    entry,
    videoType: 'ai_comic_drama',
    truthMode: 'inspired_by_material',
    requestedSourceKinds: spec.source_kinds,
    narrativePatternIds: [...EXPANDED_NARRATIVE_PATTERN_IDS.slice(0, 6)],
  });
  const generated = generateChinaCultureLocalStoryAssembly({
    entry,
    centralEvent: '验证副机制场景容量门禁',
    videoType: 'ai_comic_drama',
    presentationStyle: 'ai_comic',
    storyStructure: 'single_event_drama',
    targetDuration: '3分钟',
    tone: '边界明确',
    genreComposition: composition,
  });
  return !generated.ok && generated.reason === 'genre_fusion_conflict';
}

export function buildStoryGenreCompositionMatrixReport(): StoryGenreCompositionMatrixReport {
  const cases = buildCaseSpecs().map(evaluateCase);
  const coveredSourceKinds = new Set(cases.flatMap(item => item.source_kinds));
  const coveredPrimaryPatterns = new Set(cases.map(item => item.primary_pattern_id));
  const coveredSecondaryPatterns = new Set(cases.map(item => item.secondary_pattern_id));
  const semanticTensionRules = new Set(cases.flatMap(item => item.warning_ids));
  const capacityFailClosed = capacityConflictFailsClosed();
  const passedCaseCount = cases.filter(item => item.status === 'passed').length;
  const passed = passedCaseCount === cases.length
    && coveredSourceKinds.size === SOURCE_KINDS.length
    && coveredPrimaryPatterns.size === EXPANDED_NARRATIVE_PATTERN_IDS.length
    && coveredSecondaryPatterns.size === EXPANDED_NARRATIVE_PATTERN_IDS.length
    && cases.filter(item => item.source_kinds.length > 1).length >= 8
    && semanticTensionRules.size === 4
    && capacityFailClosed;

  return {
    schema_version: 'story-genre-composition-matrix/v1',
    generated_at: '2026-08-21T00:00:00.000+08:00',
    status: passed ? 'passed' : 'failed',
    summary: {
      case_count: cases.length,
      passed_case_count: passedCaseCount,
      source_kind_coverage: `${coveredSourceKinds.size}/${SOURCE_KINDS.length}`,
      primary_pattern_coverage: `${coveredPrimaryPatterns.size}/${EXPANDED_NARRATIVE_PATTERN_IDS.length}`,
      secondary_pattern_coverage: `${coveredSecondaryPatterns.size}/${EXPANDED_NARRATIVE_PATTERN_IDS.length}`,
      mixed_source_case_count: cases.filter(item => item.source_kinds.length > 1).length,
      semantic_tension_rule_count: semanticTensionRules.size,
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
