import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  getDomainPackExpansionCandidateReport,
  getDomainPackExpansionWritebackDraftPackage,
  updateDomainPackExpansionReviewState,
  updateDomainPackExpansionReviewStateBulk,
} from '../services/domain-pack-expansion-service.js';

const previousGeneratedRoot = process.env.WEB_GENERATED_ROOT;
let generatedRoot = '';

beforeAll(() => {
  if (!process.env.KB_ROOT) {
    process.env.KB_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
  }
});

beforeEach(() => {
  generatedRoot = mkdtempSync(resolve(tmpdir(), 'domain-pack-expansion-service-'));
  process.env.WEB_GENERATED_ROOT = generatedRoot;
});

afterEach(() => {
  if (previousGeneratedRoot === undefined) delete process.env.WEB_GENERATED_ROOT;
  else process.env.WEB_GENERATED_ROOT = previousGeneratedRoot;
  rmSync(generatedRoot, { recursive: true, force: true });
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
      batch_count: 8,
      issues: [],
    });
    expect(report.required_pack_ids).toEqual([
      'heritage_process_pack',
      'documentary_source_pack',
      'ai_comic_storyboard_pack',
      'era_and_costume_pack',
      'explainer_knowledge_structure_pack',
      'children_adaptation_safety_pack',
      'short_video_hook_pack',
      'education_training_structure_pack',
    ]);
    expect(report.seed_target_count).toBeGreaterThanOrEqual(30);
    expect(report.candidate_field_count).toBeGreaterThanOrEqual(80);
    expect(report.review_packet).toMatchObject({
      schema_version: 'domain-pack-expansion-review-packet/v1',
      source_schema_version: 'domain-pack-expansion-candidates/v1',
      domain_id: 'china_culture',
      status: 'passed',
      batch_count: 8,
      review_item_count: report.seed_target_count,
      candidate_field_count: report.candidate_field_count,
      review_policy: {
        direct_writeback_to_province_markdown: false,
        requires_candidate_markdown: true,
        requires_human_review: true,
        requires_source_level: true,
      },
    });
    expect(report.review_packet.review_status_counts?.candidate_review).toBe(report.seed_target_count);
    expect(report.review_packet.approved_writeback_draft_count).toBe(0);
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
      expect.objectContaining({
        pack_id: 'children_adaptation_safety_pack',
        target_video_types: expect.arrayContaining(['children_story']),
      }),
      expect.objectContaining({
        pack_id: 'short_video_hook_pack',
        target_video_types: expect.arrayContaining(['social_short']),
      }),
      expect.objectContaining({
        pack_id: 'education_training_structure_pack',
        target_video_types: expect.arrayContaining(['education_training']),
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

  it('stores review state separately and exports approved writeback drafts', () => {
    const reviewItemId = 'heritage_process_pack_expansion_20260707::target_01';
    const update = updateDomainPackExpansionReviewState({
      review_item_id: reviewItemId,
      review_status: 'approved',
      review_note: '已确认可进入人工补源清单，仍需补来源级证据。',
      writeback_status: 'queued',
      writeback_note: '先排入湖南非遗流程补录批次。',
    }, {
      updatedAt: '2026-07-07T09:00:00.000Z',
    });

    expect(update.ok).toBe(true);
    const updatedItem = update.report?.review_packet.batches
      .flatMap(batch => batch.review_items)
      .find(item => item.review_item_id === reviewItemId);
    expect(updatedItem).toMatchObject({
      review_status: 'approved',
      review_note: '已确认可进入人工补源清单，仍需补来源级证据。',
      writeback_status: 'queued',
      writeback_note: '先排入湖南非遗流程补录批次。',
      writeback_draft_markdown: expect.stringContaining('扩库候选审稿草案'),
    });
    expect(updatedItem?.writeback_draft_markdown).toContain('direct_writeback_to_province_markdown: false');

    const draftPackage = getDomainPackExpansionWritebackDraftPackage({
      exportedAt: '2026-07-07T10:00:00.000Z',
    });
    expect(draftPackage).toMatchObject({
      schema_version: 'domain-pack-expansion-writeback-draft/v1',
      exported_at: '2026-07-07T10:00:00.000Z',
      approved_count: 1,
      target_files: ['data/provinces/湖南.md'],
      status_counts: expect.objectContaining({
        queued: 1,
      }),
    });
    expect(draftPackage.items[0]).toMatchObject({
      review_item_id: reviewItemId,
      province: '湖南',
      suggested_file_path: 'data/provinces/湖南.md',
      writeback_status: 'queued',
    });
    expect(draftPackage.markdown).toContain('Domain Pack Expansion Writeback Draft');
    expect(draftPackage.markdown).toContain('本草案只作为人工补库采集清单');
  });

  it('bulk updates filtered review candidates without writing province markdown', () => {
    const update = updateDomainPackExpansionReviewStateBulk({
      review_item_ids: [
        'children_adaptation_safety_pack_expansion_20260707::target_01',
        'children_adaptation_safety_pack_expansion_20260707::target_02',
      ],
      review_status: 'approved',
      review_note: '批量审稿通过，仍需人工补来源。',
      writeback_status: 'queued',
      writeback_note: '批量进入儿童改写安全补录队列。',
    }, {
      updatedAt: '2026-07-07T11:00:00.000Z',
    });

    expect(update.ok).toBe(true);
    expect(update.result).toMatchObject({
      schema_version: 'domain-pack-expansion-review-state-bulk-update/v1',
      updated_at: '2026-07-07T11:00:00.000Z',
      updated_count: 2,
      missing_review_item_ids: [],
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
      report: {
        review_packet: {
          approved_writeback_draft_count: 2,
        },
      },
    });
    expect(update.result?.report.review_packet.review_status_counts).toMatchObject({
      approved: 2,
    });
    expect(update.result?.report.review_packet.batches
      .flatMap(batch => batch.review_items)
      .filter(item => item.review_status === 'approved')).toHaveLength(2);

    const draftPackage = getDomainPackExpansionWritebackDraftPackage({
      exportedAt: '2026-07-07T11:10:00.000Z',
    });
    expect(draftPackage).toMatchObject({
      approved_count: 2,
      status_counts: expect.objectContaining({
        queued: 2,
      }),
    });
    expect(draftPackage.items.map(item => item.writeback_status)).toEqual(['queued', 'queued']);
  });

  it('rejects review updates for unknown candidate items', () => {
    const update = updateDomainPackExpansionReviewState({
      review_item_id: 'missing-review-item',
      review_status: 'approved',
    });

    expect(update.ok).toBe(false);
    expect(update.message).toContain('未找到扩库候选审稿项');
  });
});
