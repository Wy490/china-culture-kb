# Story Agent 下一阶段开发计划

> 日期：2026-06-18
> 分支：`codex-ai-comic-series-longform`
> 用途：给新对话快速接续 Story Agent、Production Board、GEARS / Seedance 交付链开发。

## 1. 当前进度

| 模块 | 当前判断 | 说明 |
|---|---:|---|
| Story Agent MVP | 约 75% | 生成、质量报告、项目版本、质量修复、前端查看已经跑通。 |
| Production Board / GEARS / Seedance | 约 95% | 生产板、监督、修复、导出、素材库、Shot Ledger、回传、重试、provider 队列元数据、超时恢复、外部回传 schema、轮询入口、失败分类、provider 错误码传递、通用 submit/poll adapter、provider 队列状态总览、人工重试策略和重试执行自动化首版已完成。 |
| MCP Story Agent 闭环 | 约 75-80% | 项目读取、蓝图、质量校验、GEARS/Seedance 只读交付、repair dry-run、受控版本写入、安全 auto_apply 首版已完成。 |
| AI 漫剧系列生产链 | 约 45% | 系列规划、生产账本、回片、剪辑包、缩略图、精修计划已有；字幕、混音、片头片尾、final delivery 待做。 |
| 可商用制作中台 | 约 42% | 主链路可用；还缺 UX 降噪、真实外部 provider、平台专用错误码映射扩展、审片返修和稳定压测。 |

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
  - 支持 `SEEDANCE_PROVIDER_API_TOKEN` bearer 鉴权和 `SEEDANCE_PROVIDER_POLL_TIMEOUT_MS` 超时控制；外部 adapter 网络/HTTP 错误在路由层返回 502。
  - 项目详情页“回传与重试”新增“轮询 provider”按钮，会按最新 provider / queue 批次调用 poll adapter，成功后刷新 Production Board、队列健康和重试策略。
- Seedance provider 通用 submit adapter 首版：
  - `SeedanceShotProviderSubmitRequest` 新增 `use_provider_adapter`，响应新增 `provider_adapter` 提交摘要。
  - 服务端读取 `SEEDANCE_PROVIDER_SUBMIT_ENDPOINT`，把待提交镜头、Seedance prompt、素材 slot 和素材库 POST 给外部 adapter。
  - adapter 返回真实 `provider_job_id` / `provider_queue_id` / queue position 后，会覆盖本地占位 job 并写入 Shot Ledger 与 provider queue batch。
  - 支持 `SEEDANCE_PROVIDER_SUBMIT_API_TOKEN` 或通用 `SEEDANCE_PROVIDER_API_TOKEN` bearer 鉴权，未配置 endpoint 返回 400，外部 adapter HTTP/网络错误返回 502。
  - 项目详情页“回传与重试”保留本地“提交到 Seedance”，并新增“提交 adapter”入口，用于从工作台直接触发真实 submit worker。
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

### 文档同步

- 更新 `docs/story-agent-next-conversation-handoff.md`。
- 更新 `docs/story-agent-production-workbench-development-plan.md`。
- 更新 `开发文档/story-agent-mcp-quality-delivery-implementation-plan.md`。
- 保持下一阶段方向从“队列化准备”推进到“外部回传 schema、自动轮询、真实 provider API”；外部回传 schema、轮询入口、失败分类、通用 submit/poll adapter、队列状态总览、人工重试策略和重试执行自动化已完成首版。

## 3. 已验证命令

```bash
cd web/client && npm run lint
cd web/server && npm run lint
cd web/server && npm test -- src/__tests__/project-service.test.ts
cd web/server && npm test -- src/__tests__/api.test.ts
cd web/server && npm test
git diff --check
```
最近一次结果：

- `web/client`：lint passed。
- `web/client`：build passed。
- `web/server`：lint passed；`project-service.test.ts` 31 passed，`api.test.ts` 85 passed；全量 24 files / 237 tests passed。
- `web/client`：lint passed；ProjectDetail provider overview API smoke 通过，提交 5 条 provider 任务后 overview 返回 5 个总镜头 / 5 个活跃 / 5 个注意项。
- `git diff --check`：passed。

注意：`web/server` 的 API 测试会启动本地 HTTP server，在沙箱中可能触发 `listen EPERM 0.0.0.0`，需要允许非沙箱运行。

## 4. 当前工作区提醒

- 当前仍有未提交改动。
- `data/provinces/湖南.md` 是已有脏改动，不属于本轮 Story Agent/Seedance 推进范围；新对话不要随意覆盖或回滚。
- 新对话开始必须先执行：

```bash
git status --short
git diff --stat
```

## 5. 下一阶段优先级

### P0：收尾当前工作区

1. 复核 `git status --short` 和 `git diff --stat`。
2. 确认没有意外文件后提交当前成果。
3. 不要覆盖用户已有改动，尤其是 `data/provinces/湖南.md`。

建议提交信息：

```text
新增 Seedance provider 重试执行自动化
```

### P0：Seedance provider 平台专用 adapter

目标：

- 外部 provider 回传 schema 已完成首版。
- provider 轮询入口已完成首版，可返回待查询 job / queue，也可应用 provider status snapshots。
- provider 失败分类、错误码传递和通用错误码别名映射已完成首版，后续真实 adapter 只需补具体平台专用错误码。
- 通用 submit/poll adapter 已完成首版，可通过 `SEEDANCE_PROVIDER_SUBMIT_ENDPOINT` / `SEEDANCE_PROVIDER_POLL_ENDPOINT` 连接外部 worker。
- 队列状态总览已完成首版，可直接读取 provider/queue 健康度、超时和失败注意项。
- 人工重试策略已完成只读首版，可直接输出可重提/需先处理的候选镜头清单。
- 重试执行自动化已完成首版，可把可重提候选一键重新提交到 provider 队列。
- 下一步支持具体 Seedance / 外部 provider 的平台 SDK/HTTP 实现、鉴权参数和平台专用错误码映射。
- 将真实回传结果接入现有超时恢复、失败分类和重试包链路。

建议先做最小切片：

```text
SeedanceProviderAdapter
  -> implement platform-specific submit HTTP/SDK call
  -> implement platform-specific status query HTTP/SDK call
  -> map platform error code when needed
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

### P1：AI 漫剧字幕链路

下一块建议做：

```text
export-seedance-subtitles
  -> seedance-subtitles sidecar
  -> subtitle render ledger
  -> 前端导出 SRT
```

## 6. 新对话开场指令

```text
请继续 /Users/wuyu/Desktop/china-culture-kb 的 Story Agent 开发。先阅读 docs/story-agent-next-development-plan.md，再阅读 docs/story-agent-next-conversation-handoff.md 和其中列出的计划文档/技能。当前分支是 codex-ai-comic-series-longform，当前有未提交改动。先执行 git status --short 和 git diff --stat，不要覆盖用户改动，尤其不要回滚 data/provinces/湖南.md。优先收尾当前工作区，然后继续 P0：Seedance provider 平台 SDK/HTTP submit/query 实现、MCP 更深模型修复链路、故事管理 UX 降噪。默认界面保持简单，只保留高频主路径。
```
