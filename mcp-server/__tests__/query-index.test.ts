import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { queryIndex } from '../src/tools/query-index.js';

const tmpDir = path.join(os.tmpdir(), 'kb-idx-test-' + Date.now());

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

白蛇传在苏州的流传版本。

### 关键词

白蛇、许仙、断桥

---

## 柳毅传书

- **省份**：江苏
- **地区**：苏州
- **类型**：神话传说

### 简介

柳毅为龙女传书的故事。

### 关键词

柳毅、龙女、传书

---`);

  fs.writeFileSync(path.join(tmpDir, 'provinces', '北京.md'), `# 北京

## 待整理条目

## 已整理条目

---

## 故宫传说

- **省份**：北京
- **地区**：北京
- **类型**：地方掌故

### 简介

关于故宫的民间传说。

### 关键词

故宫、传说、紫禁城

---`);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('kb_query_index', () => {
  it('should query by type across all provinces', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await queryIndex({ query_type: 'by_type', filter: '民间故事' });
    expect(result.queryType).toBe('by_type');
    expect(result.filter).toBe('民间故事');
    expect(result.count).toBe(2);
    expect(result.provincesInvolved).toContain('浙江');
    expect(result.provincesInvolved).toContain('江苏');
  });

  it('should query by keyword exactly', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await queryIndex({ query_type: 'by_keyword', filter: '白蛇' });
    expect(result.count).toBe(2);
  });

  it('should query by region with substring match', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await queryIndex({ query_type: 'by_region', filter: '苏州' });
    expect(result.count).toBe(2);
    expect(result.entries.every(e => e.region.includes('苏州'))).toBe(true);
  });

  it('should limit query to specific province', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await queryIndex({ query_type: 'by_type', filter: '民间故事', province: '浙江' });
    expect(result.count).toBe(1);
    expect(result.entries[0].province).toBe('浙江');
  });

  it('should return empty for no match', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await queryIndex({ query_type: 'by_type', filter: '宗教信仰' });
    expect(result.count).toBe(0);
    expect(result.entries).toEqual([]);
  });

  it('should throw for unsupported query type', async () => {
    process.env.KB_ROOT = tmpDir;
    await expect(queryIndex({ query_type: 'by_author', filter: '某' })).rejects.toThrow('不支持的查询类型');
  });
});