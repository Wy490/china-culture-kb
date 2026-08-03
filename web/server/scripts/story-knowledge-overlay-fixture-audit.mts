import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { StoryKnowledgeEvidenceOverlayV1Schema } from '../../shared/schemas.js';
import type {
  EntryDetail,
  StoryKnowledgeEvidenceOverlayV1,
} from '../../shared/types.js';
import {
  resolveStoryKnowledgePreparation,
} from '../src/domains/china-culture/story-knowledge-preparation-service.js';

interface FixtureSetV1 {
  schema_version: 'story-knowledge-evidence-overlay-fixture-set/v1';
  fixture_set_id: string;
  audited_at: string;
  fixture_only: true;
  real_human_review_credit_granted: false;
  generated_story_output_expected_unchanged: true;
  legacy_entry: EntryDetail;
  pending_overlay: StoryKnowledgeEvidenceOverlayV1;
  approved_overlay: StoryKnowledgeEvidenceOverlayV1;
}

const repositoryRoot = resolve(import.meta.dirname, '..', '..', '..');
const fixturePath = resolve(
  repositoryRoot,
  'data',
  'fixtures',
  'story-knowledge-evidence-overlay-v1-fixtures.json',
);
const reportPath = resolve(
  repositoryRoot,
  'data',
  'reports',
  'story-agent-knowledge-overlay-m1-fixture-report.json',
);
const fixtureSet = parseFixtureSet(
  JSON.parse(await readFile(fixturePath, 'utf8')) as unknown,
);
const pending = resolveStoryKnowledgePreparation(
  fixtureSet.legacy_entry,
  fixtureSet.pending_overlay,
);
const approved = resolveStoryKnowledgePreparation(
  fixtureSet.legacy_entry,
  fixtureSet.approved_overlay,
);
const invariants = {
  fixture_is_explicitly_synthetic: fixtureSet.fixture_only,
  no_real_human_review_credit: (
    !fixtureSet.real_human_review_credit_granted
    && !pending.boundary.real_human_review_credit_granted
    && !approved.boundary.real_human_review_credit_granted
  ),
  pending_overlay_stays_bounded: (
    pending.status === 'overlay_pending'
    && !pending.contract.boundary.critical_facts_can_be_asserted
  ),
  approved_fixture_exercises_evidence_gate: (
    approved.status === 'overlay_approved_read_only'
    && approved.contract.boundary.critical_facts_can_be_asserted
    && approved.report.critical_fact_ready_count === 1
  ),
  preparation_never_changes_generation_output: (
    fixtureSet.generated_story_output_expected_unchanged
    && !pending.boundary.generation_output_changed
    && !approved.boundary.generation_output_changed
  ),
  preparation_never_persists: (
    !pending.boundary.persistence_allowed
    && !approved.boundary.persistence_allowed
  ),
};
const status = Object.values(invariants).every(Boolean) ? 'passed' : 'failed';
const report = {
  schema_version: 'story-knowledge-overlay-fixture-audit/v1',
  fixture_set_id: fixtureSet.fixture_set_id,
  audited_at: fixtureSet.audited_at,
  status,
  fixture_path: 'data/fixtures/story-knowledge-evidence-overlay-v1-fixtures.json',
  cases: {
    pending: {
      overlay_id: fixtureSet.pending_overlay.overlay_id,
      preparation_status: pending.status,
      source_count: pending.report.source_count,
      claim_count: pending.report.claim_count,
      critical_fact_ready_count: pending.report.critical_fact_ready_count,
      missing_material_count: pending.report.missing_material_count,
    },
    approved: {
      overlay_id: fixtureSet.approved_overlay.overlay_id,
      preparation_status: approved.status,
      source_count: approved.report.source_count,
      claim_count: approved.report.claim_count,
      critical_fact_ready_count: approved.report.critical_fact_ready_count,
      missing_material_count: approved.report.missing_material_count,
    },
  },
  invariants,
  boundary: {
    fixture_only: true,
    real_human_review_credit_granted: false,
    consumed_by_generation: false,
    source_markdown_writeback_allowed: false,
    persistence_allowed: false,
  },
};

await mkdir(resolve(repositoryRoot, 'data', 'reports'), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  schema_version: report.schema_version,
  status: report.status,
  report_path: reportPath,
  cases: report.cases,
  invariants: report.invariants,
  boundary: report.boundary,
}, null, 2));
if (status === 'failed') process.exitCode = 1;

function parseFixtureSet(input: unknown): FixtureSetV1 {
  if (!input || typeof input !== 'object') {
    throw new Error('fixture set must be an object');
  }
  const candidate = input as Partial<FixtureSetV1>;
  if (candidate.schema_version !== 'story-knowledge-evidence-overlay-fixture-set/v1') {
    throw new Error('unsupported fixture set schema_version');
  }
  if (
    candidate.fixture_only !== true
    || candidate.real_human_review_credit_granted !== false
    || candidate.generated_story_output_expected_unchanged !== true
  ) {
    throw new Error('fixture set safety boundary is invalid');
  }
  if (
    !candidate.fixture_set_id
    || !candidate.audited_at
    || !candidate.legacy_entry
  ) {
    throw new Error('fixture set identity or legacy entry is missing');
  }
  return {
    schema_version: candidate.schema_version,
    fixture_set_id: candidate.fixture_set_id,
    audited_at: candidate.audited_at,
    fixture_only: true,
    real_human_review_credit_granted: false,
    generated_story_output_expected_unchanged: true,
    legacy_entry: candidate.legacy_entry,
    pending_overlay: StoryKnowledgeEvidenceOverlayV1Schema.parse(
      candidate.pending_overlay,
    ),
    approved_overlay: StoryKnowledgeEvidenceOverlayV1Schema.parse(
      candidate.approved_overlay,
    ),
  };
}
