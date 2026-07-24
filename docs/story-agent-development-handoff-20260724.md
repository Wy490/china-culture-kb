# Story Agent 当前成果、差距分析与下一对话开发交接

> 日期：2026-07-24
> 仓库：`/Users/wuyu/Desktop/china-culture-kb`
> 分支：`codex/story-agent-manifest-integrity-20260718`
> 上一功能基线提交：`679a3f4a feat(story-agent): dispatch professional text packages`
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

但它还不能称为“全部 15 类型都能无人值守稳定交付”的完整 Agent。专业文本 dispatcher 和通用前置制作包已经收敛；当前最大问题是 Codex 图片生成仍依赖对话内人工编排，尚未形成可恢复、可重复执行的 request/result manifest 工作流。

可用两个口径理解当前距离：

| 口径 | 主观完成度 | 判断 |
|---|---:|---|
| 展示结构化生成与前置制作交付 | 85%–90% | 普通项目与系列项目已有统一导出合同和机器证据 |
| 全部 15 类型无人值守稳定交付 | 65%–72% | 可恢复图片任务和全类型端到端矩阵仍未完成 |

这个百分比是工程判断，不是测试自动计算值。后续应以第 6 节的退出条件替代主观百分比。

### 1.2 当前状态矩阵

| 用户所需能力 | 当前状态 | 已有证据 | 主要不足 |
|---|---|---|---|
| 15 类结构化故事 | 已有功能基础 | 15/15 `VideoType` 本地生成矩阵通过 | 目前是一类一个代表输入，且测试强制 `STORY_GEN_LOCAL_ONLY=1` |
| 15 类专业脚本 | canonical 接入完成 | 15/15 dispatcher、evidence resolver、generation/project version 派生状态矩阵 | 纪录片真实采访/授权仍会正确转为补证任务 |
| 连续分集故事 | 较强 | 20 集正式系列；4 个系列共 14 集稳定复跑 | 主要集中在 `ai_comic_drama` 系列形态 |
| Seedance 提示词 | 较强 | 4 个持久项目、126 镜头、全部含图片引用 | 15 类通用项目尚未全部做图片绑定后的提示词验收 |
| 图片资产 | 已有真实闭环 | `gpt-image-2` 图片、不可变文件、SHA-256、Provider、prompt hash、身份映射 | 图片生成仍由 Codex 在仓库外调用 imagegen，再由脚本导入；Agent 本身没有可恢复图片任务 |
| 一键交付包 | 通用合同已完成 | story / ordinary project / series 共用 `story-agent-seedance-preproduction-package/v1` | 仍需 15×1 持久项目逐类图片闭环 |
| 版本与持久化 | 已有 | story snapshot、project/version、series project、asset history | 缺少跨故事/脚本/图片/交付包统一 run manifest |
| 机器质量与修复 | 已有多层门禁 | genre、premise fidelity、commercial machine gate、repair | 专业脚本管线的自动选择、补证、修复和 derived-state 重建尚未统一 |
| 影视/文字 benchmark | 基础设施已建 | Reference Library、analysis、benchmark、audited style pack | 已批准 style pack 尚未真正进入 canonical generation prompt 和 `reference_trace` |

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

### 2.5 Story Agent → Seedance 前置制作包

最新实现接口：

```text
POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-preproduction-package
```

Schema：

```text
ai-comic-series-seedance-preproduction-package/v1
```

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

截至 P0-B 通用前置制作包工作树：

```text
服务端全量：163 files passed，1 skipped
测试：1416 passed，2 skipped
server source/scripts TypeScript：通过
server tsup production build：通过
MCP 全量：91 files / 489 tests passed
通用前置制作烟测：4 projects / 14 episodes / 126 shots / 34 images / 0 unbound
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

### 3.3 P0：图片生成不是 Agent 内部可恢复步骤

当前真实图片是由 Codex imagegen 生成，这是符合用户要求的；但执行方式仍是人工编排：

```text
visual bible
  → Codex 读取需求
  → Codex 调用 imagegen
  → 保存源图和 prompt
  → 构造 manifest
  → 脚本导入、绑定、复核
```

服务器不能直接调用 Codex 的 imagegen 工具，因此不能简单把图片调用塞进 Express service。正确做法是建立 Agent 与 Codex 之间的可恢复握手：

```text
Story Agent 输出 image-generation-request manifest
  → Codex 逐项 imagegen
  → Codex 写 image-generation-result manifest
  → Story Agent 导入、校验、绑定
  → 缺失项可继续，成功项幂等复用
```

需要的状态至少包括：

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

必须保留：

- prompt；
- Provider/model/call ID；
- source image references；
- content/prompt hash；
- identity fingerprint；
- attempt/retry history；
- 可重复执行和断点续跑。

### 3.4 P0：15 类测试还不是 15 类端到端稳定性矩阵

现有 15 类生成矩阵的局限：

- 每类只有一个代表性知识条目和输入；
- 强制 `STORY_GEN_LOCAL_ONLY=1`；
- 主要检查结构、字段、genre score 和模板污染；
- 没有让每类都经过 professional package；
- 没有让每类都生成并绑定真实图片；
- 没有让每类都导出最终前置制作包；
- 没有覆盖长输入、缺素材、冲突素材、原创和改编的组合。

四项目 126 镜头稳定矩阵虽然更深，但本质上仍是 AI 漫剧系列工作流的四种题材。

目标矩阵至少应为：

```text
15 video types
× 3 representative inputs per type
× local engine + configured external model path
× fictional_original / source_adaptation where applicable
```

第一阶段可以先做 15×1 全链路，随后扩到 15×3。

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

### 3.5 P0：外部模型路径尚无同等级稳定证据

15 类当前权威矩阵明确设置：

```text
STORY_GEN_LOCAL_ONLY=1
```

默认 `model_profile_id` 也是本地故事引擎。外部 command adapter 已有超时、JSON schema 校验和 fallback，但尚无与本地引擎同等级的 15 类持续验收。

需要明确区分：

- 用户主动选择 local：本地生成是预期路径；
- 用户选择 external model：外部失败后是否允许 fallback 必须由请求策略决定；
- 如果允许 fallback，最终结果必须显式标记；
- 如果要求真实外部模型，隐藏 fallback 必须是硬失败。

需要增加：

- record/replay adapter fixtures；
- external requested / fallback forbidden 测试；
- prompt package 版本与模型输出 schema 兼容测试；
- 15 类 local/external derived-state parity；
- 超时、无效 JSON、部分字段和修复失败的恢复测试。

### 3.6 P1：影视 × 文字 benchmark 尚未影响生成结果

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
| audited style pack 接入生成 | 未完成 | 新 style pack 存在 `references/creative/library/style-packs/`，canonical 本地生成读取的是旧 `references/creative/style-packs/`，两者尚未桥接 |
| 生成可追溯性 | 未完成 | 生成结果还没有可靠记录 benchmark/analysis/source 级 `reference_trace` |
| 参考质量与相似性门禁 | 部分完成 | 有基础 `reference-quality-service`，但未与 audited style pack 和 canonical run 形成硬门禁 |

因此，如果把“结构化参考理解层”拆成“资料治理”和“真正驱动生成”两部分：

```text
资料登记、分析 schema、benchmark 组合与治理：约 75%–85%
自动理解原始资料并稳定影响故事生成：约 20%–30%
整体可用度：约 45%–55%
```

这些比例是工程判断。它目前是一个可靠的**参考资料管理与组合底座**，还不是完整的**自动参考理解与生成控制层**。

Reference Library、影视分析、benchmark 和 audited style pack 已有基础设施，但当前没有证据表明：

```text
approved audited style pack
  → generation prompt package
  → generated story
  → reference_trace
  → reference quality report
```

已批准 benchmark 目前更像独立研究资产，而不是 Story Agent 的实际控制输入。

下一步应：

1. 只允许 approved + audited style pack；
2. 将抽象原则注入 prompt package；
3. 将 `avoid_copying` 变成硬约束；
4. 写入 `reference_trace`；
5. 检查长句、角色、情节和镜头序列相似性；
6. 做有/无 style pack 的可解释对照测试。

### 3.7 P1：缺少面向 Agent 的统一 run 与 MCP 操作面

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

### 3.8 P1：现有机器质量分仍需要更强外部校准

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

先实现请求/结果合同，不要尝试让服务器直接调用 Codex imagegen。

建议产物：

```text
image-generation-request/v1
image-generation-result/v1
story-agent-image-run/v1
```

验收：

- Codex 可以只读 request manifest 逐项生成图片；
- 中断后继续未完成项；
- 已成功图片不重复生成；
- 替换图片会使旧 identity mapping stale；
- 导入后自动刷新 preproduction acceptance；
- 一张世界观板可覆盖多个 identity，但逐镜必需身份不能漏。

### 4.4 P0-D：15×1 全链路矩阵

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

### 4.5 P0-E：15×3 稳定性和恢复

15×1 通过后再扩展：

- 不同输入长度；
- 不同目标时长；
- 原创与素材改编；
- 资料充分与资料不足；
- 外部模型成功、超时、无效输出；
- imagegen 中断与恢复；
- 重复导出与幂等。

最终用一个汇总报告给出每类：

```text
story_status
professional_script_status
prompt_status
image_status
preproduction_status
fallback_status
repeat_run_status
```

### 4.6 P1-A：完成 Reference Intelligence 生成闭环

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

建议新增：

```text
web/server/src/services/reference-generation-bridge-service.ts
web/server/src/services/reference-analysis-task-service.ts
web/server/src/__tests__/reference-generation-bridge-service.test.ts
```

关键实现点：

1. 桥接 `references/creative/library/style-packs/` 与 canonical generation；
2. 只接受 approved/audited 且 compatible 的 style pack；
3. 只注入抽象原则，不把来源正文、独特台词或镜头序列塞进 prompt；
4. 将 source/analysis/benchmark/style-pack ID 写入 `reference_trace`；
5. `reference-quality-service` 检查 `avoid_copying`、长句相似度、角色/情节/镜头序列近似；
6. 对同一输入做 baseline 与 reference-assisted 对照；
7. 参考层失败时明确返回“不使用参考”或硬失败，不能静默使用未批准资料。

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
12. 视频生成与真人测试始终不参与当前 acceptance。

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
history includes: 679a3f4a feat(story-agent): dispatch professional text packages
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
web/server/scripts/story-agent-seedance-preproduction-smoke.mts
mcp-server/src/tools/story-agent-generate.ts
mcp-server/src/tools/generate-script.ts
```

### 7.3 从 P0-C 开始

P0-A、P0-B 已完成。下一对话不要再调查视频、后期或真人测试，直接做：

```text
image-generation-request/v1
  → Story Agent 输出稳定图片任务、prompt 和 identity fingerprint
image-generation-result/v1
  → Codex 写回 provider/model/call ID、源文件与 hashes
story-agent-image-run/v1
  → 幂等导入、绑定、失败重试与断点续跑
  → 自动刷新通用 preproduction acceptance
```

完成 P0-C 后，再做 P0-D 15×1 全链路矩阵。

### 7.4 验证命令

```bash
cd web

npx vitest run server/src/__tests__/video-type-generation-matrix.test.ts
npx vitest run server/src/__tests__/professional-text-package-contract.test.ts
npx vitest run server/src/__tests__/outline-service.test.ts \
  -t "updates continuity ledger after generating an episode inside a saved series project"

npm run smoke:story-agent-seedance-preproduction
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

### 7.5 P0-A + P0-B 最新验证基线

```text
15 类型 dispatcher / canonical generation / project persistence：通过
professional dispatcher 聚焦测试：3 项通过
服务端全量：163 files passed，1 skipped
测试：1416 passed，2 skipped
server source/scripts TypeScript：通过
server tsup production build：通过
MCP 全量：91 files / 489 tests passed
MCP canonical bridge 与 TypeScript build：通过
通用 schema Web / service 聚焦测试：通过
通用前置制作烟测：4 projects / 14 episodes / 126 shots / 34 images / 0 unbound
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

P0-A professional dispatcher/evidence resolver 和 P0-B 通用 preproduction package 已完成。从交接文档 P0-C 开始：实现 image-generation request/result/run manifest 与断点续跑，不要让 Express 直接调用 Codex imagegen。先写合同与失败恢复测试，再实现幂等导入、当前 identity mapping 刷新和 acceptance 重算；完成后推进 P0-D 15×1 全链路矩阵。
```
