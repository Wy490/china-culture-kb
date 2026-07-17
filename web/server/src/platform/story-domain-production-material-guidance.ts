import type { StoryGenerateResult } from '@shared/types.js';
import type { DomainProductionMaterialGuidance } from './domain-pack.js';
import { resolveStorySourceDomain } from './story-source-domain.js';

async function domainRegistry() {
  const { storyAgentDomainRegistry } = await import('./domain-registry.js');
  return storyAgentDomainRegistry;
}

export async function getStoryDomainProductionMaterialGuidance(
  story: StoryGenerateResult,
): Promise<DomainProductionMaterialGuidance> {
  const domainId = resolveStorySourceDomain(story);
  return (await domainRegistry()).require(domainId).productionMaterialGuidance;
}
