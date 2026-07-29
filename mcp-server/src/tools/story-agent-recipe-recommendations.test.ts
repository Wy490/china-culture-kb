import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getStoryAgentRecipeEffectHistory,
  prepareStoryAgentRecipeComparison,
  recommendStoryAgentRecipes,
} from './story-agent-recipe-recommendations.js';
import type { StoryAgentRecipeRecommendationInput } from './story-agent-recipe-recommendations.js';

const originalBaseUrl = process.env.STORY_AGENT_BASE_URL;
const originalAccessToken = process.env.STORY_AGENT_MCP_ACCESS_TOKEN;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalBaseUrl === undefined) delete process.env.STORY_AGENT_BASE_URL;
  else process.env.STORY_AGENT_BASE_URL = originalBaseUrl;
  if (originalAccessToken === undefined) delete process.env.STORY_AGENT_MCP_ACCESS_TOKEN;
  else process.env.STORY_AGENT_MCP_ACCESS_TOKEN = originalAccessToken;
});

describe('recommendStoryAgentRecipes', () => {
  it('routes the unchanged request through the canonical recommendation service', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999/';
    process.env.STORY_AGENT_MCP_ACCESS_TOKEN = 'mcp-test-token';
    const webEnvelope = {
      ok: true,
      data: {
        schema_version: 'reference-generation-recipe-recommendation/v1',
        recommendations: [],
        policy_warnings: [],
        boundary: {
          optional_recommendation: true,
          user_may_decline: true,
          machine_recommendation_only: true,
        },
      },
      error: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(webEnvelope), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const request: StoryAgentRecipeRecommendationInput = {
      creation_path: 'institutional',
      video_type: 'culture_promo',
      creation_use_case: 'institutional_promo',
      truth_mode: 'institutional_verified',
      subject_text: '多位传承人共同呈现地域技艺。',
      narrative_goal: '用群像证明共同主张。',
      material_features: ['ensemble_cast', 'institutional_brief'],
    };
    const result = await recommendStoryAgentRecipes(request);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:3999/api/stories/reference-generation-recipe-recommendations',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: {
        authorization: 'Bearer mcp-test-token',
        'content-type': 'application/json',
      },
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(request);
    expect(result).toEqual({
      ...webEnvelope,
      mcp_bridge: {
        schema_version: 'mcp-story-agent-recipe-recommendation/v1',
        canonical_tool: 'kb_recommend_story_generation_recipes',
        canonical_service: true,
        application_endpoint:
          'http://127.0.0.1:3999/api/stories/reference-generation-recipe-recommendations',
        authoritative_request_schema: 'ReferenceGenerationRecipeRecommendationRequestSchema',
        recommendation_only: true,
        generation_performed: false,
        recipe_applied: false,
      },
    });
  });

  it('fails closed without a configured canonical application service', async () => {
    delete process.env.STORY_AGENT_BASE_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(recommendStoryAgentRecipes({
      creation_path: 'original',
      video_type: 'character_story',
    })).rejects.toThrow('STORY_AGENT_BASE_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves canonical truth-boundary validation failures', async () => {
    process.env.STORY_AGENT_BASE_URL = 'https://story-agent.example.com';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'material_features must be unique' },
    }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(recommendStoryAgentRecipes({
      creation_path: 'institutional',
      video_type: 'culture_promo',
      truth_mode: 'institutional_verified',
    })).rejects.toThrow('VALIDATION_ERROR: material_features must be unique');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('prepareStoryAgentRecipeComparison', () => {
  it('prepares a canonical no-generation replay draft', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999/';
    const webEnvelope = {
      ok: true,
      data: {
        schema_version: 'reference-recipe-comparison-draft/v1',
        baseline_story_id: '20260730-story-baseline01',
        no_generation_performed: true,
      },
      error: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(webEnvelope), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const request = {
      baseline_story_id: '20260730-story-baseline01',
      recipe_id: 'feature_long_goal_payoff' as const,
    };

    const result = await prepareStoryAgentRecipeComparison(request);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(request);
    expect(result.mcp_bridge).toEqual({
      schema_version: 'mcp-story-agent-recipe-comparison-draft/v1',
      canonical_tool: 'kb_prepare_story_recipe_comparison',
      canonical_service: true,
      application_endpoint:
        'http://127.0.0.1:3999/api/stories/reference-generation-recipe-comparison-drafts',
      authoritative_request_schema: 'ReferenceRecipeComparisonDraftRequestSchema',
      generation_performed: false,
      same_input_server_revalidation_required: true,
      machine_comparison_only: true,
      production_credit_granted: false,
    });
  });
});

describe('getStoryAgentRecipeEffectHistory', () => {
  it('queries the canonical current-project history endpoint without local scanning', async () => {
    process.env.STORY_AGENT_BASE_URL = 'http://127.0.0.1:3999/';
    process.env.STORY_AGENT_MCP_ACCESS_TOKEN = 'mcp-test-token';
    const webEnvelope = {
      ok: true,
      data: {
        schema_version: 'story-recipe-effect-comparison-history/v1',
        summary: { matched_comparison_count: 2 },
        trends: [],
        items: [],
        boundary: {
          source_snapshot: 'current_project_versions',
          machine_comparison_only: true,
          human_preference_measured: false,
          causal_effect_proven: false,
          production_credit_granted: false,
        },
      },
      error: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(webEnvelope), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getStoryAgentRecipeEffectHistory({
      recipe_id: 'feature_long_goal_payoff',
      video_type: 'character_story',
      machine_verdict: 'improved',
      limit: 20,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:3999/api/projects/recipe-effect-comparisons'
      + '?recipe_id=feature_long_goal_payoff&video_type=character_story'
      + '&machine_verdict=improved&limit=20',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      headers: { authorization: 'Bearer mcp-test-token' },
    });
    expect(result.mcp_bridge).toEqual({
      schema_version: 'mcp-story-agent-recipe-effect-history/v1',
      canonical_tool: 'kb_get_story_recipe_effect_history',
      canonical_service: true,
      application_endpoint:
        'http://127.0.0.1:3999/api/projects/recipe-effect-comparisons'
        + '?recipe_id=feature_long_goal_payoff&video_type=character_story'
        + '&machine_verdict=improved&limit=20',
      authoritative_query_schema: 'StoryRecipeEffectComparisonHistoryQuerySchema',
      source_snapshot: 'current_project_versions',
      machine_comparison_only: true,
      human_preference_measured: false,
      causal_effect_proven: false,
      production_credit_granted: false,
    });
  });

  it('preserves canonical query validation failures', async () => {
    process.env.STORY_AGENT_BASE_URL = 'https://story-agent.example.com';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'limit must be at most 100' },
    }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getStoryAgentRecipeEffectHistory({ limit: 101 }))
      .rejects.toThrow('VALIDATION_ERROR: limit must be at most 100');
  });
});
