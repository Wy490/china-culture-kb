# Story Agent 创作增强与知识库 2.0 交接快照（2026-08-03）

## 1. 本文件用途

这是新对话的首要交接入口，记录截至 2026-08-03 的真实工程状态、验证证据和下一步顺序。

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
- 当前 HEAD：`5f6261e2`（`feat(story-agent): audit stale image runs`）
- staged 文件：0
- 工作区：存在大量已修改和未跟踪文件，均未提交
- 处理原则：保留全部现有变更，不得执行 `git reset --hard`、`git checkout --` 或批量清理

这批未提交内容横跨 M0–M3，不能只根据文件是否 untracked 判断其是否可删除。新对话必须先运行 `git status --short`，在当前工作区上续做。

## 4. 当前进度

固定权重：

```text
M0 10% + M1 20% + M2 25% + M3 25% + M4 15% + M5 5% = 100%
```

- M0 实施：100%
- M1 实施：100%
- M2 工程实施：99%
- M3 工程实施：73%
- “创作增强与知识库 2.0”专项总进度：73.00%
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

2026-08-03 全库结果：

- 省级文件：34
- 正式条目：289
- 来源：1043
- 每个条目均审计 15 种片型模板
- 源字段原始缺口：212
- 机器指导覆盖：212
- 基础制作字段有效运行缺口：0
- 获得机器指导的条目：140
- 缺口分布：对白口吻 95、可戏剧化空间 75、禁用表达 35、视觉符号 7

注意：有效运行缺口归零不代表 212 个源 Markdown 字段已经人工补齐；它们仍保留为源素材治理积压。

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

## 7. 当前机器报告

关键报告：

- `data/reports/knowledge-base-production-audit.json`
- `docs/knowledge-base-production-audit.md`
- `data/reports/knowledge-base-content-supply-progress.json`
- `data/reports/story-agent-writing-capability-m3-production-material-baseline.json`
- `data/reports/story-agent-writing-capability-m3-domain-pack-baseline.json`

M3 基线当前：

```text
status = passed
video_type_coverage = 15/15
pack_count = 15
total_required_field_count = 184
total_sample_count = 100
production_audited_entry_count = 289
raw_source_production_field_gap_count = 212
machine_guidance_field_count = 212
effective_runtime_production_field_gap_count = 0
entries_with_machine_guidance = 140
domain_pack_entry_count = 22
production_domain_pack_coverage = 12/12
ritual_pack_production_prompts = 5
ritual_pack_review_boundaries = 5
ritual_retrieval_registered = true
architecture_language_environment_pack_count = 3
architecture_language_environment_production_prompts = 15
architecture_language_environment_review_boundaries = 15
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

环境限制：

- `mcp-server/__tests__/run-production-readiness-automation.test.ts` 的 3 项测试需要监听 `127.0.0.1`，当前沙箱报 `listen EPERM` 并超时。
- Server API 路由定向测试在当前沙箱监听 `0.0.0.0` 时同样报 `listen EPERM`；本切片已由无端口的服务层测试覆盖对应健康合同。
- `tsx` IPC 在沙箱中存在间歇性 `listen EPERM .../tsx-*/...pipe`；不要反复重试或把它记为业务逻辑失败。
- 本轮知识合同审计的沙箱外执行请求被自动审批基础设施以未知参数错误拒绝；在审批能力恢复前不要用旁路执行或手工伪造报告。
- 当前报告是在 `kb:production-audit` 成功运行时生成的；后续若修改审计逻辑，必须重新生成报告，不能沿用旧数字。

建议验证命令：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web/server
npm run audit:production-material-m3 -- --check
npm run audit:domain-pack-m3 -- --check
npm run lint
npm run build

cd /Users/wuyu/Desktop/china-culture-kb/mcp-server
../web/node_modules/.bin/vitest run src/lib/production-field-guidance.test.ts src/tools/audit-production-materials.test.ts src/tools/production-health-reports.test.ts
npm run build
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
3. 优先补齐跨包检索、readiness、quality、repair 和生成对照证据；Domain Pack 不得只增加静态数据。
4. 若新增或修订条目，必须有来源、地点、核验方法、待核点、机器元数据与 `asset_split`；不得自动授予人工通过。

### P1：M3 源素材治理

1. 保留当前 212 个原始源字段缺口清单。
2. 运行时已有确定性兜底，因此源 Markdown 批量补齐不是当前能力阻塞项。
3. 若要修改省级 Markdown，只能补有来源支撑的事实、素材或边界；不得把机器指导原样回写为知识事实。

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
5. 查看 P0 的跨条目 Domain Pack、212 个源字段治理积压和现有机器评测缺口，不要重新实现 M0–M3 已完成能力。
6. 先完成一个有测试的 bounded slice，再更新报告和本交接。

## 11. 可直接复制的新对话启动指令

```text
请阅读：
/Users/wuyu/Desktop/china-culture-kb/docs/story-agent-writing-capability-kb2-handoff-20260803.md

继续开发 Story Agent“创作增强与知识库 2.0”专项。

当前工作区包含 M0–M3 的大量未提交修改，不要 reset、checkout 或清理。先核对分支、HEAD、git status、staged 状态和 M3 机器基线，不要假设交接数字仍然有效，也不要重复实现已完成能力。

当前优先级是把功能做全、把能力做好；人工评审、真人流程和用户注册不作为工程前置，但不得虚构人工信用。生成故事和机器派生生产指导不得写回 data/provinces/*.md。

全国基础覆盖机器目标已经完成：289 条、1043 个来源、34/34 地区至少 5 条。先继续 M3 P0：强化时代服饰、仪式礼俗、建筑空间、语言语体、自然环境等已接入 Domain Pack 的跨包检索、readiness、quality、repair 和生成对照证据，并按来源处理 212 个源字段治理积压；不要重复实现已完成能力，也不要为数量无边界扩条。完成下一个有定向测试和机器报告的 bounded slice 后，再更新交接与四类进度。

每次汇报必须分别说明：当前阶段进度、专项总进度、既有 Story Agent MVP 进度、真实测试/运行健康与外部环境限制。
```

## 12. 交接边界

- 本轮没有创建 commit、没有 stage 文件、没有 push。
- 本文件只总结真实实现和已运行验证，不授予人工审核、真实生产、外部 worker 或公开发布信用。
- 新对话接手后如修改了行为代码，必须更新相应测试与机器报告；仅修改文档时无需重复完整 CI。
