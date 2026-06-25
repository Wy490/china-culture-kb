# Story Agent 创作平台重定位与开发计划

> 日期：2026-06-23
> 范围：仅限 `china-culture-kb` / Story Agent 本项目。
> 不包含：GEARS 图片、视频、字幕、混音、片头片尾、最终装配等实产执行。
> 新定位：从“知识库驱动的故事生成器”调整为“AI 影视前期创作、剧本生产与项目素材指挥系统”。

## 1. 产品重定位

本项目的核心用户不再只是假设为文化知识库使用者，而是三类 AI 影视生产方：

1. AI 漫剧公司：需要原创故事、系列设定、分集剧本、角色/场景资产说明、故事版交付。
2. 改编团队：需要把小说、资料、历史人物、地方故事改编成适合 AI 漫剧、短片或宣传片的剧本。
3. 企业、政府、协会和机构：需要宣传片、纪录短片、解说片、培训片、公益片、品牌片等类型片生成。

因此，本项目的主线应从：

```text
知识库条目 -> 故事生成 -> GEARS 段落
```

调整为：

```text
项目素材 / 用户意图
  -> 创作合同
  -> 类型片蓝图
  -> 故事 / 剧本 / 场景
  -> 分镜与资产说明
  -> 质量、真实度、交付 readiness
  -> 项目版本与生产指挥
```

其中 `GEARS` 仍是下游执行层，本项目只负责把故事、剧本、场景、资产说明和交付包准备好。

## 2. 命名调整

不要再把产品主概念叫“知识库”。建议按层级更名：

| 当前名称 | 建议名称 | 用途 |
|---|---|---|
| 知识库 | 项目素材库 / 创作素材库 | 面向用户的资料存放概念 |
| KnowledgePack | MaterialPack / ProjectMaterialPack | 生成时使用的结构化素材包 |
| 知识补录 | 素材补充 / 资料补充任务 | 分阶段补齐缺口 |
| 知识条目 | 素材条目 / 资料条目 / 来源条目 | 保留来源感，不再强调知识库 |
| Story Agent | Story Studio / AI影视工作台 | 产品级名称 |

推荐产品中文名：`AI影视工作台`。

推荐内部模块名：`Story Studio`。

兼容原则：

- 短期保留 `knowledge_pack`、`kb_*` MCP 工具和旧 JSON 字段，避免破坏已有生成物。
- 新增字段使用 `material_pack`、`material_sufficiency`、`creation_contract`。
- 前端文案优先替换“知识库”为“素材库 / 创作素材 / 项目素材包”。
- 后端可先做别名和兼容映射，不急于大规模重命名文件。

## 3. 新核心模型

### 3.1 创作场景 use_case

新增项目级 `creation_use_case`，用于决定默认流程和 UI。

建议枚举：

```text
original_ai_comic
adapted_ai_comic
institutional_promo
documentary_short
brand_commercial
education_training
public_service
```

含义：

- `original_ai_comic`：原创 AI 漫剧，允许高虚构、高戏剧冲突。
- `adapted_ai_comic`：原作/资料改编，强调主线、人物关系和情节保真。
- `institutional_promo`：政府、协会、企业机构宣传，强调真实、稳妥、目标表达。
- `documentary_short`：纪实短片，强调来源、事实边界、采访/档案口吻。
- `brand_commercial`：品牌商业片，强调卖点、情绪、视觉记忆点。
- `education_training`：课程/培训片，强调知识结构、清晰解释和安全表达。
- `public_service`：公益宣传片，强调问题、行动、社会价值和合规。

### 3.2 真实度 truth_mode

新增 `truth_mode`，作为所有生成和质检的第一层约束。

建议枚举：

| truth_mode | 允许内容 | 禁止内容 | 典型用户 |
|---|---|---|---|
| `fictional_original` | 原创人物、原创事件、虚构世界观 | 冒充真实历史/机构事实 | AI 漫剧公司 |
| `inspired_by_material` | 基于素材做戏剧化创作 | 把创作补足写成事实 | 文旅、品牌、短片 |
| `source_adaptation` | 改编已有小说/故事/资料 | 偏离原作主线、人物关系、授权边界 | 改编团队 |
| `factual_reconstruction` | 基于事实重构场景、可标注影视化补足 | 虚构关键事实、虚构结论 | 纪录短片 |
| `institutional_verified` | 只写已确认材料和审定口径 | 未核实数据、虚构人物发言、过度戏剧化 | 政府、协会、企业 |

`truth_mode` 应进入：

- `StoryGenerateRequest`
- `StoryBlueprint`
- `StoryGenerationPromptPackage`
- `StoryQualityReport`
- project meta / version snapshot
- 前端生成表单和项目详情

### 3.3 创作合同 creation_contract

在 `StoryBlueprint` 之上新增或扩展 `creation_contract`。

建议字段：

```text
schema_version
creation_use_case
truth_mode
client_type
target_audience
communication_goal
video_type
presentation_style
story_structure
narrative_pattern_ids
allowed_fiction
must_verify
forbidden_moves
required_disclaimers
material_sufficiency
delivery_expectation
```

作用：

- 让系统先知道“这是什么业务任务”，再决定怎么写。
- 把真实度、允许虚构、需要核实、禁止表达写成结构化规则。
- 给质量检查和修复服务同一份合同，不再只靠 prompt 文本。

### 3.4 素材包 MaterialPack

把 `KnowledgePack` 升级为 `MaterialPack`，但保留旧字段兼容。

建议结构：

```text
primary_materials
supporting_materials
reference_materials
brand_or_institution_profile
source_work_profile
visual_assets
verified_facts
uncertain_claims
creative_space
missing_needs
overall_confidence
token_budget_summary
```

关键变化：

- 不要求一次补全。
- 每个素材必须带“用途”：事实依据、角色来源、视觉资产、时代背景、品牌信息、机构口径、改编原作、参考风格。
- 支撑素材不能自动变成剧情事实。
- 生成时优先使用摘要和结构字段，避免每次把大量原文塞进 prompt。

## 4. 类型片与叙事流派矩阵

当前 `video_type` 已经扩展，但叙事流派没有完整映射到每类片子。下一步需要把映射集中到类型画像里。

在 `genre-story-profiles.ts` 中扩展每个 `GenreStoryProfile`：

```text
compatible_use_cases
compatible_truth_modes
default_truth_mode
recommended_narrative_patterns
allowed_narrative_patterns
forbidden_narrative_patterns
material_requirements
truth_rules
institutional_rules
adaptation_rules
```

示例：

| video_type | 默认 truth_mode | 推荐叙事流派 | 重点质检 |
|---|---|---|---|
| `ai_comic_drama` | `fictional_original` / `source_adaptation` | 强钩子、反转、连载悬念、人物弧光 | 对白、表情、场景冲突、结尾钩子 |
| `documentary_short` | `factual_reconstruction` | 见证人口述、档案重建、现场走访 | 来源边界、事实/推测分离 |
| `culture_promo` | `inspired_by_material` | 物件线索、今昔对照、文化符号 | 不把象征写成事实，画面资产完整 |
| `heritage_promo` | `inspired_by_material` | 工艺流程、传承人、当代转化 | 流程准确、非遗边界、传承价值 |
| `institutional_promo` | `institutional_verified` | 问题-行动-成果-价值 | 口径稳妥、数据核实、避免虚构发言 |
| `education_training` | `institutional_verified` | 知识模块、案例拆解、步骤演示 | 结构清晰、术语准确、安全边界 |

说明：如果当前没有 `institutional_promo` 这个 `video_type`，可以先新增或用 `culture_promo / explainer_video / education_training` 承接，再逐步拆分。

## 5. 素材补充从“一次补全”改为“三阶段”

当前问题是资料补充耗时、耗 token，而且无法一次补到位。应改成阶段制。

### 5.1 三阶段补充

| 阶段 | 目标 | 可以生成什么 | 必须补什么 |
|---|---|---|---|
| `minimum_viable_story` | 先启动创作 | 故事方向、logline、蓝图、粗场景 | 主题、主角/主体、基本目标 |
| `script_ready` | 进入正式剧本 | 完整剧本、对白、场景拆分 | 关键事实、人物关系、机构口径、原作主线 |
| `production_ready` | 进入分镜/资产交付 | 分镜、资产说明、GEARS/Seedance 交付包 | 视觉资产、地点、服饰、品牌规范、禁用项 |

### 5.2 素材充分度报告

新增 `MaterialSufficiencyReport`：

```text
stage
score
can_generate
can_generate_with_risks
blocked
missing_items
optional_items
token_risk
recommended_next_questions
```

生成策略：

- 素材不足但不影响方向时，允许先生成蓝图。
- 素材不足影响事实/合规时，生成结果必须降级为草案，并打上 `needs_verification`。
- 对 `institutional_verified`，关键事实缺失时不能生成确定口吻正文。
- 对 `fictional_original`，不要求事实素材，但要补设定、角色、世界观和风格锚点。

## 6. 开发阶段计划

### Phase 0：文档与命名口径

目标：统一下一阶段开发方向。

任务：

- 新增本计划文档并加入下一阶段计划入口。
- 在前端和文档中逐步减少“知识库”对用户可见的表达。
- 明确：本项目只做内容、剧本、素材包、蓝图、分镜与生产指挥，不做 GEARS 实产。

验收：

- 新对话 handoff 能直接指向本计划。
- 新开发任务不再以“补全知识库”为默认前置。

### Phase 1：共享类型与 schema 扩展

目标：让新的产品模型进入合同层。

任务：

- 在 `web/shared/types.ts` 增加：
  - `CreationUseCase`
  - `TruthMode`
  - `CreationContract`
  - `MaterialPack`
  - `MaterialSufficiencyReport`
- 在 `web/shared/schemas.ts` 增加对应 Zod schema。
- 扩展 `StoryGenerateRequest`：
  - `creation_use_case`
  - `truth_mode`
  - `client_type`
  - `target_audience`
  - `communication_goal`
  - `material_pack`
- 保留 `knowledge_pack`，并在服务层兼容映射到 `material_pack`。
- 扩展 `StoryGenerateResult` 和 `StoryBlueprint`，保存 `creation_contract` 与 `material_sufficiency`。

验收：

- 旧请求仍能生成。
- 新请求能把 `creation_use_case / truth_mode / material_pack` 保存进项目版本。
- schema 测试覆盖默认值、兼容映射和不兼容 truth/video_type 情况。

### Phase 2：类型片画像矩阵

目标：让每个片子类型有明确叙事流派和真实度边界。

任务：

- 扩展 `genre-story-profiles.ts`。
- 建立 `video_type -> truth_mode -> narrative_pattern` 推荐矩阵。
- 增加 resolver：
  - 输入 use_case、truth_mode、video_type、story_structure。
  - 输出默认叙事流派、禁止流派、素材要求、质检规则。
- 更新 `story-blueprint-service.ts`，把矩阵结果写入 `type_specific_requirements` 和 `creation_contract`。
- 更新 `story-generation-prompt.ts`，让 prompt 不再只按 video_type 要求写，而是按 `video_type + truth_mode + use_case` 写。

验收：

- `ai_comic_drama` 默认出现漫剧节奏、冲突、对白、结尾钩子要求。
- `documentary_short` 默认出现事实边界、见证/档案口吻要求。
- 机构类视频不会被强行套用漫剧反转和虚构对白。
- 类型画像测试覆盖每个主类型至少一个推荐流派。

2026-06-23 进展：

- Phase 2 首个工程切片已落地到 Web 后端。`GenreStoryProfile` 已扩展矩阵字段，`resolveGenreStoryMatrix()` 已能按 `video_type + creation_use_case + truth_mode + story_structure` 输出推荐/过滤后的叙事流派、素材要求、真实边界、机构规则、改编规则和警告。
- `story-service.ts` 已在生成入口调用矩阵 resolver，用矩阵结果补足/过滤 `narrative_pattern_ids`；`story-blueprint-service.ts` 会把矩阵规则写入 `type_specific_requirements`；`story-generation-prompt.ts` 会输出“类型片画像矩阵”章节并把矩阵规则加入 `output_contract.should_respect`。
- 当前切片仍只做前期创作和剧本生成指挥，不做 GEARS 图片、视频或后期实产。

2026-06-25 进展：

- 题材感知推荐层已接入 `planStory()`。规划结果新增 `recommended_narrative_patterns[]`，会按当前推荐成片类型、来源条目类型、题材关键词、正文信号和用户原始需求输出流派、理由、优先级、置信度和匹配信号。
- `ai_comic_drama` 已从固定静态池推进到题材族匹配：武侠优先 `wuxia_*`，改编优先原作保真/章节切片/人物弧光，历史人物优先成长和人物弧光，悬疑追查优先线索揭示，短剧连载优先强钩子和追更机制。用户需求中的显式题材信号会高于来源条目的泛化类型信号。
- `StoryStudio.vue` 已把“叙事流派强化”改为“推荐流派”：资料规划完成后自动勾选当前成片类型下的推荐流派，并展示推荐理由与匹配信号；用户仍可手动增删，兼容旧 `narrative_pattern_ids` 请求字段。
- 推荐规则已集中回 `genre-story-profiles.ts`，避免在 UI、单故事服务和系列服务之间复制题材族规则。`AiComicSeriesPlan` 同步新增 `recommended_narrative_patterns[]`，系列规划会按大纲、项目素材包、识别人物、知识焦点和节奏档位自动推荐并默认写入 `narrative_pattern_ids`；`AiComicSeriesStudio.vue` 已展示推荐理由和匹配信号，系列单集生成继续允许用户微调。

### Phase 3：素材充分度与分阶段补充

目标：解决补资料太重、每次补不完的问题。

任务：

- 新增 `material-pack-service.ts`：
  - 从旧 `KnowledgePack`、用户大纲、条目、原作文本构造 `MaterialPack`。
  - 为素材分配用途和可信度。
  - 生成 `MaterialSufficiencyReport`。
- 改造 `buildKnowledgeSupplementTasks` 为分阶段 `buildMaterialSupplementTasks`。
- 补充任务加入：
  - `stage`
  - `blocking_level`
  - `affects`
  - `recommended_question`
  - `token_cost_hint`
- 生成前不再强制补全，只根据阶段和 truth_mode 决定是否阻断。

验收：

- 原创漫剧没有知识条目也可以先生成蓝图和故事草案。
- 政府/机构严肃片缺关键事实时，能生成补充问题，但不能生成确定事实口吻的正文。
- 补充任务能区分“现在必须补”和“生产前再补”。

2026-06-23 进展：

- Phase 3 首个工程切片已落地到 Web 后端。现有 `creation-contract-service.ts` 继续承担 `MaterialPack` 兼容映射与充分度报告构造，未额外引入平行服务。
- `MaterialSufficiencyReport` 已在保持旧字段兼容的基础上新增 `active_stage`、`generation_posture`、`needs_verification`、`next_stage` 和 `stage_reports[]`。
- `stage_reports[]` 会分别评估 `minimum_viable_story`、`script_ready`、`production_ready`，每阶段输出 status、score、can_proceed、required_items、available_outputs、missing_items、optional_items 和 notes。
- `story-generation-prompt.ts` 已输出“三阶段素材 gate”，并把素材生成姿态写入 output contract；机构/事实类素材缺口会阻断或降级为待核验草案，生产资产缺口则不会阻断剧本生成。
- `supplement_tasks` 已开始阶段化：旧 `knowledge_pack.missing_needs` 任务会吸收 `MaterialSufficiencyReport` 的 stage/blocking/affects/recommended question，新出现的生产资产缺口会以 `material_sufficiency_missing_item` 来源生成“生产前补充”任务。
- `GET /api/projects/supplement-tasks` 和 `SupplementTasks.vue` 已支持按状态、阶段、阻断等级、来源筛选，任务列表会显示 Gate 来源、影响范围和 intake prompt。
- 素材补充任务完成后会写回 `material_pack.supporting_materials`，移除对应 missing need，并重算 `material_sufficiency` 与 `creation_contract`，同步项目 meta、版本 snapshot、源 story 文件和质量报告上下文。
- 当前切片仍不执行 GEARS 图片、视频或后期实产；下一步应继续做项目素材包编辑、新增素材表单和素材变更后的版本化审计。

### Phase 4：生成链路改造

目标：让现有生成流程接受新合同，不推翻现有 Story Agent。

任务：

- 在 `generateAndStoreStory` 前半段构造 `creation_contract`。
- 本地引擎 `generateDramaticContent` 接收 truth/use_case 约束。
- `memory_mosaic_biography` 和改编模式读取 `source_adaptation` 规则。
- 外部模型 prompt package 加入：
  - creation contract
  - material sufficiency
  - allowed fiction
  - must verify
  - forbidden moves
- 合并模型输出时继续保留本地结构兼容检查。
- `deriveTypeSpecificStoryFields` 按 use_case 补充机构/品牌/纪录片字段。

验收：

- 同一素材在 `fictional_original` 和 `institutional_verified` 下会生成明显不同口吻。
- 改编模式不会重写成新故事。
- 外部模型失败时，本地兜底仍能遵守 truth_mode 的基本限制。

### Phase 5：质量报告升级

目标：质量不只检查“好不好看”，还检查“真实吗、合规吗、适配类型吗”。

任务：

- 扩展 `StoryQualityReport`：
  - `truth_report`
  - `material_sufficiency_report`
  - `adaptation_fidelity_report`
  - `institutional_safety_report`
  - `genre_matrix_report`
- 在 `genre-quality-service.ts` 增加：
  - 真实度违规检查。
  - 机构/政府口径风险检查。
  - 改编保真检查。
  - 叙事流派与 video_type 适配检查。
- 修复建议按 report 分类输出。

验收：

- 纪录片/机构片出现虚构对白时给出问题。
- 改编故事遗漏核心人物/主线时给出问题。
- 漫剧缺钩子、缺对白、缺表情/动作时给出问题。
- repair prompt 能基于这些新 report 生成修复要求。

### Phase 6：前端工作流调整

目标：让用户先选“我要做什么”，再选片子类型。

任务：

- 生成页新增三条主入口：
  - 原创 AI 漫剧
  - 原作/资料改编
  - 机构/宣传/纪录/培训影像
- 表单顺序调整：
  - use_case
  - truth_mode
  - video_type
  - narrative pattern
  - material/source input
  - target duration/style
- 项目详情页增加：
  - 创作合同卡片
  - 素材充分度卡片
  - 分阶段补充任务
  - 真实度/合规质量报告
- 文案替换：
  - 知识库 -> 素材库 / 创作素材
  - 补录任务 -> 素材补充任务
  - 知识包 -> 项目素材包

验收：

- 用户不懂知识库也能从“原创 / 改编 / 机构影像”进入。
- 补资料不再挡在所有生成之前，而是显示为阶段性任务。
- 低风险原创故事和高真实度机构片的表单差异清楚。

2026-06-23 进展：

- Phase 6 首个前端切片已落地。`StoryStudio.vue` 在生成前增加“创作合同”面板，可填写/选择 `creation_use_case`、`truth_mode`、客户/机构类型、目标受众和传播目标；词条、大纲/主题、小说改编三条生成分支都会把这些字段传给 Story Generate API。
- `StoryResult.vue` 增加“创作合同与素材 gate”展示，显示创作用途、真实模式、客户/受众、素材阶段、生成姿态和三阶段素材 gate；项目详情页复用该组件，可直接读回项目版本中的新字段。
- `StoryResult.vue` 的补充任务区已改为“素材补充任务”，能显示任务阶段、阻断等级和影响范围；旧项目没有这些字段时仍兼容原展示。
- `SupplementTasks.vue` 专页已改为素材补充工作台，支持阶段、阻断等级和来源筛选；顶部导航入口已从“补录任务”改为“素材补充”。
- `StoryResult.vue` 已新增“项目素材包”展示，能读回主素材、支撑素材、参考素材、缺口数量、人工补充素材和用途标签。
- 该切片先做控件、结果读回、补充任务工作台和素材包展示；当时尚未完成三条主入口重构和全站“知识库 -> 素材库”文案替换。

2026-06-24 进展：

- 项目素材包编辑首个切片已落地。新增 `ProjectMaterialPackAddMaterialRequest` / `ProjectMaterialPackTarget` 共享合同与 `POST /api/projects/:projectId/material-pack/materials`。
- `ProjectDetail.vue` 新增“项目素材包”面板，可直接新增主素材、支撑素材或参考素材，并设置来源类型、用途标签、可信度、故事作用、来源说明、标签、已核实事实和补齐项。
- `project-service` 会把新增素材写回当前版本快照、项目 meta、源 story JSON，并统一刷新 `material_sufficiency`、`creation_contract`、quality report material report 和旧 `knowledge_pack` 兼容包。
- 手动新增素材不会触发 GEARS 图片、视频或后期实产，仍只服务前期创作、剧本生产与素材指挥。
- `StoryStudio.vue` 三条主入口首版已落地：`原创开发`、`资料改编`、`机构影像`。路径会自动带出 `creation_use_case`、`truth_mode`、默认 `video_type` 和 `story_priority`，旧模式收敛为“素材输入方式”。
- 原创开发支持 outline-only 生成。`generateAndStoreStory` 会把用户主题/大纲构造成“用户原创故事种子”，允许低风险原创先出方案；该路径仍写入 `MaterialPack`、`MaterialSufficiencyReport` 和 `CreationContract`，但不生成改编分析。
- `StoryStudio.vue` 已补路径/素材输入方式联动，避免用户切到原作改编或素材检索后仍沿用上一条创作合同。
- `Projects.vue` 故事项目列表已新增创作用途、真实模式、素材 gate 展示和对应筛选，项目管理页开始承担“前期创作与素材指挥”扫读入口。
- 前端可见主路径已完成一轮产品口径替换：顶部导航、首页、素材浏览、搜索、项目详情、项目工作台、故事详情、素材补充任务和漫剧分集入口已从“知识库 / 知识包 / 补录 / 故事项目”切到“AI影视工作台 / 素材库 / 项目素材包 / 素材补充 / 创作项目”，底层 `knowledge_pack` 与 `story_project` 兼容字段保持不变。
- 旧项目读取兼容已补齐。列表和详情会在读时从当前版本 story 推断新合同与素材 gate 字段，不批量改写历史 JSON。
- API 集成测试已覆盖旧项目读取兼容：`GET /api/projects` 和 `GET /api/projects/:projectId` 会返回读时补齐的创作合同、素材充分度和 current story 素材包。
- 故事修复提示包已接入创作合同边界：自动修复会继承真实度模式、禁止表达、待核验项、素材 Gate 和当前可推进阶段，避免“修质量”时把素材不足内容写成确定事实。
- 单场景重写也已继承创作合同和素材 Gate。局部改写 prompt 会显式带上创作用途、真实度、禁止表达、待核验项和当前可推进阶段，并统一使用“素材补充”口径。
- Web 项目详情质量面板已新增只读模型修复提示包入口。操作员可生成/复制包含创作合同、素材 Gate、修复动作和完整 StoryGenerateResult 输出合同的提示词，先给模型产出修复 JSON，再由后续安全写入链路处理。
- Web 项目详情质量面板已补“修复 JSON 校验 / 写入新版本”闭环。后端新增 `story-quality-repair-apply/v1`，可读取纯 JSON、Markdown 代码围栏和 `{ repaired_story_json: ... }` 包装对象；校验模型返回的完整 StoryGenerateResult，保护 storyId、video_type、scene_id 顺序、项目素材包、创作合同和素材 Gate；返回 `change_summary` 展示顶层字段、逐场景字段、GEARS 段、被忽略的保护字段改动和质量差值；质量重评估通过后才新增 `quality_repair` 版本，不覆盖旧版本。
- Web 项目详情质量面板已补“修复 JSON 差异速览”：校验结果会以卡片显示写入状态、内容差异、质量变化、诊断差异和保护字段情况，场景字段和保护字段显示中文名，原始校验摘要折叠保留，降低操作员判断成本。
- Web 项目详情质量面板已补“从剪贴板填入模型输出”入口。操作员可把外部模型返回的纯 JSON、Markdown 代码围栏或 `{ repaired_story_json: ... }` 包装对象一键填入，也可直接“填入并校验”，继续复用后端安全解析、保护字段和质量门槛。
- Web 项目详情质量面板已补“修复边界”摘要。模型修复提示包会在复制提示词前显示创作用途、真实模式、素材 Gate、补充缺口和禁止表达，提醒操作员修复质量时不能突破创作合同、真实度和素材充分度边界。
- `story-quality-repair-apply/v1` 的后端校验返回已同步补创作合同与素材 Gate operator hints。无论 dry-run、拒绝写入还是成功写入，`operator_hints` 与 `validation_summary_markdown` 都会提示创作用途、真实模式、待核验项、禁止表达、素材 Gate 阶段/分数/生成姿态和阻断素材缺口。

2026-06-25 进展：

- GEARS/Seedance 交付摘要出口继续收紧。`submitProjectGearsJobs()` 生成 `payload_summary` 时会先清理“质量信号 / 来源显示 / 史实依据 / 生成优先级 / 知识库”等内部治理词，再写入提交响应与 GEARS Job Ledger；不会触发 GEARS 图片、视频或后期实产。
- 新增项目服务回归测试：污染只允许留在质量诊断或边界报告中，不能进入 GEARS 提交摘要、持久化 ledger 摘要、Production Board 镜头交付字段、Seedance prompt preview、Seedance JSON 或 Markdown。
- 前端与核心生成提示主口径继续收口：`web/client/src` 已不再出现“知识库 / 知识包 / 补录 / 故事项目 / 知识条目”等旧主概念；素材来源显示为“来源条目”，素材任务统一使用“补充”。Story generation prompt 已把“结构化知识库 / 知识包”改成“结构化项目素材库 / 素材包”，输出合同同步要求按项目素材库做创作决策。
- Production Board 交付包第二层净化已推进。`buildStoryProductionBoard()` 会在构建交付副本时清洗 GEARS character/location assets、连续性约束、导演计划、QA flag、supervision 文案和 repair task 文案，避免资产目录、Board Markdown 或报告段落继续带出内部检测词；新增回归把 `production-board.md`、`board.markdown`、资产目录和镜头字段一起纳入拦截。
- 历史项目 `20260621-story-5xhl--character_story` 已用最新逻辑重导出 production-board：镜头交付字段、资产目录、报告文案和 `gears_job_ledger.payload_summary` 结构化检查均为 clean，`production-board` 目录针对内部词的 `rg` 扫描无命中。当前 `delivery_manifest.stage` 仍为 `needs_repair`，但原因已收敛为 Seedance 素材槽位缺失与 prompt complexity 偏高：缺 `location:道州濂溪畔`、缺 `location:湘江夜渡`，以及 shot-1/3/4/5 复杂度警告；没有阻断项，也没有 GEARS 图片、视频或后期实产。
- Seedance 素材槽位和复杂度 gate 已继续收口。Web `buildSeedancePromptPackage()` 与 MCP `kb_generate_seedance_prompt` 都改为按“主/复用人物 + 每场精准地点 + 可选人物/道具”的优先级分配 9 个图片参考，地点校验支持别名覆盖，并用更精简的镜头动作文本计算 prompt complexity；12-15 秒分段提示不再被短镜头阈值误判。
- `20260621-story-5xhl--character_story` 再次重导出后，`delivery_manifest.stage=ready`、`qa_passed=true`、`qa_issue_count=0`，5 个 Seedance shot 均无缺失地点 slot、无复杂度 warning，内部词扫描仍无命中。当前仅 `seedance_asset_report` artifact 仍显示 `needs_repair`，含义是 9 个参考素材文件待外部上传/绑定；本仓库仍不执行 GEARS 图片、视频或 Seedance 实产。
- Production Board manifest 的 ready 后下一步已改为外部素材指挥口径。若 Story Agent 交付包已 ready 但 Seedance 参考素材文件尚未绑定，`delivery_manifest.next_action` 会明确提示“提交 Seedance 前先按素材缺口报告上传/绑定 N 个参考素材文件”，避免把外部素材动作误读成 Story Agent 生成/修复问题。
- 目标项目已用该口径重导出：`manifest.json` 与 `production-board.md` 均显示“Story Agent 交付包可用；提交 Seedance 前请先按素材缺口报告上传/绑定 9 个参考素材文件。” `ready_artifact_count=6/7`，唯一未 ready 的 artifact 仍是 `seedance_asset_report`，代表外部文件待上传而不是本仓库交付失败。
- Seedance 素材缺口报告已补结构化上传清单。`seedance_asset_report.upload_checklist[]` 会逐项给出 `reference_slot`、素材标签、类型/角色、影响镜头与场景、建议文件名、准备说明和验收标准；目标项目重导出后共有 9 条清单，例如 `图片3-人物-船夫.png`、`图片4-场景-道州濂溪畔.png`，便于外部素材上传/绑定 worker 或人工制片直接执行，不进入 GEARS/Seedance 实产。
- Story Agent 侧 100% 状态证据已同步补齐。`story-agent-mvp-status/v1` 与 MCP `mcp-story-agent-mvp-status/v1` 新增 `story_agent_command_surface_status=ready`、`story_agent_command_surface_percent=100`，并把 `production_delivery_contract` surface 计数从 12 项扩为 13 项，新增 `seedance_asset_upload_checklist`；这代表本项目内容、交付合同和素材指挥面闭合，真实 GEARS v2 端到端 worker 验收仍作为外部 lane 单独跟踪。

### Phase 7：MCP 与项目指挥工具兼容

目标：新模型能被外部 Agent 使用，但不破坏现有 MCP。

任务：

- 保留现有 `kb_*` 工具。
- 新增或扩展只读工具：
  - `kb_generate_story_blueprint` 返回 creation contract。
  - `kb_validate_genre_story` 返回 truth/material/adaptation/institutional report。
  - `kb_get_project_context` 返回 material pack 和 sufficiency。
- 可选新增别名工具：
  - `story_generate_blueprint`
  - `story_validate_project`
  - `story_get_project_context`
- 更新 MCP status，把新主线从“知识库能力”改为“创作素材与类型片能力”。

验收：

- 老 MCP 流程不坏。
- 新对话可通过 MCP 读取项目的创作合同、素材充分度和真实度质量。

2026-06-23 进展：

- `kb_generate_story_blueprint` 已对齐三阶段素材充分度。返回的 `material_sufficiency` 现在包含 `active_stage`、`generation_posture`、`needs_verification`、`next_stage` 和 `stage_reports[]`。
- MCP 蓝图的 `type_specific_requirements` 会追加素材目标阶段、可推进阶段、生成姿态和 `minimum_viable_story / script_ready / production_ready` 三阶段 gate 摘要。
- `kb_generate_story` 与 `kb_generate_script` 已扩展 tool schema，支持 `creation_use_case`、`truth_mode`、`client_type`、`target_audience`、`communication_goal`。
- 新增 MCP 轻量 `story-creation-contract` builder：把旧 `script_type` 映射为 `video_type / presentation_style / story_structure`，返回 `creation_contract` 与三阶段 `material_sufficiency`，并把创作合同、素材 gate、三阶段报告写入生成的 Markdown。
- `kb_generate_script` 仍只生成脚本骨架，会把当前安全阶段标为 `minimum_viable_story`，并把完整正文、对白/旁白、视觉资产和生产规范列为后续素材需求。
- `kb_generate_story_repair_prompt` / `kb_repair_story` 已补创作合同与素材 Gate 边界。MCP 修复提示包 JSON、prompt、Markdown 和 dry-run 风险说明都会带 `boundary_notes`、`creation_contract`、`material_sufficiency`，提醒外部 Agent 修复时不得突破真实度、禁止表达、待核验项和素材充分度边界。
- MCP 工具仍不执行 GEARS 图片、视频或后期实产。

### Phase 8：迁移与测试

目标：安全承接已有 generated 项目。

任务：

- 旧项目读取时自动补默认：
  - `creation_use_case` 根据 video_type 推断。
  - `truth_mode` 根据 video_type 推断。
  - `material_pack` 从 `knowledge_pack` 映射。
- 不批量改写历史 JSON，除非用户明确运行治理 dry-run 后应用。
- 增加测试：
  - schema 默认值。
  - blueprint creation contract。
  - prompt package。
  - material sufficiency。
  - genre/truth quality。
  - project persistence。
  - route/API 兼容。

验收：

- 旧故事列表、详情、项目版本仍可读取。
- 新字段进入新生成项目。
- 测试覆盖旧请求和新请求双路径。

## 7. 推荐开发顺序

下一轮新对话建议按这个顺序开工：

1. Phase 1：先加共享类型和 schema，不改 UI。
2. Phase 2：扩展类型片画像矩阵，让规则有地方放。
3. Phase 3：实现 MaterialPack 兼容层和素材充分度报告。
4. Phase 4：把 creation contract 接入 generateAndStoreStory、blueprint、prompt。
5. Phase 5：加质量报告和 repair prompt 支持。
6. Phase 6：最后改前端入口和文案。

原因：

- 类型和合同先稳定，后续 UI 和质量报告才不会反复返工。
- `knowledge_pack` 到 `material_pack` 需要兼容期，不能一次性硬改字段名。
- 真实度和类型片矩阵必须进服务层，不能只写在 prompt 或前端 label 里。

## 8. 新对话可直接使用的任务提示

```text
请继续 /Users/wuyu/Desktop/china-culture-kb 的 Story Agent 开发。本次任务只针对本项目，不实现 GEARS 图片/视频/后期实产。先阅读 docs/story-agent-creative-platform-reposition-plan.md、docs/story-agent-next-development-plan.md、docs/story-agent-next-conversation-handoff.md 和 .codex/skills/china-culture-story-agent/SKILL.md。当前新方向是：把项目从“知识库驱动的故事生成器”升级为“AI 影视前期创作、剧本生产与项目素材指挥系统”。优先做 Phase 1：新增 CreationUseCase、TruthMode、CreationContract、MaterialPack、MaterialSufficiencyReport，并兼容旧 knowledge_pack；然后把 creation_contract 接入 StoryBlueprint、StoryGenerateRequest/Result、prompt package 和项目版本存储。开始前先执行 git status --short --branch 和 git diff --stat，不要覆盖用户已有改动。
```

## 9. 不做事项

- 不把真实媒体生产能力加回本项目。
- 不继续以“补全知识库”作为所有生成的前置条件。
- 不把支撑素材自动写成事实。
- 不把机构/政府/纪录片写成强反转短剧。
- 不一次性破坏 `knowledge_pack`、`kb_*` 工具和旧 generated 项目兼容。
- 不把生成故事或修复结果写回 `data/provinces/*.md`。
