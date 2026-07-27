# Story Agent 开发交接：P1-B18 registry/composition v3 descriptor provenance 完成

> 交接日期：2026-07-27
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
> P1-B6 八世界扩容提交：`4dbd4b32 feat(story-agent): expand visual pressure to eight worlds`
>
> P1-B7 批次注册表提交：`93754889 feat(story-agent): register visual pressure batches`
>
> P1-B8 响应式回归提交：`9782c924 test(story-agent): cover visual pressure viewports`
>
> P1-B9 composition provenance 提交：`a50a157f feat(story-agent): verify visual batch composition`
>
> P1-B10 provenance ops/UI 提交：`9b9ba280 feat(story-agent): surface batch provenance status`
>
> P1-B11 十二世界扩容提交：`0a73c595 feat(story-agent): expand visual pressure to twelve worlds`
>
> P1-B12 receipt 封存提交：`de86b56c feat(story-agent): seal visual asset batch receipts`
>
> P1-B13 receipt 工具通用化提交：`4d3ac1d5 feat(story-agent): generalize receipt-backed manifests`
>
> P1-B14 registry 审计提交：`1b2c298a feat(story-agent): audit visual receipt registries`
>
> P1-B15 evidence bundle 提交：`8d3ea787 feat(story-agent): package sealed receipt evidence`
>
> P1-B16 evidence descriptor 提交：`655d64e6 feat(story-agent): lock sealed evidence bundles`
>
> P1-B16 全量门禁稳定性提交：`346315b3 test(story-agent): stabilize material drafting matrix`
>
> P1-B17 artifact preflight 提交：`66215966 feat(story-agent): preflight sealed evidence artifacts`
>
> P1-B18 descriptor registry 提交：`b230ede8 feat(story-agent): register sealed evidence descriptors`
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

Story Agent 已从“不同题材视觉资产拥有统一机器审计证据”推进到“十二个视觉世界、三批输入、receipt、deterministic evidence bundle 与 committed descriptor 形成逐字节完整性链；registry/composition v3 可数据驱动发现 sealed descriptor 并把其 SHA 纳入 17/17 provenance，clean-checkout/CI 可先运行独立只读 preflight，错误 receipt、descriptor、bundle、传输漂移或文件名都会 fail-closed”的阶段。

当前工程判断：

| 口径 | 完成度 | 判断 |
|---|---:|---|
| 展示结构化生成与前置制作交付 | 98%–99% | 普通项目、系列项目、15×1、15×3、运行控制台、专业 checkpoint、十二题材视觉压力、三批 composition provenance 与 ops 摘要均有完整交付证据 |
| 15 类型无人值守稳定交付 | 96%–98% | 本地恢复、图片幂等、严格门禁、record-replay、两类 StoryAgentRun、checkpoint 历史、视觉资产六场景审计及其 fail-closed ops 读取均已跑通 |
| 原始影视/文字参考资料自动理解 | 35%–45% | 治理、任务和门禁完整，但尚不会自动读取完整视频、小说或剧本 |

仍不能宣称 100% 完成，主要因为：

1. 尚未使用真实外部 Provider 凭据运行生产级矩阵；
2. 尚未使用用户合法提供的真实材料运行 operator evidence、approved style pack 和 baseline 对照；
3. 当前 sealed batch 的本地证据已经可确定性导出、恢复和验证；外部 artifact store 的选型、上传/下载凭据与保留策略尚未由用户指定，旧两批也缺少可验证的真实历史调用记录，因此仍显式保留为 `legacy_unsealed`。

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

## 6. P1-B2 / P1-B3 / P1-B4 / P1-B5 / P1-B6 / P1-B7 / P1-B8 / P1-B9 / P1-B10 / P1-B11 当前状态与下一步

在没有真实外部 Provider 凭据和合法参考材料时，下一对话应优先为 Codex ImageGen 批次增加提交到代码仓库的 immutable receipt，阻止源图被替换后通过重跑 manifest/composition 静默重签。

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
8 cases + 6 scenarios + all asset checks complete → ready
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

### 6.6 已完成：八视觉世界 ImageGen 扩容与语义防污染

第二批在服务端之外使用 Codex 内置 ImageGen 独立生成 8 张新图，每个世界各一张人物图和一张场景图；没有引用旧图，也没有调用服务端图片 Provider：

```text
shadow-puppet-fantasy          → 陕西皮影表现主义
desert-conservation-documentary → 敦煌保护纪实
tea-mountain-social-realism    → 武夷茶山社会写实
bronze-age-mythic-animation    → 青铜青绿神话动画
```

批次流水线新增：

```text
story-agent-visual-asset-pressure-batch2-prepare.mts
  → 先创建系列、生成两集并重建 visual bible
  → 输出精确 identity catalog 和 series_project_id

story-agent-visual-asset-pressure-batch2-manifest.mts
  → 读取 ImageGen 源图与原始 prompt
  → 校验内容/prompt SHA
  → 输出 manifest 和显式 style map

story-agent-cross-seed-image-assets.mts
  → 接受 manifest 中显式 series_project_id
  → 导入 canonical image-run 并绑定现有 visual identities

story-agent-visual-asset-pressure-batch-merge.mts
  → 从批次注册表读取任意数量批次
  → 复用同一六场景 recovery report
  → 当前输出十二世界 canonical 审计输入
```

本轮同时修复了两个真实根因：

- Seedance asset report 过去把 `同行者` 等通用叙事占位符当成必须图片资产，造成 54 个伪缺图镜头；现在 visual bible 与 exporter 共用同一个 generic-character 判定，真实人物仍保持 fail-closed；
- 通用题材的开场信息、快节奏结尾和伏笔 fallback 带有“案卷 / 证词 / 死刑文书”司法模板污染；现在改为中性可见行动语言，批次准备显式使用空知识包，并把 `案卷` 写入新世界 forbidden anchor。

最终 canonical 报告：

```text
web/generated/system/story-agent-visual-asset-pressure/report.json

status: ready
8 cases / 8 sources / 8 styles
10 character labels / 8 location labels
31 manifest assets / 16 unique source content SHA
61 canonical bound assets / 72 shot bindings
0 unbound shots
0 cross-case content reuse
8/8 semantic gates passed
6/6 recovery and rejection scenarios passed
0 production credit
```

`within_case_composite_asset_reuse:15` 仍只是同一世界内多 identity 复用 world composite 的 warning。canonical ops 最低门槛已由 4 个视觉世界提升到 8 个；新增回归明确证明旧四世界报告现在 fail-closed 为 `blocked`。

证据目录：

```text
web/generated/story-agent-cross-seed-image-assets-20260725-batch2/
web/generated/story-agent-cross-seed-image-assets-20260725-eight-world/
```

固定边界保持不变：

```text
machine_validation_only=true
image_provider_invoked_by_server=false
video_generation_performed=false
production_credit_granted=false
```

### 6.7 已完成：批次注册表与桌面/移动浏览器 smoke

新增数据驱动合同：

```text
story-agent-visual-asset-pressure-batch-registry/v1
```

默认注册表：

```text
web/server/scripts/story-agent-visual-asset-pressure-batch-registry.json
```

每个批次只需声明：

```text
batch_id
manifest_path
binding_report_path
style_map_path
```

恢复场景报告在注册表顶层只声明一次。第三批及后续批次只需增加 JSON 条目，不再修改合并源码或手写旧批次风格映射。

合并服务 fail-closed 检查：

- 注册表 schema、非空批次和唯一 `batch_id`；
- 所有输入路径必须是 web root 内的相对路径；
- manifest、binding report、style map schema；
- 同批 manifest/binding 与跨批 provider/model 一致性；
- 跨批 seed 不重复；
- 每个 seed 必须有且只能使用所属批次声明的 style family；
- 汇总资产、镜头、未绑定和 production credit 计数。

旧命令继续作为兼容别名，新 canonical 命令为：

```text
npm run smoke:story-agent-visual-asset-pressure-batch-merge
```

真实两批注册表合并结果：

```text
2 batches / 8 seeds
31 manifest assets / 61 canonical bound assets
8 series / 0 unbound shots / 0 production credit
```

重新运行 canonical 审计后仍为：

```text
status: ready
8 cases / 8 sources / 8 styles
16 unique content SHA / 0 cross-case reuse
8/8 semantic gates / 6/6 recovery scenarios
```

内置浏览器真实 smoke：

```text
desktop: 1280 × 720
mobile:  390 × 844
route:   /story-agent/runs
```

两种视口均确认：

- 压力卡显示“已通过”；
- 8 个题材、8 种风格、16 个唯一内容 SHA、跨题材复用 0；
- 恢复/拒绝场景 6/6 和 canonical 相对路径；
- 自动化边界文案完整；
- 刷新审计后仍返回一致数据；
- 移动端 document/body width 均为 390px，卡片宽 358px，无横向溢出。

### 6.8 已完成：视觉压力三态 Playwright 响应式回归

新增可重复浏览器合同：

```text
web/e2e/story-agent-visual-pressure.spec.ts
npm run e2e:story-agent-visual-pressure
```

测试复用仓库已有 Playwright Web Server、访问控制 registry 和 Chromium，不建立新的 mock server。fixture 只在浏览器请求层替换：

```text
GET /api/story-agent/runs
GET /api/system/story-agent-visual-asset-pressure
```

运行列表固定为空，视觉压力摘要覆盖三态：

```text
ready   → 已通过，8 cases / 8 styles / 16 SHA / 0 reuse / 6/6 scenarios
blocked → 已阻断，8 cases / 8 styles / 15 SHA / 1 reuse / 5/6 scenarios
not_run → 未运行，0 cases / 0 styles / 0 SHA / report missing
```

每个状态都验证：

- 1280×720 桌面与 390×844 移动视口；
- 状态标签、覆盖数字、场景计数、canonical 相对路径和 blocker；
- 自动化边界文案；
- “刷新审计”确实触发第二次 API 请求且状态保持一致；
- document/body 不产生横向溢出，移动压力卡保持至少 350px 可读宽度；
- 无 page error、console error 或 API 4xx/5xx。

结果：

```text
3 Playwright tests passed
Web production build passed
server/client lint and typecheck passed
```

这些 fixture 只证明 UI 合同和响应式行为，不修改 canonical 报告，也不授予真实审计、人工或 production credit。

### 6.9 已完成：视觉批次 composition provenance

新增机器证据合同：

```text
story-agent-visual-asset-pressure-batch-composition/v1
generated/story-agent-cross-seed-image-assets-20260725-eight-world/composition-report.json
```

batch merge 现在按实际读取和写出的字节记录：

- registry 与恢复场景报告的 web-root 相对路径、SHA-256；
- 每批 manifest、binding report、style map 的相对路径、SHA-256；
- 每批 seed、manifest asset、binding asset、series 计数；
- 合并后 manifest、binding report、style map、recovery report 的相对路径、SHA-256；
- 批次数、源文件数、输出文件数和总文件数；
- machine-only、未调用图片 Provider、未生成视频、未授予 production credit 的固定边界。

所有 composition 路径必须位于 web root 内。parser 拒绝非 SHA-256、非法时间、重复 batch ID、错误 schema 和越界路径。canonical 压力审计重新读取当前 registry、所有批次输入和四个输出，验证：

- registry 批次 ID、路径和 recovery path 与 composition 一致；
- 每个当前文件的 SHA-256 与 composition 一致；
- 每批计数与当前 manifest/binding 内容一致；
- summary 计数自洽；
- canonical 审计使用的四个输出路径与 composition 一致。

缺少 composition、报告损坏、任一输入/输出被替换、路径或计数不一致时，详细报告与 ops 摘要均 fail-closed，不会继续沿用旧 `ready` 结论。

真实两批重新合并与审计结果：

```text
registry SHA-256:
caabef92ed65c21c47ad57567126acac2f28dcfe8fa9477045465db946006f87

2 batches / 8 source files / 4 merged outputs
12/12 files verified
8 cases / 8 sources / 8 styles / 16 unique content SHA
31/31 source SHA / media signature / immutable preview / identity mapping
0 cross-world content reuse
6/6 recovery scenarios
status: ready
blockers: 0
```

新增回归覆盖：

- 正常 composition 逐文件校验；
- 批次输入在 merge 后发生字节变化；
- composition 时间非法或 batch ID 重复；
- composition 批次计数被篡改；
- canonical 报告缺少或收到 stale provenance；
- ops 对 stale provenance fail-closed；
- canonical API fixture 的有界 provenance 合同。

验证结果：

```text
targeted: 4 files / 14 tests passed
server:   175 files passed, 1 skipped
          1489 tests passed, 2 skipped
server lint/typecheck passed
server build passed
```

完整服务端回归必须允许 Supertest 绑定本地测试端口；受限沙箱里的 `listen EPERM 0.0.0.0` 是执行环境限制，不是产品失败。

### 6.10 已完成：批次 provenance 有界 ops/API/UI 摘要

`story-agent-visual-asset-pressure-ops-status/v1` 新增：

```text
composition_provenance.status
composition_provenance.batch_count
composition_provenance.file_count
composition_provenance.verified_file_count
```

公开 ops 合同只携带状态与计数，不携带：

```text
report_relative_path
registry_content_sha256
逐文件 SHA
composition 详细 blockers
```

边界行为：

- canonical 报告缺失时返回 `not_run / 0 批 / 0/0 文件`；
- 报告不可读或 schema 非法时返回 `blocked / 0 批 / 0/0 文件`；
- schema 合法时复制 canonical provenance 的状态和计数；
- stale composition 继续令整体 ops 状态 fail-closed，并显示 `blocked / 3 批 / 14/15 文件`；
- 当前真实 canonical 报告已随 P1-B11 更新为 `ready + verified / 3 批 / 15/15 文件`，blocker 为空。

StoryAgentRun 压力卡新增一行：

```text
批次证据 已验证 · 3 批 · 文件 15/15
```

同一位置对 blocked/not_run 分别显示“已阻断”和“未运行”。既有题材/风格/SHA、恢复场景、canonical 相对路径、blocker、刷新按钮和自动化边界不变。

Playwright 三态 fixture 已扩展 provenance，并在 1280×720 与 390×844 两种视口验证：

- `verified / 3 批 / 15/15`；
- `blocked / 3 批 / 14/15`；
- `not_run / 0 批 / 0/0`；
- 刷新仍发起第二次 API 请求；
- 无横向溢出、page error、console error 或 API 4xx/5xx。

验证结果：

```text
ops service: 5 tests passed
ops API:     1 targeted test passed
Playwright:  3 tests passed
server:      175 files passed, 1 skipped
             1489 tests passed, 2 skipped
server/client lint and typecheck passed
Web production build passed
```

### 6.11 已完成：第三批 ImageGen 与十二视觉世界

第三批根目录：

```text
web/generated/story-agent-cross-seed-image-assets-20260726-batch3/
  identity-catalog.json
  prompts/*.txt
  sources/*.png
  manifest.json
  binding-report.json
  style-map.json
```

`web/generated/` 按仓库规则不提交 Git；项目最终资产与逐图完整提示词均保存在上述 `sources/` 和 `prompts/`。生成使用 Codex 内置 ImageGen，一图一调用，未使用 CLI/API fallback，也未由 Story Agent 服务端调用图片模型。

四个新视觉世界：

| seed | 标题 | 视觉语言 | 边界 |
|---|---|---|---|
| `tulou-rain-documentary` | 土楼听雨 | 福建土楼雨季建筑纪录 | 单楼观察不外推为所有土楼，不虚构仪式 |
| `kunqu-backstage-drama` | 水袖未落 | 江南昆曲工笔后台戏 | 具体剧团排练经验不写成统一表演规则 |
| `paper-cut-snow-fable` | 红窗追月 | 东北红白剪纸雪地童话 | 纸兔和纸森林明确为虚构，不冒充真实传说 |
| `maritime-porcelain-museum` | 瓷片归港 | 闽南海洋博物馆青晒悬疑 | 证据不足时不判年代、窑口或沉船来源 |

canonical 准备结果：

```text
4 series projects
8 generated episodes
4 character identities
4 primary costumes
16 canonical locations
8 independent ImageGen source PNGs
```

第三批 manifest/binding：

```text
12 manifest input assets
8 unique source SHA-256
28 canonical bound assets
72 shot bindings
0 unbound shots
0 production credit
status: passed
```

只向现有 registry 追加：

```text
batch_id: imagegen-20260726-batch3
```

合并代码未修改。三批重建结果：

```text
3 batches / 12 seeds
43 manifest assets / 89 canonical bound assets
12 series / 0 unbound shots / 0 production credit
```

composition 与 canonical 审计：

```text
registry SHA-256:
8efa8ae54e3ca781d1891b93d4f0b37ffcb603565f2d6e65d181019f8e7bfc61

3 batches / 11 source files / 4 merged outputs
15/15 files verified
12 cases / 12 sources / 12 styles
24 unique content SHA / 0 cross-case reuse
43/43 source SHA / media signature / immutable preview / identity mapping
6/6 recovery scenarios
status: ready
blockers: 0
```

composition JSON 不包含 `/Users/...` 绝对路径。

ops canonical 最低门槛同步提升为：

```text
case/source/style >= 12
composition batches >= 3
composition files >= 15
verified_file_count == file_count
```

旧八世界报告的红灯用例先证明它仍会被误判 `ready`，门槛提升后改为 fail-closed `blocked`。Playwright fixture 同步为 12 cases / 24 SHA / 3 批 15/15，桌面与移动三态继续通过。

验证结果：

```text
targeted services: 4 files / 17 tests passed
ops API:           1 targeted test passed
Playwright:        3 tests passed
server:            175 files passed, 1 skipped
                   1489 tests passed, 2 skipped
server/client lint and typecheck passed
Web production build passed
```

### 6.12 P1-B12 immutable batch receipt（2026-07-27）

完成提交：

```text
de86b56c feat(story-agent): seal visual asset batch receipts
```

新增提交内不可变收据：

```text
web/server/scripts/story-agent-visual-asset-pressure-batch3-receipt.json
schema_version: story-agent-visual-asset-pressure-batch-receipt/v1
batch_id: imagegen-20260726-batch3
assets: 8
```

每个 receipt asset 固定：

```text
seed_id
role = character | world
imagegen-built-in-call_* provider_asset_id
exact prompt path + prompt SHA-256
PNG source path + content SHA-256
MIME + IHDR width/height
```

`story-agent-visual-asset-pressure-batch-receipt-service.ts` 现在执行 schema、路径边界、调用 ID 唯一性、prompt/source SHA、PNG 签名和 IHDR 尺寸验证。prompt、源图内容或尺寸任一漂移都会返回 `blocked`，不允许脚本基于当前文件重算哈希并将漂移内容重新视为可信。

第三批 manifest 生成脚本已移除内嵌 `PROVIDER_ASSET_IDS` 和本地重算逻辑，改为：

```text
read committed receipt
  → parse
  → verify exact prompt/source bytes and dimensions
  → require character/world role coverage for every catalog seed
  → generate manifest only from receipt values
```

批次注册表与 composition 同步升级：

```text
story-agent-visual-asset-pressure-batch-registry/v2
story-agent-visual-asset-pressure-batch-composition/v2
```

其中：

- 2026-07-23 baseline：`legacy_unsealed`；
- 2026-07-25 batch2：`legacy_unsealed`；
- 2026-07-26 batch3：`sealed`，绑定 committed receipt；
- v1 registry 读取时只会规范化为显式 `legacy_unsealed`，不会被视为 sealed；
- sealed batch 缺 receipt、receipt SHA 不符、receipt batch ID 不符或 manifest asset 无法映射到 receipt 时，merge/composition/canonical report 均 fail-closed；
- receipt 被计入 composition SHA provenance，12-world 组合由 15 个文件提升为 16 个文件。

canonical ops 最低门槛现为：

```text
case/source/style >= 12
composition batches >= 3
sealed batches >= 1
sealed + legacy_unsealed == batch_count
composition files >= 16
verified_file_count == file_count
```

StoryAgentRun 压力卡和有界 ops API 公开：

```text
sealed_batch_count
legacy_unsealed_batch_count
file_count / verified_file_count
```

当前真实 canonical 结果：

```text
status: ready
12 cases / 12 sources / 12 style families
24 unique content SHA / 0 cross-case reuse
3 batches = 1 sealed + 2 legacy_unsealed
composition 16/16
43 manifest assets
89 binding assets
12 series
0 unbound shots
0 production credit
```

验证结果：

```text
receipt/registry/composition/pressure/ops targeted:
  5 files / 24 tests passed
Playwright:
  3 tests passed
server:
  176 files passed, 1 skipped
  1496 tests passed, 2 skipped
MCP:
  95 files / 503 tests passed
server/client lint and typecheck passed
Web and MCP production build passed
canonical ops actual status ready
```

固定边界没有变化：

- receipt 只证明机器可验证的调用标识、prompt/source bytes、尺寸和 seed/role 绑定；
- receipt 不证明素材权利、真人评审、真实外部 Provider 成功或 production credit；
- 服务端仍不调用图片供应商、不生成视频。

### 6.13 P1-B13 通用 receipt inspection/manifest 工具（2026-07-27）

完成提交：

```text
4d3ac1d5 feat(story-agent): generalize receipt-backed manifests
```

新增通用组件：

```text
web/server/src/services/story-agent-visual-asset-pressure-receipt-manifest-service.ts
web/server/scripts/story-agent-visual-asset-pressure-receipt-manifest.mts
web/server/scripts/story-agent-visual-asset-pressure-receipt-inspect.mts
```

通用 service 负责：

- 解析 `story-agent-visual-asset-pressure-batch-preparation/v1`；
- 校验 seed、duration、pacing、style、series project 和 visual identity；
- 拒绝重复 seed/identity、缺 character/costume/location、receipt 未知 seed 或缺 character/world role；
- 只从已解析 receipt 派生 manifest 的 provider ID、prompt/source path 与 SHA；
- 同时派生 style map 与有界计数。

通用 manifest CLI 强制显式传入：

```text
--catalog
--receipt
--output
--style-map-output
```

四条路径必须位于 Web root 内且互不重合。CLI 先验证 receipt 对应的 exact prompt/source bytes 和 PNG 尺寸，只有 `sealed` 才写 manifest/style-map；它没有创建或重签 receipt 的能力。

第三批兼容命令仍为：

```bash
npm run smoke:story-agent-visual-asset-pressure-batch3-manifest
```

但底层已改为通用 CLI 加显式参数。迁移前后输出字节完全一致：

```text
manifest SHA-256:
3c65e62d30ea210a92561be5ebf0238e070cef34b59b31cddd71e516ddf8b009

style-map SHA-256:
6e1d22ef91c4266257670a12ca4214e0850eb6c40fb36682c75cf97126d2edbf
```

只读 inspection：

```bash
npm run smoke:story-agent-visual-asset-pressure-receipt-inspect
```

当前输出：

```text
status: sealed
batch: imagegen-20260726-batch3
4 seeds
8/8 verified assets
4 character + 4 world
0 blockers
```

inspection 只打印有界机器验证摘要，不写文件、不调用图片供应商，也不授予 rights、人审或 production credit。

重建后 canonical 保持：

```text
ready
12 cases
3 batches = 1 sealed + 2 legacy_unsealed
composition 16/16
```

验证结果：

```text
receipt/manifest/registry/composition/pressure/ops targeted:
  6 files / 27 tests passed
server:
  177 files passed, 1 skipped
  1499 tests passed, 2 skipped
server/client lint and typecheck passed
Web production build passed
```

### 6.14 P1-B14 registry-level 只读 receipt audit（2026-07-27）

完成提交：

```text
1b2c298a feat(story-agent): audit visual receipt registries
```

新增：

```text
web/server/src/services/story-agent-visual-asset-pressure-receipt-registry-audit-service.ts
web/server/scripts/story-agent-visual-asset-pressure-receipt-registry-audit.mts
web/server/src/__tests__/story-agent-visual-asset-pressure-receipt-registry-audit-service.test.ts
```

运行：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web/server
npm run smoke:story-agent-visual-asset-pressure-receipt-registry-audit
```

审计行为：

```text
read registry v1/v2
  → normalize v1 as legacy_unsealed
  → enumerate every batch
  → skip verification only for explicit legacy_unsealed
  → read and verify every declared sealed receipt
  → check receipt batch_id
  → verify exact prompt/source SHA and PNG dimensions
  → emit bounded batch/count summary
```

输出不包含逐图 prompt/source path、SHA 或 provider call ID；receipt 原始 blocker 会被收敛为有界错误码。它明确声明：

```text
machine_validation_only=true
image_provider_invoked_by_server=false
merged_outputs_generated=false
video_generation_performed=false
production_credit_granted=false
```

真实 registry 审计结果：

```text
status: verified
3 batches
1 sealed / 1 verified sealed
2 legacy_unsealed
8 receipt assets / 8 verified
0 blockers
```

每批结果：

```text
imagegen-20260723-baseline: legacy_unsealed / not_applicable
imagegen-20260725-batch2:   legacy_unsealed / not_applicable
imagegen-20260726-batch3:   sealed / 8/8
```

测试覆盖：

- sealed + legacy 混合注册表；
- prompt/source 漂移 fail-closed；
- receipt batch ID 不匹配；
- registry schema 非法；
- bounded 输出不泄露 prompt path 或 SHA 字段。

验证结果：

```text
receipt/manifest/registry/composition/pressure/ops targeted:
  7 files / 30 tests passed
server:
  178 files passed, 1 skipped
  1502 tests passed, 2 skipped
server lint/typecheck passed
server production build passed
canonical remains ready / 12 cases / 1 sealed + 2 legacy / 16/16
```

注意：`web/generated/` 不提交 Git，clean-checkout CI 若没有恢复对应 evidence artifact，会按设计 fail-closed；当前命令是已有 evidence workspace 的只读 preflight，不得用缺失文件的 CI 结果声称 receipt 无效或重新创建 receipt。

### 6.15 P1-B15 sealed evidence bundle 导出/恢复（2026-07-27）

完成提交：

```text
8d3ea787 feat(story-agent): package sealed receipt evidence
```

新增合同：

```text
story-agent-visual-asset-pressure-receipt-evidence-bundle/v1
```

实现文件：

```text
web/server/src/services/story-agent-visual-asset-pressure-receipt-evidence-bundle-service.ts
web/server/scripts/story-agent-visual-asset-pressure-receipt-evidence-export.mts
web/server/scripts/story-agent-visual-asset-pressure-receipt-evidence-restore.mts
web/server/src/__tests__/story-agent-visual-asset-pressure-receipt-evidence-bundle-service.test.ts
```

bundle 是确定性 JSON + canonical base64，包含 receipt 引用的 exact prompt/source bytes，并固定：

```text
batch_id
receipt_content_sha256
relative_path
prompt/source kind
media_type
content_sha256
byte_length
base64 bytes
bounded summary
```

不含 `generated_at`，相同 receipt 与 evidence bytes 会生成完全相同的 bundle 字节。解析门槛：

```text
files <= 256
each file <= 16 MiB
total decoded bytes <= 128 MiB
canonical base64 only
unique safe relative paths
summary counts exact
all SHA/length values recomputed
```

导出：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web/server
npm run smoke:story-agent-visual-asset-pressure-receipt-evidence-export
```

导出前先验证 committed receipt、prompt/source SHA 和 PNG 尺寸；输出只允许位于 `web/generated`。若目标已存在且字节一致，返回 `verified_existing`；若不同则拒绝覆盖。

真实 batch3 bundle：

```text
output:
web/generated/story-agent-visual-asset-pressure-evidence/
  imagegen-20260726-batch3-receipt-evidence-bundle.json

bundle SHA-256:
324c954603d26d692b2d14e46607f81e0ecaa3835d661ec2942168978abf3eb2

bundle bytes: 28,474,649
decoded evidence bytes: 21,351,766
16 files = 8 prompts + 8 PNG sources
```

第二次真实导出返回 `verified_existing`，SHA 未变化。

恢复：

```bash
npm run smoke:story-agent-visual-asset-pressure-receipt-evidence-restore
```

恢复门禁：

- bundle 必须绑定当前 committed receipt 的 exact bytes SHA；
- bundle 文件集合、kind、media type、SHA 必须与 receipt 完全一致；
- 目标现有文件只有内容 SHA 完全相同时才作为 `verified_existing`；
- 任一现有文件冲突时，在写入任何 peer 前整体 `blocked`；
- 新文件使用 `wx`，绝不覆盖；中途失败只回滚本次新建文件；
- 拒绝目标路径中的 symbolic link；
- 恢复后重新运行 receipt hash/PNG dimension verification；
- restore bundle 文件读取上限为 180 MiB。

真实 workspace 恢复结果：

```text
status: verified_existing
16 files
0 restored
16 existing
0 blockers
```

隔离临时 Web root 测试已证明：

```text
clean evidence workspace
  → restore 4/4 fixture files
  → receipt sealed
  → registry audit verified
  → second restore verified_existing
```

同时覆盖 bundle tamper、receipt SHA 不匹配、operator-owned 冲突文件和零部分恢复。

固定边界：

```text
rights_granted=false
human_review_performed=false
external_artifact_uploaded=false
external_artifact_download_verified_by_transport=false
image_provider_invoked_by_server=false
video_generation_performed=false
production_credit_granted=false
```

真实 bundle 位于 gitignored `web/generated`，本轮没有上传任何外部 artifact store。

验证结果：

```text
receipt/bundle/manifest/registry/composition/pressure/ops targeted:
  8 files / 33 tests passed
server:
  179 files passed, 1 skipped
  1505 tests passed, 2 skipped
server lint/typecheck passed
server production build passed
canonical remains ready / 12 cases / 1 sealed + 2 legacy / 16/16
```

### 6.16 P1-B16 committed evidence bundle descriptor（2026-07-27）

功能提交：

```text
655d64e6 feat(story-agent): lock sealed evidence bundles
```

全量门禁稳定性提交：

```text
346315b3 test(story-agent): stabilize material drafting matrix
```

新增 committed descriptor：

```text
web/server/scripts/
  story-agent-visual-asset-pressure-batch3-evidence-bundle-descriptor.json

schema:
story-agent-visual-asset-pressure-receipt-evidence-descriptor/v1
```

descriptor 固定以下事实：

```text
batch_id:
imagegen-20260726-batch3

receipt SHA-256:
cd274225063cba197da0057d4befb22b6e3b7f79c6de19c5e8e3daaf9a008d73

bundle file name:
imagegen-20260726-batch3-receipt-evidence-bundle.json

bundle SHA-256:
324c954603d26d692b2d14e46607f81e0ecaa3835d661ec2942168978abf3eb2

bundle bytes:
28,474,649

files:
16 = 8 prompts + 8 PNG sources

decoded evidence bytes:
21,351,766
```

新增：

```text
web/server/src/services/
  story-agent-visual-asset-pressure-receipt-evidence-descriptor-service.ts

web/server/src/__tests__/
  story-agent-visual-asset-pressure-receipt-evidence-descriptor-service.test.ts
```

验证器不只比较 descriptor 字段，还会重新解析 committed receipt 与 bundle，并逐项验证：

- receipt exact bytes SHA；
- bundle exact bytes SHA 和字节数；
- receipt、bundle、descriptor 三方 batch ID；
- bundle 内嵌 receipt SHA；
- bundle schema；
- 文件总数、prompt/source 分类计数和 decoded evidence 总字节数；
- descriptor 的 portable basename；
- 固定机器边界全部为严格布尔值。

导出与恢复 CLI 均新增：

```text
--descriptor
```

默认读取 committed batch3 descriptor。导出在创建/校验目标 bundle 前验证 descriptor；恢复在写入任何 evidence 文件前验证 descriptor。即使内容字节正确，bundle 路径 basename 与 descriptor 不同也会拒绝，防止 clean-checkout CI 选错 artifact。

真实闭环结果：

```text
export:
  status=verified_existing
  descriptor_status=verified
  output_sha256=324c954603d26d692b2d14e46607f81e0ecaa3835d661ec2942168978abf3eb2
  output_byte_length=28474649

restore:
  descriptor_status=verified
  status=verified_existing
  file_count=16
  restored_file_count=0
  existing_file_count=16
  blockers=[]

registry audit:
  status=verified
  1 sealed + 2 legacy_unsealed
  sealed assets=8/8 verified
```

测试同时覆盖 exact match、bundle 传输字节漂移、receipt 字节漂移、URL 形态文件名和越权 boundary 声明。

全量门禁中发现 `project-service` 的 28 案例素材草拟矩阵贴近默认 5 秒上限，并且单文件运行依赖前序测试预热 production pack。现已先从真实仓库显式加载 8 类 pack，再切换临时 KB root，并为该大矩阵设置 20 秒专属上限。该测试单独运行与全量运行均通过。

验证结果：

```text
descriptor + bundle:
  2 files / 6 tests passed
receipt/bundle/descriptor/manifest/registry/composition/pressure/ops targeted:
  9 files / 36 tests passed
project material drafting matrix standalone:
  1 passed / 71 filtered
server:
  180 files passed, 1 skipped
  1508 tests passed, 2 skipped
server lint/typecheck passed
server production build passed
canonical remains ready / 12 cases / 1 sealed + 2 legacy / 16/16
```

固定边界：

```text
machine_validation_only=true
external_location_declared=false
rights_granted=false
human_review_performed=false
video_generation_performed=false
production_credit_granted=false
```

descriptor 不含 URL、凭据、rights 授权、人审结论或 production credit。本轮没有上传外部 artifact。

### 6.17 P1-B17 独立只读 evidence artifact preflight（2026-07-27）

功能提交：

```text
66215966 feat(story-agent): preflight sealed evidence artifacts
```

新增服务与 CLI：

```text
web/server/src/services/
  story-agent-visual-asset-pressure-receipt-evidence-preflight-service.ts

web/server/scripts/
  story-agent-visual-asset-pressure-receipt-evidence-preflight.mts

schema:
story-agent-visual-asset-pressure-receipt-evidence-preflight/v1
```

运行：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web/server
npm run smoke:story-agent-visual-asset-pressure-receipt-evidence-preflight
```

也可为 clean-checkout/CI 显式传入下载后的 bundle：

```bash
npm run smoke:story-agent-visual-asset-pressure-receipt-evidence-preflight -- \
  --descriptor server/scripts/story-agent-visual-asset-pressure-batch3-evidence-bundle-descriptor.json \
  --receipt server/scripts/story-agent-visual-asset-pressure-batch3-receipt.json \
  --bundle /downloaded/path/imagegen-20260726-batch3-receipt-evidence-bundle.json
```

约束：

```text
descriptor <= 128 KiB
receipt <= 4 MiB
bundle <= 180 MiB
descriptor and receipt must remain beneath web root
bundle may come from an external CI download directory
preflight writes zero evidence files
```

preflight 复用 P1-B16 exact-byte 验证，并额外把实际 artifact basename 纳入门禁。成功输出：

```text
status=verified
batch_id=imagegen-20260726-batch3
bundle SHA-256=324c954603d26d692b2d14e46607f81e0ecaa3835d661ec2942168978abf3eb2
bundle bytes=28,474,649
file_count=16
artifact_bytes_verified=true
evidence_files_written=false
blockers=[]
```

CLI 层还使用相同的真实 28.47 MB bundle 做了错名演练：仅把文件复制到不同 basename、不修改任何字节，preflight 仍以退出码 1 和以下稳定 blocker 拒绝：

```text
preflight_bundle_file_name_mismatch
```

对应临时测试文件已删除。单元测试同时覆盖 exact match、错名和尾随换行字节漂移。

验证结果：

```text
descriptor + preflight:
  2 files / 6 tests passed
receipt/bundle/descriptor/preflight/manifest/registry/composition/pressure/ops targeted:
  10 files / 39 tests passed
server:
  181 files passed, 1 skipped
  1511 tests passed, 2 skipped
server lint/typecheck passed
server production build passed
```

固定边界：

```text
artifact_bytes_verified=true only for the exact descriptor contract
external_location_declared=false
external_artifact_download_verified_by_transport=false
rights_granted=false
human_review_performed=false
video_generation_performed=false
production_credit_granted=false
```

`artifact_bytes_verified` 只表示当前读取到的字节与 committed descriptor 完全一致，不表示外部下载传输、来源合法性、rights、人审或 production credit 已通过。

### 6.18 P1-B18 registry/composition v3 descriptor provenance（2026-07-27）

功能提交：

```text
b230ede8 feat(story-agent): register sealed evidence descriptors
```

批次注册表升级为：

```text
story-agent-visual-asset-pressure-batch-registry/v3
```

新 v3 规则：

- `sealed` 批次必须同时声明 `receipt_path` 与 `evidence_descriptor_path`；
- `legacy_unsealed` 批次两者都不得声明；
- v1/v2 注册表仍可读取并规范化，但旧 sealed 记录不会凭空获得 descriptor；
- descriptor 路径必须是 Web root 内的安全相对路径；
- batch ID 仍必须唯一。

batch3 当前登记：

```text
receipt_path:
server/scripts/story-agent-visual-asset-pressure-batch3-receipt.json

evidence_descriptor_path:
server/scripts/story-agent-visual-asset-pressure-batch3-evidence-bundle-descriptor.json
```

composition 升级为：

```text
story-agent-visual-asset-pressure-batch-composition/v3
```

merge 在生成任何合并输出前会：

1. 验证 sealed receipt 的 prompt/source SHA 与 PNG 尺寸；
2. 解析 committed descriptor；
3. 验证 descriptor batch ID；
4. 验证 descriptor 绑定 receipt exact bytes SHA；
5. 把 descriptor 文件自身的相对路径和 SHA 写入 composition provenance。

composition verifier 会重新读取 descriptor，验证其文件 SHA、结构、batch ID 与 receipt SHA 绑定。即使攻击者同时重签 composition 中的 descriptor 文件 SHA，只要 descriptor 指向了不同 receipt，仍会以稳定 blocker 拒绝：

```text
composition_descriptor_receipt_sha256_mismatch:<batch_id>
```

真实十二世界 merge：

```text
batch_count=3
seed_count=12
manifest_asset_count=43
binding_asset_count=89
series_count=12
unbound_shot_count=0
production_credit_count=0
composition_file_count=17
```

真实 canonical：

```text
status=ready
case_count=12
semantic_gate_passed_case_count=12
composition_provenance.status=verified
batch_count=3
sealed_batch_count=1
legacy_unsealed_batch_count=2
file_count=17
verified_file_count=17
blockers=[]
```

P1-B17 preflight 现在默认读取 registry，并以：

```text
--registry
--batch-id
```

发现 sealed batch 的 receipt/descriptor；显式 `--receipt` 或 `--descriptor` 若与 registry 不同会拒绝。bundle 仍可通过 `--bundle` 来自任意 CI 下载目录，但必须满足 descriptor 的 exact bytes 与 basename。

真实 registry-driven preflight：

```text
status=verified
registry_path=server/scripts/story-agent-visual-asset-pressure-batch-registry.json
batch_id=imagegen-20260726-batch3
artifact_bytes_verified=true
evidence_files_written=false
```

receipt registry audit 也已在 v3 真实注册表上复跑：

```text
status=verified
1 sealed + 2 legacy_unsealed
sealed assets=8/8 verified
```

验证结果：

```text
registry/composition/preflight targeted:
  3 files / 15 tests passed
receipt/bundle/descriptor/preflight/manifest/registry/composition/pressure/ops targeted:
  10 files / 41 tests passed
server:
  181 files passed, 1 skipped
  1513 tests passed, 2 skipped
server lint/typecheck passed
server production build passed
canonical ready / 12 cases / 1 sealed + 2 legacy / 17/17
```

固定边界未改变：

```text
image_provider_invoked_by_server=false
external_location_declared=false
external_artifact_download_verified_by_transport=false
rights_granted=false
human_review_performed=false
video_generation_performed=false
production_credit_granted=false
```

### 6.19 下一优先级

P1-B12 至 P1-B18 已把单个真实 sealed batch 的本地封存、确定性打包、提交态锁定、注册表发现、composition provenance、只读 preflight 和安全恢复闭环做完。真实 artifact store 接入需要用户先指定存储后端、凭据注入方式与保留策略；在此之前，不应自行创建伪远端或把本地 bundle 描述成已归档。

外部条件未具备前必须保持：

1. 不自行选择或写入 artifact store URL，不请求、记录或提交凭据；
2. 不把本地 ignored bundle 描述成已远端归档或已验证下载传输；
3. 只有能从真实历史调用记录恢复完整 call ID、exact prompt、source bytes 和尺寸时才为旧两批补 receipt，否则继续显式保留 `legacy_unsealed`；
4. receipt、bundle、descriptor、composition 和 preflight 都只证明机器完整性，不代表 rights、人审或 production credit。

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
- P1-B6 第二批四世界 ImageGen 源图、精确 identity catalog 与八世界合并审计；
- generic visual character 共享判定、54 个伪缺图根因修复与通用题材司法模板防污染；
- canonical ops 十二世界/三批最低门槛与 legacy 八世界 fail-closed 回归；
- P1-B7 `story-agent-visual-asset-pressure-batch-registry/v1` 与数据驱动多批次合并；
- StoryAgentRun 压力卡 1280×720 桌面、390×844 移动和刷新交互 smoke；
- P1-B8 `ready/blocked/not_run` 三态 Playwright 双视口回归与 API/console 错误守卫；
- P1-B9 `story-agent-visual-asset-pressure-batch-composition/v1`、12/12 文件 SHA provenance 与 canonical/ops fail-closed 校验；
- P1-B10 ops/API 的有界 composition provenance 状态计数、StoryAgentRun 压力卡展示与三态双视口回归；
- P1-B11 第三批四世界、8 张内置 ImageGen 源图、十二世界合并审计与 3 批 15/15 provenance；
- P1-B12 committed immutable batch receipt、registry/composition v2、第三批 sealed 与旧批次 `legacy_unsealed`、3 批 16/16 provenance；
- P1-B13 通用 receipt-backed manifest builder、必填路径 CLI、只读 receipt inspection 与 batch3 零字节漂移迁移；
- P1-B14 registry-level bounded receipt audit、sealed 全量验证与 legacy 显式枚举；
- P1-B15 deterministic sealed evidence bundle、receipt SHA 锁定、安全幂等恢复与零覆盖；
- P1-B16 committed evidence bundle descriptor、receipt/bundle exact-byte 锁定与导出/恢复写盘前 fail-closed；
- P1-B17 独立只读 artifact preflight、外部下载目录参数化输入、exact-byte/错名阻断与零 evidence 写入；
- P1-B18 registry/composition v3、sealed descriptor 数据驱动发现、descriptor SHA/receipt 绑定与 17/17 provenance；
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
web/server/src/services/ai-comic-series-service.ts
web/server/src/services/ai-comic-series-visual-bible-service.ts
web/server/src/services/story-agent-visual-asset-pressure-service.ts
web/server/src/services/story-agent-visual-asset-pressure-ops-service.ts
web/server/src/services/story-agent-visual-asset-pressure-batch-receipt-service.ts
web/server/src/services/story-agent-visual-asset-pressure-receipt-manifest-service.ts
web/server/src/services/story-agent-visual-asset-pressure-receipt-registry-audit-service.ts
web/server/src/services/story-agent-visual-asset-pressure-receipt-evidence-bundle-service.ts
web/server/src/services/story-agent-visual-asset-pressure-receipt-evidence-descriptor-service.ts
web/server/src/services/story-agent-visual-asset-pressure-receipt-evidence-preflight-service.ts
web/server/src/services/story-agent-visual-asset-pressure-batch-registry-service.ts
web/server/scripts/story-agent-cross-seed-image-assets.mts
web/server/scripts/story-agent-visual-asset-pressure-batch2-prepare.mts
web/server/scripts/story-agent-visual-asset-pressure-batch2-manifest.mts
web/server/scripts/story-agent-visual-asset-pressure-batch3-prepare.mts
web/server/scripts/story-agent-visual-asset-pressure-receipt-manifest.mts
web/server/scripts/story-agent-visual-asset-pressure-receipt-inspect.mts
web/server/scripts/story-agent-visual-asset-pressure-receipt-registry-audit.mts
web/server/scripts/story-agent-visual-asset-pressure-receipt-evidence-export.mts
web/server/scripts/story-agent-visual-asset-pressure-receipt-evidence-preflight.mts
web/server/scripts/story-agent-visual-asset-pressure-receipt-evidence-restore.mts
web/server/scripts/story-agent-visual-asset-pressure-batch3-receipt.json
web/server/scripts/story-agent-visual-asset-pressure-batch3-evidence-bundle-descriptor.json
web/server/scripts/story-agent-visual-asset-pressure-batch-registry.json
web/server/scripts/story-agent-visual-asset-pressure-batch-merge.mts
web/server/scripts/story-agent-visual-asset-pressure.mts
web/server/scripts/story-agent-visual-asset-pressure-style-map.example.json
web/server/src/__tests__/ai-comic-series-visual-bible.test.ts
web/server/src/__tests__/outline-service.test.ts
web/server/src/__tests__/story-agent-visual-asset-pressure-batch-registry-service.test.ts
web/server/src/__tests__/story-agent-visual-asset-pressure-batch-receipt-service.test.ts
web/server/src/__tests__/story-agent-visual-asset-pressure-receipt-manifest-service.test.ts
web/server/src/__tests__/story-agent-visual-asset-pressure-receipt-registry-audit-service.test.ts
web/server/src/__tests__/story-agent-visual-asset-pressure-receipt-evidence-bundle-service.test.ts
web/server/src/__tests__/story-agent-visual-asset-pressure-receipt-evidence-descriptor-service.test.ts
web/server/src/__tests__/story-agent-visual-asset-pressure-receipt-evidence-preflight-service.test.ts
web/server/src/__tests__/story-agent-visual-asset-pressure-composition-service.test.ts
web/server/src/__tests__/api.test.ts
web/server/src/__tests__/story-agent-visual-asset-pressure-ops-service.test.ts
web/server/src/__tests__/story-agent-visual-asset-pressure-service.test.ts
web/server/src/__tests__/product-access-control.test.ts
web/server/src/__tests__/product-navigation.test.ts

web/client/src/api/story-agent-runs.ts
web/client/src/views/StoryAgentRuns.vue
web/client/src/router.ts
web/shared/product-navigation.ts
web/e2e/story-agent-visual-pressure.spec.ts
web/playwright.config.ts

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
npm run smoke:story-agent-visual-asset-pressure-batch2-prepare
npm run smoke:story-agent-visual-asset-pressure-batch2-manifest
npm run smoke:story-agent-cross-seed-images -- \
  --manifest generated/story-agent-cross-seed-image-assets-20260725-batch2/manifest.json \
  --output generated/story-agent-cross-seed-image-assets-20260725-batch2/binding-report.json
npm run smoke:story-agent-visual-asset-pressure-batch3-prepare
npm run smoke:story-agent-visual-asset-pressure-batch3-manifest
npm run smoke:story-agent-cross-seed-images -- \
  --manifest generated/story-agent-cross-seed-image-assets-20260726-batch3/manifest.json \
  --output generated/story-agent-cross-seed-image-assets-20260726-batch3/binding-report.json
npm run smoke:story-agent-visual-asset-pressure-batch-merge
npm run smoke:story-agent-visual-asset-pressure-receipt-evidence-export
npm run smoke:story-agent-visual-asset-pressure-receipt-evidence-preflight
npm run smoke:story-agent-visual-asset-pressure-receipt-evidence-restore
npm run smoke:story-agent-visual-asset-pressure-receipt-registry-audit
npm run smoke:story-agent-visual-asset-pressure -- \
  --manifest generated/story-agent-cross-seed-image-assets-20260725-eight-world/manifest.json \
  --binding-report generated/story-agent-cross-seed-image-assets-20260725-eight-world/binding-report.json \
  --recovery-report generated/story-agent-cross-seed-image-assets-20260725-eight-world/image-recovery-report.json \
  --style-map generated/story-agent-cross-seed-image-assets-20260725-eight-world/style-map.json \
  --composition-report generated/story-agent-cross-seed-image-assets-20260725-eight-world/composition-report.json
npx vitest run src/__tests__/ai-comic-series-visual-bible.test.ts
npx vitest run src/__tests__/outline-service.test.ts -t "generic fast-hook"
npx vitest run src/__tests__/story-agent-visual-asset-pressure-batch-registry-service.test.ts
npx vitest run src/__tests__/story-agent-visual-asset-pressure-receipt-evidence-descriptor-service.test.ts
npx vitest run src/__tests__/story-agent-visual-asset-pressure-receipt-evidence-preflight-service.test.ts
npx vitest run src/__tests__/story-agent-visual-asset-pressure-composition-service.test.ts
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
npm run e2e:story-agent-visual-pressure
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
4dbd4b32 feat(story-agent): expand visual pressure to eight worlds
93754889 feat(story-agent): register visual pressure batches
9782c924 test(story-agent): cover visual pressure viewports
a50a157f feat(story-agent): verify visual batch composition
9b9ba280 feat(story-agent): surface batch provenance status
0a73c595 feat(story-agent): expand visual pressure to twelve worlds
de86b56c feat(story-agent): seal visual asset batch receipts
4d3ac1d5 feat(story-agent): generalize receipt-backed manifests
1b2c298a feat(story-agent): audit visual receipt registries
8d3ea787 feat(story-agent): package sealed receipt evidence
655d64e6 feat(story-agent): lock sealed evidence bundles
346315b3 test(story-agent): stabilize material drafting matrix
66215966 feat(story-agent): preflight sealed evidence artifacts
b230ede8 feat(story-agent): register sealed evidence descriptors

P0-A 到 P0-E2、P1-A1 到 P1-A2c、Reference Library governance/composition/baseline UI、P1-B1 项目绑定 story-agent-run/v1、P1-B2 生成请求与运行控制台、P1-B3 四个专业工作流 checkpoint、P1-B4 四题材视觉资产压力审计、P1-B5 canonical ops/API/控制台可发现性、P1-B6 八视觉世界 ImageGen 扩容与通用题材语义防污染、P1-B7 数据驱动批次注册表和响应式浏览器 smoke、P1-B8 三态 Playwright 双视口回归、P1-B9 视觉批次 composition provenance 与 canonical/ops fail-closed 校验、P1-B10 有界 provenance ops/UI 展示、P1-B11 第三批四世界/十二世界合并审计、P1-B12 committed immutable receipt / sealed batch gate、P1-B13 通用 receipt-backed manifest/inspection 工具、P1-B14 registry-level 只读 receipt audit、P1-B15 deterministic evidence bundle/restore、P1-B16 committed evidence descriptor / 写盘前 exact-byte 校验、P1-B17 独立只读 artifact preflight，以及 P1-B18 registry/composition v3 descriptor provenance 均已完成。不要重新实现。

下一步真实 artifact store 上传/下载需用户选择后端并授权凭据注入与保留策略。旧批次只有能恢复真实完整证据时才补 receipt，否则继续保留 `legacy_unsealed`。receipt/bundle/descriptor/composition/preflight 仍不代表 rights、人审或 production credit。

若具备真实 Provider 凭据，只把 live external 记为真实；record-replay、fixture 和 local fallback 必须分账。若有合法参考材料，必须由用户亲自确认授权后再运行 operator evidence、approved style pack 和 baseline 对照。不得把 fixture、not_run、machine comparison 写成真人、法律或 production 通过。

完成本轮后运行 targeted tests、Web build/lint、server/MCP milestone gate，更新本交接，commit 并 push 当前分支。
```
