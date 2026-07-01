import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { auditProductionMaterials } from './audit-production-materials.js';
import { clearCache } from '../lib/markdown.js';

const previousKbRoot = process.env.KB_ROOT;

afterEach(() => {
  process.env.KB_ROOT = previousKbRoot;
  clearCache();
});

describe('auditProductionMaterials', () => {
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
    expect(report.entries[0].related_location_count).toBe(1);
    expect(report.entries[0].type_template_audits.some(item => item.video_type === 'heritage_promo' && item.recommended)).toBe(true);
    expect(report.markdown).toContain('素材库生产化审计报告');
  });
});
