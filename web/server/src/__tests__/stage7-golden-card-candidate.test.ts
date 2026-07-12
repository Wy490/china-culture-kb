import { readFile } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createStage7GoldenCardsRouter } from '../routes/stage7-golden-cards.js';
import {
  getStage7GoldenCardCandidateWorkspace,
  inspectStage7GoldenCardCandidate,
} from '../services/stage7-golden-card-candidate-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const fixedNow = '2026-07-12T13:00:00.000Z';

async function workspace() {
  return getStage7GoldenCardCandidateWorkspace({ repoRoot, now: fixedNow });
}

async function validCandidate() {
  const current = await workspace();
  const value = structuredClone(current.template) as Record<string, any>;
  value.source_entry_confirmed = true;
  value.source_authorization_status = 'evidence_attached';
  value.source_refs = ['kb-entry://verified-source', 'evidence://operator/source-001'];
  value.material_fields = Object.fromEntries(
    current.template_inspection.expected_binding.required_material_fields
      .map(field => [field, `${field} 的人工候选素材描述；仅用于外部审稿，不代表已核事实。`]),
  );
  value.visible_actions = ['人物在已确认地点执行可被镜头观察的具体动作。'];
  value.evidence_boundaries = {
    verified_facts: ['该条事实必须能够回指已确认知识条目或来源证据。'],
    plausible_dramatization: ['场面调度仅作为合理影视化表达。'],
    fictional_additions: ['如有虚构人物或对白，必须在此明确列出。'],
    unknowns: ['尚待外部审稿者确认的细节。'],
    forbidden_claims: ['不得把合理演绎、未知点或虚构添加表述为已核史实。'],
  };
  return { current, value };
}

describe('Stage 7 golden-card candidate expansion', () => {
  it('prepares exactly 60 slots for 12 missing video types without creating candidates', async () => {
    const current = await workspace();
    const operatorTemplate = JSON.parse(await readFile(path.resolve(repoRoot, 'data/professional-benchmarks/all-format-stage7-golden-card-candidate-operator-template.json'), 'utf8')) as unknown;
    const readiness = JSON.parse(await readFile(path.resolve(repoRoot, 'data/reports/story-agent-stage7-golden-card-candidate-readiness.json'), 'utf8')) as Record<string, any>;
    expect(current.schema_version).toBe('story-agent-stage7-golden-card-candidate-workspace/v1');
    expect(current.summary).toEqual({
      target_video_type_count: 15,
      already_covered_video_type_count: 3,
      missing_video_type_count: 12,
      planned_slot_count: 60,
      candidate_import_ready_slot_count: 0,
      authored_candidate_count: 0,
      persisted_candidate_count: 0,
      human_approved_card_count: 0,
      professional_pass_count: 0,
    });
    expect(current.slots).toHaveLength(60);
    expect(new Set(current.slots.map(slot => slot.slot_id)).size).toBe(60);
    expect(current.slots.every(slot => slot.status === 'template_slot_only'
      && !slot.candidate_ready_for_external_human_review && !slot.human_approved)).toBe(true);
    expect(operatorTemplate).toEqual(current.template);
    expect(readiness.summary).toEqual(current.summary);
    expect(readiness.slot_sources).toHaveLength(12);
    expect(readiness.slot_sources.reduce((sum: number, item: Record<string, number>) => sum + item.slot_count, 0)).toBe(60);
    expect(current.video_types.filter(item => item.status === 'already_has_candidate_coverage')
      .map(item => item.video_type)).toEqual(['ai_comic_drama', 'heritage_promo', 'documentary_short']);
    expect(current.template_inspection).toMatchObject({
      candidate_ready_for_external_human_review: false,
      candidate_persisted: false,
      golden_index_modified: false,
      source_card_file_created: false,
      province_markdown_modified: false,
      human_approval_granted: false,
      golden_card_promoted: false,
      professional_passed: false,
    });
  });

  it('accepts a fully filled human-authored fixture only as external-review readiness', async () => {
    const { current, value } = await validCandidate();
    const benchmarkPath = path.resolve(repoRoot, current.template_inspection.expected_binding.benchmark_file);
    const before = await readFile(benchmarkPath, 'utf8');
    const result = await inspectStage7GoldenCardCandidate({
      repoRoot,
      request: { raw_json: `${JSON.stringify(value, null, 2)}\n`, expected_slot_id: current.selected_slot_id },
      now: fixedNow,
    });
    expect(result.candidate_ready_for_external_human_review).toBe(true);
    expect(Object.values(result.checks).every(Boolean)).toBe(true);
    expect(result.content_summary).toMatchObject({
      required_material_field_count: current.template_inspection.expected_binding.required_material_fields.length,
      filled_material_field_count: current.template_inspection.expected_binding.required_material_fields.length,
      visible_action_count: 1,
      verified_fact_count: 1,
      forbidden_claim_count: 1,
      source_reference_count: 2,
    });
    expect(result).toMatchObject({ candidate_persisted: false, human_approval_granted: false, golden_card_promoted: false, professional_passed: false });
    expect(await readFile(benchmarkPath, 'utf8')).toBe(before);
  });

  it('rejects benchmark and GenreStoryProfile binding tampering', async () => {
    const { current, value } = await validCandidate();
    value.benchmark_project_sha256 = 'a'.repeat(64);
    value.profile_contract_sha256 = 'b'.repeat(64);
    const result = await inspectStage7GoldenCardCandidate({ repoRoot, request: { raw_json: JSON.stringify(value), expected_slot_id: current.selected_slot_id }, now: fixedNow });
    expect(result.candidate_ready_for_external_human_review).toBe(false);
    expect(result.checks.benchmark_project_digest_valid).toBe(false);
    expect(result.checks.profile_contract_digest_valid).toBe(false);
    expect(result.issues.map(item => item.code)).toEqual(expect.arrayContaining([
      'golden_candidate_benchmark_project_digest_mismatch',
      'golden_candidate_profile_contract_digest_mismatch',
    ]));
  });

  it('rejects missing sources and self-reported approval or promotion', async () => {
    const { current, value } = await validCandidate();
    value.source_refs = [];
    value.human_approved = true;
    value.golden_card_promoted = true;
    value.professional_passed = true;
    const result = await inspectStage7GoldenCardCandidate({ repoRoot, request: { raw_json: JSON.stringify(value), expected_slot_id: current.selected_slot_id }, now: fixedNow });
    expect(result.candidate_ready_for_external_human_review).toBe(false);
    expect(result.checks.candidate_schema_valid).toBe(false);
    expect(result.checks.source_claimed_credit_rejected).toBe(false);
    expect(result.content_summary).toMatchObject({ source_reference_count: 0, source_claimed_human_approval: true, source_claimed_golden_card_promotion: true, source_claimed_professional_pass: true });
    expect(result).toMatchObject({ candidate_persisted: false, human_approval_granted: false, golden_card_promoted: false, professional_passed: false });
  });

  it('exposes only workspace and validation, with no generate, persist, create-card, promote, or writeback endpoint', async () => {
    const app = express();
    app.use(createJsonBodyParser());
    app.use('/api/stage7-golden-cards', createStage7GoldenCardsRouter(repoRoot));
    app.use(errorHandler);
    const request = supertest(app);
    const response = await request.get('/api/stage7-golden-cards/candidate-expansion');
    expect(response.status).toBe(200);
    expect(response.body.data.summary).toMatchObject({ planned_slot_count: 60, authored_candidate_count: 0 });
    const validation = await request.post('/api/stage7-golden-cards/candidate-expansion/validate').send({ raw_json: response.body.data.template_raw_json, expected_slot_id: response.body.data.selected_slot_id });
    expect(validation.status).toBe(200);
    expect(validation.body.data).toMatchObject({ candidate_ready_for_external_human_review: false, candidate_persisted: false });
    for (const action of ['generate', 'persist', 'create-card', 'promote', 'writeback']) {
      expect((await request.post(`/api/stage7-golden-cards/candidate-expansion/${action}`).send({})).status).toBe(404);
    }
  });
});
