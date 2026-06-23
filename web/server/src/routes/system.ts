// web/server/src/routes/system.ts — System info routes (provinces, types)

import { Router } from 'express';
import { mcpReadAllProvinceFiles, mcpParseEntries } from '../services/mcp-proxy.js';
import { success } from '@shared/types.js';
import {
  GearsExecutionLiveSmokeRunRequestSchema,
  ProductionReadinessPortfolioRunRequestSchema,
} from '@shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import type {
  AIModelProfile,
  ProvinceInfo,
  SeedanceProviderAdapterContractInfo,
  SeedanceProviderAdapterConfigInfo,
  TypeInfo,
  VideoType,
  PresentationStyle,
} from '@shared/types.js';
import { listModelProfiles } from '../services/model-catalog.js';
import { getNarrativePatternCatalog } from '../services/narrative-pattern-library.js';
import {
  getGearsExecutionAcceptanceReport,
  getGearsExecutionConfigInfo,
  getGearsExecutionContractInfo,
  getGearsExecutionGeneratedProjectPressureReport,
  getGearsExecutionPressureReport,
  getGearsExecutionReadinessReport,
  getGearsExecutionSmokePackage,
  getGearsExecutionWorkerAcceptanceKit,
  getGearsExecutionWorkerEvidenceBundle,
  getGearsExecutionWorkerEvidenceSignoffReport,
  runGearsExecutionLiveSmoke,
} from '../services/gears-execution-service.js';
import {
  getProductionReadinessPortfolio,
  runProductionReadinessPortfolioAutomation,
} from '../services/production-readiness-portfolio-service.js';
import { getStoryAgentGeneratedGovernancePlan } from '../services/generated-governance-service.js';
import { getStoryAgentGeneratedHealth } from '../services/generated-health-service.js';
import { getStoryAgentMvpStatus } from '../services/story-agent-mvp-status-service.js';

export const systemRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/system/provinces — list provinces with entry counts
// ---------------------------------------------------------------------------

systemRouter.get('/provinces', async (_req, res, next) => {
  try {
    const provinceFiles = await mcpReadAllProvinceFiles();
    const provinces: ProvinceInfo[] = [];

    for (const [provinceName, content] of provinceFiles) {
      const entries = mcpParseEntries(content, provinceName);
      provinces.push({ name: provinceName, entry_count: entries.length });
    }

    // Sort by name for consistent ordering
    provinces.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

    res.json(success(provinces));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/types — entry type → video type mapping table
// ---------------------------------------------------------------------------

const TYPE_GENERATION_MAP: TypeInfo[] = [
  { name: '历史人物', recommended_generation_types: ['character_story'], recommended_video_types: ['character_story', 'historical_drama', 'ai_comic_drama', 'documentary_short', 'lecture_video'] as VideoType[], recommended_presentation_styles: ['cinematic', 'ink_style', 'ai_comic', 'documentary', 'host_narration'] as PresentationStyle[], description: '适合人物故事、历史剧情、AI漫剧、纪录片等' },
  { name: '神话传说', recommended_generation_types: ['character_story', 'scene_short'], recommended_video_types: ['legend_story', 'ai_comic_drama', 'scene_short', 'culture_promo', 'children_story'] as VideoType[], recommended_presentation_styles: ['ink_style', 'ai_comic', 'cinematic', 'voiceover_montage', 'children_animation'] as PresentationStyle[], description: '适合传说故事、AI漫剧、场景短片等' },
  { name: '民间故事', recommended_generation_types: ['character_story'], recommended_video_types: ['character_story', 'legend_story', 'ai_comic_drama', 'children_story'] as VideoType[], recommended_presentation_styles: ['cinematic', 'ink_style', 'ai_comic', 'children_animation'] as PresentationStyle[], description: '适合人物故事、传说、AI漫剧等' },
  { name: '非遗', recommended_generation_types: ['culture_promo'], recommended_video_types: ['heritage_promo', 'culture_promo', 'explainer_video', 'ai_comic_drama', 'social_short'] as VideoType[], recommended_presentation_styles: ['documentary', 'voiceover_montage', 'host_narration', 'ai_comic', 'social_media_fastcut'] as PresentationStyle[], description: '适合非遗宣传片、知识讲解、AI漫剧等' },
  { name: '地方戏曲', recommended_generation_types: ['culture_promo'], recommended_video_types: ['culture_promo', 'ai_comic_drama', 'heritage_promo'] as VideoType[], recommended_presentation_styles: ['voiceover_montage', 'ai_comic', 'documentary'] as PresentationStyle[], description: '适合文化宣传片、AI漫剧、非遗宣传片等' },
  { name: '节庆习俗', recommended_generation_types: ['culture_promo'], recommended_video_types: ['culture_promo', 'scene_short', 'social_short', 'children_story'] as VideoType[], recommended_presentation_styles: ['voiceover_montage', 'cinematic', 'social_media_fastcut', 'children_animation'] as PresentationStyle[], description: '适合文化宣传片、场景短片、短视频等' },
  { name: '饮食文化', recommended_generation_types: ['culture_promo'], recommended_video_types: ['culture_promo', 'explainer_video', 'social_short', 'documentary_short'] as VideoType[], recommended_presentation_styles: ['voiceover_montage', 'host_narration', 'social_media_fastcut', 'documentary'] as PresentationStyle[], description: '适合文化宣传片、知识讲解、短视频等' },
  { name: '传统工艺', recommended_generation_types: ['culture_promo'], recommended_video_types: ['heritage_promo', 'culture_promo', 'explainer_video', 'documentary_short'] as VideoType[], recommended_presentation_styles: ['documentary', 'voiceover_montage', 'host_narration', 'documentary'] as PresentationStyle[], description: '适合非遗宣传片、文化宣传片、知识讲解等' },
  { name: '名胜古迹', recommended_generation_types: ['scene_short', 'culture_promo'], recommended_video_types: ['scene_short', 'landscape_mood', 'culture_promo', 'city_brand_promo', 'documentary_short'] as VideoType[], recommended_presentation_styles: ['cinematic', 'ink_style', 'voiceover_montage', 'voiceover_montage', 'documentary'] as PresentationStyle[], description: '适合场景短片、山水意境片、文旅宣传片等' },
  { name: '地方掌故', recommended_generation_types: ['character_story', 'scene_short'], recommended_video_types: ['character_story', 'scene_short', 'lecture_video', 'documentary_short'] as VideoType[], recommended_presentation_styles: ['cinematic', 'cinematic', 'host_narration', 'documentary'] as PresentationStyle[], description: '适合人物故事、场景短片、宣讲片等' },
  { name: '宗教信仰', recommended_generation_types: ['scene_short', 'culture_promo'], recommended_video_types: ['scene_short', 'culture_promo', 'explainer_video'] as VideoType[], recommended_presentation_styles: ['cinematic', 'voiceover_montage', 'host_narration'] as PresentationStyle[], description: '适合场景短片、文化宣传片、知识讲解等' },
  { name: '民俗活动', recommended_generation_types: ['culture_promo'], recommended_video_types: ['culture_promo', 'social_short', 'children_story'] as VideoType[], recommended_presentation_styles: ['voiceover_montage', 'social_media_fastcut', 'children_animation'] as PresentationStyle[], description: '适合文化宣传片、短视频、儿童故事等' },
];

systemRouter.get('/types', (_req, res) => {
  res.json(success(TYPE_GENERATION_MAP));
});

// ---------------------------------------------------------------------------
// GET /api/system/models — curated model options for users
// ---------------------------------------------------------------------------

systemRouter.get('/models', (_req, res) => {
  const models: AIModelProfile[] = listModelProfiles();
  res.json(success(models));
});

// ---------------------------------------------------------------------------
// GET /api/system/narrative-patterns — reusable narrative pattern catalog
// ---------------------------------------------------------------------------

systemRouter.get('/narrative-patterns', (_req, res) => {
  res.json(success(getNarrativePatternCatalog()));
});

// ---------------------------------------------------------------------------
// GET /api/system/production-readiness-portfolio — cross-project production command queue
// ---------------------------------------------------------------------------

systemRouter.get('/production-readiness-portfolio', async (req, res, next) => {
  try {
    const includeArchivedSeries = req.query.includeArchivedSeries === 'true' || req.query.includeArchivedSeries === '1';
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    res.json(success(await getProductionReadinessPortfolio({ includeArchivedSeries, limit })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/system/production-readiness-portfolio/run-automation — run safe portfolio queue automation
// ---------------------------------------------------------------------------

systemRouter.post(
  '/production-readiness-portfolio/run-automation',
  validateBody(ProductionReadinessPortfolioRunRequestSchema),
  async (req, res, next) => {
    try {
      res.json(success(await runProductionReadinessPortfolioAutomation(req.body)));
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/system/story-agent-generated-health — read-only generated artifact health audit
// ---------------------------------------------------------------------------

systemRouter.get('/story-agent-generated-health', async (req, res, next) => {
  try {
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    res.json(success(await getStoryAgentGeneratedHealth({ limit })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/story-agent-generated-governance-plan — read-only generated cleanup plan
// ---------------------------------------------------------------------------

systemRouter.get('/story-agent-generated-governance-plan', async (req, res, next) => {
  try {
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    res.json(success(await getStoryAgentGeneratedGovernancePlan({ limit })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/story-agent-mvp-status — Story Agent MVP command status
// ---------------------------------------------------------------------------

systemRouter.get('/story-agent-mvp-status', async (req, res, next) => {
  try {
    const generatedLimit = typeof req.query.generatedLimit === 'string'
      ? Number(req.query.generatedLimit)
      : typeof req.query.generated_limit === 'string'
        ? Number(req.query.generated_limit)
        : undefined;
    const portfolioLimit = typeof req.query.portfolioLimit === 'string'
      ? Number(req.query.portfolioLimit)
      : typeof req.query.portfolio_limit === 'string'
        ? Number(req.query.portfolio_limit)
        : undefined;
    const includeArchivedSeries = req.query.includeArchivedSeries === 'true' || req.query.includeArchivedSeries === '1';
    res.json(success(await getStoryAgentMvpStatus({ generatedLimit, portfolioLimit, includeArchivedSeries })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-config — safe GEARS v2 execution config
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-config', (_req, res) => {
  res.json(success(getGearsExecutionConfigInfo()));
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-contract — GEARS v2 job/callback contract
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-contract', (_req, res) => {
  res.json(success(getGearsExecutionContractInfo()));
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-readiness — local GEARS contract readiness
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-readiness', (_req, res) => {
  res.json(success(getGearsExecutionReadinessReport()));
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-smoke-package — handoff package for GEARS v2
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-smoke-package', (_req, res) => {
  res.json(success(getGearsExecutionSmokePackage()));
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-pressure-report — local GEARS boundary pressure
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-pressure-report', (_req, res) => {
  res.json(success(getGearsExecutionPressureReport()));
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-generated-project-pressure — generated ledger pressure audit
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-generated-project-pressure', async (_req, res, next) => {
  try {
    res.json(success(await getGearsExecutionGeneratedProjectPressureReport()));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-acceptance-report — GEARS v2 worker acceptance
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-acceptance-report', async (_req, res, next) => {
  try {
    res.json(success(await getGearsExecutionAcceptanceReport()));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-worker-acceptance-kit — executable GEARS worker runbook
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-worker-acceptance-kit', async (_req, res, next) => {
  try {
    res.json(success(await getGearsExecutionWorkerAcceptanceKit()));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-worker-evidence-bundle — GEARS worker evidence pack
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-worker-evidence-bundle', async (_req, res, next) => {
  try {
    res.json(success(await getGearsExecutionWorkerEvidenceBundle()));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-worker-evidence-signoff — read worker smoke evidence
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-worker-evidence-signoff', async (req, res, next) => {
  try {
    const evidenceDir = typeof req.query.evidence_dir === 'string' ? req.query.evidence_dir : undefined;
    res.json(success(await getGearsExecutionWorkerEvidenceSignoffReport({ evidence_dir: evidenceDir })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/system/gears-execution-live-smoke-run — dry-run or execute GEARS v2 smoke
// ---------------------------------------------------------------------------

systemRouter.post(
  '/gears-execution-live-smoke-run',
  validateBody(GearsExecutionLiveSmokeRunRequestSchema),
  async (req, res, next) => {
    try {
      res.json(success(await runGearsExecutionLiveSmoke(req.body)));
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/system/seedance-provider-config — safe adapter config status
// ---------------------------------------------------------------------------

function envFlag(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function providerAuthHeader(kind: 'submit' | 'poll'): string {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER
    : process.env.SEEDANCE_PROVIDER_POLL_AUTH_HEADER;
  return specific?.trim()
    || process.env.SEEDANCE_PROVIDER_AUTH_HEADER?.trim()
    || 'authorization';
}

function providerAuthScheme(kind: 'submit' | 'poll'): string {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME
    : process.env.SEEDANCE_PROVIDER_POLL_AUTH_SCHEME;
  return specific?.trim()
    || process.env.SEEDANCE_PROVIDER_AUTH_SCHEME?.trim()
    || 'Bearer';
}

const SEEDANCE_PROVIDER_CALLBACK_BASE_ENVS = [
  'SEEDANCE_PROVIDER_CALLBACK_BASE_URL',
  'GEARS_CALLBACK_BASE_URL',
  'PUBLIC_API_BASE_URL',
  'APP_BASE_URL',
];

const SEEDANCE_PROVIDER_REQUEST_MODE_ENVS = [
  'SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE',
  'SEEDANCE_PROVIDER_POLL_REQUEST_MODE',
];

const SEEDANCE_PROVIDER_PAYLOAD_MODE_ENVS = [
  'SEEDANCE_PROVIDER_PAYLOAD_MODE',
  'SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE',
  'SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE',
];

const SEEDANCE_PROVIDER_SIGNATURE_ENVS = [
  'SEEDANCE_PROVIDER_SIGNATURE_SECRET',
  'SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET',
  'SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET',
];

const SEEDANCE_PROVIDER_SIGNATURE_HEADER_ENVS = [
  'SEEDANCE_PROVIDER_SIGNATURE_HEADER',
  'SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_HEADER',
  'SEEDANCE_PROVIDER_POLL_SIGNATURE_HEADER',
];

const SEEDANCE_PROVIDER_TIMESTAMP_HEADER_ENVS = [
  'SEEDANCE_PROVIDER_TIMESTAMP_HEADER',
  'SEEDANCE_PROVIDER_SUBMIT_TIMESTAMP_HEADER',
  'SEEDANCE_PROVIDER_POLL_TIMESTAMP_HEADER',
];

const SEEDANCE_PROVIDER_SUBMIT_PLATFORM_FIELD_ENVS = [
  'SEEDANCE_PROVIDER_SUBMIT_TASKS_FIELD',
  'SEEDANCE_PROVIDER_SUBMIT_PROMPT_FIELD',
  'SEEDANCE_PROVIDER_SUBMIT_DURATION_FIELD',
  'SEEDANCE_PROVIDER_SUBMIT_EXTERNAL_ID_FIELD',
  'SEEDANCE_PROVIDER_SUBMIT_CALLBACK_URL_FIELD',
  'SEEDANCE_PROVIDER_SUBMIT_POLL_URL_FIELD',
  'SEEDANCE_PROVIDER_SUBMIT_MODEL_FIELD',
  'SEEDANCE_PROVIDER_SUBMIT_ASSETS_FIELD',
  'SEEDANCE_PROVIDER_SUBMIT_NEGATIVE_PROMPT_FIELD',
  'SEEDANCE_PROVIDER_SUBMIT_METADATA_FIELD',
  'SEEDANCE_PROVIDER_MODEL',
  'SEEDANCE_PROVIDER_SUBMIT_MODEL',
];

const SEEDANCE_PROVIDER_POLL_PLATFORM_FIELD_ENVS = [
  'SEEDANCE_PROVIDER_POLL_TASK_ID_FIELD',
  'SEEDANCE_PROVIDER_POLL_TASK_IDS_FIELD',
  'SEEDANCE_PROVIDER_POLL_EXTERNAL_ID_FIELD',
  'SEEDANCE_PROVIDER_POLL_TARGETS_FIELD',
  'SEEDANCE_PROVIDER_POLL_METADATA_FIELD',
];

const SEEDANCE_PROVIDER_POLL_HTTP_METHOD_ENV = 'SEEDANCE_PROVIDER_POLL_HTTP_METHOD';

function submitRequestMode(): 'batch' | 'per_shot' {
  return process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE?.trim().toLowerCase() === 'per_shot'
    ? 'per_shot'
    : 'batch';
}

function pollRequestMode(): 'batch' | 'per_target' {
  return process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE?.trim().toLowerCase() === 'per_target'
    ? 'per_target'
    : 'batch';
}

function pollHttpMethod(): 'POST' | 'GET' {
  return process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD?.trim().toUpperCase() === 'GET'
    ? 'GET'
    : 'POST';
}

function providerPayloadMode(kind: 'submit' | 'poll'): 'story_agent' | 'platform' {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE
    : process.env.SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE;
  const value = specific?.trim() || process.env.SEEDANCE_PROVIDER_PAYLOAD_MODE?.trim();
  return value?.toLowerCase() === 'platform' ? 'platform' : 'story_agent';
}

function providerSignatureConfigured(kind: 'submit' | 'poll'): boolean {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET
    : process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET;
  return Boolean(specific?.trim() || process.env.SEEDANCE_PROVIDER_SIGNATURE_SECRET?.trim());
}

function providerSignatureHeader(kind: 'submit' | 'poll'): string {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_HEADER
    : process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_HEADER;
  return specific?.trim()
    || process.env.SEEDANCE_PROVIDER_SIGNATURE_HEADER?.trim()
    || 'X-Seedance-Signature';
}

function providerTimestampHeader(kind: 'submit' | 'poll'): string {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_TIMESTAMP_HEADER
    : process.env.SEEDANCE_PROVIDER_POLL_TIMESTAMP_HEADER;
  return specific?.trim()
    || process.env.SEEDANCE_PROVIDER_TIMESTAMP_HEADER?.trim()
    || 'X-Seedance-Timestamp';
}

systemRouter.get('/seedance-provider-config', (_req, res) => {
  const submitEndpointConfigured = envFlag('SEEDANCE_PROVIDER_SUBMIT_ENDPOINT');
  const pollEndpointConfigured = envFlag('SEEDANCE_PROVIDER_POLL_ENDPOINT');
  const submitTokenConfigured = envFlag('SEEDANCE_PROVIDER_SUBMIT_API_TOKEN');
  const sharedTokenConfigured = envFlag('SEEDANCE_PROVIDER_API_TOKEN');
  const callbackSecretConfigured = envFlag('SEEDANCE_CALLBACK_SECRET');
  const callbackBaseConfigured = SEEDANCE_PROVIDER_CALLBACK_BASE_ENVS.some(envFlag);
  const submitPayloadMode = providerPayloadMode('submit');
  const pollPayloadMode = providerPayloadMode('poll');
  const submitSignatureConfigured = providerSignatureConfigured('submit');
  const pollSignatureConfigured = providerSignatureConfigured('poll');
  const missingSubmitRequirements = submitEndpointConfigured ? [] : ['SEEDANCE_PROVIDER_SUBMIT_ENDPOINT'];
  const missingPollRequirements = pollEndpointConfigured ? [] : ['SEEDANCE_PROVIDER_POLL_ENDPOINT'];
  const configurationWarnings = [
    ...(!submitTokenConfigured && !sharedTokenConfigured
      ? ['submit adapter 未配置 bearer token；仅适用于不要求鉴权的外部 worker。']
      : []),
    ...(!sharedTokenConfigured
      ? ['poll adapter 未配置 SEEDANCE_PROVIDER_API_TOKEN；仅适用于不要求鉴权的外部 worker。']
      : []),
    ...(submitPayloadMode === 'platform' && !submitSignatureConfigured
      ? ['submit adapter 已启用 platform payload，但未配置签名密钥；仅适用于不要求请求签名的平台。']
      : []),
    ...(pollPayloadMode === 'platform' && !pollSignatureConfigured
      ? ['poll adapter 已启用 platform payload，但未配置签名密钥；仅适用于不要求请求签名的平台。']
      : []),
  ];
  const nextActions = [
    ...(submitEndpointConfigured ? [] : ['配置 SEEDANCE_PROVIDER_SUBMIT_ENDPOINT 以启用提交 adapter。']),
    ...(pollEndpointConfigured ? [] : ['配置 SEEDANCE_PROVIDER_POLL_ENDPOINT 以启用轮询 adapter。']),
    ...(submitEndpointConfigured && pollEndpointConfigured
      ? ['adapter endpoint 已就绪，可执行提交或轮询 smoke。']
      : []),
  ];
  const config: SeedanceProviderAdapterConfigInfo = {
    provider: 'seedance',
    submit_endpoint_configured: submitEndpointConfigured,
    poll_endpoint_configured: pollEndpointConfigured,
    submit_token_configured: submitTokenConfigured,
    poll_token_configured: sharedTokenConfigured,
    shared_token_configured: sharedTokenConfigured,
    submit_signature_configured: submitSignatureConfigured,
    poll_signature_configured: pollSignatureConfigured,
    callback_secret_configured: callbackSecretConfigured,
    callback_base_configured: callbackBaseConfigured,
    callback_base_envs: SEEDANCE_PROVIDER_CALLBACK_BASE_ENVS,
    submit_request_mode: submitRequestMode(),
    poll_request_mode: pollRequestMode(),
    request_mode_envs: SEEDANCE_PROVIDER_REQUEST_MODE_ENVS,
    submit_payload_mode: submitPayloadMode,
    poll_payload_mode: pollPayloadMode,
    payload_mode_envs: SEEDANCE_PROVIDER_PAYLOAD_MODE_ENVS,
    poll_http_method: pollHttpMethod(),
    poll_http_method_env: SEEDANCE_PROVIDER_POLL_HTTP_METHOD_ENV,
    submit_auth_header: providerAuthHeader('submit'),
    poll_auth_header: providerAuthHeader('poll'),
    submit_auth_scheme: providerAuthScheme('submit'),
    poll_auth_scheme: providerAuthScheme('poll'),
    submit_signature_header: providerSignatureHeader('submit'),
    poll_signature_header: providerSignatureHeader('poll'),
    submit_timestamp_header: providerTimestampHeader('submit'),
    poll_timestamp_header: providerTimestampHeader('poll'),
    submit_timeout_ms: envNumber('SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS', 30000),
    poll_timeout_ms: envNumber('SEEDANCE_PROVIDER_POLL_TIMEOUT_MS', 30000),
    ready_for_submit_adapter: submitEndpointConfigured,
    ready_for_poll_adapter: pollEndpointConfigured,
    missing_submit_requirements: missingSubmitRequirements,
    missing_poll_requirements: missingPollRequirements,
    configuration_warnings: configurationWarnings,
    next_actions: nextActions,
    generated_at: new Date().toISOString(),
  };
  res.json(success(config));
});

// ---------------------------------------------------------------------------
// GET /api/system/seedance-provider-adapter-contract — safe worker contract
// ---------------------------------------------------------------------------

systemRouter.get('/seedance-provider-adapter-contract', (_req, res) => {
  const contract: SeedanceProviderAdapterContractInfo = {
    provider: 'seedance',
    callback_auth_env: 'SEEDANCE_CALLBACK_SECRET',
    callback_auth_headers: [
      'Authorization: Bearer <SECRET>',
      'X-Seedance-Callback-Secret: <SECRET>',
    ],
    submit: {
      schema_version: 'seedance-provider-submit/v1',
      endpoint_env: 'SEEDANCE_PROVIDER_SUBMIT_ENDPOINT',
      auth_envs: ['SEEDANCE_PROVIDER_SUBMIT_API_TOKEN', 'SEEDANCE_PROVIDER_API_TOKEN'],
      auth_header_envs: ['SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER', 'SEEDANCE_PROVIDER_AUTH_HEADER'],
      auth_scheme_envs: ['SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME', 'SEEDANCE_PROVIDER_AUTH_SCHEME'],
      default_auth_header: 'Authorization',
      default_auth_scheme: 'Bearer',
      timeout_env: 'SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS',
      request_mode_env: 'SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE',
      request_modes: ['batch', 'per_shot'],
      payload_mode_env: 'SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE',
      payload_modes: ['story_agent', 'platform'],
      signature_envs: SEEDANCE_PROVIDER_SIGNATURE_ENVS,
      signature_header_envs: SEEDANCE_PROVIDER_SIGNATURE_HEADER_ENVS,
      timestamp_header_envs: SEEDANCE_PROVIDER_TIMESTAMP_HEADER_ENVS,
      default_signature_header: 'X-Seedance-Signature',
      default_timestamp_header: 'X-Seedance-Timestamp',
      signature_base: 'METHOD\\nURL\\nTIMESTAMP\\nJSON_BODY',
      platform_field_envs: SEEDANCE_PROVIDER_SUBMIT_PLATFORM_FIELD_ENVS,
      request_fields: [
        'schema_version',
        'request_mode',
        'project_id',
        'storyId',
        'title',
        'provider',
        'queue_id',
        'queue_priority',
        'provider_callback_path',
        'provider_poll_path',
        'provider_callback_url',
        'provider_poll_url',
        'note',
        'seedance_asset_library',
        'shot',
        'shots[]',
        'shots[].shot_id',
        'shots[].source_scene_id',
        'shots[].provider_job_id',
        'shots[].provider_queue_position',
        'shots[].duration_sec',
        'shots[].seedance_prompt',
        'shots[].seedance_asset_slots',
        'shots[].seedance_material_validation',
        'shots[].seedance_validation_notes',
        'shots[].negative_constraints',
        'platform mode: tasks[]',
        'platform mode: prompt',
        'platform mode: duration',
        'platform mode: external_id',
        'platform mode: callback_url',
        'platform mode: metadata',
      ],
      accepted_response_shapes: [
        'top-level array',
        '{ submitted_shots: [...] }',
        '{ provider_results: [...] }',
        '{ results: [...] }',
        '{ items: [...] }',
        '{ tasks: [...] }',
        '{ data: [...] }',
        '{ data: { tasks: [...] } }',
      ],
      normalized_result_fields: [
        'shot_id | external_id | externalId | custom_id | customId',
        'provider_job_id | job_id | jobId | task_id | taskId | request_id | requestId | id',
        'provider_queue_id | queue_id | queueId | batch_id | batchId',
        'provider_queue_position | queue_position | queuePosition | position',
        'status | task_status | taskStatus | state | phase',
      ],
      request_example: {
        schema_version: 'seedance-provider-submit/v1',
        request_mode: 'batch',
        project_id: '20260618-story-demo--ai_comic_drama',
        storyId: '20260618-story-demo',
        title: '示例故事',
        provider: 'seedance',
        queue_id: 'seedance-queue-demo-001',
        queue_priority: 'normal',
        provider_callback_path: '/api/projects/20260618-story-demo--ai_comic_drama/production-board/seedance-shots/provider-callback',
        provider_poll_path: '/api/projects/20260618-story-demo--ai_comic_drama/production-board/seedance-shots/poll-provider',
        provider_callback_url: '<PUBLIC_API_BASE_URL>/api/projects/20260618-story-demo--ai_comic_drama/production-board/seedance-shots/provider-callback',
        provider_poll_url: '<PUBLIC_API_BASE_URL>/api/projects/20260618-story-demo--ai_comic_drama/production-board/seedance-shots/poll-provider',
        note: 'adapter submit smoke',
        seedance_asset_library: {
          schema_version: 'seedance-asset-library/v1',
          items: [],
        },
        shots: [{
          shot_id: 'shot-1',
          source_scene_id: 1,
          provider_job_id: 'local-seedance-job-shot-1',
          provider_queue_position: 1,
          duration_sec: 12,
          seedance_prompt: '0-3秒：少年站在祠堂门口。3-7秒：风吹动族谱。7-12秒：他抬头望向光。风格：AI漫画短剧。',
          seedance_asset_slots: [],
          seedance_material_validation: {
            asset_count: 0,
            max_asset_count: 6,
            issues: [],
          },
          seedance_validation_notes: [],
          negative_constraints: ['不要现代服饰'],
        }],
      },
      response_examples: [{
        data: {
          tasks: [{
            shot_id: 'shot-1',
            taskId: 'real-seedance-job-001',
            batchId: 'real-seedance-queue-001',
            position: 1,
            taskStatus: 'queued',
          }],
        },
      }, {
        platform_payload_mode: {
          tasks: [{
            prompt: '0-3秒：少年站在祠堂门口。3-7秒：风吹动族谱。7-12秒：他抬头望向光。风格：AI漫画短剧。',
            duration: 12,
            external_id: 'shot-1',
            callback_url: '<PUBLIC_API_BASE_URL>/api/projects/20260618-story-demo--ai_comic_drama/production-board/seedance-shots/provider-callback',
            negative_prompt: '不要现代服饰',
            metadata: {
              project_id: '20260618-story-demo--ai_comic_drama',
              shot_id: 'shot-1',
              local_provider_job_id: 'local-seedance-job-shot-1',
            },
          }],
          metadata: {
            schema_version: 'seedance-provider-platform-submit/v1',
            project_id: '20260618-story-demo--ai_comic_drama',
          },
        },
      }],
      notes: [
        'Each accepted result must include a shot_id and provider job id.',
        'Returned queue id/position override local placeholders when present.',
        'When callback auth is configured, provider_callback_path requires one callback auth header.',
        'When a public callback base URL is configured, submit payload also includes provider_callback_url and provider_poll_url.',
        'Set SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE=per_shot when a platform endpoint accepts one shot/task per request.',
        'Set SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE=platform when the platform endpoint expects prompt/duration/external_id style fields instead of the Story Agent contract.',
        'Set SEEDANCE_PROVIDER_SIGNATURE_SECRET or SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET to add HMAC request signature headers.',
        'Set auth scheme to raw/none/no_scheme when a worker expects the token without a prefix.',
      ],
    },
    poll: {
      schema_version: 'seedance-provider-poll/v1',
      endpoint_env: 'SEEDANCE_PROVIDER_POLL_ENDPOINT',
      auth_envs: ['SEEDANCE_PROVIDER_API_TOKEN'],
      auth_header_envs: ['SEEDANCE_PROVIDER_POLL_AUTH_HEADER', 'SEEDANCE_PROVIDER_AUTH_HEADER'],
      auth_scheme_envs: ['SEEDANCE_PROVIDER_POLL_AUTH_SCHEME', 'SEEDANCE_PROVIDER_AUTH_SCHEME'],
      default_auth_header: 'Authorization',
      default_auth_scheme: 'Bearer',
      timeout_env: 'SEEDANCE_PROVIDER_POLL_TIMEOUT_MS',
      request_mode_env: 'SEEDANCE_PROVIDER_POLL_REQUEST_MODE',
      request_modes: ['batch', 'per_target'],
      payload_mode_env: 'SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE',
      payload_modes: ['story_agent', 'platform'],
      signature_envs: SEEDANCE_PROVIDER_SIGNATURE_ENVS,
      signature_header_envs: SEEDANCE_PROVIDER_SIGNATURE_HEADER_ENVS,
      timestamp_header_envs: SEEDANCE_PROVIDER_TIMESTAMP_HEADER_ENVS,
      default_signature_header: 'X-Seedance-Signature',
      default_timestamp_header: 'X-Seedance-Timestamp',
      signature_base: 'METHOD\\nURL\\nTIMESTAMP\\nJSON_BODY',
      platform_field_envs: SEEDANCE_PROVIDER_POLL_PLATFORM_FIELD_ENVS,
      http_method_env: SEEDANCE_PROVIDER_POLL_HTTP_METHOD_ENV,
      http_methods: ['POST', 'GET'],
      endpoint_template_fields: [
        '{project_id}',
        '{projectId}',
        '{provider}',
        '{queue_id}',
        '{queueId}',
        '{shot_id}',
        '{shotId}',
        '{provider_job_id}',
        '{providerJobId}',
        '{job_id}',
        '{jobId}',
        '{provider_queue_id}',
        '{providerQueueId}',
      ],
      request_fields: [
        'schema_version',
        'request_mode',
        'project_id',
        'provider',
        'queue_id',
        'note',
        'target',
        'targets[]',
        'targets[].shot_id',
        'targets[].provider_job_id',
        'targets[].provider_queue_id',
        'targets[].provider_queue_position',
        'targets[].status',
        'targets[].seedance_prompt',
        'platform mode: task_id',
        'platform mode: task_ids',
        'platform mode: external_id',
        'platform mode: metadata',
      ],
      accepted_response_shapes: [
        'top-level array',
        '{ provider_results: [...] }',
        '{ results: [...] }',
        '{ items: [...] }',
        '{ tasks: [...] }',
        '{ data: [...] }',
        '{ data: { tasks: [...] } }',
      ],
      normalized_result_fields: [
        'shot_id | external_id | externalId | custom_id | customId',
        'provider_job_id | job_id | jobId | task_id | taskId | request_id | requestId | id',
        'provider_queue_id | queue_id | queueId | batch_id | batchId',
        'status | task_status | taskStatus | state | phase',
        'video_url | videoUrl | output_url | outputUrl | file_url | fileUrl | download_url | downloadUrl | result_url | resultUrl | url',
        'failure_reason | failureReason | error_message | errorMessage | reason | error | message | msg',
        'failure_category',
        'provider_error_code | providerErrorCode | error_code | errorCode | status_code | statusCode | code',
        'quality_score | qualityScore | score | quality',
        'review_note | reviewNote',
      ],
      request_example: {
        schema_version: 'seedance-provider-poll/v1',
        request_mode: 'batch',
        project_id: '20260618-story-demo--ai_comic_drama',
        provider: 'seedance',
        queue_id: 'real-seedance-queue-001',
        note: 'adapter poll smoke',
        targets: [{
          shot_id: 'shot-1',
          provider_job_id: 'real-seedance-job-001',
          provider_queue_id: 'real-seedance-queue-001',
          provider_queue_position: 1,
          status: 'submitted',
          seedance_prompt: '0-3秒：少年站在祠堂门口。3-7秒：风吹动族谱。7-12秒：他抬头望向光。风格：AI漫画短剧。',
        }],
      },
      response_examples: [{
        data: {
          tasks: [{
            taskId: 'real-seedance-job-001',
            state: 'SUCCEEDED',
            outputUrl: 'seedance-video-shot-1.mp4',
            score: 92,
            reviewNote: '画面可用',
          }, {
            taskId: 'real-seedance-job-002',
            state: 'FAILED',
            errorMessage: '内容审核未通过',
            code: 'RISK_CONTROL',
          }],
        },
      }, {
        platform_payload_mode: {
          task_ids: ['real-seedance-job-001', 'real-seedance-job-002'],
          targets: [{
            task_id: 'real-seedance-job-001',
            external_id: 'shot-1',
            metadata: {
              project_id: '20260618-story-demo--ai_comic_drama',
              shot_id: 'shot-1',
            },
          }],
          metadata: {
            schema_version: 'seedance-provider-platform-poll/v1',
            project_id: '20260618-story-demo--ai_comic_drama',
          },
        },
      }],
      notes: [
        'Poll results are normalized through the provider callback path.',
        'Failed results can carry failure_category/provider_error_code for retry planning.',
        'Set SEEDANCE_PROVIDER_POLL_REQUEST_MODE=per_target when a platform endpoint queries one provider job per request.',
        'When SEEDANCE_PROVIDER_POLL_HTTP_METHOD=GET, the endpoint can use template fields such as {provider_job_id} and no JSON body is sent.',
        'Set SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE=platform when the platform query endpoint expects task_id/task_ids style fields instead of the Story Agent contract.',
        'Set SEEDANCE_PROVIDER_SIGNATURE_SECRET or SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET to add HMAC request signature headers.',
      ],
    },
    generated_at: new Date().toISOString(),
  };
  res.json(success(contract));
});

// ---------------------------------------------------------------------------
// GET /api/system/regions — list distinct regions for a province
// ---------------------------------------------------------------------------

systemRouter.get('/regions', async (req, res, next) => {
  try {
    const province = req.query.province as string | undefined;
    if (!province) {
      res.json(success([]));
      return;
    }

    const provinceFiles = await mcpReadAllProvinceFiles();
    const content = provinceFiles.get(province);
    if (!content) {
      res.json(success([]));
      return;
    }

    const entries = mcpParseEntries(content, province);
    const regions = new Set<string>();
    for (const entry of entries) {
      if (entry.region) regions.add(entry.region);
    }

    res.json(success([...regions].sort((a, b) => a.localeCompare(b, 'zh-CN'))));
  } catch (err) {
    next(err);
  }
});
