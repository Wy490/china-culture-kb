import { createHash } from 'node:crypto';
import type {
  AiComicEpisodePlan,
  AiComicSeriesDiversityExactDuplicateGroup,
  AiComicSeriesDiversityPairReport,
  AiComicSeriesDiversityReport,
  AiComicSeriesDiversityThresholds,
  AiComicSeriesPlan,
} from '@shared/types.js';

export const DEFAULT_AI_COMIC_DIVERSITY_THRESHOLDS: AiComicSeriesDiversityThresholds = {
  max_adjacent_token_overlap: 0.72,
  max_dialogue_token_overlap: 0.7,
  max_hook_type_streak: 2,
  max_scene_sequence_repetitions: 4,
  max_signature_combo_streak: 1,
};

export function auditAiComicSeriesDiversity(
  plan: AiComicSeriesPlan,
  thresholds: AiComicSeriesDiversityThresholds = DEFAULT_AI_COMIC_DIVERSITY_THRESHOLDS,
): AiComicSeriesDiversityReport {
  const episodes = Array.isArray(plan.episodes) ? plan.episodes : [];
  const exactOpeningDuplicateGroups = findExactOpeningDuplicateGroups(episodes);
  const adjacentPairReports = buildAdjacentPairReports(episodes, thresholds);
  const repeatedSceneFunctionSequences = findRepeatedSceneFunctionSequences(episodes, thresholds);
  const hookTypeStreakIssues = findStreakIssues(
    episodes,
    episode => episode.commercial_beats?.opening_hook_type ?? '',
    thresholds.max_hook_type_streak,
    '开场钩子类型',
  );
  const signatureComboStreakIssues = findStreakIssues(
    episodes,
    episode => normalizeText(episode.commercial_beats?.signature_combo ?? ''),
    thresholds.max_signature_combo_streak,
    '地点/人物/动作组合',
  );
  const issues = [
    ...exactOpeningDuplicateGroups.map(group => (
      `第${group.episode_nos.join('、')}集的标准化前三秒钩子 exact 相同`
    )),
    ...adjacentPairReports.flatMap(report => report.issues),
    ...repeatedSceneFunctionSequences.map(item => (
      `场景功能序列在第${item.episode_nos.join('、')}集重复 ${item.episode_nos.length} 次，超过阈值`
    )),
    ...hookTypeStreakIssues,
    ...signatureComboStreakIssues,
  ];
  const failedPairCount = adjacentPairReports.filter(report => !report.passed).length;
  const score = Math.max(0, 100
    - exactOpeningDuplicateGroups.length * 25
    - failedPairCount * 8
    - repeatedSceneFunctionSequences.length * 10
    - hookTypeStreakIssues.length * 8
    - signatureComboStreakIssues.length * 8);

  return {
    schema_version: 'ai-comic-series-diversity-report/v1',
    passed: issues.length === 0,
    score,
    thresholds,
    exact_opening_duplicate_groups: exactOpeningDuplicateGroups,
    adjacent_pair_reports: adjacentPairReports,
    repeated_scene_function_sequences: repeatedSceneFunctionSequences,
    hook_type_streak_issues: hookTypeStreakIssues,
    signature_combo_streak_issues: signatureComboStreakIssues,
    issues,
  };
}

function findExactOpeningDuplicateGroups(
  episodes: AiComicEpisodePlan[],
): AiComicSeriesDiversityExactDuplicateGroup[] {
  const groups = new Map<string, Array<{ episodeNo: number; evidence: string }>>();
  for (const episode of episodes) {
    const evidence = episode.commercial_beats?.hook_3s ?? episode.opening_hook ?? '';
    const normalized = normalizeExactOpening(evidence);
    if (!normalized) continue;
    const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
    const items = groups.get(hash) ?? [];
    items.push({ episodeNo: episode.episode_no, evidence });
    groups.set(hash, items);
  }
  return [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([hash, items]) => ({
      normalized_hash: hash,
      episode_nos: items.map(item => item.episodeNo),
      evidence: items.map(item => item.evidence),
    }));
}

function buildAdjacentPairReports(
  episodes: AiComicEpisodePlan[],
  thresholds: AiComicSeriesDiversityThresholds,
): AiComicSeriesDiversityPairReport[] {
  return episodes.slice(1).map((episode, index) => {
    const previous = episodes[index];
    const tokenOverlap = tokenOverlapScore(commercialFingerprint(previous), commercialFingerprint(episode));
    const dialogueTokenOverlap = tokenOverlapScore(
      previous.commercial_beats?.opening_dialogue ?? '',
      episode.commercial_beats?.opening_dialogue ?? '',
    );
    const issues: string[] = [];
    if (tokenOverlap > thresholds.max_adjacent_token_overlap) {
      issues.push(`第${previous.episode_no}-${episode.episode_no}集商业节拍 token overlap ${tokenOverlap.toFixed(2)} 超过 ${thresholds.max_adjacent_token_overlap.toFixed(2)}`);
    }
    if (dialogueTokenOverlap > thresholds.max_dialogue_token_overlap) {
      issues.push(`第${previous.episode_no}-${episode.episode_no}集开场对白骨架 overlap ${dialogueTokenOverlap.toFixed(2)} 超过 ${thresholds.max_dialogue_token_overlap.toFixed(2)}`);
    }
    return {
      left_episode_no: previous.episode_no,
      right_episode_no: episode.episode_no,
      token_overlap: tokenOverlap,
      dialogue_token_overlap: dialogueTokenOverlap,
      passed: issues.length === 0,
      issues,
    };
  });
}

function findRepeatedSceneFunctionSequences(
  episodes: AiComicEpisodePlan[],
  thresholds: AiComicSeriesDiversityThresholds,
): AiComicSeriesDiversityReport['repeated_scene_function_sequences'] {
  const groups = new Map<string, number[]>();
  for (const episode of episodes) {
    const sequence = episode.commercial_beats?.scene_function_sequence ?? [];
    const key = sequence.map(normalizeText).filter(Boolean).join('>');
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), episode.episode_no]);
  }
  return [...groups.entries()]
    .filter(([, episodeNos]) => episodeNos.length > thresholds.max_scene_sequence_repetitions)
    .map(([sequenceKey, episodeNos]) => ({
      sequence_key: sequenceKey,
      episode_nos: episodeNos,
    }));
}

function findStreakIssues(
  episodes: AiComicEpisodePlan[],
  valueFor: (episode: AiComicEpisodePlan) => string,
  maximum: number,
  label: string,
): string[] {
  const issues: string[] = [];
  let current = '';
  let episodeNos: number[] = [];
  const flush = () => {
    if (current && episodeNos.length > maximum) {
      issues.push(`${label}“${current}”连续用于第${episodeNos.join('、')}集，超过连续 ${maximum} 集上限`);
    }
  };
  for (const episode of episodes) {
    const value = valueFor(episode);
    if (value && value === current) {
      episodeNos.push(episode.episode_no);
    } else {
      flush();
      current = value;
      episodeNos = value ? [episode.episode_no] : [];
    }
  }
  flush();
  return issues;
}

function commercialFingerprint(episode: AiComicEpisodePlan): string {
  const beats = episode.commercial_beats;
  if (!beats) return [episode.opening_hook, episode.main_conflict, episode.midpoint_turn, episode.ending_hook]
    .filter(Boolean)
    .join('\n');
  return [
    beats.hook_3s,
    beats.episode_goal,
    beats.midpoint_turn,
    beats.character_choice,
    beats.cliffhanger_question,
  ].join('\n');
}

function tokenOverlapScore(left: string, right: string): number {
  const leftTokens = ngramTokens(left);
  const rightTokens = ngramTokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter(token => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return Number((intersection / Math.max(1, union)).toFixed(4));
}

function ngramTokens(text: string): Set<string> {
  const normalized = normalizeText(text).replace(/[0-9一二三四五六七八九十百千]+/g, '#');
  const tokens = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    tokens.add(normalized.slice(index, index + 2));
  }
  return tokens;
}

function normalizeExactOpening(text: string): string {
  return normalizeText(text);
}

function normalizeText(text: string): string {
  return text.replace(/[\s，。；、：:！？!?（）()“”"'《》【】\-—]/g, '').trim();
}
