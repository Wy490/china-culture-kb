# Story Agent 下一阶段开发计划

> 日期：2026-06-19
> 分支：`codex-ai-comic-series-longform`
> 用途：给新对话快速接续 Story Agent、Production Board、GEARS / Seedance 交付链开发。

## 1. 当前进度

| 模块 | 当前判断 | 说明 |
|---|---:|---|
| Story Agent MVP | 约 75% | 生成、质量报告、项目版本、质量修复、前端查看已经跑通。 |
| Production Board / GEARS / Seedance | 约 96% | 生产板、监督、修复、导出、素材库、Shot Ledger、回传、重试、provider 队列元数据、超时恢复、外部回传 schema、轮询入口、失败分类、provider 错误码传递、通用 submit/poll adapter、平台式响应兼容、platform payload 映射、HMAC 签名、provider 队列状态总览、人工重试策略和重试执行自动化首版已完成。 |
| MCP Story Agent 闭环 | 约 75-80% | 项目读取、蓝图、质量校验、GEARS/Seedance 只读交付、repair dry-run、受控版本写入、安全 auto_apply 首版已完成。 |
| AI 漫剧系列生产链 | 约 77% | 系列规划、生产账本、回片、剪辑包、缩略图、精修计划、SRT 字幕包、字幕 worker、音频计划、混音 dry-run、片头片尾计划/render dry-run、final delivery dry-run、final manifest、审片返修 ledger、审片驱动重试包/strict final guard、重试执行计划、本地重试提交、retry submit adapter、系列 provider 超时恢复、外部剪辑平台包和生产总览 dashboard 首版已有；下一步是真实混音、真实片头片尾渲染和真实最终装配。 |
| 可商用制作中台 | 约 50% | 主链路可用；还缺 UX 降噪、真实外部 provider、平台专用错误码映射扩展、真实混音执行/最终成片、审片返修联动深化和稳定压测。 |

## 2. 本轮完成内容

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
  - 服务测试覆盖缺失音频计划、素材绑定、混音 dry-run 命令、远程音频失败、本地音频 fake runner 成功和输入路径校验；API 测试覆盖音频素材库、混音请求和缺失项目校验。
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

### P0：Seedance provider 平台专用 adapter

目标：

- 外部 provider 回传 schema 已完成首版。
- provider 轮询入口已完成首版，可返回待查询 job / queue，也可应用 provider status snapshots。
- provider 失败分类、错误码传递和通用错误码别名映射已完成首版，且已补平台常见错误码别名。
- 通用 submit/poll adapter 已完成首版，可通过 `SEEDANCE_PROVIDER_SUBMIT_ENDPOINT` / `SEEDANCE_PROVIDER_POLL_ENDPOINT` 连接外部 worker，并已兼容 `data.tasks/taskId/taskStatus/outputUrl` 等平台式响应。
- adapter 已支持 `story_agent` / `platform` 两种 payload mode；platform mode 可把镜头提交映射为平台常见 `prompt/duration/external_id/callback_url/metadata`，把查询映射为 `task_id/task_ids`，并支持 HMAC 签名和字段 env 改名。
- submit adapter 已能同时给外部 worker 提供项目级相对 path 与可选绝对 callback/poll URL；若 worker 不在同主机或同反向代理内，先配置 `SEEDANCE_PROVIDER_CALLBACK_BASE_URL`。
- adapter 已支持 batch 与单任务 request mode，可先用 `per_shot` / `per_target` 对接平台单任务 HTTP，再逐步补官方字段映射。
- poll adapter 已支持 `SEEDANCE_PROVIDER_POLL_HTTP_METHOD=GET` 与 endpoint URL 模板字段（如 `{provider_job_id}` / `{shot_id}` / `{provider_queue_id}`），可直接对接平台单任务查询 URL。
- 队列状态总览已完成首版，可直接读取 provider/queue 健康度、超时和失败注意项。
- 人工重试策略已完成只读首版，可直接输出可重提/需先处理的候选镜头清单。
- 重试执行自动化已完成首版，可把可重提候选一键重新提交到 provider 队列。
- 下一步支持具体 Seedance / 外部 provider 的平台 SDK/HTTP SDK 封装、官方错误码扩展和真实凭证 smoke。
- 将真实回传结果接入现有超时恢复、失败分类和重试包链路。

建议先做最小切片：

```text
SeedanceProviderAdapter
  -> run real credential submit smoke with platform payload/signature
  -> run real credential query/callback smoke
  -> map remaining official platform error codes
  -> feed poll-provider provider_results
  -> tests
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

### P1：AI 漫剧真实执行增强与 final manifest

下一块建议做：

```text
seedance-audio/mix real ffmpeg and multi-episode hardening
  -> seedance-title-cards/render real ffmpeg and visual template regression
  -> seedance-final/assemble real ffmpeg and precise title-card timeline
```

## 6. 新对话开场指令

```text
请继续 /Users/wuyu/Desktop/china-culture-kb 的 Story Agent 开发。先阅读 docs/story-agent-next-development-plan.md，再阅读 docs/story-agent-next-conversation-handoff.md 和其中列出的计划文档/技能。当前分支是 codex-ai-comic-series-longform。先执行 git status --short 和 git diff --stat，不要覆盖用户改动，尤其不要回滚 data/provinces/湖南.md。优先确认工作区状态，然后继续 P0：Seedance provider 平台 SDK/HTTP submit/query 实现、MCP 更深模型修复链路、故事管理 UX 降噪；AI 漫剧后期下一块做真实混音/片头片尾渲染增强、真实最终装配或审片联动深化。默认界面保持简单，只保留高频主路径。
```
