# Story Agent 全功能审查与下一阶段开发计划（2026-07-19）

> 用途：下一段 Codex 对话的唯一主交接文档。历史细节如有需要，再查阅 `docs/story-agent-next-conversation-handoff-20260717.md`。
>
> 审查范围：Story Agent 文本生成、15 片型、质量评估、修复与版本、MCP、Production Board、图片资产、GEARS、Seedance、多集 AI 漫剧及前端实际操作结果。

## 1. 结论先行

Story Agent 已经不是原型：它有完整的本地生成链、15 片型合同、项目版本、质量报告、生产板、GEARS/Seedance 编排、回调账本、审计和较强的 fail-closed 边界。当前最需要解决的不是继续堆入口，而是统一“真相合同”并接通真实资产最后一公里。

核心结论有五条：

1. 文本本地链真实可用。2026-07-19 通过前端重新生成 15 个片型，15/15 都产出结构完整的 Story、scene breakdown、GEARS 与 Seedance 包；但全部是 `local_only`，不是 Claude、Codex 或其他外部模型实产。
2. 质量状态混合了“故事质量、输入素材、交付素材、GEARS 就绪度”。因此 15 个最新样本只有 4 个 `quality_passed=true`，其中不少失败并不是故事正文差，而是缺采访、参考图、课件、外部素材等生产输入。
3. 单故事项目没有真实图片生成器。“生成占位参考图”只写本地 SVG；上传、绑定、复用存在，但真实人物图、场景图、道具图生成尚未形成单故事闭环。
4. 多集 AI 漫剧已有 `storyboard_image`、`character_image`、`scene_image` GEARS 任务，但图片回调只更新 job ledger，未自动回填资产库，外部图片即使返回也会停在账本层。
5. Seedance 包、Production Board、GEARS ledger 的镜头身份不统一。Seedance 按交付 unit 生成镜头，Production Board 按 scene 折叠，当前历史剧情样本可出现“Seedance 12 镜头、Production Board 6 镜头”的差异。这是下一阶段首要 P0。

项目更准确的状态应表述为：

> 本地文本生成、结构化交付、版本治理和本地 GEARS 验收链可用；专业文本质量仍需按片型校准；真实外部文本模型、真实图片生成和真实 Seedance/GEARS 媒体回片尚未完成端到端验收。

## 2. 本轮已完成的工作

### 2.1 前端真实操作

- 前端地址：`http://localhost:5173/`
- 当前可复查项目：`http://localhost:5173/projects/20260719-story-8ntif7ac0079--historical_drama#production-board`
- 通过前端对 15 个 `VideoType` 各生成一次，最新样本覆盖数为 15/15。
- 15 个最新项目全部记录为 `generation_mode=local_only`。
- 15/15 通过 Story、GEARS segments、GEARS delivery、Seedance prompts 的结构/API 检查。
- 15 个最新项目中，综合 `quality_passed=true` 为 4/15：
  - `character_story`
  - `historical_drama`
  - `culture_promo`
  - `social_short`
- 其余 11 个主要被流派信号、生产素材或 GEARS 交付门禁阻断。

### 2.2 历史剧情项目的真实前端生产操作

项目：`20260719-story-8ntif7ac0079--historical_drama`

- 6 场故事、6 个 Production Board 镜头。
- 执行 Production Readiness 安全自动化。
- 生成 4 个本地 SVG Seedance 占位参考图。
- 创建 6 个本地 GEARS `seedance_video` job。
- 6/6 完成本地 acceptance，失败 0。
- 就绪度在本地流程中从约 54 → 68 → 84。
- 真实外部媒体 artifact：0。
- 正式图片资产：0。
- 本地 acceptance URL 使用 `local.story-agent.invalid`，并带 `not_external_provider_output=true`，不应计作真实回片。

### 2.3 本轮已经完成并验证的内容修复

- 标题与主角识别更简洁。
- 拒签冤案事件的人物、引文、情节范围更准确。
- 清理用户可见文本中的内部质量标签、结构化地域元数据和生成指挥语。
- 修复 GEARS 场景资产被整条知识条目摘要污染的问题。
- 重复地点的 Seedance 参考图锚点更稳定。
- 对无人物片型放宽部分质量侧人物资产要求。
- 前端明确区分 Audience Text、生产素材与本地/外部状态。
- 生成尝试审计 ledger 已实现 durable started/succeeded/failed 事件。

### 2.4 最新验证基线

本轮后续实现完成后已经执行：

- Web server：132 个测试文件通过、1 个跳过；1157 个测试通过、2 个跳过。
- `npm run check`：copy audit、server `tsc --noEmit`、client `vue-tsc --noEmit` 全部通过。
- `git diff --check` 通过。
- 较早的真实功能 smoke 报告位于 `data/reports/story-agent-real-functional-smoke-20260719.json`；该报告固定记录 6 次本地 canonical 请求、外部模型调用 0，不能把它解读为 15 片型最新批次报告。

## 3. 当前 Agent 架构

主链大致为：

```text
前端 / Web API / MCP
  -> source domain 与素材解析
  -> StoryBlueprint + 本地 StoryAssembly
  -> StoryGenerationPromptPackage
  -> command_json 外部模型适配器（未配置时 local_only）
  -> 类型质量 + 大纲 + 流派 + GEARS + 素材 + Audience Text
  -> repair / scene regeneration
  -> GEARS delivery + Seedance prompts + Production Board
  -> Story / Project / Version / Job ledger 持久化
  -> GEARS / Seedance provider callback
```

主要代码入口：

- 中国文化生成编排：`web/server/src/domains/china-culture/story-generation-service.ts`
- 生成执行边界：`web/server/src/domains/china-culture/story-generation-execution-service.ts`
- 本地故事组装：`web/server/src/services/dramatic-story.ts`
- 外部文本模型适配：`web/server/src/services/story-generation-model.ts`
- 类型质量：`web/server/src/services/genre-quality-service.ts`
- 综合质量：`web/server/src/services/quality-workflow-service.ts`
- 修复编排：`web/server/src/platform/story-repair-orchestration.ts`
- 项目质量修复：`web/server/src/services/quality-repair-service.ts`
- 场景重生成：`web/server/src/services/story-regenerate-service.ts`
- GEARS delivery：`web/server/src/services/gears-delivery-service.ts`
- Seedance prompt：`web/server/src/services/seedance-prompt-service.ts`
- Production Board：`web/server/src/services/production-board-service.ts`
- 项目/资产/GEARS/Seedance 总服务：`web/server/src/services/project-service.ts`
- 多集 AI 漫剧：`web/server/src/services/ai-comic-series-service.ts`
- MCP：`mcp-server/src/index.ts` 与 `mcp-server/src/tools/`

## 4. 功能能力矩阵

状态含义：

- 已验证：本轮真实前端或本地 canonical 流程已经跑通。
- 部分完成：接口、合同或模拟链存在，但不能计真实产出。
- 缺失：没有完成产品级闭环。

### 4.1 文本与 Agent 能力

| 能力 | 状态 | 审查结论 |
|---|---|---|
| 15 片型本地生成 | 已验证 | 15/15 可生成结构化故事、场景和交付包 |
| StoryBlueprint | 已验证 | 已接片型、结构、素材边界和 scene 映射 |
| 外部文本模型 | 部分完成 | 仅 `command_json` bridge；当前环境未配置，真实调用 0 |
| 模型选择 UI | 已验证 | capability 端点独立报告全文生成与场景重写的本地/外部可用性；未配置对应 adapter 时显式默认本地引擎并禁用外部 profile，结果保存请求模型、实际引擎、外调与原因 |
| 大纲覆盖 | 已验证 | 有独立报告，但关键词匹配仍偏启发式 |
| 流派质量 | 部分完成 | 规则广，但大量依赖文本信号命中，误报明显 |
| Audience Text | 已验证 | 能发现治理词/提示污染，当前样本表现较好 |
| 自动质量修复 | 部分完成 | 本地实质改写主要针对 AI 漫剧；分数持平可被误判为成功 |
| 场景重生成 | 部分完成 | 可改场景并重建部分派生数据，但没有统一重跑全部质量派生 |
| 项目版本与审计 | 已验证 | 非覆盖式版本、生成尝试 ledger、访问控制和 callback 账本较完整 |
| 原创故事域 | 部分完成 | 仅支持 5 个片型，且固定 local-only，与中国文化域能力不对称 |
| MCP Story Agent 工具 | 已验证 | `kb_story_agent_generate` 调用 Web canonical application service；蓝图、校验、修复、版本、GEARS、Seedance 继续保留，旧 `kb_generate_story` / `kb_generate_script` 显式标记为 legacy writer |
| 真人专业评审 | 缺失 | 现有 Stage 6–8 合同很多，但真实模型、真实两轮修订、真人盲评信用仍为 0 |

### 4.2 图片资产、GEARS 与 Seedance 能力

| 能力 | 状态 | 审查结论 |
|---|---|---|
| 角色/地点/道具需求派生 | 已验证 | 能从 story、GEARS delivery、Seedance refs 派生资产槽位 |
| Seedance 提示词包 | 已验证但需重构 | 能输出时长、素材 slot、负面约束；模板对所有片型硬编码 AI 漫剧语气 |
| 单故事占位参考图 | 已验证 | 写 1280×720 SVG；必须继续明确它不是 AI 图片 |
| 手工上传/绑定/批量导入 | 部分完成 | 功能存在，但文件真实性、格式、尺寸、哈希和安全校验不足 |
| 跨项目资产复用 | 部分完成 | 可复用，但 placeholder、授权、来源、角色版本和风格兼容控制不足 |
| 单故事真实图片生成 | 缺失 | 没有人物图、场景图、道具图的真实 provider 闭环 |
| 多集漫剧图片 GEARS job | 部分完成 | 可提交 storyboard/character/scene image jobs，但尚未真实端到端验收 |
| 图片回调自动入库 | 缺失 | 图片 job 回调只更新 GEARS ledger，不绑定 series asset library |
| Seedance 视频 provider | 部分完成 | submit/poll/recover/import/callback 合同齐；本轮只跑 local acceptance，外部回片 0 |
| 外部资产可达性预检 | 缺失 | provider payload 可携带本地路径，外部服务通常无法读取 |
| 安全媒体预览 | 缺失 | 前端主要显示 `local_path` 文本，未发现项目级认证预览/下载端点 |
| 后期与最终装配 | 部分完成 | 多集漫剧有字幕、混音、片头尾、final assemble 合同/runner；真实媒体交付仍待外部验证 |

## 5. 15 片型实测解读

最新 15 个片型样本的共同特征：

- 15/15 `generation_mode=local_only`。
- 15/15 大纲覆盖分数为 100；这更多说明输入承接合同有效，不等于专业成稿。
- 4/15 综合通过，不能直接解释为“11 个故事写坏了”。

典型问题：

| 片型 | 主要发现 |
|---|---|
| AI 漫剧 | 两难信号偏弱；缺关键帧、一致性、单镜头测试等生产素材；GEARS 46 |
| 儿童故事 | 年龄段、儿童安全冲突、具体例子、情绪安放不足；GEARS 50 |
| 微纪录片 | 缺 `source_quotes`、`field_notes`、见证人、采访/B-roll/环境声；GEARS 58 |
| 知识讲解 | 受众层级、论点、步骤、例子、视觉隐喻不足；GEARS 0 |
| 宣讲片 | 主讲人、传播目标、案例、大纲、课件不足；GEARS 30 |
| 教育培训 | 教学闭环信号偏弱，概念定义未明确；GEARS 82 |
| 非遗宣传 | 文本/流派可达 100，但缺官方链接和影音资产，被综合质量判失败 |
| 城市/场景/山水 | 被剧情型“结尾主题/人物锚点”或词法信号影响，存在片型错配 |
| 传说故事 | 神异、象征、流传理由等信号偏弱，词法判定容易低估实际叙事 |

这组数据说明：当前最重要的不是把所有综合分数强行调到 100，而是先把质量维度拆开。完整输入的专业黄金样本应通过故事门禁；缺外部素材的样本应显示“故事可用、生产未就绪”。

## 6. P0 问题、根因、方案与验收

### P0-1：质量与生产就绪状态混在一个 `passed`

根因：`quality-workflow-service.ts` 把基础故事质量、大纲、流派、GEARS、生产素材和 Audience Text 全部串成一个布尔值。

影响：

- 文本写得合格但缺外部影音素材时，页面显示“质量未通过”。
- 非遗文本分数 100 仍可因缺官方资源而失败。
- 用户无法判断下一步该改故事、补素材还是接 provider。

方案：建立 `quality-gates/v2`，至少分为：

- `narrative_gate`
- `factual_cultural_gate`
- `outline_gate`
- `audience_text_gate`
- `production_material_gate`
- `gears_contract_gate`
- `asset_gate`
- `external_provider_gate`

提供两个明确汇总：

- `story_publishable`：正文、事实文化、用户大纲、Audience Text 达标。
- `production_ready`：生产素材、资产、GEARS/Seedance 合同与外部 provider 前置达标。

验收：

- 前端不再把生产素材缺失显示成“故事质量失败”。
- 15 片型黄金输入分别有可解释的 gate 结果。
- 缺外部素材的非遗样本可以是 `story_publishable=true`、`production_ready=false`。
- 旧 `quality_report.passed` 保持兼容读取，但不再作为唯一产品状态。

### P0-2：镜头 ID 与镜头数量不统一

根因：

- `buildSeedancePromptPackage()` 按 GEARS delivery unit 生成 shot。
- `buildStoryProductionBoard()` 用 `source_scene_id` 建 Map，多个 unit 会被覆盖成最后一个。
- Production Board 再用 `shot-${scene_id}` 重建另一套 ID。
- 资产 `source_shot_ids` 与 Seedance 实际 shot ID 也不一致。

影响：

- Seedance prompt 可能有 12 镜头，而 Production Board/ledger 只有 6。
- 时间、提示词、素材绑定、provider callback 可能错位或丢失。
- 导出包和执行账本无法证明是同一套镜头。

方案：新增 canonical `ProductionShot` / `shot-plan/v2`：

- 明确一个 shot 对应一个 GEARS unit，或明确 grouping 规则。
- `shot_id` 只生成一次，贯穿 GEARS delivery、Seedance、Production Board、资产、ledger、callback、export。
- `scene_id` 只是来源字段，不再作为去重键。
- v1 数据提供确定性迁移器。

验收：

- `delivery.units.length === seedance.shot_units.length === production_board.shot_units.length === shot_ledger.items.length`，除非显式 grouping manifest 解释差异。
- 所有资产 `source_shot_ids` 都能命中 canonical shot。
- 所有 callback 只通过 canonical shot/job identity 更新目标。
- 增加重复 scene、多 unit、回调乱序、版本迁移测试。

### P0-3：修复可在没有改善时被标记成功

根因：

- 故事 repair 接受 `after_genre_score >= before_genre_score`。
- `qualityImproved()` 也把分数持平算改善。
- 内容未变化时可能生成 `quality_report_refreshed` 版本。

影响：

- repair trace 和版本历史出现“已修复”但正文没变。
- 自动化可制造无效版本并给出虚假进展。

方案：建立统一 `StoryRevisionComparator`：

- 正文/场景 canonical hash 必须变化，或仅质量重算时明确标成 `recomputed_not_repaired`。
- 目标 issue 数减少或目标分数严格上升。
- 事实文化、Audience Text、大纲、GEARS、受保护字段不得回退。
- 分数相等时，只有 issue vector 实际改善才可接受。
- 内容和质量都未变化时禁止创建新版本。

验收：

- no-op repair：`applied=false`、新版本数 0。
- 分数相同但目标 issue 减少：允许应用并记录精确差异。
- 任一保护门禁回退：拒绝应用并恢复原快照。

### P0-4：场景重生成没有统一重建全部派生状态

根因：场景重生成只重算基础/类型质量并重建 GEARS delivery，没有统一调用完整 `enrichStoryQualityReport()`；其它写版本入口也各自维护派生字段。

影响：

- scene、full_text、GEARS、Seedance、质量子报告可能来自不同版本的内容。
- 项目版本之间存在隐性陈旧派生数据。

方案：新增唯一 `rebuildDerivedStoryState(story)`：

- 重建 full text、blueprint scene refs、GEARS segments/delivery、Seedance、Production Board contract。
- 重跑全部 quality gates、Audience Text、domain safety。
- 校验 identity、protected fields 和版本一致性后才落盘。
- generation、repair、scene regenerate、apply repaired JSON、MCP update 都必须走该函数。

验收：所有写版本入口运行同一组 parity/integrity tests；旧派生字段不允许被直接信任。

### P0-5：真实图片回调没有回填资产库

根因：AI 漫剧 series 图片 job 建立了 payload 和 ledger；callback 对 `seedance_video` 和后期 job 有专门应用逻辑，但 `storyboard_image`、`character_image`、`scene_image` 最终只更新 ledger。

影响：外部图片即使生成成功，也不能自动成为角色/场景/分镜资产，后续 Seedance 仍看不到它们。

方案：

- 建立 `MediaArtifact` 与 `AssetBinding` 统一合同。
- 按 job type、source unit、artifact role 把回片写入 series/single-story asset library。
- 保存 provider、model、prompt hash、source project/version、尺寸、MIME、内容 hash、授权状态与人工审核状态。
- 幂等 callback 不重复创建资产；新回片生成资产版本。

验收：使用 fake provider 完成三种图片 job 的 submit → callback → asset library → Seedance slot → preview 全链；重复/乱序 callback 保持幂等。

### P0-6：产品允许选择外部模型，但没有先展示实际可用引擎

> 实施状态：已于 2026-07-19 完成；详见 10.13。本轮只验证 capability 与本地引擎，外部模型真实调用仍为 0。

根因：模型目录提供 Claude Sonnet、Claude Opus、GPT 标签；未配置 `STORY_GEN_COMMAND` 时运行 `local_only`。非法 model ID 还可能被解析为推荐模型或走 fallback。

影响：用户可能以为选择了 Claude，实际使用本地模板生成。

方案：

- 新增 `/api/system/story-generation-capabilities`。
- 前端生成前显示 `requested_model`、`effective_engine`、provider 可用性和费用/外发边界。
- 外部不可用时禁用或明确标注模型选项；本地生成应主动显示“本地引擎”。
- schema 严格校验 model profile enum；请求与实际 provider/model 都持久化。

验收：任何生成结果都能回答“用户选了什么、实际用了什么、为什么 fallback、是否发生外部调用”。

## 7. P1 开发项

### P1-1：按片型家族拆基础质量验证器

当前除 memory mosaic 外普遍使用 `validateDramaticStory()`，导致讲解、城市、场景、山水也被要求剧情式主角选择和道德落点。

建议至少拆为：

- 剧情叙事：人物目标、阻力、行动、代价、转变。
- 纪录证据：问题、证据、见证人、现场、来源边界。
- 宣传传播：受众、价值主张、可验证画面、行动号召。
- 讲解教学：问题、概念、步骤、例子、复盘。
- 场景/山水：空间、时间、光影、路径、声音、留白。
- 社交短视频：钩子、信息密度、字幕节奏、记忆句。

### P1-2：把流派质量从“词命中”升级为“场景证据”

当前诸如“人物不是年表”“制度压力可见”“留白成立”主要靠文本启发式匹配，容易误报，也可能鼓励把质量标签写进正文。

建议每个 signal 返回：

- `status`
- `evidence_scene_ids`
- `observable_evidence`
- `counter_evidence`
- `confidence`
- `repair_target`

先做确定性结构/场景证据，再在获授权时增加外部 evaluator，最后由固定黄金集和真人盲评校准。

### P1-3：按片型渲染 Seedance prompt

当前所有片型都硬编码“AI漫剧/影视分镜”，无人物时默认“主要人物进入画面”。这不适合山水、城市、非遗工艺、知识讲解和空间短片。

建议建立 profile-driven renderer：

- `subject_kind`: person / object / craft / place / process / text-graphic
- `visual_style`
- `temporal_template`
- `camera_grammar`
- `sound_plan`
- `requires_character_anchor`
- `negative_constraints`

Production Board QA 也必须读取 `requires_character_anchor`，不能对无人物片型统一扣分。

### P1-4：建立单故事真实图片资产工作流

建议新增三类一等 job：

- `character_reference_image`
- `location_reference_image`
- `prop_reference_image`

流程：需求派生 → 资产 prompt → provider preflight → submit → poll/callback → 自动入库 → 视觉/身份审核 → 绑定 canonical shot → Seedance provider。

placeholder 继续保留，但字段和 UI 必须始终为 `placeholder=true`、`production_credit=false`。

### P1-5：资产接入安全与可追溯性

当前上传采用总量限制和安全路径，但缺少媒体真实性校验。

应新增 `AssetIngestService`：

- magic-byte/MIME sniff，而不是信任扩展名。
- 按图片/视频/音频限制格式、尺寸、分辨率、时长。
- SHA-256 去重、不可变原件和缩略图。
- 安全拒绝/隔离异常文件。
- 记录来源、版权/授权、人物同意、项目版本、审核人和状态。
- 认证预览/下载端点，不向浏览器暴露任意本地路径。

### P1-6：provider 资产可达性预检

外部 provider 不能直接读取 Story Agent 本机 `local_path`。

在 `use_provider_adapter=true` 前必须：

- 拒绝 placeholder、本地不可达路径和无授权资产。
- 将资产上传到 provider file store 或对象存储。
- 只发送 provider file ID 或短期签名 URL。
- 回调验证 provider/job/project/shot/version 绑定。

### P1-7：统一 Web 与 MCP 语义

> 实施状态：已于 2026-07-19 完成 canonical 生成入口、legacy writer 边界和 MVP 指挥面收敛；详见 10.13。

`kb_generate_story` 当前实际是“把已经生成的 story_text 写入 scripts Markdown”，名称会误导 Agent。`kb_generate_script` 只是骨架生成。

建议：

- 将旧工具明确命名/标记为 legacy writer。
- MCP 新增 canonical `kb_story_agent_generate`，调用与 Web 相同的 application service。
- MCP、Web、前端共享请求 schema、capability status、quality gates、revision comparator 和 derived-state rebuild。
- 删除 `mcp-server/src/index.ts` 中无效/重复 return 和未进入 schema 的输出字段。

### P1-8：拆分超大服务

> 实施状态：已于 2026-07-19 完成第一切片，将项目标识、版本标识、仓储路径和乐观并发元数据提取为独立 project core 边界；2026-07-20 完成第二至第十切片，将 Seedance Provider 队列/callback/retry/overview policy、Production Readiness、GEARS external artifact/preflight、callback ledger application、external callback handoff 和 Seedance retry package 纯逻辑拆出；详见 10.14–10.23。其余 production board orchestration、图片归档、其他 handoff/export 与 final delivery 仍待按能力继续拆分。

`project-service.ts` 已超过一万行，`ai-comic-series-service.ts` 也同时承担规划、资产、GEARS、Seedance、后期、审片和交付。

按能力拆分，而不是按路由机械拆分：

- project core/version repository
- derived story rebuild
- production board/readiness
- asset library/ingest
- GEARS execution ledger
- Seedance execution ledger
- external callback application
- series continuity
- post-production/final delivery

拆分期间必须先补 characterization tests，避免重构改变现有持久化合同。

## 8. P2 完善项

- 固定 15 片型黄金集：完整输入样本、稀疏输入样本、失败样本各一组。
- 引入真人编剧、导演、事实文化评审三角色盲评；机器合同不能计真人信用。
- provider 成本、耗时、失败分类、重试次数、回调延迟与实际产出率监控。
- 角色身份版本、视觉风格 fingerprint、跨项目复用兼容检查。
- 图片视觉 QA：角色一致性、服装/道具连续性、文字伪影、历史时代错误、敏感内容。
- 输出版本之间的 Story/Shot/Asset/Prompt/Provider provenance DAG。
- 将“本地结构就绪度”和“外部交付就绪度”分成两个分数；84 分本地 readiness 不得被解读为真实成片 84%。
- 真实 provider 错误采用稳定枚举和脱敏诊断，避免将原始响应、密钥或敏感输入直接写入日志。

## 9. 分阶段执行计划

### 阶段 A：统一真相合同

目标：先消除状态、镜头和修复的假一致。

顺序：

1. 为 P0-1、P0-2、P0-3、P0-4 写失败回归测试。
2. 实现 `quality-gates/v2` 和前端双状态。
3. 实现 `shot-plan/v2` 与 v1 迁移。
4. 实现 `StoryRevisionComparator`。
5. 实现 `rebuildDerivedStoryState()` 并接入所有版本写入口。

退出标准：

- 同一项目所有镜头数量和 ID 可证明一致。
- no-op 修复不再创建版本。
- 所有版本写入口重建同一套派生状态。
- 前端能明确区分故事可发布与生产可交付。

### 阶段 B：片型质量重构

目标：让 15 片型的质量门禁真正评价对应体裁。

顺序：

1. 六个片型家族 base validator。
2. 场景证据型 signal evaluator。
3. 15 片型黄金/稀疏/失败 fixture。
4. 修复器按片型家族定向改写。
5. 真人评审表与机器报告对齐。

退出标准：完整黄金输入 15/15 能得到可解释结果；稀疏输入显示素材阻断但不误判正文；质量标签不会泄露进观众文本。

### 阶段 C：真实图片资产闭环

目标：从“占位图和账本”升级为“可审、可复用、可交付的真实媒体资产”。

顺序：

1. `MediaArtifact` / `AssetBinding` 合同。
2. Asset ingest、安全预览、hash/provenance。
3. 单故事三类图片 job。
4. 多集图片 callback 自动入库。
5. 角色/场景/道具视觉审核与版本。
6. Seedance slot 自动绑定。

退出标准：fake provider 全链稳定；经用户授权后，至少一个真实 provider 完成角色图、场景图、道具图各一组，并保存真实回片与审核证据。

### 阶段 D：真实 GEARS/Seedance 端到端

目标：完成真正的媒体生产，而不是本地 acceptance。

顺序：

1. provider capability 与凭据 preflight。
2. 公网/签名资产交接。
3. submit/poll/callback/retry/idempotency。
4. 回片绑定 canonical shot。
5. 多镜头组装、字幕、音频、片头尾、final manifest。
6. 外部 artifact 与本地 acceptance 分账展示。

退出标准：至少一个批准的项目完成真实图片 → 真实 Seedance/GEARS 视频 → 回调 → 审片 → final delivery；所有外部调用需用户明确授权并记录成本边界。

### 阶段 E：专业发布与长期治理

目标：从技术可用升级为稳定专业生产。

- 15 片型真实项目样本。
- 至少两轮有效修订。
- 三角色真人评审和盲评。
- 性能、成本、失败恢复和发布回滚。
- provider 替换性和 schema 向后兼容。

## 10. 下一段对话的第一个实施切片

不要先继续扩展更多页面，也不要马上调用付费 provider。第一段实现应只处理“统一真相合同”，建议具体范围：

1. 给 `production-board-service.ts` 写一个失败测试：同一 scene 有多个 delivery units 时，Seedance、Production Board、ledger 数量/ID 必须一致。
2. 定义 `shot-plan/v2` 最小 schema 和迁移函数。
3. 让 GEARS delivery、Seedance、Production Board、asset refs 共用 canonical `shot_id`。
4. 给 quality repair 写 no-op 回归测试，禁止分数持平且内容未变时 `applied=true`。
5. 只运行相关测试、Web server 全测、`npm run check`、`git diff --check`。
6. 更新本文档的实施记录；不要把本地 acceptance 记为真实媒体回片。

完成这个切片后，再做 `quality-gates/v2`。如果在一个对话中同时修改 shot identity、质量 schema、资产库和 provider，风险过高。

### 10.1 实施记录（2026-07-19）

阶段 A 的第一个实施切片已完成：

- 新增 `production-shot-plan/v2` 最小合同与确定性 v1 镜头 ID/ledger 迁移；一个 GEARS delivery unit 对应一个 canonical shot。旧场景级 ledger 状态只迁到第一个 canonical shot，不会给拆出的所有镜头虚假完成信用。
- GEARS delivery、Seedance prompt、Production Board、Seedance asset refs 与 shot ledger 现在共用同一 `shot_id`；同一 scene 的多个 delivery units 不再被 Production Board 折叠。
- Production Board 新增 `source_unit_id`，并在单 unit 场景继续保留已有 `gears_segments.script_text`；多 unit 场景按各 delivery unit 保持分段正文和时长。
- 新增统一 `StoryRevisionComparator`：正文/场景必须发生实质变化，目标问题数必须减少或流派分必须严格上升，受保护质量字段不得回退。
- 自动 repair 与项目 quality repair 均已接入该比较器；仅重算质量时记录为 `quality_recomputed_not_repaired`，no-op repair 不再创建项目版本。
- 新增同 scene 多 unit、shot-plan/v1 迁移、非法/重复 shot ID、no-op repair、no-op 项目版本等回归测试。

验证证据：

- 受影响的 5 个测试文件、78 个测试通过。
- Web server 全量 Vitest 通过（命令退出码 0）。
- `npm run check` 通过：visible copy audit、server `tsc --noEmit`、client `vue-tsc --noEmit`。
- 本切片未调用外部文本模型、图片模型、GEARS 或 Seedance provider；测试、placeholder 与本地流程均未记为真实媒体产出。

### 10.2 `quality-gates/v2` 实施记录（2026-07-19）

阶段 A 的第二个实施切片已完成：

- 新增 `quality-gates/v2` 一等合同，拆分 `narrative_gate`、`factual_cultural_gate`、`outline_gate`、`audience_text_gate`、`production_material_gate`、`gears_contract_gate`、`asset_gate` 与 `external_provider_gate`。
- 新增两个独立汇总状态：`story_publishable` 只由故事、事实文化、大纲与观众文本门禁决定；`production_ready` 还要求生产素材、GEARS、真实资产和外部 Provider 全部通过。
- `quality_report.passed`、`quality_passed` 继续保留为兼容字段；读取旧项目时只回填双状态，不会用新工作流静默改写历史聚合摘要。
- 缺少独立 domain-safety 报告的旧故事会显示事实文化门禁“待评估”，但保持旧故事发布兼容；显式 domain-safety blocker 会阻断 `story_publishable`。
- 当前 Story 级质量流无法证明真实资产绑定和外部 Provider 回执，因此这两个生产门禁明确为 `not_evaluated`，不授予生产就绪或真实媒体信用。
- 项目元数据、版本摘要与导出摘要已分别保存 `story_publishable`、`production_ready` 和兼容 `quality_passed`。
- StoryResult、项目详情和项目列表已改为双状态展示；生产素材、GEARS、资产和 Provider 缺口单独列示，不再作为故事正文失败提示。
- 新增故事可发布但生产素材阻断、读时重复富化不污染故事门、事实文化 blocker、项目/版本双状态持久化等回归测试。

验证证据：

- `quality-workflow-service` 与 `project-service` 相关测试共 74 个通过。
- Web server 全量 Vitest 通过（命令退出码 0）。
- `npm run check` 通过：visible copy audit、server `tsc --noEmit`、client `vue-tsc --noEmit`。
- `git diff --check` 通过。
- 本切片未调用外部文本模型、图片模型、GEARS 或 Seedance provider；`not_evaluated`、本地测试和 placeholder 均未记为真实生产就绪。

### 10.3 P0-4 派生状态统一重建第一切片（2026-07-19）

阶段 A 的第三个实施切片已完成主版本写链收口：

- 新增唯一 `rebuildDerivedStoryState()` 服务，集中重建 StoryBlueprint 场景引用、GEARS delivery、完整质量报告、`quality-gates/v2`、Audience Text 和 governed-story domain safety。
- 场景重生成不再只返回基础/类型分；内存结果和真正落盘的项目版本快照都包含同一份完整质量子报告和 canonical GEARS unit/shot identity。
- `persistProjectVersion()` 现在是所有项目新版本写入的统一派生状态边界，覆盖场景重生成、自动质量修复、模型修复 JSON 和 Production Board 修复。
- 首次生成在持久化前统一重建派生状态，但复用针对本次请求素材刚完成的 domain-safety 报告；不会因用户临时原创素材未进入持久 Domain Pack 而被二次查询误判。
- 后续 governed-story 修订在版本提交前重新运行 Domain Pack safety；失败返回 `DOMAIN_SAFETY_VALIDATION_FAILED`，且版本数保持不变。
- domain-safety migration 在写入新版本前也使用同一重建服务，并保留迁移 preflight 已授权的精确 safety 报告。
- GEARS 重建以新 narrative/scene 内容为 canonical，旧 unit 的正文、时长、格数和 identity 不再覆盖新结果；同时保留合法的角色/场景资产和 visual/camera/prompt 工作台覆盖层，避免抹掉已审核的生产修复。

本切片新增或强化的回归边界：

- 场景重生成后 `AudienceText`、`quality-gates/v2`、GEARS script text 和 canonical shot ID 同步更新。
- 磁盘版本快照的 `snapshot.quality_report` 与 `snapshot.story.quality_report` 完全一致，不依赖读取时临时富化掩盖旧数据。
- domain safety 重新校验失败时不创建版本。
- Production Board 服装年代和资产修复在统一 GEARS 重建后仍被保留。
- 首次原创 AI 漫剧生成同时得到事实文化门禁、故事发布状态和独立生产状态。

验证证据：

- 6 个直接相关测试文件、98 个测试通过。
- Web server 全量 Vitest 通过（命令退出码 0）。
- `npm run check` 通过：visible copy audit、server `tsc --noEmit`、client `vue-tsc --noEmit`。
- 本切片未调用外部文本模型、图片模型、GEARS 或 Seedance provider；没有把本地派生重建记作真实媒体生产。

本节记录的是第一切片；legacy `gears_segments`、非版本 `writeCurrentState`、MCP canonical update 和下游镜头身份一致性已在 10.4 的封板切片完成。

### 10.4 阶段 A 封板：派生状态与 MCP 写边界（2026-07-19）

阶段 A 的剩余 P0-4 边界已完成，满足本计划的四项退出标准：

- `rebuildDerivedStoryState()` 现在同步规范化 legacy `gears_segments`。`script_text`、purpose、时长、格数、视觉重点和文化约束从当前 scene/canonical delivery 重建；稳定 `segment_id` 与人工 `segment_prompt_hint` 覆盖层保留，陈旧剧情不会继续流入 Production Board 或 Seedance。
- 补充任务与素材包等非版本 `writeCurrentState` 入口也统一重建 Story 派生状态，并同步当前快照、项目摘要和 source story 的质量报告、GEARS delivery、legacy segments。编辑过的 GEARS Markdown 作为显式人工成果保留。
- `mcp-server` 的 `kb_update_project_version` 已删除项目元数据和版本 JSON 的直接文件写入逻辑。质量修复只作为客户端调用 Web application service 的 `/api/projects/:projectId/repair-quality/apply`；场景重生成和 Production Board 修复因没有这一通用快照端点而 fail closed，必须使用各自 canonical application endpoint。
- MCP 的 `kb_repair_story(auto_apply=true)` 同样通过 canonical application service 创建版本；MCP 单元测试明确证明其本地项目 fixture 不被直接改写。
- MCP quality repair 固定 `allow_no_improvement=false`，application service 继续使用统一 comparator、派生状态重建、domain safety、版本编号与持久化逻辑；拒绝/no-op 结果不会被映射成成功版本。
- 新增“陈旧 Story 派生状态重建”端到端回归：同一场景拆出的 GEARS units、Seedance shot units、Production Board shot units、Seedance ledger 和 asset references 的镜头数量、`shot_id`、`source_unit_id` 完全一致；旧 script text 被清除，人工 prompt 覆盖层保留。
- 场景重生成回归改为验证观众脚本文本承载真实动作、对白和后果，不再要求把“冲突升级/回忆线”等内部质量标签泄露进 `gears_segments.script_text`。

最终验证证据：

- 派生状态、项目当前态、GEARS 保存与镜头 identity 定向回归共 71 项通过；兼容问题修复后的 Web/MCP 定向回归另有 26 项通过。
- Web server 全量 Vitest：1171 项通过，2 项按既有条件跳过，命令退出码 0。
- MCP server 全量 Vitest：477 项通过，命令退出码 0。
- `npm run check` 通过：visible copy audit、server `tsc --noEmit`、client `vue-tsc --noEmit`。
- MCP `npm run build` 与仓库 `git diff --check` 通过。
- 本切片未调用外部文本模型、图片模型、GEARS 或 Seedance provider；本地重建、fixture、mock HTTP 响应和测试结果均未记为真实媒体回片或真实 Provider 成功。

阶段 A 完成度为 100%。按 A–E 五阶段等权口径，整改总计划完成度为 20%；该百分比只表示本审查整改计划的阶段进度，不表示整个代码库或真实媒体制作完成度。

### 10.5 阶段 B 第一切片：六片型家族基础门禁（2026-07-19）

阶段 B 已完成六个片型家族的基础质量合同和第一组黄金/失败回归：

- 新增 `story-family-quality/v1`，15 个 `VideoType` 被确定性映射到 `dramatic_narrative`、`documentary_evidence`、`promotional_communication`、`instructional_learning`、`spatial_landscape`、`social_short_form` 六个家族；每个报告保存检查状态、证据场景 ID、摘要和阻断检查 ID。
- 剧情叙事继续使用现有 dramatic/memory-mosaic 结构验证，并把核心事件、目标阻力、选择行动、高潮后果、转变余味映射为显式家族检查。
- 纪录证据检查纪录问题、来源证据、现实现场、事实/再现边界和证据推进；不再把主角两难当作纪录片基础义务。
- 宣传传播检查价值主张、可验证画面、当代连接、传播记忆句和在地/对象细节；不再因没有剧情高潮而失败。
- 讲解教学检查问题/学习目标、概念层级、例子/示范、复盘/练习和教学视觉辅助。
- 空间/山水检查空间身份、视觉路线、时间/光影/声音和感官留白；黄金山水片可在没有角色、冲突、主角选择和道德主题的情况下通过对应基础门禁。
- 社交短视频检查前三秒钩子、信息密度、字幕节奏、记忆句和竖屏视觉动作。
- 家族报告已经接入中国文化域生成候选评估、质量修复、项目 repair JSON 重校验和 canonical `rebuildDerivedStoryState()`；reference-safety 合并现在保留新的结构化基础报告，不再丢弃扩展字段。
- 新增六家族映射、空间/山水黄金与失败样本、其余四个非剧情家族黄金与失败样本，以及 canonical 派生状态持久化回归。失败样本只报告对应家族缺口，不再出现“缺少主角选择/明确冲突/高潮/精神道德落点”等片型错配。

验证证据：

- 家族基础门禁测试 13 项通过；生成、修复、版本重建相关定向测试 87 项通过。
- Web server 全量 Vitest：135 个测试文件通过、1 个跳过；1184 项测试通过、2 项按既有条件跳过。
- `npm run check` 通过：visible copy audit、server `tsc --noEmit`、client `vue-tsc --noEmit`。
- `git diff --check` 通过。
- 本切片只运行确定性本地验证和 fixture；未调用外部文本模型、图片模型、GEARS 或 Seedance provider，也不授予真人评审或真实媒体产出信用。

阶段 B 当前完成度为 28%。按 A–E 五阶段等权口径，整改总计划完成度为 25.6%；下一切片是 P1-2 场景证据型 signal evaluator 和 15 片型 fixture 扩展。

### 10.6 阶段 B 第二切片：场景证据型流派信号（2026-07-19）

P1-2 的第一阶段已完成：

- `pattern-quality/v1` 升级为 `pattern-quality/v2`。每个 required field、genre beat、narrative pattern、sample signal 和 genre rule 现在保存 `evidence_scene_ids`、`observable_evidence`、`counter_evidence`、`confidence` 与 `repair_target`。
- sample/profile signal 不再只扫描整篇文本。通过信用优先来自场景 `plot`、`key_action`、`conflict`、对白/旁白、视觉提示与镜头建议；史实/来源/再现类信号还可读取对应场景的 `factual_basis`、`fictionalized_elements`、`source_entries` 和文化边界说明。
- narrative-pattern 既有确定性结构 probe 被保留，但如果只在顶层正文出现“目标明确/行动具体”等质量标签、场景里没有对应证据，信号会降为 `weak`，反证明确说明“仅出现质量标签”。
- 证据置信度由实际证据场景数量与证据类型确定；修复目标指向具体场景以及 `plot`、`key_action`、`conflict`、对白、视觉、史实边界等字段，不再只给一条泛化建议。
- StoryResult 的 Pattern Quality 卡会显示弱信号的证据场景或反证和置信度，便于用户判断为什么失败。
- 新增标签泄露不得得分、自然动作证据包含场景 ID/可观察证据/高置信度/修复字段等回归。

验证证据：

- `quality-workflow-service` 定向测试 13 项通过。
- Web server 全量 Vitest：135 个测试文件通过、1 个跳过；1185 项测试通过、2 项按既有条件跳过。
- `npm run check` 通过：visible copy audit、server `tsc --noEmit`、client `vue-tsc --noEmit`。
- 未调用任何外部模型或媒体 Provider。

阶段 B 当前完成度为 44%。按 A–E 五阶段等权口径，整改总计划完成度为 28.8%；下一切片扩展 15 片型的完整/稀疏/失败 fixture，并用同一证据合同校准修复器。

### 10.7 阶段 B 第三切片：15 片型固定质量集（2026-07-19）

15 个 `VideoType` 的完整/稀疏/失败固定 fixture 已建立，共 45 个故事样本：

- 完整样本：验证对应家族基础门禁通过、profile required fields 无缺失、`pattern-quality/v2` 的每个 signal 均包含证据/反证/置信度/修复目标合同。
- 稀疏样本：保留完整可发布正文，故意缺少 production-ready 素材；验证六家族正文门禁不被污染，`production_material_gate` 单独失败且 `production_ready=false`。
- 失败样本：移除对应家族的可观察证据，验证家族报告给出明确 blocking check ID，并阻断 narrative gate；不会用不适配的剧情义务解释非剧情失败。
- fixture required fields 从生产 `GenreStoryProfile` 合同读取并校验，避免测试另造一套必填字段标准。
- 测试目录还校验 15 个片型无重复、无缺失，每种都有三类样本。

验证证据：

- fixture catalog 测试 46 项通过。
- Web server 全量 Vitest：136 个测试文件通过、1 个跳过；1231 项测试通过、2 项按既有条件跳过。
- `npm run check` 和 `git diff --check` 通过。
- 未调用外部模型、真人评审或媒体 Provider；fixture 不能计为专业成稿或真实媒体产出。

阶段 B 当前完成度为 62%。按 A–E 五阶段等权口径，整改总计划完成度为 32.4%；下一切片把修复器改为按片型家族读取 blocking checks、signal repair targets 和素材边界定向修复。

### 10.8 阶段 B 第四切片：按片型家族定向修复（2026-07-19）

质量修复链已经从通用“剧情补强”改为按六个片型家族读取机器报告并定向改写：

- 六个家族分别提供修订角色、重点字段和显式修订要求：剧情叙事、纪录证据、宣传传播、讲解教学、空间山水和社交短视频不再共享一条 AI 漫剧式修复口径。
- `buildRepairActionItems()` 会把失败的 `family_quality_report` 转成独立 `family` repair action，保存失败检查、证据场景和家族字段目标；pattern 弱信号继续带入反证、场景 ID 和字段级 `repair_target`。
- 单故事 repair、项目 quality repair 与 repair JSON 应用路径均读取同一家族修复合同。宣传片会补价值主张、可验证画面、当代连接和记忆句，不再被提示去统一补主角目标；纪录、教学、空间和社交片型同理。
- 修复后仍通过 canonical 质量重算、`StoryRevisionComparator` 和派生状态重建；家族提示不会放宽 no-op、事实文化或 Audience Text 回退边界。

验证证据：

- 15 个失败 fixture 均生成对应家族的结构化 repair action；宣传传播提示词角色与修复要求有独立回归。
- 家族 fixture、quality workflow、单故事 repair 与项目 quality repair 最新定向回归 81 项通过。
- `npm run check` 通过；未调用外部模型或媒体 Provider。

阶段 B 当前完成度为 78%。按 A–E 五阶段等权口径，整改总计划完成度为 35.6%；最后一切片是把机器质量证据对齐到编剧、导演和事实文化三角色真人评审表，并保持真人信用为零。

### 10.9 阶段 B 完成：真人评审表与机器报告对齐（2026-07-19）

阶段 B 的最后一个缺口已经封口：机器报告现在能为真人评审准备证据，但不能生成真人结论或专业通过信用。

- 新增 `story-human-review-alignment/v1`。每个故事固定生成编剧/剧本编辑、类型/导演评审、事实/文化评审三个 section，覆盖现有专业盲评合同的 10 个质量维度。
- 各维度权重直接读取当前片型的 `professional-blind-review-weight-contract/v1`，并保存合同 SHA-256；15 片型不会使用一套等权或剧情专用评审表。
- 家族检查、`pattern-quality/v2` 场景证据/反证和 `quality-gates/v2` 状态被映射为 `supporting_evidence`、`attention_required` 或 `not_evaluated`。稀疏输入的生产素材阻断只进入导演侧生产可执行性待核项，不会反向制造正文失败。
- 所有机器生成的 criterion 固定 `human_verdict=not_reviewed`、`human_score=null`、`human_notes=''`、`counts_as_human_review_credit=false`；顶层固定 `human_review_complete=false`、`human_blind_review_passed=false`、`professional_passed=false`。
- StoryResult 已显示片型家族报告和三角色评审准备表，明确标出机器证据、待核反证、场景 ID、真人分数空值与“真人信用 0”。
- 这份表是当前故事到既有 Stage 8 外部真人盲评的对齐层，不替代实名、独立性、盲化、签名、baseline 权利或外部 review bundle 门禁。

最终验证证据：

- 15 个完整 fixture 均生成 3 角色、10 维度、片型权重摘要和 64 位权重合同 digest；全部家族检查都有评审表来源引用。
- 稀疏宣传样本保持 `story_publishable=true`、`production_ready=false`，生产缺口进入导演评审；纪录失败样本进入真人 attention，但所有真人 verdict 仍为空。
- fixture catalog 63 项通过；quality workflow、repair 和 fixture 定向回归合计 81 项通过。
- Web server 全量 Vitest：137 个测试文件执行，1248 项通过、2 项按既有条件跳过、0 项失败。
- MCP server 全量 Vitest：87 个测试文件、477 项通过；MCP `npm run build` 通过。
- `npm run check` 通过：visible copy audit、server `tsc --noEmit`、client `vue-tsc --noEmit`；`git diff --check` 通过。
- 未调用外部文本模型、图片模型、GEARS 或 Seedance Provider；fixture、机器证据和评审准备表均不计真人评审、专业成稿或真实媒体产出。

阶段 B 完成度为 100%。按 A–E 五阶段等权口径，整改总计划完成度为 40%；该百分比只表示本审查整改计划进度，不表示整个代码库、真人评审或真实媒体制作已经完成。下一阶段进入阶段 C：真实图片资产闭环，先建立统一 `MediaArtifact` / `AssetBinding` 合同与兼容迁移。

### 10.10 阶段 C 主体切片：统一媒体合同、真实入库、图片任务与审核门禁（2026-07-19）

阶段 C 的单故事主体链路已完成，当前仍未调用真实外部图片或视频 Provider：

- 新增统一 `MediaArtifact` / `AssetBinding` / `MediaAssetLibrary` 合同。旧 `seedance-asset-library/v1` 只做 fail-closed 兼容迁移；旧文件路径、外部 URL、Provider asset ID 和 SVG placeholder 都不会自动获得完整性、版权、真人审核或生产信用。
- 正式生产信用只在同一绑定同时满足“SHA-256 字节完整性已验证、版权状态 authorized、真人视觉审核 approved、非 placeholder”时产生。内容相同的 artifact 按 hash 去重，但不同镜头/素材槽位仍保留独立 binding。
- 上传链增加 magic-byte、声明 MIME、扩展名、大小、图片尺寸/像素和基础音视频元数据检查；假 PNG 与 SVG placeholder 在写盘前拒绝。通过检查的文件写入项目内 content-addressed immutable originals，并提供项目鉴权、hash 复核、拒绝符号链接和 `nosniff` 的认证预览接口。
- Production Board 新增 `story-image-asset-job-plan/v1`，确定性生成角色、场景、道具三类图片需求，保存 source unit、场景/镜头、素材槽位、干净提示词与 negative constraints；计划固定 `provider_invoked=false`，不把任务清单当成供应商执行。
- GEARS 执行合同新增独立 `prop_image` 类型；单故事前端可选择人物图、场景图、道具图、故事板图或视频任务，同一选择一致作用于本地账本、真实 API 提交、状态同步和本地验收。活跃重复任务按 job type + source unit 幂等跳过。
- GEARS 人物/场景/道具图片完成回调会按 `job_type + source_unit_id` 精确归档到当前素材槽位，保存 Provider、模型、prompt digest 和历史事件。只接受非示例域、非 local acceptance、非 localhost/私网的外部 URL；未下载并验证真实字节前固定 `bound_unverified`、版权待定、真人审核待定、生产信用为零。
- 多集 AI 漫剧的 `character_image`、`scene_image`、`storyboard_image` ready callback 也会按来源单元自动归档到系列兼容资产库，记录 Provider artifact ID、MIME、模型、prompt digest 与幂等历史事件；版权和真人审核固定待定、无内容 hash，仍不获得统一媒体生产信用。场景图任务同时覆盖 GEARS delivery 场景和 Seedance 实际镜头 location，避免名称标准化后任务存在但无法绑定交付资产。
- 多集工作台已补齐真实图片上传、magic-byte 校验、内容寻址不可变存储、鉴权预览和 hash 复核；系列图片面板显示完整性、版权、真人视觉审核与 production credit。系列审核同样要求实名 `review:operate`、当前 SHA-256 和审核意见，授权需凭证，local bypass 返回 403；替换字节后旧授权与审核自动归零。
- 新增媒体版权/真人视觉审核写接口和前端认证预览旁审核面板。真人通过必须绑定当前文件 SHA-256 并填写审核意见；版权通过必须附授权凭证。只有真实登录且拥有 `review:operate` 的服务端身份可以签署，本地 bypass 明确返回 403。替换文件会重置授权和真人审核状态，旧批准不能跨内容 hash 继承。
- Delivery Manifest 与 Production Readiness 已切换到统一媒体合同：旧 `production_asset_ready_count` 在界面/Markdown 只标记“结构已绑定”，不能把项目推进到 ready。交付导出新增 `media-asset-library.json` 与 `image-asset-job-plan.json`，readiness 单列未获得生产资格的 binding 数量。

当前验证证据：

- 图片任务/媒体合同专项测试 32 项通过；项目服务最新 66 项通过；项目与 Seedance/GEARS 联合定向回归 73 项通过。
- 多集漫画视觉任务专项回归覆盖角色图、场景图、分镜图三类提交 → ready callback → 资产归档 → 资产报告绑定，以及重复 callback 不重复写历史；`outline-service` 全文件 32 项通过。
- API 全量测试 206 项通过，覆盖单故事和多集的真实 PNG ingest、认证预览、假 PNG 拒绝和本地 bypass 不得签署真人审核。
- Web server 最近一次全量 Vitest 为 139 个测试文件（138 通过、1 条件跳过），1260 项通过、2 项条件跳过、0 失败；`npm run check` 通过 visible copy audit、server `tsc --noEmit` 和 client `vue-tsc --noEmit`。
- 本切片没有调用外部图片模型、GEARS 或 Seedance Provider。fake/local job、外部 URL fixture、placeholder、local acceptance、机器状态与开发者直调测试均不计真实媒体、真人评审或正式生产通过。

阶段 C 当前完成度为 99%。按 A–E 五阶段等权口径，整改总计划完成度为 59.8%。代码库内可在不调用外部 Provider 的部分已经收口；最后 1% 必须在用户明确授权并提供真实服务配置后，完成至少一个真实 Provider 项目的图片 → 视频 → 回调 → 审片闭环。当前可复现 callback fixture 和本地上传只证明合同、字节完整性、权限及归档行为，不计真实 Provider 或真实媒体验收。

### 10.11 阶段 D 代码侧封板：外呼授权、素材交接与真实执行前门禁（2026-07-19）

阶段 D 在不调用真实外部 Provider 的代码侧工作已收口；真实媒体退出标准仍未满足：

- `GearsJobSubmitRequest` 新增严格 `external_call_authorization`：真实 HTTP 提交必须显式记录授权编号、非负最高成本、ISO 4217 币种和数据传输确认。缺失或非法授权在 capability probe 和 submit 之前失败，网络调用次数为零。
- 项目和 AI 漫剧系列工作台在真实 GEARS 提交前显示成本上限与币种，并通过交互确认生成带当前 actor 和时间的授权引用；本地账本模式不伪造外部授权。
- 系统级 GEARS live smoke 也接入同一授权合同，关闭了 `execute=true` 的旁路。执行报告保存授权编号和成本边界；dry-run 不需要外呼授权，也不会发起网络请求。
- `P1-6 provider 资产可达性预检` 已落地为共享门禁。真实 `seedance_video` 提交逐镜头解析 required `asset_slots`，只接受同时具有不可变 SHA-256、版权授权依据、可归属真人视觉审核和 production credit 的素材。
- Provider 交接只允许公网 HTTPS/短期签名 URL 或非本地 Provider asset ID。HTTP、localhost、私网 IP、`.local/.internal/.test/.invalid`、明显 placeholder、本地路径和 `local_upload` file ID 全部 fail closed；预检本身不下载 URL，也不产生额外外呼。
- 真实请求携带 `gears-provider-asset-input/v1`，包括素材槽位、内容 hash、版权依据、审核人/时间和交付方式。GEARS Job Ledger 只保存 `gears-provider-asset-handoff-audit/v1` 的 hash、槽位、URL origin 或 Provider file ID，不保存签名 URL 查询参数。
- 单故事和系列图片审核面板在 production credit 产生后可设置 Provider 公网交付 URL。更新交付 URL 保留当前内容 hash、版权和真人审核；替换真实字节仍会把旧批准归零。
- 修复了相同内容 hash 复用于多个素材槽时的审核查找：现在按 `AssetBinding.artifact_id` 解析不可变 artifact，不再依赖去重 artifact 的首个 provenance。
- Production Readiness Automation 的真实提交步骤固定 `external_execution`、`can_auto_execute=false`，payload hint 带不可直接执行的授权占位符，prerequisites 明确要求受审素材与公网/Provider 交接。
- 既有 capability preflight、submit/poll/callback/retry/idempotency、canonical shot 回片绑定、多镜头后期装配和 external/local artifact 分账继续保留；本切片没有把 live smoke fixture 或本地 acceptance 升格为真实媒体证据。

验证证据：

- Provider 素材交接正反例矩阵 9 项通过，覆盖公网签名 URL 脱敏、HTTP、本机/私网、placeholder、本地 file ID、Provider file ID 和缺审核信用。
- 项目服务全文件 68 项、系列 outline 服务 32 项、API 全文件 209 项通过；API 覆盖项目/系列真实提交缺授权 400、live smoke 缺授权 400 和网络调用为零。
- Web server 全量 Vitest：140 个测试文件执行，139 个通过、1 个条件跳过；1274 项通过、2 项条件跳过、0 失败。
- `npm run check` 通过 visible copy audit、server `tsc --noEmit` 和 client `vue-tsc --noEmit`；server/client 生产构建与 `git diff --check` 通过。
- 所有“真实 HTTP”回归均由本地 `fetch` fixture 提供，不是外部 Provider 回执。本切片未调用 GEARS、Seedance、图片模型或其他付费服务，未产生真实成本和真实媒体。

阶段 D 当前完成度为 90%。按 A–E 五阶段等权口径，整改总计划完成度为 77.8%。剩余 10% 必须由用户提供真实执行 Worker/Provider 配置、批准项目、可达受审素材和明确成本授权后，完成真实 submit → poll/callback → 审片 → final delivery 并保存成本与回片证据；在此之前不得把代码回归、live smoke fixture 或 local acceptance 报为阶段 D 完成。

### 10.12 阶段 E 第一、二切片：Worker 可替换性与实际费用结算（2026-07-19）

阶段 E 已完成 Provider 可替换性门禁和实际费用治理的首轮闭环；仍未调用真实外部 Provider：

- `gears-execution-worker-capabilities/v1` 以向后兼容的可选字段新增 `provider_asset_handoff_supported`。无受审素材输入的旧 v1 Worker 继续可用；只要请求包含 `provider_asset_inputs`，Worker 必须显式声明支持，否则系统只完成 capability GET，不发送生产 payload。
- GEARS 系统合同新增 portability 元数据，明确兼容 schema、素材输入 schema、能力声明字段、缺失声明时 fail closed、持久化审计 schema，以及签名 URL 查询参数不得写入账本。
- callback 和 status poll 合同接受 `actual_cost_amount / actualCostAmount / cost_amount / costAmount` 与 `cost_currency / costCurrency / currency`，统一归一化为非负有限金额和三位大写币种。
- 每个 GEARS Job Ledger item 新增 `execution_cost`，保存 Provider 实报金额、币种、报告时间、授权号、授权上限、同授权批次累计金额和边界状态；callback event 同步保存原始归一化费用，便于重放与审计。
- 成本边界按 `authorization_reference` 聚合，而不是只比较单个 job。多个 job 单笔均未超限、但批次实际费用合计超过同一授权上限时，整批均标记 `exceeded_authorization`；币种不一致和缺失授权也独立标记。
- 项目和系列 callback/poll 共用同一费用合并与批次重算逻辑。已授权外部 job 到达终态却没有实报费用时记为“待结算”；旧本地 mock 和没有外呼授权的 local acceptance 不会伪造费用结算记录。
- Production Readiness 对超预算、币种不一致、缺失授权和终态待结算全部创建 blocking issue；在财务复核、重新授权或 Provider 补回零/实际费用前不得最终交付。
- 单故事和系列工作台显示已结算 job 数、按币种汇总的实际金额、待结算数和费用越界数；展示汇总按每个 job 的实际金额相加，不会把每条账本中重复保存的授权批次合计再次累加。
- 新增 `gears-execution-operational-metrics/v1`，只统计具有真实外呼授权的 job，生成执行耗时 P50/P95、callback 到达延迟 P50/P95、真实外部产出率、失败率、稳定失败分类、轮询失败和按币种实际费用。本地 acceptance 即使 ready 也固定排除。
- 项目和系列 Production Readiness、Markdown 与工作台显示同一份运营指标；没有真实外呼样本时保持样本数为零，不用 fixture 或本地占位数据伪造性能与产出率。
- 新增 `gears-execution-recovery-plan/v1`。瞬时 Provider/网络/渲染、输入/素材合同、鉴权、配额、内容政策和未知失败映射到稳定恢复策略；只有不创建新媒体任务的 `status_resync` 可以自动执行。
- 任何媒体执行重试都固定 `can_auto_execute=false`，要求操作员复核并重新提供 `external_call_authorization`；旧成本授权不得静默用于重试。内容政策和未知失败不得自动重试。
- AI 漫剧本地 final delivery 现在为每次真实装配建立不可变 release archive：视频和 manifest 写入独立 release 目录，记录 SHA-256、字节数、输出 profile、canonical/archived path，并保留最近 20 版历史。dry-run、失败装配和外部 URL callback 不会伪造本地不可变 release。
- 新增受保护的 final delivery rollback：只接受已验证且拥有 `production:write` 的非 local-bypass 操作员，必须显式确认和填写原因；在覆盖 canonical 视频与 manifest 前同时流式复核归档 hash/字节数，成功后再次核对发布 hash 并写入实名回滚事件。
- 系列工作台显示当前 release ID/短 hash 与历史回滚入口；篡改归档、缺失 release、回滚当前版本、无确认、无原因和 local bypass 均 fail closed。

验证证据：

- Worker 替换门禁验证了含受审素材但缺少 capability 声明时只探测能力、不发送 Provider payload；无素材旧 Worker 保持兼容。
- 费用、指标与恢复专项测试验证别名归一化、同授权批次 `6 + 5 > 10 CNY` 的聚合越界、终态待结算、执行/回调分位数、本地 acceptance 排除，以及四类恢复策略；`gears-execution-service` 31 项通过。
- 项目真实 HTTP fixture 验证 `13 > 12.5 CNY` 写账并阻断 readiness；系列真实 HTTP fixture 验证 `10 <= 15 CNY` 正常结算且不误报。项目服务 68 项、系列服务 32 项通过。
- API 合同测试 210 项通过，新增 local-bypass 发布回滚拒绝回归；并行资源竞争造成的一次既有 5 秒用例超时已在串行环境复跑通过。
- final delivery 定向回归完成两次独立装配、两份不可变归档、篡改 hash 拒绝、local bypass 拒绝和实名恢复上一版字节；canonical 输出在成功回滚后与目标 release 完全一致。
- Web server 全量 Vitest：140 个测试文件执行，139 个通过、1 个条件跳过；1281 项通过、2 项条件跳过、0 失败。
- `npm run check`、server/client 生产构建和 `git diff --check` 通过。
- 所有 HTTP 行为均由本地 `fetch` fixture 提供；没有真实 Provider 回执、真实账单或真实媒体，实际成本字段只证明合同和治理行为，不计阶段 D 的真实执行证据。

阶段 E 当前完成度为 52%。按 A–E 五阶段等权口径，整改总计划完成度为 88.2%。代码侧已具备性能/成本观测、失败恢复计划、Provider 可替换门禁和可验证本地发布回滚；剩余进度主要依赖 15 片型真实项目、至少两轮有效修订、三角色真人盲评、真实 Provider 运行样本与生产环境恢复演练，不能由 fixture、机器报告或本地归档测试替代。

### 10.13 Web/MCP canonical 生成与引擎透明性（2026-07-19）

P1-7 和 P0-6 的代码侧收口已完成，且本轮未执行外部模型或付费 Provider：

- MCP 新增唯一 canonical 入口 `kb_story_agent_generate`。它是 `/api/stories/generate` 的薄客户端，请求由 Web `StoryGenerateRequestSchema` 终审，并复用同一 domain registry、quality gates、revision comparator、derived-state rebuild、项目持久化和产品访问控制。
- canonical MCP 必须显式配置 `STORY_AGENT_BASE_URL`；未配置时在 `fetch` 之前 fail closed，不回退为本地 Markdown writer。生产访问模式可从 `STORY_AGENT_MCP_ACCESS_TOKEN` 注入 Bearer token，不允许把 token 作为 MCP 工具参数传入或返回。
- `kb_generate_story` 和 `kb_generate_script` 保留兼容，但描述与返回合同都显式标记 `legacy_writer=true`、`canonical_tool=kb_story_agent_generate`、`counts_as_canonical_generation=false`。MVP 工具计数只统计 canonical 入口，不把两个 legacy writer 计入 Story Agent 闭环。
- 新增 `/api/system/story-generation-capabilities`，只读报告显式本地引擎，并独立报告全文 `STORY_GEN_COMMAND` 与场景 `SCENE_REGEN_COMMAND` adapter 配置、各 profile 可用性、数据外发边界与“执行前无法确知实际费用”。读取该端点不执行生成，`real_external_generation_performed=false`。
- 模型目录新增 `local_story_engine`。生成请求未指定 profile 时安全默认本地引擎；非法 ID 由共享 schema 直接拒绝，不再静默解析为推荐模型。显式本地 profile 不启动 `STORY_GEN_COMMAND`。
- 单片创作页先读取 capability：外部全文 adapter 未就绪时禁用 Claude/GPT profile，默认本地引擎，并展示实际引擎、数据外发和费用边界。生成结果保存并显示 `requested_model_profile_id`、`effective_engine`、`external_model_call_performed` 和 `generation_reason`。项目局部重写面板同样根据独立 scene adapter 状态禁用不可用 profile 并展示外发/费用边界。

验证证据：

- canonical MCP bridge、两个 legacy writer、MVP 工具面和 capability/引擎边界定向回归通过；MCP 全量为 89 个测试文件、483 项测试全部通过，MCP TypeScript 构建通过。
- Web API 验证 capability 响应、非法 profile 400 和省略 profile 时的 `local_only`；额外验证显式本地 profile 在全文/场景外部命令已配置时仍不启动命令。Web server 全量 Vitest：141 个测试文件执行，140 个通过、1 个条件跳过；1291 项通过、2 项条件跳过、0 失败。
- `npm run check`、server/client 生产构建和 `git diff --check` 通过。测试中的 HTTP 均为本地 Supertest/fetch fixture；没有生成外部模型成果、真实费用或真实媒体凭证。

阶段 E 当前完成度为 62%。按 A–E 五阶段等权口径，整改总计划完成度为 90.2%。代码侧已再消除两个可造成虚假完成感的语义缺口：MCP legacy writer 不再冒充正式生成，未配置全文或场景外部引擎时不再以 Claude/GPT 可用态呈现。剩余 38% 仍主要是真实项目、真人多轮修订/盲评、真实 Provider 运行样本、成本凭证和生产恢复演练；不能用本地回归补足。

### 10.14 阶段 E 第四切片：project core/version repository 首轮拆分（2026-07-19）

P1-8 已按“先刻画、再提取”的约束开始实施，本切片只移动纯项目核心合同，不改变 API、持久化格式或仓储事务语义：

- 新增 `project-core-service.ts`，集中管理 15 片型白名单、project/version ID 格式、项目仓储根目录与版本路径、仓储 provider 创建，以及 `current_version_id + version_count + updated_at` 乐观并发期望。
- `project-service.ts` 继续复用同一 `buildProjectId` 导出，现有调用方无需迁移；仓储写入、事务恢复、版本快照和 current state 更新仍走原 `ProjectRepository` 合同。
- `nextProjectUpdatedAt` 的单调递增规则被保留：系统时间落后于已保存时间时，仍严格使用上一时间戳加 1 毫秒。
- 新增 5 项 characterization tests，覆盖 ID 往返/拒绝非法片型、并发期望、时间戳单调性和 override generated root 下的路径约束。
- 该切片将超大服务减少到 12,172 行，是能力拆分的第一个稳定边界；后续仍需依次拆出 production board/readiness、asset library、GEARS/Seedance ledger、callback application 和 final delivery。

验证证据：

- 新增 project core 与既有 repository 定向回归 18 项通过；项目服务、repository provider 与 SQLite repository 联合定向回归 77 项通过。
- Web server 全量 Vitest：142 个测试文件执行，141 个通过、1 个条件跳过；1296 项通过、2 项条件跳过、0 失败。
- MCP server 全量 Vitest：89 个测试文件、483 项全部通过。
- `npm run check` 通过 visible copy audit、server `tsc --noEmit` 和 client `vue-tsc --noEmit`；server/client/MCP 生产构建与 `git diff --check` 通过。
- 本切片没有调用外部文本模型、图片模型、GEARS、Seedance 或其他付费 Provider，也没有把 fixture、本地 acceptance 或构建产物记为真实生产证据。

阶段 E 当前完成度为 65%。按 A–E 五阶段等权口径，整改总计划完成度为 90.8%。新增 0.6 个百分点只代表 P1-8 首个可验证拆分边界完成；真实项目、真人多轮修订/盲评、真实 Provider 样本、成本凭证与生产恢复演练仍然不能由本地回归补足。

### 10.15 阶段 E 第五切片：Seedance Provider 队列与 callback 策略拆分（2026-07-20）

P1-8 第二切片完成了两个相邻的纯决策边界，真实 Provider I/O、项目版本提交和 callback 落库仍保留在原集成层：

- 新增 `seedance-provider-queue-service.ts`，统一 Provider queue batch 滚动窗口、poll target 过滤、等待分钟数、状态计数、批次超时摘要、operator attention 排序，以及 retry reason/priority/candidate/can_resubmit 门禁。
- 永久输入失败继续 fail closed：`asset_missing`、`prompt_invalid`、`content_policy`、额度与鉴权问题不会被自动标记为可重提；timeout、rate limit、server/network 类失败仍保留高优先级人工重试建议。
- 新增 `seedance-provider-callback-policy-service.ts`，集中 Provider 状态别名归一化、显式 failure category、稳定错误码、英文/中文自由文本分类和操作员状态文案。显式稳定分类优先于 Provider 错误文本，未知但有失败信息的状态不会误记 ready。
- 拆分过程中联合回归首次暴露轮询预归一化仍依赖未导出的 `normalizeProviderFailureCategory`。该运行期失败被定向复现并通过显式模块出口修复，没有用跳过、放宽断言或 fixture 规避。
- `project-service.ts` 从 12,172 行降至 11,717 行，净移出 455 行；Provider submit/poll HTTP、鉴权/HMAC、callback 解析、项目仓储事务和版本写入未改变。

验证证据：

- 新增 9 项 characterization tests，覆盖 poll checked/pollable 区分、当前 ledger 覆盖 queue 快照、超时/注意项、永久失败重提阻断、完整零值计数、状态别名、分类优先级、稳定错误码和操作员文案。
- queue/callback policy 与项目服务联合定向回归 77 项通过。
- Web server 全量 Vitest：144 个测试文件执行，143 个通过、1 个条件跳过；1305 项通过、2 项条件跳过、0 失败。
- `npm run check` 通过 visible copy audit、server `tsc --noEmit` 和 client `vue-tsc --noEmit`；server 生产构建与 `git diff --check` 通过。
- MCP 本轮未修改，沿用提交 `5ff20d87` 前已验证的 89 个测试文件、483 项全绿基线；未把旧结果误报为本轮重跑。
- 本切片未调用外部文本/图片模型、GEARS、Seedance 或其他付费 Provider；本地 fetch fixture 仍不计真实回调、真实成本或真实媒体。

阶段 E 当前完成度为 68%。按 A–E 五阶段等权口径，整改总计划完成度为 91.4%。新增 0.6 个百分点只表示 P1-8 第二个可验证拆分边界完成；阶段 C/D 的真实 Provider 闭环和阶段 E 的真人盲评、真实成本样本及生产恢复演练仍须外部证据，不能由重构测试补足。

### 10.16 阶段 E 第六切片：Production Readiness 纯策略拆分（2026-07-20）

P1-8 第三切片把 readiness 的确定性政策与项目 application orchestration 分开；项目读取、问题/动作组装、workflow、自动化执行和仓储写入均未迁移：

- 新增 `project-production-readiness-policy-service.ts`，集中 Seedance shot 状态计数、GEARS ledger 汇总、local acceptance 与 external artifact 分账、lane 状态/分数、交付阶段分数、总体 blocker/warning 惩罚和 readiness Markdown 渲染。
- `LOCAL_GEARS_ACCEPTANCE_ARTIFACT_BASE_URL` 成为跨 callback、验收与 readiness 共用的显式模块常量；role、metadata 标记或本地 acceptance URL 任一命中时仍只记本地验收信用。
- local-only ready job 固定 `ready_without_external_artifact > 0`，GEARS lane 保持 `needs_action`，分数上限为当前本地验收信用；只有真实外部 artifact 才能使单 job 全量外部 ready。ready 但完全没有 artifact 继续直接阻断。
- shot lane 继续保持“无镜头或任一失败即 blocked”；active 只获得部分分数。总体分数仍先平均 lanes，再按每个 blocker 扣 6 分、warning 扣 2 分，不能用高分 lane 掩盖阻断。
- `project-service.ts` 从 11,717 行降至 11,410 行，本切片净移出 307 行；三轮 P1-8 已累计从 12,232 行降至 11,410 行，项目读取和真实执行边界不变。

验证证据：

- 新增 5 项 characterization tests，覆盖 local/external/missing artifact 三账分离、local-only 不得外部 ready、shot 状态/分数、总体阻断惩罚和 delivery stage/export 分账。
- readiness policy 与项目服务联合定向回归 73 项通过。
- Web server 全量 Vitest：145 个测试文件执行，144 个通过、1 个条件跳过；1310 项通过、2 项条件跳过、0 失败。
- `npm run check` 通过 visible copy audit、server `tsc --noEmit` 和 client `vue-tsc --noEmit`；server 生产构建与 `git diff --check` 通过。
- MCP 本轮未修改，继续沿用提交 `5ff20d87` 前已验证的 89 个测试文件、483 项全绿基线，没有把该基线写成本轮重跑。
- 本切片未调用真实模型、GEARS、Seedance 或其他外部 Provider；readiness fixture 和 local acceptance 仍不计真实媒体、真实回调、真实成本或真人审片。

阶段 E 当前完成度为 71%。按 A–E 五阶段等权口径，整改总计划完成度为 92.0%。新增 0.6 个百分点只表示 P1-8 第三个可验证拆分边界完成；阶段 C/D 的真实 Provider 闭环和阶段 E 的真人盲评、真实成本样本及生产恢复演练仍须外部证据。

### 10.17 阶段 E 第七切片：GEARS external artifact 与 callback preflight 策略拆分（2026-07-20）

P1-8 第四切片把 GEARS 外部回片的信任与匹配策略从项目 application service 中移出，callback 写账、图片 artifact 归档和仓储事务仍保留原位：

- 新增 `gears-external-artifact-policy-service.ts`，统一 local acceptance 常量、结构化 artifact/URL 分账、public HTTP(S) 检查、placeholder 域名、localhost/私网 IPv4/IPv6、本地文件拒绝、生产 URL 判定，以及 artifact metadata/filename 安全提取。
- Production Readiness 改为依赖 artifact policy，不再自行维护 local/external 判定；callback preflight、callback application、handoff 与 readiness 现在引用同一条 artifact 信任边界。
- 新增 `gears-external-callback-policy-service.ts`，固定 ledger 匹配顺序：精确 `gears_job_id` 优先，其次 `idempotency_key + job_type`，最后 `source_unit_id + job_type`。多匹配继续返回明确歧义错误，不静默选择首项。
- preflight issue 字段映射和 Markdown 审计报告也进入同一策略模块；阻断/提醒、callback 索引、source unit、job ID 与 would-update 状态保持原合同。
- 联合回归曾因旧 readiness 测试仍从原模块读取已迁移常量而产生 `undefined/shot-1.mp4`。修复只更新常量来源，未放宽“local acceptance 不得计 external ready”的生产期望。
- `project-service.ts` 从 11,410 行降至 11,246 行，本切片净移出 164 行；四轮 P1-8 已累计从 12,232 行降至 11,246 行。

验证证据：

- 新增 5 项 characterization tests，覆盖 job ID 优先匹配、job type 消歧、public/placeholder/local/private/file URL 矩阵、local/external 双账和 preflight/metadata 映射。
- artifact/callback policy、readiness policy 与项目服务联合定向回归 78 项通过。
- Web server 全量 Vitest：146 个测试文件执行，145 个通过、1 个条件跳过；1315 项通过、2 项条件跳过、0 失败。
- `npm run check` 通过 visible copy audit、server `tsc --noEmit` 和 client `vue-tsc --noEmit`；server 生产构建与 `git diff --check` 通过。
- MCP 本轮未修改，继续沿用提交 `5ff20d87` 前已验证的 89 个测试文件、483 项全绿基线，没有误报为本轮重跑。
- 本切片没有下载 artifact，也没有调用 GEARS、Seedance、外部模型或付费 Provider；public URL fixture 只验证分类合同，不计真实可达性、真实媒体或真实回片。

阶段 E 当前完成度为 74%。按 A–E 五阶段等权口径，整改总计划完成度为 92.6%。新增 0.6 个百分点只表示 P1-8 第四个可验证拆分边界完成；真实 Provider 闭环、真人盲评、成本凭证与生产恢复演练仍须外部证据。

### 10.18 阶段 E 第八切片：GEARS callback ledger application 拆分（2026-07-20）

P1-8 第五切片把 callback 到 ledger item 的确定性状态应用和本地验收候选选择移出 `project-service.ts`；项目读取、图片归档、成本批次重算和仓储写入仍保留原 application flow：

- 新增 `project-gears-ledger-application-service.ts`，集中 sync candidate 的 `job_type`、source unit/job ID、terminal、limit/skipped 规则，以及 callback 对单条 ledger item 的字段合并。
- terminal ledger 收到非 terminal callback 时继续拒绝状态回退，并保留已完成 artifact、进度、失败上下文和 `completed_at`；callback event 明确记录 `status_regression_ignored=true` 与实际 `applied_status`。
- terminal→terminal 变更仍可应用并记录 `terminal_status_changed`；ready callback 缺进度时固定补 100%，重复相同 terminal 状态继续保留首次完成时间。
- callback 正常应用继续清除旧 poll error，合并实际费用，追加有界 callback events；application service 仍在单项更新后执行授权批次成本重算，再写项目仓储。
- local acceptance URL 保持 source unit 映射优先于 job ID 映射，fallback 对 project/source ID 编码；默认只选择 `local-gears-` job，只有显式 `include_external_jobs=true` 才纳入外部 job。
- `project-service.ts` 从 11,246 行降至 11,118 行，本切片净移出 128 行；五轮 P1-8 已累计从 12,232 行降至 11,118 行。

验证证据：

- 新增 7 项 characterization tests，覆盖候选筛选/limit/skipped、显式包含终态、terminal 回退保护、terminal 状态变更、ready 进度/完成时间、本地 URL 构造和外部 job 排除。
- ledger application 与项目服务联合定向回归 75 项通过。
- Web server 全量 Vitest：147 个测试文件执行，146 个通过、1 个条件跳过；1322 项通过、2 项条件跳过、0 失败。
- `npm run check` 通过 visible copy audit、server `tsc --noEmit` 和 client `vue-tsc --noEmit`；server 生产构建与 `git diff --check` 通过。
- MCP 本轮未修改，继续沿用提交 `5ff20d87` 前已验证的 89 个测试文件、483 项全绿基线，没有误报为本轮重跑。
- 本切片未调用真实 GEARS/Seedance/模型 Provider；local acceptance URL 仍只用于本地链路验收，不计外部回片或生产完成。

阶段 E 当前完成度为 77%。按 A–E 五阶段等权口径，整改总计划完成度为 93.2%。新增 0.6 个百分点只表示 P1-8 第五个可验证拆分边界完成；真实 Provider 闭环、真人盲评、成本凭证与生产恢复演练仍须外部证据。

### 10.19 阶段 E 第九切片：GEARS external callback handoff 纯构建拆分（2026-07-20）

P1-8 第六切片把 GEARS 外部回片交接包的确定性构建逻辑移出 `project-service.ts`；项目读取、Production Board/ledger 归一化、候选任务筛选和仓储边界保持在原 application orchestration：

- 新增 `gears-external-callback-handoff-service.ts`，集中 local acceptance/external artifact URL 去重分账、单项 callback placeholder sample、批量 sample 与替换约束、preflight/safe-import 路径、公开 URL 前缀推导、curl 命令、operator checklist 和 Markdown 渲染。
- placeholder `https://gears.example/...` 继续显式标注为导入前必须替换的假地址；路径中的 project/source unit 标识继续编码，不把 sample、local acceptance 或 public URL fixture 计作真实回片。
- 公开 callback URL 带反向代理路径前缀时，preflight 与 safe-import URL 继续继承该前缀；只有相对 callback 地址时，curl 保持 `$STORY_AGENT_BASE_URL` 运行期展开，不把 secret 写进项目级交接命令。
- Markdown 保留 callback/preflight/safe-import 元数据、使用边界、两步命令、批量 payload、逐镜头 callback sample 和 Seedance prompt；没有待回片 job 时继续输出明确空状态。
- `project-service.ts` 从 11,118 行降至 10,931 行，本切片净移出 187 行；六轮 P1-8 已累计从 12,232 行降至 10,931 行，共移出 1,301 行。

验证证据：

- 新增 8 项 characterization tests，覆盖单项/批量 sample、项目路径编码、代理前缀 URL、公开/相对 curl、local/external URL 分账、交接 Markdown 和 checklist 顺序。
- handoff builder 与项目服务联合定向回归 76 项通过。
- Web server 全量 Vitest：148 个测试文件执行，147 个通过、1 个条件跳过；1330 项通过、2 项条件跳过、0 失败。
- `npm run check` 通过 visible copy audit、server `tsc --noEmit` 和 client `vue-tsc --noEmit`；server 生产构建与 `git diff --check` 通过。
- MCP 本轮未修改，继续沿用提交 `5ff20d87` 前已验证的 89 个测试文件、483 项全绿基线，没有误报为本轮重跑。
- 本切片未调用真实 GEARS、Seedance、文本/图片模型或付费 Provider；placeholder sample、local acceptance、测试 URL 和 Markdown 都只计本地合同证据。

阶段 E 当前完成度为 80%。按 A–E 五阶段等权口径，整改总计划完成度为 93.8%。新增 0.6 个百分点只表示 P1-8 第六个可验证拆分边界完成；真实 Provider 闭环、真人盲评、成本凭证与生产恢复演练仍须外部证据。

### 10.20 阶段 E 第十切片：GEARS external callback handoff 纯组装收口（2026-07-20）

P1-8 第七切片继续把 handoff prompt、item 和 package 的确定性组装收进 `gears-external-callback-handoff-service.ts`；`project-service.ts` 现在只读取项目、构建 Production Board、归一化 ledger、解析环境 callback URL，再调用纯构建器：

- 新增 `gearsExternalHandoffPrompt`，只从结构化 shot unit 映射 duration、characters、location、`script_text`、`visual_prompt`、camera、Seedance prompt、素材槽位、校验说明和负向约束，不混入 source summary、质量报告或内部分析字段。
- 新增 `buildGearsExternalCallbackHandoffItems`，只选择 `seedance_video`、未 failed/rejected/canceled 且缺少真实 external artifact 的 job；已有外部回片、非视频任务和不可继续任务不会进入交接清单。
- source scene 优先沿用 ledger 显式值，缺失时才回退到同 shot ID 的 Production Board；callback identity、local/external artifact 分账、prompt 与 callback URL 同时进入单项合同。
- 新增 `buildGearsExternalCallbackHandoffPackage`，统一总 job、external ready、local acceptance ready、pending external artifact 计数，以及 preflight/safe-import 地址、两步 curl、批量 sample、checklist 和 Markdown；导出时间改为显式输入，纯测试不读取系统时间。
- `project-service.ts` 从 10,931 行降至 10,844 行，本切片净移出 87 行；七轮 P1-8 已累计从 12,232 行降至 10,844 行，共移出 1,388 行。

验证证据：

- 在同一 handoff 测试文件新增 3 项 characterization tests，覆盖 prompt 字段隔离、job 过滤/shot join 和完整 package 的计数/公开端点/命令/Markdown；该模块现有 11 项直接测试。
- handoff builder 与项目服务联合定向回归 79 项通过。
- Web server 全量 Vitest：148 个测试文件执行，147 个通过、1 个条件跳过；1333 项通过、2 项条件跳过、0 失败。
- `npm run check` 通过 visible copy audit、server `tsc --noEmit` 和 client `vue-tsc --noEmit`；server 生产构建与 `git diff --check` 通过。
- MCP 本轮未修改，继续沿用提交 `5ff20d87` 前已验证的 89 个测试文件、483 项全绿基线，没有误报为本轮重跑。
- 本切片未调用真实 GEARS、Seedance、文本/图片模型或付费 Provider；本地 ledger、placeholder URL 和 prompt fixture 只验证合同，不计真实生产产出。

阶段 E 当前完成度为 83%。按 A–E 五阶段等权口径，整改总计划完成度为 94.4%。新增 0.6 个百分点只表示 P1-8 第七个可验证拆分边界完成；真实 Provider 闭环、真人盲评、成本凭证与生产恢复演练仍须外部证据。

### 10.21 阶段 E 第十一切片：Seedance retry package 纯构建拆分（2026-07-20）

P1-8 第八切片把 Seedance 重试提交包的重试门禁、shot/ledger 选择、缺提示词映射、package 和 Markdown 从 `project-service.ts` 移入独立纯模块；项目读取和 Production Board 构建仍留在 application orchestration：

- 新增 `seedance-retry-package-service.ts`，并导出共享 `shouldRetrySeedanceShot`。不存在 ledger 的镜头、失败项和 ready 但缺视频项继续进入重试；`skipped` 与已经有视频的 `ready` 镜头继续排除。
- `selectSeedanceRetryPackageShots` 用 canonical `seedanceShotProductionId` 关联 shot 与 ledger；Production Board 有镜头但无账本时继续生成 `prompt_exported`、retry 0 的提交项，账本仍需处理但找不到 Board 镜头时进入 `missing_prompt_shots`，不可静默丢失。
- retry prompt 继续分字段保存 duration、characters、location、`script_text`、`visual_prompt`、camera、Seedance prompt、asset slots、validation notes 和 negative constraints，没有把内部分析混入可见提示词。
- `buildSeedanceRetryPackage` 以显式 `exportedAt` 组装计数与 Markdown；已完成视频只计 `skipped_ready_shot_count`，不会进入重试 shot 列表。
- Provider queue overview 也改为引用同一 `shouldRetrySeedanceShot`，消除队列统计与导出包之间的重试语义漂移。
- `project-service.ts` 从 10,844 行降至 10,732 行，本切片净移出 112 行；八轮 P1-8 已累计从 12,232 行降至 10,732 行，共移出 1,500 行。

验证证据：

- 新增 4 项 characterization tests，覆盖缺失/失败/ready-without-video/skipped 门禁、无账本默认项、孤儿 ledger 显式报告、prompt 字段隔离，以及计数与 Markdown。
- retry package 与项目服务联合定向回归 72 项通过。
- Web server 全量 Vitest：149 个测试文件执行，148 个通过、1 个条件跳过；1337 项通过、2 项条件跳过、0 失败。
- `npm run check` 通过 visible copy audit、server `tsc --noEmit` 和 client `vue-tsc --noEmit`；server 生产构建与 `git diff --check` 通过。
- MCP 本轮未修改，继续沿用提交 `5ff20d87` 前已验证的 89 个测试文件、483 项全绿基线，没有误报为本轮重跑。
- 本切片未调用真实 Seedance、GEARS、文本/图片模型或付费 Provider；测试视频 URL、ledger 与 prompt fixture 只验证本地合同。

阶段 E 当前完成度为 86%。按 A–E 五阶段等权口径，整改总计划完成度为 95.0%。新增 0.6 个百分点只表示 P1-8 第八个可验证拆分边界完成；真实 Provider 闭环、真人盲评、成本凭证与生产恢复演练仍须外部证据。

### 10.22 阶段 E 第十二切片：Seedance Provider retry plan 纯组装拆分（2026-07-20）

P1-8 第九切片把 Seedance Provider 人工重试计划的候选过滤、原因计数、摘要和 Markdown 从 `project-service.ts` 移入独立模块；项目读取、Production Board 构建、ledger 同步和真实重提执行保持原边界：

- 新增 `seedance-provider-retry-plan-service.ts`，集中 provider/queue 参数清洗、failure category 过滤、候选原因推导、排序、原因分布、可重提/阻断/高优先级计数和计划 Markdown。
- `selectSeedanceProviderRetryPlanCandidates` 复用 `seedance-provider-queue-service.ts` 已有的 reason、candidate、priority、blocking 和 sort policy，没有复制永久输入错误或 Provider 临时错误的判断规则。
- failure category 过滤继续在 retry reason 推导之前执行；指定类别后，没有匹配失败分类的 timeout、ready-without-video 和 unsubmitted 项不会旁路进入候选。
- 达到 `max_retry_count`、素材缺失、提示词非法、内容策略、额度和鉴权问题继续 fail closed；可恢复 timeout/rate-limit/server/network 失败保留既有优先级和人工建议。
- `buildSeedanceProviderRetryPlan` 以显式 `generatedAt` 生成稳定摘要，Markdown 保留本地化原因、状态、阻断原因、等待时间、queue/job、失败分类/错误码和建议动作；无候选时输出明确空状态。
- `project-service.ts` 从 10,732 行降至 10,621 行，本切片净移出 111 行；九轮 P1-8 已累计从 12,232 行降至 10,621 行，共移出 1,611 行。

验证证据：

- 新增 4 项 characterization tests，覆盖代表性候选过滤/排序/计数、failure category 前置过滤、最大重试次数阻断，以及本地化 Markdown/空状态。
- retry plan 与项目服务联合定向回归 72 项通过。
- Web server 全量 Vitest：150 个测试文件执行，149 个通过、1 个条件跳过；1341 项通过、2 项条件跳过、0 失败。
- `npm run check` 通过 visible copy audit、server `tsc --noEmit` 和 client `vue-tsc --noEmit`；server 生产构建与 `git diff --check` 通过。
- MCP 本轮未修改，继续沿用提交 `5ff20d87` 前已验证的 89 个测试文件、483 项全绿基线，没有误报为本轮重跑。
- 本切片未调用真实 Seedance、GEARS、文本/图片模型或付费 Provider；固定时间、ledger 和 URL fixture 只验证本地策略合同。

阶段 E 当前完成度为 89%。按 A–E 五阶段等权口径，整改总计划完成度为 95.6%。新增 0.6 个百分点只表示 P1-8 第九个可验证拆分边界完成；真实 Provider 闭环、真人盲评、成本凭证与生产恢复演练仍须外部证据。

### 10.23 阶段 E 第十三切片：Seedance Provider queue overview 纯汇总拆分（2026-07-20）

P1-8 第十切片把 Seedance Provider queue overview 的状态、batch、timeout、缺视频和 attention 汇总从 `project-service.ts` 移入独立纯模块；项目读取、Production Board 构建和 ledger 同步继续留在 application orchestration：

- 新增 `seedance-provider-queue-overview-service.ts`，集中 provider/queue 参数清洗、ledger 状态计数、active/ready/failed/retryable、timeout、missing video、attention 和 batch summary 组装。
- overview 继续复用 `seedance-provider-queue-service.ts` 的 filter、batch current-state overlay、attention、sorting、active status 与 waiting-time policy，并引用 `seedance-retry-package-service.ts` 的统一重试门禁。
- batch summary 以当前 ledger 状态覆盖提交快照；batch 列表按创建时间稳定排序。配置的 `latest_queue_id` 不存在于过滤结果时，继续回退到 `updated_at` 最新批次。
- 默认 attention 只包含 submitted/processing/failed、超时及 ready-without-video；显式 `include_completed=true` 时，已有 provider job 或 queue identity 的完成/跳过项才进入运营清单。
- timeout 只统计 active 状态，ready 但缺视频单独计数；local fixture 不会被解释为真实 Provider 运行证据。
- `project-service.ts` 从 10,621 行降至 10,558 行，本切片净移出 63 行；十轮 P1-8 已累计从 12,232 行降至 10,558 行，共移出 1,674 行。

验证证据：

- 新增 4 项 characterization tests，覆盖状态/重试/超时/缺视频/attention 汇总、include-completed、batch 当前态与 latest fallback，以及 provider/queue 一致过滤。
- queue overview 与项目服务联合定向回归 72 项通过。
- Web server 全量 Vitest：151 个测试文件执行，150 个通过、1 个条件跳过；1345 项通过、2 项条件跳过、0 失败。
- `npm run check` 通过 visible copy audit、server `tsc --noEmit` 和 client `vue-tsc --noEmit`；server 生产构建与 `git diff --check` 通过。
- MCP 本轮未修改，继续沿用提交 `5ff20d87` 前已验证的 89 个测试文件、483 项全绿基线，没有误报为本轮重跑。
- 本切片未调用真实 Seedance、GEARS、文本/图片模型或付费 Provider；固定时间、queue、ledger 和 URL fixture 只验证本地策略合同。

阶段 E 当前完成度为 92%。按 A–E 五阶段等权口径，整改总计划完成度为 96.2%。新增 0.6 个百分点只表示 P1-8 第十个可验证拆分边界完成；真实 Provider 闭环、真人盲评、成本凭证与生产恢复演练仍须外部证据。

## 11. 下一段对话可直接使用的提示词

```text
请阅读：
/Users/wuyu/Desktop/china-culture-kb/docs/story-agent-comprehensive-functional-review-and-development-plan-20260719.md

然后继续推进 P1-8 的第十一个安全拆分边界。先检查当前分支、HEAD、dirty workspace 和已有用户改动，不要覆盖或清理无关改动。使用 china-culture-story-agent、gears-seedance-delivery 与 superpowers-lite 技能，优先从 `project-service.ts` 拆出 Production Board export 的文件描述、交付 manifest、Seedance prompts/ledger Markdown 等纯构建逻辑；先补 characterization tests，不移动项目读取、仓储写入、文件落盘或真实 Provider 调用。继续保持脚本、视觉、镜头、Seedance prompt、validation notes 分字段交付，不把 fixture 或 dry-run 计作真实产出。完成后运行相关定向测试、Web server 全测、npm run check、受影响构建和 git diff --check，并更新本文档的实施证据与百分比。
```

## 12. 工作区与 Git 交接

- 当前分支：`codex/story-agent-manifest-integrity-20260718`
- 当前 HEAD：`5ff20d87`
- 工作区包含 2026-07-20 的 P1-8 第二至第十切片修改，等待本轮统一提交并推送。
- 当前改动属于持续开发成果；下一对话不得 reset、checkout 或覆盖无关改动。
- 本文档是审查与计划，不代表上述 P0 已实现。
- 本轮没有因本审查调用外部文本模型、图片模型、GEARS 或 Seedance provider。

重要证据文件：

- `data/reports/story-agent-real-functional-smoke-20260719.json`
- `web/generated/projects/20260719-story-8ntif7ac0079--historical_drama/project.json`
- `web/generated/projects/20260719-story-8ntif7ac0079--historical_drama/production-board/`
- `docs/story-agent-next-conversation-handoff-20260717.md`

## 13. 不得误报的边界

以下内容一律不能互相替代：

- 15 片型结构覆盖 ≠ 15 片型专业成稿。
- 本地生成 ≠ Claude/Codex 外部模型生成。
- SVG placeholder ≠ AI 真实图片。
- provider payload/dry-run ≠ 外部 provider 已执行。
- local acceptance artifact ≠ 外部媒体回片。
- 机器质量分 ≠ 真人编剧/导演/事实文化评审。
- readiness 分数 ≠ 成片完成度。
- callback schema 测试通过 ≠ 真实 callback 已到达。
- GEARS job ready 且只有本地 acceptance ≠ 发布就绪。

下一阶段所有报告和前端状态都应围绕这些边界设计。
