import type {
  StoryGenerateResult,
  WritingCapabilityContinuityLedgerV1,
  WritingCapabilityQualityCheckV1,
  WritingCapabilityQualityReportV1,
  WritingCapabilityRuntimeContextV1,
} from '@shared/types.js';

export function evaluateWritingCapabilityQuality(input: {
  story: StoryGenerateResult;
  context?: WritingCapabilityRuntimeContextV1;
}): WritingCapabilityQualityReportV1 | undefined {
  const { context } = input;
  if (
    !context
    || context.status !== 'active'
    || input.story.video_type !== context.video_type
  ) {
    return undefined;
  }

  if (context.capability_id === 'short_drama_develop_write_review') {
    return evaluateShortDramaQuality(input.story, context);
  }
  if (context.capability_id === 'continuity_state_tracking') {
    return evaluateContinuityQuality(input.story, context);
  }
  if (context.capability_id === 'reader_simulation_review') {
    return evaluateMachineReaderQuality(input.story, context);
  }
  return undefined;
}

function evaluateShortDramaQuality(
  story: StoryGenerateResult,
  context: WritingCapabilityRuntimeContextV1,
): WritingCapabilityQualityReportV1 {

  const scenes = story.scene_breakdown;
  const fullText = storyText(story);
  const causalSceneIds = scenes
    .filter(scene => !hasCausalProgression(sceneText(scene)))
    .map(scene => scene.scene_id);
  const actionSceneIds = scenes
    .filter(scene => !hasVisibleAction(scene.key_action, scene.plot))
    .map(scene => scene.scene_id);
  const hookSceneIds = findWeakHookSceneIds(story);
  const checks: WritingCapabilityQualityCheckV1[] = [
    buildCheck({
      checkId: 'sd-runtime-causal-spine',
      failedSceneIds: causalSceneIds.length === scenes.length && !hasCausalProgression(fullText)
        ? causalSceneIds
        : [],
      passedMessage: '目标、压力、策略与局部结果形成了可定位因果链。',
      failedMessage: '目标—压力—策略—局部结果尚未形成可定位因果链。',
      repairHint: '在最早断裂场补出角色当前目标与压力，再让一次具体策略产生可见局部结果。',
    }),
    buildCheck({
      checkId: 'sd-runtime-visible-action',
      failedSceneIds: actionSceneIds,
      passedMessage: '全部场景均由具体行动或可见调度推进。',
      failedMessage: '部分场景只有说明或停顿，缺少可画、可演的推进动作。',
      repairHint: '把抽象判断改成角色、道具和空间中的具体动作，保留原 scene_id。',
    }),
    buildCheck({
      checkId: 'sd-runtime-hook-fulfillment',
      failedSceneIds: hookSceneIds,
      passedMessage: '开场压力和结尾结果/交接均可定位。',
      failedMessage: '开场压力或结尾结果/交接偏弱，追看承诺没有完成闭环。',
      repairHint: '只重写对应首尾场：首场建立即时压力，尾场给出局部结果并留下由因果产生的下一步。',
    }),
  ];
  return buildQualityReport({
    context,
    evaluationKind: 'short_drama_runtime',
    checks,
  });
}

function evaluateContinuityQuality(
  story: StoryGenerateResult,
  context: WritingCapabilityRuntimeContextV1,
): WritingCapabilityQualityReportV1 {
  const ledger = buildContinuityLedger(story);
  const objectConflictSceneIds = ledger.objects.flatMap(item => item.conflict_scene_ids);
  const openPromiseSceneIds = ledger.promises
    .filter(item => item.status === 'open')
    .flatMap(item => [item.setup_scene_id, story.scene_breakdown.at(-1)?.scene_id])
    .filter((sceneId): sceneId is number => sceneId !== undefined);
  const timelineSceneIds = story.scene_breakdown
    .filter(scene => (
      /(多年前|当年|幼时|往事|此前)/u.test(sceneText(scene))
      && !/(闪回|回忆|转述|画外音说明|时间切换)/u.test(sceneText(scene))
    ))
    .map(scene => scene.scene_id);
  const checks = [
    buildCheck({
      checkId: 'ct-runtime-object-state',
      failedSceneIds: uniqueNumbers(objectConflictSceneIds),
      passedMessage: '物件的出现、丢失、修复和再次使用顺序一致。',
      failedMessage: '物件在丢失或毁坏后未经找回/修复便再次使用。',
      repairHint: '只在冲突场之间补足找回、替换或修复动作；不得凭空恢复物件。',
    }),
    buildCheck({
      checkId: 'ct-runtime-open-promise',
      failedSceneIds: uniqueNumbers(openPromiseSceneIds),
      passedMessage: '已识别的承诺均有兑现或明确转化。',
      failedMessage: '故事建立了承诺或约定，但结尾没有兑现、失败结果或后续承接。',
      repairHint: '在结尾场明确承诺已兑现、未兑现的代价，或由因果产生的后续任务。',
    }),
    buildCheck({
      checkId: 'ct-runtime-timeline-marker',
      failedSceneIds: timelineSceneIds,
      passedMessage: '过去时线、闪回和转述均有显式标记。',
      failedMessage: '过去时线进入当前场景但缺少闪回、回忆或转述标记。',
      repairHint: '补一个明确的时线转换标记，不改写已确认事实或人物关系。',
    }),
  ];
  return buildQualityReport({
    context,
    evaluationKind: 'continuity_state_tracking',
    checks,
    continuityLedger: ledger,
  });
}

function evaluateMachineReaderQuality(
  story: StoryGenerateResult,
  context: WritingCapabilityRuntimeContextV1,
): WritingCapabilityQualityReportV1 {
  const scenes = story.scene_breakdown;
  const first = scenes[0];
  const last = scenes.at(-1);
  const unclearSceneIds = scenes
    .filter(scene => scene.key_action.trim().length < 2 || countReadableChars(scene.plot) < 20)
    .map(scene => scene.scene_id);
  const templateSceneIds = scenes
    .filter(scene => /(在这个时代|这不仅是.{0,18}更是|让我们|值得我们|文化的力量)/u.test(sceneText(scene)))
    .map(scene => scene.scene_id);
  const emotionVocabulary = ['害怕', '焦急', '犹豫', '愤怒', '震惊', '悲伤', '释然', '欣喜', '坚定', '紧张', '温暖'];
  const emotionCount = emotionVocabulary.filter(word => storyText(story).includes(word)).length;
  const checks = [
    buildCheck({
      checkId: 'rs-runtime-opening-promise',
      failedSceneIds: first && !/(要|必须|决定|危|急|阻|冲突|疑点|为什么|如何|？|\?)/u.test(`${story.logline} ${sceneText(first)}`)
        ? [first.scene_id]
        : [],
      passedMessage: '开场给出了可理解的问题、目标或观看承诺。',
      failedMessage: '开场只有主题判断，没有建立观众可以追踪的问题或目标。',
      repairHint: '在首场用一个具体问题、目标或即时变化建立观看承诺。',
    }),
    buildCheck({
      checkId: 'rs-runtime-information-clarity',
      failedSceneIds: unclearSceneIds,
      passedMessage: '每场的问题、变化和具体行动均可识别。',
      failedMessage: '部分场景只有抽象说明，难以判断谁做了什么、发生了什么变化。',
      repairHint: '补清人物、动作、对象和结果，删除不提供新信息的概念句。',
    }),
    buildCheck({
      checkId: 'rs-runtime-emotional-progression',
      failedSceneIds: emotionCount >= 2 ? [] : scenes.map(scene => scene.scene_id),
      passedMessage: '文本包含至少两个可区分的情绪状态或转折。',
      failedMessage: '情绪从头到尾没有可观察的变化，机器无法定位体验推进。',
      repairHint: '在关键选择前后各补一个由动作或表情体现的不同情绪状态。',
    }),
    buildCheck({
      checkId: 'rs-runtime-template-language',
      failedSceneIds: templateSceneIds,
      passedMessage: '未发现高频模板化价值判断。',
      failedMessage: '出现“这不仅是/让我们/文化的力量”等模板句，削弱具体观看体验。',
      repairHint: '用当前人物、物件和动作产生的具体意义替换模板化评价。',
    }),
    buildCheck({
      checkId: 'rs-runtime-ending-fulfillment',
      failedSceneIds: last && !/(结果|终于|成功|失败|改变|代价|回答|守住|失去|下一|仍未|？|\?)/u.test(sceneText(last))
        ? [last.scene_id]
        : [],
      passedMessage: '结尾给出结果、回答或可承接的下一步。',
      failedMessage: '结尾重复主题但没有结果、回答或由前文产生的下一步。',
      repairHint: '让尾场回应开场问题：给出结果、代价或明确的后续因果。',
    }),
  ];
  return buildQualityReport({
    context,
    evaluationKind: 'machine_reader_simulation',
    checks,
  });
}

function buildQualityReport(input: {
  context: WritingCapabilityRuntimeContextV1;
  evaluationKind: WritingCapabilityQualityReportV1['evaluation_kind'];
  checks: WritingCapabilityQualityCheckV1[];
  continuityLedger?: WritingCapabilityContinuityLedgerV1;
}): WritingCapabilityQualityReportV1 {
  const failedChecks = input.checks.filter(check => check.status === 'failed');
  return deepFreeze({
    schema_version: 'writing-capability-quality-report/v1',
    capability_id: input.context.capability_id,
    activation_id: input.context.activation_id,
    evaluation_kind: input.evaluationKind,
    score: Math.max(0, 100 - failedChecks.length * 20),
    passed: failedChecks.length === 0,
    checks: input.checks,
    failed_check_ids: failedChecks.map(check => check.check_id),
    applied_quality_rule_ids: input.context.rules.quality_rules.map(rule => rule.rule_id),
    ...(input.continuityLedger ? { continuity_ledger: input.continuityLedger } : {}),
    boundary: {
      deterministic_machine_evaluation: true,
      evidence_localized: true,
      human_feedback_claimed: false,
      third_party_code_executed: false,
    },
  });
}

export function writingCapabilityRepairActions(input: {
  report?: WritingCapabilityQualityReportV1;
  context?: WritingCapabilityRuntimeContextV1;
}): string[] {
  if (!input.report || !input.context) return [];
  const failedActions = input.report.checks
    .filter(check => check.status === 'failed' && check.repair_hint)
    .map(check => (
      `写作能力局部修复 [${check.check_id}]（scene_id=${check.scene_ids.join('、') || '全局'}）：${check.repair_hint}`
    ));
  const guidance = input.context.rules.repair_guidance.map(rule => (
    `写作能力修复准则 [${rule.rule_id}]：${rule.text}`
  ));
  return [...failedActions, ...guidance];
}

function buildCheck(input: {
  checkId: string;
  failedSceneIds: number[];
  passedMessage: string;
  failedMessage: string;
  repairHint: string;
}): WritingCapabilityQualityCheckV1 {
  const failed = input.failedSceneIds.length > 0;
  return {
    check_id: input.checkId,
    status: failed ? 'failed' : 'passed',
    scene_ids: input.failedSceneIds,
    message: failed ? input.failedMessage : input.passedMessage,
    ...(failed ? { repair_hint: input.repairHint } : {}),
  };
}

const TRACKED_OBJECT_LABELS = [
  '铜钥匙', '钥匙', '案卷', '书信', '书卷', '令牌', '玉佩', '地图', '药瓶', '印章', '灯笼', '佩剑', '木盒',
] as const;

function buildContinuityLedger(
  story: StoryGenerateResult,
): WritingCapabilityContinuityLedgerV1 {
  const characters = [...new Set(story.scene_breakdown.flatMap(scene => scene.characters))]
    .map(name => ({
      name,
      scene_ids: story.scene_breakdown
        .filter(scene => scene.characters.includes(name))
        .map(scene => scene.scene_id),
    }));
  const usedLabels = TRACKED_OBJECT_LABELS.filter(label => (
    story.scene_breakdown.some(scene => sceneText(scene).includes(label))
    && !TRACKED_OBJECT_LABELS.some(other => other !== label && other.includes(label)
      && story.scene_breakdown.some(scene => sceneText(scene).includes(other)))
  ));
  const objects = usedLabels.map(label => {
    const stateEvents: WritingCapabilityContinuityLedgerV1['objects'][number]['state_events'][number][] = [];
    for (const scene of story.scene_breakdown) {
      const text = sceneText(scene);
      if (!text.includes(label)) continue;
      let state: WritingCapabilityContinuityLedgerV1['objects'][number]['state_events'][number]['state'] = 'present';
      if (/(丢失|遗失|冲走|烧毁|毁坏|打碎|沉入|落入.{0,8}(江|河|海|水)|彻底失去)/u.test(text)) {
        state = 'lost_or_destroyed';
      } else if (
        /(找回|捞起|修复|修好|重新得到|替换|补配)/u.test(text)
        && !/(没有|未曾|尚未|并未|没能)(?:找回|捞起|修复|修好|重新得到|替换|补配)/u.test(text)
      ) {
        state = 'recovered_or_repaired';
      } else if (/(拿出|打开|递给|交给|使用|插入|握住|举起)/u.test(text)) {
        state = 'used';
      }
      stateEvents.push({ scene_id: scene.scene_id, state });
    }
    const conflictSceneIds: number[] = [];
    let unresolvedLossSceneId: number | undefined;
    for (const event of stateEvents) {
      if (event.state === 'lost_or_destroyed') unresolvedLossSceneId = event.scene_id;
      if (event.state === 'recovered_or_repaired') unresolvedLossSceneId = undefined;
      if (event.state === 'used' && unresolvedLossSceneId !== undefined) {
        conflictSceneIds.push(unresolvedLossSceneId, event.scene_id);
      }
    }
    return {
      label,
      scene_ids: stateEvents.map(event => event.scene_id),
      state_events: stateEvents,
      conflict_scene_ids: uniqueNumbers(conflictSceneIds),
    };
  });
  const promises = story.scene_breakdown.flatMap((scene, index) => {
    const text = sceneText(scene);
    const match = text.match(/([^。！？]{0,28}(?:答应|承诺|约定|一定(?:会|要)?|保证)[^。！？]{0,36})/u);
    if (!match) return [];
    const payoff = story.scene_breakdown.slice(index + 1).find(candidate => (
      /(兑现|做到|如约|终于.{0,12}(交给|完成|带回|守住)|完成约定|没有做到|未能兑现|违背承诺)/u
        .test(sceneText(candidate))
    ));
    return [{
      promise_id: `promise-${scene.scene_id}`,
      text: match[1].trim(),
      setup_scene_id: scene.scene_id,
      ...(payoff ? { payoff_scene_id: payoff.scene_id } : {}),
      status: payoff ? 'fulfilled' as const : 'open' as const,
    }];
  });
  return deepFreeze({ characters, objects, promises });
}

function uniqueNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function countReadableChars(text: string): number {
  return (text.match(/[\p{Script=Han}A-Za-z0-9]/gu) ?? []).length;
}

function findWeakHookSceneIds(story: StoryGenerateResult): number[] {
  const first = story.scene_breakdown[0];
  const last = story.scene_breakdown[story.scene_breakdown.length - 1];
  const weak: number[] = [];
  if (first && !/(危|急|逼|阻|冲突|疑点|倒计时|洪水|失踪|拒|必须|若不|否则|？|\?)/u.test(sceneText(first))) {
    weak.push(first.scene_id);
  }
  if (last && !/(结果|终于|守住|失败|成功|改变|代价|下一|却发现|仍未|危险|承接|？|\?)/u.test(sceneText(last))) {
    weak.push(last.scene_id);
  }
  return [...new Set(weak)];
}

function hasCausalProgression(text: string): boolean {
  const signalGroups = [
    /(目标|要|必须|决定|所求|想要|守住|救下)/u,
    /(压力|洪水|危机|阻力|逼|反对|冲突|倒塌|失去|来不及)/u,
    /(策略|计划|召集|组织|寻找|说服|改用|重查|采取|尝试)/u,
    /(结果|于是|因此|终于|成功|失败|守住|冲毁|改变|迫使|换来)/u,
  ];
  return signalGroups.filter(pattern => pattern.test(text)).length >= 3;
}

function hasVisibleAction(keyAction: string, plot: string): boolean {
  const text = `${keyAction} ${plot}`;
  if (keyAction.trim().length < 2) return false;
  return /(走|跑|推|拉|抬|放|拿|翻|写|召集|组织|说服|寻找|检查|阻拦|守|救|拒|拆|搭|系|喊|递|点燃|打开|关上|追|停|转身)/u.test(text);
}

function sceneText(scene: StoryGenerateResult['scene_breakdown'][number]): string {
  return [
    scene.title,
    scene.dramatic_function,
    scene.plot,
    scene.key_action,
    scene.conflict ?? '',
    scene.dialogue_or_narration ?? '',
  ].join(' ');
}

function storyText(story: StoryGenerateResult): string {
  return [
    story.logline,
    story.full_text,
    ...story.scene_breakdown.map(sceneText),
  ].join('\n');
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}
