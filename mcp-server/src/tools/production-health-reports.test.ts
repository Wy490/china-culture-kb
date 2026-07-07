import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getDomainPackExpansionCandidateReport,
  getDomainPackExpansionCandidateToolResult,
  getDomainPackProductionHealthReport,
  getDomainPackProductionHealthToolResult,
  getProductionMaterialPackHealthReport,
  getProductionMaterialPackHealthToolResult,
} from './production-health-reports.js';

let tmpRoot = '';
let dataRoot = '';
const previousKbRoot = process.env.KB_ROOT;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-production-health-reports-'));
  dataRoot = path.join(tmpRoot, 'data');
  process.env.KB_ROOT = dataRoot;
  fs.mkdirSync(path.join(dataRoot, 'provinces'), { recursive: true });
});

afterEach(() => {
  if (previousKbRoot === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = previousKbRoot;
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
    expect(domainPackExpansionCandidates.required_pack_ids).toHaveLength(5);
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

    const report = getDomainPackExpansionCandidateReport();

    expect(report).toMatchObject({
      schema_version: 'domain-pack-expansion-candidates-report/v1',
      source_schema_version: 'domain-pack-expansion-candidates/v1',
      domain_id: 'china_culture',
      status: 'passed',
      missing_required_pack_ids: [],
      batch_count: 5,
      seed_target_count: 5,
      candidate_field_count: 5,
      issues: [],
      review_packet: {
        schema_version: 'domain-pack-expansion-review-packet/v1',
        status: 'passed',
        batch_count: 5,
        review_item_count: 5,
        candidate_field_count: 5,
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
            candidate_markdown: expect.stringContaining('candidate_draft_only: true'),
          }),
        ]),
      }),
    ]));
    const toolResult = getDomainPackExpansionCandidateToolResult();
    expect(toolResult.review_packet.markdown).toContain('Domain Pack Expansion Review Packet');
    expect(toolResult.review_packet.markdown).toContain('heritage_process_pack target');
  });
});
