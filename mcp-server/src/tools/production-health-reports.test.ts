import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getDomainPackExpansionCandidateReport,
  getDomainPackExpansionCandidateToolResult,
  getDomainPackExpansionWritebackDraftToolResult,
  getDomainPackProductionHealthReport,
  getDomainPackProductionHealthToolResult,
  getProductionMaterialPackHealthReport,
  getProductionMaterialPackHealthToolResult,
  updateDomainPackExpansionReviewStateBulkToolResult,
  updateDomainPackExpansionReviewStateToolResult,
} from './production-health-reports.js';

let tmpRoot = '';
let dataRoot = '';
const previousKbRoot = process.env.KB_ROOT;
const previousGeneratedRoot = process.env.WEB_GENERATED_ROOT;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-production-health-reports-'));
  dataRoot = path.join(tmpRoot, 'data');
  process.env.KB_ROOT = dataRoot;
  process.env.WEB_GENERATED_ROOT = path.join(tmpRoot, 'web-generated');
  fs.mkdirSync(path.join(dataRoot, 'provinces'), { recursive: true });
});

afterEach(() => {
  if (previousKbRoot === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = previousKbRoot;
  if (previousGeneratedRoot === undefined) delete process.env.WEB_GENERATED_ROOT;
  else process.env.WEB_GENERATED_ROOT = previousGeneratedRoot;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('production health reports', () => {
  it('fails closed when production pack and Domain Pack files are missing', () => {
    const productionMaterialPackHealth = getProductionMaterialPackHealthReport();
    const domainPackHealth = getDomainPackProductionHealthReport();
    const domainPackExpansionCandidates = getDomainPackExpansionCandidateReport();

    expect(productionMaterialPackHealth).toMatchObject({
      schema_version: 'production-material-pack-health/v1',
      status: 'failed',
      pack_count: 0,
      covered_required_video_types: [],
      production_ready_core_video_types: [],
    });
    expect(productionMaterialPackHealth.required_video_types).toHaveLength(8);
    expect(productionMaterialPackHealth.missing_required_video_types).toEqual(productionMaterialPackHealth.required_video_types);
    expect(productionMaterialPackHealth.issues).toHaveLength(8);
    expect(productionMaterialPackHealth.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        issue_type: 'missing_required_video_type',
        video_type: 'heritage_promo',
      }),
      expect.objectContaining({
        severity: 'error',
        issue_type: 'missing_required_video_type',
        video_type: 'explainer_video',
      }),
    ]));

    expect(domainPackHealth).toMatchObject({
      schema_version: 'domain-pack-production-health/v1',
      status: 'failed',
      domain_id: 'china_culture',
      version: 'unknown',
      pack_count: 0,
      production_pack_count: 0,
      covered_required_pack_ids: [],
      production_ready_pack_ids: [],
    });
    expect(domainPackHealth.required_pack_ids).toHaveLength(8);
    expect(domainPackHealth.missing_required_pack_ids).toEqual(domainPackHealth.required_pack_ids);
    expect(domainPackHealth.issues).toHaveLength(8);
    expect(domainPackHealth.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        issue_type: 'missing_required_pack',
        pack_id: 'heritage_process_pack',
      }),
      expect.objectContaining({
        severity: 'error',
        issue_type: 'missing_required_pack',
        pack_id: 'explainer_knowledge_structure_pack',
      }),
    ]));

    expect(domainPackExpansionCandidates).toMatchObject({
      schema_version: 'domain-pack-expansion-candidates-report/v1',
      status: 'failed',
      source_schema_version: 'missing',
      batch_count: 0,
      seed_target_count: 0,
      candidate_field_count: 0,
      covered_required_pack_ids: [],
      review_packet: {
        schema_version: 'domain-pack-expansion-review-packet/v1',
        status: 'failed',
        batch_count: 0,
        review_item_count: 0,
        candidate_field_count: 0,
      },
    });
    expect(domainPackExpansionCandidates.required_pack_ids).toHaveLength(8);
    expect(domainPackExpansionCandidates.missing_required_pack_ids).toEqual(domainPackExpansionCandidates.required_pack_ids);
    expect(domainPackExpansionCandidates.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        issue_type: 'missing_candidate_file',
      }),
    ]));
  });

  it('renders markdown for standalone MCP health tool results by default', () => {
    const productionMaterialPackHealth = getProductionMaterialPackHealthToolResult();
    const domainPackHealth = getDomainPackProductionHealthToolResult();
    const domainPackExpansionCandidates = getDomainPackExpansionCandidateToolResult();

    expect(productionMaterialPackHealth.status).toBe('failed');
    expect(productionMaterialPackHealth.markdown).toContain('Production Material Pack Health');
    expect(productionMaterialPackHealth.markdown).toContain('missing_required_video_types');
    expect(productionMaterialPackHealth.markdown).toContain('heritage_promo');

    expect(domainPackHealth.status).toBe('failed');
    expect(domainPackHealth.markdown).toContain('Domain Pack Production Health');
    expect(domainPackHealth.markdown).toContain('missing_required_pack_ids');
    expect(domainPackHealth.markdown).toContain('heritage_process_pack');

    expect(getProductionMaterialPackHealthToolResult({ include_markdown: false }).markdown).toBeUndefined();
    expect(getDomainPackProductionHealthToolResult({ include_markdown: false }).markdown).toBeUndefined();

    expect(domainPackExpansionCandidates.status).toBe('failed');
    expect(domainPackExpansionCandidates.markdown).toContain('Domain Pack Expansion Candidates');
    expect(domainPackExpansionCandidates.markdown).toContain('missing_candidate_file');
    expect(domainPackExpansionCandidates.markdown).toContain('review_packet_item_count');
    expect(domainPackExpansionCandidates.review_packet.markdown).toContain('Domain Pack Expansion Review Packet');
    expect(domainPackExpansionCandidates.review_packet.markdown).toContain('direct_writeback_to_province_markdown: true');
    expect(getDomainPackExpansionCandidateToolResult({ include_markdown: false }).markdown).toBeUndefined();
    expect(getDomainPackExpansionCandidateToolResult({ include_markdown: false }).review_packet.markdown).toBeUndefined();
    expect(getDomainPackExpansionWritebackDraftToolResult().markdown).toContain('Domain Pack Expansion Writeback Draft');
    expect(getDomainPackExpansionWritebackDraftToolResult({ include_markdown: false }).markdown).toBeUndefined();
  });

  it('reports review-gated Domain Pack expansion candidates', () => {
    fs.mkdirSync(path.join(dataRoot, 'domain-packs'), { recursive: true });
    fs.writeFileSync(
      path.join(dataRoot, 'domain-packs', 'china-culture-production-expansion-candidates.json'),
      JSON.stringify({
        schema_version: 'domain-pack-expansion-candidates/v1',
        updated_at: '2026-07-07',
        domain_id: 'china_culture',
        review_policy: {
          direct_writeback_to_province_markdown: false,
          requires_candidate_markdown: true,
          requires_human_review: true,
          requires_source_level: true,
        },
        batches: [
          'heritage_process_pack',
          'documentary_source_pack',
          'ai_comic_storyboard_pack',
          'era_and_costume_pack',
          'explainer_knowledge_structure_pack',
          'children_adaptation_safety_pack',
          'short_video_hook_pack',
          'education_training_structure_pack',
        ].map(packId => ({
          batch_id: `${packId}_batch`,
          pack_id: packId,
          entry_name: `${packId} entry`,
          priority: 'P0',
          status: 'candidate_review',
          target_video_types: ['explainer_video'],
          field_groups: [{
            group_id: 'core',
            candidate_fields: ['core_question'],
            review_questions: ['是否进入候选稿审稿？'],
          }],
          seed_targets: [{
            entry_name: `${packId} target`,
            province: '湖南',
            recommended_fields: ['core_question'],
            candidate_status: 'candidate_review',
            forbidden_direct_claims: ['未经审稿不得写回正式知识库'],
          }],
        })),
      }),
    );
    fs.mkdirSync(path.join(process.env.WEB_GENERATED_ROOT!, 'domain-pack-expansion'), { recursive: true });
    fs.writeFileSync(
      path.join(process.env.WEB_GENERATED_ROOT!, 'domain-pack-expansion', 'review-state.json'),
      JSON.stringify({
        schema_version: 'domain-pack-expansion-review-state/v1',
        updated_at: '2026-07-07T09:00:00.000Z',
        direct_writeback_to_province_markdown: false,
        items: [{
          review_item_id: 'heritage_process_pack_batch::target_01',
          review_status: 'approved',
          review_note: 'MCP 审稿通过，进入人工补源清单。',
          reviewed_at: '2026-07-07T09:00:00.000Z',
          writeback_status: 'queued',
          writeback_note: '先排入湖南非遗流程补录批次。',
          writeback_updated_at: '2026-07-07T09:00:00.000Z',
        }],
      }),
    );

    const report = getDomainPackExpansionCandidateReport();

    expect(report).toMatchObject({
      schema_version: 'domain-pack-expansion-candidates-report/v1',
      source_schema_version: 'domain-pack-expansion-candidates/v1',
      domain_id: 'china_culture',
      status: 'passed',
      missing_required_pack_ids: [],
      batch_count: 8,
      seed_target_count: 8,
      candidate_field_count: 8,
      issues: [],
      review_packet: {
        schema_version: 'domain-pack-expansion-review-packet/v1',
        status: 'passed',
        batch_count: 8,
        review_item_count: 8,
        candidate_field_count: 8,
        review_status_counts: {
          candidate_review: 7,
          approved: 1,
          rejected: 0,
          needs_revision: 0,
        },
        approved_writeback_draft_count: 1,
      },
      review_policy: {
        direct_writeback_to_province_markdown: false,
        requires_candidate_markdown: true,
        requires_human_review: true,
        requires_source_level: true,
      },
    });
    expect(report.batches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pack_id: 'heritage_process_pack',
        provinces: ['湖南'],
      }),
    ]));
    expect(report.review_packet.batches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pack_id: 'heritage_process_pack',
        review_items: expect.arrayContaining([
          expect.objectContaining({
            entry_name: 'heritage_process_pack target',
            review_status: 'approved',
            writeback_status: 'queued',
            writeback_draft_markdown: expect.stringContaining('扩库候选审稿草案'),
            candidate_markdown: expect.stringContaining('candidate_draft_only: true'),
          }),
        ]),
      }),
    ]));
    const toolResult = getDomainPackExpansionCandidateToolResult();
    expect(toolResult.review_packet.markdown).toContain('Domain Pack Expansion Review Packet');
    expect(toolResult.review_packet.markdown).toContain('heritage_process_pack target');
    expect(toolResult.review_packet.markdown).toContain('approved_writeback_draft_count: 1');

    const writebackDraft = getDomainPackExpansionWritebackDraftToolResult();
    expect(writebackDraft).toMatchObject({
      schema_version: 'domain-pack-expansion-writeback-draft/v1',
      domain_id: 'china_culture',
      approved_count: 1,
      target_files: ['data/provinces/湖南.md'],
      status_counts: expect.objectContaining({
        queued: 1,
      }),
    });
    expect(writebackDraft.items[0]).toMatchObject({
      review_item_id: 'heritage_process_pack_batch::target_01',
      suggested_file_path: 'data/provinces/湖南.md',
      writeback_status: 'queued',
    });
    expect(writebackDraft.markdown).toContain('本草案只作为人工补库采集清单');
  });

  it('updates expansion review state for MCP callers without writing province markdown', () => {
    fs.mkdirSync(path.join(dataRoot, 'domain-packs'), { recursive: true });
    fs.writeFileSync(
      path.join(dataRoot, 'domain-packs', 'china-culture-production-expansion-candidates.json'),
      JSON.stringify({
        schema_version: 'domain-pack-expansion-candidates/v1',
        updated_at: '2026-07-07',
        domain_id: 'china_culture',
        review_policy: {
          direct_writeback_to_province_markdown: false,
          requires_candidate_markdown: true,
          requires_human_review: true,
          requires_source_level: true,
        },
        batches: [{
          batch_id: 'heritage_process_pack_batch',
          pack_id: 'heritage_process_pack',
          entry_name: 'heritage_process_pack entry',
          priority: 'P0',
          status: 'candidate_review',
          target_video_types: ['heritage_promo'],
          field_groups: [{
            group_id: 'core',
            candidate_fields: ['process_steps'],
            review_questions: ['是否已进入人工审稿？'],
          }],
          seed_targets: [{
            entry_name: 'heritage_process_pack target',
            province: '湖南',
            recommended_fields: ['process_steps'],
            candidate_status: 'candidate_review',
            forbidden_direct_claims: ['未经审稿不得写回正式知识库'],
          }],
        }],
      }),
    );

    const update = updateDomainPackExpansionReviewStateToolResult({
      review_item_id: 'heritage_process_pack_batch::target_01',
      review_status: 'approved',
      review_note: 'MCP 工具确认进入人工补源队列。',
      writeback_status: 'queued',
      writeback_note: '先排入湖南非遗流程补录批次。',
      include_markdown: false,
    }, {
      updated_at: '2026-07-07T11:00:00.000Z',
    });

    expect(update).toMatchObject({
      schema_version: 'domain-pack-expansion-review-state-update/v1',
      updated_at: '2026-07-07T11:00:00.000Z',
      ok: true,
      review_item_id: 'heritage_process_pack_batch::target_01',
      review_status: 'approved',
      writeback_status: 'queued',
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
      report: {
        review_packet: {
          review_status_counts: expect.objectContaining({
            approved: 1,
          }),
          approved_writeback_draft_count: 1,
        },
      },
      writeback_draft: {
        approved_count: 1,
        target_files: ['data/provinces/湖南.md'],
      },
    });
    expect(update.report?.markdown).toBeUndefined();
    expect(update.writeback_draft?.markdown).toBeUndefined();
    expect(fs.existsSync(path.join(dataRoot, 'provinces', '湖南.md'))).toBe(false);

    const state = JSON.parse(
      fs.readFileSync(path.join(process.env.WEB_GENERATED_ROOT!, 'domain-pack-expansion', 'review-state.json'), 'utf8'),
    );
    expect(state).toMatchObject({
      schema_version: 'domain-pack-expansion-review-state/v1',
      direct_writeback_to_province_markdown: false,
      items: [expect.objectContaining({
        review_item_id: 'heritage_process_pack_batch::target_01',
        review_status: 'approved',
        writeback_status: 'queued',
      })],
    });

    const revision = updateDomainPackExpansionReviewStateToolResult({
      review_item_id: 'heritage_process_pack_batch::target_01',
      review_status: 'needs_revision',
      review_note: '来源级证据不足，退回补充。',
      include_markdown: false,
    }, {
      updated_at: '2026-07-07T11:30:00.000Z',
    });

    expect(revision.ok).toBe(true);
    expect(revision.writeback_status).toBeUndefined();
    expect(revision.writeback_draft).toBeUndefined();
    expect(revision.report?.review_packet.review_status_counts).toMatchObject({
      needs_revision: 1,
      approved: 0,
    });
  });

  it('bulk updates expansion review state for MCP callers without writing province markdown', () => {
    fs.mkdirSync(path.join(dataRoot, 'domain-packs'), { recursive: true });
    fs.writeFileSync(
      path.join(dataRoot, 'domain-packs', 'china-culture-production-expansion-candidates.json'),
      JSON.stringify({
        schema_version: 'domain-pack-expansion-candidates/v1',
        updated_at: '2026-07-07',
        domain_id: 'china_culture',
        review_policy: {
          direct_writeback_to_province_markdown: false,
          requires_candidate_markdown: true,
          requires_human_review: true,
          requires_source_level: true,
        },
        batches: [{
          batch_id: 'short_video_hook_pack_batch',
          pack_id: 'short_video_hook_pack',
          entry_name: 'short_video_hook_pack entry',
          priority: 'P0',
          status: 'candidate_review',
          target_video_types: ['social_short', 'explainer_video'],
          field_groups: [{
            group_id: 'hook_structure',
            candidate_fields: ['opening_hook', 'fact_boundary_card'],
            review_questions: ['是否已确认只进入批量审稿队列？'],
          }],
          seed_targets: [
            {
              entry_name: 'short_video_hook_pack target 1',
              province: '湖南',
              recommended_fields: ['opening_hook'],
              candidate_status: 'candidate_review',
              forbidden_direct_claims: ['未经审稿不得写回正式知识库'],
            },
            {
              entry_name: 'short_video_hook_pack target 2',
              province: '湖南',
              recommended_fields: ['fact_boundary_card'],
              candidate_status: 'candidate_review',
              forbidden_direct_claims: ['不得把候选钩子当成已核实事实'],
            },
          ],
        }],
      }),
    );

    const update = updateDomainPackExpansionReviewStateBulkToolResult({
      review_item_ids: [
        'short_video_hook_pack_batch::target_01',
        'short_video_hook_pack_batch::target_02',
        'short_video_hook_pack_batch::target_02',
      ],
      review_status: 'approved',
      review_note: 'MCP 批量审稿通过，仍需补足来源级证据。',
      writeback_status: 'queued',
      writeback_note: '批量进入短视频钩子包写回队列。',
      include_markdown: false,
    }, {
      updated_at: '2026-07-07T12:00:00.000Z',
    });

    expect(update).toMatchObject({
      schema_version: 'domain-pack-expansion-review-state-bulk-update/v1',
      updated_at: '2026-07-07T12:00:00.000Z',
      ok: true,
      updated_count: 2,
      missing_review_item_ids: [],
      review_status: 'approved',
      writeback_status: 'queued',
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
      report: {
        review_packet: {
          review_status_counts: expect.objectContaining({
            approved: 2,
          }),
          approved_writeback_draft_count: 2,
        },
      },
      writeback_draft: {
        approved_count: 2,
        target_files: ['data/provinces/湖南.md'],
        status_counts: expect.objectContaining({
          queued: 2,
        }),
      },
    });
    expect(update.report?.markdown).toBeUndefined();
    expect(update.writeback_draft?.markdown).toBeUndefined();
    expect(fs.existsSync(path.join(dataRoot, 'provinces', '湖南.md'))).toBe(false);

    const state = JSON.parse(
      fs.readFileSync(path.join(process.env.WEB_GENERATED_ROOT!, 'domain-pack-expansion', 'review-state.json'), 'utf8'),
    );
    expect(state).toMatchObject({
      schema_version: 'domain-pack-expansion-review-state/v1',
      direct_writeback_to_province_markdown: false,
      items: [
        expect.objectContaining({
          review_item_id: 'short_video_hook_pack_batch::target_01',
          review_status: 'approved',
          writeback_status: 'queued',
        }),
        expect.objectContaining({
          review_item_id: 'short_video_hook_pack_batch::target_02',
          review_status: 'approved',
          writeback_status: 'queued',
        }),
      ],
    });

    const missing = updateDomainPackExpansionReviewStateBulkToolResult({
      review_item_ids: ['short_video_hook_pack_batch::missing'],
      review_status: 'approved',
      include_markdown: false,
    }, {
      updated_at: '2026-07-07T12:30:00.000Z',
    });

    expect(missing).toMatchObject({
      schema_version: 'domain-pack-expansion-review-state-bulk-update/v1',
      ok: false,
      updated_count: 0,
      missing_review_item_ids: ['short_video_hook_pack_batch::missing'],
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
    });
    expect(fs.existsSync(path.join(dataRoot, 'provinces', '湖南.md'))).toBe(false);
  });
});
