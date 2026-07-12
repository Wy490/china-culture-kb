# Domain Pack 真实适配器配置契约与安全启用门槛

更新时间：2026-07-10

状态：real_adapter_registry_created_all_adapters_disabled

本轮实现 `mcp-server/src/lib/real-submission-external-adapter-registry.ts`，为五类真实外部解析适配器提供配置校验和安全启用资格评估。注册表不读取环境变量值，不保存秘密，不实例化运行时适配器。

## 边界声明

- adapter_registry_is_runtime_registration: false
- disabled_config_is_external_connection: false
- manual_registration_eligible_is_enabled: false
- environment_variable_references_are_secret_values: false
- environment_values_read: false
- formal_patch_created: false
- formal_domain_pack_written: false
- province_markdown_written: false

即使某个配置满足全部门槛，评估结果也只是 `eligible_for_manual_runtime_registration`，仍需独立人工操作才能注册运行时适配器。

## 配置字段

每个适配器包含 17 个字段，覆盖：

- adapter / resolver 标识和 external 模式。
- `enabled`，默认必须为 false。
- endpoint 环境变量名称。
- 认证方式和凭据环境变量名称列表。
- 相对健康检查路径与超时。
- 审计日志落点环境变量名称。
- 负责人角色。
- health、audit、simulation isolation、human approval 状态。
- 人工批准记录引用。
- 固定为 false 的 runtime_adapter_registered。

配置文件中禁止出现 api_key、token、secret、password、private_key 等秘密值字段。

## 五类默认配置

| 适配器 | resolver | 认证 | enabled | 运行时注册 |
|---|---|---|---|---|
| external-source-submission-adapter | source-submission-record-resolver | bearer_env | false | false |
| external-reviewer-identity-adapter | reviewer-identity-record-resolver | bearer_env | false | false |
| external-attachment-record-adapter | attachment-or-waiver-record-resolver | api_key_env | false | false |
| external-signature-record-adapter | signature-record-resolver | mtls_env | false | false |
| external-formal-patch-request-adapter | formal-patch-request-record-resolver | bearer_env | false | false |

注册表只保存 16 个环境变量名称引用，不保存这些环境变量的值。

## 八项启用门槛

| 门槛 | 要求 |
|---|---|
| config-valid | 字段、resolver ID、超时和健康路径合法 |
| endpoint-reference-ready | endpoint 只用环境变量名称引用 |
| auth-reference-ready | 凭据只用环境变量名称列表引用 |
| health-check-passed | health_check_status=passed |
| audit-sink-ready | audit_readiness_status=ready 且审计落点合法 |
| simulation-isolation-passed | 已验证拒绝 fixture 和 SIMULATION 引用 |
| human-approval-verified | approved 且有独立批准记录引用 |
| runtime-registration-remains-manual | 静态配置不得注册运行时适配器 |

## 注册表状态

| 状态 | 含义 |
|---|---|
| all_disabled_default | 全部配置合法且默认禁用 |
| invalid_registry | 存在非法配置、重复 ID 或 resolver 覆盖错误 |
| enablement_blocked | 请求 enabled，但安全门槛未全部通过 |
| manual_registration_eligible | 门槛满足，只具备人工注册资格 |

## 测试场景

| 场景 | 注册表状态 | 目标适配器状态 | 运行时注册 |
|---|---|---|---|
| registry-all-disabled-default-001 | all_disabled_default | disabled_default | 0 |
| registry-enabled-without-gates-blocked-001 | enablement_blocked | blocked_enablement_gates | 0 |
| registry-invalid-direct-endpoint-blocked-001 | invalid_registry | blocked_invalid_config | 0 |
| registry-gates-met-manual-registration-only-001 | manual_registration_eligible | eligible_for_manual_runtime_registration | 0 |

## 本轮结论

五类真实适配器配置、八项安全门槛和默认禁用注册表已经建立。秘密值、已启用适配器、运行时适配器、真实外部连接、正式 Patch 和正式库写入数量全部为 0。
