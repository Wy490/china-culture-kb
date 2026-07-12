# Story Agent Stage 8 P3 finalization / signed-release 只读预检（2026-07-12）

## 结论

新增 `/story/stage8-finalization-preflight`，把既有 `professional-benchmark-finalization-input/v2` candidate gate 接成 15 片型、75 个固定项目的只读 operator 预检。当前 75/75 项目均因外部证据缺失保持 blocked；finalization candidate、durable signed release 和 professional pass 均为 0，专业文本创作进度保持 47.5%。

```text
Finalization candidate ≠ Durable signed release ≠ Professional pass
```

## 六条 fail-closed lane

每个固定项目独立检查：

1. 12 件专业成品与不可变 artifact 证据；
2. 真实两轮修订及可核验质量增量；
3. 外部三角色实名盲评和 Ed25519 签名链；
4. 请求之外提供的外部 verifier trust policy；
5. `eligible_for_signed_release` candidate 门禁；
6. 由独立发布权限创建并持久化的 durable signed-release record。

前五条即使全部通过也只形成 candidate；缺少第六条时，领域 decision 固定保留 `signed_release_record_missing`，`professional_passed=false`。

## 只读边界

- `GET /api/stage8-blind-review/finalization` 返回 75 项 workspace、双 JSON 模板、六条 lane 与准备态预检。
- `POST /api/stage8-blind-review/finalization/validate` 只在内存中校验 finalization input 与外部 trust policy。
- persist、finalize、sign、release、approve、writeback 端点不存在。
- 返回值固定 `input_persisted=false`、`finalization_started=false`、`signed_release_created=false`、`professional_passed=false`。
- 仓库 trust policy 当前为 `preparation_template` 且 `keys=[]`；不自动生成 key，不把测试验签计为真人证据。

## 报告、CI 与零信用策略

- `scripts/story-agent-stage8-finalization-preflight.mts --write|--check` 生成并 stale-check operator 模板与 readiness 报告。
- `scripts/story-agent-ci.mjs` 已接入 P20 stale-check。
- 统一 CI 在执行命令前读取 P20 readiness，强制六类 ready/release/professional 计数全部为 0，并验证 candidate、readiness、fixture/simulation/fallback 均不能授予 release 或 professional credit。
- `data/reports/story-agent-professional-text-creation-progress.json` 已进入 P20，进度保持 47.5%，模型调用仍为 0。

## 浏览器验收

Playwright Chromium 实测确认：

- 固定项目总数 75；
- Artifact、Revision Δ、Signed Review、Trust、Candidate、Release 六条 lane 全部 BLOCKED；
- Finalization Input v2 与 External Trust Policy 双 JSON 可执行只读预检；
- 页面明确显示 `Candidate ≠ Signed Release ≠ Professional Pass` 和 `0 / 0 / 0`；
- 没有触发持久化、finalization、签名、release、模型调用或专业信用变更。

截图：`output/playwright/stage8-finalization-preflight.png`。

## 验证口径

P20 验收包含 Web 全量测试与 build、MCP 全量测试与 build、知识库 lint、P20 stale-check、统一 CI、P4 清单 stale-check 和 `git diff --check`。所有这些只证明代码、合同、报告和只读页面一致，不证明真实修订、真人盲评、signed release 或专业通过。

