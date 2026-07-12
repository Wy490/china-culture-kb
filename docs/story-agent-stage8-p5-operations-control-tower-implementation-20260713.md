# Story Agent Stage 8 P5 总控与外部材料交接（2026-07-13）

## 结论

新增 `/story/stage8-operations`，把75个固定项目的盲评接入、15片型评估器、三角色签名、finalization candidate和durable signed release汇总成统一只读总控。每个项目只产生一个“最早未满足门禁”的结构化NEXT；当前75/75项目都停在外部盲评intake，handoff仅在内存生成，专业文本创作进度保持47.5%。

```text
Handoff ≠ External Completion ≠ Professional Pass
```

## 五条lane

1. `blind_review_intake`：真实终稿、授权基准、匿名随机化、三角色实名评审与排期，当前0/75。
2. `all_format_evaluator`：15片型权重合同15/15，但真实外部review bundle为0；合同ready不计真人通过。
3. `review_signatures`：三角色可信签名0/75。
4. `finalization_candidate`：专业成品、真实修订增量、签名盲评与外部trust形成的candidate为0/75。
5. `durable_release`：独立发布权限创建并持久化的signed release为0/75，导入为0。

五条lane都固定`credit_granted=false`。readiness、阈值、preparation、fixture、simulation、fallback或验签技术状态不能跳过任何上游外部证据。

## 唯一NEXT与内存handoff

- 服务按 intake → evaluator bundle → signatures → finalization → durable release → authorized external import 的顺序选择最早未满足门禁。
- 75个benchmark生成75个唯一task ID；当前NEXT均为`complete_external_blind_review_intake`。
- 每项NEXT带route、所需外部证据、`external_input_required=true`和`counts_as_completion=false`。
- handoff绑定5份Stage 8 readiness报告SHA-256并生成canonical SHA-256。
- handoff固定`memory_only=true`、`persisted=false`、`execution_started=false`、`external_evidence_completed=false`、`human_blind_review_passed=false`、`durable_release_imported=false`、`professional_passed=false`。

## 只读边界

- `GET /api/stage8-blind-review/operations`返回五lane、75项目、唯一NEXT、source binding和memory-only handoff。
- 页面仅支持筛选、门禁导航与复制当前内存JSON。
- export、persist、execute、import、approve、release、writeback端点均不存在。
- 不调用模型、不读取凭据、不创建签名或release、不写入`web/generated`或真实通过状态。

## 确定性报告与CI

- `scripts/story-agent-stage8-operations.mts --write|--check`维护`data/reports/story-agent-stage8-operations-readiness.json`。
- 统一CI在命令执行前强制验证五lane零信用策略、75项目/75NEXT、evaluator合同15/15以及review bundle/signature/candidate/release/import/human/professional计数全为0。
- 进度文件进入P22，但product surface与专业进度不增加，仍为47.5%。

### P22 fail-closed加固

- 禁止把片型或portfolio级`real_review_bundle_count`、`signature_verification_ready_project_count`、`release_record_verification_ready_project_count`转换成任一benchmark的ready状态；在上游提供逐benchmark核验证据前，各项目继续fail closed。
- evaluator合同若任一片型不是ready，服务直接拒绝生成handoff，不允许绕过内部合同进入外部NEXT。
- 阶段解析器按六个前缀状态独立回归：intake → review bundle → signatures → finalization → durable release → authorized import；测试状态只证明顺序逻辑，不计外部完成。
- 统一CI重新读取五份源报告计算SHA-256，校验固定路径、75个唯一benchmark ID、当前唯一NEXT和全部逐项目零信用字段，避免仅靠汇总计数通过。
- P17时间链、P19签名时间/授权链和P21 decision/manifest门禁收紧后，按P19→P20→P21→P22依赖顺序重建readiness；P22随源SHA自动刷新，当前handoff canonical SHA-256为`91d536ab85fee38965deb9195c08362cda499cb47a070af6d6b9cf526ca8bed8`，摘要信用仍全为0。

## 验证与浏览器实测

- P22针对性测试覆盖五lane聚合、75唯一NEXT、六阶段逐项目顺序、memory-only source-bound handoff和mutation endpoint缺失。
- Playwright Chromium实测页面显示75项目、Intake0、Evaluator Contract15/15、Signed Review0、Candidate0、Release/Human/Pro 0/0/0；复制区明确显示全部安全字段为否。
- 截图：`output/playwright/stage8-operations.png`。

以上验证只证明总控与交接合同一致，不计真实模型、真实修订、真人盲评、signed release、外部导入或专业通过。
