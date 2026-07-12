import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProfessionalTextPackageSchema } from '@shared/schemas.js';
import type { StoryGenerateResult } from '@shared/types.js';
import { buildSceneShortProfessionalTextPackage } from '../services/professional-scene-short-pipeline-service.js';
import { buildSceneShortRevisionPlan, rebuildSceneShortDerivedText } from '../services/professional-scene-short-revision-service.js';
import type { SceneShortEvidence } from '../services/professional-scene-short-quality-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

function story(): StoryGenerateResult {
  const scenes = [
    ['城门入口', '岳阳楼景区现实入口', '观察者推开入口处的木门，脚步声从街面进入较安静的院落。'],
    ['楼内转角', '岳阳楼内部楼梯与转角', '观察者沿扶手上行，在转角停下对照建筑说明中的时间层。'],
    ['临湖窗口', '岳阳楼临湖窗口', '风声穿过窗口，观察者把今天的湖面与文本中的空间想象并置。'],
    ['湖岸回望', '洞庭湖岸公共空间', '观察者走出楼体，在傍晚人群与水声中回望刚才的路线。'],
  ].map((item, index) => ({
    scene_id: index + 1,
    title: item[0],
    duration_sec: 45,
    location: item[1],
    time_of_day: ['清晨', '上午', '午后', '傍晚'][index],
    dramatic_function: ['进入空间', '时间显影', '空间发现', '氛围收束'][index],
    plot: item[2],
    key_action: item[2],
    characters: ['当代观察者'],
    visual_prompt: `${item[1]}，路线移动、空间转角和时间痕迹可见。`,
    camera_suggestion: '跟随脚步移动，在触发点停留。',
    cultural_note: '空间事实与时间叠印分层。',
    conflict: '空间必须发生发现，不能只作景点背景。',
    dialogue_or_narration: [
      '先从门槛进入。街面的声音被门板截断，空间第一次改变了观看节奏。',
      '楼梯不是人物生平的插图；扶手、转角和说明牌让今天的身体遇见不同时间留下的痕迹。',
      '到了窗口，先听风和水。文本只提示观看方向，不替现实湖面说完全部意义。',
      '路线停在湖岸。回望楼体时，刚才的门声、脚步和风声叠在一起，空间完成了自己的叙事。',
    ][index],
    source_entries: ['岳阳楼——先忧后乐的精神地标'],
    factual_basis: '岳阳楼与洞庭湖的空间关联来自知识库，具体开放路线待现场核验。',
    fictionalized_elements: ['观察者和一日路线为场景组织。'],
  }));
  return {
    storyId: 'scene-short-fixture',
    title: '从门声走到湖风',
    generation_type: 'scene_short',
    video_type: 'scene_short',
    presentation_style: 'cinematic',
    source_entry: '岳阳楼——先忧后乐的精神地标',
    logline: '一名观察者沿入口、楼梯、窗口和湖岸，让岳阳楼的空间与时间层逐点显影。',
    theme: '空间通过路线、声音和发现成为叙事主角。',
    full_text: scenes.map(scene => `${scene.title}。${scene.plot}${scene.dialogue_or_narration}`).join('\n\n'),
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: '',
    cultural_constraints: ['不虚构开放路线、修缮年代、建筑功能或历史人物活动。'],
    credibility_note: '空间事实、时间叠印和人物路线分层。',
    truth_mode: 'inspired_by_material',
    story_structure: 'object_clue_journey',
  };
}

function sceneEvidence(): SceneShortEvidence {
  const spaces = ['现实入口', '楼梯转角', '临湖窗口', '洞庭湖岸'];
  return {
    spatial_identity: '岳阳楼是一条由门槛、垂直移动、临湖观看和湖岸回望组成的时间路线。',
    route_purpose: '让观众通过身体移动和声音变化理解空间如何承载不同时间层。',
    space_is_protagonist: true,
    route_nodes: spaces.map((space, index) => ({
      node_id: `space-${index + 1}`,
      order: index + 1,
      space,
      entry_action: ['推开木门并跨过门槛', '手扶楼梯向上并在转角停下', '靠近窗口让湖面进入画框', '走到湖岸并回望楼体'][index],
      trigger: ['门声改变环境声场', '扶手纹理触发对时间痕迹的观察', '风穿窗口触发空间与文本对照', '傍晚人群经过触发当代回返'][index],
      discovery_or_change: ['从街面公开空间进入较安静院落', '从水平观看转为垂直移动并发现修缮痕迹', '从建筑内部转向湖面尺度', '从历史观看回到今天仍在使用的公共空间'][index],
      time_layer: ['今天清晨的现实入口', '建筑修缮与使用留下的多重时间', '文本记忆与今天湖面的并置', '今天傍晚的现实人群'][index],
      sound_cue: ['街声被门板截断并留下门轴声', '脚步、木扶手轻响和室内回声', '窗口风声与远处水声', '湖岸水声、人群脚步与远处城市声'][index],
      shot_action: ['镜头跟脚步跨过门槛后回看门框', '镜头沿扶手向上并在纹理处停顿', '镜头从窗口框内缓慢推向湖面', '镜头跟出楼体后转身回望完整路线'][index],
      evidence_ids: ['tower-space'],
      transition_to_next: index < 3 ? ['门轴余响接入楼梯脚步', '扶手纹理切到窗口木框', '风声延续到湖岸水声'][index] : '',
    })),
    person_or_event_trigger: '当代观察者只负责进入、触摸、停留和回望，空间变化负责推动发现。',
    ending_atmosphere: '傍晚湖岸保留水声、人群脚步和楼体远景，不用口号替空间收束。',
    geographic_boundary_notes: ['楼体、入口、内部路线和湖岸拍摄范围及开放状态需现场核验。', '不得用异地古楼、湖面或修缮素材替代岳阳楼真实空间。'],
    scene_turns: {
      '1': '从街面到门内声场',
      '2': '从平面观看到垂直时间痕迹',
      '3': '从楼内尺度到湖面尺度',
      '4': '从历史观看到今天公共空间',
    },
  };
}

function input(): any {
  return {
    story: story(),
    target_audience: '对历史空间和视听路线感兴趣的观众',
    platform: '空间场景短片',
    target_duration: '3分钟',
    communication_goal: '用路线、声音和时间层呈现岳阳楼空间。',
    production_goal: '形成每个节点有动作、发现、声音和转场的可拍文本。',
    audience_promise: '观众将在一条连续路线中感到空间如何改变观看。',
    research: {
      source_summary: '知识库提供岳阳楼与洞庭湖的历史文化空间背景。',
      evidence_items: [
        { evidence_id: 'tower-space', status: 'verified_fact', claim: '岳阳楼是与洞庭湖相关的现实历史文化空间。', source: '岳阳楼——先忧后乐的精神地标', allowed_usage: '空间身份和文化背景。', verification_note: '具体内部路线和开放状态待现场核验。' },
        { evidence_id: 'route-plan', status: 'plausible_dramatization', claim: '观察者、清晨至傍晚的路线和声音转场为场景组织。', source: '场景短片创作', allowed_usage: '路线和时间层。', verification_note: '不冒充真实游览记录。' },
      ],
      unknowns: ['内部拍摄许可、开放路线、修缮细节和现场声条件待核。'],
      authorization_notes: ['场地、游客肖像和现场声音采集需独立授权。'],
    },
    scene_evidence: sceneEvidence(),
  };
}

const gates = (professionalPackage: ReturnType<typeof buildSceneShortProfessionalTextPackage>) =>
  professionalPackage.quality_report.hard_gate_failures.map(failure => failure.split(':', 1)[0]);

describe('scene short professional pipeline', () => {
  it('builds a schema-valid spatial route without professional promotion', () => {
    const professionalPackage = buildSceneShortProfessionalTextPackage(input());
    expect(ProfessionalTextPackageSchema.safeParse(professionalPackage).success).toBe(true);
    expect(professionalPackage.status).toBe('in_review');
    expect(professionalPackage.quality_report.hard_gate_failures).toEqual([]);
    expect(professionalPackage.quality_report.professional_passed).toBe(false);
  });

  it('detects sight-list, biography and broken-route fixtures', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/professional-benchmarks/scene-short-stage5-iteration1-benchmark-specs.json'), 'utf8'));
    for (const fixture of registry.failure_fixtures) {
      const candidate = input();
      if (fixture.fixture_id.includes('sight-list')) {
        candidate.scene_evidence.route_nodes.forEach((node: any) => {
          node.trigger = '';
          node.discovery_or_change = '';
        });
      }
      if (fixture.fixture_id.includes('biography')) {
        candidate.scene_evidence.spatial_identity = '';
        candidate.scene_evidence.space_is_protagonist = false;
      }
      if (fixture.fixture_id.includes('no-time')) {
        candidate.scene_evidence.route_nodes.forEach((node: any) => {
          node.time_layer = '同一时间';
          node.sound_cue = '';
          node.transition_to_next = '';
        });
      }
      const professionalPackage = buildSceneShortProfessionalTextPackage(candidate);
      const revisionPlan = buildSceneShortRevisionPlan(professionalPackage);
      expect(gates(professionalPackage)).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
      expect(revisionPlan.actions.map(action => action.issue_id)).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
    }
  });

  it('rebuilds route beats from scene evidence', () => {
    const professionalPackage = buildSceneShortProfessionalTextPackage(input());
    professionalPackage.sequence_beats = [];
    expect(rebuildSceneShortDerivedText({ package: professionalPackage, scene_evidence: sceneEvidence() }).rebuilt_sections)
      .toEqual(['sequence_beats']);
  });

  it('registers five pending real-location projects and excludes fixtures', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/professional-benchmarks/scene-short-stage5-iteration1-benchmark-specs.json'), 'utf8'));
    expect(registry.summary).toMatchObject({ fixed_project_spec_count: 5, failure_fixture_count: 3, fixed_real_model_project_count: 0, human_blind_review_pass_count: 0 });
    expect(registry.projects.every((project: any) => project.professional_passed === false)).toBe(true);
  });
});
