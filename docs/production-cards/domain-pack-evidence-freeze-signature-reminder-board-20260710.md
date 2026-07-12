# Domain Pack 证据附件包清单冻结与签署催办看板

日期：2026-07-10

状态：evidence_package_frozen_reminder_board_created

本文件只冻结必备附件槽位并建立签署催办，不代表附件已经提交或签署已经完成。

- `evidence_freeze_is_attachment_submission: false`
- `reminder_board_is_signature: false`
- `audit_lint_runbook_is_run_result: false`
- `formal_patch_created: false`
- `formal_domain_pack_written: false`
- `province_markdown_written: false`

## 冻结附件槽位

| slot_id | 标签 | 冻结状态 |
|---|---|---|
| source_bibliography_attachment | 来源目录附件 | frozen_required |
| fact_boundary_table_attachment | 事实边界表附件 | frozen_required |
| authorization_or_consent_attachment | 授权或同意附件 | frozen_required |
| sample_validation_attachment | 样本验证附件 | frozen_required |
| reviewer_identity_and_role_attachment | 审稿人身份与角色附件 | frozen_required |
| final_decision_record_attachment | 最终决策记录附件 | frozen_required |

## 附件包清单

| package_id | candidate_id | 用途 | 状态 | 文件已提交 | 是否正式 Patch |
|---|---|---|---|---|---|
| evidence-freeze-package-001 | dp-craft-material-tool-process | manual_patch_candidate_diff_draft_review | frozen_required_slots_pending_files | false | false |
| evidence-freeze-package-002 | dp-medical-heritage-privacy-boundary | repair_resubmission_evidence_followup | frozen_required_slots_pending_files | false | false |

## 签署催办看板

| reminder_id | assignment_id | 角色 | 真实负责人 | 催办状态 | 签署状态 |
|---|---|---|---|---|---|
| signature-reminder-001 | dispatch-signature-001 | 事实/工艺流程审稿负责人 | [待指定] | open_owner_needed | blank |
| signature-reminder-002 | dispatch-signature-002 | 材料工具与去重合并审稿负责人 | [待指定] | open_owner_needed | blank |
| signature-reminder-003 | dispatch-signature-003 | 授权与证据附件负责人 | [待指定] | open_owner_needed | blank |
| signature-reminder-004 | dispatch-signature-004 | 人工 Patch 复核负责人 | [待指定] | open_owner_needed | blank |

## 正式 Patch 后 audit / lint 运行清单

| runbook_id | check_id | 命令 | 运行时机 | 状态 |
|---|---|---|---|---|
| post-patch-runbook-001 | kb-production-audit-required-after-patch | npm run kb:production-audit | after_formal_patch_only | waiting_for_formal_patch |
| post-patch-runbook-002 | kb-lint-required-after-patch | npm run kb:lint | after_formal_patch_only | waiting_for_formal_patch |

## repair 补证催办

| followup_id | candidate_id | 补证项 | 角色 | 状态 |
|---|---|---|---|---|
| repair-evidence-followup-001 | dp-medical-heritage-privacy-boundary | medical_privacy_boundary_rechecked | 医疗伦理审稿负责人 | open_pending_attachment |
| repair-evidence-followup-002 | dp-medical-heritage-privacy-boundary | authorization_gap_closed_or_marked | 授权与证据附件负责人 | open_pending_attachment |
| repair-evidence-followup-003 | dp-medical-heritage-privacy-boundary | fact_boundary_table_updated | 事实边界审稿负责人 | open_pending_attachment |
| repair-evidence-followup-004 | dp-medical-heritage-privacy-boundary | real_reviewer_identity_attached | 审稿签署管理员 | open_pending_attachment |

## 出口结论

- 附件槽位已冻结，但附件文件尚未提交。
- 签署催办看板不是签署记录。
- audit/lint 运行清单不是运行结果。
- 本轮不应用差异草案，不创建正式 Patch。
- 本轮不修改 `data/domain-packs/china-culture.json`。
- 本轮不写回 `data/provinces/*.md`。
