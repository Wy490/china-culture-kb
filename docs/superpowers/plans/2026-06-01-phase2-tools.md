# Phase 2 Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 new MCP tools (kb_generate_script, kb_query_index, kb_add_region_entry) and refactor tool exports to a standardized format.

**Architecture:** Incremental extension of existing MCP Server. Tools export a standardized `{ name, description, schema, handler }` object; index.ts loops through and registers them. New lib modules for script templates and region entry logic.

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk, zod, vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `mcp-server/src/types.ts` | Modify | Add ScriptType, GenerateScriptResult, QueryIndexResult, AddRegionEntryResult |
| `mcp-server/src/index.ts` | Rewrite | Slim: import standardized tool objects, loop-register all 10 tools |
| `mcp-server/src/tools/search.ts` | Modify | Export standardized tool object alongside existing function |
| `mcp-server/src/tools/add-entry.ts` | Modify | Export standardized tool object alongside existing function |
| `mcp-server/src/tools/match.ts` | Modify | Export standardized tool object alongside existing function |
| `mcp-server/src/tools/supplement.ts` | Modify | Export standardized tool object alongside existing function |
| `mcp-server/src/tools/fetch-video.ts` | Modify | Export standardized tool object alongside existing function |
| `mcp-server/src/tools/fetch-article.ts` | Modify | Export standardized tool object alongside existing function |
| `mcp-server/src/tools/verify-source.ts` | Modify | Export standardized tool object alongside existing function |
| `mcp-server/src/lib/scripts.ts` | Create | Script template logic: 4 scene skeletons, entry-to-scene mapping |
| `mcp-server/src/lib/markdown.ts` | Modify | Add extractRegionPrefix, writeEntryToRegionGroup |
| `mcp-server/src/tools/generate-script.ts` | Create | kb_generate_script handler + standardized tool object |
| `mcp-server/src/tools/query-index.ts` | Create | kb_query_index handler + standardized tool object |
| `mcp-server/src/tools/add-region-entry.ts` | Create | kb_add_region_entry handler + standardized tool object |
| `mcp-server/__tests__/generate-script.test.ts` | Create | Tests for script generation |
| `mcp-server/__tests__/query-index.test.ts` | Create | Tests for index query |
| `mcp-server/__tests__/add-region-entry.test.ts` | Create | Tests for region entry |

---

### Task 1: Add Phase 2 type definitions

**Files:**
- Modify: `mcp-server/src/types.ts`

- [ ] **Step 1: Add new types to types.ts**

Append these type definitions after the existing `VerifyResult` interface:

```typescript
export type ScriptType = '纪录片' | '短剧' | '动画' | '文化解说';

export interface GenerateScriptResult {
  filePath: string;
  title: string;
  scriptType: ScriptType;
  entriesUsed: string[];
  sceneCount: number;
  targetDuration: string;
}

export interface QueryIndexResult {
  queryType: 'by_type' | 'by_keyword' | 'by_region';
  filter: string;
  entries: SearchResult[];
  count: number;
  provincesInvolved: string[];
}

export interface AddRegionEntryResult {
  province: string;
  regionPrefix: string | null;
  entryName: string;
  grouped: boolean;
  filePath: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/src/types.ts
git commit -m "feat: add Phase 2 type definitions (ScriptType, GenerateScriptResult, QueryIndexResult, AddRegionEntryResult)"
```

---

### Task 2: Add scripts.ts lib — script template logic

**Files:**
- Create: `mcp-server/src/lib/scripts.ts`

- [ ] **Step 1: Write scripts.ts with scene skeletons and template generation**

```typescript
import { CultureEntry, ScriptType } from '../types.js';

interface SceneSkeleton {
  title: string;
  entrySource: string;
  location?: string;
  culturalNote?: string;
}

const SCENE_TEMPLATES: Record<ScriptType, string[]> = {
  '纪录片': ['开场', '历史背景', '传承现状', '专家采访', '结尾'],
  '短剧': ['起幕', '冲突', '高潮', '化解', '尾声'],
  '动画': ['引入', '冒险/挑战', '转折', '解决', '寓意'],
  '文化解说': ['开场', '习俗概述', '地域差异', '现代演变', '总结'],
};

const DEFAULT_DURATIONS: Record<ScriptType, string> = {
  '纪录片': '30分钟',
  '短剧': '单集20分钟',
  '动画': '单集15分钟',
  '文化解说': '20分钟',
};

function distributeScenes(entries: CultureEntry[], scriptType: ScriptType): SceneSkeleton[] {
  const sceneTitles = SCENE_TEMPLATES[scriptType];

  if (entries.length === 1) {
    const entry = entries[0];
    return sceneTitles.map(title => ({
      title,
      entrySource: entry.name,
      location: entry.relatedLocations[0]?.name,
      culturalNote: entry.culturalSignificance.slice(0, 80),
    }));
  }

  // Multi-entry: distribute 2-3 scenes per entry, cycling through entries
  const scenes: SceneSkeleton[] = [];
  const perEntry = Math.max(2, Math.floor(sceneTitles.length / entries.length));

  for (let i = 0; i < entries.length; i++) {
    const startScene = Math.floor(i * sceneTitles.length / entries.length);
    const endScene = Math.min(startScene + perEntry, sceneTitles.length);
    for (let s = startScene; s < endScene && scenes.length < sceneTitles.length; s++) {
      scenes.push({
        title: sceneTitles[s],
        entrySource: entries[i].name,
        location: entries[i].relatedLocations[0]?.name,
        culturalNote: entries[i].culturalSignificance.slice(0, 80),
      });
    }
  }

  // Fill remaining scenes with last entry
  while (scenes.length < sceneTitles.length) {
    const lastEntry = entries[entries.length - 1];
    scenes.push({
      title: sceneTitles[scenes.length],
      entrySource: lastEntry.name,
      location: lastEntry.relatedLocations[0]?.name,
      culturalNote: lastEntry.culturalSignificance.slice(0, 80),
    });
  }

  return scenes;
}

export function formatScript(
  entries: CultureEntry[],
  scriptType: ScriptType,
  title: string,
  targetDuration: string,
  date: string,
): string {
  const duration = targetDuration || DEFAULT_DURATIONS[scriptType];
  const scenes = distributeScenes(entries, scriptType);
  const entryNames = entries.map(e => e.name).join('、');

  const lines: string[] = [
    `# ${title}`,
    '',
    '## 元信息',
    `- **脚本类型**：${scriptType}`,
    `- **涉及条目**：${entryNames}`,
    `- **目标时长**：${duration}`,
    `- **生成日期**：${date}`,
    '',
    '## 角色列表',
    '（由 Claude Code 根据条目故事梗概填充）',
    '',
    '## 场景列表',
    '',
  ];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    lines.push(`### 场景${i + 1}：${scene.title}`);
    lines.push(`- **时间**：（待填充）`);
    lines.push(`- **地点**：${scene.location || '（待填充）'}`);
    lines.push(`- **视觉描述**：（待填充）`);
    lines.push(`- **对话/解说词**：（待填充）`);
    lines.push(`- **文化注释**：${scene.culturalNote || '（待填充）'}`);
    lines.push(`- **来源追溯**：← ${scene.entrySource}`);
    lines.push('');
  }

  // Cultural annotation summary
  lines.push('## 文化注释汇总');
  lines.push('');
  for (const entry of entries) {
    lines.push(`- **${entry.name}**：${entry.culturalSignificance}`);
  }
  lines.push('');

  // Source traceability table
  lines.push('## 来源追溯表');
  lines.push('');
  lines.push('| 脚本元素 | 来源条目 | 来源章节 |');
  lines.push('|----------|----------|----------|');
  for (const scene of scenes) {
    lines.push(`| 场景${scenes.indexOf(scene) + 1}：${scene.title} | ${scene.entrySource} | 文化意义 |`);
  }
  lines.push('');

  return lines.join('\n');
}

export function deriveTitle(entryNames: string[]): string {
  if (entryNames.length === 1) return entryNames[0];
  return entryNames.join('·') + '——文化脚本';
}

export { SCENE_TEMPLATES, DEFAULT_DURATIONS };
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/src/lib/scripts.ts
git commit -m "feat: add scripts.ts lib with 4 scene skeleton templates and script formatting"
```

---

### Task 3: Add region entry logic to markdown.ts

**Files:**
- Modify: `mcp-server/src/lib/markdown.ts`

- [ ] **Step 1: Add extractRegionPrefix and writeEntryToRegionGroup to markdown.ts**

Add these two functions after the existing `writeEntryToProvince` function:

```typescript
export function extractRegionPrefix(region: string): string | null {
  if (!region || region.trim() === '') return null;
  const trimmed = region.trim();
  // Chinese city names are typically 2-3 characters
  // "岳阳汨罗" → "岳阳" (2 chars), "张家界永定" → "张家界" (3 chars)
  // For names > 3 chars, take first 2 chars as prefix
  const prefix = trimmed.length > 3 ? trimmed.substring(0, 2) : trimmed;
  return prefix;
}

export async function writeEntryToRegionGroup(entry: CultureEntry, province: string): Promise<{ filePath: string; regionPrefix: string | null; grouped: boolean }> {
  const filePath = resolveProvinceFile(province);
  const existing = await fs.readFile(filePath, 'utf-8');
  const entryMarkdown = formatEntry(entry);
  const regionPrefix = extractRegionPrefix(entry.region);

  if (!regionPrefix) {
    // No region prefix — fallback to flat insertion (same as writeEntryToProvince)
    const newFilePath = await writeEntryToProvince(entry, province);
    return { filePath: newFilePath, regionPrefix: null, grouped: false };
  }

  const regionHeader = `### ${regionPrefix}`;
  const regionHeaderIndex = existing.indexOf(regionHeader);

  if (regionHeaderIndex !== -1) {
    // Found existing region group — insert at end of this group
    // Find the next ### heading or end of file after this group
    const afterHeader = regionHeaderIndex + regionHeader.length;
    let insertIndex = existing.length;

    // Look for next ### or ## heading after this group
    const nextSectionRegex = /\n(?:### |## )/g;
    nextSectionRegex.lastIndex = afterHeader;
    const nextSection = nextSectionRegex.exec(existing);
    if (nextSection) {
      insertIndex = nextSection.index;
    }

    const newContent = existing.slice(0, insertIndex) + '\n\n' + entryMarkdown + existing.slice(insertIndex);
    await fs.writeFile(filePath, newContent, 'utf-8');
    return { filePath, regionPrefix, grouped: true };
  }

  // No existing region group — create new one at end of 已整理条目 section
  const marker = '## 已整理条目';
  const markerIndex = existing.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`省份文件 ${province} 缺少"已整理条目"区域`);
  }

  // Find the end of the 已整理条目 section content (last --- delimiter or end of file)
  let sectionEnd = existing.length;
  const lastDelimiter = existing.lastIndexOf('\n---\n', existing.length);
  if (lastDelimiter > markerIndex) {
    sectionEnd = lastDelimiter + 5; // after "\n---\n"
  }

  const newRegionBlock = `\n\n${regionHeader}\n\n${entryMarkdown}`;
  const newContent = existing.slice(0, sectionEnd) + newRegionBlock + existing.slice(sectionEnd);
  await fs.writeFile(filePath, newContent, 'utf-8');
  return { filePath, regionPrefix, grouped: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/src/lib/markdown.ts
git commit -m "feat: add extractRegionPrefix and writeEntryToRegionGroup for region-based entry grouping"
```

---

### Task 4: Create generate-script tool

**Files:**
- Create: `mcp-server/src/tools/generate-script.ts`

- [ ] **Step 1: Write generate-script.ts**

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { CultureEntry, ScriptType, GenerateScriptResult } from '../types.js';
import { readAllProvinceFiles, parseEntries } from '../lib/markdown.js';
import { formatScript, deriveTitle } from '../lib/scripts.js';
import { getKbRoot } from '../lib/provinces.js';

interface GenerateScriptInput {
  entry_names: string;
  script_type: string;
  target_duration?: string;
  title?: string;
}

function getScriptsRoot(): string {
  const kbRoot = getKbRoot();
  return path.resolve(kbRoot, '..', 'scripts');
}

export async function generateScript(input: GenerateScriptInput): Promise<GenerateScriptResult> {
  const entryNames = input.entry_names.split(/[，,、]/).map(n => n.trim()).filter(Boolean);
  const scriptType = input.script_type as ScriptType;
  const title = input.title || deriveTitle(entryNames);
  const targetDuration = input.target_duration || '';
  const date = new Date().toISOString().split('T')[0];

  // Find matching entries
  const allFiles = await readAllProvinceFiles();
  const foundEntries: CultureEntry[] = [];

  for (const [, content] of allFiles) {
    const parsed = parseEntries(content);
    for (const entry of parsed) {
      if (entryNames.includes(entry.name)) {
        // We have SearchResult; need to reconstruct enough CultureEntry fields for template
        // Since parseEntries returns lightweight SearchResult, we use what's available
        foundEntries.push({
          name: entry.name,
          province: entry.province,
          region: entry.region,
          type: entry.type,
          summary: entry.summary,
          story: '（待从完整条目中提取）',
          culturalSignificance: '（待从完整条目中提取）',
          relatedLocations: [],
          keywords: entry.keywords,
          sources: [],
          credibility: entry.credibility,
          unverifiedPoints: [],
        });
      }
    }
  }

  if (foundEntries.length === 0) {
    throw new Error(`未找到匹配的条目：${entryNames.join('、')}`);
  }

  // Generate script markdown
  const scriptMarkdown = formatScript(foundEntries, scriptType, title, targetDuration, date);

  // Write to scripts/{script_type}/{title}.md
  const scriptsRoot = getScriptsRoot();
  const typeDir = path.join(scriptsRoot, scriptType);
  await fs.mkdir(typeDir, { recursive: true });
  const filePath = path.join(typeDir, `${title}.md`);
  await fs.writeFile(filePath, scriptMarkdown, 'utf-8');

  return {
    filePath,
    title,
    scriptType,
    entriesUsed: foundEntries.map(e => e.name),
    sceneCount: Object.keys(require('../lib/scripts.js').SCENE_TEMPLATES).includes(scriptType)
      ? (require('../lib/scripts.js').SCENE_TEMPLATES as Record<string, string[]>)[scriptType].length
      : 5,
    targetDuration: targetDuration || formatScript(foundEntries, scriptType, title, targetDuration, date).match(/目标时长\*{2}：(.+)/)?.[1] || '',
  };
}
```

Wait — that has `require()` which doesn't work in ESM. Let me fix:

```typescript
import { SCENE_TEMPLATES, DEFAULT_DURATIONS } from '../lib/scripts.js';

// ... in the return statement:
const sceneCount = SCENE_TEMPLATES[scriptType]?.length ?? 5;
const resolvedDuration = targetDuration || DEFAULT_DURATIONS[scriptType];
```

Full corrected file:

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { CultureEntry, ScriptType, GenerateScriptResult } from '../types.js';
import { readAllProvinceFiles, parseEntries } from '../lib/markdown.js';
import { formatScript, deriveTitle, SCENE_TEMPLATES, DEFAULT_DURATIONS } from '../lib/scripts.js';
import { getKbRoot } from '../lib/provinces.js';

interface GenerateScriptInput {
  entry_names: string;
  script_type: string;
  target_duration?: string;
  title?: string;
}

function getScriptsRoot(): string {
  const kbRoot = getKbRoot();
  return path.resolve(kbRoot, '..', 'scripts');
}

export async function generateScript(input: GenerateScriptInput): Promise<GenerateScriptResult> {
  const entryNames = input.entry_names.split(/[，,、]/).map(n => n.trim()).filter(Boolean);
  const scriptType = input.script_type as ScriptType;
  const title = input.title || deriveTitle(entryNames);
  const targetDuration = input.target_duration || '';
  const date = new Date().toISOString().split('T')[0];

  // Find matching entries across all province files
  const allFiles = await readAllProvinceFiles();
  const foundEntries: CultureEntry[] = [];

  for (const [, content] of allFiles) {
    const parsed = parseEntries(content);
    for (const entry of parsed) {
      if (entryNames.includes(entry.name)) {
        foundEntries.push({
          name: entry.name,
          province: entry.province,
          region: entry.region,
          type: entry.type,
          summary: entry.summary,
          story: '（待从完整条目中提取）',
          culturalSignificance: '（待从完整条目中提取）',
          relatedLocations: [],
          keywords: entry.keywords,
          sources: [],
          credibility: entry.credibility,
          unverifiedPoints: [],
        });
      }
    }
  }

  if (foundEntries.length === 0) {
    throw new Error(`未找到匹配的条目：${entryNames.join('、')}`);
  }

  const scriptMarkdown = formatScript(foundEntries, scriptType, title, targetDuration, date);

  const scriptsRoot = getScriptsRoot();
  const typeDir = path.join(scriptsRoot, scriptType);
  await fs.mkdir(typeDir, { recursive: true });
  const filePath = path.join(typeDir, `${title}.md`);
  await fs.writeFile(filePath, scriptMarkdown, 'utf-8');

  return {
    filePath,
    title,
    scriptType,
    entriesUsed: foundEntries.map(e => e.name),
    sceneCount: SCENE_TEMPLATES[scriptType]?.length ?? 5,
    targetDuration: targetDuration || DEFAULT_DURATIONS[scriptType],
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/src/tools/generate-script.ts
git commit -m "feat: add kb_generate_script tool handler"
```

---

### Task 5: Create query-index tool

**Files:**
- Create: `mcp-server/src/tools/query-index.ts`

- [ ] **Step 1: Write query-index.ts**

```typescript
import { QueryIndexResult, SearchResult } from '../types.js';
import { readAllProvinceFiles, parseEntries } from '../lib/markdown.js';
import { PROVINCES, findProvinceByName } from '../lib/provinces.js';

interface QueryIndexInput {
  query_type: string;
  filter: string;
  province?: string;
}

export async function queryIndex(input: QueryIndexInput): Promise<QueryIndexResult> {
  const provincesToSearch = input.province
    ? [findProvinceByName(input.province) ?? input.province]
    : PROVINCES;

  const allFiles = await readAllProvinceFiles(provincesToSearch);
  const allEntries: SearchResult[] = [];

  for (const [province, content] of allFiles) {
    const entries = parseEntries(content);
    allEntries.push(...entries);
  }

  let filtered: SearchResult[];
  switch (input.query_type) {
    case 'by_type':
      filtered = allEntries.filter(e => e.type === input.filter);
      break;
    case 'by_keyword':
      filtered = allEntries.filter(e => e.keywords.some(kw => kw === input.filter));
      break;
    case 'by_region':
      filtered = allEntries.filter(e => e.region.includes(input.filter));
      break;
    default:
      throw new Error(`不支持的查询类型：${input.query_type}。支持：by_type, by_keyword, by_region`);
  }

  const provincesInvolved = [...new Set(filtered.map(e => e.province))];

  return {
    queryType: input.query_type as QueryIndexResult['queryType'],
    filter: input.filter,
    entries: filtered,
    count: filtered.length,
    provincesInvolved,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/src/tools/query-index.ts
git commit -m "feat: add kb_query_index tool handler"
```

---

### Task 6: Create add-region-entry tool

**Files:**
- Create: `mcp-server/src/tools/add-region-entry.ts`

- [ ] **Step 1: Write add-region-entry.ts**

```typescript
import { CultureEntry, AddRegionEntryResult } from '../types.js';
import { writeEntryToRegionGroup } from '../lib/markdown.js';
import { findProvinceByName } from '../lib/provinces.js';

const REQUIRED_FIELDS: (keyof CultureEntry)[] = [
  'name', 'province', 'region', 'type', 'summary',
  'story', 'culturalSignificance', 'relatedLocations',
  'keywords', 'sources', 'credibility', 'unverifiedPoints',
];

export async function addRegionEntry(entry: CultureEntry): Promise<AddRegionEntryResult> {
  for (const field of REQUIRED_FIELDS) {
    if (entry[field] === undefined || entry[field] === null || entry[field] === '') {
      throw new Error(`缺少必填字段：${field}`);
    }
  }

  const provinceName = findProvinceByName(entry.province);
  if (!provinceName) {
    throw new Error(`无效省份：${entry.province}`);
  }

  const result = await writeEntryToRegionGroup(entry, provinceName);
  return {
    province: provinceName,
    regionPrefix: result.regionPrefix,
    entryName: entry.name,
    grouped: result.grouped,
    filePath: result.filePath,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/src/tools/add-region-entry.ts
git commit -m "feat: add kb_add_region_entry tool handler"
```

---

### Task 7: Rewrite index.ts — slim registration with all 10 tools

**Files:**
- Rewrite: `mcp-server/src/index.ts`

- [ ] **Step 1: Rewrite index.ts**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { searchKnowledgeBase } from './tools/search.js';
import { addEntry } from './tools/add-entry.js';
import { matchEntries } from './tools/match.js';
import { supplement } from './tools/supplement.js';
import { fetchVideo, extractBvId } from './tools/fetch-video.js';
import { fetchArticle, extractPlatform } from './tools/fetch-article.js';
import { verifySource } from './tools/verify-source.js';
import { generateScript } from './tools/generate-script.js';
import { queryIndex } from './tools/query-index.js';
import { addRegionEntry } from './tools/add-region-entry.js';
import { CultureEntry, SourceType, ScriptType } from './types.js';

const server = new McpServer({
  name: 'china-culture-kb',
  version: '0.2.0',
});

// kb_search
server.tool(
  'kb_search',
  '按关键词、类型、省份、地区检索知识库',
  {
    keywords: z.string().describe('搜索关键词，多个关键词用逗号或空格分隔'),
    type: z.string().optional().describe('条目类型过滤'),
    province: z.string().optional().describe('省份过滤'),
    region: z.string().optional().describe('地区/城市过滤'),
  },
  async (input) => {
    const results = await searchKnowledgeBase(input);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  }
);

// kb_add_entry
server.tool(
  'kb_add_entry',
  '写入文化条目到省份文件',
  {
    name: z.string().describe('条目名称'),
    province: z.string().describe('省份'),
    region: z.string().describe('地区/城市'),
    type: z.string().describe('类型'),
    summary: z.string().describe('简介'),
    story: z.string().describe('故事梗概'),
    culturalSignificance: z.string().describe('文化意义'),
    relatedLocations: z.string().describe('相关地点，JSON数组'),
    keywords: z.string().describe('关键词，逗号分隔'),
    sources: z.string().describe('来源列表，JSON数组'),
    credibility: z.string().describe('可信度'),
    verificationMethod: z.string().optional().describe('核实方法标注'),
    unverifiedPoints: z.string().describe('待核实点，JSON数组'),
  },
  async (input) => {
    const entry: CultureEntry = {
      name: input.name,
      province: input.province,
      region: input.region,
      type: input.type as CultureEntry['type'],
      summary: input.summary,
      story: input.story,
      culturalSignificance: input.culturalSignificance,
      relatedLocations: JSON.parse(input.relatedLocations),
      keywords: input.keywords.split(/[，,、]/),
      sources: JSON.parse(input.sources),
      credibility: input.credibility as CultureEntry['credibility'],
      verificationMethod: input.verificationMethod,
      unverifiedPoints: JSON.parse(input.unverifiedPoints),
    };
    const result = await addEntry(entry);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// kb_match
server.tool(
  'kb_match',
  '语义匹配知识库条目，返回条目供Claude Code做语义分析',
  {
    storyText: z.string().describe('用户上传的故事或观点文本'),
    provinceHints: z.string().optional().describe('地理线索省份，逗号分隔'),
    typeHint: z.string().optional().describe('类型判断'),
  },
  async (input) => {
    const result = await matchEntries({
      storyText: input.storyText,
      provinceHints: input.provinceHints?.split(/[，,]/) ?? undefined,
      typeHint: input.typeHint,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// kb_supplement
server.tool(
  'kb_supplement',
  '三维度补充：版本差异、同地同类、关联网络',
  {
    entryName: z.string().optional().describe('条目名称'),
    storyText: z.string().optional().describe('故事文本'),
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
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// kb_fetch_video
server.tool(
  'kb_fetch_video',
  '从B站视频抓取内容信息',
  {
    bvId: z.string().optional().describe('BV号'),
    url: z.string().optional().describe('B站视频链接'),
  },
  async (input) => {
    const result = await fetchVideo(input);
    if (!result) {
      return { content: [{ type: 'text', text: '无法获取视频信息，请检查BV号或链接' }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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
      return { content: [{ type: 'text', text: '无法获取文章内容，请检查链接' }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// kb_verify_source
server.tool(
  'kb_verify_source',
  '核查来源可信度。混合策略：外部权威优先+内部互证补充',
  {
    sourceType: z.string().describe('来源类型：bilibili|article|book|oral'),
    sourceUrl: z.string().optional().describe('来源链接'),
    sourceAuthor: z.string().optional().describe('来源作者'),
    claims: z.string().describe('待核实主张内容'),
    externalVerificationResults: z.string().optional().describe('外部搜索核实结果'),
    internalEvidenceCount: z.number().optional().describe('知识库内佐证条目数量'),
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
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// kb_generate_script
server.tool(
  'kb_generate_script',
  '从知识库条目生成脚本骨架（纪录片/短剧/动画/文化解说），供Claude Code填充内容',
  {
    entry_names: z.string().describe('条目名称列表，逗号或顿号分隔'),
    script_type: z.string().describe('脚本类型：纪录片/短剧/动画/文化解说'),
    target_duration: z.string().optional().describe('目标时长，如"30分钟"'),
    title: z.string().optional().describe('脚本标题'),
  },
  async (input) => {
    const result = await generateScript({
      entry_names: input.entry_names,
      script_type: input.script_type as ScriptType,
      target_duration: input.target_duration,
      title: input.title,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// kb_query_index
server.tool(
  'kb_query_index',
  '动态查询索引：按类型/关键词/地区聚合条目',
  {
    query_type: z.string().describe('查询维度：by_type/by_keyword/by_region'),
    filter: z.string().describe('过滤值，如"神话传说"、"端午"、"岳阳"'),
    province: z.string().optional().describe('限定省份范围'),
  },
  async (input) => {
    const result = await queryIndex({
      query_type: input.query_type,
      filter: input.filter,
      province: input.province,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// kb_add_region_entry
server.tool(
  'kb_add_region_entry',
  '按地区分组写入文化条目到省份文件（三级标题分组）',
  {
    name: z.string().describe('条目名称'),
    province: z.string().describe('省份'),
    region: z.string().describe('地区/城市'),
    type: z.string().describe('类型'),
    summary: z.string().describe('简介'),
    story: z.string().describe('故事梗概'),
    culturalSignificance: z.string().describe('文化意义'),
    relatedLocations: z.string().describe('相关地点，JSON数组'),
    keywords: z.string().describe('关键词，逗号分隔'),
    sources: z.string().describe('来源列表，JSON数组'),
    credibility: z.string().describe('可信度'),
    verificationMethod: z.string().optional().describe('核实方法标注'),
    unverifiedPoints: z.string().describe('待核实点，JSON数组'),
  },
  async (input) => {
    const entry: CultureEntry = {
      name: input.name,
      province: input.province,
      region: input.region,
      type: input.type as CultureEntry['type'],
      summary: input.summary,
      story: input.story,
      culturalSignificance: input.culturalSignificance,
      relatedLocations: JSON.parse(input.relatedLocations),
      keywords: input.keywords.split(/[，,、]/),
      sources: JSON.parse(input.sources),
      credibility: input.credibility as CultureEntry['credibility'],
      verificationMethod: input.verificationMethod,
      unverifiedPoints: JSON.parse(input.unverifiedPoints),
    };
    const result = await addRegionEntry(entry);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/src/index.ts
git commit -m "feat: register all 10 MCP tools including 3 new Phase 2 tools, bump version to 0.2.0"
```

---

### Task 8: Write tests for generate-script

**Files:**
- Create: `mcp-server/__tests__/generate-script.test.ts`

- [ ] **Step 1: Write generate-script tests**

```typescript
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

  fs.mkdirSync(path.join(tmpDir, '..', 'scripts', '纪录片'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '..', 'scripts', '短剧'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '..', 'scripts', '动画'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '..', 'scripts', '文化解说'), { recursive: true });
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
      keywords: ['白蛇', '许仙'], sources: [], credibility: '基本可靠', unverifiedPoints: [],
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
      relatedLocations: [], keywords: [], sources: [], credibility: '基本可靠', unverifiedPoints: [],
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
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/__tests__/generate-script.test.ts
git commit -m "test: add generate-script tests for lib and tool"
```

---

### Task 9: Write tests for query-index

**Files:**
- Create: `mcp-server/__tests__/query-index.test.ts`

- [ ] **Step 1: Write query-index tests**

```typescript
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
    expect(result.count).toBe(2); // 白蛇传 in 浙江 + 江苏
    expect(result.provincesInvolved).toContain('浙江');
    expect(result.provincesInvolved).toContain('江苏');
  });

  it('should query by keyword exactly', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await queryIndex({ query_type: 'by_keyword', filter: '白蛇' });
    expect(result.count).toBe(2); // matches keyword "白蛇" in both 白蛇传 entries
  });

  it('should query by region with substring match', async () => {
    process.env.KB_ROOT = tmpDir;
    const result = await queryIndex({ query_type: 'by_region', filter: '苏州' });
    expect(result.count).toBe(2); // 柳毅传书 + 白蛇传(江苏版)
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
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/__tests__/query-index.test.ts
git commit -m "test: add query-index tests for all 3 query dimensions"
```

---

### Task 10: Write tests for add-region-entry and markdown region logic

**Files:**
- Create: `mcp-server/__tests__/add-region-entry.test.ts`

- [ ] **Step 1: Write add-region-entry tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { extractRegionPrefix, writeEntryToRegionGroup } from '../src/lib/markdown.js';
import { addRegionEntry } from '../src/tools/add-region-entry.js';
import { CultureEntry } from '../src/types.js';

const tmpDir = path.join(os.tmpdir(), 'kb-region-test-' + Date.now());

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

describe('extractRegionPrefix', () => {
  it('should extract 2-char prefix from 4-char region', () => {
    expect(extractRegionPrefix('岳阳汨罗')).toBe('岳阳');
  });

  it('should keep 2-char region as-is', () => {
    expect(extractRegionPrefix('湘西')).toBe('湘西');
  });

  it('should keep 3-char region as-is', () => {
    expect(extractRegionPrefix('张家界')).toBe('张家界');
  });

  it('should return null for empty region', () => {
    expect(extractRegionPrefix('')).toBeNull();
    expect(extractRegionPrefix('  ')).toBeNull();
  });

  it('should extract 2-char prefix from >3 char region', () => {
    expect(extractRegionPrefix('呼和浩特新城区')).toBe('呼和');
  });
});

describe('writeEntryToRegionGroup', () => {
  it('should append to existing region group', async () => {
    process.env.KB_ROOT = tmpDir;
    const entry: CultureEntry = {
      name: '洞庭湖传说',
      province: '湖南',
      region: '岳阳',
      type: '民间故事',
      summary: '洞庭湖的传说故事。',
      story: '详细故事...',
      culturalSignificance: '反映了湖区文化。',
      relatedLocations: [{ name: '洞庭湖', description: '传说发生地' }],
      keywords: ['洞庭湖', '传说'],
      sources: ['口述资料'],
      credibility: '待核实',
      unverifiedPoints: [],
    };
    const result = await writeEntryToRegionGroup(entry, '湖南');
    expect(result.regionPrefix).toBe('岳阳');
    expect(result.grouped).toBe(true);

    const content = fs.readFileSync(path.join(tmpDir, 'provinces', '湖南.md'), 'utf-8');
    expect(content).toContain('## 洞庭湖传说');
    // The new entry should be in the 岳阳 group (after existing 屈原投江条目)
    const yangyangIndex = content.indexOf('### 岳阳');
    const newEntryIndex = content.indexOf('## 洗庭湖传说');
    expect(newEntryIndex).toBeGreaterThan(yangyangIndex);
  });

  it('should create new region group when none exists', async () => {
    process.env.KB_ROOT = tmpDir;
    const entry: CultureEntry = {
      name: '炎帝神农氏',
      province: '湖南',
      region: '株洲炎陵',
      type: '神话传说',
      summary: '炎帝神农氏的故事。',
      story: '炎帝在株洲的传说...',
      culturalSignificance: '中华文明始祖之一。',
      relatedLocations: [{ name: '炎帝陵', description: '炎帝陵墓所在地' }],
      keywords: ['炎帝', '神农'],
      sources: ['书籍：炎帝传说'],
      credibility: '基本可靠',
      unverifiedPoints: [],
    };
    const result = await writeEntryToRegionGroup(entry, '湖南');
    expect(result.regionPrefix).toBe('株洲');
    expect(result.grouped).toBe(true);

    const content = fs.readFileSync(path.join(tmpDir, 'provinces', '湖南.md'), 'utf-8');
    expect(content).toContain('### 株洲');
    expect(content).toContain('## 炎帝神农氏');
  });

  it('should fallback to flat insertion when region is empty', async () => {
    process.env.KB_ROOT = tmpDir;
    const entry: CultureEntry = {
      name: '湖南总传说',
      province: '湖南',
      region: '',
      type: '地方掌故',
      summary: '湖南地区通用传说。',
      story: '故事...',
      culturalSignificance: '湖南文化。',
      relatedLocations: [],
      keywords: ['湖南'],
      sources: [],
      credibility: '待核实',
      unverifiedPoints: [],
    };
    const result = await writeEntryToRegionGroup(entry, '湖南');
    expect(result.regionPrefix).toBeNull();
    expect(result.grouped).toBe(false);
  });
});

describe('kb_add_region_entry', () => {
  it('should add entry with region grouping', async () => {
    process.env.KB_ROOT = tmpDir;
    const entry: CultureEntry = {
      name: '洞庭湖传说',
      province: '湖南',
      region: '岳阳',
      type: '民间故事',
      summary: '洞庭湖的传说。',
      story: '故事内容...',
      culturalSignificance: '湖区文化。',
      relatedLocations: [{ name: '洞庭湖', description: '传说发生地' }],
      keywords: ['洞庭湖'],
      sources: ['口述'],
      credibility: '待核实',
      unverifiedPoints: [],
    };
    const result = await addRegionEntry(entry);
    expect(result.province).toBe('湖南');
    expect(result.regionPrefix).toBe('岳阳');
    expect(result.grouped).toBe(true);
    expect(result.entryName).toBe('洞庭湖传说');
  });

  it('should reject entry with missing fields', async () => {
    process.env.KB_ROOT = tmpDir;
    const entry = { name: '测试' } as any;
    await expect(addRegionEntry(entry)).rejects.toThrow('缺少必填字段');
  });

  it('should reject invalid province', async () => {
    process.env.KB_ROOT = tmpDir;
    const entry: CultureEntry = {
      name: '测试', province: '不存在的省', region: '某地', type: '神话传说',
      summary: '测试', story: '测试', culturalSignificance: '测试',
      relatedLocations: [], keywords: [], sources: [], credibility: '待核实',
      unverifiedPoints: [],
    };
    await expect(addRegionEntry(entry)).rejects.toThrow('无效省份');
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/__tests__/add-region-entry.test.ts
git commit -m "test: add region entry tests for prefix extraction, grouping, and tool"
```

---

### Task 11: Build, run all tests, verify

- [ ] **Step 1: Build the project**

```bash
cd d:/china-culture-kb/mcp-server && npm run build
```

Expected: Successful TypeScript compilation, no errors.

- [ ] **Step 2: Run all tests**

```bash
cd d:/china-culture-kb/mcp-server && npm run test
```

Expected: All existing + new tests pass.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 2 tools — generate_script, query_index, add_region_entry"
```