# Story Agent 下一对话交接与开发计划（2026-07-16）

## 1. 交接目标与计分边界

本文供新的 Codex 对话直接接手 `china-culture-kb` 与本地 GEARS v2 联调，执行时继续严格遵循：

- `docs/story-agent-long-term-comprehensive-development-plan-20260713.md`
- `docs/story-agent-new-conversation-handoff-20260712.md`
- `docs/story-agent-next-conversation-handoff.md`
- `docs/story-agent-p4-dirty-worktree-review-plan-20260712.md`
- `docs/story-agent-integrated-execution-plan-20260710.md`
- `docs/knowledge-base-content-expansion-long-term-plan-20260713.md`
- `docs/knowledge-base-content-expansion-m2-batch-plan-20260713.md`

以下内容一律不得冒充真实完成：fixture、simulation、fallback、prepared、readiness、机器阈值、测试验签、截图、memory handoff、本地无模型 smoke、伪造 API key、自动化自签、无公共产物 URL 的成功响应。

它们不计真实修订、真人审核、真实 GEARS/Seedance 回片、signed release 或 professional pass。

## 2. 当前代码与工作区基线

### 2.1 主仓库

- 路径：`/Users/wuyu/Desktop/china-culture-kb`
- 分支：`codex-ai-comic-series-longform`
- 当前 HEAD：`ac7deb653327bfa90d5dffe2f0f2b162b17407ae`
- 远端：与 `origin/codex-ai-comic-series-longform` 一致
- 相对原始交接 HEAD `25fce2bf38c86b9c6b46a35f8aae69f9822b8c74`，已有一个提交：
  - `ac7deb65 feat(story-agent): advance track A and domain architecture`
- 当前 dirty worktree：92 个已跟踪修改（含 P4 清单报告自身）、26 个未跟踪文件；不得 reset、删除、覆盖或猜测归属
- 暂存区：空
- P4：117 个待审文件（不含清单报告自身；91 tracked / 26 untracked）、0 hold、0 staged，当前未 stale
- 未跟踪文件：
  - `docs/story-agent-next-conversation-handoff-20260716.md`
  - `mcp-server/src/lib/story-source-domain.ts`
  - `web/client/src/components/GearsWorkbenchPanel.vue`
  - `web/server/src/__tests__/story-read-service.test.ts`
  - `web/server/src/platform/story-source-domain.ts`
  - `web/server/src/services/gears-workbench-audit-service.ts`
  - `web/server/src/services/gears-workbench-connector.ts`
  - `web/server/src/__tests__/gears-workbench-connector.test.ts`
  - `web/server/src/__tests__/gears-workbench-cross-repo.e2e.test.ts`
  - `web/server/src/__tests__/project-repository-provider.test.ts`
  - `web/server/src/platform/project-repository-provider.ts`
  - `web/server/src/__tests__/sqlite-project-repository.test.ts`
  - `web/server/src/repositories/sqlite-project-repository.ts`
  - `web/server/src/__tests__/original-fiction-domain.test.ts`
  - `web/server/src/domains/original-fiction/domain-pack.ts`
  - `web/server/src/domains/original-fiction/story-safety.ts`
  - `web/server/src/platform/story-domain-revision-safety.ts`
  - `web/server/src/services/story-domain-safety-migration-service.ts`
  - `web/server/src/__tests__/story-domain-safety-migration-service.test.ts`
  - `web/server/src/services/story-project-file-to-sqlite-migration-service.ts`
  - `web/server/src/__tests__/story-project-file-to-sqlite-migration-service.test.ts`
  - `web/server/src/platform/story-storage-root.ts`
  - `web/server/src/__tests__/story-storage-root.test.ts`
  - `web/server/src/__tests__/story-storage-root-boundary.test.ts`
  - `web/server/src/services/story-storage-legacy-disposition-service.ts`
  - `web/server/src/__tests__/story-storage-legacy-disposition-service.test.ts`

除非用户在新对话中再次明确授权，不自动暂存、不 commit、不 push。

### 2.2 GEARS v2 本地仓库

- 路径：`/Users/wuyu/Desktop/gears v2`
- fork：`https://github.com/Wy490/gears-v2.git`
- upstream：`https://github.com/chihaku1230-ship-it/gears-v2.git`
- remotes：`origin=fork`、`upstream=原仓库`，已核验；两端 `v0.2-dev` 均位于交接 SHA
- 分支：`codex/story-agent-workbench-bridge`（从 `v0.2-dev` 创建；未来 PR base 必须为 `v0.2-dev`）
- HEAD：`1d772200a809ca282a73535126359949d054164b`
- Git 工作区：6 个 tracked 修改、10 个 untracked 文件，0 staged；未 commit、未 push
- 本地忽略环境：`.env`、`.venv`、`node_modules`、`dist`
- smoke 数据库与媒体目录位于 `/private/tmp`，不属于可持久生产证据

截至本交接时曾启动：

- GEARS 前端：`http://127.0.0.1:5173`
- GEARS 后端：`http://127.0.0.1:8000`
- Story Agent：`http://127.0.0.1:3002`

新对话必须重新验证进程和 `/health`，不得假设它们仍在运行。

## 3. 五套进度（2026-07-16 基线）

| 进度轨 | 当前值 | 已完成证据 | 仍未完成/不得提前计分 |
| --- | ---: | --- | --- |
| 综合研发 | 78% | 轨道 A、领域中立 Story/Project 契约、第二个 `original_fiction` Domain Pack 全链路、SQLite ProjectRepository、Domain Pack 自有修订/写前复验/正式知识写回计划、legacy 安全迁移、file→SQLite 全历史迁移合同、单一 storage-root/生产 fail-closed，以及 26 项 legacy 逐项只读 preflight | 受三个真实端到端样板未完成前 78% 上限约束；20 个安全候选逐项确认/执行、26 项人工处置授权、真实 file→SQLite 切换、外部生产存储、真实恢复、真实身份/UAT、真实模型与真人审查仍未完成 |
| 专业文本 | 47.5% | 机器流程、质量和交付包能力已建立 | 真实模型项目 0；专业包 0/15；真实修订轮次 0；真人盲审 0/45；professional pass 0 |
| 知识内容 | 262 条 / 960 来源；M2 70/97 | 34 省级文件；M1 机器 23/23；M2 机器 70/97 | 长期 800 条目标仅 33%；M1/M2 真人来源与文化审查均为 0；正式验收均未完成 |
| 真实 GEARS/Seedance | 0/5 | 本地 acceptance 5 和本次真实 GEARS v2 导演工作台 API smoke 均只作工程证据 | 外部真实项目 0/5；公共真实产物 URL 0；不得把本地项目/角色/场景记录计作回片 |
| 发布运营 | 60% | 发布、审计、签署与运行治理骨架已建立 | durable signed release 0；active release authority 0；真实 UAT 未完成 |

商业成熟度估算仍为 35%，不是可发布承诺。

## 4. 本阶段已完成的主要工作

### 4.1 轨道 A：产品体验与权限基础

机器验证实现度由严格审计约 25% 推进至 97%：

- 一级导航收口为“创作、项目、素材、生产、评审”五入口
- Stage/P 与内部检查器迁入受控二级导航，深层路由保留
- 建立统一项目工作流和唯一主 NEXT
- 建立六种角色任务视图
- 建立 role、feature flag 和路由隔离
- 建立生产默认 hash-only 身份注册表、服务端 RBAC、资源 owner/member/organization 校验
- 建立新项目 ownership 持久化和旧资源绑定框架
- 建立 fail-closed 持久访问审计、轮转、外部保留契约和并发锁
- 建立 issuer/audience/TTL/HMAC session 校验、actor 级撤销与生产静态 token 默认拒绝
- 建立只读 ownership inventory、hash 锁定且非覆盖式迁移执行器、写前审计、并发锁和幂等重放
- 建立服务端登录 handoff、安全 return path、客户端 session bootstrap 和全局失效恢复
- 建立 6 条正式 Playwright 浏览器路径并纳入 Unified CI
- 浏览器 E2E 使用隔离端口，不终止开发者已有服务

轨道 A 剩余 3% 不是继续堆机器页面，而是真实外部落地：真实 IdP、949 个遗留资源人工 owner 复核与生产迁移、外部审计保留执行、真实五分钟新用户测试、角色 UAT。

### 4.2 Story/Project 领域中立与 fail-closed 契约

当前 dirty slice 已继续完成：

- Story/Project list/detail 暴露并按 `sourceDomain` 过滤
- 显式领域必须通过 registry 校验；legacy snapshot 才允许 `china_culture` 内存回填
- Web/MCP 的 GEARS delivery 与 Seedance JSON/Markdown 包传播同一 `sourceDomain`
- Web/MCP 项目读取与 production readiness 必须精确解析 `current_version_id`
- history 文件必须是 regular file，路径、顶层 project/version、嵌套 Story 身份必须一致
- Project/Story 显式领域冲突 fail closed
- generated health 显式发现 `current_story_id` 与 current snapshot Story ID 不一致
- MCP 新版本写入时固化不可变 Project source domain，并拒绝冲突的 `snapshot_json`
- ProjectRepository 已具备 WAL、锁、乐观检查、安全路径/符号链接校验；ArtifactStore 与外部 runner 原子导入已接线
- `project-service` 只依赖 `ProjectRepository` 接口，具体 file provider 由平台工厂构造；系统状态明确外部数据库/对象存储均未实现、生产持久化未就绪，未知 provider fail closed
- provider 工厂现支持 `file` 与 `sqlite`；SQLite 使用持久文件、WAL、FULL 同步、schema/version 和 JSON SHA-256 校验、快照身份校验、三字段 CAS、事务版本/当前状态写入、完整性检查、非覆盖备份和恢复后 logical SHA 等价验证
- `node:sqlite` 仅在选择 sqlite provider 时加载，配置 API 暴露 `sqlite_runtime_available`；不支持的运行时对 sqlite fail closed，默认 file provider 不会被静态 SQLite 导入破坏
- 已注册第二个代码级 Domain Pack `original_fiction`，不读取中国文化知识库；要求 `fictional_original`、至少 40 字和 3 个可执行分句的用户原创提案，生成 StoryBlueprint、6 scenes、质量报告、Project/version、GEARS/Seedance delivery
- repair 不能覆盖 `sourceDomain`、原始提案或 `domain_safety`；原创域修订在新版本持久化前重新跑领域安全，删除 source trace 会 fail closed
- Domain Pack 合同已有第九项 `story_revision` 和第十项 `knowledge_writeback` capability；两个生产 pack 均升级到 `1.2.0`，分别以 `story-domain-revision-guidance/v1` 和 `story-domain-knowledge-writeback-plan/v1` 提供领域自有修订与正式知识写回边界
- Project repair prompt 由领域 pack 决定，已移除硬编码的中国文化角色；带显式 `domain_safety` 的中国文化与原创 Story 都会在新版本写入前重新加载本领域 source entry 并复验
- `china_culture` 自有写回服务只接受固定 34 省级名称并生成安全仓库相对目标；缺失、非规范和路径型省份不再生成 `待确认.md`。`original_fiction` 明确不支持正式知识写回，即使素材出现省份也不会获得目标、正式写回草案或可写回队列项；未注册历史领域转为 `domain_pack_not_registered` blocker，不隐藏统一任务列表
- Project 补充任务响应显式输出 Domain Pack、写回资格、blockers、文件和 section；平台拒绝绝对/穿越路径，所有计划均固定真人复核、直接写回 false、已写回 false、真实信用 false
- 修订后缺来源、删除中国文化约束或删除场景 source trace 均 fail closed，且 version count 不增加；没有显式安全报告的 legacy snapshot 暂保兼容，仍需单独可审计迁移
- legacy `domain_safety` 新增只读 inventory 与管理员迁移 API；默认 dry-run/禁写，apply 必须显式确认 source domain/entry、锁定 current version 与 Story SHA、通过重新加载来源后的领域安全校验，并配置独立 write gate 与 durable JSONL audit
- 迁移只追加 `domain_safety_migration` 新版本，旧 snapshot 不覆盖；相同 migration 重放不产生额外版本，file/SQLite 与两个生产领域均有自动化
- 仓储新增无恢复、无写入的 current-state inspection，盘点不会触发 FileProjectRepository pending transaction recovery
- 真实工作区只读盘点：22 个 Project，20 个 machine-valid candidate、2 个因来源/可信边界阻断；apply 0、history overwrite 0、human review 0、real credit 0
- FileProjectRepository 新增完整 meta/version 历史 canonical inspection；逐 snapshot 校验身份、count/current 一致性和 logical SHA，pending transaction 只阻断、不恢复、不写回
- SQLiteProjectRepository 新增仅允许空目标库的单事务 logical-state import，拒绝重复/孤儿/历史不一致，并在提交后复验 Project/version 数、integrity、foreign key 和 logical SHA
- 新增管理员 file→SQLite 迁移 API；默认 dry-run，真实执行要求 source logical SHA、显式 review、独立 write gate 与 durable intent/completion audit；数据库与旁车 manifest 非覆盖发布，发布前复验源，合法重放复验 DB/file/logical SHA
- 迁移服务不会切换 active provider；真实工作区只读 preflight 为 22 Projects / 52 versions / SHA `b4cd2fcf2ad1812026bece49fad75573f1b810f87524ae985f79899f2532343f`，目标文件前后不存在，apply 0、writeback 0、provider change 0
- 新增单一 `story-storage-root-config/v1` 边界；server 与直接 service import 默认都解析到仓库 `/data` 和 `/web/generated`，相对路径、知识/生成根重叠 fail closed，生产启动必须显式提供两个绝对根
- 所有直接使用 generated root 的 Story/Project、系列、health、workbench、GEARS 和资源访问服务已委托该边界；旧 `/web/web/generated` 不再参与 active read/write fallback，只由 `/api/system/story-storage-root-config` 只读发现
- 真实只读 root 审计：active 22 Projects / 52 versions / 927 series，legacy 26 Projects / 0 versions；自动迁移、合并、删除、覆盖、写回、provider 切换和 real credit 均为 0
- legacy 根新增管理员只读 `story-storage-legacy-disposition-preflight/v1`：逐目录检查结构、version 声明、来源、ownership、active ID/Story/元数据指纹/同来源标题碰撞与 legacy 元数据等价组；根路径相对/相同/嵌套、active 索引不完整和符号链接均 fail closed
- 真实 26 项 disposition preflight：22 个空目录、4 个仅元数据、0 个完整历史；来源 resolved 4、ownership valid 0；active Project ID/Story ID/元数据指纹碰撞均 0，同来源同标题人工比较候选 4，四项等价元数据组 1；26/26 均需人工处置
- legacy 树预检前后快照 SHA-256 同为 `eb0fde08cd88b421559937b8559a4f413eaff068da629eec8b6814a150bab5f4`，inventory SHA-256 为 `7fbb642494231f0eea4b43e358335e9368a18b913439c8bfe0cdb2b48432dbe2`；自动动作、迁移、合并、删除、覆盖、写回和真实信用均为 0
- 从原创域实际生成 Story 到 Story Agent HTTP/connector，再到真实本地 GEARS v2 capability/dry-run/execute/draft 查询的第二条跨仓 E2E 已通过

尚未完成：完整 project-service 抽离、20 个 legacy candidate 的逐项人工 source identity 确认和受控 apply、2 个 blocker 修复、26 个 legacy-root Project 的人工 ownership/版本/内容/重复关系确认及保留/迁移/归档授权、file→SQLite 真实目标/执行/切换授权、外部生产数据库/对象存储 provider、真实进程 kill/断电恢复与生产备份恢复演练、第二领域真实模型项目与真人验收。

### 4.3 知识库扩充

- 正式路径现有 262 条、960 个来源、34 个省级文件
- M1 机器研究/写作/校验 23/23
- M2 机器研究/写作/校验 70/97，剩余 27 条
- credibility、machine metadata、production audit、upgrade plan 和 asset split 报告均已更新

所有机器完成仍需真人来源核验与文化审稿，不能记正式 M1/M2 acceptance。

### 4.4 GEARS v2 workbench bridge 与 execution worker 拆分

已完成：

- 完成 fork/upstream 安全配置并从 `v0.2-dev` 创建独立工作分支
- GEARS 新增受 Bearer 保护的 `gears-workbench-capabilities/v1`，显式声明 `workbench_import_supported=true`、`execution_worker_supported=false` 和 `/gears/jobs` 不支持
- GEARS 新增 `gears-delivery/v1` workbench dry-run/execute/import-result/draft-list 接口
- source mapping ledger 以 source project/story/entity key 建立稳定 UUID 映射；同 key 同 payload 重放，同 key 不同 payload 返回 409
- project、character、scene 写入既有实体；因 Story Agent 未提供真实 base-sheet version，分镜写入显式 `storyboard_import_draft`，不伪造正式 Recipe 视觉锚
- 脚本、视觉提示、运镜建议、segment prompt hint、constraint note 分字段持久化
- Story Agent 新增只读取 `GEARS_WORKBENCH_API_BASE_URL/TOKEN` 的独立 connector；不读取 execution worker 的 `GEARS_API_*`，每次导入前必须通过 capability 探测
- connector 对 provider/media/真实计分非零响应 fail closed；项目路由提供 dry-run 与 execute
- Story Agent 项目详情页新增独立 workbench 操作面：配置状态、capability、四类 pack 映射、dry-run、显式 execute、幂等结果和独立审计展示；不与 execution worker ledger 混排
- workbench 导入审计使用独立原子 JSONL ledger，记录 source/import/idempotency/payload hash/实体计数和零信用边界，不记录 token、脚本全文或媒体；GEARS 返回 source identity 不匹配时 connector fail closed
- execution worker 新变量为 `GEARS_EXECUTION_WORKER_API_BASE_URL/TOKEN`，旧 `GEARS_API_BASE_URL/TOKEN` 只作 legacy fallback；runtime、config、contract、MVP/readiness、MCP 和导出 acceptance shell 均已兼容，且新变量优先
- execution worker 新增强制 `gears-execution-worker-capabilities/v1` 握手；必须证明自身不是 workbench、支持幂等 submit/status/callback、声明精确路径与 job type，真实 submit/status 才会继续
- 系统新增只读 execution-worker capability 探测；导出的 acceptance kit/shell 在 `/gears/jobs` 前保存并校验 capability，命令清单为 25 条，生成 shell 受 `bash -n` 测试
- GEARS capability 新增人工 Recipe 升级能力；项目详情页要求操作者逐个人物/场景选择真实 base-sheet 版本并二次确认，才可把导入草稿升级为不可变 Recipe
- 升级会验证人物集合、项目归属、角色/场景/establishing/crop 真实版本；视觉、运镜、连续性和约束写入 `recipe_metadata.delivery_guidance`，不会拼进 `script_text`；升级不调用 provider、不生成媒体
- 同 key 导入新增文件型 SQLite 双会话数据库级并发 E2E；Recipe 升级使用数据库条件抢占，同一选择安全重放，不同选择返回 409且不留孤儿 Recipe
- Workbench execute 必须携带成功 dry-run 的 source version 与 payload SHA-256；版本变化在任何外部请求前阻断，execute 前用同一 envelope 重新 dry-run，hash/blocker 变化时不发送 execute
- opt-in 双仓 E2E 现有 2 条：既有中国文化包，以及从 `original_fiction` Domain Pack 实际生成的 Story；均经 Story Agent HTTP route → connector → 真实本地 GEARS HTTP 完成 capability、dry-run、execute 前复验、execute、audit/draft/formal-recipe 查询，并确认正式 Recipe 为 0
- 原创域导入得到 1 Project、1 Character、3 个去重 Scene、6 个 StoryboardImportDraft，provider call、media artifact 与 real-delivery credit 全为 0
- GEARS 隔离迁移完成全量 `upgrade head` 与 `downgrade f1a4c8b2e6d9 → upgrade head`；full `make check` 为后端 291 tests、前端 17 tests、mypy 76 files、typecheck、build 与 format 96 files 全通过

关键结论：当前 GEARS v2 仍是“导演/分镜工作台”，不是 Story Agent 现有假定的异步执行 worker；本轮已经用 capability 和独立配置把两者拆开。

其 OpenAPI 提供 `/auth/login`、`/projects`、`/characters`、`/scenes`、`/presets/*`、`/storyboard-recipes`、`/storyboard-outputs` 等；不提供 `/gears/jobs`、job status poll 或 callback。旧逻辑只能在 `/gears/jobs` 404 后暴露错配；现在 Story Agent 会在 capability schema/service 校验阶段拒绝，不再发 submit。

因此本次仅完成真实软件实例上的“导演工作台数据联通”和第二领域机器生产证明。本地项目、角色、场景、draft、fixture、fake JWT/fake key、无模型测试和 readiness 均不计回片，真实 GEARS/Seedance 仍严格为 0/5。

## 5. 已有测试证据

最近一次完整 Unified CI：`node scripts/story-agent-ci.mjs --mode local` 通过 21/21：

- Web Server：128 files passed + 1 skipped，1087 tests passed + 2 skipped；opt-in 跨仓 E2E 已在全新隔离 GEARS 实例上单独 2/2 通过
- Track A Playwright：6/6；1 个预期 session-expiry 401；意外 console/API error 0
- MCP：79 files / 355 tests
- Web/MCP build：通过
- KB lint：34 files / 262 entries / 262 enriched entries
- Stage 6–8 zero-credit gates、治理检查、P4 stale/no-stage、diff check：通过
- paid model invocation：关闭
- 测试未授予任何真实修订、真人审核、真实回片、signed release 或 professional pass

本轮新增定向证据：

- Domain Pack 知识写回：registry、平台计划、Project service 与 API 4 files / 285 tests；聚焦 3 files / 80 tests；Story server TypeScript 通过
- legacy migration：file/SQLite、`china_culture`/`original_fiction`、append-only apply/replay、缺来源、pending transaction 只读盘点 5/5；migration + access route 2 files / 34 tests
- file→SQLite migration：service、file/SQLite repository 与 access route 4 files / 51 tests；完整历史、空库事务、非覆盖、write gate、durable audit、重放和 pending transaction 不恢复均覆盖
- provider/domain/migration 聚合：10 files passed + 1 opt-in skipped，129 tests passed + 2 skipped
- 真实工作区只读 preflight：22 Projects / 52 versions / logical SHA `b4cd2fcf2ad1812026bece49fad75573f1b810f87524ae985f79899f2532343f`，目标前后不存在、apply/writeback/provider change 均为 0
- storage-root：resolver/只读 legacy 审计 7/7、源码单一边界 10/10、API 210/210、受影响 service 8 files / 151 tests；真实 active 22 Projects / 52 versions / 927 series，legacy 26 Projects / 0 versions，data move/delete/overwrite/writeback 0
- legacy disposition：service、单一根边界、API 和权限 4 files / 252 tests；隔离 fixture 覆盖空目录、仅元数据、完整历史、无效 JSON、active ID/Story/元数据碰撞、legacy 等价组、来源/ownership 不确定性、root 重叠/不可读、Project/metadata 符号链接不跟随、unsafe current-version path 不探测、inventory hash 确定性和树快照零写入
- 真实 legacy disposition：26 目录 / 22 empty / 4 metadata-only / 0 complete history；source resolved 4、ownership valid 0、blocked/human-review 26、automatic action 0，树快照运行前后相同
- API、Project service、file/SQLite repository、registry、两个领域与 migration 合并回归：10 files / 336 tests
- Domain Pack revision registry/两个领域：3 files / 20 tests；API、Project service、registry 与两个领域合并回归：5 files / 282 tests
- 中国文化修订安全定向：3/3；缺 source entry 与删文化约束/source trace 均 fail closed，version count 保持 1
- SQLite provider 与第二领域 registry/domain 回归：25/25
- Node SQLite 选择性加载与 provider 运行时边界：8/8，Story server typecheck 通过
- `original_fiction` 生成、SQLite Project/version、合法 v2 修订、质量/GEARS/Seedance 主链与 project-service 回归：62/62
- Story API：211/211
- 双仓真实本地 HTTP E2E：2/2；其中原创域导入为 1 Project / 1 Character / 3 Scenes / 6 Drafts / 0 Recipes / 0 provider / 0 media / 0 real credit
- GEARS v2：bridge 定向 9/9；后端全套 291/291（fake keys，audit 重定向 `/private/tmp`）；前端 17/17 与 production build 通过；未调用真实 provider

本次交接文档创建并刷新清单后的即时检查：

- P4 current：120 files（91 tracked / 29 untracked）、`shared_core=69`、`governance=25`、`production_docs=26`、0 hold、0 staged
- `git diff --check`：通过
- `git diff --cached --check`：通过
- 暂存区：空
- 主仓库 HEAD 与远端一致
- GEARS v2 `make check` 在显式 fake keys 下通过：mypy 76 files、pytest 291、前端 17、build、Ruff format 96 files；真实 provider 未调用

## 6. 下一阶段开发计划

### P0.1：GEARS workbench 操作面与 execution worker 命名（本轮已完成）

本轮已完成 capability、独立 env、前端操作面、独立导入审计、并发幂等、人工 Recipe 升级、零信用门禁和双仓 E2E。

1. Story Agent workbench UI 与 GEARS 人工升级 UI 均已建立，并明确不与 execution worker ledger 混排
2. execution worker 新旧 env 的优先级、legacy warning、readiness/MCP/acceptance shell 兼容均已建立
3. 独立导入 audit 已建立并在双仓 E2E 中验证 3 条事件、真实信用 0
4. 相同 key 数据库并发和 draft → Recipe 真实视觉版本选择已由自动化覆盖
5. 独立 execution worker endpoint 仍不存在；后续只能等待真实 `/gears/jobs` submit/status/callback 合同，不得让 workbench capability 代替 worker readiness

P0.1 验收：两类连接器在类型、配置、readiness、审计和 UI 文案中已分离；真实本地 GEARS v2 workbench E2E 通过，但真实回片计数仍为 0。

### P0.2：等待并验收独立 execution worker

内部可准备项已完成：独立 capability schema、强制 submit/status 前握手、系统探测接口、acceptance shell capability 证据与 legacy env 兼容均已有自动化。以下仍全部依赖外部执行方：

1. GEARS/Seedance 执行方提供与 `/gears/jobs` submit/status/callback 合同一致的独立 endpoint
2. 用 `GEARS_EXECUTION_WORKER_*` 运行真实 acceptance shell，旧变量仅验证迁移兼容
3. 保存真实 provider 响应、任务状态、callback、公共或可审计媒体 URL 和失败分类
4. 只有外部真实产物与证据链完整时才推进 0/5；workbench 项目、草稿、Recipe 仍不计数

### P1：完成轨道 A 的真实外部 3%

1. 接入真实 IdP 登录、session 签发、刷新、撤销和密钥轮换
2. 人工确定 949 个 legacy resource 的 owner；复核 manifest hash
3. 在生产 gate 下执行不可覆盖、可审计、可恢复的 ownership migration
4. 部署外部 audit archive、retention、监控、告警与恢复演练
5. 用真实新用户完成“五分钟建立首个项目”测试
6. 用六类真实角色执行 workflow UAT，并保留真人签署证据

P1 验收：机器 Track A 97% 不再替代真实身份和用户验收；所有剩余项有可验证的外部证据。

### P1：平台可靠性与第二领域证明

内部机器切片已完成：`original_fiction` 已验证 registry、生成、修订、版本、质量、交付与跨仓 workbench 导入；嵌入式 SQLite provider 已验证完整性、CAS、备份和恢复等价；两个生产 Domain Pack 已拥有各自修订提示和写前安全复验；legacy 安全 inventory 与显式 append-only 迁移执行器已建立；file→SQLite 全历史 dry-run、空库事务导入、非覆盖发布、logical SHA 等价和审计重放合同已建立；Story storage root 已统一解析、生产 fail closed，并把误解析 legacy 根隔离为只读 discovery。以下仍待完成：

1. `knowledge_writeback` 目标硬编码已完成抽离；继续审计并抽离 project-service/route 中剩余的 china-culture 隐式依赖
2. 人工逐项复核 20 个 migration candidate 的 source domain/entry/version/SHA，修复 2 个 blocker 后再在专用 write gate 与 durable audit 下执行；不得批量自动 apply
3. 用真实模型、授权提案和真人审稿验证第二领域，不把 local-only 机器故事当作真实样板
4. 增加外部生产数据库与对象存储 provider；SQLite 只算嵌入式 provider，不冒充 PostgreSQL/对象存储
5. 由操作者确认真实迁移目标、source logical SHA 与切换窗口后，才可在专用 write gate/audit 下执行 file→SQLite；当前 apply 0，不得自动切换 active provider
6. 进行真实进程 kill/断电恢复、并发写、WAL 重放、生产备份与恢复演练
7. 增加生产迁移兼容 E2E、对象校验和恢复时间/数据丢失指标
8. 26 个 legacy Project 的机器逐项只读 preflight 已完成；下一步由操作者复核 ownership、版本/内容、同来源标题候选与元数据等价组，签署保留/迁移/归档清单；当前不得自动搬运、合并、删除、覆盖或写回

P1 验收：第二领域真实模型产出经真人验收且可读取、可修订、可交付；外部存储与恢复演练有生产日志和可重复步骤。

### P2：专业文本与真实证据闭环

1. 用户提供/授权至少 3 个真实样板的业务目标、渠道、权利材料和成本上限
2. 配置真实模型 provider/model/凭据，记录调用账单、模型版本、输入输出 lineage
3. 每个样板至少完成两轮真实模型修订，并区分机器建议与实际采纳
4. 组织编剧/剧本编辑、类型导演/制片、事实/文化三组真人评审
5. 完成 15 个专业包与 45 次真人盲审目标；不以自动评分替代
6. 将 GEARS workbench 的真实分镜资产与 Seedance/媒体 provider 的真实回片证据分开归档
7. 由独立 release authority 签署可持久验证的 release

P2 验收：真实计数只由 provider evidence、真人签名、公共或可审计 artifact 和独立 release authority 推进。

### P2：知识库 M2 与真人验收

1. 完成剩余 27 条 M2 机器研究/写作/校验
2. 对 M1 23 条和 M2 全部机器条目逐条做真人来源审查与文化审稿
3. 修复来源可达性、引用粒度、跨来源冲突、权利和地域表述问题
4. 只有真人结论写入正式审查 ledger 后，才推进 formal acceptance
5. 继续朝长期 800 条规模发展，但不得以数量掩盖来源质量

P2 验收：M1/M2 machine 与 human 两套计数并列报告，正式验收不再是 false。

### P3：发布运营闭环

1. 配置真实 reviewer trust policy、签名密钥和独立 release authority
2. 实施 production canary、回滚、数据恢复、SLO/告警与事件响应演练
3. 完成真实业务 UAT 与发布复盘
4. 形成可持续成本、权限、数据保留和证据归档机制

P3 验收：出现首个 durable signed release 和可复核的真实运营证据后，才允许推进发布运营真实完成度。

## 7. 新对话第一轮必须执行的顺序

先审计，后改代码：

```bash
git branch --show-current
git rev-parse HEAD
git status --short --branch
node scripts/story-agent-p4-change-review-plan.mjs --check
git diff --check
git diff --cached --check
git diff --cached --name-only
node scripts/story-agent-ci.mjs --mode local
git -C "/Users/wuyu/Desktop/gears v2" status --short --branch
git -C "/Users/wuyu/Desktop/gears v2" rev-parse HEAD
```

然后优先等待/验收 P0.2 独立 execution worker；无外部 endpoint 时推进 P1 的外部生产数据库/对象存储、第二领域真实模型/真人验收和真实恢复演练，但不得用 file/SQLite provider、local-only Story、fixture 或 workbench 数据冒充外部生产完成。每次修改后：

1. 跑最小相关单测
2. 跑 Web/MCP build 或 typecheck
3. 跑真实本地 GEARS v2 集成 E2E
4. 跑完整 Unified CI
5. 更新综合进度、P4、交接和必要报告
6. 再跑 P4 stale、`git diff --check`、cached diff 和 staged 审计
7. 每轮报告五套进度、测试证据、工作区、下一步、外部阻塞

不要在当前 99 项 P4 dirty 状态上盲目批量格式化或覆盖文件。修改前先读 P4 分组与文件 diff，保持既有用户改动。

## 8. 当前外部阻塞

- 真实 IdP、session issuer/audience/HMAC secret 托管与轮换
- 949 个遗留资源的人工 owner 分配、复核与生产迁移授权
- 外部审计归档存储、保留执行、告警和恢复环境
- 真实模型 provider/model、凭据、调用授权、预算与成本上限
- 三个真实样板的业务目标、发布渠道及人物/场地/作品权利
- 编剧/编辑、导演/制片、事实/文化三类真人评审人
- Seedance/媒体执行 endpoint、callback、secret 与真实 artifact URL
- GEARS v2 仍缺少 Story Agent execution worker 所需的 job/status/callback contract；人工升级流程已实现，但实际项目仍需操作者先生成/选择真实人物与场景视觉版本
- reviewer trust policy、签署密钥和独立 release authority
- M1/M2 真人来源与文化审查
- 生产数据库/对象存储、备份恢复和监控环境
- 20 个 legacy `domain_safety` candidate 的人工 source identity 复核与执行授权；2 个 blocked Project 的来源/可信边界修复
- file→SQLite 的真实目标路径、执行/切换授权和切换后生产备份恢复演练；当前只读 preflight 通过但 apply 0
- `/web/web/generated` 下 26 个遗留 Project 的人工 ownership、版本/内容、重复关系复核与处置授权；逐项机器 preflight 已完成，但自动迁移/合并/删除/覆盖/写回仍为 0

## 9. 建议粘贴到新对话的首条指令

```text
请阅读并严格遵循：
1. docs/story-agent-next-conversation-handoff-20260716.md
2. docs/story-agent-long-term-comprehensive-development-plan-20260713.md
3. docs/story-agent-p4-dirty-worktree-review-plan-20260712.md
4. docs/story-agent-integrated-execution-plan-20260710.md
5. docs/story-agent-new-conversation-handoff-20260712.md
6. 其中引用的知识内容扩充长期计划与 M2 批次计划。

主仓库位于 /Users/wuyu/Desktop/china-culture-kb，目标分支 codex-ai-comic-series-longform，交接 HEAD ac7deb653327bfa90d5dffe2f0f2b162b17407ae。GEARS v2 位于 /Users/wuyu/Desktop/gears v2，分支 codex/story-agent-workbench-bridge（PR base 必须为 v0.2-dev），交接 HEAD 1d772200a809ca282a73535126359949d054164b。

先执行分支/status、P4 stale、diff check、暂存区和 Unified CI 审计，保留两个 dirty worktree，不 reset、不删除、不覆盖、不自动暂存、不 commit、不 push。P0.1 的 workbench 操作面、execution worker 命名、导入审计、版本/hash 锁和 draft → Recipe 人工升级已完成；P1 的 SQLite provider、`original_fiction` 机器全链路、Domain Pack 自有 `story_revision` 与 `knowledge_writeback`、legacy `domain_safety` append-only 迁移、file→SQLite 全历史 SHA 等价/非覆盖迁移合同、单一 storage-root/生产 fail-closed，以及 26 项 legacy 逐项只读 disposition preflight 也已完成。随后优先验收外部独立 execution worker；若仍缺 endpoint，则在没有人工授权时只继续改进剩余领域硬编码、外部生产数据库/对象存储与真实恢复机制，不得自动 apply 20 个安全候选，不得搬运/合并/删除/覆盖/写回 legacy root 的 26 个 Project，也不得执行或切换 file→SQLite 真实目标。

严格保持真实计分边界：本地 GEARS v2 项目/角色/场景联通只是导演工作台工程证据，真实 GEARS/Seedance 回片仍是 0/5。每轮报告五套进度、测试证据、工作区状态、下一步和外部阻塞。
```
