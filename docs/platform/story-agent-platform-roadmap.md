# 通用故事创作 Agent 平台路线图

> 版本：v0.1 — 规划阶段
> 日期：2026-06-05
> 状态：待评审，不执行任何代码变更
> 分支：`story-platform-planning`
> 锚点：`checkpoint-2026-06-05-china-culture-web-v1`（当前 china-culture-kb Web v1 完整快照）

---

## 1. 现状分析：china-culture-kb Web v1

### 1.1 已实现功能

| 功能 | 实现内容 | 关键文件 |
|------|---------|----------|
| Monorepo 脚手架 | Express + Vue3 + shared types | `web/package.json`, tsconfigs |
| 3 类型故事生成 | `character_story` / `culture_promo` / `scene_short` | `story-service.ts` |
| 内容自动填充 | 从 KB 条目填充 logline / full_text / scene_breakdown / gears_segments | `story-service.ts` |
| StoryScene 扩展 | title, time_of_day, dramatic_function, plot, visual_prompt, camera_suggestion, cultural_note | `shared/types.ts` |
| GEARS 输出 | gears_segments + gears_segments_url + GearsActions 操作按钮组 | `GearsActions.vue`, `story-service.ts` |
| 条目搜索与详情 | search / detail + province / region 过滤 | `entry-service.ts`, `entries.ts` |
| 系统枚举 | 34 省份列表 + 12 类型枚举 + 类型→生成类型路由表 | `system.ts` |
| Zod 校验 | 全核心接口输入校验 | `shared/schemas.ts` |
| 统一响应格式 | `ApiResponse<T>` + 错误码体系 | `shared/types.ts` |
| CORS 跨域 | grears v2 可跨域消费 gears-segments 端点 | `cors.ts` |
| MCP 函数复用 | 通过 mcp-proxy.ts 直接 import MCP 纯函数，不走 stdio 协议 | `mcp-proxy.ts` |

### 1.2 代码中深嵌的领域假设

当前 v1 约 **70-75% 的代码是领域专用**的，具体体现在：

| 类别 | 硬编码内容 | 通用程度 |
|------|-----------|---------|
| **条目类型枚举** | 12 个中国文化分类（历史人物、神话传说、非遗、节庆习俗、地方戏曲、饮食文化、传统工艺、名胜古迹、地方掌故、宗教信仰、民俗活动） | 完全领域专用 |
| **数据组织** | 34 省份 markdown 文件（`data/provinces/{省名}.md`） | 完全领域专用 |
| **markdown 解析** | 中文字段正则（`**省份**：`、`**地区**：`、`### 故事梗概`、`### 文化意义`） | 完全领域专用 |
| **可信度体系** | 四级中文标签（可靠 / 基本可靠 / 待核实 / 存疑） | 领域专用但可泛化 |
| **故事生成路由** | 类型→生成类型映射表 + 中文推荐理由 | 完全领域专用 |
| **戏剧功能/镜头语言** | 中文标签（开场/铺垫/冲突升级/高潮/尾声 + 远景缓缓推进…） | 领域专用但可泛化 |
| **时长枚举** | 中文字符串（30秒/1分钟/3分钟/5分钟） | 领域专用，应改为数值 |
| **人物提取正则** | 中文官职后缀（公/君/卿/帅/将/帝/王…） | 完全领域专用 |
| **风险计算** | 检查中文可信度值 + 文化禁忌标注 | 领域专用，需替换为领域安全规则 |
| **视频来源** | Bilibili BV号 + UP主 + bilibili API | 平台专用 |
| **文章来源** | 中文平台域名映射（微信/知乎/头条/搜狐） | 平台专用 |

### 1.3 可复用的通用模式

尽管领域假设深嵌，以下架构模式是**可抽离复用**的：

| 模式 | 说明 |
|------|------|
| `ApiResponse<T>` 统一响应 | ok/data/error 三字段包裹，任何 API 可用 |
| Express 服务器脚手架 | CORS + JSON + 路由挂载 + 错误处理 + 环境变量配置 |
| RESTful 路由结构 | `/api/entries/*`, `/api/stories/*`, `/api/system/*` 三组模式 |
| story 生成管线架构 | plan → generate → store → list → get → gears_segments |
| MCP proxy 适配器模式 | import 纯函数 → 类型转换 → 不泄漏内部类型 |
| StoryScene / GearsSegment 数据模型 | 场景+分段的基础结构（去掉 cultural_note / cultural_constraints 后即可泛化） |
| Zod 校验中间件模式 | validateBody / validateQuery / validateParams |
| 文件存储模式 | 按 generation_type 分子目录存储 JSON |
| Vue3 + Vite + Router 前端架构 | SPA 路由 + API 客户端 + 组件化 |

---

## 2. 为什么不能把警察故事和小说改编直接塞进 china-culture-kb

### 2.1 领域模型根本不同

| 维度 | 中国文化故事 | 警察/法治故事 | 小说改编 |
|------|-------------|-------------|---------|
| **条目组织维度** | 省份→地区→条目 | 案件类型→地域→案件 | 原作→章节→人物 |
| **条目类型枚举** | 历史人物、神话传说、非遗… | 刑事案件、英雄事迹、侦查纪实、反诈案例、基层故事… | 原著小说、改编剧本、角色设定、世界观设定 |
| **可信度体系** | A/B/C/D 级来源 + 可靠/基本可靠/待核实/存疑 | 案件公开程度（公开卷宗/官方通报/媒体报道/当事人口述）+ 法律真实性约束 | 原作授权等级 + 改编权限状态 + 版权有效期 |
| **安全/禁忌规则** | 文化禁忌（D级传说不可写成史实、涉及少数民族需谨慎） | 法律红线（不暴露真实侦查手段、不美化犯罪、保护受害者隐私、不泄露涉密信息） | 版权红线（未授权不可改编、角色不可脱离原作精神、不可抄袭核心情节） |
| **数据来源** | 地方志、非遗名录、民间口述、B站文化视频 | 公开卷宗、官方通报、法制报道、公安宣传资料 | 小说原文、作者授权书、出版社合同 |
| **故事生成逻辑** | 从条目提取 bold 事件 → 构建场景 | 从案件要素提取冲突点 → 构建侦查叙事 | 从小说核心情节提取 → 压缩为短剧结构 |

### 2.2 硬塞的后果

如果把警察故事直接加进 china-culture-kb：

1. **EntryType 枚举膨胀** — 从 12 个变成 20+ 个，一半是文化类一半是警务类，语义割裂
2. **省份文件里出现刑事案件** — `data/provinces/湖南.md` 里同时有"周敦颐"和"某某诈骗案"，逻辑混乱
3. **可信度体系冲突** — 文化条目用"民间口述=待核实"，案件条目用"当事人口述=需脱敏处理"，同一字段承载两种完全不同的语义
4. **安全规则无法共存** — 文化禁忌说"D级传说不可写成史实"，警务安全说"不暴露真实侦查手段"，两套规则在一个 `computeCulturalRisks` 函数里无法统一
5. **前端路由混乱** — `/province/湖南` 页面混合展示非遗和诈骗案例，用户心智模型不一致
6. **MCP 工具职责不清** — `searchKnowledgeBase` 到底搜文化条目还是搜案件？

小说改编同理 — 原作章节和省级文化条目是完全不同的数据结构，强行统一只会让两端都变形。

---

## 3. 为什么不建议做多个完全孤立的 Agent

### 3.1 孤立方案的问题

假设做三个独立项目：`china-culture-agent`、`police-story-agent`、`novel-adaptation-agent`

| 问题 | 说明 |
|------|------|
| **重复建设** | Express 脜手架、ApiResponse、Zod 校验、路由结构、错误处理、CORS 配置、story 管线架构 — 三个项目各写一遍 |
| **GEARS 对接碎片** | grears v2 需要对接三个不同的 API、三种不同的 gears_segments 格式、三个不同的域名/端口 |
| **故事模型不统一** | StoryScene、GearsSegment 在三个项目里各自定义，字段名可能不同（一个叫 `cultural_note`，一个叫 `legal_constraint`，一个叫 `adaptation_note`） |
| **运维成本 3x** | 三个代码仓库、三套 CI/CD、三个部署环境、三套监控 |
| **经验无法复用** | 在 china-culture 里踩过的坑（ Province 搜索空结果 bug、storyId 格式、API 响应格式设计）不会自动传递到其他项目 |
| **跨领域故事无法生成** | 如果未来需要"用文化故事手法讲述反诈案例"（跨领域融合），孤立 Agent 之间没有通信机制 |

### 3.2 仍需领域隔离

但孤立方案揭示了一个正确直觉：**领域之间确实需要隔离**。问题是隔离的粒度 — 不应该是项目级隔离，而是**模块级隔离**。

---

## 4. 统一平台 + Domain Pack 插件化架构

### 4.1 核心概念

```
┌─────────────────────────────────────────────────────────┐
│                  Story Agent Platform                     │
│                    （通用平台内核）                         │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │ Story    │  │ Entry    │  │ GEARS                │   │
│  │ Pipeline │  │ Pipeline │  │ Integration          │   │
│  │ (通用)   │  │ (通用)   │  │ (统一对接)           │   │
│  └──────────┘  └──────────┘  └──────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Domain Pack Registry                 │   │
│  │  ┌─────────────┐ ┌────────────┐ ┌────────────┐  │   │
│  │  │china_culture│ │police_story│ │novel_adapt │  │   │
│  │  │  Domain Pack│ │Domain Pack│ │ Domain Pack│  │   │
│  │  └─────────────┘ ┌────────────┐ ┌────────────┐  │   │
│  │                  │ future…    │ │ future…    │  │   │
│  │                  └────────────┘ └────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 4.2 什么是 Domain Pack

一个 Domain Pack 是一个**自描述的领域插件包**，包含：

| 组成 | 说明 | 示例（china_culture） |
|------|------|----------------------|
| **领域元数据** | domain_id, display_name, description, version | `china_culture`, `中国传统文化故事`, `v1.0` |
| **条目类型枚举** | 该领域特有的条目分类 | 历史人物、神话传说、非遗、名胜古迹… |
| **生成类型枚举** | 该领域特有的故事生成模式 | character_story, culture_promo, scene_short |
| **数据组织规则** | 条目文件如何存储和索引 | `data/provinces/{省名}.md`, 省份→地区→条目 |
| **数据解析适配器** | 从原始数据文件读取条目的函数 | parseProvinceMarkdown, searchProvinceFiles |
| **故事生成配置** | 类型→生成路由、戏剧函数表、镜头语言映射、时长推荐 | TYPE_GENERATION_ROUTING, DRAMATIC_FUNCTIONS, CAMERA_BY_FUNCTION |
| **安全规则** | 该领域的禁忌与红线 | 文化禁忌（D级传说不可写成史实） |
| **可信度体系** | 来源分级 + 可信度等级 + 交叉认证规则 | A/B/C/D级 + 可靠/基本可靠/待核实/存疑 |
| **GEARS 输出适配** | 领域特有字段映射到 GearsSegment | cultural_note → constraint_note |
| **前端路由/页面** | 领域特有的浏览和交互页面（可选） | ProvinceGrid, EntryCard 文化风格 |

### 4.3 Domain Pack 接口契约

每个 Domain Pack 必须实现以下标准接口（TypeScript 描述）：

```typescript
interface DomainPack {
  // ── 元数据 ──
  meta: DomainMeta;

  // ── 条目系统 ──
  entryTypes: EntryTypeDefinition[];
  searchEntries(params: EntrySearchParams): Promise<EntrySearchResult[]>;
  getEntryDetail(name: string): Promise<EntryDetail>;
  listEntrySources?(): Promise<EntrySourceInfo[]>;

  // ── 故事生成 ──
  generationTypes: GenerationTypeDefinition[];
  planStory(entryName: string): Promise<StoryPlanResult>;
  generateStory(request: StoryGenerateRequest): Promise<StoryGenerateResult>;
  typeRouting: TypeRoutingMap;

  // ── 安全规则 ──
  safetyRules: SafetyRule[];
  validateStoryContent(content: string): SafetyValidationResult;

  // ── 可信度体系 ──
  credibilitySystem: CredibilitySystem;

  // ── GEARS 适配 ──
  mapSceneToSegment(scene: StoryScene, context: GenerationContext): GearsSegment;
  mapDomainConstraints(constraints: string[]): GearsConstraint[];
}
```

关键原则：
- **平台内核不知道任何领域的具体类型名称** — 它只调用 DomainPack 接口
- **Domain Pack 之间不互相 import** — 每个包完全自包含
- **跨领域故事通过平台内核协调** — 内核可以在两个 Pack 之间桥接数据（第二阶段）

### 4.4 当前 china-culture-kb 代码如何拆分

| 当前代码 | 拆分去向 |
|---------|---------|
| `web/shared/types.ts` — ApiResponse, ApiError, ErrorCodes | → **平台内核** |
| `web/shared/types.ts` — EntryType, GenerationType, ProvinceInfo, TypeInfo | → **china_culture Domain Pack** |
| `web/shared/types.ts` — StoryScene, GearsSegment (去掉 cultural_note) | → **平台内核**（基础模型） |
| `web/shared/types.ts` — StoryScene.cultural_note, GearsSegment.cultural_constraints | → **china_culture Domain Pack**（领域扩展字段） |
| `web/shared/schemas.ts` — 通用校验模式 | → **平台内核** |
| `web/shared/schemas.ts` — GenerationTypeSchema, DurationSchema | → **各 Domain Pack** |
| `web/server/src/index.ts` | → **平台内核** |
| `web/server/src/middleware/*` | → **平台内核** |
| `web/server/src/routes/stories.ts` | → **平台内核**（路由骨架） |
| `web/server/src/routes/entries.ts` | → **平台内核**（路由骨架）+ Domain Pack 实现注入 |
| `web/server/src/routes/system.ts` | → **平台内核** + Domain Pack 注册 |
| `web/server/src/services/story-service.ts` | → **china_culture Domain Pack** |
| `web/server/src/services/entry-service.ts` | → **china_culture Domain Pack** |
| `web/server/src/services/mcp-proxy.ts` | → **china_culture Domain Pack**（数据适配器） |
| `mcp-server/src/lib/provinces.ts` | → **china_culture Domain Pack** |
| `mcp-server/src/lib/markdown.ts` | → **china_culture Domain Pack** |
| `mcp-server/src/lib/templates.ts` | → **china_culture Domain Pack** |
| `mcp-server/src/lib/bilibili.ts` | → **china_culture Domain Pack** |
| `mcp-server/src/tools/*` | → **china_culture Domain Pack** |
| `web/client/src/views/*` | → **china_culture Domain Pack**（领域页面） |
| `web/client/src/components/StoryResult.vue` | → **平台内核**（通用故事展示） |
| `web/client/src/components/GearsActions.vue` | → **平台内核**（通用 GEARS 操作） |

---

## 5. 主控 Agent + 领域子 Agent

### 5.1 Agent 层级

```
                    ┌─────────────────────┐
                    │   Platform Agent     │
                    │   （主控 / 路由）     │
                    │                     │
                    │  - 接收用户意图      │
                    │  - 识别领域          │
                    │  - 路由到子 Agent    │
                    │  - 协调跨领域请求    │
                    │  - 统一输出格式      │
                    └─────────┬───────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
    ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
    │ China       │   │ Police      │   │ Novel       │
    │ Culture     │   │ Story       │   │ Adaptation  │
    │ Agent       │   │ Agent       │   │ Agent       │
    │             │   │             │   │             │
    │ 知识库条目  │   │ 案件/法治   │   │ 原作→改编   │
    │ 省份浏览    │   │ 地域分类    │   │ 小说→短剧   │
    │ 文化禁忌    │   │ 法律红线    │   │ 版权约束    │
    └─────────────┘   └─────────────┘   └─────────────┘
```

### 5.2 主控 Agent 职责

| 职责 | 说明 |
|------|------|
| **领域识别** | 根据用户请求判断应路由到哪个子 Agent（关键词 / 上下文 / 显式选择） |
| **请求标准化** | 将用户请求转换为 `StoryGenerateRequest` 通用格式 |
| **子 Agent 路由** | 调用对应 Domain Pack 的 `planStory` / `generateStory` |
| **结果标准化** | 将子 Agent 返回的领域特有结果包裹为统一 `ApiResponse` |
| **跨领域协调**（第二阶段） | 支持如"用文化叙事手法讲述反诈故事"这类跨领域请求 |
| **GEARS 统一出口** | 所有领域的故事最终都通过统一的 GEARS segments 格式输出给 grears v2 |

### 5.3 领域子 Agent 职责

| 职责 | 说明 |
|------|------|
| **条目管理** | 实现该领域的条目搜索、详情、列表 |
| **故事规划** | 实现该领域的 plan 逻辑（推荐类型、推荐事件、风险提示） |
| **故事生成** | 实现该领域的 generate 逻辑（模板、戏剧结构、镜头语言） |
| **安全校验** | 实现该领域的安全规则校验 |
| **可信度标注** | 实现该领域的来源分级和交叉认证 |
| **GEARS 字段映射** | 将领域特有字段映射到统一 GearsSegment 格式 |

### 5.4 领域识别规则

| 信号 | 路由目标 |
|------|---------|
| 用户输入条目名含文化关键词（非遗、传说、名胜…） | → `china_culture` |
| 用户选择"警察故事/法治故事"领域 | → `police_story` |
| 用户输入小说名或选择"小说改编" | → `novel_adaptation` |
| 用户输入跨领域意图（"用故事手法讲反诈"） | → Platform Agent 协调两个子 Agent |
| 默认/未识别 | → 当前活跃领域 或 提示用户选择 |

---

## 6. 统一数据模型

### 6.1 分层模型：平台基础 + 领域扩展

核心设计原则：**平台定义骨架，领域填充血肉**。

```
平台基础模型（所有领域共享）
    │
    ├── Entry（条目）        — 骨架：name, type, summary, keywords
    │   └── 领域扩展字段     — china: province, region, credibility
    │                        — police: case_type, region, legal_status
    │                        — novel: source_title, chapter, adaptation_rights
    │
    ├── Story（故事）        — 骨架：storyId, title, logline, full_text, generation_type
    │   └── 领域扩展字段     — china: cultural_constraints, credibility_note
    │                        — police: legal_constraints, case_authenticity_note
    │                        — novel: adaptation_note, copyright_status
    │
    ├── StoryScene（场景）   — 骨架：scene_id, title, duration, location, dramatic_function, plot
    │   └── 领域扩展字段     — china: cultural_note
    │                        — police: legal_note
    │                        — novel: adaptation_note
    │
    ├── GearsSegment（分段） — 骨架：segment_id, duration_sec, panel_count, script_text, purpose, visual_focus
    │   └── 颍域扩展字段     — china: cultural_constraints → constraint_note
    │                        — police: legal_constraints → constraint_note
    │                        — novel: adaptation_constraints → constraint_note
    │                           (统一为 constraint_note: string[])
    │
    └── StoryPlanResult     — 骨架：entry_name, recommended_types, available_events, recommended_duration
        └── 领域扩展字段     — china: cultural_risks
                             — police: legal_risks
                             — novel: copyright_risks
```

### 6.2 平台基础类型定义

```typescript
// ── 条目 ──
interface BaseEntry {
  name: string;
  type: string;            // 具体值由 Domain Pack 定义
  summary: string;
  keywords: string[];
  sourceDomain: string;    // 标识来自哪个 Domain Pack
}

// ── 故事 ──
interface BaseStory {
  storyId: string;
  title: string;
  logline: string;
  full_text: string;
  generation_type: string; // 具体值由 Domain Pack 定义
  source_entry: string;
  sourceDomain: string;
  scene_breakdown: BaseStoryScene[];
  gears_segments: BaseGearsSegment[];
  gears_segments_url: string;
  constraints: string[];   // 统一的安全/领域约束列表
  credibility_note: string;
  created_at: string;
}

// ── 场景 ──
interface BaseStoryScene {
  scene_id: number;
  title: string;
  duration: string;
  location: string;
  time_of_day: string;
  dramatic_function: string;
  plot: string;
  key_action: string;
  characters: string[];
  visual_prompt: string;
  camera_suggestion: string;
}

// ── GEARS 分段 ──
interface BaseGearsSegment {
  segment_id: number;
  source_scene_id: number;
  duration_sec: number;
  panel_count: number;     // 4 | 6 | 8 | 9 | 10 | 12
  script_text: string;
  purpose: string;
  visual_focus: string[];
  constraint_note: string[];  // 统一的约束标注（替代 cultural_constraints）
}

// ── GEARS 响应 ──
interface BaseGearsSegmentsResponse {
  schema_version: string;  // "gears-segments/v1"
  storyId: string;
  title: string;
  total_duration_sec: number;
  sourceDomain: string;
  segments: BaseGearsSegment[];
}

// ── 时长 ──
type SupportedDurationSec = 30 | 60 | 180 | 300;  // 数值型，替代中文字符串

// ── 条目搜索参数 ──
interface BaseEntrySearchParams {
  keywords?: string;
  type?: string;
  // 领域特有过滤字段由 Domain Pack 扩展
}

// ── 故事生成请求 ──
interface BaseStoryGenerateRequest {
  entry_name: string;
  generation_type: string;
  selected_event?: string;
  target_duration_sec: SupportedDurationSec;
  tone?: string;
  output_gears_segments: boolean;
  sourceDomain: string;    // 指定使用哪个 Domain Pack
}

// ── API 响应 ── （完全复用当前设计）
interface ApiResponse<T> {
  ok: boolean;
  data: T | null;
  error: ApiError | null;
}
```

### 6.3 领域扩展类型机制

每个 Domain Pack 通过 **类型扩展（Extension）** 添加领域特有字段：

```typescript
// china_culture Domain Pack 扩展
interface CultureEntry extends BaseEntry {
  province: string;
  region: string;        // 省→市→县/区
  credibility: CredibilityLevel;
  culturalSignificance: string;
  verificationMethod: string;
  unverifiedPoints: string[];
}

interface CultureStoryScene extends BaseStoryScene {
  cultural_note: string;
}

interface CultureStoryPlanResult extends BaseStoryPlanResult {
  cultural_risks: string[];
}

// police_story Domain Pack 扩展
interface PoliceEntry extends BaseEntry {
  case_type: PoliceCaseType;
  region: string;
  legal_status: LegalStatus;
  sensitivity_level: SensitivityLevel;
  victim_protection: string[];
}

interface PoliceStoryScene extends BaseStoryScene {
  legal_note: string;
}

interface PoliceStoryPlanResult extends BaseStoryPlanResult {
  legal_risks: string[];
}

// novel_adaptation Domain Pack 扩展
interface NovelEntry extends BaseEntry {
  source_title: string;
  source_author: string;
  adaptation_rights: AdaptationRightsStatus;
  copyright_expiry?: string;
  original_genre: string;
}

interface NovelStoryScene extends BaseStoryScene {
  adaptation_note: string;  // 与原作的对应关系
}

interface NovelStoryPlanResult extends BaseStoryPlanResult {
  copyright_risks: string[];
}
```

---

## 7. 三个首批领域设计

### 7.1 china_culture Domain Pack

| 项目 | 设计 |
|------|------|
| **domain_id** | `china_culture` |
| **display_name** | `中国传统文化故事` |
| **条目类型** | 历史人物、神话传说、非遗、节庆习俗、地方戏曲、饮食文化、传统工艺、名胜古迹、地方掌故、宗教信仰、民俗活动（11 类，沿用当前） |
| **生成类型** | `character_story`, `culture_promo`, `scene_short`（沿用当前） |
| **数据组织** | `data/provinces/{省名}.md`，省份→地区→条目（沿用当前） |
| **数据解析** | parseProvinceMarkdown，searchProvinceFiles（沿用当前 mcp-proxy + markdown.ts） |
| **安全规则** | 见 §8 当前文化禁忌规则 |
| **可信度体系** | A/B/C/D级来源 + 可靠/基本可靠/待核实/存疑 + 交叉认证三条原则 |
| **GEARS 映射** | `cultural_constraints` → `constraint_note`，`cultural_note` → 场景扩展字段 |
| **迁移策略** | 当前 v1 代码直接变为 china_culture Domain Pack，不改逻辑，只加接口包装 |

### 7.2 police_story Domain Pack

| 项目 | 设计 |
|------|------|
| **domain_id** | `police_story` |
| **display_name** | `警察/法治/反诈/基层警务故事` |
| **条目类型** | 刑事案件、英雄事迹、侦查纪实、反诈案例、基层故事、法治宣传、警务培训案例 |
| **生成类型** | `case_drama`（案件叙事剧）、`hero_profile`（英雄人物片）、`anti_fraud_short`（反诈短片）、`community_story`（基层故事片） |
| **数据组织** | `data/police/{案件类型}/{地域}.md`，按案件类型分目录，而非省份 |
| **数据解析** | parsePoliceMarkdown — 不同字段结构（案件编号、案发时间、涉案人员、侦查过程、判决结果） |
| **安全规则** | 见 §8 警察故事安全规则 — 这是本领域最核心的设计约束 |
| **可信度体系** | 公开卷宗(A)/官方通报(A)/法制报道(B)/公安宣传(B)/当事人口述(C)/网络传闻(D) + 公开/脱敏/涉密三级 |
| **GEARS 映射** | `legal_constraints` → `constraint_note`，`legal_note` → 场景扩展字段 |

### 7.3 novel_adaptation Domain Pack

| 项目 | 设计 |
|------|------|
| **domain_id** | `novel_adaptation` |
| **display_name** | `小说改编短剧/AI漫剧/视频故事` |
| **条目类型** | 原著小说、改编剧本、角色设定、世界观设定、关键情节 |
| **生成类型** | `short_drama`（短剧改编）、`ai_comic`（AI漫剧）、`video_story`（视频故事大纲） |
| **数据组织** | `data/novels/{原作名}/` — 每部小说一个目录，含 novel.md（原作信息）、characters.md、chapters.md |
| **数据解析** | parseNovelMarkdown — 字段结构（标题、作者、出版信息、核心情节、角色列表、改编授权状态） |
| **安全规则** | 见 §8 版权规则 — 这是本领域最核心的设计约束 |
| **可信度体系** | 原作文本(A)/作者声明(A)/出版社官方(B)/书评(C)/网络摘要(D) + 已授权/未授权/授权过期 |
| **GEARS 映射** | `adaptation_constraints` → `constraint_note`，`adaptation_note` → 场景扩展字段 |

---

## 8. 领域安全规则设计

### 8.1 文化禁忌规则（china_culture）

沿用当前规则，整合为 Domain Pack 的 SafetyRule 列表：

| 规则 ID | 规则内容 | 严重级别 |
|---------|---------|---------|
| `CULT-D001` | D级来源（民间口述）不可写成史实，必须标注"民间传说，非历史事实" | 🔴 禁止 |
| `CULT-D002` | 涉及少数民族题材需谨慎，避免刻板印象和文化简化 | 🔴 禁止 |
| `CULT-D003` | 涉及宗教信仰内容需标注"仅为文化叙事，不代表宗教观点" | 🟡 警告 |
| `CULT-D004` | 神话传说改编不可与考古实证混淆 | 🔴 禁止 |
| `CULT-D005` | 历史人物改编不得歪曲已知的正史记载核心事实 | 🟡 警告 |
| `CULT-D006` | 传统文化元素用于商业化创作时需标注来源和可信度 | 🟢 提示 |

### 8.2 警察故事安全规则（police_story）

这是 **police_story Domain Pack 最关键的设计约束**。违反以下规则可能导致法律后果或社会危害。

| 规则 ID | 规则内容 | 严重级别 | 说明 |
|---------|---------|---------|------|
| `POL-D001` | **不暴露真实侦查手段细节** | 🔴 禁止 | 不得描写具体技术侦查方法、监控手段、取证流程细节。可以写"警方通过技术手段锁定嫌疑人"，不可写具体手段 |
| `POL-D002` | **不美化犯罪行为和犯罪分子** | 🔴 禁止 | 犯罪分子不得被塑造成正面角色或英雄；犯罪行为不得被描绘为"聪明""精彩""值得学习" |
| `POL-D003` | **保护受害者隐私** | 🔴 禁止 | 真实案件中的受害者必须完全脱敏：匿名化、模糊化身份信息，不得描写受害者具体遭遇细节 |
| `POL-D004` | **不泄露涉密信息** | 🔴 禁止 | 案件涉及国家安全、重大涉密内容的，不得改编为故事；只能使用已公开卷宗和官方通报 |
| `POL-D005` | **尊重执法人员形象** | 🟡 警告 | 警察角色可以有缺点和成长弧，但不得整体污名化警察群体 |
| `POL-D006` | **案件改编需标注虚构程度** | 🟡 警告 | 基于"真实案件改编"的故事必须在开头标注"本故事基于真实案件改编，人物和情节已做虚构化处理" |
| `POL-D007` | **反诈内容必须提供官方渠道** | 🟡 警告 | 反诈故事末尾必须附带官方反诈热线/APP/网站信息 |
| `POL-D008` | **不渲染暴力细节** | 🟡 警告 | 暴力场景可用戏剧化手法暗示，不可写实描写；特别禁止描写针对未成年人的暴力 |
| `POL-D009` | **涉未成年人的案件需特别谨慎** | 🔴 禁止 | 涉未成年人的案件改编必须完全脱敏，不得涉及任何可能识别当事人的信息 |
| `POL-D010` | **正在侦查/审理中的案件不可改编** | 🔴 禁止 | 只有已结案且已公开的案件才能作为改编素材 |

**SafetyRule 接口定义**：

```typescript
interface SafetyRule {
  rule_id: string;           // "POL-D001"
  severity: 'prohibited' | 'warning' | 'info';
  description: string;       // 规则内容
  check: (content: string, context: GenerationContext) => SafetyCheckResult;
}

interface SafetyCheckResult {
  rule_id: string;
  passed: boolean;
  violations: string[];      // 具体违规片段
  suggestion: string;        // 修改建议
}
```

### 8.3 小说改编版权规则（novel_adaptation）

| 规则 ID | 规则内容 | 严重级别 | 说明 |
|---------|---------|---------|------|
| `NOV-D001` | **未获授权不得改编** | 🔴 禁止 | 原作未获改编授权的，不可生成改编故事。授权状态为 `unauthorized` 的条目只能查看原作信息，不能触发故事生成 |
| `NOV-D002` | **改编不得脱离原作核心精神** | 🟡 警告 | 改编版本的角色性格、核心价值观不得与原作矛盾。可以增加新情节，但不可扭曲原作角色本质 |
| `NOV-D003` | **不得抄袭原作核心情节** | 🟡 警告 | 即使获得改编授权，也不可将原作核心情节未经转化地直接复制到新形式中 — 必须有"改编转化"（压缩、重组、视角转换） |
| `NOV-D004` | **版权过期作品需标注** | 🟢 提示 | 进入公共领域的作品可自由改编，但需标注"原作已进入公共领域" |
| `NOV-D005` | **同人创作需标注非官方** | 🟡 警告 | 未获授权的同人创作（fan fiction）必须标注"本作品为同人创作，非原作官方授权改编" |
| `NOV-D006` | **改编版本需标注与原作的对应关系** | 🟢 提示 | 每个 StoryScene 应标注其对应原作的哪个章节/情节（adaptation_note 字段） |

**授权状态模型**：

```typescript
type AdaptationRightsStatus =
  | 'authorized'              // 已获改编授权
  | 'authorized_expired'      // 授权已过期
  | 'public_domain'           // 已进入公共领域
  | 'pending'                 // 授权谈判中
  | 'unauthorized'            // 未获授权
  | 'unknown';                // 授权状态未知

// 授权状态 → 是否允许生成
const RIGHTS_TO_GENERATION: Record<AdaptationRightsStatus, boolean> = {
  authorized: true,
  authorized_expired: false,
  public_domain: true,
  pending: false,
  unauthorized: false,
  unknown: false,   // 未知 = 不允许，直到确认
};
```

---

## 9. 和 grears v2 的统一对接

### 9.1 当前对接方式

grears v2 通过 `GET /api/stories/:storyId/gears-segments` 拉取分段脚本。

当前 gears_segments 格式：

```json
{
  "schema_version": "gears-segments/v1",
  "storyId": "...",
  "title": "...",
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
}
```

### 9.2 统一对接方案

**核心原则：grears v2 只看一个格式，不知道故事来自哪个领域。**

| 变化 | 当前 | 统一后 |
|------|------|--------|
| 约束字段名 | `cultural_constraints` | `constraint_note`（统一名） |
| 约束字段内容 | 仅文化禁忌 | 文化禁忌 / 法律红线 / 版权约束 — 领域自定内容，格式统一 |
| 额外元数据 | 无 | `sourceDomain: string` — 标识领域（grears v2 可据此调整渲染风格） |
| schema_version | `"gears-segments/v1"` | 升级为 `"gears-segments/v2"` — 添加 `sourceDomain` + `constraint_note` |
| 端点 | 单一端点 `/api/stories/:storyId/gears-segments` | 保持不变 — URL 不因领域不同而变 |

**统一 gears_segments/v2 格式**：

```json
{
  "schema_version": "gears-segments/v2",
  "storyId": "20260605-nan-an-zhi-yin",
  "title": "南安掷印",
  "sourceDomain": "china_culture",
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
      "constraint_note": ["家属和雨夜为影视化创作", "月岩悟道为D级传说，不可写成史实"]
    }
  ]
}
```

### 9.3 grears v2 适配策略

| 策略 | 说明 |
|------|------|
| **v1 向后兼容** | grears v2 当前消费 `cultural_constraints` 字段。v2 格式中 `constraint_note` 语义等价，grears v2 做字段名映射即可 |
| **sourceDomain 新字段** | grears v2 可根据 `sourceDomain` 选择不同渲染模板（文化故事用国风模板、警察故事用写实模板、小说改编用对应风格） |
| **单端点不变** | grears v2 不需要知道故事来自哪个 API — 统一 `/api/stories/:storyId/gears-segments` 端点 |
| **schema_version 驱动** | grears v2 根据 `schema_version` 决定解析逻辑 — v1 用旧字段名，v2 用新字段名 |

---

## 10. 分阶段迁移路线

### 阶段总览

```
Phase 0 ── 文档与抽象边界（当前，不改代码）
    │
Phase 1 ── 平台内核最小骨架 + china_culture Domain Pack 封装
    │
Phase 2 ── police_story Domain Pack 实现
    │
Phase 3 ── novel_adaptation Domain Pack 实现
    │
Phase 4 ── 跨领域协调 + 前端统一入口
```

### Phase 0 — 文档与抽象边界（本次，立即执行）

**目标**：确定架构边界和接口契约，不改任何业务代码。

| 任务 | 说明 | 产出 |
|------|------|------|
| ✅ 保存当前 v1 快照 | git tag + commit | `checkpoint-2026-06-05-china-culture-web-v1` |
| ✅ 创建规划文档 | 本文档 | `docs/platform/story-agent-platform-roadmap.md` |
| 定义 DomainPack 接口 | TypeScript 接口定义文档 | `docs/platform/domain-pack-interface.md` |
| 定义统一数据模型 | 基础类型 + 领域扩展类型文档 | `docs/platform/unified-data-model.md` |
| 定义 GEARS v2 对接升级 | v1 → v2 字段映射文档 | `docs/platform/gears-v2-upgrade.md` |
| 定义 police_story 安全规则 | 安全规则详表 + check 函数签名 | `docs/platform/police-story-safety-rules.md` |
| 定义 novel_adaptation 版权规则 | 版权规则详表 + 授权状态模型 | `docs/platform/novel-adaptation-copyright-rules.md` |

**明确：Phase 0 不改任何 `web/` 或 `mcp-server/` 目录下的代码文件。**

### Phase 1 — 平台内核最小骨架 + china_culture 封装

**目标**：把当前 v1 代码从"一个整体"拆为"平台内核 + china_culture Domain Pack"，功能不减少。

| 任务 | 说明 |
|------|------|
| 创建 `platform/` 目录 | 平台内核代码（Express 脚手架、统一响应、路由骨架、DomainPack 注册机制） |
| 创建 `domains/china_culture/` 目录 | 把当前 `web/server/src/services/story-service.ts` + `entry-service.ts` + `mcp-proxy.ts` 迁入 |
| 抽取共享基础类型 | 从 `web/shared/types.ts` 拆出 `BaseEntry` / `BaseStory` / `BaseStoryScene` / `BaseGearsSegment` 到 `platform/types.ts` |
| china_culture 声明 DomainPack | 实现 `DomainPack` 接口，注册到平台 |
| API 路由改为动态注册 | `/api/entries/search` 路由根据请求的 `domain` 参数选择对应 DomainPack |
| 前端保持不变 | Vue 页面继续正常工作，只后端结构变化 |
| GEARS 升级到 v2 格式 | `constraint_note` 替代 `cultural_constraints`，添加 `sourceDomain` |
| 全量回归测试 | 确保 china_culture 的所有功能在拆分后仍正常工作 |

**Phase 1 结束标志**：china_culture Domain Pack 通过接口注册后，所有 v1 功能正常运行，GEARS 输出升级为 v2 格式。

### Phase 2 — police_story Domain Pack 实现

| 任务 | 说明 |
|------|------|
| 创建 `domains/police_story/` 目录 | 新领域代码 |
| 定义 police 条目类型和生成类型 | 7 条目类型 + 4 生成类型 |
| 定义数据组织规则 | `data/police/{案件类型}/{地域}.md` |
| 实现 parsePoliceMarkdown | 不同字段结构的解析器 |
| 实现 police story 生成逻辑 | 不同的戏剧结构、镜头语言、模板 |
| 实现 police 安全规则 | 10 条 SafetyRule + check 函数 |
| 实现可信度体系 | 公开/脱敏/涉密 + 来源分级 |
| 注册到平台内核 | DomainPack 注册 |
| 前端：新增警察故事页面 | 警察领域特有浏览和生成页面 |
| 安全规则集成测试 | 每条规则有正向和反向测试 |

**Phase 2 结束标志**：police_story Domain Pack 完整可用，安全规则全部可执行。

### Phase 3 — novel_adaptation Domain Pack 实现

| 任务 | 说明 |
|------|------|
| 创建 `domains/novel_adaptation/` 目录 | 新领域代码 |
| 定义 novel 条目类型和生成类型 | 5 条目类型 + 3 生成类型 |
| 定义数据组织规则 | `data/novels/{原作名}/` 目录结构 |
| 实现 parseNovelMarkdown | 小说特有字段解析 |
| 实现 novel 改编生成逻辑 | 压缩/重组/视角转换的三种改编策略 |
| 实现版权规则 | 6 条 SafetyRule + 授权状态模型 |
| 实现可信度体系 | 原作/作者/出版社分级 + 授权状态 |
| 注册到平台内核 | DomainPack 注册 |
| 前端：新增小说改编页面 | 改编工作台 |
| 版权规则集成测试 | 每条规则有正向和反向测试 |

**Phase 3 结束标志**：novel_adaptation Domain Pack 完整可用，版权规则全部可执行。

### Phase 4 — 跨领域协调 + 前端统一入口

| 任务 | 说明 |
|------|------|
| Platform Agent 领域识别 | 根据用户意图自动路由到子 Agent |
| 跨领域故事桥接 | 支持"用文化叙事手法讲述反诈故事"等跨领域请求 |
| 前端统一入口 | 首页提供领域选择器，统一搜索栏跨领域搜索 |
| 前端领域页面切换 | 不同领域有不同的浏览和生成页面模板 |
| grears v2 渲染风格 | 根据 `sourceDomain` 选择不同渲染模板 |

---

## 11. 第一阶段红线：不大规模重构

### 11.1 Phase 0 原则

| 原则 | 说明 |
|------|------|
| **只写文档，不改代码** | Phase 0 的所有产出都是 `.md` 文件，不修改 `web/` 或 `mcp-server/` 下的任何 `.ts` / `.vue` 文件 |
| **不创建新目录结构** | 不创建 `platform/` 或 `domains/` 目录 — 只在文档中描述目标结构 |
| **不修改 package.json** | 不改变依赖或构建脚本 |
| **不修改 shared/types.ts** | 不改变当前类型定义 — 只在文档中描述目标类型 |
| **不修改 API 路由** | 不改变当前端点结构 |

### 11.2 Phase 1 原则

| 原则 | 说明 |
|------|------|
| **功能不减** | china_culture Domain Pack 封装后，所有 v1 功能必须正常工作 |
| **增量拆分** | 不是推翻重建，而是从当前代码中抽取通用部分到 `platform/`，领域部分移到 `domains/china_culture/` |
| **GEARS v2 向后兼容** | v1 的 `cultural_constraints` 字段在 v2 中映射为 `constraint_note`，grears v2 做字段名映射 |
| **前端零改动优先** | 尽量让前端不需要改动就能继续工作 |
| **全量回归测试** | Phase 1 结束前必须通过所有现有测试 |

---

## 12. 项目目录目标结构（远景，Phase 1 实现）

```text
story-agent-platform/                # 项目根目录（可改名或保持 china-culture-kb）
  platform/                          # 平台内核
    src/
      core/
        server.ts                    # Express 入口
        domain-registry.ts           # DomainPack 注册表
        domain-router.ts             # 领域路由分发
      types/
        base-types.ts                # BaseEntry, BaseStory, BaseStoryScene, BaseGearsSegment
        api-types.ts                 # ApiResponse, ApiError, ErrorCodes
      middleware/
        validate.ts                  # Zod 校验
        error-handler.ts             # 统一错误处理
        cors.ts                      # CORS
      routes/
        entries.ts                   # 通用条目路由骨架（分发到 DomainPack）
        stories.ts                   # 通用故事路由骨架
        system.ts                    # 系统信息路由
      services/
        story-pipeline.ts            # 通用故事管线（调用 DomainPack 的 plan/generate）
  domains/
    china_culture/                   # 中国文化 Domain Pack
      src/
        domain-pack.ts               # 实现 DomainPack 接口
        types.ts                     # CultureEntry, CultureStoryScene 等扩展类型
        schemas.ts                   # 领域特有 Zod schema
        services/
          entry-service.ts           # 条目搜索/详情（当前 entry-service.ts）
          story-service.ts           # 故事生成（当前 story-service.ts）
          mcp-proxy.ts               # MCP 适配（当前 mcp-proxy.ts）
        safety-rules.ts              # 文化禁忌规则
        credibility.ts               # 可信度体系
      data/                          # 文化知识库数据（当前 data/provinces/）
    police_story/                    # 警察故事 Domain Pack
      src/
        domain-pack.ts               # 实现 DomainPack 接口
        types.ts                     # PoliceEntry, PoliceStoryScene 等扩展类型
        schemas.ts                   # 领域特有 Zod schema
        services/
          entry-service.ts
          story-service.ts
        safety-rules.ts              # 警察故事安全规则（10条）
        credibility.ts               # 案件可信度体系
      data/                          # 警察故事数据
    novel_adaptation/                # 小说改编 Domain Pack
      src/
        domain-pack.ts               # 实现 DomainPack 接口
        types.ts                     # NovelEntry, NovelStoryScene 等扩展类型
        schemas.ts                   # 领域特有 Zod schema
        services/
          entry-service.ts
          story-service.ts
        safety-rules.ts              # 版权规则（6条）
        credibility.ts               # 版权可信度体系
      data/                          # 小说改编数据
  web/
    client/                          # Vue3 前端（保持不变或逐步改造）
    shared/                          # 平台 + 领域共享类型
  docs/
    platform/                        # 规划文档（Phase 0 产出）
  grears-v2-bridge/                  # GEARS v2 对接配置（可选独立目录）
```

---

## 附录 A：DomainPack 注册机制示意

```typescript
// platform/src/core/domain-registry.ts

const registry = new Map<string, DomainPack>();

function registerDomain(pack: DomainPack): void {
  if (registry.has(pack.meta.domain_id)) {
    throw new Error(`Domain "${pack.meta.domain_id}" already registered`);
  }
  registry.set(pack.meta.domain_id, pack);
}

function getDomain(domainId: string): DomainPack | undefined {
  return registry.get(domainId);
}

function listDomains(): DomainMeta[] {
  return Array.from(registry.values()).map(p => p.meta);
}
```

## 附录 B：API 路由动态分发示意

```typescript
// platform/src/routes/entries.ts

router.get('/search', async (req, res) => {
  const domainId = req.query.domain || 'china_culture';  // 默认领域
  const pack = getDomain(domainId);
  if (!pack) return res.json(fail('DOMAIN_NOT_FOUND', `领域 "${domainId}" 未注册`));

  const results = await pack.searchEntries(req.query);
  res.json(success(results));
});

router.get('/detail', async (req, res) => {
  const domainId = req.query.domain || 'china_culture';
  const pack = getDomain(domainId);
  if (!pack) return res.json(fail('DOMAIN_NOT_FOUND', `领域 "${domainId}" 未注册`));

  const detail = await pack.getEntryDetail(req.query.name);
  res.json(success(detail));
});
```

## 附录 C：GEARS v1 → v2 字段映射

| v1 字段 | v2 字段 | 映射方式 |
|---------|---------|---------|
| `cultural_constraints: string[]` | `constraint_note: string[]` | 直接迁移（字段名变化，内容不变） |
| 无 | `sourceDomain: string` | 新增（值为 Domain Pack 的 domain_id） |
| `schema_version: "gears-segments/v1"` | `schema_version: "gears-segments/v2"` | 版本升级 |

**向后兼容策略**：grears v2 消费时检查 `schema_version`，v1 用 `cultural_constraints`，v2 用 `constraint_note` + `sourceDomain`。

---

> **本文档状态：待评审。不执行任何代码变更。**
> 评审后如需修改，在本分支 `story-platform-planning` 上更新文档。
> Phase 0 完成标志：全部子文档写完 + 用户确认。