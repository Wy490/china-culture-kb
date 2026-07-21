import type {
  AiComicEpisodePlan,
  AiComicPremiseFidelityAnchorCategory,
  AiComicPremiseFidelityEvidenceItem,
  AiComicPremiseFidelityEpisodeReport,
  AiComicSeriesPlan,
  AiComicSeriesPremiseFidelityAudit,
  SeriesPremiseContract,
} from '@shared/types.js';
import { buildSeriesPremiseContract } from './ai-comic-series-premise-contract-service.js';

interface PremiseAnchor {
  anchor_id: string;
  category: AiComicPremiseFidelityAnchorCategory;
  label: string;
  required: boolean;
}

export function auditAiComicSeriesPremiseFidelity(
  plan: AiComicSeriesPlan,
): AiComicSeriesPremiseFidelityAudit {
  const planEpisodes = Array.isArray(plan.episodes) ? plan.episodes : [];
  const planCharacters = Array.isArray(plan.main_characters) ? plan.main_characters : [];
  const contract = plan.premise_contract ?? buildSeriesPremiseContract({
    outline: typeof plan.premise === 'string' ? plan.premise : '',
    detectedCharacters: planCharacters.map(character => ({
      name: character.name,
      role_position: character.role === '主角' ? '主角' as const : '配角' as const,
      character_kind: 'named_person',
      source_text: plan.premise,
      asset_stability: 'recurring',
    })),
  });
  const anchors = buildPremiseAnchors(contract);
  const planTextParts = buildPlanTextParts(plan);
  const episodeReports = planEpisodes.map(episode => auditEpisode(episode, anchors, contract));
  const evidence = anchors.map(anchor => buildEvidence(anchor, planTextParts, planEpisodes));
  const requiredEvidence = evidence.filter(item => item.required);
  const missingRequiredAnchorIds = requiredEvidence.filter(item => !item.matched).map(item => item.anchor_id);
  const genericSubstitutionIssues = findForbiddenSubstitutionIssues(planTextParts, contract);
  const namedCharacterCoverage = coverageForCategory(evidence, 'character');
  const worldRuleCoverage = coverageForCategory(evidence, 'world_rule');
  const antagonisticForceCoverage = coverageForCategory(evidence, 'antagonistic_force');
  const coreStakesCoverage = coverageForCategory(evidence, 'core_stake');
  const applicableCoverage = [
    ['character', namedCharacterCoverage],
    ['world_rule', worldRuleCoverage],
    ['antagonistic_force', antagonisticForceCoverage],
    ['core_stake', coreStakesCoverage],
  ].filter(([category]) => anchors.some(anchor => anchor.category === category)) as Array<[string, number]>;
  const hasRequiredAnchors = anchors.some(anchor => anchor.required);
  const rawPremiseCoverageScore = applicableCoverage.length > 0
    ? Math.round(applicableCoverage.reduce((sum, [, score]) => sum + score, 0) / applicableCoverage.length)
    : 0;
  const failedEpisodeNos = episodeReports.filter(report => !report.hard_gate_passed).map(report => report.episode_no);
  const episodeFailurePenalty = episodeReports.length > 0
    ? Math.round((failedEpisodeNos.length / episodeReports.length) * 20)
    : 0;
  const premiseCoverageScore = Math.max(
    0,
    rawPremiseCoverageScore - genericSubstitutionIssues.length * 15 - episodeFailurePenalty,
  );
  const issues = [
    ...(!hasRequiredAnchors ? ['系列缺少可审计的 required 设定锚点，需要确认或补录 premise contract'] : []),
    ...missingRequiredAnchorIds.map(anchorId => `系列规划缺少 required 设定锚点：${anchorId}`),
    ...genericSubstitutionIssues,
    ...(failedEpisodeNos.length > 0
      ? [`${failedEpisodeNos.length} 个分集未覆盖全部 required 设定锚点：第${failedEpisodeNos.join('、')}集`]
      : []),
  ];

  return {
    schema_version: 'ai-comic-series-premise-fidelity-audit/v2',
    hard_gate_passed: issues.length === 0 && premiseCoverageScore >= 90,
    premise_coverage_score: premiseCoverageScore,
    named_character_coverage: namedCharacterCoverage,
    world_rule_coverage: worldRuleCoverage,
    antagonistic_force_coverage: antagonisticForceCoverage,
    core_stakes_coverage: coreStakesCoverage,
    missing_required_anchor_ids: missingRequiredAnchorIds,
    generic_substitution_issues: genericSubstitutionIssues,
    issues,
    evidence,
    episode_reports: episodeReports,
  };
}

function auditEpisode(
  episode: AiComicEpisodePlan,
  anchors: PremiseAnchor[],
  contract: SeriesPremiseContract,
): AiComicPremiseFidelityEpisodeReport {
  const textParts = buildEpisodeTextParts(episode);
  const evidence = anchors.map(anchor => buildEvidence(anchor, textParts, [episode]));
  const requiredEvidence = evidence.filter(item => item.required);
  const missingRequiredAnchorIds = requiredEvidence.filter(item => !item.matched).map(item => item.anchor_id);
  const genericSubstitutionIssues = findForbiddenSubstitutionIssues(textParts, contract);
  const matchedCount = requiredEvidence.filter(item => item.matched).length;
  const premiseCoverageScore = requiredEvidence.length > 0
    ? Math.round((matchedCount / requiredEvidence.length) * 100)
    : 100;
  return {
    episode_no: episode.episode_no,
    hard_gate_passed: missingRequiredAnchorIds.length === 0 && genericSubstitutionIssues.length === 0,
    premise_coverage_score: premiseCoverageScore,
    missing_required_anchor_ids: missingRequiredAnchorIds,
    generic_substitution_issues: genericSubstitutionIssues,
    evidence,
  };
}

function buildPremiseAnchors(contract: SeriesPremiseContract): PremiseAnchor[] {
  return [
    ...contract.locked_characters.map(character => ({
      anchor_id: `character:${character.name}`,
      category: 'character' as const,
      label: character.name,
      required: character.required,
    })),
    ...contract.world_rules.map(rule => ({
      anchor_id: `world_rule:${rule.rule_id}`,
      category: 'world_rule' as const,
      label: rule.statement,
      required: rule.required,
    })),
    ...contract.antagonistic_forces.map(force => ({
      anchor_id: `antagonistic_force:${force.label}`,
      category: 'antagonistic_force' as const,
      label: force.label,
      required: force.required,
    })),
    ...contract.core_stakes.map((stake, index) => ({
      anchor_id: `core_stake:${index + 1}`,
      category: 'core_stake' as const,
      label: stake,
      required: true,
    })),
  ];
}

function buildEvidence(
  anchor: PremiseAnchor,
  textParts: string[],
  episodes: AiComicEpisodePlan[],
): AiComicPremiseFidelityEvidenceItem {
  const evidenceSpans = textParts.filter(part => matchesAnchor(part, anchor.label)).slice(0, 8);
  const episodeNos = episodes
    .filter(episode => buildEpisodeTextParts(episode).some(part => matchesAnchor(part, anchor.label)))
    .map(episode => episode.episode_no);
  return {
    ...anchor,
    matched: evidenceSpans.length > 0,
    evidence_spans: evidenceSpans,
    episode_nos: episodeNos,
  };
}

function buildPlanTextParts(plan: AiComicSeriesPlan): string[] {
  const characters = Array.isArray(plan.main_characters) ? plan.main_characters : [];
  const plotThreads = Array.isArray(plan.plot_threads) ? plan.plot_threads : [];
  const episodes = Array.isArray(plan.episodes) ? plan.episodes : [];
  return [
    plan.series_title ?? '',
    plan.premise ?? '',
    plan.logline ?? '',
    plan.core_theme ?? '',
    ...characters.flatMap(character => [character.name, character.role, character.desire, character.long_arc]),
    ...plotThreads.flatMap(thread => [thread.title, thread.description, ...(thread.continuity_notes ?? [])]),
    ...episodes.flatMap(buildEpisodeTextParts),
  ].filter((item): item is string => typeof item === 'string' && Boolean(item));
}

function buildEpisodeTextParts(episode: AiComicEpisodePlan): string[] {
  return [
    episode.title,
    episode.opening_hook ?? '',
    episode.main_conflict,
    episode.midpoint_turn ?? '',
    ...episode.key_characters,
    ...episode.continuity_from_previous,
    ...episode.new_information,
    ...episode.foreshadowing,
    ...episode.payoff,
    episode.ending_hook,
    episode.character_state_change ?? '',
    episode.thread_action ?? '',
    ...episode.knowledge_focus,
    ...episode.continuity_state_after,
  ].filter(Boolean);
}

function matchesAnchor(text: string, anchor: string): boolean {
  const normalizedText = normalizeText(text);
  const normalizedAnchor = normalizeText(anchor);
  if (!normalizedAnchor) return true;
  if (normalizedText.includes(normalizedAnchor)) return true;
  const tokens = significantTokens(anchor);
  return tokens.length > 1 && tokens.every(token => normalizedText.includes(normalizeText(token)));
}

function significantTokens(text: string): string[] {
  const stopWords = new Set(['必须', '共同', '持续', '主角', '完成', '进入', '剧情', '保护', '并且', '以及']);
  const tokens = text.match(/[\u4e00-\u9fff]{2,8}|[A-Za-z0-9_-]+/g) ?? [];
  return unique(tokens.filter(token => !stopWords.has(token)).slice(0, 6));
}

function findForbiddenSubstitutionIssues(textParts: string[], contract: SeriesPremiseContract): string[] {
  const sourceNames = new Set(contract.locked_characters.map(character => character.name));
  const text = textParts.join('\n');
  return contract.forbidden_substitutions
    .filter(token => token && !sourceNames.has(token) && text.includes(token))
    .map(token => `发现禁止的通用人物或旧模板替换：${token}`);
}

function coverageForCategory(
  evidence: AiComicPremiseFidelityEvidenceItem[],
  category: AiComicPremiseFidelityAnchorCategory,
): number {
  const items = evidence.filter(item => item.category === category && item.required);
  if (items.length === 0) return 100;
  return Math.round((items.filter(item => item.matched).length / items.length) * 100);
}

function normalizeText(text: string): string {
  return text.replace(/[\s，。；、：:！？!?（）()“”"'《》【】\-—]/g, '');
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
