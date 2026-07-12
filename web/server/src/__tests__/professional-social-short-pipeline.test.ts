import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProfessionalTextPackageSchema } from '@shared/schemas.js';
import type { StoryGenerateResult } from '@shared/types.js';
import { buildSocialShortProfessionalTextPackage } from '../services/professional-social-short-pipeline-service.js';
import {
  buildSocialShortRevisionPlan,
  rebuildSocialShortDerivedText,
} from '../services/professional-social-short-revision-service.js';
import type { SocialShortEvidence } from '../services/professional-social-short-quality-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

function story(): StoryGenerateResult {
  const scenes = [
    ['釉下彩钩子', '窑址残片近景', '一块残片转到光下，彩色纹样先出现。'],
    ['制作误区', '工作台俯拍', '创作者把彩绘层与釉层位置并排标出。'],
    ['水路反差', '湘江岸竖屏跟拍', '人物把器物图与江面船行方向对齐。'],
    ['互动收束', '当代使用桌面', '一只新杯落桌，观众问题同步出现。'],
  ].map((item, index) => ({
    scene_id: index + 1,
    title: item[0],
    duration_sec: [15, 20, 20, 20][index],
    location: item[1],
    time_of_day: '白天',
    dramatic_function: ['钩子', '解释', '反差', '互动'][index],
    plot: item[2],
    key_action: item[2],
    characters: ['文化短视频创作者'],
    visual_prompt: `${item[1]}，9:16单一视觉重点。`,
    camera_suggestion: '竖屏近景后快速切换。',
    cultural_note: '事实与宣传组织分层。',
    conflict: '强钩子不能牺牲事实。',
    dialogue_or_narration: ['先别把它只当成一块旧瓷片。', '颜色的位置，决定它为什么特别。', '它连接的不只是窑火，还有水路。', '你会把哪种纹样带回今天？'][index],
    source_entries: ['长沙窑铜官陶瓷烧制技艺——海上丝绸之路的釉下彩开创'],
    factual_basis: '长沙窑、釉下彩与水路联系来自知识库。',
    fictionalized_elements: ['创作者、拍摄动作和75秒节拍为宣传组织。'],
  }));
  return {
    storyId: 'social-fixture',
    title: '75秒看懂长沙窑的一处反差',
    generation_type: 'scene_short',
    video_type: 'social_short',
    presentation_style: 'social_media_fastcut',
    source_entry: '长沙窑铜官陶瓷烧制技艺——海上丝绸之路的釉下彩开创',
    logline: '从残片颜色进入长沙窑的制作与水路信息。',
    theme: '短视频的反差必须由事实而不是标题党产生。',
    full_text: scenes.map(scene => `${scene.title}。${scene.plot}${scene.dialogue_or_narration}`).join('\n\n'),
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: '',
    cultural_constraints: ['不得夸大年代、身份、机构成果或传播范围。'],
    credibility_note: '事实与75秒宣传组织分层。',
    truth_mode: 'inspired_by_material',
    story_structure: 'object_clue_journey',
  };
}

function socialEvidence(): SocialShortEvidence {
  const timing = [[0, 3], [3, 15], [15, 32], [32, 52], [52, 75]];
  const information = [
    '长沙窑残片上的颜色不是后期滤镜。',
    '釉下彩把纹样放在釉层保护之下。',
    '制作动作需要先画纹样再施釉烧成。',
    '湘江水路让器物进入更远的交流网络。',
    '当代创作可以借纹样，但不能伪造历史用途。',
  ];
  return {
    target_duration_sec: 75,
    hook_0_3s: '这块一千多年前的彩色残片，不是加了滤镜。',
    hook_fact_evidence_ids: ['kiln-fact'],
    core_message: '用一处可验证的颜色反差理解长沙窑的工艺与交流。',
    beat_plan: timing.map((range, index) => ({
      beat_id: `social-${index + 1}`,
      order: index + 1,
      start_sec: range[0],
      end_sec: range[1],
      new_information: information[index],
      vertical_visual: ['残片占满竖屏，转光显出彩纹', '剖面示意从彩绘层推到釉层', '手部依次完成画纹和施釉动作', '器物轮廓沿竖屏地图移动到湘江', '新杯落桌，历史用途警示卡出现'][index],
      caption: ['不是滤镜', '颜色在釉下', '先画再施釉', '器物走向水路', '借纹样不造史'][index],
      voiceover_or_dialogue: ['先别把它只当旧瓷片。', '特别之处，是颜色被釉层保护。', '镜头里要看清动作先后。', '窑火之外，还有湘江水路。', '你最想把哪种纹样带回今天？'][index],
      evidence_ids: ['kiln-fact'],
      contrast_or_turn: ['旧残片却保留彩色', '表面颜色转向工艺结构', '名词解释转向手部动作', '窑址转向交流水路', '观看转向当代选择'][index],
    })),
    central_contrast: '看似只是残片，实际同时保存工艺方法和交流线索。',
    shareable_line: '真正的反差，不靠标题夸张，靠一块残片自己说话。',
    interaction_question: '你最想把哪种长沙窑纹样带回今天？',
    platform_safety_notes: ['年代、工艺称谓和水路关系以知识库事实为限。', '人物、拍摄动作和75秒节拍不得冒充真实纪实。'],
    scene_turns: {
      '1': '从旧残片到彩色反差',
      '2': '从颜色到制作结构',
      '3': '从窑火到水路交流',
      '4': '从观看到当代选择',
    },
  };
}

function input(): any {
  return {
    story: story(),
    target_audience: '18至35岁竖屏文化内容观众',
    platform: '社交平台竖屏短视频',
    target_duration: '1分钟',
    communication_goal: '用75秒的事实反差解释长沙窑釉下彩。',
    production_goal: '形成带时间码、字幕、声画分工的可拍文本。',
    audience_promise: '观众将在持续新信息中理解一块彩色残片。',
    research: {
      source_summary: '知识库提供长沙窑、釉下彩与交流背景。',
      evidence_items: [
        { evidence_id: 'kiln-fact', status: 'verified_fact', claim: '长沙窑以釉下彩等工艺形成彩色纹样，并与水路交流相关。', source: '长沙窑铜官陶瓷烧制技艺——海上丝绸之路的釉下彩开创', allowed_usage: '工艺与历史背景。', verification_note: '精确年代和工序由专家复核。' },
        { evidence_id: 'social-plan', status: 'plausible_dramatization', claim: '创作者、拍摄动作和75秒节拍为传播组织。', source: '专业短视频创作', allowed_usage: '节拍与人物连接。', verification_note: '不冒充纪实人物。' },
      ],
      unknowns: ['具体器物年代、纹样含义和当代产品授权待项目核验。'],
      authorization_notes: ['不复制第三方商业短视频。'],
    },
    social_evidence: socialEvidence(),
  };
}

const gates = (professionalPackage: ReturnType<typeof buildSocialShortProfessionalTextPackage>) =>
  professionalPackage.quality_report.hard_gate_failures.map(failure => failure.split(':', 1)[0]);

describe('social short professional pipeline', () => {
  it('builds a schema-valid 75-second candidate without promoting it to professional pass', () => {
    const professionalPackage = buildSocialShortProfessionalTextPackage(input());
    expect(ProfessionalTextPackageSchema.safeParse(professionalPackage).success).toBe(true);
    expect(professionalPackage.status).toBe('in_review');
    expect(professionalPackage.quality_report.hard_gate_failures).toEqual([]);
    expect(professionalPackage.quality_report.professional_passed).toBe(false);
  });

  it('detects registered failure fixtures and routes revisions', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/professional-benchmarks/social-short-stage3-iteration4-benchmark-specs.json'), 'utf8'));
    for (const fixture of registry.failure_fixtures) {
      const candidate = input();
      if (fixture.fixture_id.includes('clickbait')) {
        candidate.social_evidence.hook_fact_evidence_ids = [];
        candidate.research.unknowns = [];
      }
      if (fixture.fixture_id.includes('repeated')) {
        candidate.social_evidence.beat_plan.forEach((beat: any) => {
          beat.new_information = '重复信息';
          beat.caption = beat.voiceover_or_dialogue;
        });
      }
      if (fixture.fixture_id.includes('wrong-duration')) {
        candidate.social_evidence.target_duration_sec = 45;
        candidate.social_evidence.shareable_line = '';
        candidate.social_evidence.interaction_question = '';
      }
      const professionalPackage = buildSocialShortProfessionalTextPackage(candidate);
      const revisionPlan = buildSocialShortRevisionPlan(professionalPackage);
      expect(gates(professionalPackage)).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
      expect(revisionPlan.actions.map(action => action.issue_id)).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids));
    }
  });

  it('rebuilds derived beats from the fixed social evidence', () => {
    const professionalPackage = buildSocialShortProfessionalTextPackage(input());
    professionalPackage.sequence_beats = [];
    expect(rebuildSocialShortDerivedText({ package: professionalPackage, social_evidence: socialEvidence() }).rebuilt_sections)
      .toEqual(['sequence_beats']);
  });

  it('registers five pending real-model specs and three excluded failure fixtures', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/professional-benchmarks/social-short-stage3-iteration4-benchmark-specs.json'), 'utf8'));
    expect(registry.summary).toMatchObject({ fixed_project_spec_count: 5, failure_fixture_count: 3, fixed_real_model_project_count: 0, human_blind_review_pass_count: 0 });
    expect(registry.projects.every((project: any) => project.professional_passed === false)).toBe(true);
  });
});
