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
| Story Agent MVP | 指挥层约 99%；GEARS 真实验收约 95% | 生成、质量报告、项目版本、质量修复、前端查看已经跑通；MCP 修复链路新增 `kb_generate_story_repair_prompt`，可把 repair actions 变成模型可直接产出 `repaired_story_json` 的提示包；production readiness automation 已从“展示 runbook”推进到“一键运行安全 Story Agent API 步骤”，真实执行会写入最近 20 次自动化运行账本，跨项目 portfolio 已能批量触发安全 Story Agent 步骤并新增队列级运行审计；生成项目健康审计已能把 planned / interrupted / production_gap / ready 分清，`story-agent-mvp-status/v1` 已把生成物、质量、修复、交付合同和生产指挥压成统一状态出口。95% 只表示真实 GEARS v2 端到端 worker 验收层仍缺可达 endpoint 与真实大项目压测签收，不表示 Story Agent 内容/生产指挥层停滞。 |
| Production Board / Delivery Contract | 约 99% | 生产板、监督、修复、导出、素材库、Shot Ledger、回传、重试、provider/GEARS 兼容账本、失败分类、重试策略和导出合同已基本齐；readiness 现在同时暴露交付阶段、导出落盘、shot ledger 风险和可执行 API 步骤。 |
| GEARS Execution Integration | 约 99%（仅指 Story Agent 侧合同） | Story Agent 侧 config/contract、GEARS Job Ledger、submit/callback/status sync、失败分类、worker acceptance kit、证据包、generated health 前后体检、checksum/integrity 和 30 集压力 payload 已收口；99% 不代表全项目完成，最后 1% 被可达 GEARS v2 worker 的真实端到端执行验收和真实大项目 worker 提交压测阻断。 |
| MCP Story Agent 闭环 | 约 99% | 项目读取、蓝图、质量校验、GEARS/Seedance 只读交付、repair dry-run、修复提示包、受控版本写入、安全 auto_apply 首版已完成；`kb_generate_story_repair_prompt` 输出完整 JSON 修复提示、保护字段、目标场景和验证/写入工作流，`kb_get_story_agent_generated_health` 可本地只读扫描 generated health，`kb_get_story_agent_mvp_status` 可本地读取 MVP 总控 lane，`kb_get_production_readiness_portfolio` 可读取本地跨项目生产优先队列和 portfolio 运行账本，`kb_run_production_readiness_portfolio_automation` 可桥接 Web portfolio runner 批量触发安全自动化并回传队列级审计结果。 |
| AI 漫剧系列指挥层 | 约 99% | 系列规划、生产账本、回片、剪辑包、缩略图计划、精修计划、SRT/音频/片头片尾/final manifest 合同、审片返修 ledger、重试执行计划、外部剪辑平台包、生产总览 dashboard、GEARS 多 job type 提交入口已具备；系列 readiness 已进入 Web/API/UI/MCP 跨项目 portfolio，支持队列级安全自动化、系列级运行账本和 portfolio 运行审计。真实媒体执行迁出到 GEARS。 |
| 可商用制作中台 | 约 99% | 从“若干 dashboard”推进为单故事/系列/portfolio 三层 production readiness 中台：统一评分、lane、阻断、next actions、GEARS 风险、automation runbook、安全自动化入口、MCP bridge、运行审计账本、跨项目优先队列、批量安全 runner、队列级运行审计、模型修复提示包和生成项目健康审计；Web/API/UI 可把诊断变成可调度、可复盘步骤。仍缺真实 worker 产物验收、UX 降噪和真实大系列压力数据。 |

## 2. 本轮完成内容

### 2026-06-22 Production Readiness / 商业制作中台推进

- 新增单故事项目 `StoryProjectProductionReadinessReport` 与 AI 漫剧系列 `AiComicSeriesProductionReadinessReport` 共享合同，统一描述 `ready / needs_action / blocked`、lane score、issue、next action、GEARS summary 和 Markdown handoff。
- 新增后端聚合：`getProjectProductionReadiness()` 与 `getAiComicSeriesProductionReadiness()`，把 Story Agent 质量、Production Board 监督、交付包落盘、Shot Ledger、GEARS Job Ledger、审片返修和商业运营缺口合成一张生产指挥报告。
- 新增 API：`GET /api/projects/:projectId/production-readiness` 与 `GET /api/story-outline/ai-comic-series-projects/:seriesProjectId/production-readiness`，前端可直接刷新 readiness，而不需要重新推导 Production Board / GEARS 状态。
- 项目详情页新增 production readiness 面板；AI 漫剧系列工作台新增系列 readiness 面板，显示总分、lane 状态、阻断、下一步动作和分集 readiness。
- 新增 service 与 route 级测试覆盖单故事和系列 readiness。GEARS 真实实产仍不在本仓库扩展；readiness 只做生产指挥、验收和下一步动作调度。
- 新增并注册 MCP 工具 `kb_get_production_readiness`，支持 `project_id` / `series_project_id`，只读返回 MCP production readiness JSON/Markdown，并新增 `automation_plan`：把每个 next action 映射到 `mcp_tool` / Story Agent API / GEARS worker / operator review，附带 API path、payload hint、前置条件、阻断 issue、预期结果和安全说明，便于自动化 agent 直接调度。
- Web/API readiness 共享合同新增 `ProductionReadinessAutomationPlan`，单故事与 AI 漫剧系列 readiness API 都会返回自动化步骤；项目详情页和 AI 漫剧系列工作台同步显示 ready/blocked/manual 步骤、runner、API path 和 GEARS 外部执行边界。
- 新增安全自动化执行入口：`POST /api/projects/:projectId/production-readiness/run-automation` 与 `POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/production-readiness/run-automation`。runner 只执行 `can_auto_execute=true` 的 Story Agent API 步骤，自动跳过 GEARS worker 和人工审片步骤；前端两个工作台新增“运行安全自动化”按钮。
- 新增 MCP 工具 `kb_run_production_readiness_automation`，通过 `STORY_AGENT_BASE_URL` 或显式 `story_agent_base_url` 桥接到 Web/API runner；默认 dry-run，可限定 `action_keys` / `max_steps` / `stop_on_error`，Web 不可达时返回结构化 blocked 诊断和本地 readiness fallback，不在 MCP 内执行真实 GEARS、Seedance、ffmpeg 或最终媒体合成。
- 新增自动化运行审计账本：单故事项目与 AI 漫剧系列项目在真实执行 `run-automation` 后，会持久化 `production_readiness_automation_ledger`（最近 20 次、含分数变化、步骤、失败数和 notes）；readiness API、前端面板、Markdown handoff 与 MCP `kb_get_production_readiness` 均回显 `latest_automation_run`。dry-run 继续不写项目文件。
- 新增跨项目生产指挥总览：`GET /api/system/production-readiness-portfolio` 聚合全部单故事项目与 AI 漫剧系列 readiness，按阻断、分数、自动化步骤和 next action 生成 priority queue / action buckets；项目工作台顶部新增“生产指挥总览”。MCP 新增只读 `kb_get_production_readiness_portfolio`，可直接从本地 `web/generated` 扫描项目并输出同类优先队列。
- 新增 portfolio 批量安全自动化：`POST /api/system/production-readiness-portfolio/run-automation` 会按 priority queue 选择目标，逐个调用已有单故事/系列 `run-automation` runner；默认 dry-run，前端“运行队列安全自动化”按钮可执行前 5 个高优先目标。MCP 新增 `kb_run_production_readiness_portfolio_automation` bridge，仍只委托 Web/API 执行安全 Story Agent 步骤，不执行 GEARS worker、Seedance SDK、ffmpeg 或最终媒体合成。
- 新增 portfolio 运行审计账本：真实队列 run 会写入 `web/generated/system/production-readiness-portfolio-automation-ledger.json`，记录最近 20 次批量调度、目标执行/跳过/失败计数和 notes；`GET /api/system/production-readiness-portfolio`、项目工作台和 MCP 本地 portfolio 均会回显 latest portfolio run。dry-run 继续不落盘。
- 新增 MCP 模型修复提示包：`kb_generate_story_repair_prompt` 复用 `kb_repair_story(auto_apply=false)` 的质量快照、修复动作和目标场景，输出只读 prompt、保护字段、完整 JSON 输出合同和 `kb_validate_genre_story -> kb_repair_story(auto_apply=true) -> kb_get_project_context` 推荐工作流；工具不写项目文件。
- 新增生成项目健康审计：`GET /api/system/story-agent-generated-health` 只读扫描 `web/generated/projects`、`web/generated/ai-comic-series-projects`、`stories/**/*.json` 和版本快照，按 `ready / planned / production_gap / interrupted` 分类，并汇总缺当前故事、分镜、GEARS 段、质量报告、分集引用、系列交付与后期指令缺口；项目工作台新增“生成项目体检”卡片。该能力只做内容/生产指挥层诊断，不生成图片、视频、字幕或最终装配。
- 新增 MCP generated health bridge：`kb_get_story_agent_generated_health` 输出 `mcp-story-agent-generated-health/v1`，无需 Web dev server 即可本地扫描同类 generated health；单元测试覆盖 ready story、interrupted series 和 planned series。
- 新增 GEARS acceptance generated health bridge：acceptance report、worker acceptance script 和 evidence bundle 已消费同一份 generated health 报告；脚本会保存 smoke 前后 health JSON，生成 `story-agent-generated-health-audit.json/.md` 进入最终 verdict gate，证据包会导出 `story-agent-generated-health-report.md`，避免把 planned-only 或 interrupted 项目误当作真实 GEARS worker 合同问题。
- 2026-06-23 evidence bundle MVP status 追加：`GET /api/system/gears-execution-worker-evidence-bundle` 新增 `story-agent-mvp-status-report.md`，并在 bundle summary 输出 `story_agent_mvp_status` / `story_agent_mvp_score`；当前证据包 documents 从 6 份增至 7 份，签收材料可同时看到 GEARS 合同证据和 Story Agent MVP lane 状态。
- 2026-06-23 worker acceptance MVP audit 追加：`run-gears-worker-acceptance.sh` 会在 GEARS worker smoke 前后保存 `story-agent-mvp-status-before.json` / `story-agent-mvp-status-after.json`，生成 `story-agent-mvp-status-audit.json/.md`；最终 verdict 新增 `story_agent_mvp_status_audit` gate，signoff API 与 MCP signoff 工具输出 `mvp_status_audit_passed`、MVP before/after status 和 score delta。当前 worker acceptance kit 为 20 条 commands / 5 个 payloads，最终 verdict 为 8 个 gate，archive 必交附件为 26 个。
- 2026-06-23 post-archive signoff snapshot 追加：`run-gears-worker-acceptance.sh` 在 archive / checksum / integrity 之后自动读取 `GET /api/system/gears-execution-worker-evidence-signoff?evidence_dir=...`，把 `gears-worker-evidence-signoff.json` 与 `gears-worker-evidence-signoff.md` 写入 evidence 目录；正常完成和缺 env / submit failure / 非 2xx / 严格审计失败出口都会落盘签收快照。
- 已用本地 fake GEARS worker 跑 v13 health smoke：导出脚本保存 generated health before/after，evidence bundle documents=6，大项目压力 120/120 source echo，worker audit 无缺 id/source/artifact；本次关闭 Story Agent ledger seed，因此 callback gate 预期报告 `ledger_match_missing_count=4`，不作为真实 GEARS v2 签收。
- 已用本地 fake GEARS worker 跑 v14 health gate smoke：acceptance kit 增至 18 条 commands，verdict 增至 7 个 gate；新增 health gate `status=passed` 且 before/after delta 全 0，archive 必交附件增至 22 个。未启用 ledger seed 时仍预期停在 callback ledger matching gate。
- 新增 GEARS worker evidence signoff API：`GET /api/system/gears-execution-worker-evidence-signoff?evidence_dir=...`，只读汇总真实 worker smoke 证据目录里的 verdict、archive、integrity、worker/callback audit、generated health audit、MVP status audit 和 30 集压力 audit，输出 `gears-execution-worker-evidence-signoff/v1` 与 Markdown。它把 evidence 目录变成可自动判定的签收视图，不在当前仓库执行图片、视频或后期实产。
- 新增 GEARS worker evidence signoff v16/v17 加固：worker acceptance 脚本在缺 env、GEARS submit transport failure、submit 非 2xx 三类早退路径也会生成 callback audit、large project pressure audit、generated health after/audit、verdict、archive 和 integrity；signoff API 直接暴露 worker transport/http error、failure category counts、callback transport/http error、大项目 response/accepted/rejected/failed/duplicate/unexpected source 统计，并对 recommended actions 去重。新增 MCP 只读工具 `kb_get_gears_worker_evidence_signoff`，可本地读取 evidence 目录并输出 `mcp-gears-worker-evidence-signoff/v1`，无需 Web dev server，不执行 GEARS worker 或媒体实产。
- 2026-06-23 前端追加：单故事项目详情页和 AI 漫剧系列工作台已新增 GEARS worker evidence signoff 读取/导出入口。操作员可把真实 `run-gears-worker-acceptance.sh` 生成的 evidence 目录填入页面，直接看到 signoff status、gate 统计、缺附件、worker/callback transport-http error、大项目 pressure source echo 与 recommended action 数，并导出 signoff Markdown / JSON。下一步仍是配置真实 `GEARS_API_BASE_URL` 跑 acceptance，再按真实 worker 响应补齐合同兼容、失败类型和大项目压测判断。
- 2026-06-23 latest evidence 追加：Web signoff API 与 MCP signoff 工具支持自动发现最近的 `gears-worker-evidence*` 目录，并通过 `evidence_dir_source` 标记来源为 `input`、`env`、`latest` 或 `missing`。默认扫描 `/private/tmp`、`/tmp`、`TMPDIR` 和 repo root，可用 `GEARS_EVIDENCE_AUTO_DISCOVER=0` 关闭，或用 `GEARS_EVIDENCE_AUTO_DISCOVER_ROOTS` 限定扫描根；这让真实 acceptance 脚本跑完后可直接读取最近证据。
- 2026-06-23 acceptance kit 签收闭环追加：worker acceptance kit 增加 `read_worker_evidence_signoff` 命令，导出的 `run-gears-worker-acceptance.sh` 会在正常完成和各类早退/严格审计失败前打印可复制的 signoff API URL、latest URL 和 MCP signoff 工具调用提示；evidence bundle 的 checklist/next actions 同步要求导出 signoff Markdown / JSON。
- 2026-06-23 Story Agent MVP status 追加：新增 `GET /api/system/story-agent-mvp-status` 与共享类型 `story-agent-mvp-status/v1`，只读聚合 generated health 和 production readiness portfolio，输出五条 MVP lane（生成物、故事质量、修复闭环、GEARS 交付合同、生产指挥）、priority targets、next actions 和 Markdown；前端 API client 已接入 `getStoryAgentMvpStatus()`。该接口只做内容/生产指挥层状态判断，不执行 GEARS worker、Seedance SDK、ffmpeg 或最终媒体合成。
- 2026-06-23 MCP MVP status 追加：新增 `kb_get_story_agent_mvp_status`，无需 Web dev server 即可本地组合 `kb_get_story_agent_generated_health` 与 `kb_get_production_readiness_portfolio` 同类数据，输出 `mcp-story-agent-mvp-status/v1`、五条 lane、priority targets、next actions 和可选 Markdown。
- 2026-06-23 项目工作台 MVP 总控追加：`Projects.vue` 已在生产指挥总览和生成项目体检之前接入 Story Agent MVP 状态卡，显示总分、generated/readiness 比例、五条 lane、优先目标、下一步，并支持刷新与 Markdown/JSON 导出。
- 2026-06-23 MVP 进度口径拆分追加：`story-agent-mvp-status/v1` 与 MCP `mcp-story-agent-mvp-status/v1` 新增 `progress[]`，把 `content_command_layer=99%` 与 `gears_end_to_end_acceptance=95%` 分开输出；项目工作台同步展示“内容/生产指挥层”和“GEARS 真实验收”两块，明确剩余 5% 是可达 GEARS v2 endpoint、真实 submit/status/callback smoke 和大项目 worker pressure signoff。
- 2026-06-23 worker acceptance endpoint readiness 追加：`gears-execution-worker-acceptance-kit/v1` 新增 `real_endpoint_readiness`，汇总真实 GEARS v2 acceptance 所需 env、smoke target 是否齐备、推荐运行命令和 next actions；单故事页与 AI 漫剧系列工作台同步显示 `real endpoint needs_env/needs_smoke_target/ready`，避免未配置 endpoint 时误跑或误签收。
- 2026-06-23 generated health 系列治理追加：`story-agent-generated-health/v1` summary 新增 `series_ready_count`、`series_planned_only_count`、`series_production_gap_count`、`series_interrupted_count`、`series_governance_attention_count`、`series_missing_story_ref_project_count`、`series_contract_evidence_count` 和 `series_relink_candidate_count`，Markdown/notes 会显式输出 `series_governance_attention` 与 `series_relink_candidates`。当前真实扫描显示 926 个 AI 漫剧系列都缺 generated episode story refs，其中 99 个已有生产/后期合同证据，优先应 restore missing story JSON 或更新 refs；其余历史样本应归档 fixture 或补齐 Story Agent 合同，不把样本噪声误判成 GEARS endpoint 失败。
- 2026-06-23 generated governance plan 追加：新增 `GET /api/system/story-agent-generated-governance-plan` 与 MCP `kb_get_story_agent_generated_governance_plan`，只读把 generated 噪声分桶为 `restore_or_relink_series_story_refs`、`archive_or_rebuild_series_fixtures`、`generate_first_series_episode`、`repair_series_command_contracts`、`repair_story_project_refs` 和 `promote_ready_targets_for_gears_signoff`。项目工作台新增“Generated 治理计划”卡片，可导出 Markdown/JSON；当前真实扫描计划为 99 个 relink、827 个 archive/rebuild、4 个单故事 ref 修复、1 个 GEARS signoff ready 候选。该计划不批量修改 generated 文件。
- 2026-06-23 generated governance dry-run 追加：新增 `POST /api/system/story-agent-generated-governance-plan/run` 与 MCP `kb_run_story_agent_generated_governance`，输出 `story-agent-generated-governance-run/v1` / `mcp-story-agent-generated-governance-run/v1` manifest，列出 action、目标、预期文件变化和 operator review 要求。当前版本只生成 dry-run 清单；即使传 `dry_run=false` 也会返回 `status=blocked`，不移动、不删除、不改写 generated 文件。项目工作台“Generated 治理计划”卡片新增“生成 dry-run 清单”和清单导出。
- 2026-06-23 周敦颐单故事自然交付修复追加：`20260621-story-5xhl--character_story` 已通过 `kb_update_project_version` 同类受控版本写入机制推进到 v10（《周敦颐橘洲问莲》），`quality_passed=true`、`genre_score=100`、`quality_issue_count=0`、大纲覆盖 100、pattern score 100、GEARS readiness 100、`audience_text_report.clean=true`、GEARS delivery 15 units 且无 validation notes。v10 保留用户大纲“道州赴汴京、途经长沙橘子洲、垂钓老者、莲之品格”，但把观众字段中的“主角目标/目标明确/选择有代价/因果链/行动具体/人物不是年表/史实边界”等规则词改成书袋文字、官场压力、误船湿书、泥痕和片尾创作边界说明。
- 2026-06-23 质量门与 GEARS 交付回归追加：修正 `gears-delivery-service` 中“长沙”导致周敦颐故事误判为清末民初服装的推断顺序，北宋/周敦颐语境优先输出北宋士人服饰；修正 `narrative-pattern-library` 单项紧凑信号的 `minHits` 计算，并让 `genre-quality-service` / `quality-workflow-service` 用自然叙事证据识别人物所求、阻力、两难、行动后果、因果推进、人物变化和创作边界，避免为了过质量门把检测词写进观众稿。新增 `audience_text_report` 与 `repair-audience-text`，把观众字段检测词污染变成可见、可点选修复的质量报告项；生成提示包同步禁止把质量信号原样写进观众稿。定向/API 测试当前新增覆盖该 gate。

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
- GEARS worker 失败类型已扩展到真实执行节点：`render_failed`、`artifact_upload_failed`、`callback_delivery_failed`、`output_missing`、`artifact_invalid`、`worker_unavailable` 可从 status / errorCode / failureReason 归一化写入 GEARS Job Ledger。
- GEARS generated project pressure audit 已落地：`GET /api/system/gears-execution-generated-project-pressure` 扫描单故事与 AI 漫剧系列 generated project 的 `gears_job_ledger`，汇总 job、回调事件、artifact、失败分类和风险等级，并生成 Markdown。
- 单故事项目页与 AI 漫剧系列工作台已显示 generated pressure 状态，并支持导出 generated project pressure Markdown。
- GEARS worker acceptance report 已落地：`GET /api/system/gears-execution-acceptance-report` 聚合 readiness、本地 smoke、live E2E 阻断项、pressure、generated pressure 和 handoff artifacts；单故事项目页与 AI 漫剧系列工作台已显示 acceptance 状态，并支持导出 worker acceptance Markdown。
- GEARS worker acceptance kit 已落地：`GET /api/system/gears-execution-worker-acceptance-kit` 生成 env template、smoke payload 文件、submit/status/callback/live-smoke curl 命令、断言清单和 Markdown runbook；单故事项目页与 AI 漫剧系列工作台已显示 worker kit 命令数，并支持导出 Markdown / JSON。
- GEARS worker acceptance shell script 已落地：worker kit 同时生成 `run-gears-worker-acceptance.sh`，脚本会写 payload、抓取 acceptance/evidence 预检、调用 GEARS submit/status、回打单故事/系列 callback、运行 live smoke，并把响应落到 evidence 目录；前端可直接导出 `.sh`。
- GEARS worker acceptance shell script 已改为“完整证据落盘、stdout 简报”：acceptance/evidence/generated pressure JSON 保存到 evidence 目录，终端只打印 ok/status/commands/payloads/documents 等摘要，避免真实联调日志被大 JSON 淹没。
- GEARS worker acceptance shell script 已补批量 submit job id 自动提取：默认从 `gears_job_id`、`jobId`、`taskId`、`data.task`、`acceptedUnits[]`、`jobs[]`、`tasks[]` 等真实 worker 响应形态中提取全部 job id 并写入 `gears-smoke-job-ids.txt`，随后逐个轮询 status。
- GEARS worker acceptance shell script 已补可配置多轮 status poll：`GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS` 默认 `1`，`GEARS_ACCEPTANCE_STATUS_POLL_INTERVAL_SECONDS` 默认 `5`；多轮时保存每次 `gears-status-response-<job>-attempt-<n>.json`，并保留最新 `gears-status-response-<job>.json` 供 audit 兼容。
- GEARS worker acceptance shell script 已补 replay/post-audit 证据：默认重放单故事与系列 callback，保存 replay response；跑后拉取 evidence bundle 和 generated pressure，并写入 manifest，方便证明 `duplicate_count` 和跑后 ledger 风险。
- GEARS worker acceptance shell script 已补 Story Agent callback response audit：生成 `story-agent-callback-response-audit.json` 与 `story-agent-callback-response-audit.md`，统计 callback/live-smoke 响应里的 `ok=false`、validation/auth/not-found/live-smoke blocked 错误、received/updated/failed/duplicate 计数和推荐修复动作。
- GEARS worker acceptance shell script 已补 Story Agent callback id preflight：生成 `story-agent-callback-id-preflight.json` 与 `.md`，提前检查 `GEARS_SMOKE_PROJECT_ID` / `GEARS_SMOKE_SERIES_PROJECT_ID` 是否符合 Story Agent 路由格式，避免占位 id 造成的 callback validation error 被误归因到 GEARS worker。
- GEARS worker acceptance shell script 已补 worker response audit：生成 `gears-worker-response-audit.json` 与 `gears-worker-response-audit.md`，记录真实 worker 响应中的 accepted/rejected/failed 计数、状态别名、job/source/idempotency 字段、artifact URL 字段、ready 缺 artifact、error code、failure category、合同缺口和 `recommended_actions`，供后续补失败类型、artifact 回写兼容和响应兼容层。
- `recommended_actions` 已带 `sample_paths`，audit totals 已带 `sample_record_paths`，可定位缺 worker id、缺 source/idempotency、缺失败上下文、ready 无 artifact 和未知状态的代表性 JSON path。
- GEARS worker acceptance shell script 已补 transport / HTTP sidecar 证据：submit、status poll 和可选大项目 pressure submit 会保存 `*-http-status.txt` 与 `*-curl-exit-code.txt`；worker response audit 汇总 `transport_error_count` / `http_error_count`，并把非 2xx 与 curl 失败拆成独立 recommended actions。
- Story Agent callback/live-smoke 也已补 transport / HTTP sidecar 证据：project callback、series callback、callback replay 和 live smoke 会保存 `*-http-status.txt` 与 `*-curl-exit-code.txt`；`story-agent-callback-response-audit` 汇总 `transport_error_count` / `http_error_count` / `not_found_count` / `blocked_count` / `ledger_match_missing_count`，可区分 route/auth/project missing、live smoke env blocked、项目存在但 GEARS Job Ledger 未匹配与 callback payload 合同问题。
- worker response audit 已用 error_code / failure_category 参与 failed/rejected 判定：例如 `SERVICE_UNAVAILABLE` 会进入 failed，而不是 unknown，方便真实 worker 失败类型对齐。
- worker response audit 已覆盖 `no_worker_response_files` 与 `record_count_zero` 两类前置失败：缺 env 时提示先跑 worker smoke，不可达 endpoint 留下空响应文件时提示补真实 submit/status 结果或 transport failure body。
- acceptance shell stdout 已补 audit 摘要：callback id preflight、worker response audit 和 Story Agent callback response audit 都会打印 totals / recommended actions 一行摘要，方便真实联调日志快速定位失败类型。
- GEARS worker acceptance shell script 已补真实执行细节：提交前按 env 渲染 smoke payload，提取 job id 后回填 callback payload；`GEARS_API_TOKEN` 可选；submit 失败会写 `gears-submit-exit-code.txt`、`gears-submit-failed.txt` 和 manifest。
- GEARS worker acceptance shell script 已补缺 env evidence：脚本会先写 payload、拉取 acceptance/evidence，再检查 `GEARS_API_BASE_URL`、`GEARS_CALLBACK_SECRET`、`GEARS_CALLBACK_BASE_URL` 和 smoke project ids；缺项会写 `gears-required-env-missing.txt` / `gears-required-env-blocked.txt` 后退出。
- GEARS worker acceptance kit 已补 smoke target 自动发现：导出包新增 `smoke_targets`，脚本会写 `story-agent-smoke-targets.json` / `story-agent-smoke-env-selected.json`；当 `GEARS_SMOKE_PROJECT_ID`、`GEARS_SMOKE_STORY_ID`、`GEARS_SMOKE_SERIES_PROJECT_ID` 留空或仍是占位符时，会从 `web/generated` 自动选择现有单故事项目和 AI 漫剧系列项目，减少 callback smoke 的 404 误判。
- Story Agent callback response audit 已补 `ledger_match_missing_count`：当 callback 成功到达真实项目但 `source_unit_id` / `gears_job_id` 不在项目 GEARS Job Ledger 中时，会给出“先走 Story Agent submit 建账本，或对齐回调 source/job id”的 P0 动作，避免误判为路由或鉴权问题。
- GEARS worker acceptance script 已补可选 Story Agent ledger seed：设置 `GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER=1` 后，会调用单故事和系列 GEARS submit API 写入真实 GEARS Job Ledger，并把 callback payload 改写为 submit 返回的 `source_unit_id` / `gears_job_id` / `job_type`，用于验证 callback 真正回写项目账本。
- GEARS submit response 兼容已补顶层 `status` + `data.acceptedUnits[].externalId`：真实 worker 使用平台式 `taskId` / `externalId` / `idempotencyKey` 返回时，Story Agent submit adapter 可正确建 GEARS Job Ledger，不再把 envelope status 当作缺 `source_unit_id` 的 job。
- GEARS worker acceptance kit 已补大项目压测 payload：默认生成 30 集 × 每集 4 镜的 `gears-large-project-submit-pressure.json` 和 `gears-large-project-pressure-summary.json`，并按 200 units 上限封顶；提交由 `GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE=1` 显式开启。
- GEARS worker evidence bundle 已落地：`GET /api/system/gears-execution-worker-evidence-bundle` 一键聚合 acceptance report、worker kit、smoke handoff、pressure report、generated pressure report、generated health report 和 Story Agent MVP status report；单故事项目页与 AI 漫剧系列工作台已显示 evidence 文档数，并支持导出 Markdown / JSON。
- GEARS callback 幂等已接入 submit idempotency key：worker 可回传 `idempotencyKey` / `idempotency_key` 作为 callback event id，重复回调会进入 `duplicate_count`，不重复追加 `callback_events` 或生成镜头版本。
- GEARS Job Ledger 已持久化 submit idempotency key，并支持 worker 仅凭 `idempotencyKey` / `idempotency_key` 回调匹配单故事与 AI 漫剧系列 job；旧 ledger normalize 时会按 `job_type:source_unit_id` 补齐默认幂等键。
- GEARS idempotency-key 生命周期回调审计已加固：`idempotencyKey` 作为 job 匹配 / 幂等锚点时，不会吞掉状态、进度或消息变化；只有相同状态、进度和消息的重复 payload 才计入 `duplicate_count`，`callback_events` 会标注 `event_id_source`。
- GEARS 大项目账本边界已显性化：单个 job 只保留最新 20 条 `callback_events`，批量 callback envelope 单次最多接收 200 条 item，超过时在路由/服务层返回校验错误，避免大系列误投导致账本和写回循环失控。
- GEARS 大项目边界已进入配置与前端可观测面：`GET /api/system/gears-execution-config` 返回 callback 批量上限和事件保留上限，单故事项目页与 AI 漫剧系列工作台会直接显示这些 GEARS 边界。
- GEARS poll/status 合同已与 callback 合同对齐：`GET /api/system/gears-execution-contract` 在 `poll.accepted_status_fields` 和 `callback.accepted_status_fields` 中公开同一套平台状态别名，便于 GEARS v2 同步实现 status 查询和 webhook 回调。
- GEARS 系列重试 payload 已补生产上下文：`seedance_video` retry unit 会带 `retry_count`、`retry_reason`、旧 provider job、旧视频 URL、失败原因、审片意见、执行计划时间戳和 request payload，便于 GEARS v2 worker 区分首次生成、失败重试和审片返修。
- GEARS submit response 兼容已补深层 worker envelope：支持 `response.payload.result.tasks[]` / `rejectedJobs[]`，并把 `PROMPT_TOO_LONG`、`schema_invalid` 等 payload 类错误优先归入 `payload_invalid`。
- GEARS 系列 submit 响应已补 `job_type`、`job_type_label`、`submit_intent` 和更完整 Markdown 对账摘要；GEARS execution contract 示例已切换到系列 `seedance_video` 返修/重试 payload，系列工作台按钮文案也改为“GEARS 视频返修/重试”，旧 Seedance 重试入口标为兼容路径。
- 已执行导出的 `run-gears-worker-acceptance.sh` 前置 smoke：Story Agent 预检和 evidence bundle 拉取通过；本机没有 GEARS v2 worker endpoint，submit 阶段以 curl 7 失败并保存证据。新版脚本已验证缺 env evidence 与 30 集级压力 payload 生成。真实端到端仍需配置可达 `GEARS_API_BASE_URL`、`GEARS_CALLBACK_BASE_URL` 和 `GEARS_CALLBACK_SECRET`。
- 已用本地 fake GEARS worker 验证多轮 status poll：submit 返回 `fake-gears-job-1`，第 1 次 status 为 `PROCESSING`、第 2 次为 `COMPLETED`；脚本写出 attempt 文件和 latest 文件，audit 扫描 attempt 文件、跳过 latest 副本，`ready_without_artifact=0/1` 且识别 artifact URL。
- 已用本地 fake GEARS worker 验证 Story Agent callback response audit：占位 project/series id 会导致单故事与系列 callback 返回 `ok=false` / `VALIDATION_ERROR`，audit 统计 `ok_false_count=2`、`validation_error_count=2`，并给出 `validation_error_count` 推荐动作，提示换成真实 Story Agent project id。
- 已用导出的 `run-gears-worker-acceptance.sh` 验证缺 env 路径的新 id preflight：`/private/tmp/gears-worker-evidence-id-preflight` 写出 `story-agent-callback-id-preflight.json/.md`，`warning_count=2`，stdout 打印 `recommended_actions=1`；worker audit 同步输出 `no_worker_response_files` 推荐动作。
- 已用本地 fake GEARS worker 验证 HTTP 503 submit 证据：脚本写出 `gears-submit-response-http-status.txt=503` 与 `gears-submit-response-curl-exit-code.txt=0`，worker audit 统计 `http_error_count=1`、`failed_count=2`、`unknown_count=0`，并给出 `http_error_count` recommended action。
- 已用本地 fake GEARS worker 验证 Story Agent callback HTTP sidecar：worker submit/status 均 200，但使用不存在的合法格式 project/series id 回调，脚本完整退出 0，callback audit 统计 `http_error_count=4`、`not_found_count=4`、`blocked_count=1`、`ok_false_count=4`，sample transport files 指向四个 404 response，并把修复动作归到 smoke env 项目 ID / live smoke server env。
- 已用本地 fake GEARS worker 验证 smoke target 自动补齐：空 smoke env 会自动选择 `20260621-story-5xhl--character_story` / `20260621-story-5xhl` / `20260619-series-r0v5zyag`，证据在 `/private/tmp/gears-worker-evidence-auto-target-v3`；`not_found_count=0`、`blocked_count=0`、`http_error_count=0`、`transport_error_count=0`，剩余 `ledger_match_missing_count=4`，下一次应启用 `GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER=1` 验证账本写回归零。
- 已用本地 fake GEARS worker 验证 ledger seed 局部闭环：`/private/tmp/gears-worker-evidence-ledger-seed-v3` 中单故事项目 seed 选择 `shot-1` / `fake-gears-job-seed-10` 并成功回写 ready；callback audit `updated_count=2`、`duplicate_count=1`、`ledger_match_missing_count=2`，剩余阻断来自示例系列没有可提交的 `seedance_video` retry job。
- 已修正 worker acceptance smoke target 选择：series candidate 会统计真实存在的 episode story、`seedance_video` retry candidate 和后期可 seed job；当视频 retry 不可提交时自动降级到可提交的 GEARS 后期 job。本轮自动推荐 `GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE=title_card_render`。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 复测 ledger seed 完整闭环：证据目录 `/private/tmp/gears-worker-evidence-ledger-seed-v5`；自动选择 `20260619-series-3f89ec1y`，单故事与系列 seed selected 均 `patched=true`，series 使用 `title_card:card-series-opening` / `fake-gears-job-11`；callback audit 达到 `updated_count=4`、`duplicate_count=2`、`failed_count=0`、`ledger_match_missing_count=0`、`recommended_actions=[]`。真实 GEARS v2 endpoint 仍未配置，真实端到端和真实大项目提交压测继续等待可达 endpoint。
- 已修正 worker response audit 的记录识别误报：顶层 submit/status envelope 仅有 `status` 时不再当作 worker record，`outputs[].url` 等 artifact 子项也不再被误判为缺 job/source id 的记录；只有明确 job/unit/task/result 路径或对象自身含 job/source/artifact/status 信号时才计入审计。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v7 fake GEARS smoke：证据目录 `/private/tmp/gears-worker-evidence-ledger-seed-v7`；worker audit 达到 `record_count=10`、`unknown_count=0`、`missing_worker_id_count=0`、`missing_source_id_count=0`、`missing_ready_artifact_count=0`、`recommended_actions=[]`；Story Agent callback audit 达到 `updated_count=4`、`failed_count=0`、`duplicate_count=3`、`ledger_match_missing_count=0`、`recommended_actions=[]`。真实 GEARS v2 endpoint 仍未配置，真实端到端和真实大项目提交压测继续等待可达 endpoint。
- 已补大项目压力响应专用审计：acceptance shell 现在生成 `gears-large-project-response-audit.json/.md`，对大项目压力 payload 与 worker submit 响应逐 source 对账，统计请求 units、响应记录、source echo、缺失/重复/意外 source、HTTP/curl 状态和推荐修复动作。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v8 大项目压力 smoke：证据目录 `/private/tmp/gears-worker-evidence-ledger-seed-v8-pressure`；30 集 × 4 镜共 120 units 全量 accepted，large-project response audit 达到 `request_unit_count=120`、`response_record_count=120`、`accepted_count=120`、`source_echo_count=120`、`missing_requested_source_count=0`、`duplicate_source_id_count=0`、`unexpected_source_count=0`、`recommended_actions=[]`；worker audit 和 Story Agent callback audit 的 `recommended_actions` 也均为空。真实 GEARS v2 endpoint 仍未配置，下一步只需替换 endpoint 即可复用同一证据链。
- 已补最终 GEARS worker acceptance verdict：`run-gears-worker-acceptance.sh` 现在输出 `gears-worker-acceptance-verdict.json/.md`，综合 required env、callback id preflight、worker response audit、Story Agent callback audit、大项目 pressure audit 和 manifest，给出 `acceptance_passed`、`failed_gate_ids` 与聚合 `recommended_actions`；默认 `GEARS_ACCEPTANCE_STRICT_AUDIT=1`，失败 verdict 会让脚本非零退出。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v9 verdict smoke：证据目录 `/private/tmp/gears-worker-evidence-verdict-v9`；最终 verdict 为 `status=passed`、`acceptance_passed=true`、6 个 gate 全过、`recommended_actions=0`；大项目 pressure 仍是 120/120 accepted/source echo，worker audit `record_count=370`，Story Agent callback audit `ledger_match_missing_count=0`。
- 已补最终 GEARS worker acceptance archive：`run-gears-worker-acceptance.sh` 会输出 `gears-worker-acceptance-archive.json/.md`，记录必交证据文件、缺失附件、byte length 和 `sha256`；严格模式除 `acceptance_passed=true` 外，还要求 archive `signoff_ready=true`。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v10 archive smoke：证据目录 `/private/tmp/gears-worker-evidence-archive-v10`；worker kit 为 16 条 commands / 5 个 payloads；archive `status=signoff_ready`、`signoff_ready=true`、18 个必交附件全齐、证据文件 66 个、`recommended_actions=0`；verdict `acceptance_passed=true`，大项目 pressure 120/120 source echo，worker/callback audit 均无阻断。
- 已补最终 GEARS worker acceptance checksum manifest：archive 生成时同步输出 `gears-worker-acceptance-checksums.json/.md`，记录每个证据文件的 `sha256`、byte length、role 和 required 标记，并在生成前清理旧 archive/checksum 产物，避免重跑污染证据清单。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v11 checksum smoke：证据目录 `/private/tmp/gears-worker-evidence-checksums-v11`；checksum manifest `schema_version=gears-worker-acceptance-checksum-manifest/v1`、`algorithm=sha256`、`file_count=66`、`required_file_count=18`、`record_count=66`；archive `signoff_ready=true`、`required_checksum_count=18`，verdict/pressure/worker/callback audit 均无阻断。
- 已补最终 GEARS worker acceptance integrity 复核：脚本会输出 `gears-worker-acceptance-integrity.json/.md`，重新计算 checksum manifest 中每个证据文件的 `sha256` 与 byte length，并检查必交附件是否都有 checksum record；严格模式除 `acceptance_passed=true`、`signoff_ready=true` 外，还要求 `integrity_passed=true`。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v12 integrity smoke：证据目录 `/private/tmp/gears-worker-evidence-integrity-v12`；worker kit 为 17 条 commands / 5 个 payloads；integrity `status=passed`、`integrity_passed=true`、`required_checksum_records=18/18`、`mismatch_count=0`、`missing_file_count=0`、`sha256_mismatch_count=0`；verdict、archive、checksum、pressure、worker/callback audit 均无阻断。
- 验证已通过：server lint/build、client lint/build、`project-service.test.ts`、`outline-service.test.ts`、`gears-execution-service.test.ts`、`api.test.ts`。

### MCP / Agent 工具

- 新增并注册 `kb_generate_gears_delivery`：从 `project_id`、`story_id`、`story_json` 只读生成 GEARS 交付包。
- 新增并注册 `kb_generate_seedance_prompt`：生成 Seedance 2.0 镜头提示词包，支持 `@图片/@视频/@音频` 参考。
- 新增并注册 `kb_get_production_readiness`：读取单故事项目或 AI 漫剧系列项目的生产 readiness 指挥报告，汇总质量、交付、GEARS 账本、审片返修、下一步动作和可执行 `automation_plan`。
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
GEARS v2 worker acceptance shell script real endpoint smoke
  -> export env / payload / curl runbook
  -> submit seedance_video job
  -> poll status / receive callback
  -> verify Shot Ledger / series production ledger
  -> generate 30-episode pressure payload and submit only after basic smoke passes
  -> extend payload mapping for non-video job types
```

### P0：MCP 更深模型修复链路

首轮已完成：

- `kb_generate_story_repair_prompt` 可根据 `project_id`、`story_id` 或 `story_json` 生成模型修复提示包。
- 提示包包含 repair actions、目标场景、保护字段、完整 StoryGenerateResult JSON 输出合同、可选原始故事 JSON 和后续校验/写入工作流。
- 生成后仍必须先用 `kb_validate_genre_story` 校验，再调用 `kb_repair_story(auto_apply=true)` 安全写入，保持“模型生成内容”和“工具写入版本”分离。

下一步：

- 在 Web 前端质量面板暴露“生成修复提示包 / 复制给模型 / 校验修复 JSON”的轻量入口。
- 结合真实项目批量选取 P0/P1 repair actions，做多版本修复质量对比。

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
