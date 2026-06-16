# 小学语文文化微课 Agent 开发流程文档

> 日期：2026-06-16
> 目标：基于两个 B 站小学语文课文讲解视频，规划 Story Agent 如何生成同类型“教材型文化微课/语文课文讲解片”，并说明知识库、样片库、生成链路、质量评分与交付能力需要补充什么。

## 一、视频观察与题材定位

用户提供了两个 B 站视频：

- `BV1x8Li6pE3K`：[小学语文四年级下-囊萤夜读（文言文）](https://www.bilibili.com/video/BV1x8Li6pE3K)，UP 主“孩子的一棠课”，发布时间 2026-05-23。
- `BV1z4VV6uE8L`：[小学语文三年级下《一幅名扬中外的画》](https://www.bilibili.com/video/BV1z4VV6uE8L)，UP 主“孩子的一棠课”，发布时间 2026-05-30。

当前抓取到的是视频元信息，没有完整字幕和逐帧画面。因此本开发计划只把它们作为“教材型语文微课”的样片参考，不复刻具体讲稿、课件结构或画面。

这两个视频与 `docs/xianxia-western-fantasy-ai-comic-development-plan.md` 中的“动态漫爽剧/修仙西幻 AI 漫剧”是两条不同能力线：

- 修仙西幻文档解决：AI 漫剧、网文爽剧、系统流、连续剧情、境界/任务/身份秘密账本。
- 本文档解决：小学语文课文微课、文言文讲解、教材文本解读、课堂目标、字词句段、朗读与练习闭环。

两条能力线可共用的底层原则：

- 样片参考只蒸馏结构，不保存版权文本。
- 知识库不是资料仓库，而是 Agent 可读的结构化决策系统。
- 生成链路仍遵守 `Knowledge entry / user material -> StoryBlueprint -> full_text -> scene_breakdown -> gears_segments -> quality report -> repair`。
- 不把生成内容写回 `data/provinces/*.md`。

## 二、当前系统能做什么

现有系统已有与教育微课相关的基础类型：

- `explainer_video`：知识讲解视频。
- `lecture_video`：宣讲片。
- `education_training`：教育/培训片。
- `children_story`：儿童故事片。
- `host_narration`、`animation_2d`、`museum_exhibit` 等表现形式。
- `lecture_argument`、`case_reconstruction` 等叙事结构。

这些能力适合通用知识讲解，但还不能稳定生成“小学语文课文讲解片”，主要缺口是：

- 没有年级/学段适配。
- 没有教材课文结构字段。
- 没有课标目标、单元目标、课后习题和教学重难点。
- 没有文言文专用讲解链路。
- 没有课文图像/艺术作品讲解链路。
- 没有课堂互动题、朗读指导、练习反馈的结构化输出。
- 没有教育合规和版权边界。

## 三、是否需要新增知识库

结论：需要新增“教育型知识库/Domain Pack”，但不一定要新建完全独立的仓库。

推荐策略：

1. 保留现有 `data/provinces/*.md` 作为文化人物、故事、地点、非遗、民俗等核心文化知识库。
2. 新增教育领域 Domain Pack，用于教材、课标、课文、教学目标、练习题、学段表达等结构化规则。
3. 新增样片参考库，用于记录“语文微课”的结构观察。
4. 新增可选的课件资产包，用于管理图片、板书、关键词卡片、练习页、朗读音频提示等制作资产。

建议新增文件或目录：

```text
data/domain-packs/primary-chinese-education.json
data/domain-packs/lesson-video-patterns.json
data/lesson-packs/primary-chinese/
data/sample-references/lesson-videos.json
```

如果暂时不想增加太多目录，可先只建：

```text
data/domain-packs/primary-chinese-education.json
```

再把样片观察先写入 `docs/video-type-sample-reference-matrix.md` 的教育附录。

## 四、知识库逻辑需要怎么更新

### 4.1 新增知识域

在知识库撰写规范中补充教育类取值：

- `knowledge_domain`: `primary_chinese_education`
- `knowledge_domain`: `textbook_lesson`
- `knowledge_domain`: `classical_chinese_learning`
- `knowledge_domain`: `artwork_text_learning`
- `knowledge_domain`: `lesson_video_pattern`
- `knowledge_domain`: `teaching_activity_pack`

新增 `entry_role`：

- `lesson_entry`: 单篇课文条目。
- `curriculum_standard_pack`: 课程标准包。
- `grade_level_pack`: 年级学段包。
- `unit_goal_pack`: 单元目标包。
- `teaching_point_pack`: 教学点包。
- `exercise_pack`: 练习题包。
- `reading_guidance_pack`: 朗读指导包。
- `visual_teaching_asset`: 图示/板书/课件资产包。
- `lesson_video_pattern`: 微课结构样片包。

新增 `asset_usage`：

- `learning_objective`
- `text_interpretation`
- `vocabulary_explanation`
- `sentence_analysis`
- `reading_rhythm`
- `recitation_guidance`
- `classroom_interaction`
- `exercise_design`
- `blackboard_design`
- `visual_aid`
- `assessment_rubric`

### 4.2 新增课文条目结构

每篇课文建议写成 Agent 可读条目，而不是复制全文资料。推荐结构：

```md
# 课文名称

- **knowledge_domain**：textbook_lesson
- **entry_role**：lesson_entry
- **grade**：三年级下 / 四年级下
- **unit**：待核实
- **lesson_type**：现代文 / 文言文 / 说明文 / 记叙文 / 古诗文 / 艺术作品说明
- **recommended_video_type**：education_training / explainer_video
- **presentation_style**：host_narration / animation_2d / museum_exhibit
- **target_audience**：小学三年级 / 小学四年级

## 教学目标

- 字词目标：
- 朗读目标：
- 理解目标：
- 表达目标：
- 文化目标：

## 教学重难点

- 重点：
- 难点：
- 易错点：

## 课文结构

- 开头：
- 中段：
- 结尾：
- 关键句：
- 关键词：

## 文化知识边界

- 可讲事实：
- 可用类比：
- 不可夸大：
- 待核实点：

## 微课生成提示

- 开场问题：
- 板书结构：
- 互动题：
- 练习题：
- 结尾复盘：
```

### 4.3 《囊萤夜读》知识包

该视频对应“四年级下文言文课文讲解”。需要的知识结构包括：

- 文言文原文处理：只保存必要引用和教学要点，避免全文版权风险。
- 字词解释：囊、萤、恭勤、博学、练囊、夜读等。
- 句意拆解：逐句解释、关键词位置、现代汉语转换。
- 人物故事：车胤勤学故事的可证层、典故层、教材层。
- 学习主题：勤学、坚持、借助有限条件学习。
- 朗读指导：停顿、重音、节奏、文言语感。
- 练习闭环：解释词语、翻译句子、复述故事、联系生活。

必须标注：

- 典故来源和教材呈现边界。
- 不把励志故事过度神化。
- 不把“囊萤夜读”的所有民间版本混为确证事实。

### 4.4 《一幅名扬中外的画》知识包

该视频对应“三年级下课文讲解”，核心是围绕《清明上河图》的说明性课文和文化理解。需要的知识结构包括：

- 课文类型：说明性文章/艺术作品介绍。
- 核心对象：《清明上河图》。
- 作者与时代：张择端、北宋，需核对教材口径和权威来源。
- 画面内容：人物、街市、桥梁、船只、店铺、交通、生活场景。
- 说明顺序：整体到局部、画面内容到艺术价值。
- 关键词：名扬中外、形态各异、热闹、完整、保存、风貌等。
- 文化价值：城市生活、绘画艺术、历史信息。
- 视觉讲解：局部放大、路线导览、人物观察、对比提问。

必须标注：

- 对《清明上河图》的介绍要基于权威资料。
- 课文讲解不等于美术史论文，语言要适合三年级。
- 画作细节可做观察引导，但不能臆造画中人物故事为史实。

## 五、成片类型是否要新增

第一阶段不建议新增 `video_type`。推荐用现有类型组合：

| 需求 | 推荐类型 |
|---|---|
| 课文精讲 | `education_training` |
| 知识点讲解 | `explainer_video` |
| 文言文故事化导入 | `children_story` 或 `character_story` 作为片段，不作为主类型 |
| 画作/文物导览 | `explainer_video` + `museum_exhibit` |
| 竖屏短知识点 | `social_short` |

但需要给 `education_training` 和 `explainer_video` 新增“语文课文微课”流派，而不是把课文讲解硬塞进通用培训模板。

如果后续大量生产语文课件视频，可以再评估新增：

- `textbook_lesson_video`
- `primary_chinese_lesson`

新增 `video_type` 的条件：

- 前端需要单独入口。
- 质量报告与通用 `education_training` 差异很大。
- 生成字段长期稳定，如年级、课文、单元、课后题、板书、练习。
- 至少有 10 个以上固定评测样本。

## 六、叙事流派库更新

### 6.1 新增流派位置

修改：

- `web/server/src/services/narrative-pattern-library.ts`

新增并挂到：

- `education_training`
- `explainer_video`
- 可选挂到 `social_short`

### 6.2 建议新增流派

`primary_chinese_lesson_flow`：小学语文课文精讲流程。

- 主角引擎：学生从“不理解课文”到“会读、会讲、会用”。
- 冲突引擎：生字词、句意、段落结构、文化背景、课后题。
- 节奏结构：学习目标 -> 课题导入 -> 字词扫障 -> 句段理解 -> 主题归纳 -> 练习反馈。
- 质量信号：目标清楚、难点拆开、例题可做、复盘完整。
- 避免：只复述课文、知识点无层级、讲得像成人讲座。

`classical_chinese_sentence_breakdown`：小学文言文逐句讲解。

- 主角引擎：学生掌握文言词义、停顿、句意和故事主题。
- 冲突引擎：古今词义差异、句子省略、语序、朗读节奏。
- 节奏结构：朗读 -> 断句 -> 字词 -> 句意 -> 故事复述 -> 主题联系。
- 质量信号：停顿清楚、字词准确、翻译不成人化、练习能检测理解。
- 避免：把文言文讲成历史考据课、一次性堆太多术语。

`artwork_text_visual_walkthrough`：画作/图文课文视觉导览。

- 主角引擎：学生通过观察局部理解文本说明对象。
- 冲突引擎：画面细节多、说明顺序难辨、文化价值抽象。
- 节奏结构：整体看画 -> 局部放大 -> 人物/场景观察 -> 说明顺序 -> 价值总结。
- 质量信号：观察路线清楚、图文对应、局部细节服务课文、结尾有文化理解。
- 避免：只讲画史不回到课文、臆造画中故事、画面导览无顺序。

`lesson_interaction_loop`：课堂互动闭环。

- 主角引擎：通过提问、暂停思考、作答反馈完成学习。
- 冲突引擎：学生容易误解或漏掉关键点。
- 节奏结构：问题 -> 停顿 -> 提示 -> 答案 -> 反馈 -> 下一题。
- 质量信号：问题可回答、答案短清楚、反馈有针对性、难度适合年级。
- 避免：问题太空、答案太长、没有反馈。

`blackboard_summary_pack`：板书总结结构。

- 主角引擎：把分散知识收束成可记忆板书。
- 冲突引擎：知识点多但学生需要抓主干。
- 节奏结构：课题 -> 关键词 -> 结构图 -> 主题句 -> 练习提示。
- 质量信号：板书短、层级清楚、能复述课文。
- 避免：板书像长篇提纲、关键词太多。

## 七、Genre Profile 与样片规则更新

### 7.1 更新 `education_training`

修改：

- `web/server/src/services/genre-story-profiles.ts`

给 `education_training` 增加“语文课文微课”样片规则：

- 开场：直接说明今天学哪篇课文、学完会解决什么问题。
- 中段：字词、句子、段落、主题、练习逐层推进。
- 结尾：用板书/清单复盘，再给一道迁移题。
- 画面：课题卡、关键词标注、逐句高亮、段落结构图、练习题卡。
- 文案：语言适合目标年级，短句，不用成人学术腔。

### 7.2 更新 `explainer_video`

给 `explainer_video` 增加“文化对象讲解”变体：

- 适合《一幅名扬中外的画》这类课文。
- 以问题导入：为什么这幅画名扬中外？
- 用视觉路线讲解：先整体，再局部，再价值。
- 每一段只讲一个观察任务。
- 结尾回到课文表达方法和文化意义。

### 7.3 更新样片参考矩阵

修改：

- `docs/video-type-sample-reference-matrix.md`

新增“教材型语文微课”样片观察：

| 样片类别 | 开场 | 中段 | 结尾 | 画面/文案 |
|---|---|---|---|---|
| 文言文课文讲解 | 课题+学习目标+朗读 | 断句、字词、句意、故事、主题 | 复盘+练习 | 原文高亮、停顿线、词义卡、句意转换 |
| 说明性课文讲解 | 问题导入+对象展示 | 说明对象、说明顺序、关键词、文化价值 | 方法总结+迁移观察 | 图片局部放大、路线箭头、关键词板书 |
| 小学语文微课 | 年级适配目标 | 字词句段篇逐层拆解 | 课堂题+板书总结 | 主讲人/动画/课件三合一 |

## 八、StoryBlueprint 更新

### 8.1 新增蓝图字段

建议为教育类生成增加可选字段：

- `grade_level`
- `lesson_title`
- `lesson_type`
- `learning_objectives`
- `key_vocabulary`
- `sentence_focus`
- `paragraph_structure`
- `cultural_background`
- `reading_guidance`
- `teaching_difficulties`
- `interaction_questions`
- `practice_tasks`
- `blackboard_summary`
- `copyright_boundary`

### 8.2 蓝图生成规则

修改：

- `web/server/src/services/story-blueprint-service.ts`
- `web/server/src/services/story-generation-prompt.ts`

教育类蓝图必须先解决：

- 这节课给几年级学生看。
- 学完能掌握什么。
- 哪些字词句是重点。
- 哪个文化背景必须讲，但不能讲过头。
- 哪些问题用于互动。
- 最后如何检测学生理解。

不要把教育微课写成故事脚本，也不要把课文讲解写成成人知识讲座。

## 九、Prompt Package 更新

### 9.1 系统提示词

教育类生成需要注入：

- 年级表达约束。
- 学习目标。
- 教学重难点。
- 课堂互动格式。
- 练习题和答案。
- 板书总结。
- 版权与引用边界。

### 9.2 输出形态

教育微课输出建议包含：

- `full_text`: 主讲稿，含板书提示和互动提示。
- `scene_breakdown`: 每个教学环节一场。
- `gears_segments`: 可制作的视频段落。
- `lesson_plan`: 结构化教案。
- `blackboard_summary`: 板书。
- `practice_set`: 练习题与参考答案。
- `visual_prompt`: 课件画面提示。

如果暂时不扩 schema，可先把 `lesson_plan`、`blackboard_summary`、`practice_set` 放入 `additional_outputs` 或 `quality_report` 的扩展字段，再统一产品化。

## 十、质量评分与修复

### 10.1 教育微课质量检查器

新增检查：

- 是否有明确学习目标。
- 是否适配年级语言。
- 是否有字词/句段/主题层级。
- 是否有互动问题。
- 是否有练习与答案。
- 是否有板书复盘。
- 是否避免版权风险。
- 是否避免文化知识过度扩写。

### 10.2 文言文专项检查

针对《囊萤夜读》类：

- 是否有朗读停顿。
- 是否有关键词解释。
- 是否有逐句句意。
- 是否有故事复述。
- 是否有主题归纳。
- 是否避免把典故讲成无边界史实。

### 10.3 画作课文专项检查

针对《一幅名扬中外的画》类：

- 是否有观察路线。
- 是否有图文对应。
- 是否讲清说明顺序。
- 是否区分课文内容、画作事实和合理观察。
- 是否避免臆造画中人物故事。

### 10.4 修复建议

自动修复优先级：

1. 补学习目标。
2. 降低语言难度。
3. 拆分过长知识段。
4. 补互动题。
5. 补练习答案。
6. 补板书总结。
7. 标注文化事实边界。

## 十一、GEARS 与课件交付

教育微课的 GEARS 分段不应只写镜头，还要写教学功能。

每段建议包含：

- `teaching_goal`: 本段教学目标。
- `script_text`: 主讲词。
- `visual_prompt`: 课件画面。
- `board_text`: 屏幕/板书文字。
- `interaction`: 提问、暂停、答案、反馈。
- `student_takeaway`: 学生应掌握的结论。
- `risk_note`: 版权、史实或年龄适配风险。

课件视觉资产建议：

- 课题卡。
- 生字词卡。
- 句子高亮条。
- 朗读停顿线。
- 结构图。
- 画作局部放大框。
- 互动题卡。
- 复盘板书。

## 十二、前端产品更新

如果把该能力产品化，前端应增加：

- 年级选择：一年级到六年级。
- 教材版本：统编版等，默认“待核实/用户提供”。
- 课文名称。
- 课型：文言文、古诗、现代文、说明文、习作、口语交际。
- 视频目标：预习、精讲、复习、课后练习、文化拓展。
- 时长：3 分钟、5 分钟、8 分钟、10 分钟。
- 输出：讲稿、教案、分镜、课件提示、练习题、板书。

生成前预览应显示：

- 学习目标。
- 教学重难点。
- 字词句段安排。
- 互动题列表。
- 文化边界。

质量面板应显示：

- 年级适配度。
- 目标覆盖度。
- 字词句段覆盖度。
- 互动闭环。
- 练习闭环。
- 版权/事实边界风险。

## 十三、与修仙西幻开发文档的关系

`docs/xianxia-western-fantasy-ai-comic-development-plan.md` 中提出的能力仍然保留，但不要和本文档混成一个通用大类型。

建议拆成两条路线：

### 路线 A：AI 漫剧/网文爽剧

- 主类型：`ai_comic_drama`
- 重点：修仙系统、东西魔法碰撞、异兽吞噬、隐藏女帝、连续剧情账本。
- 质量：爽点、升级代价、集末钩子、身份秘密。

### 路线 B：小学语文文化微课

- 主类型：`education_training` / `explainer_video`
- 重点：课文、年级、教学目标、字词句段、朗读、练习、板书。
- 质量：年级适配、知识准确、教学闭环、版权边界。

共用能力：

- 样片参考库可追溯。
- Domain Pack 注入。
- StoryBlueprint。
- GEARS 分段。
- 质量报告。
- 生成后修复。

不能共用的能力：

- 漫剧的剧情连续性账本不适合直接用于课文微课。
- 微课的教学目标和练习闭环不适合硬塞进 AI 漫剧。

## 十四、分阶段开发计划

### Phase 1：样片与文档层

目标：先让系统知道“小学语文微课”是什么。

任务：

- 更新 `docs/video-type-sample-reference-matrix.md`，新增教材型语文微课样片观察。
- 在样片来源中记录两个视频的标题、链接、UP 主、发布时间和结构标签。
- 更新或补充 `docs/knowledge-base-authoring-standards.md`，增加教育类知识字段。

验收：

- 新对话能根据文档判断这类视频不是 AI 漫剧，而是教育微课。

### Phase 2：教育 Domain Pack

目标：建立教育知识库入口。

任务：

- 新增 `data/domain-packs/primary-chinese-education.json`。
- 增加学段表达规则、课文条目模板、文言文讲解规则、画作课文讲解规则。
- 先录入两个样例条目：《囊萤夜读》《一幅名扬中外的画》。

验收：

- Story Agent 可以检索到课文类型、目标年级、讲解重点和文化边界。

### Phase 3：叙事流派库

目标：让教育类视频能选择课文微课流派。

任务：

- 在 `narrative-pattern-library.ts` 新增：
  - `primary_chinese_lesson_flow`
  - `classical_chinese_sentence_breakdown`
  - `artwork_text_visual_walkthrough`
  - `lesson_interaction_loop`
  - `blackboard_summary_pack`
- 挂到 `education_training` 和 `explainer_video`。

验收：

- Prompt package 能注入这些流派规则。

### Phase 4：Blueprint 与 Prompt

目标：让生成前就形成教学结构。

任务：

- 扩展教育类 StoryBlueprint 字段。
- Prompt 注入年级、目标、重难点、互动题、练习题、板书。
- 本地 fallback 同步处理。

验收：

- 生成《囊萤夜读》时能输出朗读、字词、句意、复述、主题和练习。
- 生成《一幅名扬中外的画》时能输出观察路线、说明顺序、图文对应和文化价值。

### Phase 5：质量评分

目标：判断微课是不是能教。

任务：

- 新增教育微课质量检查器。
- 新增文言文专项检查。
- 新增画作课文专项检查。
- 质量报告显示目标覆盖、年级适配、互动闭环、练习闭环和边界风险。

验收：

- 缺学习目标、缺练习、语言太成人化、文化边界不清时能被报告指出。

### Phase 6：GEARS 与课件包

目标：从讲稿走向可制作微课。

任务：

- GEARS 分段加入教学目标、板书、互动、练习、视觉提示。
- 支持导出课件提示包。
- 可选支持 Seedance/视频模型镜头提示。

验收：

- 每段都有主讲词、画面、屏幕文字、互动问题和学生 takeaway。

### Phase 7：前端产品化

目标：让用户可稳定生成这类片子。

任务：

- 增加“语文微课”生成入口或在教育/培训片下增加课文微课模式。
- 增加年级、课型、课文名、视频目标、输出类型选择。
- 增加教育质量面板。

验收：

- 用户输入课文名后，可以选择年级和目标，生成完整微课包。

## 十五、测试计划

### 15.1 固定评测样本

第一批固定样本：

- 四年级下《囊萤夜读》文言文微课。
- 三年级下《一幅名扬中外的画》说明性课文微课。

第二批建议扩展：

- 古诗讲解。
- 现代记叙文讲解。
- 说明文讲解。
- 习作指导。
- 口语交际。

### 15.2 验收检查表

每个样本检查：

- 是否标明年级。
- 是否有学习目标。
- 是否有教学重难点。
- 是否有字词/句段/主题。
- 是否有互动问题。
- 是否有练习和答案。
- 是否有板书。
- 是否有文化边界。
- 是否适合目标年级语言。
- 是否能转成 GEARS 分段。

## 十六、新对话任务提示词

可在新对话中直接使用：

```text
请阅读 docs/primary-chinese-culture-lesson-agent-development-plan.md，并结合 docs/xianxia-western-fantasy-ai-comic-development-plan.md 的架构原则，从 Phase 1 和 Phase 2 开始实施小学语文文化微课能力。先补样片参考矩阵、教育类知识库字段和 data/domain-packs/primary-chinese-education.json，并录入《囊萤夜读》《一幅名扬中外的画》的 Agent 可读样例条目。注意不要保存大段教材原文，只保存教学结构、知识边界和生成规则。
```

如果想先做生成能力：

```text
请阅读 docs/primary-chinese-culture-lesson-agent-development-plan.md，从 Phase 3 和 Phase 4 开始实施。为 education_training/explainer_video 新增小学语文课文微课流派，包括 primary_chinese_lesson_flow、classical_chinese_sentence_breakdown、artwork_text_visual_walkthrough、lesson_interaction_loop、blackboard_summary_pack，并让 StoryBlueprint 和 prompt package 能注入年级、学习目标、字词句段、朗读、互动题、练习和板书。
```

如果想先做质量评分：

```text
请阅读 docs/primary-chinese-culture-lesson-agent-development-plan.md，从 Phase 5 开始实施教育微课质量评分。新增通用小学语文微课检查、文言文专项检查、画作课文专项检查，质量报告要显示学习目标、年级适配、字词句段覆盖、互动闭环、练习闭环、板书复盘和文化/版权边界风险。
```

## 十七、第一轮完成标准

第一轮开发完成后，应达到：

- Agent 能识别这两个视频属于“小学语文课文微课”，而不是 AI 漫剧或普通文化宣传片。
- 知识库能表达课文、年级、课型、学习目标、重难点、字词句段、文化边界。
- 生成链路能输出讲稿、教学分段、互动题、练习题、板书和 GEARS 分段。
- 质量报告能检查年级适配、教学闭环和事实/版权边界。
- 后续新对话可以按 Phase 1-7 分步实施，不需要重新分析方向。
