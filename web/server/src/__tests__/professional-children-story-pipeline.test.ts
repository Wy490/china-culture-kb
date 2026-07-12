import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProfessionalTextPackageSchema } from '@shared/schemas.js';
import type { StoryGenerateResult } from '@shared/types.js';
import { buildChildrenStoryProfessionalTextPackage } from '../services/professional-children-story-pipeline-service.js';
import {
  buildChildrenStoryRevisionPlan,
  rebuildChildrenStoryDerivedText,
} from '../services/professional-children-story-revision-service.js';
import type { ChildrenStoryProfessionalEvidence } from '../services/professional-children-story-quality-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

function childrenStory(): StoryGenerateResult {
  const scenes = [
    ['彩线打结了', '湘绣体验馆的长桌旁', '小满想帮大家摆好彩线，却把红线、蓝线和金线绕成了一个大线团。', '小满把线团捧到桌面上。', '她担心说出错误后大家会失望。'],
    ['第一次越拉越紧', '彩线整理桌', '小满偷偷拉住两根线头，线团反而变得更紧。', '她停下手，数了数露在外面的三根线头。', '继续用力会让线更乱，她需要换一种办法。'],
    ['一起找线头', '体验馆窗边', '小满告诉阿禾自己弄乱了彩线，两个人决定一根一根找。', '小满扶住线团，阿禾轻轻抽出第一根蓝线。', '承认错误有点难，但求助让问题开始变小。'],
    ['三束彩线排好队', '彩线整理桌', '她们按红、蓝、金三种颜色把线放进纸槽，每放好一束就轻轻拍一下桌面。', '小满把最后一束金线放进纸槽。', '她要选择赶快结束，还是再检查一次有没有遗漏。'],
    ['一只没有绣完的小鸟', '湘绣展示墙前', '老师把整理好的线放在未完成的小鸟图样旁，说准备好材料也是作品的一部分。', '小满在记录卡上画下三束彩线，并写上“需要帮忙就说出来”。', '错误没有消失，却变成了下一次可以记住的方法。'],
  ].map(([title, location, plot, keyAction, conflict], index) => ({
    scene_id: index + 1,
    title,
    duration_sec: 45,
    location,
    time_of_day: '白天',
    dramatic_function: ['发现问题', '第一次尝试', '求助与合作', '正向选择', '温暖反馈'][index],
    plot,
    key_action: keyAction,
    characters: index === 1 ? ['小满'] : ['小满', '阿禾', '老师'].slice(0, index === 4 ? 3 : 2),
    visual_prompt: `${location}，明亮柔和，彩线、纸槽和儿童手部安全动作清楚可见。`,
    camera_suggestion: '儿童视线高度的中近景，彩线动作使用慢速特写。',
    cultural_note: '湘绣事实只用于材料、色彩和展示空间；针具由成人管理。',
    conflict,
    dialogue_or_narration: index === 2
      ? '小满：线是我弄乱的。你能和我一起找线头吗？\n阿禾：可以。我们先找蓝色的。'
      : `${title}。红、蓝、金，排好队；慢一点，也会到。`,
    source_entries: ['湘绣——中国四大名绣之一'],
    factual_basis: '湘绣的针线、色彩和刺绣展示来自知识库文化条目。',
    fictionalized_elements: ['小满、阿禾、老师、体验馆事件和具体对白均为儿童故事虚构。'],
  }));

  return {
    storyId: 'children-story-professional-fixture',
    title: '彩线排好队',
    generation_type: 'scene_short',
    video_type: 'children_story',
    presentation_style: 'children_animation',
    source_entry: '湘绣——中国四大名绣之一',
    logline: '七岁的小满弄乱了展览要用的彩线，在偷偷解决失败后学会承认错误、请求帮助并一起整理。',
    theme: '勇敢不是从不犯错，而是愿意说出来、求助并重新尝试。',
    full_text: scenes.map(scene => `${scene.title}。${scene.plot}${scene.dialogue_or_narration}`).join('\n\n'),
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: '',
    cultural_constraints: ['针具和专业工具只由成人操作；不把虚构儿童经历写成真实传承故事。'],
    credibility_note: '湘绣文化事实与虚构儿童故事明确分层。',
    truth_mode: 'inspired_by_material',
    story_structure: 'single_event_drama',
    characters: [
      { name: '小满', role: '儿童主角', description: '七岁，想帮忙又害怕承认错误' },
      { name: '阿禾', role: '同伴', description: '用简单行动陪伴小满重新尝试' },
      { name: '老师', role: '成人支持者', description: '负责工具安全并给予温和反馈' },
    ],
    protagonist_arc: [{
      starting_state: '害怕承认自己弄乱了彩线',
      turning_point: '主动告诉同伴并请求帮助',
      resolution: '学会把错误变成可以记录和再次尝试的方法',
    }],
  };
}

function childrenEvidence(): ChildrenStoryProfessionalEvidence {
  return {
    target_age_band: '7-9',
    reading_level_note: '使用小学低年级可理解的具体名词、动作和情绪词，不使用抽象成人评价。',
    vocabulary_rules: [
      '优先使用线、颜色、拉、放、说、帮忙等可见词。',
      '一次只表达一个原因或一个动作。',
      '不使用匠心、传承使命、责任担当等成人口号。',
    ],
    max_sentence_characters: 28,
    child_protagonist: '小满',
    child_goal: '在展览准备前把自己弄乱的三色彩线重新整理好。',
    gentle_problem: '小满把彩线缠成线团，并因为担心别人失望而不敢马上说出来。',
    safe_stakes: '如果暂时整理不好，只会耽误一小段准备时间；成人会管理针具并提供帮助。',
    attempts: [{
      attempt_id: 'children-attempt-1',
      action: '小满独自拉扯露出的线头。',
      outcome: '线团变得更紧。',
      learning: '着急用力不能解决打结问题。',
    }, {
      attempt_id: 'children-attempt-2',
      action: '小满承认错误并请阿禾一起按颜色找线头。',
      outcome: '彩线一束一束被分开。',
      learning: '说出来和求助能让问题变小。',
    }],
    positive_choice: '小满主动承认错误、请求帮助，并在整理结束前再检查一次。',
    emotional_learning: '小满学会认出害怕和着急，在情绪出现时停下来、说出来并请求帮助。',
    repeated_motif: '红、蓝、金，排好队；慢一点，也会到',
    motif_scene_ids: [1, 3, 5],
    warm_resolution: '同伴陪她完成整理，老师肯定她的诚实和方法，没人因犯错被羞辱或排斥。',
    sensitive_content_boundaries: [
      '针具、剪刀和专业刺绣操作只由成人负责，儿童镜头与工具保持安全距离。',
      '不使用惊吓、羞辱、惩罚、成人责任或传承危机向儿童施压。',
      '不鼓励儿童隐瞒事故或独自处理危险工具。',
    ],
    parent_or_teacher_prompt: '可以问孩子：如果你不小心弄乱了东西，会先停下来做什么？你愿意向谁求助？',
    scene_turns: {
      '1': '从想帮忙转为发现自己弄乱彩线',
      '2': '从偷偷解决转为发现用力没有用',
      '3': '从害怕承认转为主动求助',
      '4': '从一起整理转为学会检查和耐心',
      '5': '从犯错羞怯转为把经验记成方法',
    },
  };
}

function pipelineInput(): any {
  return {
    story: childrenStory(),
    target_audience: '7至9岁儿童及亲子共读家庭',
    platform: '儿童二维动画短片',
    target_duration: '5分钟',
    communication_goal: '用整理彩线的小问题帮助儿童认识犯错、着急与求助。',
    production_goal: '形成明亮、温和、可进入儿童动画分镜的完整故事。',
    budget_assumptions: ['一个体验馆空间', '两名儿童和一名成人支持者'],
    delivery_constraints: ['不执行真实视频生成', '专业针具只由成人操作'],
    audience_promise: '孩子将看到小满如何把一个令人着急的错误变成可以一起解决的小问题。',
    truth_mode: 'inspired_by_material',
    research: {
      source_summary: '知识库提供湘绣工艺、材料、色彩和文化边界；儿童故事为独立虚构。',
      evidence_items: [{
        evidence_id: 'evidence-xiang-embroidery-fact',
        status: 'verified_fact',
        claim: '湘绣是中国传统刺绣类别，使用针线、绣稿和色彩组织等工艺元素。',
        source: '湘绣——中国四大名绣之一',
        allowed_usage: '用于文化空间、材料和视觉背景。',
        verification_note: '不据此虚构具体传承人或儿童经历。',
      }, {
        evidence_id: 'evidence-children-fiction',
        status: 'fictional_addition',
        claim: '小满、阿禾、老师和整理彩线事件均为儿童动画虚构。',
        source: '原创儿童故事设定',
        allowed_usage: '用于人物、问题、尝试和情绪学习。',
        verification_note: '不得写成真实机构或人物经历。',
      }],
      unknowns: ['具体体验馆陈设、公开活动流程和儿童参与规则需按实际机构复核。'],
      authorization_notes: ['不复制现代绘本、动画角色或具体故事表达。'],
    },
    children_evidence: childrenEvidence(),
    now: '2026-07-11T03:00:00.000Z',
  };
}

function hardGateIds(pkg: ReturnType<typeof buildChildrenStoryProfessionalTextPackage>): string[] {
  return pkg.quality_report.hard_gate_failures.map(item => item.split(':', 1)[0]);
}

describe('children_story professional text pipeline', () => {
  it('builds an age-bounded safe candidate without claiming professional pass', () => {
    const pkg = buildChildrenStoryProfessionalTextPackage(pipelineInput());
    const parsed = ProfessionalTextPackageSchema.safeParse(pkg);

    expect(parsed.success, parsed.success ? '' : parsed.error.message).toBe(true);
    expect(pkg.status).toBe('in_review');
    expect(pkg.scene_breakdown).toHaveLength(5);
    expect(pkg.sequence_beats).toHaveLength(5);
    expect(pkg.director_text_plan.sequences).toHaveLength(5);
    expect(pkg.delivery_text_package.scene_units).toHaveLength(5);
    expect(pkg.quality_report.hard_gate_failures).toEqual([]);
    expect(pkg.quality_report.total_score).toBeGreaterThanOrEqual(80);
    expect(pkg.quality_report.professional_passed).toBe(false);
    expect(pkg.delivery_text_package.validation_notes.join('\n')).toContain('亲师共读提示');
  });

  it('detects all registered children failure fixtures and routes targeted revisions', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(
      repoRoot,
      'data/professional-benchmarks/children-story-iteration6-benchmark-specs.json',
    ), 'utf8')) as Record<string, any>;

    for (const fixture of registry.failure_fixtures as Array<Record<string, any>>) {
      const input = pipelineInput();
      if (fixture.fixture_id.includes('no-age')) {
        input.children_evidence.target_age_band = '';
        input.children_evidence.reading_level_note = '';
        input.children_evidence.vocabulary_rules = [];
        input.children_evidence.max_sentence_characters = 0;
      }
      if (fixture.fixture_id.includes('unsafe-punitive')) {
        input.story.full_text = `${input.story.full_text}\n孩子被羞辱后决定报复杀人。`;
        input.children_evidence.safe_stakes = '';
        input.children_evidence.warm_resolution = '用惩罚和羞辱赶走犯错的孩子。';
        input.children_evidence.sensitive_content_boundaries = [];
      }
      if (fixture.fixture_id.includes('moral-lecture')) {
        input.children_evidence.attempts = [];
        input.children_evidence.positive_choice = '';
        input.children_evidence.emotional_learning = '';
        input.children_evidence.repeated_motif = '';
        input.children_evidence.motif_scene_ids = [];
        input.children_evidence.parent_or_teacher_prompt = '';
        input.children_evidence.scene_turns = {};
      }

      const pkg = buildChildrenStoryProfessionalTextPackage(input);
      const detected = hardGateIds(pkg);
      const revisionPlan = buildChildrenStoryRevisionPlan(pkg);

      expect(pkg.quality_report.professional_passed).toBe(false);
      expect(detected).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
      expect(revisionPlan.actions.map(action => action.issue_id))
        .toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
      expect(revisionPlan.professional_passed).toBe(false);
    }
  });

  it('rebuilds stale children derived sections and preserves child-safety evaluation', () => {
    const pkg = buildChildrenStoryProfessionalTextPackage(pipelineInput());
    pkg.sequence_beats = [];
    pkg.director_text_plan.sequences = [];
    pkg.delivery_text_package.scene_units = [];

    const result = rebuildChildrenStoryDerivedText({
      package: pkg,
      children_evidence: childrenEvidence(),
      now: '2026-07-11T03:10:00.000Z',
    });

    expect(result.rebuilt_sections).toEqual([
      'sequence_beats',
      'director_text_plan',
      'delivery_text_package',
    ]);
    expect(result.package.revision_trace).toHaveLength(1);
    expect(result.package.quality_report.professional_passed).toBe(false);
    expect(ProfessionalTextPackageSchema.safeParse(result.package).success).toBe(true);
  });

  it('registers five real-model specs and excludes fixtures from professional credit', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(
      repoRoot,
      'data/professional-benchmarks/children-story-iteration6-benchmark-specs.json',
    ), 'utf8')) as Record<string, any>;

    expect(registry.summary).toMatchObject({
      fixed_project_spec_count: 5,
      fixed_real_model_project_count: 0,
      fixed_real_model_project_pass_count: 0,
      failure_fixture_count: 3,
      human_blind_review_pass_count: 0,
    });
    expect(registry.policy.child_development_or_safety_review_required).toBe(true);
    expect(registry.projects).toHaveLength(5);
    expect(registry.projects.every((item: Record<string, unknown>) =>
      item.status === 'awaiting_real_model_run' && item.professional_passed === false
    )).toBe(true);
    expect(registry.failure_fixtures).toHaveLength(3);
    expect(registry.failure_fixtures.every((item: Record<string, unknown>) =>
      item.fixture_kind === 'simulation_failure_fixture' && item.professional_passed === false
    )).toBe(true);
  });
});
