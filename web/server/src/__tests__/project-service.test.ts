import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { StoryGenerateResult, StoryProjectVersionSnapshot } from '@shared/types.js';
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
  getProjectProductionBoard,
  importProjectSeedanceShotCallbacks,
  listProjects,
  listProjectSupplementTasks,
  regenerateProjectScene,
  repairAndExportProjectProductionBoard,
  repairProjectProductionBoard,
  retainRecentProjects,
  selectProjectSeedanceShotVersion,
  updateProjectSeedanceAssetLibrary,
  updateProjectSeedanceShotStatus,
  updateProjectSeedanceShotStatuses,
  updateProjectCurrentGearsWebhookStatus,
  updateProjectSupplementTask,
} from '../services/project-service.js';

const TEMP_DIRS: string[] = [];
const ORIGINAL_KB_ROOT = process.env.KB_ROOT;

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
      selected_version_id: 'seedance-shot-shot-2-v4',
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
