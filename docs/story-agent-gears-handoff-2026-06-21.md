# Story Agent / GEARS 下一对话交接

> 日期：2026-06-21  
> 仓库：`/Users/wuyu/Desktop/china-culture-kb`  
> 分支：`codex-ai-comic-series-longform`  
> 最新提交：`8d8afd65 feat: add GEARS execution integration`，已推送到 `origin/codex-ai-comic-series-longform`  
> 当前定位：`china-culture-kb` 只做内容与生产指挥层；图片、视频、字幕、混音、片头片尾和最终装配实产交给 GEARS v2。

## 新对话先做

进入新对话后先执行：

```bash
cd /Users/wuyu/Desktop/china-culture-kb
git status --short --branch
git diff --stat
```

优先阅读：

- `docs/gears-execution-integration-plan.md`
- `docs/story-agent-next-development-plan.md`
- `docs/story-agent-next-conversation-handoff.md`
- `.codex/skills/china-culture-story-agent/SKILL.md`
- `.codex/skills/gears-seedance-delivery/SKILL.md`

继续开发时使用项目技能：

- `china-culture-story-agent`：StoryBlueprint、类型片质量、修复、项目版本。
- `gears-seedance-delivery`：GEARS 字段分离、Seedance prompt、prompt 清洗、交付 readiness。
- `agent-dev-standards`：小步实现、测试优先、文档与代码同步。

## 关键边界

- 不再在 `china-culture-kb` 里扩展真实 Seedance SDK、真实图片生成、真实字幕烧录、真实混音、真实片头片尾渲染、真实 final assemble、媒体存储/CDN/转码。
- 当前仓库保留：计划包、dry-run/manifest、GEARS Job Ledger、Shot Ledger、Review Ledger、Dashboard、GEARS submit、GEARS callback/status sync。
- 真实图片、视频和后期产物由 `Wy490/gears-v2` 执行，`china-culture-kb` 只负责提交合同、接收结果和生产状态指挥。
- 不要把生成故事或修复内容写入 `data/provinces/*.md`。

## 本轮已完成

### GEARS Execution P0

- 新增统一 `web/server/src/services/gears-execution-service.ts`。
- 新增 GEARS 配置/合同接口：
  - `GET /api/system/gears-execution-config`
  - `GET /api/system/gears-execution-contract`
- 新增统一 GEARS Job Ledger 类型、schema 与持久化写回。
- 单故事项目支持：
  - 提交 GEARS job。
  - 导入 GEARS callback。
  - 轮询 GEARS job status。
  - 写回 `gears_job_ledger` 和 `seedance_shot_ledger`。
- AI 漫剧系列支持：
  - 提交 `seedance_video`、`storyboard_image`、`character_image`、`scene_image`、`subtitle_render`、`audio_mix`、`title_card_render`、`final_assemble`。
  - 导入单条/批量/嵌套 GEARS callback。
  - 同步全部活跃 GEARS job 状态。
  - 写回 Seedance 生产账本、字幕、混音、片头片尾和最终交付专项账本。
- GEARS callback/status sync 已支持：
  - 平台字段别名：`jobId/taskId/status/taskStatus/videoUrl/outputUrl` 等。
  - 嵌套 envelope：`data.task.output.files[]`、`data.job.outputs[]`、`result`、`payload` 等。
  - 批量 envelope：`callbacks[]`、`events[]`、`data.tasks[]`。
  - 失败项 `failures[].path` 定位。
  - callback 鉴权：`Authorization: Bearer <GEARS_CALLBACK_SECRET>` 或 `X-GEARS-Callback-Secret`。
  - progress 归一化。
  - poll 失败诊断写回。
  - 乱序 callback 终态保护。
  - 平台时间戳、终态冲突、`canceled` 失败上下文。
  - artifact URL 别名归一化：manifest、subtitle、audio、image、thumbnail、poster 等。
  - source id 别名：`externalId`、`customId`、`productionId`。
  - submit/callback idempotency key 贯通，支持仅凭 `idempotencyKey` 匹配 job。
  - 真实 worker 失败节点分类：`render_failed`、`artifact_upload_failed`、`callback_delivery_failed`、`output_missing`、`artifact_invalid`、`worker_unavailable`。
- 系列 `seedance_video` retry payload 已带生产上下文：
  - `retry_count`
  - `retry_reason`
  - 旧 provider job
  - 旧视频 URL
  - 失败原因
  - 审片意见
  - retry execution plan 时间戳
  - request payload
- 系列 GEARS submit 响应新增：
  - `job_type`
  - `job_type_label`
  - `submit_intent`
  - Markdown adapter 统计、submitted jobs 和 failures 对账摘要。

### 前端主路径

- `ProjectDetail.vue` 接入单故事 GEARS 提交、GEARS API 提交、状态同步、callback 导入。
- `AiComicSeriesStudio.vue` 接入系列 GEARS 多 job type 提交、状态同步、callback 导入。
- 系列 `seedance_video` UI 文案改为“GEARS 视频返修/重试”。
- 旧 Seedance 重试提交入口标为兼容路径。
- 最新 GEARS job 摘要显示状态、进度、poll 失败诊断。
- GEARS readiness / pressure / generated pressure 状态会在单故事项目页和 AI 漫剧系列工作台展示。
- GEARS smoke package、pressure report、generated project pressure audit 都可在前端导出 Markdown / JSON。
- GEARS worker acceptance 状态会在单故事项目页和 AI 漫剧系列工作台展示，并可导出 worker acceptance Markdown。
- GEARS worker acceptance kit 会在单故事项目页和 AI 漫剧系列工作台展示命令数，并可导出包含 env template、payload 文件、curl 命令和验证清单的 Markdown / JSON。
- GEARS worker acceptance script 会在单故事项目页和 AI 漫剧系列工作台作为 `.sh` 导出，脚本会写 payload、预取 evidence、提交 worker、轮询、回调和 live smoke，并保存响应。
- GEARS worker acceptance script 默认会从 submit response 自动提取 `gears_job_id` / `jobId` / `taskId` / `acceptedUnits[]` / `jobs[]` / `tasks[]` 等全部 job id，并逐个轮询 status。
- GEARS worker acceptance script 已补可配置多轮 status poll：`GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS` 默认 `1`，`GEARS_ACCEPTANCE_STATUS_POLL_INTERVAL_SECONDS` 默认 `5`；多轮时保存每次 `gears-status-response-<job>-attempt-<n>.json`，并保留最新 `gears-status-response-<job>.json` 供 audit 兼容。
- GEARS worker acceptance script 默认会 replay 单故事和系列 callback，保存 replay response；跑后重新拉 evidence bundle 和 generated pressure，并写 manifest。
- GEARS worker acceptance script 已改为“完整证据落盘、stdout 简报”：acceptance/evidence/generated pressure JSON 保存到 evidence 目录，终端只打印 ok/status/commands/payloads/documents 等摘要，避免真实联调日志被大 JSON 淹没。
- GEARS worker acceptance script 已补 Story Agent callback response audit：生成 `story-agent-callback-response-audit.json` 与 `story-agent-callback-response-audit.md`，统计 callback/live-smoke 响应里的 `ok=false`、validation/auth/not-found/live-smoke blocked 错误、received/updated/failed/duplicate 计数和推荐修复动作。
- GEARS worker acceptance script 已补 Story Agent callback id preflight：生成 `story-agent-callback-id-preflight.json` 与 `.md`，在 callback POST 前检查 `GEARS_SMOKE_PROJECT_ID` / `GEARS_SMOKE_SERIES_PROJECT_ID` 是否符合 Story Agent 路由格式，并把 warning / recommended action 打进证据目录。
- GEARS worker acceptance script 会生成 `gears-worker-response-audit.json` 与 `gears-worker-response-audit.md`，汇总真实 worker submit/status/大项目压测响应中的 job id 字段、source/idempotency 字段、状态别名、artifact URL 字段、ready 缺 artifact、error code、failure category、缺失合同告警和 `recommended_actions`，用于把真实 worker 响应直接转成 GEARS / Story Agent 合同修复待办。
- `recommended_actions` 现在会携带 `sample_paths`，audit totals 会输出 `sample_record_paths`，可定位缺 worker id、缺 source/idempotency、缺失败上下文、ready 无 artifact 和未知状态的代表性 JSON path。
- GEARS worker acceptance script 已补 transport / HTTP sidecar 证据：submit、status poll 和可选大项目 pressure submit 会保存 `*-http-status.txt` 与 `*-curl-exit-code.txt`；worker response audit 汇总 `transport_error_count` / `http_error_count`，并把非 2xx 与 curl 失败拆成独立 recommended actions。
- Story Agent callback/live-smoke 也已补 transport / HTTP sidecar 证据：project callback、series callback、callback replay 和 live smoke 会保存 `*-http-status.txt` 与 `*-curl-exit-code.txt`；`story-agent-callback-response-audit` 汇总 `transport_error_count` / `http_error_count` / `not_found_count` / `blocked_count` / `ledger_match_missing_count`，可区分 route/auth/project missing、live smoke env blocked、项目存在但 GEARS Job Ledger 未匹配与 callback payload 合同问题。
- worker response audit 已用 error_code / failure_category 参与 failed/rejected 判定：例如 `SERVICE_UNAVAILABLE` 会进入 failed，而不是 unknown，方便真实 worker 失败类型对齐。
- acceptance shell stdout 已继续降噪：`story-agent-callback-id-preflight`、`gears-worker-response-audit` 和 `story-agent-callback-response-audit` 都会打印一行 totals / recommended actions 摘要，详细内容仍落盘。
- worker response audit 已覆盖 `no_worker_response_files` 与 `record_count_zero` 两类前置失败：缺 env 时提示先跑 worker smoke，不可达 endpoint 留下空响应文件时提示补真实 submit/status 结果或 transport failure body。
- GEARS worker acceptance script 已补运行时模板渲染：提交前替换 `GEARS_SMOKE_PROJECT_ID`、`GEARS_SMOKE_STORY_ID`、`GEARS_SMOKE_SERIES_PROJECT_ID`、`<GEARS_CALLBACK_BASE_URL>`；提取 job id 后再替换 callback payload 中的 `<gears_job_id>`。
- GEARS worker acceptance script 已补无 token 提交分支和 submit 失败证据：`GEARS_API_TOKEN` 未配置时不再触发 Bash 空数组错误；GEARS worker 不可达时写出 `gears-submit-exit-code.txt`、`gears-submit-failed.txt` 和 manifest。
- GEARS worker acceptance script 已补缺 env 证据路径：即使缺 `GEARS_API_BASE_URL` / callback env，也会先写 payload、acceptance report、evidence bundle、manifest 和 `gears-required-env-missing.txt`，再以退出码 2 停止。
- GEARS worker acceptance kit 已补 smoke target 自动发现：导出包新增 `smoke_targets`，脚本会写 `story-agent-smoke-targets.json` / `story-agent-smoke-env-selected.json`；当 `GEARS_SMOKE_PROJECT_ID`、`GEARS_SMOKE_STORY_ID`、`GEARS_SMOKE_SERIES_PROJECT_ID` 留空或仍是占位符时，会从 `web/generated` 自动选择现有单故事项目和 AI 漫剧系列项目，减少 callback smoke 的 404 误判。
- Story Agent callback response audit 已补 `ledger_match_missing_count`：当 callback 成功到达真实项目但 `source_unit_id` / `gears_job_id` 不在项目 GEARS Job Ledger 中时，会给出“先走 Story Agent submit 建账本，或对齐回调 source/job id”的 P0 动作，避免误判为路由或鉴权问题。
- GEARS worker acceptance script 已补可选 Story Agent 账本预建：设置 `GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER=1` 时，脚本会通过单故事和系列 Story Agent submit API 创建 GEARS Job Ledger，并把 callback smoke payload 自动改写为真实 `source_unit_id` / `gears_job_id`，用于把 `ledger_match_missing_count` 从“可诊断”推进到“可验证归零”。
- GEARS worker acceptance kit 已补 30 集级大项目压测计划：默认生成 `gears-large-project-submit-pressure.json`（30 集 × 每集 4 镜，共 120 个 `seedance_video` units）和 `gears-large-project-pressure-summary.json`，并按 200 units 上限封顶；只有显式设置 `GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE=1` 才会向 GEARS worker 提交。
- GEARS worker evidence bundle 会在单故事项目页和 AI 漫剧系列工作台展示文档数，并可导出聚合 acceptance、kit、smoke handoff、pressure 和 generated pressure 的 Markdown / JSON。

### 文档与测试

- 新增 `docs/gears-execution-integration-plan.md`。
- 更新 `docs/story-agent-next-development-plan.md`。
- 更新 `docs/story-agent-next-conversation-handoff.md`。
- 更新 GEARS contract 示例为系列 `seedance_video` 返修/重试 payload。
- 新增 `GET /api/system/gears-execution-generated-project-pressure`，可扫描真实 generated project 的 GEARS Job Ledger 压力。
- 新增 GEARS worker 失败类型扩展和 generated pressure 前端导出。
- 新增 `GET /api/system/gears-execution-acceptance-report`，聚合 readiness、本地 smoke、live E2E 阻断项、pressure、generated pressure 和 handoff artifacts。
- 新增 `GET /api/system/gears-execution-worker-acceptance-kit`，生成外部 GEARS v2 worker 可直接执行的 env / payload / curl / checklist 验收包。
- `GET /api/system/gears-execution-worker-acceptance-kit` 已新增 `run-gears-worker-acceptance.sh` shell script 输出。
- 新增 `GET /api/system/gears-execution-worker-evidence-bundle`，生成外部 GEARS v2 worker handoff 证据包。
- GEARS submit response 兼容已扩展到深层 envelope，例如 `response.payload.result.tasks[]` / `rejectedJobs[]`；`PROMPT_TOO_LONG`、`duration_too_long`、`schema_invalid` 等 payload 类错误优先归一化为 `payload_invalid`，不会被 message 中的 worker 字样误判为 `worker_unavailable`。
- GEARS submit response 兼容已补顶层 `status` + `data.acceptedUnits[].externalId` 形态：Story Agent submit adapter 不再把只有 `status` 的响应 envelope 误当作缺 `source_unit_id` 的 job 记录，真实 worker 只回 `taskId` / `externalId` / `idempotencyKey` 也能建 GEARS Job Ledger。
- 已用导出的 `run-gears-worker-acceptance.sh` 跑真实 worker smoke 前置验证：本机无 GEARS v2 endpoint，脚本停在 `POST http://127.0.0.1:65534/gears/jobs`，退出码 7，并写出 submit 失败证据；渲染后的 `gears-submit-smoke.json` 已无 `GEARS_SMOKE_*` / `<GEARS_CALLBACK_BASE_URL>` 占位符。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 再跑两条阻断路径：缺真实 GEARS env 时写出 `/private/tmp/gears-worker-evidence-missing-env`，不可达 worker submit 时写出 `/private/tmp/gears-worker-evidence-submit-failure-v2`；大项目压力 payload 已确认生成 120 个 units，callback URL 可按 env 渲染。
- 已用本地 fake GEARS worker 验证多轮 status poll：submit 返回 `fake-gears-job-1`，第 1 次 status 为 `PROCESSING`、第 2 次为 `COMPLETED`；脚本写出 attempt 文件和 latest 文件，audit 扫描 attempt 文件、跳过 latest 副本，`ready_without_artifact=0/1` 且识别 artifact URL。
- 已用本地 fake GEARS worker 验证 Story Agent callback response audit：占位 project/series id 会导致单故事与系列 callback 返回 `ok=false` / `VALIDATION_ERROR`，audit 统计 `ok_false_count=2`、`validation_error_count=2`，并给出 `validation_error_count` 推荐动作，提示换成真实 Story Agent project id。
- 已用导出的 `run-gears-worker-acceptance.sh` 验证缺 env 路径的新 id preflight：`/private/tmp/gears-worker-evidence-id-preflight` 写出 `story-agent-callback-id-preflight.json/.md`，`warning_count=2`，并在 stdout 打印 `recommended_actions=1`；worker audit 同步打印 `record_count=0` / `no_worker_response_files`。
- 已用本地 fake GEARS worker 验证 HTTP 503 submit 证据：脚本写出 `gears-submit-response-http-status.txt=503` 与 `gears-submit-response-curl-exit-code.txt=0`，worker audit 统计 `http_error_count=1`、`failed_count=2`、`unknown_count=0`，并给出 `http_error_count` recommended action。
- 已用本地 fake GEARS worker 验证 Story Agent callback HTTP sidecar：worker submit/status 均 200，但使用不存在的合法格式 project/series id 回调，脚本完整退出 0，callback audit 统计 `http_error_count=4`、`not_found_count=4`、`blocked_count=1`、`ok_false_count=4`，sample transport files 指向四个 404 response，并把修复动作归到 smoke env 项目 ID / live smoke server env。
- 已用本地 fake GEARS worker 验证 smoke target 自动补齐：未设置 `GEARS_SMOKE_PROJECT_ID` / `GEARS_SMOKE_SERIES_PROJECT_ID` 时，脚本自动选择 `20260621-story-5xhl--character_story`、`20260621-story-5xhl` 和 `20260619-series-r0v5zyag`，证据目录 `/private/tmp/gears-worker-evidence-auto-target-v3`；callback response audit 统计 `not_found_count=0`、`blocked_count=0`、`ledger_match_missing_count=4`、`http_error_count=0`、`transport_error_count=0`，证明路由和鉴权已过，剩余阻断是需先由 Story Agent submit 建 GEARS Job Ledger。
- 已用本地 fake GEARS worker 验证可选 Story Agent ledger seed：证据目录 `/private/tmp/gears-worker-evidence-ledger-seed-v3`；项目侧 `story-agent-project-ledger-seed-selected.json` 显示 `patched=true`、`source_unit_id=shot-1`、`gears_job_id=fake-gears-job-seed-10`，单故事 callback 成功回写 GEARS Job Ledger 与 Seedance Shot Ledger；callback audit 从自动目标 smoke 的 `ledger_match_missing_count=4` 降到 `2`，剩余两条来自示例系列项目没有可提交的 `seedance_video` retry jobs（`story-agent-series-ledger-seed-selected.json` 为 `patched=false/no_submitted_job`）。
- 已修正 worker acceptance smoke target 选择：自动扫描默认 generated 根与仓库 `web/generated`，并把 series seed readiness 绑定到真实可提交候选；当 `seedance_video` 因缺真实 story/retry candidates 不可提交时，会自动推荐可提交的 GEARS 后期 job。本轮推荐 `GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE=title_card_render`。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 复测 ledger seed 完整闭环：证据目录 `/private/tmp/gears-worker-evidence-ledger-seed-v5`；自动选择 `20260619-series-3f89ec1y`，单故事与系列 seed selected 均 `patched=true`，series 使用 `source_unit_id=title_card:card-series-opening` / `gears_job_id=fake-gears-job-11`；callback response audit 统计 `updated_count=4`、`duplicate_count=2`、`failed_count=0`、`ledger_match_missing_count=0`、`recommended_actions=[]`。真实 GEARS v2 endpoint 仍未配置，真实端到端和真实大项目提交压测继续等待可达 endpoint。
- 已修正 worker response audit 的记录识别误报：顶层 submit/status envelope 仅有 `status` 时不再当作 worker record，`outputs[].url` 等 artifact 子项也不再被误判为缺 job/source id 的记录；只有明确 job/unit/task/result 路径或对象自身含 job/source/artifact/status 信号时才计入审计。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v7 fake GEARS smoke：证据目录 `/private/tmp/gears-worker-evidence-ledger-seed-v7`；worker audit 统计 `file_count=3`、`record_count=10`、`unknown_count=0`、`missing_worker_id_count=0`、`missing_source_id_count=0`、`missing_ready_artifact_count=0`、`recommended_actions=[]`；callback audit 统计 `updated_count=4`、`failed_count=0`、`duplicate_count=3`、`ledger_match_missing_count=0`、`recommended_actions=[]`。真实 GEARS v2 endpoint 仍未配置，真实端到端和真实大项目提交压测继续等待可达 endpoint。
- 已补大项目压力响应专用审计：acceptance shell 现在生成 `gears-large-project-response-audit.json/.md`，对 pressure payload 与 worker submit response 逐 source 对账，输出 source echo、缺失/重复/意外 source、HTTP/curl 状态和 `recommended_actions`。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v8 大项目压力 smoke：证据目录 `/private/tmp/gears-worker-evidence-ledger-seed-v8-pressure`；30 集 × 4 镜共 120 units 全量 accepted，large-project response audit 达到 `request_unit_count=120`、`response_record_count=120`、`accepted_count=120`、`source_echo_count=120`、`missing_requested_source_count=0`、`duplicate_source_id_count=0`、`unexpected_source_count=0`、`recommended_actions=[]`；worker audit 总计 `record_count=370` 且无 missing id/source/unknown，callback audit `ledger_match_missing_count=0`。真实 GEARS v2 endpoint 仍未配置。
- 已补最终 GEARS worker acceptance verdict：acceptance shell 现在生成 `gears-worker-acceptance-verdict.json/.md`，把 required env、callback id preflight、worker response audit、Story Agent callback audit、大项目 pressure audit 和 manifest 统一成 `acceptance_passed`、`failed_gate_ids` 与聚合 `recommended_actions`；默认 `GEARS_ACCEPTANCE_STRICT_AUDIT=1`，verdict 失败会让脚本非零退出。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v9 verdict smoke：证据目录 `/private/tmp/gears-worker-evidence-verdict-v9`；最终 `gears-worker-acceptance-verdict.json` 为 `status=passed`、`acceptance_passed=true`、`gate_counts.passed=6`、`failed_gate_ids=[]`、`recommended_actions=[]`；large-project response audit 继续达到 `request_unit_count=120`、`source_echo_count=120`，worker audit `record_count=370`，callback audit `ledger_match_missing_count=0`。真实 GEARS v2 endpoint 仍未配置。
- 已补最终 GEARS worker acceptance archive：acceptance shell 现在生成 `gears-worker-acceptance-archive.json/.md`，用必交证据文件、缺失附件、byte length 与 `sha256` 生成 handoff 清单；默认严格模式会同时要求 verdict `acceptance_passed=true` 与 archive `signoff_ready=true`。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v10 archive smoke：证据目录 `/private/tmp/gears-worker-evidence-archive-v10`；最终 `gears-worker-acceptance-archive.json` 为 `status=signoff_ready`、`signoff_ready=true`、18 个必交附件全齐、`missing_required_attachment_count=0`、证据文件 66 个、`recommended_actions=[]`；verdict `status=passed`、6 个 gate 全过；large-project response audit 继续达到 `request_unit_count=120`、`source_echo_count=120`，worker audit `record_count=370`，callback audit `updated_count=4`、`duplicate_count=3`、`ledger_match_missing_count=0`。真实 GEARS v2 endpoint 仍未配置。
- 已补最终 GEARS worker acceptance checksum manifest：acceptance shell 现在生成 `gears-worker-acceptance-checksums.json/.md`，逐文件记录 `sha256`、byte length、role 和 required 标记；archive 生成前会清理旧 archive/checksum 输出，避免重复运行污染证据清单。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v11 checksum smoke：证据目录 `/private/tmp/gears-worker-evidence-checksums-v11`；`gears-worker-acceptance-checksums.json` 为 `schema_version=gears-worker-acceptance-checksum-manifest/v1`、`algorithm=sha256`、`file_count=66`、`required_file_count=18`、`record_count=66`；archive `signoff_ready=true`、`required_checksum_count=18`；verdict 6 个 gate 全过，大项目 pressure 120/120 source echo，worker/callback audit 均无阻断。真实 GEARS v2 endpoint 仍未配置。
- 已补最终 GEARS worker acceptance integrity 复核：acceptance shell 现在生成 `gears-worker-acceptance-integrity.json/.md`，重新计算 checksum manifest 中每个证据文件的 `sha256` 与 byte length，检查必交附件是否都有 checksum record；默认严格模式会同时要求 verdict `acceptance_passed=true`、archive `signoff_ready=true` 和 integrity `integrity_passed=true`。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v12 integrity smoke：证据目录 `/private/tmp/gears-worker-evidence-integrity-v12`；`gears-worker-acceptance-integrity.json` 为 `status=passed`、`integrity_passed=true`、`archive_signoff_ready=true`、`required_checksum_records=18/18`、`mismatch_count=0`、`missing_file_count=0`、`sha256_mismatch_count=0`、`recommended_actions=[]`；verdict 6 个 gate 全过，大项目 pressure 120/120 source echo，worker/callback audit 均无阻断。真实 GEARS v2 endpoint 仍未配置。
- 已补 Story Agent generated health audit：`GET /api/system/story-agent-generated-health` 只读扫描 generated projects / series projects / stories / versions，按 `ready / planned / production_gap / interrupted` 标注生成资产健康状态，帮助在跑真实 GEARS v2 smoke 前区分“只是计划中”和“项目引用断裂/合同缺失”。项目工作台新增“生成项目体检”卡片；不新增真实 Seedance SDK、ffmpeg 或媒体实产。
- 已补 Story Agent MVP status：`GET /api/system/story-agent-mvp-status` 只读聚合 generated health 与 production readiness portfolio，输出 `story-agent-mvp-status/v1`、五条 MVP lane、priority targets、next actions、源报告和 Markdown；用于判断 Story Agent 主线是否可进入 GEARS worker evidence signoff，或还需先修复生成物、质量报告、GEARS 交付合同和生产指挥队列。
- 项目工作台已接入 Story Agent MVP 状态卡：展示总分、generated/readiness 比例、五条 lane、优先目标和下一步动作，并支持刷新与 Markdown/JSON 导出。
- 最新验证已通过：
  - `cd web/server && npm test -- src/__tests__/api.test.ts -t "story-agent-mvp-status"`
  - `cd web/server && npm run lint`
  - `cd web/client && npm run lint`
  - `cd mcp-server && npm test -- __tests__/get-story-agent-mvp-status.test.ts`
  - `cd mcp-server && npm run build`
  - `git diff --check`
  - `cd web/server && npm test -- src/__tests__/api.test.ts -t "gears-execution-worker-acceptance-kit"`
  - `cd web/server && npm run build`
  - `cd web/client && npm run build`
  - `cd web/server && npm test -- src/__tests__/gears-execution-service.test.ts`
  - `cd web/server && npm test -- src/__tests__/project-service.test.ts src/__tests__/outline-service.test.ts`
  - `cd web/server && npm test -- src/__tests__/api.test.ts`
  - `cd web/server && npm test -- src/__tests__/project-service.test.ts src/__tests__/outline-service.test.ts`
  - `git diff --check`
  - `curl http://localhost:3000/api/system/gears-execution-worker-acceptance-kit` 返回 200，且 JSON 含 20 条 commands / 5 个 payloads。
  - worker acceptance kit JSON 含 `run-gears-worker-acceptance.sh` 与 `smoke_targets`，脚本包含 smoke target 自动补齐、generated health 与 Story Agent MVP status 前后体检与机器 gate、submit job id 自动提取、可选 Story Agent ledger seed、evidence bundle 预检、callback id preflight、缺 env evidence、submit/status/callback/live-smoke 响应落盘、worker 与 Story Agent callback transport/HTTP sidecar、worker response audit、Story Agent callback response audit、callback replay、30 集级压力 payload 生成、可选压力提交、跑后 evidence / generated pressure 审计、manifest、最终 acceptance verdict、acceptance archive、checksum manifest、integrity 复核和 post-archive signoff JSON/Markdown 快照。
  - `curl http://localhost:3000/api/system/gears-execution-worker-evidence-bundle` 返回 200，且 JSON 含 7 份 documents / 20 条 commands / 5 个 payloads。

## 当前进度判断

| 模块 | 进度 | 说明 |
|---|---:|---|
| Story Agent MVP | 指挥层约 99%；GEARS 真实验收约 95% | 生成、质量报告、修复、项目版本、前端查看已跑通；MCP 修复链路新增 `kb_generate_story_repair_prompt`，可把 repair actions 变成模型可直接产出 `repaired_story_json` 的提示包；production readiness automation 已从“展示 runbook”推进到“一键运行安全 Story Agent API 步骤”，真实执行会写入最近 20 次自动化运行账本，跨项目 portfolio 已能按优先队列批量触发安全 Story Agent 步骤并新增队列级运行审计；generated health audit 已能区分 planned / interrupted / production_gap / ready，`story-agent-mvp-status/v1` 已把生成物、故事质量、修复闭环、GEARS 交付合同和生产指挥聚合成统一状态报告。95% 是真实 GEARS v2 worker endpoint、大项目 pressure 和 evidence signoff 尚未签收的口径，不是 Story Agent 内容/生产指挥层停滞。 |
| Production Board / Delivery Contract | 约 99% | 交付包、素材 slot、Shot Ledger、回传、重试、dashboard 已基本齐；readiness 现在显式暴露交付未落盘、镜头失败、GEARS 缺账本风险和对应 API 步骤。 |
| GEARS Execution Integration | 约 99%（Story Agent 侧合同） | config/contract、ledger、submit、callback/status sync、系列 payload、幂等、审计字段、失败类型扩展、worker acceptance kit、证据包、generated health 前置/后置审计、checksum/integrity、Story Agent ledger seed 和 30 集压力 payload 已跑通；仍缺可达 GEARS v2 endpoint 上的真实端到端执行验收和真实大项目 worker 提交压测。 |
| AI 漫剧系列指挥层 | 约 99% | 系列规划、账本、审片返修、重试、dashboard、GEARS 后期账本回显和多 job type 提交入口可用；系列 readiness 已进入 Web/API/UI/MCP 跨项目 portfolio，支持队列级安全自动化、系列级运行账本和 portfolio 运行审计。 |
| MCP Story Agent 闭环 | 约 99% | 只读生成包、质量校验、repair dry-run、修复提示包、受控写入已有；`kb_generate_story_repair_prompt` 可生成模型修复提示、保护字段、完整 JSON 输出合同和验证/写入工作流；`kb_get_story_agent_generated_health` 可读取本地 generated health，`kb_get_story_agent_mvp_status` 可读取本地 MVP 总控 lane，`kb_get_production_readiness_portfolio` 可读取跨项目优先队列和 portfolio 运行账本，`kb_run_production_readiness_portfolio_automation` 可桥接 Web portfolio runner 批量触发安全自动化并回传队列级审计结果。 |
| 可商用制作中台 | 约 99% | 已从分散 dashboard 推进到单故事/系列/portfolio 三层 readiness 中台，并开放 MCP 与 Web/API/UI 自动化 runbook、安全执行入口、MCP bridge、运行审计账本、跨项目优先队列、批量安全 runner、队列级运行审计、模型修复提示包和生成项目健康审计；实产闭环仍依赖 GEARS v2 真实 worker 对接。 |

2026-06-22 更新：新增 `GET /api/projects/:projectId/production-readiness` 与 `GET /api/story-outline/ai-comic-series-projects/:seriesProjectId/production-readiness`，以及项目详情页和 AI 漫剧系列工作台的 readiness 面板。新增测试覆盖 service 与 route 层。GEARS 真实执行仍不进入当前仓库。

2026-06-22 追加：新增 MCP 工具 `kb_get_production_readiness`，支持 `project_id` / `series_project_id`，输出 MCP production readiness JSON/Markdown；本轮补齐 `automation_plan`，把 next actions 映射为 MCP tool、Story Agent API、GEARS worker 或 operator review 步骤，并带 payload hint、前置条件、阻断 issue、预期结果和安全说明。单元测试覆盖单故事与 AI 漫剧系列路径，`mcp-server npm run build` 通过。

2026-06-22 再追加：Web/API readiness 共享合同新增 `ProductionReadinessAutomationPlan`，单故事与 AI 漫剧系列 readiness route 均返回自动化步骤；项目详情页和 AI 漫剧系列工作台会显示 ready/blocked/manual、runner、API path 和 GEARS 外部执行边界。

2026-06-22 自动化追加：新增 `POST /api/projects/:projectId/production-readiness/run-automation` 与 `POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/production-readiness/run-automation`，只执行 `can_auto_execute=true` 的 Story Agent API 步骤，自动跳过 GEARS worker 和人工审片步骤；两个前端工作台新增“运行安全自动化”按钮。

2026-06-22 MCP 执行 bridge 追加：新增 `kb_run_production_readiness_automation`，通过 `STORY_AGENT_BASE_URL` 或显式 `story_agent_base_url` 调用 Web/API runner，默认 dry-run，可限定 `action_keys` / `max_steps` / `stop_on_error`；Web 不可达时返回结构化 blocked 诊断和本地 readiness fallback。该工具不直接执行 GEARS worker、Seedance SDK、ffmpeg 或最终媒体合成。

2026-06-22 自动化审计追加：单故事项目与 AI 漫剧系列项目在真实执行 `run-automation` 后，会持久化 `production_readiness_automation_ledger`（最近 20 次、含分数变化、步骤、失败数和 notes）；readiness API、前端面板、Markdown handoff 与 MCP `kb_get_production_readiness` 均回显 `latest_automation_run`。dry-run 继续不写项目文件。

2026-06-22 portfolio 追加：新增 `GET /api/system/production-readiness-portfolio`，把全部单故事项目与 AI 漫剧系列 readiness 汇总成 priority queue / action buckets；项目工作台顶部新增“生产指挥总览”。MCP 新增只读 `kb_get_production_readiness_portfolio`，可直接从本地 `web/generated` 扫描项目并输出同类优先队列。

2026-06-22 portfolio runner 追加：新增 `POST /api/system/production-readiness-portfolio/run-automation`，按 priority queue 逐个调用已有单故事/系列安全 `run-automation` runner；前端“运行队列安全自动化”按钮可执行前 5 个高优先目标。MCP 新增 `kb_run_production_readiness_portfolio_automation` bridge，仍只委托 Web/API 执行安全 Story Agent 步骤，不执行 GEARS worker、Seedance SDK、ffmpeg 或最终媒体合成。

2026-06-22 portfolio ledger 追加：真实队列 run 会写入 `web/generated/system/production-readiness-portfolio-automation-ledger.json`，记录最近 20 次批量调度、目标执行/跳过/失败计数和 notes；`GET /api/system/production-readiness-portfolio`、项目工作台和 MCP 本地 portfolio 均会回显 latest portfolio run。dry-run 继续不落盘。

2026-06-22 MCP repair prompt 追加：新增 `kb_generate_story_repair_prompt`，复用 `kb_repair_story(auto_apply=false)` 的质量快照、修复动作和目标场景，输出只读 prompt、保护字段、完整 JSON 输出合同和 `kb_validate_genre_story -> kb_repair_story(auto_apply=true) -> kb_get_project_context` 推荐工作流；工具不写项目文件。

2026-06-22 generated health 追加：新增 `story-agent-generated-health/v1` 报告与 `GET /api/system/story-agent-generated-health`，项目工作台可直接查看 interrupted / production_gap / planned / ready 项目。该报告只做 Story Agent 生成资产和生产指挥合同体检，真实图片、视频、字幕、片头片尾和最终装配继续交给 GEARS v2。

2026-06-22 MCP generated health 追加：新增 `kb_get_story_agent_generated_health`，输出 `mcp-story-agent-generated-health/v1`，无需 Web dev server 即可本地只读扫描 generated health；测试覆盖 ready story、interrupted series 和 planned series。

2026-06-22 GEARS generated health acceptance 追加：`GET /api/system/gears-execution-acceptance-report` 已新增 `story_agent_generated_health` 检查和 `generated_health_*` 统计；`run-gears-worker-acceptance.sh` 会在提交 worker 前后保存 `story-agent-generated-health-before.json` / `story-agent-generated-health-after.json`，并生成 `story-agent-generated-health-audit.json/.md` 作为最终 verdict gate；`GET /api/system/gears-execution-worker-evidence-bundle` 新增 `story-agent-generated-health-report.md`，真实 smoke 前可先确认目标不是 planned-only 或 interrupted。

2026-06-22 v13 fake worker health smoke：已重新导出 `run-gears-worker-acceptance.sh` 并用本地 fake GEARS worker 跑 `/private/tmp/gears-worker-evidence-generated-health-v13`；脚本确认写出 generated health before/after，evidence bundle 为 6 份 documents，30 集压力 `request_unit_count=120` / `source_echo_count=120`，worker audit `record_count=370` 且无缺 worker id/source/artifact。该次故意设置 `GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER=0`，所以 Story Agent callback gate 以 `ledger_match_missing_count=4` 失败；这是验证 health/evidence 链路的非签收 smoke，不代表真实 GEARS v2 endpoint 已验收。

2026-06-22 v14 generated health gate 追加：worker acceptance kit 增至 18 条 commands；新增 `story-agent-generated-health-audit/v1`，最终 verdict 现在有 7 个 gate，其中 `story_agent_generated_health_audit` 会检查 before/after health 是否存在、至少有 ready target、`ready_count` 不下降、`interrupted_count` / `production_gap_count` 不上升。已用本地 fake GEARS worker 跑 `/private/tmp/gears-worker-evidence-generated-health-v14`，health gate `status=passed`、大项目压力 120/120 source echo、worker audit 无缺 id/source/artifact；因本次仍关闭 ledger seed，唯一失败 gate 仍是 `story_agent_callback_audit` 的 `ledger_match_missing_count=4`。

2026-06-22 v15 evidence signoff 追加：新增 `GET /api/system/gears-execution-worker-evidence-signoff?evidence_dir=...`，只读解析真实 smoke 证据目录里的 `gears-worker-acceptance-verdict.json`、archive、integrity、worker audit、Story Agent callback audit、generated health audit 和 large-project pressure audit，输出 `gears-execution-worker-evidence-signoff/v1`。该报告会把 `acceptance_passed`、`signoff_ready`、`integrity_passed`、`health_audit_passed`、7 个 gate、必交附件、worker/callback/health/pressure 统计和 recommended actions 合成一个签收视图；核心证据齐但门禁未过为 `attention`，缺证据或非法 evidence dir 为 `blocked`。新增 API 测试覆盖缺 evidence dir、完整 evidence dir ready、越权目录 blocked。

2026-06-23 v16/v17 evidence signoff 追加：worker acceptance 脚本在 `env-blocked`、GEARS submit transport failure、submit 非 2xx 三类早退路径也会生成 Story Agent callback audit、large project pressure audit、generated health after/audit、verdict、archive 和 integrity，避免真实 endpoint 不可达时缺必交证据；signoff API 额外暴露 worker transport/http error、worker failure category counts、callback transport/http error、大项目 response/accepted/rejected/failed/duplicate/unexpected source 统计，并对 recommended actions 去重。新增 MCP 只读工具 `kb_get_gears_worker_evidence_signoff`，无需 Web dev server 即可读取 evidence 目录，输出 `mcp-gears-worker-evidence-signoff/v1` 与同类签收摘要。验证通过：`web/server npm test -- src/__tests__/api.test.ts -t "gears-execution-worker"`、`web/server npm run lint`、`mcp-server npm test -- __tests__/get-gears-worker-evidence-signoff.test.ts`、`mcp-server npm run build`、`git diff --check`。

2026-06-23 前端 evidence signoff 追加：单故事项目详情页与 AI 漫剧系列工作台已接入 worker evidence signoff 输入、读取、摘要和导出。真实 acceptance 脚本生成 evidence 目录后，可直接在工作台查看 signoff status、gate 统计、缺附件、worker/callback transport-http error、大项目 pressure source echo 与 recommended action 数，并导出 signoff Markdown / JSON；此入口只读 evidence，不触发 GEARS worker 或媒体实产。

2026-06-23 latest evidence 追加：Web signoff API 与 MCP `kb_get_gears_worker_evidence_signoff` 已支持在未传 `evidence_dir`、未设置 `GEARS_EVIDENCE_DIR` 时自动发现最近的 `gears-worker-evidence*` 目录，并返回 `evidence_dir_source=input/env/latest/missing`。默认扫描允许根 `/private/tmp`、`/tmp`、`TMPDIR` 与 repo root；可用 `GEARS_EVIDENCE_AUTO_DISCOVER=0` 关闭，或用 `GEARS_EVIDENCE_AUTO_DISCOVER_ROOTS` 限定扫描根。该能力只读证据，不执行 GEARS worker。

2026-06-23 acceptance kit 签收闭环追加：worker acceptance kit 新增 `read_worker_evidence_signoff` 命令；导出的 `run-gears-worker-acceptance.sh` 会在正常完成、缺 env、submit transport failure、submit 非 2xx 和严格审计失败前打印 Web signoff URL、latest signoff URL 与 MCP signoff 工具调用提示。evidence bundle checklist/next actions 同步要求附加 signoff Markdown / JSON，便于真实 GEARS v2 smoke 后立刻形成签收/修复判定。

2026-06-23 Story Agent MVP status 追加：新增 `GET /api/system/story-agent-mvp-status` 与前端 API client `getStoryAgentMvpStatus()`。报告只读组合 generated health 和 production readiness portfolio，返回五条 lane、priority targets、next actions、源报告和 Markdown；它是 Story Agent MVP 主线的总控状态，不执行 GEARS worker、Seedance SDK、ffmpeg 或最终媒体合成。

2026-06-23 MCP MVP status 追加：新增 `kb_get_story_agent_mvp_status`，输出 `mcp-story-agent-mvp-status/v1`，本地只读组合 generated health 与 production readiness portfolio；无 Web dev server 时也可以查看同类五条 MVP lane、priority targets、next actions 和可选 Markdown。

2026-06-23 项目工作台 MVP 总控追加：`Projects.vue` 已在生产指挥总览和生成项目体检之前显示 Story Agent MVP 状态卡，支持刷新、Markdown/JSON 导出，并把 priority targets 直接链接到故事项目或 AI 漫剧系列工作台。

2026-06-23 evidence bundle MVP status 追加：GEARS worker evidence bundle 新增 `story-agent-mvp-status-report.md`，summary 新增 `story_agent_mvp_status` / `story_agent_mvp_score`，当前 evidence bundle 为 7 份 documents。真实 GEARS handoff 时可同时附上 MVP lane、generated health、pressure、worker kit 和 acceptance report。

2026-06-23 worker acceptance MVP audit 追加：`run-gears-worker-acceptance.sh` 会在 GEARS worker smoke 前后保存 `story-agent-mvp-status-before.json` / `story-agent-mvp-status-after.json`，生成 `story-agent-mvp-status-audit.json/.md`，并把 `story_agent_mvp_status_audit` 加入最终 verdict。当前 acceptance kit 为 20 条 commands，最终 verdict 为 8 个 gate，archive 必交附件为 26 个；signoff API 与 MCP signoff 工具会输出 `mvp_status_audit_passed`、MVP before/after status 和 score delta。

2026-06-23 post-archive signoff snapshot 追加：`run-gears-worker-acceptance.sh` 在正常完成、缺 env、GEARS submit transport failure、submit 非 2xx 和严格审计失败前都会自动调用 `GET /api/system/gears-execution-worker-evidence-signoff?evidence_dir=...`，把 `gears-worker-evidence-signoff.json` 与 `gears-worker-evidence-signoff.md` 写入 evidence 目录。该快照发生在 archive / checksum / integrity 之后，不纳入 checksum manifest，避免签收报告递归校验自身。

2026-06-23 MVP 进度口径拆分追加：Web `story-agent-mvp-status/v1` 与 MCP `mcp-story-agent-mvp-status/v1` 新增 `progress[]`，固定拆出 `content_command_layer=99%` 和 `gears_end_to_end_acceptance=95%`。项目工作台 MVP 总控同步显示“内容/生产指挥层”和“GEARS 真实验收”，用于回答“为什么还是 95%”：剩余 5% 仅指可达 GEARS v2 endpoint 的真实 submit/status/callback smoke、大项目 worker pressure 和 evidence signoff。

2026-06-23 周敦颐单故事自然交付修复追加：`20260621-story-5xhl--character_story` 已新增 `20260621-story-5xhl--character_story-v10`，当前项目标题《周敦颐橘洲问莲》，`quality_passed=true`、`genre_score=100`、`quality_issue_count=0`、大纲覆盖 100、pattern score 100、GEARS readiness 100、`audience_text_report.clean=true`。v10 重新承接用户大纲“道州赴汴京、长沙橘子洲、垂钓老者、莲之品格”，并生成 5 个 scenes / 5 个 gears_segments / 15 个 GEARS delivery units，`validation_notes=0`；观众字段已扫描清除“主角目标/目标明确/选择有代价/因果链/行动具体/人物不是年表/史实边界”等检测词痕迹。该修复只更新 generated project 版本和项目元数据，不进入 `data/provinces/*.md`，不扩展真实 Seedance SDK、ffmpeg 或 final assemble。

2026-06-23 audience text gate 追加：Story Agent 质量富化报告新增 `audience_text_report`（`audience-text/v1`），专门扫描观众字段和 GEARS 脚本文本中的内部质量标签；发现污染时生成 `repair-audience-text`，前端项目详情页 / StoryResult 可显示 Audience Text 卡片。该能力只做内容质量与交付指挥，不执行 GEARS 媒体实产。

2026-06-23 GEARS delivery / quality gate 修复追加：`gears-delivery-service` 已修正“长沙”误触发清末民初服饰的问题，周敦颐/北宋语境优先输出北宋士人服装；`narrative-pattern-library` 已修正“行动具体”等单项紧凑信号的最小命中数，避免 Story Agent quality gate 出现不可满足假阴性。新增回归测试并通过 server 全量测试。

2026-06-23 worker acceptance endpoint readiness 追加：`gears-execution-worker-acceptance-kit/v1` 新增 `real_endpoint_readiness`，签收脚本导出前即可看到 `needs_env / needs_smoke_target / ready`、缺失 env、smoke target 是否齐备、推荐命令和 next actions；单故事项目页与 AI 漫剧系列工作台同步显示 real endpoint 状态，真实 GEARS v2 endpoint 未配置时不会误判为可签收。

2026-06-23 generated health 系列治理追加：`story-agent-generated-health/v1` summary 新增 `series_ready_count`、`series_planned_only_count`、`series_production_gap_count`、`series_interrupted_count`、`series_governance_attention_count`、`series_missing_story_ref_project_count`、`series_contract_evidence_count` 和 `series_relink_candidate_count`，Markdown/notes 输出 `series_governance_attention` 与 `series_relink_candidates` 提醒。真实扫描显示 926 个 AI 漫剧系列都缺 generated episode story refs，其中 99 个已有生产/后期合同证据，优先 relink；其余历史样本先归档 fixture 或补齐 Story Agent 合同，避免把生成资产治理问题误判为 worker 合同失败。

## 下一步建议

优先级从高到低：

1. **GEARS v2 真实端到端 smoke**
   - 配置 `GEARS_API_BASE_URL`、`GEARS_API_TOKEN`、`GEARS_CALLBACK_SECRET`、`GEARS_CALLBACK_BASE_URL`，优先导出 `run-gears-worker-acceptance.sh` 并按脚本执行。
   - 对单故事和 AI 漫剧系列各跑一次 `use_gears_api=true`。
   - 用真实 GEARS status / callback 回写验证 ledger 和 UI。

2. **GEARS v2 侧合同对齐**
   - 在 `Wy490/gears-v2` 中确认 `/gears/jobs`、`/gears/jobs/{id}`、artifact callback 形态。
   - 如果 GEARS PRD 仍写“不做视频/后期”，先更新 PRD，明确视频与后期实产归 GEARS。

3. **真实大项目 worker 压测**
   - 对 30 集以上 AI 漫剧项目跑真实 GEARS submit/status/callback 压测。
   - 对照 generated pressure audit 观察 ledger 文件体积、callback_events 增长和前端渲染性能。
   - 如果真实 worker 产生新错误码，再补充失败分类别名。

4. **UX 降噪**
   - 默认界面只保留 GEARS 主路径。
   - 旧 Seedance provider / dry-run / legacy 操作继续降级到兼容折叠区。

5. **MCP 深修复链路**
   - 前端暴露 `kb_generate_story_repair_prompt` 类似的修复提示包入口。
   - 对模型产出的 `repaired_story_json` 做质量对比后，再调用 `kb_repair_story(auto_apply=true)`。
   - 继续保持只读优先、受控写入、永不覆盖旧版本。

## 新对话推荐开场

```text
请继续 /Users/wuyu/Desktop/china-culture-kb 项目开发。先阅读 docs/story-agent-gears-handoff-2026-06-21.md、docs/gears-execution-integration-plan.md、docs/story-agent-next-development-plan.md、docs/story-agent-next-conversation-handoff.md。当前分支 codex-ai-comic-series-longform，最新提交 8d8afd65 已推送。先执行 git status --short --branch 和 git diff --stat。新的方向是：china-culture-kb 只做内容与生产指挥层，图片/视频/后期实产全部交给 GEARS v2。优先导出 GEARS worker acceptance shell script 并跑真实端到端 smoke，同时继续 GEARS 合同对齐、失败类型扩展和大项目压测；暂停继续做真实 Seedance SDK、真实 ffmpeg 片头片尾、真实 final assemble。
```
