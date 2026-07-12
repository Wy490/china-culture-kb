# Domain Pack 人工审稿模板与正式 Patch 隔离

状态：review_templates_created_patch_isolated

本文件对应 `data/production-cards/domain-pack-human-review-and-patch-isolation.json`，用于 Iteration 14。它只建立人工审稿模板、pass 草案准备模板和 repair/reject 状态跟踪，不创建正式 Patch，不写入 `data/domain-packs/china-culture.json`，也不写入 `data/provinces/*.md`。

## 本轮新增

- 9 个候选 Domain Pack 独立人工审稿模板。
- 9 份 Markdown 审稿模板。
- 2 个 pass 候选草案准备模板。
- 14 条 repair/reject 任务状态。
- 6 条正式 Patch 隔离规则。

## 隔离规则

- 审稿模板不是人工审稿通过。
- pass 候选只是草案准备，不生成正式 Patch。
- repair 任务修复前保持 open。
- reject 任务必须重新取材或移除。
- 真实人工审稿通过后仍需人工 Patch 审核。
- 当前没有任何正式 Domain Pack 或省份 Markdown 写回。
