import {
  ErrorCodes,
  VIDEO_TYPE_CONFIG,
  fail,
  success,
} from '@shared/types.js';
import type {
  ApiResponse,
  EntryDetail,
  EntryMatchResult,
  EntrySearchResult,
  GenerationType,
  GearsSegment,
  PanelCount,
  PresentationStyle,
  StoryGenerateRequest,
  StoryGenerateResult,
  StoryPlanResult,
  StoryScene,
  StoryStructureType,
  SupportedDuration,
  VideoType,
} from '@shared/types.js';
import type { DomainPack, DomainStoryGenerateOptions } from '../../platform/domain-pack.js';
import { persistGeneratedStoryAndNotifyGears } from '../../platform/generated-story-persistence.js';
import { generateStoryId } from '../../platform/story-identity.js';
import {
  createStoryRepository,
  storyGeneratedRoot,
} from '../../platform/story-storage.js';
import { buildGearsDeliveryPackage } from '../../services/gears-delivery-service.js';
import { validateGenreStoryQuality } from '../../services/genre-quality-service.js';
import { getProductionMaterialPack } from '../../services/production-material-pack-service.js';
import { buildProductionMaterialReadinessReport } from '../../services/production-material-readiness-service.js';
import {
  attachBlueprintScenes,
  buildStoryBlueprint,
} from '../../services/story-blueprint-service.js';
import { validateDramaticStory } from '../../services/dramatic-story.js';
import { validateOriginalFictionStoryContent } from './story-safety.js';

export const ORIGINAL_FICTION_DOMAIN_ID = 'original_fiction';
export const ORIGINAL_FICTION_ENTRY_NAME = '用户原创素材';

const SUPPORTED_VIDEO_TYPES = [
  'character_story',
  'ai_comic_drama',
  'children_story',
  'scene_short',
  'social_short',
] as const satisfies readonly VideoType[];

const DURATION_SECONDS: Record<SupportedDuration, number> = {
  '30秒': 30,
  '1分钟': 60,
  '3分钟': 180,
  '5分钟': 300,
  '8分钟': 480,
  '10分钟': 600,
  '15分钟': 900,
  '20分钟': 1200,
};

const SCENE_FUNCTIONS = ['钩子开场', '主角处境', '冲突升级', '关键行动', '高潮', '结尾'] as const;
const CAMERA_SUGGESTIONS = [
  '中景缓慢推进到人物手部动作',
  '侧面跟拍人物穿过空间并停在关键道具前',
  '近景与反打交替，保持视线方向连续',
  '低机位短推后切至人物正面特写',
  '手持近景跟随关键选择，随后稳定定格',
  '固定中远景收束人物与环境关系',
] as const;

const ORIGINAL_ENTRY: EntryDetail = {
  name: ORIGINAL_FICTION_ENTRY_NAME,
  sourceDomain: ORIGINAL_FICTION_DOMAIN_ID,
  province: '项目输入',
  region: '用户素材',
  type: '原创提案',
  summary: '由用户提供人物、目标、阻力、选择和结局的大纲，供原创故事生产链使用。',
  story: '该领域不内置事实故事；生成必须以请求中的原创大纲为唯一主素材。',
  culturalSignificance: '不适用；该领域用于验证领域中立的原创故事生产能力。',
  relatedLocations: [],
  keywords: ['原创', '人物', '冲突', '选择', '大纲', '项目素材'],
  sources: ['用户在当前项目中提供的原创大纲'],
  credibility: '用户提供，未核验',
  verificationMethod: '创作者确认人物、品牌、场地、作品权利及发布边界',
  unverifiedPoints: ['人物与素材权利', '真实品牌与场地授权', '发布渠道适配'],
};

function asSearchResult(): EntrySearchResult {
  return {
    name: ORIGINAL_ENTRY.name,
    sourceDomain: ORIGINAL_FICTION_DOMAIN_ID,
    province: ORIGINAL_ENTRY.province,
    region: ORIGINAL_ENTRY.region,
    type: ORIGINAL_ENTRY.type,
    summary: ORIGINAL_ENTRY.summary,
    keywords: [...ORIGINAL_ENTRY.keywords],
    credibility: ORIGINAL_ENTRY.credibility,
    match_reason: '原创故事请求应以用户大纲作为项目主素材',
  };
}

function matchesOriginalEntry(value: string | undefined): boolean {
  if (!value?.trim()) return true;
  const query = value.trim().toLowerCase();
  return [
    ORIGINAL_FICTION_ENTRY_NAME,
    ORIGINAL_ENTRY.type,
    ORIGINAL_ENTRY.summary,
    ...ORIGINAL_ENTRY.keywords,
  ].some(item => item.toLowerCase().includes(query) || query.includes(item.toLowerCase()));
}

async function searchEntries(params: { keywords?: string; type?: string; [field: string]: unknown }): Promise<ApiResponse<EntrySearchResult[]>> {
  if (params.type?.trim() && params.type.trim() !== ORIGINAL_ENTRY.type) return success([]);
  return success(matchesOriginalEntry(params.keywords) ? [asSearchResult()] : []);
}

async function getEntryDetail(name: string): Promise<ApiResponse<EntryDetail>> {
  return name.trim() === ORIGINAL_FICTION_ENTRY_NAME
    ? success({ ...ORIGINAL_ENTRY, keywords: [...ORIGINAL_ENTRY.keywords] })
    : fail(ErrorCodes.ENTRY_NOT_FOUND, `Entry "${name}" not found in ${ORIGINAL_FICTION_DOMAIN_ID}`);
}

async function matchEntries(params: { query: string; limit: number; [field: string]: unknown }): Promise<ApiResponse<EntryMatchResult>> {
  const query = params.query.trim();
  if (!query) return fail(ErrorCodes.VALIDATION_ERROR, 'query cannot be empty');
  const matched = matchesOriginalEntry(query);
  const item = {
    entry_name: ORIGINAL_FICTION_ENTRY_NAME,
    province: ORIGINAL_ENTRY.province,
    type: ORIGINAL_ENTRY.type,
    score: matched ? 1 : 0.6,
    match_reason: matched
      ? '查询指向原创故事或项目大纲'
      : '该领域只接收用户原创大纲，不检索外部事实条目',
    usable_for_story: matched,
  };
  return success({
    query,
    matches: params.limit > 0 ? [item] : [],
    best_match: matched ? item : null,
    fallback_message: matched ? null : '请提供包含人物、目标、阻力、选择和结局的原创大纲。',
  });
}

async function planStory(params: {
  entry_name: string;
  original_user_query?: string;
}): Promise<ApiResponse<StoryPlanResult>> {
  if (params.entry_name.trim() !== ORIGINAL_FICTION_ENTRY_NAME) {
    return fail(ErrorCodes.ENTRY_NOT_FOUND, `Entry "${params.entry_name}" not found`);
  }
  return success({
    entry_name: ORIGINAL_FICTION_ENTRY_NAME,
    entry_type: ORIGINAL_ENTRY.type,
    original_user_query: params.original_user_query,
    recommended_types: [
      { generation_type: 'character_story', reason: '原创人物目标、阻力和选择可形成完整人物弧光', priority: 1 },
      { generation_type: 'scene_short', reason: '单一空间冲突可压缩为场景短片', priority: 2 },
    ],
    recommended_video_types: SUPPORTED_VIDEO_TYPES.map((videoType, index) => ({
      video_type: videoType,
      reason: `${VIDEO_TYPE_CONFIG[videoType].label}可使用用户原创大纲，不依赖中国文化知识条目`,
      priority: index + 1,
    })),
    recommended_presentation_styles: [
      { presentation_style: 'cinematic', reason: '适合人物目标、阻力与选择的连续场面调度' },
      { presentation_style: 'ai_comic', reason: '适合把原创人物和对白拆成可复用分镜资产' },
    ],
    recommended_story_structures: [
      { story_structure: 'three_act_drama', reason: '建立目标、升级阻力并完成承担后果的选择', priority: 1 },
      { story_structure: 'single_event_drama', reason: '把原创大纲集中到一次关键抉择', priority: 2 },
    ],
    recommended_supplement_needs: [
      { need_id: 'original-rights', label: '原创与权利确认', message: '确认人物、品牌、场地、参考作品和发布用途的权利边界。' },
      { need_id: 'story-specifics', label: '可拍细节', message: '补充具体地点、动作、关键道具和选择后果。' },
    ],
    available_events: [{
      event: '主角在压力下做出不可撤回的选择',
      conflict_score: 8,
      recommended_duration: '1分钟',
      recommended_type: 'character_story',
      recommended_video_type: 'character_story',
    }],
    recommended_duration: '1分钟',
    cultural_risks: [
      '该领域不提供事实或文化背书；用户素材中的真实人物、品牌、场地和作品引用必须另行核验。',
      '本地机器编排不等于真人编剧审稿、权利许可或发布批准。',
    ],
  });
}

function splitOutline(outline: string): string[] {
  return outline
    .split(/[。！？；\n]+/)
    .map(item => item.trim().replace(/[，,]+$/, ''))
    .filter(item => item.length >= 4);
}

function resolveProtagonist(request: StoryGenerateRequest, clauses: string[]): string {
  const hinted = request.character_hints?.find(item => item.role_position === '主角')
    ?? request.character_hints?.[0];
  if (hinted?.name.trim()) return hinted.name.trim();
  const matched = clauses[0]?.match(/^([\u4e00-\u9fa5]{2,4})(?=在|为|想|要|因|带|守|面)/);
  return matched?.[1] ?? '主角';
}

function inferLocation(clause: string): string {
  const known = clause.match(/(工作室|车站|天台|旧街|巷口|学校|教室|医院|码头|仓库|厨房|庭院|客厅|办公室|展厅|剧场)/);
  return known?.[1] ?? '室内工作台旁';
}

function scenePlot(
  clause: string,
  protagonist: string,
  index: number,
): { plot: string; keyAction: string; conflict: string; dialogue: string } {
  const additions = [
    `${protagonist}立刻确认眼前的目标，并把关键物件握在手中。`,
    `时间和旁人的质疑同时压来，${protagonist}不能再靠等待解决问题。`,
    `${protagonist}发现退让会失去承诺，坚持则必须承担现实代价。`,
    `${protagonist}选择继续行动，把决定写下并交到对方手中。`,
    `压力抵达顶点，${protagonist}拒绝撤回决定，局面因此改变。`,
    `${protagonist}承担选择的后果，在新的理解中获得成长。`,
  ];
  const actions = ['握紧关键物件并走向目标', '停下脚步直面质疑', '在两条道路之间做出判断', '写下决定并当面交付', '拒绝撤回并完成关键动作', '收好物件走向新的生活'];
  const conflicts = ['目标必须立刻完成', '时间压力与外部质疑升级', '退让与坚持形成两难', '行动会带来明确代价', '拒绝与妥协正面碰撞', '接受后果并重新出发'];
  return {
    plot: `${clause}。${additions[index]}`,
    keyAction: actions[index],
    conflict: conflicts[index],
    dialogue: index === 4
      ? `${protagonist}：这是我的选择，后果由我承担。`
      : `${protagonist}用行动回应眼前的压力。`,
  };
}

function buildScenes(
  clauses: string[],
  protagonist: string,
  totalDuration: number,
): StoryScene[] {
  const baseDuration = Math.max(5, Math.floor(totalDuration / SCENE_FUNCTIONS.length));
  return SCENE_FUNCTIONS.map((dramaticFunction, index) => {
    const clause = clauses[Math.min(index, clauses.length - 1)];
    const action = scenePlot(clause, protagonist, index);
    const location = inferLocation(clause);
    return {
      scene_id: index + 1,
      title: `${dramaticFunction}：${clause.slice(0, 12)}`,
      duration_sec: index === SCENE_FUNCTIONS.length - 1
        ? Math.max(5, totalDuration - baseDuration * (SCENE_FUNCTIONS.length - 1))
        : baseDuration,
      location,
      time_of_day: index < 2 ? '清晨' : index < 5 ? '傍晚' : '夜晚',
      dramatic_function: dramaticFunction,
      plot: action.plot,
      key_action: action.keyAction,
      characters: [protagonist],
      visual_prompt: `${location}，${protagonist}与关键物件同框，人物表情清晰，环境光形成前后景层次，画面不出现真实品牌标识`,
      camera_suggestion: CAMERA_SUGGESTIONS[index],
      cultural_note: '原创项目约束：保持人物外观、关键物件和空间方向连续；真实人物、品牌与场地须另行授权。',
      conflict: action.conflict,
      dialogue_or_narration: action.dialogue,
      source_entries: [ORIGINAL_FICTION_ENTRY_NAME],
      factual_basis: '用户原创大纲',
      fictionalized_elements: ['场面调度和对白由本地机器编排，待创作者确认'],
    };
  });
}

function panelCount(durationSec: number): PanelCount {
  if (durationSec <= 6) return 4;
  if (durationSec <= 10) return 6;
  if (durationSec <= 15) return 8;
  return 12;
}

function buildGearsSegments(
  scenes: StoryScene[],
  videoType: VideoType,
  presentationStyle: PresentationStyle,
): GearsSegment[] {
  return scenes.map(scene => ({
    segment_id: scene.scene_id,
    source_scene_id: scene.scene_id,
    duration_sec: scene.duration_sec,
    panel_count: panelCount(scene.duration_sec),
    script_text: `${scene.plot}\n${scene.dialogue_or_narration}`,
    purpose: scene.dramatic_function,
    visual_focus: [scene.location, ...scene.characters, '关键物件'],
    cultural_constraints: [scene.cultural_note],
    video_type: videoType,
    presentation_style: presentationStyle,
    segment_prompt_hint: `${scene.visual_prompt}；镜头：${scene.camera_suggestion}；动作：${scene.key_action}`,
    source_entries: [ORIGINAL_FICTION_ENTRY_NAME],
  }));
}

async function generateStory(
  request: StoryGenerateRequest,
  options: DomainStoryGenerateOptions = {},
): Promise<ApiResponse<StoryGenerateResult>> {
  const outline = request.outline?.trim() ?? '';
  const clauses = splitOutline(outline);
  if (outline.length < 40 || clauses.length < 3) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'original_fiction requires an outline of at least 40 characters and three actionable clauses',
    );
  }
  if (request.entry_name && request.entry_name !== ORIGINAL_FICTION_ENTRY_NAME) {
    return fail(ErrorCodes.ENTRY_NOT_FOUND, `Entry "${request.entry_name}" not found`);
  }
  if (request.truth_mode && request.truth_mode !== 'fictional_original') {
    return fail(ErrorCodes.VALIDATION_ERROR, 'original_fiction only accepts truth_mode=fictional_original');
  }
  const videoType = request.video_type
    ?? (request.generation_type === 'scene_short' ? 'scene_short' : 'character_story');
  if (!SUPPORTED_VIDEO_TYPES.includes(videoType as typeof SUPPORTED_VIDEO_TYPES[number])) {
    return fail(ErrorCodes.INVALID_VIDEO_TYPE, `Video type "${videoType}" is not supported by original_fiction`);
  }
  const presentationStyle = request.presentation_style
    ?? VIDEO_TYPE_CONFIG[videoType].default_presentation_style;
  const targetDuration = request.target_video_duration ?? '1分钟';
  const storyStructure: StoryStructureType = request.story_structure ?? 'three_act_drama';
  const protagonist = resolveProtagonist(request, clauses);
  const selectedEvent = request.selected_event?.trim() || `${protagonist}在压力下守住承诺`;
  const storyId = generateStoryId(`${ORIGINAL_FICTION_ENTRY_NAME}-${outline.slice(0, 32)}`);
  const scenes = buildScenes(clauses, protagonist, DURATION_SECONDS[targetDuration]);
  const gearsSegments = request.output_gears_segments === false
    ? []
    : buildGearsSegments(scenes, videoType, presentationStyle);
  const createdAt = new Date().toISOString();
  const title = `${protagonist}的选择`;
  const preliminaryBlueprint = buildStoryBlueprint({
    entry: ORIGINAL_ENTRY,
    videoType,
    presentationStyle,
    storyStructure,
    targetDuration,
    centralEvent: selectedEvent,
    scenes,
    narrativePatternIds: request.narrative_pattern_ids,
  });
  const blueprint = attachBlueprintScenes(preliminaryBlueprint, scenes, storyId);
  const productionMaterialPack = getProductionMaterialPack(videoType, {
    sourceDomain: ORIGINAL_FICTION_DOMAIN_ID,
  });
  const productionMaterialReadiness = buildProductionMaterialReadinessReport({
    productionMaterialPack,
    sourceDomain: ORIGINAL_FICTION_DOMAIN_ID,
    contextText: [
      outline,
      selectedEvent,
      ...scenes.flatMap(scene => [
        scene.title,
        scene.plot,
        scene.key_action,
        scene.conflict,
        scene.visual_prompt,
        scene.dialogue_or_narration,
      ]),
    ].filter((item): item is string => Boolean(item)).join('\n'),
  });
  const baseQuality = validateDramaticStory({
    full_text: scenes.map(scene => scene.plot).join('\n\n'),
    scene_breakdown: scenes,
    title,
    selectedEvent,
    videoType,
  });
  const generationType: GenerationType = request.generation_type
    ?? (videoType === 'scene_short' ? 'scene_short' : 'character_story');
  let story: StoryGenerateResult = {
    storyId,
    sourceDomain: ORIGINAL_FICTION_DOMAIN_ID,
    model_profile_id: request.model_profile_id,
    generation_source: 'original_fiction_domain_pack_local_assembly',
    generation_mode: 'local_only',
    generation_used_fallback: false,
    title,
    generation_type: generationType,
    video_type: videoType,
    presentation_style: presentationStyle,
    source_entry: ORIGINAL_FICTION_ENTRY_NAME,
    original_user_query: outline,
    logline: `${protagonist}必须在退让与坚持之间做出选择，并承担决定带来的后果。`,
    theme: '在选择中承担后果并获得成长',
    full_text: scenes.map(scene => scene.plot).join('\n\n'),
    scene_breakdown: scenes,
    gears_segments: gearsSegments,
    gears_segments_url: `/api/stories/${storyId}/gears-segments`,
    cultural_constraints: [
      '原创项目约束：真实人物、品牌、场地和参考作品必须在发布前完成权利核验。',
      '本地机器编排、测试与交付包不计真人审稿、真实模型调用或媒体回片。',
    ],
    credibility_note: `${ORIGINAL_FICTION_ENTRY_NAME}由用户提供但未核验；人物、品牌、场地与作品权利待人工确认，本地机器编排不计真人审稿、真实模型或媒体回片。`,
    creation_use_case: request.creation_use_case ?? 'original_ai_comic',
    truth_mode: 'fictional_original',
    client_type: request.client_type,
    target_audience: request.target_audience,
    communication_goal: request.communication_goal,
    production_material_pack: productionMaterialPack,
    production_material_readiness: productionMaterialReadiness,
    story_structure: storyStructure,
    story_blueprint: blueprint,
    characters: [{
      name: protagonist,
      role: '主角',
      description: `${protagonist}是用户原创大纲中的核心行动者，外观与权利设定待创作者确认。`,
      arc: '从犹疑和受压，到明确选择、承担后果并获得成长。',
    }],
    protagonist_arc: [{
      starting_state: '目标明确但尚未准备承担代价',
      turning_point: '发现退让与坚持都将产生不可回避的后果',
      resolution: '主动选择并承担后果，在行动中获得成长',
    }],
    act_structure: [
      { act: 1, beat: '建立目标与压力', scene_ids: [1, 2], purpose: '让人物目标和外部阻力可见' },
      { act: 2, beat: '两难与行动', scene_ids: [3, 4], purpose: '把选择转化为具体动作' },
      { act: 3, beat: '高潮与后果', scene_ids: [5, 6], purpose: '完成选择、代价与成长落点' },
    ],
  };
  if (videoType === 'ai_comic_drama') {
    story.dialogue = scenes.map(scene => ({
      scene_id: scene.scene_id,
      lines: [{ character: protagonist, text: scene.dialogue_or_narration ?? '', emotion: scene.scene_id < 5 ? '克制而坚定' : '坚定' }],
    }));
  }
  story.quality_report = validateGenreStoryQuality({ story, baseReport: baseQuality, blueprint });
  story.gears_delivery = buildGearsDeliveryPackage(story);

  if (options.transform_story_before_validation_and_persistence) {
    story = await options.transform_story_before_validation_and_persistence(story);
  }
  const domainSafety = validateOriginalFictionStoryContent(story);
  story.domain_safety = domainSafety;
  if (!domainSafety.passed) {
    return fail(
      ErrorCodes.DOMAIN_SAFETY_VALIDATION_FAILED,
      'Generated story failed the original_fiction safety boundary',
      domainSafety,
    );
  }

  const persisted = await persistGeneratedStoryAndNotifyGears({
    storyData: story,
    createdAt,
    accessControl: options.access_control,
    repository: createStoryRepository(),
    generatedRoot: storyGeneratedRoot(),
  });
  return success(persisted);
}

export const originalFictionDomainPack: DomainPack = {
  meta: {
    schema_version: 'story-agent-domain-pack/v1',
    domain_id: ORIGINAL_FICTION_DOMAIN_ID,
    display_name: '用户原创故事',
    description: '以用户原创大纲为唯一主素材的领域中立故事生产包',
    version: '1.4.5',
    capabilities: ['entry_search', 'entry_detail', 'entry_match', 'story_plan', 'story_generate', 'type_catalog', 'story_safety', 'story_revision', 'story_supplement', 'production_material_draft', 'knowledge_writeback', 'gears_mapping'],
  },
  entryTypes: [{
    name: ORIGINAL_ENTRY.type,
    description: '含人物、目标、阻力、选择与结局的用户原创项目大纲',
    recommended_generation_types: ['character_story', 'scene_short'],
    recommended_video_types: [...SUPPORTED_VIDEO_TYPES],
    recommended_presentation_styles: ['cinematic', 'ai_comic'],
  }],
  generationTypes: SUPPORTED_VIDEO_TYPES.map(videoType => ({ ...VIDEO_TYPE_CONFIG[videoType] })),
  revisionGuidance: {
    schema_version: 'story-domain-revision-guidance/v1',
    writer_role: '用户原创故事修复写手',
    source_boundary_rules: [
      '用户原创大纲是唯一主素材；不得擅自引入或暗示真实人物、品牌、场地、作品权利或事实背书。',
      '必须保留 original_user_query、未核验权利说明和每个场景对用户原创素材的 source_entries 追踪。',
    ],
    human_review_requirement: '机器修订不能替代真人编剧、权利、品牌、场地或发布审查，也不产生真实作品信用。',
  },
  supplementGuidance: {
    schema_version: 'story-domain-supplement-guidance/v1',
    candidate_kind: 'project_material_candidate',
    candidate_heading: '项目素材候选稿',
    review_rules: [
      '补充内容只属于当前原创项目，不得改写为外部事实或领域知识。',
      '需要创作者确认人物、品牌、场地、作品权利和发布边界。',
      '不进入正式知识写回队列，也不产生真人编剧、权利审查或真实作品信用。',
    ],
    human_review_requirement: '待真人编剧和权利审查；机器补素材只形成项目候选，不代表正式审核完成。',
  },
  productionMaterialGuidance: {
    schema_version: 'story-domain-production-material-guidance/v1',
    audience_level_default: '故事与影视叙事初学观众',
    audience_level_comprehension_note: '不预设历史、文化或行业背景，先用人物目标、阻力和选择解释叙事关系。',
    learner_profile_default: '原创故事学习者/创作小组',
    learner_profile_foundation_note: '不预设专业编剧训练，用人物目标、阻力、选择和结果建立理解。',
    heritage_or_craft_type_label: '项目设定/行动类型',
    heritage_or_craft_type_category: '原创项目中的虚构职业、技能或行动系统',
    heritage_or_craft_type_review_note: '人物职业、技能设定和行动规则只属于当前原创项目，仍需创作者与权利审查确认。',
    speaker_position_role: '创作讲述者/课程主持人',
    speaker_position_boundary_note: '明确这是当前项目的原创叙事分析，不冒充原作者、真实人物、权利方或权威机构。',
    speaker_position_expression_note: '先提出人物目标，再用阻力、选择、行动结果和场景例子推进。',
    project_name_review_note: '正式写入生产卡片前需由创作者确认项目名称、作品权利和发布口径。',
    forbidden_claims_rule: '不得把原创设定包装为真实人物、品牌、场地、作品权利或事实背书。',
    forbidden_claims_default_boundary: '所有补录内容只属于当前原创项目，需经创作者与权利审查确认。',
    documentation_assets_intro: '文档/影像资产：先以用户原创素材、项目设定和分镜场景作为待补清单，不替代正式授权。',
    documentation_assets_missing_source_note: '待补用户提供的设定稿、角色小传、世界观资料或合法授权参考。',
    documentation_assets_rights_note: '用户素材、参考图、音乐、真实品牌/场地/作品引用需确认权利或替代方案。',
    source_cues_review_note: '优先使用用户提供的原文，其次使用项目素材线索；引用或转述前需核对原创大纲版本、创作说明或权利来源记录。',
    source_cues_missing_source_note: '待补用户原创大纲版本、创作说明或权利来源记录。',
    witness_or_expert_roles: '创作者/编剧/角色设计者/项目执行者/权利顾问',
    witness_or_expert_role_note: '一人解释项目设定，一人说明人物与场景设计，一人确认权利和发布边界；不要把演员表演冒充真实证言。',
    what_must_not_be_claimed_rule: '未经创作者或权利确认的人物原型、品牌、场地、作品归属、授权状态、现实经历和因果关系。',
    shot_prompt_style_boundary: '原创设定边界清晰',
    parent_teacher_extension_question: '你看到了哪些故事线索？角色做了什么选择？哪些设定还需要创作者或权利确认？',
    single_shot_acceptance_boundary: '原创设定与权利边界稳定',
    knowledge_outline_progression: '叙事知识层级：从人物目标、阻力、选择、行动结果到项目/权利边界递进。',
    fact_boundary_card_rule: '项目边界卡：已确认内容以用户原创素材、项目设定和权利记录为准；未确认内容只作创作候选，不作对外归属或授权断言。',
    fact_boundary_card_fallback: '人物设定、作品归属和授权状态需创作者或权利方复核。',
    source_cues_entry_label: '项目素材入口',
    source_cues_confirmed_label: '已确认项目素材线索',
    source_cues_unverified_label: '待确认创作/权利线索',
    source_cues_default_review_scope: '人物设定、作品归属、品牌/场地引用和授权状态仍需创作者或权利方复核。',
    parent_teacher_review_boundary: '再区分项目设定、戏剧化表达与现实/权利边界。',
    share_trigger_frame: '“原来如此”的人物选择或剧情反差',
    share_trigger_reason: '观众能用一句话讲清角色为何这样选择，并愿意讨论不同的叙事可能。',
    diagram_or_caption_boundary: '项目设定或现实引用旁标“创作者确认/权利待核”。',
    comment_prompt_focus: '人物选择、故事版本或创作设定',
    comment_prompt_boundary: '鼓励讨论叙事选择，不把未经创作者或权利确认的设定、现实引用或授权状态当作定论。',
    misconception_boundary_rule: '不要把项目设定、戏剧化表达、现实引用或授权状态混为已确认的外部事实或权利结论。',
    misconception_boundary_fallback: '存在待确认的设定或权利信息，对外发布前需由创作者或权利方复核。',
  },
  searchEntries(params) {
    return searchEntries(params);
  },
  getEntryDetail,
  matchEntries(params) {
    return matchEntries(params);
  },
  planStory,
  generateStory,
  validateStoryContent({ story }) {
    return validateOriginalFictionStoryContent(story);
  },
  planKnowledgeWriteback() {
    return {
      schema_version: 'story-domain-knowledge-writeback-plan/v1',
      domain_id: ORIGINAL_FICTION_DOMAIN_ID,
      target_kind: 'none',
      eligible: false,
      blockers: ['domain_does_not_support_formal_knowledge_writeback'],
      requires_human_review: true,
      direct_writeback_allowed: false,
      writeback_performed: false,
      real_credit_granted: false,
    };
  },
  mapGearsConstraints({ story, segment }) {
    return [...new Set([
      ...story.cultural_constraints,
      ...segment.cultural_constraints,
    ].map(item => item.trim()).filter(Boolean))];
  },
};
