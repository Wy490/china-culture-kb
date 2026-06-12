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

  fs.writeFileSync(path.join(tmpDir, 'provinces', '湖南.md'), `# 湖南

## 待整理条目

## 已整理条目

---

## 周敦颐

- **省份**：湖南
- **地区**：永州道县
- **类型**：历史人物

### 简介

周敦颐为北宋理学开山人物，湖湘文化常以其思想、清廉人格和《爱莲说》作为精神资源。

### 关键词

周敦颐、濂溪、理学、爱莲说、思想、湖湘文化

### 故事梗概

周敦颐在湖南相关叙事中常与永州、道县等地相连。

### 文化意义

其理学思想经由书院教育和湖湘学脉传播，对长沙的岳麓书院文化阐释具有思想资源意义。

### 相关地点

- 岳麓书院：长沙重要书院，可作为理学传播与湖湘学脉的地方化讲述场景。

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

  it('should rank localized focus by target region and cultural influence', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await supplement({
      entryName: '周敦颐',
      province: '湖南',
      region: '长沙',
      keywords: ['周敦颐', '理学', '思想', '岳麓书院'],
      type: '历史人物',
    });

    expect(result.localizedFocus.length).toBeGreaterThanOrEqual(1);
    expect(result.localizedFocus[0].entry.name).toBe('周敦颐');
    expect(result.localizedFocus[0].relation_type).toMatch(/related_location|cultural_influence/);
    expect(result.localizedFocus[0].evidence.join('；')).toContain('长沙');
    expect(result.supplementStrategy.join('；')).toContain('直接事件不足');
  });
});
