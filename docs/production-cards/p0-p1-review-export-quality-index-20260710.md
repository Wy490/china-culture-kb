# P0/P1 审稿导出质量索引

状态：quality_index_pending_human_review

本文件对应 `data/production-cards/p0-p1-review-export-quality-index.json`，用于 Iteration 11 的人工审稿准备。它不代表正式写回，不修改 `data/provinces/*.md`。

## 本轮新增

- 为 16 个审稿导出 Markdown 建立统一核对清单。
- 将 P0 自动质量规则从 2 条基础规则扩展为 4 条细分规则。
- 为 P0 规则补充 14 条修复建议。
- 建立 4 个人工审稿批次：P0 敏感边界、P1 AI 漫剧历史/社区、P1 非遗授权/流程、P1 纪录片现场/档案。

## 审稿硬门槛

- 来源目录或待补证来源线索必须存在。
- 事实边界必须区分已核事实、待核事项、可影视化表达和禁止断言。
- 授权或同意必须覆盖场地、人物肖像、声音、曲词曲谱、社区、机构或档案复制件。
- 写回范围只能包含可复用字段，不能包含生成故事、分镜、对白、视频提示词或虚构剧情。
- P0 条目必须额外通过创伤历史、医疗伦理和隐私专项检查。

## 批次顺序

1. `batch-p0-sensitive-boundaries`：4 个 P0 条目，先审创伤历史、医疗伦理和患者隐私。
2. `batch-p1-ai-comic-history-and-community`：5 个 P1 AI 漫剧条目，审史实/虚构分层和社区边界。
3. `batch-p1-heritage-consent-and-process`：3 个 P1 非遗宣传条目，审流程、授权和公开展演边界。
4. `batch-p1-documentary-sites-and-archives`：4 个 P1 微纪录条目，审现实现场、档案复制件和采访授权。

## 仍未计入完成

- 16 个 Markdown 仍为 `template_pending_human_review`。
- 4 个批次仍为 `pending_human_review`。
- 9 个 Phase 2 候选 Domain Pack 尚未人工审稿和正式晋升。
- 未写入 `data/provinces/*.md`。
