import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { getGearsWorkerEvidenceSignoff } from './get-gears-worker-evidence-signoff.js';

async function writeEvidenceJson(evidenceDir: string, filename: string, value: unknown) {
  await fs.writeFile(path.resolve(evidenceDir, filename), JSON.stringify(value, null, 2), 'utf-8');
}

async function writeReadyEvidence(
  evidenceDir: string,
  outputSource: {
    source: string;
    configured_from_env: boolean;
    placeholder: boolean;
    ready_for_external_import: boolean;
  } = {
    source: 'worker_response',
    configured_from_env: false,
    placeholder: false,
    ready_for_external_import: true,
  },
) {
  await fs.mkdir(evidenceDir, { recursive: true });
  const mvpGovernanceCounts = {
    seedance_placeholder_asset_count: { before: 0, after: 0, delta: 0 },
    seedance_production_asset_ready_count: { before: 0, after: 0, delta: 0 },
    knowledge_writeback_ready_count: { before: 0, after: 0, delta: 0 },
    knowledge_writeback_queued_count: { before: 0, after: 0, delta: 0 },
    knowledge_writeback_needs_revision_count: { before: 0, after: 0, delta: 0 },
  };
  await writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-verdict.json', {
    schema_version: 'gears-worker-acceptance-verdict/v1',
    status: 'passed',
    acceptance_passed: true,
    pressure_submitted: true,
    gate_counts: { passed: 11, failed: 0, skipped: 0, total: 11 },
    failed_gate_ids: [],
    skipped_gate_ids: [],
    mvp_governance_counts: mvpGovernanceCounts,
    gates: [
      {
        id: 'production_material_pack_health_audit',
        label: 'Production material pack health smoke audit',
        status: 'passed',
        summary: 'Production material pack health stayed passed during worker smoke.',
      },
      {
        id: 'domain_pack_production_health_audit',
        label: 'Domain Pack production health smoke audit',
        status: 'passed',
        summary: 'Domain Pack production health stayed passed during worker smoke.',
      },
      {
        id: 'system_external_callback_batch',
        label: 'Story Agent system external callback batch',
        status: 'passed',
        summary: 'System external callback wrote back a public GEARS artifact.',
      },
    ],
    recommended_actions: [],
  });
  await writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-archive.json', {
    schema_version: 'gears-worker-acceptance-archive/v1',
    status: 'signoff_ready',
    signoff_ready: true,
    totals: {
      missing_required_attachment_count: 0,
      required_attachment_count: 39,
      required_checksum_count: 39,
      evidence_file_count: 78,
    },
    required_attachments: [
      'gears-worker-acceptance-verdict.json',
      'story-agent-system-external-output-url-source.json',
      'story-agent-system-external-callback-preflight-response.json',
      'story-agent-system-external-callback-import-response.json',
      'story-agent-generated-health-audit.json',
      'production-material-pack-health-audit.json',
      'domain-pack-production-health-audit.json',
      'story-agent-mvp-status-audit.json',
    ],
    missing_required_files: [],
    audit_summaries: {
      story_agent_mvp_status: {
        governance_counts: mvpGovernanceCounts,
      },
    },
    recommended_actions: [],
  });
  await writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-integrity.json', {
    schema_version: 'gears-worker-acceptance-integrity/v1',
    status: 'passed',
    integrity_passed: true,
    recommended_actions: [],
  });
  await writeEvidenceJson(evidenceDir, 'gears-worker-response-audit.json', {
    totals: {
      record_count: 370,
      transport_error_count: 0,
      http_error_count: 0,
      unknown_count: 0,
      missing_worker_id_count: 0,
      missing_source_id_count: 0,
      missing_ready_artifact_count: 0,
      failure_category_counts: {
        render_failed: 1,
      },
    },
    recommended_actions: [],
  });
  await writeEvidenceJson(evidenceDir, 'story-agent-callback-response-audit.json', {
    totals: {
      transport_error_count: 0,
      http_error_count: 0,
      ledger_match_missing_count: 0,
      failed_count: 0,
    },
    recommended_actions: [],
  });
  await writeEvidenceJson(evidenceDir, 'story-agent-system-external-output-url-source.json', {
    schema_version: 'story-agent-system-external-output-url-source/v1',
    env_var: 'GEARS_SYSTEM_EXTERNAL_OUTPUT_URL',
    output_url: outputSource.placeholder
      ? '<GEARS_SYSTEM_EXTERNAL_OUTPUT_URL>'
      : 'https://cdn.example.com/gears-worker-acceptance/readiness-shot-1.mp4',
    ...outputSource,
  });
  await writeEvidenceJson(evidenceDir, 'story-agent-system-external-callback-preflight-response.json', {
    ok: true,
    data: {
      schema_version: 'system-gears-external-callback-batch-import/v1',
      mode: 'preflight',
      blocked: false,
      received_count: 3,
      resolved_count: 3,
      unresolved_count: 0,
      project_count: 1,
      ready_to_import_count: 3,
      updated_count: 0,
      failed_count: 0,
      duplicate_count: 0,
      blocking_count: 0,
      warning_count: 0,
      project_results: [{
        import_result: {
          seedance_shot_ledger: {
            items: [{ video_url: 'https://cdn.example.com/gears-worker-acceptance/readiness-shot-1.mp4' }],
          },
        },
      }],
    },
  });
  await writeEvidenceJson(evidenceDir, 'story-agent-system-external-callback-import-response.json', {
    ok: true,
    data: {
      schema_version: 'system-gears-external-callback-batch-import/v1',
      mode: 'import',
      blocked: false,
      received_count: 3,
      resolved_count: 3,
      unresolved_count: 0,
      project_count: 1,
      ready_to_import_count: 3,
      updated_count: 3,
      failed_count: 0,
      duplicate_count: 0,
      blocking_count: 0,
      warning_count: 0,
      project_results: [{
        import_result: {
          seedance_shot_ledger: {
            items: [{ video_url: 'https://cdn.example.com/gears-worker-acceptance/readiness-shot-1.mp4' }],
          },
        },
      }],
    },
  });
  await writeEvidenceJson(evidenceDir, 'story-agent-generated-health-audit.json', {
    schema_version: 'story-agent-generated-health-audit/v1',
    status: 'passed',
    before: { summary: { ready_count: 1 } },
    after: { summary: { ready_count: 1 } },
    deltas: { ready_count: 0, interrupted_count: 0, production_gap_count: 0 },
    recommended_actions: [],
  });
  await writeEvidenceJson(evidenceDir, 'production-material-pack-health-audit.json', {
    schema_version: 'production-material-pack-health-audit/v1',
    status: 'passed',
    before: { status: 'passed', issue_count: 0, core_ready_count: 4, core_total_count: 4 },
    after: { status: 'passed', issue_count: 0, core_ready_count: 4, core_total_count: 4 },
    deltas: { issue_count: 0, core_ready_count: 0 },
    failed_checks: [],
    warning_checks: [],
    recommended_actions: [],
  });
  await writeEvidenceJson(evidenceDir, 'domain-pack-production-health-audit.json', {
    schema_version: 'domain-pack-production-health-audit/v1',
    status: 'passed',
    before: { status: 'passed', issue_count: 0, ready_pack_count: 8, required_pack_count: 8 },
    after: { status: 'passed', issue_count: 0, ready_pack_count: 8, required_pack_count: 8 },
    deltas: { issue_count: 0, ready_pack_count: 0 },
    failed_checks: [],
    warning_checks: [],
    recommended_actions: [],
  });
  await writeEvidenceJson(evidenceDir, 'story-agent-mvp-status-audit.json', {
    schema_version: 'story-agent-mvp-status-audit/v1',
    status: 'passed',
    before: { status: 'ready', score: 96 },
    after: { status: 'ready', score: 96 },
    deltas: { score: 0, status_rank: 0, blocker_count: 0 },
    failed_checks: [],
    warning_checks: [],
    recommended_actions: [],
  });
  await writeEvidenceJson(evidenceDir, 'gears-large-project-response-audit.json', {
    totals: {
      pressure_submitted: true,
      request_unit_count: 120,
      response_record_count: 120,
      accepted_count: 120,
      rejected_count: 0,
      failed_count: 0,
      source_echo_count: 120,
      missing_requested_source_count: 0,
      duplicate_source_id_count: 0,
      unexpected_source_count: 0,
    },
    recommended_actions: [],
  });
}

describe('getGearsWorkerEvidenceSignoff', () => {
  it('summarizes a complete worker evidence directory with a real external output source', async () => {
    const evidenceDir = await fs.mkdtemp(path.join(tmpdir(), 'mcp-gears-signoff-'));
    await writeReadyEvidence(evidenceDir);

    const report = await getGearsWorkerEvidenceSignoff({ evidence_dir: evidenceDir });

    expect(report).toMatchObject({
      provider: 'gears',
      schema_version: 'mcp-gears-worker-evidence-signoff/v1',
      status: 'ready',
      evidence_dir: evidenceDir,
      evidence_dir_source: 'input',
      evidence_dir_allowed: true,
      acceptance_passed: true,
      signoff_ready: true,
      integrity_passed: true,
      health_audit_passed: true,
      production_material_pack_health_audit_passed: true,
      domain_pack_production_health_audit_passed: true,
      mvp_status_audit_passed: true,
      mvp_governance_counts_consistent: true,
      mvp_governance_counts_verdict_embedded: true,
      mvp_governance_counts_archive_embedded: true,
      mvp_governance_count_mismatch_ids: [],
      system_external_callback_passed: true,
      system_external_callback_ready_to_import_count: 3,
      system_external_callback_updated_count: 3,
      system_external_callback_blocking_count: 0,
      system_external_callback_failed_count: 0,
      system_external_callback_unresolved_count: 0,
      system_external_callback_project_count: 1,
      system_external_output_url_source_ready: true,
      system_external_output_url_imported: true,
      system_external_output_url_import_match_count: 1,
      system_external_output_url_configured_from_env: false,
      system_external_output_url_source: 'worker_response',
      pressure_submitted: true,
      large_project_source_echo_count: 120,
      production_material_pack_status_before: 'passed',
      production_material_pack_status_after: 'passed',
      production_material_pack_issue_count_delta: 0,
      production_material_pack_core_ready_count_before: 4,
      production_material_pack_core_ready_count_after: 4,
      domain_pack_status_before: 'passed',
      domain_pack_status_after: 'passed',
      domain_pack_issue_count_delta: 0,
      domain_pack_ready_count_before: 8,
      domain_pack_ready_count_after: 8,
    });
    expect(report.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'production_material_pack_health_audit',
        status: 'passed',
      }),
      expect.objectContaining({
        id: 'domain_pack_production_health_audit',
        status: 'passed',
      }),
      expect.objectContaining({
        id: 'system_external_callback_batch',
        status: 'passed',
      }),
    ]));
    expect(report.worker_failure_category_counts).toEqual({ render_failed: 1 });
    expect(report.markdown).toContain('production_material_pack_health_audit_passed: true');
    expect(report.markdown).toContain('domain_pack_production_health_audit_passed: true');
    expect(report.markdown).toContain('system_external_callback_passed: true');
    expect(report.markdown).toContain('system_external_output_url_source: worker_response');
    expect(report.markdown).toContain('system_external_callback_ready/updated: 3/3');
  });

  it('does not sign off placeholder output sources as real external GEARS callbacks', async () => {
    const evidenceDir = await fs.mkdtemp(path.join(tmpdir(), 'mcp-gears-signoff-placeholder-'));
    await writeReadyEvidence(evidenceDir, {
      source: 'placeholder',
      configured_from_env: false,
      placeholder: true,
      ready_for_external_import: false,
    });

    const report = await getGearsWorkerEvidenceSignoff({ evidence_dir: evidenceDir });

    expect(report.status).toBe('attention');
    expect(report.acceptance_passed).toBe(true);
    expect(report.signoff_ready).toBe(true);
    expect(report.integrity_passed).toBe(true);
    expect(report.system_external_callback_passed).toBe(false);
    expect(report.system_external_output_url_source_ready).toBe(false);
    expect(report.system_external_output_url_source).toBe('placeholder');
    expect(report.markdown).toContain('system_external_callback_passed: false');
    expect(report.markdown).toContain('system_external_output_url_source_ready: false');
  });

  it('does not sign off localhost output URLs even when source metadata claims ready', async () => {
    const evidenceDir = await fs.mkdtemp(path.join(tmpdir(), 'mcp-gears-signoff-localhost-'));
    await writeReadyEvidence(evidenceDir);
    await writeEvidenceJson(evidenceDir, 'story-agent-system-external-output-url-source.json', {
      schema_version: 'story-agent-system-external-output-url-source/v1',
      env_var: 'GEARS_SYSTEM_EXTERNAL_OUTPUT_URL',
      configured_from_env: true,
      source: 'env',
      output_url: 'http://127.0.0.1:9000/gears-worker-acceptance/readiness-shot-1.mp4',
      placeholder: false,
      ready_for_external_import: true,
    });

    const report = await getGearsWorkerEvidenceSignoff({ evidence_dir: evidenceDir });

    expect(report.status).toBe('attention');
    expect(report.system_external_callback_passed).toBe(false);
    expect(report.system_external_output_url_source_ready).toBe(false);
    expect(report.system_external_output_url_source).toBe('env');
    expect(report.markdown).toContain('system_external_output_url_source_ready: false');
  });
});
