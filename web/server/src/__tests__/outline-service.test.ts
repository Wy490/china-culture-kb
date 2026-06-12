import { beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { analyzeOutline, multiMatchEntries } from '../services/outline-service.js';
import {
  generateAiComicEpisodeFromPlan,
  generateAiComicSeriesPlan,
  getAiComicSeriesProject,
  listAiComicSeriesProjects,
  saveAiComicSeriesProject,
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
    });

    expect(res.ok).toBe(true);
    expect(res.data?.series_title).toBe('濂溪少年志');
    expect(res.data?.episode_count).toBe(12);
    expect(res.data?.episodes).toHaveLength(12);
    expect(res.data?.episodes.every(episode =>
      episode.target_duration_sec >= 60 && episode.target_duration_sec <= 120
    )).toBe(true);
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
    });

    expect(planRes.ok).toBe(true);
    const res = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 2,
      output_gears_segments: false,
    });

    expect(res.ok).toBe(true);
    expect(res.data?.video_type).toBe('ai_comic_drama');
    expect(res.data?.presentation_style).toBe('ai_comic');
    expect(res.data?.original_user_query).toContain('只生成第2集完整分镜');
    expect(res.data?.scene_breakdown.length).toBeGreaterThan(0);
    expect(res.data?.dialogue?.length).toBeGreaterThan(0);
    expect(res.data?.ai_comic_episode_quality?.schema_version).toBe('ai-comic-episode-quality/v1');
    expect(res.data?.continuity_audit?.schema_version).toBe('ai-comic-continuity-audit/v1');
  });

  it('saves and loads an AI comic series project', async () => {
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
    });

    expect(saveRes.ok).toBe(true);
    expect(saveRes.data?.project.series_project_id).toMatch(/^\d{8}-series-[0-9a-z]+$/);
    expect(saveRes.data?.project.generated_episode_count).toBe(1);
    expect(saveRes.data?.continuity_ledger.schema_version).toBe('ai-comic-continuity-ledger/v1');
    expect(saveRes.data?.continuity_ledger.character_state_current.length).toBeGreaterThan(0);

    const getRes = await getAiComicSeriesProject(saveRes.data!.project.series_project_id);
    expect(getRes.ok).toBe(true);
    expect(getRes.data?.plan.series_title).toBe('濂溪少年志');
    expect(getRes.data?.generated_episode_story_ids['1']).toBe('20260611-story-abc1');

    const listRes = await listAiComicSeriesProjects();
    expect(listRes.ok).toBe(true);
    expect(listRes.data?.some(project => project.series_project_id === saveRes.data!.project.series_project_id)).toBe(true);
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
      output_gears_segments: false,
    });
    expect(episodeRes.ok).toBe(true);

    const getRes = await getAiComicSeriesProject(saveRes.data!.project.series_project_id);
    expect(getRes.ok).toBe(true);
    expect(getRes.data?.continuity_ledger.last_generated_episode_no).toBe(1);
    expect(getRes.data?.continuity_ledger.episode_records).toHaveLength(1);
    expect(getRes.data?.continuity_ledger.episode_records[0].story_id).toBe(episodeRes.data?.storyId);
    expect(getRes.data?.continuity_ledger.open_threads.length).toBeGreaterThan(0);
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

    const secondEpisodeRes = await generateAiComicEpisodeFromPlan({
      series_plan: planRes.data!,
      episode_no: 2,
      series_project_id: saveRes.data!.project.series_project_id,
      output_gears_segments: false,
    });
    expect(secondEpisodeRes.ok).toBe(true);
    expect(secondEpisodeRes.data?.original_user_query).toContain('连续性账本');
    expect(secondEpisodeRes.data?.original_user_query).toContain('账本未回收线索');
    expect(secondEpisodeRes.data?.original_user_query).toContain('上一条生成记忆');
    expect(secondEpisodeRes.data?.original_user_query).toContain(firstEpisodeRes.data!.storyId);
  });
});
