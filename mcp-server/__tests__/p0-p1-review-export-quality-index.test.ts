import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..', '..');
const qualityIndexPath = path.join(repoRoot, 'data', 'production-cards', 'p0-p1-review-export-quality-index.json');
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

describe('P0/P1 review export quality index', () => {
  it('adds checklist coverage for every exported Markdown review file', () => {
    const quality = readJson(qualityIndexPath);
    const pkg = readJson(exportPackagePath);
    const checklistByTemplateId = new Map(
      (quality.markdown_review_checklists as JsonRecord[]).map(item => [item.writeback_template_id, item])
    );

    expect(quality.schema_version).toBe('p0-p1-review-export-quality-index/v1');
    expect(quality.writeback_policy.direct_writeback_to_province_markdown).toBe(false);
    expect(quality.writeback_policy.province_markdown_written).toBe(false);
    expect(quality.writeback_policy.quality_index_is_formal_writeback).toBe(false);
    expect(quality.counts.markdown_checklist_count).toBe(16);
    expect(quality.markdown_review_checklists).toHaveLength(16);

    for (const exported of pkg.markdown_exports as JsonRecord[]) {
      const checklist = checklistByTemplateId.get(exported.writeback_template_id);
      const markdownPath = path.join(repoRoot, exported.path);
      const markdown = fs.readFileSync(markdownPath, 'utf-8');

      expect(checklist, exported.writeback_template_id).toBeTruthy();
      expect(checklist!.card_id).toBe(exported.card_id);
      expect(checklist!.path).toBe(exported.path);
      expect(checklist!.checklist_status).toBe('pending_human_review');
      expect(checklist!.checklist_item_ids).toContain('source-bibliography-filled');
      expect(checklist!.checklist_item_ids).toContain('fact-boundary-table-reviewed');
      expect(checklist!.checklist_item_ids).toContain('authorization-consent-confirmed');
      expect(checklist!.checklist_item_ids).toContain('writeback-scope-limited');
      expect(checklist!.checklist_item_ids).toContain('generated-material-excluded');
      expect(markdown).toContain('## 审稿核对清单');
      expect(markdown).toContain('来源目录已补齐：[待人工审稿]');
      expect(markdown).toContain('事实边界表已复核：[待人工审稿]');
      expect(markdown).toContain('授权或同意已确认：[待人工审稿]');
      expect(markdown).toContain('写回范围仅限可复用字段：[待人工审稿]');

      if (checklist!.risk_tier === 'p0') {
        expect(checklist!.checklist_item_ids).toContain('p0-special-rule-pass');
        expect(markdown).toContain('P0 专项安全检查：[待人工审稿]');
      } else {
        expect(checklist!.checklist_item_ids).not.toContain('p0-special-rule-pass');
        expect(markdown).not.toContain('P0 专项安全检查：[待人工审稿]');
      }
    }
  });

  it('builds review batches that cover all 16 exports exactly once', () => {
    const quality = readJson(qualityIndexPath);
    const pkg = readJson(exportPackagePath);
    const expectedTemplateIds = new Set(
      (pkg.markdown_exports as JsonRecord[]).map(item => item.writeback_template_id)
    );
    const batchedTemplateIds = (quality.review_batches as JsonRecord[]).flatMap(
      batch => batch.writeback_template_ids as string[]
    );

    expect(quality.counts.review_batch_count).toBe(4);
    expect(quality.review_batches).toHaveLength(4);
    expect(new Set(batchedTemplateIds)).toEqual(expectedTemplateIds);
    expect(batchedTemplateIds).toHaveLength(expectedTemplateIds.size);

    for (const batch of quality.review_batches as JsonRecord[]) {
      expect(batch.status).toBe('pending_human_review');
      expect(batch.review_focus.length).toBeGreaterThanOrEqual(3);
      expect(batch.completion_gates).toContain('no_direct_writeback_to_province_markdown');
      expect(batch.card_ids).toHaveLength(batch.writeback_template_ids.length);
    }
  });

  it('extends P0 quality rules with richer triggers and repair suggestions', () => {
    const quality = readJson(qualityIndexPath);
    const evidence = readJson(evidenceDraftsPath);
    const sampleById = new Map(
      (evidence.p0_special_check_samples as JsonRecord[]).map(sample => [sample.sample_id, sample])
    );
    const ruleById = new Map((quality.p0_extended_quality_rules as JsonRecord[]).map(rule => [rule.rule_id, rule]));
    const allRejectPatterns = (quality.p0_extended_quality_rules as JsonRecord[]).flatMap(
      rule => rule.reject_patterns as string[]
    );

    expect(quality.counts.p0_extended_quality_rule_count).toBe(4);
    expect(quality.counts.p0_repair_suggestion_count).toBe(14);
    expect(quality.p0_extended_quality_rules).toHaveLength(4);
    expect(allRejectPatterns).toContain('惨烈镜头');
    expect(allRejectPatterns).toContain('受害者临终独白');
    expect(allRejectPatterns).toContain('包治');
    expect(allRejectPatterns).toContain('患者信息');

    for (const rule of quality.p0_extended_quality_rules as JsonRecord[]) {
      expect(rule.reject_patterns.length).toBeGreaterThanOrEqual(6);
      expect(rule.repair_suggestions.length).toBeGreaterThanOrEqual(3);
      expect(rule.extends_rule_id).toBeTruthy();
    }

    for (const expectation of quality.p0_quality_sample_expectations as JsonRecord[]) {
      const sample = sampleById.get(expectation.sample_id);
      const rule = ruleById.get(expectation.rule_id);

      expect(sample, expectation.sample_id).toBeTruthy();
      expect(rule, expectation.rule_id).toBeTruthy();
      expect(decideByRule(sample!.sample_text, rule!)).toBe(expectation.expected_decision);
    }
  });

  it('links checklist entries back to evidence templates without granting writeback', () => {
    const quality = readJson(qualityIndexPath);
    const evidence = readJson(evidenceDraftsPath);
    const evidenceIds = new Set(
      (evidence.source_evidence_package_templates as JsonRecord[]).map(item => item.evidence_package_id)
    );
    const reviewItemIds = new Set(
      (evidence.source_evidence_package_templates as JsonRecord[]).map(item => item.review_item_id)
    );
    const gates = new Map((quality.iteration_11_exit_gates as JsonRecord[]).map(gate => [gate.gate_id, gate]));

    for (const checklist of quality.markdown_review_checklists as JsonRecord[]) {
      expect(evidenceIds.has(checklist.evidence_package_id), checklist.evidence_package_id).toBe(true);
      expect(reviewItemIds.has(checklist.review_item_id), checklist.review_item_id).toBe(true);
    }

    expect(gates.get('markdown-checklists-created')?.status).toBe('met_as_review_checklists');
    expect(gates.get('p0-quality-rules-expanded')?.status).toBe('met');
    expect(gates.get('review-batch-index-created')?.status).toBe('met');
    expect(gates.get('no-direct-province-writeback')?.status).toBe('met');
    expect(quality.writeback_policy.province_markdown_written).toBe(false);
  });
});
