# Story Agent 知识合同 M1 技术规格与迁移审计（2026-07-31）

## 1. 状态

- 阶段：M1 完成
- M1 进度：100%
- 专项总进度：30%
- 当前行为：只读合同、旧条目适配、迁移审计、人工证据 Overlay、缺口任务投影与可选 preparation 旁路
- 未接入：StoryBlueprint 消费、prompt、fallback、quality、repair、项目持久化、API、MCP

本切片新增 `story-knowledge-contract/v1`，用于在不改写
`data/provinces/*.md`、不替换现有 `KnowledgePack` / `MaterialPack`、不改变生成结果的前提下，
建立 claim 级事实边界和结构化创作/制作素材合同。

## 2. 现有合同审计结论

现有能力已经覆盖：

- `KnowledgePack`：主条目、辅助条目、缺失需求和整体置信度；
- `MaterialPack`：项目素材、已确认事实、待核信息、创作空间和视觉资产；
- `MaterialSufficiencyReport`：故事、剧本、制作三个阶段的缺口；
- `KnowledgeSupplementTask`：知识、素材和生产字段的补充任务；
- `EntryDetail`：字符串来源、整体可信度、核验方法和待核实点。

缺口是：

- 来源尚未映射到具体 claim；
- 来源没有统一的 A/B/C/D 分级；
- 整体可信度不能证明某个关键事实；
- 争议版本、未知项和可戏剧化空间尚未形成稳定合同；
- 人物目标、压力、选择、后果和可见事件缺少结构化字段；
- 空间、流程、声音、采访、档案和权利许可仍不完整。

因此 M1 采用旁路新合同，不直接扩写旧 `KnowledgePack`，避免破坏已经稳定的生成链。

## 3. `story-knowledge-contract/v1`

合同包含五部分：

1. `source_entry`：来源条目身份；
2. `sources`：来源引用、A/B/C/D/`ungraded` 等级和人工/机器/旧数据状态；
3. `claims`：关键事实、辅助事实、传说版本、争议或未知项；
4. `creative_affordance`：人物、压力、选择、可见事件、改编空间和禁写边界；
5. `production_material` / `missing_material`：生产素材及其显式缺口。

边界固定声明：

- `consumed_by_generation: false`
- `generated_content_writeback_allowed: false`
- `machine_validation_only: true`
- `human_review_complete: false`

### 3.1 关键事实硬门

关键事实只有同时满足以下条件才能使用 `usage: fact`：

- `claim_type: critical_fact`
- `certainty: verified`
- 至少关联一个 A 或 B 级来源；
- 该来源状态为 `human_verified`；
- 合同边界 `critical_facts_can_be_asserted` 与实际 claim 状态一致。

缺少任一条件时 schema fail closed。

### 3.2 旧来源处理

旧条目的 `sources: string[]` 不做启发式等级推断：

- 全部映射为 `grade: ungraded`；
- 全部映射为 `verification_status: legacy_unmapped`；
- 不自动生成 A/B 来源；
- 不因整体 `credibility` 较高而升级具体 claim；
- 产生 `claim_level_source_mapping` 和 `authoritative_source` 缺口。

这避免把“来源看起来权威”误当成已完成的人工 claim 级核验。

## 4. 兼容适配

`adaptLegacyChinaCultureEntryToStoryKnowledgeContract`：

- 深拷贝并冻结完整 `EntryDetail` 快照；
- 保留所有旧字段，不修改调用方对象；
- 把条目摘要映射为 `bounded_context`；
- 把每个 `unverifiedPoint` 映射为 `disputed_or_unknown + blocked`；
- 只从现有 `asset_split`、地点和地方化关系派生制作/创作字段；
- 不从故事正文推断新事实、人物动机或权利结论；
- 返回 mapping report，说明来源、claim、关键事实与缺口数量。

现有省级 Markdown、旧 `KnowledgePack`、`MaterialPack` 和生成结果保持兼容。

### 4.1 `story-knowledge-evidence-overlay/v1`

人工证据 Overlay 使用稳定的 `entry_name`、`claim_id` 和 `source_ref_id` 对基础合同做旁路补充：

- source review 只能给出 A/B/C/D 分级，不允许把机器映射伪装成人工核验；
- `human_verified` 必须包含核验时间，且 Overlay 必须由 `fact_culture_reviewer` 明确签收；
- pending / rejected 状态不得包含人工核验来源，也不得把 claim 提升为 `fact`；
- 关键事实提升必须在同一个 Overlay 中显式引用经过人工核验的 A/B 来源；
- 重复 source review、重复 claim mapping、未知条目/source/claim 引用全部 fail closed；
- assembly 深拷贝并冻结结果，不修改基础合同和旧知识条目；
- Overlay 与 assembly 均显式声明不进入生成、不写回 Markdown、不修改旧补充任务。

机器可以提出 A-D 等级候选和 `bounded_context` 映射，但在人工签收前
`critical_facts_can_be_asserted` 必须保持关闭。

### 4.2 缺口补充任务只读投影

`projectStoryKnowledgeMissingMaterialToSupplementTasks` 把现有 `missing_material`
转换为新的 `KnowledgeSupplementTask` 视图：

- source 固定为 `story_knowledge_contract_missing_material`；
- claim/source 证据缺口进入 `minimum_viable_story`；
- 创作可供性缺口进入 `script_ready`；
- 制作素材和权利许可缺口进入 `production_ready`；
- 输出深冻结，只返回新任务集合；
- `persistence_allowed: false`；
- 不读取、合并或修改已有项目补充任务。

前端仅补充该来源的穷举显示名称；现有 API 来源过滤器和项目持久化没有接入此来源。

### 4.3 Overlay 维护、版本与 preparation 决策

M1 的 Overlay 内容策略固定为：

- `data/fixtures/` 只保存纯合成、可复现的合同测试样例；
- 真实 Overlay 后续只能进入独立的 `data/story-knowledge-overlays/` 审核区，
  不写进省级 Markdown，不与机器报告混放；
- approved Overlay 必须使用新的稳定 `overlay_id` 追加版本，不得静默覆盖已签收版本；
- 真实 `reviewed_by`、审核责任、来源证据和变更说明必须由后续人工审核流程提供；
- 机器生成、fixture、单元测试和 schema 通过均不得授予真实人工审核信用；
- 生成内容永远不得反向更新 Overlay。

M1 允许 preparation 通过内部第二参数显式启用只读旁路，但不扩展公开
`StoryGenerateRequest`、API 或 MCP：

| 状态 | 行为 |
| --- | --- |
| 未启用 | 返回形状与既有 preparation 完全一致 |
| `base_contract_only` | 缺少 Overlay，返回旧条目基础合同 |
| `overlay_pending` | 接受机器候选的受限映射，关键事实保持关闭 |
| `overlay_approved_read_only` | 验证人工 A/B 开闸路径，但仍不进入蓝图或生成 |
| `overlay_rejected` | 忽略 Overlay 修改，退回基础合同 |
| `overlay_incompatible` | 版本、schema 或稳定引用不兼容，退回基础合同并记录问题 |

所有启用状态固定声明：

- `consumed_by_blueprint: false`
- `consumed_by_prompt: false`
- `consumed_by_fallback: false`
- `persistence_allowed: false`
- `generation_output_changed: false`
- `real_human_review_credit_granted: false`

因此 M1 完成的是 preparation 的可观测旁路，不是知识合同的生成消费。消费、效果评测与
回滚属于后续受控阶段。

## 5. 全库迁移审计

机器报告：

`data/reports/story-agent-knowledge-contract-v1-audit.json`

审计结果：

| 指标 | 数量 |
| --- | ---: |
| 条目 | 262 |
| 有效合同 | 262 |
| 无效合同 | 0 |
| 来源 | 960 |
| 未分级来源 | 960 |
| Claim | 1355 |
| 被阻止的待核 Claim | 1093 |
| 可直接断言的关键事实 | 0 |
| 显式缺口 | 1309 |

缺口覆盖：

| 类别 | 条目数 |
| --- | ---: |
| Claim 级来源映射 | 262 |
| A/B 权威来源 | 262 |
| 创作可供性 | 261 |
| 制作素材 | 262 |
| 权利与许可 | 262 |

这些数字代表旧数据尚未迁移到新合同的内容工作量，不代表 262 个条目整体错误，也不代表
960 个来源都低质量。它们只是尚未经过统一 claim 级分级和人工签收。

## 6. 可复现命令

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web/server
npm run audit:story-knowledge-contract
npm run audit:story-knowledge-overlay-fixtures
```

两个脚本分别读取省级 Markdown 和合成 fixture，并写入 `data/reports/`；都不会写回知识条目。

沙箱环境下 `tsx` 可能因 IPC 管道权限出现 `listen EPERM`，此时需要以允许本地 IPC 的方式
运行同一命令，不应修改代码绕过审计。

## 7. 测试合同

当前定向测试覆盖：

- 缺少人工核验 A/B 来源的关键事实被拒绝；
- 满足 claim 级 A/B 证据的关键事实通过；
- 旧条目完整快照无损保留并冻结；
- 待核实点进入 blocked claim；
- `asset_split` 和地点只读映射；
- 输入对象不被修改；
- 新服务没有进入 preparation 或 prompt；
- 批量审计不虚构人工完成状态。
- Overlay 重复映射与缺少人工签收被拒绝；
- 条目、source 和 claim 的无效稳定引用被拒绝；
- 机器提出的 A 级候选仍只能作为受限上下文；
- 人工签收的 A/B claim 映射能够形成冻结的只读 assembly；
- 剩余缺口能够生成不持久化的新补充任务投影；
- Overlay 仅进入显式启用的只读 preparation 旁路，不进入 prompt、fallback 或 document persistence。
- preparation 默认关闭时返回形状完全不变；
- 显式启用后的五种状态都不改变 StoryBlueprint；
- rejected、版本不兼容和未知引用均退回未修改的基础合同；
- 合成 fixture 报告明确授予零真实人工审核信用。

2026-07-31 本切片验证结果：

- Overlay / knowledge contract / preparation 定向：4 个文件、22 个测试通过；
- Server 全量：196 个测试文件通过、1 个跳过；1618 个测试通过、2 个跳过；
- Server TypeScript：`tsc --noEmit` 与 scripts tsconfig 通过；
- Web：Server + Client production build 通过；
- Visible copy audit：9 个文件、17 项检查通过；
- Overlay fixture audit：pending / approved 两条合成路径及 6 项边界通过；
- `git diff --check` 通过。

这些是机器验证结果，不代表 262 个条目已经完成来源分级或人工复核。

## 8. M1 完成与下一阶段入口

M1 的类型、schema、旧条目适配、迁移审计、人工证据 Overlay、缺口投影、fixture、
降级合同和可选 preparation 旁路已完成。

进入 M2 前仍保持：

1. capability registry 三项能力全部关闭；
2. 知识 preparation 不被 StoryBlueprint、prompt、fallback、quality 或 repair 消费；
3. 真实 Overlay 审核区尚无人工批准内容；
4. 262 个正式条目的 960 个旧来源仍未完成统一人工分级。

下一切片从 M2 type-aware capability router 开始，先实现默认关闭、类型拒绝、稳定决策报告和
关闭状态基线，不在同一切片直接修改 prompt 或 fallback。

## 9. 回滚

当前两个切片都没有迁移或生成接入。回滚只需删除：

- 新共享类型和 schema；
- 知识合同、Overlay 和审计服务；
- 审计脚本与报告；
- 对应测试和本文档。

不需要修改省级 Markdown、项目文件或生成快照。
