# Story Agent 工作台化、故事项目管理与局部重生成开发文档

> 版本：v0.1  
> 日期：2026-06-09  
> 目标项目：`china-culture-kb`  
> 上游文档：`docs/story-agent-workbench-product-analysis.md`  
> 关联文档：`docs/product-document.md`、`开发文档/story_agent_platform_full_development_plan.md`、`开发文档/story-agent-creative-reference-memory-mosaic-dev-doc.md`  
> 目标：把当前“中国传统文化知识库 + 故事生成”产品升级为更接近创作工作台的结构，并为故事项目管理、局部重生成和导出能力建立可执行方案。

---

## 1. 背景

当前产品已经具备：

- 知识库浏览；
- 中国文化知识库入口；
- 省份级条目浏览；
- 故事生成工坊；
- 故事详情页；
- `GEARS segments` 输出。

但当前仍存在几个明显限制：

- 首页仍偏“展示页”，不够像工作台；
- 最近生成故事缺少管理能力；
- 生成结果缺少项目概念；
- 故事生成后无法局部修改；
- 无法以“当前工作版本”为中心进行导出和沉淀；
- 后续多知识库接入会继续挤压首页结构。

因此本阶段需要把产品升级为：

```text
Story Agent 工作台
  ├─ 知识库入口
  ├─ 故事项目库
  ├─ 故事生成工坊
  ├─ 故事编辑/局部重生成
  └─ 导出与 GEARS 对接
```

---

## 2. 本阶段目标

### 2.1 产品目标

实现以下能力：

1. 首页从“内容平铺”升级为“工作台入口”；
2. 中国文化知识库作为一个可进入的知识库模块存在，不在首页大面积展开；
3. 最近生成故事首页只展示少量预览；
4. 新增“故事项目库”页面，承接完整故事管理；
5. 支持对单个故事的单场景/单段进行局部重生成；
6. 支持导出当前工作版本到本地；
7. 建立故事版本与编辑状态结构。

### 2.2 本阶段不做

本阶段不做：

- 全文自由编辑器；
- 多人协作；
- 云端账户系统；
- 项目权限系统；
- 任意跨知识库混合编辑；
- 完整文档格式导出如 `.docx`；
- 视频成品导出。

---

## 3. 核心原则

### 3.1 首页只做入口和概览

首页不再承担完整故事管理，也不再承载完整知识库浏览。

首页职责只保留：

- 知识库入口；
- 故事项目入口；
- 故事生成入口；
- 最近活动预览。

### 3.2 先做局部重生成，不做全文自由编辑

第一阶段只支持对：

- `scene`
- `gears_segment`

做局部修改或重生成。

原因：

- 结构稳定；
- 可联动更新；
- 易于版本记录；
- 不破坏现有故事 JSON 结构过快。

### 3.3 故事是项目，不只是结果

现有 `storyId` 更像单次生成结果标识。

新阶段要引入：

```text
project
  ├─ metadata
  ├─ current working version
  ├─ historical versions
  ├─ export state
  └─ edit history
```

### 3.4 导出以当前工作版本为准

用户导出时，应导出“当前编辑状态下的版本”，而不是默认导出原始生成版。

### 3.5 不改知识库事实

所有编辑、重生成、导出都只作用于：

- `web/generated`
- 项目版本文件

不得写入：

- `data/provinces/*.md`

---

## 4. 新的信息架构

### 4.1 顶层结构

建议导航升级为：

```text
首页
知识库
故事项目
故事生成
```

其中：

- `知识库`：进入知识库总入口
- `故事项目`：进入项目管理页
- `故事生成`：进入 StoryStudio

### 4.2 首页结构

首页 `/` 推荐改为：

```text
工作台欢迎区
  ├─ 进入知识库
  ├─ 打开故事项目
  ├─ 开始生成故事

知识库预览
  ├─ 中国文化知识库（卡片）
  └─ 后续其他知识库卡片

最近故事预览
  ├─ 3-6 个故事
  └─ 查看全部
```

### 4.3 知识库层级

当前：

```text
中国文化知识库
  └─ 省份
```

后续要预留：

```text
知识库
  ├─ 中国文化知识库
  │   ├─ 省份
  │   ├─ 类型
  │   └─ 主题
  ├─ 警察故事知识库
  ├─ 小说改编知识库
  └─ 创作参考库
```

注意：

`省份` 只是中国文化知识库的二级维度，不抽象为所有知识库统一模型。

---

## 5. 故事项目模型

### 5.1 为什么需要项目

当前故事文件是：

```text
web/generated/stories/{video_type}/{storyId}.json
```

这适合单次生成结果存档，但不够支撑：

- 局部重生成；
- 历史版本；
- 导出状态；
- 项目级筛选和搜索；
- 当前工作版本。

### 5.2 推荐数据结构

建议新增：

```ts
export type StoryProjectStatus =
  | 'draft'
  | 'edited'
  | 'exported'
  | 'finalized';

export interface StoryProjectMeta {
  project_id: string;
  current_story_id: string;
  title: string;
  source_domain: 'china_culture';
  source_entry: string;
  video_type: VideoType;
  presentation_style: PresentationStyle;
  story_structure?: StoryStructureType;
  status: StoryProjectStatus;
  version_count: number;
  exported_formats: string[];
  created_at: string;
  updated_at: string;
}

export interface StoryProjectVersion {
  version_id: string;
  based_on_story_id: string;
  change_type: 'initial_generate' | 'scene_regenerate' | 'segment_regenerate' | 'manual_metadata_update';
  change_target?: {
    scene_id?: number;
    segment_id?: number;
  };
  user_instruction?: string;
  created_at: string;
  snapshot_file: string;
}
```

### 5.3 本地存储结构

推荐新增目录：

```text
web/generated/projects/
  {projectId}/
    project.json
    versions/
      {versionId}.json
    exports/
      {timestamp}-story.md
      {timestamp}-story.json
      {timestamp}-gears-segments.json
```

同时保留现有：

```text
web/generated/stories/{video_type}/{storyId}.json
```

迁移策略：

- 旧故事文件继续作为“初始快照”存在；
- 项目文件只负责管理当前版本和历史版本；
- 避免一次性重构全部现有故事存储。

---

## 6. 局部重生成设计

### 6.1 第一阶段支持的粒度

第一阶段只支持：

1. `scene` 级重生成
2. `gears_segment` 级重生成

不支持：

- 任意全文自由编辑
- 同时编辑多个非连续段落
- 用户直接修改底层 JSON 所有字段

### 6.2 用户操作方式

在故事详情或故事编辑页中，用户可以针对单场景/单段选择：

- 重写这一场
- 缩短这一场
- 延长这一场
- 增强冲突
- 增加对白
- 改得更纪实
- 改得更影视化
- 只重写对应 `GEARS segment`

推荐数据结构：

```ts
export type SceneRewriteIntent =
  | 'rewrite'
  | 'shorten'
  | 'expand'
  | 'increase_conflict'
  | 'add_dialogue'
  | 'more_documentary'
  | 'more_cinematic';

export interface StorySceneRegenerateRequest {
  project_id: string;
  version_id?: string;
  scene_id: number;
  intent: SceneRewriteIntent;
  user_note?: string;
}

export interface StorySegmentRegenerateRequest {
  project_id: string;
  version_id?: string;
  segment_id: number;
  intent: 'rewrite' | 'shorten' | 'expand' | 'more_visual' | 'more_concise';
  user_note?: string;
}
```

### 6.3 联动更新规则

#### 修改 `scene`

当用户重生成某个 `scene` 时：

1. 更新该场的 `plot`
2. 更新 `key_action`
3. 更新 `visual_prompt`
4. 更新 `camera_suggestion`
5. 如有需要，更新 `dialogue_or_narration`
6. 自动重新生成关联 `gears_segment`
7. 写入新版本

#### 修改 `gears_segment`

当用户只重生成单个 `gears_segment` 时：

1. 更新该段 `script_text`
2. 如有必要更新 `visual_focus`
3. 不强制反写 `scene_breakdown.plot`
4. 标记为“segment-only edit”
5. 写入新版本

### 6.4 一致性策略

为了避免数据打架，必须明确：

- `scene` 是剧情结构层；
- `gears_segment` 是下游输出层；
- `scene` 改动会联动 `segment`；
- `segment` 改动不默认反写 `scene` 正文。

这样能避免过度复杂的双向同步。

---

## 7. 导出设计

### 7.1 第一阶段导出格式

支持导出：

1. `Markdown`
2. `JSON`
3. `GEARS segments JSON`

### 7.2 导出对象

默认导出：

```text
当前工作版本
```

不是导出原始生成版。

### 7.3 导出接口建议

```ts
export type StoryExportFormat = 'markdown' | 'project_json' | 'gears_segments_json';

export interface StoryExportRequest {
  project_id: string;
  format: StoryExportFormat;
}

export interface StoryExportResult {
  project_id: string;
  format: StoryExportFormat;
  file_name: string;
  file_path: string;
  exported_at: string;
}
```

### 7.4 导出文件命名建议

```text
{title}-{date}.md
{title}-{date}.json
{title}-{date}-gears-segments.json
```

---

## 8. API 设计

### 8.1 保持现有接口

继续保留：

- `POST /api/stories/plan`
- `POST /api/stories/generate`
- `GET /api/stories`
- `GET /api/stories/:storyId`
- `GET /api/stories/:storyId/gears-segments`

### 8.2 新增项目接口

```http
GET  /api/projects
GET  /api/projects/:projectId
GET  /api/projects/:projectId/versions
POST /api/projects/:projectId/regenerate-scene
POST /api/projects/:projectId/regenerate-segment
POST /api/projects/:projectId/export
```

### 8.3 `/api/projects`

返回故事项目列表，用于“故事项目库”页面。

```ts
export interface StoryProjectListItem {
  project_id: string;
  title: string;
  source_entry: string;
  video_type: VideoType;
  presentation_style: PresentationStyle;
  story_structure?: StoryStructureType;
  status: StoryProjectStatus;
  updated_at: string;
  scene_count: number;
  has_gears_segments: boolean;
}
```

### 8.4 `/api/projects/:projectId/regenerate-scene`

输入：

```json
{
  "scene_id": 3,
  "intent": "increase_conflict",
  "user_note": "把这一场的冲突再压强一点，主角更被动一些。"
}
```

输出：

- 新版本 ID
- 更新后的场景
- 更新后的关联 `gears_segment`
- 版本状态信息

### 8.5 `/api/projects/:projectId/export`

输入：

```json
{
  "format": "markdown"
}
```

输出：

- 导出文件路径；
- 导出时间；
- 更新项目 `exported_formats`。

---

## 9. 前端改造

### 9.1 首页 `Home.vue`

目标：

- 知识库区域默认更收敛；
- 最近故事只展示少量；
- 增加“查看全部故事”入口；
- 明确“知识库 / 故事项目 / 故事生成”三个入口。

### 9.2 新增故事项目页

建议新增：

```text
web/client/src/views/Projects.vue
```

页面内容：

- 故事项目列表；
- 搜索框；
- 状态筛选；
- 更新时间排序；
- 进入详情；
- 直接导出。

### 9.3 新增故事编辑页

建议新增：

```text
web/client/src/views/ProjectEditor.vue
```

页面内容：

- 当前版本信息；
- 场景列表；
- `gears_segments` 列表；
- 每场 / 每段的局部重生成按钮；
- 导出按钮；
- 版本历史。

### 9.4 故事详情页 `StoryDetail.vue`

短期可保留只读详情。

中期建议：

- 从只读详情升级为“项目详情 / 编辑入口”；
- 或在详情页增加“进入编辑”按钮。

---

## 10. 后端服务设计

### 10.1 新增服务

建议新增：

```text
web/server/src/services/project-service.ts
web/server/src/services/story-regenerate-service.ts
web/server/src/services/story-export-service.ts
```

职责：

| 文件 | 职责 |
|---|---|
| `project-service.ts` | 项目读取、写入、列表、版本管理 |
| `story-regenerate-service.ts` | 单场景 / 单段重生成 |
| `story-export-service.ts` | 导出 Markdown / JSON / GEARS |

### 10.2 与现有 story-service 的关系

`story-service.ts` 继续负责：

- 首次生成；
- 原始 story JSON 存档；
- 原有 `/stories/*` 接口。

新增服务负责：

- 项目级读取；
- 局部编辑；
- 版本沉淀；
- 导出。

这样可以避免把 `story-service.ts` 继续堆成超大文件。

---

## 11. 类型改造

### 11.1 `web/shared/types.ts`

新增：

- `StoryProjectStatus`
- `StoryProjectMeta`
- `StoryProjectVersion`
- `StoryProjectListItem`
- `StorySceneRegenerateRequest`
- `StorySegmentRegenerateRequest`
- `StoryExportFormat`
- `StoryExportRequest`
- `StoryExportResult`

扩展：

```ts
export interface StoryGenerateResult {
  // existing fields...
  project_id?: string;
  current_version_id?: string;
  editable?: boolean;
}
```

### 11.2 `web/shared/schemas.ts`

新增：

- `StorySceneRegenerateRequestSchema`
- `StorySegmentRegenerateRequestSchema`
- `StoryExportRequestSchema`

校验规则：

- `scene_id` 必须存在于当前版本；
- `segment_id` 必须存在于当前版本；
- `format` 必须是允许的导出类型；
- `intent` 必须在白名单中。

---

## 12. 存储与迁移策略

### 12.1 MVP 迁移原则

不要一次性迁移所有历史故事。

采用：

```text
懒迁移
```

策略：

- 新生成故事自动创建项目目录；
- 旧故事在首次进入编辑或导出时再生成 `project.json`；
- 保留原始故事 JSON 不变。

### 12.2 项目创建时机

两种可选策略：

#### 方案 A：首次生成即创建项目

优点：

- 结构统一；
- 后续编辑最顺畅。

缺点：

- 即使只看一次结果，也会生成项目目录。

#### 方案 B：进入编辑时创建项目

优点：

- 更省文件；
- 对纯浏览生成更轻。

缺点：

- 逻辑更分叉。

建议：

```text
采用方案 A：首次生成即创建项目。
```

这样后续版本、导出、编辑链路更一致。

---

## 13. 风险控制

### 13.1 不开放全文自由编辑

第一阶段禁止直接在前端任意改整篇 `full_text`。

### 13.2 scene 改动优先级高于 segment

如同时存在：

- `scene` 改动
- `segment-only` 改动

则导出时以当前版本快照为准，不在导出时做二次合并推导。

### 13.3 所有局部修改都写入版本记录

任何一次局部改动都必须：

- 生成新版本；
- 记录时间；
- 记录修改类型；
- 记录用户意图。

### 13.4 知识库条目不被修改

局部重生成不反写回知识库条目本身。

---

## 14. 推荐实施顺序

### Task 1：首页和导航工作台化

修改：

- `web/client/src/views/Home.vue`
- `web/client/src/App.vue`
- `web/client/src/router.ts`

实现：

- 首页入口化；
- 最近故事限制数量；
- “查看全部故事”；
- 新增“故事项目”导航入口。

### Task 2：故事项目基础模型

新增：

- `project-service.ts`
- `projects` 路由；
- 项目目录写入。

实现：

- 生成故事后自动创建项目；
- `/api/projects` 可读。

### Task 3：故事项目页

新增：

- `Projects.vue`

实现：

- 列表、搜索、筛选、排序、状态显示。

### Task 4：局部重生成 MVP

新增：

- `story-regenerate-service.ts`

实现：

- 单 `scene` 重生成；
- 关联 `gears_segment` 同步；
- 新版本写入。

### Task 5：segment 层重生成

实现：

- 单 `gears_segment` 重生成；
- 版本记录；
- 详情页可触发。

### Task 6：导出

新增：

- `story-export-service.ts`

实现：

- Markdown 导出；
- JSON 导出；
- GEARS segments 导出。

---

## 15. 测试计划

### 15.1 后端测试

新增测试：

```text
web/server/src/__tests__/project-service.test.ts
web/server/src/__tests__/story-regenerate-service.test.ts
web/server/src/__tests__/story-export-service.test.ts
```

覆盖：

- 生成故事时自动创建项目；
- 项目列表能返回；
- 局部重生成能创建新版本；
- 导出文件能落盘；
- 导出内容来自当前工作版本。

### 15.2 前端测试重点

验证：

- 首页只展示少量最近故事；
- 能进入“查看全部故事”；
- 知识库入口不再大面积占首页；
- 故事项目页可筛选；
- 单段修改入口存在；
- 导出按钮存在且可用。

---

## 16. 验收标准

功能验收：

- 首页变成工作台入口而不是内容堆叠页；
- 中国文化知识库不再大面积占首页；
- 最近故事只显示少量；
- 有独立故事项目页；
- 用户可对单场景或单段进行局部重生成；
- 用户可导出当前工作版本到本地。

数据验收：

- 新故事会创建项目目录；
- 每次局部修改都有版本记录；
- 导出文件可追溯到具体版本；
- 知识库原始条目文件不被改动。

工程验收：

- 旧 `/stories/*` 接口兼容；
- 新 `/projects/*` 接口可用；
- 前后端类型一致；
- 测试通过；
- 导出和版本结构清晰可维护。

---

## 17. 给 Claude Code 的执行指令

```text
现在开始实现 Story Agent 工作台化升级。

目标：
1. 首页从内容堆叠页改成工作台入口页。
2. 中国文化知识库作为一个知识库模块入口存在，不再在首页大面积展开。
3. 最近生成故事首页只展示少量，并增加“查看全部故事”入口。
4. 新增故事项目模型和项目列表页。
5. 生成故事后自动创建项目。
6. 支持单场景局部重生成，先不要做全文自由编辑。
7. 支持导出当前工作版本为 Markdown / JSON / GEARS segments。

约束：
- 不修改 data/provinces 中的知识库事实条目。
- 保持现有 /stories/* 接口兼容。
- 局部修改必须有版本记录。
- scene 改动优先联动 segment，segment-only 改动不强制反写 scene。
- 先做 scene 级重生成，再做 segment 级重生成。

请按以下顺序实施：
1. 首页与导航工作台化
2. 项目数据模型与后端项目接口
3. 故事项目页
4. scene 级局部重生成
5. 导出能力

完成后输出：
- 修改文件列表
- 新增 API 列表
- 新增类型列表
- 测试结果
- 一个局部重生成示例流程
```

