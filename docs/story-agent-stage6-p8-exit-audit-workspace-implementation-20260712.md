# Story Agent Stage 6 P8 退出审计工作台（2026-07-12）

## 结论

Stage 6 已新增 `/story/stage6-exit-audit` 只读产品面，把 P3 退出审计合同直接提供给 operator。页面不执行修订、不写 artifact、不改变反馈状态，也不能授予专业通过。

当前真实数据：

```text
项目：15
Blocked：15
退出复核候选：0
记录修订轮次：0
已核验真实修订轮次：0
专业通过：0
```

## 共享合同与 API

- `Stage6ExitAuditBlocker`、`Stage6ExitAuditProjectResult` 和 `Stage6RealRevisionExitAuditReport` 已进入 `web/shared/types.ts`，服务端与客户端共用同一返回类型。
- `GET /api/stage6-revisions/exit-audit` 重新读取并校验当前 registry、intake、readiness 和执行证据。
- POST 等 mutation 方法不存在；路由测试固定返回 404。
- 审计读取不会创建 `web/generated/stage6-revisions`，不会修补或推断缺失证据。

## 页面

页面逐项目展示：

1. P0 readiness 重验。
2. 两轮记录与两轮真实 provenance。
3. 八类不可变 artifact DAG。
4. Round 0 → 1 → 2 包哈希连续。
5. 修订预算和币种。
6. 三角色桌读与意见有效关闭。
7. 派生文本重建。
8. 质量增量可追溯。

同时展示 readiness、intake、registry 的 canonical SHA-256，确保页面结果有明确来源。退出候选只表示可进入下一步人工复核，固定不等于专业通过。

## 验证

- P3 审计与 P8 产品面重点测试：2 个文件、6 个用例通过。
- Client TypeScript 检查及 Vite production build 通过。
- Playwright Chromium 实测：15 blocked、退出候选 0、真实修订轮次 0、专业通过 0。
- 截图：`output/playwright/stage6-exit-audit.png`。

浏览器控制台只有既有 `favicon.ico` 404，与退出审计 API 和信用门禁无关。

## 信用边界

该工作台只计第四个专业流程产品面。只读 GET、blocked 报告、检查项、源哈希、浏览器截图和未来可能出现的退出候选标签，均不计真实修订完成、真人评审通过、Stage 6 退出完成或专业通过。
