# china-culture-kb Web 版本设计文档

> 版本：v0.2（修订版）
> 日期：2026-06-04
> 面向执行者：Claude Code

---

## 1. 目标

将 china-culture-kb 从纯 MCP Server + CLI 工具升级为 **Web 版本**：
- 普通用户通过浏览器浏览知识库、搜索条目、生成故事
- grears v2 通过 REST API 对接，获取分段脚本（gears_segments）
- MCP Server 保留不动，Web 端通过直接调用其函数实现功能

---

## 2. 架构方案

**Monorepo 一体式：Vue3 + Vite + Express REST API**

- MCP Server（已有）保留不动
- 新增 Express REST API 层，直接调用 MCP 工具函数（不走 MCP 协议）
- 新增 Vue3 前端
- 前后端共享 TypeScript 类型（独立定义，不复用 MCP 旧类型）
- Web 端和 grears v2 对接走普通 REST API，不走 MCP

### 构建方式

| 层 | 构建 | 说明 |
|---|---|---|
| 前端 | Vite | SPA，客户端渲染 |
| 后端 | tsc / tsx / tsup 任选其一 | Express API，独立构建 |
| 第一阶段 | 不做 SSR | 不引入 Vite SSR |

---

## 3. MCP 函数调用约束

Web 后端可以直接 import MCP 工具函数，但有严格约束：

| 规则 | 说明 |
|------|------|
| 只允许 import `mcp-server/src/tools/*` 和 `mcp-server/src/lib/*` 中的纯函数 | 如 `searchKnowledgeBase`、`getFullEntryDetail`、`parseFullEntry` 等 |
| 禁止 import `mcp-server/src/index.ts` | 避免启动 MCP stdio server 副作用 |
| Web API 层通过 `service/mcp-proxy.ts` 做适配 | 不直接把 MCP 返回结构暴露给前端，统一转换为 Web API 类型 |

---

## 4. 项目结构

```text
china-culture-kb/
  data/                        # 知识库数据（已有，不变）
  mcp-server/                  # MCP Server（已有，保留不动）
  web/
    server/
      routes/
        entries.ts             # 条目搜索、详情
        stories.ts             # 故事 plan、generate、列表、详情、gears 输出
        system.ts              # 省份列表、类型枚举
      services/
        story-service.ts       # 故事生成核心逻辑
        entry-service.ts       # 条目读取逻辑
        mcp-proxy.ts           # MCP 工具函数适配层（转换 MCP 类型 → Web API 类型）
      middleware/
        validate.ts            # Zod 校验中间件
        error-handler.ts       # 统一错误处理
        cors.ts                # CORS 配置
      index.ts                 # Express 入口
    client/
      src/
        views/
          Home.vue             # 首页：故事生成主入口 + 知识库总览
          Province.vue         # 省份详情页
          Entry.vue            # 条目详情页
          Search.vue           # 搜索页
          StoryStudio.vue      # 故事生成工作台（左右分栏）
          StoryDetail.vue      # 已生成故事详情
        components/
          StoryPlan.vue        # 预览推荐面板
          StoryResult.vue      # 生成结果展示
          GearsActions.vue     # GEARS 操作按钮组
          EntryCard.vue        # 条目卡片（含生成快捷按钮）
          ProvinceGrid.vue     # 省份网格
        api/
          entries.ts           # 条目 API 调用
          stories.ts           # 故事 API 调用
          system.ts            # 系统 API 调用
        App.vue
        main.ts
        router.ts
      vite.config.ts
      package.json
    shared/
      types.ts                 # Web API 类型定义（独立，不复用 MCP types）
      schemas.ts               # Zod 校验 schema 定义
    package.json               # monorepo 根配置（workspaces）
```

---

## 5. 生成故事文件存储路径

AI 生成内容与知识库事实条目**严格分离**。

```text
web/generated/stories/
  character_story/
  culture_promo/
  scene_short/
```

| 规则 | 说明 |
|------|------|
| 不写入 `data/provinces/` | 知识库事实条目和 AI 生成内容不混淆 |
| 不写入 `data/scripts/` | 旧 MCP 脚本目录也不使用 |
| 按 generation_type 分子目录 | character_story / culture_promo / scene_short |
| storyId 对应文件名 | 如 `20260603-nan-an-zhi-yin.md` 和 `.json` |
| 后续导出到 `D:/故事原型` | 作为第二阶段功能或用户自定义导出目录 |

---

## 6. REST API 设计

### 6.1 设计原则

- **产品语义驱动**，不是 MCP 工具一一映射
- **故事生成是核心产品流程**：plan → generate → gears-segments
- grears v2 通过专用端点拉取分段脚本

### 6.2 统一 API 响应格式

所有 REST API 返回统一格式：

**成功：**

```json
{
  "ok": true,
  "data": {},
  "error": null
}
```

**失败：**

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "ENTRY_NOT_FOUND",
    "message": "未找到条目"
  }
}
```

**常见错误码：**

| 错误码 | 说明 |
|--------|------|
| `ENTRY_NOT_FOUND` | 条目未找到 |
| `INVALID_GENERATION_TYPE` | generation_type 不合法 |
| `INVALID_DURATION` | target_video_duration 不在支持范围 |
| `STORY_GENERATION_FAILED` | 故事生成过程失败 |
| `STORY_NOT_FOUND` | 已生成故事未找到 |
| `GEARS_SEGMENTS_NOT_FOUND` | gears 分段数据未找到 |
| `VALIDATION_ERROR` | 输入校验失败 |
| `INTERNAL_ERROR` | 服务内部错误 |

### 6.3 CORS 配置

Express API 必须支持 CORS，因为 grears v2 需要调用 gears-segments 端点。

**环境变量：**

```text
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

| 规则 | 说明 |
|------|------|
| Web 前端 origin 可访问 | localhost:5173（Vite 默认） |
| grears v2 前端/后端 origin 可访问 | localhost:3000 或自定义端口 |
| 第一阶段允许本地开发 origin | `NODE_ENV=development` 时允许 localhost 通配，生产仍使用 CORS_ORIGINS 白名单 |
| 不要默认 `*` | 生产环境必须使用 CORS_ORIGINS 白名单 |

### 6.4 第一阶段核心 API

#### 条目 `/api/entries`

| 端点 | 方法 | 功能 | 参数 |
|------|------|------|------|
| `/api/entries/search` | GET | 搜索知识库条目 | keywords, type, province, region |
| `/api/entries/detail` | GET | 条目完整详情 | name（query 参数，避免中文 path 编码） |

#### 故事 `/api/stories`

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/stories/plan` | POST | 预览推荐：输入条目名，返回推荐类型/事件/时长/风险 |
| `/api/stories/generate` | POST | 生成完整故事（第一阶段同步返回） |
| `/api/stories` | GET | 已生成故事列表 |
| `/api/stories/:storyId` | GET | 获取完整故事对象 |
| `/api/stories/:storyId/gears-segments` | GET | grears 专用：只拉分段脚本 |

#### 系统 `/api/system`

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/system/provinces` | GET | 34 省份列表 + 条目统计 |
| `/api/system/types` | GET | 类型枚举 + 路由推荐 |

### 6.5 `/api/stories/plan` — 预览推荐

**输入：**

```json
{ "entry_name": "周敦颐——理学开山鼻祖" }
```

**输出（包裹在统一格式中）：**

```json
{
  "ok": true,
  "data": {
    "entry_name": "周敦颐——理学开山鼻祖",
    "entry_type": "历史人物",
    "recommended_types": [
      {
        "generation_type": "character_story",
        "reason": "历史人物条目最适合人物故事",
        "priority": 1
      },
      {
        "generation_type": "scene_short",
        "reason": "月岩濂溪等场景元素可做场景短片",
        "priority": 2
      }
    ],
    "available_events": [
      {
        "event": "南安拒签冤案",
        "conflict_score": 11,
        "recommended_duration": "3分钟",
        "recommended_type": "character_story"
      }
    ],
    "recommended_duration": "3分钟",
    "cultural_risks": [
      "月岩悟道为D级传说，不可写成史实"
    ]
  },
  "error": null
}
```

产品流程：`/plan` → 用户选 type + event → `/generate`

### 6.6 `/api/stories/generate` — 生成接口

**输入：**

```json
{
  "entry_name": "周敦颐——理学开山鼻祖",
  "generation_type": "character_story",
  "selected_event": "南安拒签冤案",
  "target_video_duration": "3分钟",
  "tone": "庄重、紧张、克制",
  "output_gears_segments": true
}
```

`selected_event` 承接 `/plan` 中用户选择的事件，避免后端二次自动选择。

**输出（包裹在统一格式中）：**

```json
{
  "ok": true,
  "data": {
    "storyId": "20260603-nan-an-zhi-yin",
    "title": "南安掷印",
    "generation_type": "character_story",
    "source_entry": "周敦颐——理学开山鼻祖",
    "logline": "...",
    "theme": "...",
    "full_text": "...",
    "scene_breakdown": [...],
    "gears_segments": [...],
    "gears_segments_url": "/api/stories/20260603-nan-an-zhi-yin/gears-segments",
    "cultural_constraints": [...],
    "credibility_note": "..."
  },
  "error": null
}
```

前端和 grears v2 不自行拼接 storyId 或 URL——后端统一返回。

**storyId 规则：**
- 格式：`{生成日期}-{slug}`
- 示例：`20260603-nan-an-zhi-yin`
- 后端统一生成并返回，前端不拼接
- slug 从标题自动生成

**三种 generation_type 的输出差异：**

- `character_story` → 含 characters, act_structure, protagonist arc
- `culture_promo` → 含 visual_symbols, craft_process, modern_connection
- `scene_short` → 含 spatial_identity, visual_route, time_layer

### 6.7 `/api/stories/:storyId/gears-segments` — grears 专用

**输出（包裹在统一格式中）：**

```json
{
  "ok": true,
  "data": {
    "schema_version": "gears-segments/v1",
    "storyId": "20260603-nan-an-zhi-yin",
    "title": "南安掷印",
    "total_duration_sec": 186,
    "segments": [
      {
        "segment_id": 1,
        "source_scene_id": 1,
        "duration_sec": 12,
        "panel_count": 6,
        "script_text": "...",
        "purpose": "建立危机",
        "visual_focus": ["雨水石阶", "木枷囚犯"],
        "cultural_constraints": ["家属和雨夜为影视化创作"]
      }
    ]
  },
  "error": null
}
```

`schema_version` 字段供 grears v2 后续做版本兼容。

### 6.8 异步任务接口（文档预留，第一阶段不实现）

| 端点 | 方法 | 说明 |
|------|------|------|
| `POST /api/stories/jobs` | 创建异步生成任务 | 第一阶段同步返回，此接口仅文档预留 |
| `GET /api/stories/jobs/:jobId` | 查询任务状态 | 第一阶段不实现 |

### 6.9 第二阶段 / 非核心 API（预留路由）

| 端点 | 说明 |
|------|------|
| `POST /api/story-skeletons/generate` | 旧脚本骨架，改名降级 |
| `POST /api/sources/video` | B站视频获取 |
| `POST /api/sources/article` | 文章获取 |
| `POST /api/sources/verify` | 来源可信度验证 |
| `POST /api/entries/match` | 语义匹配 |
| `POST /api/entries/supplement` | 三维度补充 |
| `POST /api/entries` | 条目写入 |

---

## 7. Web API 类型定义

`web/shared/types.ts` 独立定义 Web API 类型，不复用 MCP 旧类型。MCP 类型仅作为内部参考。

### 核心类型

```ts
// generation_type 三种模式
export type GenerationType =
  | 'character_story'
  | 'culture_promo'
  | 'scene_short';

// 统一 API 响应
export interface ApiResponse<T> {
  ok: boolean;
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// 故事生成请求
export interface StoryGenerateRequest {
  entry_name: string;
  generation_type: GenerationType;
  selected_event?: string;         // 承接 /plan 阶段用户选择
  target_video_duration?: string;  // 30秒 / 1分钟 / 3分钟 / 5分钟
  tone?: string;
  output_gears_segments?: boolean;
}

// GEARS segment 固定结构
export interface GearsSegment {
  segment_id: number;
  source_scene_id: number;
  duration_sec: number;
  panel_count: 4 | 6 | 8 | 9 | 10 | 12;
  script_text: string;
  purpose: string;
  visual_focus: string[];
  cultural_constraints: string[];
}
```

---

## 8. Zod 校验要求

核心接口必须使用 Zod 校验输入，尤其是：

| 接口 | 校验重点 |
|------|----------|
| `POST /api/stories/plan` | entry_name 非空 |
| `POST /api/stories/generate` | entry_name 非空、generation_type 合法；selected_event 对 character_story 推荐必填，对 culture_promo / scene_short 可为空 |
| `GET /api/entries/detail` | name 非空 |
| `GET /api/stories/:storyId/gears-segments` | storyId 格式合法 |

### generation_type 校验

```ts
const GenerationTypeSchema = z.enum([
  'character_story',
  'culture_promo',
  'scene_short'
]);
```

### panel_count 校验

```ts
const PanelCountSchema = z.union([
  z.literal(4), z.literal(6), z.literal(8),
  z.literal(9), z.literal(10), z.literal(12)
]);
```

### target_video_duration 第一阶段支持范围

```ts
const DurationSchema = z.enum([
  '30秒', '1分钟', '3分钟', '5分钟'
]);
```

---

## 9. 前端页面设计

### 9.1 首页 `/` — 故事生成为主入口

- **首屏顶部**：大标题 + "开始生成故事"主入口按钮（跳转 `/story/new`）
- **搜索栏**：快速搜索条目
- **知识库统计**：总条目数、类型分布
- **最近生成故事**：已生成故事卡片列表
- **省份浏览**：34 省份网格，每省条目数（次级入口）

### 9.2 故事生成工作台 `/story/new` — 左右分栏

**左侧：输入配置面板**

- 条目搜索 / 输入框
- "预览推荐"按钮 → 调 `/api/stories/plan`
- 三种类型卡片（人物故事 / 文化宣传片 / 场景短片），带推荐 / 可选 / 不推荐标签
- selected_event 选择（从 plan 返回的事件列表中选）
- 参数调节：target_video_duration 下拉、tone 输入
- "生成故事"按钮

**右侧：预览与结果面板**

- 生成中：加载动画
- 生成后：
  - full_text 故事正文（分段渲染）
  - scene_breakdown 场次卡片（时长、地点、剧情）
  - gears_segments 分段表（script_text、duration、panel_count）
  - **GEARS 操作区**（显眼位置）：
    - 📋 复制完整 segments JSON
    - 📋 复制单段 script_text
    - 📥 导出 gears_segments.json
    - 🔗 显示 gears_segments_url
    - 🚀 预留：发送到 grears v2（第一阶段灰显）
  - cultural_constraints + credibility_note 底部信息

### 9.3 条目详情 `/entry?name=xxx`

- 条目完整内容渲染（故事梗概、文化意义、来源、可信度）
- **底部三个生成按钮**（带推荐状态）：
  - ✅ 生成人物故事（推荐）
  - ⭕ 生成文化宣传片（可选）
  - ⭕ 生成场景短片（不推荐 / 可选）
  - 每个按钮跳转 `/story/new?entry=xxx&type=对应类型`
- 来源可信度可视化：可靠 / 基本可靠 / 待核实 / 存疑 + 来源分级 A/B/C/D

### 9.4 搜索结果 `/search`

- 搜索结果卡片列表
- 每张卡片带**"生成故事"快捷按钮** → 跳转 `/story/new?entry=xxx`

### 9.5 省份页 `/province/:name`

- 条目列表按类型分组
- 条目可点击进入详情

### 9.6 故事详情 `/story/:storyId`

- 已生成故事完整展示
- 含 GEARS 操作区（同工作台右侧）

---

## 10. 前端技术栈

| 层 | 技术 |
|---|---|
| 框架 | Vue 3 Composition API |
| 构建 | Vite |
| 路由 | Vue Router 4 |
| 状态 | Pinia |
| UI 组件 | 待选（Element Plus / Naive UI / Ant Design Vue） |
| HTTP | Axios 或 fetch |
| CSS | Tailwind CSS 或组件库自带样式 |
| 类型 | TypeScript（与后端共享 shared/types.ts） |

---

## 11. 后端技术栈

| 层 | 技术 |
|---|---|
| API 服务器 | Express |
| 类型 | TypeScript（ESM） |
| 校验 | Zod |
| MCP 联用 | 直接 import MCP 工具纯函数，通过 mcp-proxy.ts 适配，不走 MCP 协议 |
| 数据存储 | 知识库 Markdown 文件（与 MCP Server 共享同一 data 目录） |
| 故事文件存储 | `web/generated/stories/` 按 generation_type 分子目录 |
| 构建 | tsc / tsx / tsup 任选其一 |
| CORS | cors 中间件，CORS_ORIGINS 环境变量控制 |

---

## 12. 数据流

```text
浏览器 Vue3 前端
        ↓ (HTTP REST / CORS)
Express API Server
        ↓ (mcp-proxy.ts 适配转换)
MCP Server 工具纯函数
  (searchKnowledgeBase / getFullEntryDetail / parseFullEntry / etc.)
        ↓ (fs.readFile / fs.writeFile)
知识库 Markdown 文件 (data/provinces/)

生成故事写入 → web/generated/stories/{generation_type}/

grears v2
        ↓ (HTTP GET / CORS)
/api/stories/:storyId/gears-segments
        ↓
分段 script_text → 分镜 → 故事板
```

---

## 13. 实现优先级

### 第一阶段优先实现（按顺序）

1. Express API 基础服务（入口、CORS、统一响应、Zod 中间件）
2. `/api/entries/search`
3. `/api/entries/detail`
4. `/api/stories/plan`
5. `/api/stories/generate`
6. `/api/stories/:storyId/gears-segments`
7. Vue StoryStudio 页面（工作台）
8. GEARS 操作按钮组

### 暂不实现

| 功能 | 说明 |
|------|------|
| `/api/stories/jobs` | 异步任务接口 |
| `/api/sources/*` | 来源采集 |
| `POST /api/entries` | 条目写入 |
| `/api/story-skeletons/generate` | 旧脚本骨架 |
| 用户认证 | 无认证 |
| 数据库 | 继续用 Markdown |
| SSR | 第一阶段不做 |
| 自动部署 | 本地开发 |

---

## 14. 最终原则

1. **产品语义驱动**：API 和前端围绕"浏览知识库 → 生成故事 → 输出给 grears"这条产品链路设计
2. **MCP Server 保留**：Web 端通过函数调用复用 MCP 能力，只 import 纯函数，禁止 import index.ts
3. **故事生成是核心**：plan → generate → gears-segments 三步链路是产品主线
4. **GEARS 输出显眼**：gears_segments 操作按钮是故事生成工作台的核心出口
5. **共享类型独立定义**：Web API 类型在 shared/types.ts 独立定义，不复用 MCP 旧类型
6. **AI 内容与事实分离**：生成故事存储到 `web/generated/stories/`，不写入知识库 `data/provinces/`
7. **前端不拼接 URL**：storyId 和 gears_segments_url 由后端统一返回
8. **格式版本可演进**：gears-segments 返回 schema_version，grears v2 可做版本兼容