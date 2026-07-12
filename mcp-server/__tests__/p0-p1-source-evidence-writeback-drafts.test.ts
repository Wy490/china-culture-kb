import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const evidenceDraftsPath = path.join(repoRoot, 'data', 'production-cards', 'p0-p1-source-evidence-and-writeback-drafts.json');
const reviewQueuePath = path.join(repoRoot, 'data', 'production-cards', 'p0-p1-review-and-writeback-queue.json');

const FORBIDDEN_TEMPLATE_PATTERN =
  /(generated_full_text|scene_breakdown|gears_segments|dialogue_bubbles|fictional_plot|seedance_prompt|Seedance prompt|医疗指导|敏感历史复现)/;

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

describe('P0/P1 source evidence and writeback draft templates', () => {
  it('creates one evidence package template for every P0/P1 review item', () => {
    const data = readJson(evidenceDraftsPath);
    const queue = readJson(reviewQueuePath);
    const reviewItemsById = new Map((queue.card_review_items as JsonRecord[]).map(item => [item.review_item_id, item]));

    expect(data.schema_version).toBe('p0-p1-source-evidence-writeback-drafts/v1');
    expect(data.writeback_policy.direct_writeback_to_province_markdown).toBe(false);
    expect(data.writeback_policy.province_markdown_written).toBe(false);
    expect(data.writeback_policy.current_layer).toBe('template_only');
    expect(data.counts.source_evidence_package_template_count).toBe(16);
    expect(data.source_evidence_package_templates).toHaveLength(16);

    for (const template of data.source_evidence_package_templates as JsonRecord[]) {
      const reviewItem = reviewItemsById.get(template.review_item_id);

      expect(reviewItem, template.review_item_id).toBeTruthy();
      expect(template.card_id).toBe(reviewItem!.card_id);
      expect(template.writeback_candidate_id).toBe(reviewItem!.writeback_candidate_id);
      expect(template.risk_tier).toBe(reviewItem!.risk_tier);
      expect(template.evidence_slots).toContain('source_bibliography');
      expect(template.evidence_slots).toContain('fact_boundary_table');
      expect(template.evidence_slots).toContain('authorization_or_consent');
      expect(template.evidence_slots).toContain('writeback_scope_review');
      expect(template.minimum_pass_conditions.length).toBeGreaterThanOrEqual(3);
      expect(template.writeback_scope_hint).toBeTruthy();

      if (template.risk_tier === 'p0') {
        expect(template.evidence_slots).toContain('p0_special_safety_check');
      }
    }
  });

  it('creates blocked Markdown templates for every candidate writeback draft', () => {
    const data = readJson(evidenceDraftsPath);
    const queue = readJson(reviewQueuePath);
    const queueByWritebackId = new Map(
      (queue.writeback_draft_queue as JsonRecord[]).map(item => [item.writeback_candidate_id, item])
    );

    expect(data.counts.writeback_markdown_template_count).toBe(16);
    expect(data.writeback_markdown_templates).toHaveLength(16);

    for (const template of data.writeback_markdown_templates as JsonRecord[]) {
      const queued = queueByWritebackId.get(template.writeback_candidate_id);

      expect(queued, template.writeback_candidate_id).toBeTruthy();
      expect(template.card_id).toBe(queued!.card_id);
      expect(template.status).toBe('template_pending_human_review');
      expect(template.province_markdown_written).toBe(false);
      expect(template.markdown_template).toContain('状态：template_pending_human_review');
      expect(template.markdown_template).toContain('可写回候选字段');
      expect(template.markdown_template).toContain('不写入内容');
      expect(template.markdown_template).not.toMatch(FORBIDDEN_TEMPLATE_PATTERN);
    }
  });

  it('adds P0 special check samples for trauma history and medical heritage', () => {
    const data = readJson(evidenceDraftsPath);
    const samples = data.p0_special_check_samples as JsonRecord[];
    const sampleFamilies = new Set(samples.map(sample => sample.risk_family));
    const decisions = new Set(samples.map(sample => sample.expected_decision));

    expect(data.counts.p0_special_check_sample_count).toBe(4);
    expect(samples).toHaveLength(4);
    expect(sampleFamilies).toEqual(new Set(['historical_trauma', 'medical_heritage']));
    expect(decisions.has('reject')).toBe(true);
    expect(decisions.has('allow_for_human_review')).toBe(true);

    for (const sample of samples) {
      expect(sample.sample_id).toBeTruthy();
      expect(sample.sample_text).toBeTruthy();
      if (sample.expected_decision === 'reject') {
        expect(sample.triggered_blockers.length).toBeGreaterThanOrEqual(3);
        expect(sample.required_repair).toBeTruthy();
      } else {
        expect(sample.required_review_notes.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('tracks Iteration 9 gates without marking province writeback complete', () => {
    const data = readJson(evidenceDraftsPath);
    const gates = new Map((data.iteration_9_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(gates.get('source-evidence-package-templates-created')?.status).toBe('met');
    expect(gates.get('writeback-markdown-templates-created')?.status).toBe('met_as_templates_only');
    expect(gates.get('p0-special-check-samples-created')?.status).toBe('met');
    expect(gates.get('no-direct-province-writeback')?.status).toBe('met');
    expect(data.writeback_policy.province_markdown_written).toBe(false);
  });
});
