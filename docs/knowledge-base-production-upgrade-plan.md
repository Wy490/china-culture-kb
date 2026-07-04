# 素材库生产化升级计划

生成时间：2026-07-04T14:08:11.739Z
来源审计时间：2026-07-04T14:08:11.732Z

## 总览

- 条目总数：169
- 高优先级条目：167
- 批次数：9
- 计划动作数：230
- 可格式化自动处理动作：0

## 批次

### 可信度与核实格式标准化

- 阶段：Phase 6
- 批次 ID：credibility_format_normalization
- 目标：把可信度收敛为枚举，把解释放到核实方法，为 gate 和检索评分打地基。
- 原因：当前未发现需要格式治理的可信度条目；可进入机器字段和生产资产补齐。
- 条目数：0

| 条目 | 省份 | 类型 | 分数 | 优先级 | 建议字段 |
|---|---|---|---:|---|---|

验收标准：
- 可信度字段只保留枚举。
- 核实解释进入“核实方法”。
- 待核实点保留为列表，不把待核内容改成事实。

### 机器字段补齐

- 阶段：Phase 6
- 批次 ID：machine_metadata_enrichment
- 目标：补齐 knowledge_domain、entry_role、era、asset_usage，让生成器知道素材用途。
- 原因：当前机器字段覆盖率低，导致素材像文章而不是可调度资产。
- 条目数：0

| 条目 | 省份 | 类型 | 分数 | 优先级 | 建议字段 |
|---|---|---|---:|---|---|

验收标准：
- 每条高优先级素材至少有 knowledge_domain 和 entry_role。
- 历史/时代相关素材有 era。
- asset_usage 能说明生成用途。

### 来源与地点回溯补齐

- 阶段：Phase 6
- 批次 ID：source_location_backfill
- 目标：为导入残留清洗后暴露出的空来源、空地点条目补齐可核实依据。
- 原因：当前未发现空来源或空相关地点条目。
- 条目数：0

| 条目 | 省份 | 类型 | 分数 | 优先级 | 建议字段 |
|---|---|---|---:|---|---|

验收标准：
- 每条至少补一个可追溯来源，并标注 A/B/C/D 级。
- 相关地点必须是真实地点、机构、工坊、展馆或可说明的传承空间。
- 无法回溯的旧导入信息只能进入待核实点，不能重写成事实。

### 资产拆分补齐

- 阶段：Phase 6
- 批次 ID：asset_split_enrichment
- 目标：补齐人物、场景、人物随身道具和场景陈设，支撑 GEARS/Seedance 生产。
- 原因：asset_split 覆盖率最低，是从文化资料库升级为生产素材库的关键短板；先用 kb:asset-split-suggestions 生成候选，再人工审稿写回。
- 条目数：0

| 条目 | 省份 | 类型 | 分数 | 优先级 | 建议字段 |
|---|---|---|---:|---|---|

验收标准：
- 先查看 Asset Split 建议报告，区分可审稿条目和需要先补来源/地点的条目。
- 每条高优先级素材至少列出一个场景或人物。
- 道具和陈设分开，不把事件名当人物。
- 资产拆分不新增未经来源支持的硬事实。

### 非遗/工艺宣传片最小素材包补齐

- 阶段：Phase 6
- 批次 ID：heritage_promo_minimum_pack
- 目标：补齐非遗/工艺宣传片生产所需的最小字段。
- 原因：只补目标片型需要的字段，比泛泛扩库更快提升生成质量。
- 条目数：50

| 条目 | 省份 | 类型 | 分数 | 优先级 | 建议字段 |
|---|---|---|---:|---|---|
| 常德丝弦——湘北水乡的扬琴说唱 | 湖南 | 非遗 | 82 | high | official_catalog_or_resource_links、process_steps、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection、production_risks |
| 岳阳巴陵戏——洞庭湖畔的古戏曲遗存 | 湖南 | 地方戏曲 | 82 | high | official_catalog_or_resource_links、process_steps、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection、production_risks |
| 常德武陵戏——沅澧流域的湖南五大剧种之一 | 湖南 | 非遗 | 100 | high | official_catalog_or_resource_links、process_steps、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection、production_risks |
| 湘西苗医苗药——武陵山中的民族医药体系 | 湖南 | 非遗 | 100 | high | official_catalog_or_resource_links、tools、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection、production_risks |
| 桑植白族仗鼓舞——700年前迁徙白族的武舞合一 | 湖南 | 非遗 | 73 | high | official_catalog_or_resource_links、process_steps、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、sound_or_texture_details、modern_connection、production_risks |
| 土家族摆手舞——湘西土家的集体仪式 | 湖南 | 非遗 | 73 | high | official_catalog_or_resource_links、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection、production_risks |
| 湘昆——山野昆曲的南岭遗音 | 湖南 | 非遗 | 73 | high | official_catalog_or_resource_links、process_steps、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、sound_or_texture_details、modern_connection、production_risks |
| 湖南花鼓戏——湖南人的戏 | 湖南 | 地方戏曲 | 82 | high | official_catalog_or_resource_links、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection、production_risks |
| 桑植民歌——长征路上的歌声与守望 | 湖南 | 非遗 | 82 | high | official_catalog_or_resource_links、tools、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、sound_or_texture_details、modern_connection、production_risks |
| 湘剧——湖南戏曲的中州遗韵 | 湖南 | 非遗 | 82 | high | official_catalog_or_resource_links、process_steps、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、sound_or_texture_details、modern_connection、production_risks |
| 湘西苗族跳香——五谷神前的秋后斋祭 | 湖南 | 非遗 | 82 | high | official_catalog_or_resource_links、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection、production_risks |
| 长沙弹词——月琴敲响的湘中市井 | 湖南 | 非遗 | 82 | high | official_catalog_or_resource_links、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection、production_risks |
| 安仁赶分社——春分时节的神农药市 | 湖南 | 民俗活动 | 91 | high | official_catalog_or_resource_links、tools、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、sound_or_texture_details、modern_connection、production_risks |
| 辰州傩戏——沅水中游的中国戏剧活化石 | 湖南 | 非遗 | 91 | high | official_catalog_or_resource_links、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection、production_risks |
| 侗族琵琶歌——鼓楼月堂下的湘西南情歌 | 湖南 | 非遗 | 91 | high | official_catalog_or_resource_links、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection、production_risks |
| 靖州苗族歌鼟——三锹大山的多声部和声 | 湖南 | 非遗 | 91 | high | official_catalog_or_resource_links、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection、production_risks |
| 澧水船工号子——湘北水路百年船歌 | 湖南 | 非遗 | 91 | high | official_catalog_or_resource_links、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection、production_risks |
| 浏阳花炮——千年花炮之乡的火药盛典 | 湖南 | 非遗 | 91 | high | official_catalog_or_resource_links、tools、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、sound_or_texture_details、modern_connection、production_risks |
| 土家族打溜子——湘西山村的节奏密码 | 湖南 | 非遗 | 91 | high | official_catalog_or_resource_links、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection、production_risks |
| 土家族吊脚楼营造技艺——武陵山地的木构智慧 | 湖南 | 非遗 | 91 | high | official_catalog_or_resource_links、tools、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、sound_or_texture_details、modern_connection、production_risks |

验收标准：
- 补齐当前片型 required_fields 中最影响生成的字段。
- 只记录可来源追溯的信息，戏剧化空间和事实边界分开。
- 补完后重新运行 kb:production-audit 和 kb:production-upgrade-plan。

### 微纪录片最小素材包补齐

- 阶段：Phase 6
- 批次 ID：documentary_short_minimum_pack
- 目标：补齐微纪录片生产所需的最小字段。
- 原因：只补目标片型需要的字段，比泛泛扩库更快提升生成质量。
- 条目数：50

| 条目 | 省份 | 类型 | 分数 | 优先级 | 建议字段 |
|---|---|---|---:|---|---|
| 曾国藩——湘军创立者与洋务先驱 | 湖南 | 历史人物 | 73 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 东北抗联——冰天雪地中的十四年抗战 | 黑龙江 | 地方掌故 | 73 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 广州起义——1927年三大起义之一 | 广东 | 地方掌故 | 73 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 淮海战役——小推车推出来的胜利 | 安徽 | 地方掌故 | 73 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 九一八事变——东北沦陷的开端 | 辽宁 | 地方掌故 | 73 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 南昌起义——人民军队的第一声枪响 | 江西 | 地方掌故 | 73 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 南京大屠杀——中华民族最深的伤痕 | 江苏 | 地方掌故 | 73 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 平江起义——从旧军队内部爆发的革命枪响 | 湖南 | 地方掌故 | 73 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 四渡赤水——毛泽东军事生涯的"得意之笔" | 贵州 | 地方掌故 | 73 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 太行山八路军根据地——抗战的中流砥柱 | 山西 | 名胜古迹 | 73 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 武昌起义——辛亥革命的第一声枪响 | 湖北 | 地方掌故 | 73 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 新民学会——湖南共产党的前身 | 湖南 | 地方掌故 | 73 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 岳州扇——洞庭湖畔的文人雅扇 | 湖南 | 传统工艺 | 73 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 中原突围——解放战争的序幕 | 河南 | 地方掌故 | 73 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 大青山抗日游击根据地——草原上的铁骑兵 | 内蒙古 | 地方掌故 | 82 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 南岳衡山——五岳独秀的儒释道名山 | 湖南 | 名胜古迹 | 82 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 任弼时——"党的骆驼" | 湖南 | 历史人物 | 82 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 汝城"半条被子"——什么是共产党的永恒追问 | 湖南 | 地方掌故 | 82 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 陶侃——长沙公的精进与隐忍 | 湖南 | 历史人物 | 82 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 延安——中国革命的圣地 | 陕西 | 名胜古迹 | 82 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |

验收标准：
- 补齐当前片型 required_fields 中最影响生成的字段。
- 只记录可来源追溯的信息，戏剧化空间和事实边界分开。
- 补完后重新运行 kb:production-audit 和 kb:production-upgrade-plan。

### 知识讲解视频最小素材包补齐

- 阶段：Phase 6
- 批次 ID：explainer_video_minimum_pack
- 目标：补齐知识讲解视频生产所需的最小字段。
- 原因：只补目标片型需要的字段，比泛泛扩库更快提升生成质量。
- 条目数：50

| 条目 | 省份 | 类型 | 分数 | 优先级 | 建议字段 |
|---|---|---|---:|---|---|
| 岳州扇——洞庭湖畔的文人雅扇 | 湖南 | 传统工艺 | 73 | high | audience_level、argument_points、knowledge_outline、concept_definitions、knowledge_steps、concrete_examples、analogy_or_visual_metaphor、diagram_or_caption_plan、misconception_or_boundary、recap_sentence |
| 常德会战与常德细菌战——湘北战场的血与疫 | 湖南 | 地方掌故 | 82 | high | core_question、audience_level、argument_points、knowledge_outline、concept_definitions、knowledge_steps、concrete_examples、analogy_or_visual_metaphor、diagram_or_caption_plan、recap_sentence |
| 文夕大火——千年古城的自毁之殇 | 湖南 | 地方掌故 | 82 | high | core_question、audience_level、argument_points、knowledge_outline、concept_definitions、knowledge_steps、concrete_examples、analogy_or_visual_metaphor、diagram_or_caption_plan、recap_sentence |
| 左权——太行山上的最高殉国将领 | 湖南 | 历史人物 | 82 | high | audience_level、argument_points、knowledge_outline、concept_definitions、knowledge_steps、concrete_examples、analogy_or_visual_metaphor、diagram_or_caption_plan、misconception_or_boundary、recap_sentence |
| 陈赓——黄埔出身的传奇大将 | 湖南 | 历史人物 | 91 | high | core_question、audience_level、argument_points、knowledge_outline、concept_definitions、knowledge_steps、concrete_examples、diagram_or_caption_plan、misconception_or_boundary、recap_sentence |
| 曾国藩——湘军创立者与洋务先驱 | 湖南 | 历史人物 | 73 | high | audience_level、argument_points、knowledge_outline、concept_definitions、knowledge_steps、concrete_examples、diagram_or_caption_plan、misconception_or_boundary、recap_sentence |
| 平江起义——从旧军队内部爆发的革命枪响 | 湖南 | 地方掌故 | 73 | high | audience_level、argument_points、knowledge_outline、concept_definitions、knowledge_steps、concrete_examples、diagram_or_caption_plan、misconception_or_boundary、recap_sentence |
| 踏虎剪纸——凿刀下的苗族阴阳世界 | 湖南 | 非遗 | 73 | high | audience_level、argument_points、concept_definitions、knowledge_steps、concrete_examples、analogy_or_visual_metaphor、diagram_or_caption_plan、misconception_or_boundary、recap_sentence |
| 湘潭龙舞——纸扎龙灯的火光与鼓声 | 湖南 | 民俗活动 | 73 | high | audience_level、argument_points、knowledge_outline、concept_definitions、knowledge_steps、concrete_examples、diagram_or_caption_plan、misconception_or_boundary、recap_sentence |
| 汝城"半条被子"——什么是共产党的永恒追问 | 湖南 | 地方掌故 | 82 | high | audience_level、argument_points、knowledge_outline、concept_definitions、knowledge_steps、concrete_examples、diagram_or_caption_plan、misconception_or_boundary、recap_sentence |
| 桑植民歌——长征路上的歌声与守望 | 湖南 | 非遗 | 82 | high | core_question、audience_level、argument_points、knowledge_outline、concept_definitions、knowledge_steps、analogy_or_visual_metaphor、misconception_or_boundary、recap_sentence |
| 辛弃疾——飞虎军建军潭州的壮志与词心 | 湖南 | 历史人物 | 82 | high | core_question、audience_level、argument_points、knowledge_outline、concept_definitions、knowledge_steps、concrete_examples、diagram_or_caption_plan、recap_sentence |
| 岳麓书院——千年学府弦歌不绝 | 湖南 | 名胜古迹 | 82 | high | core_question、argument_points、knowledge_outline、concept_definitions、knowledge_steps、concrete_examples、analogy_or_visual_metaphor、diagram_or_caption_plan、recap_sentence |
| 通道转兵与侗族百姓——红军长征的关键转折与地方传说 | 湖南 | 地方掌故 | 91 | high | audience_level、argument_points、knowledge_outline、concept_definitions、knowledge_steps、concrete_examples、analogy_or_visual_metaphor、diagram_or_caption_plan、recap_sentence |
| 杨开慧——"骄杨"殉道识字岭 | 湖南 | 历史人物 | 91 | high | core_question、argument_points、knowledge_outline、concept_definitions、knowledge_steps、concrete_examples、analogy_or_visual_metaphor、diagram_or_caption_plan、recap_sentence |
| 洞庭湖君山——传说叠加的洞庭明珠 | 湖南 | 名胜古迹 | 100 | high | core_question、audience_level、argument_points、knowledge_outline、concept_definitions、concrete_examples、analogy_or_visual_metaphor、diagram_or_caption_plan、recap_sentence |
| 贺龙——两把菜刀闹革命 | 湖南 | 历史人物 | 100 | high | audience_level、argument_points、knowledge_outline、concept_definitions、knowledge_steps、concrete_examples、analogy_or_visual_metaphor、diagram_or_caption_plan、recap_sentence |
| 东北抗联——冰天雪地中的十四年抗战 | 黑龙江 | 地方掌故 | 73 | high | audience_level、knowledge_outline、concept_definitions、knowledge_steps、concrete_examples、diagram_or_caption_plan、misconception_or_boundary、recap_sentence |
| 红色娘子军——琼崖妇女的革命传奇 | 海南 | 地方掌故 | 73 | high | core_question、audience_level、knowledge_outline、concept_definitions、knowledge_steps、concrete_examples、diagram_or_caption_plan、recap_sentence |
| 九一八事变——东北沦陷的开端 | 辽宁 | 地方掌故 | 73 | high | audience_level、knowledge_outline、concept_definitions、knowledge_steps、concrete_examples、diagram_or_caption_plan、misconception_or_boundary、recap_sentence |

验收标准：
- 补齐当前片型 required_fields 中最影响生成的字段。
- 只记录可来源追溯的信息，戏剧化空间和事实边界分开。
- 补完后重新运行 kb:production-audit 和 kb:production-upgrade-plan。

### AI漫剧最小素材包补齐

- 阶段：Phase 6
- 批次 ID：ai_comic_drama_minimum_pack
- 目标：补齐AI漫剧生产所需的最小字段。
- 原因：只补目标片型需要的字段，比泛泛扩库更快提升生成质量。
- 条目数：50

| 条目 | 省份 | 类型 | 分数 | 优先级 | 建议字段 |
|---|---|---|---:|---|---|
| 南京大屠杀——中华民族最深的伤痕 | 江苏 | 地方掌故 | 73 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan、single_shot_test |
| 平江起义——从旧军队内部爆发的革命枪响 | 湖南 | 地方掌故 | 73 | high | episode_hook、world_and_truth_mode、opponent_or_pressure、relationship_collision、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan、single_shot_test |
| 桑植白族仗鼓舞——700年前迁徙白族的武舞合一 | 湖南 | 非遗 | 73 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan、single_shot_test |
| 通道侗锦——湘西南侗寨的指尖花雨 | 湖南 | 非遗 | 73 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan、single_shot_test |
| 土家族摆手舞——湘西土家的集体仪式 | 湖南 | 非遗 | 73 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan、single_shot_test |
| 武昌起义——辛亥革命的第一声枪响 | 湖北 | 地方掌故 | 73 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan、single_shot_test |
| 湘昆——山野昆曲的南岭遗音 | 湖南 | 非遗 | 73 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan、single_shot_test |
| 岳州扇——洞庭湖畔的文人雅扇 | 湖南 | 传统工艺 | 73 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan、single_shot_test |
| 长沙窑铜官陶瓷烧制技艺——海上丝绸之路的釉下彩开创 | 湖南 | 非遗 | 73 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan、single_shot_test |
| 常德丝弦——湘北水乡的扬琴说唱 | 湖南 | 非遗 | 82 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan、single_shot_test |
| 贺捷生——长征中最小的参与者 | 湖南 | 历史人物 | 82 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan |
| 汨罗江畔端午习俗——龙舟文化的发源地 | 湖南 | 节庆习俗 | 82 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan、single_shot_test |
| 任弼时——"党的骆驼" | 湖南 | 历史人物 | 82 | high | episode_hook、world_and_truth_mode、opponent_or_pressure、relationship_collision、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan、single_shot_test |
| 桑植民歌——长征路上的歌声与守望 | 湖南 | 非遗 | 82 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan、single_shot_test |
| 陶侃——长沙公的精进与隐忍 | 湖南 | 历史人物 | 82 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan、single_shot_test |
| 岳阳巴陵戏——洞庭湖畔的古戏曲遗存 | 湖南 | 地方戏曲 | 82 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan、single_shot_test |
| 长沙弹词——月琴敲响的湘中市井 | 湖南 | 非遗 | 82 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan、single_shot_test |
| 左权——太行山上的最高殉国将领 | 湖南 | 历史人物 | 82 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan、single_shot_test |
| 刘少奇——花明楼走出的工人运动领袖与国家主席 | 湖南 | 历史人物 | 91 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan |
| 东北抗联——冰天雪地中的十四年抗战 | 黑龙江 | 地方掌故 | 73 | high | episode_hook、world_and_truth_mode、opponent_or_pressure、relationship_collision、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan、single_shot_test、multi_shot_continuity |

验收标准：
- 补齐当前片型 required_fields 中最影响生成的字段。
- 只记录可来源追溯的信息，戏剧化空间和事实边界分开。
- 补完后重新运行 kb:production-audit 和 kb:production-upgrade-plan。

### Domain Pack 扩库牵引

- 阶段：Phase 7
- 批次 ID：domain_pack_expansion
- 目标：用高频缺口反推通用素材包，减少逐条补库重复劳动。
- 原因：很多缺口来自同一类共性素材，如非遗流程、纪录片来源、AI 漫剧分镜和朝代设定。
- 条目数：30

| 条目 | 省份 | 类型 | 分数 | 优先级 | 建议字段 |
|---|---|---|---:|---|---|
| 曾国藩——湘军创立者与洋务先驱 | 湖南 | 历史人物 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 东北抗联——冰天雪地中的十四年抗战 | 黑龙江 | 地方掌故 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 广州起义——1927年三大起义之一 | 广东 | 地方掌故 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 红色娘子军——琼崖妇女的革命传奇 | 海南 | 地方掌故 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 淮海战役——小推车推出来的胜利 | 安徽 | 地方掌故 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 嘉禾伴嫁歌——千年湘南女性的歌堂之夜 | 湖南 | 非遗 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 九一八事变——东北沦陷的开端 | 辽宁 | 地方掌故 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 浏阳菊花石雕——长沙文人案头的石上之菊 | 湖南 | 非遗 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 南昌起义——人民军队的第一声枪响 | 江西 | 地方掌故 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 南京大屠杀——中华民族最深的伤痕 | 江苏 | 地方掌故 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 平江起义——从旧军队内部爆发的革命枪响 | 湖南 | 地方掌故 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 桑植白族仗鼓舞——700年前迁徙白族的武舞合一 | 湖南 | 非遗 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 四渡赤水——毛泽东军事生涯的"得意之笔" | 贵州 | 地方掌故 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 踏虎剪纸——凿刀下的苗族阴阳世界 | 湖南 | 非遗 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 太行山八路军根据地——抗战的中流砥柱 | 山西 | 名胜古迹 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 滩头年画——湘西南木版年画的最后守望 | 湖南 | 非遗 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 通道侗锦——湘西南侗寨的指尖花雨 | 湖南 | 非遗 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 土家族摆手舞——湘西土家的集体仪式 | 湖南 | 非遗 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 武昌起义——辛亥革命的第一声枪响 | 湖北 | 地方掌故 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 湘昆——山野昆曲的南岭遗音 | 湖南 | 非遗 | 73 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |

验收标准：
- 新增 domain pack 必须有 trigger_words、asset_usage 和边界说明。
- 不得把 domain pack 摘要写成主条目事实。
- 每个新增 pack 至少覆盖 5 个以上高优先级缺口。

## Domain Pack 扩库建议

| Pack | 优先级 | 原因 | 种子字段 |
|---|---|---|---|
| 非遗流程包 | high | 非遗条目数量高，普遍缺材料、工具、工序、手部动作和传承关系。 | materials、tools、process_steps、hand_actions、practitioner_or_transmission_line |
| 纪录片来源包 | high | 微纪录条目普遍需要现实地点、来源提示、再现边界和 B-roll 计划。 | real_world_site_or_object、source_quotes_or_source_cues、reconstruction_boundary、b_roll_plan |
| AI漫剧分镜包 | high | AI漫剧高频缺冲突、对白、表情节拍、关键帧和连续性验收。 | episode_hook、dialogue_bubbles、emotion_beats、reference_images_or_keyframes、multi_shot_continuity |
| 朝代服饰与器物包 | medium | 历史人物、名胜古迹和传说条目常缺时代、服饰、称谓和器物口径。 | era、character_clothing、character_props、dialogue_tone、credibility_boundary |
| 讲解知识结构包 | high | 知识讲解视频需要核心问题、知识层级、例子、图示字幕和误区边界，适合沉淀成通用结构包。 | core_question、knowledge_outline、concrete_examples、diagram_or_caption_plan、misconception_or_boundary |
| 短视频钩子包 | medium | 短视频和漫剧需要前三秒钩子、反转、问题和追看机制。 | opening_hook、conflict_question、reversal、ending_hook |
| 宣讲/培训结构包 | medium | 讲解和培训片需要学习目标、步骤、例子、复盘和练习。 | learning_goal、knowledge_outline、steps、examples、recap |

## 执行原则

- 先格式治理，再补事实内容。
- 只把来源支持的信息写成事实；戏剧化空间和禁用表达必须分开。
- 批量改写省份 Markdown 前必须先跑审计和 lint。
