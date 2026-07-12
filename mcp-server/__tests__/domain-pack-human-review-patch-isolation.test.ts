import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const isolationPath = path.join(repoRoot, 'data', 'production-cards', 'domain-pack-human-review-and-patch-isolation.json');
const precheckPath = path.join(repoRoot, 'data', 'production-cards', 'p0-p1-review-export-and-domain-pack-precheck.json');
const candidatesPath = path.join(repoRoot, 'data', 'domain-packs', 'phase2-candidate-rule-packs.json');
const formalDomainPackPath = path.join(repoRoot, 'data', 'domain-packs', 'china-culture.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

describe('Domain Pack human review templates and patch isolation', () => {
  it('creates one independent review template and Markdown file for every candidate', () => {
    const isolation = readJson(isolationPath);
    const candidates = readJson(candidatesPath);
    const candidateIds = new Set((candidates.candidates as JsonRecord[]).map(candidate => candidate.candidate_id));
    const templateIds = new Set(
      (isolation.domain_pack_review_templates as JsonRecord[]).map(template => template.candidate_id)
    );

    expect(isolation.schema_version).toBe('domain-pack-human-review-patch-isolation/v1');
    expect(isolation.counts.domain_pack_review_template_count).toBe(9);
    expect(isolation.counts.domain_pack_review_markdown_count).toBe(9);
    expect(templateIds).toEqual(candidateIds);

    for (const template of isolation.domain_pack_review_templates as JsonRecord[]) {
      const markdownPath = path.join(repoRoot, template.path);
      const markdown = fs.readFileSync(markdownPath, 'utf-8');

      expect(template.review_status).toBe('template_pending_human_review');
      expect(template.required_reviewer_roles.length).toBeGreaterThanOrEqual(3);
      expect(template.required_sections.length).toBeGreaterThanOrEqual(6);
      expect(template.formal_patch_created).toBe(false);
      expect(markdown).toContain(`candidate_id: ${template.candidate_id}`);
      expect(markdown).toContain('状态：template_pending_human_review');
      expect(markdown).toContain('formal_patch_created: false');
      expect(markdown).toContain('formal_domain_pack_written: false');
      expect(markdown).toContain('province_markdown_written: false');
    }
  });

  it('keeps pass draft preparation templates separate from formal patches', () => {
    const isolation = readJson(isolationPath);
    const precheck = readJson(precheckPath);
    const passTaskIds = new Set((precheck.pass_candidate_queue as JsonRecord[]).map(item => item.task_id));

    expect(isolation.counts.pass_draft_prepare_template_count).toBe(2);
    expect(isolation.pass_draft_prepare_templates).toHaveLength(2);

    for (const template of isolation.pass_draft_prepare_templates as JsonRecord[]) {
      expect(passTaskIds.has(template.source_task_id), template.source_task_id).toBe(true);
      expect(template.status).toBe('draft_preparation_template_only');
      expect(template.formal_patch_created).toBe(false);
      expect(template.writeback_allowed_now).toBe(false);
      expect(template.allowed_after_real_review.length).toBeGreaterThanOrEqual(4);
      expect(template.prohibited_in_template).toContain('generated_full_text');
      expect(template.prohibited_in_template).toContain('seedance_prompt');
    }
  });

  it('tracks all repair and reject tasks with open statuses', () => {
    const isolation = readJson(isolationPath);
    const precheck = readJson(precheckPath);
    const sourceTaskIds = new Set([
      ...(precheck.repair_task_queue as JsonRecord[]).map(item => item.task_id),
      ...(precheck.reject_task_queue as JsonRecord[]).map(item => item.task_id),
    ]);
    const trackedTaskIds = new Set((isolation.repair_reject_task_statuses as JsonRecord[]).map(item => item.task_id));

    expect(isolation.counts.tracked_repair_reject_task_count).toBe(14);
    expect(isolation.counts.repair_task_status_count).toBe(11);
    expect(isolation.counts.reject_task_status_count).toBe(3);
    expect(trackedTaskIds).toEqual(sourceTaskIds);

    for (const task of isolation.repair_reject_task_statuses as JsonRecord[]) {
      expect(task.status.startsWith('open_')).toBe(true);
      expect(task.owner_role).toBeTruthy();
      expect(task.next_status_options.length).toBeGreaterThanOrEqual(3);
      if (task.decision_type === 'reject') {
        expect(task.next_status_options).toContain('new_source_package_created');
      } else {
        expect(task.next_status_options).toContain('repair_resubmitted');
      }
    }
  });

  it('defines patch isolation rules and keeps the formal domain pack untouched', () => {
    const isolation = readJson(isolationPath);
    const formalDomainPack = readJson(formalDomainPackPath);
    const formalEntryNames = new Set((formalDomainPack.entries as JsonRecord[]).map(entry => entry.entry_name));

    expect(isolation.counts.patch_isolation_rule_count).toBe(6);
    expect(isolation.counts.formal_patch_count).toBe(0);
    expect(isolation.writeback_policy.formal_patch_created).toBe(false);
    expect(isolation.writeback_policy.formal_domain_pack_written).toBe(false);
    expect(isolation.writeback_policy.direct_write_to_china_culture_json).toBe(false);
    expect(isolation.writeback_policy.province_markdown_written).toBe(false);

    for (const rule of isolation.patch_isolation_rules as JsonRecord[]) {
      expect(rule.rule_id).toBeTruthy();
      expect(rule.description).toBeTruthy();
    }

    for (const template of isolation.domain_pack_review_templates as JsonRecord[]) {
      expect(formalEntryNames.has(template.entry_name), template.entry_name).toBe(false);
    }
  });

  it('tracks Iteration 14 gates without creating a formal patch', () => {
    const isolation = readJson(isolationPath);
    const machineGates = new Map((isolation.machine_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));
    const exitGates = new Map((isolation.iteration_14_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(isolation.counts.machine_gate_count).toBe(7);
    expect(machineGates.get('nine-domain-pack-review-templates-created')?.status).toBe('met');
    expect(machineGates.get('domain-pack-review-markdown-created')?.status).toBe('met_as_templates');
    expect(machineGates.get('pass-draft-prepare-templates-created')?.status).toBe('met_as_template_only');
    expect(machineGates.get('formal-patch-not-created')?.current_count).toBe(0);
    expect(machineGates.get('formal-domain-pack-not-written')?.status).toBe('met');
    expect(machineGates.get('province-markdown-not-written')?.status).toBe('met');

    expect(exitGates.get('domain-pack-human-review-templates-created')?.current_count).toBe(9);
    expect(exitGates.get('pass-candidates-isolated-from-formal-patch')?.current_count).toBe(2);
    expect(exitGates.get('repair-reject-tracking-created')?.current_count).toBe(14);
    expect(exitGates.get('formal-domain-pack-still-untouched')?.status).toBe('met');
    expect(exitGates.get('province-markdown-still-untouched')?.status).toBe('met');
  });
});
