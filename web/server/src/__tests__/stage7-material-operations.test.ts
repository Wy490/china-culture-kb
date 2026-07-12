import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createStage7GoldenCardsRouter } from '../routes/stage7-golden-cards.js';
import { getStage7MaterialOperations } from '../services/stage7-material-operations-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const fixedNow = '2026-07-12T15:00:00.000Z';

describe('Stage 7 material operations control tower', () => {
  it('aggregates exact golden-card and Domain Pack zero-credit baselines into five lanes', async () => {
    const report = await getStage7MaterialOperations({ repoRoot, now: fixedNow });
    const readiness = JSON.parse(await readFile(path.resolve(repoRoot, 'data/reports/story-agent-stage7-material-operations-readiness.json'), 'utf8')) as Record<string, any>;
    expect(report.schema_version).toBe('story-agent-stage7-material-operations/v1');
    expect(report.summary).toEqual({
      golden_card_target_count: 75,
      golden_card_indexed_candidate_count: 30,
      golden_card_pending_human_review_count: 30,
      golden_card_human_approved_count: 0,
      covered_video_type_count: 3,
      missing_video_type_count: 12,
      planned_candidate_slot_count: 60,
      authored_candidate_count: 0,
      golden_review_preflight_ready_count: 0,
      golden_signature_verification_ready_count: 0,
      trusted_golden_reviewer_signer_count: 0,
      domain_pack_candidate_count: 9,
      domain_pack_evidence_complete_count: 0,
      domain_pack_human_approved_count: 0,
      domain_pack_pre_signature_ready_count: 0,
      domain_pack_real_reviewer_submission_count: 0,
      domain_pack_real_signature_count: 0,
      domain_pack_formal_patch_count: 0,
      promoted_domain_pack_count: 0,
      external_handoff_task_count: 51,
      professional_pass_count: 0,
    });
    expect(report.lanes).toHaveLength(5);
    expect(report.lanes.every(lane => lane.status === 'blocked_external_input' && lane.blocker_count > 0)).toBe(true);
    expect(readiness.summary).toEqual(report.summary);
    expect(readiness.lanes).toEqual(report.lanes.map(lane => ({ lane_id: lane.lane_id, current_count: lane.current_count, target_count: lane.target_count, blocker_count: lane.blocker_count, status: lane.status })));
  });

  it('emits one deterministic external NEXT for 12 video types, 30 cards, and 9 Domain Packs', async () => {
    const report = await getStage7MaterialOperations({ repoRoot, now: fixedNow });
    expect(report.tasks).toHaveLength(51);
    expect(new Set(report.tasks.map(task => task.task_id)).size).toBe(51);
    expect(report.tasks.filter(task => task.scope === 'video_type')).toHaveLength(12);
    expect(report.tasks.filter(task => task.scope === 'golden_card')).toHaveLength(30);
    expect(report.tasks.filter(task => task.scope === 'domain_pack')).toHaveLength(9);
    expect(report.tasks.every(task => task.evidence_status === 'missing_external_input' && !task.counts_as_completion)).toBe(true);
  });

  it('keeps the handoff memory-only and excludes simulations, templates, and fixtures from approval', async () => {
    const generatedPaths = [
      'web/generated/stage7-golden-card-reviews',
      'web/generated/stage7-golden-card-candidates',
      'web/generated/stage7-golden-card-signatures',
      'web/generated/stage7-material-handoffs',
    ].map(relative => path.resolve(repoRoot, relative));
    const before = generatedPaths.map(item => existsSync(item));
    const report = await getStage7MaterialOperations({ repoRoot, now: fixedNow });
    expect(report.policy).toMatchObject({ handoff_is_memory_only: true, handoff_is_external_completion: false, simulation_counts_as_real_domain_pack_review: false });
    expect(report.source_bindings).toHaveLength(6);
    expect(report.source_bindings.every(item => /^[a-f0-9]{64}$/.test(item.sha256))).toBe(true);
    expect(report.handoff_package).toMatchObject({ memory_only: true, persisted: false, execution_started: false, human_approval_granted: false, golden_card_promoted: false, domain_pack_promoted: false, professional_passed: false });
    expect(generatedPaths.map(item => existsSync(item))).toEqual(before);
  });

  it('exposes only read-only operations with no export, persist, execute, approve, promote, or writeback endpoint', async () => {
    const app = express();
    app.use(createJsonBodyParser());
    app.use('/api/stage7-golden-cards', createStage7GoldenCardsRouter(repoRoot));
    app.use(errorHandler);
    const request = supertest(app);
    const response = await request.get('/api/stage7-golden-cards/operations');
    expect(response.status).toBe(200);
    expect(response.body.data.summary).toMatchObject({ external_handoff_task_count: 51, professional_pass_count: 0 });
    for (const action of ['export', 'persist', 'execute', 'approve', 'promote', 'writeback']) expect((await request.post(`/api/stage7-golden-cards/operations/${action}`).send({})).status).toBe(404);
  });
});
