import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { supplement } from '../src/tools/supplement.js';

const tmpDir = path.join(os.tmpdir(), 'kb-sup-test-' + Date.now());

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

白蛇传在杭州的流传版本。

### 关键词

白蛇、许仙、断桥、西湖

---`);

  fs.writeFileSync(path.join(tmpDir, 'provinces', '江苏.md'), `# 江苏

## 待整理条目

## 已整理条目

---

## 白蛇传

- **省份**：江苏
- **地区**：苏州
- **类型**：民间故事

### 简介

白蛇传在苏州的流传版本，与杭州版有所不同。

### 关键词

白蛇、许仙、断桥

---

## 柳毅传书

- **省份**：江苏
- **地区**：苏州
- **类型**：民间故事

### 简介

柳毅为龙女传书的爱情传说。

### 关键词

柳毅、龙女、传书

---`);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('kb_supplement', () => {
  it('should find version differences across provinces', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await supplement({
      entryName: '白蛇传',
      province: '浙江',
      keywords: ['白蛇', '许仙'],
      type: '民间故事',
    });
    expect(result.versionDifferences.length).toBeGreaterThanOrEqual(1);
    expect(result.versionDifferences.some(e => e.province === '江苏')).toBe(true);
  });

  it('should find same region type entries', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await supplement({
      entryName: '白蛇传',
      province: '江苏',
      keywords: ['白蛇'],
      type: '民间故事',
    });
    expect(result.sameRegionType.length).toBeGreaterThanOrEqual(1);
    expect(result.sameRegionType.some(e => e.name === '柳毅传书')).toBe(true);
  });

  it('should find related network entries', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await supplement({
      entryName: '白蛇传',
      province: '浙江',
      keywords: ['龙女', '传书'],
      type: '民间故事',
    });
    // 关键词"龙女"、"传书"能匹配柳毅传书（不在浙江，也不叫白蛇传）
    expect(result.relatedNetwork.length).toBeGreaterThanOrEqual(1);
  });
});