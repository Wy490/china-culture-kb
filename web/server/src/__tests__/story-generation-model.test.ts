// web/server/src/__tests__/story-generation-model.test.ts
// Focused tests for the full story generation model adapter.
// Covers: fallback when unconfigured, successful adapter output,
// compatibility check (scene_breakdown must match local skeleton),
// invalid/short output fallback, and generation_source status fields.

import { afterEach, describe, expect, it } from 'vitest';
import { generateStoryWithAdapter } from '../services/story-generation-model.js';
import { isModelSceneBreakdownCompatible, mergeModelOutputOntoLocalSkeleton } from '../services/story-service.js';
import type { StoryGenerationPromptPackage, StoryGenerationModelOutput } from '../services/story-generation-prompt.js';
import type { StoryScene, StoryGenerateResult } from '@shared/types.js';

// ---------------------------------------------------------------------------
// Env var cleanup
// ---------------------------------------------------------------------------

const ORIGINAL_STORY_GEN_COMMAND = process.env.STORY_GEN_COMMAND;
const ORIGINAL_STORY_GEN_COMMAND_ARGS = process.env.STORY_GEN_COMMAND_ARGS;
const ORIGINAL_STORY_GEN_COMMAND_TIMEOUT_MS = process.env.STORY_GEN_COMMAND_TIMEOUT_MS;
const ORIGINAL_STORY_GEN_PROVIDER = process.env.STORY_GEN_PROVIDER;

afterEach(() => {
  if (ORIGINAL_STORY_GEN_COMMAND === undefined) delete process.env.STORY_GEN_COMMAND;
  else process.env.STORY_GEN_COMMAND = ORIGINAL_STORY_GEN_COMMAND;

  if (ORIGINAL_STORY_GEN_COMMAND_ARGS === undefined) delete process.env.STORY_GEN_COMMAND_ARGS;
  else process.env.STORY_GEN_COMMAND_ARGS = ORIGINAL_STORY_GEN_COMMAND_ARGS;

  if (ORIGINAL_STORY_GEN_COMMAND_TIMEOUT_MS === undefined) delete process.env.STORY_GEN_COMMAND_TIMEOUT_MS;
  else process.env.STORY_GEN_COMMAND_TIMEOUT_MS = ORIGINAL_STORY_GEN_COMMAND_TIMEOUT_MS;

  if (ORIGINAL_STORY_GEN_PROVIDER === undefined) delete process.env.STORY_GEN_PROVIDER;
  else process.env.STORY_GEN_PROVIDER = ORIGINAL_STORY_GEN_PROVIDER;
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeLocalScenes(): StoryScene[] {
  return [
    {
      scene_id: 1, title: '开场', duration_sec: 20, location: '长沙',
      time_of_day: '清晨', dramatic_function: '开场', plot: '本地开场情节',
      key_action: '本地开场动作', characters: ['周敦颐'],
      visual_prompt: '本地画面', camera_suggestion: '远景',
      cultural_note: '本地文化标注',
    },
    {
      scene_id: 2, title: '冲突', duration_sec: 20, location: '军衙',
      time_of_day: '白天', dramatic_function: '冲突升级', plot: '本地冲突情节',
      key_action: '本地冲突动作', characters: ['周敦颐', '上官'],
      visual_prompt: '本地画面', camera_suggestion: '近景',
      cultural_note: '本地文化标注',
    },
    {
      scene_id: 3, title: '高潮', duration_sec: 20, location: '堂前',
      time_of_day: '黄昏', dramatic_function: '高潮', plot: '本地高潮情节',
      key_action: '本地高潮动作', characters: ['周敦颐'],
      visual_prompt: '本地画面', camera_suggestion: '特写',
      cultural_note: '本地文化标注',
    },
  ];
}

function makeCompatibleModelOutput(): StoryGenerationModelOutput {
  return {
    title: '模型标题',
    logline: '模型一句话',
    theme: '模型主题',
    full_text: '模型正文——一段完整的叙事文本，有开场、冲突和结尾。',
    scene_breakdown: [
      { scene_id: 1, title: '模型开场', plot: '模型开场情节，足够长度', key_action: '模型开场动作' },
      { scene_id: 2, title: '模型冲突', plot: '模型冲突情节，足够长度', key_action: '模型冲突动作' },
      { scene_id: 3, title: '模型高潮', plot: '模型高潮情节，足够长度', key_action: '模型高潮动作' },
    ],
    cultural_constraints: ['模型约束'],
    credibility_note: '模型可信度说明',
  };
}

function makeIncompatibleModelOutput_scenes3_ids(): StoryGenerationModelOutput {
  // 5 scenes in model but local has 3 → count mismatch
  return {
    title: '模型标题',
    logline: '模型一句话',
    theme: '模型主题',
    full_text: '模型正文',
    scene_breakdown: [
      { scene_id: 1, title: 'A', plot: '情节A足够长度', key_action: '动作A' },
      { scene_id: 2, title: 'B', plot: '情节B足够长度', key_action: '动作B' },
      { scene_id: 3, title: 'C', plot: '情节C足够长度', key_action: '动作C' },
      { scene_id: 4, title: 'D', plot: '情节D足够长度', key_action: '动作D' },
      { scene_id: 5, title: 'E', plot: '情节E足够长度', key_action: '动作E' },
    ],
    cultural_constraints: ['约束'],
    credibility_note: '说明',
  };
}

function makeIncompatibleModelOutput_wrongIds(): StoryGenerationModelOutput {
  // 3 scenes with IDs 10,20,30 — no overlap with local IDs 1,2,3
  return {
    title: '模型标题',
    logline: '模型一句话',
    theme: '模型主题',
    full_text: '模型正文',
    scene_breakdown: [
      { scene_id: 10, title: 'A', plot: '情节A足够长度', key_action: '动作A' },
      { scene_id: 20, title: 'B', plot: '情节B足够长度', key_action: '动作B' },
      { scene_id: 30, title: 'C', plot: '情节C足够长度', key_action: '动作C' },
    ],
    cultural_constraints: ['约束'],
    credibility_note: '说明',
  };
}

function makeLocalSkeleton() {
  return {
    title: '本地标题',
    logline: '本地一句话',
    theme: '本地主题',
    full_text: '本地正文——开场。冲突。高潮。',
    scene_breakdown: makeLocalScenes(),
    gears_segments: [],
    cultural_constraints: ['本地约束'],
    credibility_note: '本地可信度',
    characters: [{ name: '周敦颐', role: '主角', description: '理学鼻祖' }],
    act_structure: [{ act: 1, beat: '开场', scene_ids: [1], purpose: '开场' }],
    protagonist_arc: [{ starting_state: '犹豫', turning_point: '拒签', resolution: '坚持' }],
  };
}

// ---------------------------------------------------------------------------
// Tests: compatibility check (P1 core)
// ---------------------------------------------------------------------------

describe('isModelSceneBreakdownCompatible', () => {
  it('returns true when model has same count and matching IDs', () => {
    const local = makeLocalScenes();
    const model = makeCompatibleModelOutput().scene_breakdown;
    expect(isModelSceneBreakdownCompatible(local, model)).toBe(true);
  });

  it('returns false when model has different scene count', () => {
    const local = makeLocalScenes(); // 3 scenes
    const model = makeIncompatibleModelOutput_scenes3_ids().scene_breakdown; // 5 scenes
    expect(isModelSceneBreakdownCompatible(local, model)).toBe(false);
  });

  it('returns false when model scene_ids do not overlap with local', () => {
    const local = makeLocalScenes(); // IDs 1,2,3
    const model = makeIncompatibleModelOutput_wrongIds().scene_breakdown; // IDs 10,20,30
    expect(isModelSceneBreakdownCompatible(local, model)).toBe(false);
  });

  it('returns false when model has fewer scenes than local', () => {
    const local = makeLocalScenes(); // 3 scenes
    const model = [
      { scene_id: 1, title: 'A', plot: '情节A足够长度', key_action: '动作A' },
    ];
    expect(isModelSceneBreakdownCompatible(local, model)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: model adapter fallback behavior
// ---------------------------------------------------------------------------

describe('generateStoryWithAdapter', () => {
  it('returns local_only (not fallback) when STORY_GEN_COMMAND is not configured', async () => {
    delete process.env.STORY_GEN_COMMAND;
    delete process.env.STORY_GEN_PROVIDER;

    const pkg: StoryGenerationPromptPackage = {
      prompt_version: 'story-generation/v1',
      context: {
        entry_name: '周敦颐',
        entry_type: '历史人物',
        entry_region: '湖南→长沙',
        entry_keywords: ['理学'],
        video_type: 'character_story',
        presentation_style: 'cinematic',
        story_structure: 'single_event_drama',
        target_duration: '1分钟',
        tone: '',
      },
      entry_summary: '简介',
      entry_story: '故事',
      entry_cultural_significance: '意义',
      output_contract: { must_provide: [], should_respect: [], return_json_fields: [] },
      system_prompt: 'test',
      user_prompt: 'test',
    };

    const result = await generateStoryWithAdapter({
      pkg,
      modelProfileId: 'claude_sonnet',
    });

    expect(result.output).toBeNull();
    // Not configured means local-only path (not a fallback) — used_fallback should be false
    expect(result.used_fallback).toBe(false);
    expect(result.provider).toBe('local_only');
    expect(result.reason).toContain('STORY_GEN_COMMAND');
  });

  it('returns fallback with reason when model profile is unknown', async () => {
    delete process.env.STORY_GEN_COMMAND;
    delete process.env.STORY_GEN_PROVIDER;

    const pkg = {} as StoryGenerationPromptPackage;
    const result = await generateStoryWithAdapter({ pkg, modelProfileId: 'nonexistent_model' });

    expect(result.output).toBeNull();
    expect(result.used_fallback).toBe(true);
    expect(result.reason).toContain('Unknown model profile');
  });

  it('returns fallback when adapter command exits with non-zero code', async () => {
    process.env.STORY_GEN_COMMAND = process.execPath;
    process.env.STORY_GEN_COMMAND_ARGS = JSON.stringify([
      '-e', 'process.exit(1)',
    ]);
    process.env.STORY_GEN_PROVIDER = 'command_json';

    const pkg = {} as StoryGenerationPromptPackage;
    const result = await generateStoryWithAdapter({ pkg, modelProfileId: 'claude_sonnet' });

    expect(result.output).toBeNull();
    expect(result.used_fallback).toBe(true);
    expect(result.reason).toContain('exited with code');
  });

  it('returns fallback when adapter returns invalid JSON', async () => {
    process.env.STORY_GEN_COMMAND = process.execPath;
    process.env.STORY_GEN_COMMAND_ARGS = JSON.stringify([
      '-e', "process.stdout.write('not json at all');",
    ]);
    process.env.STORY_GEN_PROVIDER = 'command_json';

    const pkg = {} as StoryGenerationPromptPackage;
    const result = await generateStoryWithAdapter({ pkg, modelProfileId: 'claude_sonnet' });

    expect(result.output).toBeNull();
    expect(result.used_fallback).toBe(true);
    expect(result.reason).toContain('invalid JSON');
  });

  it('returns fallback when adapter returns JSON with missing required fields', async () => {
    // Return valid JSON but missing scene_breakdown and other required fields
    const invalidJson = JSON.stringify({ title: 'only title' });
    process.env.STORY_GEN_COMMAND = process.execPath;
    process.env.STORY_GEN_COMMAND_ARGS = JSON.stringify([
      '-e', `process.stdout.write('${invalidJson}');`,
    ]);
    process.env.STORY_GEN_PROVIDER = 'command_json';

    const pkg = {} as StoryGenerationPromptPackage;
    const result = await generateStoryWithAdapter({ pkg, modelProfileId: 'claude_sonnet' });

    expect(result.output).toBeNull();
    expect(result.used_fallback).toBe(true);
    expect(result.reason).toContain('invalid JSON');
  });

  it('returns fallback when adapter returns valid structure but full_text is too short', async () => {
    // All fields present but full_text < 50 chars (Zod min(50))
    const shortOutput = JSON.stringify({
      title: '标题',
      logline: '一句话',
      theme: '主题',
      full_text: '短文本', // < 50 chars
      scene_breakdown: [
        { scene_id: 1, title: '场1', plot: '情节足够长度十个字以上', key_action: '动作' },
      ],
      cultural_constraints: [],
      credibility_note: '说明',
    });
    process.env.STORY_GEN_COMMAND = process.execPath;
    process.env.STORY_GEN_COMMAND_ARGS = JSON.stringify([
      '-e', `let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{process.stdout.write('${shortOutput}');});`,
    ]);
    process.env.STORY_GEN_PROVIDER = 'command_json';

    const pkg = {} as StoryGenerationPromptPackage;
    const result = await generateStoryWithAdapter({ pkg, modelProfileId: 'claude_sonnet' });

    expect(result.output).toBeNull();
    expect(result.used_fallback).toBe(true);
    expect(result.reason).toContain('invalid JSON');
  });

  it('succeeds when adapter returns valid complete output', async () => {
    // Write valid output to a temp file, then use a simple script to read stdin and echo it
    const validOutput = {
      title: '拒签冤案',
      logline: '一纸判词逼出良知选择',
      theme: '坚守原则',
      full_text: '这是一个完整的故事文本，有开场、冲突和结局。足够长的叙事内容保证了故事质量。他看着案卷没有落笔，心里清楚这一笔关乎人命。上官催签他坚持重审。他决定交还文书。',
      scene_breakdown: [
        { scene_id: 1, title: '开场', plot: '他看着案卷没有落笔，心里清楚这一笔关乎人命', key_action: '停笔凝视' },
        { scene_id: 2, title: '冲突', plot: '上官催签他坚持重审，权势与良知在这里对撞', key_action: '当面拒签' },
        { scene_id: 3, title: '高潮', plot: '他决定交还文书宁可得罪上官也不肯错签', key_action: '交还文书' },
      ],
      cultural_constraints: ['基于知识库'],
      credibility_note: '基本可靠',
    };

    // Use a simple Node.js script that discards stdin and writes the valid output
    process.env.STORY_GEN_COMMAND = process.execPath;
    process.env.STORY_GEN_COMMAND_ARGS = JSON.stringify([
      '-e',
      `let d='';process.stdin.on('data',()=>{});process.stdin.on('end',()=>{process.stdout.write(JSON.stringify(${JSON.stringify(validOutput)}));});`,
    ]);
    process.env.STORY_GEN_PROVIDER = 'command_json';

    const pkg = {} as StoryGenerationPromptPackage;
    const result = await generateStoryWithAdapter({ pkg, modelProfileId: 'claude_sonnet' });

    expect(result.output).not.toBeNull();
    expect(result.used_fallback).toBe(false);
    expect(result.provider).toBe('command_json');
    expect(result.output!.title).toBe('拒签冤案');
    expect(result.output!.scene_breakdown.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Tests: merge logic — only proceeds when compatible
// ---------------------------------------------------------------------------

describe('mergeModelOutputOntoLocalSkeleton', () => {
  it('merges creative content when compatible', () => {
    const local = makeLocalSkeleton();
    const model = makeCompatibleModelOutput();

    const merged = mergeModelOutputOntoLocalSkeleton(local, model, 'character_story', 'cinematic');

    // Structural fields stay from local
    expect(merged.scene_breakdown[0].scene_id).toBe(1);
    expect(merged.scene_breakdown[0].duration_sec).toBe(20);
    expect(merged.scene_breakdown[0].location).toBe('长沙');

    // Creative content comes from model
    expect(merged.title).toBe('模型标题');
    expect(merged.full_text).toBe(model.full_text);
    expect(merged.scene_breakdown[0].title).toBe('模型开场');
    expect(merged.scene_breakdown[0].plot).toBe('模型开场情节，足够长度');
    expect(merged.scene_breakdown[1].title).toBe('模型冲突');

    // Cultural fields from model
    expect(merged.cultural_constraints).toEqual(['模型约束']);
    expect(merged.credibility_note).toBe('模型可信度说明');
  });

  it('uses local fallback for creative fields when model omits them', () => {
    const local = makeLocalSkeleton();
    // Model output with some creative fields missing (optional)
    const model: StoryGenerationModelOutput = {
      title: '模型标题',
      logline: '模型一句话',
      theme: '模型主题',
      full_text: '模型正文——一段完整的叙事文本，有开场、冲突和结尾。',
      scene_breakdown: [
        { scene_id: 1, title: '', plot: '模型开场情节，足够长度', key_action: '模型开场动作' },
        { scene_id: 2, title: '模型冲突', plot: '模型冲突情节，足够长度', key_action: '' },
        { scene_id: 3, title: '模型高潮', plot: '', key_action: '模型高潮动作' },
      ],
      cultural_constraints: [],
      credibility_note: '',
    };

    const merged = mergeModelOutputOntoLocalSkeleton(local, model, 'character_story', 'cinematic');

    // Empty model creative field → falls back to local
    expect(merged.scene_breakdown[0].title).toBe('开场'); // local fallback
    expect(merged.scene_breakdown[1].key_action).toBe('本地冲突动作'); // local fallback
    expect(merged.scene_breakdown[2].plot).toBe('本地高潮情节'); // local fallback
  });

  it('keeps local act_structure unchanged', () => {
    const local = makeLocalSkeleton();
    const model = makeCompatibleModelOutput();

    const merged = mergeModelOutputOntoLocalSkeleton(local, model, 'character_story', 'cinematic');
    expect(merged.act_structure).toEqual(local.act_structure);
  });
});