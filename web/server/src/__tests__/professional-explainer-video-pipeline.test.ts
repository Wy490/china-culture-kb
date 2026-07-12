import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProfessionalTextPackageSchema } from '@shared/schemas.js';
import type { StoryGenerateResult } from '@shared/types.js';
import { buildExplainerVideoProfessionalTextPackage } from '../services/professional-explainer-video-pipeline-service.js';
import {
  buildExplainerVideoRevisionPlan,
  rebuildExplainerVideoDerivedText,
} from '../services/professional-explainer-video-revision-service.js';
import type { ExplainerVideoEvidence } from '../services/professional-explainer-video-quality-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

function story(): StoryGenerateResult {
  const scenes = [
    ['提出问题', '残片与透明层图示', '一块长沙窑彩色残片进入画面，主持人把“颜色在哪里”写在透明板上。'],
    ['概念一', '彩绘层与釉层剖面', '两张透明片上下叠合，标出彩绘与釉层的位置关系。'],
    ['概念二', '工序时间线桌面', '手部依次移动“画纹—施釉—烧成”三张动作卡。'],
    ['例子与误区', '残片照片与滤镜界面并排', '主持人把真实工艺信息和“后期滤镜”误区分到两侧。'],
    ['总结迁移', '三点总结卡与新器物', '三个要点依次亮起，最后换成另一件器物让观众判断。'],
  ].map((item, index) => ({
    scene_id: index + 1,
    title: item[0],
    duration_sec: 36,
    location: item[1],
    time_of_day: '白天',
    dramatic_function: ['认知缺口', '定义概念', '解释过程', '纠正误区', '总结迁移'][index],
    plot: item[2],
    key_action: item[2],
    characters: ['知识讲解者'],
    visual_prompt: `${item[1]}，图示必须展示对应关系和因果。`,
    camera_suggestion: '主持人与可暂停图示交替。',
    cultural_note: '事实、解释和视觉比喻分层。',
    conflict: '装饰画面不能替代机制解释。',
    dialogue_or_narration: [
      '长沙窑残片的颜色为什么不是简单画在最外面？先把“颜色在哪里”这个问题问清楚。',
      '第一个概念是层位：彩绘与覆盖它的釉层处在不同位置。透明片只是帮助看关系，并不等同于真实材料。',
      '第二个概念是顺序：先形成纹样，再施釉并烧成。动作卡解释先后，不代表所有具体配方和温度。',
      '例子告诉我们，残片颜色来自工艺结果，不是现代滤镜；但具体年代、材料和烧成参数仍要由器物证据核验。',
      '记住三点：颜色有层位，制作有顺序，图示有边界。换一件器物，你能先判断该查哪一层证据吗？',
    ][index],
    source_entries: ['长沙窑铜官陶瓷烧制技艺——海上丝绸之路的釉下彩开创'],
    factual_basis: '长沙窑釉下彩与相关工艺信息来自知识库。',
    fictionalized_elements: ['主持人、透明片和动作卡为解释组织。'],
  }));
  return {
    storyId: 'explainer-fixture',
    title: '长沙窑的颜色为什么在釉下',
    generation_type: 'scene_short',
    video_type: 'explainer_video',
    presentation_style: 'host_narration',
    source_entry: '长沙窑铜官陶瓷烧制技艺——海上丝绸之路的釉下彩开创',
    logline: '通过层位、顺序和证据边界解释长沙窑釉下彩。',
    theme: '好的知识解释让观众看见机制，也知道图示不能替代事实。',
    full_text: scenes.map(scene => `${scene.title}。${scene.plot}${scene.dialogue_or_narration}`).join('\n\n'),
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: '',
    cultural_constraints: ['不虚构配方、温度、器物年代或工艺唯一性。'],
    credibility_note: '事实、解释图示和未知参数分层。',
    truth_mode: 'factual_reconstruction',
    story_structure: 'lecture_argument',
  };
}

function explainerEvidence(): ExplainerVideoEvidence {
  return {
    core_question: '长沙窑釉下彩的颜色为什么不是简单画在器物最外面？',
    audience_prior_knowledge: '观众知道陶瓷经过烧制，但未必理解彩绘层、釉层和工序顺序。',
    concept_units: [
      { concept_id: 'layer', order: 1, concept: '层位关系', definition: '彩绘层与覆盖它的釉层位置不同。', one_core_concept: true, evidence_ids: ['kiln-fact'] },
      { concept_id: 'sequence', order: 2, concept: '工序顺序', definition: '纹样形成、施釉和烧成存在可解释的先后关系。', one_core_concept: true, evidence_ids: ['kiln-fact'] },
      { concept_id: 'boundary', order: 3, concept: '证据边界', definition: '图示解释关系，但具体器物参数仍需实物和专业证据。', one_core_concept: true, evidence_ids: ['kiln-fact'] },
    ],
    examples: [
      { example_id: 'example-layer', mapped_concept_id: 'layer', description: '用两张透明片分别表示彩绘层和釉层。', what_it_proves: '上下叠合可以显示位置关系。', evidence_ids: ['kiln-fact'] },
      { example_id: 'example-sequence', mapped_concept_id: 'sequence', description: '把画纹、施釉和烧成动作卡按顺序排列。', what_it_proves: '工艺理解需要先后而不是名词堆砌。', evidence_ids: ['kiln-fact'] },
      { example_id: 'example-boundary', mapped_concept_id: 'boundary', description: '把残片照片与现代滤镜界面并排。', what_it_proves: '工艺结果不能用现代后期概念替代。', evidence_ids: ['kiln-fact'] },
    ],
    visual_explanations: [
      { visual_id: 'visual-layer', mapped_concept_id: 'layer', visual_mechanism: '透明片上下叠合显示层位。', causal_mapping: '下层代表彩绘位置，上层代表覆盖关系。', limitation_or_non_equivalence: '透明片不是陶瓷材料，也不代表真实厚度。' },
      { visual_id: 'visual-sequence', mapped_concept_id: 'sequence', visual_mechanism: '动作卡沿时间线依次移动。', causal_mapping: '卡片位置表示解释所需的先后关系。', limitation_or_non_equivalence: '动作卡不表示完整配方、温度或全部工序。' },
      { visual_id: 'visual-boundary', mapped_concept_id: 'boundary', visual_mechanism: '实物照片、图示和未知项使用三种边框。', causal_mapping: '边框区分事实证据、解释模型和待核内容。', limitation_or_non_equivalence: '边框是信息分类，不是器物属性。' },
    ],
    misconceptions: [{
      misconception: '彩色效果就是现代滤镜或简单表面上色。',
      correction: '应先核对釉下彩的层位、工序和器物证据，不能用现代后期概念替代。',
      evidence_ids: ['kiln-fact'],
    }],
    summary_points: ['颜色需要看层位关系。', '工艺需要看先后顺序。', '图示需要标出与真实对象的边界。'],
    transfer_check_question: '面对另一件彩陶，你会先寻找层位、工序还是器物来源中的哪类证据？',
    scene_turns: {
      '1': '从看到颜色到提出层位问题',
      '2': '从表面印象到上下层关系',
      '3': '从名词记忆到工序先后',
      '4': '从滤镜误区到器物证据',
      '5': '从复述答案到迁移判断',
    },
  };
}

function input(): any {
  return {
    story: story(),
    target_audience: '对传统工艺感兴趣但没有陶瓷专业背景的观众',
    platform: '知识讲解视频',
    target_duration: '3分钟',
    communication_goal: '让观众理解釉下彩的层位、工序和证据边界。',
    production_goal: '形成概念、例子和图示逐一映射的可拍解释文本。',
    audience_promise: '观众能复述三个要点，并把判断方法迁移到另一件器物。',
    research: {
      source_summary: '知识库提供长沙窑与釉下彩工艺信息。',
      evidence_items: [
        { evidence_id: 'kiln-fact', status: 'verified_fact', claim: '长沙窑以釉下彩等工艺形成彩色纹样。', source: '长沙窑铜官陶瓷烧制技艺——海上丝绸之路的釉下彩开创', allowed_usage: '概念和工艺背景。', verification_note: '具体器物参数由专业资料复核。' },
        { evidence_id: 'explain-plan', status: 'plausible_dramatization', claim: '主持人、透明片、动作卡和边框为解释设计。', source: '解释视频创作', allowed_usage: '视觉解释。', verification_note: '不得冒充真实材料或工序。' },
      ],
      unknowns: ['具体器物的年代、颜料成分、烧成温度和完整工序待专业核验。'],
      authorization_notes: ['器物图片和专业图示需独立授权。'],
    },
    explainer_evidence: explainerEvidence(),
  };
}

const gates = (professionalPackage: ReturnType<typeof buildExplainerVideoProfessionalTextPackage>) =>
  professionalPackage.quality_report.hard_gate_failures.map(failure => failure.split(':', 1)[0]);

describe('explainer video professional pipeline', () => {
  it('builds a schema-valid explanatory candidate without professional promotion', () => {
    const professionalPackage = buildExplainerVideoProfessionalTextPackage(input());
    expect(ProfessionalTextPackageSchema.safeParse(professionalPackage).success).toBe(true);
    expect(professionalPackage.status).toBe('in_review');
    expect(professionalPackage.quality_report.hard_gate_failures).toEqual([]);
    expect(professionalPackage.quality_report.professional_passed).toBe(false);
  });

  it('detects concept, visual and learning-closure failure fixtures', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/professional-benchmarks/explainer-video-stage4-iteration2-benchmark-specs.json'), 'utf8'));
    for (const fixture of registry.failure_fixtures) {
      const candidate = input();
      if (fixture.fixture_id.includes('concept-pile')) {
        candidate.explainer_evidence.core_question = '';
        candidate.explainer_evidence.concept_units[0].one_core_concept = false;
      }
      if (fixture.fixture_id.includes('decorative')) {
        candidate.explainer_evidence.visual_explanations.forEach((visual: any) => {
          visual.causal_mapping = '';
          visual.limitation_or_non_equivalence = '';
        });
      }
      if (fixture.fixture_id.includes('no-misconception')) {
        candidate.explainer_evidence.misconceptions = [];
        candidate.explainer_evidence.summary_points = [];
        candidate.explainer_evidence.transfer_check_question = '';
      }
      const professionalPackage = buildExplainerVideoProfessionalTextPackage(candidate);
      const revisionPlan = buildExplainerVideoRevisionPlan(professionalPackage);
      expect(gates(professionalPackage)).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
      expect(revisionPlan.actions.map(action => action.issue_id)).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
    }
  });

  it('rebuilds concept beats from explainer evidence', () => {
    const professionalPackage = buildExplainerVideoProfessionalTextPackage(input());
    professionalPackage.sequence_beats = [];
    expect(rebuildExplainerVideoDerivedText({ package: professionalPackage, explainer_evidence: explainerEvidence() }).rebuilt_sections)
      .toEqual(['sequence_beats']);
  });

  it('registers five pending projects and excludes fixtures from professional pass', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/professional-benchmarks/explainer-video-stage4-iteration2-benchmark-specs.json'), 'utf8'));
    expect(registry.summary).toMatchObject({ fixed_project_spec_count: 5, failure_fixture_count: 3, fixed_real_model_project_count: 0, human_blind_review_pass_count: 0 });
    expect(registry.projects.every((project: any) => project.professional_passed === false)).toBe(true);
  });
});
