import { describe, expect, it } from 'vitest';
import type {
  AiComicSeriesPlan,
  AiComicSeriesVisualBible,
  AiComicSeriesVisualIdentity,
} from '@shared/types.js';
import { buildGearsCharacterAssetBootstrapEnvelope } from '../services/ai-comic-series-gears-character-assets-service.js';

function approvedIdentity(
  overrides: Partial<AiComicSeriesVisualIdentity>,
): AiComicSeriesVisualIdentity {
  return {
    identity_id: 'identity-fixture',
    kind: 'character',
    label: '沈砚',
    canonical_description: '调查午夜皮影规则的主角',
    source: 'plan_character',
    source_episode_nos: [1],
    pilot_episode_nos: [1],
    continuity_constraints: [],
    negative_constraints: [],
    source_fingerprint: `sha256:${'a'.repeat(64)}`,
    definition_fingerprint: `sha256:${'b'.repeat(64)}`,
    definition_fields: [],
    definition_notes: '永久识别锚点保持一致',
    approval: {
      status: 'approved',
      reviewer_id: 'human-reviewer',
      human_confirmed: true,
    },
    missing_definition_fields: [],
    definition_status: 'ready',
    production_credit: false,
    ...overrides,
  };
}

describe('AI comic series GEARS character asset bootstrap', () => {
  it('combines approved character and costume identities without granting production credit', () => {
    const character = approvedIdentity({
      definition_fields: [
        { field_id: 'age_range', label: '年龄', value: '29—33岁', required: true },
        { field_id: 'body_type', label: '体态', value: '修长结实', required: true },
        { field_id: 'facial_features', label: '脸部', value: '右侧下颌旧疤', required: true },
        { field_id: 'hairstyle', label: '发型', value: '黑色短发', required: true },
        { field_id: 'gender_pronouns', label: '性别', value: '男/他', required: true },
      ],
    });
    const costume = approvedIdentity({
      identity_id: 'costume-fixture',
      kind: 'costume',
      label: '沈砚主服装',
      parent_identity_id: character.identity_id,
      source: 'derived_costume',
      definition_fields: [
        { field_id: 'garment_details', label: '服装', value: '石灰卡其中长夹克', required: true },
        { field_id: 'color_palette', label: '色彩', value: '深靛蓝内搭', required: true },
        { field_id: 'phase_changes', label: '变化', value: '可增加灰尘', required: true },
      ],
    });
    const plan = {
      main_characters: [{ name: '沈砚', role: '主角' }],
    } as unknown as AiComicSeriesPlan;
    const visualBible = {
      source_fingerprint: `sha256:${'d'.repeat(64)}`,
      identities: [character, costume],
    } as unknown as AiComicSeriesVisualBible;

    const envelope = buildGearsCharacterAssetBootstrapEnvelope(
      'series-fixture',
      plan,
      visualBible,
    );

    expect(envelope).toMatchObject({
      schema_version: 'story-agent-character-asset-bootstrap/v1',
      generation_mode: 'local_test',
      character_style_pack_id: 'realistic',
      characters: [{
        identity_id: character.identity_id,
        role_position: '主角',
        gender: '男',
        age_range: '青年',
      }],
    });
    expect(envelope.characters[0].appearance_features).toContain('右侧下颌旧疤');
    expect(envelope.characters[0].clothing).toContain('石灰卡其中长夹克');
  });
});
