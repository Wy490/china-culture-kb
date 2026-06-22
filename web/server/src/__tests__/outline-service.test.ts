import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { GEARS_CALLBACK_BATCH_ITEM_LIMIT } from '@shared/types.js';
import { analyzeOutline, multiMatchEntries } from '../services/outline-service.js';
import {
  addAiComicSeriesSeedanceReview,
  archiveAiComicSeriesProject,
  applyAiComicSeriesSeedanceProductionCallback,
  assembleAiComicSeriesSeedanceCut,
  assembleAiComicSeriesSeedanceFinalDelivery,
  autoSelectAiComicSeriesSeedanceProductionVersions,
  captureAiComicSeriesSeedanceThumbnails,
  copyAiComicSeriesProject,
  deleteAiComicSeriesProject,
  exportAiComicSeriesBible,
  exportAiComicSeriesSeedanceAssetReportPackage,
  exportAiComicSeriesSeedanceAudioPlanPackage,
  exportAiComicSeriesSeedanceCutPackage,
  exportAiComicSeriesSeedanceEditAssetPackage,
  exportAiComicSeriesSeedanceEditingPlatformPackage,
  exportAiComicSeriesSeedanceFinishingPlanPackage,
  exportAiComicSeriesSeedancePrompts,
  exportAiComicSeriesSeedanceRetryExecutionPlan,
  exportAiComicSeriesSeedanceRetryPackage,
  exportAiComicSeriesSeedanceReviewRepairPackage,
  exportAiComicSeriesSeedanceSubtitlePackage,
  exportAiComicSeriesSeedanceThumbnailPlanPackage,
  exportAiComicSeriesSeedanceTitleCardPlanPackage,
  exportAiComicSeriesSeedanceVersionComparisonPackage,
  generateAiComicEpisodeFromPlan,
  generateAiComicSeriesPlan,
  getAiComicSeriesProductionReadiness,
  getAiComicSeriesProject,
  getAiComicSeriesSeedanceProductionDashboard,
  listAiComicSeriesProjects,
  mixAiComicSeriesSeedanceAudio,
  previewAiComicEpisodeContext,
  recoverAiComicSeriesSeedanceProviderTimeouts,
  rebuildAiComicSeriesContinuityLedger,
  renderAiComicSeriesSeedanceSubtitles,
  renderAiComicSeriesSeedanceTitleCards,
  resolveAiComicSeriesSeedanceReview,
  runAiComicSeriesProductionReadinessAutomation,
  saveAiComicSeriesProject,
  selectAiComicSeriesSeedanceProductionVersion,
  importAiComicSeriesGearsCallback,
  importAiComicSeriesGearsCallbacks,
  submitAiComicSeriesGearsJobs,
  submitAiComicSeriesSeedanceRetryExecutionPlan,
  syncAiComicSeriesGearsJobStatuses,
  updateAiComicSeriesSeedanceAssetLibrary,
  updateAiComicSeriesSeedanceAudioLibrary,
  updateAiComicSeriesSeedanceProductionStatus,
  updateAiComicSeriesSeedanceProductionStatuses,
} from '../services/ai-comic-series-service.js';

const ORIGINAL_KB_ROOT = process.env.KB_ROOT;
const ORIGINAL_WEB_GENERATED_ROOT = process.env.WEB_GENERATED_ROOT;
const ORIGINAL_GEARS_API_BASE_URL = process.env.GEARS_API_BASE_URL;
const ORIGINAL_GEARS_API_TOKEN = process.env.GEARS_API_TOKEN;
let testWorkspaceRoot = '';

function outlineKbRoot(): string {
  return testWorkspaceRoot
    ? resolve(testWorkspaceRoot, 'data')
    : resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
}

function outlineGeneratedRoot(): string {
  return testWorkspaceRoot
    ? resolve(testWorkspaceRoot, 'web', 'generated')
    : (process.env.WEB_GENERATED_ROOT || resolve(outlineKbRoot(), '..', 'web', 'generated'));
}

function useOutlineTestRoots(): void {
  process.env.KB_ROOT = outlineKbRoot();
  process.env.WEB_GENERATED_ROOT = outlineGeneratedRoot();
}

beforeAll(async () => {
  testWorkspaceRoot = await mkdtemp(resolve(tmpdir(), 'china-culture-kb-outline-'));
  const realDataRoot = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
  await symlink(realDataRoot, resolve(testWorkspaceRoot, 'data'), 'dir');
  useOutlineTestRoots();
});

beforeEach(() => {
  useOutlineTestRoots();
});

afterEach(() => {
  if (ORIGINAL_GEARS_API_BASE_URL === undefined) {
    delete process.env.GEARS_API_BASE_URL;
  } else {
    process.env.GEARS_API_BASE_URL = ORIGINAL_GEARS_API_BASE_URL;
  }
  if (ORIGINAL_GEARS_API_TOKEN === undefined) {
    delete process.env.GEARS_API_TOKEN;
  } else {
    process.env.GEARS_API_TOKEN = ORIGINAL_GEARS_API_TOKEN;
  }
  vi.unstubAllGlobals();
});

afterAll(async () => {
  if (ORIGINAL_KB_ROOT === undefined) {
    delete process.env.KB_ROOT;
  } else {
    process.env.KB_ROOT = ORIGINAL_KB_ROOT;
  }
  if (ORIGINAL_WEB_GENERATED_ROOT === undefined) {
    delete process.env.WEB_GENERATED_ROOT;
  } else {
    process.env.WEB_GENERATED_ROOT = ORIGINAL_WEB_GENERATED_ROOT;
  }
  if (testWorkspaceRoot) {
    await rm(testWorkspaceRoot, { recursive: true, force: true });
  }
});

describe('outline-service', () => {
  it('recognizes the protagonist from KB aliases instead of short sliding-window fragments', async () => {
    const res = await analyzeOutline({
      outline: '我想做一个毛泽东少年求学走向革命的故事',
    });

    expect(res.ok).toBe(true);
    expect(res.data?.story_intent.main_character).toBe('毛泽东');
    expect(res.data?.story_intent.core_theme).toBe('求学与革命');
    expect(res.data?.knowledge_needs.find(need => need.need_id === 'main_character')?.keywords).toEqual(['毛泽东']);
    expect(res.data?.knowledge_needs.some(need => need.keywords.includes('故事'))).toBe(false);
    expect(res.data?.detected_subjects).not.toContain('毛泽');
    expect(res.data?.detected_subjects).not.toContain('向革');
  });

  it('matches the Mao Zedong entry for protagonist knowledge needs', async () => {
    const analysis = await analyzeOutline({
      outline: '我想做一个毛泽东少年求学走向革命的故事',
    });

    expect(analysis.ok).toBe(true);
    const res = await multiMatchEntries({
      outline: analysis.data!.outline,
      knowledge_needs: analysis.data!.knowledge_needs,
      limit_per_need: 5,
    });

    expect(res.ok).toBe(true);
    const matchedNames = [
      ...(res.data?.matched_knowledge_pack.primary_entries ?? []),
      ...(res.data?.matched_knowledge_pack.supporting_entries ?? []),
    ].map(entry => entry.entry_name);
    expect(matchedNames.some(name => name.startsWith('毛泽东——'))).toBe(true);
    expect(res.data?.matched_knowledge_pack.primary_entries.every(entry => entry.type === '历史人物')).toBe(true);
  });

  it('enriches multi-match knowledge pack summaries with detailed story snippets', async () => {
    const res = await multiMatchEntries({
      outline: '周敦颐少年在濂溪读书，后来面对南安军拒签冤案，坚持良知。',
      knowledge_needs: [
        {
          need_id: 'main_character',
          label: '主人公',
          keywords: ['周敦颐', '濂溪', '拒签冤案', '南安军'],
          required: true,
        },
      ],
      limit_per_need: 5,
    });

    expect(res.ok).toBe(true);
    const zhou = res.data?.matched_knowledge_pack.primary_entries.find(entry => entry.entry_name.startsWith('周敦颐——'));
    expect(zhou).toBeTruthy();
    expect(zhou?.summary).toContain('濂溪');
    expect(zhou?.summary).toContain('拒签冤案');
    expect(zhou?.summary.length).toBeGreaterThan(zhou?.entry_name.length ?? 0);
  });

  it('injects domain packs for era, folklore, and GEARS asset boundaries', async () => {
    const res = await multiMatchEntries({
      outline: '周敦颐少年在道县月岩洞读书悟道，做一个民间传说短片，需要宋代服饰和洞穴场景道具边界。',
      knowledge_needs: [
        {
          need_id: 'main_character',
          label: '主人公',
          keywords: ['周敦颐', '月岩洞', '道县'],
          required: true,
        },
      ],
      limit_per_need: 5,
    });

    expect(res.ok).toBe(true);
    const supporting = res.data?.matched_knowledge_pack.supporting_entries ?? [];
    expect(supporting.some(entry => entry.knowledge_domain === 'era_setting' && entry.era === '宋')).toBe(true);
    expect(supporting.some(entry => entry.knowledge_domain === 'folklore_zhiyi')).toBe(true);
    expect(supporting.some(entry =>
      entry.knowledge_domain === 'gears_asset'
      && entry.asset_usage?.includes('scene_props')
      && entry.summary.includes('场景道具'),
    )).toBe(true);
  });

  it('uses client-localized target region when matching cultural influence entries', async () => {
    const res = await multiMatchEntries({
      outline: '甲方只想要周敦颐和长沙相关的故事，重点讲岳麓书院、湖湘学脉和思想文化影响，不要硬写成周敦颐本人在长沙发生的事。',
      knowledge_needs: [
        {
          need_id: 'main_character',
          label: '主人公',
          keywords: ['周敦颐', '长沙', '岳麓书院', '思想文化影响'],
          required: true,
        },
      ],
      limit_per_need: 5,
      localized_target_region: '长沙',
      localization_mode: 'allow_related_influence',
    });

    expect(res.ok).toBe(true);
    const entries = [
      ...(res.data?.matched_knowledge_pack.primary_entries ?? []),
      ...(res.data?.matched_knowledge_pack.supporting_entries ?? []),
    ];
    const zhou = entries.find(entry => entry.entry_name.startsWith('周敦颐——'));
    expect(zhou).toBeTruthy();
    expect(`${zhou?.summary} ${zhou?.match_reason}`).toContain('长沙');
    expect(`${zhou?.summary} ${zhou?.match_reason}`).toContain('地方化');
  });

  it('carries markdown knowledge tags and asset split into matched knowledge packs', async () => {
    const res = await multiMatchEntries({
      outline: '需要月岩洞天然洞穴、洞口岩壁、坐石和书卷的 GEARS 场景资产。',
      knowledge_needs: [
        {
          need_id: 'cultural_background',
          label: '场景资产',
          keywords: ['月岩洞', '天然洞穴', '岩壁', '书卷'],
          required: true,
        },
      ],
      limit_per_need: 8,
    });

    expect(res.ok).toBe(true);
    const entries = [
      ...(res.data?.matched_knowledge_pack.primary_entries ?? []),
      ...(res.data?.matched_knowledge_pack.supporting_entries ?? []),
    ];
    const yueyan = entries.find(entry => entry.entry_name.startsWith('月岩洞——'));
    expect(yueyan).toBeTruthy();
    expect(yueyan?.knowledge_domain).toBe('gears_asset');
    expect(yueyan?.entry_role).toBe('asset_pack');
    expect(yueyan?.asset_usage).toContain('scene_space');
    expect(yueyan?.asset_split?.scenes.some(scene => scene.includes('月岩洞'))).toBe(true);
    expect(yueyan?.asset_split?.scene_props.some(prop => prop.includes('岩壁'))).toBe(true);
    expect(yueyan?.asset_split?.character_props.some(prop => prop.includes('书卷'))).toBe(true);
  });

  it('detects unnamed supporting, crowd, and supernatural characters from outlines', async () => {
    const res = await analyzeOutline({
      outline: '周敦颐在月岩洞读书时，一个老奶奶在洞口点灯。村民围过来听她讲狐仙显灵的传说，书童递上书卷。',
    });

    expect(res.ok).toBe(true);
    const characters = res.data?.detected_characters ?? [];
    expect(characters.find(character => character.name === '周敦颐')?.role_position).toBe('主角');
    expect(characters.find(character => character.name === '老奶奶')).toMatchObject({
      character_kind: 'identity_role',
      role_position: '配角',
      age_range: '老年',
      gender: '女',
    });
    expect(characters.find(character => character.name === '村民')).toMatchObject({
      character_kind: 'group_role',
      role_position: '群演',
    });
    expect(characters.find(character => character.name === '狐仙')).toMatchObject({
      character_kind: 'supernatural_role',
      role_position: '配角',
    });
    expect(res.data?.knowledge_needs.find(need => need.need_id === 'supporting_characters')?.keywords)
      .toEqual(expect.arrayContaining(['老奶奶', '村民', '狐仙', '书童']));
  });

  it('plans AI comic series with selectable episode count, duration range, and continuity state', async () => {
    const res = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，后来面对南安军拒签冤案，坚持良知。每一集用漫剧形式推进他的选择、师友关系和理学思想萌芽。',
      series_title: '濂溪少年志',
      episode_count: 12,
      episode_duration_range_sec: { min: 60, max: 120 },
      pacing_profile: 'mystery_cliffhanger',
      generation_scope: 'full_planning',
      narrative_pattern_ids: ['mortal_growth', 'infinite_mission'],
    });

    expect(res.ok).toBe(true);
    expect(res.data?.series_title).toBe('濂溪少年志');
    expect(res.data?.episode_count).toBe(12);
    expect(res.data?.narrative_pattern_ids).toEqual(['mortal_growth', 'infinite_mission']);
    expect(res.data?.continuity_rules.some(rule =>
      rule.rule_id === 'rule-narrative-patterns' && rule.description.includes('凡人流成长')
    )).toBe(true);
    expect(res.data?.production_notes.join('\n')).toContain('无限流任务生存');
    expect(res.data?.series_spine?.length).toBeGreaterThan(0);
    expect(res.data?.episodes).toHaveLength(12);
    expect(res.data?.episodes.every(episode =>
      episode.target_duration_sec >= 60 && episode.target_duration_sec <= 120
    )).toBe(true);
    expect(res.data?.episodes[0]).toMatchObject({
      opening_hook: expect.any(String),
      midpoint_turn: expect.any(String),
      ending_hook_type: expect.any(String),
      character_state_change: expect.any(String),
      thread_action: expect.any(String),
    });
    expect(res.data?.episodes[1].continuity_from_previous[0]).toContain('第1集');
    expect(res.data?.episodes[11].payoff.length).toBeGreaterThan(0);
    expect(res.data?.continuity_rules.some(rule => rule.rule_id === 'rule-episode-memory')).toBe(true);
  });

  it('generates one full AI comic episode from a series plan', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，后来面对南安军拒签冤案，坚持良知。每一集用漫剧形式推进他的选择、师友关系和理学思想萌芽。',
      series_title: '濂溪少年志',
      episode_count: 4,
      episode_duration_range_sec: { min: 60, max: 120 },
      pacing_profile: 'balanced_drama',
      generation_scope: 'full_planning',
      narrative_pattern_ids: ['infinite_mission'],
    });

    expect(planRes.ok).toBe(true);
    const res = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 2,
      output_gears_segments: false,
      auto_repair_episode: true,
    });

    expect(res.ok).toBe(true);
    expect(res.data?.video_type).toBe('ai_comic_drama');
    expect(res.data?.presentation_style).toBe('ai_comic');
    expect(res.data?.original_user_query).toContain('只生成第2集完整分镜');
    expect(res.data?.original_user_query).toContain('本集蓝图');
    expect(res.data?.original_user_query).toContain('系列主线骨架');
    expect(res.data?.original_user_query).toContain('叙事流派机制');
    expect(res.data?.original_user_query).toContain('无限流任务生存');
    expect(res.data?.scene_breakdown.length).toBeGreaterThan(0);
    expect(res.data?.dialogue?.length).toBeGreaterThan(0);
    expect(res.data?.ai_comic_episode_blueprint?.schema_version).toBe('ai-comic-episode-blueprint/v1');
    expect(res.data?.ai_comic_episode_blueprint?.episode_no).toBe(2);
    expect(res.data?.ai_comic_episode_quality?.schema_version).toBe('ai-comic-episode-quality/v1');
    expect(res.data?.continuity_audit?.schema_version).toBe('ai-comic-continuity-audit/v1');
  });

  it('saves and loads an AI comic series project', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志',
      episode_count: 3,
      episode_duration_range_sec: { min: 60, max: 120 },
      narrative_pattern_ids: ['mortal_growth'],
    });
    expect(planRes.ok).toBe(true);

    const saveRes = await saveAiComicSeriesProject({
      plan: planRes.data!,
      generated_episode_story_ids: {
        1: '20260611-story-abc1',
      },
      memory_recall_preferences: {
        locked_memory_ids: ['character-abc-1'],
        excluded_memory_ids: ['prop-def-2'],
      },
    });

    expect(saveRes.ok).toBe(true);
    expect(saveRes.data?.project.series_project_id).toMatch(/^\d{8}-series-[0-9a-z]+$/);
    expect(saveRes.data?.project.generated_episode_count).toBe(1);
    expect(saveRes.data?.continuity_ledger.schema_version).toBe('ai-comic-continuity-ledger/v1');
    expect(saveRes.data?.continuity_ledger.character_state_current.length).toBeGreaterThan(0);
    expect(saveRes.data?.continuity_ledger.series_memory?.schema_version).toBe('ai-comic-series-memory/v1');
    expect(saveRes.data?.continuity_ledger.series_memory?.characters.length).toBeGreaterThan(0);
    expect(saveRes.data?.continuity_ledger.series_memory?.knowledge_boundaries.length).toBeGreaterThan(0);
    expect(saveRes.data?.continuity_ledger.production_constraints?.schema_version)
      .toBe('ai-comic-production-constraints/v1');
    expect(saveRes.data?.continuity_ledger.production_constraints?.items.length).toBeGreaterThan(0);
    expect(saveRes.data?.memory_recall_preferences?.locked_memory_ids).toContain('character-abc-1');
    expect(saveRes.data?.memory_recall_preferences?.excluded_memory_ids).toContain('prop-def-2');
    expect(saveRes.data?.series_quality_audit?.schema_version).toBe('ai-comic-series-quality-audit/v1');
    expect(saveRes.data?.series_quality_audit?.generated_episode_count).toBe(1);
    expect(saveRes.data?.series_quality_audit?.total_episode_count).toBe(3);
    expect(saveRes.data?.series_quality_audit?.thread_closure_report?.schema_version)
      .toBe('ai-comic-thread-closure-report/v1');
    expect(saveRes.data?.series_quality_audit?.thread_closure_report?.items.length).toBeGreaterThan(0);
    expect(saveRes.data?.series_quality_audit?.memory_conflict_report?.schema_version)
      .toBe('ai-comic-memory-conflict-report/v1');
    expect(saveRes.data?.series_quality_audit?.memory_conflict_report?.total_conflict_count)
      .toBeGreaterThanOrEqual(0);

    const getRes = await getAiComicSeriesProject(saveRes.data!.project.series_project_id);
    expect(getRes.ok).toBe(true);
    expect(getRes.data?.plan.series_title).toBe('濂溪少年志');
    expect(getRes.data?.generated_episode_story_ids['1']).toBe('20260611-story-abc1');
    expect(getRes.data?.memory_recall_preferences?.locked_memory_ids).toContain('character-abc-1');
    expect(getRes.data?.series_quality_audit?.episode_reports[0]).toMatchObject({
      episode_no: 1,
      story_id: '20260611-story-abc1',
      status: 'unknown',
    });

    const listRes = await listAiComicSeriesProjects();
    expect(listRes.ok).toBe(true);
    expect(listRes.data?.some(project => project.series_project_id === saveRes.data!.project.series_project_id)).toBe(true);

    const exportRes = await exportAiComicSeriesBible(saveRes.data!.project.series_project_id);
    expect(exportRes.ok).toBe(true);
    expect(exportRes.data?.schema_version).toBe('ai-comic-series-bible-export/v1');
    expect(exportRes.data?.episode_blueprints).toHaveLength(3);
    expect(exportRes.data?.production_tables.characters.length).toBeGreaterThan(0);
    expect(exportRes.data?.production_tables.threads.length).toBeGreaterThan(0);
    expect(exportRes.data?.production_tables.series_memory.length).toBeGreaterThan(0);
    expect(exportRes.data?.production_tables.production_constraints.length).toBeGreaterThan(0);
    expect(exportRes.data?.production_tables.episodic_memory.length).toBeGreaterThanOrEqual(0);
    expect(exportRes.data?.production_tables.episode_status).toHaveLength(3);
    expect(exportRes.data?.production_tables.episode_status[0]).toMatchObject({
      episode_no: 1,
      status: 'generated',
      story_id: '20260611-story-abc1',
    });
    expect(exportRes.data?.markdown).toContain('# 濂溪少年志 系列 Bible');
    expect(exportRes.data?.markdown).toContain('## 主线剧情骨架');
    expect(exportRes.data?.markdown).toContain('## 连续性账本');
    expect(exportRes.data?.markdown).toContain('## 系列记忆引擎');
    expect(exportRes.data?.markdown).toContain('## 制作表');
    expect(exportRes.data?.markdown).toContain('### 角色表');
    expect(exportRes.data?.markdown).toContain('### 系列记忆表');
    expect(exportRes.data?.markdown).toContain('### 制作约束表');
    expect(exportRes.data?.markdown).toContain('### 情景记忆表');
    expect(exportRes.data?.markdown).toContain('### 分集状态表');
    expect(exportRes.data?.markdown).toContain('线索闭环');
    expect(exportRes.data?.markdown).toContain('记忆冲突');
    expect(exportRes.data?.markdown).toContain('第1集：问题出现');
  });

  it('submits AI comic series GEARS jobs and normalizes callbacks into the production ledgers', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志',
      episode_count: 3,
      episode_duration_range_sec: { min: 60, max: 120 },
    });
    expect(planRes.ok).toBe(true);

    const saveRes = await saveAiComicSeriesProject({ plan: planRes.data! });
    expect(saveRes.ok).toBe(true);

    const episodeRes = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 1,
      series_project_id: saveRes.data!.project.series_project_id,
      output_gears_segments: true,
    });
    expect(episodeRes.ok).toBe(true);
    const refreshSaveRes = await saveAiComicSeriesProject({
      series_project_id: saveRes.data!.project.series_project_id,
      plan: planRes.data!,
      generated_episode_story_ids: {
        1: episodeRes.data!.storyId,
      },
    });
    expect(refreshSaveRes.ok).toBe(true);

    const seedanceExportRes = await exportAiComicSeriesSeedancePrompts(saveRes.data!.project.series_project_id);
    expect(seedanceExportRes.ok).toBe(true);
    const sourceItem = seedanceExportRes.data!.seedance_production!.items[0]!;

    const gearsSubmitRes = await submitAiComicSeriesGearsJobs(saveRes.data!.project.series_project_id, {
      source_unit_id: sourceItem.production_id,
      note: '系列服务测试提交 GEARS',
    });
    expect(gearsSubmitRes.ok).toBe(true);
    expect(gearsSubmitRes.data?.schema_version).toBe('ai-comic-series-gears-job-submit-result/v1');
    expect(gearsSubmitRes.data?.submitted_count).toBe(1);
    expect(gearsSubmitRes.data?.provider_adapter?.status).toBe('mocked');
    const submittedJob = gearsSubmitRes.data!.submitted_jobs[0]!;
    expect(submittedJob).toMatchObject({
      job_type: 'seedance_video',
      source_unit_id: sourceItem.production_id,
      idempotency_key: `seedance_video:${sourceItem.production_id}`,
      status: 'submitted',
    });
    expect(gearsSubmitRes.data?.seedance_production?.items.find(item =>
      item.production_id === sourceItem.production_id
    )).toMatchObject({
      status: 'submitted',
      provider_job_id: submittedJob.gears_job_id,
    });

    const gearsCallbackPayload = {
      data: {
        job: {
          jobId: submittedJob.gears_job_id,
          sourceUnitId: sourceItem.production_id,
          jobType: 'seedance_video',
          job_status: 'COMPLETED',
          outputs: [{
            downloadUrl: 'https://example.com/gears/series-shot-001.mp4',
            type: 'video',
            contentType: 'video/mp4',
          }],
          eventId: 'series-gears-event-001',
          message: 'GEARS v2 render complete',
          progress: 1,
          timestamp: 1781953200000,
          completedAt: '2026-06-20T11:01:00.000Z',
        },
      },
    };
    const callbackRes = await importAiComicSeriesGearsCallback(saveRes.data!.project.series_project_id, gearsCallbackPayload);
    expect(callbackRes.ok).toBe(true);
    expect(callbackRes.data?.schema_version).toBe('ai-comic-series-gears-job-callback-result/v1');
    expect(callbackRes.data?.received_count).toBe(1);
    expect(callbackRes.data?.updated_count).toBe(1);
    expect(callbackRes.data?.duplicate_count).toBe(0);
    expect(callbackRes.data?.status).toBe('ready');
    expect(callbackRes.data?.gears_job_ledger?.items.find(item =>
      item.gears_job_id === submittedJob.gears_job_id
    )).toMatchObject({
      status: 'ready',
      progress_percent: 100,
      completed_at: '2026-06-20T11:01:00.000Z',
      artifact_urls: ['https://example.com/gears/series-shot-001.mp4'],
    });
    expect(callbackRes.data?.gears_job_ledger?.items.find(item =>
      item.gears_job_id === submittedJob.gears_job_id
    )?.callback_events?.find(event => event.event_id === 'series-gears-event-001')).toMatchObject({
      provider_event_at: '2026-06-20T11:00:00.000Z',
      status: 'ready',
    });
    expect(callbackRes.data?.seedance_production?.items.find(item =>
      item.production_id === sourceItem.production_id
    )).toMatchObject({
      status: 'ready',
      provider_job_id: submittedJob.gears_job_id,
      video_url: 'https://example.com/gears/series-shot-001.mp4',
    });

    const duplicateCallbackRes = await importAiComicSeriesGearsCallback(
      saveRes.data!.project.series_project_id,
      gearsCallbackPayload,
    );
    expect(duplicateCallbackRes.ok).toBe(true);
    expect(duplicateCallbackRes.data).toMatchObject({
      received_count: 1,
      updated_count: 1,
      failed_count: 0,
      duplicate_count: 1,
    });
    const duplicateGearsItem = duplicateCallbackRes.data?.gears_job_ledger?.items.find(item =>
      item.gears_job_id === submittedJob.gears_job_id
    );
    expect(duplicateGearsItem?.callback_events?.filter(event => event.event_id === 'series-gears-event-001'))
      .toHaveLength(1);
    expect(duplicateCallbackRes.data?.seedance_production?.items.find(item =>
      item.production_id === sourceItem.production_id
    )?.versions.filter(version => version.video_url === 'https://example.com/gears/series-shot-001.mp4')).toHaveLength(1);

    const idempotencyOnlyCallbackRes = await importAiComicSeriesGearsCallback(
      saveRes.data!.project.series_project_id,
      {
        jobType: 'seedance_video',
        taskStatus: 'PROCESSING',
        progress: 0.75,
        idempotencyKey: `seedance_video:${sourceItem.production_id}`,
        message: 'late GEARS processing webhook by idempotency key',
      },
    );
    expect(idempotencyOnlyCallbackRes.ok).toBe(true);
    expect(idempotencyOnlyCallbackRes.data).toMatchObject({
      received_count: 1,
      updated_count: 1,
      failed_count: 0,
      duplicate_count: 0,
      status: 'ready',
      source_unit_id: sourceItem.production_id,
    });
    const idempotencyOnlyItem = idempotencyOnlyCallbackRes.data?.gears_job_ledger?.items.find(item =>
      item.source_unit_id === sourceItem.production_id
    );
    expect(idempotencyOnlyItem).toMatchObject({
      idempotency_key: `seedance_video:${sourceItem.production_id}`,
      status: 'ready',
      artifact_urls: ['https://example.com/gears/series-shot-001.mp4'],
    });
    expect(idempotencyOnlyItem?.callback_events?.find(event =>
      event.event_id === `seedance_video:${sourceItem.production_id}`
    )).toMatchObject({
      event_id_source: 'idempotency_key',
      status: 'processing',
      applied_status: 'ready',
      status_regression_ignored: true,
      progress_percent: 75,
    });

    const staleCallbackRes = await importAiComicSeriesGearsCallback(
      saveRes.data!.project.series_project_id,
      {
        jobId: submittedJob.gears_job_id,
        sourceUnitId: sourceItem.production_id,
        jobType: 'seedance_video',
        taskStatus: 'PROCESSING',
        progressPercent: 35,
        eventId: 'series-gears-event-stale-processing',
        message: 'late series GEARS processing webhook',
      },
    );
    expect(staleCallbackRes.ok).toBe(true);
    expect(staleCallbackRes.data).toMatchObject({
      received_count: 1,
      updated_count: 1,
      failed_count: 0,
      duplicate_count: 0,
      status: 'ready',
    });
    const staleGearsItem = staleCallbackRes.data?.gears_job_ledger?.items.find(item =>
      item.gears_job_id === submittedJob.gears_job_id
    );
    expect(staleGearsItem).toMatchObject({
      status: 'ready',
      progress_percent: 100,
      artifact_urls: ['https://example.com/gears/series-shot-001.mp4'],
    });
    expect(staleGearsItem?.callback_events?.find(event =>
      event.event_id === 'series-gears-event-stale-processing'
    )).toMatchObject({
      status: 'processing',
      applied_status: 'ready',
      status_regression_ignored: true,
      progress_percent: 35,
    });
    expect(staleCallbackRes.data?.seedance_production?.items.find(item =>
      item.production_id === sourceItem.production_id
    )).toMatchObject({
      status: 'ready',
      video_url: 'https://example.com/gears/series-shot-001.mp4',
    });
    expect(staleCallbackRes.data?.seedance_production?.items.find(item =>
      item.production_id === sourceItem.production_id
    )?.versions.filter(version => version.video_url === 'https://example.com/gears/series-shot-001.mp4')).toHaveLength(1);

    const terminalConflictRes = await importAiComicSeriesGearsCallback(
      saveRes.data!.project.series_project_id,
      {
        jobId: submittedJob.gears_job_id,
        sourceUnitId: sourceItem.production_id,
        jobType: 'seedance_video',
        taskStatus: 'FAILED',
        eventId: 'series-gears-event-terminal-failed-after-ready',
        failureReason: 'GEARS later rejected the rendered clip',
        errorCode: 'ARTIFACT_REJECTED',
        completedAt: '2026-06-20T11:02:00.000Z',
      },
    );
    expect(terminalConflictRes.ok).toBe(true);
    expect(terminalConflictRes.data).toMatchObject({
      received_count: 1,
      updated_count: 1,
      failed_count: 0,
      duplicate_count: 0,
      status: 'failed',
    });
    const terminalConflictItem = terminalConflictRes.data?.gears_job_ledger?.items.find(item =>
      item.gears_job_id === submittedJob.gears_job_id
    );
    expect(terminalConflictItem).toMatchObject({
      status: 'failed',
      completed_at: '2026-06-20T11:02:00.000Z',
      artifact_urls: ['https://example.com/gears/series-shot-001.mp4'],
      error_code: 'ARTIFACT_REJECTED',
      failure_reason: 'GEARS later rejected the rendered clip',
    });
    expect(terminalConflictItem?.callback_events?.find(event =>
      event.event_id === 'series-gears-event-terminal-failed-after-ready'
    )).toMatchObject({
      previous_status: 'ready',
      status: 'failed',
      applied_status: 'failed',
      terminal_status_changed: true,
    });
    expect(terminalConflictRes.data?.seedance_production?.items.find(item =>
      item.production_id === sourceItem.production_id
    )).toMatchObject({
      status: 'failed',
      video_url: 'https://example.com/gears/series-shot-001.mp4',
      failure_reason: 'GEARS later rejected the rendered clip',
    });

    const canceledCallbackRes = await importAiComicSeriesGearsCallback(
      saveRes.data!.project.series_project_id,
      {
        jobId: submittedJob.gears_job_id,
        sourceUnitId: sourceItem.production_id,
        jobType: 'seedance_video',
        taskStatus: 'CANCELED',
        eventId: 'series-gears-event-canceled-with-reason',
        failureReason: 'GEARS operator canceled the series render',
        errorCode: 'MANUAL_CANCEL',
      },
    );
    expect(canceledCallbackRes.ok).toBe(true);
    expect(canceledCallbackRes.data).toMatchObject({
      received_count: 1,
      updated_count: 1,
      failed_count: 0,
      duplicate_count: 0,
      status: 'canceled',
    });
    const canceledGearsItem = canceledCallbackRes.data?.gears_job_ledger?.items.find(item =>
      item.gears_job_id === submittedJob.gears_job_id
    );
    expect(canceledGearsItem).toMatchObject({
      status: 'canceled',
      error_code: 'MANUAL_CANCEL',
      failure_reason: 'GEARS operator canceled the series render',
      failure_category: 'unknown',
    });
    expect(canceledGearsItem?.callback_events?.find(event =>
      event.event_id === 'series-gears-event-canceled-with-reason'
    )).toMatchObject({
      previous_status: 'failed',
      status: 'canceled',
      applied_status: 'canceled',
      terminal_status_changed: true,
    });
    expect(canceledCallbackRes.data?.seedance_production?.items.find(item =>
      item.production_id === sourceItem.production_id
    )).toMatchObject({
      status: 'failed',
      video_url: 'https://example.com/gears/series-shot-001.mp4',
      failure_reason: 'GEARS operator canceled the series render',
    });
  });

  it('builds AI comic series production readiness across quality, episodes, dashboard, and GEARS', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志 readiness',
      episode_count: 2,
      episode_duration_range_sec: { min: 60, max: 120 },
    });
    expect(planRes.ok).toBe(true);

    const saveRes = await saveAiComicSeriesProject({ plan: planRes.data! });
    expect(saveRes.ok).toBe(true);
    const seriesProjectId = saveRes.data!.project.series_project_id;

    const episodeRes = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 1,
      series_project_id: seriesProjectId,
      output_gears_segments: true,
    });
    expect(episodeRes.ok).toBe(true);

    const refreshSaveRes = await saveAiComicSeriesProject({
      series_project_id: seriesProjectId,
      plan: planRes.data!,
      generated_episode_story_ids: {
        1: episodeRes.data!.storyId,
      },
    });
    expect(refreshSaveRes.ok).toBe(true);

    const seedanceExportRes = await exportAiComicSeriesSeedancePrompts(seriesProjectId);
    expect(seedanceExportRes.ok).toBe(true);
    const sourceItem = seedanceExportRes.data!.seedance_production!.items[0]!;

    const submitRes = await submitAiComicSeriesGearsJobs(seriesProjectId, {
      source_unit_id: sourceItem.production_id,
      note: 'series readiness test submit',
    });
    expect(submitRes.ok).toBe(true);

    const readiness = await getAiComicSeriesProductionReadiness(seriesProjectId);
    const gearsLane = readiness.data?.lanes.find(lane => lane.key === 'gears_execution');

    expect(readiness.ok).toBe(true);
    expect(readiness.data?.schema_version).toBe('ai-comic-series-production-readiness/v1');
    expect(readiness.data?.scope).toBe('ai_comic_series');
    expect(readiness.data?.summary.generated_episode_count).toBe(1);
    expect(readiness.data?.summary.total_episode_count).toBe(2);
    expect(readiness.data?.summary.gears_job_count).toBe(1);
    expect(readiness.data?.summary.active_gears_job_count).toBe(1);
    expect(readiness.data?.issues.map(issue => issue.issue_id)).toContain('episodes-not-complete');
    expect(readiness.data?.next_actions.map(action => action.action_key)).toContain('generate_next_episode');
    expect(readiness.data?.automation_plan.schema_version).toBe('production-readiness-automation-plan/v1');
    const generateStep = readiness.data?.automation_plan.steps.find(step => step.action_key === 'generate_next_episode');
    expect(generateStep).toMatchObject({
      runner: 'story_agent_api',
      mode: 'writes_project',
      can_auto_execute: true,
      api: {
        method: 'POST',
        path: '/api/story-outline/ai-comic-episode',
      },
    });
    const dryRun = await runAiComicSeriesProductionReadinessAutomation(seriesProjectId, {
      dry_run: true,
      action_keys: ['generate_next_episode'],
    });
    expect(dryRun.ok).toBe(true);
    expect(dryRun.data?.planned_step_count).toBe(1);
    expect(dryRun.data?.executed_step_count).toBe(0);
    expect(dryRun.data?.after_readiness.summary.generated_episode_count).toBe(1);
    const automationRun = await runAiComicSeriesProductionReadinessAutomation(seriesProjectId, {
      dry_run: false,
      action_keys: ['generate_next_episode'],
    });
    expect(automationRun.ok).toBe(true);
    expect(automationRun.data?.executed_step_count).toBe(1);
    expect(automationRun.data?.after_readiness.summary.generated_episode_count).toBe(2);
    expect(automationRun.data?.after_readiness.latest_automation_run).toMatchObject({
      scope: 'ai_comic_series',
      project_id: seriesProjectId,
      dry_run: false,
      executed_step_count: 1,
      failed_step_count: 0,
    });
    expect(automationRun.data?.after_readiness.automation_ledger?.total_run_count).toBe(1);
    expect(automationRun.data?.after_readiness.markdown).toContain('Latest Automation Run');
    expect(gearsLane?.status).toBe('needs_action');
    expect(readiness.data?.episodes[0]).toMatchObject({
      episode_no: 1,
      total_shot_count: expect.any(Number),
    });
    expect(readiness.data?.markdown).toContain('系列制作 readiness');
    expect(readiness.data?.markdown).toContain('Automation Plan');
  });

  it('imports batched AI comic series GEARS callbacks into production ledgers', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志',
      episode_count: 3,
      episode_duration_range_sec: { min: 60, max: 120 },
    });
    expect(planRes.ok).toBe(true);

    const saveRes = await saveAiComicSeriesProject({ plan: planRes.data! });
    expect(saveRes.ok).toBe(true);

    const episodeRes = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 1,
      series_project_id: saveRes.data!.project.series_project_id,
      output_gears_segments: true,
    });
    expect(episodeRes.ok).toBe(true);
    const refreshSaveRes = await saveAiComicSeriesProject({
      series_project_id: saveRes.data!.project.series_project_id,
      plan: planRes.data!,
      generated_episode_story_ids: {
        1: episodeRes.data!.storyId,
      },
    });
    expect(refreshSaveRes.ok).toBe(true);

    const seedanceExportRes = await exportAiComicSeriesSeedancePrompts(saveRes.data!.project.series_project_id);
    expect(seedanceExportRes.ok).toBe(true);
    const sourceItems = seedanceExportRes.data!.seedance_production!.items.slice(0, 2);
    expect(sourceItems).toHaveLength(2);

    const submitRes = await submitAiComicSeriesGearsJobs(saveRes.data!.project.series_project_id, {
      source_unit_ids: sourceItems.map(item => item.production_id),
      note: '系列 GEARS 批量回调测试提交',
    });
    expect(submitRes.ok).toBe(true);
    const jobs = submitRes.data!.submitted_jobs;

    const callbackRes = await importAiComicSeriesGearsCallbacks(saveRes.data!.project.series_project_id, {
      data: {
        tasks: [
          ...jobs.map((job, index) => ({
            jobId: job.gears_job_id,
            sourceUnitId: job.source_unit_id,
            jobType: 'seedance_video' as const,
            taskStatus: 'COMPLETED',
            outputUrl: `https://example.com/gears/series-batch-shot-${index + 1}.mp4`,
          })),
          {
            jobType: 'seedance_video',
            taskStatus: 'COMPLETED',
            outputUrl: 'https://example.com/gears/series-missing-id.mp4',
          },
        ],
      },
    });

    expect(callbackRes.ok).toBe(true);
    expect(callbackRes.data).toMatchObject({
      schema_version: 'ai-comic-series-gears-job-callback-result/v1',
      received_count: 3,
      updated_count: 2,
      failed_count: 1,
      duplicate_count: 0,
      failures: [{
        index: 2,
        path: 'data.tasks[2]',
        message: expect.stringContaining('requires a known gears_job_id, source_unit_id, or idempotency_key'),
      }],
    });
    expect(callbackRes.data?.seedance_production?.items.find(item =>
      item.production_id === sourceItems[0]!.production_id
    )).toMatchObject({
      status: 'ready',
      provider_job_id: jobs[0]!.gears_job_id,
      video_url: 'https://example.com/gears/series-batch-shot-1.mp4',
    });
    expect(callbackRes.data?.seedance_production?.items.find(item =>
      item.production_id === sourceItems[1]!.production_id
    )).toMatchObject({
      status: 'ready',
      provider_job_id: jobs[1]!.gears_job_id,
      video_url: 'https://example.com/gears/series-batch-shot-2.mp4',
    });
  });

  it('rejects oversized AI comic series GEARS callback batches before project lookup', async () => {
    const callbacks = Array.from({ length: GEARS_CALLBACK_BATCH_ITEM_LIMIT + 1 }, (_, index) => ({
      jobId: `gears-series-too-many-${index}`,
      sourceUnitId: `episode:1:shot:${index}`,
      jobType: 'seedance_video' as const,
      taskStatus: 'COMPLETED',
    }));

    const result = await importAiComicSeriesGearsCallbacks('20260616-series-missing', { callbacks });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
    expect(result.error?.message).toContain(`GEARS callback batch item count must be <= ${GEARS_CALLBACK_BATCH_ITEM_LIMIT}`);
  });

  it('submits AI comic series retry candidates to GEARS with retry context payload', async () => {
    process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
    process.env.GEARS_API_TOKEN = 'series-gears-token';

    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志',
      episode_count: 3,
      episode_duration_range_sec: { min: 60, max: 120 },
    });
    expect(planRes.ok).toBe(true);

    const saveRes = await saveAiComicSeriesProject({ plan: planRes.data! });
    expect(saveRes.ok).toBe(true);
    const seriesProjectId = saveRes.data!.project.series_project_id;

    const episodeRes = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 1,
      series_project_id: seriesProjectId,
      output_gears_segments: true,
    });
    expect(episodeRes.ok).toBe(true);
    const refreshSaveRes = await saveAiComicSeriesProject({
      series_project_id: seriesProjectId,
      plan: planRes.data!,
      generated_episode_story_ids: {
        1: episodeRes.data!.storyId,
      },
    });
    expect(refreshSaveRes.ok).toBe(true);

    const seedanceExportRes = await exportAiComicSeriesSeedancePrompts(seriesProjectId);
    expect(seedanceExportRes.ok).toBe(true);
    const sourceItem = seedanceExportRes.data!.seedance_production!.items[0]!;
    const failedUpdateRes = await updateAiComicSeriesSeedanceProductionStatus(seriesProjectId, {
      episode_no: sourceItem.episode_no,
      shot_id: sourceItem.shot_id,
      status: 'failed',
      provider_job_id: 'old-gears-job-001',
      video_url: 'https://gears.example.test/old/shot-1.mp4',
      failure_reason: 'GEARS worker returned moderation warning',
      increment_retry: true,
      note: 'prepare GEARS retry submit payload smoke',
    });
    expect(failedUpdateRes.ok).toBe(true);

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe('https://gears.example.test/api-root/gears/jobs');
      expect(init?.method).toBe('POST');
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer series-gears-token');
      const body = JSON.parse(String(init?.body)) as {
        schema_version?: string;
        series_project_id?: string;
        job_type?: string;
        payload?: {
          units?: Array<{
            schema_version?: string;
            source_unit_id?: string;
            production_id?: string;
            status?: string;
            retry_count?: number;
            retry_reason?: string;
            failure_reason?: string;
            previous_provider_job_id?: string;
            last_video_url?: string;
            source_retry_execution_plan_exported_at?: string;
            source_retry_package_exported_at?: string;
            request_payload?: Record<string, unknown>;
            metadata?: Record<string, unknown>;
          }>;
        };
      };
      expect(body).toMatchObject({
        schema_version: 'gears-execution-submit/v1',
        series_project_id: seriesProjectId,
        job_type: 'seedance_video',
      });
      expect(body.payload?.units).toHaveLength(1);
      const unit = body.payload?.units?.[0];
      expect(unit).toMatchObject({
        schema_version: 'gears-series-seedance-video-retry-payload/v1',
        source_unit_id: sourceItem.production_id,
        production_id: sourceItem.production_id,
        status: 'failed',
        retry_count: 1,
        retry_reason: 'production_status',
        failure_reason: 'GEARS worker returned moderation warning',
        previous_provider_job_id: 'old-gears-job-001',
        last_video_url: 'https://gears.example.test/old/shot-1.mp4',
        request_payload: {
          retry_batch_id: 'batch-001',
        },
        metadata: expect.objectContaining({
          series_project_id: seriesProjectId,
          job_type: 'seedance_video',
          source_unit_id: sourceItem.production_id,
        }),
      });
      expect(unit?.source_retry_execution_plan_exported_at).toEqual(expect.any(String));
      expect(unit?.source_retry_package_exported_at).toEqual(expect.any(String));
      return new Response(JSON.stringify({
        jobs: [{
          source_unit_id: sourceItem.production_id,
          gears_job_id: 'gears-retry-real-job-001',
          status: 'queued',
        }],
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const submitRes = await submitAiComicSeriesGearsJobs(seriesProjectId, {
      job_type: 'seedance_video',
      source_unit_id: sourceItem.production_id,
      use_gears_api: true,
      payload: {
        retry_batch_id: 'batch-001',
      },
      note: '系列 GEARS retry payload smoke',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(submitRes.ok).toBe(true);
    expect(submitRes.data).toMatchObject({
      job_type: 'seedance_video',
      job_type_label: '视频返修/重试',
      submit_intent: expect.stringContaining('重试执行计划'),
      submitted_count: 1,
      failed_count: 0,
      provider_adapter: {
        endpoint_configured: true,
        status: 'submitted',
        requested_count: 1,
        accepted_count: 1,
      },
      submitted_jobs: [{
        source_unit_id: sourceItem.production_id,
        gears_job_id: 'gears-retry-real-job-001',
      }],
    });
    expect(submitRes.data?.markdown).toContain('submit_intent: 从 AI 漫剧 Seedance 重试执行计划提交 GEARS v2 视频返修/重试任务');
    expect(submitRes.data?.markdown).toContain('## GEARS Adapter');
    expect(submitRes.data?.markdown).toContain('- accepted_count: 1');
    expect(submitRes.data?.seedance_production?.items.find(item =>
      item.production_id === sourceItem.production_id
    )).toMatchObject({
      status: 'submitted',
      provider_job_id: 'gears-retry-real-job-001',
      retry_count: 2,
    });
  });

  it('syncs AI comic series GEARS job status through the HTTP status contract', async () => {
    process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
    process.env.GEARS_API_TOKEN = 'series-gears-token';

    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志',
      episode_count: 3,
      episode_duration_range_sec: { min: 60, max: 120 },
    });
    expect(planRes.ok).toBe(true);

    const saveRes = await saveAiComicSeriesProject({ plan: planRes.data! });
    expect(saveRes.ok).toBe(true);

    const episodeRes = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 1,
      series_project_id: saveRes.data!.project.series_project_id,
      output_gears_segments: true,
    });
    expect(episodeRes.ok).toBe(true);
    const refreshSaveRes = await saveAiComicSeriesProject({
      series_project_id: saveRes.data!.project.series_project_id,
      plan: planRes.data!,
      generated_episode_story_ids: {
        1: episodeRes.data!.storyId,
      },
    });
    expect(refreshSaveRes.ok).toBe(true);

    const seedanceExportRes = await exportAiComicSeriesSeedancePrompts(saveRes.data!.project.series_project_id);
    expect(seedanceExportRes.ok).toBe(true);
    const sourceItems = seedanceExportRes.data!.seedance_production!.items.slice(0, 2);
    expect(sourceItems).toHaveLength(2);
    const [readySourceItem, failedSourceItem] = sourceItems;

    const submitRes = await submitAiComicSeriesGearsJobs(saveRes.data!.project.series_project_id, {
      source_unit_ids: sourceItems.map(item => item.production_id),
      note: '系列 GEARS 同步测试提交',
    });
    expect(submitRes.ok).toBe(true);
    expect(submitRes.data!.submitted_jobs).toHaveLength(2);
    const readyJob = submitRes.data!.submitted_jobs.find(item => item.source_unit_id === readySourceItem.production_id)!;
    const failedJob = submitRes.data!.submitted_jobs.find(item => item.source_unit_id === failedSourceItem.production_id)!;

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const url = String(_url);
      expect(init?.method).toBe('GET');
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer series-gears-token');
      if (url === `https://gears.example.test/api-root/gears/jobs/${encodeURIComponent(failedJob.gears_job_id)}`) {
        return new Response('temporary GEARS outage', { status: 503 });
      }
      expect(url).toBe(`https://gears.example.test/api-root/gears/jobs/${encodeURIComponent(readyJob.gears_job_id)}`);
      return new Response(JSON.stringify({
        data: {
          task: {
            id: readyJob.gears_job_id,
            externalId: readySourceItem.production_id,
            jobType: 'seedance_video',
            task_state: 'done',
            progressPercent: '87.5',
            outputs: [{
              downloadUrl: 'https://gears.example.test/media/series-shot-001.mp4',
              type: 'video',
              contentType: 'video/mp4',
            }],
            message: 'GEARS series status sync ready',
          },
        },
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const syncRes = await syncAiComicSeriesGearsJobStatuses(saveRes.data!.project.series_project_id, {
      job_type: 'seedance_video',
      note: 'GEARS series sync smoke',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(syncRes.ok).toBe(true);
    expect(syncRes.data).toMatchObject({
      schema_version: 'ai-comic-series-gears-job-sync-result/v1',
      pollable_count: 2,
      synced_count: 1,
      failed_count: 1,
      duplicate_count: 0,
      provider_adapter: {
        endpoint_configured: true,
        requested_count: 2,
        returned_count: 1,
        failed_count: 1,
      },
      synced_jobs: [{
        source_unit_id: readySourceItem.production_id,
        gears_job_id: readyJob.gears_job_id,
        status: 'ready',
        progress_percent: 87.5,
        artifact_urls: ['https://gears.example.test/media/series-shot-001.mp4'],
      }],
    });
    expect(syncRes.data?.seedance_production?.items.find(item =>
      item.production_id === readySourceItem.production_id
    )).toMatchObject({
      status: 'ready',
      provider_job_id: readyJob.gears_job_id,
      video_url: 'https://gears.example.test/media/series-shot-001.mp4',
    });
    expect(syncRes.data?.seedance_production?.items.find(item =>
      item.production_id === failedSourceItem.production_id
    )).toMatchObject({
      status: 'submitted',
      provider_job_id: failedJob.gears_job_id,
    });
    expect(syncRes.data?.gears_job_ledger?.items.find(item =>
      item.gears_job_id === failedJob.gears_job_id
    )).toMatchObject({
      status: 'submitted',
      last_poll_at: expect.any(String),
      last_poll_error: expect.stringContaining('HTTP 503'),
      last_poll_failure_category: 'provider_server_error',
      last_poll_error_code: 'HTTP_503',
    });
    expect(syncRes.data?.failures[0]).toMatchObject({
      source_unit_id: failedSourceItem.production_id,
      gears_job_id: failedJob.gears_job_id,
    });
    expect(syncRes.data?.failures[0]?.message).toContain('HTTP 503');
    expect(syncRes.data?.markdown).toContain('GEARS job sync');

    const duplicateSyncRes = await syncAiComicSeriesGearsJobStatuses(saveRes.data!.project.series_project_id, {
      job_type: 'seedance_video',
      include_completed: true,
      note: 'GEARS series sync smoke',
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(duplicateSyncRes.ok).toBe(true);
    expect(duplicateSyncRes.data).toMatchObject({
      schema_version: 'ai-comic-series-gears-job-sync-result/v1',
      pollable_count: 2,
      synced_count: 1,
      failed_count: 1,
      duplicate_count: 1,
      failures: [{
        source_unit_id: failedSourceItem.production_id,
        gears_job_id: failedJob.gears_job_id,
      }],
    });
    expect(duplicateSyncRes.data?.markdown).toContain('duplicate_count: 1');
  });

  it('normalizes failed AI comic series GEARS status responses into production ledgers', async () => {
    process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
    process.env.GEARS_API_TOKEN = 'series-gears-token';

    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志',
      episode_count: 3,
      episode_duration_range_sec: { min: 60, max: 120 },
    });
    expect(planRes.ok).toBe(true);

    const saveRes = await saveAiComicSeriesProject({ plan: planRes.data! });
    expect(saveRes.ok).toBe(true);

    const episodeRes = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 1,
      series_project_id: saveRes.data!.project.series_project_id,
      output_gears_segments: true,
    });
    expect(episodeRes.ok).toBe(true);
    const refreshSaveRes = await saveAiComicSeriesProject({
      series_project_id: saveRes.data!.project.series_project_id,
      plan: planRes.data!,
      generated_episode_story_ids: {
        1: episodeRes.data!.storyId,
      },
    });
    expect(refreshSaveRes.ok).toBe(true);

    const seedanceExportRes = await exportAiComicSeriesSeedancePrompts(saveRes.data!.project.series_project_id);
    expect(seedanceExportRes.ok).toBe(true);
    const sourceItem = seedanceExportRes.data!.seedance_production!.items[0]!;

    const submitRes = await submitAiComicSeriesGearsJobs(saveRes.data!.project.series_project_id, {
      source_unit_id: sourceItem.production_id,
      note: '系列 GEARS 失败状态同步测试提交',
    });
    expect(submitRes.ok).toBe(true);
    const job = submitRes.data!.submitted_jobs[0]!;

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe(`https://gears.example.test/api-root/gears/jobs/${encodeURIComponent(job.gears_job_id)}`);
      expect(init?.method).toBe('GET');
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer series-gears-token');
      return new Response(JSON.stringify({
        jobId: job.gears_job_id,
        sourceUnitId: sourceItem.production_id,
        jobType: 'seedance_video',
        status: 'FAILED',
        errorCode: 'RISK_CONTROL',
        failureReason: 'GEARS content policy rejected the video job',
        message: 'GEARS failed with moderation issue',
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const syncRes = await syncAiComicSeriesGearsJobStatuses(saveRes.data!.project.series_project_id, {
      job_type: 'seedance_video',
      note: 'GEARS series failed status sync smoke',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(syncRes.ok).toBe(true);
    expect(syncRes.data).toMatchObject({
      schema_version: 'ai-comic-series-gears-job-sync-result/v1',
      pollable_count: 1,
      synced_count: 1,
      failed_count: 0,
      synced_jobs: [{
        source_unit_id: sourceItem.production_id,
        gears_job_id: job.gears_job_id,
        status: 'failed',
        failure_category: 'content_policy',
        error_code: 'RISK_CONTROL',
        failure_reason: 'GEARS content policy rejected the video job',
      }],
    });
    expect(syncRes.data?.seedance_production?.items.find(item =>
      item.production_id === sourceItem.production_id
    )).toMatchObject({
      status: 'failed',
      provider_job_id: job.gears_job_id,
      failure_reason: 'GEARS content policy rejected the video job',
    });
    expect(syncRes.data?.markdown).toContain('GEARS job sync');
  });

  it('derives AI comic series GEARS failure category from platform status aliases', async () => {
    process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
    process.env.GEARS_API_TOKEN = 'series-gears-token';

    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志',
      episode_count: 3,
      episode_duration_range_sec: { min: 60, max: 120 },
    });
    expect(planRes.ok).toBe(true);

    const saveRes = await saveAiComicSeriesProject({ plan: planRes.data! });
    expect(saveRes.ok).toBe(true);

    const episodeRes = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 1,
      series_project_id: saveRes.data!.project.series_project_id,
      output_gears_segments: true,
    });
    expect(episodeRes.ok).toBe(true);
    const refreshSaveRes = await saveAiComicSeriesProject({
      series_project_id: saveRes.data!.project.series_project_id,
      plan: planRes.data!,
      generated_episode_story_ids: {
        1: episodeRes.data!.storyId,
      },
    });
    expect(refreshSaveRes.ok).toBe(true);

    const seedanceExportRes = await exportAiComicSeriesSeedancePrompts(saveRes.data!.project.series_project_id);
    expect(seedanceExportRes.ok).toBe(true);
    const sourceItem = seedanceExportRes.data!.seedance_production!.items[0]!;

    const submitRes = await submitAiComicSeriesGearsJobs(saveRes.data!.project.series_project_id, {
      source_unit_id: sourceItem.production_id,
      note: '系列 GEARS 状态别名同步测试提交',
    });
    expect(submitRes.ok).toBe(true);
    const job = submitRes.data!.submitted_jobs[0]!;

    const fetchMock = vi.fn(async (_url: string | URL | Request) => {
      expect(String(_url)).toBe(`https://gears.example.test/api-root/gears/jobs/${encodeURIComponent(job.gears_job_id)}`);
      return new Response(JSON.stringify({
        jobId: job.gears_job_id,
        sourceUnitId: sourceItem.production_id,
        jobType: 'seedance_video',
        status: 'POLICY_BLOCKED',
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const syncRes = await syncAiComicSeriesGearsJobStatuses(saveRes.data!.project.series_project_id, {
      job_type: 'seedance_video',
      note: 'GEARS series status alias sync smoke',
    });

    expect(syncRes.ok).toBe(true);
    expect(syncRes.data?.synced_jobs[0]).toMatchObject({
      source_unit_id: sourceItem.production_id,
      gears_job_id: job.gears_job_id,
      status: 'rejected',
      failure_category: 'content_policy',
      failure_reason: 'POLICY_BLOCKED',
    });
    expect(syncRes.data?.seedance_production?.items.find(item =>
      item.production_id === sourceItem.production_id
    )).toMatchObject({
      status: 'failed',
      provider_job_id: job.gears_job_id,
      failure_reason: 'POLICY_BLOCKED',
    });
  });

  it('submits AI comic series post-production GEARS jobs from production contracts', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志',
      episode_count: 3,
      episode_duration_range_sec: { min: 60, max: 120 },
    });
    expect(planRes.ok).toBe(true);

    const saveRes = await saveAiComicSeriesProject({ plan: planRes.data! });
    expect(saveRes.ok).toBe(true);
    const seriesProjectId = saveRes.data!.project.series_project_id;

    const episodeRes = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 1,
      series_project_id: seriesProjectId,
      output_gears_segments: true,
    });
    expect(episodeRes.ok).toBe(true);
    const refreshSaveRes = await saveAiComicSeriesProject({
      series_project_id: seriesProjectId,
      plan: planRes.data!,
      generated_episode_story_ids: {
        1: episodeRes.data!.storyId,
      },
    });
    expect(refreshSaveRes.ok).toBe(true);

    const seedanceExportRes = await exportAiComicSeriesSeedancePrompts(seriesProjectId);
    expect(seedanceExportRes.ok).toBe(true);
    const sourceItem = seedanceExportRes.data!.seedance_production!.items[0]!;
    const readyRes = await updateAiComicSeriesSeedanceProductionStatus(seriesProjectId, {
      episode_no: sourceItem.episode_no,
      shot_id: sourceItem.shot_id,
      status: 'ready',
      provider_job_id: 'seedance-ready-for-gears-post',
      video_url: 'https://example.com/seedance/ready-for-post.mp4',
      note: '准备 GEARS 后期任务合同',
    });
    expect(readyRes.ok).toBe(true);

    const cutRes = await assembleAiComicSeriesSeedanceCut(seriesProjectId, { dry_run: true });
    expect(cutRes.ok).toBe(true);
    const titlePlanRes = await exportAiComicSeriesSeedanceTitleCardPlanPackage(seriesProjectId);
    expect(titlePlanRes.ok).toBe(true);
    const firstCard = titlePlanRes.data!.cards[0]!;

    const subtitleRes = await submitAiComicSeriesGearsJobs(seriesProjectId, {
      job_type: 'subtitle_render',
      source_unit_id: 'subtitle:series',
      note: '提交 GEARS 字幕渲染任务',
    });
    expect(subtitleRes.ok).toBe(true);
    expect(subtitleRes.data).toMatchObject({
      submitted_count: 1,
      failed_count: 0,
      submitted_jobs: [{
        job_type: 'subtitle_render',
        source_unit_id: 'subtitle:series',
        status: 'submitted',
      }],
    });
    expect(subtitleRes.data?.submitted_jobs[0].payload_summary).toContain('cues');

    const audioRes = await submitAiComicSeriesGearsJobs(seriesProjectId, {
      job_type: 'audio_mix',
      source_unit_id: 'audio_mix:series',
      note: '提交 GEARS 混音任务',
    });
    expect(audioRes.ok).toBe(true);
    expect(audioRes.data?.submitted_jobs[0]).toMatchObject({
      job_type: 'audio_mix',
      source_unit_id: 'audio_mix:series',
      status: 'submitted',
    });
    expect(audioRes.data?.submitted_jobs[0].payload_summary).toContain('cues');

    const titleRes = await submitAiComicSeriesGearsJobs(seriesProjectId, {
      job_type: 'title_card_render',
      source_unit_id: firstCard.card_id,
      note: '提交 GEARS 片头片尾任务',
    });
    expect(titleRes.ok).toBe(true);
    expect(titleRes.data?.submitted_jobs[0]).toMatchObject({
      job_type: 'title_card_render',
      source_unit_id: `title_card:${firstCard.card_id}`,
      status: 'submitted',
    });
    expect(titleRes.data?.submitted_jobs[0].payload_summary).toContain(firstCard.output_path);

    const finalRes = await submitAiComicSeriesGearsJobs(seriesProjectId, {
      job_type: 'final_assemble',
      note: '提交 GEARS 最终装配任务',
    });
    expect(finalRes.ok).toBe(true);
    expect(finalRes.data?.submitted_jobs[0]).toMatchObject({
      job_type: 'final_assemble',
      source_unit_id: 'final_assemble:series',
      status: 'submitted',
    });
    expect(finalRes.data?.submitted_jobs[0].payload_summary).toContain('missing');

    const ledgerItems = finalRes.data?.gears_job_ledger?.items ?? [];
    expect(ledgerItems.some(item => item.job_type === 'subtitle_render')).toBe(true);
    expect(ledgerItems.some(item => item.job_type === 'audio_mix')).toBe(true);
    expect(ledgerItems.some(item => item.job_type === 'title_card_render')).toBe(true);
    expect(ledgerItems.some(item => item.job_type === 'final_assemble')).toBe(true);

    const subtitleJob = ledgerItems.find(item => item.job_type === 'subtitle_render')!;
    const subtitleCallbackRes = await importAiComicSeriesGearsCallback(seriesProjectId, {
      jobId: subtitleJob.gears_job_id,
      jobType: 'subtitle_render',
      status: 'COMPLETED',
      subtitleUrl: 'https://gears.example.test/subtitles/full-series.srt',
      message: 'GEARS subtitle render ready',
    });
    expect(subtitleCallbackRes.ok).toBe(true);
    expect(subtitleCallbackRes.data?.seedance_subtitle_render).toMatchObject({
      status: 'ready',
      srt_path: 'https://gears.example.test/subtitles/full-series.srt',
      srt_filename: 'full-series.srt',
    });

    const audioJob = ledgerItems.find(item => item.job_type === 'audio_mix')!;
    const audioCallbackRes = await importAiComicSeriesGearsCallback(seriesProjectId, {
      jobId: audioJob.gears_job_id,
      jobType: 'audio_mix',
      status: 'COMPLETED',
      audioUrl: 'https://gears.example.test/audio/full-series-mix.mp4',
      message: 'GEARS audio mix ready',
    });
    expect(audioCallbackRes.ok).toBe(true);
    expect(audioCallbackRes.data?.seedance_audio_mix).toMatchObject({
      status: 'ready',
      output_path: 'https://gears.example.test/audio/full-series-mix.mp4',
      output_filename: 'full-series-mix.mp4',
    });

    const titleJob = ledgerItems.find(item => item.job_type === 'title_card_render')!;
    const titleCallbackRes = await importAiComicSeriesGearsCallback(seriesProjectId, {
      jobId: titleJob.gears_job_id,
      jobType: 'title_card_render',
      status: 'COMPLETED',
      artifactUrl: 'https://gears.example.test/title-cards/opening.mp4',
      message: 'GEARS title card ready',
    });
    expect(titleCallbackRes.ok).toBe(true);
    expect(titleCallbackRes.data?.seedance_title_card_render).toMatchObject({
      status: 'ready',
      output_paths: ['https://gears.example.test/title-cards/opening.mp4'],
      rendered_count: 1,
    });

    const finalJob = ledgerItems.find(item => item.job_type === 'final_assemble')!;
    const finalCallbackRes = await importAiComicSeriesGearsCallback(seriesProjectId, {
      jobId: finalJob.gears_job_id,
      jobType: 'final_assemble',
      status: 'COMPLETED',
      videoUrl: 'https://gears.example.test/final/lianxi-final.mp4',
      manifestUrl: 'https://gears.example.test/final/lianxi-delivery-manifest',
      message: 'GEARS final assemble ready',
    });
    expect(finalCallbackRes.ok).toBe(true);
    expect(finalCallbackRes.data?.seedance_final_delivery).toMatchObject({
      status: 'ready',
      output_path: 'https://gears.example.test/final/lianxi-final.mp4',
      manifest_path: 'https://gears.example.test/final/lianxi-delivery-manifest',
      output_filename: 'lianxi-final.mp4',
    });

    const detailRes = await getAiComicSeriesProject(seriesProjectId);
    expect(detailRes.ok).toBe(true);
    expect(detailRes.data?.seedance_subtitle_render).toMatchObject({
      status: 'ready',
      srt_path: 'https://gears.example.test/subtitles/full-series.srt',
      srt_filename: 'full-series.srt',
    });
    expect(detailRes.data?.seedance_audio_mix).toMatchObject({
      status: 'ready',
      output_path: 'https://gears.example.test/audio/full-series-mix.mp4',
      output_filename: 'full-series-mix.mp4',
    });
    expect(detailRes.data?.seedance_title_card_render).toMatchObject({
      status: 'ready',
      output_paths: ['https://gears.example.test/title-cards/opening.mp4'],
      rendered_count: 1,
    });
    expect(detailRes.data?.seedance_final_delivery).toMatchObject({
      status: 'ready',
      output_path: 'https://gears.example.test/final/lianxi-final.mp4',
      manifest_path: 'https://gears.example.test/final/lianxi-delivery-manifest',
      output_filename: 'lianxi-final.mp4',
    });

    const postSyncRes = await syncAiComicSeriesGearsJobStatuses(seriesProjectId, {
      job_type: 'subtitle_render',
      note: '后期账本回显同步',
    });
    expect(postSyncRes.ok).toBe(true);
    expect(postSyncRes.data?.pollable_count).toBe(0);
    expect(postSyncRes.data?.seedance_subtitle_render).toMatchObject({
      status: 'ready',
      srt_path: 'https://gears.example.test/subtitles/full-series.srt',
    });
    expect(postSyncRes.data?.seedance_audio_mix).toMatchObject({
      status: 'ready',
      output_path: 'https://gears.example.test/audio/full-series-mix.mp4',
    });
    expect(postSyncRes.data?.seedance_title_card_render).toMatchObject({
      status: 'ready',
      output_paths: ['https://gears.example.test/title-cards/opening.mp4'],
    });
    expect(postSyncRes.data?.seedance_final_delivery).toMatchObject({
      status: 'ready',
      output_path: 'https://gears.example.test/final/lianxi-final.mp4',
    });
  });

  it('submits AI comic series visual GEARS jobs from generated episode deliveries', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志',
      episode_count: 3,
      episode_duration_range_sec: { min: 60, max: 120 },
    });
    expect(planRes.ok).toBe(true);

    const saveRes = await saveAiComicSeriesProject({ plan: planRes.data! });
    expect(saveRes.ok).toBe(true);
    const seriesProjectId = saveRes.data!.project.series_project_id;

    const episodeRes = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 1,
      series_project_id: seriesProjectId,
      output_gears_segments: true,
    });
    expect(episodeRes.ok).toBe(true);
    const refreshSaveRes = await saveAiComicSeriesProject({
      series_project_id: seriesProjectId,
      plan: planRes.data!,
      generated_episode_story_ids: {
        1: episodeRes.data!.storyId,
      },
    });
    expect(refreshSaveRes.ok).toBe(true);

    const storyboardRes = await submitAiComicSeriesGearsJobs(seriesProjectId, {
      job_type: 'storyboard_image',
      note: '提交 GEARS 分镜图任务',
    });
    expect(storyboardRes.ok).toBe(true);
    expect(storyboardRes.data?.submitted_count).toBeGreaterThan(0);
    expect(storyboardRes.data?.submitted_jobs[0]).toMatchObject({
      job_type: 'storyboard_image',
      status: 'submitted',
    });
    expect(storyboardRes.data?.submitted_jobs[0].source_unit_id).toContain('storyboard');
    expect(storyboardRes.data?.submitted_jobs[0].payload_summary).toContain(episodeRes.data!.title);

    const characterRes = await submitAiComicSeriesGearsJobs(seriesProjectId, {
      job_type: 'character_image',
      note: '提交 GEARS 人物图任务',
    });
    expect(characterRes.ok).toBe(true);
    expect(characterRes.data?.submitted_count).toBeGreaterThan(0);
    expect(characterRes.data?.submitted_jobs[0]).toMatchObject({
      job_type: 'character_image',
      status: 'submitted',
    });
    expect(characterRes.data?.submitted_jobs[0].source_unit_id).toContain('character');

    const sceneRes = await submitAiComicSeriesGearsJobs(seriesProjectId, {
      job_type: 'scene_image',
      note: '提交 GEARS 场景图任务',
    });
    expect(sceneRes.ok).toBe(true);
    expect(sceneRes.data?.submitted_count).toBeGreaterThan(0);
    expect(sceneRes.data?.submitted_jobs[0]).toMatchObject({
      job_type: 'scene_image',
      status: 'submitted',
    });
    expect(sceneRes.data?.submitted_jobs[0].source_unit_id).toContain('scene');

    const ledgerItems = sceneRes.data?.gears_job_ledger?.items ?? [];
    expect(ledgerItems.some(item => item.job_type === 'storyboard_image')).toBe(true);
    expect(ledgerItems.some(item => item.job_type === 'character_image')).toBe(true);
    expect(ledgerItems.some(item => item.job_type === 'scene_image')).toBe(true);
  });

  it('reports unbound episode foreshadowing in the AI comic series quality audit', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志',
      episode_count: 4,
      episode_duration_range_sec: { min: 60, max: 120 },
    });
    expect(planRes.ok).toBe(true);

    const editedPlan = {
      ...planRes.data!,
      episodes: planRes.data!.episodes.map(episode =>
        episode.episode_no === 1
          ? { ...episode, foreshadowing: ['一枚没有归属的玉扣在画面边缘反复出现'] }
          : episode
      ),
    };
    const saveRes = await saveAiComicSeriesProject({
      plan: editedPlan,
      generated_episode_story_ids: {
        1: '20260611-story-orph1',
      },
    });

    expect(saveRes.ok).toBe(true);
    const report = saveRes.data?.series_quality_audit?.thread_closure_report;
    expect(report?.orphaned_thread_count).toBeGreaterThan(0);
    expect(report?.episodes_need_attention).toContain(1);
    expect(report?.items.some(item =>
      item.status === 'orphaned' && item.repair_suggestions[0].includes('新增一条带回收集的长期线索')
    )).toBe(true);
  });

  it('copies, archives, restores, and deletes an AI comic series project', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志',
      episode_count: 3,
      episode_duration_range_sec: { min: 60, max: 120 },
    });
    expect(planRes.ok).toBe(true);

    const saveRes = await saveAiComicSeriesProject({
      plan: planRes.data!,
      generated_episode_story_ids: {
        1: '20260611-story-abc1',
      },
      memory_recall_preferences: {
        locked_memory_ids: ['character-abc-1'],
      },
    });
    expect(saveRes.ok).toBe(true);

    const copyRes = await copyAiComicSeriesProject(saveRes.data!.project.series_project_id, {
      title: '濂溪少年志 复盘版',
    });
    expect(copyRes.ok).toBe(true);
    expect(copyRes.data?.project.series_project_id).not.toBe(saveRes.data!.project.series_project_id);
    expect(copyRes.data?.plan.series_title).toBe('濂溪少年志 复盘版');
    expect(copyRes.data?.generated_episode_story_ids['1']).toBe('20260611-story-abc1');
    expect(copyRes.data?.continuity_ledger.schema_version).toBe('ai-comic-continuity-ledger/v1');
    expect(copyRes.data?.memory_recall_preferences?.locked_memory_ids).toContain('character-abc-1');

    const archiveRes = await archiveAiComicSeriesProject(copyRes.data!.project.series_project_id, {
      archived: true,
    });
    expect(archiveRes.ok).toBe(true);
    expect(archiveRes.data?.project.archived_at).toBeTruthy();

    const activeListRes = await listAiComicSeriesProjects();
    expect(activeListRes.ok).toBe(true);
    expect(activeListRes.data?.some(project => project.series_project_id === copyRes.data!.project.series_project_id)).toBe(false);

    const fullListRes = await listAiComicSeriesProjects({ includeArchived: true });
    expect(fullListRes.ok).toBe(true);
    expect(fullListRes.data?.some(project => project.series_project_id === copyRes.data!.project.series_project_id)).toBe(true);

    const restoreRes = await archiveAiComicSeriesProject(copyRes.data!.project.series_project_id, {
      archived: false,
    });
    expect(restoreRes.ok).toBe(true);
    expect(restoreRes.data?.project.archived_at).toBeUndefined();

    const deleteRes = await deleteAiComicSeriesProject(copyRes.data!.project.series_project_id);
    expect(deleteRes.ok).toBe(true);
    expect(deleteRes.data?.deleted).toBe(true);

    const getDeletedRes = await getAiComicSeriesProject(copyRes.data!.project.series_project_id);
    expect(getDeletedRes.ok).toBe(false);
  });

  it('updates continuity ledger after generating an episode inside a saved series project', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志',
      episode_count: 3,
      episode_duration_range_sec: { min: 60, max: 120 },
    });
    expect(planRes.ok).toBe(true);

    useOutlineTestRoots();
    const saveRes = await saveAiComicSeriesProject({ plan: planRes.data! });
    expect(saveRes.ok).toBe(true);

    useOutlineTestRoots();
    const episodeRes = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 1,
      series_project_id: saveRes.data!.project.series_project_id,
      output_gears_segments: true,
    });
    expect(episodeRes.ok).toBe(true);

    useOutlineTestRoots();
    const getRes = await getAiComicSeriesProject(saveRes.data!.project.series_project_id);
    expect(getRes.ok).toBe(true);
    expect(getRes.data?.continuity_ledger.last_generated_episode_no).toBe(1);
    expect(getRes.data?.continuity_ledger.episode_records).toHaveLength(1);
    expect(getRes.data?.continuity_ledger.episode_records[0].story_id).toBe(episodeRes.data?.storyId);
    expect(getRes.data?.continuity_ledger.open_threads.length).toBeGreaterThan(0);
    expect(getRes.data?.continuity_ledger.episode_records[0].memory_events?.length).toBeGreaterThan(0);
    expect(getRes.data?.continuity_ledger.series_memory?.story_events.length).toBeGreaterThan(0);
    expect(getRes.data?.continuity_ledger.episodic_memory?.schema_version)
      .toBe('ai-comic-episodic-memory/v1');
    expect(getRes.data?.continuity_ledger.episodic_memory?.items.length).toBeGreaterThan(0);
    expect(getRes.data?.continuity_ledger.episodic_memory?.items.some(item =>
      item.source === 'scene' && item.token_signature.length > 0
    )).toBe(true);
    expect(getRes.data?.continuity_ledger.episode_records[0].memory_events?.some(event =>
      event.category === 'story_event' && event.label.includes('GEARS分段')
    )).toBe(true);
    expect(getRes.data?.continuity_ledger.episode_records[0].memory_events?.some(event =>
      event.category === 'story_event' && event.label.includes('Seedance镜头')
    )).toBe(true);
    expect(getRes.data?.continuity_ledger.production_constraints?.items.some(item =>
      item.source === 'seedance_shot' && item.category === 'negative'
    )).toBe(true);
    const firstScene = episodeRes.data!.scene_breakdown[0];
    expect(getRes.data?.continuity_ledger.episode_records[0].memory_events?.some(event =>
      event.category === 'location' && event.label === firstScene.location
    )).toBe(true);
    expect(getRes.data?.continuity_ledger.series_memory?.relationships.length).toBeGreaterThan(0);
    expect(getRes.data?.continuity_ledger.episode_records[0].next_episode_memory.some(item =>
      item.includes('记忆：')
    )).toBe(true);
    expect(getRes.data?.series_quality_audit?.generated_episode_count).toBe(1);
    expect(getRes.data?.series_quality_audit?.episode_reports[0].story_id).toBe(episodeRes.data?.storyId);
    expect(getRes.data?.series_quality_audit?.episode_reports[0].score).toBeTypeOf('number');

    useOutlineTestRoots();
    const seedanceExportRes = await exportAiComicSeriesSeedancePrompts(saveRes.data!.project.series_project_id);
    expect(seedanceExportRes.ok).toBe(true);
    expect(seedanceExportRes.data?.schema_version).toBe('ai-comic-series-seedance-export/v1');
    expect(seedanceExportRes.data?.generated_episode_count).toBe(1);
    expect(seedanceExportRes.data?.total_shot_count).toBeGreaterThan(0);
    expect(seedanceExportRes.data?.episodes[0].story_id).toBe(episodeRes.data?.storyId);
    expect(seedanceExportRes.data?.seedance_production?.items.length).toBe(seedanceExportRes.data?.total_shot_count);
    expect(seedanceExportRes.data?.seedance_production?.items[0].status).toBe('prompt_exported');
    expect(seedanceExportRes.data?.markdown).toContain('系列 Seedance 2.0 镜头提示词包');
    expect(seedanceExportRes.data?.markdown).toContain(episodeRes.data!.storyId);

    const seedanceAssetReportRes = await exportAiComicSeriesSeedanceAssetReportPackage(
      saveRes.data!.project.series_project_id,
    );
    expect(seedanceAssetReportRes.ok).toBe(true);
    expect(seedanceAssetReportRes.data?.schema_version).toBe('ai-comic-series-seedance-asset-report/v1');
    expect(seedanceAssetReportRes.data?.total_asset_count).toBeGreaterThan(0);
    expect(seedanceAssetReportRes.data?.shot_binding_count).toBe(seedanceExportRes.data?.total_shot_count);
    expect(seedanceAssetReportRes.data?.assets.some(asset => asset.kind === 'character')).toBe(true);
    expect(seedanceAssetReportRes.data?.shots[0].required_asset_ids.length).toBeGreaterThan(0);
    expect(seedanceAssetReportRes.data?.markdown).toContain('Seedance 素材引用完整性报告');
    const firstShotAssetIds = seedanceAssetReportRes.data!.shots[0].required_asset_ids;
    const bindableAsset = seedanceAssetReportRes.data!.assets.find(asset =>
      asset.has_reference_slot && firstShotAssetIds.includes(asset.asset_id)
    ) ?? seedanceAssetReportRes.data!.assets.find(asset => asset.has_reference_slot);
    expect(bindableAsset).toBeTruthy();
    const assetLibraryRes = await updateAiComicSeriesSeedanceAssetLibrary(
      saveRes.data!.project.series_project_id,
      {
        items: [{
          asset_id: bindableAsset!.asset_id,
          kind: bindableAsset!.kind,
          label: bindableAsset!.label,
          reference_slot: bindableAsset!.reference_slot,
          file_url: 'https://example.com/seedance-assets/asset-001.png',
          description: '测试绑定素材文件',
        }],
      },
    );
    expect(assetLibraryRes.ok).toBe(true);
    expect(assetLibraryRes.data?.seedance_asset_library?.items[0]).toMatchObject({
      asset_id: bindableAsset!.asset_id,
      file_url: 'https://example.com/seedance-assets/asset-001.png',
    });
    const boundAssetReportRes = await exportAiComicSeriesSeedanceAssetReportPackage(
      saveRes.data!.project.series_project_id,
    );
    expect(boundAssetReportRes.ok).toBe(true);
    expect(boundAssetReportRes.data?.assets.find(asset =>
      asset.asset_id === bindableAsset!.asset_id
    )).toMatchObject({
      is_bound: true,
      status: 'bound',
      file_url: 'https://example.com/seedance-assets/asset-001.png',
    });

    const firstProductionItem = seedanceExportRes.data!.seedance_production!.items[0]!;
    const productionStatusRes = await updateAiComicSeriesSeedanceProductionStatus(
      saveRes.data!.project.series_project_id,
      {
        episode_no: firstProductionItem.episode_no,
        shot_id: firstProductionItem.shot_id,
        status: 'processing',
        provider_job_id: 'seedance-job-001',
        note: '测试标记为处理中',
      },
    );
    expect(productionStatusRes.ok).toBe(true);
    expect(productionStatusRes.data?.seedance_production?.items.find(item =>
      item.production_id === firstProductionItem.production_id
    )).toMatchObject({
      status: 'processing',
      provider_job_id: 'seedance-job-001',
    });
    const batchProductionRes = await updateAiComicSeriesSeedanceProductionStatuses(
      saveRes.data!.project.series_project_id,
      {
        updates: [
          {
            episode_no: firstProductionItem.episode_no,
            shot_id: firstProductionItem.shot_id,
            status: 'ready',
            video_url: 'https://example.com/seedance/shot-001.mp4',
            note: '批量回传测试',
          },
        ],
      },
    );
    expect(batchProductionRes.ok).toBe(true);
    expect(batchProductionRes.data?.seedance_production?.items.find(item =>
      item.production_id === firstProductionItem.production_id
    )).toMatchObject({
      status: 'ready',
      provider_job_id: 'seedance-job-001',
      video_url: 'https://example.com/seedance/shot-001.mp4',
    });
    const readyProductionItem = batchProductionRes.data?.seedance_production?.items.find(item =>
      item.production_id === firstProductionItem.production_id
    );
    expect(readyProductionItem?.versions.some(version =>
      version.status === 'ready'
      && version.video_url === 'https://example.com/seedance/shot-001.mp4'
      && version.provider_job_id === 'seedance-job-001'
    )).toBe(true);
    const firstReadyVersionId = readyProductionItem?.versions.find(version =>
      version.status === 'ready' && version.video_url === 'https://example.com/seedance/shot-001.mp4'
    )?.version_id;
    expect(firstReadyVersionId).toBeTruthy();

    const callbackRes = await applyAiComicSeriesSeedanceProductionCallback(
      saveRes.data!.project.series_project_id,
      {
        jobId: 'seedance-job-001',
        status: 'COMPLETED',
        videoUrl: 'https://example.com/seedance/shot-001-v2.mp4',
        message: '平台回调第二版完成',
        qualityScore: 78,
        reviewNote: '动作略急，备用版本',
      },
    );
    expect(callbackRes.ok).toBe(true);
    const callbackProductionItem = callbackRes.data?.seedance_production?.items.find(item =>
      item.production_id === firstProductionItem.production_id
    );
    expect(callbackProductionItem?.video_url).toBe('https://example.com/seedance/shot-001-v2.mp4');
    expect(callbackProductionItem?.versions.some(version =>
      version.status === 'ready'
      && version.video_url === 'https://example.com/seedance/shot-001-v2.mp4'
      && version.provider_job_id === 'seedance-job-001'
      && version.quality_score === 78
    )).toBe(true);

    const retryCandidate = seedanceExportRes.data!.seedance_production!.items.find(item =>
      item.production_id !== firstProductionItem.production_id
    );
    expect(retryCandidate).toBeTruthy();
    const failedProductionRes = await updateAiComicSeriesSeedanceProductionStatus(
      saveRes.data!.project.series_project_id,
      {
        episode_no: retryCandidate!.episode_no,
        shot_id: retryCandidate!.shot_id,
        status: 'failed',
        provider_job_id: 'seedance-job-failed',
        failure_reason: '人物手部变形',
        increment_retry: true,
        note: '测试标记失败',
      },
    );
    expect(failedProductionRes.ok).toBe(true);

    const versionSelectRes = await selectAiComicSeriesSeedanceProductionVersion(
      saveRes.data!.project.series_project_id,
      {
        episode_no: firstProductionItem.episode_no,
        shot_id: firstProductionItem.shot_id,
        version_id: firstReadyVersionId!,
        note: '测试选择第一版为剪辑版',
      },
    );
    expect(versionSelectRes.ok).toBe(true);
    expect(versionSelectRes.data?.seedance_production?.items.find(item =>
      item.production_id === firstProductionItem.production_id
    )).toMatchObject({
      selected_version_id: firstReadyVersionId,
      video_url: 'https://example.com/seedance/shot-001.mp4',
    });

    const autoSelectWithoutOverwriteRes = await autoSelectAiComicSeriesSeedanceProductionVersions(
      saveRes.data!.project.series_project_id,
      { overwrite_manual: false, note: '测试自动择优不覆盖人工选择' },
    );
    expect(autoSelectWithoutOverwriteRes.ok).toBe(true);
    expect(autoSelectWithoutOverwriteRes.data?.seedance_production?.items.find(item =>
      item.production_id === firstProductionItem.production_id
    )?.selected_version_id).toBe(firstReadyVersionId);

    const autoSelectOverwriteRes = await autoSelectAiComicSeriesSeedanceProductionVersions(
      saveRes.data!.project.series_project_id,
      { overwrite_manual: true, note: '测试自动择优覆盖人工选择' },
    );
    expect(autoSelectOverwriteRes.ok).toBe(true);
    const autoSelectedItem = autoSelectOverwriteRes.data?.seedance_production?.items.find(item =>
      item.production_id === firstProductionItem.production_id
    );
    expect(autoSelectedItem?.selected_version_id).not.toBe(firstReadyVersionId);
    expect(autoSelectedItem?.video_url).toBe('https://example.com/seedance/shot-001-v2.mp4');

    const cutPackageRes = await exportAiComicSeriesSeedanceCutPackage(saveRes.data!.project.series_project_id);
    expect(cutPackageRes.ok).toBe(true);
    expect(cutPackageRes.data?.schema_version).toBe('ai-comic-series-seedance-cut-package/v1');
    expect(cutPackageRes.data?.total_ready_shot_count).toBeGreaterThan(0);
    expect(cutPackageRes.data?.total_missing_shot_count).toBeGreaterThanOrEqual(0);
    expect(cutPackageRes.data?.episodes[0].shots[0]).toMatchObject({
      episode_no: firstProductionItem.episode_no,
      shot_id: firstProductionItem.shot_id,
      provider_job_id: 'seedance-job-001',
      video_url: 'https://example.com/seedance/shot-001-v2.mp4',
      quality_score: 78,
    });
    expect(cutPackageRes.data?.episodes[0].shots[0].version_id).toBe(autoSelectedItem?.selected_version_id);
    expect(cutPackageRes.data?.markdown).toContain('Seedance 剪辑交付包');
    expect(cutPackageRes.data?.markdown).toContain('https://example.com/seedance/shot-001-v2.mp4');

    const cutAssemblyDryRunRes = await assembleAiComicSeriesSeedanceCut(
      saveRes.data!.project.series_project_id,
      { dry_run: true },
    );
    expect(cutAssemblyDryRunRes.ok).toBe(true);
    expect(cutAssemblyDryRunRes.data?.schema_version)
      .toBe('ai-comic-series-seedance-cut-assembly-result/v1');
    expect(cutAssemblyDryRunRes.data?.dry_run).toBe(true);
    expect(cutAssemblyDryRunRes.data?.status).toBe('planned');
    expect(cutAssemblyDryRunRes.data?.source_shot_count).toBe(cutPackageRes.data?.total_ready_shot_count);
    expect(cutAssemblyDryRunRes.data?.output_path).toContain('full-series-seedance-cut.mp4');
    expect(cutAssemblyDryRunRes.data?.ffmpeg_command).toContain('ffmpeg -y -f concat');
    expect(cutAssemblyDryRunRes.data?.assembly_mode).toBe('copy');
    expect(cutAssemblyDryRunRes.data?.output_profile).toBe('source_copy');
    expect(cutAssemblyDryRunRes.data?.seedance_cut_assembly).toMatchObject({
      status: 'planned',
      assembly_mode: 'copy',
      source_shot_count: cutPackageRes.data?.total_ready_shot_count,
    });

    const cutAssemblyTranscodeDryRunRes = await assembleAiComicSeriesSeedanceCut(
      saveRes.data!.project.series_project_id,
      {
        dry_run: true,
        assembly_mode: 'transcode',
        output_profile: 'mp4_h264_720p',
        fps: 24,
        crf: 22,
        preset: 'fast',
      },
    );
    expect(cutAssemblyTranscodeDryRunRes.ok).toBe(true);
    expect(cutAssemblyTranscodeDryRunRes.data?.assembly_mode).toBe('transcode');
    expect(cutAssemblyTranscodeDryRunRes.data?.output_profile).toBe('mp4_h264_720p');
    expect(cutAssemblyTranscodeDryRunRes.data?.ffmpeg_command).toContain('-c:v libx264');
    expect(cutAssemblyTranscodeDryRunRes.data?.ffmpeg_command).toContain('-vf');
    expect(cutAssemblyTranscodeDryRunRes.data?.ffmpeg_command).toContain('scale=1280:720');
    expect(cutAssemblyTranscodeDryRunRes.data?.seedance_cut_assembly).toMatchObject({
      status: 'planned',
      assembly_mode: 'transcode',
      output_profile: 'mp4_h264_720p',
    });

    const cutAssemblyRes = await assembleAiComicSeriesSeedanceCut(
      saveRes.data!.project.series_project_id,
      { dry_run: false, overwrite: true, episode_no: firstProductionItem.episode_no },
      { runner: async () => undefined },
    );
    expect(cutAssemblyRes.ok).toBe(true);
    expect(cutAssemblyRes.data?.status).toBe('assembled');
    expect(cutAssemblyRes.data?.source_episode_no).toBe(firstProductionItem.episode_no);
    expect(cutAssemblyRes.data?.source_shot_count).toBeGreaterThan(0);
    expect(cutAssemblyRes.data?.seedance_cut_assembly).toMatchObject({
      status: 'ready',
      assembly_mode: 'copy',
      source_episode_no: firstProductionItem.episode_no,
    });

    const editAssetPackageRes = await exportAiComicSeriesSeedanceEditAssetPackage(
      saveRes.data!.project.series_project_id,
    );
    expect(editAssetPackageRes.ok).toBe(true);
    expect(editAssetPackageRes.data?.schema_version).toBe('ai-comic-series-seedance-edit-asset-package/v1');
    expect(editAssetPackageRes.data?.total_ready_shot_count).toBe(cutPackageRes.data?.total_ready_shot_count);
    expect(editAssetPackageRes.data?.episodes[0].shots[0]).toMatchObject({
      shot_id: firstProductionItem.shot_id,
      video_url: 'https://example.com/seedance/shot-001-v2.mp4',
    });
    expect(editAssetPackageRes.data?.assets.some(asset => asset.status === 'bound')).toBe(true);
    expect(editAssetPackageRes.data?.markdown).toContain('Seedance 剪辑台资产包');

    const thumbnailPlanRes = await exportAiComicSeriesSeedanceThumbnailPlanPackage(
      saveRes.data!.project.series_project_id,
    );
    expect(thumbnailPlanRes.ok).toBe(true);
    expect(thumbnailPlanRes.data?.schema_version).toBe('ai-comic-series-seedance-thumbnail-plan/v1');
    expect(thumbnailPlanRes.data?.total_ready_shot_count).toBe(cutPackageRes.data?.total_ready_shot_count);
    expect(thumbnailPlanRes.data?.episodes[0].shots[0]).toMatchObject({
      shot_id: firstProductionItem.shot_id,
      video_url: 'https://example.com/seedance/shot-001-v2.mp4',
      capture_time_sec: 1,
      status: 'pending_capture',
    });
    expect(thumbnailPlanRes.data?.episodes[0].shots[0].output_path).toContain('/e01-');
    expect(thumbnailPlanRes.data?.episodes[0].shots[0].ffmpeg_command).toContain('ffmpeg -y -ss 1');
    expect(thumbnailPlanRes.data?.markdown).toContain('Seedance 缩略图抽帧计划');

    const thumbnailDryRunRes = await captureAiComicSeriesSeedanceThumbnails(
      saveRes.data!.project.series_project_id,
      { dry_run: true },
    );
    expect(thumbnailDryRunRes.ok).toBe(true);
    expect(thumbnailDryRunRes.data?.schema_version)
      .toBe('ai-comic-series-seedance-thumbnail-capture-result/v1');
    expect(thumbnailDryRunRes.data?.dry_run).toBe(true);
    expect(thumbnailDryRunRes.data?.planned_count).toBe(cutPackageRes.data?.total_ready_shot_count);
    expect(thumbnailDryRunRes.data?.seedance_production.items.find(item =>
      item.production_id === firstProductionItem.production_id
    )?.thumbnail).toMatchObject({
      status: 'planned',
      output_path: thumbnailPlanRes.data?.episodes[0].shots[0].output_path,
    });

    const thumbnailCaptureRes = await captureAiComicSeriesSeedanceThumbnails(
      saveRes.data!.project.series_project_id,
      { dry_run: false, overwrite: true, limit: 1 },
      { runner: async () => undefined },
    );
    expect(thumbnailCaptureRes.ok).toBe(true);
    expect(thumbnailCaptureRes.data?.captured_count).toBe(1);
    expect(thumbnailCaptureRes.data?.shots[0]).toMatchObject({
      production_id: firstProductionItem.production_id,
      status: 'captured',
      output_path: thumbnailPlanRes.data?.episodes[0].shots[0].output_path,
    });
    expect(thumbnailCaptureRes.data?.seedance_production.items.find(item =>
      item.production_id === firstProductionItem.production_id
    )?.thumbnail).toMatchObject({
      status: 'ready',
      output_path: thumbnailPlanRes.data?.episodes[0].shots[0].output_path,
      capture_time_sec: 1,
    });

    const finishingPlanRes = await exportAiComicSeriesSeedanceFinishingPlanPackage(
      saveRes.data!.project.series_project_id,
    );
    expect(finishingPlanRes.ok).toBe(true);
    expect(finishingPlanRes.data?.schema_version).toBe('ai-comic-series-seedance-finishing-plan/v1');
    expect(finishingPlanRes.data?.source_cut_output_path).toBe(cutAssemblyRes.data?.output_path);
    expect(finishingPlanRes.data?.total_ready_shot_count).toBe(cutPackageRes.data?.total_ready_shot_count);
    expect(finishingPlanRes.data?.subtitle_format).toBe('srt');
    expect(finishingPlanRes.data?.shots[0]).toMatchObject({
      production_id: firstProductionItem.production_id,
      start_sec: 0,
      video_url: 'https://example.com/seedance/shot-001-v2.mp4',
      thumbnail_path: thumbnailPlanRes.data?.episodes[0].shots[0].output_path,
    });
    expect(finishingPlanRes.data?.subtitle_cues.length).toBe(finishingPlanRes.data?.shots.length);
    expect(finishingPlanRes.data?.audio_cues.some(cue => cue.cue_id === 'aud-series-bed')).toBe(true);
    expect(finishingPlanRes.data?.title_cards.some(card => card.placement === 'series_opening')).toBe(true);
    expect(finishingPlanRes.data?.quality_checklist.length).toBeGreaterThan(0);
    expect(finishingPlanRes.data?.markdown).toContain('Seedance 成片精修计划');

    const subtitlePackageRes = await exportAiComicSeriesSeedanceSubtitlePackage(
      saveRes.data!.project.series_project_id,
    );
    expect(subtitlePackageRes.ok).toBe(true);
    expect(subtitlePackageRes.data?.schema_version)
      .toBe('ai-comic-series-seedance-subtitle-package/v1');
    expect(subtitlePackageRes.data?.subtitle_format).toBe('srt');
    expect(subtitlePackageRes.data?.cue_count).toBe(finishingPlanRes.data?.subtitle_cues.length);
    expect(subtitlePackageRes.data?.srt_path).toContain('full-series-seedance-subtitles.srt');
    expect(subtitlePackageRes.data?.srt_content).toContain('1\n00:00:00,000 -->');
    expect(subtitlePackageRes.data?.cues[0]).toMatchObject({
      srt_index: 1,
      start_timecode: '00:00:00,000',
      episode_no: firstProductionItem.episode_no,
      shot_id: firstProductionItem.shot_id,
    });
    expect(subtitlePackageRes.data?.markdown).toContain('Seedance SRT 字幕包');

    const episodeSubtitlePackageRes = await exportAiComicSeriesSeedanceSubtitlePackage(
      saveRes.data!.project.series_project_id,
      { episode_no: firstProductionItem.episode_no, output_filename: 'episode-01.srt' },
    );
    expect(episodeSubtitlePackageRes.ok).toBe(true);
    expect(episodeSubtitlePackageRes.data?.episode_no).toBe(firstProductionItem.episode_no);
    expect(episodeSubtitlePackageRes.data?.srt_filename).toBe('episode-01.srt');
    expect(episodeSubtitlePackageRes.data?.cues[0].start_timecode).toBe('00:00:00,000');

    const subtitleDryRunRes = await renderAiComicSeriesSeedanceSubtitles(
      saveRes.data!.project.series_project_id,
      { dry_run: true, mode: 'sidecar' },
    );
    expect(subtitleDryRunRes.ok).toBe(true);
    expect(subtitleDryRunRes.data?.schema_version)
      .toBe('ai-comic-series-seedance-subtitle-render-result/v1');
    expect(subtitleDryRunRes.data?.status).toBe('planned');
    expect(subtitleDryRunRes.data?.seedance_subtitle_render).toMatchObject({
      status: 'planned',
      mode: 'sidecar',
      cue_count: subtitlePackageRes.data?.cue_count,
    });

    const subtitleSidecarRes = await renderAiComicSeriesSeedanceSubtitles(
      saveRes.data!.project.series_project_id,
      { dry_run: false, overwrite: true, mode: 'sidecar' },
    );
    expect(subtitleSidecarRes.ok).toBe(true);
    expect(subtitleSidecarRes.data?.status).toBe('rendered');
    expect(subtitleSidecarRes.data?.output_path).toBe(subtitlePackageRes.data?.srt_path);
    expect(subtitleSidecarRes.data?.seedance_subtitle_render).toMatchObject({
      status: 'ready',
      mode: 'sidecar',
      srt_path: subtitlePackageRes.data?.srt_path,
    });

    const subtitleBurnInRes = await renderAiComicSeriesSeedanceSubtitles(
      saveRes.data!.project.series_project_id,
      {
        dry_run: false,
        overwrite: true,
        mode: 'burn_in',
        output_filename: 'episode-01-subtitled.mp4',
      },
      { runner: async () => undefined },
    );
    expect(subtitleBurnInRes.ok).toBe(true);
    expect(subtitleBurnInRes.data?.status).toBe('rendered');
    expect(subtitleBurnInRes.data?.output_filename).toBe('episode-01-subtitled.mp4');
    expect(subtitleBurnInRes.data?.ffmpeg_command).toContain('-vf subtitles=');
    expect(subtitleBurnInRes.data?.seedance_subtitle_render).toMatchObject({
      status: 'ready',
      mode: 'burn_in',
      output_path: expect.stringContaining('/episode-01-subtitled.mp4'),
      source_cut_output_path: cutAssemblyRes.data?.output_path,
    });

    const unsafeSubtitleInputRes = await renderAiComicSeriesSeedanceSubtitles(
      saveRes.data!.project.series_project_id,
      {
        dry_run: true,
        mode: 'burn_in',
        input_video_path: '../outside.mp4',
      },
    );
    expect(unsafeSubtitleInputRes.ok).toBe(false);
    expect(unsafeSubtitleInputRes.error?.code).toBe('VALIDATION_ERROR');

    const audioPlanMissingRes = await exportAiComicSeriesSeedanceAudioPlanPackage(
      saveRes.data!.project.series_project_id,
    );
    expect(audioPlanMissingRes.ok).toBe(true);
    expect(audioPlanMissingRes.data?.schema_version).toBe('ai-comic-series-seedance-audio-plan/v1');
    expect(audioPlanMissingRes.data?.total_audio_cue_count).toBe(finishingPlanRes.data?.audio_cues.length);
    expect(audioPlanMissingRes.data?.missing_audio_count).toBeGreaterThan(0);
    expect(audioPlanMissingRes.data?.suggested_assets.length).toBeGreaterThan(0);
    expect(audioPlanMissingRes.data?.markdown).toContain('Seedance 音频计划');

    const firstSuggestedAudio = audioPlanMissingRes.data!.suggested_assets[0];
    const audioLibraryRes = await updateAiComicSeriesSeedanceAudioLibrary(
      saveRes.data!.project.series_project_id,
      {
        items: [{
          asset_id: firstSuggestedAudio.asset_id,
          kind: firstSuggestedAudio.kind,
          label: firstSuggestedAudio.label,
          file_url: 'https://example.com/audio/series-bed.mp3',
          duration_sec: 120,
          license_note: '测试授权',
          loopable: true,
          bpm: 72,
          mood_tags: ['克制', '古风'],
        }],
      },
    );
    expect(audioLibraryRes.ok).toBe(true);
    expect(audioLibraryRes.data?.seedance_audio_library?.items[0]).toMatchObject({
      asset_id: firstSuggestedAudio.asset_id,
      file_url: 'https://example.com/audio/series-bed.mp3',
      loopable: true,
    });

    const audioPlanBoundRes = await exportAiComicSeriesSeedanceAudioPlanPackage(
      saveRes.data!.project.series_project_id,
    );
    expect(audioPlanBoundRes.ok).toBe(true);
    expect(audioPlanBoundRes.data?.bound_cue_count).toBeGreaterThan(0);
    expect(audioPlanBoundRes.data?.audio_cues.find(cue =>
      cue.asset_id === firstSuggestedAudio.asset_id
    )).toMatchObject({
      asset_status: 'bound',
      file_url: 'https://example.com/audio/series-bed.mp3',
      volume_db: expect.any(Number),
      ducking: expect.any(Boolean),
    });

    const audioMixDryRunRes = await mixAiComicSeriesSeedanceAudio(
      saveRes.data!.project.series_project_id,
      { dry_run: true, audio_profile: 'music_forward' },
    );
    expect(audioMixDryRunRes.ok).toBe(true);
    expect(audioMixDryRunRes.data?.schema_version).toBe('ai-comic-series-seedance-audio-mix-result/v1');
    expect(audioMixDryRunRes.data?.status).toBe('planned');
    expect(audioMixDryRunRes.data?.audio_profile).toBe('music_forward');
    expect(audioMixDryRunRes.data?.source_audio_count).toBeGreaterThan(0);
    expect(audioMixDryRunRes.data?.ffmpeg_command).toContain('-filter_complex');
    expect(audioMixDryRunRes.data?.seedance_audio_mix).toMatchObject({
      status: 'planned',
      audio_profile: 'music_forward',
      source_audio_count: audioMixDryRunRes.data?.source_audio_count,
    });

    const projectDir = resolve(
      outlineGeneratedRoot(),
      'ai-comic-series-projects',
      saveRes.data!.project.series_project_id,
    );
    const mixInputVideoPath = `cuts/${saveRes.data!.project.series_project_id}/audio-source.mp4`;
    await mkdir(resolve(projectDir, 'cuts', saveRes.data!.project.series_project_id), { recursive: true });
    await writeFile(resolve(projectDir, mixInputVideoPath), 'fake video source');
    let remoteAudioRunnerCalled = false;
    const remoteAudioMixRealRes = await mixAiComicSeriesSeedanceAudio(
      saveRes.data!.project.series_project_id,
      {
        dry_run: false,
        overwrite: true,
        input_video_path: mixInputVideoPath,
        output_filename: 'remote-audio-mix.mp4',
      },
      {
        runner: async () => {
          remoteAudioRunnerCalled = true;
        },
      },
    );
    expect(remoteAudioMixRealRes.ok).toBe(true);
    expect(remoteAudioMixRealRes.data?.status).toBe('failed');
    expect(remoteAudioRunnerCalled).toBe(false);
    expect(remoteAudioMixRealRes.data?.failure_reason).toContain('requires local audio files');
    expect(remoteAudioMixRealRes.data?.seedance_audio_mix).toMatchObject({
      status: 'failed',
      failure_reason: expect.stringContaining('requires local audio files'),
    });

    const localAudioPath = 'audio/local-series-bed.mp3';
    await mkdir(resolve(projectDir, 'audio'), { recursive: true });
    await writeFile(resolve(projectDir, localAudioPath), 'fake audio source');
    const localAudioLibraryRes = await updateAiComicSeriesSeedanceAudioLibrary(
      saveRes.data!.project.series_project_id,
      {
        items: [{
          asset_id: firstSuggestedAudio.asset_id,
          kind: firstSuggestedAudio.kind,
          label: firstSuggestedAudio.label,
          file_url: localAudioPath,
          duration_sec: 120,
          loopable: true,
        }],
      },
    );
    expect(localAudioLibraryRes.ok).toBe(true);

    const runnerCalls: Array<{
      inputVideoPath: string;
      outputPath: string;
      audioInputs: Array<{ input_path: string }>;
      includeOriginalAudio: boolean;
      originalAudioVolumeDb: number;
    }> = [];
    const episodeAudioMixDryRunRes = await mixAiComicSeriesSeedanceAudio(
      saveRes.data!.project.series_project_id,
      {
        dry_run: true,
        episode_no: firstProductionItem.episode_no,
        input_video_path: mixInputVideoPath,
        output_filename: 'episode-audio-mix.mp4',
        include_original_audio: true,
        original_audio_volume_db: -3,
      },
    );
    expect(episodeAudioMixDryRunRes.ok).toBe(true);
    expect(episodeAudioMixDryRunRes.data?.episode_no).toBe(firstProductionItem.episode_no);
    expect(episodeAudioMixDryRunRes.data?.include_original_audio).toBe(true);
    expect(episodeAudioMixDryRunRes.data?.original_audio_volume_db).toBe(-3);
    expect(episodeAudioMixDryRunRes.data?.ffmpeg_command).toContain('[0:a]volume=-3dB');
    expect(episodeAudioMixDryRunRes.data?.ffmpeg_command).toContain('adelay=0|0');
    expect(episodeAudioMixDryRunRes.data?.seedance_audio_mix).toMatchObject({
      status: 'planned',
      episode_no: firstProductionItem.episode_no,
      output_filename: 'episode-audio-mix.mp4',
      include_original_audio: true,
      original_audio_volume_db: -3,
    });

    const missingAudioOutputRes = await mixAiComicSeriesSeedanceAudio(
      saveRes.data!.project.series_project_id,
      {
        dry_run: false,
        overwrite: true,
        input_video_path: mixInputVideoPath,
        output_filename: 'missing-audio-output.mp4',
      },
      { runner: async () => undefined },
    );
    expect(missingAudioOutputRes.ok).toBe(true);
    expect(missingAudioOutputRes.data?.status).toBe('failed');
    expect(missingAudioOutputRes.data?.failure_reason).toContain('did not create output file');
    expect(missingAudioOutputRes.data?.seedance_audio_mix).toMatchObject({
      status: 'failed',
      output_filename: 'missing-audio-output.mp4',
    });

    const realAudioMixRes = await mixAiComicSeriesSeedanceAudio(
      saveRes.data!.project.series_project_id,
      {
        dry_run: false,
        overwrite: true,
        input_video_path: mixInputVideoPath,
        output_filename: 'local-audio-mix.mp4',
        include_original_audio: true,
        original_audio_volume_db: -6,
      },
      {
        runner: async params => {
          runnerCalls.push({
            inputVideoPath: params.inputVideoPath,
            outputPath: params.outputPath,
            audioInputs: params.audioInputs.map(input => ({ input_path: input.input_path })),
            includeOriginalAudio: params.includeOriginalAudio,
            originalAudioVolumeDb: params.originalAudioVolumeDb,
          });
          await writeFile(params.outputPath, 'fake mixed video');
        },
      },
    );
    expect(realAudioMixRes.ok).toBe(true);
    expect(realAudioMixRes.data?.status).toBe('mixed');
    expect(realAudioMixRes.data?.seedance_audio_mix).toMatchObject({
      status: 'ready',
      output_filename: 'local-audio-mix.mp4',
      include_original_audio: true,
      original_audio_volume_db: -6,
    });
    expect(realAudioMixRes.data?.ffmpeg_command).toContain('[0:a]volume=-6dB');
    expect(runnerCalls).toHaveLength(1);
    expect(runnerCalls[0].inputVideoPath).toBe(resolve(projectDir, mixInputVideoPath));
    expect(runnerCalls[0].outputPath).toBe(resolve(
      projectDir,
      'cuts',
      saveRes.data!.project.series_project_id,
      'local-audio-mix.mp4',
    ));
    expect(runnerCalls[0].audioInputs[0].input_path).toBe(resolve(projectDir, localAudioPath));
    expect(runnerCalls[0].includeOriginalAudio).toBe(true);
    expect(runnerCalls[0].originalAudioVolumeDb).toBe(-6);

    const unsafeAudioMixInputRes = await mixAiComicSeriesSeedanceAudio(
      saveRes.data!.project.series_project_id,
      {
        dry_run: true,
        input_video_path: '../outside.mp4',
      },
    );
    expect(unsafeAudioMixInputRes.ok).toBe(false);
    expect(unsafeAudioMixInputRes.error?.code).toBe('VALIDATION_ERROR');

    const titleCardPlanRes = await exportAiComicSeriesSeedanceTitleCardPlanPackage(
      saveRes.data!.project.series_project_id,
    );
    expect(titleCardPlanRes.ok).toBe(true);
    expect(titleCardPlanRes.data?.schema_version).toBe('ai-comic-series-seedance-title-card-plan/v1');
    expect(titleCardPlanRes.data?.cards.length).toBeGreaterThan(0);
    expect(titleCardPlanRes.data?.cards[0]).toMatchObject({
      output_path: expect.stringContaining('title-cards/'),
      safe_area: expect.any(String),
      ffmpeg_command_hint: expect.stringContaining('drawtext='),
    });
    expect(titleCardPlanRes.data?.markdown).toContain('Seedance 片头片尾卡计划');

    const finalStrictMissingTitleRes = await assembleAiComicSeriesSeedanceFinalDelivery(
      saveRes.data!.project.series_project_id,
      { dry_run: true, missing_dependency_mode: 'strict', include_title_cards: true },
    );
    expect(finalStrictMissingTitleRes.ok).toBe(false);
    expect(finalStrictMissingTitleRes.error?.code).toBe('VALIDATION_ERROR');

    const titleCardFontPath = resolve(projectDir, 'fonts', 'title-card-test.ttf');
    await mkdir(resolve(projectDir, 'fonts'), { recursive: true });
    await writeFile(titleCardFontPath, 'fake font');
    let missingOutputTitleRunnerCalled = false;
    const titleCardMissingOutputRes = await renderAiComicSeriesSeedanceTitleCards(
      saveRes.data!.project.series_project_id,
      {
        dry_run: false,
        overwrite: true,
        output_profile: 'mp4_h264_720p',
        font_path: titleCardFontPath,
      },
      {
        runner: async () => {
          missingOutputTitleRunnerCalled = true;
        },
      },
    );
    expect(titleCardMissingOutputRes.ok).toBe(true);
    expect(titleCardMissingOutputRes.data?.status).toBe('failed');
    expect(missingOutputTitleRunnerCalled).toBe(true);
    expect(titleCardMissingOutputRes.data?.failure_reason).toContain('did not create output');
    expect(titleCardMissingOutputRes.data?.seedance_title_card_render).toMatchObject({
      status: 'failed',
      rendered_count: 0,
      failure_reason: expect.stringContaining('did not create output'),
    });

    const titleRenderCalls: Array<{
      outputPath: string;
      fontPath: string;
      cardId: string;
    }> = [];
    const titleCardRenderRealRes = await renderAiComicSeriesSeedanceTitleCards(
      saveRes.data!.project.series_project_id,
      {
        dry_run: false,
        overwrite: true,
        output_profile: 'mp4_h264_720p',
        font_path: titleCardFontPath,
      },
      {
        runner: async params => {
          titleRenderCalls.push({
            outputPath: params.outputPath,
            fontPath: params.fontPath,
            cardId: params.card.card_id,
          });
          await writeFile(params.outputPath, `fake title card ${params.card.card_id}`);
        },
      },
    );
    expect(titleCardRenderRealRes.ok).toBe(true);
    expect(titleCardRenderRealRes.data?.status).toBe('rendered');
    expect(titleCardRenderRealRes.data?.rendered_count).toBe(titleCardRenderRealRes.data?.card_count);
    expect(titleCardRenderRealRes.data?.seedance_title_card_render).toMatchObject({
      status: 'ready',
      rendered_count: titleCardRenderRealRes.data?.card_count,
      font_path: titleCardFontPath,
    });
    expect(titleRenderCalls).toHaveLength(titleCardRenderRealRes.data!.card_count);
    expect(titleRenderCalls[0].fontPath).toBe(titleCardFontPath);
    expect(titleRenderCalls[0].outputPath).toBe(resolve(projectDir, titleCardRenderRealRes.data!.output_paths[0]));
    expect(titleRenderCalls[0].cardId).toBeTruthy();

    let missingOutputFinalRunnerCalled = false;
    const finalMissingOutputRes = await assembleAiComicSeriesSeedanceFinalDelivery(
      saveRes.data!.project.series_project_id,
      {
        dry_run: false,
        overwrite: true,
        include_subtitles: false,
        missing_dependency_mode: 'strict',
        output_profile: 'mp4_h264_720p',
        output_filename: 'missing-final-delivery.mp4',
      },
      {
        runner: async () => {
          missingOutputFinalRunnerCalled = true;
        },
      },
    );
    expect(finalMissingOutputRes.ok).toBe(true);
    expect(finalMissingOutputRes.data?.status).toBe('failed');
    expect(missingOutputFinalRunnerCalled).toBe(true);
    expect(finalMissingOutputRes.data?.failure_reason).toContain('did not create output');
    expect(finalMissingOutputRes.data?.seedance_final_delivery).toMatchObject({
      status: 'failed',
      failure_reason: expect.stringContaining('did not create output'),
    });
    expect(finalMissingOutputRes.data?.manifest.status).toBe('failed');
    expect(finalMissingOutputRes.data?.manifest.deliverables.find(deliverable =>
      deliverable.deliverable_type === 'final_video'
    )?.status).toBe('failed');

    const finalRunnerCalls: Array<{
      concatListPath?: string;
      inputVideoPath: string;
      outputPath: string;
      useConcat: boolean;
    }> = [];
    const finalRealRes = await assembleAiComicSeriesSeedanceFinalDelivery(
      saveRes.data!.project.series_project_id,
      {
        dry_run: false,
        overwrite: true,
        include_subtitles: false,
        missing_dependency_mode: 'strict',
        output_profile: 'mp4_h264_720p',
        output_filename: 'local-final-delivery.mp4',
      },
      {
        runner: async params => {
          finalRunnerCalls.push({
            concatListPath: params.concatListPath,
            inputVideoPath: params.inputVideoPath,
            outputPath: params.outputPath,
            useConcat: params.useConcat,
          });
          await writeFile(params.outputPath, 'fake final delivery');
        },
      },
    );
    expect(finalRealRes.ok).toBe(true);
    expect(finalRealRes.data?.status).toBe('assembled');
    expect(finalRealRes.data?.seedance_final_delivery).toMatchObject({
      status: 'ready',
      output_filename: 'local-final-delivery.mp4',
    });
    expect(finalRealRes.data?.manifest.status).toBe('assembled');
    expect(finalRealRes.data?.manifest.deliverables.find(deliverable =>
      deliverable.deliverable_type === 'final_video'
    )?.status).toBe('ready');
    expect(finalRunnerCalls).toHaveLength(1);
    expect(finalRunnerCalls[0].useConcat).toBe(true);
    expect(finalRunnerCalls[0].concatListPath).toBe(resolve(
      projectDir,
      'delivery',
      saveRes.data!.project.series_project_id,
      'local-final-delivery.concat.txt',
    ));
    expect(finalRunnerCalls[0].inputVideoPath).toBe(resolve(projectDir, realAudioMixRes.data!.output_path));
    expect(finalRunnerCalls[0].outputPath).toBe(resolve(projectDir, finalRealRes.data!.output_path));

    const titleCardRenderDryRunRes = await renderAiComicSeriesSeedanceTitleCards(
      saveRes.data!.project.series_project_id,
      { dry_run: true, output_profile: 'mp4_h264_720p' },
    );
    expect(titleCardRenderDryRunRes.ok).toBe(true);
    expect(titleCardRenderDryRunRes.data?.schema_version).toBe('ai-comic-series-seedance-title-card-render-result/v1');
    expect(titleCardRenderDryRunRes.data?.status).toBe('planned');
    expect(titleCardRenderDryRunRes.data?.output_profile).toBe('mp4_h264_720p');
    expect(titleCardRenderDryRunRes.data?.ffmpeg_commands[0]).toContain('color=');
    expect(titleCardRenderDryRunRes.data?.seedance_title_card_render).toMatchObject({
      status: 'planned',
      card_count: titleCardRenderDryRunRes.data?.card_count,
      rendered_count: 0,
    });

    const finalDeliveryDryRunRes = await assembleAiComicSeriesSeedanceFinalDelivery(
      saveRes.data!.project.series_project_id,
      { dry_run: true, missing_dependency_mode: 'strict', output_profile: 'mp4_h264_720p' },
    );
    expect(finalDeliveryDryRunRes.ok).toBe(true);
    expect(finalDeliveryDryRunRes.data?.schema_version).toBe('ai-comic-series-seedance-final-delivery-result/v1');
    expect(finalDeliveryDryRunRes.data?.status).toBe('planned');
    expect(finalDeliveryDryRunRes.data?.dependency_status).toMatchObject({
      cut_ready: true,
      subtitle_ready: true,
      audio_mix_ready: true,
      title_cards_ready: true,
    });
    expect(finalDeliveryDryRunRes.data?.ffmpeg_command).toContain('-f concat');
    expect(finalDeliveryDryRunRes.data?.markdown).toContain('Seedance 最终交付计划');
    expect(finalDeliveryDryRunRes.data?.markdown).toContain('manifest');
    expect(finalDeliveryDryRunRes.data?.manifest_path).toContain('delivery/');
    expect(finalDeliveryDryRunRes.data?.manifest.schema_version).toBe('ai-comic-seedance-final-delivery-manifest/v1');
    expect(finalDeliveryDryRunRes.data?.manifest.inputs.some(input => input.input_type === 'source_cut')).toBe(true);
    expect(finalDeliveryDryRunRes.data?.manifest.inputs.some(input => input.input_type === 'concat_list')).toBe(true);
    expect(finalDeliveryDryRunRes.data?.manifest.deliverables.some(deliverable => deliverable.deliverable_type === 'manifest')).toBe(true);
    expect(finalDeliveryDryRunRes.data?.seedance_final_delivery).toMatchObject({
      status: 'planned',
      output_profile: 'mp4_h264_720p',
      manifest_path: expect.stringContaining('.manifest.json'),
    });
    const finalDeliveryData = finalDeliveryDryRunRes.data!;
    const generatedRoot = outlineGeneratedRoot();
    const writtenManifestRaw = await readFile(
      resolve(
        generatedRoot,
        'ai-comic-series-projects',
        saveRes.data!.project.series_project_id,
        finalDeliveryData.manifest_path,
      ),
      'utf-8',
    );
    const writtenManifest = JSON.parse(writtenManifestRaw) as typeof finalDeliveryData.manifest;
    expect(writtenManifest.manifest_path).toBe(finalDeliveryData.manifest_path);
    expect(writtenManifest.deliverables.map(deliverable => deliverable.deliverable_type)).toContain('final_video');

    const finalReviewRes = await addAiComicSeriesSeedanceReview(
      saveRes.data!.project.series_project_id,
      {
        target_type: 'final',
        severity: 'blocking',
        issue_type: 'technical',
        note: '最终成片结尾黑场过长，需要重新装配。',
        repair_action: 'reassemble_final',
      },
    );
    expect(finalReviewRes.ok).toBe(true);
    expect(finalReviewRes.data?.seedance_review_ledger).toMatchObject({
      open_count: 1,
      blocking_count: 1,
      final_reassemble_required: true,
    });

    const blockedFinalDeliveryRes = await assembleAiComicSeriesSeedanceFinalDelivery(
      saveRes.data!.project.series_project_id,
      { dry_run: true, missing_dependency_mode: 'strict', output_profile: 'mp4_h264_720p' },
    );
    expect(blockedFinalDeliveryRes.ok).toBe(false);
    expect(blockedFinalDeliveryRes.error?.code).toBe('VALIDATION_ERROR');
    expect(blockedFinalDeliveryRes.error?.message).toContain('review');

    const reviewReassembleRes = await assembleAiComicSeriesSeedanceFinalDelivery(
      saveRes.data!.project.series_project_id,
      {
        dry_run: false,
        overwrite: true,
        include_subtitles: false,
        include_title_cards: false,
        missing_dependency_mode: 'strict',
        allow_open_final_reviews: true,
        resolve_reassemble_reviews: true,
        resolved_note: '测试最终重装配已完成',
        output_profile: 'mp4_h264_720p',
        output_filename: 'review-reassemble-final.mp4',
      },
      {
        runner: async params => {
          await writeFile(params.outputPath, 'fake review reassembled final');
        },
      },
    );
    expect(reviewReassembleRes.ok).toBe(true);
    expect(reviewReassembleRes.data?.status).toBe('assembled');
    expect(reviewReassembleRes.data?.seedance_final_delivery).toMatchObject({
      status: 'ready',
      output_filename: 'review-reassemble-final.mp4',
    });
    const getAfterReassembleRes = await getAiComicSeriesProject(saveRes.data!.project.series_project_id);
    expect(getAfterReassembleRes.ok).toBe(true);
    expect(getAfterReassembleRes.data?.seedance_review_ledger?.final_reassemble_required).toBe(false);
    expect(getAfterReassembleRes.data?.seedance_review_ledger?.open_count).toBe(0);
    expect(getAfterReassembleRes.data?.seedance_review_ledger?.items.find(item =>
      item.review_id === finalReviewRes.data!.review_item.review_id
    )).toMatchObject({
      status: 'resolved',
      resolved_note: '测试最终重装配已完成',
    });

    const shotReviewRes = await addAiComicSeriesSeedanceReview(
      saveRes.data!.project.series_project_id,
      {
        target_type: 'shot',
        target_id: firstProductionItem.shot_id,
        episode_no: firstProductionItem.episode_no,
        shot_id: firstProductionItem.shot_id,
        severity: 'major',
        issue_type: 'visual',
        note: '主角表情不稳，建议重做该镜头。',
        repair_action: 'redo_shot',
      },
    );
    expect(shotReviewRes.ok).toBe(true);
    expect(shotReviewRes.data?.seedance_review_ledger.open_count).toBe(1);

    const reviewRetryPackageRes = await exportAiComicSeriesSeedanceRetryPackage(
      saveRes.data!.project.series_project_id,
    );
    expect(reviewRetryPackageRes.ok).toBe(true);
    expect(reviewRetryPackageRes.data?.review_required_shot_count).toBeGreaterThan(0);
    const reviewedRetryShot = reviewRetryPackageRes.data?.episodes
      .flatMap(episode => episode.shots)
      .find(shot => shot.shot_id === firstProductionItem.shot_id);
    expect(reviewedRetryShot).toMatchObject({
      retry_reason: 'review_required',
      review_issues: [
        {
          review_id: shotReviewRes.data!.review_item.review_id,
          note: '主角表情不稳，建议重做该镜头。',
          repair_action: 'redo_shot',
        },
      ],
    });
    expect(reviewedRetryShot?.suggested_action).toContain('审片意见');
    expect(reviewRetryPackageRes.data?.markdown).toContain('主角表情不稳');

    const reviewDashboardRes = await getAiComicSeriesSeedanceProductionDashboard(
      saveRes.data!.project.series_project_id,
    );
    expect(reviewDashboardRes.ok).toBe(true);
    expect(reviewDashboardRes.data?.summary).toMatchObject({
      open_review_count: 1,
      blocking_review_count: 0,
      final_reassemble_required: false,
    });
    expect(reviewDashboardRes.data?.status_items.find(item => item.key === 'review_ledger')).toMatchObject({
      status: 'needs_action',
    });
    expect(reviewDashboardRes.data?.blockers.some(blocker => blocker.blocker_id === 'open-seedance-reviews')).toBe(true);

    const reviewRepairPackageRes = await exportAiComicSeriesSeedanceReviewRepairPackage(
      saveRes.data!.project.series_project_id,
    );
    expect(reviewRepairPackageRes.ok).toBe(true);
    expect(reviewRepairPackageRes.data?.schema_version).toBe('ai-comic-series-seedance-review-repair-package/v1');
    expect(reviewRepairPackageRes.data).toMatchObject({
      open_count: 1,
      blocking_count: 0,
      retry_candidate_count: 1,
      final_reassemble_required: false,
    });
    expect(reviewRepairPackageRes.data?.markdown).toContain('Seedance 审片返修包');

    const resolvedReviewRes = await resolveAiComicSeriesSeedanceReview(
      saveRes.data!.project.series_project_id,
      {
        review_id: finalReviewRes.data!.review_item.review_id,
        status: 'resolved',
        resolved_note: '已重新装配并复核。',
      },
    );
    expect(resolvedReviewRes.ok).toBe(true);
    expect(resolvedReviewRes.data?.seedance_review_ledger.open_count).toBe(1);
    expect(resolvedReviewRes.data?.seedance_review_ledger.final_reassemble_required).toBe(false);

    const editingPlatformPackageRes = await exportAiComicSeriesSeedanceEditingPlatformPackage(
      saveRes.data!.project.series_project_id,
    );
    expect(editingPlatformPackageRes.ok).toBe(true);
    expect(editingPlatformPackageRes.data?.schema_version).toBe('ai-comic-series-editing-platform-package/v1');
    expect(editingPlatformPackageRes.data?.formats).toEqual([
      'generic_json',
      'csv_timeline',
      'srt',
      'asset_manifest',
    ]);
    expect(editingPlatformPackageRes.data?.timeline.length).toBeGreaterThan(
      finishingPlanRes.data!.shots.length,
    );
    expect(editingPlatformPackageRes.data?.timeline[0]).toMatchObject({
      item_type: 'title_card',
      start_sec: 0,
    });
    expect(editingPlatformPackageRes.data?.timeline.some(item => item.item_type === 'video_shot')).toBe(true);
    expect(editingPlatformPackageRes.data?.csv_timeline).toContain('item_id,item_type,track');
    expect(editingPlatformPackageRes.data?.asset_manifest_csv).toContain('asset_id,asset_type,label');
    expect(editingPlatformPackageRes.data?.srt_content).toContain('-->');
    expect(editingPlatformPackageRes.data?.assets.some(asset => asset.asset_type === 'title_card')).toBe(true);
    expect(editingPlatformPackageRes.data?.assets.some(asset => asset.asset_type === 'audio')).toBe(true);
    expect(editingPlatformPackageRes.data?.markdown).toContain('Seedance 外部剪辑平台交付包');

    const dashboardRes = await getAiComicSeriesSeedanceProductionDashboard(
      saveRes.data!.project.series_project_id,
    );
    expect(dashboardRes.ok).toBe(true);
    expect(dashboardRes.data?.schema_version).toBe('ai-comic-series-seedance-dashboard/v1');
    expect(dashboardRes.data?.summary.total_shot_count).toBeGreaterThan(0);
    expect(dashboardRes.data?.summary.ready_count).toBeGreaterThan(0);
    expect(dashboardRes.data?.summary.failed_count).toBeGreaterThan(0);
    expect(dashboardRes.data?.status_items.some(item => item.key === 'final_delivery')).toBe(true);
    expect(dashboardRes.data?.status_items.some(item => item.key === 'editing_platform_package')).toBe(true);
    expect(dashboardRes.data?.blockers.some(blocker => blocker.blocker_id === 'failed-shots')).toBe(true);
    expect(dashboardRes.data?.next_actions.some(action => action.action_key === 'export_retry_package')).toBe(true);
    expect(dashboardRes.data?.episodes.length).toBeGreaterThan(0);
    expect(dashboardRes.data?.markdown).toContain('Seedance 生产总览');

    const retryPackageRes = await exportAiComicSeriesSeedanceRetryPackage(saveRes.data!.project.series_project_id);
    expect(retryPackageRes.ok).toBe(true);
    expect(retryPackageRes.data?.schema_version).toBe('ai-comic-series-seedance-retry-package/v1');
    expect(retryPackageRes.data?.total_retry_shot_count).toBeGreaterThan(0);
    expect(retryPackageRes.data?.review_required_shot_count).toBeGreaterThan(0);
    expect(retryPackageRes.data?.episodes.flatMap(episode => episode.shots).some(shot =>
      shot.shot_id === retryCandidate!.shot_id
      && shot.failure_reason === '人物手部变形'
      && shot.prompt.seedance_prompt.length > 0
    )).toBe(true);
    expect(retryPackageRes.data?.markdown).toContain('Seedance 重试提交包');
    expect(retryPackageRes.data?.markdown).toContain('人物手部变形');
    expect(retryPackageRes.data?.markdown).toContain('审片意见要求重做');

    const retryExecutionPlanRes = await exportAiComicSeriesSeedanceRetryExecutionPlan(
      saveRes.data!.project.series_project_id,
    );
    expect(retryExecutionPlanRes.ok).toBe(true);
    expect(retryExecutionPlanRes.data?.schema_version).toBe('ai-comic-series-seedance-retry-execution-plan/v1');
    expect(retryExecutionPlanRes.data?.total_retry_shot_count).toBe(retryPackageRes.data?.total_retry_shot_count);
    expect(retryExecutionPlanRes.data?.ready_to_submit_count).toBeGreaterThan(0);
    expect(retryExecutionPlanRes.data?.review_required_shot_count).toBeGreaterThan(0);
    expect(retryExecutionPlanRes.data?.reason_counts.review_required).toBeGreaterThan(0);
    const retryExecutionCandidates = retryExecutionPlanRes.data?.episodes.flatMap(episode => episode.candidates) ?? [];
    expect(retryExecutionCandidates.find(candidate =>
      candidate.shot_id === retryCandidate!.shot_id
    )).toMatchObject({
      retry_reason: 'production_status',
      priority: 'high',
      can_submit: true,
      failure_reason: '人物手部变形',
    });
    expect(retryExecutionCandidates.find(candidate =>
      candidate.shot_id === firstProductionItem.shot_id
    )).toMatchObject({
      retry_reason: 'review_required',
      priority: 'high',
      can_submit: true,
      review_issues: [
        {
          review_id: shotReviewRes.data!.review_item.review_id,
          repair_action: 'redo_shot',
        },
      ],
    });
    expect(retryExecutionPlanRes.data?.markdown).toContain('Seedance 重试执行计划');
    expect(retryExecutionPlanRes.data?.markdown).toContain('可直接提交');

    const versionComparisonRes = await exportAiComicSeriesSeedanceVersionComparisonPackage(
      saveRes.data!.project.series_project_id,
    );
    expect(versionComparisonRes.ok).toBe(true);
    expect(versionComparisonRes.data?.schema_version)
      .toBe('ai-comic-series-seedance-version-comparison/v1');
    expect(versionComparisonRes.data?.comparable_shot_count).toBeGreaterThan(0);
    expect(versionComparisonRes.data?.selected_shot_count).toBeGreaterThan(0);
    const comparisonShot = versionComparisonRes.data?.shots.find(shot =>
      shot.production_id === firstProductionItem.production_id
    );
    expect(comparisonShot?.auto_best_version_id).toBe(autoSelectedItem?.selected_version_id);
    expect(comparisonShot?.selected_version_id).toBe(autoSelectedItem?.selected_version_id);
    expect(comparisonShot?.versions.some(version =>
      version.is_auto_best
      && version.is_selected
      && version.quality_score === 78
      && version.video_url === 'https://example.com/seedance/shot-001-v2.mp4'
    )).toBe(true);
    expect(versionComparisonRes.data?.markdown).toContain('Seedance 版本对比报告');
    expect(versionComparisonRes.data?.markdown).toContain('自动择优推荐');

    const retrySubmitRes = await submitAiComicSeriesSeedanceRetryExecutionPlan(
      saveRes.data!.project.series_project_id,
      {
        job_prefix: 'series-retry-test',
        note: '服务测试提交重试执行计划',
      },
    );
    expect(retrySubmitRes.ok).toBe(true);
    expect(retrySubmitRes.data?.schema_version).toBe('ai-comic-series-seedance-retry-submit-result/v1');
    expect(retrySubmitRes.data?.submitted_count).toBeGreaterThan(0);
    expect(retrySubmitRes.data?.submitted_shots.some(shot =>
      shot.production_id === retryCandidate!.production_id
      && shot.provider_job_id.startsWith('series-retry-test-')
      && shot.retry_count > retryCandidate!.retry_count
    )).toBe(true);
    const submittedRetryItem = retrySubmitRes.data?.seedance_production?.items.find(item =>
      item.production_id === retryCandidate!.production_id
    );
    expect(submittedRetryItem).toMatchObject({
      status: 'submitted',
      provider_job_id: expect.stringContaining('series-retry-test-'),
    });
    expect(retrySubmitRes.data?.markdown).toContain('Seedance 重试提交结果');

    const recoveryDryRunRes = await recoverAiComicSeriesSeedanceProviderTimeouts(
      saveRes.data!.project.series_project_id,
      { timeout_minutes: 0, statuses: ['submitted'] },
    );
    expect(recoveryDryRunRes.ok).toBe(true);
    expect(recoveryDryRunRes.data?.schema_version).toBe('ai-comic-series-seedance-provider-recovery-result/v1');
    expect(recoveryDryRunRes.data?.timed_out_count).toBeGreaterThan(0);
    expect(recoveryDryRunRes.data?.updated_count).toBe(0);
    expect(recoveryDryRunRes.data?.timed_out_shots.some(shot =>
      shot.production_id === retryCandidate!.production_id
      && shot.provider_job_id?.startsWith('series-retry-test-')
    )).toBe(true);

    const recoveryApplyRes = await recoverAiComicSeriesSeedanceProviderTimeouts(
      saveRes.data!.project.series_project_id,
      {
        timeout_minutes: 0,
        statuses: ['submitted'],
        mark_timed_out_failed: true,
        failure_reason: '测试标记超时失败',
      },
    );
    expect(recoveryApplyRes.ok).toBe(true);
    expect(recoveryApplyRes.data?.updated_count).toBe(recoveryDryRunRes.data?.timed_out_count);
    expect(recoveryApplyRes.data?.seedance_production?.items.find(item =>
      item.production_id === retryCandidate!.production_id
    )).toMatchObject({
      status: 'failed',
      failure_reason: '测试标记超时失败',
      provider_job_id: expect.stringContaining('series-retry-test-'),
    });
    expect(recoveryApplyRes.data?.markdown).toContain('Seedance 超时恢复');

    const providerEnvKeys = [
      'SEEDANCE_PROVIDER_SUBMIT_ENDPOINT',
      'SEEDANCE_PROVIDER_SUBMIT_API_TOKEN',
      'SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER',
      'SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME',
      'SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE',
      'SEEDANCE_PROVIDER_SIGNATURE_SECRET',
      'SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET',
      'SEEDANCE_PROVIDER_SIGNATURE_ALGORITHM',
      'SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_ALGORITHM',
    ];
    const previousProviderEnv = new Map(providerEnvKeys.map(key => [key, process.env[key]]));
    const originalFetch = globalThis.fetch;
    const providerFetchCalls: Array<{
      url: string;
      headers: Record<string, string>;
      body: Record<string, unknown>;
    }> = [];
    process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT = 'https://adapter.example.test/series/retry-submit';
    process.env.SEEDANCE_PROVIDER_SUBMIT_API_TOKEN = 'series-submit-token';
    process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER = 'X-Series-Submit-Key';
    process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME = 'Token';
    process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE = 'batch';
    delete process.env.SEEDANCE_PROVIDER_SIGNATURE_SECRET;
    delete process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET;
    globalThis.fetch = (async (input, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      const shots = body.shots as Array<Record<string, unknown>>;
      expect(body.schema_version).toBe('ai-comic-series-seedance-retry-submit/v1');
      expect(body.request_mode).toBe('batch');
      expect(shots).toHaveLength(1);
      expect(typeof shots[0].seedance_prompt).toBe('string');
      expect(String(shots[0].seedance_prompt).length).toBeGreaterThan(0);
      providerFetchCalls.push({
        url: String(input),
        headers: init?.headers as Record<string, string>,
        body,
      });
      return new Response(JSON.stringify({
        results: [
          {
            production_id: shots[0].production_id,
            shot_id: shots[0].shot_id,
            provider_job_id: 'series-adapter-job-001',
            status: 'processing',
            provider_queue_id: 'series-adapter-queue',
            provider_queue_position: '7',
          },
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    try {
      const retryAdapterSubmitRes = await submitAiComicSeriesSeedanceRetryExecutionPlan(
        saveRes.data!.project.series_project_id,
        {
          limit: 1,
          job_prefix: 'series-adapter-retry',
          use_provider_adapter: true,
          note: '服务测试 adapter 提交重试执行计划',
        },
      );
      expect(retryAdapterSubmitRes.ok).toBe(true);
      expect(providerFetchCalls).toHaveLength(1);
      expect(providerFetchCalls[0].url).toBe('https://adapter.example.test/series/retry-submit');
      expect(providerFetchCalls[0].headers['X-Series-Submit-Key']).toBe('Token series-submit-token');
      expect(retryAdapterSubmitRes.data?.provider_adapter).toMatchObject({
        request_mode: 'batch',
        requested_count: 1,
        accepted_count: 1,
        failed_count: 0,
      });
      expect(retryAdapterSubmitRes.data?.failed_count).toBe(0);
      expect(retryAdapterSubmitRes.data?.submitted_count).toBe(1);
      const adapterSubmittedShot = retryAdapterSubmitRes.data?.submitted_shots[0];
      expect(adapterSubmittedShot).toMatchObject({
        provider_job_id: 'series-adapter-job-001',
        provider_queue_id: 'series-adapter-queue',
        provider_queue_position: 7,
        status: 'processing',
      });
      expect(retryAdapterSubmitRes.data?.seedance_production?.items.find(item =>
        item.production_id === adapterSubmittedShot?.production_id
      )).toMatchObject({
        status: 'processing',
        provider_job_id: 'series-adapter-job-001',
      });
      expect(retryAdapterSubmitRes.data?.markdown).toContain('Provider Adapter');
    } finally {
      globalThis.fetch = originalFetch;
      for (const [key, value] of previousProviderEnv.entries()) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }

    const editedPlan = {
      ...planRes.data!,
      episodes: planRes.data!.episodes.map(episode =>
        episode.episode_no === 1
          ? { ...episode, ending_hook: `${episode.ending_hook}（改为新的承接点）` }
          : episode
      ),
    };
    const editedSaveRes = await saveAiComicSeriesProject({
      series_project_id: saveRes.data!.project.series_project_id,
      plan: editedPlan,
    });
    expect(editedSaveRes.ok).toBe(true);
    expect(editedSaveRes.data?.series_quality_audit?.episode_reports[0]).toMatchObject({
      episode_no: 1,
      plan_changed_after_generation: true,
      needs_episode_regeneration: true,
      needs_ledger_rebuild: true,
      status: 'needs_attention',
    });

    const rebuildRes = await rebuildAiComicSeriesContinuityLedger(saveRes.data!.project.series_project_id, {
      from_episode_no: 1,
    });
    expect(rebuildRes.ok).toBe(true);
    expect(rebuildRes.data?.continuity_ledger.episode_records[0].ending_hook).toContain('改为新的承接点');
    expect(rebuildRes.data?.series_quality_audit?.episode_reports[0]).toMatchObject({
      episode_no: 1,
      plan_changed_after_generation: false,
      needs_episode_regeneration: false,
      needs_ledger_rebuild: false,
    });
  });

  it('uses the saved continuity ledger when generating a later episode', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志',
      episode_count: 3,
      episode_duration_range_sec: { min: 60, max: 120 },
    });
    expect(planRes.ok).toBe(true);

    const saveRes = await saveAiComicSeriesProject({ plan: planRes.data! });
    expect(saveRes.ok).toBe(true);

    const firstEpisodeRes = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 1,
      series_project_id: saveRes.data!.project.series_project_id,
      output_gears_segments: false,
    });
    expect(firstEpisodeRes.ok).toBe(true);

    const previewRes = await previewAiComicEpisodeContext({
      series_plan: planRes.data!,
      episode_no: 2,
      series_project_id: saveRes.data!.project.series_project_id,
    });
    expect(previewRes.ok).toBe(true);
    expect(previewRes.data?.schema_version).toBe('ai-comic-episode-context-preview/v1');
    expect(previewRes.data?.used_saved_ledger).toBe(true);
    expect(previewRes.data?.blueprint.schema_version).toBe('ai-comic-episode-blueprint/v1');
    expect(previewRes.data?.blueprint.episode_no).toBe(2);
    expect(previewRes.data?.generation_outline).toContain('连续性账本');
    expect(previewRes.data?.generation_outline).toContain('系列记忆精准召回');
    expect(previewRes.data?.generation_outline).toContain('制作约束审计');
    expect(previewRes.data?.generation_outline).toContain('长期情景记忆模糊召回');
    expect(previewRes.data?.generation_outline).toContain('上一条生成记忆');
    expect(previewRes.data?.narrative_patterns.length).toBeGreaterThan(0);
    expect(previewRes.data?.generation_outline).toContain(previewRes.data!.narrative_patterns[0]);
    expect(previewRes.data?.generation_outline).toContain(firstEpisodeRes.data!.storyId);
    expect(previewRes.data?.ledger_summary.last_generated_episode_no).toBe(1);
    expect(previewRes.data?.ledger_summary.series_memory?.characters.length).toBeGreaterThan(0);
    expect(previewRes.data?.ledger_summary.production_constraints?.active_count).toBeGreaterThan(0);
    expect(previewRes.data?.ledger_summary.episodic_memory?.total_count).toBeGreaterThan(0);
    expect(previewRes.data?.ledger_summary.memory_conflicts?.total_conflict_count).toBeGreaterThanOrEqual(0);
    expect(previewRes.data?.focused_memory_recall?.schema_version).toBe('ai-comic-series-memory-recall/v1');
    expect(previewRes.data?.focused_memory_recall?.episode_no).toBe(2);
    expect(previewRes.data?.focused_memory_recall?.items.length).toBeGreaterThan(0);
    expect(previewRes.data?.focused_memory_recall?.items.some(item =>
      item.category === 'character' || item.reasons.includes('上一集承接')
    )).toBe(true);
    expect(previewRes.data?.focused_episodic_memory_recall?.schema_version)
      .toBe('ai-comic-episodic-memory-recall/v1');
    expect(previewRes.data?.focused_episodic_memory_recall?.items.length).toBeGreaterThan(0);
    expect(previewRes.data?.focused_episodic_memory_recall?.items.some(item =>
      item.reasons.includes('上一集情绪承接')
    )).toBe(true);
    expect(previewRes.data?.previous_episode_memory.length).toBeGreaterThan(0);
    const controlledMemoryId = previewRes.data!.focused_memory_recall!.items[0]!.memory_id;
    const excludedPreviewRes = await previewAiComicEpisodeContext({
      series_plan: planRes.data!,
      episode_no: 2,
      series_project_id: saveRes.data!.project.series_project_id,
      memory_recall_controls: {
        excluded_memory_ids: [controlledMemoryId],
      },
    });
    expect(excludedPreviewRes.ok).toBe(true);
    expect(excludedPreviewRes.data?.focused_memory_recall?.items.some(item =>
      item.memory_id === controlledMemoryId
    )).toBe(false);

    const lockedPreviewRes = await previewAiComicEpisodeContext({
      series_plan: planRes.data!,
      episode_no: 2,
      series_project_id: saveRes.data!.project.series_project_id,
      memory_recall_controls: {
        locked_memory_ids: [controlledMemoryId],
        excluded_memory_ids: [controlledMemoryId],
      },
    });
    expect(lockedPreviewRes.ok).toBe(true);
    expect(lockedPreviewRes.data?.focused_memory_recall?.items.some(item =>
      item.memory_id === controlledMemoryId && item.reasons.includes('人工锁定')
    )).toBe(true);
    expect(lockedPreviewRes.data?.generation_outline).toContain('人工锁定');

    const preferenceSaveRes = await saveAiComicSeriesProject({
      series_project_id: saveRes.data!.project.series_project_id,
      plan: planRes.data!,
      memory_recall_preferences: {
        per_episode: {
          2: {
            locked_memory_ids: [controlledMemoryId],
            excluded_memory_ids: [controlledMemoryId],
          },
        },
      },
    });
    expect(preferenceSaveRes.ok).toBe(true);
    expect(preferenceSaveRes.data?.memory_recall_preferences?.per_episode?.['2']?.locked_memory_ids)
      .toContain(controlledMemoryId);

    const persistedPreferencePreviewRes = await previewAiComicEpisodeContext({
      series_plan: planRes.data!,
      episode_no: 2,
      series_project_id: saveRes.data!.project.series_project_id,
    });
    expect(persistedPreferencePreviewRes.ok).toBe(true);
    expect(persistedPreferencePreviewRes.data?.focused_memory_recall?.items.some(item =>
      item.memory_id === controlledMemoryId && item.reasons.includes('人工锁定')
    )).toBe(true);

    const secondEpisodeRes = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 2,
      series_project_id: saveRes.data!.project.series_project_id,
      output_gears_segments: false,
    });
    expect(secondEpisodeRes.ok).toBe(true);
    expect(secondEpisodeRes.data?.original_user_query).toContain('连续性账本');
    expect(secondEpisodeRes.data?.original_user_query).toContain('系列记忆精准召回');
    expect(secondEpisodeRes.data?.original_user_query).toContain('长期情景记忆模糊召回');
    expect(secondEpisodeRes.data?.original_user_query).toContain('人工锁定');
    expect(secondEpisodeRes.data?.original_user_query).toContain('账本未回收线索');
    expect(secondEpisodeRes.data?.original_user_query).toContain('上一条生成记忆');
    expect(secondEpisodeRes.data?.original_user_query).toContain(firstEpisodeRes.data!.storyId);
  });
});
