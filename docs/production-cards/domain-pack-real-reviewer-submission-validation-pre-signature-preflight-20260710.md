# Domain Pack 真实人审回填校验夹具与签署前预检

更新时间：2026-07-10

状态：submission_validation_fixtures_created_pre_signature_preflight_blocked

本文件为真实人审回填契约提供格式回归夹具和签署前预检基线。所有姓名、附件引用、签署引用和时间均为结构校验数据，不代表真实人员、真实文件或真实签署。

## 边界声明

- simulation_fixtures_are_real_submissions: false
- structurally_valid_fixture_is_signed: false
- pre_signature_preflight_is_approval: false
- attachment_references_verified: false
- signature_references_verified: false
- formal_patch_request_recorded: false
- formal_patch_created: false
- formal_domain_pack_written: false
- province_markdown_written: false

格式合法仅表示字段形状、角色映射、决定值域和交叉引用通过。真实身份、附件记录和签署记录仍必须由外部流程核验；模拟夹具永远不能转成真实提交。

## 格式合法模拟夹具

| 夹具 | 来源模板 | 轨道与决定 | 格式结果 | 签署前状态 |
|---|---|---|---|---|
| submission-fixture-valid-craft-approved-001 | real-reviewer-intake-001 | 人工 Patch 候选 / approved | valid_as_simulation_fixture_only | blocked |
| submission-fixture-valid-craft-rejected-001 | real-reviewer-intake-004 | 人工 Patch 候选 / rejected_for_rework | valid_as_simulation_fixture_only | blocked |
| submission-fixture-valid-repair-resubmit-001 | real-reviewer-intake-005 | 修复重提审 / approved_for_resubmission | valid_as_simulation_fixture_only | blocked |

三份夹具均满足格式与交叉引用要求，但仍缺少真实身份核验、真实附件解析、真实签署记录解析，并且带有 `simulation_only` 标记。因此 `is_signed=false`、`pre_signature_ready=false`。

## 非法模拟夹具

| 夹具 | 模拟错误 | 预期失败规则 |
|---|---|---|
| submission-fixture-invalid-source-id-001 | 候选 ID 与来源模板不一致 | intake-source-identifiers-must-match-handoff |
| submission-fixture-invalid-reviewer-name-001 | 审稿人或小组为空 | reviewer-name-must-be-real-and-nonblank |
| submission-fixture-invalid-identity-type-001 | 主体类型为 anonymous | reviewer-identity-type-must-be-valid |
| submission-fixture-invalid-role-001 | 审稿角色与锁定角色不一致 | reviewer-role-must-match-locked-role |
| submission-fixture-invalid-assignment-001 | 分派 ID 与角色不匹配 | assignment-or-followup-must-match-role |
| submission-fixture-invalid-decision-001 | 修复轨道使用人工 Patch 候选决定值 | decision-must-match-review-track |
| submission-fixture-invalid-reason-001 | 决定理由为空 | decision-reason-must-be-nonblank |
| submission-fixture-invalid-attachments-001 | 六类附件槽位缺一项 | all-attachment-slots-must-have-record-or-waiver |
| submission-fixture-invalid-timezone-001 | 签署时间无时区 | signed-at-must-have-timezone |
| submission-fixture-invalid-signature-reference-001 | 签署记录引用为空 | signature-record-reference-must-be-nonblank |
| submission-fixture-invalid-patch-request-001 | 声称请求 Patch 但无独立记录 | formal-patch-request-must-have-separate-authorized-record |

11 份非法夹具分别覆盖 11 条来源校验规则，便于后续真实回填导入时做定点失败定位。

## 模拟附件引用集

| 引用集 | 证据包 | 槽位数 | 外部核验 |
|---|---|---:|---|
| simulation-attachment-set-complete-craft-001 | evidence-freeze-package-001 | 6 | false |
| simulation-attachment-set-complete-repair-001 | evidence-freeze-package-002 | 6 | false |
| simulation-attachment-set-incomplete-craft-001 | evidence-freeze-package-001 | 5 | false |

前两组只在结构上覆盖六类槽位，不代表附件存在。第三组故意缺少最终决策记录，用于附件完整性失败回归。

## 签署前预检矩阵

| 检查项 | 类型 | 模拟夹具能否满足 |
|---|---|---|
| source-contract-cross-reference-valid | 确定性 | 格式合法夹具可满足 |
| real-reviewer-identity-externally-verified | 外部人工核验 | 否 |
| reviewer-role-locked-and-matched | 确定性 | 格式合法夹具可满足 |
| assignment-or-followup-matched | 确定性 | 格式合法夹具可满足 |
| decision-value-valid-for-track | 确定性 | 格式合法夹具可满足 |
| decision-reason-present | 确定性 | 格式合法夹具可满足 |
| attachment-records-externally-resolved | 外部记录核验 | 否 |
| signed-at-format-and-timezone-valid | 确定性 | 格式合法夹具可满足 |
| signature-record-externally-resolved | 外部记录核验 | 否 |
| formal-patch-request-separated-and-authorized | 确定性加外部核验 | 仅 false 路径可做格式校验 |
| simulation-fixture-excluded-from-real-submission | 硬隔离规则 | 模拟夹具必须被排除 |
| formal-write-boundaries-still-zero | 硬隔离规则 | 必须满足 |

签署前预检结果共 14 条，当前 `pre_signature_ready` 数量为 0。

## 失败原因汇总

| 失败组 | 影响数量 | 处理方式 |
|---|---:|---|
| deterministic_rule_failures | 11 个非法夹具 | 修正字段或交叉引用后重新校验 |
| real_identity_not_verified | 3 个格式合法夹具 | 外部核实真实个人或可追责小组 |
| attachment_records_not_verified | 3 个格式合法夹具 | 解析到真实附件或有权豁免记录 |
| signature_records_not_verified | 3 个格式合法夹具 | 解析到真实签署记录 |
| simulation_fixture_disqualified | 全部 14 个夹具 | 不允许晋升，必须导入独立真实记录 |

## 本轮结论

14 个校验夹具、11 条规则覆盖和 12 项签署前预检已经建立。当前真实审稿提交数、真实签署数、签署前可通过数、正式 Patch 数和正式库写入数均为 0。
