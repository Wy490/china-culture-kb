import type {
  ProjectExternalEvidenceSourceStorySyncHealthPortfolioReport,
  ProjectExternalEvidenceSourceStorySyncHealthReport,
  StoryGenerateResult,
} from '@shared/types.js';
import type { ProjectRepository } from '../repositories/project-repository.js';
import { parseProjectId, projectRepository } from './project-core-service.js';
import type {
  ProjectReadOnlyRequestProjection,
} from './project-read-only-request-projection-service.js';
import {
  inspectProjectExternalEvidenceSourceStorySync,
} from './project-source-story-sync-service.js';

type ReadOnlyProjectRepository = Pick<
  ProjectRepository,
  'listProjectIds' | 'inspectCurrentStateReadOnly'
>;

type SyncHealthInspector = (input: {
  projectId: string;
  projectStory: StoryGenerateResult;
}) => Promise<ProjectExternalEvidenceSourceStorySyncHealthReport>;

interface SyncHealthPortfolioOptions {
  limit?: number;
  generatedAt?: string;
  repository?: ReadOnlyProjectRepository;
  readOnlyProjection?: ProjectReadOnlyRequestProjection;
  inspect?: SyncHealthInspector;
}

const STATUS_RANK: Record<ProjectExternalEvidenceSourceStorySyncHealthReport['status'], number> = {
  blocked: 0,
  recovery_required: 1,
  source_story_absent: 2,
  consistent: 3,
};
const READ_CONCURRENCY = 16;

function boundedLimit(value?: number): number {
  if (!Number.isFinite(value)) return 200;
  return Math.min(500, Math.max(1, Math.floor(value!)));
}

function unreadableProjectHealth(input: {
  projectId: string;
  storyId?: string;
  reason: 'project_metadata_unreadable' | 'project_current_version_unreadable';
}): ProjectExternalEvidenceSourceStorySyncHealthReport {
  return {
    schema_version: 'project-external-evidence-source-story-sync-health/v1',
    project_id: input.projectId,
    story_id: input.storyId ?? parseProjectId(input.projectId)?.storyId ?? input.projectId,
    status: 'blocked',
    machine_read_only: true,
    recovery_required: false,
    automatic_recovery_safe: false,
    source_story_update_required: false,
    source_story_overwritten: false,
    external_evidence_credit_granted: false,
    project_candidate_count: 0,
    source_candidate_count: 0,
    project_verification_event_count: 0,
    source_verification_event_count: 0,
    project_verification_head_sha256: null,
    source_verification_head_sha256: null,
    reason: input.reason,
    recommended_action: 'investigate_ledger_divergence',
  };
}

function hasExternalEvidenceActivity(
  item: ProjectExternalEvidenceSourceStorySyncHealthReport,
): boolean {
  return item.status !== 'consistent'
    || item.project_candidate_count > 0
    || item.source_candidate_count > 0
    || item.project_verification_event_count > 0
    || item.source_verification_event_count > 0;
}

function countStatus(
  items: ProjectExternalEvidenceSourceStorySyncHealthReport[],
  status: ProjectExternalEvidenceSourceStorySyncHealthReport['status'],
): number {
  return items.filter(item => item.status === status).length;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  await Promise.all(Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index]);
      }
    },
  ));
  return results;
}

export async function getProjectExternalEvidenceSourceStorySyncHealthPortfolio(
  options: SyncHealthPortfolioOptions = {},
): Promise<ProjectExternalEvidenceSourceStorySyncHealthPortfolioReport> {
  const repository = options.repository ?? projectRepository();
  const inspect = options.inspect ?? inspectProjectExternalEvidenceSourceStorySync;
  const projectIds = options.readOnlyProjection
    ? await options.readOnlyProjection.listProjectIds()
    : await repository.listProjectIds();
  let readableCurrentProjectCount = 0;

  const inspected = await mapWithConcurrency(projectIds, READ_CONCURRENCY, async projectId => {
    if (options.readOnlyProjection) {
      const projected = await options.readOnlyProjection.inspectCurrentState(projectId);
      if (projected.status === 'current_version_unreadable') {
        return unreadableProjectHealth({
          projectId,
          storyId: projected.meta?.current_story_id,
          reason: 'project_current_version_unreadable',
        });
      }
      if (projected.status !== 'readable' || !projected.snapshot?.story) {
        return unreadableProjectHealth({ projectId, reason: 'project_metadata_unreadable' });
      }
      readableCurrentProjectCount += 1;
      return inspect({ projectId, projectStory: projected.snapshot.story });
    }

    let currentState;
    try {
      currentState = await repository.inspectCurrentStateReadOnly(projectId);
    } catch {
      return unreadableProjectHealth({ projectId, reason: 'project_metadata_unreadable' });
    }
    const { meta, snapshot } = currentState;
    if (!meta?.current_version_id) {
      return unreadableProjectHealth({
        projectId,
        storyId: meta?.current_story_id,
        reason: 'project_metadata_unreadable',
      });
    }
    if (!snapshot?.story || snapshot.story.storyId !== meta.current_story_id) {
      return unreadableProjectHealth({
        projectId,
        storyId: meta.current_story_id,
        reason: 'project_current_version_unreadable',
      });
    }
    readableCurrentProjectCount += 1;
    return inspect({ projectId, projectStory: snapshot.story });
  });

  const relevantItems = inspected.filter(hasExternalEvidenceActivity).sort((left, right) => {
    const statusDiff = STATUS_RANK[left.status] - STATUS_RANK[right.status];
    if (statusDiff !== 0) return statusDiff;
    return left.project_id.localeCompare(right.project_id);
  });
  const blockedCount = countStatus(relevantItems, 'blocked');
  const recoveryRequiredCount = countStatus(relevantItems, 'recovery_required');
  const sourceStoryAbsentCount = countStatus(relevantItems, 'source_story_absent');
  const attentionRequiredCount = blockedCount + recoveryRequiredCount + sourceStoryAbsentCount;
  const limit = boundedLimit(options.limit);
  const items = relevantItems.slice(0, limit);

  return {
    schema_version: 'project-external-evidence-source-story-sync-health-portfolio/v1',
    generated_at: options.generatedAt ?? new Date().toISOString(),
    status: blockedCount > 0
      ? 'blocked'
      : attentionRequiredCount > 0
        ? 'attention_required'
        : 'healthy',
    machine_read_only: true,
    project_store_modified: false,
    source_story_store_modified: false,
    external_evidence_credit_granted: false,
    summary: {
      scanned_project_count: projectIds.length,
      readable_current_project_count: readableCurrentProjectCount,
      external_evidence_project_count: relevantItems.length,
      consistent_count: countStatus(relevantItems, 'consistent'),
      recovery_required_count: recoveryRequiredCount,
      source_story_absent_count: sourceStoryAbsentCount,
      blocked_count: blockedCount,
      automatic_recovery_safe_count: relevantItems.filter(item => item.automatic_recovery_safe).length,
      attention_required_count: attentionRequiredCount,
    },
    item_limit: limit,
    item_count: items.length,
    items_truncated: relevantItems.length > items.length,
    items,
  };
}
