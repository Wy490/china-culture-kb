import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getProjectContext } from '../src/tools/get-project-context.js';
import { generateStoryRepairPrompt, repairStory } from '../src/tools/repair-story.js';

const tmpDir = path.join(os.tmpdir(), 'kb-repair-story-test-' + Date.now());
const dataRoot = path.join(tmpDir, 'data');
const projectId = '20260618-story-repair--ai_comic_drama';
const storyId = '20260618-story-repair';

function baseScenes() {
  return [
    {
      scene_id: 1,
      title: '雨夜开场',
      location: '书院门前',
      dramatic_function: '钩子开场',
      plot: '雨夜里，主角站在紧闭的书院门前，手里攥着被退回的文书，外面的催促声越来越近。',
      key_action: '主角选择留下来面对压力',
      conflict: '他必须在退让和坚持之间做选择',
      visual_prompt: '雨夜，书院门前，灯笼摇晃，人物握紧文书，近景特写',
      camera_suggestion: '近景切入，随后推到人物表情',
      cultural_note: '体现士人坚持',
    },
    {
      scene_id: 2,
      title: '压力逼近',
      location: '书院正厅',
      dramatic_function: '人物登场',
      plot: '众人围在正厅，要求主角立刻改口，他看见案上证据和门外等候的人，沉默后把文书重新摊开。',
      key_action: '主角拒绝草率签字',
      conflict: '外部权威逼迫他让步',
      visual_prompt: '正厅，案几，文书，众人围立，压迫构图',
      camera_suggestion: '中近景交替',
      cultural_note: '体现良知和责任',
    },
    {
      scene_id: 3,
      title: '冲突爆发',
      location: '正厅中央',
      dramatic_function: '冲突爆发',
      plot: '上官拍案催逼，主角把证据推到众人面前，指出其中疑点，局面从沉默变成正面对峙。',
      key_action: '主角坚持提出疑点',
      conflict: '权威命令与事实疑点正面对抗',
      visual_prompt: '案几特写，纸页散开，人物对峙，强烈明暗',
      camera_suggestion: '特写快切',
      cultural_note: '体现正义',
    },
    {
      scene_id: 4,
      title: '关键选择',
      location: '廊下',
      dramatic_function: '反转/觉醒',
      plot: '主角走到廊下，听见被牵连者家人的哭声，回到厅内，当众宣布宁可担责也不能让疑案成为定案。',
      key_action: '主角选择承担后果',
      conflict: '个人前途与事实良知冲突',
      visual_prompt: '廊下雨声，家人哭泣，人物转身，眼神坚定',
      camera_suggestion: '跟拍转特写',
      cultural_note: '体现担当',
    },
    {
      scene_id: 5,
      title: '余味结尾',
      location: '书院外',
      dramatic_function: '高燃收束',
      plot: '天亮时，文书被重新审看，主角走出书院，身后的人群安静下来，这次坚持成为后来被记住的精神起点。',
      key_action: '主角守住选择',
      conflict: '坚持后的代价仍在',
      visual_prompt: '清晨，书院外，雨停，人物背影，远景留白',
      camera_suggestion: '远景拉远',
      cultural_note: '精神与良知落点',
    },
  ];
}

function baseMaterialSufficiency() {
  return {
    schema_version: 'material-sufficiency/v1' as const,
    stage: 'script_ready' as const,
    active_stage: 'minimum_viable_story' as const,
    score: 63,
    can_generate: true,
    can_generate_with_risks: true,
    blocked: false,
    needs_verification: true,
    generation_posture: 'draft_needs_verification' as const,
    missing_items: [{
      item_id: 'verified_dialogue_boundary',
      label: '对白真实性边界',
      reason: '人物发言只能作为影视化补足，不能写成史实引语',
      blocking_level: 'risk' as const,
      affects: ['truth_report', 'dialogue'],
      recommended_question: '是否有可公开引用的人物原话或机构审定表述？',
    }],
    optional_items: [],
    token_risk: 'low' as const,
    recommended_next_questions: ['是否有可公开引用的人物原话或机构审定表述？'],
  };
}

function baseCreationContract(materialSufficiency = baseMaterialSufficiency()) {
  return {
    schema_version: 'creation-contract/v1' as const,
    creation_use_case: 'institutional_promo' as const,
    truth_mode: 'institutional_verified' as const,
    client_type: '文化机构',
    target_audience: '公众观众',
    communication_goal: '稳妥呈现人物选择与机构价值表达',
    video_type: 'ai_comic_drama' as const,
    presentation_style: 'ai_comic' as const,
    story_structure: 'single_event_drama' as const,
    narrative_pattern_ids: ['hero_choice'],
    allowed_fiction: ['可做镜头调度与场景压缩'],
    must_verify: ['人物原话', '机构审定口径'],
    forbidden_moves: ['虚构机构发言', '把待核验材料写成确定事实'],
    required_disclaimers: [],
    material_sufficiency: materialSufficiency,
    delivery_expectation: ['输出可审校剧本草案'],
  };
}

function baseStory(overrides: Record<string, unknown> = {}) {
  const materialSufficiency = baseMaterialSufficiency();
  return {
    storyId,
    project_id: projectId,
    title: '雨夜书院',
    generation_type: 'character_story',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    source_entry: '测试条目',
    logline: '一个人在压力中坚持选择。',
    theme: '良知与担当',
    full_text: '雨夜里，主角被逼着改口。他看着文书上的疑点，选择留下来承担后果。天亮时，这次坚持成为后来被记住的精神起点。',
    scene_breakdown: baseScenes(),
    gears_segments: [],
    cultural_constraints: [],
    credibility_note: '测试可信度说明',
    story_structure: 'single_event_drama',
    material_sufficiency: materialSufficiency,
    creation_contract: baseCreationContract(materialSufficiency),
    story_blueprint: {
      schema_version: 'story-blueprint/v1',
      central_event: '雨夜拒签',
      central_question: '主角如何在雨夜拒签中守住良知？',
      genre_beats: [
        { beat_id: 'beat-1', order: 1, function_label: '钩子开场', scene_id: 1 },
        { beat_id: 'beat-2', order: 2, function_label: '人物登场', scene_id: 2 },
        { beat_id: 'beat-3', order: 3, function_label: '冲突爆发', scene_id: 3 },
        { beat_id: 'beat-4', order: 4, function_label: '反转/觉醒', scene_id: 4 },
        { beat_id: 'beat-5', order: 5, function_label: '高燃收束', scene_id: 5 },
      ],
      evidence_boundaries: [{ label: '测试事实边界', note: '测试用边界', type: 'creative_treatment' }],
    },
    ...overrides,
  };
}

function versionsDir() {
  return path.join(tmpDir, 'web', 'generated', 'projects', projectId, 'versions');
}

beforeEach(() => {
  process.env.KB_ROOT = dataRoot;
  fs.mkdirSync(path.join(dataRoot, 'provinces'), { recursive: true });

  const projectRoot = path.join(tmpDir, 'web', 'generated', 'projects', projectId);
  fs.mkdirSync(versionsDir(), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({
    project_id: projectId,
    current_story_id: storyId,
    title: '雨夜书院',
    source_domain: 'china_culture',
    source_entry: '测试条目',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    story_structure: 'single_event_drama',
    status: 'draft',
    created_at: '2026-06-18T01:00:00.000Z',
    updated_at: '2026-06-18T01:00:00.000Z',
    current_version_id: `${projectId}-v1`,
    version_count: 1,
    scene_count: 5,
    has_gears_segments: false,
  }, null, 2));
  fs.writeFileSync(path.join(versionsDir(), `${projectId}-v1.json`), JSON.stringify({
    project_id: projectId,
    version_id: `${projectId}-v1`,
    created_at: '2026-06-18T01:00:00.000Z',
    change_type: 'initial_generation',
    scene_ids_changed: [],
    story: baseStory(),
  }, null, 2));

  const storyRoot = path.join(tmpDir, 'web', 'generated', 'stories', 'ai_comic_drama');
  fs.mkdirSync(storyRoot, { recursive: true });
  fs.writeFileSync(path.join(storyRoot, `${storyId}.json`), JSON.stringify(baseStory(), null, 2));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.KB_ROOT;
});

describe('kb_repair_story', () => {
  it('generates a model-ready repaired_story_json prompt package', async () => {
    const versionsBefore = fs.readdirSync(versionsDir());
    const result = await generateStoryRepairPrompt({
      project_id: projectId,
      user_instruction: '优先补强主角短对白和结尾钩子',
      include_markdown: false,
    });
    const versionsAfter = fs.readdirSync(versionsDir());

    expect(result).not.toBeNull();
    expect(result!.schema_version).toBe('story-repair-prompt/v1');
    expect(result!.source).toBe('project_id');
    expect(result!.quality_snapshot.video_type).toBe('ai_comic_drama');
    expect(result!.repair_actions.some(action => action.issue.includes('AI 漫剧缺少对白'))).toBe(true);
    expect(result!.protected_fields).toContain('story_blueprint.evidence_boundaries');
    expect(result!.protected_fields).toContain('creation_contract');
    expect(result!.boundary_notes.join('\n')).toContain('创作合同边界');
    expect(result!.boundary_notes.join('\n')).toContain('机构审定');
    expect(result!.boundary_notes.join('\n')).toContain('素材 Gate');
    expect(result!.creation_contract?.truth_mode).toBe('institutional_verified');
    expect(result!.material_sufficiency?.score).toBe(63);
    expect(result!.output_contract).toMatchObject({
      format: 'json',
      root_type: 'StoryGenerateResult',
      validation_tool: 'kb_validate_genre_story',
      apply_tool: 'kb_repair_story',
    });
    expect(result!.recommended_workflow.map(step => step.tool)).toEqual([
      'kb_validate_genre_story',
      'kb_repair_story',
      'kb_get_project_context',
    ]);
    expect(result!.prompt).toContain('只输出一个完整 JSON 对象');
    expect(result!.prompt).toContain('创作合同与素材 Gate 边界');
    expect(result!.prompt).toContain('禁止表达边界');
    expect(result!.prompt).toContain('优先补强主角短对白和结尾钩子');
    expect(result!.prompt).toContain('"storyId"');
    expect(result!.original_story_json).toContain('"storyId"');
    expect(result!.markdown).toBeUndefined();
    expect(versionsAfter).toEqual(versionsBefore);
  });

  it('can omit original story json from the repair prompt package', async () => {
    const result = await generateStoryRepairPrompt({
      project_id: projectId,
      include_story_json: false,
      include_markdown: true,
      max_actions: 2,
    });

    expect(result).not.toBeNull();
    expect(result!.original_story_json).toBeUndefined();
    expect(result!.repair_actions.length).toBeLessThanOrEqual(2);
    expect(result!.prompt).toContain('调用方已持有原始 StoryGenerateResult JSON');
    expect(result!.markdown).toContain('Story Repair Prompt Package');
    expect(result!.markdown).toContain('创作合同与素材 Gate 边界');
    expect(result!.markdown).toContain('素材 Gate');
  });

  it('generates a read-only repair dry run from project_id', async () => {
    const versionsBefore = fs.readdirSync(versionsDir());
    const result = await repairStory({ project_id: projectId, include_markdown: false });
    const versionsAfter = fs.readdirSync(versionsDir());

    expect(result).not.toBeNull();
    expect(result!.source).toBe('project_id');
    expect(result!.applied).toBe(false);
    expect(result!.auto_apply).toBe(false);
    expect(result!.quality_snapshot.video_type).toBe('ai_comic_drama');
    expect(result!.source_issues.some(issue => issue.includes('AI 漫剧缺少对白'))).toBe(true);
    expect(result!.repair_actions.some(action => action.issue.includes('AI 漫剧缺少对白'))).toBe(true);
    expect(result!.target_scenes.length).toBeGreaterThan(0);
    expect(result!.repair_actions[0].acceptance_check).toContain('kb_validate_genre_story');
    expect(result!.risk_notes[0]).toContain('dry-run');
    expect(result!.boundary_notes.join('\n')).toContain('创作合同边界');
    expect(result!.risk_notes.join('\n')).toContain('素材 Gate');
    expect(versionsAfter).toEqual(versionsBefore);
    expect(result!.markdown).toBeUndefined();
  });

  it('limits direct story_json actions and can omit markdown', async () => {
    const story = baseStory({
      video_type: 'historical_drama',
      presentation_style: 'cinematic',
      story_blueprint: {
        central_event: '关键争辩',
        central_question: '主角如何选择？',
        genre_beats: baseStory().story_blueprint.genre_beats,
        evidence_boundaries: [],
      },
      credibility_note: '',
      scene_breakdown: baseScenes().map(scene => ({
        ...scene,
        factual_basis: '',
        fictionalized_elements: [],
      })),
      full_text: '主角在关键争辩中站出来，坚持自己的判断，最终改变局面。',
    });

    const result = await repairStory({
      story_json: JSON.stringify(story),
      max_actions: 2,
      include_markdown: false,
    });

    expect(result!.source).toBe('story_json');
    expect(result!.repair_actions.length).toBeLessThanOrEqual(2);
    expect(result!.risk_notes.some(note => note.includes('story_json 输入不会关联项目版本'))).toBe(true);
    expect(result!.markdown).toBeUndefined();
  });

  it('blocks auto_apply when repaired_story_json is missing', async () => {
    const versionsBefore = fs.readdirSync(versionsDir());
    const result = await repairStory({ project_id: projectId, auto_apply: true });

    expect(result!.auto_apply_requested).toBe(true);
    expect(result!.auto_apply).toBe(false);
    expect(result!.applied).toBe(false);
    expect(result!.risk_notes.some(note => note.includes('repaired_story_json'))).toBe(true);
    expect(result!.markdown).toContain('Story Repair Dry Run');
    expect(fs.readdirSync(versionsDir())).toEqual(versionsBefore);
  });

  it('applies a caller-provided repaired story as a new project version', async () => {
    const repairedStory = baseStory({
      full_text: '雨夜里，主角被逼着改口。他把文书举起说：“我不能签。”天亮前，真正的疑点还会浮出水面吗？',
      scene_breakdown: baseScenes().map(scene => scene.scene_id === 5
        ? {
          ...scene,
          dialogue_or_narration: '主角：天亮前，真正的疑点还会浮出水面吗？',
          plot: '天亮时，文书被重新审看，主角回头留下一个疑问，众人意识到故事还没有结束。',
        }
        : {
          ...scene,
          dialogue_or_narration: '主角：我不能签。',
        }),
      quality_report: {
        passed: true,
        genre_score: 88,
        issues: [],
        repair_actions: [],
      },
    });

    const result = await repairStory({
      project_id: projectId,
      auto_apply: true,
      repaired_story_json: JSON.stringify(repairedStory),
      user_instruction: '补强对白和结尾钩子',
    });

    expect(result!.auto_apply_requested).toBe(true);
    expect(result!.auto_apply).toBe(true);
    expect(result!.applied).toBe(true);
    expect(result!.update_result!.version_id).toBe(`${projectId}-v2`);
    expect(result!.after_quality_snapshot).toBeDefined();
    expect(result!.risk_notes[0]).toContain('写入新项目版本');

    const context = await getProjectContext({ project_id: projectId, include_versions: true });
    expect(context!.project.current_version_id).toBe(`${projectId}-v2`);
    expect(context!.versions).toHaveLength(2);
    expect(context!.current_story.full_text).toContain('真正的疑点');

    const previous = JSON.parse(fs.readFileSync(path.join(versionsDir(), `${projectId}-v1.json`), 'utf-8'));
    expect(previous.story.full_text).not.toContain('真正的疑点');
  });

  it('returns null for missing projects and rejects unsafe ids', async () => {
    await expect(repairStory({ project_id: '../bad' })).rejects.toThrow('非法项目 ID');
    await expect(repairStory({ project_id: 'missing-project' })).resolves.toBeNull();
    await expect(repairStory({})).rejects.toThrow('必须提供 project_id、story_id 或 story_json');
  });
});
