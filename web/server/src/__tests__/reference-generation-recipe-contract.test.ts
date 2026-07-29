import { describe, expect, it } from 'vitest';
import { StoryGenerateRequestSchema } from '@shared/schemas.js';
import {
  REFERENCE_GENERATION_RECIPES,
  buildReferenceGenerationRecipeContract,
} from '@shared/reference-generation-recipes.js';
import type { EntryDetail, StoryGenerateRequest } from '@shared/types.js';
import { buildStoryGenerationPromptPackage } from '../services/story-generation-prompt.js';
import {
  resolveReferenceGenerationRecipeContract,
} from '../services/reference-generation-recipe-service.js';

const recipeId = 'feature_long_goal_payoff' as const;
const fixtureEntry: EntryDetail = {
  name: '周敦颐——理学开山鼻祖',
  province: '湖南',
  region: '永州→道县',
  type: '历史人物',
  summary: '周敦颐为北宋理学重要人物。',
  story: '道县月岩悟道传说为民间传说，需标明可信度边界。',
  culturalSignificance: '濂溪学脉影响后世。',
  relatedLocations: [{ name: '月岩洞', description: '道县天然岩洞' }],
  keywords: ['周敦颐', '北宋', '月岩洞', '理学'],
  sources: ['测试来源'],
  credibility: '待核实',
  verificationMethod: '测试核验',
  unverifiedPoints: ['月岩悟道为民间传说'],
};

function request(
  overrides: Partial<StoryGenerateRequest> = {},
): StoryGenerateRequest {
  return {
    entry_name: fixtureEntry.name,
    video_type: 'character_story',
    presentation_style: 'cinematic',
    narrative_pattern_ids: [
      'mortal_growth',
      'hero_choice',
      'mystery_reveal',
    ],
    reference_generation_recipe:
      buildReferenceGenerationRecipeContract(recipeId),
    ...overrides,
  };
}

describe('reference generation recipe contract', () => {
  it('keeps legacy requests valid and accepts the canonical v1 snapshot', () => {
    expect(StoryGenerateRequestSchema.safeParse({
      entry_name: fixtureEntry.name,
      video_type: 'character_story',
    }).success).toBe(true);

    const parsed = StoryGenerateRequestSchema.safeParse(request());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.reference_generation_recipe).toMatchObject({
      schema_version: 'reference-generation-recipe/v1',
      recipe_id: recipeId,
      recipe_version: '1.0.0',
      payload_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it('resolves the canonical catalog snapshot and rejects mechanism tampering', () => {
    const resolved = resolveReferenceGenerationRecipeContract({
      request: request(),
      videoType: 'character_story',
      presentationStyle: 'cinematic',
    });
    expect(resolved).toMatchObject({
      ok: true,
      contract: {
        recipe_id: recipeId,
      },
    });

    const tampered = request();
    tampered.reference_generation_recipe = {
      ...tampered.reference_generation_recipe!,
      reusable_mechanisms: ['复刻原作的识别性桥段'],
    };
    expect(resolveReferenceGenerationRecipeContract({
      request: tampered,
      videoType: 'character_story',
      presentationStyle: 'cinematic',
    })).toMatchObject({
      ok: false,
      issue_code: 'recipe_contract_tampered',
    });
  });

  it('rejects unknown ids and incompatible video types', () => {
    const unknown = request();
    unknown.reference_generation_recipe = {
      ...unknown.reference_generation_recipe!,
      recipe_id: 'unknown_recipe',
    } as unknown as StoryGenerateRequest['reference_generation_recipe'];
    expect(resolveReferenceGenerationRecipeContract({
      request: unknown,
      videoType: 'character_story',
      presentationStyle: 'cinematic',
    })).toMatchObject({
      ok: false,
      issue_code: 'unknown_recipe_id',
    });

    expect(resolveReferenceGenerationRecipeContract({
      request: request({ video_type: 'culture_promo' }),
      videoType: 'culture_promo',
      presentationStyle: 'cinematic',
    })).toMatchObject({
      ok: false,
      issue_code: 'recipe_video_type_incompatible',
    });
  });

  it('compiles only bounded mechanisms and avoid-copying rules into the prompt', () => {
    const recipe = REFERENCE_GENERATION_RECIPES.find(item => item.id === recipeId)!;
    const resolved = resolveReferenceGenerationRecipeContract({
      request: request(),
      videoType: 'character_story',
      presentationStyle: 'cinematic',
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const prompt = buildStoryGenerationPromptPackage({
      entry: fixtureEntry,
      request: request(),
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      storyStructure: 'single_event_drama',
      targetDuration: '3分钟',
      tone: recipe.tone,
      referenceGenerationRecipe: resolved.context,
    });

    expect(prompt.reference_generation_recipe).toEqual(resolved.context);
    for (const mechanism of recipe.reusable_mechanisms) {
      expect(prompt.output_contract.should_respect)
        .toContain(`配方抽象机制：${mechanism}`);
    }
    for (const boundary of recipe.avoid_copying) {
      expect(prompt.output_contract.should_respect)
        .toContain(`配方禁仿边界：${boundary}`);
    }
    expect(JSON.stringify(prompt)).not.toMatch(
      /肖申克的救赎|霸王别姬|阿甘正传|教父|黑暗骑士|Welcome Home|Dumb Ways to Die|You Can.t Stop Us|三国演义|红楼梦/u,
    );
  });
});
