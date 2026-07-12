import { readFile } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createStage7GoldenCardsRouter } from '../routes/stage7-golden-cards.js';
import {
  getStage7GoldenCardReviewWorkspace,
  inspectStage7GoldenCardReview,
} from '../services/stage7-golden-card-review-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const fixedNow = '2026-07-12T12:00:00.000Z';

async function workspace() {
  return getStage7GoldenCardReviewWorkspace({ repoRoot, now: fixedNow });
}

async function validIntake() {
  const current = await workspace();
  const value = structuredClone(current.template) as Record<string, unknown>;
  value.review_id = 'external-golden-review-001';
  value.overall_decision = 'approve';
  value.reviews = current.template_inspection.expected_binding.required_roles.map((role, index) => ({
    reviewer_id: `external-reviewer-${index + 1}`,
    display_name: `Reviewer ${index + 1}`,
    organization: 'External Review Organization',
    identity_verified: true,
    authorization_reference: `authorization://golden-card/${role}`,
    role,
    decision: 'approve',
    reviewed_at: '2026-07-12T11:30:00.000Z',
    evidence_refs: [`evidence://golden-card/${role}/001`],
    review_note: `${role} independently reviewed the frozen candidate and approved the material boundary.`,
  }));
  return { current, value };
}

describe('Stage 7 golden-card human review intake', () => {
  it('reports the exact 30-card, 3-of-15 type baseline without granting approval', async () => {
    const current = await workspace();
    const operatorTemplate = JSON.parse(await readFile(path.resolve(repoRoot, 'data/professional-benchmarks/all-format-stage7-golden-card-review-operator-template.json'), 'utf8')) as unknown;
    const readiness = JSON.parse(await readFile(path.resolve(repoRoot, 'data/reports/story-agent-stage7-golden-card-review-readiness.json'), 'utf8')) as Record<string, unknown>;
    expect(current.schema_version).toBe('story-agent-stage7-golden-card-review-workspace/v1');
    expect(current.summary).toEqual({
      target_video_type_count: 15,
      target_human_approved_card_count: 75,
      indexed_candidate_card_count: 30,
      candidate_video_type_count: 3,
      missing_video_type_count: 12,
      missing_target_card_count: 60,
      pending_human_review_card_count: 30,
      approval_preflight_ready_card_count: 0,
      human_approved_card_count: 0,
      promoted_golden_card_count: 0,
      professional_pass_count: 0,
    });
    expect(current.cards).toHaveLength(30);
    expect(current.cards.every(card => card.review_status === 'pending_human_review'
      && !card.approval_preflight_ready && !card.human_approved)).toBe(true);
    expect(operatorTemplate).toEqual(current.template);
    expect(readiness.summary).toEqual(current.summary);
    expect((readiness.video_types as Array<Record<string, unknown>>).map(item => ({
      video_type: item.video_type,
      indexed_candidate_card_count: item.indexed_candidate_card_count,
      missing_target_card_count: item.missing_target_card_count,
      status: item.status,
    }))).toEqual(current.video_types.map(item => ({
      video_type: item.video_type,
      indexed_candidate_card_count: item.indexed_candidate_card_count,
      missing_target_card_count: item.missing_target_card_count,
      status: item.coverage_status,
    })));
    expect(current.template_inspection).toMatchObject({
      approval_preflight_ready: false,
      review_record_persisted: false,
      source_card_modified: false,
      province_markdown_modified: false,
      human_approval_granted: false,
      golden_card_promoted: false,
      professional_passed: false,
    });
  });

  it('accepts a complete external three-role review only as approval preflight', async () => {
    const { current, value } = await validIntake();
    const sourcePath = path.resolve(repoRoot, current.template_inspection.expected_binding.source_card_file);
    const before = await readFile(sourcePath, 'utf8');
    const result = await inspectStage7GoldenCardReview({
      repoRoot,
      request: { raw_json: `${JSON.stringify(value, null, 2)}\n`, expected_card_id: current.selected_card_id },
      now: fixedNow,
    });
    expect(result.approval_preflight_ready).toBe(true);
    expect(Object.values(result.checks).every(Boolean)).toBe(true);
    expect(result.review_summary).toMatchObject({
      review_count: 3,
      required_role_count: 3,
      matched_required_role_count: 3,
      verified_identity_count: 3,
      approving_role_count: 3,
      evidence_reference_count: 3,
    });
    expect(result).toMatchObject({ human_approval_granted: false, golden_card_promoted: false, professional_passed: false });
    expect(await readFile(sourcePath, 'utf8')).toBe(before);
  });

  it('rejects a tampered card payload binding', async () => {
    const { current, value } = await validIntake();
    value.card_payload_sha256 = 'f'.repeat(64);
    const result = await inspectStage7GoldenCardReview({
      repoRoot,
      request: { raw_json: JSON.stringify(value), expected_card_id: current.selected_card_id },
      now: fixedNow,
    });
    expect(result.approval_preflight_ready).toBe(false);
    expect(result.checks.card_payload_digest_valid).toBe(false);
    expect(result.issues.map(item => item.code)).toContain('golden_card_payload_digest_mismatch');
  });

  it('rejects self-reported human approval, promotion, and professional pass', async () => {
    const { current, value } = await validIntake();
    value.human_approved = true;
    value.golden_card_promoted = true;
    value.professional_passed = true;
    const result = await inspectStage7GoldenCardReview({
      repoRoot,
      request: { raw_json: JSON.stringify(value), expected_card_id: current.selected_card_id },
      now: fixedNow,
    });
    expect(result.approval_preflight_ready).toBe(false);
    expect(result.checks.intake_schema_valid).toBe(false);
    expect(result.checks.source_claimed_credit_rejected).toBe(false);
    expect(result.review_summary).toMatchObject({
      source_claimed_human_approval: true,
      source_claimed_golden_card_promotion: true,
      source_claimed_professional_pass: true,
    });
    expect(result).toMatchObject({ human_approval_granted: false, golden_card_promoted: false, professional_passed: false });
  });

  it('exposes only workspace and in-memory validation, with no approve, persist, promote, or writeback endpoint', async () => {
    const app = express();
    app.use(createJsonBodyParser());
    app.use('/api/stage7-golden-cards', createStage7GoldenCardsRouter(repoRoot));
    app.use(errorHandler);
    const request = supertest(app);
    const response = await request.get('/api/stage7-golden-cards/review-intake');
    expect(response.status).toBe(200);
    expect(response.body.data.summary).toMatchObject({ indexed_candidate_card_count: 30, human_approved_card_count: 0 });
    const validation = await request.post('/api/stage7-golden-cards/review-intake/validate').send({
      raw_json: response.body.data.template_raw_json,
      expected_card_id: response.body.data.selected_card_id,
    });
    expect(validation.status).toBe(200);
    expect(validation.body.data).toMatchObject({ approval_preflight_ready: false, human_approval_granted: false });
    for (const action of ['approve', 'persist', 'promote', 'writeback']) {
      expect((await request.post(`/api/stage7-golden-cards/review-intake/${action}`).send({})).status).toBe(404);
    }
  });
});
