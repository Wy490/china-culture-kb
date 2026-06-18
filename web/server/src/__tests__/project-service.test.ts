import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { StoryGenerateResult, StoryProjectMeta, StoryProjectVersionSnapshot } from '@shared/types.js';
import {
  autoSelectProjectSeedanceShotVersions,
  buildProjectId,
  createProjectFromGeneratedStory,
  deleteProject,
  deleteProjects,
  exportProjectCurrentVersion,
  exportProjectProductionBoard,
  exportProjectSeedanceRetryPackage,
  getProject,
  getProjectSeedanceProviderQueueOverview,
  getProjectSeedanceProviderRetryPlan,
  getProjectProductionBoard,
  importProjectSeedanceAssetBatch,
  importProjectSeedanceProviderCallback,
  importProjectSeedanceShotCallbacks,
  listProjectSeedanceGlobalAssetLibrary,
  listProjects,
  listProjectSupplementTasks,
  pollProjectSeedanceProviderQueue,
  regenerateProjectScene,
  recoverProjectSeedanceProviderQueue,
  repairAndExportProjectProductionBoard,
  repairProjectProductionBoard,
  reuseProjectSeedanceAsset,
  retainRecentProjects,
  selectProjectSeedanceShotVersion,
  submitProjectSeedanceProviderRetryPlan,
  submitProjectSeedanceShotsToProvider,
  updateProjectSeedanceAssetLibrary,
  updateProjectSeedanceShotStatus,
  updateProjectSeedanceShotStatuses,
  updateProjectCurrentGearsWebhookStatus,
  updateProjectSupplementTask,
  uploadProjectSeedanceAssetFile,
} from '../services/project-service.js';

const TEMP_DIRS: string[] = [];
const ORIGINAL_KB_ROOT = process.env.KB_ROOT;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_ENDPOINT = process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_API_TOKEN = process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER = process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME = process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS = process.env.SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS;
const ORIGINAL_SEEDANCE_PROVIDER_CALLBACK_BASE_URL = process.env.SEEDANCE_PROVIDER_CALLBACK_BASE_URL;
const ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE = process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_ENDPOINT = process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT;
const ORIGINAL_SEEDANCE_PROVIDER_API_TOKEN = process.env.SEEDANCE_PROVIDER_API_TOKEN;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_AUTH_HEADER = process.env.SEEDANCE_PROVIDER_POLL_AUTH_HEADER;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_AUTH_SCHEME = process.env.SEEDANCE_PROVIDER_POLL_AUTH_SCHEME;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_TIMEOUT_MS = process.env.SEEDANCE_PROVIDER_POLL_TIMEOUT_MS;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_REQUEST_MODE = process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE;
const ORIGINAL_SEEDANCE_PROVIDER_POLL_HTTP_METHOD = process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD;

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function makeStory(): StoryGenerateResult {
  return {
    storyId: '20260609-story-abc1',
    title: '拒签冤案',
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '周敦颐——理学开山鼻祖',
    logline: '在一纸判词前，他选择了良知。',
    theme: '人物故事',
    full_text: '第一场原文。\n\n第二场原文。',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '雨夜开场',
        duration_sec: 30,
        location: '南安军衙',
        time_of_day: '雨夜',
        dramatic_function: '钩子开场',
        plot: '雨夜里，周敦颐看着案卷迟迟没有落笔。',
        key_action: '停笔凝视',
        characters: ['周敦颐'],
        visual_prompt: '烛火、案卷、未签的判词',
        camera_suggestion: '近景切入',
        cultural_note: '基于知识库条目',
        conflict: '签还是不签',
        dialogue_or_narration: '旁白：这一笔落下，就是一条命。',
        source_entries: ['周敦颐——理学开山鼻祖'],
      },
      {
        scene_id: 2,
        title: '正面交锋',
        duration_sec: 30,
        location: '军衙堂前',
        time_of_day: '白天',
        dramatic_function: '冲突升级',
        plot: '上官逼他签字，周敦颐却坚持重审。',
        key_action: '当面拒签',
        characters: ['周敦颐', '上官'],
        visual_prompt: '堂前对峙，案卷摊开',
        camera_suggestion: '中近景对切',
        cultural_note: '基于知识库条目',
        conflict: '权势与良知对撞',
        dialogue_or_narration: '周敦颐：此案有疑，我不能签。',
        source_entries: ['周敦颐——理学开山鼻祖'],
      },
    ],
    gears_segments: [
      {
        segment_id: 1,
        source_scene_id: 1,
        duration_sec: 30,
        panel_count: 6,
        script_text: '第一场分段',
        purpose: '钩子开场',
        visual_focus: ['南安军衙', '案卷'],
        cultural_constraints: ['基于知识库条目'],
        video_type: 'character_story',
        presentation_style: 'cinematic',
      },
      {
        segment_id: 2,
        source_scene_id: 2,
        duration_sec: 30,
        panel_count: 6,
        script_text: '第二场分段',
        purpose: '冲突升级',
        visual_focus: ['军衙堂前', '案卷'],
        cultural_constraints: ['基于知识库条目'],
        video_type: 'character_story',
        presentation_style: 'cinematic',
      },
    ],
    gears_segments_url: '/api/stories/20260609-story-abc1/gears-segments',
    cultural_constraints: ['基于知识库条目'],
    credibility_note: '基本可靠',
    story_structure: 'single_event_drama',
    model_profile_id: 'claude_sonnet',
    quality_report: {
      hasCentralEvent: true,
      hasConflict: true,
      hasProtagonistChoice: true,
      hasSceneAction: true,
      hasClimax: true,
      hasEndingTheme: true,
      isNotBiographySummary: true,
      passed: true,
      issues: [],
      video_type: 'character_story',
      story_structure: 'single_event_drama',
      genre_score: 92,
      missing_required_elements: [],
      weak_beats: [],
      forbidden_patterns_found: [],
      repair_actions: [],
    },
  };
}

afterEach(async () => {
  if (ORIGINAL_KB_ROOT === undefined) {
    delete process.env.KB_ROOT;
  } else {
    process.env.KB_ROOT = ORIGINAL_KB_ROOT;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_ENDPOINT === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_ENDPOINT;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_API_TOKEN === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_API_TOKEN;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_CALLBACK_BASE_URL === undefined) {
    delete process.env.SEEDANCE_PROVIDER_CALLBACK_BASE_URL;
  } else {
    process.env.SEEDANCE_PROVIDER_CALLBACK_BASE_URL = ORIGINAL_SEEDANCE_PROVIDER_CALLBACK_BASE_URL;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE === undefined) {
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE;
  } else {
    process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE = ORIGINAL_SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_ENDPOINT === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT = ORIGINAL_SEEDANCE_PROVIDER_POLL_ENDPOINT;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_API_TOKEN === undefined) {
    delete process.env.SEEDANCE_PROVIDER_API_TOKEN;
  } else {
    process.env.SEEDANCE_PROVIDER_API_TOKEN = ORIGINAL_SEEDANCE_PROVIDER_API_TOKEN;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_AUTH_HEADER === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_AUTH_HEADER;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_AUTH_HEADER = ORIGINAL_SEEDANCE_PROVIDER_POLL_AUTH_HEADER;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_AUTH_SCHEME === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_AUTH_SCHEME;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_AUTH_SCHEME = ORIGINAL_SEEDANCE_PROVIDER_POLL_AUTH_SCHEME;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_TIMEOUT_MS === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_TIMEOUT_MS;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_TIMEOUT_MS = ORIGINAL_SEEDANCE_PROVIDER_POLL_TIMEOUT_MS;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_REQUEST_MODE === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE = ORIGINAL_SEEDANCE_PROVIDER_POLL_REQUEST_MODE;
  }
  if (ORIGINAL_SEEDANCE_PROVIDER_POLL_HTTP_METHOD === undefined) {
    delete process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD;
  } else {
    process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD = ORIGINAL_SEEDANCE_PROVIDER_POLL_HTTP_METHOD;
  }
  vi.unstubAllGlobals();
  for (const dir of TEMP_DIRS.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('project-service', () => {
  it('creates a real project and reads it back', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');

    expect(enriched.project_id).toBe(buildProjectId(story.storyId, story.video_type));
    expect(enriched.current_version_id).toContain('-v1');

    const detail = await getProject(enriched.project_id!);
    expect(detail.ok).toBe(true);
    expect(detail.data?.project.version_count).toBe(1);
    expect(detail.data?.project.open_supplement_task_count).toBe(0);
    expect(detail.data?.project.quality_passed).toBe(true);
    expect(detail.data?.project.genre_score).toBe(92);
    expect(detail.data?.project.quality_issue_count).toBe(0);
    expect(detail.data?.versions[0].quality_passed).toBe(true);
    expect(detail.data?.versions[0].genre_score).toBe(92);
    expect(detail.data?.current_story.title).toBe(story.title);
    expect(detail.data?.project.model_profile_id).toBe('claude_sonnet');
    expect(detail.data?.current_story.model_profile_id).toBe('claude_sonnet');

    const versionPath = resolve(
      root,
      'web',
      'generated',
      'projects',
      enriched.project_id!,
      'versions',
      `${enriched.current_version_id}.json`,
    );
    const snapshot = JSON.parse(await readFile(versionPath, 'utf-8')) as StoryProjectVersionSnapshot;
    expect(snapshot.quality_report?.genre_score).toBe(92);
    expect(snapshot.quality_report?.passed).toBe(true);
  });

  it('skips unreadable project metadata when listing projects', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const brokenProjectDir = resolve(root, 'web', 'generated', 'projects', 'broken-project');
    await mkdir(brokenProjectDir, { recursive: true });
    await writeFile(resolve(brokenProjectDir, 'project.json'), '', 'utf-8');

    const res = await listProjects();

    expect(res.ok).toBe(true);
    expect(res.data?.map(project => project.project_id)).toEqual([enriched.project_id]);
  });

  it('rebuilds unreadable project metadata from source stories during migration', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const projectId = buildProjectId(story.storyId, story.video_type);
    const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
    await mkdir(storyDir, { recursive: true });
    await writeFile(
      resolve(storyDir, `${story.storyId}.json`),
      JSON.stringify({ ...story, _request_meta: { created_at: '2026-06-09T10:00:00.000Z' } }),
      'utf-8',
    );

    const brokenProjectDir = resolve(root, 'web', 'generated', 'projects', projectId);
    await mkdir(brokenProjectDir, { recursive: true });
    await writeFile(resolve(brokenProjectDir, 'project.json'), '', 'utf-8');

    const res = await listProjects();

    expect(res.ok).toBe(true);
    expect(res.data?.map(project => project.project_id)).toEqual([projectId]);
    const rebuilt = JSON.parse(await readFile(resolve(brokenProjectDir, 'project.json'), 'utf-8'));
    expect(rebuilt.title).toBe(story.title);
  });

  it('exports the current project version with markdown and marks the project exported', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const exportRes = await exportProjectCurrentVersion(enriched.project_id!);

    expect(exportRes.ok).toBe(true);
    expect(exportRes.data?.schema_version).toBe('story-project-export/v1');
    expect(exportRes.data?.project.status).toBe('exported');
    expect(exportRes.data?.summary.video_type_label).toBe('人物故事');
    expect(exportRes.data?.summary.genre_score).toBe(92);
    expect(exportRes.data?.summary.outline_coverage_score).toBe(100);
    expect(exportRes.data?.summary.pattern_quality_score).toBeGreaterThanOrEqual(0);
    expect(exportRes.data?.summary.gears_readiness_score).toBeGreaterThanOrEqual(0);
    expect(exportRes.data?.markdown).toContain('# 拒签冤案');
    expect(exportRes.data?.markdown).toContain('## 质量报告摘要');
    expect(exportRes.data?.markdown).toContain('## P0 可修复质量报告');
    expect(exportRes.data?.markdown).toContain('### Outline Coverage Report');
    expect(exportRes.data?.markdown).toContain('### Pattern Quality Report');
    expect(exportRes.data?.markdown).toContain('### GEARS Readiness Report');
    expect(exportRes.data?.markdown).toContain('## GEARS 分段');
    expect(exportRes.data?.story.storyId).toBe(story.storyId);

    const detail = await getProject(enriched.project_id!);
    expect(detail.ok).toBe(true);
    expect(detail.data?.project.status).toBe('exported');
  });

  it('builds a production board from the current project version', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const boardRes = await getProjectProductionBoard(enriched.project_id!);

    expect(boardRes.ok).toBe(true);
    expect(boardRes.data?.schema_version).toBe('story-production-board/v1');
    expect(boardRes.data?.project_id).toBe(enriched.project_id);
    expect(boardRes.data?.character_assets.length).toBeGreaterThan(0);
    expect(boardRes.data?.location_assets.length).toBeGreaterThan(0);
    expect(boardRes.data?.shot_units).toHaveLength(story.scene_breakdown.length);
    expect(boardRes.data?.shot_units[0]).toMatchObject({
      source_scene_id: 1,
      location: '南安军衙',
    });
    expect(boardRes.data?.shot_units[0].seedance_duration_sec).toBeGreaterThanOrEqual(4);
    expect(boardRes.data?.shot_units[0].seedance_duration_sec).toBeLessThanOrEqual(15);
    expect(boardRes.data?.shot_units[0].seedance_prompt).toContain('0-3秒');
    expect(boardRes.data?.shot_units[0].seedance_asset_slots.length).toBeGreaterThan(0);
    expect(boardRes.data?.shot_units[0].seedance_material_validation.prompt_complexity_score).toBeGreaterThan(0);
    expect(boardRes.data?.seedance_asset_report.total_asset_count).toBeGreaterThan(0);
    expect(boardRes.data?.seedance_asset_report.upload_required_count).toBeGreaterThan(0);
    expect(boardRes.data?.seedance_asset_report.shots[0].missing_asset_ids.length).toBeGreaterThan(0);
    expect(boardRes.data?.seedance_shot_ledger.schema_version).toBe('seedance-shot-ledger/v1');
    expect(boardRes.data?.seedance_shot_ledger.items).toHaveLength(story.scene_breakdown.length);
    expect(boardRes.data?.seedance_shot_ledger.items[0]).toMatchObject({
      shot_id: 'shot-1',
      status: 'prompt_exported',
      retry_count: 0,
    });
    expect(boardRes.data?.supervision_report.issue_count).toBeGreaterThan(0);
    expect(boardRes.data?.supervision_report.priority_fixes.length).toBeGreaterThan(0);
    expect(boardRes.data?.repair_plan.task_count).toBeGreaterThan(0);
    expect(boardRes.data?.repair_plan.tasks.map(task => task.action)).toContain('add_continuity');
    expect(boardRes.data?.delivery_manifest.stage).toBe('needs_repair');
    expect(boardRes.data?.delivery_manifest.artifacts.map(artifact => artifact.kind)).toContain('seedance_prompts');
    expect(boardRes.data?.delivery_manifest.artifacts.map(artifact => artifact.kind)).toContain('seedance_asset_report');
    expect(boardRes.data?.delivery_manifest.artifacts.map(artifact => artifact.kind)).toContain('seedance_shot_ledger');
    expect(boardRes.data?.qa_report.score).toBeGreaterThanOrEqual(0);
    expect(boardRes.data?.qa_report.issues.some(issue => issue.includes('连续性约束不足'))).toBe(true);
    expect(boardRes.data?.markdown).toContain('## 镜头单元');
    expect(boardRes.data?.markdown).toContain('## 监督检查');
    expect(boardRes.data?.markdown).toContain('## 生产修复包');
    expect(boardRes.data?.markdown).toContain('## 交付清单');
    expect(boardRes.data?.markdown).toContain('## Seedance 素材缺口');
    expect(boardRes.data?.markdown).toContain('## Seedance Shot Ledger');
    expect(boardRes.data?.markdown).toContain('Seedance');
    expect(boardRes.data?.markdown).toContain('Seedance 素材 slot');

    const bindableAsset = boardRes.data!.seedance_asset_report.assets.find(asset => asset.status === 'missing_file');
    expect(bindableAsset).toBeTruthy();
    const updateRes = await updateProjectSeedanceAssetLibrary(enriched.project_id!, {
      items: [{
        asset_id: bindableAsset!.asset_id,
        kind: bindableAsset!.kind,
        label: bindableAsset!.label,
        modality: bindableAsset!.modality,
        role: bindableAsset!.role,
        reference_slot: bindableAsset!.reference_slot,
        file_url: 'https://example.com/seedance-assets/asset-001.png',
        description: '测试绑定素材',
      }],
    });
    expect(updateRes.ok).toBe(true);
    expect(updateRes.data?.project.seedance_asset_library?.items[0]).toMatchObject({
      asset_id: bindableAsset!.asset_id,
      file_url: 'https://example.com/seedance-assets/asset-001.png',
      history: [expect.objectContaining({
        event_type: 'manual_bind',
        file_url: 'https://example.com/seedance-assets/asset-001.png',
      })],
    });
    const boundBoardRes = await getProjectProductionBoard(enriched.project_id!);
    expect(boundBoardRes.ok).toBe(true);
    expect(boundBoardRes.data?.seedance_asset_report.assets.find(asset =>
      asset.asset_id === bindableAsset!.asset_id
    )).toMatchObject({
      status: 'bound',
      is_bound: true,
      needs_upload: false,
      file_url: 'https://example.com/seedance-assets/asset-001.png',
    });
    const batchAsset = boundBoardRes.data!.seedance_asset_report.assets.find(asset => asset.status === 'missing_file');
    expect(batchAsset).toBeTruthy();
    const batchImportRes = await importProjectSeedanceAssetBatch(enriched.project_id!, {
      source_note: '测试批量导入素材清单',
      items: [{
        asset_id: batchAsset!.asset_id,
        provider: 'seedance',
        provider_asset_id: 'seedance-provider-asset-002',
        upload_status: 'uploaded',
        local_path: '/tmp/seedance-assets/asset-002.png',
      }, {
        asset_id: 'missing-asset',
        upload_status: 'pending_upload',
      }],
    });
    expect(batchImportRes.ok).toBe(true);
    expect(batchImportRes.data?.imported_count).toBe(1);
    expect(batchImportRes.data?.matched_existing_count).toBe(1);
    expect(batchImportRes.data?.skipped_count).toBe(1);
    expect(batchImportRes.data?.updated_asset_ids).toContain(batchAsset!.asset_id);
    expect(batchImportRes.data?.detail.project.seedance_asset_library?.items.find(asset =>
      asset.asset_id === batchAsset!.asset_id
    )?.history).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event_type: 'batch_import',
        provider_asset_id: 'seedance-provider-asset-002',
        note: '测试批量导入素材清单',
      }),
    ]));
    const batchBoardRes = await getProjectProductionBoard(enriched.project_id!);
    expect(batchBoardRes.ok).toBe(true);
    expect(batchBoardRes.data?.seedance_asset_report.assets.find(asset =>
      asset.asset_id === batchAsset!.asset_id
    )).toMatchObject({
      status: 'bound',
      is_bound: true,
      needs_upload: false,
      provider: 'seedance',
      provider_asset_id: 'seedance-provider-asset-002',
      upload_status: 'uploaded',
    });
    const uploadAsset = batchBoardRes.data!.seedance_asset_report.assets.find(asset => asset.status === 'missing_file');
    expect(uploadAsset).toBeTruthy();
    const uploadRes = await uploadProjectSeedanceAssetFile(enriched.project_id!, {
      asset_id: uploadAsset!.asset_id,
      label: uploadAsset!.label,
      kind: uploadAsset!.kind,
      modality: uploadAsset!.modality,
      role: uploadAsset!.role,
      reference_slot: uploadAsset!.reference_slot,
      description: uploadAsset!.prompt_usage,
      file: {
        original_filename: 'seedance-upload-test.png',
        mime_type: 'image/png',
        buffer: Buffer.from('seedance-upload-binary'),
      },
    });
    expect(uploadRes.ok).toBe(true);
    expect(uploadRes.data?.asset).toMatchObject({
      asset_id: uploadAsset!.asset_id,
      original_filename: 'seedance-upload-test.png',
      mime_type: 'image/png',
      size_bytes: Buffer.from('seedance-upload-binary').length,
      provider: 'local_upload',
      upload_status: 'uploaded',
      history: [expect.objectContaining({
        event_type: 'file_upload',
        original_filename: 'seedance-upload-test.png',
      })],
    });
    expect(uploadRes.data?.local_path).toContain(`projects/${enriched.project_id}/seedance-assets/uploads/`);
    const uploadedFilePath = resolve(root, 'web', 'generated', uploadRes.data!.local_path);
    expect(await readFile(uploadedFilePath, 'utf-8')).toBe('seedance-upload-binary');
    const uploadBoardRes = await getProjectProductionBoard(enriched.project_id!);
    expect(uploadBoardRes.ok).toBe(true);
    expect(uploadBoardRes.data?.seedance_asset_report.assets.find(asset =>
      asset.asset_id === uploadAsset!.asset_id
    )).toMatchObject({
      status: 'bound',
      is_bound: true,
      needs_upload: false,
      provider: 'local_upload',
      upload_status: 'uploaded',
      original_filename: 'seedance-upload-test.png',
    });

    const targetStory: StoryGenerateResult = {
      ...story,
      storyId: '20260609-story-reuse',
      title: '拒签冤案复用目标',
      gears_segments_url: '/api/stories/20260609-story-reuse/gears-segments',
    };
    const targetProject = await createProjectFromGeneratedStory(targetStory, '2026-06-09T10:30:00.000Z');
    const globalLibraryRes = await listProjectSeedanceGlobalAssetLibrary(targetProject.project_id!);
    expect(globalLibraryRes.ok).toBe(true);
    const reusableAsset = globalLibraryRes.data?.items.find(asset =>
      asset.source_project_id === enriched.project_id && asset.source_asset_id === uploadAsset!.asset_id
    );
    expect(reusableAsset).toMatchObject({
      provider: 'local_upload',
      upload_status: 'uploaded',
      original_filename: 'seedance-upload-test.png',
    });
    const targetBoardRes = await getProjectProductionBoard(targetProject.project_id!);
    const targetAsset = targetBoardRes.data?.seedance_asset_report.assets.find(asset =>
      asset.asset_id === uploadAsset!.asset_id
    );
    expect(targetAsset).toMatchObject({
      status: 'missing_file',
      is_bound: false,
    });
    const reuseRes = await reuseProjectSeedanceAsset(targetProject.project_id!, {
      source_project_id: enriched.project_id!,
      source_asset_id: uploadAsset!.asset_id,
      target_asset_id: targetAsset!.asset_id,
      target_label: targetAsset!.label,
      target_kind: targetAsset!.kind,
      reference_slot: targetAsset!.reference_slot,
      description: targetAsset!.prompt_usage,
    });
    expect(reuseRes.ok).toBe(true);
    expect(reuseRes.data?.reused_asset).toMatchObject({
      asset_id: targetAsset!.asset_id,
      label: targetAsset!.label,
      provider: 'local_upload',
      upload_status: 'uploaded',
      original_filename: 'seedance-upload-test.png',
      history: [expect.objectContaining({
        event_type: 'cross_project_reuse',
        source_project_id: enriched.project_id,
        source_asset_id: uploadAsset!.asset_id,
      })],
    });
    const reusedBoardRes = await getProjectProductionBoard(targetProject.project_id!);
    expect(reusedBoardRes.data?.seedance_asset_report.assets.find(asset =>
      asset.asset_id === targetAsset!.asset_id
    )).toMatchObject({
      status: 'bound',
      is_bound: true,
      needs_upload: false,
      provider: 'local_upload',
      upload_status: 'uploaded',
      original_filename: 'seedance-upload-test.png',
    });

    const shotStatusRes = await updateProjectSeedanceShotStatus(enriched.project_id!, {
      shot_id: 'shot-1',
      status: 'ready',
      provider_job_id: 'seedance-job-001',
      video_url: 'https://example.com/seedance-videos/shot-1.mp4',
      quality_score: 88,
      review_note: '回片可用',
      note: '测试回片',
    });
    expect(shotStatusRes.ok).toBe(true);
    expect(shotStatusRes.data?.project.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'ready',
      provider_job_id: 'seedance-job-001',
      video_url: 'https://example.com/seedance-videos/shot-1.mp4',
      retry_count: 0,
      selected_version_id: 'seedance-shot-shot-1-v1',
    });
    const shotBoardRes = await getProjectProductionBoard(enriched.project_id!);
    expect(shotBoardRes.data?.seedance_shot_ledger.items.find(item =>
      item.shot_id === 'shot-1'
    )?.versions[0]).toMatchObject({
      status: 'ready',
      provider_job_id: 'seedance-job-001',
      video_url: 'https://example.com/seedance-videos/shot-1.mp4',
      quality_score: 88,
      review_note: '回片可用',
    });

    const submittedRes = await updateProjectSeedanceShotStatus(enriched.project_id!, {
      shot_id: 'shot-2',
      status: 'submitted',
      provider_job_id: 'seedance-job-002',
      note: '提交第二镜头',
    });
    expect(submittedRes.ok).toBe(true);

    const importRes = await importProjectSeedanceShotCallbacks(enriched.project_id!, {
      callbacks: [{
        job_id: 'seedance-job-002',
        status: 'success',
        url: 'https://example.com/seedance-videos/shot-2.mp4',
        qualityScore: 92,
        reviewNote: '导入回片可用',
        message: '平台回传成功',
      }],
    });
    expect(importRes.ok).toBe(true);
    expect(importRes.data?.updated_count).toBe(1);
    expect(importRes.data?.failed_count).toBe(0);
    expect(importRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'ready',
      provider_job_id: 'seedance-job-002',
      video_url: 'https://example.com/seedance-videos/shot-2.mp4',
      selected_version_id: 'seedance-shot-shot-2-v2',
    });

    const failedRes = await updateProjectSeedanceShotStatus(enriched.project_id!, {
      shot_id: 'shot-2',
      status: 'failed',
      provider_job_id: 'seedance-job-003',
      failure_reason: '人物手部变形',
      increment_retry: true,
      note: '重试失败',
    });
    expect(failedRes.ok).toBe(true);
    const retryPackageRes = await exportProjectSeedanceRetryPackage(enriched.project_id!);
    expect(retryPackageRes.ok).toBe(true);
    expect(retryPackageRes.data?.schema_version).toBe('story-seedance-retry-package/v1');
    expect(retryPackageRes.data?.total_retry_shot_count).toBe(1);
    expect(retryPackageRes.data?.skipped_ready_shot_count).toBe(1);
    expect(retryPackageRes.data?.shots[0]).toMatchObject({
      shot_id: 'shot-2',
      status: 'failed',
      failure_reason: '人物手部变形',
      provider_job_id: 'seedance-job-003',
      retry_count: 1,
    });
    expect(retryPackageRes.data?.shots[0].prompt.seedance_prompt).toContain('0-3秒');
    expect(retryPackageRes.data?.markdown).toContain('Seedance 重试提交包');
    expect(retryPackageRes.data?.markdown).toContain('人物手部变形');

    const providerSubmitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-2'],
      provider: 'seedance',
      job_prefix: 'seedance-provider-submit-test',
      queue_id: 'seedance-provider-queue-test-001',
      queue_priority: 'high',
      note: '测试 provider 提交',
    });
    expect(providerSubmitRes.ok).toBe(true);
    expect(providerSubmitRes.data?.submitted_count).toBe(1);
    expect(providerSubmitRes.data?.skipped_count).toBe(0);
    expect(providerSubmitRes.data?.provider_queue_batch).toMatchObject({
      queue_id: 'seedance-provider-queue-test-001',
      provider: 'seedance',
      priority: 'high',
      submitted_count: 1,
      skipped_count: 0,
      failed_count: 0,
      items: [{
        shot_id: 'shot-2',
        provider_job_id: 'seedance-provider-submit-test-shot-2',
        queue_position: 1,
        status: 'submitted',
      }],
    });
    expect(providerSubmitRes.data?.project.seedance_provider_queue).toMatchObject({
      schema_version: 'seedance-provider-queue/v1',
      latest_queue_id: 'seedance-provider-queue-test-001',
    });
    expect(providerSubmitRes.data?.submitted_shots[0]).toMatchObject({
      shot_id: 'shot-2',
      provider_job_id: 'seedance-provider-submit-test-shot-2',
      provider_queue_id: 'seedance-provider-queue-test-001',
      provider_queue_position: 1,
      status: 'submitted',
    });
    expect(providerSubmitRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'submitted',
      provider: 'seedance',
      provider_job_id: 'seedance-provider-submit-test-shot-2',
      provider_queue_id: 'seedance-provider-queue-test-001',
      provider_queue_position: 1,
      retry_count: 2,
    });
    const providerSubmitAgainRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-2'],
      provider: 'seedance',
      job_prefix: 'seedance-provider-submit-again',
    });
    expect(providerSubmitAgainRes.ok).toBe(true);
    expect(providerSubmitAgainRes.data?.submitted_count).toBe(0);
    expect(providerSubmitAgainRes.data?.skipped_count).toBe(1);

    const projectFile = resolve(root, 'web', 'generated', 'projects', enriched.project_id!, 'project.json');
    const staleProject = JSON.parse(await readFile(projectFile, 'utf8')) as StoryProjectMeta;
    staleProject.seedance_shot_ledger = {
      ...staleProject.seedance_shot_ledger!,
      items: staleProject.seedance_shot_ledger!.items.map(item =>
        item.shot_id === 'shot-2'
          ? {
              ...item,
              submitted_at: '2026-06-09T10:00:00.000Z',
              updated_at: '2026-06-09T10:00:00.000Z',
            }
          : item
      ),
    };
    await writeFile(projectFile, JSON.stringify(staleProject, null, 2));
    const providerRecoveryDryRunRes = await recoverProjectSeedanceProviderQueue(enriched.project_id!, {
      timeout_minutes: 60,
    });
    expect(providerRecoveryDryRunRes.ok).toBe(true);
    expect(providerRecoveryDryRunRes.data).toMatchObject({
      dry_run: true,
      timeout_minutes: 60,
      checked_count: 1,
      timed_out_count: 1,
      updated_count: 0,
      timed_out_shots: [{
        shot_id: 'shot-2',
        provider_job_id: 'seedance-provider-submit-test-shot-2',
        provider_queue_id: 'seedance-provider-queue-test-001',
      }],
    });
    const providerRecoveryRes = await recoverProjectSeedanceProviderQueue(enriched.project_id!, {
      timeout_minutes: 60,
      mark_timed_out_failed: true,
      note: '测试 provider 超时恢复',
    });
    expect(providerRecoveryRes.ok).toBe(true);
    expect(providerRecoveryRes.data).toMatchObject({
      dry_run: false,
      timed_out_count: 1,
      updated_count: 1,
    });
    expect(providerRecoveryRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'failed',
      provider_job_id: 'seedance-provider-submit-test-shot-2',
      provider_queue_id: 'seedance-provider-queue-test-001',
      failure_reason: 'Provider task timed out after 60 minutes',
    });

    const selectRes = await selectProjectSeedanceShotVersion(enriched.project_id!, {
      shot_id: 'shot-2',
      version_id: 'seedance-shot-shot-2-v2',
      note: '人工选择第二版',
    });
    expect(selectRes.ok).toBe(true);
    const selectedShotTwo = selectRes.data?.project.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    );
    expect(selectedShotTwo).toMatchObject({
      status: 'ready',
      video_url: 'https://example.com/seedance-videos/shot-2.mp4',
      selected_version_id: 'seedance-shot-shot-2-v2',
    });
    expect(selectedShotTwo?.failure_reason).toBeUndefined();

    const betterVersionRes = await updateProjectSeedanceShotStatus(enriched.project_id!, {
      shot_id: 'shot-2',
      status: 'ready',
      provider_job_id: 'seedance-job-004',
      video_url: 'https://example.com/seedance-videos/shot-2-v4.mp4',
      quality_score: 98,
      review_note: '自动择优候选',
      note: '更高分回片',
    });
    expect(betterVersionRes.ok).toBe(true);
    expect(betterVersionRes.data?.project.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )?.selected_version_id).toBe('seedance-shot-shot-2-v2');

    const protectedAutoSelectRes = await autoSelectProjectSeedanceShotVersions(enriched.project_id!, {
      min_quality_score: 95,
    });
    expect(protectedAutoSelectRes.ok).toBe(true);
    expect(protectedAutoSelectRes.data?.project.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )?.selected_version_id).toBe('seedance-shot-shot-2-v2');

    const autoSelectRes = await autoSelectProjectSeedanceShotVersions(enriched.project_id!, {
      min_quality_score: 95,
      overwrite_manual: true,
      note: '覆盖人工选择进行自动择优',
    });
    expect(autoSelectRes.ok).toBe(true);
    expect(autoSelectRes.data?.project.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'ready',
      video_url: 'https://example.com/seedance-videos/shot-2-v4.mp4',
      selected_version_id: 'seedance-shot-shot-2-v6',
    });

    const batchRes = await updateProjectSeedanceShotStatuses(enriched.project_id!, {
      updates: [
        { shot_id: 'shot-1', status: 'processing', note: '批量标记处理中' },
        { shot_id: 'missing-shot', status: 'failed', failure_reason: '不存在的镜头' },
      ],
    });
    expect(batchRes.ok).toBe(true);
    expect(batchRes.data).toMatchObject({
      updated_count: 1,
      failed_count: 1,
    });
    expect(batchRes.data?.failures[0]).toMatchObject({
      index: 1,
      shot_id: 'missing-shot',
    });
    expect(batchRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'processing',
    });
  });

  it('submits Seedance shots through a configured provider adapter', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');
    process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT = 'https://adapter.example.test/seedance/submit';
    process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN = 'submit-token';
    process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER = 'X-Api-Key';
    process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME = 'raw';
    process.env.SEEDANCE_PROVIDER_CALLBACK_BASE_URL = 'https://story.example.test/root/';

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitFetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe('https://adapter.example.test/seedance/submit');
      expect(init?.method).toBe('POST');
      expect((init?.headers as Record<string, string>)['X-Api-Key']).toBe('submit-token');
      expect((init?.headers as Record<string, string>).authorization).toBeUndefined();
      const body = JSON.parse(String(init?.body)) as {
        project_id: string;
        provider?: string;
        queue_id?: string;
        queue_priority?: string;
        provider_callback_path?: string;
        provider_poll_path?: string;
        provider_callback_url?: string;
        provider_poll_url?: string;
        shots: Array<{ shot_id: string; provider_job_id?: string; seedance_prompt?: string; seedance_asset_slots?: unknown[] }>;
      };
      expect(body.project_id).toBe(enriched.project_id);
      expect(body.provider).toBe('seedance');
      expect(body.queue_id).toBe('adapter-submit-queue-local');
      expect(body.queue_priority).toBe('high');
      expect(body.provider_callback_path).toBe(
        `/api/projects/${enriched.project_id}/production-board/seedance-shots/provider-callback`,
      );
      expect(body.provider_poll_path).toBe(
        `/api/projects/${enriched.project_id}/production-board/seedance-shots/poll-provider`,
      );
      expect(body.provider_callback_url).toBe(
        `https://story.example.test/root/api/projects/${enriched.project_id}/production-board/seedance-shots/provider-callback`,
      );
      expect(body.provider_poll_url).toBe(
        `https://story.example.test/root/api/projects/${enriched.project_id}/production-board/seedance-shots/poll-provider`,
      );
      expect(body.shots).toHaveLength(2);
      expect(body.shots[0]).toMatchObject({
        shot_id: 'shot-1',
        provider_job_id: 'adapter-submit-local-shot-1',
      });
      expect(body.shots[0].seedance_prompt).toContain('0-3秒');
      expect(body.shots[0].seedance_asset_slots).toBeInstanceOf(Array);
      return new Response(JSON.stringify({
        data: {
          tasks: [{
            shot_id: 'shot-1',
            taskId: 'real-seedance-job-shot-1',
            batchId: 'real-seedance-queue-001',
            position: 11,
            taskStatus: 'running',
          }, {
            shot_id: 'shot-2',
            task_id: 'real-seedance-job-shot-2',
            batch_id: 'real-seedance-queue-001',
            position: 12,
            task_status: 'queued',
          }],
        },
      }));
    });
    vi.stubGlobal('fetch', submitFetchMock);

    const adapterSubmitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'adapter-submit-local',
      queue_id: 'adapter-submit-queue-local',
      queue_priority: 'high',
      use_provider_adapter: true,
      note: '真实 adapter 提交',
    });
    expect(submitFetchMock).toHaveBeenCalledTimes(1);
    expect(adapterSubmitRes.ok).toBe(true);
    expect(adapterSubmitRes.data).toMatchObject({
      submitted_count: 2,
      skipped_count: 0,
      failed_count: 0,
      provider_adapter: {
        endpoint_configured: true,
        requested_count: 2,
        accepted_count: 2,
        failed_count: 0,
      },
    });
    expect(adapterSubmitRes.data?.provider_queue_batch).toMatchObject({
      queue_id: 'real-seedance-queue-001',
      provider: 'seedance',
      priority: 'high',
      items: [{
        shot_id: 'shot-1',
        provider_job_id: 'real-seedance-job-shot-1',
        queue_position: 11,
        status: 'processing',
      }, {
        shot_id: 'shot-2',
        provider_job_id: 'real-seedance-job-shot-2',
        queue_position: 12,
        status: 'submitted',
      }],
    });
    expect(adapterSubmitRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'processing',
      provider_job_id: 'real-seedance-job-shot-1',
      provider_queue_id: 'real-seedance-queue-001',
      provider_queue_position: 11,
    });
  });

  it('submits Seedance shots through a per-shot provider adapter', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');
    process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT = 'https://adapter.example.test/seedance/submit-one';
    process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE = 'per_shot';

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitFetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe('https://adapter.example.test/seedance/submit-one');
      const body = JSON.parse(String(init?.body)) as {
        request_mode?: string;
        shot?: { shot_id: string; provider_job_id?: string };
        shots?: Array<{ shot_id: string; provider_job_id?: string }>;
      };
      expect(body.request_mode).toBe('per_shot');
      expect(body.shot).toBeDefined();
      expect(body.shots).toHaveLength(1);
      if (body.shot?.shot_id === 'shot-1') {
        return new Response(JSON.stringify({
          taskId: 'real-per-shot-job-1',
          batchId: 'real-per-shot-queue',
          taskStatus: 'running',
        }));
      }
      return new Response(JSON.stringify({
        data: {
          task_id: 'real-per-shot-job-2',
          batch_id: 'real-per-shot-queue',
          task_status: 'queued',
        },
      }));
    });
    vi.stubGlobal('fetch', submitFetchMock);

    const adapterSubmitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'adapter-submit-local',
      queue_id: 'adapter-submit-queue-local',
      use_provider_adapter: true,
      note: '逐镜头 adapter 提交',
    });

    expect(submitFetchMock).toHaveBeenCalledTimes(2);
    expect(adapterSubmitRes.ok).toBe(true);
    expect(adapterSubmitRes.data).toMatchObject({
      submitted_count: 2,
      failed_count: 0,
      provider_adapter: {
        request_mode: 'per_shot',
        requested_count: 2,
        accepted_count: 2,
        failed_count: 0,
      },
      submitted_shots: [{
        shot_id: 'shot-1',
        provider_job_id: 'real-per-shot-job-1',
      }, {
        shot_id: 'shot-2',
        provider_job_id: 'real-per-shot-job-2',
      }],
    });
  });

  it('imports an external Seedance provider callback by queue metadata', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1'],
      provider: 'seedance',
      job_prefix: 'provider-callback-test',
      queue_id: 'provider-callback-queue-001',
      queue_priority: 'high',
      note: 'provider callback 测试提交',
    });
    expect(submitRes.ok).toBe(true);
    expect(submitRes.data?.submitted_count).toBe(1);

    const callbackRes = await importProjectSeedanceProviderCallback(enriched.project_id!, {
      provider: 'seedance',
      queueId: 'provider-callback-queue-001',
      queuePosition: 1,
      status: 'completed',
      videoUrl: 'https://example.com/seedance-videos/provider-callback-shot-1.mp4',
      qualityScore: 94,
      reviewNote: 'provider webhook 回片可用',
      event_id: 'provider-event-001',
      message: 'provider completed',
    });
    expect(callbackRes.ok).toBe(true);
    expect(callbackRes.data).toMatchObject({
      updated_count: 1,
      failed_count: 0,
      provider: 'seedance',
      provider_queue_id: 'provider-callback-queue-001',
      provider_queue_position: 1,
      event_id: 'provider-event-001',
    });
    expect(callbackRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'ready',
      provider: 'seedance',
      provider_job_id: 'provider-callback-test-shot-1',
      provider_queue_id: 'provider-callback-queue-001',
      provider_queue_position: 1,
      video_url: 'https://example.com/seedance-videos/provider-callback-shot-1.mp4',
      selected_version_id: 'seedance-shot-shot-1-v2',
    });
  });

  it('polls Seedance provider targets and applies returned status snapshots', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'provider-poll-test',
      queue_id: 'provider-poll-queue-001',
      note: 'provider poll 测试提交',
    });
    expect(submitRes.ok).toBe(true);

    const dryRunRes = await pollProjectSeedanceProviderQueue(enriched.project_id!, {
      provider: 'seedance',
      queue_id: 'provider-poll-queue-001',
      include_prompt: true,
    });
    expect(dryRunRes.ok).toBe(true);
    expect(dryRunRes.data).toMatchObject({
      dry_run: true,
      provider: 'seedance',
      queue_id: 'provider-poll-queue-001',
      checked_count: 2,
      pollable_count: 2,
      updated_count: 0,
    });
    expect(dryRunRes.data?.poll_targets[0]).toMatchObject({
      shot_id: 'shot-1',
      provider_job_id: 'provider-poll-test-shot-1',
      provider_queue_id: 'provider-poll-queue-001',
      provider_queue_position: 1,
      status: 'submitted',
    });
    expect(dryRunRes.data?.poll_targets[0].seedance_prompt).toContain('0-3秒');

    const pollApplyRes = await pollProjectSeedanceProviderQueue(enriched.project_id!, {
      provider: 'seedance',
      queue_id: 'provider-poll-queue-001',
      provider_results: [{
        jobId: 'provider-poll-test-shot-1',
        status: 'success',
        url: 'https://example.com/seedance-videos/provider-poll-shot-1.mp4',
        qualityScore: 95,
        reviewNote: 'poll 回片可用',
        message: 'provider poll completed',
      }, {
        jobId: 'provider-poll-test-shot-2',
        status: 'failed',
        errorCode: 'RATE_LIMIT_429',
        error: '平台限流，请稍后重试',
        message: 'provider rate limited',
      }],
      note: 'provider poll 应用回传',
    });
    expect(pollApplyRes.ok).toBe(true);
    expect(pollApplyRes.data).toMatchObject({
      dry_run: false,
      provider: 'seedance',
      queue_id: 'provider-poll-queue-001',
      checked_count: 2,
      pollable_count: 0,
      updated_count: 2,
      failed_count: 0,
      poll_targets: [],
    });
    expect(pollApplyRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'ready',
      provider: 'seedance',
      provider_job_id: 'provider-poll-test-shot-1',
      provider_queue_id: 'provider-poll-queue-001',
      video_url: 'https://example.com/seedance-videos/provider-poll-shot-1.mp4',
      selected_version_id: 'seedance-shot-shot-1-v2',
    });
    expect(pollApplyRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'failed',
      provider: 'seedance',
      provider_job_id: 'provider-poll-test-shot-2',
      provider_queue_id: 'provider-poll-queue-001',
      failure_reason: '平台限流，请稍后重试',
      failure_category: 'provider_rate_limit',
      provider_error_code: 'RATE_LIMIT_429',
    });

    const retryPackageRes = await exportProjectSeedanceRetryPackage(enriched.project_id!);
    expect(retryPackageRes.ok).toBe(true);
    expect(retryPackageRes.data?.shots.find(shot => shot.shot_id === 'shot-2')).toMatchObject({
      failure_reason: '平台限流，请稍后重试',
      failure_category: 'provider_rate_limit',
      provider_error_code: 'RATE_LIMIT_429',
      suggested_action: '等待限流窗口恢复后再重新提交。',
    });
    expect(retryPackageRes.data?.markdown).toContain('失败分类: provider_rate_limit');
    expect(retryPackageRes.data?.markdown).toContain('Provider 错误码: RATE_LIMIT_429');
  });

  it('maps provider error code aliases into failure categories', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'provider-code-map-test',
      queue_id: 'provider-code-map-queue-001',
      note: 'provider 错误码映射测试提交',
    });
    expect(submitRes.ok).toBe(true);

    const callbackRes = await importProjectSeedanceShotCallbacks(enriched.project_id!, {
      callbacks: [{
        jobId: 'provider-code-map-test-shot-1',
        status: 'failed',
        errorCode: 'INSUFFICIENT_BALANCE',
        error: 'provider failed',
      }, {
        jobId: 'provider-code-map-test-shot-2',
        status: 'failed',
        errorCode: 'TOKEN_EXPIRED',
        error: 'provider failed',
      }],
    });
    expect(callbackRes.ok).toBe(true);
    expect(callbackRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'failed',
      failure_category: 'provider_quota',
      provider_error_code: 'INSUFFICIENT_BALANCE',
    });
    expect(callbackRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'failed',
      failure_category: 'provider_auth',
      provider_error_code: 'TOKEN_EXPIRED',
    });

    const retryPackageRes = await exportProjectSeedanceRetryPackage(enriched.project_id!);
    expect(retryPackageRes.ok).toBe(true);
    expect(retryPackageRes.data?.shots.find(shot => shot.shot_id === 'shot-1')).toMatchObject({
      failure_category: 'provider_quota',
      suggested_action: '先确认 provider 额度或余额，再重新提交。',
    });
    expect(retryPackageRes.data?.shots.find(shot => shot.shot_id === 'shot-2')).toMatchObject({
      failure_category: 'provider_auth',
      suggested_action: '先检查 provider 凭证和权限配置，再重新提交。',
    });
  });

  it('builds a Seedance provider queue overview with timeout and failure summaries', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'provider-overview-test',
      queue_id: 'provider-overview-queue-001',
      queue_priority: 'high',
      note: 'provider overview 测试提交',
    });
    expect(submitRes.ok).toBe(true);

    const callbackRes = await importProjectSeedanceShotCallbacks(enriched.project_id!, {
      callbacks: [{
        jobId: 'provider-overview-test-shot-2',
        status: 'failed',
        errorCode: 'RATE_LIMIT_429',
        error: '平台限流，请稍后重试',
      }],
    });
    expect(callbackRes.ok).toBe(true);

    const projectFile = resolve(root, 'web', 'generated', 'projects', enriched.project_id!, 'project.json');
    const staleProject = JSON.parse(await readFile(projectFile, 'utf8')) as StoryProjectMeta;
    staleProject.seedance_shot_ledger = {
      ...staleProject.seedance_shot_ledger!,
      items: staleProject.seedance_shot_ledger!.items.map(item =>
        item.shot_id === 'shot-1'
          ? {
              ...item,
              submitted_at: '2026-06-09T10:00:00.000Z',
              updated_at: '2026-06-09T10:00:00.000Z',
            }
          : item
      ),
    };
    await writeFile(projectFile, JSON.stringify(staleProject, null, 2));

    const overviewRes = await getProjectSeedanceProviderQueueOverview(enriched.project_id!, {
      provider: 'seedance',
      queue_id: 'provider-overview-queue-001',
      timeout_minutes: 60,
    });
    expect(overviewRes.ok).toBe(true);
    expect(overviewRes.data).toMatchObject({
      provider: 'seedance',
      queue_id: 'provider-overview-queue-001',
      timeout_minutes: 60,
      total_shot_count: 2,
      active_count: 1,
      failed_count: 1,
      retryable_count: 2,
      timed_out_count: 1,
      attention_count: 2,
      batch_count: 1,
      status_counts: {
        submitted: 1,
        failed: 1,
      },
      latest_queue_batch: {
        queue_id: 'provider-overview-queue-001',
        provider: 'seedance',
        priority: 'high',
        active_count: 1,
        failed_item_count: 1,
        timed_out_count: 1,
      },
    });
    expect(overviewRes.data?.attention_items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        shot_id: 'shot-1',
        status: 'submitted',
        timed_out: true,
        suggested_action: '确认平台任务是否超时；如无结果则重新提交。',
      }),
      expect.objectContaining({
        shot_id: 'shot-2',
        status: 'failed',
        failure_category: 'provider_rate_limit',
        provider_error_code: 'RATE_LIMIT_429',
        suggested_action: '等待限流窗口恢复后再重新提交。',
      }),
    ]));
  });

  it('builds a Seedance provider retry plan with resubmit and blocked candidates', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'provider-retry-plan-test',
      queue_id: 'provider-retry-plan-queue-001',
      note: 'provider retry plan 测试提交',
    });
    expect(submitRes.ok).toBe(true);

    const callbackRes = await importProjectSeedanceShotCallbacks(enriched.project_id!, {
      callbacks: [{
        jobId: 'provider-retry-plan-test-shot-2',
        status: 'failed',
        errorCode: 'ASSET_MISSING',
        error: '缺少参考素材文件',
      }],
    });
    expect(callbackRes.ok).toBe(true);

    const projectFile = resolve(root, 'web', 'generated', 'projects', enriched.project_id!, 'project.json');
    const staleProject = JSON.parse(await readFile(projectFile, 'utf8')) as StoryProjectMeta;
    staleProject.seedance_shot_ledger = {
      ...staleProject.seedance_shot_ledger!,
      items: staleProject.seedance_shot_ledger!.items.map(item =>
        item.shot_id === 'shot-1'
          ? {
              ...item,
              submitted_at: '2026-06-09T10:00:00.000Z',
              updated_at: '2026-06-09T10:00:00.000Z',
            }
          : item
      ),
    };
    await writeFile(projectFile, JSON.stringify(staleProject, null, 2));

    const retryPlanRes = await getProjectSeedanceProviderRetryPlan(enriched.project_id!, {
      provider: 'seedance',
      queue_id: 'provider-retry-plan-queue-001',
      timeout_minutes: 60,
      max_retry_count: 3,
    });
    expect(retryPlanRes.ok).toBe(true);
    expect(retryPlanRes.data).toMatchObject({
      provider: 'seedance',
      queue_id: 'provider-retry-plan-queue-001',
      timeout_minutes: 60,
      max_retry_count: 3,
      candidate_count: 2,
      resubmittable_count: 1,
      blocked_count: 1,
      high_priority_count: 1,
      reason_counts: {
        failed: 1,
        timed_out: 1,
        ready_missing_video: 0,
        unsubmitted: 0,
      },
    });
    expect(retryPlanRes.data?.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        shot_id: 'shot-1',
        retry_reason: 'timed_out',
        priority: 'high',
        can_resubmit: true,
      }),
      expect.objectContaining({
        shot_id: 'shot-2',
        retry_reason: 'failed',
        priority: 'normal',
        failure_category: 'asset_missing',
        provider_error_code: 'ASSET_MISSING',
        can_resubmit: false,
        block_reason: '素材缺失，补齐或重新绑定素材后再提交。',
      }),
    ]));
    expect(retryPlanRes.data?.markdown).toContain('Seedance provider 人工重试策略');
    expect(retryPlanRes.data?.markdown).toContain('可直接重提: 1');

    const retrySubmitRes = await submitProjectSeedanceProviderRetryPlan(enriched.project_id!, {
      provider: 'seedance',
      queue_id: 'provider-retry-plan-queue-001',
      target_queue_id: 'provider-retry-plan-resubmit-001',
      job_prefix: 'provider-retry-resubmit',
      timeout_minutes: 60,
      max_retry_count: 3,
      note: 'provider retry plan 自动重提交',
    });
    expect(retrySubmitRes.ok).toBe(true);
    expect(retrySubmitRes.data).toMatchObject({
      selected_shot_ids: ['shot-1'],
      skipped_blocked_count: 1,
      submitted_count: 1,
      skipped_count: 0,
      failed_count: 0,
      provider_queue_batch: {
        queue_id: 'provider-retry-plan-resubmit-001',
        submitted_count: 1,
        items: [{
          shot_id: 'shot-1',
          provider_job_id: 'provider-retry-resubmit-shot-1',
        }],
      },
    });
    expect(retrySubmitRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'submitted',
      provider_job_id: 'provider-retry-resubmit-shot-1',
      provider_queue_id: 'provider-retry-plan-resubmit-001',
      retry_count: 1,
    });
    expect(retrySubmitRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'failed',
      provider_job_id: 'provider-retry-plan-test-shot-2',
      failure_category: 'asset_missing',
    });
  });

  it('queries a configured Seedance provider adapter and applies returned statuses', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');
    process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT = 'https://adapter.example.test/seedance/poll';
    process.env.SEEDANCE_PROVIDER_API_TOKEN = 'adapter-token';
    process.env.SEEDANCE_PROVIDER_POLL_AUTH_HEADER = 'X-Provider-Token';
    process.env.SEEDANCE_PROVIDER_POLL_AUTH_SCHEME = 'Token';

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'provider-adapter-test',
      queue_id: 'provider-adapter-queue-001',
      note: 'provider adapter 测试提交',
    });
    expect(submitRes.ok).toBe(true);

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe('https://adapter.example.test/seedance/poll');
      expect(init?.method).toBe('POST');
      expect((init?.headers as Record<string, string>)['X-Provider-Token']).toBe('Token adapter-token');
      expect((init?.headers as Record<string, string>).authorization).toBeUndefined();
      const body = JSON.parse(String(init?.body)) as {
        project_id: string;
        provider?: string;
        queue_id?: string;
        targets: Array<{ shot_id: string; provider_job_id?: string; seedance_prompt?: string }>;
      };
      expect(body.project_id).toBe(enriched.project_id);
      expect(body.provider).toBe('seedance');
      expect(body.queue_id).toBe('provider-adapter-queue-001');
      expect(body.targets).toHaveLength(2);
      expect(body.targets[0]).toMatchObject({
        shot_id: 'shot-1',
        provider_job_id: 'provider-adapter-test-shot-1',
      });
      expect(body.targets[0].seedance_prompt).toContain('0-3秒');
      return new Response(JSON.stringify({
        data: {
          tasks: [{
            taskId: 'provider-adapter-test-shot-1',
            state: 'SUCCEEDED',
            outputUrl: 'https://example.com/seedance-videos/provider-adapter-shot-1.mp4',
            score: 94,
            review_note: 'adapter 回片可用',
          }, {
            task_id: 'provider-adapter-test-shot-2',
            task_status: 'FAILED',
            code: 'RISK_CONTROL',
            error_message: '内容审核未通过',
          }],
        },
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const pollApplyRes = await pollProjectSeedanceProviderQueue(enriched.project_id!, {
      provider: 'seedance',
      queue_id: 'provider-adapter-queue-001',
      include_prompt: true,
      use_provider_adapter: true,
      note: 'provider adapter 应用回传',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pollApplyRes.ok).toBe(true);
    expect(pollApplyRes.data).toMatchObject({
      dry_run: false,
      provider: 'seedance',
      queue_id: 'provider-adapter-queue-001',
      checked_count: 2,
      pollable_count: 0,
      updated_count: 2,
      failed_count: 0,
      provider_adapter: {
        endpoint_configured: true,
        queried_count: 2,
        returned_count: 2,
      },
    });
    expect(pollApplyRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'ready',
      provider_job_id: 'provider-adapter-test-shot-1',
      video_url: 'https://example.com/seedance-videos/provider-adapter-shot-1.mp4',
      selected_version_id: 'seedance-shot-shot-1-v2',
    });
    expect(pollApplyRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'failed',
      provider_job_id: 'provider-adapter-test-shot-2',
      failure_reason: '内容审核未通过',
      failure_category: 'content_policy',
      provider_error_code: 'RISK_CONTROL',
    });
  });

  it('queries a per-target Seedance provider adapter and applies single-task responses', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');
    process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT = 'https://adapter.example.test/seedance/poll-one';
    process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE = 'per_target';

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'provider-target-test',
      queue_id: 'provider-target-queue-001',
      note: 'provider target 测试提交',
    });
    expect(submitRes.ok).toBe(true);

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe('https://adapter.example.test/seedance/poll-one');
      const body = JSON.parse(String(init?.body)) as {
        request_mode?: string;
        target?: { shot_id: string; provider_job_id?: string };
        targets?: Array<{ shot_id: string; provider_job_id?: string }>;
      };
      expect(body.request_mode).toBe('per_target');
      expect(body.target).toBeDefined();
      expect(body.targets).toHaveLength(1);
      if (body.target?.shot_id === 'shot-1') {
        return new Response(JSON.stringify({
          taskId: 'provider-target-test-shot-1',
          state: 'SUCCEEDED',
          outputUrl: 'https://example.com/seedance-videos/provider-target-shot-1.mp4',
        }));
      }
      return new Response(JSON.stringify({
        data: {
          task_id: 'provider-target-test-shot-2',
          task_status: 'FAILED',
          error_code: 'ACCESS_DENIED',
          error_message: '鉴权失败',
        },
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const pollApplyRes = await pollProjectSeedanceProviderQueue(enriched.project_id!, {
      provider: 'seedance',
      queue_id: 'provider-target-queue-001',
      include_prompt: true,
      use_provider_adapter: true,
      note: 'provider target 应用回传',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(pollApplyRes.ok).toBe(true);
    expect(pollApplyRes.data).toMatchObject({
      dry_run: false,
      updated_count: 2,
      provider_adapter: {
        request_mode: 'per_target',
        queried_count: 2,
        returned_count: 2,
      },
    });
    expect(pollApplyRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'ready',
      provider_job_id: 'provider-target-test-shot-1',
      video_url: 'https://example.com/seedance-videos/provider-target-shot-1.mp4',
    });
    expect(pollApplyRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'failed',
      provider_job_id: 'provider-target-test-shot-2',
      failure_category: 'provider_auth',
      provider_error_code: 'ACCESS_DENIED',
    });
  });

  it('queries a per-target Seedance provider adapter with GET endpoint templates', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');
    process.env.SEEDANCE_PROVIDER_POLL_ENDPOINT = 'https://adapter.example.test/tasks/{provider_job_id}?shot={shot_id}&queue={provider_queue_id}';
    process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE = 'per_target';
    process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD = 'GET';

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const submitRes = await submitProjectSeedanceShotsToProvider(enriched.project_id!, {
      shot_ids: ['shot-1', 'shot-2'],
      provider: 'seedance',
      job_prefix: 'provider-template-test',
      queue_id: 'provider-template-queue-001',
      note: 'provider template 测试提交',
    });
    expect(submitRes.ok).toBe(true);

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe('GET');
      expect(init?.body).toBeUndefined();
      const url = String(_url);
      if (url.includes('provider-template-test-shot-1')) {
        expect(url).toBe('https://adapter.example.test/tasks/provider-template-test-shot-1?shot=shot-1&queue=provider-template-queue-001');
        return new Response(JSON.stringify({
          taskId: 'provider-template-test-shot-1',
          state: 'SUCCEEDED',
          outputUrl: 'https://example.com/seedance-videos/provider-template-shot-1.mp4',
        }));
      }
      expect(url).toBe('https://adapter.example.test/tasks/provider-template-test-shot-2?shot=shot-2&queue=provider-template-queue-001');
      return new Response(JSON.stringify({
        taskId: 'provider-template-test-shot-2',
        state: 'PROCESSING',
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const pollApplyRes = await pollProjectSeedanceProviderQueue(enriched.project_id!, {
      provider: 'seedance',
      queue_id: 'provider-template-queue-001',
      include_prompt: true,
      use_provider_adapter: true,
      note: 'provider template 应用回传',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(pollApplyRes.ok).toBe(true);
    expect(pollApplyRes.data).toMatchObject({
      updated_count: 2,
      provider_adapter: {
        request_mode: 'per_target',
        http_method: 'GET',
        queried_count: 2,
        returned_count: 2,
      },
    });
    expect(pollApplyRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-1'
    )).toMatchObject({
      status: 'ready',
      provider_job_id: 'provider-template-test-shot-1',
      video_url: 'https://example.com/seedance-videos/provider-template-shot-1.mp4',
    });
    expect(pollApplyRes.data?.seedance_shot_ledger?.items.find(item =>
      item.shot_id === 'shot-2'
    )).toMatchObject({
      status: 'processing',
      provider_job_id: 'provider-template-test-shot-2',
    });
  });

  it('exports a production board package to the project directory', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const exportRes = await exportProjectProductionBoard(enriched.project_id!);

    expect(exportRes.ok).toBe(true);
    expect(exportRes.data?.schema_version).toBe('story-production-board-export/v1');
    expect(exportRes.data?.project_id).toBe(enriched.project_id);
    expect(exportRes.data?.files.map(file => file.relative_path)).toEqual(expect.arrayContaining([
      'production-board/manifest.json',
      'production-board/production-board.json',
      'production-board/production-board.md',
      'production-board/supervision-report.json',
      'production-board/repair-plan.json',
      'production-board/seedance-prompts.json',
      'production-board/seedance-prompts.md',
      'production-board/seedance-asset-report.json',
      'production-board/seedance-asset-report.md',
      'production-board/seedance-shot-ledger.json',
      'production-board/seedance-shot-ledger.md',
    ]));

    const exportDir = resolve(root, 'web', 'generated', 'projects', enriched.project_id!, 'production-board');
    expect(await exists(resolve(exportDir, 'manifest.json'))).toBe(true);
    expect(await exists(resolve(exportDir, 'production-board.json'))).toBe(true);
    expect(await exists(resolve(exportDir, 'seedance-prompts.md'))).toBe(true);
    expect(await exists(resolve(exportDir, 'seedance-asset-report.md'))).toBe(true);
    expect(await exists(resolve(exportDir, 'seedance-shot-ledger.md'))).toBe(true);

    const manifest = JSON.parse(await readFile(resolve(exportDir, 'manifest.json'), 'utf-8'));
    expect(manifest.schema_version).toBe('story-production-board-manifest/v1');
    expect(manifest.delivery_manifest.artifacts.map((artifact: { kind: string }) => artifact.kind)).toContain('seedance_prompts');
    expect(manifest.delivery_manifest.artifacts.map((artifact: { kind: string }) => artifact.kind)).toContain('seedance_asset_report');
    expect(manifest.delivery_manifest.artifacts.map((artifact: { kind: string }) => artifact.kind)).toContain('seedance_shot_ledger');

    const seedanceMarkdown = await readFile(resolve(exportDir, 'seedance-prompts.md'), 'utf-8');
    expect(seedanceMarkdown).toContain('Seedance 2.0 镜头提示词');
    expect(seedanceMarkdown).toContain('0-3秒');
    expect(seedanceMarkdown).toContain('素材 slot');
    const seedanceJson = JSON.parse(await readFile(resolve(exportDir, 'seedance-prompts.json'), 'utf-8'));
    expect(seedanceJson.shot_units[0].asset_slots.length).toBeGreaterThan(0);
    expect(seedanceJson.shot_units[0].material_validation.prompt_complexity_score).toBeGreaterThan(0);
    const seedanceAssetReport = JSON.parse(await readFile(resolve(exportDir, 'seedance-asset-report.json'), 'utf-8'));
    expect(seedanceAssetReport.schema_version).toBe('seedance-asset-report/v1');
    expect(seedanceAssetReport.assets[0].status).toBe('missing_file');
    expect(seedanceAssetReport.markdown).toContain('Seedance 素材缺口报告');
    const seedanceShotLedger = JSON.parse(await readFile(resolve(exportDir, 'seedance-shot-ledger.json'), 'utf-8'));
    expect(seedanceShotLedger.schema_version).toBe('seedance-shot-ledger/v1');
    expect(seedanceShotLedger.items[0].status).toBe('prompt_exported');
    const seedanceShotLedgerMarkdown = await readFile(resolve(exportDir, 'seedance-shot-ledger.md'), 'utf-8');
    expect(seedanceShotLedgerMarkdown).toContain('Seedance Shot Ledger');

    const detail = await getProject(enriched.project_id!);
    expect(detail.data?.project.status).toBe('exported');
    expect(detail.data?.versions[0].production_board_export).toMatchObject({
      file_count: 11,
      delivery_stage: exportRes.data?.board.delivery_manifest.stage,
    });
  });

  it('repairs production board issues and exports the repaired package in one step', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const baseStory = makeStory();
    const story: StoryGenerateResult = {
      ...baseStory,
      scene_breakdown: baseStory.scene_breakdown.map(scene => scene.scene_id === 1
        ? {
            ...scene,
            visual_prompt: `质量：待补；${scene.visual_prompt}`,
          }
        : scene),
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');

    const result = await repairAndExportProjectProductionBoard(enriched.project_id!, {
      apply_all: true,
    });

    expect(result.ok).toBe(true);
    expect(result.data?.schema_version).toBe('story-production-board-repair-export/v1');
    expect(result.data?.repair.trace.applied).toBe(true);
    expect(result.data?.repair.trace.applied_actions).toContain('clean_prompt');
    expect(result.data?.detail.project.status).toBe('exported');
    expect(result.data?.detail.project.version_count).toBe(2);
    expect(result.data?.detail.versions[0].production_board_repair_trace?.applied).toBe(true);
    expect(result.data?.detail.versions[0].production_board_repair_trace?.applied_actions).toContain('clean_prompt');
    expect(result.data?.detail.versions[0].production_board_export).toMatchObject({
      file_count: result.data?.export_package.files.length,
      delivery_stage: result.data?.export_package.board.delivery_manifest.stage,
    });
    expect(result.data?.detail.current_story.scene_breakdown[0].visual_prompt).not.toMatch(/质量|待补/);
    expect(result.data?.export_package.files.map(file => file.relative_path)).toEqual(expect.arrayContaining([
      'production-board/manifest.json',
      'production-board/production-board.json',
      'production-board/seedance-prompts.md',
    ]));
    expect(result.data?.export_package.board.shot_units[0].visual_prompt).not.toMatch(/质量|待补/);

    const exportDir = resolve(root, 'web', 'generated', 'projects', enriched.project_id!, 'production-board');
    expect(await exists(resolve(exportDir, 'manifest.json'))).toBe(true);
    expect(await exists(resolve(exportDir, 'production-board.json'))).toBe(true);
  });

  it('repairs production board blockers into a new project version', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story: StoryGenerateResult = {
      ...makeStory(),
      gears_delivery: {
        schema_version: 'gears-delivery/v1',
        storyId: '20260609-story-abc1',
        title: '拒签冤案',
        character_assets: [
          {
            name: '周敦颐',
            role_position: '主角',
            species_type: '人类',
            ethnicity: ['东亚'],
            gender: '男',
            age_range: '青年',
            appearance_features: '青年士人，神情克制',
            clothing: '清末民初至五四前后中国青年固定服装：朴素学生长衫或短褂布鞋',
          },
          {
            name: '上官',
            role_position: '配角',
            species_type: '人类',
            ethnicity: ['东亚'],
            gender: '男',
            age_range: '中年',
            appearance_features: '中年官员，目光压迫',
            clothing: '清末民初至五四前后中国青年固定服装：朴素学生长衫或短褂布鞋',
          },
        ],
        character_gender_summary: {
          total: 2,
          male: 2,
          female: 0,
          other: 0,
          unspecified: 0,
          not_applicable: 0,
        },
        scene_assets: [{
          name: '南安军衙',
          scene_type: '室内',
          description: '衙署案桌、烛火、案卷',
          atmosphere: '紧张',
        }],
        units: [],
        validation_notes: [],
        markdown: '# GEARS',
      },
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const beforeBoard = await getProjectProductionBoard(enriched.project_id!);
    expect(beforeBoard.data?.supervision_report.blockers).toBeGreaterThan(0);

    const repairRes = await repairProjectProductionBoard(enriched.project_id!, { priorities: ['P0'] });

    expect(repairRes.ok).toBe(true);
    expect(repairRes.data?.schema_version).toBe('story-production-board-repair/v1');
    expect(repairRes.data?.trace.applied).toBe(true);
    expect(repairRes.data?.trace.applied_actions).toContain('normalize_period_costumes');
    expect(repairRes.data?.trace.after_blockers).toBeLessThan(repairRes.data?.trace.before_blockers ?? 999);
    expect(repairRes.data?.detail.project.version_count).toBe(2);
    expect(repairRes.data?.detail.versions[0].change_type).toBe('production_board_repair');
    expect(repairRes.data?.detail.versions[0].production_board_repair_trace?.applied_actions).toContain('normalize_period_costumes');
    expect(repairRes.data?.detail.versions[0].production_board_export).toBeUndefined();
    expect(repairRes.data?.detail.current_story.gears_delivery?.character_assets[0].clothing).toContain('宋代');
    expect(repairRes.data?.after_board.character_assets[0].clothing).toContain('宋代');
  });

  it('repairs only the requested production board task id', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const baseStory = makeStory();
    const story: StoryGenerateResult = {
      ...baseStory,
      scene_breakdown: baseStory.scene_breakdown.map(scene => scene.scene_id === 1
        ? {
            ...scene,
            visual_prompt: `质量：待补；${scene.visual_prompt}`,
          }
        : scene),
      gears_delivery: {
        schema_version: 'gears-delivery/v1',
        storyId: baseStory.storyId,
        title: baseStory.title,
        character_assets: [
          {
            name: '周敦颐',
            role_position: '主角',
            species_type: '人类',
            ethnicity: ['东亚'],
            gender: '男',
            age_range: '青年',
            appearance_features: '青年士人，神情克制',
            clothing: '清末民初至五四前后中国青年固定服装：朴素学生长衫或短褂布鞋',
          },
        ],
        character_gender_summary: {
          total: 1,
          male: 1,
          female: 0,
          other: 0,
          unspecified: 0,
          not_applicable: 0,
        },
        scene_assets: [{
          name: '南安军衙',
          scene_type: '室内',
          description: '衙署案桌、烛火、案卷',
          atmosphere: '紧张',
        }],
        units: [],
        validation_notes: [],
        markdown: '# GEARS',
      },
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const beforeBoard = await getProjectProductionBoard(enriched.project_id!);
    const cleanPromptTask = beforeBoard.data?.repair_plan.tasks.find(task => task.action === 'clean_prompt');

    expect(cleanPromptTask).toBeTruthy();
    expect(beforeBoard.data?.repair_plan.tasks.some(task => task.action === 'normalize_period_costumes')).toBe(true);

    const repairRes = await repairProjectProductionBoard(enriched.project_id!, {
      task_ids: [cleanPromptTask!.task_id],
    });

    expect(repairRes.ok).toBe(true);
    expect(repairRes.data?.trace.applied_task_ids).toEqual([cleanPromptTask!.task_id]);
    expect(repairRes.data?.trace.applied_actions).toEqual(['clean_prompt']);
    expect(repairRes.data?.trace.applied_task_ids).not.toContain('repair-normalize_period_costumes');
    expect(repairRes.data?.detail.project.version_count).toBe(2);
    expect(repairRes.data?.detail.current_story.scene_breakdown[0].visual_prompt).not.toMatch(/质量|待补/);
    expect(repairRes.data?.detail.current_story.gears_delivery?.character_assets[0].clothing).toContain('清末民初');
    expect(repairRes.data?.after_board.supervision_report.issues.some(issue => issue.category === 'period')).toBe(true);
  });

  it('repairs only the requested production board issue category', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const baseStory = makeStory();
    const story: StoryGenerateResult = {
      ...baseStory,
      storyId: '20260609-story-cat1',
      gears_segments_url: '/api/stories/20260609-story-cat1/gears-segments',
      scene_breakdown: baseStory.scene_breakdown.map(scene => scene.scene_id === 1
        ? {
            ...scene,
            visual_prompt: `质量：待补；${scene.visual_prompt}`,
          }
        : scene),
      gears_delivery: {
        schema_version: 'gears-delivery/v1',
        storyId: '20260609-story-cat1',
        title: baseStory.title,
        character_assets: [
          {
            name: '周敦颐',
            role_position: '主角',
            species_type: '人类',
            ethnicity: ['东亚'],
            gender: '男',
            age_range: '青年',
            appearance_features: '青年士人，神情克制',
            clothing: '清末民初至五四前后中国青年固定服装：朴素学生长衫或短褂布鞋',
          },
        ],
        character_gender_summary: {
          total: 1,
          male: 1,
          female: 0,
          other: 0,
          unspecified: 0,
          not_applicable: 0,
        },
        scene_assets: [{
          name: '南安军衙',
          scene_type: '室内',
          description: '衙署案桌、烛火、案卷',
          atmosphere: '紧张',
        }],
        units: [],
        validation_notes: [],
        markdown: '# GEARS',
      },
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const beforeBoard = await getProjectProductionBoard(enriched.project_id!);
    expect(beforeBoard.data?.repair_plan.tasks.some(task => task.action === 'clean_prompt')).toBe(true);
    expect(beforeBoard.data?.repair_plan.tasks.some(task => task.action === 'normalize_period_costumes')).toBe(true);

    const repairRes = await repairProjectProductionBoard(enriched.project_id!, {
      categories: ['prompt'],
    });

    expect(repairRes.ok).toBe(true);
    expect(repairRes.data?.trace.applied_actions).toEqual(['clean_prompt']);
    expect(repairRes.data?.trace.applied_actions).not.toContain('normalize_period_costumes');
    expect(repairRes.data?.detail.current_story.scene_breakdown[0].visual_prompt).not.toMatch(/质量|待补/);
    expect(repairRes.data?.detail.current_story.gears_delivery?.character_assets[0].clothing).toContain('清末民初');
  });

  it('narrows production board repair to the requested shot target', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const baseStory = makeStory();
    const story: StoryGenerateResult = {
      ...baseStory,
      storyId: '20260609-story-shot1',
      gears_segments_url: '/api/stories/20260609-story-shot1/gears-segments',
      scene_breakdown: baseStory.scene_breakdown.map(scene => ({
        ...scene,
        visual_prompt: `质量：待补；${scene.visual_prompt}`,
      })),
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const beforeBoard = await getProjectProductionBoard(enriched.project_id!);
    const cleanPromptTask = beforeBoard.data?.repair_plan.tasks.find(task => task.action === 'clean_prompt');
    const targetShotId = cleanPromptTask?.target_shot_ids[0];
    const targetSceneId = cleanPromptTask?.target_scene_ids[0];
    const untouchedSceneId = cleanPromptTask?.target_scene_ids.find(sceneId => sceneId !== targetSceneId);

    expect(targetShotId).toBeTruthy();
    expect(targetSceneId).toBeTruthy();
    expect(untouchedSceneId).toBeTruthy();

    const repairRes = await repairProjectProductionBoard(enriched.project_id!, {
      shot_ids: [targetShotId!],
      scene_ids: [targetSceneId!],
    });

    expect(repairRes.ok).toBe(true);
    expect(repairRes.data?.trace.applied_actions).toContain('clean_prompt');
    expect(repairRes.data?.trace.changed_scene_ids).toEqual([targetSceneId]);
    expect(repairRes.data?.trace.scene_diffs).toHaveLength(1);
    expect(repairRes.data?.trace.scene_diffs[0].scene_id).toBe(targetSceneId);
    expect(repairRes.data?.trace.scene_diffs[0].changed_fields.map(field => field.field)).toContain('visual_prompt');
    const scenes = repairRes.data?.detail.current_story.scene_breakdown ?? [];
    expect(scenes.find(scene => scene.scene_id === targetSceneId)?.visual_prompt).not.toMatch(/质量|待补/);
    expect(scenes.find(scene => scene.scene_id === untouchedSceneId)?.visual_prompt).toMatch(/质量|待补/);
  });

  it('does not create a project version when production board repair changes nothing', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');

    const repairRes = await repairProjectProductionBoard(enriched.project_id!, {
      task_ids: ['repair-task-that-does-not-exist'],
    });

    expect(repairRes.ok).toBe(true);
    expect(repairRes.data?.trace.applied).toBe(false);
    expect(repairRes.data?.trace.applied_task_ids).toEqual([]);
    expect(repairRes.data?.detail.project.version_count).toBe(1);
    expect(repairRes.data?.detail.versions).toHaveLength(1);

    const detail = await getProject(enriched.project_id!);
    expect(detail.data?.project.version_count).toBe(1);
    expect(detail.data?.versions.map(version => version.change_type)).toEqual(['initial_generation']);
  });

  it('updates GEARS webhook status on the current project and source story file', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story: StoryGenerateResult = {
      ...makeStory(),
      gears_webhook: {
        status: 'pending',
        webhook_target: 'https://grears.example/api/webhook/story-ready',
      },
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
    const storyPath = resolve(storyDir, `${story.storyId}.json`);
    await mkdir(storyDir, { recursive: true });
    await writeFile(storyPath, JSON.stringify({
      ...story,
      project_id: enriched.project_id,
      current_version_id: enriched.current_version_id,
      _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
    }, null, 2), 'utf-8');

    await updateProjectCurrentGearsWebhookStatus(enriched.project_id, story.storyId, {
      status: 'sent',
      webhook_target: 'https://grears.example/api/webhook/story-ready',
      attempts: 1,
      last_attempt_at: '2026-06-09T10:00:01.000Z',
      last_success_at: '2026-06-09T10:00:01.000Z',
    });

    const detail = await getProject(enriched.project_id!);
    expect(detail.ok).toBe(true);
    expect(detail.data?.current_story.gears_webhook?.status).toBe('sent');
    expect(detail.data?.current_story.gears_webhook?.attempts).toBe(1);

    const rawSource = JSON.parse(await readFile(storyPath, 'utf-8')) as StoryGenerateResult;
    expect(rawSource.gears_webhook?.status).toBe('sent');
    expect(rawSource.gears_webhook?.last_success_at).toBe('2026-06-09T10:00:01.000Z');
  });

  it('tracks open supplement task count on project metadata', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story: StoryGenerateResult = {
      ...makeStory(),
      supplement_tasks: [{
        task_id: '20260609-story-abc1--supplement--supporting_characters',
        need_id: 'supporting_characters',
        label: '配角人物',
        description: '补充「配角人物」相关资料',
        status: 'open',
        source: 'knowledge_pack_missing_need',
        created_at: '2026-06-09T10:00:00.000Z',
      }],
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const detail = await getProject(enriched.project_id!);

    expect(detail.ok).toBe(true);
    expect(detail.data?.project.open_supplement_task_count).toBe(1);
    expect(detail.data?.current_story.supplement_tasks?.[0].status).toBe('open');
  });

  it('lists supplement tasks across projects with status filtering', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story: StoryGenerateResult = {
      ...makeStory(),
      supplement_tasks: [
        {
          task_id: '20260609-story-abc1--supplement--supporting_characters',
          need_id: 'supporting_characters',
          label: '配角人物',
          description: '补充「配角人物」相关资料',
          status: 'open',
          source: 'knowledge_pack_missing_need',
          created_at: '2026-06-09T10:00:00.000Z',
        },
        {
          task_id: '20260609-story-abc1--supplement--regional_context',
          need_id: 'regional_context',
          label: '地域背景',
          description: '补充「地域背景」相关资料',
          status: 'resolved',
          source: 'knowledge_pack_missing_need',
          created_at: '2026-06-09T10:00:00.000Z',
          resolved_at: '2026-06-09T11:00:00.000Z',
          supplement_note: '已补充地域背景。',
        },
      ],
    };
    await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');

    const allTasks = await listProjectSupplementTasks();
    const openTasks = await listProjectSupplementTasks('open');

    expect(allTasks.ok).toBe(true);
    expect(allTasks.data).toHaveLength(2);
    expect(openTasks.ok).toBe(true);
    expect(openTasks.data).toHaveLength(1);
    expect(openTasks.data?.[0].project_title).toBe(story.title);
    expect(openTasks.data?.[0].task.status).toBe('open');
  });

  it('updates supplement task status on the current project and source story file', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const taskId = '20260609-story-abc1--supplement--supporting_characters';
    const story: StoryGenerateResult = {
      ...makeStory(),
      supplement_tasks: [{
        task_id: taskId,
        need_id: 'supporting_characters',
        label: '配角人物',
        description: '补充「配角人物」相关资料',
        status: 'open',
        source: 'knowledge_pack_missing_need',
        created_at: '2026-06-09T10:00:00.000Z',
      }],
    };
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
    const storyPath = resolve(storyDir, `${story.storyId}.json`);
    await mkdir(storyDir, { recursive: true });
    await writeFile(storyPath, JSON.stringify({
      ...story,
      project_id: enriched.project_id,
      current_version_id: enriched.current_version_id,
      _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
    }, null, 2), 'utf-8');

    const updated = await updateProjectSupplementTask(enriched.project_id!, taskId, {
      status: 'resolved',
      supplement_note: '上官可设定为南安军衙主管，负责催促签署疑案文书。',
    });

    expect(updated.ok).toBe(true);
    expect(updated.data?.project.open_supplement_task_count).toBe(0);
    expect(updated.data?.current_story.supplement_tasks?.[0].status).toBe('resolved');
    expect(updated.data?.current_story.supplement_tasks?.[0].resolved_at).toBeTruthy();
    expect(updated.data?.current_story.supplement_tasks?.[0].supplement_note).toContain('南安军衙主管');

    const rawSource = JSON.parse(await readFile(storyPath, 'utf-8')) as StoryGenerateResult;
    expect(rawSource.supplement_tasks?.[0].status).toBe('resolved');
    expect(rawSource.supplement_tasks?.[0].supplement_note).toContain('疑案文书');
  });

  it('builds a GEARS delivery package when reading old project snapshots', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');

    const detail = await getProject(enriched.project_id!);

    expect(detail.ok).toBe(true);
    expect(detail.data?.current_story.gears_delivery?.schema_version).toBe('gears-delivery/v1');
    expect(detail.data?.current_story.gears_delivery?.character_assets.some(character => character.name === '周敦颐')).toBe(true);
    expect(detail.data?.current_story.gears_delivery?.units.every(unit => unit.suggested_duration_sec <= 15)).toBe(true);
    expect(detail.data?.current_story.gears_delivery?.markdown).toContain('GEARS 供稿包');
  });

  it('deletes the project snapshots and source story file', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const projectId = enriched.project_id!;
    const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
    const storyPath = resolve(storyDir, `${story.storyId}.json`);
    const previousStoryId = '20260609-story-oldv';
    const previousStoryDir = resolve(root, 'web', 'generated', 'stories', 'ai_comic_drama');
    const previousStoryPath = resolve(previousStoryDir, `${previousStoryId}.json`);
    const projectPath = resolve(root, 'web', 'generated', 'projects', projectId);

    await mkdir(storyDir, { recursive: true });
    await writeFile(storyPath, JSON.stringify({
      ...story,
      project_id: projectId,
      current_version_id: enriched.current_version_id,
      _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
    }, null, 2), 'utf-8');
    await mkdir(previousStoryDir, { recursive: true });
    await writeFile(previousStoryPath, JSON.stringify({
      ...story,
      storyId: previousStoryId,
      video_type: 'ai_comic_drama',
      project_id: projectId,
    }, null, 2), 'utf-8');
    await writeFile(
      resolve(projectPath, 'versions', `${projectId}-v0.json`),
      JSON.stringify({
        project_id: projectId,
        version_id: `${projectId}-v0`,
        created_at: '2026-06-09T09:59:00.000Z',
        change_type: 'scene_regeneration',
        scene_ids_changed: [1],
        story: {
          ...story,
          storyId: previousStoryId,
          video_type: 'ai_comic_drama',
          project_id: projectId,
        },
      } satisfies StoryProjectVersionSnapshot, null, 2),
      'utf-8',
    );

    const deleted = await deleteProject(projectId);

    expect(deleted.ok).toBe(true);
    expect(deleted.data?.deleted).toBe(true);
    expect(deleted.data?.story_ids?.sort()).toEqual([previousStoryId, story.storyId].sort());
    expect(deleted.data?.removed_story_file_count).toBe(2);
    expect(await exists(storyPath)).toBe(false);
    expect(await exists(previousStoryPath)).toBe(false);
    expect(await exists(projectPath)).toBe(false);
    const detail = await getProject(projectId);
    expect(detail.ok).toBe(false);
  });

  it('batch deletes projects and reports missing ids', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const firstStory = makeStory();
    const secondStory: StoryGenerateResult = {
      ...makeStory(),
      storyId: '20260609-story-def2',
      title: '月岩悟道传说',
      gears_segments_url: '/api/stories/20260609-story-def2/gears-segments',
    };
    const first = await createProjectFromGeneratedStory(firstStory, '2026-06-09T10:00:00.000Z');
    const second = await createProjectFromGeneratedStory(secondStory, '2026-06-09T10:01:00.000Z');

    for (const story of [first, second]) {
      const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
      await mkdir(storyDir, { recursive: true });
      await writeFile(resolve(storyDir, `${story.storyId}.json`), JSON.stringify({
        ...story,
        _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
      }, null, 2), 'utf-8');
    }

    const result = await deleteProjects([
      first.project_id!,
      second.project_id!,
      '20260609-story-none--character_story',
    ]);

    expect(result.ok).toBe(true);
    expect(result.data?.deleted.map(item => item.project_id).sort()).toEqual([
      first.project_id!,
      second.project_id!,
    ].sort());
    expect(result.data?.failed).toHaveLength(1);
    expect(result.data?.failed[0].project_id).toBe('20260609-story-none--character_story');
    expect(await exists(resolve(root, 'web', 'generated', 'projects', first.project_id!))).toBe(false);
    expect(await exists(resolve(root, 'web', 'generated', 'projects', second.project_id!))).toBe(false);
    expect(await exists(resolve(root, 'web', 'generated', 'stories', first.video_type, `${first.storyId}.json`))).toBe(false);
    expect(await exists(resolve(root, 'web', 'generated', 'stories', second.video_type, `${second.storyId}.json`))).toBe(false);
  });

  it('retains the newest projects and deletes older stories', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const stories: StoryGenerateResult[] = [
      { ...makeStory(), storyId: '20260609-story-old1', title: '最早故事', gears_segments_url: '/api/stories/20260609-story-old1/gears-segments' },
      { ...makeStory(), storyId: '20260609-story-mid2', title: '中间故事', gears_segments_url: '/api/stories/20260609-story-mid2/gears-segments' },
      { ...makeStory(), storyId: '20260609-story-new3', title: '最新故事', gears_segments_url: '/api/stories/20260609-story-new3/gears-segments' },
    ];
    const createdStories: StoryGenerateResult[] = [];
    for (const [index, story] of stories.entries()) {
      const createdAt = `2026-06-09T10:0${index}:00.000Z`;
      const created = await createProjectFromGeneratedStory(story, createdAt);
      createdStories.push(created);
      const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
      await mkdir(storyDir, { recursive: true });
      await writeFile(resolve(storyDir, `${story.storyId}.json`), JSON.stringify({
        ...created,
        _request_meta: { created_at: createdAt },
      }, null, 2), 'utf-8');
    }
    const orphanProjectId = '20260609-story-orphan--character_story';
    await mkdir(resolve(root, 'web', 'generated', 'projects', orphanProjectId), { recursive: true });
    await writeFile(resolve(root, 'web', 'generated', 'projects', orphanProjectId, 'project.json'), JSON.stringify({
      project_id: orphanProjectId,
      current_story_id: '20260609-story-orphan',
      title: '孤立项目',
      source_domain: 'china_culture',
      source_entry: '缺失故事文件',
      video_type: 'character_story',
      presentation_style: 'cinematic',
      status: 'draft',
      created_at: '2026-06-09T10:09:00.000Z',
      updated_at: '2026-06-09T10:09:00.000Z',
      current_version_id: `${orphanProjectId}-v1`,
      version_count: 1,
      scene_count: 0,
      has_gears_segments: false,
      credibility_note: '测试',
      logline: '测试',
    }, null, 2), 'utf-8');

    const result = await retainRecentProjects(2);

    expect(result.ok).toBe(true);
    expect(result.data?.kept.map(project => project.project_id)).toEqual([
      createdStories[2].project_id,
      createdStories[1].project_id,
    ]);
    expect(result.data?.deleted.map(item => item.project_id).sort()).toEqual([
      createdStories[0].project_id,
      orphanProjectId,
    ].sort());
    expect(await exists(resolve(root, 'web', 'generated', 'projects', createdStories[0].project_id!))).toBe(false);
    expect(await exists(resolve(root, 'web', 'generated', 'projects', orphanProjectId))).toBe(false);
    expect(await exists(resolve(root, 'web', 'generated', 'stories', createdStories[0].video_type, `${createdStories[0].storyId}.json`))).toBe(false);
    expect(await exists(resolve(root, 'web', 'generated', 'projects', createdStories[1].project_id!))).toBe(true);
    expect(await exists(resolve(root, 'web', 'generated', 'projects', createdStories[2].project_id!))).toBe(true);
  });

  it('regenerates a single scene into a new version', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory();
    const projectId = buildProjectId(story.storyId, story.video_type);
    const currentVersionId = `${projectId}-v1`;
    const storyWithProject = {
      ...story,
      project_id: projectId,
      current_version_id: currentVersionId,
      _request_meta: { created_at: '2026-06-09T10:00:00.000Z' },
    };

    const storyDir = resolve(root, 'web', 'generated', 'stories', story.video_type);
    await mkdir(storyDir, { recursive: true });
    await writeFile(resolve(storyDir, `${story.storyId}.json`), JSON.stringify(storyWithProject, null, 2), 'utf-8');

    const result = await regenerateProjectScene(projectId, {
      scene_id: 1,
      intent: 'tighten_conflict',
      user_note: '突出他拒签后可能丢官的代价',
      model_profile_id: 'codex_gpt55',
    });

    expect(result.ok).toBe(true);
    expect(result.data?.project.version_count).toBe(2);
    expect(result.data?.project.current_version_id).toContain('-v2');
    expect(result.data?.current_story.scene_breakdown[0].plot).toContain('突出他拒签后可能丢官的代价');
    expect(result.data?.versions[0].change_type).toBe('scene_regeneration');
    expect(result.data?.project.model_profile_id).toBe('claude_sonnet');
    expect(result.data?.current_story.model_profile_id).toBe('claude_sonnet');
  });

  // ---------------------------------------------------------------------------
  // 旧故事兼容性测试：generation_mode/generation_used_fallback 缺失或为 false
  // ---------------------------------------------------------------------------

  it('fills generation_mode=local_only and generation_used_fallback=false for old stories missing these fields', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    // makeStory() 不含 generation_mode/generation_used_fallback → 模拟旧故事
    const story = makeStory();
    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');

    const detail = await getProject(enriched.project_id!);
    expect(detail.ok).toBe(true);
    // 旧故事缺失字段 → 填充为 local_only / false
    expect(detail.data?.current_story.generation_mode).toBe('local_only');
    expect(detail.data?.current_story.generation_used_fallback).toBe(false);
    expect(detail.data?.project.generation_mode).toBe('local_only');
    expect(detail.data?.project.generation_used_fallback).toBe(false);
  });

  it('preserves generation_used_fallback=false (does not coerce to undefined)', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    // 故事显式设置 generation_used_fallback=false（非旧故事缺失）
    const story = makeStory() as StoryGenerateResult & { generation_mode?: string; generation_used_fallback?: boolean };
    story.generation_mode = 'local_only';
    story.generation_used_fallback = false;

    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const detail = await getProject(enriched.project_id!);
    expect(detail.ok).toBe(true);
    // false 不应被 || 操作符吞掉变为 undefined
    expect(detail.data?.current_story.generation_used_fallback).toBe(false);
    expect(detail.data?.current_story.generation_mode).toBe('local_only');
  });

  it('preserves generation_mode=external_model and generation_used_fallback=true for adapter stories', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-project-'));
    TEMP_DIRS.push(root);
    process.env.KB_ROOT = resolve(root, 'data');

    const story = makeStory() as StoryGenerateResult & { generation_mode?: string; generation_used_fallback?: boolean; generation_source?: string };
    story.generation_mode = 'external_model';
    story.generation_used_fallback = true;
    story.generation_source = 'Claude Sonnet (fallback)';

    const enriched = await createProjectFromGeneratedStory(story, '2026-06-09T10:00:00.000Z');
    const detail = await getProject(enriched.project_id!);
    expect(detail.ok).toBe(true);
    expect(detail.data?.current_story.generation_mode).toBe('external_model');
    expect(detail.data?.current_story.generation_used_fallback).toBe(true);
    expect(detail.data?.current_story.generation_source).toBe('Claude Sonnet (fallback)');
  });
});
