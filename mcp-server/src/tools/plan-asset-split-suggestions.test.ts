import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { clearCache } from '../lib/markdown.js';
import { planAssetSplitSuggestions } from './plan-asset-split-suggestions.js';

const previousKbRoot = process.env.KB_ROOT;

afterEach(() => {
  process.env.KB_ROOT = previousKbRoot;
  clearCache();
});

describe('planAssetSplitSuggestions', () => {
  it('creates reviewable asset split suggestions without changing province markdown', async () => {
    const root = await createKbRoot();
    const filePath = path.join(root, 'provinces', '湖南.md');
    process.env.KB_ROOT = root;
    clearCache();
    const before = await fs.readFile(filePath, 'utf8');

    const report = await planAssetSplitSuggestions({ generatedAt: '2026-06-28T00:00:00.000Z' });

    expect(report.schema_version).toBe('kb-asset-split-suggestions/v1');
    expect(report.generated_at).toBe('2026-06-28T00:00:00.000Z');
    expect(report.totals.entries_scanned).toBe(2);
    expect(report.totals.entries_without_asset_split).toBe(2);
    expect(report.totals.entries_with_suggestions).toBe(2);
    expect(report.totals.ready_for_editor_review).toBe(1);
    expect(report.totals.needs_source_or_location_backfill).toBe(1);

    const craft = report.suggestions.find(item => item.entry_name === '测试剪纸');
    expect(craft?.review_status).toBe('ready_for_editor_review');
    expect(craft?.suggested_asset_split.characters.some(item => item.value.includes('传承人'))).toBe(true);
    expect(craft?.suggested_asset_split.scenes.some(item => item.value.includes('测试工坊'))).toBe(true);
    expect(craft?.suggested_asset_split.character_props.some(item => item.value.includes('刻刀'))).toBe(true);
    expect(craft?.suggested_asset_split.character_props.some(item => item.value.includes('颜料'))).toBe(true);

    const legend = report.suggestions.find(item => item.entry_name === '空源掌故');
    expect(legend?.review_status).toBe('needs_source_or_location_backfill');
    expect(legend?.warnings.join('；')).toContain('来源为空');
    expect(legend?.warnings.join('；')).toContain('相关地点为空');
    await expect(fs.readFile(filePath, 'utf8')).resolves.toBe(before);
  });
});

async function createKbRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-asset-split-suggestions-'));
  const provincesDir = path.join(root, 'provinces');
  await fs.mkdir(provincesDir, { recursive: true });
  await fs.writeFile(path.join(provincesDir, '湖南.md'), [
    '# 湖南',
    '',
    '## 已整理条目',
    '',
    '---',
    '',
    '## 测试剪纸',
    '',
    '- **省份**：湖南',
    '- **地区**：长沙',
    '- **类型**：非遗',
    '',
    '### 简介',
    '',
    '测试剪纸以纸张、颜料和刻刀为核心材料工具。',
    '',
    '### 故事梗概',
    '',
    '匠人在工坊里经过起稿、刻制、套色完成作品。',
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
    '非遗、剪纸、刻刀、颜料',
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
    '以测试资料核实。',
    '',
    '### 待核实点',
    '',
    '- 传承人姓名待核实',
    '',
    '### 人物',
    '',
    '- 测试传承人：只补人物，不应被当作完整 asset_split',
    '',
    '---',
    '',
    '## 空源掌故',
    '',
    '- **省份**：湖南',
    '- **地区**：长沙',
    '- **类型**：地方掌故',
    '',
    '### 简介',
    '',
    '一则与古道和石碑有关的地方掌故。',
    '',
    '### 故事梗概',
    '',
    '寻访者沿古道查看石碑和碑文。',
    '',
    '### 文化意义',
    '',
    '可作为地方记忆线索。',
    '',
    '### 相关地点',
    '',
    '### 关键词',
    '',
    '地方掌故、古道、石碑',
    '',
    '### 来源',
    '',
    '### 可信度',
    '',
    '待核实',
    '',
    '### 核实方法',
    '',
    '缺来源，需回溯。',
    '',
    '### 待核实点',
    '',
    '- 地点和来源待核实',
    '',
  ].join('\n'), 'utf8');
  return root;
}
