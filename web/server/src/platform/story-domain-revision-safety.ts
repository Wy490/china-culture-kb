import type { StoryDomainSafetyReport, StoryGenerateResult } from '@shared/types.js';
import type { DomainStoryRevisionGuidance } from './domain-pack.js';
import { getStoryDomainRevisionEditBoundary } from './story-domain-edit-boundary.js';
import { resolveStorySourceDomain } from './story-source-domain.js';

async function domainRegistry() {
  const { storyAgentDomainRegistry } = await import('./domain-registry.js');
  return storyAgentDomainRegistry;
}

export async function getStoryDomainRevisionGuidance(
  story: StoryGenerateResult,
): Promise<DomainStoryRevisionGuidance> {
  return (await getStoryDomainRevisionEditBoundary(story)).guidance;
}

function unavailableSourceReport(
  domain: string,
  sourceEntry: string,
  message: string,
): StoryDomainSafetyReport {
  return {
    schema_version: 'story-domain-safety/v1',
    domain,
    passed: false,
    evaluated_rule_ids: ['DOMAIN-REVISION-SOURCE-ENTRY'],
    blockers: [{
      rule_id: 'DOMAIN-REVISION-SOURCE-ENTRY',
      severity: 'blocker',
      message: `修订复验无法解析来源条目“${sourceEntry}”：${message}`,
    }],
    warnings: [],
    machine_validation_only: true,
    human_review_complete: false,
    real_credit_granted: false,
  };
}

/**
 * Stories already governed by a domain_safety report must re-run their
 * registered Domain Pack rules before a repaired version can be persisted.
 * Legacy snapshots without that report keep their compatibility behavior
 * until an explicit safety migration is performed.
 */
export async function revalidateStoryDomainRevision(
  story: StoryGenerateResult,
): Promise<StoryDomainSafetyReport | undefined> {
  if (!story.domain_safety) return undefined;
  return validateStoryAgainstRegisteredDomain(story);
}

export async function validateStoryAgainstRegisteredDomain(
  story: StoryGenerateResult,
): Promise<StoryDomainSafetyReport> {
  const domain = resolveStorySourceDomain(story);
  const pack = (await domainRegistry()).require(domain);
  const source = await pack.getEntryDetail(story.source_entry);
  if (!source.ok || !source.data) {
    return unavailableSourceReport(
      domain,
      story.source_entry,
      source.error?.message ?? 'source entry is unavailable',
    );
  }
  return pack.validateStoryContent({ story, source_entry: source.data });
}
