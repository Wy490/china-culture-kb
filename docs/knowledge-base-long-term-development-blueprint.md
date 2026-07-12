# 素材库长期生产化开发蓝图

更新时间：2026-07-10

本文档定义 `china-culture-kb` 素材库从“文化资料库”长期升级为“影视生产素材系统”的路线、阶段、验收标准和进度口径。它和 `docs/story-agent-production-material-blueprint.md` 的关系是：

- `story-agent-production-material-blueprint.md` 记录 Story Agent 已经完成的生产素材系统工程能力。
- 本文档面向未来素材库建设，回答“补什么素材、补到什么深度、如何验收、每次推进如何报进度”。

## 1. 核心判断

影视创作确实需要更丰富的素材库，但正确目标不是“百科式大而全”，而是“高密度、可核验、可生产、可复用”。

本项目当前的关键矛盾不是底库完全空白，而是：

- 条目覆盖面不均：湖南条目最多，全国题材覆盖仍薄。
- 影视生产字段不足：很多条目能讲文化，但还不能稳定驱动剧本、分镜、镜头提示词、参考资产和交付验收。
- 可复用规则仍需沉淀：朝代服饰、空间陈设、非遗流程、纪录片来源、AI 漫剧分镜、儿童改写安全等应形成 Domain Pack，而不是在单条素材里重复写。
- 写回闭环要继续保持审稿制：项目生成中的补充内容不能直接写入正式省份 Markdown，必须先变成候选稿、审稿通过，再进入写回队列和人工 Patch。

因此，长期路线不是先补完整个中国文化百科，而是先建设一批“黄金生产素材卡”，再按片型和题材网络扩展。

## 2. 当前基线

截至 2026-07-09，本项目已有以下基础：

- 省份 Markdown 底库：34 个省份文件，169 条条目。
- 来源治理：596 个来源，平均每条 3.53 个来源；缺来源条目为 0。
- 地点治理：缺相关地点条目为 0。
- 可信度治理：可信度已归一，缺核实方法为 0。
- 机器字段：169 条均已有 `knowledge_domain`、`entry_role`、`era`、`asset_usage` 等调度字段。
- 资产拆分：169 条均已有人物、场景、人物随身道具、场景陈设。
- 生产模板：已覆盖 8 类高频片型：`heritage_promo`、`documentary_short`、`explainer_video`、`children_story`、`social_short`、`lecture_video`、`education_training`、`ai_comic_drama`。
- 扩库候选：Domain Pack 扩库候选已有 11 批，约 100 个 seed target，约 400 个字段候选。
- 写回治理：项目候选稿、Domain Pack 扩库候选、审稿状态、写回队列和统一导出包已经打通，正式写回仍保持人工 Patch。

当前最重要的缺口：

- 0 批基础治理任务待做，说明“清洗补漏”已经不是主线。
- 396 个生产化补齐动作待做，说明主线已经转为“按片型补生产字段”。
- 169 条已有基础资产拆分，但还没有足够多条目达到稳定 `production_ready` 的影视生产卡密度。

## 3. 长期北极星

把素材库建设成能稳定支撑以下工作的生产系统：

```text
文化事实 / 来源 / 地方条目
  -> 可复用 Domain Pack
  -> 片型 ProductionMaterialPack
  -> 条目级生产素材卡
  -> 项目 MaterialPack
  -> StoryBlueprint
  -> full_text / scene_breakdown / gears_segments
  -> Production Board / Seedance prompt / GEARS handoff
  -> 质量报告 / 素材缺口 / 审稿写回
```

长期目标不是“很多资料”，而是四类可验收能力：

- 可写：能生成 audience-facing 剧本，而不是资料摘要。
- 可分镜：能拆出场景、动作、情绪、道具、视觉锚点和镜头连续性。
- 可交付：能生成 Seedance/GEARS 所需的提示词、参考资产清单和验收项。
- 可追责：每个硬事实都有来源和核实边界；虚构、传说、再现和史实分层清楚。

## 4. 内容分层策略

### 4.1 省份底库

位置：`data/provinces/*.md`

职责：

- 存放人物、地点、事件、非遗、民俗、名胜古迹等具体文化条目。
- 保留来源、可信度、核实方法、待核点、地域和基础资产拆分。
- 不直接保存生成故事、不保存未审稿的项目补充内容。

### 4.2 Domain Pack

位置：`data/domain-packs/china-culture.json` 和扩库候选文件。

职责：

- 存放跨条目复用的规则、边界、母题、场景模板、服饰器物、片型生产提示。
- 适合沉淀：宋代士人服饰、官署空间、书院空间、非遗工序、纪录片来源结构、AI 漫剧分镜规则、儿童改写安全规则。
- 不写具体人物传记和单一事件全貌。

### 4.3 片型生产模板

位置：`data/production-packs/video-type-material-supplement-packs.json`

职责：

- 按 `video_type` 定义 required fields、prompt layers、三阶段 gate、补充问题和样板条目。
- 当前优先维护 8 个高频片型。
- 新增片型前必须先有样本、字段、gate 和健康报告。

### 4.4 条目级生产素材卡

当前形态：

- 由项目补充任务、扩库候选、候选 Markdown 和人工写回草案共同承载。

长期建议：

- 当 30 条黄金生产素材卡跑通后，再评估是否新增独立结构化目录，例如 `data/production-cards/`。
- 生产素材卡应以 `entry_name + province + video_type` 为索引，保存片型字段、来源引用、审稿状态和写回状态。
- 不建议把所有片型字段无差别塞进省份 Markdown，否则底库会膨胀到难以维护。

### 4.5 项目素材包

位置：`web/generated/projects/*/project.json`

职责：

- 保存具体项目的业务目标、真实度、素材包、质量报告、补充任务、GEARS/Seedance 交付状态。
- 项目级生成内容默认不回写底库。
- 只有可复用、已审稿、来源清楚的内容才进入知识库写回队列。

## 5. 总体阶段与进度口径

本文档采用“素材库长期生产化”进度，不等同于 Story Agent 产品总进度。Story Agent 工程能力已经很成熟，但素材库内容生产化仍处在早中期。

当前总进度：99%（以 `data/reports/knowledge-base-long-term-development-status.json` 为素材库长期生产化路线的机器口径）

该百分比只属于素材库长期生产化路线，不映射到 `professional_text_creation_progress`。专业文本创作路线以 `data/reports/story-agent-professional-text-creation-progress.json` 的独立证据模型为准。

进度权重如下：

| 阶段 | 权重 | 当前状态 | 当前完成 |
|---|---:|---|---:|
| Phase 0：路线与治理口径 | 8% | 本文档建立后完成 | 8% |
| Phase 1：黄金生产素材卡 | 17% | 30 条黄金卡结构化草案、统一索引、风险分级、补证队列和 9 条抽样回归完成，待人工审稿与写回队列 | 16.5% |
| Phase 2：Domain Pack 高复用资产 | 15% | 有候选和部分正式包，Phase 1 已抽取并结构化 9 个候选规则包，P0/P1 来源/授权占位、审稿核对清单、P0/P1 质量规则、审稿批次索引、模拟约束、晋升预检、独立审稿模板、证据槽位、空白决策台账、审稿看板、人工填报入口、填报校验模拟、人工 Patch 候选导出、差异草案模板、预审矩阵、周节奏分派、证据附件冻结清单、签署催办看板、签署反馈样例校验、审稿包锁版、失败原因索引、正式 Patch 前失败报告、人审交接包、真实审稿人填报字段冻结、外部执行清单、回填校验夹具、签署前预检、真实提交导入契约、外部记录解析清单、确定性导入校验器、外部记录状态编排器和默认禁用安全注册表已建立，待人工审稿和正式晋升 | 14.9% |
| Phase 3：多片型稳定产出矩阵 | 15% | 8 类模板已接入，内容卡不足 | 3% |
| Phase 4：全国题材覆盖 | 15% | 湖南强，其他省份薄 | 1% |
| Phase 5：项目反馈到素材库闭环 | 12% | 工具链已通，16 条 P0/P1 候选写回队列、16 条 Markdown 草案模板、16 个审稿导出文件、16 个审稿核对清单、3 套写回约束、2 个 pass 草案准备模板、14 条 repair/reject 任务、证据映射、人工填报入口、填报校验结构、Patch 导出草案、修复补证任务模板、正式 Patch 前预审矩阵、证据附件冻结清单、签署催办看板、签署反馈样例、审稿包锁版失败原因索引、正式 Patch 前失败报告、人审交接包、真实审稿人填报字段冻结、外部执行清单、回填校验夹具、签署前预检、真实提交导入契约、外部记录解析清单、确定性导入校验器、外部记录状态编排器和默认禁用安全注册表已建立，待人工审稿后生成真实写回草案 | 11.9% |
| Phase 6：评测样本与成片验收 | 10% | 已有 9 条跨片型回归样本覆盖矩阵，仍缺系统样本集和成片验收 | 3% |
| Phase 7：规模化运营与协作 | 8% | 已建立首批 4 个人工审稿批次索引、批次机器门槛、Domain Pack 晋升预检门槛、Patch 隔离规则、空白决策台账、审稿批次看板、人工填报表、填报校验、模拟候选队列、签署占位、正式 Patch 前检查、预审矩阵、周节奏分派台账、证据附件冻结清单、签署催办看板、签署反馈样例校验、审稿包锁版、正式 Patch 前失败报告、可打印人审交接包、8 份角色级填报模板、16 项外部执行清单、14 个回填校验夹具、12 项签署前预检、24 字段真实提交导入契约、10 项外部记录解析清单、确定性导入校验器、外部记录状态编排器和 5 类默认禁用安全注册表，周节奏仍待真实执行 | 7.9% |

后续每次汇报使用固定格式：

```text
当前阶段：Phase X - 阶段名称
本轮推进：做了什么
阶段进度：A% -> B%
总进度：C% -> D%
验收结果：通过/部分通过/未跑
下一步：下一批最小可交付
阻塞项：需要用户、来源或外部系统确认的内容
```

## 6. Phase 0：路线与治理口径

目标：把长期方向、百分比口径、开发边界和近期任务固化下来。

已完成：

- 明确“可生产素材密度”优先于“百科式扩库规模”。
- 明确五层素材架构：省份底库、Domain Pack、片型模板、条目级生产素材卡、项目素材包。
- 明确后续不直接写生成故事进 `data/provinces/*.md`。
- 明确每次推进必须报告阶段和百分比。

验收标准：

- 本文档存在且可作为后续路线依据。
- 有机器可读状态文件，便于后续总控或脚本读取。
- 后续任务能拆成 1-2 周内可完成的最小交付。

阶段进度：100%

## 7. Phase 1：黄金生产素材卡

目标：不先追求大规模扩库，先做 30 条黄金生产素材卡，作为后续扩库样板。

推荐切片：

- AI 漫剧 10 条。
- 非遗/工艺宣传片 10 条。
- 微纪录片 10 条。

### 7.1 AI 漫剧 10 条

优先字段：

- `episode_hook`
- `world_and_truth_mode`
- `protagonist_goal`
- `opponent_or_pressure`
- `relationship_collision`
- `scene_anchor`
- `character_stability_tags`
- `dialogue_bubbles`
- `emotion_beats`
- `shot_prompt_layers`
- `reference_images_or_keyframes`
- `identity_motion_consistency_plan`
- `single_shot_test`
- `multi_shot_continuity`
- `ending_hook`
- `forbidden_claims`

候选条目：

- 南京大屠杀——中华民族最深的伤痕
- 平江起义——从旧军队内部爆发的革命枪响
- 桑植白族仗鼓舞——700年前迁徙白族的武舞合一
- 通道侗锦——湘西南侗寨的指尖花雨
- 土家族摆手舞——湘西土家的集体仪式
- 武昌起义——辛亥革命的第一声枪响
- 湘昆——山野昆曲的南岭遗音
- 岳州扇——洞庭湖畔的文人雅扇
- 长沙窑铜官陶瓷烧制技艺——海上丝绸之路的釉下彩开创
- 常德丝弦——湘北水乡的扬琴说唱

截至 2026-07-10 的进展：

- 已新增结构化生产卡：`data/production-cards/ai-comic-drama-golden-cards.json`。
- 已新增审稿说明：`docs/production-cards/ai-comic-drama-golden-cards-20260709.md`。
- 10 条候选均已覆盖 AI 漫剧 17 个必填字段。
- 每条均保留 `evidence_boundaries`、`source_refs`、`forbidden_claims` 和不直接写回省份 Markdown 的策略。
- 已新增离线回归样本：`data/production-cards/ai-comic-drama-golden-regression-fixtures.json`。
- 已新增自动化测试：`mcp-server/__tests__/ai-comic-golden-cards-regression.test.ts`。
- 已抽样南京大屠杀、通道侗锦、武昌起义做 StoryBlueprint、5 场以内 `scene_breakdown`、`gears_segments` 和 Seedance prompt 回归。
- 目标测试通过：`npx vitest run __tests__/ai-comic-golden-cards-regression.test.ts`。
- 当前 10 条整体仍为 `pending_human_review`，3 条抽样样本可作为后续生产验证基线，尚未写回省份 Markdown。

验收标准：

- 每条至少能生成 5 场以内 AI 漫剧短片结构。
- 每条有明确第一格钩子、角色稳定标签、场景锚点和禁用断言。
- 生成结果不得把来源说明、核实方法和质量检测词写进观众稿。
- Seedance prompt 能区分基础设定、氛围画质、画面内容、单镜头测试和多分镜连续性。

### 7.2 非遗/工艺宣传片 10 条

优先字段：

- `official_catalog_or_resource_links`
- `materials`
- `tools`
- `process_steps`
- `hand_actions`
- `practitioner_or_transmission_line`
- `community_or_practitioner_consent`
- `documentation_assets`
- `visual_symbols`
- `sound_or_texture_details`
- `modern_connection`
- `production_risks`

候选条目：

- 常德丝弦——湘北水乡的扬琴说唱
- 岳阳巴陵戏——洞庭湖畔的古戏曲遗存
- 常德武陵戏——沅澧流域的湖南五大剧种之一
- 湘西苗医苗药——武陵山中的民族医药体系
- 桑植白族仗鼓舞——700年前迁徙白族的武舞合一
- 土家族摆手舞——湘西土家的集体仪式
- 湘昆——山野昆曲的南岭遗音
- 湖南花鼓戏——湖南人的戏
- 桑植民歌——长征路上的歌声与守望
- 湘剧——湖南戏曲的中州遗韵

截至 2026-07-09 的进展：

- 已新增结构化生产卡：`data/production-cards/heritage-promo-golden-cards.json`。
- 已新增审稿说明：`docs/production-cards/heritage-promo-golden-cards-20260709.md`。
- 10 条候选均已覆盖非遗/工艺宣传片 15 个必填字段。
- 每条均保留 `process_steps`、`hand_actions`、`community_or_practitioner_consent`、`production_risks`、`evidence_boundaries` 和不直接写回省份 Markdown 的策略。
- 已新增离线回归样本：`data/production-cards/heritage-promo-golden-regression-fixtures.json`。
- 已新增自动化测试：`mcp-server/__tests__/heritage-promo-golden-cards-regression.test.ts`。
- 已抽样常德丝弦、湘西苗医苗药做宣传片分镜、`gears_segments` 和质量报告回归。
- 目标测试通过：`npx vitest run __tests__/heritage-promo-golden-cards-regression.test.ts`。
- 当前 10 条整体仍为 `pending_human_review`，2 条抽样样本可作为非遗宣传片结构回归基线，尚未写回省份 Markdown。
- 下一步进入微纪录片 10 条黄金卡。

验收标准：

- 每条有 3 个以上可拍工序或动作。
- 每条有材料/工具/手部动作/声音质感/授权边界。
- 涉及传承人、谱系、项目级别和代表作时必须有来源或待核标注。
- 不公开推断危险操作教程、秘方比例或未授权工艺细节。

### 7.3 微纪录片 10 条

优先字段：

- `documentary_question`
- `real_world_site_or_object`
- `source_quotes_or_source_cues`
- `timeline`
- `witness_or_expert_roles`
- `interview_clip_selection`
- `field_notes`
- `b_roll_plan`
- `reconstruction_boundary`
- `present_day_trace`
- `ambient_sound`
- `what_must_not_be_claimed`

候选条目：

- 南京大屠杀——中华民族最深的伤痕
- 平江起义——从旧军队内部爆发的革命枪响
- 武昌起义——辛亥革命的第一声枪响
- 岳阳楼——先忧后乐的精神地标
- 桑植民歌——长征路上的歌声与守望
- 长沙窑铜官陶瓷烧制技艺——海上丝绸之路的釉下彩开创
- 湘西苗医苗药——武陵山中的民族医药体系
- 湘昆——山野昆曲的南岭遗音
- 土家族摆手舞——湘西土家的集体仪式
- 常德丝弦——湘北水乡的扬琴说唱

截至 2026-07-09 的进展：

- 已新增结构化生产卡：`data/production-cards/documentary-short-golden-cards.json`。
- 已新增审稿说明：`docs/production-cards/documentary-short-golden-cards-20260709.md`。
- 10 条候选均已覆盖微纪录片 12 个必填字段。
- 每条均保留 `real_world_site_or_object`、`source_quotes_or_source_cues`、`b_roll_plan`、`reconstruction_boundary`、`what_must_not_be_claimed`、`evidence_boundaries` 和不直接写回省份 Markdown 的策略。
- 已新增离线回归样本：`data/production-cards/documentary-short-golden-regression-fixtures.json`。
- 已新增自动化测试：`mcp-server/__tests__/documentary-short-golden-cards-regression.test.ts`。
- 已抽样岳阳楼、南京大屠杀做微纪录片分镜、`gears_segments` 和质量报告回归。
- 目标测试通过：`npx vitest run __tests__/documentary-short-golden-cards-regression.test.ts`。
- 当前 10 条整体仍为 `pending_human_review`，2 条抽样样本可作为微纪录片结构和敏感边界回归基线，尚未写回省份 Markdown。
- Phase 1 的 30 条黄金卡候选稿已经全部建立；下一步进入统一索引、审稿优先级和写回队列准备。

验收标准：

- 每条有现实入口、可拍现场、来源提示和再现边界。
- 每条明确哪些只能做示意或再现，不能写成真实影像。
- 每条有 B-roll 计划和当代痕迹。
- 对重大历史和创伤题材，必须保留严肃表达、来源边界和禁用戏剧化方式。

### 7.4 统一索引与审稿队列

截至 2026-07-09 的进展：

- 已新增统一索引：`data/production-cards/golden-card-unified-index.json`。
- 已新增审稿说明：`docs/production-cards/golden-card-unified-index-20260709.md`。
- 已新增自动化测试：`mcp-server/__tests__/golden-card-unified-index-regression.test.ts`。
- 30 条黄金卡已经全部进入统一索引。
- 风险分级已经建立：`p0` 4 条、`p1` 12 条、`p2` 14 条。
- 已合并 10 类补证任务，覆盖来源、授权、伦理、现场、版权、样本扩展和写回治理。
- 已汇总 9 条回归样本覆盖矩阵，AI 漫剧、非遗宣传、微纪录各 3 条。
- 已抽取并结构化 9 个 Phase 2 Domain Pack 规则候选。
- 当前仍未写回 `data/provinces/*.md`。

验收标准：

- 统一索引必须和 3 个源卡文件一一对应，不能遗漏或重复。
- 高风险卡必须有审稿通道、补证任务和写回治理任务。
- 回归样本必须指向真实卡 ID，并覆盖 `gears_segments` 和 `quality_report`。
- Phase 2 候选只能标记为候选，不得直接冒充正式 Domain Pack。

Phase 1 完成条件：

- 30 条黄金卡全部有候选稿。
- 30 条中至少 24 条通过人工审稿。
- 至少 18 条进入写回队列。
- 至少 9 条完成真实生成回归：AI 漫剧、非遗宣传、微纪录各 3 条。
- 重新运行 `kb:production-audit`、`kb:production-upgrade-plan`、`kb:lint`，报告未出现来源/地点/可信度倒退。

## 8. Phase 2：Domain Pack 高复用资产

目标：把单条素材中反复出现的影视生产规则沉淀为可复用资产。

截至 2026-07-09 的进展：

- 已新增候选规则包文件：`data/domain-packs/phase2-candidate-rule-packs.json`。
- 已新增候选规则包说明：`docs/production-cards/phase2-candidate-rule-packs-20260709.md`。
- 已新增自动化测试：`mcp-server/__tests__/phase2-domain-pack-candidates-regression.test.ts`。
- 9 个候选包均沿用正式 Domain Pack 的核心字段：`summary`、`keywords`、`asset_usage`、`production_prompts`、`review_boundaries`、`trigger_words`。
- 9 个候选包均标记为 `candidate_pending_domain_review`，尚未写入正式 `data/domain-packs/china-culture.json`。
- 已新增 P0/P1 审稿包与写回草案队列：`data/production-cards/p0-p1-review-and-writeback-queue.json`。
- 已新增审稿包说明：`docs/production-cards/p0-p1-review-and-writeback-queue-20260709.md`。
- 已新增自动化测试：`mcp-server/__tests__/p0-p1-review-and-writeback-queue.test.ts`。
- P0/P1 共 16 张高优先级卡已进入候选写回草案队列，但全部保持 `blocked_pending_human_review`。
- 已新增 P0/P1 来源证据包与写回草案模板：`data/production-cards/p0-p1-source-evidence-and-writeback-drafts.json`。
- 已新增模板说明：`docs/production-cards/p0-p1-source-evidence-and-writeback-drafts-20260710.md`。
- 已新增自动化测试：`mcp-server/__tests__/p0-p1-source-evidence-writeback-drafts.test.ts`。
- 16 条来源证据包模板、16 条写回 Markdown 模板和 4 条 P0 专项检查样例已经建立；全部仍为模板层，未正式写回。
- 已新增 P0/P1 审稿导出包：`data/production-cards/p0-p1-review-export-package.json`。
- 已新增 16 个审稿 Markdown 导出文件：`docs/production-cards/review-exports/20260710/*.md`。
- 已新增自动化测试：`mcp-server/__tests__/p0-p1-review-export-package.test.ts`。
- 2 条 P0 自动质量规则已接入创伤历史和医疗伦理专项样例；导出文件仍不是正式写回。
- 已新增 P0/P1 审稿导出质量索引：`data/production-cards/p0-p1-review-export-quality-index.json`。
- 已新增质量索引说明：`docs/production-cards/p0-p1-review-export-quality-index-20260710.md`。
- 已新增自动化测试：`mcp-server/__tests__/p0-p1-review-export-quality-index.test.ts`。
- 16 个审稿导出 Markdown 已补审稿核对清单，P0 条目增加专项安全检查项。
- P0 自动质量规则扩展为 4 条细分规则，覆盖创伤历史再现、虚构证词、医疗指导和患者隐私。
- 16 个导出文件已纳入 4 个人工审稿批次索引，但全部仍为待人工审稿状态。
- 已新增 P0/P1 审稿结果模拟与写回约束：`data/production-cards/p0-p1-review-simulation-and-writeback-constraints.json`。
- 已新增模拟与约束说明：`docs/production-cards/p0-p1-review-simulation-and-writeback-constraints-20260710.md`。
- 已新增自动化测试：`mcp-server/__tests__/p0-p1-review-simulation-writeback-constraints.test.ts`。
- 16 个 P0/P1 审稿导出已具备 `pass` / `repair` / `reject` 模拟结果，但这些结果不代表真实人工审稿通过。
- P1 已补 4 条质量规则，覆盖革命历史来源、民族社区授权、非遗表演权利和纪录片现场档案边界。
- `pass`、`repair`、`reject` 三类结果均建立写回草案字段约束，且当前均不允许直接写回。
- 已新增 P0/P1 审稿结果导出包与 Domain Pack 晋升预检：`data/production-cards/p0-p1-review-export-and-domain-pack-precheck.json`。
- 已新增预检说明：`docs/production-cards/p0-p1-review-export-and-domain-pack-precheck-20260710.md`。
- 已新增自动化测试：`mcp-server/__tests__/p0-p1-review-export-domain-pack-precheck.test.ts`。
- 16 个审稿模拟结果已导出为总览，拆分为 2 个 pass 候选、11 个 repair 任务和 3 个 reject 重取材任务。
- P0/P1 质量规则已映射到 9 个 Phase 2 候选 Domain Pack。
- 9 个候选 Domain Pack 均已建立晋升前检查清单，当前全部 blocked，不能正式晋升。
- 已新增 Domain Pack 人工审稿模板与 Patch 隔离索引：`data/production-cards/domain-pack-human-review-and-patch-isolation.json`。
- 已新增 Patch 隔离说明：`docs/production-cards/domain-pack-human-review-and-patch-isolation-20260710.md`。
- 已新增 9 个候选 Domain Pack 独立审稿模板：`docs/production-cards/domain-pack-review-template-*.md`。
- 已新增自动化测试：`mcp-server/__tests__/domain-pack-human-review-patch-isolation.test.ts`。
- 2 个 pass 候选已建立草案准备模板，但 `formal_patch_created=false`。
- 14 条 repair/reject 任务已建立 open 状态和负责人角色。
- 6 条正式 Patch 隔离规则已建立，继续禁止自动写入正式 Domain Pack。
- 已新增 Domain Pack 审稿输入证据槽位与决策台账：`data/production-cards/domain-pack-review-evidence-ledger.json`。
- 已新增证据台账说明：`docs/production-cards/domain-pack-review-evidence-ledger-20260710.md`。
- 已新增自动化测试：`mcp-server/__tests__/domain-pack-review-evidence-ledger.test.ts`。
- 9 个 Domain Pack 审稿 Markdown 已补证据附件槽位。
- 9 条真实人工审稿决策台账已建立，但全部仍为 `not_started`。
- 14 条 repair/reject 任务已映射到证据槽位和负责人角色。
- 2 个 pass 草案准备项已补真实审稿通过前的阻断门槛。
- 已新增 Domain Pack 审稿批次看板与人工填报入口：`data/production-cards/domain-pack-review-dashboard-and-intake.json`。
- 已新增人工填报 Markdown：`docs/production-cards/domain-pack-review-decision-intake-20260710.md`。
- 已新增自动化测试：`mcp-server/__tests__/domain-pack-review-dashboard-intake.test.ts`。
- 5 列看板已汇总待补证、待分配审稿人、待审稿决策、待修复/重取材和 pass 草案阻断。
- 9 条决策台账已建立填报状态和 10 项必填校验，当前仍全部为 `not_started`。
- 14 条 repair/reject 任务和 2 个 pass 阻断项已纳入人工填报入口，但仍不能正式写回。
- 已新增 Domain Pack 人工填报校验与候选通过模拟：`data/production-cards/domain-pack-review-intake-validation-and-pass-simulation.json`。
- 已新增校验模拟说明：`docs/production-cards/domain-pack-review-intake-validation-and-pass-simulation-20260710.md`。
- 已新增自动化测试：`mcp-server/__tests__/domain-pack-review-intake-validation-pass-simulation.test.ts`。
- 12 条填报校验规则已建立，覆盖候选 ID、审稿人、审稿角色、决策值、来源、事实边界、授权、样本、结论理由、人工 Patch 状态、真实签署和禁止自动正式 Patch。
- 9 条真实空白台账已生成 `blocked_blank_intake` 校验结果，真实通过数仍为 0。
- 5 个合法/非法填报模拟样例已建立，其中 1 个进入人工 Patch 候选模拟队列，1 个进入修复重提审模拟队列，均不创建正式 Patch。
- 已新增人工 Patch 候选导出与差异草案索引：`data/production-cards/domain-pack-manual-patch-export-and-diff-draft.json`。
- 已新增差异草案模板：`docs/production-cards/domain-pack-manual-patch-diff-draft-dp-craft-material-tool-process-20260710.md`。
- 已新增修复重提审补证任务模板：`docs/production-cards/domain-pack-repair-resubmission-task-dp-medical-heritage-privacy-boundary-20260710.md`。
- 已新增自动化测试：`mcp-server/__tests__/domain-pack-manual-patch-export-diff-draft.test.ts`。
- 1 个人工 Patch 候选模拟项已转成可人工复核导出包，但差异草案仍为 `diff_draft_applied=false`。
- 4 个签署占位和 8 条正式 Patch 前阻断检查已建立。
- 1 个修复重提审模拟项已转为可跟踪补证任务模板，但尚未重提审。
- 已新增正式 Patch 前预审矩阵与周节奏分派：`data/production-cards/domain-pack-formal-patch-preflight-matrix-and-weekly-dispatch.json`。
- 已新增分派说明：`docs/production-cards/domain-pack-formal-patch-preflight-matrix-weekly-dispatch-20260710.md`。
- 已新增自动化测试：`mcp-server/__tests__/domain-pack-formal-patch-preflight-matrix-weekly-dispatch.test.ts`。
- 8 项正式 Patch 前阻断检查已进入预审矩阵。
- 4 个签署占位已分派到事实/工艺流程、材料工具、授权和人工 Patch 复核角色，但仍未签署。
- audit / lint 门槛已分派给等待 Patch 请求的运行负责人。
- 7 项周节奏工作和 4 项 repair 补证风险已建立，但尚未真实执行。
- 已新增证据附件包清单冻结与签署催办看板：`data/production-cards/domain-pack-evidence-freeze-and-signature-reminder-board.json`。
- 已新增催办看板说明：`docs/production-cards/domain-pack-evidence-freeze-signature-reminder-board-20260710.md`。
- 已新增自动化测试：`mcp-server/__tests__/domain-pack-evidence-freeze-signature-reminder-board.test.ts`。
- 6 类必备证据附件槽位已冻结，覆盖来源目录、事实边界、授权或同意、样本验证、审稿人身份与角色、最终决策记录。
- 2 个证据附件包已建立，但附件文件仍未提交。
- 4 个签署分派已进入催办看板，真实负责人仍为 `[待指定]`，签署状态仍为 blank。
- 2 个 audit/lint 运行清单已建立，但状态仍为 `waiting_for_formal_patch`。
- 4 项 repair 补证跟进项已建立，但仍为 `open_pending_attachment`。
- 已新增签署反馈样例校验与审稿包锁版：`data/production-cards/domain-pack-signature-feedback-validation-and-review-lock.json`。
- 已新增锁版交接说明：`docs/production-cards/domain-pack-signature-feedback-review-lock-20260710.md`。
- 已新增自动化测试：`mcp-server/__tests__/domain-pack-signature-feedback-review-lock.test.ts`。
- 8 条签署反馈校验规则已建立，覆盖真实负责人、角色匹配、签署状态、附件提交、冻结槽位、正式 Patch 禁止、audit/lint 等待和省份库禁写。
- 5 个签署反馈模拟样例已建立，其中 2 个为格式合法样例、3 个为非法样例；全部仍为 `simulation_only`，不是真实签署。
- 2 个证据附件包已生成审稿包锁版清单，但锁版不等于附件提交或审批。
- 2 个附件缺失失败、4 个签署缺失失败和 4 个负责人缺失失败已建立索引。
- 2 个 audit/lint 运行清单已进入锁定等待状态，仍未运行。
- 已新增正式 Patch 前失败报告与人审交接包：`data/production-cards/domain-pack-formal-patch-failure-report-and-human-handoff.json`。
- 已新增可打印交接说明：`docs/production-cards/domain-pack-formal-patch-failure-human-handoff-20260710.md`。
- 已新增自动化测试：`mcp-server/__tests__/domain-pack-formal-patch-failure-human-handoff.test.ts`。
- 10 条来源失败记录与 2 条 audit/lint 等待项已汇总为附件、签署、负责人、后置检查 4 个阻断组。
- 2 个锁版审稿包已转为真实人审交接包，并分别生成可打印审稿单，但交接包不等于正式审批，打印单不等于真实签署。
- 5 步人工执行顺序已建立；真实负责人、真实附件、真实决定和正式 Patch 后检查仍待外部执行。
- 已新增真实审稿人填报字段冻结与外部执行清单：`data/production-cards/domain-pack-real-reviewer-intake-field-freeze-and-external-execution-checklist.json`。
- 已新增外部执行说明：`docs/production-cards/domain-pack-real-reviewer-intake-field-freeze-external-execution-checklist-20260710.md`。
- 已新增自动化测试：`mcp-server/__tests__/domain-pack-real-reviewer-intake-external-execution.test.ts`。
- 16 个真实审稿人填报字段和 11 条校验规则已冻结，覆盖真实身份、角色、决定、理由、附件、时间、签署记录和正式 Patch 请求隔离。
- 2 个人审包已拆为 8 份角色级空白填报实例，当前全部为 `blocked_blank_external_intake`，有效真实提交数仍为 0。
- 负责人指定、附件提交、审稿签署和 Patch 后检查已整理为 4 条工作流、16 项外部任务，当前仍为 open 或 blocked。
- 已新增真实人审回填校验夹具与签署前预检：`data/production-cards/domain-pack-real-reviewer-submission-validation-fixtures-and-pre-signature-preflight.json`。
- 已新增签署前预检说明：`docs/production-cards/domain-pack-real-reviewer-submission-validation-pre-signature-preflight-20260710.md`。
- 已新增自动化测试：`mcp-server/__tests__/domain-pack-real-reviewer-submission-validation-preflight.test.ts`。
- 已建立 3 个格式合法模拟夹具和 11 个定点非法夹具，完整覆盖 11 条填报校验规则。
- 已建立 12 项签署前预检和 14 条夹具预检结果；真实身份、附件、签署记录和模拟夹具隔离仍使可通过数保持 0。
- 已汇总 5 类失败原因；模拟引用、模拟身份和模拟签署均不能进入真实提交。
- 已新增真实提交导入契约与外部记录解析清单：`data/production-cards/domain-pack-real-submission-import-contract-and-external-record-resolution.json`。
- 已新增导入与解析说明：`docs/production-cards/domain-pack-real-submission-import-contract-external-record-resolution-20260710.md`。
- 已新增自动化测试：`mcp-server/__tests__/domain-pack-real-submission-import-contract.test.ts`。
- 已定义 24 字段真实提交导入信封、14 条入口校验和 4 条模拟数据拒绝规则。
- 上一轮全部 14 个 fixture ID 已进入真实入口显式拒绝列表，`SIMULATION` 引用、结构校验占位和 simulation 元数据均禁止导入。
- 已建立 5 类外部记录解析器契约、10 项解析清单和 8 条角色级导入路由；真实导入和解析结果仍为 0。
- 已新增确定性导入校验器：`mcp-server/src/lib/real-submission-import-validator.ts`。
- 已新增校验器拒绝夹具：`data/production-cards/domain-pack-real-submission-import-validator-rejection-fixtures.json`。
- 已新增拒绝报告说明：`docs/production-cards/domain-pack-real-submission-import-validator-rejection-report-20260710.md`。
- 已新增自动化测试：`mcp-server/__tests__/domain-pack-real-submission-import-validator.test.ts`。
- 校验器已覆盖 24 字段完整性、版本、来源元数据、冻结路由、决定值域、六类附件、时间、Patch 隔离和提交者声明。
- 已建立 2 个本地格式通过但外部解析待办仍为 9/10 项的场景，以及 4 类模拟数据拒绝报告场景。
- 已新增外部记录解析编排器：`mcp-server/src/lib/real-submission-external-record-orchestrator.ts`。
- 已新增编排器测试夹具：`data/production-cards/domain-pack-external-record-resolution-orchestrator-fixtures.json`。
- 已新增编排说明：`docs/production-cards/domain-pack-external-record-resolution-orchestrator-20260710.md`。
- 已新增自动化测试：`mcp-server/__tests__/domain-pack-external-record-resolution-orchestrator.test.ts`。
- 已定义 5 类外部记录解析适配器接口并实现 10 项解析状态编排。
- unresolved、failed、resolved_as_simulation 三类状态已覆盖；测试适配器伪称 resolved_real 时会被强制降级。
- 已新增真实适配器安全注册表：`mcp-server/src/lib/real-submission-external-adapter-registry.ts`。
- 已新增配置与门槛数据：`data/production-cards/domain-pack-real-external-adapter-config-registry-and-enable-gates.json`。
- 已新增安全启用说明：`docs/production-cards/domain-pack-real-external-adapter-config-registry-enable-gates-20260710.md`。
- 已新增自动化测试：`mcp-server/__tests__/domain-pack-real-external-adapter-registry.test.ts`。
- 已定义 17 个配置字段、5 类默认禁用配置和 8 项安全启用门槛。
- endpoint、认证和审计只保存环境变量名称；秘密值、已启用配置、运行时注册和真实连接数均为 0。

优先包：

- 非遗流程生产包：材料、工具、工序、手部动作、授权边界。
- 纪录片来源包：现实现场、来源线索、再现边界、采访角色。
- AI 漫剧分镜包：关键帧、表情节拍、连续性验收。
- 朝代服饰与器物包：时代称谓、服装、道具、建筑陈设和不可混用项。
- 讲解知识结构包：核心问题、知识层级、例子、图示字幕、误区边界。
- 儿童改写安全包：年龄分层、善意张力、恐怖/暴力弱化、教师提示。
- 短视频钩子包：三秒问题、反差、节奏点、评论互动、事实边界卡。
- 宣讲培训结构包：主讲人定位、论点、案例、练习、复盘和行动转化。

验收标准：

- 每个包有可读 `summary`、`production_prompts`、`review_boundaries` 和触发词。
- 每个包至少被 3 个真实条目或 3 个项目调用验证。
- 不把具体作品、具体剧情和未授权样片内容写入 Domain Pack。

## 9. Phase 3：多片型稳定产出矩阵

目标：让 8 个高频片型都能从素材库稳定拿到可生产字段。

片型优先级：

1. `ai_comic_drama`
2. `heritage_promo`
3. `documentary_short`
4. `explainer_video`
5. `social_short`
6. `lecture_video`
7. `education_training`
8. `children_story`

验收标准：

- 每个片型至少有 20 条条目级生产素材卡。
- 每个片型至少有 5 个可作为回归样本的生成项目。
- `production_material_readiness` 对缺口字段的判断准确，不把 `missing_needs` 当证据。
- 质量报告能给出片型相关的补库动作，而不是泛泛提示素材不足。

## 10. Phase 4：全国题材覆盖

目标：从湖南强库扩展为全国可用的影视题材网络。

扩库策略：

- 不平均补省份，先按业务场景补。
- 每省先做 3-5 个高价值影视题材：一个代表性非遗、一个历史/红色地点、一个地方传说或人物、一个名胜古迹或城市空间。
- 对高风险历史事件，先补来源和边界，再补镜头化表达。
- 对非遗和民俗，先补官方名录、工序动作、可拍空间和授权边界。

阶段目标：

- 全国 34 个省份都有至少 5 条可生产素材。
- 每个核心类型至少 30 条可生产素材。
- 建立跨省版本差异关系：同一故事、同类非遗、同类历史记忆不混写。

验收标准：

- 新增条目全部遵守来源等级、核实方法和待核点。
- 不出现 `[object Object]`、`undefined` 等导入残留。
- 每批扩库后必须跑 audit 和 lint。

## 11. Phase 5：项目反馈到素材库闭环

目标：让真实项目越做越强，项目缺口能沉淀为底库能力。

标准流程：

```text
项目生成
  -> production_material_missing_field
  -> 字段级补充
  -> knowledge_candidate_markdown
  -> 人工审稿
  -> knowledge_writeback_draft_markdown
  -> 写回队列
  -> 人工 Patch
  -> audit / lint
```

验收标准：

- 所有项目补充任务都有来源或明确待核边界。
- 只有 `approved` 候选稿能进入写回队列。
- 写回队列导出包保留 `province_markdown_written=false`。
- 每次正式写回后，报告能看到缺口数量下降。
- 审稿导出文件必须有来源、事实边界、授权、写回范围和生成内容排除的核对清单。
- 模拟 `pass` 只能表示候选草案准备，不等同于真实人工审稿通过。
- `repair` 和 `reject` 必须保留下一步任务或阻断原因，不能生成正式写回草案。
- repair / reject 任务必须可追踪，且不能绕过真实人工审稿进入正式写回草案。
- pass 草案准备模板也必须保持 `formal_patch_created=false`，真实审稿通过前不能生成正式 Patch。
- 空白决策台账不得视为人工审稿通过；必须有证据槽位、审稿角色和最终决策记录。
- 人工填报入口不得视为正式审批；必填字段未齐、审稿人未签署或人工 Patch 未请求时，仍不得写回。
- 模拟填报通过不得视为真实人工审稿通过；人工 Patch 候选模拟队列不得视为正式 Patch。
- 差异草案模板不得视为正式 Patch；签署占位为空、证据附件未提交、audit/lint 未跑时不得应用。
- 预审矩阵不得视为正式审批；周节奏分派不得视为签署。
- 证据附件冻结不得视为附件已提交；签署催办不得视为真实签署；audit/lint 运行清单不得视为运行结果。
- 签署反馈样例不得视为真实签署；审稿包锁版不得视为附件提交或审批。
- 正式 Patch 前失败报告不得视为 Patch 请求；人审交接包不得视为正式审批；可打印审稿单不得视为真实签署。
- 角色级填报模板不得视为真实提交或签署；外部执行清单不得视为负责人指派、附件提交或 audit/lint 运行结果。
- 格式合法模拟夹具不得视为真实提交；签署前预检不得视为正式审批；模拟附件和签署引用不得进入真实记录。
- 真实提交导入契约不得视为已导入提交；空白导入路由不得视为真实记录；解析器契约和解析清单不得视为外部记录已解析。
- 本地校验通过不得视为真实导入完成；导入校验器不得返回真实签署状态，也不得替代外部身份、附件、签署或授权解析。
- 测试解析适配器不得视为真实外部系统；resolved_as_simulation 不得视为真实记录；编排器结果不得自动转成真实导入或签署。
- 环境变量名称引用不得视为已读取凭据；manual_registration_eligible 不得视为适配器已启用；静态配置不得直接注册运行时适配器。

## 12. Phase 6：评测样本与成片验收

目标：用真实样本证明素材库能稳定支撑影视产出。

样本矩阵：

- AI 漫剧：10 个单片样本，3 个系列样本。
- 非遗宣传：10 个短片样本。
- 微纪录：10 个短片样本。
- 知识讲解：10 个讲解样本。
- 竖屏短视频：10 个 60-90 秒样本。
- 教育培训/儿童故事：各 5 个样本。

验收标准：

- 每个样本保存 StoryBlueprint、full_text、scene_breakdown、gears_segments、quality report、Production Board。
- 抽检 visual prompt，不含来源说明、质量标签和内部分析词。
- 抽检事实边界，不把传说、再现、纪念空间写成确证史实。
- 能导出 GEARS/Seedance 交付包。

## 13. Phase 7：规模化运营与协作

目标：把素材库建设变成可持续运营流程。

运营节奏：

- 每周一：跑 audit、upgrade plan、MVP status。
- 每周二至周四：处理 10-20 条补库候选。
- 每周五：审稿、写回队列、lint、生成样本回归。
- 每两周：更新黄金样本、复盘字段缺口。
- 每月：新增一个片型或一个题材专题包。

验收标准：

- 有固定进度报告。
- 有写回批次和审稿记录。
- 有回归样本和失败样本库。
- 素材库规模增长时，生成质量不下降。

截至 2026-07-10 的进展：

- 已建立 4 个人工审稿批次索引，覆盖 4 个 P0 和 12 个 P1 审稿导出文件。
- 批次仍为 `pending_human_review`，尚未替代正式审稿记录。
- 已建立批次机器门槛：决策完整、禁止直接写回、通过项仍需真实审稿、修复项有下一步、驳回项有阻断原因。
- 已建立 Domain Pack 晋升预检门槛：9 个候选包全部 blocked，未审稿规则包不得写入正式 `china-culture.json`。
- 已建立 Patch 隔离规则：审稿模板、草案准备和任务状态都不能自动改正式库。
- 已建立空白决策台账和证据槽位。
- 已建立审稿批次看板，集中显示待补证、待分配审稿人、待审稿决策、待修复/重取材和 pass 草案阻断。
- 已建立人工填报表和必填校验入口。
- 已建立填报校验结果结构、合法/非法模拟样例、人工 Patch 候选模拟队列和修复重提审模拟队列。
- 已建立人工 Patch 候选导出包、差异草案模板、签署占位、正式 Patch 前检查和修复补证任务模板。
- 已建立正式 Patch 前预审矩阵、签署分派、audit/lint 分派、周节奏台账和 repair 补证风险台账。
- 已建立证据附件冻结清单、签署催办看板、audit/lint 正式 Patch 后运行清单和 repair 补证附件跟进。
- 已建立签署反馈合法/非法样例、审稿包锁版清单、失败原因索引和 audit/lint 锁定等待状态。
- 已建立正式 Patch 前失败报告、4 类阻断摘要、2 个人审交接包、2 张可打印审稿单和 5 步人工执行顺序。
- 已冻结 16 个真实审稿人填报字段和 11 条校验规则，并建立 8 份角色级空白填报实例、4 条外部工作流和 16 项外部执行任务。
- 已建立 14 个回填校验夹具、11 条规则全覆盖、12 项签署前预检和 5 类失败原因汇总，所有预检结果仍为 blocked。
- 已建立 24 字段真实提交导入契约、14 条入口规则、4 条模拟数据拒绝规则、5 类解析器契约、10 项解析清单和 8 条角色路由。
- 已实现确定性导入校验器，建立 2 个格式通过待解析场景和 4 个模拟数据拒绝场景，并保持真实导入、签署、Patch 状态为 0。
- 已实现 5 类外部记录解析适配器接口和 10 项状态编排器，覆盖未解析、失败、模拟解析和本地校验短路。
- 已建立 5 类真实适配器默认禁用注册表和 8 项安全门槛，禁止原始秘密值和静态运行时注册。
- 真实人工审稿、真实签署、附件提交、周节奏执行和正式写回仍待推进。

## 14. 开发边界

必须坚持：

- 不把生成故事直接写入 `data/provinces/*.md`。
- 不把未核实内容改写成事实。
- 不把样片具体剧情、台词、角色、作者风格写入素材库。
- 不把所有片型字段硬塞进省份 Markdown。
- 不把真实媒体执行器继续堆进本仓库；真实图片、视频、字幕、混音、装配仍交给 GEARS/Seedance 执行层。
- 类型规则继续集中在 `GenreStoryProfile`、ProductionMaterialPack 和 Domain Pack，不分散复制到 UI、prompt、fallback 和测试里。

## 15. 近期四个迭代

### Iteration 1：蓝图与状态口径

目标：

- 建立本文档。
- 建立机器可读状态文件。
- 确定 Phase 1 的 30 条黄金卡清单。

本轮进度口径：建立长期进度基线，总进度标定为 18%。不把文档规划误计为生产素材卡完成度。

### Iteration 2：AI 漫剧黄金卡 10 条

目标：

- 为 10 条候选补齐 AI 漫剧生产字段。
- 生成候选稿并进入审稿队列。
- 至少 3 条跑生成回归。

预期总进度：20% -> 25%

### Iteration 3：非遗宣传黄金卡 10 条

目标：

- 为 10 条非遗/工艺候选补齐流程、动作、授权、视觉和风险字段。
- 至少 3 条跑宣传片生成回归。

预期总进度：25% -> 30%

### Iteration 4：微纪录黄金卡 10 条

目标：

- 为 10 条微纪录候选补齐现场、来源、B-roll、再现边界和不可声称事项。
- 至少 3 条跑微纪录生成回归。

预期总进度：30% -> 35%

### Iteration 6：黄金卡统一索引与审稿队列

目标：

- 生成 30 条黄金卡统一索引。
- 标记高风险审稿优先级和补证任务。
- 汇总 7 条回归样本覆盖矩阵。
- 为 Phase 2 Domain Pack 抽取可复用规则候选。

实际总进度：35% -> 38%

### Iteration 7：回归样本补足与 Phase 2 候选结构化

目标：

- 回归样本从 7 条提升到至少 9 条。
- AI 漫剧、非遗宣传、微纪录各至少 3 条样本。
- 将 8 个 Phase 2 规则候选转为候选 Domain Pack 结构，后续 Iteration 8 补齐医疗隐私候选包后为 9 个。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：38% -> 41%

### Iteration 8：P0/P1 审稿包与写回草案队列准备

目标：

- 生成 P0/P1 人工审稿包。
- 为可写回字段生成候选写回草案清单。
- 为 9 个候选 Domain Pack 标记首批审稿问题。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：41% -> 44%

### Iteration 9：P0/P1 来源证据包与写回草案模板

目标：

- 为 P0/P1 审稿项补来源证据包模板。
- 为 16 条候选写回队列生成首批可审 Markdown 草案模板。
- 扩展 P0 医疗伦理和创伤历史专门检查样例。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：44% -> 47%

### Iteration 10：P0/P1 来源占位补证与可导出审稿 Markdown

目标：

- 为 P0/P1 证据包补首批来源占位和授权占位。
- 将 16 条模板拆成可导出的审稿 Markdown 文件。
- 为 P0 专项检查样例接入自动化质量规则。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：47% -> 50%

### Iteration 11：P0/P1 审稿导出质量规则与证据占位补强

目标：

- 为 16 个导出 Markdown 增加审稿核对清单。
- 扩展 P0 自动质量规则到更多触发词和修复建议。
- 生成导出包总览和人工审稿批次索引。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：50% -> 53%

完成：

- 为 16 个导出 Markdown 增加审稿核对清单。
- 新增导出质量索引和导出包总览。
- 扩展 P0 自动质量规则到 4 条细分规则，并补充 14 条修复建议。
- 建立 4 个人工审稿批次索引。
- 继续保持不直接写回 `data/provinces/*.md`。

### Iteration 12：P0/P1 人工审稿结果模拟与写回草案约束

目标：

- 生成一套不触碰省份库的人工审稿结果模拟结构。
- 为通过项和驳回项分别建立写回草案字段约束。
- 补充 P1 历史事件、民族社区和非遗授权的质量规则。
- 让审稿批次具备 `pass` / `repair` / `reject` 的机器可测门槛。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：53% -> 56%

完成：

- 新增一套不触碰省份库的人工审稿结果模拟结构。
- 为 16 个审稿导出建立 `pass` / `repair` / `reject` 模拟结果。
- 为通过项、修复项和驳回项分别建立写回草案字段约束。
- 补充 P1 历史事件、民族社区、非遗授权和纪录片档案质量规则。
- 让 4 个审稿批次具备机器可测门槛。
- 继续保持不直接写回 `data/provinces/*.md`。

### Iteration 13：P0/P1 审稿结果导出包与 Domain Pack 晋升预检

目标：

- 生成审稿结果导出包总览和 repair / reject 任务队列。
- 将 P0/P1 质量规则映射到 9 个 Phase 2 候选 Domain Pack。
- 为候选 Domain Pack 建立晋升前检查清单。
- 补充机器测试确保未审稿规则包不会写入正式 `data/domain-packs/china-culture.json`。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：56% -> 59%

完成：

- 生成 16 个审稿模拟结果的导出包总览。
- 拆出 2 个 pass 候选、11 个 repair 任务和 3 个 reject 重取材任务。
- 将 P0/P1 质量规则映射到 9 个 Phase 2 候选 Domain Pack。
- 为 9 个候选 Domain Pack 建立晋升前检查清单。
- 机器测试确认未审稿规则包不会写入正式 `data/domain-packs/china-culture.json`。
- 继续保持不直接写回 `data/provinces/*.md`。

### Iteration 14：Domain Pack 人工审稿模板与正式 Patch 隔离

目标：

- 为 9 个候选 Domain Pack 生成独立人工审稿模板。
- 为 pass 候选建立正式写回草案准备模板，但不生成正式 Patch。
- 为 repair / reject 任务建立可追踪处理状态。
- 补充机器测试确保正式 `data/domain-packs/china-culture.json` 仍不被自动改写。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：59% -> 62%

完成：

- 为 9 个候选 Domain Pack 生成独立人工审稿模板。
- 新增 9 份 Domain Pack 审稿 Markdown。
- 为 2 个 pass 候选建立正式写回草案准备模板，但不生成正式 Patch。
- 为 11 个 repair 和 3 个 reject 任务建立可追踪 open 状态。
- 补充机器测试确保正式 `data/domain-packs/china-culture.json` 仍不被自动改写。
- 继续保持不直接写回 `data/provinces/*.md`。

### Iteration 15：Domain Pack 审稿输入证据槽位与决策台账

目标：

- 为 9 个 Domain Pack 审稿模板补证据附件槽位。
- 建立真实人工审稿决策台账的空白结构。
- 把 14 条 repair / reject 任务映射到证据槽位和负责人角色。
- 为 2 个 pass 草案准备项补真实审稿通过前的阻断门槛。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：62% -> 65%

完成：

- 为 9 个 Domain Pack 审稿模板补证据附件槽位。
- 建立真实人工审稿决策台账的空白结构。
- 把 14 条 repair / reject 任务映射到证据槽位和负责人角色。
- 为 2 个 pass 草案准备项补真实审稿通过前的阻断门槛。
- 继续保持不直接写回 `data/provinces/*.md`。

### Iteration 16：审稿批次看板与人工填报入口

目标：

- 建立审稿批次看板 JSON，汇总待补证、待审稿、待重取材和 pass 阻断。
- 生成可人工填报的决策表 Markdown。
- 为 9 条空白决策台账建立填报状态和必填校验。
- 继续保持填报入口不等于正式写回或正式晋升。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：65% -> 68%

完成：

- 建立审稿批次看板 JSON，汇总待补证、待分配审稿人、待审稿决策、待重取材和 pass 阻断。
- 生成可人工填报的决策表 Markdown。
- 为 9 条空白决策台账建立填报状态和 10 项必填校验。
- 将 14 条 repair / reject 任务和 2 个 pass 阻断项纳入人工填报入口。
- 继续保持填报入口不等于正式写回或正式晋升。
- 继续保持不直接写回 `data/provinces/*.md`。

### Iteration 17：人工填报校验与候选通过模拟

目标：

- 建立机器可读的填报校验结果结构。
- 模拟合法/非法填报样例并明确失败原因。
- 将可通过项转入人工 Patch 候选清单但不创建正式 Patch。
- 继续保持模拟通过不等于正式写回或正式晋升。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：68% -> 71%

完成：

- 建立机器可读的填报校验结果结构。
- 建立 12 条填报校验规则。
- 为 9 条真实空白台账生成 `blocked_blank_intake` 校验结果。
- 模拟 2 个合法填报样例和 3 个非法填报样例，并明确失败原因。
- 将 1 个可通过样例转入人工 Patch 候选模拟队列但不创建正式 Patch。
- 将 1 个 repair 样例转入修复重提审模拟队列。
- 继续保持模拟通过不等于正式写回或正式晋升。
- 继续保持不直接写回 `data/provinces/*.md`。

### Iteration 18：人工 Patch 候选导出与差异草案模板

目标：

- 生成可人工复核的 Patch 差异草案模板但不应用 Patch。
- 为人工 Patch 候选项建立导出包和签署占位。
- 把修复重提审项转为可跟踪的补证任务模板。
- 继续保持 Patch 草案不等于正式写入。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：71% -> 74%

完成：

- 生成可人工复核的 Patch 差异草案模板但不应用 Patch。
- 为人工 Patch 候选项建立导出包和签署占位。
- 把修复重提审项转为可跟踪的补证任务模板。
- 建立 8 条正式 Patch 前阻断检查，包括真实人工审稿、证据附件、去重合并、人工复核、显式 Patch 请求、audit、lint 和省份库禁写。
- 继续保持 Patch 草案不等于正式写入。
- 继续保持不直接写回 `data/provinces/*.md`。

### Iteration 19：正式 Patch 应用前预审矩阵与周节奏分派

目标：

- 建立正式 Patch 应用前预审矩阵。
- 把签署占位分派到事实、授权、Patch 复核和 audit/lint 负责人。
- 为补证任务建立周节奏状态和到期风险。
- 继续保持预审矩阵不等于正式写入。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：74% -> 77%

完成：

- 建立正式 Patch 应用前预审矩阵。
- 把签署占位分派到事实/工艺流程、材料工具、授权和人工 Patch 复核角色。
- 把 audit / lint 门槛分派到等待正式 Patch 请求的运行负责人。
- 为补证任务建立周节奏状态和到期风险。
- 继续保持预审矩阵不等于正式写入。
- 继续保持不直接写回 `data/provinces/*.md`。

### Iteration 20：证据附件包清单冻结与签署催办看板

目标：

- 建立证据附件包清单并冻结必备附件槽位。
- 为 4 个签署分派生成催办看板和真实负责人占位。
- 为 audit/lint 分派建立正式 Patch 后运行清单。
- 继续保持催办看板不等于真实签署或正式写入。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：77% -> 80%

完成：

- 建立证据附件包清单并冻结必备附件槽位。
- 为 4 个签署分派生成催办看板和真实负责人占位。
- 为 audit/lint 分派建立正式 Patch 后运行清单。
- 为 4 项 repair 补证风险建立附件跟进项。
- 继续保持催办看板不等于真实签署或正式写入。
- 继续保持不直接写回 `data/provinces/*.md`。

### Iteration 21：签署反馈样例校验与审稿包锁版

目标：

- 建立签署反馈合法/非法样例校验结构。
- 为 2 个证据附件包生成审稿包锁版清单。
- 标记附件缺失、签署缺失和负责人缺失的失败原因。
- 继续保持签署反馈样例不等于真实签署或正式写入。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：80% -> 83%

完成：

- 建立 8 条签署反馈校验规则，覆盖真实负责人、角色匹配、签署状态、附件提交、冻结槽位、正式 Patch 禁止、audit/lint 等待和省份库禁写。
- 建立 5 个签署反馈模拟样例，其中 2 个格式合法、3 个非法并标记失败规则。
- 为 2 个证据附件包生成审稿包锁版清单。
- 标记 2 个附件缺失失败、4 个签署缺失失败和 4 个负责人缺失失败。
- 锁定 2 个 audit/lint 运行清单为 `waiting_for_formal_patch`。
- 继续保持签署反馈样例不等于真实签署或正式写入。
- 继续保持审稿包锁版不等于附件提交或审批。
- 继续保持不直接写回 `data/provinces/*.md`。

### Iteration 22：正式 Patch 前失败报告与人审交接包

目标：

- 生成正式 Patch 前失败报告。
- 为真实审稿人交接准备可打印/可审核包。
- 汇总尚缺负责人、附件、签署、audit/lint 的阻断状态。
- 继续保持交接包不等于正式写入。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：83% -> 86%

完成：

- 建立包含 12 项阻断的正式 Patch 前失败报告：2 个附件缺失、4 个签署缺失、4 个负责人缺失和 2 个 audit/lint 等待项。
- 将失败项汇总为附件、签署、负责人和后置检查 4 个阻断组。
- 为工艺材料工具流程候选和民族医药隐私边界修复候选分别建立人审交接包。
- 建立 2 张可打印审稿单，冻结附件、角色、决定、理由、日期和签署记录引用字段。
- 建立 5 步真实人工执行清单。
- 继续保持失败报告不等于 Patch 请求、交接包不等于正式审批、打印单不等于真实签署。
- 继续保持正式 Domain Pack 和 `data/provinces/*.md` 未被写入。

### Iteration 23：真实审稿人填报字段冻结与外部执行清单

目标：

- 冻结真实审稿人姓名或小组、角色、决定、理由、签署时间和记录引用字段。
- 为附件提交、真实签署和正式 Patch 后 audit/lint 建立最小外部执行清单。
- 建立可校验的空白填报实例且保持未签署状态。
- 继续保持填报模板和执行清单不等于正式审批或正式 Patch。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：86% -> 89%

完成：

- 冻结 16 个真实审稿人填报字段，其中 14 个无条件必填、1 个条件必填、1 个可选。
- 建立 11 条校验规则，覆盖来源 ID、真实身份、角色、决定、理由、附件、带时区时间、签署记录和正式 Patch 请求隔离。
- 为人工 Patch 候选和修复重提审候选建立 8 份按角色分配的空白填报实例。
- 将 4 个负责人指定、2 个附件提交、8 个审稿签署提交和 2 个 Patch 后检查整理为 16 项外部任务。
- 保持所有实例为 `blocked_blank_external_intake`，有效真实审稿提交数仍为 0。
- 继续保持填报模板不等于真实提交或签署，外部执行清单不等于执行结果。
- 继续保持正式 Domain Pack 和 `data/provinces/*.md` 未被写入。

### Iteration 24：真实人审回填校验夹具与签署前预检

目标：

- 建立合法与非法外部回填校验夹具并保持 `simulation_only`。
- 验证角色、决定、附件、带时区时间、签署记录和 Patch 请求隔离。
- 生成签署前预检与失败原因汇总。
- 继续保持校验夹具不等于真实审稿提交或真实签署。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：89% -> 92%

完成：

- 建立 3 组模拟附件引用集，其中 2 组结构完整、1 组故意缺少最终决策记录。
- 建立 3 个格式合法但不可作为真实提交的模拟夹具。
- 建立 11 个定点非法夹具，完整覆盖 11 条真实审稿人填报校验规则。
- 建立 12 项签署前预检，并为全部 14 个夹具生成预检结果。
- 汇总确定性规则失败、真实身份未核验、附件未核验、签署未核验和模拟夹具禁晋升 5 类失败原因。
- 保持 `pre_signature_ready`、真实审稿提交、真实签署和正式 Patch 数量全部为 0。
- 继续保持正式 Domain Pack 和 `data/provinces/*.md` 未被写入。

### Iteration 25：真实提交导入契约与外部记录解析清单

目标：

- 定义独立于模拟夹具的真实提交导入信封。
- 要求真实身份、附件、签署和 Patch 请求记录均可解析。
- 显式拒绝 `SIMULATION` 引用和 fixture ID 进入真实提交。
- 继续保持导入契约不等于已经导入真实提交。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：92% -> 94%

完成：

- 定义 24 字段真实提交导入信封，其中 23 个无条件必填、1 个条件必填。
- 建立 14 条入口校验和 4 条模拟数据拒绝规则。
- 将上一轮全部 14 个 fixture ID 纳入真实提交显式拒绝列表。
- 建立外部提交、真实身份、附件或豁免、签署、正式 Patch 请求 5 类解析器契约。
- 建立 10 项外部记录解析清单和 8 条角色级导入路由。
- 保持真实提交导入数、已解析外部记录数、真实签署数和正式 Patch 数全部为 0。
- 继续保持正式 Domain Pack 和 `data/provinces/*.md` 未被写入。

### Iteration 26：导入信封校验器与拒绝报告夹具

目标：

- 实现 24 字段导入信封的确定性本地校验。
- 为 fixture、`SIMULATION` 引用、占位值和 simulation_only 元数据生成拒绝报告。
- 区分本地格式通过与外部记录仍未解析。
- 继续保持校验通过不等于真实导入完成或真实签署。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：94% -> 96%

完成：

- 实现 `mcp-server/src/lib/real-submission-import-validator.ts` 确定性校验器。
- 校验 24 字段完整性、合同版本、带时区时间、来源元数据、幂等键、SHA-256、冻结路由、决定值域、六类附件和提交者声明。
- 建立 2 个本地格式通过场景，分别保留 9 项和 10 项外部解析待办。
- 建立 fixture ID、`SIMULATION` 引用、结构占位和 simulation 元数据 4 类拒绝报告场景。
- 校验器输出结构化字段错误、失败规则、拒绝原因和外部解析待办。
- 保持所有校验器结果的真实导入、签署、Patch 和正式写入状态为 false。
- TypeScript 构建和目标回归通过。

### Iteration 27：外部记录解析适配器接口与编排器

目标：

- 定义 5 类外部记录解析适配器接口。
- 实现 10 项解析检查的状态编排。
- 区分 unresolved、failed、resolved_as_simulation 三类测试状态。
- 继续保持测试适配器结果不等于真实外部记录解析。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：96% -> 97%

完成：

- 定义外部提交、审稿人身份、附件或豁免、签署、正式 Patch 请求 5 类解析适配器接口。
- 实现 10 项解析检查状态编排器。
- 覆盖 unresolved、failed、resolved_as_simulation 三类测试状态。
- 本地校验失败时短路，不调用任何适配器。
- 缺失适配器转 unresolved，适配器异常转结构化 failed。
- simulation 适配器伪称 resolved_real 时强制降级为 resolved_as_simulation。
- 保持真实适配器、真实解析、真实导入、真实签署和正式 Patch 数量全部为 0。

### Iteration 28：真实适配器配置契约与安全启用门槛

目标：

- 定义 5 类真实适配器配置字段和注册表。
- 所有真实适配器默认 `enabled=false`。
- 只允许环境变量名称引用凭据，不保存秘密值。
- 建立 endpoint、auth、health、audit 和人工启用门槛。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：97% -> 98%

完成：

- 定义 17 个真实适配器配置字段和 5 类默认禁用配置。
- 所有适配器保持 `enabled=false`、`runtime_adapter_registered=false`。
- endpoint、凭据和审计落点只保存 16 个环境变量名称引用，不读取值。
- 建立 config、endpoint、auth、health、audit、simulation isolation、human approval 和手工注册 8 项门槛。
- 实现默认禁用、非法配置、启用阻断和人工注册资格四类评估状态。
- 拒绝非法直连端点、原始秘密字段、静态运行时注册声明和 resolver 覆盖错误。
- 保持秘密值、运行时适配器、真实外部连接和正式 Patch 数量全部为 0。

### Iteration 29：真实适配器启用审批包与离线演练

目标：

- 为 5 类适配器生成独立人工启用审批包。
- 建立只记录 present/missing 而不读取值的环境变量快照契约。
- 建立健康检查、审计、模拟隔离和回滚离线演练清单。
- 继续保持审批包和演练结果不等于真实适配器启用。
- 继续保持不直接写回 `data/provinces/*.md`。

实际总进度：98% -> 99%

完成：

- 实现 `mcp-server/src/lib/real-submission-external-adapter-activation-drill.ts` 确定性激活前评估模块。
- 为 5 类默认禁用真实适配器生成 5 份独立人工激活审批包。
- 冻结 8 个审批字段和健康、审计、模拟隔离、回滚共 6 项离线演练。
- 建立只保存环境变量名称与 `present` / `missing` 状态的存在性快照，模块不访问 `process.env`，不读取值。
- 实现非法配置、环境引用缺失、演练缺失、人工批准缺失和可进入人工激活复核 5 类状态。
- 建立 4 个 `simulation_only` 回归场景，全部保持适配器未启用、未注册、未连接。
- 即使全部演练与模拟批准通过，也只输出 `ready_for_manual_activation_review`。
- TypeScript 构建、77 个测试文件共 338 项回归和知识库 lint 全部通过。
- 保持正式 Domain Pack 和 `data/provinces/*.md` 未被写入。

### Iteration 30：真实外部执行交接与 100% 完成门槛

目标：

- 汇总真实负责人、外部记录、审批、健康、审计、隔离和回滚执行的最终阻塞项。
- 将 5 份激活审批包和既有 16 项外部人工任务整理为可执行交接清单。
- 真实证据齐备前保持总进度 99%，不得将模拟场景计为完成。
- 真实执行完成后重新运行导入、解析、签署、正式 Patch 和 audit/lint 门槛。
- 只在人工审稿、真实记录解析和正式写回全部满足时评估 100%。
- 继续保持不直接写回 `data/provinces/*.md`。

预期总进度：99% -> 100%（仅在真实外部执行完成后）

## 16. 每次推进的汇报格式

每次开发推进后，必须向用户汇报：

- 当前阶段。
- 本轮完成内容。
- 阶段进度变化。
- 总进度变化。
- 验证命令与结果。
- 新增/修改文件。
- 下一步最小交付。
- 阻塞项。

示例：

```text
当前阶段：Phase 1 - 黄金生产素材卡
本轮推进：完成微纪录片 10 条黄金卡，并抽 2 条做分镜、GEARS 分段和质量报告回归
阶段进度：64% -> 88%
总进度：30% -> 35%
验证：目标 Vitest 通过；JSON 结构校验通过
下一步：30 条黄金卡统一索引、审稿优先级和写回队列准备
阻塞项：30 条黄金卡仍需人工审稿、来源补证、授权确认和写回决策
```
