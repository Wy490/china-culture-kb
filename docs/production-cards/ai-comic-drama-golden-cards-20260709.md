# AI 漫剧黄金生产素材卡审稿说明

更新时间：2026-07-09

对应数据文件：`data/production-cards/ai-comic-drama-golden-cards.json`

对应回归样本：`data/production-cards/ai-comic-drama-golden-regression-fixtures.json`

本轮交付是 Phase 1「黄金生产素材卡」的第一批可生产素材：AI 漫剧 10 条。它不是省份底库写回，而是介于知识库条目和 Story Agent 生成之间的生产中间层。

## 1. 本轮完成

已完成 10 条 AI 漫剧黄金素材卡：

| 序号 | 条目 | 省份 | 生产定位 | 审稿重点 |
|---:|---|---|---|---|
| 1 | 南京大屠杀——中华民族最深的伤痕 | 江苏 | 当代纪念馆证据守护剧 | 敏感历史、证据边界、禁猎奇 |
| 2 | 平江起义——从旧军队内部爆发的革命枪响 | 湖南 | 革命历史事件短剧 | 虚构传令兵不得写成史实 |
| 3 | 桑植白族仗鼓舞——700年前迁徙白族的武舞合一 | 湖南 | 非遗动作传承短剧 | 迁徙、套路、传承人需补证 |
| 4 | 通道侗锦——湘西南侗寨的指尖花雨 | 湖南 | 工艺传承与母女关系短剧 | 纹样含义、授权、族群符号 |
| 5 | 土家族摆手舞——湘西土家的集体仪式 | 湖南 | 集体仪式参与短剧 | 大小摆手、仪式细节、旅游化边界 |
| 6 | 武昌起义——辛亥革命的第一声枪响 | 湖北 | 起义前夜选择短剧 | 第一枪细节、多说法边界 |
| 7 | 湘昆——山野昆曲的南岭遗音 | 湖南 | 戏曲后台传承短剧 | 剧目、曲牌、古戏台和艺人信息 |
| 8 | 岳州扇——洞庭湖畔的文人雅扇 | 湖南 | 工艺审美短剧 | 名头夸张、名人题字、工艺归属 |
| 9 | 长沙窑铜官陶瓷烧制技艺——海上丝绸之路的釉下彩开创 | 湖南 | 考古工艺想象短剧 | “最早/第一”、黑石号数量、文物边界 |
| 10 | 常德丝弦——湘北水乡的扬琴说唱 | 湖南 | 曲艺录音传承短剧 | 歌词版权、曲谱、代表性传承人 |

## 2. 字段覆盖

每条素材卡均已覆盖 AI 漫剧片型的 17 个必填字段：

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
- `transition_plan`
- `ending_hook`
- `forbidden_claims`

额外补充了：

- `evidence_boundaries`：区分确证事实、合理戏剧化、虚构添加和禁用断言。
- `source_refs`：保留对既有知识库来源线索的引用。
- `writeback_policy`：明确不直接写回 `data/provinces/*.md`。

## 3. 当前验收状态

当前状态：`pending_human_review`，其中 3 条已通过本地生成回归。

已完成的回归：

- 南京大屠杀：已建立 StoryBlueprint、5 场分镜、GEARS 分段和 Seedance prompt 回归样本。
- 通道侗锦：已建立 StoryBlueprint、5 场分镜、GEARS 分段和 Seedance prompt 回归样本。
- 武昌起义：已建立 StoryBlueprint、5 场分镜、GEARS 分段和 Seedance prompt 回归样本。
- 自动化测试通过：`npx vitest run __tests__/ai-comic-golden-cards-regression.test.ts`。

仍不能直接标记为 `production_ready`。原因：

- 尚未对全部 10 条跑 StoryBlueprint、scene_breakdown、Seedance prompt 和 GEARS handoff。
- 多个非遗、戏曲、曲艺条目涉及传承人、授权、具体曲目、纹样含义和演出空间，需要补证。
- 南京大屠杀、武昌起义、平江起义等历史事件对表达边界要求高，生成稿必须经过敏感表达审稿。

## 4. 推荐下一步

下一轮最小交付建议：

1. 进入非遗/工艺宣传片 10 条黄金卡。
2. 每条补齐材料、工具、流程、手部动作、视觉符号、声音质感、授权边界和生产风险。
3. 抽 2 条非遗/工艺宣传片做分镜和质量报告回归。
4. AI 漫剧 10 条继续保持候选状态，等待人工审稿后再决定是否升级为 `reviewed_candidate`。

## 5. 长期价值

这批卡回答的是“素材库到底缺什么”的核心问题：

- 不是只缺更多百科资料。
- 真正缺的是能让影视作品稳定产出的角色、冲突、场景、镜头、参考资产、连续性检查和事实边界。
- 省份底库负责事实可信，生产卡负责把事实变成可创作素材，项目素材包负责承接具体成片任务。
