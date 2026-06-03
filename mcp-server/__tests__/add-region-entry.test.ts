import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { extractRegionPrefix, writeEntryToRegionGroup } from '../src/lib/markdown.js';
import { addRegionEntry } from '../src/tools/add-region-entry.js';
import { CultureEntry } from '../src/types.js';

const tmpDir = path.join(os.tmpdir(), 'kb-region-test-' + Date.now());

beforeEach(() => {
  fs.mkdirSync(path.join(tmpDir, 'provinces'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'provinces', '湖南.md'), `# 湖南

## 待整理条目

## 已整理条目

<!-- 已完成详细填写的条目将在此区域列出 -->

### 岳阳

---

## 屈原投江汨罗

- **省份**：湖南
- **地区**：岳阳汨罗
- **类型**：神话传说

### 简介

屈原投汨罗江的故事。

### 关键词

屈原、端午、汨罗

---
`);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('extractRegionPrefix', () => {
  it('should extract 2-char prefix from 4-char region', () => {
    expect(extractRegionPrefix('岳阳汨罗')).toBe('岳阳');
  });

  it('should keep 2-char region as-is', () => {
    expect(extractRegionPrefix('湘西')).toBe('湘西');
  });

  it('should keep 3-char region as-is', () => {
    expect(extractRegionPrefix('张家界')).toBe('张家界');
  });

  it('should return null for empty region', () => {
    expect(extractRegionPrefix('')).toBeNull();
    expect(extractRegionPrefix('  ')).toBeNull();
  });

  it('should extract 2-char prefix from >3 char region', () => {
    expect(extractRegionPrefix('呼和浩特新城区')).toBe('呼和');
  });
});

describe('writeEntryToRegionGroup', () => {
  it('should append to existing region group', async () => {
    process.env.KB_ROOT = tmpDir;
    const entry: CultureEntry = {
      name: '洞庭湖传说',
      province: '湖南',
      region: '岳阳',
      type: '民间故事',
      summary: '洞庭湖的传说故事。',
      story: '详细故事...',
      culturalSignificance: '反映了湖区文化。',
      relatedLocations: [{ name: '洞庭湖', description: '传说发生地' }],
      keywords: ['洞庭湖', '传说'],
      sources: ['口述资料'],
      credibility: '待核实',
      unverifiedPoints: [],
    };
    const result = await writeEntryToRegionGroup(entry, '湖南');
    expect(result.regionPrefix).toBe('岳阳');
    expect(result.grouped).toBe(true);

    const content = fs.readFileSync(path.join(tmpDir, 'provinces', '湖南.md'), 'utf-8');
    expect(content).toContain('## 洞庭湖传说');
    const yueyangIndex = content.indexOf('### 岳阳');
    const newEntryIndex = content.indexOf('## 洞庭湖传说');
    expect(newEntryIndex).toBeGreaterThan(yueyangIndex);
  });

  it('should create new region group when none exists', async () => {
    process.env.KB_ROOT = tmpDir;
    const entry: CultureEntry = {
      name: '炎帝神农氏',
      province: '湖南',
      region: '株洲炎陵',
      type: '神话传说',
      summary: '炎帝神农氏的故事。',
      story: '炎帝在株洲的传说...',
      culturalSignificance: '中华文明始祖之一。',
      relatedLocations: [{ name: '炎帝陵', description: '炎帝陵墓所在地' }],
      keywords: ['炎帝', '神农'],
      sources: ['书籍：炎帝传说'],
      credibility: '基本可靠',
      unverifiedPoints: [],
    };
    const result = await writeEntryToRegionGroup(entry, '湖南');
    expect(result.regionPrefix).toBe('株洲');
    expect(result.grouped).toBe(true);

    const content = fs.readFileSync(path.join(tmpDir, 'provinces', '湖南.md'), 'utf-8');
    expect(content).toContain('### 株洲');
    expect(content).toContain('## 炎帝神农氏');
  });

  it('should fallback to flat insertion when region is empty', async () => {
    process.env.KB_ROOT = tmpDir;
    const entry: CultureEntry = {
      name: '湖南总传说',
      province: '湖南',
      region: '',
      type: '地方掌故',
      summary: '湖南地区通用传说。',
      story: '故事...',
      culturalSignificance: '湖南文化。',
      relatedLocations: [],
      keywords: ['湖南'],
      sources: [],
      credibility: '待核实',
      unverifiedPoints: [],
    };
    const result = await writeEntryToRegionGroup(entry, '湖南');
    expect(result.regionPrefix).toBeNull();
    expect(result.grouped).toBe(false);
  });
});

describe('kb_add_region_entry', () => {
  it('should add entry with region grouping', async () => {
    process.env.KB_ROOT = tmpDir;
    const entry: CultureEntry = {
      name: '洞庭湖传说',
      province: '湖南',
      region: '岳阳',
      type: '民间故事',
      summary: '洞庭湖的传说。',
      story: '故事内容...',
      culturalSignificance: '湖区文化。',
      relatedLocations: [{ name: '洞庭湖', description: '传说发生地' }],
      keywords: ['洞庭湖'],
      sources: ['口述'],
      credibility: '待核实',
      unverifiedPoints: [],
    };
    const result = await addRegionEntry(entry);
    expect(result.province).toBe('湖南');
    expect(result.regionPrefix).toBe('岳阳');
    expect(result.grouped).toBe(true);
    expect(result.entryName).toBe('洞庭湖传说');
  });

  it('should reject entry with missing fields', async () => {
    process.env.KB_ROOT = tmpDir;
    const entry = { name: '测试' } as any;
    await expect(addRegionEntry(entry)).rejects.toThrow('缺少必填字段');
  });

  it('should reject invalid province', async () => {
    process.env.KB_ROOT = tmpDir;
    const entry: CultureEntry = {
      name: '测试', province: '不存在的省', region: '某地', type: '神话传说',
      summary: '测试', story: '测试', culturalSignificance: '测试',
      relatedLocations: [], keywords: [], sources: [], credibility: '待核实',
      unverifiedPoints: [],
    };
    await expect(addRegionEntry(entry)).rejects.toThrow('无效省份');
  });
});