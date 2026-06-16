# 修仙西幻 AI 漫剧开发流程文档

> 日期：2026-06-16
> 目标：把“东方道士穿越西方魔幻世界并觉醒修仙系统”以及“重生异兽/龙族女帝类动态漫爽剧”转化为可执行的知识库与 Story Agent 开发任务。

## 背景与参考

本开发方向来自两个创作目标：

- 东方道士穿越到西方魔幻世界，觉醒修仙系统，形成东西方力量体系碰撞的 AI 漫剧短剧。
- 参考 B 站视频 `BV1zxV16FEBZ` 的动态漫爽剧范式。已抓取到的视频元信息为：标题《mczc-动态漫-重生成蟒，吃货老婆竟是龙族女帝-0601-H020-H049-Q-ll》，UP 主“红果漫剧天才”，发布时间 2026-06-03。

注意：当前只确认了视频标题、UP 主、发布时间和题材方向，没有完整字幕和逐帧画面。因此本开发文档只把它作为“平台动态漫题材范式”参考，不复刻具体剧情、台词或画面。

## 总体判断

当前系统已经具备承载该方向的基础：

- `ai_comic_drama` 成片类型。
- AI 漫剧系列规划、分集生成、连续性账本、质量审计、Bible 导出。
- 叙事流派库 `narrative-pattern-library.ts`。
- 类型样片规则 `genre-story-profiles.ts` 与 `video-type-sample-reference-matrix.md`。

本次不建议新增一个全新的 `video_type`。推荐继续使用：

- `video_type`: `ai_comic_drama`
- `presentation_style`: `ai_comic` 或 `vertical_drama`
- `story_structure`: `single_event_drama`

真正需要补的是：

- 修仙/西幻/系统流/异兽进化的知识结构。
- 新增叙事流派模式。
- 流派级质量评分。
- 系列 Bible 中的能力、境界、系统任务、身份秘密等生产账本。
- 样片参考的可追溯记录。

## 架构原则

开发时遵守 Story Agent 现有链路：

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

不要把新题材规则散落在多个大提示词里。类型规则应尽量沉淀到：

- `web/server/src/services/narrative-pattern-library.ts`
- `web/server/src/services/genre-story-profiles.ts`
- `web/server/src/services/story-blueprint-service.ts`
- `web/server/src/services/genre-quality-service.ts`
- `web/server/src/services/quality-workflow-service.ts`
- `web/server/src/services/ai-comic-series-service.ts`

生成故事和系列项目不得写回 `data/provinces/*.md`。知识库只保存事实、来源、边界和可复用设定，生成内容应继续进入 `web/generated` 或项目版本文件。

## 一、知识库更新流程

### 1.1 建立知识分层

新增或整理知识时必须区分三类内容：

- 传统文化事实：道教、民俗、宗教仪式、术语来源、历史背景。
- 幻想改编母题：修仙、境界、灵气、符箓战斗化、系统任务、血脉觉醒。
- 平台爽剧结构：穿越、重生、吞噬进化、隐藏身份、女帝伴侣、三秒钩子、集末反转。

传统文化事实可以进入省份知识库或权威知识条目。幻想改编母题和平台爽剧结构应作为“创作规则/类型素材/样片观察”处理，不应被写成真实历史或真实民俗。

### 1.2 建议新增的知识字段

为适配 Agent 读取，后续知识条目或创作素材建议补充这些字段：

- `knowledge_domain`: `daoist_culture`、`fictional_xianxia`、`western_fantasy`、`platform_ai_comic_drama`。
- `entry_role`: `fact_anchor`、`fictional_motif`、`worldbuilding_rule`、`genre_pattern`、`visual_asset`。
- `asset_usage`: `protagonist_power`、`ritual_visual`、`system_rule`、`faction_design`、`episode_hook`。
- `asset_split`: 标记哪些内容是事实、哪些是幻想改编、哪些是用户原创设定。
- `evidence_boundary`: `verified_fact`、`plausible_dramatization`、`fictional_addition`、`unknown`。
- `forbidden_claims`: 不得写成事实的内容。
- `adaptation_notes`: 改编时可用的戏剧化方式。

### 1.3 东方道士穿越西幻方向的知识包

至少建立以下素材组：

| 素材组 | 内容 | 使用方式 |
|---|---|---|
| 道士身份 | 道观、师承、符箓、法剑、罗盘、斋醮、雷法、内丹等 | 主角文化根基与视觉资产 |
| 修仙体系 | 灵气、境界、筑基、金丹、元婴、心魔、天劫、丹药、阵法 | 系统升级与长期成长 |
| 西幻体系 | 魔法学院、元素魔法、圣光教会、骑士、龙族、恶魔、魔兽、魔晶 | 异世界规则与外部压力 |
| 力量碰撞 | 符阵 vs 魔法阵、灵气 vs 魔力、丹药 vs 药剂、天劫 vs 神罚 | 每集冲突和名场面 |
| 系统机制 | 任务、奖励、失败惩罚、隐藏成就、商城、面板、境界锁 | 爽点循环和剧情推进 |
| 阵营关系 | 教会、王国、魔法塔、龙族、异端审判所、东方遗迹 | 长篇主线和势力博弈 |

### 1.4 类似参考视频方向的知识包

如果做“重生成蟒，吃货老婆竟是龙族女帝”相近风格题材，应建立：

| 素材组 | 内容 | 使用方式 |
|---|---|---|
| 异兽进化谱系 | 蛇、蟒、蛟、龙、祖龙、异种血脉 | 长期升级阶梯 |
| 吞噬成长规则 | 吞噬对象、能力吸收、失败风险、反噬代价 | 每集爽点循环 |
| 龙族社会 | 龙宫、龙帝、龙女、血脉等级、族规、远古仇敌 | 世界观和隐藏主线 |
| 隐藏伴侣身份 | 吃货老婆、柔弱同伴、被追杀女子、真实女帝身份 | 关系反转和情绪爽点 |
| 非人主角视角 | 生存、捕食、误解人类/龙族规则、逐步觉醒人性 | 题材辨识度 |

## 二、叙事流派库开发流程

### 2.1 新增流派位置

主要修改：

- `web/server/src/services/narrative-pattern-library.ts`

将新流派加入 AI 漫剧可选流派：

- `xianxia_system_progression`: 修仙系统流。
- `east_west_magic_collision`: 东方术法撞西幻魔法。
- `isekai_identity_reversal`: 穿越身份反差。
- `beast_rebirth_evolution`: 异兽重生进化。
- `devour_growth_loop`: 吞噬成长循环。
- `hidden_empress_spouse_reveal`: 隐藏女帝伴侣。
- `dragon_bloodline_power`: 龙族血脉觉醒。

并加入 `VIDEO_TYPE_PATTERN_MAP.ai_comic_drama`。

### 2.2 流派定义模板

每个流派都应包含：

- `pattern_id`
- `label`
- `subject_family`
- `subgenre_tags`
- `user_facing_summary`
- `style_axes`
- `reference_archetypes`
- `narrative_engine`
- `protagonist_engine`
- `conflict_engine`
- `pacing_pattern`
- `scene_recipes`
- `quality_signals`
- `avoid`

### 2.3 修仙系统流建议规则

`xianxia_system_progression`：

- `narrative_engine`: 用系统任务、境界瓶颈、资源稀缺和失败惩罚推动每集升级。
- `protagonist_engine`: 主角不能凭空变强，必须通过选择、试错、代价和风险获得能力。
- `conflict_engine`: 系统目标、异世界规则、主角道门伦理和外部敌人互相冲突。
- `pacing_pattern`: 低起点 -> 系统任务 -> 规则试探 -> 代价暴露 -> 小突破 -> 更高境界钩子。
- `quality_signals`: 境界递进清楚、系统任务改变剧情、升级有代价、奖励能影响下一集。
- `avoid`: 系统只发奖励、境界跳跃无成本、修仙术语只当装饰。

### 2.4 东西魔法碰撞建议规则

`east_west_magic_collision`：

- `narrative_engine`: 把东西方力量体系差异变成可见冲突，而不是设定说明。
- `protagonist_engine`: 主角用东方术法解决西幻世界误判不了的问题，同时也会被西方规则限制。
- `conflict_engine`: 教会、魔法塔、骑士团或龙族把东方术法误判为异端、古神或禁术。
- `pacing_pattern`: 魔法规则压迫 -> 东方术法误读 -> 术法反制 -> 代价出现 -> 更大禁忌露出。
- `quality_signals`: 规则碰撞可拍、误读有后果、双方体系都有边界、不是单方面碾压。
- `avoid`: 东方全能碾压、西幻角色全员降智、世界观只靠旁白解释。

### 2.5 异兽吞噬进化建议规则

`devour_growth_loop`：

- `narrative_engine`: 用捕食、吞噬、反噬、进化和血脉觉醒构成单集爽点循环。
- `protagonist_engine`: 主角从弱小生物出发，靠危险选择获得成长。
- `conflict_engine`: 食物链、猎杀者、血脉压制、族群规矩共同制造压力。
- `pacing_pattern`: 弱小危机 -> 目标猎物 -> 吞噬风险 -> 能力觉醒 -> 身份误判 -> 更强猎杀者。
- `quality_signals`: 进化阶梯清楚、吞噬有风险、能力变化可见、结尾出现更高食物链。
- `avoid`: 吞噬无代价、能力随机堆叠、异兽身份只当皮肤。

### 2.6 隐藏女帝伴侣建议规则

`hidden_empress_spouse_reveal`：

- `narrative_engine`: 用亲密关系中的身份落差制造喜剧、误会、保护和反转。
- `protagonist_engine`: 主角以为自己在保护伴侣，实际不断被更高身份的伴侣暗中保护或观察。
- `conflict_engine`: 外敌羞辱、族规追杀、身份暴露风险、情感信任互相推动。
- `pacing_pattern`: 伴侣弱小表象 -> 外敌轻视 -> 主角出手 -> 女帝暗中压场 -> 身份裂缝 -> 集末暴露风险。
- `quality_signals`: 关系反转有铺垫、女帝身份不廉价、情感互动推动剧情、身份秘密逐步升级。
- `avoid`: 女帝只当外挂、伴侣没有目标、反转完全无铺垫。

## 三、类型样片规则更新流程

### 3.1 文档补充

修改：

- `docs/video-type-sample-reference-matrix.md`

在 AI 漫剧行或新增附录中补充“动态漫爽剧细分样片观察”：

- 参考来源：竖屏动态漫、红果漫剧、网文改编漫剧、系统流爽剧、异兽进化漫剧。
- 开场方法：第一格就是危机、羞辱、吞噬、审判、身份误判或能力觉醒。
- 中段推进：每 20-30 秒出现一次信息变化、能力变化或关系反转。
- 结尾策略：更高敌人出现、系统新任务、隐藏身份露缝、血脉压制、境界瓶颈。
- 画面抓手：大字旁白、近景表情、动作线、能力面板、血脉虚影、法阵/符阵对撞。

### 3.2 样片记录原则

可以记录：

- 标题、链接、UP 主、发布时间。
- 题材标签。
- 开场结构、转折结构、结尾钩子。
- 画面类型观察。
- 质量信号。

不要记录：

- 大段原字幕。
- 完整剧情复述。
- 可替代原视频观看的详细内容。

## 四、StoryBlueprint 更新流程

### 4.1 目标

让蓝图在生成前明确：

- 主角当前境界。
- 系统任务和失败代价。
- 当前西幻规则压力。
- 本集东西方力量碰撞点。
- 本集升级结果。
- 本集身份秘密推进。
- 下一集钩子。

### 4.2 建议新增蓝图字段

如果现有类型允许扩展，可为 AI 漫剧系列增加可选字段：

- `power_system_state`
- `cultivation_realm`
- `system_mission`
- `system_reward`
- `system_penalty`
- `magic_collision_point`
- `faction_pressure`
- `hidden_identity_thread`
- `upgrade_delta`
- `episode_cliffhanger`

### 4.3 蓝图生成规则

修改重点：

- `web/server/src/services/story-blueprint-service.ts`
- `web/server/src/services/ai-comic-series-service.ts`

生成分集蓝图时：

- 每集必须有明确目标，不只是“继续冒险”。
- 每集至少推进一个账本字段：境界、系统任务、阵营、身份秘密、关系、道具。
- 每集结尾必须能承接下一集动作。
- 不允许一集内连续跨越多个大境界，除非用户明确要求无脑爽文。

## 五、提示词与生成链路更新流程

### 5.1 Prompt Package

修改：

- `web/server/src/services/story-generation-prompt.ts`
- `web/server/src/services/scene-regeneration-prompt.ts`

需要注入：

- 已选流派的 `narrative_engine`、`pacing_pattern`、`quality_signals`、`avoid`。
- 当前系列账本中的境界、技能、系统任务、身份秘密。
- 知识边界：道教事实和修仙幻想必须分开。
- AI 漫剧表达要求：强开场、短对白、表情动作、画面定格、结尾钩子。

### 5.2 本地 fallback

如果存在本地 fallback 生成逻辑，必须同步更新：

- `web/server/src/services/dramatic-story.ts`
- `web/server/src/services/story-service.ts`

避免外部模型路径能生成新题材，本地 fallback 却退回普通历史/传说口径。

## 六、质量评分与修复流程

### 6.1 流派质量评分

修改：

- `web/server/src/services/genre-quality-service.ts`
- `web/server/src/services/quality-workflow-service.ts`

新增流派专属检查器，至少检查：

| 流派 | 必查项 |
|---|---|
| 修仙系统流 | 系统任务是否明确、奖励是否改变剧情、升级是否有代价、境界是否递进 |
| 东西魔法碰撞 | 双方规则是否可见、冲突是否来自规则差异、是否避免单方无脑碾压 |
| 异兽吞噬进化 | 吞噬目标是否明确、反噬/风险是否存在、能力变化是否可见 |
| 隐藏女帝伴侣 | 身份反转是否有铺垫、伴侣是否有自主目标、关系是否推动剧情 |

### 6.2 质量报告输出

质量报告中应显示：

- 已满足的流派信号。
- 偏弱的流派信号。
- 缺失的系统任务/境界/身份/钩子。
- 修复建议。

### 6.3 自动修复规则

修复时优先做这些动作：

- 给开场增加可见危机。
- 给系统任务增加失败代价。
- 把抽象升级改成可拍动作。
- 补一处东西方规则误读。
- 给结尾增加下一集动作，而不是只写悬念句。

## 七、AI 漫剧系列账本升级流程

### 7.1 新增生产账本

修改：

- `web/shared/types.ts`
- `web/shared/schemas.ts`
- `web/server/src/services/ai-comic-series-service.ts`

建议新增或扩展这些系列表：

- `power_ledger`: 境界、技能、法器、血脉、魔法适配状态。
- `system_mission_ledger`: 任务、奖励、惩罚、完成状态、影响集数。
- `faction_ledger`: 魔法塔、教会、王国、龙族、东方遗迹等势力关系。
- `identity_secret_ledger`: 隐藏身份、知情人、暴露风险、揭示计划。
- `resource_ledger`: 灵石、魔晶、丹药、材料、系统货币。
- `visual_asset_ledger`: 道袍、法剑、符纸、系统面板、龙影、法阵等固定视觉资产。

### 7.2 账本抽取

生成单集后，从以下内容抽取账本更新：

- `full_text`
- `scene_breakdown`
- 对白
- GEARS 分段
- Seedance 镜头提示词包

抽取重点：

- 主角新增能力。
- 本集任务完成结果。
- 法器或道具状态变化。
- 哪个角色知道了隐藏身份。
- 哪个阵营关系发生变化。
- 哪个视觉资产需要保持连续。

### 7.3 账本召回

生成下一集前，根据分集目标精准召回：

- 当前境界与能力上限。
- 未完成系统任务。
- 未回收身份秘密。
- 当前敌对势力。
- 已建立视觉资产。

## 八、GEARS 与视频提示词交付流程

如果本方向后续进入镜头级视频生成，应进一步使用 GEARS/Seedance 交付链路。

### 8.1 GEARS 分段要求

每个 `gears_segment` 应包含：

- 本段剧情动作。
- 当前能力/系统/身份状态。
- 漫画分镜感提示。
- 禁止画面漂移项。
- 下一段承接信息。

### 8.2 镜头提示词要求

每个镜头提示词应包含：

- 角色：姓名、身份、服装、表情、能力状态。
- 场景：西幻空间或东方元素侵入点。
- 动作：符箓、法阵、魔法、吞噬、血脉觉醒等可见动作。
- 镜头：近景表情、定格、推镜、分屏、动作线。
- 连续性：境界、道具、服装、伤势、法阵颜色。
- 禁用元素：不要把道教事实写成历史定论，不要让角色能力越级漂移。

## 九、前端产品流程

### 9.1 流派选择

AI 漫剧系列页应能选择新流派：

- 修仙系统流。
- 东西魔法碰撞。
- 穿越身份反差。
- 异兽吞噬进化。
- 隐藏女帝伴侣。

### 9.2 预览区

生成前预览应显示：

- 本集系统任务。
- 当前境界和能力。
- 本集东西方规则冲突。
- 本集身份秘密推进。
- 将召回的账本项目。

### 9.3 质量面板

质量面板应显示：

- 流派信号通过情况。
- 系统流/修仙流专项问题。
- 集末钩子是否可承接。
- 连续性冲突。

## 十、测试流程

### 10.1 单元测试

建议覆盖：

- 新流派能被 `ai_comic_drama` 选择。
- 新流派会进入 prompt package。
- `quality_signals` 能进入质量报告。
- 系统任务/境界字段能保存、加载、导出。
- 系列账本能在生成后更新。

### 10.2 集成测试

准备两个固定评测题：

1. 东方道士穿越到西方魔法学院，觉醒修仙系统，第一集 3 分钟 AI 漫剧。
2. 主角重生成弱小蟒蛇，靠吞噬进化，身边吃货少女真实身份是龙族女帝，第一集 3 分钟 AI 漫剧。

每次开发后检查：

- 前 3 秒是否有局。
- 主角目标是否明确。
- 系统/吞噬/境界是否推动剧情。
- 是否有可画成漫画定格的动作。
- 结尾是否能自然承接下一集。
- 传统文化事实和幻想改编是否分开。

### 10.3 回归测试

执行现有相关测试，并根据实际项目命令补充：

- 类型/schema 测试。
- prompt package 测试。
- genre quality 测试。
- AI 漫剧系列服务测试。
- 项目保存/加载测试。
- Bible 导出测试。

## 十一、分阶段开发计划

### Phase 1：文档与样片参考

目标：先让系统知道这个方向是什么。

任务：

- 更新 `docs/video-type-sample-reference-matrix.md`。
- 增加动态漫爽剧样片观察。
- 记录 `BV1zxV16FEBZ` 的元信息和结构观察。
- 明确不保存版权字幕和完整剧情。

验收：

- 文档中可以清楚说明 AI 漫剧动态漫爽剧的开场、中段、结尾和画面抓手。

### Phase 2：叙事流派库

目标：让用户能选择修仙/西幻/系统流/异兽进化等流派。

任务：

- 在 `narrative-pattern-library.ts` 增加新流派。
- 加入 `VIDEO_TYPE_PATTERN_MAP.ai_comic_drama`。
- 补测试，确保可选、可序列化、可进入 prompt。

验收：

- AI 漫剧生成时能选择并注入新流派规则。

### Phase 3：质量评分升级

目标：生成后能判断是不是合格的系统流爽剧，而不是泛泛 AI 漫剧。

任务：

- 增加流派级质量检查器。
- 质量报告显示满足/缺失信号。
- 修复建议能指向具体流派问题。

验收：

- 缺少系统任务、升级代价或集末钩子时，质量报告能明确指出。

### Phase 4：系列账本升级

目标：支持长篇连续生产。

任务：

- 增加能力、境界、系统任务、身份秘密、阵营、资源、视觉资产账本。
- 单集生成后抽取账本变化。
- 下一集生成前精准召回。
- Bible 导出包含新增账本。

验收：

- 连续生成 3 集时，境界、任务、身份秘密和阵营关系不漂移。

### Phase 5：前端与预览

目标：让用户能看见和编辑这些机制。

任务：

- 流派选择控件展示新流派。
- 单集预览展示系统任务、境界、身份秘密和召回账本。
- 质量面板展示流派信号。

验收：

- 用户能在生成前判断这一集会怎么升级、怎么反转、怎么承接下一集。

### Phase 6：镜头级交付

目标：服务动态漫/Seedance 视频生产。

任务：

- 把 scene_breakdown 和 gears_segments 转成镜头级提示词。
- 加入角色视觉连续性、能力特效连续性和禁用元素。
- 支持导出制作包。

验收：

- 每个镜头都有可执行的画面、动作、表情、镜头和连续性约束。

## 十二、新对话任务提示词

可以在新对话中直接使用：

```text
请阅读 docs/xianxia-western-fantasy-ai-comic-development-plan.md，并按文档从 Phase 1 和 Phase 2 开始实施。优先新增动态漫爽剧样片参考和 AI 漫剧叙事流派库，包括修仙系统流、东西魔法碰撞、穿越身份反差、异兽吞噬进化、吞噬成长循环、隐藏女帝伴侣、龙族血脉觉醒。遵守 Story Agent 架构，不要把规则只写进大提示词；同步补测试或最小验证。
```

如果想先做质量评分升级，可以改成：

```text
请阅读 docs/xianxia-western-fantasy-ai-comic-development-plan.md，并从 Phase 3 开始实施流派机制质量评分升级。重点为 ai_comic_drama 新增系统流、东西魔法碰撞、异兽吞噬进化、隐藏女帝伴侣的专项检查，质量报告要显示满足和缺失的流派信号，并给出可执行修复建议。
```

如果想先做长篇连续性，可以改成：

```text
请阅读 docs/xianxia-western-fantasy-ai-comic-development-plan.md，并从 Phase 4 开始实施 AI 漫剧系列账本升级。新增能力/境界/系统任务/身份秘密/阵营/资源/视觉资产账本，让单集生成后能抽取变化，下一集生成前能精准召回，并同步 Bible 导出。
```

## 十三、完成标准

本方向第一轮开发完成后，应达到：

- 用户可以选择“修仙系统流”“东西魔法碰撞”“异兽吞噬进化”等 AI 漫剧流派。
- 生成的故事不再只是泛泛穿越，而有系统任务、升级代价、规则碰撞、身份秘密和集末钩子。
- 质量报告能识别流派机制缺失。
- 系列生成能记住主角境界、系统任务、身份秘密、阵营关系和视觉资产。
- Bible 导出能服务后续动态漫制作。
- 传统文化事实、幻想改编和用户原创设定边界清楚。
