# Story Agent P4 dirty worktree 分批审查计划（2026-07-12）

## 1. 结论与边界

P4 已建立机器可复核的逐文件清单和五批审查方案，但**尚未开始暂存或提交**。

- 文件级清单以 `data/reports/story-agent-p4-change-review-plan.json` 为准；它使用 `git status --porcelain=v1 -z --untracked-files=all`，不会被未跟踪目录折叠影响。
- 清单记录状态、文件大小、SHA-256、批次、归类原因；已跟踪文件同时记录基线 blob，并全部标记为需逐 hunk 人工复核。
- 报告自身从哈希清单排除，避免自引用；脚本和本文均纳入清单。
- 本轮不执行 `git add`、commit、push、删除、reset 或 paid-model 调用。
- P4 准备态不计真实修订、真人桌读、Stage 6 退出或专业通过。

知识库内容扩充长期计划加入后，清单为 441 个文件级变更：30 个已跟踪修改、411 个未跟踪文件、0 个暂存文件、0 个缺失文件、0 个待归类文件。实际数字必须由 `--check` 重新确认，不以本文代替机器报告。

## 2. 五批边界

| 顺序 | 批次 | 预期文件数 | 已跟踪重叠 | 审查重点 |
| --- | --- | ---: | ---: | --- |
| 1 | 共享合同与核心 | 26 | 22 | `web/shared`、核心服务、入口、兼容测试；逐 hunk 区分原有用户改动与 Story Agent 增量 |
| 2 | 15 片型专业管线 | 175 | 0 | 片型服务、质量、修订、benchmark、Stage 7 黄金卡链路及 Stage 8 盲评接入/评估器/签名/finalization/durable release/总控与对应测试；fixture、slot、机器阈值、验签、candidate、handoff 和 ready 只能证明合同 |
| 3 | Stage 6 | 71 | 0 | P0 输入、P1/P7 批次预检、P2/P6 工作台、P3/P8 退出审计、P9 初始包检查、P10 operator 总控、P11 桌读证据检查、P12 Ed25519 退出签名验证；真实证据门禁必须 fail closed |
| 4 | 生产卡与文档 | 101 | 0 | 生产卡、实施说明、长期蓝图和浏览器核验截图；文案不得夸大通过状态 |
| 5 | 治理与 MCP | 68 | 8 | 历史治理、报告、manifest、MCP、CI workflow、ignore 规则和维护脚本；软归档保持可逆、猜测补链保持 0 |

表中 441 个文件包含本文，排除机器报告自身。任何路径变化后均应以重算报告覆盖表中预期值。Playwright 临时会话目录已加入 `.gitignore`，正式浏览器证据只保留在 `output/playwright/`。

## 3. 首轮实质审查结果

本轮完成机器全量检查和风险定向人工审查，仍不等于提交前的最终逐 hunk 签署。

### 批次 1：共享合同与核心

发现并修复两项：

1. `story-generation-model.ts` 曾在非测试环境自动发现 bundled bridge；这可能在没有显式 operator 授权时启动外部模型。现已恢复为只有明确配置 `STORY_GEN_COMMAND` 才启用外部 adapter，未配置时固定 `local_only`、`used_fallback=false`。
2. `StoryPlanRequestSchema` 接受 `original_user_query`，共享 TypeScript 接口却缺少该字段；现已补齐，避免 schema 与静态合同漂移。

新增生产环境无显式 opt-in 不调用桥接的回归测试；批次重点测试 10 个文件、137 个用例通过。

### 批次 2：15 片型专业管线

- 15 片型质量器和修订器均保持机器候选 `professional_passed=false`。
- benchmark 拒绝 fallback、fixture 和 simulation 信用；黄金卡仍为 `pending_human_review`。
- Stage 7 审稿接入按风险级别要求三角色实名材料，双 SHA-256 绑定源文件与卡片；完整测试输入也只产生 approval preflight，不授予人工通过或晋升。
- Stage 7 候选补齐把12个缺失片型的60个固定项目绑定为 template slot，并绑定 benchmark/Profile 哈希；槽位和完整 fixture 不计候选卡、人工通过或晋升。
- Stage 7 审稿签名验证把review/card/source哈希与风险角色、仓库trust policy和Ed25519绑定；有效签名fixture仍不计真实签名、人工批准或晋升。
- Stage 7 材料运营总控把12个片型覆盖任务、30张黄金卡审稿任务和9个Domain Pack任务归并为51个唯一外部NEXT；五泳道均保持 `blocked_external_input`，内存 handoff 不落盘、不执行、不批准、不晋升。
- Stage 8盲评接入把15份benchmark、75个唯一项目与终稿、授权基准、匿名随机化、三类独立评审和排期门禁绑定；75项模板均为preparation，ready、真人盲评和专业通过信用为0。
- Stage 8评估器v2把15片型分别绑定中央权重快照、唯一合同SHA-256和artifact/finalization复核；机器score threshold明确不计真人盲评，权重共享引用篡改已加固。
- Stage 8签名检查把v2 bundle、服务端decision、权重合同、三角色reviewer/key和Ed25519绑定；空trust策略与有效签名fixture均不计真实签名、真人通过或signed release。
- 35 个专业测试文件、282 个用例通过；未发现误计真实项目或专业通过的路径。

### 批次 3：Stage 6

加固退出审计：修订包内容 SHA-256 与账本不一致时，同时使 immutable-artifact 和 package-chain 检查失败；退出候选显式要求 blocker 为 0。P12 进一步把三角色外部退出复核绑定到固定 trust policy、当前 P3 审计哈希与 Ed25519 canonical payload，且只开放只读 workspace 和内存验证。有效签名 fixture 只证明密码学合同，不计真实签署。P0–P12 均不调用模型，写入/签署/执行端点保持不存在。

### 批次 4：生产卡与文档

23 个 JSON 全部可解析。命中的 `approved` 只存在于明确标记 `simulation_only=true` 的治理演练场景；未发现把准备态写成真实人审、真实修订或专业通过的文案。

### 批次 5：治理与 MCP

6 个治理报告 JSON 全部可解析，治理 stale-check 通过。软归档仍为可逆、删除 0、安全自动 relink 0、猜测 relink 0；GEARS `local_acceptance_ready=5` 与 `external_ready=0` 保持分离。

最终逐 hunk 签署和任何暂存操作仍待明确授权；本节不能作为 `git add` 或 commit 许可。

## 4. 人工审查流程

每批都按以下顺序执行；在用户明确授权暂存或提交前，只执行前四步。

1. 运行 `node scripts/story-agent-p4-change-review-plan.mjs --check`，确认报告未 stale、`staged_file_count=0`、`hold_file_count=0`。
2. 从报告按 `batch` 过滤路径。已跟踪修改逐文件运行 `git diff -- <path>`；不得用整文件替换消除不理解的 hunk。
3. 对未跟踪文件检查内容、引用关系、fixture/provenance 标签和是否包含运行产物、凭据、个人信息或伪造签署。
4. 运行该批在报告中声明的 `validation_commands`；失败时修复并重算清单，不带失败进入下一批。
5. 只有获得明确授权后，才按已审路径小批量暂存；暂存后再次查看 `git diff --cached --stat` 和 `git diff --cached`。
6. 每批提交必须独立、可回滚、可说明，不能把五批压成一个大提交；提交前后都跑对应验证。
7. 五批全部通过后运行报告中的 `final_validation_commands`，确认全量测试、构建、lint、stale-check、`git diff --check` 和暂存状态符合当次操作目标。

## 5. 重叠风险规则

30 个已跟踪修改默认视为用户改动与当前 Story Agent 工作可能重叠，不能仅凭文件名自动归属。特别关注：

- `web/shared/types.ts`、`web/shared/schemas.ts`：共享合同变化影响服务、客户端和旧项目兼容。
- `web/server/src/index.ts`、核心 service 与大型既有测试：可能包含多轮工作，必须逐 hunk 判断。
- `web/client/src/App.vue`、`router.ts`、`StoryStudio.vue`：Stage 6 导航增量与原界面改动可能同文件共存。
- MCP readiness/health/governance 文件：专业文本指标与历史治理指标必须保持分轨，不互相抬高。

机器归类只决定审查顺序，不证明作者、意图、提交归属或可安全暂存。

## 6. Stage 6 与质量口径

P4 不解除任何外部阻断。当前仍必须保持：

- 15/15 intake 项目 `blocked`，Round 1 可执行 0/15。
- 已记录真实修订轮次 0，已核验真实修订轮次 0，退出复核候选 0。
- 专业文本包通过 0/15，真人盲评通过 0/45，黄金素材卡人工通过 0/75。
- operator template、readiness、fixture、simulation、fallback、prepared ledger、UI 草稿和机器候选均不计真实修订或专业通过。

## 7. 复核命令

```bash
node scripts/story-agent-p4-change-review-plan.mjs --write
node scripts/story-agent-p4-change-review-plan.mjs --check
node -e 'const r=require("./data/reports/story-agent-p4-change-review-plan.json"); console.log(r.summary, r.gate)'
git diff --check
git diff --cached --name-only
```

`--write` 会重建报告但不暂存文件；`--check` 只比较当前工作区与报告内容。若 `--check` 报 stale，应先审查变化来源，再重写报告，不能为了通过检查而覆盖不理解的改动。

## 8. 2026-07-13 当前分支最终复核

### 8.1 旧 P4 快照与当前 HEAD 的关系

当前分支为 `codex-ai-comic-series-longform`，`HEAD` 与上游均为 `25fce2bf38c86b9c6b46a35f8aae69f9822b8c74`，ahead/behind 为 `0/0`。该提交由用户现有版本历史提供，本轮没有执行暂存、commit 或 push。

旧报告的 441 文件已经不再是当前 dirty worktree：

- 441/441 路径全部存在于 `568474ab..25fce2bf` 的提交差异中。
- 报告记录的 441 个 SHA-256 与 `25fce2bf` 中对应文件逐一一致，漂移数为 0。
- 该提交比旧报告多 17 个文件，主要是 M1 首批知识内容、内容供给报告、长期总纲和报告自身。
- 因此旧报告对当前工作树为 stale，但它仍是该提交内五批内容的有效不可变审查快照。

### 8.2 五批最终结论

| 批次 | 最终复核 | 证据 | 结论 |
|---|---|---|---|
| 1 共享合同与核心 | 22 个已跟踪重叠文件逐 hunk 风险项沿用第 3 节结论；共享 schema、路由、生成和项目兼容由全量 Web 测试覆盖 | `web npm run check` 通过；授权环境 82 文件、806 用例通过；Web build 通过 | 未发现新的阻断；外部模型仍要求显式 opt-in |
| 2 15 片型专业管线 | 175 个文件的机器信用、人工信用和 release 边界复核 | 15/15 片型合同；Stage 8 五条检查通过；全量 Web 测试通过 | fixture、阈值、验签和 candidate 仍为零信用 |
| 3 Stage 6 | 71 个文件的输入、两轮修订、退出审计和签名验证复核 | P0/P1/P3 `--check` 全部通过；真实轮次 0、退出候选 0、professional pass 0 | 外部输入仍 fail closed，没有新增执行或签发权限 |
| 4 生产卡与文档 | 101 个文件的 JSON、准备态文案和浏览器证据复核 | 23 个 JSON 可解析；Web build、知识库 lint 和 `git diff --check` 通过 | `approved`/ready 仅存在于明确排除信用的演练或模板语境 |
| 5 治理与 MCP | 68 个文件的软归档、断链、真实外部交付和 MCP 摘要复核 | MCP 79 文件、345 用例和 build 通过；治理 stale-check 通过；知识库 lint 通过 | 删除 0、猜测 relink 0、`external_ready=0/5`，local acceptance 未混入真实交付 |

五批审查至此完成；它不构成重新暂存、重写历史或拆分既有提交的授权。

### 8.3 当前 dirty worktree 的新边界

当前未提交变化已经转为知识内容扩充和本轮 Phase 0/Phase 1 状态文档，不再是旧 441 文件的 Story Agent 大型代码集合。其 hold 原因如下：

- M1 的 23 条内容已经写入并通过 lint/audit/固定检索，但真人来源与文化审稿仍为 0/23，机器完成不得写成 M1 正式验收完成。
- 25 条旧内容的生产字段修复只提高机器字段覆盖，不代表事实复审或黄金资产晋升。
- M2 当前只允许继续候选与来源研究；在 M1 人审阻塞关闭前，不得用新增数量抬高人工完成口径。
- 三个真实样板只完成候选、CreativeBrief 和验收草案，真实业务授权、预算、模型、评审者和外部 endpoint 均未到位。
- 所有当前变化保持 unstaged；在并发内容写入稳定后，以 `node scripts/story-agent-p4-change-review-plan.mjs --write` 重建实时清单，再运行 `--check`。

### 8.4 2026-07-14 再复核

2026-07-14 10:05 CST 已按当前工作树重写 `data/reports/story-agent-p4-change-review-plan.json`。新报告显示：

- 报告排除自身后，当前 dirty worktree 为 51 个文件级变更：47 个已跟踪修改、4 个未跟踪文件、0 个 staged。
- `hold_file_count=34`，`production_docs=9`，`governance=8`；没有新的 `shared_core`、`professional_formats` 或 `stage6` 代码路径进入当前 dirty worktree。
- `git status --short | wc -l` 为 52，差值 1 来自被报告排除的 `data/reports/story-agent-p4-change-review-plan.json` 自身。
- P4 stale-check 已从“过期”恢复到与当前工作树一致，但 `review_plan_ready` 仍为 `false`，原因是 34 个 province/report 路径仍需人工分批归属，且所有已跟踪修改未来仍必须逐 hunk 复核。

本轮还发现并修正一个五套进度口径漂移：`data/reports/knowledge-base-content-supply-progress.json` 已记录 M2 机器写入/校验 30/97、正式条目 222 条，而 `data/reports/story-agent-comprehensive-progress.json` 仍停留在 5/97、197 条。现已按现有源报告同步；这只修正机器统计，不增加任何真人审稿、真实交付或 professional pass 信用。

### 8.5 34 个省级 hold 的逐批归属与当前 SHA 边界

2026-07-14 12:15 CST 已对当前 34 个 `data/provinces/*.md` 差异执行结构化逐 hunk 复核，并将其确定性归入原 P4 第 4 批“知识条目、生产卡、实现文档与长期蓝图”。这不是新增 Stage/P 准备层，也不构成真人内容审稿或未来暂存授权。

| 审查子批 | 当前差异 | 结构结论 | 信用边界 |
|---|---:|---|---|
| M1 后续写入 | 18 个新增条目 | 与 `batch_2_entries` 至 `batch_5_entries` 完整对应，无未知或缺失标题 | 仅机器写入/校验；M1 真人来源与文化审稿仍为 0/23 |
| M2-1A/1B | 10 个新增条目 | 与内容供给报告两批 10/10 对应 | 不计黄金卡、真实故事、外部 artifact 或 professional pass |
| M2-2A/2B | 10 个新增条目 | 与内容供给报告两批 10/10 对应 | 同上，真人审稿仍为 0 |
| M2-2C/2D | 10 个新增条目 | 与内容供给报告两批 10/10 对应 | 同上，真人审稿仍为 0 |
| M1 质量尾项 | 25 个既有条目追加“创作边界补充（非知识事实）” | 未改写原事实段，只补可戏剧化空间、对白口吻、禁用表达、安全/授权边界 | 仅机器字段覆盖，不计事实复审或黄金资产晋升 |

当前 34 文件总计新增 6621 行、删除 0 行；新增条目 48、删除或改名条目 0。48 个新增标题全部能在 M1/M2 内容供给批次中一一找到，未知新增 0、计划缺失 0；来源数量或机器生产卡阈值低于当前批次门槛的条目均为 0。来源索引变化均由新增条目引用带入。

`scripts/story-agent-p4-change-review-plan.mjs` 现将 `data/provinces/` 明确归入第 4 批；报告仍保存每个文件的 SHA-256，并要求所有 tracked 文件未来逐 hunk 复核。因此本次重写报告后，34 个“未归属 hold”可归零；若任一文件继续变化，`--check` 会立即 stale，必须重新审查新差异。`review_plan_ready=true` 只表示“无未归属文件、无 staged、无缺失文件”，`staging_authorized=false` 与 `commit_authorized=false` 保持不变。

### 8.6 2026-07-15 轨道 A 权限切片复核

当前分支和 HEAD 仍为 `codex-ai-comic-series-longform` / `25fce2bf38c86b9c6b46a35f8aae69f9822b8c74`。在不暂存、不提交、不推送的边界内，轨道 A 已完成五入口、受控二级入口、统一项目状态机、唯一主 NEXT、六角色视图和五条 Playwright 路径，并进一步补齐服务端访问控制基础：

- 生产环境默认要求服务端 hash-only 身份注册表；请求角色头不受信任，撤销账号和缺失权限均 fail closed。
- Stage 6–8、模型生成、项目写入、素材审稿和生产操作按角色权限与 `internal_story_tools` feature flag 双重隔离。
- GEARS/Seedance 外部回调统一使用机器密钥；生产环境缺密钥返回 503，错误密钥返回 401，不接受产品角色头替代机器鉴权。
- 这些结果只证明机器实现与测试合同，不代表真实登录系统、真实用户验收、真实回片、真人审核、signed release 或 professional pass。

本轮 Unified CI 21/21 通过：Web 86 个测试文件、830 个用例，Track A Playwright 5/5，MCP 79 个测试文件、345 个用例，Web/MCP build、知识库 lint、治理检查、P4 stale-check 和 `git diff --check` 均通过。P4 报告排除自身后记录 89 个文件级变化：`shared_core=31`、`professional_formats=2`、`stage6=1`、`production_docs=43`、`governance=12`，hold 0、staged 0。报告本身仍是第 90 个工作区状态项；所有已跟踪差异仍需未来逐 hunk 复核，且没有产生暂存或提交授权。

### 8.7 2026-07-15 项目资源所有权与持久化审计复核

轨道 A 在角色权限之上新增项目资源边界：单片项目、故事详情和漫剧系列按 `organization_id + owner_actor_id + member_actor_ids` 授权，同组织管理员可管理组织资源，跨组织或非成员访问返回 403；required 模式下没有有效绑定的旧项目同样 fail closed。新建单片和系列把 ownership 写入项目元数据，旧项目可由 hash-only 服务端注册表的 `resource_bindings` 显式迁移；注册表与存储 ownership 不一致时拒绝访问，不猜测归属。项目、故事和系列列表只返回当前 actor 可访问的资源。

生产环境现默认要求持久化访问审计：没有 `STORY_AGENT_ACCESS_AUDIT_JSONL` 或目标不可写时，已认证的允许请求返回 503；审计记录包含权限、资源类型、资源 ID、组织和决定，但不包含 token 或 token hash。Playwright required 模式同时启用资源绑定和持久化审计路径，5/5 核心路径通过。

本轮 Unified CI 再次 21/21 通过：Web 86 个测试文件、838 个用例，MCP 79 个测试文件、345 个用例，构建、lint、Stage 6–8 零信用门禁、治理和 P4 检查均通过。P4 报告排除自身后为 92 个文件级变化：`shared_core=34`、`professional_formats=2`、`stage6=1`、`production_docs=43`、`governance=12`，hold 0、staged 0。该结果仍是机器实现证据；没有增加真实修订、真人审核、真实回片、signed release 或 professional pass。

### 8.8 2026-07-15 signed session 与资源迁移审计复核

轨道 A 在 hash-only 静态注册表兼容层之上新增外部 session 验签合同：`sa1` session 固定校验 issuer、audience、HMAC-SHA256 签名、签发时间、到期时间和最长 24 小时 TTL，actor 的组织、角色、状态与 feature flag 仍只由服务端注册表决定。生产环境默认拒绝静态注册表 token；即使启用紧急逃生开关，production readiness 仍保持 blocked。该能力是服务端验签，不等于真实身份提供方、登录页面或真实用户 UAT 已完成。

项目资源侧新增管理员受控的只读 ownership inventory 与迁移 manifest。扫描会区分 stored-only、注册表托管旧资源、未绑定、冲突、无效元数据和孤儿绑定；无效或冲突元数据访问 fail closed。manifest 明确 `automatic_owner_assignment=false`、`writeback_performed=false`，不会根据目录、创建时间或当前登录者猜测历史 owner。

对当前 `web/generated` 的真实只读扫描发现 949 个项目资源，`access_enforcement_ready=0`、`unbound=949`、冲突/无效元数据/孤儿绑定均为 0，因此生产迁移仍被 949 项人工 owner 分配与复核阻塞。本轮没有写回任一项目元数据。

刷新 P4 后，报告排除自身仍为 92 个文件级变化：70 个 tracked、22 个 untracked，`shared_core=34`、`professional_formats=2`、`stage6=1`、`production_docs=43`、`governance=12`，hold 0、staged 0。受控环境 Unified CI 21/21 通过：Web 86 个测试文件、841 个用例，Track A Playwright 5/5，MCP 79 个测试文件、345 个用例，构建、知识库 lint、零信用门禁、治理、P4 stale-check 和 `git diff --check` 均通过。测试 session、只读 inventory 和迁移 manifest 只计机器证据，不计真实登录、真人审核、真实回片、signed release 或 professional pass。

### 8.9 2026-07-15 资源归属受控迁移执行合同

949 项只读迁移清单现已连接到受控写入合同，但写入默认保持关闭。单项迁移必须同时提供显式人工复核引用、`ownership_reviewed` 确认、原 metadata SHA-256 和服务端注册表中同组织的 active owner/member；执行 actor 必须是带内部 feature flag 的管理员。已有 ownership 无论内容是否相同均禁止由新 migration ID 覆盖，注册表绑定不一致、metadata 变化、无效 JSON、跨组织 actor 或外部并发 lock 均 fail closed。

非 dry-run 还要求 `STORY_AGENT_RESOURCE_MIGRATION_WRITE_ENABLED=true` 与绝对、可写、非 symlink 的专用 JSONL 审计路径。执行先持久化 intent，再原子替换 metadata，最后记录 applied；项目 metadata 保存 migration ID、operator、review reference 和迁移前 SHA。相同 migration ID、review reference 和 ownership 可安全幂等 replay。并发测试确认其他 operator 创建的 lock 不会被失败请求删除。

所有 apply、CAS、并发和 replay 测试只使用临时目录；当前 `web/generated` 的 949 个资源仍为 `migrations_applied=0`，生产写入开关未启用。受控环境 Unified CI 21/21 通过：Web 86 个测试文件、843 个用例，Track A Playwright 5/5，MCP 79 个测试文件、345 个用例；P4 排除自身为 93 文件、hold 0、staged 0。该执行合同不替代 949 项真实人工 owner 决定与复核，也不授予真人审核、真实回片、signed release 或 professional pass 信用。

### 8.10 2026-07-15 客户端 session 生命周期与登录 handoff

客户端现于受控路由进入前同步服务端 access context；任何 API 返回 `ACCESS_UNAUTHENTICATED` 都会清空缓存 actor 并进入 `AccessRequired`，而不是继续使用页面角色或旧权限。登录目标只从公开的服务端 handoff 合同读取，生产 readiness 要求 login URL 有效；`return_to` 仅接受规范化站内路径，并拒绝绝对 URL、双斜线、反斜线、控制字符和编码后的双斜线。session cookie 合同固定为 HttpOnly、SameSite=Lax，并要求生产 Secure。

第六条 Playwright 路径在已打开的生产工作区中清除 session，触发一条显式预期的 401，验证页面进入登录 handoff；重新写入受控测试 session 后恢复原“修订与桌读”任务。测试框架分别追踪预期 401/浏览器日志与意外 API/控制台错误，避免把真实异常静默忽略。当前浏览器 E2E 为 6/6，Web 全量为 86 文件、844 用例。

`STORY_AGENT_LOGIN_URL=/auth/login` 和 Playwright cookie 仅用于合同与失败态验证，不代表外部身份提供方、真实登录、账号生命周期、撤销同步或真人 UAT 已完成，也不增加任何真实创作、评审、交付或发布信用。受控环境 Unified CI 21/21 通过；P4 排除自身为 95 文件、hold 0、staged 0。

### 8.11 2026-07-15 持久化访问审计生命周期

生产就绪现要求持久化审计除绝对可写路径外，还必须配置 `size_external_retention`、有效最大文件字节数和外部保留天数。每次追加先获取专用排他轮转锁；超过阈值时把当前 JSONL 原子改名为带时间戳和 UUID 的归档，再建立新的 active 文件。应用不包含归档删除逻辑，保留期只作为外部归档服务的显式合同，避免本地清理误删合规证据。

审计路径、生命周期配置、轮转锁或追加任一不可用时，required/production 模式下原本允许的请求返回 503。外部 operator 或 archiver 已持有的锁不会被失败请求删除。新增测试覆盖非法模式/阈值/保留期阻断 production readiness、跨六条审计事件轮转、归档全量保留、secret/hash 不落盘，以及外部锁失败关闭；定向服务端测试 26/26、Track A Playwright 6/6 通过。

该切片完成后的 Unified CI 21/21 通过：Web 86 个测试文件、846 个用例，MCP 79 个测试文件、345 个用例，Track A Playwright 6/6，Web/MCP build、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和 `git diff --check` 均通过。该切片没有部署真实归档存储、保留任务、监控告警或恢复演练，production lifecycle 环境值仍需 operator 配置。因此综合研发保持 73%、轨道 A 机器实现保持 97%、发布运营保持 60%；真人审核、真实修订、真实回片、signed release 和 professional pass 均不增加。

### 8.12 2026-07-15 actor 级 signed-session 撤销

服务端 hash-only actor registry 现接受可选的 `session_not_before` epoch 秒。signed session 在完成 HMAC、issuer、audience、签发/到期和最长 TTL 校验后，还必须解析到 active registry actor；`issued_at` 早于该 actor 截止点时返回 401 `signed_session_revoked`，恰好等于截止点时允许继续。该字段不进入公开 actor/context，非法负数、非整数或非数值使 registry 整体失效并 fail closed。

该机制用于 operator 通过受控配置撤销 actor 的既有 session，不改变非生产兼容静态 token 的语义，也不信任 session 中的角色、组织或 feature flag。定向服务端测试 28/28 和 Web 两端类型检查通过，覆盖旧 session、时间边界、兼容 token、非法配置与公开响应零泄露。

registry 截止点只证明本地服务端撤销合同，未证明真实 IdP 已发布撤销事件、生产配置已更新、密钥已轮换或用户端 UAT 已完成。该切片完成后的 Unified CI 21/21 通过：Web 86 个测试文件、848 个用例，MCP 79 个测试文件、345 个用例，Track A Playwright 6/6，构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 与 diff check 全通过。综合研发保持 73%、轨道 A 机器实现保持 97%、发布运营保持 60%，所有真实创作、审核、回片与 release 信用保持 0。

### 8.13 2026-07-15 ProjectRepository 首个文件 provider

轨道 G 从 11,456 行 `project-service.ts` 抽出首个可替换的 `ProjectRepository` 合同及文件 provider，并把初始项目创建、项目元数据读取、项目 ID 列举、版本列举/读取、版本提交和版本快照写回接入该边界。现有路由、共享类型、ownership 持久化和 source-story 迁移入口保持兼容，尚未接管的生产板/素材/回片元数据写入仍留在兼容服务中，避免一次性重写大型 dirty 文件。

文件 provider 对项目和版本 ID 做路径约束，拒绝 traversal 与 symlink 项目目录；JSON 写入使用同目录临时文件和原子 rename，项目级排他锁保护 writer，版本提交使用 `current_version_id + version_count` 做乐观并发检查。stale writer、外部 lock 或不安全目录均 fail closed，外部 lock 不会被失败请求删除。旧的不可读 `project.json` 兼容自愈仍保留，但会先将损坏文件无删除归档，再从 source story 原子重建。

定向 repository/project-service 回归为 2 文件、62 用例通过，Web 两端类型检查通过。完成后的 Unified CI 21/21 通过：Web 87 个测试文件、853 个用例，MCP 79 个测试文件、345 个用例，Track A Playwright 6/6，构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 与 diff check 全通过。P4 分类规则同步把 `web/server/src/repositories/` 纳入共享合同与核心批次；报告排除自身为 97 文件、hold 0、staged 0。

该切片只建立文件型存储边界与并发语义，不代表 PostgreSQL、对象存储、完整事务、备份恢复或多人协作已经完成；综合研发保持 73%、专业文本 47.5%、真实 GEARS/Seedance 0/5、发布运营 60%，所有真人和 signed release 信用保持 0。

### 8.14 2026-07-15 项目状态写入统一经过 repository

`project-service.ts` 中剩余直接写 `project.json` 或当前版本 JSON 的路径已全部迁入文件型 `ProjectRepository`。素材库、素材批量导入/上传/复用、Seedance shot 与 provider queue、GEARS job ledger/callback、生产就绪自动化、Production Board/当前版本导出、知识补充任务和当前 GEARS delivery/webhook/video 状态不再绕过 repository。单文件继续使用同目录临时文件和原子 rename；元数据与当前版本成对更新时持有同一个项目锁，并以原 `current_version_id + version_count` 拒绝 stale writer。该语义不是跨文件数据库事务，断电后的完整恢复仍待后续 provider/WAL 设计。

定向回归首次暴露生成响应后的 webhook 状态后台写入会与临时 root 清理竞态。修复后，未配置 webhook 的 `skipped` 状态在 API 返回前完成本地落盘；配置真实 webhook 时仍异步，但显式捕获请求当时的 generated root，后续环境变化不会把项目、source story 或 webhook failure log 写到另一个 root。新增测试验证 failure log 的 captured root，ownership 生成用例不再出现 `ENOTEMPTY` 清理竞态。

定向 repository、project-service、API、access 和 webhook 回归为 5 文件、273 用例通过，Web 两端类型检查通过。完成后的 Unified CI 21/21 通过：Web 87 个测试文件、854 个用例，MCP 79 个测试文件、345 个用例，Track A Playwright 6/6，构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 与 diff check 全通过。P4 排除自身为 99 文件（74 tracked、25 untracked），shared_core 41、hold 0、staged 0。

综合研发保持 73%、轨道 A 97%、专业文本 47.5%、真实 GEARS/Seedance 0/5、发布运营 60%；fixture、机器测试与本地存储协调不增加真人审核、真实回片、professional pass 或 signed release 信用。

### 8.15 2026-07-15 文件 provider WAL 与确定性恢复

`create_initial`、`commit_version` 和 `write_current_state` 三类成对写入现使用 `story-agent-project-repository-transaction/v1`。repository 在修改 snapshot/meta 前，先把包含 transaction ID、操作类型、版本期望、前态 SHA-256、目标 SHA-256 和目标数据的 intent 以临时文件写入、`fsync` 并原子 rename；随后逐个持久化 snapshot 与 meta，最后把 `.intent.json` 原子改名为 `.applied.json`。applied 记录和损坏/陈旧归档均不由 repository 删除。

读写进入项目时会检查 pending intent。恢复只接受文件处于记录的前态或目标态；snapshot 已写而 meta 未写、两者均已写但 intent 未标 applied 等中间状态可幂等重放。intent 内容与目标哈希不符、文件出现未记录第三态、transaction 目录为 symlink 或记录格式非法时均 fail closed。锁文件记录 PID、主机、时间和 nonce；仅同主机且 PID 已不存在的受控锁会被无删除归档，当前进程、其他主机、空白或外部自定义锁不会自动移除。

故障注入在 snapshot 后中断写入，并由新 repository 实例在带死进程锁的条件下恢复；另一测试篡改 intent 目标但不更新哈希，确认恢复拒绝且 intent/原 meta 保留。定向 repository、project-service、API、access 和 webhook 回归为 5 文件、275 用例通过，Web 两端类型检查通过。完成后的 Unified CI 21/21 通过：Web 87 个测试文件、856 个用例，MCP 79 个测试文件、345 个用例，Track A Playwright 6/6，构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 与 diff check 全通过。

这是机器级文件恢复合同，不是断电测试、备份恢复或灾难演练，综合研发保持 73%、发布运营保持 60%，所有真实交付和人工信用保持 0。

### 8.16 2026-07-15 metadata-only 乐观并发

项目级排他锁此前只能避免物理同时写，无法阻止两个请求先后读取同一前态、排队后由后写者静默覆盖先写者。文件 provider 现为 metadata-only 写入增加 `updated_at + current_version_id + version_count` 期望；进入锁后重新读取当前 meta，任一前态字段不一致即抛出 `PROJECT_WRITE_CONFLICT`。`project-service.ts` 中素材、Seedance、GEARS ledger、生产自动化和导出等所有 metadata-only writer 均传入其原始 project 前态，轮询循环也在重建 `currentProject` 前单独保存 expectation。

统一 error handler 把 repository conflict 稳定映射为 HTTP 409 API envelope，而不是 500；路径/标识非法仍为 400。repository 测试确认第一个 metadata writer 成为 winner 后，持有相同期望的 stale writer 被拒绝且 winner 保留，并验证 409 的错误码和文案合同。定向 repository、project-service、API、access 与 webhook 回归为 5 文件、276 用例通过，Web 两端类型检查通过。完成后的 Unified CI 21/21 通过：Web 87 个测试文件、857 个用例，MCP 79 个测试文件、345 个用例，Track A Playwright 6/6，构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 与 diff check 全通过。P4 排除自身为 100 文件、hold 0、staged 0。

该切片证明机器并发语义，不代表真实双用户协作、冲突解决 UI 或生产数据库事务已经验收。综合研发保持 73%、轨道 A 97%、专业文本 47.5%、真实 GEARS/Seedance 0/5、发布运营 60%，所有真实人工和发布信用仍为 0。

### 8.17 2026-07-15 文件型 ArtifactStore 首切片

轨道 G 新增可替换的 `ArtifactStore` 合同和文件 provider，并把 Seedance 本地上传、本地 SVG 占位参考卡、Production Board JSON/Markdown/manifest 导出三类直接落盘接入统一边界。调用端必须显式选择 `forbid` 或 `replace`：随机上传文件禁止覆盖，固定占位卡和固定导出文件允许显式替换。原有相对路径、绝对文件路径、MIME 和字节数返回合同保持不变。

文件 provider 在任何写入前拒绝绝对路径、traversal、反斜线、控制字符、重复 batch 目标、symlink 父目录和 symlink/非普通文件目标；文件先以 `0600` 在目标同目录独占创建，写入并 `fsync` 后再原子发布，随后同步父目录。默认禁止覆盖使用 hard-link 发布避免检查与 rename 间静默覆盖；显式替换才使用原子 rename。batch 会在第一笔写入前校验全部路径，但逐文件持久化，不声明跨文件事务。

新增测试覆盖文本/二进制、SHA-256/字节数、显式覆盖、batch 预校验与重复目标、路径穿越、符号链接、外部文件不变及统一 400/409 错误合同；定向 ArtifactStore/项目服务回归为 2 文件、63 用例，服务端全量为 88 文件、863 用例。完成后的 Unified CI 21/21 通过，MCP 79 文件、345 用例，Track A Playwright 6/6，构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 与 diff check 全通过。P4 排除自身为 102 文件（75 tracked、27 untracked），`shared_core=44`、hold 0、staged 0。

该切片没有部署对象存储、CDN、备份恢复或真实媒体资产，也没有把 batch 提升为数据库事务。占位文件、本地上传、hash、测试与导出均不计真实 GEARS/Seedance 回片或 professional pass；综合研发保持 73%、专业文本 47.5%、知识库 247 条/902 来源且 M2 55/97、真实 GEARS/Seedance 0/5、发布运营 60%，真人审核、signed release 和全部真实信用保持 0。

### 8.18 2026-07-15 文件型 ReviewRepository 与审稿 CAS

轨道 G 新增泛型 `ReviewRepository` 合同和同步文件 provider，首个接入点是 Domain Pack 扩库运行态 `review-state.json`。选择该边界是因为它原本就是独立于候选 seed 和省份 Markdown 的完整审稿状态文件；AI 漫剧 Seedance 审片 ledger 仍嵌在整份系列项目 JSON 中，本轮不制造第二份权威数据源。seed 优先级、runtime override、单条/批量更新和写回草案返回结构保持兼容，正式省份 Markdown 仍不自动写回。

provider 以持久化文档原始字节 SHA-256 作为 revision；写入进入排他锁后重新读取当前 revision，stale reviewer 不再能静默覆盖 winner。目标文档通过同目录 `0600` 临时文件、文件 `fsync`、原子 rename 和父目录 `fsync` 发布。未知或外部 lock 保留且返回冲突；仅同主机、PID 明确不存在的 lock 会无删除归档。无效 JSON、schema/item、重复 review ID、symlink root/target 和非法文件名均 fail closed，存储不可用不会伪装成普通 409 冲突。

新增 7 个 repository 测试覆盖空读不创建、排序与 exact-byte revision、CAS winner、临时文件故障注入、路径/符号链接、损坏状态、外部锁和死进程锁归档；ReviewRepository 与 Domain Pack 定向回归 2 文件、14 用例通过，服务端全量 89 文件、870 用例通过。完成后的授权环境 Unified CI 21/21 通过：MCP 79 文件、345 用例，Track A Playwright 6/6，Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和 diff check 均通过。P4 排除自身为 105 文件（76 tracked、29 untracked），`shared_core=46`、`governance=13`、hold 0、staged 0。

seed/runtime 状态、reviewer 字段、机器 CAS 和测试不证明真人实际审稿或签署；本轮没有生成真人审核、真实修订、real artifact、professional pass 或 signed release。综合研发保持 73%、专业文本 47.5%、知识库 247 条/902 来源且 M2 55/97、真实 GEARS/Seedance 0/5、发布运营 60%。

### 8.19 2026-07-15 文件型 JobRepository 与 Webhook 失败死信

轨道 G 新增泛型 `JobRepository` 合同和文件 provider，首个接入点是现有 `web/generated/webhook_failures.log`。GEARS `story_ready` webhook 在重试耗尽后不再直接 `appendFile`，而是写入带确定性 SHA-256 `failure_id` 的不可变失败事件；相同逻辑投递的精确 replay 返回 duplicate，不重复增加死信，复用同一幂等键但内容不同则 fail closed。旧版无 schema/failure ID 的既有 webhook failure 行仍可规范化读取。

provider 在排他锁下读取和验证完整 JSONL，再通过同目录临时文件、文件 `fsync`、原子 rename 和父目录 `fsync` 发布完整新日志，因此不会留下 partial trailing line。并发写使用有界锁重试，测试中的四路并发全部保留；未知/外部 lock 不删除，同主机死 PID lock 无删除归档。空行、无结尾换行、无效 JSON/event、重复 event ID、symlink root/target 和 64 MiB 上限越界均 fail closed。失败证据中的 webhook URL 会移除 userinfo、query 和 fragment，避免持久化基础认证或 query secret。

新增 7 个 JobRepository 测试，另扩充 webhook 测试验证 schema/failure ID、精确去重、captured root 和 URL secret 零落盘；定向回归 2 文件、14 用例，服务端全量 90 文件、878 用例通过。完成后的授权环境 Unified CI 21/21 通过：MCP 79 文件、345 用例，Track A Playwright 6/6，Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和 diff check 全通过。P4 排除自身为 107 文件（76 tracked、31 untracked），`shared_core=48`、hold 0、staged 0。

文件 provider 当前以完整日志原子重写换取崩溃一致性，尚无生产消息队列、分区、lease、取消、超时、轮转、死信重放、监控或 SLO；测试 fetch 和本地 failure log 不是真实 GEARS 调用或 artifact。综合研发保持 73%、专业文本 47.5%、知识库 247 条/902 来源且 M2 55/97、真实 GEARS/Seedance 0/5、发布运营 60%，全部真实人工与发布信用仍为 0。

### 8.20 2026-07-15 文件型 SeriesProjectRepository 核心生命周期

轨道 G 为 AI 漫剧系列项目建立可替换的 `SeriesProjectRepository` 合同和首个文件 provider。首切片只迁移核心生命周期：系列保存的新建/替换、读取、列表、复制、归档/恢复和连续性台账重建。主存储根与既有兼容根继续合并读取；兼容根中的旧项目在原位置替换，不会静默复制成第二份权威数据。服务中其余 19 处生产子流程 mutation 仍使用兼容直写，后续必须逐组迁移，因此本轮不宣称完整系列服务抽离。

provider 限制 series project ID，拒绝 traversal、symlink root/项目目录/`project.json` 和嵌入 ID 不一致；损坏 JSON 或缺失身份元数据 fail closed。新建不会覆盖既有项目，替换在排他锁内重新读取 `project.updated_at`，stale writer 返回 `SERIES_PROJECT_WRITE_CONFLICT`/HTTP 409。JSON 先写入同目录 `0600` 临时文件并 `fsync`，再原子 rename 和同步父目录。未知或外部 lock 保留；仅同主机且 PID 明确不存在的 lock 会无删除归档。

新增 8 个仓库测试覆盖新建/列表/读取、不覆盖、CAS winner、兼容根原位替换、路径与符号链接、损坏状态、原子写故障、外部锁和死进程锁恢复；系列 repository 与服务定向回归为 2 文件、40 用例，服务端全量为 91 文件、886 用例。完成后的授权环境 Unified CI 21/21 通过：MCP 79 文件、345 用例，Track A Playwright 6/6，Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和 diff check 全通过。P4 排除自身为 109 文件（76 tracked、33 untracked），`shared_core=50`、hold 0、staged 0。

该文件 provider 不是 PostgreSQL、对象存储、跨文件事务或真实多用户冲突 UAT；机器 CAS、故障注入和测试均不计真实修订、真人审核、真实回片、signed release 或 professional pass。综合研发保持 73%、专业文本 47.5%、知识库 247 条/902 来源且 M2 55/97、真实 GEARS/Seedance 0/5、发布运营 60%。

### 8.21 2026-07-15 系列项目状态 mutation 全量接入 repository

8.20 留下的 19 处 `project.json` 生产 mutation 已全部迁入 `SeriesProjectRepository.replace`。范围覆盖 Seedance prompt/生产状态/版本选择、资产与音频库、剪辑/字幕/混音/片头片尾/最终装配、审片增改、GEARS 提交/callback/轮询失败、生产就绪自动化台账、缩略图和生成集连续性写回。服务源码不再保留 `writeJsonFile(seriesProjectPath(...))` 或同类直接 `writeFile` 状态写入；架构测试会在未来重新引入绕过时失败。

专项回归首次发现 GEARS callback 的组合业务动作会先持久化 Seedance ledger、再持久化 GEARS ledger，第二次 CAS 可能把业务内部生成的新时间戳误当作存储前态而冲突。现将 Seedance 与 GEARS 变化先在内存中合并，整个 submit/callback 只以最初读取的 `updated_at` 做一次 repository replace；这既消除中间可见状态，也确保真正的并发 writer 仍返回 409，而不是静默覆盖。

新增源码边界测试后，SeriesProjectRepository 与系列服务定向回归为 2 文件、41 用例，服务端全量为 91 文件、887 用例。完成后的授权环境 Unified CI 21/21 通过：Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和 diff check 全通过。P4 排除自身仍为 109 文件（76 tracked、33 untracked），`shared_core=50`、hold 0、staged 0。

完成的是系列 `project.json` 状态 mutation 边界，不是 11k+ 行服务的完整模块化；生产 artifact 文件仍有独立落盘路径，也没有 PostgreSQL、跨进程事务协调、真实双用户冲突 UI/UAT、备份恢复或灾难演练。五套进度保持综合研发 73%、专业文本 47.5%、知识库 247 条/902 来源且 M2 55/97、真实 GEARS/Seedance 0/5、发布运营 60%，全部机器测试与本地文件状态均不增加真实信用。

### 8.22 2026-07-15 文件型 StoryRepository 与跨服务项目同步收口

轨道 G 新增 `StoryRepository` 合同和文件 provider。`story-service.ts` 的故事生成、新建防覆盖、列表、读取、GEARS delivery Markdown 修改和 GEARS 视频 callback 写回，连同 AI 漫剧单集的故事合并，现统一经过该 repository。`story-service.ts` 不再直接调用 `mkdir`/`writeFile`；其“从当前项目读取 story”路径改用 `ProjectRepository`。AI 漫剧单集原先直接覆盖当前版本 JSON 和 `project.json` 的同步也改为 `ProjectRepository.writeCurrentState`，源码边界测试锁定这些旁路不得恢复。

Story provider 对 story ID 和 15 个 video type 做约束，以原始文件字节 SHA-256 作为 replace revision；重复 story ID 跨 video type、stale writer、损坏 JSON、嵌入 identity 不一致、超过 64 MiB、traversal、symlink root/type 目录/故事文件和未知外部 lock 均 fail closed。写入使用根目录 story 级排他锁、同目录 `0600` 临时文件、文件 `fsync`、原子 rename 和父目录 `fsync`；同主机死 PID lock 仅无删除归档。列表遇到伪装成 `.json` 的 symlink/非普通文件也拒绝，而不是静默隐藏异常状态。

新增 9 个 StoryRepository/架构测试；StoryRepository、GEARS 两条写回与系列服务定向回归为 4 文件、43 用例，服务端全量为 92 文件、896 用例。完成后的授权环境 Unified CI 21/21 通过：Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和 diff check 全通过。P4 排除自身为 111 文件（76 tracked、35 untracked），`shared_core=52`、hold 0、staged 0。

故事文件与项目 WAL 仍是两个 repository，AI 单集合并当前先发布 story、再同步 project current state，尚不构成跨 repository 原子事务；也没有数据库 provider、备份恢复或真实多人冲突 UAT。机器 story、callback fixture、CAS 和故障注入不计真实修订、真人审核、真实回片、signed release 或 professional pass；五套进度仍为 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%。

### 8.23 2026-07-15 ArtifactStore 扩展到系列后期 sidecar

AI 漫剧系列服务中由应用自身生成的剪辑 concat 清单、字幕 SRT、final concat 清单和 final delivery manifest 已从 `mkdir + writeFile` 迁入 `FileArtifactStore.writeText`。所有路径继续相对系列项目目录，写入前统一拒绝绝对路径、traversal、反斜线、控制字符和 symlink parent/target，并使用显式 `replace`、同目录 `0600` 临时文件、文件 `fsync`、原子 rename 和父目录 `fsync`。系列服务中的 `writeFile` 调用现为 0，源码边界测试禁止重新引入应用侧直接写盘。

本轮有意保留 6 个外部 worker 输出目录准备点：cut、字幕烧录、混音、片头片尾、final assemble 和 thumbnail runner 仍由测试/ffmpeg runner 直接生成媒体文件。ArtifactStore 当前不提供外部进程临时输出的流式原子导入，强行把这些路径写成普通文本/二进制 buffer 会放大大媒体内存占用，也不能解决 runner 与 publish 之间的竞态。因此这些输出仍明确标记为后续 `prepare -> runner temp -> verify -> atomic import`/对象存储切片，而不伪装成已完成。

ArtifactStore 与系列服务定向回归为 2 文件、39 用例，服务端全量为 92 文件、897 用例。完成后的授权环境 Unified CI 21/21 通过：Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和 diff check 全通过。P4 排除自身仍为 111 文件（76 tracked、35 untracked），`shared_core=52`、hold 0、staged 0。

concat/SRT/manifest 及其 hash 只是本地应用 artifact；dry-run 生成的 sidecar 仍不计真实媒体生产。外部 runner 尚未接入原子导入、对象存储、CDN、备份或真实回片验收，所以五套进度保持 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%，真实修订、真人审核、signed release 和 professional pass 仍为 0。

### 8.24 2026-07-15 外部 runner staging 与原子媒体发布

ArtifactStore 新增外部写 session：应用先校验最终相对路径、overwrite policy、目标和父目录，再返回同目录随机、不可预测的 staging 路径；ffmpeg/thumbnail runner 只接收 staging 路径。runner 返回后，store 要求 staging 为普通文件且不是 symlink，执行文件 `fsync`，通过流式读取计算 SHA-256 和字节数，最后按 `forbid` hard-link 或 `replace` rename 原子发布并同步父目录。未产出文件、伪造/已关闭 session、symlink staging、发布竞态和外部 target 冲突均 fail closed；失败/中止清理 partial staging，不跟随 symlink 改写外部文件。

该合同已接入六条系列媒体路径：剪辑装配、字幕烧录、音频混合、片头片尾、final assemble 和缩略图抽帧。旧测试中 cut、字幕和 thumbnail 的 no-op runner 曾被当作成功，本轮将 fixture 改为真实写出 staging 文件；ArtifactStore 另明确验证 no-output 必须失败。音频、片头片尾和 final 既有“runner 不产出即失败”用例继续通过。`ai-comic-series-service.ts` 的直接 `writeFile` 和 `mkdir` 均为 0，源码边界测试同时锁定 sidecar 与 runner 输出不能绕开 store。

ArtifactStore 与系列服务定向回归为 2 文件、41 用例，服务端全量为 92 文件、899 用例。完成后的授权环境 Unified CI 21/21 通过：Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和 diff check 全通过。P4 排除自身仍为 111 文件（76 tracked、35 untracked），`shared_core=52`、hold 0、staged 0。

原子发布只证明本地文件 provider 的机器合同，不证明真实 ffmpeg、Seedance、GEARS worker、对象存储、CDN、媒体备份或公共 artifact URL 已部署。所有 fake media bytes、runner fixture、hash 和本地最终路径仍排除真实回片信用；五套进度保持 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%。

### 8.25 2026-07-15 当前项目状态三字段 CAS

`ProjectRepository.writeCurrentState` 原先只校验 `current_version_id + version_count`，因此两个请求若都读取同一版本、但修改的是 callback/素材补充等当前状态，第一个请求完成后版本号不变，第二个 stale writer 仍可能静默覆盖。该路径现统一要求 `updated_at + current_version_id + version_count` 三字段 expectation；进入项目锁后重读 meta，任一字段不一致都返回 `PROJECT_WRITE_CONFLICT`。目标 `updated_at` 还必须是有效时间并严格晚于前态，避免写入不推进 CAS token。事务 intent 对 `write_current_state` 也要求并保存三字段 expectation，`commit_version` 继续保持两字段追加式版本契约。

知识补充任务、手工素材包、GEARS delivery/webhook/video callback 和 AI 漫剧分集 story→project 同步均已迁移到三字段 expectation。服务端为同毫秒连续动作生成单调递增的 `updated_at`；AI 分集同步不再沿用旧时间戳。repository 回归验证同一版本上的首个 current-state writer 成为 winner 后，持有相同旧 `updated_at` 的第二 writer 被拒绝，未推进时间戳也被拒绝；故障注入 intent 明确保留三字段前态并继续可恢复。

定向 ProjectRepository 为 1 文件、8 用例，Web Server 全量为 92 文件、899 用例，服务端 TypeScript 与 `git diff --check` 通过。完成后的授权环境 Unified CI 21/21 通过：Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身为 112 文件（77 tracked、35 untracked），`shared_core=53`、hold 0、staged 0。

该切片只证明文件 provider 的机器并发控制，不等于 PostgreSQL 事务、跨 repository 原子性、真实多人冲突 UI/UAT 或生产故障演练。五套进度保持综合研发 73%、专业文本 47.5%、知识库 247 条/902 来源且 M2 55/97、真实 GEARS/Seedance 0/5、发布运营 60%；fixture、CAS、测试和本地 WAL 均不增加真实修订、真人审核、真实回片、signed release 或 professional pass 信用。

### 8.26 2026-07-15 版本提交三字段 CAS 与 Board 成对发布

继续审计发现 `commitVersion` 虽能拒绝版本号变化，却仍可能在同一版本的 metadata-only writer 已获胜后，用更早读取的整份 meta 创建新版本并覆盖素材、回调或账本字段。版本提交现同样要求 `updated_at + current_version_id + version_count`，目标时间戳必须严格推进；`commit_version` intent 保存三字段 expectation，恢复解析也拒绝缺少有效 `updated_at` 的新意图。测试先完成同版本 metadata winner，再尝试 stale 新版本，确认目标版本文件不创建；随后使用新前态提交可成功并保留 winner 字段。另以 snapshot 后故障注入验证三字段 commit intent 可确定性重放。

Production Board 导出原先先写 meta、再以无 expectation 的 `writeVersion` 覆盖当前 snapshot，任一步失败或并发 callback 都可能造成两份状态分裂或静默丢字段。该 snapshot-only 写入口已从 `ProjectRepository` 公共合同和文件 provider 移除；Board 导出现在读取当前 snapshot 后，通过一次 `writeCurrentState` WAL 成对发布导出后的 meta 与 `production_board_export`。源码边界测试禁止重新引入 `.writeVersion(`，已有导出回归继续验证项目 `exported` 状态与版本导出记录一致。

ProjectRepository/项目服务定向回归为 2 文件、68 用例，Web Server 全量为 92 文件、902 用例，服务端 TypeScript 与 `git diff --check` 通过。完成后的授权环境 Unified CI 21/21 通过：Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身仍为 112 文件（77 tracked、35 untracked），`shared_core=53`、hold 0、staged 0。

本轮没有执行真实多用户冲突、断电、数据库事务、对象存储或真实 Board 外部交付；本地 artifact、WAL、fault injection 和测试均不计真实成果。五套进度继续为 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%，真实修订、真人审核、真实回片、signed release 和 professional pass 全部保持 0。

### 8.27 2026-07-15 metadata-only 强制 CAS 与单调 revision token

`ProjectRepository.writeMeta` 的 expectation 过去在接口上仍可省略，虽然当前生产调用已经主动传值，未来代码仍可能重新引入无 CAS 覆盖；同时目标 `updated_at` 若等于前态，第一次写入不会推进 revision token，后续 stale writer 仍可能通过。该方法现强制接收 `ProjectMetaExpectation`，并与版本/当前状态写入一致地要求目标时间戳有效且严格递增。路径错误、外部锁等测试也必须显式提供 expectation，公共 API 不再保留“可信单写者”逃生入口。

项目服务全部 15 条 metadata-only 生产写路径已核对：Seedance 资产绑定/批量导入/上传/占位/复用、shot 版本与 provider queue、超时恢复、GEARS 提交/callback/轮询失败、生产就绪自动化和当前版本导出均使用 `nextProjectUpdatedAt`。业务事件仍保存其实际事件时间，项目顶层 revision token 则保证单调；GEARS 提交若没有产生任何新 ledger job 会直接跳过 metadata 写入，不再用原时间戳制造无变化写。源码测试同时禁止重新出现可选 expectation。

ProjectRepository/项目服务定向回归为 2 文件、68 用例，Web Server 全量为 92 文件、902 用例，服务端 TypeScript 与 `git diff --check` 通过。完成后的授权环境 Unified CI 21/21 通过：Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身仍为 112 文件（77 tracked、35 untracked），`shared_core=53`、hold 0、staged 0。

该结果是文件 provider 的机器级乐观锁合同；没有真实多用户 UAT、冲突解决 UI、生产数据库或跨 repository 事务。五套进度仍为 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%，所有 fixture、时间戳、CAS 和测试均不计真实修订、真人审核、真实回片、signed release 或 professional pass。

### 8.28 2026-07-15 SeriesProject revision token 推进门禁

横向检查 Project/Series/Story/Review 四类 CAS 后确认：StoryRepository 与 ReviewRepository 使用 exact-byte SHA-256 revision，不同内容成功写入必然改变 token；SeriesProjectRepository 仅核对旧 `updated_at`，却未验证目标时间有效或更晚，改变内容但复用旧时间会让下一名 stale writer 继续通过。系列 replace 现要求 expected 为有效时间，目标 `project.updated_at` 也必须有效且严格晚于 expected；复用/回退/非法时间均在获取并覆盖目标前 fail closed。

全量测试首次暴露 `autoSelectAiComicSeriesSeedanceProductionVersions` 在没有任何可择优版本时仍执行 replace，并刻意沿用旧时间。该 no-op 现在直接返回现存项目，不写 `project.json`；有实际选择时才推进项目与 ledger 时间并执行 CAS。其余 22 条系列 replace 生产路径在新门禁下通过，说明没有隐藏的确定性 token 复用路径；同毫秒动作若不能推进仍会返回 409，而不是静默覆盖。

SeriesProjectRepository/outline 系列流程定向回归为 2 文件、41 用例，Web Server 全量为 92 文件、902 用例，服务端 TypeScript 与 `git diff --check` 通过。完成后的授权环境 Unified CI 21/21 通过：Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身仍为 112 文件（77 tracked、35 untracked），`shared_core=53`、hold 0、staged 0。

该门禁不代表真实多人冲突 UAT、冲突合并 UI、生产数据库事务或备份恢复已经完成。五套进度继续为综合 73%、专业文本 47.5%、知识库 247 条/902 来源且 M2 55/97、真实 GEARS/Seedance 0/5、发布运营 60%；测试系列、CAS 和时间戳均不计任何真实人工、媒体或发布信用。

### 8.29 2026-07-15 最小 Domain Pack 注册表与搜索动态分发

依据平台路线 Phase 1 的增量拆分红线，本轮建立 `platform/domain-pack.ts`、`platform/domain-registry.ts` 与 `domains/china-culture/domain-pack.ts`，没有搬迁或重写既有故事业务。Domain Pack 现以 `story-agent-domain-pack/v1` 元数据自描述，注册时校验 `domain_id`、显示名、描述与语义版本；重复、非法注册 fail closed，注册表提供确定性领域列表与显式 require。首个 `china_culture` 包只声明 `entry_search` 能力，通过薄适配器复用现有 entry service，因此不虚报完整 DomainPack 合同或第二领域完成。

`GET /api/entries/search` 已由平台路由骨架按可选 `domain` 动态分发：未提供参数时默认 `china_culture`，旧 URL、旧筛选字段与前端无需改动；显式 `domain=china_culture` 与旧查询逐项相等。合法但未注册的领域返回 404 `DOMAIN_PACK_NOT_FOUND`，路径式或非规范标识在 Zod 层返回 400 `VALIDATION_ERROR`。平台搜索接口只认通用 `keywords/type` 与扩展字段，不在平台层写死 `province/region` 文化语义。

Domain Pack 注册表与 Entries API 定向回归为 2 文件、184 用例，Web Server 全量为 93 文件、909 用例，服务端 TypeScript、构建和 `git diff --check` 通过。更新后 Unified CI 21/21 通过：Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身为 118 文件（79 tracked、39 untracked），`shared_core=59`、hold 0、staged 0。

本切片仍未动态分发 entry detail/match、故事规划/生成、安全/可信度或 GEARS 映射，也未完成 service 物理迁移与第二个生产 Domain Pack。fixture、兼容测试、注册表元数据和机器验签不计真实修订、真人审核、真实回片、signed release 或 professional pass；五套进度继续为综合研发 73%、专业文本 47.5%、知识库 247 条/902 来源且 M2 55/97、真实 GEARS/Seedance 0/5、发布运营 60%。

### 8.30 2026-07-15 Domain Pack 条目能力闭环

在搜索分发骨架上继续收口条目能力：Domain Pack 标准合同现要求 `entry_search`、`entry_detail`、`entry_match` 三项能力与对应实现，注册时拒绝缺项、重复或额外未知能力，避免元数据声称与运行时能力漂移。`china_culture` 适配器复用现有搜索、精确详情和智能匹配实现；平台参数只声明通用字段并允许领域扩展，文化特有偏好仍封装在适配器边界。

`GET /api/entries/detail` 与 `POST /api/entries/match` 新增可选 `domain`，缺省继续使用 `china_culture`；显式领域调用分别与旧调用逐项相等，未知领域返回 404，非法领域标识仍由 schema 返回 400。`routes/entries.ts` 已完全移除对 `entry-service.ts` 的直接 import，并以源码边界测试防止回退；`multi-match` 属于 outline/知识包协同能力，本轮未伪装为基础条目能力。

Domain Pack/Entries API 定向回归为 2 文件、189 用例，Web Server 全量为 93 文件、914 用例，TypeScript 与 `git diff --check` 通过。授权环境 Unified CI 21/21 通过：Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。默认沙箱中的 supertest 临时监听曾被 `listen EPERM 0.0.0.0` 拒绝；相同测试在获准环境完整通过，该环境错误不作为代码通过证据。

P4 排除自身仍为 118 文件（79 tracked、39 untracked），`shared_core=59`、hold 0、staged 0。故事 plan/generate、类型路由、安全规则、可信度和 GEARS 适配仍未进入 Domain Pack，service 也尚未物理迁移；本轮机器测试不增加任何真实修订、真人审核、真实回片、signed release 或 professional pass。五套进度维持 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%。

### 8.31 2026-07-15 Domain Pack 故事创建能力分发

在条目能力之后，Domain Pack 合同增量加入 `story_plan` 与 `story_generate`，注册表现在要求五项能力与实际方法同时存在。`china_culture` 包以薄适配器调用既有 `planStory` 和 `generateAndStoreStory`，没有复制生成算法或绕开 StoryRepository/ProjectRepository。`POST /api/stories/plan` 与 `/generate` 接受可选 `domain`，缺省行为不变；显式文化领域规划与旧结果逐项一致，未知领域均返回 `DOMAIN_PACK_NOT_FOUND`。

生成路由仍先执行服务端 `story:create` RBAC，再选择 Domain Pack；认证 actor 派生出的 `access_control` 原样传给领域生成方法，因而新项目所有权持久化、原子写与审计语义不变。未知领域在调用生成服务前 fail closed，不创建 story/project。源码边界测试禁止 stories route 重新直接 import `planStory` 或 `generateAndStoreStory`；已有 story 列表、详情、GEARS 与 Seedance 读取保持平台公共路径，不按请求领域重新解释存量资源。

Domain Pack 与 entry/story API 定向回归为 2 文件、194 用例，Web Server 全量为 93 文件、919 用例，TypeScript 与 `git diff --check` 通过。授权环境 Unified CI 21/21 通过：Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身仍为 118 文件（79 tracked、39 untracked），`shared_core=59`、hold 0、staged 0。

本切片没有完成 generation type/entry type 元数据、可执行 safety/credibility 合同、GEARS 映射、service 物理迁移或第二个真实领域；领域路由与测试不计真实模型修订、真人审核、真实回片、signed release 或 professional pass。五套进度仍为 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%。

### 8.32 2026-07-15 Domain Pack 类型目录与只读发现

平台 `system.ts` 原先直接保存 12 个中国文化条目类型及其推荐片型/表现形式，违反“平台内核不知道领域具体类型名”的边界。该目录现迁入 `domains/china-culture/type-catalog.ts`，并与 15 个现有 VideoType 元数据一起成为 Domain Pack 的 `entryTypes` / `generationTypes`。注册表新增 `type_catalog` 必需能力，拒绝空目录、重复 entry name 或重复 generation id，避免只声明能力却没有可用目录。

新增只读 `GET /api/system/domain-packs`，只返回领域元数据、能力与 12/15 计数，不序列化方法、凭据或服务内部状态；`GET /api/system/types` 改为按可选 `domain` 读取领域目录，缺省及显式 `china_culture` 与旧响应逐项一致；`GET /api/system/generation-types` 提供相同领域选择与 15 片型目录。未知领域返回 404，非法领域标识返回 400，前端无需改动。

Domain Pack 注册/发现与 API 定向回归为 2 文件、199 用例，Web Server 全量为 93 文件、924 用例，TypeScript 与 `git diff --check` 通过。授权环境 Unified CI 21/21 通过：Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身为 119 文件（79 tracked、40 untracked），`shared_core=60`、hold 0、staged 0。

目录可发现不等于第二领域可用，也不代表 safety/credibility、type routing、GEARS 映射或 service 物理拆分完成；所有目录测试与 metadata 均不计真实修订、真人审核、真实回片、signed release 或 professional pass。五套进度维持 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%。

### 8.33 2026-07-15 Domain Pack 落盘前文化可信度安全门禁

安全审计发现，兼容的外部模型输出只要提供非空 `cultural_constraints` 或 `credibility_note`，原实现就会整段替换本地引擎根据条目可信度、待核实点和来源生成的基线。该合并现改为“本地基线 + 模型补充”的去重追加：模型不能删除本地 constraints，credibility note 也必须先保留本地说明再附加模型内容，避免模型把 D 级传说、存疑或待核实边界静默洗掉。

`china_culture` Domain Pack 新增 `story_safety` 能力与四条可执行规则：可信度约束存在、每个待核实点存在、credibility note 同时包含条目名与可信度等级、至少一个场景保留来源条目追踪。校验在最终修订/质量/GEARS package 形成后、ProjectRepository 与 StoryRepository 写入前执行；任何 blocker 返回 422 `DOMAIN_SAFETY_VALIDATION_FAILED`，不创建 story/project。通过结果随 Story 保存为 `story-domain-safety/v1`，并固定 `machine_validation_only=true`、`human_review_complete=false`、`real_credit_granted=false`。

Domain Pack safety、模型合并与注册边界定向回归为 3 文件、27 用例，API 集成为 1 文件、193 用例，Web Server 全量为 94 文件、926 用例，TypeScript 与 `git diff --check` 通过。授权环境 Unified CI 21/21 通过：Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身为 122 文件（80 tracked、42 untracked），`shared_core=63`、hold 0、staged 0。

该门禁只证明四条结构化边界未被机器输出删除，不判断历史主张真伪、文化适切性、现实授权或真人审稿结论，也不代表第二 Domain Pack 安全规则完成。五套进度保持 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%；所有 safety report、fixture 与测试均不增加真实修订、真人审核、真实回片、signed release 或 professional pass。

### 8.34 2026-07-15 GEARS segments/v2 领域映射与旧字段兼容

GEARS segments 端点原先已经把 `schema_version` 写成 `gears-segments/v2`，但响应没有 v2 契约要求的 `sourceDomain`，分段也仍只有领域专用的 `cultural_constraints`。本轮将 `gears_mapping` 纳入 Domain Pack 强制能力：`china_culture` 把 story 全局文化边界与 segment 镜头边界合并、去空白并去重，输出平台统一字段 `constraint_note`。响应同时保留内容完全等价的 `cultural_constraints`，使旧消费者在迁移窗口内不丢约束；单一 `/api/stories/:storyId/gears-segments` 端点保持不变。

新生成故事会持久化 `sourceDomain=china_culture`；旧 snapshot 没有该字段时走明确的 legacy `china_culture` 默认，不批量改写历史文件。API 根据故事的 `sourceDomain` 解析 Domain Pack，持久化了未注册领域的故事返回 404 `DOMAIN_PACK_NOT_FOUND`，不静默套用错误领域规则。`GearsSegmentsResponse` 现以字面量锁定 v2 schema、`sourceDomain` 和含 `constraint_note` 的分段类型，避免以后再次出现“版本号先升级、数据契约未升级”。

Domain Pack/文化安全定向回归为 2 文件、9 用例，API 集成为 194 用例，Web Server 全量为 94 文件、928 用例，TypeScript 与 `git diff --check` 通过。该契约和 fixture 只验证本地映射与兼容行为，没有调用真实 GEARS/Seedance worker、生成真实媒体或取得公共 artifact URL；五套进度保持综合研发 73%、专业文本 47.5%、知识库 247 条/902 来源且 M2 55/97、真实 GEARS/Seedance 0/5、发布运营 60%，不增加真实修订、真人审核、signed release 或 professional pass 信用。

### 8.35 2026-07-15 平台共享基础类型抽取

Phase 1 的共享模型不再只停留在路线文档：新增 `web/shared/platform-types.ts`，定义与领域无关的 `BaseEntry`、`BaseStoryScene`、`BaseGearsSegment` 和泛型 `BaseStory`；`web/server/src/platform/types.ts` 作为服务端平台入口只做 type re-export。既有 `EntrySearchResult`、`EntryDetail`、`StoryScene`、`GearsSegment` 和 `StoryGenerateResult` 通过结构继承接入，不改变当前 API 字段、序列化结果或前端调用。

基础文件明确不包含 `cultural_note`、`cultural_constraints`、可信度等级等 china_culture 专用字段，也不包含 const/class/function 运行时实现；领域字段继续留在现有文化模型。`sourceDomain` 在基础资源中仅因旧 snapshot 兼容而可选，新生成故事仍由 Domain Pack 强制持久化；GEARS v2 导出类型继续把 `constraint_note` 收紧为必填。该拆分建立了第二 Domain Pack 可复用的最小类型边界，但没有把 4k+ 行 entry/story/mcp 服务实体迁入领域目录，因此不宣称 Phase 1 完整服务抽离。

平台类型/Domain Pack 定向回归为 2 文件、9 用例，Web Server 全量为 95 文件、930 用例，TypeScript 与 `git diff --check` 通过。P4 排除自身为 125 文件（80 tracked、45 untracked），`shared_core=66`、hold 0、staged 0。纯类型合同、结构断言和机器测试不计真实修订、真人审核、真实回片、signed release 或 professional pass；五套进度继续为 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%。

### 8.36 2026-07-15 Domain Pack 类型目录去文化枚举耦合

基础故事模型抽取后继续横向审计发现，`DomainPack.entryTypes` 与 `generationTypes` 仍直接声明为现有 `TypeInfo`/`VideoTypeMeta`，后者把推荐生成类型、VideoType、PresentationStyle 和分组全部限定在 china_culture 当前联合类型。这样的注册表虽然能列出第二领域，却无法在 TypeScript 中合法声明 `case_drama`、`anti_fraud_short` 等新类型。本轮在共享平台类型中新增 `DomainEntryTypeDescriptor` 与 `DomainGenerationTypeDescriptor`，所有领域标识、分组、表现形式和兼容条目均为领域自有字符串；时长兼容当前字符串和未来数值合同。

Domain Pack 注册表现改用上述基础目录描述，既有 `TypeInfo` 与 `VideoTypeMeta` 以窄类型继承，因此 `china_culture` 的 12 条目类型、15 生成类型、系统 API 与前端响应均不变化。注册时新增目录内容校验：空名称/描述/表现形式、非规范生成类型 ID、非正数时长和重复 ID 全部 fail closed。测试包以不属于当前文化联合的 `police_story_story`、`police_story_style` 和数值时长 60 注册成功，同时验证大写连字符 ID 被拒绝；这只证明平台目录合同可扩展，不代表 police_story 业务、安全规则或数据已经实现。

平台类型/Domain Pack 定向回归为 2 文件、10 用例，Web Server 全量为 95 文件、931 用例，TypeScript 与 `git diff --check` 通过。该切片未注册第二个生产 Domain Pack、未生成第二领域内容，也未调用真实模型或 GEARS；五套进度保持 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%，机器目录 fixture 不计任何真实信用。

### 8.37 2026-07-15 china_culture 规划风险规则物理抽取

作为大型文化 story service 的首块真实业务拆分，本轮把 `computeCulturalRisks` 与 `buildPlanSupplementNeeds` 从 `services/story-service.ts` 迁入 `domains/china-culture/planning-rules.ts`，并改为显式的 `computeChinaCulturePlanningRisks` / `buildChinaCulturePlanSupplementNeeds`。风险规则仍按“存疑/待核实 + 每条待核点”形成规划边界；补充需求仍覆盖可信度复核、缺核验方式、最多五条待核内容和不足 120 字的故事细节。`planStory` 只调用领域规则，返回字段和顺序保持不变。

新增正反测试验证：资料充分且可靠的条目不凭空生成风险或补充任务；待核实条目保留可信度、核验方式、全部规划风险和短素材边界；七个待核点只在补充队列展示五个，但整体“存疑” blocker 不被隐藏。源码边界测试禁止两个旧函数体重新进入 legacy story service，并确认服务只通过领域函数调用。完成的是两个纯规划规则的物理迁移，不是 entry/story/mcp 三个大服务的整体抽离，也未做真人文化判断。

文化规划/Domain Pack/safety 定向回归为 3 文件、13 用例，Web Server 全量为 96 文件、935 用例，TypeScript 与 `git diff --check` 通过。P4 排除自身为 127 文件（80 tracked、47 untracked），`shared_core=68`、hold 0、staged 0。所有规划结果仍是机器建议，不计真人来源核验、文化审核、真实修订、真实回片、signed release 或 professional pass；五套进度保持 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%。

### 8.38 2026-07-15 china_culture 三维类型路由矩阵物理抽取

继续拆分 legacy story service 后，条目类型到旧 `GenerationType`、15 片型 `VideoType` 和 8 类 `StoryStructureType` 的三份矩阵已迁入 `domains/china-culture/type-routing.ts`。规划推荐、event type 选择与叙事结构推荐全部改调领域函数；函数返回副本，调用者不能修改注册常量。未知旧条目类型仍确定性降级为 `character_story` / `character_story` / `single_event_drama`，保持既有兼容行为。

目录一致性测试以 `CHINA_CULTURE_ENTRY_TYPES` 为权威集合，验证 12 个条目类型在三份矩阵中无缺失、无额外项；generation/video 推荐逐项等于系统目录中已发布的顺序，所有类型至少有一个叙事结构。源码边界测试确认 legacy story service 不再含三份 `TYPE_*_ROUTING` 矩阵。该切片把领域路由数据实体迁出，但视频配置、prompt、生成引擎和大型 story service 其余逻辑仍待后续增量抽离。

类型路由/文化规划/Domain Pack 定向回归为 3 文件、16 用例，Web Server 全量为 97 文件、939 用例，TypeScript 与 `git diff --check` 通过。P4 排除自身为 129 文件（80 tracked、49 untracked），`shared_core=70`、hold 0、staged 0。所有目录、fallback 和结构测试均为机器合同，不计真人文化审稿、真实修订、真实 GEARS/Seedance 回片、signed release 或 professional pass；五套进度仍为 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%。

### 8.39 2026-07-15 china_culture 完整只读故事规划服务迁移

在规划规则和路由矩阵完成抽取后，本轮将完整 `planStory` 从 4k+ 行 legacy `services/story-service.ts` 迁入 `domains/china-culture/story-planning-service.ts`。新领域服务自行读取/转换文化条目，生成旧 generation 推荐、片型推荐、表现形式、粗体事件与冲突分、推荐时长、叙事结构、叙事模式、补充需求和文化风险；Domain Pack 直接调用 `planChinaCultureStory`，不再经 legacy story service 规划。外部 `/api/stories/plan` 路由、请求与响应字段均保持不变。

粗体事件解析也迁入领域服务：省份、类型、故事梗概、可信度和待核实点等结构标题不被误当成故事事件。生成链仍需要从知识条目选择 central event，因此只复用导出的 `extractChinaCultureBoldEvents`，没有复制规则。源码边界测试确认 Domain Pack 的 planning import 指向领域服务、legacy story service 不再导出/实现 `planStory`；API 194 用例通过，覆盖成功规划、未知领域、未知条目与既有动态分发。生成链、模型合并、项目落盘和其余 entry/mcp 代码仍待继续分拆，本轮不宣称完整 Phase 1。

领域规划/路由/规则/Domain Pack 定向回归为 4 文件、19 用例，API 集成为 194 用例，TypeScript 与 `git diff --check` 通过。P4 排除自身为 131 文件（80 tracked、51 untracked），`shared_core=72`、hold 0、staged 0。规划结果仍是机器推荐，不计真实模型项目、真人文化审核、真实修订、真实回片、signed release 或 professional pass；五套进度保持 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%。

### 8.40 2026-07-15 Domain Pack 运行时注册 fail-closed

注册表过去主要依赖 TypeScript：如果未来从 JavaScript、动态插件或反序列化配置传入的 pack 声称具备 capability、实际却缺少函数，注册会成功，直到首个流量才以 500 暴露。现在 `register` 在写入 registry 前验证 `story-agent-domain-pack/v1` schema、domain/显示名/描述/语义版本、capability 数组与完整集合，以及 search/detail/match/plan/generate/safety/GEARS 七个运行时函数实现；缺一项立即抛出 `DOMAIN_PACK_REGISTRY_INVALID`。

目录校验同步覆盖非数组 catalog、trim 后重复名称/ID、缺失或非字符串的推荐类型/表现形式、非规范 generation ID、空元数据、非字符串或非正数时长、以及非字符串 compatible entry。所有检查均先做运行时类型收窄，不让畸形对象以原生 `TypeError` 逃出统一注册错误。负向测试用错误 v99 schema、缺失 `mapGearsConstraints` 和布尔时长验证在接收流量前拒绝；合法任意领域字符串目录仍可注册。

Domain Pack/平台类型定向回归为 2 文件、11 用例，TypeScript 与 `git diff --check` 通过。P4 排除自身仍为 131 文件（80 tracked、51 untracked），`shared_core=72`、hold 0、staged 0。该门禁只验证本进程注册合同，不证明第三方插件供应链、真实生产热加载或第二领域安全审核完成；五套进度与真实信用均保持不变。

### 8.41 2026-07-15 china_culture 条目详情读取物理迁移

继续审计 628 行 legacy `services/entry-service.ts` 后确认，搜索、匹配、摘要和关键词辅助同时被故事与大纲链路复用，整文件搬迁会把多个生产调用面绑在一次高风险改动中。本轮先把可独立验收的精确详情读取迁入 `domains/china-culture/entry-detail-service.ts`：领域服务负责 MCP 详情读取、统一模型转换与 `ENTRY_NOT_FOUND` 失败合同；Domain Pack 直接绑定 `getChinaCultureEntryDetailByName`，legacy entry service 不再导出或实现详情读取。

平台 `/api/entries/detail` 路由、默认 `china_culture`、显式领域选择、成功响应和不存在条目的 404 合同均未改变。源码边界测试同时锁定 Domain Pack 必须从领域目录导入详情能力，并禁止旧 `getEntryDetailByName` 回流；搜索、匹配和跨服务共享 helper 保持原位，后续仍需按消费者边界继续拆分，不能据此宣称完整 entry service 已迁移。

服务端 TypeScript 通过，Domain Pack + Entries API 定向回归为 2 文件、204 用例（API 194）；获准环境完整 Unified CI 21/21 通过，Web Server 98 文件/944 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。默认沙箱首次运行因 Supertest 临时监听被 `listen EPERM 0.0.0.0` 统一拒绝而失败，原样在获准环境复跑后通过；该环境失败未被记作代码通过证据。P4 排除自身为 132 文件（80 tracked、52 untracked），`shared_core=73`、hold 0、staged 0。

这一切片只增加领域所有权与机器回归证据，没有执行真人条目核验、真实模型生成、真实 GEARS/Seedance 回片或发布签署。五套进度仍为综合研发 73%、专业文本 47.5%、知识库 247 条/902 来源且 M2 55/97、真实 GEARS/Seedance 0/5、发布运营 60%；测试、源码边界和本地知识读取均不增加真实修订、真人审核、signed release 或 professional pass 信用。

### 8.42 2026-07-15 china_culture 条目搜索与意图排序物理迁移

在详情读取迁移后继续做依赖闭包审计：`searchEntries`、搜索意图识别、命中理由和搜索排序只由 Domain Pack 搜索能力消费，而条目全集收集、关键词提取、匹配片段和知识摘要同时被 match、story 与 outline 使用。本轮把前一组完整迁入 `domains/china-culture/entry-search-service.ts`，Domain Pack 改调 `searchChinaCultureEntries`；后一组继续留在兼容 service 供多个既有消费者复用，没有复制文化规则，也没有强行搬迁跨服务公共 helper。

搜索领域服务继续直接调用既有 MCP 搜索与转换边界，保持空查询、无关键词筛选、关键词排序、地点/人物/民俗/宗教/事件/工艺意图、matched snippets 与 match reason 的原顺序和响应格式。源码边界测试要求 Domain Pack 从领域目录分发，并确认 legacy entry service 不再导出搜索入口、也不再包含 `detectSearchIntent` 或 `computeSearchRank`；详情、匹配和平台路由合同不变。

服务端 TypeScript 与 `git diff --check` 通过，Domain Pack + Entries API 定向回归为 2 文件、205 用例（API 194）。完整 Unified CI 21/21 通过，Web Server 98 文件/945 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、零信用门禁、治理、P4 stale-check 和无暂存检查均通过。P4 排除自身为 133 文件（80 tracked、53 untracked），`shared_core=74`、hold 0、staged 0。

匹配能力与其评分规则、跨服务共享 helper、故事生成主链和 MCP 数据适配仍未完成领域迁移，因而不宣称 entry service 或 Phase 1 已整体拆完。本地检索和机器回归没有真人事实/文化结论，不增加真实模型修订、真人审核、真实 GEARS/Seedance 回片、signed release 或 professional pass；五套进度保持 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%。

### 8.43 2026-07-15 china_culture 条目匹配、语言规则与 outline 依赖迁移

匹配依赖闭包审计确认，`matchEntries`、评分、地方化目标加权、匹配理由、文化类型关键词表与省份识别属于 `china_culture`；关键词扩展和省份识别同时被 story/outline 消费，不能只搬主函数后继续从 legacy service 反向取规则。本轮新增 `entry-match-service.ts` 与 `entry-language-helpers.ts`，Domain Pack 直接调用 `matchChinaCultureEntries`；故事服务和大纲服务分别以显式域内 import 复用关键词、省份与评分函数。

评分合同保持精确名称、核心名称、长故事、相关地点、地方化创作关系、文化意义、来源/核验/待核字段、资产拆分、省份/偏好类型和甲方指定地域的原权重与 0.99 上限；最低入选 0.35、可用阈值 0.75、排序、fallback 与中文 match reason 不变。legacy entry service 已移除 match 入口、`computeMatchScore`、类型关键词表和省份探测，只保留多消费者共用的条目收集、片段与摘要兼容层。

服务端 TypeScript 和 `git diff --check` 通过；Domain Pack + Entries API + outline 定向回归为 3 文件、238 用例。完整 Unified CI 21/21 通过：Web Server 98 文件/946 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查均通过。P4 排除自身为 136 文件（81 tracked、55 untracked），`shared_core=77`、hold 0、staged 0。

这完成了 Domain Pack 三个条目能力入口及核心文化搜索/匹配规则的物理迁移，但数据收集/片段层、MCP proxy 和故事生成主链仍待继续拆分，第二个生产领域也仍为 0。所有匹配与大纲结果是机器合同，不计真人事实/文化审核、真实修订、真实回片、signed release 或 professional pass；五套进度继续为 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%。

### 8.44 2026-07-15 china_culture entry 知识数据层完整抽取与兼容门面

三项条目能力迁移后，legacy `entry-service.ts` 只剩省份文件遍历、完整条目组装、地方化关系文本、资产拆分文本、匹配片段和故事知识摘要。本轮将这些实现整体迁入 `domains/china-culture/entry-knowledge-service.ts`，并使用显式的 `collectChinaCultureSearchableEntries`、`buildChinaCultureEntryMatchedSnippets` 和 `buildChinaCultureEntryKnowledgeSummary` 命名。搜索、匹配、story 与 outline 生产消费者全部改为直接依赖领域服务。

旧 `services/entry-service.ts` 没有删除，以兼容潜在未纳入当前搜索范围的外部 import；文件现只做三个值导出和一个类型导出的别名门面，不再 import MCP、不再声明函数或保存文化规则。源码边界测试锁定门面无逻辑、四类生产消费者直连领域知识层；仓库内生产代码对 legacy entry service 的 import 为 0。原数据字段、片段排序、120 字截断、360 字摘要、地方化关系标签和资产拆分拼接均保持兼容。

服务端 TypeScript 与 `git diff --check` 通过；Domain Pack + Entries API + outline 定向回归为 3 文件、239 用例。完整 Unified CI 21/21 通过：Web Server 98 文件/947 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、构建、知识库 lint、零信用门禁、治理、P4 stale-check 与无暂存检查均通过。P4 排除自身为 137 文件（81 tracked、56 untracked），`shared_core=78`、hold 0、staged 0。

至此当前 entry service 的运行实现已物理归入 `china_culture`，但 MCP proxy 仍是共享兼容基础设施，4k+ 故事生成服务也未完成抽取，因此 Phase 1 与完整 Domain Pack 化仍未结束。机器数据转换与回归测试不等于真人事实/文化审核，不增加真实修订、真实回片、signed release 或 professional pass；五套进度维持 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%。

### 8.45 2026-07-15 china_culture 知识源适配器物理迁移

`services/mcp-proxy.ts` 横向审计后确认只负责中国文化省份 Markdown、文化条目搜索/详情解析、MCP 内部模型到 Web 文化模型转换和文化元数据 enrich，不存在第二领域或领域中立数据源合同。本轮将实现迁入 `domains/china-culture/knowledge-source-adapter.ts`，使用 `searchChinaCultureKnowledgeBase`、`convertChinaCultureFullEntryDetail`、`readAllChinaCultureProvinceFiles` 等显式命名；entry 四个领域模块、story、outline、规划服务和系统省份路由均直接依赖该适配器。

旧 `mcp-proxy.ts` 与 entry 旧路径一样保留为无逻辑重导出门面，不删除兼容路径；它不再直接 import MCP server、不定义转换函数。系统省份路由仍属于当前文化产品能力，本轮只让依赖关系诚实显式，没有把省份概念伪装为平台通用字段。源码边界测试锁定 MCP 纯函数只由领域适配器导入、legacy 门面无函数、系统路由不回退；生产代码对旧 proxy 的 import 为 0。

服务端 TypeScript 与 `git diff --check` 通过；Domain Pack + Entries API + outline + 专业人物基准定向回归为 4 文件、244 用例。完整 Unified CI 21/21 通过：Web Server 98 文件/948 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、构建、知识库 lint、零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 分类规则同步将旧 MCP 兼容门面纳入 shared-core；排除清单报告自身后为 140 文件（83 tracked、57 untracked），`shared_core=80`、`professional_formats=3`、hold 0、staged 0。

文化元数据 enrich 和大型故事生成链仍在 legacy service 目录，第二个生产 Domain Pack 仍未建立；知识源迁移也没有新增或真人核验任何条目。五套进度继续为 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%，所有转换、测试和本地 MCP 读取均不计真实修订、真人审核、真实回片、signed release 或 professional pass。

### 8.46 2026-07-15 china_culture 条目元数据推断规则物理迁移

知识源适配器迁移后，`domain-pack-service.ts` 中仍有一组只服务中国文化条目的纯规则：知识领域推断、朝代识别、资产用途推断，以及搜索/详情元数据缺省 enrich。该组现在整体迁入 `domains/china-culture/entry-metadata-service.ts`，使用 `inferChinaCultureEntryMetadata`、`detectChinaCultureEra` 等显式命名；知识源适配器直接依赖新服务，不再反向依赖 600+ 行扩展包服务。

扩展包候选选择仍需要识别输入年代，因此 legacy domain-pack service 改为 import 同一 `detectChinaCultureEra`；旧 `inferEntryMetadata`、`enrichSearchResultWithMetadata` 和 `enrichEntryDetailWithMetadata` 出口保留为域函数别名，避免外部兼容断裂。原领域优先级、周敦颐/柳毅/近现代补充识别、12 类资产用途正则、显式 metadata 优先于推断的合并语义均保持不变；源码测试禁止旧文件重新出现三份函数实现。

服务端 TypeScript 与 `git diff --check` 通过；metadata + Domain Pack + API 定向回归为 4 文件、218 用例。完整 Unified CI 21/21 通过：Web Server 99 文件/952 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查均通过。P4 排除自身为 143 文件（84 tracked、59 untracked），`governance=14`、`shared_core=82`、hold 0、staged 0。

扩展包 seed 选择、生产健康与 append 流程仍在 legacy domain-pack service，大型故事生成链和第二生产领域也仍待后续切片。元数据推断只是机器标注，不是来源核验或文化审稿；五套进度保持 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%，不增加真实修订、真人审核、真实回片、signed release 或 professional pass。

### 8.47 2026-07-15 Track A 浏览器 E2E 隔离端口与并行开发保护

本轮基线 Unified CI 的 Web 合同、99 文件/952 用例和构建均通过，但 Track A Playwright 在执行测试前发现固定的 `localhost:5173` 已被本仓库一个持续运行的开发服务占用。该进程没有被终止或接管；问题被收口为测试基础设施缺少端口隔离，而不是以清理用户进程掩盖冲突。

Playwright 现支持 `STORY_AGENT_E2E_CLIENT_PORT` 与 `STORY_AGENT_E2E_SERVER_PORT`，Vite 同步支持经校验的 `VITE_DEV_PORT` 和 `VITE_API_PROXY_TARGET`；非法、越界端口 fail closed。开发默认仍保持 5173/3000，Unified CI 则默认使用隔离的 15173/13000。会话 cookie 改为 `localhost` 域与根路径，不再把固定客户端端口写进测试数据。源码边界测试锁定可配置端口、CI 隔离默认值和无固定 cookie URL，避免回退。

Web 类型检查、导航边界 7/7 与隔离 Track A Playwright 6/6 定向通过；随后在保留既有 5173 服务的条件下，完整 Unified CI 21/21 通过：Web Server 99 文件/953 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身为 144 文件（85 tracked、59 untracked），`governance=14`、`shared_core=83`、`professional_formats=3`、hold 0、staged 0。

端口隔离只提高本地与 CI 的可重复性，不代表真实身份 UAT、真实用户验收、真实修订、真人审核、真实 GEARS/Seedance 回片、signed release 或 professional pass。五套进度继续为综合研发 73%、专业文本 47.5%、知识库 247 条/902 来源且 M2 55/97、真实 GEARS/Seedance 0/5、发布运营 60%。

### 8.48 2026-07-15 china_culture Domain Pack 生产包运行时完整迁移

`services/domain-pack-service.ts` 的剩余实现经依赖审计确认全部固定读取 `data/domain-packs/china-culture.json`，并包含宋/唐 fallback、志异/地域/年代/GEARS 匹配、八个必需生产包健康规则和文化资产边界，不是平台通用 Domain Pack 服务。本轮将其整体迁入 `domains/china-culture/domain-pack-production-service.ts`，公开函数和类型使用 `ChinaCulture` 显式命名；旧路径保留为无函数、无 fallback、无读盘逻辑的兼容重导出门面。

当前五个生产消费者均在领域边界上取用实现：outline、系统生产健康端点、MVP 状态、GEARS 执行，以及新域内 story knowledge-pack 服务；不存在生产代码回退到旧 service 路径。metadata 兼容别名仍留在旧门面，年代识别只在域内生产服务调用。P4 分类器同步为本次新触达的 `gears-execution-service.ts` 与 `story-agent-mvp-status-service.ts` 增加精确 `shared_core` 归属；首次刷新出现的 2 个 hold 因而按可审计规则归零，没有使用宽泛匹配绕过门禁。

迁移后的生产包/metadata 定向回归为 2 文件、11 用例，Domain Pack + API + outline 为 4 文件、237 用例，Web 类型检查与 `git diff --check` 通过。最终完整 Unified CI 证据与下一节共享：21/21、Web Server 100 文件/956 用例、Track A 6/6、MCP 79 文件/345 用例。生产健康报告和本地 seed 只属于机器合同，不增加任何真人或外部交付信用。

### 8.49 2026-07-15 china_culture 单条目故事 KnowledgePack 物理抽取

按 Story Agent 生成合同先核对共享 request/schema、KnowledgePack/EntryDetail、生成 prompt、Blueprint、类型矩阵、类型质量与本地 dramatic engine 后，本轮只搬迁“单条文化条目 → 可追踪 KnowledgePack”纯准备闭包：条目摘要、查询关键词、primary source trace、最多四个文化 supporting packs 和置信度保持原值。新实现位于 `story-knowledge-pack-service.ts`；故事总编排器不再直接拼文化 entry summary 或追加文化 Domain Pack，只调用域内服务。模型选择/调用、scene skeleton、Blueprint、类型路由、质量阈值、repair、落盘、安全门禁和 GEARS 输出均未改动。

生成相关定向回归为 4 文件、32 用例，知识包 + Domain Pack + API + outline 为 4 文件、235 用例。首次全量 Web 回归为 100 文件中 99 通过、956 用例中 955 通过；唯一失败是旧源码边界断言仍要求 story service 直接 import entry knowledge。断言已收紧为 `story orchestrator → story knowledge pack → entry knowledge`，3 文件/23 用例复验通过，随后完整 Unified CI 21/21 通过：Web Server 100 文件/956 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、构建、知识库 lint、零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。

P4 排除自身为 150 文件（88 tracked、62 untracked），`governance=14`、`shared_core=89`、`professional_formats=3`、hold 0、staged 0。本轮没有注册第二生产领域，也没有调用真实模型、真人审稿或真实 GEARS/Seedance；五套进度维持 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%，fixture、fallback、健康报告与机器测试均不计真实信用。

### 8.50 2026-07-15 china_culture 故事来源解析与 EntryDetail 合成迁移

故事总编排器的来源前置段原本直接读取中国文化知识源，并在本文件合成“用户原创/小说素材”与 MaterialPack 对应的文化 `EntryDetail`。本轮将四种输入优先级完整迁入 `story-source-service.ts`：KnowledgePack 主条目优先于显式 `entry_name`，随后是已声明原创/改编模式的用户 outline/query，最后是非空 MaterialPack；没有可用来源时继续 fail closed。主条目缺失与显式条目缺失仍分别返回原 `ENTRY_NOT_FOUND` 文案，空来源继续返回原 `VALIDATION_ERROR`。

用户素材的标题截断、原创/改编类型、文化意义、事实边界、来源和可信度保持原值；MaterialPack 的 primary/reference/supporting 选择顺序、摘要、uncertain claims、0.7 置信度门槛和 12 关键词截断保持原值。新测试一度错误要求 tags 必然进入已满的 12 关键词上限，40 条中 39 条通过；该假设被移除，没有借迁移改变既有排序/截断规则。KnowledgePack/MaterialPack 相互转换、创作合同、模型/Blueprint/质量/repair/落盘和 GEARS 流程仍留在总编排器且未变。

来源/生成边界定向回归为 4 文件、40 用例，来源 + KnowledgePack + API + outline 为 4 文件、233 用例；Web 类型检查和 `git diff --check` 通过。完整 Unified CI 21/21 通过：Web Server 101 文件/961 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 与无暂存检查均通过。P4 排除自身为 152 文件（88 tracked、64 untracked），`shared_core=91`、hold 0、staged 0。

该切片只是文化领域来源适配与机器合同，不证明用户素材权利、事实真伪、真人审稿或真实生成完成。五套进度继续为综合研发 73%、专业文本 47.5%、知识库 247 条/902 来源且 M2 55/97、真实 GEARS/Seedance 0/5、发布运营 60%，不增加真实修订、真人审核、signed release 或 professional pass。

### 8.51 2026-07-15 china_culture 故事补充任务规则物理迁移

故事总编排器中“知识缺口 + 素材充分性 + 生产模板缺口 → 补充任务”的实现包含人物经历、配角、建筑、事件、地域、文化背景和通用资料七类中文语义规则，属于 `china_culture` 而非平台通用生成调度。本轮将完整闭包迁入 `story-supplement-task-service.ts`；总编排器只传入三个报告和 story/time context，不再保存分类正则、中文 intake 文案、task id 清理、重复项合并、stage 继承或 production affects 映射。质量报告附加函数仍留在总编排器，没有扩大迁移范围。

领域测试锁定七类分类顺序；同一 knowledge missing need 与 `missing_need_*` 素材项只形成一条任务，继承 script-ready stage、blocking、affects 与 recommended question，并把内部“知识库/知识包”措辞转换为面向用户的“项目素材/素材包”。三个生产阶段分别继续影响 blueprint/logline、full_text/scene_breakdown、gears_segments/asset_handoff；所有任务维持 open 状态和原 source 类型。

补充任务/来源/KnowledgePack/生成定向回归为 4 文件、30 用例，补充任务 + 来源 + API + outline 为 4 文件、235 用例，Web 类型检查与 `git diff --check` 通过。完整 Unified CI 21/21 通过：Web Server 102 文件/965 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身为 154 文件（88 tracked、66 untracked），`shared_core=93`、hold 0、staged 0。

补充任务仍是机器建议，不代表任何资料已补充、来源已核验或真人已审核；五套进度维持 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%，不增加真实修订、真人审核、真实回片、signed release 或 professional pass。

### 8.52 2026-07-15 平台 scene→GEARS 映射抽取与旧死代码清理

生成主链横向调用审计确认：legacy `buildSceneBreakdown`、其人物名称启发式、`buildActStructure`、七组本地时长表和相关镜头常量均为零调用，当前生产内容已由 `dramatic-story`/memory mosaic engine 形成；旧注释也明确它们已被替代。本轮删除这些已证明的死代码，不迁移无效 fallback。仍被模型输出合并与人物提示合并两条生产路径调用的 scene→GEARS 映射迁入 `platform/story-gears-segment.ts`，不写入 `china_culture` 领域目录。

平台 mapper 保持 12–120 秒已知时长到 6/8/9/10/12 格 panel count 的原映射，未知时长仍为 6；script_text、前三项 visual focus、主体/动作 prompt hint、scene cultural note、video type 和表现形式逐项兼容。源码测试锁定故事总编排器不再保存旧 scene/act/duration/GEARS 实现，并确认两个活跃 rebuild 调用都通过平台函数。

平台/生成/领域边界定向回归为 4 文件、40 用例，平台 + 生成 + API 为 3 文件、216 用例，Web 类型检查与 `git diff --check` 通过。首次完整 CI 在 Web 全量并发中有一条既有 Seedance recovery 参数校验超过默认 5 秒，103 文件/968 用例中 102/967 通过；该测试单独运行 14ms 通过，原样完整重跑随后 21/21 通过：Web Server 103 文件/968 用例、Track A 6/6、MCP 79 文件/345 用例、构建、知识库 lint、零信用门禁、治理、P4 stale-check 与无暂存检查均通过。没有修改业务逻辑、断言或测试超时掩盖该失败。

P4 排除自身为 156 文件（88 tracked、68 untracked），`shared_core=95`、hold 0、staged 0。平台映射与 fallback/机器测试不等于真实 GEARS 执行或回片；五套进度维持 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%，不增加任何真实信用。

### 8.53 2026-07-15 平台模型输出合并与人物提示边界抽取

故事总编排器内的模型场景兼容检查、模型输出覆盖本地骨架，以及 outline 人物提示合入最终故事均为领域中立的生成后处理。本轮将完整闭包迁入 `platform/story-model-output-merge.ts`；生产总编排器直接依赖平台模块，同时保留旧 `story-service.ts` 的三个兼容重导出，不再在巨型服务内保存重复实现。既有测试改为直接验证平台出口，并新增源码边界测试阻止实现回流。

迁移保持 scene 数量、scene id 完全一致且唯一的 fail-closed 门禁；本地时长、scene id 等结构字段不变，模型只覆盖兼容的创意字段。顶层文化约束仍以本地基线加模型补充去重合并，可信度说明仍保留本地文本并明确标注“模型补充”；人物提示的五类角色映射、名称清洗、场景匹配、recurring fallback 和 GEARS 重新构建均保持原语义。模型 provider/prompt、Blueprint、类型矩阵、类型质量、repair、Domain Pack 安全校验、落盘与外部交付流程未改动。

Web 类型与可见文案检查通过；模型输出合并/GEARS 平台定向回归为 3 文件、23 用例，扩展的 Domain Pack/platform/generation 回归为 9 文件、66 用例。首次完整 CI 在受限沙箱中因 Supertest 临时监听统一被 `listen EPERM 0.0.0.0` 拒绝，造成 24 文件 242 条级联失败；未修改代码、断言、端口或超时，原命令在获准环境复跑后完整 21/21 通过：Web Server 104 文件/969 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 与无暂存检查均通过。

P4 排除自身为 158 文件（88 tracked、70 untracked），`shared_core=97`、hold 0、staged 0。该抽取没有调用真实模型、真人审稿或真实 GEARS/Seedance；五套进度继续为综合研发 73%、专业文本 47.5%、知识库 247 条/902 来源且 M2 55/97、真实 GEARS/Seedance 0/5、发布运营 60%，fixture、fallback、机器测试和兼容门禁均不计真实修订、真人审核、真实回片、signed release 或 professional pass。

### 8.54 2026-07-15 平台故事生成策略边界抽取

视频类型优先级、15 个 `VideoType` 到三个 legacy generation family 的映射、小说改编 narrative pattern 补全/去重/六项上限、三档 story priority 指令，以及显式结构兼容与默认结构选择迁入 `platform/story-generation-policy.ts`。平台函数不写入“历史人物”字符串；文化入口只在调用处把 `entry.type === '历史人物'` 转换为 `historical_person_entry` 布尔信号。主服务不再保存五组策略函数。

Web 类型检查通过，平台策略 + 视频类型矩阵 + 生成模型/prompt/bridge 定向回归为 5 文件、40 用例。该策略抽取不改变 prompt schema、Blueprint、genre matrix、质量阈值、repair 或持久化，不代表真实模型生成或真人审核。

### 8.55 2026-07-15 china_culture 类型专属故事字段派生迁移

推广类视觉符号/技艺流程/现代连接/核心信息/标语，场景类空间身份/视觉路线/时间层/氛围，漫剧对白，讲解类论点/知识提纲，以及纪录片引文/田野备注均依赖文化 `EntryDetail` 字段与中文规则，本轮迁入 `story-type-specific-fields-service.ts`。模型字段仍优先，本地 fallback 顺序、截断、关键词过滤、情绪映射和输出字段保持原值。

直接回归为 4 文件、41 用例，获准环境视频类型矩阵 + API 为 2 文件、195 用例。新测试最初错误假定中文弯引号会被既有 `extractQuotes` 识别，并漏掉“云锦”同样命中“云”意境词；预期按真实旧行为校正，没有借迁移扩大引文识别或改变氛围规则。

### 8.56 2026-07-15 china_culture 本地故事引擎分派与回忆拼图 fail-closed

dramatic 与 memory-mosaic 的本地结构骨架分派、memory seed 及 style pack reference trace 迁入 `story-local-generation-service.ts`。总编排器只接收 `storyResult`、可选 memory seed 与 trace，不再直接调用两个本地生成器或组装其风格规则。

迁移测试发现既有回忆拼图生成器在资料无法识别任何见证人物时会对空数组取模并抛 `TypeError`。新域边界在生成内容、模型调用、项目创建和 story 写入之前检查 seed；零见证人物时返回明确 `VALIDATION_ERROR`，要求补充人物关系或改用其他结构。没有虚构“匿名见证人”，也没有把 fallback 计作真实资料。直接回归为 5 文件、45 用例，获准视频类型矩阵 + API 为 2 文件、195 用例。

### 8.57 2026-07-15 生成后持久化与 GEARS 通知平台边界

项目创建、story repository 不覆盖写入、内部 `_request_meta` 剥离、GEARS story-ready 通知、Project 当前 webhook 状态同步，以及 webhook URL 查询参数脱敏迁入 `platform/generated-story-persistence.ts`。通知仍保持“配置真实 URL 时不阻塞 API、未配置时等待 skipped 状态同步”的原时序；repository 冲突仍抛 `StoryRepositoryConflictError` 并由统一 handler 映射 409。

定向生成/persistence/repository/webhook 回归为 5 文件、41 用例，获准 API/视频类型矩阵/webhook 为 3 文件、202 用例。该本地持久化与通知合同不表示真实外部 worker、回调或公共 artifact 已就绪。

### 8.58 2026-07-15 Story 平台存储发现与读取服务抽取

15 个 story video-type 目录、Story/Project repository 构造、list 过滤与排序、旧快照 API 规范化，以及“可编辑项目当前版本优先于 immutable story snapshot”的读取规则分别迁入 `platform/story-storage.ts` 和 `platform/story-read-service.ts`。旧 `story-service.ts` 保留 `listStories`/`getStory` 兼容再导出，生产读取路径不变。

定向读取/repository/生成回归为 5 文件、42 用例，获准 API + Story/Project repository 为 3 文件、214 用例。读取错误仍 fail closed，损坏或无权访问的 repository 条目不会被推断修复。

### 8.59 2026-07-15 GEARS/Seedance 交付读取与双仓写回平台边界

GEARS segments/v2 聚合、legacy source domain 兼容、Domain Pack constraint 映射、delivery/Seedance 包读取，以及 GEARS Markdown/视频结果的 Story + Project 双仓写回迁入 `platform/story-delivery-service.ts`。旧故事服务只保留五个兼容再导出；schema version、总时长、constraint note 去重、CAS repository 写入、received/updated 时间语义和错误码均保持不变。

定向 delivery/read/repository/webhook 回归为 5 文件、29 用例，获准 API + Story/Project repository 为 3 文件、214 用例。累计切片随后完整 Unified CI 21/21 通过：Web Server 110 文件/986 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 与无暂存检查全部通过。

P4 排除自身为 171 文件（88 tracked、83 untracked），`governance=14`、`production_docs=43`、`professional_formats=3`、`shared_core=110`、`stage6=1`，hold 0、staged 0。以上均为机器架构、fallback 与回归证据；五套进度保持综合研发 73%、专业文本 47.5%、知识库 247 条/902 来源且 M2 55/97、真实 GEARS/Seedance 0/5、发布运营 60%，不增加真实修订、真人审核、真实回片、signed release 或 professional pass。

### 8.60 2026-07-15 回忆拼图 API fail-closed 与 Stories 状态码修复

回忆拼图零见证人物的域级测试扩展到真实 Stories API：outline-only 原创请求显式选择 `memory_mosaic_biography`，服务在任何项目创建前返回 `VALIDATION_ERROR`；测试同时读取前后项目列表并确认数量不变。该测试首次得到 HTTP 404，响应 envelope 内错误码却已是 `VALIDATION_ERROR`，定位到 `/api/stories/generate` 把除 Domain Safety 外的所有业务失败硬编码为 404。

路由现与 Projects/Outline 的既有合同一致：`VALIDATION_ERROR=400`、`DOMAIN_SAFETY_VALIDATION_FAILED=422`、缺失条目/Domain 等其余失败为 404。API 全量 195/195 通过；主故事服务中零调用的旧 `slugify` 同步删除并由源码测试锁定。该修复不生成项目、不创建 story、不调用真实模型，也不产生任何真实信用。

### 8.61 2026-07-15 平台故事质量评估编排抽取

genre quality、creation/truth/material context 回填、quality workflow enrich 与 GEARS delivery enrich 的固定调用顺序迁入 `platform/story-quality-evaluation.ts`。初始生成、repair 候选和 repair 回滚现在调用同一 `evaluateStoryQualityReport`；交付包完成后调用单独的 delivery enrich。底层 dramatic/memory 质量验证、genre 权重/阈值、repair 触发条件和“修复分数不升则回滚”均未改变。

质量/repair 定向回归为 6 文件、41 用例，获准 API + 视频类型矩阵为 2 文件、196 用例。机器质量报告、阈值与 repair simulation 仍不计 professional pass、真人修订或真人评审。

### 8.62 2026-07-15 平台外部模型最终结果选择抽取

`resolveStoryGenerationResult` 进入 `story-model-output-merge.ts`，统一处理四类结果：兼容模型输出成为 `external_model`、scene 骨架不兼容时整包 `local_fallback`、adapter 失败时带原因 fallback、未配置 adapter 时保持 `local_only` 且不误标失败。总编排器只消费 story result/mode/fallback/trace 并追加 reference trace；文化约束、可信度、本地骨架与人物提示合并仍由同一平台边界保护。

模型/repair 定向回归为 4 文件、26 用例。累计最终完整 Unified CI 21/21 通过：Web Server 111 文件/991 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身为 173 文件（88 tracked、85 untracked），`shared_core=112`、hold 0、staged 0。

本轮没有真实 provider 凭据、真实模型调用、真人稿件修订或外部交付；五套进度继续为 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%，所有 local-only/fallback/测试证据均明确排除真实修订、真人审核、真实回片、signed release 与 professional pass。

### 8.63 2026-07-15 china_culture repair 组装回填与平台 Story 标识边界

repair 候选通过质量比较后，原总编排器会再次逐项覆盖标题、logline、正文、场景、GEARS、文化约束、可信度、人物、幕结构、主角弧和类型专属字段；这与首次组装是同一组中国文化 `EntryDetail`/`VideoType` 语义。本轮把该闭包合入既有 `story-type-specific-fields-service.ts`，统一由 `applyChinaCultureStoryAssemblyToStoryData` 处理初始结果和 repair 胜出结果。总编排器不再保存重复的 story-data mutation helper，repair 分数未提升时的回滚、质量阈值和模型优先字段语义均未改变。

Story ID 的日期、时间、UUID、随机扰动和字符和计算迁入 `platform/story-identity.ts`；总编排器只调用 `generateStoryId`。格式继续为 `YYYYMMDD-story-<base36+uuid-suffix>`，注入时钟/UUID/随机源的测试锁定可重复行为，并验证条目名称不会直接出现在标识中。该抽取不改变 repository 冲突、项目创建顺序、API 响应或任何真实身份合同。

类型字段/repair 直接回归为 4 文件、29 用例，Story 标识/生成边界直接回归为 3 文件、29 用例，获准环境 API + 视频类型矩阵为 2 文件、196 用例。最终完整 Unified CI 21/21 通过：Web Server 112 文件/995 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身为 175 文件（88 tracked、87 untracked），`governance=14`、`production_docs=43`、`professional_formats=3`、`shared_core=114`、`stage6=1`，hold 0、staged 0。

以上仍只是机器架构与回归证据，没有真实模型调用、真人 repair、真人事实/文化审核、真实 GEARS/Seedance 回片或发布签署。五套进度维持综合研发 73%、专业文本 47.5%、知识库 247 条/902 来源且 M2 55/97、真实 GEARS/Seedance 0/5、发布运营 60%；fixture、simulation、fallback、prepared、readiness、机器阈值、测试验签、截图和 memory handoff 均不计真实修订、真人审核、signed release 或 professional pass。

### 8.64 2026-07-15 平台 repair 状态机与 china_culture 基础质量验证抽取

repair 主链依赖闭包分为两层：dramatic/memory-mosaic 基础质量选择依赖当前文化领域的本地故事结构与 memory seed，现迁入 `domains/china-culture/story-base-quality-service.ts`；是否尝试 repair、构造 repair prompt、调用同一模型适配器、scene 骨架兼容门禁、候选合并、质量分数比较、应用/回滚和 trace 原因则为领域中立流程，现迁入 `platform/story-repair-orchestration.ts`。平台层只通过 `applyStoryAssembly` 与 `evaluateStoryQuality` 回调接入领域规则，不 import `china-culture`。

总生成编排器不再直接 import repair prompt 服务，不保存 `repair_scene_breakdown_incompatible`、`repair_score_not_improved`、模型兼容判断或 repair trace 构造；初始与 repair 候选共用同一领域基础验证，组装回填仍经 8.63 的领域边界。注入式适配器测试覆盖关闭 auto-repair、adapter 无输出、scene 不兼容、分数不降应用和分数下降回滚五条状态路径，并锁定回滚恢复原模型类型字段来源。真实模型适配器、prompt 内容、阈值、scene 合并、repository 和 Domain Pack 安全门禁均未改变。

平台/领域 repair 直接回归为 5 文件、16 用例，获准环境 API + 15 类型矩阵为 2 文件、196 用例，TypeScript 和 `git diff --check` 通过。完整 Unified CI 21/21 通过：Web Server 113 文件/1001 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。`story-service.ts` 由 568 行降至 494 行；P4 排除自身为 178 文件（88 tracked、90 untracked），`governance=14`、`production_docs=43`、`professional_formats=3`、`shared_core=117`、`stage6=1`，hold 0、staged 0。

repair adapter fixture、机器质量比较、local fallback 和 trace 只是机器合同，没有发生真人修订、真实 provider 调用或专业验收。五套进度继续为 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%，不增加真人审核、真实回片、signed release 或 professional pass。

### 8.65 2026-07-15 china_culture 生成前准备闭包抽取

总编排器在本地/外部生成前原本同时承担来源解析、KnowledgePack/MaterialPack 互转、视频/表现/结构策略、类型矩阵、创作合同、素材充分度、小说改编分析、生产素材 readiness、模型档案选择、文化事件选择和初步 StoryBlueprint 组装。这些步骤共享当前 `china_culture EntryDetail` 和文化事件语义，若只把通用函数搬到平台会留下跨层拼装；本轮把完整依赖闭包迁入 `story-generation-preparation-service.ts`，主服务只处理 fail-closed 结果并消费显式准备输出。

准备服务仍调用既有平台生成策略，不复制类型映射；文化来源、知识包与事件提取保持域内调用链。KnowledgePack 优先、MaterialPack 转换、用户原创/小说改编来源、历史人物结构信号、genre matrix 重写 narrative patterns、truth/creation contract、生产上下文文本、模型选择和 Blueprint 参数顺序均未改变。直接测试使用用户原创与用户小说素材验证“不依赖真实知识源的机器准备”，并保留无来源 `VALIDATION_ERROR`；这些用户素材 fixture 不被当成确权或事实证据。

首次完整 CI 的业务 API 已通过，但 4 条旧源码边界断言仍要求主服务直接 import 已下沉的 knowledge-pack/规划能力；断言被改为锁定 `主编排器 → preparation → knowledge-pack/planning → Domain Pack` 完整链路，没有恢复旧依赖。第二次运行代码、Web 114/1004、浏览器和 MCP 均通过，最终仅因断言文件更新后的 P4 内容哈希尚未刷新被 stale-check 拦截；刷新 P4 后原样第三次运行完整 21/21 通过。

准备/策略/来源/领域链直接回归为 7 文件、40 用例，获准环境 API + 15 类型矩阵为 2 文件、196 用例，最终 Unified CI 为 Web Server 114 文件/1004 用例、Track A Playwright 6/6、MCP 79 文件/345 用例，并通过 Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查。`story-service.ts` 由 494 行降至 393 行；P4 排除自身为 180 文件（88 tracked、92 untracked），`governance=14`、`production_docs=43`、`professional_formats=3`、`shared_core=119`、`stage6=1`，hold 0、staged 0。

本轮没有真实知识核验、素材确权、模型调用、真人审稿或外部交付。五套进度保持 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%；prepared input、fixture、readiness、Blueprint 和机器回归不计真实修订、真人审核、真实回片、signed release 或 professional pass。

### 8.66 2026-07-15 china_culture 初始 Story 文档构造器抽取

生成结果进入质量/repair 前的 Story 文档组装同时包含文化 `EntryDetail`、类型专属字段、补充任务、素材/可信度上下文和内部 request metadata，不能归为纯平台对象。本轮新增 `story-document-service.ts`，统一构造生成来源标签、Story/GEARS URL、Blueprint、KnowledgePack/MaterialPack、creation/truth、production readiness、reference/memory trace、supplement tasks、初始 GEARS webhook、角色/幕结构/主角弧、类型专属字段和 `_request_meta`。构造器消费 8.65 的显式准备结果，不重新计算来源、策略或质量。

主编排器不再保存 `generation_source` 三态文案、GEARS URL、输出 segments 选择、supplement 调用、初始 webhook、类型字段派生或 `_request_meta` 字段清单；仍负责生成 ID/Blueprint scene 绑定、基础与综合质量评估、平台 repair、Domain Pack safety 和持久化。repair 回调继续通过领域 assembly 服务更新既有文档，文档构造器不接管流程控制。源码测试锁定上述所有权，supplement 测试同步验证 `主编排器 → document → supplement` 依赖链。

文档/supplement/type-field/persistence/repair 直接回归为 5 文件、17 用例，获准环境 API + 15 类型矩阵为 2 文件、196 用例，TypeScript 和 `git diff --check` 通过。完整 Unified CI 21/21 通过：Web Server 115 文件/1005 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。`story-service.ts` 由 393 行降至 306 行；P4 排除自身为 182 文件（88 tracked、94 untracked），`governance=14`、`production_docs=43`、`professional_formats=3`、`shared_core=121`、`stage6=1`，hold 0、staged 0。

初始 Story 文档、内部元数据、fixture 和机器字段兼容只属于架构与回归证据，不表示真实模型输出、真人修订、真人审核、真实 GEARS/Seedance 回片或发布签署。五套进度继续为综合研发 73%、专业文本 47.5%、知识库 247 条/902 来源且 M2 55/97、真实 GEARS/Seedance 0/5、发布运营 60%。

### 8.67 2026-07-15 china_culture 故事生成执行闭包抽取

准备完成后的 `local skeleton → prompt package → model adapter → external/local resolution → adapter trace → character hints` 是一个不可拆散的执行闭包：local engine 与 prompt 均消费当前文化 Entry/KnowledgePack/Blueprint，而模型兼容合并使用平台边界。本轮新增 `story-generation-execution-service.ts`，由领域服务顺序调用既有 local generation、prompt、adapter 和平台 model-output merge；顶层总编排器只处理 fail-closed 结果并消费 story、memory seed、reference trace、prompt、adapter metadata 和 generation mode。

执行服务保留“始终先生成 local skeleton”、adapter 未配置/失败时 whole fallback、scene 数量与 ID 兼容门禁、文化约束/可信度本地基线、adapter trace 追加和 character hints 后置合并。它没有修改 provider、prompt schema、模型输出 Zod、人物匹配或 fallback 文案。源码测试锁定顶层不再直接构造 prompt、调用 adapter、解析 model resolution、追加 adapter trace 或合并 character hints，并验证平台 merge 仍无 `china_culture` 依赖。

执行/local/model/prompt/platform 直接回归为 5 文件、41 用例，获准环境 API + 15 类型矩阵为 2 文件、196 用例，TypeScript 与 `git diff --check` 通过。完整 Unified CI 21/21 通过：Web Server 116 文件/1006 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。`story-service.ts` 由 306 行降至 217 行；P4 排除自身为 184 文件（88 tracked、96 untracked），`governance=14`、`production_docs=43`、`professional_formats=3`、`shared_core=123`、`stage6=1`，hold 0、staged 0。

本轮 adapter 未配置路径、local skeleton、fallback、trace 和 character hint 测试均为机器证据；没有真实 provider 凭据或调用，没有真人修订、真人审核、真实回片、signed release 或 professional pass。五套进度保持 73%、47.5%、247 条/902 来源且 M2 55/97、0/5、60%。

### 8.68 2026-07-15 平台生成后质量、repair 与 delivery 编排抽取

初始 Story 文档生成后的固定状态序列为：综合质量评估 → 可选 repair → repair 应用/回滚 → GEARS delivery package → delivery readiness enrich。各底层能力已在 8.61/8.64 分别抽取，但调用和 mutation 顺序仍散落在顶层服务。本轮新增 `platform/story-post-generation-orchestration.ts`，集中该领域中立状态机；`china_culture` 只通过回调提供 assembly 应用和 dramatic/memory 基础质量验证。

平台状态机先把初始 base report 送入统一质量评估，再把结果交给既有 repair orchestration；无论 repair 跳过、失败、应用或回滚，随后只基于最终 Story 构造 GEARS delivery 并执行 delivery enrich。源码测试锁定四段顺序，且主服务不再直接 import quality evaluation、repair orchestration 或 GEARS delivery builder。genre 阈值、repair prompt/score、GEARS schema、quality 字段和 Domain Pack safety 顺序均未改变。

post-generation/quality/repair/document/execution 直接回归为 4 文件、9 用例，获准环境 API + 15 类型矩阵为 2 文件、196 用例，TypeScript 与 `git diff --check` 通过。完整 Unified CI 21/21 通过：Web Server 116 文件/1006 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。`story-service.ts` 由 217 行降至 187 行，现主要呈现 prepare、execute、document、post-process、safety、persist 六步；P4 排除自身为 185 文件（88 tracked、97 untracked），`governance=14`、`production_docs=43`、`professional_formats=3`、`shared_core=124`、`stage6=1`，hold 0、staged 0。

质量阈值、repair、delivery readiness 和本地 GEARS package 均是机器证据，不计真实模型修订、真人审核、真实回片、signed release 或 professional pass。五套进度最终保持综合研发 73%、专业文本 47.5%、知识库 247 条/902 来源且 M2 55/97、真实 GEARS/Seedance 0/5、发布运营 60%。

### 8.69 2026-07-15 china_culture 六步生成协调归域与 legacy Story 门面收口

8.68 后 `story-service.ts` 虽已只剩 prepare、execute、document、post-process、safety、persist 六步，但仍由 legacy service 直接拼接全部 `china_culture` 领域服务和平台能力，且 `china-culture/domain-pack.ts` 反向 import legacy service，形成不必要的领域包 → 兼容层 → 领域实现依赖环。本轮新增 `domains/china-culture/story-generation-service.ts`，完整承接六步协调、Story ID/Blueprint scene 绑定、基础质量、repair 回填、领域 safety 和持久化；Domain Pack 改为直接调用该领域入口。

`services/story-service.ts` 由 187 行收口为 17 行逻辑零实现兼容门面，继续原名再导出 `generateAndStoreStory`、读取、GEARS/Seedance 交付和模型合并函数，现有 routes、AI 漫剧系列与测试 import path 无需迁移。生成请求/响应、source domain、领域安全、quality/repair 顺序、repository 与 webhook 行为未改变。新的源码边界测试锁定 legacy 门面无函数实现、Domain Pack 不再依赖门面，以及领域协调器六步顺序；既有领域/平台边界断言同步改为检查真实生产协调器，避免用兼容门面的空壳误判所有权。

定向边界回归为 17 文件、65 用例，获准环境 Story API + 15 类型矩阵为 2 文件、196 用例，TypeScript 与 `git diff --check` 通过。最终完整 Unified CI、P4 inventory 和提交证据见本节后续收口记录；本轮不改变五套进度：综合研发 73%、专业文本 47.5%、知识库 247 条/902 来源且 M2 55/97、真实 GEARS/Seedance 0/5、发布运营 60%。兼容门面、机器架构、fixture、fallback 和测试验签均不计真实模型修订、真人审核、真实回片、signed release 或 professional pass。

### 8.70 2026-07-16 AI 漫剧分集最终化前移、Domain Pack safety 与 Story 所有权闭环

8.69 收口 legacy Story 门面后，AI 漫剧分集仍直接调用其兼容导出：基础 Story 已先完成 Domain Pack 之外的持久化，外层才重写观众稿、分场、GEARS 和连续性报告，并再次覆盖 Story/Project 当前状态。这使 `domain_safety` 实际评估的是分集最终化之前的版本；同时 `/ai-comic-episode` 路由虽已通过系列资源权限中间件，当前操作者身份却没有进入新建 Story 项目的 `access_control`。

本轮在 `DomainStoryGenerateOptions` 增加领域中立的 `transform_story_before_validation_and_persistence` 内部回调。`china_culture` 协调器固定执行 `post-generation -> consumer finalization -> domain safety -> first persistence`，并在 transform 后保留内部 `_request_meta`；AI 漫剧服务直接调用不可绕过领域标识与安全校验的 `china_culture` 生成入口，在回调中完成观众稿重写、分集蓝图、质量与连续性报告，不再使用二次 Story/Project 覆盖 helper。最终 Story 的正文、场景、安全报告和首次项目版本现为同一对象。该入口不再依赖调用方注入 `source_domain` 或安全函数，也避免 AI 漫剧服务反向初始化领域注册表造成的循环依赖；新增失败关闭测试确认最终化移除来源痕迹时返回 `DOMAIN_SAFETY_VALIDATION_FAILED`，且 Story/Project 均不落盘。

分集生成新增可选资源所有权参数：已有系列优先继承系列项目的 `access_control`，无系列项目时接收路由认证操作者所有权；路由同时把 `DOMAIN_SAFETY_VALIDATION_FAILED` 映射为 422。定向回归覆盖新建分集 Story 的操作者所有权、已有系列所有权继承、最终 Story/Project 快照一致、最终版本 `domain_safety` 通过，以及 AI 漫剧不再直调 legacy 生成/二次覆盖。最终定向回归为 5 文件、258 用例，TypeScript 与 `git diff --check` 通过。首次完整 CI 在受限沙箱中因 Supertest 临时监听被 `listen EPERM 0.0.0.0` 统一拒绝，导致 24 文件、243 用例级联失败；未修改代码、断言、端口或超时，原命令在允许临时监听的受控环境重跑后 21/21 通过：Web Server 117 文件/1008 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身为 37 文件、hold 0、staged 0。

同期外部/并发知识扩充把正式条目推进到 262 条、960 个来源，M2 机器写入与校验为 70/97；这些变化完整保留且不与本轮 Story 文件重叠。人审仍为 0。五套进度为综合研发 73%、专业文本 47.5%、知识内容 262 条/960 来源且 M2 70/97、真实 GEARS/Seedance 0/5、发布运营 60%。机器 safety、fallback、测试与 machine-validated 知识条目均不计真人审核、真实修订、真实回片、signed release 或 professional pass。

### 8.71 2026-07-16 Project source domain 去硬编码与版本一致性

Domain Pack 已允许按 `sourceDomain` 分发生成和 GEARS 约束，但平台 `StoryProjectListItem.source_domain` 仍被类型限制为字面量 `china_culture`，`buildProjectMeta` 也无条件写入该值。结果是未来第二生产领域即使生成了带正确 `sourceDomain` 的 Story，项目列表、详情和持久化元数据仍会被错误归域。本轮新增平台 `resolveStorySourceDomain` 单一解析入口：显式 Story 领域经 trim 后原样保留；只有旧快照缺字段时才回落到 `china_culture`。

项目首版 Story 快照、Project meta、创建响应、后续版本 meta 和详情水合统一使用该解析入口；共享 Project 类型改为接受领域字符串。GEARS segments 读取复用同一解析器，删除自己的重复 legacy 常量。定向测试验证旧 Story 创建后响应、快照和项目都显式为 `china_culture`，并验证 `second_domain` 从创建到列表、详情和当前 Story 全程不被重标；项目/API/平台交付边界回归为 3 文件、254 用例，服务端 TypeScript 通过。最终完整 Unified CI 21/21 通过：Web Server 117 文件/1009 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身为 43 文件、hold 0、staged 0。

该切片只解除第二领域的硬编码架构阻塞，没有注册或运行第二生产领域，也没有真实模型、真人审稿、真实媒体回片或发布签署。五套进度保持综合研发 73%、专业文本 47.5%、知识内容 262 条/960 来源且 M2 70/97、真实 GEARS/Seedance 0/5、发布运营 60%；类型、fallback 和机器测试不计真实修订、真人审核、signed release 或 professional pass。

### 8.72 2026-07-16 Story/Project 列表与交付包 source domain 闭环

8.71 解决了 Project 持久化硬编码，但 Story 列表摘要仍不返回 `sourceDomain`，Story 详情对旧快照也只隐式依赖下游 fallback；Story 和 Project 列表均不能按领域筛选。第二生产领域即使成功写入，也会在发现层丢失归属。共享 `StoryListItem` 现显式包含 `sourceDomain`，平台 read service 对列表和详情统一使用 `resolveStorySourceDomain`；`/api/stories` 新增带 schema 校验的 `domain` 查询，`/api/projects` 复用同一领域标识合同。显式筛选先经 registry 验证：非法标识返回 400，未注册领域返回 `DOMAIN_PACK_NOT_FOUND`，注册领域才进入读取和既有资源权限过滤。

GEARS v1 delivery package 和 Seedance prompt package 此前同样只有 `storyId`。两者的 JSON 与 Markdown 现均携带 `sourceDomain`；GEARS ensure 路径以当前 Story 为准刷新领域，旧内嵌 markdown 若缺该行会重建，避免编辑后继续传播无归属交付物。平台运行测试覆盖旧 Story 详情回落、`second_domain` 列表筛选；API 覆盖 Story/Project 注册领域、非法领域与未注册领域；Project 权限过滤、GEARS/Seedance 构造和保存路径一并回归。Web check 通过，累计定向回归为 8 文件、304 用例。首次 P4 刷新识别 `seedance-prompt-service.ts` 为唯一 hold；分类器只增加该核心服务的精确 shared_core 路径，不扩大通配范围，刷新后恢复 0 hold。最终完整 Unified CI 21/21 通过：Web Server 118 文件/1016 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身为 58 文件、hold 0、staged 0。

本切片没有提供第二领域的真实内容、来源、安全规则或生产适配器，也没有外部 GEARS/Seedance 调用。五套进度继续为综合研发 73%、专业文本 47.5%、知识内容 262 条/960 来源且 M2 70/97、真实 GEARS/Seedance 0/5、发布运营 60%；列表筛选、机器测试、fallback、readiness 和本地交付包均不计真实修订、真人审核、真实回片、signed release 或 professional pass。

### 8.73 2026-07-16 MCP GEARS/Seedance source domain 合同对齐

Web 交付包已在 8.72 闭合 `sourceDomain`，但 MCP 的 `kb_generate_gears_delivery` 与 `kb_generate_seedance_prompt` 仍在项目读取时丢弃现成的 `project.source_domain`，包级 JSON 和 Markdown 也没有领域归属。第二生产领域经 MCP 交付时会因此失去溯源，形成 Web/MCP 合同漂移。本轮新增 MCP 共享领域解析器：故事显式 `sourceDomain` 经 trim 后原样保留；项目路径在当前 Story 缺字段时继承 `project.source_domain`；只有旧 story 文件与无字段 `story_json` 回退 `china_culture`。

GEARS v1 和 Seedance v1 包顶层及 Markdown 元数据现均包含 `sourceDomain`。该字段不进入 `script_text`、`visual_prompt`、`camera_suggestion`、`segment_prompt_hint` 或 Seedance 分段提示正文，继续遵守交付字段分离和 prompt cleaning 合同。MCP 定向回归为 2 文件、9 用例，覆盖项目元数据继承 `second_domain`、直接 `story_json` 保留显式第二领域、旧 `story_id` 兼容回退，并确认 TypeScript 构建与 diff 检查通过。最终 Unified CI 21/21 通过：Web Server 118 文件/1016 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身为 63 文件、hold 0、staged 0。

该切片没有注册第二生产领域，没有调用真实 GEARS/Seedance endpoint，也没有产生回片、公共 artifact 或真人验收。五套进度保持综合研发 73%、专业文本 47.5%、知识内容 262 条/960 来源且 M2 70/97、真实 GEARS/Seedance 0/5、发布运营 60%；fixture、fallback、机器测试和本地包元数据不计真实修订、真人审核、真实回片、signed release 或 professional pass。

### 8.74 2026-07-16 MCP 项目版本 source domain 身份一致性

8.73 使 MCP 交付包能够从 Project 补齐领域，但 `kb_update_project_version` 的普通修订写回仍可能生成缺少 `sourceDomain` 的新 Story 快照；调用方还可以在 `snapshot_json` 中提交与 Project 元数据冲突的领域，而 Project meta 继续保留原 `source_domain`，形成同一版本双重归属。领域迁移不是普通 scene/quality/production-board 修订，本轮把 Project `source_domain` 设为该写入路径的不可变身份来源。

版本字段合并现在先解析 Project 领域；旧当前快照和输入均缺字段时，新 Story 快照显式注入 Project 领域。当前 Story 或新 `snapshot_json` 若带非空且不同的 `sourceDomain`，写入在版本号分配后的任何文件创建之前 fail closed，不静默改写、不更新 Project meta。扩展的 MCP 定向回归为 3 文件、13 用例，验证 `second_domain` 从 Project 进入 v2 Story 快照和读取上下文，冲突 `china_culture` 被拒绝且 v2 文件不存在；MCP TypeScript 构建与 diff 检查通过。最终 Unified CI 21/21 通过：Web Server 118 文件/1016 用例、Track A Playwright 6/6、MCP 79 文件/345 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身为 65 文件、hold 0、staged 0。

该一致性门禁只保护机器快照身份，不代表第二生产领域已注册、真实内容已审核或外部交付成立。五套进度继续为综合研发 73%、专业文本 47.5%、知识内容 262 条/960 来源且 M2 70/97、真实 GEARS/Seedance 0/5、发布运营 60%；机器持久化检查、fallback 和测试均不计真实修订、真人审核、真实回片、signed release 或 professional pass。

### 8.75 2026-07-16 MCP Project Context 统一领域水合边界

8.73–8.74 分别补齐交付包和版本写回，但 MCP `getProjectContext` 仍把磁盘上的旧 Story 快照原样返回。修复、类型质量校验、生产 readiness、GEARS、Seedance、版本写回和 MCP 上下文查询共七条路径直接消费该结果，其中只有两个交付工具自行补 `sourceDomain`，其余消费者会继续看到无领域 Story；这也使领域规则散落在消费者中。

本轮把 `getProjectContext` 设为统一只读领域边界。Project `source_domain` 先经同一 legacy resolver 规范化，当前 Story 与可选全部历史快照统一返回必填 `sourceDomain`。缺字段的旧 Project/Story 只在内存中补为 `china_culture`，测试逐字读取磁盘确认查询不回写；任一版本带非空且与 Project 不同的领域时，整条上下文读取按版本 ID fail closed。GEARS/Seedance 项目解析删除重复补域分支，MCP tool 描述同步声明只读水合与冲突拒绝合同。

七个直接/间接消费者定向回归为 7 文件、42 用例，覆盖显式 `second_domain`、legacy 双缺失只读回退、历史快照返回和冲突拒绝；MCP TypeScript 构建与 diff 检查通过。最终 Unified CI 21/21 通过：Web Server 118 文件/1016 用例、Track A Playwright 6/6、MCP 79 文件/347 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身为 68 文件、hold 0、staged 0。

该读取边界不写历史数据、不注册第二生产领域，也不代表任何真实修订、人工审核或外部媒体交付。五套进度保持综合研发 73%、专业文本 47.5%、知识内容 262 条/960 来源且 M2 70/97、真实 GEARS/Seedance 0/5、发布运营 60%；只读水合、fallback、机器测试和 tool schema 均不计真实回片、signed release 或 professional pass。

### 8.76 2026-07-16 MCP 当前版本精确解析 fail-closed

统一 `getProjectContext` 后继续审计发现：Project `current_version_id` 若指向不存在的快照，旧实现会静默使用按创建时间升序排列后的第一个版本，即最旧 Story。修复、质量、生产 readiness、GEARS/Seedance 和版本写回因此可能在元数据已损坏时继续处理陈旧内容，掩盖 Project 状态机与磁盘版本不一致。

当前版本解析现要求与 `project.current_version_id` 精确匹配。项目完全没有版本仍返回“项目缺少版本快照”；存在历史版本但当前 ID 缺失则返回包含目标版本 ID 的“项目当前版本快照缺失”，不再提供任何旧版本 fallback。MCP tool 描述同步声明该拒绝条件。七个消费者定向回归扩展为 7 文件、43 用例，验证 v1 存在但 meta 指向 v9 时整条读取 fail closed；MCP 构建和 diff 检查通过。最终 Unified CI 21/21 通过：Web Server 118 文件/1016 用例、Track A Playwright 6/6、MCP 79 文件/348 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身仍为 68 文件、hold 0、staged 0。

该状态一致性修复没有恢复缺失快照、改写 Project 或产生真实业务验收；损坏状态需要外部备份/恢复流程和人工授权处理。五套进度继续为综合研发 73%、专业文本 47.5%、知识内容 262 条/960 来源且 M2 70/97、真实 GEARS/Seedance 0/5、发布运营 60%；机器门禁与测试不计真实修订、真人审核、真实回片、signed release 或 professional pass。

### 8.77 2026-07-16 MCP 版本快照文件身份与普通文件边界

8.75–8.76 已锁定领域和当前版本选择，但 MCP 版本目录仍按 `.json` 文件名扫描后直接信任内部内容。外部损坏文件可以让快照 `project_id` 指向其他项目、让内部 `version_id` 与文件名不同，或让多个文件声明同一版本；`.json` 符号链接也会被 `readFile` 跟随。以上数据会在当前版本选择前进入修复、质量、生产 readiness、交付和版本写回链。

版本目录读取现只接受普通 `.json` 文件。文件名去扩展名后必须是以当前 Project ID 开头的合法版本 ID；快照顶层 `project_id` 必须等于目录 Project，内部 `version_id` 必须合法、全目录唯一并与文件名一致。任一条件失败均返回包含文件或版本身份的明确错误，不跳过、不猜测、不改写。`StoryProjectChangeType` 同步纳入 MCP 写入端已经支持的 `production_board_repair`，避免读取类型合同落后于写入。

七个直接/间接消费者定向回归扩展为 7 文件、48 用例，新增覆盖错项目、文件名/内部版本不一致、重复版本 ID、非法文件名和符号链接；MCP TypeScript 构建与 diff 检查通过。最终 Unified CI 21/21 通过：Web Server 118 文件/1016 用例、Track A Playwright 6/6、MCP 79 文件/353 用例、Web/MCP 构建、知识库 lint、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过。P4 排除自身仍为 68 文件、hold 0、staged 0。

该门禁只拒绝损坏历史文件，不恢复、删除、隔离或自动修订任何快照；Web Project Service 仍有三处旧版本 fallback，留作下一直接生产切片。五套进度保持综合研发 73%、专业文本 47.5%、知识内容 262 条/960 来源且 M2 70/97、真实 GEARS/Seedance 0/5、发布运营 60%；机器文件校验、测试与只读错误证据不计真实修订、真人审核、真实回片、signed release 或 professional pass。

### 8.78 2026-07-16 Web Project 当前版本精确读取与历史快照身份收口

8.77 后 Web `ProjectService` 的详情、production readiness、导出和元数据水合仍在 `current_version_id` 找不到时回退到历史数组首项；同一损坏元数据会让 Web 展示、导出或生产汇总使用陈旧版本。`FileProjectRepository` 的 Web 读取端也只读取 JSON，未验证文件名、顶层快照和嵌套 Story 的项目/版本身份，导致 MCP 与 Web 的历史读取边界漂移。

本轮将 Web 详情、readiness 与导出都改为精确匹配当前版本：完全无版本仍报缺少快照，存在历史快照而当前 ID 不存在则 fail closed 并包含目标版本 ID；不再选择最早或最新旧版本。元数据水合在无精确版本时返回原 Project meta，不借旧 Story 填充字段。Web repository 现在只扫描普通非符号链接 `.json` 文件，要求合法文件名版本 ID、快照顶层 `project_id`/`version_id` 与目录及文件名一致，并对已显式存在的嵌套 Story `project_id`/`current_version_id` 再作一致性校验；保留缺失 Story 的旧中断快照，以使既有健康审计能够报告其缺失合同。损坏、不可读、重复或非普通文件仍拒绝而不跳过、修复或写回。

初始定向 Web repository/project-service/read-boundary/delivery/webhook 回归为 5 文件、80 用例，Web `npm run check` 和 `git diff --check` 通过。首次完整 CI 随后揭示 14 条 API 回归：健康审计 fixture 的中断项目使用遗留 `v1` 文件名，现有业务快照路径合同要求 `<project_id>-vN`。未放宽读取门禁；fixture 改为同一中断语义下的合法路径 ID，随后 repository/project-service/API 回归为 3 文件、272 用例全通过。最终完整 Unified CI 21/21 通过：Web Server 118 文件/1018 用例、Track A Playwright 6/6、MCP 79 文件/353 用例、Web/MCP 构建、知识库 lint 34 文件/262 条、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过；P4 排除自身为 70 文件、hold 0、staged 0。本轮仍仅为机器读取合同，不恢复、删除或自动改写任何快照，也不产生真实修订、真人审核、真实 GEARS/Seedance 回片、signed release 或 professional pass。五套进度保持综合研发 73%、专业文本 47.5%、知识内容 262 条/960 来源且 M2 70/97、真实 GEARS/Seedance 0/5、发布运营 60%。

### 8.79 2026-07-16 MCP production readiness 当前版本选择收口

`kb_get_production_readiness` 已经通过 `getProjectContext` 读取当前 Story，但它随后仍从 `version_snapshots` 按当前 ID 查找后回退数组首项，用该旧快照的质量与 Production Board 导出记录计算 readiness。直接调用路径或未来上下文实现变更都可能让损坏的 `current_version_id` 被静默掩盖，生成与当前 Story 不一致的生产判断。

该工具现要求 `version_snapshots` 中存在与 Project `current_version_id` 精确一致的快照；缺失时抛出包含目标 ID 的“项目当前版本快照缺失”，不产生 readiness 报告、更不借用历史质量或导出记录。MCP tool 描述同步声明该拒绝合同。定向 MCP production-readiness 回归为 1 文件、10 用例，覆盖 v1 存在而 meta 指向 v9 的 fail-closed 情况；TypeScript 构建与 diff 检查通过。最终完整 Unified CI 21/21 通过：Web Server 118 文件/1018 用例、Track A Playwright 6/6、MCP 79 文件/354 用例、Web/MCP 构建、知识库 lint 34 文件/262 条、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过；P4 排除自身为 72 文件、hold 0、staged 0。

该切片只是只读机器状态一致性门禁，不调用真实 GEARS/Seedance、不生成真实回片、不写回或修订 Project，也不增加真人审核、signed release 或 professional pass。五套进度仍保持综合研发 73%、专业文本 47.5%、知识内容 262 条/960 来源且 M2 70/97、真实 GEARS/Seedance 0/5、发布运营 60%。

### 8.80 2026-07-16 MCP generated health 当前 Story 身份一致性

Web generated-health 已在精确当前版本读取后，验证 `current_story_id` 与版本内 `story.storyId`；MCP 同名健康工具却只检查当前版本存在。若 meta 指向 Story A、当前快照内却是 Story B，MCP 会把 B 的 scenes、GEARS 和质量当成 A 的当前状态，状态可能被误报为 ready。

MCP health 现对已存在的版本 Story ID 执行同一一致性判断：不匹配时将项目明确标为 `interrupted` 并加入 `current_story` 缺口，同时输出两侧 ID 的 evidence。该诊断路径不会回退、修复或写回快照；它与 Project detail/readiness 的 fail-closed 行为不同，目的是让组合健康报告保留其他项目并可见地暴露单项目损坏。定向 MCP generated-health/production-readiness 回归为 1 文件、11 用例，覆盖 Story A/B 错配；TypeScript 构建与 diff 检查通过。最终完整 Unified CI 21/21 通过：Web Server 118 文件/1018 用例、Track A Playwright 6/6、MCP 79 文件/355 用例、Web/MCP 构建、知识库 lint 34 文件/262 条、Stage 6–8 零信用门禁、治理、P4 stale-check 和无暂存检查全部通过；P4 排除自身为 73 文件、hold 0、staged 0。

本轮仅增加机器可观测性，不增加真实模型项目、真人审核、真实 GEARS/Seedance artifact、signed release 或 professional pass。五套进度保持综合研发 73%、专业文本 47.5%、知识内容 262 条/960 来源且 M2 70/97、真实 GEARS/Seedance 0/5、发布运营 60%。

### 8.81 2026-07-16 GEARS workbench capability、幂等导入与跨仓 E2E

本轮先完成两仓审计并保持主仓 dirty worktree 不 reset、不删除、不覆盖、不暂存。GEARS fork 的 remote 已安全改为 `origin=https://github.com/Wy490/gears-v2.git`、`upstream=https://github.com/chihaku1230-ship-it/gears-v2.git`，两端 `v0.2-dev` 与本地基线均为 `1d772200a809ca282a73535126359949d054164b`；工作分支为 `codex/story-agent-workbench-bridge`，未提交、未 push。

GEARS 新增受 Bearer 保护的 `gears-workbench-capabilities/v1`，明确导演工作台支持 `gears-delivery/v1` import、execution worker 不支持且 `/gears/jobs` 为 unsupported path。dry-run 不写数据库；execute 在单事务内创建或更新 Project、Character、Scene 和 `StoryboardImportDraft`，source mapping ledger 保持跨版本稳定 UUID，同 idempotency key/同 payload 重放、不同 payload 返回 409。因 Story Agent 不提供 GEARS 真实 base-sheet version，本轮不伪造正式 StoryboardRecipe；脚本、视觉、运镜、segment hint 和约束分别持久化。项目删除同步清理 bridge draft、mapping 和 replay ledger，避免悬空重放。

Story Agent 新增独立 `GEARS_WORKBENCH_API_BASE_URL/TOKEN` connector 和项目 dry-run/execute 路由。connector 不读取 execution worker 的 `GEARS_API_*`，每次导入前验证 capability；若 endpoint 自称 worker、delivery schema 不匹配，或响应把 provider/media/真实交付计数改为非零，均 fail closed。`gears-delivery/v1` unit 同步补齐 `visual_prompt`、`camera_suggestion`、`segment_prompt_hint`、`constraint_note`，旧包按 unit ID 水合缺失字段而不混入 `script_text`。

验证证据：GEARS 定向 9 tests 通过，隔离 SQLite migration 完成 `upgrade → downgrade → upgrade`；full `make check` 为后端 288 tests、前端 17 tests、mypy、typecheck、build 与 Ruff format 全通过。changed-file Ruff 和 decisions 守门通过；全仓 `make lint` 的两条失败来自目标分支未改文件的既有 import-order 与无占位 f-string。Story Agent delivery/connector 定向 17 tests 通过；opt-in 双仓 E2E 1/1 通过，实际路径为 Story Agent HTTP route → connector → 本地 GEARS capability/dry-run/execute/replay/draft 查询，并确认正式 Recipe 为 0。最终 Unified CI 21/21 通过：Web Server 119 files/1023 tests（另有 opt-in E2E 默认 1 skip）、Track A 6/6、MCP 79 files/355 tests、构建、知识库 lint 34 files/262 entries、Stage 6–8 零信用、治理、P4 stale-check 与无暂存检查全部通过。P4 排除报告自身为 78 files（71 tracked/7 untracked）、`shared_core=33`、`governance=22`、`production_docs=23`、hold 0、staged 0。

所有 GEARS E2E 使用 `/private/tmp` 隔离数据库、fake JWT/fake keys、无模型且无 provider；项目、人物、场景、draft、fixture、readiness 和测试通过均不计真实回片。五套进度保持综合研发 73%、专业文本 47.5%、知识内容 262 条/960 来源且 M2 70/97、真实 GEARS/Seedance 0/5、发布运营 60%。

### 8.82 2026-07-16 execution worker capability、Workbench 版本锁与 Project repository provider 边界

继续审计 P0.2 时确认 execution worker 仍只凭 base URL 判断可调用，误把导演 workbench 地址填入 legacy `GEARS_API_BASE_URL` 后只能等 `/gears/jobs` 返回 404。本轮新增独立 `gears-execution-worker-capabilities/v1` 客户端合同与系统探测路由：响应必须声明 `service=gears-execution-worker`、`execution_worker_supported=true`、`workbench_import_supported=false`、幂等 submit、status poll、callback delivery、支持的 job type 和三个精确 endpoint。真实 submit/status 在每次请求前 fail closed 探测；workbench capability、非 JSON、非 2xx、缺 token 或不支持 job type 都不会继续调用 `/gears/jobs`。导出的 worker acceptance kit 从 24 条命令增为 25 条，完整 shell 先保存、校验 capability 与 HTTP sidecar，且新增 `bash -n` 自动测试。旧 `GEARS_API_*` 仍只作迁移兼容。

Workbench UI 原有“先 dry-run 再 execute”只锁映射和幂等键，项目在另一窗口产生新版本时可能让操作者执行未经确认的新 payload。本轮把 dry-run 的 `source.version_id` 和 `payload_sha256` 作为 execute proof；版本变化在任何 workbench HTTP 前拒绝，execute 还会用同一内存 envelope 再跑一次远端 dry-run，hash 或 blocker 变化时只记录零信用 preflight audit，不发送 execute。有效 execute/replay 响应继续校验 source identity、零信用与 hash。隔离 SQLite、fake JWT、无模型跨仓 E2E 1/1 通过，真实 HTTP 顺序为 capability → dry-run → execute 前 dry-run → execute → replay 前 dry-run → replay；独立 audit 由 3 条增为 5 条，正式 Recipe 仍为 0。

P1 持久化最小切片把 `project-service` 对具体 `FileProjectRepository` 的构造移到平台 provider 工厂，业务层只依赖 `ProjectRepository` 接口。只读系统状态明确当前唯一 provider 为 `file`、`external_database=false`、`object_storage=false`、`production_persistence_ready=false`；配置未实现 provider 会 fail closed，不回退文件系统冒充生产。外部数据库/对象存储、迁移、备份恢复和真实故障演练仍未完成。

验证证据：execution/Workbench/provider 定向回归通过；API + execution contract 228/228，Project/provider/connector 68/68，跨仓 E2E 1/1。最终 Unified CI 21/21：Web Server 120 files passed + 1 skipped、1033 tests passed + 1 skipped，Track A 6/6，MCP 79 files/355 tests，Web/MCP build、KB lint 34 files/262 entries、Stage 6–8 零信用门禁、治理、diff、P4 与无暂存检查全部通过。GEARS `make check` 在显式 fake `LLM_API_KEY/IMAGE_GEN_API_KEY` 下为 mypy 76 files、pytest 291、前端 17、build 与 Ruff format 96 files 全通过；未配置 fake key 的首次运行仅有 6 个适配器构造测试被 OpenAI client 的空凭据检查提前拒绝，其余 285 通过，不是本轮代码回归。P4 排除自身为 91 files（80 tracked / 11 untracked）、hold 0、staged 0。

所有 capability、fixture、fake key、项目、角色、场景、draft、hash、readiness、文件 provider 和机器测试只算内部工程证据。五套进度保持综合研发 73%、专业文本 47.5%、知识内容 262 条/960 来源且 M2 70/97、真实 GEARS/Seedance 0/5、发布运营 60%；商业成熟度估算仍为 35%。

### 8.83 2026-07-16 SQLite ProjectRepository 与 original_fiction 第二领域全链路

P1 持久化继续在既有 provider 工厂下增加可选择的 `sqlite` 实现。该 provider 使用 Node `node:sqlite` 和持久文件路径，拒绝 `:memory:`，启用 WAL、`synchronous=FULL`、外键与 busy timeout；schema metadata/version 不兼容时 fail closed。Project meta 与 version snapshot 分表保存，JSON body 带 SHA-256 并在读取时复验，project/version/Story 身份必须一致。版本追加和 current-state 成对更新使用 `BEGIN IMMEDIATE`，并以 `updated_at + current_version_id + version_count` 三字段 CAS 拒绝 stale writer。只读 inspection 执行 `integrity_check` 与 `foreign_key_check`；备份使用非覆盖目标，恢复到全新 repository 后比较 Project/version 数与 logical repository SHA。审计还发现构建目标仍为 Node 18，若静态导入 `node:sqlite` 会连默认 file provider 都在旧运行时启动失败；现改为只在选择 sqlite 时同步加载，系统状态暴露 `sqlite_runtime_available`，不支持的运行时将该配置标为 invalid 并 fail closed。默认 provider 仍为 `file`，系统状态明确 `external_database=false`、`object_storage=false`、`production_recovery_drill_completed=false`、`production_persistence_ready=false`。

第二领域 `original_fiction` 不复用或读取中国文化知识库，拥有独立的条目/片型 catalog、搜索/详情/匹配、规划、生成、安全和 GEARS mapping。它只接受 `truth_mode=fictional_original`，要求用户提案至少 40 字和 3 个可执行叙事分句，生成 StoryBlueprint、6 个场景、观众稿、分离的脚本/视觉/运镜/segment hint、GEARS segments、类型质量报告和 delivery。权利状态保持未核验并要求真人复核；所有场景保留用户提案 source trace。质量修订新增跨领域保护层，`sourceDomain`、原始用户提案和 `domain_safety` 不允许被 repair payload 覆盖，修订后的原创域 safety 在新版本持久化前再次执行；删除 source trace 会 fail closed，合法修订产生 v2 并通过同一质量/交付主链。

跨仓 E2E 扩展为两条：原中国文化包与从 `original_fiction` Domain Pack 实际生成的 Story。后者经 Story Agent Project/HTTP/connector 进入真实本地 GEARS v2 HTTP capability → dry-run → execute 前复验 → execute → draft/formal-recipe 查询，得到 1 Project、1 Character、3 个去重 Scene、6 个 StoryboardImportDraft、0 正式 Recipe、0 provider call、0 media artifact、0 real-delivery credit。GEARS 使用隔离 SQLite、fake JWT/fake keys、无模型；两条 E2E 2/2 通过。定向 provider/domain 回归 25/25、原创域与 Project service 62/62、API 203/203，Story server typecheck 通过；GEARS full `make check` 为 mypy 76 files、pytest 291、前端 17、backend import、frontend build 与 Ruff format 96 files 全通过。

Node 运行时兼容修正后的 SQLite/provider 定向回归 8/8、Story server typecheck 通过。最终授权环境 Unified CI 21/21 通过：Web Server 122 files passed + 1 skipped、1042 tests passed + 2 skipped，Track A Playwright 6/6，MCP 79 files/355 tests，Web/MCP build、知识库 lint 34 files/262 entries、Stage 6–8 零信用门禁、治理、diff、P4 stale 与无暂存检查全部通过。P4 排除报告自身为 99 files（82 tracked / 17 untracked）、`shared_core=51`、`governance=23`、`production_docs=25`、hold 0、staged 0。

该切片完成了第二领域的代码级机器生产证明，并将综合研发从 73% 提到 74%；它不是专业文本真实样板，也没有真实 model/provider、素材确权、真人审稿、外部 execution worker 或 Seedance 回片。SQLite 是嵌入式本地 provider，不是 PostgreSQL/对象存储；本地 backup/restore 等价验证不是生产断电或灾难恢复演练。其余四套进度保持：专业文本 47.5%、知识内容 262 条/960 来源且 M2 70/97、真实 GEARS/Seedance 0/5、发布运营 60%；商业成熟度仍为 35%，所有本地项目、角色、场景、draft、fixture、fake key、无模型测试和 readiness 继续零信用。

### 8.84 2026-07-16 Domain Pack `story_revision` 与修订后领域安全复验

继续审计第二领域时发现两个会破坏平台边界的真实缺口：Project repair prompt 仍硬编码“china-culture-kb Story Agent / 中国传统文化故事修复写手”，而修订写入前的领域安全只真正重算 `original_fiction`。中国文化候选可删除 `cultural_constraints` 或场景 `source_entries`，却沿用旧 `domain_safety` 报告并产生新版本。

本轮为 Domain Pack 合同增加第九项 `story_revision` capability 与强制 `story-domain-revision-guidance/v1`，注册时校验写手角色、来源边界规则和真人复核要求；中国文化与原创 pack 均升级到 `1.1.0` 并提供自己的规则。Project repair prompt 现按 Story 的 source domain 取 guidance，不再含平台硬编码的中国文化角色。带显式 `domain_safety` 的候选在任何新版本持久化前都会由 registry 解析所属 pack、重新读取该领域 source entry，并调用 pack 的 `validateStoryContent`；来源已不存在时用 `DOMAIN-REVISION-SOURCE-ENTRY` fail closed，删除文化约束或场景来源追踪则以 `DOMAIN_SAFETY_VALIDATION_FAILED` 拒绝，version count 不增加。为避免 DomainPack → persistence/project-service → revision → registry → DomainPack 的初始化环，registry 在修订边界内动态加载，但所有合同与断言保持不变。

Project 持久化会给旧 Story 水合 `sourceDomain`，所以不能据此区分 legacy。兼容门现只对已有显式 `domain_safety` 报告的 Story 强制复验；无报告的历史 snapshot 暂保原有 repair 行为，后续必须用非覆盖、可审计迁移补齐，不能把兼容路径解释为领域安全通过。

验证证据：registry 与两个生产领域 3 files / 20 tests；API、Project service、registry 与两个领域合并回归 5 files / 282 tests；中国文化修订缺来源和删约束/source trace 定向 3/3；Story server TypeScript 通过。隔离 GEARS SQLite、fake JWT/secret、无模型的跨仓 HTTP E2E 2/2 再次通过，正式 Recipe、provider call、media artifact 与 real-delivery credit 仍全部为 0。最终授权环境 Unified CI 21/21 通过：Web Server 122 files passed + 1 skipped、1043 tests passed + 2 skipped，Track A Playwright 6/6，MCP 79 files/355 tests，Web/MCP build、知识库 lint 34 files/262 entries、Stage 6–8 零信用门禁、治理、diff、P4 stale 与无暂存检查全部通过。P4 排除自身为 99 files（82 tracked / 17 untracked）、`shared_core=51`、`governance=23`、`production_docs=25`、hold 0、staged 0。

该跨领域正确性切片把综合研发从 74% 推进到 75%。其余四套进度不变：专业文本 47.5%、知识内容 262 条/960 来源且 M2 70/97、真实 GEARS/Seedance 0/5、发布运营 60%；商业成熟度仍为 35%。它没有产生真实模型项目、真人审稿、生产恢复、外部 execution worker 或 Seedance 回片。

### 8.85 2026-07-16 legacy `domain_safety` 只读盘点与 append-only 迁移

8.84 为新修订关闭了 stale safety 写入，但无显式 `domain_safety` 的历史 Project 仍走兼容路径。本轮没有把它们自动视为中国文化安全通过，也没有批量回写；新增 `story-domain-safety-migration-audit/v1` 只读 inventory 和 `/api/system/story-domain-safety-migrations` 管理员接口。POST 默认为 dry-run，真实 apply 还必须同时满足：操作者显式确认 source domain/entry、current version 与逻辑 Story SHA 未变化、重新加载 Domain Pack 来源后的安全报告通过、`STORY_AGENT_DOMAIN_SAFETY_MIGRATION_WRITE_ENABLED=true`，以及绝对路径 durable JSONL 可写。intent/applied 事件不含故事全文、凭据或媒体，只记录来源身份、hash、规则 ID 和零信用边界。

迁移通过当前选择的 ProjectRepository `commitVersion` 只追加 `domain_safety_migration` 新版本，旧 snapshot 不覆盖、scene diff 为空；Story 内记录 migration ID、前版本/hash、操作者、review reference、显式来源确认、machine-only/human=false/real-credit=false。相同 migration ID 与同一确认重放不会产生 v3；不同请求不能覆盖已受安全报告治理的当前版本。file 与 SQLite provider、中国文化与原创领域均覆盖。

审计还发现 FileProjectRepository 的普通 read 会先恢复 pending transaction，若 inventory 使用它就不能诚实声明只读。仓储接口因此新增 `inspectCurrentStateReadOnly`：file 直接做路径/身份校验而不恢复或写入，SQLite 在单次只读数据库访问中读取 meta/current snapshot。故障注入留下 snapshot + intent 后运行 inventory，`project.json` 与 `.transactions` 均保持逐字不变。

真实工作区在明确 `KB_ROOT` 下的只读结果为 22 Projects：20 个 `migration_candidate`，2 个 blocked，blocker 涉及缺 source entry 与现有 credibility/unverified 边界；writeback 0、apply 0、history overwrite 0、human review 0、real credit 0。候选只代表机器可进入显式迁移 preflight，不能批量自动执行。

定向证据：migration service 5/5；migration + access route 2 files / 34 tests；API、Project service、file/SQLite repository、registry、两个领域与 migration 合并回归 10 files / 336 tests。全新 `/private/tmp` GEARS SQLite 完整 Alembic upgrade 后，fake JWT/key、无模型跨仓 HTTP E2E 2/2 通过，正式 Recipe、provider、media 和 real-delivery credit 均为 0。

最终授权环境 Unified CI 21/21 通过：Web Server 123 files passed + 1 skipped、1049 tests passed + 2 skipped，Track A Playwright 6/6，MCP 79 files/355 tests，Web/MCP build、知识库 lint 34 files/262 entries、Stage 6–8 零信用门禁、治理、diff、P4 stale 与无暂存检查全部通过。P4 分类器仅增加本迁移服务的精确 shared-core 路径，排除报告自身后为 103 files（84 tracked / 19 untracked）、`shared_core=54`、`governance=23`、`production_docs=26`、hold 0、staged 0。

该内部治理切片把综合研发从 75% 推进到 76%。专业文本仍 47.5%，知识内容仍 262 条/960 来源且 M2 70/97，真实 GEARS/Seedance 仍 0/5，发布运营仍 60%，商业成熟度仍 35%。它没有授权迁移候选，也没有产生真人审稿、真实模型项目、外部存储/恢复或真实回片。

### 8.86 2026-07-16 File ProjectRepository → SQLite 全历史等价迁移

嵌入式 SQLite provider 已有事务、CAS、完整性和备份恢复等价，但缺少从当前 file provider 搬运完整历史的受控路径；逐项目调用公开 CRUD 无法在不伪造 current version 的前提下导入 v1…vN。本轮在仓储层增加 canonical logical state：FileProjectRepository 逐个校验 meta 身份、current version、版本数、每个 snapshot 与 Story 身份并排序计算 SHA-256；若存在 `.transactions/*.intent.json` 则只读检查直接阻断，不触发恢复或写回。SQLiteProjectRepository 新增仅允许空 `project_meta/project_versions` 的单事务导入，拒绝重复 meta/version、孤儿 version、history/count/current 不一致，并在提交后重跑 integrity、foreign key、数量和 logical SHA 等价校验。

系统新增 `/api/system/story-project-file-to-sqlite-migration` GET/POST。GET 只读检查源与操作者通过环境变量配置的绝对目标；POST 默认为 dry-run，并要求 administrator、`expected_source_logical_sha256`、显式 review reference 和确认语。真实执行还需 `STORY_PROJECT_FILE_TO_SQLITE_MIGRATION_WRITE_ENABLED=true` 与独立 durable JSONL audit。锁定后再次检查目标不存在和源 SHA 未变化，先写 intent，再在同目录构造 SQLite staging 与 verified backup；发布前第三次复验源。数据库和旁车 manifest 用 hard link 发布，已有路径返回冲突而不覆盖；相同 migration/source/review 的既有目标只有在 DB SHA、logical SHA、Project/version 数和 manifest 全部一致时才作为幂等重放。服务不切换 `STORY_PROJECT_REPOSITORY_PROVIDER`，只清理自己命名的临时文件。

真实工作区在显式 `KB_ROOT=/Users/wuyu/Desktop/china-culture-kb/data` 下只读 preflight 通过：22 Projects、52 versions、logical SHA `b4cd2fcf2ad1812026bece49fad75573f1b810f87524ae985f79899f2532343f`，blocker 0。`/private/tmp` 目标在 preflight 前后都不存在；pending recovery 0、source writeback 0、target write 0、apply 0、provider change 0。定向 service/repository/access 4 files / 51 tests；provider/domain/migration 聚合为 10 files passed + 1 opt-in skipped、129 passed + 2 skipped。隔离 GEARS 全量 Alembic upgrade 与跨仓 HTTP E2E 2/2 再次通过；GEARS 后端全套 291/291（fake keys、审计重定向 `/private/tmp`）、前端 17/17 与 production build 通过。最终 Unified CI 21/21：Web Server 124 files passed + 1 skipped、1054 tests passed + 2 skipped，Track A Playwright 6/6，MCP 79 files / 355 tests，Web/MCP build、KB lint、Stage 6–8 零信用门禁、治理、diff、P4 stale 与 no-stage 全部通过。

P4 分类器为新迁移 service 增加精确 shared-core 规则；清单排除报告自身后为 105 files（84 tracked / 21 untracked）、`shared_core=56`、`governance=23`、`production_docs=26`、hold 0、staged 0。该切片把综合研发从 76% 推进到 77%；专业文本 47.5%、知识内容 262 条/960 来源且 M2 70/97、真实 GEARS/Seedance 0/5、发布运营 60% 和商业成熟度 35% 均不变。dry-run、fixture、fake key、SQLite 文件、manifest、测试和 readiness 均不计外部存储、生产恢复、真人审稿、真实回片或 professional pass。

### 8.87 2026-07-16 Story storage-root 单一配置边界与 legacy split-brain 只读审计

继续审计 file→SQLite 源根时发现：正常 `web/server/src/index.ts` 会在接受请求前把 `KB_ROOT` 指向仓库 `/data`，但 `platform/story-storage.ts` 和多个 service 的直接 import fallback 从 `src/services` 或 `src/platform` 少向上一级，可能解析为 `/web/data`，继而把 generated 写到 `/web/web/generated`。两个路径都已有历史数据：正确 active 根含 22 个 Project、52 个 version 和 927 个系列项目，误解析 legacy 根含 26 个 Project；因此不能自动选择、合并、搬运或删除任何一侧。

本轮新增 `story-storage-root-config/v1` 平台边界。无环境变量时，仓库根、知识根和 generated 根由一个固定物理锚计算，server 入口和直接 import 得到相同 `/data` 与 `/web/generated`。显式 `KB_ROOT`、`WEB_GENERATED_ROOT` 必须是绝对路径，且两根必须互不包含；生产环境在两个值都由操作者显式提供前 fail closed。server 初始化后只为兼容 MCP/旧的正确 KB 解析设置同一 canonical env，不改变来源审计语义。

Project/Story、AI 漫剧系列、generated health、workbench audit、GEARS execution/webhook、生产 readiness、Domain Pack 扩充和资源归属服务现全部委托这一边界。旧 `/web/web/generated` 被隔离为 `/api/system/story-storage-root-config` 的只读 discovery inventory，不再加入 active read/write roots。接口显式声明自动迁移、合并、删除、覆盖、写回和 provider 切换均未发生，真实 GEARS/Seedance credit 为 0。真实工作区只读结果为 active 22 Projects / 52 versions / 0 stories / 927 series，legacy 26 Projects / 0 versions / 0 stories / 0 series；目录项与 mtime 零变化测试通过。

验证证据：storage resolver 与 legacy 零写入 7/7，源码单一边界 10/10；API 合并回归 210/210，受影响 service 合并回归 8 files / 151 tests；Story server 全量为 126 files passed + 1 opt-in skipped、1072 tests passed + 2 opt-in skipped。隔离 GEARS SQLite、fake JWT/key、无模型的跨仓 HTTP E2E 2/2 通过；GEARS 后端在完整 Alembic 临时库上 291/291，前端 17/17 与 production build 通过。首次跨仓 sandbox 运行因禁止本地 HTTP/临时监听而失败，授权的同条件重跑通过；首次 GEARS 全套使用未迁移临时库时仅两个全局 404 测试报缺 `storyboard_outputs` 表，执行 Alembic 后原样 291/291，不是代码回归。

P4 新增的 7 个 tracked 路径来自本轮首次触达的 root 消费服务，3 个 untracked 路径为中央平台模块及两组测试；分类器为 production readiness portfolio 增加精确 shared-core 归属。清单排除报告自身后为 115 files（91 tracked / 24 untracked）、`shared_core=64`、`governance=25`、`production_docs=26`、hold 0、staged 0。

最终授权环境 Unified CI 21/21 通过：Web Server 126 files passed + 1 skipped、1072 tests passed + 2 skipped，Track A Playwright 6/6，MCP 79 files / 355 tests，Web/MCP build、KB lint 34 files / 262 entries、Stage 6–8 零信用门禁、治理、diff、P4 stale 与 no-stage 全部通过；没有真实模型或媒体 provider 调用。

该切片把综合研发从 77% 推进到 78%；专业文本仍 47.5%，知识内容仍 262 条/960 来源且 M2 70/97，真实 GEARS/Seedance 仍严格 0/5，发布运营仍 60%，商业成熟度仍 35%。26 个 legacy Project 的来源、版本、所有权、重复关系和处置必须逐项人工决定；本轮没有授权或执行任何数据迁移、合并、删除、覆盖、暂存、提交或推送。

### 8.88 2026-07-16 legacy generated root 逐项零写入 disposition preflight

在 8.87 只读发现 26 个 legacy Project 后，本轮新增 `story-storage-legacy-disposition-preflight/v1`，把“发现一侧还有数据”细化为每目录的结构、身份、version 声明、来源、ownership 和碰撞证据。服务只使用 `lstat/readdir/readFile`，Project 目录或 `project.json` 是符号链接时不跟随；active/legacy 根为相对路径、相同路径、互相包含，或 active projects 根不可读/索引不完整时 fail closed。受保护 GET API 要求 administrator 的 `access:audit:read` 与 `internal_story_tools`，不提供 execute/migrate/merge/delete/writeback 入口。

元数据只计算语义指纹，不冒充 Story 内容 hash。active Project ID、Story ID、元数据指纹碰撞为强阻断；同来源、同条目、同标题只列为人工比较候选，legacy 等价元数据组也不自动推断重复。即使目录具备完整 history，仍固定 `requires_human_review=true`、`automatic_action_allowed=false`，且执行任何动作前必须重检；空目录同样不得自动删除。

真实工作区逐项结果：26 directories，22 empty、4 metadata-only、0 complete history、4 valid metadata、4 source resolved、0 ownership valid。active Project ID / Story ID / metadata fingerprint collision 均为 0；4 个元数据项目分别命中同来源同标题 active 候选，并形成 1 个四项 legacy metadata equivalent group。26/26 blocked 且需人工处置，automatic action 0；inventory SHA-256 为 `7fbb642494231f0eea4b43e358335e9368a18b913439c8bfe0cdb2b48432dbe2`。legacy 树运行前后快照 SHA-256 同为 `eb0fde08cd88b421559937b8559a4f413eaff068da629eec8b6814a150bab5f4`；迁移、合并、删除、覆盖、写回、`domain_safety` apply、provider 切换和真实信用全部为 0。

定向 service、root boundary、API 与权限回归为 4 files / 252 tests；Story server 全量为 127 files passed + 1 opt-in skipped、1080 tests passed + 2 opt-in skipped。额外回归确认恶意 `current_version_id=../../...` 只产生 blocker，不探测 `versions` 目录外的路径。隔离 GEARS SQLite、fake JWT/keys、无模型跨仓 HTTP E2E 2/2 通过，正式 Recipe、provider、media 和 real-delivery credit 均为 0；GEARS `make check` 为 mypy 76 files、后端 291、前端 17、production build 和 Ruff format 96 files 全通过。

P4 分类器为新 service 增加精确 shared-core 归属；清单排除报告自身后为 117 files（91 tracked / 26 untracked）、`shared_core=66`、`governance=25`、`production_docs=26`、hold 0、staged 0。最终 Unified CI 21/21：Web Server 127 files passed + 1 skipped、1080 tests passed + 2 skipped，Track A Playwright 6/6，MCP 79 files / 355 tests，Web/MCP build、KB lint 34 files / 262 entries、Stage 6–8 零信用门禁、治理、diff、P4 stale 与 no-stage 全部通过；没有真实模型或媒体 provider 调用。

该切片补齐 legacy root 人工决策前的机器证据，但不产生人工结论。三个真实端到端样板仍为 0/3，长期计划的 78% 上限继续生效；专业文本仍 47.5%，知识内容仍 262 条/960 来源且 M2 70/97，真实 GEARS/Seedance 仍严格 0/5，发布运营仍 60%，商业成熟度仍 35%。本轮未授权或执行 20 个 `domain_safety` candidate、legacy 数据动作、file→SQLite 真实迁移/切换、暂存、提交或推送。

### 8.89 2026-07-17 Domain Pack 自有正式知识写回计划

`project-service.ts` 原先直接从 Story knowledge pack 猜省份并生成 `data/provinces/<省份>.md`，缺省时还会生成 `data/provinces/待确认.md`；因此第二领域可能被错误套入中国省份知识库。本切片把该映射抽为 Domain Pack 第十项 `knowledge_writeback` capability 和平台 `story-domain-knowledge-writeback-plan/v1`。两个生产领域版本同步提升为 1.2.0；注册时缺少 capability 或方法会启动前拒绝。

`china_culture` 新领域服务只允许固定省级名称，缺失、非规范或路径型值均返回 blocker 且不产生目标；`original_fiction` 固定返回不支持正式知识写回。平台校验领域 ID、schema、机器边界字段和仓库相对路径，拒绝绝对路径、反斜杠、空段、`.`/`..` 与 NUL；未注册历史领域转为 `domain_pack_not_registered` blocker，不使统一任务列表抛异常。Project task list 暴露 Domain Pack、资格、blockers、文件和 section；补充任务审稿只有在领域计划 eligible 时才生成正式写回草案，单项目 Patch 和显式队列请求在无合法目标时 fail closed。所有计划固定真人复核、直接写回 false、已写回 false、真实信用 false。

定向 registry、平台计划、Project service 与 API 回归为 4 files / 285 tests；聚焦三文件为 80/80，Story server TypeScript 通过。Server 全量为 128 files passed + 1 opt-in skipped、1087 tests passed + 2 opt-in skipped。全新隔离 GEARS SQLite 完成全量 Alembic upgrade 后，fake JWT/keys、无模型跨仓 HTTP E2E 在受控环境 2/2 通过，正式 Recipe、provider、media 和 real-delivery credit 均为 0；默认沙箱复跑被 localhost/Supertest `EPERM` 阻断，不作为代码失败证据。GEARS `make check` 为 mypy 76 files、后端 291、前端 17、production build 和 Ruff format 96 files 全通过。

P4 清单排除报告自身后为 120 files（91 tracked / 29 untracked），`shared_core=69`、`governance=25`、`production_docs=26`、hold 0、staged 0。新增两个领域服务/平台文件和边界测试均由现有精确 shared-core 规则归属，没有扩大模糊通配范围。

最终 Unified CI 21/21 通过：Web Server 128 files passed + 1 skipped、1087 tests passed + 2 skipped，Track A Playwright 6/6，MCP 79 files / 355 tests，Web/MCP build、KB lint 34 files / 262 entries、Stage 6–8 零信用门禁、治理、diff、P4 stale 与 no-stage 全部通过；paid model invocation 关闭，未调用真实模型或媒体 provider。

该切片没有修改正式知识文件、没有执行 20 个 `domain_safety` candidate、没有触碰 legacy root、没有执行或切换 file→SQLite，也没有调用真实模型/媒体 provider。三个真实端到端样板仍为 0/3，综合研发继续受 78% 上限约束；专业文本仍 47.5%，知识内容仍 262 条/960 来源且 M2 70/97，真实 GEARS/Seedance 严格 0/5，发布运营 60%，商业成熟度 35%。暂存、提交和推送仍未授权。

### 8.90 2026-07-17 领域中性修订/补素材提示与持久化禁写合同

本切片继续审计 `project-service.ts` 的 `china_culture` 假设。Domain Pack 生产版本提升到 1.3.0，并新增第十一项 `story_supplement` capability、`story-domain-supplement-guidance/v1`。候选稿类型、标题、复核规则和正式写回草案适用性改由领域包决定：`china_culture` 为领域知识候选，`original_fiction` 为项目内素材候选且正式知识候选导出 fail closed。

平台新增 `story-domain-edit-persistence/v1`，将修订限定为追加 Project version，将补素材限定为更新当前 Project 状态和 generated story snapshot；统一固定 Domain source 禁写、知识未写回、外部交付未触发、迁移未执行、真实信用为零。质量修订和补素材持久化均在写入前校验该合同，原有 knowledge-writeback 资格、legacy compatibility 和领域安全复核保持不变。

测试先行红灯覆盖缺失 capability/平台文件、硬编码候选稿与持久化合同；实现后定向 7 files / 293 tests 通过。Story server 全量 129 files passed + 1 skipped、1089 tests passed + 2 skipped；隔离 SQLite、fake JWT/keys、无模型跨仓 HTTP E2E 2/2；GEARS `make check` 为 mypy 76 files、后端 291、前端 17、production build 与 Ruff format 96 files 全通过。Unified CI 21/21 全绿，含 Track A 6/6、MCP 79 files / 355 tests、KB lint 34 files / 262 entries、P4 stale 与 no-stage 门禁。

本轮没有修改正式知识文件，没有执行 20 个 `domain_safety` candidate、legacy 数据动作或 file→SQLite 迁移/切换，没有真实模型或媒体 provider 调用。三个真实端到端样板仍为 0/3；综合研发保持 78%，专业文本 47.5%，知识内容 262 条/960 来源且 M2 70/97，真实 GEARS/Seedance 严格 0/5，发布运营 60%，商业成熟度 35%。暂存、提交和推送仍未授权。

### 8.91 2026-07-17 Superpowers Lite 项目工作流优化

Mac/Codex 没有实际安装 Superpowers 插件；现有清单中的 5.1.0/14 skills 属于 Windows Claude Code。为避免修改 marketplace 缓存或创建不会加载的全局影子副本，本轮在项目 `.codex/skills/superpowers-lite` 新增 80 行最小工作流及标准 `agents/openai.yaml`。默认 Lite；跨模块/跨仓共享合同升级 Standard；破坏性、安全、付费外部调用、真实迁移和生产授权才升级 Strict。

新工作流保留比例化 TDD、失败根因诊断、完成前新鲜证据、dirty worktree 保护和真实计分边界，同时取消明确可逆任务的强制 brainstorming、大计划、worktree、subagent 和重复 full CI。里程碑代码只跑一次全量门禁；其后的纯文档/机器报告只复验相关 parser、governance、P4、diff 和 no-stage。

官方 `quick_validate.py` 在 uv 临时 PyYAML 环境通过；`openai.yaml` 解析、默认 prompt 与关键规则断言通过，skill 无 TODO。P4 分类器只为 `.codex/skills/superpowers-lite/` 增加精确 governance 规则，并为现有工具清单文件增加精确 production-docs 归属，不扩大到全部 `.codex` 或 `开发文档`。最终清单为 126 files（92 tracked / 34 untracked），`shared_core=71`、`governance=27`、`production_docs=28`，hold 0、staged 0。这是过程效率优化，不增加综合研发、专业文本、知识内容、真实 GEARS/Seedance 或发布运营进度；没有暂存、提交或推送。
