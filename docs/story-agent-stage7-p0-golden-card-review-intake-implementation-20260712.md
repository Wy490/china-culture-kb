# Story Agent Stage 7 P0 黄金卡真人审稿接入准备（2026-07-12）

## 结论

在 Stage 6 真实两轮修订仍被外部输入阻塞的前提下，仓库新增 `/story/stage7-golden-card-review`，提前建立黄金素材卡真人审稿接入合同。该能力只做准备和签署前预检，不表示 Stage 6 已退出，也不授予黄金卡人工通过、晋升或专业进度。

当前机器基线：

```text
目标黄金卡：75
索引候选：30
候选片型覆盖：3 / 15
缺失片型：12
按每片型5张计算的缺口：60
pending_human_review：30
approval_preflight_ready：0
human_approved：0
promoted：0
professional_passed：0
```

现有候选只覆盖 `ai_comic_drama`、`heritage_promo` 和 `documentary_short`，各10张；其他12个片型没有候选卡。

## 接入合同

- Schema：`story-agent-stage7-golden-card-review-intake/v1`。
- 每条审稿输入绑定统一索引 card ID、片型、源卡文件路径、源文件 SHA-256 和 canonical card payload SHA-256。
- `p0` 风险要求事实、伦理、片型导演三角色；`p1` 要求事实、地方文化、片型导演；`p2` 要求来源、授权、片型导演。
- 每位 reviewer 必须提供外部实名身份、组织、授权引用、审稿时间、证据引用、决定和审稿意见。
- approval preflight 要求每个风险角色恰好一份审核且一致批准。
- 输入中的 `human_approved`、`golden_card_promoted` 和 `professional_passed` 必须固定为 false；自报 true 会被 schema 和信用门禁同时拒绝。

## 只读边界

- `GET /api/stage7-golden-cards/review-intake`：返回30张逐卡状态、15片型缺口、动态绑定模板和模板检查结果。
- `POST /api/stage7-golden-cards/review-intake/validate`：只在内存验证外部 JSON。
- `/approve`、`/persist`、`/promote` 和 `/writeback` 均不存在。
- 服务固定报告 review record 未落盘、源卡未修改、`data/provinces/*.md` 未修改、人工批准未授予、黄金卡未晋升、专业通过为 false。

Operator 模板位于 `data/professional-benchmarks/all-format-stage7-golden-card-review-operator-template.json`；机器 readiness 位于 `data/reports/story-agent-stage7-golden-card-review-readiness.json`。合同测试将两者与当前统一索引、源文件和动态 workspace 对齐，源卡变化会使哈希绑定测试失败。

## 验证

- Stage 7 重点测试：1个文件、5个用例通过。
- 覆盖30张/3片型基线、完整三角色 approval preflight、卡片 SHA-256 篡改、自报批准/晋升/专业通过、禁止写入端点。
- Server TypeScript、Client TypeScript 与 production build 通过。
- Playwright Chromium 实际点击“检查审稿材料”：Schema 合法、角色0/3、证据0、结果 BLOCKED、人工通过0，六类写入和信用标志全部为否。
- 截图：`output/playwright/stage7-golden-card-review-intake.png`。

浏览器控制台只有既有 `favicon.ico` 404，与审稿接入 API 无关。

## 信用边界

本轮专业文本创作进度保持 47.5%。30张候选、3/15片型覆盖、模板、readiness、完整三角色测试、approval preflight 和浏览器截图均不计人工通过、黄金卡晋升、Stage 7 实际启动、真实修订、真人盲评或专业通过。
