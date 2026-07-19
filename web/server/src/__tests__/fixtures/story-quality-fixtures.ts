import {
  VIDEO_TYPE_CONFIG,
  type ProductionMaterialReadinessReport,
  type StoryGenerateResult,
  type StoryScene,
  type VideoType,
} from '@shared/types.js';

type FixtureFamily =
  | 'dramatic_narrative'
  | 'documentary_evidence'
  | 'promotional_communication'
  | 'instructional_learning'
  | 'spatial_landscape'
  | 'social_short_form';

export interface StoryQualityFixtureSet {
  video_type: VideoType;
  complete: StoryGenerateResult;
  sparse: StoryGenerateResult;
  failure: StoryGenerateResult;
}

const FAMILY_BY_VIDEO_TYPE: Record<VideoType, FixtureFamily> = {
  character_story: 'dramatic_narrative',
  historical_drama: 'dramatic_narrative',
  legend_story: 'dramatic_narrative',
  ai_comic_drama: 'dramatic_narrative',
  children_story: 'dramatic_narrative',
  documentary_short: 'documentary_evidence',
  culture_promo: 'promotional_communication',
  heritage_promo: 'promotional_communication',
  city_brand_promo: 'promotional_communication',
  explainer_video: 'instructional_learning',
  lecture_video: 'instructional_learning',
  education_training: 'instructional_learning',
  scene_short: 'spatial_landscape',
  landscape_mood: 'spatial_landscape',
  social_short: 'social_short_form',
};

export function buildStoryQualityFixtureCatalog(): StoryQualityFixtureSet[] {
  return (Object.keys(VIDEO_TYPE_CONFIG) as VideoType[]).map((videoType) => {
    const complete = buildCompleteFixture(videoType);
    return {
      video_type: videoType,
      complete,
      sparse: {
        ...structuredClone(complete),
        storyId: `${complete.storyId}-sparse`,
        production_material_readiness: sparseProductionMaterialReport(videoType),
      },
      failure: buildFailureFixture(complete, FAMILY_BY_VIDEO_TYPE[videoType]),
    };
  });
}

function buildCompleteFixture(videoType: VideoType): StoryGenerateResult {
  const family = FAMILY_BY_VIDEO_TYPE[videoType];
  const story = family === 'dramatic_narrative'
    ? dramaticFixture()
    : family === 'documentary_evidence'
      ? documentaryFixture()
      : family === 'promotional_communication'
        ? promotionalFixture()
        : family === 'instructional_learning'
          ? instructionalFixture()
          : family === 'spatial_landscape'
            ? spatialFixture(videoType)
            : socialFixture();
  return {
    ...story,
    storyId: `fixture-${videoType}`,
    title: `${VIDEO_TYPE_CONFIG[videoType].label}完整质量样本`,
    video_type: videoType,
    presentation_style: VIDEO_TYPE_CONFIG[videoType].default_presentation_style,
    gears_segments_url: `/api/stories/fixture-${videoType}/gears-segments`,
    ...requiredTypeFields(videoType),
  };
}

function storyShell(
  generationType: StoryGenerateResult['generation_type'],
  scenes: StoryScene[],
): StoryGenerateResult {
  return {
    storyId: 'fixture-story',
    title: '完整质量样本',
    generation_type: generationType,
    video_type: 'character_story',
    presentation_style: 'cinematic',
    source_entry: '固定黄金条目',
    logline: '一个可观察、可验证且能被生产执行的短片方案。',
    theme: '具体证据承载清楚表达',
    full_text: scenes.map(scene => scene.dialogue_or_narration ?? scene.plot).join('\n\n'),
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: '/api/stories/fixture-story/gears-segments',
    cultural_constraints: ['地点、物件与时代信息以固定测试资料为边界。'],
    credibility_note: '固定测试资料与创作补足已分开标注。',
  };
}

function dramaticFixture(): StoryGenerateResult {
  const scenes = [
    makeScene(1, '案卷停笔', '县衙签押房', '夜晚', '钩子开场',
      '上官把疑案文书推到少年面前，命他天亮前签字；少年翻到矛盾证词，停住笔。',
      '翻开案卷并停住签笔',
      '县衙签押房，烛火，疑案文书，少年停笔，上官逼近',
      '上官催签与证词疑点正面冲突',
      '上官：天亮前必须签。少年：证词对不上。'),
    makeScene(2, '若签若查', '县衙正堂', '深夜', '冲突升级',
      '若照旧签字，无辜者可能含冤；若坚持重查，少年将得罪上官并失去入仕机会。',
      '摊开两份证词逐项核对',
      '正堂，两份证词并排，手指划过矛盾日期，人物对峙',
      '保全前途与坚持查证之间的两难',
      '少年：这一笔关系人命，我不能含糊。'),
    makeScene(3, '堂前拒签', '县衙正堂', '清晨', '高潮',
      '少年当众退回未签文书，要求重问证人，并愿意承担丢官的后果；他用行动守住人命前的良知，晨光落在空白签押处。',
      '退回文书、守住良知并走向证人席',
      '清晨正堂，未签文书，空白签押处，少年转身走向证人席',
      '权势命令与人命良知的最终选择',
      '少年：官位可以失去，人命不能草率。'),
  ];
  return {
    ...storyShell('character_story', scenes),
    logline: '少年必须在天亮前选择签下疑案，或冒着丢官风险公开证词矛盾。',
    theme: '良知通过不可撤回的选择被看见',
    full_text: scenes.map(scene => scene.plot).join('\n\n'),
    story_structure: 'single_event_drama',
    characters: [
      { name: '少年', role: 'protagonist', description: '负责复核案卷的年轻书吏。' },
      { name: '上官', role: 'supporting', description: '催促结案的县衙长官。' },
    ],
    protagonist_arc: [{
      starting_state: '担心失去入仕机会而迟疑',
      turning_point: '发现两份证词日期矛盾',
      resolution: '公开拒签并承担后果',
    }],
  };
}

function documentaryFixture(): StoryGenerateResult {
  const scenes = [
    makeScene(1, '水尺之问', '濂溪石桥', '清晨', '现实引入',
      '摄制组来到石桥现场，卷尺贴近桥墩水尺刻痕，追问这些刻线记录过怎样的洪水。',
      '测量水尺刻痕并记录位置',
      '石桥现场，桥墩水尺刻痕，卷尺和场记板特写',
      undefined,
      '旁白：今天还能看见的这道刻线，来自哪一年？'),
    makeScene(2, '三份证据', '地方档案馆', '午后', '证据对照',
      '地方志页码、洪水旧照片与老人公开口述并列，三份证据指向同一次水位变化。',
      '对照地方志、旧照片与口述时间',
      '档案馆阅览桌，地方志页码，旧照片，口述波形字幕'),
    makeScene(3, '有限再现', '濂溪石桥', '黄昏', '边界收束',
      '工作人员演示旧式测量方法，画面明确标注方法再现；镜头回到仍在桥墩上的真实刻痕。',
      '演示测量并标注再现',
      '石桥黄昏，测量工具，画面角标“方法再现”，真实刻痕远景'),
  ].map((scene, index) => ({
    ...scene,
    cultural_note: index === 2 ? '事实边界：方法演示属于有限再现，不是原始历史影像。' : '来源提示：现场遗存与公开文献交叉核验。',
    factual_basis: index === 1 ? '《濂溪地方志》水利卷、公开旧照片与口述记录。' : '濂溪石桥水尺现场遗存。',
    fictionalized_elements: index === 2 ? ['测量动作按现存工具进行方法再现'] : [],
    source_entries: ['固定黄金条目'],
  }));
  return {
    ...storyShell('culture_promo', scenes),
    logline: '摄制组追问石桥水尺如何记录濂溪近百年的水位变化。',
    theme: '现场痕迹与地方记忆互相印证',
    full_text: scenes.map(scene => scene.plot).join('\n\n'),
    story_structure: 'case_reconstruction',
    source_quotes: ['《濂溪地方志》水利卷记载三次洪水水位。'],
    field_notes: ['石桥东侧桥墩仍留有水尺刻痕。'],
  };
}

function promotionalFixture(): StoryGenerateResult {
  const scenes = [
    makeScene(1, '虎眼起光', '湘绣工坊', '清晨', '符号引入',
      '匠人把丝线劈细，在绣架上用游针绣出虎眼的第一层光。',
      '劈丝落针并转动绣架',
      '湘绣工坊，绣架，丝线，虎眼针脚微距，晨光'),
    makeScene(2, '旧技新课', '湘绣博物馆课堂', '午后', '现代传承',
      '展柜里的老绣片与今天课堂里的针法示范并置，青年学员逐针练习。',
      '对照老绣片并完成针法练习',
      '博物馆展柜，老绣片，青年课堂，手部针法示范'),
    makeScene(3, '绣进今天', '青年设计工作室', '傍晚', '传播收束',
      '青年设计师把绣片缝入当代衣装，邀请观众走进工坊体验一针。',
      '把绣片缝入衣装并邀请体验',
      '青年工作室，当代服饰，绣片特写，体验桌',
      undefined,
      '旁白：让一针旧技艺，绣进今天。'),
  ];
  return {
    ...storyShell('culture_promo', scenes),
    logline: '从绣架上的一针，看见湘绣如何进入今天的生活。',
    theme: '传统技艺在当代日常中继续生长',
    full_text: scenes.map(scene => scene.plot).join('\n\n'),
    story_structure: 'object_clue_journey',
    visual_symbols: ['绣架', '丝线', '双面绣虎眼'],
    core_message: '湘绣不是静止展品，而是仍在被使用的生活技艺。',
    slogan_or_key_sentence: '让一针旧技艺，绣进今天。',
    modern_connection: '青年设计师把传统针法用于当代服饰与公共课程。',
    craft_or_ritual_process: '选稿—上绷—配线—劈丝—落针—收针—装裱',
  };
}

function instructionalFixture(): StoryGenerateResult {
  const scenes = [
    makeScene(1, '学习目标', '纹样课堂', '上午', '学习目标',
      '学完这节课，观众能够回答如何用三步辨认一个陌生的传统纹样。',
      '展示学习目标卡',
      '学习目标字幕卡，构图、寓意、场景三项图标',
      undefined,
      '讲师：今天学会三步辨认法。'),
    makeScene(2, '三步示范', '纹样课堂', '上午', '示范演示',
      '以团花纹为例：第一步标出构图骨架，第二步查核心寓意，第三步核对器物场景。',
      '逐步标注团花纹',
      '团花纹拆解图，第一步第二步第三步标注，对比箭头',
      undefined,
      '讲师：例如这枚团花纹，先看骨架，再查寓意。'),
    makeScene(3, '练习复盘', '纹样课堂', '上午', '练习复盘',
      '观众暂停画面完成练习，再用构图、寓意、场景三项清单复盘答案。',
      '完成练习并核对清单',
      '练习题对比图，答案遮罩，复盘清单字幕',
      undefined,
      '讲师：现在试一试，并记住三项复盘要点。'),
  ];
  return {
    ...storyShell('culture_promo', scenes),
    logline: '学会从构图、寓意和使用场景三步辨认传统纹样。',
    theme: '建立可复用的纹样观察方法',
    full_text: scenes.map(scene => `${scene.plot}${scene.dialogue_or_narration ?? ''}`).join('\n\n'),
    story_structure: 'lecture_argument',
    argument_points: ['先看构图骨架', '再查核心寓意', '最后核对使用场景'],
    knowledge_outline: ['学习目标', '三步辨认法', '案例练习', '复盘清单'],
  };
}

function spatialFixture(videoType: VideoType): StoryGenerateResult {
  const scenes = [
    makeScene(1, '溪口开卷', '濂溪入口', '清晨', '空间引入',
      '晨雾贴着溪面移动，水声从石桥下传来，镜头沿湿润石阶进入山谷。',
      '镜头沿石阶进入溪谷',
      '清晨薄雾，溪水，湿石阶，竹影，冷青天光，大面积留白'),
    makeScene(2, '竹影转深', '濂溪竹径', '午后', '视觉移动',
      '镜头从溪口转入竹径，风穿过叶片，斑驳日光沿石墙缓慢移动。',
      '沿溪转入竹径',
      '午后竹径，风吹叶片，石墙光斑，空镜，纵深构图'),
    makeScene(3, '暮色停驻', '濂溪石桥', '黄昏', '留白收束',
      '暮色落到石桥，水声继续，最后一个远景停在桥洞与天光之间。',
      '镜头停在石桥远景',
      '黄昏石桥，桥洞倒影，暖灰天光，水纹，远景留白',
      undefined,
      '旁白：山不回答，水仍向前。'),
  ];
  return {
    ...storyShell('scene_short', scenes),
    logline: '镜头沿濂溪从晨雾走到暮色。',
    theme: '空间、光影与时间的流动',
    full_text: videoType === 'landscape_mood'
      ? '雾从水面醒来。\n\n风把光推向竹径深处。\n\n山不回答，水仍向前。'
      : scenes.map(scene => scene.plot).join('\n\n'),
    story_structure: 'object_clue_journey',
    spatial_identity: '濂溪入口—竹径—石桥组成的溪谷空间',
    visual_route: ['濂溪入口', '濂溪竹径', '濂溪石桥'],
    time_layer: '清晨薄雾—午后光斑—黄昏暮色',
    atmosphere: '水声、竹风与留白',
  };
}

function socialFixture(): StoryGenerateResult {
  const scenes = [
    makeScene(1, '3秒钩子', '湘绣工坊', '白天', '3秒钩子',
      '一根丝线为什么要劈成八份？针尖马上给你答案！',
      '手指瞬间劈开丝线',
      '9:16微距，手指劈丝，针尖强反差',
      undefined,
      '为什么要劈八份？', 3),
    makeScene(2, '一眼对比', '湘绣工坊', '白天', '关键信息',
      '粗丝反光硬，细丝贴着绸面转动，同一只虎眼立刻亮起来。',
      '粗细丝线同屏落针对比',
      '9:16左右对比，粗丝与细丝针脚',
      undefined,
      '粗丝硬。细丝活。', 8),
    makeScene(3, '记忆句', '湘绣工坊', '白天', '金句落点',
      '手指收住最后一缕细丝，画面定格在虎眼光点。',
      '收住细丝并定格虎眼光点',
      '9:16虎眼光点特写，金句字幕',
      undefined,
      '丝越细，光越活。', 8),
  ];
  return {
    ...storyShell('culture_promo', scenes),
    logline: '用三个近景看懂湘绣劈丝如何改变光泽。',
    theme: '细到极致，光才会活',
    full_text: scenes.map(scene => `${scene.plot}${scene.dialogue_or_narration ?? ''}`).join('\n\n'),
    story_structure: 'object_clue_journey',
    visual_symbols: ['劈开的丝线', '针尖', '虎眼光点'],
    core_message: '劈丝决定针脚的细度与光泽。',
    slogan_or_key_sentence: '丝越细，光越活。',
  };
}

function requiredTypeFields(videoType: VideoType): Partial<StoryGenerateResult> {
  if (['character_story', 'historical_drama', 'children_story'].includes(videoType)) {
    return {
      characters: dramaticFixture().characters,
      protagonist_arc: dramaticFixture().protagonist_arc,
    };
  }
  if (videoType === 'legend_story') {
    return { characters: dramaticFixture().characters };
  }
  if (videoType === 'heritage_promo') {
    return { craft_or_ritual_process: '选稿—上绷—配线—劈丝—落针—收针—装裱' };
  }
  return {};
}

function buildFailureFixture(complete: StoryGenerateResult, family: FixtureFamily): StoryGenerateResult {
  const failure = structuredClone(complete);
  failure.storyId = `${complete.storyId}-failure`;
  failure.title = '一般文化介绍';
  failure.logline = '全面介绍相关文化内容。';
  failure.theme = '文化';
  failure.full_text = '这里具有重要历史文化价值，需要全面系统深入介绍。'.repeat(20);
  failure.scene_breakdown = [makeScene(
    1,
    '一般介绍',
    '',
    '',
    '一般介绍',
    '这里具有重要历史文化价值，需要全面系统深入介绍。'.repeat(10),
    '介绍价值',
    '',
  )];
  failure.characters = [];
  failure.protagonist_arc = [];
  failure.visual_symbols = undefined;
  failure.core_message = undefined;
  failure.slogan_or_key_sentence = undefined;
  failure.craft_or_ritual_process = undefined;
  failure.modern_connection = undefined;
  failure.spatial_identity = undefined;
  failure.visual_route = undefined;
  failure.time_layer = undefined;
  failure.atmosphere = undefined;
  failure.argument_points = undefined;
  failure.knowledge_outline = undefined;
  failure.source_quotes = undefined;
  failure.field_notes = undefined;
  failure.credibility_note = '';
  if (family === 'dramatic_narrative') {
    failure.story_structure = 'single_event_drama';
  }
  return failure;
}

function sparseProductionMaterialReport(videoType: VideoType): ProductionMaterialReadinessReport {
  const missingField = {
    field_id: 'production_reference_assets',
    label: '生产参考素材',
    stage: 'production_ready' as const,
    blocking_level: 'blocking' as const,
    reason: '固定稀疏样本故意缺少生产参考图、授权或现场素材。',
    recommended_question: '请补充可用于生产的参考素材与授权说明。',
  };
  return {
    schema_version: 'production-material-readiness/v1',
    video_type: videoType,
    pack_label: `${VIDEO_TYPE_CONFIG[videoType].label}固定稀疏素材包`,
    score: 45,
    status: 'blocked',
    available_fields: ['title', 'full_text', 'scene_breakdown'],
    missing_fields: [missingField],
    gate_reports: [{
      stage: 'production_ready',
      status: 'blocked',
      required_items: ['production_reference_assets'],
      available_fields: [],
      missing_fields: [missingField],
      notes: ['正文质量与生产素材阻断必须分账。'],
    }],
    recommended_next_questions: [missingField.recommended_question],
  };
}

function makeScene(
  sceneId: number,
  title: string,
  location: string,
  timeOfDay: string,
  dramaticFunction: string,
  plot: string,
  keyAction: string,
  visualPrompt: string,
  conflict?: string,
  dialogueOrNarration?: string,
  durationSec = 18,
): StoryScene {
  return {
    scene_id: sceneId,
    title,
    duration_sec: durationSec,
    location,
    time_of_day: timeOfDay,
    dramatic_function: dramaticFunction,
    plot,
    key_action: keyAction,
    characters: [],
    visual_prompt: visualPrompt,
    camera_suggestion: visualPrompt ? '按画面路径使用近景、横移或缓推。' : '',
    cultural_note: '固定测试素材与创作补足分开标注。',
    conflict,
    dialogue_or_narration: dialogueOrNarration,
  };
}
