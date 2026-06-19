# Story Agent 下一对话接续文档

> 日期：2026-06-19
> 当前分支：`codex-ai-comic-series-longform`  
> 适用场景：在新的 Codex / Claude 对话中继续 Story Agent、Production Board、GEARS / Seedance 交付链开发。  
> 当前状态：继续前先执行 `git status --short`；如有未提交改动，先确认来源和范围再推进。

## 1. 新对话优先阅读

请先阅读这些文件，再继续开发：

- `docs/story-agent-next-development-plan.md`
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
| Production Board / GEARS / Seedance 交付链 | 约 66% -> 已推进到约 96% | Board、监督、批量修复、导出已可用；近期补了单任务修复、结果 diff、空修复不增版本、按镜头/类别修复、逐场景 diff、Seedance 素材 slot、`@图片/@视频/@音频` 引用校验、素材缺口报告、单故事素材绑定回写、素材上传态/外部批量导入/真实文件上传、跨项目素材库复用首版、素材上传历史 UI 首版、Seedance Shot Ledger、单故事回传导入、失败重试包、手动/自动择优、批量状态流转、provider 任务提交抽象、provider 队列元数据、provider 超时恢复、外部回传 schema、轮询入口、失败分类、provider 错误码传递、通用 submit/poll adapter、平台式响应兼容、platform payload 映射、HMAC 签名、provider 队列状态总览、人工重试策略和重试执行自动化首版。 |
| AI 漫剧系列生产链 | 约 78% | 系列规划、Seedance 生产账本、回片、剪辑包、缩略图、初版装配、精修计划、SRT 字幕包、字幕 worker、音频计划、混音 dry-run、混音真实 runner hardening、片头片尾计划/render dry-run、final delivery dry-run、final manifest、审片返修 ledger、审片驱动重试包/strict final guard、重试执行计划、本地重试提交、retry submit adapter、系列 provider 超时恢复、外部剪辑平台包和生产总览 dashboard 首版已具备；下一步是真实片头片尾渲染和真实最终装配。 |
| 可商用制作中台 | 约 50% | 主链路可用，但还缺 UX 降噪、真实 provider、平台专用错误码映射扩展、真实混音执行/最终成片、回滚、审片返修联动深化和稳定压测。 |
| MCP Story Agent 闭环 | 约 75-80% | `kb_get_project_context`、`kb_generate_story_blueprint`、`kb_validate_genre_story`、`kb_generate_gears_delivery`、`kb_generate_seedance_prompt`、`kb_repair_story(auto_apply=false/true)`、`kb_update_project_version` 已完成；真实项目 auto_apply smoke 已通过，后续剩更深模型修复链路和前端质量反馈增强。 |

当前主线已经不是“能不能生成故事”，而是“生成后能不能低复杂度管理、修复、交付、回片、装配”。

## 3. 已完成能力

### 3.1 MCP / Agent 基础

已完成：

- Mac Codex 已接入 `china-culture-kb` MCP。
- 项目级 skills 已建立：
  - `china-culture-story-agent`
  - `china-culture-screenwriting`
  - `gears-seedance-delivery`
- MCP 已有 21 个工具。
- Story Agent 相关 MCP 已完成：
  - `kb_get_project_context`
  - `kb_generate_story_blueprint`
  - `kb_validate_genre_story`
  - `kb_generate_gears_delivery`
  - `kb_generate_seedance_prompt`
  - `kb_repair_story(auto_apply=false)`
  - `kb_update_project_version`
  - `kb_repair_story(auto_apply=true，需 repaired_story_json)`
- 文档已记录 MCP roadmap、工具清单、技能路径和跨机器工具环境。

进一步待做：

- 更深模型修复链路：让模型或 Agent 根据 repair_actions 生成 `repaired_story_json`。
- 前端质量反馈增强：补更细的 drilldown 和真实浏览器视觉回归。

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
- Production Board 增加“修复并落盘”一键流程：
  - 后端新增 `POST /api/projects/:projectId/production-board/repair-export`。
  - 服务层复用生产修复和交付包导出，不新开第二套逻辑。
  - 前端新增“修复并落盘”按钮，成功后沿用修复 diff 和交付包状态。
- Production Repair History 首版：
  - 生产修复版本摘要回读 `production_board_repair_trace`。
  - Production Board 导出会把交付包时间、目录、文件数和交付阶段写入当前版本快照。
  - 项目详情页版本记录区域新增 Production Repair History 面板。
- Production Board 按镜头 / 问题类别修复首版：
  - `StoryProductionBoardRepairRequest` 新增 `categories`、`shot_ids`、`scene_ids`。
  - 服务层会把 repair task 的目标 issue / shot / scene 收窄到请求范围，避免按镜头修复时误改其它镜头。
  - 项目详情页 Supervision 问题卡增加“修复此类”，镜头卡增加“修复此镜头”。
- Production Board 逐场景 diff 首版：
  - `StoryProductionBoardRepairTrace` 新增 `scene_diffs`，按场景记录被生产修复改动的字段。
  - 服务层从 `scene_breakdown` 和 `gears_segments` 对比生成字段级 diff，`changed_scene_ids` 与 `scene_diffs` 保持同源。
  - 项目详情页在生产修复结果中默认折叠展示逐场景 diff，避免默认铺满页面。
- Seedance 资产引用字段和素材校验首版：
  - `SeedancePromptPackage` 新增结构化 `asset_references` 和包级 `material_validation`。
  - `SeedancePromptShotUnit` 新增 `asset_slots` 和镜头级 `material_validation`。
  - Production Board 镜头单元新增 `seedance_asset_slots` 和 `seedance_material_validation`，Seedance JSON/Markdown 导出会带出素材 slot 与复杂度/时长风险。
  - Seedance prompt 会为每个 `@图片` 引用写明人物、场景或道具用途。
  - Production Board 展示层会清理画面提示中的生成优先级、来源说明、质量信号等内部前缀；修复计划仍用原始提示识别 `clean_prompt` 任务，便于回写项目版本。
- Seedance `@视频1` / `@音频1` 引用校验首版：
  - 当故事或镜头文字显式出现 `@视频`、参考视频、运镜参考、镜头参考、节奏参考等信号时，会生成 `@视频N` 运镜/节奏参考 slot。
  - 当故事或镜头文字显式出现 `@音频`、音乐参考、音效参考、配乐参考、环境声参考等信号时，会生成 `@音频N` 音乐/音效参考 slot。
  - `material_validation` 会校验 video slot 必须使用 `@视频` 前缀并标注为 `camera_reference`，audio slot 必须使用 `@音频` 前缀并标注为 `music_reference` 或 `sound_reference`。
  - Seedance Markdown 顶部素材统计已显示图片、视频、音频三个计数，镜头提示词会写出 `@视频` / `@音频` 的用途。
- Production Board 级 Seedance 素材缺口报告首版：
  - `StoryProductionBoard` 新增 `seedance_asset_report`，按素材 slot 聚合素材状态、待上传数量、缺槽位和受影响镜头。
  - 交付清单新增 `Seedance Asset Report` artifact。
  - Production Board 导出包新增 `seedance-asset-report.json` 和 `seedance-asset-report.md`。
  - 项目详情页展示待上传素材、缺槽位、受影响镜头和前 8 个缺文件素材。
- 单故事 Seedance 素材绑定回写首版：
  - `StoryProjectMeta` 新增 `seedance_asset_library`，可持久化素材 `file_url` / `file_id`。
  - 后端新增 `POST /api/projects/:projectId/production-board/seedance-assets`，按素材 id 或 `kind+label` 合并绑定信息。
  - Production Board 会把项目素材库带入 `seedance_asset_report`，已绑定素材从 `missing_file` 更新为 `bound`，并降低待上传数量。
  - 项目详情页素材缺口区支持对单个缺文件素材输入 URL 或 file ID 并绑定。
- 单故事 Seedance 素材上传态与外部批量导入首版：
  - `SeedanceAssetLibraryItem` 和 `SeedanceAssetBindingItem` 新增 `local_path`、`provider`、`provider_asset_id`、`upload_status`、`upload_error`。
  - 后端新增 `POST /api/projects/:projectId/production-board/seedance-assets/import`，支持粘贴外部素材清单，按 `asset_id` 或 `kind+label` 匹配 Production Board 素材缺口。
  - 批量导入会返回导入数、匹配已有素材数、跳过数、跳过原因和刷新后的项目详情。
  - Production Board 素材缺口报告会识别 provider asset、上传态和本地路径，`uploaded/external` 或已有文件标识可让素材进入 `bound`。
  - 项目详情页素材缺口区新增默认折叠的“批量导入素材”，支持 JSON 数组或 `{ "items": [...] }` 清单。
- 单故事 Seedance 真实文件上传首版：
  - 后端新增 `POST /api/projects/:projectId/production-board/seedance-assets/upload`，支持 multipart 单文件上传，限制 20MB。
  - 上传文件会落盘到 `web/generated/projects/<projectId>/seedance-assets/uploads/`，并生成 `file_id`、相对 `local_path`、`original_filename`、`mime_type`、`size_bytes`。
  - 上传成功后会以 `provider=local_upload`、`upload_status=uploaded` 回写 `seedance_asset_library`，Production Board 素材缺口报告会立即把对应素材标为 `bound`。
  - 项目详情页缺文件素材卡新增“上传文件”入口，按素材 modality 限制 image/video/audio 选择类型。
- Seedance 跨项目素材库复用首版：
  - 后端新增 `GET /api/projects/:projectId/production-board/seedance-assets/global`，动态聚合其它项目中已上传、外部导入或具备 `file_url/file_id/local_path/provider_asset_id` 的可复用素材。
  - 后端新增 `POST /api/projects/:projectId/production-board/seedance-assets/reuse`，可把来源项目素材复制到当前项目目标素材槽，并保持 `provider`、`provider_asset_id`、`local_path`、上传态和文件元数据。
  - 项目详情页素材缺口区新增默认折叠的“跨项目素材库”，缺文件素材卡会显示同 `kind+label` 的可复用来源按钮。
  - Production Board 刷新后可立即把复用素材从 `missing_file` 更新为 `bound`。
- Seedance 素材上传历史 UI 首版：
  - `SeedanceAssetLibraryItem` 新增 `history`，记录 `manual_bind`、`batch_import`、`file_upload`、`cross_project_reuse` 四类事件。
  - 手动绑定、外部素材批量导入、真实文件上传和跨项目复用都会追加一条素材历史，并保留最近 25 条。
  - 历史事件记录上传态、provider、provider asset、file/url/local path、原始文件名、来源项目和 note。
  - 项目详情页素材卡新增默认折叠的“上传历史”，展示最近 4 条事件。
- 单故事 Seedance Shot Ledger 首版：
  - `StoryProjectMeta` 新增 `seedance_shot_ledger`，记录每个 Seedance 镜头的生产状态。
  - `StoryProductionBoard` 新增 `seedance_shot_ledger`，默认按镜头同步为 `prompt_exported`。
  - 后端新增 `POST /api/projects/:projectId/production-board/seedance-shots`，可记录 `provider_job_id`、`video_url`、失败原因、质量分、review note 和版本列表。
  - Production Board 导出包新增 `seedance-shot-ledger.json` 和 `seedance-shot-ledger.md`。
  - 项目详情页镜头卡显示 Seedance 状态、job/video URL、版本数和剪辑版，并把更新状态收进折叠区。
- 单故事 Seedance 回传导入与失败重试包首版：
  - 后端新增 `POST /api/projects/:projectId/production-board/seedance-shots/import`，支持 `shot_id` 或历史 `job_id/provider_job_id` 匹配镜头，并兼容 `videoUrl`、`url`、`error`、`qualityScore`、`reviewNote` 等回传字段别名。
  - 后端新增 `POST /api/projects/:projectId/production-board/export-seedance-retry-package`，只导出未完成、失败、缺视频 URL 或尚未提交的镜头，ready 且有视频 URL 的镜头会跳过。
  - 重试包包含状态、失败原因、重试次数、上次 job、上次视频 URL、建议动作、Seedance prompt、素材 slot 和负向约束，并提供 Markdown / JSON。
  - 项目详情页 `Seedance Shot Ledger` 增加默认折叠的“回传与重试”，支持粘贴 JSON 回传导入和下载重试包。
- 单故事 Seedance Shot Ledger 自动择优与批量状态流转首版：
  - 后端新增 `POST /api/projects/:projectId/production-board/seedance-shots/batch`，可批量把镜头状态流转为 `submitted`、`processing`、`ready` 或 `failed`，并返回成功数和失败项。
  - 后端新增 `POST /api/projects/:projectId/production-board/seedance-shots/select-version`，支持手动把某个 ready 且有 `video_url` 的版本设为剪辑版。
  - 后端新增 `POST /api/projects/:projectId/production-board/seedance-shots/auto-select`，按质量分优先、创建时间次优先自动选择可用版本，默认保留人工选择，可显式覆盖。
  - 项目详情页“回传与重试”折叠区增加“待提交->已提交”和“自动择优”，镜头更新折叠区会显示“设为剪辑版 / 当前剪辑版”版本按钮。
- 单故事 Seedance provider 任务提交抽象首版：
  - 共享类型新增 `SeedanceShotProviderSubmitRequest` / `SeedanceShotProviderSubmitResult`。
  - 后端新增 `POST /api/projects/:projectId/production-board/seedance-shots/submit-provider`，默认提交 `not_started`、`prompt_exported`、`failed` 镜头，并记录本地 `provider_job_id`。
  - 支持 `shot_ids`、`provider`、`job_prefix`、`overwrite_existing` 和 `note`；已存在 job 的非失败镜头默认跳过，失败镜头可重新提交并递增 `retry_count`。
  - 提交会把镜头写入 `submitted` 状态并追加一条 submitted 版本，返回 submitted/skipped/failed 统计。
  - 项目详情页“回传与重试”折叠区增加“提交到 Seedance”按钮，先作为外部 provider API 前的本地任务账本抽象。
- 单故事 Seedance provider 队列元数据首版：
  - `StoryProjectMeta` 新增 `seedance_provider_queue`，按 batch history 记录 queue_id、provider、priority、submitted/skipped/failed 统计和队列条目。
  - `SeedanceShotLedgerItem` 新增 `provider`、`provider_queue_id`、`provider_queue_position`，Production Board 同步 ledger 时会保留这些字段。
  - provider submit 请求新增 `queue_id`、`queue_priority`，响应新增 `provider_queue_batch` 和 `seedance_provider_queue`。
  - 项目详情页 Seedance Shot Ledger 顶部展示最新 provider 队列批次，镜头卡展示对应 queue id 和 position。
- 单故事 Seedance provider 超时恢复首版：
  - 共享类型新增 `SeedanceShotProviderRecoveryRequest` / `SeedanceShotProviderRecoveryResult`。
  - 后端新增 `POST /api/projects/:projectId/production-board/seedance-shots/recover-provider`，默认 dry-run 扫描 `submitted` / `processing` 超时镜头。
  - 请求显式 `mark_timed_out_failed=true` 时，会把超时镜头标为 `failed`，追加 failed 版本并保留 provider job / queue 元数据。
  - 项目详情页“回传与重试”折叠区新增“标记超时失败”按钮，默认按 120 分钟检查。
- 单故事 Seedance provider 外部回传 schema 首版：
  - 共享类型新增 `SeedanceShotProviderCallbackRequest` / `SeedanceShotProviderCallbackResult`。
  - 后端新增 `POST /api/projects/:projectId/production-board/seedance-shots/provider-callback`，支持外部 provider 单条 webhook 回传。
  - 回传支持 `provider`、`provider_job_id/job_id`、`provider_queue_id/queue_id`、`provider_queue_position/queue_position`、`event_id`、`video_url/url`、`failure_reason/error`、质量分和 review note。
  - 若配置 `SEEDANCE_CALLBACK_SECRET`，单故事 provider webhook 必须携带 `Authorization: Bearer <secret>` 或 `X-Seedance-Callback-Secret`。
  - 状态归一化复用内部回传导入；可按 job 匹配，也可按 `queue_id + queue_position` 映射到 Shot Ledger。
  - 修复 `updateProjectSeedanceShotStatus` 更新 ready/failed 时丢失 provider / queue 元数据的问题。
- 单故事 Seedance provider 轮询入口首版：
  - 共享类型新增 `SeedanceShotProviderPollRequest` / `SeedanceShotProviderPollResult` 和 `SeedanceShotProviderPollTarget`。
  - 后端新增 `POST /api/projects/:projectId/production-board/seedance-shots/poll-provider`。
  - dry-run 会按 provider、queue、shot、状态筛选待查询 job，可选带出 Seedance prompt 供外部 worker 使用。
  - 请求带 `provider_results` 时会把外部 adapter 查询到的状态快照归一化并写回 Shot Ledger。
  - 项目详情页“回传与重试”折叠区新增“轮询 provider”，默认用最新 provider queue batch 调用 poll adapter，并在成功后刷新 Production Board、队列健康和人工重试策略。
- 单故事 Seedance provider 失败分类首版：
  - 共享类型新增 `SeedanceProviderFailureCategory`，状态更新、外部回传、轮询结果、版本记录、ledger 和重试包都可携带 `failure_category` 与 `provider_error_code`。
  - 回传归一化会根据显式分类、provider 错误码、失败原因和 message 推断素材缺失、提示词非法、内容审核、超时、额度、鉴权、限流、服务端、网络和未知错误。
  - 新增 provider 错误码别名映射层，优先识别 `INSUFFICIENT_BALANCE`、`TOKEN_EXPIRED`、`INVALID_PROMPT`、`POLICY_BLOCKED`、`RATE_LIMIT_429`、`RISK_CONTROL`、`NO_CREDIT`、`ACCESS_DENIED`、`QPS/TPS/CONCURRENCY` 等 code，再用失败文案关键词兜底。
  - 超时恢复默认写入 `provider_timeout` / `PROVIDER_TIMEOUT`，重试包 Markdown / JSON 会显示失败分类、provider 错误码和分类化建议动作。
  - Production Board 同步 ledger 时保留失败分类和错误码，避免导出重试包时丢失 provider 失败上下文。
- 单故事 Seedance provider 通用 poll adapter 首版：
  - `SeedanceShotProviderPollRequest` 新增 `use_provider_adapter`，响应新增 `provider_adapter` 查询摘要。
  - 服务端读取 `SEEDANCE_PROVIDER_POLL_ENDPOINT`，把 dry-run 产生的 `poll_targets` POST 给外部 adapter，并接受顶层数组、`provider_results`、`results`、`items`、`tasks`、`data.tasks` 等返回形态。
  - 默认支持 `SEEDANCE_PROVIDER_API_TOKEN` bearer 鉴权；也可通过 `SEEDANCE_PROVIDER_POLL_AUTH_HEADER` / `SEEDANCE_PROVIDER_POLL_AUTH_SCHEME` 或通用 auth env 改成 `X-API-Key`、`Token`、裸 token 等模式。
  - 支持 `SEEDANCE_PROVIDER_POLL_TIMEOUT_MS` 超时控制。
  - adapter 返回结果继续复用内部 callback 归一化、失败分类和 Shot Ledger 写回；未配置 endpoint 返回 400，外部 adapter HTTP/网络错误返回 502。
  - 项目详情页“轮询 provider”入口会设置 `include_prompt=true` / `use_provider_adapter=true`，用于从工作台直接触发外部查询 worker。
- 单故事 Seedance provider 通用 submit adapter 首版：
  - `SeedanceShotProviderSubmitRequest` 新增 `use_provider_adapter`，响应新增 `provider_adapter` 提交摘要。
  - 服务端读取 `SEEDANCE_PROVIDER_SUBMIT_ENDPOINT`，把待提交镜头、Seedance prompt、素材 slot、素材校验和素材库 POST 给外部 adapter。
  - adapter 返回真实 `provider_job_id` / `provider_queue_id` / queue position 后，会覆盖本地占位 job 并写入 Shot Ledger 与 provider queue batch。
  - 默认支持 `SEEDANCE_PROVIDER_SUBMIT_API_TOKEN` 或 `SEEDANCE_PROVIDER_API_TOKEN` bearer 鉴权；也可通过 submit/auth env 自定义 header 名和 scheme。未配置 endpoint 返回 400，外部 adapter HTTP/网络错误返回 502。
  - 项目详情页“回传与重试”折叠区新增“提交 adapter”，与本地账本“提交到 Seedance”分开，点击后带 `use_provider_adapter=true` 触发外部 submit worker。
- 单故事 Seedance provider 平台式响应兼容层首版：
  - submit/poll adapter 可接受 `tasks`、`task_list`、`jobs`、`records`、`data.tasks` 等外部 worker 常见返回形态。
  - 结果字段兼容 `taskId/task_id/id/requestId`、`batchId/batch_id`、`taskStatus/state/phase`、`outputUrl/fileUrl/downloadUrl/resultUrl`、`score/quality`。
  - `provider-callback` schema 同步支持这些字段别名，真实 worker 可直接以平台任务字段回传。
  - 系统合约接口的 accepted response shapes、normalized fields 和 response examples 已更新为平台式示例。
- 单故事 Seedance provider platform payload / HMAC 签名首版：
  - adapter 默认仍使用 `story_agent` 合同；配置 `SEEDANCE_PROVIDER_PAYLOAD_MODE=platform` 或 submit/poll 专用 payload mode 后，会把 Story Agent 镜头映射成平台常见字段。
  - submit platform payload 默认包含 `tasks[].prompt`、`duration`、`external_id`、`callback_url`、`poll_url`、`assets`、`negative_prompt`、`metadata`，字段名可通过 `SEEDANCE_PROVIDER_SUBMIT_*_FIELD` 改名。
  - poll platform payload 默认包含 `task_ids`、`targets[].task_id`、`external_id`、`metadata`，字段名可通过 `SEEDANCE_PROVIDER_POLL_*_FIELD` 改名。
  - 配置 `SEEDANCE_PROVIDER_SIGNATURE_SECRET` 或 submit/poll 专用 secret 后，会写入签名头与时间戳头；签名基串为 `METHOD\nURL\nTIMESTAMP\nJSON_BODY`。
  - adapter 响应和直接 webhook 已兼容 `external_id/externalId/custom_id/customId`，可直接映射回 `shot_id`。
  - 配置状态和合约接口同步暴露 payload mode、签名配置状态、签名 header、timestamp header、平台字段 env 和 platform payload 示例，不泄露密钥。
- 单故事 Seedance provider adapter 配置状态首版：
  - 后端新增 `GET /api/system/seedance-provider-config`，返回 submit/poll endpoint 是否已配置、token 是否已配置和 submit/poll timeout。
  - 响应只暴露布尔状态和数值，不返回 endpoint URL 或 token 原文。
  - 响应新增 `callback_secret_configured`，可在接入真实 worker 前确认 provider 回传 webhook 是否启用共享凭据保护。
  - 响应新增 submit/poll 有效鉴权 header 和 scheme，只暴露名称/模式，不暴露 token。
  - 项目详情页 Seedance Shot Ledger 顶部新增 adapter 配置 chips，点击提交/轮询前即可看到 submit adapter、poll adapter、token 和 timeout 状态。
  - “提交 adapter”和“轮询 provider”按钮会按配置状态禁用，避免未配置 endpoint 时误触发 adapter 请求。
  - 响应和前端 chips 已补缺失 env var、配置 warning 和下一步动作，便于直接排查真实 provider worker 接入前的配置问题。
- 单故事 Seedance provider adapter 合约元数据首版：
  - 后端新增 `GET /api/system/seedance-provider-adapter-contract`，返回 submit/poll schema version、env key、请求字段、可接受响应形态和归一化字段。
  - 合约接口不返回 endpoint URL 或 token 原文，外部 worker / Agent 可先读取该接口再实现 submit/query。
  - 合约接口新增 `callback_auth_env` 和 `callback_auth_headers`，外部 worker 可按约定给 `provider_callback_path` 带回调鉴权头。
  - 合约接口新增 `auth_header_envs`、`auth_scheme_envs`、默认 header 和默认 scheme，便于真实 worker 适配 `Authorization`、`X-API-Key`、`Token`、裸 token 等鉴权模式。
  - 合约接口新增 submit/poll 的 `request_example` 和 `response_examples`，用于真实 worker smoke 对照。
  - submit adapter payload 已带 `provider_callback_path` 和 `provider_poll_path` 相对路径，worker 可不猜项目级回传/轮询 API。
  - submit adapter payload 也会在配置公开 API 基址时附带 `provider_callback_url` 和 `provider_poll_url` 绝对地址；配置优先级为 `SEEDANCE_PROVIDER_CALLBACK_BASE_URL`、`GEARS_CALLBACK_BASE_URL`、`PUBLIC_API_BASE_URL`、`APP_BASE_URL`。
  - 配置状态接口新增 `callback_base_configured` 和可用 env 名列表，仍只返回布尔/名称，不泄漏真实公开基址。
  - submit/poll adapter 新增 request mode，默认 `batch`；`SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE=per_shot` 会逐镜头 POST，`SEEDANCE_PROVIDER_POLL_REQUEST_MODE=per_target` 会逐 provider job POST。
  - 平台返回单个任务对象或 `data` 下单个任务对象时也会被归一化，适合真实平台单任务创建/查询接口先行 smoke。
  - poll adapter 支持 `SEEDANCE_PROVIDER_POLL_HTTP_METHOD=GET`，并可在 `SEEDANCE_PROVIDER_POLL_ENDPOINT` 中使用 `{provider_job_id}`、`{shot_id}`、`{provider_queue_id}` 等模板字段；GET 模式不发送 JSON body。
- 单故事 Seedance provider 队列状态总览首版：
  - 共享类型新增 `SeedanceShotProviderQueueOverviewRequest` / `SeedanceShotProviderQueueOverviewResult`，并补齐批次概览与注意项结构。
  - 后端新增 `POST /api/projects/:projectId/production-board/seedance-shots/provider-overview`。
  - 可按 `provider` / `queue_id` 过滤，返回状态计数、活跃数、完成数、失败数、可重试数、超时数、缺视频数、批次汇总和注意项。
  - 批次概览会基于当前 Shot Ledger 回看 `ready/failed/submitted/processing`，注意项复用失败分类、provider 错误码和重试建议。
  - 项目详情页 Seedance Shot Ledger 接入“Provider 队列健康”条，展示批次、活跃、完成、失败、可重试、超时、注意项和前三条注意项，并支持刷新。
- 单故事 Seedance provider 人工重试策略首版：
  - 共享类型新增 `SeedanceShotProviderRetryPlanRequest` / `SeedanceShotProviderRetryPlanResult`。
  - 后端新增 `POST /api/projects/:projectId/production-board/seedance-shots/provider-retry-plan`。
  - 支持按 provider、queue、超时分钟、最大重试次数和失败分类筛选。
  - 候选镜头会区分失败、超时、完成但缺视频和可选未提交，并标注优先级、能否直接重提、阻断原因、错误码和建议动作。
  - 返回 Markdown，便于人工制作、外部 worker 或审片返修流程复核。
  - 项目详情页“Provider 队列健康”下新增默认折叠的“人工重试策略”，可刷新策略并导出 Markdown。
- 单故事 Seedance provider 重试执行自动化首版：
  - 共享类型新增 `SeedanceShotProviderRetrySubmitRequest` / `SeedanceShotProviderRetrySubmitResult`。
  - 后端新增 `POST /api/projects/:projectId/production-board/seedance-shots/provider-retry-submit`。
  - 服务层会先读取 retry plan，只选择 `can_resubmit=true` 的候选镜头重新提交，阻断项保留给人工处理。
  - 执行重试复用 `submit-provider`，支持 target queue、job prefix、provider adapter 和高优先级队列；旧 job 重提会递增 retry_count。
  - 项目详情页“人工重试策略”新增“提交可重提”，执行成功后刷新 Production Board、队列健康和策略。
- 前端质量反馈视图首版：
  - 项目详情页“当前版本质量”新增类型反馈面板。
  - 默认聚合显示缺失要素、弱节拍、不适配表达、修复建议。
  - 修复动作会显示关联场景 ID 和场景标题，方便快速定位。
  - 移动端自动单列，避免质量信息挤压按钮区。

### 3.3 后端与测试基础

本轮已完成：

- `repairProjectProductionBoard` 在 trace 未实际应用时直接返回结果，不写新版本。
- 项目删除 API 测试覆盖 `removed_story_file_count`。
- Production Board 单任务修复服务测试覆盖 `task_ids`。
- Production Board 单任务修复路由测试覆盖 `POST /api/projects/:projectId/production-board/repair`。
- 新增 `WEB_GENERATED_ROOT`，测试或多实例运行时可覆盖默认 `web/generated` 根目录。
- 修复后台 webhook / gears video / gears delivery 异步回写时因环境变量恢复而串到默认 generated 目录的问题。
- API 测试会隔离生成物，当前已确认不再留下 `web/web/generated/projects` 测试残留。

近期 Seedance provider 关键文件：

- `docs/story-agent-next-development-plan.md`
- `docs/story-agent-next-conversation-handoff.md`
- `web/server/src/__tests__/api.test.ts`
- `web/server/src/__tests__/project-service.test.ts`
- `web/server/src/routes/system.ts`
- `web/server/src/services/project-service.ts`
- `web/shared/schemas.ts`
- `web/shared/types.ts`
- `docs/deployment-guide.md`

## 4. 已验证内容

近期验证清单：

```bash
cd web/client && npm run lint
cd web/server && npm run lint
cd web/server && npm test
cd web/server && npm test -- src/__tests__/project-service.test.ts
cd web/server && npm test -- src/__tests__/api.test.ts
git diff --check
```

测试结果：

- `project-service.test.ts`：36 passed。
- `api.test.ts`：103 passed。
- `web/server && npm test`：24 files passed，260 tests passed。
- `project-service.test.ts` 已覆盖 provider 提交失败镜头、生成 job id、失败镜头 retry_count 递增、重复提交跳过、外部 provider callback 按 queue 元数据回写、provider poll dry-run / provider_results 应用、失败分类进入 retry package、通用错误码别名映射、通用 provider submit adapter mock 提交、poll adapter mock 查询写回、provider 队列状态总览的超时/失败/批次汇总、provider 人工重试策略的可重提/阻断候选，以及 provider 重试执行自动化只提交可重提镜头。
- `api.test.ts` 已覆盖 `GET /api/system/seedance-provider-config` / `GET /api/system/seedance-provider-adapter-contract` 不泄露 endpoint/token 原文，`POST /api/projects/:projectId/production-board/seedance-shots/submit-provider`、`/provider-callback` 的 `SEEDANCE_CALLBACK_SECRET` 鉴权、`/poll-provider`、`/provider-overview`、`/provider-retry-plan`、`/provider-retry-submit`，以及 provider 失败错误码归一化写回 ledger、submit/poll adapter 未配置 endpoint 的 400 响应；AI 漫剧 API 已覆盖外部剪辑平台包和生产总览 dashboard 缺失项目响应。
- `web/client && npm run lint`：passed。
- `web/client && npm run build`：passed。
- `web/server && npm run lint`：passed。
- `git diff --check`：passed。
- API smoke：`20260618-story-5xha--ai_comic_drama` 本地 ignored 项目通过 `submit-provider` 提交 5 条任务，`provider-overview` 返回 200，total=5、active=5、attention=5；用于验证 ProjectDetail 新接入的 overview API 有真实数据。
- MCP 真实项目 smoke：`20260617-story-5xh7--ai_comic_drama` 通过 `kb_repair_story(auto_apply=true)` 从 v1 写入 v2，`scene_ids_changed=[4,5]`，质量分 83 -> 100，issue 2 -> 0；`kb_get_project_context(include_versions=true)` 回读 v1/v2 正常。该 smoke 修改的是 ignored 的 `web/generated` 本地项目数据，不进入提交。
- HTTP smoke：`http://127.0.0.1:5173/projects/20260617-story-5xh7--ai_comic_drama` 返回 200；`http://127.0.0.1:3000/api/projects/20260617-story-5xh7--ai_comic_drama` 返回 200，API 回读当前版本为 v2、质量分 100、issue 0。
- 浏览器 smoke 限制：本机缺 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，Playwright / Chrome DevTools 均无法启动；本轮用 build + HTTP smoke 替代。
- 浏览器 smoke：`http://127.0.0.1:5174/projects/20260617-story-5xh7--ai_comic_drama` 的 Production Board / Seedance 展开区已确认素材 slot、素材校验、复杂度、风险标签、`@图片` 均可见；Seedance 提示词和镜头邻近区域未见 `生成优先级`、`本场景基于`、`具体细节请核实来源`、`核心画面是`，控制台无 error。
- 浏览器 smoke：`http://localhost:5173/projects/20260617-story-5xh7--ai_comic_drama` 的 Production Board 已确认 `Seedance Asset Report` artifact、素材缺口摘要、待上传数量、缺文件素材 chips、`@图片` 可见，控制台无 error。
- 浏览器 smoke：同一项目的 Seedance 素材缺口区已确认 URL / file ID 绑定控件可见；将第一条缺文件素材绑定为 `seedance-smoke-file-001` 后，页面提示“已绑定 Seedance 素材”，待上传数量从 6 降为 5，控制台无 error。冒烟修改的是 ignored 的 `web/generated` 本地项目数据，不进入提交。
- 浏览器 smoke：同一项目已确认 `Seedance Shot Ledger` 区块、`job id` / `video URL` 输入、镜头卡“更新状态”折叠区可见；将 `shot-1` 标记为完成后，统计从已完成 0 到 1，job/video URL 和剪辑版版本回显。刷新后状态仍保留；热重载期曾留下旧 JSON 解析错误日志，刷新复查未出现新的错误。
- 浏览器 smoke：同一项目已确认 `Seedance Shot Ledger` 中“回传与重试”默认折叠区、`JSON callbacks` 输入、`导入回传`、`重试包 MD/JSON` 按钮可见；导入 `shot-2` 回传后统计从已完成 1 到 2，job/video URL 回显，控制台无 error。冒烟修改的是 ignored 的 `web/generated` 本地项目数据，不进入提交。
- 浏览器 smoke：同一项目已确认“回传与重试”展开后 `待提交->已提交`、`自动择优`、当前剪辑版版本按钮可见；批量状态按钮和自动择优按钮均可触发，控制台无 error。冒烟修改的是 ignored 的 `web/generated` 本地项目数据，不进入提交。
- 浏览器 smoke：同一项目已确认 `Seedance 素材缺口` 中“批量导入素材”默认折叠区可见；导入 `{ label: "少年", kind: "character", provider_asset_id, upload_status: "uploaded" }` 后页面提示“Seedance 素材已导入：1 条”，该素材从“缺文件”变为“已绑定”，控制台无 error。冒烟修改的是 ignored 的 `web/generated` 本地项目数据，不进入提交。
- 浏览器 smoke：`http://localhost:5173/projects/20260617-story-5xh6--ai_comic_drama` 的 Production Board 已确认“跨项目素材库”入口可见、缺文件素材卡出现 2 个“复用”按钮，控制台无 error；本次只读检查，未点击复用写回。
- 浏览器 smoke：同一项目手动绑定 `seedance-history-smoke-file-001` 后，素材卡出现“上传历史 1”，折叠内容包含“手动绑定”和 file ID，控制台无 error。冒烟修改的是 ignored 的 `web/generated` 本地项目数据，不进入提交。
- 浏览器 smoke：`http://localhost:5173/projects/20260617-story-5xh6--ai_comic_drama` 的 Production Board 已确认“回传与重试”展开后 `提交到 Seedance` 按钮可见；点击后页面提示“Seedance provider 提交完成：5 条，跳过 0 条，失败 0 条”，ledger 从待提交 5 更新为已提交 5。冒烟修改的是 ignored 的 `web/generated` 本地项目数据，不进入提交。
- API smoke：`POST /api/projects/:projectId/production-board/seedance-assets/upload` 已用 multipart `.attach()` 覆盖，验证上传结果写入本地项目目录、素材库和 Production Board 素材缺口报告。

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
3. 如果有未提交改动且没有新增问题，先提交当前成果。

建议提交信息：

```text
支持 Seedance provider poll GET 模板
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

已完成单任务修复、轻量 diff、“修复并落盘”、Production Repair History、按镜头 / 问题类别修复首版、逐场景 diff 首版、Seedance 素材 slot、`@图片/@视频/@音频` 引用校验、素材缺口报告、单故事素材绑定回写、外部素材批量导入与上传态字段、真实文件上传、跨项目素材库复用、素材上传历史 UI、Seedance Shot Ledger、单故事回传导入、失败重试包、手动/自动择优、批量状态流转、provider 任务提交抽象、provider 队列元数据、provider 超时恢复、外部回传 schema、轮询入口、失败分类、通用 submit/poll adapter、platform payload / HMAC 签名、provider 队列状态总览、人工重试策略和重试执行自动化首版，下一步：

- 真实 Seedance / 外部 provider 平台 SDK/HTTP submit/query 实现。
- 基于官方响应字段和真实平台错误码继续扩展字段映射，并接入真实 provider SDK/HTTP 凭证 smoke。

### P0-P1：Seedance 资产引用字段和素材校验

已完成首版：

- 角色参考图字段。
- 场景参考图字段。
- 道具参考图字段。
- 素材 slot。
- `@图片1` 引用角色/场景/道具用途分配。
- 素材数量限制校验。
- Prompt Complexity / Duration 校验。
- Production Board 级素材缺口报告。
- 单故事素材库绑定回写。
- 外部素材清单批量导入。
- 素材上传态字段首版。
- 真实二进制文件上传首版。
- 跨项目素材库复用首版。
- 素材上传历史 UI 首版。
- Seedance Shot Ledger 首版。
- Seedance provider 任务提交抽象首版。
- Seedance provider 失败分类和错误码传递首版。
- Seedance provider 通用 poll adapter 首版。
- Seedance provider 通用 submit adapter 首版。
- Seedance provider 队列状态总览首版。
- Seedance provider 人工重试策略首版。
- Seedance provider 重试执行自动化首版。
- `@视频1` / `@音频1` 引用校验首版。

仍待做：

- 真实 Seedance / 外部 provider 平台 SDK/HTTP submit/query 实现。
- 平台专用错误码映射扩展和真实 provider SDK/HTTP。

字段规则必须遵守：

- `script_text`：观众可见/可听的剧本内容。
- `visual_prompt`：可见画面元素。
- `camera_suggestion`：镜头语言。
- `segment_prompt_hint`：制作指导和限制。
- `validation_notes`：给人或 Agent 的问题，不得混进 prompt。

## 6. MCP 下一步

MCP 计划的下一步是把已验证的修复闭环接入更深模型修复链路，并继续完善前端质量反馈。

推荐顺序：

1. 更深模型修复链路：根据 repair_actions 产出 `repaired_story_json`。
2. 前端质量反馈增强：质量 drilldown、真实浏览器视觉回归。
3. Seedance provider 平台 SDK/HTTP submit/query 实现。

`kb_generate_gears_delivery` 已完成首版：

- 能从 `project_id` 读取当前版本。
- 能从 `story_id` 读取 generated stories。
- 能从 `story_json` 直接生成。
- 返回 units、assets、validation notes。
- 能清理 prompt 污染。
- 不写文件。
- 单测和 MCP build 通过。

`kb_generate_seedance_prompt` 已完成首版：

- 8 秒以上自动分时段。
- 每个 `@素材` 都有用途。
- 包含镜头语言和音效/音乐提示。
- 能提示时长过载、引用模糊、写实真人脸素材风险。
- 不混入质量报告或内部字段名。
- 能从 `project_id`、`story_id`、`story_json` 读取。
- 不写文件，单测和 MCP build 通过。

`kb_repair_story(auto_apply=false)` 已完成首版：

- 能从 `project_id`、`story_id`、`story_json` 读取。
- 复用 `kb_validate_genre_story` 的质量结果，返回 `quality_snapshot`、`source_issues`、`repair_actions`、`target_scenes`、`risk_notes`。
- 每条 repair action 包含优先级、类别、目标场景、字段提示和验收标准。
- 不写文件，单测和 MCP build 通过。

`kb_repair_story(auto_apply=true)` 已完成安全应用首版：

- 必须提供 `project_id` 和调用方生成的 `repaired_story_json`；工具不会自行虚构修复正文。
- 会先对 `repaired_story_json` 运行 `kb_validate_genre_story`，再通过 `kb_update_project_version` 写入 `quality_repair` 新版本。
- 返回 `after_quality_snapshot`、`update_result` 和风险说明；旧版本不覆盖。
- 缺少 `repaired_story_json` 时只返回 dry-run 和阻断说明。

`kb_update_project_version` 已完成首版：

- 输入 `project_id`、`change_type`、`change_target.scene_ids`、`snapshot_json`、`user_instruction`。
- 永远新增 `versions/{version_id}.json`，并更新 `project.json` 的 `current_version_id`、`version_count`、`updated_at` 和质量摘要。
- 不覆盖旧版本，不写 `data/provinces/*.md`，不直接覆盖 `web/generated/stories/{video_type}/{storyId}.json`。
- 如果 snapshot 省略 `quality_report`、`story_blueprint`、`gears_segments` 等关键字段，会从当前版本补回并在 `preserved_fields` 中报告。
- 能被 `kb_get_project_context(include_versions=true)` 回读，单测和 MCP build 通过。

## 7. AI 漫剧 Seedance 后期下一步

已完成字幕链路首版：

```text
export-seedance-subtitles
  -> seedance-subtitles/render sidecar
  -> seedance-subtitles/render burn-in
  -> seedance_subtitle_render ledger
  -> 前端导出 SRT / 生成字幕文件 / 烧录字幕成片
```

已落地：

- 后端新增字幕包、SRT 生成、sidecar 写盘、burn-in ffmpeg runner 和字幕渲染账本。
- API 新增 `export-seedance-subtitles` 与 `seedance-subtitles/render`。
- 系列工作台新增导出 SRT、生成字幕文件、烧录字幕成片和字幕状态卡。
- 服务测试覆盖 SRT 包、分集 SRT、sidecar dry-run、sidecar 写盘和 burn-in mock runner；API 测试覆盖字幕请求校验。

已完成音频链路首版：

```text
seedance_audio_library
  -> export-seedance-audio-plan
  -> seedance-audio/mix dry-run
  -> seedance_audio_mix ledger
  -> 前端音频素材导入 / 音频计划导出 / 混音状态
```

已落地：

- 后端新增音频素材库类型、音频计划包、混音请求、混音结果和混音账本。
- API 新增 `seedance-audio-library`、`export-seedance-audio-plan` 与 `seedance-audio/mix`。
- 系列工作台新增音频素材 JSON 导入、音频计划 Markdown / JSON 导出、混音 dry-run 和混音状态卡。
- 已补混音真实执行 hardening：源视频/本地音频素材路径校验、远程 URL 阻断、runner 输出文件校验、分集 cue 时间轴归零、系列底乐单集复用，以及 `include_original_audio` / `original_audio_volume_db` 原声保留开关。
- 服务测试覆盖缺失音频计划、素材绑定、混音 dry-run 命令、分集混音时间归一、原声保留、远程音频失败、runner 未产出失败、本地音频 fake runner 成功和输入路径安全校验；API 测试覆盖音频素材库、混音请求和缺失项目校验。

已完成片头片尾 / final delivery dry-run 首版：

```text
export-seedance-title-card-plan
  -> seedance-title-cards/render dry-run
  -> seedance-final/assemble dry-run
  -> seedance_title_card_render / seedance_final_delivery ledger
  -> 前端最终交付依赖状态
```

已落地：

- 后端新增片头片尾计划、render 请求/结果、final delivery 请求/结果、依赖状态和两个账本。
- API 新增 `export-seedance-title-card-plan`、`seedance-title-cards/render` 与 `seedance-final/assemble`。
- 系列工作台新增片头片尾计划 Markdown / JSON 导出、片头片尾 dry-run、最终交付 dry-run 和最终交付依赖状态卡。
- 服务测试覆盖 title card plan、render dry-run、strict 缺依赖和 final delivery dry-run；API 测试覆盖 title card/final 请求校验和缺失项目响应。

已完成外部剪辑平台包首版：

```text
export-seedance-editing-platform-package
  -> generic_json / csv_timeline / srt / asset_manifest
  -> title card + shot timeline
  -> shifted SRT cue
  -> missing assets summary
  -> 前端剪辑平台导出按钮
```

已落地：

- 后端新增 `ai-comic-series-editing-platform-package/v1` 类型和 `exportAiComicSeriesSeedanceEditingPlatformPackage`。
- API 新增 `export-seedance-editing-platform-package`。
- 系列工作台新增剪辑平台 JSON、时间线 CSV、SRT 和素材清单 CSV 导出。
- 服务测试覆盖 schema、格式、时间线、SRT、素材清单和 Markdown；API 测试覆盖缺失项目响应。

已完成生产总览 dashboard 首版：

```text
seedance-production-dashboard
  -> summary / status_items / blockers / next_actions / episodes
  -> 前端 Seedance 生产总览
```

已落地：

- 后端新增 `ai-comic-series-seedance-dashboard/v1` 类型和 `getAiComicSeriesSeedanceProductionDashboard`。
- API 新增 `seedance-production-dashboard`。
- dashboard 聚合提示词导出、镜头生产、缩略图、剪辑装配、字幕、混音、片头片尾、最终交付和外部剪辑包状态。
- 系列工作台新增 Seedance 生产总览面板，显示总镜头、ready、失败、已选剪辑版、缩略图、阻断项和下一步动作。
- 服务测试覆盖 dashboard 汇总、失败 blocker、下一步动作、分集摘要和 Markdown；API 测试覆盖缺失项目响应。

当前后期链路变成：

```text
ready 镜头
  -> 剪辑装配
  -> 缩略图
  -> 精修计划
  -> SRT 字幕文件
  -> 字幕烧录成片
  -> 音频计划
  -> 混音 dry-run / 音频账本
  -> 片头片尾计划 / render dry-run
  -> final delivery dry-run / 依赖账本
  -> 外部剪辑平台包
  -> 生产总览 dashboard
```

下一步最小可交付切片建议转向真实执行增强：

```text
seedance-title-cards/render real ffmpeg and visual template regression
  -> seedance-final/assemble real ffmpeg and precise title-card timeline
  -> seedance-audio/mix real media smoke and ducking refinement
```

原因：

- 当前已完成剪辑装配、缩略图、成片精修计划、字幕 worker、音频计划 / 混音 dry-run、混音真实 runner 输入/输出 hardening、分集混音时间归一、原声保留开关、片头片尾 dry-run、片头片尾 fake runner 输出校验、final delivery dry-run、final delivery fake runner 输出校验、final manifest、审片返修 ledger、审片驱动重试包/strict final guard、final reassemble 执行后自动解决、重试执行计划、本地重试提交、retry submit adapter、系列 provider 超时恢复、外部剪辑平台包和生产总览 dashboard。
- 现在可以继续把超时恢复接入真实 provider 轮询，并推进音频、片头片尾和最终装配真实执行。
- ffmpeg worker 模式已在缩略图、剪辑装配、字幕烧录和混音 dry-run 中跑通。

片头片尾 / final delivery dry-run 之后再做：

1. 片头片尾真实 ffmpeg / 视觉模板回归。
2. final delivery 真实 ffmpeg 专项和精确片头片尾时间线。
3. 混音真实 ffmpeg 媒体烟测和 ducking 细化。
4. 30 集以上大系列压测。

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
请继续 /Users/wuyu/Desktop/china-culture-kb 的 Story Agent 开发。先阅读 docs/story-agent-next-development-plan.md，再阅读 docs/story-agent-next-conversation-handoff.md 和其中列出的计划文档/技能。当前分支是 codex-ai-comic-series-longform。先执行 git status --short 和 git diff --stat，不要覆盖用户改动，尤其不要回滚 data/provinces/湖南.md。优先确认工作区状态，然后继续 P0：Seedance provider 平台 SDK/HTTP submit/query 实现、MCP 更深模型修复链路、故事管理 UX 降噪；AI 漫剧后期下一块做片头片尾真实 ffmpeg / 视觉模板回归、真实最终装配或真实 provider 轮询 smoke。默认界面保持简单，只保留高频主路径。
```

## 10. 下一步执行建议

如果只继续一个最小任务，建议做：

```text
Seedance provider 平台 SDK/HTTP submit/query 实现
```

理由：

- MCP 诊断、修复建议、受控版本写入、安全 auto_apply、真实项目回读和前端质量反馈首版都已经跑通。
- Provider 队列元数据、超时恢复、外部回传 schema、轮询入口、失败分类、通用 submit/poll adapter、platform payload / HMAC 签名、队列状态总览、人工重试策略和重试执行自动化首版已经落地，下一步要用真实平台凭证跑 submit/query/callback smoke，并补官方错误码映射。
- AI 漫剧字幕、音频、片头片尾 dry-run、final delivery dry-run、final manifest、审片返修 ledger、retry submit adapter、外部剪辑平台包和生产总览 dashboard 首版已经落地，下一步转入真实执行增强或真实 provider 轮询 smoke。
- 这会把“提示词包”继续推进到“可持续生产任务流”。

如果准备做下一组任务，建议顺序：

1. 收尾并提交当前改动。
2. StoryStudio / Projects 继续降噪。
3. Seedance provider 平台 SDK/HTTP submit/query 实现。
4. MCP 更深模型修复链路。
5. AI 漫剧片头片尾渲染增强、真实最终装配、混音真实媒体 smoke 或真实 provider 轮询 smoke。
