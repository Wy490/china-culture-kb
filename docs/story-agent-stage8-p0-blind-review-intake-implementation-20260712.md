# Story Agent Stage 8 P0 专业盲评接入面（2026-07-12）

## 结论

新增 `/story/stage8-blind-review-intake`，把15片型75个固定benchmark项目统一接入终稿、授权基准、匿名随机化、三类独立实名评审与排期门禁。当前只有准备模板，没有真实终稿或真人评审材料，因此75/75全部blocked，真人盲评通过和专业通过均为0。

## 统一合同

`story-agent-stage8-blind-review-intake/v1` 每项目固定绑定：

- benchmark ID、video type和source entry；
- `operator_submitted_real_review` provenance与唯一run ID；
- 最终ProfessionalTextPackage文件、字节SHA-256、`professional-text-package/v1` schema、片型绑定与非skeleton内容完整性；
- 有明确权利状态、文件SHA-256和外部核验记录的比较基准；
- randomization batch、匿名candidate label及来源对评审者隐藏声明；
- 编剧/剧本编辑、类型/导演、事实/文化三类唯一评审者的身份与独立性核验；
- 无利益冲突声明、核验排期与截止时间。

时间链同时要求：operator提交时间不得晚于校验时间；权利、身份、独立性和排期核验必须不晚于提交；review deadline必须晚于提交和当前校验时间。未来提交、过期排期或事后补写核验均fail closed。

输入中的 `human_blind_review_passed` 和 `professional_passed` 只能为false。自报true会导致schema与信用门禁同时失败。

## Operator模板与readiness

- `data/professional-benchmarks/all-format-stage8-blind-review-operator-template.json`：75项完整结构，provenance固定为`preparation_template`。
- `data/reports/story-agent-stage8-blind-review-readiness.json`：15份benchmark源文件SHA-256、15片型汇总和75项逐项目blocker。
- `scripts/story-agent-stage8-blind-review-intake.mts --write|--check`：确定性生成与stale-check。

当前精确结果：

```text
片型：15 / 15
固定项目：75 / 75
接入ready：0 / 75
blocked：75 / 75
三角色assignment ready：0
真人盲评通过：0 / 45
专业通过：0
```

## API与产品面

- `GET /api/stage8-blind-review/intake` 返回动态模板、阈值与readiness。
- `POST /api/stage8-blind-review/intake/validate` 只做内存dry-run。
- persist、execute、approve、sign、publish和writeback端点均不存在。
- 页面支持选择JSON、复制模板、仅校验、片型/状态过滤和75项逐项目查看。

## 阈值与边界

页面展示现有非劣标准：加权均分不低于85、单维不低于75、相对授权基准差不低于-3、至少三分之二制作推进票、三角色齐备、硬门槛为0。P0不执行评分或作出decision；P18已把评估器泛化到15片型并绑定权重合同SHA-256，真实签名与发布门槛仍待外部证据。

模板、readiness、fixture、simulation、fallback、机器阈值、自报字段或导入ready均不计真人盲评。即使后续接入材料ready，也只表示可以开始外部盲评，不表示评审通过或专业通过。

## 验证

- P17重点测试：1个文件、6个用例通过；包括“任意哈希匹配JSON不得冒充终稿包”和未来提交/过期排期/事后核验回归门禁。
- Server TypeScript和Client production build通过；141 modules transformed。
- operator模板与readiness stale-check通过。
- Playwright Chromium实测75/75 blocked、“仅校验”保持零信用，控制台0 error/0 warning。
- 截图：`output/playwright/stage8-blind-review-intake.png`。

专业文本创作进度保持47.5%。未调用模型、未落盘评审输入或记录、未开始评审执行。
