# Story Agent 新对话开发交接（2026-07-11）

## 1. 当前结论

项目已从 Stage 0 全片型审计推进到 **Stage 6 / Iteration 2**。

- 15/15 VideoType 已有独立 `GenreStoryProfile`、专业文本合同、合法骨架、opt-in 纵向管线、候选质量评估器和片型修订计划器。
- 15/15 VideoType 已建立固定内部项目规格，共 75 个；另有 45 个失败 fixture。它们只用于合同和回归，不计真实项目或专业通过。
- 已建立结构、人物或信息、场景、对白或旁白、节奏、事实与文化六类统一 Coverage。
- 已建立桌读反馈导入、逐条关闭、两轮修订账本、前后包 SHA-256、质量增量、问题变化和派生文本重建合同。
- 已为 15 个片型各规划一个真实项目执行位，共 30 轮修订。
- 当前 15/15 项目全部 `blocked`，Round 1 可执行 0/15；没有调用付费模型，没有伪造真人桌读或真实修订结果。

当前机器指标：

```text
Stage：stage_6 / iteration_2
VideoType 覆盖：15 / 15
专业纵向管线/质量评估器/修订计划器：15 / 15
专业文本包通过：0 / 15
内部固定项目规格/失败 fixture：75 / 45
Stage 6 多轮修订项目规格：15
计划修订轮次：30
blocked / Round 1 可执行：15 / 0
完成两轮真实修订项目：0 / 15
已验证真实修订轮次：0
固定真实模型项目：0 / 75
真人盲评通过：0 / 45
黄金素材卡人工通过：0 / 75
硬门槛失败片型：15
professional_text_creation_progress：40%
```

40% 没有因内部合同、fixture 或准备态上涨，这是正确结果。

## 2. 本阶段完成内容

### 全片型专业文本能力

15 个片型均已实现 CreativeBrief、研究证据档案、事实与戏剧化边界、片型化结构、分场、对白或旁白、导演文本、交付文本、十维候选质量评分、硬门槛和定向修订计划。

最后完成的空间意境线包括：

- `scene_short`：空间身份、路线、动作触发、发现、时间层、声音和转场。
- `landscape_mood`：情绪命题、光线天气变化、构图停留、自然运动、自然声、极简文案和结尾留白。

所有机器评估固定 `professional_passed=false`。

### Stage 6 多轮修订合同

统一服务能够：

- 把各片型 Coverage 归一为六类动作集。
- 导入编剧编辑、导演、事实文化评审和用户桌读意见。
- 记录每轮修订前后哈希、分数变化、解决/新增/剩余问题。
- 强制正文或分场变化后重建 `scene_breakdown`、`sequence_beats`、`director_text_plan` 和 `delivery_text_package`。
- 区分真实模型、人工创作、simulation 和 fixture provenance。
- 阻止 simulation/fixture 获得真实修订信用。
- 只有两轮真实可追溯修订且桌读意见关闭后，才形成 Stage 6 退出候选；退出候选仍不等于专业通过。

### Stage 6 执行准备

已生成 15 项目、30 轮的 fail-closed 执行清单。每个项目都包含片型化 Round 1 / Round 2 Coverage 重点、必要输入输出、派生重建区段、三类桌读角色和逐项目阻断清单。

## 3. 关键文件

总纲与状态：

- `docs/story-agent-all-format-professional-text-creation-handoff-20260710.md`
- `docs/story-agent-integrated-execution-plan-20260710.md`
- `data/reports/story-agent-professional-text-capability-matrix.json`
- `data/reports/story-agent-professional-text-creation-progress.json`
- `docs/story-agent-professional-text-gap-report-20260710.md`

Stage 6：

- `web/server/src/services/professional-multi-round-revision-service.ts`
- `web/server/src/services/professional-multi-round-revision-execution-service.ts`
- `web/server/src/__tests__/professional-multi-round-revision.test.ts`
- `web/server/src/__tests__/professional-multi-round-revision-execution.test.ts`
- `data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json`
- `data/professional-benchmarks/all-format-stage6-iteration2-execution-manifest.json`
- `scripts/story-agent-multi-round-revision-execution-plan.mts`
- `docs/story-agent-multi-round-revision-stage6-iteration1-implementation-20260711.md`
- `docs/story-agent-multi-round-revision-stage6-iteration2-execution-preparation-20260711.md`

审计与治理：

- `scripts/story-agent-professional-text-stage0-audit.ts`
- `mcp-server/__tests__/professional-text-stage0-audit.test.ts`
- `scripts/story-agent-governance-dry-run.mjs`
- `data/reports/story-agent-version-checkpoint-20260710.json`

## 4. 外部阻断

15 个 Stage 6 项目当前均缺以下一项或多项：

1. 真实项目 ID。
2. 初始、schema 合法的 `ProfessionalTextPackage`。
3. 真实模型或人工创作者授权引用。
4. 两轮修订预算引用。
5. 编剧编辑身份。
6. 导演身份。
7. 事实文化评审身份。
8. 桌读排期或会议引用。

每轮还必须保存输出 ID、模型或作者、提示或简报版本、成本、桌读意见关闭和派生文本重建证据。

在上述输入不到位时，不应调用付费模型，不应把 fallback、fixture 或 simulation 当作真实项目，不应伪造评审、签署、成本或公共 artifact，也不应跳过 Stage 6 退出门槛。

## 5. 历史治理和工作区

- 827 个历史样本已采用可逆软归档并排除签收，没有物理删除。
- 99 个断链候选进入人工复核队列；安全自动恢复为 0，猜测补链为 0。
- 目标 AI 漫剧项目仍有 5 个本地验收 URL，真实公共 artifact 为 0。
- 治理检查点识别 291 个变更文件：27 个已跟踪修改、264 个未跟踪文件。
- 当前暂存文件为 0，未提交、未推送。

新对话必须保留 dirty worktree，不得使用破坏性 reset 或覆盖已有改动。

## 6. 验证基线

```text
Web Server：61 个测试文件、711 个用例通过
MCP Server：79 个测试文件、345 个用例通过
MCP TypeScript build：通过
Web copy audit + Server/Client 类型检查：通过
知识库 lint：34 个省份文件、169 条条目、169 条增强条目通过
Stage 6 执行清单检查：通过
专业文本审计检查：通过
治理检查：通过
git diff --check：通过
```

前端地址：`http://localhost:5173/story/new`，最近检查返回 200。

## 7. 下一阶段开发计划

### P0：Stage 6 真实输入接入面

目标：把外部输入变成可验证、可持久化、可审计的 intake。

1. 为真实项目 ID、初始专业文本包、授权、预算、评审者和桌读排期建立统一 schema。
2. 实现导入验证器和逐项目 readiness 报告。
3. 提供 operator 可填写的 JSON 模板和错误清单。
4. 阻止不存在的文件、重复项目 ID、匿名评审者和未验证授权。
5. 保持 readiness 不计真实修订完成。

验收：15 个项目均产生确定的 `ready` 或结构化 `blocked` 结果，不猜测补齐。

### P1：Stage 6 修订批次执行器

1. 提供 Round 1 / Round 2 opt-in 执行命令。
2. 保存不可变初稿、修订稿、Coverage、桌读反馈和成本 artifact。
3. 校验前后哈希和 provenance 全链。
4. 修改正文或分场后自动重建派生文本。
5. 支持失败重试、部分完成和恢复。

验收：缺授权、预算、初始包或评审者时 fail closed；真实执行保留完整审计链。

### P2：桌读与版本差异产品面

1. 六类 Coverage 面板。
2. 桌读反馈录入、分配、关闭和重开。
3. Round 0 / 1 / 2 文本差异与十维质量变化。
4. 派生文本重建状态提示。
5. 真实证据、simulation 和 fixture 的醒目标识。

验收：UI 不允许将机器候选、准备态或 fixture 显示为专业通过。

### P3：执行真实两轮修订

前置条件：P0、P1、P2 完成，且外部授权、预算、真实项目和三类评审者到位。

- 15 个片型各至少 1 个真实项目。
- 每项目至少两轮，共至少 30 个验证轮次。
- 每轮保存质量增量、桌读关闭和派生重建证据。
- 完成 Stage 6 退出审核，但不自动升级为专业通过。

### P4：仓库整理与分批提交

在不覆盖用户改动的前提下，按以下批次人工复核：

1. 共享合同、Story Agent 核心服务与测试。
2. 15片型专业管线及 benchmark。
3. Stage 6 多轮修订合同、执行清单与测试。
4. 生产卡、文档和长期蓝图。
5. 历史治理 manifest 与报告。

不要一次性把291个文件混成不可审查的大提交；每批提交前重新运行对应测试和最终全量验证。

## 8. 新对话启动指令

复制以下内容作为新对话首条消息：

> 阅读 `docs/story-agent-stage6-new-conversation-handoff-20260711.md`、`docs/story-agent-all-format-professional-text-creation-handoff-20260710.md` 和 `docs/story-agent-integrated-execution-plan-20260710.md`，继续推进 Story Agent。
>
> 从 P0“Stage 6 真实输入接入面”开始：实现15项目真实ID、初始 ProfessionalTextPackage、创作授权、预算、三类评审者和桌读排期的统一 schema、导入验证器、operator JSON模板及逐项目 readiness 报告。
>
> 不调用付费模型，不修改现有默认生成行为，不把 fixture、simulation、fallback、准备态或技术就绪计为真实修订或专业通过；保留当前 dirty worktree，不覆盖已有改动。完成后按总纲指标汇报，并保持前端 `http://localhost:5173/story/new` 可访问。
