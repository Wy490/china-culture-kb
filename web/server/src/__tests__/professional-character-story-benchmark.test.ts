import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EntryDetail } from '@shared/types.js';
import { getFullEntryDetail } from '../../../../mcp-server/src/lib/markdown.js';
import { convertChinaCultureFullEntryDetail as convertFullEntryDetail } from '../domains/china-culture/knowledge-source-adapter.js';
import {
  buildCharacterStoryBenchmarkExecutionManifest,
  validateRealModelBenchmarkRunEvidence,
  type CharacterStoryBenchmarkExecutionManifest,
  type RealModelBenchmarkRunEvidence,
} from '../services/professional-benchmark-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const registry = JSON.parse(fs.readFileSync(path.join(
  repoRoot,
  'data',
  'professional-benchmarks',
  'character-story-iteration3-benchmark-specs.json',
), 'utf8')) as Record<string, unknown>;
const entries = new Map<string, EntryDetail>();
const originalKbRoot = process.env.KB_ROOT;

beforeAll(async () => {
  process.env.KB_ROOT = path.join(repoRoot, 'data');
  const projects = registry.projects as Array<{ source_entry: string }>;
  for (const project of projects) {
    const detail = await getFullEntryDetail(project.source_entry);
    if (!detail) throw new Error(`Missing fixture knowledge entry: ${project.source_entry}`);
    entries.set(project.source_entry, convertFullEntryDetail(detail));
  }
});

afterAll(() => {
  if (originalKbRoot === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = originalKbRoot;
});

function build(): CharacterStoryBenchmarkExecutionManifest {
  return buildCharacterStoryBenchmarkExecutionManifest({
    registry,
    entries,
    model_profile_id: 'claude_opus',
    runtime_inventory: {
      strict_bridge_manifest_path: '/repo/web/server/scripts/professional-character-benchmark-bridge.mjs',
      strict_bridge_realpath: '/repo/web/server/scripts/professional-character-benchmark-bridge.mjs',
      strict_bridge_sha256: 'a'.repeat(64),
      strict_bridge_readable: true,
      selected_model_cli_manifest_path: '/runtime/claude',
      selected_model_cli_realpath: '/runtime/claude',
      selected_model_cli_sha256: 'b'.repeat(64),
      selected_model_cli_executable: true,
    },
    now: '2026-07-11T02:00:00.000Z',
  });
}

describe('character_story professional benchmark preflight', () => {
  it('freezes five real knowledge inputs without invoking a model or claiming professional credit', () => {
    const manifest = build();

    expect(manifest.strict_readiness).toMatchObject({
      provider: 'dedicated_strict_bridge',
      model_profile_id: 'claude_opus',
      model_runtime: 'claude',
      model_id: 'opus',
      technical_ready: true,
      blockers: [],
    });
    expect(manifest.summary).toEqual({
      fixed_project_spec_count: 5,
      source_snapshot_ready_count: 5,
      strict_bridge_anchor_ready_count: 5,
      strict_cli_anchor_ready_count: 5,
      strict_technical_ready_count: 5,
      real_model_execution_ready_count: 0,
      fixed_real_model_project_count: 0,
      fixed_real_model_project_pass_count: 0,
      human_blind_review_pass_count: 0,
      professional_pass_count: 0,
    });
    expect(manifest.policy).toEqual({
      writes_generated_story: false,
      invokes_model: false,
      source_snapshot_is_professional_pass: false,
      fixture_or_simulation_counts_as_real_run: false,
    });
    expect(manifest.packages).toHaveLength(5);
    expect(new Set(manifest.packages.map(item => item.source_snapshot.snapshot_sha256)).size).toBe(5);
    expect(manifest.packages.every(item =>
      item.status === 'source_package_ready'
      && /^[a-f0-9]{64}$/.test(item.source_snapshot.snapshot_sha256)
      && item.source_snapshot.claim_level_verification_complete === false
      && item.execution_contract.fallback_allowed_for_benchmark_credit === false
      && item.execution_contract.fixture_allowed_for_benchmark_credit === false
      && item.professional_passed === false
    )).toBe(true);
  });

  it('keeps strict technical readiness independent from generic story command configuration', () => {
    const manifest = build();

    expect(manifest.strict_readiness.technical_ready).toBe(true);
    expect(manifest.summary.strict_technical_ready_count).toBe(5);
    expect(manifest.summary.real_model_execution_ready_count).toBe(0);
    expect(manifest.packages.every(item => item.status === 'source_package_ready')).toBe(true);
    expect(JSON.stringify(manifest)).not.toContain('STORY_GEN_COMMAND');
    expect(JSON.stringify(manifest)).not.toContain('command_json');
    expect(manifest.summary.fixed_real_model_project_count).toBe(0);
  });

  it('keeps each project single-event, source-bounded and reproducible', () => {
    const manifest = build();

    for (const item of manifest.packages) {
      expect(item.creative_contract.central_event.length).toBeGreaterThan(20);
      expect(item.creative_contract.dramatic_question.length).toBeGreaterThan(20);
      expect(item.truth_boundary.required_evidence_focus.length).toBeGreaterThan(0);
      expect(item.truth_boundary.unknown_or_forbidden_claims.length).toBeGreaterThan(0);
      expect(item.story_generation_request).toMatchObject({
        entry_name: item.source_snapshot.source_entry,
        video_type: 'character_story',
        model_profile_id: 'claude_opus',
        story_structure: 'single_event_drama',
        truth_mode: 'factual_reconstruction',
        auto_repair: true,
      });
      expect(item.execution_contract.required_artifacts).toContain('model-usage-and-cost.json');
      expect(item.execution_contract.required_artifacts).toContain('human-blind-review.json');
    }
  });

  it('rejects fallback or fixture evidence and accepts complete external-model provenance only', () => {
    const executionPackage = build().packages[0];
    const validEvidence: RealModelBenchmarkRunEvidence = {
      schema_version: 'professional-benchmark-real-model-run/v1',
      benchmark_id: executionPackage.benchmark_id,
      run_id: 'run-001',
      execution_kind: 'real_model',
      generation_mode: 'external_model',
      provider: 'claude_cli',
      used_fallback: false,
      model_profile_id: executionPackage.execution_contract.model_profile_id,
      model_id: executionPackage.execution_contract.model_id,
      benchmark_prompt_version: executionPackage.execution_contract.benchmark_prompt_version,
      source_snapshot_sha256: executionPackage.source_snapshot.snapshot_sha256,
      initial_story_path: 'runs/run-001/initial-story.json',
      initial_professional_package_path: 'runs/run-001/initial-professional-text-package.json',
      final_professional_package_path: 'runs/run-001/final-professional-text-package.json',
      revision_trace_path: 'runs/run-001/revision-trace.json',
      usage: {
        input_tokens: 1200,
        output_tokens: 2400,
        cost_amount: 1.25,
        cost_currency: 'USD',
      },
    };

    expect(validateRealModelBenchmarkRunEvidence({
      evidence: validEvidence,
      execution_package: executionPackage,
    })).toEqual({ valid: true, blockers: [] });

    expect(validateRealModelBenchmarkRunEvidence({
      evidence: {
        ...validEvidence,
        execution_kind: 'simulation_fixture',
        generation_mode: 'local_fallback',
        provider: 'local_fixture',
        used_fallback: true,
      },
      execution_package: executionPackage,
    })).toMatchObject({
      valid: false,
      blockers: expect.arrayContaining([
        'execution_kind_not_real_model',
        'generation_mode_not_external_model',
        'provider_not_external',
        'fallback_output_not_allowed',
      ]),
    });
  });
});
