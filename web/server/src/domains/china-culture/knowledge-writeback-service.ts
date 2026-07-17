import type { StoryGenerateResult } from '@shared/types.js';
import type { DomainKnowledgeWritebackPlan } from '../../platform/domain-pack.js';
import { chinaCultureProvinces } from './knowledge-source-adapter.js';

const PROVINCE_SET = new Set<string>(chinaCultureProvinces);

export function planChinaCultureKnowledgeWriteback(
  story: StoryGenerateResult,
): DomainKnowledgeWritebackPlan {
  const entries = [
    ...(story.knowledge_pack?.primary_entries ?? []),
    ...(story.knowledge_pack?.supporting_entries ?? []),
  ];
  const matched = entries.find(entry => entry.entry_name === story.source_entry) ?? entries[0];
  const province = matched?.province?.trim();
  const canonicalProvince = province && PROVINCE_SET.has(province) ? province : undefined;
  const blockers = canonicalProvince
    ? []
    : [province
        ? `source_entry_province_not_canonical:${province}`
        : 'source_entry_province_missing'];

  return {
    schema_version: 'story-domain-knowledge-writeback-plan/v1',
    domain_id: 'china_culture',
    target_kind: 'domain_document',
    eligible: blockers.length === 0,
    ...(canonicalProvince
      ? {
          target_region: canonicalProvince,
          suggested_file_path: `data/provinces/${canonicalProvince}.md`,
          suggested_section_heading: story.source_entry,
        }
      : {}),
    blockers,
    requires_human_review: true,
    direct_writeback_allowed: false,
    writeback_performed: false,
    real_credit_granted: false,
  };
}
