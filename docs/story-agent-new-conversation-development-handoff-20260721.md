# Story Agent 新对话继续开发交接（2026-07-21）

> 用途：这是下一次 Codex 对话的第一入口。先读本文件，再按需查阅[完整开发计划与交接](./story-agent-next-stage-comprehensive-development-plan-and-handoff-20260720.md)。
>
> 当前结论：软件工程修复约 **99.1%**；面向市场级成片的内容与真实媒体链路约 **45%**。阶段 0～2 已完成，阶段 3 的 P0-1～P0-3 工程闭环、外部交付治理及逐身份正式生产完成计划已落地，但真实视觉定义、人工批准和生产资产仍为 0，不能将阶段 3 宣布完成。

## 0. 当前进度百分比（后续每轮必须汇报）

| 口径 | 当前进度 | 变化 | 说明 |
|---|---:|---:|---|
| 软件工程修复 | **99.1%** | 较本交接初始 98.8% 提升 0.3 个百分点 | 最近补齐视觉生产门禁、外部授权、实际费用、交付 manifest、结构化 readiness、lane 一致性及逐身份完成计划；仍需真实外部环境联合验收等收尾 |
| 市场级内容与真实媒体链路 | **45%** | 不变 | 正式项目的视觉定义、人工批准、真实资产、Provider 成片和 production credit 仍未产生 |
| 阶段 3 总进度 | **45% / 目标 60%** | 不变 | 工程工具已基本齐备，但阶段 DoD 包含用户确认与真实资产，不能用测试 fixture 抬升 |
| 本轮小切片 | **100%** | 新增完成 | 资产报告与 Studio 已统一输出“定义→批准→真实文件→production credit→Provider 成片”的逐身份完成计划 |

百分比规则：代码、测试、fixture、门禁和 dry-run 只增加“软件工程修复”进度；只有正式项目收到真实用户确认、合法资产、真人批准和可信 Provider 结果时，才增加“市场级内容与真实媒体链路”及阶段 3 总进度。

## 1. 一分钟接管信息

- 仓库：`/Users/wuyu/Desktop/china-culture-kb`
- 当前分支：`codex/story-agent-manifest-integrity-20260718`
- 交接时 HEAD：`4fadfb6b4385321e885d5f9a5b4465796e283b3e`
- 工作区：存在大量累计开发改动和用户成果，**不得 reset、checkout、clean、覆盖或丢弃**；开始前先执行只读检查。
- 当前真实项目：`20260720-series-ujl3atax`
- 项目标题：`皮影诡戏：守灯人`
- 前端入口：<http://localhost:5173/ai-comic-series/new?seriesProjectId=20260720-series-ujl3atax>
- 项目数据：`web/generated/ai-comic-series-projects/20260720-series-ujl3atax/project.json`
- 详细事实、阶段定义和历史记录：`docs/story-agent-next-stage-comprehensive-development-plan-and-handoff-20260720.md`

## 2. 当前真实状态

| 项目 | 当前状态 | 说明 |
|---|---:|---|
| 商业节拍门禁 | 20/20 | 机器门禁通过 |
| 已生成完整故事 | 3 集 | E1、E10、E20；不是 20 集全文全部生成 |
| 真人评审 | 已完成 | Reviewer ID：`a001`；用户已填写、导入并保存 |
| 七维评分 | 全部 4/5 | 钩子、人物、对白、推进、反转、结尾、文化可信度 |
| 真人评审门禁 | 通过 | overall=4、minimum=4、reviewer_count=1 |
| 稳定视觉身份 | 14 个 | 4 角色、4 服装、5 场景、1 道具 |
| 代表镜头身份覆盖 | 27/27 | E1、E10、E20 均为 100% |
| 已填写视觉定义 | 0/14 | 必须等待用户确认真实设定，不能猜填 |
| 已人工批准身份 | 0/14 | 只有完整定义通过校验后才能批准 |
| 真实生产资产 | 0 | 无真实图片、视频及合法来源证明 |
| production credit | 0 | 在真实资产和审批链完整前必须保持 0 |

真人盲评流程现已可用：导出匿名 Markdown、空白回执 JSON 和内部映射 JSON；评审人只填写回执 JSON；导入后复核并保存。用户已完成该流程，项目中记录的是实际评审结果，不是测试数据。

## 3. 已完成的主要开发工作

### 阶段 1：前提与文化事实保真

- 建立 premise contract、文化保真校验、失败闭锁和针对性修复链。
- 将生成故事、场景、连续性和版本证据串联，避免把故事产物写回知识库事实层。
- 关键测试已覆盖保存、复制、归档、连续性更新和质量门禁。

### 阶段 2：商业节拍与真人盲评

- 建立 20 集商业节拍、跨集差异化、首场重复检测等机器门禁。
- 建立匿名候选、内部映射、Reviewer 回执的可审计闭环。
- 修正前端交互：Markdown 只用于发送给评审人，导入步骤只选择已填写的 JSON；空白模板会给出明确引导，不再误导用户。
- 已保存真人评审 `a001` 的七维评分，项目门禁为通过。

### 阶段 3：视觉一致性（已完成两批工程切片，尚未完成阶段）

- 从 E1、E10、E20 抽取稳定视觉身份图谱，共 14 个身份。
- 27 个代表镜头均绑定至少一个稳定身份，试点集身份覆盖率为 100%。
- 已实现四类结构化定义：角色、服装、场景、道具。
- 已实现定义来源指纹、过期检测、人工批准和 fail-closed 校验。
- 前端可查看 14 个身份、编辑定义、检查准备度并执行人工批准。
- 未经确认的定义保持空白；没有真实资产时不伪造生产完成度。

## 4. 最近一次验证证据

交接前已通过：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web

npm test -w server -- src/__tests__/ai-comic-series-visual-bible.test.ts
# 2/2 passed

npm test -w server -- src/__tests__/outline-service.test.ts -t "saves and loads|copies, archives|updates continuity"
# 3 passed, 30 skipped

# Playwright: ai-comic-series-human-review-workflow.spec.ts
# 1/1 passed

npm run check
# passed

npm run build
# passed

git diff --check
# passed
```

另外已在真实项目上验证：

- 非法视觉批准请求返回 HTTP 400 / `VALIDATION_ERROR`，且项目数据没有被修改。
- 页面显示 14 个身份、0/14 ready、0/14 approved、0 production credit。
- 刷新后没有新增控制台错误；角色“沈砚”的编辑器可打开，定义不完整时批准按钮禁用。
- 未向正式项目写入任何伪造视觉定义。

## 5. 当前边界与风险

以下事项没有完成，下一轮不得误报：

- 14 个视觉身份尚无用户确认的正式定义，也未通过人工批准。
- 世界规则尚未形成“视觉符号—触发条件—来源指纹—人工批准—镜头绑定”的完整结构化闭环。
- 服装和道具尚需接入独立的真实资产引用类型与权利证明链。
- 没有真实图片、视频、GEARS 生产结果或 Seedance 成片。
- 缺少外部 Provider 的真实 endpoint、token、callback、预算和版权授权；在获得这些前不得擅自发起付费或外部生产。
- 阶段 3 当前仍按 45% 总进度口径计算；只有达到该阶段 DoD 后才能提升到 60%。
- 任何会改变内容指纹的故事修改，都必须让旧评审/旧批准进入 stale 状态并重新复核，不能静默沿用。

## 6. 下一轮开发优先级

### P0-1：补齐世界规则的视觉闭环

目标：把世界规则纳入与角色、服装、场景、道具同等严格的结构化来源和批准链。

最小交付：

1. 为世界规则定义稳定 ID、视觉符号、触发条件、来源证据/指纹、人工批准状态。
2. 将规则绑定到 E1、E10、E20 的代表镜头或 GEARS 段落。
3. 内容或来源变化后自动 stale；缺失或过期时 fail closed。
4. 先写失败测试，再做最小实现，最后跑定向测试、`check`、`build` 和 `git diff --check`。

### P0-2：扩展服装与道具的真实资产链

目标：让角色、服装、场景、道具四类身份都能挂接真实参考文件、权利证明和审核结果。

最小交付：

1. 在 Seedance/视觉资产库中增加独立的 costume、prop 引用类型，不借用 character/location 类型。
2. 记录真实文件、内容哈希、来源、授权/版权状态、审核状态和对应 identity ID。
3. 资产替换、定义变化或映射变化时让批准失效。
4. 没有真实文件和权利证明时，production credit 必须继续为 0。

### P0-3：完善前端引导与导出

- 用“待填写定义 → 校验 → 人工批准 → 绑定资产 → 生产就绪”的单向流程减少界面复杂度。
- 对缺项、过期、未批准、无权利证明分别给出明确中文提示。
- 导出可审计的视觉圣经/资产清单，确保稳定 ID、来源指纹和批准状态不丢失。
- 只有用户提供明确设定时，才指导其填写并批准 14 个定义；开发过程中不得替用户猜填正式数据。

### 阶段 3 DoD

只有同时满足以下条件，才能把总进度从 45% 提升到 60%：

- 14 个身份均有经用户确认的完整结构化定义和稳定来源指纹。
- 世界规则视觉闭环完成，并绑定 E1、E10、E20。
- 四类身份均支持真实资产、权利证明和审核链。
- 定义、规则或资产变化均能可靠触发 stale，所有生产入口 fail closed。
- 试点集能生成可审计、可复现的视觉圣经和资产清单。
- 定向测试、类型检查、构建和差异检查全部通过。

## 7. 重点代码地图

| 作用 | 文件 |
|---|---|
| 视觉身份图谱、定义、批准 | `web/server/src/services/ai-comic-series-visual-bible-service.ts` |
| AI 漫剧项目主服务 | `web/server/src/services/ai-comic-series-service.ts` |
| 项目与批准 API | `web/server/src/routes/outline.ts` |
| 共享类型 | `web/shared/types.ts` |
| 输入/输出校验 | `web/shared/schemas.ts` |
| 前端 API | `web/client/src/api/stories.ts` |
| AI 漫剧工作台 | `web/client/src/views/AiComicSeriesStudio.vue` |
| 视觉圣经测试 | `web/server/src/__tests__/ai-comic-series-visual-bible.test.ts` |
| 项目服务回归测试 | `web/server/src/__tests__/outline-service.test.ts` |
| 真人评审 E2E | `web/e2e/ai-comic-series-human-review-workflow.spec.ts` |

开始修改前应先查找仓库内的 `AGENTS.md`，并完整阅读本项目技能：

- `.codex/skills/china-culture-story-agent/SKILL.md`
- `.codex/skills/china-culture-story-agent/references/story-agent-contract.md`

如进入 GEARS/Seedance 生产交付，再读取：

- `.codex/skills/gears-seedance-delivery/SKILL.md`

## 8. 新对话启动步骤

```bash
cd /Users/wuyu/Desktop/china-culture-kb

# 只读确认现场；不要清理工作区
git status --short
git branch --show-current
git rev-parse HEAD

# 阅读本交接与完整计划
sed -n '1,260p' docs/story-agent-new-conversation-development-handoff-20260721.md
sed -n '1,260p' docs/story-agent-next-stage-comprehensive-development-plan-and-handoff-20260720.md

# 确认项目数据
rg -n '"project_id"|"human_review"|"visual_bible"|"production_credit"' \
  web/generated/ai-comic-series-projects/20260720-series-ujl3atax/project.json
```

如本地服务未运行：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web
npm run dev
```

然后打开：

<http://localhost:5173/ai-comic-series/new?seriesProjectId=20260720-series-ujl3atax>

不要因为看到 `localhost:5173` 就假设服务一定健康；先探测页面/API，必要时再重启，避免重复启动多个进程。

## 9. 不可突破的约束

- 不清理、不回滚、不覆盖当前 dirty workspace，不触碰无关用户改动。
- 不把故事生成物、评审意见或视觉设计反写成知识库事实。
- 不伪造 Reviewer、评分、视觉定义、图片、视频、授权证明或 GEARS 成功结果。
- 不用机器分冒充真人评审，不用“已保存”冒充“已生产”。
- 不在缺失完整定义、来源指纹、人工批准或真实资产时放行生产。
- 不在缺少 endpoint、token、callback、预算和版权授权时调用真实外部 Provider。
- 实现顺序保持：失败测试 → 最小实现 → 定向测试 → `npm run check` → `npm run build` → `git diff --check`。

## 10. 可直接粘贴到新对话的指令

```text
请继续推进 /Users/wuyu/Desktop/china-culture-kb 的 Story Agent 开发。

先完整阅读：
1. /Users/wuyu/Desktop/china-culture-kb/docs/story-agent-new-conversation-development-handoff-20260721.md
2. /Users/wuyu/Desktop/china-culture-kb/docs/story-agent-next-stage-comprehensive-development-plan-and-handoff-20260720.md
3. /Users/wuyu/Desktop/china-culture-kb/.codex/skills/china-culture-story-agent/SKILL.md
4. /Users/wuyu/Desktop/china-culture-kb/.codex/skills/china-culture-story-agent/references/story-agent-contract.md

当前正式项目是 20260720-series-ujl3atax（《皮影诡戏：守灯人》）。真人评审 a001 已完成并通过；E1/E10/E20 已建立 14 个稳定视觉身份和 27/27 镜头覆盖，但正式视觉定义、人工批准、真实资产和 production credit 均为 0。

保护现有 dirty workspace，禁止 reset/checkout/clean 或覆盖用户改动。先做只读现场核验，再从交接文档的 P0-1 开始：用 TDD 补齐世界规则的视觉符号、触发条件、来源指纹、人工批准、stale 和 E1/E10/E20 绑定闭环；随后推进 costume/prop 独立真实资产引用和权利证明链。不得猜填正式项目数据，不得伪造外部生产成功。

每一批都要给出：改动文件、真实测试结果、项目数据是否发生变化、当前进度、未完成边界和下一步。只要安全且在范围内，就直接实现，不要停留在计划层。
```

## 11. 下一轮汇报格式

每次阶段性完成后，按以下五项汇报即可：

1. **完成内容**：本轮真正落地的能力。
2. **改动范围**：具体文件和接口。
3. **验证证据**：通过的测试、类型检查、构建和真实页面/API 结果。
4. **真实数据影响**：是否修改正式项目；若修改，写明字段和原因。
5. **剩余边界**：哪些仍是 0、哪些需要用户确认或外部凭据、下一批从哪里开始。

## 12. P0-1 世界规则视觉闭环实施记录（2026-07-21）

本批已完成世界规则视觉闭环的工程实现，阶段 3 总进度仍保持 **45%**：正式项目没有填写视觉符号、触发条件、代表镜头/GEARS 段、Reviewer 或批准结果，不能把代码能力误报为视觉生产完成。

- 世界规则现有独立的结构化字段（视觉符号、触发条件、补充说明）、来源故事快照指纹、真人审批状态和 E1/E10/E20 代表目标绑定；每个目标只能是该集实际存在的 Seedance `shot_id` 或 GEARS `segment_id`。
- 保存和批准接口会重新读取故事快照核验目标；缺字段、缺任何 Pilot 集绑定、过期来源指纹、重复集绑定或不存在的目标都会 fail closed。规则文本或代表故事快照变化后，已有审批自动标为 `stale`；快照替换也会使旧绑定失效。
- Studio 已增加“填写世界规则视觉映射与审批”单向编辑器，明确提示不能将机器推断或 placeholder 当作正式事实，并在字段、三集绑定、Reviewer ID、复核说明或真人确认未齐时禁用批准。
- Bible/Seedance 素材报告及 Markdown 导出已显示世界规则定义、审批、E1/E10/E20 覆盖与缺口。当前正式项目的两条原创世界规则仍应显示为待补、待绑定、待审批。

本批验证证据：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web

npm test -w server -- src/__tests__/ai-comic-series-visual-bible.test.ts
# 3/3 passed

npm test -w server -- src/__tests__/outline-service.test.ts -t "requires verified E1/E2/E3 world-rule targets"
# 1 passed, 33 skipped

npm run check
# passed

npm run build
# passed

npx playwright test --config playwright.config.ts e2e/ai-comic-series-human-review-workflow.spec.ts
# 1/1 passed

git diff --check
# passed
```

真实数据影响：未修改 `20260720-series-ujl3atax` 的正式视觉定义、世界规则映射、审批、资产或 production credit；仍分别为待填写/0/0/0。下一批从 **P0-2：服装与道具的独立真实资产引用及权利证明链** 开始。

## 13. P0-2 四类视觉身份的真实资产链实施记录（2026-07-21）

本批完成 P0-2 的工程闭环，阶段 3 总进度仍保持 **45%**。这是资产库和审核能力，不是正式图片、授权或生产结果；正式项目的真实生产资产和 production credit 仍为 **0**。

- Seedance 系列资产库现有独立的 `character`、`costume`、`location`、`prop` 类型；服装和道具不再伪装为人物或场景。每项可持久记录本地真实文件、SHA-256、来源、授权依据、真人媒体审核，以及稳定 identity ID、来源指纹、视觉定义指纹和身份映射审核结果。
- 上传或外部回调替换素材会重置权利/媒体审核，并将既有身份映射标为 `stale`。重新映射、改标签/类型、或编辑视觉定义也会使映射审核失效；显式重建和定义保存会把失效状态写回资产库。导出时还会按当前指纹再次 fail closed，避免旧数据被静默沿用。
- `production credit` 现在要求：本地不可变文件与 SHA-256、授权状态、真人媒体审核、已批准的稳定视觉定义，以及与该定义的当前已批准映射同时成立。外部 URL、placeholder、缺授权、缺审核、过期映射或正式定义未批准都不能计入信用。
- Seedance 资产报告和 Studio 已列出服装/道具独立卡片；上传会携带稳定 identity ID，界面显示“身份映射”状态。审核员仍须填写授权依据和审核意见；若正式视觉定义尚未批准，界面和 API 都维持 production credit=0。

本批验证证据：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web

npm test -w server -- src/__tests__/ai-comic-series-visual-bible.test.ts
# 4/4 passed（包含服装/道具当前定义映射与定义变更失效）

npm test -w server -- src/__tests__/outline-service.test.ts -t "updates continuity ledger after generating an episode"
# 1 passed, 33 skipped（覆盖资产映射审批、替换后 stale 和服装/道具报告项）

npm run check
# passed

npm run build
# passed

npx playwright test --config playwright.config.ts e2e/ai-comic-series-human-review-workflow.spec.ts
# 1/1 passed

git diff --check
# passed
```

真实数据影响：未修改 `20260720-series-ujl3atax` 的视觉定义、资产、授权、审核或 production credit。仍需用户提供并确认 14 个真实视觉定义、真实文件及版权/授权依据；不得在缺少外部 Provider 凭据、预算和授权时调用生产。下一批进入 **P0-3：将“待定义 → 定义校验 → 人工批准 → 资产映射/审核 → 生产就绪”整理为更明确的前端单向引导，并导出完整可审计资产清单**。

## 14. P0-3 可审计资产清单导出切片（2026-07-21）

本小批将 Seedance 素材报告补成内部可审计清单：每项导出稳定 identity、映射审核状态、素材类型、文件 ID/完整 SHA-256、来源、授权状态与授权依据、真人审核状态与 Reviewer。服装和道具与人物、场景使用同一导出结构；缺少文件或证据时明确显示未上传/pending，而不是生成虚假成功记录。

验证：`outline-service` 的素材回归先断言报告缺少这些字段而失败，最小实现后验证已审核素材导出完整 SHA、授权依据、Reviewer 和 `approved` 映射，且 Markdown 包含原始 SHA；同时通过视觉圣经 4/4、`npm run check` 和 `npm run build`。正式项目未写入，production credit 仍为 0。

下一批可继续补齐 Studio 的“待定义 → 校验 → 人工批准 → 素材映射/审核 → 生产就绪”逐步引导；这不授权猜填 14 个正式定义，也不替代真实文件、版权或外部生产凭据。

## 15. P0-3 Studio 单向就绪引导切片（2026-07-21）

Studio 的视觉圣经顶部现显示五步、严格顺序的就绪路径：

1. 填写并校验身份/世界规则定义。
2. 真人批准定义与规则。
3. 为每个稳定身份绑定本地、SHA-256 已验证的真实文件。
4. 复核授权、真人媒体审核与当前 identity 映射。
5. 生产就绪（全部才可能得到 production credit）。

每步显示当前计数；第一个未完成的步骤标为“当前阻塞点”，后续步骤标为“需先完成前一步”。该引导只读取已保存证据，没有代填字段、自动批准、自动上传或改变 production credit。

验证：先在 Playwright 的 Studio fixture 中加入缺失引导的失败断言，实施后 `npx playwright test --config playwright.config.ts e2e/ai-comic-series-human-review-workflow.spec.ts` 为 1/1 通过；并再次通过视觉圣经 4/4、素材服务回归 1 passed/33 skipped、`npm run check`、`npm run build`。正式项目未修改，阶段 3 仍为 45%。

## 16. P0-3 外部生产视觉门禁切片（2026-07-21）

Studio 的五步指引现已接入服务端生产边界：任何 `use_gears_api: true` 的系列 GEARS 提交，以及任何 `use_provider_adapter: true` 的 Seedance retry 提交，都会在网络请求之前重建当前视觉 Bible 并 fail closed。

- 门禁要求稳定身份和世界规则定义完整、所有定义已由真人批准、试拍集身份/世界规则绑定无阻断，并且每个稳定身份都具备与当前定义指纹匹配的生产信用资产。
- 生产信用仍同时要求：本地真实文件、不可变 SHA-256、授权依据、真人媒体审核、已批准身份映射和已批准视觉定义。类型也须严格匹配，不能把角色文件当作服装/道具/场景信用。
- `production-readiness` 新增 `visual_asset_readiness` lane、`series-visual-production-gate` blocking issue 与人工动作 `complete_visual_asset_chain`。该动作标为人工复核，不能被自动化伪造完成；GEARS 自动化步骤也会被这条 blocking issue 阻止。
- `use_gears_api: false` 的本地 mock job/账本流程不受影响，仅作为开发验证，不代表外部媒体已生产。

验证：先让 readiness/外部 GEARS 回归断言缺失 lane 和缺失门禁而失败；实施后：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web

npm test -w server -- src/__tests__/outline-service.test.ts
# 34/34 passed；包含两条断言“网络请求前被视觉门禁阻断”的外部入口回归

npm test -w server -- src/__tests__/ai-comic-series-visual-bible.test.ts
# 4/4 passed

npm run check
# passed

npm run build
# passed

git diff --check
# passed
```

真实数据影响：未修改 `20260720-series-ujl3atax`。正式项目的 14 个稳定视觉身份、世界规则人工定义/批准、真实资产、授权和 production credit 仍分别保持既有待填/0 状态；本切片不产生图片、视频、Reviewer 或外部 Provider 成功记录。下一批可在已有门禁下补充一条**完全由测试 fixture 构造的已批准视觉链**外部 handoff 成功回归，或继续收紧正式项目外的生产/交付入口；两者都不得替代真实人工资料。

## 17. P0-3 外部入口对称授权与成功路径回归（2026-07-21）

补齐了两类与视觉门禁配套的交付保证，均仅在隔离测试 fixture 中执行模拟 HTTP，不调用真实 Provider：

- 新增成功路径回归：一个单集 fixture 在生成镜头后，把每个实际 Seedance 必需人物槽位纳入锁定身份；再逐项完成定义、真人批准、本地 SHA-256 文件、授权依据、真人媒体审核、当前 identity 映射和公开 HTTPS handoff URL。只有此完整链满足时，外部 GEARS adapter mock 才收到请求；回归已验证 capability + submit 两次模拟请求以及 `provider_asset_input_count`。
- `use_provider_adapter: true` 的 Seedance retry 现在也要求与 GEARS 相同的 `external_call_authorization`：明确 `authorized=true`、授权依据、非负预算与三位币种、数据传输确认。服务端会在读取项目、检查视觉链和调用网络前校验；API schema 同样在路由层 fail closed。
- 已把授权摘要写入 Seedance retry 结果 Markdown 和 Provider adapter payload，供外部 worker 审计；本地 `use_provider_adapter: false` 账本模拟保持可用。

验证：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web

npm test -w server -- src/__tests__/outline-service.test.ts
# 35/35 passed（含视觉链阻断、完整 fixture 放行和本地 mock 账本）

npm test -w server -- src/__tests__/api.test.ts -t "requires explicit authorization before accepting a Seedance provider retry request"
# 1 passed, 213 skipped

npm run check
# passed
```

真实数据影响：未修改 `20260720-series-ujl3atax`，没有真实 Provider 请求、费用、资产、Reviewer 或生产成功记录。正式项目仍必须由授权人员补齐真实资料并显式提供外部授权；`use_gears_api`/`use_provider_adapter` 不能绕过这些前置条件。

## 18. P0-3 Seedance 外部授权账本与 Studio 可追溯切片（2026-07-21）

外部调用授权不再只停留在请求校验和 Provider payload：GEARS Seedance 提交与直接 Seedance adapter 重试都会把标准化授权记录写入当前镜头生产项和对应视频版本。后续状态更新、外部回调、提示词重新导出和项目归一化会保留该记录；新的外部重试会替换当前镜头授权，但旧版本仍保留旧授权，形成可追溯的尝试历史。

Studio 的镜头生产账本现直接显示授权依据、最高预算、币种、数据传输确认和确认时间；每个视频版本同时显示其授权 reference。这样运营人员无需从瞬时 API 响应反查“哪次生成由谁授权、预算边界是什么”。

验证：`outline-service.test.ts` 35/35、`npm run check`、Studio Playwright 1/1 均通过。回归覆盖 GEARS 授权写入、失败状态保留、直接 Seedance 新授权替换、旧版本授权留存以及回调后授权不丢失。

真实数据影响：未修改 `20260720-series-ujl3atax`，未发起真实外部请求，也未生成费用或 production credit。当前记录的是“授权最高预算”，不是 Provider 实际费用；下一切片继续接入实际费用回执、累计预算边界与终态结算门禁。

## 19. P0-3 Seedance 实际费用结算与累计预算门禁（2026-07-21）

直接 Seedance callback 现支持成对回传 `actual_cost_amount` / `cost_currency`（同时兼容 camelCase）；金额接受非负数字或数字字符串，币种必须为三位大写代码，缺一项即在 API schema 和 service 两层 fail closed。费用记录写入当前镜头及对应视频版本，包含 Provider 回执时间、授权依据、授权上限、同授权累计实际费用和边界状态。

费用治理按 `authorization_reference` 聚合去重。同一次外部授权覆盖多个镜头时，不再逐镜错误地与整批预算比较：系统累计各 Provider job 的实际费用，再统一判定 `within_authorization`、`exceeded_authorization`、`currency_mismatch` 或 `authorization_missing`。延迟费用回执只更新同一视频版本，不制造重复版本；新外部重试会清空当前尝试的旧费用，但旧版本仍保留历史费用证据。若旧 Provider job 在新重试后迟到回调，服务只更新命中的历史版本，不能回滚当前 job、当前授权、当前费用或当前视频状态。

制作 readiness 新增两项阻断：终态已授权镜头缺实际费用时产生 `series-seedance-execution-cost-settlement-pending`；任何历史费用越界产生 `series-seedance-execution-cost-boundary-violated`。两者都会把 `shot_production` lane 置为 blocked；非 dry-run 的最终交付 API 也会在读取/写入成片之前硬阻断，即使调用方选择 tolerant dependency mode 也不能绕过费用边界。GEARS Seedance callback 已同步其费用记录到镜头账本，继续保留 GEARS 自身的独立成本审计。

Studio 镜头与版本列表现显示实际费用、币种、授权累计、边界结论和回执时间。隔离 fixture 回归覆盖：第一镜 1.25 CNY、第二镜 1.00 CNY、同一 2.00 CNY 授权累计为 2.25 CNY 后两镜均判定超预算；终态第二镜在费用回执前先被结算门禁阻断，回执后替换为越界阻断。

本批验证证据：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web

npm test -w server -- src/__tests__/outline-service.test.ts
# 35/35 passed

npm test -w server -- src/__tests__/api.test.ts -t "Seedance Production Callback API"
# 4 passed, 212 skipped

npm run check
# passed

npm run build
# passed

npx playwright test --config playwright.config.ts e2e/ai-comic-series-human-review-workflow.spec.ts
# 1/1 passed

git diff --check
# passed
```

真实数据影响：`20260720-series-ujl3atax` 不在修改清单中；只读检查未发现 `production_credit: true`、外部授权或费用记录。没有真实 Provider 网络请求或费用发生。正式项目只有收到可信 Provider 回执后才能写入实际费用，人工也不能把授权上限当作实际支出。

## 20. P0-3 最终交付 Manifest 费用治理快照（2026-07-21）

最终交付 manifest 现新增结构化 `cost_governance` 快照，并随 manifest 一起进入不可变 release archive 与 SHA-256 校验范围。快照包含 `not_applicable` / `clear` / `blocked` 状态、已授权镜头数、费用回执数、终态待结算数、越界数以及超预算、币种不符、缺授权的分项计数；`validation_notes` 同时写入一行可读结论。

这一补充不改变上一批的执行门禁：非 dry-run 仍在费用待结算或越界时直接拒绝，不能生成正式成片。dry-run 可以生成审计 manifest，但会明确记录 `blocked`，便于运营人员预检和归档问题证据；没有外部授权或费用的纯本地流程明确记录 `not_applicable`，不会伪称已经完成外部费用结算。

隔离回归覆盖两个边界：普通本地交付 manifest 的所有费用计数为 0、状态为 `not_applicable`；两镜共享 2.00 CNY 授权并累计至 2.25 CNY 的 fixture manifest 记录 `blocked`、2 个已授权镜头、3 条去重费用回执和 2 条越界执行记录。

验证：`outline-service.test.ts` 35/35、`npm run check`、`npm run build`、`git diff --check` 均通过。本切片没有前端变更，因此未重复运行上一批已通过且未受影响的 Playwright 场景。

真实数据影响：未修改 `20260720-series-ujl3atax`，没有真实 Provider 调用、费用、外部授权、release 或 production credit。Manifest 中的测试费用只存在于临时测试项目。

## 21. P0-3 Readiness 结构化 Seedance 费用治理合同（2026-07-21）

系列 `production-readiness` 响应现直接返回 `seedance_cost_governance`，复用最终交付 manifest 的同一结构：状态、已授权镜头数、去重费用回执数、终态待结算数、总越界数，以及超预算、币种不符、缺授权分项。自动化调用方和 Studio 后续无需再从中文 issue 文案或 lane evidence 中反解析费用状态。

Readiness Markdown 同步新增独立的 `Seedance Cost Governance` 章节，保证 JSON 和人读报告使用同一份聚合结果。现有 blocking issues、`shot_production` lane 降级和非 dry-run 最终交付硬门禁均保持不变。

隔离回归覆盖：普通本地 readiness 返回完整 `not_applicable` 零值对象；两镜共享授权并累计越界的 fixture 返回 `blocked`、2 个授权镜头、3 条去重费用回执、2 条超预算记录，且 Markdown 含独立费用治理章节。

验证：`outline-service.test.ts` 35/35、`npm run check`、`npm run build`、`git diff --check` 均通过。本切片只扩展服务端返回合同与报告，没有前端模板变更，未重复运行 Playwright。

真实数据影响：未修改 `20260720-series-ujl3atax`，没有真实 Provider 调用、费用、授权、release 或 production credit。

## 22. P0-3 费用阻断跨 Lane 一致性（2026-07-21）

系列 readiness 的费用治理阻断现同时作用于 `shot_production`、`delivery_contract` 和 `commercial_ops`。当 Seedance 存在终态待结算或任何历史费用越界时，三条 lane 均为 `blocked`；交付合同与商业运营不再保留可执行 action，而是明确提示“处理 Seedance 费用阻断”。这样避免总体 readiness 已阻断，但局部交付/商业 lane 仍显示可推进的矛盾状态。

隔离回归使用两镜共享 2.00 CNY 授权、累计实际费用 2.25 CNY 的 fixture，验证交付合同和商业运营 lane 同时 blocked，且原有镜头生产阻断、manifest 审计和非 dry-run 最终交付硬门禁保持不变。

验证：目标回归通过，`npm run check` 通过；随后执行受影响服务全量回归、构建和 `git diff --check`。本切片没有前端模板变更，不重复运行 Playwright。

进度：本轮小切片 **100%**；软件工程修复由交接初始 **98.8%** 调整为 **99.0%**。市场级内容与真实媒体链路仍为 **45%**，阶段 3 仍为 **45%/目标 60%**，原因是正式视觉定义、人工批准、真实资产与 production credit 均未增加。

真实数据影响：未修改 `20260720-series-ujl3atax`，没有真实 Provider 调用、费用、授权、release 或 production credit。

## 23. 正式生产逐身份完成计划（2026-07-21）

Seedance 素材报告现新增结构化 `completion_plan`，Studio 顶部的生产就绪引导直接读取同一合同，不再由前端重复猜测。计划严格按以下依赖顺序显示唯一“当前阻塞点”：

1. 视觉身份/世界规则定义与试拍集绑定。
2. 真人批准当前定义与规则。
3. 每个身份上传不可变的本地真实图片并生成 SHA-256。
4. 权利授权、真人媒体审核、当前身份映射全部通过，取得 production credit。
5. 获得显式外部调用授权后提交真实 Provider，并收齐每个镜头的 Provider job ID、`ready` 状态、视频 URL 和实际费用证据。

报告对 14 个身份逐一输出缺失字段、真实文件、授权、媒体审核、当前映射、production credit 和下一动作。Provider 成片计数额外要求显式外呼授权 + 真实 job ID + ready + video URL；Studio 的本地账本模拟、“批量完成”、fixture、dry-run、placeholder 或单独远程 URL 都不能抬高正式完成计数。

正式项目的操作顺序如下：

1. 在 Studio 打开 `20260720-series-ujl3atax`，先点“重建并保存图谱”。这是把旧格式的两条世界规则迁移为当前可编辑字段和来源指纹；不要绕过这一步直接批准旧数据。
2. 展开“查看稳定身份与待补字段”，按真实美术设定填写并先保存草稿。4 个角色（盗谱者、开发商、林灯、沈砚）各需年龄区间、体态、脸部特征、发型、性别/代词；4 套主服装各需主服装细节、色彩方案、阶段服装变化；5 个地点各需建筑/空间结构、主光源、材质与色彩；道具“灯”需形制/尺寸、材质与颜色、归属与状态变化。字段必须写可被画面复现的观察事实，不能只写“神秘”“高级”等抽象形容词。
3. 补齐两条世界规则“午夜皮影戏必须遵守二十条规则”和“违反规则会被抹去记忆”的视觉符号、触发条件，并为 E1、E10、E20 绑定真实 Seedance 镜头或 GEARS 段。规则也必须单独由真人批准。
4. 由具有 `review:operate` 权限、且不是 `local_bypass` 的真人审核员逐项复核。确认定义与项目来源一致后勾选真人确认、填写审核意见并批准。任何源设定或定义变更都会使旧批准 stale，必须重审。
5. 在“系列视觉资产”中为 14 个稳定身份分别上传真实图片。标签和类型必须与稳定身份精确一致；角色、服装、场景、道具不能互相冒充。建议保留原始母版及来源记录；上传成功后核对 `local_upload`、本地预览和 64 位 SHA-256。
6. 为每项资产填写真实授权依据，将 rights 设为 `authorized`；若涉及真人肖像，再附人物同意依据。审核员必须查看当前 SHA-256 对应的不可变文件，填写媒体审核意见并批准。此动作同时审核文件与当前视觉定义指纹的身份映射；14/14 全部通过后 production credit 才会到 14/14。
7. 为 Provider handoff 设置每项资产可访问的公网 HTTPS 或限时签名 URL；本地路径只用于完整性和审核，外部 Provider 无法直接读取。先导出 Seedance JSON/素材报告检查镜头数、引用槽与缺口；任何缺口保持阻断。
8. 在“生产操作”中走 GEARS 主路径，选择视频任务并使用“提交 GEARS … API”，填写最高成本和币种，在确认框中明确授权数据外传与本次预算。不要用本地提交、旧 Seedance 重试或“批量完成”冒充真实 Provider 执行。
9. 用“同步 GEARS 状态”或导入可信回调收齐每个镜头的 Provider job ID、ready、视频 URL；终态回调还必须带实际费用与币种。处理失败、超时、费用待结算、超预算或币种不符，直至完成计划的 Provider 成片计数等于所需镜头数。
10. 最后执行版本择优、剪辑装配、字幕/音频/片头片尾、非 dry-run 最终交付和 release manifest 校验。只有 manifest 的视觉、费用和交付门禁均 clear，才可宣布正式成片完成。

本批验证：`outline-service.test.ts` 35/35、Studio Playwright 1/1、`npm run check`、`npm run build`、`git diff --check` 均通过。正式项目文件只读检查时间戳仍为 `2026-07-21T02:50:43+0800`，资产 0、生产项 0、production credit 0；本批没有代填定义、代做人工批准、上传资产、调用 Provider 或产生费用。

进度：本轮切片 **100%**；软件工程修复 **99.1%**。市场级内容与真实媒体链路仍为 **45%**，阶段 3 仍为 **45%/目标 60%**。下一次真正提升后两项进度，必须从用户确认并保存 14 个正式视觉定义开始。
