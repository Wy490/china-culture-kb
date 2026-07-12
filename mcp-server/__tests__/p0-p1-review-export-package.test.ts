import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const exportPackagePath = path.join(repoRoot, 'data', 'production-cards', 'p0-p1-review-export-package.json');
const evidenceDraftsPath = path.join(repoRoot, 'data', 'production-cards', 'p0-p1-source-evidence-and-writeback-drafts.json');

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord;
}

function decideByRule(sampleText: string, rule: JsonRecord): string {
  const rejected = (rule.reject_patterns as string[]).some(pattern => sampleText.includes(pattern));
  if (rejected) return 'reject';

  const allowed = (rule.allow_requires_any as string[]).some(pattern => sampleText.includes(pattern));
  return allowed ? 'allow_for_human_review' : 'needs_manual_review';
}

describe('P0/P1 review export package', () => {
  it('creates source and authorization placeholders for all 16 evidence packages', () => {
    const pkg = readJson(exportPackagePath);
    const evidence = readJson(evidenceDraftsPath);
    const evidenceIds = new Set(
      (evidence.source_evidence_package_templates as JsonRecord[]).map(item => item.evidence_package_id)
    );

    expect(pkg.schema_version).toBe('p0-p1-review-export-package/v1');
    expect(pkg.writeback_policy.direct_writeback_to_province_markdown).toBe(false);
    expect(pkg.writeback_policy.province_markdown_written).toBe(false);
    expect(pkg.writeback_policy.exported_markdown_is_formal_writeback).toBe(false);
    expect(pkg.counts.source_placeholder_set_count).toBe(16);
    expect(pkg.counts.authorization_placeholder_set_count).toBe(16);
    expect(pkg.source_placeholder_sets).toHaveLength(16);

    for (const placeholder of pkg.source_placeholder_sets as JsonRecord[]) {
      expect(evidenceIds.has(placeholder.evidence_package_id), placeholder.evidence_package_id).toBe(true);
      expect(placeholder.source_placeholders.length).toBeGreaterThanOrEqual(3);
      expect(placeholder.authorization_placeholders.length).toBeGreaterThanOrEqual(3);
      expect(['p0', 'p1']).toContain(placeholder.risk_tier);
    }
  });

  it('exports 16 Markdown review files that match the manifest', () => {
    const pkg = readJson(exportPackagePath);
    const evidence = readJson(evidenceDraftsPath);
    const templateIds = new Set(
      (evidence.writeback_markdown_templates as JsonRecord[]).map(item => item.writeback_template_id)
    );

    expect(pkg.counts.markdown_export_count).toBe(16);
    expect(pkg.markdown_exports).toHaveLength(16);

    for (const exported of pkg.markdown_exports as JsonRecord[]) {
      const markdownPath = path.join(repoRoot, exported.path);
      const markdown = fs.readFileSync(markdownPath, 'utf-8');

      expect(templateIds.has(exported.writeback_template_id), exported.writeback_template_id).toBe(true);
      expect(markdown).toContain('状态：template_pending_human_review');
      expect(markdown).toContain(`card_id: ${exported.card_id}`);
      expect(markdown).toContain('## 来源占位');
      expect(markdown).toContain('## 授权占位');
      expect(markdown).toContain('## 可写回候选字段');
      expect(markdown).toContain('province_markdown_written: false');
      expect(markdown).not.toContain('generated_full_text');
      expect(markdown).not.toContain('scene_breakdown');
      expect(markdown).not.toContain('gears_segments');
      expect(markdown).not.toContain('seedance_prompt');
    }
  });

  it('applies P0 quality rules to the four special check samples', () => {
    const pkg = readJson(exportPackagePath);
    const evidence = readJson(evidenceDraftsPath);
    const sampleById = new Map(
      (evidence.p0_special_check_samples as JsonRecord[]).map(sample => [sample.sample_id, sample])
    );
    const ruleById = new Map((pkg.p0_quality_rules as JsonRecord[]).map(rule => [rule.rule_id, rule]));

    expect(pkg.counts.p0_quality_rule_count).toBe(2);
    expect(pkg.counts.p0_quality_sample_expectation_count).toBe(4);
    expect(pkg.p0_quality_rules).toHaveLength(2);
    expect(pkg.p0_quality_sample_expectations).toHaveLength(4);

    for (const expectation of pkg.p0_quality_sample_expectations as JsonRecord[]) {
      const sample = sampleById.get(expectation.sample_id);
      const rule = ruleById.get(expectation.rule_id);

      expect(sample, expectation.sample_id).toBeTruthy();
      expect(rule, expectation.rule_id).toBeTruthy();
      expect(rule!.linked_sample_ids).toContain(expectation.sample_id);
      expect(decideByRule(sample!.sample_text, rule!)).toBe(expectation.expected_decision);
    }
  });

  it('tracks Iteration 10 gates without marking exports as formal writeback', () => {
    const pkg = readJson(exportPackagePath);
    const gates = new Map((pkg.iteration_10_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    expect(gates.get('source-and-authorization-placeholders-created')?.status).toBe('met');
    expect(gates.get('review-markdown-files-exported')?.status).toBe('met_as_review_exports');
    expect(gates.get('p0-quality-rules-created')?.status).toBe('met');
    expect(gates.get('no-direct-province-writeback')?.status).toBe('met');
    expect(pkg.writeback_policy.exported_markdown_is_formal_writeback).toBe(false);
  });
});
