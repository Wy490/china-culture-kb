import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { collect } from '../src/tools/collect.js';

const tmpDir = path.join(os.tmpdir(), 'kb-collect-test-' + Date.now());

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

describe('kb_collect', () => {
  it('should collect article source and write entry', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await collect({
      name: '岳飞传说',
      province: '湖南',
      region: '岳阳',
      type: '历史人物',
      summary: '岳飞在岳阳的传说故事。',
      story: '岳飞抗金的故事...',
      culturalSignificance: '忠义精神的象征。',
      relatedLocations: '[{"name":"岳阳楼","description":"岳飞曾登楼赋诗"}]',
      keywords: '岳飞、忠义、抗金',
      credibility: '基本可靠',
      unverifiedPoints: '[]',
      source_type: 'article',
      source_url: 'https://example.com/yuefei',
      source_title: '岳飞故事研究',
      source_author: '张三',
    });
    expect(result.entryInfo.name).toBe('岳飞传说');
    expect(result.entryInfo.province).toBe('湖南');
    expect(result.entryInfo.regionPrefix).toBe('岳阳');
    expect(result.entryInfo.grouped).toBe(true);
    expect(result.entryFile).toContain('湖南.md');
    expect(result.sourceFile).toContain('articles');
    expect(result.sourceFile).toContain('岳飞故事研究.md');

    // Verify entry was written with source label
    const content = fs.readFileSync(path.join(tmpDir, 'provinces', '湖南.md'), 'utf-8');
    expect(content).toContain('## 岳飞传说');
    expect(content).toContain('文章：岳飞故事研究');

    // Verify source file was created
    expect(fs.existsSync(result.sourceFile)).toBe(true);
    const sourceContent = fs.readFileSync(result.sourceFile, 'utf-8');
    expect(sourceContent).toContain('岳飞传说');
  });

  it('should collect book source and write entry', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await collect({
      name: '炎帝传说',
      province: '湖南',
      region: '株洲炎陵',
      type: '神话传说',
      summary: '炎帝神农氏的故事。',
      story: '炎帝在株洲的传说...',
      culturalSignificance: '中华文明始祖之一。',
      relatedLocations: '[{"name":"炎帝陵","description":"炎帝陵墓所在地"}]',
      keywords: '炎帝、神农',
      credibility: '基本可靠',
      unverifiedPoints: '[]',
      source_type: 'book',
      source_title: '炎帝传说研究',
      source_author: '李四',
    });
    expect(result.sourceFile).toContain('books');
    expect(result.sourceFile).toContain('炎帝传说研究.md');
    expect(result.entryInfo.regionPrefix).toBe('株洲');

    const content = fs.readFileSync(path.join(tmpDir, 'provinces', '湖南.md'), 'utf-8');
    expect(content).toContain('书籍：炎帝传说研究');
  });

  it('should collect oral source and write entry', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await collect({
      name: '洞庭湖传说',
      province: '湖南',
      region: '岳阳',
      type: '民间故事',
      summary: '洞庭湖的传说故事。',
      story: '老渔民讲述的洞庭湖故事...',
      culturalSignificance: '湖区文化。',
      relatedLocations: '[{"name":"洞庭湖","description":"传说发生地"}]',
      keywords: '洞庭湖、传说',
      credibility: '待核实',
      unverifiedPoints: '["讲述人背景待查"]',
      source_type: 'oral',
      source_title: '洞庭湖传说',
      source_narrator: '王大爷',
      source_narratorInfo: '当地渔民',
      source_location: '岳阳',
      source_date: '2026-05-20',
      source_recorder: '记者张',
    });
    expect(result.sourceFile).toContain('oral');
    expect(result.sourceFile).toContain('王大爷-洞庭湖传说.md');

    const content = fs.readFileSync(path.join(tmpDir, 'provinces', '湖南.md'), 'utf-8');
    expect(content).toContain('口述：王大爷');
  });

  it('should reject invalid province', async () => {
    process.env.KB_ROOT = tmpDir;
    await expect(collect({
      name: '测试', province: '不存在的省', region: '某地', type: '神话传说',
      summary: '测试', story: '测试', culturalSignificance: '测试',
      relatedLocations: '[]', keywords: '测试', credibility: '待核实',
      unverifiedPoints: '[]', source_type: 'article', source_title: '来源',
    })).rejects.toThrow('无效省份');
  });

  it('should reject missing required fields', async () => {
    process.env.KB_ROOT = tmpDir;
    await expect(collect({
      name: '', province: '湖南', region: '岳阳', type: '神话传说',
      summary: '', story: '', culturalSignificance: '',
      relatedLocations: '[]', keywords: '', credibility: '',
      unverifiedPoints: '[]', source_type: 'article', source_title: '来源',
    })).rejects.toThrow('缺少必填字段');
  });
});