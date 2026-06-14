# AI 漫剧长篇创作能力交接文档

更新时间：2026-06-12

## 背景问题

本轮围绕 AI 漫剧长篇创作做了一次产品和工程层面的重构。原有 `target_video_duration` 只适合表达生成前的目标时长，不代表成稿后真实成片时长；同时长篇漫剧不应默认固定 60 集，也不应固定单集 1-2 分钟。

更关键的是，长篇内容不能一次性生成全部剧本。真正的核心能力是跨集连续性：人物弧线、伏笔、回收、上一集结尾钩子、未回收线索、知识依据边界，都需要在后续单集生成时被持续带入。

因此当前实现采用“两层生成”：

1. 先生成系列规划层，可审核、可编辑、可保存。
2. 再从某一集卡片进入单集完整分镜生成。

## 已落地能力

### 系列规划页面

新增页面：

- `/ai-comic-series/new`

顶部导航新增：

- `漫剧系列`

页面表单支持：

- 系列名
- 故事梗概
- 总集数，默认 60，可选 1-120
- 单集最短秒数，默认 60
- 单集最长秒数，默认 120
- 节奏：
  - 均衡剧情
  - 强钩子快节奏
  - 慢热铺陈
  - 悬念钩子

结果展示：

- 系列蓝图
- 连续性账本
- 阶段结构
- 角色弧线
- 长期线索
- 分集卡片
- 单集完整分镜结果
- 连续性规则

### 系列规划 API

新增 API：

- `POST /api/story-outline/ai-comic-series-plan`

服务入口：

- `generateAiComicSeriesPlan`

核心输出：

- `AiComicSeriesPlan`

每集卡片包含：

- `episode_no`
- `title`
- `target_duration_sec`
- `target_panel_count`
- `story_phase`
- `main_conflict`
- `key_characters`
- `continuity_from_previous`
- `new_information`
- `foreshadowing`
- `payoff`
- `ending_hook`
- `knowledge_focus`
- `continuity_state_after`

### 单集分镜生成

新增 API：

- `POST /api/story-outline/ai-comic-episode`

服务入口：

- `generateAiComicEpisodeFromPlan`

输入：

- `series_plan`
- `episode_no`
- 可选 `series_project_id`
- 可选 `knowledge_pack`
- 可选 `model_profile_id`
- 可选 `output_gears_segments`

输出：

- 复用现有 `StoryGenerateResult`

生成策略：

- 只生成指定一集，不生成其他集。
- 单集生成时构造详细 `original_user_query` 和 `outline`。
- 上下文包括：
  - 系列名、梗概、主题
  - 当前集标题、目标秒数、目标格数
  - 当前阶段目标和阶段转折
  - 本集主冲突
  - 关键角色
  - 承接上一集
  - 上一集结尾钩子
  - 本集新增信息
  - 本集伏笔与回收
  - 本集结尾钩子
  - 本集后连续性状态
  - 下一集需要承接内容
  - 长期线索
  - 角色弧线
  - 连续性规则
  - 知识焦点

### 连续性账本

新增类型：

- `AiComicContinuityLedger`
- `AiComicContinuityLedgerEpisode`

账本存储在：

- `AiComicSeriesProjectDetail.continuity_ledger`

账本字段：

- `last_generated_episode_no`
- `character_state_current`
- `open_threads`
- `paid_off_threads`
- `knowledge_used`
- `episode_records`

每条生成记录包含：

- `episode_no`
- `story_id`
- `title`
- `generated_at`
- `character_state`
- `opened_threads`
- `paid_off_threads`
- `pending_threads_after`
- `knowledge_used`
- `ending_hook`
- `next_episode_memory`

关键改进：

- 单集生成传入 `series_project_id` 时，会读取已保存项目的连续性账本。
- 账本会进入下一集生成上下文。
- 第 N 集生成时可看到之前真实生成后的状态，而不只是原始 plan 里的静态设定。
- 如果传入不存在的 `series_project_id`，接口返回 `STORY_NOT_FOUND`，HTTP 404，避免生成无法回写账本的孤立分镜。

### 系列项目保存

保存位置：

- `web/generated/ai-comic-series-projects/{seriesProjectId}/project.json`

新增 API：

- `GET /api/story-outline/ai-comic-series-projects`
- `POST /api/story-outline/ai-comic-series-projects`
- `GET /api/story-outline/ai-comic-series-projects/:seriesProjectId`
- `POST /api/story-outline/ai-comic-episode-context-preview`

新增类型：

- `AiComicSeriesProjectMeta`
- `AiComicSeriesProjectDetail`
- `AiComicSeriesProjectSaveRequest`

前端行为：

- 生成系列规划后自动保存。
- URL 写入 `?seriesProjectId=...`。
- 刷新页面后自动恢复保存项目。
- 保存 `generated_episode_story_ids`。
- 保存并展示 `continuity_ledger`。
- 左侧新增“已保存系列”列表，可刷新、查看集数/已生成分镜数/更新时间、点击打开项目。

### 分集卡片编辑

每个分集卡片支持编辑：

- 标题
- 目标秒数
- 目标格数
- 主冲突
- 承接
- 新增信息
- 伏笔
- 回收
- 结尾钩子
- 关键角色
- 知识焦点
- 本集后连续性状态

编辑保存后会更新系列项目。

生成按钮在编辑状态下禁用，避免编辑草稿和生成请求交叉。

### 单集生成上下文预览

在生成完整分镜前，分集卡片可先预览将要带入生成器的上下文。

预览内容包含：

- 本集生成蓝图
- 是否使用保存项目的连续性账本
- 当前角色状态、未回收线索、已回收线索和知识使用摘要
- 上一集生成记忆
- 下一集承接要求
- 完整生成提纲

后端服务：

- `previewAiComicEpisodeContext`

前端行为：

- 每个分集卡片新增“预览生成上下文”按钮。
- 如果当前系列尚未保存，预览前会先保存系列项目。
- 预览请求期间禁用编辑、预览和生成，避免状态交叉。
- 预览区展示实际会进入单集生成的连续性上下文。

## 关键文件

### 新增文件

- `web/server/src/services/ai-comic-series-service.ts`
- `web/client/src/views/AiComicSeriesStudio.vue`

### 修改文件

- `web/shared/types.ts`
- `web/shared/schemas.ts`
- `web/server/src/routes/outline.ts`
- `web/client/src/api/stories.ts`
- `web/client/src/router.ts`
- `web/client/src/App.vue`
- `web/server/src/__tests__/outline-service.test.ts`
- `web/server/src/__tests__/api.test.ts`

## 类型与校验

新增核心类型：

- `AiComicPacingProfile`
- `AiComicGenerationScope`
- `AiComicDurationRange`
- `AiComicSeriesPlanRequest`
- `AiComicSeriesCharacterArc`
- `AiComicPlotThread`
- `AiComicContinuityRule`
- `AiComicSeriesPhase`
- `AiComicEpisodePlan`
- `AiComicSeriesPlan`
- `AiComicSeriesProjectMeta`
- `AiComicSeriesProjectDetail`
- `AiComicSeriesProjectSaveRequest`
- `AiComicEpisodeGenerateRequest`
- `AiComicContinuityLedger`
- `AiComicContinuityLedgerEpisode`

新增校验：

- `AiComicSeriesPlanRequestSchema`
- `AiComicSeriesPlanSchema`
- `AiComicSeriesProjectSaveRequestSchema`
- `AiComicEpisodeGenerateRequestSchema`
- `AiComicContinuityLedgerSchema`

关键规则：

- `episode_count`: 1 到 120
- `episode_duration_range_sec.min/max`: 30 到 1200
- `min <= max`
- `episode_no <= series_plan.episode_count`
- `series_project_id` 使用 `YYYYMMDD-series-xxxxxxxx` 格式

## 测试覆盖

已补测试：

- 系列规划支持可选集数、时长范围和连续性字段。
- 单集可从系列规划生成完整分镜。
- 系列项目可保存、读取、列表查询。
- 生成单集后会更新连续性账本。
- 后续单集生成会读取保存项目中的连续性账本。
- API 层覆盖：
  - 生成系列规划成功
  - 非法 `episode_count`
  - 非法时长范围
  - 生成单集成功
  - 非法 `episode_no`
  - 保存/读取系列项目
  - 未知系列项目返回 404

验证命令：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web/server
npm run lint
npm test -- outline-service api
```

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web/client
npm run build
```

最近验证结果：

- `web/server npm run lint` 通过
- `web/client npm run build` 通过
- `web/server npm test -- outline-service api` 通过，76 tests passed

注意：

- `api.test.ts` 使用 Supertest，会临时监听本地端口；在受限沙箱里可能出现 `listen EPERM: operation not permitted 0.0.0.0`。需要用允许本地监听的方式重跑。

## 浏览器验证

已用本地 dev server 验证：

- 后端：`http://localhost:3000`
- 前端：`http://127.0.0.1:5173`
- 页面：`http://127.0.0.1:5173/ai-comic-series/new`

验证流程：

1. 打开漫剧系列页面。
2. 输入 4 集测试系列。
3. 生成系列规划。
4. 确认 URL 出现 `seriesProjectId`。
5. 确认左侧“已保存系列”出现该项目。
6. 确认连续性账本可见。
7. 刷新页面。
8. 确认项目自动恢复。
9. 检查浏览器控制台无错误。

验证后：

- 临时 dev server 已停止。
- `3000` 和 `5173` 端口已释放。
- 浏览器验证创建的临时测试项目已删除。

## 产品判断

当前实现不是“一次性生成 60 集剧本”，而是“可保存、可编辑、可逐集推进的系列规划工作台”。

这是刻意设计：

- 长篇内容一次性生成全部剧本会丢失审核、编辑和连续性控制。
- 系列规划层先解决宏观结构、角色弧线、伏笔和回收。
- 单集生成只针对当前集，能更稳定地产出完整分镜。
- 连续性账本把已生成内容反向写回下一次生成上下文。

## 已知工作区状态

当前工作区还有其他并行改动，不属于本轮全部内容：

- GEARS 回调/成片状态相关改动
- `data/provinces/湖南.md`
- `mcp-server/*`
- 部分 docs/scripts

这些改动没有被回退。

## 已完成增强

这些原先的高优先级下一步已经完成：

1. 已生成分镜可从分集卡片打开故事项目，也可进入故事详情。
2. 已生成分集卡片被编辑时，前端会提示建议重新生成。
3. 系列级审计会标记 `plan_changed_after_generation`、`needs_episode_regeneration` 和 `needs_ledger_rebuild`。
4. 系列页会根据连续性账本推荐下一集生成入口。
5. 已支持从第 N 集重建连续性账本。
6. 系列规划已增加主线剧情骨架，分集卡片已增加开场钩子、中段转折、结尾钩子类型、角色状态变化和线索开合动作。
7. 单集生成前会构造 `AiComicEpisodeBlueprint`，生成后返回蓝图、单集质量报告和连续性审计。
8. AI 漫剧单集生成已支持生成后自动调整类型质量问题。
9. 已支持导出系列 Bible Markdown / JSON，包含主线骨架、角色弧线、长期线索、连续性账本、系列质量审计和分集蓝图。
10. 已支持单集生成上下文预览，可在生成前查看本集蓝图、账本摘要、上一集记忆和完整生成提纲。

## 建议下一步

优先级较高：

1. 将保存的系列项目纳入现有项目系统，而不只是 `web/generated/ai-comic-series-projects` 文件存储。
2. 支持系列项目复制、归档、删除。
3. 支持批量检查所有分集卡片的伏笔/回收闭环。

可继续增强：

1. 为系列规划增加手动保存按钮和保存状态提示，降低自动保存不确定感。
2. 给长期线索增加状态字段：未开启、进行中、已回收、废弃。
3. 给角色弧线增加当前阶段状态，而不是只放文本数组。
4. 给单集蓝图增加可视化时间轴。
5. 支持按角色或线索过滤分集卡片。

## 新对话接手提示

建议新对话从这里继续：

> 仓库 `/Users/wuyu/Desktop/china-culture-kb`，继续完善 AI 漫剧长篇创作。当前已有系列规划页 `/ai-comic-series/new`、系列项目保存、分集卡片编辑、单集分镜生成、连续性账本、系列质量审计、分集蓝图、系列 Bible 导出、单集生成上下文预览、已生成分镜跳转、计划变更提示、账本重建和下一集推荐生成。请先阅读 `docs/ai-comic-series-longform-handoff.md` 和相关文件，再继续实现下一步：系列项目复制/归档/删除，或批量检查所有分集卡片的伏笔/回收闭环。
