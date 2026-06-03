import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { searchKnowledgeBase } from '../src/tools/search.js';

const tmpDir = path.join(os.tmpdir(), 'kb-search-test-' + Date.now());

beforeEach(() => {
  fs.mkdirSync(path.join(tmpDir, 'provinces'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'provinces', '北京.md'), `# 北京

## 待整理条目

## 已整理条目

---

## 故宫传说

- **省份**：北京
- **地区**：北京
- **类型**：地方掌故

### 简介

关于故宫的民间传说故事。

### 关键词

故宫、传说、紫禁城

---`);

  fs.writeFileSync(path.join(tmpDir, 'provinces', '浙江.md'), `# 浙江

## 待整理条目

## 已整理条目

---

## 白蛇传

- **省份**：浙江
- **地区**：杭州
- **类型**：民间故事

### 简介

白蛇传在杭州的流传版本。

### 关键词

白蛇、许仙、断桥、西湖

---`);

  fs.writeFileSync(path.join(tmpDir, 'provinces', '江苏.md'), '# 江苏\n\n## 待整理条目\n\n## 已整理条目\n');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('kb_search', () => {
  it('should search by keyword across all provinces', async () => {
    process.env.KB_ROOT = tmpDir;
    const results = await searchKnowledgeBase({ keywords: '白蛇' });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.name === '白蛇传')).toBe(true);
  });

  it('should search by keyword within specific province', async () => {
    process.env.KB_ROOT = tmpDir;
    const results = await searchKnowledgeBase({ keywords: '传说', province: '北京' });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('故宫传说');
  });

  it('should search by type', async () => {
    process.env.KB_ROOT = tmpDir;
    const results = await searchKnowledgeBase({ keywords: '', type: '民间故事' });
    expect(results.some(r => r.type === '民间故事')).toBe(true);
  });

  it('should return empty for no match', async () => {
    process.env.KB_ROOT = tmpDir;
    const results = await searchKnowledgeBase({ keywords: '不存在的故事' });
    expect(results.length).toBe(0);
  });
});