# GEARS 实产集成重定计划

> 日期：2026-06-19
> 适用仓库：`china-culture-kb`
> 对接仓库：`Wy490/gears-v2`
> 核心结论：`china-culture-kb` 是内容与生产指挥层；GEARS 是图片、视频与后期实产执行层。

## 1. 重定结论

本轮读取 `Wy490/gears-v2` 后，确认 GEARS v2 已具备图片实产基础：人物 / 场景资产、故事板、`ImageGenAdapter`、Seedream / GPT-image-2 适配、`/media/...` 稳定媒体落盘和 Storyboard Output。

当前项目已经具备完整上游能力：知识库、故事生成、`scene_breakdown`、`gears_segments`、GEARS delivery、Seedance prompt、Production Board、素材 slot、Shot Ledger、回传、重试、审片返修和 dashboard。

新的职责边界如下：

```text
china-culture-kb
  -> 文化知识 / 故事 / 分镜 / GEARS delivery / Seedance prompt
  -> 生产计划 / 素材 slot / 账本 / 质量报告 / 审片返修
  -> 提交 GEARS job / 接收 GEARS 回调 / 展示状态

GEARS v2
  -> 人物图片 / 场景图片 / 故事板图片
  -> 视频生成任务 / 回片管理
  -> 字幕烧录 / 混音 / 片头片尾 / final assemble
  -> 媒体文件、artifact、CDN 或 /media 存储
```

## 2. 暂停与收口

在 `china-culture-kb` 中暂停继续做这些真实执行方向：

- 真实 Seedance / 外部视频平台 SDK 深接。
- 真实图片生成。
- 真实字幕 burn-in。
- 真实混音。
- 真实片头片尾渲染。
- 真实最终成片装配。
- 独立媒体存储、转码、CDN、artifact 管理。

这些能力在当前项目中只保留三类形态：

- 计划包：描述要执行什么。
- dry-run / manifest：用于审查合同、依赖和命令意图。
- ledger / callback：记录 GEARS 或外部执行器返回的状态与产物。

## 3. 保留在当前项目的能力

继续在当前项目推进：

- Story Agent 生成链：`StoryBlueprint -> full_text -> scene_breakdown -> gears_segments`。
- GEARS delivery package：人物资产描述、场景资产描述、分镜单元、校验 notes。
- Seedance prompt package：镜头提示词、`@图片/@视频/@音频` slot、素材校验。
- Production Board：监督、修复、交付包、质量报告。
- Shot Ledger：状态、job、queue、版本、质量分、review note。
- Review Ledger：审片意见、返修包、重试计划。
- Dashboard：阻断项、下一步动作、生产状态总览。
- MCP：只读生成包、质量校验、受控版本写入、修复链路。

## 4. 新增集成目标

新增一个统一的 GEARS Execution Adapter，替代继续扩展 Seedance provider adapter。

目标合同：

```text
POST /gears/jobs
  input:
    schema_version
    source_project_id
    source_story_id or series_project_id
    job_type
    payload
    callback_url
    callback_secret_hint
  output:
    gears_job_id
    status
    accepted_units
    rejected_units
    artifact_placeholders

GET /gears/jobs/{gears_job_id}
  output:
    status
    progress
    artifacts
    failures

POST /api/.../gears-callback
  input:
    gears_job_id
    source ids
    status
    artifacts
    failure_category
    error_code
```

建议支持的 `job_type`：

- `storyboard_image`
- `character_image`
- `scene_image`
- `seedance_video`
- `subtitle_render`
- `audio_mix`
- `title_card_render`
- `final_assemble`

## 5. 当前项目最小切片

### P0：GEARS 合同文档与配置收口

- 新增 `GEARS_API_BASE_URL`、`GEARS_API_TOKEN`、`GEARS_CALLBACK_SECRET`。
- 保留现有 `GEARS_CALLBACK_BASE_URL` 作为回调公开基址。
- 新增 `GET /api/system/gears-execution-config`。
- 新增 `GET /api/system/gears-execution-contract`。
- 文档标明旧 `SEEDANCE_PROVIDER_*` 是临时兼容层，新开发优先走 `GEARS_*`。

### P0：GEARS Job Ledger

- 为单故事项目与 AI 漫剧系列项目新增统一 job ledger。
- 字段至少包含：`gears_job_id`、`job_type`、`source_unit_id`、`status`、`artifact_urls`、`failure_category`、`error_code`、`submitted_at`、`updated_at`。
- Shot Ledger 只记录镜头生产状态；GEARS Job Ledger 记录执行任务状态。

### P0：提交 GEARS Job

- 单故事：从 Production Board 提交 Seedance shot / GEARS delivery 单元到 GEARS。
- 系列：从 `AiComicSeriesSeedancePromptPackage` 或 retry execution plan 提交镜头到 GEARS。
- 暂时不做真实媒体执行，只做 HTTP 合同、mockable adapter、错误归一化和账本回写。

### P0：GEARS 回调归一化

- 扩展现有 `/api/gears/video-ready` 或新增项目级 `/api/projects/:projectId/gears-callback`。
- 支持图片、视频、字幕、混音、片头片尾和最终装配 artifact 回调。
- 回调写入 GEARS Job Ledger，并同步更新 Shot Ledger / dashboard / review blocker。

### P1：迁移旧 Seedance provider UI

- 前端将“提交 adapter / 轮询 provider”文案迁移为“提交 GEARS / 同步 GEARS 状态”。
- 旧 Seedance provider 配置面板降级为兼容区。
- 默认主路径只露出 GEARS 提交、GEARS 状态、重试、审片返修。

### P1：GEARS 侧反向任务

GEARS v2 需要配合新增或调整：

- 接收 `china-culture-kb` 的 delivery / prompt package。
- 将其转为 GEARS `Project / Character / Scene / StoryboardRecipe / Output`。
- 支持视频 job、后期 job 和 artifact 回调。
- 如果 GEARS PRD 仍写“不做视频和后期”，需要先更新 GEARS PRD，明确视频与后期实产归 GEARS。

## 6. 2026-06-20 推进记录

P0 已完成首轮可运行闭环：

- 已新增 GEARS execution config / contract，只暴露配置状态和合同元数据，不泄漏 token / endpoint 原文。
- 已新增统一 GEARS Job Ledger 类型、schema 与服务层，单故事项目和 AI 漫剧系列项目均可记录 `gears_job_id`、`job_type`、`source_unit_id`、状态、artifact、失败分类和回调事件。
- 已新增单故事与系列的 GEARS job submit route / service / client API；未启用真实 GEARS API 时走本地 mock ledger，启用 `use_gears_api=true` 时走 `GEARS_API_BASE_URL`。
- 已新增项目级和系列级 GEARS callback 归一化，兼容 `jobId/taskId`、`status/taskStatus`、`videoUrl/outputUrl`、`artifacts` 等平台字段，并写回 Shot Ledger / 系列生产账本。
- 已新增 GEARS job status sync：从 ledger 选择活跃 job，轮询 `GET /gears/jobs/{gears_job_id}`，再复用 callback 归一化写回账本。
- 项目详情页和 AI 漫剧系列工作台已接入“提交 GEARS / 提交 GEARS API / 同步 GEARS 状态 / 导入 GEARS 回调”主路径；系列工作台可选择提交视频、分镜图、人物图、场景图、字幕、混音、片头片尾和最终装配 job。
- AI 漫剧系列后期 job 已新增结构化 payload 映射：`subtitle_render` 使用字幕包，`audio_mix` 使用音频计划，`title_card_render` 按 title card 生成独立 unit，`final_assemble` 使用最终装配依赖合同。
- AI 漫剧系列图片 job 已新增结构化 payload 映射：`storyboard_image` 使用分集 GEARS delivery units，`character_image` 使用分集人物资产，`scene_image` 使用分集场景资产，并在 source id 中包含 episode 以避免多集重名覆盖。
- AI 漫剧系列后期 artifact callback 已可写回专项账本：字幕、混音、片头片尾和最终交付 job ready 后会同步更新对应 `seedance_*` ledger。
- AI 漫剧系列 GEARS callback / status sync 响应已统一带回后期专项账本，前端同步或导入回调后可直接刷新字幕、混音、片头片尾和最终交付状态；系列工作台同步按钮改为同步全部活跃 GEARS job。
- 单故事项目与 AI 漫剧系列的 GEARS status sync 已补部分成功测试：同一批 job 中部分 GEARS status HTTP 失败时，成功 job 仍会写回 ledger / 生产账本，失败项进入结构化 `failures`。
- 单故事项目与 AI 漫剧系列的 GEARS status sync 已补平台失败状态测试：GEARS 正常返回 `FAILED` / `errorCode` / `failureReason` 时，会写回 GEARS Job Ledger 与对应生产账本，并保留失败分类、错误码和失败原因。
- 单故事项目与 AI 漫剧系列的 GEARS callback API 已补路由层鉴权与多产物 payload 测试：配置 `GEARS_CALLBACK_SECRET` 时要求 `Authorization: Bearer` 或 `X-GEARS-Callback-Secret`，并接受 `final_assemble` 视频 + manifest 等多 artifact 回传合同。
- `GET /api/system/gears-execution-contract` 已补 callback 鉴权元数据、平台状态字段别名和 callback request examples，外部 GEARS worker 可直接对照 `auth_env`、`auth_headers`、`accepted_status_fields` 与 `final_assemble` 多 artifact 示例实现回传 smoke。
- GEARS status polling 已补嵌套平台响应兼容：支持从 `data.job`、`data.task`、`result`、`payload` 等容器中匹配 job，并从 `output.files`、`outputs`、`media`、`assets` 等容器抽取 artifact；poll 合同同步暴露 accepted response shapes 和 artifact fields。
- GEARS callback API / service 已补嵌套 envelope 兼容：`data.task.output.files[]`、`data.job.outputs[]` 等真实 worker 回传形态可通过 schema 校验，并归一化写回单故事 Shot Ledger / 系列生产账本；callback 合同同步暴露 accepted envelope shapes 和嵌套 artifact fields。
- GEARS callback API / service 已补批量 envelope 兼容：`callbacks[]`、`events[]`、`data.tasks[]` 等批量 webhook 会逐条复用单条归一化与账本写回，单故事和 AI 漫剧系列均可一次接收多条 GEARS 回传；callback 合同同步标注批量 shapes。
- GEARS 批量 callback 已补坏项可见性：批量 webhook 中缺少 `gears_job_id` / `source_unit_id` 的 item 不再被静默跳过，会进入结构化 `failures`，便于真实 worker 对接时定位坏 payload。
- GEARS callback 写回已补幂等事件合并：重复 `event_id` / `callback_id` 或无 id 但状态与消息相同的回调不会重复追加 callback event，也不会重复生成 Seedance 视频版本；callback 合同同步暴露 idempotency fields。
- GEARS callback 响应已补可观测幂等计数：单条和批量 webhook 都返回 `received_count`、`updated_count`、`failed_count`、`duplicate_count`，真实 worker 可区分“已处理成功”和“重复送达”。
- GEARS status sync 响应已补重复计数：轮询已完成或重复状态时会汇总 callback 写回的 `duplicate_count`，单故事项目和 AI 漫剧系列路径均已覆盖。
- GEARS failure 响应已补 job 定位字段：status poll、callback match 和 sync import 失败项会尽量返回 `gears_job_id`，前端错误摘要也会显示 source unit / job id，便于真实 worker 对账。
- GEARS progress 已补合同与账本写回：callback / status sync 支持 `progress`、`progress_percent`、`progressPercent`、`percent`、`percentage`、`progress_ratio` 等字段，统一归一化为 `progress_percent` 并在前端最新 job 摘要中回显。
- GEARS status poll 失败诊断已写回 Job Ledger：HTTP/网络轮询失败会记录 `last_poll_at`、`last_poll_error`、`last_poll_failure_category`、`last_poll_error_code`，但不把执行状态误改为 failed；下一次成功 callback/status sync 会清掉临时诊断。
- GEARS 乱序 callback 已补终态保护与审计字段：job 进入 `ready` / `failed` / `rejected` / `canceled` 后，晚到的 `processing` / `submitted` 等非终态事件不会把账本倒退，事件仍保留在 `callback_events`，并标注 `applied_status` 与 `status_regression_ignored`。
- GEARS callback 已补平台时间戳归一化：支持 `eventTime`、`timestamp`、`completedAt` 等字段，统一写入 `callback_events[].provider_event_at` 和 job `completed_at`，便于真实 worker 对账、乱序排查和重放审计。
- GEARS 批量 callback 失败项已补 payload path：`callbacks[]`、`events[]`、`data.tasks[]` 等批量 envelope 中的坏项会返回 `failures[].path`，例如 `callbacks[2]` / `data.tasks[2]`，便于外部 worker 快速定位坏 payload。
- GEARS callback 已补终态冲突审计：`ready` / `failed` / `rejected` / `canceled` 之间发生后到回调覆盖时，事件会记录 `previous_status`、`applied_status` 和 `terminal_status_changed`，便于真实 worker 重放与人工对账。
- GEARS callback 已补 `canceled` 终态失败上下文：GEARS 主动取消 / 人工取消 / 平台取消的回调会保留 `failure_reason`、`error_code` 和 `failure_category`，并同步写入单故事 Shot Ledger / 系列生产账本。
- GEARS status/callback 已补平台状态别名失败归一化：`TIMED_OUT`、`POLICY_BLOCKED`、`NO_CREDIT`、`INVALID_PAYLOAD` 等状态字段本身可触发终态和失败分类，不再必须依赖额外 `failureReason`。
- GEARS artifact URL 已补生产平台别名归一化：callback/status sync 支持 `manifestUrl`、`subtitleUrl`、`srtUrl`、`vttUrl`、`audioUrl`、`imageUrl`、`thumbnailUrl`、`posterUrl` 等字段，并为 manifest / subtitle / audio / image 等 artifact 推断 `kind` / `role`，`final_assemble` 可不依赖 `artifacts[]` 或 URL 后缀写回 manifest。
- GEARS source id 已补平台别名正式合同：callback schema / contract 支持 `externalId`、`customId`、`productionId` 等字段作为 `source_unit_id` 映射，真实 worker 即使使用平台外部 ID 或重映射 job id，也可回写到单故事 GEARS Job Ledger / Shot Ledger。
- GEARS submit unit 已补 worker 对账字段：HTTP 提交给 GEARS 的每个 unit 会带 `external_id` / `custom_id` / `idempotency_key` / `callback_url` / `metadata`，便于 GEARS v2 worker 幂等建单、按外部 ID 回传并保留 Story Agent 项目/故事/镜头来源。
- GEARS callback 幂等已接入 submit idempotency key：worker 可回传 `idempotencyKey` / `idempotency_key` 作为 callback event id，重复回调会进入 `duplicate_count`，不重复追加 `callback_events` 或生成镜头版本。
- GEARS Job Ledger 已持久化 submit idempotency key，并支持 worker 仅凭 `idempotencyKey` / `idempotency_key` 回调匹配单故事与 AI 漫剧系列 job；旧 ledger normalize 时会按 `job_type:source_unit_id` 补齐默认幂等键。
- GEARS idempotency-key 生命周期回调审计已加固：`idempotencyKey` 作为 job 匹配 / 幂等锚点时，不会吞掉状态、进度或消息变化；只有相同状态、进度和消息的重复 payload 才计入 `duplicate_count`，`callback_events` 会标注 `event_id_source`。
- GEARS 系列重试 payload 已补生产上下文：`seedance_video` retry unit 会带 `retry_count`、`retry_reason`、旧 provider job、旧视频 URL、失败原因、审片意见、执行计划时间戳和 request payload，便于 GEARS v2 worker 区分首次生成、失败重试和审片返修。
- GEARS 系列 submit 响应已补 `job_type`、`job_type_label` 和 `submit_intent`，Markdown 摘要同步输出 adapter 统计、提交任务和失败清单；`seedance_video` 在合同与 UI 中明确为“视频返修/重试”，旧 Seedance 重试提交入口降级为兼容入口。
- 验证已通过：server lint、server build、client lint、client build、`project-service.test.ts`、`outline-service.test.ts`、`api.test.ts`。

## 7. 进度重估

| 模块 | 新判断 | 说明 |
|---|---:|---|
| Story Agent MVP | 约 75% | 生成、质量报告、修复、项目版本、前端查看已跑通。 |
| Production Board / Delivery Contract | 约 96% | 交付包、素材 slot、Shot Ledger、回传、重试、dashboard 已基本齐。 |
| GEARS Execution Integration | 约 83% | P0 config/contract、job ledger、submit、callback 归一化、status sync、系列图片/后期 payload、后期 artifact 回写、响应层账本回显、系列工作台多 job 类型提交、status sync 部分成功合同、平台失败状态归一化、callback API 鉴权、多 artifact 回传合同、worker 对接示例、嵌套 status poll、嵌套 callback envelope、批量 callback envelope、批量坏项 failure 可见性、callback 幂等写回、callback/status sync 可观测重复计数、failure job 定位字段、progress 归一化写回、poll 失败诊断写回、乱序 callback 终态保护与审计字段、平台时间戳归一化、批量坏项 path 定位、终态冲突审计、`canceled` 终态失败上下文、平台状态别名失败归一化、artifact URL 别名归一化、source id 别名合同化、submit unit 幂等对账字段、submit/callback 幂等 key 贯通、仅凭幂等键回调匹配、幂等键生命周期审计、系列重试 payload 上下文、submit 意图字段和 Markdown 对账摘要已跑通；还缺 GEARS v2 真实端到端联调、更多失败类型扩展和大项目压测。 |
| AI 漫剧系列指挥层 | 约 82% | 系列规划、账本、回片、审片返修、重试、dashboard、GEARS 后期账本回显和图片/视频/后期 job 提交入口可用；系列视频重试主路径已从旧 Seedance 兼容入口迁到 GEARS submit 语义。 |
| AI 漫剧真实媒体执行 | 迁出当前仓库 | 不再作为 `china-culture-kb` 进度项；归 GEARS。 |
| MCP Story Agent 闭环 | 约 75-80% | 只读、修复 dry-run、受控写入已有；还缺更深模型修复链路。 |
| 可商用制作中台 | 约 55% | 指挥层强，实产需完成 GEARS 集成后才闭环。 |

## 8. 下一对话推荐开场

```text
请继续 /Users/wuyu/Desktop/china-culture-kb 项目开发。先阅读 docs/gears-execution-integration-plan.md、docs/story-agent-next-development-plan.md、docs/story-agent-next-conversation-handoff.md。当前分支 codex-ai-comic-series-longform。先执行 git status --short --branch 和 git diff --stat，不要覆盖 data/provinces/湖南.md 的已有改动。新的方向是：china-culture-kb 只做内容与生产指挥层，图片/视频/后期实产全部交给 GEARS v2。优先实现 P0：GEARS execution config/contract、GEARS job ledger、提交 GEARS job、GEARS callback 归一化；暂停继续做真实 Seedance SDK、真实 ffmpeg 片头片尾、真实 final assemble。
```
