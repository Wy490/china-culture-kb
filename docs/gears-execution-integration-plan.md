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

2026-06-23 状态口径补充：Story Agent MVP 进度已拆为两层，`content_command_layer=99%` 代表当前仓库的内容生成、质量修复、版本、readiness、MVP status 和 evidence signoff 指挥面；`gears_end_to_end_acceptance=95%` 代表真实 GEARS v2 endpoint 的 submit/status/callback smoke、大项目 worker pressure 和 evidence signoff 尚待可达 endpoint 签收。不要因为 95% 继续在 `china-culture-kb` 扩展真实 Seedance SDK、ffmpeg 或 final assemble。

2026-06-23 单故事质量与 GEARS 交付修复补充：`20260621-story-5xhl--character_story` 已通过受控版本机制新增 v10《周敦颐橘洲问莲》，项目元数据为 `quality_passed=true`、`genre_score=100`、`quality_issue_count=0`，质量报告大纲覆盖 100、pattern score 100、GEARS readiness 100、`audience_text_report.clean=true`；GEARS delivery 15 units、`validation_notes=0`。v10 已把观众字段中的“主角目标/目标明确/选择有代价/因果链/行动具体/人物不是年表/史实边界”等检测词替换为自然剧情动作与片尾创作边界说明。同时修正 GEARS delivery 服饰推断，避免“长沙”让北宋周敦颐故事误出清末民初服装；修正 narrative pattern 单项信号 minHits，并让质量门识别自然叙事证据，避免检测词进入观众稿。

2026-06-23 audience text gate 补充：`StoryQualityReport` 新增 `audience_text_report`，扫描 `full_text`、场景剧情/旁白、GEARS `script_text` 和 `segment_prompt_hint` 中的内部检测词；污染会转为 `repair-audience-text` 质量修复动作，并在前端显示 Audience Text 卡片。当前 v10 样本已落盘 `clean=true`。该 gate 仍属于内容与生产指挥层，不扩展真实 Seedance SDK、ffmpeg 或 final assemble。

2026-06-23 worker acceptance 补充：acceptance kit 已输出 `real_endpoint_readiness`，用于在导出/运行 `run-gears-worker-acceptance.sh` 前确认真实 GEARS endpoint env 与 smoke targets 是否齐备；该字段只做签收前置判定，不执行媒体实产。

2026-06-23 generated health 系列治理补充：`story-agent-generated-health/v1` summary 已新增 `series_ready_count`、`series_planned_only_count`、`series_production_gap_count`、`series_interrupted_count` 和 `series_governance_attention_count`，Markdown/notes 输出 `series_governance_attention` 与 Series governance 提醒。真实 GEARS endpoint 签收前要先用该指标隔离 planned-only、production-gap、interrupted 的 AI 漫剧历史样本，先归档 fixture 或补齐 Story Agent 合同，避免把本仓库生成资产治理问题误判成 GEARS v2 worker 响应问题。

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
- GEARS status/callback 状态别名继续扩展：`ACCESS_DENIED`、`TOKEN_EXPIRED`、`RATE_LIMITED`、`NETWORK_ERROR`、`SERVICE_UNAVAILABLE`、`ASSET_MISSING`、`UNSUPPORTED_MEDIA`、`VALIDATION_ERROR` 等只出现在 status 字段里的平台结果可直接归一化为终态和失败分类。
- GEARS artifact URL 已补生产平台别名归一化：callback/status sync 支持 `manifestUrl`、`subtitleUrl`、`srtUrl`、`vttUrl`、`audioUrl`、`imageUrl`、`thumbnailUrl`、`posterUrl` 等字段，并为 manifest / subtitle / audio / image 等 artifact 推断 `kind` / `role`，`final_assemble` 可不依赖 `artifacts[]` 或 URL 后缀写回 manifest。
- GEARS source id 已补平台别名正式合同：callback schema / contract 支持 `externalId`、`customId`、`productionId` 等字段作为 `source_unit_id` 映射，真实 worker 即使使用平台外部 ID 或重映射 job id，也可回写到单故事 GEARS Job Ledger / Shot Ledger。
- GEARS submit unit 已补 worker 对账字段：HTTP 提交给 GEARS 的每个 unit 会带 `external_id` / `custom_id` / `idempotency_key` / `callback_url` / `metadata`，便于 GEARS v2 worker 幂等建单、按外部 ID 回传并保留 Story Agent 项目/故事/镜头来源。
- GEARS submit 响应已补真实 worker 嵌套形态兼容：`data.acceptedUnits[]`、`data.task` 等平台式响应会归一化为 GEARS Job Ledger，execution contract 同步公开这些 accepted response shapes。
- GEARS submit 部分拒绝已结构化：`data.rejectedUnits[]` 可与 acceptedUnits 混合返回，也可单独返回；服务层会保留 `gears_job_id`、`idempotency_key`、`error_code`、`failure_category` 和 message，避免真实 worker 的批量拒绝被误判为整批合同失败。
- GEARS submit 拒绝项已进入生产账本：真实 worker 返回的 rejectedUnits 会生成 `status: rejected` 的 GEARS Job Ledger item，并同步写入单故事 Seedance Shot Ledger / 系列生产账本；前端失败摘要会显示分类、错误码和幂等键。
- GEARS readiness / 本地合同冒烟已落地：新增 `GET /api/system/gears-execution-readiness`，汇总配置、callback 安全、批量边界、status/callback 别名对齐，并运行 accepted/rejected submit、rejected ledger、嵌套 callback、状态别名、压力边界五类本地 smoke；单故事项目页与 AI 漫剧系列工作台直接显示 readiness 状态与分数。
- GEARS live E2E 联调计划已进入 readiness 报告：readiness API 返回 submit、status poll、project callback、series callback 四个真实联调步骤的 ready/blocked 状态、blocked_by 和 expected_result；前端同步显示本地 smoke 通过数和 live E2E ready 步骤数。
- GEARS smoke handoff package 已落地并可导出：`GET /api/system/gears-execution-smoke-package` 输出可交给 GEARS v2 worker 的 submit/status/project callback/series callback 四步联调包，包含 headers 占位符、request body、accepted response shapes、Story Agent 预期写回结果和 Markdown handoff；单故事项目页与 AI 漫剧系列工作台可直接导出 JSON / Markdown。
- GEARS live smoke run 已落地：新增 `POST /api/system/gears-execution-live-smoke-run`，默认 dry-run 生成 Markdown 报告；`execute=true` 且 readiness ready 时会复用真实 GEARS submit adapter 提交 smoke units，`poll_after_submit=true` 时继续轮询 accepted job，单故事项目页与 AI 漫剧系列工作台可直接生成/执行 live smoke 报告。
- GEARS pressure report 已落地：新增 `GET /api/system/gears-execution-pressure-report`，本地验证 200 条 callback envelope 可解析、201 条会被 schema 拒绝、单 job 仅保留最新 20 条 callback_events；前端同步显示 pressure 状态并可导出 Markdown。
- GEARS worker 失败类型已继续扩展：`render_failed`、`artifact_upload_failed`、`callback_delivery_failed`、`output_missing`、`artifact_invalid`、`worker_unavailable` 等真实执行节点失败可从 status / errorCode / failureReason 归一化写入 GEARS Job Ledger；旧 Seedance 生产账本投影保持兼容映射。
- GEARS 真实生成项目 pressure audit 已落地：新增 `GET /api/system/gears-execution-generated-project-pressure`，扫描 `web/generated/projects` 与 `web/generated/ai-comic-series-projects` 的 `gears_job_ledger`，汇总 job 数、活跃/终态/失败、callback event 压力、artifact 数、失败分类和项目风险，并输出 Markdown。
- 单故事项目页与 AI 漫剧系列工作台已接入 generated pressure 状态与导出按钮，可直接下载真实生成目录的 GEARS ledger 压力审计报告。
- GEARS worker acceptance report 已落地：新增 `GET /api/system/gears-execution-acceptance-report`，聚合 readiness、本地 smoke、live E2E 阻断项、pressure、generated pressure 和 smoke handoff artifacts，输出可交给 GEARS v2 worker 对接前验收的 Markdown 报告；单故事项目页与 AI 漫剧系列工作台可显示 acceptance 状态并导出报告。
- GEARS worker acceptance kit 已落地：新增 `GET /api/system/gears-execution-worker-acceptance-kit`，输出 env template、smoke payload 文件、submit/status/callback/live-smoke curl 命令、断言清单和 Markdown runbook；单故事项目页与 AI 漫剧系列工作台可显示 worker kit 命令数，并导出 Markdown / JSON。
- GEARS worker acceptance kit 已升级为可执行脚本包：kit 同时输出 `run-gears-worker-acceptance.sh`，脚本会写 payload、抓取 acceptance/evidence 预检、提交 GEARS worker、可选轮询 status、回打单故事/系列 callback、运行 live smoke，并把响应保存到 `GEARS_EVIDENCE_DIR`；前端可直接导出 `.sh`。
- GEARS worker acceptance script 已改为“完整证据落盘、stdout 简报”：acceptance/evidence/generated pressure JSON 保存到 evidence 目录，终端只打印 ok/status/commands/payloads/documents 等摘要，避免真实联调日志被大 JSON 淹没。
- GEARS worker acceptance shell script 已补批量 job id 自动提取：默认从 submit response 的 `gears_job_id`、`jobId`、`taskId`、`data.task`、`acceptedUnits[]`、`jobs[]`、`tasks[]` 等常见形态中提取全部 job id，写入 `gears-smoke-job-ids.txt`，并逐个保存 `gears-status-response-<job>.json`；无法提取时保留手工设置 `GEARS_SMOKE_JOB_ID` 的路径。
- GEARS worker acceptance shell script 已补可配置多轮 status poll：`GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS` 默认 `1`，`GEARS_ACCEPTANCE_STATUS_POLL_INTERVAL_SECONDS` 默认 `5`；多轮时保存每次 `gears-status-response-<job>-attempt-<n>.json`，并保留最新 `gears-status-response-<job>.json` 供 audit 兼容。
- GEARS worker acceptance shell script 已补幂等重放和跑后审计：默认重放单故事与 AI 漫剧系列 callback，保存 replay response；跑后重新拉取 evidence bundle 与 generated pressure，并写入 `gears-worker-acceptance-evidence-manifest/v1` manifest。
- GEARS worker acceptance shell script 已补 Story Agent callback response audit：生成 `story-agent-callback-response-audit.json` 与 `story-agent-callback-response-audit.md`，统计 callback/live-smoke 响应里的 `ok=false`、validation/auth/not-found/live-smoke blocked 错误、received/updated/failed/duplicate 计数和推荐修复动作。
- GEARS worker acceptance shell script 已补 Story Agent callback id preflight：生成 `story-agent-callback-id-preflight.json` 与 `.md`，在 callback POST 前检查 `GEARS_SMOKE_PROJECT_ID` / `GEARS_SMOKE_SERIES_PROJECT_ID` 是否符合 Story Agent 路由格式，避免真实联调时把占位 id 误判成 GEARS worker 回调合同问题。
- GEARS worker acceptance shell script 已补真实 worker 响应形态审计：生成 `gears-worker-response-audit.json` 与 `gears-worker-response-audit.md`，扫描 `gears-submit-response.json`、`gears-status-response-*.json` 和可选 `gears-large-project-submit-response.json`，汇总 accepted/rejected/failed 计数、状态别名、job/source/idempotency 字段、artifact URL 字段、ready 缺 artifact、error code、failure category、合同缺口和 `recommended_actions`，可把真实 worker 响应直接转成 P0/P1 合同修复动作。
- `recommended_actions` 已带 `sample_paths`，audit totals 已带 `sample_record_paths`，可定位缺 worker id、缺 source/idempotency、缺失败上下文、ready 无 artifact 和未知状态的代表性 JSON path。
- GEARS worker acceptance shell script 已补 transport / HTTP sidecar 证据：submit、status poll 和可选大项目 pressure submit 会保存 `*-http-status.txt` 与 `*-curl-exit-code.txt`；worker response audit 汇总 `transport_error_count` / `http_error_count`，并把非 2xx 与 curl 失败拆成独立 recommended actions。
- Story Agent callback/live-smoke 也已补 transport / HTTP sidecar 证据：project callback、series callback、callback replay 和 live smoke 会保存 `*-http-status.txt` 与 `*-curl-exit-code.txt`；`story-agent-callback-response-audit` 汇总 `transport_error_count` / `http_error_count` / `not_found_count` / `blocked_count` / `ledger_match_missing_count`，可区分 route/auth/project missing、live smoke env blocked、项目存在但 GEARS Job Ledger 未匹配与 callback payload 合同问题。
- worker response audit 已用 error_code / failure_category 参与 failed/rejected 判定：例如 `SERVICE_UNAVAILABLE` 会进入 failed，而不是 unknown，方便真实 worker 失败类型对齐。
- acceptance shell stdout 已补 audit 摘要：callback id preflight、worker response audit 和 Story Agent callback response audit 都会打印 totals / recommended actions 一行摘要，详细 JSON/Markdown 仍保存在 evidence 目录。
- worker response audit 已覆盖 `no_worker_response_files` 与 `record_count_zero` 两类前置失败：缺 env 时提示先跑 worker smoke，不可达 endpoint 留下空响应文件时提示补真实 submit/status 结果或 transport failure body。
- GEARS worker acceptance shell script 已补真实运行可执行性：提交前会按 env 渲染 smoke payload，不再把 `GEARS_SMOKE_PROJECT_ID` / `<GEARS_CALLBACK_BASE_URL>` 占位符发给 worker；`GEARS_API_TOKEN` 可选且无 token 时不再触发 Bash 空数组错误；submit 失败会写 `gears-submit-exit-code.txt`、`gears-submit-failed.txt` 与 manifest。
- GEARS worker acceptance shell script 已补缺 env evidence：脚本会先写 payload、acceptance report、evidence bundle、manifest 和 `gears-required-env-missing.txt`，再因缺 `GEARS_API_BASE_URL` / callback env 退出，避免真实联调前没有可提交证据。
- GEARS worker acceptance kit 已补 smoke target 自动发现：导出包新增 `smoke_targets`，脚本会写 `story-agent-smoke-targets.json` / `story-agent-smoke-env-selected.json`；当 `GEARS_SMOKE_PROJECT_ID`、`GEARS_SMOKE_STORY_ID`、`GEARS_SMOKE_SERIES_PROJECT_ID` 留空或仍是占位符时，会从 `web/generated` 自动选择现有单故事项目和 AI 漫剧系列项目，减少 callback smoke 的 404 误判。
- Story Agent callback response audit 已补 `ledger_match_missing_count`：当 callback 成功到达真实项目但 `source_unit_id` / `gears_job_id` 不在项目 GEARS Job Ledger 中时，会给出“先走 Story Agent submit 建账本，或对齐回调 source/job id”的 P0 动作，避免误判为路由或鉴权问题。
- GEARS worker acceptance script 已补可选 Story Agent 账本预建：设置 `GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER=1` 时，脚本会调用单故事和系列 Story Agent GEARS submit API，并用返回的 `submitted_jobs[]` 自动改写 callback smoke payload 的 `source_unit_id`、`gears_job_id` 和 `job_type`，使 callback smoke 可验证真实 ledger 回写而不是只报告 `ledger_match_missing_count`。
- GEARS worker acceptance kit 已补大项目 worker 压测路径：导出 `gears-large-project-pressure-plan.json`，脚本默认生成 30 集 × 每集 4 镜的 `gears-large-project-submit-pressure.json` 与 summary，并按 200 units 上限封顶；只有显式设置 `GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE=1` 才提交给 GEARS worker。
- GEARS worker evidence bundle 已落地：新增 `GET /api/system/gears-execution-worker-evidence-bundle`，一键聚合 acceptance report、worker kit、smoke handoff、pressure report、generated pressure report、generated health report 和 Story Agent MVP status report，输出可提交给 GEARS 团队的 Markdown / JSON 证据包；单故事项目页与 AI 漫剧系列工作台可显示 evidence 文档数并导出。
- GEARS callback 幂等已接入 submit idempotency key：worker 可回传 `idempotencyKey` / `idempotency_key` 作为 callback event id，重复回调会进入 `duplicate_count`，不重复追加 `callback_events` 或生成镜头版本。
- GEARS Job Ledger 已持久化 submit idempotency key，并支持 worker 仅凭 `idempotencyKey` / `idempotency_key` 回调匹配单故事与 AI 漫剧系列 job；旧 ledger normalize 时会按 `job_type:source_unit_id` 补齐默认幂等键。
- GEARS idempotency-key 生命周期回调审计已加固：`idempotencyKey` 作为 job 匹配 / 幂等锚点时，不会吞掉状态、进度或消息变化；只有相同状态、进度和消息的重复 payload 才计入 `duplicate_count`，`callback_events` 会标注 `event_id_source`。
- GEARS 大项目账本边界已显性化：单个 job 只保留最新 20 条 `callback_events`，批量 callback envelope 单次最多接收 200 条 item，超过时在路由/服务层返回校验错误，避免大系列误投导致账本和写回循环失控。
- GEARS 大项目边界已进入配置与前端可观测面：`GET /api/system/gears-execution-config` 返回 callback 批量上限和事件保留上限，单故事项目页与 AI 漫剧系列工作台会直接显示这些 GEARS 边界。
- GEARS poll/status 合同已与 callback 合同对齐：`GET /api/system/gears-execution-contract` 在 `poll.accepted_status_fields` 和 `callback.accepted_status_fields` 中公开同一套平台状态别名，便于 GEARS v2 同步实现 status 查询和 webhook 回调。
- GEARS 系列重试 payload 已补生产上下文：`seedance_video` retry unit 会带 `retry_count`、`retry_reason`、旧 provider job、旧视频 URL、失败原因、审片意见、执行计划时间戳和 request payload，便于 GEARS v2 worker 区分首次生成、失败重试和审片返修。
- GEARS submit 响应兼容继续扩展：支持深层 `response.payload.result.tasks[]`、`rejectedJobs[]` 等真实 worker envelope；payload 类错误码（如 `PROMPT_TOO_LONG`、`duration_too_long`、`schema_invalid`、`malformed_payload`）会优先归入 `payload_invalid`，避免被 worker 文案误判为执行器不可用。
- GEARS submit 响应兼容已补顶层 `status` envelope：`{ status: "ACCEPTED", data: { acceptedUnits: [{ taskId, externalId, idempotencyKey }] } }` 不再被误判为一条缺 `source_unit_id` 的 job，Story Agent submit adapter 会使用 `externalId` / `idempotencyKey` 建账本。
- GEARS 系列 submit 响应已补 `job_type`、`job_type_label` 和 `submit_intent`，Markdown 摘要同步输出 adapter 统计、提交任务和失败清单；`seedance_video` 在合同与 UI 中明确为“视频返修/重试”，旧 Seedance 重试提交入口降级为兼容入口。
- 已执行导出的 `run-gears-worker-acceptance.sh` 真实 endpoint smoke 前置验证：Story Agent 预检、本地 smoke 和 evidence bundle 读取通过；本机没有 GEARS v2 worker 监听，`GEARS_API_BASE_URL=http://127.0.0.1:65534` 的 submit 阶段按预期失败并保存证据。新版脚本还验证了缺 env evidence 路径和 30 集级压力 payload 生成；真实端到端仍等待可达的 GEARS v2 endpoint 与回调公网/内网基址。
- 已用本地 fake GEARS worker 验证多轮 status poll：submit 返回 `fake-gears-job-1`，第 1 次 status 为 `PROCESSING`、第 2 次为 `COMPLETED`；脚本写出 attempt 文件和 latest 文件，audit 扫描 attempt 文件、跳过 latest 副本，`ready_without_artifact=0/1` 且识别 artifact URL。
- 已用本地 fake GEARS worker 验证 Story Agent callback response audit：占位 project/series id 会导致单故事与系列 callback 返回 `ok=false` / `VALIDATION_ERROR`，audit 统计 `ok_false_count=2`、`validation_error_count=2`，并给出 `validation_error_count` 推荐动作，提示换成真实 Story Agent project id。
- 已用导出的 `run-gears-worker-acceptance.sh` 验证缺 env 路径的新 id preflight：`/private/tmp/gears-worker-evidence-id-preflight` 写出 `story-agent-callback-id-preflight.json/.md`，`warning_count=2`，stdout 打印 `recommended_actions=1`；worker audit 同步输出 `no_worker_response_files` 推荐动作。
- 已用本地 fake GEARS worker 验证 HTTP 503 submit 证据：脚本写出 `gears-submit-response-http-status.txt=503` 与 `gears-submit-response-curl-exit-code.txt=0`，worker audit 统计 `http_error_count=1`、`failed_count=2`、`unknown_count=0`，并给出 `http_error_count` recommended action。
- 已用本地 fake GEARS worker 验证 Story Agent callback HTTP sidecar：worker submit/status 均 200，但使用不存在的合法格式 project/series id 回调，脚本完整退出 0，callback audit 统计 `http_error_count=4`、`not_found_count=4`、`blocked_count=1`、`ok_false_count=4`，sample transport files 指向四个 404 response，并把修复动作归到 smoke env 项目 ID / live smoke server env。
- 已用本地 fake GEARS worker 验证 smoke target 自动补齐路径：脚本在未显式设置 smoke project env 时自动选择 `20260621-story-5xhl--character_story` / `20260621-story-5xhl` / `20260619-series-r0v5zyag`，并写入 `/private/tmp/gears-worker-evidence-auto-target-v3`；callback audit 的 `not_found_count=0`、`blocked_count=0`、`http_error_count=0`、`transport_error_count=0`，剩余 `ledger_match_missing_count=4` 明确指向“需先走 Story Agent submit 建账本或启用 `GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER=1`”。
- 已用本地 fake GEARS worker 复测可选 Story Agent ledger seed：`/private/tmp/gears-worker-evidence-ledger-seed-v3` 中单故事 `patched=true`，`shot-1` / `fake-gears-job-seed-10` 成功回写 ready，`updated_count=2`、`duplicate_count=1`；callback audit 的 `ledger_match_missing_count` 从 4 降到 2，剩余来自示例系列无可提交 `seedance_video` retry job，下一轮可换有 retry candidates 的系列项目或改用其它 job type 继续压测。
- 已修正 worker acceptance smoke target 选择：扫描默认 generated 根与仓库 `web/generated`，series candidate 会统计真实存在的 episode story、`seedance_video` retry candidate 和后期可 seed job；当 `seedance_video` 因缺真实 story/retry candidates 不可提交时，自动降级到可提交的 GEARS 后期 job（本轮为 `title_card_render`）。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 复测 ledger seed 完整闭环：证据目录 `/private/tmp/gears-worker-evidence-ledger-seed-v5`；自动选择 `20260619-series-3f89ec1y`，`GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE=title_card_render`；单故事与系列 `story-agent-*-ledger-seed-selected.json` 均为 `patched=true`，series 使用 `source_unit_id=title_card:card-series-opening` / `gears_job_id=fake-gears-job-11`；callback response audit 统计 `updated_count=4`、`duplicate_count=2`、`failed_count=0`、`ledger_match_missing_count=0`、`recommended_actions=[]`。真实 GEARS v2 endpoint 仍未配置，真实端到端和真实大项目提交压测继续等待可达 endpoint。
- 已修正 worker response audit 的记录识别误报：顶层 submit/status envelope 仅有 `status` 时不再当作 worker record，`outputs[].url` 等 artifact 子项也不再被误判为缺 job/source id 的记录；只有明确 job/unit/task/result 路径或对象自身含 job/source/artifact/status 信号时才计入审计。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v7 fake GEARS smoke：证据目录 `/private/tmp/gears-worker-evidence-ledger-seed-v7`；worker audit 统计 `file_count=3`、`record_count=10`、`unknown_count=0`、`missing_worker_id_count=0`、`missing_source_id_count=0`、`missing_ready_artifact_count=0`、`recommended_actions=[]`；callback audit 统计 `updated_count=4`、`failed_count=0`、`duplicate_count=3`、`ledger_match_missing_count=0`、`recommended_actions=[]`；单故事 seed 使用 `20260621-story-5xhl--character_story:title_card_render` / `fake-gears-job-3`，系列 seed 使用 `title_card:card-series-opening` / `fake-gears-job-4`。
- 已补大项目压力响应专用审计：acceptance shell 现在生成 `gears-large-project-response-audit.json/.md`，对 `gears-large-project-submit-pressure.json` 与 worker 响应逐 source 对账，统计 `request_unit_count`、`response_record_count`、`source_echo_count`、缺失 source、重复 source、意外 source、HTTP/curl 状态和 `recommended_actions`。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v8 大项目压力 smoke：证据目录 `/private/tmp/gears-worker-evidence-ledger-seed-v8-pressure`；默认 30 集 × 4 镜生成 120 units，fake GEARS worker submit 返回 HTTP 202；large-project response audit 达到 `request_unit_count=120`、`response_record_count=120`、`accepted_count=120`、`source_echo_count=120`、`missing_requested_source_count=0`、`duplicate_source_id_count=0`、`unexpected_source_count=0`、`recommended_actions=[]`；worker 总审计 `record_count=370`、`missing_worker_id_count=0`、`missing_source_id_count=0`、`unknown_count=0`、`recommended_actions=[]`；callback audit 仍保持 `ledger_match_missing_count=0`。
- 已补 GEARS worker acceptance 最终签收门禁：acceptance shell 现在生成 `gears-worker-acceptance-verdict.json/.md`，把 required env、callback id preflight、worker response audit、Story Agent callback audit、大项目 pressure audit 和 manifest 汇成 `acceptance_passed` / `failed_gate_ids` / `recommended_actions`；默认 `GEARS_ACCEPTANCE_STRICT_AUDIT=1`，若 verdict 失败则脚本非零退出，真实 endpoint smoke 可直接作为 CI/交付门禁使用。
- 已补 GEARS worker acceptance archive：acceptance shell 现在生成 `gears-worker-acceptance-archive.json/.md`，汇总必交证据文件、缺失附件、byte length 与 `sha256`，并以 `signoff_ready=true` 作为证据包完整性门禁；默认严格模式会同时要求 verdict `acceptance_passed=true` 和 archive `signoff_ready=true`。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v9 verdict smoke：证据目录 `/private/tmp/gears-worker-evidence-verdict-v9`；worker kit 导出为 15 条 commands / 5 个 payloads；最终 `gears-worker-acceptance-verdict.json` 为 `status=passed`、`acceptance_passed=true`、`gate_counts=6/0/0/6`、`recommended_actions=0`；大项目 pressure 仍为 120/120 accepted/source echo，worker audit `record_count=370` 且 callback audit `ledger_match_missing_count=0`。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v10 archive smoke：证据目录 `/private/tmp/gears-worker-evidence-archive-v10`；worker kit 导出为 16 条 commands / 5 个 payloads；最终 verdict `status=passed`、`acceptance_passed=true`、`gate_counts=6/0/0/6`、`recommended_actions=0`；archive `status=signoff_ready`、`signoff_ready=true`、必交附件 `18/18` 全齐、`missing_required_attachment_count=0`、证据文件 66 个、总大小约 2.21 MB；大项目 pressure 仍为 120/120 accepted/source echo，worker audit `record_count=370`，callback audit `updated_count=4`、`duplicate_count=3`、`ledger_match_missing_count=0`。真实 GEARS v2 endpoint 仍未配置。
- 已补 GEARS worker acceptance checksum manifest：archive 生成器现在额外输出 `gears-worker-acceptance-checksums.json/.md`，schema 为 `gears-worker-acceptance-checksum-manifest/v1`，逐文件记录 `sha256`、byte length、role 和 required 标记；每次生成前会清理旧 archive/checksum 输出，避免重跑时把陈旧产物算入证据清单。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v11 checksum smoke：证据目录 `/private/tmp/gears-worker-evidence-checksums-v11`；archive `signoff_ready=true`、必交附件 `18/18` 全齐、`required_checksum_count=18`、证据文件 66 个；checksum manifest `algorithm=sha256`、`file_count=66`、`required_file_count=18`、`record_count=66`；verdict 6 个 gate 全过，大项目 pressure 120/120 source echo，worker/callback audit 均无阻断。真实 GEARS v2 endpoint 仍未配置。
- 已补 GEARS worker acceptance integrity 复核：acceptance shell 现在生成 `gears-worker-acceptance-integrity.json/.md`，会重新计算 checksum manifest 中每个证据文件的 `sha256` 与 byte length，检查必交附件是否都有 checksum record，并以 `integrity_passed=true` 作为严格签收第三道门禁。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v12 integrity smoke：证据目录 `/private/tmp/gears-worker-evidence-integrity-v12`；worker kit 导出为 17 条 commands / 5 个 payloads；integrity `status=passed`、`integrity_passed=true`、`required_checksum_records=18/18`、`mismatch_count=0`、`missing_file_count=0`、`sha256_mismatch_count=0`；verdict、archive、checksum manifest、大项目 pressure、worker audit、callback audit 均无阻断。真实 GEARS v2 endpoint 仍未配置。
- 已补 Story Agent generated health audit：`GET /api/system/story-agent-generated-health` 只读扫描 generated story project、AI 漫剧系列 project、generated stories 和 versions，输出 `story-agent-generated-health/v1`，按 `ready / planned / production_gap / interrupted` 区分生成资产状态；项目工作台新增“生成项目体检”卡片。该能力只做 GEARS smoke 前置诊断，不执行图片、视频、字幕或最终装配。
- generated health 已补系列治理 scoped summary：`series_ready_count` / `series_planned_only_count` / `series_production_gap_count` / `series_interrupted_count` / `series_governance_attention_count` 会把 AI 漫剧历史样本和缺合同项目从真实 GEARS signoff 目标中显式分离，帮助判断应先归档样本、补交付合同，还是继续跑 worker acceptance。
- 已把 generated health 接入 GEARS worker acceptance / evidence 链：acceptance report 新增 `story_agent_generated_health` 检查和 `generated_health_*` 统计；worker script 会在真实 GEARS submit 前后落盘 health audit，并生成 `story-agent-generated-health-audit.json/.md` 进入最终 verdict gate；evidence bundle 新增 `story-agent-generated-health-report.md`，用于把 smoke target 的 planned/interrupted/production_gap 风险并入签收证据。
- 验证已通过：server lint、server build、client lint、client build、`project-service.test.ts`、`outline-service.test.ts`、`gears-execution-service.test.ts`、`api.test.ts`。

## 7. 进度重估

2026-06-22 更新：本轮没有继续在 `china-culture-kb` 内增加真实 Seedance SDK、真实 ffmpeg 片头片尾或真实 final assemble；新增的是 production readiness 指挥层，用于把单故事/系列项目的质量、交付合同、GEARS 账本、审片返修和商业运营风险聚合成可执行报告。

| 模块 | 新判断 | 说明 |
|---|---:|---|
| Story Agent MVP | 约 95% | 生成、质量报告、修复、项目版本、前端查看已跑通；MCP 修复链路新增 `kb_generate_story_repair_prompt`，可把 repair actions 变成模型可直接产出 `repaired_story_json` 的提示包；production readiness automation 已从“展示 runbook”推进到“一键运行安全 Story Agent API 步骤”，并通过 MCP bridge、运行审计账本、跨项目 portfolio、队列级运行审计和 generated health audit 把项目质量和生产指挥层连接起来；`story-agent-mvp-status/v1` 已把 generated health 与 portfolio readiness 聚合成五条 MVP lane。 |
| Production Board / Delivery Contract | 约 99% | 交付包、素材 slot、Shot Ledger、回传、重试、dashboard 已基本齐；readiness 额外暴露交付未落盘、镜头失败、GEARS 缺账本等可执行风险和对应 API 步骤。 |
| GEARS Execution Integration | 约 99%（Story Agent 侧合同） | P0 config/contract、job ledger、submit、callback/status sync、worker acceptance kit、证据包、generated health 前后体检、checksum/integrity、Story Agent ledger seed、30 集压力 payload 和 submit 意图摘要已跑通；还缺可达 GEARS v2 worker 上的真实端到端执行验收和真实大项目 worker 提交压测。 |
| AI 漫剧系列指挥层 | 约 99% | 系列规划、账本、回片、审片返修、重试、dashboard、GEARS 后期账本回显和图片/视频/后期 job 提交入口可用；系列 readiness 已进入 Web/API/UI/MCP 跨项目 portfolio，支持一键安全自动化、系列级运行账本和 portfolio 运行审计，分集生成、生产 dashboard、GEARS 账本和商业 next actions 已能同屏追踪。 |
| AI 漫剧真实媒体执行 | 迁出当前仓库 | 不再作为 `china-culture-kb` 进度项；归 GEARS。 |
| MCP Story Agent 闭环 | 约 99% | 只读、修复 dry-run、修复提示包、受控写入已有；`kb_generate_story_repair_prompt` 可生成模型修复提示、保护字段、完整 JSON 输出合同和验证/写入工作流；`kb_get_story_agent_generated_health` 可读取本地 generated health，`kb_get_story_agent_mvp_status` 可读取本地 MVP 总控 lane，`kb_get_production_readiness_portfolio` 可读取跨项目优先队列和 portfolio 运行账本，`kb_run_production_readiness_automation` 与 `kb_run_production_readiness_portfolio_automation` 可桥接 Web run endpoint 触发安全自动化。 |
| 可商用制作中台 | 约 99% | 已从分散 dashboard 推进到单故事/系列/portfolio 三层 readiness 中台，并开放 MCP 与 Web/API/UI 自动化 runbook、安全执行入口、MCP bridge、运行审计账本、跨项目优先队列、批量安全 runner、队列级运行审计、模型修复提示包和生成项目健康审计；仍需真实 GEARS worker 产物验收、UX 降噪和真实大系列压力数据。 |

2026-06-22 portfolio ledger 追加：真实队列 run 会写入 `web/generated/system/production-readiness-portfolio-automation-ledger.json`，记录最近 20 次批量调度、目标执行/跳过/失败计数和 notes；`GET /api/system/production-readiness-portfolio`、项目工作台和 MCP 本地 portfolio 均会回显 latest portfolio run。dry-run 继续不落盘。

2026-06-22 MCP repair prompt 追加：新增 `kb_generate_story_repair_prompt`，复用 `kb_repair_story(auto_apply=false)` 的质量快照、修复动作和目标场景，输出只读 prompt、保护字段、完整 JSON 输出合同和 `kb_validate_genre_story -> kb_repair_story(auto_apply=true) -> kb_get_project_context` 推荐工作流；工具不写项目文件。

2026-06-22 generated health 追加：新增 `GET /api/system/story-agent-generated-health`，作为真实 GEARS v2 smoke 前置体检，先确认待测 Story Agent 项目不是 planned-only、不是 current story/version 断裂，也不是缺 GEARS 段/质量报告/系列交付合同。真实媒体执行仍全部在 GEARS v2。

2026-06-22 MCP generated health 追加：新增 `kb_get_story_agent_generated_health`，无需启动 Web dev server 即可读取同类 generated health 报告，方便 agent 在选择 GEARS smoke target 前先做本地体检。

2026-06-22 GEARS acceptance health 追加：generated health 已进入 `gears-execution-acceptance-report`、`run-gears-worker-acceptance.sh` 和 `gears-execution-worker-evidence-bundle`；真实 GEARS endpoint smoke 将同时留下 submit/status/callback 证据、generated pressure 证据和 smoke target 健康证据。

2026-06-22 v13 验证：已用导出的脚本跑本地 fake GEARS worker health smoke，证据目录 `/private/tmp/gears-worker-evidence-generated-health-v13`。generated health before/after 均为 `total_target_count=927`、`ready_count=1`、`interrupted_count=926`；大项目压力 120/120 source echo；worker audit `record_count=370`、`missing_worker_id_count=0`、`missing_source_id_count=0`、`missing_ready_artifact_count=0`。本次关闭 `GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER`，callback gate 预期停在 `ledger_match_missing_count=4`，只验证 health/evidence 链路，不作为 GEARS v2 真实签收。

2026-06-22 v14 验证：acceptance kit 现为 18 条 commands，新增 `audit_story_agent_generated_health`；最终 verdict gate 从 6 个增至 7 个，新增 `story_agent_generated_health_audit`。本地 fake GEARS worker 证据目录 `/private/tmp/gears-worker-evidence-generated-health-v14`：health gate `status=passed`、before/after delta 全 0、大项目压力 120/120 source echo、worker audit 无缺 worker id/source/artifact；archive 必交附件增至 22 个且 `missing_required_attachment_count=0`。本次未启用 ledger seed，唯一失败 gate 仍是 Story Agent callback ledger matching。

2026-06-22 v15 验证：新增 evidence signoff API：`GET /api/system/gears-execution-worker-evidence-signoff?evidence_dir=...`。Story Agent 现在能在真实 GEARS worker acceptance script 跑完后，直接读取 evidence 目录并汇总 verdict、archive、integrity、worker response audit、Story Agent callback audit、generated health audit 和 large-project pressure audit；输出 `gears-execution-worker-evidence-signoff/v1`、Markdown、7 gate 统计、必交附件统计、health delta、pressure source echo 和 recommended actions。该能力不执行媒体生产，只把 GEARS v2 真实跑出来的证据转成可签收/需修复/缺证据三类判断。

2026-06-23 v16/v17 验证：acceptance 脚本早退路径已补全 evidence，真实 GEARS endpoint 不可达时也能留下 callback audit、large project pressure audit、generated health after/audit、verdict、archive、checksum 和 integrity；signoff API 直接暴露 worker transport/http error、failure category counts、callback transport/http error、大项目 response/accepted/rejected/failed/duplicate/unexpected source 统计，并对 recommended actions 去重。新增 MCP 只读工具 `kb_get_gears_worker_evidence_signoff`，可直接读取本地 evidence 目录并输出 `mcp-gears-worker-evidence-signoff/v1`，便于 agent 在无 Web server 时完成证据签收判断。

2026-06-23 前端追加：单故事项目详情页与 AI 漫剧系列工作台已接入 worker evidence signoff 读取入口。操作员可以填入真实 acceptance 脚本生成的 evidence 目录，页面调用 `GET /api/system/gears-execution-worker-evidence-signoff` 后显示 signoff status、gate 统计、缺附件、worker/callback transport-http error、大项目 pressure source echo 和 recommended action 数，并可导出 Markdown / JSON。该入口只读证据，不执行 GEARS worker 或媒体实产。

2026-06-23 latest evidence 追加：Web signoff API 与 MCP `kb_get_gears_worker_evidence_signoff` 在未传 `evidence_dir` 且未设置 `GEARS_EVIDENCE_DIR` 时，会自动发现最近的 `gears-worker-evidence*` 目录，并返回 `evidence_dir_source=input/env/latest/missing`。默认只扫描允许根 `/private/tmp`、`/tmp`、`TMPDIR` 与 repo root；`GEARS_EVIDENCE_AUTO_DISCOVER=0` 可关闭，`GEARS_EVIDENCE_AUTO_DISCOVER_ROOTS` 可限定扫描根。该能力只定位已生成证据，不执行 worker。

2026-06-23 acceptance kit 签收闭环追加：worker acceptance kit 新增 `read_worker_evidence_signoff` 命令；导出的 `run-gears-worker-acceptance.sh` 在正常完成、缺 env、submit transport failure、submit 非 2xx 和严格审计失败前都会打印 Web signoff URL、latest signoff URL 与 MCP signoff 工具调用提示。evidence bundle checklist/next actions 同步要求附加 signoff Markdown / JSON，便于真实 GEARS v2 smoke 后立刻形成签收/修复判定。

2026-06-23 Story Agent MVP status 追加：新增 `GET /api/system/story-agent-mvp-status`，只读组合 generated health 与 production readiness portfolio，输出 `story-agent-mvp-status/v1`、五条 MVP lane、priority targets、next actions、源报告和 Markdown。该状态报告用于判断 Story Agent 主线是否可进入 GEARS worker evidence signoff 或还需修复生成物/交付合同；不执行 GEARS worker 或任何媒体实产。

2026-06-23 MCP MVP status 追加：新增 `kb_get_story_agent_mvp_status`，输出 `mcp-story-agent-mvp-status/v1`，本地只读组合 generated health 与 production readiness portfolio，方便 agent 在无 Web server 时先判断 MVP lane，再决定是否跑 GEARS worker acceptance/signoff。

2026-06-23 项目工作台 MVP 总控追加：`Projects.vue` 已把 `story-agent-mvp-status/v1` 放到生产指挥总览之前展示，支持刷新、Markdown/JSON 导出、五条 lane、优先目标和下一步动作；操作员可先看 MVP 总控，再进入 GEARS worker evidence signoff。

2026-06-23 evidence bundle MVP status 追加：GEARS worker evidence bundle 新增 `story-agent-mvp-status-report.md`，并在 bundle summary 输出 `story_agent_mvp_status` / `story_agent_mvp_score`。当前证据包 documents=7，可把 Story Agent MVP lane 状态随 GEARS worker handoff 一起交付。

2026-06-23 worker acceptance MVP audit 追加：worker acceptance script 已把 `story-agent-mvp-status/v1` 接入跑前/跑后证据链，生成 `story-agent-mvp-status-before.json`、`story-agent-mvp-status-after.json`、`story-agent-mvp-status-audit.json/.md`；最终 verdict 新增 `story_agent_mvp_status_audit` gate，signoff API 与 MCP signoff 工具输出 `mvp_status_audit_passed`、MVP before/after status 与 score delta。当前 acceptance kit 为 20 条 commands / 5 个 payloads，verdict 为 8 个 gate，archive 必交附件为 26 个。该能力只做内容与生产指挥状态审计，不执行 GEARS worker 或媒体实产。

2026-06-23 post-archive signoff snapshot 追加：worker acceptance script 会在 archive / checksum / integrity 生成后自动读取 Web signoff API，并写出 `gears-worker-evidence-signoff.json` 与 `gears-worker-evidence-signoff.md`。该快照覆盖正常完成、缺 env、submit transport failure、submit 非 2xx 和严格审计失败出口；由于它发生在 archive 之后，不进入 checksum manifest，避免签收报告递归校验自身。

## 8. 下一对话推荐开场

```text
请继续 /Users/wuyu/Desktop/china-culture-kb 项目开发。先阅读 docs/gears-execution-integration-plan.md、docs/story-agent-next-development-plan.md、docs/story-agent-next-conversation-handoff.md。当前分支 codex-ai-comic-series-longform。先执行 git status --short --branch 和 git diff --stat，不要覆盖 data/provinces/湖南.md 的已有改动。新的方向是：china-culture-kb 只做内容与生产指挥层，图片/视频/后期实产全部交给 GEARS v2。优先实现 P0：GEARS execution config/contract、GEARS job ledger、提交 GEARS job、GEARS callback 归一化；暂停继续做真实 Seedance SDK、真实 ffmpeg 片头片尾、真实 final assemble。
```
