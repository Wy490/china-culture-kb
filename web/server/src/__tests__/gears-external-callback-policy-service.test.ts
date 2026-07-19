import { describe, expect, it } from 'vitest';
import type { GearsJobLedger, GearsJobLedgerItem } from '@shared/types.js';
import { normalizeGearsJobCallback } from '../services/gears-execution-service.js';
import {
  LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL,
  artifactMetadataString,
  artifactUrlFilename,
  gearsJobHasExternalArtifact,
  gearsJobHasLocalAcceptanceArtifact,
  isExternalProductionArtifactUrl,
  isPrivateOrLocalArtifactUrl,
} from '../services/gears-external-artifact-policy-service.js';
import {
  findGearsLedgerMatch,
  preflightIssue,
} from '../services/gears-external-callback-policy-service.js';

function ledgerItem(overrides: Partial<GearsJobLedgerItem> = {}): GearsJobLedgerItem {
  return {
    ledger_id: 'ledger-1',
    gears_job_id: 'job-1',
    job_type: 'seedance_video',
    source_unit_id: 'shot-1',
    idempotency_key: 'shared-key',
    status: 'submitted',
    artifact_urls: [],
    submitted_at: '2026-07-20T00:00:00.000Z',
    updated_at: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

function ledger(items: GearsJobLedgerItem[]): GearsJobLedger {
  return { schema_version: 'gears-job-ledger/v1', items };
}

describe('GEARS external callback policy service', () => {
  it('matches a callback by exact GEARS job id before other identifiers', () => {
    const first = ledgerItem();
    const second = ledgerItem({
      ledger_id: 'ledger-2',
      gears_job_id: 'job-2',
      job_type: 'character_image',
      source_unit_id: 'character-1',
      idempotency_key: 'character-key',
    });
    const callback = normalizeGearsJobCallback({
      jobId: 'job-2',
      sourceUnitId: 'wrong-source',
      jobType: 'seedance_video',
      taskStatus: 'READY',
    });

    expect(findGearsLedgerMatch({ ledger: ledger([first, second]), callback })).toBe(second);
  });

  it('uses job type to disambiguate idempotency and source-unit matches', () => {
    const video = ledgerItem();
    const image = ledgerItem({
      ledger_id: 'ledger-2',
      gears_job_id: 'job-2',
      job_type: 'storyboard_image',
      idempotency_key: 'shared-key',
    });
    const items = ledger([video, image]);

    expect(findGearsLedgerMatch({
      ledger: items,
      callback: normalizeGearsJobCallback({
        idempotencyKey: 'shared-key',
        jobType: 'storyboard_image',
        taskStatus: 'READY',
      }),
    })).toBe(image);
    expect(findGearsLedgerMatch({
      ledger: items,
      callback: normalizeGearsJobCallback({
        idempotencyKey: 'shared-key',
        taskStatus: 'READY',
      }),
    })).toContain('matched multiple jobs');
  });

  it('accepts only public non-placeholder HTTP artifacts as external production output', () => {
    expect(isExternalProductionArtifactUrl('https://cdn.vendor.cn/output/shot-1.mp4')).toBe(true);
    expect(isExternalProductionArtifactUrl('http://public.vendor.cn/output/shot-1.mp4')).toBe(true);
    expect(isExternalProductionArtifactUrl('https://gears.example/videos/shot-1.mp4')).toBe(false);
    expect(isExternalProductionArtifactUrl(`${LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL}/shot-1.mp4`)).toBe(false);
    expect(isExternalProductionArtifactUrl('https://192.168.1.9/shot-1.mp4')).toBe(false);
    expect(isExternalProductionArtifactUrl('file:///tmp/shot-1.mp4')).toBe(false);
    expect(isPrivateOrLocalArtifactUrl('http://[::1]/shot-1.mp4')).toBe(true);
  });

  it('keeps local acceptance and external artifact accounting independent', () => {
    const item = ledgerItem({
      artifact_urls: [
        `${LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL}/shot-1.mp4`,
        'https://cdn.vendor.cn/shot-1.mp4',
      ],
    });

    expect(gearsJobHasLocalAcceptanceArtifact(item)).toBe(true);
    expect(gearsJobHasExternalArtifact(item)).toBe(true);
  });

  it('normalizes preflight issue fields and safe artifact metadata', () => {
    expect(preflightIssue({
      index: 2,
      severity: 'blocking',
      code: 'ledger_match_failed',
      message: 'missing ledger item',
      path: 'callbacks[2]',
      sourceUnitId: 'shot-3',
      gearsJobId: 'job-3',
    })).toEqual({
      index: 2,
      severity: 'blocking',
      code: 'ledger_match_failed',
      message: 'missing ledger item',
      path: 'callbacks[2]',
      source_unit_id: 'shot-3',
      gears_job_id: 'job-3',
    });
    expect(artifactMetadataString({ model: '  seedance-v2  ' }, 'model')).toBe('seedance-v2');
    expect(artifactMetadataString({ model: 123 }, 'model')).toBeUndefined();
    expect(artifactUrlFilename('https://cdn.vendor.cn/renders/%E6%95%85%E4%BA%8B.mp4?token=secret'))
      .toBe('故事.mp4');
  });
});
