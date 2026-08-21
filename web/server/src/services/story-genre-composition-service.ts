import type {
  CulturalStorySourceKind,
  EntryDetail,
  NarrativePatternId,
  StoryGenreComposition,
  StoryGenreFusionConflict,
  StoryGenreFusionPlan,
  TruthMode,
  VideoType,
} from '@shared/types.js';
import {
  EXPANDED_NARRATIVE_PATTERN_IDS,
  NARRATIVE_PATTERN_LIBRARY,
} from './narrative-pattern-library.js';

interface CulturalSourceRule {
  label: string;
  source_requirement: string;
  evidence_boundary_rule: string;
  creative_rule: string;
}

const SOURCE_RULES: Record<CulturalStorySourceKind, CulturalSourceRule> = {
  myth: {
    label: '神话',
    source_requirement: '神话题材必须明确神祇、宇宙秩序或超自然规则，以及规则被触犯后的后果。',
    evidence_boundary_rule: '神话叙事属于文化信念和叙事传统，不得写成经现代史学确证的历史事件。',
    creative_rule: '可重组考验、旅程和象征意象，但新设定必须内部一致并服务人物选择。',
  },
  folk_legend: {
    label: '民间传说',
    source_requirement: '民间传说必须保留核心母题、地方载体、口述版本或流传理由。',
    evidence_boundary_rule: '传说版本需使用“相传/民间说法”等边界，不得把异文合并为唯一史实。',
    creative_rule: '可增设凡人视角、悬念和可见行动，但不能抹掉地域差异与口述传统。',
  },
  historical_event: {
    label: '历史事迹',
    source_requirement: '历史事迹必须具备时间、地点、参与者、事件压力、关键行动和可解释后果。',
    evidence_boundary_rule: '历史事件的日期、人物身份、制度背景和因果结论必须区分可考事实、合理推演与明确虚构。',
    creative_rule: '可补足场面调度和非史料对白，但不得制造改变已知历史走向的虚假关键事实。',
  },
  historical_figure: {
    label: '历史人物',
    source_requirement: '历史人物题材必须围绕具体目标、压力、选择和代价，不得退化为生平年表。',
    evidence_boundary_rule: '真实人物言行、关系和经历必须标明史料依据；无依据的私密动机不得写成定论。',
    creative_rule: '可用合成人物、压缩时间和场景化对白承载冲突，但必须显式归入戏剧化补足。',
  },
  local_anecdote: {
    label: '地方掌故',
    source_requirement: '地方掌故必须保留地名、物件、人物行动和地方记忆的具体承载。',
    evidence_boundary_rule: '地方逸闻与可考地方史需分层，不能因流传广泛就自动升级为确定事实。',
    creative_rule: '可把掌故发展成谜案、旅程或人物选择，但不得强行迁移到无来源关联的地区。',
  },
  classic_literature: {
    label: '经典文本',
    source_requirement: '经典文本改编必须明确所用版本、保留的主题/关系/事件和允许压缩的部分。',
    evidence_boundary_rule: '不得默认任何具体文本版本、译本或现代改编已获授权；引用和权利状态必须另行核验。',
    creative_rule: '只提炼公共领域母题和通用结构机制，不复用现代改编的新增角色、专有设定或独特表达。',
  },
  heritage_memory: {
    label: '非遗与文化记忆',
    source_requirement: '文化记忆题材必须让工艺、仪式、场所、器物或传承关系真实参与剧情。',
    evidence_boundary_rule: '非遗名录、传承谱系、仪式禁忌和权利授权必须使用已确认来源。',
    creative_rule: '剧情化冲突只能帮助观众理解文化实践，不得替代真实流程或虚构官方身份。',
  },
  user_original: {
    label: '用户原创素材',
    source_requirement: '用户原创素材必须明确核心人物、世界规则、目标、冲突和希望保留的主题。',
    evidence_boundary_rule: '原创虚构不得借用真实人物、机构或地方文化来制造未经证实的负面事实。',
    creative_rule: '可以自由组合叙事机制，但必须保持角色、世界观、关键物件和情节表达的原创性。',
  },
};

const MYTHIC_PATTERNS = new Set<NarrativePatternId>([
  'folk_legend_trial',
  'mythic_voyage_homecoming',
  'mythic_hero_quest',
  'folk_supernatural_investigation',
]);

const EXPANDED_PATTERN_SET = new Set<NarrativePatternId>(EXPANDED_NARRATIVE_PATTERN_IDS);

const FUSION_TENSION_RULES: Array<{
  conflict_id: string;
  pattern_ids: [NarrativePatternId, NarrativePatternId];
  reason: string;
  resolution_rule: string;
}> = [
  {
    conflict_id: 'epistemic-resolution-tension',
    pattern_ids: ['fair_play_detective', 'folk_supernatural_investigation'],
    reason: '公平推理要求关键案件得到可复核解释，民俗异闻调查允许保留边界明确的未知。',
    resolution_rule: '主机制决定结局的认知口径；副机制只提供竞争假设，不得推翻已展示证据，也不得把未知冒充事实。',
  },
  {
    conflict_id: 'tone-payoff-tension',
    pattern_ids: ['tragic_romance_choice', 'folk_satirical_comedy'],
    reason: '悲剧抉择要求不可撤回的情感损失，讽喻喜剧要求规则反噬形成笑后余味。',
    resolution_rule: '主机制决定结尾情绪；副机制只兑现一场规则错位，不得用笑料取消人物损失或消费弱者。',
  },
  {
    conflict_id: 'artifact-custody-tension',
    pattern_ids: ['archaeological_mystery_expedition', 'team_heist_operation'],
    reason: '遗迹探秘强调原址保护与证据留存，团队行动容易把文化器物误写成可夺取战利品。',
    resolution_rule: '团队行动只能用于保护、归还或阻止破坏；未知器物必须编号、封存和待核，不得据为己有。',
  },
  {
    conflict_id: 'strategy-scope-overlap',
    pattern_ids: ['historical_faction_epic', 'war_strategy_campaign'],
    reason: '阵营群像与战役谋略都可能争夺全片因果主轴，造成重复摆盘和人物失焦。',
    resolution_rule: '主机制负责全片阵营因果，副机制只在一场兑现地形、情报、后勤或命令反馈闭环。',
  },
];

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function getCulturalStorySourceLabel(sourceKind: CulturalStorySourceKind): string {
  return SOURCE_RULES[sourceKind].label;
}

export function getNarrativePatternLabel(patternId: NarrativePatternId): string {
  return NARRATIVE_PATTERN_LIBRARY[patternId]?.label ?? patternId;
}

function buildGenreFusionPlan(patterns: NarrativePatternId[]): StoryGenreFusionPlan {
  const expandedPatterns = patterns.filter(patternId => EXPANDED_PATTERN_SET.has(patternId));
  const primaryPatternId = expandedPatterns[0];
  const secondaryPatternIds = expandedPatterns.slice(1);
  const conflicts: StoryGenreFusionConflict[] = FUSION_TENSION_RULES
    .filter(rule => rule.pattern_ids.every(patternId => expandedPatterns.includes(patternId)))
    .map(rule => ({
      conflict_id: rule.conflict_id,
      severity: 'warning',
      pattern_ids: [...rule.pattern_ids],
      reason: rule.reason,
      resolution_rule: rule.resolution_rule,
    }));
  const assignments = [
    ...(primaryPatternId
      ? [{
          pattern_id: primaryPatternId,
          role: 'primary_engine' as const,
          scene_scope: 'whole_story' as const,
          realization_requirement: `以“${getNarrativePatternLabel(primaryPatternId)}”控制开场、升级、高潮与结尾的完整因果弧。`,
        }]
      : []),
    ...secondaryPatternIds.map(patternId => ({
      pattern_id: patternId,
      role: 'secondary_mechanism' as const,
      scene_scope: 'middle_scene' as const,
      realization_requirement: `在一个独立中段场景中以动作和后果兑现“${getNarrativePatternLabel(patternId)}”，不得替换主机制的开场与结尾。`,
    })),
  ];

  return {
    schema_version: 'story-genre-fusion-plan/v1',
    status: !primaryPatternId
      ? 'not_applicable'
      : secondaryPatternIds.length === 0
        ? 'single_pattern'
        : conflicts.length > 0
          ? 'ready_with_warnings'
          : 'fusion_ready',
    ...(primaryPatternId ? { primary_pattern_id: primaryPatternId } : {}),
    secondary_pattern_ids: secondaryPatternIds,
    assignments,
    conflicts,
    distinct_middle_scene_required_per_secondary: true,
  };
}

export function inferCulturalStorySourceKinds(entry: EntryDetail): CulturalStorySourceKind[] {
  if (entry.credibility === '用户提供') return ['user_original'];
  const text = `${entry.type} ${entry.name} ${entry.summary} ${entry.story} ${entry.keywords.join(' ')}`;
  if (entry.type === '历史人物') return ['historical_figure'];
  if (/神话/u.test(text)) return ['myth'];
  if (/传说|民间故事/u.test(text)) return ['folk_legend'];
  if (/历史|起义|战争|战役|事件/u.test(text)) return ['historical_event'];
  if (/非遗|工艺|戏曲|节庆|民俗|仪式/u.test(text)) return ['heritage_memory'];
  if (/典籍|古典|小说|诗词|文学/u.test(text)) return ['classic_literature'];
  return ['local_anecdote'];
}

export function buildStoryGenreComposition(input: {
  entry: EntryDetail;
  videoType: VideoType;
  truthMode: TruthMode;
  requestedSourceKinds?: CulturalStorySourceKind[];
  narrativePatternIds: NarrativePatternId[];
}): StoryGenreComposition {
  const sourceKinds = unique(
    input.requestedSourceKinds?.length
      ? input.requestedSourceKinds
      : inferCulturalStorySourceKinds(input.entry),
  ).slice(0, 4);
  const patterns = unique(input.narrativePatternIds).slice(0, 6);
  const sourceRules = sourceKinds.map(sourceKind => SOURCE_RULES[sourceKind]);
  const patternLabels = patterns
    .map(patternId => NARRATIVE_PATTERN_LIBRARY[patternId]?.label)
    .filter((label): label is string => Boolean(label));
  const fusionPlan = buildGenreFusionPlan(patterns);
  const compatibilityWarnings = [
    sourceKinds.length > 1
      ? '混合题材必须在逐场 source_entries / factual_basis 中说明每个事实、传说与虚构元素来自哪一层。'
      : '',
    ['documentary_short', 'explainer_video', 'lecture_video', 'education_training'].includes(input.videoType)
      && sourceKinds.some(sourceKind => sourceKind === 'myth' || sourceKind === 'folk_legend')
      ? '非虚构/知识类成片只能把神话传说作为文化叙事或版本材料，不能用戏剧化奇观替代事实说明。'
      : '',
    ['factual_reconstruction', 'institutional_verified'].includes(input.truthMode)
      && (sourceKinds.includes('user_original') || patterns.some(patternId => MYTHIC_PATTERNS.has(patternId)))
      ? '当前真实度模式要求所有原创或神异内容明确标为艺术处理，不得进入事实结论。'
      : '',
    sourceKinds.includes('classic_literature')
      ? '经典文本的公共领域、版本和改编授权状态必须单独核验，系统不自动授予版权信用。'
      : '',
  ].filter(Boolean);

  return {
    schema_version: 'story-genre-composition/v1',
    source_kinds: sourceKinds,
    narrative_pattern_ids: patterns,
    source_requirements: unique(sourceRules.map(rule => rule.source_requirement)),
    evidence_boundary_rules: unique(sourceRules.map(rule => rule.evidence_boundary_rule)),
    creative_rules: [
      ...unique(sourceRules.map(rule => rule.creative_rule)),
      `原创机制边界：当前只组合${patternLabels.length ? patternLabels.join('、') : '通用叙事'}的目标、冲突、线索、节奏和场景机制。`,
      '不得复用受保护作品的专有角色、标志性世界设定、独特情节序列、代表性台词或可识别文风。',
      ...fusionPlan.assignments.map(item => item.realization_requirement),
      ...fusionPlan.conflicts.map(item => item.resolution_rule),
    ],
    compatibility_warnings: compatibilityWarnings,
    fusion_plan: fusionPlan,
    originality_boundary: {
      mechanism_reference_only: true,
      protected_expression_copying_allowed: false,
      named_character_reuse_allowed: false,
      signature_worldbuilding_reuse_allowed: false,
    },
  };
}
