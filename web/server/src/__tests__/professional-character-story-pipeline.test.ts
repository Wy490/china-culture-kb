import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProfessionalTextPackageSchema } from '@shared/schemas.js';
import type { StoryGenerateResult } from '@shared/types.js';
import { buildCharacterStoryProfessionalTextPackage } from '../services/professional-text-pipeline-service.js';
import {
  buildCharacterStoryRevisionPlan,
  rebuildCharacterStoryDerivedText,
} from '../services/professional-text-revision-service.js';
import type { CharacterStoryProfessionalEvidence } from '../services/professional-text-quality-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

function characterStory(): StoryGenerateResult {
  const scenes = [
    ['案卷压桌', '南安军公堂', '周敦颐翻到证词矛盾处，按住即将落下的判笔。', '他停止签字并圈出疑点。', '王逵催促立即结案。'],
    ['上官催签', '签押房', '王逵把告身推到周敦颐面前，要求他照例画押。', '周敦颐把判词推回。', '服从可保仕途，坚持会得罪上官。'],
    ['两条路', '官署回廊', '同僚劝他先签后查，周敦颐看见狱卒押人经过。', '他追问证人和案发时刻。', '拖延意味着抗命，签字可能害死无辜。'],
    ['交还告身', '知军公厅', '周敦颐摘下官印，把告身放在王逵案前。', '他以辞官承担拒签的代价。', '两人的关系从上下级服从转为公开对峙。'],
    ['重审反转', '南安军公堂', '新证词与旧卷宗对照，关键矛盾暴露。', '周敦颐逐页指出证据缺口。', '王逵必须在权威和事实之间重新选择。'],
    ['空案留痕', '清晨官署', '改判文书送出，周敦颐重新拿起那支未曾落下的笔。', '他收回告身，但把疑点批注留在案卷。', '代价没有消失，关系却因事实发生改变。'],
  ].map(([title, location, plot, keyAction, conflict], index) => ({
    scene_id: index + 1,
    title,
    duration_sec: 40,
    location,
    time_of_day: index === 5 ? '清晨' : '白日',
    dramatic_function: ['钩子开场', '主角处境', '冲突升级', '关键行动', '高潮', '结尾'][index],
    plot,
    key_action: keyAction,
    characters: index === 5 ? ['周敦颐'] : ['周敦颐', '王逵'],
    visual_prompt: `${location}，案卷、官印与人物站位形成压力。`,
    camera_suggestion: '中近景推进，关键动作切手部特写。',
    cultural_note: '官署称谓、告身和断案程序需按宋代边界核验。',
    conflict,
    dialogue_or_narration: index === 3
      ? '王逵：你要拿仕途赌一个囚犯？\n周敦颐：人命面前，仕途不能替我落笔。'
      : `${title}中，人物用短句推进冲突。`,
    source_entries: ['周敦颐——理学开山鼻祖'],
    factual_basis: index === 3 ? '《宋史》所载拒签冤案与辞官选择。' : '依据主条目事件边界组织。',
    fictionalized_elements: ['具体站位、停顿和非史料对白为影视化补足。'],
  }));

  return {
    storyId: 'character-story-professional-fixture',
    title: '未落下的一笔',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '周敦颐——理学开山鼻祖',
    logline: '周敦颐面对一纸死刑判词，在服从上官与守住人命之间交还告身、拒绝落笔。',
    theme: '操守不是赞美，而是愿意承担选择的现实代价。',
    full_text: scenes.map(scene => `${scene.title}。${scene.plot}${scene.dialogue_or_narration}`).join('\n\n'),
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: '',
    cultural_constraints: ['不得把影视化对白写成史料原文。'],
    credibility_note: '拒签冤案与交还告身有史料线索；具体调度和对白为影视化补足。',
    truth_mode: 'factual_reconstruction',
    story_structure: 'single_event_drama',
    characters: [
      { name: '周敦颐', role: '主角', description: '坚持重审的司理参军' },
      { name: '王逵', role: '对立角色', description: '要求依既定判词结案的知军' },
    ],
    protagonist_arc: [{
      starting_state: '仍试图在官署规则内说服上官',
      turning_point: '交还告身，以辞官承担拒签代价',
      resolution: '以事实推动改判，也改变与王逵的关系',
    }],
  };
}

function characterEvidence(): CharacterStoryProfessionalEvidence {
  return {
    protagonist: '周敦颐',
    goal: '阻止证据不足的死刑判决并推动重审',
    resistance: '知军催签、官场服从规则与仕途风险',
    choice: '交还告身并拒绝签署死刑文书',
    cost: '可能辞官、获罪并公开得罪上官',
    starting_relationship_state: '周敦颐仍以属官身份试图说服王逵',
    ending_relationship_state: '王逵接受重审，双方关系转为由事实重新约束权力',
    internal_change: '从陈述异议转为用自身仕途承担原则',
    dialogue_voice_rules: [
      '周敦颐短句、克制，以事实和人命为落点。',
      '王逵句式强硬，以秩序、权威和后果施压。',
    ],
    subtext_strategy: '表面争论是否签字，真实冲突是权力能否替个人良知承担责任。',
    scene_turns: {
      '1': '从例行签押转为发现疑点',
      '2': '从私下异议转为上官施压',
      '3': '从查案争议转为仕途两难',
      '4': '从语言争辩转为交还告身的行动',
      '5': '从权威定论转为证据反转',
      '6': '从改判结果转为人格与关系余味',
    },
  };
}

function pipelineInput() {
  return {
    story: characterStory(),
    target_audience: '18至35岁传统文化短视频观众',
    platform: '剧情短片',
    target_duration: '5分钟' as const,
    communication_goal: '用单一选择呈现人物操守。',
    production_goal: '形成可进入分镜和导演复核的完整人物剧本。',
    budget_assumptions: ['两处官署主场景', '两名核心角色'],
    delivery_constraints: ['不执行真实视频生成', '史料原文与影视化对白分离'],
    audience_promise: '观众将看到一名官员如何以仕途为代价阻止一次可能的冤杀。',
    truth_mode: 'factual_reconstruction' as const,
    research: {
      source_summary: '主条目提供拒签冤案、交还告身和改判结果的史料边界。',
      evidence_items: [{
        evidence_id: 'evidence-song-history',
        status: 'verified_fact' as const,
        claim: '周敦颐拒绝签署不当死刑判决，并以辞官相争。',
        source: '周敦颐——理学开山鼻祖 / 《宋史》线索',
        allowed_usage: '可作为事件因果和人物选择锚点。',
        verification_note: '具体对白、站位和批注动作不是史料原文。',
      }, {
        evidence_id: 'evidence-dramatization',
        status: 'plausible_dramatization' as const,
        claim: '告身、官印和案卷作为选择动作的视觉载体。',
        source: '影视化处理',
        allowed_usage: '只用于场景调度。',
        verification_note: '不得声称为逐字史实。',
      }],
      unknowns: ['具体重审过程和现场措辞未知。'],
      authorization_notes: ['只使用知识库事实摘要，不复制受版权保护的现代作品。'],
    },
    character_evidence: characterEvidence(),
    relationships: [{
      from: '周敦颐',
      to: '王逵',
      starting_relationship: '属官对上官的克制异议',
      ending_relationship: '事实迫使权力接受重审',
    }],
    now: '2026-07-11T00:10:00.000Z',
  };
}

function hardGateIds(pkg: ReturnType<typeof buildCharacterStoryProfessionalTextPackage>): string[] {
  return pkg.quality_report.hard_gate_failures.map(item => item.split(':', 1)[0]);
}

describe('character_story professional text pipeline', () => {
  it('builds a complete production candidate package without claiming professional pass', () => {
    const pkg = buildCharacterStoryProfessionalTextPackage(pipelineInput());
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

  it('detects all three registered failure fixtures and produces targeted revision actions', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(
      repoRoot,
      'data',
      'professional-benchmarks',
      'character-story-iteration3-benchmark-specs.json',
    ), 'utf8')) as Record<string, any>;

    for (const fixture of registry.failure_fixtures as Array<Record<string, any>>) {
      const input = pipelineInput();
      if (fixture.fixture_id.includes('chronology')) {
        input.story.full_text = '大纲：人物出生、求学、任官、著述、晚年，最后成为理学家。';
        input.character_evidence.scene_turns = {};
      }
      if (fixture.fixture_id.includes('no-choice-cost')) {
        input.character_evidence.resistance = '';
        input.character_evidence.choice = '';
        input.character_evidence.cost = '';
        input.character_evidence.ending_relationship_state = input.character_evidence.starting_relationship_state;
      }
      if (fixture.fixture_id.includes('no-truth-dialogue')) {
        input.research.evidence_items = [];
        input.research.unknowns = [];
        input.character_evidence.dialogue_voice_rules = [];
        input.character_evidence.subtext_strategy = '';
      }

      const pkg = buildCharacterStoryProfessionalTextPackage(input);
      const detected = hardGateIds(pkg);
      const revisionPlan = buildCharacterStoryRevisionPlan(pkg);

      expect(pkg.quality_report.professional_passed).toBe(false);
      expect(detected).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
      expect(revisionPlan.professional_passed).toBe(false);
      expect(revisionPlan.actions.map(action => action.issue_id))
        .toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
    }
  });

  it('rebuilds stale derived sections while preserving unresolved creative gates', () => {
    const pkg = buildCharacterStoryProfessionalTextPackage(pipelineInput());
    pkg.sequence_beats = [];
    pkg.director_text_plan.sequences = [];
    pkg.delivery_text_package.scene_units = [];

    const result = rebuildCharacterStoryDerivedText({
      package: pkg,
      character_evidence: characterEvidence(),
      now: '2026-07-11T00:20:00.000Z',
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

  it('registers five real-model benchmark specs without counting them as completed projects', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(
      repoRoot,
      'data',
      'professional-benchmarks',
      'character-story-iteration3-benchmark-specs.json',
    ), 'utf8')) as Record<string, any>;

    expect(registry.summary).toMatchObject({
      fixed_project_spec_count: 5,
      fixed_real_model_project_count: 0,
      fixed_real_model_project_pass_count: 0,
      failure_fixture_count: 3,
      human_blind_review_pass_count: 0,
    });
    expect(registry.projects).toHaveLength(5);
    expect(new Set(registry.projects.map((item: Record<string, unknown>) => item.benchmark_id)).size).toBe(5);
    expect(registry.projects.every((item: Record<string, unknown>) =>
      item.status === 'awaiting_real_model_run' && item.professional_passed === false
    )).toBe(true);
    expect(registry.failure_fixtures).toHaveLength(3);
    expect(registry.failure_fixtures.every((item: Record<string, unknown>) =>
      item.fixture_kind === 'simulation_failure_fixture' && item.professional_passed === false
    )).toBe(true);
  });
});
