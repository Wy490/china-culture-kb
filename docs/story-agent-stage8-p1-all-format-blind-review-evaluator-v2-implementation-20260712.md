# Story Agent Stage 8 P1 全片型盲评评估器 v2（2026-07-12）

## 结论

盲评评估器已从固定使用`character_story`权重升级为15片型显式v2合同。每个decision记录video type、十维权重快照、统一阈值与不可变合同SHA-256；artifact和finalization会重新绑定并拒绝片型、权重或digest漂移。

当前只有计算和完整性合同，没有真实review bundle。score threshold即使在测试fixture中通过，也固定`counts_as_human_blind_review_pass=false`、`professional_passed=false`。

## V2合同

- Bundle：`professional-benchmark-blind-review/v2`，新增必填`video_type`。
- Decision：`professional-benchmark-blind-review-decision/v2`。
- 权重合同：`professional-blind-review-weight-contract/v1`。
- 每个decision保存`applied_dimension_weights`、`weight_contract_sha256`、阈值、`score_threshold_passed`和`review_threshold_passed`。
- 15片型权重均来自`ProfessionalTextTypeContract`单一事实源，权重和必须为100。

## 完整性加固

P18测试发现权重合同函数曾直接返回中央合同对象引用。若调用者修改decision中的权重，会同时污染中央合同，导致finalization无法识别漂移。现改为独立权重快照；finalization重新计算预期合同并检查：

1. benchmark、run和video type身份；
2. 权重合同SHA-256；
3. 十维权重逐项一致；
4. score threshold与review threshold状态一致；
5. 后续外部Ed25519人审证据和signed release仍必须独立成立。

## Readiness与产品面

`data/reports/story-agent-stage8-blind-review-evaluator-readiness.json` 固定报告：

```text
片型权重合同：15 / 15
权重和有效：15 / 15
唯一合同SHA-256：15
真实review bundle：0
真人盲评通过：0 / 45
专业通过：0
```

Stage 8页面显示v2 schema、每片型前三权重和合同hash。`GET /api/stage8-blind-review/evaluator`只返回readiness，不提供validate、execute、approve、credit、sign或publish端点。

## 验证与信用边界

- P18重点测试：4个文件、82个用例通过。
- 15片型精确权重计算、15个唯一hash、artifact v2、finalization漂移拒绝和共享引用回归均已覆盖。
- Server TypeScript与Client production build通过；141 modules transformed。
- evaluator readiness stale-check通过。
- Playwright Chromium实测v2合同15/15、75/75仍blocked、真人/专业通过0/0；唯一控制台错误为既有favicon 404。
- 截图：`output/playwright/stage8-blind-review-evaluator-v2.png`。

fixture、simulation、fallback、权重合同、机器score threshold、readiness和浏览器展示均不计真实review bundle、真人盲评通过或专业通过。专业文本创作进度保持47.5%，模型调用为0。
