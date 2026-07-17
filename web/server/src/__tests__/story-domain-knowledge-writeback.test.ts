import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { StoryGenerateResult } from '@shared/types.js';
import { planStoryDomainKnowledgeWriteback } from '../platform/story-domain-knowledge-writeback.js';

function storyForWriteback(
  sourceDomain: string,
  province?: string,
): StoryGenerateResult {
  return {
    sourceDomain,
    source_entry: '测试来源条目',
    knowledge_pack: {
      primary_entries: [{
        entry_name: '测试来源条目',
        province,
      }],
      supporting_entries: [],
    },
  } as unknown as StoryGenerateResult;
}

describe('story domain knowledge writeback', () => {
  it('lets china_culture own the canonical province Markdown target', async () => {
    const plan = await planStoryDomainKnowledgeWriteback(
      storyForWriteback('china_culture', '湖南'),
    );

    expect(plan).toEqual({
      schema_version: 'story-domain-knowledge-writeback-plan/v1',
      domain_id: 'china_culture',
      target_kind: 'domain_document',
      eligible: true,
      target_region: '湖南',
      suggested_file_path: 'data/provinces/湖南.md',
      suggested_section_heading: '测试来源条目',
      blockers: [],
      requires_human_review: true,
      direct_writeback_allowed: false,
      writeback_performed: false,
      real_credit_granted: false,
    });
  });

  it.each([
    [undefined, 'source_entry_province_missing'],
    ['../湖南', 'source_entry_province_not_canonical:../湖南'],
  ])('fails closed without a canonical china_culture province target', async (province, blocker) => {
    const plan = await planStoryDomainKnowledgeWriteback(
      storyForWriteback('china_culture', province),
    );

    expect(plan).toMatchObject({
      domain_id: 'china_culture',
      target_kind: 'domain_document',
      eligible: false,
      blockers: [blocker],
      direct_writeback_allowed: false,
      writeback_performed: false,
      real_credit_granted: false,
    });
    expect(plan.suggested_file_path).toBeUndefined();
    expect(plan.suggested_section_heading).toBeUndefined();
  });

  it('keeps original_fiction out of the formal knowledge writeback target', async () => {
    const plan = await planStoryDomainKnowledgeWriteback(
      storyForWriteback('original_fiction', '湖南'),
    );

    expect(plan).toMatchObject({
      domain_id: 'original_fiction',
      target_kind: 'none',
      eligible: false,
      blockers: ['domain_does_not_support_formal_knowledge_writeback'],
      direct_writeback_allowed: false,
      writeback_performed: false,
      real_credit_granted: false,
    });
    expect(plan.target_region).toBeUndefined();
    expect(plan.suggested_file_path).toBeUndefined();
  });

  it('keeps an unregistered historical domain visible but ineligible for writeback', async () => {
    const plan = await planStoryDomainKnowledgeWriteback(
      storyForWriteback('historical_unregistered_domain', '湖南'),
    );

    expect(plan).toMatchObject({
      domain_id: 'historical_unregistered_domain',
      target_kind: 'none',
      eligible: false,
      blockers: ['domain_pack_not_registered'],
      direct_writeback_allowed: false,
      writeback_performed: false,
      real_credit_granted: false,
    });
    expect(plan.suggested_file_path).toBeUndefined();
  });

  it('keeps the project service free of a platform-owned province path inference helper', async () => {
    const source = await readFile(new URL('../services/project-service.ts', import.meta.url), 'utf-8');

    expect(source).toContain('planStoryDomainKnowledgeWriteback');
    expect(source).not.toContain('inferKnowledgeWritebackTarget');
    expect(source).not.toContain('data/provinces/待确认.md');
    expect(source).not.toContain('`data/provinces/${province}.md`');
  });
});
