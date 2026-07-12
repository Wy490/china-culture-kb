# Domain Pack 审稿决策人工填报入口

日期：2026-07-10

状态：intake_template_only

本表只用于人工审稿填报和机器校验，不代表任何候选 Domain Pack 已经通过审稿，也不创建正式 Patch。

- `formal_patch_created: false`
- `formal_domain_pack_written: false`
- `province_markdown_written: false`
- `direct_write_to_china_culture_json: false`
- `intake_form_is_formal_approval: false`

## 填报规则

- 候选包必须保留 `candidate_id`，不得改名后直接晋升。
- 审稿人姓名、审稿角色、来源目录附件、事实边界表、授权或同意附件、样本验证附件、最终决策理由和人工 Patch 请求状态均为必填。
- 决策只允许填写 `approve_for_manual_patch_candidate`、`repair_required`、`reject_or_rebuild`。
- `approve_for_manual_patch_candidate` 只表示可进入人工 Patch 候选，不表示已经写入正式 `data/domain-packs/china-culture.json`。
- `repair_required` 必须关联 repair 任务和证据附件。
- `reject_or_rebuild` 必须重新取材或移除候选，不得复用原候选直接晋升。

## 9 个候选包决策填报表

| candidate_id | 当前填报状态 | 审稿人姓名 | 审稿角色 | 决策 | 来源目录附件 | 事实边界表附件 | 授权或同意附件 | 样本验证附件 | 最终决策理由 | 人工 Patch 请求状态 |
|---|---|---|---|---|---|---|---|---|---|---|
| dp-sensitive-history-evidence-expression | not_started | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | not_requested |
| dp-medical-heritage-privacy-boundary | not_started | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | not_requested |
| dp-revolutionary-history-event-reconstruction | not_started | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | not_requested |
| dp-heritage-process-consent | not_started | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | not_requested |
| dp-ethnic-ritual-community-boundary | not_started | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | not_requested |
| dp-performance-rights-and-stage-assets | not_started | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | not_requested |
| dp-documentary-site-source-boundary | not_started | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | not_requested |
| dp-ai-comic-continuity-shot-language | not_started | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | not_requested |
| dp-craft-material-tool-process | not_started | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | [待填] | not_requested |

## repair / reject 任务更新表

| task_id | 类型 | 当前状态 | 负责人角色 | 需要填写 |
|---|---|---|---|---|
| repair-task-001 | repair | waiting_for_evidence_entry | 医疗伦理审稿 | 证据附件、修复说明、是否重提审 |
| repair-task-002 | repair | waiting_for_evidence_entry | 纪录片事实审稿 | 证据附件、修复说明、是否重提审 |
| repair-task-003 | repair | waiting_for_evidence_entry | 医疗伦理审稿 | 证据附件、修复说明、是否重提审 |
| repair-task-004 | repair | waiting_for_evidence_entry | 革命历史事实审稿 | 证据附件、修复说明、是否重提审 |
| repair-task-005 | repair | waiting_for_evidence_entry | 民族文化审稿 | 证据附件、修复说明、是否重提审 |
| repair-task-006 | repair | waiting_for_evidence_entry | 社区授权审稿 | 证据附件、修复说明、是否重提审 |
| repair-task-007 | repair | waiting_for_evidence_entry | 社区授权审稿 | 证据附件、修复说明、是否重提审 |
| repair-task-008 | repair | waiting_for_evidence_entry | 版权授权审稿 | 证据附件、修复说明、是否重提审 |
| repair-task-009 | repair | waiting_for_evidence_entry | 革命历史事实审稿 | 证据附件、修复说明、是否重提审 |
| repair-task-010 | repair | waiting_for_evidence_entry | 现场授权审稿 | 证据附件、修复说明、是否重提审 |
| repair-task-011 | repair | waiting_for_evidence_entry | 纪录片事实审稿 | 证据附件、修复说明、是否重提审 |
| reject-task-001 | reject | waiting_for_new_source_package_entry | 敏感历史伦理审稿 | 新来源包、移除候选或重启审稿说明 |
| reject-task-002 | reject | waiting_for_new_source_package_entry | 革命历史事实审稿 | 新来源包、移除候选或重启审稿说明 |
| reject-task-003 | reject | waiting_for_new_source_package_entry | 版权授权审稿 | 新来源包、移除候选或重启审稿说明 |

## pass 草案阻断表

| prepare_template_id | source_task_id | card_id | 当前状态 | 写回允许 | formal_patch_created | 阻断门槛 |
|---|---|---|---|---|---|---|
| pass-draft-prepare-001 | pass-candidate-001 | ai-comic-golden-tongdao-dong-brocade-sun-pattern | blocked_until_required_fields_complete | false | false | real_human_review_approved, source_or_authorization_evidence_attached, domain_pack_decision_ledger_recorded, manual_patch_reviewed, formal_patch_explicitly_requested_by_human |
| pass-draft-prepare-002 | pass-candidate-002 | heritage-promo-golden-sangzhi-baizu-zhanggu-process | blocked_until_required_fields_complete | false | false | real_human_review_approved, source_or_authorization_evidence_attached, domain_pack_decision_ledger_recorded, manual_patch_reviewed, formal_patch_explicitly_requested_by_human |

## 机器校验出口

- 9 条候选包填报状态均为 `not_started` 时，不允许晋升。
- 14 条 repair / reject 任务仍 open 时，不允许生成正式写回草案。
- 2 个 pass 草案准备项在阻断门槛未清除前，不允许写入正式库。
- 本入口只能更新人工填报台账；正式写回仍需要单独人工 Patch。
