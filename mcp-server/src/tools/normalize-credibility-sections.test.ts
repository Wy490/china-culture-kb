import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { normalizeCredibilitySections } from './normalize-credibility-sections.js';

const previousKbRoot = process.env.KB_ROOT;

afterEach(() => {
  process.env.KB_ROOT = previousKbRoot;
});

describe('normalizeCredibilitySections', () => {
  it('dry-runs merged credibility sections without changing province markdown', async () => {
    const root = await createKbRoot({
      province: '贵州',
      content: provinceFile([
        entry({
          name: '遵义会议',
          mergedCredibility: '基本可靠（A级党史+B级纪念馆交叉佐证）',
        }),
      ]),
    });

    const filePath = path.join(root, 'provinces', '贵州.md');
    process.env.KB_ROOT = root;
    const before = await fs.readFile(filePath, 'utf8');

    const report = await normalizeCredibilitySections({ generatedAt: '2026-06-27T00:00:00.000Z' });

    expect(report.apply).toBe(false);
    expect(report.totals.entries_changed).toBe(1);
    expect(report.totals.created_verification_sections).toBe(1);
    expect(report.changes[0]).toMatchObject({
      entry_name: '遵义会议',
      province: '贵州',
      credibility: '基本可靠',
      verification_action: 'created',
    });
    await expect(fs.readFile(filePath, 'utf8')).resolves.toBe(before);
    expect(report.markdown).toContain('执行模式：dry-run');
  });

  it('applies split credibility and verification sections', async () => {
    const root = await createKbRoot({
      province: '贵州',
      content: provinceFile([
        entry({
          name: '四渡赤水',
          mergedCredibility: '可靠（A级文献佐证）',
        }),
      ]),
    });

    process.env.KB_ROOT = root;
    const report = await normalizeCredibilitySections({ apply: true, generatedAt: '2026-06-27T00:00:00.000Z' });
    const updated = await fs.readFile(path.join(root, 'provinces', '贵州.md'), 'utf8');

    expect(report.totals.entries_changed).toBe(1);
    expect(updated).toContain('### 可信度\n\n可靠\n\n### 核实方法\n\n可靠（A级文献佐证）');
    expect(updated).not.toContain('### 可信度与核实');
  });

  it('merges old credibility explanation into an existing verification section', async () => {
    const root = await createKbRoot({
      province: '湖南',
      content: provinceFile([
        entry({
          name: '周敦颐传说',
          mergedCredibility: '混合——正史部分基本可靠，地方传说需标注为后世建构',
          verificationMethod: '以《宋史》和地方志交叉核对。',
        }),
      ]),
    });

    process.env.KB_ROOT = root;
    const report = await normalizeCredibilitySections({ apply: true, generatedAt: '2026-06-27T00:00:00.000Z' });
    const updated = await fs.readFile(path.join(root, 'provinces', '湖南.md'), 'utf8');

    expect(report.totals.entries_changed).toBe(1);
    expect(report.totals.merged_into_existing_verification_sections).toBe(1);
    expect(updated).toContain('### 可信度\n\n混合');
    expect(updated).toContain('### 核实方法\n\n可信度说明：混合——正史部分基本可靠，地方传说需标注为后世建构\n\n以《宋史》和地方志交叉核对。');
    expect(updated).toContain('以《宋史》和地方志交叉核对。\n\n### 待核实点');
    expect(updated).not.toContain('### 可信度与核实');
  });

  it('moves long explicit credibility explanations into verification method', async () => {
    const root = await createKbRoot({
      province: '湖南',
      content: provinceFile([
        entry({
          name: '岳阳楼',
          credibility: '基本可靠（古建筑可实地参观，诗文原文传世）',
          verificationMethod: '以景区资料和原文互证。',
        }),
      ]),
    });

    process.env.KB_ROOT = root;
    const report = await normalizeCredibilitySections({ apply: true, generatedAt: '2026-06-27T00:00:00.000Z' });
    const updated = await fs.readFile(path.join(root, 'provinces', '湖南.md'), 'utf8');

    expect(report.totals.entries_changed).toBe(1);
    expect(report.totals.merged_into_existing_verification_sections).toBe(1);
    expect(updated).toContain('### 可信度\n\n基本可靠\n\n### 核实方法');
    expect(updated).toContain('可信度说明：基本可靠（古建筑可实地参观，诗文原文传世）\n\n以景区资料和原文互证。');
  });
});

async function createKbRoot(input: { province: string; content: string }): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-credibility-normalize-'));
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

function entry(input: { name: string; mergedCredibility?: string; credibility?: string; verificationMethod?: string }): string {
  return [
    `## ${input.name}`,
    '',
    '- **省份**：测试省份',
    '- **地区**：测试地区',
    '- **类型**：地方掌故',
    '',
    '### 简介',
    '',
    '测试简介。',
    '',
    '### 来源',
    '',
    '- 测试来源（B级）',
    '',
    input.mergedCredibility ? '### 可信度与核实' : '### 可信度',
    '',
    input.mergedCredibility ?? input.credibility ?? '基本可靠',
    '',
    ...(input.verificationMethod
      ? [
          '### 核实方法',
          '',
          input.verificationMethod,
          '',
        ]
      : []),
    '### 待核实点',
    '',
    '- 待核实事项',
  ].join('\n');
}
