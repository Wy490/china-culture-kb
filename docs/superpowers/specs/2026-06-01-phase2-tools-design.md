...# Phase 2 软件功能设计：脚本生成、索引查询、地区分组

**日期**：2026-06-01
**范围**：3 个新 MCP 工具 + 轻量代码组织改进
**不在本次范围**：省份数据填充、来源目录填充（后续内容工作）

---

## 1. 架构决策

### 选择：增量扩展（方案 A）

在现有 MCP Server 中直接新增 3 个工具，沿用已有的注册模式、类型定义模式、工具库模式。同时做轻量文件拆分，将 handler 逻辑从 `index.ts` 移到 `tools/` 目录，`index.ts` 只负责导入和注册。

**理由**：
- 现有架构成熟稳定，10 个工具完全可承载
- 轻量拆分解决了 `index.ts` 膨胀问题，不改变整体架构
- Claude Code 无需额外配置（settings.json 已注册 MCP Server）

---

## 2. kb_generate_script — 脚本生成工具

### 核心理念

**工具提供骨架，Claude Code 填充灵魂。** MCP 工具负责读取条目、组装结构化模板骨架、标注来源追溯、写入脚本文件。具体内容（解说词、对话、场景描写）由 Claude Code 在对话中逐步填充。

### 输入参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `entry_names` | string | 是 | 条目名称列表，中文逗号/顿号分隔 |
| `script_type` | string | 是 | 纪录片/短剧/动画/文化解说 |
| `target_duration` | string | 否 | 目标时长（如"30分钟"、"5集×20分钟"），不填则默认 |
| `title` | string | 否 | 脚本标题，不填则从条目名称组合推导 |

### 输出

脚本文件写入 `scripts/{script_type}/{title}.md`。

### 脚本文件格式

```markdown
# {标题}

## 元信息
- **脚本类型**：{script_type}
- **涉及条目**：{entry_names}
- **目标时长**：{target_duration}
- **生成日期**：{date}

## 角色列表
（由 Claude Code 根据条目故事梗概填充）

## 场景列表

### 场景1：{场景标题}
- **时间**：（待填充）
- **地点**：{从条目相关地点提取}
- **视觉描述**：（待填充）
- **对话/解说词**：（待填充）
- **文化注释**：{从条目文化意义提取}
- **来源追溯**：← {条目名称}

### 场景2：...

## 文化注释汇总
（汇总所有条目的文化意义要点，每条标注来源）

## 来源追溯表
| 脚本元素 | 来源条目 | 来源章节 |
|----------|----------|----------|
```

### 4 种脚本类型的场景骨架模板

| 类型 | 场景结构 | 默认时长 | 对应条目类型 |
|------|----------|----------|------------|
| 纪录片 | 开场→历史背景→传承现状→专家采访→结尾 | 30分钟 | 非遗、传统工艺 |
| 短剧 | 起幕→冲突→高潮→化解→尾声 | 单集20分钟 | 民间故事、地方掌故 |
| 动画 | 引入→冒险/挑战→转折→解决→寓意 | 单集15分钟 | 神话传说 |
| 文化解说 | 开场→习俗概述→地域差异→现代演变→总结 | 20分钟 | 节庆习俗、饮食文化 |

### 实现逻辑

1. 解析 `entry_names`，按中文逗号/顿号分隔为名称数组
2. 遍历所有省份文件，解析条目，找到名称匹配的条目
3. 根据条目数量和 `script_type`，选择对应的场景骨架模板
4. 为每个场景填充可从条目提取的结构化数据（地点、文化注释、来源标记）
5. 标记待填充字段为"（待填充）"
6. 生成脚本 Markdown 并写入 `scripts/{script_type}/{title}.md`
7. 返回生成结果摘要（文件路径、涉及条目、场景数量）

### 关键设计原则

- **来源追溯**：每个场景标注 `← {条目名称}`，确保文化准确性可追溯
- **骨架不编造**：工具只从条目提取结构化信息，不生成创意内容
- **跨条目融合**：多个条目时按时间线/主题线排列场景骨架，融合由 Claude Code 完成
- **多条目场景分配**：1 个条目 → 所有场景围绕该条目；N 个条目 → 每个条目分配 2-3 个核心场景

### 新增类型定义

```typescript
type ScriptType = '纪录片' | '短剧' | '动画' | '文化解说';

interface GenerateScriptResult {
  filePath: string;
  title: string;
  scriptType: ScriptType;
  entriesUsed: string[];
  sceneCount: number;
  targetDuration: string;
}
```

---

## 3. kb_query_index — 索引动态查询工具

### 核心理念

纯动态查询——不预生成静态索引文件，查询时实时扫描所有省份文件并聚合结果。当前条目数量不大（34省份×几十条目），全扫描性能完全可接受。避免了索引同步问题。

### 输入参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query_type` | string | 是 | 查询维度：by_type/by_keyword/by_region |
| `filter` | string | 是 | 具体过滤值（如"神话传说"、"端午"、"岳阳"） |
| `province` | string | 否 | 限定省份范围 |

### 查询逻辑

**by_type**：扫描所有省份文件 → 解析条目 → 过滤 `type === filter` → 返回结果集

**by_keyword**：扫描所有省份文件 → 解析条目 → 过滤 `keywords` 数组包含 `filter`（精确匹配数组元素）→ 返回结果集

**by_region**：扫描指定省份或所有省份文件 → 解析条目 → 过滤 `region` 字段包含 `filter`（子串匹配）→ 返回结果集

### 输出结构

```typescript
interface QueryIndexResult {
  queryType: 'by_type' | 'by_keyword' | 'by_region';
  filter: string;
  entries: SearchResult[];
  count: number;
  provincesInvolved: string[];
}
```

### 实现要点

- 复用现有 `readAllProvinceFiles()` 和 `parseEntries()` 函数
- 不新增文件到 `indexes/` 目录——纯动态查询
- 如果未来条目数量增长影响性能，可增加缓存层或切换到静态索引方案

---

## 4. kb_add_region_entry — 地区分组写入工具

### 核心理念

保持省份文件为主存储，不做独立地区文件。在省份文件的 **已整理条目** 区域内，用三级标题按地区分组条目。

### 当前 vs 目标格式

**当前**（条目平铺）：
```markdown
## 已整理条目
<!-- entries -->
---
## 屈原投江汨罗——端午节起源
...
---
## 炎帝神农氏
...
```

**目标**（按地区三级标题分组）：
```markdown
## 已整理条目
<!-- entries -->

### 岳阳
---
## 屈原投江汨罗——端午节起源
...

### 长沙
---
## 炎帝神农氏
...
```

### 输入参数

与 `kb_add_entry` 完全一致（12 个 CultureEntry 字段），额外隐含逻辑：写入时自动根据 `entry.region` 字段找到或创建对应的三级标题分组。

### 写入逻辑

1. 读取省份文件
2. 提取地区前缀：取 `region` 字段的第一个地理单位（如"岳阳汨罗"→"岳阳"，"长沙宁乡"→"长沙"）
3. 在 `已整理条目` 区域内查找 `### {地区前缀}` 三级标题
4. 找到 → 在该分组末尾插入条目
5. 未找到 → 在 `已整理条目` 区域末尾创建新 `### {地区前缀}` 分组并写入条目
6. 如果 `region` 字段为空或无法提取前缀 → 按原有平铺方式写入（兼容旧格式）

### 兼容性

- 现有没有地区分组的条目保持不变
- 新写入的条目自动按地区分组
- `kb_query_index` 的 `by_region` 查询基于条目 `region` 字段，与文件内分组标题无关，自动兼容

### 地区前缀提取逻辑

采用简单策略，不依赖硬编码市级单位列表：

```typescript
function extractRegionPrefix(region: string): string | null {
  if (!region || region.trim() === '') return null;
  // 取前 2-3 个字作为地区前缀（中国地名市级单位通常是 2-3 字）
  // 如 "岳阳汨罗" → "岳阳"，"长沙宁乡" → "长沙"
  // 如 "湘西" → "湘西"（2字地名）
  const prefix = region.trim().substring(0, region.trim().length > 3 ? 2 : region.trim().length);
  return prefix;
}
```

实际效果：绝大多数中国地级市名是 2 字（岳阳、长沙、株洲），少数是 3 字（张家界、呼和浩特）。2-3字前缀策略覆盖了主要情况。对于 3 字市级单位，可以在后续迭代中增加硬编码映射表优化。

### 新增类型定义

```typescript
interface AddRegionEntryResult {
  province: string;
  regionPrefix: string | null;
  entryName: string;
  grouped: boolean;  // 是否成功归入地区分组
  filePath: string;
}
```

---

## 5. 代码组织改进

### 目标文件结构

```
mcp-server/src/
  index.ts              — 只负责导入和注册工具（~50行）
  types.ts              — 类型定义（新增脚本、索引相关类型）
  lib/
    provinces.ts        — 不变
    markdown.ts         — 新增地区分组写入逻辑（extractRegionPrefix, writeEntryToRegionGroup）
    templates.ts        — 不变
    bilibili.ts         — 不变
    scripts.ts          — 新增：脚本模板生成逻辑（4种类型模板、场景骨架组装）
  tools/
    search.ts           — 从 index.ts 抽出的 kb_search handler
    add-entry.ts        — 抽出的 kb_add_entry handler
    match.ts            — 抽出的 kb_match handler
    supplement.ts       — 抽出的 kb_supplement handler
    fetch-video.ts      — 抽出的 kb_fetch_video handler
    fetch-article.ts    — 抽出的 kb_fetch_article handler
    verify-source.ts    — 抽出的 kb_verify_source handler
    generate-script.ts  — 新增：kb_generate_script handler
    query-index.ts      — 新增：kb_query_index handler
    add-region-entry.ts — 新增：kb_add_region_entry handler
```

### tools/*.ts 导出格式

每个工具文件导出统一结构：

```typescript
export const tool = {
  name: 'kb_search',
  description: '搜索知识库条目...',
  schema: { keyword: z.string(), ... },
  handler: async (input) => { ... }
};
```

`index.ts` 循环注册：

```typescript
import { tool as searchTool } from './tools/search';
// ... 其他导入

const tools = [searchTool, addEntryTool, ...generateScriptTool, queryIndexTool, addRegionEntryTool];
tools.forEach(t => server.tool(t.name, t.description, t.schema, t.handler));
```

---

## 6. 测试策略

沿用现有 Vitest 模式，每个新工具一个测试文件：

| 测试文件 | 测试重点 |
|----------|----------|
| `generate-script.test.ts` | 条目读取、4种模板组装、多条目场景分配、文件写入、来源追溯标注 |
| `query-index.test.ts` | 三种查询维度、空结果处理、跨省份聚合、省份限定 |
| `add-region-entry.test.ts` | 地区分组创建、地区分组追加、地区前缀提取、空 region 兼容、与原有 kb_add_entry 行为对比 |

---

## 7. 新增目录

| 目录 | 用途 |
|------|------|
| `scripts/纪录片/` | 纪录片脚本输出 |
| `scripts/短剧/` | 短剧脚本输出 |
| `scripts/动画/` | 动画脚本输出 |
| `scripts/文化解说/` | 文化解说脚本输出 |

脚本文件命名规则：标题直接作为文件名（中文标题，与省份文件命名风格一致）。如 `scripts/纪录片/屈原投江汨罗——端午节起源.md`。如果 `title` 参数未提供，工具从条目名称组合推导标题。