# Story Agent Stage 7 P3 黄金卡与 Domain Pack 总控（2026-07-12）

## 结论

仓库新增 `/story/stage7-operations`，把黄金卡候选覆盖、真人审稿、Ed25519签名、Domain Pack真人审稿和正式晋升汇总成五条只读lane，并生成51项确定外部NEXT。总控不写文件、不执行任务、不批准或晋升任何材料。

当前总览：

```text
黄金卡候选：30 / 75
片型覆盖：3 / 15
缺失片型槽位：60
黄金卡人工通过：0
Domain Pack候选：9 / 9
Domain Pack证据完整：0
Domain Pack真人批准：0
Domain Pack真实签名：0
Formal patch：0
晋升：0
外部NEXT：51
专业通过：0
```

## 五条lane

1. `candidate_coverage`：3/15，12个片型缺候选内容与来源证据。
2. `golden_review`：0/75，现有30张卡待风险角色真人审稿，另缺45张候选。
3. `golden_signature`：0/75，仓库trust policy尚无trusted signer。
4. `domain_pack_review`：0/9，9个候选包缺真实证据槽位、实名decision和签名。
5. `domain_pack_promotion`：0/9，真实审稿与签名未通过，不能生成formal patch或晋升。

所有lane均为 `blocked_external_input`。

## 51项唯一NEXT

- 12项 `video_type`：为每个缺失片型完成5张候选内容、事实边界、来源和授权证据。
- 30项 `golden_card`：按p0/p1/p2风险级别完成三角色实名审稿。
- 9项 `domain_pack`：完成真实证据槽位、真人审稿decision和签名。

每项task固定 `evidence_status=missing_external_input`、`counts_as_completion=false`。Task ID全局唯一，不把交接动作写成完成状态。

## 复用的 Domain Pack 合同

总控读取既有：

- `data/domain-packs/phase2-candidate-rule-packs.json`；
- `data/production-cards/domain-pack-review-evidence-ledger.json`；
- `data/production-cards/domain-pack-real-reviewer-submission-validation-fixtures-and-pre-signature-preflight.json`。

现有14个submission validation fixture、签名反馈simulation和其他模板只证明合同，不计真实reviewer submission、真实签名、证据完整或批准。任何一个外部信用计数从0变化都会使当前总控基线fail closed并要求人工复核。

## Handoff边界

`story-agent-stage7-material-external-handoff/v1` 包含六份源文件SHA-256和51项task，但固定：

- `memory_only=true`；
- `persisted=false`；
- `execution_started=false`；
- `human_approval_granted=false`；
- 两类promotion和professional pass均为false。

API只提供 `GET /api/stage7-golden-cards/operations`。`/export`、`/persist`、`/execute`、`/approve`、`/promote`、`/writeback` 均不存在。

## 验证

- P16重点测试：1个文件、4个用例通过。
- 覆盖精确汇总、51项task身份、simulation排除、六份源哈希、无生成目录和禁止变更端点。
- Server TypeScript、Client TypeScript与production build通过。
- Playwright Chromium实测五lane、51项NEXT和内存handoff；人工批准、两类晋升、执行和专业通过全部为否。
- 截图：`output/playwright/stage7-material-operations.png`。

浏览器控制台只有既有 `favicon.ico` 404，与总控API无关。

## 信用边界

专业文本创作进度保持47.5%。五lane、51项NEXT、候选9/9、六份源哈希、simulation fixture和内存handoff均不计真实外部完成、黄金卡人工通过、Domain Pack晋升、Stage 7退出或专业通过。
