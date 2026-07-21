import type { EntryDetail, StoryDomainSafetyReport, StoryGenerateResult } from '@shared/types.js';
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

const EMBEDDED_USER_MATERIAL_LABELS = [
  '用户原创故事种子',
  '用户小说改编素材',
  '用户项目素材',
  '项目素材',
] as const;

function embeddedUserMaterialRevisionSource(story: StoryGenerateResult): EntryDetail | undefined {
  const sourceEntry = story.source_entry.trim();
  const knowledgeEntry = story.knowledge_pack?.primary_entries.find(item => (
    item.entry_name.trim() === sourceEntry
  ));
  const material = story.material_pack?.primary_materials.find(item => (
    item.linked_entry_name?.trim() === sourceEntry || item.title.trim() === sourceEntry
  ));
  const hasUserMaterialLabel = EMBEDDED_USER_MATERIAL_LABELS.some(label => (
    sourceEntry.endsWith(`——${label}`)
  ));
  const hasUserMaterialScope = knowledgeEntry?.province === '用户素材'
    || knowledgeEntry?.province === '项目素材';
  if (!knowledgeEntry || !material || !hasUserMaterialLabel || !hasUserMaterialScope) {
    return undefined;
  }

  const sourceText = material.summary.trim() || knowledgeEntry.summary.trim();
  if (!sourceText) return undefined;
  const fictionalOriginal = story.truth_mode === 'fictional_original';
  const sourceAdaptation = story.truth_mode === 'source_adaptation';
  return {
    name: sourceEntry,
    province: knowledgeEntry.province,
    region: knowledgeEntry.region,
    type: knowledgeEntry.type,
    summary: sourceText.substring(0, 180),
    story: sourceText,
    culturalSignificance: fictionalOriginal
      ? '用户提供的原创故事种子，系统可扩展为影视前期创作方案与剧本结构。'
      : sourceAdaptation
        ? '用户提供的原创或授权故事文本，系统仅做视频化改编与制作拆解。'
        : '用户提供的项目素材，系统可据此生成待审制作草案。',
    relatedLocations: [],
    keywords: knowledgeEntry.keywords,
    sources: [material.provenance || '用户提供素材'],
    credibility: '用户提供',
    verificationMethod: fictionalOriginal
      ? '原创虚构模式下不把故事设定写成历史事实；如涉及真实机构、地域或人物需另行核验。'
      : sourceAdaptation
        ? '用户素材主导，素材库仅作时代、地域和资产校准。'
        : '用户提供的事实、数据、机构口径和历史细节必须核验。',
    unverifiedPoints: story.material_pack?.uncertain_claims ?? [],
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
  const registeredSource = await pack.getEntryDetail(story.source_entry);
  const source = registeredSource.ok && registeredSource.data
    ? registeredSource.data
    : embeddedUserMaterialRevisionSource(story);
  if (!source) {
    return unavailableSourceReport(
      domain,
      story.source_entry,
      registeredSource.error?.message ?? 'source entry is unavailable',
    );
  }
  return pack.validateStoryContent({ story, source_entry: source });
}
