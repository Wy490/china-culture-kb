# Story Agent `historical_drama` Iteration 4 实现报告

更新时间：2026-07-11

状态：historical_drama_internal_contract_ready_real_model_and_human_validation_pending

## 本轮结论

`historical_drama` 已建立不侵入现有生成主链的专业文本候选管线。它从显式传入的 `StoryGenerateResult`、研究证据和历史剧专业证据生成 `ProfessionalTextPackage`，以历史事件因果、时代/制度压力、角色立场、不可撤回行动及后果、逐场史实/戏剧化边界作为硬门槛，并提供定向修订计划和派生文本重建。

本轮只建立内部能力合同和回归证据，没有调用真实模型，没有把 fixture、simulation、机器分数或合法 schema 视为专业通过。5 个项目规格均为 `awaiting_real_model_run`；专业文本包通过、固定真实项目和真人盲评通过仍全部为 0。

## 已实现

1. `professional-historical-drama-pipeline-service.ts`
   - 只接受 `historical_drama`，仅通过显式调用启用。
   - 填充创作简报、证据包、史实/改编合同、角色立场、因果节拍、分场、完整正文、对白、导演文本、连续性台账和交付文本。
   - 不修改 `story-service.ts`、现有 prompt、fallback 或前端生成入口。
2. `professional-historical-drama-quality-service.ts`
   - 执行十维候选评估，`professional_passed` 固定为 `false`。
   - 建立 11 项硬门槛：简报、完整成稿、中心事件、时代/制度压力、至少三段有证据的因果链、角色立场冲突、决定与后果、逐场行动/变化、逐场史实边界、对白声线/潜台词、总体事实/戏剧化/未知/免责声明边界。
   - 原创性和最终专业结论必须等待真实固定项目与真人盲评。
3. `professional-historical-drama-revision-service.ts`
   - 将门槛问题分流为模型重写或人工证据补充。
   - 分场变化后可确定性重建 `sequence_beats`、`director_text_plan` 和 `delivery_text_package`。
   - 重建写入 `revision_trace`，不会自动编造史实、立场或对白。
4. 固定项目规格
   - 武昌起义、南昌起义、西安事变、古田会议、芷江受降，共 5 项。
   - 每项固定中心事件、戏剧问题与证据关注点，状态均为 `awaiting_real_model_run`。
5. 失败 fixture
   - 背景知识摘要且无因果链。
   - 移除时代/制度压力、立场冲突、决定与后果。
   - 折叠逐场事实边界、未知项、免责声明和对白声线。
   - 三类 fixture 均能触发登记的门槛，仅用于结构回归。

## 当前指标

```text
当前 Stage：Stage 2 / Iteration 4
覆盖片型：15 / 15
专业纵向管线：2 / 15（character_story、historical_drama）
专业文本包通过：0 / 15
固定回归项目：0 / 75（另有两个片型项目规格 10 项，均未运行真实模型）
真人盲评通过项目：0 / 45
黄金素材卡人工通过：0 / 75
硬门槛失败数：15（片型能力门槛）
professional_text_creation_progress：40% -> 40%
```

进度没有上升的原因：交接总纲只把固定真实模型项目、真实修订增量、真人盲评与人工通过素材计入相应验收单元。本轮 1 个候选测试、3 个失败 fixture、5 个项目规格和内部服务实现均明确排除于这些计分项。

## 下一退出条件

1. 为 5 个规格建立冻结知识源快照、实际 prompt、模型/提示版本和 fail-closed 运行记录。
2. 在独立执行与付费授权后运行真实模型，保存初稿、定向修订稿、终稿、成本和质量增量。
3. 所有因果、立场、史实/戏剧化边界硬门槛关闭。
4. 完成编剧/剧本编辑、类型/导演、事实/文化三类真人盲评与授权签署。
5. 只有上述证据成立，才增加固定真实项目、专业文本包通过数和专业进度。

## 本轮验证

- `historical_drama` 与 `character_story` 专业纵向回归：2 个测试文件、8 个用例通过。
- Web Server TypeScript 类型检查通过。
- Web Server 全量回归：46 个测试文件、650 个用例通过。
- MCP 全量回归：79 个测试文件、345 个用例通过。
- 其余构建、文案、知识库、审计和治理检查结果写入统一进度报告。

## 外部阻塞

- 真实模型执行凭据、独立付费授权、模型版本与预算记录。
- 用户自有、公共领域或已授权的历史剧专业结构基准。
- 编剧/剧本编辑、类型/导演、事实/文化三类评审者。
