# Story Agent 下一对话接续文档

> 日期：2026-06-19
> 当前分支：`codex-ai-comic-series-longform`  
> 适用场景：在新的 Codex / Claude 对话中继续 Story Agent、Production Board、GEARS / Seedance 交付链开发。  
> 当前状态：继续前先执行 `git status --short`；如有未提交改动，先确认来源和范围再推进。

## 0. 2026-06-19 最新方向

先读 `docs/gears-execution-integration-plan.md`。本项目新的主线是：

```text
china-culture-kb = 内容与生产指挥层
GEARS v2 = 图片、视频、字幕、混音、片头片尾、最终装配等实产执行层
```

因此，下一轮不要继续把真实媒体执行能力堆在 `china-culture-kb` 中。当前仓库保留计划包、dry-run、ledger、dashboard、审片返修和 GEARS callback；真实图片 / 视频 / 后期输出交给 GEARS。

## 0.1 2026-06-23 Story Agent 产品重定位

先读 `docs/story-agent-creative-platform-reposition-plan.md`。

本项目下一阶段的产品心智从“知识库驱动的故事生成器”调整为：

```text
AI 影视前期创作、剧本生产与项目素材指挥系统
```

用户范围扩展为：

- AI 漫剧公司：原创故事、系列设定、分集剧本、角色/场景资产说明、故事版交付。
- 改编团队：把小说、资料、历史人物、地方故事改编为 AI 漫剧、短片或宣传片剧本。
- 企业、政府、协会和机构：生成宣传片、纪录短片、解说片、培训片、公益片、品牌片等类型片。

新的 P0 不是继续“补全知识库”，而是建立：

- `creation_use_case`：原创漫剧、改编漫剧、机构宣传、纪录短片、品牌商业、教育培训、公益片等。
- `truth_mode`：原创虚构、素材启发、原作改编、事实重构、机构审定。
- `creation_contract`：把业务目标、真实度、允许虚构、禁止表达、素材充分度写成结构化合同。
- `material_pack`：把 `knowledge_pack` 升级为项目素材包，并保留旧字段兼容。
- `material_sufficiency`：把素材补充拆成 minimum viable story、script ready、production ready 三个阶段。

新对话如果要改 Story Agent 生成链路，继续沿 `docs/story-agent-creative-platform-reposition-plan.md` 推进 Story Studio / AI影视工作台能力，而不是追加知识库补录或 GEARS 媒体实产。

2026-06-23 更新：Phase 1 合同层首轮已落地。Web 后端已新增并接入 `creation_contract`、`material_pack`、`material_sufficiency`，旧 `knowledge_pack` 请求保持兼容；StoryBlueprint、prompt package、StoryGenerateResult、质量报告、项目 meta/version snapshot 均会保存新字段。MCP `kb_generate_story_blueprint` 已能只读返回 `creation_contract` / `material_sufficiency`，`kb_get_project_context` 可读回项目上下文中的新合同字段。

2026-06-23 续更：Phase 2 类型片画像矩阵首个工程切片已落地。`genre-story-profiles.ts` 现在集中维护每类片子的兼容创作用途、真实模式、推荐/允许/禁用叙事流派、素材要求、真实边界、机构规则和改编规则；`resolveGenreStoryMatrix()` 已接入 Story Generate 链路，会补足/过滤 `narrative_pattern_ids`，并把矩阵要求写入 `StoryBlueprint.type_specific_requirements` 和 prompt package 的“类型片画像矩阵”章节。下一步优先做 Phase 3 分阶段素材充分度和前端创作台控件文案。

2026-06-23 续更：Phase 3 分阶段素材充分度首个工程切片已落地。`MaterialSufficiencyReport` 兼容旧字段，并新增 `active_stage`、`generation_posture`、`needs_verification`、`next_stage` 和 `stage_reports[]`；`buildMaterialSufficiencyReport()` 会分别评估 `minimum_viable_story`、`script_ready`、`production_ready` 三阶段 gate。prompt package 已输出“三阶段素材 gate”，并把素材生成姿态写入输出合同。下一步可继续做前端生成表单/项目详情的创作台控件与素材补充 UI，或补 MCP blueprint 的三阶段 sufficiency 对齐。

2026-06-23 续更：前端创作台首个切片已落地。`StoryStudio.vue` 现在有“创作合同”面板，可随生成请求提交创作用途、真实模式、客户/机构类型、目标受众和传播目标；`StoryResult.vue` 会展示创作合同与三阶段素材 gate，项目详情页因复用该组件也能展示版本中的 `creation_contract` / `material_sufficiency`。下一步可继续做阶段化素材补充任务 UI、MCP blueprint sufficiency 对齐，或再做更完整的 Story Studio 命名/文案替换。

2026-06-23 续更：阶段化素材补充任务首个切片已落地。`supplement_tasks` 仍兼容旧 `knowledge_pack.missing_needs`，但现在可携带 `stage`、`blocking_level`、`affects`、`recommended_question`，并可由 `material_sufficiency` 的 missing/optional items 生成。`StoryResult.vue` 的“素材补充任务”会显示阶段、阻断等级和影响范围；production-ready 资产/视觉规范缺口会以“生产前补充”形式出现。下一步可继续做专门的 SupplementTasks 页面阶段筛选与项目素材包编辑。

2026-06-24 续更：SupplementTasks 专页已阶段化。`GET /api/projects/supplement-tasks` 支持 `status / stage / blocking_level / source` 筛选；`SupplementTasks.vue` 已改为“素材补充任务”工作台，提供状态、阶段、阻断等级、来源筛选，显示 Gate 来源、影响范围和 intake prompt；顶部导航入口也改为“素材补充”。下一步可做项目素材包编辑，以及素材补充完成后自动触发 sufficiency 重新评估。

2026-06-24 续更：素材补充完成后的写回和重评估已落地。`updateProjectSupplementTask()` 在任务 resolved 且有补充说明时，会把说明写入 `material_pack.supporting_materials`，移除对应 missing need，并重算 `material_sufficiency` 与 `creation_contract`；当前 story、项目 meta、版本 snapshot、源 story 文件和质量报告上下文都会同步。`StoryResult.vue` 已新增“项目素材包”展示，可看到人工补充素材、用途标签、缺口数量和确认事实。下一步更适合做“项目素材包编辑/新增素材”独立 UI。

2026-06-24 续更：旧项目创作合同读取兼容已锁到 API 层。`GET /api/projects` 与 `GET /api/projects/:projectId` 集成测试会构造旧格式 `project.json`，确认接口读时补齐 `creation_contract`、`material_sufficiency`、`creation_use_case`、`truth_mode` 和 current story 的 `material_pack`，同时不批量改写历史 meta。

2026-06-24 续更：故事修复提示包已继承创作合同。`buildStoryRepairPromptPackage()` 会把 `creation_contract`、`material_sufficiency`、真实度模式、禁止表达、待核验项、素材 Gate 和当前可推进阶段写入 repair prompt 与 `should_respect`，修复模型补质量分时不会越过素材/真实边界。

2026-06-24 续更：单场景重写 prompt 已接入创作合同边界。`scene-regeneration/v1` 会回传创作用途、真实度、客户/受众/传播目标、禁止表达、待核验项、素材 Gate 和当前可推进阶段，局部重写模型不会只按用户一句话改场景而丢掉机构/事实边界；本地 fallback 文案也从“资料补录”统一为“素材补充”。

2026-06-24 续更：Web 质量面板已暴露模型修复提示包。新增 `POST /api/projects/:projectId/repair-quality/prompt`，返回 `story-quality-repair-prompt/v1`，包含质量快照、修复动作、目标场景、保护字段、完整 StoryGenerateResult 输出合同、创作合同和素材 Gate；`ProjectDetail.vue` 可生成并复制提示词，默认不内嵌完整 story JSON、不写项目文件。

2026-06-24 续更：Web 修复 JSON 校验与安全写入已落地。新增 `POST /api/projects/:projectId/repair-quality/apply`，支持 dry-run 校验模型返回的完整 StoryGenerateResult JSON，可容错读取纯 JSON、Markdown 代码围栏和 `{ repaired_story_json: ... }` 包装对象，并保护 storyId、video_type、scene_id 顺序、项目素材包、创作合同和素材 Gate；通过质量重评估与改善门槛后才写入 `quality_repair` 新版本。`ProjectDetail.vue` 可粘贴修复 JSON、先校验、再写入，返回 changed scene ids、前后质量分、问题数和 `change_summary` 字段/场景差异摘要；模型尝试改动 protected fields 时会被忽略并写入 `ignored_protected_field_changes`；接口还返回 `operator_hints` 与 `validation_summary_markdown`，前端可一键复制校验摘要。

2026-06-23 续更：MCP `kb_generate_story_blueprint` 已对齐三阶段素材充分度。MCP 蓝图返回的 `material_sufficiency` 现在包含 `active_stage`、`generation_posture`、`needs_verification`、`next_stage` 和 `stage_reports[]`，并把三阶段 gate 汇总写入 `type_specific_requirements`。下一步若继续 MCP，可把 `kb_generate_story` / `kb_generate_script` 的生成入口也补齐同一三阶段上下文。

2026-06-23 续更：MCP `kb_generate_story` / `kb_generate_script` 生成入口已补齐创作合同上下文。两个工具的 schema 都接受 `creation_use_case`、`truth_mode`、客户/受众/传播目标；返回 JSON 会带 `creation_contract` 与 `material_sufficiency`。写入的故事/脚本 Markdown 也会包含“创作合同 / 素材 Gate / 三阶段素材报告”。`kb_generate_script` 明确只产出脚本骨架，当前安全阶段为 `minimum_viable_story`，会把完整正文、对白和生产视觉规范作为下一阶段素材需求。下一步优先做阶段化素材补充任务 UI，或收敛 MCP 蓝图/生成入口的合同 builder 复用。

## 1. 新对话优先阅读

请先阅读这些文件，再继续开发：

- `docs/story-agent-creative-platform-reposition-plan.md`
- `docs/gears-execution-integration-plan.md`
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
| Story Agent MVP | 内容/生产指挥层 100%；GEARS 真实验收约 95% | 生成、质量报告、修复、项目版本、前端查看已跑通；MCP 修复链路新增 `kb_generate_story_repair_prompt`，可把 repair actions 变成模型可直接产出 `repaired_story_json` 的提示包；production readiness automation 已从“展示 runbook”推进到“一键运行安全 Story Agent API 步骤”，真实执行会写入最近 20 次自动化运行账本，跨项目 portfolio 已能按优先队列批量触发安全 Story Agent 步骤并新增队列级运行审计；生成项目健康审计已能区分 planned / interrupted / production_gap / ready，新增 MVP 状态总控把生成物、Generated 治理、MCP Story Agent 闭环、故事质量、修复闭环、交付合同和生产指挥压成一个只读状态报告，并在 `progress[]` 暴露 `generated_governance=100%`、`mcp_story_agent_loop=100%`、`content_command_layer=100%` 与 `production_delivery_contract=100%`。95% 只代表真实 GEARS v2 endpoint 端到端 worker 验收还没签收；generated/readiness 存量问题继续由 lane 和 priority target 跟踪，不代表 Story Agent 内容/生产指挥层停滞。 |
| Generated 治理模块 | 100% | Web `story-agent-generated-health`、`story-agent-generated-governance-plan`、`story-agent-generated-governance-plan/run`，MCP `kb_get_story_agent_generated_governance_plan` / `kb_run_story_agent_generated_governance`，项目工作台卡片、导出、dry-run manifest、`project_ids` 精确筛选和 `dry_run=false` 阻断策略已完成。100% 是治理命令面完成，不代表历史 generated 存量已被自动改写。 |
| Production Board / Delivery Contract | 100% | Board、监督、批量修复、导出、Seedance 素材 slot、素材缺口报告、Production Board export、Shot Ledger、GEARS Job Ledger、回传、重试、provider/GEARS 兼容账本、失败分类、adapter 合同、dashboard、readiness/portfolio automation、review/retry plan 和 evidence signoff 命令面已收口；历史 generated 目标缺导出继续由 `delivery_contract` lane 和 Generated 治理计划跟踪。 |
| GEARS Execution Integration | 约 99%（Story Agent 侧合同） | GEARS config/contract、Job Ledger、submit/callback/status sync、worker acceptance kit、证据包、generated health 前后体检、checksum/integrity 和 30 集压力 payload 首轮已跑通；99% 只代表本仓库对接合同接近收口，不代表实产完成，剩余被可达 GEARS v2 worker 的真实端到端验收阻断。 |
| AI 漫剧系列指挥层 | 约 99% | 系列规划、Seedance/GEARS 生产账本、回片、剪辑包、缩略图计划、精修计划、SRT/音频/片头片尾/final manifest 合同、审片返修 ledger、重试执行计划、外部剪辑平台包、生产总览 dashboard 和多 job type 提交入口已具备；系列 readiness 已进入 Web/API/UI/MCP 跨项目 portfolio，支持队列级安全自动化、系列级运行账本和 portfolio 运行审计。真实媒体执行迁出到 GEARS。 |
| 可商用制作中台 | 约 99% | 从 dashboard/导出面推进为单故事 + 系列 + portfolio 三层 production readiness 中台：统一评分、lane、阻断、next actions、GEARS 风险、automation runbook、安全自动化执行入口、MCP bridge、运行审计账本、跨项目优先队列、批量安全 runner、队列级运行审计、模型修复提示包和生成项目健康审计；Web/API/UI 可读取 readiness/health 并把诊断转为可调度、可复盘步骤。仍缺真实 worker 产物验收、UX 降噪和真实大系列压力数据。 |
| MCP Story Agent 闭环 | 100% | `kb_get_entry_detail`、`kb_generate_story_blueprint`、`kb_generate_script`、`kb_generate_story`、`kb_get_project_context`、`kb_validate_genre_story`、`kb_generate_gears_delivery`、`kb_generate_seedance_prompt`、`kb_get_story_agent_generated_health`、`kb_get_story_agent_generated_governance_plan`、`kb_run_story_agent_generated_governance`、`kb_get_story_agent_mvp_status`、`kb_get_production_readiness`、`kb_get_production_readiness_portfolio`、`kb_run_production_readiness_automation`、`kb_run_production_readiness_portfolio_automation`、`kb_generate_story_repair_prompt`、`kb_repair_story(auto_apply=false/true)`、`kb_update_project_version`、`kb_get_gears_worker_evidence_signoff` 已组成完整 MCP 指挥闭环；MVP status `progress[]` 输出 `mcp_story_agent_loop=100%`，并明确媒体实产仍归 GEARS v2。 |

当前主线已经不是“能不能生成故事”，而是“生成后能不能低复杂度管理、修复、交付、提交 GEARS、接回实产结果并完成审片返修”。

2026-06-22 进度更新：

- 新增单故事与 AI 漫剧系列 production readiness 共享合同、后端聚合服务、API endpoint 和前端面板。
- 单故事 readiness 覆盖 Story Agent 质量、Production Board 监督、交付包落盘、Shot Ledger、GEARS Job Ledger、审片返修和商业运营缺口。
- 系列 readiness 覆盖系列质量审计、分集生成进度、Seedance/GEARS 生产 dashboard、后期交付状态、审片返修和分集 readiness。
- 新增 service 与 route 级测试，验证 readiness schema、lane、issue、next action 与 Markdown handoff。
- GEARS 实产仍不进入本仓库；真实图片、视频、字幕、混音、片头片尾和最终装配继续由 GEARS v2 worker 执行。
- 新增 MCP 工具 `kb_get_production_readiness`，支持 `project_id` / `series_project_id`，只读返回生产 readiness JSON/Markdown；本轮已补 `automation_plan`，把 next actions 映射到 MCP tool、Story Agent API、GEARS worker 或 operator review，并给出 payload hint、阻断 issue 与安全说明。单元测试覆盖单故事与系列路径，`mcp-server npm run build` 通过。
- Web/API readiness 共享合同新增 `ProductionReadinessAutomationPlan`；单故事和系列 readiness route 会返回自动化步骤，项目详情页与 AI 漫剧系列工作台会显示 ready/blocked/manual、runner、API path 和 GEARS 外部执行边界。
- 新增安全自动化执行入口：`POST /api/projects/:projectId/production-readiness/run-automation` 与 `POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/production-readiness/run-automation`。runner 只执行 `can_auto_execute=true` 的 Story Agent API 步骤，自动跳过 GEARS worker 和人工审片步骤；前端两个工作台新增“运行安全自动化”按钮。
- 新增 MCP 执行 bridge：`kb_run_production_readiness_automation` 通过 `STORY_AGENT_BASE_URL` 或显式 `story_agent_base_url` 调用 Web/API runner，默认 dry-run，支持限定 `action_keys` / `max_steps` / `stop_on_error`；当 Web 不可达时返回结构化 blocked 诊断和本地 readiness fallback。MCP 不直接执行 GEARS worker、Seedance SDK、ffmpeg 或最终媒体合成。
- 新增自动化运行审计账本：单故事项目与 AI 漫剧系列项目在真实执行 `run-automation` 后，会持久化 `production_readiness_automation_ledger`（最近 20 次、含分数变化、步骤、失败数和 notes）；readiness API、前端面板、Markdown handoff 与 MCP `kb_get_production_readiness` 均回显 `latest_automation_run`。dry-run 继续不写项目文件。
- 新增跨项目生产指挥总览：`GET /api/system/production-readiness-portfolio` 聚合全部单故事项目与 AI 漫剧系列 readiness，按阻断、分数、自动化步骤和 next action 生成 priority queue / action buckets；项目工作台顶部新增“生产指挥总览”。MCP 新增只读 `kb_get_production_readiness_portfolio`，可直接从本地 `web/generated` 扫描项目并输出同类优先队列。
- 新增 portfolio 批量安全自动化：`POST /api/system/production-readiness-portfolio/run-automation` 会按 priority queue 选择目标，逐个调用已有单故事/系列 `run-automation` runner；默认 dry-run，前端“运行队列安全自动化”按钮可执行前 5 个高优先目标。MCP 新增 `kb_run_production_readiness_portfolio_automation` bridge，仍只委托 Web/API 执行安全 Story Agent 步骤，不执行 GEARS worker、Seedance SDK、ffmpeg 或最终媒体合成。
- 新增 portfolio 运行审计账本：真实队列 run 会写入 `web/generated/system/production-readiness-portfolio-automation-ledger.json`，记录最近 20 次批量调度、目标执行/跳过/失败计数和 notes；`GET /api/system/production-readiness-portfolio`、项目工作台和 MCP 本地 portfolio 均会回显 latest portfolio run。dry-run 继续不落盘。
- 新增 MCP 模型修复提示包：`kb_generate_story_repair_prompt` 复用 `kb_repair_story(auto_apply=false)` 的质量快照、修复动作和目标场景，输出只读 prompt、保护字段、完整 JSON 输出合同和 `kb_validate_genre_story -> kb_repair_story(auto_apply=true) -> kb_get_project_context` 推荐工作流；工具不写项目文件。
- 新增生成项目健康审计：`GET /api/system/story-agent-generated-health` 与项目工作台“生成项目体检”卡片，只读扫描 generated story project、AI 漫剧系列 project、generated stories 和 versions，按 `ready / planned / production_gap / interrupted` 分类，显式统计缺当前故事、分镜、GEARS 段、质量报告、分集引用、系列交付和后期指令缺口；API integration test 已覆盖 interrupted story、planned series 和 production-gap series。
- 新增 MCP generated health bridge：`kb_get_story_agent_generated_health` 输出 `mcp-story-agent-generated-health/v1`，无需 Web dev server 即可本地只读扫描 generated health；单元测试覆盖 ready story、interrupted series 和 planned series，`mcp-server npm run build` 通过。
- 新增 GEARS acceptance generated health bridge：`gears-execution-acceptance-report` 会输出 `story_agent_generated_health` 检查与 `generated_health_*` 统计；导出的 `run-gears-worker-acceptance.sh` 会在真实 worker submit 前后保存 generated health JSON，并生成 `story-agent-generated-health-audit.json/.md` 进入最终 verdict gate；worker evidence bundle 新增 `story-agent-generated-health-report.md`，真实 GEARS smoke 的证据链会同时覆盖目标健康、worker 响应和大项目 pressure。
- 2026-06-23 evidence bundle MVP status 追加：worker evidence bundle 新增 `story-agent-mvp-status-report.md`，并在 summary 输出 `story_agent_mvp_status` / `story_agent_mvp_score`；当前 bundle documents 为 7 份，签收包可同时证明 Story Agent MVP lane 状态和 GEARS worker 合同证据。
- 2026-06-23 worker acceptance MVP audit 追加：`run-gears-worker-acceptance.sh` 会在 GEARS worker smoke 前后保存 `story-agent-mvp-status-before.json` / `story-agent-mvp-status-after.json`，生成 `story-agent-mvp-status-audit.json/.md`；最终 verdict 新增 `story_agent_mvp_status_audit` gate，signoff API 与 MCP signoff 工具输出 `mvp_status_audit_passed`、MVP before/after status 和 score delta。当前 worker acceptance kit 为 20 条 commands / 5 个 payloads，最终 verdict 为 8 个 gate，archive 必交附件为 26 个。
- 2026-06-23 post-archive signoff snapshot 追加：`run-gears-worker-acceptance.sh` 在 archive / checksum / integrity 之后自动读取 `GET /api/system/gears-execution-worker-evidence-signoff?evidence_dir=...`，把 `gears-worker-evidence-signoff.json` 与 `gears-worker-evidence-signoff.md` 写入 evidence 目录；正常完成和缺 env / submit failure / 非 2xx / 严格审计失败出口都会落盘签收快照。
- 已用导出的脚本跑 v13 本地 fake GEARS worker health smoke，证据目录 `/private/tmp/gears-worker-evidence-generated-health-v13`：generated health 前后审计写出成功，worker evidence bundle documents=6，大项目 pressure 120/120 source echo，worker response audit 无缺 id/source/artifact；本次未启用 ledger seed，callback gate 的 `ledger_match_missing_count=4` 属预期诊断，不代表真实 GEARS v2 已签收。
- 已用导出的脚本跑 v14 本地 fake GEARS worker health gate smoke，证据目录 `/private/tmp/gears-worker-evidence-generated-health-v14`：acceptance kit commands=18，verdict gates=7，新增 `story_agent_generated_health_audit` gate `passed`，health before/after delta 全 0，大项目 pressure 120/120 source echo，archive 必交附件 22 个且不缺；未启用 ledger seed 时唯一失败仍是 `story_agent_callback_audit`。
- 新增 GEARS worker evidence signoff API：`GET /api/system/gears-execution-worker-evidence-signoff?evidence_dir=...`，真实 worker acceptance script 跑完后可直接让 Story Agent 读取证据目录，汇总 verdict、archive、integrity、worker/callback audit、generated health audit、MVP status audit 和 large-project pressure audit。报告 schema 为 `gears-execution-worker-evidence-signoff/v1`，可输出 ready / attention / blocked、8 gate 统计、必交附件、health/MVP delta、pressure source echo 和 recommended actions。
- 新增 GEARS worker evidence signoff v16/v17 加固：acceptance 脚本早退路径现在也会写完整审计证据，signoff API 额外输出 worker transport/http error、failure category counts、callback transport/http error、大项目 response/accepted/rejected/failed/duplicate/unexpected source 统计，并去重 recommended actions。MCP 新增 `kb_get_gears_worker_evidence_signoff`，可不启动 Web dev server 直接读取本地 evidence 目录，输出 `mcp-gears-worker-evidence-signoff/v1`。
- 2026-06-23 前端追加：单故事项目详情页与 AI 漫剧系列工作台的 GEARS 操作区新增 worker evidence signoff 读取入口，可输入 `/private/tmp/...` evidence 目录并调用 `GET /api/system/gears-execution-worker-evidence-signoff`；页面会显示 signoff 状态、gate 通过数、缺附件数、worker/callback transport-http error、大项目 pressure source echo 和 recommended action 数，并支持导出 signoff Markdown / JSON。该入口只读证据目录，不执行 GEARS worker、Seedance SDK、ffmpeg 或最终媒体合成。
- 2026-06-23 signoff latest 追加：Web API 与 MCP `kb_get_gears_worker_evidence_signoff` 在未传 `evidence_dir` 且未设置 `GEARS_EVIDENCE_DIR` 时，会自动发现允许目录下最近的 `gears-worker-evidence*` 证据目录；返回新增 `evidence_dir_source=input/env/latest/missing`。可用 `GEARS_EVIDENCE_AUTO_DISCOVER=0` 关闭，或用 `GEARS_EVIDENCE_AUTO_DISCOVER_ROOTS` 限定扫描根。该能力只定位证据，不执行 GEARS worker。
- 2026-06-23 acceptance kit 签收闭环追加：`run-gears-worker-acceptance.sh` 现在在正常结束、缺 env 早退、submit transport failure、submit 非 2xx 和严格审计失败前都会打印明确的 Web signoff URL、latest signoff URL 与 MCP `kb_get_gears_worker_evidence_signoff` 调用提示；worker acceptance kit 命令列表新增 `read_worker_evidence_signoff`，evidence bundle checklist/next actions 也要求附加 signoff Markdown / JSON。
- 2026-06-23 Story Agent MVP status 追加：新增 `GET /api/system/story-agent-mvp-status`，输出 `story-agent-mvp-status/v1`。它只读组合 `story-agent-generated-health`、`story-agent-generated-governance-plan` 与 `production-readiness-portfolio`，返回六条 lane（生成物、Generated 治理、故事质量、修复闭环、交付合同、生产指挥）、priority targets、next actions、源报告和 Markdown；前端 API client 新增 `getStoryAgentMvpStatus()`。这一步把 Story Agent MVP 主线重新聚焦到内容/生产指挥总控，不做媒体实产。
- 2026-06-23 MCP MVP status 追加：新增 `kb_get_story_agent_mvp_status`，输出 `mcp-story-agent-mvp-status/v1`，在无 Web server 时也能本地读取同类六条 lane、priority targets、next actions、`mcp_story_agent_loop=100%` 和可选 Markdown；测试覆盖本地临时项目与 compact markdown-off 读取。
- 2026-06-23 项目工作台 MVP 总控追加：项目工作台顶部已显示 Story Agent MVP 状态卡，支持刷新、Markdown/JSON 导出，并把六条 lane、优先目标和下一步动作放到 production portfolio / generated health 明细之前。
- 2026-06-23 MVP 进度口径拆分追加：Web `story-agent-mvp-status/v1` 和 MCP `mcp-story-agent-mvp-status/v1` 新增 `progress[]`，明确 `generated_governance=100%`、`mcp_story_agent_loop=100%`、`content_command_layer=100%`、`production_delivery_contract=100%`、`gears_end_to_end_acceptance=95%`；项目工作台同步展示这五个进度块。后续不要把真实 GEARS endpoint 未签收误解为 Story Agent 本体不推进。
- 2026-06-23 worker acceptance endpoint readiness 追加：worker acceptance kit 新增 `real_endpoint_readiness`，显式输出真实 GEARS v2 endpoint acceptance 是否可运行、缺失 env、smoke target 状态、推荐命令和 next actions；单故事页与系列工作台已显示 real endpoint 状态与缺失 env 数。
- 2026-06-23 generated health 系列治理追加：`story-agent-generated-health/v1` summary 新增 `series_ready_count`、`series_planned_only_count`、`series_production_gap_count`、`series_interrupted_count`、`series_governance_attention_count`、`series_missing_story_ref_project_count`、`series_contract_evidence_count` 和 `series_relink_candidate_count`，Markdown/notes 会输出 `series_governance_attention` 与 `series_relink_candidates` 提醒。当前真实扫描显示 926 个 AI 漫剧系列都缺 generated episode story refs，其中 99 个已有生产/后期合同证据，优先 relink；其余历史样本应归档 fixture 或补齐 Story Agent 合同，避免把生成样本治理问题误判为 GEARS worker 合同失败。
- 2026-06-23 generated governance plan 追加：新增 Web `GET /api/system/story-agent-generated-governance-plan`、MCP `kb_get_story_agent_generated_governance_plan` 和项目工作台“Generated 治理计划”卡片。计划只读输出 relink、archive/rebuild、planned-first-episode、contract repair、story ref repair 和 ready signoff 分桶；当前真实扫描为 99 个 relink、827 个 archive/rebuild、4 个单故事 ref 修复、1 个 GEARS signoff ready 候选。该能力只生成治理计划和样本清单，不移动、不删除、不批量修改 generated 文件。
- 2026-06-23 generated governance dry-run 追加：新增 Web `POST /api/system/story-agent-generated-governance-plan/run` 与 MCP `kb_run_story_agent_generated_governance`，只读生成治理 manifest，包含 action key、目标、planned operation、expected file changes、operator review 和 Markdown，并支持 `project_ids` 精确筛选单个或少量目标。默认 action 为 relink / archive-or-rebuild / story-ref repair；当前真实 dry-run 先选 relink 队列。`dry_run=false` 目前会被显式 blocked，不执行写入。
- 2026-06-23 Generated 治理 100% 追加：Web/MCP MVP status 新增 `generated_governance` lane 与 progress slice，`generated_governance=100%` 在项目工作台显示为“治理 100%”；MVP status 同步返回 `generated_governance_plan`。MCP governance runner 已对齐 Web runner，按完整 generated health target groups 支持 `project_ids` 精确筛选，不再被 sample 限制。继续注意：该模块 100% 不等于自动清理 generated 存量。
- 2026-06-23 MCP Story Agent 闭环 100% 追加：Web/MCP MVP status 新增 `mcp_story_agent_loop` progress slice，项目工作台显示“MCP 100%”；summary 新增 `mcp_story_agent_tool_count=20` 与 `mcp_story_agent_loop_percent=100`。evidence 明确只允许受控写入项目版本，不做真实媒体执行。
- 2026-06-23 内容/生产指挥层 100% 追加：Web/MCP MVP status 将 `content_command_layer` progress slice 收口到 `percent=100`、`status=ready`，summary 新增 `content_command_layer_percent=100`。evidence 同时保留 `local_target_health_tracked_by=lanes`，避免把历史 generated/readiness 待治理项误解为已经被批量修完。
- 2026-06-23 Production Board / Delivery Contract 100% 追加：Web/MCP MVP status 新增 `production_delivery_contract` progress slice，summary 输出 `production_delivery_contract_percent=100` 与 12 个合同面清单；evidence 覆盖 GEARS delivery package、Production Board export、Seedance prompt package、scene/segment contracts、Shot/GEARS ledgers、readiness/portfolio automation、review/retry plan 和 worker evidence signoff，真实媒体执行仍归 GEARS v2。
- 2026-06-23 周敦颐单故事自然交付修复追加：`20260621-story-5xhl--character_story` 已通过受控项目版本写入推进到 `20260621-story-5xhl--character_story-v10`，标题为《周敦颐橘洲问莲》；当前 `project.json` 显示 `quality_passed=true`、`genre_score=100`、`quality_issue_count=0`、`scene_count=5`、`has_gears_segments=true`。v10 的质量报告 `outline_coverage=100`、`pattern_score=100`、`gears_readiness=100`、`audience_text_report.clean=true`，GEARS delivery 为 15 个 units、`validation_notes=0`；`full_text`、`theme`、`logline`、`scene_breakdown` 和 `gears_segments` 的观众字段已扫描清除“主角目标/目标明确/选择有代价/因果链/行动具体/人物不是年表/史实边界/质量信号/生成优先级”等检测词痕迹。该修复只写 generated project 版本与项目元数据，不写 `data/provinces/*.md`，真实图片/视频/后期仍交给 GEARS v2。
- 2026-06-23 GEARS delivery / pattern gate 修复追加：`gears-delivery-service` 已修正“长沙”误触发清末民初服饰的问题，周敦颐/北宋语境优先输出北宋士人服装；`narrative-pattern-library`、`genre-quality-service` 与 `quality-workflow-service` 已支持用自然叙事证据识别人物所求、制度压力、两难、行动后果、因果推进、人物变化和创作边界，避免为了过质量门把检测词写进观众稿。新增回归测试覆盖“周敦颐 + 长沙/橘子洲仍为北宋服饰”、单项紧凑信号、自然叙事质量识别和 pattern report 弱信号消除。
- 2026-06-23 audience text gate 追加：`StoryQualityReport` 新增 `audience_text_report`（`audience-text/v1`），扫描 `full_text`、`theme`、`logline`、场景剧情/旁白和 GEARS `script_text` / `segment_prompt_hint` 中的内部检测词；不干净时质量报告会给出 `repair-audience-text` 修复动作，前端项目详情页和 StoryResult 已新增 Audience Text 卡片。生成提示包也明确要求质量信号只作内部检查，不得原样写进观众稿。`20260621-story-5xhl--character_story-v10` 已作为 clean=true 样本落盘。

2026-06-20 进度更新：

- GEARS P0 首轮已落地：config/contract、job ledger、submit、callback 归一化、status sync。
- 单故事项目与 AI 漫剧系列项目都已支持提交 GEARS job、导入 GEARS callback、轮询 GEARS job 状态并写回对应生产账本。
- AI 漫剧系列后期 GEARS job 已支持结构化 payload：字幕包、音频计划、片头片尾计划和最终装配依赖合同可直接进入 GEARS Job Ledger。
- AI 漫剧系列图片 GEARS job 已支持结构化 payload：分镜图、人物图、场景图可从分集 GEARS delivery 进入 GEARS Job Ledger。
- AI 漫剧系列后期 GEARS artifact callback 已支持写回专项账本：字幕、混音、片头片尾和最终交付的 `seedance_*` ledger 会随 GEARS ready artifact 更新。
- AI 漫剧系列 GEARS callback / status sync 响应已统一带回后期专项账本；系列工作台导入回调或同步状态后会直接刷新字幕、混音、片头片尾和最终交付状态，且同步按钮现在覆盖全部活跃 GEARS job。
- 项目详情页和 AI 漫剧系列工作台已接入“提交 GEARS / 提交 GEARS API / 同步 GEARS 状态 / 导入 GEARS 回调”；系列工作台可选择提交视频、分镜图、人物图、场景图、字幕、混音、片头片尾和最终装配 job。
- 单故事项目与 AI 漫剧系列的 GEARS status sync 已补部分成功测试：同一批 job 中部分 GEARS status HTTP 失败时，成功 job 仍会写回 ledger / 生产账本，失败项进入结构化 `failures`。
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
- GEARS worker acceptance kit 已落地：`GET /api/system/gears-execution-worker-acceptance-kit` 生成外部 GEARS v2 worker 可直接执行的 env template、payload 文件、curl 命令、断言清单和 Markdown runbook；单故事项目页与 AI 漫剧系列工作台已显示 worker kit 命令数，并支持导出 Markdown / JSON。
- GEARS worker acceptance shell script 已落地：worker kit 同时生成 `run-gears-worker-acceptance.sh`，脚本会写 payload、抓取 acceptance/evidence 预检、调用 GEARS submit/status、回打单故事/系列 callback、运行 live smoke，并把响应落到 evidence 目录；前端可直接导出 `.sh`。
- GEARS worker acceptance shell script 已改为“完整证据落盘、stdout 简报”：acceptance/evidence/generated pressure JSON 保存到 evidence 目录，终端只打印 ok/status/commands/payloads/documents 等摘要，避免真实联调日志被大 JSON 淹没。
- GEARS worker acceptance shell script 已补批量 submit job id 自动提取：默认从 `gears_job_id`、`jobId`、`taskId`、`data.task`、`acceptedUnits[]`、`jobs[]`、`tasks[]` 等真实 worker 响应形态中提取全部 job id 并写入 `gears-smoke-job-ids.txt`，随后逐个轮询 status。
- GEARS worker acceptance shell script 已补可配置多轮 status poll：`GEARS_ACCEPTANCE_STATUS_POLL_ATTEMPTS` 默认 `1`，`GEARS_ACCEPTANCE_STATUS_POLL_INTERVAL_SECONDS` 默认 `5`；多轮时保存每次 `gears-status-response-<job>-attempt-<n>.json`，并保留最新 `gears-status-response-<job>.json` 供 audit 兼容。
- GEARS worker acceptance shell script 已补 replay/post-audit 证据：默认重放单故事与系列 callback，保存 replay response；跑后拉取 evidence bundle 和 generated pressure，并写入 manifest，方便证明 `duplicate_count` 和跑后 ledger 风险。
- GEARS worker acceptance shell script 已补 Story Agent callback response audit：生成 `story-agent-callback-response-audit.json` 与 `story-agent-callback-response-audit.md`，统计 callback/live-smoke 响应里的 `ok=false`、validation/auth/not-found/live-smoke blocked 错误、received/updated/failed/duplicate 计数和推荐修复动作。
- GEARS worker acceptance shell script 已补 Story Agent callback id preflight：生成 `story-agent-callback-id-preflight.json` 与 `.md`，在 callback POST 前检查 `GEARS_SMOKE_PROJECT_ID` / `GEARS_SMOKE_SERIES_PROJECT_ID` 是否符合 Story Agent 路由格式，避免占位 id validation error 被误判为 GEARS worker 回调合同问题。
- GEARS worker acceptance shell script 已补 worker response audit：生成 `gears-worker-response-audit.json` 与 `gears-worker-response-audit.md`，记录真实 worker 响应里的 accepted/rejected/failed 计数、状态别名、job/source/idempotency 字段、artifact URL 字段、ready 缺 artifact、error code、failure category、合同缺口和 `recommended_actions`，可把真实 worker 响应转成 P0/P1 合同修复动作。
- `recommended_actions` 已带 `sample_paths`，audit totals 已带 `sample_record_paths`，可定位缺 worker id、缺 source/idempotency、缺失败上下文、ready 无 artifact 和未知状态的代表性 JSON path。
- GEARS worker acceptance shell script 已补 transport / HTTP sidecar 证据：submit、status poll 和可选大项目 pressure submit 会保存 `*-http-status.txt` 与 `*-curl-exit-code.txt`；worker response audit 汇总 `transport_error_count` / `http_error_count`，并把非 2xx 与 curl 失败拆成独立 recommended actions。
- Story Agent callback/live-smoke 也已补 transport / HTTP sidecar 证据：project callback、series callback、callback replay 和 live smoke 会保存 `*-http-status.txt` 与 `*-curl-exit-code.txt`；`story-agent-callback-response-audit` 汇总 `transport_error_count` / `http_error_count` / `not_found_count` / `blocked_count` / `ledger_match_missing_count`，可区分 route/auth/project missing、live smoke env blocked、项目存在但 GEARS Job Ledger 未匹配与 callback payload 合同问题。
- worker response audit 已用 error_code / failure_category 参与 failed/rejected 判定：例如 `SERVICE_UNAVAILABLE` 会进入 failed，而不是 unknown，方便真实 worker 失败类型对齐。
- worker response audit 已覆盖 `no_worker_response_files` 与 `record_count_zero` 两类前置失败：缺 env 时提示先跑 worker smoke，不可达 endpoint 留下空响应文件时提示补真实 submit/status 结果或 transport failure body。
- acceptance shell stdout 已补 audit 摘要：callback id preflight、worker response audit 和 Story Agent callback response audit 都会打印 totals / recommended actions 一行摘要，详细证据仍写入 JSON/Markdown 文件。
- GEARS worker acceptance shell script 已补真实执行可用性：提交前按 env 渲染 smoke payload，提取 job id 后回填 callback payload；`GEARS_API_TOKEN` 可选；submit 失败会写 `gears-submit-exit-code.txt`、`gears-submit-failed.txt` 和 manifest。
- GEARS worker acceptance shell script 已补缺 env evidence：缺 `GEARS_API_BASE_URL` / callback env 时也会先输出 payload、acceptance report、worker evidence bundle、manifest 和缺失 env 清单。
- GEARS worker acceptance kit 已补 smoke target 自动发现：导出包新增 `smoke_targets`，脚本会写 `story-agent-smoke-targets.json` / `story-agent-smoke-env-selected.json`；当 `GEARS_SMOKE_PROJECT_ID`、`GEARS_SMOKE_STORY_ID`、`GEARS_SMOKE_SERIES_PROJECT_ID` 留空或仍是占位符时，会从 `web/generated` 自动选择现有单故事项目和 AI 漫剧系列项目，减少 callback smoke 的 404 误判。
- Story Agent callback response audit 已补 `ledger_match_missing_count`：当 callback 成功到达真实项目但 `source_unit_id` / `gears_job_id` 不在项目 GEARS Job Ledger 中时，会给出“先走 Story Agent submit 建账本，或对齐回调 source/job id”的 P0 动作，避免误判为路由或鉴权问题。
- GEARS worker acceptance script 已补可选 Story Agent ledger seed：设置 `GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER=1` 时会通过 Story Agent submit API 预建单故事/系列 GEARS Job Ledger，并把 callback smoke payload 改写为 submit 返回的 `source_unit_id` / `gears_job_id` / `job_type`，用于真实验证 callback 写回账本。
- GEARS submit response 兼容已补顶层 `status` envelope：`data.acceptedUnits[].taskId/externalId/idempotencyKey` 形态可正确进入 Story Agent submit adapter 并建 GEARS Job Ledger，避免把响应 envelope 本身误判为缺 `source_unit_id` 的 job。
- GEARS worker acceptance kit 已补 30 集级大项目压测入口：默认生成 `gears-large-project-submit-pressure.json`（30 集 × 每集 4 镜，共 120 units）和 summary，并按 200 units 上限封顶；只有设置 `GEARS_ACCEPTANCE_RUN_LARGE_PRESSURE=1` 才提交。
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
- 已执行导出的 `run-gears-worker-acceptance.sh` 前置 smoke：Story Agent 预检和 evidence bundle 拉取通过；本机没有 GEARS v2 worker endpoint，submit 阶段以 curl 7 失败并保存证据。新版脚本验证了缺 env evidence（`/private/tmp/gears-worker-evidence-missing-env`）和不可达 worker submit evidence（`/private/tmp/gears-worker-evidence-submit-failure-v2`），并确认 30 集级压力 payload 生成 120 units。真实端到端仍需配置可达 `GEARS_API_BASE_URL`、`GEARS_CALLBACK_BASE_URL` 和 `GEARS_CALLBACK_SECRET`。
- 已用本地 fake GEARS worker 验证多轮 status poll：submit 返回 `fake-gears-job-1`，第 1 次 status 为 `PROCESSING`、第 2 次为 `COMPLETED`；脚本写出 attempt 文件和 latest 文件，audit 扫描 attempt 文件、跳过 latest 副本，`ready_without_artifact=0/1` 且识别 artifact URL。
- 已用本地 fake GEARS worker 验证 Story Agent callback response audit：占位 project/series id 会导致单故事与系列 callback 返回 `ok=false` / `VALIDATION_ERROR`，audit 统计 `ok_false_count=2`、`validation_error_count=2`，并给出 `validation_error_count` 推荐动作，提示换成真实 Story Agent project id。
- 已用导出的 `run-gears-worker-acceptance.sh` 验证缺 env 路径的新 id preflight：`/private/tmp/gears-worker-evidence-id-preflight` 写出 `story-agent-callback-id-preflight.json/.md`，`warning_count=2`，stdout 打印 `recommended_actions=1`；worker audit 同步输出 `no_worker_response_files` 推荐动作。
- 已用本地 fake GEARS worker 验证 HTTP 503 submit 证据：脚本写出 `gears-submit-response-http-status.txt=503` 与 `gears-submit-response-curl-exit-code.txt=0`，worker audit 统计 `http_error_count=1`、`failed_count=2`、`unknown_count=0`，并给出 `http_error_count` recommended action。
- 已用本地 fake GEARS worker 验证 Story Agent callback HTTP sidecar：worker submit/status 均 200，但使用不存在的合法格式 project/series id 回调，脚本完整退出 0，callback audit 统计 `http_error_count=4`、`not_found_count=4`、`blocked_count=1`、`ok_false_count=4`，sample transport files 指向四个 404 response，并把修复动作归到 smoke env 项目 ID / live smoke server env。
- 已用本地 fake GEARS worker 验证 smoke target 自动补齐：未配置 smoke project env 时自动选择 `20260621-story-5xhl--character_story` / `20260621-story-5xhl` / `20260619-series-r0v5zyag`，证据目录 `/private/tmp/gears-worker-evidence-auto-target-v3`；`not_found_count=0`、`blocked_count=0`、`http_error_count=0`、`transport_error_count=0`，剩余 `ledger_match_missing_count=4` 指向“需先 Story Agent submit 建账本或启用 `GEARS_ACCEPTANCE_SEED_STORY_AGENT_LEDGER=1`”。
- 已用本地 fake GEARS worker 验证可选 ledger seed：`/private/tmp/gears-worker-evidence-ledger-seed-v3` 中单故事 seed 成功，`story-agent-project-ledger-seed-selected.json` 为 `patched=true`，callback 回写 `shot-1` ready；系列 seed 为 `patched=false/no_submitted_job`，所以 callback audit 仍有 `ledger_match_missing_count=2`，下一步应换有 `seedance_video` retry candidates 的系列或设置其它 `GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE` 继续验证。
- 已修正 worker acceptance smoke target 选择：自动扫描默认 generated 根与仓库 `web/generated`，并把 series seed readiness 绑定到真实可提交候选；当 `seedance_video` 因缺真实 story/retry candidates 不可提交时，会自动推荐可提交的 GEARS 后期 job。本轮推荐 `GEARS_ACCEPTANCE_LEDGER_SEED_JOB_TYPE=title_card_render`。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 复测 ledger seed 完整闭环：证据目录 `/private/tmp/gears-worker-evidence-ledger-seed-v5`；自动选择 `20260619-series-3f89ec1y`，单故事与系列 seed selected 均 `patched=true`，series 使用 `source_unit_id=title_card:card-series-opening` / `gears_job_id=fake-gears-job-11`；callback audit 达到 `updated_count=4`、`duplicate_count=2`、`failed_count=0`、`ledger_match_missing_count=0`、`recommended_actions=[]`。真实 GEARS v2 endpoint 仍未配置，真实端到端和真实大项目提交压测继续等待可达 endpoint。
- 已修正 worker response audit 的记录识别误报：顶层 submit/status envelope 仅有 `status` 时不再当作 worker record，`outputs[].url` 等 artifact 子项也不再被误判为缺 job/source id 的记录；只有明确 job/unit/task/result 路径或对象自身含 job/source/artifact/status 信号时才计入审计。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v7 fake GEARS smoke：证据目录 `/private/tmp/gears-worker-evidence-ledger-seed-v7`；worker audit 达到 `unknown_count=0`、`missing_worker_id_count=0`、`missing_source_id_count=0`、`missing_ready_artifact_count=0`、`recommended_actions=[]`；Story Agent callback audit 达到 `updated_count=4`、`failed_count=0`、`duplicate_count=3`、`ledger_match_missing_count=0`、`recommended_actions=[]`。真实 GEARS v2 endpoint 仍未配置，真实端到端和真实大项目提交压测继续等待可达 endpoint。
- 已补大项目压力响应专用审计：acceptance shell 现在生成 `gears-large-project-response-audit.json/.md`，对 `gears-large-project-submit-pressure.json` 与 worker response 逐 source 对账，专门定位 source echo 缺口、重复 source、意外 source、HTTP/curl 错误和大批量状态别名问题。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v8 大项目压力 smoke：证据目录 `/private/tmp/gears-worker-evidence-ledger-seed-v8-pressure`；30 集 × 4 镜共 120 units 全量 accepted，large-project response audit 达到 `request_unit_count=120`、`response_record_count=120`、`accepted_count=120`、`source_echo_count=120`、`missing_requested_source_count=0`、`duplicate_source_id_count=0`、`unexpected_source_count=0`、`recommended_actions=[]`；worker audit 总计 `record_count=370` 且无 missing id/source/unknown，callback audit `ledger_match_missing_count=0`。真实 GEARS v2 endpoint 仍未配置。
- 已补最终 GEARS worker acceptance verdict：脚本会生成 `gears-worker-acceptance-verdict.json/.md`，统一判定 required env、callback id preflight、worker response audit、Story Agent callback audit、大项目 pressure audit 与 manifest；真实 worker smoke 跑完后以 `acceptance_passed=true` 作为签收条件，默认 `GEARS_ACCEPTANCE_STRICT_AUDIT=1` 会在 verdict 失败时非零退出。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v9 verdict smoke：证据目录 `/private/tmp/gears-worker-evidence-verdict-v9`；最终 verdict `status=passed`、`acceptance_passed=true`、`failed_gate_ids=[]`、`recommended_actions=0`，大项目 120/120 source echo，worker/callback audit 均无阻断。真实 GEARS v2 endpoint 仍未配置。
- 已补最终 GEARS worker acceptance archive：脚本会生成 `gears-worker-acceptance-archive.json/.md`，以必交证据文件、缺失附件、byte length 和 `sha256` 生成 handoff 清单；严格模式会要求 archive `signoff_ready=true`。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v10 archive smoke：证据目录 `/private/tmp/gears-worker-evidence-archive-v10`；worker kit 为 16 条 commands / 5 个 payloads；最终 archive `status=signoff_ready`、`signoff_ready=true`、18 个必交附件全齐、证据文件 66 个、`recommended_actions=0`；verdict 6 个 gate 全过，大项目 120/120 source echo，worker/callback audit 均无阻断。真实 GEARS v2 endpoint 仍未配置。
- 已补最终 GEARS worker acceptance checksum manifest：脚本会生成 `gears-worker-acceptance-checksums.json/.md`，用于 GEARS v2 或 CI 按 `sha256` 核验证据文件；archive 生成前会清理旧 archive/checksum 输出。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v11 checksum smoke：证据目录 `/private/tmp/gears-worker-evidence-checksums-v11`；checksum manifest `algorithm=sha256`、`file_count=66`、`required_file_count=18`、`record_count=66`；archive `signoff_ready=true`、`required_checksum_count=18`，verdict/pressure/worker/callback audit 均无阻断。真实 GEARS v2 endpoint 仍未配置。
- 已补最终 GEARS worker acceptance integrity 复核：脚本会生成 `gears-worker-acceptance-integrity.json/.md`，重新计算证据文件 `sha256` 和 byte length，并检查必交附件 checksum record；严格模式会要求 `integrity_passed=true`。
- 已用新版导出的 `run-gears-worker-acceptance.sh` 跑 v12 integrity smoke：证据目录 `/private/tmp/gears-worker-evidence-integrity-v12`；worker kit 为 17 条 commands / 5 个 payloads；integrity `status=passed`、`integrity_passed=true`、`required_checksum_records=18/18`、`mismatch_count=0`、`sha256_mismatch_count=0`；verdict/pressure/worker/callback audit 均无阻断。真实 GEARS v2 endpoint 仍未配置。
- 已验证：server lint/build、client lint/build、`project-service.test.ts`、`outline-service.test.ts`、`gears-execution-service.test.ts`、`api.test.ts`。

## 3. 已完成能力

### 3.1 MCP / Agent 基础

已完成：

- Mac Codex 已接入 `china-culture-kb` MCP。
- 项目级 skills 已建立：
  - `china-culture-story-agent`
  - `china-culture-screenwriting`
  - `gears-seedance-delivery`
- MCP 已有 22 个工具。
- Story Agent 相关 MCP 已完成：
  - `kb_get_project_context`
  - `kb_generate_story_blueprint`
  - `kb_validate_genre_story`
  - `kb_generate_gears_delivery`
  - `kb_generate_seedance_prompt`
  - `kb_get_production_readiness`
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

1. 前端质量反馈增强：暴露 `kb_generate_story_repair_prompt` 类似的修复提示包入口、质量 drilldown、真实浏览器视觉回归。
2. 更深模型修复链路：批量选择 P0/P1 repair actions，生成 `repaired_story_json` 后做质量对比。
3. GEARS execution contract 与 callback 接入。

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

`kb_generate_story_repair_prompt` 已完成首版：

- 能从 `project_id`、`story_id`、`story_json` 读取。
- 复用 `kb_repair_story(auto_apply=false)` 的 repair actions 和 target scenes，生成模型可直接使用的完整 JSON 修复提示包。
- 提示包包含保护字段、StoryGenerateResult 输出合同、可选原始故事 JSON、调用方补充要求和推荐工作流。
- 不写文件；后续仍由 `kb_validate_genre_story` 校验，再由 `kb_repair_story(auto_apply=true)` 写入新版本。

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

下一步最小可交付切片建议转向 GEARS v2 真实联调：

```text
GEARS v2 worker acceptance shell script submit/status/callback smoke
  -> 导出 env / payload / curl runbook
  -> 多 job type payload 映射
  -> 30 集级 worker pressure payload / optional submit
  -> dashboard / Shot Ledger 降噪
  -> retry submit 迁移为 GEARS retry job
```

原因：

- 当前已完成剪辑装配、缩略图、成片精修计划、字幕 worker、音频计划 / 混音 dry-run、混音真实 runner 输入/输出 hardening、分集混音时间归一、原声保留开关、片头片尾 dry-run、片头片尾 fake runner 输出校验、final delivery dry-run、final delivery fake runner 输出校验、final manifest、审片返修 ledger、审片驱动重试包/strict final guard、final reassemble 执行后自动解决、重试执行计划、本地重试提交、retry submit adapter、系列 provider 超时恢复、外部剪辑平台包和生产总览 dashboard。
- 这些能力足够作为 GEARS job 的计划合同、状态账本和回调展示；P0 的 config / ledger / submit / callback / sync 首轮已经完成，不需要在当前仓库继续做真实媒体执行。
- GEARS v2 已有图片实产、故事板生成和媒体落盘基础；视频与后期实产应在 GEARS 侧升级 PRD 和实现。

GEARS 首轮集成之后再做：

1. 用真实 GEARS v2 endpoint 做 submit / status / callback smoke。
2. 用真实 GEARS callback secret 和多 artifact 回传做公网/内网 webhook smoke。
3. 系列 retry submit adapter 迁移为 GEARS retry job。
4. GEARS 侧补视频 / 后期 job 和 artifact callback。
5. 30 集以上大系列压测。

## 8. Story Agent 创作平台重定位最新进度（2026-06-24）

本轮继续沿“AI 影视前期创作、剧本生产与项目素材指挥系统”推进，仍未实现 GEARS 图片/视频/后期实产。

已新增：

- Shared contract：`ProjectMaterialPackTarget`、`ProjectMaterialPackAddMaterialRequest` 和 `ProjectMaterialPackAddMaterialRequestSchema`。
- 后端项目服务：`addProjectMaterialPackMaterial` 可将人工素材写入 `material_pack` 的主素材、支撑素材或参考素材；可同步 verified fact、移除已补齐 missing need，并统一重算 `material_sufficiency`、`creation_contract`、质量报告中的 material report 以及旧 `knowledge_pack` 兼容包。
- API：`POST /api/projects/:projectId/material-pack/materials`。
- 项目详情页：新增“项目素材包”面板，显示主/支撑/参考/待补计数，并支持直接新增项目素材。
- 测试：`project-service.test.ts` 覆盖素材写入、项目版本快照、源 story 文件回写和合同刷新；`api.test.ts` 覆盖 HTTP 校验与成功写入。
- StoryStudio：顶部新增 `原创开发 / 资料改编 / 机构影像` 三条创作路径，路径自动带出 `creation_use_case`、`truth_mode`、默认 `video_type` 和 `story_priority`；旧输入模式改为素材输入方式。
- 原创开发：后端 `generateAndStoreStory` 支持 outline-only 原创生成，使用用户原创故事种子 entry，不再要求先匹配素材包，也不会误写 `adaptation_analysis`。
- StoryStudio 路径联动：素材输入方式切到原作改编会同步 `source_material_mode=adapt_user_novel`；切到素材检索会回到机构影像合同；同一路径内切主题/大纲不重置成片类型。
- Projects 工作台：故事列表新增创作用途、真实模式和素材 gate 展示，并支持创作用途 / 素材 gate 筛选。
- 旧项目读时补齐：`listProjects()` / `getProject()` 会从当前 story 推断新合同与素材 gate 字段，返回给列表和详情；历史 `project.json` 不会被批量改写。

已验证：

- `web/server npm run lint`
- `web/server npm test -- src/__tests__/project-service.test.ts`（50 passed）
- `web/server npm test -- src/__tests__/api.test.ts`（153 passed）
- `web/client npm run lint`
- `web/client npm run build`
- `mcp-server npm test`
- `mcp-server npm run build`

## 9. 不要做的事

- 不要把生成故事、修复结果、交付包写入 `data/provinces/*.md`。
- 不要把 Production Board 做成纯展示页，它必须继续服务于资产派生、监督检查、可执行修复和交付。
- 不要让 `visual_prompt`、Seedance prompt 混入质量报告、来源分析、TODO、字段名或内部指令。
- 不要让生成页承担批量删除、复杂筛选、制作流水线管理；生成页只保留主流程和最近故事入口。
- 不要在默认界面堆满高级按钮；低频、高风险、制作类操作放进折叠区。
- 不要让空修复污染版本历史。
- 不要覆盖旧版本；修复类写入必须新增版本并保留 trace。
- 不要继续在当前仓库扩展真实图片、视频、字幕烧录、混音、片头片尾或最终装配执行器；真实媒体产出归 GEARS。

## 10. 新对话推荐开场指令

可以直接把下面这段发给新对话：

```text
请继续 /Users/wuyu/Desktop/china-culture-kb 的 Story Agent 开发。先阅读 docs/gears-execution-integration-plan.md、docs/story-agent-next-development-plan.md、docs/story-agent-next-conversation-handoff.md 和其中列出的计划文档/技能。当前分支是 codex-ai-comic-series-longform。先执行 git status --short --branch 和 git diff --stat，不要覆盖用户改动，尤其不要回滚 data/provinces/湖南.md。新的方向是：china-culture-kb 只做内容与生产指挥层，图片/视频/后期实产全部交给 GEARS v2。优先实现 P0：GEARS execution config/contract、GEARS job ledger、提交 GEARS job、GEARS callback 归一化；暂停继续做真实 Seedance SDK、真实 ffmpeg 片头片尾、真实 final assemble。默认界面保持简单，只保留高频主路径。
```

如果新任务是本项目产品重定位和生成链路改造，可以直接发：

```text
请继续 /Users/wuyu/Desktop/china-culture-kb 的 Story Agent 开发。本次任务只针对本项目，不实现 GEARS 图片/视频/后期实产。先阅读 docs/story-agent-creative-platform-reposition-plan.md、docs/story-agent-next-development-plan.md、docs/story-agent-next-conversation-handoff.md 和 .codex/skills/china-culture-story-agent/SKILL.md。当前新方向是：把项目从“知识库驱动的故事生成器”升级为“AI 影视前期创作、剧本生产与项目素材指挥系统”。优先做 Phase 1：新增 CreationUseCase、TruthMode、CreationContract、MaterialPack、MaterialSufficiencyReport，并兼容旧 knowledge_pack；然后把 creation_contract 接入 StoryBlueprint、StoryGenerateRequest/Result、prompt package 和项目版本存储。开始前先执行 git status --short --branch 和 git diff --stat，不要覆盖用户已有改动。
```

## 11. 下一步执行建议

如果只继续一个最小任务，建议做：

```text
导出 GEARS worker acceptance kit，并按 runbook 执行真实 submit/status/callback smoke
```

理由：

- MCP 诊断、修复建议、受控版本写入、安全 auto_apply、真实项目回读和前端质量反馈首版都已经跑通。
- Provider 队列元数据、超时恢复、外部回传 schema、轮询入口、失败分类、通用 submit/poll adapter、platform payload / HMAC 签名、队列状态总览、人工重试策略和重试执行自动化首版已经落地；GEARS P0 config / ledger / submit / callback / sync 已复用这些基础完成首轮。
- AI 漫剧字幕、音频、片头片尾 dry-run、final delivery dry-run、final manifest、审片返修 ledger、retry submit adapter、外部剪辑平台包和生产总览 dashboard 首版已经落地，足够作为 GEARS 实产 job 的上游合同和状态展示。
- 这会把“提示词包”继续推进到“GEARS 可执行生产任务流”。

如果准备做下一组任务，建议顺序：

1. 收尾并提交当前改动。
2. StoryStudio / Projects 继续降噪。
3. 用 worker acceptance kit 跑 GEARS v2 真实 endpoint smoke 与多 job type payload 映射。
4. MCP 更深模型修复链路。
5. dashboard / Shot Ledger 降噪，再推进 GEARS 侧视频和后期 job。
