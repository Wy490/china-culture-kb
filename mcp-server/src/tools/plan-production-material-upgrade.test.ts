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
      '---',
      '',
      '## 测试民间童话',
      '',
      '- **省份**：湖南',
      '- **地区**：湘西',
      '- **类型**：民间故事',
      '',
      '### 简介',
      '',
      '一个地方民间故事，素材尚未标注低龄叙事规则。',
      '',
      '### 故事梗概',
      '',
      '节日夜晚流传一段传说，具体情节仍需整理。',
      '',
      '### 文化意义',
      '',
      '适合改写为低龄叙事，但尚未整理安全边界。',
      '',
      '### 相关地点',
      '',
      '- 测试古桥：民间故事流传地',
      '',
      '### 关键词',
      '',
      '民间故事、低龄叙事',
      '',
      '### 来源',
      '',
      '- 测试地方志（C级）',
      '',
      '### 可信度',
      '',
      '待核实',
      '',
      '### 待核实点',
      '',
      '- 传说来源和流传范围待核实',
      '',
      '---',
      '',
      '## 测试红色掌故',
      '',
      '- **省份**：湖南',
      '- **地区**：长沙',
      '- **类型**：地方掌故',
      '',
      '### 简介',
      '',
      '一个革命旧址相关的地方掌故，适合宣讲但缺主讲人定位。',
      '',
      '### 故事梗概',
      '',
      '围绕一处旧址解释历史选择与群众动员。',
      '',
      '### 文化意义',
      '',
      '适合组织成观点宣讲，需要补论点、案例和来源线索。',
      '',
      '### 相关地点',
      '',
      '- 测试旧址：可做宣讲现场',
      '',
      '### 关键词',
      '',
      '地方掌故、革命、旧址、宣讲',
      '',
      '### 来源',
      '',
      '- 测试馆藏资料（B级）',
      '',
      '### 可信度',
      '',
      '基本可靠',
      '',
      '### 待核实点',
      '',
      '- 具体人物姓名待核实',
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
    expect(plan.batches.find(batch => batch.batch_id === 'heritage_promo_minimum_pack')?.entry_count).toBeGreaterThanOrEqual(1);
    expect(plan.batches.find(batch => batch.batch_id === 'explainer_video_minimum_pack')?.entry_count).toBeGreaterThanOrEqual(1);
    expect(plan.batches.find(batch => batch.batch_id === 'children_story_minimum_pack')?.entry_count).toBeGreaterThanOrEqual(1);
    expect(plan.batches.find(batch => batch.batch_id === 'social_short_minimum_pack')?.entry_count).toBeGreaterThanOrEqual(1);
    expect(plan.batches.find(batch => batch.batch_id === 'lecture_video_minimum_pack')?.entry_count).toBeGreaterThanOrEqual(1);
    expect(plan.batches.find(batch => batch.batch_id === 'education_training_minimum_pack')?.entry_count).toBeGreaterThanOrEqual(1);
    expect(plan.domain_pack_expansion.some(item => item.pack_id === 'heritage_process_pack')).toBe(true);
    expect(plan.domain_pack_expansion.some(item => item.pack_id === 'explainer_knowledge_structure_pack')).toBe(true);
    expect(plan.domain_pack_expansion.some(item => item.pack_id === 'children_adaptation_safety_pack')).toBe(true);
    expect(plan.domain_pack_expansion.some(item => item.pack_id === 'short_video_hook_pack')).toBe(true);
    expect(plan.domain_pack_expansion.some(item => item.pack_id === 'education_training_structure_pack')).toBe(true);
    expect(plan.markdown).toContain('素材库生产化升级计划');
  });
});
