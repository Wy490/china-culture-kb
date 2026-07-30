import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  finalDeliveryManifestDispositionLedgerPath,
  readFinalDeliveryManifestDispositionLedger,
  submitFinalDeliveryManifestDisposition,
} from '../services/final-delivery-manifest-disposition-ledger-service.js';

async function createManifestGapTarget(
  generatedRoot: string,
  projectId = 'manifest-gap-ledger-series',
): Promise<string> {
  const projectDir = resolve(
    generatedRoot,
    'ai-comic-series-projects',
    projectId,
  );
  await mkdir(projectDir, { recursive: true });
  await writeFile(resolve(projectDir, 'project.json'), `${JSON.stringify({
    project: {
      series_project_id: projectId,
      title: 'Manifest Gap Ledger Fixture',
    },
    seedance_final_delivery: {
      status: 'planned',
      dry_run: true,
      output_path: `delivery/${projectId}/final.mp4`,
    },
  }, null, 2)}\n`, 'utf8');
  return projectId;
}

function dispositionRequest(projectId: string) {
  return {
    series_project_id: projectId,
    disposition: 'preserve_fixture_exclude_from_publishable_delivery' as const,
    authorized_media_inputs_attested: false,
    operator: {
      operator_id: 'operator-ledger-001',
      display_name: 'Manifest Review Operator',
      identity_reference: 'internal-review-roster/operator-ledger-001',
    },
    decision: {
      rationale: '该目标仅为历史 dry-run fixture，保留审计记录并排除发布交付信用。',
      evidence_references: [
        'project.json#seedance_final_delivery',
        'governance-run#review_final_delivery_manifest_gaps',
      ],
    },
    attestation: {
      human_operator: true as const,
      reviewed_current_preflight: true as const,
      accepts_no_publishable_delivery_credit: true as const,
    },
    idempotency_key: 'manifest-disposition-20260730-0001',
  };
}

describe('final delivery manifest disposition ledger', () => {
  it('returns an honest empty state without inventing operator decisions', async () => {
    const generatedRoot = await mkdtemp(resolve(tmpdir(), 'manifest-disposition-empty-'));
    const ledger = await readFinalDeliveryManifestDispositionLedger({
      generatedRoot,
    });

    expect(ledger).toMatchObject({
      schema_version: 'story-agent-final-delivery-manifest-disposition-ledger/v1',
      summary: {
        recorded_decision_count: 0,
        operator_decisions_recorded: false,
      },
      entries: [],
      integrity: {
        chain_valid: true,
        invalid_event_count: 0,
      },
      boundary: {
        operator_identity_independently_verified: false,
        project_files_modified: false,
        manifest_written: false,
        final_assemble_invoked: false,
        publishable_delivery_credit_granted: false,
      },
    });
  });

  it('records a current preflight snapshot with hash-chain integrity and idempotency', async () => {
    const generatedRoot = await mkdtemp(resolve(tmpdir(), 'manifest-disposition-submit-'));
    const projectId = await createManifestGapTarget(generatedRoot);
    const projectPath = resolve(
      generatedRoot,
      'ai-comic-series-projects',
      projectId,
      'project.json',
    );
    const beforeProject = await readFile(projectPath, 'utf8');
    const request = dispositionRequest(projectId);

    const first = await submitFinalDeliveryManifestDisposition(request, {
      generatedRoot,
      now: () => new Date('2026-07-30T10:00:00.000Z'),
    });
    const replay = await submitFinalDeliveryManifestDisposition(request, {
      generatedRoot,
      now: () => new Date('2026-07-30T11:00:00.000Z'),
    });

    expect(first.idempotent_replay).toBe(false);
    expect(replay.idempotent_replay).toBe(true);
    expect(replay.event).toEqual(first.event);
    expect(first.event).toMatchObject({
      schema_version: 'story-agent-final-delivery-manifest-disposition-event/v1',
      sequence: 1,
      previous_event_sha256: null,
      series_project_id: projectId,
      disposition: request.disposition,
      operator: request.operator,
      decision: request.decision,
      attestation: request.attestation,
      preflight: {
        schema_version: 'story-agent-final-delivery-manifest-preflight/v1',
        status: 'ready',
        eligible_for_selected_disposition: true,
      },
      disposition_status: 'decision_recorded',
      boundary: {
        operator_decision_recorded: true,
        disposition_applied_to_project: false,
        project_files_modified: false,
        manifest_written: false,
        final_assemble_invoked: false,
        publishable_delivery_credit_granted: false,
      },
    });
    expect(first.event.event_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(await readFile(projectPath, 'utf8')).toBe(beforeProject);

    const ledger = await readFinalDeliveryManifestDispositionLedger({
      generatedRoot,
    });
    expect(ledger.summary).toMatchObject({
      recorded_decision_count: 1,
      operator_decisions_recorded: true,
      ready_preflight_count: 1,
      blocked_preflight_count: 0,
      disposition_counts: {
        preserve_fixture_exclude_from_publishable_delivery: 1,
        reexport_after_authorized_dependencies: 0,
      },
    });
    expect(ledger.integrity.chain_valid).toBe(true);
  });

  it('records a re-export decision as pending dependencies without granting execution credit', async () => {
    const generatedRoot = await mkdtemp(resolve(tmpdir(), 'manifest-disposition-blocked-'));
    const projectId = await createManifestGapTarget(generatedRoot);
    const request = dispositionRequest(projectId);
    const result = await submitFinalDeliveryManifestDisposition({
      ...request,
      disposition: 'reexport_after_authorized_dependencies',
      authorized_media_inputs_attested: true,
      decision: {
        ...request.decision,
        rationale: '操作员选择在全部授权媒体依赖通过后重导出，当前缺失依赖继续保持阻塞。',
      },
      idempotency_key: 'manifest-disposition-20260730-0002',
    }, { generatedRoot });

    expect(result.event).toMatchObject({
      disposition_status: 'decision_recorded_pending_dependencies',
      preflight: {
        status: 'blocked',
        eligible_for_selected_disposition: false,
      },
      boundary: {
        disposition_applied_to_project: false,
        publishable_delivery_credit_granted: false,
      },
    });
    expect(result.event.preflight.missing_dependencies.length).toBeGreaterThan(0);
  });

  it('rejects a target that is not a current final-delivery manifest gap', async () => {
    const generatedRoot = await mkdtemp(resolve(tmpdir(), 'manifest-disposition-stale-'));
    const projectId = await createManifestGapTarget(generatedRoot);
    const projectPath = resolve(
      generatedRoot,
      'ai-comic-series-projects',
      projectId,
      'project.json',
    );
    const record = JSON.parse(await readFile(projectPath, 'utf8')) as Record<string, any>;
    record.seedance_final_delivery.manifest_path =
      `delivery/${projectId}/final.manifest.json`;
    await writeFile(projectPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

    await expect(submitFinalDeliveryManifestDisposition(
      dispositionRequest(projectId),
      { generatedRoot },
    )).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects conflicting idempotency content and fails closed on tampering', async () => {
    const generatedRoot = await mkdtemp(resolve(tmpdir(), 'manifest-disposition-integrity-'));
    const projectId = await createManifestGapTarget(generatedRoot);
    const request = dispositionRequest(projectId);
    await submitFinalDeliveryManifestDisposition(request, { generatedRoot });

    await expect(submitFinalDeliveryManifestDisposition({
      ...request,
      decision: {
        ...request.decision,
        rationale: '使用相同幂等键提交另一条不同的人工处置理由，应被拒绝。',
      },
    }, { generatedRoot })).rejects.toMatchObject({
      code: 'REVIEW_WRITE_CONFLICT',
    });

    const ledgerPath = finalDeliveryManifestDispositionLedgerPath(generatedRoot);
    const stored = JSON.parse(await readFile(ledgerPath, 'utf8')) as {
      entries: Array<{ decision: { rationale: string } }>;
    };
    stored.entries[0].decision.rationale = 'tampered';
    await writeFile(ledgerPath, `${JSON.stringify(stored, null, 2)}\n`, 'utf8');

    await expect(readFinalDeliveryManifestDispositionLedger({ generatedRoot }))
      .rejects.toMatchObject({ code: 'REVIEW_STORAGE_UNAVAILABLE' });
  });
});
