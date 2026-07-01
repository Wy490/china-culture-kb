import type {
  GearsDeliveryPackage,
  GearsSegment,
  AudienceTextField,
  AudienceTextReport,
  NarrativePatternId,
  OutlineCoverageNode,
  OutlineCoverageReport,
  PatternQualityReport,
  PatternQualitySignal,
  ProductionMaterialQualityReport,
  ProductionMaterialReadinessReport,
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
  const productionMaterialReport = buildProductionMaterialQualityReport(input.story.production_material_readiness);
  const audienceReport = buildAudienceTextReport(input.story);
  const repairActionItems = buildRepairActionItems(outlineReport, patternReport, gearsReport, productionMaterialReport, audienceReport);
  const mergedRepairActions = [
    ...(input.qualityReport.repair_actions ?? []),
    ...repairActionItems.map(item => item.prompt),
  ].filter((item, index, arr) => arr.indexOf(item) === index);

  const passed = input.qualityReport.passed
    && outlineReport.coverage_score >= 70
    && patternReport.pattern_score >= 70
    && gearsReport.readiness_score >= 70
    && (productionMaterialReport?.passed ?? true)
    && audienceReport.clean;

  return {
    ...input.qualityReport,
    passed,
    repair_actions: mergedRepairActions,
    outline_coverage_report: outlineReport,
    pattern_quality_report: patternReport,
    gears_readiness_report: gearsReport,
    production_material_readiness_report: productionMaterialReport,
    audience_text_report: audienceReport,
    repair_action_items: repairActionItems,
    repair_preview: buildCombinedPreview(
      outlineReport.preview,
      patternReport.preview,
      gearsReport.preview,
      productionMaterialReport?.preview ?? '',
      audienceReport.preview,
    ),
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
  productionMaterialReport: ProductionMaterialQualityReport | undefined,
  audienceReport: AudienceTextReport,
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
  if (productionMaterialReport && !productionMaterialReport.passed) {
    actions.push({
      action_id: 'repair-production-material-readiness',
      label: '补齐生产素材',
      target_report: 'production_material',
      severity: productionMaterialReport.status === 'blocked'
        || productionMaterialReport.missing_blocking_fields.length > 0
        || productionMaterialReport.score < 60
        ? 'high'
        : 'medium',
      scene_ids: [],
      prompt: productionMaterialReport.repair_prompt,
      expected_effect: productionMaterialReport.preview,
    });
  }
  if (!audienceReport.clean) {
    actions.push({
      action_id: 'repair-audience-text',
      label: '清理观众稿检测词',
      target_report: 'audience',
      severity: audienceReport.issue_count >= 4 ? 'high' : 'medium',
      scene_ids: audienceReport.issue_items.flatMap(issue => issue.scene_id ? [issue.scene_id] : []).filter(uniqueNumber),
      prompt: audienceReport.repair_prompt,
      expected_effect: audienceReport.preview,
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
      expected_effect: buildCombinedPreview(
        outlineReport.preview,
        patternReport.preview,
        gearsReport.preview,
        productionMaterialReport?.preview ?? '',
        audienceReport.preview,
      ),
    });
  }
  return actions;
}

function buildProductionMaterialQualityReport(
  report: ProductionMaterialReadinessReport | undefined,
): ProductionMaterialQualityReport | undefined {
  if (!report) return undefined;

  const missingBlockingFields = report.missing_fields.filter(field => field.blocking_level === 'blocking');
  const missingRiskFields = report.missing_fields.filter(field => field.blocking_level === 'risk');
  const missingOptionalFields = report.missing_fields.filter(field => field.blocking_level === 'optional');
  const passed = report.status === 'ready'
    && report.score >= 70
    && missingBlockingFields.length === 0;
  const missingLabels = report.missing_fields.map(field => field.label).filter((item, index, arr) => arr.indexOf(item) === index);
  const questions = [
    ...report.recommended_next_questions,
    ...report.missing_fields.map(field => field.recommended_question),
  ].filter(Boolean).filter((item, index, arr) => arr.indexOf(item) === index);
  const repairPrompt = passed
    ? `生产素材已满足「${report.pack_label}」模板，保持字段与正文一致即可。`
    : [
        `当前「${report.pack_label}」生产素材状态：${report.status}，分数 ${report.score}/100。`,
        ...report.missing_fields.map(field =>
          `补充【${field.label}】（${field.stage}/${field.blocking_level}）：${field.reason} 建议提问：${field.recommended_question}`,
        ),
        ...(questions.length > 0 ? ['优先补充问题：', ...questions.map(question => `- ${question}`)] : []),
      ].join('\n');

  return {
    schema_version: 'production-material-quality/v1',
    status: report.status,
    score: report.score,
    passed,
    pack_label: report.pack_label,
    video_type: report.video_type,
    missing_blocking_fields: missingBlockingFields,
    missing_risk_fields: missingRiskFields,
    missing_optional_fields: missingOptionalFields,
    gate_statuses: report.gate_reports.map(gate => ({
      stage: gate.stage,
      status: gate.status,
      missing_count: gate.missing_fields.length,
    })),
    recommended_next_questions: questions,
    repair_prompt: repairPrompt,
    preview: passed
      ? `生产素材已满足「${report.pack_label}」模板。`
      : `生产素材需补 ${report.missing_fields.length} 项：${missingLabels.slice(0, 6).join('、') || '请查看模板缺口'}。`,
  };
}

function buildAudienceTextReport(story: StoryGenerateResult): AudienceTextReport {
  const fields: Array<{
    field: AudienceTextField;
    label: string;
    text: string;
    scene_id?: number;
    segment_id?: number;
  }> = [
    { field: 'full_text', label: '正文', text: story.full_text },
    { field: 'theme', label: '主题', text: story.theme },
    { field: 'logline', label: '一句话梗概', text: story.logline },
    ...story.scene_breakdown.flatMap(scene => [
      { field: 'scene_plot' as const, label: `场景 ${scene.scene_id} 剧情`, text: scene.plot, scene_id: scene.scene_id },
      {
        field: 'scene_dialogue_or_narration' as const,
        label: `场景 ${scene.scene_id} 对白/旁白`,
        text: scene.dialogue_or_narration ?? '',
        scene_id: scene.scene_id,
      },
    ]),
    ...story.gears_segments.flatMap(segment => [
      {
        field: 'gears_script_text' as const,
        label: `GEARS 段落 ${segment.segment_id} script_text`,
        text: segment.script_text,
        scene_id: segment.source_scene_id,
        segment_id: segment.segment_id,
      },
      {
        field: 'gears_segment_prompt_hint' as const,
        label: `GEARS 段落 ${segment.segment_id} segment_prompt_hint`,
        text: segment.segment_prompt_hint ?? '',
        scene_id: segment.source_scene_id,
        segment_id: segment.segment_id,
      },
    ]),
  ];
  const issues = fields.flatMap((field, index) => {
    const matchedTerms = audienceTextPollutionTerms().filter(term => field.text.includes(term));
    if (matchedTerms.length === 0) return [];
    return [{
      issue_id: `audience-text-${index + 1}`,
      field: field.field,
      label: field.label,
      scene_id: field.scene_id,
      segment_id: field.segment_id,
      matched_terms: matchedTerms,
      excerpt: excerptAroundTerm(field.text, matchedTerms[0]),
      repair_hint: `${field.label}去掉「${matchedTerms.join('、')}」等检测词，用可见动作、对白、后果或自然旁白承载同一信息。`,
    }];
  });
  const pollutedTerms = issues
    .flatMap(issue => issue.matched_terms)
    .filter((term, index, arr) => arr.indexOf(term) === index);

  return {
    schema_version: 'audience-text/v1',
    clean: issues.length === 0,
    issue_count: issues.length,
    issue_items: issues.slice(0, 12),
    polluted_terms: pollutedTerms,
    repair_prompt: issues.length > 0
      ? [
          '清理观众会直接读到的正文、场景文本和 GEARS 脚本文本。',
          '不要删除目标、阻力、选择后果、因果推进或史实说明；把检测词改写成剧情动作、对白、可见代价和自然创作边界说明。',
          ...issues.map(issue => `- ${issue.repair_hint} 示例片段：${issue.excerpt}`),
        ].join('\n')
      : '观众字段未发现内部质量标签；保持自然表达即可。',
    preview: issues.length > 0
      ? `清理 ${issues.length} 个观众字段检测词痕迹：${pollutedTerms.slice(0, 6).join('、')}。`
      : '观众字段未发现检测词痕迹。',
  };
}

function audienceTextPollutionTerms(): string[] {
  return [
    '主角目标',
    '目标明确',
    '选择有代价',
    '因果链',
    '行动具体',
    '人物不是年表',
    '史实边界',
    '质量信号',
    '生成优先级',
    '类型匹配',
    '建议调整',
    '资料显示',
    '核心画面是',
    '为什么必须面对',
    '流派质量',
    '必须有主角目标',
    '必须有阻力',
    '必须有选择和代价',
  ];
}

function excerptAroundTerm(text: string, term: string): string {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const index = cleanText.indexOf(term);
  if (index < 0) return shortText(cleanText, 80);
  const start = Math.max(0, index - 24);
  const end = Math.min(cleanText.length, index + term.length + 36);
  return `${start > 0 ? '...' : ''}${cleanText.slice(start, end)}${end < cleanText.length ? '...' : ''}`;
}

function extractOutlineNodes(story: StoryGenerateResult): string[] {
  const adaptationNodes = story.adaptation_analysis?.plot_beats ?? [];
  const outline = story.original_user_query ?? '';
  if (adaptationNodes.length === 0 && !isLikelyStructuredOutline(outline)) {
    return [];
  }
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

function isLikelyStructuredOutline(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (value.includes('\n')) return true;
  if (/^(\s*[-*]|\s*\d+[.、]|[一二三四五六七八九十]+[.、])/.test(value)) return true;
  if (/系列名|本集|第\s*\d+\s*集|第[一二三四五六七八九十]+集|分镜|大纲|主线|spine-|phase-|开场|中段|结尾|角色变化|承接|伏笔|回收/.test(value)) {
    return true;
  }
  return false;
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
  if (hasSemanticSignalEvidence(text, signal)) return true;

  const tokens = extractMeaningfulTokens(signal);
  if (tokens.length === 0) return text.includes(signal);
  return tokens.some(token => text.includes(token));
}

function hasSemanticSignalEvidence(text: string, signal: string): boolean {
  const compactText = text.replace(/\s+/g, '');
  const checks: Array<[RegExp, RegExp[]]> = [
    [/目标明确|人物目标清楚|必须有主角目标/, [/所求/, /要弄清/, /为了/, /求学不是/, /志向/, /书袋内侧写下/, /不能签字/, /要先看清事实/, /重查/, /重问证人/, /承担亡国之痛/, /还能把什么留给后人/]],
    [/阻力具体|必须有阻力|制度压力可见/, [/官场规则/, /制度压力/, /名声/, /人情/, /催客/, /浊浪/, /路远/, /书卷会湿/, /行程.{0,6}误/, /知军.{0,8}催/, /催他签字/, /此案已定/, /得罪上官/, /可能丢官/, /获罪/, /长官权威/, /国都失陷/, /亡国之痛/]],
    [/两难成立/, [/若[^。；]+；若/, /一边[^。；]+一边/, /赶路.{0,12}帮人/, /安稳.{0,12}远行/]],
    [/选择有代价|必须有选择和代价/, [/错过渡船/, /书卷会湿/, /行程.{0,6}误/, /泥痕/, /误一程/, /付出/, /书页.{0,6}皱/, /丢官/, /获罪/, /仕途代价/, /交还任命文书/, /准备辞官/, /得罪上官/, /永别/, /投江/, /怀石/, /一身沉入/]],
    [/行动具体/, [/系紧/, /停下脚步/, /蹲下/, /扶起/, /挽起/, /踩进/, /捞起/, /裹书/, /写下/, /长揖/, /背起/, /收起/]],
    [/精神落点来自选择|结尾有人物变化/, [/守良知/, /守住/, /正义/, /廉洁/, /出淤泥而不染/, /更清楚的心/, /泥痕/, /继续上路/, /守.{0,4}心/, /囚犯因此免死/, /承担仕途代价/, /退回的不是/, /精神坐标/, /忠愤/, /后世反复讲述/]],
    [/因果链清楚|事件因果清楚|必须有事件因果/, [/因为/, /于是/, /导致/, /若[^。；]+；若/, /才/, /看见.{0,12}生出/, /生出.{0,12}承担/, /愿意承担.{0,12}才/, /忽然发现/, /郢都失守/, /流放无归/, /不愿苟活/, /发现疑点/, /疑点重重/, /证词前后不合/, /证据不足/, /只待.{0,6}画押/, /因此免死/]],
    [/人物不是年表|不得写成年表式介绍/, [/(少年周敦颐|周敦颐).*(背起|停下脚步|蹲下|挽起|踩进|写下|停住笔|重查|翻到案卷|不能签字|退回|交还任命文书|逐页细读|记录疑点)/, /屈原.*(站在风里|走向汨罗江|整理衣冠|怀石|投江)/]],
    [/史实边界明确|必须标注创作边界|必须有事实边界/, [/影视化创作/, /事实边界/, /史实边界/, /再现边界/, /确证/, /可考/, /据《?史记/, /传统叙述/, /不是《爱莲说》/, /不把.{0,20}写成/, /仍要说清/, /只作.{0,8}伏笔/]],
    [/必须有时代压力|制度压力可见/, [/郢都失守/, /流放/, /亡国/, /楚国/, /上官/, /催签/, /制度压力/, /官场规则/]],
    [/必须有对白或强旁白|对白密度高/, [/：/, /问/, /说/, /低声/, /反问/, /旁白/, /若有冤情/, /这一笔就是人命/, /不是旁观/]],
    [/必须有结尾钩子|结尾钩子强|钩子可承接/, [/门外/, /下一/, /又牵出/, /封存/, /案号/, /未完/, /新证/, /反常/, /必须解释/]],
    [/必须有表情动作|表情动作明确|开场有强画面/, [/特写/, /定格/, /烛火/, /案卷/, /停住笔/, /推开/, /翻开/, /重查/, /江水/, /怀石/, /针尖/, /绣架/]],
    [/必须有工艺流程|流程完整/, [/劈丝/, /穿针/, /落针/, /收针/, /配色/, /理顺/, /检查/, /从.{0,6}到成品/]],
    [/必须有材料或工具|材料工具清楚/, [/丝线/, /绸面/, /图样/, /绣架/, /针尖/, /底布/, /工具/, /材料/]],
    [/必须有传承关系|传承关系/, [/匠人/, /传承/, /学徒/, /老手/, /年轻人/, /交给/, /练习/]],
    [/必须有现实现场|现场明确/, [/现场/, /今天/, /匾额/, /台基/, /展陈/, /旧地图/, /旧照片/, /镜头从/]],
    [/必须有来源提示|来源提示存在/, [/据/, /文献/, /可考/, /史料/, /版本/, /来源/, /传统叙述/]],
    [/必须有核心主张|符号鲜明|视觉符号/, [/成品/, /纹样/, /主张/, /符号/, /定格/, /绣面/, /匾额/, /案卷/]],
    [/必须有当代连接|古今连接自然/, [/今天/, /当代/, /回到/, /传承/, /展陈/, /现实/, /年轻/]],
  ];

  return checks.some(([pattern, evidence]) =>
    pattern.test(signal) && evidence.some(item => item.test(compactText)),
  );
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
