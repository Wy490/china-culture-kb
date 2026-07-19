import type { PresentationStyle, VideoType } from '../types.js';

type GenerationType = 'character_story' | 'culture_promo' | 'scene_short';
type CanonicalStoryStructureType =
  | 'single_event_drama'
  | 'three_act_drama'
  | 'memory_mosaic_biography'
  | 'witness_testimony'
  | 'object_clue_journey'
  | 'before_after_transformation'
  | 'case_reconstruction'
  | 'lecture_argument';
type ReferenceStrength = 'light' | 'medium' | 'strong';
type GenreStrictness = 'loose' | 'balanced' | 'strict';
type StoryGenerationPriority = 'balanced' | 'plot_first' | 'knowledge_first';
type SourceMaterialMode = 'generate_from_knowledge' | 'adapt_user_novel';
type LocalizationMode = 'allow_related_influence' | 'strict_direct_events';

export interface StoryAgentGenerateInput {
  domain?: string;
  entry_name?: string;
  original_user_query?: string;
  generation_type?: GenerationType;
  video_type?: VideoType;
  model_profile_id?: string;
  selected_event?: string;
  target_video_duration?: string;
  tone?: string;
  presentation_style?: PresentationStyle;
  output_gears_segments?: boolean;
  outline?: string;
  knowledge_pack?: Record<string, unknown>;
  material_pack?: Record<string, unknown>;
  creation_use_case?: string;
  truth_mode?: string;
  client_type?: string;
  target_audience?: string;
  communication_goal?: string;
  character_hints?: Array<Record<string, unknown>>;
  story_structure?: CanonicalStoryStructureType;
  creative_reference_ids?: string[];
  style_pack_ids?: string[];
  narrative_pattern_ids?: string[];
  reference_strength?: ReferenceStrength;
  genre_strictness?: GenreStrictness;
  auto_repair?: boolean;
  story_priority?: StoryGenerationPriority;
  source_material_mode?: SourceMaterialMode;
  localized_target_region?: string;
  localization_mode?: LocalizationMode;
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

export interface StoryAgentGenerateBridgeMetadata {
  schema_version: 'mcp-story-agent-generate/v1';
  canonical_tool: 'kb_story_agent_generate';
  canonical_service: true;
  application_endpoint: string;
  capability_endpoint: string;
  authoritative_request_schema: 'StoryGenerateRequestSchema';
  shares_web_generation_pipeline: true;
  direct_file_write_performed: false;
}

export type StoryAgentGenerateToolResult = StoryAgentApiEnvelope & {
  mcp_bridge: StoryAgentGenerateBridgeMetadata;
};

function storyAgentBaseUrl(): string {
  const raw = process.env.STORY_AGENT_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      'STORY_AGENT_BASE_URL 未配置；kb_story_agent_generate 必须调用 canonical Web application service，不会回退到本地 legacy writer。',
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
 * Canonical MCP generation is a thin client of the Web application service.
 * Request validation, domain resolution, quality gates, revision comparison,
 * derived-state rebuild, persistence and access control remain Web-owned.
 */
export async function storyAgentGenerate(
  input: StoryAgentGenerateInput,
): Promise<StoryAgentGenerateToolResult> {
  const applicationEndpoint = `${storyAgentBaseUrl()}/api/stories/generate`;
  const response = await fetch(applicationEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...accessTokenHeader(),
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(330_000),
  });
  const envelope = await readApiEnvelope(response);
  if (!response.ok || !envelope.ok) {
    const code = envelope.error?.code?.trim() || 'STORY_AGENT_GENERATION_FAILED';
    const message = envelope.error?.message?.trim()
      || `Story Agent application service 生成失败（HTTP ${response.status}）`;
    throw new Error(`${code}: ${message}`);
  }

  return {
    ...envelope,
    mcp_bridge: {
      schema_version: 'mcp-story-agent-generate/v1',
      canonical_tool: 'kb_story_agent_generate',
      canonical_service: true,
      application_endpoint: applicationEndpoint,
      capability_endpoint: `${storyAgentBaseUrl()}/api/system/story-generation-capabilities`,
      authoritative_request_schema: 'StoryGenerateRequestSchema',
      shares_web_generation_pipeline: true,
      direct_file_write_performed: false,
    },
  };
}
