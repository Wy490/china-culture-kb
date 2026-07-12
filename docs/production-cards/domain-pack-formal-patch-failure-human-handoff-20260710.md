# Domain Pack 正式 Patch 前失败报告与人审交接包

更新时间：2026-07-10

状态：formal_patch_failure_report_human_handoff_created

本文件将上一轮的审稿包锁版与失败原因索引整理成真实审稿人可接手的交接材料。它只说明当前缺什么、由谁补、审什么以及完成后如何继续，不代表真实审批、真实签署、正式 Patch 请求或正式库写入。

## 写入边界

- handoff_package_is_formal_approval: false
- failure_report_is_patch_request: false
- printable_handoff_is_signature: false
- formal_patch_created: false
- formal_domain_pack_written: false
- province_markdown_written: false

正式目标文件仍为 `data/domain-packs/china-culture.json`。除非真实审稿完成并由人工显式请求正式 Patch，否则不得应用差异草案，也不得写回 `data/provinces/*.md`。

## 阻断摘要

| 阻断组 | 数量 | 影响 | 当前人工动作 |
|---|---:|---|---|
| missing_attachments | 2 个证据包 / 12 个槽位引用 | 阻止审稿包提交或修复重提审 | 每包补齐 6 类真实附件，或逐项记录有权豁免 |
| missing_signatures | 4 | 阻止正式 Patch | 由匹配角色的真实审稿人通过或退回并留存签署记录 |
| missing_owners | 4 | 阻止真实签署 | 将 `[待指定]` 替换为真实个人或可追责审稿小组 |
| audit_lint_not_run | 2 | 等待正式 Patch | 正式 Patch 后分别运行 production audit 与 kb lint |

失败报告共 12 项：10 条来源失败记录，加 2 条 audit/lint 等待项。

## 人审交接包一

交接包：human-handoff-package-001

锁版来源：review-lock-package-001

证据包：evidence-freeze-package-001

候选：dp-craft-material-tool-process

可打印审稿单：printable-handoff-sheet-001

交接状态：ready_for_human_assignment_blocked_by_attachments_signatures_and_owners

### 必备附件

- [ ] source_bibliography_attachment
- [ ] fact_boundary_table_attachment
- [ ] authorization_or_consent_attachment
- [ ] sample_validation_attachment
- [ ] reviewer_identity_and_role_attachment
- [ ] final_decision_record_attachment

### 审稿角色与签署

| 分派 | 审稿角色 | 真实负责人 | 决定 | 签署记录引用 |
|---|---|---|---|---|
| dispatch-signature-001 | 事实/工艺流程审稿负责人 |  | 通过 / 退回 |  |
| dispatch-signature-002 | 材料工具与去重合并审稿负责人 |  | 通过 / 退回 |  |
| dispatch-signature-003 | 授权与证据附件负责人 |  | 通过 / 退回 |  |
| dispatch-signature-004 | 人工 Patch 复核负责人 |  | 通过 / 退回 |  |

### 当前失败记录

- missing-attachment-package-001
- missing-signature-001
- missing-signature-002
- missing-signature-003
- missing-signature-004
- missing-owner-001
- missing-owner-002
- missing-owner-003
- missing-owner-004

### Patch 决策区

审稿结论：____________________

决定理由：____________________

是否由有权人员显式提出正式 Patch 请求：是 / 否

提出人：____________________  日期：____________________

注意：填写本区仍需经过真实身份和签署记录校验；本空白审稿单本身不是正式 Patch 请求。

## 人审交接包二

交接包：human-handoff-package-002

锁版来源：review-lock-package-002

证据包：evidence-freeze-package-002

候选：dp-medical-heritage-privacy-boundary

可打印审稿单：printable-handoff-sheet-002

交接状态：ready_for_human_assignment_blocked_by_attachments_and_repair_signoff

### 必备附件

- [ ] source_bibliography_attachment
- [ ] fact_boundary_table_attachment
- [ ] authorization_or_consent_attachment
- [ ] sample_validation_attachment
- [ ] reviewer_identity_and_role_attachment
- [ ] final_decision_record_attachment

### 修复重提审检查

| 跟进项 | 审稿角色 | 真实负责人 | 结论 | 签署记录引用 |
|---|---|---|---|---|
| repair-evidence-followup-001 | 医疗伦理审稿负责人 |  | 允许重提 / 退回 |  |
| repair-evidence-followup-002 | 授权与证据附件负责人 |  | 允许重提 / 退回 |  |
| repair-evidence-followup-003 | 事实边界审稿负责人 |  | 允许重提 / 退回 |  |
| repair-evidence-followup-004 | 审稿签署管理员 |  | 允许重提 / 退回 |  |

重点复核：隐私边界、授权或同意、事实边界、真实审稿人身份。当前失败记录为 missing-attachment-package-002，修复签署尚未完成。

修复重提审结论：____________________

决定理由：____________________

审稿人或小组：____________________  日期：____________________

## audit/lint 后置清单

| 阻断项 | 命令 | 当前状态 | 是否已运行 |
|---|---|---|---|
| audit-lint-waiting-001 | `npm run kb:production-audit` | waiting_for_formal_patch | false |
| audit-lint-waiting-002 | `npm run kb:lint` | waiting_for_formal_patch | false |

这两个命令只在正式 Patch 完成后运行。本轮未创建正式 Patch，因此不能把等待清单记录成运行结果。

## 人工交接执行顺序

1. 为 4 个签署分派指定真实个人或可追责审稿小组。
2. 为两个证据包分别补齐 6 类附件或记录逐项豁免。
3. 对工艺候选完成事实、去重合并、授权和 Patch 复核，对民族医药候选完成 4 项修复复核。
4. 收集真实通过或退回决定及签署记录引用。
5. 只有人工显式提出正式 Patch 请求后才进入正式写入；写入后再运行 audit/lint。

## 本轮结论

两个人审交接包和两张可打印审稿单已经就绪，但负责人、附件、签署与后置检查仍处于阻断状态。交接材料让真实审稿可以开始，不改变正式库状态。
