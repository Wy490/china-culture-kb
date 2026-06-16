# AI 漫剧长篇创作能力交接文档

更新时间：2026-06-16

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
- `AiComicSeriesMemory`
- `AiComicSeriesMemoryItem`

账本存储在：

- `AiComicSeriesProjectDetail.continuity_ledger`

账本字段：

- `last_generated_episode_no`
- `character_state_current`
- `open_threads`
- `paid_off_threads`
- `knowledge_used`
- `episode_records`
- `series_memory`
- `episodic_memory`

`series_memory` 字段是系列记忆引擎的结构化记忆层，按编剧语义保存：

- 角色记忆：当前状态、长弧、视觉识别、相关集数。
- 关系记忆：后续用于记录人物关系变化。
- 道具记忆：伏笔道具、信物、物件状态和归属。
- 地点记忆：空间用途、状态变化和连续性约束。
- 视觉资产记忆：角色外观、服装、道具、固定场景识别。
- 知识边界记忆：知识库条目的事实边界和戏剧化补足边界。
- 关键事件记忆：每集主冲突、结尾钩子和后续状态。
- 待核冲突：角色、线索、道具、知识边界的潜在冲突。

`episodic_memory` 字段是长期情景记忆层，按已生成内容保存 embedding-ready 片段：

- 场景记忆：从 `scene_breakdown` 提取关键动作、对白/旁白、视觉提示、冲突功能。
- 对白记忆：从对白块提取人物关系、语气和可回声的关键表达。
- GEARS 记忆：从分段脚本、目的、视觉焦点和提示词 hint 提取场景回声。
- Seedance 镜头记忆：从镜头提示词、运镜、连续性提示中提取视觉/情绪片段。
- 当前实现使用 `lexical-token-signature/v1` 做本地词元签名检索，结构已为后续 embedding / 向量库替换预留。

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
- 第 N 集生成时会额外带入系列记忆精准召回包；召回依据包括本集关键角色、知识焦点、主冲突、承接/伏笔/回收、相关集数和长期线索匹配，帮助保持角色、地点、道具、视觉资产和知识边界的跨集一致。
- 上下文预览和单集生成支持 `memory_recall_controls`，可传 `locked_memory_ids` 和 `excluded_memory_ids`；锁定优先于排除，用于人工指定必须带入或暂时忽略的记忆项。
- 系列项目支持 `memory_recall_preferences`，会保存全局锁定/排除偏好，也支持 `per_episode` 保存分集级偏好；上下文预览和单集生成在没有传临时控制项时默认应用“全局偏好 + 当前集偏好”。
- 前端上下文预览区支持按记忆类型、锁定/排除状态和实体关键词筛选召回项，可单条锁定/排除，也可对当前筛选范围批量锁定、批量排除或批量清空偏好，并可导入/导出记忆召回偏好 JSON，便于系列副本、协作交接和回滚版本复用。
- 单集生成完成后，账本会从真实成稿中补充记忆：场景地点、出场角色、视觉提示中的服饰/道具/固定陈设、对白关系、场景知识来源、知识包条目、GEARS 分段级视觉/道具/知识边界，以及 Seedance 镜头提示词中的地点、视觉资产、道具、运镜连续性、禁用元素和知识边界。
- 单集生成完成后，账本还会更新 `episodic_memory`，把场景、对白、GEARS 分段和 Seedance 镜头沉淀为长期情景记忆；第 N 集预览/生成会模糊召回上一集和近期相关片段，帮助延续情绪回声、对白呼应、场景氛围和人物选择。
- 账本新增 `production_constraints` 制作约束表，独立保存系列连续性规则、生产备注、Seedance 镜头连续性、禁用元素、运镜、视觉资产和文化边界；上下文预览会显示约束摘要，单集生成提纲会带入“制作约束审计”，系列 Bible 会导出“制作约束表”。
- 系列质量审计新增 `memory_conflict_report`，按角色状态、地点状态、关系状态、知识边界和制作约束分类检测冲突，并按阻断、警告、观察给出修复建议；上下文预览会显示冲突摘要，系列 Bible 会导出记忆冲突摘要。
- 系列工作台已支持导出已生成分集的 Seedance 2.0 镜头提示词 Markdown / JSON；后端接口为 `POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-prompts`，返回 `ai-comic-series-seedance-export/v1`，并同步登记 `seedance_production` 生产账本。
- Seedance 生产状态支持镜头级和批量更新：`POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-production-status` 可更新单个镜头；`POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-production-status/batch` 可批量更新状态或导入视频 URL 回传。状态可保存 job id、视频 URL、失败原因、重试计数和备注；每次带 job、视频 URL 或失败原因的更新会追加镜头级 `versions` 视频版本记录；前端系列工作台已有轻量状态看板、批量流转按钮和 JSON 回传导入。
- Seedance 外部平台回调已进入同一套账本：`POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-production-callback` 支持 `provider_job_id` / `job_id` / `jobId` 定位，也支持 `episode_no + shot_id` 定位；`COMPLETED`、`succeeded`、`done` 等状态会归一为 `ready`，`running` / `queued` 等会归一为制作中状态，视频 URL 会追加为新版本；若配置 `SEEDANCE_CALLBACK_SECRET`，回调必须携带 `x-seedance-callback-secret` 或 `Authorization: Bearer <secret>`。
- 回片版本可保存 `quality_score` 和 `review_note`，callback 与手动状态更新均可写入；剪辑包会带出被选版本的质量分和评审备注，便于剪辑台或后续自动择优使用。
- 回片版本支持人工指定剪辑版：`POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-production-version` 可传 `episode_no`、`shot_id`、`version_id`，将某个 ready 版本设为 `selected_version_id`；前端状态板会展示最近版本并提供“设为剪辑版”按钮。
- 回片版本支持自动择优：`POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-production-version/auto` 可按 ready 版本自动设置 `selected_version_id`；默认不覆盖人工选择，`overwrite_manual: true` 时可重算；排序规则为质量分高者优先，同分取最新，无质量分时按最新 ready 版本兜底；可选 `min_quality_score` 过滤低分版本。前端状态板提供“自动择优剪辑版”按钮。
- 回片后可导出剪辑交付包：`POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-cut-package` 返回 `ai-comic-series-seedance-cut-package/v1`，只汇总状态为 `ready` 且存在视频 URL 的镜头，按集和镜头顺序输出 Markdown / JSON，并列出仍缺失的镜头；若镜头已设置 `selected_version_id`，剪辑包优先采用该版本，否则采用最新 ready 版本，供剪辑、自动组装或外部资产流水线继续处理。
- Seedance 剪辑装配 worker 已接入：`POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-cut/assemble` 读取剪辑交付包，支持 `dry_run`、`overwrite`、`episode_no`、`output_filename`、`assembly_mode`、`output_profile`、`fps`、`crf`、`preset`，会写出 ffmpeg concat 清单；`assembly_mode=copy` 走快速无损 concat，`assembly_mode=transcode` 输出 H.264/AAC MP4，可选 1080p / 720p profile；真实执行时输出到系列项目目录下的 `cuts/...`，并把 `planned` / `ready` / `failed` / `skipped` 状态写回 `seedance_cut_assembly`；前端系列工作台和项目总览都可触发装配或转码装配。
- 失败或缺失镜头可导出重试提交包：`POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-retry-package` 返回 `ai-comic-series-seedance-retry-package/v1`，从已生成 Seedance 提示词中筛出失败、未完成、缺视频 URL 或尚未提交的镜头，保留原始镜头提示词、失败原因、重试次数和建议动作；系列工作台和项目总览均可下载 Markdown，工作台也支持 JSON。
- 回片版本可导出对比报告：`POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-version-comparison` 返回 `ai-comic-series-seedance-version-comparison/v1`，按镜头列出所有视频版本、质量分、评审备注、失败原因、当前剪辑版、自动推荐版本和选择说明；系列工作台支持 Markdown / JSON 下载，也可打开版本对比面板直接播放/打开视频版本并改选剪辑版，项目总览支持 Markdown 快捷下载。
- Seedance 素材引用可导出完整性报告：`POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-asset-report` 返回 `ai-comic-series-seedance-asset-report/v1`，从已生成分集的 Seedance 提示词包解析人物/场景素材、`@图片` 槽位、镜头绑定、缺槽位镜头和需上传素材项；系列工作台支持 Markdown / JSON 下载，并可导入素材库绑定 JSON。
- Seedance 素材库绑定可持久化到系列项目：`POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-asset-library` 可写入素材 `kind`、`label`、`reference_slot`、`file_url`、`file_id` 和说明；素材报告会合并该库，识别 `bound`、`missing_file`、`missing_reference_slot` 三种状态。
- Seedance 剪辑台资产包可导出：`POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-edit-asset-package` 返回 `ai-comic-series-seedance-edit-asset-package/v1`，把剪辑交付包中的 ready 视频、选中版本、镜头顺序与素材报告中的绑定文件、素材槽位和缺失素材项合并输出；系列工作台支持 Markdown / JSON 下载。
- Seedance 缩略图抽帧计划可导出：`POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-thumbnail-plan` 返回 `ai-comic-series-seedance-thumbnail-plan/v1`，复用剪辑交付包中的 ready 视频和选中版本，给每个镜头输出抽帧秒、缩略图输出路径、文件名和 ffmpeg 命令提示；系列工作台支持 Markdown / JSON 下载。
- Seedance 缩略图抽帧 worker 已接入：`POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-thumbnails/capture` 读取缩略图计划包，支持 `dry_run`、`overwrite`、`episode_no`、`shot_id`、`limit`，真实执行时调用 ffmpeg 保存到系列项目目录下的 `thumbnails/...`，并把 `planned` / `ready` / `failed` / `skipped` 缩略图状态写回 `seedance_production.items[].thumbnail`；前端系列工作台和项目总览都可触发抽帧。
- Seedance 成片精修计划可导出：`POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-finishing-plan` 返回 `ai-comic-series-seedance-finishing-plan/v1`，汇总装配成片路径、镜头时间轴、缩略图路径、SRT 字幕 cue、音乐/音效 cue、片头片尾卡和质检清单；系列工作台支持 Markdown / JSON 下载，项目总览支持 Markdown 快捷下载。
- 如果传入不存在的 `series_project_id`，接口返回 `STORY_NOT_FOUND`，HTTP 404，避免生成无法回写账本的孤立分镜。

### 系列项目保存

保存位置：

- `web/generated/ai-comic-series-projects/{seriesProjectId}/project.json`

新增 API：

- `GET /api/story-outline/ai-comic-series-projects`
- `POST /api/story-outline/ai-comic-series-projects`
- `GET /api/story-outline/ai-comic-series-projects/:seriesProjectId`
- `POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/copy`
- `POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/archive`
- `DELETE /api/story-outline/ai-comic-series-projects/:seriesProjectId`
- `POST /api/story-outline/ai-comic-episode-context-preview`

新增类型：

- `AiComicSeriesProjectMeta`
- `AiComicSeriesProjectDetail`
- `AiComicSeriesProjectSaveRequest`
- `AiComicSeriesProjectCopyRequest`
- `AiComicSeriesProjectArchiveRequest`
- `AiComicSeriesProjectDeleteResult`

前端行为：

- 生成系列规划后自动保存。
- URL 写入 `?seriesProjectId=...`。
- 刷新页面后自动恢复保存项目。
- 保存 `generated_episode_story_ids`。
- 保存并展示 `continuity_ledger`。
- 左侧“已保存系列”列表可刷新、查看集数/已生成分镜数/更新时间、点击打开项目。
- 保存列表支持复制系列项目、归档/恢复系列项目、删除系列项目。
- 列表默认隐藏已归档项目，可勾选“显示归档”查看并恢复。

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
- 预览区展示本集精准召回的系列记忆，可筛选、锁定、排除、批量清理，并将分集级偏好持久化到系列项目。

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
11. 已支持系列项目复制、归档/恢复和删除；保存列表默认隐藏已归档项目，可手动显示归档项。
12. 已安装 `anysearch-skill` 到 `/Users/wuyu/.codex/skills/anysearch-skill`。重启 Codex 后可在技能清单中直接使用；当前会话中 CLI 可运行，但匿名额度已用完，未把自动生成的密钥写入磁盘。
13. 已新增 15 个成片类型的样片参考矩阵：`docs/video-type-sample-reference-matrix.md`。样片化规则已接入 `genre-story-profiles`、生成提示词和类型质量调整建议。
14. 已根据用户提供的抖音视频观点“AI真正认识你的是知识库，而不是资料仓库”更新 Agent 知识观。由于抖音短链无法取得逐字稿、AnySearch 匿名额度已耗尽，本轮只基于可确认标题与项目需求沉淀原则；已把“知识库不是资料仓库”接入知识库撰写规范、平台路线图、全故事生成提示词、单场重写提示词和 AI 漫剧单集生成上下文。
15. 已新增全类型叙事流派库：`web/server/src/services/narrative-pattern-library.ts`。覆盖全部 15 个 `VideoType`，包含凡人流成长、无限流任务生存、历史因果讲述、权谋博弈、悬疑揭示、匠艺精进、纪实追踪、认知缺口讲解、教学闭环、空间导览、诗性山水、儿童寓言等结构机制；已接入故事生成提示词、故事蓝图和类型质量修复建议。该库只蒸馏叙事机制，不复制具体小说情节、角色、台词或作者文风。
16. 已把叙事流派库产品化为可见、可选、可传参的生成能力：新增 `NarrativePatternId` / `NarrativePatternCatalog` 类型、`narrative_pattern_ids` 生成请求字段、Zod 校验、`GET /api/system/narrative-patterns` 接口、前端 `StoryStudio` 流派强化选择区。用户可在成片类型默认流派基础上勾选强化流派，后端会把用户选择排在默认流派前进入提示词、故事蓝图和质量修复建议。
17. 已把叙事流派强化贯穿 AI 漫剧长篇系统：`AiComicSeriesPlanRequest`、`AiComicSeriesPlan`、单集生成请求和上下文预览请求均支持 `narrative_pattern_ids`；`AiComicSeriesStudio` 可选择 AI 漫剧流派机制；系列规划会保存选择，连续性规则、production notes、单集生成提纲、上下文预览、最终故事生成请求都会带入流派机制。
18. 已新增能力缺口分析文档：`docs/ai-comic-series-capability-gap-analysis.md`，列出当前系统已具备能力、高优先级缺口和建议下一步。当前建议优先做批量伏笔/回收闭环检查、流派机制质量评分升级、系列项目统一入口和镜头级视频提示词导出。
19. 已新增系列线索闭环报告：`AiComicThreadClosureReport` 会进入 `series_quality_audit.thread_closure_report`，批量检查长期线索的开启、推进、回收、超期、未绑定伏笔和重复伏笔；前端系列质量审计面板会显示线索闭环统计、重点问题和修复建议；系列 Bible Markdown / JSON 导出也会包含线索闭环摘要。
20. 已新增系列记忆引擎 V1-V12 基础能力：连续性账本内保存结构化记忆，单集生成和上下文预览会精准召回；生成后会从 `scene_breakdown`、对白、知识包、GEARS 分段和 Seedance 镜头提示词中抽取记忆事件；前端支持召回项筛选、锁定、排除、按筛选范围批量锁定/排除/清理、分集偏好持久化和偏好 JSON 导入/导出；制作约束表已进入账本、上下文预览、生成提纲和 Bible 导出；记忆冲突报告已进入系列质量审计、上下文预览和 Bible；长期情景记忆 `episodic_memory` 已用词元签名索引沉淀场景、对白、GEARS 和 Seedance 镜头片段，并进入上下文预览、生成提纲和 Bible 的“情景记忆表”。
21. 已新增系列级 Seedance 2.0 镜头提示词导出：复用单故事 `buildSeedancePromptPackage`，按已生成分集合并为 Markdown / JSON，前端系列工作台可直接下载，未生成或缺失 story 会进入 `missing_episodes`；导出后会自动登记镜头生产账本，支持镜头级状态追踪、快捷更新、批量流转和视频 URL 回传 JSON 导入。
22. 已新增 Seedance 视频版本交付闭环：生产账本支持外部回调、质量分、评审备注、视频版本记录、人工指定剪辑版、自动择优、剪辑交付包、重试提交包和版本对比报告；版本对比报告接口为 `export-seedance-version-comparison`，会列出当前剪辑版、自动推荐版本、版本排序、失败原因和选择说明；系列工作台已有可播放的视频版本对比面板，可直接改选剪辑版并刷新账本。
23. 已新增 Seedance 素材引用完整性报告和素材库绑定：接口为 `export-seedance-asset-report`，从现有 `asset_reference_plan` 和镜头人物/场景字段生成素材清单、镜头绑定表、缺槽位统计和需上传素材统计；接口 `seedance-asset-library` 可保存素材 URL/文件 ID，报告会识别已绑定文件和缺文件项。
24. 已新增 Seedance 剪辑台资产包：接口为 `export-seedance-edit-asset-package`，合并 ready 视频、选中版本、镜头顺序、素材槽位、绑定文件和缺失素材项，供剪辑台或自动组装流水线使用。
25. 已新增 Seedance 缩略图抽帧计划包：接口为 `export-seedance-thumbnail-plan`，输出 ready 视频、选中版本、抽帧秒、缩略图文件名、输出路径和 ffmpeg 命令提示。
26. 已新增 Seedance 缩略图抽帧 worker：接口为 `seedance-thumbnails/capture`，读取计划包执行或 dry-run 准备 ffmpeg 抽帧，保存输出路径，并将缩略图状态接入前端和 `seedance_production` 生产账本。
27. 已新增 Seedance 剪辑装配 worker：接口为 `seedance-cut/assemble`，读取剪辑交付包执行或 dry-run 准备 ffmpeg concat 拼接，保存输出路径、concat 清单和命令，并将装配状态接入前端和 `seedance_cut_assembly` 账本；支持 source copy 快速拼接和 H.264/AAC 转码装配两种模式。
28. 已新增 Seedance 成片精修计划包：接口为 `export-seedance-finishing-plan`，复用剪辑交付包、缩略图计划、装配账本和 Seedance prompt，生成镜头时间轴、字幕 cue、音频 cue、片头片尾卡、推荐输出 profile 和质检清单。

## 建议下一步

优先级较高：

1. 将保存的系列项目纳入现有项目系统，而不只是 `web/generated/ai-comic-series-projects` 文件存储。
2. 在 `episodic_memory` 现有结构上接入真实 embedding / 向量库，并用 30 集以上系列评估关键对白、情绪转折和场景回声的召回质量。
3. 将流派机制质量评分升级为可解释检查项，例如凡人流、无限流、历史因果、权谋博弈分别有专属满足信号和修复建议。
4. 将 Seedance 后期从精修计划包继续升级为真实字幕烧录、混音、片头片尾渲染 worker，并适配外部剪辑平台导入格式。
5. 为 `anysearch-skill` 配置正式 API key 后，可继续扩展样片参考库，把每个类型补到 5-10 个可追踪样片源。
6. 将知识条目的 `relationship_to_primary_entry`、`credibility_note`、`cultural_risks` 等 Agent 可读字段继续产品化，避免资料补录只停留在长文本摘要。

可继续增强：

1. 为系列规划增加手动保存按钮和保存状态提示，降低自动保存不确定感。
2. 给长期线索增加状态字段：未开启、进行中、已回收、废弃。
3. 给角色弧线增加当前阶段状态，而不是只放文本数组。
4. 给单集蓝图增加可视化时间轴。
5. 支持按角色或线索过滤分集卡片。

## 新对话接手提示

建议新对话从这里继续：

> 仓库 `/Users/wuyu/Desktop/china-culture-kb`，继续完善 AI 漫剧长篇创作。当前已有系列规划页 `/ai-comic-series/new`、系列项目保存、复制、归档、删除、分集卡片编辑、单集分镜生成、连续性账本、系列记忆引擎、长期情景记忆索引、制作约束表、记忆冲突报告、记忆召回偏好导入/导出、记忆批量锁定/排除、系列质量审计、线索闭环报告、分集蓝图、系列 Bible 导出、系列 Seedance 镜头提示词导出、Seedance 镜头生产状态账本、带密钥外部回调、视频版本记录、质量分/评审备注、剪辑版手动选择、剪辑版自动择优、批量状态流转、视频 URL 回传导入、Seedance 剪辑交付包、Seedance 重试提交包、Seedance 版本对比报告和可播放对比面板、Seedance 素材引用完整性报告和素材库绑定导入、Seedance 剪辑台资产包、Seedance 缩略图抽帧计划包、Seedance 缩略图抽帧 worker、Seedance 剪辑装配 worker、Seedance H.264/AAC 转码装配、单集生成上下文预览、已生成分镜跳转、计划变更提示、账本重建、下一集推荐生成和叙事流派强化。请先阅读 `docs/ai-comic-series-longform-handoff.md` 和相关文件，再继续实现下一步：真实 embedding / 向量库接入、流派机制质量评分升级、外部剪辑平台/音频字幕片头片尾策略，或知识条目 Agent 可读字段产品化。
