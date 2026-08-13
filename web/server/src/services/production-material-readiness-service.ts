import type {
  MaterialBlockingLevel,
  MaterialPack,
  MaterialSufficiencyStage,
  ProductionMaterialGateReport,
  ProductionMaterialMissingField,
  ProductionMaterialPack,
  ProductionMaterialReadinessReport,
  ProductionMaterialReadinessStatus,
  StoryGenerateResult,
  StoryDomainPackContextV1,
} from '@shared/types.js';

export interface ProductionMaterialFieldSpec {
  label: string;
  stage: MaterialSufficiencyStage;
  blocking_level: MaterialBlockingLevel;
  keywords: string[];
  question?: string;
}

interface ProductionMaterialFieldSpecOverride {
  label?: string;
  keywords?: string[];
  question?: string;
}

const FIELD_SPECS: Record<string, ProductionMaterialFieldSpec> = {
  project_name: field('项目名称', 'minimum_viable_story', 'blocking', ['项目名称', '片名', '主题', 'project', 'entry_name']),
  communication_goal: field('传播目标', 'minimum_viable_story', 'blocking', ['传播目标', '目标', '希望', '让观众', 'communication']),
  heritage_or_craft_type: field('非遗/工艺类别', 'minimum_viable_story', 'blocking', ['非遗', '工艺', '技艺', '民俗', '传承', 'craft', 'heritage']),
  confirmed_status_and_sources: field('确认状态与来源', 'script_ready', 'blocking', ['来源', '出处', '核实', '可信', '官方', 'source', 'verified']),
  official_catalog_or_resource_links: field('官方目录或资源链接', 'production_ready', 'risk', ['官方目录', '中国非遗', '官网', '目录', '链接', 'url', '资源']),
  materials: field('材料', 'script_ready', 'risk', ['材料', '原料', '纸', '线', '瓷', '木', '布', '泥', '颜料']),
  tools: field('工具', 'script_ready', 'risk', ['工具', '刻刀', '针', '绷架', '窑', '织机', '刷', '笔']),
  process_steps: field('流程步骤', 'script_ready', 'blocking', ['流程', '步骤', '工序', '制作', '制坯', '套印', '烧制', '演唱']),
  hand_actions: field('手部动作', 'production_ready', 'risk', ['手部', '动作', '握', '刺绣', '刻', '刷', '拉', '敲', '捻']),
  practitioner_or_transmission_line: field('传承人或传承关系', 'script_ready', 'risk', ['传承人', '学徒', '师徒', '匠人', '工坊', '班社']),
  community_or_practitioner_consent: field('社区/传承人参与边界', 'production_ready', 'risk', ['授权', '同意', '参与', '传承人', '社区', '展馆']),
  documentation_assets: field('记录/影音资产', 'production_ready', 'optional', ['影音', '视频', '照片', '档案', '展陈', 'documentation']),
  visual_symbols: field('视觉符号', 'production_ready', 'risk', ['视觉', '符号', '纹样', '图案', '色彩', '造型']),
  sound_or_texture_details: field('声音或质感细节', 'production_ready', 'optional', ['声音', '质感', '纹理', '气味', '触感', '鼓点']),
  modern_connection: field('当代连接', 'script_ready', 'risk', ['当代', '今天', '现代', '市场', '保护', '传播']),
  production_risks: field('生产风险', 'production_ready', 'risk', ['风险', '禁用', '安全', '待核实', '边界']),

  documentary_question: field('纪录核心问题', 'minimum_viable_story', 'blocking', ['问题', '为什么', '如何', 'question']),
  real_world_site_or_object: field('现实地点或实物入口', 'minimum_viable_story', 'blocking', ['旧址', '现场', '地点', '实物', '文物', '展陈', '碑刻', 'site']),
  source_quotes_or_source_cues: field('来源提示或引用线索', 'script_ready', 'blocking', ['引用', '来源', '文献', '史料', '展板', '档案']),
  timeline: field('时间线', 'script_ready', 'risk', ['时间线', '年代', '年', '朝代', '时期', 'timeline']),
  witness_or_expert_roles: field('见证人/专家角色', 'script_ready', 'risk', [
    '采访', '馆员', '专家', '研究者', '见证人', '传承人',
    '创作者', '编剧', '角色设计', '权利顾问',
  ]),
  interview_clip_selection: field('采访片段选择', 'production_ready', 'risk', ['采访片段', '同期声', '口述', 'clip', 'interview']),
  field_notes: field('现场笔记', 'production_ready', 'optional', ['现场', '环境声', '光线', '人流', '路径', 'field']),
  b_roll_plan: field('B-roll 计划', 'production_ready', 'risk', ['b-roll', 'B-roll', '空镜', '补充画面', '素材镜头']),
  reconstruction_boundary: field('再现边界', 'script_ready', 'blocking', ['再现', '复原', '示意', '相传', '推测', '边界']),
  present_day_trace: field('当下痕迹', 'script_ready', 'risk', ['今天', '当下', '现存', '还能看到', '痕迹']),
  ambient_sound: field('环境声', 'production_ready', 'optional', ['环境声', '声音', '风声', '水声', '人声', '鼓声']),
  what_must_not_be_claimed: field('不可声称事项', 'script_ready', 'blocking', ['不得', '不能', '不可', '禁写', '待核实']),

  core_question: field('核心问题', 'minimum_viable_story', 'blocking', ['核心问题', '问题', '为什么', '如何', '到底', 'question']),
  audience_level: field('受众认知层级', 'minimum_viable_story', 'risk', ['受众', '小白', '入门', '中学生', '游客', 'audience']),
  argument_points: field('讲解论点', 'script_ready', 'blocking', ['论点', '观点', '要点', 'argument']),
  knowledge_outline: field('知识大纲', 'script_ready', 'blocking', ['知识大纲', '层级', '结构', '提纲', 'outline']),
  concept_definitions: field('概念定义', 'script_ready', 'risk', ['概念', '定义', '术语', '是什么', 'definition']),
  knowledge_steps: field('知识步骤', 'script_ready', 'risk', ['步骤', '脉络', '顺序', '流程', 'step']),
  step_sequence: field('步骤序列', 'script_ready', 'blocking', ['步骤', '序列', '流程', '先', '再', '最后', 'step']),
  concrete_examples: field('具体例子', 'script_ready', 'risk', ['例子', '案例', '比如', '例如', 'example']),
  analogy_or_visual_metaphor: field('类比或视觉隐喻', 'production_ready', 'optional', ['类比', '隐喻', '好比', 'visual metaphor']),
  diagram_or_caption_plan: field('图示/字幕计划', 'production_ready', 'risk', ['图示', '字幕', '关键词', '信息图', 'caption']),
  source_cues: field('来源线索', 'script_ready', 'blocking', ['来源', '出处', '文献', '展陈', 'source']),
  misconception_or_boundary: field('误区或边界', 'production_ready', 'risk', ['误区', '边界', '不得', '不能', '易错']),
  recap_sentence: field('总结记忆句', 'production_ready', 'optional', ['总结', '记忆点', '一句话', '复盘', 'recap']),

  audience_age_band: field('儿童受众年龄段', 'minimum_viable_story', 'blocking', ['3-6岁', '7-9岁', '10-12岁', '年龄', '儿童', '少儿', '亲子']),
  child_safe_conflict: field('儿童安全冲突', 'script_ready', 'blocking', ['温和阻力', '善意张力', '误会', '选择', '不恐怖', 'child safe']),
  protagonist_choice: field('主角选择', 'script_ready', 'blocking', ['选择', '决定', '帮助', '勇敢', '道歉', '尝试']),
  wonder_or_cultural_symbol: field('奇观或文化符号', 'minimum_viable_story', 'risk', ['文化符号', '奇观', '神奇', '纹样', '节日', '道具']),
  emotional_resolution: field('情绪安放', 'script_ready', 'risk', ['情绪', '安放', '和解', '复盘', '安心', '成长']),
  parent_teacher_note: field('家长/教师提示', 'production_ready', 'optional', ['家长', '老师', '教师', '亲子', '课堂', '延伸']),

  opening_hook: field('开场钩子', 'minimum_viable_story', 'blocking', ['前三秒', '三秒', '开场', '钩子', '问题', '反差', 'hook']),
  platform_context: field('平台语境', 'minimum_viable_story', 'risk', ['竖屏', '短视频', '平台', '社媒', '评论区', '完播']),
  share_trigger: field('分享触发点', 'script_ready', 'risk', ['分享', '转发', '共鸣', '反转', '冷知识', '原来']),
  comment_prompt: field('评论互动提示', 'production_ready', 'optional', ['评论', '投票', '你觉得', '留言', '互动']),
  vertical_shot_plan: field('竖屏镜头计划', 'production_ready', 'risk', ['竖屏', '9:16', '近景', '字幕', '快剪', '镜头']),
  beat_interval: field('短视频节奏点', 'script_ready', 'risk', ['10秒', '15秒', '节奏', '转折', '揭示', 'beat']),
  fact_boundary_card: field('事实边界卡', 'script_ready', 'blocking', ['边界卡', '事实边界', '不得', '待核实', '来源']),

  learning_objective: field('学习目标', 'minimum_viable_story', 'blocking', ['学习目标', '学会', '掌握', '能说出', '能理解']),
  learner_profile: field('学习者画像', 'minimum_viable_story', 'risk', ['学习者', '学生', '学员', '受众', '年级', '基础']),
  speaker_position: field('主讲人定位', 'minimum_viable_story', 'risk', ['主讲人', '讲述者', '老师', '主持人', 'speaker']),
  case_examples: field('案例例子', 'script_ready', 'risk', ['案例', '例子', '比如', '例如', 'case']),
  slide_or_board_assets: field('板书/课件资产', 'production_ready', 'risk', ['板书', '课件', '字幕', '图示', 'slide', '白板']),
  audience_takeaway: field('受众带走点', 'production_ready', 'optional', ['带走', '总结', '行动', '复盘', 'takeaway']),
  practice_task: field('练习任务', 'production_ready', 'risk', ['练习', '任务', '互动题', '试一试', 'practice']),
  assessment_check: field('掌握检查', 'production_ready', 'risk', ['检查', '测验', '判断题', '选择题', 'assessment']),

  episode_hook: field('第一格钩子', 'minimum_viable_story', 'blocking', ['钩子', '第一格', '开场', '异常', '反转', 'hook']),
  world_and_truth_mode: field('世界观与真实度模式', 'minimum_viable_story', 'blocking', ['世界观', '真实度', '虚构', '史实', '传说', 'truth']),
  protagonist_goal: field('主角目标', 'minimum_viable_story', 'blocking', ['主角', '目标', '想要', '必须', 'protagonist']),
  opponent_or_pressure: field('对手或压力', 'script_ready', 'blocking', ['对手', '压力', '阻止', '危机', '冲突']),
  relationship_collision: field('关系碰撞', 'script_ready', 'risk', ['关系', '误会', '对白', '争执', '碰撞']),
  scene_anchor: field('场景锚点', 'minimum_viable_story', 'blocking', ['场景', '地点', '空间', '锚点', 'scene']),
  character_stability_tags: field('角色稳定标签', 'production_ready', 'risk', ['角色稳定', '服饰', '发式', '随身物', '表情']),
  dialogue_bubbles: field('对白气泡', 'script_ready', 'risk', ['对白', '气泡', '台词', '旁白']),
  emotion_beats: field('情绪节拍', 'script_ready', 'risk', ['情绪', '表情', '节拍', '反应']),
  shot_prompt_layers: field('镜头提示词分层', 'production_ready', 'risk', ['基础设定', '氛围', '画质', '画面内容', '提示词']),
  reference_images_or_keyframes: field('参考图或关键帧', 'production_ready', 'risk', ['参考图', '关键帧', 'keyframe', 'reference image']),
  identity_motion_consistency_plan: field('身份动作一致性计划', 'production_ready', 'risk', ['一致性', '身份', '动作方向', '视线', '道具位置']),
  single_shot_test: field('单镜头测试', 'production_ready', 'risk', ['单镜头', '单张', '测试']),
  multi_shot_continuity: field('多分镜连续性', 'production_ready', 'risk', ['多分镜', '连续性', '转场', '镜头连续']),
  transition_plan: field('转场计划', 'production_ready', 'optional', ['转场', '承接', '镜头切换']),
  ending_hook: field('结尾钩子', 'script_ready', 'risk', ['结尾钩子', '追看', '悬念', 'ending']),
  forbidden_claims: field('禁用/不可声称内容', 'script_ready', 'blocking', ['禁用', '不得', '不可', '待核实', '虚构边界']),

  character_subject: field('人物主体与身份', 'minimum_viable_story', 'blocking', ['人物主体', '人物身份', '姓名', '生平', 'character subject']),
  life_stage_window: field('人生阶段窗口', 'minimum_viable_story', 'blocking', ['人生阶段', '年龄阶段', '青年', '晚年', 'life stage']),
  formative_pressure: field('塑造人物的压力', 'script_ready', 'risk', ['压力', '困境', '处境', '挫折', 'formative pressure']),
  defining_choice: field('定义人物的选择', 'script_ready', 'blocking', ['关键选择', '决定', '抉择', 'defining choice']),
  relationship_map: field('人物关系图', 'script_ready', 'risk', ['关系图', '师友', '亲友', '对手', 'relationship map']),
  character_desire: field('人物欲望与目标', 'minimum_viable_story', 'blocking', ['人物欲望', '想要', '目标', 'desire']),
  character_flaw_or_limit: field('人物局限', 'script_ready', 'risk', ['局限', '缺点', '误判', '代价', 'flaw']),
  change_arc: field('人物变化弧', 'script_ready', 'blocking', ['变化弧', '转变', '成长', 'change arc']),
  signature_objects: field('人物标志物', 'production_ready', 'risk', ['标志物', '随身物', '器物', 'signature object']),
  dialogue_voice: field('人物语言声线', 'production_ready', 'risk', ['语言声线', '说话方式', '口吻', 'dialogue voice']),
  factual_life_boundary: field('人物生平事实边界', 'script_ready', 'blocking', ['生平边界', '史料边界', '不可编造', 'life boundary']),
  ending_legacy: field('结尾影响与余韵', 'production_ready', 'optional', ['影响', '余韵', '后世', 'legacy']),

  historical_event_anchor: field('历史事件锚点', 'minimum_viable_story', 'blocking', ['历史事件', '事件锚点', 'event anchor']),
  historical_time_window: field('历史时间窗口', 'minimum_viable_story', 'blocking', ['历史时间', '年月', '时期', 'time window']),
  historical_location: field('历史地点与空间', 'minimum_viable_story', 'blocking', ['历史地点', '旧址', '空间', 'historical location']),
  historical_stakes: field('历史利害与风险', 'script_ready', 'blocking', ['历史利害', '风险', '成败', 'stakes']),
  faction_positions: field('各方立场', 'script_ready', 'risk', ['各方立场', '阵营', '主张', 'faction']),
  causal_chain: field('事件因果链', 'script_ready', 'blocking', ['因果链', '起因', '结果', 'causal chain']),
  evidence_hierarchy: field('史料证据层级', 'script_ready', 'blocking', ['证据层级', '史料', '一手材料', 'evidence hierarchy']),
  documented_actions: field('有据可查的行动', 'script_ready', 'risk', ['有据行动', '记载', '史实动作', 'documented action']),
  dramatized_gap: field('戏剧化补足区', 'script_ready', 'blocking', ['戏剧化补足', '史料空白', '合理虚构', 'dramatized gap']),
  period_details: field('时代生产细节', 'production_ready', 'risk', ['时代细节', '服饰', '器物', '制度', 'period detail']),
  conflict_turning_point: field('冲突转折点', 'script_ready', 'blocking', ['冲突转折', '转折点', 'turning point']),
  aftermath: field('事件后果', 'production_ready', 'risk', ['后果', '余波', '影响', 'aftermath']),
  historical_claim_boundary: field('历史声称边界', 'script_ready', 'blocking', ['历史边界', '不得声称', '待核', 'claim boundary']),

  legend_source_versions: field('传说来源版本', 'minimum_viable_story', 'blocking', ['传说版本', '来源版本', '异文', 'source version']),
  oral_or_text_lineage: field('口传/文本流变', 'script_ready', 'risk', ['口传', '文本流变', '记载', 'lineage']),
  supernatural_rule: field('神异规则', 'minimum_viable_story', 'blocking', ['神异规则', '法力', '禁制', 'supernatural rule']),
  mortal_desire: field('凡人愿望', 'minimum_viable_story', 'blocking', ['凡人愿望', '诉求', '想要', 'mortal desire']),
  taboo_or_test: field('禁忌或考验', 'script_ready', 'blocking', ['禁忌', '考验', '试炼', 'taboo']),
  transformation_cost: field('变化代价', 'script_ready', 'risk', ['代价', '变化', '牺牲', 'transformation cost']),
  symbolic_motif: field('象征母题', 'production_ready', 'risk', ['象征母题', '意象', '反复符号', 'motif']),
  regional_variant: field('地域版本差异', 'script_ready', 'risk', ['地域版本', '地方说法', 'variant']),
  ritual_or_custom_link: field('仪式/习俗关联', 'production_ready', 'risk', ['仪式', '习俗', '节俗', 'custom link']),
  version_choice: field('改编版本选择', 'script_ready', 'blocking', ['版本选择', '采用版本', '改编口径']),
  legend_truth_boundary: field('传说真实度边界', 'script_ready', 'blocking', ['相传', '传说边界', '非史实', 'truth boundary']),
  wonder_ending: field('奇观结尾', 'production_ready', 'optional', ['奇观结尾', '余韵', 'wonder ending']),

  cultural_theme: field('文化主题', 'minimum_viable_story', 'blocking', ['文化主题', '主题', 'cultural theme']),
  audience_impression: field('目标受众印象', 'minimum_viable_story', 'risk', ['受众印象', '看完感受', 'audience impression']),
  core_value_proposition: field('核心传播价值', 'minimum_viable_story', 'blocking', ['核心价值', '传播价值', 'value proposition']),
  cultural_evidence: field('文化证据', 'script_ready', 'blocking', ['文化证据', '来源', '实物', 'evidence']),
  symbol_system: field('视觉符号系统', 'production_ready', 'risk', ['符号系统', '纹样', '色彩', 'symbol system']),
  key_message_hierarchy: field('信息层级', 'script_ready', 'blocking', ['信息层级', '主信息', '次信息', 'message hierarchy']),
  montage_arc: field('蒙太奇段落弧', 'production_ready', 'risk', ['蒙太奇', '段落弧', 'montage arc']),
  voiceover_register: field('旁白语体', 'production_ready', 'risk', ['旁白语体', '语气', 'voiceover']),
  call_to_action: field('行动号召', 'production_ready', 'optional', ['行动号召', '参观', '了解', 'call to action']),
  brand_tone_boundary: field('品牌语气边界', 'script_ready', 'risk', ['品牌语气', '口号边界', 'tone boundary']),
  rights_and_attribution: field('权利与署名', 'production_ready', 'blocking', ['权利', '署名', '授权', 'attribution']),
  representation_risk: field('文化再现风险', 'production_ready', 'risk', ['再现风险', '刻板印象', '挪用', 'representation risk']),

  city_identity: field('城市身份主张', 'minimum_viable_story', 'blocking', ['城市身份', '城市主张', 'city identity']),
  target_audience: field('目标客群', 'minimum_viable_story', 'risk', ['目标客群', '游客', '市民', 'target audience']),
  place_proof_points: field('地方证明点', 'script_ready', 'blocking', ['地方证明', '地标', '生活方式', 'proof point']),
  route_or_spatial_axis: field('空间路线轴', 'script_ready', 'blocking', ['空间路线', '动线', '路线轴', 'spatial axis']),
  season_and_time: field('季节与时段', 'production_ready', 'risk', ['季节', '时段', '晨昏', 'season']),
  people_and_daily_life: field('人物与日常生活', 'script_ready', 'risk', ['日常生活', '市民', '人物', 'daily life']),
  food_craft_landmark_mix: field('饮食工艺地标组合', 'script_ready', 'risk', ['饮食', '工艺', '地标', '组合']),
  city_soundscape: field('城市声音景观', 'production_ready', 'optional', ['城市声音', '市声', 'soundscape']),
  brand_slogan_boundary: field('城市口号边界', 'script_ready', 'blocking', ['城市口号', '最', '唯一', '口号边界']),
  visitor_action: field('游客行动路径', 'production_ready', 'risk', ['游客行动', '到访', '体验', 'visitor action']),
  location_permissions: field('场地拍摄许可', 'production_ready', 'blocking', ['拍摄许可', '场地授权', 'location permission']),
  weather_contingency: field('天气备选方案', 'production_ready', 'risk', ['天气备选', '雨备', 'weather contingency']),

  scene_objective: field('场景叙事目标', 'minimum_viable_story', 'blocking', ['场景目标', '叙事目标', 'scene objective']),
  entering_character: field('进入空间的人物', 'minimum_viable_story', 'risk', ['进入人物', '观察者', 'entering character']),
  spatial_zones: field('空间分区', 'script_ready', 'blocking', ['空间分区', '前中后景', 'spatial zone']),
  movement_route: field('人物运动路线', 'script_ready', 'blocking', ['运动路线', '走位', 'movement route']),
  action_trigger: field('动作触发点', 'script_ready', 'blocking', ['动作触发', '触发点', 'action trigger']),
  visual_reveal: field('空间揭示点', 'script_ready', 'risk', ['空间揭示', '视觉揭示', 'reveal']),
  time_of_day: field('日夜时段', 'production_ready', 'risk', ['日夜', '时段', 'time of day']),
  light_and_weather: field('光线与天气', 'production_ready', 'risk', ['光线', '天气', 'light']),
  shot_sequence: field('镜头次序', 'production_ready', 'blocking', ['镜头次序', '景别', 'shot sequence']),
  spatial_continuity: field('空间连续性', 'production_ready', 'blocking', ['空间连续', '方向', '轴线', 'spatial continuity']),

  landscape_subject: field('山水主体', 'minimum_viable_story', 'blocking', ['山水主体', '山峰', '水体', 'landscape subject']),
  mood_keyword: field('意境关键词', 'minimum_viable_story', 'risk', ['意境', '情绪关键词', 'mood']),
  season_and_weather: field('季候与天气', 'minimum_viable_story', 'risk', ['季候', '天气', 'season and weather']),
  light_transition: field('光线变化', 'script_ready', 'risk', ['光线变化', '晨昏', 'light transition']),
  foreground_midground_background: field('前中后景层次', 'script_ready', 'blocking', ['前景', '中景', '后景', '景深']),
  water_wind_cloud_motion: field('水风云动态', 'script_ready', 'risk', ['水', '风', '云', '动态']),
  color_palette: field('色彩方案', 'production_ready', 'risk', ['色彩方案', '色调', 'palette']),
  camera_rhythm: field('镜头呼吸节奏', 'production_ready', 'risk', ['镜头节奏', '呼吸', 'camera rhythm']),
  soundscape_layers: field('声景分层', 'production_ready', 'optional', ['声景', '自然声', '音乐', 'soundscape layer']),
  human_scale_reference: field('人物尺度参照', 'production_ready', 'optional', ['人物尺度', '参照物', 'scale reference']),
  landscape_claim_boundary: field('景观事实边界', 'script_ready', 'blocking', ['景观边界', '地名', '季节事实', 'claim boundary']),
};

const DOMAIN_FIELD_SPEC_OVERRIDES: Record<string, Record<string, ProductionMaterialFieldSpecOverride>> = {
  original_fiction: {
    wonder_or_cultural_symbol: {
      label: '奇观或故事标志物',
      keywords: ['故事标志物', '关键物件', '视觉意象', '世界观物件', '记忆物件'],
      question: '请补充一个能让儿童记住原创故事的奇观、关键物件或视觉意象，并说明它如何服务角色选择。',
    },
    share_trigger: {
      keywords: ['人物选择', '讨论焦点', '剧情讨论', '故事悬念', '叙事可能'],
      question: '请补充原创故事中值得观众讨论或转发的人物选择、剧情反差或故事悬念。',
    },
    source_cues: {
      label: '项目素材/权利线索',
      keywords: ['项目素材', '素材入口', '原创大纲', '角色设定稿', '创作说明', '权利记录'],
      question: '请补充原创大纲、角色设定稿、创作说明或权利记录等项目素材线索。',
    },
    fact_boundary_card: {
      label: '项目/权利边界卡',
      keywords: ['项目边界卡', '权利边界卡', '项目边界', '权利边界', '创作者确认', '授权待核'],
      question: '请补充项目设定、现实引用和授权状态的边界卡。',
    },
    world_and_truth_mode: {
      keywords: ['原创设定', '架空', '世界规则', '虚构世界', 'fictional_original'],
      question: '请说明原创世界规则、架空程度，以及哪些现实引用仍需创作者或权利确认。',
    },
  },
};

const STAGE_ORDER: MaterialSufficiencyStage[] = ['minimum_viable_story', 'script_ready', 'production_ready'];

export function buildProductionMaterialReadinessReport(input: {
  productionMaterialPack?: ProductionMaterialPack;
  materialPack?: MaterialPack;
  contextText?: string;
  generatedContextText?: string;
  sourceDomain?: string;
  domainPackContext?: StoryDomainPackContextV1;
}): ProductionMaterialReadinessReport | undefined {
  const { productionMaterialPack } = input;
  if (!productionMaterialPack) return undefined;

  const sourceMaterialText = normalizeSearchText(materialPackToText(input.materialPack, input.contextText));
  const generatedContextText = normalizeSearchText(input.generatedContextText ?? '');
  const materialText = [sourceMaterialText, generatedContextText].filter(Boolean).join('\n');
  const fields = productionMaterialPack.material_template.required_fields;
  const availableFields = fields.filter(fieldId =>
    hasFieldEvidence(
      fieldId,
      productionMaterialPack.video_type,
      materialText,
      input.materialPack,
      input.sourceDomain,
      sourceMaterialText,
    ),
  );
  const missingFields = fields
    .filter(fieldId => !availableFields.includes(fieldId))
    .map((fieldId, index) => missingFieldForTemplateField(fieldId, productionMaterialPack, index, input.sourceDomain));
  const gateReports = STAGE_ORDER.map(stage =>
    buildGateReport(stage, productionMaterialPack, availableFields, missingFields, input.sourceDomain),
  );
  const score = scoreReadiness(fields, availableFields, missingFields, input.sourceDomain);
  const status = readinessStatus(missingFields);

  return {
    schema_version: 'production-material-readiness/v1',
    video_type: productionMaterialPack.video_type,
    pack_label: productionMaterialPack.label,
    score,
    status,
    available_fields: availableFields,
    missing_fields: missingFields,
    gate_reports: gateReports,
    recommended_next_questions: missingFields
      .map(field => field.recommended_question)
      .filter((question, index, arr) => arr.indexOf(question) === index)
      .slice(0, 8),
    ...(input.domainPackContext ? { domain_pack_context: input.domainPackContext } : {}),
  };
}

export function refreshStoryProductionMaterialReadiness(
  story: StoryGenerateResult,
): ProductionMaterialReadinessReport | undefined {
  return buildProductionMaterialReadinessReport({
    productionMaterialPack: story.production_material_pack,
    materialPack: story.material_pack,
    contextText: story.original_user_query,
    generatedContextText: generatedStoryProductionMaterialText(story),
    sourceDomain: story.sourceDomain,
    domainPackContext: story.production_material_readiness?.domain_pack_context,
  });
}

export function getProductionMaterialFieldSpec(
  fieldId: string,
  sourceDomain?: string,
): ProductionMaterialFieldSpec | undefined {
  const base = FIELD_SPECS[fieldId];
  if (!base) return undefined;
  const override = sourceDomain ? DOMAIN_FIELD_SPEC_OVERRIDES[sourceDomain]?.[fieldId] : undefined;
  if (!override) return base;
  return {
    ...base,
    ...override,
    keywords: [...new Set([...base.keywords, ...(override.keywords ?? [])])],
  };
}

export function listProductionMaterialFieldIds(): string[] {
  return Object.keys(FIELD_SPECS).sort((a, b) => a.localeCompare(b));
}

function field(
  label: string,
  stage: MaterialSufficiencyStage,
  blocking_level: MaterialBlockingLevel,
  keywords: string[],
  question?: string,
): ProductionMaterialFieldSpec {
  return { label, stage, blocking_level, keywords, question };
}

function buildGateReport(
  stage: MaterialSufficiencyStage,
  pack: ProductionMaterialPack,
  availableFields: string[],
  missingFields: ProductionMaterialMissingField[],
  sourceDomain?: string,
): ProductionMaterialGateReport {
  const stageAvailable = availableFields.filter(fieldId => fieldStage(fieldId, sourceDomain) === stage);
  const stageMissing = missingFields.filter(field => field.stage === stage);
  return {
    stage,
    status: readinessStatus(stageMissing),
    required_items: gateItemsForStage(pack, stage),
    available_fields: stageAvailable,
    missing_fields: stageMissing,
    notes: stageMissing.length > 0
      ? [`需补齐 ${stageMissing.map(field => field.label).join('、')}`]
      : ['当前素材已覆盖该阶段生产模板字段。'],
  };
}

function gateItemsForStage(pack: ProductionMaterialPack, stage: MaterialSufficiencyStage): string[] {
  if (stage === 'minimum_viable_story') return pack.material_template.minimum_viable_story_gate;
  if (stage === 'script_ready') return pack.material_template.script_ready_gate;
  return pack.material_template.production_ready_gate;
}

function readinessStatus(missingFields: ProductionMaterialMissingField[]): ProductionMaterialReadinessStatus {
  if (missingFields.some(field => field.blocking_level === 'blocking')) return 'blocked';
  if (missingFields.length > 0) return 'needs_input';
  return 'ready';
}

function scoreReadiness(
  fields: string[],
  availableFields: string[],
  missingFields: ProductionMaterialMissingField[],
  sourceDomain?: string,
): number {
  const totalWeight = fields.reduce((sum, fieldId) => sum + fieldWeight(fieldStage(fieldId, sourceDomain)), 0);
  const availableWeight = availableFields.reduce((sum, fieldId) => sum + fieldWeight(fieldStage(fieldId, sourceDomain)), 0);
  const blockingPenalty = missingFields.filter(field => field.blocking_level === 'blocking').length * 6;
  if (totalWeight <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((availableWeight / totalWeight) * 100 - blockingPenalty)));
}

function fieldStage(fieldId: string, sourceDomain?: string): MaterialSufficiencyStage {
  return getProductionMaterialFieldSpec(fieldId, sourceDomain)?.stage ?? 'production_ready';
}

function fieldWeight(stage: MaterialSufficiencyStage): number {
  if (stage === 'minimum_viable_story') return 3;
  if (stage === 'script_ready') return 2;
  return 1;
}

function missingFieldForTemplateField(
  fieldId: string,
  pack: ProductionMaterialPack,
  index: number,
  sourceDomain?: string,
): ProductionMaterialMissingField {
  const spec = getProductionMaterialFieldSpec(fieldId, sourceDomain)
    ?? field(humanizeFieldId(fieldId), 'production_ready', 'risk', []);
  const fallbackQuestion = pack.material_template.supplement_questions[index % Math.max(1, pack.material_template.supplement_questions.length)]
    ?? `请补充「${spec.label}」。`;
  return {
    field_id: fieldId,
    label: spec.label,
    stage: spec.stage,
    blocking_level: spec.blocking_level,
    reason: `当前素材不足以覆盖「${pack.label}」生产模板字段「${spec.label}」。`,
    recommended_question: spec.question ?? fallbackQuestion,
  };
}

function hasFieldEvidence(
  fieldId: string,
  videoType: ProductionMaterialPack['video_type'],
  materialText: string,
  materialPack: MaterialPack | undefined,
  sourceDomain?: string,
  sourceMaterialText = materialText,
): boolean {
  if (EXTERNAL_EVIDENCE_FIELD_IDS.has(fieldId)) {
    const externalSpec = getProductionMaterialFieldSpec(fieldId, sourceDomain);
    return externalSpec?.keywords.some(keyword => sourceMaterialText.includes(keyword.toLowerCase())) ?? false;
  }
  if (fieldId === 'project_name') return Boolean(materialPack?.primary_materials.length || materialPack?.brand_or_institution_profile?.name || materialPack?.source_work_profile?.title);
  if (fieldId === 'confirmed_status_and_sources') return Boolean(materialPack?.verified_facts.length || materialPack?.uncertain_claims.length || /来源|出处|核实|source|verified/.test(materialText));
  if (fieldId === 'production_risks') return Boolean(materialPack?.uncertain_claims.length || materialPack?.brand_or_institution_profile?.forbidden_claims?.length || /风险|禁用|待核实|边界/.test(materialText));
  if (fieldId === 'visual_symbols') return Boolean(materialPack?.visual_assets.length || materialPackHasPurpose(materialPack, 'visual_asset') || /视觉|图案|纹样|符号/.test(materialText));
  if (fieldId === 'world_and_truth_mode' && /真实度|虚构|传说|史实|fictional|truth|相传/.test(materialText)) return true;
  if (fieldId === 'forbidden_claims') return /不得|不能|不可|禁用|待核实|边界/.test(materialText);
  if (fieldId === 'heritage_or_craft_type' && videoType === 'heritage_promo') return /非遗|工艺|技艺|民俗|传承/.test(materialText);
  if (fieldId === 'scene_anchor') return /场景|地点|空间|洞|楼|书院|江|馆|旧址|scene/.test(materialText);
  const spec = getProductionMaterialFieldSpec(fieldId, sourceDomain);
  if (!spec) return materialText.includes(fieldId.toLowerCase());
  return spec.keywords.some(keyword => materialText.includes(keyword.toLowerCase()));
}

const EXTERNAL_EVIDENCE_FIELD_IDS = new Set([
  'official_catalog_or_resource_links',
  'community_or_practitioner_consent',
  'documentation_assets',
  'interview_clip_selection',
  'field_notes',
  'reference_images_or_keyframes',
  'single_shot_test',
  'rights_and_attribution',
  'location_permissions',
]);

function generatedStoryProductionMaterialText(story: StoryGenerateResult): string {
  return [
    story.title,
    story.logline,
    story.theme,
    story.full_text,
    story.credibility_note,
    story.characters?.map(character => [
      `人物主体与身份：${character.name}，${character.role}`,
      character.description,
      character.arc ? `人物变化弧：${character.arc}` : '',
    ].filter(Boolean).join('；')).join('\n'),
    story.protagonist_arc?.map(arc => [
      `人物欲望与目标：${arc.starting_state}`,
      `定义人物的选择：${arc.turning_point}`,
      `人物变化弧：${arc.resolution}`,
    ].join('；')).join('\n'),
    ...story.scene_breakdown.flatMap(scene => [
      `场景叙事目标：${scene.dramatic_function}`,
      scene.title,
      scene.location,
      `日夜时段：${scene.time_of_day}`,
      scene.plot,
      `动作触发与关键行动：${scene.key_action}`,
      `进入空间的人物：${scene.characters.join('、')}`,
      scene.visual_prompt,
      `镜头次序建议：${scene.camera_suggestion}`,
      scene.conflict,
      scene.dialogue_or_narration ? `对白与旁白：${scene.dialogue_or_narration}` : '',
      scene.cultural_note,
      scene.factual_basis ? `有据可查的行动与事实依据：${scene.factual_basis}` : '',
      ...(scene.fictionalized_elements ?? []).map(item => `戏剧化补足区：${item}`),
    ]),
    ...story.gears_segments.flatMap(segment => [
      segment.script_text,
      segment.purpose,
      ...(segment.visual_focus ?? []),
      ...(segment.cultural_constraints ?? []),
    ]),
    story.visual_symbols?.length ? `视觉符号系统：${story.visual_symbols.join('、')}` : '',
    story.craft_or_ritual_process,
    story.modern_connection ? `当代连接：${story.modern_connection}` : '',
    story.core_message ? `核心传播价值与主信息：${story.core_message}` : '',
    story.slogan_or_key_sentence ? `总结记忆句：${story.slogan_or_key_sentence}` : '',
    story.spatial_identity ? `空间分区与山水主体：${story.spatial_identity}` : '',
    story.visual_route?.length ? `空间路线与镜头次序：${story.visual_route.join('；')}` : '',
    story.time_layer ? `时代与光线变化：${story.time_layer}` : '',
    story.atmosphere ? `意境与声音质感：${story.atmosphere}` : '',
    story.dialogue?.flatMap(block => block.lines.map(line =>
      `人物语言声线与对白气泡：${line.character}（${line.emotion}）：${line.text}`,
    )).join('\n'),
    story.argument_points?.length ? `讲解论点：${story.argument_points.join('；')}` : '',
    story.knowledge_outline?.length ? `知识大纲：${story.knowledge_outline.join('；')}` : '',
    story.source_quotes?.length ? `来源提示或引用线索：${story.source_quotes.join('；')}` : '',
    ...generatedCharacterProductionEvidence(story),
    ...generatedTrainingProductionEvidence(story),
    ...generatedChildrenProductionEvidence(story),
    ...generatedComicProductionEvidence(story),
    ...generatedHistoricalProductionEvidence(story),
    ...generatedSceneShortProductionEvidence(story),
  ].filter((item): item is string => Boolean(item)).join('\n');
}

function generatedCharacterProductionEvidence(story: StoryGenerateResult): string[] {
  if (story.video_type !== 'character_story') return [];

  const characterText = story.characters?.map(character =>
    `${character.name} ${character.role} ${character.description} ${character.arc ?? ''}`,
  ).join('\n') ?? '';
  const storyAndCharacterText = `${story.full_text}\n${characterText}`;
  const hasLifeStageWindow = /少年|青年|中年|晚年|暮年|幼年|童年|初任|新任|刚到.{0,12}任|任.{0,12}期间|生涯.{0,8}阶段/.test(
    storyAndCharacterText,
  );
  const hasRelationshipMap = (story.characters?.length ?? 0) >= 2
    && story.scene_breakdown.some(scene => scene.characters.length >= 2);
  const hasDialogueVoice = story.scene_breakdown.some(scene =>
    Boolean(scene.dialogue_or_narration?.trim()) && scene.characters.length > 0,
  ) || Boolean(story.dialogue?.some(block => block.lines.length > 0));
  const hasFactualLifeBoundary = /来源|依据|知识条目|史料/.test(story.credibility_note)
    && /创作|影视化|虚构|补位|调度/.test(story.credibility_note)
    && story.scene_breakdown.some(scene => Boolean(scene.factual_basis?.trim()));
  const endingScene = story.scene_breakdown.at(-1);
  const hasEndingLegacy = Boolean(
    endingScene?.plot.trim()
    && /结尾|收束|余韵|后果|落点/.test(endingScene.dramatic_function),
  ) || Boolean(story.protagonist_arc?.some(arc => arc.resolution.trim()));

  return [
    hasLifeStageWindow ? `人生阶段窗口：${characterText || story.full_text}` : '',
    hasRelationshipMap
      ? `人物关系图：${story.characters?.map(character => `${character.name}（${character.role}）`).join('、')}`
      : '',
    hasDialogueVoice ? '人物语言声线：对白或旁白已绑定出场人物与具体场景。' : '',
    hasFactualLifeBoundary ? '生平边界：事实依据与影视化补足已逐场分层。' : '',
    hasEndingLegacy ? `结尾影响与余韵：${endingScene?.plot ?? story.protagonist_arc?.at(-1)?.resolution}` : '',
  ];
}

function generatedTrainingProductionEvidence(story: StoryGenerateResult): string[] {
  if (story.video_type !== 'education_training') return [];

  const conceptScene = story.scene_breakdown.find((scene) => {
    if (!/知识讲授|概念讲解|分步讲解/.test(scene.dramatic_function)) return false;
    const plot = scene.plot.trim();
    if (plot.length < 24) return false;
    const hasExplicitDefinition = /是指|定义为|指的是|意味着/.test(plot);
    const hasOrderedDistinction = /第一|首先/.test(plot)
      && /第二|其次|再/.test(plot)
      && /区分|分清|属于|对应|分类/.test(`${plot}${scene.key_action}`);
    return hasExplicitDefinition || hasOrderedDistinction;
  });
  const assessmentScene = story.scene_breakdown.find((scene) => {
    if (!/检验|评估|掌握检查/.test(scene.dramatic_function)) return false;
    const taskText = `${scene.plot}\n${scene.key_action}`;
    return scene.plot.trim().length >= 24
      && /能否|指出|判断|选择|回答|完成|说明/.test(taskText)
      && /分别|属于|答案|反馈|依据|标准|正确|关系/.test(taskText);
  });

  return [
    conceptScene ? `概念定义：${conceptScene.plot}` : '',
    assessmentScene ? `掌握检查：${assessmentScene.plot}；${assessmentScene.key_action}` : '',
  ];
}

function generatedChildrenProductionEvidence(story: StoryGenerateResult): string[] {
  if (story.video_type !== 'children_story') return [];

  const concreteExampleScene = story.scene_breakdown.find((scene) => {
    if (!/学习成长|探索发现|做出选择|勇敢选择/.test(scene.dramatic_function)) return false;
    const actionText = `${scene.plot}\n${scene.key_action}`;
    const hasObservableAction = /看见|观察|听|核对|捡|捆|送|放下|帮助|道歉|尝试|选择|判断/.test(actionText);
    const hasActionSequence = /先.{0,40}再|一根根|一起.{0,20}(完成|面对|送|放|走)|最后/.test(actionText);
    return scene.plot.trim().length >= 36
      && scene.key_action.trim().length >= 8
      && hasObservableAction
      && hasActionSequence;
  });
  const endingScene = story.scene_breakdown.at(-1);
  const endingText = endingScene ? `${endingScene.plot}\n${endingScene.key_action}` : '';
  const hasReusableBehaviorRecap = Boolean(
    endingScene
    && /温暖结尾|成长收获|情绪安放/.test(endingScene.dramatic_function)
    && endingScene.plot.trim().length >= 32
    && /提醒孩子|也记住|学会|明白|可以练习/.test(endingText)
    && /先.{0,30}再|要看.{0,30}(行动|真心)|需要.{0,30}(勇敢|判断|合作|倾听)|可以练习/.test(endingText),
  );

  return [
    concreteExampleScene
      ? `具体例子：${concreteExampleScene.plot}；${concreteExampleScene.key_action}`
      : '',
    hasReusableBehaviorRecap
      ? `家长/教师提示：可用结尾的行为复盘引导孩子讨论——${endingScene?.plot}`
      : '',
  ];
}

function generatedComicProductionEvidence(story: StoryGenerateResult): string[] {
  if (story.video_type !== 'ai_comic_drama') return [];

  const layeredSegment = story.gears_segments.find((segment) => {
    const scene = story.scene_breakdown.find(item => item.scene_id === segment.source_scene_id);
    if (!scene) return false;
    const promptText = [
      scene.visual_prompt,
      scene.camera_suggestion,
      segment.segment_prompt_hint,
      ...(segment.visual_focus ?? []),
    ].filter(Boolean).join('\n');
    const hasSubjectAndAction = scene.characters.length > 0
      && scene.key_action.trim().length >= 8
      && /主体|人物|动作|手|眼|视线|转身|停|放下|护住|逼近|对峙/.test(promptText);
    const hasSpatialComposition = /前景|中景|后景|构图|同框|空间|位置|左|右|远近/.test(promptText);
    const hasCameraLayer = /特写|近景|中景|全景|远景|对切|跟拍|推进|拉远|俯拍|仰拍|镜头/.test(promptText);
    const hasLightOrTime = /光线|雷光|侧光|逆光|晨光|暖光|冷光|冷蓝|雨夜|白天|黄昏|夜晚|清晨/.test(promptText);
    return hasSubjectAndAction && hasSpatialComposition && hasCameraLayer && hasLightOrTime;
  });

  return layeredSegment
    ? [`镜头提示词分层：场景与 GEARS 已对齐主体动作、空间构图、镜头层和光线层；${layeredSegment.segment_prompt_hint}`]
    : [];
}

function generatedHistoricalProductionEvidence(story: StoryGenerateResult): string[] {
  if (story.video_type !== 'historical_drama') return [];

  const datedScenes = story.scene_breakdown.filter(scene =>
    /(?:18|19|20)\d{2}年|\d{1,2}月\d{1,2}日/.test(`${scene.time_of_day}\n${scene.plot}`),
  );
  const sourcedScenes = story.scene_breakdown.filter(scene =>
    Boolean(scene.factual_basis?.trim()) && /依据|条目|记载|用户素材|知识/.test(scene.factual_basis ?? ''),
  );
  const boundedScenes = story.scene_breakdown.filter(scene =>
    Boolean(scene.fictionalized_elements?.some(item =>
      /再现|影视化|合成|不作为|不替代|不声称|不虚构/.test(item),
    )),
  );
  const chainText = story.scene_breakdown.map(scene => `${scene.plot}\n${scene.key_action}\n${scene.conflict ?? ''}`).join('\n');
  const distinctLocations = new Set(story.scene_breakdown.map(scene => scene.location.trim()).filter(Boolean));
  const hasCausalProgression = distinctLocations.size >= 2
    && /(因为|由于|导致|迫使|才有|才能|获得.{0,20}后|随后|由此)/.test(chainText);
  const hasVisibleStakes = story.scene_breakdown.some(scene =>
    /风险|伤亡|失败|搜捕|暴露|封锁|无法|不能/.test(`${scene.plot}\n${scene.conflict ?? ''}`)
    && /选择|决定|等待|提前|承担|必须/.test(`${scene.plot}\n${scene.key_action}\n${scene.conflict ?? ''}`),
  );
  const factionText = story.scene_breakdown.flatMap(scene => scene.characters).join('、') + chainText;
  const factionSignals = ['新军士兵', '起义军', '普通士兵', '清军', '守军', '军官']
    .filter(label => factionText.includes(label));
  const hasFactionPositions = new Set(factionSignals).size >= 3
    && /阻拦|封锁|搜捕|对峙|逼近|推进/.test(chainText);
  const hasEvidenceHierarchy = sourcedScenes.length >= 2
    && boundedScenes.length >= 2
    && /来源|依据|知识条目/.test(story.credibility_note)
    && /创作|影视化|补位|再现/.test(story.credibility_note);
  const hasHistoricalChain = datedScenes.length >= 2
    && sourcedScenes.length >= 2
    && boundedScenes.length >= 2
    && hasCausalProgression
    && hasVisibleStakes;
  const eventAnchor = datedScenes[0];
  const turningScene = story.scene_breakdown.find(scene =>
    /关键行动|高潮|冲突升级/.test(scene.dramatic_function)
    && /推开|攻占|搬出|分发|冲开|发动|推进/.test(`${scene.plot}\n${scene.key_action}`),
  );

  if (!hasHistoricalChain || !eventAnchor || !turningScene) return [];
  return [
    `历史事件锚点：${story.title}；${eventAnchor.plot}`,
    `历史时间窗口：${datedScenes.map(scene => scene.time_of_day).join('—')}`,
    `历史利害与风险：${story.scene_breakdown.find(scene => scene.conflict)?.conflict ?? eventAnchor.plot}`,
    hasFactionPositions ? `各方立场：${[...new Set(factionSignals)].join('、')}围绕搜捕、封锁与推进形成行动对撞。` : '',
    `事件因果链：${story.scene_breakdown.map(scene => scene.key_action).join(' → ')}`,
    hasEvidenceHierarchy ? '史料证据层级：逐场区分知识条目/用户素材依据与合成再现、影视化补足。' : '',
    `有据行动：${sourcedScenes.map(scene => scene.factual_basis).join('；')}`,
    `冲突转折点：${turningScene.plot}；${turningScene.key_action}`,
  ];
}

function generatedSceneShortProductionEvidence(story: StoryGenerateResult): string[] {
  if (story.video_type !== 'scene_short') return [];

  const scenes = story.scene_breakdown;
  const observerNames = scenes.flatMap(scene => scene.characters).filter(Boolean);
  const observer = observerNames.find(name =>
    scenes.filter(scene => scene.characters.includes(name)).length >= Math.min(3, scenes.length),
  );
  const distinctLocations = [...new Set(scenes.map(scene => scene.location.trim()).filter(Boolean))];
  const routeText = scenes.map(scene => `${scene.plot}\n${scene.key_action}\n${scene.camera_suggestion}`).join('\n');
  const revealScene = scenes.find(scene =>
    /揭示|显现|打开|推开|转过|进入视野/.test(`${scene.plot}\n${scene.key_action}`)
    && /前景|后景|由暗到明|遮挡|入口|门槛/.test(scene.visual_prompt),
  );
  const hasMovementRoute = Boolean(observer)
    && distinctLocations.length >= 2
    && /从.{1,30}(进入|走向|经过)|沿.{1,30}(前行|走到|返回)|由外向内/.test(routeText);
  const hasSpatialContinuity = scenes.some(scene =>
    /原路线返回|回程/.test(`${scene.plot}\n${scene.key_action}`)
    && /保持同侧|同一方向|不跨轴|方向锚点/.test(`${scene.visual_prompt}\n${scene.camera_suggestion}`),
  );

  return [
    observer ? `进入人物：${observer}作为跨场观察者进入空间。` : '',
    hasMovementRoute
      ? `人物运动路线：${scenes.map(scene => `${scene.location}（${scene.key_action}）`).join(' → ')}`
      : '',
    revealScene ? `空间揭示：${revealScene.plot}；${revealScene.visual_prompt}` : '',
    hasSpatialContinuity ? '空间连续：人物沿原路线回程，方向锚点保持同侧且镜头不跨轴。' : '',
  ];
}

function materialPackHasPurpose(materialPack: MaterialPack | undefined, purpose: string): boolean {
  if (!materialPack) return false;
  return [
    ...materialPack.primary_materials,
    ...materialPack.supporting_materials,
    ...materialPack.reference_materials,
  ].some(material => material.purpose.some(item => item === purpose));
}

function materialPackToText(materialPack: MaterialPack | undefined, contextText: string | undefined): string {
  if (!materialPack) return contextText ?? '';
  const materialLines = [
    ...materialPack.primary_materials,
    ...materialPack.supporting_materials,
    ...materialPack.reference_materials,
  ].flatMap(material => [
    material.title,
    material.summary,
    material.provenance,
    material.role_in_story,
    ...(material.tags ?? []),
    ...material.purpose,
  ]);
  const assetLines = materialPack.visual_assets.flatMap(asset => [
    asset.label,
    asset.kind,
    asset.description,
  ]);
  return [
    contextText,
    ...materialLines,
    ...assetLines,
    ...materialPack.verified_facts,
    ...materialPack.uncertain_claims,
    ...materialPack.creative_space,
    materialPack.brand_or_institution_profile?.name,
    materialPack.brand_or_institution_profile?.client_type,
    ...(materialPack.brand_or_institution_profile?.verified_claims ?? []),
    ...(materialPack.brand_or_institution_profile?.forbidden_claims ?? []),
    materialPack.source_work_profile?.title,
    materialPack.source_work_profile?.adaptation_boundary,
    ...(materialPack.source_work_profile?.core_characters ?? []),
    ...(materialPack.source_work_profile?.must_keep ?? []),
  ].filter((item): item is string => Boolean(item)).join('\n');
}

function normalizeSearchText(text: string): string {
  return text.toLowerCase();
}

function humanizeFieldId(fieldId: string): string {
  return fieldId
    .split('_')
    .filter(Boolean)
    .join(' ');
}
