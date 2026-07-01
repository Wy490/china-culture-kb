import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { cleanImportResidue } from './clean-import-residue.js';

const previousKbRoot = process.env.KB_ROOT;

afterEach(() => {
  process.env.KB_ROOT = previousKbRoot;
});

describe('cleanImportResidue', () => {
  it('dry-runs import residue cleanup without changing files', async () => {
    const root = await createKbRoot();
    const filePath = path.join(root, 'provinces', '湖南.md');
    process.env.KB_ROOT = root;
    const before = await fs.readFile(filePath, 'utf8');

    const report = await cleanImportResidue({ generatedAt: '2026-06-28T00:00:00.000Z' });

    expect(report.apply).toBe(false);
    expect(report.totals.entries_changed).toBe(1);
    expect(report.totals.removed_invalid_source_lines).toBe(2);
    expect(report.totals.removed_invalid_location_lines).toBe(2);
    expect(report.changes[0]).toMatchObject({
      entry_name: '测试非遗',
      province: '湖南',
      removed_invalid_source_lines: 2,
      removed_invalid_location_lines: 2,
    });
    await expect(fs.readFile(filePath, 'utf8')).resolves.toBe(before);
  });

  it('applies cleanup by removing only invalid placeholder lines', async () => {
    const root = await createKbRoot();
    const filePath = path.join(root, 'provinces', '湖南.md');
    process.env.KB_ROOT = root;

    const report = await cleanImportResidue({ apply: true, generatedAt: '2026-06-28T00:00:00.000Z' });
    const updated = await fs.readFile(filePath, 'utf8');

    expect(report.totals.entries_changed).toBe(1);
    expect(updated).not.toContain('[object Object]');
    expect(updated).not.toContain('undefined：undefined');
    expect(updated).toContain('- 嘉禾县文化馆：可回访');
    expect(updated).toContain('- 正常来源（B级）');
  });
});

async function createKbRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-import-residue-'));
  const provincesDir = path.join(root, 'provinces');
  await fs.mkdir(provincesDir, { recursive: true });
  await fs.writeFile(path.join(provincesDir, '湖南.md'), [
    '# 湖南',
    '',
    '## 已整理条目',
    '',
    '## 测试非遗',
    '',
    '- **省份**：湖南',
    '- **地区**：郴州',
    '- **类型**：非遗',
    '',
    '### 简介',
    '',
    '测试简介。',
    '',
    '### 相关地点',
    '',
    '- undefined：undefined',
    '- 嘉禾县文化馆：可回访',
    '- undefined：undefined',
    '',
    '### 来源',
    '',
    '- [object Object]',
    '- 正常来源（B级）',
    '- [object Object]',
    '',
    '### 可信度',
    '',
    '基本可靠',
    '',
    '### 核实方法',
    '',
    '以正常来源核实。',
    '',
    '### 待核实点',
    '',
    '- 待核实事项',
    '',
  ].join('\n'), 'utf8');
  return root;
}
