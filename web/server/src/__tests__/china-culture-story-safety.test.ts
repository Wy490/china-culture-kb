import { describe, expect, it } from 'vitest';
import type { StoryDomainSafetyValidationInput } from '@shared/types.js';
import { validateChinaCultureStoryContent } from '../domains/china-culture/story-safety.js';

function safetyInput(): StoryDomainSafetyValidationInput {
  const entryName = '月岩悟道——待核实传说';
  return {
    source_entry: {
      name: entryName,
      credibility: '待核实',
      unverifiedPoints: ['月岩悟道为D级传说，不可写成史实'],
    },
    story: {
      cultural_constraints: [
        '条目可信度待核实，核心情节可能缺乏佐证',
        '待核实：月岩悟道为D级传说，不可写成史实',
      ],
      credibility_note: `待核实；核心事件来自素材条目"${entryName}"`,
      scene_breakdown: [{ source_entries: [entryName] }],
    },
  } as StoryDomainSafetyValidationInput;
}

describe('china_culture story safety boundary', () => {
  it('passes only as machine validation when provenance boundaries are preserved', () => {
    const report = validateChinaCultureStoryContent(safetyInput());

    expect(report).toMatchObject({
      passed: true,
      machine_validation_only: true,
      human_review_complete: false,
      real_credit_granted: false,
    });
    expect(report.blockers).toEqual([]);
    expect(report.warnings).toHaveLength(1);
  });

  it('fails closed when model output strips credibility, unverified and source boundaries', () => {
    const input = safetyInput();
    input.story.cultural_constraints = [];
    input.story.credibility_note = '模型称全部可靠';
    input.story.scene_breakdown = [];

    const report = validateChinaCultureStoryContent(input);

    expect(report.passed).toBe(false);
    expect(report.blockers.map(item => item.rule_id)).toEqual(expect.arrayContaining([
      'CC-S001-CREDIBILITY-CONSTRAINT',
      'CC-S002-UNVERIFIED-POINT',
      'CC-S003-CREDIBILITY-PROVENANCE',
      'CC-S004-SOURCE-TRACE',
    ]));
  });
});
