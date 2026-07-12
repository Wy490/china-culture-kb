import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProfessionalTextPackageSchema } from '@shared/schemas.js';
import type { StoryGenerateResult } from '@shared/types.js';
import { buildEducationTrainingProfessionalTextPackage } from '../services/professional-education-training-pipeline-service.js';
import {
  buildEducationTrainingRevisionPlan,
  rebuildEducationTrainingDerivedText,
} from '../services/professional-education-training-revision-service.js';
import type { EducationTrainingEvidence } from '../services/professional-education-training-quality-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

function story(): StoryGenerateResult {
  const scenes = [
    ['学习目标', '培训桌与目标卡', '讲师把“区分事实与教学图示”“写出边界标签”两张目标卡贴到板上。'],
    ['步骤一', '来源核对台', '讲师在知识条目、器物照片和来源栏之间逐项连线。'],
    ['步骤二', '事实分类板', '讲师把事实、解释图示和未知项放入三种颜色框。'],
    ['完整示范', '长沙窑案例工作台', '讲师从来源核对到边界标签完整演示一次，学员按检查表观察。'],
    ['练习评估', '暂停练习卡与评分表', '画面暂停，学员为另一张器物卡分类并填写证据标签。'],
    ['反馈复盘', '错误样例与复盘清单', '讲师对照评分规则纠正错标，并让三项复盘清单依次亮起。'],
  ].map((item, index) => ({
    scene_id: index + 1,
    title: item[0],
    duration_sec: 70,
    location: item[1],
    time_of_day: '白天',
    dramatic_function: ['目标', '知识步骤', '知识步骤', '示范', '练习评估', '反馈复盘'][index],
    plot: item[2],
    key_action: item[2],
    characters: ['培训讲师', '学习者'],
    visual_prompt: `${item[1]}，步骤编号、可暂停示范和检查表清楚可见。`,
    camera_suggestion: '中景教学与手部操作特写交替。',
    cultural_note: '知识、教学组织和未知项分层。',
    conflict: '学习结果必须可观察和评估。',
    dialogue_or_narration: [
      '学完后，你要能完成两个动作：先把一句说法分成事实、解释或未知，再为它写出来源和使用边界。',
      '第一步只做来源核对：找到条目、图片出处和允许使用的范围；没有来源的内容先进入待核栏。',
      '第二步做分类：事实放入蓝框，教学图示放入黄框，未知项放入灰框。颜色只是教学标记，不是器物属性。',
      '现在看完整示范。讲师选取长沙窑釉下彩信息，核对来源、分类表述，再写下“具体器物参数仍需专业复核”。',
      '请暂停画面，为新的器物卡完成分类和边界标签。评分只看四项：分类正确、来源存在、未知项保留、表达不过度。',
      '如果把图示写成事实，退回第二步重新分类；如果漏了来源，退回第一步。最后复盘：查来源、分层级、写边界。',
    ][index],
    source_entries: ['长沙窑铜官陶瓷烧制技艺——海上丝绸之路的釉下彩开创'],
    factual_basis: '长沙窑与釉下彩信息来自知识库。',
    fictionalized_elements: ['讲师、学习者、卡片和分类框为教学组织。'],
  }));
  return {
    storyId: 'training-fixture',
    title: '文化知识证据分层训练',
    generation_type: 'scene_short',
    video_type: 'education_training',
    presentation_style: 'host_narration',
    source_entry: '长沙窑铜官陶瓷烧制技艺——海上丝绸之路的釉下彩开创',
    logline: '通过目标、示范、练习和评分，训练学习者为文化知识写出证据边界。',
    theme: '培训的价值不是听懂，而是能正确完成并接受检验。',
    full_text: scenes.map(scene => `${scene.title}。${scene.plot}${scene.dialogue_or_narration}`).join('\n\n'),
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: '',
    cultural_constraints: ['不把教学图示、模拟案例或未知参数写成确定事实。'],
    credibility_note: '事实、教学组织、制度要求和未知项分层。',
    truth_mode: 'institutional_verified',
    story_structure: 'lecture_argument',
  };
}

function trainingEvidence(): EducationTrainingEvidence {
  return {
    learner_profile: '需要把文化知识条目转为视频脚本的初级内容编辑，已会阅读条目但缺证据分层经验。',
    learning_objectives: [
      { objective_id: 'objective-classify', observable_action: '把给定表述正确分类为事实、解释图示或未知项。', success_criteria: '四条样例至少三条分类正确，且不删除未知项。', evidence_ids: ['kiln-fact'] },
      { objective_id: 'objective-label', observable_action: '为文化表述写出来源和使用边界标签。', success_criteria: '标签同时包含来源、允许用途和待核项。', evidence_ids: ['kiln-fact'] },
    ],
    knowledge_steps: [
      { step_id: 'step-source', order: 1, title: '核对来源', instruction: '定位知识条目、素材出处和允许使用范围。', demonstration_action: '手指从表述连到来源栏，并把缺来源内容移入待核区。', objective_ids: ['objective-label'], evidence_ids: ['kiln-fact'], safety_notes: ['不上传未授权器物图片。'] },
      { step_id: 'step-classify', order: 2, title: '分类表述', instruction: '区分事实、教学解释和未知项。', demonstration_action: '把三类卡片分别移入蓝、黄、灰框。', objective_ids: ['objective-classify'], evidence_ids: ['kiln-fact'], safety_notes: ['颜色框仅为教学标记，不代表器物属性。'] },
      { step_id: 'step-boundary', order: 3, title: '写边界标签', instruction: '写明来源、用途和仍需核验的内容。', demonstration_action: '在器物卡下逐栏填写来源、允许用途和待核参数。', objective_ids: ['objective-label', 'objective-classify'], evidence_ids: ['kiln-fact'], safety_notes: ['具体参数和制度口径必须由授权人员复核。'] },
    ],
    case_study: {
      title: '长沙窑釉下彩知识卡',
      scenario: '学习者需要把长沙窑釉下彩信息转为解释视频，但具体器物参数尚未核验。',
      evidence_ids: ['kiln-fact'],
      debrief: '保留已核工艺信息，把具体年代、材料和温度放入待核项，并标注教学图示边界。',
    },
    practice_tasks: [
      { task_id: 'practice-classify', instruction: '为四条新表述选择事实、解释图示或未知项。', objective_ids: ['objective-classify'], expected_output: '完成四行分类表。', hints: ['先问是否有来源，再判断是否只是教学表示。'] },
      { task_id: 'practice-label', instruction: '为其中两条表述补来源、允许用途和待核项。', objective_ids: ['objective-label'], expected_output: '完成两张证据边界标签。', hints: ['未知项不得省略。'] },
    ],
    assessments: [
      { assessment_id: 'assessment-classify', objective_ids: ['objective-classify'], prompt: '对四条表述完成分类。', rubric: ['分类正确', '未知项保留'], pass_condition: '至少三条正确且没有把未知项写成事实。' },
      { assessment_id: 'assessment-label', objective_ids: ['objective-label'], prompt: '完成两张来源与边界标签。', rubric: ['来源存在', '允许用途明确', '待核项明确'], pass_condition: '两张标签均包含三个字段。' },
    ],
    feedback_rules: ['分类错误时退回“分类表述”步骤并对照来源重新判断。', '缺来源或待核项时退回“核对来源”步骤，补齐后再提交。'],
    recap_checklist: ['是否找到来源？', '是否区分事实、解释和未知？', '是否写明允许用途和待核边界？'],
    institutional_accuracy_notes: ['培训示例不替代项目的事实、版权和机构口径复核。', '涉及危险工艺、受保护文物或现场操作时，只能由授权专业人员示范。'],
    scene_turns: {
      '1': '从听懂主题到明确可观察目标',
      '2': '从表述内容到来源核对',
      '3': '从混合信息到证据分层',
      '4': '从分步知识到完整示范',
      '5': '从观看示范到独立练习和评估',
      '6': '从错误结果到反馈重试和复盘',
    },
  };
}

function input(): any {
  return {
    story: story(),
    target_audience: '初级文化内容编辑',
    platform: '内部教育培训视频',
    target_duration: '8分钟',
    communication_goal: '训练编辑正确区分文化事实、解释图示和未知项。',
    production_goal: '形成目标、示范、练习、评估和反馈可一一追踪的培训文本。',
    audience_promise: '学习者能够完成证据分类和边界标签并通过评分。',
    research: {
      source_summary: '知识库提供长沙窑与釉下彩事实信息。',
      evidence_items: [
        { evidence_id: 'kiln-fact', status: 'verified_fact', claim: '长沙窑以釉下彩等工艺形成彩色纹样。', source: '长沙窑铜官陶瓷烧制技艺——海上丝绸之路的釉下彩开创', allowed_usage: '培训案例事实。', verification_note: '具体器物参数仍需专业复核。' },
        { evidence_id: 'training-plan', status: 'plausible_dramatization', claim: '讲师、卡片、分类框、练习和评分表为教学组织。', source: '培训设计', allowed_usage: '示范和练习。', verification_note: '不冒充真实制度或考核结果。' },
      ],
      unknowns: ['具体器物年代、材料、烧成温度和项目制度口径待核。'],
      authorization_notes: ['培训素材、器物图片和机构标识需独立授权。'],
    },
    training_evidence: trainingEvidence(),
  };
}

const gates = (professionalPackage: ReturnType<typeof buildEducationTrainingProfessionalTextPackage>) =>
  professionalPackage.quality_report.hard_gate_failures.map(failure => failure.split(':', 1)[0]);

describe('education training professional pipeline', () => {
  it('builds a schema-valid training loop without professional promotion', () => {
    const professionalPackage = buildEducationTrainingProfessionalTextPackage(input());
    expect(ProfessionalTextPackageSchema.safeParse(professionalPackage).success).toBe(true);
    expect(professionalPackage.status).toBe('in_review');
    expect(professionalPackage.quality_report.hard_gate_failures).toEqual([]);
    expect(professionalPackage.quality_report.professional_passed).toBe(false);
  });

  it('detects objective, assessment and demonstration failure fixtures', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/professional-benchmarks/education-training-stage4-iteration4-benchmark-specs.json'), 'utf8'));
    for (const fixture of registry.failure_fixtures) {
      const candidate = input();
      if (fixture.fixture_id.includes('vague')) {
        candidate.training_evidence.learning_objectives.forEach((objective: any) => {
          objective.observable_action = '';
          objective.success_criteria = '';
        });
      }
      if (fixture.fixture_id.includes('without-assessment')) {
        candidate.training_evidence.assessments = [];
      }
      if (fixture.fixture_id.includes('promo-without')) {
        candidate.training_evidence.knowledge_steps.forEach((step: any) => {
          step.demonstration_action = '';
          step.safety_notes = [];
        });
        candidate.training_evidence.feedback_rules = [];
        candidate.training_evidence.institutional_accuracy_notes = [];
      }
      const professionalPackage = buildEducationTrainingProfessionalTextPackage(candidate);
      const revisionPlan = buildEducationTrainingRevisionPlan(professionalPackage);
      expect(gates(professionalPackage)).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
      expect(revisionPlan.actions.map(action => action.issue_id)).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
    }
  });

  it('rebuilds training steps from evidence', () => {
    const professionalPackage = buildEducationTrainingProfessionalTextPackage(input());
    professionalPackage.sequence_beats = [];
    expect(rebuildEducationTrainingDerivedText({ package: professionalPackage, training_evidence: trainingEvidence() }).rebuilt_sections)
      .toEqual(['sequence_beats']);
  });

  it('registers five pending projects and excludes fixtures from professional pass', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/professional-benchmarks/education-training-stage4-iteration4-benchmark-specs.json'), 'utf8'));
    expect(registry.summary).toMatchObject({ fixed_project_spec_count: 5, failure_fixture_count: 3, fixed_real_model_project_count: 0, human_blind_review_pass_count: 0 });
    expect(registry.projects.every((project: any) => project.professional_passed === false)).toBe(true);
  });
});
