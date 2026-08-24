import type {
  StoryProjectMeta,
  StoryProjectVersionSnapshot,
} from '@shared/types.js';
import type {
  ProjectCurrentStateInspection,
  ProjectRepository,
} from '../repositories/project-repository.js';
import { projectRepository } from './project-core-service.js';

type ReadOnlyProjectRepository = Pick<
  ProjectRepository,
  'listProjectIds' | 'inspectCurrentStateReadOnly'
>;

export type ProjectReadOnlyCurrentStateStatus =
  | 'readable'
  | 'metadata_unreadable'
  | 'current_version_unreadable'
  | 'inspection_failed';

export interface ProjectReadOnlyCurrentStateProjection {
  project_id: string;
  status: ProjectReadOnlyCurrentStateStatus;
  meta: StoryProjectMeta | null;
  snapshot: StoryProjectVersionSnapshot | null;
}

export interface ProjectReadOnlyRequestProjectionDiagnostics {
  schema_version: 'project-read-only-request-projection-diagnostics/v1';
  project_id_list_request_count: number;
  project_id_list_repository_call_count: number;
  project_id_list_cache_hit_count: number;
  current_state_request_count: number;
  current_state_repository_call_count: number;
  current_state_cache_hit_count: number;
  current_state_seed_request_count: number;
  current_state_seeded_count: number;
  current_state_seed_rejected_count: number;
  readable_project_count: number;
  failed_project_count: number;
  boundary: {
    request_scoped: true;
    read_only: true;
    repository_write_allowed: false;
    failed_projects_isolated: true;
    cross_request_cache_allowed: false;
    seed_validation_required: true;
    seed_overwrite_allowed: false;
  };
}

export interface ProjectReadOnlyRequestProjection {
  listProjectIds(): Promise<string[]>;
  seedCurrentState(projectId: string, state: ProjectCurrentStateInspection): boolean;
  inspectCurrentState(projectId: string): Promise<ProjectReadOnlyCurrentStateProjection>;
  diagnostics(): ProjectReadOnlyRequestProjectionDiagnostics;
}

export function createProjectReadOnlyRequestProjection(options: {
  repository?: ReadOnlyProjectRepository;
} = {}): ProjectReadOnlyRequestProjection {
  const repository = options.repository ?? projectRepository();
  let projectIdListPromise: Promise<readonly string[]> | undefined;
  let listedProjectIds: ReadonlySet<string> | undefined;
  let projectIdListRequestCount = 0;
  let projectIdListRepositoryCallCount = 0;
  let projectIdListCacheHitCount = 0;
  let currentStateRequestCount = 0;
  let currentStateRepositoryCallCount = 0;
  let currentStateCacheHitCount = 0;
  let currentStateSeedRequestCount = 0;
  let currentStateSeededCount = 0;
  let currentStateSeedRejectedCount = 0;
  const currentStatePromises = new Map<
    string,
    Promise<ProjectReadOnlyCurrentStateProjection>
  >();
  const resolvedCurrentStates = new Map<
    string,
    ProjectReadOnlyCurrentStateProjection
  >();

  const listProjectIds = async (): Promise<string[]> => {
    projectIdListRequestCount += 1;
    if (projectIdListPromise) {
      projectIdListCacheHitCount += 1;
      return [...await projectIdListPromise];
    }
    projectIdListRepositoryCallCount += 1;
    projectIdListPromise = repository.listProjectIds().then(ids => {
      const normalized = [...new Set(ids)].sort();
      listedProjectIds = new Set(normalized);
      return Object.freeze(normalized);
    });
    return [...await projectIdListPromise];
  };

  const seedCurrentState = (
    projectId: string,
    state: ProjectCurrentStateInspection,
  ): boolean => {
    currentStateSeedRequestCount += 1;
    if (!listedProjectIds?.has(projectId) || currentStatePromises.has(projectId)) {
      currentStateSeedRejectedCount += 1;
      return false;
    }
    const classified = classifyCurrentState(projectId, state);
    if (classified.status !== 'readable') {
      currentStateSeedRejectedCount += 1;
      return false;
    }
    const frozen = Object.freeze(classified);
    currentStatePromises.set(projectId, Promise.resolve(frozen));
    resolvedCurrentStates.set(projectId, frozen);
    currentStateSeededCount += 1;
    return true;
  };

  const inspectCurrentState = async (
    projectId: string,
  ): Promise<ProjectReadOnlyCurrentStateProjection> => {
    currentStateRequestCount += 1;
    const existing = currentStatePromises.get(projectId);
    if (existing) {
      currentStateCacheHitCount += 1;
      return existing;
    }
    currentStateRepositoryCallCount += 1;
    const pending = repository.inspectCurrentStateReadOnly(projectId)
      .then(state => classifyCurrentState(projectId, state))
      .catch((): ProjectReadOnlyCurrentStateProjection => ({
        project_id: projectId,
        status: 'inspection_failed',
        meta: null,
        snapshot: null,
      }))
      .then(result => {
        const frozen = Object.freeze(result);
        resolvedCurrentStates.set(projectId, frozen);
        return frozen;
      });
    currentStatePromises.set(projectId, pending);
    return pending;
  };

  return {
    listProjectIds,
    seedCurrentState,
    inspectCurrentState,
    diagnostics: () => ({
      schema_version: 'project-read-only-request-projection-diagnostics/v1',
      project_id_list_request_count: projectIdListRequestCount,
      project_id_list_repository_call_count: projectIdListRepositoryCallCount,
      project_id_list_cache_hit_count: projectIdListCacheHitCount,
      current_state_request_count: currentStateRequestCount,
      current_state_repository_call_count: currentStateRepositoryCallCount,
      current_state_cache_hit_count: currentStateCacheHitCount,
      current_state_seed_request_count: currentStateSeedRequestCount,
      current_state_seeded_count: currentStateSeededCount,
      current_state_seed_rejected_count: currentStateSeedRejectedCount,
      readable_project_count: [...resolvedCurrentStates.values()].filter(
        item => item.status === 'readable',
      ).length,
      failed_project_count: [...resolvedCurrentStates.values()].filter(
        item => item.status !== 'readable',
      ).length,
      boundary: {
        request_scoped: true,
        read_only: true,
        repository_write_allowed: false,
        failed_projects_isolated: true,
        cross_request_cache_allowed: false,
        seed_validation_required: true,
        seed_overwrite_allowed: false,
      },
    }),
  };
}

function classifyCurrentState(
  projectId: string,
  state: ProjectCurrentStateInspection,
): ProjectReadOnlyCurrentStateProjection {
  const { meta, snapshot } = state;
  if (
    !meta
    || meta.project_id !== projectId
    || !meta.current_story_id
    || !meta.current_version_id
  ) {
    return {
      project_id: projectId,
      status: 'metadata_unreadable',
      meta: null,
      snapshot: null,
    };
  }
  if (
    !snapshot
    || snapshot.project_id !== projectId
    || snapshot.version_id !== meta.current_version_id
    || !snapshot.story
    || snapshot.story.storyId !== meta.current_story_id
  ) {
    return {
      project_id: projectId,
      status: 'current_version_unreadable',
      meta,
      snapshot: null,
    };
  }
  return {
    project_id: projectId,
    status: 'readable',
    meta,
    snapshot,
  };
}
