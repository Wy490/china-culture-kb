import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { addEntry } from '../src/tools/add-entry.js';
import { CultureEntry } from '../src/types.js';

const tmpDir = path.join(os.tmpdir(), 'kb-add-test-' + Date.now());

beforeEach(() => {
  fs.mkdirSync(path.join(tmpDir, 'provinces'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'provinces', '北京.md'), '# 北京\n\n## 待整理条目\n\n## 已整理条目\n\n<!-- 已完成详细填写的条目将在此区域列出 -->\n');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('kb_add_entry', () => {
  it('should add a valid entry to province file', async () => {
    process.env.KB_ROOT = tmpDir;
    const entry: CultureEntry = {
      name: '故宫传说',
      province: '北京',
      region: '北京',
      type: '地方掌故',
      summary: '关于故宫的民间传说。',
      story: '故宫中流传着许多神秘故事...',
      culturalSignificance: '反映了民间对皇家文化的想象。',
      relatedLocations: [{ name: '故宫', description: '传说发生地' }],
      keywords: ['故宫', '传说'],
      sources: ['书籍：故宫故事集'],
      credibility: '基本可靠',
      verificationMethod: '外部核实：故宫博物院官网',
      unverifiedPoints: [],
    };
    const result = await addEntry(entry);
    expect(result.filePath).toContain('北京.md');
    const content = fs.readFileSync(path.join(tmpDir, 'provinces', '北京.md'), 'utf-8');
    expect(content).toContain('## 故宫传说');
  });

  it('should reject entry with missing required fields', async () => {
    process.env.KB_ROOT = tmpDir;
    const entry = { name: '测试', province: '北京' } as any;
    await expect(addEntry(entry)).rejects.toThrow();
  });
});