import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { auditProductionMaterials, hasDialogueToneEvidence } from './audit-production-materials.js';
import { clearCache } from '../lib/markdown.js';

const previousKbRoot = process.env.KB_ROOT;

afterEach(() => {
  process.env.KB_ROOT = previousKbRoot;
  clearCache();
});

describe('auditProductionMaterials', () => {
  it('does not treat a prohibition on invented dialogue as a dialogue-tone specification', () => {
    expect(hasDialogueToneEvidence([], '不得虚构真实人物的逐字对白。')).toBe(false);
    expect(hasDialogueToneEvidence([], '对白/旁白口吻：克制、简短，直接引语须有出处。')).toBe(true);
    expect(hasDialogueToneEvidence([], '对白/旁白口吻（非知识事实）：克制、简短，直接引语须有出处。')).toBe(true);
    expect(hasDialogueToneEvidence(['dialogue_tone'], '')).toBe(true);
  });

  it('audits province markdown entries for production card gaps', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-production-audit-'));
    const provincesDir = path.join(root, 'provinces');
    await fs.mkdir(provincesDir, { recursive: true });
    await fs.writeFile(path.join(provincesDir, '湖南.md'), [
      '# 湖南',
      '',
      '## 已整理条目',
      '',
      '---',
      '',
      '## 测试非遗工艺',
      '',
      '- **省份**：湖南',
      '- **地区**：长沙',
      '- **类型**：非遗',
      '',
      '### 简介',
      '',
      '测试非遗以纸张、颜料和刻刀为核心材料工具。',
      '',
      '### 故事梗概',
      '',
      '匠人经过刻版、刷色、套印、晾晒完成作品。',
      '',
      '### 文化意义',
      '',
      '体现地方手工艺传承。',
      '',
      '### 相关地点',
      '',
      '- 测试工坊：可拍摄制作现场',
      '',
      '### 关键词',
      '',
      '非遗、工艺、刻刀、套印',
      '',
      '### 来源',
      '',
      '- 测试资料（B级）',
      '',
      '### 可信度',
      '',
      '基本可靠',
      '',
      '### 待核实点',
      '',
      '- 传承人姓名待核实',
      '',
      '### 人物',
      '',
      '- 测试传承人：仅补了人物，还不能算完整 asset_split',
      '',
    ].join('\n'), 'utf8');
    process.env.KB_ROOT = root;
    clearCache();

    const report = await auditProductionMaterials();

    expect(report.schema_version).toBe('kb-production-material-audit/v1');
    expect(report.totals.entries).toBe(1);
    expect(report.totals.entries_missing_sources).toBe(0);
    expect(report.totals.entries_missing_related_locations).toBe(0);
    expect(report.totals.missing_verification_method).toBe(1);
    expect(report.totals.entries_with_unverified_points).toBe(1);
    expect(report.totals.entries_with_asset_split).toBe(0);
    expect(report.entries[0].has_asset_split).toBe(false);
    expect(report.entries[0].missing_production_fields).toContain('forbidden_expressions');
    expect(report.entries[0].machine_guidance_fields).toEqual(expect.arrayContaining([
      'dramatization_space',
      'dialogue_tone',
      'forbidden_expressions',
    ]));
    expect(report.entries[0].effective_missing_production_fields)
      .not.toContain('forbidden_expressions');
    expect(report.totals.machine_guidance_field_count).toBeGreaterThanOrEqual(3);
    expect(report.totals.effective_missing_production_field_count)
      .toBeLessThan(report.totals.raw_missing_production_field_count);
    expect(report.entries[0].related_location_count).toBe(1);
    expect(report.entries[0].type_template_audits).toHaveLength(15);
    expect(report.entries[0].type_template_audits.some(item => item.video_type === 'heritage_promo' && item.recommended)).toBe(true);
    expect(report.entries[0].type_template_audits.some(item => item.video_type === 'explainer_video' && item.recommended)).toBe(true);
    expect(report.entries[0].type_template_audits.some(item => item.video_type === 'social_short' && item.recommended)).toBe(true);
    expect(report.entries[0].type_template_audits.some(item => item.video_type === 'education_training' && item.recommended)).toBe(true);
    expect(report.markdown).toContain('素材库生产化审计报告');
  });

  it('recognizes source-authored production sections outside FullEntryDetail', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-production-sections-'));
    const provincesDir = path.join(root, 'provinces');
    await fs.mkdir(provincesDir, { recursive: true });
    await fs.writeFile(path.join(provincesDir, '北京.md'), [
      '# 北京',
      '',
      '## 已整理条目',
      '',
      '---',
      '',
      '## 测试传统技艺',
      '',
      '- **省份**：北京',
      '- **地区**：东城',
      '- **类型**：传统技艺',
      '',
      '### 简介',
      '',
      '测试技艺以刻刀、颜料和纹样为核心。',
      '',
      '### 故事梗概',
      '',
      '匠人按步骤完成作品。',
      '',
      '### 文化意义',
      '',
      '体现地方工艺传承。',
      '',
      '### 相关地点',
      '',
      '- 测试工坊：可拍摄制作现场',
      '',
      '### 关键词',
      '',
      '传统技艺、纹样、刻刀',
      '',
      '### 来源',
      '',
      '- 测试资料（B级）',
      '',
      '### 可信度',
      '',
      '基本可靠',
      '',
      '### 核实方法',
      '',
      '对照项目名录和现场记录。',
      '',
      '### 待核实点',
      '',
      '- 具体工具规格待核实',
      '',
      '### 创作生产字段',
      '',
      '- 对白/旁白口吻：专业、克制，按工序解释，不使用营销断言。',
      '',
      '### 可戏剧化空间',
      '',
      '- 可围绕等待和返工组织情节，但明确属于改编。',
      '',
      '### 禁止断言',
      '',
      '- 不得把单个工坊做法写成全部流派的统一标准。',
      '',
    ].join('\n'), 'utf8');
    process.env.KB_ROOT = root;
    clearCache();

    const report = await auditProductionMaterials();

    expect(report.entries[0].missing_production_fields).not.toContain('dialogue_tone');
    expect(report.entries[0].missing_production_fields).not.toContain('dramatization_space');
    expect(report.entries[0].missing_production_fields).not.toContain('forbidden_expressions');
    expect(report.entries[0].field_audits.find(field => field.field === 'dialogue_tone')?.evidence_origin)
      .toBe('raw_markdown');
    expect(report.entries[0].field_audits.find(field => field.field === 'dramatization_space')?.evidence_origin)
      .toBe('raw_markdown');
    expect(report.entries[0].field_audits.find(field => field.field === 'forbidden_expressions')?.evidence_origin)
      .toBe('raw_markdown');
    expect(report.totals.source_authored_fields_visible_only_in_raw_markdown).toBeGreaterThanOrEqual(3);
    expect(report.entries[0].machine_guidance_fields).not.toEqual(expect.arrayContaining([
      'dialogue_tone',
      'dramatization_space',
      'forbidden_expressions',
    ]));
  });
});
