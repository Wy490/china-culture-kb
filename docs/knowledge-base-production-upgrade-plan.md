# 素材库生产化升级计划

生成时间：2026-06-27T15:33:20.781Z
来源审计时间：2026-06-27T15:33:20.774Z

## 总览

- 条目总数：169
- 高优先级条目：167
- 批次数：7
- 计划动作数：260
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

### 资产拆分补齐

- 阶段：Phase 6
- 批次 ID：asset_split_enrichment
- 目标：补齐人物、场景、人物随身道具和场景陈设，支撑 GEARS/Seedance 生产。
- 原因：asset_split 覆盖率最低，是从文化资料库升级为生产素材库的关键短板。
- 条目数：80

| 条目 | 省份 | 类型 | 分数 | 优先级 | 建议字段 |
|---|---|---|---:|---|---|
| 故宫传说 | 北京 | 地方掌故 | 36 | high | 人物、场景、人物随身道具、场景陈设 |
| 马王堆汉墓——西汉文明的地下宝库 | 湖南 | 名胜古迹 | 45 | high | 人物、场景、人物随身道具、场景陈设 |
| 天心阁——古城墙上的守望 | 湖南 | 名胜古迹 | 45 | high | 人物、场景、人物随身道具、场景陈设 |
| 土家族摆手舞——湘西土家的集体仪式 | 湖南 | 非遗 | 45 | high | 人物、场景、人物随身道具、场景陈设 |
| 湘绣——中国四大名绣之一 | 湖南 | 非遗 | 45 | high | 人物、场景、人物随身道具、场景陈设 |
| 岳麓书院——千年学府弦歌不绝 | 湖南 | 名胜古迹 | 45 | high | 人物、场景、人物随身道具、场景陈设 |
| 爱晚亭——枫林晚处的四大名亭 | 湖南 | 名胜古迹 | 55 | high | 人物、场景、人物随身道具、场景陈设 |
| 百色起义——左右江革命根据地的创建 | 广西 | 地方掌故 | 55 | high | 人物、场景、人物随身道具、场景陈设 |
| 北大红楼——新文化运动的策源地 | 北京 | 名胜古迹 | 55 | high | 人物、场景、人物随身道具、场景陈设 |
| 曾国藩——湘军创立者与洋务先驱 | 湖南 | 历史人物 | 55 | high | 人物、场景、人物随身道具、场景陈设 |
| 常德会战与常德细菌战——湘北战场的血与疫 | 湖南 | 地方掌故 | 55 | high | 人物、场景、人物随身道具、场景陈设 |
| 滇西抗战——中国远征军的血与火 | 云南 | 地方掌故 | 55 | high | 人物、场景、人物随身道具、场景陈设 |
| 东北抗联——冰天雪地中的十四年抗战 | 黑龙江 | 地方掌故 | 55 | high | 人物、场景、人物随身道具、场景陈设 |
| 广州起义——1927年三大起义之一 | 广东 | 地方掌故 | 55 | high | 人物、场景、人物随身道具、场景陈设 |
| 贺捷生——长征中最小的参与者 | 湖南 | 历史人物 | 55 | high | 人物、场景、人物随身道具、场景陈设 |
| 衡阳保卫战——抗战中最惨烈的城市坚守 | 湖南 | 地方掌故 | 55 | high | 人物、场景、人物随身道具、场景陈设 |
| 红军长征过宁夏——翻越六盘山 | 宁夏 | 地方掌故 | 55 | high | 人物、场景、人物随身道具、场景陈设 |
| 红岩精神——重庆狱中的忠贞与牺牲 | 重庆 | 地方掌故 | 55 | high | 人物、场景、人物随身道具、场景陈设 |
| 湖南花鼓戏——湖南人的戏 | 湖南 | 地方戏曲 | 55 | high | 人物、场景、人物随身道具、场景陈设 |
| 怀素——天地悠然的草书僧人 | 湖南 | 历史人物 | 55 | high | 人物、场景、人物随身道具、场景陈设 |

验收标准：
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
| 湘昆——山野昆曲的南岭遗音 | 湖南 | 非遗 | 55 | high | official_catalog_or_resource_links、materials、tools、process_steps、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details |
| 湘西苗医苗药——武陵山中的民族医药体系 | 湖南 | 非遗 | 73 | high | official_catalog_or_resource_links、materials、tools、process_steps、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details |
| 土家哭嫁歌——新娘的眼泪与歌声 | 湖南 | 民俗活动 | 55 | high | official_catalog_or_resource_links、materials、tools、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection |
| 安仁赶分社——春分时节的神农药市 | 湖南 | 民俗活动 | 64 | high | official_catalog_or_resource_links、materials、tools、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection |
| 嘉禾伴嫁歌——千年湘南女性的歌堂之夜 | 湖南 | 非遗 | 64 | high | official_catalog_or_resource_links、materials、tools、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection |
| 常德丝弦——湘北水乡的扬琴说唱 | 湖南 | 非遗 | 73 | high | official_catalog_or_resource_links、materials、process_steps、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection |
| 湘剧——湖南戏曲的中州遗韵 | 湖南 | 非遗 | 73 | high | official_catalog_or_resource_links、materials、process_steps、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection |
| 岳阳巴陵戏——洞庭湖畔的古戏曲遗存 | 湖南 | 地方戏曲 | 73 | high | official_catalog_or_resource_links、materials、process_steps、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection |
| 土家族打溜子——湘西山村的节奏密码 | 湖南 | 非遗 | 82 | high | official_catalog_or_resource_links、materials、process_steps、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection |
| 常德武陵戏——沅澧流域的湖南五大剧种之一 | 湖南 | 非遗 | 91 | high | official_catalog_or_resource_links、materials、process_steps、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection |
| 湖南花鼓戏——湖南人的戏 | 湖南 | 地方戏曲 | 55 | high | official_catalog_or_resource_links、materials、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection、production_risks |
| 浏阳菊花石雕——长沙文人案头的石上之菊 | 湖南 | 非遗 | 55 | high | official_catalog_or_resource_links、process_steps、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection、production_risks |
| 安化千两茶——36公斤的世界茶王 | 湖南 | 非遗 | 64 | high | official_catalog_or_resource_links、process_steps、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection、production_risks |
| 桑植民歌——长征路上的歌声与守望 | 湖南 | 非遗 | 64 | high | official_catalog_or_resource_links、materials、tools、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、sound_or_texture_details、modern_connection、production_risks |
| 新化山歌——湘中雪峰山的呜哇天籁 | 湖南 | 非遗 | 64 | high | official_catalog_or_resource_links、materials、tools、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、sound_or_texture_details、modern_connection、production_risks |
| 沅州石雕——沅水中游的青石艺术 | 湖南 | 非遗 | 64 | high | official_catalog_or_resource_links、tools、process_steps、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、sound_or_texture_details、modern_connection、production_risks |
| 浏阳豆豉——千年发酵的鲜味密码 | 湖南 | 饮食文化 | 73 | high | official_catalog_or_resource_links、tools、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection、production_risks |
| 汨罗江畔端午习俗——龙舟文化的发源地 | 湖南 | 节庆习俗 | 73 | high | official_catalog_or_resource_links、tools、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、visual_symbols、sound_or_texture_details、modern_connection、production_risks |
| 土家族毛古斯舞——中国舞蹈活化石 | 湖南 | 非遗 | 73 | high | official_catalog_or_resource_links、materials、tools、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、sound_or_texture_details、modern_connection、production_risks |
| 湘西苗族银饰——穿在身上的迁徙史诗 | 湖南 | 非遗 | 73 | high | official_catalog_or_resource_links、materials、tools、hand_actions、practitioner_or_transmission_line、community_or_practitioner_consent、documentation_assets、sound_or_texture_details、modern_connection、production_risks |

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
| 故宫传说 | 北京 | 地方掌故 | 36 | high | documentary_question、timeline、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 马王堆汉墓——西汉文明的地下宝库 | 湖南 | 名胜古迹 | 45 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 天心阁——古城墙上的守望 | 湖南 | 名胜古迹 | 45 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 岳麓书院——千年学府弦歌不绝 | 湖南 | 名胜古迹 | 45 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 爱晚亭——枫林晚处的四大名亭 | 湖南 | 名胜古迹 | 55 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 百色起义——左右江革命根据地的创建 | 广西 | 地方掌故 | 55 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 北大红楼——新文化运动的策源地 | 北京 | 名胜古迹 | 55 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 曾国藩——湘军创立者与洋务先驱 | 湖南 | 历史人物 | 55 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 常德会战与常德细菌战——湘北战场的血与疫 | 湖南 | 地方掌故 | 55 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 滇西抗战——中国远征军的血与火 | 云南 | 地方掌故 | 55 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 东北抗联——冰天雪地中的十四年抗战 | 黑龙江 | 地方掌故 | 55 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 广州起义——1927年三大起义之一 | 广东 | 地方掌故 | 55 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 衡阳保卫战——抗战中最惨烈的城市坚守 | 湖南 | 地方掌故 | 55 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 红军长征过宁夏——翻越六盘山 | 宁夏 | 地方掌故 | 55 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 红岩精神——重庆狱中的忠贞与牺牲 | 重庆 | 地方掌故 | 55 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 怀素——天地悠然的草书僧人 | 湖南 | 历史人物 | 55 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 淮海战役——小推车推出来的胜利 | 安徽 | 地方掌故 | 55 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 九一八事变——东北沦陷的开端 | 辽宁 | 地方掌故 | 55 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 橘子洲——一江碧水映文心 | 湖南 | 名胜古迹 | 55 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |
| 辽沈战役——解放东北的决定性一战 | 辽宁 | 地方掌故 | 55 | high | documentary_question、witness_or_expert_roles、interview_clip_selection、field_notes、b_roll_plan、reconstruction_boundary、present_day_trace、ambient_sound、what_must_not_be_claimed |

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
| 土家族摆手舞——湘西土家的集体仪式 | 湖南 | 非遗 | 45 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、character_stability_tags、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes |
| 常德会战与常德细菌战——湘北战场的血与疫 | 湖南 | 地方掌故 | 55 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、character_stability_tags、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes |
| 衡阳保卫战——抗战中最惨烈的城市坚守 | 湖南 | 地方掌故 | 55 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、character_stability_tags、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes |
| 武昌起义——辛亥革命的第一声枪响 | 湖北 | 地方掌故 | 55 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、character_stability_tags、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes |
| 醴陵釉下五彩瓷——东方陶瓷巅峰的百年传奇 | 湖南 | 非遗 | 64 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、character_stability_tags、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes |
| 刘少奇——花明楼走出的工人运动领袖与国家主席 | 湖南 | 历史人物 | 64 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、character_stability_tags、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes |
| 桑植民歌——长征路上的歌声与守望 | 湖南 | 非遗 | 64 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、character_stability_tags、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes |
| 王夫之——船山先生 | 湖南 | 历史人物 | 64 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、character_stability_tags、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes |
| 湘潭龙舞——纸扎龙灯的火光与鼓声 | 湖南 | 民俗活动 | 64 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、character_stability_tags、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes |
| 向警予——中国妇女运动的先驱 | 湖南 | 历史人物 | 64 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、character_stability_tags、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes |
| 左权——太行山上的最高殉国将领 | 湖南 | 历史人物 | 73 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、character_stability_tags、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes |
| 故宫传说 | 北京 | 地方掌故 | 36 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、character_stability_tags、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan |
| 湘绣——中国四大名绣之一 | 湖南 | 非遗 | 45 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、character_stability_tags、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan |
| 百色起义——左右江革命根据地的创建 | 广西 | 地方掌故 | 55 | high | episode_hook、world_and_truth_mode、opponent_or_pressure、relationship_collision、character_stability_tags、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan |
| 曾国藩——湘军创立者与洋务先驱 | 湖南 | 历史人物 | 55 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、character_stability_tags、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan |
| 滇西抗战——中国远征军的血与火 | 云南 | 地方掌故 | 55 | high | episode_hook、world_and_truth_mode、opponent_or_pressure、relationship_collision、character_stability_tags、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan |
| 广州起义——1927年三大起义之一 | 广东 | 地方掌故 | 55 | high | episode_hook、world_and_truth_mode、opponent_or_pressure、relationship_collision、character_stability_tags、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan |
| 贺捷生——长征中最小的参与者 | 湖南 | 历史人物 | 55 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、character_stability_tags、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes |
| 湖南花鼓戏——湖南人的戏 | 湖南 | 地方戏曲 | 55 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、dialogue_bubbles、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan |
| 怀素——天地悠然的草书僧人 | 湖南 | 历史人物 | 55 | high | episode_hook、world_and_truth_mode、protagonist_goal、opponent_or_pressure、relationship_collision、character_stability_tags、emotion_beats、shot_prompt_layers、reference_images_or_keyframes、identity_motion_consistency_plan |

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
| 故宫传说 | 北京 | 地方掌故 | 36 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 马王堆汉墓——西汉文明的地下宝库 | 湖南 | 名胜古迹 | 45 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 天心阁——古城墙上的守望 | 湖南 | 名胜古迹 | 45 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 土家族摆手舞——湘西土家的集体仪式 | 湖南 | 非遗 | 45 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 湘绣——中国四大名绣之一 | 湖南 | 非遗 | 45 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 岳麓书院——千年学府弦歌不绝 | 湖南 | 名胜古迹 | 45 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 爱晚亭——枫林晚处的四大名亭 | 湖南 | 名胜古迹 | 55 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 百色起义——左右江革命根据地的创建 | 广西 | 地方掌故 | 55 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 北大红楼——新文化运动的策源地 | 北京 | 名胜古迹 | 55 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 曾国藩——湘军创立者与洋务先驱 | 湖南 | 历史人物 | 55 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 常德会战与常德细菌战——湘北战场的血与疫 | 湖南 | 地方掌故 | 55 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 滇西抗战——中国远征军的血与火 | 云南 | 地方掌故 | 55 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 东北抗联——冰天雪地中的十四年抗战 | 黑龙江 | 地方掌故 | 55 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 广州起义——1927年三大起义之一 | 广东 | 地方掌故 | 55 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 贺捷生——长征中最小的参与者 | 湖南 | 历史人物 | 55 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 衡阳保卫战——抗战中最惨烈的城市坚守 | 湖南 | 地方掌故 | 55 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 红军长征过宁夏——翻越六盘山 | 宁夏 | 地方掌故 | 55 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 红岩精神——重庆狱中的忠贞与牺牲 | 重庆 | 地方掌故 | 55 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 湖南花鼓戏——湖南人的戏 | 湖南 | 地方戏曲 | 55 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |
| 怀素——天地悠然的草书僧人 | 湖南 | 历史人物 | 55 | high | heritage_process_pack、documentary_source_pack、ai_comic_storyboard_pack、era_and_costume_pack |

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
| 短视频钩子包 | medium | 短视频和漫剧需要前三秒钩子、反转、问题和追看机制。 | opening_hook、conflict_question、reversal、ending_hook |
| 宣讲/培训结构包 | medium | 讲解和培训片需要学习目标、步骤、例子、复盘和练习。 | learning_goal、knowledge_outline、steps、examples、recap |

## 执行原则

- 先格式治理，再补事实内容。
- 只把来源支持的信息写成事实；戏剧化空间和禁用表达必须分开。
- 批量改写省份 Markdown 前必须先跑审计和 lint。
