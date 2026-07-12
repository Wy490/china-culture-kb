# Domain Pack 导入信封校验器与拒绝报告夹具

更新时间：2026-07-10

状态：local_import_validator_fixtures_created_real_import_still_zero

本轮实现 `mcp-server/src/lib/real-submission-import-validator.ts`，对真实提交导入信封执行本地确定性校验。校验器不连接外部身份、附件、签署或授权系统，也不写入正式知识库。

## 边界声明

- local_format_pass_is_real_import: false
- rejection_fixture_is_real_submission: false
- validator_runs_external_resolvers: false
- validator_result_is_signature: false
- formal_patch_created: false
- formal_domain_pack_written: false
- province_markdown_written: false

校验器只有两种状态：

- `rejected_local_validation`：本地字段、路由或模拟数据隔离失败。
- `format_valid_external_resolution_required`：本地格式通过，但仍必须解析外部来源、身份、六类附件、签署，以及条件性的 Patch 请求记录。

它永远不会返回“真实提交已导入”或“已签署”。

## 本地校验范围

| 范围 | 校验内容 |
|---|---|
| 24 字段完整性 | 无条件必填字段及条件 Patch 请求记录 |
| 版本与元数据 | 合同版本、带时区接收时间、来源、幂等键、SHA-256 摘要 |
| 路由锁定 | 交接包、填报模板、候选、角色、分派、证据包 |
| 审稿输入 | 真实主体类型、决定值域、理由 |
| 附件清单 | 六类唯一槽位，每项有附件或豁免记录引用 |
| 签署格式 | 带时区签署时间和非空签署记录引用 |
| Patch 隔离 | true 时必须有独立请求记录，但校验器不创建 Patch |
| 提交者声明 | 五项反 fixture、反 simulation、反空白模板声明 |

## 本地格式通过场景

| 场景 | Patch 请求 | 本地结果 | 待解析项 | 真实导入 |
|---|---|---|---:|---|
| validator-format-pass-external-resolution-required-001 | false | format_valid_external_resolution_required | 9 | false |
| validator-format-pass-patch-request-external-resolution-required-001 | true | format_valid_external_resolution_required | 10 | false |

Patch 请求为 false 时，外部提交原始记录、真实身份、六类附件和签署记录共 9 项待解析。Patch 请求为 true 时，还要解析独立授权请求记录，共 10 项。

## 模拟数据拒绝报告

| 场景 | 拒绝原因 | 失败规则 |
|---|---|---|
| validator-reject-fixture-identifier-001 | reject-fixture-identifiers | import-envelope-id-must-not-be-fixture |
| validator-reject-simulation-reference-001 | reject-simulation-record-references | all-record-references-must-reject-simulation |
| validator-reject-structural-placeholder-001 | reject-structural-placeholder-values | reviewer-identity-record-must-resolve |
| validator-reject-simulation-metadata-001 | reject-simulation-flags-and-fixture-metadata | submitter-attestation-must-reject-template-data |

四类拒绝场景分别覆盖 fixture ID、`SIMULATION` 引用、结构占位值和 simulation 元数据。拒绝结果不会进入外部解析阶段。

## 输出结构

校验器返回：

- `status`
- `local_format_valid`
- `eligible_for_external_resolution`
- `matched_import_route_id`
- `field_errors`
- `failed_validation_rule_ids`
- `rejection_reason_ids`
- `unresolved_external_check_ids`
- 固定为 false 的真实导入、签署、Patch、正式库写入状态

## 本轮结论

确定性导入校验器、2 个本地格式通过场景和 4 个拒绝报告场景已经建立。外部解析器运行数、真实提交导入数、真实签署数、正式 Patch 数和正式库写入数仍为 0。
