# ai_comic_drama 生产素材包草案

- 生成时间：2026-07-17T07:33:15.671Z
- 状态：ready_for_editor_review
- 来源数：4
- 排除来源数：0
- 重复来源观察数：0
- 非法来源观察数：0
- 排除样例数：0
- 重复样例数：0
- 来源ID：bilibili-BV1xuVC6AEbg、seedance-v2-paper、vgot-paper、motion-by-queries-paper

## 草案包

- label：AI漫剧
- goal：把故事材料转成强钩子、角色稳定、对白冲突、表情动作、分镜提示和多镜头连续性的短剧生产包。

### Required Fields
- episode_hook
- world_and_truth_mode
- protagonist_goal
- opponent_or_pressure
- relationship_collision
- scene_anchor
- character_stability_tags
- dialogue_bubbles
- emotion_beats
- shot_prompt_layers
- reference_images_or_keyframes
- identity_motion_consistency_plan
- single_shot_test
- multi_shot_continuity
- transition_plan
- ending_hook
- forbidden_claims
- target_audience
- communication_goal
- confirmed_sources
- core_message_or_conflict
- visual_assets
- production_boundaries
- delivery_acceptance_checks

### Prompt Layers
- 基础设定：世界观、角色身份、时代/地域/真实度边界。
- 氛围与画质：漫画风格、光线、色彩、镜头质感、画面比例。
- 画面内容：主体、动作、表情、场景、道具、构图和字幕气泡。
- 单镜头验证：先测试角色外观、场景锚点和情绪是否稳定。
- 多分镜验证：再测试动作连续、视线连续、道具位置和结尾钩子。
- 基础设定
- 氛围画质
- 画面内容
- 连续性验收

### Gates

**Minimum Viable Story**
- 第一格有冲突定格或异常画面
- 主角目标和压力一句话能说清
- 至少有一个可视化场景锚点
- 角色身份锚点和动作需求已分开描述
- 有明确 ai_comic_drama 成片目标和受众
- 有至少一个可信来源入口
- 有可视化主体或可听见的讲述主体
- 能说明本片为什么现在值得制作

**Script Ready**
- 每场有3到6个漫画画面
- 每场有对白或强旁白
- 角色外观、道具、场景不跳变
- 关键帧或参考图需求已列出
- 结尾有追看问题
- 脚本结构可分成开场、展开、转折/证明和收束
- 每一段都有可见动作、例子、现场或论据
- 事实、观点和再现边界已分开标注

**Production Ready**
- 角色设定卡、场景设定卡、道具卡和镜头提示词已分开
- 单镜头测试和多分镜测试各有验收点
- 角色身份、运动方向、视线方向、道具位置和镜头转场都有连续性检查
- 真实人物/机构/历史素材或其他现实引用的虚构/权利边界已写清
- 角色/讲述者、场景、道具/图像、声音和字幕关键词已列清
- 可区分实拍、档案、示意、再现和 AI 生成画面
- 禁用表达、授权边界和核验责任已标明
- 有交付验收项：连续性、可拍性、来源边界和平台规格

### Supplement Questions
- 第一格观众看到什么会停下？
- 主角现在想要什么？谁或什么马上阻止他？
- 哪一句对白能让关系立刻撞起来？
- 主角、对手、见证者分别有什么稳定外观和表情特征？
- 本集最重要的场景锚点和道具锚点是什么？
- 需要哪些参考图或关键帧来锁定角色、场景和道具？
- 动作增强会不会导致角色身份跳变？要用什么验收项检查？
- 单镜头测试要验证什么？多分镜测试要验证什么？
- 结尾钩子是危险、误会、反转、选择还是新任务？
- AI漫剧生产包需要把提示词拆成基础设定、氛围画质、画面内容三层，而不是只写剧情梗概，当前素材是否已补齐？
- 如何把「先用单镜头验证角色、世界观、画质和镜头语法，再进入多分镜连续性测试」转成可核验的素材字段？
- 如何把「爆款短剧解说的关注点是可复用工作流：提示词分析、生成、功能讲解、单镜头演示、多分镜演示」转成可核验的素材字段？
- 如何把「样板素材必须包含角色稳定锚点、场景锚点、动作冲突、镜头/构图、情绪节拍和结尾钩子」转成可核验的素材字段？
- 如何把「AI视频生产模板要同时考虑文本、图片、音频、视频等多模态输入，而不是只写文字提示词」转成可核验的素材字段？

### Sample Entries
- 周敦颐拒签冤案——案卷压到灯下（适用领域：china_culture）
- 柳毅传书——井口传来的求救声（适用领域：china_culture）
- 屈原投江前夜——江风里的最后一问（适用领域：china_culture）
- 贾谊长沙井边——少年太傅的孤独辩论（适用领域：china_culture）
- 岳麓书院夜读——一块匾额下的争论（适用领域：china_culture）
- 刘海砍樵——山路上多出来的脚印（适用领域：china_culture）
- 月岩悟道——洞口漏下来的月光（适用领域：china_culture）
- 湘妃竹传说——竹节上的泪痕（适用领域：china_culture）
- 苗族赶秋少年篇——秋千飞过鼓声（适用领域：china_culture）
- 滩头年画夜市——画里的人眨了一下眼（适用领域：china_culture）
- 零号站台——只剩一分钟的列车（适用领域：original_fiction）
- 记忆修复店——顾客要求删掉真相（适用领域：original_fiction）
- 镜中城市——替身先做了选择（适用领域：original_fiction）

## 来源摘录

### bilibili-BV1xuVC6AEbg
- 类型：bilibili_video
- 标题：今天把我关于《丧尸清道夫》的创作思路分享给大家，如果能帮到你，我会很开心。
- 适用领域：china_culture、original_fiction
- URL：https://www.bilibili.com/video/BV1xuVC6AEbg/
- AI漫剧生产包需要把提示词拆成基础设定、氛围画质、画面内容三层，而不是只写剧情梗概。
- 先用单镜头验证角色、世界观、画质和镜头语法，再进入多分镜连续性测试。
- 爆款短剧解说的关注点是可复用工作流：提示词分析、生成、功能讲解、单镜头演示、多分镜演示。
- 样板素材必须包含角色稳定锚点、场景锚点、动作冲突、镜头/构图、情绪节拍和结尾钩子。

### seedance-v2-paper
- 类型：research_paper
- 标题：Seedance 2.0: Advancing Video Generation for World Complexity
- 适用领域：china_culture、original_fiction
- URL：https://arxiv.org/abs/2604.14148
- AI视频生产模板要同时考虑文本、图片、音频、视频等多模态输入，而不是只写文字提示词。
- 短剧模板应拆出参考图、关键帧、镜头运动、声音/对白和连续性验收项。
- 多镜头片段需要在角色一致性、场景连续性和动作连续性之间做显式检查。

### vgot-paper
- 类型：research_paper
- 标题：Video-of-Thought: Step-by-Step Video Reasoning from Perception to Cognition
- 适用领域：china_culture、original_fiction
- URL：https://arxiv.org/abs/2412.02259
- AI漫剧模板应把脚本拆成可验证步骤：角色/场景感知、动作推理、镜头组织和结果检查。
- 多分镜生成不应只看单格质量，还要检查场景间因果和视觉连续性。
- 可以把样片验证分为单镜头测试、多镜头连续性测试和故事逻辑测试。

### motion-by-queries-paper
- 类型：research_paper
- 标题：Motion by Queries: Identity-Motion Trade-offs in Text-to-Video Generation
- 适用领域：china_culture、original_fiction
- URL：https://arxiv.org/abs/2412.07750
- AI漫剧模板需要显式记录角色身份锚点和运动要求，避免动作增强导致角色跳变。
- 镜头提示词应把身份、动作、场景和风格分层，而不是混成一段。
- 多镜头验收要检查角色外观、服饰、道具、动作方向和视线方向。

## 审稿清单
- 确认所有来源只适用于 ai_comic_drama，不要跨类型或跨领域套用爆款方法。
- 至少补足 3 个来源后再写入正式 ProductionMaterialPack；当前 4 个。
- 人工审查 required_fields 是否能驱动 minimum_viable_story、script_ready、production_ready 三阶段 gate。
- 补 10 条高质量 sample_entries，每条包含 source_status、core_story_engine、must_collect、visual_assets、risk_boundary。
- 写入正式 JSON 后运行 story prompt、readiness、quality workflow 和前端展示测试。
- 该类型已有正式包：本草案只用于增量审稿，不应盲目覆盖。

## 警告
- 目标 video_type 已有正式 ProductionMaterialPack，建议走增量审稿。
- 部分来源有 limitations，写入正式模板前需人工复核。
