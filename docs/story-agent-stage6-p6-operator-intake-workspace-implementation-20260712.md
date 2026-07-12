# Story Agent Stage 6 P6 Operator Intake 工作台（2026-07-12）

## 结论

Stage 6 已新增 `/story/stage6-intake` operator 产品面，把 P0 模板和 validator 接入真实页面。它只执行内存 dry-run：不保存 operator JSON、不复制初始包、不启动 P1 批次、不创建 revision workspace、不调用模型。

当前模板浏览器实测结果保持：

```text
项目：15
ready：0
blocked：15
已验证真实修订轮次：0
专业通过：0
```

## 服务端

- `GET /api/stage6-revisions/intake`：返回 15 项 operator 模板、模板 readiness 和固定 fail-closed policy。
- `POST /api/stage6-revisions/intake/validate`：接受任意 JSON 值，返回结构化 schema/global/project blocker，不写文件。
- 复用 P0 `validateStage6RealInputIntake`，继续核验仓库内真实初始包、SHA-256、项目绑定、两轮授权预算、实名三类评审和桌读排期。
- 返回合同固定 `dry_run_only=true`、`input_persisted=false`、`execution_started=false`、`professional_passed=false`。

## 前端

页面提供：

1. 15 项 JSON 模板加载、恢复与复制。
2. 本地 JSON 文件内容导入；文件只在浏览器内读取。
3. JSON 解析错误与服务端结构化 blocker 展示。
4. ready/blocked 筛选、12 项逐项目检查矩阵和完整错误路径。
5. 明示“ready 不等于真实修订或专业通过”。

## 验证

- Stage 6 operator/intake/workspace 重点测试：3 个文件、12 个用例通过。
- Web 文案审计、Server/Client TypeScript 检查通过。
- Playwright Chromium：页面加载成功，点击 Dry-run 成功，指标为 15 / 0 / 15 / 0。
- 浏览器截图：`output/playwright/stage6-operator-intake.png`。

唯一浏览器控制台消息是既有 `favicon.ico` 404，与业务接口和页面状态无关。

## 信用边界

该工作台是第二个专业流程产品面，只计产品化单元。模板、dry-run、schema 合法、blocked 或未来的 readiness ready 均不计真实修订、真人桌读、Stage 6 退出或专业通过。
