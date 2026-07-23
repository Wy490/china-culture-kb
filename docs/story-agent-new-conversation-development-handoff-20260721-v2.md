# Story Agent 新对话继续开发交接（2026-07-23 · GEARS 无 API 四人物闭环版）

> 用途：新对话的第一入口。当前正式项目已完成 16/16 真人视觉批准，并已跑通 Visual Bible → GEARS → 四人物测试图片 → Story Agent 不可变媒体库的无 API 闭环。
>
> 先读本文件，再按需查阅[上一版交接](./story-agent-new-conversation-development-handoff-20260721.md)和[完整阶段计划](./story-agent-next-stage-comprehensive-development-plan-and-handoff-20260720.md)。上一版交接中“视觉定义 0/14”的状态已经过时，不得继续沿用。

## 0. 当前结论与进度百分比

以下综合百分比是项目管理估算；后面的原子计数来自正式项目 JSON，具有更高可信度。

| 口径 | 当前进度 | 说明 |
|---|---:|---|
| 软件工程修复 | **约 99.8%** | 视觉生产门禁、定义/批准/资产链、GEARS Workbench Bridge 和四人物无 API 图片回写闭环均已验证；仍缺真实图片 Provider 与真实 E1 试产 |
| 市场级内容与真实媒体链路 | **约 60%** | 真人商业盲评、16/16 视觉批准和四人物测试闭环已完成；14 份真实资产、production credit 与 Provider 成片仍为 0 |
| 阶段 3 视觉一致性 | **约 55% / 目标 60%** | 14 个身份、2 条规则、试拍集绑定和真人批准完整；已验证四人物链路，但测试件不计真实资产或 production credit |
| 本轮“多行编辑＋建议草稿”开发切片 | **100%** | 实现、类型检查、生产构建和正式页面验收全部完成 |
| 本轮“服务端视觉建议只读合同”切片 | **100%** | 身份/世界规则两个只读合同、审计元数据、非覆盖与零持久化回归均已完成 |
| 本轮“前端改接服务端建议”切片 | **100%** | 两类编辑器均调用服务端合同，移除前端重复模板，并完成非覆盖、撤销旧确认与 E2E 验证 |
| 本轮“下一个待复核项”切片 | **100%** | 身份与世界规则组成循环队列，逐项打开、单编辑器切换、滚动定位和零自动批准均已验证 |
| 本轮“审批缺项与失败保护”切片 | **100%** | 两类审批共享可执行缺项清单；来源过期和服务失败均保持本地草稿不变并有 E2E 证据 |
| 本轮“GEARS 无 API 四人物闭环”切片 | **100%** | 四人物 4/4、媒体 SHA、回写、预览、幂等重放及零生产信用均通过真实 HTTP 与浏览器验收 |

正式项目的精确进度：

| 生产环节 | 当前值 | 百分比 |
|---|---:|---:|
| 稳定视觉身份定义 | 14/14 | **100%** |
| 世界规则视觉定义 | 2/2 | **100%** |
| 世界规则试拍集绑定 | 6/6（2 条规则 × E1/E10/E20） | **100%** |
| 视觉定义合计 | 16/16 | **100%** |
| 真人视觉批准 | 16/16 | **100%** |
| 真实图片资产 | 0/14 | **0%** |
| Production credit | 0/14 | **0%** |
| 可计入正式完成度的 Provider 成片 | 0 | **0%** |
| GEARS 本地测试人物资产 | 4/4 | **100%（仅测试，不计真实资产）** |

百分比纪律：代码、测试、fixture、dry-run、本地账本和建议草稿不能增加真实资产、Provider 成片或 production credit；只有正式项目中的真实证据才能增加这些计数。

## 1. 一分钟接管信息

- 仓库：`/Users/wuyu/Desktop/china-culture-kb`
- 当前分支：`codex/story-agent-manifest-integrity-20260718`
- 本批累计开发的起点 HEAD：`4fadfb6b4385321e885d5f9a5b4465796e283b3e`
- 本轮已获用户授权提交并推送；接管时以 `git rev-parse HEAD`、`git status --short` 和远端分支为准，预期工作区干净。
- 正式项目 ID：`20260720-series-ujl3atax`
- 项目标题：《皮影诡戏：守灯人》
- 项目数据：`web/generated/ai-comic-series-projects/20260720-series-ujl3atax/project.json`
- 项目数据时间：`2026-07-23T05:28:10.748Z`
- 前端地址：<http://localhost:5173/ai-comic-series/new?seriesProjectId=20260720-series-ujl3atax>

工作区包含跨多轮开发成果和用户正式数据。禁止执行 `git reset --hard`、`git checkout --`、`git clean` 或其他会清除/覆盖现有改动的操作。修改前先检查重叠文件，暂存、提交、推送均需用户明确要求。

## 2. 正式项目当前事实

### 2.1 故事与商业质量

- 已生成完整故事：E1、E10、E20，共 3 集；不是 20 集全文全部完成。
- 商业机器门禁：通过，`machine_score=100`。
- 真人商业盲评：已完成，`reviewer_count=1`，Reviewer ID 为 `a001`。
- 七维评分总体平均：4/5；真人评审门禁通过。
- 代表集用于视觉/生产试点：E1、E10、E20。

### 2.2 视觉身份

14 个稳定视觉身份均为 `definition_status=ready`、`approval.status=approved`：

- 人物 4：盗谱者、开发商、林灯、沈砚。
- 主服装 4：盗谱者主服装、开发商主服装、林灯主服装、沈砚主服装。
- 地点 5：白幕与灯箱之间、午夜皮影戏台前场、熄灯后的戏台中央、戏台侧门与档案柜、戏台灯幕后。
- 道具 1：灯。

定义备注是可选字段。当前 4 个人物已有定义备注，其余 10 个身份备注为空，但不影响“结构化定义完整”状态。

### 2.3 世界规则

两条世界规则均为 `definition_status=ready`、`approval.status=approved`：

1. `midnight-shadow-play-rules`：午夜皮影戏必须遵守二十条规则。
2. `memory-erasure-consequence`：违反规则会被抹去记忆。

两条规则都已绑定 E1、E10、E20，共 6 条真实代表目标绑定。规则定义备注当前为空且为可选字段。

### 2.4 真实媒体与外部生产

- `seedance_asset_library.items=4`，均为 `provider=gears_local_test` 的四人物测试件。
- 四个测试件均有本地不可变 PNG、媒体 SHA-256、prompt SHA-256、GEARS character/version provenance 和当前人物 identity pending mapping。
- 测试件明确 `rights_status=pending`、`human_review_status=pending`，且 provider 不是 `local_upload`；因此不是真实图片资产，不能通过 production-credit 判定。
- `seedance_production.items=0`。
- `production_credit_identity_count=0`。
- 视觉 Bible 的定义与批准阻断已清零；当前唯一核心阻断是 14 份真实图片资产、授权、真人媒体审核和当前 identity mapping 批准尚未完成。
- 没有真实 Provider job、视频 URL、费用回执或正式 release。

## 3. 本轮完成的前端开发

用户反馈了三个问题：看不到“定义备注”、长内容只能单行填写、希望系统先填写再由人工审核。本轮已完成以下改进：

1. 人物、服装、地点、道具和世界规则的结构化字段全部改为可换行的多行文本框。
2. 身份备注明确显示为“定义备注（可选，跨集连续性）”。
3. 规则备注明确显示为“定义备注（可选，规则连续性）”。
4. 真人“复核说明”改为多行文本框。
5. Reviewer ID、Seedance `shot_id` 和 GEARS `segment_id` 仍保持单行；这些是标识符，不应改成多行。
6. 增加“填入系统建议（不覆盖已填）”按钮。
7. 系统建议只补空白字段，不覆盖人工已有内容，不自动保存，不自动批准，不增加 production credit。
8. 人物年龄、性别/代词等缺少可靠来源时不会被系统猜填，继续保留空白等待真人确认。
9. 每个编辑器明确显示流程：“系统建议草稿 → 人工复核 → 真人批准”。
10. 建议改变草稿后会撤销当前勾选的真人确认并清空复核说明，避免旧确认覆盖新内容。

当前建议由前端调用服务端确定性模板合同生成，用于降低空白表单成本，不是外部模型调用，也不代表已完成美术设计。前端会展示模板版本，并校验目标 ID、源指纹、`persisted=false` 与 `auto_approved=false`；合同不匹配时拒绝应用。后续如实现模型生成，必须继续保留“建议来源、模型/提示版本、生成时间、人工修改和批准”审计链，且仍不得自动批准。

## 4. 本轮改动文件

本轮直接修改：

- `web/client/src/views/AiComicSeriesStudio.vue`
  - 多行定义编辑器。
  - 明确的定义备注。
  - 非覆盖式系统建议草稿。
  - 人机审批边界提示及相关样式。
- `web/client/scripts/audit-visible-copy.mjs`
  - 增加流程文案、定义备注和非覆盖建议入口的静态契约检查。

注意：`AiComicSeriesStudio.vue` 在本轮开始前已有大量累计未提交改动。它相对 HEAD 的整体 diff 很大，不能把整个文件 diff 都当成本轮新增，也不能用回滚文件的方式提取本轮改动。

视觉生产链的主要累计代码地图：

| 作用 | 文件 |
|---|---|
| Studio 工作台 | `web/client/src/views/AiComicSeriesStudio.vue` |
| 前端 Story/Series API | `web/client/src/api/stories.ts` |
| 视觉 Bible、定义、批准 | `web/server/src/services/ai-comic-series-visual-bible-service.ts` |
| 系列主服务 | `web/server/src/services/ai-comic-series-service.ts` |
| 资产上传/库/审核 | `web/server/src/services/seedance-asset-*-service.ts` |
| 路由与 API 边界 | `web/server/src/routes/outline.ts` |
| 共享类型 | `web/shared/types.ts` |
| 共享校验 | `web/shared/schemas.ts` |
| 视觉 Bible 测试 | `web/server/src/__tests__/ai-comic-series-visual-bible.test.ts` |
| Series 回归 | `web/server/src/__tests__/outline-service.test.ts` |
| 真人评审与 Studio E2E | `web/e2e/ai-comic-series-human-review-workflow.spec.ts` |

## 5. 此前前端编辑体验验证证据

本轮仅修改前端编辑体验，因此按影响范围完成以下验证：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web/client

npm run audit:copy
# passed：9 files，14 required checks

npm run lint
# passed：vue-tsc --noEmit

npm run build
# passed：171 modules transformed，生产构建成功

cd /Users/wuyu/Desktop/china-culture-kb
git diff --check
# passed
```

正式项目浏览器验收结果：

- “盗谱者”编辑器：5 个结构化多行框；定义备注与复核说明也是多行。
- “记忆抹除规则”编辑器：2 个结构化多行框；定义备注与复核说明也是多行。
- Reviewer ID 和 3 个试拍集目标 ID 仍为单行。
- 点击建议按钮后，盗谱者已有内容完全未变化。
- 记忆抹除规则已有结构字段未变化，只在空白备注中生成未保存建议。
- 随后点击“取消”，测试建议没有写入正式项目。
- 页面仍显示身份批准 0/14、规则批准 0/2、production credit 0。

上一阶段完整服务端与 E2E 回归证据保存在上一版交接第 12～23 节。本轮没有改服务端合同，因此没有无意义地重复整个服务端全量套件。

## 6. 工作区保护与本批提交记录

本批提交前的现场检查记录：

- 分支为 `codex/story-agent-manifest-integrity-20260718`，累计开发起点为 `4fadfb6b...`。
- 提交前 `git status --porcelain` 共 51 项，暂存区为 0；包含多轮已修改文件和新文件。
- 用户已在 2026-07-22 明确要求提交并推送本批相关成果；提交后接管时预期工作区干净，以现场 Git 结果为准。

新对话开始时必须先执行：

```bash
cd /Users/wuyu/Desktop/china-culture-kb
git status --short
git branch --show-current
git rev-parse HEAD
git diff --cached --name-only
```

除非用户明确要求，不创建提交、不推送、不清理工作区。

## 7. 下一轮优先级

### P0-A：完成 14 份真实图片资产链

每个身份必须分别具备：

- 本地真实图片文件。
- 文件 SHA-256。
- 与身份类型一致的稳定 identity 映射。
- 真实来源与授权依据。
- 涉及真人时的人物同意依据。
- 真人媒体审核意见与批准。
- 与当前视觉定义指纹匹配的映射批准。

任何一项缺失时 production credit 必须保持 0。角色、服装、地点、道具不能互相冒充资产类型。

四人物的 GEARS 本地测试件已经证明接口、图片下载、SHA 校验、不可变入库和页面预览链路可用，但不得拿去登记授权或真人媒体批准。下一步应把同一合同切换到明确授权的真实图片 Provider，先完成四个人物真实资产，再依次完成四套服装、五个地点和一个道具。

### P0-B：真实 Provider 生产

只有 14/14 production credit 后才进入：

1. 配置真实 Provider/GEARS endpoint、token、callback secret。
2. 提供显式外呼授权、数据传输确认、最高预算和币种。
3. 为 Provider 提供可访问的 HTTPS/签名资产 URL；本地路径不能直接交给外部 Provider。
4. 提交真实任务并收齐 Provider job ID。
5. 回传 `ready`、视频 URL、实际费用和币种。
6. 处理超时、失败、待结算、超预算和币种不符。
7. 完成版本择优、剪辑、字幕、音频、片头片尾和非 dry-run 最终交付。
8. 校验 release manifest 的视觉、费用和交付门禁全部 clear。

未经用户明确授权，不得发起付费或向外部服务发送项目数据。

### P1：建议草稿的下一步工程化

当前建议是前端逐项调用服务端确定性模板。若继续开发自动化，推荐按以下顺序：

1. **已完成**：新增服务端“生成建议草稿”合同，返回草稿但不直接写入正式项目。
2. **已完成（当前确定性模板）**：记录 `suggestion_source`、模板版本、输入指纹和生成时间。
3. **已完成（单项前端链路）**：身份和世界规则编辑器改接服务端合同，移除前端重复模板。
4. 支持“为全部空白定义生成建议”，但绝不覆盖非空字段。
5. **已完成（前端应用建议时）**：建议内容变化后强制取消旧人工确认并清空旧复核说明。
6. **已完成**：保存草稿与批准继续使用两个独立动作。
7. **已完成**：来源变化 stale 和服务失败时拒绝改动本地草稿，并完成前端 E2E 回归。
8. **已完成**：批准按钮与可见缺项清单共用同一组条件，无真人确认、Reviewer ID 或复核说明时不可批准。

当前正式项目已 16/16 完整，因此 P1 不应阻塞 P0-A 真人批准。

## 8. 正式页面操作入口

如服务仍在运行，直接打开：

<http://localhost:5173/ai-comic-series/new?seriesProjectId=20260720-series-ujl3atax>

如服务未运行：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web
npm run dev
```

页面中依次使用：

1. “查看稳定身份与待补字段”。
2. 身份卡片的“填写与审批”。
3. “填写世界规则视觉映射与审批”。
4. “系列图片资产与审核”。
5. Production readiness/生产操作区域。

若看不到本轮新界面，先刷新一次页面。不要重复启动多个开发服务进程。

## 9. 不可突破的边界

- 不把系统建议当作已确认事实。
- 不让系统自动勾选真人确认或自动批准。
- 不用机器评分、模板、fixture 或 local bypass 冒充真人评审。
- 不伪造图片、版权授权、肖像同意、Provider job、视频 URL、费用或 production credit。
- 不用远程 URL 或 placeholder 冒充本地不可变文件和 SHA-256。
- 不在缺少明确外呼授权、预算和数据传输确认时调用外部 Provider。
- 不把故事生成物、评审意见或视觉设计写回知识库事实层。
- 内容、定义、资产或来源指纹变化后，旧批准必须 stale 并重新审核。
- 不清理、回滚、覆盖 dirty workspace。

## 10. 新对话建议启动指令

可将下面内容直接粘贴到新对话：

```text
请继续推进 /Users/wuyu/Desktop/china-culture-kb 的 Story Agent 开发。

先完整阅读：
1. /Users/wuyu/Desktop/china-culture-kb/docs/story-agent-new-conversation-development-handoff-20260721-v2.md
2. /Users/wuyu/Desktop/china-culture-kb/.codex/skills/china-culture-story-agent/SKILL.md
3. /Users/wuyu/Desktop/china-culture-kb/.codex/skills/china-culture-story-agent/references/story-agent-contract.md
4. /Users/wuyu/Desktop/china-culture-kb/.codex/skills/superpowers-lite/SKILL.md

当前正式项目是 20260720-series-ujl3atax（《皮影诡戏：守灯人》）。14/14 个稳定身份定义、2/2 条世界规则定义、16/16 真人视觉批准和 E1/E10/E20 共 6 条规则绑定均已完成。四人物已通过 GEARS 无 API 测试闭环并回写四张可预览测试 PNG，但这些测试件明确不是真实资产；真实资产 0/14、production credit 0/14、Provider 成片 0。

保护现有工作区：禁止 reset、checkout、clean 或覆盖用户成果。先做只读现场核验，再优先把真实图片 Provider 接入已验证的 character asset bootstrap 合同，完成四人物真实资产和审核链；随后补齐服装、地点、道具，达到 14/14 production credit，再执行真实 E1 试产。未经明确授权不得调用付费/外部 Provider。

每轮必须汇报：本轮完成百分比、软件工程进度、正式项目各原子计数、改动文件、验证证据、正式数据影响、外部阻断和下一步。
```

## 11. 下一轮汇报模板

1. **本轮完成度**：本切片百分比。
2. **软件工程进度**：只能由真实实现与验证提升。
3. **正式项目进度**：分别报告定义、批准、真实资产、production credit、Provider 成片。
4. **完成内容**：本轮真正落地的能力或正式数据。
5. **改动文件**：具体文件和接口。
6. **验证证据**：测试、类型检查、构建、页面/API 结果。
7. **正式数据影响**：谁修改了什么，是否产生真人批准、资产或费用。
8. **剩余边界与下一步**：继续从唯一首要阻断推进。

## 12. 2026-07-22 小推进：服务端视觉建议只读合同

本轮在不触碰正式项目批准、资产和外部 Provider 的前提下，完成 P1 的第一条服务端边界：

- 新增稳定身份建议端点：
  `POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/visual-identities/:visualIdentityId/visual-identity-suggestion-draft`。
- 新增世界规则建议端点：
  `POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/visual-world-rules/:worldRuleId/visual-world-rule-suggestion-draft`。
- 响应使用 `ai-comic-series-visual-suggestion-draft/v1`，包含建议来源、模板版本、输入指纹、源指纹、生成时间、建议字段、未解决字段及 `persisted=false`、`auto_approved=false`。
- 服务端只为当前项目中的空白字段返回补丁；已有人工内容不会进入补丁，也不会被覆盖。
- 人物 `age_range`、`gender_pronouns` 缺少可靠来源时继续列入 `unresolved_field_ids`，不会猜填。
- 世界规则建议不会创建或替换任何 Seedance/GEARS 代表目标绑定。
- 身份和规则建议调用前后，项目 JSON 字节、`updated_at`、批准计数和 production credit 均保持不变。
- 同时补齐旧系列项目兼容：历史 fixture 缺少 `main_characters`、`episodes` 或 `recurring_motifs` 时，视觉 Bible 使用空数组/最小集数回退，不再令项目列表和系统证据接口返回 500。

本轮新增/修改的直接文件：

- `web/shared/types.ts`
- `web/server/src/services/ai-comic-series-visual-suggestion-service.ts`
- `web/server/src/services/ai-comic-series-visual-bible-service.ts`
- `web/server/src/services/ai-comic-series-service.ts`
- `web/server/src/routes/outline.ts`
- `web/server/src/__tests__/outline-service.test.ts`
- `web/server/src/__tests__/api.test.ts`

验证证据：

```bash
cd web/server
npm test -- src/__tests__/outline-service.test.ts -t "returns auditable visual suggestion patches"
# passed：1 passed，35 skipped

npm test -- src/__tests__/api.test.ts -t "serves read-only visual suggestion draft routes"
# passed：1 passed，216 skipped

npm run lint
# passed：tsc --noEmit

cd ..
npm run check
# passed：visible copy 9 files / 14 checks，server tsc，client vue-tsc

npm test -w server
# passed：159 files，1396 tests；1 file / 2 tests skipped

npm run build
# passed：server tsup + client vue-tsc/Vite，171 modules transformed
```

正式数据影响仍为零：定义 16/16、真人视觉批准 0/16、真实资产 0/14、production credit 0/14、Provider 成片 0。该服务端合同已在下一轮完成前端接入，详见第 13 节；业务首要阻断仍是真人逐项批准。

## 13. 2026-07-23 小推进：前端改接服务端视觉建议

本轮完成前后端建议链贯通，前端不再维护一份可能与服务端漂移的重复模板：

- `web/client/src/api/stories.ts` 新增身份与世界规则建议 API 方法。
- `AiComicSeriesStudio.vue` 的两个“填入系统建议（不覆盖已填）”入口改为调用服务端只读合同。
- 请求期间显示“正在获取服务端建议...”，并暂时禁用保存、批准和取消，避免并发草稿状态互相覆盖。
- 前端在应用前校验目标类型、目标 ID、源指纹、`persisted=false` 和 `auto_approved=false`；任何一项不匹配都拒绝修改草稿。
- 即使服务端认为字段为空，只要用户已在本地未保存草稿中填写，该字段也不会被覆盖。
- 只有实际补入字段或定义备注时，才撤销旧 `human_confirmed` 并清空旧 `review_note`。
- 服务端返回的年龄、性别等未解决字段继续保持空白，并在界面中明确提示等待人工填写。
- 世界规则建议只填结构化字段与备注，不触碰 Seedance/GEARS 代表目标绑定。
- 建议仅停留在浏览器草稿；用户仍需独立点击“保存草稿”或在完整真人复核后点击批准。

本轮直接修改：

- `web/client/src/api/stories.ts`
- `web/client/src/views/AiComicSeriesStudio.vue`
- `web/client/scripts/audit-visible-copy.mjs`
- `web/e2e/ai-comic-series-human-review-workflow.spec.ts`
- `docs/story-agent-new-conversation-development-handoff-20260721-v2.md`

验证证据：

```bash
cd web
npm run e2e:track-a -- e2e/ai-comic-series-human-review-workflow.spec.ts --grep "真人盲评以三步向导"
# passed：1 test；身份与世界规则建议 POST 各 1 次，非覆盖/撤销旧确认/不改绑定均通过

npm run check
# passed：visible copy 9 files / 15 checks，server tsc，client vue-tsc

npm run build
# passed：server tsup + client vue-tsc/Vite，171 modules transformed
```

正式项目 JSON 未被本轮调用或改写，原子计数保持：定义 16/16、真人视觉批准 0/16、真实资产 0/14、production credit 0/14、Provider 成片 0。业务首要阻断仍是 16 项真人逐项批准；下一工程切片可补服务失败/stale 的前端回归，或实现只补空白的批量建议预览。

## 14. 2026-07-23 小推进：逐项待复核导航

为降低 14 个身份和 2 条规则的人工审批操作成本，视觉圣经新增只负责定位、不代替真人判断的复核导航：

- 显示待复核总数，并分别显示身份与世界规则数量。
- “打开下一个待复核项”按身份后规则的稳定顺序循环导航。
- 自动展开对应 `<details>`、切换为单个活动编辑器，并滚动到编辑区域。
- 已批准项自动从队列移除；`pending`、`changes_requested` 和 `stale` 仍留在队列中。
- 建议请求、保存或批准进行中时禁用导航，避免并发编辑。
- 导航不会填 Reviewer ID、复核说明，不会勾选真人确认，也不会调用保存/批准接口。
- 小屏下导航改为纵向布局，按钮与进度信息不会挤压。

本轮直接修改仍集中在：

- `web/client/src/views/AiComicSeriesStudio.vue`
- `web/client/scripts/audit-visible-copy.mjs`
- `web/e2e/ai-comic-series-human-review-workflow.spec.ts`
- `docs/story-agent-new-conversation-development-handoff-20260721-v2.md`

验证证据：

```bash
cd web
npm run e2e:track-a -- e2e/ai-comic-series-human-review-workflow.spec.ts --grep "真人盲评以三步向导"
# passed：1 test；待复核 2 项（身份 1、规则 1），连续两次导航依次打开身份与规则

npm run check
# passed：visible copy 9 files / 16 checks，server tsc，client vue-tsc

npm run build
# passed：server tsup + client vue-tsc/Vite，171 modules transformed
```

正式项目数据影响仍为零，审批计数不会因导航增加。下一步业务动作仍须由真人对 16 项逐项复核、填写 Reviewer ID 与具体复核说明后手动批准。

## 15. 2026-07-23 小推进：审批缺项清单与建议失败保护

本轮继续降低真人逐项复核的误操作成本，并把建议服务的负向路径纳入浏览器回归：

- 身份和世界规则编辑器都新增“批准前还需完成”清单，直接列出当前缺少的结构字段、Reviewer ID、复核说明、真人确认或代表目标绑定。
- 当全部条件齐备时，清单显示“批准条件已齐”，但仍只提示真人核对后手动批准。
- 批准按钮与可见清单共用同一缺项计算结果，避免界面提示与实际 `disabled` 条件漂移。
- 服务端建议返回的来源指纹与当前定义不一致时，前端拒绝应用并显示来源变化错误。
- 建议接口返回服务错误时，前端保留本地未保存内容，不补字段、不清复核说明。
- E2E 同时证明：成功建议仍只补空白；stale 和 503 两条失败路径均不会覆盖或部分修改本地草稿。

本轮直接修改仍集中在：

- `web/client/src/api/stories.ts`
- `web/client/src/views/AiComicSeriesStudio.vue`
- `web/client/scripts/audit-visible-copy.mjs`
- `web/e2e/ai-comic-series-human-review-workflow.spec.ts`
- `docs/story-agent-new-conversation-development-handoff-20260721-v2.md`

验证证据：

```bash
cd web
npm run e2e:track-a -- e2e/ai-comic-series-human-review-workflow.spec.ts --grep "真人盲评以三步向导"
# passed：1 test；成功非覆盖、身份来源 stale、世界规则 503 失败以及缺项清单均通过

npm run check
# passed：visible copy 9 files / 17 checks，server tsc，client vue-tsc

npm run build
# passed：server tsup + client vue-tsc/Vite，171 modules transformed
```

正式项目 JSON 未被写入，原子计数仍是：定义 16/16、真人视觉批准 0/16、真实资产 0/14、production credit 0/14、Provider 成片 0。软件工程下一切片建议实现不持久化的“全部空白定义建议预览”；业务首要阻断仍是 16 项真人逐项批准。

## 16. 2026-07-23 小推进：Visual Bible → GEARS 四人物无 API 图片闭环

本轮纠正了两个架构误区：旧 `/gears/jobs` 是 execution worker 合同，不适用于 GEARS v2 工作台；旧分集 `gears_delivery.character_assets` 也不是当前已批准 Visual Bible 的权威人物来源。采用独立 bootstrap 合同后，已贯通：

1. Story Agent 从当前批准的四人物身份和四套主服装构建人物生成请求。
2. GEARS 创建/复用项目与四个人物实体，复用正式画风包与人物 prompt composer。
3. `generation_mode=local_test` 使用确定性 PNG Provider 行为，不读取或调用任何外部图片 API。
4. GEARS 返回人物、base-sheet version、媒体 URL、媒体 SHA、prompt SHA 和明确零信用边界。
5. Story Agent 下载图片，校验 SHA-256，再写入系列不可变媒体目录和稳定人物 identity。
6. 页面显示四张安全预览及“本地测试件、永不计 production credit”标记。
7. 人物定义指纹生成稳定 idempotency key；相同输入第二次返回 `replayed`，Story Agent 复用 4/4。
8. canonical 人物资产若已有非测试真实文件，local-test 入口会失败关闭，绝不覆盖真实资产。

正式项目新增四张本地测试 PNG：盗谱者、开发商、林灯、沈砚。每张均有真实字节和 SHA，但 `provider=gears_local_test`，只证明工程链路，不计“真实图片资产”。正式计数因此保持：真人视觉批准 16/16、真实图片资产 0/14、production credit 0/14、Provider 成片 0。

关键验证：

```text
GEARS pytest：1 passed
GEARS Ruff：passed
GEARS mypy：passed
Story Agent 聚焦 Vitest：2 files / 9 tests passed
Story Agent server tsc：passed
Story Agent client vue-tsc：passed
真实 HTTP 首次：4 characters，external=0，credit=0
真实 HTTP 重放：gears_status=replayed，imported=0，reused=4
浏览器：按钮可见可用；消息显示 4/4、外部 API 0、production credit 0
浏览器：4 个测试标记、4 张安全预览，人物分别为盗谱者/开发商/林灯/沈砚
```

下一步不应继续扩展假 Provider。应为同一合同增加显式授权、预算和 credential gate 下的真实图片 Provider 模式，先用四人物做小批量试产；真实图片回写后，逐个完成授权与真人媒体审核，测试件不得自动迁移任何批准状态。
