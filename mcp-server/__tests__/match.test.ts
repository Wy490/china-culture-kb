import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { matchEntries } from '../src/tools/match.js';

const tmpDir = path.join(os.tmpdir(), 'kb-match-test-' + Date.now());

beforeEach(() => {
  fs.mkdirSync(path.join(tmpDir, 'provinces'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'provinces', '浙江.md'), `# 浙江

## 待整理条目

## 已整理条目

---

## 白蛇传

- **省份**：浙江
- **地区**：杭州
- **类型**：民间故事

### 简介

白蛇传在杭州的流传版本，讲述白娘子与许仙的爱情故事。

### 关键词

白蛇、许仙、断桥、西湖

---`);

  fs.writeFileSync(path.join(tmpDir, 'provinces', '江苏.md'), '# 江苏\n\n## 待整理条目\n\n## 已整理条目\n');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('kb_match', () => {
  it('should return entries from priority provinces', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await matchEntries({
      storyText: '白蛇的故事',
      provinceHints: ['浙江'],
    });
    expect(result.entries.length).toBeGreaterThanOrEqual(1);
    expect(result.entries.some(e => e.name === '白蛇传')).toBe(true);
    expect(result.provinceHints).toContain('浙江');
  });

  it('should return total entries count', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await matchEntries({
      storyText: '故事',
      provinceHints: [],
    });
    expect(result.totalEntriesRead).toBeGreaterThanOrEqual(1);
  });
});