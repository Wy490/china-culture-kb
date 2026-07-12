import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProfessionalTextPackageSchema } from '@shared/schemas.js';
import type { StoryGenerateResult } from '@shared/types.js';
import { buildLegendStoryProfessionalTextPackage } from '../services/professional-legend-story-pipeline-service.js';
import {
  buildLegendStoryRevisionPlan,
  rebuildLegendStoryDerivedText,
} from '../services/professional-legend-story-revision-service.js';
import type { LegendStoryProfessionalEvidence } from '../services/professional-legend-story-quality-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

function legendStory(): StoryGenerateResult {
  const scenes = [
    ['水边求信', '洞庭湖岸', '相传柳毅在湖边遇见牧羊女子，她把一封被水汽浸湿的书信托到他手中。', '柳毅接住书信，却没有立刻答应。', '陌生人的请求无法验证，入湖传信也可能有去无回。'],
    ['井前试心', '君山柳毅井旁', '井水映出龙宫般的光影，书信上的字迹第一次重新显现。', '柳毅把自己的返乡文书与陌生书信并排放下。', '继续赶路可保全自己，转身入井则承担未知危险。'],
    ['水府传书', '传说中的洞庭水府', '水声三次回环，守门者要求柳毅说明他为何替陌生人涉险。', '柳毅不求赏赐，只把信举过头顶。', '神异威压不能替他回答是否守信。'],
    ['怒潮之前', '水府大殿', '龙君欲以怒潮惩戒龙女夫家，柳毅看见书信边缘再次被水浸透。', '柳毅拦在令旗前，请求先救人、不要让无辜者承受怒潮。', '完成传书不是终点，他还要为传信引发的后果作出选择。'],
    ['井边余信', '君山湖岸清晨', '相传风浪平息后，书信留在井边，后来的人仍讲述一个凡人替陌生人守信的故事。', '柳毅把空信封压在井沿石下，转身走回人间。', '龙宫是否存在无人能证，守信的选择却成为故事流传的理由。'],
  ].map(([title, location, plot, keyAction, conflict], index) => ({
    scene_id: index + 1,
    title,
    duration_sec: 55,
    location,
    time_of_day: ['黄昏', '夜晚', '夜晚', '夜晚', '清晨'][index],
    dramatic_function: ['异象与请求', '凡人考验', '进入异境', '主动选择', '流传余味'][index],
    plot,
    key_action: keyAction,
    characters: index === 0 ? ['柳毅', '龙女'] : index < 4 ? ['柳毅', '洞庭龙君'] : ['柳毅', '讲述者'],
    visual_prompt: `${location}，书信、水纹与人物动作构成神异但克制的传说画面。`,
    camera_suggestion: '以书信特写连接空间，水纹声先于异境显现。',
    cultural_note: '唐传奇、洞庭地方口述和君山地理锚点必须分层表达。',
    conflict,
    dialogue_or_narration: index === 3
      ? '柳毅：信我已经送到，可若怒潮伤了无辜，这封信就只剩下一半。'
      : `老人常说，水响一遍是风，水响两遍是浪，水响第三遍，才轮到人回答自己的心。${title}中，柳毅用行动作答。`,
    source_entries: ['柳毅传书——洞庭湖畔的书生与龙女', '唐代李朝威《柳毅传》'],
    factual_basis: '《柳毅传》证明文学故事传统存在；洞庭地方版本与柳毅井属于流传和地理锚点，不证明神异事件真实发生。',
    fictionalized_elements: ['本片的具体动作、对白、水府调度和书信显字为影视化改编。'],
  }));

  return {
    storyId: 'legend-story-professional-fixture',
    title: '水响第三遍',
    generation_type: 'scene_short',
    video_type: 'legend_story',
    presentation_style: 'ink_style',
    source_entry: '柳毅传书——洞庭湖畔的书生与龙女',
    logline: '柳毅替陌生龙女传递一封无法验证的书信，并在神异力量将要伤及无辜时再次选择承担责任。',
    theme: '传说让神力打开异境，但真正被世代记住的是凡人在未知面前仍愿意守信。',
    full_text: scenes.map(scene => `${scene.title}。${scene.plot}${scene.dialogue_or_narration}`).join('\n\n'),
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: '',
    cultural_constraints: ['始终使用“相传”等边界，不把龙宫和入井写成史实。'],
    credibility_note: '文学文本、地方流传和现实地理锚点分层；对白与神异场面为影视化改编。',
    truth_mode: 'inspired_by_material',
    story_structure: 'object_clue_journey',
    characters: [
      { name: '柳毅', role: '凡人主角', description: '因守信进入异境并承担传书后果的书生' },
      { name: '龙女', role: '求助者', description: '文学与民间传说中的神异人物' },
      { name: '洞庭龙君', role: '神异力量', description: '把传书行动推向更大伦理考验' },
    ],
  };
}

function legendEvidence(): LegendStoryProfessionalEvidence {
  return {
    protagonist: '柳毅',
    human_goal: '把陌生女子托付的书信送到，并确认求助者获得救援。',
    human_trial: '在无法验证龙宫、可能耽误归途且神力可能失控时决定是否继续守信。',
    choice: '柳毅进入传说中的水府传书，并在怒潮将起时主动阻止无差别惩罚。',
    consequence: '求助得到回应，柳毅承担了传信带来的第二重责任，故事因此从奇遇转向守信伦理。',
    supernatural_element: '柳毅井、水府、水纹显字与洞庭龙君。',
    supernatural_function: '神异空间放大传书风险，并把柳毅的守信从一次善举推进为承担后果的选择。',
    symbolic_motif: '被水浸湿又重新显字的书信',
    motif_scene_ids: [1, 3, 5],
    version_boundaries: [{
      version_id: 'liuyi-literary-version',
      label: '唐代文学文本版本',
      source: '唐代李朝威《柳毅传》',
      version_kind: 'literary_text',
      core_elements: ['柳毅', '龙女求助', '传书', '洞庭水府'],
      boundary_note: '文学作品证明故事文本传统，不证明人物和神异事件真实发生。',
    }, {
      version_id: 'liuyi-dongting-oral-version',
      label: '洞庭湖地方口述版本',
      source: '柳毅传书——洞庭湖畔的书生与龙女',
      version_kind: 'folk_oral',
      core_elements: ['君山柳毅井', '洞庭地方化', '湘楚姻缘'],
      boundary_note: '地方版本和实物地名是流传锚点，不反向证明龙宫事件。',
    }],
    oral_rhythm_rules: [
      '用“水响一遍、两遍、第三遍”的三次递进形成口述回环。',
      '关键选择前重复“这封信还剩多少”并改变含义。',
      '讲述者只提示“相传”和版本边界，不使用现代知识讲座语气。',
    ],
    transmission_reason: '故事借一封无法验证的信追问陌生人的托付是否值得承担，因此能跨越神异外壳继续被讲述。',
    scene_turns: {
      '1': '从偶遇异象转为接到无法验证的托付',
      '2': '从赶路自保转为选择进入未知',
      '3': '从神异奇观转为守信理由的公开检验',
      '4': '从完成任务转为承担任务造成的后果',
      '5': '从龙宫传说转为凡人选择被世代记住',
    },
  };
}

function pipelineInput(): any {
  return {
    story: legendStory(),
    target_audience: '16至35岁中国民间故事与动画短片观众',
    platform: '水墨动画剧情短片',
    target_duration: '5分钟',
    communication_goal: '通过版本有界的柳毅传书故事呈现守信与承担后果。',
    production_goal: '形成可进入分镜和导演复核的口述传说完整剧本。',
    budget_assumptions: ['湖岸、井边、水府三个主要空间', '三名核心角色'],
    delivery_constraints: ['不执行真实视频生成', '神异内容不得作为史实陈述'],
    audience_promise: '观众将看到一封信如何把凡人带进异境，并让一次善举变成承担后果的选择。',
    truth_mode: 'inspired_by_material',
    research: {
      source_summary: '知识库记录唐传奇文本、洞庭地方口述、柳毅井地理锚点及其边界。',
      evidence_items: [{
        evidence_id: 'evidence-liuyi-tradition',
        status: 'verified_fact',
        claim: '唐代李朝威《柳毅传》及洞庭地方流传证明该故事具有文学与民间传播传统。',
        source: '唐代李朝威《柳毅传》；柳毅传书——洞庭湖畔的书生与龙女',
        allowed_usage: '用于版本来源、核心母题和流传边界。',
        verification_note: '只能证明文本和流传存在，不能证明神异事件。',
      }, {
        evidence_id: 'evidence-liuyi-dramatization',
        status: 'plausible_dramatization',
        claim: '以水纹显字、三次水声和阻止怒潮连接人物选择。',
        source: '影视化处理',
        allowed_usage: '用于视觉意象、节奏和人物行动。',
        verification_note: '不得声称来自原文逐字记载。',
      }],
      unknowns: ['洞庭地方口述各版本的形成时间、具体差异与柳毅井附会过程仍需核实。'],
      authorization_notes: ['只使用公版古代文本母题与知识库摘要，不复制现代影视或戏曲受保护表达。'],
    },
    legend_evidence: legendEvidence(),
    now: '2026-07-11T02:00:00.000Z',
  };
}

function hardGateIds(pkg: ReturnType<typeof buildLegendStoryProfessionalTextPackage>): string[] {
  return pkg.quality_report.hard_gate_failures.map(item => item.split(':', 1)[0]);
}

describe('legend_story professional text pipeline', () => {
  it('builds a complete legend candidate without claiming fact or professional pass', () => {
    const pkg = buildLegendStoryProfessionalTextPackage(pipelineInput());
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
    expect(pkg.truth_and_adaptation_contract.required_disclaimers.join('\n')).toContain('不作为确证史实');
  });

  it('detects all registered legend failure fixtures and routes targeted revisions', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(
      repoRoot,
      'data/professional-benchmarks/legend-story-iteration5-benchmark-specs.json',
    ), 'utf8')) as Record<string, any>;

    for (const fixture of registry.failure_fixtures as Array<Record<string, any>>) {
      const input = pipelineInput();
      if (fixture.fixture_id.includes('version-collapse')) {
        input.legend_evidence.version_boundaries = [];
        input.research.unknowns = [];
        input.story.creation_contract = { required_disclaimers: [] };
      }
      if (fixture.fixture_id.includes('spectacle')) {
        input.legend_evidence.supernatural_function = '';
        input.legend_evidence.human_goal = '';
        input.legend_evidence.human_trial = '';
        input.legend_evidence.choice = '';
        input.legend_evidence.consequence = '';
      }
      if (fixture.fixture_id.includes('no-motif')) {
        input.legend_evidence.symbolic_motif = '';
        input.legend_evidence.motif_scene_ids = [];
        input.legend_evidence.oral_rhythm_rules = [];
        input.legend_evidence.transmission_reason = '';
        input.legend_evidence.scene_turns = {};
        input.story.scene_breakdown.forEach((scene: any) => {
          scene.source_entries = [];
          scene.factual_basis = '';
          scene.fictionalized_elements = [];
        });
      }

      const pkg = buildLegendStoryProfessionalTextPackage(input);
      const detected = hardGateIds(pkg);
      const revisionPlan = buildLegendStoryRevisionPlan(pkg);

      expect(pkg.quality_report.professional_passed).toBe(false);
      expect(detected).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
      expect(revisionPlan.actions.map(action => action.issue_id))
        .toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
      expect(revisionPlan.professional_passed).toBe(false);
    }
  });

  it('rebuilds stale legend derived sections while retaining non-pass policy', () => {
    const pkg = buildLegendStoryProfessionalTextPackage(pipelineInput());
    pkg.sequence_beats = [];
    pkg.director_text_plan.sequences = [];
    pkg.delivery_text_package.scene_units = [];

    const result = rebuildLegendStoryDerivedText({
      package: pkg,
      legend_evidence: legendEvidence(),
      now: '2026-07-11T02:10:00.000Z',
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

  it('registers five real-model specs and excludes all legend fixtures from professional credit', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(
      repoRoot,
      'data/professional-benchmarks/legend-story-iteration5-benchmark-specs.json',
    ), 'utf8')) as Record<string, any>;

    expect(registry.summary).toMatchObject({
      fixed_project_spec_count: 5,
      fixed_real_model_project_count: 0,
      fixed_real_model_project_pass_count: 0,
      failure_fixture_count: 3,
      human_blind_review_pass_count: 0,
    });
    expect(registry.policy.legend_content_counts_as_verified_history).toBe(false);
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
