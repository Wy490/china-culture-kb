import { FullEntryDetail } from '../types.js';
import { getEntryDetail } from './get-entry-detail.js';

type VideoType =
  | 'character_story'
  | 'historical_drama'
  | 'legend_story'
  | 'culture_promo'
  | 'heritage_promo'
  | 'city_brand_promo'
  | 'scene_short'
  | 'landscape_mood'
  | 'documentary_short'
  | 'explainer_video'
  | 'lecture_video'
  | 'education_training'
  | 'children_story'
  | 'social_short'
  | 'ai_comic_drama';

type PresentationStyle =
  | 'cinematic'
  | 'documentary'
  | 'host_narration'
  | 'voiceover_montage'
  | 'vertical_drama'
  | 'ai_comic'
  | 'animation_2d'
  | 'ink_style'
  | 'children_animation'
  | 'museum_exhibit'
  | 'social_media_fastcut';

type StoryStructureType =
  | 'single_event_drama'
  | 'three_act_drama'
  | 'case_reconstruction'
  | 'memory_mosaic_biography'
  | 'object_clue_journey'
  | 'craft_process'
  | 'spatial_walkthrough'
  | 'problem_solution_explainer';

type SupportedDuration = '30秒' | '1分钟' | '3分钟' | '5分钟' | '8分钟' | '10分钟' | '15分钟' | '20分钟';
type EvidenceBoundaryType = 'verified' | 'uncertain' | 'creative_treatment';
type CreationUseCase =
  | 'original_ai_comic'
  | 'adapted_ai_comic'
  | 'institutional_promo'
  | 'documentary_short'
  | 'brand_commercial'
  | 'education_training'
  | 'public_service';
type TruthMode =
  | 'fictional_original'
  | 'inspired_by_material'
  | 'source_adaptation'
  | 'factual_reconstruction'
  | 'institutional_verified';
type MaterialSufficiencyStage = 'minimum_viable_story' | 'script_ready' | 'production_ready';
type MaterialBlockingLevel = 'blocking' | 'risk' | 'optional';
type MaterialTokenRisk = 'low' | 'medium' | 'high';
type MaterialSufficiencyStageStatus = 'ready' | 'needs_input' | 'blocked';
type MaterialGenerationPosture =
  | 'ready'
  | 'draft_needs_verification'
  | 'script_ready_production_pending'
  | 'blocked_until_input';

interface GenreProfileLite {
  video_type: VideoType;
  label: string;
  narrative_promise: string;
  default_presentation_style: PresentationStyle;
  default_story_structure: StoryStructureType;
  framework: string[];
  must_include: string[];
  scene_rules: string[];
  gears_rules: string[];
}

interface EvidenceBoundary {
  boundary_id: string;
  label: string;
  type: EvidenceBoundaryType;
  source: string;
  note: string;
}

interface StoryGenreBeat {
  beat_id: string;
  order: number;
  function_label: string;
  function_description: string;
  content_requirement: string;
  emotional_turn: string;
  evidence_boundary_ids: string[];
}

interface StoryCharacterArcPlan {
  character_name: string;
  starting_state: string;
  pressure: string;
  turning_point: string;
  ending_state: string;
}

interface MaterialSufficiencyMissingItem {
  item_id: string;
  label: string;
  reason: string;
  blocking_level: MaterialBlockingLevel;
  affects: string[];
  recommended_question: string;
}

interface MaterialSufficiencyStageReport {
  stage: MaterialSufficiencyStage;
  status: MaterialSufficiencyStageStatus;
  score: number;
  can_proceed: boolean;
  required_items: string[];
  available_outputs: string[];
  missing_items: MaterialSufficiencyMissingItem[];
  optional_items: MaterialSufficiencyMissingItem[];
  notes: string[];
}

interface MaterialSufficiencyReport {
  schema_version: 'material-sufficiency/v1';
  stage: MaterialSufficiencyStage;
  active_stage?: MaterialSufficiencyStage;
  score: number;
  can_generate: boolean;
  can_generate_with_risks: boolean;
  blocked: boolean;
  needs_verification?: boolean;
  generation_posture?: MaterialGenerationPosture;
  next_stage?: MaterialSufficiencyStage;
  downgrade_reason?: string;
  stage_reports?: MaterialSufficiencyStageReport[];
  missing_items: MaterialSufficiencyMissingItem[];
  optional_items: MaterialSufficiencyMissingItem[];
  token_risk: MaterialTokenRisk;
  recommended_next_questions: string[];
}

interface CreationContract {
  schema_version: 'creation-contract/v1';
  creation_use_case: CreationUseCase;
  truth_mode: TruthMode;
  client_type?: string;
  target_audience?: string;
  communication_goal?: string;
  video_type: VideoType;
  presentation_style: PresentationStyle;
  story_structure: StoryStructureType;
  narrative_pattern_ids: string[];
  allowed_fiction: string[];
  must_verify: string[];
  forbidden_moves: string[];
  required_disclaimers: string[];
  material_sufficiency: MaterialSufficiencyReport;
  delivery_expectation: string[];
}

export interface GenerateStoryBlueprintInput {
  entry_name: string;
  video_type?: VideoType;
  presentation_style?: PresentationStyle;
  story_structure?: StoryStructureType;
  target_duration?: SupportedDuration;
  central_event?: string;
  user_outline?: string;
  region_hint?: string;
  creation_use_case?: CreationUseCase;
  truth_mode?: TruthMode;
  client_type?: string;
  target_audience?: string;
  communication_goal?: string;
}

export interface GenerateStoryBlueprintResult {
  blueprint: {
    schema_version: 'story-blueprint/v1';
    entry_name: string;
    source_entry: string;
    video_type: VideoType;
    presentation_style: PresentationStyle;
    story_structure: StoryStructureType;
    target_duration: SupportedDuration;
    central_event?: string;
    central_question: string;
    protagonist?: string;
    genre_beats: StoryGenreBeat[];
    character_arcs: StoryCharacterArcPlan[];
    evidence_boundaries: EvidenceBoundary[];
    type_specific_requirements: string[];
    creation_contract: CreationContract;
    material_sufficiency: MaterialSufficiencyReport;
  };
  profile_summary: Pick<GenreProfileLite, 'video_type' | 'label' | 'narrative_promise' | 'must_include' | 'scene_rules' | 'gears_rules'>;
  source_entry: FullEntryDetail;
  warnings: string[];
}

const DURATION_SCENE_COUNT: Record<SupportedDuration, number> = {
  '30秒': 3,
  '1分钟': 4,
  '3分钟': 5,
  '5分钟': 6,
  '8分钟': 7,
  '10分钟': 8,
  '15分钟': 9,
  '20分钟': 10,
};

const PROFILES: Record<VideoType, GenreProfileLite> = {
  character_story: {
    video_type: 'character_story',
    label: '人物故事',
    narrative_promise: '围绕人物选择、阻力、代价和精神落点展开。',
    default_presentation_style: 'cinematic',
    default_story_structure: 'single_event_drama',
    framework: ['钩子开场', '主角处境', '冲突升级', '关键行动', '高潮选择', '余味结尾'],
    must_include: ['主角目标', '可视化阻力', '价值选择', '选择代价', '人物弧光', '可信度边界'],
    scene_rules: ['每场推进人物处境或选择压力', '结尾体现人物精神变化'],
    gears_rules: ['script_text 保留核心动作与关键对白', 'segment_prompt_hint 标明人物选择和情绪压力'],
  },
  historical_drama: {
    video_type: 'historical_drama',
    label: '历史剧情短片',
    narrative_promise: '在史实锚点下还原历史事件中的压力、因果和人物选择。',
    default_presentation_style: 'cinematic',
    default_story_structure: 'case_reconstruction',
    framework: ['时代危机', '人物卷入', '制度压力', '关键行动', '正面冲突', '历史余响'],
    must_include: ['历史场景质感', '事件因果', '史实锚点', '影视化边界'],
    scene_rules: ['每场标出事件因果', '关键冲突不能脱离史实锚点'],
    gears_rules: ['分段保留史实边界提示', '视觉提示服务时代质感'],
  },
  legend_story: {
    video_type: 'legend_story',
    label: '神话/传说故事',
    narrative_promise: '以传说意象和凡人选择呈现民间故事的象征力量。',
    default_presentation_style: 'ink_style',
    default_story_structure: 'object_clue_journey',
    framework: ['传说起源', '神异显现', '凡人考验', '命运转折', '传说流传'],
    must_include: ['神异元素', '象征画面', '民间版本提示', '传说与史实边界'],
    scene_rules: ['神异元素必须服务人的选择', '保留传说质感'],
    gears_rules: ['视觉提示突出象征意象', '约束提示标明传说边界'],
  },
  culture_promo: {
    video_type: 'culture_promo',
    label: '文化宣传片',
    narrative_promise: '用视觉符号、核心主张和当代连接推广文化主题。',
    default_presentation_style: 'voiceover_montage',
    default_story_structure: 'problem_solution_explainer',
    framework: ['视觉钩子', '文化身份', '核心价值', '当代连接', '传播金句'],
    must_include: ['核心文化符号', '一句话主张', '当代连接', '传播句'],
    scene_rules: ['每场围绕一个可见文化符号', '避免只喊口号'],
    gears_rules: ['分段短句化', '提示主视觉和传播节奏'],
  },
  heritage_promo: {
    video_type: 'heritage_promo',
    label: '非遗/工艺宣传片',
    narrative_promise: '通过手、工具、流程和传承压力呈现技艺价值。',
    default_presentation_style: 'documentary',
    default_story_structure: 'craft_process',
    framework: ['材料亮相', '手部技法', '关键工序', '传承困境', '当代价值'],
    must_include: ['手部动作', '工具材料', '工艺流程', '传承关系', '现代连接'],
    scene_rules: ['每场至少一个工艺动作或工具', '传承困境要可见'],
    gears_rules: ['视觉提示强调手、工具、材料质感', 'script_text 保留工序顺序'],
  },
  city_brand_promo: {
    video_type: 'city_brand_promo',
    label: '城市/文旅宣传片',
    narrative_promise: '用地理识别、城市气质和古今连接建立地方品牌。',
    default_presentation_style: 'voiceover_montage',
    default_story_structure: 'spatial_walkthrough',
    framework: ['地标开场', '历史记忆', '城市气质', '当代生活', '品牌收束'],
    must_include: ['地理识别', '城市气质', '古今连接', '文旅记忆点'],
    scene_rules: ['地点必须具体', '古今连接不能空泛'],
    gears_rules: ['提示空间路线和地标识别', '保留城市品牌句'],
  },
  scene_short: {
    video_type: 'scene_short',
    label: '场景短片',
    narrative_promise: '以空间路线、时间层和氛围变化呈现场所记忆。',
    default_presentation_style: 'cinematic',
    default_story_structure: 'spatial_walkthrough',
    framework: ['进入空间', '路径推进', '细节发现', '时间回声', '氛围结尾'],
    must_include: ['空间路线', '时间层', '视觉焦点', '氛围收束'],
    scene_rules: ['每场对应一个空间节点', '动作服务空间发现'],
    gears_rules: ['segment_prompt_hint 标明空间路线', 'visual_prompt 保留光线和构图'],
  },
  landscape_mood: {
    video_type: 'landscape_mood',
    label: '山水意境片',
    narrative_promise: '通过山水、季节、声音、光影和留白营造文化意境。',
    default_presentation_style: 'ink_style',
    default_story_structure: 'spatial_walkthrough',
    framework: ['远景入画', '季节声息', '人文痕迹', '光影转折', '留白结尾'],
    must_include: ['山水主体', '季节/天气', '声音', '光影', '留白'],
    scene_rules: ['少解释，多画面', '人文痕迹点到为止'],
    gears_rules: ['提示慢节奏和留白', '视觉提示强调自然层次'],
  },
  documentary_short: {
    video_type: 'documentary_short',
    label: '微纪录片',
    narrative_promise: '用现场、文献依据和当代观察连接真实文化议题。',
    default_presentation_style: 'documentary',
    default_story_structure: 'case_reconstruction',
    framework: ['现实现场', '文献线索', '人物访谈', '历史回看', '当代回响'],
    must_include: ['真实地点', '来源线索', '观察者视角', '当代连接'],
    scene_rules: ['避免过度戏剧化', '每场有可核查信息或现场观察'],
    gears_rules: ['提示纪实镜头和资料边界', '保留现场声音或旁白节奏'],
  },
  explainer_video: {
    video_type: 'explainer_video',
    label: '知识讲解视频',
    narrative_promise: '用问题、概念、例子和可视化解释讲清一个知识点。',
    default_presentation_style: 'host_narration',
    default_story_structure: 'problem_solution_explainer',
    framework: ['提出问题', '解释概念', '举出例子', '可视化拆解', '总结带走'],
    must_include: ['核心问题', '概念定义', '例子', '可视化比喻', '结论'],
    scene_rules: ['一场只讲一个知识点', '避免概念堆叠'],
    gears_rules: ['提示图解元素', 'script_text 保留清晰讲解句'],
  },
  lecture_video: {
    video_type: 'lecture_video',
    label: '宣讲片',
    narrative_promise: '用观点、论据、案例和精神提炼完成有说服力的表达。',
    default_presentation_style: 'host_narration',
    default_story_structure: 'problem_solution_explainer',
    framework: ['提出观点', '历史依据', '案例阐释', '价值提炼', '号召收束'],
    must_include: ['明确论点', '论据', '案例', '精神提炼', '行动号召'],
    scene_rules: ['观点和案例要对应', '避免空泛口号'],
    gears_rules: ['提示主讲人与案例画面切换', '保留论点金句'],
  },
  education_training: {
    video_type: 'education_training',
    label: '教育/培训片',
    narrative_promise: '用学习目标、步骤、练习和复盘组织可教学内容。',
    default_presentation_style: 'host_narration',
    default_story_structure: 'problem_solution_explainer',
    framework: ['学习目标', '步骤一', '步骤二', '练习示范', '复盘总结'],
    must_include: ['学习目标', '步骤', '示范', '练习', '复盘'],
    scene_rules: ['步骤必须可操作', '每场只承担一个教学目标'],
    gears_rules: ['提示字幕和步骤卡片', 'script_text 保留教学指令'],
  },
  children_story: {
    video_type: 'children_story',
    label: '儿童故事',
    narrative_promise: '用儿童可理解的因果、温和冲突和正向选择表达文化价值。',
    default_presentation_style: 'children_animation',
    default_story_structure: 'three_act_drama',
    framework: ['小主人公', '遇到问题', '探索发现', '勇敢选择', '温暖结尾'],
    must_include: ['儿童可理解语言', '正向价值', '清楚因果', '温暖安全的情绪'],
    scene_rules: ['每场只承载一个简单行动', '冲突不宜过重'],
    gears_rules: ['视觉提示明亮温和', '分段文本适合儿童动画'],
  },
  social_short: {
    video_type: 'social_short',
    label: '竖屏短视频',
    narrative_promise: '用 3 秒钩子、高密度信息和定格记忆点完成快速传播。',
    default_presentation_style: 'social_media_fastcut',
    default_story_structure: 'problem_solution_explainer',
    framework: ['三秒钩子', '反差信息', '快速展示', '记忆点', '定格收束'],
    must_include: ['开场钩子', '反差信息', '高密度画面', '字幕记忆点'],
    scene_rules: ['节奏快，信息短', '每场有明确视觉变化'],
    gears_rules: ['提示竖屏快切和字幕', 'script_text 短句化'],
  },
  ai_comic_drama: {
    video_type: 'ai_comic_drama',
    label: 'AI漫剧',
    narrative_promise: '用强分镜、强对白、强表情和结尾钩子推动追看。',
    default_presentation_style: 'ai_comic',
    default_story_structure: 'single_event_drama',
    framework: ['钩子开场', '人物登场', '对白冲突', '反转觉醒', '高燃收束'],
    must_include: ['对白/旁白', '表情标注', '漫画分镜画面', '结尾钩子'],
    scene_rules: ['每场都有可画成定格的画面', '每场都有情绪或表情变化'],
    gears_rules: ['segment_prompt_hint 必须提示漫画分镜感', 'script_text 保留对白和情绪'],
  },
};

const ENTRY_TYPE_TO_VIDEO_TYPE: Record<string, VideoType> = {
  历史人物: 'character_story',
  神话传说: 'legend_story',
  民间故事: 'legend_story',
  非遗: 'heritage_promo',
  传统工艺: 'heritage_promo',
  饮食文化: 'culture_promo',
  节庆习俗: 'culture_promo',
  地方戏曲: 'culture_promo',
  民俗活动: 'culture_promo',
  名胜古迹: 'scene_short',
  地方掌故: 'documentary_short',
  宗教信仰: 'documentary_short',
};

function resolveVideoType(entry: FullEntryDetail, videoType?: VideoType): VideoType {
  return videoType ?? ENTRY_TYPE_TO_VIDEO_TYPE[entry.type] ?? 'character_story';
}

function resolveCreationUseCase(input: GenerateStoryBlueprintInput, videoType: VideoType): CreationUseCase {
  if (input.creation_use_case) return input.creation_use_case;
  if (videoType === 'ai_comic_drama') return 'original_ai_comic';
  if (videoType === 'documentary_short') return 'documentary_short';
  if (videoType === 'education_training') return 'education_training';
  if (videoType === 'city_brand_promo' || videoType === 'social_short') return 'brand_commercial';
  if (videoType === 'lecture_video' || videoType === 'explainer_video') return 'institutional_promo';
  return 'institutional_promo';
}

function resolveTruthMode(input: GenerateStoryBlueprintInput, useCase: CreationUseCase, videoType: VideoType): TruthMode {
  if (input.truth_mode) return input.truth_mode;
  if (useCase === 'adapted_ai_comic') return 'source_adaptation';
  if (useCase === 'original_ai_comic') return 'fictional_original';
  if (useCase === 'documentary_short' || videoType === 'documentary_short') return 'factual_reconstruction';
  if (['institutional_promo', 'education_training', 'public_service'].includes(useCase)) return 'institutional_verified';
  return 'inspired_by_material';
}

function missingItem(
  item_id: string,
  label: string,
  reason: string,
  blocking_level: MaterialBlockingLevel,
  affects: string[],
  recommended_question: string,
): MaterialSufficiencyMissingItem {
  return { item_id, label, reason, blocking_level, affects, recommended_question };
}

const SUFFICIENCY_STAGE_ORDER: MaterialSufficiencyStage[] = [
  'minimum_viable_story',
  'script_ready',
  'production_ready',
];

const STAGE_OUTPUTS: Record<MaterialSufficiencyStage, string[]> = {
  minimum_viable_story: ['故事方向', 'logline', '类型蓝图', '粗场景'],
  script_ready: ['完整剧本', '对白/旁白', '场景拆分', '质量报告'],
  production_ready: ['分镜资产说明', '角色/场景/道具约束', '交付包 readiness', '生产指挥清单'],
};

const STAGE_REQUIRED_ITEMS: Record<MaterialSufficiencyStage, string[]> = {
  minimum_viable_story: ['主题或主体', '主角/对象', '基本目标或传播目的'],
  script_ready: ['关键事实', '人物/机构/原作边界', '真实度口径'],
  production_ready: ['视觉资产', '地点/服饰/品牌规范', '禁用项和交付边界'],
};

function requiredStageForGeneration(creationUseCase: CreationUseCase, truthMode: TruthMode): MaterialSufficiencyStage {
  if (['institutional_verified', 'factual_reconstruction', 'source_adaptation'].includes(truthMode)) return 'script_ready';
  if (['institutional_promo', 'education_training', 'public_service', 'documentary_short'].includes(creationUseCase)) return 'script_ready';
  return 'minimum_viable_story';
}

function stageIndex(stage: MaterialSufficiencyStage): number {
  return SUFFICIENCY_STAGE_ORDER.indexOf(stage);
}

function nextStage(stage: MaterialSufficiencyStage): MaterialSufficiencyStage | undefined {
  return SUFFICIENCY_STAGE_ORDER[stageIndex(stage) + 1];
}

function uniqueMissingItems(items: MaterialSufficiencyMissingItem[]): MaterialSufficiencyMissingItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.item_id)) return false;
    seen.add(item.item_id);
    return true;
  });
}

function buildStageReport(input: {
  stage: MaterialSufficiencyStage;
  baseScore: number;
  missingItems: MaterialSufficiencyMissingItem[];
  optionalItems?: MaterialSufficiencyMissingItem[];
  notes?: string[];
}): MaterialSufficiencyStageReport {
  const missingItems = uniqueMissingItems(input.missingItems);
  const optionalItems = uniqueMissingItems(input.optionalItems ?? []);
  const blockingCount = missingItems.filter(item => item.blocking_level === 'blocking').length;
  const riskCount = missingItems.filter(item => item.blocking_level === 'risk').length;
  const score = Math.max(0, Math.min(100, input.baseScore - blockingCount * 35 - riskCount * 15 - Math.min(optionalItems.length, 3) * 4));
  const status: MaterialSufficiencyStageStatus = blockingCount > 0 ? 'blocked' : riskCount > 0 ? 'needs_input' : 'ready';
  return {
    stage: input.stage,
    status,
    score,
    can_proceed: blockingCount === 0,
    required_items: STAGE_REQUIRED_ITEMS[input.stage],
    available_outputs: blockingCount === 0 ? STAGE_OUTPUTS[input.stage] : [],
    missing_items: missingItems,
    optional_items: optionalItems,
    notes: input.notes ?? [],
  };
}

function buildMaterialSufficiencyReport(
  entry: FullEntryDetail,
  input: GenerateStoryBlueprintInput,
  creationUseCase: CreationUseCase,
  truthMode: TruthMode,
): MaterialSufficiencyReport {
  const requiredStage = requiredStageForGeneration(creationUseCase, truthMode);
  const minimumMissing: MaterialSufficiencyMissingItem[] = [];
  const minimumOptional: MaterialSufficiencyMissingItem[] = [];
  const scriptMissing: MaterialSufficiencyMissingItem[] = [];
  const productionMissing: MaterialSufficiencyMissingItem[] = [];
  const hasOutline = Boolean(input.user_outline?.trim());
  const hasClientContext = Boolean(input.client_type?.trim() || input.communication_goal?.trim() || input.target_audience?.trim());
  const baseScore = entry.credibility === '可靠' ? 92 : entry.credibility === '基本可靠' ? 84 : 74;

  if (!entry.summary?.trim() && !entry.story?.trim() && !hasOutline) {
    minimumMissing.push(missingItem(
      'minimum_story_anchor',
      '主题/主体/基本目标',
      '最小可行故事至少需要来源条目摘要、故事梗概或用户大纲作为主体和方向。',
      'blocking',
      ['story_blueprint', 'logline'],
      '本片围绕谁/什么对象展开？最基本的目标或主题是什么？',
    ));
  }

  if (truthMode === 'source_adaptation' && !input.user_outline?.trim()) {
    scriptMissing.push(missingItem(
      'source_work_profile',
      '原作/改编素材边界',
      '改编蓝图需要原作主线、人物关系和保留项。',
      'blocking',
      ['story_blueprint', 'adaptation_fidelity'],
      '请补充原作主线、核心人物、必须保留的情节和授权/改编边界。',
    ));
  }
  if (truthMode === 'institutional_verified' && !input.client_type?.trim()) {
    scriptMissing.push(missingItem(
      'institution_profile',
      '机构/品牌审定口径',
      '机构审定模式需要客户身份、表达口径和禁用表述。',
      'blocking',
      ['creation_contract', 'quality_report'],
      '本片代表哪个机构/品牌发声？有哪些必须使用或禁止使用的表述？',
    ));
  }
  if (['institutional_verified', 'factual_reconstruction'].includes(truthMode) && entry.unverifiedPoints.length > 0) {
    scriptMissing.push(missingItem(
      'unverified_points',
      '待核实事实',
      '条目存在待核实点，高真实度模式不能把这些内容写成确定事实。',
      truthMode === 'institutional_verified' ? 'blocking' : 'risk',
      ['evidence_boundaries', 'full_text'],
      '请确认待核实点哪些可以写成事实，哪些只能写成传说/推测/影视化处理。',
    ));
  }
  if (!hasClientContext && ['institutional_promo', 'brand_commercial', 'public_service'].includes(creationUseCase)) {
    productionMissing.push(missingItem(
      'client_context',
      '客户/受众/传播目标',
      '进入生产指挥前需要明确客户、受众和传播目标，避免分镜资产偏离用途。',
      'risk',
      ['production_ready', 'review'],
      '本片的客户/机构、目标受众和传播目标分别是什么？',
    ));
  }
  productionMissing.push(missingItem(
    'visual_assets',
    '视觉资产',
    '生产前仍需角色、场景、道具、品牌规范等视觉资产。',
    'risk',
    ['production_ready', 'asset_handoff'],
    '是否已有角色、场景、道具或品牌视觉规范可作为参考？',
  ));

  if (truthMode === 'fictional_original' && !hasOutline) {
    minimumOptional.push(missingItem(
      'worldbuilding_anchor',
      '原创设定锚点',
      '原创蓝图可以先生成，但补充世界观、主角欲望和对手压力会更稳定。',
      'optional',
      ['story_blueprint', 'characters'],
      '这个原创故事的世界观、主角欲望、对手压力和视觉风格是什么？',
    ));
  }

  const stageReports = [
    buildStageReport({
      stage: 'minimum_viable_story',
      baseScore,
      missingItems: minimumMissing,
      optionalItems: minimumOptional,
      notes: ['最小阶段允许先形成方向、logline、蓝图和粗场景。'],
    }),
    buildStageReport({
      stage: 'script_ready',
      baseScore,
      missingItems: scriptMissing,
      notes: ['剧本阶段要求关键事实、原作/机构边界和真实度口径足够清楚。'],
    }),
    buildStageReport({
      stage: 'production_ready',
      baseScore,
      missingItems: productionMissing,
      notes: ['生产阶段聚焦视觉资产、地点服饰、品牌规范、禁用项和交付边界。'],
    }),
  ];
  const targetReport = stageReports.find(report => report.stage === requiredStage) ?? stageReports[0];
  const minimumReport = stageReports[0];
  const scriptReport = stageReports[1];
  const productionReport = stageReports[2];
  const activeStage = productionReport.status === 'ready'
    ? 'production_ready'
    : scriptReport.status === 'ready'
      ? 'script_ready'
      : minimumReport.status === 'ready'
        ? 'minimum_viable_story'
        : requiredStage;
  const blocked = !targetReport.can_proceed || !minimumReport.can_proceed;
  const targetRiskCount = targetReport.missing_items.filter(item => item.blocking_level === 'risk').length;
  const needsVerification = !blocked && targetRiskCount > 0;
  const topMissing = uniqueMissingItems([
    ...minimumReport.missing_items,
    ...targetReport.missing_items,
  ]);
  const topOptional = uniqueMissingItems([
    ...minimumReport.optional_items,
    ...targetReport.optional_items,
    ...stageReports
      .filter(report => stageIndex(report.stage) > stageIndex(requiredStage))
      .flatMap(report => [
        ...report.missing_items.map(item => ({ ...item, blocking_level: 'optional' as const })),
        ...report.optional_items,
      ]),
  ]);
  const tokenRisk: MaterialTokenRisk = input.user_outline && input.user_outline.length > 3000 ? 'medium' : 'low';
  const generationPosture: MaterialGenerationPosture = blocked
    ? 'blocked_until_input'
    : needsVerification || targetReport.status === 'needs_input'
      ? 'draft_needs_verification'
      : productionReport.status !== 'ready'
        ? 'script_ready_production_pending'
        : 'ready';

  return {
    schema_version: 'material-sufficiency/v1',
    stage: requiredStage,
    active_stage: activeStage,
    score: targetReport.score,
    can_generate: !blocked,
    can_generate_with_risks: !blocked && (needsVerification || topOptional.length > 0 || tokenRisk !== 'low'),
    blocked,
    needs_verification: needsVerification,
    generation_posture: generationPosture,
    next_stage: blocked ? requiredStage : stageReports.find(report => !report.can_proceed)?.stage ?? nextStage(activeStage),
    downgrade_reason: blocked
      ? targetReport.missing_items.find(item => item.blocking_level === 'blocking')?.reason
      : needsVerification
        ? targetReport.missing_items.find(item => item.blocking_level === 'risk')?.reason
        : undefined,
    stage_reports: stageReports,
    missing_items: topMissing,
    optional_items: topOptional,
    token_risk: tokenRisk,
    recommended_next_questions: uniqueMissingItems([...topMissing, ...topOptional]).map(item => item.recommended_question),
  };
}

function truthModeRules(truthMode: TruthMode): Pick<CreationContract, 'allowed_fiction' | 'must_verify' | 'forbidden_moves' | 'required_disclaimers'> {
  if (truthMode === 'fictional_original') {
    return {
      allowed_fiction: ['可原创人物、事件、冲突和世界观。'],
      must_verify: ['不得冒充真实历史、真实机构或真实人物事实。'],
      forbidden_moves: ['把原创设定写成已发生史实。'],
      required_disclaimers: ['必要时标注为原创虚构或架空创作。'],
    };
  }
  if (truthMode === 'source_adaptation') {
    return {
      allowed_fiction: ['可压缩、合并、重排场景以适配成片节奏。'],
      must_verify: ['原作主线、核心人物关系、授权与改编边界。'],
      forbidden_moves: ['偏离原作主线或用知识库条目替换原作情节。'],
      required_disclaimers: ['标明改编来源与影视化处理边界。'],
    };
  }
  if (truthMode === 'factual_reconstruction') {
    return {
      allowed_fiction: ['可做场景调度、镜头动作和必要的影视化补足。'],
      must_verify: ['关键事实、时间、地点、数据、人物身份和结论。'],
      forbidden_moves: ['虚构关键事实、虚构结论、虚构真实人物确定发言。'],
      required_disclaimers: ['标明事实依据、再现内容和推测边界。'],
    };
  }
  if (truthMode === 'institutional_verified') {
    return {
      allowed_fiction: ['仅允许表达方式、镜头调度和非事实性视觉转场的创作处理。'],
      must_verify: ['机构口径、数据、称谓、政策表述、品牌规范和人物发言。'],
      forbidden_moves: ['未核实数据、虚构机构成果、虚构人物发言、过度戏剧化冲突。'],
      required_disclaimers: ['必要时标明素材待审、口径待核或示意画面。'],
    };
  }
  return {
    allowed_fiction: ['可基于素材做戏剧化创作和视觉化补足。'],
    must_verify: ['核心事实、人物身份、地点、时代与机构相关表述。'],
    forbidden_moves: ['把象征、联想或支撑素材写成确定事实。'],
    required_disclaimers: ['必要时区分素材启发、合理想象和已确认事实。'],
  };
}

function buildCreationContract(input: {
  request: GenerateStoryBlueprintInput;
  creationUseCase: CreationUseCase;
  truthMode: TruthMode;
  materialSufficiency: MaterialSufficiencyReport;
  videoType: VideoType;
  presentationStyle: PresentationStyle;
  storyStructure: StoryStructureType;
}): CreationContract {
  const rules = truthModeRules(input.truthMode);
  return {
    schema_version: 'creation-contract/v1',
    creation_use_case: input.creationUseCase,
    truth_mode: input.truthMode,
    client_type: input.request.client_type,
    target_audience: input.request.target_audience,
    communication_goal: input.request.communication_goal,
    video_type: input.videoType,
    presentation_style: input.presentationStyle,
    story_structure: input.storyStructure,
    narrative_pattern_ids: [],
    ...rules,
    material_sufficiency: input.materialSufficiency,
    delivery_expectation: [
      `素材当前目标阶段：${input.materialSufficiency.stage}`,
      input.materialSufficiency.active_stage ? `素材可安全推进到：${input.materialSufficiency.active_stage}` : '',
      input.materialSufficiency.generation_posture ? `生成姿态：${input.materialSufficiency.generation_posture}` : '',
      '输出可进入剧本、场景拆分、分镜和资产说明的前期创作合同。',
      '本项目只准备内容与生产指挥材料，不执行图片、视频或后期实产。',
    ].filter(Boolean),
  };
}

function protagonistFromEntry(entry: FullEntryDetail): string {
  return entry.name.split('——')[0].trim();
}

function buildEvidenceBoundaries(entry: FullEntryDetail, centralEvent?: string, userOutline?: string): EvidenceBoundary[] {
  const boundaries: EvidenceBoundary[] = [{
    boundary_id: 'source-entry',
    label: '主条目事实边界',
    type: entry.credibility === '可靠' ? 'verified' : 'uncertain',
    source: entry.name,
    note: centralEvent
      ? `中心事件「${centralEvent}」来自知识库条目或用户指定方向，生成时需保留可信度说明。`
      : '未指定中心事件，生成时需避免把概述写成确定细节。',
  }];

  if (entry.unverifiedPoints.length > 0) {
    boundaries.push({
      boundary_id: 'unverified-points',
      label: '待核实信息',
      type: 'uncertain',
      source: entry.name,
      note: entry.unverifiedPoints.join('；'),
    });
  }

  if (userOutline?.trim()) {
    boundaries.push({
      boundary_id: 'user-outline',
      label: '用户创作方向',
      type: 'creative_treatment',
      source: 'user_outline',
      note: '用户大纲可作为创作方向，不可自动写成已核实史实。',
    });
  }

  return boundaries;
}

function buildBeats(profile: GenreProfileLite, boundaries: EvidenceBoundary[], targetDuration: SupportedDuration): StoryGenreBeat[] {
  const count = Math.max(profile.framework.length, DURATION_SCENE_COUNT[targetDuration] ?? profile.framework.length);
  const framework = [...profile.framework];
  while (framework.length < count) {
    const insertAt = Math.max(1, framework.length - 1);
    framework.splice(insertAt, 0, profile.framework[Math.min(insertAt, profile.framework.length - 1)]);
  }

  return framework.slice(0, count).map((label, index) => ({
    beat_id: `beat-${index + 1}`,
    order: index + 1,
    function_label: label,
    function_description: `${profile.label}的第 ${index + 1} 个类型功能节点`,
    content_requirement: `${label}：围绕「${profile.narrative_promise}」推进，必须服务 ${profile.must_include.slice(0, 3).join('、')}。`,
    emotional_turn: index === 0
      ? `${label}：建立观看问题`
      : index === count - 1
        ? `${label}：完成主题或传播记忆点`
        : `${label}：推进信息、情绪或选择压力`,
    evidence_boundary_ids: boundaries.map(boundary => boundary.boundary_id),
  }));
}

function buildCentralQuestion(entry: FullEntryDetail, profile: GenreProfileLite, centralEvent?: string, regionHint?: string): string {
  const subject = protagonistFromEntry(entry);
  const regionPart = regionHint ? `在${regionHint}地方化表达中，` : '';
  if (centralEvent?.trim()) {
    return `${regionPart}${subject}如何在「${centralEvent}」中体现${profile.narrative_promise}`;
  }
  return `${regionPart}${subject}的故事如何体现${profile.narrative_promise}`;
}

function buildCharacterArcs(protagonist: string, profile: GenreProfileLite, centralEvent?: string): StoryCharacterArcPlan[] {
  return [{
    character_name: protagonist,
    starting_state: profile.framework[0] ?? '开场状态',
    pressure: centralEvent ? `中心事件「${centralEvent}」带来的外部压力` : '来源条目中的主要压力',
    turning_point: profile.framework[Math.max(1, Math.floor(profile.framework.length / 2))] ?? '关键转折',
    ending_state: profile.framework[profile.framework.length - 1] ?? '主题落点',
  }];
}

function buildWarnings(entry: FullEntryDetail, input: GenerateStoryBlueprintInput): string[] {
  const warnings: string[] = [];
  if (entry.unverifiedPoints.length > 0) warnings.push('条目存在待核实点，生成时需要保留事实边界。');
  if (input.user_outline?.trim()) warnings.push('用户大纲只作为创作方向，不可自动写成已验证知识库事实。');
  if (input.region_hint?.trim() && !entry.region.includes(input.region_hint)) {
    warnings.push(`地方化目标「${input.region_hint}」与条目地区「${entry.region}」不完全一致，需要避免误写直接发生地。`);
  }
  return warnings;
}

export async function generateStoryBlueprint(input: GenerateStoryBlueprintInput): Promise<GenerateStoryBlueprintResult | null> {
  const entry = await getEntryDetail(input.entry_name);
  if (!entry) return null;

  const videoType = resolveVideoType(entry, input.video_type);
  const profile = PROFILES[videoType];
  const targetDuration = input.target_duration ?? '3分钟';
  const presentationStyle = input.presentation_style ?? profile.default_presentation_style;
  const storyStructure = input.story_structure ?? profile.default_story_structure;
  const creationUseCase = resolveCreationUseCase(input, videoType);
  const truthMode = resolveTruthMode(input, creationUseCase, videoType);
  const materialSufficiency = buildMaterialSufficiencyReport(entry, input, creationUseCase, truthMode);
  const creationContract = buildCreationContract({
    request: input,
    creationUseCase,
    truthMode,
    materialSufficiency,
    videoType,
    presentationStyle,
    storyStructure,
  });
  const protagonist = protagonistFromEntry(entry);
  const evidenceBoundaries = buildEvidenceBoundaries(entry, input.central_event, input.user_outline);

  return {
    blueprint: {
      schema_version: 'story-blueprint/v1',
      entry_name: entry.name,
      source_entry: entry.name,
      video_type: videoType,
      presentation_style: presentationStyle,
      story_structure: storyStructure,
      target_duration: targetDuration,
      central_event: input.central_event,
      central_question: buildCentralQuestion(entry, profile, input.central_event, input.region_hint),
      protagonist,
      genre_beats: buildBeats(profile, evidenceBoundaries, targetDuration),
      character_arcs: buildCharacterArcs(protagonist, profile, input.central_event),
      evidence_boundaries: evidenceBoundaries,
      type_specific_requirements: [
        ...profile.must_include,
        ...profile.scene_rules,
        ...profile.gears_rules,
        `创作场景：${creationContract.creation_use_case}`,
        `真实度模式：${creationContract.truth_mode}`,
        `素材目标阶段：${materialSufficiency.stage}`,
        ...(materialSufficiency.active_stage ? [`素材可安全推进到：${materialSufficiency.active_stage}`] : []),
        ...(materialSufficiency.generation_posture ? [`素材生成姿态：${materialSufficiency.generation_posture}`] : []),
        ...(materialSufficiency.stage_reports ?? []).map(report => `素材阶段 gate：${report.stage}=${report.status}(${report.score}/100)`),
        ...creationContract.must_verify.map(item => `必须核实：${item}`),
        ...creationContract.forbidden_moves.map(item => `禁止表达：${item}`),
      ],
      creation_contract: creationContract,
      material_sufficiency: materialSufficiency,
    },
    profile_summary: {
      video_type: profile.video_type,
      label: profile.label,
      narrative_promise: profile.narrative_promise,
      must_include: profile.must_include,
      scene_rules: profile.scene_rules,
      gears_rules: profile.gears_rules,
    },
    source_entry: entry,
    warnings: buildWarnings(entry, input),
  };
}
