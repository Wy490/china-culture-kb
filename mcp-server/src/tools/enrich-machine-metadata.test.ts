import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { enrichMachineMetadata } from './enrich-machine-metadata.js';

const previousKbRoot = process.env.KB_ROOT;

afterEach(() => {
  process.env.KB_ROOT = previousKbRoot;
});

describe('enrichMachineMetadata', () => {
  it('dry-runs machine metadata suggestions without changing province markdown', async () => {
    const root = await createKbRoot({
      province: '湖南',
      content: provinceFile([
        entry({
          name: '测试非遗',
          type: '非遗',
          summary: '这是一项明清以来的地方工艺。',
        }),
      ]),
    });

    const filePath = path.join(root, 'provinces', '湖南.md');
    process.env.KB_ROOT = root;
    const before = await fs.readFile(filePath, 'utf8');
    const report = await enrichMachineMetadata({ generatedAt: '2026-06-27T00:00:00.000Z' });

    expect(report.apply).toBe(false);
    expect(report.totals.entries_changed).toBe(1);
    expect(report.totals.fields_added).toBe(4);
    expect(report.changes[0]).toMatchObject({
      entry_name: '测试非遗',
      province: '湖南',
      type: '非遗',
      added_fields: ['knowledge_domain', 'entry_role', 'era', 'asset_usage'],
    });
    await expect(fs.readFile(filePath, 'utf8')).resolves.toBe(before);
    expect(report.markdown).toContain('机器字段补齐报告');
  });

  it('applies conservative metadata and does not overwrite existing fields', async () => {
    const root = await createKbRoot({
      province: '北京',
      content: provinceFile([
        entry({
          name: '故宫传说',
          type: '地方掌故',
          summary: '明清宫城相关传说。',
          headerLines: ['- **era**：明清'],
        }),
      ]),
    });

    process.env.KB_ROOT = root;
    const report = await enrichMachineMetadata({ apply: true, generatedAt: '2026-06-27T00:00:00.000Z' });
    const updated = await fs.readFile(path.join(root, 'provinces', '北京.md'), 'utf8');

    expect(report.totals.entries_changed).toBe(1);
    expect(report.totals.fields_added).toBe(3);
    expect(updated).toContain('- **类型**：地方掌故\n- **era**：明清\n- **knowledge_domain**：regional_culture\n- **entry_role**：core_entry');
    expect(updated).toContain('- **asset_usage**：scene_space、story_motif、conflict_engine、credibility_boundary、source_grounding');
    expect(updated.match(/- \*\*era\*\*：/g)?.length).toBe(1);
  });

  it('classifies revolutionary sites as core culture even when the type is scenic heritage', async () => {
    const root = await createKbRoot({
      province: '江西',
      content: provinceFile([
        entry({
          name: '井冈山',
          type: '名胜古迹',
          summary: '井冈山是中国革命的重要根据地。',
        }),
      ]),
    });

    process.env.KB_ROOT = root;
    const report = await enrichMachineMetadata({ generatedAt: '2026-06-27T00:00:00.000Z' });

    expect(report.changes[0].suggestion.knowledge_domain).toBe('core_china_culture');
    expect(report.changes[0].suggestion.era).toBe('新民主主义革命时期');
  });
});

async function createKbRoot(input: { province: string; content: string }): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-machine-metadata-'));
  const provincesDir = path.join(root, 'provinces');
  await fs.mkdir(provincesDir, { recursive: true });
  await fs.writeFile(path.join(provincesDir, `${input.province}.md`), input.content, 'utf8');
  return root;
}

function provinceFile(entries: string[]): string {
  return [
    '# 测试省份',
    '',
    '## 已整理条目',
    '',
    entries.join('\n---\n\n'),
    '',
  ].join('\n');
}

function entry(input: { name: string; type: string; summary: string; headerLines?: string[] }): string {
  return [
    `## ${input.name}`,
    '',
    '- **省份**：测试省份',
    '- **地区**：测试地区',
    `- **类型**：${input.type}`,
    ...(input.headerLines ?? []),
    '',
    '### 简介',
    '',
    input.summary,
    '',
    '### 来源',
    '',
    '- 测试来源（B级）',
    '',
    '### 可信度',
    '',
    '基本可靠',
    '',
    '### 核实方法',
    '',
    '以测试来源核实。',
    '',
    '### 待核实点',
    '',
    '- 待核实事项',
  ].join('\n');
}
