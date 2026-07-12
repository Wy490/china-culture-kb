# Domain Pack 真实审稿人填报字段冻结与外部执行清单

更新时间：2026-07-10

状态：real_reviewer_intake_fields_frozen_external_execution_checklist_created

本文件把两个人审交接包拆成按角色填写的真实审稿输入契约，并给出外部人工执行顺序。当前所有填报实例均为空白模板，不包含真实姓名、决定、附件记录、签署记录或正式 Patch 请求。

## 写入与签署边界

- reviewer_intake_templates_are_real_submissions: false
- blank_intake_is_signature: false
- external_execution_checklist_is_run_result: false
- formal_patch_request_recorded: false
- formal_patch_created: false
- formal_domain_pack_written: false
- province_markdown_written: false

填报模板只有在真实人员完成输入、通过全部校验并提供独立签署记录后，才可能成为有效审稿提交。有效审稿提交仍不能自动创建正式 Patch。

## 冻结字段

| 字段 | 要求 | 填写来源 | 说明 |
|---|---|---|---|
| reviewer_intake_id | 必填 | 系统预填、不可改 | 填报记录 ID |
| source_handoff_package_id | 必填 | 系统预填、不可改 | 人审交接包 ID |
| candidate_id | 必填 | 系统预填、不可改 | 候选 Domain Pack ID |
| reviewer_name_or_group | 必填 | 真实外部输入 | 真实个人或可追责小组，不允许 `[待指定]` |
| reviewer_identity_type | 必填 | 真实外部输入 | person / accountable_group |
| reviewer_role | 必填 | 系统预填、角色锁定 | 必须匹配交接包角色 |
| assignment_or_followup_id | 必填 | 系统预填、不可改 | 签署分派或修复跟进 ID |
| review_decision | 必填 | 真实外部输入 | 值域按审稿轨道限制 |
| decision_reason | 必填 | 真实外部输入 | 不能留空 |
| evidence_package_id | 必填 | 系统预填、不可改 | 证据包 ID |
| attachment_record_references | 必填 | 真实外部输入 | 逐项关联 6 类附件槽位 |
| attachment_waiver_record_references | 可选 | 有权人员输入 | 只用于记录明确豁免 |
| signed_at | 必填 | 真实外部输入 | 带时区 ISO 8601 时间 |
| signature_record_reference | 必填 | 真实外部输入 | 必须指向独立签署记录 |
| explicit_formal_patch_request | 必填 | 有权人员输入，默认 false | 审稿提交本身不能自动改为 true |
| formal_patch_request_record_reference | 条件必填 | 有权人员输入 | 仅当显式请求 Patch 时必填 |

字段统计：16 个冻结字段，其中 14 个无条件必填、1 个条件必填、1 个可选。

## 校验规则

1. 来源交接包、候选、证据包和记录 ID 必须与冻结模板一致。
2. 真实审稿人姓名或小组不能为空，也不能使用占位符或模拟名称。
3. 审稿主体类型只能是 person 或 accountable_group。
4. 审稿角色必须匹配交接包冻结角色。
5. 分派或跟进 ID 必须与角色一一对应。
6. 审稿决定必须属于对应轨道的允许值。
7. 决定理由不能为空。
8. 六类附件槽位必须逐项有附件引用或有权豁免记录。
9. 签署时间必须带时区。
10. 签署记录引用不能为空，空白审稿单不能充当签署记录。
11. 正式 Patch 请求必须有独立有权记录，审稿提交本身不能创建 Patch。

## 空白填报实例

### 人工 Patch 候选审稿

| 填报 ID | 交接包 | 角色 | 分派 | 当前状态 |
|---|---|---|---|---|
| real-reviewer-intake-001 | human-handoff-package-001 | 事实/工艺流程审稿负责人 | dispatch-signature-001 | blocked_blank_external_intake |
| real-reviewer-intake-002 | human-handoff-package-001 | 材料工具与去重合并审稿负责人 | dispatch-signature-002 | blocked_blank_external_intake |
| real-reviewer-intake-003 | human-handoff-package-001 | 授权与证据附件负责人 | dispatch-signature-003 | blocked_blank_external_intake |
| real-reviewer-intake-004 | human-handoff-package-001 | 人工 Patch 复核负责人 | dispatch-signature-004 | blocked_blank_external_intake |

允许决定：approved / rejected_for_rework。

### 修复重提审

| 填报 ID | 交接包 | 角色 | 跟进项 | 当前状态 |
|---|---|---|---|---|
| real-reviewer-intake-005 | human-handoff-package-002 | 医疗伦理审稿负责人 | repair-evidence-followup-001 | blocked_blank_external_intake |
| real-reviewer-intake-006 | human-handoff-package-002 | 授权与证据附件负责人 | repair-evidence-followup-002 | blocked_blank_external_intake |
| real-reviewer-intake-007 | human-handoff-package-002 | 事实边界审稿负责人 | repair-evidence-followup-003 | blocked_blank_external_intake |
| real-reviewer-intake-008 | human-handoff-package-002 | 审稿签署管理员 | repair-evidence-followup-004 | blocked_blank_external_intake |

允许决定：approved_for_resubmission / rejected_for_more_evidence。

全部 8 份实例当前都缺少真实姓名、主体类型、决定、理由、附件引用、签署时间和签署记录，因此有效真实审稿提交数仍为 0。

## 外部执行清单

### 负责人指定

| 任务 | 来源失败 | 分派 | 目标填报 | 状态 |
|---|---|---|---|---|
| external-owner-task-001 | missing-owner-001 | dispatch-signature-001 | real-reviewer-intake-001 | open_external_human_action |
| external-owner-task-002 | missing-owner-002 | dispatch-signature-002 | real-reviewer-intake-002 | open_external_human_action |
| external-owner-task-003 | missing-owner-003 | dispatch-signature-003 | real-reviewer-intake-003 | open_external_human_action |
| external-owner-task-004 | missing-owner-004 | dispatch-signature-004 | real-reviewer-intake-004 | open_external_human_action |

### 附件提交

| 任务 | 证据包 | 必备槽位 | 当前状态 |
|---|---|---:|---|
| external-attachment-task-001 | evidence-freeze-package-001 | 6 | open_external_human_action |
| external-attachment-task-002 | evidence-freeze-package-002 | 6 | open_external_human_action |

每个槽位必须有真实附件记录引用或有权豁免记录。仅填写文件名或描述不能视为附件已提交。

### 审稿与签署提交

| 任务范围 | 数量 | 当前状态 |
|---|---:|---|
| external-review-task-001 至 external-review-task-008 | 8 | blocked_blank_intake |

八项任务分别对应八份角色填报实例。只有填写完成、通过 11 条校验并提供独立签署记录后，才能由后续流程记录为有效审稿提交。

### 正式 Patch 后检查

| 任务 | 命令 | 当前状态 | 是否已运行 |
|---|---|---|---|
| external-post-patch-task-001 | `npm run kb:production-audit` | blocked_until_formal_patch | false |
| external-post-patch-task-002 | `npm run kb:lint` | blocked_until_formal_patch | false |

本轮没有正式 Patch，因此这两个命令未运行，外部执行清单也不能被当作运行结果。

## 外部执行顺序

1. 为 4 个签署分派指定真实负责人并保留指派记录。
2. 为两个证据包分别处理 6 类附件槽位。
3. 将对应的 8 份角色填报实例交给真实审稿人填写。
4. 校验角色、决定、附件、时间和签署记录，任何一项失败都保持阻断。
5. 只有有权人员另行显式提出正式 Patch 请求，才能进入正式写入流程。
6. 正式 Patch 完成后运行 production audit 与 kb lint 并记录运行结果。

## 本轮结论

真实人审输入契约和外部执行顺序已经冻结，但所有实例仍为空白模板。当前有效真实审稿提交数、正式 Patch 数、audit/lint 运行数和正式库写入数均为 0。
