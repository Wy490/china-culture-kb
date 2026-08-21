import type {
  EntryDetail,
  NarrativePatternId,
  PresentationStyle,
  StoryGenreComposition,
  StoryScene,
  VideoType,
} from '@shared/types.js';
import type { StoryAssembly } from '../platform/story-model-output-merge.js';
import { buildPlatformGearsSegmentsFromScenes } from '../platform/story-gears-segment.js';
import { NARRATIVE_PATTERN_LIBRARY } from './narrative-pattern-library.js';

const EXPANDED_PATTERN_IDS = [
  'archaeological_mystery_expedition',
  'clan_legacy_conspiracy',
  'fair_play_detective',
  'mythic_voyage_homecoming',
  'historical_faction_epic',
  'mythic_hero_quest',
  'folk_supernatural_investigation',
  'survival_expedition',
  'conspiracy_puzzle_thriller',
  'courtroom_case_procedural',
  'team_heist_operation',
  'tragic_romance_choice',
  'family_saga_generations',
  'road_companion_quest',
  'war_strategy_campaign',
  'folk_satirical_comedy',
] as const satisfies readonly NarrativePatternId[];

type ExpandedPatternId = typeof EXPANDED_PATTERN_IDS[number];

const EXPANDED_PATTERN_SET = new Set<NarrativePatternId>(EXPANDED_PATTERN_IDS);

/** Audience-facing action beats. They express reusable mechanisms, not protected plots. */
const ACTION_BEATS: Record<ExpandedPatternId, readonly string[]> = {
  archaeological_mystery_expedition: [
    '众人在旧路边辨认出一块带有重复纹样的残片，并先为它编号留档。',
    '纹样与古道转折一一对应，队伍按可退回的路线进入封闭空间。',
    '第一次判断把装饰当成方向，错误触碰令退路受损，也暴露了新的空间线索。',
    '环境变化逼迫成员用各自专长复核路线，任何移动都先记录再执行。',
    '残片并非藏宝标记，而是提醒后来者保护现场、避开危险的旧有信息。',
    '众人放弃带走未知器物，只把残片编号、封存并带回核验，代价是线索仍未完全闭合。',
  ],
  clan_legacy_conspiracy: [
    '一件旧物同时送到几名守业人手中，彼此矛盾的家传说法迫使各方到场。',
    '各家按旧席位入局，称谓、沉默与交换条件显出不同目标。',
    '旧约上的缺口证明上一代有人改写规则，但受益者并不等于改写者。',
    '两代人的证词拼出旧账：当年的保全也把代价转嫁给了后来人。',
    '新一代不再替家名隐瞒，在亲缘与公共责任之间公开站队。',
    '众人重写一条旧规则，让秘密不再靠血缘垄断，也各自承担失去的利益。',
  ],
  fair_play_detective: [
    '调查者先封住异常现场，把车辙、物证与每个人最初的位置完整展示。',
    '三份证词分别成立，却在同一段时间线上无法同时为真。',
    '第一轮推断锁定最显眼的嫌疑人，调查者同时保留一处尚未解释的细节。',
    '复验物证后，车辙方向与证词中的到达顺序形成反证，原推断被主动撤回。',
    '调查者重排时间线，让早已出现的证词、物证和利益关系逐项对齐。',
    '所有人在场时，调查者逐条解释每项线索如何排除错误答案，并指出唯一能同时成立的经过。',
  ],
  mythic_voyage_homecoming: [
    '舟子握住故乡信物立下归乡誓言，约定无论航路如何改变都不遗忘来处。',
    '第一处异水以陌生规则阻断航路，船队必须先理解当地告诫才能继续。',
    '安逸停泊诱使同行者放弃归乡，信物却提醒舟子时间正在流失。',
    '风浪夺走同伴与补给，舟子在最低处重新选择为何继续远航。',
    '他凭信物认回名字与誓言，也接受归乡不等于回到未曾改变的自己。',
    '舟子带伤归乡，以磨损的信物回应离岸誓言；这段神异航路仍保留为相传的文化记忆。',
  ],
  historical_faction_epic: [
    '地图、战报与粮道同时摆开，三个阵营围绕同一座城提出不同目标。',
    '同一份战报传到各方后触发三种决策，名分、资源与民心开始互相牵制。',
    '短暂盟约换来守城窗口，却把补给和承诺的风险推给最弱的一方。',
    '一次战略误判切断粮道，前线命令立刻变成百姓迁徙与伤亡的现实后果。',
    '决战前，各阵营必须在兑现盟约、保存实力与保护民众之间作出不可撤回的选择。',
    '胜负之后秩序重排：阵营所得、盟约所失与普通人的代价共同构成历史结果。',
  ],
  mythic_hero_quest: [
    '共同体危机降临，使命与一条不可触犯的禁忌同时交到主角手中。',
    '主角把使命误解为个人证明，拒绝听见力量背后的限制。',
    '一名引路者只提供有限助力，主角必须用自己的行动跨过第一道阻碍。',
    '力量被误用后触发明确代价，主角失去最想保留的东西。',
    '主角不再等待神谕替自己选择，主动承担共同体后果并完成使命。',
    '危机解除却没有无损凯旋，新的秩序由主角付出的代价留下边界。',
  ],
  folk_supernatural_investigation: [
    '一桩异象被报到调查者面前，现场同时留下现实痕迹与无法立即解释的传闻。',
    '地方实践者说明禁忌的来历与操作方式，调查者先尊重规则再开始验证。',
    '天气、地形与人为活动构成第一套现实假设，但仍有一处证据不能纳入。',
    '不同口述版本在关键时间上冲突，也暴露出有人借禁忌掩盖利益。',
    '调查揭开可证部分，同时让传说解释与现实解释各自接受证据检验。',
    '人为问题得到处理，剩余异象明确留在“相传与待核验”的边界内。',
  ],
  survival_expedition: [
    '队伍核对天气窗口、路线与补给数量后出发，每个人都承担一项生存职责。',
    '首个环境变化造成真实损耗，余下资源被重新计算而非凭空补足。',
    '路线误判引发分歧，继续任务与保留撤退窗口无法同时满足。',
    '极端环境封住原路，先前的小错误累积成必须立即处理的危机。',
    '领队选择先救人再完成任务，成员用已展示的专长接力打开生路。',
    '幸存者回望远征，明确记录资源、判断与人员代价，未完成部分留待后来者。',
  ],
  conspiracy_puzzle_thriller: [
    '一份带缺页的危险档案出现，缺口对应着现实中正在发生的阻挠。',
    '追查刚开始便遭遇拦截，主角只能带走一块可验证的信息碎片。',
    '盟友用承担风险的行动证明可信，而不是用一句保证取得信任。',
    '分散证据拼成更大的因果网络，每个答案也暴露新的危险节点。',
    '内部背叛改变公开计划，主角必须判断哪些事实此刻可以交给公众。',
    '真相被有限揭露并产生现实后果，制度黑箱仍留下可继续追查的余波。',
  ],
  courtroom_case_procedural: [
    '案件呈堂后，审理者先划定时代制度允许调查的范围与程序。',
    '证人依次陈述，每轮询问只核对一个时间、位置或利益矛盾。',
    '物证与主要证词不符，原有判断必须暂停而不能靠直觉补齐。',
    '权势介入要求尽快结案，审理者用公开程序保护证人与证据。',
    '交叉质证把证词、物证和时间线连成可复核的证据链。',
    '裁断逐项说明依据、制度边界与各方代价，结论不超出证据能够支持的范围。',
  ],
  team_heist_operation: [
    '团队确认一项有伦理边界的夺回或营救任务，并把倒计时公开给所有成员。',
    '成员按既有能力分工，每项技能都对应一个不可替代的行动节点。',
    '计划通过路线、时机和备用方案完成演示，风险没有被叙述轻轻带过。',
    '行动中的隐藏变量使原计划偏航，先前展示的限制开始兑现。',
    '策划者放弃独自控制，队友临场协作完成最关键的选择。',
    '目标达成后团队付出代价撤离，受保护之物被归还而非据为己有。',
  ],
  tragic_romance_choice: [
    '两人因共同完成一件具体事情相识，关系从协作而非偶然凝视开始。',
    '一件信物记录双方主动许下的承诺，也明确承诺要承担的责任。',
    '身份或制度规则通过现实行动阻断未来，冲突不是一句误会即可解除。',
    '两人短暂找到两全可能，却发现代价将被转嫁给无辜者。',
    '双方在知情下主动舍弃一种未来，让爱与责任都留下不可撤回的损失。',
    '结尾的信物获得新含义，未说出口的话由最后一个动作完成。',
  ],
  family_saga_generations: [
    '当代继承者从宅院、家业或传承物上的缺口开始追问。',
    '第一代在具体时代压力下奠定家业，也留下后来人必须承担的条件。',
    '第二代改变旧物用途并走向分裂，使上一代选择产生新的后果。',
    '时代冲击进入日常生活，政策、市场或迁徙迫使家庭重新排序。',
    '当代人重估所谓秘密，看见保全、伤害与沉默如何跨代传递。',
    '继承者以行动修复或结束一条家族规则，让传承不再等于重复。',
  ],
  road_companion_quest: [
    '目标相同但价值观不同的两名伙伴被迫同行，任务与抵达期限同时建立。',
    '第一个路口引发路线分歧，彼此能力与偏见都暴露出来。',
    '一场互救兑现先前展示的能力，有限信任由行动建立。',
    '隐藏任务公开后，伙伴必须重新判断同行的条件。',
    '是否绕路帮助他人迫使双方作出分道选择，也改变任务本身的意义。',
    '他们以新的协作方式共同抵达，外部任务与伙伴关系同时完成转变。',
  ],
  war_strategy_campaign: [
    '决策者先明确战局目标，并把地形、兵力、情报和粮道摆到同一张图上。',
    '敌我约束逐项显现，任何策略都必须面对时间与后勤上限。',
    '首次交锋把地图判断转成前线行动，也暴露原计划的真实缺口。',
    '新情报与后勤中断同时出现，旧部署若不改变将扩大伤亡。',
    '关键部署通过命令、执行和反馈形成闭环，普通士兵也承担能动选择。',
    '胜负落定后从百姓与士兵视角衡量代价，战果不被写成无伤爽局。',
  ],
  folk_satirical_comedy: [
    '掌事者公开立下一条偏向自己的规矩，小人物被迫在规则里行动。',
    '小人物因身份受压，却记住规矩中被掌事者忽略的一个条件。',
    '道具错位令误会扩大，自作聪明者为了面子不断确认错误判断。',
    '小人物顺势设局，只使用公开规则与可见行动，不靠羞辱更弱的人取胜。',
    '掌事者被自己坚持的规则反噬，同一句话在前后场景中意义翻转。',
    '围观者的反应完成笑后余味，讽喻落在滥用规则者而非地域或弱者身上。',
  ],
};

function unique(items: string[]): string[] {
  return [...new Set(items.map(item => item.trim()).filter(Boolean))];
}

function shorten(value: string, limit: number): string {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}…` : normalized;
}

function resolveBeatIndex(sceneIndex: number, sceneCount: number, beatCount: number): number {
  if (sceneCount <= 1 || beatCount <= 1) return 0;
  return Math.round((sceneIndex * (beatCount - 1)) / (sceneCount - 1));
}

function buildScene(input: {
  scene: StoryScene;
  sceneIndex: number;
  sceneCount: number;
  patternId: ExpandedPatternId;
  entry: EntryDetail;
  centralEvent: string;
  genreComposition: StoryGenreComposition;
}): StoryScene {
  const pattern = NARRATIVE_PATTERN_LIBRARY[input.patternId];
  const beatIndex = resolveBeatIndex(
    input.sceneIndex,
    input.sceneCount,
    pattern.pacing_pattern.length,
  );
  const dramaticFunction = pattern.pacing_pattern[beatIndex];
  const actionBeat = ACTION_BEATS[input.patternId][beatIndex];
  const plot = input.sceneIndex === 0
    ? `${actionBeat} 故事由“${input.centralEvent}”进入行动。`
    : actionBeat;
  const factualBasis = input.scene.factual_basis
    || shorten(input.entry.story || input.entry.summary, 180)
    || `${input.entry.name}条目中的可核验信息。`;
  const fictionalizedElements = unique([
    ...(input.scene.fictionalized_elements ?? []),
    `为实现“${pattern.label}”机制而设计的场景行动、对白与因果连接，属于戏剧化补足。`,
  ]);
  const evidenceBoundary = input.genreComposition.evidence_boundary_rules[0]
    || '事实、传说与虚构补足必须分层表达。';

  return {
    ...input.scene,
    title: `${dramaticFunction}｜${input.scene.title}`,
    dramatic_function: dramaticFunction,
    plot,
    key_action: plot,
    conflict: `${pattern.conflict_engine} 本场必须通过人物行动呈现，不能只由旁白宣布。`,
    dialogue_or_narration: `旁白：${actionBeat}`,
    visual_prompt: `${input.scene.visual_prompt}；突出${pattern.subgenre_tags?.slice(0, 2).join('、') || pattern.label}的可见线索与行动`,
    cultural_note: unique([input.scene.cultural_note, evidenceBoundary]).join('；'),
    source_entries: unique([...(input.scene.source_entries ?? []), input.entry.name]),
    factual_basis: factualBasis,
    fictionalized_elements: fictionalizedElements,
  };
}

export interface LocalStoryGenreCompositionApplication {
  storyResult: StoryAssembly;
  appliedPatternId?: ExpandedPatternId;
  appliedRules: string[];
}

/**
 * Materialize expanded genre mechanisms in deterministic local output.
 * Legacy patterns intentionally return the original object untouched.
 */
export function applyLocalStoryGenreComposition(input: {
  storyResult: StoryAssembly;
  entry: EntryDetail;
  centralEvent: string;
  videoType: VideoType;
  presentationStyle: PresentationStyle;
  genreComposition?: StoryGenreComposition;
}): LocalStoryGenreCompositionApplication {
  const patternId = input.genreComposition?.narrative_pattern_ids.find(
    (candidate): candidate is ExpandedPatternId => EXPANDED_PATTERN_SET.has(candidate),
  );
  if (!patternId || !input.genreComposition) {
    return { storyResult: input.storyResult, appliedRules: [] };
  }

  const pattern = NARRATIVE_PATTERN_LIBRARY[patternId];
  const sceneBreakdown = input.storyResult.scene_breakdown.map((scene, sceneIndex, scenes) => (
    buildScene({
      scene,
      sceneIndex,
      sceneCount: scenes.length,
      patternId,
      entry: input.entry,
      centralEvent: input.centralEvent,
      genreComposition: input.genreComposition!,
    })
  ));
  const gearsSegments = buildPlatformGearsSegmentsFromScenes(
    sceneBreakdown,
    input.videoType,
    input.presentationStyle,
  ).map((segment, index) => ({
    ...segment,
    script_text: `【${sceneBreakdown[index].dramatic_function}】${sceneBreakdown[index].plot}${sceneBreakdown[index].dialogue_or_narration ? ` ${sceneBreakdown[index].dialogue_or_narration}` : ''}`,
  }));
  const fullText = sceneBreakdown.map((scene, index) => (
    `第${index + 1}场｜${scene.title}\n${scene.plot}\n${scene.dialogue_or_narration ?? ''}`.trim()
  )).join('\n\n');
  const culturalConstraints = unique([
    ...input.storyResult.cultural_constraints,
    ...input.genreComposition.evidence_boundary_rules,
    ...input.genreComposition.creative_rules,
  ]);
  const credibilityAddition = input.genreComposition.source_kinds.some(
    sourceKind => sourceKind === 'myth' || sourceKind === 'folk_legend',
  )
    ? '神话与传说内容按文化叙事表达，不作为现代史学确证。'
    : '新增场景行动和对白属于机制驱动的戏剧化补足，不改变条目事实结论。';

  return {
    appliedPatternId: patternId,
    appliedRules: [
      `local-genre-composition:${patternId}`,
      `本地兜底已应用“${pattern.label}”节奏与行动机制`,
      'scene_breakdown/full_text/gears_segments已同步重组',
    ],
    storyResult: {
      ...input.storyResult,
      logline: `${input.storyResult.logline}；以“${pattern.label}”机制推进${input.centralEvent}。`,
      full_text: fullText,
      scene_breakdown: sceneBreakdown,
      gears_segments: gearsSegments,
      cultural_constraints: culturalConstraints,
      credibility_note: unique([
        input.storyResult.credibility_note,
        credibilityAddition,
      ]).join('；'),
      act_structure: input.storyResult.act_structure.map(act => ({
        ...act,
        purpose: sceneBreakdown
          .filter(scene => act.scene_ids.includes(scene.scene_id))
          .map(scene => scene.dramatic_function)
          .join(' → ') || act.purpose,
      })),
    },
  };
}
