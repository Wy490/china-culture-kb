import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProfessionalTextPackageSchema } from '@shared/schemas.js';
import type { StoryGenerateResult } from '@shared/types.js';
import { buildLandscapeMoodProfessionalTextPackage } from '../services/professional-landscape-mood-pipeline-service.js';
import { buildLandscapeMoodRevisionPlan, rebuildLandscapeMoodDerivedText } from '../services/professional-landscape-mood-revision-service.js';
import type { LandscapeMoodEvidence } from '../services/professional-landscape-mood-quality-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

function story(): StoryGenerateResult {
  const phases = [
    ['晨雾醒峰', '武陵源石英砂岩峰林观景范围', '清晨', '薄雾沿峰壁上升，近峰先露出轮廓，远峰仍被雾层遮住。'],
    ['日光显岩', '武陵源峰林与峡谷可见范围', '正午', '日光越过峰脊，岩壁纹理和峡谷纵深逐层显现。'],
    ['溪谷收声', '武陵源林地溪谷可拍范围', '黄昏', '林梢被风压低，溪流反光由亮转暗，鸟声逐渐退远。'],
    ['暮色归静', '武陵源远峰公共观景范围', '入夜', '远峰只留下剪影，虫鸣进入空下来的画面，最后停在自然声中。'],
  ];
  const scenes = phases.map((phase, index) => ({
    scene_id: index + 1,
    title: phase[0],
    duration_sec: 45,
    location: phase[1],
    time_of_day: phase[2],
    dramatic_function: ['从遮蔽中苏醒', '尺度与纹理显形', '声光逐步收拢', '停驻并留下余味'][index],
    plot: phase[3],
    key_action: phase[3],
    characters: [],
    visual_prompt: `${phase[1]}，${phase[3]}`,
    camera_suggestion: '固定构图与缓慢移动结合，让自然变化发生在镜头内部。',
    cultural_note: '真实地点与计划光线、天气和时间组织分层。',
    conflict: '画面必须通过自然状态变化推进，不能退化为风景明信片。',
    dialogue_or_narration: index === 0 ? '山先从雾里醒来。' : index === 3 ? '暮色把远峰还给寂静。' : '',
    source_entries: ['张家界武陵源——3.8亿年雕琢的世界自然遗产'],
    factual_basis: '武陵源的峰林地貌身份来自知识库；具体机位、天气与可见状态待现场核验。',
    fictionalized_elements: ['一天内的晨雾、正午、黄昏和入夜次序为视觉组织。'],
  }));
  return {
    storyId: 'landscape-mood-fixture',
    title: '雾把群峰交给暮色',
    generation_type: 'scene_short',
    video_type: 'landscape_mood',
    presentation_style: 'cinematic',
    source_entry: '张家界武陵源——3.8亿年雕琢的世界自然遗产',
    logline: '雾、日光、溪声和暮色沿一天流变，让武陵源峰林在无解释旁白时仍完成情绪运动。',
    theme: '时间不是说明，而是发生在山体、光线和自然声里的可见变化。',
    full_text: scenes.map(scene => `${scene.title}。${scene.plot}${scene.dialogue_or_narration}`).join('\n\n'),
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: '',
    cultural_constraints: ['不虚构具体天气、季节、机位可达性或异地替代素材。'],
    credibility_note: '地貌事实、拍摄计划和视听组织分层。',
    truth_mode: 'inspired_by_material',
    story_structure: 'object_clue_journey',
  };
}

function landscapeEvidence(): LandscapeMoodEvidence {
  const timeStates = ['清晨薄雾', '正午日光', '黄昏溪谷', '入夜远峰'];
  return {
    emotional_premise: '雾从遮蔽到散开再回到暮色，山体用一天证明时间可以被看见。',
    visual_phases: timeStates.map((timeState, index) => ({
      phase_id: `landscape-${index + 1}`,
      order: index + 1,
      time_state: timeState,
      space_anchor: ['石英砂岩峰林观景范围', '峰林与峡谷可见范围', '林地溪谷可拍范围', '远峰公共观景范围'][index],
      composition: ['近峰占画面下方，远峰在雾中逐层出现', '侧光越过峰脊，让岩壁纹理和峡谷纵深进入同一构图', '溪面反光在前景收暗，林梢和远峰形成两层运动', '远峰剪影留在画面下三分之一，上方暮色保留大面积空白'][index],
      natural_motion: ['薄雾沿峰壁上升并短暂露出峰脊', '云影缓慢越过岩壁，日光在峡谷中移动', '风压低林梢，溪流反光由亮转暗', '最后一层云移出远峰，虫鸣中的草叶轻动'][index],
      light_or_weather: ['晨雾中的低反差冷光', '正午侧光与移动云影', '黄昏暖光退入溪谷阴影', '暮蓝天光与远峰剪影'][index],
      natural_sound: ['近处滴水、低风和远鸟', '峰谷风声与偶发林鸟', '溪流、林梢摩擦与退远鸟声', '虫鸣、弱风和逐渐空下来的环境声'][index],
      narration: index === 0 ? '山先从雾里醒来。' : index === 3 ? '暮色把远峰还给寂静。' : '',
      shot_duration_sec: [10, 9, 11, 12][index],
      evidence_ids: ['wulingyuan-fact'],
      transition_to_next: index < 3 ? ['雾中滴水延续到正午峰谷风声', '移动云影接到溪面反光', '退远鸟声进入入夜虫鸣'][index] : '',
    })),
    without_narration_readable: true,
    natural_sound_arc: ['滴水和低风建立苏醒', '峰谷风声打开尺度', '溪流与林梢收拢空间', '虫鸣和弱风进入留白'],
    minimal_text_lines: ['山先从雾里醒来。', '暮色把远峰还给寂静。'],
    ending_silence_sec: 5,
    human_trace_notes: ['观景范围只保留远处步道声，不让游客承担解释功能。'],
    geographic_boundary_notes: ['具体机位、拍摄许可、季节、天气和峰体可见状态必须现场核验。', '不得用异地峰林、合成天气或库存自然声冒充武陵源同期实拍。'],
    scene_turns: { '1': '雾从遮蔽到露峰', '2': '光线把尺度与纹理打开', '3': '溪谷声光由满转空', '4': '峰体退为剪影并停在自然声中' },
  };
}

function input(): any {
  return {
    story: story(),
    target_audience: '偏爱自然影像和沉浸声音的移动端观众',
    platform: '横竖屏自然影像短片',
    target_duration: '3分钟',
    communication_goal: '用自然状态流变呈现武陵源的空间尺度与时间感。',
    production_goal: '形成可按时间、构图、自然运动、现场声和留白执行的视听文本。',
    audience_promise: '即使关闭旁白，观众也能从雾、光、溪声和暮色读出完整情绪变化。',
    research: {
      source_summary: '知识库提供武陵源地貌和文化背景；拍摄条件需现场核验。',
      evidence_items: [
        { evidence_id: 'wulingyuan-fact', status: 'verified_fact', claim: '武陵源是具有代表性峰林景观的现实地理空间。', source: '张家界武陵源——3.8亿年雕琢的世界自然遗产', allowed_usage: '地点身份和景观类型。', verification_note: '具体地质表述按正式来源复核。' },
        { evidence_id: 'landscape-plan', status: 'plausible_dramatization', claim: '晨雾至入夜的连续视听次序为创作与拍摄计划。', source: '山水意境片创作', allowed_usage: '时间、光线、声音和剪辑组织。', verification_note: '不得声称为已发生的同期记录。' },
      ],
      unknowns: ['具体机位可达性、拍摄许可、季节天气、光线和现场声条件待核。'],
      authorization_notes: ['保护区拍摄、航拍、人员肖像和声音采集需独立授权。'],
    },
    landscape_evidence: landscapeEvidence(),
  };
}

const gates = (professionalPackage: ReturnType<typeof buildLandscapeMoodProfessionalTextPackage>) =>
  professionalPackage.quality_report.hard_gate_failures.map(failure => failure.split(':', 1)[0]);

describe('landscape mood professional pipeline', () => {
  it('builds a schema-valid sound-led visual arc without professional promotion', () => {
    const professionalPackage = buildLandscapeMoodProfessionalTextPackage(input());
    expect(ProfessionalTextPackageSchema.safeParse(professionalPackage).success).toBe(true);
    expect(professionalPackage.status).toBe('in_review');
    expect(professionalPackage.quality_report.hard_gate_failures).toEqual([]);
    expect(professionalPackage.quality_report.professional_passed).toBe(false);
  });

  it('detects narration, static-postcard and music-only failure fixtures', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/professional-benchmarks/landscape-mood-stage5-iteration2-benchmark-specs.json'), 'utf8'));
    for (const fixture of registry.failure_fixtures) {
      const candidate = input();
      if (fixture.fixture_id.includes('dense-lecture')) {
        candidate.landscape_evidence.without_narration_readable = false;
        candidate.landscape_evidence.minimal_text_lines = ['第一段需要详细解释这片山水的全部历史文化和地质知识。', '第二段继续说明每一个景点的名称和宣传价值。', '第三段告诉观众应当获得怎样的情绪。'];
        candidate.landscape_evidence.visual_phases.forEach((phase: any) => { phase.narration = '这里需要持续不断地用旁白解释画面中所有已经看得见的内容。'; });
      }
      if (fixture.fixture_id.includes('static-postcard')) {
        candidate.landscape_evidence.visual_phases.forEach((phase: any) => {
          phase.time_state = '同一时刻';
          phase.light_or_weather = '';
          phase.natural_motion = '';
        });
      }
      if (fixture.fixture_id.includes('music-replaces')) {
        candidate.landscape_evidence.visual_phases.forEach((phase: any) => { phase.natural_sound = ''; });
        candidate.landscape_evidence.natural_sound_arc = [];
        candidate.landscape_evidence.ending_silence_sec = 0;
      }
      const professionalPackage = buildLandscapeMoodProfessionalTextPackage(candidate);
      const revisionPlan = buildLandscapeMoodRevisionPlan(professionalPackage);
      expect(gates(professionalPackage)).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
      expect(revisionPlan.actions.map(action => action.issue_id)).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
    }
  });

  it('rebuilds visual beats from landscape evidence', () => {
    const professionalPackage = buildLandscapeMoodProfessionalTextPackage(input());
    professionalPackage.sequence_beats = [];
    expect(rebuildLandscapeMoodDerivedText({ package: professionalPackage, landscape_evidence: landscapeEvidence() }).rebuilt_sections)
      .toEqual(['sequence_beats']);
  });

  it('registers five pending real-location projects and excludes fixtures', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/professional-benchmarks/landscape-mood-stage5-iteration2-benchmark-specs.json'), 'utf8'));
    expect(registry.summary).toMatchObject({ fixed_project_spec_count: 5, failure_fixture_count: 3, fixed_real_model_project_count: 0, human_blind_review_pass_count: 0 });
    expect(registry.projects.every((project: any) => project.professional_passed === false)).toBe(true);
  });
});
