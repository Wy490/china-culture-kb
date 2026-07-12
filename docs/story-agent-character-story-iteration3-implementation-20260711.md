# Story Agent `character_story` Iteration 3 实现报告

更新时间：2026-07-11

状态：full_lifecycle_contract_ready_external_model_and_signed_human_validation_pending

## 本轮结论

`character_story` 已具备不侵入现有生成主链的专业文本候选管线：从现有 `StoryGenerateResult` 和人工/研究输入生成 `ProfessionalTextPackage`，执行十维候选评估与 10 项硬门槛，生成定向修订计划，并在分场变化后重建节拍、导演文本和交付单元。

本轮进一步完成了 5 项受控运行计划、专用真实模型 readiness v2、完整 StoryScene 输出合同、初稿后协调器、artifact 完整性合同、盲评阈值、终审候选门禁和初稿到签署的机器生命周期计划。它们都只提供可核验的执行与审查基础，不构成专业质量通过。当前没有真实模型固定项目结果、初稿到终稿质量增量、真人盲评签署或 signed release；因此 `professional_passed` 固定为 `false`，专业进度保持 40%。

## 已实现

1. `professional-text-pipeline-service.ts`
   - 仅接受 `character_story`，通过显式调用启用。
   - 填充创作简报、证据包、人物关系、结构、节拍、分场、完整正文、对白润色、导演文本、连续性台账和交付文本。
   - 不修改 `story-service.ts`、现有 prompt 或生成 fallback。
2. `professional-text-quality-service.ts`
   - 覆盖合同规定的十个质量维度。
   - 检查简报、成稿形态、目标、阻力、选择、代价、关系变化、逐场行动与转折、角色声线/潜台词和事实边界。
   - 机器分数只用于 Coverage 和修订路由，原创性与专业结论留给固定基准及真人盲评。
3. `professional-text-revision-service.ts`
   - 将硬门槛分流为模型重写或人工证据补充。
   - 分场发生变化时确定性重建 `sequence_beats`、`director_text_plan` 和 `delivery_text_package`。
   - 写入 `revision_trace`，不自动编造人物选择、事实或创作内容。
4. 固定评测规格
   - 5 个项目规格：周敦颐、王夫之、贾谊、陶侃、怀素。
   - 3 个失败 fixture：年表摘要、无选择/代价、无事实/对白边界。
   - 项目规格状态均为 `awaiting_real_model_run`，fixture/simulation 不计专业通过。
5. 真实执行预检
   - 从 5 个正式知识库条目冻结摘要、故事、文化意义、来源、待核实点和验证方法，并记录 SHA-256。
   - 每个项目固定单一中心事件、戏剧问题、创作简报、事实边界、Claude Opus 模型和提示/文本包版本。
   - 运行记录必须包含初稿、初始专业文本包、修订计划、最终专业文本包、token/成本和真人盲评。
   - 证据导入会拒绝 local fallback、fixture、simulation、模型/提示版本不符和来源快照漂移。
   - 专用 strict bridge 与 Claude CLI 的 realpath/SHA-256 技术锚为 5/5；凭据未核验且付费执行未获授权，授权真实模型可执行仍为 0/5。
6. 实际 benchmark prompt 与受控运行计划
   - 5/5 项均从冻结 execution package 重建实际 `StoryBlueprint` 与专业 character evidence prompt，并保存 prompt/source/package SHA-256。
   - 5/5 项均生成 sealed prepared ledger；计划只保存哈希、状态和 blocker，不保存 prompt 正文或凭据。
   - 当前计划为 `prepared=5`、`blocked=5`、`model_invocation=0`、`real_model_completed=0`、`professional_pass=0`。
7. 固定 strict bridge
   - 生产入口不接受任意 adapter、command 或额外 CLI 参数；测试 adapter 使用单独的 test-only brand。
   - 执行要求独立 operator 执行授权、付费授权、凭据确认、授权引用、正数批次预算，以及 approved CLI realpath/SHA-256。
   - run ledger v3 额外冻结 bridge 自身 realpath/SHA-256；独立生产入口在启动 CLI 前重算核对，旧 v2 账本失败关闭。
   - 批次中的每次调用只能获得尚未花费的剩余额度，不能重复使用完整批次上限。
   - 拒绝 fallback、fixture/simulation、模型别名子串冒充、来源/prompt 漂移和模型输出中的保留 pass/provenance 字段。
8. 运行和 artifact 证据
   - ledger 使用严格运行时 schema、状态不变量和 SHA 完整性 seal；该 seal 用于发现篡改，不是身份认证签名。
   - initial run 固定为 prompt、provider receipt、initial story、character evidence、usage/cost 五类持久化 artifact。
   - 12 类 completion artifact 均有 kind-specific Zod payload、producer、SHA/size/realpath、固定 DAG 与关键父 hash 绑定；provider receipt 交叉绑定完整 bridge envelope、story 和 character evidence，终稿质量快照单独入链；完整性通过仍固定 `professional_passed=false`。
9. 盲评阈值
   - 按 `character_story` 合同权重计算，要求三类独立角色、平均分、核心维度、非劣差值、制作推进票和零硬门槛。
   - 当前只实现 fail-closed 阈值合同；未绑定真实授权基准与真人签署前不计真人通过。
10. 完整场景与初稿后处理
   - benchmark prompt、bridge、adapter 和 initial-story artifact 逐场强制完整 StoryScene：时长、空间、戏剧功能、行动、人物、视听、冲突、对白/旁白、来源、事实依据和虚构边界均不得缺失。
   - coordinator 不猜测补齐；只接受哈希与真实外部 provenance 完整的初稿，再生成初始专业文本包、候选评分和修订工单。
11. 全生命周期和终审候选门禁
   - 5/5 生命周期计划均为 `awaiting_verified_initial_run` / `blocked`，完整列出 revision output、终稿、终稿质量快照、真人盲评、包含人审 artifact 的 professional-completion validation、finalization candidate 与 signed release。
   - finalization 只能标记可进入签署的候选，永远不直接授予专业通过；缺少 signed release 时 `professional_passed=false`。
   - finalization v2 要求外部信任策略和 Ed25519 签名；伪 SHA、自声明签名、未信任密钥或未签 v1 不能获得候选资格。

## 当前指标

```text
当前 Stage：Stage 2 / Iteration 3（全生命周期合同就绪，真实模型、签署人审待执行）
覆盖片型：15 / 15
专业文本包通过：0 / 15
固定回归项目：0 / 75（另有 character_story 固定项目规格 5 / 5）
真人盲评通过项目：0 / 45
黄金素材卡人工通过：0 / 75
硬门槛失败数：15（片型能力门槛）
professional_text_creation_progress：40% -> 40%
```

不计分的实现/回归证据：专业纵向管线 1/15，专业质量评估器 1/15，专业修订计划器 1/15，本地候选 fixture 1 个，失败 fixture 3 个。

不计分的执行准备证据：固定项目规格 5/5，知识源快照和执行包 5/5，专业 prompt 5/5，prepared ledger 5/5，strict 技术锚 5/5，受控计划 blocked 5/5，生命周期计划 awaiting/blocked 5/5；模型调用 0，真实模型完成 0，认证/付费真实模型可执行 0/5，signed release 0/5。

## 下一退出条件

1. 由 operator 独立核验模型凭据、执行/付费授权、授权引用、批次预算和已冻结 CLI hash；当前不会自行发起付费调用。
2. 运行 5 个固定真实模型项目，并保存输入、初稿、定向修订稿、终稿、模型/提示版本、成本和修订次数。
3. 每个项目没有摘要式成稿，没有人物选择/代价、关系变化、场景行动、潜台词或事实边界硬门槛失败。
4. 完成真人盲评和三类评审角色签署；机器分数不能代替该步骤。
5. 通过终审候选门禁后，由授权流程生成并核验 signed release；候选 decision 本身不计专业通过。
6. 只有上述证据成立，才更新固定真实回归项目、专业文本包通过数和专业进度。

## 本轮验证

- Web Server：42 个测试文件、638 个用例通过。
- MCP：79 个测试文件、345 个用例通过。
- Web 文案审计、Server/Client 类型检查、MCP 构建、知识库 lint 全部通过。
- benchmark preflight、受控计划、生命周期计划 `--check`、专业进度审计、治理检查和 `git diff --check` 全部通过。
- `data/professional-benchmarks/character-story-iteration3-runs` 未生成；本轮模型调用、真实模型结果和费用均为 0。

## 外部输入

- 独立 operator 提供的真实模型凭据确认、执行/付费授权引用和批次预算；本轮未调用模型、未产生费用。
- 若固定模型或 CLI 版本发生变化，必须重新生成 execution manifest 与受控计划并审查 SHA-256，不允许临时覆盖。
- 用户自有、公共领域或已授权的专业结构基准。
- 编剧/剧本编辑、类型/导演、事实/文化三类评审者。
