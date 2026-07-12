# Story Agent Stage 6 P1 修订批次执行器实施报告

状态：`revision_batch_executor_complete_all_15_blocked_by_p0_external_inputs`

## 本轮完成

P1 已建立独立、opt-in、fail-closed 的 Round 1 / Round 2 修订批次执行器：

- 默认命令只执行 preflight；只有同时传入 `--execute` 且 command 内 `opt_in_execution_confirmed=true` 才允许写执行 artifact。
- 执行前验证 P0 readiness 文件 SHA-256、schema、原 intake canonical SHA-256，并用固定 registry 重新计算 readiness；手工把 `blocked` 改为 `ready` 不能通过。
- Round 1 必须使用 P0 核验的初始包；Round 2 必须直接链接 Round 1 不可变 `revised_package` artifact 和前一轮 package SHA-256。
- 校验项目/片型身份、授权创作者与主体类型、输出核验引用/核验人/核验时间、两轮授权、累计预算、成本币种、三类实名桌读反馈、正文/分场变化声明和 ProfessionalTextPackage schema。
- 正文变化但未同步提交分场时 fail closed；合法修订后统一重建 `sequence_beats`、`director_text_plan` 和 `delivery_text_package`。
- 每次 attempt 保存不可变 before package、revision submission、桌读反馈、成本、重建后 package、Coverage、ledger 和 round manifest，共八类 SHA-256 DAG artifact。
- 项目状态采用原子更新；部分失败保留失败 attempt，重试创建新的不可变 attempt；相同已完成 command 再次执行只返回 recovered，不重复计数。
- simulation 和 fixture 可用于状态机测试，但 `verified_real_revision_credit=false`；recovery、prepared、blocked 和 command template 均不计修订完成。
- executor 固定 `professional_passed=false`，无法授予专业通过。

## 文件

- 批次执行服务：`web/server/src/services/professional-multi-round-revision-batch-service.ts`
- 合同测试：`web/server/src/__tests__/professional-multi-round-revision-batch.test.ts`
- CLI：`scripts/story-agent-stage6-revision-batch.mts`
- command 模板：`data/professional-benchmarks/all-format-stage6-p1-revision-command-template.json`
- 桌读模板：`data/professional-benchmarks/all-format-stage6-p1-table-read-feedback-template.json`
- 成本模板：`data/professional-benchmarks/all-format-stage6-p1-revision-cost-template.json`
- 当前批次状态：`data/reports/story-agent-stage6-p1-revision-batch-status.json`

## Operator 命令

Preflight，不写 execution artifact：

```bash
npx tsx --tsconfig web/server/tsconfig.json scripts/story-agent-stage6-revision-batch.mts \
  --command path/to/stage6-round-command.json
```

显式执行：

```bash
npx tsx --tsconfig web/server/tsconfig.json scripts/story-agent-stage6-revision-batch.mts \
  --command path/to/stage6-round-command.json \
  --execute
```

该执行器不主动调用任何模型；它只导入已由授权模型或人工创作者产生的修订 submission，并验证、重建和持久化证据链。

## 当前状态

```text
覆盖片型：15 / 15
计划项目：15
计划轮次：30
P0 ready：0 / 15
blocked：15 / 15
Round 1 可执行：0 / 15
完成两轮真实修订项目：0 / 15
已验证真实修订轮次：0
professional_pass_count：0
professional_text_creation_progress：40% -> 40%
```

当前只运行了临时目录中的 simulation 合同测试；这些测试验证零信用、不可变 artifact、Round 2 哈希链、失败重试和恢复，不写入 `web/generated/stage6-revisions`，不计真实修订。

验证基线：Web Server 63 个测试文件、719 个用例通过；P0/P1/多轮修订窄测 17/17 通过。

## 下一步

进入 P2 桌读与版本差异产品面。外部真实输入到位前，P1 CLI 对当前 15 个项目保持 fail closed。
