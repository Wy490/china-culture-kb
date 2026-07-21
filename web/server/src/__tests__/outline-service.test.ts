import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { GEARS_CALLBACK_BATCH_ITEM_LIMIT } from '@shared/types.js';
import { analyzeOutline, multiMatchEntries } from '../services/outline-service.js';
import { getStory } from '../services/story-service.js';
import { getProject } from '../services/project-service.js';
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
  generateAiComicSeriesVisualIdentitySuggestionDraft,
  generateAiComicSeriesVisualWorldRuleSuggestionDraft,
  getAiComicSeriesProductionReadiness,
  getAiComicSeriesProject,
  getAiComicSeriesSeedanceProductionDashboard,
  listAiComicSeriesProjects,
  mixAiComicSeriesSeedanceAudio,
  previewAiComicEpisodeContext,
  readAiComicSeriesMediaAssetPreview,
  recoverAiComicSeriesSeedanceProviderTimeouts,
  rebuildAiComicSeriesContinuityLedger,
  rebuildAiComicSeriesVisualBible,
  updateAiComicSeriesVisualIdentityDefinition,
  updateAiComicSeriesVisualWorldRuleDefinition,
  rollbackAiComicSeriesSeedanceFinalDelivery,
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
  uploadAiComicSeriesSeedanceAssetFile,
  updateAiComicSeriesSeedanceAssetLibrary,
  updateAiComicSeriesSeedanceAudioLibrary,
  updateAiComicSeriesMediaAssetReview,
  updateAiComicSeriesSeedanceProductionStatus,
  updateAiComicSeriesSeedanceProductionStatuses,
} from '../services/ai-comic-series-service.js';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const ORIGINAL_KB_ROOT = process.env.KB_ROOT;
const ORIGINAL_WEB_GENERATED_ROOT = process.env.WEB_GENERATED_ROOT;
const ORIGINAL_GEARS_API_BASE_URL = process.env.GEARS_API_BASE_URL;
const ORIGINAL_GEARS_API_TOKEN = process.env.GEARS_API_TOKEN;
let testWorkspaceRoot = '';

function gearsExecutionWorkerCapabilityResponse(): Response {
  return new Response(JSON.stringify({
    schema_version: 'gears-execution-worker-capabilities/v1',
    service: 'gears-execution-worker',
    execution_worker_supported: true,
    workbench_import_supported: false,
    bearer_auth_required: true,
    idempotent_submit: true,
    status_poll_supported: true,
    callback_delivery_supported: true,
    provider_asset_handoff_supported: true,
    supported_job_types: ['seedance_video'],
    endpoints: {
      capabilities: { method: 'GET', path: '/gears/capabilities' },
      submit: { method: 'POST', path: '/gears/jobs' },
      job_status: { method: 'GET', path: '/gears/jobs/{gears_job_id}' },
    },
  }));
}

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
    expect(res.data?.detected_characters.map(character => character.name)).toEqual(['毛泽东']);
  });

  it('matches the Mao Zedong entry for protagonist knowledge needs', async () => {
    const analysis = await analyzeOutline({
      outline: '毛泽东少年时期到革命觉醒的故事，重点表现湖南乡土、求学、新民学会、农民运动、理想形成。',
    });

    expect(analysis.ok).toBe(true);
    expect(analysis.data?.story_intent.time_range).toBe('少年→求学→新民学会→农民运动→革命觉醒→理想形成');
    expect(analysis.data?.story_intent.core_theme).toBe('求学与革命觉醒');
    expect(analysis.data?.story_intent.conflict_keywords).toEqual(expect.arrayContaining(['新民学会', '农民运动']));
    expect(analysis.data?.knowledge_needs.find(need => need.need_id === 'historical_events')?.keywords)
      .toEqual(expect.arrayContaining(['新民学会', '农民运动']));
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
    const mao = res.data?.matched_knowledge_pack.primary_entries.find(entry => entry.entry_name.startsWith('毛泽东——'));
    expect(mao?.type).toBe('历史人物');
    expect(mao?.role_in_story).toBe('main_character');
    expect(res.data?.matched_knowledge_pack.primary_entries[0]?.entry_name).toMatch(/^毛泽东——/);
    expect(res.data?.matched_knowledge_pack.overall_confidence).toBe(1);
    expect(res.data?.matched_knowledge_pack.supporting_entries.length).toBeLessThanOrEqual(15);
    expect(matchedNames.some(name => name.startsWith('新民学会——'))).toBe(true);
    expect(matchedNames.some(name => name.startsWith('湖南花鼓戏——'))).toBe(false);
    expect(matchedNames.some(name => name.startsWith('刘海砍樵——'))).toBe(false);
    expect(matchedNames.some(name => name.includes('宋代士人设定包'))).toBe(false);
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
    expect(res.data?.episodes.map(episode => episode.title).join('\n')).not.toContain('主角');
    expect(res.data?.episodes.map(episode => episode.title).join('\n')).not.toMatch(/问题出现|最终选择|新变化/);
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
    const accessControl = {
      schema_version: 'story-agent-product-resource-ownership/v1' as const,
      organization_id: 'outline-test-organization',
      owner_actor_id: 'outline-test-owner',
      member_actor_ids: ['outline-test-member'],
    };
    const res = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 2,
      output_gears_segments: false,
      auto_repair_episode: true,
    }, { access_control: accessControl });

    expect(res.ok).toBe(true);
    expect(res.data?.sourceDomain).toBe('china_culture');
    expect(res.data?.domain_safety).toMatchObject({
      domain: 'china_culture',
      passed: true,
      machine_validation_only: true,
      human_review_complete: false,
      real_credit_granted: false,
    });
    expect(res.data?.video_type).toBe('ai_comic_drama');
    expect(res.data?.presentation_style).toBe('ai_comic');
    expect(res.data?.title).toMatch(/^第2集：/);
    expect(res.data?.title).not.toMatch(/^第2集：第2集：/);
    expect(res.data?.title).not.toContain('主角');
    expect(res.data?.original_user_query).toContain('本集只写第2集');
    expect(res.data?.original_user_query).toContain('本集主冲突');
    expect(res.data?.original_user_query).toContain('成稿方向');
    expect(res.data?.original_user_query).not.toContain('叙事流派机制');
    expect(res.data?.original_user_query).not.toContain('连续性账本');
    expect(res.data?.credibility_note).not.toContain('叙事流派机制');
    expect(res.data?.scene_breakdown.length).toBeGreaterThan(0);
    const visibleMainConflict = planRes.data!.episodes[1].main_conflict.replace(/主角/g, '周敦颐');
    expect(res.data?.scene_breakdown.some(scene => scene.conflict?.includes(visibleMainConflict)))
      .toBe(true);
    expect(res.data?.scene_breakdown.map(scene => scene.title)).toEqual([
      '上官召帖',
      '暂缓行刑',
      '堂前问责',
      '旧案号一角',
      '递出复核文书',
    ]);
    expect(res.data?.full_text).toContain('拒签的后果');
    expect(res.data?.full_text).toContain('复核文书');
    expect(JSON.stringify([
      res.data?.full_text,
      res.data?.scene_breakdown,
      res.data?.dialogue,
      res.data?.gears_segments,
    ])).not.toMatch(
      /生成优先级|核心画面是|知识库使用规则|素材使用规则|新增知识焦点|新增素材焦点|素材焦点|新增剧情信息|建立主角初始状态|阶段转折落地|打开线索|知识线|素材线|推进phase|指向第\d+集|对照角色|关键见证者|主角/,
    );
    expect(res.data?.dialogue?.length).toBeGreaterThan(0);
    expect(res.data?.ai_comic_episode_blueprint?.schema_version).toBe('ai-comic-episode-blueprint/v1');
    expect(res.data?.ai_comic_episode_blueprint?.episode_no).toBe(2);
    expect(res.data?.ai_comic_episode_quality?.schema_version).toBe('ai-comic-episode-quality/v1');
    expect(res.data?.continuity_audit?.schema_version).toBe('ai-comic-continuity-audit/v1');
    const projectRes = await getProject(res.data!.project_id!);
    expect(projectRes.ok).toBe(true);
    expect(projectRes.data?.project.access_control).toEqual(accessControl);
    expect(projectRes.data?.current_story.full_text).toBe(res.data?.full_text);
    expect(projectRes.data?.current_story.domain_safety).toEqual(res.data?.domain_safety);
  });

  it('generates an original series episode when the outline has no registered knowledge match', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '少年阿湘为阻止老街戏台拆除，沿着祖父留下的皮影机关线索寻找失散的戏班成员，每集解决一次传承危机，最终完成公开演出。',
      series_title: '长沙皮影守艺录',
      episode_count: 3,
      episode_duration_range_sec: { min: 60, max: 120 },
      pacing_profile: 'balanced_drama',
      generation_scope: 'full_planning',
    });

    expect(planRes.ok).toBe(true);
    expect(planRes.data?.core_theme).toContain('守艺');
    expect(planRes.data?.main_characters[0]?.name).toBe('阿湘');
    expect(planRes.data?.episodes.map(episode => episode.title).join('\n')).toMatch(/戏台|皮影|影偶|演出/);
    expect(JSON.stringify(planRes.data?.episodes)).toMatch(/拆除|戏班|机关谱|公开演出/);
    expect(JSON.stringify(planRes.data?.episodes)).not.toMatch(/案卷|证词|判词|催签|封泥/);
    expect(planRes.data?.episodes.every(episode =>
      episode.foreshadowing.every(foreshadowing =>
        planRes.data!.plot_threads.some(thread => foreshadowing.includes(thread.title))
      )
    )).toBe(true);
    const saved = await saveAiComicSeriesProject({ plan: planRes.data! });
    expect(saved.ok).toBe(true);

    const episodeRes = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 1,
      series_project_id: saved.data!.project.series_project_id,
      output_gears_segments: true,
    });

    expect(episodeRes.ok, JSON.stringify(episodeRes.error)).toBe(true);
    expect(episodeRes.data?.truth_mode).toBe('fictional_original');
    expect(episodeRes.data?.source_entry).toMatch(/——用户原创故事种子$/);
    expect(episodeRes.data?.knowledge_pack?.primary_entries[0]).toMatchObject({
      entry_name: episodeRes.data?.source_entry,
      province: '用户素材',
    });
    expect(episodeRes.data?.material_pack?.primary_materials[0]?.linked_entry_name)
      .toBe(episodeRes.data?.source_entry);
    expect(episodeRes.data?.full_text).toMatch(/阿湘/);
    expect(episodeRes.data?.full_text).toMatch(/戏台|皮影|影偶|灯幕|演出/);
    expect(JSON.stringify([
      episodeRes.data?.full_text,
      episodeRes.data?.scene_breakdown,
      episodeRes.data?.gears_segments,
      episodeRes.data?.credibility_note,
    ])).not.toMatch(/濂溪|案卷|证词|判词|催签|封泥|宋代衙署/);
    expect(episodeRes.data?.gears_delivery?.character_assets.map(asset => asset.name).sort())
      .toEqual(['戏班同伴', '拆迁负责人', '阿湘'].sort());
    expect(episodeRes.data?.gears_delivery?.scene_assets.map(asset => asset.name).join('\n'))
      .toMatch(/长沙老街旧戏台前场|旧戏台后台与皮影工作台|旧戏台灯幕后/);
    expect(episodeRes.data?.gears_delivery?.character_assets.every(asset =>
      !/少年阿湘|长沙皮影守|拆除告示生|关键见证者|对照角色/.test(asset.name)
      && !asset.clothing.includes('符合对应历史时期')
    )).toBe(true);
    expect(episodeRes.data?.gears_delivery?.scene_assets.every(asset => asset.name !== '用户素材'))
      .toBe(true);
    const preReadySubtitlePackage = await exportAiComicSeriesSeedanceSubtitlePackage(
      saved.data!.project.series_project_id,
      { episode_no: 1 },
    );
    expect(preReadySubtitlePackage.ok, JSON.stringify(preReadySubtitlePackage.error)).toBe(true);
    expect(preReadySubtitlePackage.data?.cue_count).toBeGreaterThan(0);
    expect(preReadySubtitlePackage.data?.cues.every(cue => cue.episode_no === 1)).toBe(true);
    const preReadyTitleCardPackage = await exportAiComicSeriesSeedanceTitleCardPlanPackage(
      saved.data!.project.series_project_id,
    );
    expect(preReadyTitleCardPackage.ok, JSON.stringify(preReadyTitleCardPackage.error)).toBe(true);
    expect(preReadyTitleCardPackage.data?.cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ card_id: 'card-series-opening', placement: 'series_opening' }),
      expect.objectContaining({ card_id: 'card-e1-opening', placement: 'episode_opening', episode_no: 1 }),
      expect.objectContaining({ card_id: 'card-e1-ending', placement: 'episode_ending', episode_no: 1 }),
      expect.objectContaining({ card_id: 'card-series-ending', placement: 'series_ending' }),
    ]));
    expect(episodeRes.data?.domain_safety).toMatchObject({
      domain: 'china_culture',
      passed: true,
      machine_validation_only: true,
      human_review_complete: false,
      real_credit_granted: false,
    });
  });

  it('keeps adjacent AI comic episodes distinct and audience-facing after ledger generation', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，后来面对南安军拒签冤案，坚持良知。每集都要让案卷压力、少年见证和拒签选择继续升级。',
      series_title: '濂溪少年志',
      episode_count: 3,
      episode_duration_range_sec: { min: 60, max: 120 },
      pacing_profile: 'fast_hook',
      generation_scope: 'full_planning',
      narrative_pattern_ids: ['mortal_growth'],
    });

    expect(planRes.ok).toBe(true);
    const seriesAccessControl = {
      schema_version: 'story-agent-product-resource-ownership/v1' as const,
      organization_id: 'series-test-organization',
      owner_actor_id: 'series-test-owner',
      member_actor_ids: ['series-test-member'],
    };
    const saved = await saveAiComicSeriesProject(
      { plan: planRes.data! },
      { access_control: seriesAccessControl },
    );
    expect(saved.ok).toBe(true);
    const seriesProjectId = saved.data!.project.series_project_id;

    const episodeOne = await generateAiComicEpisodeFromPlan({
      series_project_id: seriesProjectId,
      series_plan: planRes.data!,
      episode_no: 1,
      output_gears_segments: true,
      auto_repair_episode: true,
    });
    const episodeTwo = await generateAiComicEpisodeFromPlan({
      series_project_id: seriesProjectId,
      series_plan: planRes.data!,
      episode_no: 2,
      output_gears_segments: true,
      auto_repair_episode: true,
    });

    expect(episodeOne.ok).toBe(true);
    expect(episodeTwo.ok).toBe(true);
    const episodeOneProject = await getProject(episodeOne.data!.project_id!);
    expect(episodeOneProject.data?.project.access_control).toEqual(seriesAccessControl);
    expect(episodeOne.data?.title).toMatch(/^第1集：/);
    expect(episodeOne.data?.title).not.toMatch(/^第1集：第1集：/);
    expect(episodeOne.data?.title).not.toContain('主角');
    expect(episodeTwo.data?.title).toMatch(/^第2集：/);
    expect(episodeTwo.data?.title).not.toMatch(/^第2集：第2集：/);
    expect(episodeTwo.data?.title).not.toContain('主角');
    expect(episodeOne.data?.full_text).not.toBe(episodeTwo.data?.full_text);

    const firstSceneTitles = episodeOne.data?.scene_breakdown.map(scene => scene.title) ?? [];
    const secondSceneTitles = episodeTwo.data?.scene_breakdown.map(scene => scene.title) ?? [];
    expect(firstSceneTitles[0]).toBe('未签的案卷');
    expect(secondSceneTitles).toEqual([
      '上官召帖',
      '暂缓行刑',
      '堂前问责',
      '旧案号一角',
      '递出复核文书',
    ]);
    expect(firstSceneTitles.filter(title => secondSceneTitles.includes(title))).toHaveLength(0);
    expect(episodeTwo.data?.full_text).toContain('暂缓行刑');
    expect(episodeTwo.data?.full_text).toContain('可能因此丢官');
    expect(episodeOne.data?.gears_segments?.length).toBeGreaterThan(0);
    expect(episodeTwo.data?.gears_segments?.length).toBeGreaterThan(0);

    const audienceText = JSON.stringify([
      episodeOne.data?.full_text,
      episodeOne.data?.scene_breakdown,
      episodeOne.data?.dialogue,
      episodeOne.data?.gears_segments,
      episodeTwo.data?.full_text,
      episodeTwo.data?.scene_breakdown,
      episodeTwo.data?.dialogue,
      episodeTwo.data?.gears_segments,
    ]);
    expect(audienceText).not.toMatch(
      /生成优先级|核心画面是|知识库使用规则|素材使用规则|新增知识焦点|新增素材焦点|素材焦点|新增剧情信息|建立主角初始状态|阶段转折落地|打开线索|知识线|素材线|推进phase|指向第\d+集|对照角色|关键见证者|主角/,
    );

    useOutlineTestRoots();
    const savedEpisodeOne = await getStory(episodeOne.data!.storyId);
    expect(savedEpisodeOne.ok).toBe(true);
    expect(savedEpisodeOne.data?.full_text).toBe(episodeOne.data?.full_text);
    expect(JSON.stringify([
      savedEpisodeOne.data?.full_text,
      savedEpisodeOne.data?.scene_breakdown,
      savedEpisodeOne.data?.dialogue,
      savedEpisodeOne.data?.gears_segments,
    ])).not.toMatch(
      /生成优先级|核心画面是|知识库使用规则|素材使用规则|新增知识焦点|新增素材焦点|素材焦点|新增剧情信息|建立主角初始状态|阶段转折落地|打开线索|知识线|素材线|推进phase|指向第\d+集|对照角色|关键见证者|主角/,
    );
  });

  it('turns AI comic episode planning labels into visible story evidence', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，后来面对南安军拒签冤案，坚持良知。第一集必须把疑点变成可见证物。',
      series_title: '濂溪少年志',
      episode_count: 3,
      episode_duration_range_sec: { min: 60, max: 120 },
      pacing_profile: 'fast_hook',
      generation_scope: 'full_planning',
      narrative_pattern_ids: ['mortal_growth'],
    });

    expect(planRes.ok).toBe(true);
    const plan = {
      ...planRes.data!,
      episodes: planRes.data!.episodes.map(episode => episode.episode_no === 1
        ? {
            ...episode,
            new_information: ['新增知识焦点：周敦颐'],
          }
        : episode),
    };

    const res = await generateAiComicEpisodeFromPlan({
      series_plan: plan,
      episode_no: 1,
      output_gears_segments: true,
      auto_repair_episode: true,
    });

    expect(res.ok).toBe(true);
    const audienceText = JSON.stringify([
      res.data?.full_text,
      res.data?.scene_breakdown,
      res.data?.dialogue,
      res.data?.gears_segments,
    ]);
    expect(audienceText).toContain('带泥证物');
    expect(audienceText).not.toContain('新增知识焦点');
    expect(audienceText).not.toContain('素材焦点');
    expect(audienceText).not.toContain('把周敦颐摆到灯下');
  });

  it('keeps rapid AI comic episode story ids unique even under fixed time and random seed', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1710000000000);
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    try {
      const planRes = await generateAiComicSeriesPlan({
        outline: '周敦颐少年在濂溪读书，后来面对南安军拒签冤案，坚持良知。',
        series_title: '濂溪少年志',
        episode_count: 3,
        episode_duration_range_sec: { min: 60, max: 120 },
        pacing_profile: 'fast_hook',
        generation_scope: 'full_planning',
        narrative_pattern_ids: ['mortal_growth'],
      });

      expect(planRes.ok).toBe(true);
      const first = await generateAiComicEpisodeFromPlan({
        series_plan: planRes.data!,
        episode_no: 2,
        output_gears_segments: false,
        auto_repair_episode: true,
      });
      const second = await generateAiComicEpisodeFromPlan({
        series_plan: planRes.data!,
        episode_no: 2,
        output_gears_segments: false,
        auto_repair_episode: true,
      });

      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      expect(first.data?.storyId).toMatch(/^\d{8}-story-[0-9a-z]+$/);
      expect(second.data?.storyId).toMatch(/^\d{8}-story-[0-9a-z]+$/);
      expect(first.data?.storyId).not.toBe(second.data?.storyId);
    } finally {
      nowSpy.mockRestore();
      randomSpy.mockRestore();
    }
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
    expect(saveRes.data?.visual_bible?.schema_version).toBe('ai-comic-series-visual-bible/v1');
    expect(saveRes.data?.visual_bible?.identities.some(identity => identity.kind === 'character')).toBe(true);
    expect(saveRes.data?.visual_bible?.production_credit_identity_count).toBe(0);
    const savedVisualIdentityIds = saveRes.data?.visual_bible?.identities.map(identity => identity.identity_id);

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
    expect(getRes.data?.visual_bible?.identities.map(identity => identity.identity_id))
      .toEqual(savedVisualIdentityIds);

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
    expect(exportRes.data?.visual_bible.identities.map(identity => identity.identity_id))
      .toEqual(savedVisualIdentityIds);
    expect(exportRes.data?.production_tables.episode_status[0]).toMatchObject({
      episode_no: 1,
      status: 'generated',
      story_id: '20260611-story-abc1',
    });
    expect(exportRes.data?.markdown).toContain('# 濂溪少年志 系列 Bible');
    expect(exportRes.data?.markdown).toContain('## 主线剧情骨架');
    expect(exportRes.data?.markdown).toContain('## 连续性账本');
    expect(exportRes.data?.markdown).toContain('## 系列记忆引擎');
    expect(exportRes.data?.markdown).toContain('## 系列视觉圣经与稳定身份图谱');
    expect(exportRes.data?.markdown).toContain('### 稳定视觉身份');
    expect(exportRes.data?.markdown).toContain('## 制作表');
    expect(exportRes.data?.markdown).toContain('### 角色表');
    expect(exportRes.data?.markdown).toContain('### 系列记忆表');
    expect(exportRes.data?.markdown).toContain('### 制作约束表');
    expect(exportRes.data?.markdown).toContain('### 情景记忆表');
    expect(exportRes.data?.markdown).toContain('### 分集状态表');
    expect(exportRes.data?.markdown).toContain('线索闭环');
    expect(exportRes.data?.markdown).toContain('记忆冲突');
    expect(exportRes.data?.markdown).toContain('第1集：未签的案卷');

    const rebuildVisualBibleRes = await rebuildAiComicSeriesVisualBible(
      saveRes.data!.project.series_project_id,
    );
    expect(rebuildVisualBibleRes.ok).toBe(true);
    expect(rebuildVisualBibleRes.data?.visual_bible?.identities.map(identity => identity.identity_id))
      .toEqual(savedVisualIdentityIds);
    const characterIdentity = rebuildVisualBibleRes.data!.visual_bible!.identities
      .find(identity => identity.kind === 'character')!;
    const definitionFields = Object.fromEntries(
      characterIdentity.definition_fields.map(field => [field.field_id, `${field.label}已由测试确认`]),
    );
    const incompleteApproval = await updateAiComicSeriesVisualIdentityDefinition(
      saveRes.data!.project.series_project_id,
      characterIdentity.identity_id,
      {
        expected_source_fingerprint: characterIdentity.source_fingerprint,
        fields: { [characterIdentity.definition_fields[0].field_id]: '仅填写一项' },
        action: 'approve',
        reviewer_id: 'visual-reviewer-001',
        human_confirmed: true,
        review_note: '逐项复核',
      },
    );
    expect(incompleteApproval.ok).toBe(false);
    expect(incompleteApproval.error?.message).toContain('尚未完整');
    const approvedDefinition = await updateAiComicSeriesVisualIdentityDefinition(
      saveRes.data!.project.series_project_id,
      characterIdentity.identity_id,
      {
        expected_source_fingerprint: characterIdentity.source_fingerprint,
        fields: definitionFields,
        definition_notes: '跨集人物外观保持一致',
        action: 'approve',
        reviewer_id: 'visual-reviewer-001',
        human_confirmed: true,
        review_note: '已对照角色设定逐项复核',
      },
    );
    expect(approvedDefinition.ok).toBe(true);
    expect(approvedDefinition.data?.visual_bible?.approved_identity_count).toBe(1);
    expect(approvedDefinition.data?.visual_bible?.identities
      .find(identity => identity.identity_id === characterIdentity.identity_id)?.approval.status)
      .toBe('approved');
    const readApprovedDefinition = await getAiComicSeriesProject(saveRes.data!.project.series_project_id);
    expect(readApprovedDefinition.data?.visual_bible?.identities
      .find(identity => identity.identity_id === characterIdentity.identity_id)?.definition_notes)
      .toBe('跨集人物外观保持一致');
    const persistedProject = JSON.parse(await readFile(resolve(
      outlineGeneratedRoot(),
      'ai-comic-series-projects',
      saveRes.data!.project.series_project_id,
      'project.json',
    ), 'utf8'));
    expect(persistedProject.visual_bible.schema_version).toBe('ai-comic-series-visual-bible/v1');
    expect(persistedProject.visual_bible.identities.map((identity: { identity_id: string }) => identity.identity_id))
      .toEqual(savedVisualIdentityIds);
    expect(persistedProject.visual_bible.approved_identity_count).toBe(1);
  });

  it('requires verified E1/E2/E3 world-rule targets before approving and persists the visual mapping', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '当代皮影悬疑：三位守灯人必须遵守午夜灯幕规则，否则会失去共同记忆。',
      series_title: '守灯规则试验',
      episode_count: 3,
      episode_duration_range_sec: { min: 60, max: 120 },
      pacing_profile: 'mystery_cliffhanger',
      generation_scope: 'full_planning',
    });
    expect(planRes.ok).toBe(true);
    const plan = {
      ...planRes.data!,
      premise_contract: {
        ...planRes.data!.premise_contract!,
        world_rules: [{
          rule_id: 'midnight-lamp-screen-rule',
          statement: '午夜灯幕熄灭后不得跨过白幕禁位',
          consequence: '违规者会失去共同记忆',
          required: true,
          evidence_span: '午夜灯幕熄灭后不得跨过白幕禁位',
        }],
      },
    };
    const episodeResults = await Promise.all([1, 2, 3].map(episodeNo => generateAiComicEpisodeFromPlan({
      series_plan: plan,
      episode_no: episodeNo,
      output_gears_segments: true,
      auto_repair_episode: true,
    })));
    expect(episodeResults.every(result => result.ok && result.data?.gears_segments.length)).toBe(true);
    const generatedEpisodeStoryIds = Object.fromEntries(episodeResults.map((result, index) => [
      String(index + 1),
      result.data!.storyId,
    ]));
    const saveRes = await saveAiComicSeriesProject({ plan, generated_episode_story_ids: generatedEpisodeStoryIds });
    expect(saveRes.ok).toBe(true);
    const rule = saveRes.data!.visual_bible!.world_rules[0]!;
    const fields = Object.fromEntries(rule.definition_fields.map(field => [
      field.field_id,
      `${field.label}已由真人确认`,
    ]));
    const firstSegmentId = String(episodeResults[0].data!.gears_segments[0]!.segment_id);
    const incomplete = await updateAiComicSeriesVisualWorldRuleDefinition(
      saveRes.data!.project.series_project_id,
      rule.rule_id,
      {
        expected_source_fingerprint: rule.source_fingerprint,
        fields,
        pilot_bindings: [{ episode_no: 1, target_type: 'gears_segment', target_id: firstSegmentId }],
        action: 'approve',
        reviewer_id: 'visual-reviewer-001',
        human_confirmed: true,
        review_note: '先核对首集规则目标',
      },
    );
    expect(incomplete.ok).toBe(false);
    expect(incomplete.error?.message).toContain('E2');

    const approved = await updateAiComicSeriesVisualWorldRuleDefinition(
      saveRes.data!.project.series_project_id,
      rule.rule_id,
      {
        expected_source_fingerprint: rule.source_fingerprint,
        fields,
        definition_notes: '白幕、灯火与逆影必须在三集保持可见因果关系。',
        pilot_bindings: episodeResults.map((result, index) => ({
          episode_no: index + 1,
          target_type: 'gears_segment' as const,
          target_id: String(result.data!.gears_segments[0]!.segment_id),
        })),
        action: 'approve',
        reviewer_id: 'visual-reviewer-001',
        human_confirmed: true,
        review_note: '已逐项核对规则文本、视觉符号、触发条件和三个真实 GEARS 段。',
      },
    );
    expect(approved.ok).toBe(true);
    expect(approved.data?.visual_bible?.approved_world_rule_count).toBe(1);
    expect(approved.data?.visual_bible?.world_rules[0]).toMatchObject({
      definition_status: 'ready',
      missing_pilot_episode_nos: [],
      approval: { status: 'approved' },
    });

    const readRes = await getAiComicSeriesProject(saveRes.data!.project.series_project_id);
    expect(readRes.data?.visual_bible?.world_rules[0]?.pilot_bindings).toHaveLength(3);
  });

  it('returns auditable visual suggestion patches without overwriting or persisting project data', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '当代皮影悬疑：守灯人林灯必须遵守午夜灯幕规则，否则会失去共同记忆。',
      series_title: '视觉建议只读合同试验',
      episode_count: 3,
      episode_duration_range_sec: { min: 60, max: 120 },
      pacing_profile: 'mystery_cliffhanger',
      generation_scope: 'full_planning',
    });
    expect(planRes.ok).toBe(true);
    const plan = {
      ...planRes.data!,
      premise_contract: {
        ...planRes.data!.premise_contract!,
        world_rules: [{
          rule_id: 'midnight-lamp-screen-rule',
          statement: '午夜灯幕熄灭后不得跨过白幕禁位',
          consequence: '违规者会失去共同记忆',
          required: true,
          evidence_span: '午夜灯幕熄灭后不得跨过白幕禁位',
        }],
      },
    };
    const saveRes = await saveAiComicSeriesProject({ plan });
    expect(saveRes.ok).toBe(true);
    const seriesProjectId = saveRes.data!.project.series_project_id;
    const identity = saveRes.data!.visual_bible!.identities.find(item => item.kind === 'character')!;
    const bodyTypeField = identity.definition_fields.find(field => field.field_id === 'body_type')!;
    const draftSaved = await updateAiComicSeriesVisualIdentityDefinition(
      seriesProjectId,
      identity.identity_id,
      {
        expected_source_fingerprint: identity.source_fingerprint,
        fields: { [bodyTypeField.field_id]: '真人已填写的瘦高体态，不得覆盖' },
        action: 'save_draft',
      },
    );
    expect(draftSaved.ok).toBe(true);
    const projectPath = resolve(
      outlineGeneratedRoot(),
      'ai-comic-series-projects',
      seriesProjectId,
      'project.json',
    );
    const beforeBytes = await readFile(projectPath, 'utf8');
    const beforeUpdatedAt = draftSaved.data!.project.updated_at;

    const identitySuggestion = await generateAiComicSeriesVisualIdentitySuggestionDraft(
      seriesProjectId,
      identity.identity_id,
    );
    expect(identitySuggestion.ok).toBe(true);
    expect(identitySuggestion.data).toMatchObject({
      schema_version: 'ai-comic-series-visual-suggestion-draft/v1',
      target_type: 'visual_identity',
      target_id: identity.identity_id,
      suggestion_source: 'deterministic_template',
      suggestion_version: 'visual-definition-suggestions/v1',
      persisted: false,
      auto_approved: false,
    });
    expect(identitySuggestion.data?.fields).not.toHaveProperty('body_type');
    expect(identitySuggestion.data?.fields).not.toHaveProperty('age_range');
    expect(identitySuggestion.data?.fields).not.toHaveProperty('gender_pronouns');
    expect(identitySuggestion.data?.unresolved_field_ids).toEqual(expect.arrayContaining([
      'age_range',
      'gender_pronouns',
    ]));
    expect(identitySuggestion.data?.definition_notes).toContain('尚未人工批准');

    const rule = draftSaved.data!.visual_bible!.world_rules[0]!;
    const ruleSuggestion = await generateAiComicSeriesVisualWorldRuleSuggestionDraft(
      seriesProjectId,
      rule.rule_id,
    );
    expect(ruleSuggestion.ok).toBe(true);
    expect(ruleSuggestion.data).toMatchObject({
      schema_version: 'ai-comic-series-visual-suggestion-draft/v1',
      target_type: 'visual_world_rule',
      target_id: rule.rule_id,
      suggestion_source: 'deterministic_template',
      suggestion_version: 'visual-definition-suggestions/v1',
      persisted: false,
      auto_approved: false,
      unresolved_field_ids: [],
    });
    expect(ruleSuggestion.data?.fields).toHaveProperty('visual_symbol');
    expect(ruleSuggestion.data?.fields).toHaveProperty('trigger_condition');
    expect(ruleSuggestion.data?.definition_notes).toContain('不会创建或替换真实镜头绑定');

    const afterBytes = await readFile(projectPath, 'utf8');
    const afterRead = await getAiComicSeriesProject(seriesProjectId);
    expect(afterBytes).toBe(beforeBytes);
    expect(afterRead.data?.project.updated_at).toBe(beforeUpdatedAt);
    expect(afterRead.data?.visual_bible?.approved_identity_count).toBe(0);
    expect(afterRead.data?.visual_bible?.approved_world_rule_count).toBe(0);
    expect(afterRead.data?.visual_bible?.production_credit_identity_count).toBe(0);
  });

  it('flags duplicated generated AI comic story ids for episode regeneration', async () => {
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
        1: '20260611-story-same',
        2: '20260611-story-same',
      },
    });
    expect(saveRes.ok).toBe(true);

    const getRes = await getAiComicSeriesProject(saveRes.data!.project.series_project_id);
    expect(getRes.ok).toBe(true);
    expect(getRes.data?.series_quality_audit?.issues).toContain(
      '有 1 集与其他分集共用故事 ID，需要重新生成',
    );
    expect(getRes.data?.series_quality_audit?.episode_reports.find(report => report.episode_no === 2))
      .toMatchObject({
        status: 'needs_attention',
        needs_episode_regeneration: true,
      });

    const repairedSaveRes = await saveAiComicSeriesProject({
      series_project_id: saveRes.data!.project.series_project_id,
      plan: planRes.data!,
      generated_episode_story_ids: {
        1: '20260611-story-one',
        2: '20260611-story-two',
      },
    });
    expect(repairedSaveRes.ok).toBe(true);
    expect(repairedSaveRes.data?.series_quality_audit?.issues.join('\n'))
      .not.toContain('共用故事 ID');
    expect(repairedSaveRes.data?.series_quality_audit?.episode_reports.find(report => report.episode_no === 2)?.issues.join('\n'))
      .not.toContain('共用同一个故事 ID');
  });

  it('normalizes legacy AI comic series episode titles when projects are saved and loaded', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志',
      episode_count: 10,
      episode_duration_range_sec: { min: 60, max: 120 },
      narrative_pattern_ids: ['mortal_growth'],
    });
    expect(planRes.ok).toBe(true);

    const legacyTitles = [
      '第1集：问题出现',
      '第2集：拒签的新变化',
      '第3集：主角被迫做出第一次选择',
      '第4集：拒签的新变化',
      '第5集：拒签的新变化',
      '第6集：主角发现表面目标背后还有更深层原因',
      '第7集：拒签的新变化',
      '第8集：长期线索汇合，主角失去原有依靠',
      '第9集：拒签的新变化',
      '第10集：最终选择',
    ];
    const legacyPlan = {
      ...planRes.data!,
      episodes: planRes.data!.episodes.map((episode, index) => ({
        ...episode,
        title: legacyTitles[index] ?? episode.title,
      })),
    };

    const saveRes = await saveAiComicSeriesProject({ plan: legacyPlan });
    expect(saveRes.ok).toBe(true);
    const savedTitles = saveRes.data!.plan.episodes.map(episode => episode.title);
    expect(savedTitles.join('\n')).toContain('第1集：未签的案卷');
    expect(savedTitles.join('\n')).not.toMatch(/问题出现|最终选择|新变化|主角/);

    const projectPath = resolve(
      outlineGeneratedRoot(),
      'ai-comic-series-projects',
      saveRes.data!.project.series_project_id,
      'project.json',
    );
    const diskDetail = JSON.parse(await readFile(projectPath, 'utf-8'));
    await writeFile(projectPath, JSON.stringify({
      ...diskDetail,
      plan: legacyPlan,
      series_quality_audit: undefined,
    }, null, 2), 'utf-8');

    const getRes = await getAiComicSeriesProject(saveRes.data!.project.series_project_id);
    expect(getRes.ok).toBe(true);
    const loadedTitles = getRes.data!.plan.episodes.map(episode => episode.title);
    expect(loadedTitles).toEqual(savedTitles);
    expect(loadedTitles.join('\n')).not.toMatch(/问题出现|最终选择|新变化|主角/);
    expect(getRes.data?.series_quality_audit?.episode_reports).toHaveLength(10);
  });

  it('submits AI comic series GEARS jobs and normalizes callbacks into the production ledgers', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志',
      episode_count: 3,
      episode_duration_range_sec: { min: 60, max: 120 },
    });
    expect(planRes.ok).toBe(true);
    expect(planRes.data?.core_theme).toBe('拒签冤案中的良知选择');
    expect(planRes.data?.episodes[0].ending_hook).toContain('上官');
    expect(planRes.data?.episodes[1]).toMatchObject({
      title: '第2集：召见之前',
      main_conflict: expect.stringContaining('拒签后的上官压力'),
    });

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

    const externalVisualBlockedRes = await submitAiComicSeriesGearsJobs(seriesProjectId, {
      source_unit_id: sourceItem.production_id,
      use_gears_api: true,
      external_call_authorization: {
        authorized: true,
        authorization_reference: 'test-authorization:visual-gate',
        max_cost_amount: 1,
        cost_currency: 'CNY',
        data_transfer_acknowledged: true,
      },
      note: '必须先通过视觉资产生产门禁',
    });
    expect(externalVisualBlockedRes.ok).toBe(false);
    expect(externalVisualBlockedRes.error?.message).toContain('视觉资产生产门禁');

    const submitRes = await submitAiComicSeriesGearsJobs(seriesProjectId, {
      source_unit_id: sourceItem.production_id,
      note: 'series readiness test submit',
    });
    expect(submitRes.ok).toBe(true);

    const readiness = await getAiComicSeriesProductionReadiness(seriesProjectId);
    const gearsLane = readiness.data?.lanes.find(lane => lane.key === 'gears_execution');
    const visualAssetLane = readiness.data?.lanes.find(lane => lane.key === 'visual_asset_readiness');

    expect(readiness.ok).toBe(true);
    expect(readiness.data?.schema_version).toBe('ai-comic-series-production-readiness/v1');
    expect(readiness.data?.scope).toBe('ai_comic_series');
    expect(readiness.data?.summary.generated_episode_count).toBe(1);
    expect(readiness.data?.summary.total_episode_count).toBe(2);
    expect(readiness.data?.summary.gears_job_count).toBe(1);
    expect(readiness.data?.summary.active_gears_job_count).toBe(1);
    expect(readiness.data?.seedance_cost_governance).toEqual({
      status: 'not_applicable',
      authorized_shot_count: 0,
      reported_cost_count: 0,
      pending_terminal_cost_report_count: 0,
      boundary_violation_count: 0,
      exceeded_authorization_count: 0,
      currency_mismatch_count: 0,
      authorization_missing_count: 0,
    });
    expect(readiness.data?.issues.map(issue => issue.issue_id)).toContain('episodes-not-complete');
    expect(readiness.data?.issues.map(issue => issue.issue_id)).toContain('series-visual-production-gate');
    expect(visualAssetLane).toMatchObject({
      status: 'blocked',
      action_key: 'complete_visual_asset_chain',
    });
    const visualAssetStep = readiness.data?.automation_plan.steps.find(step => (
      step.action_key === 'complete_visual_asset_chain'
    ));
    expect(visualAssetStep).toMatchObject({
      runner: 'operator_review',
      mode: 'manual',
      status: 'manual',
      can_auto_execute: false,
    });
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
    expect(readiness.data?.markdown).toContain('Seedance Cost Governance');
    expect(readiness.data?.markdown).toContain('Automation Plan');
  });

  it('regenerates the earliest template-like persisted AI comic episode before continuing the series', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志 regen',
      episode_count: 2,
      episode_duration_range_sec: { min: 60, max: 120 },
    });
    expect(planRes.ok).toBe(true);

    const saveRes = await saveAiComicSeriesProject({ plan: planRes.data! });
    expect(saveRes.ok).toBe(true);
    const seriesProjectId = saveRes.data!.project.series_project_id;

    const episodeOne = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 1,
      series_project_id: seriesProjectId,
      output_gears_segments: true,
      auto_repair_episode: true,
    });
    expect(episodeOne.ok).toBe(true);
    const originalEpisodeOneStoryId = episodeOne.data!.storyId;
    const storyPath = resolve(
      outlineGeneratedRoot(),
      'stories',
      'ai_comic_drama',
      `${originalEpisodeOneStoryId}.json`,
    );
    const storedStory = JSON.parse(await readFile(storyPath, 'utf-8'));
    const templateSceneTitles = ['雨夜第1集：问题出现', '角色入场', '对白交锋', '选择时刻', '精神定格'];
    const templateStory = {
      ...storedStory,
      title: '第1集：问题出现',
      full_text: [
        '雨夜，永州→道县（籍贯/出生地）；衡阳（少年成长地）。周敦颐**少年与家庭**：周敦颐出身道州营道（今永州道县）楼田村书香门第。',
        '永州→道县（籍贯/出生地）；衡阳（少年成长地），人物登场。周敦颐面对第1集：问题出现的选择——这是他人生的关键时刻。',
      ].join('\n\n'),
      quality_report: {
        ...(storedStory.quality_report ?? {}),
        passed: false,
        genre_score: 40,
        issues: ['模板坏稿'],
      },
      scene_breakdown: storedStory.scene_breakdown.map((scene: any, index: number) => ({
        ...scene,
        title: templateSceneTitles[index] ?? scene.title,
        plot: '永州→道县（籍贯/出生地）；衡阳（少年成长地），人物登场。周敦颐**少年与家庭**：周敦颐出身道州营道（今永州道县）楼田村书香门第。',
        dialogue_or_narration: '周敦颐面对第1集：问题出现的选择——这是他人生的关键时刻。',
        visual_prompt: '衡阳后来建有濂溪书院（始建于宋淳熙年间，生成优先级：剧情推进与资料完整保持均衡。',
      })),
    };
    await writeFile(storyPath, JSON.stringify(templateStory, null, 2), 'utf-8');
    const versionPath = resolve(
      outlineGeneratedRoot(),
      'projects',
      storedStory.project_id,
      'versions',
      `${storedStory.current_version_id}.json`,
    );
    const versionSnapshot = JSON.parse(await readFile(versionPath, 'utf-8'));
    await writeFile(versionPath, JSON.stringify({
      ...versionSnapshot,
      quality_report: templateStory.quality_report,
      story: {
        ...(versionSnapshot.story ?? {}),
        ...templateStory,
      },
    }, null, 2), 'utf-8');

    const listRes = await listAiComicSeriesProjects();
    const listedProject = listRes.data?.find(project => project.series_project_id === seriesProjectId);
    expect(listedProject).toMatchObject({
      next_regeneration_episode_no: 1,
      regeneration_episode_count: 1,
      generated_episode_content_issue_count: 1,
    });

    const readiness = await getAiComicSeriesProductionReadiness(seriesProjectId);
    expect(readiness.ok).toBe(true);
    expect(readiness.data?.issues.map(issue => issue.issue_id)).toContain('episodes-need-regeneration');
    expect(readiness.data?.issues.find(issue => issue.issue_id === 'episodes-need-regeneration')?.detail)
      .toContain('故事质量报告未通过');
    const generateStep = readiness.data?.automation_plan.steps.find(step => step.action_key === 'generate_next_episode');
    expect(generateStep?.label).toBe('重生成最早问题分集');

    const automationRun = await runAiComicSeriesProductionReadinessAutomation(seriesProjectId, {
      dry_run: false,
      action_keys: ['generate_next_episode'],
    });
    expect(automationRun.ok).toBe(true);
    expect(automationRun.data?.executed_step_count).toBe(1);

    const refreshed = await getAiComicSeriesProject(seriesProjectId);
    expect(refreshed.ok).toBe(true);
    expect(refreshed.data?.generated_episode_story_ids['1']).toBeTruthy();
    expect(refreshed.data?.generated_episode_story_ids['1']).not.toBe(originalEpisodeOneStoryId);
    expect(refreshed.data?.generated_episode_story_ids['2']).toBeUndefined();
    expect(automationRun.data?.after_readiness.summary.generated_episode_count).toBe(1);
  });

  it('regenerates AI comic episodes when the stored story title belongs to another episode', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志 title mismatch',
      episode_count: 2,
      episode_duration_range_sec: { min: 60, max: 120 },
    });
    expect(planRes.ok).toBe(true);

    const saveRes = await saveAiComicSeriesProject({ plan: planRes.data! });
    expect(saveRes.ok).toBe(true);
    const seriesProjectId = saveRes.data!.project.series_project_id;

    const episodeOne = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 1,
      series_project_id: seriesProjectId,
      output_gears_segments: true,
      auto_repair_episode: true,
    });
    expect(episodeOne.ok).toBe(true);
    const storyPath = resolve(
      outlineGeneratedRoot(),
      'stories',
      'ai_comic_drama',
      `${episodeOne.data!.storyId}.json`,
    );
    const storedStory = JSON.parse(await readFile(storyPath, 'utf-8'));
    const mismatchedStory = {
      ...storedStory,
      title: planRes.data!.episodes[1].title,
      quality_report: {
        ...(storedStory.quality_report ?? {}),
        passed: true,
        genre_score: 88,
        issues: [],
      },
    };
    await writeFile(storyPath, JSON.stringify(mismatchedStory, null, 2), 'utf-8');
    const versionPath = resolve(
      outlineGeneratedRoot(),
      'projects',
      storedStory.project_id,
      'versions',
      `${storedStory.current_version_id}.json`,
    );
    const versionSnapshot = JSON.parse(await readFile(versionPath, 'utf-8'));
    await writeFile(versionPath, JSON.stringify({
      ...versionSnapshot,
      quality_report: mismatchedStory.quality_report,
      story: {
        ...(versionSnapshot.story ?? {}),
        ...mismatchedStory,
      },
    }, null, 2), 'utf-8');

    const readiness = await getAiComicSeriesProductionReadiness(seriesProjectId);
    expect(readiness.ok).toBe(true);
    const regenerationIssue = readiness.data?.issues.find(issue => issue.issue_id === 'episodes-need-regeneration');
    expect(regenerationIssue?.detail).toContain('故事标题未同步当前分集计划');
  });

  it('executes AI comic series Seedance prompt export from production readiness automation', async () => {
    const planRes = await generateAiComicSeriesPlan({
      outline: '周敦颐少年在濂溪读书，面对南安军拒签冤案，坚持良知。',
      series_title: '濂溪少年志 seedance automation',
      episode_count: 1,
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
      auto_repair_episode: true,
    });
    expect(episodeRes.ok).toBe(true);

    const automationRun = await runAiComicSeriesProductionReadinessAutomation(seriesProjectId, {
      dry_run: false,
      action_keys: ['export_seedance_prompts'],
    });
    expect(automationRun.ok).toBe(true);
    expect(automationRun.data?.executed_step_count).toBe(1);
    expect(automationRun.data?.failed_step_count).toBe(0);
    expect(automationRun.data?.steps[0]).toMatchObject({
      action_key: 'export_seedance_prompts',
      status: 'executed',
    });

    const dashboard = await getAiComicSeriesSeedanceProductionDashboard(seriesProjectId);
    expect(dashboard.ok).toBe(true);
    expect(dashboard.data?.summary.total_shot_count).toBeGreaterThan(0);

    const submittedRun = await runAiComicSeriesProductionReadinessAutomation(seriesProjectId, {
      dry_run: false,
      action_keys: ['mark_submitted'],
    });
    expect(submittedRun.ok).toBe(true);
    expect(submittedRun.data?.executed_step_count).toBe(1);
    expect(submittedRun.data?.failed_step_count).toBe(0);
    expect(submittedRun.data?.steps[0]).toMatchObject({
      action_key: 'mark_submitted',
      status: 'executed',
    });
    const submittedDashboard = await getAiComicSeriesSeedanceProductionDashboard(seriesProjectId);
    expect(submittedDashboard.ok).toBe(true);
    expect(submittedDashboard.data?.summary.submitted_count).toBeGreaterThan(0);
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

  it('blocks external GEARS retry submission until visual assets have current identity bindings', async () => {
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

    const retryPlanRes = await exportAiComicSeriesSeedanceRetryExecutionPlan(seriesProjectId);
    expect(retryPlanRes.ok).toBe(true);
    const retryCandidate = retryPlanRes.data?.episodes
      .flatMap(episode => episode.candidates)
      .find(candidate => candidate.production_id === sourceItem.production_id);
    expect(retryCandidate).toBeTruthy();
    const requiredSlots = retryCandidate?.prompt.asset_slots.filter(slot => slot.required) ?? [];
    expect(requiredSlots.length).toBeGreaterThan(0);
    for (const [index, slot] of requiredSlots.entries()) {
      const kind = slot.kind === 'character' || slot.kind === 'location' ? slot.kind : 'unknown';
      const upload = await uploadAiComicSeriesSeedanceAssetFile(seriesProjectId, {
        asset_id: slot.asset_id,
        label: slot.label,
        kind,
        reference_slot: slot.reference_slot,
        file: {
          original_filename: `series-gears-provider-input-${index + 1}.png`,
          mime_type: 'image/png',
          buffer: ONE_PIXEL_PNG,
        },
      });
      expect(upload.ok).toBe(true);
      const review = await updateAiComicSeriesMediaAssetReview(seriesProjectId, {
        asset_id: slot.asset_id,
        expected_content_sha256: upload.data!.content_sha256,
        rights_status: 'authorized',
        authorization_reference: `contract://series-gears-provider-assets/${index + 1}`,
        human_review_status: 'approved',
        review_note: '已核对不可变原图，可交付外部视频生成服务。',
      }, {
        actor_id: 'series-gears-provider-reviewer-001',
        authentication_method: 'signed_session',
      });
      expect(review.ok).toBe(true);
      const bindPublicUrl = await updateAiComicSeriesSeedanceAssetLibrary(seriesProjectId, {
        items: [{
          asset_id: slot.asset_id,
          kind,
          label: slot.label,
          reference_slot: slot.reference_slot,
          file_url: `https://assets.culture-production.cn/series/${index + 1}.png?signature=test-only`,
        }],
      });
      expect(bindPublicUrl.ok).toBe(true);
    }

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (String(_url).endsWith('/gears/capabilities')) {
        expect(init?.method).toBe('GET');
        expect((init?.headers as Record<string, string>).authorization).toBe('Bearer series-gears-token');
        return gearsExecutionWorkerCapabilityResponse();
      }
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
            provider_asset_inputs?: Array<{
              asset_id?: string;
              content_sha256?: string;
              transport?: { kind?: string; url?: string };
            }>;
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
      expect(unit?.provider_asset_inputs).toHaveLength(requiredSlots.length);
      expect(unit?.provider_asset_inputs?.[0]).toMatchObject({
        asset_id: requiredSlots[0]!.asset_id,
        content_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        transport: {
          kind: 'https_url',
          url: expect.stringContaining('signature=test-only'),
        },
      });
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
      external_call_authorization: {
        authorized: true,
        authorization_reference: 'test-approval://series-gears-retry-001',
        max_cost_amount: 15,
        cost_currency: 'CNY',
        data_transfer_acknowledged: true,
      },
      payload: {
        retry_batch_id: 'batch-001',
      },
      note: '系列 GEARS retry payload smoke',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(submitRes.ok).toBe(false);
    expect(submitRes.error?.message).toContain('视觉资产生产门禁');
    expect(submitRes.error?.message).toContain('当前映射');
  });

  it('submits external GEARS only after a fixture has a complete approved visual asset chain', async () => {
    process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
    process.env.GEARS_API_TOKEN = 'series-gears-token';

    const planRes = await generateAiComicSeriesPlan({
      outline: '少年守灯人阿舟带着祖传皮影灯和铜钥匙，在古戏台后台守住最后一盏灯，阻止影偶吞没老街记忆。',
      series_title: '守灯人视觉链放行 fixture',
      episode_count: 1,
      episode_duration_range_sec: { min: 60, max: 120 },
    });
    expect(planRes.ok).toBe(true);
    const plan = {
      ...planRes.data!,
      premise_contract: {
        ...planRes.data!.premise_contract!,
        world_rules: [],
      },
    };
    const saveRes = await saveAiComicSeriesProject({ plan });
    expect(saveRes.ok).toBe(true);
    const seriesProjectId = saveRes.data!.project.series_project_id;

    const episodeRes = await generateAiComicEpisodeFromPlan({
      series_plan: plan,
      episode_no: 1,
      series_project_id: seriesProjectId,
      output_gears_segments: true,
    });
    expect(episodeRes.ok).toBe(true);
    const refreshed = await saveAiComicSeriesProject({
      series_project_id: seriesProjectId,
      plan,
      generated_episode_story_ids: { 1: episodeRes.data!.storyId },
    });
    expect(refreshed.ok).toBe(true);

    const retryPlanRes = await exportAiComicSeriesSeedanceRetryExecutionPlan(seriesProjectId);
    expect(retryPlanRes.ok).toBe(true);
    const retryCandidate = retryPlanRes.data?.episodes[0]?.candidates.find(candidate => candidate.can_submit);
    expect(retryCandidate).toBeTruthy();
    const requiredSlots = retryCandidate!.prompt.asset_slots.filter(slot => slot.required);

    const requiredSlotCharacterNames = [...new Set(requiredSlots
      .filter(slot => slot.kind === 'character')
      .map(slot => slot.label))];
    const existingCharacterNames = new Set(plan.main_characters.map(character => character.name));
    const expandedPlan = {
      ...plan,
      main_characters: [
        ...plan.main_characters,
        ...requiredSlotCharacterNames
          .filter(name => !existingCharacterNames.has(name))
          .map(name => ({
            name,
            role: 'fixture 锁定出场人物',
            starting_state: '等待视觉定义与审核',
            desire: '完成隔离测试中的镜头出场',
            long_arc: '仅用于验证稳定身份资产链',
            turning_points: [{ episode_no: 1, change: '已纳入 fixture 视觉身份清单' }],
            visual_signature: 'fixture 审核中的稳定视觉外观',
          })),
      ],
      premise_contract: {
        ...plan.premise_contract!,
        locked_characters: [
          ...plan.premise_contract!.locked_characters,
          ...requiredSlotCharacterNames
            .filter(name => !plan.premise_contract!.locked_characters.some(character => character.name === name))
            .map(name => ({
              name,
              role: 'fixture 锁定出场人物',
              required: true,
              evidence_span: 'fixture 的实际 Seedance 必需素材槽位',
            })),
        ],
      },
    };
    const expandedSave = await saveAiComicSeriesProject({
      series_project_id: seriesProjectId,
      plan: expandedPlan,
      generated_episode_story_ids: { 1: episodeRes.data!.storyId },
    });
    expect(expandedSave.ok).toBe(true);

    let project = await getAiComicSeriesProject(seriesProjectId);
    expect(project.ok).toBe(true);
    expect(project.data?.visual_bible?.pilot_episode_bindings[0]?.missing_identity_kinds).toEqual([]);
    expect(project.data?.visual_bible?.identities.length).toBeGreaterThan(0);

    for (const identity of project.data!.visual_bible!.identities) {
      const approvedDefinition = await updateAiComicSeriesVisualIdentityDefinition(
        seriesProjectId,
        identity.identity_id,
        {
          expected_source_fingerprint: identity.source_fingerprint,
          fields: Object.fromEntries(identity.definition_fields.map(field => [
            field.field_id,
            `${identity.label}${field.label}由 fixture 审核确认`,
          ])),
          definition_notes: '隔离测试 fixture 的完整视觉定义，不对应任何正式项目资料。',
          action: 'approve',
          reviewer_id: 'fixture-visual-reviewer',
          human_confirmed: true,
          review_note: 'fixture 人工复核：定义字段完整。',
        },
      );
      expect(approvedDefinition.ok).toBe(true);
    }

    project = await getAiComicSeriesProject(seriesProjectId);
    for (const identity of project.data!.visual_bible!.identities) {
      const matchingSlot = requiredSlots.find(slot => (
        slot.kind === identity.kind && slot.label === identity.label
      ));
      const assetId = matchingSlot?.asset_id ?? `fixture-${identity.identity_id}`;
      const upload = await uploadAiComicSeriesSeedanceAssetFile(seriesProjectId, {
        asset_id: assetId,
        kind: identity.kind,
        label: identity.label,
        reference_slot: matchingSlot?.reference_slot,
        series_identity_id: identity.identity_id,
        file: {
          original_filename: `${identity.identity_id}.png`,
          mime_type: 'image/png',
          buffer: ONE_PIXEL_PNG,
        },
      });
      expect(upload.ok).toBe(true);
      const review = await updateAiComicSeriesMediaAssetReview(seriesProjectId, {
        asset_id: assetId,
        expected_content_sha256: upload.data!.content_sha256,
        rights_status: 'authorized',
        authorization_reference: `fixture://visual-rights/${identity.identity_id}`,
        human_review_status: 'approved',
        review_note: 'fixture 人工媒体审核：原始文件、权利依据和身份映射一致。',
      }, {
        actor_id: 'fixture-media-reviewer',
        authentication_method: 'signed_session',
      });
      expect(review.ok).toBe(true);
      const publicUrl = await updateAiComicSeriesSeedanceAssetLibrary(seriesProjectId, {
        items: [{
          asset_id: assetId,
          kind: identity.kind,
          label: identity.label,
          reference_slot: matchingSlot?.reference_slot,
          file_url: `https://assets.fixture.example/visual/${encodeURIComponent(identity.identity_id)}.png`,
          series_identity_id: identity.identity_id,
        }],
      });
      expect(publicUrl.ok).toBe(true);
    }

    project = await getAiComicSeriesProject(seriesProjectId);
    expect(project.data?.visual_bible).toMatchObject({
      blocker_count: 0,
      ready_identity_count: project.data?.visual_bible?.identities.length,
      approved_identity_count: project.data?.visual_bible?.identities.length,
      production_credit_identity_count: project.data?.visual_bible?.identities.length,
    });

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).endsWith('/gears/capabilities')) return gearsExecutionWorkerCapabilityResponse();
      expect(String(input)).toBe('https://gears.example.test/api-root/gears/jobs');
      const body = JSON.parse(String(init?.body)) as { payload?: { units?: Array<{ provider_asset_inputs?: unknown[] }> } };
      expect(body.payload?.units).toHaveLength(1);
      expect(body.payload?.units?.[0]?.provider_asset_inputs).toHaveLength(requiredSlots.length);
      return new Response(JSON.stringify({
        jobs: [{
          source_unit_id: retryCandidate!.production_id,
          gears_job_id: 'fixture-visual-chain-gears-job-001',
          status: 'queued',
        }],
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const submit = await submitAiComicSeriesGearsJobs(seriesProjectId, {
      job_type: 'seedance_video',
      source_unit_id: retryCandidate!.production_id,
      use_gears_api: true,
      external_call_authorization: {
        authorized: true,
        authorization_reference: 'fixture://external-gears-authorization',
        max_cost_amount: 1,
        cost_currency: 'CNY',
        data_transfer_acknowledged: true,
      },
      note: '仅验证隔离 fixture 的视觉生产门禁放行。',
    });

    expect(submit.ok, JSON.stringify(submit.error)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(submit.data?.provider_adapter).toMatchObject({
      status: 'submitted',
      provider_asset_input_count: requiredSlots.length,
    });
    const submittedProductionItem = submit.data?.seedance_production?.items.find(item => (
      item.production_id === retryCandidate!.production_id
    ));
    expect(submittedProductionItem?.external_call_authorization).toMatchObject({
      authorization_reference: 'fixture://external-gears-authorization',
      max_cost_amount: 1,
      cost_currency: 'CNY',
      data_transfer_acknowledged: true,
      confirmed_at: expect.any(String),
    });
    expect(submittedProductionItem?.versions.at(-1)?.external_call_authorization)
      .toEqual(submittedProductionItem?.external_call_authorization);

    const failedForDirectRetry = await updateAiComicSeriesSeedanceProductionStatus(seriesProjectId, {
      episode_no: retryCandidate!.episode_no,
      shot_id: retryCandidate!.shot_id,
      status: 'failed',
      provider_job_id: 'fixture-visual-chain-gears-job-001',
      failure_reason: 'fixture 准备直接 Seedance adapter 重试',
      increment_retry: true,
    });
    expect(failedForDirectRetry.ok).toBe(true);
    expect(failedForDirectRetry.data?.seedance_production?.items.find(item => (
      item.production_id === retryCandidate!.production_id
    ))?.external_call_authorization?.authorization_reference)
      .toBe('fixture://external-gears-authorization');

    const previousSeedanceEndpoint = process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT;
    process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT = 'https://seedance.fixture.example/retry-submit';
    const directFetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe('https://seedance.fixture.example/retry-submit');
      const body = JSON.parse(String(init?.body)) as {
        external_call_authorization?: {
          authorization_reference?: string;
          max_cost_amount?: number;
          cost_currency?: string;
        };
        shots?: Array<{ production_id?: string; shot_id?: string }>;
      };
      expect(body.external_call_authorization).toMatchObject({
        authorization_reference: 'fixture://direct-seedance-authorization',
        max_cost_amount: 2,
        cost_currency: 'CNY',
      });
      return new Response(JSON.stringify({
        results: (body.shots ?? []).map((shot, index) => ({
          production_id: shot.production_id,
          shot_id: shot.shot_id,
          provider_job_id: `fixture-direct-seedance-job-${String(index + 1).padStart(3, '0')}`,
          status: 'processing',
        })),
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', directFetchMock);
    try {
      const directSubmit = await submitAiComicSeriesSeedanceRetryExecutionPlan(seriesProjectId, {
        limit: 2,
        use_provider_adapter: true,
        external_call_authorization: {
          authorized: true,
          authorization_reference: 'fixture://direct-seedance-authorization',
          max_cost_amount: 2,
          cost_currency: 'CNY',
          data_transfer_acknowledged: true,
        },
        note: '隔离 fixture 直接 Seedance adapter 授权审计测试。',
      });
      expect(directSubmit.ok, JSON.stringify(directSubmit.error)).toBe(true);
      expect(directFetchMock).toHaveBeenCalledTimes(1);
      expect(directSubmit.data?.submitted_count).toBe(2);
      expect(directSubmit.data?.external_call_authorization?.authorization_reference)
        .toBe('fixture://direct-seedance-authorization');
      const directProductionItem = directSubmit.data?.seedance_production?.items.find(item => (
        item.production_id === retryCandidate!.production_id
      ));
      expect(directProductionItem?.external_call_authorization?.authorization_reference)
        .toBe('fixture://direct-seedance-authorization');
      expect(directProductionItem?.versions.some(version => (
        version.external_call_authorization?.authorization_reference === 'fixture://external-gears-authorization'
      ))).toBe(true);
      expect(directProductionItem?.versions.at(-1)?.external_call_authorization?.authorization_reference)
        .toBe('fixture://direct-seedance-authorization');

      const secondSubmittedShot = directSubmit.data?.submitted_shots.find(shot => (
        shot.production_id !== retryCandidate!.production_id
      ));
      expect(secondSubmittedShot).toBeTruthy();

      const lateHistoricalCallback = await applyAiComicSeriesSeedanceProductionCallback(seriesProjectId, {
        provider_job_id: 'fixture-visual-chain-gears-job-001',
        status: 'ready',
        video_url: 'https://outputs.fixture.example/gears/late-shot-001.mp4',
        actual_cost_amount: 0.5,
        cost_currency: 'CNY',
        note: 'fixture 旧 GEARS job 迟到回调只允许更新历史版本',
      });
      expect(lateHistoricalCallback.ok).toBe(true);
      const itemAfterLateHistoricalCallback = lateHistoricalCallback.data?.seedance_production?.items.find(item => (
        item.production_id === retryCandidate!.production_id
      ));
      expect(itemAfterLateHistoricalCallback).toMatchObject({
        provider_job_id: 'fixture-direct-seedance-job-001',
        status: 'processing',
        external_call_authorization: {
          authorization_reference: 'fixture://direct-seedance-authorization',
        },
      });
      expect(itemAfterLateHistoricalCallback?.execution_cost).toBeUndefined();
      expect(itemAfterLateHistoricalCallback?.versions.filter(version => (
        version.provider_job_id === 'fixture-visual-chain-gears-job-001'
      )).at(-1)).toMatchObject({
        status: 'ready',
        execution_cost: {
          actual_cost_amount: 0.5,
          boundary_status: 'within_authorization',
          authorization_reference: 'fixture://external-gears-authorization',
        },
      });

      const callback = await applyAiComicSeriesSeedanceProductionCallback(seriesProjectId, {
        provider_job_id: 'fixture-direct-seedance-job-001',
        status: 'ready',
        video_url: 'https://outputs.fixture.example/seedance/shot-001.mp4',
        actual_cost_amount: 1.25,
        cost_currency: 'CNY',
        note: 'fixture 第一镜费用回执仍在总授权内',
      });
      expect(callback.ok).toBe(true);
      const callbackItem = callback.data?.seedance_production?.items.find(item => (
        item.production_id === retryCandidate!.production_id
      ));
      expect(callbackItem?.external_call_authorization?.authorization_reference)
        .toBe('fixture://direct-seedance-authorization');
      expect(callbackItem?.versions.at(-1)?.external_call_authorization?.authorization_reference)
        .toBe('fixture://direct-seedance-authorization');
      expect(callbackItem?.execution_cost).toMatchObject({
        actual_cost_amount: 1.25,
        boundary_status: 'within_authorization',
        authorization_total_actual_cost_amount: 1.25,
      });

      const secondReadyCallback = await applyAiComicSeriesSeedanceProductionCallback(seriesProjectId, {
        provider_job_id: secondSubmittedShot!.provider_job_id,
        status: 'ready',
        video_url: 'https://outputs.fixture.example/seedance/shot-002.mp4',
        note: 'fixture 第二镜进入终态但尚未结算费用',
      });
      expect(secondReadyCallback.ok).toBe(true);
      const secondReadyItem = secondReadyCallback.data?.seedance_production?.items.find(item => (
        item.production_id === secondSubmittedShot!.production_id
      ));

      const pendingSettlementReadiness = await getAiComicSeriesProductionReadiness(seriesProjectId);
      expect(pendingSettlementReadiness.ok).toBe(true);
      expect(pendingSettlementReadiness.data?.issues.map(issue => issue.issue_id))
        .toContain('series-seedance-execution-cost-settlement-pending');
      const pendingSettlementDelivery = await assembleAiComicSeriesSeedanceFinalDelivery(seriesProjectId, {
        dry_run: false,
        missing_dependency_mode: 'tolerant',
      });
      expect(pendingSettlementDelivery.ok).toBe(false);
      expect(pendingSettlementDelivery.error?.message).toContain('pending actual cost settlement');

      const versionCountBeforeSettlement = secondReadyItem?.versions.length;
      expect(versionCountBeforeSettlement).toBeGreaterThan(0);
      const settlementCallback = await applyAiComicSeriesSeedanceProductionCallback(seriesProjectId, {
        provider_job_id: secondSubmittedShot!.provider_job_id,
        status: 'ready',
        video_url: 'https://outputs.fixture.example/seedance/shot-002.mp4',
        actual_cost_amount: 1,
        cost_currency: 'CNY',
        note: 'fixture 第二镜延迟费用使同一授权累计超过 2 CNY 上限',
      });
      expect(settlementCallback.ok).toBe(true);
      const settledItem = settlementCallback.data?.seedance_production?.items.find(item => (
        item.production_id === secondSubmittedShot!.production_id
      ));
      expect(settledItem?.versions.length).toBe(versionCountBeforeSettlement);
      expect(settledItem?.execution_cost).toMatchObject({
        actual_cost_amount: 1,
        cost_currency: 'CNY',
        boundary_status: 'exceeded_authorization',
        authorization_reference: 'fixture://direct-seedance-authorization',
        authorized_max_cost_amount: 2,
        authorization_total_actual_cost_amount: 2.25,
      });
      expect(settledItem?.versions.at(-1)?.execution_cost).toEqual(settledItem?.execution_cost);
      expect(settlementCallback.data?.seedance_production?.items.find(item => (
        item.production_id === retryCandidate!.production_id
      ))?.execution_cost).toMatchObject({
        actual_cost_amount: 1.25,
        boundary_status: 'exceeded_authorization',
        authorization_total_actual_cost_amount: 2.25,
      });

      const violatedReadiness = await getAiComicSeriesProductionReadiness(seriesProjectId);
      expect(violatedReadiness.ok).toBe(true);
      expect(violatedReadiness.data?.seedance_cost_governance).toMatchObject({
        status: 'blocked',
        authorized_shot_count: 2,
        reported_cost_count: 3,
        pending_terminal_cost_report_count: 0,
        boundary_violation_count: 2,
        exceeded_authorization_count: 2,
      });
      expect(violatedReadiness.data?.issues.map(issue => issue.issue_id))
        .toContain('series-seedance-execution-cost-boundary-violated');
      expect(violatedReadiness.data?.issues.map(issue => issue.issue_id))
        .not.toContain('series-seedance-execution-cost-settlement-pending');
      expect(violatedReadiness.data?.lanes.find(lane => lane.key === 'delivery_contract'))
        .toMatchObject({
          status: 'blocked',
          action_label: '处理 Seedance 费用阻断',
        });
      expect(violatedReadiness.data?.lanes.find(lane => lane.key === 'commercial_ops'))
        .toMatchObject({
          status: 'blocked',
          action_label: '处理 Seedance 费用阻断',
        });
      const costAuditCut = await assembleAiComicSeriesSeedanceCut(seriesProjectId, { dry_run: true });
      expect(costAuditCut.ok).toBe(true);
      const costAuditManifest = await assembleAiComicSeriesSeedanceFinalDelivery(seriesProjectId, {
        dry_run: true,
        include_subtitles: false,
        include_audio_mix: false,
        include_title_cards: false,
        missing_dependency_mode: 'strict',
      });
      expect(costAuditManifest.ok).toBe(true);
      expect(costAuditManifest.data?.manifest.cost_governance).toMatchObject({
        status: 'blocked',
        authorized_shot_count: 2,
        reported_cost_count: 3,
        pending_terminal_cost_report_count: 0,
        boundary_violation_count: 2,
      });
      expect(costAuditManifest.data?.manifest.validation_notes)
        .toContain('Seedance 费用治理：阻断（待结算 0，越界 2）');
      const violatedDelivery = await assembleAiComicSeriesSeedanceFinalDelivery(seriesProjectId, {
        dry_run: false,
        missing_dependency_mode: 'tolerant',
      });
      expect(violatedDelivery.ok).toBe(false);
      expect(violatedDelivery.error?.message).toContain('actual cost records violate');
    } finally {
      if (previousSeedanceEndpoint === undefined) {
        delete process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT;
      } else {
        process.env.SEEDANCE_PROVIDER_SUBMIT_ENDPOINT = previousSeedanceEndpoint;
      }
    }
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
      if (url.endsWith('/gears/capabilities')) return gearsExecutionWorkerCapabilityResponse();
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

    expect(fetchMock).toHaveBeenCalledTimes(3);
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
    expect(fetchMock).toHaveBeenCalledTimes(6);
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
      if (String(_url).endsWith('/gears/capabilities')) return gearsExecutionWorkerCapabilityResponse();
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

    expect(fetchMock).toHaveBeenCalledTimes(2);
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
      if (String(_url).endsWith('/gears/capabilities')) return gearsExecutionWorkerCapabilityResponse();
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

    const propRes = await submitAiComicSeriesGearsJobs(seriesProjectId, {
      job_type: 'prop_image',
      note: '提交 GEARS 道具图任务',
    });
    expect(propRes.ok).toBe(true);
    expect(propRes.data?.submitted_count).toBeGreaterThan(0);
    expect(propRes.data?.submitted_jobs.every(job => (
      job.job_type === 'prop_image'
      && job.source_unit_id.startsWith('episode:1:prop:')
      && Boolean(job.payload_summary?.length)
    ))).toBe(true);

    const ledgerItems = propRes.data?.gears_job_ledger?.items ?? [];
    expect(ledgerItems.some(item => item.job_type === 'storyboard_image')).toBe(true);
    expect(ledgerItems.some(item => item.job_type === 'character_image')).toBe(true);
    expect(ledgerItems.some(item => item.job_type === 'scene_image')).toBe(true);
    expect(ledgerItems.some(item => item.job_type === 'prop_image')).toBe(true);

    const characterJob = characterRes.data!.submitted_jobs[0];
    const imageCallback = {
      gears_job_id: characterJob.gears_job_id,
      source_unit_id: characterJob.source_unit_id,
      job_type: 'character_image' as const,
      status: 'ready',
      event_id: 'series-character-image-ready-001',
      artifacts: [{
        artifact_id: 'series-character-image-v1',
        kind: 'image',
        role: 'character_reference',
        mime_type: 'image/png',
        source_unit_id: characterJob.source_unit_id,
        url: 'https://media.vendor-cdn.net/series/character-v1.png',
        metadata: { model: 'vendor-series-image-v2' },
      }],
    };
    const callbackRes = await importAiComicSeriesGearsCallback(seriesProjectId, imageCallback);
    expect(callbackRes.ok).toBe(true);
    expect(callbackRes.data?.updated_count).toBe(1);

    const beforeImageAssetReport = await exportAiComicSeriesSeedanceAssetReportPackage(seriesProjectId);
    const locationTarget = beforeImageAssetReport.data?.assets.find(item => item.kind === 'location');
    expect(locationTarget).toBeTruthy();
    const sceneJob = sceneRes.data!.submitted_jobs.find(job => (
      locationTarget && job.source_unit_id.endsWith(`:scene:${locationTarget.label}`)
    ));
    expect(sceneJob, JSON.stringify({
      location: locationTarget?.label,
      source_unit_ids: sceneRes.data!.submitted_jobs.map(job => job.source_unit_id),
    })).toBeTruthy();
    const sceneCallback = await importAiComicSeriesGearsCallback(seriesProjectId, {
      gears_job_id: sceneJob!.gears_job_id,
      source_unit_id: sceneJob!.source_unit_id,
      job_type: 'scene_image',
      status: 'ready',
      event_id: 'series-scene-image-ready-001',
      artifacts: [{
        artifact_id: 'series-scene-image-v1',
        kind: 'image',
        role: 'location_reference',
        mime_type: 'image/webp',
        source_unit_id: sceneJob!.source_unit_id,
        url: 'https://media.vendor-cdn.net/series/scene-v1.webp',
      }],
    });
    expect(sceneCallback.data?.updated_count).toBe(1);

    const storyboardJob = storyboardRes.data!.submitted_jobs[0];
    const storyboardCallback = await importAiComicSeriesGearsCallback(seriesProjectId, {
      gears_job_id: storyboardJob.gears_job_id,
      source_unit_id: storyboardJob.source_unit_id,
      job_type: 'storyboard_image',
      status: 'ready',
      event_id: 'series-storyboard-image-ready-001',
      artifacts: [{
        artifact_id: 'series-storyboard-image-v1',
        kind: 'image',
        role: 'storyboard',
        mime_type: 'image/jpeg',
        source_unit_id: storyboardJob.source_unit_id,
        url: 'https://media.vendor-cdn.net/series/storyboard-v1.jpg',
      }],
    });
    expect(storyboardCallback.data?.updated_count).toBe(1);

    const afterCallback = await getAiComicSeriesProject(seriesProjectId);
    const archivedAsset = afterCallback.data?.seedance_asset_library?.items.find(item => (
      item.provider_asset_id === 'series-character-image-v1'
    ));
    expect(archivedAsset).toMatchObject({
      kind: 'character',
      file_url: 'https://media.vendor-cdn.net/series/character-v1.png',
      provider: 'gears',
      provider_asset_id: 'series-character-image-v1',
      mime_type: 'image/png',
      model: 'vendor-series-image-v2',
      rights_status: 'pending',
      human_review_status: 'pending',
    });
    expect(archivedAsset?.content_sha256).toBeUndefined();
    expect(archivedAsset?.history?.at(-1)?.event_type).toBe('provider_callback');
    expect(afterCallback.data?.seedance_asset_library?.items.find(item => (
      item.provider_asset_id === 'series-scene-image-v1'
    ))).toMatchObject({
      kind: 'location',
      file_url: 'https://media.vendor-cdn.net/series/scene-v1.webp',
      rights_status: 'pending',
      human_review_status: 'pending',
    });
    expect(afterCallback.data?.seedance_asset_library?.items.find(item => (
      item.provider_asset_id === 'series-storyboard-image-v1'
    ))).toMatchObject({
      kind: 'unknown',
      file_url: 'https://media.vendor-cdn.net/series/storyboard-v1.jpg',
      rights_status: 'pending',
      human_review_status: 'pending',
    });

    const afterAssetReport = await exportAiComicSeriesSeedanceAssetReportPackage(seriesProjectId);
    expect(afterAssetReport.data?.assets.find(item => item.asset_id === archivedAsset?.asset_id)).toMatchObject({
      status: 'bound',
      is_bound: true,
      needs_upload: false,
    });
    expect(afterAssetReport.data?.assets.find(item => (
      item.asset_id === afterCallback.data?.seedance_asset_library?.items.find(asset => (
        asset.provider_asset_id === 'series-scene-image-v1'
      ))?.asset_id
    ))).toMatchObject({
      status: 'bound',
      is_bound: true,
      needs_upload: false,
    });

    const duplicateCallback = await importAiComicSeriesGearsCallback(seriesProjectId, imageCallback);
    expect(duplicateCallback.data?.duplicate_count).toBe(1);
    const afterDuplicate = await getAiComicSeriesProject(seriesProjectId);
    expect(afterDuplicate.data?.seedance_asset_library?.items.find(item => (
      item.asset_id === archivedAsset?.asset_id
    ))?.history?.filter(event => event.event_type === 'provider_callback')).toHaveLength(1);
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
    expect(copyRes.data?.visual_bible?.identities.map(identity => identity.identity_id))
      .toEqual(saveRes.data?.visual_bible?.identities.map(identity => identity.identity_id));

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
    expect(seedanceAssetReportRes.data?.assets.some(asset => asset.kind === 'costume')).toBe(true);
    expect(seedanceAssetReportRes.data?.assets.some(asset => asset.kind === 'prop')).toBe(true);
    expect(seedanceAssetReportRes.data?.visual_bible.schema_version).toBe('ai-comic-series-visual-bible/v1');
    expect(seedanceAssetReportRes.data?.completion_plan.summary.identity_total).toBe(
      seedanceAssetReportRes.data?.visual_bible.identities.length,
    );
    expect(seedanceAssetReportRes.data?.completion_plan.identities).toHaveLength(
      seedanceAssetReportRes.data!.visual_bible.identities.length,
    );
    expect(seedanceAssetReportRes.data?.completion_plan.stages.map(stage => stage.key)).toEqual([
      'visual_definitions',
      'human_approvals',
      'real_asset_files',
      'production_credit',
      'provider_shot_films',
    ]);
    expect(seedanceAssetReportRes.data?.completion_plan.stages.filter(stage => stage.status === 'current')).toHaveLength(1);
    expect(seedanceAssetReportRes.data?.completion_plan.identities[0].next_action).toBeTruthy();
    expect(seedanceAssetReportRes.data?.assets.find(asset => (
      asset.kind === 'character' && Boolean(asset.series_identity_id)
    ))?.series_identity_id)
      .toMatch(/^series-character-[a-f0-9]{12}$/);
    expect(seedanceAssetReportRes.data?.shots.some(shot => shot.required_series_identity_ids.length > 0)).toBe(true);
    expect(seedanceAssetReportRes.data?.shots[0].required_asset_ids.length).toBeGreaterThan(0);
    expect(seedanceAssetReportRes.data?.markdown).toContain('Seedance 素材引用完整性报告');
    expect(seedanceAssetReportRes.data?.markdown).toContain('正式生产完成计划');
    const firstShotAssetIds = seedanceAssetReportRes.data!.shots[0].required_asset_ids;
    const bindableAsset = seedanceAssetReportRes.data!.assets.find(asset =>
      asset.has_reference_slot
      && firstShotAssetIds.includes(asset.asset_id)
      && Boolean(asset.series_identity_id)
    ) ?? seedanceAssetReportRes.data!.assets.find(asset => (
      asset.has_reference_slot && Boolean(asset.series_identity_id)
    ));
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
          series_identity_id: bindableAsset!.series_identity_id,
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

    const immutableUploadRes = await uploadAiComicSeriesSeedanceAssetFile(
      saveRes.data!.project.series_project_id,
      {
        asset_id: bindableAsset!.asset_id,
        file: {
          original_filename: 'series-reference.png',
          mime_type: 'image/png',
          buffer: ONE_PIXEL_PNG,
        },
      },
    );
    expect(immutableUploadRes.ok).toBe(true);
    expect(immutableUploadRes.data?.asset).toMatchObject({
      asset_id: bindableAsset!.asset_id,
      provider: 'local_upload',
      mime_type: 'image/png',
      size_bytes: ONE_PIXEL_PNG.length,
      rights_status: 'pending',
      human_review_status: 'pending',
    });
    expect(immutableUploadRes.data?.asset.file_url).toBeUndefined();
    expect(immutableUploadRes.data?.content_sha256).toMatch(/^[a-f0-9]{64}$/);
    const artifactId = `media-sha256-${immutableUploadRes.data!.content_sha256}`;
    expect(immutableUploadRes.data?.preview_url).toContain(artifactId);
    expect(await readFile(resolve(
      outlineGeneratedRoot(),
      immutableUploadRes.data!.local_path,
    ))).toEqual(ONE_PIXEL_PNG);

    const previewRes = await readAiComicSeriesMediaAssetPreview(
      saveRes.data!.project.series_project_id,
      artifactId,
    );
    expect(previewRes.ok).toBe(true);
    if (previewRes.ok) expect(previewRes.data.buffer).toEqual(ONE_PIXEL_PNG);

    const mismatchedReviewRes = await updateAiComicSeriesMediaAssetReview(
      saveRes.data!.project.series_project_id,
      {
        asset_id: bindableAsset!.asset_id,
        expected_content_sha256: '0'.repeat(64),
        human_review_status: 'approved',
        review_note: '不应接受过期内容摘要。',
      },
      { actor_id: 'reviewer-series-001', authentication_method: 'signed_session' },
    );
    expect(mismatchedReviewRes.ok).toBe(false);

    const reviewedAssetRes = await updateAiComicSeriesMediaAssetReview(
      saveRes.data!.project.series_project_id,
      {
        asset_id: bindableAsset!.asset_id,
        expected_content_sha256: immutableUploadRes.data!.content_sha256,
        rights_status: 'authorized',
        authorization_reference: 'contract://series-assets/001',
        human_review_status: 'approved',
        review_note: '人物与历史场景设定一致，批准进入镜头制作。',
      },
      { actor_id: 'reviewer-series-001', authentication_method: 'signed_session' },
    );
    expect(reviewedAssetRes.ok).toBe(true);
    expect(reviewedAssetRes.data).toMatchObject({
      reviewer_id: 'reviewer-series-001',
      production_credit_granted: false,
    });
    expect(reviewedAssetRes.data?.asset).toMatchObject({
      rights_status: 'authorized',
      human_review_status: 'approved',
      reviewer_id: 'reviewer-series-001',
      identity_binding: expect.objectContaining({
        series_identity_id: bindableAsset!.series_identity_id,
        status: 'approved',
      }),
    });
    const auditedAssetReportRes = await exportAiComicSeriesSeedanceAssetReportPackage(
      saveRes.data!.project.series_project_id,
    );
    expect(auditedAssetReportRes.ok).toBe(true);
    expect(auditedAssetReportRes.data?.assets.find(asset => asset.asset_id === bindableAsset!.asset_id)).toMatchObject({
      content_sha256: immutableUploadRes.data!.content_sha256,
      rights_status: 'authorized',
      authorization_reference: 'contract://series-assets/001',
      human_review_status: 'approved',
      reviewer_id: 'reviewer-series-001',
      identity_binding_status: 'approved',
    } as any);
    expect(auditedAssetReportRes.data?.markdown).toContain(immutableUploadRes.data!.content_sha256);

    const replacementUploadRes = await uploadAiComicSeriesSeedanceAssetFile(
      saveRes.data!.project.series_project_id,
      {
        asset_id: bindableAsset!.asset_id,
        file: {
          original_filename: 'series-reference-v2.png',
          mime_type: 'image/png',
          buffer: Buffer.concat([ONE_PIXEL_PNG, Buffer.from([0])]),
        },
      },
    );
    expect(replacementUploadRes.ok).toBe(true);
    expect(replacementUploadRes.data?.content_sha256).not.toBe(immutableUploadRes.data?.content_sha256);
    expect(replacementUploadRes.data?.asset).toMatchObject({
      rights_status: 'pending',
      human_review_status: 'pending',
      identity_binding: expect.objectContaining({ status: 'stale' }),
    });
    expect(replacementUploadRes.data?.asset.reviewer_id).toBeUndefined();

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
      { runner: async ({ outputPath }) => writeFile(outputPath, 'fake-cut-output') },
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
      { runner: async ({ outputPath }) => writeFile(outputPath, 'fake-thumbnail-output') },
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
      { runner: async ({ outputPath }) => writeFile(outputPath, 'fake-subtitle-output') },
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
    expect(runnerCalls[0].outputPath).toContain('.external.tmp');
    expect(await readFile(resolve(projectDir, realAudioMixRes.data!.output_path), 'utf8'))
      .toBe('fake mixed video');
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
    expect(titleRenderCalls[0].outputPath).toContain('.external.tmp');
    expect(await readFile(resolve(projectDir, titleCardRenderRealRes.data!.output_paths[0]), 'utf8'))
      .toContain('fake title card');
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
    expect(finalRunnerCalls[0].outputPath).toContain('.external.tmp');
    expect(await readFile(resolve(projectDir, finalRealRes.data!.output_path), 'utf8'))
      .toBe('fake final delivery');
    expect(finalRealRes.data?.seedance_final_delivery.current_release).toMatchObject({
      immutable: true,
      output_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      manifest_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      archived_output_path: expect.stringContaining('/releases/'),
      archived_manifest_path: expect.stringContaining('/releases/'),
    });
    const firstRelease = finalRealRes.data!.seedance_final_delivery.current_release!;
    expect(await readFile(resolve(projectDir, firstRelease.archived_output_path), 'utf8'))
      .toBe('fake final delivery');

    const finalSecondRes = await assembleAiComicSeriesSeedanceFinalDelivery(
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
          await writeFile(params.outputPath, 'fake final delivery v2');
        },
      },
    );
    expect(finalSecondRes.ok).toBe(true);
    expect(finalSecondRes.data?.seedance_final_delivery.release_history).toHaveLength(2);
    expect(finalSecondRes.data?.seedance_final_delivery.current_release?.release_id).not.toBe(firstRelease.release_id);

    await writeFile(resolve(projectDir, firstRelease.archived_output_path), 'tampered release bytes');
    const tamperedRollbackRes = await rollbackAiComicSeriesSeedanceFinalDelivery(
      saveRes.data!.project.series_project_id,
      {
        release_id: firstRelease.release_id,
        confirmed: true,
        reason: '回归测试：篡改归档必须拒绝。',
      },
      {
        actor_id: 'release-operator-001',
        authentication_method: 'signed_session',
      },
    );
    expect(tamperedRollbackRes.ok).toBe(false);
    expect(tamperedRollbackRes.error?.message).toContain('hash or byte size');
    expect(await readFile(resolve(projectDir, finalRealRes.data!.output_path), 'utf8'))
      .toBe('fake final delivery v2');
    await writeFile(resolve(projectDir, firstRelease.archived_output_path), 'fake final delivery');

    const localBypassRollbackRes = await rollbackAiComicSeriesSeedanceFinalDelivery(
      saveRes.data!.project.series_project_id,
      {
        release_id: firstRelease.release_id,
        confirmed: true,
        reason: '回归测试：本地绕过身份不得回滚。',
      },
      {
        actor_id: 'local-user',
        authentication_method: 'local_bypass',
      },
    );
    expect(localBypassRollbackRes.ok).toBe(false);
    expect(localBypassRollbackRes.error?.code).toBe('ACCESS_FORBIDDEN');

    const rollbackRes = await rollbackAiComicSeriesSeedanceFinalDelivery(
      saveRes.data!.project.series_project_id,
      {
        release_id: firstRelease.release_id,
        confirmed: true,
        reason: '回归测试：恢复已验证的上一版交付。',
      },
      {
        actor_id: 'release-operator-001',
        authentication_method: 'signed_session',
      },
    );
    expect(rollbackRes.ok).toBe(true);
    expect(rollbackRes.data?.seedance_final_delivery).toMatchObject({
      status: 'ready',
      current_release: { release_id: firstRelease.release_id },
      rollback_events: [expect.objectContaining({
        target_release_id: firstRelease.release_id,
        actor_id: 'release-operator-001',
        reason: '回归测试：恢复已验证的上一版交付。',
        output_sha256_verified: true,
        manifest_sha256_verified: true,
      })],
    });
    expect(await readFile(resolve(projectDir, finalRealRes.data!.output_path), 'utf8'))
      .toBe('fake final delivery');

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
    expect(finalDeliveryDryRunRes.data?.manifest.cost_governance).toEqual({
      status: 'not_applicable',
      authorized_shot_count: 0,
      reported_cost_count: 0,
      pending_terminal_cost_report_count: 0,
      boundary_violation_count: 0,
      exceeded_authorization_count: 0,
      currency_mismatch_count: 0,
      authorization_missing_count: 0,
    });
    expect(finalDeliveryDryRunRes.data?.manifest.validation_notes)
      .toContain('Seedance 费用治理：无外部授权镜头或费用回执');
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
      expect(retryAdapterSubmitRes.ok).toBe(false);
      expect(retryAdapterSubmitRes.error?.message).toContain('external_call_authorization');
      expect(providerFetchCalls).toHaveLength(0);
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
    expect(secondEpisodeRes.data?.original_user_query).toContain('上一集已生成状态');
    expect(secondEpisodeRes.data?.original_user_query).toContain('本集主冲突');
    expect(secondEpisodeRes.data?.original_user_query).not.toContain('连续性账本');
    expect(secondEpisodeRes.data?.original_user_query).not.toContain('系列记忆精准召回');
    expect(secondEpisodeRes.data?.original_user_query).not.toContain('长期情景记忆模糊召回');
    expect(secondEpisodeRes.data?.full_text).not.toEqual(firstEpisodeRes.data?.full_text);
    expect(secondEpisodeRes.data?.scene_breakdown.map(scene => scene.title)).toEqual([
      '上官召帖',
      '暂缓行刑',
      '堂前问责',
      '旧案号一角',
      '递出复核文书',
    ]);
    const secondEpisodeText = secondEpisodeRes.data?.full_text ?? '';
    expect(secondEpisodeText).toContain('拒签的后果');
    expect(secondEpisodeText).toContain('暂缓行刑');
    expect(secondEpisodeText).toContain('复核文书');
    expect(secondEpisodeText).toContain('可能因此丢官');
    expect(firstEpisodeRes.data?.full_text).toContain('重新看向判词');
    expect(secondEpisodeText).not.toContain('重新看向判词');
    expect(secondEpisodeText).not.toContain('把新证移到验印桌前');
    expect(secondEpisodeText).not.toContain('同样的印痕缺口');
    const visibleSecondConflict = planRes.data!.episodes[1].main_conflict.replace(/主角/g, '周敦颐');
    expect(secondEpisodeRes.data?.scene_breakdown.some(scene => scene.conflict?.includes(visibleSecondConflict)))
      .toBe(true);
    expect([
      secondEpisodeRes.data?.full_text,
      ...(secondEpisodeRes.data?.scene_breakdown ?? []).flatMap(scene => [scene.plot, scene.visual_prompt]),
      ...(secondEpisodeRes.data?.gears_segments ?? []).map(segment => segment.script_text),
    ].join('\n')).not.toMatch(/生成优先级|核心画面是|知识库使用规则|素材使用规则|素材焦点/);
  });
});
