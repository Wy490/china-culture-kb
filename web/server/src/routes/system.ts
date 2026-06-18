// web/server/src/routes/system.ts — System info routes (provinces, types)

import { Router } from 'express';
import { mcpReadAllProvinceFiles, mcpParseEntries } from '../services/mcp-proxy.js';
import { success } from '@shared/types.js';
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

systemRouter.get('/seedance-provider-config', (_req, res) => {
  const submitEndpointConfigured = envFlag('SEEDANCE_PROVIDER_SUBMIT_ENDPOINT');
  const pollEndpointConfigured = envFlag('SEEDANCE_PROVIDER_POLL_ENDPOINT');
  const submitTokenConfigured = envFlag('SEEDANCE_PROVIDER_SUBMIT_API_TOKEN');
  const sharedTokenConfigured = envFlag('SEEDANCE_PROVIDER_API_TOKEN');
  const callbackSecretConfigured = envFlag('SEEDANCE_CALLBACK_SECRET');
  const callbackBaseConfigured = SEEDANCE_PROVIDER_CALLBACK_BASE_ENVS.some(envFlag);
  const missingSubmitRequirements = submitEndpointConfigured ? [] : ['SEEDANCE_PROVIDER_SUBMIT_ENDPOINT'];
  const missingPollRequirements = pollEndpointConfigured ? [] : ['SEEDANCE_PROVIDER_POLL_ENDPOINT'];
  const configurationWarnings = [
    ...(!submitTokenConfigured && !sharedTokenConfigured
      ? ['submit adapter 未配置 bearer token；仅适用于不要求鉴权的外部 worker。']
      : []),
    ...(!sharedTokenConfigured
      ? ['poll adapter 未配置 SEEDANCE_PROVIDER_API_TOKEN；仅适用于不要求鉴权的外部 worker。']
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
    callback_secret_configured: callbackSecretConfigured,
    callback_base_configured: callbackBaseConfigured,
    callback_base_envs: SEEDANCE_PROVIDER_CALLBACK_BASE_ENVS,
    submit_auth_header: providerAuthHeader('submit'),
    poll_auth_header: providerAuthHeader('poll'),
    submit_auth_scheme: providerAuthScheme('submit'),
    poll_auth_scheme: providerAuthScheme('poll'),
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
      request_fields: [
        'schema_version',
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
        'shot_id',
        'provider_job_id | job_id | jobId | task_id | taskId | request_id | requestId | id',
        'provider_queue_id | queue_id | queueId | batch_id | batchId',
        'provider_queue_position | queue_position | queuePosition | position',
        'status | task_status | taskStatus | state | phase',
      ],
      request_example: {
        schema_version: 'seedance-provider-submit/v1',
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
      }],
      notes: [
        'Each accepted result must include a shot_id and provider job id.',
        'Returned queue id/position override local placeholders when present.',
        'When callback auth is configured, provider_callback_path requires one callback auth header.',
        'When a public callback base URL is configured, submit payload also includes provider_callback_url and provider_poll_url.',
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
      request_fields: [
        'schema_version',
        'project_id',
        'provider',
        'queue_id',
        'note',
        'targets[]',
        'targets[].shot_id',
        'targets[].provider_job_id',
        'targets[].provider_queue_id',
        'targets[].provider_queue_position',
        'targets[].status',
        'targets[].seedance_prompt',
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
      }],
      notes: [
        'Poll results are normalized through the provider callback path.',
        'Failed results can carry failure_category/provider_error_code for retry planning.',
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
