# Story Agent Stage 6 P12 退出复核 Ed25519 签名检查器（2026-07-12）

## 结论

Stage 6 已新增 `/story/stage6-exit-review-signature`，用于验证外部三角色退出复核签名。检查器把信任策略固定在仓库侧，attestation 只作为不可信输入；验证通过也不会由该接口签名、导入、落盘退出记录、启动执行或授予专业通过。

当前仓库结果：

```text
项目：15
退出复核候选：0
Trust policy：preparation_template
Trusted signers：0 / 3
Verified roles：0 / 3
Signature created：否
Attestation persisted：否
Exit record persisted：否
Execution started：否
Professional passed：否
```

## 合同与信任边界

- 信任策略：`story-agent-stage6-exit-review-trust-policy/v1`，固定从 `data/professional-benchmarks/all-format-stage6-exit-review-trust-policy.json` 读取，不接受请求携带的信任列表。
- Attestation：`story-agent-stage6-exit-review-attestation/v1`，绑定 benchmark、真实项目、当前 P3 退出审计 binding SHA-256、`approve_stage6_exit` 决定、评审时间和三角色签名。
- 签名角色固定为 `writer_editor`、`director`、`fact_culture_reviewer`；signer ID、角色、key ID 和公钥必须与激活且未撤销的仓库信任策略一致。
- Canonical payload 使用 `story-agent-stage6-exit-review-ed25519-payload/v1` 领域分离合同；每个签名同时验证 payload SHA-256 与 Ed25519 密码学签名。
- 当前 P3 审计必须独立重验为 `stage6_exit_candidate=true`，否则签名检查保持 fail closed。
- signer、key、Feedback/项目绑定和时间检查均不能由自报 `professional_passed` 绕过。

## API 与只读行为

- `GET /api/stage6-revisions/exit-review-signature`：返回固定 trust policy 摘要、15项目状态、绑定模板和当前验证结果。
- `POST /api/stage6-revisions/exit-review-signature/validate`：只在内存解析和验签。
- `/sign`、`/import`、`/persist` 和 `/execute` 均不存在，合同测试固定返回 404。
- 验证结果固定报告 `dry_run_only=true`、`signature_created=false`、`attestation_persisted=false`、`stage6_exit_record_persisted=false`、`execution_started=false` 和 `professional_passed=false`。

## 验证

- P12 重点测试：1 个文件、5 个用例通过。
- 测试覆盖空信任模板、三角色有效 Ed25519 签名、attestation 篡改、已撤销 signer 和不存在的写入/执行端点。
- 有效签名测试只使用临时 fixture key；它只证明密码学验证合同工作，不计真实签名、真人复核或专业通过。
- Server TypeScript、Client TypeScript 与 production build 已通过。
- Playwright Chromium 实际点击“验证外部签名”：15个项目全部 `candidate no`，页面保持 BLOCKED，签名创建、attestation 落盘、退出记录落盘、执行启动和专业通过全部为否。
- 截图：`output/playwright/stage6-exit-review-signature-inspector.png`。

浏览器控制台只有既有 `favicon.ico` 404，与签名验证 API 和退出信用边界无关。

## 信用边界

该检查器只计第八个专业流程产品面。信任策略模板、有效/篡改/撤销签名 fixture、canonical payload、SHA-256、Ed25519 验签和浏览器截图均不计真实签名、attestation 落盘、Stage 6 退出完成、真实修订、真人盲评或专业通过。
