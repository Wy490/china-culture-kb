import type { StoryGenerationCapabilities } from '@shared/types.js';
import { getRecommendedModelProfile, listModelProfiles } from './model-catalog.js';

export function getStoryGenerationCapabilities(): StoryGenerationCapabilities {
  const provider = process.env.STORY_GEN_PROVIDER?.trim() || 'command_json';
  const commandProvider = provider === 'command_json';
  const replayProvider = provider === 'record_replay_json';
  const providerSupported = commandProvider || replayProvider;
  const commandConfigured = Boolean(process.env.STORY_GEN_COMMAND?.trim());
  const replayFixtureConfigured = Boolean(
    process.env.STORY_GEN_RECORD_REPLAY_FIXTURE_PATH?.trim(),
  );
  const externalReady = commandProvider
    ? commandConfigured
    : replayProvider && replayFixtureConfigured;
  const liveExternalCallPossible = commandProvider && externalReady;
  const sceneProvider = process.env.SCENE_REGEN_PROVIDER?.trim() || 'command_json';
  const sceneProviderSupported = sceneProvider === 'command_json';
  const sceneCommandConfigured = Boolean(process.env.SCENE_REGEN_COMMAND?.trim());
  const sceneExternalReady = sceneProviderSupported && sceneCommandConfigured;
  const profiles = listModelProfiles().map(profile => {
    const local = profile.runtime === 'local';
    return {
      ...profile,
      available: local || externalReady,
      effective_engine: local
        ? 'local_only' as const
        : externalReady ? 'external_model' as const : 'unavailable' as const,
      external_call_possible: !local && liveExternalCallPossible,
      unavailable_reason: local || externalReady
        ? undefined
        : !providerSupported
          ? `STORY_GEN_PROVIDER "${provider}" is not supported`
          : replayProvider
            ? 'STORY_GEN_RECORD_REPLAY_FIXTURE_PATH is not configured'
            : 'STORY_GEN_COMMAND is not configured',
      scene_regeneration_available: local || sceneExternalReady,
      scene_regeneration_external_call_possible: !local && sceneExternalReady,
      scene_regeneration_unavailable_reason: local || sceneExternalReady
        ? undefined
        : !sceneProviderSupported
          ? `SCENE_REGEN_PROVIDER "${sceneProvider}" is not supported`
          : 'SCENE_REGEN_COMMAND is not configured',
    };
  });
  const defaultProfileId = externalReady
    ? getRecommendedModelProfile().id
    : 'local_story_engine';

  return {
    schema_version: 'story-generation-capabilities/v1',
    default_model_profile_id: defaultProfileId,
    effective_default_engine: externalReady ? 'external_model' : 'local_only',
    model_profiles: profiles,
    external_adapter: {
      provider,
      provider_supported: providerSupported,
      command_configured: commandConfigured,
      record_replay_fixture_configured: replayFixtureConfigured,
      ready: externalReady,
      execution_mode: liveExternalCallPossible
        ? 'live_external_command'
        : replayProvider && externalReady
          ? 'record_replay_fixture'
          : 'unavailable',
      external_data_transfer_possible: liveExternalCallPossible,
      actual_cost_known_before_execution: false,
      cost_boundary: 'not_reported_by_story_generation_adapter',
      authorization_boundary: liveExternalCallPossible
        ? '选择外部 profile 可能将 prompt 与素材交给配置的 command adapter；该 adapter 当前不回报预估或实际费用。'
        : replayProvider && externalReady
          ? '当前使用完整性校验后的本地录制包回放，不调用外部模型、不传输素材，也不授予真实外部模型执行信用。'
          : '当前只使用本地故事引擎，不发生外部模型数据传输。',
    },
    scene_regeneration_adapter: {
      provider: sceneProvider,
      provider_supported: sceneProviderSupported,
      command_configured: sceneCommandConfigured,
      ready: sceneExternalReady,
      external_data_transfer_possible: sceneExternalReady,
      actual_cost_known_before_execution: false,
      cost_boundary: 'not_reported_by_scene_regeneration_adapter',
      authorization_boundary: sceneExternalReady
        ? '选择外部 profile 可能将目标场景与故事上下文交给配置的 scene command adapter；该 adapter 当前不回报预估或实际费用。'
        : '当前场景重写使用本地引擎，不发生外部模型数据传输。',
    },
    request_contract: {
      schema: 'StoryGenerateRequestSchema',
      unknown_model_profile_rejected: true,
      omitted_model_profile_uses_local_engine: true,
    },
    real_external_generation_performed: false,
    notes: [
      '该端点只报告配置能力，不执行故事生成或外部调用。',
      '外部 adapter 显示 ready 只代表配置完整，不代表已产生真实模型成果或费用凭证。',
      'record_replay_json 只表示离线回放路径可用，不等于真实外部模型调用。',
    ],
  };
}
