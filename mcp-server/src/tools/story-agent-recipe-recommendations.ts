import type { VideoType } from '../types.js';

type CreationPath = 'original' | 'adaptation' | 'institutional';
type CreationUseCase =
  | 'original_ai_comic'
  | 'adapted_ai_comic'
  | 'institutional_promo'
  | 'documentary_short'
  | 'brand_commercial'
  | 'education_training'
  | 'public_service';
type TruthMode =
  | 'fictional_original'
  | 'inspired_by_material'
  | 'source_adaptation'
  | 'factual_reconstruction'
  | 'institutional_verified';
type MaterialFeature =
  | 'structured_knowledge_pack'
  | 'documented_character_choice'
  | 'multi_period_scope'
  | 'ensemble_cast'
  | 'spatial_subject'
  | 'public_service_goal'
  | 'institutional_brief'
  | 'strategy_or_power_material'
  | 'ritual_or_relationship_material'
  | 'rhythmic_short_scene_material'
  | 'limited_or_unverified_material';
export type ReferenceGenerationRecipeId =
  | 'feature_long_goal_payoff'
  | 'feature_epoch_character_mosaic'
  | 'feature_moral_pressure'
  | 'promo_space_emotion'
  | 'promo_mnemonic_reveal'
  | 'promo_collective_montage'
  | 'series_strategy_chapters'
  | 'series_ritual_relationships';

export interface StoryAgentRecipeRecommendationInput {
  creation_path: CreationPath;
  video_type: VideoType;
  creation_use_case?: CreationUseCase;
  truth_mode?: TruthMode;
  subject_text?: string;
  narrative_goal?: string;
  material_features?: MaterialFeature[];
}

interface StoryAgentApiError {
  code?: string;
  message?: string;
}

interface StoryAgentApiEnvelope extends Record<string, unknown> {
  ok: boolean;
  data?: unknown;
  error?: StoryAgentApiError | null;
}

export interface StoryAgentRecipeRecommendationBridgeMetadata {
  schema_version: 'mcp-story-agent-recipe-recommendation/v1';
  canonical_tool: 'kb_recommend_story_generation_recipes';
  canonical_service: true;
  application_endpoint: string;
  authoritative_request_schema: 'ReferenceGenerationRecipeRecommendationRequestSchema';
  recommendation_only: true;
  generation_performed: false;
  recipe_applied: false;
}

export type StoryAgentRecipeRecommendationToolResult = StoryAgentApiEnvelope & {
  mcp_bridge: StoryAgentRecipeRecommendationBridgeMetadata;
};

export interface StoryAgentRecipeComparisonDraftInput {
  baseline_story_id: string;
  recipe_id: ReferenceGenerationRecipeId;
}

export type StoryAgentRecipeComparisonDraftToolResult = StoryAgentApiEnvelope & {
  mcp_bridge: {
    schema_version: 'mcp-story-agent-recipe-comparison-draft/v1';
    canonical_tool: 'kb_prepare_story_recipe_comparison';
    canonical_service: true;
    application_endpoint: string;
    authoritative_request_schema: 'ReferenceRecipeComparisonDraftRequestSchema';
    generation_performed: false;
    same_input_server_revalidation_required: true;
    machine_comparison_only: true;
    production_credit_granted: false;
  };
};

export interface StoryAgentRecipeEffectHistoryInput {
  recipe_id?: ReferenceGenerationRecipeId;
  video_type?: VideoType;
  machine_verdict?: 'improved' | 'mixed' | 'no_material_change' | 'regressed';
  limit?: number;
}

export type StoryAgentRecipeEffectHistoryToolResult = StoryAgentApiEnvelope & {
  mcp_bridge: {
    schema_version: 'mcp-story-agent-recipe-effect-history/v1';
    canonical_tool: 'kb_get_story_recipe_effect_history';
    canonical_service: true;
    application_endpoint: string;
    authoritative_query_schema: 'StoryRecipeEffectComparisonHistoryQuerySchema';
    source_snapshot: 'current_project_versions';
    machine_comparison_only: true;
    human_preference_measured: false;
    causal_effect_proven: false;
    production_credit_granted: false;
  };
};

export interface StoryAgentRecipeEffectReportInput
  extends StoryAgentRecipeEffectHistoryInput {
  from_updated_at?: string;
  to_updated_at?: string;
  min_comparisons_per_recipe?: number;
}

export type StoryAgentRecipeEffectReportToolResult = StoryAgentApiEnvelope & {
  mcp_bridge: {
    schema_version: 'mcp-story-agent-recipe-effect-report/v1';
    canonical_tool: 'kb_get_story_recipe_effect_report';
    canonical_service: true;
    application_endpoint: string;
    authoritative_query_schema: 'StoryRecipeEffectMachineReportQuerySchema';
    controlled_cohort: true;
    machine_comparison_only: true;
    human_preference_measured: false;
    causal_effect_proven: false;
    production_credit_granted: false;
  };
};

function storyAgentBaseUrl(): string {
  const raw = process.env.STORY_AGENT_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      'STORY_AGENT_BASE_URL 未配置；kb_recommend_story_generation_recipes 必须调用 canonical Web application service。',
    );
  }
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('STORY_AGENT_BASE_URL 仅支持 http/https');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('STORY_AGENT_BASE_URL 不得包含凭据、query 或 hash');
  }
  return url.toString().replace(/\/$/, '');
}

function accessTokenHeader(): Record<string, string> {
  const token = process.env.STORY_AGENT_MCP_ACCESS_TOKEN?.trim();
  if (!token) return {};
  if (/\s/.test(token)) {
    throw new Error('STORY_AGENT_MCP_ACCESS_TOKEN 格式无效');
  }
  return { authorization: `Bearer ${token}` };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readApiEnvelope(response: Response): Promise<StoryAgentApiEnvelope> {
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error(`Story Agent application service 返回了非 JSON 响应（HTTP ${response.status}）`);
  }
  if (!isRecord(parsed) || typeof parsed.ok !== 'boolean') {
    throw new Error(`Story Agent application service 返回了无效 API envelope（HTTP ${response.status}）`);
  }
  return parsed as StoryAgentApiEnvelope;
}

/**
 * Thin MCP bridge for optional recipe recommendations.
 * Canonical ranking and truth/material policy remain owned by the Web service.
 */
export async function recommendStoryAgentRecipes(
  input: StoryAgentRecipeRecommendationInput,
): Promise<StoryAgentRecipeRecommendationToolResult> {
  const applicationEndpoint = `${storyAgentBaseUrl()}/api/stories/reference-generation-recipe-recommendations`;
  const response = await fetch(applicationEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...accessTokenHeader(),
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
  });
  const envelope = await readApiEnvelope(response);
  if (!response.ok || !envelope.ok) {
    const code = envelope.error?.code?.trim() || 'STORY_AGENT_RECIPE_RECOMMENDATION_FAILED';
    const message = envelope.error?.message?.trim()
      || `Story Agent application service 推荐失败（HTTP ${response.status}）`;
    throw new Error(`${code}: ${message}`);
  }

  return {
    ...envelope,
    mcp_bridge: {
      schema_version: 'mcp-story-agent-recipe-recommendation/v1',
      canonical_tool: 'kb_recommend_story_generation_recipes',
      canonical_service: true,
      application_endpoint: applicationEndpoint,
      authoritative_request_schema: 'ReferenceGenerationRecipeRecommendationRequestSchema',
      recommendation_only: true,
      generation_performed: false,
      recipe_applied: false,
    },
  };
}

export async function prepareStoryAgentRecipeComparison(
  input: StoryAgentRecipeComparisonDraftInput,
): Promise<StoryAgentRecipeComparisonDraftToolResult> {
  const applicationEndpoint = `${storyAgentBaseUrl()}/api/stories/reference-generation-recipe-comparison-drafts`;
  const response = await fetch(applicationEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...accessTokenHeader(),
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
  });
  const envelope = await readApiEnvelope(response);
  if (!response.ok || !envelope.ok) {
    const code = envelope.error?.code?.trim() || 'STORY_AGENT_RECIPE_COMPARISON_DRAFT_FAILED';
    const message = envelope.error?.message?.trim()
      || `Story Agent application service 对照草案失败（HTTP ${response.status}）`;
    throw new Error(`${code}: ${message}`);
  }
  return {
    ...envelope,
    mcp_bridge: {
      schema_version: 'mcp-story-agent-recipe-comparison-draft/v1',
      canonical_tool: 'kb_prepare_story_recipe_comparison',
      canonical_service: true,
      application_endpoint: applicationEndpoint,
      authoritative_request_schema: 'ReferenceRecipeComparisonDraftRequestSchema',
      generation_performed: false,
      same_input_server_revalidation_required: true,
      machine_comparison_only: true,
      production_credit_granted: false,
    },
  };
}

export async function getStoryAgentRecipeEffectHistory(
  input: StoryAgentRecipeEffectHistoryInput = {},
): Promise<StoryAgentRecipeEffectHistoryToolResult> {
  const endpoint = new URL(
    `${storyAgentBaseUrl()}/api/projects/recipe-effect-comparisons`,
  );
  if (input.recipe_id) endpoint.searchParams.set('recipe_id', input.recipe_id);
  if (input.video_type) endpoint.searchParams.set('video_type', input.video_type);
  if (input.machine_verdict) {
    endpoint.searchParams.set('machine_verdict', input.machine_verdict);
  }
  if (input.limit !== undefined) endpoint.searchParams.set('limit', String(input.limit));
  const applicationEndpoint = endpoint.toString();
  const response = await fetch(applicationEndpoint, {
    method: 'GET',
    headers: accessTokenHeader(),
    signal: AbortSignal.timeout(30_000),
  });
  const envelope = await readApiEnvelope(response);
  if (!response.ok || !envelope.ok) {
    const code = envelope.error?.code?.trim() || 'STORY_AGENT_RECIPE_EFFECT_HISTORY_FAILED';
    const message = envelope.error?.message?.trim()
      || `Story Agent application service 配方对照历史查询失败（HTTP ${response.status}）`;
    throw new Error(`${code}: ${message}`);
  }
  return {
    ...envelope,
    mcp_bridge: {
      schema_version: 'mcp-story-agent-recipe-effect-history/v1',
      canonical_tool: 'kb_get_story_recipe_effect_history',
      canonical_service: true,
      application_endpoint: applicationEndpoint,
      authoritative_query_schema: 'StoryRecipeEffectComparisonHistoryQuerySchema',
      source_snapshot: 'current_project_versions',
      machine_comparison_only: true,
      human_preference_measured: false,
      causal_effect_proven: false,
      production_credit_granted: false,
    },
  };
}

export async function getStoryAgentRecipeEffectReport(
  input: StoryAgentRecipeEffectReportInput = {},
): Promise<StoryAgentRecipeEffectReportToolResult> {
  const endpoint = new URL(
    `${storyAgentBaseUrl()}/api/projects/recipe-effect-comparison-report`,
  );
  const query: Record<string, string | number | undefined> = {
    recipe_id: input.recipe_id,
    video_type: input.video_type,
    machine_verdict: input.machine_verdict,
    limit: input.limit,
    from_updated_at: input.from_updated_at,
    to_updated_at: input.to_updated_at,
    min_comparisons_per_recipe: input.min_comparisons_per_recipe,
  };
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) endpoint.searchParams.set(key, String(value));
  }
  const applicationEndpoint = endpoint.toString();
  const response = await fetch(applicationEndpoint, {
    method: 'GET',
    headers: accessTokenHeader(),
    signal: AbortSignal.timeout(30_000),
  });
  const envelope = await readApiEnvelope(response);
  if (!response.ok || !envelope.ok) {
    const code = envelope.error?.code?.trim() || 'STORY_AGENT_RECIPE_EFFECT_REPORT_FAILED';
    const message = envelope.error?.message?.trim()
      || `Story Agent application service 配方对照报告查询失败（HTTP ${response.status}）`;
    throw new Error(`${code}: ${message}`);
  }
  return {
    ...envelope,
    mcp_bridge: {
      schema_version: 'mcp-story-agent-recipe-effect-report/v1',
      canonical_tool: 'kb_get_story_recipe_effect_report',
      canonical_service: true,
      application_endpoint: applicationEndpoint,
      authoritative_query_schema: 'StoryRecipeEffectMachineReportQuerySchema',
      controlled_cohort: true,
      machine_comparison_only: true,
      human_preference_measured: false,
      causal_effect_proven: false,
      production_credit_granted: false,
    },
  };
}
