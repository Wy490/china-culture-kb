import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  REFERENCE_GENERATION_RECIPES,
  buildReferenceGenerationRecipeContract,
  referenceGenerationRecipePayload,
  type ReferenceGenerationRecipeCategory,
} from '@shared/reference-generation-recipes.js';
import { getNarrativePatternCatalog } from '../services/narrative-pattern-library.js';

describe('reference-generation-recipes', () => {
  it('offers bounded film, promo, knowledge, and series recipes', () => {
    const counts = new Map<ReferenceGenerationRecipeCategory, number>();

    for (const recipe of REFERENCE_GENERATION_RECIPES) {
      counts.set(recipe.category, (counts.get(recipe.category) ?? 0) + 1);
    }

    expect(counts).toEqual(new Map([
      ['feature_film', 3],
      ['promo', 4],
      ['classic_series', 2],
      ['knowledge', 2],
    ]));
    expect(new Set(REFERENCE_GENERATION_RECIPES.map(recipe => recipe.id)).size)
      .toBe(REFERENCE_GENERATION_RECIPES.length);
  });

  it('covers heritage, documentary, and explainer production promises', () => {
    expect(REFERENCE_GENERATION_RECIPES).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'heritage_craft_process_evidence',
        video_type: 'heritage_promo',
        presentation_style: 'documentary',
      }),
      expect.objectContaining({
        id: 'documentary_evidence_trail',
        video_type: 'documentary_short',
        presentation_style: 'documentary',
      }),
      expect.objectContaining({
        id: 'explainer_question_to_example',
        video_type: 'explainer_video',
        presentation_style: 'host_narration',
      }),
    ]));
  });

  it('only composes patterns supported by the selected video type', () => {
    const catalog = getNarrativePatternCatalog();

    for (const recipe of REFERENCE_GENERATION_RECIPES) {
      const supported = new Set(catalog.video_type_map[recipe.video_type]);

      expect(recipe.narrative_pattern_ids.length).toBeGreaterThanOrEqual(2);
      expect(recipe.narrative_pattern_ids.every(patternId => supported.has(patternId))).toBe(true);
      expect(recipe.reusable_mechanisms.length).toBeGreaterThanOrEqual(3);
      expect(recipe.avoid_copying.length).toBeGreaterThanOrEqual(3);
      expect(recipe.communication_goal).not.toBe('');
      expect(recipe.tone).not.toBe('');
    }
  });

  it('binds every catalog payload to its declared canonical SHA-256', () => {
    for (const recipe of REFERENCE_GENERATION_RECIPES) {
      const digest = createHash('sha256')
        .update(JSON.stringify(referenceGenerationRecipePayload(recipe)), 'utf8')
        .digest('hex');

      expect(buildReferenceGenerationRecipeContract(recipe.id).payload_sha256)
        .toBe(digest);
    }
  });

  it('keeps research candidates out of canonical generation inputs', () => {
    const serialized = JSON.stringify(REFERENCE_GENERATION_RECIPES);

    for (const title of [
      '肖申克的救赎',
      '霸王别姬',
      '阿甘正传',
      '教父',
      '黑暗骑士',
      'Welcome Home',
      'Dumb Ways to Die',
      'You Can’t Stop Us',
      '三国演义',
      '红楼梦',
    ]) {
      expect(serialized).not.toContain(title);
    }
  });
});
