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
