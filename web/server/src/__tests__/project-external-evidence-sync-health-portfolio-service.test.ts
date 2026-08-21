import { describe, expect, it, vi } from 'vitest';
import type {
  ProjectExternalEvidenceSourceStorySyncHealthReport,
  StoryGenerateResult,
  StoryProjectMeta,
  StoryProjectVersionSnapshot,
} from '@shared/types.js';
import {
  getProjectExternalEvidenceSourceStorySyncHealthPortfolio,
} from '../services/project-external-evidence-sync-health-portfolio-service.js';

function story(storyId: string): StoryGenerateResult {
  return {
    storyId,
    title: storyId,
    generation_type: 'character_story',
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '测试条目',
    logline: '测试',
    theme: '测试',
    full_text: '测试',
    scene_breakdown: [],
    gears_segments: [],
    gears_segments_url: '',
    cultural_constraints: [],
    credibility_note: '测试',
  };
}

function health(
  projectId: string,
  status: ProjectExternalEvidenceSourceStorySyncHealthReport['status'],
  candidateCount: number,
): ProjectExternalEvidenceSourceStorySyncHealthReport {
  const recoveryRequired = status === 'recovery_required';
  return {
    schema_version: 'project-external-evidence-source-story-sync-health/v1',
    project_id: projectId,
    story_id: projectId.split('--')[0],
    status,
    machine_read_only: true,
    recovery_required: recoveryRequired,
    automatic_recovery_safe: recoveryRequired,
    source_story_update_required: recoveryRequired,
    source_story_overwritten: false,
    external_evidence_credit_granted: false,
    project_candidate_count: candidateCount,
    source_candidate_count: status === 'consistent' ? candidateCount : 0,
    project_verification_event_count: candidateCount,
    source_verification_event_count: status === 'consistent' ? candidateCount : 0,
    project_verification_head_sha256: candidateCount ? 'a'.repeat(64) : null,
    source_verification_head_sha256: status === 'consistent' && candidateCount ? 'a'.repeat(64) : null,
    recommended_action: status === 'recovery_required'
      ? 'replay_last_external_evidence_operation'
      : status === 'source_story_absent'
        ? 'restore_source_story_or_keep_project_only'
        : status === 'blocked'
          ? 'investigate_ledger_divergence'
          : 'none',
  };
}

describe('project external evidence sync health portfolio', () => {
  it('aggregates only evidence-active projects without invoking repository writes', async () => {
    const projectIds = [
      '20260821-story-consistent--character_story',
      '20260821-story-recovery--character_story',
      '20260821-story-sourceabsent--character_story',
      '20260821-story-blocked--character_story',
      '20260821-story-noevidence--character_story',
      '20260821-story-unreadable--character_story',
    ];
    const metas = new Map(projectIds.slice(0, 5).map((projectId, index) => [projectId, {
      project_id: projectId,
      current_story_id: projectId.split('--')[0],
      current_version_id: `${projectId}-v1`,
      version_count: 1,
      updated_at: `2026-08-21T15:0${index}:00.000Z`,
    } as StoryProjectMeta]));
    const repository = {
      listProjectIds: vi.fn(async () => projectIds),
      inspectCurrentStateReadOnly: vi.fn(async (projectId: string) => {
        const meta = metas.get(projectId) ?? null;
        return {
          meta,
          snapshot: meta ? {
            project_id: projectId,
            version_id: meta.current_version_id,
            created_at: '2026-08-21T15:00:00.000Z',
            change_type: 'initial_generation',
            scene_ids_changed: [],
            story: story(projectId.split('--')[0]),
          } as StoryProjectVersionSnapshot : null,
        };
      }),
    };
    const statuses = new Map<ProjectExternalEvidenceSourceStorySyncHealthReport['project_id'], {
      status: ProjectExternalEvidenceSourceStorySyncHealthReport['status'];
      candidates: number;
    }>([
      [projectIds[0], { status: 'consistent', candidates: 1 }],
      [projectIds[1], { status: 'recovery_required', candidates: 1 }],
      [projectIds[2], { status: 'source_story_absent', candidates: 1 }],
      [projectIds[3], { status: 'blocked', candidates: 1 }],
      [projectIds[4], { status: 'consistent', candidates: 0 }],
    ]);
    const inspect = vi.fn(async ({ projectId }: { projectId: string }) => {
      const item = statuses.get(projectId)!;
      return health(projectId, item.status, item.candidates);
    });

    const report = await getProjectExternalEvidenceSourceStorySyncHealthPortfolio({
      limit: 10,
      generatedAt: '2026-08-21T16:00:00.000Z',
      repository,
      inspect,
    });

    expect(report).toMatchObject({
      schema_version: 'project-external-evidence-source-story-sync-health-portfolio/v1',
      generated_at: '2026-08-21T16:00:00.000Z',
      status: 'blocked',
      machine_read_only: true,
      project_store_modified: false,
      source_story_store_modified: false,
      external_evidence_credit_granted: false,
      summary: {
        scanned_project_count: 6,
        readable_current_project_count: 5,
        external_evidence_project_count: 5,
        consistent_count: 1,
        recovery_required_count: 1,
        source_story_absent_count: 1,
        blocked_count: 2,
        automatic_recovery_safe_count: 1,
        attention_required_count: 4,
      },
      item_limit: 10,
      item_count: 5,
      items_truncated: false,
    });
    expect(report.items.map(item => item.status)).toEqual([
      'blocked',
      'blocked',
      'recovery_required',
      'source_story_absent',
      'consistent',
    ]);
    expect(report.items).not.toContainEqual(expect.objectContaining({
      project_id: projectIds[4],
    }));
    expect(repository.listProjectIds).toHaveBeenCalledTimes(1);
    expect(repository.inspectCurrentStateReadOnly).toHaveBeenCalledTimes(6);
    expect(inspect).toHaveBeenCalledTimes(5);
  });
});
