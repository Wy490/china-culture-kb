import { describe, expect, it } from 'vitest';
import type { GearsExecutionSubmitUnit } from '../services/gears-execution-service.js';
import {
  attachGearsProviderAssetHandoffs,
  type GearsProviderAssetSource,
} from '../services/gears-provider-asset-handoff-service.js';

const SHA256 = 'a'.repeat(64);

function unit(): GearsExecutionSubmitUnit {
  return {
    source_unit_id: 'shot-1',
    local_gears_job_id: 'local-shot-1',
    payload: {
      asset_slots: [{
        asset_id: 'character-zhou',
        label: '周敦颐',
        modality: 'image',
        reference_slot: 'character_1',
        required: true,
      }],
    },
  };
}

function approvedAsset(overrides: Partial<GearsProviderAssetSource> = {}): GearsProviderAssetSource {
  return {
    asset_id: 'character-zhou',
    label: '周敦颐',
    modality: 'image',
    content_sha256: SHA256,
    rights_status: 'authorized',
    authorization_reference: 'contract://characters/zhou',
    human_review_status: 'approved',
    reviewer_id: 'reviewer-001',
    reviewed_at: '2026-07-19T10:00:00.000Z',
    production_credit_granted: true,
    ...overrides,
  };
}

describe('GEARS provider asset handoff', () => {
  it('accepts public HTTPS inputs while keeping signed query parameters out of the audit record', () => {
    const result = attachGearsProviderAssetHandoffs({
      units: [unit()],
      assets: [approvedAsset({
        file_url: 'https://assets.culture-production.cn/zhou.png?signature=secret&expires=9999999999',
      })],
      verified_at: '2026-07-19T11:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provider_asset_input_count).toBe(1);
    expect(result.units[0]?.payload.provider_asset_inputs).toEqual([
      expect.objectContaining({
        asset_id: 'character-zhou',
        transport: expect.objectContaining({
          kind: 'https_url',
          url: expect.stringContaining('signature=secret'),
        }),
      }),
    ]);
    expect(result.units[0]?.provider_asset_handoffs).toEqual([
      expect.objectContaining({
        url_origin: 'https://assets.culture-production.cn',
        transport_kind: 'https_url',
      }),
    ]);
    expect(JSON.stringify(result.units[0]?.provider_asset_handoffs)).not.toContain('signature=secret');
  });

  it.each([
    'http://assets.culture-production.cn/zhou.png',
    'https://localhost/zhou.png',
    'https://127.0.0.1/zhou.png',
    'https://192.168.1.5/zhou.png',
    'https://assets.example.com/placeholder.png',
    '/generated/local/zhou.png',
  ])('rejects non-public or placeholder URL %s', fileUrl => {
    const result = attachGearsProviderAssetHandoffs({
      units: [unit()],
      assets: [approvedAsset({ file_url: fileUrl })],
      verified_at: '2026-07-19T11:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.details.missing_asset_ids).toEqual(['character-zhou']);
    expect(result.details.issues[0]?.reason).toContain('no public HTTPS URL');
  });

  it('rejects local file IDs but accepts a non-local provider asset ID', () => {
    const local = attachGearsProviderAssetHandoffs({
      units: [unit()],
      assets: [approvedAsset({ provider: 'local_upload', provider_asset_id: `media-${SHA256}` })],
      verified_at: '2026-07-19T11:00:00.000Z',
    });
    expect(local.ok).toBe(false);

    const provider = attachGearsProviderAssetHandoffs({
      units: [unit()],
      assets: [approvedAsset({ provider: 'seedance', provider_asset_id: 'file_prod_zhou_001' })],
      verified_at: '2026-07-19T11:00:00.000Z',
    });
    expect(provider.ok).toBe(true);
    if (!provider.ok) return;
    expect(provider.units[0]?.payload.provider_asset_inputs).toEqual([
      expect.objectContaining({
        transport: {
          kind: 'provider_asset',
          provider: 'seedance',
          provider_asset_id: 'file_prod_zhou_001',
        },
      }),
    ]);
  });

  it('fails closed when integrity, rights, or human review production credit is missing', () => {
    const result = attachGearsProviderAssetHandoffs({
      units: [unit()],
      assets: [approvedAsset({
        file_url: 'https://assets.culture-production.cn/zhou.png',
        production_credit_granted: false,
      })],
      verified_at: '2026-07-19T11:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.details.issues[0]?.reason).toContain('verified immutable bytes');
  });
});
