import type {
  GearsDeliveryPackage,
  GearsSegment,
  NarrativePatternId,
  OutlineCoverageNode,
  OutlineCoverageReport,
  PatternQualityReport,
  PatternQualitySignal,
  QualityRepairAction,
  StoryGenerateResult,
  StoryQualityReport,
} from '@shared/types.js';
import { getGenreSampleGuidance, getGenreStoryProfile } from './genre-story-profiles.js';
import { getNarrativePatternDiagnostics, getNarrativePatternRepairActions } from './narrative-pattern-library.js';

export function enrichStoryQualityReport(input: {
  story: StoryGenerateResult;
  qualityReport: StoryQualityReport;
  narrativePatternIds?: NarrativePatternId[];
  gearsDelivery?: GearsDeliveryPackage;
}): StoryQualityReport {
  const outlineReport = buildOutlineCoverageReport(input.story);
  const patternReport = buildPatternQualityReport({
    story: input.story,
    qualityReport: input.qualityReport,
    narrativePatternIds: input.narrativePatternIds ?? [],
  });
  const gearsReport = buildGearsReadinessReport(input.story, input.gearsDelivery);
  const repairActionItems = buildRepairActionItems(outlineReport, patternReport, gearsReport);
  const mergedRepairActions = [
    ...(input.qualityReport.repair_actions ?? []),
    ...repairActionItems.map(item => item.prompt),
  ].filter((item, index, arr) => arr.indexOf(item) === index);

  const passed = input.qualityReport.passed
    && outlineReport.coverage_score >= 70
    && patternReport.pattern_score >= 70
    && gearsReport.readiness_score >= 70;

  return {
    ...input.qualityReport,
    passed,
    repair_actions: mergedRepairActions,
    outline_coverage_report: outlineReport,
    pattern_quality_report: patternReport,
    gears_readiness_report: gearsReport,
    repair_action_items: repairActionItems,
    repair_preview: buildCombinedPreview(outlineReport.preview, patternReport.preview, gearsReport.preview),
  };
}

function buildOutlineCoverageReport(story: StoryGenerateResult): OutlineCoverageReport {
  const sourceNodes = extractOutlineNodes(story);
  if (sourceNodes.length === 0) {
    return {
      schema_version: 'outline-coverage/v1',
      coverage_score: 100,
      total_nodes: 0,
      covered_nodes: 0,
      partial_nodes: 0,
      missing_nodes: 0,
      nodes: [],
      drift_items: [],
      unauthorized_events: [],
      repair_prompt: '未提供用户大纲；保持当前故事结构即可。',
      preview: '未检测到用户大纲，本报告仅保持兼容展示。',
    };
  }

  const nodes: OutlineCoverageNode[] = sourceNodes.map((text, index) => {
    const tokens = extractMeaningfulTokens(text);
    const matchedScenes = story.scene_breakdown
      .map(scene => {
        const sceneText = storySceneText(scene);
        const matched = tokens.filter(token => sceneText.includes(token));
        return { scene, matched };
      })
      .filter(item => item.matched.length > 0);
    const strongMatch = matchedScenes.some(item => item.matched.length >= Math.max(2, Math.ceil(tokens.length / 3)));
    const status: OutlineCoverageNode['status'] = strongMatch
      ? 'covered'
      : matchedScenes.length > 0
        ? 'partial'
        : 'missing';

    return {
      node_id: `outline-node-${index + 1}`,
      order: index + 1,
      text,
      status,
      matched_scene_ids: matchedScenes.map(item => item.scene.scene_id),
      evidence: matchedScenes
        .flatMap(item => item.matched)
        .filter((item, itemIndex, arr) => arr.indexOf(item) === itemIndex)
        .slice(0, 6),
      repair_hint: status === 'covered'
        ? '已在正文或场景中承接。'
        : `补回大纲节点「${shortText(text, 34)}」，并放入对应场景的行动、对白或转折。`,
    };
  });

  const coveredNodes = nodes.filter(node => node.status === 'covered').length;
  const partialNodes = nodes.filter(node => node.status === 'partial').length;
  const missingNodes = nodes.filter(node => node.status === 'missing').length;
  const coverageScore = Math.max(0, Math.round(((coveredNodes + partialNodes * 0.5) / nodes.length) * 100));
  const outlineTokens = new Set(sourceNodes.flatMap(extractMeaningfulTokens));
  const driftItems = story.scene_breakdown
    .filter(scene => outlineTokens.size > 0 && extractMeaningfulTokens(storySceneText(scene)).filter(token => outlineTokens.has(token)).length === 0)
    .map(scene => `场景 ${scene.scene_id}「${scene.title || scene.dramatic_function}」与用户大纲关键词连接较弱。`)
    .slice(0, 4);

  return {
    schema_version: 'outline-coverage/v1',
    coverage_score: coverageScore,
    total_nodes: nodes.length,
    covered_nodes: coveredNodes,
    partial_nodes: partialNodes,
    missing_nodes: missingNodes,
    nodes,
    drift_items: driftItems,
    unauthorized_events: driftItems,
    repair_prompt: [
      '按用户大纲顺序修正文稿。',
      ...nodes.filter(node => node.status !== 'covered').map(node => node.repair_hint),
      ...driftItems.map(item => `${item} 如非必要，压缩为背景或删除。`),
    ].join('\n'),
    preview: missingNodes > 0
      ? `补回 ${missingNodes} 个缺失大纲节点，优先修正第 ${nodes.filter(node => node.status === 'missing').map(node => node.order).join('、')} 节。`
      : partialNodes > 0
        ? `已有大纲承接，但 ${partialNodes} 个节点需要写成更明确的场景动作。`
        : '用户大纲节点已完成主要承接。',
  };
}

function buildPatternQualityReport(input: {
  story: StoryGenerateResult;
  qualityReport: StoryQualityReport;
  narrativePatternIds: NarrativePatternId[];
}): PatternQualityReport {
  const profile = getGenreStoryProfile(input.story.video_type);
  const sampleGuidance = getGenreSampleGuidance(input.story.video_type);
  const narrativeDiagnostics = getNarrativePatternDiagnostics({
    story: input.story,
    videoType: input.story.video_type,
    selectedPatternIds: input.narrativePatternIds,
  });
  const text = storyText(input.story);
  const signals: PatternQualitySignal[] = [];

  for (const field of profile.required_fields) {
    const missing = input.qualityReport.missing_required_elements?.includes(field) ?? false;
    signals.push({
      signal_id: `required-${field}`,
      label: `类型字段：${field}`,
      status: missing ? 'missing' : 'satisfied',
      source: 'required_field',
      impact: '类型必填字段决定前端和供稿侧是否能拿到完整生产信息。',
      gap: missing ? `缺少 ${field}。` : '已填写。',
      suggested_scene_ids: [],
      repair_hint: missing ? `补充 ${field}，并让它和正文场景一致。` : '保持一致即可。',
    });
  }

  for (const weakBeat of input.qualityReport.weak_beats ?? []) {
    const order = Number(weakBeat.match(/^(\d+)\./)?.[1]);
    const beat = Number.isFinite(order)
      ? input.story.story_blueprint?.genre_beats.find(item => item.order === order)
      : undefined;
    signals.push({
      signal_id: `weak-beat-${signals.length + 1}`,
      label: beat?.function_label ?? weakBeat,
      status: 'weak',
      source: 'genre_beat',
      impact: '节拍偏弱会让故事停留在摘要层，缺少可见行动和转折。',
      gap: weakBeat,
      suggested_scene_ids: beat?.scene_id ? [beat.scene_id] : [],
      repair_hint: beat?.scene_id
        ? `强化场景 ${beat.scene_id}：${beat.content_requirement}`
        : `按类型蓝图补强：${weakBeat}`,
    });
  }

  for (const diagnostic of narrativeDiagnostics) {
    signals.push({
      signal_id: `pattern-${diagnostic.diagnostic_id}`,
      label: `${diagnostic.pattern_label}：${diagnostic.signal}`,
      status: diagnostic.status,
      source: 'narrative_pattern',
      impact: diagnostic.impact,
      gap: diagnostic.gap,
      suggested_scene_ids: diagnostic.suggested_scene_ids,
      repair_hint: diagnostic.repair_hint,
    });
  }

  for (const signal of [...sampleGuidance.quality_signals, ...profile.quality_rules]) {
    const status = hasSignalText(text, signal) ? 'satisfied' : 'weak';
    signals.push({
      signal_id: `signal-${signals.length + 1}`,
      label: signal,
      status,
      source: sampleGuidance.quality_signals.includes(signal)
        ? 'sample_signal'
        : 'genre_rule',
      impact: '流派信号决定用户选择的叙事机制是否被看见。',
      gap: status === 'satisfied' ? '已在正文中出现相关表达。' : `缺少可感知的「${signal}」。`,
      suggested_scene_ids: suggestedSceneIdsForSignal(input.story, signal),
      repair_hint: status === 'satisfied'
        ? '保持当前表达。'
        : `把「${signal}」写进动作、冲突、选择或镜头，不要只加标签。`,
    });
  }

  const satisfied = signals.filter(signal => signal.status === 'satisfied');
  const weak = signals.filter(signal => signal.status !== 'satisfied');
  const signalScore = Math.round((satisfied.length / Math.max(1, signals.length)) * 100);
  const patternScore = Math.max(0, Math.min(100, typeof input.qualityReport.genre_score === 'number'
    ? Math.round((input.qualityReport.genre_score * 0.45) + (signalScore * 0.55))
    : signalScore));
  const repairActions = [
    ...weak.map(signal => signal.repair_hint),
    ...getNarrativePatternRepairActions(input.story.video_type, input.narrativePatternIds),
  ].filter((item, index, arr) => arr.indexOf(item) === index);

  return {
    schema_version: 'pattern-quality/v1',
    pattern_score: patternScore,
    satisfied_signals: satisfied,
    weak_signals: weak,
    gaps: weak.map(signal => signal.gap).slice(0, 10),
    repair_prompt: repairActions.join('\n'),
    preview: weak.length > 0
      ? `补强 ${weak.length} 个流派信号，优先处理 ${weak.slice(0, 3).map(signal => signal.label).join('、')}。`
      : '流派信号已达到当前类型要求。',
  };
}

function buildGearsReadinessReport(
  story: StoryGenerateResult,
  delivery: GearsDeliveryPackage | undefined,
) {
  const satisfied: string[] = [];
  const issues: string[] = [];
  const assetGaps: string[] = [];
  const unitGaps: string[] = [];
  const promptGaps: string[] = [];

  if ((story.characters?.length ?? 0) > 0 || (delivery?.character_assets.length ?? 0) > 0) {
    satisfied.push('已派生角色资产。');
  } else {
    assetGaps.push('缺少角色资产，至少需要主角、关键配角或群像说明。');
  }

  if ((delivery?.scene_assets.length ?? 0) > 0) satisfied.push('已派生场景资产。');
  else assetGaps.push('缺少场景资产，GEARS 无法稳定复用空间。');

  if ((delivery?.units.length ?? 0) > 0 || story.gears_segments.length > 0) satisfied.push('已有分段供稿单元。');
  else unitGaps.push('缺少 GEARS 分段或供稿单元。');

  for (const scene of story.scene_breakdown) {
    const sceneLabel = `场景 ${scene.scene_id}「${scene.title || scene.dramatic_function}」`;
    if (countContentChars(scene.plot) < 35) unitGaps.push(`${sceneLabel}剧情过薄，需写出地点、动作、冲突/发现和情绪变化。`);
    if (!scene.key_action?.trim()) unitGaps.push(`${sceneLabel}缺少关键动作。`);
    if (!scene.characters?.length) assetGaps.push(`${sceneLabel}缺少角色列表。`);
    if (!scene.visual_prompt?.trim()) promptGaps.push(`${sceneLabel}缺少画面提示。`);
    else if (hasPromptNoise(scene.visual_prompt)) promptGaps.push(`${sceneLabel}画面提示混入说明性内容，应只保留空间、人物、道具、光线和构图。`);
  }

  for (const segment of story.gears_segments) {
    const segmentIssues = inspectGearsSegment(segment);
    if (segmentIssues.length === 0) continue;
    promptGaps.push(`段落 ${segment.segment_id}: ${segmentIssues.join('；')}`);
  }

  issues.push(...assetGaps, ...unitGaps, ...promptGaps, ...(delivery?.validation_notes ?? []));
  const readinessScore = Math.max(0, 100 - assetGaps.length * 12 - unitGaps.length * 10 - promptGaps.length * 8 - (delivery?.validation_notes.length ?? 0) * 6);

  return {
    schema_version: 'gears-readiness/v1' as const,
    readiness_score: readinessScore,
    ready: readinessScore >= 70 && issues.length === 0,
    satisfied_items: satisfied,
    issue_items: issues.slice(0, 14),
    asset_gaps: assetGaps.slice(0, 8),
    unit_gaps: unitGaps.slice(0, 8),
    prompt_gaps: promptGaps.slice(0, 8),
    repair_prompt: [
      ...assetGaps.map(item => `补资产：${item}`),
      ...unitGaps.map(item => `补供稿单元：${item}`),
      ...promptGaps.map(item => `清理画面提示：${item}`),
    ].join('\n'),
    preview: issues.length > 0
      ? `修复后将补齐资产、分段正文和画面提示中的 ${issues.length} 个交付缺口。`
      : 'GEARS 供稿已达到当前交付要求。',
  };
}

function buildRepairActionItems(
  outlineReport: OutlineCoverageReport,
  patternReport: PatternQualityReport,
  gearsReport: ReturnType<typeof buildGearsReadinessReport>,
): QualityRepairAction[] {
  const actions: QualityRepairAction[] = [];
  if (outlineReport.coverage_score < 90) {
    const sceneIds = outlineReport.nodes
      .filter(node => node.status !== 'covered')
      .flatMap(node => node.matched_scene_ids.length > 0 ? node.matched_scene_ids : [node.order])
      .filter(uniqueNumber);
    actions.push({
      action_id: 'repair-outline-coverage',
      label: '修复大纲覆盖',
      target_report: 'outline',
      severity: outlineReport.coverage_score < 60 ? 'high' : 'medium',
      scene_ids: sceneIds,
      prompt: outlineReport.repair_prompt,
      expected_effect: outlineReport.preview,
    });
  }
  if (patternReport.weak_signals.length > 0) {
    actions.push({
      action_id: 'repair-pattern-quality',
      label: '补强流派信号',
      target_report: 'pattern',
      severity: patternReport.pattern_score < 60 ? 'high' : 'medium',
      scene_ids: patternReport.weak_signals.flatMap(signal => signal.suggested_scene_ids).filter(uniqueNumber),
      prompt: patternReport.repair_prompt,
      expected_effect: patternReport.preview,
    });
  }
  if (!gearsReport.ready) {
    actions.push({
      action_id: 'repair-gears-readiness',
      label: '修复 GEARS 交付',
      target_report: 'gears',
      severity: gearsReport.readiness_score < 60 ? 'high' : 'medium',
      scene_ids: [
        ...sceneIdsFromMessages(gearsReport.asset_gaps),
        ...sceneIdsFromMessages(gearsReport.unit_gaps),
        ...sceneIdsFromMessages(gearsReport.prompt_gaps),
      ].filter(uniqueNumber),
      prompt: gearsReport.repair_prompt,
      expected_effect: gearsReport.preview,
    });
  }
  if (actions.length > 1) {
    actions.push({
      action_id: 'repair-combined-workflow',
      label: '一键综合修复',
      target_report: 'combined',
      severity: actions.some(action => action.severity === 'high') ? 'high' : 'medium',
      scene_ids: actions.flatMap(action => action.scene_ids).filter(uniqueNumber),
      prompt: actions.map(action => `【${action.label}】\n${action.prompt}`).join('\n\n'),
      expected_effect: buildCombinedPreview(outlineReport.preview, patternReport.preview, gearsReport.preview),
    });
  }
  return actions;
}

function extractOutlineNodes(story: StoryGenerateResult): string[] {
  const adaptationNodes = story.adaptation_analysis?.plot_beats ?? [];
  const outline = story.original_user_query ?? '';
  const rawNodes = outline
    .split(/\n+|[；;。！？!?]/)
    .map(item => item.replace(/^\s*[-*0-9一二三四五六七八九十、.）)]+/, '').trim())
    .filter(item => item.length >= 6)
    .slice(0, 10);
  const nodes = adaptationNodes.length > 0 ? adaptationNodes : rawNodes;
  return nodes
    .map(item => item.trim())
    .filter((item, index, arr) => item && arr.indexOf(item) === index)
    .slice(0, 10);
}

function storyText(story: StoryGenerateResult): string {
  return [
    story.title,
    story.logline,
    story.theme,
    story.full_text,
    ...story.scene_breakdown.map(storySceneText),
  ].filter(Boolean).join('\n');
}

function storySceneText(scene: StoryGenerateResult['scene_breakdown'][number]): string {
  return [
    scene.title,
    scene.location,
    scene.dramatic_function,
    scene.plot,
    scene.key_action,
    scene.conflict,
    scene.dialogue_or_narration,
    scene.visual_prompt,
    scene.camera_suggestion,
    ...(scene.characters ?? []),
  ].filter(Boolean).join(' ');
}

function extractMeaningfulTokens(text: string): string[] {
  const blocked = new Set([
    '故事', '人物', '场景', '一个', '他们', '我们', '需要', '开始', '后来', '最后',
    '必须', '保留', '原作', '核心', '情绪', '选择', '镜头', '画面', '主角',
  ]);
  const matches = text.match(/[\u4e00-\u9fa5]{2,8}|[A-Za-z0-9]{3,}/g) ?? [];
  return matches
    .map(item => item.trim())
    .filter(item => item.length >= 2 && !blocked.has(item))
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .slice(0, 12);
}

function hasSignalText(text: string, signal: string): boolean {
  const tokens = extractMeaningfulTokens(signal);
  if (tokens.length === 0) return text.includes(signal);
  return tokens.some(token => text.includes(token));
}

function suggestedSceneIdsForSignal(story: StoryGenerateResult, signal: string): number[] {
  const matched = story.scene_breakdown
    .filter(scene => hasSignalText(storySceneText(scene), signal))
    .map(scene => scene.scene_id);
  if (matched.length > 0) return matched.slice(0, 3);
  const target = signal.includes('开头') || signal.includes('目标')
    ? story.scene_breakdown[0]
    : signal.includes('结尾') || signal.includes('落点')
      ? story.scene_breakdown[story.scene_breakdown.length - 1]
      : story.scene_breakdown[Math.max(0, Math.floor(story.scene_breakdown.length / 2))];
  return target ? [target.scene_id] : [];
}

function inspectGearsSegment(segment: GearsSegment): string[] {
  const issues: string[] = [];
  if (countContentChars(segment.script_text) < 35) issues.push('脚本文本过薄');
  if (segment.visual_focus.length === 0) issues.push('缺少视觉焦点');
  if (!segment.segment_prompt_hint?.trim()) issues.push('缺少生成提示');
  else if (hasPromptNoise(segment.segment_prompt_hint)) issues.push('生成提示含说明性内容');
  return issues;
}

function hasPromptNoise(value: string): boolean {
  return [
    '质量信号',
    '建议调整',
    '类型匹配',
    '资料',
    '摘要',
    '为什么',
    '故事',
    '核心画面是',
  ].some(word => value.includes(word));
}

function countContentChars(text: string): number {
  return (text.match(/[\p{Script=Han}A-Za-z0-9]/gu) ?? []).length;
}

function shortText(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function uniqueNumber(value: number, index: number, arr: number[]): boolean {
  return Number.isFinite(value) && arr.indexOf(value) === index;
}

function sceneIdsFromMessages(items: string[]): number[] {
  return items
    .map(item => Number(item.match(/场景\s*(\d+)/)?.[1]))
    .filter(Number.isFinite);
}

function buildCombinedPreview(...items: string[]): string {
  return items.filter(Boolean).join('；');
}
