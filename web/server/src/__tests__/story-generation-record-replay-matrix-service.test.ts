import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildStoryGenerationRecordReplayMatrixReport,
} from '../services/story-generation-record-replay-matrix-service.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => (
    rm(root, { recursive: true, force: true })
  )));
});

describe('story generation record replay matrix service', () => {
  it('proves the 4x3 composition grid and all replay integrity gates offline', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'story-replay-matrix-'));
    temporaryRoots.push(fixtureRoot);

    const report = await buildStoryGenerationRecordReplayMatrixReport({
      fixtureRoot,
      knowledgeRoot: resolve(import.meta.dirname, '..', '..', '..', '..', 'data'),
    });

    expect(report).toMatchObject({
      schema_version: 'story-generation-record-replay-matrix/v1',
      generated_at: '2026-08-21T00:00:00.000+08:00',
      status: 'passed',
      summary: {
        positive_case_count: 12,
        positive_case_passed_count: 12,
        video_type_coverage: '4/4',
        duration_coverage: '3/3',
        video_type_duration_cell_coverage: '12/12',
        unique_prompt_hash_coverage: '12/12',
        unique_fixture_hash_coverage: '12/12',
        negative_gate_count: 5,
        negative_gate_passed_count: 5,
      },
      boundaries: {
        fixture_source: 'offline_fixture',
        record_replay_fixture_used: true,
        replay_invokes_external_model: false,
        command_adapter_invocation_count: 1,
        real_external_provider_invoked: false,
        paid_call_performed: false,
        external_data_transfer_performed: false,
        human_review_complete: false,
        professional_credit_granted: false,
        real_production_credit_granted: false,
        province_markdown_written: false,
      },
    });
    expect(report.positive_cases).toHaveLength(12);
    expect(report.positive_cases.every(item => (
      item.status === 'passed' && Object.values(item.checks).every(Boolean)
    ))).toBe(true);
    expect(new Set(report.positive_cases.map(item => item.video_type))).toEqual(new Set([
      'ai_comic_drama',
      'character_story',
      'historical_drama',
      'legend_story',
    ]));
    expect(new Set(report.positive_cases.map(item => item.target_duration))).toEqual(new Set([
      '30秒',
      '1分钟',
      '3分钟',
    ]));
    expect(report.negative_gates.map(item => item.gate_id)).toEqual([
      'output_tamper_rejected',
      'metadata_tamper_rejected',
      'prompt_drift_rejected',
      'model_profile_drift_rejected',
      'command_self_assertion_denied',
    ]);
    expect(report.negative_gates.every(item => item.status === 'passed')).toBe(true);
  });
});
