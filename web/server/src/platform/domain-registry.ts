import { chinaCultureDomainPack } from '../domains/china-culture/domain-pack.js';
import { DomainPackRegistry } from './domain-pack.js';

export function createStoryAgentDomainRegistry(): DomainPackRegistry {
  const registry = new DomainPackRegistry();
  registry.register(chinaCultureDomainPack);
  return registry;
}

export const storyAgentDomainRegistry = createStoryAgentDomainRegistry();
