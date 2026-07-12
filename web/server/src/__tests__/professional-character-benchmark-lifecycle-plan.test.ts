import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CharacterStoryBenchmarkExecutionManifest } from '../services/professional-benchmark-service.js';
import { hashProfessionalBenchmarkArtifact } from '../services/professional-benchmark-run-service.js';
import type { ControlledCharacterBenchmarkRunPlan } from '../../../../scripts/story-agent-character-benchmark-runner.mjs';
import {
  REQUIRED_LIFECYCLE_ARTIFACT_CHAIN,
  buildCharacterBenchmarkLifecyclePlan,
  parseLifecyclePlanArgs,
  readAndValidateStoredLifecyclePlan,
  validateCharacterBenchmarkLifecyclePlan,
} from '../../../../scripts/story-agent-character-benchmark-lifecycle-plan.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const manifestPath = path.join(
  repoRoot,
  'data',
  'professional-benchmarks',
  'character-story-iteration3-execution-manifest.json',
);
const controlledPlanPath = path.join(
  repoRoot,
  'data',
  'professional-benchmarks',
  'character-story-iteration3-controlled-run-plan.json',
);
const lifecyclePlanPath = path.join(
  repoRoot,
  'data',
  'professional-benchmarks',
  'character-story-iteration3-lifecycle-plan.json',
);
const runsPath = path.join(
  repoRoot,
  'data',
  'professional-benchmarks',
  'character-story-iteration3-runs',
);
const NOW = '2026-07-11T10:00:00.000Z';

function readSources(): {
  manifest: CharacterStoryBenchmarkExecutionManifest;
  controlled_plan: ControlledCharacterBenchmarkRunPlan;
} {
  return {
    manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as CharacterStoryBenchmarkExecutionManifest,
    controlled_plan: JSON.parse(
      fs.readFileSync(controlledPlanPath, 'utf8'),
    ) as ControlledCharacterBenchmarkRunPlan,
  };
}

describe('character_story professional benchmark lifecycle plan', () => {
  it('builds five blocked post-initial lifecycles with the full professional artifact chain', () => {
    const sources = readSources();
    const runsDirectoryExisted = fs.existsSync(runsPath);
    const plan = buildCharacterBenchmarkLifecyclePlan({ ...sources, now: NOW });

    expect(validateCharacterBenchmarkLifecyclePlan(plan)).toEqual({ valid: true, blockers: [] });
    expect(fs.existsSync(runsPath)).toBe(runsDirectoryExisted);
    expect(plan.summary).toEqual({
      fixed_project_spec_count: 5,
      awaiting_verified_initial_run_count: 5,
      blocked_run_count: 5,
      model_invocation_count: 0,
      initial_real_model_completed_count: 0,
      initial_professional_text_package_count: 0,
      initial_quality_report_count: 0,
      revision_work_order_count: 0,
      revision_output_count: 0,
      final_professional_text_package_count: 0,
      final_quality_report_count: 0,
      artifact_validation_pass_count: 0,
      human_blind_review_pass_count: 0,
      finalization_candidate_count: 0,
      signed_release_count: 0,
      professional_pass_count: 0,
      fixture_simulation_or_local_credit_count: 0,
    });
    expect(plan.runs).toHaveLength(5);
    expect(plan.required_artifact_chain.map(stage => stage.stage_id)).toEqual([
      'verified_initial_external_story',
      'initial_professional_text_package',
      'initial_quality_report',
      'revision_work_order',
      'revision_output',
      'final_professional_text_package',
      'final_quality_report',
      'human_blind_review',
      'artifact_validation',
      'finalization_candidate',
      'signed_release',
    ]);
    expect(plan.runs.every(run =>
      run.status === 'awaiting_verified_initial_run'
      && run.execution_state === 'blocked'
      && run.blockers[0] === 'verified_initial_external_story_missing'
      && run.stages.map(stage => stage.stage_id).join(',')
        === REQUIRED_LIFECYCLE_ARTIFACT_CHAIN.map(stage => stage.stage_id).join(',')
      && run.stages.every(stage => stage.professional_credit === false)
      && run.initial_real_model_completed === false
      && run.model_output_validated === false
      && run.human_blind_review_passed === false
      && run.signed_release_present === false
      && run.professional_passed === false
    )).toBe(true);
  });

  it('binds both source documents and every controlled run without copying sensitive payloads', () => {
    const sources = readSources();
    const plan = buildCharacterBenchmarkLifecyclePlan({ ...sources, now: NOW });

    expect(plan.source_manifest.sha256).toBe(hashProfessionalBenchmarkArtifact(sources.manifest));
    expect(plan.source_controlled_plan).toMatchObject({
      integrity_sha256: sources.controlled_plan.integrity_sha256,
      artifact_sha256: hashProfessionalBenchmarkArtifact(sources.controlled_plan),
    });
    for (const run of plan.runs) {
      const controlledRun = sources.controlled_plan.runs.find(item =>
        item.benchmark_id === run.benchmark_id
      );
      expect(controlledRun).toBeDefined();
      expect(run.controlled_run_sha256).toBe(hashProfessionalBenchmarkArtifact(controlledRun));
    }
    const serialized = JSON.stringify(plan);
    expect(serialized).not.toMatch(/"(?:system_prompt|user_prompt|story_generation_prompt|entry_story)"\s*:/i);
    expect(serialized).not.toMatch(/"(?:credential|api_key|access_token|authorization_reference)"\s*:/i);
  });

  it('is deterministic for the same frozen sources and timestamp', () => {
    const sources = readSources();
    const left = buildCharacterBenchmarkLifecyclePlan({ ...sources, now: NOW });
    const right = buildCharacterBenchmarkLifecyclePlan({ ...sources, now: NOW });

    expect(right).toEqual(left);
    expect(right.integrity_sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects tampering, reordered lifecycle stages, and nonzero credit claims', () => {
    const plan = buildCharacterBenchmarkLifecyclePlan({ ...readSources(), now: NOW });
    const tampered = structuredClone(plan);
    tampered.summary.professional_pass_count = 1 as 0;
    tampered.runs[0].professional_passed = true as false;
    tampered.runs[0].stages.reverse();

    expect(validateCharacterBenchmarkLifecyclePlan(tampered)).toMatchObject({
      valid: false,
      blockers: expect.arrayContaining([
        'integrity_sha256_mismatch',
        'nonzero_lifecycle_credit_or_completion_claim',
        'unsupported_run_credit',
        'run_lifecycle_stage_mismatch',
      ]),
    });

    const resealed = structuredClone(plan);
    (resealed.required_artifact_chain[0] as unknown as { completion_evidence: string })
      .completion_evidence = 'self-declared';
    resealed.runs[0].stages[1].blocker = 'manual_override';
    const hashInput = { ...resealed } as Partial<typeof resealed>;
    delete hashInput.integrity_sha256;
    resealed.integrity_sha256 = hashProfessionalBenchmarkArtifact(hashInput);
    expect(validateCharacterBenchmarkLifecyclePlan(resealed)).toMatchObject({
      valid: false,
      blockers: expect.arrayContaining([
        'required_artifact_chain_mismatch',
        'run_lifecycle_stage_mismatch',
      ]),
    });
  });

  it('rejects legacy lifecycle, execution-manifest, and controlled-plan schemas', () => {
    const sources = readSources();
    const plan = buildCharacterBenchmarkLifecyclePlan({ ...sources, now: NOW });
    expect(validateCharacterBenchmarkLifecyclePlan({
      ...plan,
      schema_version: 'character-story-professional-benchmark-lifecycle-plan/v0',
    })).toEqual({
      valid: false,
      blockers: ['legacy_lifecycle_plan_read_only_rebuild_v1'],
    });

    expect(() => buildCharacterBenchmarkLifecyclePlan({
      ...sources,
      manifest: {
        ...sources.manifest,
        schema_version: 'character-story-professional-benchmark-execution-manifest/v1',
      } as unknown as CharacterStoryBenchmarkExecutionManifest,
      now: NOW,
    })).toThrow('legacy_generic_readiness_manifest_read_only_rebuild_v2');

    expect(() => buildCharacterBenchmarkLifecyclePlan({
      ...sources,
      controlled_plan: {
        ...sources.controlled_plan,
        schema_version: 'character-story-controlled-benchmark-run-plan/v1',
      } as unknown as ControlledCharacterBenchmarkRunPlan,
      now: NOW,
    })).toThrow('legacy_controlled_plan_read_only_rebuild_v2');
  });

  it('rejects re-sealed source credit and source binding tampering', () => {
    const sources = readSources();
    const creditedPlan = structuredClone(sources.controlled_plan);
    creditedPlan.summary.real_model_completed_count = 1 as 0;
    const hashInput = { ...creditedPlan } as Partial<ControlledCharacterBenchmarkRunPlan>;
    delete hashInput.integrity_sha256;
    creditedPlan.integrity_sha256 = hashProfessionalBenchmarkArtifact(hashInput);
    expect(() => buildCharacterBenchmarkLifecyclePlan({
      manifest: sources.manifest,
      controlled_plan: creditedPlan,
      now: NOW,
    })).toThrow();

    const stalePlan = structuredClone(sources.controlled_plan);
    stalePlan.source_manifest_sha256 = '0'.repeat(64);
    const staleHashInput = { ...stalePlan } as Partial<ControlledCharacterBenchmarkRunPlan>;
    delete staleHashInput.integrity_sha256;
    stalePlan.integrity_sha256 = hashProfessionalBenchmarkArtifact(staleHashInput);
    expect(() => buildCharacterBenchmarkLifecyclePlan({
      manifest: sources.manifest,
      controlled_plan: stalePlan,
      now: NOW,
    })).toThrow();
  });

  it('exposes only plan, write, and check modes', () => {
    expect(parseLifecyclePlanArgs([])).toEqual({ mode: 'plan' });
    expect(parseLifecyclePlanArgs(['--plan'])).toEqual({ mode: 'plan' });
    expect(parseLifecyclePlanArgs(['--write'])).toEqual({ mode: 'write' });
    expect(parseLifecyclePlanArgs(['--check'])).toEqual({ mode: 'check' });
    expect(() => parseLifecyclePlanArgs(['--plan', '--write'])).toThrow('mutually exclusive');
    for (const arg of ['--execute', '--credential', '--authorization-reference', '--prompt']) {
      expect(() => parseLifecyclePlanArgs([arg])).toThrow('Unsupported lifecycle plan argument');
    }
  });

  it('validates the stored lifecycle plan and its current source bindings', async () => {
    expect(fs.existsSync(lifecyclePlanPath)).toBe(true);
    const checked = await readAndValidateStoredLifecyclePlan();

    expect(checked.integrity_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(checked.summary.blocked_run_count).toBe(5);
    expect(checked.summary.professional_pass_count).toBe(0);
  });
});
