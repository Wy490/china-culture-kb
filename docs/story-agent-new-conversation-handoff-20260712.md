# Story Agent 新对话开发交接（2026-07-13，P22 完成版）

## 1. 一句话结论

Story Agent 已完成 15 片型专业文本合同、Stage 6 接入与两轮修订执行准备、Stage 7 黄金素材卡人审准备、Stage 8 盲评接入/片型评估器/三角色 Ed25519 验签、P20 finalization只读预检、P21 durable signed-release record只读导入检查器与 **P22 Stage 8五泳道总控/外部材料内存交接**。

所有技术能力仍严格保持零信用口径：没有调用付费模型，没有真实修订，没有真人盲评通过，没有 signed release，没有专业通过。专业文本创作进度仍为 **47.5%**。

## 2. 当前真实状态

```text
VideoType：15 / 15
固定 benchmark 规格：75
Stage 6 真实输入 ready：0 / 15
Stage 6 Round 1 可执行：0 / 15
真实修订轮次：0
专业文本包通过：0 / 15
黄金素材卡人工通过：0 / 75
Stage 8 外部盲评 ready：0 / 75
可信盲评 reviewer/key：0
真实盲评签名：0
真人盲评通过：0 / 45
finalization candidate ready：0 / 75
active release authority：0
durable release verification ready：0 / 75
durable signed release：0
professional pass：0
Stage 8 结构化外部 NEXT：75 / 75
Stage 8 handoff持久化/执行：0 / 0
付费模型调用：0
专业文本创作进度：47.5%
```

`fixture`、`simulation`、`fallback`、`prepared`、`preparation_template`、机器阈值通过、签名 fixture 验证通过和 readiness 都不计入以上真实指标。

## 3. 已完成的主链

### 3.1 15 片型专业文本能力

- 15/15 `VideoType` 均有独立 `GenreStoryProfile`、专业文本合同、合法骨架、质量评估器和定向修订器。
- 统一覆盖 CreativeBrief、研究证据、事实/戏剧化边界、结构、分场、对白或旁白、导演文本、交付文本和十维质量门禁。
- 75 个固定项目规格与 45 个失败 fixture 已建立；它们只用于合同和回归。

### 3.2 Stage 6：真实输入、两轮修订与退出门禁

- P0：15 项目真实输入统一 schema、导入验证、operator JSON 模板、逐项目 readiness。
- P1：Round 1/2 opt-in 批次执行器、恢复/重试、不可变哈希与 provenance 门禁。
- P2/P6–P12：版本差异工作台、operator 接入、批次预检、退出审计、初始包检查、总控、真人桌读证据检查、退出复核 Ed25519 验签。
- 所有执行/签名/落盘端点均 fail closed；外部材料未到位时 15/15 项目 blocked。

### 3.3 Stage 7：黄金素材卡准备链

- 30 张既有 pending 卡的人审接入。
- 12 个缺失片型的 60 个固定候选槽位。
- 三角色 Ed25519 审稿签名检查。
- 五泳道材料运营总控，共 51 个外部 NEXT。
- 当前人工批准与正式晋升均为 0。

### 3.4 Stage 8：外部真人盲评准备链

- P17/P0：75 项终稿、授权基准、匿名随机化、三角色独立实名评审和排期接入；75/75 blocked。
- P18/P1：15 片型独立权重合同和 `professional-benchmark-blind-review/v2` evaluator；机器阈值不计真人通过。
- P19/P2：review bundle、decision、权重合同、三角色 reviewer/key、canonical payload 与 Ed25519 签名绑定；仓库 trust policy 为空准备模板，真实签名为 0。

关键文档：

- `docs/story-agent-stage8-p0-blind-review-intake-implementation-20260712.md`
- `docs/story-agent-stage8-p1-all-format-blind-review-evaluator-v2-implementation-20260712.md`
- `docs/story-agent-stage8-p2-blind-review-signature-inspector-implementation-20260712.md`

## 4. P20 / P21 / P22 当前做到哪里

目标是把既有 `professional-benchmark-finalization-input/v2` 候选门禁接成 75 项目只读 operator 预检，并清楚区分：

```text
Finalization candidate ≠ Durable signed release ≠ Professional pass
```

### 4.1 已实现，且已通过最小验证

- 新增服务：`web/server/src/services/stage8-finalization-preflight-service.ts`
  - 复用 `evaluateProfessionalBenchmarkFinalization()`。
  - 接受 finalization input JSON 与外部 trust policy JSON。
  - 校验固定 benchmark/video type 绑定。
  - 展示专业成品、真实修订增量、签名盲评、外部 trust、candidate、signed release 六条门禁。
  - 只返回内存 decision；固定 `input_persisted=false`、`finalization_started=false`、`signed_release_created=false`、`professional_passed=false`。
- 新增 API：
  - `GET /api/stage8-blind-review/finalization`
  - `POST /api/stage8-blind-review/finalization/validate`
  - persist/finalize/sign/release/approve/writeback 端点不存在。
- 新增页面：`/story/stage8-finalization-preflight`
  - 75 项目切换。
  - Finalization Input v2 与 External Trust Policy 双 JSON 编辑器。
  - fail-closed checks、逐项目六泳道和 decision blocker 展示。
- 新增准备模板与静态报告：
  - `data/professional-benchmarks/all-format-stage8-finalization-trust-policy.json`
  - `data/professional-benchmarks/all-format-stage8-finalization-operator-template.json`
  - `data/reports/story-agent-stage8-finalization-preflight-readiness.json`
  - `scripts/story-agent-stage8-finalization-preflight.mts`
- 新增 3 个测试：`web/server/src/__tests__/stage8-finalization-preflight.test.ts`。

当前报告为：75 项目、artifact ready 0、revision delta ready 0、signed review ready 0、external trust ready 0、candidate ready 0、signed release 0、professional pass 0。

已执行并通过：

```text
web/npm run check：通过
P20 targeted test：1 文件、3 用例通过
P20 report/template --write：通过
```

### 4.2 P20 验收已完成

以下剩余项已在本轮完成：

1. P20 stale-check已接入统一CI，六类ready/release/professional计数与准备态排除策略均由fail-closed policy强制。
2. 专业进度进入P20后又进入P21，始终保持47.5%。
3. P20实施文档与Playwright截图已保存。
4. P20完成Web 80文件/791用例、MCP 79文件/345用例、build、知识库lint与18/18统一CI。
5. P4在P20时重建为424文件、0 hold、0 staged；P21完成后再次重建为433文件、0 hold、0 staged。

### 4.3 P21 durable signed-release record只读导入检查器已完成

- 新增严格 `professional-benchmark-durable-signed-release/v1` 与不可变artifact manifest合同。
- record绑定finalization decision SHA-256、benchmark/run/video type、至少12件artifact、authority/key/scope、唯一release ID、签发/到期时间、record/payload digest与Ed25519。
- authority registry固定从仓库侧外部配置读取，请求不能自带trust；当前为空preparation template、active authority0。
- API只提供workspace GET与内存validate POST；create/sign/import/persist/release/approve/writeback端点不存在。
- 8个测试覆盖空registry、无效签名、撤销key、identity drift、重复ID、未来/过期时间、decision质量增量、manifest重复路径/关键摘要悬空与mutation endpoint缺失；没有生成key或有效签名。
- Playwright实测75项目、candidate0、authority0、verification0、import0、professional0，截图为`output/playwright/stage8-durable-release-import.png`。

### 4.4 P22 Stage 8五泳道总控与外部材料交接已完成

- 新增统一只读总控服务与 `GET /api/stage8-blind-review/operations`，聚合blind review intake、15片型evaluator、review signatures、finalization candidate和durable release五条泳道。
- 75个固定benchmark项目各自只有一个最早未满足的结构化NEXT；当前75/75全部停在外部盲评intake，没有跳过前序门禁。
- handoff仅在内存返回，固定`persisted=false`、`executed=false`、`external_completion_recorded=false`、`durable_release_imported=false`、`professional_passed=false`；没有新增任何写端点。
- readiness由五份Stage 8报告的SHA-256绑定；统一CI以fail-closed策略检查75项目、五泳道、15/15 evaluator合同和全部零信用计数。
- P22加固禁止把片型/portfolio汇总计数传播为逐项目ready；五份源报告由CI重新计算SHA-256，六阶段NEXT顺序已逐项目回归。上游没有benchmark级核验证据时继续fail closed。
- Stage 8全链加固同时拒绝P17未来提交/过期排期/事后核验、P19未来签名/事后授权，以及P21自报eligible但质量增量不一致、重复artifact路径或三项关键摘要未进入manifest。P22 source-bound handoff已随P19/P21报告重建。
- Playwright实测五泳道、75个NEXT、内存handoff和零信用安全字段，截图为`output/playwright/stage8-operations.png`；浏览器控制台仅有无关的`favicon.ico` 404。
- 实施文档为`docs/story-agent-stage8-p5-operations-control-tower-implementation-20260713.md`。

## 5. P20 设计边界和注意点

- 既有 `professional-benchmark-finalization-service.ts` 本身只是 candidate gate。即使所有签名和证据都验证成功，也只会返回 `eligible_for_signed_release=true`，同时保留 `signed_release_record_missing`，且 `professional_passed=false`。
- P20 不得增加签发 release 的写端点。真正 signed release 必须由独立、授权、可持久化的发布权限创建。
- 当前 finalization input 模板故意使用 fixture provenance 和空证据段，因此 schema/readiness 会 fail closed；它只是字段入口，不是完整证据。
- 当前 finalization trust policy 的 `keys=[]`，只是 preparation template，不是合法外部 trust；不得自动生成密钥或把测试密钥写入真实策略。
- 测试若使用有效 Ed25519 fixture，只能证明验证逻辑，必须明确排除真实签名、真人通过、release 和专业信用。
- 不调用付费模型；不要读取或验证真实付费凭据，不要把 CLI 存在当作授权。

## 6. P22 之后建议继续的顺序

### P21：Durable signed-release record 只读导入检查器（已完成）

在不提供 signer 的前提下，建立 signed-release record 的严格 schema 和只读验证：

- 绑定 finalization decision SHA-256、benchmark、run、video type、发布权限 ID、外部 key、签发时间和不可变 artifact manifest。
- trust/authority registry 必须来自外部配置，不能由请求自报。
- 支持签名篡改、撤销 key、identity drift、重复 release ID、过期/未来时间等 fail-closed 测试。
- 只验证导入的 durable record，不创建、不签署、不持久化、不授予 professional pass。

### P22：Stage 8 总控与外部材料交接（已完成）

- 把 intake、evaluator、review signatures、finalization candidate 和 signed release 汇总成 75 项目统一 control tower。
- 每项目只给一个结构化 NEXT，不猜测补齐外部证据。
- 可复制内存 handoff，但不得写回真实通过状态；当前没有把handoff持久化或执行。

### 外部材料到位后

- Stage 6：逐项目执行两轮真实修订，共目标 30 轮；保存成本、桌读关闭、质量增量和派生重建证据。
- Stage 7：真实人工审稿、签名和黄金卡晋升。
- Stage 8：真实外部盲评、三角色签名、finalization candidate 和独立 signed release。
- 在上述外部证据未到位之前，专业进度不得因继续建设准备能力上涨。

## 7. Dirty worktree 与验证基线

必须保留 dirty worktree：不 reset、不覆盖用户改动、不删除、不自动暂存、不 commit、不 push。

P22完成后的原始状态：

```text
tracked modified：30
untracked files：410
staged：0
total file-level changes：440
```

P22 当前完整基线：

```text
Unified CI：20 / 20 步通过
Web Server：82 个测试文件、806 个用例通过
MCP Server：79 个测试文件、345 个用例通过
P4：440 文件、0 hold、0 staged
```

P20完整基线为18/18统一CI通过；P21最终基线为19/19；P22最终基线为20/20。任何后续改动都必须重跑，不能沿用旧数字。

## 8. 新对话首条指令

复制以下内容：

> 阅读 `docs/story-agent-new-conversation-handoff-20260712.md`、`docs/story-agent-all-format-professional-text-creation-handoff-20260710.md` 和 `docs/story-agent-integrated-execution-plan-20260710.md`，继续推进 Story Agent。
>
> P20 finalization只读预检、P21 durable signed-release record只读导入检查器与P22 Stage 8五泳道总控/内存handoff已完成。下一步只能在用户提供并授权使用真实外部材料后，按每项目唯一NEXT推进Stage 6真实修订、Stage 7真人审稿或Stage 8外部盲评/签名/finalization/独立release；不得猜测外部证据或写回真实通过状态。
>
> 保留 dirty worktree，不调用付费模型，不创建签名或 release，不把 fixture、simulation、fallback、prepared、readiness、机器阈值或测试验签计为真实修订、真人盲评、signed release 或专业通过；不暂存、不提交、不推送。
