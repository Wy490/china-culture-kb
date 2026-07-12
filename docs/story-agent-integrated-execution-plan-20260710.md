# Story Agent 专业文本开发与历史治理合并推进计划

更新时间：2026-07-10

状态：stage_6_real_execution_blocked_stage_7_five_lanes_51_external_next_zero_credit

## 1. 计划边界

本计划把两条工作轨道放在同一执行视图中：

1. 专业文本开发轨道：按 `docs/story-agent-all-format-professional-text-creation-handoff-20260710.md` 的 Stage 0 至 Stage 9 推进。
2. 历史治理与外部交付轨道：按 `docs/story-agent-monitor-remediation-20260710.md` 和机器治理队列处理 827 个历史样本、99 个断链项目及目标项目 5 个真实回片。

两条轨道共享版本检查点和验证纪律，但验收口径保持隔离：

- 历史归档、引用恢复和真实媒体回片不计入 `professional_text_creation_progress`。
- simulation、fixture、local fallback、本地验收 URL 和待人工审稿素材不计专业质量通过。
- 历史项目重建后，只有进入固定真实模型项目、保存修订证据并完成人工评审，才可进入专业文本证据集。
- 本计划不授权删除 generated 文件、猜测性补链、批量重建、导入占位 URL、暂存或提交版本。

## 2. 当前共同基线

### 2.1 专业文本开发

- 当前 Stage：Stage 6 / Iteration 2；15/15 片型内部合同和统一修订合同完成，15项目/30轮执行批次已生成。
- 覆盖片型：15/15。
- ProfessionalTextPackage 合同：15/15。
- ProfessionalTextPackage schema 合法骨架：15/15。
- 专业纵向管线、质量评估器和修订计划器：15/15（增加 `landscape_mood`）。
- `character_story` 固定项目规格：5/5；已运行真实模型：0/5。
- `character_story` 知识源快照与执行包：5/5；专用 bridge/CLI 技术锚：5/5；认证/付费真实模型可执行：0/5。
- `character_story` 实际专业 prompt：5/5；prepared ledger：5/5；受控计划 blocked：5/5；模型调用/真实完成：0/0。
- strict bridge 已绑定独立 operator 授权、CLI realpath/SHA-256、受控模型 alias 和预算门槛；完整 StoryScene、初稿后协调器、artifact 完整性、盲评阈值、终审候选和 signed-release 前置合同已就绪，任何单项通过均不等于专业通过。
- `character_story` 失败 fixture：3/3；明确排除于专业质量通过。
- `historical_drama` 固定项目规格：5/5；失败 fixture：3/3；真实模型完成与真人评审均为 0。
- `legend_story` 固定项目规格：5/5；失败 fixture：3/3；传说内容不计史实，真实模型完成与真人评审均为 0。
- `children_story` 固定项目规格：5/5；失败 fixture：3/3；儿童发展/安全评审、真实模型完成与真人评审均为 0。
- `ai_comic_drama` 固定项目规格：5/5；失败 fixture：3/3；待人工黄金卡不计专业通过。
- `culture_promo` 固定项目规格：5/5；失败 fixture：3/3；真实模型和品牌/导演人审均为 0。
- `heritage_promo` 固定项目规格：5/5；失败 fixture：3/3；非遗、授权和导演人审均为 0。
- `city_brand_promo` 固定项目规格：5/5；失败 fixture：3/3；真实模型和城市品牌/事实/导演人审均为 0。
- `social_short` 固定项目规格：5/5；失败 fixture：3/3；真实模型和平台编辑/事实/导演人审均为 0。
- `documentary_short` 固定项目规格：5/5；失败 fixture：3/3；真实现场、采访授权、真实模型和纪录片人审均为 0。
- `explainer_video` 固定项目规格：5/5；失败 fixture：3/3；真实模型、学科编辑和导演人审均为 0。
- `lecture_video` 固定项目规格：5/5；失败 fixture：3/3；真实模型、机构口径和演讲/导演人审均为 0。
- `education_training` 固定项目规格：5/5；失败 fixture：3/3；真实模型、教学设计、学科/安全和导演人审均为 0。
- `scene_short` 固定项目规格：5/5；失败 fixture：3/3；真实地点、真实模型、空间/声音导演和事实人审均为 0。
- `landscape_mood` 固定项目规格：5/5；失败 fixture：3/3；真实地点、真实模型、摄影/声音/剪辑和事实人审均为 0。
- Stage 6 多轮修订规格：15/15；完成两轮真实修订项目：0/15；已验证真实修订轮次：0；失败 fixture：3。
- Stage 6 执行准备：计划30轮；15/15项目阻断；Round 1可执行0/15。阻断为真实项目、初始包、授权、预算、三类评审者与桌读排期未齐。
- Stage 6 P0 真实输入接入面：统一 schema、文件/哈希/包绑定验证器、operator 模板和15项 readiness 报告已完成；ready 0/15、blocked 15/15。readiness、fixture、simulation、fallback 和准备态均不计真实修订或专业通过。
- Stage 6 P1 修订批次执行器：Round 1 / Round 2 opt-in CLI、P0 readiness 重算、不可变八类 artifact DAG、派生文本重建、成本/桌读/provenance 链、失败重试和恢复已完成；当前 P0 ready 0/15，因此没有执行真实修订。
- Stage 6 P2 桌读与版本差异产品面：独立工作台、六类 Coverage、Round 0/1/2 文本与十维分数、逐行差异、派生重建状态、反馈草稿/分配/关闭/重开和真实性标识已完成；当前仍显示 blocked 15/15、真实修订 0、专业通过 0。
- Stage 6 P3 退出审计合同：P0重算、两轮真实 provenance、八类不可变 artifact DAG、Round 0/1/2 哈希连续、预算、三角色桌读有效关闭、P2重开状态、派生重建和质量增量的逐项目重验已完成；当前15/15仍因外部输入 blocked，退出复核候选0。
- Stage 6 P6–P12 产品面：operator 输入接入、批次预检、只读退出审计、初始 ProfessionalTextPackage 检查器、operator 总控、真人桌读证据检查和退出复核 Ed25519 签名验证均已完成；浏览器实测仍为 blocked 15/15、可信签署者0、真实签名0、attestation落盘0、退出记录0、真实修订轮次0、专业通过0。
- Stage 7 P0 准备面：黄金卡真人审稿接入 schema、源文件与卡片双 SHA-256 绑定、按风险级别三角色审稿预检、operator JSON 模板、逐片型 readiness 和只读页面已完成。当前候选30/75、覆盖3/15、缺60张、pending30、人工通过0；Stage 6 未退出，因此不计 Stage 7 实际启动或专业进度。
- Stage 7 P1 候选补齐准备：12个缺失片型各绑定5个固定 benchmark 项目，共60个槽位；每槽位绑定 benchmark 文件/项目 SHA-256 和 GenreStoryProfile 合同 SHA-256，要求片型字段、可见动作、事实/演绎/虚构/未知边界、来源和授权。当前槽位60、已填写候选0、导入ready0、落盘0、人工通过0，进度保持47.5%。
- Stage 7 P2 签名验证：黄金卡审稿 JSON 与签名 attestation 双输入绑定审稿 payload SHA-256、源卡文件 SHA-256、卡片 payload SHA-256 和风险角色，信任策略固定仓库侧并验证 Ed25519。当前 trust policy 为 preparation_template、可信 signer0、真实签名0、批准0、晋升0；进度保持47.5%。
- Stage 7 P3 总控：聚合候选覆盖、黄金卡审稿、黄金卡签名、Domain Pack真人审稿和Domain Pack晋升五条lane，按12个缺失片型、30张现有卡和9个候选包生成51项唯一NEXT及内存handoff。当前五lane全blocked、Domain Pack真实submission/签名/formal patch/晋升均0；进度保持47.5%。
- Stage 8 P0 盲评接入面：统一 schema 覆盖15片型75个固定项目，绑定终稿文件与SHA-256、授权基准、匿名随机化、三类独立实名评审和排期验证；operator模板、导入验证器、逐项目readiness和页面已完成。当前ready 0/75、blocked 75/75、三角色ready 0、真人盲评通过0/45、专业通过0，进度保持47.5%。
- Stage 8 P1 全片型评估器：blind-review bundle/decision升级为v2并显式绑定video type，15片型分别读取中央ProfessionalTextTypeContract权重，生成不可共享快照与唯一SHA-256；artifact和finalization同步复核片型、权重及digest。score threshold明确不计真人盲评，真实bundle/真人通过/专业通过均0，进度保持47.5%。
- Stage 8 P2 签名检查：仓库侧trust policy、review bundle/decision/权重合同三重hash、三角色reviewer/key、canonical payload、Ed25519和时间门禁已完成。当前策略为preparation_template、trusted reviewer0、真实签名0、attestation0、signed release0；有效签名fixture只证明密码学合同，进度保持47.5%。
- Stage 8 P3 finalization只读预检：75个固定项目逐项复核专业成品、真实修订增量、签名盲评、外部trust、candidate与durable release六条lane；当前六类ready/release/professional计数均为0，candidate不计signed release或专业通过，进度保持47.5%。
- Stage 8 P4 durable release只读导入检查：严格record/manifest/authority schema绑定candidate decision、benchmark/run/video type、12件不可变artifact、发布权限、外部key、唯一release ID、签发/到期时间和Ed25519。当前authority registry为preparation_template、active authority0、verification/import/release/professional均0，进度保持47.5%。
- Stage 8 P5总控与外部交接：聚合intake、15片型evaluator、三角色签名、finalization candidate和durable release五lane，为75项目生成唯一最早NEXT与5份源报告SHA-256绑定的memory-only handoff。当前75项均等待blind-review intake，evaluator合同15/15只计技术状态，其余真实计数全0，进度保持47.5%。
- ProfessionalTextPackage 通过：0/15。
- 固定真实回归项目：0/75。
- 真人盲评通过项目：0/45。
- 黄金素材卡人工通过：0/75。
- 片型能力硬门槛失败：15；当前尚未形成可评测的专业输出集合。
- Stage 0 首次机器基线：27.5%；当前进度：47.5%。增量来自15片型内部合同、Stage 6 合同、统一 CI 与8个专业流程产品面；真实模型、真实两轮修订、真人盲评、黄金卡人工通过和专业通过证据仍全部为0。

### 2.2 历史治理与外部交付

- 827 个项目：已通过可逆 manifest 排除出 GEARS signoff portfolio；项目 JSON 未改写、删除数为 0。
- 99 个项目：已完成机器证据分流；79 项进入“备份或测试归类复核”，11 项必须寻找外部备份，9 项进入后缀线索人工核验；安全自动恢复数为 0。
- 9 个项目：只有故事 ID 后缀相似线索，不能据此自动 relink。
- 91 个历史 failed item：全部有测试标记，不计真实 Seedance 交付失败。
- 目标项目：`external_ready=0`、`local_acceptance_ready=5`、待真实外部 artifact 为 5。

## 3. 轨道 A：专业文本开发

### A0. Stage 0 / Iteration 1：全片型能力审计

状态：completed

执行内容：

1. 审计 15 个 `GenreStoryProfile`、StoryBlueprint、生成主链、质量、修复、素材、测试和 UI 支持。
2. 生成机器能力矩阵、Markdown 能力矩阵、专业进度状态和缺口报告。
3. 明确 fixture、simulation、pending review 和 local fallback 的排除规则。
4. 固化当前测试、构建、类型检查、知识库 lint 和审计合同结果。

退出条件：能够逐片型回答缺少的专业文本、质量规则、修复证据、素材和评测样本；不改变现有生成行为。

### A1. Stage 1 / Iteration 2：ProfessionalTextPackage 合同

状态：completed

1. 新增共享类型与 Zod schema。
2. 定义 CreativeBrief、EvidenceDossier、BeatSheet、CoverageReport、RevisionTrace 和 DeliveryTextPackage。
3. 把 15 类必交文本、权重和硬门槛集中扩展到 `GenreStoryProfile`。
4. 增加 schema、片型合同完整性和旧项目兼容测试。

Stage 1 仍不因“结构存在”而声明专业质量通过。

### A2. Stage 2 / Iteration 3：character_story 首个纵向升级

状态：full_lifecycle_contract_ready_external_model_and_signed_human_validation_pending

已完成：

1. 建立 CreativeBrief、EvidenceDossier、BeatSheet、分场、成稿、Coverage、导演文本、交付文本和修订的 opt-in 填充链路。
2. 增加人物目标、阻力、选择、代价、关系变化、可见行动、情绪转折、潜台词和事实边界检查。
3. 建立按硬门槛路由的模型重写/人工证据修复计划，以及分场变化后的派生文本确定性重建。
4. 固定 5 个真实项目规格和 3 个失败 fixture；fixture 已验证触发预期门槛。
5. 所有机器候选分数仍固定 `professional_passed=false`；没有接入或改变现有故事生成主链。
6. 为 5 个固定项目冻结真实知识条目、来源、待核实点和 SHA-256，形成单事件创作合同与事实边界执行包。
7. 固定 benchmark prompt、现有 story prompt、ProfessionalTextPackage 和 Claude Opus 模型版本；任何模型切换都必须形成新基准版本。
8. 新增真实运行证据门槛：拒绝 local fallback、fixture、simulation、来源快照漂移以及缺少 token/成本/初稿/终稿/修订记录的运行。
9. 已找到仓库全文生成桥接脚本、Claude Code 2.1.168 和 Codex CLI；当前固定基准选用 Claude Opus，但未核验账号凭据，也未授权或发起付费调用。
10. 已重建 5/5 实际专业 prompt 和 sealed prepared ledger，并落盘不含 prompt 正文/凭据的受控运行计划；5/5 均保持 blocked。
11. 生产入口只调用固定 strict bridge，不接受任意 adapter/command/extra args；CLI 与 bridge 均冻结 realpath/SHA-256。
12. 运行合同强制独立 operator 执行/付费授权、凭据确认、授权引用、正数批次预算、provider usage/cost 和预算上限；模型输出不能自报专业通过。
   - run ledger v3 冻结 bridge realpath/SHA-256，独立生产入口在启动 CLI 前重算；批次逐项只授权剩余额度。
13. initial run 五类 artifact 与 completion 十二类 artifact 已有分类型 payload、producer、SHA/size/realpath、固定 DAG 和父 hash 合同；provider receipt 绑定完整 bridge envelope、story 与 character evidence，终稿质量快照独立入链；验证结果永远不直接授予专业通过。
14. 盲评阈值已按片型权重实现，但未绑定真实授权基准和真人签署前只表示阈值候选，不计真人盲评通过。
15. benchmark 输出已升级为逐场完整 StoryScene；缺时长、空间、戏剧功能、冲突、对白/旁白、来源、事实依据或虚构边界均 fail-closed，后处理不得猜测补齐。
16. 初稿后协调器只接受真实外部 provenance 与全链哈希一致的初稿，随后生成初始专业文本包、候选评分和定向修订工单；所有信用字段固定为 false。
17. 5/5 机器生命周期计划均为 `awaiting_verified_initial_run` / `blocked`，覆盖 revision output、终稿、终稿质量快照、三角色盲评、包含人审 artifact 的 professional-completion validation、finalization candidate 和 signed release。
18. finalization v2 只接受外部信任策略白名单内的 Ed25519 签名记录并只产生待签署候选；缺少授权 signed release 时永远不能写入专业通过。

待完成：

1. 由独立 operator 提供并核验执行/付费授权、真实凭据、授权引用、批次预算；approved CLI/bridge 技术锚已冻结 5/5，但不代表授权已成立。当前不调用模型、不写生成故事。
2. 对 5 个固定项目运行真实模型，保存初稿、修订稿、模型/提示版本、成本和质量增量。
3. 关闭真实输出中的硬门槛，并完成编剧/剧本编辑、类型/导演、事实/文化三角色盲评。
4. 真实评审完成并生成授权 signed release 前，不声明 `character_story` 专业通过，不增加专业进度。

### A3. 后续顺序

`historical_drama` Iteration 4 内部实现状态：completed_internal_contract；真实模型与真人验收状态：pending_external_evidence。

1. 已建立历史事件压力、三段以上证据因果链、角色立场、决定/后果和逐场史实边界的 opt-in 管线。
2. 已固定武昌起义、南昌起义、西安事变、古田会议、芷江受降 5 个项目规格和 3 个失败 fixture。
3. fixture、机器评分和项目规格均不计专业通过；真实模型项目仍为 0/5，真人盲评仍为 0。
4. `legend_story` Iteration 5 内部合同现已完成：版本边界、神异功能、凡人选择、重复意象和口述节奏均有专属门禁；下一内部片型进入 `children_story`。
5. `children_story` Iteration 6 内部合同现已完成：年龄/语言、温和冲突、尝试因果、情绪学习、儿童安全和亲师提示均有专属门禁；下一内部片型进入 `ai_comic_drama`。
6. `ai_comic_drama` Iteration 7 内部合同现已完成：格级动作、短气泡、反应格、结尾钩子和资产连续性均有专属门禁；剧情故事线 5/5 内部合同完成，下一阶段进入 `culture_promo`。
7. `culture_promo` Stage 3 / Iteration 1 内部合同现已完成；下一内部片型进入 `heritage_promo`。
8. `heritage_promo` Stage 3 / Iteration 2 内部合同现已完成；材料、工具、工序、手部动作、传承压力和授权边界均有专属门禁。
9. `city_brand_promo` Stage 3 / Iteration 3 内部合同现已完成；城市命题、人物视点、空间路线、在地生活、转场逻辑、品牌落点和地理边界均有专属门禁；下一内部片型进入 `social_short`。
10. `social_short` Stage 3 / Iteration 4 内部合同现已完成；60至90秒时长、前三秒事实钩子、持续新信息、竖屏可拍动作、声画字幕分工与互动收束均有专属门禁；宣传传播线 4/4 内部合同完成，下一阶段进入 `documentary_short`。
11. `documentary_short` Stage 4 / Iteration 1 内部合同现已完成；现实现场、观察者、已授权采访、史料来源、证据发现、B-roll、克制旁白和再现边界均有专属门禁；下一内部片型进入 `explainer_video`。
12. `explainer_video` Stage 4 / Iteration 2 内部合同现已完成；核心问题、单段单概念、例子映射、视觉因果、比喻边界、误区纠正、总结和迁移检查均有专属门禁；下一内部片型进入 `lecture_video`。
13. `lecture_video` Stage 4 / Iteration 3 内部合同现已完成；核心立论、证据论证、事实案例、合理反方、回应、修辞转场、机构口径和行动结论均有专属门禁；下一内部片型进入 `education_training`。
14. `education_training` Stage 4 / Iteration 4 内部合同现已完成；学习者画像、可观察目标、知识步骤、完整示范、练习、评估、反馈、复盘和安全制度边界均有专属门禁；非虚构知识线4/4内部合同完成，下一阶段进入 `scene_short`。
15. `scene_short` Stage 5 / Iteration 1 内部合同现已完成；空间身份、连续路线、动作触发、节点发现、时间层、声音线索、镜头行动和转场均有专属门禁；下一内部片型进入 `landscape_mood`。
16. `landscape_mood` Stage 5 / Iteration 2 内部合同现已完成；情绪命题、时间与光线变化、构图停留、自然运动、自然声弧线、极简文案和结尾留白均有专属门禁；15/15 片型内部合同完成，下一阶段进入 Stage 6 Coverage、桌读和多轮修订。
17. Stage 6 / Iteration 1 已建立统一六类 Coverage、桌读意见导入、前后包哈希、逐轮质量增量、问题关闭、派生文本重建和真实 provenance 信用规则；15 个片型各固定 1 个待执行项目，真实两轮修订完成仍为 0。
18. Stage 6 / Iteration 2 已为15项目生成30轮片型化修订焦点、输入输出合同和三角色桌读要求；当前逐项缺真实项目ID、初始包、创作授权、预算与真人排期，因此全部保持 blocked，不调用模型、不写虚假修订记录。
19. Stage 6 P0 已建立 `story-agent-stage6-real-input-intake/v1`、operator JSON 模板、导入验证器和逐项目 readiness；不存在的初始包、SHA-256/包绑定失败、重复真实项目 ID、匿名或未核验评审、未核验授权预算和不完整桌读排期均 fail closed。当前模板重算结果仍为 blocked 15/15、真实修订 0、专业通过 0。
20. Stage 6 P1 已建立显式 `--execute` 批次执行器；执行前重算 P0 readiness，Round 2 绑定 Round 1 不可变 package hash，正文/分场变化后重建派生文本，并保存初稿、submission、桌读、成本、修订包、Coverage、ledger 与 round manifest。临时 simulation 测试只验证状态机且信用固定为 0；当前真实执行仍为 0/30。
21. Stage 6 P2 已建立 `/story/stage6-revisions` 独立产品面；机器候选、prepared、simulation、fixture 和 blocked 具有显式标识，反馈草稿固定不计真人桌读，反馈重开会阻止有效退出候选。Chromium 实测仍显示外部阻断15/15、专业通过0。
22. Stage 6 P3 已建立 `story-agent-stage6-real-revision-exit-audit/v1`；只有两轮真实已核验修订、完整不可变证据链、预算与三角色桌读关闭、派生重建和质量增量全部成立，才产生退出复核候选。当前报告 blocked 15/15、候选0、真实轮次0、专业通过0。
23. P4 已建立逐文件 dirty-worktree 清单、五批确定性归类、SHA-256、基线 blob、重叠风险和 stale-check；当前暂存仍为0，所有已跟踪修改均要求逐 hunk 人工复核。该计划不授权暂存或提交，也不改变 Stage 6 真实修订和专业通过指标。
24. P4 五批首轮实质审查已完成：修复默认外部模型桥接自动发现、共享 plan request 类型漂移和 Stage 6 退出审计哈希失败传播；片型、文档与治理口径检查未发现虚假信用。最终逐 hunk 签署、暂存和提交仍未执行，真实修订与专业通过继续为0。
25. P5 已建立统一 Story Agent CI：本地与 GitHub Actions 共用同一 runner，固定禁用外部故事命令，串联 Web/MCP 测试构建、知识库 lint、P0/P1/P3、专业文本、治理和 worktree 检查。14/14 步本地通过；只计统一 CI 1/1，专业进度 40.8% 升至 41.7%，真实修订、真人评审和专业通过仍为0。
26. P6 已建立 `/story/stage6-intake` operator 工作台：支持 15 项模板、JSON 内容导入、服务端 dry-run 和逐项目 blocker/check 展示，固定不落盘、不执行、不调用模型。它只计第二个专业流程产品面，进度 41.7% 升至 42.5%；浏览器实测仍为 ready 0、blocked 15、专业通过0。
27. P7 已建立 `/story/stage6-preflight` 修订批次预检控制台：动态绑定当前 readiness SHA-256，支持 command JSON 导入和服务端 preflight，但不存在 execute endpoint。模板浏览器实测 blocked、19项命令阻断、artifact写入0、执行0、真实修订信用0；只计第三个产品面，进度 42.5% 升至 43.3%。
28. P8 已建立 `/story/stage6-exit-audit` 只读退出审计工作台：逐项目展示十项退出检查、blocker、Round 0→1→2 哈希链、真实 provenance、成本、开放桌读意见与源证据哈希，只暴露 GET。浏览器实测 blocked 15/15、退出复核候选0、真实修订轮次0、专业通过0；只计第四个产品面，进度 43.3% 升至 44.2%。
29. P9 已建立 `/story/stage6-package-inspector` 初始包检查器：支持15片型 skeleton、JSON原文导入、P0初始包门禁、原文件SHA-256与canonical package SHA-256分离及自报专业通过排除。浏览器实测 skeleton schema合法但包门禁blocked、四类信用标志均为否；只计第五个产品面，进度44.2%升至45%。
30. P10 已建立 `/story/stage6-operations` operator 总控：聚合初始包、P0、P1、桌读版本和P3五条lane，生成不落盘的15项目外部输入交接JSON，逐项目只给一个确定NEXT并保留全部blocker类别与证据路径。浏览器实测五条lane全阻断、外部交接15、P0 ready0、真实轮次0、退出候选0、专业通过0；只计第六个产品面，进度45%升至45.8%。
31. P11 已建立 `/story/stage6-table-read-inspector` 真人桌读证据检查器：复用P1 table-read artifact schema，绑定P0真实项目、轮次、session与三角色实名 reviewer ID，并验证提交时间和Feedback ID。页面只产生签署前预检，不签署、不落盘、不关闭意见；浏览器实测blocked、签名0、真人信用0、专业通过0。只计第七个产品面，进度45.8%升至46.7%。
32. P12 已建立 `/story/stage6-exit-review-signature` 退出复核 Ed25519 签名检查器：信任策略固定从仓库独立读取，attestation 绑定当前 P3 审计哈希、真实项目和三角色批准决定，使用领域分离 canonical payload 验证 signer、key、payload SHA-256、Ed25519 签名和时间。服务只暴露 workspace GET 与内存 validate，不提供 sign/import/persist/execute；空信任模板和15个非退出候选使浏览器实测保持blocked，真实签名0、attestation落盘0、退出记录0、专业通过0。有效、篡改和撤销签名均仅为测试 fixture；只计第八个产品面，进度46.7%升至47.5%。
33. P13 在不宣告 Stage 6 退出的前提下建立 `/story/stage7-golden-card-review` 黄金卡真人审稿接入准备面：30张索引候选逐卡绑定当前源文件 SHA-256 与 canonical card SHA-256，p0/p1/p2 风险分别要求三类实名角色、授权引用、时间、证据和一致决定。页面和 API 只做内存预检，不提供 approve/persist/promote/writeback。浏览器实测候选30/75、片型覆盖3/15、缺60张、待审30、人工通过0；完整三角色测试也只得到 approval preflight，不授予人工通过。进度保持47.5%。
34. P14 已建立 `/story/stage7-golden-card-expansion` 候选补齐准备面：复用12个缺失片型各5个固定项目形成60个 deterministic slot，GenreStoryProfile 继续作为片型字段、事实规则和质量边界单一事实源。候选 JSON 同时绑定 benchmark 文件、项目 payload 和 profile contract 三类 SHA-256，并要求来源确认、授权状态、可见动作及事实/演绎/虚构/未知/禁用断言分层。服务只开放 workspace 与内存 validate，不提供 generate/persist/create-card/promote/writeback。浏览器实测槽位60、已填写候选0、ready0、人工通过0；完整填写测试 fixture 也只表示可交外部人审。进度保持47.5%。
35. P15 已建立 `/story/stage7-golden-card-signature` 黄金卡真人审稿签名检查器：先重验P13三角色approval preflight，再将完整review canonical SHA-256、源文件与卡片SHA-256、风险角色和批准决定写入领域分离attestation payload；信任策略不接受请求自带，Ed25519 signer/key/role、payload digest、签名和时间全部重验。服务只开放workspace与内存validate，不提供sign/approve/persist/promote/writeback。浏览器实测trust preparation_template、Trusted0、签名0/3、人工批准0；有效、篡改和撤销签名均只为fixture。进度保持47.5%。
36. P16 已建立 `/story/stage7-operations` 黄金卡与Domain Pack总控：复用P13–P15和既有Domain Pack候选、证据ledger、签名前预检报告，六份源文件绑定SHA-256；五条lane全部fail closed。生成12项片型候选、30项黄金卡审稿、9项Domain Pack真实证据/审稿共51项唯一NEXT，handoff只在内存展示和复制。浏览器实测黄金卡30/75、覆盖3/15、槽位60、Domain Pack候选9/9、人工通过/晋升0/0；simulation不计真实Domain Pack审稿。进度保持47.5%。
37. P17 已建立 `/story/stage8-blind-review-intake` 专业盲评接入面：冻结15份benchmark文件和75个唯一项目，统一校验真实run ID、终稿文件/SHA-256、授权基准/权利验证、匿名candidate、三类独立实名reviewer和核验排期。静态operator模板与逐项目readiness可stale-check，API只提供workspace GET和内存validate POST，不提供persist/execute/approve/sign/publish/writeback。后续加固拒绝未来提交、过期排期和提交后补写核验。浏览器实测75/75 blocked、三角色ready0、真人盲评通过0/45、专业通过0；准备态不增加专业进度。
38. P18 已把 `professional-benchmark-blind-review/v2` 和decision v2泛化到15片型：决策显式保存video type、中央合同权重快照、阈值与合同SHA-256，权重和固定100。artifact payload与finalization同时升级并拒绝片型、digest或权重漂移；修复权重对象共享引用导致篡改同时污染中央合同的漏洞。页面实测15/15权重合同与唯一hash，score threshold不计真人通过，真实bundle0、真人通过0/45、专业通过0。进度保持47.5%。
39. P19 已建立 `/story/stage8-blind-review-signature` 三角色Ed25519签名检查器：服务端重算P18 decision并绑定review bundle、decision、权重合同hash，信任策略固定从仓库读取，不接受请求注入；三角色reviewer/key、canonical payload、签名和时间全部验证。后续加固完整约束review提交、完成、签名、当前时间、policy建立和reviewer授权的先后关系。API只提供workspace GET与内存validate，不提供sign/credit/persist/finalize/release/writeback。浏览器实测75项目、trust preparation_template、Trusted0/3、23项fail-closed检查；有效、篡改、撤销和时间fixture均不计真实签名或真人通过。进度保持47.5%。
40. P20 已建立 `/story/stage8-finalization-preflight` finalization/signed-release只读预检：复用finalization v2 candidate gate，按75项目展示专业成品、真实修订增量、签名盲评、外部trust、candidate和durable release六条lane；API只提供workspace GET与内存validate，不提供persist/finalize/sign/release/approve/writeback。统一CI强制六类计数为0；浏览器实测六lane全blocked、candidate/release/professional为0/0/0，进度保持47.5%。
41. P21 已建立 `/story/stage8-durable-release-import` 外部durable signed-release record只读导入检查器：仓库侧authority registry不接受请求注入，record绑定candidate decision SHA-256、benchmark/run/video type、12件不可变artifact manifest、authority/key/scope、release ID唯一性、时间和Ed25519。后续加固独立重算终分/正向质量增量，拒绝重复artifact路径，并要求终稿、artifact validation、人审verification三个不同摘要实际进入manifest。create/sign/import/persist/release/approve/writeback端点不存在；空registry使75项目全部blocked，8个测试只使用无效签名，不生成有效签名或release，进度保持47.5%。
42. P22 已建立 `/story/stage8-operations` 专业发布总控：把intake、evaluator、review signatures、finalization candidate和durable release串成五lane，按最早未满足门禁为75项目各生成一个唯一NEXT，并把5份readiness SHA-256绑定进memory-only handoff。当前75项全部等待外部盲评intake；evaluator合同15/15不计真实bundle或真人通过，handoff不落盘、不执行、不导入、不授权任何信用。后续加固已禁止片型/portfolio汇总计数污染逐benchmark状态，增加六阶段顺序回归和CI源文件SHA-256重验；进度保持47.5%。

按交接总纲依次推进剧情故事线、宣传传播线、非虚构与知识线、空间与意境线、Coverage/修订、黄金素材、专业盲评和产品化。每个片型必须同时具备合同、生成、质量、修复、真实样本和评审证据。

## 4. 轨道 B：历史治理与外部交付

### B0. 可逆版本检查点

状态：completed；检查点包含路径分类、文件大小和 SHA-256，不执行 stage 或 commit。

在批量治理前：

1. 重新盘点 modified 和 untracked 文件，按代码、测试、生产卡、蓝图/报告、Stage 0 产物分类。
2. 记录治理队列、项目文件和目标交接包的路径与校验信息。
3. 未经用户明确要求，不执行 `git add`、commit 或 push。

### B1. 827 个历史样本：默认软归档，白名单重建

状态：signoff_exclusion_active；827/827 已通过 manifest 可逆排除，原项目文件保持不变。

执行顺序：

1. 从 `data/reports/story-agent-monitor-remediation-queue-20260710.json` 生成归档 manifest，保存项目 ID、原路径、缺失故事 ID、判定依据和恢复方式。
2. 先从正式 GEARS signoff portfolio 排除，再做小批量 dry-run；不删除、不覆盖项目 JSON。
3. 按题材独特性、文化价值、用户所有权和现实业务需求建立重建白名单。
4. 只有白名单项目按当前 Story Agent 合同重建；重建结果仍需独立质量审计。

退出条件：827 项全部有可追溯处置状态，删除数为 0，未列入白名单的批量重建数为 0。

### B2. 99 个断链项目：准确备份优先，无法证明则重新归类

状态：triaged_waiting_for_evidence；已分流 99/99，已恢复 0，猜测性 relink 0。

执行顺序：

1. 先寻找原始 story JSON、项目版本快照或外部备份；只有 ID、集数、正文/场景和连续性证据一致时才恢复。
2. 9 个后缀相似线索逐项人工比对，禁止自动补链。
3. 对确认属于 acceptance/regression 的项目重新归类为 fixture/test，保留其测试和制作台账。
4. 无准确备份且用途不明的项目进入隔离状态，退出正式签收范围，不猜测改写引用。

退出条件：99 项均被归入“准确恢复、确认测试样本、隔离待证据”之一；猜测性 relink 数为 0。

### B3. 目标项目 5 个真实公共 artifact URL

状态：blocked_by_external_artifacts；真实 URL 0/5。

外部输入到位后执行：

1. 按 `shot-1` 至 `shot-5` 收集真实 GEARS/Seedance 视频 URL。
2. 核验 URL 为稳定、可访问的公共 HTTPS 媒体地址，且镜头映射、媒体类型和时长正确。
3. 使用唯一 `eventId` 先执行 preflight；仅在 `blocking_count=0` 时执行 safe import。
4. 导入后重跑 readiness，核对 `external_ready` 从 0 增至 5、`ready_without_external` 从 5 降至 0。

禁止使用 `.invalid`、`.example`、localhost、私网、本地文件或未经核验的短期占位 URL。真实回片未提供前，项目保持 `needs_action` 是正确状态。

## 5. 综合执行顺序

1. A0、B0、B1 manifest/signoff 排除、B2 机器分流和 A1 已完成。
2. 七个片型内部合同已就绪；外部线等待真实模型与真人评审，内部线继续 `city_brand_promo`。
3. B2 在获得准确故事备份或人工用途确认后继续逐项关闭；不得猜测补链。
4. 外部真实回片到位时执行 B3；该外部阻塞不阻止 A2 及后续专业文本开发。
5. 每次批量治理与每个专业开发 Iteration 分开验证、分开差异审查，避免将行为升级和历史数据迁移混入同一改动。

## 6. 每轮汇报格式

每轮首先报告交接总纲指标：

```text
当前 Stage：
覆盖片型：X / 15
专业文本包通过：X / 15
固定回归项目：X / 75
真人盲评通过项目：X / 45
黄金素材卡人工通过：X / 75
硬门槛失败数：
professional_text_creation_progress：A% -> B%
本轮验证：
下一步：
外部阻塞：
```

随后附加治理轨道指标：

```text
827 项：待处理 / 已软归档 / 白名单重建
99 项：待核验 / 准确恢复 / 测试归类 / 隔离
目标项目：external_ready X / 5；ready_without_external X / 5
猜测性 relink：0
历史项目删除：0
```

## 7. 当前外部阻塞

- 99 项若要恢复，需要准确故事备份或可验证的项目版本证据。
- 目标项目需要 5 个真实公共 artifact URL。
- 专业非劣验证需要真人编剧/剧本编辑、类型/导演、事实/文化三类评审者。
- 需要用户自有、公共领域或已授权的专业结构基准，以及真实模型运行凭据、模型选择与成本记录。
- 本机 strict bridge 和 Claude CLI 技术 hash 锚 5/5 可核验，但模型凭据未核验、独立付费授权/预算未提供；授权真实模型可执行数仍为 0/5。
