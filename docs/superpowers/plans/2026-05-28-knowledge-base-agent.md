# 中国传统文化知识库 Agent 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 MCP Server 提供7个知识库专用工具，通过 Claude Code 编排实现传统文化内容的采集、核查、入库、匹配和补充。

**Architecture:** MCP Server (TypeScript + MCP SDK) 作为独立进程运行，通过 stdio 与 Claude Code 通信。知识库数据存储在 Markdown 文件中。kb_match 的语义分析由 Claude Code 完成，MCP 工具只负责文件读写和数据返回。

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk (1.29), zod (4.x), Node.js fs, yt-dlp (字幕提取)

---

## 文件结构

```
mcp-server/
  src/
    index.ts              ← MCP Server 入口，注册所有工具
    types.ts              ← 共享类型定义
    lib/
      provinces.ts        ← 34省份映射，文件路径解析
      markdown.ts         ← Markdown 文件读写
      bilibili.ts         ← B站 API 调用
      templates.ts        ← 条目格式化
    tools/
      search.ts           ← kb_search
      add-entry.ts        ← kb_add_entry
      match.ts            ← kb_match
      supplement.ts       ← kb_supplement
      fetch-video.ts      ← kb_fetch_video
      fetch-article.ts    ← kb_fetch_article
      verify-source.ts    ← kb_verify_source
  __tests__/
    provinces.test.ts
    markdown.test.ts
    search.test.ts
    add-entry.test.ts
    match.test.ts
    supplement.test.ts
    verify-source.test.ts
    fetch-video.test.ts
    fetch-article.test.ts
  package.json
  tsconfig.json
  vitest.config.ts
```

---

### Task 1: 项目初始化

**Files:**
- Create: `mcp-server/package.json`
- Create: `mcp-server/tsconfig.json`
- Create: `mcp-server/vitest.config.ts`

- [ ] **Step 1: 创建 mcp-server 目录和 package.json**

```json
{
  "name": "china-culture-kb-mcp",
  "version": "0.1.0",
  "description": "中国传统文化知识库 MCP Server",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["__tests__"]
}
```

- [ ] **Step 3: 创建 vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 4: 安装依赖**

Run: `cd mcp-server && npm install`
Expected: 依赖安装成功

- [ ] **Step 5: Commit**

```bash
git add mcp-server/package.json mcp-server/tsconfig.json mcp-server/vitest.config.ts mcp-server/package-lock.json
git commit -m "feat: initialize mcp-server project with TypeScript, MCP SDK, vitest"
```

---

### Task 2: 共享类型和省份映射

**Files:**
- Create: `mcp-server/src/types.ts`
- Create: `mcp-server/src/lib/provinces.ts`
- Create: `mcp-server/__tests__/provinces.test.ts`

- [ ] **Step 1: 写 provinces.test.ts 测试**

```typescript
import { describe, it, expect } from 'vitest';
import { PROVINCES, resolveProvinceFile, findProvinceByName } from '../src/lib/provinces.js';

describe('provinces', () => {
  it('should have 34 provinces', () => {
    expect(PROVINCES.length).toBe(34);
  });

  it('should resolve province file path', () => {
    const path = resolveProvinceFile('北京');
    expect(path).toContain('data/provinces/北京.md');
  });

  it('should find province by name', () => {
    expect(findProvinceByName('浙江')).toBe('浙江');
    expect(findProvinceByName('不存在的省')).toBeNull();
  });

  it('should find province by alias', () => {
    expect(findProvinceByName('内蒙古')).toBe('内蒙古');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mcp-server && npm test -- --reporter=verbose __tests__/provinces.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: 写 types.ts 类型定义**

```typescript
export type EntryType =
  | '神话传说'
  | '民间故事'
  | '非遗'
  | '节庆习俗'
  | '地方戏曲'
  | '饮食文化'
  | '传统工艺'
  | '历史人物'
  | '地方掌故'
  | '宗教信仰'
  | '民俗活动';

export type CredibilityLevel = '可靠' | '基本可靠' | '待核实' | '存疑';

export type SourceType = 'bilibili' | 'article' | 'book' | 'oral';

export interface CultureEntry {
  name: string;
  province: string;
  region: string;
  type: EntryType;
  summary: string;
  story: string;
  culturalSignificance: string;
  relatedLocations: Array<{ name: string; description: string }>;
  keywords: string[];
  sources: string[];
  credibility: CredibilityLevel;
  verificationMethod?: string;
  unverifiedPoints: string[];
}

export interface VideoSource {
  bvId: string;
  url: string;
  title: string;
  upOwner: string;
  publishDate: string;
  topic: string;
  status: string;
}

export interface ArticleSource {
  url: string;
  title: string;
  author: string;
  platform: string;
  publishDate: string;
}

export interface OralSource {
  narrator: string;
  narratorInfo: string;
  location: string;
  date: string;
  scene: string;
  recorder: string;
  storyName: string;
  storyContent: string;
}

export interface SearchResult {
  name: string;
  province: string;
  region: string;
  type: EntryType;
  summary: string;
  keywords: string[];
  credibility: CredibilityLevel;
}

export interface MatchResult {
  entries: SearchResult[];
  provinceHints: string[];
  totalEntriesRead: number;
}

export interface SupplementResult {
  versionDifferences: SearchResult[];
  sameRegionType: SearchResult[];
  relatedNetwork: SearchResult[];
}

export interface VerifyResult {
  credibility: CredibilityLevel;
  verificationMethod: string;
  details: string;
  unverifiedPoints: string[];
  internalEvidenceCount: number;
}
```

- [ ] **Step 4: 写 provinces.ts**

```typescript
import path from 'node:path';

const KB_ROOT = path.resolve(process.env.KB_ROOT || path.join(process.cwd(), '..', 'data'));

export const PROVINCES = [
  '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江',
  '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南',
  '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州',
  '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆', '香港',
  '澳门', '台湾',
];

export function resolveProvinceFile(province: string): string {
  return path.join(KB_ROOT, 'provinces', `${province}.md`);
}

export function findProvinceByName(name: string): string | null {
  const found = PROVINCES.find(p => p === name);
  return found ?? null;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd mcp-server && npm test -- --reporter=verbose __tests__/provinces.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add mcp-server/src/types.ts mcp-server/src/lib/provinces.ts mcp-server/__tests__/provinces.test.ts
git commit -m "feat: add shared types and province mapping"
```

---

### Task 3: Markdown 读写库

**Files:**
- Create: `mcp-server/src/lib/markdown.ts`
- Create: `mcp-server/src/lib/templates.ts`
- Create: `mcp-server/__tests__/markdown.test.ts`

- [ ] **Step 1: 写 markdown.test.ts 测试**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readProvinceFile, parseEntries, writeEntryToProvince, formatEntry } from '../src/lib/markdown.js';
import { CultureEntry } from '../src/types.js';

const tmpDir = path.join(os.tmpdir(), 'kb-test-' + Date.now());

beforeEach(() => {
  fs.mkdirSync(tmpDir, { recursive: true });
  const provincesDir = path.join(tmpDir, 'provinces');
  fs.mkdirSync(provincesDir, { recursive: true });
  fs.writeFileSync(path.join(provincesDir, '北京.md'), '# 北京\n\n## 待整理条目\n\n## 已整理条目\n');
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
      story: '故事内容...',
      culturalSignificance: '故宫文化的民间解读。',
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mcp-server && npm test -- --reporter=verbose __tests__/markdown.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: 写 templates.ts 条目格式化**

```typescript
import { CultureEntry } from '../types.js';

export function formatEntry(entry: CultureEntry): string {
  const lines: string[] = [
    '---',
    '',
    `## ${entry.name}`,
    '',
    `- **省份**：${entry.province}`,
    `- **地区**：${entry.region}`,
    `- **类型**：${entry.type}`,
    '',
    '### 简介',
    '',
    entry.summary,
    '',
    '### 故事梗概',
    '',
    entry.story,
    '',
    '### 文化意义',
    '',
    entry.culturalSignificance,
    '',
    '### 相关地点',
    '',
    ...entry.relatedLocations.map(loc => `- ${loc.name}：${loc.description}`),
    '',
    '### 关键词',
    '',
    entry.keywords.join('、'),
    '',
    '### 来源',
    '',
    ...entry.sources.map(s => `- ${s}`),
    '',
    '### 可信度',
    '',
    entry.credibility,
    '',
    '### 核实方法',
    '',
    entry.verificationMethod || '未标注',
    '',
    '### 待核实点',
    '',
    ...entry.unverifiedPoints.map(p => `- ${p}`),
    '',
    '---',
  ];
  return lines.join('\n');
}
```

- [ ] **Step 4: 写 markdown.ts 读写库**

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { CultureEntry, SearchResult } from '../types.js';
import { resolveProvinceFile, PROVINCES } from './provinces.js';
import { formatEntry } from './templates.js';

const KB_ROOT = path.resolve(process.env.KB_ROOT || path.join(process.cwd(), '..', 'data'));

export async function readProvinceFile(province: string): Promise<string> {
  const filePath = resolveProvinceFile(province);
  return fs.readFile(filePath, 'utf-8');
}

export async function readAllProvinceFiles(provinceHints?: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const priority = provinceHints?.filter(p => PROVINCES.includes(p)) ?? [];
  const rest = PROVINCES.filter(p => !priority.includes(p));
  const order = [...priority, ...rest];

  for (const province of order) {
    try {
      const content = await readProvinceFile(province);
      results.set(province, content);
    } catch {
      // 空文件或不存在，跳过
    }
  }
  return results;
}

export function parseEntries(content: string): SearchResult[] {
  const entries: SearchResult[] = [];
  const sectionRegex = /## (.+?)\n\n(- \*{2}省份\*{2}：(.+?)\n- \*{2}地区\*{2}：(.+?)\n- \*{2}类型\*{2}：(.+?)\n)/g;
  let match: RegExpExecArray | null;

  while ((match = sectionRegex.exec(content)) !== null) {
    const name = match[1];
    const province = match[3];
    const region = match[4];
    const type = match[5];

    // 提取简介
    const summaryMatch = content.slice(match.index).match(/### 简介\n\n(.+?)\n\n/);
    const summary = summaryMatch?.[1] || '';

    // 提取关键词
    const kwMatch = content.slice(match.index).match(/### 关键词\n\n(.+?)\n/);
    const keywords = kwMatch?.[1]?.split('、') || [];

    // 提取可信度
    const credMatch = content.slice(match.index).match(/### 可信度\n\n(.+?)\n/);
    const credibility = credMatch?.[1] || '待核实';

    entries.push({ name, province, region, type, summary, keywords, credibility });
  }
  return entries;
}

export async function writeEntryToProvince(entry: CultureEntry, province: string): Promise<string> {
  const filePath = resolveProvinceFile(province);
  const existing = await fs.readFile(filePath, 'utf-8');
  const entryMarkdown = formatEntry(entry);

  // 将条目写入"已整理条目"区域之后
  const marker = '## 已整理条目';
  const insertPos = existing.indexOf(marker);
  if (insertPos === -1) {
    throw new Error(`省份文件 ${province} 缺少"已整理条目"区域`);
  }

  const afterMarker = insertPos + marker.length;
  const commentEnd = existing.indexOf('-->', afterMarker);
  const insertIndex = commentEnd !== -1 ? commentEnd + 3 : afterMarker;

  const newContent = existing.slice(0, insertIndex) + '\n\n' + entryMarkdown + existing.slice(insertIndex);
  await fs.writeFile(filePath, newContent, 'utf-8');
  return filePath;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd mcp-server && npm test -- --reporter=verbose __tests__/markdown.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add mcp-server/src/lib/markdown.ts mcp-server/src/lib/templates.ts mcp-server/__tests__/markdown.test.ts
git commit -m "feat: add markdown read/write and entry formatting library"
```

---

### Task 4: kb_search 工具

**Files:**
- Create: `mcp-server/src/tools/search.ts`
- Create: `mcp-server/__tests__/search.test.ts`

- [ ] **Step 1: 写 search.test.ts**

```typescript
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mcp-server && npm test -- --reporter=verbose __tests__/search.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 search.ts 实现**

```typescript
import { SearchResult } from '../types.js';
import { readProvinceFile, parseEntries } from '../lib/markdown.js';
import { PROVINCES, findProvinceByName } from '../lib/provinces.js';

interface SearchInput {
  keywords: string;
  type?: string;
  province?: string;
  region?: string;
}

export async function searchKnowledgeBase(input: SearchInput): Promise<SearchResult[]> {
  const provincesToSearch = input.province
    ? [findProvinceByName(input.province) ?? input.province]
    : PROVINCES;

  const keywordList = input.keywords.split(/[,，、\s]+/).filter(Boolean);
  const results: SearchResult[] = [];

  for (const province of provincesToSearch) {
    try {
      const content = await readProvinceFile(province);
      const entries = parseEntries(content);

      for (const entry of entries) {
        // 类型过滤
        if (input.type && entry.type !== input.type) continue;

        // 地区过滤
        if (input.region && entry.region !== input.region) continue;

        // 关键词过滤
        if (keywordList.length > 0) {
          const matchCount = keywordList.filter(kw =>
            entry.keywords.some(ekw => ekw.includes(kw) || kw.includes(ekw))
            || entry.name.includes(kw)
            || entry.summary.includes(kw)
          ).length;
          if (matchCount === 0) continue;
        }

        results.push(entry);
      }
    } catch {
      continue;
    }
  }
  return results;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd mcp-server && npm test -- --reporter=verbose __tests__/search.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools/search.ts mcp-server/__tests__/search.test.ts
git commit -m "feat: add kb_search tool with keyword, type, province filters"
```

---

### Task 5: kb_add_entry 工具

**Files:**
- Create: `mcp-server/src/tools/add-entry.ts`
- Create: `mcp-server/__tests__/add-entry.test.ts`

- [ ] **Step 1: 写 add-entry.test.ts**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { addEntry } from '../src/tools/add-entry.js';
import { CultureEntry } from '../src/types.js';

const tmpDir = path.join(os.tmpdir(), 'kb-add-test-' + Date.now());

beforeEach(() => {
  fs.mkdirSync(path.join(tmpDir, 'provinces'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'provinces', '北京.md'), '# 北京\n\n## 待整理条目\n\n## 已整理条目\n\n<!-- 已完成详细填写的条目将在此区域列出 -->\n');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('kb_add_entry', () => {
  it('should add a valid entry to province file', async () => {
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
    const result = await addEntry(entry);
    expect(result.filePath).toContain('北京.md');
    const content = fs.readFileSync(path.join(tmpDir, 'provinces', '北京.md'), 'utf-8');
    expect(content).toContain('## 故宫传说');
  });

  it('should reject entry with missing required fields', async () => {
    process.env.KB_ROOT = tmpDir;
    const entry = {
      name: '测试',
      province: '北京',
    } as any;
    await expect(addEntry(entry)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mcp-server && npm test -- --reporter=verbose __tests__/add-entry.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 add-entry.ts 实现**

```typescript
import { CultureEntry } from '../types.js';
import { writeEntryToProvince } from '../lib/markdown.js';
import { findProvinceByName } from '../lib/provinces.js';

const REQUIRED_FIELDS: (keyof CultureEntry)[] = [
  'name', 'province', 'region', 'type', 'summary',
  'story', 'culturalSignificance', 'relatedLocations',
  'keywords', 'sources', 'credibility', 'unverifiedPoints',
];

export async function addEntry(entry: CultureEntry): Promise<{ filePath: string; message: string }> {
  // 验证必填字段
  for (const field of REQUIRED_FIELDS) {
    if (entry[field] === undefined || entry[field] === null || entry[field] === '') {
      throw new Error(`缺少必填字段：${field}`);
    }
  }

  // 验证省份
  const provinceName = findProvinceByName(entry.province);
  if (!provinceName) {
    throw new Error(`无效省份：${entry.province}`);
  }

  const filePath = await writeEntryToProvince(entry, provinceName);
  return { filePath, message: `条目"${entry.name}"已写入${provinceName}` };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd mcp-server && npm test -- --reporter=verbose __tests__/add-entry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools/add-entry.ts mcp-server/__tests__/add-entry.test.ts
git commit -m "feat: add kb_add_entry tool with field validation"
```

---

### Task 6: kb_fetch_video 工具

**Files:**
- Create: `mcp-server/src/lib/bilibili.ts`
- Create: `mcp-server/src/tools/fetch-video.ts`
- Create: `mcp-server/__tests__/fetch-video.test.ts`

- [ ] **Step 1: 写 fetch-video.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { fetchVideo } from '../src/tools/fetch-video.js';

describe('kb_fetch_video', () => {
  it('should extract BV id from URL', () => {
    const bvId = extractBvId('https://www.bilibili.com/video/BV19dGb66ERy');
    expect(bvId).toBe('BV19dGb66ERy');
  });

  it('should accept BV id directly', () => {
    const bvId = extractBvId('BV19dGb66ERy');
    expect(bvId).toBe('BV19dGb66ERy');
  });

  it('should fetch video info from bilibili API', async () => {
    // 使用真实BV号测试，如果API不可达则跳过
    const result = await fetchVideo({ bvId: 'BV19dGb66ERy' });
    if (result) {
      expect(result.bvId).toBe('BV19dGb66ERy');
      expect(result.url).toContain('bilibili.com');
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mcp-server && npm test -- --reporter=verbose __tests__/fetch-video.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 bilibili.ts API 库**

```typescript
export interface BilibiliVideoInfo {
  bvid: string;
  title: string;
  ownerName: string;
  ownerMid: number;
  publishDate: string;
  description: string;
  duration: number;
}

export async function getVideoInfo(bvid: string): Promise<BilibiliVideoInfo | null> {
  try {
    const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ChinaCultureKB/0.1' },
    });
    if (!response.ok) return null;

    const data = await response.json() as any;
    if (data.code !== 0) return null;

    return {
      bvid: data.data.bvid,
      title: data.data.title,
      ownerName: data.data.owner.name,
      ownerMid: data.data.owner.mid,
      publishDate: new Date(data.data.pubdate * 1000).toISOString().split('T')[0],
      description: data.data.desc,
      duration: data.data.duration,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: 写 fetch-video.ts 工具**

```typescript
import { getVideoInfo } from '../lib/bilibili.js';
import { VideoSource } from '../types.js';

export function extractBvId(input: string): string | null {
  const match = input.match(/BV[\w]+/);
  return match ? match[0] : null;
}

interface FetchVideoInput {
  bvId?: string;
  url?: string;
}

export async function fetchVideo(input: FetchVideoInput): Promise<VideoSource | null> {
  const bvid = input.bvId ?? extractBvId(input.url ?? '');
  if (!bvid) return null;

  const info = await getVideoInfo(bvid);
  if (!info) return null;

  return {
    bvId: info.bvid,
    url: `https://www.bilibili.com/video/${info.bvid}`,
    title: info.title,
    upOwner: info.ownerName,
    publishDate: info.publishDate,
    topic: '中华传统文化及故事',
    status: '待整理',
  };
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd mcp-server && npm test -- --reporter=verbose __tests__/fetch-video.test.ts`
Expected: PASS（网络可达时）

- [ ] **Step 6: Commit**

```bash
git add mcp-server/src/lib/bilibili.ts mcp-server/src/tools/fetch-video.ts mcp-server/__tests__/fetch-video.test.ts
git commit -m "feat: add kb_fetch_video tool with bilibili API integration"
```

---

### Task 7: kb_fetch_article 工具

**Files:**
- Create: `mcp-server/src/tools/fetch-article.ts`
- Create: `mcp-server/__tests__/fetch-article.test.ts`

- [ ] **Step 1: 写 fetch-article.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { fetchArticle, extractPlatform } from '../src/tools/fetch-article.js';

describe('kb_fetch_article', () => {
  it('should extract platform from URL', () => {
    expect(extractPlatform('https://mp.weixin.qq.com/s/abc')).toBe('微信公众号');
    expect(extractPlatform('https://zhuanlan.zhihu.com/p/123')).toBe('知乎');
    expect(extractPlatform('https://www.toutiao.com/article/456')).toBe('头条号');
    expect(extractPlatform('https://example.com/some-article')).toBe('其他');
  });

  it('should fetch and parse article content', async () => {
    const result = await fetchArticle({ url: 'https://example.com' });
    // 网络请求可能失败，测试结构而非内容
    if (result) {
      expect(result.url).toBe('https://example.com');
      expect(result.platform).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mcp-server && npm test -- --reporter=verbose __tests__/fetch-article.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 fetch-article.ts 实现**

```typescript
import { ArticleSource } from '../types.js';

const PLATFORM_MAP: Record<string, string> = {
  'mp.weixin.qq.com': '微信公众号',
  'zhuanlan.zhihu.com': '知乎',
  'www.zhihu.com': '知乎',
  'www.toutiao.com': '头条号',
  'www.sohu.com': '搜狐',
  'www.163.com': '网易',
  'www.people.com.cn': '人民网',
  'www.chinaculture.org': '中国文化网',
};

export function extractPlatform(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    for (const [domain, platform] of Object.entries(PLATFORM_MAP)) {
      if (hostname.includes(domain)) return platform;
    }
    return '其他';
  } catch {
    return '其他';
  }
}

interface FetchArticleInput {
  url: string;
}

export async function fetchArticle(input: FetchArticleInput): Promise<ArticleSource | null> {
  try {
    const response = await fetch(input.url, {
      headers: { 'User-Agent': 'ChinaCultureKB/0.1' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;

    const html = await response.text();

    // 简易 HTML → 文本提取
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || '';

    const authorMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["'](.*?)["']/i);
    const author = authorMatch?.[1] || '未知';

    const dateMatch = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["'](.*?)["']/i);
    const publishDate = dateMatch?.[1]?.split('T')[0] || '';

    // 去除 HTML 标签得到纯文本
    const content = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);

    return {
      url: input.url,
      title,
      author,
      platform: extractPlatform(input.url),
      publishDate,
      content,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: 更新 ArticleSource 类型添加 content 字段**

在 `mcp-server/src/types.ts` 的 ArticleSource 中添加 `content?: string`：

```typescript
export interface ArticleSource {
  url: string;
  title: string;
  author: string;
  platform: string;
  publishDate: string;
  content?: string;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd mcp-server && npm test -- --reporter=verbose __tests__/fetch-article.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add mcp-server/src/tools/fetch-article.ts mcp-server/__tests__/fetch-article.test.ts mcp-server/src/types.ts
git commit -m "feat: add kb_fetch_article tool with platform detection"
```

---

### Task 8: kb_verify_source 工具

**Files:**
- Create: `mcp-server/src/tools/verify-source.ts`
- Create: `mcp-server/__tests__/verify-source.test.ts`

- [ ] **Step 1: 写 verify-source.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { verifySource } from '../src/tools/verify-source.js';

describe('kb_verify_source', () => {
  it('should assign default credibility for bilibili source', async () => {
    const result = await verifySource({
      sourceType: 'bilibili',
      sourceUrl: 'https://www.bilibili.com/video/BV19dGb66ERy',
      claims: '白蛇传的故事',
      externalVerificationResults: '',
    });
    expect(result.credibility).toBe('待核实');
    expect(result.verificationMethod).toContain('默认评级');
  });

  it('should assign 基本可靠 for book source', async () => {
    const result = await verifySource({
      sourceType: 'book',
      sourceUrl: '',
      sourceAuthor: '冯骥才',
      claims: '中国民间故事',
      externalVerificationResults: 'ISBN 978-7-xxx 可查',
    });
    expect(result.credibility).toBe('基本可靠');
  });

  it('should upgrade credibility with external verification', async () => {
    const result = await verifySource({
      sourceType: 'bilibili',
      sourceUrl: 'https://www.bilibili.com/video/BV19dGb66ERy',
      claims: '白蛇传',
      externalVerificationResults: '非遗名录有白蛇传条目，与中国文化网记载一致',
    });
    expect(result.credibility).toBe('基本可靠');
    expect(result.verificationMethod).toContain('外部核实');
  });

  it('should mark 存疑 for no evidence', async () => {
    const result = await verifySource({
      sourceType: 'oral',
      sourceUrl: '',
      claims: '某地方故事',
      externalVerificationResults: '',
      internalEvidenceCount: 0,
    });
    expect(result.credibility).toBe('存疑');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mcp-server && npm test -- --reporter=verbose __tests__/verify-source.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 verify-source.ts 实现**

```typescript
import { VerifyResult, SourceType, CredibilityLevel } from '../types.js';

interface VerifyInput {
  sourceType: SourceType;
  sourceUrl?: string;
  sourceAuthor?: string;
  claims: string;
  externalVerificationResults?: string;
  internalEvidenceCount?: number;
}

const DEFAULT_CREDIBILITY: Record<SourceType, CredibilityLevel> = {
  bilibili: '待核实',
  article: '待核实',
  book: '基本可靠',
  oral: '待核实',
};

export async function verifySource(input: VerifyInput): Promise<VerifyResult> {
  let credibility = DEFAULT_CREDIBILITY[input.sourceType];
  let verificationMethod = `默认评级（${input.sourceType}类来源）`;
  const unverifiedPoints: string[] = [];

  // 外部核实
  if (input.externalVerificationResults && input.externalVerificationResults.trim()) {
    credibility = '基本可靠';
    verificationMethod = `外部核实：${input.externalVerificationResults}`;
  }

  // 内部互证补充
  if (credibility === '待核实' && input.internalEvidenceCount !== undefined) {
    if (input.internalEvidenceCount >= 3) {
      credibility = '基本可靠';
      verificationMethod = `内部互证：知识库内${input.internalEvidenceCount}条佐证`;
    } else if (input.internalEvidenceCount >= 1) {
      verificationMethod += `；内部部分佐证：${input.internalEvidenceCount}条`;
    }
  }

  // 无任何佐证
  if (credibility === '待核实' && !input.externalVerificationResults && (input.internalEvidenceCount ?? 0) === 0) {
    credibility = '存疑';
    unverifiedPoints.push(`来源类型${input.sourceType}无外部佐证`);
    unverifiedPoints.push('知识库内无相关条目佐证');
    unverifiedPoints.push('建议后续寻找权威来源印证');
  }

  // 来源类型特定核查点
  switch (input.sourceType) {
    case 'bilibili':
      unverifiedPoints.push('UP主资质待查');
      unverifiedPoints.push('评论区考证信息待收集');
      break;
    case 'article':
      unverifiedPoints.push('平台权威性待评估');
      unverifiedPoints.push('作者背景待查');
      break;
    case 'oral':
      unverifiedPoints.push('讲述人背景是否可考');
      unverifiedPoints.push('故事与其他版本的一致性');
      unverifiedPoints.push('地域归属是否准确');
      break;
    case 'book':
      // 书籍论文默认可信，核查点较少
      if (!input.sourceUrl && !input.sourceAuthor) {
        unverifiedPoints.push('ISBN/DOI信息缺失');
      }
      break;
  }

  return {
    credibility,
    verificationMethod,
    details: `来源类型：${input.sourceType}，主张：${input.claims}`,
    unverifiedPoints,
    internalEvidenceCount: input.internalEvidenceCount ?? 0,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd mcp-server && npm test -- --reporter=verbose __tests__/verify-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools/verify-source.ts mcp-server/__tests__/verify-source.test.ts
git commit -m "feat: add kb_verify_source tool with hybrid verification strategy"
```

---

### Task 9: kb_match 工具

**Files:**
- Create: `mcp-server/src/tools/match.ts`
- Create: `mcp-server/__tests__/match.test.ts`

- [ ] **Step 1: 写 match.test.ts**

```typescript
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mcp-server && npm test -- --reporter=verbose __tests__/match.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 match.ts 实现**

```typescript
import { MatchResult } from '../types.js';
import { readAllProvinceFiles, parseEntries } from '../lib/markdown.js';

interface MatchInput {
  storyText: string;
  provinceHints?: string[];
  typeHint?: string;
}

export async function matchEntries(input: MatchInput): Promise<MatchResult> {
  const allFiles = await readAllProvinceFiles(input.provinceHints);
  const allEntries: MatchResult['entries'] = [];
  let totalEntriesRead = 0;

  for (const [province, content] of allFiles) {
    const entries = parseEntries(content);
    totalEntriesRead += entries.length;

    // 类型过滤（如果 Claude Code 提供了类型提示）
    const filtered = input.typeHint
      ? entries.filter(e => e.type === input.typeHint)
      : entries;

    allEntries.push(...filtered);
  }

  return {
    entries: allEntries,
    provinceHints: input.provinceHints ?? [],
    totalEntriesRead,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd mcp-server && npm test -- --reporter=verbose __tests__/match.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools/match.ts mcp-server/__tests__/match.test.ts
git commit -m "feat: add kb_match tool returning entries for Claude Code semantic analysis"
```

---

### Task 10: kb_supplement 工具

**Files:**
- Create: `mcp-server/src/tools/supplement.ts`
- Create: `mcp-server/__tests__/supplement.test.ts`

- [ ] **Step 1: 写 supplement.test.ts**

```typescript
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
  });

  it('should find related network entries', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await supplement({
      entryName: '白蛇传',
      province: '浙江',
      keywords: ['白蛇', '断桥', '西湖'],
      type: '民间故事',
    });
    expect(result.relatedNetwork.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mcp-server && npm test -- --reporter=verbose __tests__/supplement.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 supplement.ts 实现**

```typescript
import { SupplementResult, SearchResult } from '../types.js';
import { searchKnowledgeBase } from './search.js';

interface SupplementInput {
  entryName?: string;
  storyText?: string;
  province?: string;
  keywords?: string[];
  type?: string;
}

export async function supplement(input: SupplementInput): Promise<SupplementResult> {
  const kwString = input.keywords?.join('、') ?? input.entryName ?? input.storyText ?? '';
  const excludeName = input.entryName ?? '';

  // 维度1：版本差异 — 同关键词跨省检索
  const allKeywordResults = await searchKnowledgeBase({
    keywords: kwString,
    type: input.type,
  });
  const versionDifferences = allKeywordResults.filter(
    r => r.name === excludeName && r.province !== input.province
  );

  // 维度2：同地同类 — 同省份同类型
  const sameRegionType = input.province
    ? (await searchKnowledgeBase({
        keywords: '',
        type: input.type,
        province: input.province,
      })).filter(r => r.name !== excludeName)
    : [];

  // 维度3：关联网络 — 关键词交叉检索（排除已找到的条目）
  const relatedNetwork: SearchResult[] = [];
  for (const kw of input.keywords ?? []) {
    const kwResults = await searchKnowledgeBase({ keywords: kw });
    for (const r of kwResults) {
      if (
        r.name !== excludeName
        && !versionDifferences.some(v => v.name === r.name && v.province === r.province)
        && !sameRegionType.some(s => s.name === r.name)
        && !relatedNetwork.some(n => n.name === r.name && n.province === r.province)
      ) {
        relatedNetwork.push(r);
      }
    }
  }

  return { versionDifferences, sameRegionType, relatedNetwork };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd mcp-server && npm test -- --reporter=verbose __tests__/supplement.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools/supplement.ts mcp-server/__tests__/supplement.test.ts
git commit -m "feat: add kb_supplement tool with three-dimension supplement logic"
```

---

### Task 11: MCP Server 入口 — 注册所有工具

**Files:**
- Create: `mcp-server/src/index.ts`

- [ ] **Step 1: 写 index.ts MCP Server 入口**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { searchKnowledgeBase } from './tools/search.js';
import { addEntry } from './tools/add-entry.js';
import { matchEntries } from './tools/match.js';
import { supplement } from './tools/supplement.js';
import { fetchVideo, extractBvId } from './tools/fetch-video.js';
import { fetchArticle } from './tools/fetch-article.js';
import { verifySource } from './tools/verify-source.js';
import { CultureEntry, SourceType } from './types.js';

const server = new McpServer({
  name: 'china-culture-kb',
  version: '0.1.0',
});

// kb_search
server.tool(
  'kb_search',
  '按关键词、类型、省份、地区检索知识库',
  {
    keywords: z.string().describe('搜索关键词，多个关键词用逗号或空格分隔'),
    type: z.string().optional().describe('条目类型过滤：神话传说|民间故事|非遗|节庆习俗|地方戏曲|饮食文化|传统工艺|历史人物|地方掌故|宗教信仰|民俗活动'),
    province: z.string().optional().describe('省份过滤'),
    region: z.string().optional().describe('地区/城市过滤'),
  },
  async (input) => {
    const results = await searchKnowledgeBase(input);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(results, null, 2),
      }],
    };
  }
);

// kb_add_entry
server.tool(
  'kb_add_entry',
  '写入文化条目到省份文件。必须包含所有必填字段。',
  {
    name: z.string().describe('条目名称'),
    province: z.string().describe('省份'),
    region: z.string().describe('地区/城市'),
    type: z.string().describe('类型'),
    summary: z.string().describe('简介'),
    story: z.string().describe('故事梗概'),
    culturalSignificance: z.string().describe('文化意义'),
    relatedLocations: z.string().describe('相关地点，JSON数组格式 [{"name":"地点","description":"说明"}]'),
    keywords: z.string().describe('关键词，用逗号或顿号分隔'),
    sources: z.string().describe('来源列表，JSON数组格式 ["来源1","来源2"]'),
    credibility: z.string().describe('可信度：可靠|基本可靠|待核实|存疑'),
    verificationMethod: z.string().optional().describe('核实方法标注'),
    unverifiedPoints: z.string().describe('待核实点，JSON数组格式 ["点1","点2"]'),
  },
  async (input) => {
    const entry: CultureEntry = {
      name: input.name,
      province: input.province,
      region: input.region,
      type: input.type as any,
      summary: input.summary,
      story: input.story,
      culturalSignificance: input.culturalSignificance,
      relatedLocations: JSON.parse(input.relatedLocations),
      keywords: input.keywords.split(/[，,、]/),
      sources: JSON.parse(input.sources),
      credibility: input.credibility as any,
      verificationMethod: input.verificationMethod,
      unverifiedPoints: JSON.parse(input.unverifiedPoints),
    };
    const result = await addEntry(entry);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_match
server.tool(
  'kb_match',
  '语义匹配知识库条目。返回条目内容供Claude Code做语义分析。',
  {
    storyText: z.string().describe('用户上传的故事或观点文本'),
    provinceHints: z.string().optional().describe('Claude Code分析后的地理线索省份，逗号分隔'),
    typeHint: z.string().optional().describe('Claude Code分析后的类型判断'),
  },
  async (input) => {
    const result = await matchEntries({
      storyText: input.storyText,
      provinceHints: input.provinceHints?.split(/[，,]/) ?? undefined,
      typeHint: input.typeHint,
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_supplement
server.tool(
  'kb_supplement',
  '三维度补充相关知识库内容：版本差异、同地同类、关联网络',
  {
    entryName: z.string().optional().describe('条目名称'),
    storyText: z.string().optional().describe('故事文本（若无条目名称）'),
    province: z.string().optional().describe('当前条目所属省份'),
    keywords: z.string().optional().describe('关键词，逗号分隔'),
    type: z.string().optional().describe('条目类型'),
  },
  async (input) => {
    const result = await supplement({
      entryName: input.entryName,
      storyText: input.storyText,
      province: input.province,
      keywords: input.keywords?.split(/[，,、]/) ?? undefined,
      type: input.type,
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_fetch_video
server.tool(
  'kb_fetch_video',
  '从B站视频抓取内容信息',
  {
    bvId: z.string().optional().describe('BV号，如BV19dGb66ERy'),
    url: z.string().optional().describe('B站视频链接'),
  },
  async (input) => {
    const result = await fetchVideo(input);
    if (!result) {
      return { content: [{ type: 'text', text: '无法获取视频信息，请检查BV号或链接是否有效' }] };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_fetch_article
server.tool(
  'kb_fetch_article',
  '从网页文章抓取内容',
  {
    url: z.string().describe('文章链接'),
  },
  async (input) => {
    const result = await fetchArticle(input);
    if (!result) {
      return { content: [{ type: 'text', text: '无法获取文章内容，请检查链接是否有效' }] };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_verify_source
server.tool(
  'kb_verify_source',
  '核查来源可信度。混合策略：外部权威优先+内部互证补充。',
  {
    sourceType: z.string().describe('来源类型：bilibili|article|book|oral'),
    sourceUrl: z.string().optional().describe('来源链接'),
    sourceAuthor: z.string().optional().describe('来源作者'),
    claims: z.string().describe('待核实的具体主张内容'),
    externalVerificationResults: z.string().optional().describe('Claude Code外部搜索核实结果'),
    internalEvidenceCount: z.number().optional().describe('知识库内相关佐证条目数量'),
  },
  async (input) => {
    const result = await verifySource({
      sourceType: input.sourceType as SourceType,
      sourceUrl: input.sourceUrl,
      sourceAuthor: input.sourceAuthor,
      claims: input.claims,
      externalVerificationResults: input.externalVerificationResults,
      internalEvidenceCount: input.internalEvidenceCount,
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// 启动
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

- [ ] **Step 2: 编译验证**

Run: `cd mcp-server && npm run build`
Expected: 编译成功，无 TypeScript 错误

- [ ] **Step 3: Commit**

```bash
git add mcp-server/src/index.ts
git commit -m "feat: add MCP Server entry point registering all 7 tools"
```

---

### Task 12: Claude Code 集成配置

**Files:**
- Modify: `.claude/settings.json` (或 `mcp-server/.claude/settings.json`)

- [ ] **Step 1: 创建 .claude/settings.json 配置 MCP Server**

在项目根目录 `.claude/settings.json` 中添加 MCP Server 配置：

```json
{
  "mcpServers": {
    "china-culture-kb": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "cwd": "d:/china-culture-kb"
    }
  }
}
```

- [ ] **Step 2: 编译并启动 MCP Server**

Run: `cd mcp-server && npm run build`
Expected: 编译成功

- [ ] **Step 3: 重启 Claude Code 验证 MCP 工具可用**

重启 Claude Code 后，7个 kb_* 工具应出现在可用工具列表中。

- [ ] **Step 4: 端到端测试 — 搜索**

在 Claude Code 中输入：`使用 kb_search 搜索关键词"白蛇"`

Expected: 返回包含白蛇传相关条目的搜索结果

- [ ] **Step 5: Commit**

```bash
git add .claude/settings.json
git commit -m "feat: configure Claude Code MCP Server integration for china-culture-kb"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - 7个MCP工具全部覆盖：search(Task4), add-entry(Task5), fetch-video(Task6), fetch-article(Task7), verify-source(Task8), match(Task9), supplement(Task10)
   - 混合核实策略：verify-source(Task8) 实现外部+内部
   - 口述来源：类型定义包含 oral，verify-source 处理 oral 来源
   - 脚本生成：Phase 2 预留，不在 MVP 范围

2. **Placeholder scan:** 无 TBD/TODO/占位符

3. **Type consistency:** types.ts 中定义的类型在所有工具中一致引用