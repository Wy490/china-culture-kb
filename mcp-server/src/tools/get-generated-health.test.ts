import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getStoryAgentGeneratedHealth } from './get-generated-health.js';
import {
  getStoryAgentGeneratedGovernancePlan,
  runStoryAgentGeneratedGovernance,
} from './get-generated-governance-plan.js';
import { preflightStoryAgentFinalDeliveryManifest } from './preflight-final-delivery-manifest.js';

let tmpRoot = '';
const previousKbRoot = process.env.KB_ROOT;
const previousGeneratedRoot = process.env.WEB_GENERATED_ROOT;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-story-agent-generated-health-'));
  process.env.KB_ROOT = path.join(tmpRoot, 'data');
  process.env.WEB_GENERATED_ROOT = path.join(tmpRoot, 'web-generated');
  fs.mkdirSync(path.join(process.env.KB_ROOT, 'provinces'), { recursive: true });
});

afterEach(() => {
  if (previousKbRoot === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = previousKbRoot;
  if (previousGeneratedRoot === undefined) delete process.env.WEB_GENERATED_ROOT;
  else process.env.WEB_GENERATED_ROOT = previousGeneratedRoot;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('getStoryAgentGeneratedHealth', () => {
  it('does not treat a concat plan without a final-delivery manifest as publishable', async () => {
    const generatedRoot = process.env.WEB_GENERATED_ROOT!;
    const storyId = '20260718-story-manifest-gap';
    const storyDir = path.join(generatedRoot, 'stories', 'ai_comic_drama');
    const seriesDir = path.join(generatedRoot, 'ai-comic-series-projects', 'manifest-gap-series');
    fs.mkdirSync(storyDir, { recursive: true });
    fs.mkdirSync(seriesDir, { recursive: true });
    fs.writeFileSync(path.join(storyDir, `${storyId}.json`), JSON.stringify({ storyId }));
    fs.writeFileSync(path.join(seriesDir, 'project.json'), JSON.stringify({
      project: {
        series_project_id: 'manifest-gap-series',
        title: 'Manifest Gap Series',
        episode_count: 1,
        generated_episode_count: 1,
        updated_at: '2026-07-18T01:00:00.000Z',
      },
      generated_episode_story_ids: { '1': storyId },
      seedance_production: {
        items: [{
          shot_id: 'shot-1',
          status: 'ready',
          video_url: '/generated/manifest-gap/shot-1.mp4',
          thumbnail: { status: 'ready', output_path: '/generated/manifest-gap/thumb-1.jpg' },
        }],
      },
      seedance_cut_assembly: {
        status: 'ready',
        output_path: '/generated/manifest-gap/cut.mp4',
        concat_list_path: '/generated/manifest-gap/cut.concat.txt',
      },
      seedance_subtitle_render: {
        status: 'ready',
        output_path: '/generated/manifest-gap/subtitled.mp4',
        srt_path: '/generated/manifest-gap/subtitles.srt',
      },
      seedance_final_delivery: {
        status: 'planned',
        dry_run: true,
        output_path: '/generated/manifest-gap/final.mp4',
        concat_list_path: '/generated/manifest-gap/final.concat.txt',
      },
      gears_job_ledger: { jobs: [{ gears_job_id: 'job-1', status: 'ready' }] },
    }));

    const report = await getStoryAgentGeneratedHealth({ limit: 20 });
    const item = report.items.find(candidate => candidate.project_id === 'manifest-gap-series');

    expect(item).toMatchObject({
      status: 'production_gap',
      missing_contracts: expect.arrayContaining(['final_delivery_manifest']),
      final_delivery_ready: false,
      final_delivery_manifest_ready: false,
      final_delivery_manifest_missing: true,
      final_delivery_dry_run: true,
    });
    expect(report.summary.series_missing_final_delivery_manifest_count).toBe(1);
    expect(report.markdown).toContain('series_missing_final_delivery_manifest: 1');
    expect(report.generation_activity).toMatchObject({
      schema_version: 'story-agent-generation-activity/v1',
      diagnosis: 'attempt_history_unavailable',
      signals: {
        durable_generation_attempt_history_available: false,
        generation_attempt_audit_ready_for_next_request: true,
        no_generation_request_confirmed: false,
        generation_pipeline_failure_confirmed: false,
        generation_attempt_incomplete_detected: false,
        storage_root_switch_detected: false,
        report_only_activity_detected: false,
        project_revision_only_activity_detected: false,
      },
      safety: {
        read_only: true,
        generated_files_modified: false,
        model_invoked: false,
      },
    });
    expect(report.markdown).toContain('durable_attempt_history: false');
    expect(report.markdown).toContain('attempt_audit_readiness: uninitialized');
    expect(report.markdown).toContain('attempt_audit_lock_timeout_ms: 5000');
    expect(report.markdown).toContain('attempt_audit_lock_retry_ms: 10');
    expect(report.markdown).toContain('attempt_audit_lock_stale_ms: 30000');
    expect(report.markdown).toContain('attempt_audit_configuration_valid: true');
    expect(report.markdown).toContain('attempt_audit_configuration_warnings: none');
    expect(report.markdown).toContain('attempt_audit_permission_policy: owner_only');
    expect(report.markdown).toContain('attempt_audit_permission_policy_satisfied: true');
    expect(report.markdown).toContain('attempt_audit_event_file_sync_required: true');
    expect(report.markdown).toContain('attempt_audit_no_follow_open_required: true');
    expect(report.markdown).toContain('attempt_audit_directory_entry_sync_guaranteed: true');
    expect(report.markdown).toContain('attempt_audit_operator_actions: no_action_required');
    expect(report.markdown).toContain('attempt_audit_automatic_repair_allowed: false');
    expect(report.markdown).toContain('attempt_audit_destructive_action_performed: false');
    expect(report.items[0]?.project_id).toBe('manifest-gap-series');

    const plan = await getStoryAgentGeneratedGovernancePlan({ limit: 20 });
    expect(plan.summary.series_final_delivery_manifest_review_candidate_count).toBe(1);
    expect(plan.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action_key: 'review_final_delivery_manifest_gaps',
        target_count: 1,
        can_auto_apply: false,
        runner: 'operator',
        sample_targets: [expect.objectContaining({
          project_id: 'manifest-gap-series',
          final_delivery_manifest_missing: true,
          final_delivery_dry_run: true,
        })],
      }),
    ]));

    const queue = await runStoryAgentGeneratedGovernance({
      dry_run: true,
      action_keys: ['review_final_delivery_manifest_gaps'],
      project_ids: ['manifest-gap-series'],
      max_targets: 1,
    });
    expect(queue.manifest.items).toEqual([
      expect.objectContaining({
        action_key: 'review_final_delivery_manifest_gaps',
        project_id: 'manifest-gap-series',
        expected_file_changes: [],
        requires_operator_review: true,
        operator_disposition_status: 'awaiting_operator_decision',
        allowed_operator_dispositions: [
          'preserve_fixture_exclude_from_publishable_delivery',
          'reexport_after_authorized_dependencies',
        ],
        preflight_checks: expect.arrayContaining([
          'verify_authorized_media_inputs',
          'verify_cut_subtitle_audio_title_card_dependencies',
          'verify_output_and_manifest_paths_are_project_scoped',
        ]),
        publishable_delivery_credit_granted: false,
        preflight_api: {
          method: 'POST',
          path: '/api/system/story-agent-final-delivery-manifest-preflight',
          request_template: {
            series_project_id: 'manifest-gap-series',
            disposition: 'preserve_fixture_exclude_from_publishable_delivery',
            authorized_media_inputs_attested: false,
          },
        },
      }),
    ]);
    expect(queue.markdown).toContain('awaiting_operator_decision');

    const preservePreflight = await preflightStoryAgentFinalDeliveryManifest({
      series_project_id: 'manifest-gap-series',
      disposition: 'preserve_fixture_exclude_from_publishable_delivery',
    });
    expect(preservePreflight).toMatchObject({
      schema_version: 'story-agent-final-delivery-manifest-preflight/v1',
      status: 'ready',
      eligible_for_selected_disposition: true,
      operator_review_required: true,
      publishable_delivery_credit_granted: false,
      generated_files_modified: false,
      final_assemble_invoked: false,
      manifest_written: false,
      project_json_written: false,
    });

    const reexportPreflight = await preflightStoryAgentFinalDeliveryManifest({
      series_project_id: 'manifest-gap-series',
      disposition: 'reexport_after_authorized_dependencies',
      authorized_media_inputs_attested: true,
    });
    expect(reexportPreflight).toMatchObject({
      status: 'blocked',
      eligible_for_selected_disposition: false,
      publishable_delivery_credit_granted: false,
      checks: expect.arrayContaining([
        expect.objectContaining({ key: 'project_scoped_paths', status: 'failed' }),
        expect.objectContaining({ key: 'audio_mix_output', status: 'failed' }),
        expect.objectContaining({ key: 'title_card_outputs', status: 'failed' }),
      ]),
    });
    expect(reexportPreflight.missing_dependencies.length).toBeGreaterThan(0);

    const readyProjectId = 'preflight-ready-series';
    const readySeriesDir = path.join(generatedRoot, 'ai-comic-series-projects', readyProjectId);
    const readyPaths = {
      cut: `cuts/${readyProjectId}/cut.mp4`,
      subtitle: `cuts/${readyProjectId}/subtitled.mp4`,
      srt: `subtitles/${readyProjectId}/subtitles.srt`,
      audio: `cuts/${readyProjectId}/audio-mix.mp4`,
      title: `title-cards/${readyProjectId}/opening.mp4`,
      final: `delivery/${readyProjectId}/final.mp4`,
    };
    fs.mkdirSync(readySeriesDir, { recursive: true });
    for (const generatedPath of [readyPaths.cut, readyPaths.subtitle, readyPaths.srt, readyPaths.audio, readyPaths.title]) {
      const absolutePath = path.join(generatedRoot, generatedPath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, 'verified fixture');
    }
    fs.writeFileSync(path.join(readySeriesDir, 'project.json'), JSON.stringify({
      project: { series_project_id: readyProjectId, title: 'Preflight Ready Series' },
      seedance_cut_assembly: {
        status: 'ready', dry_run: false, output_path: readyPaths.cut, missing_shot_count: 0,
      },
      seedance_subtitle_render: {
        status: 'ready', dry_run: false, output_path: readyPaths.subtitle, srt_path: readyPaths.srt, cue_count: 1,
      },
      seedance_audio_mix: {
        status: 'ready', dry_run: false, output_path: readyPaths.audio, missing_audio_count: 0,
      },
      seedance_title_card_render: {
        status: 'ready', dry_run: false, output_paths: [readyPaths.title], card_count: 1, rendered_count: 1,
      },
      seedance_final_delivery: {
        status: 'planned', dry_run: true, output_path: readyPaths.final,
      },
    }));
    const readyReexportPreflight = await preflightStoryAgentFinalDeliveryManifest({
      series_project_id: readyProjectId,
      disposition: 'reexport_after_authorized_dependencies',
      authorized_media_inputs_attested: true,
    });
    expect(readyReexportPreflight).toMatchObject({
      status: 'ready',
      eligible_for_selected_disposition: true,
      missing_dependencies: [],
      unsafe_paths: [],
      publishable_delivery_credit_granted: false,
      generated_files_modified: false,
      final_assemble_invoked: false,
    });
    expect(readyReexportPreflight.checks.every(check => check.status === 'passed')).toBe(true);

    fs.writeFileSync(path.join(readySeriesDir, 'project.json'), JSON.stringify({
      project: { series_project_id: readyProjectId, title: 'Preflight Non-gap Series' },
      seedance_final_delivery: {
        status: 'ready',
        output_path: readyPaths.final,
        manifest_path: `delivery/${readyProjectId}/final.manifest.json`,
      },
    }));
    const nonGapPreflight = await preflightStoryAgentFinalDeliveryManifest({
      series_project_id: readyProjectId,
      disposition: 'preserve_fixture_exclude_from_publishable_delivery',
    });
    expect(nonGapPreflight).toMatchObject({
      status: 'blocked',
      eligible_for_selected_disposition: false,
      checks: expect.arrayContaining([
        expect.objectContaining({ key: 'target_exists', status: 'passed' }),
        expect.objectContaining({ key: 'manifest_gap_confirmed', status: 'failed' }),
      ]),
    });

    const unknownPreflight = await preflightStoryAgentFinalDeliveryManifest({
      series_project_id: 'unknown-series',
      disposition: 'preserve_fixture_exclude_from_publishable_delivery',
    });
    expect(unknownPreflight).toMatchObject({
      status: 'blocked',
      eligible_for_selected_disposition: false,
      checks: expect.arrayContaining([
        expect.objectContaining({ key: 'target_exists', status: 'failed' }),
      ]),
    });

    const blockedQueue = await runStoryAgentGeneratedGovernance({
      dry_run: false,
      action_keys: ['review_final_delivery_manifest_gaps'],
      project_ids: ['manifest-gap-series'],
      max_targets: 1,
    });
    expect(blockedQueue).toMatchObject({
      status: 'blocked',
      dry_run: false,
      planned_target_count: 0,
      blocked_target_count: 1,
      manifest: {
        items: [expect.objectContaining({
          project_id: 'manifest-gap-series',
          status: 'blocked',
          expected_file_changes: [],
          operator_disposition_status: 'awaiting_operator_decision',
          publishable_delivery_credit_granted: false,
        })],
      },
    });
  });
});
