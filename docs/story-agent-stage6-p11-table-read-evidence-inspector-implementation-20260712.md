# Story Agent Stage 6 P11 真人桌读证据与签署前预检（2026-07-12）

## 结论

Stage 6 已新增 `/story/stage6-table-read-inspector`，用于在真实修订批次前检查桌读 artifact。检查器复用 P1 `story-agent-stage6-table-read-feedback/v1` schema，并重新绑定 P0 readiness、真实项目、轮次、桌读 session 和三类实名 reviewer ID。

当前模板结果：

```text
项目：15
P0 ready：0
签署前预检：blocked
Signature created：否
Human table-read credit：0
State mutated：否
Execution started：否
Professional passed：否
```

## 签署前门禁

只有以下检查全部通过，才返回 `signature_preflight_ready=true`：

1. JSON 与 P1 table-read artifact schema 合法。
2. P0 readiness 重新验证为 ready。
3. benchmark、真实项目和 Round 1/2 绑定一致。
4. session reference 与已核验桌读排期一致。
5. 编剧/剧本编辑、类型/导演、事实/文化三角色意见齐全。
6. reviewer ID 与 P0 已核验实名评审逐角色一致。
7. Feedback ID 唯一。
8. artifact 提交时间不早于桌读排期。

签署前 ready 只表示材料可以交给真人签署，不是签名，不产生真人桌读信用。

## API 与安全边界

- `GET /api/stage6-revisions/table-read-inspector`：按项目和轮次返回动态绑定模板、15项目状态与模板检查结果。
- `POST /api/stage6-revisions/table-read-inspector/validate`：只在内存检查 JSON 原文。
- `/sign`、`/persist`、`/close` 和 `/execute` 均不存在，测试固定返回 404。
- 自报 `signature`、`human_table_read_credit_granted` 或 `professional_passed` 会触发 schema 与信用排除，不能成为真实签署。

## 验证

- P11 重点测试：1 个文件、4 个用例通过。
- Server/Client TypeScript 检查和 Client production build 通过。
- Playwright Chromium 实际点击签署前预检：blocked、P0 ready 否、Signature created 否、Human credit 0、Professional passed 否。
- 截图：`output/playwright/stage6-table-read-evidence-inspector.png`。

浏览器控制台只有既有 `favicon.ico` 404，与桌读检查 API 和签署边界无关。

## 信用边界

该检查器只计第七个专业流程产品面。动态模板、schema 合法、三角色齐全、签署前 ready、两类 SHA-256 和浏览器截图均不计签名、真人桌读完成、反馈关闭、真实修订、Stage 6 退出或专业通过。
