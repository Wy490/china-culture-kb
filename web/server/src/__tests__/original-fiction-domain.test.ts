import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ORIGINAL_FICTION_ENTRY_NAME,
  originalFictionDomainPack,
} from '../domains/original-fiction/domain-pack.js';
import {
  applyProjectQualityRepairJson,
  generateProjectQualityRepairPrompt,
  getProject,
  listProjects,
} from '../services/project-service.js';
import {
  getGearsDeliveryPackage,
  getGearsSegments,
  getSeedancePromptPackage,
} from '../platform/story-delivery-service.js';
import { getStory, listStories } from '../platform/story-read-service.js';
import { createStoryAgentDomainRegistry } from '../platform/domain-registry.js';

const roots: string[] = [];
const previousGeneratedRoot = process.env.WEB_GENERATED_ROOT;
const previousProvider = process.env.STORY_PROJECT_REPOSITORY_PROVIDER;
const previousSqlitePath = process.env.STORY_PROJECT_SQLITE_PATH;

afterEach(async () => {
  if (previousGeneratedRoot === undefined) delete process.env.WEB_GENERATED_ROOT;
  else process.env.WEB_GENERATED_ROOT = previousGeneratedRoot;
  if (previousProvider === undefined) delete process.env.STORY_PROJECT_REPOSITORY_PROVIDER;
  else process.env.STORY_PROJECT_REPOSITORY_PROVIDER = previousProvider;
  if (previousSqlitePath === undefined) delete process.env.STORY_PROJECT_SQLITE_PATH;
  else process.env.STORY_PROJECT_SQLITE_PATH = previousSqlitePath;
  for (const root of roots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe('original_fiction production-domain boundary', () => {
  it('searches and plans without reading the china-culture knowledge base', async () => {
    const search = await originalFictionDomainPack.searchEntries({ keywords: '原创人物故事' });
    const detail = await originalFictionDomainPack.getEntryDetail(ORIGINAL_FICTION_ENTRY_NAME);
    const match = await originalFictionDomainPack.matchEntries({ query: '原创大纲', limit: 5 });
    const plan = await originalFictionDomainPack.planStory({
      entry_name: ORIGINAL_FICTION_ENTRY_NAME,
      original_user_query: '一个修复师守住旧放映机的故事',
    });

    expect(search.data?.[0]).toMatchObject({ sourceDomain: 'original_fiction', type: '原创提案' });
    expect(detail.data).toMatchObject({ sourceDomain: 'original_fiction', sources: ['用户在当前项目中提供的原创大纲'] });
    expect(match.data?.best_match).toMatchObject({ entry_name: ORIGINAL_FICTION_ENTRY_NAME, usable_for_story: true });
    expect(plan.data?.recommended_video_types.map(item => item.video_type)).toContain('character_story');
    expect(plan.data?.cultural_risks.join('\n')).toContain('不提供事实或文化背书');
  });

  it('fails closed for thin outlines and non-fictional truth modes before persistence', async () => {
    const thin = await originalFictionDomainPack.generateStory({
      outline: '主角做了选择。',
      video_type: 'character_story',
    });
    const wrongTruthMode = await originalFictionDomainPack.generateStory({
      outline: '林岚在工作室修复放映机。债主要求她当天搬走。她发现父亲留下的胶片。她决定完成首映并承担债务。',
      video_type: 'character_story',
      truth_mode: 'factual_reconstruction',
    });

    expect(thin).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(wrongTruthMode).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
  });

  it('persists only original-fiction production samples for supported production types', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-original-fiction-pack-'));
    roots.push(root);
    process.env.WEB_GENERATED_ROOT = resolve(root, 'generated');
    process.env.STORY_PROJECT_REPOSITORY_PROVIDER = 'file';
    const generated = await originalFictionDomainPack.generateStory({
      outline: [
        '顾遥在废弃站台修理一列只在午夜出现的列车',
        '列车管理员要求她在一分钟内决定是否删除乘客的旧记忆',
        '她发现待删除的记忆属于失踪多年的姐姐',
        '顾遥必须在遵守规则和追查真相之间做出选择',
        '她拒绝按下删除键并启动列车的隐藏广播',
        '广播说出下一座站台的位置，她承担被系统追捕的后果',
      ].join('。'),
      video_type: 'ai_comic_drama',
      presentation_style: 'ai_comic',
      target_video_duration: '1分钟',
      truth_mode: 'fictional_original',
    });

    expect(generated.ok).toBe(true);
    const story = generated.data!;
    expect(story.production_material_pack?.sample_entries.length).toBeGreaterThan(0);
    expect(story.production_material_pack?.sample_entries.map(item => item.entry_name))
      .toContain('零号站台——只剩一分钟的列车');
    expect(story.production_material_pack?.sample_entries.map(item => item.entry_name).join('\n'))
      .not.toMatch(/周敦颐|柳毅|屈原|岳麓书院|年画/);
    expect(story.production_material_pack?.sample_entries.every(item =>
      item.applicable_source_domains?.includes('original_fiction'),
    )).toBe(true);
    expect(story.production_material_readiness?.video_type).toBe('ai_comic_drama');
  });

  it('keeps original_fiction identity through generation, SQLite versioning, reads, GEARS and Seedance', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-original-fiction-'));
    roots.push(root);
    process.env.WEB_GENERATED_ROOT = resolve(root, 'generated');
    process.env.STORY_PROJECT_REPOSITORY_PROVIDER = 'sqlite';
    process.env.STORY_PROJECT_SQLITE_PATH = resolve(root, 'projects.sqlite3');
    const outline = [
      '林岚在旧街工作室修复一台即将被收走的放映机',
      '债主要求她当天交出工作室，她没有时间继续等待',
      '她发现放映机里藏着父亲留下的未完成胶片',
      '她必须在出售机器和完成首映之间选择',
      '林岚拒绝撤回决定并邀请街坊搭起银幕',
      '首映后她承担债务，带着工作室开始新的生活',
    ].join('。');

    const generated = await originalFictionDomainPack.generateStory({
      entry_name: ORIGINAL_FICTION_ENTRY_NAME,
      outline,
      video_type: 'character_story',
      presentation_style: 'cinematic',
      target_video_duration: '1分钟',
      story_structure: 'three_act_drama',
      truth_mode: 'fictional_original',
      output_gears_segments: true,
      character_hints: [{
        name: '林岚',
        role_position: '主角',
        character_kind: 'named_person',
        source_text: '用户原创人物',
        asset_stability: 'recurring',
      }],
    });

    expect(generated.ok).toBe(true);
    const story = generated.data!;
    expect(story).toMatchObject({
      sourceDomain: 'original_fiction',
      generation_mode: 'local_only',
      generation_used_fallback: false,
      truth_mode: 'fictional_original',
      domain_safety: {
        domain: 'original_fiction',
        passed: true,
        machine_validation_only: true,
        human_review_complete: false,
        real_credit_granted: false,
      },
    });
    expect(story.story_blueprint?.genre_beats).toHaveLength(6);
    expect(story.scene_breakdown).toHaveLength(6);
    expect(story.gears_segments).toHaveLength(6);
    expect(story.gears_delivery).toMatchObject({
      sourceDomain: 'original_fiction',
      delivery_status: 'ready',
    });
    expect(story.quality_report?.passed).toBe(true);

    const prompt = await generateProjectQualityRepairPrompt(story.project_id!, {
      include_story_json: false,
      include_markdown: false,
    });
    expect(prompt.ok).toBe(true);
    expect(prompt.data?.prompt).toContain('你是用户原创故事修复写手');
    expect(prompt.data?.prompt).toContain('用户原创大纲是唯一主素材');
    expect(prompt.data?.prompt).toContain('不产生真实作品信用');
    expect(prompt.data?.prompt).toContain('story-domain-edit-persistence/v1');
    expect(prompt.data?.prompt).toContain('domain_source_write_allowed=false');
    expect(prompt.data?.prompt).toContain('external_delivery_triggered=false');
    expect(prompt.data?.prompt).not.toContain('data/provinces');
    expect(prompt.data?.prompt).not.toContain('中国传统文化故事修复写手');

    const unsafeRepair = await applyProjectQualityRepairJson(story.project_id!, {
      repaired_story_json: JSON.stringify({
        ...story,
        scene_breakdown: story.scene_breakdown.map(scene => ({ ...scene, source_entries: [] })),
      }),
      apply: false,
      allow_no_improvement: true,
    });
    expect(unsafeRepair).toMatchObject({
      ok: false,
      error: {
        code: 'DOMAIN_SAFETY_VALIDATION_FAILED',
        details: { domain: 'original_fiction', passed: false },
      },
    });

    const repairedPlot = `${story.scene_breakdown[0].plot} 林岚把放映机的电源钥匙放到桌面中央，明确拒绝逃避。`;
    const repaired = {
      ...story,
      sourceDomain: 'china_culture',
      full_text: story.full_text.replace(story.scene_breakdown[0].plot, repairedPlot),
      scene_breakdown: story.scene_breakdown.map(scene => scene.scene_id === 1
        ? { ...scene, plot: repairedPlot, key_action: '把电源钥匙放到桌面中央并明确选择' }
        : scene),
      gears_segments: story.gears_segments.map(segment => segment.source_scene_id === 1
        ? { ...segment, script_text: `${repairedPlot}\n林岚：我不会逃避。` }
        : segment),
    };
    const repair = await applyProjectQualityRepairJson(story.project_id!, {
      repaired_story_json: JSON.stringify(repaired),
      user_instruction: '让第一场的选择动作更具体',
      apply: true,
      allow_no_improvement: true,
    });

    expect(repair.ok).toBe(true);
    expect(repair.data).toMatchObject({
      applied: true,
      can_apply: true,
      change_summary: {
        ignored_protected_field_changes: expect.arrayContaining(['sourceDomain']),
      },
    });

    const project = await getProject(story.project_id!);
    const projectList = await listProjects('original_fiction');
    const storyRead = await getStory(story.storyId);
    const storyList = await listStories(undefined, undefined, 'original_fiction');
    const registry = createStoryAgentDomainRegistry();
    const segments = await getGearsSegments(story.storyId, {
      resolve_domain_pack: domain => registry.require(domain),
    });
    const delivery = await getGearsDeliveryPackage(story.storyId);
    const seedance = await getSeedancePromptPackage(story.storyId);

    expect(project.data?.project).toMatchObject({
      source_domain: 'original_fiction',
      version_count: 2,
    });
    expect(project.data?.versions).toHaveLength(2);
    expect(project.data?.current_story).toMatchObject({
      sourceDomain: 'original_fiction',
      original_user_query: outline,
      domain_safety: { domain: 'original_fiction', passed: true },
    });
    expect(project.data?.current_story.current_version_id).not.toBe(story.current_version_id);
    expect(projectList.data?.map(item => item.project_id)).toEqual([story.project_id]);
    expect(storyRead.data?.sourceDomain).toBe('original_fiction');
    expect(storyList.data?.map(item => item.storyId)).toEqual([story.storyId]);
    expect(segments.data).toMatchObject({ sourceDomain: 'original_fiction', total_duration_sec: 60 });
    expect(segments.data?.segments.every(item => item.constraint_note.length > 0)).toBe(true);
    expect(delivery.data?.sourceDomain).toBe('original_fiction');
    expect(seedance.data?.sourceDomain).toBe('original_fiction');
    expect(seedance.data?.shot_units).toHaveLength(6);
    expect(seedance.data?.markdown).toContain('sourceDomain: original_fiction');
  });
});
