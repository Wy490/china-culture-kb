import { createHash } from 'node:crypto';
import type {
  AiComicCommercialBeatKey,
  AiComicCommercialQualityEpisodeReport,
  AiComicEpisodeCommercialBeats,
  AiComicEpisodePlan,
  AiComicHumanReviewDimension,
  AiComicHumanReviewScore,
  AiComicSeriesCommercialQualityAudit,
  AiComicSeriesHumanReview,
  AiComicSeriesPlan,
  SeriesPremiseContract,
} from '@shared/types.js';
import { auditAiComicSeriesDiversity } from './ai-comic-series-diversity-service.js';
import { auditAiComicSeriesPremiseFidelity } from './ai-comic-series-fidelity-service.js';
import { resolveAiComicCommercialStoryProfile } from './ai-comic-series-commercial-profile.js';

const HUMAN_REVIEW_DIMENSIONS: Array<{ key: AiComicHumanReviewDimension; label: string }> = [
  { key: 'hook', label: '钩子' },
  { key: 'character', label: '人物' },
  { key: 'dialogue', label: '对白' },
  { key: 'progression', label: '推进' },
  { key: 'turn', label: '反转' },
  { key: 'ending', label: '结尾' },
  { key: 'cultural_credibility', label: '文化可信度' },
];

const COMMERCIAL_BEAT_LABELS: Array<{ key: AiComicCommercialBeatKey; label: string }> = [
  { key: 'hook_3s', label: '前三秒可视钩子' },
  { key: 'episode_goal', label: '本集目标' },
  { key: 'external_pressure', label: '外部压力' },
  { key: 'failure_cost', label: '失败代价' },
  { key: 'midpoint_turn', label: '中段信息翻转' },
  { key: 'character_choice', label: '人物选择' },
  { key: 'state_change', label: '可追踪状态变化' },
  { key: 'cliffhanger_question', label: '结尾具体追问' },
];

export function buildAiComicEpisodeCommercialBeats(input: {
  episode: AiComicEpisodePlan;
  outline: string;
  coreTheme: string;
  premiseContract?: SeriesPremiseContract;
  existing?: AiComicEpisodeCommercialBeats;
  variantOffset?: number;
}): AiComicEpisodeCommercialBeats {
  const { episode } = input;
  const profile = resolveAiComicCommercialStoryProfile([
    input.outline,
    input.coreTheme,
    episode.story_phase,
  ].join('\n'));
  const variantIndex = episode.episode_no - 1 + (input.variantOffset ?? 0);
  const hookType = profile.opening_hook_types[variantIndex % profile.opening_hook_types.length];
  const sceneFunctionSequence = profile.scene_function_sequences[
    variantIndex % profile.scene_function_sequences.length
  ];
  const location = profile.signature_locations[variantIndex % profile.signature_locations.length];
  const signatureAction = profile.signature_actions[variantIndex % profile.signature_actions.length];
  const lockedCharacters = input.premiseContract?.locked_characters
    .filter(character => character.required)
    .map(character => character.name) ?? [];
  const protagonist = lockedCharacters[0] ?? episode.key_characters[0] ?? '主角';
  const witness = lockedCharacters[1] ?? episode.key_characters.find(name => name !== protagonist) ?? '同伴';
  const forces = input.premiseContract?.antagonistic_forces
    .filter(force => force.required)
    .map(force => force.label)
    .join('与') || '外部对手';
  const failureCost = input.premiseContract?.core_stakes[variantIndex % Math.max(1, input.premiseContract.core_stakes.length)]
    ?? `若本集判断失败，${protagonist}将失去继续追查${input.coreTheme}的关键机会`;
  const newInformation = episode.new_information.find(item => !/锁定|不得替换/.test(item))
    ?? episode.midpoint_turn
    ?? episode.main_conflict;
  const goalAction = conciseAction(newInformation, `查清《${episode.title}》的新证据`);
  const midpointTurn = episode.midpoint_turn?.trim()
    || `原本指向${forces}的证据被${witness}复核后，暴露出另一层触发条件。`;
  const hook3s = buildOpeningHook({
    hookType,
    episode,
    protagonist,
    witness,
    location,
    signatureAction,
    goalAction,
  });
  const openingDialogue = buildOpeningDialogue({
    hookType,
    episode,
    protagonist,
    witness,
    signatureAction,
  });
  const built: AiComicEpisodeCommercialBeats = {
    schema_version: 'ai-comic-episode-commercial-beats/v1',
    hook_3s: hook3s,
    opening_hook_type: hookType,
    episode_goal: `${protagonist}必须在本集结束前${goalAction}，并留下可由${witness}复核的结果。`,
    external_pressure: `${forces}在${location}${signatureAction}，迫使${protagonist}在证据和时限之间立即行动。`,
    failure_cost: `一旦失败，${failureCost.replace(/^失败代价[:：]?/, '')}。`,
    midpoint_turn: midpointTurn,
    character_choice: `${protagonist}选择${signatureAction}，拒绝用牺牲${witness}或掩盖证据换取暂时安全。`,
    state_change: buildCommercialStateChange({
      existing: episode.character_state_change?.trim() || episode.continuity_state_after[0],
      profileId: profile.profile_id,
      episodeNo: episode.episode_no,
      protagonist,
      witness,
    }),
    cliffhanger_question: buildCliffhangerQuestion(episode, protagonist, witness),
    opening_dialogue: openingDialogue,
    scene_function_sequence: sceneFunctionSequence,
    signature_combo: `${location}｜${protagonist}、${witness}｜${signatureAction}`,
  };
  if (!input.existing) return built;
  return {
    ...built,
    ...input.existing,
    schema_version: 'ai-comic-episode-commercial-beats/v1',
    scene_function_sequence: input.existing.scene_function_sequence.length >= 3
      ? input.existing.scene_function_sequence
      : built.scene_function_sequence,
  };
}

export function auditAiComicSeriesCommercialQuality(
  plan: AiComicSeriesPlan,
  humanReview: AiComicSeriesHumanReview = buildPendingAiComicSeriesHumanReview(),
  generatedEpisodeStoryIds: Record<string, string> = {},
): AiComicSeriesCommercialQualityAudit {
  const episodes = Array.isArray(plan.episodes) ? plan.episodes : [];
  const episodeReports = episodes.map(auditCommercialEpisode);
  const diversityReport = auditAiComicSeriesDiversity(plan);
  const episodesNeedAttention = episodeReports
    .filter(report => !report.machine_gate_passed)
    .map(report => report.episode_no);
  const episodeScore = episodeReports.length > 0
    ? Math.round(episodeReports.reduce((sum, report) => sum + report.score, 0) / episodeReports.length)
    : 0;
  const machineScore = Math.round(episodeScore * 0.75 + diversityReport.score * 0.25);
  const issues = [
    ...episodeReports.flatMap(report => report.issues.map(issue => `第${report.episode_no}集：${issue}`)),
    ...diversityReport.issues,
  ];
  const machineGatePassed = issues.length === 0 && machineScore >= 90;
  const requiredHumanReviewEpisodeNos = aiComicSeriesHumanReviewEpisodeNos(plan);
  const missingHumanReviewEpisodeNos = requiredHumanReviewEpisodeNos.filter(episodeNo => (
    !generatedEpisodeStoryIds[String(episodeNo)]
  ));
  const reviewContentFingerprint = buildAiComicSeriesReviewContentFingerprint(
    plan,
    generatedEpisodeStoryIds,
    requiredHumanReviewEpisodeNos,
  );
  const normalizedHumanReview = normalizeAiComicSeriesHumanReview(humanReview);
  const humanReviewIsStale = normalizedHumanReview.scores.length > 0
    && normalizedHumanReview.content_fingerprint !== reviewContentFingerprint;
  const effectiveHumanReview: AiComicSeriesHumanReview = humanReviewIsStale
    ? {
        ...normalizedHumanReview,
        status: 'stale',
        passed: undefined,
        issues: uniqueText([
          '当前系列文本或代表集分镜已变化；旧真人盲评不再计入当前版本，必须重新盲评',
          ...normalizedHumanReview.issues,
        ]),
      }
    : normalizedHumanReview;
  return {
    schema_version: 'ai-comic-series-commercial-quality-audit/v1',
    machine_gate_passed: machineGatePassed,
    machine_score: machineScore,
    ready_for_human_review: machineGatePassed && missingHumanReviewEpisodeNos.length === 0,
    required_human_review_episode_nos: requiredHumanReviewEpisodeNos,
    missing_human_review_episode_nos: missingHumanReviewEpisodeNos,
    review_content_fingerprint: reviewContentFingerprint,
    issues,
    episodes_need_attention: episodesNeedAttention,
    episode_reports: episodeReports,
    diversity_report: diversityReport,
    human_review: effectiveHumanReview,
  };
}

export function aiComicSeriesHumanReviewEpisodeNos(plan: AiComicSeriesPlan): number[] {
  const episodeCount = Math.max(
    1,
    plan.episode_count || (Array.isArray(plan.episodes) ? plan.episodes.length : 0) || 1,
  );
  return [...new Set([1, Math.ceil(episodeCount / 2), episodeCount])].sort((left, right) => left - right);
}

export function buildPendingAiComicSeriesHumanReview(): AiComicSeriesHumanReview {
  return {
    schema_version: 'ai-comic-series-human-review/v1',
    status: 'pending',
    blind_review_required: true,
    reviewer_count: 0,
    dimension_averages: {},
    scores: [],
    issues: ['尚未取得真人盲评；机器商业质量分不能替代编剧、导演与文化评审结论'],
  };
}

export function buildAiComicSeriesHumanReview(
  scores: AiComicHumanReviewScore[],
): AiComicSeriesHumanReview {
  const sanitized = scores.filter(score => (
    score.blind === true
    && HUMAN_REVIEW_DIMENSIONS.some(dimension => dimension.key === score.dimension)
    && score.score >= 1
    && score.score <= 5
    && Boolean(score.reviewer_id.trim())
  ));
  const dimensionAverages: AiComicSeriesHumanReview['dimension_averages'] = {};
  const missingDimensions: string[] = [];
  for (const dimension of HUMAN_REVIEW_DIMENSIONS) {
    const dimensionScores = sanitized.filter(score => score.dimension === dimension.key);
    if (dimensionScores.length === 0) {
      missingDimensions.push(dimension.label);
      continue;
    }
    dimensionAverages[dimension.key] = average(dimensionScores.map(score => score.score));
  }
  const averages = Object.values(dimensionAverages).filter((score): score is number => typeof score === 'number');
  const reviewerCount = new Set(sanitized.map(score => score.reviewer_id.trim())).size;
  const complete = missingDimensions.length === 0 && reviewerCount > 0;
  const overallAverage = complete ? average(averages) : undefined;
  const minimumDimensionAverage = complete ? Math.min(...averages) : undefined;
  const issues = [
    ...(reviewerCount === 0 ? ['尚无有效盲评 reviewer'] : []),
    ...(missingDimensions.length > 0 ? [`缺少真人盲评维度：${missingDimensions.join('、')}`] : []),
    ...(overallAverage !== undefined && overallAverage < 4 ? [`真人盲评总平均 ${overallAverage.toFixed(2)} 低于 4.00`] : []),
    ...(minimumDimensionAverage !== undefined && minimumDimensionAverage < 3
      ? [`真人盲评最低维度 ${minimumDimensionAverage.toFixed(2)} 低于 3.00`]
      : []),
  ];
  return {
    schema_version: 'ai-comic-series-human-review/v1',
    status: complete ? 'completed' : 'pending',
    blind_review_required: true,
    reviewer_count: reviewerCount,
    dimension_averages: dimensionAverages,
    overall_average: overallAverage,
    minimum_dimension_average: minimumDimensionAverage,
    passed: complete ? issues.length === 0 : undefined,
    scores: sanitized,
    issues,
  };
}

export function repairAiComicSeriesCommercialQuality(input: {
  plan: AiComicSeriesPlan;
  audit?: AiComicSeriesCommercialQualityAudit;
}): {
  success: boolean;
  improved: boolean;
  changed_episode_nos: number[];
  changed_fields: string[];
  before_score: number;
  after_score: number;
  plan: AiComicSeriesPlan;
  audit: AiComicSeriesCommercialQualityAudit;
  issues: string[];
} {
  const beforeAudit = input.audit ?? auditAiComicSeriesCommercialQuality(input.plan);
  const affected = new Set(beforeAudit.episodes_need_attention);
  for (const pair of beforeAudit.diversity_report.adjacent_pair_reports.filter(report => !report.passed)) {
    affected.add(pair.right_episode_no);
  }
  for (const group of beforeAudit.diversity_report.exact_opening_duplicate_groups) {
    group.episode_nos.slice(1).forEach(episodeNo => affected.add(episodeNo));
  }
  const changedEpisodeNos = [...affected].sort((left, right) => left - right);
  const repairedPlan: AiComicSeriesPlan = {
    ...input.plan,
    episodes: input.plan.episodes.map(episode => affected.has(episode.episode_no)
      ? {
          ...episode,
          commercial_beats: buildAiComicEpisodeCommercialBeats({
            episode,
            outline: input.plan.premise,
            coreTheme: input.plan.core_theme,
            premiseContract: input.plan.premise_contract,
            variantOffset: episode.episode_no + 1,
          }),
        }
      : episode),
  };
  const afterAudit = auditAiComicSeriesCommercialQuality(repairedPlan);
  const premisePassed = auditAiComicSeriesPremiseFidelity(repairedPlan).hard_gate_passed;
  const improved = afterAudit.machine_score > beforeAudit.machine_score
    || afterAudit.issues.length < beforeAudit.issues.length;
  const success = changedEpisodeNos.length > 0 && improved && premisePassed;
  return {
    success,
    improved,
    changed_episode_nos: changedEpisodeNos,
    changed_fields: changedEpisodeNos.map(episodeNo => `episodes[${episodeNo}].commercial_beats`),
    before_score: beforeAudit.machine_score,
    after_score: afterAudit.machine_score,
    plan: success ? repairedPlan : input.plan,
    audit: success ? afterAudit : beforeAudit,
    issues: [
      ...(!improved ? ['修复后商业质量或多样性没有改善，未标记成功'] : []),
      ...(!premisePassed ? ['修复会破坏 premise fidelity，已拒绝应用'] : []),
    ],
  };
}

function auditCommercialEpisode(episode: AiComicEpisodePlan): AiComicCommercialQualityEpisodeReport {
  const beats = episode.commercial_beats;
  const evidence = COMMERCIAL_BEAT_LABELS.map(item => {
    const value = beats?.[item.key]?.trim() ?? '';
    return {
      beat_key: item.key,
      label: item.label,
      matched: value.length >= 6,
      evidence_span: value || undefined,
    };
  });
  const issues = evidence.filter(item => !item.matched).map(item => `缺少${item.label}的可定位证据`);
  if (beats && !/[失败代价失去抹去无法后果]/.test(beats.failure_cost)) {
    issues.push('失败代价没有写出可感知后果');
  }
  if (beats && !/[选择决定拒绝宁可必须]/.test(beats.character_choice)) {
    issues.push('人物选择仍是事件描述，没有明确选择动作');
  }
  if (beats && !/[？?]$/.test(beats.cliffhanger_question.trim())) {
    issues.push('结尾追问不是具体问题');
  }
  if (beats && beats.scene_function_sequence.length < 3) {
    issues.push('场景功能序列少于 3 个推进节点');
  }
  const score = Math.max(0, Math.round((evidence.filter(item => item.matched).length / evidence.length) * 100)
    - Math.max(0, issues.length - evidence.filter(item => !item.matched).length) * 8);
  return {
    episode_no: episode.episode_no,
    machine_gate_passed: issues.length === 0 && score >= 90,
    score,
    evidence,
    issues,
  };
}

function buildOpeningHook(input: {
  hookType: AiComicEpisodeCommercialBeats['opening_hook_type'];
  episode: AiComicEpisodePlan;
  protagonist: string;
  witness: string;
  location: string;
  signatureAction: string;
  goalAction: string;
}): string {
  const title = input.episode.title.replace(/^第\d+集[:：]?\s*/, '');
  const episodeLabel = `第${input.episode.episode_no}集`;
  const variants: Record<AiComicEpisodeCommercialBeats['opening_hook_type'], string> = {
    visual_anomaly: `${episodeLabel}开场，${input.location}的白幕先于开灯显出“${title}”的反向影子，${input.protagonist}抬手时影子却没有同步。`,
    countdown: `${episodeLabel}时限只剩三十秒，${input.witness}发现完成“${input.goalAction}”所需的唯一证据正在自行褪色。`,
    forbidden_action: `${episodeLabel}刚开始，${input.witness}触碰标有“${title}”的禁物，${input.protagonist}的名字就从现场记录中消失。`,
    identity_gap: `${episodeLabel}的${input.location}，${input.protagonist}找到自己的双人签名，却当面问${input.witness}：“你是谁？”`,
    evidence_reversal: `${episodeLabel}被封存的“${title}”证据突然改指${input.protagonist}，而${input.witness}手里的原件仍指向相反方向。`,
    relationship_rupture: `${episodeLabel}开场，${input.witness}当众否认与${input.protagonist}共同经历过“${title}”，两人留下的实物证据却同时亮起。`,
  };
  return variants[input.hookType];
}

function buildOpeningDialogue(input: {
  hookType: AiComicEpisodeCommercialBeats['opening_hook_type'];
  episode: AiComicEpisodePlan;
  protagonist: string;
  witness: string;
  signatureAction: string;
}): string {
  const focus = input.episode.title.replace(/^第\d+集[:：]?\s*/, '');
  const variants: Record<AiComicEpisodeCommercialBeats['opening_hook_type'], string> = {
    visual_anomaly: `${input.witness}：“别动，幕上的你比你先抬手。”\n${input.protagonist}：“那就盯住它，我来追‘${focus}’留下的时间差。”`,
    countdown: `${input.protagonist}：“倒数结束前，我只验证一件事。”\n${input.witness}：“验证错了，我们失去的可不只是‘${focus}’。”`,
    forbidden_action: `${input.witness}：“我碰到了不该碰的东西。”\n${input.protagonist}：“先别道歉，告诉我‘${focus}’从哪一秒开始改写。”`,
    identity_gap: `${input.protagonist}：“你为什么拿着我们的共同证据？”\n${input.witness}：“因为在‘${focus}’之前，你还记得我的名字。”`,
    evidence_reversal: `${input.witness}：“两份证据都是真的，却给出相反答案。”\n${input.protagonist}：“那就执行${input.signatureAction}，找出谁改了验证条件。”`,
    relationship_rupture: `${input.witness}：“我不承认我们一起做过‘${focus}’。”\n${input.protagonist}：“可以，先解释为什么你的手印压在我的下面。”`,
  };
  return variants[input.hookType];
}

function buildCliffhangerQuestion(
  episode: AiComicEpisodePlan,
  protagonist: string,
  witness: string,
): string {
  const match = episode.ending_hook.match(/([^。！？!?]*[？?])\s*$/)?.[1]?.trim();
  if (match && match.length >= 6) return match.replace(/\?$/, '？');
  const ending = episode.ending_hook.replace(/[。！？!?]+$/g, '');
  return `${ending}之后，${protagonist}和${witness}下一集必须先相信谁留下的证据？`;
}

function buildCommercialStateChange(input: {
  existing?: string;
  profileId: 'rule_mystery' | 'heritage_stage_rescue' | 'serial_drama';
  episodeNo: number;
  protagonist: string;
  witness: string;
}): string {
  const existing = input.existing?.trim();
  if (existing && !/理解推进一层|状态出现可追踪变化|状态继续变化/.test(existing)) return existing;
  const index = (input.episodeNo - 1) % 5;
  const states = input.profileId === 'rule_mystery'
    ? [
        `${input.protagonist}从只信自身记忆转为接受${input.witness}保管的双人证据。`,
        `${input.protagonist}从被动遵守规则转为主动记录规则的触发条件。`,
        `${input.protagonist}与${input.witness}从互相防备转为共同承担一次失忆风险。`,
        `${input.protagonist}从追逐表面异常转为追查人为操控规则的证据。`,
        `${input.protagonist}从守住既有灯谱转为主动布置可复核的反证。`,
      ]
    : input.profileId === 'heritage_stage_rescue'
      ? [
          `${input.protagonist}从独自抢救旧物转为允许${input.witness}共同试做。`,
          `${input.protagonist}从追求一次成功转为记录可重复的方法。`,
          `${input.protagonist}从回避失败转为公开损伤与修复边界。`,
          `${input.protagonist}从证明自己转为让戏班成员接手复演。`,
          `${input.protagonist}从守住旧戏台转为建立可以继续传承的协作规则。`,
        ]
      : [
          `${input.protagonist}从观察问题转为承担第一次行动。`,
          `${input.protagonist}从坚持原判断转为接受新证据。`,
          `${input.protagonist}从独自承压转为与${input.witness}明确分工。`,
          `${input.protagonist}从规避代价转为公开自己的选择。`,
          `${input.protagonist}从解决眼前事件转为主动改变长期关系。`,
        ];
  return states[index];
}

function conciseAction(value: string, fallback: string): string {
  const normalized = value
    .replace(/^(?:本集|新增信息|推进|开启线索)[:：]?/, '')
    .replace(/[。！？!?]+$/g, '')
    .trim();
  if (!normalized) return fallback;
  return normalized.length > 80 ? `${normalized.slice(0, 80)}…` : normalized;
}

function normalizeAiComicSeriesHumanReview(review: AiComicSeriesHumanReview): AiComicSeriesHumanReview {
  if (review.scores.length === 0) return buildPendingAiComicSeriesHumanReview();
  return {
    ...buildAiComicSeriesHumanReview(review.scores),
    content_fingerprint: review.content_fingerprint,
    reviewed_episode_story_ids: review.reviewed_episode_story_ids,
    candidate_label: review.candidate_label,
    reviewer_packet_sha256: review.reviewer_packet_sha256,
  };
}

function buildAiComicSeriesReviewContentFingerprint(
  plan: AiComicSeriesPlan,
  generatedEpisodeStoryIds: Record<string, string>,
  requiredEpisodeNos: number[],
): string {
  const episodes = Array.isArray(plan.episodes) ? plan.episodes : [];
  const payload = {
    premise: plan.premise,
    core_theme: plan.core_theme,
    premise_contract: plan.premise_contract,
    episodes: episodes.map(episode => ({
      episode_no: episode.episode_no,
      title: episode.title,
      opening_hook: episode.opening_hook,
      main_conflict: episode.main_conflict,
      midpoint_turn: episode.midpoint_turn,
      ending_hook: episode.ending_hook,
      character_state_change: episode.character_state_change,
      commercial_beats: episode.commercial_beats,
    })),
    reviewed_episode_story_ids: Object.fromEntries(requiredEpisodeNos.map(episodeNo => [
      String(episodeNo),
      generatedEpisodeStoryIds[String(episodeNo)] ?? '',
    ])),
  };
  return `sha256:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
}

function uniqueText(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}
