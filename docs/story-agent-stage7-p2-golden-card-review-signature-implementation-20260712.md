# Story Agent Stage 7 P2 黄金卡真人审稿签名验证（2026-07-12）

## 结论

仓库新增 `/story/stage7-golden-card-signature`，用于验证黄金卡三角色审稿材料的外部 Ed25519 签名。验证链重用 P13 审稿预检，独立绑定卡片、审稿 payload 和仓库侧 trust policy；系统不生成签名、不批准、不晋升、不落盘。

当前状态：

```text
候选卡：30
Trust policy：preparation_template
Trusted signers：0
Review approval preflight：0
Verified signatures：0
Signed review persisted：否
Human approved：0
Golden card promoted：0
Professional passed：0
```

## 签名合同

`story-agent-stage7-golden-card-review-signature-attestation/v1` 绑定：

1. card ID 与 video type；
2. 当前源卡文件 SHA-256；
3. 当前 canonical card payload SHA-256；
4. 完整三角色 review JSON 的 canonical SHA-256；
5. `approve_golden_card_review` 决定、复核时间和意见；
6. p0/p1/p2 风险级别要求的三角色签名。

签名使用领域分离 payload `story-agent-stage7-golden-card-review-ed25519-payload/v1`。每个 signer 必须同时满足唯一 signer ID、唯一 key ID、角色匹配、仓库信任策略中状态为 trusted、payload SHA-256 一致、Ed25519 验签通过且签名时间不早于 attestation。

## 信任边界

- Trust policy 固定从 `data/professional-benchmarks/all-format-stage7-golden-card-review-trust-policy.json` 读取，不接受 attestation 或请求自带的 signer 列表。
- 当前模板没有 trusted signer，状态为 `preparation_template`，因此所有真实验证保持 fail closed。
- 输入中的 `human_approved`、`golden_card_promoted` 和 `professional_passed` 必须为 false。
- 即使密码学验证全部通过，服务仍固定返回 `human_approval_granted=false`、`golden_card_promoted=false` 和 `professional_passed=false`。

## API 与写入边界

- `GET /api/stage7-golden-cards/review-signature`：返回30张卡、审稿模板、签名模板、trust policy 摘要和当前检查结果。
- `POST /api/stage7-golden-cards/review-signature/validate`：只在内存重验 review JSON 和 signature attestation。
- `/sign`、`/approve`、`/persist`、`/promote` 和 `/writeback` 均不存在。
- 签名记录、卡片、统一索引和 `data/provinces/*.md` 均不会被修改。

## 验证

- P15 重点测试：1个文件、5个用例通过。
- 覆盖仓库空信任模板、三角色有效 Ed25519 fixture、attestation 签后篡改、撤销 signer 和禁止写入端点。
- 有效签名测试仅使用临时生成的 fixture key，只证明密码学验证合同，不计真实签名或真人批准。
- Server TypeScript、Client TypeScript 与 production build 通过。
- Playwright Chromium 实际点击“验证外部签名”：Trust policy为preparation_template、Trusted0、审稿预检失败、签名0/3、人工批准0，页面保持BLOCKED，全部写入与晋升标志为否。
- 截图：`output/playwright/stage7-golden-card-review-signature.png`。

浏览器控制台只有既有 `favicon.ico` 404，与签名验证 API 无关。

## 信用边界

专业文本创作进度保持47.5%。空信任模板、有效/篡改/撤销签名fixture、review/attestation SHA-256、Ed25519验签、验证ready与浏览器截图均不计真实签名、真人批准、黄金卡晋升、Stage 7实际完成或专业通过。
