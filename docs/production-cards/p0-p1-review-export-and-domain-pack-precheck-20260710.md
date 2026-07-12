# P0/P1 审稿结果导出包与 Domain Pack 晋升预检

状态：precheck_only_pending_real_human_review

本文件对应 `data/production-cards/p0-p1-review-export-and-domain-pack-precheck.json`，用于 Iteration 13 的导出包和晋升预检。它不是正式审稿结果，不写入 `data/provinces/*.md`，也不写入正式 `data/domain-packs/china-culture.json`。

## 本轮新增

- 生成 16 个 P0/P1 审稿模拟结果的导出包总览。
- 拆出 2 个 pass 候选、11 个 repair 任务和 3 个 reject 重取材任务。
- 将 P0/P1 质量规则映射到 9 个 Phase 2 候选 Domain Pack。
- 为 9 个候选 Domain Pack 建立晋升前检查清单。
- 机器门槛明确：9 个候选包全部 blocked，不能正式晋升。

## 晋升口径

候选 Domain Pack 要进入正式 `china-culture.json`，至少需要：

- 真实人工领域审稿完成。
- 关联 repair 任务全部修复。
- 关联 reject 项重新取材或移除。
- 至少 3 个条目或项目使用验证。
- 回归样本或项目验证已附上。
- 正式 Domain Pack 人工 Patch 已审。
- 保持不直接写入正式文件。

## 当前结论

- 0 个候选包可立即晋升。
- 9 个候选包全部 blocked。
- 当前只生成预检和任务队列，不生成正式写回草案。
