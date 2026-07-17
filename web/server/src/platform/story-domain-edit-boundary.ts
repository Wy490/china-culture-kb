import type { StoryGenerateResult } from '@shared/types.js';
import type {
  DomainStoryRevisionGuidance,
  DomainStorySupplementGuidance,
} from './domain-pack.js';
import { resolveStorySourceDomain } from './story-source-domain.js';

export type StoryDomainEditOperation = 'story_revision' | 'story_supplement';

export interface StoryDomainEditPersistenceBoundary {
  readonly schema_version: 'story-domain-edit-persistence/v1';
  readonly domain_id: string;
  readonly operation: StoryDomainEditOperation;
  readonly project_version_append_allowed: boolean;
  readonly project_current_state_update_allowed: boolean;
  readonly generated_story_snapshot_sync_allowed: boolean;
  readonly domain_source_write_allowed: false;
  readonly knowledge_writeback_performed: false;
  readonly external_delivery_triggered: false;
  readonly migration_action_performed: false;
  readonly real_credit_granted: false;
}

export interface StoryDomainRevisionEditBoundary {
  readonly guidance: DomainStoryRevisionGuidance;
  readonly persistence: StoryDomainEditPersistenceBoundary;
}

export interface StoryDomainSupplementEditBoundary {
  readonly guidance: DomainStorySupplementGuidance;
  readonly persistence: StoryDomainEditPersistenceBoundary;
}

async function domainRegistry() {
  const { storyAgentDomainRegistry } = await import('./domain-registry.js');
  return storyAgentDomainRegistry;
}

function persistenceBoundary(
  domainId: string,
  operation: StoryDomainEditOperation,
): StoryDomainEditPersistenceBoundary {
  return {
    schema_version: 'story-domain-edit-persistence/v1',
    domain_id: domainId,
    operation,
    project_version_append_allowed: operation === 'story_revision',
    project_current_state_update_allowed: operation === 'story_supplement',
    generated_story_snapshot_sync_allowed: operation === 'story_supplement',
    domain_source_write_allowed: false,
    knowledge_writeback_performed: false,
    external_delivery_triggered: false,
    migration_action_performed: false,
    real_credit_granted: false,
  };
}

export async function getStoryDomainRevisionEditBoundary(
  story: StoryGenerateResult,
): Promise<StoryDomainRevisionEditBoundary> {
  const domainId = resolveStorySourceDomain(story);
  const pack = (await domainRegistry()).require(domainId);
  return {
    guidance: pack.revisionGuidance,
    persistence: persistenceBoundary(domainId, 'story_revision'),
  };
}

export async function getStoryDomainSupplementEditBoundary(
  story: StoryGenerateResult,
): Promise<StoryDomainSupplementEditBoundary> {
  const domainId = resolveStorySourceDomain(story);
  const pack = (await domainRegistry()).require(domainId);
  return {
    guidance: pack.supplementGuidance,
    persistence: persistenceBoundary(domainId, 'story_supplement'),
  };
}

export function formatStoryDomainEditPersistenceBoundary(
  boundary: StoryDomainEditPersistenceBoundary,
): string[] {
  return [
    `schema_version=${boundary.schema_version}`,
    `domain_id=${boundary.domain_id}`,
    `operation=${boundary.operation}`,
    `project_version_append_allowed=${boundary.project_version_append_allowed}`,
    `project_current_state_update_allowed=${boundary.project_current_state_update_allowed}`,
    `generated_story_snapshot_sync_allowed=${boundary.generated_story_snapshot_sync_allowed}`,
    `domain_source_write_allowed=${boundary.domain_source_write_allowed}`,
    `knowledge_writeback_performed=${boundary.knowledge_writeback_performed}`,
    `external_delivery_triggered=${boundary.external_delivery_triggered}`,
    `migration_action_performed=${boundary.migration_action_performed}`,
    `real_credit_granted=${boundary.real_credit_granted}`,
  ];
}

export function isStoryDomainEditPersistenceBoundarySafe(
  boundary: StoryDomainEditPersistenceBoundary,
): boolean {
  const operationMatches = boundary.operation === 'story_revision'
    ? (
        boundary.project_version_append_allowed
        && !boundary.project_current_state_update_allowed
        && !boundary.generated_story_snapshot_sync_allowed
      )
    : (
        !boundary.project_version_append_allowed
        && boundary.project_current_state_update_allowed
        && boundary.generated_story_snapshot_sync_allowed
      );
  return operationMatches
    && boundary.domain_source_write_allowed === false
    && boundary.knowledge_writeback_performed === false
    && boundary.external_delivery_triggered === false
    && boundary.migration_action_performed === false
    && boundary.real_credit_granted === false;
}
