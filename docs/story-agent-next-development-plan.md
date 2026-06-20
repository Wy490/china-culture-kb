# Story Agent 下一阶段开发计划

> 日期：2026-06-19
> 分支：`codex-ai-comic-series-longform`
> 用途：给新对话快速接续 Story Agent、Production Board、GEARS / Seedance 交付链开发。

## 0. 2026-06-19 边界重定

新增权威计划：`docs/gears-execution-integration-plan.md`。

本项目重新定位为**内容与生产指挥层**，不再继续扩展真实图片、视频和后期执行器。图片、视频、字幕烧录、混音、片头片尾和最终装配等实际媒体产出统一交给 `Wy490/gears-v2`。

当前项目继续负责：

- 文化知识、故事、分镜、`gears_segments`、GEARS delivery 和 Seedance prompt。
- Production Board、素材 slot、Shot Ledger、GEARS Job Ledger、质量报告、审片返修和 dashboard。
- 向 GEARS 提交 job，接收 GEARS callback，并把 artifact / failure / review 状态写回项目。

暂停继续推进：

- 真实 Seedance / 外部视频平台 SDK 深接。
- 真实图片生成、字幕 burn-in、混音、片头片尾渲染和 final assemble。
- 独立媒体存储、转码、CDN 和 artifact 管理。

## 1. 当前进度

| 模块 | 当前判断 | 说明 |
|---|---:|---|
| Story Agent MVP | 约 75% | 生成、质量报告、项目版本、质量修复、前端查看已经跑通。 |
| Production Board / Delivery Contract | 约 96% | 生产板、监督、修复、导出、素材库、Shot Ledger、回传、重试、provider 队列元数据、超时恢复、外部回传 schema、轮询入口、失败分类、provider 错误码传递、通用 submit/poll adapter、平台式响应兼容、platform payload 映射、HMAC 签名、provider 队列状态总览、人工重试策略和重试执行自动化首版已完成；后续改为 GEARS job 合同。 |
| GEARS Execution Integration | 约 83% | 已建立 `GEARS_API` 配置/合同、统一 GEARS Job Ledger、单故事/系列 submit、callback 归一化、job status sync、系列图片/后期 job payload、后期 artifact 回写、响应层账本回显、系列工作台多 job 类型提交、status sync 部分成功合同、平台失败状态归一化、callback API 鉴权、多 artifact 回传合同、worker 对接示例、嵌套 status poll、嵌套 callback envelope、批量 callback envelope、批量坏项 failure 可见性、callback 幂等写回、callback/status sync 可观测重复计数、failure job 定位字段、progress 归一化写回、poll 失败诊断写回、乱序 callback 终态保护与审计字段、平台时间戳归一化、批量坏项 path 定位、终态冲突审计、`canceled` 终态失败上下文、平台状态别名失败归一化、artifact URL 别名归一化、source id 别名合同化、submit unit 幂等对账字段、submit/callback 幂等 key 贯通、仅凭幂等键回调匹配、幂等键生命周期审计、系列重试 payload 上下文、submit 意图字段和 Markdown 对账摘要；还缺 GEARS v2 真实端到端联调、更多失败类型扩展和大项目压测。 |
| MCP Story Agent 闭环 | 约 75-80% | 项目读取、蓝图、质量校验、GEARS/Seedance 只读交付、repair dry-run、受控版本写入、安全 auto_apply 首版已完成。 |
| AI 漫剧系列指挥层 | 约 82% | 系列规划、生产账本、回片、剪辑包、缩略图计划、精修计划、SRT/音频/片头片尾/final manifest 合同、审片返修 ledger、重试执行计划、外部剪辑平台包、生产总览 dashboard、GEARS 后期账本回显和图片/视频/后期 job 提交入口首版已有；系列视频重试主路径已明确迁到 GEARS submit。真实媒体执行迁出到 GEARS。 |
| 可商用制作中台 | 约 55% | 指挥层可用；还缺 GEARS execution integration、UX 降噪、审片返修联动深化和大系列稳定压测。 |

## 2. 本轮完成内容

### 2026-06-20 GEARS P0 Execution Integration

- 新增 GEARS execution config / contract：`GET /api/system/gears-execution-config` 和 `GET /api/system/gears-execution-contract` 只返回安全配置状态与合同元数据。
- 新增统一 GEARS Job Ledger 类型、schema 和服务层，支持单故事项目与 AI 漫剧系列项目记录 job、artifact、失败分类、错误码与 callback events。
- 新增单故事与系列 GEARS submit：本地 mock ledger 和 `use_gears_api=true` HTTP 提交共用同一合同。
- 新增单故事与系列 GEARS callback 归一化：兼容平台式 `jobId/taskId/status/outputUrl/artifacts` 字段，写回 GEARS Job Ledger 与 Shot Ledger / 系列生产账本。
- 新增 GEARS job status sync：按 ledger 轮询 `GET /gears/jobs/{gears_job_id}`，再复用 callback 归一化写回账本。
- 前端项目详情页和 AI 漫剧系列工作台已接入“提交 GEARS / 提交 GEARS API / 同步 GEARS 状态 / 导入 GEARS 回调”；系列工作台可选择提交视频、分镜图、人物图、场景图、字幕、混音、片头片尾和最终装配 job。
- 系列后期 GEARS job payload 映射已接入：`subtitle_render`、`audio_mix`、`title_card_render`、`final_assemble` 不再走泛化占位 payload，而是复用字幕包、音频计划、片头片尾计划和最终装配依赖合同。
- 系列图片 GEARS job payload 映射已接入：`storyboard_image`、`character_image`、`scene_image` 复用分集 GEARS delivery、人物资产和场景资产，并用 episode 维度隔离 source id。
- 系列后期 GEARS artifact callback 已接入专项账本写回：字幕、混音、片头片尾和最终交付任务 ready 后会同步更新对应 `seedance_*` ledger。
- 系列 GEARS callback / status sync 响应已统一带回后期专项账本；AI 漫剧系列工作台在导入回调或同步状态后会直接刷新字幕、混音、片头片尾和最终交付状态，且同步按钮改为同步全部活跃 GEARS job。
- 单故事项目与 AI 漫剧系列的 GEARS status sync 已补部分成功测试：同一批 job 中部分 GEARS status HTTP 失败时，成功 job 仍写回 ledger / 生产账本，失败项进入结构化 `failures`。
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
- GEARS progress 已补合同与账本写回：callback / status sync 支持 `progress`、`progress_percent`、`progressPercent`、`percent`、`percentage`、`progress_ratio` 等字段，统一归一化为 `progress_percent` 并在单故事与系列工作台最新 job 摘要中回显。
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
- GEARS 系列 submit 响应已补 `job_type`、`job_type_label`、`submit_intent` 和更完整 Markdown 对账摘要；GEARS execution contract 示例已切换到系列 `seedance_video` 返修/重试 payload，系列工作台按钮文案也改为“GEARS 视频返修/重试”，旧 Seedance 重试入口标为兼容路径。
- 验证已通过：server lint/build、client lint/build、`project-service.test.ts`、`outline-service.test.ts`、`api.test.ts`。

### MCP / Agent 工具

- 新增并注册 `kb_generate_gears_delivery`：从 `project_id`、`story_id`、`story_json` 只读生成 GEARS 交付包。
- 新增并注册 `kb_generate_seedance_prompt`：生成 Seedance 2.0 镜头提示词包，支持 `@图片/@视频/@音频` 参考。
- 新增 `kb_repair_story(auto_apply=false)`：返回质量快照、修复动作、目标场景和风险说明。
- 新增 `kb_update_project_version`：受控新增项目版本，不覆盖旧版本，不写知识库省份文件。
- 扩展 `kb_repair_story(auto_apply=true)`：必须由调用方提供 `repaired_story_json`，校验后写入新版本。
- 已用真实项目 smoke 验证 auto_apply：质量分从 83 提升到 100，issue 从 2 降到 0。

### Web / Production Board

- 项目详情页新增当前版本质量反馈面板：聚合缺失要素、弱节拍、不适配表达和修复建议。
- Seedance provider 提交抽象已进入工作台：可本地记录 provider job、跳过已有非失败任务、失败镜头重新提交递增 retry。
- Seedance provider 队列元数据首版：
  - `StoryProjectMeta.seedance_provider_queue`
  - `provider_queue_batch`
  - `provider_queue_id`
  - `provider_queue_position`
  - 前端显示最新队列批次和镜头队列位置。
- Seedance provider 超时恢复首版：
  - 新增 `POST /api/projects/:projectId/production-board/seedance-shots/recover-provider`
  - 默认 dry-run 扫描 `submitted` / `processing` 超时镜头。
  - `mark_timed_out_failed=true` 时标记 failed，并追加 failed 版本。
  - 前端“回传与重试”增加“标记超时失败”。
- Seedance provider 外部回传 schema 首版：
  - 新增 `POST /api/projects/:projectId/production-board/seedance-shots/provider-callback`
  - 支持外部 provider 单条回传的 `provider`、job、queue、event、视频 URL、失败原因、质量分和 review note。
  - 若配置 `SEEDANCE_CALLBACK_SECRET`，单故事 provider webhook 必须携带 `Authorization: Bearer <secret>` 或 `X-Seedance-Callback-Secret`。
  - 回传可按 job 匹配，也可按 `queue_id + queue_position` 映射到 Shot Ledger。
  - 状态归一化复用内部回传导入，ready/failed/processing/submitted 等平台状态会更新 `seedance_shot_ledger`。
  - 修复状态更新丢失 provider / queue 元数据的问题。
- Seedance provider 轮询入口首版：
  - 新增 `POST /api/projects/:projectId/production-board/seedance-shots/poll-provider`
  - dry-run 返回待轮询的 provider job / queue 目标，可选带出镜头提示词。
  - 带 `provider_results` 时可应用外部适配器查询到的状态快照，复用回传归一化写回 Shot Ledger。
- Seedance provider 失败分类首版：
  - 共享类型新增 `SeedanceProviderFailureCategory`，覆盖素材缺失、提示词非法、内容审核、超时、额度、鉴权、限流、服务端、网络和未知错误。
  - 内部状态更新、外部回传和轮询结果都可携带 `failure_category` 与 `provider_error_code`。
  - 超时恢复默认写入 `provider_timeout` / `PROVIDER_TIMEOUT`；重试包 Markdown / JSON 会带出失败分类、provider 错误码和分类化建议动作。
  - Production Board 同步 `seedance_shot_ledger` 时会保留失败分类和错误码，避免导出重试包时丢字段。
  - 新增 provider 错误码别名映射层，`INSUFFICIENT_BALANCE`、`TOKEN_EXPIRED` 等 code 可在失败文案很短时直接归入额度、鉴权等类别。
- Seedance provider 通用 poll adapter 首版：
  - `SeedanceShotProviderPollRequest` 新增 `use_provider_adapter`。
  - 服务端读取 `SEEDANCE_PROVIDER_POLL_ENDPOINT`，把 dry-run 产生的 `poll_targets` POST 给外部 adapter。
  - adapter 可返回顶层数组、`provider_results`、`results` 或 `items`，服务端会复用既有回传归一化写回 Shot Ledger。
  - 默认支持 `SEEDANCE_PROVIDER_API_TOKEN` 的 bearer 鉴权，也支持通过 `SEEDANCE_PROVIDER_POLL_AUTH_HEADER` / `SEEDANCE_PROVIDER_POLL_AUTH_SCHEME` 或通用 auth env 改成 `X-API-Key`、`Token`、裸 token 等模式。
  - 支持 `SEEDANCE_PROVIDER_POLL_TIMEOUT_MS` 超时控制；外部 adapter 网络/HTTP 错误在路由层返回 502。
  - 项目详情页“回传与重试”新增“轮询 provider”按钮，会按最新 provider / queue 批次调用 poll adapter，成功后刷新 Production Board、队列健康和重试策略。
- Seedance provider 通用 submit adapter 首版：
  - `SeedanceShotProviderSubmitRequest` 新增 `use_provider_adapter`，响应新增 `provider_adapter` 提交摘要。
  - 服务端读取 `SEEDANCE_PROVIDER_SUBMIT_ENDPOINT`，把待提交镜头、Seedance prompt、素材 slot 和素材库 POST 给外部 adapter。
  - adapter 返回真实 `provider_job_id` / `provider_queue_id` / queue position 后，会覆盖本地占位 job 并写入 Shot Ledger 与 provider queue batch。
  - 默认支持 `SEEDANCE_PROVIDER_SUBMIT_API_TOKEN` 或通用 `SEEDANCE_PROVIDER_API_TOKEN` bearer 鉴权，也支持通过 submit/auth env 自定义 header 名和 scheme；未配置 endpoint 返回 400，外部 adapter HTTP/网络错误返回 502。
  - 项目详情页“回传与重试”保留本地“提交到 Seedance”，并新增“提交 adapter”入口，用于从工作台直接触发真实 submit worker。
- Seedance provider adapter 配置状态首版：
  - 新增 `GET /api/system/seedance-provider-config`，只返回 submit/poll endpoint 是否配置、token 是否配置和超时毫秒数，不暴露 endpoint URL 或 token 原文。
  - 配置状态新增 `callback_secret_configured`，用于确认 provider 回传 webhook 是否启用共享凭据保护。
  - 配置状态新增 submit/poll 的有效鉴权 header 和 scheme，仅暴露名称/模式，不暴露 token 原文。
  - 项目详情页 Seedance Shot Ledger 顶部新增 adapter 配置 chips，可在点击提交/轮询前看到 submit adapter、poll adapter 和 token 状态。
  - “提交 adapter”和“轮询 provider”会按配置状态禁用，未配置 endpoint 时不再等到点击后才返回 400。
  - 响应新增缺失 env var 清单、配置 warning 和下一步动作，项目详情页会直接显示缺 `SEEDANCE_PROVIDER_SUBMIT_ENDPOINT` / `SEEDANCE_PROVIDER_POLL_ENDPOINT` 等诊断信息。
- Seedance provider adapter 合约元数据首版：
  - 新增 `GET /api/system/seedance-provider-adapter-contract`，返回 submit/poll schema version、env key、请求字段、可接受响应形态和归一化字段。
  - 合约接口不返回 endpoint URL 或 token 原文，可给外部 worker / Agent 对接前读取。
  - 合约接口新增 `callback_auth_env` 和 `callback_auth_headers`，外部 worker 可按约定给 `provider_callback_path` 带回调鉴权头。
  - 合约接口新增 `auth_header_envs`、`auth_scheme_envs`、默认 header 和默认 scheme，真实 worker 可按平台鉴权习惯选择 bearer、token 前缀或裸 token。
  - 合约接口新增 `request_example` 和 `response_examples`，外部 worker 可直接按示例实现 submit/query smoke。
  - submit adapter payload 新增 `provider_callback_path` 和 `provider_poll_path` 相对路径，外部 worker 可直接按项目路径回传或查询状态。
  - submit adapter payload 新增可选 `provider_callback_url` 和 `provider_poll_url` 绝对 URL；服务端优先读取 `SEEDANCE_PROVIDER_CALLBACK_BASE_URL`，并回落到 `GEARS_CALLBACK_BASE_URL` / `PUBLIC_API_BASE_URL` / `APP_BASE_URL`。
  - 配置状态新增 `callback_base_configured` 和可用 env 名列表，只暴露是否配置，不返回真实公开基址。
  - submit/poll adapter 新增 request mode：默认 `batch`，也可通过 `SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE=per_shot` 和 `SEEDANCE_PROVIDER_POLL_REQUEST_MODE=per_target` 对接单任务创建/查询平台接口。
  - adapter 响应归一化支持单个任务对象或 `data` 下单个任务对象，便于真实平台 HTTP 返回直接进入 Shot Ledger。
- Seedance provider 平台式响应兼容层首版：
  - submit/poll adapter 可接受顶层数组、`submitted_shots` / `provider_results` / `results` / `items`，以及 `tasks`、`task_list`、`jobs`、`records`、`data.tasks` 等更贴近平台 worker 的返回形态。
  - 结果字段兼容 `taskId/task_id/id/requestId`、`batchId/batch_id`、`taskStatus/state/phase`、`outputUrl/fileUrl/downloadUrl/resultUrl`、`score/quality`。
  - 单故事 `provider-callback` schema 同步支持这些字段别名，真实 worker 可直接回传平台式任务字段。
  - provider 错误码别名扩展 `RISK_CONTROL`、`NO_CREDIT`、`ACCOUNT_ARREARS`、`ACCESS_DENIED`、`INVALID_SIGNATURE`、`QPS/TPS/CONCURRENCY`、`SYSTEM/MODEL` 等类别映射。
- Seedance provider 队列状态总览首版：
  - 新增 `POST /api/projects/:projectId/production-board/seedance-shots/provider-overview`。
  - 可按 `provider` / `queue_id` 过滤，返回状态计数、活跃数、完成数、失败数、可重试数、超时数、缺视频数和注意项。
  - 批次汇总会从当前 Shot Ledger 回看 ready/failed/active/timed_out 状态，避免只依赖提交时的 batch 原始状态。
  - 注意项按超时、失败、处理中、已提交优先排序，并带出失败分类、provider 错误码和复用的重试建议。
  - 项目详情页 Seedance Shot Ledger 已接入“Provider 队列健康”条，显示批次、活跃、完成、失败、可重试、超时和注意项，并支持手动刷新。
- Seedance provider 人工重试策略首版：
  - 新增 `POST /api/projects/:projectId/production-board/seedance-shots/provider-retry-plan`。
  - 可按 `provider` / `queue_id` / `timeout_minutes` / `max_retry_count` / 失败分类过滤，返回失败、超时、完成但缺视频和可选未提交镜头。
  - 每个候选镜头会标注优先级、重试原因、是否可直接重提、阻断原因、失败分类、provider 错误码和建议动作。
  - Markdown 输出可直接给人工制作或外部 worker 复核。
  - 项目详情页“Provider 队列健康”下新增默认折叠的“人工重试策略”，支持刷新策略和导出 Markdown。
- Seedance provider 重试执行自动化首版：
  - 新增 `POST /api/projects/:projectId/production-board/seedance-shots/provider-retry-submit`。
  - 自动读取 retry plan 中 `can_resubmit=true` 的候选镜头，跳过素材缺失、提示词非法、内容审核、额度、鉴权等阻断项。
  - 复用 submit-provider 队列写入和 adapter 提交逻辑，重提旧 job 时会递增 `retry_count` 并生成新 provider queue batch。
  - 项目详情页“人工重试策略”新增“提交可重提”，执行后刷新 Production Board、队列健康和重试策略。
- Seedance provider 自动轮询 UI 首版：
  - 项目详情页“回传与重试”折叠区新增“轮询 provider”。
  - 默认使用最新 provider queue batch 的 `provider` / `queue_id`，请求 `include_prompt=true` 和 `use_provider_adapter=true`。
  - 轮询成功后回写项目快照并刷新 Production Board、Provider 队列健康和人工重试策略，页面提示更新数、待轮询数和 adapter 返回数。
- Seedance provider platform payload / 签名 adapter 首版：
  - 新增 `SEEDANCE_PROVIDER_PAYLOAD_MODE`、`SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE`、`SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE`，默认保持 `story_agent` 合同，启用 `platform` 后 submit 映射为 `tasks[].prompt/duration/external_id/callback_url/metadata`，poll 映射为 `task_ids/targets[].task_id/external_id/metadata`。
  - submit/poll 平台字段支持 env 改名，适合先对接真实平台 HTTP 单任务或批量接口，不再必须另写外部 worker 做字段翻译。
  - 新增 HMAC 签名支持：`SEEDANCE_PROVIDER_SIGNATURE_SECRET` 或 submit/poll 专用 secret 会写入签名头和时间戳头；签名基串为 `METHOD\nURL\nTIMESTAMP\nJSON_BODY`。
  - adapter 响应和直接 webhook 兼容 `external_id/externalId/custom_id/customId`，可映射回 Story Agent `shot_id`。
  - `GET /api/system/seedance-provider-config` 与 `GET /api/system/seedance-provider-adapter-contract` 已同步暴露 payload mode、签名配置状态、签名 header、平台字段 env 和 platform payload 示例，不泄漏密钥。
- AI 漫剧 Seedance 字幕链路首版：
  - 新增 `export-seedance-subtitles`，从成片精修计划的 subtitle cues 生成合法 SRT、Markdown 和 JSON 字幕包。
  - 新增 `seedance-subtitles/render` worker，支持 `dry_run`、`overwrite`、`episode_no`、`output_filename`、`mode=sidecar` 和 `mode=burn_in`。
  - 新增 `seedance_subtitle_render` 账本，记录 SRT 路径、输出路径、ffmpeg 命令、渲染状态、失败原因和 cue 数。
  - 系列工作台新增“导出 SRT 字幕”“生成字幕文件”“烧录字幕成片”和字幕渲染状态卡。
  - 服务测试覆盖 SRT 包、分集 SRT、sidecar dry-run、sidecar 写盘和 burn-in mock runner；API 测试覆盖字幕导出/渲染请求校验。
- AI 漫剧 Seedance 音频链路首版：
  - 新增 `seedance_audio_library`，支持保存音乐、环境声、音效、旁白等音频素材条目。
  - 新增 `export-seedance-audio-plan`，把成片精修计划里的 audio cues 与音频素材库合并为 Markdown / JSON 音频计划。
  - 新增 `seedance-audio/mix`，支持 `dry_run`、分集筛选、输入视频路径、输出文件名、audio profile 和可复现 ffmpeg 命令。
  - 新增 `seedance_audio_mix` 账本，记录状态、源视频、输出路径、素材数、缺失音频数、失败原因和 ffmpeg 命令。
  - 系列工作台新增“导出音频计划 Markdown / JSON”“导入音频素材”和“混音 dry-run”，并展示混音状态卡。
  - 已补真实 runner 输入 hardening：非 dry-run 校验源视频、本地音频素材路径和文件存在，远程 URL / 协议路径会写入明确失败原因。
  - 已补多分集混音边界：分集混音会将该集 audio cues 时间轴归零，系列底乐可复用于单集，缺失音频数按分集范围统计。
  - 已补真实混音输出校验和原声保留开关：`include_original_audio` / `original_audio_volume_db` 会进入 ffmpeg `amix`，runner 未产出文件会写入明确失败原因。
  - 服务测试覆盖缺失音频计划、素材绑定、混音 dry-run 命令、分集混音时间归一、原声保留、远程音频失败、runner 未产出失败、本地音频 fake runner 成功和输入路径校验；API 测试覆盖音频素材库、混音请求和缺失项目校验。
- AI 漫剧 Seedance 片头片尾 / final delivery dry-run 首版：
  - 新增 `export-seedance-title-card-plan`，从 finishing plan 的 title cards 生成可执行片头片尾计划、输出路径和 ffmpeg command hint。
  - 新增 `seedance-title-cards/render`，支持 dry-run、分集筛选、output profile、`FFMPEG_FONT_PATH` 校验和 `seedance_title_card_render` 账本。
  - 已补片头片尾 fake runner hardening：非 dry-run 后校验输出文件存在，runner 未产出文件会写入明确失败原因，fake runner 成功会写回 ready 账本。
  - 新增 `seedance-final/assemble`，支持 dry-run、strict/tolerant 缺依赖模式、字幕/混音/片头片尾依赖状态、final ffmpeg 命令、`seedance_final_delivery` 账本和 final manifest JSON 写盘。
  - 已补最终装配 fake runner hardening：非 dry-run 前校验依赖文件存在，runner 未产出最终视频会写入明确失败原因，fake runner 成功会写回 ready 账本和 ready manifest。
  - 系列工作台新增“导出片头片尾计划 Markdown / JSON”“片头片尾 dry-run”“最终交付 dry-run”和最终交付依赖状态卡，最终交付卡展示 manifest 路径。
  - 服务测试覆盖 title card plan、render dry-run、title/final runner 未产出失败、title/final fake runner 成功、strict 缺依赖、final delivery dry-run 和 manifest 写盘；API 测试覆盖 title card/final 请求校验和缺失项目响应。
- AI 漫剧 Seedance 外部剪辑平台包首版：
  - 新增 `export-seedance-editing-platform-package`，输出 `ai-comic-series-editing-platform-package/v1`。
  - 首版支持 `generic_json`、`csv_timeline`、`srt` 和 `asset_manifest` 四种交付形态。
  - 时间线会串联系列片头、分集片头、镜头、分集片尾和系列片尾，并把 SRT cue 偏移到外部剪辑时间线。
  - 素材清单汇总视频、音频、字幕、片头片尾、缩略图和最终交付输出，并聚合缺失镜头、缺失音频和 final dependency。
  - 系列工作台新增剪辑平台 JSON、时间线 CSV、SRT 和素材清单 CSV 导出按钮。
  - 服务测试覆盖包 schema、格式、时间线、素材和 SRT；API 测试覆盖缺失项目响应。
- AI 漫剧 Seedance 生产总览 dashboard 首版：
  - 新增 `seedance-production-dashboard`，输出 `ai-comic-series-seedance-dashboard/v1`。
  - 后端聚合提示词导出、镜头生产、缩略图、剪辑装配、字幕、混音、片头片尾、最终交付和外部剪辑包状态。
  - dashboard 返回 summary、status_items、blockers、next_actions、episodes 和 Markdown 摘要。
  - 系列工作台新增“Seedance 生产总览”面板，展示总镜头、ready、失败、已选剪辑版、缩略图、阻断项和下一步动作。
  - 服务测试覆盖 dashboard 汇总、失败 blocker、下一步动作、分集摘要和 Markdown；API 测试覆盖缺失项目响应。
- AI 漫剧 Seedance 审片返修 ledger 首版：
  - 新增 `seedance_review_ledger`，支持 final / cut / shot / subtitle / audio / title_card 审片目标。
  - 新增审片意见、解决审片意见和导出审片返修包服务/API。
  - 返修包输出 open review、retry candidate、final reassemble required 和 Markdown 摘要。
  - 未解决 shot 审片意见会进入 Seedance 重试包；未解决 final reassemble 审片意见会阻断 strict final delivery dry-run。
  - 新增 `ai-comic-series-seedance-retry-execution-plan/v1`，把重试包进一步拆成可直接提交、需人工处理和缺提示词镜头。
  - 新增 `ai-comic-series-seedance-retry-submit-result/v1`，可把执行计划里可提交候选写回生产账本为 submitted，并生成本地 provider job id。
  - `seedance-retry/submit` 已支持 `use_provider_adapter=true`，读取 `SEEDANCE_PROVIDER_SUBMIT_ENDPOINT`、submit auth env、HMAC 签名 env 和 `SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE`，把审片返修候选提交给外部 worker。
  - retry submit adapter 支持 batch / per_shot 请求、`production_id` 优先匹配、常见 `results/items/tasks/submitted_shots` 响应形态、provider queue 元数据和 `submitted/processing/failed` 归一化；仅回写 provider 接受的镜头，失败项返回 `provider_failures`。
  - 新增 `ai-comic-series-seedance-provider-recovery-result/v1`，支持 dry-run 扫描 submitted/processing 超时镜头，并可标记 failed。
  - final reassemble 审片意见默认仍会阻断 strict final delivery；显式执行重装配并成功写出 final delivery 后，可自动解决对应 `reassemble_final` 审片项。
  - dashboard 聚合 open/blocking 审片数，并把未解决审片意见纳入 blocker / next action。
  - 系列工作台最终交付区新增审片返修轻量录入、open 列表、标记解决和返修包导出。
  - 服务测试覆盖 review ledger、retry candidate、final reassemble blocker、final reassemble 自动解决、review retry package、retry execution plan、本地 retry submit、retry submit adapter、provider recovery 和 strict final guard；API 测试覆盖 review / retry execution / retry submit / provider recovery 路由校验和缺失项目响应。

### 文档同步

- 更新 `docs/story-agent-next-conversation-handoff.md`。
- 更新 `docs/story-agent-production-workbench-development-plan.md`。
- 更新 `开发文档/story-agent-mcp-quality-delivery-implementation-plan.md`。
- 保持下一阶段方向从“队列化准备”推进到“外部回传 schema、自动轮询、真实 provider API”；外部回传 schema、轮询入口、失败分类、通用 submit/poll adapter、platform payload / HMAC 签名、队列状态总览、人工重试策略和重试执行自动化已完成首版。

## 3. 已验证命令

```bash
cd web/client && npm run lint
cd web/server && npm run lint
cd web/server && npm test -- src/__tests__/project-service.test.ts
cd web/server && npm test -- --run src/__tests__/outline-service.test.ts
cd web/server && npm test -- --run src/__tests__/api.test.ts
cd web/server && npm test -- --fileParallelism=false
cd web && npm run build -w server
git diff --check
```
最近一次结果：

- `web/client`：lint passed。
- `web/client`：build passed。
- `web/server`：lint passed；`outline-service.test.ts` 14 passed，`api.test.ts` 112 passed；串行全量 24 files / 269 tests passed；server build passed。
- `web/client`：lint passed；ProjectDetail provider overview API smoke 通过，提交 5 条 provider 任务后 overview 返回 5 个总镜头 / 5 个活跃 / 5 个注意项。
- `git diff --check`：passed。

注意：`web/server` 的 API 测试会启动本地 HTTP server，在沙箱中可能触发 `listen EPERM 0.0.0.0`，需要允许非沙箱运行；全量默认并行跑可能因测试共享临时根出现隔离波动，串行模式已通过。

## 4. 当前工作区提醒

- 新对话开始必须先执行：

```bash
git status --short
git diff --stat
```

- 若出现未提交改动，先复核是否属于当前推进范围；不要覆盖或回滚用户已有改动。

## 5. 下一阶段优先级

### P0：GEARS Execution Adapter

首轮已完成：

- 新增 `GEARS_API_BASE_URL`、`GEARS_API_TOKEN`、`GEARS_CALLBACK_SECRET` 配置合同。
- 新增 `GET /api/system/gears-execution-config` 与 `GET /api/system/gears-execution-contract`。
- 新增 GEARS Job Ledger，统一记录图片、视频、字幕、混音、片头片尾和 final assemble job。
- 新增提交 GEARS job 的服务层 adapter，复用现有 Seedance prompt、GEARS delivery、retry execution plan 和素材 slot。
- 扩展 GEARS callback：支持 artifact URL、状态、失败分类、错误码、质量分、review note。
- 新增 GEARS status sync：从 ledger 轮询 `GET /gears/jobs/{gears_job_id}`，复用 callback 归一化写回账本。
- 旧 `SEEDANCE_PROVIDER_*` 保留为兼容层，新开发优先走 `GEARS_*`。

下一步最小切片：

```text
GEARS v2 real endpoint smoke
  -> submit seedance_video job
  -> poll status / receive callback
  -> verify Shot Ledger / series production ledger
  -> extend payload mapping for non-video job types
```

### P0：MCP 更深模型修复链路

目标：

- 根据 `kb_repair_story(auto_apply=false)` 返回的 repair actions，让模型或 Agent 生成 `repaired_story_json`。
- 生成后先校验，再调用 `kb_repair_story(auto_apply=true)` 安全写入。
- 保持“模型生成内容”和“工具写入版本”分离。

### P0-P1：故事管理 UX 降噪

继续简化默认界面：

- 批量删除确认必须明确“只删除当前筛选结果中的已选故事”。
- 筛选外已选故事继续保持可见提示和一键清除。
- 筛选区增加更明显重置入口。
- 项目工作台默认只保留高频主路径，高级制作动作放折叠区。

### P1：AI 漫剧后期合同迁移到 GEARS

原计划中的真实 ffmpeg 片头片尾、真实 final assemble、真实混音媒体烟测暂停在当前仓库继续深挖，改为迁移到 GEARS execution job：

```text
title_card_render job
  -> final_assemble job
  -> audio_mix job
  -> GEARS callback writes ledger / dashboard
```

当前仓库继续保留计划包、dry-run、manifest、依赖检查和审片返修，不做真实媒体产出。

## 6. 新对话开场指令

```text
请继续 /Users/wuyu/Desktop/china-culture-kb 的 Story Agent 开发。先阅读 docs/gears-execution-integration-plan.md、docs/story-agent-next-development-plan.md、docs/story-agent-next-conversation-handoff.md 和其中列出的计划文档/技能。当前分支是 codex-ai-comic-series-longform。先执行 git status --short --branch 和 git diff --stat，不要覆盖用户改动，尤其不要回滚 data/provinces/湖南.md。新的方向是：china-culture-kb 只做内容与生产指挥层，图片/视频/后期实产全部交给 GEARS v2。优先实现 P0：GEARS execution config/contract、GEARS job ledger、提交 GEARS job、GEARS callback 归一化；暂停继续做真实 Seedance SDK、真实 ffmpeg 片头片尾、真实 final assemble。默认界面保持简单，只保留高频主路径。
```
