import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProfessionalTextPackageSchema } from '@shared/schemas.js';
import type { StoryGenerateResult } from '@shared/types.js';
import { buildLectureVideoProfessionalTextPackage } from '../services/professional-lecture-video-pipeline-service.js';
import {
  buildLectureVideoRevisionPlan,
  rebuildLectureVideoDerivedText,
} from '../services/professional-lecture-video-revision-service.js';
import type { LectureVideoEvidence } from '../services/professional-lecture-video-quality-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

function story(): StoryGenerateResult {
  const scenes = [
    ['现实问题', '讲台与岳阳楼现实影像', '讲述者把“先忧后乐是不是一句装饰口号”写在屏幕中央。'],
    ['论点一', '岳阳楼与文本来源卡', '讲述者把现实楼体、文本来源和历史语境分成三栏。'],
    ['论点二', '公共责任案例桌', '三张案例卡依次翻开，显示选择、承担和后果。'],
    ['反方回应', '双栏反方卡片', '左侧出现“古代名句离今天太远”，右侧逐项回应可验证范围。'],
    ['行动结论', '现实行动清单', '讲述者划掉空泛口号，留下查证、讨论和承担三个可执行动作。'],
  ].map((item, index) => ({
    scene_id: index + 1,
    title: item[0],
    duration_sec: 60,
    location: item[1],
    time_of_day: '白天',
    dramatic_function: ['受众张力', '立论举证', '案例论证', '反方回应', '行动收束'][index],
    plot: item[2],
    key_action: item[2],
    characters: ['宣讲者'],
    visual_prompt: `${item[1]}，论点、证据与反方关系可见。`,
    camera_suggestion: '中景讲述与来源卡、案例卡特写交替。',
    cultural_note: '事实、价值判断和机构口径分层。',
    conflict: '口号不能替代论证。',
    dialogue_or_narration: [
      '“先忧后乐”如果只被贴在墙上，它确实可能成为装饰。今天的问题是：公共责任怎样从一句话变成可以检验的行动？',
      '第一，价值判断必须承认自己的历史来源和适用边界。岳阳楼与相关文本提供文化语境，却不能替今天的每个现实问题直接给答案。',
      '第二，责任要落到选择和后果。案例不是用来制造感动，而是让我们看见：谁面对什么压力，采取什么行动，又承担了什么。',
      '有人会说，古代名句离今天太远。这个质疑是合理的。回应不是强迫认同，而是把它转化为今天可讨论、可查证、可承担的公共问题。',
      '因此，行动不是重复口号。面对公共议题，先核对事实，再听取合理反方，最后说明自己愿意承担的具体一步；超出确认口径的部分保持克制。',
    ][index],
    source_entries: ['岳阳楼——先忧后乐的精神地标'],
    factual_basis: '岳阳楼、相关文本与精神地标背景来自知识库。',
    fictionalized_elements: ['讲台、卡片和行动清单为宣讲组织。'],
  }));
  return {
    storyId: 'lecture-fixture',
    title: '让先忧后乐离开墙面',
    generation_type: 'scene_short',
    video_type: 'lecture_video',
    presentation_style: 'host_narration',
    source_entry: '岳阳楼——先忧后乐的精神地标',
    logline: '用来源、案例和合理反方论证公共责任如何从名句转为现实行动。',
    theme: '价值宣讲只有经过事实、反方和行动边界，才不会沦为空泛口号。',
    full_text: scenes.map(scene => `${scene.title}。${scene.plot}${scene.dialogue_or_narration}`).join('\n\n'),
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: '',
    cultural_constraints: ['不把历史名句直接等同于当代政策、机构立场或个人义务。'],
    credibility_note: '历史事实、论证组织、价值判断和机构口径分层。',
    truth_mode: 'institutional_verified',
    story_structure: 'lecture_argument',
  };
}

function lectureEvidence(): LectureVideoEvidence {
  return {
    thesis: '公共责任不能停在“先忧后乐”的口号复述上，而要经过事实核对、合理讨论和具体承担。',
    audience_tension: '观众熟悉名句，却可能不知道如何避免把传统精神简化为与现实脱节的装饰。',
    arguments: [
      { argument_id: 'argument-1', order: 1, claim: '价值表达先要承认历史来源和适用边界。', reasoning: '只有区分文本语境、事实来源和当代判断，传统表达才不会被无限套用。', evidence_ids: ['tower-fact'], case_ids: ['case-source'] },
      { argument_id: 'argument-2', order: 2, claim: '公共责任必须通过选择、行动和后果被看见。', reasoning: '抽象价值需要事实案例显示谁在压力中作出什么选择并承担什么结果。', evidence_ids: ['tower-fact'], case_ids: ['case-action'] },
      { argument_id: 'argument-3', order: 3, claim: '现实行动需要经过合理反方和可执行边界。', reasoning: '回应质疑能检验论点，行动边界则避免把价值号召写成无法验证的口号。', evidence_ids: ['tower-fact'], case_ids: ['case-discussion'] },
    ],
    cases: [
      { case_id: 'case-source', title: '岳阳楼与相关文本的文化来源', factual_summary: '现实楼体和知识库材料提供地点、文本关联与精神地标背景。', what_it_supports: '支持价值表达必须说明来源和边界。', evidence_ids: ['tower-fact'] },
      { case_id: 'case-action', title: '从名句到选择—行动—后果框架', factual_summary: '把价值判断转为可观察的选择、行动和后果，是本片的论证方法。', what_it_supports: '支持公共责任需要可见行动。', evidence_ids: ['lecture-plan'] },
      { case_id: 'case-discussion', title: '合理反方进入公开讨论', factual_summary: '完整宣讲文本显式呈现“古代名句离今天太远”的质疑并限定回应。', what_it_supports: '支持现实行动必须经受合理反方检验。', evidence_ids: ['lecture-plan'] },
    ],
    counterarguments: [{
      counterargument_id: 'counter-1',
      position: '古代名句的语境与今天不同，直接用来要求现实行动可能过度简化。',
      why_reasonable: '历史语境确实不同，价值表达不能替代当代事实和制度讨论。',
      response: '因此不直接套用结论，而把它转为查证事实、听取反方和说明具体承担的讨论框架。',
      evidence_ids: ['tower-fact'],
    }],
    rhetorical_transitions: ['从熟悉名句转向它的来源边界。', '从价值来源转向可观察的行动案例。', '从案例感动转向反方检验和现实承担。'],
    action_conclusion: {
      audience_action: '面对一个公共议题，完成一次事实核对、一次合理反方复述和一个可承担的小行动。',
      feasibility_boundary: '不替机构发布新口径，不把个人行动夸大为普遍成果。',
      institutional_wording_status: 'confirmed',
    },
    value_boundary_notes: ['“先忧后乐”作为文化表达，不直接等同于具体政策或机构要求。', '现实行动必须依据当下事实、制度和个人能力，不能由历史案例替代。'],
    scene_turns: {
      '1': '从熟悉名句到现实问题',
      '2': '从价值判断到来源边界',
      '3': '从抽象精神到选择、行动和后果',
      '4': '从单向说服到合理反方检验',
      '5': '从口号复述到可执行的小行动',
    },
  };
}

function input(): any {
  return {
    story: story(),
    target_audience: '参与文化主题学习和公共讨论的青年观众',
    platform: '文化主题宣讲视频',
    target_duration: '5分钟',
    communication_goal: '用事实、案例和反方把先忧后乐转为可讨论的公共责任。',
    production_goal: '形成论点、证据、反方和行动结论均可追踪的宣讲文本。',
    audience_promise: '观众能复述核心立论，并完成一个受边界约束的现实行动。',
    research: {
      source_summary: '知识库提供岳阳楼、相关文本与精神地标背景。',
      evidence_items: [
        { evidence_id: 'tower-fact', status: 'verified_fact', claim: '岳阳楼是现实历史文化空间，并与《岳阳楼记》及先忧后乐表达相关。', source: '岳阳楼——先忧后乐的精神地标', allowed_usage: '历史文化来源和案例背景。', verification_note: '具体沿革、文本解释和机构口径需独立复核。' },
        { evidence_id: 'lecture-plan', status: 'plausible_dramatization', claim: '讲述者、卡片、反方栏和行动清单为宣讲组织。', source: '宣讲视频创作', allowed_usage: '论证与视觉结构。', verification_note: '不冒充真实会议或机构活动。' },
      ],
      unknowns: ['具体机构使用口径、受众反馈和现实行动成效待项目核验。'],
      authorization_notes: ['历史图片、楼体素材和机构标识需独立授权。'],
    },
    lecture_evidence: lectureEvidence(),
  };
}

const gates = (professionalPackage: ReturnType<typeof buildLectureVideoProfessionalTextPackage>) =>
  professionalPackage.quality_report.hard_gate_failures.map(failure => failure.split(':', 1)[0]);

describe('lecture video professional pipeline', () => {
  it('builds a schema-valid argument candidate without professional promotion', () => {
    const professionalPackage = buildLectureVideoProfessionalTextPackage(input());
    expect(ProfessionalTextPackageSchema.safeParse(professionalPackage).success).toBe(true);
    expect(professionalPackage.status).toBe('in_review');
    expect(professionalPackage.quality_report.hard_gate_failures).toEqual([]);
    expect(professionalPackage.quality_report.professional_passed).toBe(false);
  });

  it('detects slogan, missing-counterargument and unconfirmed-action fixtures', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/professional-benchmarks/lecture-video-stage4-iteration3-benchmark-specs.json'), 'utf8'));
    for (const fixture of registry.failure_fixtures) {
      const candidate = input();
      if (fixture.fixture_id.includes('slogan')) {
        candidate.lecture_evidence.arguments.forEach((argument: any) => {
          argument.reasoning = '';
          argument.evidence_ids = [];
          argument.case_ids = [];
        });
      }
      if (fixture.fixture_id.includes('no-reasonable')) {
        candidate.lecture_evidence.counterarguments = [];
      }
      if (fixture.fixture_id.includes('unconfirmed')) {
        candidate.lecture_evidence.rhetorical_transitions = [];
        candidate.lecture_evidence.action_conclusion.audience_action = '';
        candidate.lecture_evidence.action_conclusion.feasibility_boundary = '';
        candidate.lecture_evidence.action_conclusion.institutional_wording_status = 'pending';
      }
      const professionalPackage = buildLectureVideoProfessionalTextPackage(candidate);
      const revisionPlan = buildLectureVideoRevisionPlan(professionalPackage);
      expect(gates(professionalPackage)).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
      expect(revisionPlan.actions.map(action => action.issue_id)).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
    }
  });

  it('rebuilds argument beats from lecture evidence', () => {
    const professionalPackage = buildLectureVideoProfessionalTextPackage(input());
    professionalPackage.sequence_beats = [];
    expect(rebuildLectureVideoDerivedText({ package: professionalPackage, lecture_evidence: lectureEvidence() }).rebuilt_sections)
      .toEqual(['sequence_beats']);
  });

  it('registers five pending projects and excludes fixtures from professional pass', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/professional-benchmarks/lecture-video-stage4-iteration3-benchmark-specs.json'), 'utf8'));
    expect(registry.summary).toMatchObject({ fixed_project_spec_count: 5, failure_fixture_count: 3, fixed_real_model_project_count: 0, human_blind_review_pass_count: 0 });
    expect(registry.projects.every((project: any) => project.professional_passed === false)).toBe(true);
  });
});
