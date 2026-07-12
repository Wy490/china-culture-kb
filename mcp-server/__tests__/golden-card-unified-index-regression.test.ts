import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const indexPath = path.join(repoRoot, 'data', 'production-cards', 'golden-card-unified-index.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

function sourceCardIds(index: JsonRecord): Map<string, JsonRecord> {
  const ids = new Map<string, JsonRecord>();

  for (const sourceFile of index.source_card_files as JsonRecord[]) {
    const sourcePath = path.join(repoRoot, sourceFile.path);
    const source = readJson(sourcePath);

    expect(source.video_type).toBe(sourceFile.video_type);
    expect(source.cards).toHaveLength(sourceFile.card_count);

    for (const card of source.cards as JsonRecord[]) {
      ids.set(card.card_id, {
        video_type: source.video_type,
        source_card_file: sourceFile.path,
        entry_name: card.entry_name,
        province: card.province,
      });
    }
  }

  return ids;
}

function fixtureIds(index: JsonRecord): Map<string, JsonRecord> {
  const ids = new Map<string, JsonRecord>();

  for (const coverage of index.regression_coverage_matrix as JsonRecord[]) {
    const sourcePath = path.join(repoRoot, coverage.source_fixture_file);
    const source = readJson(sourcePath);
    const fixture = (source.fixtures as JsonRecord[]).find(item => item.fixture_id === coverage.fixture_id);

    expect(fixture, coverage.fixture_id).toBeTruthy();
    expect(fixture!.card_id).toBe(coverage.card_id);

    ids.set(coverage.fixture_id, coverage);
  }

  return ids;
}

describe('golden card unified index', () => {
  it('indexes all 30 golden cards exactly once and preserves source-card alignment', () => {
    const index = readJson(indexPath);
    const sourceIds = sourceCardIds(index);
    const indexedIds = new Set<string>();

    expect(index.schema_version).toBe('golden-card-unified-index/v1');
    expect(index.writeback_policy.direct_writeback_to_province_markdown).toBe(false);
    expect(index.counts.total_cards).toBe(30);
    expect(index.review_index).toHaveLength(30);
    expect(sourceIds.size).toBe(30);

    for (const item of index.review_index as JsonRecord[]) {
      const sourceCard = sourceIds.get(item.card_id);

      expect(sourceCard, item.card_id).toBeTruthy();
      expect(indexedIds.has(item.card_id), item.card_id).toBe(false);
      expect(item.source_card_file).toBe(sourceCard!.source_card_file);
      expect(item.video_type).toBe(sourceCard!.video_type);
      expect(item.entry_name).toBe(sourceCard!.entry_name);
      expect(item.province).toBe(sourceCard!.province);
      expect(item.review_status).toBe('pending_human_review');
      expect(item.supplement_task_ids.length).toBeGreaterThan(0);
      expect(item.phase2_candidate_ids.length).toBeGreaterThan(0);

      indexedIds.add(item.card_id);
    }
  });

  it('keeps risk-tier counts, p0 review lanes, and supplement task coverage consistent', () => {
    const index = readJson(indexPath);
    const validTaskIds = new Set((index.supplement_tasks as JsonRecord[]).map(task => task.task_id));
    const countsByRisk = { p0: 0, p1: 0, p2: 0 };

    for (const item of index.review_index as JsonRecord[]) {
      expect(['p0', 'p1', 'p2']).toContain(item.risk_tier);
      countsByRisk[item.risk_tier as keyof typeof countsByRisk] += 1;

      for (const taskId of item.supplement_task_ids as string[]) {
        expect(validTaskIds.has(taskId), `${item.card_id} missing task ${taskId}`).toBe(true);
      }

      if (item.risk_tier === 'p0') {
        expect(item.review_lanes.length).toBeGreaterThanOrEqual(3);
        expect(item.supplement_task_ids).toContain('task-regression-sample-expansion');
        expect(item.supplement_task_ids).toContain('task-writeback-draft-after-approval');
      }
    }

    expect(countsByRisk).toEqual(index.counts.by_risk_tier);

    for (const task of index.supplement_tasks as JsonRecord[]) {
      expect(task.acceptance_evidence.length).toBeGreaterThan(0);
      expect(typeof task.blocks_production_ready).toBe('boolean');
      expect(['p0', 'p1', 'p2']).toContain(task.priority);
    }
  });

  it('summarizes the nine regression fixtures and points each fixture to a real indexed card', () => {
    const index = readJson(indexPath);
    const indexedCardIds = new Set((index.review_index as JsonRecord[]).map(item => item.card_id));
    const fixtures = fixtureIds(index);

    expect(index.counts.regression_fixture_count).toBe(9);
    expect(index.regression_coverage_matrix).toHaveLength(9);
    expect(fixtures.size).toBe(9);

    for (const coverage of index.regression_coverage_matrix as JsonRecord[]) {
      expect(indexedCardIds.has(coverage.card_id), coverage.card_id).toBe(true);
      expect(coverage.covered_layers).toContain('gears_segments');
      expect(coverage.covered_layers).toContain('quality_report');
      expect(coverage.risk_boundary_checked.length).toBeGreaterThan(0);
    }
  });

  it('extracts reusable Phase 2 rule candidates without marking them as formal domain packs', () => {
    const index = readJson(indexPath);
    const indexedCardIds = new Set((index.review_index as JsonRecord[]).map(item => item.card_id));
    const candidateIds = new Set<string>();

    expect(index.counts.phase2_domain_pack_candidate_count).toBe(9);
    expect(index.phase2_domain_pack_rule_candidates).toHaveLength(9);

    for (const candidate of index.phase2_domain_pack_rule_candidates as JsonRecord[]) {
      expect(candidate.phase2_status).toBe('candidate_from_phase_1_index');
      expect(candidate.reusable_rule).toBeTruthy();
      expect(candidate.validation_hint).toBeTruthy();
      expect(candidate.source_card_ids.length).toBeGreaterThanOrEqual(2);
      expect(candidateIds.has(candidate.candidate_id), candidate.candidate_id).toBe(false);

      for (const cardId of candidate.source_card_ids as string[]) {
        expect(indexedCardIds.has(cardId), `${candidate.candidate_id} missing card ${cardId}`).toBe(true);
      }

      candidateIds.add(candidate.candidate_id);
    }
  });
});
