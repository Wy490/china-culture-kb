import { describe, expect, it } from 'vitest';
import type {
  SeedanceShotLedger,
  SeedanceShotLedgerItem,
  StoryProjectMeta,
} from '@shared/types.js';
import {
  buildSeedanceProviderRetryPlan,
  buildSeedanceProviderRetryPlanMarkdown,
  seedanceProviderRetryReasonText,
  selectSeedanceProviderRetryPlanCandidates,
} from '../services/seedance-provider-retry-plan-service.js';

const GENERATED_AT = '2026-07-20T04:00:00.000Z';

function project(overrides: Partial<StoryProjectMeta> = {}): StoryProjectMeta {
  return {
    project_id: 'project-1',
    title: 'Seedance Provider 重试测试',
    ...overrides,
  } as StoryProjectMeta;
}

function ledgerItem(overrides: Partial<SeedanceShotLedgerItem> = {}): SeedanceShotLedgerItem {
  return {
    production_id: 'seedance-shot-shot-1',
    shot_id: 'shot-1',
    source_scene_id: 1,
    status: 'failed',
    updated_at: '2026-07-20T00:00:00.000Z',
    provider: 'provider-a',
    provider_job_id: 'provider-job-1',
    provider_queue_id: 'queue-a',
    provider_queue_position: 1,
    failure_reason: 'provider timeout',
    failure_category: 'provider_timeout',
    provider_error_code: 'TIMEOUT',
    retry_count: 0,
    notes: [],
    versions: [],
    ...overrides,
  };
}

function ledger(items: SeedanceShotLedgerItem[]): SeedanceShotLedger {
  return {
    schema_version: 'seedance-shot-ledger/v1',
    updated_at: GENERATED_AT,
    items,
  };
}

function representativeLedger(): SeedanceShotLedger {
  return ledger([
    ledgerItem(),
    ledgerItem({
      production_id: 'seedance-shot-shot-2',
      shot_id: 'shot-2',
      source_scene_id: 2,
      status: 'submitted',
      submitted_at: '2026-07-20T00:00:00.000Z',
      failure_reason: undefined,
      failure_category: undefined,
      provider_error_code: undefined,
      retry_count: 1,
      provider_queue_position: 2,
    }),
    ledgerItem({
      production_id: 'seedance-shot-shot-3',
      shot_id: 'shot-3',
      source_scene_id: 3,
      status: 'ready',
      video_url: undefined,
      failure_reason: undefined,
      failure_category: undefined,
      provider_error_code: undefined,
      provider_queue_position: 3,
    }),
    ledgerItem({
      production_id: 'seedance-shot-shot-4',
      shot_id: 'shot-4',
      source_scene_id: 4,
      status: 'prompt_exported',
      failure_reason: undefined,
      failure_category: undefined,
      provider_error_code: undefined,
      provider_job_id: undefined,
      provider_queue_position: 4,
    }),
    ledgerItem({
      production_id: 'seedance-shot-shot-5',
      shot_id: 'shot-5',
      source_scene_id: 5,
      failure_category: 'asset_missing',
      failure_reason: 'missing character image',
      provider_error_code: 'ASSET_MISSING',
      provider_queue_position: 5,
    }),
    ledgerItem({
      production_id: 'seedance-shot-shot-6',
      shot_id: 'shot-6',
      provider: 'provider-b',
      provider_queue_id: 'queue-b',
    }),
  ]);
}

describe('Seedance provider retry plan service', () => {
  it('filters, classifies, sorts, and counts a representative retry plan', () => {
    const plan = buildSeedanceProviderRetryPlan({
      project: project(),
      ledger: representativeLedger(),
      request: {
        provider: ' provider-a ',
        queue_id: ' queue-a ',
        timeout_minutes: 120,
        max_retry_count: 2,
        include_unsubmitted: true,
      },
      generatedAt: GENERATED_AT,
    });

    expect(plan).toMatchObject({
      provider: 'provider-a',
      queue_id: 'queue-a',
      generated_at: GENERATED_AT,
      timeout_minutes: 120,
      max_retry_count: 2,
      candidate_count: 5,
      resubmittable_count: 3,
      blocked_count: 2,
      high_priority_count: 2,
      reason_counts: {
        failed: 2,
        timed_out: 1,
        ready_missing_video: 1,
        unsubmitted: 1,
      },
    });
    expect(plan.candidates.map(item => item.retry_reason)).toEqual([
      'failed',
      'timed_out',
      'ready_missing_video',
      'failed',
      'unsubmitted',
    ]);
    expect(plan.candidates.find(item => item.shot_id === 'shot-5')).toMatchObject({
      can_resubmit: false,
      block_reason: expect.stringContaining('素材缺失'),
    });
  });

  it('applies failure-category filters before deriving non-failure retry reasons', () => {
    const selection = selectSeedanceProviderRetryPlanCandidates({
      ledger: representativeLedger(),
      request: {
        provider: 'provider-a',
        queue_id: 'queue-a',
        include_unsubmitted: true,
        failure_categories: ['asset_missing'],
      },
      generatedAt: GENERATED_AT,
    });

    expect(selection.candidates).toHaveLength(1);
    expect(selection.candidates[0]).toMatchObject({
      shot_id: 'shot-5',
      retry_reason: 'failed',
      failure_category: 'asset_missing',
      can_resubmit: false,
    });
    expect(selection.reasonCounts).toEqual({
      failed: 1,
      timed_out: 0,
      ready_missing_video: 0,
      unsubmitted: 0,
    });
  });

  it('marks candidates at the retry ceiling as blocked', () => {
    const plan = buildSeedanceProviderRetryPlan({
      project: project(),
      ledger: ledger([ledgerItem({ retry_count: 2 })]),
      request: { max_retry_count: 2 },
      generatedAt: GENERATED_AT,
    });

    expect(plan).toMatchObject({
      candidate_count: 1,
      resubmittable_count: 0,
      blocked_count: 1,
    });
    expect(plan.candidates[0]).toMatchObject({
      can_resubmit: false,
      block_reason: '已达到最大重试次数 2',
    });
  });

  it('renders localized reasons, candidate details, and an explicit empty state', () => {
    const plan = buildSeedanceProviderRetryPlan({
      project: project(),
      ledger: ledger([ledgerItem()]),
      request: {},
      generatedAt: GENERATED_AT,
    });
    const { markdown, ...basePlan } = plan;

    expect(seedanceProviderRetryReasonText('failed')).toBe('失败回片');
    expect(markdown).toContain('# Seedance Provider 重试测试 — Seedance provider 人工重试策略');
    expect(markdown).toContain('原因: 失败回片');
    expect(markdown).toContain('状态: 失败');
    expect(markdown).toContain('Provider 错误码: TIMEOUT');
    expect(buildSeedanceProviderRetryPlanMarkdown(basePlan)).toBe(markdown);

    const emptyPlan = buildSeedanceProviderRetryPlan({
      project: project(),
      ledger: ledger([ledgerItem({
        status: 'ready',
        video_url: 'https://cdn.vendor.cn/shot-1.mp4',
        failure_reason: undefined,
        failure_category: undefined,
        provider_error_code: undefined,
      })]),
      request: {},
      generatedAt: GENERATED_AT,
    });
    expect(emptyPlan.markdown).toContain('暂无需要人工重试的镜头');
  });
});
