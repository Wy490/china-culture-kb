import type {
  StoryFamilyQualityCheck,
  StoryFamilyQualityReport,
  StoryGenerateResult,
  StoryQualityFamily,
  StoryQualityReport,
  VideoType,
} from '@shared/types.js';
import { validateDramaticStory } from './dramatic-story.js';
import { validateMemoryMosaicStory } from './memory-mosaic-service.js';

const FAMILY_BY_VIDEO_TYPE: Record<VideoType, StoryQualityFamily> = {
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

const FAMILY_LABELS: Record<StoryQualityFamily, string> = {
  dramatic_narrative: '剧情叙事',
  documentary_evidence: '纪录证据',
  promotional_communication: '宣传传播',
  instructional_learning: '讲解教学',
  spatial_landscape: '空间/山水',
  social_short_form: '社交短视频',
};

export interface StoryFamilyRepairGuidance {
  family: StoryQualityFamily;
  family_label: string;
  writer_role: string;
  focus_fields: string[];
  instructions: string[];
}

const FAMILY_REPAIR_GUIDANCE: Record<StoryQualityFamily, Omit<StoryFamilyRepairGuidance, 'family' | 'family_label'>> = {
  dramatic_narrative: {
    writer_role: '剧情叙事修订编剧',
    focus_fields: ['plot', 'key_action', 'conflict', 'dialogue_or_narration', 'protagonist_arc'],
    instructions: [
      '补清人物当下目标、具体阻力、不可撤回的选择与可见代价。',
      '用行动、对白和后果完成转变，不把质量标签抄进观众文本。',
    ],
  },
  documentary_evidence: {
    writer_role: '纪录证据短片修订编剧',
    focus_fields: ['plot', 'factual_basis', 'source_entries', 'field_notes', 'source_quotes', 'cultural_note'],
    instructions: [
      '围绕纪录问题组织现场、文献、实物或口述证据，并让证据逐场推进。',
      '明确事实、推断、有限再现与待核内容；不得为补剧情而虚构主角两难。',
    ],
  },
  promotional_communication: {
    writer_role: '宣传传播修订编剧',
    focus_fields: ['core_message', 'visual_symbols', 'modern_connection', 'slogan_or_key_sentence', 'plot', 'visual_prompt'],
    instructions: [
      '让价值主张由可验证的地点、物件、工艺动作或当代实践承载。',
      '补足当代连接与传播记忆句，减少通用口号，不强行增加剧情高潮。',
    ],
  },
  instructional_learning: {
    writer_role: '讲解教学修订编剧',
    focus_fields: ['argument_points', 'knowledge_outline', 'plot', 'dialogue_or_narration', 'visual_prompt'],
    instructions: [
      '明确问题或学习目标，按概念/步骤分层，并加入例子、示范、练习与复盘。',
      '让图示、对比和步骤标注服务理解，不把知识片改写成主角道德选择。',
    ],
  },
  spatial_landscape: {
    writer_role: '空间与山水影像修订编剧',
    focus_fields: ['spatial_identity', 'visual_route', 'time_layer', 'atmosphere', 'visual_prompt', 'camera_suggestion'],
    instructions: [
      '补清空间身份和连续视觉路线，用晨昏、天气、光影与现场声音建立时间层。',
      '控制旁白密度并保留感官留白，不增加无关人物传记、冲突或宣传口号。',
    ],
  },
  social_short_form: {
    writer_role: '社交短视频修订编剧',
    focus_fields: ['plot', 'key_action', 'dialogue_or_narration', 'visual_prompt', 'slogan_or_key_sentence'],
    instructions: [
      '前三秒直接给问题、反差或高价值信息，每场只承载一个信息点。',
      '压短字幕句，强化竖屏近景动作和可复述记忆句。',
    ],
  },
};

export type StoryFamilyQualityCandidate = Pick<
  StoryGenerateResult,
  'title' | 'logline' | 'theme' | 'full_text' | 'scene_breakdown' | 'video_type'
> & Partial<StoryGenerateResult>;

export function resolveStoryQualityFamily(videoType: VideoType): StoryQualityFamily {
  return FAMILY_BY_VIDEO_TYPE[videoType];
}

export function getStoryFamilyRepairGuidance(videoType: VideoType): StoryFamilyRepairGuidance {
  const family = resolveStoryQualityFamily(videoType);
  return {
    family,
    family_label: FAMILY_LABELS[family],
    ...FAMILY_REPAIR_GUIDANCE[family],
  };
}

export function validateStoryFamilyBaseQuality(
  story: StoryFamilyQualityCandidate,
  options: { selectedEvent?: string } = {},
): StoryQualityReport {
  const family = resolveStoryQualityFamily(story.video_type);
  if (family === 'dramatic_narrative') {
    return validateDramaticFamily(story, options.selectedEvent);
  }

  const checks = family === 'documentary_evidence'
    ? documentaryChecks(story)
    : family === 'promotional_communication'
      ? promotionalChecks(story)
      : family === 'instructional_learning'
        ? instructionalChecks(story)
        : family === 'spatial_landscape'
          ? spatialChecks(story)
          : socialShortChecks(story);
  return buildNonDramaticReport(story, family, checks);
}

function validateDramaticFamily(story: StoryFamilyQualityCandidate, selectedEvent?: string): StoryQualityReport {
  const base = story.story_structure === 'memory_mosaic_biography' && story.memory_mosaic_seed
    ? validateMemoryMosaicStory({
        full_text: story.full_text,
        scene_breakdown: story.scene_breakdown,
        memory_seed: story.memory_mosaic_seed,
      })
    : validateDramaticStory({
        full_text: story.full_text,
        scene_breakdown: story.scene_breakdown,
        title: story.title,
        selectedEvent: selectedEvent ?? story.story_blueprint?.central_event ?? story.title,
        videoType: story.video_type,
      });
  const sceneIds = story.scene_breakdown.map(scene => scene.scene_id);
  const checks = [
    makeCheck('central_event', '核心事件', base.hasCentralEvent, sceneIds.slice(0, 1), '围绕一个可识别的核心事件展开。'),
    makeCheck('goal_and_resistance', '目标与阻力', base.hasConflict, sceneIds, '人物目标受到具体外部或内在阻力。'),
    makeCheck('choice_and_action', '选择与行动', base.hasProtagonistChoice && base.hasSceneAction, sceneIds, '关键选择通过可拍动作体现。'),
    makeCheck('climax_and_consequence', '高潮与代价', base.hasClimax, sceneIds.slice(-2), '冲突升级到高潮并产生后果。'),
    makeCheck('change_and_aftertaste', '转变与余味', base.hasEndingTheme, sceneIds.slice(-1), '结尾呈现人物变化或主题余味。'),
  ];
  return {
    ...base,
    family_quality_report: buildFamilyReport('dramatic_narrative', checks),
  };
}

function documentaryChecks(story: StoryFamilyQualityCandidate): StoryFamilyQualityCheck[] {
  const text = storyText(story);
  const evidenceScenes = sceneIds(story, scene => Boolean(
    scene.factual_basis?.trim()
    || scene.source_entries?.length
    || /文献|档案|史料|碑刻|展陈|口述|据/.test(`${scene.plot} ${scene.cultural_note}`),
  ));
  const fieldScenes = sceneIds(story, scene => Boolean(
    scene.location.trim()
    && scene.visual_prompt.trim()
    && /现场|遗址|实物|展陈|匾额|碑|旧址|街巷|台基|器物/.test(`${scene.plot} ${scene.visual_prompt} ${scene.cultural_note}`),
  ));
  const boundaryScenes = sceneIds(story, scene => Boolean(
    scene.factual_basis?.trim()
    || scene.fictionalized_elements?.length
    || /事实边界|再现|可考|待核|来源/.test(scene.cultural_note),
  ));
  const focusPassed = Boolean(story.story_blueprint?.central_question?.trim())
    || /为什么|如何|究竟|何以|真相|痕迹|问题/.test(`${story.title} ${story.logline} ${text}`);
  const sourcePassed = Boolean(story.source_quotes?.length || story.field_notes?.length || evidenceScenes.length);
  const fieldPassed = Boolean(story.field_notes?.length || fieldScenes.length);
  const boundaryPassed = boundaryScenes.length > 0 && Boolean(story.credibility_note?.trim());
  const progressionScenes = sceneIds(story, scene => countContentChars(scene.plot) >= 18);

  return [
    makeCheck('documentary_inquiry', '纪录问题', focusPassed, story.scene_breakdown.slice(0, 1).map(scene => scene.scene_id), '建立清楚的纪录对象、问题或追索焦点。'),
    makeCheck('source_evidence', '来源与证据', sourcePassed, evidenceScenes, '用文献、实物、口述或来源提示支撑叙述。'),
    makeCheck('field_presence', '现实现场', fieldPassed, fieldScenes, '让现实地点、遗存或可拍实物进入镜头。'),
    makeCheck('fact_reconstruction_boundary', '事实与再现边界', boundaryPassed, boundaryScenes, '明确事实、推断、再现与待核内容的边界。'),
    makeCheck('evidence_progression', '证据推进', progressionScenes.length >= Math.min(3, story.scene_breakdown.length), progressionScenes, '场景按问题、证据与解释推进，而非只做结论宣告。'),
  ];
}

function promotionalChecks(story: StoryFamilyQualityCandidate): StoryFamilyQualityCheck[] {
  const text = storyText(story);
  const visibleScenes = sceneIds(story, scene => Boolean(
    scene.location.trim()
    && scene.visual_prompt.trim()
    && countContentChars(scene.key_action) >= 4,
  ));
  const modernScenes = sceneIds(story, scene => /当代|今天|如今|现代|仍在|年轻人|游客|社区|课堂|工作室|市集/.test(
    `${scene.plot} ${scene.key_action} ${scene.cultural_note}`,
  ));
  const finalScene = story.scene_breakdown.at(-1);
  const propositionPassed = Boolean(story.core_message?.trim() || story.slogan_or_key_sentence?.trim() || countContentChars(story.theme) >= 6);
  const visiblePassed = visibleScenes.length >= Math.min(2, story.scene_breakdown.length);
  const modernPassed = Boolean(story.modern_connection?.trim() || modernScenes.length);
  const memoryLinePassed = Boolean(
    story.slogan_or_key_sentence?.trim()
    || (finalScene && /走进|看见|体验|记住|一起|让我们|欢迎|从这里|仍在继续/.test(`${finalScene.plot} ${finalScene.dialogue_or_narration ?? ''}`)),
  );
  const specificityPassed = Boolean(story.visual_symbols?.length)
    || uniqueStrings(story.scene_breakdown.flatMap(scene => [scene.location, ...extractConcreteNouns(scene.visual_prompt)])).length >= 4;

  return [
    makeCheck('value_proposition', '价值主张', propositionPassed, story.scene_breakdown.slice(0, 1).map(scene => scene.scene_id), '说明要让目标受众记住的核心价值。'),
    makeCheck('verifiable_visuals', '可验证画面', visiblePassed, visibleScenes, '用具体地点、物件、人物实践或工艺动作承载主张。'),
    makeCheck('contemporary_connection', '当代连接', modernPassed, modernScenes, '展示文化、技艺或城市如何存在于当下。'),
    makeCheck('communication_memory_line', '传播记忆句', memoryLinePassed, finalScene ? [finalScene.scene_id] : [], '用可传播的记忆句或行动邀请收束。'),
    makeCheck('local_specificity', '在地/对象细节', specificityPassed, visibleScenes, '避免通用口号，保留可辨认的地方或对象细节。'),
  ];
}

function instructionalChecks(story: StoryFamilyQualityCandidate): StoryFamilyQualityCheck[] {
  const text = storyText(story);
  const firstScene = story.scene_breakdown[0];
  const lastScene = story.scene_breakdown.at(-1);
  const objectivePassed = Boolean(
    story.argument_points?.length
    || story.knowledge_outline?.length
    || /为什么|如何|什么是|学会|掌握|目标|问题/.test(`${story.logline} ${firstScene?.plot ?? ''} ${firstScene?.dialogue_or_narration ?? ''}`),
  );
  const moduleScenes = sceneIds(story, scene => countContentChars(scene.plot) >= 18);
  const hierarchyPassed = Boolean(story.knowledge_outline?.length && story.knowledge_outline.length >= 2)
    || moduleScenes.length >= Math.min(3, story.scene_breakdown.length);
  const exampleScenes = sceneIds(story, scene => /例如|比如|以.+为例|案例|演示|示范|先.+再|第一步|第二步/.test(
    `${scene.plot} ${scene.key_action} ${scene.dialogue_or_narration ?? ''}`,
  ));
  const recapScenes = sceneIds(story, scene => /总结|复盘|记住|要点|练习|思考|检验|回顾|试一试/.test(
    `${scene.title} ${scene.dramatic_function} ${scene.plot} ${scene.dialogue_or_narration ?? ''}`,
  ));
  const teachingVisualScenes = sceneIds(story, scene => /图示|标注|对比|步骤|示意|字幕|时间线|剖面|流程/.test(
    `${scene.visual_prompt} ${scene.camera_suggestion}`,
  ));

  return [
    makeCheck('learning_question_or_objective', '问题/学习目标', objectivePassed, firstScene ? [firstScene.scene_id] : [], '开场明确观众要理解的问题或学完能做到什么。'),
    makeCheck('concept_hierarchy', '概念与层级', hierarchyPassed, moduleScenes, '按概念、步骤或论点组织知识层级。'),
    makeCheck('example_or_demonstration', '例子/示范', exampleScenes.length > 0, exampleScenes, '用例子、案例或操作示范解释知识。'),
    makeCheck('recap_or_practice', '复盘/练习', recapScenes.length > 0, recapScenes.length ? recapScenes : lastScene ? [lastScene.scene_id] : [], '用复盘、练习或检验帮助观众巩固。'),
    makeCheck('teaching_visual_support', '教学视觉辅助', teachingVisualScenes.length > 0, teachingVisualScenes, '让图示、步骤标注或对比画面服务理解。'),
  ];
}

function spatialChecks(story: StoryFamilyQualityCandidate): StoryFamilyQualityCheck[] {
  const text = storyText(story);
  const locatedScenes = sceneIds(story, scene => Boolean(scene.location.trim()));
  const uniqueLocations = uniqueStrings(story.scene_breakdown.map(scene => scene.location));
  const routeScenes = sceneIds(story, scene => /从|沿|穿过|进入|转入|移向|走向|经过|拉远|前移|横移/.test(
    `${scene.plot} ${scene.key_action} ${scene.camera_suggestion}`,
  ));
  const timeLightScenes = sceneIds(story, scene => Boolean(
    scene.time_of_day.trim()
    && /光|影|晨|暮|黄昏|清晨|午后|夜|雾|雨|雪|晴|阴/.test(`${scene.time_of_day} ${scene.visual_prompt} ${scene.plot}`),
  ));
  const sensoryScenes = sceneIds(story, scene => /风|水声|鸟鸣|雨声|脚步|回声|钟声|竹|雾|气味|触感|湿|冷|暖|留白|静/.test(
    `${scene.plot} ${scene.visual_prompt} ${scene.dialogue_or_narration ?? ''}`,
  ));
  const duration = story.scene_breakdown.reduce((sum, scene) => sum + Math.max(scene.duration_sec || 0, 1), 0);
  const narrationDensity = countContentChars(story.full_text) / Math.max(duration, 1);
  const blankSpacePassed = sensoryScenes.length >= Math.min(2, story.scene_breakdown.length)
    && (story.video_type !== 'landscape_mood' || narrationDensity <= 2.5);
  const spatialIdentityPassed = Boolean(story.spatial_identity?.trim())
    || (locatedScenes.length === story.scene_breakdown.length && uniqueLocations.length >= 2);
  const routePassed = Boolean(story.visual_route?.length && story.visual_route.length >= 2)
    || (uniqueLocations.length >= 2 && routeScenes.length >= 2);
  const timeLightSoundPassed = Boolean(story.time_layer?.trim() && story.atmosphere?.trim())
    || (timeLightScenes.length >= Math.min(2, story.scene_breakdown.length) && sensoryScenes.length > 0);

  return [
    makeCheck('spatial_identity', '空间身份', spatialIdentityPassed, locatedScenes, '明确空间是谁、在哪里，以及可辨认的节点。'),
    makeCheck('visual_route', '视觉路线', routePassed, routeScenes, '镜头沿连续节点移动，不把地点写成无序空镜。'),
    makeCheck('time_light_sound', '时间、光影与声音', timeLightSoundPassed, uniqueNumbers([...timeLightScenes, ...sensoryScenes]), '用晨昏、天气、光影与现场声音建立时间层。'),
    makeCheck('sensory_blank_space', '感官与留白', blankSpacePassed, sensoryScenes, '以低密度旁白和感官画面保留空间呼吸。'),
  ];
}

function socialShortChecks(story: StoryFamilyQualityCandidate): StoryFamilyQualityCheck[] {
  const firstScene = story.scene_breakdown[0];
  const lastScene = story.scene_breakdown.at(-1);
  const firstText = firstScene
    ? `${firstScene.title} ${firstScene.dramatic_function} ${firstScene.plot} ${firstScene.dialogue_or_narration ?? ''}`
    : '';
  const hookPassed = /钩子|你知道|没想到|竟然|别再|为什么|如何|？|\?|！|!|第一眼|只用|原来/.test(firstText)
    || Boolean(firstScene && firstScene.duration_sec <= 5 && countContentChars(firstText) >= 12);
  const denseScenes = sceneIds(story, scene => {
    const count = countContentChars(`${scene.plot} ${scene.dialogue_or_narration ?? ''}`);
    return count >= 12 && count <= 90;
  });
  const densityPassed = story.scene_breakdown.length >= 2
    && story.scene_breakdown.length <= 5
    && denseScenes.length === story.scene_breakdown.length;
  const captionScenes = sceneIds(story, scene => Boolean(
    scene.dialogue_or_narration?.trim()
    && splitSentences(scene.dialogue_or_narration).every(sentence => countContentChars(sentence) <= 32),
  ));
  const memoryLinePassed = Boolean(
    story.slogan_or_key_sentence?.trim()
    || (lastScene && countContentChars(lastScene.dialogue_or_narration ?? lastScene.plot) <= 45),
  );
  const visualActionScenes = sceneIds(story, scene => countContentChars(scene.key_action) >= 4 && scene.visual_prompt.trim().length > 0);

  return [
    makeCheck('three_second_hook', '前三秒钩子', hookPassed, firstScene ? [firstScene.scene_id] : [], '第一镜直接给冲突、反差、问题或高价值信息。'),
    makeCheck('information_density', '信息密度', densityPassed, denseScenes, '短场景各承载一个清楚信息点，避免长铺垫。'),
    makeCheck('caption_rhythm', '字幕节奏', captionScenes.length > 0, captionScenes, '用适合竖屏阅读的短句和停顿组织字幕。'),
    makeCheck('memory_line', '记忆句', memoryLinePassed, lastScene ? [lastScene.scene_id] : [], '结尾保留可复述、可转发的核心句。'),
    makeCheck('vertical_visual_action', '竖屏视觉动作', visualActionScenes.length >= Math.min(2, story.scene_breakdown.length), visualActionScenes, '用近景动作、物件和画面变化承载信息。'),
  ];
}

function buildNonDramaticReport(
  story: StoryFamilyQualityCandidate,
  family: StoryQualityFamily,
  checks: StoryFamilyQualityCheck[],
): StoryQualityReport {
  const familyReport = buildFamilyReport(family, checks);
  const isNotBiographySummary = biographyYearParagraphCount(story.full_text) < 3;
  const issues = [
    ...checks
      .filter(check => check.status === 'failed')
      .map(check => `片型家族[${FAMILY_LABELS[family]}]未通过「${check.label}」：${check.summary}`),
    ...(!isNotBiographySummary ? ['full_text是生平年表——超过3个年份开头段落'] : []),
  ];
  const firstPassed = checks[0]?.status === 'passed';
  const visiblePassed = checks.slice(1, -1).some(check => check.status === 'passed');
  const endingPassed = checks.at(-1)?.status === 'passed';

  return {
    // These legacy booleans remain readable, but non-dramatic publication is
    // decided by family_quality_report instead of invented dramatic duties.
    hasCentralEvent: firstPassed,
    hasConflict: true,
    hasProtagonistChoice: true,
    hasSceneAction: visiblePassed,
    hasClimax: true,
    hasEndingTheme: endingPassed,
    isNotBiographySummary,
    passed: familyReport.passed && isNotBiographySummary,
    issues,
    family_quality_report: familyReport,
  };
}

function buildFamilyReport(
  family: StoryQualityFamily,
  checks: StoryFamilyQualityCheck[],
): StoryFamilyQualityReport {
  const blockingCheckIds = checks
    .filter(check => check.status === 'failed')
    .map(check => check.check_id);
  return {
    schema_version: 'story-family-quality/v1',
    family,
    family_label: FAMILY_LABELS[family],
    passed: blockingCheckIds.length === 0,
    checks,
    blocking_check_ids: blockingCheckIds,
  };
}

function makeCheck(
  checkId: string,
  label: string,
  passed: boolean,
  evidenceSceneIds: number[],
  summary: string,
): StoryFamilyQualityCheck {
  return {
    check_id: checkId,
    label,
    status: passed ? 'passed' : 'failed',
    evidence_scene_ids: uniqueNumbers(evidenceSceneIds),
    summary,
  };
}

function sceneIds(
  story: StoryFamilyQualityCandidate,
  predicate: (scene: StoryGenerateResult['scene_breakdown'][number]) => boolean,
): number[] {
  return story.scene_breakdown.filter(predicate).map(scene => scene.scene_id);
}

function storyText(story: StoryFamilyQualityCandidate): string {
  return [
    story.title,
    story.logline,
    story.theme,
    story.full_text,
    story.core_message ?? '',
    story.slogan_or_key_sentence ?? '',
    story.modern_connection ?? '',
    story.spatial_identity ?? '',
    story.time_layer ?? '',
    story.atmosphere ?? '',
    ...(story.visual_route ?? []),
    ...(story.argument_points ?? []),
    ...(story.knowledge_outline ?? []),
    ...(story.source_quotes ?? []),
    ...(story.field_notes ?? []),
    ...story.scene_breakdown.flatMap(scene => [
      scene.title,
      scene.dramatic_function,
      scene.location,
      scene.time_of_day,
      scene.plot,
      scene.key_action,
      scene.dialogue_or_narration ?? '',
      scene.visual_prompt,
      scene.camera_suggestion,
      scene.cultural_note,
      scene.factual_basis ?? '',
    ]),
  ].join('\n');
}

function countContentChars(text: string): number {
  return (text.match(/[\p{Script=Han}A-Za-z0-9]/gu) ?? []).length;
}

function biographyYearParagraphCount(text: string): number {
  return text
    .split(/\n\n+/)
    .filter(paragraph => /^(?:公元|前)?\d{3,4}年/.test(paragraph.trim()))
    .length;
}

function extractConcreteNouns(text: string): string[] {
  return text
    .split(/[，、；。\s]+/)
    .map(item => item.trim())
    .filter(item => item.length >= 2 && item.length <= 12);
}

function splitSentences(text: string): string[] {
  return text.split(/[。！？!?；;\n]+/).map(item => item.trim()).filter(Boolean);
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map(item => item.trim()).filter(Boolean))];
}

function uniqueNumbers(items: number[]): number[] {
  return [...new Set(items)].sort((left, right) => left - right);
}
