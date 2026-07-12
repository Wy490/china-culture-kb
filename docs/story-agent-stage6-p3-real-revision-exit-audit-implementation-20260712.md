# Story Agent Stage 6 P3 真实两轮修订退出审计实施报告

状态：`exit_audit_contract_complete_all_15_blocked_external_inputs`

P3 的真实执行仍未开始；本轮完成的是执行后不可绕过的退出审计合同。

## 审计门槛

每个项目只有同时满足以下条件，才会标记为 `eligible_for_stage6_exit_review`：

1. P0 readiness 用原 intake 和 registry 重新计算后仍为 `ready`。
2. P1 state 与 registry、真实项目 ID、片型一致。
3. 恰好完成 Round 1、Round 2，且两轮均取得真实修订信用。
4. provenance 只能是已核验 `real_model` 或 `human_authored`；simulation、fixture、fallback、prepared 和 recovered 均不能获得信用。
5. 每轮八类不可变 artifact 唯一齐全，文件 SHA-256、大小、envelope、payload canonical hash、父哈希和 round manifest 均合法。
6. Round 0 → Round 1 → Round 2 的 ProfessionalTextPackage SHA-256 连续。
7. 两轮累计成本不超过 P0 授权预算，币种一致，output ID 与 provenance 一致。
8. 每轮都有编剧编辑、导演、事实文化评审三类实名反馈。
9. 不可变 ledger 与 P2 feedback review state 合并后，没有未关闭或重新打开的桌读意见。
10. 每轮 required derived sections 均有重建证据。
11. 两轮质量变化可追踪，至少一轮质量提升。

退出复核候选固定 `professional_passed=false`，仍需后续真人盲评和签署，不能自动升级为专业通过。

## 文件

- 审计服务：`web/server/src/services/stage6-real-revision-exit-audit-service.ts`
- 合同测试：`web/server/src/__tests__/stage6-real-revision-exit-audit.test.ts`
- CLI：`scripts/story-agent-stage6-real-revision-exit-audit.mts`
- 当前报告：`data/reports/story-agent-stage6-p3-real-revision-exit-audit.json`
- API：`GET /api/stage6-revisions/exit-audit`

## Operator 命令

```bash
npx tsx --tsconfig web/server/tsconfig.json \
  scripts/story-agent-stage6-real-revision-exit-audit.mts --check
```

外部执行或 P2 反馈状态变化后，使用 `--write` 刷新审计报告；`--check` 会拒绝陈旧报告。

## 当前结果

```text
项目：15
blocked：15
eligible_for_stage6_exit_review：0
已记录轮次：0
已验证真实修订轮次：0
有效未关闭反馈：0
专业通过：0
professional_text_creation_progress：40.8% -> 40.8%
```

当前阻断来自 P0 外部输入尚未提供，而不是审计器故障。未调用模型、未写修订 artifact、未伪造桌读或成本。

验证基线：P0/P1/P2/P3 窄测 13/13 通过；Web Server 65 个测试文件、728 个用例通过。
