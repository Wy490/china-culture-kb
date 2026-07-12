import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProfessionalTextPackageSchema } from '@shared/schemas.js';
import type { StoryGenerateResult } from '@shared/types.js';
import { buildDocumentaryShortProfessionalTextPackage } from '../services/professional-documentary-short-pipeline-service.js';
import {
  buildDocumentaryShortRevisionPlan,
  rebuildDocumentaryShortDerivedText,
} from '../services/professional-documentary-short-revision-service.js';
import type { DocumentaryShortEvidence } from '../services/professional-documentary-short-quality-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

function story(): StoryGenerateResult {
  const scenes = [
    ['现实入口', '岳阳楼外墙与洞庭湖岸', '观察者沿外墙寻找今天仍可见的修缮痕迹。'],
    ['问题形成', '岳阳楼展陈空间', '观察者把建筑说明与《岳阳楼记》相关史料并排阅读。'],
    ['史料线索', '档案复制件查阅台', '讲解员戴手套翻到来源页，镜头拍下出处标签。'],
    ['采访核验', '已授权采访区', '讲解员只回答建筑、文本传播和展陈范围内的问题。'],
    ['回到当下', '洞庭湖岸公共空间', '观察者回望楼体，把“今天为何仍在阅读”留给现实现场。'],
  ].map((item, index) => ({
    scene_id: index + 1,
    title: item[0],
    duration_sec: 36,
    location: item[1],
    time_of_day: '白天',
    dramatic_function: ['现实提问', '形成调查', '证据发现', '采访核验', '现实回返'][index],
    plot: item[2],
    key_action: item[2],
    characters: ['当代观察者', ...(index === 3 ? ['已授权讲解员'] : [])],
    visual_prompt: `${item[1]}，纪实实景、物件与查阅动作。`,
    camera_suggestion: '稳定观察式镜头，保留环境声。',
    cultural_note: '采访、史料和再现边界需显式。',
    conflict: '旁白不能替证据下结论。',
    dialogue_or_narration: [
      '今天站在楼外，我们先不急着复述名句，只问：什么证据让一座楼与一篇文章持续相连？',
      '展陈中的建筑说明给出地点和修缮线索，文本来源则提示我们把建筑史与文学传播分开追问。',
      '镜头停在来源标签和查阅动作上；没有来源的说法，不由旁白补成确定事实。',
      '已确认的讲解员只谈授权范围内的建筑、展陈与文本传播，不替历史人物发言。',
      '回到湖岸，楼仍在现实空间里被观看和阅读；当代意义来自这些可见痕迹，而不是一句空泛口号。',
    ][index],
    source_entries: ['岳阳楼——先忧后乐的精神地标'],
    factual_basis: '岳阳楼地点、文本关联与现实遗存来自知识库和现场核验计划。',
    fictionalized_elements: ['观察者的调查顺序为纪录文本组织。'],
  }));
  return {
    storyId: 'documentary-fixture',
    title: '今天为什么还在读岳阳楼',
    generation_type: 'scene_short',
    video_type: 'documentary_short',
    presentation_style: 'documentary',
    source_entry: '岳阳楼——先忧后乐的精神地标',
    logline: '一名当代观察者从现实楼体、展陈史料和授权采访追问岳阳楼如何持续进入公共记忆。',
    theme: '纪录片的意义必须由现实痕迹和可追溯证据推动。',
    full_text: scenes.map(scene => `${scene.title}。${scene.plot}${scene.dialogue_or_narration}`).join('\n\n'),
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: '',
    cultural_constraints: ['不虚构采访、原始影像、历史对白或现场开放状态。'],
    credibility_note: '现实现场、核验史料、纪录组织和未知项分层。',
    truth_mode: 'factual_reconstruction',
    story_structure: 'witness_testimony',
  };
}

function documentaryEvidence(): DocumentaryShortEvidence {
  return {
    core_question: '今天可见的哪些证据，让岳阳楼建筑与《岳阳楼记》的公共记忆持续相连？',
    present_day_observer: '在现实现场查阅展陈并提出问题的当代观察者',
    real_sites: [{
      site_id: 'tower-site',
      place: '岳阳楼现实楼体、展陈空间与洞庭湖岸',
      present_evidence: '楼体、展陈来源标签与公共空间今天仍可核验。',
      shootable_action: '观察者沿楼体观察、在展陈前查阅并记录来源。',
      evidence_ids: ['tower-fact'],
    }],
    interview_roles: [{
      role_id: 'authorized-guide',
      role_description: '已确认拍摄和话题范围的岳阳楼文保讲解员',
      confirmed: true,
      consent_status: 'confirmed',
      allowed_topics: ['建筑现实状态', '展陈来源', '文本传播边界'],
      evidence_ids: ['tower-fact'],
    }],
    source_clues: [
      { clue_id: 'tower-clue', source_label: '岳阳楼知识库条目与现场建筑说明', claim: '岳阳楼是现实可核验的历史文化空间。', visual_handling: '拍楼体、说明牌和来源标签，不拍无法授权的复制品细节。', evidence_ids: ['tower-fact'] },
      { clue_id: 'text-clue', source_label: '《岳阳楼记》相关展陈来源提示', claim: '文本传播与建筑公共记忆相互关联，但不等同于单一建筑史证据。', visual_handling: '拍查阅动作和出处标签，引用范围另行核权。', evidence_ids: ['tower-fact'] },
    ],
    discovery_chain: [
      { order: 1, question_or_discovery: '现实楼体今天留下了什么可见痕迹？', evidence_ids: ['tower-fact'], leads_to: '进入展陈寻找建筑与文本的来源说明。' },
      { order: 2, question_or_discovery: '展陈如何区分建筑史和文本传播？', evidence_ids: ['tower-fact'], leads_to: '查阅来源标签和可授权史料线索。' },
      { order: 3, question_or_discovery: '哪些说法能够由来源直接支持？', evidence_ids: ['tower-fact'], leads_to: '由已授权讲解员核验可谈范围。' },
      { order: 4, question_or_discovery: '今天的观看和阅读如何构成公共记忆？', evidence_ids: ['tower-fact'], leads_to: '回到洞庭湖岸和现实人群，不由旁白替观众下结论。' },
    ],
    b_roll_plan: [
      { shot_id: 'broll-1', visible_action: '观察者沿现实楼体观察修缮痕迹。', evidence_ids: ['tower-fact'] },
      { shot_id: 'broll-2', visible_action: '手指沿展陈来源标签逐行移动。', evidence_ids: ['tower-fact'] },
      { shot_id: 'broll-3', visible_action: '讲解员在授权范围内翻阅说明材料。', evidence_ids: ['tower-fact'] },
      { shot_id: 'broll-4', visible_action: '现实游客在湖岸回望楼体。', evidence_ids: ['tower-fact'] },
    ],
    reenactment_boundaries: ['若使用历史再现，必须持续标注“情境再现”，不得冒充原始影像。', '不得生成历史人物对白、受访者原话或不存在的现场证据。'],
    restrained_narration_rules: ['旁白只连接已经出现的现场、采访和史料，不替缺失证据补事实。', '先让镜头和来源推动发现，再提出克制解释，不使用全知断言。'],
    scene_turns: {
      '1': '从名句印象到现实痕迹',
      '2': '从建筑观看到来源问题',
      '3': '从说明文字到证据出处',
      '4': '从旁白判断到授权采访核验',
      '5': '从历史回望到今天仍可见的公共记忆',
    },
  };
}

function input(): any {
  return {
    story: story(),
    target_audience: '对历史空间和公共记忆感兴趣的纪录短片观众',
    platform: '文化微纪录片',
    target_duration: '3分钟',
    communication_goal: '用现实现场和证据发现解释岳阳楼公共记忆。',
    production_goal: '形成可核验现场、采访和史料边界的导演文本。',
    audience_promise: '观众将看到问题如何被现实痕迹和来源逐步回答。',
    research: {
      source_summary: '知识库提供岳阳楼、文本关联与精神地标背景。',
      evidence_items: [
        { evidence_id: 'tower-fact', status: 'verified_fact', claim: '岳阳楼是现实可核验的历史文化空间，并与《岳阳楼记》的传播相关。', source: '岳阳楼——先忧后乐的精神地标', allowed_usage: '地点、文本关联和现实遗存。', verification_note: '建筑年代、修缮沿革和展陈口径由现场再核。' },
        { evidence_id: 'documentary-plan', status: 'plausible_dramatization', claim: '当代观察者的调查顺序为纪录文本组织。', source: '微纪录片创作', allowed_usage: '串联现场、史料和采访。', verification_note: '不冒充真实事件。' },
      ],
      unknowns: ['具体展陈开放状态、受访者姓名、可引用史料和拍摄授权待项目核验。'],
      authorization_notes: ['受访者、场地、史料复制件和游客肖像需独立授权。'],
    },
    documentary_evidence: documentaryEvidence(),
  };
}

const gates = (professionalPackage: ReturnType<typeof buildDocumentaryShortProfessionalTextPackage>) =>
  professionalPackage.quality_report.hard_gate_failures.map(failure => failure.split(':', 1)[0]);

describe('documentary short professional pipeline', () => {
  it('builds a schema-valid evidence-driven candidate without professional promotion', () => {
    const professionalPackage = buildDocumentaryShortProfessionalTextPackage(input());
    expect(ProfessionalTextPackageSchema.safeParse(professionalPackage).success).toBe(true);
    expect(professionalPackage.status).toBe('in_review');
    expect(professionalPackage.quality_report.hard_gate_failures).toEqual([]);
    expect(professionalPackage.quality_report.professional_passed).toBe(false);
  });

  it('detects documentary failure fixtures and routes evidence work to humans', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/professional-benchmarks/documentary-short-stage4-iteration1-benchmark-specs.json'), 'utf8'));
    for (const fixture of registry.failure_fixtures) {
      const candidate = input();
      if (fixture.fixture_id.includes('invented-interview')) {
        candidate.documentary_evidence.interview_roles[0].confirmed = false;
        candidate.documentary_evidence.interview_roles[0].consent_status = 'pending';
        candidate.research.unknowns = [];
      }
      if (fixture.fixture_id.includes('no-site')) {
        candidate.documentary_evidence.real_sites = [];
        candidate.documentary_evidence.source_clues = [];
        candidate.documentary_evidence.b_roll_plan = [];
      }
      if (fixture.fixture_id.includes('narration-replaces')) {
        candidate.documentary_evidence.discovery_chain = candidate.documentary_evidence.discovery_chain.slice(0, 1);
        candidate.documentary_evidence.reenactment_boundaries = [];
        candidate.documentary_evidence.restrained_narration_rules = [];
      }
      const professionalPackage = buildDocumentaryShortProfessionalTextPackage(candidate);
      const revisionPlan = buildDocumentaryShortRevisionPlan(professionalPackage);
      expect(gates(professionalPackage)).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
      expect(revisionPlan.actions.map(action => action.issue_id)).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
    }
  });

  it('rebuilds evidence discovery beats from documentary evidence', () => {
    const professionalPackage = buildDocumentaryShortProfessionalTextPackage(input());
    professionalPackage.sequence_beats = [];
    expect(rebuildDocumentaryShortDerivedText({ package: professionalPackage, documentary_evidence: documentaryEvidence() }).rebuilt_sections)
      .toEqual(['sequence_beats']);
  });

  it('registers five pending real projects and excludes fixtures from professional pass', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/professional-benchmarks/documentary-short-stage4-iteration1-benchmark-specs.json'), 'utf8'));
    expect(registry.summary).toMatchObject({ fixed_project_spec_count: 5, failure_fixture_count: 3, fixed_real_model_project_count: 0, human_blind_review_pass_count: 0 });
    expect(registry.projects.every((project: any) => project.professional_passed === false)).toBe(true);
  });
});
