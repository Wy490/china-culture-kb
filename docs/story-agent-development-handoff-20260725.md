# Story Agent 开发交接：P1-B5 视觉压力 system ops 与运行控制台完成

> 交接日期：2026-07-25
>
> 仓库：`/Users/wuyu/Desktop/china-culture-kb`
>
> 分支：`codex/story-agent-manifest-integrity-20260718`
>
> P1-B1 功能基线提交：`f1e5f5c6 feat(story-agent): add unified project run ledger`
>
> P1-B2 生成入口提交：`a04ab79e feat(story-agent): start runs from generation requests`
>
> P1-B2 运行控制台提交：`f6f07133 feat(story-agent): add bounded run console`
>
> P1-B3 工作流 checkpoint 提交：`7a47ea01 feat(story-agent): add recoverable workflow checkpoints`
>
> P1-B4 视觉资产压力审计提交：`b24a0e43 feat(story-agent): audit diverse visual asset pressure`
>
> P1-B5 ops 可发现性提交：`ac4db463 feat(story-agent): surface visual pressure ops status`
>
> 远端：本交接完成后推送到 `origin/codex/story-agent-manifest-integrity-20260718`
>
> 当前工作区：功能与回归测试已提交；本交接最终提交后应为干净
>
> 历史长交接：`docs/story-agent-development-handoff-20260724.md`

## 1. 下一对话先读这里

产品边界固定为：

```text
用户要求 / 知识条目 / 原作材料
  → 15 类结构化故事
  → 对应专业脚本
  → 逐镜 scene / GEARS / Seedance 提示词
  → Codex 图片任务与资产绑定
  → 一键前置制作交付包
```

Story Agent 在图片资产和 Seedance 前置制作包处结束。真实视频由用户在 Seedance 中完成。

以下事项不属于当前开发目标，也不得重新成为阻塞项：

- 视频 Provider、视频回调和真实成片生成；
- 剪辑、配音、口型、字幕、片头和 release；
- 真人测试、真人盲评和真人媒体审核；
- rights approval 或 production credit 自动授予。

权利、真人审核和 production credit 可以继续保留严格的 no-credit 语义，但不参与当前功能验收。

## 2. 当前结论

Story Agent 已从“不同题材视觉资产拥有统一机器审计证据”推进到“审计报告有 canonical system 路径、fail-closed ops 摘要 API，并在 StoryAgentRun 控制台直接可见”的阶段。

当前工程判断：

| 口径 | 完成度 | 判断 |
|---|---:|---|
| 展示结构化生成与前置制作交付 | 98%–99% | 普通项目、系列项目、15×1、15×3、运行控制台、专业 checkpoint、四题材视觉压力与 ops 摘要均有完整交付证据 |
| 15 类型无人值守稳定交付 | 96%–98% | 本地恢复、图片幂等、严格门禁、record-replay、两类 StoryAgentRun、checkpoint 历史、视觉资产六场景审计及其 fail-closed ops 读取均已跑通 |
| 原始影视/文字参考资料自动理解 | 35%–45% | 治理、任务和门禁完整，但尚不会自动读取完整视频、小说或剧本 |

仍不能宣称 100% 完成，主要因为：

1. 尚未使用真实外部 Provider 凭据运行生产级矩阵；
2. 尚未使用用户合法提供的真实材料运行 operator evidence、approved style pack 和 baseline 对照；
3. 当前四题材压力审计已证明素材互异和恢复语义，但仍应继续扩大到新生成批次，而不是只依赖现有 canonical 视觉板。

## 3. 已完成的核心链路

### 3.1 Canonical 故事生成

```text
Knowledge entry / user material
  → StoryBlueprint
  → full_text
  → scene_breakdown
  → gears_segments
  → quality report
  → repair
  → story snapshot
  → project/version storage
```

已完成：

- 15 个 `VideoType` 的 `GenreStoryProfile`；
- 类型 promise、必需元素、禁用表达、场景功能和修复规则；
- 本地故事引擎与外部 command adapter；
- `StoryBlueprint`、`full_text`、`scene_breakdown`、`gears_segments`；
- genre、premise fidelity、commercial machine gate 和自动修复；
- 普通项目、项目版本、系列项目和 derived-state rebuild；
- Web canonical API 与 MCP `kb_story_agent_generate`。

15 类：

```text
character_story
historical_drama
legend_story
children_story
ai_comic_drama
culture_promo
heritage_promo
city_brand_promo
social_short
documentary_short
explainer_video
lecture_video
education_training
scene_short
landscape_mood
```

### 3.2 专业脚本与 Seedance

已完成：

- 15 类 `ProfessionalTextPackage`；
- unified dispatcher 与 evidence resolver；
- 资料不足时输出结构化 supplement task；
- 专业包随故事、项目版本和修复版本持久化；
- scene、GEARS、Seedance prompt 与故事 derived state 一致；
- 普通项目和 AI 漫剧系列共用：

```text
story-agent-seedance-preproduction-package/v1
```

### 3.3 图片资产与恢复

已完成：

- `image-generation-request/v1`；
- `image-generation-result/v1`；
- `story-agent-image-run/v1`；
- Codex 在服务端之外调用 imagegen；
- 输出路径、request hash、prompt hash、文件 SHA-256 校验；
- 普通项目和系列项目资产导入；
- task 级部分恢复和幂等重放；
- 项目资产已经写入但账本未写入时的 crash recovery；
- 系列资产替换后 identity mapping 变为 `stale`；
- preproduction acceptance 自动刷新。

服务端不会 import 或调用 Codex imagegen，也不会调用图片 Provider。

### 3.4 Reference Library

已完成：

- source metadata、rights/access scope、content fingerprint；
- film/text structured analysis；
- pending analysis 与 `material:sign` 独立批准；
- source-bound `reference-analysis-task/v1`；
- 幂等 operator evidence 提交；
- `reference-similarity-evidence/v1`；
- excerpt、character、plot、shot 四维相似度门禁；
- approved analysis → benchmark → audited style pack；
- audited style pack → canonical external prompt；
- 完整 source/analysis/benchmark/style-pack `reference_trace`；
- final-output 和 derived-state fail-closed；
- reference-free baseline 与 reference-assisted 机器质量 delta；
- Reference Library Web 治理、组合和 baseline 工作台。

真实边界：

- 服务器不会擅自下载来源正文或完整影视作品；
- 仓库当前没有真实 approved style pack；
- 最近浏览器 smoke 检查 40 个 reference-free 候选，0 个已完成真实对照；
- fixture 和 machine comparison 不计真人、法律或 production credit。

## 4. P1-B1：统一 StoryAgentRun 已完成

### 4.1 合同

新增：

```text
story-agent-run/v1
story-agent-run-input/v1
story-agent-run-image-import/v1
story-agent-run-export/v1
```

顶层账本保存：

```text
run_id
input_contract
input_sha256
source
video_types
status
current_stage
stage_results
workflow_checkpoints
blockers
retryable_failures
image_request_manifest
preproduction_package
boundary
resume_count
created_at
updated_at
```

五个阶段：

```text
source
professional_script
seedance_prompt
image_assets
preproduction_package
```

阶段状态：

```text
pending
ready
awaiting_external_action
failed_retryable
blocked
```

### 4.2 行为

- run ID 由 source kind 和 project/series ID 稳定派生；
- 重复 start 返回同一 top-level run；
- 同一来源和 task contract 继续返回同一 image run；
- start/resume 复用现有 professional、Seedance、image-run 和 preproduction 服务；
- 顶层账本携带完整 canonical `image-generation-request/v1`，不是只有摘要；
- Codex/MCP 可以直接读取 task、prompt、request hash、输出目录和预期文件路径；
- `import-images` 先经过现有图片 run 的路径/hash/资产绑定，再自动 resume 顶层状态；
- 测试已证明真实本地图片文件导入后：

```text
awaiting_external_action → ready
current_stage → complete
```

- start/resume 不调用图片 Provider；
- 所有接口不生成视频；
- 所有结果固定不授予人工、权利或 production credit。

持久化位置：

```text
web/generated/story-agent-runs/<story-agent-run-id>/run.json
web/generated/story-agent-runs/<story-agent-run-id>/generation-checkpoint.json
```

图片请求仍由原 canonical 账本持久化：

```text
web/generated/story-agent-image-runs/<image-run-id>/
  request.json
  run.json
  result.json
  outputs/
```

### 4.3 API

```text
POST /api/story-agent/runs
POST /api/story-agent/runs/generate
GET  /api/story-agent/runs
GET  /api/story-agent/runs/:runId
POST /api/story-agent/runs/:runId/resume
POST /api/story-agent/runs/:runId/import-images
GET  /api/story-agent/runs/:runId/export
```

权限：

- start/resume/import 要求 `production:write`；
- get/export 要求 `project:read`；
- 先执行全局权限，再执行 project/series resource ownership；
- 高风险写入在解析无效 schema 前拒绝无权限角色。

### 4.4 MCP

```text
kb_start_story_agent_run
kb_generate_story_agent_run
kb_get_story_agent_run
kb_resume_story_agent_run
kb_import_story_agent_images
kb_export_story_agent_run
```

MCP 只调用 canonical Web application service：

- 不直接写项目；
- 不直接写资产库；
- 不调用 Provider；
- 不生成视频。

### 4.5 关键文件

```text
web/shared/types.ts
web/shared/schemas.ts
web/server/src/services/story-agent-run-service.ts
web/server/src/routes/story-agent.ts
web/server/src/__tests__/api.test.ts
web/server/src/__tests__/product-access-control.test.ts

mcp-server/src/tools/story-agent-runs.ts
mcp-server/src/tools/story-agent-runs.test.ts
mcp-server/src/index.ts
```

## 5. 已验证证据

最近一次完整门禁：

```text
Web build：通过
Web 全 workspace lint：通过

Server:
  Test Files  173 passed | 1 skipped
  Tests       1476 passed | 2 skipped

MCP:
  Test Files  95 passed
  Tests       503 passed

git diff --check：通过
```

本轮新增定向证据：

```text
视觉资产压力服务：2 passed
视觉压力 style map / ops 服务：4 passed
Story Agent image run API：3 passed
系列图片替换 identity stale：1 passed
压力审计：4 个不同题材 / 4 个不同风格 / 18 个资产 / 8 个唯一内容 SHA
跨题材内容复用：0
语义门禁：4/4 passed
源文件 SHA、媒体签名、immutable preview、当前 identity mapping：18/18
缺图、坏图、SHA 不匹配、部分导入、失败任务重试、identity stale：6/6 passed
system ops API：只返回 bounded summary，不暴露绝对路径，不复制 cases/scenario_results
canonical 报告读取：missing→not_run，invalid/inconsistent→blocked，完整报告→ready
StoryAgentRun 控制台：client build/vue-tsc 通过；内置浏览器因无法访问宿主机本地端口，未形成浏览器 smoke 成功证据
```

其他已经完成的里程碑证据：

```text
15×1 canonical：15/15 preproduction ready
15×3 本地矩阵：45 unique projects / 351 shots / 69 images / 45 ready packages
图片部分恢复：保留成功任务，只继续未完成任务，最终 69/69 verified
图片幂等复跑：69/69 skipped，project/run IDs 稳定
P0-E2 record-replay：15/15 full pipeline ready
P0-E2 strict gates：missing/conflict/invalid/timeout 全部 blocked
P0-E2 provenance：record_replay_fixture，external_model_call_performed=false
Reference Library 浏览器 smoke：API 正常、控制台零 error/warn/issue
```

权威报告：

```text
web/generated/story-agent-15-type-preproduction-matrix/matrix-report.json
web/generated/story-agent-15-type-preproduction-matrix/image-import-report.json
web/generated/story-agent-15x3-stability-matrix/matrix-report.json
web/generated/story-agent-15x3-stability-matrix/image-recovery-report.json
web/generated/story-agent-15x3-stability-matrix/image-idempotency-report.json
web/generated/system/story-agent-visual-asset-pressure/report.json
web/generated/story-agent-p0e2-reliability-matrix/reliability-report.json
```

不要把 `persistent-lifecycle-report.json` 或 `playable-media-report.json` 当作当前目标证据；它们属于后来划出 Story Agent 范围的视频/后期实验。

## 6. P1-B2 / P1-B3 / P1-B4 / P1-B5 当前状态与下一步

在没有真实外部 Provider 凭据和合法参考材料时，下一对话应优先使用显式输入运行新的不同素材批次，并继续扩大视觉世界覆盖。

### 6.1 已完成：从全新生成请求启动 run

```text
StoryGenerateRequest
  → 创建 durable StoryAgentRun
  → generation checkpoint
  → story/project checkpoint
  → professional checkpoint
  → Seedance checkpoint
  → image request checkpoint
  → preproduction checkpoint
```

已新增：

```text
POST /api/story-agent/runs/generate
StoryAgentRunGenerateRequestSchema
story-agent-run/v2
story-agent-run-input/v2
story-agent-run-generation-checkpoint/v1
kb_generate_story_agent_run
```

已验证：

- 模型调用前原子持久化 run 和 generation attempt；
- 调用方提供稳定 `idempotency_key`；
- 同 key + 同 canonical request 返回同一 run，attempt 不增加；
- 同 key + 不同 request 返回 `409/STORY_AGENT_RUN_INPUT_CONFLICT`；
- required access 模式下 idempotency identity 按 organization + owner actor 隔离；
- 严格外部生成失败保存 `failed_retryable`，不隐藏 local fallback；
- resume 新增 attempt 并保留完整失败历史；
- 独立 `generation-checkpoint.json` 可在 story/project 成功但 `run.json` 最终更新丢失后恢复；
- local、record-replay、live external、local fallback 和 not-observed provenance 分账；
- 生成仍复用 Domain Pack、项目、专业文本、Seedance、图片与 preproduction canonical 服务；
- access control 在 schema 与模型调用前执行；
- 无图片 Provider、无视频生成、无真人或 production credit。

### 6.2 已完成：bounded run list 与 StoryAgentRun Web 控制台

新增列表合同与 API：

```text
GET /api/story-agent/runs
story-agent-run-list/v1
```

查询参数：

```text
limit        1..50，默认 20
cursor       opaque stable cursor
status       in_progress / awaiting_external_action / failed_retryable / ready / blocked
kind         generation_request / existing_project / existing_series
source_kind  story_project / ai_comic_series_project
```

bounded 语义：

- 只枚举 run 目录名，按稳定 `run_id` 降序游标推进；
- 单请求最多读取 250 个 `run.json`；
- 即使过滤结果为空，也返回 `scanned_count`、`has_more` 和下一游标；
- 列表只返回摘要，不携带完整 preproduction package；
- 已用 251 个 ledger 的测试证明第一个请求在 250 停止；
- 坏 ledger 或 ownership 解析失败只跳过当前项，不击穿整页。

权限：

- 列表入口先要求 `project:read`；
- access disabled 模式保留本地开发兼容；
- required 模式下，generation run 按持久化 organization/owner/member 隔离；
- project/series run 复用 canonical resource binding；
- 测试证明跨组织 owner 无法在列表看到彼此的 pre-project generation run。

Web 控制台：

```text
/story-agent/runs
```

已接入“生产”工作区，包含：

- status/kind/source 过滤和前后页游标；
- generation、story/project、professional、Seedance、image、preproduction 六段时间线；
- blocker、retryable failure、状态、当前阶段和 resume 次数；
- resume / refresh；
- 完整 image request task、prompt、task ID、预期输出路径；
- `image-generation-result/v1` JSON 导入；
- preproduction export JSON；
- provider 未调用、视频未生成、真人和 production credit 未授予的固定边界。

浏览器 smoke 使用隔离 generated root 创建真实本地 run 后验证：

```text
页面位于生产工作区
6 个持久化阶段可见
3 个图片任务可展开完整 prompt 和输出路径
ready 筛选正确进入空态且清除陈旧详情
resume_count 0 → 1
无布局溢出或遮挡
```

### 6.3 已完成：专业补证/修复 checkpoint

新增四个独立的 `workflow_checkpoints`：

```text
evidence_supplement
professional_package
canonical_repair
derived_state_rebuild
```

每个 checkpoint 持久化：

- 当前状态；
- `attempt_count` 和完整 attempts 历史；
- evidence refs；
- blocker 与 retryable failure；
- canonical 操作名、endpoint（适用时）和 resume 自动执行边界。

状态语义：

- 未完成的 `professional_evidence_missing` task → `awaiting_external_action`；
- 缺少专业包 → `failed_retryable`；
- `revision_required`、professional hard gate 或 coverage revise/rebuild → `blocked`；
- 质量未通过或专业包要求返修 → canonical repair `awaiting_external_action`；
- 派生不一致或 rebuild 校验失败 → `failed_retryable`。

恢复边界：

- run resume 自动调用新的 `rebuildProjectDerivedState(projectId)`；
- 该服务只从当前 canonical story 确定性重建专业包、GEARS delivery、supplement 和质量派生状态；
- 重建写回当前版本，不创建伪叙事版本；
- rebuild 失败不会丢失 run，而是记录错误并继续保留可读取的 preproduction 状态；
- `repairProjectQuality` 仍是显式动作，run resume 不会暗中调用模型或外部 Provider；
- 补证仍通过原 supplement task API 写回；
- 顶层 run 只编排、观察和持久化，不另写平行修复器。

浏览器控制台新增四张 checkpoint 卡片，展示状态、观察次数、首个 blocker/failure 和“显式操作边界 / resume 自动执行”。

### 6.4 已完成：不同素材视觉资产压力

新增统一机器审计合同：

```text
story-agent-visual-asset-pressure-report/v1
```

四个不同题材和视觉世界：

```text
original-mystery   → 近未来海洋悬疑
historical-ethics  → 北宋历史写实
heritage-craft     → 当代非遗工艺剧情
children-legend    → 绘本儿童传说
```

审计同时检查：

- source、style family、人物和地点标签是否跨题材有足够差异；
- 每个题材是否至少有两个不同内容 SHA，跨题材是否复用同一图片字节；
- prompt SHA、污染词、必需视觉锚点和禁用视觉锚点；
- 源文件 SHA、真实媒体签名、immutable preview 和当前 identity mapping；
- 缺图拒绝、坏图拒绝、SHA 不匹配拒绝；
- 部分成功保留、失败任务单独重试恢复、替换后 identity stale。

本轮结果：

```text
status: ready
4 cases / 4 sources / 4 styles
6 character labels / 4 location labels
18 assets / 8 unique content SHA
0 cross-case content reuse
4/4 semantic gates passed
6/6 recovery and rejection scenarios passed
```

`within_case_composite_asset_reuse:10` 仅表示同一视觉世界内部复用 composite 视觉板，保留为 warning，不掩盖跨题材复用；跨题材复用仍是 blocker。

新增 canonical API 回归证明：同一 result 中坏图任务进入 `failed_retryable` 时，已验证任务保持成功；修复坏图后只重试失败任务，attempt 历史保留。测试会显式清理临时 project/image run，避免污染 bounded MVP top-N。

固定边界仍为：

```text
machine_validation_only=true
image_provider_invoked_by_server=false
video_generation_performed=false
production_credit_granted=false
```

### 6.5 已完成：统一运行入口与参数化批次

详细报告现在固定写入：

```text
web/generated/system/story-agent-visual-asset-pressure/report.json
```

新增只读入口：

```text
GET /api/system/story-agent-visual-asset-pressure
story-agent-visual-asset-pressure-ops-status/v1
```

ops 摘要只暴露：

- 报告相对路径、文件存在性、schema 有效性和生成时间；
- case/style/hash/语义/媒体签名/identity 计数；
- required/passed/failed/not_run 场景计数；
- blockers、warnings 和固定执行边界。

它不会返回详细 `cases` 或 `scenario_results`，也不会暴露 `WEB_GENERATED_ROOT` 绝对路径。详细报告仍是唯一细节证据。

fail-closed 语义：

```text
report missing      → not_run
invalid schema/json → blocked
summary/detail drift → blocked
4 cases + 6 scenarios + all asset checks complete → ready
```

StoryAgentRun 控制台 `/story-agent/runs` 新增全局视觉压力卡片，显示题材、风格、唯一 SHA、跨题材复用、场景通过数、canonical 报告路径和 blocker，并支持单独刷新。

脚本现在支持：

```text
--manifest
--binding-report
--recovery-report
--style-map
--output
```

`story-agent-visual-asset-pressure-style-map/v1` 允许新 seed 显式声明风格；任何 seed 缺失非空 style family 时立即失败，不再靠源码中的四个固定映射静默降级。示例：

```text
web/server/scripts/story-agent-visual-asset-pressure-style-map.example.json
```

### 6.6 下一优先级：新生成视觉资产批次扩容

继续复用 canonical image-run，不建立平行图片账本：

1. 用 Codex imagegen 在服务端之外生成第二批真正不同人物、场景和视觉风格；
2. 为新批次输出 cross-seed manifest、binding report、recovery report 和显式 style map；
3. 运行参数化压力脚本，要求跨批次/跨题材字节复用仍为 0；
4. 将新批次覆盖提升到至少 8 个视觉世界，并保留缺图、坏图、hash、部分恢复、重试和 identity stale 六场景；
5. 若内置浏览器可以访问宿主机开发端口，再补 StoryAgentRun 压力卡的桌面/移动浏览器 smoke；当前只有 build/vue-tsc 证据。

## 7. 外部条件具备时才做

### 7.1 P0-E3 真实 Provider

只有存在真实凭据时才运行：

```text
real external provider
  → representative or stratified 15-type matrix
  → success / rate limit / timeout / repair failure
  → explicit live_external provenance
```

不得把以下内容写成真实 Provider 成功：

- deterministic fixture；
- record-replay；
- fake credentials；
- local fallback；
- `external_model_call_performed=false`。

### 7.2 真实 Reference Library 样本

只有用户合法提供资料并亲自确认授权声明后才运行：

- operator-submitted 四维 evidence 全通过样本；
- 明确阻断样本；
- approved analysis；
- 跨来源 benchmark；
- audited style pack；
- reference-free baseline；
- reference-assisted 同输入版本；
- machine delta/no-credit。

仓库当前没有真实 approved style pack，不要伪造。

## 8. 不要重复开发

以下能力已经完成，不要重新调查或另写平行实现：

- 15 类型 GenreStoryProfile 和 StoryBlueprint；
- professional dispatcher/evidence resolver；
- scene/GEARS/Seedance derived state；
- 普通项目、系列项目和版本持久化；
- `story-agent-seedance-preproduction-package/v1`；
- `story-agent-image-run/v1`；
- 图片 task 恢复、hash 校验和幂等；
- 15×1、15×3、P0-E2 record-replay/strict gate；
- approved style-pack prompt/trace bridge；
- reference safety 和四维相似度门禁；
- reference analysis task/evidence；
- Reference Library governance/composition/baseline UI；
- P1-B1 项目绑定 `story-agent-run/v1`；
- P1-B2 生成请求绑定 `story-agent-run/v2`、幂等冲突与 generation checkpoint；
- P1-B2 bounded run list、ownership 过滤与 StoryAgentRun Web 控制台；
- P1-B3 专业补证、专业包、canonical repair、derived-state rebuild checkpoint；
- deterministic `rebuildProjectDerivedState` 与 resume 尝试历史；
- P1-B4 `story-agent-visual-asset-pressure-report/v1` 与四题材统一审计；
- 缺图、坏图、SHA 不匹配、部分导入、单任务重试和 identity stale 的 canonical 回归；
- P1-B5 canonical visual pressure report、fail-closed ops API 与 StoryAgentRun 控制台摘要；
- 参数化 `--manifest/--binding-report/--recovery-report/--style-map/--output`；
- legacy `kb_generate_script` 的扩展。

## 9. 下一对话建议读取的文件

先读：

```text
docs/story-agent-development-handoff-20260725.md
.codex/skills/china-culture-story-agent/SKILL.md
.codex/skills/china-culture-story-agent/references/story-agent-contract.md
.codex/skills/superpowers-lite/SKILL.md

web/shared/types.ts
web/shared/schemas.ts
web/server/src/services/story-agent-run-service.ts
web/server/src/services/project-service.ts
web/server/src/routes/story-agent.ts
web/server/src/services/story-service.ts
web/server/src/services/story-agent-image-run-service.ts
web/server/src/services/story-agent-preproduction-package-service.ts
web/server/src/services/story-agent-visual-asset-pressure-service.ts
web/server/src/services/story-agent-visual-asset-pressure-ops-service.ts
web/server/scripts/story-agent-visual-asset-pressure.mts
web/server/scripts/story-agent-visual-asset-pressure-style-map.example.json
web/server/src/__tests__/api.test.ts
web/server/src/__tests__/story-agent-visual-asset-pressure-ops-service.test.ts
web/server/src/__tests__/story-agent-visual-asset-pressure-service.test.ts
web/server/src/__tests__/product-access-control.test.ts
web/server/src/__tests__/product-navigation.test.ts

web/client/src/api/story-agent-runs.ts
web/client/src/views/StoryAgentRuns.vue
web/client/src/router.ts
web/shared/product-navigation.ts

mcp-server/src/tools/story-agent-runs.ts
mcp-server/src/tools/story-agent-runs.test.ts
mcp-server/src/index.ts
```

如需历史细节再读：

```text
docs/story-agent-development-handoff-20260724.md
docs/story-agent-film-text-benchmark-development-handoff-20260723.md
```

## 10. 验证命令

先跑下一里程碑 targeted tests，不要每次修改后重复全套 CI：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web/server
npm run smoke:story-agent-visual-asset-pressure -- \
  --style-map server/scripts/story-agent-visual-asset-pressure-style-map.example.json
npx vitest run src/__tests__/story-agent-visual-asset-pressure-service.test.ts
npx vitest run src/__tests__/story-agent-visual-asset-pressure-ops-service.test.ts
npx vitest run src/__tests__/api.test.ts -t "story-agent-visual-asset-pressure"
npx vitest run src/__tests__/api.test.ts -t "Story Agent top-level run API"
npx vitest run src/__tests__/product-access-control.test.ts -t "protects model generation"
npm run lint

cd /Users/wuyu/Desktop/china-culture-kb/mcp-server
npx vitest run src/tools/story-agent-runs.test.ts
npm run build
```

完成一个里程碑后再跑：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web
npm run build
npm run lint

cd /Users/wuyu/Desktop/china-culture-kb/web/server
npm test

cd /Users/wuyu/Desktop/china-culture-kb/mcp-server
npm test
```

最后：

```bash
cd /Users/wuyu/Desktop/china-culture-kb
git diff --check
git status --short
```

## 11. 可直接复制到下一对话的启动指令

```text
请阅读：
/Users/wuyu/Desktop/china-culture-kb/docs/story-agent-development-handoff-20260725.md

继续全力开发 china-culture-kb Story Agent。

固定产品边界：
故事 → 专业脚本 → Seedance 提示词 → Codex 图片资产 → 前置制作交付包。
不要生成视频，不要推进回调、剪辑、声音、字幕或成片，不要把真人测试和 production credit 当作当前阻塞项。

当前分支应为 codex/story-agent-manifest-integrity-20260718，基线提交应包含：
f1e5f5c6 feat(story-agent): add unified project run ledger
a04ab79e feat(story-agent): start runs from generation requests
f6f07133 feat(story-agent): add bounded run console
7a47ea01 feat(story-agent): add recoverable workflow checkpoints
b24a0e43 feat(story-agent): audit diverse visual asset pressure
ac4db463 feat(story-agent): surface visual pressure ops status

P0-A 到 P0-E2、P1-A1 到 P1-A2c、Reference Library governance/composition/baseline UI、P1-B1 项目绑定 story-agent-run/v1、P1-B2 生成请求与运行控制台、P1-B3 四个专业工作流 checkpoint、P1-B4 四题材视觉资产压力审计，以及 P1-B5 canonical ops/API/控制台可发现性均已完成。不要重新实现。

若没有真实外部 Provider 凭据或用户合法参考材料，直接用 Codex imagegen 在服务端之外创建第二批真正不同素材，将覆盖扩大到至少 8 个视觉世界。为新批次提供 manifest、binding report、recovery report 和 `story-agent-visual-asset-pressure-style-map/v1`，再运行参数化压力审计。复用 canonical image-run，不建立平行图片账本。

若具备真实 Provider 凭据，只把 live external 记为真实；record-replay、fixture 和 local fallback 必须分账。若有合法参考材料，必须由用户亲自确认授权后再运行 operator evidence、approved style pack 和 baseline 对照。不得把 fixture、not_run、machine comparison 写成真人、法律或 production 通过。

完成本轮后运行 targeted tests、Web build/lint、server/MCP milestone gate，更新本交接，commit 并 push 当前分支。
```
