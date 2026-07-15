import type {
  StoryDomainSafetyFinding,
  StoryDomainSafetyReport,
  StoryDomainSafetyValidationInput,
} from '@shared/types.js';

const RULE_IDS = [
  'CC-S001-CREDIBILITY-CONSTRAINT',
  'CC-S002-UNVERIFIED-POINT',
  'CC-S003-CREDIBILITY-PROVENANCE',
  'CC-S004-SOURCE-TRACE',
] as const;

export function validateChinaCultureStoryContent(
  input: StoryDomainSafetyValidationInput,
): StoryDomainSafetyReport {
  const blockers: StoryDomainSafetyFinding[] = [];
  const warnings: StoryDomainSafetyFinding[] = [];
  const { source_entry: entry, story } = input;
  const constraints = new Set(story.cultural_constraints.map(item => item.trim()).filter(Boolean));

  const credibilityConstraint = entry.credibility === '存疑'
    ? '条目整体可信度存疑，需大量核实方可用于创作'
    : entry.credibility === '待核实'
      ? '条目可信度待核实，核心情节可能缺乏佐证'
      : undefined;
  if (credibilityConstraint && !constraints.has(credibilityConstraint)) {
    blockers.push({
      rule_id: RULE_IDS[0],
      severity: 'blocker',
      message: `缺少可信度边界：${credibilityConstraint}`,
    });
  }
  if (credibilityConstraint) {
    warnings.push({
      rule_id: RULE_IDS[0],
      severity: 'warning',
      message: `来源可信度为“${entry.credibility}”，机器边界不能替代真人来源与文化复核`,
    });
  }

  for (const point of entry.unverifiedPoints) {
    const expected = `待核实：${point}`;
    if (!constraints.has(expected)) {
      blockers.push({
        rule_id: RULE_IDS[1],
        severity: 'blocker',
        message: `缺少待核实点约束：${point}`,
      });
    }
  }

  if (!story.credibility_note.includes(entry.credibility) || !story.credibility_note.includes(entry.name)) {
    blockers.push({
      rule_id: RULE_IDS[2],
      severity: 'blocker',
      message: 'credibility_note 未同时保留来源条目名称与可信度等级',
    });
  }

  const hasSourceTrace = story.scene_breakdown.some(scene => scene.source_entries?.includes(entry.name));
  if (!hasSourceTrace) {
    blockers.push({
      rule_id: RULE_IDS[3],
      severity: 'blocker',
      message: 'scene_breakdown 未保留任何来源条目追踪',
    });
  }

  return {
    schema_version: 'story-domain-safety/v1',
    domain: 'china_culture',
    passed: blockers.length === 0,
    evaluated_rule_ids: [...RULE_IDS],
    blockers,
    warnings,
    machine_validation_only: true,
    human_review_complete: false,
    real_credit_granted: false,
  };
}
