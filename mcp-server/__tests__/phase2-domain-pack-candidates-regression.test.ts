import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const candidatesPath = path.join(repoRoot, 'data', 'domain-packs', 'phase2-candidate-rule-packs.json');
const formalDomainPackPath = path.join(repoRoot, 'data', 'domain-packs', 'china-culture.json');
const unifiedIndexPath = path.join(repoRoot, 'data', 'production-cards', 'golden-card-unified-index.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

describe('Phase 2 domain pack candidates', () => {
  it('keeps nine candidate packs separate from the formal domain pack', () => {
    const candidates = readJson(candidatesPath);
    const formalDomainPack = readJson(formalDomainPackPath);
    const formalEntryNames = new Set((formalDomainPack.entries as JsonRecord[]).map(entry => entry.entry_name));

    expect(candidates.schema_version).toBe('phase2-domain-pack-candidates/v1');
    expect(candidates.status).toBe('candidate_pending_domain_review');
    expect(candidates.write_policy.formal_domain_pack_written).toBe(false);
    expect(candidates.write_policy.direct_write_to_china_culture_json).toBe(false);
    expect(candidates.candidate_count).toBe(9);
    expect(candidates.candidates).toHaveLength(9);

    for (const candidate of candidates.candidates as JsonRecord[]) {
      expect(candidate.type).toBe('Domain Pack Candidate');
      expect(candidate.status).toBe('candidate_pending_domain_review');
      expect(formalEntryNames.has(candidate.entry_name), candidate.entry_name).toBe(false);
    }
  });

  it('mirrors the Phase 2 rule candidates from the unified golden-card index', () => {
    const candidates = readJson(candidatesPath);
    const index = readJson(unifiedIndexPath);
    const candidateIds = new Set((candidates.candidates as JsonRecord[]).map(candidate => candidate.candidate_id));
    const indexCandidateIds = new Set(
      (index.phase2_domain_pack_rule_candidates as JsonRecord[]).map(candidate => candidate.candidate_id)
    );

    expect(candidateIds).toEqual(indexCandidateIds);

    for (const candidate of candidates.candidates as JsonRecord[]) {
      const indexCandidate = (index.phase2_domain_pack_rule_candidates as JsonRecord[]).find(
        item => item.candidate_id === candidate.candidate_id
      );

      expect(indexCandidate).toBeTruthy();
      expect(candidate.source_rule_candidate_id).toBe(indexCandidate!.candidate_id);
      expect(candidate.source_card_ids).toEqual(indexCandidate!.source_card_ids);
    }
  });

  it('covers every Phase 2 candidate referenced by P0/P1 production cards', () => {
    const candidates = readJson(candidatesPath);
    const index = readJson(unifiedIndexPath);
    const candidateIds = new Set((candidates.candidates as JsonRecord[]).map(candidate => candidate.candidate_id));

    for (const item of index.review_index as JsonRecord[]) {
      for (const candidateId of item.phase2_candidate_ids as string[]) {
        expect(candidateIds.has(candidateId), `${item.card_id} references missing candidate ${candidateId}`).toBe(true);
      }
    }
  });

  it('keeps candidate packs production-ready enough for review but blocked from formal promotion', () => {
    const candidates = readJson(candidatesPath);
    const index = readJson(unifiedIndexPath);
    const indexedCards = new Set((index.review_index as JsonRecord[]).map(item => item.card_id));
    const fixtureIds = new Set((index.regression_coverage_matrix as JsonRecord[]).map(item => item.fixture_id));

    for (const candidate of candidates.candidates as JsonRecord[]) {
      expect(candidate.summary).toBeTruthy();
      expect(candidate.keywords.length).toBeGreaterThanOrEqual(5);
      expect(candidate.asset_usage.length).toBeGreaterThanOrEqual(3);
      expect(candidate.production_prompts.length).toBeGreaterThanOrEqual(4);
      expect(candidate.review_boundaries.length).toBeGreaterThanOrEqual(4);
      expect(candidate.trigger_words.length).toBeGreaterThanOrEqual(5);
      expect(candidate.source_card_ids.length).toBeGreaterThanOrEqual(2);
      expect(candidate.source_regression_fixture_ids.length).toBeGreaterThanOrEqual(1);
      expect(candidate.promotion_gate).toBeTruthy();

      for (const cardId of candidate.source_card_ids as string[]) {
        expect(indexedCards.has(cardId), `${candidate.candidate_id} missing card ${cardId}`).toBe(true);
      }

      for (const fixtureId of candidate.source_regression_fixture_ids as string[]) {
        expect(fixtureIds.has(fixtureId), `${candidate.candidate_id} missing fixture ${fixtureId}`).toBe(true);
      }
    }

    for (const backlog of candidates.promotion_backlog as JsonRecord[]) {
      expect(backlog.status).toBe('pending');
    }
  });
});
