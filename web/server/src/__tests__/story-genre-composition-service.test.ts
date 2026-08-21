import { describe, expect, it } from 'vitest';
import type { EntryDetail } from '@shared/types.js';
import { StoryGenerateRequestSchema } from '@shared/schemas.js';
import {
  buildStoryGenreComposition,
  inferCulturalStorySourceKinds,
} from '../services/story-genre-composition-service.js';

function entry(overrides: Partial<EntryDetail> = {}): EntryDetail {
  return {
    name: '古道传说与历史事件',
    province: '湖南',
    region: '湘西',
    type: '地方掌故',
    summary: '地方古道流传神异传说，也保存历史事件痕迹。',
    story: '相传旅人曾在古道遇见异象，事件年代仍需核验。',
    culturalSignificance: '承载地方交通与口述记忆。',
    relatedLocations: [{ name: '古道', description: '地方交通遗存' }],
    keywords: ['古道', '传说'],
    sources: ['测试来源'],
    credibility: '待核实',
    verificationMethod: '文献与田野核验',
    unverifiedPoints: ['异象版本待核'],
    ...overrides,
  };
}

describe('story genre composition service', () => {
  it('infers source traditions while keeping explicit multi-source selections stable', () => {
    expect(inferCulturalStorySourceKinds(entry())).toEqual(['folk_legend']);
    expect(inferCulturalStorySourceKinds(entry({ type: '历史人物' }))).toEqual(['historical_figure']);
    expect(inferCulturalStorySourceKinds(entry({ credibility: '用户提供' }))).toEqual(['user_original']);

    const composition = buildStoryGenreComposition({
      entry: entry(),
      videoType: 'documentary_short',
      truthMode: 'factual_reconstruction',
      requestedSourceKinds: ['historical_event', 'myth', 'historical_event'],
      narrativePatternIds: ['documentary_investigation', 'mythic_hero_quest'],
    });
    expect(composition.source_kinds).toEqual(['historical_event', 'myth']);
    expect(composition.compatibility_warnings.join('\n')).toContain('非虚构/知识类成片');
    expect(composition.compatibility_warnings.join('\n')).toContain('艺术处理');
  });

  it('validates selectable cultural source kinds and expanded genre pattern ids at the API boundary', () => {
    const parsed = StoryGenerateRequestSchema.safeParse({
      video_type: 'ai_comic_drama',
      outline: '围绕地方传说和历史航路创作原创探险推理故事。',
      cultural_source_kinds: ['folk_legend', 'historical_event'],
      narrative_pattern_ids: ['archaeological_mystery_expedition', 'fair_play_detective'],
    });
    expect(parsed.success).toBe(true);

    expect(StoryGenerateRequestSchema.safeParse({
      video_type: 'ai_comic_drama',
      outline: '重复题材源应被拒绝。',
      cultural_source_kinds: ['myth', 'myth'],
    }).success).toBe(false);
  });

  it('assigns explicit primary and secondary mechanism roles and records semantic tensions', () => {
    const composition = buildStoryGenreComposition({
      entry: entry(),
      videoType: 'ai_comic_drama',
      truthMode: 'inspired_by_material',
      requestedSourceKinds: ['folk_legend', 'historical_event'],
      narrativePatternIds: [
        'archaeological_mystery_expedition',
        'fair_play_detective',
        'folk_supernatural_investigation',
      ],
    });

    expect(composition.fusion_plan).toMatchObject({
      schema_version: 'story-genre-fusion-plan/v1',
      status: 'ready_with_warnings',
      primary_pattern_id: 'archaeological_mystery_expedition',
      secondary_pattern_ids: ['fair_play_detective', 'folk_supernatural_investigation'],
    });
    expect(composition.fusion_plan.assignments).toEqual([
      expect.objectContaining({
        pattern_id: 'archaeological_mystery_expedition',
        role: 'primary_engine',
        scene_scope: 'whole_story',
      }),
      expect.objectContaining({
        pattern_id: 'fair_play_detective',
        role: 'secondary_mechanism',
        scene_scope: 'middle_scene',
      }),
      expect.objectContaining({
        pattern_id: 'folk_supernatural_investigation',
        role: 'secondary_mechanism',
        scene_scope: 'middle_scene',
      }),
    ]);
    expect(composition.fusion_plan.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        conflict_id: 'epistemic-resolution-tension',
        severity: 'warning',
        pattern_ids: ['fair_play_detective', 'folk_supernatural_investigation'],
      }),
    ]));
  });
});
