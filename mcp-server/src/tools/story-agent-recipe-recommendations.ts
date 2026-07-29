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
