# Story Agent 创作增强与知识库 2.0 交接快照（2026-08-03）

## 1. 本文件用途

这是新对话的首要交接入口，记录截至 2026-08-04 的真实工程状态、验证证据和下一步顺序。文件名保留首次交接日期，正文持续更新。

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
- 本轮起点 HEAD：`e4d1f3f7`（`feat(story-agent): deliver writing capability and knowledge base 2.0`）
- staged 文件：0
- 本轮起点上游同步：HEAD 与上游分支 `0/0`
- 交付范围：M3 Domain Pack 第十、十一切片、原始字段治理第十二至十五切片及其测试、基线和交接更新；本次交付统一提交并推送
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
- M3 工程实施：91%
- “创作增强与知识库 2.0”专项总进度：77.50%
- 既有 Story Agent MVP 总进度：99%

M2 剩余 1% 是机器报告固化，不是产品主链缺失。当前开发重点已经转到 M3。

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

## 7. 当前机器报告

关键报告：

- `data/reports/knowledge-base-production-audit.json`
- `docs/knowledge-base-production-audit.md`
- `data/reports/knowledge-base-raw-production-field-gap-governance.json`（第十二切片 168 项快照，待审批基础设施恢复后刷新）
- `docs/knowledge-base-raw-production-field-gap-governance.md`（同上）
- `data/reports/knowledge-base-content-supply-progress.json`（内容扩充收口报告；其中 M3 原始字段统计仍是第十二切片 168 项快照）
- `data/reports/story-agent-writing-capability-m3-production-material-baseline.json`
- `data/reports/story-agent-writing-capability-m3-domain-pack-baseline.json`
- `data/reports/story-agent-writing-capability-m3-domain-pack-15-type-comparison.json`

M3 基线当前：

```text
status = passed
video_type_coverage = 15/15
pack_count = 15
total_required_field_count = 184
total_sample_count = 100
production_audited_entry_count = 289
raw_source_production_field_gap_count = 67
machine_guidance_field_count = 67
effective_runtime_production_field_gap_count = 0
entries_with_machine_guidance = 67
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

环境限制：

- `mcp-server/__tests__/run-production-readiness-automation.test.ts` 的 3 项测试需要监听 `127.0.0.1`，当前沙箱报 `listen EPERM` 并超时。
- Server API 路由定向测试在当前沙箱监听 `0.0.0.0` 时同样报 `listen EPERM`；本切片已由无端口的服务层测试覆盖对应健康合同。
- `tsx` IPC 在沙箱中存在间歇性 `listen EPERM .../tsx-*/...pipe`；不要反复重试或把它记为业务逻辑失败。
- 本轮 15 类型 comparison baseline 的沙箱外复核也被自动审批基础设施的 `input[6].namespace` 参数错误拒绝；不得旁路执行或伪造新的通过记录。
- 本轮知识合同审计的沙箱外执行请求被自动审批基础设施以未知参数错误拒绝；在审批能力恢复前不要用旁路执行或手工伪造报告。
- 第十三、十四切片刷新原始字段治理账本时，沙箱外自动审批同样因 `Unknown parameter: input[6].namespace` 拒绝；现存账本仍是 168 项旧快照，恢复后先运行写模式，再运行 `--check`。
- 当前报告是在 `kb:production-audit` 成功运行时生成的；后续若修改审计逻辑，必须重新生成报告，不能沿用旧数字。

建议验证命令：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web/server
npm run audit:production-material-m3 -- --check
npm run audit:domain-pack-m3 -- --check
npm run audit:domain-pack-m3-comparison -- --check
npm run lint
npm run build

cd /Users/wuyu/Desktop/china-culture-kb/mcp-server
../web/node_modules/.bin/vitest run src/lib/production-field-guidance.test.ts src/tools/audit-production-materials.test.ts src/tools/audit-raw-production-field-gaps.test.ts src/tools/production-health-reports.test.ts
npm run build
# 审批基础设施恢复后：npm run kb:raw-field-gap-audit && npm run kb:raw-field-gap-audit -- --check
../web/node_modules/.bin/vitest run --exclude __tests__/run-production-readiness-automation.test.ts

cd /Users/wuyu/Desktop/china-culture-kb
git diff --check
```

新对话不要无条件重复 Server 全量测试；先按实际改动运行定向测试，完成新的里程碑边界后再跑一次全量。

## 9. 下一步开发顺序

### P0：继续 M3 跨条目生产能力与源素材治理

1. 全国基础覆盖机器目标已完成：289 条、1043 个来源、34/34 地区至少 5 条；不要为追求数量继续无边界扩条。
2. 继续强化已接入的跨条目 Domain Pack：
   - 时代服饰与称谓（已有首包）；
   - 仪式礼俗与禁忌（本切片已完成首包）；
   - 建筑空间与陈设（已完成首包）；
   - 语言语体与地域表达（已完成首包）；
   - 自然环境、季节、天气和声景（已完成首包）。
3. 跨包检索、readiness、quality、repair、片型预期包映射和生成前反事实对照已完成；原始字段 B1+B2 高风险边界和 B3 非湖南对白口吻均已清零，下一步处理湖南对白口吻 67 项。不得把生成前 prompt 差异转述为成片质量提升。
4. 若新增或修订条目，必须有来源、地点、核验方法、待核点、机器元数据与 `asset_split`；不得自动授予人工通过。

### P1：M3 源素材治理

1. 当前真实基线以 `knowledge-base-production-audit.json` 和 M3 ProductionMaterial baseline 的 67 项为准；168 项治理账本等待审批基础设施恢复后刷新。
2. B1 非湖南高风险边界 28 项、B2 湖南高风险边界 55 项、B3 非湖南对白口吻 33 项均已完成；下一步处理湖南对白口吻 67 项。
3. 运行时已有确定性兜底，因此源 Markdown 批量补齐不是当前能力阻塞项。
4. 若要修改省级 Markdown，只能补有来源支撑的事实、素材或边界；不得把机器指导原样回写为知识事实。

### P2：M4 机器评测

在 M3 主要功能完成后：

1. 固化 15 类型 × 3 样本的 45 组机器对照。
2. 比较事实/文化边界、类型完成度、结构、场景可拍性、修复次数和稳定性。
3. 按当前用户指令，人工盲评不作为工程启动前置，但机器报告不得冒充真人反馈。

### 非阻塞项

- M2 runtime integration 报告固化；等待可运行 `tsx` IPC 的环境即可补齐。
- 真人评审、用户注册、真实 canary 流量和公开发布不在当前优先级。

## 10. 新对话开始时必须做的事

1. 阅读本文件。
2. 阅读 `.codex/skills/china-culture-story-agent/SKILL.md` 和其 `story-agent-contract.md`。
3. 核对分支、HEAD、`git status --short` 和 staged 状态。
4. 运行 M3 baseline `--check`，确认报告未陈旧。
5. 查看 P0 的跨条目 Domain Pack、湖南 67 个对白口吻源字段和陈旧治理账本边界，不要重新实现 M0–M3 已完成能力。
6. 先完成一个有测试的 bounded slice，再更新报告和本交接。

## 11. 可直接复制的新对话启动指令

```text
请阅读：
/Users/wuyu/Desktop/china-culture-kb/docs/story-agent-writing-capability-kb2-handoff-20260803.md

继续开发 Story Agent“创作增强与知识库 2.0”专项。

前序 M0–M3 与第十至十五切片已经统一交付到当前分支。先核对分支、HEAD、git status、staged 状态和 M3 机器基线，不要假设交接数字仍然有效，也不要重复实现已完成能力。

当前优先级是把功能做全、把能力做好；人工评审、真人流程和用户注册不作为工程前置，但不得虚构人工信用。生成故事和机器派生生产指导不得写回 data/provinces/*.md。

全国基础覆盖机器目标已经完成：289 条、1043 个来源、34/34 地区至少 5 条。Domain Pack 的默认检索、Blueprint/readiness 追踪、质量泄漏门禁、repair 边界、片型预期包映射和 15 类型生成前反事实对照已完成。原始字段 B1+B2 高风险边界和 B3 非湖南对白口吻已经清零；当前生产审计只剩湖南 67 个对白/旁白口吻。继续 M3 P0：处理湖南对白口吻 67 项；不要把机器兜底回写成知识事实，不要重复实现已完成能力，也不要为数量无边界扩条。治理账本当前仍是 168 项旧快照，待审批基础设施恢复后刷新。完成下一个有定向测试和机器报告的 bounded slice 后，再更新交接与四类进度。

每次汇报必须分别说明：当前阶段进度、专项总进度、既有 Story Agent MVP 进度、真实测试/运行健康与外部环境限制。
```

## 12. 交接边界

- 前序累积实现与本轮第十至十五切片均由本次交付统一提交并推送至当前分支；精确状态以 `git status -sb` 和上游 ahead/behind 为准。
- 本文件只总结真实实现和已运行验证，不授予人工审核、真实生产、外部 worker 或公开发布信用。
- 新对话接手后如修改了行为代码，必须更新相应测试与机器报告；仅修改文档时无需重复完整 CI。
