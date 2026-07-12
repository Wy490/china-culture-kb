import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProfessionalTextPackageSchema } from '@shared/schemas.js';
import type { StoryGenerateResult } from '@shared/types.js';
import { buildAiComicDramaProfessionalTextPackage } from '../services/professional-ai-comic-drama-pipeline-service.js';
import { buildAiComicDramaRevisionPlan, rebuildAiComicDramaDerivedText } from '../services/professional-ai-comic-drama-revision-service.js';
import type { AiComicDramaProfessionalEvidence } from '../services/professional-ai-comic-drama-quality-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

function comicStory(): StoryGenerateResult {
  const scenes = [
    ['错色太阳纹', '侗锦织机前', '阿禾发现太阳纹里多出一根蓝线，师姐已经抬手准备剪断。', '阿禾按住剪刀柄，指向蓝线。', '剪掉最省事，但蓝线可能来自奶奶留下的旧图。'],
    ['谁动了经线', '织机侧面', '师姐认为阿禾擅自改图，阿禾却在旧纸角落找到同样的蓝色记号。', '两人同时抓住旧图纸的两边。', '她们都想保护图样，却不相信对方的方法。'],
    ['蓝线不是错误', '鼓楼窗边', '老人说明蓝线是旧版本留下的河流记号，但新作品是否保留要由织作者决定。', '阿禾把蓝线和金线并排绕在手指上。', '知道来源并不能替她作出选择。'],
    ['反向穿梭', '织机正面', '阿禾没有剪线，而是反向退回三梭，让蓝线重新回到太阳纹边缘。', '师姐接住梭子，改变下一步方向。', '两人的关系从争夺图样转为共同承担修改后果。'],
    ['图样背面的结', '完成的侗锦前', '太阳纹完成，背面却露出一个此前没有的蓝色线结。', '阿禾翻起织物背面，线结中夹着另一张折叠纸条。', '这张纸条是谁留下的，它会不会改变下一幅图？'],
  ].map(([title, location, plot, keyAction, conflict], index) => ({
    scene_id: index + 1, title, duration_sec: 40, location, time_of_day: '白天',
    dramatic_function: ['强钩子', '关系碰撞', '信息反转', '主动选择', '结尾钩子'][index], plot, key_action: keyAction,
    characters: ['阿禾', '师姐'], visual_prompt: `${location}，动态漫画近景，太阳纹、蓝线与人物表情清楚。`,
    camera_suggestion: '近景表情与手部动作交替，每格单一视觉重点。', cultural_note: '侗锦工艺事实与虚构人物剧情分层。', conflict,
    dialogue_or_narration: index === 0 ? '师姐：剪掉。\n阿禾：等一下，这根线见过我们。' : `${title}中，两人用短气泡推进冲突。`,
    source_entries: ['通道侗锦——湘西南侗寨的指尖花雨'], factual_basis: '侗锦、织机、经纬线和太阳纹来自知识库文化条目。',
    fictionalized_elements: ['阿禾、师姐、蓝线旧图、具体冲突和对白均为漫画化虚构。'],
  }));
  return {
    storyId: 'ai-comic-professional-fixture', title: '太阳纹里的蓝线', generation_type: 'scene_short', video_type: 'ai_comic_drama', presentation_style: 'ai_comic', source_entry: '通道侗锦——湘西南侗寨的指尖花雨',
    logline: '一根不在新图样里的蓝线，让两名年轻织作者在剪除错误与保留旧版本之间发生碰撞。', theme: '理解传统不是照抄答案，而是知道来源后承担自己的选择。',
    full_text: scenes.map(scene => `${scene.title}。${scene.plot}${scene.dialogue_or_narration}`).join('\n\n'), scene_breakdown: scenes, gears_segments: [], gears_segments_url: '',
    cultural_constraints: ['不虚构具体传承人经历，不把漫画对白写成口述史。'], credibility_note: '工艺背景可核，人物和事件为虚构。', truth_mode: 'inspired_by_material', story_structure: 'single_event_drama',
    characters: [{ name: '阿禾', role: '主角', description: '发现错色线的年轻织作者' }, { name: '师姐', role: '关系对手', description: '坚持按新图样完成作品' }],
  };
}

function comicEvidence(): AiComicDramaProfessionalEvidence {
  const panels = Array.from({ length: 5 }, (_, sceneIndex) => Array.from({ length: 3 }, (_, panelIndex) => ({
    panel_id: `s${sceneIndex + 1}-p${panelIndex + 1}`, scene_id: sceneIndex + 1, order: panelIndex + 1,
    framing: panelIndex === 0 ? '手部特写' : panelIndex === 1 ? '双人近景' : '表情反应近景',
    visible_action: [`蓝线在太阳纹中绷紧`, `阿禾与师姐同时伸手`, `两人看向线结，动作停住`][panelIndex],
    expression: ['警觉', '对峙', sceneIndex === 4 ? '震惊' : '迟疑'][panelIndex],
    dialogue_bubble: panelIndex === 1 ? (sceneIndex === 4 ? '里面还有一张纸？' : '先别剪。') : undefined,
    reaction_panel: panelIndex === 2,
    asset_ids: ['char-ahe', 'char-sister', 'prop-blue-thread', 'loc-loom-room'],
  }))).flat();
  return {
    protagonist: '阿禾', episode_hook: '第一格蓝线绷紧、剪刀落下，阿禾突然按住剪刀。',
    relationship_collision: '阿禾要查清蓝线来源，师姐要按新图及时完成，两人争夺同一把剪刀和图样解释权。',
    reversal_or_choice: '阿禾选择退回三梭保留蓝线，师姐接住梭子共同改变织法。',
    ending_hook: '蓝色线结里为什么藏着另一张纸条？', ending_visible_action: '阿禾翻起织物背面，从线结中抽出折叠纸条。',
    panel_beats: panels, max_bubble_characters: 18,
    asset_bible: [
      { asset_id: 'char-ahe', asset_type: 'character', label: '阿禾', continuity_rule: '蓝色发带、左手护指和短袖侗族纹样服装全场不变。' },
      { asset_id: 'char-sister', asset_type: 'character', label: '师姐', continuity_rule: '红色腰带、右手护指和较深服装色保持一致。' },
      { asset_id: 'prop-blue-thread', asset_type: 'prop', label: '蓝线与太阳纹', continuity_rule: '蓝线从图样中心退回边缘，位置变化必须按场次连续。' },
      { asset_id: 'loc-loom-room', asset_type: 'location', label: '织机空间', continuity_rule: '织机朝向、窗光方向与人物左右站位保持稳定。' },
    ],
    scene_turns: { '1': '从发现错色转为阻止剪线', '2': '从工艺分歧转为关系对峙', '3': '从错误判断转为版本信息反转', '4': '从争夺转为共同选择', '5': '从完成图样转为发现新谜题' },
  };
}

function pipelineInput(): any {
  return {
    story: comicStory(), target_audience: '16至30岁竖屏动态漫画观众', platform: '竖屏AI漫剧', target_duration: '3分钟', communication_goal: '用错色蓝线制造工艺选择与关系碰撞。', production_goal: '形成可分格、可配气泡、资产连续的单集漫剧。', audience_promise: '观众将看到一根蓝线如何逼两名织作者重新理解彼此和旧图样。', truth_mode: 'inspired_by_material',
    research: { source_summary: '知识库提供侗锦、织机、经纬线和纹样事实。', evidence_items: [
      { evidence_id: 'comic-fact', status: 'verified_fact', claim: '侗锦使用织机、经纬线和传统纹样形成织物。', source: '通道侗锦——湘西南侗寨的指尖花雨', allowed_usage: '工艺与资产背景。', verification_note: '不证明虚构人物事件。' },
      { evidence_id: 'comic-fiction', status: 'fictional_addition', claim: '阿禾、师姐、蓝线旧图和纸条谜题为原创漫剧情节。', source: '原创漫剧设定', allowed_usage: '关系与剧情。', verification_note: '不得写成传承人口述。' },
    ], unknowns: ['具体太阳纹版本、织机布局与服装纹样需项目级复核。'], authorization_notes: ['不复制现代漫画角色或受保护剧情。'] }, comic_evidence: comicEvidence(), now: '2026-07-11T04:00:00.000Z',
  };
}
function gateIds(pkg: ReturnType<typeof buildAiComicDramaProfessionalTextPackage>) { return pkg.quality_report.hard_gate_failures.map(item => item.split(':', 1)[0]); }

describe('ai_comic_drama professional text pipeline', () => {
  it('builds a panelable asset-stable candidate without professional credit', () => {
    const pkg = buildAiComicDramaProfessionalTextPackage(pipelineInput());
    const parsed = ProfessionalTextPackageSchema.safeParse(pkg);
    expect(parsed.success, parsed.success ? '' : parsed.error.message).toBe(true);
    expect(pkg.status).toBe('in_review'); expect(pkg.quality_report.hard_gate_failures).toEqual([]); expect(pkg.quality_report.total_score).toBeGreaterThanOrEqual(80); expect(pkg.quality_report.professional_passed).toBe(false); expect(pkg.delivery_text_package.scene_units).toHaveLength(5);
  });
  it('detects registered failure fixtures and routes revisions', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/professional-benchmarks/ai-comic-drama-iteration7-benchmark-specs.json'), 'utf8')) as Record<string, any>;
    for (const fixture of registry.failure_fixtures) {
      const input = pipelineInput();
      if (fixture.fixture_id.includes('without-panels')) input.comic_evidence.panel_beats = [];
      if (fixture.fixture_id.includes('no-reactions')) { input.comic_evidence.max_bubble_characters = 5; input.comic_evidence.panel_beats.forEach((panel: any) => { panel.reaction_panel = false; panel.dialogue_bubble = '这是一段远远超过气泡限制的连续说明文字'; }); }
      if (fixture.fixture_id.includes('asset-drift')) { input.comic_evidence.asset_bible = []; input.comic_evidence.ending_hook = ''; input.comic_evidence.ending_visible_action = ''; }
      const pkg = buildAiComicDramaProfessionalTextPackage(input); const detected = gateIds(pkg); const plan = buildAiComicDramaRevisionPlan(pkg);
      expect(detected).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids)); expect(plan.actions.map(action => action.issue_id)).toEqual(expect.arrayContaining(fixture.expected_hard_gate_ids)); expect(plan.professional_passed).toBe(false);
    }
  });
  it('rebuilds stale comic derived sections', () => {
    const pkg = buildAiComicDramaProfessionalTextPackage(pipelineInput()); pkg.sequence_beats = []; pkg.delivery_text_package.scene_units = [];
    const result = rebuildAiComicDramaDerivedText({ package: pkg, comic_evidence: comicEvidence(), now: '2026-07-11T04:10:00.000Z' });
    expect(result.rebuilt_sections).toEqual(['sequence_beats', 'delivery_text_package']); expect(result.package.revision_trace).toHaveLength(1); expect(result.package.quality_report.professional_passed).toBe(false); expect(ProfessionalTextPackageSchema.safeParse(result.package).success).toBe(true);
  });
  it('registers five pending real-model specs and excludes golden drafts and fixtures', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/professional-benchmarks/ai-comic-drama-iteration7-benchmark-specs.json'), 'utf8')) as Record<string, any>;
    expect(registry.summary).toMatchObject({ fixed_project_spec_count: 5, fixed_real_model_project_count: 0, failure_fixture_count: 3, human_blind_review_pass_count: 0 });
    expect(registry.projects).toHaveLength(5); expect(registry.projects.every((item: any) => item.status === 'awaiting_real_model_run' && item.professional_passed === false)).toBe(true); expect(registry.failure_fixtures.every((item: any) => item.fixture_kind === 'simulation_failure_fixture' && item.professional_passed === false)).toBe(true);
  });
});
