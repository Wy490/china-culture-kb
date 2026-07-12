# Story Agent Stage 6 P7 Revision Preflight 控制台（2026-07-12）

## 结论

Stage 6 已新增 `/story/stage6-preflight` 产品面，用于在真实执行前校验 P1 revision command。页面和 API 只调用 `preflightStage6RevisionBatch`，不暴露 execute endpoint，也不写 execution state 或不可变 artifact。

当前模板结果：

```text
计划轮次：30
P0 ready 项目：0
Preflight：blocked
模板 command blockers：19
已核验真实修订轮次：0
专业通过：0
```

## 服务端

- `GET /api/stage6-revisions/preflight`：返回动态绑定当前 readiness 文件 SHA-256 的 command 模板、P1 批次摘要和模板 preflight。
- `POST /api/stage6-revisions/preflight/validate`：接受任意 JSON 值并返回结构化 command/readiness/artifact/provenance/budget/table-read blocker。
- `POST /api/stage6-revisions/preflight/execute` 不存在，测试固定返回 404。
- 返回合同固定 `dry_run_only=true`、`artifacts_written=false`、`execution_started=false`、`verified_real_revision_credit=false`、`professional_passed=false`。

## 前端

页面支持 command 模板恢复、JSON 内容导入、Preflight 和 blocker 分类，明确展示：

- Execute endpoint：无。
- Artifacts written：否。
- Execution started：否。
- 真实修订信用：0。
- 专业通过：否。

即使未来 preflight 变为 ready，也仍需独立 operator 在 CLI 显式使用 `--execute`；页面不会代替授权或执行。

## 验证

- P1/operator intake/preflight 重点测试：3 个文件、10 个用例通过。
- Web 文案审计和 Server/Client TypeScript 检查通过。
- Playwright Chromium 实际点击 Preflight：BLOCKED、19 blockers、执行信用 0。
- 截图：`output/playwright/stage6-revision-preflight.png`。

浏览器控制台只有既有 `favicon.ico` 404，与页面接口和门禁结果无关。

## 信用边界

该控制台只计第三个专业流程产品面。模板、schema 合法、preflight blocked/ready、命令哈希和浏览器展示均不计真实修订、真人桌读、Stage 6 退出或专业通过。
