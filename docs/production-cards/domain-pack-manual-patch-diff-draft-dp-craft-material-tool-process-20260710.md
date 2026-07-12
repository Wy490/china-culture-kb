# Domain Pack 人工 Patch 差异草案：工艺材料工具流程候选包

日期：2026-07-10

状态：diff_draft_template_only_not_applied

本文件是人工复核用草案，不是正式 Patch。

- `candidate_id: dp-craft-material-tool-process`
- `source_queue_id: manual-patch-sim-candidate-001`
- `target_file: data/domain-packs/china-culture.json`
- `formal_patch_created: false`
- `formal_domain_pack_written: false`
- `province_markdown_written: false`
- `diff_draft_applied: false`

## 合并判断

正式库已有相近条目：`非遗流程生产包——材料工具、工序动作与授权边界`。

建议动作：先由人工审稿判断是合并增强现有条目，还是去重后新增独立工艺包。不得直接追加重复正式条目。

## 候选字段草案

```json
{
  "entry_name": "工艺材料工具流程候选包",
  "domain": "narrative_pattern",
  "role": "pattern_pack_candidate",
  "type": "Domain Pack Candidate",
  "region": "通用",
  "summary": "用于侗锦、岳州扇、长沙窑等工艺类素材：按材料、工具、手部动作、工序顺序、声音质感、实物/复原件边界和危险细节禁用项拆分。",
  "keywords": ["工艺", "材料", "工具", "手部动作", "工序", "文物", "复原件"],
  "asset_usage": ["plot_structure", "scene_props", "visual_style", "source_grounding", "credibility_boundary"],
  "production_prompts": [
    "先拆材料、工具、工序、手部动作、声音质感和成品使用场景。",
    "把文物、现代复原件、博物馆展品和示范道具分开。",
    "每个工序必须有来源或待核说明，不凭空补完。",
    "危险、秘传或未授权细节只写边界，不写教程。"
  ],
  "review_boundaries": [
    "不得把现代复原件写成古代原物。",
    "不得公开未授权或危险操作教程。",
    "不得把纹样含义、釉色技术或器物用途写成无来源定论。",
    "不得把单个匠人的示范写成全部工艺标准。"
  ],
  "trigger_words": ["侗锦", "岳州扇", "长沙窑", "铜官陶瓷", "工序", "材料", "工具", "复原件"]
}
```

## 人工签署占位

| signature_id | 角色 | 必要条件 | 状态 |
|---|---|---|---|
| signature-placeholder-001 | 工艺流程审稿 | real_human_review_approved_in_actual_ledger | blank |
| signature-placeholder-002 | 材料工具审稿 | candidate_field_merge_review | blank |
| signature-placeholder-003 | 授权审稿 | evidence_attachment_files_committed | blank |
| signature-placeholder-004 | 人工 Patch 复核 | formal_patch_explicitly_requested_by_human | blank |

## 正式 Patch 前检查

| check_id | 当前状态 | 阻断 |
|---|---|---|
| real-human-review-approved-in-actual-ledger | not_met | true |
| evidence-attachment-files-committed | not_met | true |
| duplicate-merge-reviewed-against-existing-formal-pack | not_met | true |
| domain-pack-diff-reviewed-by-human | not_met | true |
| formal-patch-explicitly-requested-by-human | not_met | true |
| kb-production-audit-required-after-patch | not_run | true |
| kb-lint-required-after-patch | not_run | true |
| province-markdown-writeback-still-forbidden | met | true |

## 出口结论

- 本草案不修改 `data/domain-packs/china-culture.json`。
- 本草案不写回 `data/provinces/*.md`。
- 人工签署、证据附件、去重合并判断和正式 Patch 请求未齐前，不得应用。
