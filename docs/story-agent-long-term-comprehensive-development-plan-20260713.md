# Story Agent 长期全面开发计划（2026-07-13）

## 1. 文档定位

本文是 `china-culture-kb` 从当前工程准备态持续发展为可真实创作、可人工审稿、可外部交付、可多人协作和可稳定运营的 `AI影视工作台` 的长期总纲。

它统筹但不替代以下专项文档：

- `docs/story-agent-new-conversation-handoff-20260712.md`：当前代码与 Stage 6–8 交接事实。
- `docs/story-agent-integrated-execution-plan-20260710.md`：专业文本与历史治理并行路线。
- `docs/knowledge-base-content-expansion-long-term-plan-20260713.md`：知识库真实内容供给路线。
- `docs/knowledge-base-long-term-development-blueprint.md`：素材治理和生产化工具链路线。
- `docs/story-agent-p4-dirty-worktree-review-plan-20260712.md`：当前大规模未提交工作区的分批审查方案。

本文只定义长期目标、统一进度、工作流、优先级、里程碑和验收标准。任何准备模板、fixture、simulation、fallback、机器阈值、只读检查器和内存 handoff 都不能替代真实创作、真人评审、真实媒体回片或正式发布。

## 2. 当前基线与总体判断

### 2.1 工程基线

截至 2026-07-13：

```text
分支：codex-ai-comic-series-longform
远端同步提交：568474ab Clarify story quality follow-up backlog
Web Server：82 个测试文件、806 个用例通过
MCP Server：79 个测试文件、345 个用例通过
Story Agent Unified CI：20 / 20
知识库 lint：34 个省份文件、169 条正式条目通过
覆盖 VideoType：15 / 15
专业工作流产品面：8
```

当前工作区不是 clean。它包含大量已跟踪修改和未跟踪文件，必须以 `data/reports/story-agent-p4-change-review-plan.json` 的实时清单为准；不得根据旧文档数字自动暂存、删除、reset、commit 或 push。

### 2.2 真实结果基线

```text
专业文本创作进度：47.5%
专业文本包通过：0 / 15
真实模型完成：0
已核验真实修订轮次：0
黄金素材卡人工通过：0 / 75
真人盲评通过：0 / 45
真实盲评签名：0
finalization candidate ready：0 / 75
durable signed release：0
professional pass：0
真实 GEARS / Seedance 公共 artifact URL：0 / 5
```

### 2.3 产品判断

当前产品已经具备较强的创作合同、质量门禁、项目管理、生产指挥、外部交接和验证基础，但仍主要是“工程准备完成的内部生产平台”。它尚未通过足够的真实模型作品、真人评审、真实外部媒体、多人协作和线上运营证明，不能把局部路线的 99% 解释为产品总体完成。

本文采用以下统一判断：

```text
当前综合研发完成度：68%
当前可商用成熟度：约 35%
```

### 2.4 2026-07-16 最新执行快照

上述 68% 是本长期计划建立时的历史基线；当前统一机器报告与最新交接使用 78%。74% 的基础来自两个直接解除平台化阻塞、且已有完整回归的切片：

- 第二个代码级生产 Domain Pack `original_fiction` 已注册，并贯通领域检索/详情/匹配、规划、StoryBlueprint、本地生成、领域安全、质量、Project/version、受保护修订、GEARS/Seedance 包和真实本地 GEARS workbench HTTP 导入。它不读取中国文化知识库，只接受 `fictional_original`，要求足量用户原创提案并保留权利未核验与来源追踪边界。
- `ProjectRepository` 增加可选择的嵌入式 SQLite provider，具备 schema/version、JSON SHA-256、快照身份、三字段乐观 CAS、事务提交、完整性检查、非覆盖备份和恢复后 logical SHA 等价验证。`node:sqlite` 仅在选择该 provider 时加载，系统配置显式暴露运行时可用性；默认 file provider 不因构建仍兼容 Node 18 而被静态导入提前破坏。

本轮再从 74% 推进到 75%：Domain Pack 合同新增第九项 `story_revision` capability，并要求每个领域提供 `story-domain-revision-guidance/v1` 的写手角色、来源边界和真人复核要求。Project repair prompt 现由对应 Domain Pack 决定，不再硬编码“中国传统文化故事修复写手”；带显式 `domain_safety` 的中国文化与原创 Story 都会在新版本持久化前重新加载本领域来源并重跑安全校验。缺失来源、删除文化约束或删除场景 source trace 都会 fail closed，且不产生新版本。没有显式 `domain_safety` 的 legacy snapshot 暂时保留原兼容路径，后续必须以可审计迁移补齐，不能把兼容视为已通过领域安全。

随后从 75% 推进到 76%：系统新增只读 legacy `domain_safety` 盘点和默认禁写的管理员迁移接口。盘点通过仓储层无恢复、无写入的 current-state inspection 读取 file/SQLite，不会因普通 FileProjectRepository 读操作而触发 pending transaction recovery。apply 必须显式确认 source domain/entry、锁定 current version 与 Story SHA、重新加载本领域来源并通过安全校验，同时开启专用 write gate 和 durable JSONL intent/completion audit；成功时只追加 `domain_safety_migration` 版本，不覆盖旧 snapshot，重放不产生额外版本。真实工作区只读盘点为 22 个 Project：20 个机器可迁移候选、2 个因来源/可信边界阻断，实际 apply 0、历史覆盖 0。

本轮从 76% 推进到 77%：FileProjectRepository 新增完整 meta/version 历史的 canonical logical-state 只读检查，发现 pending transaction 时直接阻断，不恢复、不写回；SQLite provider 新增仅允许空目标库的单事务逻辑导入并复验 Project 数、version 数和 logical SHA。管理员迁移 API 默认 dry-run，要求操作者确认 source logical SHA，真实执行还需专用 write gate、绝对目标路径和 durable intent/completion audit。发布采用同目录候选文件与非覆盖 hard-link，目标数据库和旁车 manifest 任一已存在都不能被覆盖；发布前再次检查源 SHA，完整性一致的相同请求可幂等重放。真实工作区只读 preflight 为 22 个 Project、52 个 version、logical SHA `b4cd2fcf2ad1812026bece49fad75573f1b810f87524ae985f79899f2532343f`，目标文件前后均不存在，apply 0、active provider change 0。

本轮从 77% 推进到 78%：新增单一 `story-storage-root-config/v1` 平台边界，直接导入服务与正常 server 入口现在都解析到仓库 `/data` 和 `/web/generated`，不再因相对层级少一级而落入 `/web/web/generated`。显式路径必须为绝对路径，知识根与生成根必须互不包含；生产启动在同时获得显式 `KB_ROOT`、`WEB_GENERATED_ROOT` 前 fail closed。Project/Story、系列、generated health、workbench audit、GEARS execution 与资源访问等写读服务均委托同一解析器，legacy 路径只在 `/api/system/story-storage-root-config` 的只读审计中出现，不加入 active read/write roots。真实工作区审计显示 active 为 22 Projects / 52 versions / 927 series，legacy 为 26 Projects / 0 versions；没有自动迁移、合并、删除、覆盖或写回。

本轮继续补齐 `story-storage-legacy-disposition-preflight/v1`：管理员只读接口逐目录检查结构、版本声明、来源解析、所有权形态、active Project/Story/元数据指纹碰撞、同来源标题候选和 legacy 元数据等价组；相对、相同、互相包含或不可完整索引的根一律 fail closed，Project/metadata 符号链接不跟随。真实 26 项结果为 22 个空目录、4 个仅元数据目录、0 个完整历史；4 个来源均可解析、所有权有效 0，active ID/Story/元数据指纹碰撞均为 0，但存在 4 个同来源同标题人工比较候选和 1 个四项元数据等价组。26/26 均要求人工处置，preflight 前后 legacy 树快照 SHA-256 同为 `eb0fde08cd88b421559937b8559a4f413eaff068da629eec8b6814a150bab5f4`；自动动作、迁移、合并、删除、覆盖和写回均为 0。由于三个真实端到端样板仍为 0/3，`5.3` 的 78% 上限生效，本轮不提高综合百分比。

本轮继续抽离 Project 层领域硬编码：Domain Pack 合同新增第十项 `knowledge_writeback` capability，每个领域必须返回 `story-domain-knowledge-writeback-plan/v1`。`china_culture` 自有服务只把固定 34 省级名称映射到仓库相对路径 `data/provinces/<省份>.md`；缺失、非规范或路径型省份值一律无目标、无“待确认”fallback。`original_fiction` 明确返回不支持正式知识回写，即使其项目素材中出现“湖南”也不会生成省份目标、正式写回草案或可写回队列项。平台层还拒绝绝对路径、反斜杠和 `.`/`..` 路径段；未注册历史领域被归一为 `domain_pack_not_registered` blocker，不会让统一任务列表抛异常或获得目标。Project 补充任务响应显式携带 Domain Pack、资格和阻断原因。该切片只改变机器合同与 fail-closed 行为，不自动修改任何知识文件，不推进真实样板或真人审稿；三个真实端到端样板仍为 0/3，综合进度继续受 78% 上限约束。

这些切片只完成“第二领域机器生产证明”“本地嵌入式持久化/恢复合同”“领域自有修订与知识写回边界”“legacy 安全迁移机制”“file→SQLite 本地迁移机制”和“storage-root 配置/逐项只读 preflight 边界”。20 个安全候选仍需逐项人工确认后才能执行，file→SQLite 也尚未获准切换真实目标，26 个 legacy-root Project 虽已有机器级来源/版本/所有权/碰撞清单，但仍没有人工保留、迁移或归档结论及处置授权。机器盘点不是来源/文化审稿；SQLite 不是外部生产数据库或对象存储，本地 backup/restore 也不等于真实进程 kill、断电或生产灾难恢复。原创故事、fake JWT/key、本地 GEARS 项目/角色/场景/draft、fixture、无模型测试均不计真实作品、真人审稿、真实 GEARS/Seedance 回片、signed release 或 professional pass。因此当前五套进度为：综合研发 78%、专业文本 47.5%、知识内容 262 条/960 来源且 M2 70/97、真实 GEARS/Seedance 0/5、发布运营 60%；商业成熟度仍估算为 35%。

## 3. 长期北极星

把 `AI影视工作台` 建设为一套以中国文化可信知识为基础、覆盖 15 种片型、贯通专业文本创作到媒体交付和人工验收的生产系统：

```text
可信知识 / 用户素材 / Domain Pack
  -> CreativeBrief
  -> StoryBlueprint
  -> full_text
  -> scene_breakdown
  -> gears_segments
  -> 类型质量报告与定向修复
  -> 项目版本与多人审稿
  -> Production Board
  -> Seedance / GEARS 生产包
  -> 真实外部 artifact 回片
  -> 真人盲评与签署
  -> 发布、复盘和已审稿知识写回
```

长期成功必须同时具备六种能力：

1. 可创作：15 种片型都能交付完整观众稿和专业文本包。
2. 可修订：系统能根据桌读、导演、事实和生产反馈进行可证明的多轮改进。
3. 可分镜：场景、动作、对白、资产、镜头、连续性和时长能进入实际制作。
4. 可交付：GEARS/Seedance 生产包和真实回片闭环稳定、幂等、可追踪。
5. 可追责：事实、传说、改编和虚构边界可核验；人工决定和发布权限有审计证据。
6. 可运营：多角色协作、权限、任务、成本、监控、备份、恢复和发布流程可持续运行。

## 4. 产品范围与边界

### 4.1 本项目负责

- 中国文化知识、来源、Domain Pack、生产素材卡和项目素材包。
- 单片短片、AI 漫剧系列和 15 片型的专业文本创作。
- StoryBlueprint、正文、分场、GEARS 段和质量修复。
- 项目版本、连续性、Production Board、人工审稿和生产 readiness。
- Seedance/GEARS 文本交付包、回片预检、安全导入和状态同步。
- MCP/Agent 接口、运营工作台、治理报告和发布门禁。

### 4.2 外部系统负责

- 真实图片、视频、配音、字幕渲染、混音、片头片尾和最终装配执行。
- 付费模型账户、模型供应商凭据和真实调用计费。
- 独立真人评审者、签署密钥和正式发布权限。
- 对象存储、CDN、消息队列或媒体基础设施的生产实例。

### 4.3 永久禁止

- 不把生成故事直接写入 `data/provinces/*.md`。
- 不把来源说明、质量报告、内部指令写进 `visual_prompt` 或观众稿。
- 不把 fallback、fixture、simulation、prepared、local acceptance 或自报状态计为真实结果。
- 不猜测补链历史项目，不伪造授权、人工签名、媒体 URL 或发布记录。
- 不把所有片型规则分散复制到 UI、prompt、fallback 和测试；`GenreStoryProfile` 保持单一来源。
- 不在未完成审查的 dirty worktree 上继续无边界叠加功能。

## 5. 统一进度模型

### 5.1 综合研发进度

| 维度 | 权重 | 当前完成 | 当前贡献 | 100% 验收条件 |
| --- | ---: | ---: | ---: | --- |
| 核心创作与项目主链 | 20% | 90% | 18% | 单片、系列、版本、修复和导出稳定，15 片型兼容 |
| 专业文本质量与真实证据 | 20% | 47.5% | 9.5% | 75 个真实固定项目完成，至少 45 个真人盲评通过 |
| 知识治理与生产素材工具 | 10% | 80% | 8% | 内容供给专项里程碑达到当期配额，黄金资产完成人审 |
| GEARS/Seedance 生产交付 | 15% | 80% | 12% | 真实 endpoint、artifact、回片、重试、幂等和媒体验收闭环 |
| 产品体验与运营工作流 | 10% | 55% | 5.5% | 五工作区信息架构、角色化任务和项目唯一 NEXT 成立 |
| 平台工程与数据可靠性 | 15% | 60% | 9% | 存储、权限、队列、审计、迁移、并发、备份和恢复成熟 |
| 发布、监控与规模运营 | 10% | 60% | 6% | 部署、SLO、告警、成本、安全、回滚、手册和真实用户验收 |
| **合计** | **100%** |  | **68%** | v1 发布范围全部满足 |

### 5.2 必须并列报告的专项进度

每次推进必须同时报告，禁止用一个百分比覆盖全部事实：

```text
综合研发进度
专业文本创作进度
知识库内容供给进度
真实 GEARS / Seedance 交付进度
发布运营成熟度
```

`knowledge-base-long-term-development-status` 的 99% 只代表素材治理工具路线，不代表内容供给或产品总体完成。知识内容规模使用 `knowledge_base_content_supply_progress`；专业创作使用 `professional_text_creation_progress`。

上表“知识治理与生产素材工具”的 80% 只评价现有治理、候选、审稿和写回工具基础，不评价全国内容规模；真实内容供给必须继续按专项计划单独计算。

### 5.3 进度上限

- 三个真实端到端样板项目未完成前，综合进度最高为 78%。
- 15 片型真实模型样本未覆盖前，综合进度最高为 88%。
- 真人盲评、真实 GEARS 回片和正式发布证据未成立前，综合进度最高为 92%。
- 多人权限、生产存储、备份恢复、监控和发布回滚未通过前，综合进度最高为 96%。
- 只有 v1 Definition of Done 全部通过后，才能声明 100%。

## 6. 八条长期工作流

### 6.1 轨道 A：产品体验与信息架构

目标：从“所有内部页面都放在顶部导航”升级为以创作者和运营人员任务为中心的产品。

主要任务：

- 一级导航收口为：创作、项目、素材、生产、评审；系统设置和实验工具进入二级入口。
- 将 Stage 6–8 的技术编号转译为用户任务，例如“真实输入”“修订与桌读”“素材审稿”“终稿盲评”“发布验收”。
- 在 ProjectDetail 建立统一项目状态机和唯一下一步动作。
- 建立角色视图：创作者、研究编辑、导演/类型评审、文化事实评审、制片运营、管理员。
- 对内部准备工具使用权限或 feature flag，普通创作者不直接面对所有检查器。
- 为单片、系列、项目修订、生产交付、真人评审建立稳定端到端浏览器测试。

验收指标：

- 一级主入口不超过 5 个。
- 新用户能在 5 分钟内开始首个创作项目。
- 项目任一状态只显示一个主 NEXT 和有限次要动作。
- 核心任务成功率不低于 90%，关键路径无控制台/API 错误。

### 6.2 轨道 B：15 片型专业文本与修订引擎

目标：让 15 个 `VideoType` 从结构覆盖升级为真实专业成稿能力。

主要任务：

- 保持 `StoryBlueprint -> full_text -> scene_breakdown -> gears_segments` 主链一致。
- 为每片型维护独立创作合同、质量权重、硬门槛、修复策略和固定 benchmark。
- 模型桥接只允许显式 opt-in，记录 provider、model、prompt hash、输入 hash、输出 hash、成本和耗时。
- 建立两轮真实修订：初稿、桌读/导演反馈、Round 1、Round 2、质量增量和派生数据重建。
- 重点衡量原创性、人物选择、因果、潜台词、场面调度、视听互补、节奏和余味，不只检查字段存在。
- 修订 `full_text` 后必须重建 scene、GEARS、连续性和质量报告，禁止衍生数据过期。

真实验收阶梯：

```text
3 个纵向样板项目
  -> 15 片型各 1 个真实项目
  -> 15 片型各 5 个固定项目，共 75 个
  -> 至少 45 个项目真人盲评达到非劣标准
```

### 6.3 轨道 C：知识库与生产素材供给

目标：从湖南高度集中、169 条正式条目，长期扩展为全国均衡、可创作、可分镜和可追责的内容供给系统。

执行以 `docs/knowledge-base-content-expansion-long-term-plan-20260713.md` 为准：

- M1：每地区至少 2 条，全国 192 条以上。
- M2：每地区至少 5 条，全国 289 条以上。
- M3：每地区至少 10 条，全国 450 条以上。
- M4：每地区至少 20 条，全国约 800 条并包含跨地域资产。

主要任务：

- 来源和 claim 绑定、核实方法、事实/传说/改编/未知分层。
- 补足冲突、选择、动作、后果、场景、道具、声音和禁用表达。
- 建设 15 片型生产素材卡和跨条目复用 Domain Pack。
- 项目反馈先进入候选和人工审稿，只有可复用、来源清楚的内容进入正式写回。
- 建立固定检索查询，验证扩充内容确实提高召回和下游创作质量。

### 6.4 轨道 D：Production Board 与资产连续性

目标：让文本成果能够稳定进入镜头、资产和媒体制作，而不是只输出一段提示词。

主要任务：

- 统一角色、场景、服饰、道具、声音和参考资产 ID。
- 建立角色外观、动作、空间、时间和关键道具连续性检查。
- Seedance prompt 对 8 秒以上视频使用明确时间段；每个 `@` 引用都必须分配角色。
- 分离 `script_text`、`visual_prompt`、`camera_suggestion`、`segment_prompt_hint` 和 `validation_notes`。
- 对不可拍、过载、镜头冲突、资产缺失和文化边界不清的段落自动阻断或生成修复任务。
- 将镜头级反馈回流到项目版本和修订计划，但不直接写入知识底库。

### 6.5 轨道 E：GEARS/Seedance 真实外部交付

目标：从合同、样例和本地验收升级为真实媒体生产闭环。

主要任务：

- 严格拆分 GEARS 导演 workbench 与异步 execution worker：workbench 使用独立 `GEARS_WORKBENCH_*`；execution worker 优先使用 `GEARS_EXECUTION_WORKER_API_BASE_URL/TOKEN`，旧 `GEARS_API_BASE_URL/TOKEN` 仅作迁移期 legacy alias。
- execution worker 必须先通过 `gears-execution-worker-capabilities/v1` 握手，明确自身不是 workbench、支持幂等 submit/status/callback、声明精确 endpoint 与 job type；配置 URL、workbench capability 或 404 smoke 均不得记 ready。
- 配置真实 execution worker endpoint、callback base、secret 和 Seedance/provider adapter；workbench capability、项目/资产导入和 Recipe 不得替代 `/gears/jobs` readiness。
- 使用公共可达、已授权且非占位的 artifact URL。
- 固定 `payload -> preflight -> safe import -> readiness` 路径。
- 校验幂等 event、job 类型、项目绑定、artifact 类型、URL 可达性和来源身份。
- 建立失败重试、超时恢复、死信、人工接管、审计和成本记录。
- 验证 Production Board、Shot Ledger、Job Ledger 和 readiness 在导入后同步更新。
- 增加媒体技术检查：时长、编码、分辨率、音轨、字幕、黑帧、静帧和文件完整性。

首批验收：

- 3 个样板项目全部获得真实外部 artifact。
- 5 个目标项目 `external_ready=5/5`、`ready_without_external=0/5`。
- 重复 callback 不重复计入结果，错误 callback fail closed。

### 6.6 轨道 F：真人审稿、签署与发布治理

目标：把 Stage 6–8 的准备工具转化为真实、可审计的人工作业。

主要任务：

- 明确三类核心评审：编剧/剧本编辑、类型导演/制片、事实/文化评审。
- Stage 6 完成真实输入、两轮修订、桌读证据和退出复核。
- Stage 7 完成黄金素材卡来源、授权、类型和文化审稿。
- Stage 8 完成匿名盲评、三角色签名、finalization candidate 和独立 release authority。
- reviewer/key/trust policy 必须来自受控外部配置，不接受请求自报身份或权限。
- 准备状态、验签逻辑通过和机器分数不能授予人工通过或 professional pass。

### 6.7 轨道 G：平台架构、数据与安全

目标：从本地文件型工程升级为可多人协作、可迁移和可恢复的平台。

主要任务：

- 按领域拆分超大型 `project-service.ts`、共享 types 和 schemas，保持兼容层。
- 建立 `ProjectRepository`、`ArtifactStore`、`ReviewRepository`、`JobRepository` 等存储接口。
- 第一阶段保留文件 provider；第二阶段引入 SQLite/PostgreSQL 和对象存储。
- 建立 schema version、migration、乐观锁、幂等键和事务边界。
- 增加登录、组织、项目角色、RBAC、资源所有权和审计日志。
- 对模型执行、外部回调、文件上传、签名导入和正式写回实施最小权限。
- 建立异步任务队列、重试、取消、超时、死信和可恢复执行。
- 完成备份、恢复、灾难演练、数据保留和隐私删除政策。

### 6.8 轨道 H：质量、CI、可观测性与发布运营

目标：让功能可持续发布，而不是靠单次手动验证维持。

主要任务：

- 保持 Unified CI，按风险加入共享 schema、迁移、契约、浏览器 E2E 和负载测试。
- 建立每次发布的 smoke suite：单片、系列、修订、生产、回片、评审、发布。
- 记录请求链路、模型调用、任务状态、回调、人工决定、成本和错误分类。
- 建立健康检查、SLO、告警、运行手册和回滚策略。
- 建立 preview/staging/production 环境和配置校验，生产密钥不进入仓库。
- 发布候选必须通过权限、安全、备份恢复、兼容迁移和真实用户验收。

## 7. 长期路线图

### Phase 0：工作区与进度基线收口（0–2 周）

目标进度：68% -> 72%。

任务：

- 运行 P4 inventory stale check，重新确认全部文件级变化。
- 按五批逐 hunk 审查：共享合同与核心、15 片型专业管线、Stage 6、生产卡与文档、治理与 MCP。
- 每批单独测试、单独审查、单独形成可回滚提交；只有得到明确授权才暂存、commit 或 push。
- 建立统一产品进度状态文件，区分综合研发、专业创作、内容供给、真实交付和发布运营。
- 清理旧文档中会被误读为产品总体完成度的 99% 表述，但保留专项历史口径。
- 冻结继续新增 Stage/P 编号准备工具，除非它直接解除真实生产阻塞。

退出条件：

- 工作树 clean 或剩余变化均有明确 owner/hold 原因。
- Unified CI 20/20、Web/MCP 全量测试、构建和 lint 通过。
- 所有百分比均能追溯到机器报告和真实证据。

### Phase 1：产品信息架构与三项目准备（第 1–2 个月）

目标进度：72% -> 78%。

任务：

- 完成五工作区导航和角色化任务模型。
- 为每个项目建立统一状态机、唯一 NEXT 和阻塞原因。
- 选择三个真实样板：AI 漫剧、微纪录片、非遗/文化宣传片。
- 冻结样板 CreativeBrief、来源边界、预算、模型、评审人、交付目标和验收表。
- 建立真实模型与外部执行的显式授权、成本上限和凭据前置检查。
- 补齐三条样板路径的 Playwright E2E。

退出条件：

- 普通创作者不需要理解 Stage 6–8 编号也能完成任务。
- 三个样板项目的真实输入、预算、模型和评审角色准备完成。
- 未满足真实前置条件时系统明确 fail closed。

### Phase 2：三个真实端到端样板（第 2–3 个月）

目标进度：78% -> 85%。

每个项目必须完成：

```text
真实输入与授权
  -> 真实模型初稿
  -> 真人桌读/导演/事实反馈
  -> Round 1
  -> Round 2
  -> 质量增量证明
  -> Production Board
  -> GEARS/Seedance 真实 artifact
  -> 安全回片导入
  -> 真人盲评与复盘
```

退出条件：

- 3/3 项目完成真实两轮修订和真实外部 artifact。
- 3/3 项目有成本、耗时、版本、质量增量和失败恢复记录。
- 至少 2/3 达到预设真人质量门槛；未通过项目形成可执行根因报告。
- 不因个别项目失败而篡改阈值或把准备态计为通过。

### Phase 3：15 片型真实覆盖与黄金资产（第 3–6 个月）

目标进度：85% -> 90%。

任务：

- 15 片型各完成至少 1 个真实模型项目。
- 从真实失败模式调整 profile、质量器、修复器和生产素材模板。
- 30 张现有黄金卡完成真人审稿；补齐 12 个缺失片型的首批真实候选。
- 9 个候选 Domain Pack 完成来源、授权、人审、签署和正式晋升。
- 将固定评测从本地 fixture 升级为真实项目版本与人工评价。

退出条件：

- 15/15 片型有真实成稿、修订和评审记录。
- 专业文本包通过不再是 0/15。
- 黄金素材卡人工通过至少 30 张。
- 真实失败样本进入回归，但不泄露私人评审或模型凭据。

### Phase 4：全国内容供给与 75 项 benchmark（第 6–12 个月）

目标进度：90% -> 93%。

任务：

- 知识库按内容扩充专项完成 M1、M2，并向 M3 推进。
- 15 片型各扩展至 5 个固定真实项目，共 75 个。
- 至少 45 个项目完成三类真人盲评并达到非劣门槛。
- 75 张黄金素材卡完成人工批准或形成明确淘汰/修复结论。
- 建立跨模型、跨题材、跨地域、跨时长的质量稳定性报告。

退出条件：

- 真实固定项目 75/75。
- 真人盲评通过至少 45/75。
- 黄金素材卡人工结果 75/75，不允许长期停留在 pending。
- 全国内容供给进度独立可测，不借用治理工具 99%。

### Phase 5：平台化与多人协作（第 6–12 个月，并行）

目标进度：93% -> 96%。

任务：

- 完成核心领域服务拆分和持久化接口。
- 引入生产数据库、对象存储和任务队列。
- 完成组织、账号、项目成员、RBAC 和审计日志。
- 建立冲突检测、并发安全、版本迁移、备份恢复和灾难演练。
- 建立 staging 环境和生产配置前置检查。

退出条件：

- 两名以上用户可以安全协作同一项目。
- 关键写操作具备权限、事务/幂等和审计记录。
- 数据库迁移可前滚和回滚；备份恢复演练通过。
- 大项目和批量 callback 压力测试满足当期 SLO。

### Phase 6：发布候选与真实运营（第 9–12 个月）

目标进度：96% -> 100%。

任务：

- 固化单片、系列、Production Board、GEARS 回片、人工评审五条操作手册。
- 准备不少于 5 个可演示、可复盘的真实项目。
- 完成安全检查、负载测试、故障注入、监控告警和回滚演练。
- 建立用户反馈、模型成本、任务耗时、质量通过率和事故复盘机制。
- 形成 v1 release notes、已知边界、升级路径和支持策略。

退出条件见第 10 节 Definition of Done。

### Phase 7：规模化内容与生态（12–24 个月）

此阶段不继续使用 v1 的 100% 百分比，而建立新的年度目标：

- 全国 M3/M4 内容供给。
- 片型、模型和媒体供应商插件化。
- 团队模板、机构知识包和审稿策略配置。
- 多语言字幕、国际传播改写和区域文化顾问网络。
- 基于真实项目反馈的质量模型、推荐和成本优化。
- 在保留人工责任的前提下提高批量运营效率。

## 8. 近期 90 天执行计划

### 第 1–2 周

- 完成 P4 五批审查和可回滚提交。
- 建立统一进度报告，冻结误导性单一 99%。
- 确认三个真实样板项目和外部依赖清单。

### 第 3–4 周

- 收口五工作区导航。
- 建立项目状态机和唯一 NEXT。
- 完成三个样板项目的输入、预算、模型、评审和交付 preflight。

### 第 2 个月

- 执行第一个 AI 漫剧真实样板。
- 完成两轮修订、真人反馈和首个真实 GEARS/Seedance 回片。
- 根据失败根因修复产品，不增加新的准备层编号。

### 第 3 个月

- 完成微纪录片和非遗/文化宣传片样板。
- 汇总三项目质量、成本、耗时、交付和用户体验报告。
- 决定进入 15 片型规模验证前必须修复的 P0/P1 问题。

## 9. 指标与仪表盘

### 9.1 创作质量

- `first_usable_draft_rate`
- `professional_package_pass_rate`
- `verified_revision_improvement_rate`
- `human_blind_review_pass_rate`
- `hard_gate_failure_by_video_type`
- `scene_and_gears_staleness_rate`

### 9.2 产品体验

- 首个可用初稿耗时。
- 从项目进入到完成下一步的成功率。
- 人工修订完成时间和阻塞停留时间。
- 核心任务放弃率和错误恢复率。

### 9.3 生产交付

- `external_ready / target_projects`
- callback preflight 通过率。
- safe import 成功率和重复事件拦截率。
- artifact 技术验收通过率。
- 平均重试次数、人工接管率和交付时长。

### 9.4 知识供给

- 地域配额、题材覆盖、来源等级和 claim 绑定率。
- 15 片型生产字段 readiness。
- 黄金卡人工批准率和 Domain Pack 复用次数。
- 固定检索查询召回率和下游质量提升。

### 9.5 平台运营

- 可用性、P95 API 延迟、任务成功率和错误预算。
- 模型调用成本、单项目媒体成本和异常消费。
- 备份成功率、恢复时间和审计覆盖率。
- 安全事件、权限拒绝和密钥轮换状态。

## 10. v1 Definition of Done

只有以下全部满足，综合研发进度才能从 96% 升到 100%：

- 15/15 片型各有真实模型项目和真实修订证据。
- 75/75 固定真实项目完成，至少 45/75 真人盲评通过。
- 75 张黄金素材卡均有真实人工结论，批准项完成受控写回或晋升。
- 三个纵向样板和五个目标项目完成真实 GEARS/Seedance artifact 闭环。
- 单片、系列、修订、Production Board、回片、评审和发布关键 E2E 全部通过。
- 五工作区信息架构和角色化权限完成真实用户验收。
- 生产数据库、对象存储、任务队列、RBAC、审计、备份恢复和迁移通过。
- staging/production 配置、监控、告警、SLO、运行手册和回滚演练完成。
- 不存在把 fixture、simulation、fallback、readiness 或机器阈值误计为真实通过的路径。
- 发布范围、已知限制、数据政策、支持方式和升级方案全部有文档。

## 11. 外部依赖与阻塞处理

当前必须由用户或外部组织提供：

- 明确授权的真实模型、凭据、预算和成本上限。
- 三个样板项目的真实业务目标、素材、版权和人物/场地授权。
- 编剧/剧本编辑、类型导演/制片、事实/文化三类真人评审。
- 真实 GEARS/Seedance endpoint、callback 配置和公共 artifact URL。
- 正式 reviewer trust policy、签署密钥管理和 release authority。
- 99 个断链项目若继续恢复所需的准确备份或用途确认。

阻塞规则：

- 缺外部材料时可以继续 P4 收口、产品导航、架构拆分、测试和文档，但不得继续增加只证明 readiness 的检查器。
- 不能用自动生成内容代替真人意见、授权、签名或真实媒体。
- 同一阻塞连续存在时，报告阻塞和解除条件，不通过更改口径制造进度。

## 12. 每轮开发工作法

每轮只选择一个最小可交付切片：

1. 读取本总纲、最新交接、专项计划和相关代码。
2. 检查 `git status`，识别用户已有改动和当前批次边界。
3. 说明本轮目标、当前百分比和预期增量。
4. 实现最小范围变化，类型规则集中在 profile/contract。
5. 运行最小相关测试，再运行受影响的构建、CI 或浏览器 smoke。
6. 更新机器报告和文档，真实证据与准备证据分开。
7. 汇报变更、验证、进度、下一步和阻塞。
8. 只有用户明确要求时才暂存、commit 和 push。

禁止以新增文件数量、页面数量、接口数量或测试数量直接增加进度。进度只因用户价值和验收门槛达成而增加。

## 13. 每次推进汇报格式

```text
当前阶段：Phase X - 阶段名称
本轮目标：
本轮完成：

综合研发进度：A% -> B%
专业文本创作进度：C% -> D%
知识库内容供给进度：E% -> F%
真实 GEARS / Seedance 交付：X / Y
发布运营成熟度：G% -> H%

真实指标：
- 专业文本包通过：X / 15
- 真实模型项目：X / 75
- 已核验真实修订轮次：X
- 黄金素材卡人工通过：X / 75
- 真人盲评通过：X / 45
- external_ready：X / 5
- professional pass：X

本轮验证：
工作区状态：
下一步：
外部阻塞：
```

## 14. 新对话启动指令

在新的开发对话中使用以下首条指令：

> 阅读并严格遵循 `docs/story-agent-long-term-comprehensive-development-plan-20260713.md`，同时阅读 `docs/story-agent-new-conversation-handoff-20260712.md`、`docs/story-agent-p4-dirty-worktree-review-plan-20260712.md`、`docs/story-agent-integrated-execution-plan-20260710.md` 和 `docs/knowledge-base-content-expansion-long-term-plan-20260713.md`。
>
> 当前综合研发基线为 68%，专业文本创作机器口径为 47.5%。fixture、simulation、fallback、prepared、readiness、机器阈值、测试验签和内存 handoff 均不计真实修订、真人审核、真实回片、signed release 或 professional pass。
>
> 首先检查当前分支、`git status`、P4 change review plan 是否 stale，并复核 Unified CI。保留用户现有 dirty worktree，不 reset、不删除、不覆盖、不自动暂存、不 commit、不 push。第一阶段优先完成 P4 五批审查、统一进度口径和三个真实样板项目准备；不要继续新增 Stage/P 编号的准备工具，除非它直接解除真实生产阻塞。
>
> 每次推进必须汇报综合研发、专业文本、知识内容供给、真实 GEARS/Seedance 交付和发布运营五套进度，并给出测试证据、工作区状态、下一步和外部阻塞。持续推进到当前权限和真实外部条件允许的最大程度。

## 15. 新对话第一轮验收

新对话第一轮不应直接改动大量代码，应先完成：

- 当前分支、HEAD、远端同步和 dirty worktree 数量核对。
- `node scripts/story-agent-p4-change-review-plan.mjs --check`。
- `git diff --check` 和暂存状态核对。
- Unified CI 基线复核；若沙箱阻止 Supertest 监听，明确环境原因并在授权环境复跑。
- 核对本总纲引用的五份状态/计划文档仍存在且没有更新版本。
- 给出 Phase 0 第一批“共享合同与核心”的具体文件清单、风险、验证命令和预计进度变化。

完成以上内容后，再开始第一个最小开发切片。

## 16. 2026-07-17 领域中性修订与补素材持久化边界检查点

本轮把 `project-service` 中修订、补素材和候选稿的剩余中国文化领域假设进一步下沉到 Domain Pack。两个生产领域均升级到 1.3.0，并在既有 `story_revision`、`knowledge_writeback` 之外声明第十一项 `story_supplement` capability。`story-domain-supplement-guidance/v1` 由领域包决定候选稿类型、标题、复核规则及是否允许生成正式知识写回草案：`china_culture` 只生成待真人文化/来源复核的领域知识候选，`original_fiction` 只生成项目内素材候选且不得导出正式知识写回稿。

平台新增 `story-domain-edit-persistence/v1`：修订只允许追加 Project version；补素材只允许更新当前 Project 状态并同步 generated story snapshot。两种操作都固定 `domain_source_write_allowed=false`、`knowledge_writeback_performed=false`、`external_delivery_triggered=false`、`migration_action_performed=false`、`real_credit_granted=false`，Project service 在持久化前 fail closed 校验。该合同没有修改正式 `data/provinces` 文件，没有执行 20 个 `domain_safety` candidate、legacy disposition、file→SQLite 迁移/切换或真实 GEARS/Seedance 调用。

验证证据：定向 7 files / 293 tests；Story server 全量 129 files passed + 1 skipped、1089 tests passed + 2 skipped；隔离 SQLite、fake JWT/keys、无模型跨仓 HTTP E2E 2/2；GEARS `make check` 为 mypy 76 files、后端 291、前端 17、production build、Ruff format 96 files 全通过；Unified CI 21/21 全绿。所有本地准备证据继续排除于真实计分。

三个真实端到端样板仍为 0/3，故综合研发保持 78%；专业文本保持 47.5%；知识内容保持 262 条正式条目、长期 960 来源目标且 M2 70/97；真实 GEARS/Seedance 严格保持 0/5；发布运营保持 60%，商业成熟度保持 35%。下一内部切片继续审计 production auto-draft 等剩余领域文案；下一真实增量仍必须来自已授权真实模型、真人复核和稳定公共 artifact。
