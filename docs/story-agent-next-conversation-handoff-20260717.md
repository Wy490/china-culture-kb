# Story Agent 下一对话交接（2026-07-18）

## 1. 快速启动与按需读取

新对话默认只完整读取：

1. 本文件。
2. `superpowers-lite`。
3. 当前切片实际涉及的 `china-culture-story-agent`、`gears-seedance-delivery` 或 `agent-dev-standards`；不涉及的 skill 不加载正文或 reference。

以下长期文档仍是规范来源，但不再要求启动时全文加载。先用标题/关键词定位，只读取当前切片相关段落：

| 当前任务 | 按需读取 |
| --- | --- |
| 改进度、真实计分、发布定义 | `story-agent-long-term-comprehensive-development-plan-20260713.md` 的当前基线、计分边界和 DoD |
| P4 归属、dirty worktree 冲突 | `story-agent-p4-change-review-plan.json` summary 与当前文件项；只有规则争议才读 P4 Markdown 对应最新小节 |
| GEARS、迁移、legacy、knowledge writeback | `story-agent-integrated-execution-plan-20260710.md` 对应 B3–B6 小节 |
| 知识内容扩充 | `knowledge-base-content-expansion-long-term-plan-20260713.md` 当前 milestone 与对应 batch plan |
| 历史决策冲突或证据缺失 | `story-agent-next-conversation-handoff-20260716.md` 的相关小节，不全文回放 |

启动上下文由原 6 份文档 3,077 行、约 334 KB，降为本交接约 190 行加必要 skill；默认减少约 85%。若状态与叙述冲突，以当前 Git 事实、P4 机器报告和新鲜测试为准；不得通过 reset、覆盖或删除来“恢复”交接状态。

## 2. 两个仓库固定边界

### Story Agent

- 路径：`/Users/wuyu/Desktop/china-culture-kb`
- 分支：`codex/story-agent-manifest-integrity-20260718`
- 分支基线：`2280c71cd99fcbd86530137e800fd07840c60907`；最终 HEAD 以当前 `git rev-parse HEAD` 为准。
- 用户已在 2026-07-18 明确授权将 Story Agent 当前仓库全部改动提交并推送到新分支；该授权不扩展到相邻 GEARS v2 仓库。
- 本轮提交前 dirty worktree 属于连续开发成果，未通过 reset、删除或覆盖改变既有改动；提交后应以新鲜 `git status` 验证工作区干净。

### GEARS v2

- 路径：`/Users/wuyu/Desktop/gears v2`
- 分支：`codex/story-agent-workbench-bridge`
- 固定 HEAD：`1d772200a809ca282a73535126359949d054164b`
- `origin` 应为私有 fork `https://github.com/Wy490/gears-v2`；`upstream` 为原仓库。
- 目标 PR base 必须为 `v0.2-dev`。
- 最终 Git 状态：6 tracked / 5 untracked，staged 0；`git diff --check` 通过。
- 保留 dirty worktree；禁止自动暂存、commit、push。

## 3. 真实计分边界

- 本地项目/角色/场景、fixture、fake JWT/key、无模型测试、dry-run、readiness、SQLite 导入、候选稿和本地 E2E 均不计真实回片。
- 真实 GEARS/Seedance 仍为 `0/5`；三个真实端到端样板仍为 `0/3`。
- `external_ready=0/5`，真实公共 artifact URL 为 0。
- 专业文本包通过 0/15，真实模型项目 0/75，已核验真实修订轮次 0，真人盲评通过 0/45，professional pass 0。
- 不执行 20 个 `domain_safety` candidate，不执行 legacy 搬运/合并/删除/覆盖，不执行或切换 file→SQLite，不执行正式 knowledge writeback，除非获得独立明确授权。

## 4. 2026-07-18 最新完成切片

### 最终交付 manifest 完整性

- 对 `web/generated/ai-comic-series-projects` 的 927 个系列项目进行只读审计；用户指出的 10 个 `concat.txt` 无 `manifest.json` 项目全部复现，且全部为 2026-06-19 的历史 dry-run/测试夹具。
- 10 个项目均有 `seedance_final_delivery.output_path`/concat 计划、`dry_run=true`，但没有 `manifest_path`；它们不是“真实成片仅漏文件”，不得补造 manifest 或授予发布信用。
- Web generated health、MCP generated health 与监控脚本已从旧的 `output_path OR manifest_path` 改为 `output_path AND manifest_path`；新增 `final_delivery_manifest` 缺口、dry-run/manifest 证据与独立 summary。
- MCP production readiness 的 Delivery Contract 同步 fail closed：只有可用 ledger 同时声明输出与 manifest 才为 ready；concat/output 计划无 manifest 明确显示“尚不可发布”。
- 项目总览“生成项目体检”新增“缺最终 manifest”指标；GEARS worker 证据审计新增 manifest 缺口 delta，历史基线只作兼容说明，新增缺口才触发回归动作。
- 新机器证据：`data/reports/story-agent-monitor-remediation-queue-20260718.json`，精确列出 10 个项目 ID、dry-run 状态和安全修复动作；报告声明未修改 generated project、未 relink、未 archive、未正式写回。
- 监控扫描结果：22 个 story JSON、927 个系列项目、10 个 manifest 缺口；10/10 均为 dry-run。真实 GEARS/Seedance 回片与真实发布信用仍为 0。
- 新增 `review_final_delivery_manifest_gaps` 治理动作，Web/MCP generated governance plan 均把这 10 个目标放入独立 operator queue，并在健康列表中优先展示 manifest 缺口。
- 每个 queue item 固定为 `awaiting_operator_decision`，只允许 `preserve_fixture_exclude_from_publishable_delivery` 或 `reexport_after_authorized_dependencies` 两种 disposition；自动执行关闭、runner 为 operator。
- 若选择重导出，queue 明确要求授权媒体输入、cut/subtitle/audio/title-card 依赖与项目作用域输出路径三项 preflight；当前 `expected_file_changes=[]`，`publishable_delivery_credit_granted=false`。
- `dry_run=true` 只生成内存 manifest；`dry_run=false` 在 Web/MCP 两侧均明确 blocked，仍不修改 `web/generated`。前端 generated 治理 dry-run 默认包含该动作，并提供中文标签“复核最终 manifest 缺口”。
- 实盘本地 API 复核：plan 精确 `10`，run 精确 `selected=10/planned=10`；10/10 无预期写入、需要人工复核、等待 disposition、发布信用为 false。
- operator queue 的声明性检查现已接成逐项目只读 preflight：Web `POST /api/system/story-agent-final-delivery-manifest-preflight` 与 MCP `kb_preflight_story_agent_final_delivery_manifest` 返回同一 v1 结果语义；queue item 同时给出可直接使用的 `preflight_api.request_template`。
- 输入必须包含单个 `series_project_id` 与明确 disposition；缺少 disposition 在 Web schema 层返回 400，未知项目和非 manifest-gap 项目返回结构化 blocked。项目 ID 不能逃逸系列目录。
- 保留夹具分支只验证目标与 manifest gap，返回 operator signoff exclusion 建议；它不授权媒体执行，也不产生 publishable-delivery 信用。
- 重导出分支不信任历史 `dependency_status` 布尔值，逐项验证显式 operator 媒体授权、placeholder URL/font token、cut/subtitle/audio/title-card ledger 的 ready/non-dry-run 状态、缺失镜头/音频/渲染数量、声明路径和当前磁盘文件。
- 所有依赖、最终输出和预期 manifest 路径必须位于 `web/generated` 且包含精确系列项目目录段；绝对路径、URL、目录逃逸和跨项目路径均 fail closed。
- Web/MCP 正向夹具证明只有授权、四类依赖、真实文件和项目作用域路径同时齐备时才返回“可另行申请 GEARS 重导出”；即使 ready 仍固定 `publishable_delivery_credit_granted=false`、`generated_files_modified=false`、`final_assemble_invoked=false`。
- 10 个真实缺口项目只读扫描：保留夹具 10/10 可进入人工排除；重导出 0/10 eligible、10/10 blocked。五类失败均为授权输入、cut、字幕、音频、片头卡；路径作用域 10/10 合规，但真实依赖不齐。
- 新机器证据：`data/reports/story-agent-final-delivery-manifest-preflight-20260718.json`；扫描和本地 API 冒烟后 `web/generated` 仍无 Git 脏变更，没有调用 final assemble、没有写 manifest/project.json。
- Projects 页 generated governance dry-run 现直接显示“最终交付 manifest 人工预检”面板：列出 10 个 queue target、默认 preserve、授权声明默认 false 且在 preserve 分支禁用。
- 操作员可切换项目和 disposition、运行现有只读 Web preflight，并查看每项 check、evidence、missing/unsafe path、中文建议动作，以及发布信用/generated 写入/final assemble/manifest 写入/project.json 写入五个安全字段。
- blocked 显示为“预检阻断”；preserve ready 显示为“保留排除建议可复核”；re-export ready 只能显示“前置条件齐备（仍需另行授权）”。页面不使用“已可发布”成功短语，也不保存 operator disposition。
- 项目、disposition 或授权勾选变化都会清空旧结果；请求失败保留 queue 并显示“未授予任何处置资格”。并发切换后的旧响应与目标/disposition 错配响应均 fail closed，不会回填新项目。
- 真实浏览器视觉复核确认 10 个选项、默认值、标签与 preserve 结果布局；唯一 console error 为既有 `/favicon.ico` 404。重新只读抽查 10 项仍为 re-export blocked 10、eligible 0、写入/合成/信用 0。
- 每个成功的结构化 preflight 结果现可由操作员显式加入“当前会话人工处置审阅包”；按 `series_project_id + disposition` 去重，ready 与 blocked 均保留完整 checks/evidence/missing/unsafe 证据。
- 审阅包仅存在 Vue 页面内存，可显式清空，刷新页面即丢失；请求失败时无可加入结果。导出 JSON/Markdown 只使用浏览器 Blob，不请求后端、不写服务器状态。
- 草案固定 `draft_only=true`、`operator_signature_present=false`、`operator_disposition_persisted=false`、`server_state_modified=false`，且发布信用、generated 写入、final assemble、manifest 写入、project.json 写入和真实 GEARS/Seedance 信用全为 false。页面不提供 approve/execute 按钮，签署与执行必须在系统外独立完成。
- 10 个真实缺口项目的 re-export 结果已通过运行中 Web API 在内存中组装为只读样例包：10 个唯一键、blocked 10、ready 0，五类依赖检查均为 10 个失败，项目路径失败 0，五个结果安全字段 10/10 全 false；样例 JSON 约 64 KB，未落盘到仓库。
- Web 与 MCP generated health 现同时返回 `story-agent-generation-activity/v1`，分开统计新故事成功落盘、Project version 修订、报告活动、pending transaction 与旧错误存储根。两端保持独立实现，真实工作区的语义字段逐项一致。
- 最新成功新故事仍为 `20260711-story-awnh09b5551f` / `2026-07-11T03:49:30.655Z`；`2026-07-17T18:54:57.750Z` 有一次 `quality_repair` Project version，因此 7 月 11 日后不是“只有报告活动”，但也没有新故事成功落盘。
- 实盘精确为 22 stories / 22 Projects / 53 versions / 33 reports，最新故事后 1 次 Project 修订、30 份报告；pending transaction 0，旧错误根 4 Projects / 0 stories，没有 storage-root 切换证据。
- Web canonical `POST /api/stories/generate` 现已接入 durable generation-attempt audit：领域生成前先写 `started`，领域结果失败写 `failed`，只有成功结果对应的 `succeeded` 也落盘后才向调用方报告成功。
- ledger 位于 canonical generated root 下的 `system/story-generation-attempts.jsonl`，默认单文件上限 1 MiB、最多 4 个轮转归档；同进程并发写入串行化，每次请求使用随机 UUID，孤立 `started` 会作为仍在运行或进程中断证据保留。
- 每条事件只包含 schema、attempt ID、时间、固定入口、领域、片型、状态和失败时的稳定枚举错误码；不记录 prompt、用户文本、素材、模型输出、stack、绝对路径或原始异常消息。
- `started` 写入失败会在生成前 fail closed；成功终态写入失败不会误报成功；若原生成已经失败，则终态账本写入失败不会吞掉原领域返回或原异常。
- Web/MCP activity v1 均读取 current + bounded archives：可区分最近成功后无更新请求、最近失败和只有 `started` 的未完成尝试；账本存在非法行时整体 fail closed，不基于残缺历史授予结论。
- attempt ledger 现同时具备进程内队列与跨进程独占锁；锁文件使用原子 `wx` 创建、随机 owner、owner 匹配释放，默认等待 5 秒、10ms 重试、30 秒后才允许恢复有效陈旧锁。独立 4 进程各写 40 个 attempt 的压力测试在轮转下完整保留 160 attempts / 320 events。
- 每次 append 在持锁期间先验证 current 与全部归档；畸形 JSONL、超出保留策略的数字归档、活动/非法锁、symlink system 目录或不安全目标都会在领域生成前 fail closed。成功终态时间保证不早于 started，释放阶段也不会删除其他 owner 的锁。
- 新增只读 `story-generation-attempt-audit-readiness/v1`：Web/MCP 独立实现并保持语义一致，报告初始化状态、current bytes、archive count、lock status、history integrity、阻断原因与隐私安全字段。未初始化是真实工作区合法状态，不创建空目录或空账本，`ready_for_next_attempt=true` 只表示下一次 canonical 请求具备落账前提，不代表已有历史。
- activity 结论进一步 fail closed：只有历史完整且不存在 active/invalid lock 时，才允许 `durable_generation_attempt_history_available=true`；超额归档即使主文件可读也不得确认“未发起”或“链路失败”。
- 现有真实工作区在本次实现后仍没有任何正式 Web 生成请求，所以 ledger attempt 为 0，诊断继续兼容为 `attempt_history_unavailable`：`no_generation_request_confirmed=false`、`generation_pipeline_failure_confirmed=false`，不会追溯猜测 7 月 11 日后的历史请求状态。
- Projects 页“生成项目体检”已直接显示最新故事、后续修订/报告、pending transaction、不可观测边界和写入/模型调用 false。旧根更新或 pending transaction 均只会显示阻断提示，不合并、不恢复、不切换。
- Projects 页还会显示最近 attempt 的状态/领域/片型，以及账本可用、未发起确认、失败确认和未完成尝试四个信号；不存在账本时仍显示旧兼容提示。
- Projects 页、Web generated-health Markdown 与 MCP generated-health Markdown 现同步展示 readiness、完整性、锁、bytes、archives、blockers 与“下次请求就绪”；不显示绝对路径、原始 I/O 错误或账本内容。
- readiness 新增固定枚举 `operator_actions`，覆盖目录/权限、ledger/archive target、retention overflow、invalid history、active/expired/invalid lock；active lock 只建议等待后复查，expired lock 只说明下次 canonical append 可恢复，其他异常均要求备份后人工复核。
- `automatic_repair_allowed=false` 与 `destructive_action_performed=false` 是 Web/MCP 固定合同；系统不提供自动 unlink、truncate、rotate、chmod 或修复入口。健康 Markdown 同步 operator action 与两个安全字段。
- Projects 页新增账本诊断 JSON/Markdown 下载；快照只在浏览器内存组装，固定 `browser_memory_only=true`、`server_state_modified=false`、`automatic_repair_invoked=false`、`destructive_action_invoked=false`，不调用后端写接口。浏览器测试读取下载内容并确认无 `/Users/` 绝对路径。
- readiness 现明确回传 `configured_lock_timeout_ms / retry_ms / stale_ms`；Web、MCP、health Markdown、Projects 页面和两种下载快照均显示同一生产策略。默认值为 `5000 / 10 / 30000`，Web/MCP 环境覆盖回归共同验证 `4200 / 17 / 61000`。
- 非法环境值不会进入输出：两端均回退安全默认值，返回稳定枚举 `configuration_warnings` 与 `configuration_valid=false`，测试使用的敏感非法字符串不会回显。当前实盘配置为 `configuration_valid=true / warnings=[]`。
- 新增主 ledger symlink 与 archive symlink 回归：即使外部目标包含语法有效的 attempt event，canonical 生成也在领域调用前阻断，外部文件保持字节不变，主 ledger 不创建；这锁定了已有 `lstat`/history fail-closed 行为。
- attempt audit 存储新增 `owner_only` 权限策略：system 目录、ledger、archives 与 lock 不能向 group/other 开放。readiness 回传 `permission_policy` 与 `permission_policy_satisfied`，Web/MCP health、Projects 页面和下载快照同步显示。
- `0755` system 目录、`0644` ledger、`0644` archive 均在领域生成前 fail closed，并分别返回稳定 blocker/action；权限异常不会重复误报为 JSON 历史损坏。append/read 路径也执行同一权限检查，不能绕过 readiness 直接写入。
- attempt event append 已从 `appendFile` 收紧为 `O_NOFOLLOW` 文件句柄：打开后再验证 regular file，写入后必须 `FileHandle.sync()` 成功，最后才释放锁并承认事件。symlink 检查到打开之间的窗口由 no-follow 进一步封闭。
- 新增窄范围测试依赖注入，仅服务层单测可替换 file sync，不进入 Web schema、route 或 MCP 参数。started sync 失败时领域生成调用 0；succeeded sync 失败时即使领域函数返回成功也不向调用方报告成功，原始 I/O 内容不回显。
- 本机目录句柄 `sync` 能力已先独立验证；事件文件 sync 后进一步同步 owner-only `system` 目录，因此首次 ledger 创建与 rotation rename 也进入成功边界。started directory-sync 失败时领域生成调用 0；terminal directory-sync 失败时成功响应 0。
- readiness/health/UI/下载快照同步 `event_file_sync_required=true / no_follow_open_required=true / directory_entry_sync_guaranteed=true`。该保证基于当前已验证平台；跨文件系统/平台部署仍须在上线前运行同类 smoke，不把本地测试替代生产断电演练。
- 实盘 Web/MCP 独立直读结果逐字段一致：`uninitialized / config_valid=true / permission_policy=owner_only / permission_policy_satisfied=true / lock=absent / history=unavailable / ready=true / attempts=0`，仍未初始化或写入空账本。
- 新机器证据：`data/reports/story-agent-generation-activity-20260718.json` 已更新为 `owner_only_audit_storage_ready_awaiting_first_attempt`。本切片未发模型请求，未修改 `web/generated`，未接旧 MCP 写入工具，未授予真实生成或发布信用。
- 新机器证据：`data/reports/story-agent-generation-activity-20260718.json` 已进一步更新为 `file_and_directory_sync_hardened_awaiting_first_attempt`。本切片仍未发模型请求、未初始化真实账本、未修改 `web/generated`，未授予真实生成或发布信用。

完成 `project-service` 修订/补素材边界的领域泛化、production auto-draft 领域默认抽离，以及 production readiness 和三类生产资料模板的跨域收口：

- Domain Pack 版本 1.4.5，capability 总数 12；新增 `story_supplement` 与 `production_material_draft`。
- `story-domain-supplement-guidance/v1` 由领域包声明候选稿类型、标题、复核规则和正式写回草案适用性。
- `china_culture` 生成待真人复核的领域知识候选；`original_fiction` 只生成项目内素材候选，正式知识候选导出 fail closed。
- 新平台合同 `story-domain-edit-persistence/v1`：修订只追加 Project version；补素材只更新当前 Project 状态和 generated story snapshot。
- 所有编辑固定 Domain source 禁写、knowledge writeback 未执行、external delivery 未触发、migration 未执行、real credit 为零。
- 质量修订和补素材均在持久化前校验；不再在通用 prompt 中硬编码 `data/provinces`。
- 新增 `story-domain-production-material-guidance/v1`：受众/学习者、项目与素材、来源/事实、单镜头/提示词、家长提示、知识层级、边界卡、社媒分享/字幕/评论及误区边界的默认文案和审查边界均由领域包返回。
- `original_fiction` 不再继承中国文化的“文化入门/史学工艺民俗”、非遗名录、文化讲述者、馆方/出版物、传承人/馆员、馆藏真伪、省份 Markdown、“文化边界真实/稳定”、“文化符号”、“冷知识/地方经验”、“传说/正式入库”或来源内部字段假设。
- production auto-draft 不再向用户输出 `material_pack verified_facts`、`source_entry=`、`credibility_note=` 等内部字段名；原创域改用项目素材、创作确认和权利复核语义，中国文化域保留事实与来源核验语义。
- production readiness 同步识别创作者、编剧、角色设计与权利顾问，原创域补齐讲述角色后不再继续误报缺失。
- production readiness 现按 `sourceDomain` 合并集中式字段覆盖：原创儿童故事识别“故事标志物/关键物件”，社媒短视频识别“人物选择/剧情讨论、项目素材、权利边界卡”，AI 漫剧识别“原创设定/架空/世界规则”；用户可见标签与补充问题同步改为原创语义。
- `world_and_truth_mode` 不再把通用“待核实”当成世界观/真实度证据，只有真实度、虚构、传说、史实等明确语义才计入。
- 儿童故事、社媒短视频、AI 漫剧的 canonical production pack 主动目标、gate 和问题已改为跨域表达；`china_culture` 仍通过领域证据保持事实/来源核验，`original_fiction` 不再被默认文化事实字段误判。
- P4 分类器现将 `data/production-packs/` 确定性归入 `production_docs`，避免 canonical production pack 变化落入人工 hold。
- `ProductionMaterialSampleEntry` 新增可选 `applicable_source_domains`；production pack service 按当前领域返回样例，历史无标签样例按旧中国文化来源处理，对新领域 fail closed。
- 儿童、社媒、AI 漫剧分别新增 3 个 `original_fiction` 中立样例；原 3/3/10 个中国文化样例均显式标注 `china_culture`，原创 prompt 和新生成项目不再收到周敦颐、柳毅、屈原、书院、年画等跨域样例。
- `original_fiction` 本地生成现挂载领域过滤后的 production pack 和 readiness；AI 漫剧集成测试证明项目只持久化原创样例。
- canonical `source_observations` 已显式标注适用领域；draft 工具和 Markdown 同时展示来源、样例的领域适用性。AI 漫剧 draft 已按真实内容变化重生成：目标改为“故事材料”，样例为 `china_culture=10`、`original_fiction=3`。
- P4 分类器同时将 `production-material-pack-service.ts` 确定性归入 `shared_core`，本轮无人工 hold。
- production pack health 新增 `sample_entry_count_by_source_domain`、`minimum_sample_entry_count_by_source_domain` 和 `legacy_sample_entry_count`；三类跨域片型均要求 `china_culture>=2`、`original_fiction>=2`。
- 新 issue `underfilled_domain_sample_entries` 会把领域样例缺口降为 warning，并携带 `source_domain`；legacy 无标签样例只计入 `china_culture`，不会满足原创域最低覆盖。
- Web 与 MCP health JSON/Markdown 均输出同一领域覆盖摘要；Web GEARS evidence Markdown 同步展示 `domain_samples` 与 `legacy_samples`，MVP production material lane 现在提供 `domain_sample_ready=3/3`。
- canonical 三类 pack 在 Web 与 MCP 两侧均为领域覆盖健康，当前无领域样例 issue；旧 MCP fixture 因原创覆盖为 0 曾正确转为 warning，补齐显式领域 fixture 后恢复 passed。
- canonical pack 文件新增 `health_policy.required_domain_sample_video_types` 与 `domain_sample_minimums`，Web/MCP 两侧原 `DOMAIN_SAMPLE_MINIMUMS` 常量已删除；策略缺失、非法阈值、声明/映射不一致或引用未加载 pack 均产生 error 并 fail closed，health schema 仍为 `production-material-pack-health/v1`。
- health 报告新增 `domain_sample_policy_valid` 与 `domain_sample_policy_video_types`，MVP/GEARS evidence 同步展示；三类跨域片型仍为 `china_culture>=2`、`original_fiction>=2`，真实计分不变。
- 重复 `sample_id` 不再抬高样例总门禁或领域覆盖：报告保留原始 `sample_entry_count`，新增 `unique_sample_entry_count`、`duplicate_sample_entry_ids`，重复 ID 产生 `duplicate_sample_entry` error；领域过滤后的 pack 也只返回唯一样例。
- production pack draft 新增可选 `sourceDomain` / `--source-domain`：来源观察和样例按域过滤，legacy 无标签内容只归 `china_culture`；报告输出目标域、排除来源/样例数、重复来源/样例数和非法来源数，域专属 CLI 文件名不会覆盖通用草案。
- draft 审稿就绪现按唯一 `source_id` 计数，重复或空白来源不能抬高状态；候选 `sample_entries` 也按唯一 `sample_id` 去重。canonical、附加 observations、pack/template/sample 均有字段级运行时校验，畸形 JSON 不再泄露 `.find/.map/join` 内部错误。AI 漫剧通用候选报告已重生成，4 个唯一来源、五类审计计数均为 0。
- 新增两端共同消费的 `production-material-pack-health-conformance/v1` JSON matrix：16 个策略/样例用例覆盖缺失/非对象、非空且唯一的声明数组、声明与最低值映射一致、非空领域、正整数、已加载 pack 引用、未知成片类型与重复 `sample_id`；测试值与 canonical 业务阈值分离，未把 `2/2` 重新硬编码进实现。
- 同一 matrix 锁定 15 个受支持 `VideoType`：Web 对照 `VIDEO_TYPE_CONFIG`，MCP 对照显式支持集合并逐型运行合法策略；Web/MCP 仍保持独立运行时，不形成 Web→MCP 依赖。
- 两端现同时拒绝 `required_domain_sample_video_types` 中的空白元素；MCP 同时补齐未知 `video_type` fail-closed，未知同名 pack 不再使非法策略通过。health schema 保持 `production-material-pack-health/v1`，canonical pack 健康与真实计分均未改变。
- 共享 matrix 进一步新增 31 个 pack 结构用例，覆盖 `video_type/label/goal/material_template/sample_entries`、所有 template string-array 字段，以及 sample `sample_id/entry_name/applicable_source_domains` 的缺失、类型、空白、空数组和重复领域标签边界。
- Web 注入式 `productionMaterialPacks` 现与 canonical loader 使用同一运行时过滤器；畸形注入不再进入 health summary、触发 `.trim()` 异常或抬高 `pack_count`。MCP 文件 loader 同步要求非空 `goal`、字段级 sample 结构与非空 template 内容。
- 显式 `applicable_source_domains` 只有非空、非空白且唯一时才被接受；畸形领域标签不会再静默退化为 legacy `china_culture`。历史无标签 sample 的 legacy 归属保持不变。
- 31 个 structure cases 现在逐项声明稳定、双边一致的拒绝预期：`pack_index`、原因码与精确字段路径；Web/MCP 运行时都复用同一顺序生成首个失败诊断，但保持各自独立实现。
- health v1 additive 新增 `rejected_pack_count` 与 `rejected_pack_diagnostics`；畸形 pack 产生 `invalid_pack_structure` error 并令 health fail closed，同时仍不进入 `pack_count`、policy 引用或样例健康统计。canonical 当前为 `0 / []`，既有 schema version 与真实计分均未改变。
- 诊断只回显索引、枚举原因码和结构路径，不复制 label、goal、模板、样例或任意输入值；MCP health Markdown、Web GEARS evidence Markdown 以及 Web/MCP MVP evidence 均已同步该摘要。
- 共享 matrix 再新增 7 个 pack 文件根合同用例：有效根、root 非对象、`schema_version` 缺失/非字符串/不支持，以及 `packs` 缺失/非数组；两端逐项锁定同一根级有效性、原因码和路径。
- health v1 additive 新增 `pack_file_valid` 与 `pack_file_diagnostics`；根合同失败产生 `invalid_pack_file_structure` error，并在解析 pack、health policy 或满足 required video type 前 fail closed。canonical 当前为 `true / []`。
- Web canonical loader 不再伪造正确 schema，MCP pack health 改为保留原始 JSON 根值；文件缺失或 JSON 无法解析统一给出无 payload 的 `source_unavailable`。MCP/Web GEARS Markdown 与 Web/MCP MVP evidence 已同步 `pack_file_valid`，敏感 schema 测试值不会进入报告。
- 共享 matrix 新增 collection case，证明两个结构合法、同 `video_type` 的 pack 不得同时进入健康统计。Web/MCP 现在都保留首个已接受 pack，以 `pack_index=1 / duplicate_video_type / packs[1].video_type` 拒绝后项。
- 重复类型产生独立 `duplicate_pack_video_type` error，不再由 `packsByType` 静默以后项覆盖首项；后项不能抬高 `pack_count`、policy 引用、sample coverage、readiness 或 summary。MVP evidence 新增 `duplicate_pack_video_type_count`，Markdown 不回显重复 pack 的 label/goal/sample。
- MCP draft 回归证明存在重复类型时仍只使用首项 label、goal、template 和 sample，敏感后项不进入草案；因此 Web runtime、Web/MCP health 与 draft 的同型 pack 选择规则现统一为 first accepted wins。canonical 当前重复拒绝数为 0，真实计分不变。
- MCP draft 测试现在直接读取共享 health conformance fixture 的 2 个 root 与 8 个 pack/sample 代表 case，不复制整套 matrix；unsupported schema、缺失 `packs`、空白 label/goal/template item、缺失 sample ID/name，以及空/空白/重复领域标签均 fail closed。
- draft 独立 parser 现要求精确 `video-type-material-supplement-packs/v1`、必填 `packs` 数组、非空字符串与数组项、必填 sample identity，以及显式领域标签非空/非空白/唯一。错误消息精确固定为字段路径与规则，不拼接输入 payload；draft v1 schema 与 Web/MCP 独立运行时均未改变。
- draft 源文件获取现只在 `fs.readFile` 与 `JSON.parse` 两个窄边界转换异常：缺失/不可读统一为 `production pack file is unavailable`，非法 JSON 统一为 `production pack file must contain valid JSON`；绝对路径、ENOENT、原生解析位置和文件内容均不回显。
- schema、根对象、pack/template/sample 等解析后字段校验仍保留原精确错误，未被获取异常边界吞掉；health v1、draft v1、canonical 文件内容、Web/MCP 独立运行时和真实计分均未改变。
- 新增 MCP 本地单一合同 `production-material-video-types.ts`，15 类合法 `VideoType` 只维护一份；health 保留 `PRODUCTION_HEALTH_SUPPORTED_VIDEO_TYPES` 原导出兼容，draft 不依赖 Web，也不再复制名单。
- draft 入口现以 `videoType must be a supported video type` 拒绝未知目标类型，pack parser 以精确字段路径拒绝未知 `packs[i].video_type`；两类错误均不回显未知值或 pack label/goal/sample。共享 conformance 的 15 类合法值逐型证明请求与现有 pack 上下文仍可生成草案。
- 新增 `production-material-source-observations.ts`，MCP `sourceObservations` 字符串和 CLI `--observations-json` 文件现在共用窄范围解析/读取边界；MCP 非法 JSON 固定为 `sourceObservations must contain valid JSON`，CLI 缺失/不可读和非法 JSON 分别固定为 `observations file is unavailable` 与 `observations file must contain valid JSON`。
- parser/loader 不回显输入、目标文件路径、ENOENT、SyntaxError 或解析位置；CLI 最外层只输出单行 message，不再附带内部栈绝对路径，未知非 Error payload 统一为 `production material pack draft failed`。解析成功后的非数组和 observation 字段错误仍由 draft 精确校验。
- canonical AI 漫剧原创域只读回归仍为 `ready_for_editor_review`、4 个来源、3 个样例和 label `AI漫剧`，未写文件、未授予真实信用。

主要新增文件：

- `web/server/src/services/final-delivery-manifest-preflight-service.ts`
- `web/server/src/services/story-generation-activity-service.ts`
- `web/server/src/services/story-generation-attempt-audit-service.ts`
- `mcp-server/src/tools/preflight-final-delivery-manifest.ts`
- `mcp-server/src/lib/story-generation-activity.ts`
- `data/reports/story-agent-final-delivery-manifest-preflight-20260718.json`
- `data/reports/story-agent-generation-activity-20260718.json`
- `web/e2e/manifest-preflight.spec.ts`
- `web/server/src/platform/story-domain-edit-boundary.ts`
- `web/server/src/platform/story-domain-production-material-guidance.ts`
- `web/server/src/__tests__/story-domain-edit-boundary.test.ts`
- `web/server/src/__tests__/story-generation-attempt-audit-service.test.ts`
- `web/server/src/__tests__/story-generation-activity-service.test.ts`
- `mcp-server/src/lib/story-generation-activity.test.ts`

主要修改文件：

- `web/server/src/platform/domain-pack.ts`
- `web/server/src/platform/story-domain-revision-safety.ts`
- `web/server/src/domains/china-culture/domain-pack.ts`
- `web/server/src/domains/original-fiction/domain-pack.ts`
- `web/server/src/services/project-service.ts`
- `web/server/src/services/production-material-readiness-service.ts`
- `web/server/src/services/production-material-pack-service.ts`
- `web/server/src/services/gears-execution-service.ts`
- `web/server/src/services/story-agent-mvp-status-service.ts`
- `web/server/src/domains/china-culture/story-generation-preparation-service.ts`
- `web/server/src/domains/original-fiction/domain-pack.ts`
- `web/shared/types.ts`
- `mcp-server/src/tools/draft-production-material-pack.ts`
- `mcp-server/src/lib/production-material-video-types.ts`
- `mcp-server/src/lib/production-material-source-observations.ts`
- `mcp-server/src/tools/production-health-reports.ts`
- `mcp-server/src/tools/get-story-agent-mvp-status.ts`
- `data/production-packs/video-type-material-supplement-packs.json`
- `data/production-packs/production-material-pack-health-conformance.json`
- `data/reports/production-material-pack-draft-ai_comic_drama.json`
- `docs/production-material-pack-draft-ai_comic_drama.md`
- `scripts/story-agent-p4-change-review-plan.mjs`
- 相关 registry、Project service、API 和两个领域测试。

## 5. 本轮测试证据

- 测试先行红灯：缺少新平台文件/capability、硬编码候选稿和合同断言共 7 项失败；实现后转绿。
- 本次 auto-draft 红灯：未填写受众的 `original_fiction` 项目仍输出“零基础文化入门观众”；Domain Pack guidance 接线后转绿。
- 后续红灯依次复现原创项目继承非遗名录/文化讲述者、馆方/省份 Markdown、馆员/传承人/馆藏真伪；实现后全部转绿。
- readiness 联动红灯：原创讲述角色已生成但只识别馆员/专家/传承人的关键词；增加领域中立角色证据后转绿。
- 本次剩余 auto-draft 红灯：`original_fiction` 的 `shot_prompt_layers` 仍继承“文化边界真实”，`parent_teacher_note` 仍继承“文化符号”；新增领域对照断言并下沉到 Domain Pack 后转绿。
- 本次后续红灯分三批复现：原创单镜头仍写“文化边界稳定”；知识层级/事实卡/来源线索仍继承文化事实语境并泄露内部字段；儿童与社媒草拟仍写“故事改写与事实边界”“冷知识/地方经验”“重要事实旁标”“版本、地点或实物线索”“传说/正式入库”。全部下沉到 1.4.5 guidance 后转绿。
- readiness 新切片红灯依次复现：原创儿童“故事标志物”、原创社媒“人物选择/项目素材/权利边界卡”、原创 AI 漫剧“原创设定/世界规则”均无法满足对应字段；按 `sourceDomain` 合并集中式字段覆盖后转绿。
- 反向红灯证明通用“待核实”会误满足 `world_and_truth_mode`；收窄特殊匹配后转绿。跨域 production pack 对照测试随后复现儿童模板仍含中国文化默认，三类 canonical 主动模板泛化后转绿。
- 样例领域红灯复现：`getProductionMaterialPack(..., { sourceDomain: 'original_fiction' })` 仍返回全部中国文化样例，原创 AI 漫剧生成结果没有 production pack/readiness；领域元数据、过滤和原创生成接线后转绿。
- draft 红灯复现两层丢失：来源适用领域未进入 Markdown，已有样例也未显示适用领域；补齐 draft schema/render 后转绿，并重生成 AI 漫剧 Markdown/JSON。
- 领域 health 红灯复现：Web/MCP summary 均没有领域计数，2 条 legacy/原创混合 fixture 无法发现原创覆盖不足；新增领域摘要与最低覆盖 issue 后两侧转绿。
- MCP MVP fixture 随后从 passed 正确变为 warning，暴露三类片型 `original_fiction=0/2`；fixture 补齐显式领域样例后恢复 passed，并新增 canonical Web/MCP 阈值一致性断言。
- 本次定向：`project-service` + Domain Pack registry，2 files / 74 tests 通过；Story server TypeScript 与 `git diff --check` 通过。
- 扩展定向：Project service、Domain Pack registry 与 production readiness，3 files / 83 tests 通过。
- 本次最新定向：Domain Pack registry 14、Project service 60、production material readiness 9，合计 3 files / 83 tests 通过；`npm --prefix web/server run lint` 与 `git diff --check` 通过。P4 `--write` 后 `--check` 通过：128 files、0 hold、0 staged。
- 本轮最终定向：Domain Pack registry 14、Project service 60、production material readiness 9、original fiction domain 3，合计 4 files / 86 tests 通过；Story server TypeScript 通过。
- 定向回归：7 files / 293 tests。
- Story server TypeScript：通过。
- Story server 全量：129 files passed + 1 skipped；1089 tests passed + 2 skipped。
- 跨仓 HTTP E2E：隔离 SQLite + Alembic、fake JWT/keys、无模型 2/2；正式 Recipe/provider/media/credit 均为 0。
- GEARS `make check`：mypy 76 source files；backend 291；frontend 17；production build；Ruff 96 files，全通过。
- Unified CI local：21/21；Track A Playwright 6/6；MCP 79 files / 355 tests；KB lint 34 files / 262 entries；Stage 6–8、治理、diff、P4 stale、no-stage 全通过。
- `superpowers-lite`：官方 `quick_validate.py` 通过；`agents/openai.yaml` 解析、触发 prompt 和关键工作流断言通过；正文 80 行、无 TODO。
- 本次 readiness 定向：Project service、production readiness、China-culture preparation、story prompt、original fiction domain，5 files / 93 tests 通过；MCP production material draft 2 tests 通过；Story server TypeScript 通过。
- 本次样例领域定向：Story prompt、original fiction、production readiness、China-culture preparation、Domain Pack registry，5 files / 49 tests 通过；MCP draft 2 tests 通过；Web TypeScript 与 MCP build 通过。
- 本次领域 health 定向：Web production readiness 16 tests；Web API/health/GEARS 3 files / 246 tests；MCP health/MVP 2 files / 14 tests；Web TypeScript 与 MCP build 通过。
- 本轮最新 Unified CI：21/21；Web server 129 files passed + 1 skipped、1098 tests passed + 2 skipped；Track A 6/6；MCP 79 files / 359 tests；Web/MCP build、KB lint 262 entries、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过；明确未授予 real revision 或 professional pass。
- 本次 canonical policy 红灯覆盖缺失、非正整数、引用未加载 pack 及 Web/MCP 正常解析；production readiness 19 tests、MCP health/MVP 16 tests 与两侧 TypeScript 转绿。
- 本次 draft 红灯覆盖原创域跨域泄漏、重复/空白 source ID、重复 sample ID、非数组/畸形 observation、非数组 packs 与非法 sample 领域标签；draft 9 tests 与 MCP TypeScript 转绿。
- 本次重复样例红灯证明同一 `sample_id` 可把原创域从 1 抬成 2；Web/MCP 改为唯一 ID 计数后恢复 `original_fiction=1/2` 并产生明确 error。
- 上一切片 Unified CI：21/21；Web 129 files + 1 skipped / 1101 tests + 2 skipped、Track A 6/6、MCP 79 files / 377 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 本次共享契约第一组红灯证明 Web/MCP 均会把 `['children_story', '   ']` 清洗为合法声明；补齐空白元素 fail-closed 后 Web 20 tests 转绿，MCP 继续暴露第二组红灯：同名 `experimental_story` pack 可让未知类型策略通过。MCP 支持集合与未知类型校验接线后两侧 matrix 全绿。
- 上一切片 Unified CI：21/21；Web 129 files + 1 skipped / 1102 tests + 2 skipped、Track A 6/6、MCP 79 files / 379 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 当前 P4：145 files（106 tracked / 39 untracked），`shared_core=77`、`governance=37`、`production_docs=31`，0 hold、0 staged。
- 本次 pack 结构红灯分别复现：Web 注入路径把缺失 `video_type` 的 pack 计入 `pack_count=1`；MCP 文件 loader 接受空白 `label`，后续还会接受缺失 `goal` 与畸形 sample。统一过滤和非空规则后，Web 定向 21 tests、MCP 定向 14 tests 全绿。
- 上一切片 Unified CI：21/21；Web 129 files + 1 skipped / 1103 tests + 2 skipped、Track A 6/6、MCP 79 files / 381 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 本次拒绝诊断红灯证明 Web/MCP 对无效 structure case 只会静默过滤，报告没有拒绝数量、原因或路径；实现后 31 个用例逐项得到相同的紧凑诊断，canonical 保持 `rejected_pack_count=0`。Web readiness 21、MCP health 14、Web API 205、MCP MVP 4 均通过，Web/MCP TypeScript、构建与 Markdown 证据断言通过。
- 上一切片 Unified CI：21/21；Web 129 files + 1 skipped / 1103 tests + 2 skipped、Track A 6/6、MCP 79 files / 381 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 本次根合同红灯证明 Web/MCP 报告的 `pack_file_valid` 均不存在，旧 loader 会丢失根失败原因；7 个共同 cases 接线后，Web readiness 22、MCP health 15、MCP MVP 4、Web API health/MVP/GEARS evidence 定向均通过，两侧 TypeScript 与无 payload Markdown 断言通过。
- 上一切片 Unified CI：21/21；Web 129 files + 1 skipped / 1104 tests + 2 skipped、Track A 6/6、MCP 79 files / 383 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 本次 collection 红灯证明 Web/MCP 对两个合法同型 pack 都返回 `pack_count=2`，且 report map 以后项覆盖、runtime/draft `.find` 取首项；首项保留/后项拒绝接线后，Web health 23、MCP health + draft 26、MCP MVP 4、Web MVP API 定向与两侧 TypeScript 全通过。
- 上一切片 Unified CI：21/21；Web 129 files + 1 skipped / 1105 tests + 2 skipped、Track A 6/6、MCP 79 files / 387 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 本次 draft 代表集首先 9/9 红灯，证明 unsupported schema、缺失 packs、空白内容和非法 sample 领域均会继续生成并进入 Markdown；收紧后共享代表集 10 tests、完整 draft 20 tests、MCP build 与 canonical AI 漫剧只读草案全通过，错误完整消息精确相等且不含敏感测试值。
- 本次第一次 Unified 的未改动 Web callback 单测发生一次 5 秒瞬时超时，导致 secret 未及清理并级联 12 个 401；该单测随即 13ms 通过，完整 callback describe 16/16 通过，未修改无关代码。相同代码重跑 Unified 全绿。
- 上一切片最终 Unified CI：21/21；Web 129 files + 1 skipped / 1105 tests + 2 skipped、Track A 6/6、MCP 79 files / 407 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 本次源文件获取红灯精确复现：缺文件返回带绝对 KB_ROOT 的 ENOENT，非法 JSON 返回原生 `Unexpected end of JSON input`；窄边界转换后两条脱敏测试 2/2、完整 draft 22/22、MCP build 与 canonical AI 漫剧原创域只读草案均通过，且共享 schema/pack 代表校验继续返回原精确错误。
- 上一切片最终 Unified CI 一次通过：21/21；Web 129 files + 1 skipped / 1105 tests + 2 skipped、Track A 6/6、MCP 79 files / 411 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 本次支持类型合同红灯分别证明未知请求 `experimental_story_sensitive` 会生成草案、未知 pack `experimental_story` 会通过 parser；抽取单一 MCP 合同后，两类 fail-closed 测试与 15 类逐型合法回归共 25 tests、完整 draft 39 tests、draft + health 55 tests、MCP build 和 canonical AI 漫剧原创域只读草案均通过。
- 上一切片最终 Unified CI 一次通过：21/21；Web 129 files + 1 skipped / 1105 tests + 2 skipped、Track A 6/6、MCP 79 files / 445 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 本次额外来源输入红灯精确复现：MCP/CLI 非法 JSON 返回 `Unexpected end of JSON input`，CLI 缺文件同时泄露 ENOENT、绝对目标路径和 `path` 字段。转换后 helper + draft 44 tests、MCP build、canonical 草案、真实 MCP stdio 和两类真实 CLI 冒烟均通过；CLI 两个失败路径最终都只有单行固定消息，解析成功后的 `{}` 仍返回 `additionalObservations must be an array`。
- 当前最终 Unified CI：21/21；Web 129 files + 1 skipped / 1105 tests + 2 skipped、Track A 6/6、MCP 81 files / 455 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 本次 manifest 完整性切片先用 Web/MCP/production-readiness 三组红灯复现 `output_path OR manifest_path` 误判，修复后定向回归转绿；实盘只读扫描精确得到 10 个 manifest 缺口、10/10 dry-run，未修改 `web/generated`。
- 本次最终 Unified CI：21/21；Web 129 files + 1 skipped / 1105 tests + 2 skipped、Track A 6/6、MCP 82 files / 456 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。首次沙箱内全量仍因 Supertest 绑定 `0.0.0.0` 得到 `EPERM`，允许本地临时端口后原样通过；另补齐新测试系列的标准 plan fixture 后，受影响 API 5/5 通过。
- 本次 operator queue 切片先红灯证明 manifest 缺口不会置顶、治理 summary/action/disposition 均不存在；实现后 Web/MCP 定向各 1 test 转绿，Web check 与 MCP build 通过，实盘 10/10 queue 合同复核通过。
- 本次最终 Unified CI：21/21；Web 129 files + 1 skipped / 1105 tests + 2 skipped、Track A 6/6、MCP 83 files / 457 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision、publishable delivery 或 professional pass。
- 本次 preflight 红灯先以 MCP 缺失模块和 Web 缺失路由复现；实现后 Web API 205 tests 与 MCP generated health/governance/preflight 定向通过。正反向用例覆盖 ready re-export、placeholder/缺文件阻断、未知目标、非 gap 目标、缺 disposition、绝对路径和 queue API 接线。
- 实盘 10 项扫描精确为 preserve `10/10 ready`、re-export `0/10 ready / 10/10 blocked`；运行中 API 对 `20260619-series-0so7mqbg` 返回授权、cut、字幕、音频、片头卡五项 failed，路径作用域 passed，所有写入/合成/发布信用字段均为 false。
- 本次 preflight 定向后 `npm run check`、MCP build、报告 JSON 解析与 `git diff --check` 全通过；最终 Unified 结果见本节末尾最新条目。
- 本次 preflight 最终 Unified CI 一次通过：21/21；Web 129 files + 1 skipped / 1105 tests + 2 skipped、Track A 6/6、MCP 83 files / 457 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 18 files / 0 hold / 0 staged 与 no-stage 全通过，未授予 real revision、publishable delivery、real GEARS/Seedance 或 professional pass。
- 本次 UI 接线 Playwright 先红灯复现面板不存在；实现后第二个红灯发现否定句仍含“已可发布”成功短语，改为“未获得/不授予发布资格”后转绿。定向 1/1、完整浏览器 7/7、client TypeScript、可见文案审计与 diff check 均通过。
- 本次 UI 接线最终 Unified CI 一次通过：21/21；Web 129 files + 1 skipped / 1105 tests + 2 skipped、浏览器 7/7、MCP 83 files / 457 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 20 files / 0 hold / 0 staged 与 no-stage 全通过，未授予 operator signature、real revision、publishable delivery、real GEARS/Seedance 或 professional pass。
- 本次审阅包 Playwright 先红灯精确停在缺少“加入当前会话审阅包”控件；实现后定向 1/1 通过，锁定同键去重、ready/blocked 并存、JSON/Markdown 下载内容、无 approve/execute、失败不可加入、清空与刷新丢失。`vue-tsc --noEmit` 与定向 diff check 通过。
- 实盘只读样例抽查为 10 个 re-export / 10 个 blocked / 0 个 ready；授权输入、cut、字幕、音频、片头片尾卡均 10/10 failed，project-scoped path 0 failed，全部写入/合成/信用字段为 false；`web/generated` 保持无 Git 脏变更。
- 本次审阅包最终 Unified CI 一次通过：21/21；Web 129 files + 1 skipped / 1105 tests + 2 skipped、浏览器 7/7、MCP 83 files / 457 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 20 files / 0 hold / 0 staged 与 no-stage 全通过，未授予 operator signature、real revision、publishable delivery、real GEARS/Seedance 或 professional pass。
- 本地开发服务已重新启动：`http://localhost:5173/projects` 返回 200，`http://localhost:3000/api/system/story-agent-mvp-status` 返回 200。
- 本次 activity 诊断红灯先复现模块缺失，再在 Web/MCP health 两端复现 `generation_activity` 缺失；实现后服务 3 tests、Web API 1 test 与 MCP 1 test 通过。用例锁定修订不计新故事、旧根只检查不合并、pending transaction 只阻断不恢复、全程零写入/零模型调用。
- Projects 页 Playwright 先红灯精确停在活动诊断元素不存在，接线后 1/1 通过；同时原 manifest 审阅包全流程继续通过。Web server/client TypeScript、MCP build、可见文案审计与 diff check 通过。
- 本次 activity 诊断最终 Unified CI 一次通过：21/21；Web 130 files + 1 skipped / 1108 tests + 2 skipped、浏览器 7/7、MCP 83 files / 457 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 24 files / 0 hold / 0 staged 与 no-stage 全通过，未授予生成请求结论、链路故障结论、real revision、publishable delivery、real GEARS/Seedance 或 professional pass。
- 本次 generation-attempt audit 先红灯复现模块缺失，再以 9 个账本用例锁定隐私字段白名单、稳定错误码、24 路并发唯一 ID/顺序、孤立 started、三文件轮转上限、started/succeeded 写入失败 fail closed，以及原生成失败优先保留；Web activity 新增 3 个红灯锁定 success/no-new-request、failed 和 incomplete，MCP parity 新增 2 个红灯。
- Web canonical route 定向 Supertest 证明未注册领域也产生 `started -> failed(DOMAIN_PACK_NOT_FOUND)`，而请求条目、用户 query 与绝对 generated root 均未进入 JSONL。默认沙箱的 Supertest 复现既有 `0.0.0.0 EPERM`，解除本地测试端口限制后同一用例通过，不是代码回归。
- 本次 generation-attempt audit 最终 Unified CI 21/21 通过：Web 131 files + 1 skipped / 1121 tests + 2 skipped、浏览器 7/7、MCP 85 files / 461 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 28 files / 0 hold / 0 staged 与 no-stage 全通过，未授予真实生成请求、real revision、publishable delivery、real GEARS/Seedance 或 professional pass 信用。
- 本次 audit hardening 先以独立进程压力用例复现跨进程竞争风险，再接入原子 lock、陈旧锁恢复和 owner-safe release；Web audit/activity 定向 2 files / 25 tests、MCP parity 1 file / 4 tests 通过。测试覆盖 4 进程 160 attempts / 320 events、fresh lock 阻断、expired lock 恢复、未初始化只读、健康账本、symlink system 目录、畸形 ledger 与超额 archive；超额 archive + 可读主账本也会把 durable history 和失败结论同时降为 false。
- 本次 audit hardening 最终 Unified CI 21/21 通过：Web 131 files + 1 skipped / 1131 tests + 2 skipped、浏览器 7/7、MCP 85 files / 465 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 28 files / 0 hold / 0 staged 与 no-stage 全通过，未授予真实生成请求、real revision、publishable delivery、real GEARS/Seedance 或 professional pass 信用。
- 本次 operator diagnostic 先以 Web 5 项/MCP 3 项合同红灯证明 action/safety 字段缺失，接线后 Web audit 17/17、MCP activity 5/5、Web generated-health API 1/1、MCP generated-health 1/1、浏览器下载 1/1、Web 类型/文案审计与 MCP build 全通过。浏览器直接解析 JSON/Markdown，确认 schema、内存态、零 server mutation、零自动修复、零破坏操作和无 `/Users/` 路径。
- 本次 operator diagnostic 最终 Unified CI 21/21 通过：Web 131 files + 1 skipped / 1131 tests + 2 skipped、浏览器 7/7、MCP 85 files / 466 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 28 files / 0 hold / 0 staged 与 no-stage 全通过，未授予真实生成请求、real revision、publishable delivery、real GEARS/Seedance 或 professional pass 信用。
- 本次 production policy 可观测性以 Web/MCP 缺失 lock policy 字段红灯起步，再以非法配置缺失稳定 warning 红灯收口；最终 Web audit/activity 29 tests、MCP activity/health 8 tests、Web generated-health API 1/1、浏览器 1/1、双端类型/构建均通过。环境覆盖值两端一致，非法值不回显；symlink ledger/archive 两条安全回归均证明生成未启动、外部写入为 0。
- 本次 production policy 最终 Unified CI 21/21 通过：Web 131 files + 1 skipped / 1135 tests + 2 skipped、浏览器 7/7、MCP 85 files / 471 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 28 files / 0 hold / 0 staged 与 no-stage 全通过，未授予真实生成请求、real revision、publishable delivery、real GEARS/Seedance 或 professional pass 信用。
- 本次 owner-only 权限切片先以 Web 3 条/MCP 1 组红灯复现 `0755/0644` 被误判 ready；接线后 Web audit/activity 32 tests、MCP activity/health 9 tests、Web generated-health API 1/1、浏览器 1/1、Web 类型/文案与 MCP build 全通过。目录、ledger、archive 三类生成调用计数均为 0，真实工作区 Web/MCP readiness 完全一致。
- owner-only 首次全量暴露真实共享写入者冲突：较早的 production-readiness portfolio 自动化会把共用 `web/generated/system` 新建为 `0755`、自身 ledger 新建为 `0644`，导致 generated-health 正确转 blocked，首个 API 断言失败后清理中断并级联 27 项。隔离首测通过，确认不是 GEARS/故事回归。
- `production-readiness-portfolio-service` 现只在新建时使用目录 `0700`、ledger `0600`；不 chmod 或修复既有历史目录。API 红灯直接读 mode 复现 `0755`，修复后 portfolio 写入→generated-health 原顺序联跑 2/2 通过，后续不再级联。
- 本次 owner-only 最终 Unified CI 重跑 21/21 通过：Web 131 files + 1 skipped / 1138 tests + 2 skipped、浏览器 7/7、MCP 85 files / 473 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 29 files / 0 hold / 0 staged 与 no-stage 全通过，未授予真实生成请求、real revision、publishable delivery、real GEARS/Seedance 或 professional pass 信用。
- 本次 event file sync 先以 2 条红灯证明 sync hook 未生效、started/terminal 都会继续返回成功；实现后定向 Web audit/activity 34 tests、MCP activity/health 9 tests、Web API 1/1、浏览器 1/1、Web 类型/文案与 MCP build 全通过。浏览器首次因本地开发服务占用 5173 无法启动，停止开发服务后原样通过，不是产品失败。
- 本次 directory sync 再以 2 条红灯证明目录 sync hook 未生效；实现后 Web audit/activity 扩为 36 tests，MCP activity/health 9 tests、Web API 1/1、浏览器 1/1、Web 类型/文案与 MCP build 全通过。文件与目录同步失败均保持稳定脱敏错误边界。
- 本次 file + directory sync 最终 Unified CI 21/21 通过：Web 131 files + 1 skipped / 1142 tests + 2 skipped、浏览器 7/7、MCP 85 files / 473 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 29 files / 0 hold / 0 staged 与 no-stage 全通过，未授予真实生成请求、real revision、publishable delivery、real GEARS/Seedance 或 professional pass 信用。
- 本次 process-kill 恢复先以 rotation 后缺失内部停顿点的红灯起步；加入不进入 API/MCP 的窄测试钩子后，两个独立 Node 子进程分别在“文件 sync 后/目录 sync 前”和“rotation rename 后/下一 append 前”由父进程发送 `SIGKILL`。两种情况下 retained history 都是完整 JSONL、fresh lock 都先 fail closed，只有测试显式把 lock 标记过期后 canonical 请求才恢复。
- process-kill 定向 Web audit/activity 2 files / 38 tests 与 Web 类型/可见文案检查通过；平台证据限定为 Node v26.0.0、Darwin 25.5.0 arm64、本机 local journaled APFS 临时目录。该用例没有模拟断电、磁盘故障或远端文件系统，不增加跨平台耐久性或真实生成信用。
- process-kill 最终 Unified CI 21/21 通过：Web 131 files + 1 skipped / 1144 tests + 2 skipped、浏览器 7/7、MCP 85 files / 473 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 29 files / 0 hold / 0 staged 与 no-stage 全通过，仍未授予真实生成请求、real revision、publishable delivery、real GEARS/Seedance 或 professional pass 信用。
- 新增部署目标显式命令 `cd web && npm --silent run smoke:audit-crash -- --work-dir /absolute/new/story-agent-audit-crash-smoke-<id>`。目标必须是绝对、尚不存在、固定前缀命名且位于 active generated root 之外；已有目录、真实 generated 子目录、直接 symlink parent、相对路径和任意名称均在写入前拒绝。
- smoke 服务红灯先复现模块缺失；实现后服务 5/5、与 audit/activity 联动 3 files / 43 tests、Web 类型/可见文案检查和真实 CLI 正向 2/2 cases 全通过。正向验证只创建 `/private/tmp` 新目录，完成后该夹具已删除；真实 `web/generated` 未触碰。
- 报告 payload 固定不含绝对路径、attempt/lock owner 或 ledger 内容，不自动 repair/unlock/delete。普通 `npm run` 会由 npm 外壳回显完整参数，因此推荐调用必须带 `--silent`；合同明确 `shell_invocation_arguments_in_scope=false`，不把 shell history/argv 冒充成 payload 脱敏保证。
- deployment smoke CLI 最终 Unified CI 21/21 通过：Web 132 files + 1 skipped / 1149 tests + 2 skipped、浏览器 7/7、MCP 85 files / 473 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 34 files / 0 hold / 0 staged 与 no-stage 全通过，仍未授予任何真实生成、发布或专业通过信用。
- `2026-07-19` 已真实调用 canonical `POST /api/stories/generate` 6 次，账本落下 12 条 `started → succeeded` 事件；所有请求均为 `generation_mode=local_only`、`generation_used_fallback=false`，不是外部模型调用。故事/项目从 22/22 增至 28/28，版本从 53 增至 59；6 个 story/project/v1 JSON 均通过身份与解析检查，文件权限 `0600`、system 目录 `0700`、ledger `0600`。
- 初始样本暴露地域元数据污染、`通书/慎动` 误作人物、史料原句被改写；后续实跑继续暴露 `陈抟` 跨事件漂移、王逵漏入人物表、GEARS/Seedance 场景资产灌入整条知识摘要、显式地点被结尾意象覆盖。现已用真实样本红绿测试收口：拒签故事人物只保留周敦颐/王逵，引号内固定可证原句；受众质检拦截结构化地域元数据与拒签史实失真；GEARS 只取匹配 `asset_split.scenes`、显式 `scene.location` 优先、历史污染资产自动刷新；Seedance 重复地点稳定使用建立镜头。
- 最终本地 canonical 样本为 `20260719-story-5zda49662217` / `20260719-story-5zda49662217--character_story`：质量 passed、pattern 94、GEARS readiness 100、audience clean、material sufficiency 100、domain safety passed；Story/Project/GEARS/GEARS delivery/Seedance 五个 API 全部 200，6 个 GEARS 单元、6 个 Seedance 镜头、6 个素材引用，无必需槽位缺失且未超素材上限。机器域安全仍明确 `human_review_complete=false`、`real_credit_granted=false`。
- 外部 Codex CLI、登录态和 bridge 配置已验证，但真正外部请求会把知识条目和 Story Agent prompt 发送到外部服务并可能消耗账户额度；在未取得用户明确知情授权前，请求在执行前被拦截，外部模型调用 0、外部持久化写入 0，未绕过。完整证据见 `data/reports/story-agent-real-functional-smoke-20260719.json`。
- 真实账本使旧浏览器用例“必须 uninitialized”首次失败；E2E 现同时验证 `uninitialized` 与 `ready + valid + latest succeeded` 两种合法状态。最终 Unified CI 21/21：Web 132 files + 1 skipped / 1151 tests + 2 skipped、浏览器 7/7、MCP 85 files / 473 tests、KB 34 files / 262 entries，构建、Stage 6–8、治理、diff、P4 42 files / 0 hold / 0 staged 与 no-stage 全通过。

注：本轮第一次 Unified CI 在默认沙箱因 Supertest 绑定 `0.0.0.0` 得到 `EPERM`，24 files / 256 tests 因同一端口限制失败；解除本地测试端口限制后原样 21/21 通过，不是代码回归。此前 GEARS 隔离门禁的 SQLite 迁移和 fake key 变量名问题也均已按旧交接修正；所有测试未发模型请求。

## 6. 五套进度

- 综合研发：78%，受三个真实样板 0/3 上限约束，本轮不增长。
- 专业文本创作：47.5%，真实通过指标均为 0。
- 知识内容供给：正式条目 262 / 长期条目规模目标 800，当前来源 960；M1 机器 23/23、真人 0/23；M2 机器 70/97、真人 0。
- 真实 GEARS/Seedance：0/5；本地 acceptance-ready 5 个排除于真实计分。
- 发布运营成熟度：60%；durable signed release 0，active release authority 0，真实 UAT 未完成。

商业成熟度估计仍为 35%。

本轮新增的是 6/6 次本地 canonical 功能实跑和一份机器检查+逐字段内容审阅的最终本地样本；它提高了功能验证可信度，但不替代外部模型、真人评审、真实媒体 provider 或三个正式样板，因此五套进度与商业成熟度不据此虚增。

## 7. 下一最小切片

generation-attempt ledger 已从 uninitialized 进入 6 次成功请求的健康历史；本地 canonical Story → Project → GEARS → Seedance 功能闭环和真实样本缺陷修复已完成。下一高价值切片是一次经用户明确知情授权的外部 Codex 生成对照，或接入真实 GEARS/Seedance provider；在没有授权时不发送知识条目/prompt、不消耗账户额度，也不把本地 prompt package 冒充真实媒体执行。

建议顺序：

1. 若要验证外部模型，必须先取得用户明确回复：知晓会把所选知识库条目与 Story Agent prompt 发往外部 Codex、可能消耗账户额度，并批准一次持久化调用；随后只执行一次，记录 model provider、原始/修复质量与账本结果。
2. 外部模型样本必须与最终本地样本 `20260719-story-5zda49662217` 做同请求对照，重点审阅可证引语、人物范围、史实/场景化边界、GEARS 场景资产和 Seedance 参考图说明；机器通过不等于真人通过。
3. 若没有外部模型授权，优先处理最终 Seedance 包中 3 个 `dense` 镜头的拆分/复杂度建议，或等待真实 GEARS/Seedance endpoint、callback 和公开 artifact URL 后跑 provider 闭环；不要重复生成同质本地样本。
4. deployment crash smoke 仍应由 operator 在目标卷的新固定前缀目录执行并签署平台证据；本机重复 smoke 不增加跨平台耐久性信用。
5. 保持旧 MCP `scripts/*.md` 写入工具不接入、不重写 6 份失败演进样本、不回填虚假人工/外部 credit、不自动修复权限或删除 ledger。真实 operator 对 manifest 审阅包的仓外签署仍是外部阻塞。

## 8. 外部阻塞

- 外部 Codex CLI 与登录态可用，但用户尚未明确知情授权发送知识条目/prompt并承担可能的账户额度消耗；外部模型请求因此保持 0。
- 三个样板的真实业务目标、授权素材、人物/场地和版权条件未齐。
- 编剧/剧本编辑、类型导演/制片、事实/文化真人评审未到位。
- 真实 GEARS/Seedance endpoint、callback 和五个稳定公共 artifact URL 未提供。
- 26 个 legacy 目录需逐项人工 ownership、版本/内容及处置签署。
- 20 个 legacy domain-safety candidate 等待人工授权；99 个断链项目等待准确备份或用途证据。
- 生产身份、外部审计归档、release authority、对象存储、队列、备份恢复和真实 UAT 未完成。

## 9. Superpowers Lite 流程优化

Mac/Codex 当前没有已安装、可编辑的 Superpowers 插件副本；仓库文档记录的 Superpowers 5.1.0 属于 Windows/Claude Code。为让下一次 Codex 对话实际生效，本轮新增项目级 `.codex/skills/superpowers-lite`，不修改 marketplace 缓存，也不伪装成 Windows 插件升级。

核心规则：

- 默认 Lite：一次审计、一个可逆切片、定向验证、简短汇报。
- 跨模块/跨仓共享合同升级 Standard：短计划、双边合同测试、一次代表性 E2E、里程碑结束时一次全量门禁。
- 破坏性、安全、付费外部调用、真实数据迁移或生产授权升级 Strict；Strict 不扩大用户授权。
- 行为、bug、安全边界和共享合同保持红绿测试；纯文档、机器报告和机械改动只运行对应 parser/audit/diff/P4，不重复不受影响的全量套件。
- 不再强制每个明确任务先 brainstorming、大计划、worktree、subagent 或多轮 full CI。
- 保留真实计分边界、根因诊断、完成前新鲜证据、dirty worktree 保护和 60 秒内进度沟通。
- 同一连续对话只做一次完整启动审计；用户说“继续”时从当前切片恢复，不重读全部计划、不重跑未受影响的全量门禁。
- 普通 `继续` 默认只做一个约 10–15 分钟的可验证切片；完成后先回报。只有用户明确要求持续自动推进或不要停，才连续执行多个切片。
- 仅当前切片涉及的仓库做完整 branch/remote/diff 基线；另一仓在最终交接只刷新 status/staged。
- 全工作区归属读取 P4 JSON summary；只审查本切片触达文件的 diff，不默认展开 16k+ 行历史差异。

该流程优化不增加任何业务进度或真实交付信用。

### 已确认的耗时来源

- 上下文加载：旧规则启动即读 3,077 行长期文档，远高于 80 行 `superpowers-lite`。
- 工作区规模：Story 为大型 dirty worktree，tracked diff 约 16,417 行新增；全量展开会显著增加分析量。
- 测试执行：Story server 全量约 67 秒，Unified CI 约 88 秒，GEARS 完整门禁还会追加等待；这些不是模型“思考”。
- 权限往返：GEARS 位于工作区写权限外，重复 escalated 审计会产生额外审批/调度延迟。
- 文档维护：过去每个小切片同时追加长期计划、综合执行、P4 prose、机器报告和交接，造成重复读取与验证。

优化后只在业务基线/计分/里程碑变化时更新长期计划；普通切片默认只更新代码、必要测试、P4 JSON 和当前交接。P4 prose、综合执行和长期计划不再逐切片重复追加。

## 10. 新对话启动指令

建议将以下内容作为新对话首条消息：

> 完整读取 `docs/story-agent-next-conversation-handoff-20260717.md`，使用 `$superpowers-lite` 推进；`2026-07-19` 已完成 6 次 local-only canonical Story Agent 实跑，健康账本为 12 events / 6 succeeded attempts，最终样本为 `20260719-story-5zda49662217`，证据见 `data/reports/story-agent-real-functional-smoke-20260719.json`。先复核最新 Unified 21/21、P4 与最终 Story/Project/GEARS/Seedance 五 API；不要删除或覆盖 6 个演进样本。只有用户明确知晓知识条目/prompt会发送到外部 Codex且可能消耗额度并批准一次持久化调用后，才执行外部模型对照；否则继续等待真实 GEARS/Seedance provider 或处理 dense 镜头，不重复生成同质 local-only 样本。不自动解锁/删除/修复，不接旧 MCP `scripts/*.md` 写入工具，不授予真人审核、publishable delivery、real provider 或 professional pass 信用，也不自动暂存、提交或推送。

## 11. 新对话每轮强制报告

每轮必须报告：五套进度、真实指标、测试证据、Story/GEARS 两个工作区状态、下一步和外部阻塞。任何 fixture、fake key、readiness、dry-run、本地导入或候选稿不得改变真实计分。
