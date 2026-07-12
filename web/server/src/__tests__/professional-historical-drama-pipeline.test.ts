import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProfessionalTextPackageSchema } from '@shared/schemas.js';
import type { StoryGenerateResult } from '@shared/types.js';
import { buildHistoricalDramaProfessionalTextPackage } from '../services/professional-historical-drama-pipeline-service.js';
import {
  buildHistoricalDramaRevisionPlan,
  rebuildHistoricalDramaDerivedText,
} from '../services/professional-historical-drama-revision-service.js';
import type { HistoricalDramaProfessionalEvidence } from '../services/professional-historical-drama-quality-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

function historicalStory(): StoryGenerateResult {
  const scenes = [
    ['名单暴露', '武昌俄租界附近', '爆炸使起义名单面临暴露，联络者必须立刻转移消息。', '联络者烧掉可识别名单并奔向新军营房。', '原定计划已经无法照常执行。'],
    ['营门封锁', '新军营房', '搜捕命令传到营门，士兵在服从军令与自救行动之间分裂。', '熊秉坤命人关闭营门并召集可靠士兵。', '等待会被逐个搜捕，提前行动则失去统一指挥。'],
    ['命令断裂', '营房器械间', '联络迟迟未到，现场参与者只能依据有限信息决定是否行动。', '熊秉坤摊开军械库路线并分派任务。', '没有完整命令链，任何选择都可能导致失败。'],
    ['提前举事', '工程营营区', '搜捕逼近，参与者决定提前发动并夺取武器。', '熊秉坤带队冲出营门，向楚望台方向推进。', '行动一旦开始就无法退回秘密筹备状态。'],
    ['争夺军械库', '楚望台军械库', '起义力量取得武器后必须把局部行动转为对关键节点的控制。', '队伍分组守住入口、发放弹药并联络其他营。', '夺得武器不等于赢得武昌，失序会迅速耗尽优势。'],
    ['红楼之后', '湖北军政府旧址', '局部军事行动推动更大政治变化，但第一枪等细节仍存在不同记述。', '角色在公开文告前停下，不把个人记忆写成唯一史实。', '行动产生历史后果，也留下必须被诚实说明的证据边界。'],
  ].map(([title, location, plot, keyAction, conflict], index) => ({
    scene_id: index + 1,
    title,
    duration_sec: 45,
    location,
    time_of_day: index < 5 ? '夜晚' : '次日',
    dramatic_function: ['危机钩子', '制度压力', '立场分化', '不可撤回行动', '行动高潮', '历史后果'][index],
    plot,
    key_action: keyAction,
    characters: index === 0 ? ['革命党联络者'] : ['熊秉坤', '新军士兵'],
    visual_prompt: `${location}，以名单、营门、地图和武器构成历史现场压力。`,
    camera_suggestion: '手持中近景跟随行动，关键证据物件使用克制特写。',
    cultural_note: '1911年武昌空间、军服、称谓和武器需按来源复核。',
    conflict,
    dialogue_or_narration: index === 3
      ? '士兵：没有命令，我们往哪走？\n熊秉坤：搜捕就是他们给的时辰。先取军械库，活路才在前面。'
      : `${title}中，人物用行动和短句推进现场选择。`,
    source_entries: ['武昌起义——辛亥革命的第一声枪响'],
    factual_basis: '1911年10月10日武昌起义及楚望台军械库等知识库事实锚点。',
    fictionalized_elements: ['具体联络者、站位、行动衔接和对白为影视化补足。'],
  }));

  return {
    storyId: 'historical-drama-professional-fixture',
    title: '计划之外的枪声',
    generation_type: 'scene_short',
    video_type: 'historical_drama',
    presentation_style: 'cinematic',
    source_entry: '武昌起义——辛亥革命的第一声枪响',
    logline: '计划暴露、命令链断裂的夜晚，新军参与者必须决定等待搜捕还是提前行动，并承担行动失控的风险。',
    theme: '历史转折既来自时代压力，也来自人在有限信息下承担后果的行动。',
    full_text: scenes.map(scene => `${scene.title}。${scene.plot}${scene.dialogue_or_narration}`).join('\n\n'),
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: '',
    cultural_constraints: ['不得把影视化对白、站位和第一枪单一说法写成确定史实。'],
    credibility_note: '日期、地点与关键行动按知识库锚定；普通参与者和现场对白为合理戏剧化。',
    truth_mode: 'factual_reconstruction',
    story_structure: 'single_event_drama',
    characters: [
      { name: '熊秉坤', role: '行动者', description: '在计划暴露后参与并推动提前行动' },
      { name: '新军士兵', role: '群体角色', description: '承受搜捕与行动风险的参与者' },
    ],
  };
}

function historicalEvidence(): HistoricalDramaProfessionalEvidence {
  return {
    central_event: '1911年10月10日晚武昌起义提前发动并争夺楚望台军械库',
    protagonist: '熊秉坤',
    era_pressure: '清末革命形势、计划暴露和即时搜捕把筹备者推入必须当夜决断的危机。',
    institutional_pressure: '新军军纪、营门封锁、指挥链断裂和军械控制限制了参与者的行动。',
    role_positions: {
      '熊秉坤': '认为等待搜捕必败，主张立刻行动并先夺军械库',
      '新军士兵': '担心无完整命令链的行动会失控，但也面临被捕风险',
      '清军指挥者': '依据军令封锁营区、搜捕革命力量并维持既有秩序',
    },
    decision_or_irreversible_action: '在搜捕逼近时提前发动，带队冲出营门并争夺楚望台军械库。',
    consequence: '局部行动扩展为武昌起义并推动多省响应，同时具体第一枪记述仍需保留争议边界。',
    factual_event_chain: [
      ['计划暴露引发搜捕', '联络者转移消息', '原定时间与指挥链失效'],
      ['营门封锁加剧被捕风险', '参与者在营内聚集', '等待与提前行动成为不可兼得的选择'],
      ['统一联络中断', '现场人员分派路线与目标', '局部指挥开始取代原定命令'],
      ['搜捕逼近且退路消失', '队伍提前发动', '秘密筹备转为公开军事行动'],
      ['行动需要持续武装', '起义力量争夺楚望台军械库', '局部行动获得扩展条件'],
      ['武昌关键节点发生变化', '行动结果转入政治组织与对外公告', '事件推动更大范围响应并进入历史记忆'],
    ].map(([cause, event, consequence], index) => ({
      event_id: `wuchang-event-${index + 1}`,
      order: index + 1,
      cause,
      event,
      consequence,
      evidence_ids: ['evidence-wuchang-fact'],
    })),
    dialogue_voice_rules: [
      '熊秉坤使用短促的行动句，信息不完整时不说全知式历史结论。',
      '新军士兵的问句体现军纪、恐惧与求生压力，不作为历史旁白工具。',
      '清军命令使用制度化措辞，不能被写成脸谱化辱骂。',
    ],
    subtext_strategy: '表面争论是否立刻行动，深层冲突是没有完整命令时谁愿意承担失败和同伴性命。',
    scene_turns: Object.fromEntries(Array.from({ length: 6 }, (_, index) => [
      String(index + 1),
      ['从计划保密转为名单暴露', '从等待命令转为营门封锁', '从统一指挥转为现场决断', '从秘密筹备转为公开行动', '从局部突围转为争夺关键资源', '从行动结果转为历史证据边界'][index],
    ])),
  };
}

function pipelineInput(): any {
  return {
    story: historicalStory(),
    target_audience: '18至35岁历史剧情短片观众',
    platform: '历史剧情短片',
    target_duration: '5分钟',
    communication_goal: '用行动因果与立场冲突呈现武昌起义的历史转折。',
    production_goal: '形成可进入分镜与导演复核的单事件历史剧本。',
    budget_assumptions: ['三个主要历史空间', '两类核心行动角色'],
    delivery_constraints: ['不执行真实视频生成', '逐场保留史实与戏剧化边界'],
    audience_promise: '观众将看到计划暴露后的一连串决定，如何把仓促自救推向历史行动。',
    truth_mode: 'factual_reconstruction',
    research: {
      source_summary: '知识库条目提供日期、地点、起义爆发与楚望台军械库等事实锚点。',
      evidence_items: [{
        evidence_id: 'evidence-wuchang-fact',
        status: 'verified_fact',
        claim: '武昌起义发生于1911年10月10日，并涉及楚望台军械库等关键地点。',
        source: '武昌起义——辛亥革命的第一声枪响',
        allowed_usage: '用于事件时间、地点和因果骨架。',
        verification_note: '第一枪归属等具体细节保留多说法。',
      }, {
        evidence_id: 'evidence-wuchang-dramatization',
        status: 'plausible_dramatization',
        claim: '普通参与者、现场路线分派、停顿和对白作为影视化连接。',
        source: '影视化处理',
        allowed_usage: '只能用于场面调度和角色行动连接。',
        verification_note: '不得声称为史料原话或唯一现场记录。',
      }],
      unknowns: ['第一枪归属与部分现场行动顺序存在不同记述。'],
      authorization_notes: ['只使用知识库事实摘要，不复制现代影视作品表达。'],
    },
    historical_evidence: historicalEvidence(),
    now: '2026-07-11T01:00:00.000Z',
  };
}

function hardGateIds(pkg: ReturnType<typeof buildHistoricalDramaProfessionalTextPackage>): string[] {
  return pkg.quality_report.hard_gate_failures.map(item => item.split(':', 1)[0]);
}

describe('historical_drama professional text pipeline', () => {
  it('builds a complete historical production candidate without claiming professional pass', () => {
    const pkg = buildHistoricalDramaProfessionalTextPackage(pipelineInput());
    const parsed = ProfessionalTextPackageSchema.safeParse(pkg);

    expect(parsed.success, parsed.success ? '' : parsed.error.message).toBe(true);
    expect(pkg.status).toBe('in_review');
    expect(pkg.scene_breakdown).toHaveLength(6);
    expect(pkg.sequence_beats).toHaveLength(6);
    expect(pkg.director_text_plan.sequences).toHaveLength(6);
    expect(pkg.delivery_text_package.scene_units).toHaveLength(6);
    expect(pkg.quality_report.hard_gate_failures).toEqual([]);
    expect(pkg.quality_report.total_score).toBeGreaterThanOrEqual(80);
    expect(pkg.quality_report.professional_passed).toBe(false);
    expect(pkg.quality_report.evaluator_notes.join('\n')).toContain('真人盲评');
  });

  it('detects all registered historical failure fixtures and routes targeted revisions', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(
      repoRoot,
      'data/professional-benchmarks/historical-drama-iteration4-benchmark-specs.json',
    ), 'utf8')) as Record<string, any>;

    for (const fixture of registry.failure_fixtures as Array<Record<string, any>>) {
      const input = pipelineInput();
      if (fixture.fixture_id.includes('background-summary')) {
        input.story.full_text = '历史背景：1911年革命形势发展，武昌起义发生，随后多省响应。';
        input.historical_evidence.factual_event_chain = [];
      }
      if (fixture.fixture_id.includes('no-era-position-consequence')) {
        input.historical_evidence.era_pressure = '';
        input.historical_evidence.institutional_pressure = '';
        input.historical_evidence.role_positions = { '熊秉坤': '参与者' };
        input.historical_evidence.decision_or_irreversible_action = '';
        input.historical_evidence.consequence = '';
      }
      if (fixture.fixture_id.includes('collapsed-truth-boundary')) {
        input.story.scene_breakdown.forEach((scene: any) => {
          scene.source_entries = [];
          scene.factual_basis = '';
          scene.fictionalized_elements = [];
        });
        input.research.evidence_items = [];
        input.research.unknowns = [];
        input.story.creation_contract = { required_disclaimers: [] };
        input.historical_evidence.dialogue_voice_rules = [];
        input.historical_evidence.subtext_strategy = '';
      }

      const pkg = buildHistoricalDramaProfessionalTextPackage(input);
      const detected = hardGateIds(pkg);
      const revisionPlan = buildHistoricalDramaRevisionPlan(pkg);

      expect(pkg.quality_report.professional_passed).toBe(false);
      expect(detected).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
      expect(revisionPlan.actions.map(action => action.issue_id))
        .toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
      expect(revisionPlan.professional_passed).toBe(false);
    }
  });

  it('rebuilds stale historical derived sections and retains the non-pass policy', () => {
    const pkg = buildHistoricalDramaProfessionalTextPackage(pipelineInput());
    pkg.sequence_beats = [];
    pkg.director_text_plan.sequences = [];
    pkg.delivery_text_package.scene_units = [];

    const result = rebuildHistoricalDramaDerivedText({
      package: pkg,
      historical_evidence: historicalEvidence(),
      now: '2026-07-11T01:10:00.000Z',
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

  it('registers five real-model benchmark specs without counting fixtures as professional work', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(
      repoRoot,
      'data/professional-benchmarks/historical-drama-iteration4-benchmark-specs.json',
    ), 'utf8')) as Record<string, any>;

    expect(registry.summary).toMatchObject({
      fixed_project_spec_count: 5,
      fixed_real_model_project_count: 0,
      fixed_real_model_project_pass_count: 0,
      failure_fixture_count: 3,
      human_blind_review_pass_count: 0,
    });
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
