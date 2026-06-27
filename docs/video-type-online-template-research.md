# 成片类型联网模板研究

更新时间：2026-06-27

本文用于回答“能否根据成片类型自己上网找模板”。结论是可以，但要把外部模板转成项目内的生产素材包，标注适用类型和边界，再由 Story Agent 按 `video_type` 自动调用。

## 已确认的自动调用状态

- 三类模板已进入 `data/production-packs/video-type-material-supplement-packs.json`。
- `web/server/src/services/production-material-pack-service.ts` 会按 `video_type` 读取模板。
- `story-service.ts` 会把模板写入 prompt package、生成结果和 `_request_meta`。
- `story-generation-prompt.ts` 明确要求只使用当前成片类型模板，禁止跨类型套用。

## 1. 非遗/工艺宣传片

联网来源：

- 中国非物质文化遗产网·资源·影音：https://www.ihchina.cn/video
- 中国非物质文化遗产网专题《一纸千年 宣说非遗》：https://www.ihchina.cn/Article/Index/detail?id=16724

可吸收模板点：

- 非遗片不能只有“历史介绍”，必须把项目目录、传承人/社区、材料、工具、工序、成品、影音资源和当代场景拆开。
- 官方影音、专题和项目页应作为素材来源入口，避免从散乱二手描述直接扩写。
- 工艺类成片要能支持四类镜头：材料纹理、手部动作、工坊/展陈空间、成品使用场景。

已更新到模板：

- 新增 `official_catalog_or_resource_links`、`community_or_practitioner_consent`、`documentation_assets`。
- gate 增加官方资源入口、实拍/官方影音/展陈/再现区分、传承人或社区参与边界。

## 2. 微纪录片

联网来源：

- Documentary film techniques：https://en.wikipedia.org/wiki/Documentary_film_techniques
- B-Script: Transcript-based B-roll Video Editing with Recommendations：https://arxiv.org/abs/1902.11216

可吸收模板点：

- 微纪录应提前拆出实拍现场、访谈、旁白、档案材料、再现画面、环境声和 B-roll。
- 再现画面必须明确标注，不得让观众误以为是真实历史影像。
- B-roll 应与采访/旁白文本绑定，不是后期装饰，而是用于承接信息、展示空间、补足物件和降低纯口播负担。

已更新到模板：

- 新增 `interview_clip_selection`、`b_roll_plan`。
- gate 增加“采访/旁白文本已标注 B-roll 需求”和“每段讲述都有对应画面方案”。

## 3. AI 漫剧

联网来源：

- B站 `BV1xuVC6AEbg`，Mx-Shell《丧尸清道夫》创作思路分享：https://www.bilibili.com/video/BV1xuVC6AEbg/
- Seedance 2.0: Advancing Video Generation for World Complexity：https://arxiv.org/abs/2604.14148
- Video-of-Thought: Step-by-Step Video Reasoning from Perception to Cognition：https://arxiv.org/abs/2412.02259
- Motion by Queries: Identity-Motion Trade-offs in Text-to-Video Generation：https://arxiv.org/abs/2412.07750

可吸收模板点：

- AI 漫剧模板需要同时考虑文本、参考图、关键帧、镜头运动、声音/对白和连续性验收。
- 角色身份锚点和动作要求要分开，否则动作增强容易导致角色跳变。
- 多镜头质量不能只看单格漂亮，还要检查身份、动作方向、视线方向、道具位置、转场和故事因果。

已更新到模板：

- 新增 `reference_images_or_keyframes`、`identity_motion_consistency_plan`、`transition_plan`。
- gate 增加参考图/关键帧需求、身份动作一致性、视线/道具/运动方向连续性检查。

## 后续扩展规则

每新增一个稳定类型，按同样流程处理：

1. 先找 3 到 6 个可靠来源，优先官方、平台教程、研究论文、成熟创作者拆解。
2. 给每个来源标注 `applies_to_video_types`，禁止全类型默认套用。
3. 抽成 `required_fields`、三阶段 gate、补充问题和 10 条样板条目。
4. 跑 prompt 测试，确认新模板只进入目标 `video_type`。
