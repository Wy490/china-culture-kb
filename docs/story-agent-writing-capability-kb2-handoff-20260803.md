# Story Agent 创作增强与知识库 2.0 交接快照（2026-08-03）

## 1. 本文件用途

这是新对话的首要交接入口，记录截至 2026-08-21 的真实工程状态、验证证据和下一步顺序。文件名保留首次交接日期，正文持续更新。

完整规划与历史切片保留在：

- `docs/story-agent-writing-capability-knowledge-base-2-handoff-20260731.md`
- `docs/story-agent-development-handoff-20260729.md`

新对话先读本文件；只有需要追溯设计理由或历史验收时，再查阅上述长文档。

## 2. 用户当前优先级

1. 继续全力推进 Story Agent 功能完整度和创作能力。
2. 现阶段不把人工评审、真人流程、用户注册作为工程前置。
3. 可以保留人工证据合同，但不得虚构人工信用或把机器验证写成人工通过。
4. 不得把生成故事或机器派生生产指导写回 `data/provinces/*.md`。
5. 优先完成可运行能力，再处理非阻塞治理与真人协作事项。

## 3. 仓库快照

- 工作目录：`/Users/wuyu/Desktop/china-culture-kb`
- 当前分支：`codex/story-agent-manifest-integrity-20260718`
- 本轮起点 HEAD：`a0e6f4b3`（`docs(story-agent): hand off fallback genre slice`）
- 第三十四切片实现提交：`8fa29b93`（`feat(story-agent): materialize fallback genre mechanisms`）
- 第三十五切片实现提交：`35fffb0b`（`feat(story-agent): fuse narrative mechanisms`）
- staged 文件：0
- 本轮起点上游同步：HEAD 与上游分支 `0/0`
- B4 与 M4 第一至第三十五切片均已完成；第三十三至第三十五切片实现提交依次为 `0da1c530`、`8fa29b93`、`35fffb0b`
- 处理原则：保留全部现有变更，不得执行 `git reset --hard`、`git checkout --` 或批量清理

前序 M0–M3 累积实现已提交并推送到当前分支；本轮变更仍不得 reset、checkout 或批量清理。新对话必须先运行 `git status --short`，在当前工作区上续做。

## 4. 当前进度

固定权重：

```text
M0 10% + M1 20% + M2 25% + M3 25% + M4 15% + M5 5% = 100%
```

- M0 实施：100%
- M1 实施：100%
- M2 工程实施：99%
- M3 工程实施：94%
- M4 工程实施：99%
- “创作增强与知识库 2.0”专项总进度：98%
- 既有 Story Agent MVP 总进度：99%

M2 剩余 1% 是机器报告固化，不是产品主链缺失。M3 原始字段治理已完成；M4 故事可发布、GEARS 合同与创作质量均已 45/45，机器创作质量不变量整体通过。当前 15×3 矩阵已无可由生成器治理的生产素材字段缺口。Story Agent 的“文化题材源 × 原创叙事机制”组合合同已覆盖神话、民间传说、历史事迹、历史人物、地方掌故、经典文本、非遗/文化记忆和用户原创素材，以及遗迹探秘、公平推理、神话远航、历史阵营群像、民俗异闻、战争谋略、家族代际、团队智取等 16 类新机制。resolved IDs 已同步进入蓝图、prompt、质量信号、repair、最终故事和请求元数据；本地 fallback 现按请求顺序建立主机制与副机制分工，每个副机制必须在独立中段场景兑现，并与正文、场景和 GEARS 同步。公平推理/民俗双解、悲剧/喜剧、遗迹保护/团队行动、阵营群像/战役谋略四类语义张力已有确定性化解规则；副机制超过中段场景容量时 fail closed。正式本地组合矩阵覆盖 8/8 题材源、16/16 主机制、16/16 副机制与 8 个混合题材案例。组合层只学习通用结构机制，明确禁止复用受保护作品表达。下一重点转向项目—源故事跨存储崩溃恢复、兼容片型/时长扩展和既有 pattern 弱信号优化。

## 5. 不可破坏的主链与架构边界

主生成链保持：

```text
Knowledge entry / user material
  -> StoryBlueprint
  -> full_text
  -> scene_breakdown
  -> gears_segments
  -> quality report
  -> repair if needed
  -> project/version storage
```

必须遵守：

- `GenreStoryProfile` 是类型承诺、必备元素、禁用模式、场景规则、GEARS 规则和修复指导的单一事实来源。
- `StoryBlueprint` 是知识素材与最终文本之间的结构桥梁。
- prompt、fallback、quality、repair 和 persistence 不得发生规则漂移。
- `full_text` 必须是面向观众的成品文本，不是规划提纲。
- `scene_breakdown` 和 `gears_segments` 必须随正文修复同步更新。
- 知识事实、传说版本、创作补位和待核点必须明确分层。
- 生成内容不得回写省级知识 Markdown。

## 6. 已完成能力

### 6.1 M0：能力目录与默认关闭基线

- 建立 `WritingCapabilityProfileV1` 类型和 schema。
- 登记三类首批创作能力，全部默认关闭。
- 固化来源、许可证、固定 commit、允许/禁止片型和不执行第三方代码等边界。
- 证明能力关闭时 prompt、fallback 和现有生成结果保持兼容。
- 机器基线：`data/reports/story-agent-writing-capability-m0-baseline.json`。

### 6.2 M1：知识库 2.0 合同

- 建立 claim、source grade、certainty、variant/dispute、creative affordance、production material 和 missing material 合同。
- 最后成功刷新的知识合同报告为 M2-3J 快照：272/272 个条目可映射到新合同；992 个来源保持 `ungraded`，1405 个 claim 中 1133 个待核 claim 保持 blocked。M2-3K、M2-3L、M2-3M 后均未刷新，不得将该旧报告写成 277 条、283 条或 289 条结论。
- 建立 source-grade / claim-mapping Overlay 和 fail-closed 引用校验。
- 建立 `StoryKnowledgePreparationV1` 可选只读旁路；关闭时返回形状不变。
- 合成 Overlay fixture 只验证合同，固定不授予真实人工信用。

主要落点：

- `web/server/src/domains/china-culture/story-knowledge-contract-service.ts`
- `web/server/src/domains/china-culture/story-knowledge-contract-audit-service.ts`
- `web/server/src/domains/china-culture/story-knowledge-evidence-overlay-service.ts`
- `web/server/src/domains/china-culture/story-knowledge-preparation-service.ts`
- `data/reports/story-agent-knowledge-contract-v1-audit.json`

### 6.3 M2：创作能力路由、静态适配与运行时接线

已完成：

- type-aware capability router；
- capability + `VideoType` 精确 rollout policy；
- `short_drama_develop_write_review × ai_comic_drama` 静态 adapter 与冲突预检；
- 13 个虚构 fixture 的离线 shadow evaluation；
- canary decision 机器合同；
- 默认关闭的 dormant runtime integration；
- `continuity_state_tracking × ai_comic_drama` 连续性 ledger；
- `reader_simulation_review × ai_comic_drama` 机器读者诊断；
- blueprint、quality、repair 和 persistence 已支持显式内部 activation；
- 错误片型、身份、commit、adapter 或 rollback 漂移全部 fail closed。

三类 capability profile 仍保持 `enabled:false`。只有调用方显式提供完整内部 activation 合同时才进入运行时投影；不执行第三方仓库代码。

机器基线均为 `passed`：

- `data/reports/story-agent-writing-capability-m2-routing-baseline.json`
- `data/reports/story-agent-writing-capability-m2-shadow-plan-baseline.json`
- `data/reports/story-agent-writing-capability-m2-adapter-preflight-baseline.json`
- `data/reports/story-agent-writing-capability-m2-shadow-evaluation-baseline.json`
- `data/reports/story-agent-writing-capability-m2-canary-decision-baseline.json`

未完成的 M2 报告项：runtime integration 审计脚本已经覆盖三类 profile，但当前沙箱可能拒绝 `tsx` IPC socket，因此没有可计入完成证据的新报告和哈希。不要把这项环境限制误判为产品主链未实现。

### 6.4 M3 第一切片：完整 15 类 ProductionMaterialPack

- 新增原先缺失的 7 类：`character_story`、`historical_drama`、`legend_story`、`culture_promo`、`city_brand_promo`、`scene_short`、`landscape_mood`。
- ProductionMaterialPack 从 8/15 提升到 15/15。
- 15 包合计 184 个 required field、100 个样本。
- 每类至少 5 个样本、10 个字段、4 层 prompt。
- 新增 7 包各有至少 4 个地域锚点；每条新增样本都有 `failure_pattern` 和 `repair_strategy`。
- `lecture_video`、`education_training` 均由 2 条扩至 5 条。
- 新包已进入 prompt、readiness、quality 和顶层 workflow checkpoint，不是只写 JSON。

主要落点：

- `data/production-packs/video-type-material-supplement-packs.json`
- `web/server/src/services/production-material-pack-service.ts`
- `web/server/src/services/production-material-readiness-service.ts`
- `web/server/scripts/production-material-pack-m3-audit.mjs`
- `data/reports/story-agent-writing-capability-m3-production-material-baseline.json`

### 6.5 M3 第二切片：基础制作字段运行时指导

新增 `machine-production-field-guidance/v1` 确定性派生器：

- 按历史/人物、工艺/非遗、传说/民俗、表演、饮食和通用类型派生对白口吻、可戏剧化空间和禁用表达。
- 只有已有资产或地点存在时才派生视觉锚点。
- 输出固定 `facts_added:false`、`source_markdown_writeback_allowed:false`。
- 待核点只进入审稿边界，不会被补写为确定事实。
- 单条目知识包和多条目 outline 匹配知识包都会注入 `production_prompts` 与 `review_boundaries`。
- 现有生成 prompt 已消费这两个字段。

主要落点：

- `mcp-server/src/lib/production-field-guidance.ts`
- `web/server/src/domains/china-culture/entry-production-guidance-service.ts`
- `web/server/src/domains/china-culture/story-knowledge-pack-service.ts`
- `web/server/src/services/outline-service.ts`
- `mcp-server/src/tools/audit-production-materials.ts`

生产审计现在同时保留：

- `missing_production_fields`：源 Markdown 原始缺口；
- `machine_guidance_fields`：运行时机器指导覆盖；
- `effective_missing_production_fields`：运行链仍然无法覆盖的缺口。

2026-08-04 修正审计输入口径后的全库结果：

- 省级文件：34
- 正式条目：289
- 来源：1043
- 每个条目均审计 15 种片型模板
- 源字段原始缺口：168
- 机器指导覆盖：168
- 基础制作字段有效运行缺口：0
- 获得机器指导的条目：111
- 从源 Markdown 专节恢复识别：44
- 缺口分布：对白口吻 85、可戏剧化空间 57、禁用表达 19、视觉符号 7

注意：有效运行缺口归零不代表 168 个源 Markdown 字段已经人工补齐；它们仍保留为源素材治理积压。212→168 来自纠正审计盲区，不是把机器兜底回写省级条目。

### 6.6 M3 第三切片：仪式礼俗与禁忌 Domain Pack

新增跨条目生产包 `ritual_etiquette_taboo_pack`：

- 按仪式性质、地域版本、前置准备、参与角色、空间秩序、核心动作、声音语言和收束方式组织生产提示。
- 对封闭空间、神圣物件、危险动作、不宜公开环节、少数民族、婚丧和私密空间保留来源与授权边界。
- 固定声明通用礼俗包不能替代具体地区、族群、宗教或家族版本核验，也不能把展演复原或影视惯例写成真实传统。
- 新包已通过优先匹配进入知识包；`production_prompts` 与 `review_boundaries` 会进入 Story Agent 生成 prompt。
- Web 与 MCP 的 Domain Pack 健康合同已从 8 个必需生产包同步提升为 9 个，避免双端口径漂移。
- 未修改任何 `data/provinces/*.md`，未授予人工审稿或真实生产信用。

主要落点：

- `data/domain-packs/china-culture.json`
- `web/server/src/domains/china-culture/domain-pack-production-service.ts`
- `mcp-server/src/tools/production-health-reports.ts`
- `web/server/scripts/domain-pack-m3-audit.mjs`

### 6.8 M3 第五切片：M2-3I 五地区真实内容补齐

首批把原有 4 条的澳门、重庆、福建、广西、海南补到各 5 条，新增：

- 澳门：木雕（澳门神像雕刻）——造像、髹饰与百年行业传承；
- 重庆：大足石刻——五山造像、三教题材与世界遗产保护；
- 福建：妈祖信俗——湄洲祖庙、祭典与海洋社群文化纽带；
- 广西：侗族木构建筑营造技艺——掌墨、榫卯与三江村寨空间；
- 海南：儋州调声——方言对歌、身体摆动与中秋歌会。

每条均有 3—4 个公开权威来源、至少 1 个 A/B 级来源和至少 2 个独立来源主体，完整包含来源绑定、核实方法、待核点、事实/口述/虚构分层、版权安全边界、机器元数据及 `asset_split` 四段。五条生产卡机器分均为 100，固定检索 5/5 top 1；真人来源/文化/宗教/文物/建筑/音乐专业审稿仍为 0/5，不授予黄金卡或人工通过。

本切片后全库为 267 条、977 个来源，19/34 地区达到至少 5 条；M2 扩充累计 75/97（77.32%），剩余 22 条。全库知识合同审计为 267/267 有效，仍保持 report-only、未进入生成主链且不允许回写源 Markdown。

验证：`kb:lint` 通过 34 文件、267 条；生产审计 0 条缺来源/地点/核实方法，267/267 有机器元数据和 `asset_split`；MCP 全量 109 个文件、555 项测试通过；M3 ProductionMaterialPack baseline 与 Domain Pack baseline 均通过；`git diff --check` 通过，staged 仍为空。
- `data/reports/story-agent-writing-capability-m3-domain-pack-baseline.json`

### 6.9 M3 第六切片：M2-3J 五地区真实内容补齐

继续把原有 4 条的河南、吉林、江苏、内蒙古、四川补到各 5 条，新增：

- 河南：豫剧——河南梆子声腔、舞台行当与当代院团传承；
- 吉林：查干淖尔冬捕习俗——冰下走网、祭湖醒网与生态捕捞；
- 江苏：南京云锦木机妆花手工织造技艺——拽花、织手与逐花异色；
- 内蒙古：蒙古族服饰——部落版本、生活身份与裁缝饰品系统；
- 四川：成都漆艺——天然生漆、髹饰层次与地域装饰技法。

每条均有 3 个公开权威来源、至少 1 个 A/B 级来源和至少 2 个独立来源主体，完整包含来源绑定、核实方法、待核点、事实/口述/虚构分层、版权安全边界、机器元数据及 `asset_split` 四段。五条生产卡机器分均为 100，固定检索 5/5 top 1；真人来源/文化/戏曲/生态/民族服饰/工艺专业审稿仍为 0/5，不授予黄金卡或人工通过。

本切片后全库为 272 条、992 个来源，24/34 地区达到至少 5 条；M2 扩充累计 80/97（82.47%），剩余 17 条。全库知识合同审计为 272/272 有效、1405 个 claim 中 1133 个保持 blocked，仍为 report-only、未进入生成主链且不允许回写源 Markdown。

验证：`kb:lint` 通过 34 文件、272 条；生产审计 0 条缺来源/地点/核实方法，272/272 有机器元数据和 `asset_split`；MCP 全量 109 个文件、555 项测试通过；M3 ProductionMaterialPack baseline 与 Domain Pack baseline 均通过。升级计划为 13 批、402 个建议动作。

### 6.10 M3 第七切片：M2-3K 四地区真实内容补齐

以五条内容把台湾、香港、浙江、宁夏四地直接补到至少 5 条，新增：

- 台湾：卑南族传统织布——水平背带织机、衣饰知识与部落传习；
- 香港：香港中式长衫制作技艺——量体、裁剪、熨拔与手工缝制；
- 浙江：金石篆刻（西泠印社）——篆法、章法、刀法与钤拓传承；
- 宁夏：回族剪纸——生活纹样、绣花底样与宁夏女性传承；
- 宁夏：固原砖雕——软雕、硬雕与建筑装饰传承。

每条均有 3 个公开权威来源和多个独立来源主体，完整包含来源绑定、核实方法、待核点、事实/口述/虚构分层、版权安全边界、机器元数据及 `asset_split` 四段。五条生产卡机器分均为 100，固定检索 5/5 top 1；真人来源/文化/族群/服装/篆刻/建筑专业审稿仍为 0/5，不授予黄金卡或人工通过。

本切片后全库为 277 条、1007 个来源，28/34 地区达到至少 5 条；M2 扩充累计 85/97（87.63%），剩余 12 条。知识合同审计在沙箱内仍触发 `tsx` IPC `listen EPERM`，沙箱外运行又被自动审批基础设施异常拒绝，最后有效合同报告仍为 272 条 M2-3J 快照；本切片没有伪造 277 条合同通过结论。

验证：`kb:lint` 通过 34 文件、277 条；生产审计 0 条缺来源/地点/核实方法，277/277 有机器元数据和 `asset_split`；MCP 全量 109 个文件、555 项测试通过；M3 ProductionMaterialPack baseline 已刷新到 277 条并通过，Domain Pack baseline 12/12 通过。升级计划仍为 13 批、402 个建议动作。

### 6.11 M3 第八切片：M2-3L 青海、山东、陕西真实内容补齐

为青海、山东、陕西各新增 2 条，使三地均达到 5 条：

- 青海：藏医药浴法——青海藏医院、药浴协作与医疗安全；
- 青海：土族盘绣——一针二线、无绷架与互助传承；
- 山东：鲁锦织造技艺——经纬、织机与鲁西南生活织物；
- 山东：泰山皮影戏——影人、灯幕与“十不闲”协作；
- 陕西：皮影戏（华阴老腔）——月琴、帮腔与关中戏曲声场；
- 陕西：秦腔——板式、行当与西北舞台传承。

每条均有 3 个公开权威来源、完整来源绑定、核实方法、待核点、事实/口述/虚构分层、版权安全边界、机器元数据及 `asset_split`。藏医药浴只作为遗产与机构协作材料，不作疗效、处方或居家操作指导；“青绣”不等同于盘绣，单一鲁锦流程不代表全部地区，“十不闲”、老腔源流与秦腔历史剧目也未被写成无争议事实。六条生产卡机器分均为 100，固定检索 6/6 top 1；真人来源/文化/传统医药/族群/工艺/戏曲审稿仍为 0/6，不授予黄金卡或人工通过。

本切片后全库为 283 条、1025 个来源，31/34 地区达到至少 5 条；M2 扩充累计 91/97（93.81%），剩余 6 条。最后有效知识合同报告仍是 272 条 M2-3J 快照，本切片未重跑、未手工修改或伪造 283 条合同结论。

验证：`kb:lint` 通过 34 文件、283 条；生产审计 0 条缺来源/地点/核实方法，283/283 有机器元数据和 `asset_split`；六条生产卡均 100 分、固定检索 6/6 top 1；MCP 全量 109 个文件、555 项测试通过。机器元数据与可信度 dry-run 零变更，资产拆分无缺口，升级计划 13 批、402 个建议动作；M3 ProductionMaterialPack baseline 已刷新到 283 条并通过，Domain Pack baseline 12/12 通过。

### 6.12 M3 第九切片：M2-3M 西藏、新疆、云南全国覆盖收口

为西藏、新疆、云南各新增 2 条，使三地均达到 5 条，并完成全国 34/34 地区至少 5 条的机器覆盖目标：

- 西藏：藏族唐卡（勉萨画派）——造像度量、线描设色与宗教图像边界；
- 西藏：藏族造纸技艺——雪拉藏纸、手工抄造与有毒原料安全；
- 新疆：新疆维吾尔族艾德莱斯绸织染技艺——扎经染色、木机织造与产品溯源；
- 新疆：哈萨克族毡房营造技艺——木骨架、毛毡围护与搭拆协作；
- 云南：剪纸（傣族剪纸）——剪凿并用、仪式纸饰与芒市传承；
- 云南：普洱茶制作技艺（贡茶制作技艺）——采选、杀青揉晒与宁洱手工边界。

每条均有 3 个公开权威来源、完整来源绑定、核实方法、待核点、事实/口述/戏剧化/虚构分层、版权安全边界、机器元数据及 `asset_split`。唐卡宗教图像不作自由改编，藏纸有毒原料不提供采集和处理教程，染料与废水、毡房结构和炉具、剪凿工具与仪式权限、贡茶食品与健康宣称均设置了操作边界。六条生产卡机器分均为 100，固定检索 6/6 top 1；真人来源/文化/宗教/族群/工艺/建筑/食品审稿仍为 0/6，不授予黄金卡或人工通过。

本切片后全库为 289 条、1043 个来源，34/34 地区达到至少 5 条；M2 扩充累计 97/97（100%），内容扩充机器目标完成。最后有效知识合同报告仍是 272 条 M2-3J 快照，本切片未重跑、未手工修改或伪造 289 条合同结论。

验证：`kb:lint` 通过 34 文件、289 条；生产审计 0 条缺来源/地点/核实方法，289/289 有机器元数据和 `asset_split`；六条生产卡均 100 分、固定检索 6/6 top 1；MCP 全量 109 个文件、555 项测试通过。机器元数据与可信度 dry-run 零变更，资产拆分无缺口，升级计划 13 批、402 个建议动作；M3 ProductionMaterialPack baseline 已刷新到 289 条并通过，Domain Pack baseline 12/12 通过。

### 6.7 M3 第四切片：建筑、语言与自然环境 Domain Pack

完成剩余三类跨条目生产包：

- `architectural_space_furnishing_pack`：把建筑题材拆成外部环境、入口、过渡空间、核心空间、附属空间、人物动线、固定陈设、活动道具和随身物；原址、复建、修缮、展陈与影视搭景分层。
- `regional_language_register_pack`：按时代、地区、身份、年龄、关系和场合组织对白/旁白语体；方言、民族语言、古语、行业术语必须有语料或复核，不用口音制造刻板印象。
- `natural_environment_soundscape_pack`：按地域、地貌、季节、时段、天气、光线、运动层和环境声音组织镜头连续性；不虚构地方物种、天象、灾害、季相或真实现场录音。
- 三包都已通过优先匹配进入知识包，生成 prompt 会消费对应 `production_prompts` 与 `review_boundaries`。
- Web 与 MCP 健康合同同步从 9 个必需生产包提升为 12 个；Domain Pack 数据版本从 `1.3.0` 提升到 `1.4.0`。
- 本切片未修改省级知识 Markdown，没有把机器指导、方言模板、空间模板或环境模板写成知识事实。

主要落点：

- `data/domain-packs/china-culture.json`
- `web/server/src/domains/china-culture/domain-pack-production-service.ts`
- `web/server/src/services/story-generation-prompt.ts`
- `mcp-server/src/tools/production-health-reports.ts`
- `web/server/scripts/domain-pack-m3-audit.mjs`

### 6.13 M3 第十切片：Domain Pack 运行时追踪、质量与修复闭环

完成跨条目生产包从“被检索、进入 prompt”到“可追踪、可判定、可修复”的运行时闭环：

- 新增 `story-domain-pack-context/v1`，在 `StoryBlueprint` 记录实际选中的 supporting pack、生产提示数和审稿边界数；合同明确为机器校验，人工审校未完成且不授予真实生产 credit。
- generation preparation 只构建一次 Domain Pack context，并把同一对象传入 Blueprint 与 `production-material-readiness/v1`；readiness 仅携带追踪，不改变分数、字段可用性或 Gate 结论。
- 新增 `story-domain-pack-quality/v1`，只扫描标题、正文、场景、对白/旁白、视觉提示和 GEARS 等观众/交付文本，不扫描 Blueprint 自身；若 `生产提示：`、`审稿边界：`、`Domain Pack` 标签或提示/边界原文泄漏，则机器质量失败并扣分。
- repair package 新增 `Domain Pack 修复边界`，要求把内部提示转化成动作、画面和事实边界，不得原样泄漏；项目修复归一化会保留原 Blueprint 的 Domain Pack context。
- 修复 Domain Pack 默认数据根路径少回溯一层的问题：未设置 `KB_ROOT` 时现在读取仓库 `data/domain-packs/china-culture.json`，不再静默退回仅含 6 个旧种子的 fallback。端到端非遗样例已验证真实生产包进入 readiness 与 Blueprint。
- M3 Domain Pack baseline 新增五项 gate：默认根路径、Blueprint trace、readiness trace、quality leak gate、repair boundary，全部为 `true`。
- 本切片未修改 `data/provinces/*.md`，未授予人工审核、真实生产或外部发布信用。

主要落点：

- `web/server/src/services/story-domain-pack-trace-service.ts`
- `web/server/src/services/story-blueprint-service.ts`
- `web/server/src/services/production-material-readiness-service.ts`
- `web/server/src/services/genre-quality-service.ts`
- `web/server/src/services/story-repair-service.ts`
- `web/server/src/domains/china-culture/story-generation-preparation-service.ts`
- `web/server/src/domains/china-culture/domain-pack-production-service.ts`
- `web/shared/types.ts`
- `web/server/scripts/domain-pack-m3-audit.mjs`
- `data/reports/story-agent-writing-capability-m3-domain-pack-baseline.json`

验证：新增失败用例先得到 4 项预期失败；实现后核心定向 44/44、相关回归 148/148、Server 全量 203 个文件/1676 项通过（1 个文件/2 项按既有配置跳过），Server TypeScript lint 与 production build 通过，M3 Domain Pack baseline `--write`、`--check` 均通过。

### 6.14 M3 第十一切片：片型感知检索、多包优先级与 15 类型机器对照

完成 Domain Pack 从“有追踪”到“按片型稳定选对包、可做反事实对照”的下一层合同：

- `buildChinaCultureSingleEntryKnowledgePack` 将已解析 `video_type` 纳入检索文本，使儿童故事、AI 漫剧、非遗、微纪录、知识讲解、竖屏短视频、宣讲培训等片型能够稳定触发自己的生产包。
- 多包冲突采用 `cultural_safety_then_type_specific_then_production_ready_diversity/v1`：文化安全边界先于时代/视觉包；片型专属包优先；同一 matcher 内优先带 `production_prompts`/`review_boundaries` 的生产包；后续仍保留知识域多样性。
- 精确时代包与通用生产时代包不再互相替代：outline 的“宋代”语义继续得到 `era=宋` 的具体设定包，Story Agent 片型路径同时可取得通用朝代服饰生产边界。
- 新增 `story-domain-pack-15-type-comparison/v1`，复用 canonical 15 类型 case，逐项比较 active 与“只抑制 Domain Pack 指导”的 control prompt/Blueprint/readiness。
- 每个片型都有明确预期包映射，不能以任意包凑覆盖：人物/历史/传说→朝代包，儿童→儿童包，AI 漫剧→分镜包，文化/城市/场景→建筑包，非遗→工序包，短视频→钩子包，微纪录→来源包，讲解→知识结构包，宣讲/培训→培训结构包，山水→环境声景包。
- 机器报告 15/15 类型存在、15/15 有追踪、15/15 命中预期包、15/15 active prompt 有新增指导、15/15 control prompt 无 Domain Pack 指导、15/15 readiness 分数不变。
- 报告明确 `external_model_invoked=false`、`story_output_quality_measured=false`、`human_review_complete=false`、`real_production_credit_granted=false`；它证明检索和生成前合同差异，不证明实际成片质量提升。
- 本切片未修改 `data/provinces/*.md`，未执行第三方代码或外部模型。

主要落点：

- `web/server/src/services/story-domain-pack-comparison-service.ts`
- `web/server/scripts/domain-pack-15-type-comparison-audit.mts`
- `data/reports/story-agent-writing-capability-m3-domain-pack-15-type-comparison.json`
- `web/server/src/domains/china-culture/domain-pack-production-service.ts`
- `web/server/src/domains/china-culture/story-knowledge-pack-service.ts`
- `web/server/src/domains/china-culture/story-generation-preparation-service.ts`
- `web/server/src/__tests__/story-domain-pack-comparison-service.test.ts`

验证：三项新行为先观察到预期失败；核心定向 3 个文件、17 项通过，相关回归 9 个文件、85 项通过。首次全量回归发现 outline 精确时代包被通用生产包替代，修复后 outline/domain/comparison 3 个文件、51 项通过；最终 Server 全量 204 个文件、1679 项通过（1 个文件/2 项按既有配置跳过），TypeScript lint 与 production build 通过。Domain Pack 主 baseline 与 15 类型 comparison baseline 均完成 `--write`、`--check`。

### 6.15 M3 第十二切片：原始生产字段缺口审计校正与治理账本

先修正“有源专节却被判缺失”的审计盲区，再建立剩余缺口的逐项治理合同：

- 生产审计原先提取了完整条目 Markdown，但核心字段与 15 类型模板只读取 `FullEntryDetail` 的通用解析字段；因此“创作生产字段”“可戏剧化空间”“禁止断言”等源专节不可见。
- 审计现在同时读取结构化详情和原始条目 Markdown，并为每个基础字段记录 `structured_detail`、`raw_markdown` 或 `missing` 证据来源。
- 44 个已由作者写入源 Markdown 专节的字段恢复识别；原始缺口由 212 降为 168，受影响条目由 140 降为 111。运行时有效缺口继续为 0。
- 新增 `kb-raw-production-field-gap-governance/v1` 逐项账本，覆盖文件路径、条目、字段、风险车道、证据要求、验收规则、运行时兜底状态和 `auto_write_allowed=false`。
- 剩余 168 项分为四批：非湖南高风险边界 28、湖南高风险边界 55、非湖南对白口吻 26、湖南对白口吻 59；先处理事实/改编/视觉边界，再处理口吻规范。
- 治理账本明确 168/168 均需 source-authored 补写，自动回写许可为 0；本切片没有修改 `data/provinces/*.md`，也没有把机器指导升级为知识事实。

主要落点：

- `mcp-server/src/tools/audit-production-materials.ts`
- `mcp-server/src/tools/audit-raw-production-field-gaps.ts`
- `mcp-server/src/tools/run-raw-production-field-gap-audit.ts`
- `mcp-server/src/tools/audit-production-materials.test.ts`
- `mcp-server/src/tools/audit-raw-production-field-gaps.test.ts`
- `data/reports/knowledge-base-raw-production-field-gap-governance.json`
- `docs/knowledge-base-raw-production-field-gap-governance.md`

验证：MCP 定向 2 个文件、3 项通过，MCP 全量（排除既有端口自动化文件）110 个文件、554 项通过，MCP TypeScript build 通过；`kb:lint` 通过 34 文件/289 条；全库生产审计与 13 批/399 项升级计划重生成成功；原始字段治理账本在沙箱内首次因 `tsx` IPC `listen EPERM` 失败，按批准在沙箱外重跑并通过新增 `--check`；M3 ProductionMaterial baseline 完成 `--write`、`--check`，Domain Pack 两份 baseline 复核通过，当前 289 条、168 个原始缺口、168 个运行时兜底、有效缺口 0。

### 6.16 M3 第十三切片：B1 非湖南高风险边界治理

完成治理账本 B1 的 26 个条目、28 个高风险源字段：

- 在安徽、北京、重庆、广东、广西、贵州、河北、吉林、江苏、江西、辽宁、内蒙古、宁夏、青海、山东、山西、陕西、上海、四川、西藏、新疆、云南、浙江的相关条目中，按各自待核点、人物、场景与道具补入专属的“可戏剧化空间”“视觉符号”或“禁止断言”。
- 补写不新增历史事实：只约束复合角色、逐字对白、伤亡/兵力统计、会议争论、人物身份、口述版本、民族与边疆叙事、展陈复原和视觉资产的使用方式。
- B1 机器门禁当前为 0 个非湖南高风险残留；原 28 项均由 source-authored 条目专节覆盖，没有使用通用运行时兜底回写。
- 在复核净变化时发现旧审计把“不得虚构逐字对白”误判为“已有对白口吻”。新增纯函数与测试后，只有明确的口吻/语气/风格字段或 `asset_usage=dialogue_tone` 才能通过。
- 因收紧口吻证据规则，新增识别出 15 个此前被掩盖的真实口吻缺口；因此当前总缺口为 155，而不是简单的 168−28=140。分布为对白口吻 100、可戏剧化空间 36、禁用表达 13、视觉符号 6；117 个条目获得运行时兜底，有效运行缺口仍为 0。

验证：新增审计行为先观察到预期失败，随后 MCP 定向 2 个文件、4 项通过，MCP 全量（排除既有端口自动化文件）110 个文件、556 项通过，MCP TypeScript build 通过；`kb:lint` 通过 34 文件/289 条；生产审计与 13 批/399 项升级计划重生成，M3 ProductionMaterial baseline 完成 `--write`、`--check`。治理账本刷新因沙箱外自动审批基础设施报 `Unknown parameter: input[6].namespace` 被拒绝，本轮没有用旁路或手工伪造该 JSON；其现存 168 项快照已陈旧，以下当前数字以生产审计和 M3 baseline 为准。

### 6.17 M3 第十四切片：B2 湖南高风险边界治理

完成湖南存量 B2 的 44 个条目、55 个高风险源字段：

- 覆盖历史人物、革命战争与灾难记忆、名胜古迹、传说节俗、戏曲音乐、饮食、工艺和民族民俗条目。
- 统一采用“创作边界补充（非知识事实）”格式，但每条内容均回指本条目的待核点、人物、场景、道具和来源风险；没有把运行时通用模板原样写回。
- 人物史限制无出处的私下对白、心理、遗言和逐字命令；战争与灾难史限制伤亡/兵力数字、复合英雄和猎奇画面；民俗与非遗限制版本统一化、神秘化、族群代言、无授权曲词声线、限制性仪式和危险动作复刻。
- B1+B2 全库高风险事实/改编/视觉边界当前残留为 0；生产审计剩余 100 项全部是对白/旁白口吻，其中非湖南 33、湖南 67。
- 治理报告新增 `high_risk_gap_count` 与 `high_risk_scope_complete` 合同和测试；但治理账本写入仍因 `tsx` IPC 后的沙箱外自动审批参数错误被拒绝，没有绕过或伪造，现存 168 项文件继续标陈旧。

验证：MCP 定向 2 个文件、4 项及全量（排除既有端口自动化文件）110 个文件、556 项通过，MCP TypeScript build 通过；`kb:lint` 通过 34 文件/289 条；生产审计为 100 个原始缺口、100 个机器兜底、有效缺口 0；13 批/399 项升级计划重生成；M3 ProductionMaterial baseline 完成 `--write`、`--check`；`git diff --check` 通过。

### 6.18 M3 第十五切片：B3 非湖南对白/旁白口吻治理

完成非湖南 B3 的 33 个条目、33 个对白/旁白口吻源字段：

- 覆盖北京至新疆 26 个省级文件中的红色历史、近现代纪念与故宫传说条目，按人物身份、时代、地域、场景载体和证据边界逐条写入口吻规范。
- 会议与谈判条目采用克制书面语，军事行动采用短口令和任务导向交流，地方与民族地区限制夸张方言、群体代言和单一“边疆口吻”；真实人物命令、证言、遗言与私下对白仍须逐句核源。
- 所有新增内容均标注为“非知识事实”，没有把机器兜底原样回写，也没有把影视台词、后世总结或口述争议升级为历史事实。
- 首轮审计暴露带括注的字段标签未被识别；新增回归用例后，`对白/旁白口吻（非知识事实）：` 与既有标准标签均可识别，同时仍拒绝“不得虚构对白”类假阳性。
- 当前生产审计只剩 67 个原始缺口，全部位于湖南且全部为 `dialogue_tone`；非湖南残留 0、高风险事实/改编/视觉边界残留 0。67 条获得确定性机器兜底，运行时有效缺口仍为 0。
- 原始字段治理账本 JSON/Markdown 仍是第十二切片 168 项旧快照；本切片没有绕过审批基础设施或手工伪造，当前数字继续以生产审计与 M3 ProductionMaterial baseline 为准。

验证：口吻识别定向测试 1 文件/3 项通过；MCP 全量（排除既有端口自动化文件）110 个文件/556 项通过，MCP TypeScript build 通过；Server 全量 204 个文件/1679 项通过（1 个文件/2 项按既有配置跳过），Server TypeScript lint 与 production build 通过；`kb:lint` 通过 34 文件/289 条；生产审计为 67 个原始缺口、67 个机器兜底、有效缺口 0；13 批/399 项升级计划重生成；M3 ProductionMaterial baseline 完成 `--write`、`--check`，Domain Pack 主 baseline `--check` 通过。15 类型 comparison baseline 本轮复核在沙箱内触发已知 `tsx` IPC `listen EPERM`，沙箱外申请又被自动审批基础设施的 `input[6].namespace` 参数错误拒绝；该文件未受 B3 改动，第十一切片已有成功 `--write`、`--check` 记录，本轮未绕过或伪造复核结论。

### 6.19 M3 第十六切片：B4 湖南对白/旁白口吻治理与全流程回归

完成湖南 B4 的 67 个条目、67 个对白/旁白口吻源字段：

- 覆盖历史人物、红色历史与灾难记忆、名胜传说、节庆仪式、戏曲曲艺、歌舞、纺织雕刻、饮食与茶工艺等全部剩余条目。
- 每条均按人物身份、时代、县域/支系、场景和证据边界单独编写；历史人物命令与证言逐项核源，方言不夸张表演，曲词/声线/仪式须授权，危险工艺不提供操作教程，私人婚礼和限制性祭仪不擅自复刻。
- 67 项均以“对白/旁白口吻（非知识事实）”显式标注，没有把运行时机器兜底原样写回知识事实。
- 全库 289 条当前原始生产字段缺口为 0、机器兜底字段为 0、运行时有效缺口为 0；B1—B4 源字段治理机器目标全部完成。
- 原始字段治理账本已成功刷新并通过 `--check`：`raw_gap_count=0`、`affected_entry_count=0`、`recovered_from_raw_markdown=231`。内容供应进度报告中的 168 项旧统计和 402 项旧建议动作也已同步为 0 项缺口与 399 项建议动作。
- 15 类型 Domain Pack comparison 本轮成功 `--check`，15/15 类型均有 trace、预期包、active prompt delta 和稳定 readiness，失败 invariant 为 0。

全流程验证：服务层端到端组合 14 文件/76 项通过，覆盖知识准备、15 类型生成矩阵、Blueprint、质量门禁、repair、项目版本、GEARS、Seedance prompt 与 provider retry；MCP 全量 110 文件/556 项通过；Server 全量 204 文件/1679 项通过（1 文件/2 项按既有配置跳过）；MCP build、Server lint 与 production build 通过。隔离四种子全功能 smoke 的沙箱外执行申请被自动审批基础设施 `input[6].namespace` 错误拒绝，沙箱内又触发 `tsx` IPC `listen EPERM`，脚本没有实际进入业务阶段；本轮未把它记为产品失败，也未绕过执行。知识合同审计刷新同样被审批基础设施拒绝，最后有效快照仍为 272 条；其余当前主链与源字段机器门禁未发现产品问题。

### 6.20 M4 第一切片：15 类型 × 3 变体机器质量与修复基线

在既有 45 案例稳定性矩阵中加入逐案例 `story-agent-machine-quality-evidence/v1`，不再只报告故事、图片和预制品是否交付：

- 每例固化总质量、发布门禁、类型分、大纲覆盖、pattern、GEARS、专业候选机器分、开放修复动作、实际 repair trace、逐场事实/文化边界和基础可拍字段。
- 15×3 聚合报告增加按变体与按片型切片，并把质量状态独立标为 `attention_required`；不改变既有交付矩阵 `ready`，避免把“图片/预制品齐备”和“故事质量通过”混成一个信用。
- repair 明确区分 `attempted`、`applied` 和生成后仍开放的 action；本地矩阵 43/45 曾尝试、0/45 应用、仍有 126 个开放动作，不将建议数量冒充实际修复次数。
- 所有机器证据固定 `machine_validation_only=true`、`human_review_complete=false`、`professional_credit_granted=false`；专业候选机器分不授予专业通过。
- 正式基线写入 `data/reports/story-agent-writing-capability-m4-15x3-machine-evaluation.json`；独立 Node 审计逐项从 45 个明细重算汇总，拒绝案例数、切片数、边界信用或计数漂移。
- 复用的历史项目会通过只读 `rebuildDerivedStoryState` 按当前质量器重算证据，不修改项目版本或历史快照，避免基线长期携带旧算法结果。
- 修复了质量器把三分钟制作约束、30 秒压缩指令、事实边界和镜头约束误当剧情大纲节点的问题；创作约束不再产生大纲覆盖假失败，真实改编情节仍参与覆盖评估。

2026-08-13 第一版重算结果（已由 6.21 的第二版基线取代）：交付矩阵仍为 45/45 story/professional script/prompt/image/preproduction ready，隐藏 fallback 0，复用项目 45；质量报告 45/45，事实文化机器门禁 45/45，逐场事实边界、文化边界和基础可拍字段均 45/45。综合质量通过 7/45、故事可发布 38/45、生产门禁 0/45；平均类型分 85.09、大纲覆盖 95、pattern 68.02、GEARS 77.47、专业候选机器分 96.73。长稿可发布由修复前 0/15 提升为 15/15，综合通过 3/15；改编/压缩压力变体为 1/15 综合通过、9/15 可发布。失败聚类为 pattern 40、combined 30、GEARS 27、outline 4；故事阻断为 outline 3、narrative 7。保留本段仅用于变化追踪，当前数字以 6.21 为准。

验证：三个新增行为均先红后绿；最终定向 2 文件/16 项通过，覆盖两类约束过滤以及 45 案例生成、复用、当前质量重算、部分图片回执、补齐和幂等。正式 `smoke:story-agent-15x3-stability` 在沙箱内因已知 `tsx` IPC `listen EPERM` 失败，获批转到沙箱外后成功刷新矩阵与 M4 基线；独立 `audit:story-agent-m4-machine-evaluation`、Server lint、production build 均通过；最终 Server 全量 204 文件/1681 项通过，1 文件/2 项按既有配置跳过。该 IPC 失败不计产品失败。

### 6.21 M4 第二切片：诊断聚类、机制激活契约、GEARS 去重与评估幂等

围绕首版基线中 `pattern=40`、`GEARS=27` 的失败聚类继续治理，先补证据再改行为：

- 逐案例机器证据新增 `weak_pattern_signal_labels` 和 `gears_issues`，聚合报告新增弱 pattern 信号与 GEARS 具体问题频次；M4 独立审计会从 45 个明细重算这两类聚合，拒绝只改总数不改证据。
- 修正“推荐候选 = 本次全部激活”的契约膨胀：显式选择只激活合法选择；未显式选择时按 15 类默认容量激活 1—2 个机制。完整推荐列表仍保留给 UI/下一轮选择，不再把 3 个推荐项全部升级成强制验收项。
- 15×3 请求指纹加入矩阵契约版本，质量/生成合同变化会生成新项目，不会把新规则套在旧 creation contract 上伪装改善。
- 修复生产素材与 GEARS 双重扣分：`production_material` 提醒继续保留在 delivery `validation_notes`，但 GEARS 质量门只计算角色/场景资产、供稿单元和提示合同本身，不再因同一素材缺口重复触发两个修复目标。
- 收窄 prompt 污染误报：观众可见的“为什么”问题不再自动判为内部说明；`质量信号`、`核心画面是`、`资料/摘要` 等内部标签仍被阻断。
- 不降低 35 字 GEARS 剧情门槛，直接补强历史高潮、知识讲解开场和社交短视频结尾模板的地点、动作、发现/冲突与画面收束。最终 45/45 GEARS readiness 为 100，GEARS issue/repair target 从 27 例降为 0。
- 修复首次生成与项目复用的质量漂移：改编检查不再依赖会在 API 边界剥离的 `_request_meta`，改用持久化的 `adaptation_analysis`；15×3 回归现要求首次生成与复用重评的 45 份机器证据和整份聚合完全相等。
- 5 个改编压力输入改为人物、地点、行动、阻力和后果完整的真正原作片段，不再让“原作第一段”“行动开场”等元指令进入人名与主线分析。

2026-08-13 第二版正式重算（指标展示已由 6.22 第三版补全）：45/45 故事、专业文本、提示和图片请求就绪，隐藏 fallback 0；机器质量报告、事实文化门禁、逐场事实/文化边界和基础可拍字段均 45/45。故事可发布 38/45，生产就绪 0/45；平均类型分 87.73、大纲覆盖 95、pattern 68.93、GEARS 100、专业候选机器分 96.73。旧综合 `quality_passed=0/45` 同时要求 production material，不得与“故事可发布 38/45”混称；6.22 已新增不含生产素材的创作质量指标。开放动作 125，聚类为 production material 42、pattern 40、combined 37、outline 4、family 2；GEARS 聚类已为 0。repair attempted 45、applied 0，机器证据仍不授予真人、专业或外部模型信用。

验证：新增行为均先红后绿；定向覆盖叙事矩阵、pattern 库、质量工作流、生成模板、改编质量与 15×3 首次/复用幂等。正式 15×3 smoke 在沙箱内仍因 `tsx` IPC `listen EPERM` 失败，获批转到沙箱外后成功刷新；该限制不计产品失败。最终全量验证数字见第 8 节最新记录。

### 6.22 M4 第三切片：创作质量与生产就绪指标拆分

修复第二版基线中 `quality_passed=0/45` 会持续掩盖创作侧真实通过情况的问题，同时保持现有 API 兼容：

- 不改写既有 `quality_report.passed` 和逐例 `quality_passed`，明确将其标为 `legacy_quality_report_aggregate`；历史调用方继续获得原语义。
- 新增逐例 `story_quality_passed`：要求 `story_publishable=true`、pattern 分不低于 70、GEARS 文本合同分不低于 70；不混入 production material、真实资产或外部 Provider。
- 新增逐例 `production_material_ready`：只表示 `production_material_gate` 通过；与要求全部故事和生产门的 `production_ready` 分开。
- 15×3 总表、按三种 variant 和按 15 个片型切片均新增两项计数，并固化 `metric_contract`，机器消费者无需猜测字段语义。
- `every_story_quality_passed` 改为检查新的创作质量指标；legacy 计数仍保留观察，但不再错误地主导创作质量 invariant。
- 独立审计会逐例重算两个新布尔值、五类总计、三种 variant、15 个片型、全部 invariant 和 failed list；只修改自报汇总无法通过。
- 正式基线 boundary 明确：旧综合质量含生产素材，新创作质量排除素材/资产/外部 Provider，生产素材通过又排除资产/外部 Provider。

2026-08-13 第三版正式重算：`quality_passed(legacy)=0/45`、`story_quality_passed=15/45`、`story_publishable=38/45`、`production_material_ready=3/45`、`production_ready=0/45`。其中创作质量按 canonical/extended/adaptation-or-compact 分别为 6/15、6/15、3/15；生产素材分别为 1/15、1/15、1/15。其余质量值与第二版一致：事实文化、逐场事实/文化边界和基础可拍字段 45/45，GEARS 45/45，开放动作 125。四组数字是不同范围的并列指标，不得串成单一漏斗或授予人工/专业信用。

验证：契约测试先红后绿；15×3 服务链 1 文件/1 项通过，覆盖 45 例首次生成、复用一致性、部分图片回执、补齐和幂等。正式 smoke 在已批准的沙箱外路径成功刷新且复用项目 45/45；M4 独立审计逐例、逐切片重算通过。Server lint、production build 和最终全量 205 文件/1685 项通过，2 项按既有配置跳过、0 失败；`git diff --check` 通过。

### 6.23 M4 第四切片：创作 repair 与生产素材缺口解耦

- 定位到生成后自动 repair 仍以 legacy `quality_report.passed` 为触发条件，导致仅 production material 未通过的 15 个创作合格案例也尝试重写正文。
- 抽出统一 `isStoryQualityPassed` helper，由自动 repair 与 15×3 机器证据共同复用；有 `quality-gates/v2` 时按“故事可发布 + pattern≥70 + GEARS≥70”判断，没有新门禁的历史报告继续使用 legacy `passed`，保持向后兼容。
- 显式项目质量修复 API、production material action 和生产 Board 通道未被移除；本切片只阻止生成主链用生产素材缺口误触发正文 repair。
- 15×3 矩阵 creation contract 升为 v5，确保新 repair 规则不会套在旧项目上；第一次生成 45 个新项目，第二次正式复核复用 45/45 且机器证据稳定。
- 新增 `repair_attempt_matches_story_quality_failures` invariant 和独立审计重算：逐例有 repair attempt 当且仅当创作质量未通过。
- 正式重算 repair attempted 由 45/45 降至 30/45，恰等于创作质量未通过 30 例；applied 仍为 0。创作质量 15/45、故事可发布 38/45、生产素材 3/45、平均分和 125 个开放动作均未变化，因此这是无效工作清理，不计作内容质量提升。

验证：新增 repair 触发测试先红后绿；定向 3 文件/11 项通过，随后 15×3 正式刷新和复用复核通过；M4 独立审计、Server lint/build 通过。首次变更后全量中未改动的 reference benchmark 组合用例发生一次并发时序失败，单文件随即 3/3 通过；最终完整复跑 205 文件/1685 项通过、2 项既有跳过、0 失败。

### 6.24 M4 第五切片：改编原作落地、山水低密度合同与可发布清零

- 改编人物抽取不再对任意高频汉字块做伪姓名识别；改为保守的动作主语、称谓、昵称、具名角色和群体识别。五组正式改编压力素材均能识别真实人物/群体，且不再输出“决定拒签”“消息提前”等伪称谓。
- `adapt_user_novel` 的用户原作与 `adaptation_analysis` 已显式进入本地生成器。只有剧情类改编模式启用这条受控分场路径；普通知识生成、外部模型 Prompt 和既有毛泽东成长专线保持原行为。原作节拍现在进入 plot、人物、地点、动作、事实边界和类型化结尾余味，不再只参与生成后扣分。
- 山水意境按每场时长生成不同密度文本；30 秒版本旁白密度不超过每秒 2.5 个内容字符，旁白只保留首尾两句。诗性“留白/余味”只作为 `landscape_mood` 的结尾落点，不放宽其他剧情类型。
- GEARS 对山水短句不再机械套用剧情 plot 35 字门槛：只有当 key action、visual prompt、camera suggestion 已共同给出足够自然运动与可执行画面时才认可简短 plot。山水 GEARS issue 从 7 项清零，三种时长均回到 100 分。
- 山水专业文本的 `full_text_not_final` 门按目标时长区分：30 秒完整诗性视听弧允许短文本，但 dense narration 门仍独立保留，避免用字数填充破坏留白。
- 15×3 creation contract 由 v5 迭代到 v9，确保每次行为变化生成新项目；v9 同契约复跑复用 45/45，场景资产规范化后的指纹、项目和机器指标稳定。
- 最终正式基线：legacy 0/45、创作质量 17/45、故事可发布 45/45、生产素材 3/45、全生产就绪 0/45；大纲覆盖均分 100、GEARS 均分 100、事实文化门禁及逐场事实/文化边界与基础可拍字段均 45/45。故事阻断 gate 归零，开放动作 125→119，repair attempted 30→28、applied 0，且 repair 对齐 invariant 保持 true。
- 机器报告仍为 `attention_required`：pattern≥70 的创作质量只有 17/45，42 个案例缺 production material，45 个案例缺真实资产和外部 Provider；机器结果不授予真人、专业、外部模型或成片信用。

验证：适配提取、五类本地改编分派、30 秒山水密度/结尾、山水专业文本与 GEARS 单元均先红后绿；全量测试暴露改编地点名与 Seedance 场景 slot 不一致后，新增地点规范化回归并修复，15×3 部分回执→全量补齐生命周期重新通过。v9 canonical 与 15×3 正式 smoke 成功，复跑复用 45/45；M4 独立审计、Server lint/build、`git diff --check` 通过。最终 Server 全量 205 文件中 204 通过、1 跳过，1698 项通过、2 项按既有配置跳过、0 失败。

### 6.25 M4 第六切片：城市/空间可观察证据与 repair 历史语义

- pattern 质量判定补充城市品牌可观察证据：只有场景内出现可识别地名或地标、至少两类具体日常主体/动作、以及地标与地域价值表达同时成立时，才认可地方名词、生活气息、品牌地方感与城市气质；顶层口号和质量标签仍不能得分。
- 场景短片补充空间合同证据：空间身份必须由真实空间类型与地名共同建立；路线要出现两个以上连续移动动作；节点功能、古今时间层和氛围收束都要求具体场景动作、用途、声音或留白镜头，不能用“空间感”等抽象词替代。
- 城市品牌三种变体 pattern 均分 69→95、场景短片 65→89，两类均由 0/3 提升为 3/3 创作质量通过；新增 6 个通过案例来自已有场景证据被准确识别，不改写文化事实或虚构外部素材。
- 评估合同升级后，3 个场景短片的历史 repair trace 仍如实保留：生成当时按旧评估尝试过 repair，当前派生状态按新合同已通过。原 `repair_attempt_matches_story_quality_failures` 双向等价不变量因此收紧为可长期审计的单向 `repair_attempt_covers_story_quality_failures`——当前未通过案例必须有 repair 尝试，后来通过的案例允许保留历史尝试。
- v10 正式基线：legacy 0/45、创作质量 23/45、故事可发布 45/45、生产素材 3/45、全生产就绪 0/45；平均 pattern 69.78→73.11，开放动作 119→113。repair attempted 为 25，其中 22 个对应当前创作失败、3 个是上述历史尝试，applied 仍为 0。
- 45/45 故事、专业文本、提示、图片请求、事实文化门禁、逐场事实/文化边界与基础可拍字段保持；GEARS 仍为 45/45，图片任务保持 75。production material 缺口 42、真实资产和外部 Provider 缺口各 45，机器结果仍不授予真人、专业、外部模型或成片信用。

验证：城市品牌和场景短片合同均先红后绿；定向质量/repair/15×3 共 3 文件 24 项通过。v10 canonical 与 15×3 正式 smoke 成功，15×3 同契约复跑复用 45/45；M4 独立审计按新单向 invariant 重算通过。Server lint、production build 与 `git diff --check` 通过。首次全量在未改动的 run 列表稳定游标 API 用例发生一次固定 5 秒并发超时，该用例单独复跑 24ms 通过；最终完整复跑 205 个测试文件中 204 通过、1 个既有跳过，1700 项通过、2 项既有跳过、0 失败。

### 6.26 M4 第七切片：社交首尾位置合同与教学闭环结构证据

- 社交短视频的 pattern 判定改为位置敏感的可观察证据：首场必须同时承担钩子功能、问句/反常识答案和视觉近景；信息段必须出现枚举结构与至少三类具体信息；字幕节奏要求文字覆盖与快切/定格等画面动作同场；结尾 payoff 只能由末场的记忆句、答案回收和定格/同框行动建立。
- 教学训练型补充完整闭环：学习目标必须可测量，步骤场景必须存在明确顺序，练习必须包含实际动作与练习载体，评估必须出现检查或评分，总结必须回顾有序要点。只有“练习”“复盘”等空标签不会得分。
- 增加反例门禁：放在中段的社交问句不能冒充前三秒钩子；无任务、无载体的教学标签不能冒充练习或复盘。该合同识别已有场景证据，不改写文化事实、生成正文或外部素材。
- 社交短视频三种变体 pattern 61→96、教学训练三种变体 61→99，两类均由 0/3 提升为 3/3 创作质量通过。v11 正式基线为 legacy 3/45、创作质量 29/45、故事可发布 45/45、生产素材 3/45、全生产就绪 0/45；平均 pattern 73.11→77.98，开放动作 113→104。
- repair attempted 降为 19：16 个覆盖当前全部创作失败，另 3 个是场景短片历史尝试；applied 仍为 0，单向 invariant 保持 true。事实文化、逐场边界、基础可拍字段、GEARS 和图片请求仍为 45/45，图片任务保持 75；42 个 production material、45 个真实资产和 45 个外部 Provider 缺口未被冒充为通过。

验证：社交/教学正反例均先红后绿；质量工作流 1 文件/23 项与 15×3 服务链 1 文件/1 项通过。v11 canonical 与 15×3 正式 smoke 成功；同契约复跑复用 45/45、指标不漂移，M4 独立审计在首次生成和复用后均通过。Server lint、production build 与 `git diff --check` 通过；最终全量 205 个测试文件中 204 个通过、1 个既有跳过，1703 项通过、2 项既有跳过、0 失败。机器结果仍不授予真人、专业、外部模型或成片信用。

### 6.27 M4 第八切片：讲解认知链与宣讲论证链证据

- 知识讲解型补充位置敏感的认知链：首场必须以可见对象提出明确问题；概念场必须出现三层或有序层级；类比/案例必须把具体对象与图示、局部变化或现场对应；末场必须以三点/有序字幕完成可复盘总结。
- 主题宣讲型补充论证链：首场提出可辨识的中心观点；事实案例场必须包含年代、人物、地点或史料/现场线索；分析场把案例拆成有序价值判断；现实映射场落到今天的具体学习/工作/行动；末场号召必须给观众可以执行的动作。
- 增加空标签反例：只有“提出问题”“案例支撑”“现实连接”等场景标题，正文没有问题、事实、层级或行动时仍判弱，不允许用功能名冒充内容证据。本切片只识别正式正文已经具备的结构，不改写文化事实或生成素材。
- 知识讲解三种变体 pattern 49→96、主题宣讲三种变体 54→96，两类均由 0/3 提升为 3/3 创作质量通过。v12 正式基线为 legacy 3/45、创作质量 35/45、故事可发布 45/45、生产素材 3/45、全生产就绪 0/45；平均 pattern 77.98→83.91，开放动作 104→92。
- repair attempted 降为 13：10 个覆盖当前全部创作失败，另 3 个是场景短片历史尝试；applied 仍为 0，单向 invariant 保持 true。事实文化、逐场边界、基础可拍字段、GEARS 和图片请求仍为 45/45，图片任务保持 75；42 个 production material、45 个真实资产和 45 个外部 Provider 缺口继续保持阻断。

验证：知识讲解/主题宣讲正反例先红后绿，质量工作流 1 文件/26 项与 15×3 服务链 1 文件/1 项通过。v12 canonical 与 15×3 正式 smoke 成功；同契约复跑复用 45/45、指标不漂移，M4 独立审计在首次生成和复用后均通过。Server lint、production build 与 `git diff --check` 通过；最终全量 205 个测试文件中 204 个通过、1 个既有跳过，1706 项通过、2 项既有跳过、0 失败。机器结果仍不授予真人、专业、外部模型或成片信用。

### 6.28 M4 第九切片：山水自然状态链、旁白密度与留白证据

- 山水意境型改为识别自然状态链：自然意象必须同时出现峰、谷、云雾、风雨、水声等对象与露出、上升、掠过、移开、退下等状态变化；“山水开卷”“诗意”等标签本身不能得分。
- 光影季节要求同场出现至少三个具体时相或天气光线，并存在先后变化；只有“四季蒙太奇”镜头名不算证据。因此 canonical 与 3 分钟版仍如实保留光影弱项，30 秒版因晨光、雨雾、暮色同场成立而通过。
- 旁白低密度按全片统计：角色为空、旁白总量受限且非每场口播；留白只认可末场自然声音退场、远景固定/空镜和停留动作共同成立。全程讲解员口播即使场景标题写“留白”仍不能得分。
- 山水意境三种变体由 0/3 提升为 3/3 创作质量通过；canonical/3 分钟 pattern 56→85，30 秒 56→96。v13 正式基线为 legacy 3/45、创作质量 38/45、故事可发布 45/45、生产素材 3/45、全生产就绪 0/45；平均 pattern 83.91→86.09，开放动作 92→90。
- repair attempted 保持 13：7 个覆盖当前全部创作失败，另 6 个是场景短片和山水意境按旧评估生成时留下的历史尝试；applied 仍为 0，单向 invariant 保持 true。事实文化、逐场边界、基础可拍字段、GEARS 和图片请求仍为 45/45，图片任务 75；42 个 production material、45 个真实资产和 45 个外部 Provider 缺口继续阻断生产就绪。

验证：山水正反例先红后绿，质量工作流 1 文件/28 项与 15×3 服务链 1 文件/1 项通过。v13 canonical 与 15×3 正式 smoke 成功；同契约复跑复用 45/45、指标不漂移，M4 独立审计在首次生成和复用后均通过。Server lint、production build 与 `git diff --check` 通过；最终全量 205 个测试文件中 204 个通过、1 个既有跳过，1708 项通过、2 项既有跳过、0 失败。机器结果仍不授予真人、专业、外部模型或成片信用。

### 6.29 M4 第十切片：儿童温和冲突、因果学习与可见暖结尾

- 按儿童文化故事规则建立可观察合同：语言简单要求短句与柴绳、木柴、花篮、家门、暖灯等具体物件及捡、捆、听、看、核对、送回等动作共同成立，不以低龄标签或抽象口号判定。
- 温和冲突必须由害怕、怀疑、身份差异、误会或日常物件问题构成，并让主角通过倾听、观察、核对等非暴力方式回应；出现殴打、虐待、血腥等残酷内容时不得得分。
- 因果学习要求场景顺序满足“压力/误会 → 观察到具体善意 → 做出可见选择”；暖结尾要求末场伙伴共同完成回家、送柴、放下柴担、歌声或挥手等动作，并有暖灯、暖色或清晨空间。黑屏口号或旁白宣称“要善良”不能冒充结局。
- 儿童故事三种变体由 0/3 提升为 3/3 创作质量通过；canonical/3 分钟 pattern 61→95，改编/压缩 52→73。改编版仍保留主题保真与因果弱项，没有被抬成高分。v14 正式基线为 legacy 3/45、创作质量 41/45、故事可发布 45/45、生产素材 3/45、全生产就绪 0/45；平均 pattern 86.09→88.07，开放动作 90→86。
- repair attempted 由 13 降为 10：4 个覆盖当前全部创作失败，另 6 个是场景短片和山水意境历史尝试；applied 仍为 0，单向 invariant 保持 true。事实文化、逐场边界、基础可拍字段、GEARS 和图片请求仍为 45/45，图片任务 75；42 个 production material、45 个真实资产和 45 个外部 Provider 缺口继续阻断生产就绪。

验证：儿童正反例先红后绿，期间修正一次测试夹具误把 `visual_prompt` 写成数组的问题；修正后旧实现仅正例失败、反例稳定通过。质量工作流最终 1 文件/30 项与 15×3 服务链 1 文件/1 项通过。v14 canonical 与 15×3 正式 smoke 成功；同契约复跑复用 45/45、指标不漂移，M4 独立审计在首次生成和复用后均通过。首次 lint 发现两处测试夹具使用非法 `presentation_style: animation`，改为合法 `animation_2d` 后 lint 与定向测试通过；production build、`git diff --check` 通过，最终全量 205 个测试文件中 204 个通过、1 个既有跳过，1710 项通过、2 项既有跳过、0 失败。机器结果仍不授予真人、专业、外部模型或成片信用。

### 6.30 M4 第十四切片：人物故事派生素材证据与历史项目重算

- 人物故事 readiness 不再只依赖原始素材中是否逐字出现模板字段名；生成后会从角色表、人物同场关系、对白/旁白、可信度说明、逐场事实依据与末场收束中确定性派生人生阶段窗口、人物关系图、人物语言声线、生平事实边界和结尾影响余韵。
- 派生条件保持可观察且保守：人生阶段必须出现少年/青年/初任等明确阶段证据；至少两名角色并实际同场才形成关系图；事实边界必须同时有来源/依据、创作补位说明和逐场 `factual_basis`。人物改编压力例虽有完整事件窗口，但没有人生阶段证据，因此继续阻断，未按片型标签硬抬通过。
- 修复历史项目只读质量重算仍沿用旧 readiness 的生命周期缺口：`rebuildDerivedStoryState` 现在先刷新 production material readiness，再重算质量门禁。15×3 复用 45/45 历史项目时可以消费新识别合同，但不写回或篡改既有项目版本。
- 外部证据继续 fail closed：官方目录/资源链接、社区或传承人同意、记录影音资产、采访片段、现场笔记、参考图/关键帧、单镜头实测、权利署名与场地许可仍只认源素材，不能由生成正文、分场或 GEARS 推断通过。
- 正式基线由 legacy/生产素材 11/45 提升到 13/45，production material 阻断 34→32，开放动作 76→74；人物故事 canonical 与 extended 转为 production material ready，改编压力例继续阻断。创作质量、故事可发布、事实文化、逐场事实/文化边界、基础可拍字段和 GEARS 均保持 45/45；全生产就绪仍为 0/45，真实资产与外部 Provider 仍各阻断 45/45。

验证：人物派生、历史项目派生状态与 15×3 服务链定向 3 文件/34 项通过；正式 15×3 smoke 在沙箱内按已知 `tsx` IPC `listen EPERM` 失败，获批在沙箱外运行后复用 45/45 并刷新报告。M4 独立审计从 45 个逐例证据重算通过；Domain Pack 15 类型 comparison 陈旧报告已刷新并通过 `--check`，15/15 trace、预期包、prompt delta 与 readiness 稳定不变量保持。Server lint、production build 与最终全量 205 个测试文件中 204 个通过、1 个既有跳过，1719 项通过、2 项既有跳过、0 失败。机器结果仍不授予真人、专业、真实资产、外部模型或成片信用。

### 6.31 M4 第十五切片：教学概念分层与掌握检查派生证据

- 教学训练 readiness 现在可以从生成后的结构化教学场景中派生 `concept_definitions` 和 `assessment_check`，不再要求源素材逐字写出模板字段名。概念证据只接受知识讲授、概念讲解或分步讲解场景中的明确“是指/定义为”等定义，或同时包含第一层、第二层与分类区分动作的有序讲授。
- 掌握检查只接受检验、评估或掌握检查场景中的可执行任务：学习者必须能够指出、判断、选择、回答、完成或说明，并且场景给出分类、答案、反馈、依据、标准或关系等判定口径。仅有“知识讲授”“检验反馈”戏剧功能标签、普通旁白或“继续讲述”不能生成证据。
- 三个 `education_training` 变体均已有“地点—事件—文化解释”的分层讲授与时间关系检验，因此由 0/3 提升为 3/3 production material ready，开放动作归零。正式基线由 legacy/生产素材 13/45 提升到 16/45，production material 阻断 32→29，开放动作 74→71。
- 创作质量、故事可发布、事实文化、逐场事实/文化边界、基础可拍字段与 GEARS 继续保持 45/45；全生产就绪仍为 0/45，真实资产和外部 Provider 仍各阻断 45/45。官方链接、授权、参考图、场地许可等外部证据合同未放宽。

验证：教学训练正反例先红后绿；派生 readiness、历史项目派生状态与 15×3 服务链定向 3 文件/35 项通过。正式 15×3 smoke 在已批准的沙箱外路径复用 45/45 并刷新报告；M4 独立审计从 45 个逐例证据重算通过。Server lint、production build 与最终全量 205 个测试文件中 204 个通过、1 个既有跳过，1720 项通过、2 项既有跳过、0 失败。机器结果仍不授予真人、专业、真实资产、外部模型或成片信用。

### 6.32 M4 第十六切片：儿童可见行动例子与结尾复盘派生证据

- 儿童故事 readiness 现在可以从生成后的结构化分场派生 `concrete_examples` 与 `parent_teacher_note`。具体例子只接受学习成长、探索发现、做出选择或勇敢选择场景中具有连续顺序的可见行动，例如先听说明、再观察柴绳和柴担、最后核实误会；场景必须同时具备足够具体的 plot 与 key action。
- 家长/教师提示只接受末场温暖结尾、成长收获或情绪安放中已经写出的可复用行为复盘，且必须能落到“先看行动再判断”“需要勇敢和判断”“合作或倾听可以练习”等儿童可讨论方法。仅有“善良很重要”“故事温暖结束”之类口号不能派生提示。
- 三个 `children_story` 变体均有观察、核对、帮助、送柴与行为复盘，因此由 0/3 提升为 3/3 production material ready。正式基线由 legacy/生产素材 16/45 提升到 19/45，production material 阻断 29→26，开放动作 71→67；儿童故事仍保留 1 个独立 pattern 优化动作，未因素材门转绿而抹除。
- 创作质量、故事可发布、事实文化、逐场事实/文化边界、基础可拍字段与 GEARS 继续保持 45/45；全生产就绪仍为 0/45，真实资产和外部 Provider 仍各阻断 45/45。外部证据合同没有放宽。

验证：儿童派生正反例先红后绿；派生 readiness、历史项目派生状态与 15×3 服务链定向 3 文件/36 项通过。正式 15×3 smoke 在已批准的沙箱外路径复用 45/45 并刷新报告；M4 独立审计从 45 个逐例证据重算通过。Server lint、production build 与最终全量 205 个测试文件中 204 个通过、1 个既有跳过，1721 项通过、2 项既有跳过、0 失败。机器结果仍不授予真人、专业、真实资产、外部模型或成片信用。

### 6.33 M4 第十七切片：AI 漫剧 scene/GEARS 镜头提示分层证据

- AI 漫剧 readiness 现在可以从同一 `source_scene_id` 对齐的 StoryScene 与 GearsSegment 派生 `shot_prompt_layers`。证据必须同时覆盖主体与动作、前中后景或同框位置、特写/近中全景/对切/跟拍等镜头层，以及光线或日夜时段，不能只凭一条泛化 `visual_prompt` 得分。
- 正例把“雨夜山屋、刘海停刀护人、狐影后景与柴刀前景、全景切手部特写、冷蓝雷光”等层次同时落到场景画面、镜头建议、GEARS visual focus 与 segment prompt hint；负例“高质量漫画、人物清晰、电影感、镜头推进”继续 fail closed。
- 该派生只确认已存在的提示词结构，不把参考图、单镜头实测、多镜头连续性或真实图片资产凭空判为完成。AI 漫剧 canonical/extended 原已就绪，改编压力例补齐唯一 `shot_prompt_layers` 后，片型由 2/3 提升为 3/3 production material ready。
- 正式基线由 legacy/生产素材 19/45 提升到 20/45，production material 阻断 26→25，开放动作 67→65；AI 漫剧仍有 3 个独立 pattern 动作。创作质量、故事可发布、事实文化、逐场事实/文化边界、基础可拍字段与 GEARS 保持 45/45；全生产就绪仍为 0/45，真实资产和外部 Provider 仍各阻断 45/45。

验证：AI 漫剧分层正反例先红后绿；测试夹具首次使用非法 `presentation_style: comic_drama` 被 lint 捕获，改为合法 `ai_comic` 后定向 3 文件/37 项和 lint 通过。正式 15×3 smoke 在已批准的沙箱外路径复用 45/45 并刷新报告；M4 独立审计、production build 通过。最终全量 205 个测试文件中 204 个通过、1 个既有跳过，1722 项通过、2 项既有跳过、0 失败。机器结果仍不授予真人、专业、真实资产、外部模型或成片信用。

### 6.34 M4 第十八切片：历史改编日期—证据—行动因果链派生

- 本切片先审计场景短片候选，发现当前三变体只有无主体的“走进/脚步”文案，场景都停在岳麓书院同一地点，不能诚实派生 `entering_character`、`movement_route` 与 `visual_reveal`。因此没有放宽门禁，场景短片仍保持阻断，后续应修生成器以产出真实入场主体和跨节点路线。
- 转而为 `historical_drama` 建立严格的生成后事件链证据：至少两场包含明确年月日，两场以上分别提供 `factual_basis` 与合成再现/影视化补足说明，风险必须落到搜捕、暴露、伤亡、失败或封锁等具体后果，场景之间还必须出现“因为/导致/获得弹药后才可推进”等跨地点因果。
- 各方立场要求新军士兵、起义军、普通士兵、清军、守军或军官中至少三类行动主体形成搜捕、封锁、阻拦与推进对撞；史料证据层级要求 credibility note 和逐场字段共同区分知识条目/用户素材依据与有限再现。泛化“时代风云激荡、人物行动、历史余响”模板没有日期、逐场依据和补足边界，继续 fail closed。
- 历史改编压力例已有 10月9日泄密搜捕、10月10日提前发动、楚望台军械库行动及其后续推进因果，补齐历史事件锚点、时间窗口、利害、立场、因果链、证据层级、有据行动和冲突转折；canonical/extended 因仍是模板化“武昌”人物与泛化行动而保持阻断。片型 production material ready 0/3→1/3。
- 正式基线由 legacy/生产素材 20/45 提升到 21/45，production material 阻断 25→24，开放动作 65→63。创作质量、故事可发布、事实文化、逐场事实/文化边界、基础可拍字段与 GEARS 保持 45/45；全生产就绪仍为 0/45，真实资产和外部 Provider 仍各阻断 45/45。

验证：历史事件链正反例先红后绿；派生 readiness、历史项目派生状态与 15×3 服务链定向 3 文件/38 项通过。正式 15×3 smoke 在已批准的沙箱外路径复用 45/45 并刷新报告；M4 独立审计、Server lint、production build 通过。最终全量 205 个测试文件中 204 个通过、1 个既有跳过，1723 项通过、2 项既有跳过、0 失败。机器结果仍不授予真人、专业、真实资产、外部模型或成片信用。

### 6.35 M4 第十九切片：场景短片入场主体与空间路线生成

- `scene_short` 不再沿用“无人物+同一地点+走进/脚步”的通用非剧情模板；生成器现会从 `asset_split` 提取稳定的寻访者标签、门庭、院落和讲堂节点，显式生成入场、右侧廊道前进、推门显现与沿原路不跨轴返回。
- 真实条目的人物、场景和陈设字段使用“名称：说明”形式；新增标签正规化会去掉说明后缀，避免把整段描述当成角色名或地点名。寻访者同时进入顶层角色与 GEARS 角色资产，场景短片因此可导出有镜头绑定的图片任务。
- readiness 只在同一寻访者跨至少 3 场、地点实际变化、有明确路径语句、空间遮挡/显现和同侧回程证据共同成立时，才派生 `entering_character`、`movement_route`、`visual_reveal` 与 `spatial_continuity`；无人物同地点模板继续 fail closed。
- v21 正式基线有意重生成 45/45 项目，`scene_short` 三变体 production material ready 0→3；整体 legacy/生产素材 21→24，素材阻断 24→21，开放动作 63→54，repair attempted 6→3。创作质量、故事可发布、GEARS、事实文化与逐场边界保持 45/45；全生产就绪仍为 0/45，真实资产和外部 Provider 仍各阻断 45/45。

验证：场景短片生成与 readiness 正反例先红后绿；定向 4 文件/46 项通过。正式 15×3 smoke 重生成 45/45 并刷新报告，M4 独立审计通过；M3 ProductionMaterial、Domain Pack 与 15 类对比三项 `--check` 均通过。Server lint/build 通过；首次全量中既有 Stage 8 路由隔离用例受并发环境污染从预期 404 变为 401，单文件 8/8 立即通过；完整复跑 205 个文件中 204 通过、1 个既有跳过，1725 项通过、2 项既有跳过、0 失败。机器结果仍不授予真人、专业、真实资产、外部模型或成片信用。

### 6.36 M4 第二十切片：历史剧情知识直生事件链

- 将已经在用户改编路径验证的武昌起义六场行动链提升为知识直生能力：canonical 1 分钟和 extended 3 分钟均从 10 月 9 日泄密/搜捕、10 月 10 日提前发动、营门对峙、楚望台军械库争夺、获得弹药后向湖广总督署推进，收束到普通士兵引发连锁响应。
- 知识直生与用户改编共用行动结构，但保持来源语义分层：知识直生只标条目依据，改编路径才标“用户提供改编素材”；两者都把无名士兵反应、走位和镜头调度标为有限合成再现，不伪造唯一“第一枪”人物。
- v22 正式基线有意重生成 45/45；`historical_drama` production material ready 1/3→3/3，整体 legacy/生产素材 24→26，素材阻断 21→19，开放动作 54→50。历史剧情平均 pattern 75.67→86.33，仍保留 3 个制度压力表现力优化动作，未为追求分数放宽信号。

验证：知识直生 1 分钟/3 分钟正例先红后绿；场景生成、readiness、剧情质量、quality workflow 与 15×3 服务链定向 5 文件/88 项通过。正式 15×3 smoke 重生成 45/45，M4 独立审计、Server lint/build 通过。机器结果仍不授予真人、专业、真实资产、外部模型或成片信用。

### 6.37 M4 第二十一切片：传说版本—神异规则—凡人选择—戏曲流变生产证据链

- 对 `刘海砍樵` 知识直生与用户改编共用的五场弧线补齐生产语义：常德武陵口述传说承担剧情主线，长沙花鼓戏承担传播结尾；用户改编变体则明确以用户版本为主线，知识条目只补足来源和传播边界，不把多版本拼成单一史实。
- 神异能力被限定为短暂显出狐影、介入眼前危机，不能替刘海作出选择或免除共同承担的代价；刘海的凡人愿望通过放下武器、回头、并肩抬担兑现。柴担、花篮、狐影从开场回环到戏台薄雾奇观，花鼓戏只按地方民间演艺习俗呈现，不虚构独立祭仪。
- readiness 新增严格的传说派生证据：只有可追溯来源、口述到舞台流变、神异显形—凡人选择—共同后果、跨地域层、重复母题、明确版本选择与奇观收束共同成立时，才派生版本来源、神异规则、凡人欲望、地域版本、习俗关联、版本选择与奇观结尾；两种薄弱通用模板不会因此转绿。
- v23 正式基线有意重生成 45/45；`legend_story` production material ready 0/3→3/3，整体 legacy/生产素材 26→29，素材阻断 19→16，开放动作 50→44。传说故事仍保留 3 个独立 pattern 优化动作，未因素材门转绿而抹除。

验证：知识直生与用户改编 readiness 正例先红后绿；生产素材、剧情质量、本地生成、quality workflow 与 15×3 服务链定向 5 文件/90 项通过。正式 15×3 smoke 重生成 45/45；M4 独立审计、Server lint/build 与 `git diff --check` 通过。本切片未重复完整全量，最后有效全量仍为第十九切片 204 文件/1725 项通过，1 文件/2 项既有跳过、0 失败。机器结果仍不授予真人、专业、真实资产、外部模型或成片信用。

### 6.38 M4 第二十二切片：文化宣传符号—证据—当代—行动链与权利门禁分层

- `岳麓书院` 文化宣传不再套用“材料铺开、针尖、工具声”的通用技艺模板，改为门联/笔记问题开场、976 年创建证据、朱张会讲论辩结构、当代课堂核对来源、门联与笔记回环到访邀请的五场宣传链。
- 类型字段去重视觉符号，并将核心主张改为面向受众的可复述价值，将当代连接绑定第 4 场具体学习行动，结尾记忆句直接来自场景旁白。quality workflow 新增文化宣传专属场景证据判定，要求符号、至少两处有据行动、当代行动和可传播结尾形成顺序链。
- readiness 只在受众印象、五段蒙太奇、逐场不同旁白、来源/再现分层与文化再现风险共同成立时，派生 `cultural_theme`、`audience_impression`、`montage_arc`、`voiceover_register`、`call_to_action` 与 `representation_risk`；`rights_and_attribution` 仍只认真实源素材，三例均只剩这一项缺口。
- v24/v25 正式矩阵先后暴露第 4 场画面提示和由 `key_action` 拼入 GEARS 提示的“资料”噪声，均未掩盖；v26 修复后 GEARS 回到 45/45，`culture_promo` 平均 pattern 83→95、开放动作 9→3，全矩阵开放动作 44→38。由于真实权利字段仍阻断，legacy/生产素材保持 29/45、素材阻断保持 16/45。

验证：readiness 正例先红后绿；生产素材、类型字段、视频类型矩阵、quality workflow、叙事 pattern 与 15×3 服务链定向最终 5 文件/80 项通过。v26 正式 15×3 重生成 45/45，M4 独立审计、Server lint/build 与 `git diff --check` 通过。本切片未重复完整全量，最后有效全量仍为第十九切片 204 文件/1725 项通过，1 文件/2 项既有跳过、0 失败。机器结果仍不授予真实权利、真人、专业、真实资产、外部模型或成片信用。

### 6.39 M4 第二十三切片：纪录短片问题—证据—有限再现—采访留白—当代回答链

- `岳麓书院` 纪录短片新增专用五场弧线：门庭现实问题、976 年碑刻/空间证据、朱张会讲有限再现、馆员/研究者采访规划留白、当代课堂以标出处和交换解释回答开场问题；不再使用重复的“现实引入—文化解释—当代意义”通用旁白。
- 声音设计按场拆为鸟鸣/脚步、纸页、静场、风过树叶和课堂讨论/提问声，并明确这些只是待真实现场采集核验的制作规划。严格 readiness 只有在至少三场、三类声音与真实采集边界同时成立时才派生 `ambient_sound`。
- `interview_clip_selection` 继续属于外部证据字段：生成文本只可写拟邀角色、问题和空白机位，明确“非现成同期声、待真实采访录音后选择”，不会因为出现“采访”字样转绿。自动 `field_notes` 同时由“实地考察记录要点”改为“待实地核验清单”，避免把地点建议冒充已完成田野记录。
- quality workflow 新增纪录短片专属场景证据：现实现场必须带问题和动作，来源提示必须跨场可追溯，边界必须覆盖至少 80% 场景且包含真实采访留白，当代意义必须用具体核对行动回答开场问题。v27 三变体 pattern 89→95，`边界清楚`、`当代意义自然` 两项弱信号全部清零，开放动作 9→3；全矩阵开放动作 38→32。生产素材仍为 29/45、素材阻断仍为 16/45，因为三例均有意只保留真实 `interview_clip_selection`。

验证：生成、类型字段、readiness 与质量工作流均先红后绿，最终定向 4 文件/88 项通过。v27 正式 15×3 首轮重生成 45/45、复跑复用 45/45，指标稳定；M4 独立审计、Server lint/build 通过。本切片未重复完整全量，最后有效全量仍为第十九切片 204 文件/1725 项通过，1 文件/2 项既有跳过、0 失败。机器结果仍不授予真实采访、真人、专业、真实资产、外部模型或成片信用。

### 6.40 M4 第二十四切片：山水空间层次—一日光变—尺度—声景—事实边界链

- `张家界武陵源` 山水意境不再混用天子山、天门山和武陵源，也移除截断的文化意义与“全球唯一”极值表达；专用结构始终限定武陵源同一空间，30 秒使用三场紧凑版，1/3 分钟使用四场完整版。
- 画面逐场明确前景/中景/后景、墨绿/岩灰/雾白到靛蓝/岩黑/暖金的色彩方案、固定机位从清晨冷蓝到日光青绿再到暮色暖金的一日光变、开放栈道行者的人物尺度参照，以及山风/滴水/鸟鸣/脚步/水声由近到远再退场的声景。
- 每场都标明地名、机位、天气与季节事实边界：光线和云雾是待实拍核验的拍摄方案，不作同一天必然出现的承诺，不从生成画面反推峰柱数值。类型字段 `time_layer` 改由场景时间链生成，`atmosphere` 改为可执行声景，不再截取可能含极值或被截断的条目段落。
- 首次 v28 正式项目暴露长文本导致山水家族“感官与留白”门禁失败；未掩盖该结果，压缩观众正文并保留生产信息在镜头/边界字段后，以 v29 新合同强制新建项目验证。最终三变体 genre 均 94、pattern 均 97、production material ready 0→3，开放动作 7→0；全矩阵生产素材 29→32/45、素材阻断 16→13、开放动作 32→25、repair attempted 3→0。

验证：最终定向生成、类型字段、readiness 与质量工作流 4 文件/92 项通过。v29 正式 15×3 首轮重生成 45/45、复跑复用 45/45，指标稳定；M4 独立审计、Server lint/build 与 `git diff --check` 通过。最后有效完整全量仍为第十九切片 204 文件/1725 项通过，1 文件/2 项既有跳过、0 失败。机器结果仍不授予真实天气、场地/肖像许可、真人、专业、真实资产、外部模型或成片信用。

### 6.41 M4 第二十五切片：城市身份—游线—声景—行动—雨备链与场地许可分层

- `岳麓书院` 城市品牌片不再复用单地点通用宣传模板，改为门庭城市身份/目标客群、碑刻与讲堂事实证明、校园当代学习、街巷至湘江城市日常、江岸品牌邀请的五场路线；30 秒、1 分钟和 3 分钟使用同一可审计结构。
- 城市身份被限定为创作提案，不冒充政府审定口径或官方口号；目标客群明确为文化游客与本地市民。路线按门庭阅读→讲堂核对→校园观察→街巷慢行→江岸回望推进，逐场包含到访者动作和至少 4 个不同地点。
- 城市声景拆分为鸟鸣、石阶脚步、晨读、翻页/木门、讨论/自行车铃、卷帘/公交提示音和江风；正式成片只允许真实采集与核验。结尾同时生成晴天江岸远景和遇雨室内/近景备选，未获许可即取消对应机位。
- readiness 只有在城市身份边界、双目标客群、完整五段弧、4+ 地点、跨至少三场的可审计声景、游客行动链与晴雨切换共同成立时，才派生 `city_identity`、`target_audience`、`route_or_spatial_axis`、`city_soundscape`、`visitor_action` 与 `weather_contingency`。`location_permissions` 仍属于外部证据字段，生成文本即使写“待确认”也不会转绿；三变体均只剩真实场地许可。
- v30 正式矩阵中城市品牌三变体 genre/pattern 均为 88/95、无 weak pattern 信号。全矩阵生产素材仍为 32/45、素材阻断仍为 13、开放动作仍为 25，这是保留真实许可门禁后的预期结果，不是治理无效。

验证：城市品牌三时长生成与 readiness 先红后绿，最终定向 4 文件/96 项通过。v30 正式 15×3 首轮重生成 45/45、复跑复用 45/45，故事质量、可发布、事实/文化边界与 GEARS 保持 45/45；M4 独立审计、Server lint/build 通过。最后有效完整全量仍为第十九切片 204 文件/1725 项通过，1 文件/2 项既有跳过、0 失败。机器结果仍不授予真实场地许可、真人、专业、真实资产、外部模型或成片信用。

### 6.42 M4 第二十六切片：人物年份—年龄—任职—事件阶段窗口

- 周敦颐人物故事改编压力例此前虽检索到“1046 年—30 岁—任南安军司理参军—拒签冤案”的完整知识行，改编生成器却只使用用户三段式主线，导致正文、人物卡、主角弧和场景边界均丢失 `life_stage_window`，生产素材门禁因此阻断。
- 新增人物阶段窗口提取器，仅在 `character_story` 且中心事件为明确拒绝行为时，接受同一 Markdown 证据行中的完整年份、年龄、任职和事件；年龄必须为 10—100 的整数。证据不完整即不派生，不猜测年龄，也不把现代地点括注写成历史任职。
- 改编正文首句、人物描述、主角起点和第一场事实依据现在共享同一证据窗口：“1046年，30岁的周敦颐任南安军司理参军。”第一场同时区分知识条目提供的阶段事实与用户材料提供的行动主线，避免把改编骨架冒充知识原文。
- v32 正式矩阵中 `character_story` 三变体均为 production material ready，改编压力例仅保留 pattern 优化动作。全矩阵 legacy/生产素材 32→33/45，素材阻断 13→12，开放动作 25→23，`combined` 开放目标归零；故事质量、可发布、事实/文化边界、基础可拍字段与 GEARS 保持 45/45。

验证：阶段窗口生成与 readiness 测试先红后绿，最终定向 4 文件/95 项通过。v32 正式 15×3 首轮重生成 45/45、复跑复用 45/45，指标无漂移；M4 独立审计、Server lint/build 通过。最后有效完整全量仍为第十九切片 204 文件/1725 项通过，1 文件/2 项既有跳过、0 失败。机器结果仍不授予真实采访、授权、官方链接、场地许可、真人、专业、真实资产、外部模型或成片信用。

### 6.43 M4 第二十七切片：项目自动草拟与外部证据 fail-closed

- 项目“一键草拟生产素材”白名单此前仍包含 `reference_images_or_keyframes`、`single_shot_test`、`documentation_assets`、`interview_clip_selection` 和 `field_notes`。这些草稿虽然写有“待确认/不替代真实记录”，但任务被自动置为 resolved 后会进入 `material_pack`，从而可能被 readiness 当作源素材证据。
- readiness 服务现在统一导出外部证据字段判定，项目服务在任务筛选和字段生成两层都拒绝自动草拟外部证据；包含任一外部证据字段的混合任务也整体保持开放，避免只生成部分字段却错误关闭整项任务。
- 已删除五类不可达的机器草拟实现，保留身份动作一致性、多分镜连续性、转场、B-roll 计划等真正可由故事结构生成的生产规划。自动化完成这些规划后，真实参考图和单镜头实测仍保持缺失；当项目只剩外部证据时，不再展示可自动执行的 `draft_production_material_fields` 动作。
- 本切片不导入、伪造或授予任何真实证据信用，因此 v32 正式基线保持生产素材 33/45、素材阻断 12、开放动作 23、全生产就绪 0/45。

验证：AI 漫剧自动化边界红测先复现“机器计划令 readiness=ready”，修复后完整 project-service 与 production-material-readiness 两文件 112 项通过；Server lint/build 与 M4 独立机器审计通过。生成链与矩阵合同未变，未重复运行 15×3 正式生成；最后有效 v32 正式证明仍为第二十六切片首轮重生成 45/45、复跑复用 45/45。最后有效完整全量仍为第十九切片 204 文件/1725 项通过，1 文件/2 项既有跳过、0 失败。

### 6.44 M4 第二十八切片：外部证据候选导入与不授信账本

- 共享层新增九类外部证据字段与证据类型的一一对应合同，覆盖官方资源链接、社区/传承人同意、记录资产、采访片段、现场笔记、参考图、单镜头实测、权利署名和场地许可。请求必须提供标题、摘要、`https://` 或 `artifact://` 来源 URI、来源标签和 64 位 SHA-256；字段与证据类型错配直接拒绝。
- 新增 `project-external-evidence-ledger/v1` 与候选导入结果合同。候选按字段+内容哈希生成稳定 ID，同一内容重放幂等；SHA-256 统一规范为小写，并同时持久化到项目当前版本和源故事快照。
- 新增 `POST /api/projects/:projectId/production-readiness/external-evidence-candidates`，路由要求 material review 权限。导入项固定为 `pending_verification`，`source_retrieved`、`content_hash_verified`、`scope_verified` 与 `external_evidence_credit_granted` 全为 false。
- 候选账本不进入 `material_pack`，不参与 readiness 关键词判定，不修改 production material 状态，也不关闭对应 supplement task。独立验证服务落地前，候选本身永远不算真实证据。
- 本切片因此有意保持 v32 正式基线：生产素材 33/45、素材阻断 12、开放动作 23、全生产就绪 0/45。

验证：共享 schema、项目持久化和 API 路由先红后绿，定向 2 文件/3 项通过；完整 project-service 与 API 两文件 320 项通过，Server lint/build 与 M4 独立审计通过。生成链与矩阵合同未变，未重复运行 15×3；最后有效正式矩阵仍为第二十六切片 v32 首轮重生成 45/45、复跑复用 45/45。最后有效完整全量仍为第十九切片 204 文件/1725 项通过，1 文件/2 项既有跳过、0 失败。

### 6.45 M4 第二十九切片：外部证据项目制品验证、验收、拒绝与撤销

- 新增外部证据验证 schema 与 `POST /api/projects/:projectId/production-readiness/external-evidence-candidates/:evidenceId/verify`。路径 ID、请求 ID 与持久化 SHA-256 必须一致；`accept` 必须声明来源与候选一致、证据确实支持目标字段、当前项目使用范围已确认。
- 验证路由沿用 material review 权限，并额外拒绝 `local_bypass`；只有 `static_registry_token` 或 `signed_session` 的真实 reviewer 身份可验收、拒绝或撤销，reviewer、认证方式、时间与备注写入候选记录。
- `artifact://` URI 被映射到项目 `external-evidence/` 目录；服务端同时检查词法路径、真实路径、符号链接逃逸和普通文件类型，再读取字节重算 SHA-256。错误字节、缺失文件、路径逃逸或 hash 不匹配均 fail closed。
- `https://` 候选继续只可登记；当前服务不会联网抓取，因此验收会明确返回 `source_retrieved=false`，不得依赖请求自报 hash 获得信用。
- 验收通过后，ledger 中对应项转为 `verified`，readiness 只认可 `verified + external_evidence_credit_granted`，并关闭对应补充任务；`reject` 保持零信用，`revoke` 移除信用、重新计算 readiness 并重新打开任务。若同字段仍有另一条有效证据，则不会错误回退。
- 正式矩阵没有真实项目制品和 reviewer 操作，因此 v32 基线有意保持生产素材 33/45、素材阻断 12、开放动作 23、全生产就绪 0/45。

验证：错误字节拒绝、正确制品验收、HTTPS 阻断、拒绝、撤销和本地旁路 403 均有回归；完整 project-service 与 API 两文件 320 项、production-material-readiness 40 项、Server lint/build 与 M4 独立审计通过。生成链与矩阵合同未变，未重复运行 15×3；最后有效正式矩阵仍为第二十六切片 v32 首轮重生成 45/45、复跑复用 45/45。最后有效完整全量仍为第十九切片 204 文件/1725 项通过，1 文件/2 项既有跳过、0 失败。

### 6.46 M4 第三十切片：项目范围内外部证据受控上传

- 新增 `POST /api/projects/:projectId/production-readiness/external-evidence-candidates/upload` multipart 入口，复用 material review 权限；字段元数据仍执行九类字段—证据类型一一对应 schema，不接受错配类型。
- 上传请求和服务层均限制为 20 MiB，空文件直接拒绝。原始文件名会去除客户端路径且只作为显示元数据保存；实际制品不采用客户端扩展名，而由服务端计算 SHA-256 后原子写入项目 `external-evidence/uploads/{sha256}.bin`，避免路径注入和可执行扩展名落盘。
- 同项目、同字段、同内容重复上传复用内容寻址制品和稳定候选 ID，不重复写账本。若既有同哈希路径的真实字节不能通过完整性复算，则 fail closed 且禁止覆盖。
- 上传结果固定为 `pending_verification`，四项验证/信用标志仍为 false，不修改 readiness、不关闭 supplement task。后续必须显式调用第二十九切片的 reviewer 验收接口，重新读取落盘制品并复算 hash 后才能授信。
- 正式矩阵没有真实上传和 reviewer 操作，因此 v32 基线继续保持生产素材 33/45、素材阻断 12、开放动作 23、全生产就绪 0/45。

验证：服务层覆盖服务端 hash、路径化文件名清理、真实字节落盘、幂等重放和空文件拒绝；API 覆盖 multipart 到 pending candidate 的完整链路。完整 project-service 与 API 两文件 322 项、production-material-readiness 40 项、Server lint/build 与 M4 独立审计通过；`git diff --check` 通过。生成链与矩阵合同未变，未重复运行 15×3；最后有效正式矩阵仍为第二十六切片 v32 首轮重生成 45/45、复跑复用 45/45。最后有效完整全量仍为第十九切片 204 文件/1725 项通过，1 文件/2 项既有跳过、0 失败。

### 6.47 M4 第三十一切片：外部证据追加式验证审计与状态并发保护

- 外部证据验证请求新增 `expected_candidate_status` 与 `idempotency_key`。服务端在读制品或修改 readiness 前执行候选状态 CAS；陈旧审核请求返回 `PROJECT_WRITE_CONFLICT`，不能覆盖较新的验收、拒绝或撤销决定。
- 新增 `project-external-evidence-verification-event/v1`。每次成功状态迁移记录 reviewer、认证方式、字段、来源、期望/实算 hash、范围声明、迁移前后状态、备注与请求 hash；事件以 canonical JSON 计算 SHA-256，并通过 `sequence + previous_event_sha256 + verification_head_sha256` 形成项目内追加链。
- 同一幂等键、同一请求和 reviewer 重放直接返回原事件，不追加历史、不重新读取制品、不再次修改 readiness；同一幂等键携带不同内容则冲突。
- 每次新决定前完整复算已有事件链、链头、序号、事件/幂等键唯一性和状态迁移语义；事件内容、前序 hash 或链头一旦被篡改，返回 `REVIEW_STORAGE_UNAVAILABLE` 并保持项目状态与证据信用不变。
- 项目仓储原有的版本期望、原子 current-state 双写、锁和事务恢复继续承担物理并发/崩溃边界；本切片补齐业务候选状态并发保护。HTTPS 仍未取回，不因审计能力完成而获得信用。
- 正式矩阵没有真实审核事件，因此 v32 基线继续保持生产素材 33/45、素材阻断 12、开放动作 23、全生产就绪 0/45。

验证：完整 project-service 与 API 两文件 322 项、production-material-readiness 40 项、Server lint/build、M3 Production Material、M3 Domain Pack、15 类型对照和 M4 独立审计全部通过；15 类型对照在沙箱内先遇到已知 `tsx` IPC `listen EPERM`，随后在沙箱外只读 `--check` 通过。`git diff --check` 通过；未重复运行 15×3 生成。

### 6.48 M4 第三十二切片：HTTPS 外部证据安全抓取、DNS 钉扎与项目缓存

- 新增受限 HTTPS 抓取适配器。只允许 `https://`、标准 443 端口和无凭据 URL；显式拒绝 localhost、保留/本地域名、非公网 IPv4/IPv6、IPv4-mapped 私网、6to4 等过渡地址以及同时返回公网/私网地址的混合 DNS。
- DNS 审核结果不是旁路提示：实际 `node:https` 连接通过自定义 lookup 钉住已审核地址，同时保留原始主机名用于 TLS SNI 和证书验证，封住“先校验域名、连接时再次解析”的 DNS rebinding 缺口。
- 最多允许 3 次跳转；每个跳转目标都重新执行 URL、DNS 和公网地址校验。响应固定请求 identity 编码，并受 10 秒超时、20 MiB 声明/流式双重上限、非空正文和 2xx 状态约束。
- HTTPS 候选在 reviewer `accept` 时才触发抓取。响应字节先由服务端重算 SHA-256；只有与候选 hash 一致时才按 `external-evidence/https/{sha256}.bin` 缓存到项目，缓存既有字节也必须通过完整性复算，随后才进入范围声明、候选状态、readiness 和追加式审计链。
- 候选和验证事件记录抓取时间、缓存 artifact URI、最终 URL、内容类型、跳转次数与逐跳 DNS 钉扎轨迹；审计链会验证这些字段与期望 hash 的对应关系。正式矩阵没有真实远端 reviewer 操作，因此 v32 基线继续保持生产素材 33/45、素材阻断 12、开放动作 23、全生产就绪 0/45。

验证：HTTPS 适配器覆盖公网 DNS 钉扎、安全跳转、私网/混合 DNS、保留主机、凭据、非标准端口、IPv4-mapped IPv6、6to4、响应体上限和取消；适配器、完整 project-service 与 API 共 334 项通过，production-material-readiness 40 项通过，Server lint/build 和 M4 独立审计通过。`git diff --check` 通过；生成合同与正式矩阵输入未变，未重复运行 15×3 生成。

### 6.49 M4 第三十三切片：文化题材源 × 原创叙事类型组合能力

- 新增 `story-genre-composition/v1`：可显式选择神话、民间传说、历史事迹、历史人物、地方掌故、经典文本、非遗/文化记忆和用户原创素材，未显式选择时按来源条目确定性推断。多题材混合要求逐场标记事实、传说与虚构来源。
- 叙事流派库新增 16 类原创机制：遗迹探秘冒险、世家秘约与旧账、公平线索推理、神话远航与归乡、历史阵营群像史诗、神话英雄使命、民俗异闻调查、极境生存远征、阴谋拼图惊险、公堂案审程序、团队智取行动、情感悲剧抉择、家族代际史诗、伙伴公路任务、战争谋略战役、民间讽喻喜剧。
- 每类机制都有题材族、子流派标签、表达轴、叙事/主角/冲突引擎、节奏、场景配方、质量信号和禁用模式；分别登记到人物、历史、传说和 AI 漫剧等兼容类型。AI 漫剧推荐器新增遗迹/考古、案件/证词、神话/远航、阵营/战役、团队/秘约等可解释信号。
- 组合合同进入 StoryBlueprint `type_specific_requirements`、生成 prompt、最终 Story 和 `_request_meta`；resolved pattern IDs 继续由 GenreStoryProfile 过滤，并由既有质量诊断和 repair 动作消费，避免 prompt、quality、repair 和 persistence 规则漂移。
- 原创边界固定为只参考目标、冲突、线索、节奏和场景机制；不得复用受保护作品的专有角色、标志性世界设定、独特情节序列、代表性台词或可识别文风。经典文本的公共领域、版本和授权状态不自动授信。
- 全量门禁暴露并修复一个既有 30 秒武陵源山水分支回归：专用压缩场景此前丢失全部旁白，现只保留开场与结尾两句低密度旁白，中段继续留白。

验证：新增测试先红后绿；受影响 8 文件/69 项通过，最终 Server 全量 206 文件/1766 项通过，1 文件/2 项既有跳过；Server lint/build 与 M4 独立审计通过，`git diff --check` 通过。v32 的 45 案例正式报告仍是本切片前生成的旧样本，审计指标保持故事质量/可发布 45/45、生产素材 33/45、全生产就绪 0/45；不得把该旧矩阵写成 16 类新机制已完成 15×3 压力评测。

### 6.50 M4 第三十四切片：本地 fallback 类型机制落地与三层产物同步

- 新增确定性 `local-story-genre-composition-service`。只有 16 类新扩展机制被选中时才接管本地 fallback；没有组合合同、仅含旧机制或默认生成时直接返回原对象，避免改变既有 Story Agent 输出。
- 16 类机制全部具备六段观众可见行动，不再只把 pattern ID 留在蓝图或 prompt：遗迹探秘会用残片/纹样/路线/封存形成文化伦理选择；公平推理会展示证词、物证、时间线和逐条解释；神话远航会以誓言、航路、信物和带伤归乡首尾回环；历史阵营群像会把阵营、战报、粮道、盟约与百姓后果连接成因果链。其余 12 类也各有独立行动链。
- 场景数保持原生成骨架不变，机制六段节拍按相对位置确定性映射到现有场景；首尾节拍固定落在第一场和末场。场景 ID、时长、地点、人物和既有视觉信息保留，`dramatic_function`、`plot`、`key_action`、冲突、旁白、文化说明和幕用途按所选机制重组。
- 每场都保留或补入知识条目的 `factual_basis`，并追加“机制驱动的行动、对白与因果连接属于戏剧化补足”；神话/传说组合额外声明文化叙事不等于现代史学确证。组合合同的 evidence boundary 和原创表达边界进入 `cultural_constraints`。
- `full_text`、`scene_breakdown` 和 `gears_segments` 由同一批重组场景同步生成，GEARS `purpose`、脚本正文和场景行动一致；幕结构用途也按实际场景节拍更新，消除“蓝图选了新类型、fallback 仍是通用类型模板”的规则漂移。
- preparation 的 `genreComposition` 已接入 generation execution → local generation 边界；运行 trace 写入 `local-genre-composition:{pattern_id}`，能够审计本地究竟应用了哪个扩展机制。
- 当前多机制组合采取“按请求顺序选择第一个扩展机制作为主引擎”的确定性策略，后续仍需实现主/副机制分工和融合冲突检测；这是一项明确 backlog，不得把当前实现表述为多机制已深度融合。

验证：4 组题材 × 类型代表性压力案例先红后绿，并新增全部 16 个扩展机制的可执行覆盖；专项 1 文件/6 项通过，相关 8 文件/74 项通过。最终 Server 全量 207 文件通过、1 文件跳过，1772 项通过、2 项既有跳过；Server lint、build、`git diff --check` 和 M4 独立审计通过。M4 审计仍读取 v32 正式报告：45 案例、故事质量/可发布/事实文化/可拍性 45/45、生产素材 33/45、全生产就绪 0/45、开放动作 23。该正式报告早于第三十三/三十四切片，不能冒充新组合机制的正式 15×3 重生成结果。

### 6.51 M4 第三十五切片：主/副机制融合、冲突门禁与正式组合矩阵

- 新增 `story-genre-fusion-plan/v1`，把扩展机制按请求顺序明确分为一个 `primary_engine` 与零至多个 `secondary_mechanism`。主机制负责全片开场、升级、高潮和结尾因果弧；每个副机制必须在一个独立中段场景以行动和后果兑现，不能替换主机制首尾。
- 16 类扩展机制 ID 已集中到叙事机制库，组合服务、fallback 与矩阵共同复用，消除上一切片本地服务内的重复名单。
- 新增四类确定性语义张力合同：公平推理唯一解释 × 民俗异闻残余未知、悲剧损失 × 讽喻喜剧反噬、遗迹原址保护 × 团队智取行动、阵营群像因果 × 战役谋略场景。张力不会被粗暴禁配，而由主机制决定最终口径，副机制限制在独立场景，并把化解规则进入 prompt、蓝图组合合同和文化约束。
- 本地 fallback 会把副机制行动追加到确定性中段场景，副机制动作同步进入 `plot`、`key_action`、`full_text`、GEARS `script_text`、视觉提示与虚构补足说明；主机制的首场和末场节拍保持不变。运行 trace 新增 `local-genre-composition-secondary:{pattern_id}`。
- 若副机制数量大于 `scene_count - 2`，生成返回 `genre_fusion_conflict`；不会挤占首尾、把多个副机制塞入同一场或静默丢弃后续机制。
- 新增 `story-genre-composition-matrix/v1` 正式本地机器矩阵：16/16 案例通过，8/8 题材源、16/16 主机制、16/16 副机制、8 个混合题材案例、4 类语义张力规则和容量冲突 fail-closed 全覆盖；每例验证主机制首尾、副机制唯一中段兑现、正文/场景/GEARS 同步及逐场事实/虚构边界。
- 矩阵使用虚构 fixture 与本地确定性引擎，固定 `external_model_invoked=false`、`human_review_complete=false`、`professional_credit_granted=false`、`real_production_credit_granted=false`、`province_markdown_written=false`。它是新组合能力的正式本地结构压力证据，不是 v32 的 15 类型 × 3 时长重生成，也不证明真人或外部模型质量。

验证：新行为先观察到 4 项预期失败，随后专项 3 文件/28 项、受影响 8 文件/77 项通过；组合矩阵 1 文件/1 项与 `--write`、`--check` 通过。最终 Server 全量 208 文件通过、1 文件既有跳过，1776 项通过、2 项既有跳过、0 失败；Server lint/build、M3 Production Material、M3 Domain Pack、M4 v32 独立审计和 `git diff --check` 通过。实现提交为 `35fffb0b`。

## 7. 当前机器报告

关键报告：

- `data/reports/knowledge-base-production-audit.json`
- `docs/knowledge-base-production-audit.md`
- `data/reports/knowledge-base-raw-production-field-gap-governance.json`（当前 0 项缺口，`--check` 通过）
- `docs/knowledge-base-raw-production-field-gap-governance.md`（同上）
- `data/reports/knowledge-base-content-supply-progress.json`（内容扩充与 M3 源字段治理当前汇总）
- `data/reports/story-agent-writing-capability-m3-production-material-baseline.json`
- `data/reports/story-agent-writing-capability-m3-domain-pack-baseline.json`
- `data/reports/story-agent-writing-capability-m3-domain-pack-15-type-comparison.json`
- `data/reports/story-agent-writing-capability-m4-15x3-machine-evaluation.json`（45 案例机器质量、边界、可拍性和修复基线）
- `data/reports/story-agent-story-genre-composition-matrix.json`（8 类题材源 × 16 类主/副机制的本地组合压力矩阵）

M3 基线当前：

```text
status = passed
video_type_coverage = 15/15
pack_count = 15
total_required_field_count = 184
total_sample_count = 100
production_audited_entry_count = 289
raw_source_production_field_gap_count = 0
machine_guidance_field_count = 0
effective_runtime_production_field_gap_count = 0
entries_with_machine_guidance = 0
domain_pack_entry_count = 22
production_domain_pack_coverage = 12/12
ritual_pack_production_prompts = 5
ritual_pack_review_boundaries = 5
ritual_retrieval_registered = true
architecture_language_environment_pack_count = 3
architecture_language_environment_production_prompts = 15
architecture_language_environment_review_boundaries = 15
default_kb_root_resolves_repository_data = true
blueprint_trace_registered = true
readiness_trace_registered = true
quality_leak_gate_registered = true
repair_boundary_registered = true
video_type_aware_retrieval_registered = true
production_ready_selection_preferred = true
cultural_safety_priority_registered = true
fifteen_type_comparison_registered = true
domain_pack_comparison_type_coverage = 15/15
domain_pack_expected_pack_match = 15/15
domain_pack_active_prompt_delta = 15/15
domain_pack_control_prompt_suppressed = 15/15
domain_pack_readiness_score_stable = 15/15
architecture_language_environment_retrieval_registered = true
web_and_mcp_health_contract_registered = true
```

M4 15×3 当前基线：

```text
status = passed
case_count = 45
legacy_quality_passed = 33/45
story_quality_passed = 45/45
story_publishable = 45/45
production_material_ready = 33/45
production_ready = 0/45
production_material_blocked = 12/45
asset_gate_blocked = 45/45
external_provider_gate_blocked = 45/45
repair_attempted = 0
repair_applied = 0
open_repair_actions = 23
```

M4 组合创作当前本地矩阵：

```text
status = passed
case_count = 16
passed_case_count = 16
source_kind_coverage = 8/8
primary_pattern_coverage = 16/16
secondary_pattern_coverage = 16/16
mixed_source_case_count = 8
semantic_tension_rule_count = 4
capacity_conflict_fail_closed = true
external_model_invoked = false
human_review_complete = false
professional_credit_granted = false
real_production_credit_granted = false
```

## 8. 当前验证证据

M3 第一切片完成时：

- Server 全量：203 个文件通过、1 个跳过；1667 项通过、2 项跳过。
- Server lint、Server/Client production build、Visible copy audit 通过。

M3 第二切片完成时：

- MCP 指导/审计定向：2 个文件、3 项通过。
- MCP ProductionMaterialPack 健康检查：16 项通过。
- MCP `tsc` build：通过。
- MCP 排除本地端口桥接文件后：108 个文件、550 项通过。
- Server 受影响回归：5 个文件、61 项通过。
- Server lint、production build：通过。
- `npm run kb:production-audit` 曾成功生成当前全库报告。
- M3 baseline `--write`、`--check`：通过。
- `git diff --check`：通过。

M3 第三切片完成时：

- Server Domain Pack 检索与 prompt 定向：2 个文件、23 项通过。
- MCP 生产健康、MVP 总控与 GEARS evidence signoff：3 个文件、30 项通过。
- Server lint、production build：通过。
- MCP `tsc` build：通过。
- 既有 M3 ProductionMaterialPack baseline `--check`：通过。
- 新增 M3 Domain Pack baseline `--write`、`--check`：通过；9/9 个生产包健康。

M3 第四切片完成时：

- Server Domain Pack 检索与 prompt 定向：2 个文件、25 项通过。
- MCP 生产健康、MVP 总控与 GEARS evidence signoff：3 个文件、30 项通过。
- Server lint、production build：通过。
- MCP `tsc` build：通过。
- M3 ProductionMaterialPack baseline `--check`：通过。
- M3 Domain Pack baseline `--write`、`--check`：通过；12/12 个生产包健康，三类新增包检索注册全部为 `true`。

M3 第六切片完成时：

- `kb:lint`：34 个文件、272 条正式条目通过。
- 生产审计：272 条、992 个来源，0 条缺来源/地点/核实方法，272/272 有机器元数据与 `asset_split`。
- 新增五条固定检索：5/5 top 1；生产卡机器分：5/5 为 100。
- MCP 全量：109 个文件、555 项测试通过。
- 知识合同审计：272/272 有效，边界保持 report-only。
- M3 ProductionMaterialPack baseline、Domain Pack baseline：通过。

M3 第七切片完成时：

- `kb:lint`：34 个文件、277 条正式条目通过。
- 生产审计：277 条、1007 个来源，0 条缺来源/地点/核实方法，277/277 有机器元数据与 `asset_split`。
- 新增五条固定检索：5/5 top 1；生产卡机器分：5/5 为 100。
- MCP 全量：109 个文件、555 项测试通过。
- M3 ProductionMaterialPack baseline 刷新到 277 条并通过；Domain Pack baseline：12/12 通过。
- 知识合同报告未刷新：最后有效快照仍为 272 条，原因是 `tsx` IPC 与沙箱外自动审批异常。

M3 第八切片完成时：

- `kb:lint`：34 个文件、283 条正式条目通过。
- 生产审计：283 条、1025 个来源，0 条缺来源/地点/核实方法，283/283 有机器元数据与 `asset_split`。
- 新增六条固定检索：6/6 top 1；生产卡机器分：6/6 为 100。
- MCP 全量：109 个文件、555 项测试通过。
- 机器元数据与可信度 dry-run：零变更；资产拆分建议：283 条零缺口；升级计划：13 批、402 项。
- M3 ProductionMaterialPack baseline 刷新到 283 条并通过；Domain Pack baseline：12/12 通过。
- 知识合同报告未重跑：最后有效快照仍为 M2-3J 的 272 条，不得转述为 283 条通过。

M3 第九切片完成时：

- `kb:lint`：34 个文件、289 条正式条目通过。
- 生产审计：289 条、1043 个来源，0 条缺来源/地点/核实方法，289/289 有机器元数据与 `asset_split`。
- 新增六条固定检索：6/6 top 1；生产卡机器分：6/6 为 100。
- MCP 全量：109 个文件、555 项测试通过。
- Web Server 全量：203 个文件、1671 项测试通过，1 个文件/2 项测试按既有配置跳过；Domain Pack evidence bundle 的陈旧 8/8 断言已同步为 12/12。
- Web 全工作区 lint、Server/Client production build、MCP TypeScript build：通过。
- 机器元数据与可信度 dry-run：零变更；资产拆分建议：289 条零缺口；升级计划：13 批、402 项。
- M3 ProductionMaterialPack baseline 刷新到 289 条并通过；Domain Pack baseline：12/12 通过。
- 知识合同报告未重跑：最后有效快照仍为 M2-3J 的 272 条，不得转述为 289 条通过。

M3 第十切片完成时：

- Domain Pack 核心链路定向：4 个文件、44 项通过；包含真实 preparation 检索、同一 context 贯穿 readiness/Blueprint，以及无泄漏时的 `trace_ready` 机器边界。
- Domain Pack、prompt、readiness、quality、repair、project 相关回归：8 个文件、148 项通过。
- Web Server 全量：203 个文件、1676 项通过，1 个文件/2 项按既有配置跳过。
- Server TypeScript lint、production build：通过。
- M3 Domain Pack baseline 已刷新并通过 `--check`；12/12 包健康，新增五项运行时闭环 gate 全部为 `true`。
- 未修改省级知识 Markdown；人工审校、真实生产、外部 worker 与公开发布信用仍为 0。

M3 第十一切片完成时：

- 新行为 TDD：3 个文件、17 项通过；相关检索/prompt/Blueprint/readiness/矩阵回归：9 个文件、85 项通过。
- 精确时代兼容回归：outline/domain/comparison 3 个文件、51 项通过。
- Web Server 全量：204 个文件、1679 项通过，1 个文件/2 项按既有配置跳过。
- Server TypeScript lint、production build：通过。
- Domain Pack 主 baseline：12/12 包健康，新增片型感知、生产包优先、安全优先、15 类型对照四项 gate 为 `true`。
- 15 类型 comparison baseline：预期包、prompt delta、control 抑制和 readiness 稳定均为 15/15；未调用外部模型，未测量成片质量。
- `tsx` 审计在沙箱内仍因 IPC `listen EPERM` 失败，按既有批准在沙箱外执行后通过；这是环境限制，不是业务失败。

M3 第十二切片完成时：

- 生产审计字段证据来源区分为 `structured_detail`、`raw_markdown` 和 `missing`；44 个源专节字段从审计盲区恢复。
- 原始字段缺口 212→168，受影响条目 140→111；机器兜底 168，有效运行缺口 0。
- 治理账本 168/168 逐项记录证据要求与验收规则；自动写回许可 0；B1/B2/B3/B4 分别为 28/55/26/59 项。
- MCP 定向 2 个文件、3 项与全量 110 个文件、554 项通过，TypeScript build 和 `kb:lint` 通过；生产审计、13 批/399 项升级计划、治理账本、M3 ProductionMaterial baseline 均刷新，三份 M3 baseline 与治理账本 `--check` 通过。
- 未修改任何省级知识 Markdown；未授予人工审校、真实生产或外部发布信用。

M3 第十三切片完成时：

- B1 非湖南高风险事实/改编/视觉边界 28/28 完成，涉及 26 条、23 个省级文件；机器残留为 0。
- 对白口吻审计拒绝“不得虚构对白”假阳性，只接受明确口吻字段或 `asset_usage=dialogue_tone`；新增测试先红后绿。
- 当前生产审计为 155 个原始缺口：对白 100、戏剧化空间 36、禁用表达 13、视觉符号 6；117 条有机器兜底，有效运行缺口 0。
- MCP 定向 2 文件/4 项、全量 110 文件/556 项、TypeScript build、`kb:lint`、生产审计、升级计划和 M3 ProductionMaterial baseline 均通过。
- 治理账本 JSON/Markdown 因沙箱外自动审批基础设施参数错误未刷新，仍是 168 项旧快照；不得将其转述为当前账本。

M3 第十四切片完成时：

- B2 湖南高风险边界 55/55 完成，涉及 44 条；B1+B2 全库高风险缺口残留为 0。
- 当前生产审计只剩 100 个对白/旁白口吻：非湖南 33、湖南 67；100 条有机器兜底，有效运行缺口 0。
- 治理报告代码新增全库高风险完成门禁并通过定向测试，但 JSON/Markdown 刷新再次被沙箱外自动审批基础设施参数错误拒绝，仍是 168 项旧快照。
- MCP 定向 2 文件/4 项、全量 110 文件/556 项、TypeScript build、`kb:lint`、生产审计、升级计划、M3 ProductionMaterial baseline 和 `git diff --check` 均通过。

M3 第十五切片完成时：

- B3 非湖南对白/旁白口吻 33/33 完成，涉及 33 条、26 个省级文件；非湖南原始生产字段残留为 0。
- 口吻识别器支持带“非知识事实”括注的明确字段标签，并继续拒绝仅禁止虚构对白的假阳性；新增回归用例通过。
- 当前生产审计只剩湖南 67 个对白/旁白口吻；67 条有机器兜底，有效运行缺口 0。
- MCP 110 文件/556 项、Server 204 文件/1679 项、两端构建、Server lint、`kb:lint`、生产审计、13 批/399 项升级计划、M3 ProductionMaterial baseline 和 Domain Pack 主 baseline 已通过。
- 15 类型 comparison baseline 本轮复核被 `tsx` IPC 与沙箱外自动审批参数错误阻断；未受 B3 改动，第十一切片成功基线仍是最后有效记录。

M3 第十六切片完成时：

- B4 湖南对白/旁白口吻 67/67 完成；B1—B4 原始字段治理全部完成。
- 生产审计、ProductionMaterial baseline 与原始字段治理账本均为原始缺口 0、机器兜底 0、有效缺口 0；治理账本 `--write`、`--check` 成功。
- 15 类型 comparison baseline 本轮 `--check` 成功，15/15 invariants 全通过。
- 服务层全流程组合 14 文件/76 项、MCP 全量 110 文件/556 项、Server 全量 204 文件/1679 项、两端构建和 Server lint 全部通过。
- 隔离四种子全功能 smoke 和知识合同审计未实际运行，阻塞原因分别为 `tsx` IPC 与沙箱外自动审批基础设施错误，不计产品失败。

M4 第一切片完成时：

- 15×3 服务链测试 1 文件/1 项通过；包含 45 案例生成、复用、部分图片回执、补齐和幂等。
- 正式 15×3 smoke 在沙箱外通过并刷新基线：交付矩阵 45/45 ready，隐藏 fallback 0。
- 机器质量基线：45/45 有报告，事实/文化门禁、逐场事实边界、文化边界和基础可拍字段均 45/45；综合质量 7/45、可发布 38/45、生产门禁 0/45。
- repair trace：43 个案例 attempted、0 个 applied、126 个生成后开放修复动作；机器状态为 `attention_required`。
- 创作约束/大纲语义误判修复后，大纲均分 58.11→95、可发布 14/45→38/45；失败聚类已固化。
- M4 独立一致性审计、Server lint/build 与最终全量 204 文件/1681 项通过；机器结果固定不授予真人、专业或外部模型信用。

M4 第二切片完成时：

- 45 案例新增弱 pattern 与 GEARS 具体问题聚类；独立审计从逐案例证据重算全部五类失败聚合。
- 推荐候选与激活机制完成拆分；显式选择不再被额外推荐项膨胀，默认按片型容量激活 1—2 项。
- production material 与 GEARS 重复扣分已拆开；GEARS readiness 45/45 为 100，GEARS issue/repair target 为 0。
- 首次生成与复用重评的 45 份机器证据及聚合报告完全一致；改编判断不再依赖 API 会剥离的内部元字段。
- 正式基线当前：故事可发布 38/45，production ready 0/45，开放动作 125；平均类型 87.73、大纲 95、pattern 68.93、GEARS 100。`quality_passed=0/45` 仍受 production material 综合旧合同约束，不能冒充故事质量倒退。
- M4 独立一致性审计、Server lint/build、`git diff --check` 均通过；最终 Server 全量 204 文件/1684 项通过，1 文件/2 项按既有配置跳过。首次全量中既有 Seedance provider 轮询用例在固定 5 秒处偶发超时，单独复跑 165ms 通过，随后第二次全量完全通过。

M4 第三切片完成时：

- 机器报告正式拆为 legacy 综合、创作质量、故事可发布、生产素材和全生产就绪五个有定义的并列指标。
- 正式基线为 legacy 0/45、创作质量 15/45、故事可发布 38/45、生产素材 3/45、全生产就绪 0/45；不再用生产素材缺口遮蔽创作侧进展。
- 独立审计从逐例证据重算公式、总计、三种 variant、15 个片型和 invariant/failed list，当前通过。
- 本切片不改变生成内容、旧 `quality_report.passed` 语义或人工/专业信用边界。
- Server lint/build 和最终全量 205 文件/1685 项通过，2 项既有跳过、0 失败；M4 审计与 `git diff --check` 通过。

M4 第四切片完成时：

- 生成主链自动 repair 与 production material 缺口解耦；仅 30 个创作质量未通过案例尝试正文 repair，15 个创作合格案例不再被误触发。
- 15×3 v5 正式矩阵首次新建后复核复用 45/45；repair 对齐 invariant 为 true，独立审计通过。
- 质量指标、平均分、失败聚类和开放动作未变；本切片不冒充内容质量提升。
- 最终 Server 全量 205 文件/1685 项通过、2 项既有跳过、0 失败；中间一次未改动 reference benchmark 用例并发失败已单文件通过且完整复跑未复现。

M4 第五切片完成时：

- 改编人物抽取与 `adapt_user_novel` 本地分场主链完成；五种正式改编压力类型均以用户原作节拍生成场景，不再只拿原作做生成后检查。
- 山水 30 秒低密度、诗性结尾、短 plot 的 GEARS 可执行画面证据和专业文本时长门完成统一；山水三种变体可发布且 GEARS 均为 100。
- v9 正式基线为 legacy 0/45、创作质量 17/45、故事可发布 45/45、生产素材 3/45、全生产就绪 0/45；事实文化、大纲覆盖、GEARS、逐场事实/文化边界与基础可拍字段均 45/45。
- 故事阻断 gate 归零；repair attempted 28、applied 0、开放动作 119。复跑复用 45/45，M4 独立审计通过，仍不授予真人/专业/外部模型信用。

M4 第六切片完成时：

- 城市品牌与场景短片的 pattern 判定改为识别场景内可观察的地标、日常生活、地域价值、连续路线、节点功能、时间层和氛围收束，不认可顶层口号或质量标签冒充证据。
- v10 正式基线为 legacy 0/45、创作质量 23/45、故事可发布 45/45、生产素材 3/45、全生产就绪 0/45；城市品牌 95、场景短片 89，平均 pattern 73.11。
- repair attempted 25 中，22 个覆盖当前全部创作失败，3 个是场景短片按旧评估生成时留下的历史尝试；新单向 invariant `repair_attempt_covers_story_quality_failures` 为 true，历史证据不抹除。
- 开放动作降到 113；事实文化、GEARS、逐场边界、基础可拍字段和图片请求仍为 45/45，图片任务 75。v10 复跑复用 45/45，M4 独立审计通过。

M4 第七切片完成时：

- 社交短视频建立首场钩子、信息密度、字幕节奏与末场 payoff 的位置合同；教学训练建立可测目标、顺序步骤、带载体练习、评估与有序复盘闭环，并用错位问句和空标签反例防止语义误奖。
- v11 正式基线为 legacy 3/45、创作质量 29/45、故事可发布 45/45、生产素材 3/45、全生产就绪 0/45；社交短视频 96、教学训练 99，平均 pattern 77.98。
- repair attempted 19 中，16 个覆盖当前全部创作失败，3 个是历史尝试；applied 0、开放动作 104。事实文化、GEARS、逐场边界、基础可拍字段和图片请求仍为 45/45，图片任务 75。
- v11 首次生成与复用回归指标一致，复跑复用 45/45；M4 独立审计两次通过，仍不授予真人、专业、外部模型或成片信用。

M4 第八切片完成时：

- 知识讲解建立问题、知识层级、可视类比/案例与总结复盘链；主题宣讲建立中心观点、事实案例、价值分析、现实连接与行动号召链，空场景标签不能得分。
- v12 正式基线为 legacy 3/45、创作质量 35/45、故事可发布 45/45、生产素材 3/45、全生产就绪 0/45；知识讲解和主题宣讲均为 96，平均 pattern 83.91。
- repair attempted 13 中，10 个覆盖当前全部创作失败，3 个是历史尝试；applied 0、开放动作 92。事实文化、GEARS、逐场边界、基础可拍字段和图片请求仍为 45/45，图片任务 75。
- v12 首次生成与复用回归指标一致，复跑复用 45/45；M4 独立审计两次通过，仍不授予真人、专业、外部模型或成片信用。

M4 第九切片完成时：

- 山水意境建立自然对象与状态变化、多时相光影、全片低旁白密度和末场声音退场/远景留白合同；诗意标题和抽象“四季蒙太奇”不能冒充具体画面证据。
- v13 正式基线为 legacy 3/45、创作质量 38/45、故事可发布 45/45、生产素材 3/45、全生产就绪 0/45；山水 canonical/3 分钟为 85、30 秒为 96，平均 pattern 86.09。
- repair attempted 13 中，7 个覆盖当前全部创作失败，6 个是历史尝试；applied 0、开放动作 90。事实文化、GEARS、逐场边界、基础可拍字段和图片请求仍为 45/45，图片任务 75。
- v13 首次生成与复用回归指标一致，复跑复用 45/45；M4 独立审计两次通过，仍不授予真人、专业、外部模型或成片信用。

M4 第十切片完成时：

- 儿童故事建立具体短句、温和日常压力、观察/倾听后的因果学习、可见选择和伙伴共同回家的暖结尾合同；残酷情节、黑屏文字和“要善良”口号不能得分。
- v14 正式基线为 legacy 3/45、创作质量 41/45、故事可发布 45/45、生产素材 3/45、全生产就绪 0/45；儿童 canonical/3 分钟为 95、改编/压缩为 73，平均 pattern 88.07。
- repair attempted 10 中，4 个覆盖当前全部创作失败，6 个是历史尝试；applied 0、开放动作 86。事实文化、GEARS、逐场边界、基础可拍字段和图片请求仍为 45/45，图片任务 75。
- v14 首次生成与复用回归指标一致，复跑复用 45/45；M4 独立审计两次通过，仍不授予真人、专业、外部模型或成片信用。

M4 第十一切片完成时：

- 传说故事生成正文完成治理：`刘海砍樵` canonical/extended 不再输出“恐惧、犹豫、勇气、信念”“传说不灭，精神永存”等抽象口号，而以柴担/花篮/狐影的重复意象串起神异介入、乡邻压力、刘海放下武器并承担排斥风险、共同抬担的可见后果及花鼓戏传播结尾。
- 用户传说改编路径保留原作人物、事件顺序、“回头寻找”和“歌声留在山路上”，同时补入可见神异意象、人物选择代价与传播理由；逐场继续区分用户素材、知识条目、民间传说和影视化虚构，最终 `source_entries` 不再覆盖丢失“用户提供改编素材”。
- 传说 pattern 判定建立位置与因果合同：神异场必须以具体意象推动后续选择，凡人考验必须同时有压力、可见行动与代价，选择之后必须有结果；象征物至少跨三场且意义发生变化，末场必须用戏台/讲述/习俗等可见传播行动说明流传理由；空泛神异标签和“精神永存”不能得分。
- v16 正式基线为 legacy 3/45、创作质量 44/45、故事可发布 45/45、生产素材 3/45、全生产就绪 0/45；传说 canonical/extended/adaptation 分别为 93/93/76，三种变体全部通过。平均 genre 90.09、pattern 90.38、GEARS 100；唯一剩余创作质量失败为 `historical_drama--adaptation_or_compact`（pattern 64）。
- repair attempted 7、applied 0、开放动作 86；事实文化、逐场事实/文化边界和基础可拍字段仍为 45/45。v16 canonical 与 15×3 首次生成后，复跑分别复用 15/15、45/45，指标不漂移；M4 独立审计通过。机器结果仍不授予真人、专业、外部模型或成片信用。

M4 第十二切片完成时：

- 历史剧改编不再把三段用户原作机械复制成六场，也不再把“武昌、辛亥革命、终结帝制”误建为人物资产。`武昌起义` 改编固定为六个不同功能场景：10月9日计划泄露与搜捕倒计时、10月10日新军士兵承担失败风险选择提前发动、营门枪响、楚望台军械库争夺、军械分发后向湖广总督署推进、普通士兵行动引发武汉三镇与多省连锁响应。
- 人物资产改为 `新军士兵 / 起义军 / 普通士兵` 等行动群体；逐场分开记录用户素材、知识条目、回忆差异和合成再现，不虚构唯一第一枪人物，不把多省独立及帝制终结写成单一动作的结果。
- 历史群像 pattern 判定建立严格因果合同：日期/计划泄露与搜捕必须形成时代压力，人物必须在两条路及风险之间作出可见选择，军械库动作必须解释为何能继续推进，结尾必须呈现基层群体行动的连锁后果；至少三场有群体主动动作，超过三分之二场景有依据与创作边界。空泛“时代压力/历史余响”标签不能得分。
- v18 正式基线首次实现 M4 创作质量不变量整体 `passed`：legacy 3/45、创作质量 45/45、故事可发布 45/45、生产素材 3/45、全生产就绪 0/45；历史剧 canonical/extended/adaptation pattern 为 77/77/73。平均 genre 90.09、outline 100、pattern 90.58、GEARS 100。
- repair attempted 6、applied 0、开放动作 86；事实文化、逐场事实/文化边界和基础可拍字段仍为 45/45。v18 canonical 与 15×3 首次生成后，复跑分别复用 15/15、45/45，指标不漂移；M4 独立审计、lint 和 build 通过。`passed` 仅代表当前机器创作质量合同，不代表 production material、真实资产、外部 Provider、真人评审、专业信用或成片完成。

M4 第十三切片完成时：

- 修复 production material 只在生成前计算的生命周期缺口：Story 正文、结构化分场、对白、类型专属字段和 GEARS 生成后，统一在 post-generation 编排层重算 readiness；自动 repair 应用或回滚后也按最终 Story 再算一次，避免生成结果已经覆盖字段但门禁仍沿用旧快照。
- 生成后证据与源素材证据明确分层。机器派生的论点、知识大纲、场景目标、人物选择、对白、镜头次序等可以消除结构字段假缺口；官方目录链接、社区/传承人同意、采访片段、现场笔记、参考图/关键帧、单镜头实测、权利署名和场地许可继续只认源素材，不能从生成文本推断通过。
- 补充任务账本跟随最终 readiness 重建；11 个 production material 通过案例均已验证没有残留 `production_material_missing_field` 开放任务。矩阵合同升至 v20，强制清除旧项目缓存，不用旧快照冒充新证据。
- v20 正式基线：legacy 综合与生产素材均由 3/45 提升到 11/45，production material 缺口 42→34，开放动作 86→76；新增通过为 AI 漫剧 2/3、知识讲解 3/3、主题宣讲 3/3，社交短视频保持 3/3。创作质量、故事可发布、事实文化、逐场事实/文化边界、基础可拍字段与 GEARS 均保持 45/45；平均 genre 90.09、outline 100、pattern 90.58、GEARS 100。
- 全生产就绪仍为 0/45，`asset_gate` 与 `external_provider_gate` 仍各阻断 45/45；M4 独立审计通过。生产素材提升只代表机器可验证字段闭环，不授予真实资产、真实授权、外部 Provider、真人评审、专业信用或成片信用。

M4 第十四切片完成时：

- 人物故事的生成后结构证据可确定性覆盖人生阶段、角色关系、语言声线、生平事实边界和结尾余韵；缺明确人生阶段的改编压力例继续 fail closed。
- 历史项目只读派生重算先刷新 production material readiness 再重算质量门禁，不修改项目版本；15×3 正式矩阵复用项目 45/45。
- production material ready 11→13，素材阻断 34→32，开放动作 76→74；创作质量、故事可发布、GEARS、事实文化与逐场边界保持 45/45，全生产就绪保持 0/45。
- 定向 3 文件/34 项、M4 独立审计、Domain Pack 15 类型 comparison `--check`、Server lint/build 与最终 Server 全量 204 文件/1719 项通过，1 文件/2 项既有跳过、0 失败。沙箱内 `tsx` IPC 仍报 `listen EPERM`，正式矩阵与 comparison 经批准在沙箱外成功运行。

M4 第十五切片完成时：

- 教学训练从可执行教学场景派生概念分层与掌握检查；只有戏剧功能标签或泛化旁白的负例继续 fail closed。
- `education_training` 三种变体 production material ready 0→3，整体 legacy/生产素材 13→16，素材阻断 32→29，开放动作 74→71；创作质量、故事可发布、GEARS、事实文化与逐场边界保持 45/45，全生产就绪保持 0/45。
- 定向 3 文件/35 项、正式 15×3 复用 45/45、M4 独立审计、Server lint/build 与最终 Server 全量 204 文件/1720 项通过，1 文件/2 项既有跳过、0 失败。正式矩阵沿用已批准的沙箱外路径，未把环境能力记成产品能力。

M4 第十六切片完成时：

- 儿童故事从学习/选择场景派生连续可见行动例子，并从末场已有行为复盘派生家长/教师提示；抽象价值口号负例继续 fail closed。
- `children_story` 三种变体 production material ready 0→3，整体 legacy/生产素材 16→19，素材阻断 29→26，开放动作 71→67；儿童故事仍保留 1 个独立 pattern 动作。创作质量、故事可发布、GEARS、事实文化与逐场边界保持 45/45，全生产就绪保持 0/45。
- 定向 3 文件/36 项、正式 15×3 复用 45/45、M4 独立审计、Server lint/build 与最终 Server 全量 204 文件/1721 项通过，1 文件/2 项既有跳过、0 失败。正式矩阵沿用已批准的沙箱外路径，未把环境能力记成产品能力。

M4 第十七切片完成时：

- AI 漫剧只在 StoryScene 与 GearsSegment 对齐且主体动作、空间构图、镜头、光线四层同时成立时派生镜头提示分层；泛化“高质量漫画”负例继续 fail closed。
- `ai_comic_drama` 改编压力例补齐唯一素材缺口，片型 production material ready 2→3；整体 legacy/生产素材 19→20，素材阻断 26→25，开放动作 67→65。创作质量、故事可发布、GEARS、事实文化与逐场边界保持 45/45，全生产就绪保持 0/45。
- 定向 3 文件/37 项、正式 15×3 复用 45/45、M4 独立审计、Server lint/build 与最终 Server 全量 204 文件/1722 项通过，1 文件/2 项既有跳过、0 失败。正式矩阵沿用已批准的沙箱外路径，未把环境能力记成产品能力。

M4 第十八切片完成时：

- 场景短片审计确认当前三变体缺真实入场主体和跨节点路线，未放宽门禁；后续应修生成器。历史改编仅在明确日期、逐场依据、逐场补足边界、具体风险和跨地点因果共同成立时派生生产素材链，泛化历史模板负例继续 fail closed。
- `historical_drama` 改编压力例 production material ready 0→1，canonical/extended 保持阻断；整体 legacy/生产素材 20→21，素材阻断 25→24，开放动作 65→63。创作质量、故事可发布、GEARS、事实文化与逐场边界保持 45/45，全生产就绪保持 0/45。
- 定向 3 文件/38 项、正式 15×3 复用 45/45、M4 独立审计、Server lint/build 与最终 Server 全量 204 文件/1723 项通过，1 文件/2 项既有跳过、0 失败。正式矩阵沿用已批准的沙箱外路径，未把环境能力记成产品能力。

M4 第十九切片完成时：

- 场景短片生成器用稳定寻访者、门庭→院落→讲堂→原路返回的跨节点链替代无主体同地点模板，并规范化 `asset_split` 的“名称：说明”字段；寻访者可作为 GEARS 人物资产与图片任务绑定。
- readiness 仅在重复主体、多地点、明确路径、可见显现和不跨轴回程共同成立时派生空间生产证据，负例仍 fail closed。`scene_short` 0/3→3/3 ready；整体 legacy/生产素材 21→24，素材阻断 24→21，开放动作 63→54，repair attempted 6→3。
- v21 正式 15×3 有意重生成 45/45，定向 4 文件/46 项、M4 独立审计、M3 ProductionMaterial/Domain Pack/15 类对比 `--check`、Server lint/build 全部通过。完整复跑 204 文件/1725 项通过，1 文件/2 项既有跳过、0 失败；首跑既有 Stage 8 路由用例并发污染后单文件 8/8 通过。机器结果仍不授予真人、专业、真实资产、外部模型或成片信用。

M4 第二十切片完成时：

- 历史剧情 canonical/extended 从知识条目直接生成武昌起义六场事件链，明确日期、搜捕利害、提前发动、军械库转折、跨地点因果与合成再现边界；知识直生不冒充用户改编来源。
- `historical_drama` production material ready 1/3→3/3；整体 legacy/生产素材 24→26，素材阻断 21→19，开放动作 54→50，历史剧情平均 pattern 75.67→86.33。仍保留 3 个制度压力优化动作。
- v22 正式 15×3 有意重生成 45/45；定向 5 文件/88 项、M4 独立审计、Server lint/build 通过。本切片未再重复完整全量，最后有效全量仍为上一切片 204 文件/1725 项通过，1 文件/2 项既有跳过、0 失败。

M4 第二十一切片完成时：

- 传说故事生成与派生层将常德武陵口述主线、长沙花鼓戏传播层、用户版本主线、神异能力边界、刘海凡人愿望/代价、重复母题、地域差异、地方演艺习俗和奇观结尾组成同一可审计证据链。
- readiness 需要来源、规则、选择、共同后果、地域/流变和视觉回环共同成立，才派生完整传说生产字段；`legend_story` production material ready 0/3→3/3，整体 legacy/生产素材 26→29，素材阻断 19→16，开放动作 50→44。
- v23 正式 15×3 有意重生成 45/45；定向 5 文件/90 项、M4 独立审计、Server lint/build 与 `git diff --check` 通过。本切片未再重复完整全量，最后有效全量仍为第十九切片 204 文件/1725 项通过，1 文件/2 项既有跳过、0 失败。

M4 第二十二切片完成时：

- 岳麓书院文化宣传改用门联/笔记问题→年代/空间证据→朱张会讲论辩结构→当代课堂核对→到访行动的五场链，清除了与书院对象不符的针尖/工具通用模板。
- readiness 派生受众印象、蒙太奇弧、差异化旁白、行动号召与文化再现风险，但真实权利/署名继续 fail closed；三例当前都只缺 `rights_and_attribution`。文化宣传平均 pattern 83→95、开放动作 9→3；全矩阵开放动作 44→38，生产素材仍为 29/45。
- v24/v25 暴露的第 4 场 scene/segment prompt 噪声已在 v26 消除，GEARS 恢复 45/45。最终定向 5 文件/80 项、M4 独立审计、Server lint/build 与 `git diff --check` 通过；最后有效完整全量仍为第十九切片 204 文件/1725 项通过，1 文件/2 项既有跳过、0 失败。

M4 第二十三切片完成时：

- 岳麓书院纪录短片改为“现实问题→年代/空间证据→会讲有限再现→真实采访留白→当代课堂回答”的五场证据链；声音规划可派生 `ambient_sound`，但明确不是已完成现场收声。
- 自动地点字段改写为“待实地核验清单”；真实采访选段继续只认外部素材。三例 pattern 89→95、弱信号归零、开放动作 9→3；全矩阵开放动作 38→32，生产素材保持 29/45 是 fail-closed 结果。
- v27 正式 15×3 首轮重生成 45/45、复跑复用 45/45；定向 4 文件/88 项、M4 独立审计、Server lint/build 通过。最后有效完整全量仍为第十九切片 204 文件/1725 项通过，1 文件/2 项既有跳过、0 失败。

M4 第二十四切片完成时：

- 武陵源山水意境已形成同一空间的景深、色彩、一日光变、人物尺度、声景退场与景观事实边界；30 秒三场、1/3 分钟四场均保持低密度观众正文。
- v28 暴露的家族留白失败未沿用；v29 强制新建后，三变体 genre/pattern 为 94/97、production material ready 3/3、开放动作 0。全矩阵生产素材 32/45、素材阻断 13、开放动作 25、repair attempted 0。
- v29 正式 15×3 首轮重生成 45/45、复跑复用 45/45；定向 4 文件/92 项、M4 独立审计、Server lint/build 与 `git diff --check` 通过。最后有效完整全量仍为第十九切片 204 文件/1725 项通过，1 文件/2 项既有跳过、0 失败。

M4 第二十五切片完成时：

- 岳麓书院城市品牌三时长均生成“门庭→讲堂→校园→街巷→江岸”五段城市路线，绑定城市身份、文化游客/本地市民、分场声景、到访行动与晴雨备选；官方口号和许可状态保持明确否定/待确认边界。
- 严格派生层只认可完整场景证据链；`location_permissions` 继续只认源素材。城市品牌三例因此只剩真实场地许可，genre/pattern 稳定为 88/95，弱信号为 0；全矩阵生产素材 32/45、素材阻断 13、开放动作 25 均保持不变。
- v30 正式 15×3 首轮重生成 45/45、复跑复用 45/45；定向 4 文件/96 项、M4 独立审计、Server lint/build 通过。最后有效完整全量仍为第十九切片 204 文件/1725 项通过，1 文件/2 项既有跳过、0 失败。

M4 第二十六切片完成时：

- 人物改编生成器从同一知识证据行严格提取年份、年龄、任职与拒签事件，写入正文首句、人物卡、主角弧和第一场事实依据；缺少任一字段即 fail closed，不推断年龄或阶段。
- `character_story` 三变体现均为 production material ready；改编压力例的 `life_stage_window` 阻断和 `combined` 修复目标消失，只保留 pattern 优化动作。全矩阵生产素材 33/45、素材阻断 12、开放动作 23、repair attempted 0。
- v32 正式 15×3 首轮重生成 45/45、复跑复用 45/45；定向 4 文件/95 项、M4 独立审计、Server lint/build 通过。最后有效完整全量仍为第十九切片 204 文件/1725 项通过，1 文件/2 项既有跳过、0 失败。

M4 第二十七切片完成时：

- 外部证据字段判定已集中到 readiness 服务；项目自动草拟同时在任务选择和字段生成层拒绝参考图、单镜头实测、档案资产、采访选段与现场笔记，含外部字段的混合任务也不会被部分生成后整体关闭。
- 自动化仍可补身份动作一致性、多镜连续性、转场等机器规划，但外部任务保持 open；只剩外部证据时，Production Readiness 不再建议自动执行草拟动作。v32 指标保持生产素材 33/45、素材阻断 12、开放动作 23、全生产就绪 0/45。
- 完整 project-service 与 production-material-readiness 两文件 112 项、M4 独立审计、Server lint/build 与 `git diff --check` 通过。生成合同未变，未重复 15×3；最后有效正式矩阵仍为第二十六切片 v32 首轮重生成 45/45、复跑复用 45/45。

M4 第二十八切片完成时：

- 九类外部证据候选已有共享字段—类型映射、严格 schema、稳定 ID、SHA-256、HTTPS/项目制品 URI 与项目级账本；候选同时持久化到当前版本和源故事，同内容重放不重复写入。
- 候选导入 API 受 material review 权限保护，但导入行为明确不授信：四项验证标志均 false，不进入 material pack、不改变 readiness、不关闭 supplement task。下一步必须独立完成来源检索、内容 hash 和授权/使用范围验证。
- 定向 2 文件/3 项、完整 project-service 与 API 两文件 320 项、M4 独立审计、Server lint/build 与 `git diff --check` 通过。v32 指标保持生产素材 33/45、素材阻断 12、开放动作 23、全生产就绪 0/45；未重复 15×3。

M4 第二十九切片完成时：

- 项目制品外部证据已具备严格验收状态机：真实 reviewer 身份、字段范围声明、项目目录真实路径/符号链接边界和服务端 SHA-256 重算缺一不可；HTTPS 未抓取候选不可通过。
- 验收会让 readiness 认可 verified ledger 并关闭匹配任务；拒绝保持零信用，撤销会移除信用并在没有替代证据时重新打开任务。候选、验证人、认证方式、时间和备注均持久化到项目版本与源故事。
- 完整 project-service 与 API 两文件 320 项、production-material-readiness 40 项、M4 独立审计、Server lint/build 与 `git diff --check` 通过。正式矩阵无真实证据输入，v32 指标保持生产素材 33/45、素材阻断 12、开放动作 23、全生产就绪 0/45；未重复 15×3。

M4 第三十切片完成时：

- 新增 20 MiB 受控 multipart 外部证据上传；服务端计算 SHA-256 并以 `external-evidence/uploads/{sha256}.bin` 内容寻址原子落盘，原始文件名仅作去路径化显示元数据。
- 上传只生成 pending candidate，幂等重放不重复写入；空文件、字段类型错配和既有内容寻址制品完整性异常均 fail closed，严格 reviewer 验收链保持独立。
- 完整 project-service 与 API 两文件 322 项、production-material-readiness 40 项、M4 独立审计、Server lint/build 与 `git diff --check` 通过。正式矩阵无真实上传/验收，v32 指标保持生产素材 33/45、素材阻断 12、开放动作 23、全生产就绪 0/45；未重复 15×3。

M4 第三十一切片完成时：

- 验收/拒绝/撤销均写入带序号、前序 hash、请求 hash 和链头的追加式事件；同请求幂等重放不重复写入，同键异内容与陈旧候选状态均冲突。
- 新状态迁移前复算整条历史，任何事件或链头篡改都会阻断后续授信变化；项目仓储的物理写冲突/恢复与业务状态 CAS 共同生效。
- 完整 project-service 与 API 两文件 322 项、production-material-readiness 40 项、Server lint/build、M3 三项检查和 M4 独立审计通过。正式矩阵无真实审核事件，v32 指标保持生产素材 33/45、素材阻断 12、开放动作 23、全生产就绪 0/45；未重复 15×3。

M4 第三十二切片完成时：

- HTTPS 外部证据通过 DNS 全量公网校验、实际连接地址钉扎、逐跳重校验、TLS、超时/体积/跳转上限和保留地址拒绝后才能取回；私网、混合 DNS 和重绑定路径均 fail closed。
- 响应 hash 与候选一致后按内容寻址缓存到项目，抓取轨迹进入候选和追加式验证事件；真实 reviewer、状态 CAS、范围声明与审计链要求保持不变。
- HTTPS 适配器、完整 project-service 与 API 共 334 项、production-material-readiness 40 项、Server lint/build 和 M4 独立审计通过。正式矩阵无真实远端审核输入，v32 指标保持生产素材 33/45、素材阻断 12、开放动作 23、全生产就绪 0/45；未重复 15×3。

M4 第三十三切片完成时：

- 8 类文化题材源可与 16 类新增原创叙事机制组合；组合合同进入 schema、类型矩阵、推荐器、蓝图、prompt、质量/repair 和 Story 持久化，且固定禁止复用受保护作品表达。
- 修复 30 秒武陵源山水专用生成分支丢失首尾低密度旁白的既有回归；山水留白与内容密度合同恢复。
- 受影响 8 文件/69 项、最终 Server 全量 206 文件/1766 项通过，1 文件/2 项既有跳过；Server lint/build 和 M4 独立审计通过。v32 正式报告未为新机制重生成，现有数字只作为旧样本回归基线。

M4 第三十四切片完成时：

- 本地 fallback 已能把 16 类新增原创机制落成具体节拍与行动，并同步重组 `full_text`、`scene_breakdown`、幕用途和 `gears_segments`；逐场事实依据、戏剧化补足和神话/传说边界随产物保留。
- 四组代表性题材压力案例与 16/16 扩展机制执行覆盖通过；旧机制/默认 fallback 逐字段输出兼容测试通过。
- 专项 1 文件/6 项、相关 8 文件/74 项、最终 Server 全量 207 文件/1772 项通过，1 文件/2 项既有跳过；Server lint/build、M4 独立审计和 `git diff --check` 通过。实现提交为 `8fa29b93`。
- v32 正式 15×3 报告没有重生成，只完成独立一致性审计；新机制的代表性/全机制执行测试不能被表述为正式多题材组合矩阵或真人评审。

M4 第三十五切片完成时：

- `story-genre-fusion-plan/v1` 已把扩展机制分为全片主引擎与独立中段副机制；prompt、本地 fallback、运行 trace、正文、场景和 GEARS 使用同一分工。
- 四类语义张力进入可审计化解规则；副机制数量超过中段场景容量时返回 `genre_fusion_conflict`，不静默降级。
- 正式本地组合矩阵 16/16 通过，覆盖 8/8 题材源、16/16 主机制、16/16 副机制、8 个混合题材案例、4 类语义张力与容量门禁。报告 `--write`、`--check` 均通过。
- 新行为红测 4 项；专项 3 文件/28 项、受影响 8 文件/77 项、最终 Server 全量 208 文件/1776 项通过，1 文件/2 项既有跳过；Server lint/build、M3 两项基线、M4 v32 独立审计和 `git diff --check` 通过。实现提交为 `35fffb0b`。
- 组合矩阵仍是虚构 fixture + 本地确定性引擎证据；外部模型、真人、专业与真实生产信用均为 false。v32 的 15×3 指标未变，也未被本矩阵替代。

环境限制：

- `mcp-server/__tests__/run-production-readiness-automation.test.ts` 的 3 项测试需要监听 `127.0.0.1`，当前沙箱报 `listen EPERM` 并超时。
- Server API 路由定向测试在当前沙箱监听 `0.0.0.0` 时同样报 `listen EPERM`；本切片已由无端口的服务层测试覆盖对应健康合同。
- `tsx` IPC 在沙箱中存在间歇性 `listen EPERM .../tsx-*/...pipe`；不要反复重试或把它记为业务逻辑失败。
- 本轮知识合同审计的沙箱外执行请求被自动审批基础设施以未知参数错误拒绝；在审批能力恢复前不要用旁路执行或手工伪造报告。
- 隔离四种子全功能 smoke 在沙箱内受 `tsx` IPC 阻断，沙箱外申请又被自动审批基础设施拒绝；最后有效证明为本轮服务层端到端组合与全量测试，不得转述为该脚本已通过。
- 当前报告是在 `kb:production-audit` 成功运行时生成的；后续若修改审计逻辑，必须重新生成报告，不能沿用旧数字。

建议验证命令：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web/server
npm run audit:production-material-m3 -- --check
npm run audit:domain-pack-m3 -- --check
npm run audit:domain-pack-m3-comparison -- --check
npm run audit:story-genre-composition-matrix -- --check
npm run audit:story-agent-m4-machine-evaluation
npm run lint
npm run build

cd /Users/wuyu/Desktop/china-culture-kb/mcp-server
../web/node_modules/.bin/vitest run src/lib/production-field-guidance.test.ts src/tools/audit-production-materials.test.ts src/tools/audit-raw-production-field-gaps.test.ts src/tools/production-health-reports.test.ts
npm run build
npm run kb:raw-field-gap-audit -- --check
../web/node_modules/.bin/vitest run --exclude __tests__/run-production-readiness-automation.test.ts

cd /Users/wuyu/Desktop/china-culture-kb
git diff --check
```

新对话不要无条件重复 Server 全量测试；先按实际改动运行定向测试，完成新的里程碑边界后再跑一次全量。

## 9. 下一步开发顺序

### P0：收口 M3 并进入 M4 机器评测

1. 全国基础覆盖机器目标已完成：289 条、1043 个来源、34/34 地区至少 5 条；不要为追求数量继续无边界扩条。
2. 继续强化已接入的跨条目 Domain Pack：
   - 时代服饰与称谓（已有首包）；
   - 仪式礼俗与禁忌（本切片已完成首包）；
   - 建筑空间与陈设（已完成首包）；
   - 语言语体与地域表达（已完成首包）；
   - 自然环境、季节、天气和声景（已完成首包）。
3. 跨包检索、readiness、quality、repair、片型预期包映射、生成前反事实对照与生成后 readiness 重算已完成；原始字段 B1—B4 已全部清零；15 类型 × 3 样本的稳定性、诊断聚类、幂等和创作/生产分层指标已固化，故事可发布、GEARS 与创作质量均已 45/45。场景短片、历史剧情、传说故事、人物故事、文化宣传、城市品牌、纪录短片与山水意境的可生成结构已收口。当前 12 个 production material 阻断全部只认真实外部证据；下一步推进证据接入/校验合同，并继续优化有弱信号的 pattern，尤其改编类。不得把 prompt 差异或专业候选机器分转述为成片质量提升。
4. 若新增或修订条目，必须有来源、地点、核验方法、待核点、机器元数据与 `asset_split`；不得自动授予人工通过。

### P1：M3 源素材治理

1. 当前生产审计、M3 ProductionMaterial baseline 与原始字段治理账本均为 0 项缺口。
2. B1 非湖南高风险边界、B2 湖南高风险边界、B3 非湖南对白口吻与 B4 湖南对白口吻均已完成。
3. 运行时不再需要为这些字段提供机器兜底；后续新增条目仍须保持源字段完整。
4. 若要修改省级 Markdown，只能补有来源支撑的事实、素材或边界；不得把机器指导原样回写为知识事实。

### P2：M4 机器评测

在 M3 主要功能完成后：

1. 首版 15 类型 × 3 样本的 45 组机器对照已经固化并有独立一致性审计。
2. 当前指标已明确拆分：legacy 综合 33/45、创作质量 45/45、故事可发布 45/45、生产素材 33/45、全生产就绪 0/45。人物故事三变体也已全部通过生产素材门禁；剩余 12 例分别是纪录短片真实采访选段 3 例、文化宣传真实权利/署名 3 例、非遗宣传官方目录/资源链接 3 例和城市品牌真实场地许可 3 例。M4 机器创作质量不变量整体 `passed`；后续按外部证据接入/校验合同与 pattern 弱信号优化推进，不得把机器 `passed` 冒充真人、专业、外部模型或生产信用。
3. 修复后继续比较事实/文化边界、类型完成度、结构、场景可拍性、实际 repair trace 和稳定性，保持同一 45 案例口径。
4. 按当前用户指令，人工盲评不作为工程启动前置，但机器报告不得冒充真人反馈。

#### 已入库的剩余开发 backlog（第三十五切片后；15×3 正式矩阵仍为 v32）

1. 当前 15×3 矩阵已经没有可由生成器或派生结构继续解除的 production material 缺口；`character_story` 改编压力例的 `life_stage_window` 已由完整知识证据行严格派生。
2. 外部证据接入与校验：自动草拟、九类候选导入、受控 multipart 制品上传、项目制品路径/hash/范围验证、HTTPS DNS 钉扎安全抓取与项目缓存、验收/拒绝/撤销状态机、追加式 hash 审计和候选状态 CAS 已完成。下一步增加项目—源故事跨存储崩溃恢复；不得用请求自报、生成正文、机器计划或“待确认”措辞伪造证据。
3. 只认真实源素材：`documentary_short` 的采访选段 3 例、`culture_promo` 的权利与署名 3 例、`heritage_promo` 的官方目录/资源链接 3 例、`city_brand_promo` 的场地许可 3 例，以及其他授权、参考图和采访同意。
4. pattern 质量优化：继续处理当前 11 个 pattern 开放目标，优先改编类弱信号；保持事实、文化、可发布和 GEARS 45/45，不以降门禁换分数。
5. 新组合创作能力：8 类文化题材源与 16 类新增原创机制已进入外部模型 prompt、蓝图、质量/repair、持久化和本地 fallback；主/副机制分工、四类语义张力化解、容量冲突 fail-closed 和副机制独立中段兑现均已完成。正式本地矩阵覆盖 8/8 题材源、16/16 主机制、16/16 副机制和 8 个混合题材案例。下一步把该矩阵扩展到人物/历史/传说等兼容片型与多时长，并增加外部 adapter 的 record-replay 合同验证；v32 旧 15×3 报告仍不能作为新组合能力的外部模型或多片型评测证据。
6. 真实生产依赖：45/45 仍缺真实图片资产与外部 Provider 回执；后续要完成逐镜资产绑定、hash 校验、失败恢复和成片验证，但不将付费调用或公开发布默认纳入本地开发权限。

### 非阻塞项

- M2 runtime integration 报告固化；等待可运行 `tsx` IPC 的环境即可补齐。
- 真人评审、用户注册、真实 canary 流量和公开发布不在当前优先级。

## 10. 新对话开始时必须做的事

1. 阅读本文件。
2. 阅读 `.codex/skills/china-culture-story-agent/SKILL.md` 和其 `story-agent-contract.md`。
3. 核对分支、HEAD、`git status --short` 和 staged 状态。
4. 运行 M3 baseline `--check`，确认报告未陈旧。
5. 查看 P0 的 M4 机器评测、当前 45/45 可发布、GEARS 45/45 就绪和外部环境阻塞，不要重新实现 M0–M3 已完成能力。
6. 先完成一个有测试的 bounded slice，再更新报告和本交接。

## 11. 可直接复制的新对话启动指令

```text
请阅读：
/Users/wuyu/Desktop/china-culture-kb/docs/story-agent-writing-capability-kb2-handoff-20260803.md

继续开发 Story Agent“创作增强与知识库 2.0”专项。

B4 与 M4 第一至第三十五切片均已完成；第三十三至第三十五切片实现提交依次为 `0da1c530`、`8fa29b93`、`35fffb0b`。先核对分支、HEAD、git status、staged 状态和 M4 机器基线，确认交接文档提交与上游状态；不要假设交接数字仍然有效，也不要重复实现已完成能力。

当前优先级是把功能做全、把能力做好；人工评审、真人流程和用户注册不作为工程前置，但不得虚构人工信用。生成故事和机器派生生产指导不得写回 data/provinces/*.md。

全国基础覆盖机器目标已经完成：289 条、1043 个来源、34/34 地区至少 5 条。Domain Pack 与生成后 readiness 主链已完成，原始字段 B1—B4 已全部清零。M4 15×3 v32 当前正式基线：legacy 综合 33/45、创作质量 45/45、故事可发布 45/45、生产素材 33/45、全生产就绪 0/45；repair attempted 0、applied 0、开放动作 23，GEARS 45/45。production material 缺口已由 42 降到 12，剩余 12 例全部只认外部证据。8 类文化题材源与 16 类原创叙事机制已经具备主/副分工：主机制控制全片首尾，副机制必须在独立中段场景兑现；四类语义张力有确定性化解规则，容量不足时 fail closed。本地正式组合矩阵 16/16 通过，覆盖 8/8 题材源、16/16 主机制、16/16 副机制和 8 个混合题材案例；但它使用虚构 fixture 与本地引擎，不能冒充外部模型、真人或 v32 的 15×3 重生成。下一切片优先项目—源故事跨存储崩溃恢复，其次扩展组合矩阵到兼容片型/多时长并处理既有 pattern 弱信号。

每次汇报必须分别说明：当前阶段进度、专项总进度、既有 Story Agent MVP 进度、真实测试/运行健康与外部环境限制。
```

## 12. 交接边界

- B4 与 M4 第一至第三十五切片均已完成；第三十三至第三十五切片实现提交依次为 `0da1c530`、`8fa29b93`、`35fffb0b`，交接文档提交与上游状态以 `git log -3` 与 `git status -sb` 为准。v32 报告指标未变；新组合能力的正式本地矩阵另见 `story-agent-story-genre-composition-matrix.json`。
- 本文件只总结真实实现和已运行验证，不授予人工审核、真实生产、外部 worker 或公开发布信用。
- 新对话接手后如修改了行为代码，必须更新相应测试与机器报告；仅修改文档时无需重复完整 CI。
