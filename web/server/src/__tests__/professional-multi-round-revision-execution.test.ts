import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildMultiRoundRevisionExecutionManifest,
  validateMultiRoundRevisionExecutionManifest,
  type MultiRoundRevisionSpecRegistry,
} from '../services/professional-multi-round-revision-execution-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

function registry(): MultiRoundRevisionSpecRegistry {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json'), 'utf8'));
}

describe('professional multi-round revision execution plan', () => {
  it('prepares 30 rounds but blocks all 15 projects when external inputs are absent', () => {
    const manifest = buildMultiRoundRevisionExecutionManifest({ registry: registry(), now: '2026-07-11T15:00:00.000Z' });
    expect(manifest.summary).toEqual({
      project_spec_count: 15,
      covered_video_type_count: 15,
      planned_revision_round_count: 30,
      blocked_project_count: 15,
      ready_for_round_1_project_count: 0,
      completed_two_round_verified_project_count: 0,
      recorded_verified_revision_round_count: 0,
      professional_pass_count: 0,
    });
    expect(manifest.projects.every(project => project.blockers.includes('real_project_id_missing')
      && project.blockers.includes('initial_professional_text_package_missing')
      && project.blockers.includes('model_or_human_author_authorization_missing')
      && project.professional_passed === false)).toBe(true);
    expect(validateMultiRoundRevisionExecutionManifest(manifest)).toEqual([]);
  });

  it('can become ready only when every required external input is explicit', () => {
    const specs = registry();
    const realProjectIds = Object.fromEntries(specs.projects.map(project => [project.benchmark_id, `real-${project.benchmark_id}`]));
    const initialPackagePaths = Object.fromEntries(specs.projects.map(project => [project.benchmark_id, `/verified/${project.benchmark_id}/initial-package.json`]));
    const manifest = buildMultiRoundRevisionExecutionManifest({
      registry: specs,
      readiness: {
        real_project_ids: realProjectIds,
        initial_package_paths: initialPackagePaths,
        real_model_or_human_author_authorization_reference: 'authorization-ref',
        revision_budget_reference: 'budget-ref',
        writer_editor_id: 'writer-001',
        director_id: 'director-001',
        fact_culture_reviewer_id: 'fact-001',
        table_read_schedule_reference: 'schedule-ref',
      },
      now: '2026-07-11T15:00:00.000Z',
    });
    expect(manifest.summary.ready_for_round_1_project_count).toBe(15);
    expect(manifest.summary.blocked_project_count).toBe(0);
    expect(manifest.summary.completed_two_round_verified_project_count).toBe(0);
    expect(manifest.projects.every(project => project.blockers.length === 0 && project.status === 'ready_for_round_1')).toBe(true);
  });

  it('rejects incomplete VideoType registries', () => {
    const specs = registry();
    specs.projects.pop();
    expect(() => buildMultiRoundRevisionExecutionManifest({ registry: specs }))
      .toThrow('multi_round_revision_registry_requires_all_15_video_types');
  });

  it('detects false completion credit in a prepared manifest', () => {
    const manifest = buildMultiRoundRevisionExecutionManifest({ registry: registry() });
    manifest.summary.recorded_verified_revision_round_count = 1 as 0;
    expect(validateMultiRoundRevisionExecutionManifest(manifest)).toContain('manifest_false_completion_credit');
  });
});
