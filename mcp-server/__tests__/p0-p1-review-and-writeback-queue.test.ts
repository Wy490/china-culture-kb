import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const reviewQueuePath = path.join(repoRoot, 'data', 'production-cards', 'p0-p1-review-and-writeback-queue.json');
const unifiedIndexPath = path.join(repoRoot, 'data', 'production-cards', 'golden-card-unified-index.json');
const domainPackCandidatesPath = path.join(repoRoot, 'data', 'domain-packs', 'phase2-candidate-rule-packs.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

describe('P0/P1 review and writeback queue', () => {
  it('creates P0 and P1 review packets from the unified risk index', () => {
    const queue = readJson(reviewQueuePath);
    const index = readJson(unifiedIndexPath);
    const indexedById = new Map((index.review_index as JsonRecord[]).map(item => [item.card_id, item]));
    const p0Ids = (index.review_index as JsonRecord[]).filter(item => item.risk_tier === 'p0').map(item => item.card_id);
    const p1Ids = (index.review_index as JsonRecord[]).filter(item => item.risk_tier === 'p1').map(item => item.card_id);

    expect(queue.schema_version).toBe('p0-p1-review-and-writeback-queue/v1');
    expect(queue.writeback_policy.direct_writeback_to_province_markdown).toBe(false);
    expect(queue.writeback_policy.province_markdown_written).toBe(false);
    expect(queue.writeback_policy.manual_patch_required).toBe(true);
    expect(queue.counts.review_packet_count).toBe(2);
    expect(queue.counts.p0_card_count).toBe(4);
    expect(queue.counts.p1_card_count).toBe(12);

    const p0Packet = (queue.review_packets as JsonRecord[]).find(packet => packet.risk_tier === 'p0');
    const p1Packet = (queue.review_packets as JsonRecord[]).find(packet => packet.risk_tier === 'p1');

    expect(p0Packet).toBeTruthy();
    expect(p1Packet).toBeTruthy();
    expect(new Set(p0Packet!.card_ids)).toEqual(new Set(p0Ids));
    expect(new Set(p1Packet!.card_ids)).toEqual(new Set(p1Ids));

    for (const item of queue.card_review_items as JsonRecord[]) {
      const indexed = indexedById.get(item.card_id);

      expect(indexed, item.card_id).toBeTruthy();
      expect(['p0', 'p1']).toContain(item.risk_tier);
      expect(item.risk_tier).toBe(indexed!.risk_tier);
      expect(item.video_type).toBe(indexed!.video_type);
      expect(item.source_card_file).toBe(indexed!.source_card_file);
      expect(item.review_lanes).toEqual(indexed!.review_lanes);
      expect(item.required_evidence_groups.length).toBeGreaterThanOrEqual(3);
      expect(item.decision_blockers.length).toBeGreaterThanOrEqual(3);
      expect(item.writeback_candidate_id).toBeTruthy();
    }
  });

  it('keeps all writeback drafts blocked until human review and manual patch', () => {
    const queue = readJson(reviewQueuePath);
    const reviewItemByWritebackId = new Map(
      (queue.card_review_items as JsonRecord[]).map(item => [item.writeback_candidate_id, item])
    );

    expect(queue.counts.review_card_count).toBe(16);
    expect(queue.counts.writeback_draft_candidate_count).toBe(16);
    expect(queue.writeback_draft_queue).toHaveLength(16);

    for (const draft of queue.writeback_draft_queue as JsonRecord[]) {
      const reviewItem = reviewItemByWritebackId.get(draft.writeback_candidate_id);

      expect(reviewItem, draft.writeback_candidate_id).toBeTruthy();
      expect(draft.card_id).toBe(reviewItem!.card_id);
      expect(draft.risk_tier).toBe(reviewItem!.risk_tier);
      expect(draft.candidate_status).toBe('blocked_pending_human_review');
      expect(draft.target_policy).toBe('manual_patch_candidate_only');
      expect(draft.required_gate_ids).toContain('human_review_approved');
      expect(draft.required_gate_ids).toContain('source_evidence_attached');
      expect(draft.required_gate_ids).toContain('manual_patch_required');
      expect(draft.allowed_field_groups_after_approval).not.toContain('generated_full_text');
      expect(draft.allowed_field_groups_after_approval).not.toContain('scene_breakdown');
      expect(draft.allowed_field_groups_after_approval).not.toContain('gears_segments');
    }
  });

  it('creates first review questions for every Phase 2 candidate pack', () => {
    const queue = readJson(reviewQueuePath);
    const candidates = readJson(domainPackCandidatesPath);
    const candidateIds = new Set((candidates.candidates as JsonRecord[]).map(candidate => candidate.candidate_id));
    const questionIds = new Set(
      (queue.domain_pack_review_questions as JsonRecord[]).map(question => question.candidate_id)
    );

    expect(queue.counts.domain_pack_review_question_count).toBe(candidates.candidate_count);
    expect(queue.domain_pack_review_questions).toHaveLength(candidates.candidate_count);
    expect(questionIds).toEqual(candidateIds);

    for (const question of queue.domain_pack_review_questions as JsonRecord[]) {
      expect(question.review_status).toBe('pending_domain_review');
      expect(question.first_review_questions.length).toBeGreaterThanOrEqual(3);
      expect(question.promotion_blockers.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('tracks Iteration 8 exit gates without marking writeback as complete', () => {
    const queue = readJson(reviewQueuePath);
    const gates = new Map((queue.iteration_8_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(gates.get('p0-p1-review-packets-created')?.status).toBe('met');
    expect(gates.get('writeback-draft-queue-created')?.status).toBe('met_as_candidate_queue');
    expect(gates.get('domain-pack-review-questions-created')?.status).toBe('met');
    expect(gates.get('no-direct-province-writeback')?.status).toBe('met');
    expect(queue.writeback_policy.province_markdown_written).toBe(false);
  });
});
