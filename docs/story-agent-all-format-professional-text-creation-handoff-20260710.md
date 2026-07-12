# Story Agent 全片型专业影视文本创作开发交接总纲

更新时间：2026-07-10

状态：ready_for_new_conversation_execution

适用范围：`china-culture-kb` Story Agent 的影视成片文本层创作能力，不包含真实图片生成、视频渲染、配音、混音和最终剪辑执行。

## 1. 总目标

把现有 Story Agent 从“能覆盖多种片型并生成结构化故事”升级为“能够稳定交付专业创作公司级影视文本包”的创作系统。

最终必须同时满足：

1. 覆盖项目现有 15 个 `VideoType`，不能只在 AI 漫剧、非遗宣传和微纪录上表现稳定。
2. 每种片型都有独立创作合同、结构方法、文本形态、质量规则、修复策略和评测样本。
3. 输出不是资料摘要或一次性提示词，而是从创作简报到剧本、分场、导演文本、连续性和交付文本的完整包。
4. 作品质量必须通过固定基准集、多人盲评、真实模型生成、失败样本和多轮修订证明。
5. 不以“功能数量很多”代替作品质量，不以本地 fallback 或 simulation fixture 代替专业成稿验收。

## 2. 对“专业创作公司级”的定义

本路线不承诺任何一次模型输出天然胜过专业编剧。系统目标是让 Agent 具备专业公司的工作流程、分工视角、修改能力和质量证据，并使最终成稿在盲评中达到非劣标准。

专业级文本至少具备：

- 明确的受众、平台、时长、商业或传播目标。
- 可复述的一句话创意和观众承诺。
- 主题、人物目标、阻力、选择、代价和因果链。
- 每场都有可见行动、场景功能、情绪变化和推进结果。
- 对白有角色差异、潜台词、冲突和节奏，不是信息说明。
- 旁白、字幕和画面各司其职，不重复堆叠信息。
- 开场、转折、高潮、结尾与片型节奏匹配。
- 文化事实、戏剧化和虚构添加边界清楚。
- 文本可直接进入分镜、资产、Seedance 和 GEARS 交付。
- 能经过覆盖报告、桌读意见、导演意见和版本修订继续提高。

## 3. 当前可复用基础

项目已有重要基础，后续开发应扩展而不是重做：

- 15 个 `VideoType` 和对应 `GenreStoryProfile`。
- `StoryBlueprint -> full_text -> scene_breakdown -> gears_segments` 主链路。
- 类型画像、叙事模式、文化边界、质量报告和自动修复。
- 项目版本、场景级再生成、Production Board 和连续性账本。
- AI 漫剧系列规划、分集生成、系列记忆和质量审计。
- GEARS / Seedance 文本交付和外部执行边界。
- 30 张黄金生产素材卡和 9 个本地回归样本。
- 服务端、MCP、知识库 lint 和生产构建验证体系。

当前核心差距：

- 15 个片型只有 8 个高频素材补充模板，只有 3 个片型有黄金卡。
- 现有质量规则偏结构正确，尚未充分衡量原创性、人物复杂度、潜台词、场景调度和整体余味。
- 30 张黄金卡全部待人工审稿，9 个候选 Domain Pack 尚未正式晋升。
- 真实模型、真人编剧、导演或制片盲评样本不足。
- 核心服务和页面文件过大，继续叠加规则会提高回归风险。

## 4. 15 类影视文本交付矩阵

### 4.1 剧情故事线

| VideoType | 必须交付的核心文本 | 专属质量门槛 |
|---|---|---|
| `character_story` | 人物命题、关键选择、关系网、人物弧、分场剧本 | 不能写成年表；选择必须造成代价和变化 |
| `historical_drama` | 史实压力、事件因果、角色立场、戏剧化边界、分场剧本 | 事实和虚构分层；冲突必须来自时代处境 |
| `legend_story` | 版本说明、象征意象、凡人选择、口述节奏、完整剧本 | 不把传说写成史实；象征必须服务人物选择 |
| `ai_comic_drama` | 集钩子、关系碰撞、可分格动作、对白气泡、表情节拍、结尾钩子 | 每格可画；角色和资产连续；对白不能承担全部叙事 |
| `children_story` | 年龄段、温和冲突、重复母题、情绪学习、亲师提示 | 儿童可理解；不残酷、不恐吓、不把说教当情节 |

### 4.2 宣传传播线

| VideoType | 必须交付的核心文本 | 专属质量门槛 |
|---|---|---|
| `culture_promo` | 传播命题、视觉符号、信息曲线、旁白、行动召唤 | 不能只有赞美；文化细节必须承担叙事功能 |
| `heritage_promo` | 材料、工具、工序、手部动作、传承压力、当代连接 | 工序可拍；授权和危险操作边界清楚 |
| `city_brand_promo` | 城市主张、人物视角、空间路线、城市证据、品牌落点 | 避免城市宣传套话；地理、生活和人物必须真实关联 |
| `social_short` | 三秒钩子、节拍表、反差、字幕、竖屏画面、互动问题 | 60 至 90 秒内持续有新信息；事实边界不能被钩子牺牲 |

### 4.3 非虚构与知识线

| VideoType | 必须交付的核心文本 | 专属质量门槛 |
|---|---|---|
| `documentary_short` | 核心问题、现实现场、采访角色、史料线索、B-roll、再现边界 | 不虚构采访或现场；旁白克制；证据推动发现 |
| `explainer_video` | 问题、概念、例子、视觉比喻、误区、总结 | 一段只讲一个核心概念；画面能解释而非装饰 |
| `lecture_video` | 立论、论证、案例、反方、修辞转场、行动结论 | 论点可验证；不是资料罗列或口号堆叠 |
| `education_training` | 学习目标、知识步骤、案例、练习、评估、复盘 | 能教会和检验；练习与目标对应 |

### 4.4 空间与意境线

| VideoType | 必须交付的核心文本 | 专属质量门槛 |
|---|---|---|
| `scene_short` | 空间路线、人物或事件触发、镜头行动、声音、转场 | 空间必须发生变化或发现，不能只是景点介绍 |
| `landscape_mood` | 情绪命题、时间变化、构图节奏、自然声音、极简文案 | 情绪由视听建立；文案不能压过画面 |

## 5. 统一专业文本包

新增统一 `ProfessionalTextPackage`，按片型裁剪必填字段，但不能跳过创作过程。

建议结构：

```text
ProfessionalCreativeBrief
  -> ResearchAndEvidenceDossier
  -> PremiseAndAudiencePromise
  -> CharacterRelationshipOrInformationArchitecture
  -> StoryBlueprint
  -> SequenceOutline / BeatSheet
  -> SceneBreakdown
  -> ScreenplayOrFinalNarrationDraft
  -> DialogueAndVoicePolish
  -> DirectorTextPlan
  -> ProductionBoard
  -> ContinuityAndEvidenceLedger
  -> CreativeCoverageReport
  -> RevisionTrace
  -> DeliveryTextPackage
```

统一字段至少包括：

- `creative_brief`
- `audience_promise`
- `premise_or_core_question`
- `theme_statement`
- `truth_and_adaptation_contract`
- `structure_outline`
- `sequence_beats`
- `scene_breakdown`
- `full_text`
- `dialogue_or_narration_pass`
- `director_text_plan`
- `continuity_ledger`
- `quality_report`
- `coverage_report`
- `revision_trace`
- `delivery_text_package`

## 6. 专业创作流水线

每次生成按角色视角分阶段完成，不能把所有职责塞进一次大提示词：

1. 制片策划视角：解析目标受众、平台、时长、预算假设和交付目标。
2. 研究编辑视角：整理事实、来源、未知点、授权和虚构边界。
3. 主创编剧视角：提出多个创意方向，选择命题、人物和结构。
4. 类型编剧视角：按 `GenreStoryProfile` 完成片型专属结构。
5. 场景编剧视角：把大纲转为有行动、冲突和变化的场景。
6. 对白编辑视角：处理角色声线、潜台词、节奏和信息重复。
7. 导演文本视角：检查画面动作、空间调度、转场和可执行性。
8. 文化与事实审稿视角：检查事实、传说、再现和虚构分层。
9. 剧本编辑视角：生成 coverage，识别结构、人物、节奏和市场问题。
10. 修订视角：按问题定点修改，并重建受影响的场景、分段和交付文本。

这些是确定性的流程阶段和审查合同，不要求每一步都调用独立模型。实现时可按成本选择同一模型多轮调用、不同模型路由或本地规则检查。

## 7. 质量评分与硬门槛

### 7.1 通用百分制

| 维度 | 基础权重 |
|---|---:|
| 创作简报与受众承诺 | 8 |
| 创意命题与主题统一 | 10 |
| 结构、因果与节奏 | 15 |
| 人物能动性与关系变化 | 12 |
| 场景功能、可见行动与调度 | 12 |
| 对白、旁白与潜台词 | 10 |
| 情绪曲线与结尾余味 | 10 |
| 文化事实和改编边界 | 10 |
| 影视生产可执行性 | 8 |
| 原创性与整体辨识度 | 5 |

非剧情片型由 `GenreStoryProfile` 调整权重，例如教育培训提高教学有效性，纪录片提高证据和现场，意境片提高视听节奏。

### 7.2 硬门槛

出现以下任一问题，不允许进入专业成稿：

- 把未知、传说或虚构内容写成确证事实。
- 没有明确受众、时长或片型承诺。
- `full_text` 只是大纲、资料摘要或内部分析。
- 场景没有行动、变化或推进功能。
- 分场、正文、GEARS 分段和交付文本互相矛盾。
- 视觉提示词混入来源说明、质量标签、TODO 或内部字段。
- 对白角色不可区分，或大量重复旁白信息。
- 使用未授权原文、角色、样片剧情或具体作者风格仿写。
- 缺少片型专属必填项。

### 7.3 等级

- `< 70`：不合格，必须重构。
- `70-79`：结构可用，但不能作为专业成稿。
- `80-84`：生产候选，可进入人工编辑。
- `85-89`：专业候选，可进入盲评和导演复核。
- `>= 90`：高质量候选，仍需事实、版权和真人签署。

任何总分都不能覆盖硬门槛失败。

## 8. “不输传统公司”的验证方法

只有同时满足下列证据，才可以声明专业非劣：

1. 使用用户自有、公共领域或已授权的专业文本作为结构基准，不复制原文。
2. 每个片型至少 5 个固定项目，完整保存输入、初稿、修订稿和最终稿。
3. 每个项目至少由编剧或剧本编辑、类型或导演审稿、事实或文化审稿三类角色盲评。
4. 评审者不知道文本来自 Agent 还是人工基准。
5. 最终稿平均分不低于 85，任一核心维度不低于 75，无硬门槛失败。
6. 与专业基准平均分差不超过 3 分，且至少 2/3 评审者认为可进入下一轮制作。
7. 同一项目至少验证初稿到终稿的质量提升，不能只挑最好的一次输出。
8. 记录模型、提示包版本、素材版本、生成成本和修订次数，保证结果可复现。

## 9. 素材和评测规模

### 第一层：全片型覆盖基线

- 15 个片型全部有 `GenreStoryProfile` 专属合同。
- 每个片型 5 个固定回归项目，共 75 个。
- 每个片型至少 3 个失败样本，共 45 个。
- 每个片型至少 5 张经人工审稿的黄金素材卡，共 75 张。

### 第二层：稳定生产基线

- 每个片型至少 10 个高质量项目，共 150 个。
- 每个片型至少 20 张生产素材卡，共 300 张。
- 34 个省级文件各至少 5 条可生产素材。
- 高风险历史、民族文化、医疗隐私、戏曲版权分别有独立评测集。

### 第三层：专业非劣基线

- 15 个片型均完成真人盲评。
- 每个片型至少 3 个项目达到专业非劣标准。
- 至少完成 10 个真实客户式创作简报，不使用为测试量身定制的简单题目。
- 至少完成 3 个多轮项目，验证需求变更、局部修改、版本比较和最终定稿。

## 10. 代码架构原则

### 保持单一事实源

- 片型规则继续集中在 `GenreStoryProfile`。
- `StoryBlueprint` 继续作为素材到成稿的桥梁。
- 片型权重、硬门槛和 repair guidance 不散落到 UI、prompt、fallback 和测试。
- `scene_breakdown`、`gears_segments` 和 Production Board 必须从当前版本正文重建，不能保留陈旧派生数据。

### 建议新增模块

- `professional-creative-brief-service.ts`
- `research-evidence-dossier-service.ts`
- `professional-text-pipeline-service.ts`
- `screenplay-scene-service.ts`
- `dialogue-voice-polish-service.ts`
- `creative-coverage-service.ts`
- `professional-text-quality-service.ts`
- `professional-text-revision-service.ts`
- `professional-benchmark-service.ts`

`professional-text-pipeline-service.ts` 只负责编排，不得重新长成新的巨型业务文件。

### 必须同步治理的技术债

- 拆分超过 1.1 万行的 `project-service.ts`。
- 拆分 `ai-comic-series-service.ts`、`gears-execution-service.ts` 和共享类型大文件。
- 将 `ProjectDetail.vue`、`AiComicSeriesStudio.vue` 拆成领域组件和 composable。
- 为前端关键创作流程增加组件或 Playwright 测试。
- 建立 CI，统一运行 server tests、MCP tests、Web check、build 和知识库 lint。

技术债重构必须先有契约测试，不得与创作行为升级混在同一大改动中。

## 11. 分阶段开发路线

本路线使用独立的 `professional_text_creation_progress`，不得与素材库 99%、Story Agent 产品进度或 GEARS 外部执行进度混用。

### Stage 0：基线与版本检查点

目标：建立可信起点。

交付：

- 整理当前未跟踪成果并形成版本检查点。
- 修正蓝图 98% / 状态 99% 的口径冲突。
- 新增专业文本路线机器状态文件。
- 审计 15 个片型当前输出、质量规则、素材和测试覆盖。
- 固化现有测试与构建结果。

退出门槛：能明确回答每个片型“缺什么文本、缺什么规则、缺什么样本”。

### Stage 1：专业创作合同和统一数据结构

目标：建立统一 `ProfessionalTextPackage`。

交付：

- 新增 CreativeBrief、EvidenceDossier、BeatSheet、CoverageReport 等类型和 schema。
- 扩展 15 个 `GenreStoryProfile` 的文本合同、权重和硬门槛。
- 建立片型合同完整性测试。
- 保持旧故事和旧项目兼容。

退出门槛：15 个片型均能生成合法的专业文本包骨架。

### Stage 2：剧情故事线升级

顺序：`character_story -> historical_drama -> legend_story -> children_story -> ai_comic_drama`。

重点：人物目标、关系冲突、场景因果、对白潜台词、结尾余味、历史与传说边界。

退出门槛：每类 5 个回归项目，无摘要式成稿，无硬门槛失败。

### Stage 3：宣传传播线升级

顺序：`heritage_promo -> culture_promo -> city_brand_promo -> social_short`。

重点：传播命题、真实对象、视觉动作、品牌证据、平台节奏和授权边界。

退出门槛：每类 5 个回归项目，旁白、字幕和画面不重复，能够直接进入导演文本。

### Stage 4：非虚构与知识线升级

顺序：`documentary_short -> explainer_video -> lecture_video -> education_training`。

重点：研究问题、证据链、采访边界、知识结构、论证和学习评估。

退出门槛：每类 5 个回归项目，不虚构证据，信息结构可被观众理解和验证。

### Stage 5：空间意境线升级

顺序：`scene_short -> landscape_mood`。

重点：空间路线、时间变化、视觉节奏、自然声音、最少必要文案。

退出门槛：每类 5 个回归项目，去掉旁白后仍能理解视听结构。

### Stage 6：Coverage、桌读和多轮修订

目标：从“生成一次”升级为“专业修改”。

交付：

- 自动 coverage 报告。
- 结构、人物、场景、对白、节奏和事实六类修订动作。
- 修订前后差异和质量增量。
- 局部修改后的派生结构重建。
- 人工意见导入和逐条关闭。

退出门槛：至少 15 个项目完成两轮以上修订，质量提升可追踪。

### Stage 7：黄金素材卡和 Domain Pack 扩充

目标：让专业写作能力有足够素材支撑。

交付：

- 先完成每片型 5 张人工通过黄金卡。
- 再扩充到每片型 20 张。
- 完成 9 个候选 Domain Pack 的真实审稿和晋升。
- 补充时代、社会生活、空间、称谓对白、职业、器物、声音和区域差异包。

退出门槛：至少 75 张黄金卡通过人工审稿，所有片型都有可调用素材。

### Stage 8：专业盲评与发布门槛

目标：用证据证明专业非劣。

交付：

- 75 个固定项目基准集。
- 盲评工具和评审记录。
- 片型分数、失败类型、成本和修订次数报告。
- 不合格片型回到 Stage 2 至 Stage 6 修复。

退出门槛：15 个片型全部达到第 8 节专业非劣标准。

### Stage 9：产品化与运营

目标：让用户在工作台内完成专业创作流程。

交付：

- 创作简报页、BeatSheet、分场编辑、Coverage、版本比较和定稿状态。
- 评审角色、意见、签署和导出。
- 模型、成本、质量和素材使用追踪。
- 真实 GEARS / Seedance 只负责媒体执行，文本层保持可独立验收。

退出门槛：至少 3 个真实项目从简报走到定稿和交付文本包。

## 12. 进度计算

新路线按验收证据计算，不按代码量或迭代次数计算：

| 维度 | 权重 |
|---|---:|
| 15 类创作合同与 schema | 15% |
| 15 类完整文本生成 | 20% |
| 类型专属质量和修复 | 20% |
| 黄金素材与 Domain Pack | 15% |
| 固定评测集和真人盲评 | 20% |
| 产品化、CI 和真实项目验收 | 10% |

Stage 0 必须先根据当前代码生成机器基线，之后每次推进报告：

```text
当前 Stage：
覆盖片型：X / 15
专业文本包通过：X / 15
固定回归项目：X / 75
真人盲评通过项目：X / 45
黄金素材卡人工通过：X / 75
硬门槛失败数：
professional_text_creation_progress：A% -> B%
本轮验证：
下一步：
外部阻塞：
```

## 13. 新对话前三轮开发任务

### Iteration 1：全片型能力审计与机器基线

必须完成：

- 读取 15 个 `GenreStoryProfile`、StoryBlueprint、质量和修复实现。
- 为 15 个片型生成能力矩阵 JSON 和 Markdown。
- 逐项记录文本合同、质量、素材卡、回归样本和 UI 支持状态。
- 建立 `professional_text_creation_progress` 状态文件。
- 不改变现有生成行为。

### Iteration 2：ProfessionalTextPackage 合同

必须完成：

- 新增共享类型和 Zod schema。
- 建立通用创作简报、证据包、节拍表、coverage 和修订记录结构。
- 为 15 个片型定义必填字段映射。
- 增加 schema、兼容和片型完整性测试。

### Iteration 3：首个纵向片型升级

建议先做 `character_story`，因为它最能检验人物、结构、场景和对白等通用能力。

必须完成：

- 创作简报到专业成稿的完整链路。
- 人物目标、阻力、选择、代价和弧线检查。
- Scene purpose、visible action、emotional turn 检查。
- 对白差异和潜台词检查。
- 5 个固定项目、至少 3 个失败样本和自动修复。

`character_story` 通过后，再按 Stage 2 顺序复制能力，不复制散落规则。

## 14. 开发纪律

- 不把生成故事写入 `data/provinces/*.md`。
- 不把未审稿候选直接写入正式 Domain Pack。
- 不复制专业影视作品的原文、具体剧情或作者标志性表达。
- 不以正则数量、测试数量或 schema 字段数量代替作品盲评。
- 不为了覆盖 15 类而共用一套泛化成稿模板。
- 不让 local fallback 与真实模型路径继续漂移。
- 不在巨型文件中继续堆叠所有新能力。
- 每个片型升级必须同时包含合同、生成、质量、修复、样本和文档。
- 任何“专业级”声明必须附带评测版本和真人签署记录。

## 15. 新对话启动指令

在新对话中使用以下指令：

```text
请读取 docs/story-agent-all-format-professional-text-creation-handoff-20260710.md，按照其中路线开始开发。

先执行 Stage 0 / Iteration 1：完成现有 15 个 VideoType 的全片型能力审计，生成机器可读能力矩阵、专业文本创作进度基线和缺口报告。不要预设百分比，不要直接修改现有生成行为，不要把 simulation 或 fixture 视为专业质量通过。

每轮必须汇报：当前 Stage、覆盖片型数、专业文本包通过数、固定回归项目数、真人盲评通过数、黄金素材卡人工通过数、硬门槛失败数、专业文本创作进度变化、验证结果、下一步和外部阻塞。

保持 GenreStoryProfile 为片型规则单一事实源，保持 StoryBlueprint 为素材到成稿的桥梁，保持生成内容不写回 data/provinces/*.md。
```

## 16. 方法来源说明

专业编剧分层流程参考项目既有 `china-culture-screenwriting` 工作流，并借鉴 `Shanyin-ai/shanyin-screenwriting-master` 的公开编剧流程，由 `@山音` 设计、MIT 许可；本项目只吸收通用创作方法，不复制或转售该 skill。
