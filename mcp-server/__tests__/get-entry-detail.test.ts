import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getEntryDetail } from '../src/tools/get-entry-detail.js';

const tmpDir = path.join(os.tmpdir(), 'kb-detail-test-' + Date.now());

beforeEach(() => {
  fs.mkdirSync(path.join(tmpDir, 'provinces'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'provinces', '北京.md'), `# 北京

## 来源索引

## 待整理条目

## 已整理条目

---

## 故宫传说

- **省份**：北京
- **地区**：北京→东城
- **类型**：名胜古迹

### 简介

故宫的民间传说故事。

### 故事梗概

故宫中流传着许多神秘故事，包括九龙壁传说和角楼设计传说。

### 文化意义

故宫传说反映了民间对皇家文化的想象。

### 相关地点

- 故宫：传说发生地

### 关键词

故宫、传说、九龙壁

### 来源

- 故宫博物院官网（B级）

### 可信度与核实

基本可靠（B级官方资料交叉佐证）

### 待核实点

- 九龙壁传说为民间口述`);

  fs.writeFileSync(path.join(tmpDir, 'provinces', '浙江.md'), '# 浙江\n\n## 待整理条目\n\n## 已整理条目\n');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('kb_get_entry_detail', () => {
  it('should return full entry detail with all sections', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await getEntryDetail('故宫传说');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('故宫传说');
    expect(result!.province).toBe('北京');
    expect(result!.region).toBe('北京→东城');
    expect(result!.type).toBe('名胜古迹');
    expect(result!.story).toContain('九龙壁传说');
    expect(result!.culturalSignificance).toContain('民间对皇家文化的想象');
    expect(result!.sources).toContain('故宫博物院官网（B级）');
    expect(result!.unverifiedPoints.length).toBe(1);
    expect(result!.credibility).toBe('基本可靠');
  });

  it('should return null for nonexistent entry', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await getEntryDetail('不存在的故事');
    expect(result).toBeNull();
  });
});