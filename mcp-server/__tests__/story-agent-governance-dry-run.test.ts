import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function readJson(relativePath: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')) as Record<string, any>;
}

describe('Story Agent governance dry-run artifacts', () => {
  it('freezes the dirty workspace without staging, committing or mutating generated projects', () => {
    const checkpoint = readJson('data/reports/story-agent-version-checkpoint-20260710.json');

    expect(checkpoint.schema_version).toBe('story-agent-version-checkpoint/v1');
    expect(checkpoint.checkpoint_id).toMatch(/^[a-f0-9]{64}$/);
    expect(checkpoint.summary.changed_file_count).toBeGreaterThan(0);
    expect(checkpoint.summary.missing_file_count).toBe(0);
    expect(checkpoint.mutation_policy).toEqual({
      stages_files: false,
      commits_files: false,
      modifies_generated_projects: false,
      deletes_files: false,
    });
  });

  it('keeps all 827 archive candidates in a reversible signoff exclusion manifest', () => {
    const manifest = readJson('data/reports/story-agent-soft-archive-manifest-20260710.json');

    expect(manifest.schema_version).toBe('story-agent-soft-archive-manifest/v1');
    expect(manifest.mode).toBe('active_signoff_exclusion');
    expect(manifest.entries).toHaveLength(827);
    expect(new Set(manifest.entries.map((item: Record<string, unknown>) => item.project_id)).size).toBe(827);
    expect(manifest.summary).toMatchObject({
      candidate_count: 827,
      project_file_present_count: 827,
      project_file_missing_count: 0,
      applied_count: 827,
      rebuild_whitelist_count: 0,
      deletion_count: 0,
    });
    expect(manifest.entries.every((item: Record<string, unknown>) =>
      item.execution_status === 'signoff_exclusion_active'
    )).toBe(true);
    expect(manifest.policy).toMatchObject({
      destructive_delete_allowed: false,
      project_json_mutation_allowed: false,
      signoff_exclusion_applied: true,
      archive_is_reversible: true,
    });
  });

  it('routes 99 relink candidates without promoting suffix hints or fixtures to safe recovery', () => {
    const triage = readJson('data/reports/story-agent-relink-triage-20260710.json');

    expect(triage.schema_version).toBe('story-agent-relink-triage/v1');
    expect(triage.entries).toHaveLength(99);
    expect(new Set(triage.entries.map((item: Record<string, unknown>) => item.project_id)).size).toBe(99);
    expect(triage.summary).toMatchObject({
      candidate_count: 99,
      safe_auto_relink_count: 0,
      suffix_hint_manual_review_count: 9,
      guessed_relink_count: 0,
      resolved_count: 0,
    });
    expect(triage.entries.every((item: Record<string, unknown>) =>
      item.auto_recovery_safe === false && item.guessed_relink_allowed === false
    )).toBe(true);
  });
});
