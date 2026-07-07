import { beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { getDomainPackExpansionCandidateReport } from '../services/domain-pack-expansion-service.js';

beforeAll(() => {
  if (!process.env.KB_ROOT) {
    process.env.KB_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
  }
});

describe('domain-pack-expansion-service', () => {
  it('reports review-gated Domain Pack expansion candidate batches', () => {
    const report = getDomainPackExpansionCandidateReport({
      generatedAt: '2026-07-07T00:00:00.000Z',
    });

    expect(report).toMatchObject({
      schema_version: 'domain-pack-expansion-candidates-report/v1',
      generated_at: '2026-07-07T00:00:00.000Z',
      source_schema_version: 'domain-pack-expansion-candidates/v1',
      domain_id: 'china_culture',
      status: 'passed',
      missing_required_pack_ids: [],
      review_policy: {
        direct_writeback_to_province_markdown: false,
        requires_candidate_markdown: true,
        requires_human_review: true,
        requires_source_level: true,
      },
      batch_count: 5,
      issues: [],
    });
    expect(report.required_pack_ids).toEqual([
      'heritage_process_pack',
      'documentary_source_pack',
      'ai_comic_storyboard_pack',
      'era_and_costume_pack',
      'explainer_knowledge_structure_pack',
    ]);
    expect(report.seed_target_count).toBeGreaterThanOrEqual(18);
    expect(report.candidate_field_count).toBeGreaterThanOrEqual(40);
    expect(report.review_packet).toMatchObject({
      schema_version: 'domain-pack-expansion-review-packet/v1',
      source_schema_version: 'domain-pack-expansion-candidates/v1',
      domain_id: 'china_culture',
      status: 'passed',
      batch_count: 5,
      review_item_count: report.seed_target_count,
      candidate_field_count: report.candidate_field_count,
      review_policy: {
        direct_writeback_to_province_markdown: false,
        requires_candidate_markdown: true,
        requires_human_review: true,
        requires_source_level: true,
      },
    });
    expect(report.review_packet.batches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pack_id: 'heritage_process_pack',
        review_items: expect.arrayContaining([
          expect.objectContaining({
            entry_name: '滩头年画——湘西南木版年画的最后守望',
            province: '湖南',
            candidate_status: 'candidate_review',
            candidate_markdown: expect.stringContaining('direct_writeback_to_province_markdown: false'),
          }),
        ]),
      }),
    ]));
    expect(report.review_packet.markdown).toContain('Domain Pack Expansion Review Packet');
    expect(report.review_packet.markdown).toContain('滩头年画');
    expect(report.review_packet.markdown).toContain('候选稿只记录待补字段');
    expect(report.batches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pack_id: 'heritage_process_pack',
        priority: 'P0',
        seed_target_count: 4,
        provinces: expect.arrayContaining(['湖南']),
      }),
      expect.objectContaining({
        pack_id: 'documentary_source_pack',
        target_video_types: expect.arrayContaining(['documentary_short']),
      }),
      expect.objectContaining({
        pack_id: 'explainer_knowledge_structure_pack',
        target_video_types: expect.arrayContaining(['explainer_video']),
      }),
    ]));
    expect(report.markdown).toContain('Domain Pack Expansion Candidates');
    expect(report.markdown).toContain('direct_writeback_to_province_markdown: false');
    expect(report.markdown).toContain('review_packet_item_count');
  });

  it('can omit markdown for machine-only callers', () => {
    const report = getDomainPackExpansionCandidateReport({ includeMarkdown: false });

    expect(report.status).toBe('passed');
    expect(report.markdown).toBeUndefined();
    expect(report.review_packet.review_item_count).toBe(report.seed_target_count);
    expect(report.review_packet.markdown).toBeUndefined();
  });
});
