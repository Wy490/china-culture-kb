import { describe, expect, it } from 'vitest';
import type {
  CulturalStorySourceKind,
  EntryDetail,
  NarrativePatternId,
  TruthMode,
  VideoType,
} from '@shared/types.js';
import { generateChinaCultureLocalStoryAssembly } from '../domains/china-culture/story-local-generation-service.js';
import { NARRATIVE_PATTERN_LIBRARY } from '../services/narrative-pattern-library.js';
import { buildStoryGenreComposition } from '../services/story-genre-composition-service.js';

const EXPANDED_PATTERN_IDS = [
  'archaeological_mystery_expedition',
  'clan_legacy_conspiracy',
  'fair_play_detective',
  'mythic_voyage_homecoming',
  'historical_faction_epic',
  'mythic_hero_quest',
  'folk_supernatural_investigation',
  'survival_expedition',
  'conspiracy_puzzle_thriller',
  'courtroom_case_procedural',
  'team_heist_operation',
  'tragic_romance_choice',
  'family_saga_generations',
  'road_companion_quest',
  'war_strategy_campaign',
  'folk_satirical_comedy',
] as const satisfies readonly NarrativePatternId[];

function entry(input: {
  name: string;
  type: string;
  story: string;
  keywords: string[];
}): EntryDetail {
  return {
    name: input.name,
    province: '湖南',
    region: '测试地域',
    type: input.type,
    summary: input.story,
    story: input.story,
    culturalSignificance: '测试文化意义。',
    relatedLocations: [{ name: '古道驿站', description: '可见行动发生的文化空间。' }],
    keywords: input.keywords,
    sources: ['测试来源'],
    credibility: '待核实',
    verificationMethod: '文献与田野交叉核验',
    unverifiedPoints: ['具体场景对白为戏剧化补足'],
  };
}

const CASES: Array<{
  label: string;
  entry: EntryDetail;
  videoType: VideoType;
  truthMode: TruthMode;
  sourceKinds: CulturalStorySourceKind[];
  patternId: NarrativePatternId;
  centralEvent: string;
  expectedFunctions: [string, string];
  textPattern: RegExp;
}> = [
  {
    label: '遗迹探秘',
    entry: entry({
      name: '铜鼓古道传说',
      type: '地方掌故',
      story: '古道驿站附近发现带有铜鼓纹样的残片，其年代和用途仍待核验。',
      keywords: ['铜鼓', '古道', '纹样'],
    }),
    videoType: 'ai_comic_drama',
    truthMode: 'inspired_by_material',
    sourceKinds: ['folk_legend', 'historical_event'],
    patternId: 'archaeological_mystery_expedition',
    centralEvent: '寻找铜鼓残片的来历',
    expectedFunctions: ['异常器物', '带着代价返回'],
    textPattern: /残片|纹样|路线|封存/u,
  },
  {
    label: '公平推理',
    entry: entry({
      name: '驿站失踪案',
      type: '地方掌故',
      story: '旧案卷留下三份互相矛盾的证词和一处未解释的车辙。',
      keywords: ['案卷', '证词', '车辙'],
    }),
    videoType: 'historical_drama',
    truthMode: 'inspired_by_material',
    sourceKinds: ['historical_event', 'local_anecdote'],
    patternId: 'fair_play_detective',
    centralEvent: '查清驿站失踪案',
    expectedFunctions: ['异常现场', '公开解释'],
    textPattern: /证词|物证|时间线|逐条/u,
  },
  {
    label: '神话远航',
    entry: entry({
      name: '湘江归帆传说',
      type: '神话传说',
      story: '相传一名舟子必须带着故乡信物穿过三处异水，才能在约定前归乡。',
      keywords: ['归乡', '信物', '异水'],
    }),
    videoType: 'legend_story',
    truthMode: 'inspired_by_material',
    sourceKinds: ['myth', 'folk_legend'],
    patternId: 'mythic_voyage_homecoming',
    centralEvent: '舟子守住归乡誓言',
    expectedFunctions: ['离岸誓言', '带伤归乡'],
    textPattern: /归乡|航路|信物|誓言/u,
  },
  {
    label: '历史阵营群像',
    entry: entry({
      name: '古城守卫事件',
      type: '地方掌故',
      story: '战报、粮道和三方盟约共同影响古城守卫，普通百姓承担了决策后果。',
      keywords: ['战报', '粮道', '盟约'],
    }),
    videoType: 'historical_drama',
    truthMode: 'factual_reconstruction',
    sourceKinds: ['historical_event'],
    patternId: 'historical_faction_epic',
    centralEvent: '三方围绕古城守卫作出选择',
    expectedFunctions: ['天下局势', '秩序重排'],
    textPattern: /阵营|战报|粮道|盟约/u,
  },
];

describe('local story genre composition', () => {
  for (const testCase of CASES) {
    it(`materializes ${testCase.label} into fallback text, scenes and GEARS`, () => {
      const genreComposition = buildStoryGenreComposition({
        entry: testCase.entry,
        videoType: testCase.videoType,
        truthMode: testCase.truthMode,
        requestedSourceKinds: testCase.sourceKinds,
        narrativePatternIds: [testCase.patternId],
      });
      const result = generateChinaCultureLocalStoryAssembly({
        entry: testCase.entry,
        centralEvent: testCase.centralEvent,
        videoType: testCase.videoType,
        presentationStyle: testCase.videoType === 'ai_comic_drama' ? 'ai_comic' : 'cinematic',
        storyStructure: 'single_event_drama',
        targetDuration: '3分钟',
        tone: '悬念清楚、行动具体',
        genreComposition,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.storyResult.scene_breakdown[0].dramatic_function).toBe(testCase.expectedFunctions[0]);
      expect(result.storyResult.scene_breakdown.at(-1)?.dramatic_function).toBe(testCase.expectedFunctions[1]);
      expect(result.storyResult.full_text).toMatch(testCase.textPattern);
      expect(result.storyResult.scene_breakdown.every(scene => scene.factual_basis)).toBe(true);
      expect(result.storyResult.scene_breakdown.every(scene => scene.fictionalized_elements?.length)).toBe(true);
      expect(result.storyResult.gears_segments).toHaveLength(result.storyResult.scene_breakdown.length);
      expect(result.storyResult.gears_segments[0].purpose).toBe(testCase.expectedFunctions[0]);
      expect(result.storyResult.gears_segments[0].script_text).toContain(
        result.storyResult.scene_breakdown[0].plot.slice(0, 24),
      );
      expect(result.referenceTrace?.flatMap(trace => trace.applied_rules).join('\n')).toContain(testCase.patternId);
    });
  }

  it('keeps all expanded mechanisms executable through the synchronized fallback path', () => {
    const sourceEntry = CASES[0].entry;

    for (const patternId of EXPANDED_PATTERN_IDS) {
      const pattern = NARRATIVE_PATTERN_LIBRARY[patternId];
      const result = generateChinaCultureLocalStoryAssembly({
        entry: sourceEntry,
        centralEvent: '围绕文化线索完成一次原创行动',
        videoType: 'ai_comic_drama',
        presentationStyle: 'ai_comic',
        storyStructure: 'single_event_drama',
        targetDuration: '3分钟',
        tone: '行动具体、因果清楚',
        genreComposition: buildStoryGenreComposition({
          entry: sourceEntry,
          videoType: 'ai_comic_drama',
          truthMode: 'inspired_by_material',
          narrativePatternIds: [patternId],
        }),
      });

      expect(result.ok, patternId).toBe(true);
      if (!result.ok) continue;
      expect(result.storyResult.scene_breakdown[0].dramatic_function, patternId)
        .toBe(pattern.pacing_pattern[0]);
      expect(result.storyResult.scene_breakdown.at(-1)?.dramatic_function, patternId)
        .toBe(pattern.pacing_pattern.at(-1));
      expect(result.storyResult.gears_segments.map(segment => segment.purpose), patternId)
        .toEqual(result.storyResult.scene_breakdown.map(scene => scene.dramatic_function));
      expect(result.storyResult.full_text, patternId)
        .toContain(result.storyResult.scene_breakdown[0].plot);
    }
  });

  it('keeps legacy fallback output unchanged when no expanded mechanism is selected', () => {
    const sourceEntry = CASES[0].entry;
    const baseInput = {
      entry: sourceEntry,
      centralEvent: '寻找铜鼓残片的来历',
      videoType: 'ai_comic_drama' as const,
      presentationStyle: 'ai_comic' as const,
      storyStructure: 'single_event_drama' as const,
      targetDuration: '3分钟' as const,
      tone: '',
    };
    const baseline = generateChinaCultureLocalStoryAssembly(baseInput);
    const oldPatternOnly = generateChinaCultureLocalStoryAssembly({
      ...baseInput,
      genreComposition: buildStoryGenreComposition({
        entry: sourceEntry,
        videoType: 'ai_comic_drama',
        truthMode: 'inspired_by_material',
        narrativePatternIds: ['hero_choice'],
      }),
    });

    expect(baseline.ok).toBe(true);
    expect(oldPatternOnly.ok).toBe(true);
    if (!baseline.ok || !oldPatternOnly.ok) return;
    expect(oldPatternOnly.storyResult).toEqual(baseline.storyResult);
  });

  it('keeps the primary arc while materializing a secondary mechanism in a middle scene', () => {
    const sourceEntry = CASES[0].entry;
    const result = generateChinaCultureLocalStoryAssembly({
      entry: sourceEntry,
      centralEvent: '保护残片并查清路线误判',
      videoType: 'ai_comic_drama',
      presentationStyle: 'ai_comic',
      storyStructure: 'single_event_drama',
      targetDuration: '3分钟',
      tone: '行动具体、证据公平',
      genreComposition: buildStoryGenreComposition({
        entry: sourceEntry,
        videoType: 'ai_comic_drama',
        truthMode: 'inspired_by_material',
        narrativePatternIds: [
          'archaeological_mystery_expedition',
          'fair_play_detective',
        ],
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.storyResult.scene_breakdown[0].dramatic_function).toBe('异常器物');
    expect(result.storyResult.scene_breakdown.at(-1)?.dramatic_function).toBe('带着代价返回');
    const secondaryScenes = result.storyResult.scene_breakdown.filter(scene => (
      /证词|物证|时间线|反证/u.test(`${scene.plot} ${scene.key_action}`)
    ));
    expect(secondaryScenes).toHaveLength(1);
    expect(result.storyResult.full_text).toMatch(/证词|物证|时间线|反证/u);
    expect(result.storyResult.gears_segments.some(segment => (
      /证词|物证|时间线|反证/u.test(segment.script_text)
    ))).toBe(true);
    expect(result.referenceTrace?.flatMap(trace => trace.applied_rules)).toEqual(expect.arrayContaining([
      'local-genre-composition:archaeological_mystery_expedition',
      'local-genre-composition-secondary:fair_play_detective',
    ]));
  });

  it('fails closed when distinct secondary mechanisms exceed interior scene capacity', () => {
    const sourceEntry = CASES[0].entry;
    const result = generateChinaCultureLocalStoryAssembly({
      entry: sourceEntry,
      centralEvent: '围绕文化线索完成多机制行动',
      videoType: 'ai_comic_drama',
      presentationStyle: 'ai_comic',
      storyStructure: 'single_event_drama',
      targetDuration: '3分钟',
      tone: '行动具体、因果清楚',
      genreComposition: buildStoryGenreComposition({
        entry: sourceEntry,
        videoType: 'ai_comic_drama',
        truthMode: 'inspired_by_material',
        narrativePatternIds: [
          'archaeological_mystery_expedition',
          'fair_play_detective',
          'team_heist_operation',
          'road_companion_quest',
          'family_saga_generations',
          'folk_satirical_comedy',
        ],
      }),
    });

    expect(result).toMatchObject({
      ok: false,
      reason: 'genre_fusion_conflict',
    });
    if (result.ok) return;
    expect(result.message).toContain('中段场景容量');
  });
});
