# Domain Pack 真实提交导入契约与外部记录解析清单

更新时间：2026-07-10

状态：real_submission_import_contract_created_external_records_unresolved

本文件定义真实审稿提交进入素材库治理流程前必须满足的导入信封、外部记录解析和模拟数据拒绝要求。它不包含真实提交，也不执行正式 Patch。

## 边界声明

- import_contract_is_real_submission: false
- blank_import_route_is_imported_submission: false
- external_record_checklist_is_resolution_result: false
- simulation_fixture_import_allowed: false
- formal_patch_request_recorded: false
- formal_patch_created: false
- formal_domain_pack_written: false
- province_markdown_written: false

真实提交只能从独立外部记录导入。上一轮的 14 个校验夹具、模拟附件引用和模拟签署引用只能用于测试，禁止复用为真实提交。

## 导入信封

真实导入信封包含 24 个字段，其中 23 个无条件必填，`formal_patch_request_record_reference` 在显式请求正式 Patch 时条件必填。

| 字段组 | 字段 | 主要约束 |
|---|---|---|
| 导入元数据 | import_envelope_id、import_contract_version、received_at | 不得包含 fixture 或 simulation 标记 |
| 外部来源 | source_system、source_record_id、idempotency_key、payload_digest_sha256 | 来源唯一、可追踪、摘要为 64 位小写十六进制 |
| 冻结路由 | source_handoff_package_id、reviewer_intake_id、candidate_id | 必须匹配角色级导入路由 |
| 真实身份 | reviewer_name_or_group、reviewer_identity_type、reviewer_identity_record_reference | 身份记录必须外部解析 |
| 审稿路由 | reviewer_role、assignment_or_followup_id | 角色与分派必须匹配 |
| 审稿决定 | review_decision、decision_reason | 值域匹配审稿轨道，理由非空 |
| 证据 | evidence_package_id、attachment_record_manifest | 六类槽位逐项解析 |
| 签署 | signed_at、signature_record_reference | 时间带时区，签署记录外部解析 |
| Patch 请求 | explicit_formal_patch_request、formal_patch_request_record_reference | 与审稿提交分离，true 时必须有授权记录 |
| 声明 | submitter_attestation | 明确不是夹具、模拟、空白模板或自动生成签署 |

## 模拟数据拒绝规则

| 规则 | 拒绝内容 | 处理 |
|---|---|---|
| reject-fixture-identifiers | `submission-fixture-`、fixture_id、validation_fixture | reject_real_import |
| reject-simulation-record-references | `SIMULATION-`、simulation-attachment-set- | reject_real_import |
| reject-structural-placeholder-values | 结构校验占位、结构校验文本、`[待指定]` | reject_real_import |
| reject-simulation-flags-and-fixture-metadata | simulation_only、fixture_validation_mode、derived_from_fixture_id | reject_real_import |

上一轮全部 14 个 fixture ID 均已进入显式拒绝列表。

## 外部记录解析器

| 解析器 | 记录类型 | 当前状态 |
|---|---|---|
| source-submission-record-resolver | 外部提交原始记录 | resolver_contract_only_not_run |
| reviewer-identity-record-resolver | 审稿人身份记录 | resolver_contract_only_not_run |
| attachment-or-waiver-record-resolver | 附件或有权豁免记录 | resolver_contract_only_not_run |
| signature-record-resolver | 签署记录 | resolver_contract_only_not_run |
| formal-patch-request-record-resolver | 有权正式 Patch 请求记录 | conditional_resolver_contract_only_not_run |

解析器当前只有契约，没有真实外部系统连接，也没有产生解析结果。

## 记录解析清单

| 解析项 | 数量 | 当前状态 |
|---|---:|---|
| 外部提交原始记录 | 1 | missing_real_import_envelope |
| 真实审稿人身份记录 | 1 | missing_real_import_envelope |
| 六类附件或豁免记录 | 6 | missing_real_import_envelope |
| 签署记录 | 1 | missing_real_import_envelope |
| 正式 Patch 请求记录 | 1 | not_applicable_until_explicit_request |

清单共 10 项。只有前 9 项全部解析成功，且第 10 项按请求状态正确处理，导入信封才可能进入后续真实提交校验。

## 角色级导入路由

| 路由 | 填报模板 | 交接包 | 角色 | 当前状态 |
|---|---|---|---|---|
| real-import-route-001 | real-reviewer-intake-001 | human-handoff-package-001 | 事实/工艺流程审稿负责人 | blocked_blank_import_envelope |
| real-import-route-002 | real-reviewer-intake-002 | human-handoff-package-001 | 材料工具与去重合并审稿负责人 | blocked_blank_import_envelope |
| real-import-route-003 | real-reviewer-intake-003 | human-handoff-package-001 | 授权与证据附件负责人 | blocked_blank_import_envelope |
| real-import-route-004 | real-reviewer-intake-004 | human-handoff-package-001 | 人工 Patch 复核负责人 | blocked_blank_import_envelope |
| real-import-route-005 | real-reviewer-intake-005 | human-handoff-package-002 | 医疗伦理审稿负责人 | blocked_blank_import_envelope |
| real-import-route-006 | real-reviewer-intake-006 | human-handoff-package-002 | 授权与证据附件负责人 | blocked_blank_import_envelope |
| real-import-route-007 | real-reviewer-intake-007 | human-handoff-package-002 | 事实边界审稿负责人 | blocked_blank_import_envelope |
| real-import-route-008 | real-reviewer-intake-008 | human-handoff-package-002 | 审稿签署管理员 | blocked_blank_import_envelope |

八条路由只锁定交接包、候选、角色、分派、证据包和允许决定值。真实来源、身份、附件和签署字段仍为空，因此导入数为 0。

## 导入顺序

1. 外部系统创建独立真实提交记录，生成稳定 source_record_id。
2. 导入系统选择匹配的角色级路由，并生成新 import_envelope_id。
3. 填写 24 个信封字段，计算 payload digest 和幂等键。
4. 运行 4 条模拟数据拒绝规则和 14 条入口校验。
5. 调用 5 类解析器完成 10 项记录解析。
6. 所有要求满足后，才可把信封记录为真实审稿提交候选。
7. 真实审稿提交仍不能自动创建 Patch，必须另行经过授权决策。

## 本轮结论

真实提交导入入口已与模拟夹具彻底分离，但当前没有真实外部信封、没有已解析记录、没有真实签署、没有正式 Patch，也没有正式库写入。
