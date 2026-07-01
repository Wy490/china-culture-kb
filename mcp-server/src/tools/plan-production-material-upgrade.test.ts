import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { clearCache } from '../lib/markdown.js';
import { planProductionMaterialUpgrade } from './plan-production-material-upgrade.js';

const previousKbRoot = process.env.KB_ROOT;

afterEach(() => {
  process.env.KB_ROOT = previousKbRoot;
  clearCache();
});

describe('planProductionMaterialUpgrade', () => {
  it('creates actionable upgrade batches from the production audit', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-production-plan-'));
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
      '### 可信度与核实',
      '',
      '基本可靠（测试资料为B级，仍需核实传承人姓名）',
      '',
      '### 待核实点',
      '',
      '- 传承人姓名待核实',
      '',
    ].join('\n'), 'utf8');
    process.env.KB_ROOT = root;
    clearCache();

    const plan = await planProductionMaterialUpgrade();

    expect(plan.schema_version).toBe('kb-production-material-upgrade-plan/v1');
    expect(plan.summary.planned_batches).toBeGreaterThanOrEqual(6);
    expect(plan.batches.map(batch => batch.batch_id)).toContain('credibility_format_normalization');
    expect(plan.batches.map(batch => batch.batch_id)).toContain('source_location_backfill');
    expect(plan.batches.map(batch => batch.batch_id)).toContain('asset_split_enrichment');
    expect(plan.batches.find(batch => batch.batch_id === 'heritage_promo_minimum_pack')?.entry_count).toBe(1);
    expect(plan.domain_pack_expansion.some(item => item.pack_id === 'heritage_process_pack')).toBe(true);
    expect(plan.markdown).toContain('素材库生产化升级计划');
  });
});
