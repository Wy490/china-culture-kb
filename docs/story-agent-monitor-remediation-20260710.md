# Story Agent 项目监控审查处理报告

处理日期：2026-07-10

状态：monitor_findings_triaged_and_readiness_semantics_hardened

## 1. 处理范围

本报告处理以下三项监控发现：

1. 未跟踪的 real-submission、external-adapter、production-cards、测试和文档成果。
2. `web/generated/ai-comic-series-projects` 中历史 `seedance-job-failed` 记录。
3. `20260702-story-5zhd4151f8c7--ai_comic_drama` 中的 `local.story-agent.invalid` URL。

本轮没有删除或改写历史 generated 项目，没有连接真实 GEARS/Seedance，没有读取秘密值，也没有执行 git stage/commit。

## 2. 未跟踪成果核对

监控界面显示 36 个未跟踪条目，是因为 Git 将未跟踪目录折叠显示。使用 `git ls-files --others --exclude-standard` 展开后，审查输入批次实际为 116 个文件：

| 分类 | 文件数 | 处理判断 |
|---|---:|---|
| `data/production-cards` | 29 | 应纳入版本控制 |
| `docs/production-cards` | 52 | 应纳入版本控制 |
| `mcp-server/__tests__` | 27 | 应与对应实现一起纳入 |
| `mcp-server/src/lib` | 4 | 应纳入版本控制 |
| Phase 2 候选、长期状态和蓝图 | 3 | 应纳入版本控制 |
| 全片型专业文本创作交接总纲 | 1 | 应纳入版本控制 |

核对结果：

- 116 个文件均非空。
- 未发现 `web/generated`、`.env`、秘密文件或媒体产物进入这批未跟踪成果。
- 正式 `data/domain-packs/china-culture.json` 和 `data/provinces/*.md` 没有被本批次修改。
- 代码、数据、文档和测试互相引用，属于完整开发成果，不应继续长期停留在未跟踪状态。

建议按四个逻辑提交拆分，但必须由用户明确要求后再执行：

1. 黄金素材卡、统一索引和三片型回归。
2. Domain Pack 审稿、证据、签署、Patch 隔离和外部执行生产卡。
3. real-submission / external-adapter 实现与回归测试。
4. 长期状态、开发蓝图和全片型专业创作交接文档。

## 3. 历史 Seedance 失败清点

只读 generated health 和本地结构扫描结果：

| 指标 | 数量 |
|---|---:|
| AI 漫剧系列项目 | 927 |
| generated governance 关注项目 | 927 |
| interrupted 项目 | 926 |
| 建议归档或按新合同重建的 fixture-like 项目 | 827 |
| 有生产合同证据但缺故事引用的 relink 候选 | 99 |
| 需要修复命令层合同的生产缺口 | 1 |
| 含 `seedance-job-failed` 历史标记的项目文件 | 89 |
| 当前生产账本含 failed item 的项目 | 87 |
| 当前生产账本 failed item | 91 |
| 明确测试标记的 failed item | 91 |
| `seedance-job-failed` 对象级历史出现次数 | 175 |

失败特征：

- 时间集中在 2026-06-16 至 2026-06-19。
- 失败原因为“人物手部变形”或“测试标记超时失败”。
- 91 个当前 failed item 全部含“测试标记”证据。
- 示例记录含 `provider_job_id=seedance-job-failed`、`notes=测试标记失败`。

结论：

- 这批记录是历史 acceptance / regression 测试样本，不是本轮新增，也不应计入真实 Seedance 交付失败率。
- 827 个无生产合同证据项目应从 GEARS signoff portfolio 排除，后续由操作员选择归档或按现合同重建。
- 99 个 relink 候选不能直接归档，应先恢复缺失 story JSON 或重写到现存 story ID。
- 本轮不自动归档或重写任何历史项目，避免破坏仍有合同证据的样本。

## 4. `local.story-agent.invalid` 核对

目标项目：`20260702-story-5zhd4151f8c7--ai_comic_drama`

核对结果：

- 5 个 GEARS job 使用 `https://local.story-agent.invalid/gears-acceptance/...`。
- 每个 local artifact 都有 `role=local_acceptance`。
- 每个 local artifact 都有 `metadata.not_external_provider_output=true`。
- 项目当前真实外部 artifact 数为 0。
- 本地验收 ready 数为 5。
- 缺真实外部 artifact 的 ready job 数为 5。

该域名是刻意不可访问的本地验收保留域，不是 URL 替换故障。它用于证明账本、回调和版本链路能工作，同时保证本地样本不会被误当成真实媒体。

监控发现的真实问题是 readiness 语义：MCP fallback 和 Web GEARS lane 过去可能在所有 job 都是 local acceptance 时显示 `ready`，容易被误解为外部制作完成。

本轮修复后：

- `external_ready_gears_job_count=0`
- `local_acceptance_ready_gears_job_count=5`
- `ready_without_external_gears_artifact_count=5`
- GEARS lane 状态为 `needs_action`
- GEARS lane 分数为 65
- 下一步包含 `export_gears_external_callback_handoff`
- Commercial Workbench 只有在真实外部 artifact 齐全后才能进入 `ready`

本地验收 URL 仍会保留在历史账本中，直到真实回片安全导入并替换对应镜头；不应手工修改项目 JSON。

## 5. 代码处理

修改：

- `web/server/src/services/project-service.ts`
  - local acceptance 不再满足 GEARS 外部 ready。
  - GEARS 分数区分 external ready 和 local acceptance credit。
  - Commercial Workbench 要求真实外部 artifact 齐全。
- `mcp-server/src/tools/get-production-readiness.ts`
  - fallback readiness 新增 external/local/ready-without-external 三类计数。
  - local acceptance lane 降为 `needs_action`。
  - 新增真实回片交接包人工步骤。
- `mcp-server/src/tools/get-generated-health.ts`
  - 新增历史 Seedance failed project、failed item、marker project 和 test fixture failure 计数。
  - 明确测试标记失败不得计入真实交付失败。
- 对应 Web 和 MCP 回归测试已补强。

## 6. 后续人工动作

仍需外部或用户明确授权后执行：

1. 将本批次成果按逻辑提交纳入版本控制。
2. 对 827 个 fixture-like 项目确定归档目录和保留策略。
3. 对 99 个 relink 候选逐项恢复引用，不做批量猜测修复。
4. 为目标项目提供真实 GEARS/Seedance artifact URL，运行 preflight 和 safe import。
5. 真实回片后重新运行 readiness，验收 external ready 上升、ready without external 下降。

## 7. 第二轮处置复核

用户要求继续处理后，本轮补充完成以下动作：

1. Web `story-agent-generated-health` 已与 MCP 侧统计口径对齐，新增 Seedance failed、failure marker 和显式测试样本计数，避免 Web/API 监控丢失这组分类。
2. 新增只读审计脚本 `scripts/story-agent-monitor-remediation.mjs`，并生成完整治理队列 `data/reports/story-agent-monitor-remediation-queue-20260710.json`。
3. 新增 `scripts/export-story-agent-gears-handoff.ts`，为目标项目导出真实外部回片交接包：
   - `web/generated/projects/20260702-story-5zhd4151f8c7--ai_comic_drama/production-board/gears-external-callback-handoff.json`
   - `web/generated/projects/20260702-story-5zhd4151f8c7--ai_comic_drama/production-board/gears-external-callback-handoff.md`

完整队列复核结果：

| 指标 | 数量 |
|---|---:|
| 扫描 AI 漫剧系列项目 | 927 |
| 引用断裂项目 | 926 |
| relink 候选 | 99 |
| 可安全自动恢复 | 0 |
| 同后缀、不同日期的人工核对线索 | 9 |
| archive/rebuild 候选 | 827 |
| 缺失 story 引用 | 1126 |
| 唯一缺失 story ID | 406 |
| 被多个项目复用的缺失 story ID | 149 |
| 当前 failed item | 91 |
| 显式测试标记 failed item | 91 |
| 未标记 failed item | 0 |

99 个 relink 候选没有任何一项同时满足“当前 story 文件存在”或“项目内含对应完整故事快照”的安全恢复条件，因此没有批量猜测改写引用。9 个候选只有随机后缀相同、日期不同；必须继续核对剧集编号、文本、场景和连续性账本，不能仅凭后缀自动 relink。

目标项目交接包复核结果：

- `pending_external_artifact_count=5`
- `local_acceptance_ready_count=5`
- `external_ready_count=0`
- `ready_without_external_gears_artifact_count=5`
- 项目 readiness 与 GEARS lane 均保持 `needs_action`

本轮仍未连接外部 GEARS/Seedance、未导入真实 callback、未改写 926 个历史项目、未修改正式 Domain Pack 或省份知识库。审查批次原有 116 个未跟踪成果，加第一轮报告、两份复用脚本和完整队列后为 120 个未跟踪文件；均未暂存、未提交。
