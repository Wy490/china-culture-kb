# Domain Pack 签署反馈样例校验与审稿包锁版

状态：signature_feedback_samples_created_review_packages_locked

更新时间：2026-07-10

本文件用于 Iteration 21 的签署反馈样例校验和审稿包锁版交接。它只说明“应该如何校验”和“当前为什么仍然阻断”，不代表真实签署、附件提交、正式审批、正式 Patch 或正式库写入。

## 边界声明

- `signature_feedback_samples_are_real_signatures: false`
- `review_package_lock_is_approval: false`
- `locked_package_is_attachment_submission: false`
- `formal_patch_created: false`
- `formal_domain_pack_written: false`
- `province_markdown_written: false`

## 来源文件

| 类型 | 文件 |
|---|---|
| 证据附件冻结与签署催办 | `data/production-cards/domain-pack-evidence-freeze-and-signature-reminder-board.json` |
| 正式 Patch 前预审矩阵 | `data/production-cards/domain-pack-formal-patch-preflight-matrix-and-weekly-dispatch.json` |
| 正式 Domain Pack | `data/domain-packs/china-culture.json` |

## 签署反馈校验规则

| 规则 ID | 作用 | 阻断正式 Patch |
|---|---|---|
| owner-must-be-real-person-or-group | 签署反馈必须提供真实负责人或可追责小组，不能继续保留 `[待指定]` | true |
| signature-role-must-match-assignment | 签署角色必须匹配第 20 轮催办看板里的 assignment / signature / role | true |
| signature-state-must-be-signed-or-rejected | 真实流程中不能以 blank / pending 冒充签署完成 | true |
| attachment-package-must-have-files | 审稿包必须有实际附件文件，本轮锁版仍保持未提交 | true |
| all-frozen-slots-must-be-addressed | 6 类冻结附件槽位必须全部提交或明确豁免 | true |
| signed-feedback-cannot-create-formal-patch | 签署反馈不能直接创建正式 Patch，必须另有人工显式请求 | true |
| audit-lint-runbook-waits-for-formal-patch | audit/lint 清单仍等待正式 Patch 后执行 | true |
| no-province-writeback | 签署反馈、锁版包、失败原因索引均不得写入省份 Markdown | true |

## 签署反馈模拟样例

| 样例 ID | 分派 | 角色 | 校验状态 | 失败规则 | 结果边界 |
|---|---|---|---|---|---|
| sig-feedback-valid-owner-assignment-001 | dispatch-signature-001 | 事实/工艺流程审稿负责人 | valid_as_owner_assignment_sample_not_signature | 无 | 可作为负责人填报格式样例，但不是签署 |
| sig-feedback-valid-reject-patch-review-001 | dispatch-signature-004 | 人工 Patch 复核负责人 | valid_as_rejection_sample_requires_rework | 无 | 可作为退回复工格式样例，但不是签署 |
| sig-feedback-invalid-missing-owner-001 | dispatch-signature-002 | 材料工具与去重合并审稿负责人 | invalid_missing_real_owner | owner-must-be-real-person-or-group | 负责人缺失，不能签署 |
| sig-feedback-invalid-missing-attachments-001 | dispatch-signature-003 | 授权与证据附件负责人 | invalid_missing_attachment_files | attachment-package-must-have-files; all-frozen-slots-must-be-addressed | 附件缺失，不能提交审稿包 |
| sig-feedback-invalid-pretend-formal-patch-001 | dispatch-signature-004 | 人工 Patch 复核负责人 | invalid_signed_feedback_claims_formal_patch | signed-feedback-cannot-create-formal-patch | 签署反馈不能创建正式 Patch |

## 审稿包锁版清单

| 锁版 ID | 证据包 | 候选 | 状态 | 冻结槽位数 | 附件提交 | 签署完成 | 锁版是否审批 |
|---|---|---|---|---:|---|---|---|
| review-lock-package-001 | evidence-freeze-package-001 | dp-craft-material-tool-process | locked_missing_attachments_and_signatures | 6 | false | false | false |
| review-lock-package-002 | evidence-freeze-package-002 | dp-medical-heritage-privacy-boundary | locked_missing_attachments_and_repair_signoff | 6 | false | false | false |

冻结槽位：

- source_bibliography_attachment
- fact_boundary_table_attachment
- authorization_or_consent_attachment
- sample_validation_attachment
- reviewer_identity_and_role_attachment
- final_decision_record_attachment

## 失败原因索引

### 附件缺失

| 失败 ID | 证据包 | 候选 | 缺失槽位数 | 阻断 |
|---|---|---|---:|---|
| missing-attachment-package-001 | evidence-freeze-package-001 | dp-craft-material-tool-process | 6 | blocks_review_package_submission |
| missing-attachment-package-002 | evidence-freeze-package-002 | dp-medical-heritage-privacy-boundary | 6 | blocks_repair_resubmission |

### 签署缺失

| 失败 ID | 催办项 | 分派 | 签署占位 | 角色 | 状态 |
|---|---|---|---|---|---|
| missing-signature-001 | signature-reminder-001 | dispatch-signature-001 | signature-placeholder-001 | 事实/工艺流程审稿负责人 | blank |
| missing-signature-002 | signature-reminder-002 | dispatch-signature-002 | signature-placeholder-002 | 材料工具与去重合并审稿负责人 | blank |
| missing-signature-003 | signature-reminder-003 | dispatch-signature-003 | signature-placeholder-003 | 授权与证据附件负责人 | blank |
| missing-signature-004 | signature-reminder-004 | dispatch-signature-004 | signature-placeholder-004 | 人工 Patch 复核负责人 | blank |

### 负责人缺失

| 失败 ID | 催办项 | 分派 | 角色 | 负责人 |
|---|---|---|---|---|
| missing-owner-001 | signature-reminder-001 | dispatch-signature-001 | 事实/工艺流程审稿负责人 | `[待指定]` |
| missing-owner-002 | signature-reminder-002 | dispatch-signature-002 | 材料工具与去重合并审稿负责人 | `[待指定]` |
| missing-owner-003 | signature-reminder-003 | dispatch-signature-003 | 授权与证据附件负责人 | `[待指定]` |
| missing-owner-004 | signature-reminder-004 | dispatch-signature-004 | 人工 Patch 复核负责人 | `[待指定]` |

## Audit / Lint 锁定状态

| 锁定 ID | 来源运行清单 | 检查 | 命令 | 状态 | 已运行 |
|---|---|---|---|---|---|
| audit-lint-lock-001 | post-patch-runbook-001 | kb-production-audit-required-after-patch | `npm run kb:production-audit` | locked_waiting_for_formal_patch | false |
| audit-lint-lock-002 | post-patch-runbook-002 | kb-lint-required-after-patch | `npm run kb:lint` | locked_waiting_for_formal_patch | false |

## 下一步人工交接

- 先为 4 个签署催办项指定真实负责人。
- 为 2 个证据附件包补齐 6 类冻结槽位的真实附件或明确豁免。
- 真实签署完成后仍不能自动 Patch，必须由人工 Patch 复核负责人显式发起正式 Patch 请求。
- 正式 Patch 之后再运行 audit / lint，并把运行结果另行入账。
