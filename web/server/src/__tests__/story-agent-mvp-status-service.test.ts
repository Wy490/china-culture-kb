import { describe, expect, it } from 'vitest';
import type { ProjectExternalEvidenceSourceStorySyncHealthPortfolioReport } from '@shared/types.js';
import { externalEvidenceSyncHealthLane } from '../services/story-agent-mvp-status-service.js';

function portfolio(
  overrides: Partial<ProjectExternalEvidenceSourceStorySyncHealthPortfolioReport> = {},
): ProjectExternalEvidenceSourceStorySyncHealthPortfolioReport {
  return {
    schema_version: 'project-external-evidence-source-story-sync-health-portfolio/v1',
    generated_at: '2026-08-22T09:00:00.000Z',
    status: 'healthy',
    machine_read_only: true,
    project_store_modified: false,
    source_story_store_modified: false,
    external_evidence_credit_granted: false,
    summary: {
      scanned_project_count: 5,
      readable_current_project_count: 5,
      external_evidence_project_count: 0,
      consistent_count: 0,
      recovery_required_count: 0,
      source_story_absent_count: 0,
      blocked_count: 0,
      automatic_recovery_safe_count: 0,
      attention_required_count: 0,
    },
    item_limit: 20,
    item_count: 0,
    items_truncated: false,
    items: [],
    ...overrides,
  };
}

describe('Story Agent MVP external evidence sync-health lane', () => {
  it('keeps an empty healthy portfolio ready without granting evidence completion credit', () => {
    const lane = externalEvidenceSyncHealthLane(portfolio());

    expect(lane).toMatchObject({
      key: 'external_evidence_sync_health',
      status: 'ready',
      score: 100,
      evidence: expect.arrayContaining([
        'external_evidence_projects=0',
        'machine_read_only=true',
        'project_store_modified=false',
        'source_story_store_modified=false',
        'external_evidence_credit_granted=false',
      ]),
    });
    expect(lane.detail).toContain('does not prove that real external evidence requirements are complete');
    expect(lane.next_action).toBeUndefined();
  });

  it('surfaces replay-safe and manual recovery work as needs_action', () => {
    const report = portfolio({
      status: 'attention_required',
      summary: {
        scanned_project_count: 5,
        readable_current_project_count: 5,
        external_evidence_project_count: 3,
        consistent_count: 1,
        recovery_required_count: 1,
        source_story_absent_count: 1,
        blocked_count: 0,
        automatic_recovery_safe_count: 1,
        attention_required_count: 2,
      },
    });

    const lane = externalEvidenceSyncHealthLane(report);

    expect(lane).toMatchObject({
      key: 'external_evidence_sync_health',
      status: 'needs_action',
      evidence: expect.arrayContaining([
        'recovery_required=1',
        'source_story_absent=1',
        'automatic_recovery_safe=1',
        'attention_required=2',
      ]),
    });
    expect(lane.next_action).toContain('replay-safe');
    expect(lane.next_action).toContain('source-story-absent');
  });

  it('blocks MVP status when ledger divergence or unreadable current state exists', () => {
    const report = portfolio({
      status: 'blocked',
      summary: {
        scanned_project_count: 5,
        readable_current_project_count: 4,
        external_evidence_project_count: 1,
        consistent_count: 0,
        recovery_required_count: 0,
        source_story_absent_count: 0,
        blocked_count: 1,
        automatic_recovery_safe_count: 0,
        attention_required_count: 1,
      },
    });

    const lane = externalEvidenceSyncHealthLane(report);

    expect(lane).toMatchObject({
      key: 'external_evidence_sync_health',
      status: 'blocked',
      evidence: expect.arrayContaining(['blocked=1']),
    });
    expect(lane.next_action).toContain('ledger divergence');
    expect(lane.next_action).toContain('before replay');
  });
});
