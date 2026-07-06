# Story Agent 生产素材体系开发蓝图

更新时间：2026-07-05

## 本轮对话已完成

1. 明确当前素材库的补充逻辑：项目已经有知识条目、知识组合包、项目素材包、素材充分度 gate、类型画像矩阵和 StoryBlueprint，但缺少“按成片类型稳定生产”的素材模板层。
2. 选择首批稳定产出的三类片：`heritage_promo`、`documentary_short`、`ai_comic_drama`。
3. 为三类片建立生产素材包：每类一套 `required_fields`、三阶段 gate、补充问题和 10 条样板条目。
4. 记录 B站 `BV1xuVC6AEbg` 爆款 AI 漫剧解说来源，但限定为 `ai_comic_drama`，不作为全类型参考。
5. 联网补充模板依据：非遗官方影音资源、纪录片技法、B-roll 论文、Seedance 2.0、Video-of-Thought、角色/动作一致性论文。
6. 接入 Story Agent 自动调用：按 `video_type` 读取当前类型生产素材模板，写入 prompt、生成结果和 `_request_meta`。
7. 新增生产素材 readiness：模板字段不只是进入 prompt，还会生成缺口报告和补库任务。
8. 完成 Phase 3 核心联动：`production_material_readiness` 已进入 `quality_report`，会参与 `passed` 判断、生成 `production_material` 修复动作，并让 GEARS 交付包在生产素材未达 `production_ready` 时降级为 `needs_input`。
9. 推进 Phase 4 前端工作台：项目详情和生成结果页已显示 Production Material 质量卡与生产素材缺口；补充任务页已支持筛选 `production_material_missing_field`；项目详情页已新增当前成片类型生产模板面板，展示 required fields、prompt layers、三阶段 gate、缺口字段和推荐补充问题。
10. 完成 Phase 5 首版模板草案流水线：新增 `kb_draft_production_pack` / `npm run kb:draft-production-pack`，可从目标类型来源观察生成候选 `ProductionMaterialPack`、审稿清单和警告；已生成 AI 漫剧草案报告。
11. 补跑 AI 漫剧准真实生成验收：`20260702-story-5zhd4151f8c7--ai_comic_drama` 已落盘，包含 5 个 scene、5 个 GEARS segment、`production_material_readiness=needs_input`、质量报告 `production_material` 修复动作、GEARS delivery `needs_input` 和 5 个补充任务。
12. 补齐 Phase 4 任务闭环：项目详情页的生产素材模板面板已能跳转到当前项目的 `production_material_missing_field` 补充任务筛选页，缺口字段会映射已有补充任务并支持一键标记完成/重新打开，同时展示当前类型的样板条目摘要。
13. 补强生产素材补充写回：完成 `production_material_missing_field` 任务并填写补充说明后，会写回 `material_pack`，重新计算 `production_material_readiness`，刷新质量报告中的 Production Material 卡片和已有 GEARS delivery；同时修正 `missing_needs` 被误当作字段证据的 false positive。
14. 推进字段级补录与候选稿：补充任务支持 `supplement_field_values`，前端按 `recommended_fields` 显示字段级输入；任务完成后自动生成 `knowledge_candidate_markdown`，可在补充任务页和项目详情页回看；补充任务列表 API 支持 `project_id` 过滤。
15. 建立候选稿导出首版：新增项目知识库候选稿导出包 `project-knowledge-candidates/v1`，项目详情页可一键复制候选稿 Markdown 审稿包，便于人工核实后再转正式知识库草案。
16. 补齐候选稿审稿首版：候选稿支持 `pending_review / approved / rejected` 审稿状态；项目详情页可标记通过、驳回或待审；通过后自动生成 `knowledge_writeback_draft_markdown` 正式知识库写入草案，并进入候选稿导出包。
17. 建立省份 Markdown 写入 Patch 草案：新增 `project-knowledge-writeback-patch/v1` 导出包，只汇总已通过审稿的候选稿，自动推断建议目标 `data/provinces/<省份>.md`，生成 append markdown、PR title/body 和项目详情页复制入口；同时修正项目素材反推 `knowledge_pack` 时覆盖真实省份的问题。
18. 推进人工入库队列首版：通过审稿的写入草案支持 `draft_ready / queued / written_back / needs_revision` 状态，项目详情页可标记入队、已入库、需重审；集中补充任务页同步显示入库状态，导出包携带入库备注。
19. 补齐写回队列筛选：补充任务列表 API 支持按 `knowledge_writeback_status` 查询；集中补充任务页新增写回状态筛选和写回草案、入库队列、已入库统计，方便人工入库队列从单项目操作进入集中处理。
20. 建立集中写回队列导出：新增全局 `project-knowledge-writeback-patch/v1` 队列导出接口，支持按项目和写回状态导出多个项目的已通过候选稿；集中补充任务页可一键复制当前筛选范围的写回 Patch Markdown。
21. 接入生产素材自动草拟：新增 `project-production-material-draft/v1` 项目动作，可从 `scene_breakdown`、`gears_segments`、对白和镜头提示中草拟 AI 漫剧生产字段（参考关键帧、一致性计划、单镜头测试、多分镜连续性、转场计划等），并接入制作 readiness 自动化和项目详情页按钮。
22. 接入 Seedance 本地参考资产占位生成：新增 `project-seedance-asset-placeholders/v1` 项目动作，可从 Production Board 的 `seedance_asset_report` 为缺文件的 `@图片` 槽位生成 SVG 参考卡，写回 `seedance_asset_library`，刷新交付包，并接入制作 readiness 自动化和项目详情页按钮；已在真实项目 `20260702-story-5zhd4151f8c7--ai_comic_drama` 验证，Seedance 待上传素材 `5→0`、受影响镜头 `5→0`、交付清单 `6/7→7/7 ready`。
23. 接入本地 GEARS 验收闭环：新增 `accept_local_gears_artifacts` / `project-gears-local-acceptance` 项目动作，可把 `local-gears-*` mocked job 写入 `local_acceptance` artifact，刷新 GEARS ledger、Seedance shot ledger、Production Board 和制作 readiness；已在真实项目 `20260702-story-5zhd4151f8c7--ai_comic_drama` 验证，GEARS active `5→0`、readiness `85→100`、lanes `5/7→7/7 ready`。该动作只代表本地验收占位产物，不代表外部 GEARS/Seedance 已真实回片。
24. 补强交付来源透明度：制作 readiness summary、GEARS lane evidence 和项目详情页会区分 `external_ready` 与 `local_acceptance_ready`；当 ready job 只有本地验收 artifact 时，报告会生成 info 级 `gears-local-acceptance-only` 提示，保持 100 分 ready 的同时明确真实外部回片仍待验收。
25. 补齐外部回片覆盖本地验收的回归保护：真实 GEARS callback 带外部 artifact URL 回来后，会替换对应 `local_acceptance` artifact，刷新 Seedance shot ledger 选用版本，并让 readiness 的 `external_ready` 增加、`local_acceptance_ready` 和 `ready_without_external` 下降。
26. 建立 GEARS 外部回片交接包：新增 `project-gears-external-callback-handoff/v1` 项目导出能力，按项目列出仍缺真实外部 artifact 的 GEARS job、callback path/url、preflight path/url、safe import path/url、可直接交给外部 worker 的回调样例、批量 callback payload、指向 preflight 与安全导入端点的 curl 命令、operator checklist、local acceptance 边界说明和对应 Seedance prompt；项目详情页已提供 Markdown/JSON/独立 payload 导出入口，并新增外部回片 preflight 与安全导入路径，可在写入前拦截 `gears.example` 示例 URL、local acceptance URL、localhost/private network URL、非 `http(s)` 绝对 URL、账本不匹配、重复 eventId/replay 和缺真实 artifact 的 payload，同时返回 `duplicate_event_count` 方便操作员核对重复回传数量；缺 `eventId` 的真实回片会给 warning 但不阻断导入，以兼容外部 provider。制作 readiness 会在 `ready_without_external` 时自动提示 `export_gears_external_callback_handoff`，避免把本地验收产物误当成真实 GEARS/Seedance 回片。
27. 补齐独立知识库写回队列页：新增 `/knowledge-writeback-queue`，只显示已通过审稿并生成正式写入草案的候选稿，支持按项目、成片类型、目标省份和写回状态筛选，支持复制当前筛选范围的省份 Markdown Patch，并可直接把草案标记为草案就绪、已入队、已入库或需重审。
28. 扩展写回队列 API 筛选：`/api/projects/supplement-tasks` 和全局 `project-knowledge-writeback-patch/v1` 导出支持 `video_type`、`province` 与 `knowledge_writeback_status` 组合筛选；列表项会带出推断目标省份和建议写入文件，导出 Markdown 记录片型/省份筛选范围。
29. 补深三类核心片型生产模板：`heritage_promo` 和 `documentary_short` 新增 production prompt layers，分别把事实边界、流程资产、人物空间、镜头抓手，以及现实入口、来源结构、影像组织、事实边界拆清；`ai_comic_drama` 继续沿用基础设定、氛围画质、画面内容、单镜头验证和多分镜验证分层。
30. 正式接入第四类高频片型 `explainer_video`：新增知识讲解视频 ProductionMaterialPack，包含 12 个 required fields、4 层 prompt layers、三阶段 gate、补充问题和 10 条样板；readiness、审计和升级计划已能生成 explainer 缺口报告与最小素材包批次。
31. 推进 Domain Pack 扩库：`data/domain-packs/china-culture.json` 增补非遗流程生产包、纪录片来源包、AI漫剧分镜包、朝代服饰与器物包、讲解知识结构包；升级计划新增 `explainer_knowledge_structure_pack` 建议，并重新生成审计/升级计划报告。所有知识库写回仍只进入候选稿、审稿和写回草案，不自动改写 `data/provinces/*.md`。
32. 建立跨项目 GEARS 外部回片交接队列：新增系统级 `gears-external-callback-handoff-queue/v1` 只读导出，汇总所有仍缺真实外部 artifact 的项目级 GEARS handoff，提供合并 callback 样例、逐项目 preflight/safe import 路径、operator checklist 和 Markdown；项目总览页可一键复制外部回片队列，但导入仍必须走各项目 preflight 与安全导入端点，且继续禁止把 `local_acceptance`、localhost/private network 或 `gears.example` 示例 URL 当作真实外部回片。
33. 推进真实外部回片闭环到系统级批量入口：新增 `/api/system/gears-external-callbacks/preflight` 与 `/api/system/gears-external-callbacks/import`，外部 GEARS/Seedance worker 可一次回传多项目真实 artifact callback；系统会按 `sourceProjectId` 分组，缺失时只在 GEARS ledger 唯一命中时反查项目，先逐项目 preflight，确认无阻断后才调用现有项目安全导入。入口复用 `GEARS_CALLBACK_SECRET`，并继续拦截示例 URL、本地验收 URL、localhost/private network URL、非 `http(s)` URL 和账本不匹配 payload。
34. 把系统级外部回片纳入 GEARS worker acceptance kit：`gears-execution-worker-acceptance-kit/v1` 新增 `gears-system-external-callback-smoke.json` payload、系统级 preflight/import 两个 Story Agent callback 阶段命令、shell 脚本证据文件和 callback response audit 扫描；ledger seed 会同步 patch 系统级 payload，验收脚本可验证 `blocked=false`、`updated_count>0`、真实外部 artifact 写入和 `local_acceptance`/示例 URL 边界。
35. 把系统级外部回片纳入最终 worker evidence 签收门槛：`gears-worker-acceptance-verdict` 新增 `system_external_callback_batch` 独立 gate，要求系统级 preflight/import 响应均为 `blocked=false`、`ready_to_import_count>0`、`updated_count>0`、`failed_count=0`、`unresolved_count=0`；archive 把系统级回片 payload、ledger seed、preflight/import 响应列为必需证据；signoff API/Markdown 新增 `system_external_callback_passed` 和 ready/updated/blocking 计数，最终 `ready` 不再可能只靠 local acceptance 或普通 callback audit 通过。
36. 移除 worker acceptance kit 的固定 `.test` 回片样例并接入真实 worker artifact 自动抽取：系统级外部 callback payload 的 `outputUrl` 改为 `<GEARS_SYSTEM_EXTERNAL_OUTPUT_URL>`，脚本会先从 GEARS submit/status 响应中的 `artifact`/`output`/`media`/`video` URL 字段抽取真实公网 artifact URL，抽不到时才要求操作员用 `GEARS_SYSTEM_EXTERNAL_OUTPUT_URL` 手工覆盖；`story-agent-system-external-output-url-source.json` 会记录 URL 来源是 `worker_response` 还是 `env`、是否仍是占位、是否可外部导入，verdict/signoff 会在 URL 来源未验证、仍是占位或不可外部导入时失败，archive 也把该来源证据列为必需附件。
37. 同步 MCP worker evidence signoff 的真实回片门禁：`kb_get_gears_worker_evidence_signoff` 现在会读取 `story-agent-system-external-output-url-source.json`、系统级 preflight 响应和 import 响应，输出 `system_external_callback_passed`、URL 来源、ready/updated/blocking 计数和 verdict gates；MCP `status=ready` 同样要求 URL 来源为 `worker_response` 或 `env` 且非占位、系统级 preflight/import 全部通过，避免命令行签收把 placeholder、local acceptance 或普通 callback audit 当成真实外部回片。
38. 把 Domain Pack 从检索包升级为生产提示包：`KnowledgePackEntry` 新增可选 `production_prompts` 和 `review_boundaries`；非遗流程、纪录片来源、AI漫剧分镜、朝代服饰器物、讲解知识结构五类包已写入结构化生产提示和审稿边界，Story Agent prompt 会把这些字段随知识包一起注入，明确“怎么拍/怎么审”以及“哪些不能写成事实”。
39. 补齐第二批高频 Domain Pack：新增儿童改写规则包、短视频钩子包、宣讲培训结构包，并为 `children_story`/`children_animation`、`social_short`、`lecture_video`/`education_training` query 增加优先匹配；升级计划的 Domain Pack 扩库建议同步输出 `children_adaptation_safety_pack`、`short_video_hook_pack` 和 `education_training_structure_pack`。
40. 接入第二批高频片型 production pack 首版：`children_story`、`social_short`、`lecture_video`、`education_training` 已进入 `video-type-material-supplement-packs.json`，包含 required fields、prompt layers、三阶段 gate、补充问题和样板条目；Story Agent 会按当前 video_type 自动注入对应模板，readiness service 已能识别儿童年龄段/安全冲突、短视频三秒钩子/竖屏节奏、宣讲主讲定位/论点案例、培训学习目标/练习检查等字段。
41. 把第二批高频片型接入底库生产化治理：`kb:production-audit` 现在会审计 `children_story`、`social_short`、`lecture_video`、`education_training` 的模板覆盖；`kb:production-upgrade-plan` 会输出四个对应最小素材包批次，并把儿童改写安全、短视频钩子、宣讲/培训结构包按真实缺口动态升优先级。重生成后的升级计划为 13 个批次、396 个计划动作，仍只生成报告和候选补库任务，不直接改写 `data/provinces/*.md`。
42. 加硬知识库写回队列服务端门禁：`updateProjectSupplementTask` 现在只有在候选稿 `approved` 且已生成 `knowledge_writeback_draft_markdown` 后，才允许变更 `knowledge_writeback_status` 或写回备注；补充任务列表新增 `knowledge_writeback_ready` 服务端筛选，独立写回队列页只请求已通过审稿并有正式写回草案的任务，防止前端误操作或接口调用绕过候选稿/审稿流程。
43. 扩展生产素材自动草拟到第二批高频片型：`draft_production_material_fields` 不再只服务 AI 漫剧关键帧/一致性字段，也会从 `scene_breakdown`、`gears_segments`、`target_audience`、`communication_goal` 和素材边界中草拟儿童年龄段/安全冲突、短视频三秒钩子/竖屏镜头/评论互动、宣讲主讲定位/案例/板书资产、培训学习目标/步骤/练习/掌握检查等字段。草拟结果仍只写入项目补充任务和候选稿，等待人工审稿后才能进入知识库写回队列。
44. 继续加硬真实外部回片签收：Web `gears-execution-worker-evidence-signoff` 与 MCP `kb_get_gears_worker_evidence_signoff` 现在会独立复核 `story-agent-system-external-output-url-source.json` 中的 `output_url`，即使证据声明 `ready_for_external_import=true`，只要 URL 是 localhost、私网 IP、`.local`、`gears.example`、`story-agent.example` 或 `local.story-agent.invalid`，也不会让 `system_external_output_url_source_ready` 通过，避免把本地地址或示例地址签成真实 GEARS/Seedance 外部回片。
45. 补强独立知识库写回队列批量导出：`/knowledge-writeback-queue` 在继续只加载已审稿通过且已生成写回草案任务的前提下，新增当前项目/片型/省份/写回状态筛选范围的 JSON 导出包复制入口；Markdown Patch 面向人工 PR，JSON 包面向审稿工具和外部写回流水线，二者都不直接改写 `data/provinces/*.md`。
46. 接上 `explainer_video` 生产素材自动草拟：`draft_production_material_fields` 现在可从目标受众、传播目标、`argument_points`、`knowledge_outline`、分镜、GEARS visual focus 和素材事实边界草拟知识讲解片的受众层级、论点、知识大纲、概念定义、讲解步骤、可视化类比和复盘句；第四类高频片型的缺口任务也会先进入项目候选稿和审稿流程，不直接写入省份 Markdown。
47. 补齐首批核心片型自动草拟面：`heritage_promo` 可从分镜、GEARS visual focus、传播目标和素材边界草拟项目名、工艺类型、材料/工具线索、流程步骤、手部动作、文献影像资产、视觉符号、声音质感、当代连接和生产风险；`documentary_short` 可草拟纪录片核心问题、现实入口、来源线索、时间线、采访角色、片段选择、现场笔记、B-roll、再现边界、当代痕迹、环境声和禁用声称。官方链接、授权、传承谱系等硬事实仍必须人工核实后才能写回。
48. 补强系统级真实外部回片操作物料：项目指挥页的生产指挥总览现在可分别复制跨项目 GEARS 外部回片队列 Markdown、`callback_batch_sample` JSON payload，以及带 `x-gears-callback-secret` 占位的系统 preflight/import curl 模板；前端仍不直接导入回片，必须先把 placeholder outputUrl 替换成真实公网 artifact URL 并通过系统 preflight，避免把 local acceptance 或示例 URL 当成真实外部回片。
49. 下沉系统级回片命令模板到服务端：`gears-external-callback-handoff-queue/v1` 现在直接返回 `system_preflight_curl` 和 `system_safe_import_curl`，Markdown 也包含统一命令段；项目指挥页复制命令时复用服务端字段，避免 UI、API、worker 证据包之间出现不同 preflight/import 操作口径。
50. 增加系统级回片队列 payload 自检：`gears-external-callback-handoff-queue/v1` 会统计 callback sample 总数、可直接导入数量、placeholder outputUrl、local/private outputUrl 和 invalid/missing URL，并输出 `sample_payload_ready_for_import`；项目指挥页复制 JSON payload 或命令时同步显示 ready/placeholder 计数，明确样例 payload 默认不能当真实外部回片导入。
51. 建立 ProductionMaterialPack 组合体健康门禁：新增 `/api/system/production-material-pack-health` 只读报告，检查核心/高频片型是否有模板、required fields 是否全部映射到 readiness field spec、是否存在重复字段，以及 prompt layers、三阶段 gate、补充问题和样板条目是否达到下限；首批核心片型和 `explainer_video` 被固定为 10 条样板与 4 层 prompt 以上，后续扩片型可先过健康报告再进入 Story Agent 调用链。
52. 将生产素材模板健康纳入 Story Agent MVP 状态：`story-agent-mvp-status/v1` 新增 `production_material_packs` lane，并嵌入 `production_material_pack_health`；模板缺失、未知 required field 或重复字段会让 MVP 状态阻断，样板、prompt layers、gate 或补充问题不足会进入需处理状态，项目总览页同步展示核心片型模板通过数。
53. 将生产素材模板健康纳入 GEARS worker 签收证据链：worker acceptance kit 会抓取 `production-material-pack-health-before/after.json` 并生成 `production-material-pack-health-audit.json/.md`，最终 verdict 增加 `production_material_pack_health_audit` gate，archive 将这些文件列为 required attachments，Web signoff 也要求该 audit passed 后才可 ready；避免真实 GEARS/Seedance 回片签收时忽略片型模板退化。
54. 建立 Domain Pack 生产提示健康门禁：新增 `/api/system/domain-pack-production-health` 只读报告，检查非遗流程、纪录片来源、AI漫剧分镜、朝代服饰器物、讲解知识结构、儿童改写、短视频钩子和宣讲培训结构 8 个生产提示包是否具备 trigger words、production prompts、review boundaries 和预期 asset usage；`story-agent-mvp-status/v1` 新增 `domain_packs` lane，项目总览页同步展示生产 Domain Pack 通过数，继续保持所有知识库写回只走候选稿与审稿流程。
55. 将 Domain Pack 生产提示健康纳入 GEARS worker 签收证据链：worker acceptance kit 会抓取 `domain-pack-production-health-before/after.json` 并生成 `domain-pack-production-health-audit.json/.md`，最终 verdict 增加 `domain_pack_production_health_audit` gate，archive 将这些文件列为 required attachments，Web/MCP evidence signoff 要求该 audit passed 后才可 ready；避免真实 GEARS/Seedance 回片签收时忽略生产提示包和审稿边界退化。
56. 同步 MCP Story Agent MVP 与 worker evidence signoff 的模板/Domain Pack 健康门禁：`kb_get_story_agent_mvp_status` 现在只读扫描 `data/production-packs` 与 `data/domain-packs`，输出 `production_material_packs`、`domain_packs` 两条 lane、对应 summary 字段和嵌入式健康报告；`kb_get_gears_worker_evidence_signoff` 同步读取并要求 `production-material-pack-health-audit.json`、`domain-pack-production-health-audit.json` 通过后才可 `ready`，避免 Web 与 MCP 签收口径分裂。

## 原始诊断必须并入路线

底层素材库仍然是 `data/provinces/*.md` 的省份 Markdown 条目。每条条目由简介、故事梗概、文化意义、地点、关键词、来源、可信度、核实方法和待核实点构成；可选机器字段包括 `knowledge_domain`、`entry_role`、`era`、`asset_usage`、`asset_split`。

补库工具分两类：

- 写入型：`kb_collect`、`kb_ingest_video`、`kb_add_entry`。
- 检索/策略型：`kb_supplement`，只找同名异地版本、同省同类型素材、相关条目和本地化关系，不自动写入事实。

生成链路已经会把条目转成 `knowledge_pack`，再转成 `material_pack`，并运行 `minimum_viable_story -> script_ready -> production_ready` 三阶段 gate。类型矩阵已经覆盖 15 类片，但省份条目本身还没有大规模升级为生产卡片。

当前库的真实问题（2026-07-01 审计后）：

- 已整理 169 条，湖南 124 条。
- 类型集中在非遗、地方掌故、名胜古迹、历史人物。
- 十三批回溯后平均来源数 3.53；可信度已归一为枚举，独立 `核实方法` section 已补齐。
- 169 条均已有机器字段；仍有 168 条存在待核点，严格四段口径已有 169 条有完整 `asset_split`。
- 湖南后段 40 条旧导入残留已清理：删除 188 条 `[object Object]` 来源占位和 119 条 `undefined：undefined` 地点占位；十三批回溯后缺来源、缺相关地点均已清零。
- Asset Split 建议报告已生成并清空：剩余 0 条缺完整 `asset_split` 的条目，0 条需要先补来源/地点。
- 当前完成百分比：`source_location_backfill` 已完成 37/37（100%）；正式完整 `asset_split` 写回 169/169（100%）；`kb:lint` 已覆盖 34 个文件、169 条 enriched entries 并通过。
- 结构化资产字段覆盖率仍低，整体正在从文化故事资料库升级为多片型生产素材库。

因此，后续开发必须同时推进两条线：

1. 类型生产模板线：继续扩 `ProductionMaterialPack`。
2. 底库治理线：把省份 Markdown 条目批量审计、标准化、补齐生产卡片字段。

## 总体目标

把素材库从“能查文化资料”升级为“能稳定生产不同类型影片”的生产系统：

```text
文化条目 / 用户素材 / 外部样片研究
  -> MaterialPack
  -> MaterialSufficiencyReport
  -> ProductionMaterialPack
  -> ProductionMaterialReadinessReport
  -> StoryBlueprint
  -> full_text / scene_breakdown / gears_segments
  -> quality report / supplement tasks / repair
```

## 架构分层

### 1. 数据层

文件：

- `data/provinces/*.md`
- `data/production-packs/video-type-material-supplement-packs.json`
- `sources/videos/BV1xuVC6AEbg.md`
- `docs/video-type-online-template-research.md`

职责：

- 按 `video_type` 存储生产素材模板。
- 每个来源必须标注 `applies_to_video_types`。
- 样板条目只能作为生产组织方式参考，不能直接写入知识事实。
- 省份 Markdown 条目必须逐步补齐生产卡片字段：已确认事实、待核事实、可戏剧化空间、人物、场景、道具、服饰/时代、视觉符号、对白口吻、禁用表达和来源等级。

### 2. 自动分类调用层

文件：

- `web/server/src/services/production-material-pack-service.ts`
- `web/server/src/services/story-service.ts`
- `web/server/src/services/story-generation-prompt.ts`

职责：

- 从生成请求解析 `video_type`。
- 自动取当前类型模板。
- 禁止把其他类型的爆款样片方法跨类型套用。

### 3. 生产缺口管理层

文件：

- `web/server/src/services/production-material-readiness-service.ts`
- `web/shared/types.ts`
- `web/server/src/services/project-service.ts`
- `web/server/src/routes/projects.ts`

职责：

- 将模板 `required_fields` 与当前 `MaterialPack` 做保守匹配。
- 生成 `production_material_readiness`。
- 将缺口字段转为 `supplement_tasks`，来源为 `production_material_missing_field`。

### 4. 质量与修复层

后续要接入：

- `genre-quality-service.ts`
- `story-repair-service.ts`
- `gears-delivery-service.ts`

目标：

- 不只检查故事质量，也检查“该类型能不能进入生产”。
- 对 production_ready 缺口给出修复动作，而不是只提示素材不足。

## 开发路线

### Phase 0：底库生产化审计

状态：首版已完成。

- 扫描 `data/provinces/*.md`，统计条目数量、地区/类型分布、来源数、可信度、核实方法、待核点。
- 审计每条是否具备生产卡片字段：人物、场景、道具、时代/服饰、视觉符号、禁用表达、asset usage、asset split。
- 审计每条适合哪些成片类型，以及缺哪些类型化素材字段。
- 输出 Markdown/JSON 报告，不直接批量改老条目。

产物：

- `docs/knowledge-base-production-audit.md`
- `data/reports/knowledge-base-production-audit.json`
- `mcp-server/src/tools/audit-production-materials.ts`

### Phase 1：三类模板可调用

状态：已完成。

- 三类模板：非遗宣传片、微纪录片、AI 漫剧。
- 自动按 `video_type` 调用。
- prompt 中明确模板边界。
- 测试覆盖跨类型隔离。

### Phase 2：模板缺口可管理

状态：本轮已完成首版。

- 新增 `ProductionMaterialReadinessReport`。
- 新增 `production-material-readiness-service.ts`。
- 生成结果带 `production_material_readiness`。
- 模板缺口自动进入项目补充任务。

### Phase 3：质量报告联动

状态：核心联动、前端展示、Seedance 参考资产占位、本地 GEARS 验收闭环、外部回片交接队列、系统级批量回片 preflight/import 和 worker acceptance runbook 接入已完成；下一步转向真实 GEARS/Seedance 外部执行 worker 实跑与证据签收。

- 已将 production readiness 写入 `quality_report.production_material_readiness_report`。
- 已让 production readiness 参与 `quality_report.passed`：状态非 `ready`、分数低于 70 或有阻塞字段时，质量报告自动降级。
- 已新增 `production_material` 修复动作，repair prompt 会按缺字段生成素材补充清单。
- 已让 GEARS 交付包写入 `delivery_status`：生产素材未达 `production_ready` 时降级为 `needs_input`，并在 `validation_notes` 和 Markdown 中显示缺口。
- 已让补充任务写回后重新计算 `production_material_readiness`，并同步刷新质量报告和已有 GEARS delivery。
- 已修正 readiness 检索：`missing_needs` 属于缺口声明，不再被当作生产素材证据。
- 已通过准真实 AI 漫剧生成项目 `20260702-story-5zhd4151f8c7--ai_comic_drama` 验证落盘链路。
- 已新增 Seedance 参考资产占位生成动作，缺文件的 `@` 槽位可生成本地 SVG 参考卡并被 Production Board 识别为已绑定。
- 已新增本地 GEARS 验收动作，`local-gears-*` mocked job 可被写入 `local_acceptance` artifact，并刷新项目/镜头账本和制作 readiness。
- 已新增项目级 GEARS 外部回片交接包和系统级跨项目外部回片队列，外部 worker 可按项目拿到 preflight/safe import 路径、callback 样例和待替换真实 artifact URL 清单。
- 已新增系统级批量 GEARS 外部 callback preflight/import，外部 worker 可一次回传多项目真实公网 artifact URL；系统仍会按项目执行 preflight 和安全导入，不会把 `local_acceptance` 或示例 URL 当外部回片。
- 已将系统级外部 callback preflight/import 纳入 GEARS worker acceptance kit、shell script、payload 文件、callback response audit、acceptance verdict、archive 必需证据和 worker evidence signoff ready 判定；worker kit 已不再内置 `.test` 回片 URL，会优先从 GEARS worker 响应自动抽取真实公网 artifact，必要时再通过 `GEARS_SYSTEM_EXTERNAL_OUTPUT_URL` 手工覆盖。
- 已同步 MCP `kb_get_gears_worker_evidence_signoff` 的签收口径，MCP 与 Web signoff 一样要求系统级外部 artifact URL 来源可验证，且 preflight/import 真正写入外部回片后才会返回 `ready`。
- 待继续：接入真实 GEARS/Seedance 外部执行 worker，把交接队列中的样例 `outputUrl` 替换为真实公网 artifact URL 后回传，并跑出 `system_external_callback_passed=true` 的 worker evidence signoff。

### Phase 4：前端工作台

状态：任务闭环首版已完成，下一步转向真实素材补录与更下游交付验收。

- 已在项目详情页质量区显示 Production Material 分数、状态和缺口摘要。
- 已在 `StoryResult` 的可修复质量报告区显示 Production Material 卡片。
- 已在补充任务页支持筛选 `production_material_missing_field`。
- 已在项目详情页单独展示当前类型生产模板、三阶段 gate、required fields、prompt layers、缺口字段和推荐补充问题。
- 已支持从项目详情页跳转到当前项目的生产素材补充任务列表，URL query 会自动筛选状态、来源和项目。
- 已支持定位缺口字段对应的补充任务，并在模板面板直接标记完成或重新打开。
- 已展示当前类型 `sample_entries` 摘要，供创作和补库时对照。
- 已完成补充说明到 `material_pack` 的项目级写回，并刷新生产素材 readiness。
- 已给补充任务接入字段级素材录入表单，字段值会随任务更新写入 `supplement_field_values`。
- 已把可复用补录内容自动整理成 `knowledge_candidate_markdown` 候选稿；候选稿只进入项目任务，不直接写入省份 Markdown。
- 已让任务列表 API 支持 `project_id` 过滤，项目详情页跳转后可只加载当前项目任务。
- 已新增候选稿导出包与项目详情页复制入口，支持把当前项目所有候选稿汇总为 Markdown 审稿包。
- 已新增候选稿审稿状态：待审、通过、驳回。
- 已在项目详情页支持候选稿审稿操作；通过后自动生成正式知识库写入草案。
- 已把通过审稿的写入草案转成省份 Markdown patch/PR 草案导出包，并在项目详情页提供复制入口。
- 已把 patch 草案接入人工入库队列状态：草案就绪、已入队、已入库、需重审。
- 已在项目详情页 Seedance 素材缺口区新增“生成占位参考图”，可把缺文件素材自动生成本地 SVG 参考卡并刷新 Production Board。
- 已在制作 readiness 中新增 `draft_seedance_asset_placeholders` 自动化动作，缺失 Seedance 参考文件时可作为可执行步骤进入安全自动化计划。
- 已完成独立人工入库队列页，支持按项目、片型、目标省份和写回状态筛选，并可批量复制当前筛选范围的写回 Patch。

### Phase 5：在线模板采集流水线

状态：首版草案生成已完成，联网采集与正式写入仍需人工确认。

- 已新增 `mcp-server/src/tools/draft-production-material-pack.ts`，从正式 packs 的 `source_observations` 和可选外部观察 JSON 生成候选 `ProductionMaterialPack`。
- 已新增命令 `npm run kb:draft-production-pack -- --video-type <type>`，输出 Markdown 审稿稿和 JSON 报告。
- 已新增 MCP 工具 `kb_draft_production_pack`，支持传入目标 `videoType` 和额外来源观察 JSON。
- 已生成样例产物：`docs/production-material-pack-draft-ai_comic_drama.md` 与 `data/reports/production-material-pack-draft-ai_comic_drama.json`。
- 待继续：接入真实联网采集、人工确认写入、正式包隔离测试自动生成。

### Phase 6：省份条目批量升级为生产卡片

状态：可信度归一化、机器字段补齐、导入残留清洗、来源/地点回溯、asset_split 候选建议和 asset_split 审稿写回已完成；严格四段式生产资产覆盖率 169/169（100%），类型最小素材包仍待继续做更细的片型增强。

- 已标准化 `可信度` 枚举：`可靠 / 基本可靠 / 待核实 / 存疑 / 混合`。
- 已把 87 条旧 `可信度与核实` 合并 section 拆成独立 `可信度` 和 `核实方法`。
- 已把 60 条显式 `可信度` 长说明挪入 `核实方法`，确保 `可信度` 只保留枚举。
- 已为 146 条缺机器字段条目补齐 `knowledge_domain`、`entry_role`、`asset_usage`，并在可推断时补 `era`；当前审计显示 169 条均有机器字段。
- 已清理 40 条旧导入残留，并在升级计划中新增 `source_location_backfill` 批次。
- 已完成十三批来源/地点回溯，当前审计显示 0 条缺来源、0 条缺相关地点；原 37 条高优先级补源队列已完成 37 条（100%）。
- 已修正 Markdown 条目解析边界，避免跨 `---` 或地区小标题读取后续条目的资产段。
- 已生成并清空 `Asset Split` 建议报告：剩余 0 条可进入编辑审稿，0 条需先走 `source_location_backfill`。
- 已正式写回 169 条完整 `asset_split`，严格覆盖率 169/169（100%）；下一步转入片型最小素材包增强、quality/readiness 联动和前端工作台。
- 按片型补最小素材包：
  - 人物/历史剧情：中心事件、人物目标、阻力、选择、代价、时代物件。
  - 纪录片：现实地点、可引用来源、采访/见证人、再现边界。
  - 非遗/工艺：完整流程、材料工具、手部动作、传承人、当代困境。
  - 城市/场景/山水：空间路线、地标节点、季节光影、生活场景。
  - 讲解/培训：核心问题、知识层级、例子、步骤、复盘。
  - 漫剧/短视频：前三秒钩子、对白冲突、表情动作、反转/追看钩子。

产物：

- `docs/knowledge-base-production-upgrade-plan.md`
- `data/reports/knowledge-base-production-upgrade-plan.json`
- `docs/knowledge-base-credibility-normalization.md`
- `data/reports/knowledge-base-credibility-normalization.json`
- `docs/knowledge-base-machine-metadata-enrichment.md`
- `data/reports/knowledge-base-machine-metadata-enrichment.json`
- `docs/knowledge-base-import-residue-cleanup.md`
- `data/reports/knowledge-base-import-residue-cleanup.json`
- `docs/knowledge-base-asset-split-suggestions.md`
- `data/reports/knowledge-base-asset-split-suggestions.json`
- `mcp-server/src/tools/plan-production-material-upgrade.ts`
- `mcp-server/src/tools/normalize-credibility-sections.ts`
- `mcp-server/src/tools/enrich-machine-metadata.ts`
- `mcp-server/src/tools/clean-import-residue.ts`
- `mcp-server/src/tools/plan-asset-split-suggestions.ts`

### Phase 7：Domain Pack 扩库

状态：首批和第二批生产型 Domain Pack 已接入，后续继续补垂直学科/平台样片级包。

- 朝代设定包、地域文化包、非遗流程包、纪录片来源包、AI 漫剧分镜包、朝代服饰与器物包、讲解知识结构包、儿童改写规则包、短视频钩子包、宣讲培训结构包已进入 `data/domain-packs/china-culture.json`。
- 非遗流程、纪录片来源、AI 漫剧分镜、朝代服饰器物、讲解知识结构、儿童改写、短视频钩子、宣讲培训结构包已带 `production_prompts` 和 `review_boundaries`，会进入 Story Agent prompt。
- `children_story` / `social_short` / `lecture_video` / `education_training` 相关 query 已有优先 Domain Pack 命中。
- 所有 Domain Pack 只提供采集结构、生产提示和审稿边界，不自动写入 `data/provinces/*.md`，也不得替代具体来源核验。

## 近期优先级

1. 回溯补源：`source_location_backfill` 已完成 37/37（100%），后续只需在新增条目进入队列时增量处理。
2. 审稿写回 `asset_split`：剩余 0 条，正式完整写回已到 169/169（100%）。
3. 处理来源等级缺口和少量 `era` 精细化缺口。
4. 把 readiness 接进质量报告和 GEARS 交付状态：核心链路、前端显示、Seedance 本地参考资产占位、GEARS 本地验收边界、外部回片交接队列、系统级批量 preflight/import 和 worker acceptance runbook 已完成；下一步做真实 GEARS/Seedance worker 实跑、状态同步和证据签收。
5. 在前端显示生产模板缺口：模板详情、gate、样板条目、任务跳转/状态更新、项目级写回刷新、字段级录入、知识库候选稿、导出审稿包、审稿状态、正式写入草案、省份 Markdown patch/PR 草案、人工入库队列状态和独立写回队列页已完成。
6. 第四类高频类型模板已选择并接入 `explainer_video`，第二批 `children_story` / `social_short` / `lecture_video` / `education_training` production pack 首版已接入；下一步可继续补联网采集、样片审稿和正式包隔离测试。
7. 在线模板采集命令：草案生成首版已完成，下一步补联网采集和正式写入审稿流。
