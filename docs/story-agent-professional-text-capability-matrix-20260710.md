# Story Agent 全片型专业文本能力矩阵

> schema_version: story-agent-professional-text-capability-matrix/v1
> generated_at: 2026-07-11T14:23:30.126Z
> 口径：现有结构能力与专业验收分开；fixture/simulation 不计专业通过。

## 总览

- VideoType 覆盖：15/15
- 完整 legacy GenreStoryProfile：15/15
- 结构化生成主链：15/15
- ProfessionalTextPackage 合同：15/15
- ProfessionalTextPackage 合法骨架：15/15
- ProfessionalTextPackage 通过：0/15
- ProductionMaterialPack：8/15
- 黄金卡草案：30，人工通过：0
- fixture 回归：9（排除于专业通过）
- character_story 固定项目规格：5/5；失败 fixture：3/3
- historical_drama 固定项目规格：5/5；失败 fixture：3/3
- legend_story 固定项目规格：5/5；失败 fixture：3/3
- children_story 固定项目规格：5/5；失败 fixture：3/3
- ai_comic_drama 固定项目规格：5/5；失败 fixture：3/3
- culture_promo 固定项目规格：5/5；失败 fixture：3/3
- heritage_promo 固定项目规格：5/5；失败 fixture：3/3
- city_brand_promo 固定项目规格：5/5；失败 fixture：3/3
- social_short 固定项目规格：5/5；失败 fixture：3/3
- documentary_short 固定项目规格：5/5；失败 fixture：3/3
- explainer_video 固定项目规格：5/5；失败 fixture：3/3
- lecture_video 固定项目规格：5/5；失败 fixture：3/3
- education_training 固定项目规格：5/5；失败 fixture：3/3
- scene_short 固定项目规格：5/5；失败 fixture：3/3
- landscape_mood 固定项目规格：5/5；失败 fixture：3/3
- 十五片型项目规格/失败 fixture 总计：75/75；45/45（均不计专业通过）
- Stage 6 多轮修订项目规格：15/15；完成两轮真实修订：0/15；已验证真实修订轮次：0
- Coverage/桌读/多轮修订合同：已建立；失败 fixture：3/3（不计真实修订）
- Stage 6 执行批次：计划 30/30 轮；阻断项目 15/15；Round 1 可执行 0/15
- character_story 源快照/执行包：5/5；strict bridge/CLI 技术锚：5/5；授权执行：0/5
- 受控运行计划/prepared ledger/阻断：5/5/5；模型调用/真实完成：0/0
- prompt/完整场景/strict bridge/run ledger/artifact/盲评阈值合同：1/1/1/1/1/1
- 初稿后协调器/终审候选门禁/生命周期计划：1/1/1；待真实初稿 5/5；候选/签署 0/0
- 专业纵向管线/质量评估器/修订计划器：15/15/15
- 固定真实回归项目：0/75
- 真人盲评通过：0/45

## 15 类矩阵

| VideoType | 片型线 | Profile | 主链 | 专业合同/骨架 | 语义质量 | 修复 | 素材包 | 黄金卡 草案/人审通过 | fixture | 专业通过 |
|---|---|---:|---:|---:|---|---|---:|---:|---:|---:|
| `character_story` | 剧情故事线 | ✓ | ✓ | ✓/✓ | professional_candidate_evaluator | professional_targeted_revision_plan | ✗ | 0/0 | 0 | ✗ |
| `historical_drama` | 剧情故事线 | ✓ | ✓ | ✓/✓ | professional_candidate_evaluator | professional_targeted_revision_plan | ✗ | 0/0 | 0 | ✗ |
| `legend_story` | 剧情故事线 | ✓ | ✓ | ✓/✓ | professional_candidate_evaluator | professional_targeted_revision_plan | ✗ | 0/0 | 0 | ✗ |
| `ai_comic_drama` | 剧情故事线 | ✓ | ✓ | ✓/✓ | professional_candidate_evaluator | professional_targeted_revision_plan | ✓ | 10/0 | 3 | ✗ |
| `children_story` | 剧情故事线 | ✓ | ✓ | ✓/✓ | professional_candidate_evaluator | professional_targeted_revision_plan | ✓ | 0/0 | 0 | ✗ |
| `culture_promo` | 宣传传播线 | ✓ | ✓ | ✓/✓ | professional_candidate_evaluator | professional_targeted_revision_plan | ✗ | 0/0 | 0 | ✗ |
| `heritage_promo` | 宣传传播线 | ✓ | ✓ | ✓/✓ | professional_candidate_evaluator | professional_targeted_revision_plan | ✓ | 10/0 | 3 | ✗ |
| `city_brand_promo` | 宣传传播线 | ✓ | ✓ | ✓/✓ | professional_candidate_evaluator | professional_targeted_revision_plan | ✗ | 0/0 | 0 | ✗ |
| `social_short` | 宣传传播线 | ✓ | ✓ | ✓/✓ | professional_candidate_evaluator | professional_targeted_revision_plan | ✓ | 0/0 | 0 | ✗ |
| `documentary_short` | 非虚构与知识线 | ✓ | ✓ | ✓/✓ | professional_candidate_evaluator | professional_targeted_revision_plan | ✓ | 10/0 | 3 | ✗ |
| `explainer_video` | 非虚构与知识线 | ✓ | ✓ | ✓/✓ | professional_candidate_evaluator | professional_targeted_revision_plan | ✓ | 0/0 | 0 | ✗ |
| `lecture_video` | 非虚构与知识线 | ✓ | ✓ | ✓/✓ | professional_candidate_evaluator | professional_targeted_revision_plan | ✓ | 0/0 | 0 | ✗ |
| `education_training` | 非虚构与知识线 | ✓ | ✓ | ✓/✓ | professional_candidate_evaluator | professional_targeted_revision_plan | ✓ | 0/0 | 0 | ✗ |
| `scene_short` | 空间与意境线 | ✓ | ✓ | ✓/✓ | professional_candidate_evaluator | professional_targeted_revision_plan | ✗ | 0/0 | 0 | ✗ |
| `landscape_mood` | 空间与意境线 | ✓ | ✓ | ✓/✓ | professional_candidate_evaluator | professional_targeted_revision_plan | ✗ | 0/0 | 0 | ✗ |

## 逐片型缺口

### 人物故事（`character_story`）

- 专业必交文本：人物命题、关键选择、关系网、人物弧、分场剧本
- 专属质量门槛：不能写成年表；选择必须造成代价和变化
- 专业合同/合法骨架：有/通过
- 当前 legacy 输出字段：title、logline、theme、full_text、scene_breakdown、cultural_constraints、credibility_note、characters、protagonist_arc
- 当前质量证据：目标/阻力/选择代价语义证据、反年表检查、人物精神落点
- 素材与样本：ProductionMaterialPack=无；黄金卡草案=0；fixture=0
- 专业缺口：缺少真实模型固定项目和初稿到终稿修订证据；缺少真人盲评与三角色签署；缺少人工通过黄金卡；缺少 ProductionMaterialPack；十维评分和硬门槛已接入候选文本评估，但缺真实模型文本、原创性判断和真人盲评证据；定向修订计划和陈旧派生文本重建已实现，但缺真实模型初稿到终稿的质量增量证明

### 历史剧情短片（`historical_drama`）

- 专业必交文本：史实压力、事件因果、角色立场、戏剧化边界、分场剧本
- 专属质量门槛：事实和虚构分层；冲突必须来自时代处境
- 专业合同/合法骨架：有/通过
- 当前 legacy 输出字段：title、logline、theme、full_text、scene_breakdown、cultural_constraints、credibility_note、characters、protagonist_arc
- 当前质量证据：事件因果、时代/制度压力、史实边界
- 素材与样本：ProductionMaterialPack=无；黄金卡草案=0；fixture=0
- 专业缺口：缺少真实模型固定项目和初稿到终稿修订证据；缺少真人盲评与三角色签署；缺少人工通过黄金卡；缺少 ProductionMaterialPack；十维评分和硬门槛已接入候选文本评估，但缺真实模型文本、原创性判断和真人盲评证据；定向修订计划和陈旧派生文本重建已实现，但缺真实模型初稿到终稿的质量增量证明

### 神话/传说故事（`legend_story`）

- 专业必交文本：版本说明、象征意象、凡人选择、口述节奏、完整剧本
- 专属质量门槛：不把传说写成史实；象征必须服务人物选择
- 专业合同/合法骨架：有/通过
- 当前 legacy 输出字段：title、logline、theme、full_text、scene_breakdown、cultural_constraints、credibility_note、characters
- 当前质量证据：仅通用 profile 信号/字符串诊断
- 素材与样本：ProductionMaterialPack=无；黄金卡草案=0；fixture=0
- 专业缺口：缺少真实模型固定项目和初稿到终稿修订证据；缺少真人盲评与三角色签署；缺少人工通过黄金卡；缺少 ProductionMaterialPack；十维评分和硬门槛已接入候选文本评估，但缺真实模型文本、原创性判断和真人盲评证据；定向修订计划和陈旧派生文本重建已实现，但缺真实模型初稿到终稿的质量增量证明

### AI 漫剧单片（`ai_comic_drama`）

- 专业必交文本：集钩子、关系碰撞、可分格动作、对白气泡、表情节拍、结尾钩子
- 专属质量门槛：每格可画；角色和资产连续；对白不能承担全部叙事
- 专业合同/合法骨架：有/通过
- 当前 legacy 输出字段：title、logline、theme、full_text、scene_breakdown、cultural_constraints、credibility_note
- 当前质量证据：对白或强旁白、结尾钩子、表情动作/名场面
- 素材与样本：ProductionMaterialPack=有；黄金卡草案=10；fixture=3
- 专业缺口：缺少真实模型固定项目和初稿到终稿修订证据；缺少真人盲评与三角色签署；缺少人工通过黄金卡；十维评分和硬门槛已接入候选文本评估，但缺真实模型文本、原创性判断和真人盲评证据；定向修订计划和陈旧派生文本重建已实现，但缺真实模型初稿到终稿的质量增量证明

### 儿童故事片（`children_story`）

- 专业必交文本：年龄段、温和冲突、重复母题、情绪学习、亲师提示
- 专属质量门槛：儿童可理解；不残酷、不恐吓、不把说教当情节
- 专业合同/合法骨架：有/通过
- 当前 legacy 输出字段：title、logline、theme、full_text、scene_breakdown、cultural_constraints、credibility_note、characters、protagonist_arc
- 当前质量证据：仅通用 profile 信号/字符串诊断
- 素材与样本：ProductionMaterialPack=有；黄金卡草案=0；fixture=0
- 专业缺口：缺少真实模型固定项目和初稿到终稿修订证据；缺少真人盲评与三角色签署；缺少人工通过黄金卡；十维评分和硬门槛已接入候选文本评估，但缺真实模型文本、原创性判断和真人盲评证据；定向修订计划和陈旧派生文本重建已实现，但缺真实模型初稿到终稿的质量增量证明

### 文化宣传片（`culture_promo`）

- 专业必交文本：传播命题、视觉符号、信息曲线、旁白、行动召唤
- 专属质量门槛：不能只有赞美；文化细节必须承担叙事功能
- 专业合同/合法骨架：有/通过
- 当前 legacy 输出字段：title、logline、theme、full_text、scene_breakdown、cultural_constraints、credibility_note、visual_symbols、core_message、slogan_or_key_sentence、modern_connection
- 当前质量证据：核心主张、视觉符号、当代连接
- 素材与样本：ProductionMaterialPack=无；黄金卡草案=0；fixture=0
- 专业缺口：缺少真实模型固定项目和初稿到终稿修订证据；缺少真人盲评与三角色签署；缺少人工通过黄金卡；缺少 ProductionMaterialPack；十维评分和硬门槛已接入候选文本评估，但缺真实模型文本、原创性判断和真人盲评证据；定向修订计划和陈旧派生文本重建已实现，但缺真实模型初稿到终稿的质量增量证明

### 非遗/工艺宣传片（`heritage_promo`）

- 专业必交文本：材料、工具、工序、手部动作、传承压力、当代连接
- 专属质量门槛：工序可拍；授权和危险操作边界清楚
- 专业合同/合法骨架：有/通过
- 当前 legacy 输出字段：title、logline、theme、full_text、scene_breakdown、cultural_constraints、credibility_note、visual_symbols、craft_or_ritual_process、modern_connection、core_message、slogan_or_key_sentence
- 当前质量证据：流程顺序、材料工具、传承动作
- 素材与样本：ProductionMaterialPack=有；黄金卡草案=10；fixture=3
- 专业缺口：缺少真实模型固定项目和初稿到终稿修订证据；缺少真人盲评与三角色签署；缺少人工通过黄金卡；十维评分和硬门槛已接入候选文本评估，但缺真实模型文本、原创性判断和真人盲评证据；定向修订计划和陈旧派生文本重建已实现，但缺真实模型初稿到终稿的质量增量证明

### 城市/文旅宣传片（`city_brand_promo`）

- 专业必交文本：城市主张、人物视角、空间路线、城市证据、品牌落点
- 专属质量门槛：避免城市宣传套话；地理、生活和人物必须真实关联
- 专业合同/合法骨架：有/通过
- 当前 legacy 输出字段：title、logline、theme、full_text、scene_breakdown、cultural_constraints、credibility_note、visual_symbols、core_message、slogan_or_key_sentence、modern_connection
- 当前质量证据：仅通用 profile 信号/字符串诊断
- 素材与样本：ProductionMaterialPack=无；黄金卡草案=0；fixture=0
- 专业缺口：缺少真实模型固定项目和初稿到终稿修订证据；缺少真人盲评与三角色签署；缺少人工通过黄金卡；缺少 ProductionMaterialPack；十维评分和硬门槛已接入候选文本评估，但缺真实模型文本、原创性判断和真人盲评证据；定向修订计划和陈旧派生文本重建已实现，但缺真实模型初稿到终稿的质量增量证明

### 竖屏短视频（`social_short`）

- 专业必交文本：三秒钩子、节拍表、反差、字幕、竖屏画面、互动问题
- 专属质量门槛：60 至 90 秒内持续有新信息；事实边界不能被钩子牺牲
- 专业合同/合法骨架：有/通过
- 当前 legacy 输出字段：title、logline、theme、full_text、scene_breakdown、cultural_constraints、credibility_note、visual_symbols、core_message、slogan_or_key_sentence
- 当前质量证据：仅通用 profile 信号/字符串诊断
- 素材与样本：ProductionMaterialPack=有；黄金卡草案=0；fixture=0
- 专业缺口：缺少真实模型固定项目和初稿到终稿修订证据；缺少真人盲评与三角色签署；缺少人工通过黄金卡；十维评分和硬门槛已接入候选文本评估，但缺真实模型文本、原创性判断和真人盲评证据；定向修订计划和陈旧派生文本重建已实现，但缺真实模型初稿到终稿的质量增量证明

### 微纪录片（`documentary_short`）

- 专业必交文本：核心问题、现实现场、采访角色、史料线索、B-roll、再现边界
- 专属质量门槛：不虚构采访或现场；旁白克制；证据推动发现
- 专业合同/合法骨架：有/通过
- 当前 legacy 输出字段：title、logline、theme、full_text、scene_breakdown、cultural_constraints、credibility_note、source_quotes、field_notes
- 当前质量证据：现实现场、来源提示、版本/再现边界
- 素材与样本：ProductionMaterialPack=有；黄金卡草案=10；fixture=3
- 专业缺口：缺少真实模型固定项目和初稿到终稿修订证据；缺少真人盲评与三角色签署；缺少人工通过黄金卡；十维评分和硬门槛已接入候选文本评估，但缺真实模型文本、原创性判断和真人盲评证据；定向修订计划和陈旧派生文本重建已实现，但缺真实模型初稿到终稿的质量增量证明

### 知识讲解视频（`explainer_video`）

- 专业必交文本：问题、概念、例子、视觉比喻、误区、总结
- 专属质量门槛：一段只讲一个核心概念；画面能解释而非装饰
- 专业合同/合法骨架：有/通过
- 当前 legacy 输出字段：title、logline、theme、full_text、scene_breakdown、cultural_constraints、credibility_note、argument_points、knowledge_outline
- 当前质量证据：仅通用 profile 信号/字符串诊断
- 素材与样本：ProductionMaterialPack=有；黄金卡草案=0；fixture=0
- 专业缺口：缺少真实模型固定项目和初稿到终稿修订证据；缺少真人盲评与三角色签署；缺少人工通过黄金卡；十维评分和硬门槛已接入候选文本评估，但缺真实模型文本、原创性判断和真人盲评证据；定向修订计划和陈旧派生文本重建已实现，但缺真实模型初稿到终稿的质量增量证明

### 宣讲片（`lecture_video`）

- 专业必交文本：立论、论证、案例、反方、修辞转场、行动结论
- 专属质量门槛：论点可验证；不是资料罗列或口号堆叠
- 专业合同/合法骨架：有/通过
- 当前 legacy 输出字段：title、logline、theme、full_text、scene_breakdown、cultural_constraints、credibility_note、argument_points、knowledge_outline
- 当前质量证据：仅通用 profile 信号/字符串诊断
- 素材与样本：ProductionMaterialPack=有；黄金卡草案=0；fixture=0
- 专业缺口：缺少真实模型固定项目和初稿到终稿修订证据；缺少真人盲评与三角色签署；缺少人工通过黄金卡；十维评分和硬门槛已接入候选文本评估，但缺真实模型文本、原创性判断和真人盲评证据；定向修订计划和陈旧派生文本重建已实现，但缺真实模型初稿到终稿的质量增量证明

### 教育/培训片（`education_training`）

- 专业必交文本：学习目标、知识步骤、案例、练习、评估、复盘
- 专属质量门槛：能教会和检验；练习与目标对应
- 专业合同/合法骨架：有/通过
- 当前 legacy 输出字段：title、logline、theme、full_text、scene_breakdown、cultural_constraints、credibility_note、argument_points、knowledge_outline
- 当前质量证据：仅通用 profile 信号/字符串诊断
- 素材与样本：ProductionMaterialPack=有；黄金卡草案=0；fixture=0
- 专业缺口：缺少真实模型固定项目和初稿到终稿修订证据；缺少真人盲评与三角色签署；缺少人工通过黄金卡；十维评分和硬门槛已接入候选文本评估，但缺真实模型文本、原创性判断和真人盲评证据；定向修订计划和陈旧派生文本重建已实现，但缺真实模型初稿到终稿的质量增量证明

### 场景短片（`scene_short`）

- 专业必交文本：空间路线、人物或事件触发、镜头行动、声音、转场
- 专属质量门槛：空间必须发生变化或发现，不能只是景点介绍
- 专业合同/合法骨架：有/通过
- 当前 legacy 输出字段：title、logline、theme、full_text、scene_breakdown、cultural_constraints、credibility_note、spatial_identity、visual_route、time_layer、atmosphere
- 当前质量证据：仅通用 profile 信号/字符串诊断
- 素材与样本：ProductionMaterialPack=无；黄金卡草案=0；fixture=0
- 专业缺口：缺少真实模型固定项目和初稿到终稿修订证据；缺少真人盲评与三角色签署；缺少人工通过黄金卡；缺少 ProductionMaterialPack；十维评分和硬门槛已接入候选文本评估，但缺真实模型文本、原创性判断和真人盲评证据；定向修订计划和陈旧派生文本重建已实现，但缺真实模型初稿到终稿的质量增量证明

### 山水意境片（`landscape_mood`）

- 专业必交文本：情绪命题、时间变化、构图节奏、自然声音、极简文案
- 专属质量门槛：情绪由视听建立；文案不能压过画面
- 专业合同/合法骨架：有/通过
- 当前 legacy 输出字段：title、logline、theme、full_text、scene_breakdown、cultural_constraints、credibility_note、spatial_identity、visual_route、time_layer、atmosphere
- 当前质量证据：仅通用 profile 信号/字符串诊断
- 素材与样本：ProductionMaterialPack=无；黄金卡草案=0；fixture=0
- 专业缺口：缺少真实模型固定项目和初稿到终稿修订证据；缺少真人盲评与三角色签署；缺少人工通过黄金卡；缺少 ProductionMaterialPack；十维评分和硬门槛已接入候选文本评估，但缺真实模型文本、原创性判断和真人盲评证据；定向修订计划和陈旧派生文本重建已实现，但缺真实模型初稿到终稿的质量增量证明
