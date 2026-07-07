import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getGearsWorkerEvidenceSignoff } from '../src/tools/get-gears-worker-evidence-signoff.js';

const tmpRoot = path.join(os.tmpdir(), 'kb-gears-signoff-test-' + Date.now());
const dataRoot = path.join(tmpRoot, 'data');
const previousKbRoot = process.env.KB_ROOT;
const previousEvidenceDir = process.env.GEARS_EVIDENCE_DIR;
const previousAutoDiscover = process.env.GEARS_EVIDENCE_AUTO_DISCOVER;
const previousAutoDiscoverRoots = process.env.GEARS_EVIDENCE_AUTO_DISCOVER_ROOTS;

function writeEvidenceJson(evidenceDir: string, filename: string, value: unknown): void {
  fs.writeFileSync(path.join(evidenceDir, filename), JSON.stringify(value, null, 2));
}

function writeCompleteEvidence(evidenceDir: string, recommendedActions: unknown[] = []): void {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const mvpGovernanceCounts = {
    seedance_placeholder_asset_count: { before: 0, after: 0, delta: 0 },
    seedance_production_asset_ready_count: { before: 5, after: 5, delta: 0 },
    knowledge_writeback_ready_count: { before: 1, after: 1, delta: 0 },
    knowledge_writeback_queued_count: { before: 1, after: 1, delta: 0 },
    knowledge_writeback_needs_revision_count: { before: 0, after: 0, delta: 0 },
  };
  writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-verdict.json', {
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
        summary: 'System external callback imported a real external artifact.',
      },
    ],
    recommended_actions: recommendedActions,
  });
  writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-archive.json', {
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
    recommended_actions: recommendedActions,
  });
  writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-integrity.json', {
    schema_version: 'gears-worker-acceptance-integrity/v1',
    status: 'passed',
    integrity_passed: true,
    record_count: 70,
    mismatch_count: 0,
    missing_file_count: 0,
    sha256_mismatch_count: 0,
    recommended_actions: [],
  });
  writeEvidenceJson(evidenceDir, 'gears-worker-response-audit.json', {
    totals: {
      record_count: 370,
      transport_error_count: 0,
      http_error_count: 0,
      unknown_count: 0,
      missing_worker_id_count: 0,
      missing_source_id_count: 0,
      missing_ready_artifact_count: 0,
      failure_category_counts: {
        render_failed: 2,
      },
    },
    recommended_actions: [],
  });
  writeEvidenceJson(evidenceDir, 'story-agent-callback-response-audit.json', {
    totals: {
      transport_error_count: 0,
      http_error_count: 0,
      ledger_match_missing_count: 0,
      failed_count: 0,
    },
    recommended_actions: [],
  });
  writeEvidenceJson(evidenceDir, 'story-agent-system-external-output-url-source.json', {
    schema_version: 'story-agent-system-external-output-url-source/v1',
    env_var: 'GEARS_SYSTEM_EXTERNAL_OUTPUT_URL',
    configured_from_env: false,
    discovered_from_worker_response: true,
    source: 'worker_response',
    output_url: 'https://cdn.example.com/gears-worker-acceptance/readiness-shot-1.mp4',
    placeholder: false,
    ready_for_external_import: true,
  });
  writeEvidenceJson(evidenceDir, 'story-agent-system-external-callback-preflight-response.json', {
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
  writeEvidenceJson(evidenceDir, 'story-agent-system-external-callback-import-response.json', {
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
  writeEvidenceJson(evidenceDir, 'story-agent-generated-health-audit.json', {
    schema_version: 'story-agent-generated-health-audit/v1',
    status: 'passed',
    before: { summary: { ready_count: 1 } },
    after: { summary: { ready_count: 1 } },
    deltas: { ready_count: 0, interrupted_count: 0, production_gap_count: 0 },
    recommended_actions: [],
  });
  writeEvidenceJson(evidenceDir, 'production-material-pack-health-audit.json', {
    schema_version: 'production-material-pack-health-audit/v1',
    status: 'passed',
    before: { status: 'passed', issue_count: 0, core_ready_count: 4, core_total_count: 4 },
    after: { status: 'passed', issue_count: 0, core_ready_count: 4, core_total_count: 4 },
    deltas: { issue_count: 0, core_ready_count: 0 },
    failed_checks: [],
    warning_checks: [],
    recommended_actions: [],
  });
  writeEvidenceJson(evidenceDir, 'domain-pack-production-health-audit.json', {
    schema_version: 'domain-pack-production-health-audit/v1',
    status: 'passed',
    before: { status: 'passed', issue_count: 0, ready_pack_count: 8, required_pack_count: 8 },
    after: { status: 'passed', issue_count: 0, ready_pack_count: 8, required_pack_count: 8 },
    deltas: { issue_count: 0, ready_pack_count: 0 },
    failed_checks: [],
    warning_checks: [],
    recommended_actions: [],
  });
  writeEvidenceJson(evidenceDir, 'story-agent-mvp-status-audit.json', {
    schema_version: 'story-agent-mvp-status-audit/v1',
    status: 'passed',
    before: {
      status: 'ready',
      score: 96,
      summary: {
        seedance_placeholder_asset_count: 0,
        seedance_production_asset_ready_count: 5,
        knowledge_writeback_ready_count: 1,
        knowledge_writeback_queued_count: 1,
        knowledge_writeback_needs_revision_count: 0,
      },
    },
    after: {
      status: 'ready',
      score: 96,
      summary: {
        seedance_placeholder_asset_count: 0,
        seedance_production_asset_ready_count: 5,
        knowledge_writeback_ready_count: 1,
        knowledge_writeback_queued_count: 1,
        knowledge_writeback_needs_revision_count: 0,
      },
    },
    deltas: {
      score: 0,
      status_rank: 0,
      blocker_count: 0,
      seedance_placeholder_asset_count: 0,
      seedance_production_asset_ready_count: 0,
      knowledge_writeback_ready_count: 0,
      knowledge_writeback_queued_count: 0,
      knowledge_writeback_needs_revision_count: 0,
    },
    failed_checks: [],
    warning_checks: [],
    recommended_actions: [],
  });
  writeEvidenceJson(evidenceDir, 'gears-large-project-response-audit.json', {
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

beforeEach(() => {
  process.env.KB_ROOT = dataRoot;
  fs.mkdirSync(path.join(dataRoot, 'provinces'), { recursive: true });
});

afterEach(() => {
  if (previousKbRoot === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = previousKbRoot;
  if (previousEvidenceDir === undefined) delete process.env.GEARS_EVIDENCE_DIR;
  else process.env.GEARS_EVIDENCE_DIR = previousEvidenceDir;
  if (previousAutoDiscover === undefined) delete process.env.GEARS_EVIDENCE_AUTO_DISCOVER;
  else process.env.GEARS_EVIDENCE_AUTO_DISCOVER = previousAutoDiscover;
  if (previousAutoDiscoverRoots === undefined) delete process.env.GEARS_EVIDENCE_AUTO_DISCOVER_ROOTS;
  else process.env.GEARS_EVIDENCE_AUTO_DISCOVER_ROOTS = previousAutoDiscoverRoots;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('kb_get_gears_worker_evidence_signoff', () => {
  it('blocks when evidence_dir is missing', async () => {
    delete process.env.GEARS_EVIDENCE_DIR;
    process.env.GEARS_EVIDENCE_AUTO_DISCOVER = '0';

    const result = await getGearsWorkerEvidenceSignoff({ include_markdown: false });

    expect(result.schema_version).toBe('mcp-gears-worker-evidence-signoff/v1');
    expect(result.status).toBe('blocked');
    expect(result.evidence_dir_allowed).toBe(false);
    expect(result.evidence_dir_error).toBe('missing_evidence_dir');
    expect(result.failed_gate_ids).toEqual(['evidence_dir']);
  });

  it('auto-discovers the latest worker evidence directory when no input or env dir is set', async () => {
    delete process.env.GEARS_EVIDENCE_DIR;
    process.env.GEARS_EVIDENCE_AUTO_DISCOVER = '1';
    process.env.GEARS_EVIDENCE_AUTO_DISCOVER_ROOTS = tmpRoot;
    const oldEvidenceDir = path.join(tmpRoot, 'gears-worker-evidence-old');
    const latestEvidenceDir = path.join(tmpRoot, 'gears-worker-evidence-new');
    writeCompleteEvidence(oldEvidenceDir);
    writeCompleteEvidence(latestEvidenceDir);

    const result = await getGearsWorkerEvidenceSignoff({ include_markdown: false });

    expect(result.status).toBe('ready');
    expect(result.evidence_dir).toBe(latestEvidenceDir);
    expect(result.evidence_dir_source).toBe('latest');
    expect(result.evidence_dir_allowed).toBe(true);
  });

  it('summarizes a complete evidence directory as ready', async () => {
    const evidenceDir = path.join(tmpRoot, 'gears-evidence-ready');
    writeCompleteEvidence(evidenceDir);

    const result = await getGearsWorkerEvidenceSignoff({ evidence_dir: evidenceDir });

    expect(result.status).toBe('ready');
    expect(result.evidence_dir_source).toBe('input');
    expect(result.acceptance_passed).toBe(true);
    expect(result.signoff_ready).toBe(true);
    expect(result.integrity_passed).toBe(true);
    expect(result.health_audit_passed).toBe(true);
    expect(result.production_material_pack_health_audit_passed).toBe(true);
    expect(result.domain_pack_production_health_audit_passed).toBe(true);
    expect(result.mvp_status_audit_passed).toBe(true);
    expect(result.mvp_governance_counts_consistent).toBe(true);
    expect(result.mvp_governance_counts_verdict_embedded).toBe(true);
    expect(result.mvp_governance_counts_archive_embedded).toBe(true);
    expect(result.mvp_governance_count_mismatch_ids).toEqual([]);
    expect(result.system_external_callback_passed).toBe(true);
    expect(result.system_external_callback_ready_to_import_count).toBe(3);
    expect(result.system_external_callback_updated_count).toBe(3);
    expect(result.system_external_output_url_source_ready).toBe(true);
    expect(result.system_external_output_url_imported).toBe(true);
    expect(result.system_external_output_url_import_match_count).toBe(1);
    expect(result.system_external_output_url_source).toBe('worker_response');
    expect(result.pressure_submitted).toBe(true);
    expect(result.worker_record_count).toBe(370);
    expect(result.worker_failure_category_counts).toEqual({ render_failed: 2 });
    expect(result.large_project_request_unit_count).toBe(120);
    expect(result.large_project_response_record_count).toBe(120);
    expect(result.large_project_source_echo_count).toBe(120);
    expect(result.production_material_pack_status_before).toBe('passed');
    expect(result.production_material_pack_status_after).toBe('passed');
    expect(result.production_material_pack_issue_count_delta).toBe(0);
    expect(result.production_material_pack_core_ready_count_before).toBe(4);
    expect(result.production_material_pack_core_ready_count_after).toBe(4);
    expect(result.domain_pack_status_before).toBe('passed');
    expect(result.domain_pack_status_after).toBe('passed');
    expect(result.domain_pack_issue_count_delta).toBe(0);
    expect(result.domain_pack_ready_count_before).toBe(8);
    expect(result.domain_pack_ready_count_after).toBe(8);
    expect(result.mvp_status_before).toBe('ready');
    expect(result.mvp_status_after).toBe('ready');
    expect(result.mvp_score_delta).toBe(0);
    expect(result.mvp_seedance_placeholder_asset_count_after).toBe(0);
    expect(result.mvp_seedance_production_asset_ready_count_after).toBe(5);
    expect(result.mvp_knowledge_writeback_ready_count_after).toBe(1);
    expect(result.mvp_knowledge_writeback_queued_count_after).toBe(1);
    expect(result.mvp_knowledge_writeback_needs_revision_count_after).toBe(0);
    expect(result.missing_required_files).toEqual([]);
    expect(result.gates).toEqual(expect.arrayContaining([
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
    expect(result.markdown).toContain('production_material_pack_health_audit_passed: true');
    expect(result.markdown).toContain('domain_pack_production_health_audit_passed: true');
    expect(result.markdown).toContain('system_external_callback_passed: true');
    expect(result.markdown).toContain('system_external_output_url_source: worker_response');
    expect(result.markdown).toContain('system_external_output_url_imported: true');
    expect(result.markdown).toContain('system_external_output_url_import_match_count: 1');
    expect(result.markdown).toContain('large_project_source_echo: 120/120');
    expect(result.markdown).toContain('mvp_score_delta: 0');
    expect(result.markdown).toContain('mvp_governance_counts_consistent: true');
    expect(result.markdown).toContain('mvp_governance_counts_embedded verdict/archive: true/true');
    expect(result.markdown).toContain('mvp_seedance_placeholder_before/after/delta: 0/0/0');
    expect(result.markdown).toContain('mvp_knowledge_writeback_queued_before/after/delta: 1/1/0');
  });

  it('requires embedded MVP governance counts to match the source audit', async () => {
    const evidenceDir = path.join(tmpRoot, 'gears-evidence-mvp-governance-mismatch');
    writeCompleteEvidence(evidenceDir);
    const verdictPath = path.join(evidenceDir, 'gears-worker-acceptance-verdict.json');
    const verdict = JSON.parse(fs.readFileSync(verdictPath, 'utf-8'));
    verdict.mvp_governance_counts.knowledge_writeback_queued_count.delta = 99;
    writeEvidenceJson(evidenceDir, 'gears-worker-acceptance-verdict.json', verdict);

    const result = await getGearsWorkerEvidenceSignoff({ evidence_dir: evidenceDir });

    expect(result.status).toBe('attention');
    expect(result.acceptance_passed).toBe(true);
    expect(result.signoff_ready).toBe(true);
    expect(result.integrity_passed).toBe(true);
    expect(result.mvp_status_audit_passed).toBe(true);
    expect(result.mvp_governance_counts_consistent).toBe(false);
    expect(result.mvp_governance_counts_verdict_embedded).toBe(true);
    expect(result.mvp_governance_counts_archive_embedded).toBe(true);
    expect(result.mvp_governance_count_mismatch_ids).toEqual([
      'verdict.knowledge_writeback_queued_count.delta',
    ]);
    expect(result.recommended_actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        evidence: 'mvp_governance_counts_inconsistent',
        gate_id: 'story_agent_mvp_status_audit',
      }),
    ]));
    expect(result.markdown).toContain('mvp_governance_counts_consistent: false');
    expect(result.markdown).toContain('mvp_governance_count_mismatch_ids: verdict.knowledge_writeback_queued_count.delta');
  });

  it('requires system external import evidence to contain the verified output URL', async () => {
    const evidenceDir = path.join(tmpRoot, 'gears-evidence-output-url-missing');
    writeCompleteEvidence(evidenceDir);
    writeEvidenceJson(evidenceDir, 'story-agent-system-external-callback-import-response.json', {
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
      },
    });

    const result = await getGearsWorkerEvidenceSignoff({ evidence_dir: evidenceDir });

    expect(result.status).toBe('attention');
    expect(result.acceptance_passed).toBe(true);
    expect(result.signoff_ready).toBe(true);
    expect(result.integrity_passed).toBe(true);
    expect(result.system_external_output_url_source_ready).toBe(true);
    expect(result.system_external_output_url_imported).toBe(false);
    expect(result.system_external_output_url_import_match_count).toBe(0);
    expect(result.system_external_callback_passed).toBe(false);
    expect(result.recommended_actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        evidence: 'system_external_output_url_not_imported',
        gate_id: 'system_external_callback_batch',
      }),
    ]));
    expect(result.markdown).toContain('system_external_output_url_imported: false');
  });

  it('deduplicates repeated recommended actions', async () => {
    const evidenceDir = path.join(tmpRoot, 'gears-evidence-dedupe');
    const action = {
      priority: 'P0',
      owner: 'GEARS v2 ops',
      evidence: 'transport_error_count',
      action: 'Fix GEARS worker reachability.',
    };
    writeCompleteEvidence(evidenceDir, [action, action]);

    const result = await getGearsWorkerEvidenceSignoff({ evidence_dir: evidenceDir, include_markdown: false });

    expect(result.recommended_actions).toEqual([expect.objectContaining(action)]);
  });

  it('rejects evidence directories outside allowed roots', async () => {
    const result = await getGearsWorkerEvidenceSignoff({ evidence_dir: '/etc', include_markdown: false });

    expect(result.status).toBe('blocked');
    expect(result.evidence_dir_allowed).toBe(false);
    expect(result.evidence_dir_error).toBe('evidence_dir_not_allowed');
  });
});
