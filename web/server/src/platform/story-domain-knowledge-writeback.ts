import type { StoryGenerateResult } from '@shared/types.js';
import {
  DomainPackNotFoundError,
  type DomainPack,
  type DomainKnowledgeWritebackPlan,
} from './domain-pack.js';
import { resolveStorySourceDomain } from './story-source-domain.js';

async function domainRegistry() {
  const { storyAgentDomainRegistry } = await import('./domain-registry.js');
  return storyAgentDomainRegistry;
}

function failClosedPlan(
  domainId: string,
  reason: string,
): DomainKnowledgeWritebackPlan {
  return {
    schema_version: 'story-domain-knowledge-writeback-plan/v1',
    domain_id: domainId,
    target_kind: 'none',
    eligible: false,
    blockers: [reason],
    requires_human_review: true,
    direct_writeback_allowed: false,
    writeback_performed: false,
    real_credit_granted: false,
  };
}

function validatePlan(
  domainId: string,
  plan: DomainKnowledgeWritebackPlan,
): DomainKnowledgeWritebackPlan {
  const validCommonShape = plan
    && plan.schema_version === 'story-domain-knowledge-writeback-plan/v1'
    && plan.domain_id === domainId
    && (plan.target_kind === 'domain_document' || plan.target_kind === 'none')
    && typeof plan.eligible === 'boolean'
    && Array.isArray(plan.blockers)
    && plan.blockers.every(blocker => typeof blocker === 'string' && Boolean(blocker.trim()))
    && plan.requires_human_review === true
    && plan.direct_writeback_allowed === false
    && plan.writeback_performed === false
    && plan.real_credit_granted === false;
  if (!validCommonShape) {
    return failClosedPlan(domainId, 'domain_pack_returned_invalid_knowledge_writeback_plan');
  }

  const targetPath = plan.suggested_file_path;
  const targetPathSegments = targetPath?.split('/') ?? [];
  const hasSafeTargetPath = Boolean(
    targetPath
    && targetPath === targetPath.trim()
    && !targetPath.startsWith('/')
    && !targetPath.includes('\\')
    && targetPathSegments.length > 1
    && targetPathSegments.every(segment => (
      Boolean(segment)
      && segment !== '.'
      && segment !== '..'
      && !segment.includes('\0')
    )),
  );
  const hasCompleteTarget = Boolean(
    hasSafeTargetPath
    && plan.suggested_section_heading?.trim(),
  );
  if (
    plan.eligible
    && (
      plan.target_kind === 'none'
      || plan.blockers.length > 0
      || !hasCompleteTarget
    )
  ) {
    return failClosedPlan(domainId, 'domain_pack_returned_incomplete_knowledge_writeback_target');
  }
  if (
    !plan.eligible
    && (
      plan.blockers.length === 0
      || plan.target_region !== undefined
      || plan.suggested_file_path !== undefined
      || plan.suggested_section_heading !== undefined
    )
  ) {
    return failClosedPlan(domainId, 'domain_pack_returned_unsafe_blocked_knowledge_writeback_target');
  }
  return plan;
}

export async function planStoryDomainKnowledgeWriteback(
  story: StoryGenerateResult,
): Promise<DomainKnowledgeWritebackPlan> {
  const domainId = resolveStorySourceDomain(story);
  let pack: DomainPack;
  try {
    pack = (await domainRegistry()).require(domainId);
  } catch (error) {
    if (error instanceof DomainPackNotFoundError) {
      return failClosedPlan(domainId, 'domain_pack_not_registered');
    }
    throw error;
  }
  return validatePlan(domainId, pack.planKnowledgeWriteback(story));
}
