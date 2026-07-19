import { afterEach, describe, expect, it } from 'vitest';
import { StoryGenerateRequestSchema } from '@shared/schemas.js';
import { getStoryGenerationCapabilities } from '../services/story-generation-capability-service.js';

const originalCommand = process.env.STORY_GEN_COMMAND;
const originalProvider = process.env.STORY_GEN_PROVIDER;
const originalSceneCommand = process.env.SCENE_REGEN_COMMAND;
const originalSceneProvider = process.env.SCENE_REGEN_PROVIDER;

afterEach(() => {
  if (originalCommand === undefined) delete process.env.STORY_GEN_COMMAND;
  else process.env.STORY_GEN_COMMAND = originalCommand;
  if (originalProvider === undefined) delete process.env.STORY_GEN_PROVIDER;
  else process.env.STORY_GEN_PROVIDER = originalProvider;
  if (originalSceneCommand === undefined) delete process.env.SCENE_REGEN_COMMAND;
  else process.env.SCENE_REGEN_COMMAND = originalSceneCommand;
  if (originalSceneProvider === undefined) delete process.env.SCENE_REGEN_PROVIDER;
  else process.env.SCENE_REGEN_PROVIDER = originalSceneProvider;
});

describe('story generation capabilities', () => {
  it('advertises only the explicit local engine when no external adapter is configured', () => {
    delete process.env.STORY_GEN_COMMAND;
    delete process.env.STORY_GEN_PROVIDER;
    delete process.env.SCENE_REGEN_COMMAND;
    delete process.env.SCENE_REGEN_PROVIDER;

    const capabilities = getStoryGenerationCapabilities();

    expect(capabilities).toMatchObject({
      schema_version: 'story-generation-capabilities/v1',
      default_model_profile_id: 'local_story_engine',
      effective_default_engine: 'local_only',
      external_adapter: {
        provider: 'command_json',
        command_configured: false,
        ready: false,
        external_data_transfer_possible: false,
        actual_cost_known_before_execution: false,
      },
      scene_regeneration_adapter: {
        provider: 'command_json',
        command_configured: false,
        ready: false,
      },
    });
    expect(capabilities.model_profiles.find(item => item.id === 'local_story_engine')).toMatchObject({
      available: true,
      effective_engine: 'local_only',
      external_call_possible: false,
      scene_regeneration_available: true,
      scene_regeneration_external_call_possible: false,
    });
    expect(capabilities.model_profiles.find(item => item.id === 'claude_sonnet')).toMatchObject({
      available: false,
      effective_engine: 'unavailable',
      external_call_possible: false,
      scene_regeneration_available: false,
      scene_regeneration_external_call_possible: false,
    });
  });

  it('reports scene-regeneration adapter availability independently from full generation', () => {
    delete process.env.STORY_GEN_COMMAND;
    delete process.env.STORY_GEN_PROVIDER;
    process.env.SCENE_REGEN_COMMAND = '/opt/story-agent/scene-bridge';
    process.env.SCENE_REGEN_PROVIDER = 'command_json';

    const capabilities = getStoryGenerationCapabilities();

    expect(capabilities.external_adapter.ready).toBe(false);
    expect(capabilities.scene_regeneration_adapter).toMatchObject({
      provider: 'command_json',
      provider_supported: true,
      command_configured: true,
      ready: true,
      external_data_transfer_possible: true,
    });
    expect(capabilities.model_profiles.find(item => item.id === 'claude_sonnet')).toMatchObject({
      available: false,
      scene_regeneration_available: true,
      scene_regeneration_external_call_possible: true,
    });
  });

  it('exposes configured external profiles without claiming verified cost or execution', () => {
    process.env.STORY_GEN_COMMAND = '/opt/story-agent/bridge';
    process.env.STORY_GEN_PROVIDER = 'command_json';

    const capabilities = getStoryGenerationCapabilities();

    expect(capabilities).toMatchObject({
      default_model_profile_id: 'claude_sonnet',
      effective_default_engine: 'external_model',
      external_adapter: {
        command_configured: true,
        provider_supported: true,
        ready: true,
        external_data_transfer_possible: true,
        actual_cost_known_before_execution: false,
      },
    });
    expect(capabilities.model_profiles.find(item => item.id === 'claude_sonnet')).toMatchObject({
      available: true,
      effective_engine: 'external_model',
      external_call_possible: true,
    });
    expect(capabilities.real_external_generation_performed).toBe(false);
  });

  it('strictly rejects unknown model profile ids at the shared request boundary', () => {
    const parsed = StoryGenerateRequestSchema.safeParse({
      entry_name: '屈原投江汨罗——端午节起源',
      video_type: 'historical_drama',
      model_profile_id: 'not-a-real-model',
    });

    expect(parsed.success).toBe(false);
  });
});
