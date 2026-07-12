# Domain Pack 修复重提审补证任务：民族医药文化记录与隐私边界候选包

日期：2026-07-10

状态：evidence_task_template_created_not_resubmitted

本文件把修复重提审模拟项转为可跟踪的补证任务模板，不代表已经重提审。

- `candidate_id: dp-medical-heritage-privacy-boundary`
- `source_queue_id: repair-resubmission-sim-001`
- `source_sample_id: sim-valid-repair-medical-001`
- `repair_resubmitted: false`
- `formal_patch_created: false`
- `formal_domain_pack_written: false`
- `province_markdown_written: false`

## 必补证据

| evidence_update_id | 内容 | 状态 |
|---|---|---|
| medical_privacy_boundary_rechecked | 复核医疗伦理、患者隐私、诊疗空间和非医疗建议边界 | pending |
| authorization_gap_closed_or_marked | 补齐授权，或明确仍未获得授权的缺口 | pending |
| fact_boundary_table_updated | 更新事实边界表，区分文化记录、禁用医疗指导和待核点 | pending |
| real_reviewer_identity_attached | 补真实审稿人身份、角色和签署记录 | pending |

## 重提审前阻断

- 未补齐医疗隐私边界，不得重提审。
- 未补齐授权或明确缺口，不得进入人工 Patch 候选。
- 未补真实审稿人签署，不得视为真实审稿通过。
- 本任务模板不能写入正式 Domain Pack。

## 出口结论

该任务只把 repair 模拟项转为可跟踪补证模板。真实补证和人工签署完成前，仍保持 blocked。
