import { beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { analyzeOutline, multiMatchEntries } from '../services/outline-service.js';
import {
  archiveAiComicSeriesProject,
  applyAiComicSeriesSeedanceProductionCallback,
  assembleAiComicSeriesSeedanceCut,
  autoSelectAiComicSeriesSeedanceProductionVersions,
  captureAiComicSeriesSeedanceThumbnails,
  copyAiComicSeriesProject,
  deleteAiComicSeriesProject,
  exportAiComicSeriesBible,
  exportAiComicSeriesSeedanceAssetReportPackage,
  exportAiComicSeriesSeedanceCutPackage,
  exportAiComicSeriesSeedanceEditAssetPackage,
  exportAiComicSeriesSeedanceFinishingPlanPackage,
  exportAiComicSeriesSeedancePrompts,
  exportAiComicSeriesSeedanceRetryPackage,
  exportAiComicSeriesSeedanceSubtitlePackage,
  exportAiComicSeriesSeedanceThumbnailPlanPackage,
  exportAiComicSeriesSeedanceVersionComparisonPackage,
  generateAiComicEpisodeFromPlan,
  generateAiComicSeriesPlan,
  getAiComicSeriesProject,
  listAiComicSeriesProjects,
  previewAiComicEpisodeContext,
  rebuildAiComicSeriesContinuityLedger,
  renderAiComicSeriesSeedanceSubtitles,
  saveAiComicSeriesProject,
  selectAiComicSeriesSeedanceProductionVersion,
  updateAiComicSeriesSeedanceAssetLibrary,
  updateAiComicSeriesSeedanceProductionStatus,
  updateAiComicSeriesSeedanceProductionStatuses,
} from '../services/ai-comic-series-service.js';

beforeAll(() => {
  if (!process.env.KB_ROOT) {
    process.env.KB_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
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

    const saveRes = await saveAiComicSeriesProject({ plan: planRes.data! });
    expect(saveRes.ok).toBe(true);

    const episodeRes = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 1,
      series_project_id: saveRes.data!.project.series_project_id,
      output_gears_segments: true,
    });
    expect(episodeRes.ok).toBe(true);

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

    const retryPackageRes = await exportAiComicSeriesSeedanceRetryPackage(saveRes.data!.project.series_project_id);
    expect(retryPackageRes.ok).toBe(true);
    expect(retryPackageRes.data?.schema_version).toBe('ai-comic-series-seedance-retry-package/v1');
    expect(retryPackageRes.data?.total_retry_shot_count).toBeGreaterThan(0);
    expect(retryPackageRes.data?.episodes.flatMap(episode => episode.shots).some(shot =>
      shot.shot_id === retryCandidate!.shot_id
      && shot.failure_reason === '人物手部变形'
      && shot.prompt.seedance_prompt.length > 0
    )).toBe(true);
    expect(retryPackageRes.data?.markdown).toContain('Seedance 重试提交包');
    expect(retryPackageRes.data?.markdown).toContain('人物手部变形');

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
