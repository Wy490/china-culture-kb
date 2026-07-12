# Story Agent Stage 6 P2 桌读与版本差异工作台实施报告

状态：`revision_workspace_complete_real_execution_blocked_external_inputs`

## 本轮完成

P2 已形成独立产品面 `/story/stage6-revisions`，没有继续向大型 `StoryStudio.vue` 堆叠逻辑。

- 15 项 Stage 6 portfolio：逐项目显示 P0 readiness、执行轮次、真实修订信用、未关闭反馈、证据来源和 Stage 6 退出候选。
- 六类 Coverage 面板：结构、人物/信息、场景、对白/旁白、节奏、事实文化；没有版本时明确显示“不能生成虚构 Coverage”。
- Round 0 / 1 / 2 版本：正文、场景数、十维机器候选分、维度增量、硬门槛和 package SHA-256。
- 文本差异：相邻轮次逐行 added/removed diff；相邻版本不齐时不生成伪差异。
- 派生文本状态：按轮次显示 required/rebuilt sections 和完整性。
- 桌读反馈：支持准备态意见草稿、实名评审分配、关闭、重开和 optimistic revision 冲突保护。
- 反馈 review state 独立于不可变 revision ledger；重开反馈会使有效 Stage 6 退出候选失效，但不会篡改历史 artifact。
- 醒目标识 `real_model_verified`、`human_authored_verified`、`simulation`、`fixture`、`prepared`、`blocked`。
- 所有响应和页面固定 `professional_passed=false`；准备态反馈草稿固定 `counts_as_human_table_read=false`。

## 关键文件

- 聚合与反馈审计服务：`web/server/src/services/stage6-revision-workspace-service.ts`
- API 路由：`web/server/src/routes/stage6-revisions.ts`
- 服务测试：`web/server/src/__tests__/stage6-revision-workspace.test.ts`
- 前端 API：`web/client/src/api/stage6-revisions.ts`
- 独立页面：`web/client/src/views/Stage6RevisionWorkspace.vue`
- 浏览器截图：`output/playwright/stage6-revision-workspace.png`

## 当前机器状态

```text
项目：15
P0 ready：0 / 15
外部阻断：15 / 15
已记录轮次：0
已验证真实修订轮次：0
专业通过：0
页面真实性标识：blocked
准备态反馈计真人桌读：false
```

## 验证

- P2 service/API 合同测试覆盖：当前仓库阻断态、simulation 显示、版本 diff、十维增量、派生重建、反馈分配/关闭/重开、乐观锁和准备态草稿零信用。
- Web Server 全量：64 个测试文件、724 个用例通过。
- Web copy audit、Server/Client TypeScript：通过。
- 本地 Chromium 1440×1000 全页截图通过；API 同时返回 `blocked=15`、`verified_real_revision_round_count=0`、`professional_pass_count=0`。
- 未调用模型，未执行真实修订，未创建 `web/generated/stage6-revisions`。

## 下一步

P3 真实两轮修订受外部输入阻断：必须先提供15个真实项目、合法初始包、创作授权、两轮预算、三类实名评审和桌读排期。阻断解除前，不运行 `--execute`，不把 UI、草稿或 simulation 计为真实修订。
