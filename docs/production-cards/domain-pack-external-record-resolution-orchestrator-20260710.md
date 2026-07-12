# Domain Pack 外部记录解析适配器接口与编排器

更新时间：2026-07-10

状态：external_record_orchestrator_fixtures_created_real_resolution_zero

本轮实现 `mcp-server/src/lib/real-submission-external-record-orchestrator.ts`，在导入信封本地格式通过后编排 10 项外部记录解析检查。当前只提供接口和测试适配器，不连接真实外部系统。

## 边界声明

- test_adapter_result_is_real_resolution: false
- resolved_as_simulation_is_real_record: false
- orchestrator_result_is_real_import: false
- orchestrator_result_is_signature: false
- formal_patch_created: false
- formal_domain_pack_written: false
- province_markdown_written: false

测试适配器即使返回 `resolved_real`，编排器也会强制降级为 `resolved_as_simulation`。任何测试结果都不能成为真实外部记录、真实提交或真实签署。

## 五类适配器接口

| 接口 | 解析对象 | 当前实现 |
|---|---|---|
| SourceSubmissionRecordResolverAdapter | 外部提交原始记录 | 仅接口和测试适配器 |
| ReviewerIdentityRecordResolverAdapter | 真实审稿人身份记录 | 仅接口和测试适配器 |
| AttachmentOrWaiverRecordResolverAdapter | 六类附件或有权豁免记录 | 仅接口和测试适配器 |
| SignatureRecordResolverAdapter | 签署记录 | 仅接口和测试适配器 |
| FormalPatchRequestRecordResolverAdapter | 有权正式 Patch 请求记录 | 仅接口和测试适配器 |

每个适配器必须声明 `adapter_mode`：

- `simulation`：只能用于测试，不能产生真实解析。
- `external`：预留给未来真实系统连接；即使全部解析成功，仍需人工接受后才可能进入真实导入。

## 编排状态

| 状态 | 含义 |
|---|---|
| blocked_local_validation | 导入信封未通过本地校验，不调用解析适配器 |
| external_resolution_incomplete | 至少一项仍 unresolved |
| external_resolution_failed | 至少一项解析 failed |
| resolved_as_simulation_only | 适用项只在测试适配器中解析 |
| external_records_resolved_pending_human_acceptance | 预留给真实适配器全部解析后的人工接受阶段 |

无论哪种状态，编排器都固定返回：`real_submission_imported=false`、`is_signed=false`、`formal_patch_created=false`。

## 十项解析检查

| 检查组 | 数量 | 说明 |
|---|---:|---|
| 外部提交原始记录 | 1 | source_record_id |
| 真实审稿人身份 | 1 | reviewer_identity_record_reference |
| 附件或有权豁免 | 6 | 六类冻结槽位逐项解析 |
| 签署记录 | 1 | signature_record_reference |
| 正式 Patch 请求记录 | 1 | 仅 explicit_formal_patch_request=true 时适用 |

Patch 请求为 false 时，第十项状态为 `not_applicable`，其他九项仍必须解析。

## 测试场景

| 场景 | 编排结果 | unresolved | failed | simulation | not applicable |
|---|---|---:|---:|---:|---:|
| orchestrator-unresolved-external-records-001 | external_resolution_incomplete | 9 | 0 | 0 | 1 |
| orchestrator-signature-resolution-failed-001 | external_resolution_failed | 8 | 1 | 0 | 1 |
| orchestrator-resolved-as-simulation-only-001 | resolved_as_simulation_only | 0 | 0 | 9 | 1 |
| orchestrator-simulation-real-claim-downgraded-001 | resolved_as_simulation_only | 0 | 0 | 10 | 0 |
| orchestrator-blocked-by-local-validation-001 | blocked_local_validation | 0 | 0 | 0 | 0 |

## 输出结构

编排器返回：

- `status`
- `local_validation_status`
- 逐项 `check_results`
- unresolved / failed / resolved_as_simulation / resolved_real / not_applicable 汇总
- `all_required_checks_resolved_real`
- 固定为 false 的真实导入、签署、Patch 和正式写入状态

## 本轮结论

五类适配器接口和十项状态编排已经实现，unresolved、failed、resolved_as_simulation 三类测试状态已覆盖。真实适配器、真实解析结果、真实提交、真实签署、正式 Patch 和正式库写入仍全部为 0。
