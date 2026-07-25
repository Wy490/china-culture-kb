# Story Agent 开发交接：P1-B2 运行控制台完成，下一步拆分专业补证与修复 checkpoint

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
> P1-B2 运行控制台提交：以本交接最终提交为准
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

Story Agent 已从“全新生成请求可直接进入 durable 顶层账本”推进到“操作者可通过 bounded 列表和 Web 控制台查看、过滤、恢复与交接完整运行”的阶段。

当前工程判断：

| 口径 | 完成度 | 判断 |
|---|---:|---|
| 展示结构化生成与前置制作交付 | 96%–98% | 普通项目、系列项目、15×1、15×3 和运行控制台均有完整交付证据 |
| 15 类型无人值守稳定交付 | 94%–97% | 本地恢复、图片幂等、严格门禁、record-replay、两类 StoryAgentRun 与 operator 控制台均已跑通 |
| 原始影视/文字参考资料自动理解 | 35%–45% | 治理、任务和门禁完整，但尚不会自动读取完整视频、小说或剧本 |

仍不能宣称 100% 完成，主要因为：

1. 顶层 run 尚未把专业补证、canonical repair 和 derived-state rebuild 分成独立可重试 checkpoint；
2. 尚未使用真实外部 Provider 凭据运行生产级矩阵；
3. 尚未使用用户合法提供的真实材料运行 operator evidence、approved style pack 和 baseline 对照；
4. 视觉压力矩阵仍主要复用 canonical 视觉板，需要更多真正不同素材。

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
  Test Files  171 passed | 1 skipped
  Tests       1467 passed | 2 skipped

MCP:
  Test Files  95 passed
  Tests       503 passed

git diff --check：通过
```

本轮新增定向与浏览器证据：

```text
Story Agent top-level run API：8 passed
Product access owner list isolation：1 passed
Product navigation：7 passed
Web browser smoke：真实本地 run、6 阶段、3 图片任务、筛选空态、resume 0→1
视觉截图：output/playwright/story-agent-run-console/console-full.png（本地忽略产物）
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
web/generated/story-agent-p0e2-reliability-matrix/reliability-report.json
```

不要把 `persistent-lifecycle-report.json` 或 `playable-media-report.json` 当作当前目标证据；它们属于后来划出 Story Agent 范围的视频/后期实验。

## 6. P1-B2 当前状态与下一步

在没有真实外部 Provider 凭据和合法参考材料时，下一对话应优先推进 P1-B3。

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

### 6.3 第一优先级：专业补证/修复 checkpoint

把以下状态提升为顶层可重试阶段：

- evidence supplement pending；
- professional package blocked；
- canonical repair pending/failed；
- derived-state rebuild pending/failed。

仍必须由原 canonical 服务执行，顶层 run 只编排和记录。

### 6.4 第四优先级：不同素材视觉资产压力

现有 15×3 主要证明恢复和幂等，还需要：

- 真正不同人物、场景和视觉风格；
- 缺图、坏图和 SHA 不匹配；
- 单图替换后的 identity stale；
- 大批量部分导入；
- 失败任务单独重试；
- 不同素材的语义一致性检查。

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
web/server/src/routes/story-agent.ts
web/server/src/services/story-service.ts
web/server/src/services/story-agent-image-run-service.ts
web/server/src/services/story-agent-preproduction-package-service.ts
web/server/src/__tests__/api.test.ts
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

先跑 P1-B3 targeted tests，不要每次修改后重复全套 CI：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web/server
npx vitest run src/__tests__/api.test.ts -t "Story Agent top-level run API"
npx vitest run src/__tests__/product-access-control.test.ts -t "protects model generation"
npm run lint

cd /Users/wuyu/Desktop/china-culture-kb/mcp-server
npx vitest run src/tools/story-agent-runs.test.ts
npm run build
```

完成一个 P1-B3 里程碑后再跑：

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

P0-A 到 P0-E2、P1-A1 到 P1-A2c、Reference Library governance/composition/baseline UI、P1-B1 项目绑定 story-agent-run/v1，以及 P1-B2 生成请求绑定 story-agent-run/v2、generation checkpoint、idempotency conflict、恢复 sidecar、bounded run list 和 StoryAgentRun Web 控制台均已完成。不要重新实现。

若没有真实外部 Provider 凭据或用户合法参考材料，直接进入 P1-B3：
把 evidence supplement pending、professional package blocked、canonical repair pending/failed、derived-state rebuild pending/failed 提升为顶层可重试 checkpoint；仍由 canonical 服务执行，顶层 run 只编排、持久化和恢复。

若具备真实 Provider 凭据，只把 live external 记为真实；record-replay、fixture 和 local fallback 必须分账。若有合法参考材料，必须由用户亲自确认授权后再运行 operator evidence、approved style pack 和 baseline 对照。不得把 fixture、not_run、machine comparison 写成真人、法律或 production 通过。

完成本轮后运行 targeted tests、Web build/lint、server/MCP milestone gate，更新本交接，commit 并 push 当前分支。
```
