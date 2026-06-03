import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateScript } from '../src/tools/generate-script.js';
import { formatScript, deriveTitle, SCENE_TEMPLATES, DEFAULT_DURATIONS } from '../src/lib/scripts.js';

const tmpDir = path.join(os.tmpdir(), 'kb-gen-script-test-' + Date.now());

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

---

## 西湖传说

- **省份**：浙江
- **地区**：杭州
- **类型**：民间故事

### 简介

西湖相关的民间传说故事。

### 关键词

西湖、传说、杭州

---`);

  // Create scripts directories
  const scriptsRoot = path.join(tmpDir, '..', 'scripts');
  fs.mkdirSync(path.join(scriptsRoot, '纪录片'), { recursive: true });
  fs.mkdirSync(path.join(scriptsRoot, '短剧'), { recursive: true });
  fs.mkdirSync(path.join(scriptsRoot, '动画'), { recursive: true });
  fs.mkdirSync(path.join(scriptsRoot, '文化解说'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('scripts lib', () => {
  it('should have 4 scene templates', () => {
    expect(Object.keys(SCENE_TEMPLATES).length).toBe(4);
    expect(SCENE_TEMPLATES['纪录片'].length).toBe(5);
    expect(SCENE_TEMPLATES['短剧'].length).toBe(5);
  });

  it('should have default durations', () => {
    expect(DEFAULT_DURATIONS['纪录片']).toBe('30分钟');
    expect(DEFAULT_DURATIONS['短剧']).toBe('单集20分钟');
  });

  it('should derive title from single entry name', () => {
    expect(deriveTitle(['白蛇传'])).toBe('白蛇传');
  });

  it('should derive title from multiple entry names', () => {
    expect(deriveTitle(['白蛇传', '西湖传说'])).toBe('白蛇传·西湖传说——文化脚本');
  });

  it('should format single-entry script', () => {
    const entry = {
      name: '白蛇传', province: '浙江', region: '杭州', type: '民间故事',
      summary: '白蛇传在杭州的流传版本。',
      story: '白娘子与许仙的爱情故事。',
      culturalSignificance: '反映了民间对爱情的追求。',
      relatedLocations: [{ name: '断桥', description: '故事核心场景' }],
      keywords: ['白蛇', '许仙'], sources: [], credibility: '基本可靠' as any, unverifiedPoints: [],
    };
    const md = formatScript([entry], '纪录片', '白蛇传', '30分钟', '2026-06-01');
    expect(md).toContain('# 白蛇传');
    expect(md).toContain('**脚本类型**：纪录片');
    expect(md).toContain('← 白蛇传');
    expect(md).toContain('**地点**：断桥');
    expect(md).toContain('来源追溯表');
  });

  it('should mark unfilled fields', () => {
    const entry = {
      name: '白蛇传', province: '浙江', region: '杭州', type: '民间故事',
      summary: '白蛇传', story: '白蛇传', culturalSignificance: '爱情追求',
      relatedLocations: [], keywords: [], sources: [], credibility: '基本可靠' as any, unverifiedPoints: [],
    };
    const md = formatScript([entry], '短剧', '白蛇传', '20分钟', '2026-06-01');
    expect(md).toContain('（待填充）');
  });
});

describe('kb_generate_script', () => {
  it('should generate script from existing entries', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await generateScript({
      entry_names: '白蛇传',
      script_type: '纪录片',
    });
    expect(result.entriesUsed).toContain('白蛇传');
    expect(result.scriptType).toBe('纪录片');
    expect(result.sceneCount).toBe(5);

    // Verify file was written
    const scriptPath = path.join(tmpDir, '..', 'scripts', '纪录片', '白蛇传.md');
    expect(fs.existsSync(scriptPath)).toBe(true);
    const content = fs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('# 白蛇传');
    expect(content).toContain('← 白蛇传');
  });

  it('should throw for nonexistent entries', async () => {
    process.env.KB_ROOT = tmpDir;
    await expect(generateScript({
      entry_names: '不存在的故事',
      script_type: '纪录片',
    })).rejects.toThrow('未找到匹配的条目');
  });
});