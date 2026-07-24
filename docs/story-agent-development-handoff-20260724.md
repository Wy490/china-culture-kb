# Story Agent 当前成果、差距分析与下一对话开发交接

> 日期：2026-07-24
> 仓库：`/Users/wuyu/Desktop/china-culture-kb`
> 分支：`codex/story-agent-manifest-integrity-20260718`
> P0-E2 功能基线提交：`5bd406b9 feat(story-agent): enforce strict generation policies`
> P1-A1 功能基线提交：`226e5e34 feat(story-agent): bridge approved reference styles`
> P1-A2a 功能基线提交：`903f5592 feat(story-agent): gate referenced story outputs`
> P1-A2b 功能基线提交：`adc54a49 feat(story-agent): verify authorized reference similarity`
> 上一份研究与长周期开发记录：`docs/story-agent-film-text-benchmark-development-handoff-20260723.md`

## 0. 下一对话先读这里

用户要解决的产品不是自动生成成片，而是：

```text
用户要求 / 知识条目 / 原作材料
  → 各类型故事
  → 专业脚本
  → 可直接交给 Seedance 的逐镜提示词
  → Codex 生成并绑定的图片资产
  → 一键前置制作交付包
```

Story Agent 到图片资产交付为止。真实影片由用户在 Seedance 中完成。

以下事项不是当前目标，也不得重新变成阻塞项：

- 视频 Provider 调用与真实视频生成；
- 视频回调、剪辑、配音、口型、字幕、片头和最终成片；
- 真人测试、真人盲评、真人媒体审核；
- rights approval 和 production credit。

权利、真人审核和 production credit 可以继续保留严格语义，但只作为未来正式商用提醒，不能阻塞当前功能测试。

## 1. 当前完成度结论

### 1.1 简短判断

当前系统已经具备较完整的结构化 Story Agent 内核，并且 AI 漫剧系列的“故事—脚本镜头—Seedance 提示词—真实图片—逐镜引用—交付包”已经跑通。

15×1 canonical、15×3 本地稳定性/恢复矩阵和 P0-E2 外部 command adapter record-replay 可靠性矩阵均已跑通。P0-E2 对 15 类完成了故事、专业脚本、Seedance 提示词、图片绑定和前置制作包的同等级全链路验收，并证明资料缺失、资料冲突、外部超时和无效输出会在严格策略下硬失败。P1-A1 已将 approved/audited Reference Library style pack 接入 canonical 外部 prompt，并形成 source/analysis/benchmark/style-pack 全链路 trace。P1-A2a 已在最终输出持久化前和 derived-state rebuild 接入机器可读引用安全报告与 fail-closed 门禁。P1-A2b 进一步完成合法用户证据 manifest、四维相似度检测、显式同输入 baseline 对照和 preproduction 独立验收。P1-A2c 已补上 `reference-analysis-task/v1` 的 Codex/operator 任务账本与幂等 evidence 提交入口。当前最大问题已经转为真实外部 Provider 凭据验收、真实 operator evidence / baseline 样本运行、Reference Library UI、不同素材视觉资产压力，以及更高层统一 StoryAgentRun。

可用两个口径理解当前距离：

| 口径 | 主观完成度 | 判断 |
|---|---:|---|
| 展示结构化生成与前置制作交付 | 94%–97% | 普通项目、系列项目、15×1 和本地 15×3 类型矩阵均有真实图片与统一交付证据 |
| 全部 15 类型无人值守稳定交付 | 91%–94% | 本地 15×3、图片恢复、资料严格门禁和外部 record-replay 矩阵全绿；仍缺真实外部 Provider 验收和统一顶层 run |

这个百分比是工程判断，不是测试自动计算值。后续应以第 6 节的退出条件替代主观百分比。

### 1.2 当前状态矩阵

| 用户所需能力 | 当前状态 | 已有证据 | 主要不足 |
|---|---|---|---|
| 15 类结构化故事 | 本地 15×3 + 外部 record-replay 已通过 | 45/45 本地唯一项目；外部 command adapter 15/15 合约项目 ready | record-replay 不等于真实外部 Provider；仍需凭据化实跑 |
| 15 类专业脚本 | canonical 接入完成 | 15/15 dispatcher、evidence resolver、generation/project version 派生状态矩阵 | 纪录片真实采访/授权仍会正确转为补证任务 |
| 连续分集故事 | 较强 | 20 集正式系列；4 个系列共 14 集稳定复跑 | 主要集中在 `ai_comic_drama` 系列形态 |
| Seedance 提示词 | 本地 15×3 + 外部 record-replay 已通过 | 本地 45/45；外部 record-replay 15/15 prompt ready | 仍需真实外部 Provider 路径 |
| 图片资产 | 15×3 可恢复闭环已完成 | 15 张已验证 canonical 视觉板明确复用于 30 个同源变体；69/69 任务 verified；部分导入后续跑通过 | 仍需缺图/替换失败压力与不同素材视觉资产 |
| 一键交付包 | 本地与外部 record-replay 均全绿 | 本地 45/45、record-replay 15/15 ready，共用 `story-agent-seedance-preproduction-package/v1` | 仍需真实外部 Provider 与顶层 StoryAgentRun |
| 版本与持久化 | 图片阶段已闭环 | story snapshot、project/version、series project、asset history、`story-agent-image-run/v1` | 缺少跨故事/脚本/图片/交付包的更高层统一 StoryAgentRun |
| 机器质量与修复 | 已有多层门禁 | genre、premise fidelity、commercial machine gate、repair | 专业脚本管线的自动选择、补证、修复和 derived-state 重建尚未统一 |
| 影视/文字 benchmark | P1-A1 + P1-A2b 已完成工程闭环 | approved style pack 逐次重验 provenance；不可变合法 evidence；文本/角色/情节/镜头门禁；显式 baseline 对照；preproduction 独立结论 | 仍缺真实 operator evidence / baseline 样本和自动原始资料分析任务；fixture 不计真实验证 |

## 2. 已完成工作总结

### 2.1 Story Agent 结构化生成链

当前 canonical 生成链已经具备：

```text
Knowledge entry / user material
  → StoryBlueprint
  → full_text
  → scene_breakdown
  → gears_segments
  → quality report
  → repair
  → project/version storage
```

核心能力包括：

- 15 个 `VideoType` 的 GenreStoryProfile；
- 类型 promise、必需字段、禁用表达、场景功能和修复规则；
- `StoryBlueprint`；
- 本地故事引擎与外部 command adapter；
- `full_text`、`scene_breakdown`、`gears_segments`、GEARS delivery；
- 类型质量报告、修复链和持久化；
- Web canonical API 与 MCP `kb_story_agent_generate` 桥接。

15 类类型：

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

### 2.2 专业文本包基础设施

仓库已有 15 类 `ProfessionalTextPackage` 合同与对应管线，统一包结构包含：

- creative brief；
- research/evidence dossier；
- audience promise；
- premise/theme；
- truth/adaptation contract；
- structure outline；
- sequence beats；
- scene breakdown；
- final full text；
- dialogue/narration pass；
- director text plan；
- continuity ledger；
- delivery text package；
- quality report；
- coverage report；
- revision plan。

这些管线现已由统一 dispatcher 和 evidence resolver 自动选择，并通过 derived-state rebuild 默认挂接到 `/api/stories/generate`、项目初始版本、后续修复版本和 MCP/Web canonical 输出。缺少不可推断的外部证据时会返回结构化 supplement task。

### 2.3 连续系列与质量

已有两组重要证据：

1. 《皮影诡戏：守灯人》
   - 20/20 集；
   - 180 镜头；
   - 系列质量 100；
   - 20 集连续性账本；
   - 14 个真实图片身份。

2. 四个跨题材持久项目
   - 《潮汐失忆局》：3 集 / 27 镜头；
   - 《告身不署》：4 集 / 36 镜头；
   - 《一线醒狮》：5 集 / 45 镜头；
   - 《白鹿送药记》：2 集 / 18 镜头。

四项目合计：

```text
14 episodes
126 shots
4 pacing profiles
2 truth modes
0 blocking continuity conflicts
0 unbound shots
```

### 2.4 图片资产闭环

已经完成的图片能力：

- Codex imagegen / `gpt-image-2` 生成真实 PNG；
- Provider、model、provider asset ID；
- prompt SHA-256；
- 内容 SHA-256；
- 不可变本地原件与预览；
- 角色、服装、地点、道具四类身份；
- visual bible identity binding；
- 图片复用与 stale mapping 检查；
- 逐镜所需图片与 `@图片` 引用槽；
- 幂等复跑，不重复创建已成功项目。

当前四项目的最新权威图片证据：

```text
web/generated/story-agent-cross-seed-image-assets-20260723/binding-report.json
```

关键结果：

```text
34 delivered image assets
126 bound shots
0 unbound shots
production credit = 0
human review required = false
```

15×1 普通项目最新权威图片证据：

```text
web/generated/story-agent-15-type-preproduction-matrix/matrix-report.json
web/generated/story-agent-15-type-preproduction-matrix/image-import-report.json
```

关键结果：

```text
15 persistent projects
15 Codex imagegen visual boards
23 required image tasks verified
77 shots covered
15/15 image runs ready
15/15 preproduction packages ready
23/23 repeat imports skipped idempotently
0 hidden fallbacks
0 server-side image provider calls
```

### 2.5 Story Agent → Seedance 前置制作包

canonical 实现接口：

```text
POST /api/story-agent/preproduction/export
```

Schema：

```text
story-agent-seedance-preproduction-package/v1
```

`story_id`、普通 `project_id` 和 `series_project_id` 共用合同；旧系列接口继续保留为兼容入口。

单包包含：

- 每集完整故事正文；
- logline、主题、`scene_breakdown`、`gears_segments`；
- 每镜头剧本动作/对白；
- visual prompt、camera suggestion；
- 可复制的 Seedance 提示词；
- 图片本地路径、SHA-256、Provider；
- 图片稳定身份；
- 逐镜图片资产 ID、引用槽和缺口；
- 机器 acceptance；
- 明确的产品边界。

可重复运行：

```bash
cd web
npm run smoke:story-agent-seedance-preproduction
```

最新结果：

```text
status: passed
projects: 4
episodes: 14
script / prompt shots: 126
delivered immutable image assets: 34
required shot identity mappings: 26/26
unbound shots: 0
video generation in scope: false
human test required: false
```

权威报告：

```text
web/generated/story-agent-cross-seed-image-assets-20260723/seedance-preproduction-report.json
```

完整交付包：

```text
web/generated/story-agent-cross-seed-image-assets-20260723/seedance-preproduction-packages/
```

### 2.6 当前自动化基线

截至 P1-A2b 合法证据、多维门禁与 baseline 对照工作树：

```text
服务端全量：170 files passed，1 skipped
测试：1451 passed，2 skipped
server source/scripts TypeScript：通过
server tsup production build：通过
MCP 全量：93 files / 495 tests passed
通用前置制作烟测：4 projects / 14 episodes / 126 shots / 34 images / 0 unbound
15×1 正式矩阵：15 projects / 77 shots / 23 required images / 15 ready packages
图片导入幂等复跑：23/23 skipped idempotently
P0-E2 record-replay：15/15 projects / professional scripts / prompts / images / preproduction ready
P0-E2 strict gates：missing / conflict / invalid output / timeout 全部 blocked
P0-E2 provenance：15/15 fixture truthfully labeled，0 real external provider calls
P1-A1/A2 focused：approved-only / compatibility / provenance drift / immutable evidence / prompt exclusion / 四维相似度 / baseline compatibility+delta / final-output block / derived-state revalidation / preproduction boundary
```

## 3. 距离用户目标的真实不足

### 3.1 P0-A：15 类专业脚本已进入统一 canonical 生成链

已完成：

- 15/15 `VideoType` 唯一分派；
- knowledge/material/blueprint/scenes 自动解析专业 evidence；
- 缺证据返回 `professional_evidence_missing` supplement task；
- derived-state rebuild 同步重建 professional package、GEARS 与后续 Seedance 输入；
- 初始项目版本和后续版本都绑定正确 story/project identity；
- MCP `kb_story_agent_generate` 与 Web canonical generation 共用结果。

### 3.2 P0-B：通用一键前置制作包已完成

已新增通用 schema：

```text
story-agent-seedance-preproduction-package/v1
```

canonical 输入同时支持：

```text
story_id
project_id
series_project_id
```

输出统一包含 story、professional script、Seedance prompt、image assets、shot bindings、acceptance 和 boundary。

已实现：

- `web/server/src/services/story-agent-preproduction-package-service.ts`
- `POST /api/story-agent/preproduction/export`
- MCP `kb_export_story_agent_preproduction`
- 普通 story、普通 project 和 AI 漫剧 series 使用同一 schema；
- 逐镜只计算 required image slots，不把音频或可选图片误算为阻塞；
- 图片必须同时通过本地路径约束、真实文件读取、SHA-256 复算和当前镜头映射；
- 文件被篡改后 fail closed，从交付包剔除；
- professional package、逐镜脚本、提示词或图片映射不完整时 acceptance 为 blocked；
- 视频生成、真人测试、rights/human review 和 production credit 边界保持不变。

### 3.3 P0-C：图片生成已成为 Agent 可恢复步骤

真实图片仍由 Codex imagegen 生成，服务器不直接调用 Provider。现在执行方式已由人工脚本升级为 canonical 握手：

```text
Story Agent 输出稳定 request manifest
  → Codex 调用 imagegen 并写入 run/outputs
  → Codex 返回 result manifest
  → Story Agent 校验路径、prompt hash、内容 hash
  → 幂等导入普通/系列资产库
  → 刷新 preproduction acceptance
```

已实现合同：

```text
image-generation-request/v1
image-generation-result/v1
story-agent-image-run/v1
```

运行状态包括：

```text
planned
awaiting_imagegen
generated
ingested
bound
verified
failed_retryable
blocked
```

已保留：

- prompt；
- Provider/model/call ID；
- target asset / series identity / source story / scene / shot references；
- content/prompt hash；
- attempt/retry history；
- 可重复执行和断点续跑。

canonical Web/MCP 操作面：

```text
POST /api/story-agent/image-runs/export-request
GET  /api/story-agent/image-runs/:runId
POST /api/story-agent/image-runs/:runId/import-result

kb_export_story_agent_image_request
kb_import_story_agent_image_result
```

run 文件位于：

```text
web/generated/story-agent-image-runs/<run_id>/
  request.json
  result.json
  run.json
  outputs/
```

直接 `story_id` 没有持久资产库，因此图片 run 明确要求 `project_id` 或 `series_project_id`。

### 3.4 P0-D：15×1 端到端稳定性矩阵已完成

已实现：

- 15 类各一个 canonical 持久项目；
- 15/15 story、professional package、Seedance prompt package；
- 15 个稳定 image request/result/run；
- 15 张内置 imagegen 真实视觉板；
- 23 个逐镜必需图片任务全部 verified；
- 77 个镜头所属的 15 个 preproduction package 全部 ready；
- 重复准备复用 15/15 项目和 run；
- 重复导入 23/23 任务按内容 hash 幂等跳过；
- `STORY_GEN_LOCAL_ONLY=1` 是显式模式，0 hidden fallback；
- 服务器始终 `provider_invoked=false`。

实现文件：

```text
web/server/src/services/story-agent-15-type-matrix-service.ts
web/server/src/services/story-agent-image-run-service.ts
web/server/scripts/story-agent-15-type-preproduction-matrix.mts
web/server/scripts/story-agent-15-type-image-import.mts
web/server/src/__tests__/story-agent-15-type-matrix-service.test.ts
```

本轮还修复了一个状态机缺陷：普通项目图片请求此前把 image asset job plan 中的可选候选也导出为必需任务，导致部分项目 preproduction 已 ready 但 run 无法 complete。现在请求只包含逐镜 `required && modality=image` 的资产，并从当前 run summary 计算 pending。

P0-D 本身仍然是每类一个代表输入；P0-E1 已在其上补齐每类三个本地输入。下一目标矩阵应为：

```text
15 video types
× 3 representative inputs per type
× local engine + configured external model path
× fictional_original / source_adaptation where applicable
```

每个项目必须通过：

```text
story
professional_text_package
quality + repair
scene / shot script
Seedance prompts
real image assets
image bindings
preproduction export
repeat-run idempotency
```

### 3.5 P0-E1：15×3 本地稳定性和图片恢复已完成

已实现：

- 15 类 × 3 个代表输入，共 45 个唯一项目和 image run；
- canonical 1 分钟、扩展 3 分钟、改编 3 分钟或知识型 30 秒压力输入；
- 5 个适合改编的剧情类型走 `adapt_user_novel`，10 个非改编压力样例走 30 秒知识压缩；
- request fingerprint 防止不同输入错误复用旧项目；
- 通用图片导入器支持指定 `task_ids` 的部分成功导入；
- 先导入 1 个任务、保留 2 个 pending，再续跑全部 69 个任务；
- 第三次导入 69/69 按内容 hash 幂等跳过；
- 45/45 story、professional script、prompt、image、preproduction ready；
- 45/45 项目 ID 和 image run ID 复跑稳定；
- 0 hidden fallback，0 server image provider calls。

正式结果：

```text
types / variants / cases: 15 / 3 / 45
unique projects / image runs: 45 / 45
shots: 351
image tasks: 69/69 verified
preproduction packages: 45/45 ready
adaptation / compact cases: 5 / 10
partial recovery: 1 verified, 2 pending, then resumed to ready
repeat import idempotency: 69/69 skipped
canonical visual boards: 15
truthfully reused variant boards: 30
new image generation in P0-E1: 0
```

图片复用是明确的工程策略，不应写成新生成：三个变体使用同一类型、同一知识条目和同一中心事件，因此复用 P0-D 已验证的 15 张视觉板来压力测试绑定、恢复和交付状态机；不同原作/条目素材的视觉差异仍属于后续压力项。

实现与证据：

```text
web/server/src/services/story-agent-15x3-stability-service.ts
web/server/src/__tests__/story-agent-15x3-stability-service.test.ts
web/server/scripts/story-agent-15x3-stability-matrix.mts
web/server/scripts/story-agent-15x3-image-recovery.mts
web/generated/story-agent-15x3-stability-matrix/matrix-report.json
web/generated/story-agent-15x3-stability-matrix/image-recovery-report.json
web/generated/story-agent-15x3-stability-matrix/image-idempotency-report.json
```

本轮还修复了 social short 时长合同漂移：专业门禁不再硬编码 60–90 秒，而是按创意简报的 30 秒、1 分钟、3 分钟等目标校验；evidence resolver 同步生成匹配目标的节拍时间码。原有“1 分钟请求却只有 45 秒”的失败基准仍然失败。

### 3.6 P0-E2：外部 record-replay 与严格策略门禁已完成

已新增两个显式请求策略：

```text
generation_fallback_policy:
  allow_local_fallback | forbid_local_fallback

material_readiness_policy:
  allow_draft_with_risks | require_script_ready
```

Web schema、canonical service 和 MCP `kb_story_agent_generate` 均传递同一合同。

严格资料策略会在生成前检查 `material_sufficiency_report`。缺少核心资料时返回 `blocked`，存在未裁定冲突时返回 `needs_input`，并以 `story-material-readiness-gate/v1` 提供阻塞项、冲突 need ID 和建议问题。严格 fallback 策略在外部 adapter 超时、输出无效或未形成被接受的外部结果时，以 `story-generation-fallback-gate/v1` 硬失败，不会持久化本地 fallback 项目。

P0-E2 正式矩阵结果：

```text
video types: 15/15
record-replay pipeline acceptance: 15/15
truthful record-replay provenance: 15/15
story / professional script / prompt / image / preproduction ready: 15/15
required image tasks: 23/23 verified
repeat image imports: 23/23 skipped idempotently
stable project IDs / image run IDs: true / true
missing material / conflict / invalid output / timeout: all blocked
hidden fallback: 0
```

实现与证据：

```text
web/server/src/__tests__/story-generation-strict-policies.test.ts
web/server/scripts/story-agent-p0e2-reliability-matrix.mts
web/generated/story-agent-p0e2-reliability-matrix/reliability-report.json
```

证据边界必须保持真实：矩阵通过 command adapter 执行确定性 record-replay fixture，只证明外部 adapter 合同和下游派生状态兼容；持久故事明确记录 `model_execution_evidence=record_replay_fixture`、`external_model_call_performed=false`。报告明确给出 `real_external_provider_invoked=false`，因此 P0-E2 不能作为真实 Claude/OpenAI/其他外部 Provider 的生产成功证明。

仍需增加：

- 使用真实凭据和真实网络 Provider 的 15 类或分层代表矩阵；
- 部分字段但可修复输出、repair 失败和 Provider 限流压力；
- 真实 Provider 的成本、速率限制和可重复性审计。

### 3.7 P1-A1 + P1-A2b：approved reference 已进入生成、合法证据门禁、对照与预生产验收

这项工作的准确状态是：

| 子能力 | 状态 | 说明 |
|---|---|---|
| 参考来源登记 | 已完成 | 支持 film、episode、promo、tutorial、novel、screenplay；保存 URL、创作者、访问时间、权利和访问范围 |
| 影视结构化分析合同 | 已完成 | hook timecode、sequence beats、shot observations、调度、灯光、声音、连续性方法 |
| 小说/剧本结构化分析合同 | 已完成 | source units、人物欲望、场景 objective/opposition/turn、visible action、subtext、压缩方案和改编风险 |
| 防照抄与治理 | 已完成 | `reusable_principles`、`avoid_copying`、来源 ID、分析 ID、批准审计、禁止知识写回和 production credit |
| 多参考组合 | 已完成 | 至少两个不同来源可组合 benchmark card，再组合 audited style pack |
| 原子持久化与 API | 已完成 | reference、analysis、benchmark、style pack 均有 schema、服务、路由和回归测试 |
| 从 URL/视频/小说自动提取分析 | 未完成 | 当前 API 接收已经结构化的 analysis JSON，不会自己看完整视频、读取剧本或自动产生时间码分析 |
| Reference Library UI | 未完成 | 目前主要是服务端 API，没有可用的完整录入、审核和组合工作台 |
| audited style pack 接入生成 | P1-A1 已完成 | canonical preparation 逐次读取 `references/creative/library/style-packs/`，只接受 approved、compatible 且 provenance 完整的 style pack |
| 生成可追溯性 | P1-A1 已完成 | `reference_trace` 记录 source/analysis/benchmark/style-pack ID、requested/applied rules、avoid-copying 和 application status |
| 参考质量与相似性门禁 | P1-A2b 已完成工程闭环 | `reference-similarity-evidence/v1` 绑定权利、来源 fingerprint 与 payload hash；最终输出和 rebuild 执行文本、角色设计、情节结构、镜头序列检查；支持显式同输入 baseline 对照 |
| 预生产引用验收 | P1-A2b 已完成 | `story-agent-seedance-preproduction-package/v1` 独立输出 `acceptance.reference_safety`；blocked 报告阻断，缺失/未完整真实验证保持 non-blocking/no-credit |

因此，如果把“结构化参考理解层”拆成“资料治理”和“真正驱动生成”两部分：

```text
资料登记、分析 schema、benchmark 组合与治理：约 75%–85%
自动理解原始资料并稳定影响故事生成：约 35%–45%
整体可用度：约 55%–65%
```

这些比例是工程判断。它目前是一个可靠的**参考资料管理与组合底座**，还不是完整的**自动参考理解与生成控制层**。

当前已有自动化证据证明：

```text
approved audited style pack
  → generation prompt package
  → abstract reusable principles + avoid_copying
  → external prompt injection
  → source/analysis/benchmark/style-pack reference_trace
```

`reference-generation-bridge-service.ts` 会在每次生成前重新读取并验证 style pack、benchmark、analysis 和 source 绑定；未知 ID、不兼容类型/表现/结构、批准 provenance 漂移均返回 `story-reference-style-pack-gate/v1`，不会静默忽略。

真实边界：

- 外部 adapter 只标记 `external_prompt_injected`，不声称已经证明模型输出受影响；
- 本地引擎和 local fallback 分别标记 `local_engine_not_applied` / `local_fallback_not_applied`，`applied_rules=[]`；
- 旧 `references/creative/style-packs/` 未经 Reference Library 批准审计，不再仅凭任意 ID 冒充已应用；
- prompt 只包含抽象原则、ID 和防照抄边界，不包含参考正文、URL、独特台词或镜头原文；
- 服务器仍不会擅自下载或读取完整受版权保护作品。

P1-A2a 已完成：

1. `reference-quality-service` 在自动修复和 consumer finalization 之后、持久化之前运行；
2. `reference_trace` 新增来源 rights/access-scope/fingerprint 元数据，报告输出 avoid-copying、provenance、应用状态和相似度各维状态；
3. 未授权“改编自”、禁用仿写表达、缺失 provenance、缺失 avoid-copying 约束会返回 `REFERENCE_SAFETY_VALIDATION_FAILED`，不会创建 Story/Project；
4. derived-state rebuild 会复验同一门禁，避免后续修订绕过；
5. professional package 的 authorization/evaluator/delivery notes 会携带引用结论，preproduction 通过专业文本包继承；
6. 合法调用方显式提供参考原句时，长句精确复制和高字符重叠可阻断。

P1-A2b 已完成：

1. 新增 `reference-similarity-evidence/v1`：只接受 `user_owned`、`licensed` 或 `public_domain` 且非 metadata-only 的来源，绑定 source fingerprint、authorization attestation 和不可变 payload SHA-256；
2. evidence 支持 excerpt、character profile、plot beats、shot sequence 四类观察；创建、读取和生成前均重验 fingerprint/hash/provenance；
3. 原始观察内容与生成 prompt 隔离；prompt/trace 只携带 evidence ID、来源 ID、hash、provenance 和维度；
4. 四维检测均有明确阈值，命中会 fail closed；维度未提供时保持 `not_run` / `partially_completed`，不会授予通过信用；
5. 新增显式 `reference_baseline_story_id`：baseline 必须已持久化、未应用参考风格，并与当前请求的来源、原始输入、类型、表现、结构和模型一致；
6. baseline 对照输出 `story-reference-baseline-quality-delta/v1`，展示共同机器质量维度及 aggregate delta；不会自动额外调用外部模型；
7. preproduction acceptance 独立输出引用安全状态、报告覆盖、完整/真实相似度计数、blockers/warnings 和 no-credit 边界。

真实边界：

- Reference Library 仍不擅自保存或下载来源正文；只有用户/操作者合法提交的结构化 evidence 才能运行相应维度；
- `authorization.machine_verified=false`，系统验证的是声明、来源绑定和数据完整性，不冒充法律权利核验；
- fixture 可以验证算法和合同，但 `real_similarity_check_completed=false`；只有 operator-submitted evidence 且四维完成才标记真实计算完成；
- baseline 必须由调用方先生成并显式提供 ID；系统不会为了对照悄悄增加一次可能付费的外部调用；
- baseline delta 是机器指标比较，`machine_comparison_only=true`、`comparison_credit_granted=false`；
- record-replay fixture 只验证调用合同与门禁，不算真实 Provider 或真实相似度证据。

P1-A2c 当前进展：

1. 用真实 operator-submitted 合法 evidence 跑至少一组全维通过与一组阻断样本；
2. 用真实外部 Provider 对同一输入先生成 reference-free baseline，再生成 reference-assisted 版本并记录 delta；
3. [x] 新增 `reference-analysis-task-service.ts` 与 `reference-analysis-task/v1`，让 Codex/operator 按 source-bound manifest 提交结构化观察；
4. 建设 Reference Library 的录入、审核、evidence 与对照 UI。

Analysis Task 已有边界：

- 创建时重验 source rights、access scope、content fingerprint 与 authorization basis；
- manifest 明确 `server_download_allowed=false`、`source_material_transport=out_of_band_user_authorized`；
- task 只保存 submission/observations SHA-256 和 evidence 引用，不复制观察正文；
- submission 固定为 `operator_submitted`，必须精确覆盖请求维度；
- 相同 submission key + observations 可幂等重放；不同提交返回 conflict；
- processing 状态可恢复，evidence 反向记录 `analysis_task_id`，任务完成后保存 evidence ID/hash；
- fixture、授权声明与机器完整性验证仍不授予人工或 production credit。

### 3.8 P1：缺少面向 Agent 的统一 run 与 MCP 操作面

当前能力分散在：

- stories API；
- projects API；
- outline/AI comic series API；
- professional pipeline services；
- Codex imagegen；
- 多个 smoke scripts；
- MCP canonical story tool 和 legacy script tool。

需要一个统一 `StoryAgentRun`：

```text
run_id
input_contract
video_type
story_id / project_id / series_project_id
current_stage
stage_results
blockers
retryable_failures
image_request_manifest
preproduction_package
created_at / updated_at
```

建议 API/MCP：

```text
POST /api/story-agent/runs
GET  /api/story-agent/runs/:runId
POST /api/story-agent/runs/:runId/resume
POST /api/story-agent/runs/:runId/import-images
GET  /api/story-agent/runs/:runId/export

kb_start_story_agent_run
kb_get_story_agent_run
kb_resume_story_agent_run
kb_import_story_agent_images
kb_export_story_agent_preproduction
```

不要继续扩展 legacy `kb_generate_script`；应让它继续明确指向 canonical 工具或最终废弃。

### 3.9 P1：现有机器质量分仍需要更强外部校准

当前 genre、premise fidelity、commercial machine gate 能抓住结构缺陷，并已真实暴露多项 bug；但它们仍主要是本项目规则对本项目输出的检查。

在不做真人测试的前提下，可以增强：

- 多模型独立 judge，且 judge 不读取生成器内部评分；
- 改写前后盲对比；
- 事实 claim 与 evidence ID 对齐；
- 跨项目模板相似度；
- 角色声音和镜头重复度；
- Seedance prompt 的可见性、动作密度、物理可拍性；
- 图片与视觉身份的机器语义对齐；
- 固定 benchmark corpus 上的版本回归。

这属于质量增强，不应阻塞 P0 统一工作流。

## 4. 下一阶段开发顺序

### 4.1 P0-A：统一专业脚本 dispatcher（2026-07-24 已完成）

优先实现，因为它决定“故事”和“专业脚本”是否真正成为一个 Agent。

建议文件：

```text
web/server/src/services/professional-text-dispatch-service.ts
web/server/src/services/professional-evidence-resolver-service.ts
web/server/src/__tests__/professional-text-dispatch-service.test.ts
```

验收：

- 15/15 类型自动选择正确管线；
- 无需测试代码手工组装 evidence；
- 缺素材返回 supplement tasks；
- `professional_text_package` 写入 StoryGenerateResult 和项目版本；
- repair 后 scenes、delivery units、Seedance prompts 不陈旧。

当前实现：

```text
professional-evidence-resolver-service.ts
  → 从 material_pack / knowledge_pack / StoryBlueprint / scenes 解析 research 与类型 evidence
professional-text-dispatch-service.ts
  → 15/15 VideoType 唯一分派到现有专业管线
derived-story-state-service.ts
  → 每次 canonical derived-state 重建时重建 professional_text_package
project-service.ts
  → 初始版本和后续版本都绑定 story_id / project_id
```

缺可核验事实时会返回 `professional_evidence_missing` 类型的结构化补充任务；纪录片不会自动声称采访或授权已确认。15 类型本地 canonical 生成矩阵中，除纪录片真实采访授权这一外部证据门禁外，机器可完成的专业硬门槛为 0。

### 4.2 P0-B：通用前置制作包

状态：已完成。

实现文件：

```text
web/server/src/services/story-agent-preproduction-package-service.ts
web/server/src/routes/story-agent.ts
web/shared/types.ts
web/shared/schemas.ts
```

已验收：

- 普通 story project 和 series project 使用同一个外部 schema；
- 包含 professional script；
- 每个镜头都有 prompt 和图片引用；
- 视频生成、真人测试始终为 false；
- 只输出真正有文件、hash 和当前映射的图片。

新增证据：

- 普通项目 blocked 合同测试；
- 普通项目全专业文本 + 全真实图片时 ready 测试；
- 图片文件被篡改后 SHA fail-closed 测试；
- AI 漫剧系列同 schema 与不可变图片测试；
- Web 路由精确一来源校验；
- MCP canonical bridge fail-closed 测试。

### 4.3 P0-C：Codex 图片任务 manifest 与断点续跑

状态：已完成。

实现产物：

```text
image-generation-request/v1
image-generation-result/v1
story-agent-image-run/v1
```

已验收：

- request 具有稳定 run/task ID、prompt hash、目标资产和预期输出路径；
- 服务端 `provider_invoked=false`，只由 Codex 执行 imagegen；
- result 只允许导入 run `outputs/` 内文件，并复算 SHA-256；
- 普通项目和 AI 漫剧系列共用导出/导入合同；
- 中断可只提交未完成项，已成功同 hash 结果幂等跳过；
- 即使资产已写入而 run ledger 尚未落盘，恢复时也按资产内容 hash 复用，不重复追加上传历史；
- 不同 hash 替换图片会触发系列 identity mapping `stale`；
- 每次导入后自动刷新通用 preproduction acceptance；
- Web API 和 MCP 都只桥接 canonical application service；
- MCP 不直接写资产库，也不调用图片或视频 Provider。

核心文件：

```text
web/server/src/services/story-agent-image-run-service.ts
web/server/src/routes/story-agent.ts
web/shared/types.ts
web/shared/schemas.ts
mcp-server/src/tools/story-agent-image-runs.ts
```

### 4.4 P0-D：15×1 全链路矩阵（2026-07-24 已完成）

为 15 类各建立一个持久或可归档测试项目。

第一轮目标：

```text
15 stories
15 professional text packages
15 Seedance prompt packages
15 image request/result manifests
15 preproduction packages
0 missing stories
0 missing scripts
0 empty prompts
0 required image gaps
0 hidden fallbacks
```

图片不必每类大量生成；应按类型采用最小充分资产：

- 人物/历史/传说/儿童/AI 漫剧：角色、服装、地点、关键道具；
- 文化/非遗/城市宣传：工艺、地点、物件、品牌空间；
- 纪录/科普/讲授/培训：事实图、流程图、场景或演示资产；
- 场景/山水：空间、时间层、光线与连续氛围参考。

最新结果：

```text
status: ready
types / stories / projects: 15 / 15 / 15
professional packages: 15
shots: 77
image request/result/run manifests: 15 / 15 / 15
real visual boards: 15
required image tasks: 23/23 verified
preproduction packages: 15/15 ready
hidden fallbacks: 0
server image provider calls: 0
repeat import idempotency: 23/23 skipped
```

正式复跑：

```bash
cd web
npm run smoke:story-agent-15-type-preproduction
npm run smoke:story-agent-15-type-import-images
```

### 4.5 P0-E：15×3 稳定性、恢复与严格外部合约

本地输入和图片恢复子阶段已完成：

- [x] 不同输入长度；
- [x] 不同目标时长；
- [x] 原创与素材改编；
- [x] imagegen 中断、部分导入与恢复；
- [x] 重复导出与幂等；
- [x] 资料充分、资料不足与资料冲突；
- [x] 外部模型 record-replay 成功、超时、无效输出；
- [x] fallback-forbidden 的正式全链路门禁；

正式复跑：

```bash
cd web
npm run smoke:story-agent-15x3-stability
npm run smoke:story-agent-15x3-image-recovery
npm run smoke:story-agent-p0e2-reliability
```

P0-E3 仍需扩展：

- 真实外部 Provider 成功、限流和修复失败；
- 用不同原作/条目素材验证视觉资产差异，不再复用同源 canonical 视觉板；
- 在凭据可用时形成可归档的真实 Provider 报告；
- 继续禁止把 fixture 或本地 fallback 算成真实外部成功。

当前 P0-E2 汇总报告已给出每类：

```text
story_status
professional_script_status
prompt_status
image_status
preproduction_status
fallback_status
repeat_run_status
```

### 4.6 P1-A：完成 Reference Intelligence 生成闭环（A1 + A2a 已完成）

在 P0-A 到 P0-D 跑通后，立即补这条质量链：

```text
reference source
  → Codex / operator structured analysis
  → approved analysis
  → benchmark card
  → audited style pack
  → canonical prompt package
  → StoryBlueprint constraints
  → generated story / professional script
  → reference_trace
  → similarity and avoid-copying report
```

P1-A1 已新增：

```text
web/server/src/services/reference-generation-bridge-service.ts
web/server/src/__tests__/reference-generation-bridge.test.ts
```

关键实现点：

1. [x] 桥接 `references/creative/library/style-packs/` 与 canonical generation；
2. [x] 只接受 approved/audited 且 compatible 的 style pack；
3. [x] 只注入抽象原则，不把来源正文、独特台词或镜头序列塞进 prompt；
4. [x] 将 source/analysis/benchmark/style-pack ID 写入 `reference_trace`；
5. [x] 参考层失败时以 `story-reference-style-pack-gate/v1` 硬失败；
6. [x] `reference-quality-service` 在最终输出与 derived-state rebuild 检查 `avoid_copying`、provenance、未授权改编/仿写，并对显式合法原句检查长句复制；
7. [x] 输出机器可读报告，并把 `not_run` / no-credit 边界传入 professional package；
8. [x] 支持显式同输入、同类型/结构/模型的 baseline 与 reference-assisted 机器质量对照；
9. [x] 完成合法不可变 evidence manifest 与角色/情节/镜头序列相似度；
10. [x] 新增 `reference-analysis-task-service.ts`，让 Codex/operator 可按 manifest 幂等提交结构化观察。

原始视频、小说和剧本不应由服务器擅自下载。可以像图片生成一样建立 Codex 可执行的分析任务 manifest：Codex 通过用户有权访问的文件或页面完成观察，再提交符合 schema 的结构化分析结果。

## 5. 不要继续做的工作

以下已有历史代码或证据，但不属于当前开发方向：

- `story-agent-persistent-lifecycle-smoke` 的视频、声音和后期扩展；
- `playable-media-report.json`；
- mocked 视频回调和真实视频 Provider 替换；
- 剪辑、配音、字幕、片头和 release；
- 真人媒体审核扩展；
- production credit 补齐。

这些可以保留，不需要删除；只是不应作为下一阶段优先级，也不应计入 Story Agent 是否完成。

## 6. 用户需求的最终退出条件

只有全部满足，才能说当前 Agent 真正实现用户要求：

1. 15/15 类型均可从用户输入或知识条目生成完整故事；
2. 15/15 类型均自动生成相应专业脚本包；
3. 每个故事的脚本、scene、GEARS、Seedance derived state 一致；
4. 每个项目自动输出图片生成 request manifest；
5. Codex 能按 manifest 生成、导入、绑定、断点续跑图片；
6. 每个逐镜必需图片身份都有真实文件、hash 和当前映射；
7. 每个项目能一键导出 Story Agent → Seedance 前置制作包；
8. 15×1 全链路矩阵全绿；
9. 15×3 稳定性矩阵全绿；
10. 重复运行不会重复创建项目、图片或破坏版本；
11. 外部模型请求不允许隐藏 fallback；
12. 配置真实外部 Provider 时，能留下与 fixture 分离的凭据化验收证据；
13. 视频生成与真人测试始终不参与当前 acceptance。

## 7. 下一对话建议先执行

### 7.1 先确认仓库

```bash
cd /Users/wuyu/Desktop/china-culture-kb
git status --short --branch
git log -5 --oneline
```

预期：

```text
branch: codex/story-agent-manifest-integrity-20260718
history includes: 5bd406b9 feat(story-agent): enforce strict generation policies
```

### 7.2 先读这些文件

```text
docs/story-agent-development-handoff-20260724.md
.codex/skills/china-culture-story-agent/SKILL.md
.codex/skills/china-culture-story-agent/references/story-agent-contract.md
.codex/skills/gears-seedance-delivery/SKILL.md
.codex/skills/gears-seedance-delivery/references/gears-seedance-contract.md

web/shared/types.ts
web/shared/schemas.ts
web/server/src/services/story-service.ts
web/server/src/services/story-generation-model.ts
web/server/src/services/story-generation-prompt.ts
web/server/src/services/genre-story-profiles.ts
web/server/src/services/professional-text-contracts.ts
web/server/src/services/professional-*-pipeline-service.ts
web/server/src/services/ai-comic-series-service.ts
web/server/src/services/story-agent-preproduction-package-service.ts
web/server/src/services/story-agent-image-run-service.ts
web/server/scripts/story-agent-seedance-preproduction-smoke.mts
mcp-server/src/tools/story-agent-generate.ts
mcp-server/src/tools/export-story-agent-preproduction.ts
mcp-server/src/tools/story-agent-image-runs.ts
mcp-server/src/tools/generate-script.ts
```

### 7.3 从 P0-E3 或 P1-A2c 开始

P0-A、P0-B、P0-C、P0-D、P0-E1、P0-E2、P1-A1、P1-A2a、P1-A2b 和 P1-A2c task contract 已完成。不要再调查视频、后期或真人测试，也不要重复开发已经证明的本地恢复、record-replay、strict fallback、approved style-pack prompt/trace 桥接、合法 evidence、多维相似度、baseline 或 analysis-task 合同。

若当前环境具备真实外部 Provider 凭据，优先执行 P0-E3：

```text
real external provider
  → representative 15-type or stratified matrix
  → success / rate limit / repair failure
  → explicit live_external_command provenance
  → no fixture or local fallback counted as real provider success
```

若没有凭据，不要伪造实跑，直接进入 P1-A2c 后续：建设 Reference Library task/evidence UI，或在用户提供合法资料后通过现有 manifest 运行 operator-submitted evidence 的真实四维门禁。没有真实外部 Provider 时不要把 fixture baseline 写成真实对照。

### 7.4 验证命令

```bash
cd web

npx vitest run server/src/__tests__/video-type-generation-matrix.test.ts
npx vitest run server/src/__tests__/professional-text-package-contract.test.ts
npx vitest run server/src/__tests__/outline-service.test.ts \
  -t "updates continuity ledger after generating an episode inside a saved series project"

npm run smoke:story-agent-seedance-preproduction
npm run smoke:story-agent-15-type-preproduction
npm run smoke:story-agent-15-type-import-images
npm run smoke:story-agent-p0e2-reliability
npm run lint -w server
npm run build -w server
npm test -w server
```

图片绑定幂等复核按需运行：

```bash
npm run smoke:story-agent-cross-seed-images
```

不要把以下命令当作当前完成门禁：

```text
smoke:story-agent-persistent-lifecycle
任何视频 Provider / playable media / postproduction smoke
```

### 7.5 P0-A 至 P0-E2 + P1-A1 + P1-A2b 最新验证基线

```text
15 类型 dispatcher / canonical generation / project persistence：通过
professional dispatcher 聚焦测试：4 项通过
服务端全量：170 files passed，1 skipped
测试：1451 passed，2 skipped
server source/scripts TypeScript：通过
server tsup production build：通过
MCP 全量：93 files / 495 tests passed
MCP canonical bridge 与 TypeScript build：通过
通用 schema Web / service 聚焦测试：通过
图片 run 普通项目幂等导入、路径逃逸、系列替换 stale 测试：通过
通用前置制作烟测：4 projects / 14 episodes / 126 shots / 34 images / 0 unbound
15×1 正式矩阵：15 projects / 77 shots / 23 delivered images / 15 ready packages
15×1 图片导入幂等复跑：23/23 skipped
15×3 本地矩阵：45 unique projects / 351 shots / 69 delivered images / 45 ready packages
15×3 部分恢复：1 task verified 后保留 2 pending，再续跑到 69/69 verified
15×3 图片导入幂等复跑：69/69 skipped；project/run IDs 全部稳定
P0-E2 record-replay：15/15 full pipeline ready；23/23 images verified
P0-E2 strict gates：missing / conflict / invalid output / timeout 全部 blocked
P0-E2 provenance：15/15 record_replay_fixture；external_model_call_performed=false
P0-E2 幂等：15/15 projects/runs stable；23/23 repeat imports skipped
P1-A1 bridge：approved-only / compatibility / provenance drift / unknown ID 均 fail closed
P1-A1 prompt：只注入抽象原则与 avoid_copying，不含参考正文或 URL
P1-A1 trace：source / analysis / benchmark / style-pack ID 全链路
P1-A1 truthfulness：external_prompt_injected；local/local fallback 明确 not_applied
P1-A2a report：`story-reference-generation-safety/v1`；无合法来源正文时 similarity 明确 not_run / no credit
P1-A2a gates：最终输出与 derived-state rebuild 均 fail closed；未授权改编在持久化前 blocked
P1-A2a downstream：professional authorization/evaluator/delivery notes 继承引用结论
P1-A2b evidence：`reference-similarity-evidence/v1`；rights/access/fingerprint/payload hash 全链路重验且 immutable
P1-A2b prompt boundary：原始 excerpt/角色/情节/镜头观察不进入生成 prompt
P1-A2b similarity：excerpt / character / plot / shot 四维完成；fixture 明确不计 real similarity
P1-A2b baseline：`reference_baseline_story_id` 严格同输入/类型/结构/模型且 baseline reference-free；输出透明机器 delta/no-credit
P1-A2b preproduction：`acceptance.reference_safety` 独立输出并对 blocked 报告 fail closed
P1-A2b regression：P0-E2 15/15 record-replay 全链路 ready；strict gates 全 blocked；0 real provider calls
P1-A2c task：`reference-analysis-task/v1`；source/fingerprint/authorization 绑定、维度精确覆盖、processing 恢复与 submission-key 幂等
P1-A2c evidence：task → `reference-similarity-evidence/v1` 反向 trace；任务账本不复制观察正文
```

## 8. 当前权威数据与注意事项

### 8.1 持久项目 ID

```text
20260724-series-b58lfu1f  潮汐失忆局
20260724-series-j9476buf  告身不署
20260724-series-6lz0d8hf  一线醒狮
20260724-series-t54xz7ia  白鹿送药记
```

### 8.2 权威报告优先级

当前图片与交付状态应优先读取：

```text
web/generated/story-agent-15-type-preproduction-matrix/matrix-report.json
web/generated/story-agent-15-type-preproduction-matrix/image-import-report.json
web/generated/story-agent-15x3-stability-matrix/matrix-report.json
web/generated/story-agent-15x3-stability-matrix/image-recovery-report.json
web/generated/story-agent-15x3-stability-matrix/image-idempotency-report.json
web/generated/story-agent-p0e2-reliability-matrix/reliability-report.json
web/generated/story-agent-cross-seed-image-assets-20260723/binding-report.json
web/generated/story-agent-cross-seed-image-assets-20260723/seedance-preproduction-report.json
```

`data/reports/story-agent-full-function-smoke-20260723.json` 是历史累积快照，其中 `cross_seed_image_asset_binding.asset_count=4` 记录的是最初四张母图阶段，不是当前 34 个交付图片资产的最新统计。

`persistent-lifecycle-report.json` 和 `playable-media-report.json` 属于后来划出 Story Agent 范围的视频/后期实验，不应用来判断当前目标是否完成。

### 8.3 图片候选与交付图片不是同一概念

视觉圣经会列出候选角色、服装、地点和道具；并非每个候选都必须在当前镜头中拥有独立图片。

前置制作包当前采用：

- 逐镜必需 identity 必须全部有当前映射；
- 进入交付清单的图片必须有本地文件、SHA-256、Provider 和当前 identity mapping；
- 未被镜头要求的候选项不阻塞；
- 一张世界观板可以服务多个身份，但不能让逐镜引用失去明确角色。

### 8.4 图片生成的真实边界

Codex imagegen 是对话工具，不是仓库服务器依赖。下一开发者不要虚构服务器可以直接 import 或调用 imagegen SDK。

应通过 manifest/任务协议让 Codex 执行图片生成，然后由仓库负责：

- 校验；
- 不可变存储；
- 身份绑定；
- 历史；
- 幂等；
- acceptance。

## 9. 可直接复制到下一对话的启动指令

```text
请阅读：
/Users/wuyu/Desktop/china-culture-kb/docs/story-agent-development-handoff-20260724.md

继续开发 china-culture-kb Story Agent。

产品边界固定为：
故事 → 专业脚本 → Seedance 提示词 → Codex 图片资产 → 前置制作交付包。
不要生成视频，不要推进回调、剪辑、声音、字幕或成片，不要把真人测试和 production credit 当作当前阻塞项。

P0-A professional dispatcher/evidence resolver、P0-B 通用 preproduction package、P0-C image-generation request/result/run 与断点续跑、P0-D 15×1 真实图片全链路矩阵、P0-E1 本地 15×3 输入/图片恢复与幂等、P0-E2 资料严格门禁和外部 record-replay/fallback-forbidden 矩阵、P1-A1 approved Reference Library style-pack → canonical prompt → complete reference_trace 桥接、P1-A2a 最终输出机器引用安全报告/门禁/专业文本结论传递、P1-A2b 合法不可变 evidence/四维相似度/显式 baseline 对照/preproduction 独立验收、P1-A2c source-bound analysis task manifest/幂等 evidence 提交均已完成。

若具备真实外部 Provider 凭据，从 P0-E3 开始做分层真实 Provider 验收，并把 live external、record-replay fixture 和 local fallback 三种 provenance 严格分开。若同时有用户合法提供的参考材料，则创建 `reference-analysis-task/v1`，由 Codex/operator 提交 `reference-similarity-evidence/v1`，先生成 reference-free baseline，再用 `reference_baseline_story_id` 执行 reference-assisted 对照。若没有凭据或合法材料，不要伪造实跑，进入 Reference Library UI 或更高层统一 StoryAgentRun。不得把 fixture、not_run 维度或 machine comparison 写成真实/人工通过。
```
