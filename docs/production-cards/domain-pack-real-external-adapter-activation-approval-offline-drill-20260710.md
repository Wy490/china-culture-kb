# Domain Pack 真实适配器启用审批包与离线演练

更新时间：2026-07-10

状态：activation_approval_packages_created_offline_drill_only

本轮实现 `mcp-server/src/lib/real-submission-external-adapter-activation-drill.ts`，为五类默认禁用真实适配器生成独立人工启用审批包，并提供确定性的环境变量存在性快照和离线演练评估。模块不访问 `process.env`，不读取环境变量值，不发起网络请求，不实例化或注册适配器。

## 边界声明

- activation_approval_package_is_adapter_enablement: false
- offline_drill_is_real_connection: false
- environment_presence_snapshot_reads_values: false
- ready_for_manual_activation_review_is_runtime_registration: false
- adapter_enabled: false
- runtime_adapter_registered: false
- real_external_connection_created: false
- formal_patch_created: false
- formal_domain_pack_written: false
- province_markdown_written: false

即使环境变量名称均标记为 `present`、六项离线演练通过且存在人工批准记录，结果也只是 `ready_for_manual_activation_review`。它不会修改注册表中的 `enabled=false`，更不会注册运行时适配器。

## 五份审批包

| 审批包 | resolver | 负责人角色 | 环境变量名称数 | 当前状态 |
|---|---|---|---:|---|
| activation-approval-external-source-submission-adapter | source-submission-record-resolver | 外部提交记录适配器负责人 | 3 | pending_environment_snapshot_offline_drill_and_human_approval |
| activation-approval-external-reviewer-identity-adapter | reviewer-identity-record-resolver | 审稿人身份适配器负责人 | 3 | pending_environment_snapshot_offline_drill_and_human_approval |
| activation-approval-external-attachment-record-adapter | attachment-or-waiver-record-resolver | 附件与豁免记录适配器负责人 | 3 | pending_environment_snapshot_offline_drill_and_human_approval |
| activation-approval-external-signature-record-adapter | signature-record-resolver | 签署记录适配器负责人 | 4 | pending_environment_snapshot_offline_drill_and_human_approval |
| activation-approval-external-formal-patch-request-adapter | formal-patch-request-record-resolver | 正式 Patch 请求适配器负责人 | 3 | pending_environment_snapshot_offline_drill_and_human_approval |

每份审批包冻结 8 个待人工填写字段：请求 ID、申请人、适配器负责人确认、风险复核引用、变更窗口、回滚负责人、批准状态和批准记录引用。

## 环境变量存在性快照

快照条目只允许两个字段：

- `environment_variable_name`
- `presence_status`，值域仅为 `present` 或 `missing`

快照函数只接收调用者提供的“已存在变量名集合”，模块本身不访问运行环境。输出固定声明 `values_read=false` 和 `raw_secret_values_stored=false`，不得出现 value、secret、token、password 或 private_key 字段。

五份审批包共引用 16 次环境变量名称，去重后为 12 个；共享审计落点名称会在不同适配器审批包内重复出现，但任何值都不会进入生产卡或报告。

## 六项离线演练

| 检查 | 离线验证目标 |
|---|---|
| health-check-contract-validated | 相对健康路径、受控超时、脱敏失败输出 |
| audit-write-contract-validated | 审计事件字段完整且无凭据 |
| simulation-fixture-rejected | 真实路径拒绝 fixture ID |
| simulation-reference-rejected | 真实路径拒绝 SIMULATION 引用 |
| rollback-disablement-validated | 回滚首先恢复 enabled=false |
| rollback-registration-removal-validated | 回滚移除运行时注册并保留审计记录 |

这些检查只记录离线证据，不发起健康检查网络请求、不写真实审计落点、不连接外部记录系统。

## 八项评估门槛

离线演练评估由环境变量名称存在性、六项离线检查和人工批准记录共 8 项门槛组成。状态按最早阻断原因确定：

| 状态 | 含义 |
|---|---|
| blocked_invalid_config | 原始适配器配置不合法 |
| blocked_environment_references_missing | 环境变量名称快照缺失或与配置不匹配 |
| blocked_offline_drill | 环境名称齐全，但至少一项离线演练未通过 |
| blocked_human_approval | 离线演练通过，但没有 approved 状态与批准记录引用 |
| ready_for_manual_activation_review | 只具备进入人工激活复核的资格 |

## 四个回归场景

| 场景 | 预期状态 | 是否启用/注册/连接 |
|---|---|---|
| activation-drill-environment-missing-001 | blocked_environment_references_missing | false / false / false |
| activation-drill-offline-evidence-missing-001 | blocked_offline_drill | false / false / false |
| activation-drill-human-approval-missing-001 | blocked_human_approval | false / false / false |
| activation-drill-ready-for-manual-review-only-001 | ready_for_manual_activation_review | false / false / false |

全部场景均为 `simulation_only`，不得作为真实环境快照、真实演练结果或真实人工批准。

## 本轮结论

五份独立审批包、环境变量存在性快照契约、六项离线演练和八项评估门槛已经建立。当前真实环境值读取、秘密值存储、适配器启用、运行时注册、真实外部连接、正式 Patch 和正式库写入数量全部为 0。剩余工作必须由真实负责人携带外部记录和批准证据执行。
