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

  it('should score matched entries with local relation evidence', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await matchEntries({
      storyText: '我要做周敦颐在长沙产生的思想文化影响，重点讲岳麓书院和理学传播。',
      provinceHints: ['湖南'],
      typeHint: '历史人物',
      regionHint: '长沙',
    });

    expect(result.matchedEntries.length).toBeGreaterThanOrEqual(1);
    expect(result.matchedEntries[0].name).toBe('周敦颐');
    expect(result.matchedEntries[0].usable_for_story).toBe(true);
    expect(result.matchedEntries[0].evidence.join('；')).toContain('长沙');
    expect(result.matchedEntries[0].match_reason).toContain('综合分');
  });
});
