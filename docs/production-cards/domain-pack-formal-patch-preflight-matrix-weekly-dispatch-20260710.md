# Domain Pack 正式 Patch 前预审矩阵与周节奏分派

日期：2026-07-10

状态：preflight_matrix_created_dispatch_only

本文件只用于正式 Patch 前预审和周节奏分派，不代表正式审批或签署。

- `preflight_matrix_is_formal_approval: false`
- `weekly_dispatch_is_signature: false`
- `formal_patch_created: false`
- `formal_domain_pack_written: false`
- `province_markdown_written: false`
- `diff_draft_applied: false`

## 正式 Patch 前预审矩阵

| check_id | 分派角色 | 周状态 | 到期风险 | 阻断 Patch |
|---|---|---|---|---|
| real-human-review-approved-in-actual-ledger | 事实/工艺流程审稿负责人 | not_started | high | true |
| evidence-attachment-files-committed | 授权与证据附件负责人 | not_started | high | true |
| duplicate-merge-reviewed-against-existing-formal-pack | 材料工具与去重合并审稿负责人 | not_started | medium | true |
| domain-pack-diff-reviewed-by-human | 人工 Patch 复核负责人 | not_started | medium | true |
| formal-patch-explicitly-requested-by-human | 人工 Patch 复核负责人 | not_started | high | true |
| kb-production-audit-required-after-patch | audit 运行负责人 | waiting_for_patch_request | low | true |
| kb-lint-required-after-patch | lint 运行负责人 | waiting_for_patch_request | low | true |
| province-markdown-writeback-still-forbidden | 知识库维护负责人 | guardrail_met | low | true |

## 签署占位分派

| assignment_id | signature_id | 源角色 | 分派角色 | 负责人 | 签署状态 |
|---|---|---|---|---|---|
| dispatch-signature-001 | signature-placeholder-001 | 工艺流程审稿 | 事实/工艺流程审稿负责人 | [待指定] | blank |
| dispatch-signature-002 | signature-placeholder-002 | 材料工具审稿 | 材料工具与去重合并审稿负责人 | [待指定] | blank |
| dispatch-signature-003 | signature-placeholder-003 | 授权审稿 | 授权与证据附件负责人 | [待指定] | blank |
| dispatch-signature-004 | signature-placeholder-004 | 人工 Patch 复核 | 人工 Patch 复核负责人 | [待指定] | blank |

## audit / lint 分派

| assignment_id | check_id | 分派角色 | 命令 | 状态 |
|---|---|---|---|---|
| dispatch-audit-001 | kb-production-audit-required-after-patch | audit 运行负责人 | npm run kb:production-audit | waiting_for_patch_request |
| dispatch-lint-001 | kb-lint-required-after-patch | lint 运行负责人 | npm run kb:lint | waiting_for_patch_request |

## 本周工作项

| dispatch_id | 工作流 | 角色 | 目标 | 状态 | 风险 |
|---|---|---|---|---|---|
| weekly-dispatch-001 | diff_draft_review | 事实/工艺流程审稿负责人 | 复核工艺材料工具流程候选包事实边界与工序口径 | not_started | high |
| weekly-dispatch-002 | merge_dedup_review | 材料工具与去重合并审稿负责人 | 判断与正式库非遗流程生产包合并、扩展或去重新增 | not_started | medium |
| weekly-dispatch-003 | evidence_and_authorization | 授权与证据附件负责人 | 补齐证据附件、授权附件和来源目录 | not_started | high |
| weekly-dispatch-004 | manual_patch_review | 人工 Patch 复核负责人 | 人工复核差异草案并确认是否显式请求正式 Patch | not_started | high |
| weekly-dispatch-005 | repair_resubmission | 医疗伦理审稿负责人 | 处理民族医药隐私边界补证任务 | not_started | high |
| weekly-dispatch-006 | post_patch_audit | audit 运行负责人 | 正式 Patch 后运行 production audit | waiting_for_patch_request | low |
| weekly-dispatch-007 | post_patch_lint | lint 运行负责人 | 正式 Patch 后运行 kb lint | waiting_for_patch_request | low |

## 修复补证任务风险

| repair_dispatch_id | 补证项 | 负责人角色 | 状态 | 风险 |
|---|---|---|---|---|
| repair-dispatch-001 | medical_privacy_boundary_rechecked | 医疗伦理审稿负责人 | not_started | high |
| repair-dispatch-002 | authorization_gap_closed_or_marked | 授权与证据附件负责人 | not_started | high |
| repair-dispatch-003 | fact_boundary_table_updated | 事实边界审稿负责人 | not_started | medium |
| repair-dispatch-004 | real_reviewer_identity_attached | 审稿签署管理员 | not_started | medium |

## 出口结论

- 预审矩阵不等于正式审批。
- 周节奏分派不等于签署。
- audit/lint 只在正式 Patch 后运行，本轮不运行正式写回后检查。
- 本轮不应用差异草案，不修改 `data/domain-packs/china-culture.json`。
- 本轮不写回 `data/provinces/*.md`。
