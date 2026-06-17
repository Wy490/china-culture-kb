# Story Agent 下一对话接续文档

> 日期：2026-06-17  
> 当前分支：`codex-ai-comic-series-longform`  
> 适用场景：在新的 Codex / Claude 对话中继续 Story Agent、Production Board、GEARS / Seedance 交付链开发。  
> 当前状态：本轮开发成果尚未提交，继续前先执行 `git status --short`。

## 1. 新对话优先阅读

请先阅读这些文件，再继续开发：

- `docs/story-agent-next-conversation-handoff.md`
- `docs/story-agent-production-workbench-development-plan.md`
- `开发文档/story-agent-mcp-quality-delivery-implementation-plan.md`
- `.codex/mcp-upgrade-roadmap.md`
- `docs/ai-comic-series-seedance-post-production-development-plan.md`
- `开发文档/installed-ai-tools.md`
- `.codex/skills/china-culture-story-agent/SKILL.md`
- `.codex/skills/gears-seedance-delivery/SKILL.md`

继续开发时应使用项目技能：

- `china-culture-story-agent`：StoryBlueprint、类型片质量、修复、项目版本。
- `gears-seedance-delivery`：GEARS 字段分离、Seedance prompt、prompt 清洗、交付 readiness。
- `agent-dev-standards`：小步实现、测试优先、文档与代码同步。

## 2. 总体进度判断

根据开发计划文档和当前代码状态：

| 模块 | 进度判断 | 说明 |
|---|---:|---|
| Story Agent MVP | 约 75% | 生成、质量报告、修复、项目版本、前端查看已跑通。 |
| Production Board / GEARS / Seedance 交付链 | 约 60% -> 本轮推进到约 65% | Board、监督、批量修复、导出已可用；本轮补了单任务修复、结果 diff、空修复不增版本。 |
| AI 漫剧系列生产链 | 约 45% | 系列规划、Seedance 生产账本、回片、剪辑包、缩略图、初版装配、精修计划已具备；字幕/混音/片头片尾/final delivery 仍待做。 |
| 可商用制作中台 | 约 35-40% | 主链路可用，但还缺 UX 降噪、资产绑定、状态总览、回滚、审片返修和稳定压测。 |
| MCP Story Agent 闭环 | 约 35-40% | `kb_get_project_context`、`kb_generate_story_blueprint`、`kb_validate_genre_story` 已完成；GEARS/Seedance/repair/version 写入工具待做。 |

当前主线已经不是“能不能生成故事”，而是“生成后能不能低复杂度管理、修复、交付、回片、装配”。

## 3. 已完成能力

### 3.1 MCP / Agent 基础

已完成：

- Mac Codex 已接入 `china-culture-kb` MCP。
- 项目级 skills 已建立：
  - `china-culture-story-agent`
  - `china-culture-screenwriting`
  - `gears-seedance-delivery`
- MCP 已有 17 个工具。
- Story Agent 相关 MCP 已完成：
  - `kb_get_project_context`
  - `kb_generate_story_blueprint`
  - `kb_validate_genre_story`
- 文档已记录 MCP roadmap、工具清单、技能路径和跨机器工具环境。

仍待做：

- `kb_generate_gears_delivery`
- `kb_generate_seedance_prompt`
- `kb_repair_story(auto_apply=false)`
- `kb_update_project_version`
- `kb_repair_story(auto_apply=true)`

MCP 原则：

- 先只读，后写入。
- 生成、修复、交付内容不得写入 `data/provinces/*.md`。
- MCP 行为尽量和 Web 服务共享逻辑，避免第二套 Story Agent。

### 3.2 Web Story Agent / 项目工作台

已完成：

- 故事生成。
- 项目列表与项目详情。
- 质量报告：Outline Coverage、Pattern Quality、GEARS Readiness。
- 一键质量修复。
- 项目版本记录和 repair trace。
- Production Board 初版。
- Supervision Agent 初版。
- Production Board 批量修复。
- Production Board 交付包落盘。
- AI 漫剧系列入口与部分生产工具。

本轮已继续完成：

- 故事项目列表选择入口更明显：
  - 表头显示“全选”。
  - 行选择显示“选择 / 已选”。
  - 选择列 sticky。
  - 批量栏有选中项时高亮。
- 高风险低频的“仅保留最近 10 个”移入“清理操作”。
- 生成故事页最近故事增加单条删除。
- 删除成功反馈显示清理的关联故事文件数量。
- Production Board 修复任务卡增加“修复此项”。
- Production Board 修复结果增加轻量 diff：
  - 交付阶段
  - 阻断项
  - 监督分
  - QA 分
  - 剩余修复任务数
  - 变更场景列表
- Production Board 空修复不再创建新版本。

### 3.3 后端与测试基础

本轮已完成：

- `repairProjectProductionBoard` 在 trace 未实际应用时直接返回结果，不写新版本。
- 项目删除 API 测试覆盖 `removed_story_file_count`。
- Production Board 单任务修复服务测试覆盖 `task_ids`。
- Production Board 单任务修复路由测试覆盖 `POST /api/projects/:projectId/production-board/repair`。
- 新增 `WEB_GENERATED_ROOT`，测试或多实例运行时可覆盖默认 `web/generated` 根目录。
- 修复后台 webhook / gears video / gears delivery 异步回写时因环境变量恢复而串到默认 generated 目录的问题。
- API 测试会隔离生成物，当前已确认不再留下 `web/web/generated/projects` 测试残留。

当前未提交改动文件：

- `docs/story-agent-production-workbench-development-plan.md`
- `web/client/src/views/ProjectDetail.vue`
- `web/client/src/views/Projects.vue`
- `web/client/src/views/StoryStudio.vue`
- `web/server/src/__tests__/api.test.ts`
- `web/server/src/__tests__/project-service.test.ts`
- `web/server/src/services/ai-comic-series-service.ts`
- `web/server/src/services/gears-webhook-service.ts`
- `web/server/src/services/project-service.ts`
- `web/server/src/services/story-service.ts`
- `docs/story-agent-next-conversation-handoff.md`

## 4. 已验证内容

已通过：

```bash
cd web/client && npm run lint
cd web/server && npm run lint
cd web/server && npm test -- src/__tests__/project-service.test.ts
cd web/server && npm test -- src/__tests__/gears-webhook-service.test.ts
cd web/server && npm test -- src/__tests__/outline-service.test.ts
cd web/server && npm test -- src/__tests__/api.test.ts
git diff --check
```

测试结果：

- `project-service.test.ts`：21 passed。
- `gears-webhook-service.test.ts`：5 passed。
- `outline-service.test.ts`：14 passed。
- `api.test.ts`：78 passed。

注意：

- API 测试使用 supertest，会在沙箱中触发 `listen EPERM 0.0.0.0`，需要非沙箱权限运行。
- 前端相关 smoke 先前已检查过 ProjectDetail、Projects、StoryStudio 的桌面和移动端关键页面，无明显溢出和控制台错误。

## 5. 现在最应该做的事情

### P0：先收当前工作区

1. 打开新对话后先执行：

```bash
git status --short
git diff --stat
```

2. 复核当前未提交改动。
3. 如果没有新增问题，提交当前成果。

建议提交信息：

```text
完善 Story Agent 工作台故事管理与 Production Board 单项修复
```

### P0：继续故事管理 UX 降噪

当前已完成一部分，但还需要继续：

- 批量删除确认必须明确提示“只删除当前筛选结果中的已选故事”。
- 筛选外已选故事要继续保持可见提示和一键清除。
- 筛选区要有更明显的重置入口。
- 项目工作台默认视图继续降噪，状态/质量/成片类型等高级筛选收进筛选区。
- 故事生成页主流程继续简化：
  - 模型、表现形式、时长、叙事流派、质量强度收进生成设置。
  - 成片类型默认只显示常用类型，完整类型放进“更多成片类型”。

原则：用户体验不能做得太复杂。默认界面只给主路径和高频动作，低频/危险/高级动作收进折叠区或菜单。

### P0：Production Board 修复闭环继续补强

已完成单任务修复和轻量 diff，下一步：

- “修复并落盘”一键流程。
- Production Repair History。
- 按镜头 / 问题类别修复。
- 修复后自动重新生成 Board，并明确 ready / blocked。
- 更细的逐场景 diff，按需展开，不要默认铺满页面。

### P0-P1：Seedance 资产引用字段和素材校验

下一步应把 Seedance 从“文本提示词”升级到“视频模型生产包”：

- 角色参考图字段。
- 场景参考图字段。
- 道具参考图字段。
- 素材 slot。
- `@图片1` / `@视频1` / `@音频1` 引用角色分配。
- 素材数量限制校验。
- Prompt Complexity / Duration 校验。
- Seedance Shot Ledger 与镜头状态继续增强。

字段规则必须遵守：

- `script_text`：观众可见/可听的剧本内容。
- `visual_prompt`：可见画面元素。
- `camera_suggestion`：镜头语言。
- `segment_prompt_hint`：制作指导和限制。
- `validation_notes`：给人或 Agent 的问题，不得混进 prompt。

## 6. MCP 下一步

MCP 计划的下一步不是写入，而是继续只读交付工具。

推荐顺序：

1. `kb_generate_gears_delivery`
2. `kb_generate_seedance_prompt`
3. `kb_repair_story(auto_apply=false)`
4. `kb_update_project_version`
5. `kb_repair_story(auto_apply=true)`

`kb_generate_gears_delivery` 验收要点：

- 能从 `project_id` 读取当前版本。
- 能从 `story_json` 直接生成。
- 返回 units、assets、validation notes。
- 能清理 prompt 污染。
- 不写文件。
- 单测和 MCP 全量测试通过。

`kb_generate_seedance_prompt` 验收要点：

- 8 秒以上自动分时段。
- 每个 `@素材` 都有用途。
- 包含镜头语言和音效/音乐提示。
- 能提示时长过载、引用模糊、写实真人脸素材风险。
- 不混入质量报告或内部字段名。

## 7. AI 漫剧 Seedance 后期下一步

后期生产计划的下一步最小可交付切片是字幕链路：

```text
export-seedance-subtitles
  -> seedance-subtitles/render sidecar
  -> seedance_subtitle_render ledger
  -> 前端导出 SRT / 生成字幕文件
```

原因：

- 当前已完成剪辑装配、缩略图、成片精修计划。
- 字幕 sidecar 不依赖复杂音频素材和最终成片装配。
- ffmpeg worker 模式已在缩略图和剪辑装配中跑通。
- 完成后链路变成：

```text
ready 镜头
  -> 剪辑装配
  -> 缩略图
  -> 精修计划
  -> SRT 字幕文件
```

字幕链路之后再做：

1. 字幕 burn-in。
2. 音频资产库。
3. 音频计划导出。
4. 混音 worker。
5. 片头片尾卡渲染。
6. 最终成片装配。
7. 生产 dashboard。
8. 外部剪辑平台导入包。
9. 审片返修闭环。
10. 30 集以上大系列压测。

## 8. 不要做的事

- 不要把生成故事、修复结果、交付包写入 `data/provinces/*.md`。
- 不要把 Production Board 做成纯展示页，它必须继续服务于资产派生、监督检查、可执行修复和交付。
- 不要让 `visual_prompt`、Seedance prompt 混入质量报告、来源分析、TODO、字段名或内部指令。
- 不要让生成页承担批量删除、复杂筛选、制作流水线管理；生成页只保留主流程和最近故事入口。
- 不要在默认界面堆满高级按钮；低频、高风险、制作类操作放进折叠区。
- 不要让空修复污染版本历史。
- 不要覆盖旧版本；修复类写入必须新增版本并保留 trace。

## 9. 新对话推荐开场指令

可以直接把下面这段发给新对话：

```text
请继续 /Users/wuyu/Desktop/china-culture-kb 的 Story Agent 开发。先阅读 docs/story-agent-next-conversation-handoff.md，再阅读其中列出的计划文档和技能。当前分支是 codex-ai-comic-series-longform，当前有未提交改动。先执行 git status --short 和 git diff --stat，不要覆盖用户改动。优先收尾当前工作区并继续 P0：故事管理 UX 降噪、Production Board 修复并落盘、Seedance 资产引用字段和素材校验。用户体验不能做复杂，默认界面只保留高频主路径。
```

## 10. 下一步执行建议

如果只继续一个最小任务，建议做：

```text
Production Board “修复并落盘”一键流程
```

理由：

- 它直接承接本轮已完成的单任务修复和 diff。
- 用户能从“发现问题”一路走到“交付包落盘”。
- 范围比 Seedance 资产引用更小，验证更快。

如果准备做下一组任务，建议顺序：

1. 收尾并提交当前改动。
2. StoryStudio / Projects 继续降噪。
3. Production Board 修复并落盘。
4. Seedance 资产引用字段和校验。
5. MCP `kb_generate_gears_delivery`。
6. AI 漫剧 `export-seedance-subtitles`。
