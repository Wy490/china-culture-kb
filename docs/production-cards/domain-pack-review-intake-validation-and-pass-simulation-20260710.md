# Domain Pack 人工填报校验与候选通过模拟

日期：2026-07-10

状态：validation_simulation_created_no_formal_patch

本文件只记录校验规则和模拟样例，不代表真实人工审稿已经发生。

- `simulated_results_are_real_review: false`
- `manual_patch_candidate_queue_is_formal_patch: false`
- `formal_patch_created: false`
- `formal_domain_pack_written: false`
- `province_markdown_written: false`

## 校验规则

| rule_id | 来源字段 | 阻断级别 | 用途 |
|---|---|---|---|
| candidate-id-must-match-known-candidate | candidate_id | blocking | 候选包 ID 必须匹配 9 个候选 Domain Pack |
| reviewer-name-required | reviewer_name | blocking | 必须填写真实审稿人或可追踪审稿组 |
| reviewer-role-required | reviewer_role | blocking | 审稿角色必须匹配候选包要求 |
| decision-must-be-allowed | decision | blocking | 决策只能在 3 个允许值内 |
| source-bibliography-required | source_bibliography_attachment | blocking | 必须提供来源目录附件 |
| fact-boundary-table-required | fact_boundary_table_attachment | blocking | 必须提供事实边界表 |
| authorization-consent-required | authorization_or_consent_attachment | blocking | 必须提供授权、同意或明确授权缺口 |
| sample-validation-required | sample_validation_attachment | blocking | 必须提供样本验证或明确不足 |
| final-decision-reason-required | final_decision_reason | blocking | 必须说明结论理由和后续动作 |
| manual-patch-state-required | manual_patch_request_state | blocking | 必须说明人工 Patch 请求状态 |
| real-reviewer-signature-required | reviewer_identity_and_role_attachment | blocking | 进入人工 Patch 候选前必须有真实签署 |
| validation-cannot-create-formal-patch | formal_patch_created | blocking | 校验通过不能创建正式 Patch |

## 真实台账当前校验结果

| 范围 | 数量 | 当前结论 |
|---|---:|---|
| 实际候选包校验 | 9 | 全部 blocked_blank_intake |
| 实际可进入人工 Patch 候选 | 0 | 真实台账仍无通过项 |
| 实际正式 Patch | 0 | 未创建 |
| 实际正式 Domain Pack 写入 | 0 | 未写入 |

## 模拟填报样例

| sample_id | candidate_id | 模拟决策 | 校验结果 | 能否进入人工 Patch 候选模拟队列 | 是否正式 Patch |
|---|---|---|---|---|---|
| sim-valid-approve-craft-001 | dp-craft-material-tool-process | approve_for_manual_patch_candidate | valid_for_manual_patch_candidate_queue_simulation | true | false |
| sim-valid-repair-medical-001 | dp-medical-heritage-privacy-boundary | repair_required | valid_for_repair_resubmission_simulation | false | false |
| sim-invalid-missing-evidence-sensitive-001 | dp-sensitive-history-evidence-expression | approve_for_manual_patch_candidate | invalid_missing_required_fields | false | false |
| sim-invalid-bad-decision-performance-001 | dp-performance-rights-and-stage-assets | direct_write_to_china_culture_json | invalid_decision_not_allowed | false | false |
| sim-invalid-patch-before-sign-ai-comic-001 | dp-ai-comic-continuity-shot-language | approve_for_manual_patch_candidate | invalid_missing_real_reviewer_signature | false | false |

## 人工 Patch 候选模拟队列

| queue_id | source_sample_id | candidate_id | 队列状态 | formal_patch_created |
|---|---|---|---|---|
| manual-patch-sim-candidate-001 | sim-valid-approve-craft-001 | dp-craft-material-tool-process | simulation_candidate_only_not_formal_patch | false |

进入正式 Patch 前仍必须完成：

- 真实台账中人工审稿通过。
- 证据附件文件真实提交。
- Domain Pack diff 单独准备并人工复核。
- 人工明确请求 formal patch。
- Patch 后重新跑 audit / lint。

## 修复重提审模拟队列

| queue_id | source_sample_id | candidate_id | 队列状态 | formal_patch_created |
|---|---|---|---|---|
| repair-resubmission-sim-001 | sim-valid-repair-medical-001 | dp-medical-heritage-privacy-boundary | simulation_repair_resubmission_only | false |

## 出口结论

- 合法模拟样例只能证明校验器能识别完整填报。
- 非法模拟样例用于证明缺附件、错误决策、未签署时会被阻断。
- 人工 Patch 候选模拟队列不是正式 Patch。
- 本轮没有写入 `data/domain-packs/china-culture.json`。
- 本轮没有写回 `data/provinces/*.md`。
