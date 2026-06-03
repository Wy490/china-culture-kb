# 内容获取工具设计：视频录入 + 文化搜集

**日期**：2026-06-01
**范围**：2 个新 MCP 工具 + 来源记录写入模块
**背景**：知识库当前缺少人物传记和文化故事传说，需要工具辅助收集和录入

---

## 1. 架构决策

**选择：方案 A — 两个独立编排工具**

MCP Server 本身不能做 WebSearch/WebFetch（这些是 Claude Code 的能力）。因此两个工具的设计策略是：

- **MCP 工具**：编排流程（获取元数据、创建来源记录、写入条目）
- **Claude Code**：执行内容提取和搜索（观看视频、WebSearch 搜集信息、审核内容）

这样职责分离明确：工具处理结构化编排，Claude Code 处理语义理解。

---

## 2. kb_ingest_video — 视频内容录入编排工具

### 核心理念

一步到位的编排工具。用户提供视频链接 + Claude Code 从视频提取的条目内容，工具自动完成：

1. 调用现有 `fetchVideo` 获取 B站元数据
2. 创建视频来源记录写入 `sources/videos/{BV号}.md`
3. 将条目写入省份文件（带视频来源标注）
4. 返回完整结果

### 输入参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `video_url` | string | 是 | B站视频链接或 BV 号 |
| `name` | string | 是 | 条目名称 |
| `province` | string | 是 | 省份 |
| `region` | string | 是 | 地区 |
| `type` | string | 是 | 条目类型 |
| `summary` | string | 是 | 简介（Claude Code 从视频提取） |
| `story` | string | 是 | 故事梗概（Claude Code 从视频提取） |
| `culturalSignificance` | string | 是 | 文化意义 |
| `relatedLocations` | string | 是 | 相关地点，JSON 数组 |
| `keywords` | string | 是 | 关键词，逗号分隔 |
| `credibility` | string | 是 | 可信度 |
| `unverifiedPoints` | string | 是 | 待核实点，JSON 数组 |
| `verificationMethod` | string | 否 | 核实方法 |

### 工作流程

```
用户 → 提供视频链接 + 内容摘要
  ↓
kb_ingest_video:
  1. fetchVideo(video_url) → 获取元数据
  2. 写入 sources/videos/{BV号}.md → 来源记录
  3. sources 字段自动加上视频来源标识: "B站视频：{BV号} {标题}"
  4. writeEntryToRegionGroup → 写入条目到省份文件（按地区分组）
  5. 返回 { sourceFile, entryFile, videoInfo, entryInfo }
```

### 来源记录格式

`sources/videos/{BV号}.md`：

```markdown
# {标题}

## 视频信息
- **BV号**：{bvId}
- **链接**：{url}
- **UP主**：{ownerName}
- **发布日期**：{publishDate}
- **时长**：{duration}秒

## 内容摘要
（由 Claude Code 从视频提取的内容填充）

## 关联条目
- [[{条目名称}]]
```

### 输出结构

```typescript
interface IngestVideoResult {
  sourceFile: string;       // 来源记录文件路径
  entryFile: string;        // 条目文件路径
  videoInfo: VideoSource;   // 视频元数据
  entryInfo: {              // 条目写入结果
    name: string;
    province: string;
    regionPrefix: string | null;
    grouped: boolean;
  };
}
```

### 错误处理

- 视频链接无效/B站 API 失败 → 抛出错误，提示用户检查链接
- BV 号提取失败 → 抛出错误
- 条目写入失败 → 抛出错误（省份不存在等，与 kb_add_entry 一致）
- 来源记录写入失败 → 不阻断条目写入，条目写入成功后提示来源记录失败

---

## 3. kb_collect — 文化故事搜集编排工具

### 核心理念

用户提供人物/故事名称 + Claude Code 通过 WebSearch/WebFetch 搜集到的原始信息，工具自动完成：

1. 根据来源类型创建来源记录
2. 将条目写入省份文件（带来源标注）
3. 返回完整结果

### 输入参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 人物/故事名称 |
| `province` | string | 是 | 省份 |
| `region` | string | 是 | 地区 |
| `type` | string | 是 | 条目类型（历史人物/神话传说/民间故事等） |
| `summary` | string | 是 | 简介 |
| `story` | string | 是 | 故事梗概/人物传记 |
| `culturalSignificance` | string | 是 | 文化意义 |
| `relatedLocations` | string | 是 | 相关地点，JSON 数组 |
| `keywords` | string | 是 | 关键词 |
| `credibility` | string | 是 | 可信度 |
| `unverifiedPoints` | string | 是 | 待核实点 |
| `verificationMethod` | string | 否 | 核实方法 |
| `source_type` | string | 是 | 来源类型：article/book/oral |
| `source_url` | string | 否 | 来源链接（article 类型时建议提供） |
| `source_title` | string | 是 | 来源标题 |
| `source_author` | string | 否 | 来源作者/讲述人 |

### 工作流程

```
用户 → 提供人物/故事名称 + 搜集到的信息 + 来源信息
  ↓
kb_collect:
  1. 根据 source_type 创建来源记录:
     - article → sources/articles/{title}.md
     - book → sources/books/{title}.md
     - oral → sources/oral/{narrator}-{name}.md
  2. sources 字段自动加上来源标识
  3. writeEntryToRegionGroup → 写入条目到省份文件（按地区分组）
  4. 返回 { sourceFile, entryFile, entryInfo }
```

### 来源标识格式

- article: "文章：{title} ({url})"
- book: "书籍：{title}，作者：{author}"
- oral: "口述：{narrator}，地点：{location}"

### 来源记录格式

**文章来源** (`sources/articles/{title}.md`)：

```markdown
# {标题}

## 文章信息
- **链接**：{url}
- **作者**：{author}
- **平台**：{platform}
- **发布日期**：{date}

## 内容摘要
（Claude Code 搜集的内容要点）

## 关联条目
- [[{条目名称}]]
```

**书籍来源** (`sources/books/{title}.md`)：沿用现有格式（如 大地苍茫-文脉长沙.md）

**口述来源** (`sources/oral/{narrator}-{name}.md`)：沿用 OralSource 类型格式

### 输出结构

```typescript
interface CollectResult {
  sourceFile: string;       // 来源记录文件路径
  entryFile: string;        // 条目文件路径
  entryInfo: {
    name: string;
    province: string;
    regionPrefix: string | null;
    grouped: boolean;
  };
}
```

### 错误处理

- 条目写入失败 → 抛出错误（与 kb_add_entry 一致）
- 来源记录写入失败 → 不阻断条目写入，条目写入成功后提示来源记录失败
- source_type 无效 → 抛出错误

---

## 4. sources.ts — 来源记录写入模块

### 新增库文件

`mcp-server/src/lib/sources.ts`

核心功能：

```typescript
function getSourcesRoot(): string;
// 返回 sources/ 目录根路径（与 getKbRoot() 对称）

async function writeVideoSourceFile(
  source: VideoSource,
  contentSummary: string,
  entryName: string
): Promise<string>;
// 写入 sources/videos/{BV号}.md

async function writeArticleSourceFile(
  source: { url: string; title: string; author: string; platform: string; publishDate: string },
  contentSummary: string,
  entryName: string
): Promise<string>;
// 写入 sources/articles/{title}.md

async function writeBookSourceFile(
  source: { title: string; author: string },
  entryName: string
): Promise<string>;
// 写入 sources/books/{title}.md

async function writeOralSourceFile(
  source: { narrator: string; narratorInfo: string; location: string; date: string; recorder: string },
  storyName: string,
  entryName: string
): Promise<string>;
// 写入 sources/oral/{narrator}-{name}.md
```

### 路径逻辑

- `getSourcesRoot()` 返回 `path.resolve(getKbRoot(), '..', 'sources')`
- 实际路径：`d:/china-culture-kb/sources/`
- 文件名使用中文标题（与省份文件命名风格一致）
- 文件名中的特殊字符（`/`、`\`、`:`、`?`、`*`、`"`）替换为 `-`
- article 来源记录的 `platform` 字段使用现有的 `extractPlatform` 函数自动从 URL 识别

---

## 5. 新增文件

| 文件 | 责责 |
|------|------|
| `src/lib/sources.ts` | 来源记录读写：创建 video/article/book/oral 来源 Markdown 文件 |
| `src/tools/ingest-video.ts` | kb_ingest_video handler |
| `src/tools/collect.ts` | kb_collect handler |
| `src/types.ts` (修改) | 新增 IngestVideoResult, CollectResult |
| `src/index.ts` (修改) | 注册 2 个新工具，版本 0.3.0 |
| `__tests__/ingest-video.test.ts` | 视频录入测试 |
| `__tests__/collect.test.ts` | 搜集录入测试 |
| `__tests__/sources.test.ts` | 来源记录写入测试 |

---

## 6. 测试策略

| 测试文件 | 测试重点 |
|----------|----------|
| `sources.test.ts` | 4 种来源记录文件写入、文件名生成、目录创建 |
| `ingest-video.test.ts` | 视频元数据获取 + 来源创建 + 条目写入编排、BV 号提取失败处理 |
| `collect.test.ts` | 3 种来源类型对应的来源创建 + 条目写入编排、source_type 无效处理 |

---

## 7. 关键设计原则

- **编排不编造**：工具不生成内容，只编排流程（获取元数据、创建文件、写入条目）
- **来源先行**：条目写入成功后，来源记录优先创建，确保可追溯性
- **容错设计**：来源记录写入失败不阻断条目写入，返回结果中标注来源状态
- **地区分组**：两个工具都使用 `writeEntryToRegionGroup` 而非 `writeEntryToProvince`，新条目自动按地区分组