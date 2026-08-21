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
  StoryQualityGateResult,
  StoryQualityGatesV2,
  StoryQualityReport,
} from '@shared/types.js';
import { getGenreSampleGuidance, getGenreStoryProfile } from './genre-story-profiles.js';
import { getNarrativePatternDiagnostics, getNarrativePatternRepairActions } from './narrative-pattern-library.js';
import { getStoryFamilyRepairGuidance } from './story-family-quality-service.js';
import { buildStoryHumanReviewAlignment } from './story-human-review-alignment-service.js';

export function isStoryQualityPassed(report: StoryQualityReport): boolean {
  if (!report.quality_gates) return report.passed;
  return report.quality_gates.story_publishable
    && (report.pattern_quality_report?.pattern_score ?? 0) >= 70
    && (report.gears_readiness_report?.readiness_score ?? 0) >= 70;
}

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
  const repairActionItems = buildRepairActionItems(
    input.story,
    input.qualityReport,
    outlineReport,
    patternReport,
    gearsReport,
    productionMaterialReport,
    audienceReport,
  );
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
  const issues = [
    ...input.qualityReport.issues,
    ...buildWorkflowBlockingIssues(outlineReport, patternReport, gearsReport, productionMaterialReport, audienceReport),
  ].filter((item, index, arr) => arr.indexOf(item) === index);
  const qualityGates = buildQualityGates({
    story: input.story,
    qualityReport: input.qualityReport,
    outlineReport,
    gearsReport,
    productionMaterialReport,
    audienceReport,
    legacyPassed: passed,
  });

  const enrichedReport: StoryQualityReport = {
    ...input.qualityReport,
    passed,
    issues,
    repair_actions: mergedRepairActions,
    outline_coverage_report: outlineReport,
    pattern_quality_report: patternReport,
    gears_readiness_report: gearsReport,
    production_material_readiness_report: productionMaterialReport,
    audience_text_report: audienceReport,
    quality_gates: qualityGates,
    repair_action_items: repairActionItems,
    repair_preview: buildCombinedPreview(
      outlineReport.preview,
      patternReport.preview,
      gearsReport.preview,
      productionMaterialReport?.preview ?? '',
      audienceReport.preview,
    ),
  };
  return {
    ...enrichedReport,
    human_review_alignment: buildStoryHumanReviewAlignment({
      story: input.story,
      qualityReport: enrichedReport,
    }),
  };
}

function buildQualityGates(input: {
  story: StoryGenerateResult;
  qualityReport: StoryQualityReport;
  outlineReport: OutlineCoverageReport;
  gearsReport: ReturnType<typeof buildGearsReadinessReport>;
  productionMaterialReport: ProductionMaterialQualityReport | undefined;
  audienceReport: AudienceTextReport;
  legacyPassed: boolean;
}): StoryQualityGatesV2 {
  const narrativeIssues = buildNarrativeGateIssues(input.qualityReport);
  const narrativeGate = gateResult({
    gateId: 'narrative_gate',
    scope: 'story',
    passed: narrativeIssues.length === 0,
    score: input.qualityReport.genre_score,
    passedSummary: '故事结构、冲突、行动与主题闭环通过。',
    failedSummary: '故事叙事仍有阻断项，需修订后发布。',
    issues: narrativeIssues,
  });

  const domainSafety = input.story.domain_safety;
  const factualCulturalGate: StoryQualityGateResult = !domainSafety
    ? {
        gate_id: 'factual_cultural_gate',
        scope: 'story',
        status: 'not_evaluated',
        // Legacy stories may not have an independent domain-safety snapshot. Keep
        // publication backward compatible while clearly exposing the missing audit.
        passed: true,
        summary: '尚无独立事实文化安全报告；沿用当前正文证据边界，建议补做机器校验。',
        issues: [],
      }
    : gateResult({
        gateId: 'factual_cultural_gate',
        scope: 'story',
        passed: domainSafety.passed,
        passedSummary: '事实与文化边界机器校验通过。',
        failedSummary: '事实或文化边界存在阻断项。',
        issues: domainSafety.blockers.map(finding => finding.message),
      });

  const outlineGate = gateResult({
    gateId: 'outline_gate',
    scope: 'story',
    passed: input.outlineReport.coverage_score >= 70,
    score: input.outlineReport.coverage_score,
    passedSummary: '故事对用户大纲的覆盖达到发布线。',
    failedSummary: '故事对用户大纲的覆盖不足。',
    issues: input.outlineReport.coverage_score >= 70 ? [] : [input.outlineReport.preview],
  });

  const audienceTextGate = gateResult({
    gateId: 'audience_text_gate',
    scope: 'story',
    passed: input.audienceReport.clean,
    passedSummary: '观众可见文本未发现创作指令污染。',
    failedSummary: '观众可见文本包含创作指令或质量标签。',
    issues: input.audienceReport.issue_items.map(issue => `${issue.label}：${issue.excerpt}`),
  });

  const productionMaterialGate: StoryQualityGateResult = input.productionMaterialReport
    ? gateResult({
        gateId: 'production_material_gate',
        scope: 'production',
        passed: input.productionMaterialReport.passed,
        score: input.productionMaterialReport.score,
        passedSummary: '生产素材包达到当前模板要求。',
        failedSummary: '生产素材包尚未达到当前模板要求。',
        issues: [
          ...input.productionMaterialReport.missing_blocking_fields,
          ...input.productionMaterialReport.missing_risk_fields,
        ].map(field => `${field.label}：${field.reason}`),
      })
    : notEvaluatedProductionGate(
        'production_material_gate',
        '尚无生产素材就绪报告，需先建立素材包。',
      );

  const gearsContractGate = gateResult({
    gateId: 'gears_contract_gate',
    scope: 'production',
    passed: input.gearsReport.ready,
    score: input.gearsReport.readiness_score,
    passedSummary: 'GEARS 分段与提示合同达到生产要求。',
    failedSummary: 'GEARS 分段或提示合同尚未达到生产要求。',
    issues: input.gearsReport.issue_items,
  });

  const assetGate = notEvaluatedProductionGate(
    'asset_gate',
    '待 Production Board 完成真实资产绑定评估。',
  );
  const externalProviderGate = notEvaluatedProductionGate(
    'external_provider_gate',
    '待外部 Provider preflight 与真实回执验收。',
  );

  const storyGates = [narrativeGate, factualCulturalGate, outlineGate, audienceTextGate];
  const productionGates = [productionMaterialGate, gearsContractGate, assetGate, externalProviderGate];
  const storyPublishable = storyGates.every(gate => gate.passed);
  const productionReady = storyPublishable && productionGates.every(gate => gate.passed);

  return {
    schema_version: 'quality-gates/v2',
    narrative_gate: narrativeGate,
    factual_cultural_gate: factualCulturalGate,
    outline_gate: outlineGate,
    audience_text_gate: audienceTextGate,
    production_material_gate: productionMaterialGate,
    gears_contract_gate: gearsContractGate,
    asset_gate: assetGate,
    external_provider_gate: externalProviderGate,
    story_publishable: storyPublishable,
    production_ready: productionReady,
    story_blocking_gate_ids: storyGates.filter(gate => !gate.passed).map(gate => gate.gate_id),
    production_blocking_gate_ids: productionGates.filter(gate => !gate.passed).map(gate => gate.gate_id),
    legacy_passed: input.legacyPassed,
  };
}

function buildNarrativeGateIssues(report: StoryQualityReport): string[] {
  const checks: Array<[boolean, string]> = [
    [report.hasCentralEvent, '缺少中心事件'],
    [report.hasConflict, '缺少可见冲突'],
    [report.hasProtagonistChoice, '缺少主角选择'],
    [report.hasSceneAction, '缺少场景行动'],
    [report.hasClimax, '缺少高潮或关键转折'],
    [report.hasEndingTheme, '结尾未形成主题闭环'],
    [report.isNotBiographySummary, '正文仍偏人物履历摘要'],
  ];
  const issues = checks.filter(([passed]) => !passed).map(([, issue]) => issue);
  if (typeof report.genre_score === 'number' && report.genre_score < 70) {
    issues.push(`流派叙事分 ${report.genre_score}/100，低于发布线 70`);
  }
  issues.push(...(report.missing_required_elements ?? []).map(item => `缺少必需元素：${item}`));
  issues.push(...(report.forbidden_patterns_found ?? []).map(item => `命中禁用模式：${item}`));
  return issues.filter((item, index, all) => all.indexOf(item) === index);
}

function gateResult(input: {
  gateId: StoryQualityGateResult['gate_id'];
  scope: StoryQualityGateResult['scope'];
  passed: boolean;
  score?: number;
  passedSummary: string;
  failedSummary: string;
  issues: string[];
}): StoryQualityGateResult {
  return {
    gate_id: input.gateId,
    scope: input.scope,
    status: input.passed ? 'passed' : 'failed',
    passed: input.passed,
    ...(typeof input.score === 'number' ? { score: input.score } : {}),
    summary: input.passed ? input.passedSummary : input.failedSummary,
    issues: input.passed ? [] : input.issues,
  };
}

function notEvaluatedProductionGate(
  gateId: StoryQualityGateResult['gate_id'],
  summary: string,
): StoryQualityGateResult {
  return {
    gate_id: gateId,
    scope: 'production',
    status: 'not_evaluated',
    passed: false,
    summary,
    issues: [],
  };
}

function buildWorkflowBlockingIssues(
  outlineReport: OutlineCoverageReport,
  patternReport: PatternQualityReport,
  gearsReport: ReturnType<typeof buildGearsReadinessReport>,
  productionMaterialReport: ProductionMaterialQualityReport | undefined,
  audienceReport: AudienceTextReport,
): string[] {
  const issues: string[] = [];
  if (outlineReport.coverage_score < 70) {
    issues.push(`大纲覆盖不足：${outlineReport.preview}`);
  }
  if (patternReport.pattern_score < 70) {
    issues.push(`流派机制不足：${patternReport.preview}`);
  }
  if (gearsReport.readiness_score < 70) {
    issues.push(`GEARS 供稿不足：${gearsReport.preview}`);
  }
  if (productionMaterialReport && !productionMaterialReport.passed) {
    issues.push(`生产素材不足：${productionMaterialReport.preview}`);
  }
  if (!audienceReport.clean) {
    issues.push(`观众文本污染：${audienceReport.preview}`);
  }
  return issues;
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
    const matchedTokens = matchedScenes
      .flatMap(item => item.matched)
      .filter((item, itemIndex, arr) => arr.indexOf(item) === itemIndex);
    const strongThreshold = Math.max(1, Math.ceil(tokens.length / 3));
    const strongMatch = matchedScenes.some(item => item.matched.length >= strongThreshold);
    const aggregateStrongMatch = matchedTokens.length >= strongThreshold;
    const status: OutlineCoverageNode['status'] = strongMatch
      || aggregateStrongMatch
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
      evidence: matchedTokens.slice(0, 6),
      repair_hint: status === 'covered'
        ? '已在正文或场景中承接。'
        : `补回大纲节点「${shortText(text, 34)}」，并放入对应场景的行动、对白或转折。`,
    };
  });

  const coveredNodes = nodes.filter(node => node.status === 'covered').length;
  const partialNodes = nodes.filter(node => node.status === 'partial').length;
  const missingNodes = nodes.filter(node => node.status === 'missing').length;
  const partialWeight = isEpisodeFocusedOutline(nodes.map(node => node.text)) ? 0.75 : 0.5;
  const coverageScore = Math.max(0, Math.round(((coveredNodes + partialNodes * partialWeight) / nodes.length) * 100));
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
  const signals: PatternQualitySignal[] = [];

  for (const field of profile.required_fields) {
    const missing = input.qualityReport.missing_required_elements?.includes(field) ?? false;
    signals.push(createPatternSignal({
      signal_id: `required-${field}`,
      label: `类型字段：${field}`,
      status: missing ? 'missing' : 'satisfied',
      source: 'required_field',
      impact: '类型必填字段决定前端和供稿侧是否能拿到完整生产信息。',
      gap: missing ? `缺少 ${field}。` : '已填写。',
      suggested_scene_ids: [],
      repair_hint: missing ? `补充 ${field}，并让它和正文场景一致。` : '保持一致即可。',
    }, {
      evidenceSceneIds: [],
      observableEvidence: missing ? [] : [`story.${field} 已填写。`],
      counterEvidence: missing ? [`story.${field} 为空。`] : [],
      confidence: 1,
      repairTarget: { scope: 'story_field', scene_ids: [], fields: [field] },
    }));
  }

  for (const weakBeat of input.qualityReport.weak_beats ?? []) {
    const order = Number(weakBeat.match(/^(\d+)\./)?.[1]);
    const beat = Number.isFinite(order)
      ? input.story.story_blueprint?.genre_beats.find(item => item.order === order)
      : undefined;
    const beatSceneIds = beat?.scene_id ? [beat.scene_id] : [];
    signals.push(createPatternSignal({
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
    }, {
      evidenceSceneIds: beatSceneIds,
      observableEvidence: beatSceneIds.flatMap(sceneId => observableSceneEvidence(input.story, sceneId)),
      counterEvidence: [weakBeat],
      confidence: 0.9,
      repairTarget: { scope: 'scene', scene_ids: beatSceneIds, fields: ['plot', 'key_action', 'conflict'] },
    }));
  }

  for (const diagnostic of narrativeDiagnostics) {
    const evaluation = evaluateSceneSignalEvidence(input.story, diagnostic.signal, {
      diagnosticEvidence: diagnostic.evidence,
      diagnosticStatus: diagnostic.status,
    });
    signals.push(createPatternSignal({
      signal_id: `pattern-${diagnostic.diagnostic_id}`,
      label: `${diagnostic.pattern_label}：${diagnostic.signal}`,
      status: evaluation.status,
      source: 'narrative_pattern',
      impact: diagnostic.impact,
      gap: evaluation.status === 'satisfied' ? diagnostic.gap : diagnostic.gap,
      suggested_scene_ids: evaluation.repairTarget.scene_ids.length > 0
        ? evaluation.repairTarget.scene_ids
        : diagnostic.suggested_scene_ids,
      repair_hint: evaluation.status === 'satisfied'
        ? '保持现有机制表达，并避免后续修复时删除证据场景。'
        : diagnostic.repair_hint,
    }, {
      evidenceSceneIds: evaluation.evidenceSceneIds,
      observableEvidence: evaluation.observableEvidence,
      counterEvidence: evaluation.counterEvidence,
      confidence: evaluation.confidence,
      repairTarget: evaluation.repairTarget,
    }));
  }

  for (const signal of [...sampleGuidance.quality_signals, ...profile.quality_rules]) {
    const evaluation = evaluateSceneSignalEvidence(input.story, signal);
    const status = evaluation.status;
    signals.push(createPatternSignal({
      signal_id: `signal-${signals.length + 1}`,
      label: signal,
      status,
      source: sampleGuidance.quality_signals.includes(signal)
        ? 'sample_signal'
        : 'genre_rule',
      impact: '流派信号决定用户选择的叙事机制是否被看见。',
      gap: status === 'satisfied' ? '已由场景中的动作、对白、后果或画面提供证据。' : `缺少可感知的「${signal}」。`,
      suggested_scene_ids: evaluation.repairTarget.scene_ids,
      repair_hint: status === 'satisfied'
        ? '保持当前表达。'
        : `把「${signal}」写进动作、冲突、选择或镜头，不要只加标签。`,
    }, {
      evidenceSceneIds: evaluation.evidenceSceneIds,
      observableEvidence: evaluation.observableEvidence,
      counterEvidence: evaluation.counterEvidence,
      confidence: evaluation.confidence,
      repairTarget: evaluation.repairTarget,
    }));
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
    schema_version: 'pattern-quality/v2',
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

type PatternQualitySignalDraft = Omit<
  PatternQualitySignal,
  'evidence_scene_ids' | 'observable_evidence' | 'counter_evidence' | 'confidence' | 'repair_target'
>;

function createPatternSignal(
  draft: PatternQualitySignalDraft,
  evidence: {
    evidenceSceneIds: number[];
    observableEvidence: string[];
    counterEvidence: string[];
    confidence: number;
    repairTarget: PatternQualitySignal['repair_target'];
  },
): PatternQualitySignal {
  return {
    ...draft,
    evidence_scene_ids: uniqueNumbers(evidence.evidenceSceneIds),
    observable_evidence: uniqueStrings(evidence.observableEvidence).slice(0, 4),
    counter_evidence: uniqueStrings(evidence.counterEvidence).slice(0, 4),
    confidence: Math.max(0, Math.min(1, evidence.confidence)),
    repair_target: {
      ...evidence.repairTarget,
      scene_ids: uniqueNumbers(evidence.repairTarget.scene_ids),
      fields: uniqueStrings(evidence.repairTarget.fields),
    },
  };
}

function evaluateSceneSignalEvidence(
  story: StoryGenerateResult,
  signal: string,
  diagnostic?: {
    diagnosticEvidence: string[];
    diagnosticStatus: PatternQualitySignal['status'];
  },
): {
  status: PatternQualitySignal['status'];
  evidenceSceneIds: number[];
  observableEvidence: string[];
  counterEvidence: string[];
  confidence: number;
  repairTarget: PatternQualitySignal['repair_target'];
} {
  const directlyMatchedSceneIds = story.scene_breakdown
    .filter((scene) => {
      const text = observableSignalSceneText(scene, signal);
      if (!hasSignalText(text, signal)) return false;
      if (!text.includes(signal)) return true;
      const withoutLeakedLabel = text.replaceAll(signal, '');
      return hasSignalText(withoutLeakedLabel, signal);
    })
    .map(scene => scene.scene_id);
  const diagnosticMatchedSceneIds = diagnostic?.diagnosticEvidence.length
    ? story.scene_breakdown
        .filter((scene) => {
          const text = observableSignalSceneText(scene, signal);
          return diagnostic.diagnosticEvidence.some(term => term.length >= 2 && text.includes(term));
        })
        .map(scene => scene.scene_id)
    : [];
  const structuralMatchedSceneIds = structuralSignalSceneIds(story, signal);
  let evidenceSceneIds = uniqueNumbers([
    ...directlyMatchedSceneIds,
    ...diagnosticMatchedSceneIds,
    ...structuralMatchedSceneIds,
  ]);

  // A structural pattern probe can pass without lexical terms (for example,
  // all scenes having both visible action and a usable visual prompt). In
  // that case its deterministic target scenes are valid observable evidence.
  if (
    evidenceSceneIds.length === 0
    && diagnostic?.diagnosticStatus === 'satisfied'
    && diagnostic.diagnosticEvidence.length === 0
  ) {
    evidenceSceneIds = suggestedSceneIdsForSignal(story, signal);
  }

  const topLevelText = [
    story.title,
    story.logline,
    story.theme,
    story.full_text,
    story.core_message ?? '',
    story.slogan_or_key_sentence ?? '',
  ].join('\n');
  const leakedLabel = topLevelText.includes(signal);
  const topLevelOnlySignal = hasSignalText(topLevelText, signal);
  const status: PatternQualitySignal['status'] = evidenceSceneIds.length > 0
    ? 'satisfied'
    : topLevelOnlySignal || diagnostic?.diagnosticStatus === 'weak' || diagnostic?.diagnosticStatus === 'satisfied'
      ? 'weak'
      : 'missing';
  const observableEvidence = evidenceSceneIds.flatMap(sceneId => observableSceneEvidence(story, sceneId, signal));
  const counterEvidence = status === 'satisfied'
    ? []
    : leakedLabel
      ? [`仅出现质量标签「${signal}」，没有落实为场景动作、对白、后果或可见画面。`]
      : topLevelOnlySignal
        ? [`「${signal}」只在标题、梗概、主题或正文概括中出现，缺少对应场景证据。`]
        : [`未找到支持「${signal}」的场景动作、对白、后果或可见画面。`];
  const repairSceneIds = evidenceSceneIds.length > 0
    ? evidenceSceneIds
    : suggestedSceneIdsForSignal(story, signal);

  return {
    status,
    evidenceSceneIds,
    observableEvidence,
    counterEvidence,
    confidence: evidenceSceneIds.length >= 2
      ? 0.92
      : evidenceSceneIds.length === 1
        ? 0.82
        : leakedLabel
          ? 0.35
          : status === 'weak'
            ? 0.48
            : 0.22,
    repairTarget: {
      scope: 'scene',
      scene_ids: repairSceneIds,
      fields: signalRepairFields(signal),
    },
  };
}

function observableSignalSceneText(
  scene: StoryGenerateResult['scene_breakdown'][number],
  signal: string,
): string {
  const boundaryEvidence = /来源|史实|事实|边界|证据|现场|再现|传说|版本/.test(signal)
    ? [
        scene.cultural_note,
        scene.factual_basis ?? '',
        ...(scene.fictionalized_elements ?? []),
        ...(scene.source_entries ?? []),
      ]
    : [];
  return [
    scene.plot,
    scene.key_action,
    scene.conflict ?? '',
    scene.dialogue_or_narration ?? '',
    scene.visual_prompt,
    scene.camera_suggestion,
    ...boundaryEvidence,
  ].join(' ');
}

function structuralSignalSceneIds(story: StoryGenerateResult, signal: string): number[] {
  if (story.scene_breakdown.length === 0) return [];
  const first = story.scene_breakdown[0];
  const last = story.scene_breakdown[story.scene_breakdown.length - 1];
  const firstText = observableSignalSceneText(first, signal).replace(/\s+/g, '');
  const lastText = observableSignalSceneText(last, signal).replace(/\s+/g, '');

  const adaptationEvidence = inspectAdaptationEvidence(story);
  if (adaptationEvidence) {
    if (/人物不丢失/.test(signal)) {
      return adaptationEvidence.allCoreCharactersCovered
        ? adaptationEvidence.coreCharacterSceneIds
        : [];
    }
    if (/关系不改写/.test(signal)) {
      return adaptationEvidence.allCoreCharactersCovered
        && adaptationEvidence.noUntracedCharacterBranch
        && adaptationEvidence.orderedSourceCoverage
        ? adaptationEvidence.coreCharacterSceneIds
        : [];
    }
    if (/保留原作主线|主线不换题/.test(signal)) {
      return adaptationEvidence.orderedSourceCoverage
        ? adaptationEvidence.sourceCoverageSceneIds
        : [];
    }
    if (/删改理由清楚/.test(signal)) {
      return adaptationEvidence.compressionAccounted
        ? adaptationEvidence.sourceCoverageSceneIds
        : [];
    }
    if (/不新增抢戏支线|新增内容不抢戏/.test(signal)) {
      return adaptationEvidence.noUntracedCharacterBranch
        && adaptationEvidence.orderedSourceCoverage
        ? adaptationEvidence.sourceCoverageSceneIds
        : [];
    }
    if (/主题不漂移|删改不伤主旨/.test(signal)) {
      return adaptationEvidence.themeAnchorPreserved
        ? adaptationEvidence.themeSceneIds
        : [];
    }
    if (/情绪底色一致/.test(signal)) {
      return adaptationEvidence.emotionalTonePreserved
        ? adaptationEvidence.themeSceneIds
        : [];
    }
    if (/弧线不是口号/.test(signal)) {
      return adaptationEvidence.observableCharacterArc
        ? adaptationEvidence.choiceConsequenceSceneIds
        : [];
    }
    if (/单集闭环|阶段结果/.test(signal)) {
      return adaptationEvidence.episodeClosure
        ? adaptationEvidence.choiceConsequenceSceneIds
        : [];
    }
    if (/人物目标清楚|必须有主角目标|目标明确/.test(signal)) {
      return adaptationEvidence.protagonistGoalVisible
        ? adaptationEvidence.goalChoiceSceneIds
        : [];
    }
    if (/因果清楚|因果链清楚|事件因果清楚/.test(signal)) {
      return adaptationEvidence.choiceConsequenceSceneIds.length >= 2
        ? adaptationEvidence.choiceConsequenceSceneIds
        : [];
    }
  }

  if (story.video_type === 'historical_drama') {
    const sceneText = (scene: StoryGenerateResult['scene_breakdown'][number]) => (
      observableSignalSceneText(scene, signal).replace(/\s+/g, '')
    );
    const pressureScene = story.scene_breakdown.find(scene => {
      const text = sceneText(scene);
      return /时代危机|人物卷入|冲突升级/.test(`${scene.dramatic_function}${scene.title}`)
        && /10月9日|10月10日|1911年|期限|倒计时|计划泄露/.test(text)
        && /搜捕|处死|遇害|封营|逼近|失去等待的时间/.test(text);
    });
    const choiceScene = story.scene_breakdown.find(scene => {
      const text = sceneText(scene);
      return /人物卷入|关键行动|选择/.test(`${scene.dramatic_function}${scene.title}${text}`)
        && /若.+；若|等待.+搜捕|提前发动|立即发动/.test(text)
        && /承担|伤亡|失败|风险|不可逆/.test(text)
        && /收起|推开|背枪|决定|选择|发动/.test(text);
    });
    const causalActionScene = story.scene_breakdown.find(scene => {
      const text = sceneText(scene);
      return /关键行动|高潮|争夺/.test(`${scene.dramatic_function}${scene.title}`)
        && /楚望台军械库|军械库/.test(text)
        && /推开|顶门|搬出|分发|获得/.test(text)
        && /枪械|弹药|弹药箱/.test(text)
        && /才能|得以|因此|决定|无法/.test(text);
    });
    const consequenceScene = story.scene_breakdown.find(scene => {
      const text = sceneText(scene);
      return /高潮|历史余响|事件后续/.test(`${scene.dramatic_function}${scene.title}`)
        && /普通士兵|新军士兵|起义军/.test(text)
        && /汉阳|汉口|多省|十四省|连锁|汇入|响应/.test(text)
        && /改变|转折|推进|扩展|重要开端/.test(text);
    });
    const agencyScenes = story.scene_breakdown.filter(scene => {
      const text = sceneText(scene);
      return /新军士兵|起义军|普通士兵/.test(text)
        && /传递|检查|收起|推开|背枪|冲开|顶门|搬出|分发|传令|汇合|挂旗/.test(text);
    });
    const boundaryScenes = story.scene_breakdown.filter(scene => {
      const text = [
        scene.cultural_note,
        scene.factual_basis ?? '',
        ...(scene.fictionalized_elements ?? []),
      ].join('');
      return /依据|记载|用户素材|知识条目|史料|回忆/.test(text)
        && /影视化|合成|有限再现|不作为|不宣称|不虚构|不替代|不声称|单因|边界/.test(text);
    });
    const causalChain = Boolean(
      pressureScene
      && choiceScene
      && causalActionScene
      && consequenceScene
      && pressureScene.scene_id < choiceScene.scene_id
      && choiceScene.scene_id < causalActionScene.scene_id
      && causalActionScene.scene_id < consequenceScene.scene_id,
    );

    if (/时代压力可见|必须有时代压力/.test(signal)) {
      return pressureScene && choiceScene ? [pressureScene.scene_id, choiceScene.scene_id] : [];
    }
    if (/事件因果清楚|必须有事件因果|因果链清楚/.test(signal)) {
      return causalChain
        ? [pressureScene!.scene_id, choiceScene!.scene_id, causalActionScene!.scene_id, consequenceScene!.scene_id]
        : [];
    }
    if (/人物不是背景板|人物不是年表/.test(signal)) {
      return causalChain && agencyScenes.length >= 3 ? agencyScenes.map(scene => scene.scene_id) : [];
    }
    if (/史实边界明确|必须标注创作边界/.test(signal)) {
      return boundaryScenes.length >= Math.ceil(story.scene_breakdown.length * 0.67)
        ? boundaryScenes.map(scene => scene.scene_id)
        : [];
    }
  }

  if (story.video_type === 'documentary_short') {
    const sceneText = (scene: StoryGenerateResult['scene_breakdown'][number]) => (
      observableSignalSceneText(scene, signal).replace(/\s+/g, '')
    );
    const realityScene = story.scene_breakdown.find(scene => (
      /现实引入/.test(`${scene.dramatic_function}${scene.title}`)
      && /门庭|书院|讲堂|院落|碑刻|石阶|实物/.test(`${scene.location}${sceneText(scene)}`)
      && /问题|核对|写下|提出/.test(sceneText(scene))
    ));
    const sourceScenes = story.scene_breakdown.filter(scene => (
      Boolean(scene.factual_basis?.trim())
      && /依据|条目|记载|来源|地点记录/.test(scene.factual_basis ?? '')
      && /核对|时间线|碑刻|讲义|问题|标出/.test(sceneText(scene))
    ));
    const boundaryScenes = story.scene_breakdown.filter(scene => {
      const text = [
        scene.cultural_note,
        scene.factual_basis ?? '',
        ...(scene.fictionalized_elements ?? []),
      ].join('');
      return /依据|条目|记载|来源|地点/.test(text)
        && /不代表|不是|不得|不能|不声称|不作为|不证明|不新增|须|待|有限再现/.test(text);
    });
    const interviewPlanScene = story.scene_breakdown.find(scene => (
      /史料\/专家解读/.test(scene.dramatic_function)
      && /采访规划（非现成同期声）/.test(sceneText(scene))
      && /待真实采访录音后选择/.test(sceneText(scene))
      && /不写采访原话|不制造同期声/.test(sceneText(scene))
    ));
    const contemporaryScene = story.scene_breakdown.find(scene => (
      /当代意义/.test(scene.dramatic_function)
      && /今天|当代|课堂/.test(sceneText(scene))
      && /标出|标出处|交换|核对|翻回|写下|提问/.test(sceneText(scene))
      && /问题|依据|来源|解释/.test(sceneText(scene))
    ));

    if (/现实现场明确/.test(signal)) {
      return realityScene ? [realityScene.scene_id] : [];
    }
    if (/来源提示存在/.test(signal)) {
      return sourceScenes.length >= 3 ? sourceScenes.map(scene => scene.scene_id) : [];
    }
    if (/边界清楚/.test(signal)) {
      return boundaryScenes.length >= Math.ceil(story.scene_breakdown.length * 0.8) && interviewPlanScene
        ? boundaryScenes.map(scene => scene.scene_id)
        : [];
    }
    if (/当代意义自然/.test(signal)) {
      return realityScene && contemporaryScene && /问题/.test(sceneText(realityScene))
        ? [realityScene.scene_id, contemporaryScene.scene_id]
        : [];
    }
  }

  if (story.video_type === 'legend_story') {
    const sceneText = (scene: StoryGenerateResult['scene_breakdown'][number]) => (
      observableSignalSceneText(scene, signal).replace(/\s+/g, '')
    );
    const supernaturalScene = story.scene_breakdown.find(scene => {
      const text = sceneText(scene);
      return /神力显现|神异|异象/.test(`${scene.dramatic_function}${scene.title}${text}`)
        && /狐影|狐仙|花篮|披帛|倒影|异光|神异/.test(text)
        && /扶|挡|护|拦|显|掠过|扬起|停住|改变/.test(text);
    });
    const trialScene = story.scene_breakdown.find(scene => {
      const text = sceneText(scene);
      return /凡人考验|人的抉择|选择/.test(`${scene.dramatic_function}${scene.title}${text}`)
        && /逼|催|围|驱|怀疑|排斥|风险|代价|失去/.test(text)
        && /放下|站到|退到|护住|回头|拒绝|选择|决定/.test(text);
    });
    const consequenceScene = story.scene_breakdown.find(scene => {
      const text = sceneText(scene);
      return /命运转折|结果|后果/.test(`${scene.dramatic_function}${scene.title}${text}`)
        && /因此|于是|从此|结果|停下|让出|改变/.test(text)
        && /抬|拾|递|并肩|回头|护住|离开|留下/.test(text);
    });
    const boundaryScenes = story.scene_breakdown.filter(scene => {
      const text = [
        scene.cultural_note,
        scene.factual_basis ?? '',
        ...(scene.fictionalized_elements ?? []),
      ].join('');
      return /相传|传说|口述|戏曲改编|花鼓戏改编|多版本/.test(text)
        && /不作|不是|边界|影视化|虚构|改编|待核|另核/.test(text);
    });
    const transmissionEnding = /传说永恒|世代传颂|流传/.test(`${last.dramatic_function}${last.title}${lastText}`)
      && /戏台|花鼓戏|讲述|复演|观众|锣鼓|对唱/.test(lastText)
      && /一代代|流传|重讲|应和|传播/.test(lastText)
      && /传说|版本|改编|不是可考历史/.test(lastText);
    const motifTerms = ['柴担', '柴绳', '花篮', '狐影', '披帛'];
    const repeatedMotif = motifTerms.find(term => (
      story.scene_breakdown.filter(scene => sceneText(scene).includes(term)).length >= 3
    ));
    const motifScenes = repeatedMotif
      ? story.scene_breakdown.filter(scene => sceneText(scene).includes(repeatedMotif))
      : [];
    const motifChangesMeaning = Boolean(repeatedMotif
      && supernaturalScene
      && trialScene
      && consequenceScene
      && motifScenes.some(scene => scene.scene_id === supernaturalScene.scene_id)
      && motifScenes.some(scene => scene.scene_id === trialScene.scene_id || scene.scene_id === consequenceScene.scene_id));
    const supernaturalChoiceChain = Boolean(
      supernaturalScene
      && trialScene
      && consequenceScene
      && supernaturalScene.scene_id < trialScene.scene_id
      && trialScene.scene_id < consequenceScene.scene_id,
    );

    if (/神异意象服务选择|神异服务选择/.test(signal)) {
      return supernaturalChoiceChain ? [supernaturalScene!.scene_id, trialScene!.scene_id] : [];
    }
    if (/凡人考验成立|必须有人物考验|人物考验/.test(signal)) {
      return trialScene && consequenceScene ? [trialScene.scene_id, consequenceScene.scene_id] : [];
    }
    if (/传说边界清楚|必须标明传说边界/.test(signal)) {
      return boundaryScenes.length >= Math.ceil(story.scene_breakdown.length * 0.6)
        ? boundaryScenes.map(scene => scene.scene_id)
        : [];
    }
    if (/结尾有流传理由/.test(signal)) {
      return transmissionEnding ? [last.scene_id] : [];
    }
    if (/象征意象贯穿|必须有象征意象/.test(signal)) {
      return motifChangesMeaning ? motifScenes.map(scene => scene.scene_id) : [];
    }
    if (/线索物明确/.test(signal)) {
      return repeatedMotif && motifScenes.length >= 3 ? motifScenes.map(scene => scene.scene_id) : [];
    }
    if (/物件意义有变化/.test(signal)) {
      return motifChangesMeaning ? motifScenes.map(scene => scene.scene_id) : [];
    }
  }

  if (story.video_type === 'culture_promo') {
    const sceneText = (scene: StoryGenerateResult['scene_breakdown'][number]) => (
      observableSignalSceneText(scene, signal).replace(/\s+/g, '')
    );
    const symbolScene = story.scene_breakdown.find(scene =>
      /符号引入/.test(scene.dramatic_function)
      && /门联|笔记|碑刻|匾额|纹样|器物/.test(sceneText(scene))
      && /特写|前景|写下|翻开|走到/.test(sceneText(scene)),
    );
    const proofScenes = story.scene_breakdown.filter(scene =>
      Boolean(scene.factual_basis?.trim())
      && /依据|条目|记载|来源/.test(scene.factual_basis ?? '')
      && scene.key_action.trim().length >= 8,
    );
    const modernScene = story.scene_breakdown.find(scene =>
      /现代传承|当代连接/.test(scene.dramatic_function)
      && /今天|当代|如今|仍在/.test(sceneText(scene))
      && /带进|交换|讨论|学习|使用|实践/.test(sceneText(scene)),
    );
    const memoryEnding = /标语收束|品牌定格/.test(last.dramatic_function)
      && /写下|定格|停在|回到/.test(lastText)
      && /到访|请|记住|走进|带进来/.test(lastText)
      && Boolean(story.slogan_or_key_sentence?.trim());
    const propositionChain = Boolean(
      symbolScene
      && proofScenes.length >= 2
      && modernScene
      && symbolScene.scene_id < modernScene.scene_id,
    );

    if (/符号鲜明/.test(signal)) {
      return symbolScene && /门联|笔记/.test(lastText)
        ? [symbolScene.scene_id, last.scene_id]
        : [];
    }
    if (/主张清楚/.test(signal)) {
      return propositionChain
        ? [symbolScene!.scene_id, proofScenes[0].scene_id, modernScene!.scene_id]
        : [];
    }
    if (/当代连接自然/.test(signal)) {
      return symbolScene && modernScene && /笔记|门联/.test(sceneText(modernScene))
        ? [symbolScene.scene_id, modernScene.scene_id]
        : [];
    }
    if (/结尾有记忆句/.test(signal)) {
      return memoryEnding ? [last.scene_id] : [];
    }
  }

  if (story.video_type === 'social_short') {
    const hookScene = /3秒钩子|钩子/.test(first.dramatic_function)
      && /[？?]|为什么|反常|没想到|竟然|答案/.test(firstText.slice(0, 120))
      && /特写|超近景|冲击|贴近/.test(`${first.visual_prompt} ${first.camera_suggestion}`);
    const informationScene = story.scene_breakdown.find(scene => {
      if (!/关键信息|核心事实/.test(`${scene.dramatic_function} ${scene.title}`)) return false;
      const text = observableSignalSceneText(scene, signal).replace(/\s+/g, '');
      const enumerated = /第一|第二|第三|首先|其次|最后|先看.+再看.+最后|三个信息|三类/.test(text);
      const concreteDimensions = ['材料', '手', '动作', '变化', '差别', '成品', '结果']
        .filter(term => text.includes(term));
      return enumerated && concreteDimensions.length >= 3;
    });
    const subtitleScene = story.scene_breakdown.find(scene => (
      /字幕|文字叠加/.test(`${scene.visual_prompt} ${scene.camera_suggestion}`)
      && /快切|定格|三联|短句/.test(`${scene.visual_prompt} ${scene.camera_suggestion} ${scene.plot}`)
    ));
    const payoffScene = /金句落点|金句定格|品牌定格/.test(`${last.dramatic_function} ${last.title}`)
      && /“[^”]{4,}”|「[^」]{4,}」|记住|答案|得到答案|回到|并排|定格/.test(lastText)
      && /定格|文字|同框|并排/.test(`${last.visual_prompt} ${last.camera_suggestion} ${last.key_action}`);

    if (/前\s*3\s*秒有钩子|开头必须有钩子|3秒钩子强/.test(signal)) {
      return hookScene ? [first.scene_id] : [];
    }
    if (/信息密度高|信息点集中|三类信息点|强记忆点/.test(signal)) {
      return informationScene ? [informationScene.scene_id] : [];
    }
    if (/字幕感明确|字幕感强/.test(signal)) {
      return subtitleScene ? [subtitleScene.scene_id] : [];
    }
    if (/结尾可记住|结尾有停留点/.test(signal)) {
      return payoffScene ? [last.scene_id] : [];
    }
    if (/不得铺垫过长/.test(signal)) {
      return hookScene && first.plot.length <= 90 ? [first.scene_id] : [];
    }
  }

  if (story.video_type === 'education_training') {
    const objectiveScene = story.scene_breakdown.find(scene => {
      if (!/学习目标/.test(`${scene.dramatic_function} ${scene.title}`)) return false;
      const text = observableSignalSceneText(scene, signal).replace(/\s+/g, '');
      return /学完|完成本节|本节结束/.test(text)
        && /能够|可以|会/.test(text)
        && /说出|指出|判断|制作|完成|举.{0,4}例/.test(text);
    });
    const stepsScene = story.scene_breakdown.find(scene => {
      if (!/知识讲授|示范演示|分步|步骤/.test(`${scene.dramatic_function} ${scene.title}`)) return false;
      const text = observableSignalSceneText(scene, signal).replace(/\s+/g, '');
      return /第一.+第二.+第三|第一步.+第二步.+第三步|先.+再.+最后/.test(text);
    });
    const practiceScene = story.scene_breakdown.find(scene => {
      if (!/练习引导|主动练习/.test(`${scene.dramatic_function} ${scene.title}`)) return false;
      const text = observableSignalSceneText(scene, signal).replace(/\s+/g, '');
      return /制作|填写|排列|写下|指出|判断|说明|完成/.test(text)
        && /卡片|清单|答案|练习|思考题|任务/.test(text);
    });
    const recapScene = story.scene_breakdown.find(scene => {
      if (!/总结拓展|复盘/.test(`${scene.dramatic_function} ${scene.title}`)) return false;
      const text = observableSignalSceneText(scene, signal).replace(/\s+/g, '');
      return /复盘|清单|检查|回顾|总结/.test(text)
        && /先.+再.+最后|第一.+第二.+第三|逐项/.test(text);
    });

    if (/目标具体|学习目标具体|必须有学习目标/.test(signal)) {
      return objectiveScene ? [objectiveScene.scene_id] : [];
    }
    if (/步骤完整|必须有步骤/.test(signal)) {
      return stepsScene ? [stepsScene.scene_id] : [];
    }
    if (/练习存在/.test(signal)) {
      return practiceScene ? [practiceScene.scene_id] : [];
    }
    if (/复盘清楚/.test(signal)) {
      return recapScene ? [recapScene.scene_id] : [];
    }
    if (/必须有复盘或练习/.test(signal)) {
      return uniqueNumbers([
        ...(practiceScene ? [practiceScene.scene_id] : []),
        ...(recapScene ? [recapScene.scene_id] : []),
      ]);
    }
  }

  if (story.video_type === 'explainer_video') {
    const questionScene = /提出问题|认知缺口/.test(`${first.dramatic_function} ${first.title}`)
      && /[？?]|为什么|如何|怎么|何以/.test(firstText)
      && /指向|对照|观察|先看|问题字幕/.test(firstText);
    const hierarchyScene = story.scene_breakdown.find(scene => {
      if (!/概念解释|知识讲解|逻辑深化/.test(`${scene.dramatic_function} ${scene.title}`)) return false;
      const text = observableSignalSceneText(scene, signal).replace(/\s+/g, '');
      return /三个概念|三个层次|三层|第一.+第二.+第三|首先.+其次.+最后|先.+再.+最后/.test(text);
    });
    const exampleScene = story.scene_breakdown.find(scene => {
      const text = observableSignalSceneText(scene, signal).replace(/\s+/g, '');
      const analogy = /可以把.+看作|就像|好比|类比/.test(text)
        && /图|书页|切口|箭头|对照|局部/.test(text);
      const concreteCase = /实例论证|案例支撑/.test(`${scene.dramatic_function} ${scene.title}`)
        && /以.+为例|例如|现场|岩壁|书院|工坊/.test(text)
        && /观察|标出|对应|脱落|变化|形成/.test(text);
      return analogy || concreteCase;
    });
    const recapScene = /总结归纳|要点重述|总结/.test(`${last.dramatic_function} ${last.title}`)
      && /最后记住|三个要点|三点总结|第一.+第二.+第三|先.+再.+最后/.test(lastText)
      && /字幕|图卡|点亮|逐项|记住/.test(`${lastText} ${last.visual_prompt} ${last.camera_suggestion}`);

    if (/问题明确|核心问题明确|必须有核心问题/.test(signal)) {
      return questionScene ? [first.scene_id] : [];
    }
    if (/层级清楚|知识层级|必须有知识层级/.test(signal)) {
      return hierarchyScene ? [hierarchyScene.scene_id] : [];
    }
    if (/例子有效|例证|例子或类比/.test(signal)) {
      return exampleScene ? [exampleScene.scene_id] : [];
    }
    if (/总结可记住|总结可复盘/.test(signal)) {
      return recapScene ? [last.scene_id] : [];
    }
  }

  if (story.video_type === 'lecture_video') {
    const claimScene = /提出主题|核心观点/.test(`${first.dramatic_function} ${first.title}`)
      && /核心观点|主张|说明|不是.+而是/.test(firstText)
      && /观点|精神|意味着|体现|说明/.test(firstText);
    const caseScene = story.scene_breakdown.find(scene => {
      if (!/讲述事实|事实案例|案例支撑/.test(`${scene.dramatic_function} ${scene.title}`)) return false;
      const text = observableSignalSceneText(scene, signal).replace(/\s+/g, '');
      return /可考|史料|记载|\d{3,4}年|以.+为例/.test(text)
        && /人物|地点|书院|现场|事件|会讲|创建|证据|线索/.test(text);
    });
    const analysisScene = story.scene_breakdown.find(scene => {
      if (!/分析精神|观点分析|价值分析/.test(`${scene.dramatic_function} ${scene.title}`)) return false;
      const text = observableSignalSceneText(scene, signal).replace(/\s+/g, '');
      return /首先.+其次.+最后|第一.+第二.+第三|开放.+求真.+传承/.test(text)
        && /体现|说明|意味着|检验|论证|起点/.test(text);
    });
    const presentScene = story.scene_breakdown.find(scene => {
      if (!/联系当下|现实映射|现实连接/.test(`${scene.dramatic_function} ${scene.title}`)) return false;
      const text = observableSignalSceneText(scene, signal).replace(/\s+/g, '');
      return /今天|当下|现在|仍能|仍可以/.test(text)
        && /课堂|学习|交流|生活|工作|行动|讨论|查证|修正/.test(text);
    });
    const actionEnding = /总结号召|行动号召|价值回扣/.test(`${last.dramatic_function} ${last.title}`)
      && /倾听|查证|发问|讨论|写下|举手|行动|先.+再/.test(lastText)
      && /观众|下一次|开始|变成|做到|字幕|发言/.test(`${lastText} ${last.visual_prompt} ${last.camera_suggestion}`);

    if (/观点明确|中心观点明确|必须有中心观点/.test(signal)) {
      return claimScene ? [first.scene_id] : [];
    }
    if (/案例支撑|论据充分|必须有例证/.test(signal)) {
      return uniqueNumbers([
        ...(caseScene ? [caseScene.scene_id] : []),
        ...(analysisScene ? [analysisScene.scene_id] : []),
      ]);
    }
    if (/现实连接|现实连接清楚|必须有现实连接/.test(signal)) {
      return presentScene ? [presentScene.scene_id] : [];
    }
    if (/结尾有力量/.test(signal)) {
      return actionEnding ? [last.scene_id] : [];
    }
  }

  if (story.video_type === 'landscape_mood') {
    const naturalMotionScenes = story.scene_breakdown.filter(scene => {
      const text = observableSignalSceneText(scene, signal).replace(/\s+/g, '');
      return /峰|山|谷|林|石壁|溪|水|云|雾|风|雨|雪|鸟鸣|草|树影/.test(text)
        && /露出|上升|掠过|移开|吞没|退下|流动|变化|擦亮|拉深|显露|摇曳|滴落|唤醒/.test(text);
    });
    const changingLightScene = story.scene_breakdown.find(scene => {
      const text = observableSignalSceneText(scene, signal).replace(/\s+/g, '');
      const phases = ['清晨', '晨光', '日光', '雨雾', '暮色', '黄昏', '夜色', '月光']
        .filter(term => text.includes(term));
      return phases.length >= 3
        && /依次|随后|又|从.+到|掠过|改变|吞没|擦亮|拉深/.test(text);
    });
    const narrationCharacters = story.scene_breakdown.reduce(
      (total, scene) => total + countContentChars(scene.dialogue_or_narration ?? ''),
      0,
    );
    const sparseNarration = story.scene_breakdown.every(scene => (scene.characters?.length ?? 0) === 0)
      && narrationCharacters <= 40
      && story.scene_breakdown.filter(scene => countContentChars(scene.dialogue_or_narration ?? '') > 0).length
        <= Math.ceil(story.scene_breakdown.length * 0.67);
    const heldEnding = /灵韵定格|山水余韵|山水精神|意境收束/.test(`${last.dramatic_function} ${last.title}`)
      && /风声退|声音渐退|只留|余味|未说完|停留|留给|空谷/.test(lastText)
      && /远景|固定|留白|停留|空镜|大面积|五秒/.test(`${last.visual_prompt} ${last.camera_suggestion}`);

    if (/自然意象突出|必须有自然意象/.test(signal)) {
      return naturalMotionScenes.map(scene => scene.scene_id);
    }
    if (/光影季节明确|必须有光影季节/.test(signal)) {
      return changingLightScene ? [changingLightScene.scene_id] : [];
    }
    if (/旁白低密度|旁白不可过密/.test(signal)) {
      return sparseNarration ? story.scene_breakdown.map(scene => scene.scene_id) : [];
    }
    if (/留白成立|留白感成立/.test(signal)) {
      return heldEnding ? [last.scene_id] : [];
    }
  }

  if (story.video_type === 'children_story') {
    const audienceSentences = story.full_text
      .split(/[。！？!?；;\n]+/)
      .map(sentence => sentence.replace(/\s+/g, ''))
      .filter(Boolean);
    const concreteChildActions = story.scene_breakdown.filter(scene => {
      const text = observableSignalSceneText(scene, signal).replace(/\s+/g, '');
      return /柴绳|木柴|柴担|花篮|山路|家门|暖灯|脚步|手|眼睛|歌声/.test(text)
        && /捡|捆|停|听|看|放回|核对|抬|送|走|放下|挥手|帮助/.test(text);
    });
    const simpleLanguage = audienceSentences.length >= 4
      && audienceSentences.every(sentence => countContentChars(sentence) <= 58)
      && concreteChildActions.length >= 2
      && !/宏大叙事|价值范式|辩证关系|历史必然|精神内核|意识形态/.test(story.full_text);
    const gentleConflictScene = story.scene_breakdown.find(scene => {
      if (!/遇到问题|学习成长|做出选择/.test(`${scene.dramatic_function} ${scene.title}`)) return false;
      const text = observableSignalSceneText(scene, signal).replace(/\s+/g, '');
      return /害怕|怀疑|陌生人|误会|身份不同|劝.+不要|丢了|散落|不相信/.test(text)
        && /先听|观察|看行动|核对|温和|没有伤害|把话说完|帮助/.test(text)
        && !/殴打|杀死|砍死|虐待|血淋淋|残肢|酷刑/.test(text);
    });
    const learningScene = story.scene_breakdown.find(scene => {
      if (!/学习成长|认真听看|看见善意/.test(`${scene.dramatic_function} ${scene.title}`)) return false;
      const text = observableSignalSceneText(scene, signal).replace(/\s+/g, '');
      return /看见|观察|想起|明白|理解|判断/.test(text)
        && /行动|善意|没有.+拿走|没有.+伤害|帮助|最后一根|亲眼/.test(text);
    });
    const choiceScene = story.scene_breakdown.find(scene => {
      if (!/做出选择|解开误会/.test(`${scene.dramatic_function} ${scene.title}`)) return false;
      const text = observableSignalSceneText(scene, signal).replace(/\s+/g, '');
      return /决定|选择|于是|先.+再|核对|道谢/.test(text)
        && /一起|面对|抬起|送回|寻找|相信|解开/.test(text);
    });
    const causalLearning = Boolean(
      gentleConflictScene
      && learningScene
      && choiceScene
      && gentleConflictScene.scene_id < learningScene.scene_id
      && learningScene.scene_id < choiceScene.scene_id,
    );
    const warmEnding = /温暖结尾|带着收获回家|暖灯下回家/.test(`${last.dramatic_function} ${last.title}`)
      && /一起|两人|伙伴/.test(lastText)
      && /回家|家门|送到|放下|歌声|笑|挥手|约好|暖灯/.test(lastText)
      && /暖色|暖灯|清晨|远景|家门/.test(`${lastText} ${last.visual_prompt} ${last.camera_suggestion}`)
      && !/黑屏|口号|旁白说.+善良/.test(`${last.visual_prompt} ${last.plot}`);

    if (/语言简单|语言必须简单/.test(signal)) {
      return simpleLanguage ? concreteChildActions.map(scene => scene.scene_id) : [];
    }
    if (/冲突温和/.test(signal)) {
      return gentleConflictScene ? [gentleConflictScene.scene_id] : [];
    }
    if (/因果清楚/.test(signal)) {
      return causalLearning ? [
        gentleConflictScene!.scene_id,
        learningScene!.scene_id,
        choiceScene!.scene_id,
      ] : [];
    }
    if (/结尾正向|结尾必须温暖/.test(signal)) {
      return warmEnding ? [last.scene_id] : [];
    }
  }

  return [];
}

interface AdaptationStructuralEvidence {
  allCoreCharactersCovered: boolean;
  coreCharacterSceneIds: number[];
  orderedSourceCoverage: boolean;
  sourceCoverageSceneIds: number[];
  compressionAccounted: boolean;
  noUntracedCharacterBranch: boolean;
  themeAnchorPreserved: boolean;
  emotionalTonePreserved: boolean;
  themeSceneIds: number[];
  observableCharacterArc: boolean;
  episodeClosure: boolean;
  protagonistGoalVisible: boolean;
  choiceConsequenceSceneIds: number[];
  goalChoiceSceneIds: number[];
}

function inspectAdaptationEvidence(
  story: StoryGenerateResult,
): AdaptationStructuralEvidence | undefined {
  const analysis = story.adaptation_analysis;
  const source = story.original_user_query?.trim();
  if (!analysis || analysis.source_mode !== 'user_novel' || !source) return undefined;

  const scenes = story.scene_breakdown;
  const sourceUnits = source
    .split(/\n{2,}|(?<=[。！？!?；;])\s*/)
    .map(item => item.trim())
    .filter(item => item.length >= 8);
  if (sourceUnits.length < 2) return undefined;

  const sceneSearchText = (scene: StoryGenerateResult['scene_breakdown'][number]) => [
    scene.plot,
    scene.key_action,
    scene.conflict ?? '',
    scene.dialogue_or_narration ?? '',
    ...(scene.characters ?? []),
  ].join('');
  const sourceBoundScenes = scenes.filter(scene => (
    (scene.source_entries ?? []).includes('用户提供改编素材')
    && /用户提供改编素材|用户素材|原作主线/.test(
      `${scene.factual_basis ?? ''}${scene.cultural_note}`,
    )
  ));
  const traceableScenes = scenes.filter(scene => (
    (scene.source_entries?.length ?? 0) > 0
    && Boolean(scene.factual_basis?.trim())
    && Boolean(scene.cultural_note.trim())
  ));
  let previousSourceSceneId = 0;
  const orderedUnitSceneIds = sourceUnits.map(unit => {
    const exact = scenes.filter(scene => sceneSearchText(scene).includes(unit));
    const candidates = (exact.length > 0
      ? exact.map(scene => ({ scene, score: 1 }))
      : scenes.map(scene => ({
          scene,
          score: adaptationTextOverlap(unit, sceneSearchText(scene)),
        })).filter(item => item.score >= 0.16))
      .filter(item => item.scene.scene_id >= previousSourceSceneId)
      .sort((left, right) => right.score - left.score || left.scene.scene_id - right.scene.scene_id);
    const selected = candidates[0]?.scene.scene_id;
    if (selected !== undefined) previousSourceSceneId = selected;
    return selected;
  });
  const sourceCoverageSceneIds = uniqueNumbers(
    orderedUnitSceneIds.filter((sceneId): sceneId is number => sceneId !== undefined),
  );
  const orderedSourceCoverage = orderedUnitSceneIds.every(sceneId => sceneId !== undefined)
    && sourceBoundScenes.length >= 2
    && traceableScenes.length >= Math.ceil(scenes.length * 0.8);

  const coreCharacterMatches = analysis.core_characters.map(name => ({
    name,
    sceneIds: scenes
      .filter(scene => sceneSearchText(scene).includes(name))
      .map(scene => scene.scene_id),
  }));
  const allCoreCharactersCovered = coreCharacterMatches.length > 0
    && coreCharacterMatches.every(item => item.sceneIds.length > 0);
  const coreCharacterSceneIds = uniqueNumbers(coreCharacterMatches.flatMap(item => item.sceneIds));
  const untracedCharacters = uniqueStrings(scenes.flatMap(scene => scene.characters ?? []))
    .filter(name => !source.includes(name));
  const untracedBranchScenes = scenes.filter(scene => (
    (scene.characters ?? []).some(name => untracedCharacters.includes(name))
    && !/来源|传播|版本|边界|余响|结尾/.test(`${scene.dramatic_function}${scene.title}${scene.cultural_note}`)
  ));
  const noUntracedCharacterBranch = untracedBranchScenes.length === 0;

  const choiceScenes = scenes.filter(scene => {
    const text = sceneSearchText(scene);
    return Boolean(scene.conflict?.trim())
      && /决定|选择|拒绝|回头|放下|护住|推开|发动|交还|承担/.test(text)
      && /逼|催|搜捕|怀疑|误会|风险|代价|失去|伤亡|冲突|必须/.test(text);
  });
  const consequenceScenes = scenes.filter(scene => {
    const text = sceneSearchText(scene);
    return /因此|于是|结果|免死|解开|改变|停下|让出|响应|留下|完成|共同|护住/.test(text)
      && /行动|选择|决定|拒绝|回头|放下|推开|发动|交还|承担|抬起|送到/.test(text);
  });
  const choiceScene = choiceScenes[0];
  const consequenceScene = choiceScene
    ? consequenceScenes.find(scene => scene.scene_id >= choiceScene.scene_id)
    : undefined;
  const choiceConsequenceSceneIds = choiceScene && consequenceScene
    ? uniqueNumbers([choiceScene.scene_id, consequenceScene.scene_id])
    : [];

  const themeSource = sourceUnits[sourceUnits.length - 1];
  const tailScenes = scenes.slice(-2);
  const tailText = tailScenes.map(sceneSearchText).join('');
  const themeAnchorPreserved = adaptationTextOverlap(themeSource, tailText) >= 0.16
    && choiceConsequenceSceneIds.length > 0;
  const sourceEmotionTerms = ADAPTATION_EMOTION_TERMS.filter(term => source.includes(term));
  const emotionalTonePreserved = sourceEmotionTerms.length > 0
    && sourceEmotionTerms.some(term => tailText.includes(term));
  const themeSceneIds = themeAnchorPreserved || emotionalTonePreserved
    ? tailScenes.map(scene => scene.scene_id)
    : [];

  const arc = story.protagonist_arc?.[0];
  const observableCharacterArc = Boolean(
    arc?.starting_state.trim()
    && arc.turning_point.trim()
    && arc.resolution.trim()
    && choiceScene
    && consequenceScene
    && choiceScene.key_action.trim().length >= 8
    && consequenceScene.key_action.trim().length >= 8,
  );
  const firstHalf = scenes.slice(0, Math.max(1, Math.ceil(scenes.length / 2)));
  const protagonist = analysis.core_characters.find(name => sourceUnits[0].includes(name))
    ?? analysis.core_characters[0];
  const goalScene = protagonist
    ? firstHalf.find(scene => (
        sceneSearchText(scene).includes(protagonist)
        && scene.key_action.trim().length >= 8
        && (Boolean(scene.conflict?.trim()) || /发现|寻找|核实|保护|查|等|发动/.test(sceneSearchText(scene)))
      ))
    : undefined;
  const protagonistGoalVisible = Boolean(goalScene && choiceScene && goalScene.scene_id <= choiceScene.scene_id);
  const goalChoiceSceneIds = goalScene && choiceScene
    ? uniqueNumbers([goalScene.scene_id, choiceScene.scene_id])
    : [];
  const episodeClosure = Boolean(
    choiceScene
    && consequenceScene
    && consequenceScene.scene_id >= choiceScene.scene_id
    && /结尾|收束|高燃|历史余响|温暖结尾|命运转折/.test(
      `${consequenceScene.dramatic_function}${scenes.at(-1)?.dramatic_function ?? ''}`,
    )
    && scenes.at(-1)?.key_action.trim(),
  );
  const compressionAccounted = orderedSourceCoverage
    && (analysis.compressible_parts.length === 0 || analysis.compressible_parts.every(part => (
      scenes.some(scene => adaptationTextOverlap(part, sceneSearchText(scene)) >= 0.16)
    )));

  return {
    allCoreCharactersCovered,
    coreCharacterSceneIds,
    orderedSourceCoverage,
    sourceCoverageSceneIds,
    compressionAccounted,
    noUntracedCharacterBranch,
    themeAnchorPreserved,
    emotionalTonePreserved,
    themeSceneIds,
    observableCharacterArc,
    episodeClosure,
    protagonistGoalVisible,
    choiceConsequenceSceneIds,
    goalChoiceSceneIds,
  };
}

const ADAPTATION_EMOTION_TERMS = [
  '良知', '人命', '免死', '代价', '勇敢', '善良', '判断', '相信', '真心', '考验', '歌声',
  '搜捕', '伤亡', '失败', '起义', '连锁响应', '改变', '危机', '怀疑', '保护', '共同',
];

function adaptationTextOverlap(source: string, target: string): number {
  const sourcePairs = chineseCharacterPairs(source);
  if (sourcePairs.length === 0) return 0;
  const targetPairs = new Set(chineseCharacterPairs(target));
  return sourcePairs.filter(pair => targetPairs.has(pair)).length / sourcePairs.length;
}

function chineseCharacterPairs(value: string): string[] {
  const text = value.replace(/[^\p{Script=Han}A-Za-z0-9]/gu, '');
  const pairs: string[] = [];
  for (let index = 0; index < text.length - 1; index += 1) {
    pairs.push(text.slice(index, index + 2));
  }
  return uniqueStrings(pairs);
}

function observableSceneEvidence(story: StoryGenerateResult, sceneId: number, signal = ''): string[] {
  const scene = story.scene_breakdown.find(item => item.scene_id === sceneId);
  if (!scene) return [];
  const boundaryEvidence = /来源|史实|事实|边界|证据|现场|再现|传说|版本/.test(signal)
    ? [scene.cultural_note, scene.factual_basis ?? '', ...(scene.fictionalized_elements ?? [])]
    : [];
  const evidence = [scene.plot, scene.key_action, scene.conflict ?? '', scene.dialogue_or_narration ?? '', ...boundaryEvidence]
    .map(item => item.trim())
    .filter(Boolean)
    .join('；');
  return evidence ? [`场景 ${scene.scene_id}「${scene.title || scene.dramatic_function}」：${evidence.slice(0, 160)}`] : [];
}

function signalRepairFields(signal: string): string[] {
  if (/画面|视觉|光影|空间|路线|表情/.test(signal)) return ['visual_prompt', 'camera_suggestion', 'key_action'];
  if (/对白|潜台词|旁白|字幕|记忆句|口号/.test(signal)) return ['dialogue_or_narration', 'plot'];
  if (/来源|史实|事实|边界|证据|现场/.test(signal)) return ['factual_basis', 'cultural_note', 'plot'];
  return ['plot', 'key_action', 'conflict', 'dialogue_or_narration'];
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
  const requiresCharacterAssets = [
    'character_story',
    'historical_drama',
    'legend_story',
    'ai_comic_drama',
    'children_story',
  ].includes(story.video_type);

  if (!requiresCharacterAssets) {
    satisfied.push('该成片类型允许以空间、工艺、讲解或氛围为主体，不强制角色资产。');
  } else if ((story.characters?.length ?? 0) > 0 || (delivery?.character_assets.length ?? 0) > 0) {
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
    const conciseLandscapeUnit = story.video_type === 'landscape_mood'
      && countContentChars(`${scene.key_action} ${scene.visual_prompt} ${scene.camera_suggestion}`) >= 35
      && /雾|云|风|水|光|影|雨|雪|峰|谷|溪|林|声|暮|晨/.test(
        `${scene.plot} ${scene.key_action} ${scene.visual_prompt}`,
      );
    if (countContentChars(scene.plot) < 35 && !conciseLandscapeUnit) {
      unitGaps.push(`${sceneLabel}剧情过薄，需写出地点、动作、冲突/发现和情绪变化。`);
    }
    if (!scene.key_action?.trim()) unitGaps.push(`${sceneLabel}缺少关键动作。`);
    if (requiresCharacterAssets && !scene.characters?.length) assetGaps.push(`${sceneLabel}缺少角色列表。`);
    if (!scene.visual_prompt?.trim()) promptGaps.push(`${sceneLabel}缺少画面提示。`);
    else if (hasPromptNoise(scene.visual_prompt)) promptGaps.push(`${sceneLabel}画面提示混入说明性内容，应只保留空间、人物、道具、光线和构图。`);
  }

  for (const segment of story.gears_segments) {
    const segmentIssues = inspectGearsSegment(segment);
    if (segmentIssues.length === 0) continue;
    promptGaps.push(`段落 ${segment.segment_id}: ${segmentIssues.join('；')}`);
  }

  const gearsContractNotes = (delivery?.validation_notes ?? [])
    .filter(note => !note.startsWith('生产素材'));
  issues.push(...assetGaps, ...unitGaps, ...promptGaps, ...gearsContractNotes);
  const readinessScore = Math.max(0, 100
    - assetGaps.length * 12
    - unitGaps.length * 10
    - promptGaps.length * 8
    - gearsContractNotes.length * 6);

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
  story: StoryGenerateResult,
  qualityReport: StoryQualityReport,
  outlineReport: OutlineCoverageReport,
  patternReport: PatternQualityReport,
  gearsReport: ReturnType<typeof buildGearsReadinessReport>,
  productionMaterialReport: ProductionMaterialQualityReport | undefined,
  audienceReport: AudienceTextReport,
): QualityRepairAction[] {
  const actions: QualityRepairAction[] = [];
  const familyReport = qualityReport.family_quality_report;
  if (familyReport && !familyReport.passed) {
    const guidance = getStoryFamilyRepairGuidance(story.video_type);
    const failedChecks = familyReport.checks.filter(check => check.status === 'failed');
    const evidenceSceneIds = failedChecks.flatMap(check => check.evidence_scene_ids).filter(uniqueNumber);
    const repairSceneIds = evidenceSceneIds.length > 0
      ? evidenceSceneIds
      : story.scene_breakdown.slice(0, 3).map(scene => scene.scene_id);
    actions.push({
      action_id: 'repair-family-quality',
      label: `修复${familyReport.family_label}家族门禁`,
      target_report: 'family',
      severity: failedChecks.length >= 2 ? 'high' : 'medium',
      scene_ids: repairSceneIds,
      prompt: [
        `按「${familyReport.family_label}」片型家族修复，不套用其他家族的叙事义务。`,
        ...failedChecks.map(check => `补齐「${check.label}」：${check.summary}`),
        ...guidance.instructions,
        `优先修改字段：${guidance.focus_fields.join('、')}。`,
      ].join('\n'),
      expected_effect: `${familyReport.family_label}家族的 ${failedChecks.map(check => check.label).join('、')} 由场景可观察证据支持。`,
    });
  }
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
    '籍贯/出生地',
    '少年成长地',
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
  const focusNodes = extractFocusedOutlineNodes(outline);
  if (adaptationNodes.length === 0 && focusNodes.length === 0 && !isLikelyStructuredOutline(outline)) {
    return [];
  }
  const rawNodes = outline
    .split(/\n+|[；;。！？!?]/)
    .map(item => item.replace(/^\s*[-*0-9一二三四五六七八九十、.）)]+/, '').trim())
    .filter(item => item.length >= 6)
    .filter(item => !isOutlineMetaInstruction(item));
  const episodeNodes = rawNodes.filter(isEpisodeOutlineNode);
  const nodes = adaptationNodes.length > 0
    ? adaptationNodes
    : focusNodes.length > 0
      ? focusNodes
      : (episodeNodes.length >= 4 ? episodeNodes : rawNodes).slice(0, 10);
  return nodes
    .map(item => item.trim())
    .filter((item, index, arr) => item && arr.indexOf(item) === index)
    .slice(0, 10);
}

function extractFocusedOutlineNodes(outline: string): string[] {
  const match = outline.match(/^(.*?)(?:，|,)?\s*重点(?:表现|讲述|呈现|突出)([^。！？!?]+)[。！？!?]?$/);
  if (!match) return [];
  const spine = match[1].trim().replace(/(?:的)?故事$/, '').trim();
  const focusItems = match[2]
    .split(/[、，,]/)
    .map(item => item.trim())
    .filter(item => item.length >= 2);
  return [spine, ...focusItems]
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .slice(0, 10);
}

function isOutlineMetaInstruction(text: string): boolean {
  return /^(只生成|本集只写|不生成其他集|本集目标：\d+秒|本集目标：\d+.*格|本集阶段：phase-|阶段目标：建立主角目标|连续性账本|制作约束审计|系列记忆精准召回|召回-|连续性：|文化边界：|叙事流派机制：|知识库使用规则：|长期线索：|角色弧线：|输出要求：|全系列：|承接：建立主角初始状态|围绕[“"].+[”"]制作(?:三分钟|\d+分钟|\d+秒)版本|把[“"].+[”"]压缩为(?:三十秒|\d+秒)版本|开场必须尽快建立可见问题|所有历史、人物、技艺、机构和地貌表达都服从知识条目边界|无法确认的细节使用克制画面|镜头需要有稳定人物或空间锚点|避免抽象口号、模板化解说与无关现代物件|前三秒给出一个可见钩子|只保留一个核心知识点或品牌承诺|每个镜头只承担一个动作或信息|结尾用具体画面收束|不使用空泛口号|保持文化事实、工艺步骤、机构表达与地貌类型准确)/.test(text);
}

function isEpisodeOutlineNode(text: string): boolean {
  return /^(系列《|系列梗概|系列主题|本集标题|本集目标|本集阶段|阶段目标|本集蓝图|本集目标场景功能|本集主冲突|关键角色|本集新增信息|本集伏笔|本集回收|本集结尾钩子|本集后连续性状态|下一集需要承接|开场钩子|冲突升级|中段反转|人物变化|结尾钩子)/.test(text);
}

function isEpisodeFocusedOutline(nodes: string[]): boolean {
  return nodes.some(node => /^(系列《|本集标题|本集目标|本集阶段|本集主冲突|本集结尾钩子|下一集需要承接)/.test(node));
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
    scene.cultural_note,
    scene.factual_basis,
    ...(scene.fictionalized_elements ?? []),
    scene.visual_prompt,
    scene.camera_suggestion,
    ...(scene.characters ?? []),
  ].filter(Boolean).join(' ');
}

function extractMeaningfulTokens(text: string): string[] {
  const blocked = new Set([
    '故事', '人物', '场景', '一个', '他们', '我们', '需要', '开始', '后来', '最后',
    '必须', '保留', '原作', '核心', '情绪', '选择', '镜头', '画面', '主角',
    '生成', '一集', '漫剧', '突出', '三秒', '前三秒',
  ]);
  const anchorTerms = [
    '周敦颐', '疑案', '拒签', '死刑文书', '文书', '画押', '对白', '冲突',
    '表情', '动作', '结尾', '追看', '钩子', '案卷', '催签', '重查', '上官',
    '良知', '证人', '现场', '毛泽东', '湖南', '韶山', '求学', '新民学会',
    '农民运动', '革命觉醒', '理想形成',
  ];
  const rawMatches = text.match(/[\u4e00-\u9fa5]{2,12}|[A-Za-z0-9]{3,}/g) ?? [];
  const splitMatches = rawMatches.flatMap(item => item
    .split(/生成|一集|在|前|突出|和|与|把|通过|围绕|讲述|呈现|进入|要求|需要|必须|的|了/)
    .map(part => part.trim())
    .filter(part => part.length >= 2 && part.length <= 8));
  return [
    ...anchorTerms.filter(term => text.includes(term)),
    ...splitMatches,
  ]
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
  const localPlaceNames = uniqueStrings(compactText.match(
    /[\u4e00-\u9fa5]{2,10}(?:书院|旧址|遗址|博物馆|纪念馆|广场|街巷|古街|山|江|湖|洲|楼|台|塔|桥|城|镇|村)/g,
  ) ?? []);
  const dailyLifeHits = uniqueStrings([
    '早餐摊', '蒸笼', '晨读', '讲解员', '游客', '学生', '市民', '摊主', '散步', '步行',
    '街巷', '灯火', '人群', '日常', '生活', '买菜', '赶集', '上学', '下班', '开门', '收摊',
  ].filter(term => compactText.includes(term)));
  const hasRegionalIdentity = /文脉|湖湘|岭南|巴蜀|江南|中原|闽南|齐鲁|关中|燕赵|气质|烟火|求知|开放|坚韧|包容|生长/.test(compactText);
  const hasSpaceIdentity = localPlaceNames.length >= 1
    && /书院|旧址|遗址|博物馆|纪念馆|园林|宫殿|寺庙|工坊|街区|村落|建筑|空间/.test(compactText);
  const routeActionHits = uniqueStrings([
    '进入', '走进', '沿', '经过', '抵达', '继续', '转入', '穿过', '走向', '回望', '路线', '中轴', '入口', '门槛',
  ].filter(term => compactText.includes(term)));
  const hasFunctionalNode = localPlaceNames.length >= 1
    && /讲学|讲堂|藏书|展陈|祭祀|纪念|居住|生产|交易|通行|功能|使用|晨读|记录/.test(compactText);
  const hasTimeLayer = /古今|旧与今|历史|今天|至今|千年|百年|旧藏|时间|叠印|仍然|仍在/.test(compactText);
  const hasAtmosphericClosure = /停下|停步|回望|渐远|风声|人声|环境声|树影|余音|留白|空镜|空出的|远景|长镜头/.test(compactText);

  if (/地方名词充足/.test(signal)) return localPlaceNames.length >= 2;
  if (/地标清楚|地标识别/.test(signal)) return localPlaceNames.length >= 1;
  if (/生活气息可见|生活气息充足|生活场景/.test(signal)) return dailyLifeHits.length >= 2;
  if (/品牌句有地域性|品牌句有地方感|城市气质/.test(signal)) {
    return localPlaceNames.length >= 1 && hasRegionalIdentity;
  }
  if (/空间身份清楚|空间身份明确|必须有空间身份/.test(signal)) return hasSpaceIdentity;
  if (/路线连续|视觉路线完整|必须有视觉路线/.test(signal)) return routeActionHits.length >= 2;
  if (/节点有功能/.test(signal)) return hasFunctionalNode;
  if (/时间层存在/.test(signal)) return hasTimeLayer;
  if (/氛围收束|氛围结尾/.test(signal)) return hasAtmosphericClosure;
  const checks: Array<[RegExp, RegExp[]]> = [
    [/目标明确|人物目标清楚|必须有主角目标/, [/所求/, /要弄清/, /为了/, /求学不是/, /志向/, /书袋内侧写下/, /不能签字/, /要先看清事实/, /重查/, /重问证人/, /承担亡国之痛/, /还能把什么留给后人/]],
    [/阻力具体|必须有阻力|制度压力可见/, [/官场规则/, /制度压力/, /时代压力/, /军阀统治/, /社会动荡/, /地方权势/, /谷价/, /租息/, /名声/, /人情/, /催客/, /浊浪/, /路远/, /书卷会湿/, /行程.{0,6}误/, /知军.{0,8}催/, /催他签字/, /此案已定/, /得罪上官/, /可能丢官/, /获罪/, /长官权威/, /国都失陷/, /亡国之痛/]],
    [/两难成立/, [/若[^。；]+；若/, /一边[^。；]+一边/, /赶路.{0,12}帮人/, /安稳.{0,12}远行/]],
    [/选择有代价|必须有选择和代价/, [/错过渡船/, /书卷会湿/, /行程.{0,6}误/, /泥痕/, /误一程/, /付出/, /书页.{0,6}皱/, /丢官/, /获罪/, /仕途代价/, /交还任命文书/, /准备辞官/, /得罪上官/, /永别/, /投江/, /怀石/, /一身沉入/]],
    [/行动具体/, [/系紧/, /停下脚步/, /蹲下/, /扶起/, /挽起/, /踩进/, /捞起/, /裹书/, /写下/, /长揖/, /背起/, /收起/]],
    [/精神落点来自选择|结尾有人物变化/, [/守良知/, /守住/, /正义/, /廉洁/, /出淤泥而不染/, /更清楚的心/, /泥痕/, /继续上路/, /守.{0,4}心/, /囚犯因此免死/, /承担仕途代价/, /退回的不是/, /精神坐标/, /忠愤/, /后世反复讲述/]],
    [/因果链清楚|事件因果清楚|必须有事件因果/, [/因为/, /因此/, /于是/, /导致/, /若[^。；]+；若/, /才/, /看见.{0,12}生出/, /生出.{0,12}承担/, /愿意承担.{0,12}才/, /忽然发现/, /郢都失守/, /流放无归/, /不愿苟活/, /发现疑点/, /疑点重重/, /证词前后不合/, /证据不足/, /只待.{0,6}画押/, /因此免死/]],
    [/人物不是年表|不得写成年表式介绍/, [/(少年周敦颐|周敦颐).*(背起|停下脚步|蹲下|挽起|踩进|写下|停住笔|重查|翻到案卷|不能签字|退回|交还任命文书|逐页细读|记录疑点)/, /屈原.*(站在风里|走向汨罗江|整理衣冠|怀石|投江)/, /毛泽东.*(收起|离开|走进|围坐|放下|翻开|整理|徒步|组织|倾听|考察)/]],
    [/史实边界明确|必须标注创作边界|必须有事实边界/, [/影视化创作/, /事实边界/, /史实边界/, /再现边界/, /确证/, /可考/, /据《?史记/, /传统叙述/, /不是《爱莲说》/, /不把.{0,20}写成/, /仍要说清/, /只作.{0,8}伏笔/]],
    [/必须有时代压力|制度压力可见/, [/郢都失守/, /流放/, /亡国/, /楚国/, /军阀统治/, /社会动荡/, /时代压力/, /地方权势/, /谷价/, /租息/, /上官/, /催签/, /制度压力/, /官场规则/]],
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

function uniqueNumbers(values: number[]): number[] {
  return values.filter(uniqueNumber).sort((left, right) => left - right);
}

function uniqueStrings(values: string[]): string[] {
  return values
    .map(value => value.trim())
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index);
}

function sceneIdsFromMessages(items: string[]): number[] {
  return items
    .map(item => Number(item.match(/场景\s*(\d+)/)?.[1]))
    .filter(Number.isFinite);
}

function buildCombinedPreview(...items: string[]): string {
  return items.filter(Boolean).join('；');
}
