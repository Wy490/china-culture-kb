# Story Agent 类型片文本生成与剧情结构升级开发计划

> 版本：v0.1  
> 日期：2026-06-12  
> 目标项目：`/Users/wuyu/Desktop/china-culture-kb`  
> 关联文档：
> - `docs/ai-comic-series-longform-handoff.md`
> - `开发文档/china-culture-kb_story_generation_feature_dev_doc.md`
> - `开发文档/china-culture-kb_dramatic_story_generation_dev_doc.md`
> - `开发文档/china-culture-kb_video_type_generation_system_dev_doc.md`
> - `开发文档/story_agent_platform_full_development_plan.md`
> - `开发文档/story-agent-creative-reference-memory-mosaic-dev-doc.md`
> - `开发文档/story-agent-workbench-project-edit-export-dev-doc.md`
> - `docs/platform/story-agent-platform-roadmap.md`

---

## 1. 总体判断

当前工程已经完成了从“知识库条目生成短故事”到“故事 Agent 工作台”的关键基础：

- 15 种 `VideoType` 已落地；
- 11 种 `PresentationStyle` 已落地；
- 8 种 `StoryStructureType` 已落地；
- `dramatic-story.ts` 已有按类型区分的本地结构模板；
- `story-generation-prompt.ts` 已有外部模型用的类型 prompt profile；
- `memory_mosaic_biography` 已接入计划、生成、质量校验和局部重写；
- 故事项目、版本、单场景重写、GEARS delivery、GEARS callback 状态已有基础；
- AI 漫剧长篇已具备系列规划、分集卡片、连续性账本、单集生成和系列项目保存。

但当前仍有一个核心缺口：

```text
类型已存在，但“类型片文本生成”的中间结构、强约束、逐类型校验、修复闭环还不够系统。
```

换句话说，现在系统能知道用户选择了 `historical_drama`、`heritage_promo`、`ai_comic_drama`，也能给出不同模板，但还需要进一步保证：

1. 每种类型生成的 `full_text` 真正像该类型；
2. 每种类型都有自己的剧情/表达结构；
3. 每个场景不只是“段落”，而是承担明确戏剧功能；
4. 生成失败时能指出哪里不像类型片，并能重写；
5. 长篇 AI 漫剧能把单集剧情质量和系列连续性同时守住。

---

## 2. 新阶段目标

### 2.1 一句话目标

把现有 Story Agent 从“多类型视频方案生成器”升级为：

```text
类型片文本生成引擎
```

让每种 `video_type` 都拥有独立的：

- 类型叙事承诺；
- 剧情结构；
- 场景功能；
- 角色/信息推进规则；
- `full_text` 输出形态；
- `scene_breakdown` 输出形态；
- `gears_segments` 分段策略；
- 质量校验；
- 不达标修复策略。

### 2.2 成功效果

用户选择不同类型时，结果应明显不同：

- `character_story` 是人物选择与代价；
- `historical_drama` 是史实锚点下的历史冲突；
- `legend_story` 是传说意象与人心选择；
- `ai_comic_drama` 是强分镜、强对白、强表情、强钩子；
- `children_story` 是儿童可理解的温和冲突与成长；
- `culture_promo` 是视觉符号、核心主张和传播句；
- `heritage_promo` 是工艺流程、手部动作、传承困境；
- `city_brand_promo` 是地理识别、城市气质和古今连接；
- `social_short` 是 3 秒钩子、高密度信息和定格记忆点；
- `documentary_short` 是现实现场、文献依据和当代连接；
- `explainer_video` 是问题、概念、例子和可视化解释；
- `lecture_video` 是观点、论据、精神提炼和号召；
- `education_training` 是学习目标、步骤、练习和复盘；
- `scene_short` 是空间路线、时间层和氛围结尾；
- `landscape_mood` 是山水、季节、声音、光影和留白。

---

## 3. 当前能力与差距

### 3.1 已有能力

| 模块 | 当前状态 |
|---|---|
| 类型系统 | `VideoType` / `PresentationStyle` / `StoryStructureType` 已在 `web/shared/types.ts` 定义 |
| API schema | `StoryGenerateRequestSchema` 已支持 `video_type`、`presentation_style`、`story_structure` |
| 计划接口 | `/api/stories/plan` 已返回推荐类型、表现形式、叙事结构 |
| 生成接口 | `/api/stories/generate` 已按 `video_type`、`story_structure` 路由 |
| 本地剧情引擎 | `dramatic-story.ts` 已有各类型场景模板 |
| 外部模型提示 | `story-generation-prompt.ts` 已有类型 prompt profile |
| 回忆拼图 | `memory-mosaic-service.ts` 已实现 seed、内容、校验 |
| 参考质量 | `reference-quality-service.ts` 已有参考规则校验 |
| 项目系统 | `project-service.ts` 已支持项目、版本、懒迁移、局部更新 |
| 局部重写 | `story-regenerate-service.ts` 已支持 scene 级重写与结构感知 |
| 漫剧长篇 | `ai-comic-series-service.ts` 已支持系列规划、单集生成、连续性账本 |

### 3.2 关键差距

1. **类型 profile 还分散**  
   目前类型规则散落在 `VIDEO_TYPE_CONFIG`、`dramatic-story.ts`、`story-generation-prompt.ts`、前端展示里，缺少一个统一的 `GenreStoryProfile`。

2. **中间结构不够稳定**  
   生成链路缺少统一的 `StoryBlueprint`：先规划类型片结构，再生成正文，再生成场景，再生成 GEARS 分段。

3. **质量校验偏通用**  
   当前 `validateDramaticStory` 能判断是否有冲突、选择、动作，但不能充分判断“像不像非遗宣传片”“像不像知识讲解视频”“像不像 AI 漫剧”。

4. **修复闭环不完整**  
   如果生成出来不像类型片，目前主要是报问题或本地 fallback，缺少自动构造“修复提示包”的机制。

5. **长篇漫剧单集质量与系列质量未完全合并**  
   系列连续性账本已经有，但单集生成后还需要校验：本集是否回应上一集钩子、是否推进阶段目标、是否打开/回收线索、是否把新状态写入账本。

6. **前端缺少类型质量反馈视图**  
   用户能看到结果，但还看不到“该文本为什么符合或不符合所选类型”。

---

## 4. 新增核心概念

### 4.1 GenreStoryProfile

新增统一类型片配置：

```ts
export interface GenreStoryProfile {
  video_type: VideoType;
  label: string;
  narrative_promise: string;
  default_story_structures: StoryStructureType[];
  compatible_presentation_styles: PresentationStyle[];
  text_shape: GenreTextShape;
  beat_contract: GenreBeatContract[];
  required_elements: string[];
  forbidden_patterns: string[];
  scene_rules: string[];
  gears_rules: string[];
  quality_rules: GenreQualityRule[];
  repair_guidance: string[];
}
```

它是以后所有生成模块的唯一类型片来源。

建议新增文件：

```text
web/server/src/services/genre-story-profiles.ts
web/shared/genre-profiles.ts
```

其中：

- shared 只放可前端展示的 metadata；
- server 放完整生成、校验和修复规则。

### 4.2 StoryBlueprint

生成前先产出中间蓝图：

```ts
export interface StoryBlueprint {
  storyId?: string;
  entry_name: string;
  source_entry: string;
  video_type: VideoType;
  presentation_style: PresentationStyle;
  story_structure: StoryStructureType;
  target_duration: SupportedDuration;
  central_event?: string;
  central_question: string;
  protagonist?: string;
  genre_beats: StoryGenreBeat[];
  character_arcs: StoryCharacterArcPlan[];
  evidence_boundaries: EvidenceBoundary[];
  type_specific_requirements: string[];
}
```

生成顺序变为：

```text
EntryDetail / KnowledgePack
  → select central event
  → resolve GenreStoryProfile
  → build StoryBlueprint
  → generate full_text
  → derive scene_breakdown
  → derive gears_segments
  → validate by profile
  → repair if needed
  → store story project
```

### 4.3 GenreQualityReport

扩展现有 `StoryQualityReport`：

```ts
export interface GenreQualityReport extends StoryQualityReport {
  video_type: VideoType;
  story_structure: StoryStructureType;
  genre_score: number;
  missing_required_elements: string[];
  weak_beats: string[];
  forbidden_patterns_found: string[];
  repair_actions: string[];
}
```

前端可显示：

- 类型匹配度；
- 缺少的类型元素；
- 需要重写的场景；
- 是否建议重新生成。

---

## 5. 15 种类型片文本生成规则

### 5.1 剧情故事类

#### `character_story` 人物故事

文本必须围绕“人物选择”而不是“人物介绍”。

结构：

```text
危机开场 → 主角处境 → 阻力加深 → 做出选择 → 承担代价 → 精神落点
```

必需：

- 主角明确目标；
- 至少一个外部阻力；
- 至少一个价值选择；
- 选择带来的代价；
- 结尾体现人物变化或精神底色。

禁止：

- 从出生写到去世；
- 罗列生平成就；
- 只用赞美词，不写行动。

#### `historical_drama` 历史剧情短片

文本必须像历史事件短片，而不是历史科普稿。

结构：

```text
时代压力 → 人物卷入 → 制度/权力冲突 → 关键行动 → 正面冲突 → 历史余响
```

必需：

- 史实锚点；
- 时代或制度压力；
- 事件因果；
- 可影视化但不改变核心事实的细节；
- 可信度说明。

禁止：

- 虚构内容冒充史实；
- 只有宏大背景没有人物行动；
- 把历史人物写成现代爽文主角。

#### `legend_story` 神话/民间传说故事

文本必须兼顾神异感与民间叙事边界。

结构：

```text
传说起源 → 神异显现 → 凡人考验 → 命运转折 → 传说流传
```

必需：

- 神异或象征意象；
- 凡人的情感选择；
- 传说版本边界；
- 传说为何流传至今。

禁止：

- 把传说写成确定史实；
- 只堆奇观，不写人的情感；
- 过度现代解释，破坏民间故事感。

#### `ai_comic_drama` AI 漫剧

文本必须服务漫画分镜和追看动力。

结构：

```text
强钩子 → 角色登场 → 对白冲突 → 反转/觉醒 → 高燃定格或悬念钩子
```

必需：

- 每场有构图；
- 每场有人物情绪或表情；
- 有对白或强旁白；
- 有结尾钩子；
- GEARS segment 明确当前段落的漫画分镜提示。

禁止：

- 长段解释压过对白；
- 场景没有人物表情；
- 每集结尾没有追看理由。

#### `children_story` 儿童故事片

文本必须适合儿童理解，情绪温和。

结构：

```text
小主人公/儿童视角 → 遇到问题 → 探索发现 → 勇敢选择 → 温暖结尾
```

必需：

- 简单因果；
- 正向选择；
- 温和情绪；
- 一个清楚但不说教的道理。

禁止：

- 成人化复杂表达；
- 恐怖、血腥、压迫性细节；
- 晦涩典故堆叠。

### 5.2 宣传推广类

#### `culture_promo` 文化宣传片

文本必须有传播主张，不是百科介绍。

结构：

```text
视觉符号 → 文化根基 → 代表过程/场景 → 当代延续 → 传播关键句
```

必需：

- 核心文化符号；
- 核心主张；
- 当代连接；
- 一句可传播的关键句。

禁止：

- 空泛口号；
- 只有知识点没有画面；
- 全文都像展板文案。

#### `heritage_promo` 非遗/工艺宣传片

文本必须把“工艺过程”拍出来。

结构：

```text
技艺渊源 → 匠人/传承人 → 原料工具 → 工艺步骤 → 传承困境 → 希望收束
```

必需：

- 手部动作；
- 材料和工具；
- 2-4 个关键步骤；
- 传承关系；
- 当代价值。

禁止：

- 只喊“匠心”；
- 不写工艺流程；
- 把工艺写成抽象精神，没有可拍动作。

#### `city_brand_promo` 城市/文旅宣传片

文本必须让地方气质被看见。

结构：

```text
地标识别 → 历史底蕴 → 人文风貌 → 生活气息 → 城市气质定格
```

必需：

- 地理识别；
- 标志性空间；
- 古今连接；
- 当代生活场景；
- 城市气质关键词。

禁止：

- 景点堆叠；
- 旅游广告腔过重；
- 没有地方细节。

#### `social_short` 竖屏短视频

文本必须按短平台节奏写。

结构：

```text
3 秒钩子 → 一个核心事实 → 三个关键信息点 → 情绪推高 → 定格记忆点
```

必需：

- 开头第一句强钩子；
- 信息点短；
- 字幕感强；
- 结尾有可转发的关键句。

禁止：

- 铺垫过长；
- 长片旁白节奏；
- 信息散乱。

### 5.3 讲解教育类

#### `documentary_short` 微纪录片

文本必须兼顾现场、事实、人物和当代连接。

结构：

```text
现实现场 → 历史回望 → 关键节点 → 史料/专家解读 → 当代意义
```

必需：

- 现实地点或实物；
- 来源提示；
- 事实与再现边界；
- 可拍摄现场素材；
- 当代连接。

禁止：

- 完全戏剧化对白；
- 缺少事实依据；
- 把传说写成史实。

#### `explainer_video` 知识讲解视频

文本必须回答一个问题。

结构：

```text
提出问题 → 解释概念 → 拆成步骤/脉络 → 举例说明 → 总结记忆点
```

必需：

- 一个核心问题；
- 2-5 个知识点；
- 例子或类比；
- 图文/动画表达建议。

禁止：

- 变成剧情短片；
- 知识点无层级；
- 只有结论不解释原因。

#### `lecture_video` 宣讲片/观点阐释片

文本必须有观点和论据。

结构：

```text
提出主题 → 案例事实 → 观点分析 → 现实连接 → 总结号召
```

必需：

- 中心观点；
- 支撑案例；
- 精神提炼；
- 现实连接；
- 收束有力量但不过度口号化。

禁止：

- 空泛说教；
- 没有案例；
- 把复杂事实简化成单一口号。

#### `education_training` 教育/培训片

文本必须像课程。

结构：

```text
学习目标 → 知识模块 → 步骤示范 → 练习/提问 → 复盘要点
```

必需：

- 明确学习目标；
- 分层知识点；
- 步骤或方法；
- 小测/提问；
- 总结复盘。

禁止：

- 只做宣传；
- 没有学习路径；
- 信息过载。

### 5.4 场景空间类

#### `scene_short` 场景短片

文本必须以空间为主角。

结构：

```text
进入空间 → 视觉路线 → 空间中的故事/人物 → 古今叠印 → 氛围收束
```

必需：

- 明确空间身份；
- 视觉移动路线；
- 时间层；
- 场景氛围；
- 一个可停留的结尾画面。

禁止：

- 把地点写成人物传记；
- 只有景色形容；
- 路线不清。

#### `landscape_mood` 山水意境片

文本必须留白、低密度、重感官。

结构：

```text
山水开卷 → 光影/季节流动 → 人文痕迹 → 情绪停驻 → 留白收束
```

必需：

- 山水意象；
- 声音、光影、季节；
- 低密度旁白；
- 诗性结尾。

禁止：

- 信息密度过高；
- 口号化宣传；
- 过度剧情化。

---

## 6. 分阶段开发计划

### Phase 1：类型片规则统一化

目标：把分散规则收束为 `GenreStoryProfile`。

任务：

1. 新增 `web/server/src/services/genre-story-profiles.ts`；
2. 把 `story-generation-prompt.ts` 的 `VIDEO_TYPE_PROMPT_PROFILES` 迁入 profile；
3. 把 `dramatic-story.ts` 中 `DRAMATIC_STRUCTURES` 的类型结构迁入 profile；
4. 为 15 种类型补齐：
   - `narrative_promise`
   - `beat_contract`
   - `required_elements`
   - `forbidden_patterns`
   - `quality_rules`
   - `repair_guidance`
5. `story-generation-prompt.ts` 改为从 profile 读取规则；
6. `dramatic-story.ts` 改为从 profile 读取本地模板。

验收：

- 15 种类型都能读取同一个 profile；
- 不再在多个文件维护重复规则；
- 旧测试不退化。

### Phase 2：StoryBlueprint 中间层

目标：生成正文之前先生成结构蓝图。

新增文件：

```text
web/server/src/services/story-blueprint-service.ts
```

核心函数：

```ts
buildStoryBlueprint(input): StoryBlueprint
validateStoryBlueprint(blueprint): GenreQualityReport
```

任务：

1. 根据 `EntryDetail`、`KnowledgePack`、`video_type`、`story_structure` 构造 `genre_beats`；
2. 对剧情类生成 `central_event`、主角目标、阻力、选择、代价；
3. 对宣传类生成视觉符号、核心主张、当代连接；
4. 对讲解类生成核心问题、知识点、例子、总结；
5. 对场景类生成空间路线、时间层、氛围关键词；
6. 对 AI 漫剧生成集内钩子、对白压力、结尾钩子。

验收：

- `/api/stories/generate` 内部先生成 blueprint；
- 结果 JSON 可选写入 `story_blueprint_summary`；
- 生成失败能指出 blueprint 缺少什么。

### Phase 3：类型片正文生成改造

目标：`full_text` 从蓝图生成，而不是只拼 scene plot。

改造文件：

- `web/server/src/services/story-generation-prompt.ts`
- `web/server/src/services/story-generation-model.ts`
- `web/server/src/services/dramatic-story.ts`
- `web/server/src/services/story-service.ts`

任务：

1. 外部模型 prompt 输入 `StoryBlueprint`；
2. 本地 fallback 也输入 `StoryBlueprint`；
3. `full_text` 先按类型片结构生成；
4. `scene_breakdown` 再从正文和 blueprint 派生；
5. `gears_segments` 从场景和类型规则派生；
6. 保持外部 API 返回兼容。

验收：

- 同一条目生成不同 `video_type` 时，文本结构显著不同；
- `full_text` 不再只是场景 plot 拼接；
- 每个 `scene` 都能说明自己承担的类型片功能。

### Phase 4：逐类型质量校验与修复

目标：生成结果不符合类型时，能给出可执行修复。

新增文件：

```text
web/server/src/services/genre-quality-service.ts
web/server/src/services/story-repair-service.ts
```

任务：

1. 新增 `validateGenreStory(result, profile)`；
2. 每个类型至少 6 条校验；
3. 校验对象包括：
   - `full_text`
   - `scene_breakdown`
   - `gears_segments`
   - 类型专属字段
4. 新增 `buildStoryRepairPromptPackage`；
5. 外部模型可用时自动修复一次；
6. 无外部模型时返回 `quality_report` 和建议。

验收：

- `ai_comic_drama` 缺对白会被标记；
- `heritage_promo` 缺工艺步骤会被标记；
- `scene_short` 缺视觉路线会被标记；
- `lecture_video` 缺论点会被标记；
- 前端能展示质量问题。

### Phase 5：长篇 AI 漫剧剧情增强

目标：把长篇漫剧从“规划可用”升级为“单集剧情质量可控、系列连续性可审”。

改造文件：

- `web/server/src/services/ai-comic-series-service.ts`
- `web/client/src/views/AiComicSeriesStudio.vue`
- `web/shared/types.ts`
- `web/shared/schemas.ts`

新增概念：

```ts
AiComicEpisodeBeatPlan
AiComicEpisodeQualityReport
AiComicSeriesContinuityAudit
AiComicEpisodeRegenerationReason
```

任务：

1. 系列规划增加“主线剧情骨架”；
2. 每集卡片增加：
   - 本集开场钩子；
   - 中段转折；
   - 结尾钩子类型；
   - 角色状态变化；
   - 线索开合动作；
3. 单集生成前构造 `AiComicEpisodeBlueprint`；
4. 单集生成后校验：
   - 是否回应上一集结尾；
   - 是否推进本阶段目标；
   - 是否更新角色状态；
   - 是否打开/回收线索；
   - 是否为下一集留下明确承接；
5. 分集卡片被编辑后标记：
   - `plan_changed_after_generation`
   - `needs_episode_regeneration`
   - `needs_ledger_rebuild`
6. 支持“从第 N 集重建连续性账本”的设计与后端函数。

验收：

- 已生成分集被改后，前端能提示需重新生成；
- 生成第 N 集时必须读到账本；
- 单集质量报告能显示连续性问题；
- 可以从第 N 集重新推演账本状态。

### Phase 6：项目系统深度接入

目标：把故事项目、漫剧系列项目、生成质量报告统一沉淀。

任务：

1. `StoryProjectVersionSnapshot` 增加 `quality_report`；
2. `AiComicSeriesProjectDetail` 增加 `series_quality_audit`；
3. 故事详情页展示质量报告；
4. 项目详情页支持按质量问题筛选场景；
5. 局部重写后重新运行类型片校验；
6. 导出 Markdown / JSON 时带上：
   - 类型片信息；
   - 叙事结构；
   - 质量报告摘要；
   - 可信度边界；
   - GEARS 分段。

验收：

- 每个项目版本都可追溯生成质量；
- 局部重写不会绕过校验；
- 导出内容来自当前工作版本。

### Phase 7：前端体验升级

目标：让用户能控制和理解类型片生成，而不是只看结果。

改造文件：

- `web/client/src/views/StoryStudio.vue`
- `web/client/src/components/StoryPlan.vue`
- `web/client/src/components/StoryResult.vue`
- `web/client/src/views/ProjectDetail.vue`
- `web/client/src/views/AiComicSeriesStudio.vue`

任务：

1. StoryPlan 展示：
   - 推荐类型；
   - 推荐叙事结构；
   - 为什么推荐；
   - 需要补充的资料；
2. StoryStudio 增加高级设置：
   - 类型片结构强度；
   - 是否优先剧情；
   - 是否优先资料完整；
   - 是否开启自动修复；
3. StoryResult 展示：
   - 类型匹配度；
   - 场景功能；
   - 类型专属字段；
   - 质量问题；
4. AI 漫剧系列页展示：
   - 连续性账本；
   - 每集质量状态；
   - 已生成但计划已变化提示；
   - 下一集推荐生成入口。

验收：

- 用户能知道为什么结果像某个类型；
- 用户能对不满意场景发起局部重写；
- 用户能看到漫剧系列的连续性状态。

---

## 7. API 与数据结构调整

### 7.1 `/api/stories/plan`

增加可选返回：

```ts
genre_profile_summary?: {
  video_type: VideoType;
  narrative_promise: string;
  recommended_story_structures: StoryStructureType[];
  required_materials: string[];
}
```

### 7.2 `/api/stories/generate`

请求增加：

```ts
genre_strictness?: 'loose' | 'balanced' | 'strict';
auto_repair?: boolean;
```

响应增加：

```ts
story_blueprint_summary?: StoryBlueprintSummary;
genre_quality_report?: GenreQualityReport;
repair_trace?: StoryRepairTrace[];
```

### 7.3 `/api/projects/:projectId/regenerate-scene`

响应增加：

```ts
genre_quality_report?: GenreQualityReport;
repair_trace?: StoryRepairTrace[];
```

### 7.4 AI 漫剧系列接口

`AiComicEpisodeGenerateRequest` 增加：

```ts
auto_audit_continuity?: boolean;
auto_repair_episode?: boolean;
```

单集生成结果增加：

```ts
ai_comic_episode_quality?: AiComicEpisodeQualityReport;
continuity_audit?: AiComicSeriesContinuityAudit;
```

---

## 8. 测试计划

### 8.1 单元测试

新增：

```text
web/server/src/__tests__/genre-story-profiles.test.ts
web/server/src/__tests__/story-blueprint-service.test.ts
web/server/src/__tests__/genre-quality-service.test.ts
web/server/src/__tests__/story-repair-service.test.ts
web/server/src/__tests__/ai-comic-continuity-quality.test.ts
```

覆盖：

- 15 种类型都有完整 profile；
- 每种类型能生成 blueprint；
- 每种类型至少一个成功样例；
- 每种类型至少一个失败样例；
- 修复提示能针对具体缺口；
- AI 漫剧第 N 集能读取上一集账本。

### 8.2 API 测试

扩展：

```text
web/server/src/__tests__/api.test.ts
web/server/src/__tests__/outline-service.test.ts
```

覆盖：

- `/stories/plan` 返回类型片摘要；
- `/stories/generate` 支持 `genre_strictness`；
- 自动修复开启时返回 `repair_trace`；
- 质量不达标时返回 `genre_quality_report`；
- AI 漫剧系列单集生成后返回连续性校验。

### 8.3 前端验证

重点页面：

- `/story/new`
- `/stories/:storyId`
- `/projects`
- `/projects/:projectId`
- `/ai-comic-series/new`

验证：

- 类型片选择可用；
- 质量报告可见；
- 局部重写后质量重新计算；
- 漫剧分集编辑后出现重新生成提示；
- 页面在桌面和移动端布局不重叠。

---

## 9. 推荐实施顺序

优先级最高：

```text
Phase 1 → Phase 2 → Phase 4
```

原因：

- 先统一类型片规则；
- 再建立 StoryBlueprint；
- 再建立质量校验和修复闭环；
- 这样后续所有类型都能共享同一套生成质量基础。

随后执行：

```text
Phase 5 → Phase 6 → Phase 7
```

原因：

- 长篇 AI 漫剧已经有基础，需要尽快补连续性质量；
- 项目系统已经有基础，适合沉淀质量报告；
- 前端最后集中优化，避免频繁改 UI。

---

## 10. 第一轮具体任务清单

### Task 1：新增 GenreStoryProfile

修改/新增：

- `web/shared/types.ts`
- `web/shared/schemas.ts`
- `web/server/src/services/genre-story-profiles.ts`

完成标准：

- 15 种 `video_type` 均有完整 profile；
- 测试覆盖 profile 完整性；
- `story-generation-prompt.ts` 能从 profile 读取规则。

### Task 2：新增 StoryBlueprint

新增：

- `web/server/src/services/story-blueprint-service.ts`

完成标准：

- 每个 `video_type` 都能构造 blueprint；
- blueprint 包含 `genre_beats`；
- 测试覆盖历史人物、非遗、名胜古迹、神话传说四类条目。

### Task 3：改造生成链路

修改：

- `web/server/src/services/story-service.ts`
- `web/server/src/services/story-generation-prompt.ts`
- `web/server/src/services/dramatic-story.ts`

完成标准：

- `generateAndStoreStory` 使用 blueprint；
- 外部模型和本地 fallback 共用同一结构；
- 旧请求兼容。

### Task 4：新增 GenreQualityReport

新增：

- `web/server/src/services/genre-quality-service.ts`

修改：

- `web/shared/types.ts`
- `web/server/src/services/story-service.ts`
- `web/client/src/components/StoryResult.vue`

完成标准：

- 生成结果包含 `genre_quality_report`；
- 前端能显示类型匹配度和问题；
- 至少覆盖 10 个重点类型。

### Task 5：AI 漫剧连续性质量

修改：

- `web/shared/types.ts`
- `web/shared/schemas.ts`
- `web/server/src/services/ai-comic-series-service.ts`
- `web/client/src/views/AiComicSeriesStudio.vue`

完成标准：

- 单集生成后有连续性质量报告；
- 编辑已生成分集后能标记需要重新生成；
- 账本能从第 N 集重新推演。

---

## 11. 验收标准

### 功能验收

- 15 种 `video_type` 都有独立文本生成规则；
- 生成结果能明显体现所选类型；
- `full_text`、`scene_breakdown`、`gears_segments` 三者结构一致；
- 质量报告能指出类型不匹配问题；
- AI 漫剧长篇能维持跨集连续性。

### 文本质量验收

- 剧情类有目标、阻力、选择、代价；
- 宣传类有视觉符号、核心主张、传播句；
- 讲解类有问题、概念、例子、总结；
- 场景类有空间路线、时间层、氛围；
- AI 漫剧有对白、表情、钩子和分镜感；
- 儿童故事语言温和、因果清晰。

### 工程验收

- 类型、schema、后端、前端一致；
- 旧 `generation_type` 请求仍兼容；
- 旧故事详情页不崩；
- 测试覆盖新增服务；
- 前端 build 通过；
- 服务端 lint 和 tests 通过。

---

## 12. 不做事项

本阶段不做：

- 不重命名项目根目录；
- 不移动 `data/provinces`；
- 不引入数据库迁移；
- 不改变 GEARS 现有手动/回调链路；
- 不新增账号系统；
- 不一次性做其他领域代码；
- 不把创作参考样本写入知识库事实条目。

---

## 13. 给下一轮执行者的启动指令

```text
请阅读：
1. 开发文档/story-agent-genre-text-generation-upgrade-plan.md
2. docs/ai-comic-series-longform-handoff.md
3. web/shared/types.ts
4. web/server/src/services/story-service.ts
5. web/server/src/services/dramatic-story.ts
6. web/server/src/services/story-generation-prompt.ts
7. web/server/src/services/ai-comic-series-service.ts

然后先执行 Phase 1：
新增 GenreStoryProfile，统一 15 种 video_type 的类型片文本生成规则。

要求：
- 不破坏现有 API；
- 保持旧 generation_type 兼容；
- profile 必须覆盖 15 种 video_type；
- story-generation-prompt.ts 和 dramatic-story.ts 都从 profile 读取规则；
- 补充 profile 完整性测试；
- 通过服务端测试和前端 build。
```
