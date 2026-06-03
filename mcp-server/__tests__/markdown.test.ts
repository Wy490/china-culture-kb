import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readProvinceFile, parseEntries, writeEntryToProvince, parseFullEntry, getFullEntryDetail } from '../src/lib/markdown.js';
import { formatEntry } from '../src/lib/templates.js';
import { CultureEntry } from '../src/types.js';

const tmpDir = path.join(os.tmpdir(), 'kb-test-' + Date.now());

beforeEach(() => {
  fs.mkdirSync(path.join(tmpDir, 'provinces'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'provinces', '北京.md'), '# 北京\n\n## 待整理条目\n\n## 已整理条目\n\n<!-- 已完成详细填写的条目将在此区域列出 -->\n');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('markdown', () => {
  it('should read province file content', async () => {
    process.env.KB_ROOT = tmpDir;
    const content = await readProvinceFile('北京');
    expect(content).toContain('# 北京');
  });

  it('should parse entries from province file', () => {
    const content = `# 北京

## 待整理条目

## 已整理条目

---

## 白蛇传说

- **省份**：北京
- **地区**：北京
- **类型**：民间故事

### 简介

白蛇传说在北京地区的流传版本。

### 关键词

白蛇、许仙、断桥`;

    const entries = parseEntries(content);
    expect(entries.length).toBe(1);
    expect(entries[0].name).toBe('白蛇传说');
    expect(entries[0].province).toBe('北京');
    expect(entries[0].keywords).toContain('白蛇');
  });

  it('should format entry as markdown', () => {
    const entry: CultureEntry = {
      name: '白蛇传说',
      province: '北京',
      region: '北京',
      type: '民间故事',
      summary: '白蛇传说在北京地区的流传版本。',
      story: '详细故事内容...',
      culturalSignificance: '反映了民间对爱情的追求。',
      relatedLocations: [{ name: '断桥', description: '故事核心场景' }],
      keywords: ['白蛇', '许仙', '断桥'],
      sources: ['口述资料：张大爷'],
      credibility: '待核实',
      verificationMethod: '内部互证：江苏、浙江版本佐证',
      unverifiedPoints: ['具体地点需核实'],
    };
    const md = formatEntry(entry);
    expect(md).toContain('## 白蛇传说');
    expect(md).toContain('**省份**：北京');
    expect(md).toContain('### 关键词');
    expect(md).toContain('白蛇、许仙、断桥');
  });

  it('should write entry to province file', async () => {
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
    await writeEntryToProvince(entry, '北京');
    const content = fs.readFileSync(path.join(tmpDir, 'provinces', '北京.md'), 'utf-8');
    expect(content).toContain('## 故宫传说');
    expect(content).toContain('**省份**：北京');
  });
});

describe('parseFullEntry', () => {
  const fullEntryContent = `# 湖南

## 来源索引

## 待整理条目

## 已整理条目

---

## 屈原投江汨罗——端午节起源

- **省份**：湖南
- **地区**：岳阳→汨罗
- **类型**：神话传说

### 简介

屈原投汨罗江殉国，衍生出端午节龙舟竞渡和粽子两大核心习俗。

### 故事梗概

公元前278年，秦将白起攻破郢都，屈原投汨罗江殉国。百姓划船寻找遗体演变为龙舟竞渡。

传说屈原投江前遇渔父问答，决然不从随波逐流之议。百姓投粽子喂鱼保护遗体。

### 文化意义

端午节龙舟与粽子两大核心习俗与屈原殉国直接相关。汨罗江成为端午节文化最具象征意义的地理标志。

### 相关地点

- 汨罗江：屈原投江之处，岳阳汨罗市
- 屈子祠：汨罗江畔玉笥山上，始建于汉代

### 关键词

屈原、汨罗江、端午节、龙舟竞渡、粽子、楚国

### 来源

- 《史记·屈原贾生列传》（A级）
- 汨罗江畔端午习俗国家级非遗（B级）
- ich.gov.cn（C级）

### 可信度与核实

基本可靠（A级《史记》+B级非遗名录交叉佐证；实物遗迹可考察）

### 待核实点

- 屈原托梦告知缠五彩线的传说为民间传说，无史料直接记载
- 十二疑冢的具体历史依据待查

---

## 王夫之——船山先生

- **省份**：湖南
- **地区**：衡阳→衡阳县
- **类型**：历史人物

### 简介

王夫之（1619—1692），明清之际伟大哲学家。

### 可信度

基本可靠`;

  it('should parse full entry detail with all sections', () => {
    const detail = parseFullEntry(fullEntryContent, '屈原投江汨罗——端午节起源');
    expect(detail).not.toBeNull();
    expect(detail!.name).toBe('屈原投江汨罗——端午节起源');
    expect(detail!.province).toBe('湖南');
    expect(detail!.region).toBe('岳阳→汨罗');
    expect(detail!.type).toBe('神话传说');
    expect(detail!.story).toContain('公元前278年');
    expect(detail!.story).toContain('百姓划船寻找遗体演变为龙舟竞渡');
    expect(detail!.culturalSignificance).toContain('端午节龙舟与粽子两大核心习俗');
    expect(detail!.sources.length).toBe(3);
    expect(detail!.sources[0]).toContain('《史记·屈原贾生列传》');
    expect(detail!.sources[0]).toContain('A级');
    expect(detail!.relatedLocations.length).toBe(2);
    expect(detail!.relatedLocations[0].name).toBe('汨罗江');
    expect(detail!.relatedLocations[0].description).toContain('屈原投江之处');
    expect(detail!.keywords).toContain('屈原');
    expect(detail!.keywords).toContain('端午节');
    expect(detail!.credibility).toBe('基本可靠');
    expect(detail!.verificationMethod).toContain('A级《史记》+B级非遗名录交叉佐证');
    expect(detail!.unverifiedPoints.length).toBe(2);
    expect(detail!.unverifiedPoints[0]).toContain('屈原托梦');
  });

  it('should parse entry with old separate credibility format', () => {
    const detail = parseFullEntry(fullEntryContent, '王夫之——船山先生');
    expect(detail).not.toBeNull();
    expect(detail!.name).toBe('王夫之——船山先生');
    expect(detail!.credibility).toBe('基本可靠');
  });

  it('should return null for nonexistent entry', () => {
    const detail = parseFullEntry(fullEntryContent, '不存在的故事');
    expect(detail).toBeNull();
  });

  it('should get full entry detail from province file', async () => {
    process.env.KB_ROOT = tmpDir;
    // Write a province file with a full entry
    const entryMd = `# 北京

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
- 九龙壁：故宫内著名建筑

### 关键词

故宫、传说、九龙壁

### 来源

- 故宫博物院官网（B级）
- 民间口述传说（D级）

### 可信度与核实

待核实（B级官方资料+D级民间口述；实物建筑可实地考察）

### 待核实点

- 九龙壁传说为民间口述，无正史记载`;
    fs.writeFileSync(path.join(tmpDir, 'provinces', '北京.md'), entryMd);
    const result = await getFullEntryDetail('故宫传说');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('故宫传说');
    expect(result!.type).toBe('名胜古迹');
    expect(result!.story).toContain('九龙壁传说');
    expect(result!.sources.length).toBe(2);
    expect(result!.unverifiedPoints.length).toBe(1);
  });
});