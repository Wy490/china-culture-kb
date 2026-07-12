import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProfessionalTextPackage } from '@shared/types.js';
import { createProfessionalTextPackageSkeleton } from '../services/professional-text-package-service.js';
import {
  buildProfessionalCoverageActionSet,
  importProfessionalTableReadFeedback,
  recordProfessionalRevisionRound,
  validateProfessionalMultiRoundRevisionLedger,
} from '../services/professional-multi-round-revision-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

function packageAt(score: number, failures: string[], version: number): ProfessionalTextPackage {
  const pkg = createProfessionalTextPackageSkeleton({
    video_type: 'character_story',
    package_id: 'stage6-character-package',
    story_id: 'stage6-character-story',
    now: `2026-07-11T14:0${version}:00.000Z`,
  });
  pkg.project_id = 'stage6-real-project-001';
  pkg.status = failures.length ? 'revision_required' : 'in_review';
  pkg.full_text = `版本${version}：主人公在具体压力下作出选择，并承担可见后果。`;
  pkg.scene_breakdown = [{
    scene_id: 1,
    title: `选择现场-${version}`,
    duration_sec: 60,
    location: '真实文化空间待核机位',
    time_of_day: '白天',
    dramatic_function: '选择与后果',
    plot: '主人公面对阻力，改变行动并承担代价。',
    key_action: '主人公放下旧方案，拿起有证据支持的新方案。',
    characters: ['主人公'],
    visual_prompt: '真实空间中的手部选择动作。',
    camera_suggestion: '中景记录动作与反应。',
    cultural_note: '事实与戏剧化分层。',
  }];
  pkg.sequence_beats = [{
    beat_id: `beat-${version}`,
    order: 1,
    title: '选择',
    purpose: '让选择改变局面',
    visible_action: '放下旧方案并拿起新方案',
    conflict_discovery_or_instruction: '旧方案安全但无效',
    emotional_or_information_turn: '从犹疑转向承担',
    evidence_ids: [],
  }];
  pkg.director_text_plan.sequences = [{
    sequence_id: `sequence-${version}`,
    scene_ids: [1],
    blocking_and_visible_action: '主人公移动并完成选择',
    camera_and_transition_intent: '动作完成后停留在反应上',
    sound_intent: '保留动作声与短暂停顿',
    production_constraints: ['真实地点待核'],
  }];
  pkg.delivery_text_package.scene_units = [{
    scene_id: 1,
    script_text: pkg.full_text,
    visual_action: '放下旧方案并拿起新方案',
    camera_intent: '中景记录选择',
    sound_intent: '动作声',
    continuity_notes: ['道具连续'],
    evidence_boundary_notes: ['事实与戏剧化分层'],
  }];
  pkg.quality_report = {
    ...pkg.quality_report,
    status: failures.length ? 'failed' : 'professional_candidate',
    total_score: score,
    hard_gate_failures: failures,
    professional_passed: false,
  };
  pkg.coverage_report = {
    verdict: failures.length ? 'revise' : 'pass',
    strengths: ['可见行动'],
    structure_notes: failures.includes('choice_missing: 缺选择') ? ['选择没有改变因果。'] : [],
    character_or_information_notes: failures.includes('character_goal_missing: 缺目标') ? ['人物目标不清。'] : [],
    scene_notes: [],
    dialogue_or_narration_notes: [],
    pacing_notes: [],
    fact_and_culture_notes: failures.includes('truth_boundary_missing: 缺边界') ? ['事实边界待核。'] : [],
    production_notes: [],
    action_items: failures,
  };
  return pkg;
}

function tableRead(pkg: ProfessionalTextPackage) {
  return importProfessionalTableReadFeedback({
    package: pkg,
    feedback: [{
      feedback_id: 'table-read-001',
      source: 'writer_editor',
      category: 'structure',
      note: '选择发生了，但需要让后果在下一拍可见。',
      issue_id: 'choice_missing',
      target_sections: ['sequence_beats', 'full_text'],
      evidence_required: false,
    }],
  });
}

const allDerived = ['scene_breakdown', 'sequence_beats', 'director_text_plan', 'delivery_text_package'] as const;

describe('professional multi-round revision workflow', () => {
  it('normalizes existing coverage into six actionable categories', () => {
    const coverage = buildProfessionalCoverageActionSet({
      package: packageAt(70, ['character_goal_missing: 缺目标', 'truth_boundary_missing: 缺边界'], 0),
      now: '2026-07-11T14:00:00.000Z',
    });
    expect(coverage.categories.map(item => item.category)).toEqual([
      'structure',
      'character_or_information',
      'scene',
      'dialogue_or_narration',
      'pacing',
      'fact_and_culture',
    ]);
    expect(coverage.hard_gate_issue_count).toBe(2);
    expect(coverage.professional_passed).toBe(false);
  });

  it('records fixture improvement but gives it no verified real-revision credit', () => {
    const before = packageAt(70, ['choice_missing: 缺选择'], 0);
    const after = packageAt(78, [], 1);
    const result = recordProfessionalRevisionRound({
      before_package: before,
      after_package: after,
      changed_sections: ['full_text'],
      rebuilt_derived_sections: [...allDerived],
      table_read_feedback: tableRead(before),
      feedback_resolutions: [{ feedback_id: 'table-read-001', resolution_note: '已增加后果动作拍。' }],
      provenance: {
        artifact_kind: 'fixture',
        output_id: 'fixture-output',
        model_or_author: 'local-test',
        prompt_or_brief_version: 'fixture-v1',
        provenance_verified: true,
        cost_recorded: false,
      },
      now: '2026-07-11T14:10:00.000Z',
    });
    expect(result.ledger.summary).toMatchObject({
      recorded_round_count: 1,
      completed_verified_round_count: 0,
      fixture_or_simulation_round_count: 1,
      stage6_exit_candidate: false,
      professional_passed: false,
    });
    expect(result.ledger.rounds[0].quality_delta).toBe(8);
    expect(validateProfessionalMultiRoundRevisionLedger(result.ledger)).toEqual([]);
  });

  it('requires two verified traceable rounds before becoming a Stage 6 exit candidate', () => {
    const firstBefore = packageAt(66, ['choice_missing: 缺选择', 'truth_boundary_missing: 缺边界'], 0);
    const firstAfter = packageAt(76, ['truth_boundary_missing: 缺边界'], 1);
    const first = recordProfessionalRevisionRound({
      before_package: firstBefore,
      after_package: firstAfter,
      changed_sections: ['full_text'],
      rebuilt_derived_sections: [...allDerived],
      table_read_feedback: tableRead(firstBefore),
      feedback_resolutions: [{ feedback_id: 'table-read-001', resolution_note: '已使选择后果可见。' }],
      provenance: { artifact_kind: 'real_model', output_id: 'real-output-1', model_or_author: 'approved-model', prompt_or_brief_version: 'brief-v1', provenance_verified: true, cost_recorded: true },
      now: '2026-07-11T14:10:00.000Z',
    });
    const secondAfter = packageAt(84, [], 2);
    const second = recordProfessionalRevisionRound({
      ledger: first.ledger,
      before_package: firstAfter,
      after_package: secondAfter,
      changed_sections: ['truth_and_adaptation_contract', 'full_text'],
      rebuilt_derived_sections: [...allDerived],
      table_read_feedback: importProfessionalTableReadFeedback({
        package: firstAfter,
        feedback: [{ feedback_id: 'table-read-002', source: 'fact_culture_reviewer', category: 'fact_and_culture', note: '补齐事实与戏剧化边界。', issue_id: 'truth_boundary_missing', target_sections: ['truth_and_adaptation_contract', 'full_text'], evidence_required: true }],
      }),
      feedback_resolutions: [{ feedback_id: 'table-read-002', resolution_note: '已补证据状态和待核声明。' }],
      provenance: { artifact_kind: 'human_authored', output_id: 'human-revision-2', model_or_author: 'writer-editor-001', prompt_or_brief_version: 'brief-v2', provenance_verified: true, cost_recorded: true },
      now: '2026-07-11T14:20:00.000Z',
    });
    expect(second.ledger.summary).toMatchObject({ completed_verified_round_count: 2, traceable_quality_improvement_round_count: 2, total_quality_delta: 18, open_table_read_feedback_count: 0, stage6_exit_candidate: true, professional_passed: false });
    expect(validateProfessionalMultiRoundRevisionLedger(second.ledger)).toEqual([]);
  });

  it('fails closed when source text changes without rebuilding derived sections', () => {
    const before = packageAt(70, ['choice_missing: 缺选择'], 0);
    const after = packageAt(78, [], 1);
    expect(() => recordProfessionalRevisionRound({
      before_package: before,
      after_package: after,
      changed_sections: ['full_text'],
      rebuilt_derived_sections: ['delivery_text_package'],
      table_read_feedback: [],
      provenance: { artifact_kind: 'simulation', output_id: 'sim-1', model_or_author: 'local', prompt_or_brief_version: 'sim-v1', provenance_verified: false, cost_recorded: false },
    })).toThrow(/stale_derived_sections/);
  });

  it('registers one pending real multi-round project per VideoType without granting credit', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json'), 'utf8'));
    expect(registry.summary).toMatchObject({ covered_video_type_count: 15, fixed_multi_round_revision_project_spec_count: 15, completed_two_round_verified_project_count: 0, recorded_verified_revision_round_count: 0, failure_fixture_count: 3, professional_pass_count: 0 });
    expect(new Set(registry.projects.map((project: any) => project.video_type)).size).toBe(15);
    expect(registry.projects.every((project: any) => project.professional_passed === false && project.verified_revision_round_count === 0)).toBe(true);
  });
});
