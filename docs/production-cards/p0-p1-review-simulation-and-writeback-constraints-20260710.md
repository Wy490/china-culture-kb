# P0/P1 审稿结果模拟与写回约束

状态：simulation_only_pending_real_human_review

本文件对应 `data/production-cards/p0-p1-review-simulation-and-writeback-constraints.json`，用于 Iteration 12 的流程演练。它不是人工审稿结果，不代表任何条目已经通过真实审稿，也不修改 `data/provinces/*.md`。

## 本轮新增

- 为 16 个 P0/P1 审稿导出文件建立 `pass` / `repair` / `reject` 模拟结果。
- 为三类结果建立写回字段约束：通过候选、需修复、驳回阻断。
- 补充 4 条 P1 质量规则：革命历史来源边界、民族社区授权边界、非遗表演权利边界、纪录片现场档案边界。
- 建立 8 条 P1 质量规则样例期望。
- 为 4 个人工审稿批次建立机器门槛：决策完整、通过项仍需真实人工审稿、修复项有下一步、驳回项有阻断原因、禁止直接写回。

## 模拟结果口径

- `pass`：只表示结构上可以准备候选写回草案，仍需真实人工审稿、来源补证、授权确认和人工 Patch。
- `repair`：必须先完成来源、授权、事实边界或表达边界修复，修复前不得进入写回草案。
- `reject`：当前候选不进入写回草案，只保留驳回原因和重新取材建议。

## 写回约束

- 所有模拟结果的 `writeback_allowed_now` 都是 `false`。
- `pass` 结果仍不能直接写回，只能在真实人工审稿通过后进入候选草案。
- `repair` 和 `reject` 结果的 `allowed_field_groups_after_real_approval` 为空。
- 所有结果禁止写入生成故事、分镜、对白、GEARS 分段、Seedance 提示词、虚构剧情、医疗指导和敏感历史再现。

## 仍未计入完成

- 这不是人工审稿结论。
- 16 个导出 Markdown 仍为 `template_pending_human_review`。
- 9 个 Phase 2 候选 Domain Pack 尚未正式晋升。
- 尚未写回 `data/provinces/*.md`。
