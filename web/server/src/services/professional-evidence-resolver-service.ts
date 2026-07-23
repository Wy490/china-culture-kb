import type {
  KnowledgeSupplementTask,
  ProfessionalEvidenceItem,
  ResearchAndEvidenceDossier,
  StoryGenerateResult,
  StoryScene,
  VideoType,
} from '@shared/types.js';
import type { AiComicDramaProfessionalEvidence } from './professional-ai-comic-drama-quality-service.js';
import type { ChildrenStoryProfessionalEvidence } from './professional-children-story-quality-service.js';
import type { CityBrandPromoEvidence } from './professional-city-brand-promo-quality-service.js';
import type { CulturePromoProfessionalEvidence } from './professional-culture-promo-quality-service.js';
import type { DocumentaryShortEvidence } from './professional-documentary-short-quality-service.js';
import type { EducationTrainingEvidence } from './professional-education-training-quality-service.js';
import type { ExplainerVideoEvidence } from './professional-explainer-video-quality-service.js';
import type { HeritagePromoProfessionalEvidence } from './professional-heritage-promo-quality-service.js';
import type { HistoricalDramaProfessionalEvidence } from './professional-historical-drama-quality-service.js';
import type { LandscapeMoodEvidence } from './professional-landscape-mood-quality-service.js';
import type { LectureVideoEvidence } from './professional-lecture-video-quality-service.js';
import type { LegendStoryProfessionalEvidence } from './professional-legend-story-quality-service.js';
import type { SceneShortEvidence } from './professional-scene-short-quality-service.js';
import type { SocialShortEvidence } from './professional-social-short-quality-service.js';
import type { CharacterStoryProfessionalEvidence } from './professional-text-quality-service.js';

export type ProfessionalEvidencePayload =
  | { video_type: 'character_story'; evidence: CharacterStoryProfessionalEvidence }
  | { video_type: 'historical_drama'; evidence: HistoricalDramaProfessionalEvidence }
  | { video_type: 'legend_story'; evidence: LegendStoryProfessionalEvidence }
  | { video_type: 'children_story'; evidence: ChildrenStoryProfessionalEvidence }
  | { video_type: 'ai_comic_drama'; evidence: AiComicDramaProfessionalEvidence }
  | { video_type: 'culture_promo'; evidence: CulturePromoProfessionalEvidence }
  | { video_type: 'heritage_promo'; evidence: HeritagePromoProfessionalEvidence }
  | { video_type: 'city_brand_promo'; evidence: CityBrandPromoEvidence }
  | { video_type: 'social_short'; evidence: SocialShortEvidence }
  | { video_type: 'documentary_short'; evidence: DocumentaryShortEvidence }
  | { video_type: 'explainer_video'; evidence: ExplainerVideoEvidence }
  | { video_type: 'lecture_video'; evidence: LectureVideoEvidence }
  | { video_type: 'education_training'; evidence: EducationTrainingEvidence }
  | { video_type: 'scene_short'; evidence: SceneShortEvidence }
  | { video_type: 'landscape_mood'; evidence: LandscapeMoodEvidence };

export interface ProfessionalEvidenceResolution {
  schema_version: 'professional-evidence-resolution/v1';
  resolved_at: string;
  video_type: VideoType;
  research: ResearchAndEvidenceDossier;
  payload: ProfessionalEvidencePayload;
  supplement_tasks: KnowledgeSupplementTask[];
  resolved_from: Array<'material_pack' | 'knowledge_pack' | 'story_blueprint' | 'story_scenes'>;
}

interface ResolutionContext {
  story: StoryGenerateResult;
  scenes: StoryScene[];
  research: ResearchAndEvidenceDossier;
  evidenceIds: string[];
  verifiedEvidenceIds: string[];
  sceneTurns: Record<string, string>;
  protagonist: string;
  now: string;
}

export function resolveProfessionalEvidenceForStory(
  story: StoryGenerateResult,
  options: { now?: string } = {},
): ProfessionalEvidenceResolution {
  const now = options.now ?? story.professional_text_package?.updated_at ?? new Date().toISOString();
  const research = buildResearchDossier(story);
  const evidenceIds = research.evidence_items.map(item => item.evidence_id);
  const verifiedEvidenceIds = research.evidence_items
    .filter(item => item.status === 'verified_fact')
    .map(item => item.evidence_id);
  const context: ResolutionContext = {
    story,
    scenes: story.scene_breakdown,
    research,
    evidenceIds,
    verifiedEvidenceIds,
    sceneTurns: Object.fromEntries(story.scene_breakdown.map(scene => [
      String(scene.scene_id),
      scene.conflict || scene.dramatic_function || scene.key_action || scene.plot,
    ])),
    protagonist: story.story_blueprint?.protagonist
      || story.characters?.[0]?.name
      || story.source_entry,
    now,
  };

  return {
    schema_version: 'professional-evidence-resolution/v1',
    resolved_at: now,
    video_type: story.video_type,
    research,
    payload: buildEvidencePayload(context),
    supplement_tasks: buildProfessionalSupplementTasks(context),
    resolved_from: [
      ...(story.material_pack ? ['material_pack' as const] : []),
      ...(story.knowledge_pack ? ['knowledge_pack' as const] : []),
      ...(story.story_blueprint ? ['story_blueprint' as const] : []),
      'story_scenes',
    ],
  };
}

function buildResearchDossier(story: StoryGenerateResult): ResearchAndEvidenceDossier {
  const verifiedClaims = uniqueStrings([
    ...(story.material_pack?.verified_facts ?? []),
    ...(story.knowledge_pack?.primary_entries.map(entry => entry.summary) ?? []),
    ...(story.knowledge_pack?.supporting_entries.map(entry => entry.summary) ?? []),
  ]);
  const creativeClaims = uniqueStrings([
    ...(story.material_pack?.creative_space ?? []),
    `分场、人物行动、对白和镜头次序属于「${story.title}」的专业文本创作组织。`,
  ]);
  const unknowns = uniqueStrings([
    ...(story.material_pack?.uncertain_claims ?? []),
    ...(story.material_pack?.missing_needs.map(item => `${item.label}：${item.message}`) ?? []),
    ...(story.knowledge_pack?.missing_needs.map(item => `${item.label}：${item.message}`) ?? []),
    ...story.cultural_constraints,
  ]);
  const evidenceItems: ProfessionalEvidenceItem[] = [
    ...verifiedClaims.map((claim, index): ProfessionalEvidenceItem => ({
      evidence_id: `professional-verified-${index + 1}`,
      status: 'verified_fact',
      claim,
      source: sourceLabel(story, index),
      allowed_usage: '可用于专业文本中的事实背景、地点、人物或文化对象说明。',
      verification_note: '沿用 canonical Story Agent 素材合同；正式发布仍按来源边界复核。',
    })),
    ...creativeClaims.map((claim, index): ProfessionalEvidenceItem => ({
      evidence_id: `professional-creative-${index + 1}`,
      status: 'plausible_dramatization',
      claim,
      source: `Story Agent narrative assembly: ${story.storyId}`,
      allowed_usage: '仅用于结构、人物行动、转场、旁白和镜头组织，不得冒充史实或现场记录。',
      verification_note: '这是可追踪的创作处理。',
    })),
  ];
  if (verifiedClaims.length === 0) {
    evidenceItems.unshift({
      evidence_id: 'professional-unverified-source-1',
      status: 'unknown',
      claim: `「${story.source_entry}」尚缺可核验事实条目，当前只能作为待补来源入口。`,
      source: story.source_entry,
      allowed_usage: '只可用于标记待补来源，不可写成确证事实。',
      verification_note: '需要补充正式来源或用户有权提供的材料。',
    });
  }
  return {
    source_summary: story.material_pack?.primary_materials.map(item => item.summary).filter(Boolean).join('；')
      || story.knowledge_pack?.primary_entries.map(entry => entry.summary).filter(Boolean).join('；')
      || `围绕「${story.source_entry}」和「${story.title}」整理的 canonical Story Agent 素材。`,
    evidence_items: evidenceItems,
    unknowns: unknowns.length > 0 ? unknowns : ['具体年代、身份、地点状态和机构口径以正式来源复核为准。'],
    authorization_notes: uniqueStrings([
      story.material_pack?.source_work_profile?.rights_note,
      story.material_pack?.source_work_profile?.adaptation_boundary,
      '本包不授予图片、影像、曲目、人物肖像或第三方文本的生产使用权。',
    ]),
  };
}

function sourceLabel(story: StoryGenerateResult, index: number): string {
  const material = [
    ...(story.material_pack?.primary_materials ?? []),
    ...(story.material_pack?.supporting_materials ?? []),
  ][index];
  if (material) return material.title;
  const knowledge = [
    ...(story.knowledge_pack?.primary_entries ?? []),
    ...(story.knowledge_pack?.supporting_entries ?? []),
  ][index];
  return knowledge?.entry_name ?? story.source_entry;
}

function buildProfessionalSupplementTasks(context: ResolutionContext): KnowledgeSupplementTask[] {
  const tasks: KnowledgeSupplementTask[] = [];
  if (context.verifiedEvidenceIds.length === 0) {
    const existing = existingProfessionalTask(context.story, 'professional_verified_facts');
    if (existing?.status !== 'resolved') {
      tasks.push({
        task_id: `${context.story.storyId}--professional-evidence--verified-facts`,
        need_id: 'professional_verified_facts',
        label: '专业脚本可核验事实',
        description: '专业脚本已完成结构化草拟，但缺少可核验事实，事实边界门禁不能通过。',
        category: 'general',
        stage: 'script_ready',
        blocking_level: 'blocking',
        affects: ['professional_text_package', 'truth_and_adaptation_contract', 'preproduction_package'],
        recommended_question: '请补充可核验的事实、来源名称、出处或用户有权提供的原作材料。',
        recommended_fields: ['verified_facts', 'source_reference', 'allowed_usage', 'verification_note'],
        intake_prompt: '只补可追溯事实；不把传说、推断、宣传表达或戏剧化内容标为已核验。',
        status: 'open',
        source: 'professional_evidence_missing',
        created_at: existing?.created_at ?? context.now,
      });
    }
  }
  if (context.story.video_type === 'documentary_short') {
    const existing = existingProfessionalTask(context.story, 'professional_documentary_interview_consent');
    if (existing?.status !== 'resolved') {
      tasks.push({
        task_id: `${context.story.storyId}--professional-evidence--documentary-interview`,
        need_id: 'professional_documentary_interview_consent',
        label: '纪录片采访与授权确认',
        description: '自动 resolver 不会虚构真实采访、受访者同意或现场授权。',
        category: 'person_experience',
        stage: 'script_ready',
        blocking_level: 'risk',
        affects: ['professional_text_package', 'documentary_interview_plan'],
        recommended_question: '请确认受访角色、可谈范围、证据关联和授权状态；未确认前不得生成其发言。',
        recommended_fields: ['interview_role', 'allowed_topics', 'evidence_ids', 'consent_status'],
        intake_prompt: '提交真实受访角色与授权记录，或明确改为无采访的观察型纪录结构。',
        status: 'open',
        source: 'professional_evidence_missing',
        created_at: existing?.created_at ?? context.now,
      });
    }
  }
  return tasks;
}

function buildEvidencePayload(context: ResolutionContext): ProfessionalEvidencePayload {
  switch (context.story.video_type) {
    case 'character_story':
      return { video_type: 'character_story', evidence: characterEvidence(context) };
    case 'historical_drama':
      return { video_type: 'historical_drama', evidence: historicalEvidence(context) };
    case 'legend_story':
      return { video_type: 'legend_story', evidence: legendEvidence(context) };
    case 'children_story':
      return { video_type: 'children_story', evidence: childrenEvidence(context) };
    case 'ai_comic_drama':
      return { video_type: 'ai_comic_drama', evidence: aiComicEvidence(context) };
    case 'culture_promo':
      return { video_type: 'culture_promo', evidence: culturePromoEvidence(context) };
    case 'heritage_promo':
      return { video_type: 'heritage_promo', evidence: heritageEvidence(context) };
    case 'city_brand_promo':
      return { video_type: 'city_brand_promo', evidence: cityEvidence(context) };
    case 'social_short':
      return { video_type: 'social_short', evidence: socialEvidence(context) };
    case 'documentary_short':
      return { video_type: 'documentary_short', evidence: documentaryEvidence(context) };
    case 'explainer_video':
      return { video_type: 'explainer_video', evidence: explainerEvidence(context) };
    case 'lecture_video':
      return { video_type: 'lecture_video', evidence: lectureEvidence(context) };
    case 'education_training':
      return { video_type: 'education_training', evidence: trainingEvidence(context) };
    case 'scene_short':
      return { video_type: 'scene_short', evidence: sceneShortEvidence(context) };
    case 'landscape_mood':
      return { video_type: 'landscape_mood', evidence: landscapeEvidence(context) };
  }
}

function characterEvidence(context: ResolutionContext): CharacterStoryProfessionalEvidence {
  const first = context.scenes[0];
  const choice = context.scenes.at(-2) ?? context.scenes.at(-1) ?? first;
  const ending = context.scenes.at(-1) ?? first;
  return {
    protagonist: context.protagonist,
    goal: first?.key_action || context.story.story_blueprint?.central_question || context.story.logline,
    resistance: first?.conflict || context.scenes.find(scene => scene.conflict)?.conflict || context.story.logline,
    choice: choice?.key_action || choice?.plot || context.story.theme,
    cost: ending?.conflict || ending?.plot || `选择使${context.protagonist}承担现实后果。`,
    starting_relationship_state: context.story.protagonist_arc?.[0]?.starting_state || `${context.protagonist}尚未取得理解或支持。`,
    ending_relationship_state: context.story.protagonist_arc?.[0]?.resolution || `${context.protagonist}与关键他人的关系因选择而改变。`,
    internal_change: context.story.protagonist_arc?.[0]?.turning_point || context.story.theme,
    dialogue_voice_rules: ['主角用具体行动和短句表达立场。', '对手或阻力方使用不同节奏与词汇，不替主角总结主题。'],
    subtext_strategy: '关键对白表面处理眼前任务，真实目的通过回避、停顿、道具和动作显露。',
    scene_turns: context.sceneTurns,
  };
}

function historicalEvidence(context: ResolutionContext): HistoricalDramaProfessionalEvidence {
  const first = context.scenes[0];
  const last = context.scenes.at(-1);
  return {
    central_event: context.story.story_blueprint?.central_event || context.story.title,
    protagonist: context.protagonist,
    era_pressure: first?.factual_basis || context.research.source_summary,
    institutional_pressure: first?.conflict || context.story.cultural_constraints[0] || '时代制度与现实责任形成不可回避的压力。',
    role_positions: Object.fromEntries((context.story.characters ?? []).map(character => [character.name, character.role])),
    decision_or_irreversible_action: (context.scenes.at(-2) ?? last)?.key_action || context.story.logline,
    consequence: last?.plot || context.story.theme,
    factual_event_chain: context.scenes.map((scene, index) => ({
      event_id: `historical-event-${scene.scene_id}`,
      order: index + 1,
      cause: index === 0 ? context.story.logline : context.scenes[index - 1].key_action,
      event: scene.key_action || scene.plot,
      consequence: context.scenes[index + 1]?.plot || context.story.theme,
      evidence_ids: evidenceIds(context),
    })),
    dialogue_voice_rules: ['不同身份使用符合处境的称谓、句式和信息权限。', '人物不说超出时代认知与证据边界的话。'],
    subtext_strategy: '立场冲突通过命令、试探、沉默与不可逆行动体现，不用现代价值口号代替。',
    scene_turns: context.sceneTurns,
  };
}

function legendEvidence(context: ResolutionContext): LegendStoryProfessionalEvidence {
  const first = context.scenes[0];
  const ending = context.scenes.at(-1);
  return {
    protagonist: context.protagonist,
    human_goal: first?.key_action || context.story.logline,
    human_trial: first?.conflict || context.story.logline,
    choice: (context.scenes.at(-2) ?? ending)?.key_action || context.story.theme,
    consequence: ending?.plot || context.story.theme,
    supernatural_element: context.story.characters?.find(character => /仙|神|灵|妖|龙|狐/.test(character.role + character.description))?.name
      || context.story.visual_symbols?.[0]
      || '传说中的神异力量',
    supernatural_function: '神异元素只放大凡人的考验、选择和后果，不替代人物行动。',
    symbolic_motif: context.story.visual_symbols?.[0] || first?.visual_prompt || context.story.source_entry,
    motif_scene_ids: context.scenes.slice(0, Math.max(2, context.scenes.length)).map(scene => scene.scene_id),
    version_boundaries: [{
      version_id: 'canonical-source-version',
      label: context.story.source_entry,
      source: context.story.source_entry,
      version_kind: 'local_adaptation',
      core_elements: [context.story.logline, context.story.theme],
      boundary_note: '本包是当前项目改编版本，不将传说细节写成确证史实。',
    }, {
      version_id: 'oral-version-unverified',
      label: '待核口述流传版本',
      source: '待补地方志、文学文本、讲述人或正式采集记录',
      version_kind: 'unknown',
      core_elements: [context.story.story_blueprint?.central_event || context.story.logline],
      boundary_note: '当前没有第二版本的可核验材料；只登记比较任务，不生成或冒充具体口述内容。',
    }],
    oral_rhythm_rules: ['关键意象重复三次并逐次变化。', '句式清晰、有回环，结尾说明传说为何被继续讲述。'],
    transmission_reason: `通过${context.protagonist}的选择保存关于「${context.story.theme}」的共同记忆。`,
    scene_turns: context.sceneTurns,
  };
}

function childrenEvidence(context: ResolutionContext): ChildrenStoryProfessionalEvidence {
  const attemptScenes = context.scenes.slice(1, -1);
  const sourceAttempts = attemptScenes.length >= 2 ? attemptScenes : context.scenes.slice(0, 2);
  return {
    target_age_band: '7-9',
    reading_level_note: '使用儿童能理解的具体动作、物件和情绪词，陌生文化词先在行动中解释。',
    vocabulary_rules: ['一句只表达一个动作或情绪。', '不用恐吓、羞辱、残酷惩罚或抽象说教。'],
    max_sentence_characters: 24,
    child_protagonist: context.protagonist,
    child_goal: context.scenes[0]?.key_action || context.story.logline,
    gentle_problem: context.scenes[0]?.conflict || '主角需要在不伤害任何人的前提下解决眼前困难。',
    safe_stakes: '失败只带来暂时失落、误会或需要重新尝试，不出现不可逆伤害。',
    attempts: sourceAttempts.map((scene, index) => ({
      attempt_id: `children-attempt-${index + 1}`,
      action: scene.key_action || scene.plot,
      outcome: scene.conflict || scene.dramatic_function,
      learning: context.sceneTurns[String(scene.scene_id)],
    })),
    positive_choice: (context.scenes.at(-2) ?? context.scenes.at(-1))?.key_action || context.story.theme,
    emotional_learning: context.story.theme,
    repeated_motif: context.story.visual_symbols?.[0] || context.story.source_entry,
    motif_scene_ids: context.scenes.map(scene => scene.scene_id),
    warm_resolution: context.scenes.at(-1)?.plot || context.story.theme,
    sensitive_content_boundaries: ['不制造恐怖威胁或残酷惩罚。', '不让成人权威用羞辱推动情节。'],
    parent_or_teacher_prompt: `可以和孩子讨论：${context.story.story_blueprint?.central_question || context.story.logline}`,
    scene_turns: context.sceneTurns,
  };
}

function aiComicEvidence(context: ResolutionContext): AiComicDramaProfessionalEvidence {
  const characters = context.story.characters?.map(character => character.name) ?? [context.protagonist];
  const locationAssets = uniqueStrings(context.scenes.map(scene => scene.location));
  return {
    protagonist: context.protagonist,
    episode_hook: context.scenes[0]?.key_action || context.story.logline,
    relationship_collision: context.scenes.find(scene => scene.conflict)?.conflict || context.story.logline,
    reversal_or_choice: (context.scenes.at(-2) ?? context.scenes.at(-1))?.key_action || context.story.theme,
    ending_hook: context.scenes.at(-1)?.plot || context.story.theme,
    ending_visible_action: context.scenes.at(-1)?.key_action || context.story.theme,
    panel_beats: context.scenes.flatMap(scene => {
      const assetIds = [
        `character-${safeId(context.protagonist)}`,
        `location-${safeId(scene.location || 'default')}`,
      ];
      return [{
        panel_id: `panel-${scene.scene_id}-1`,
        scene_id: scene.scene_id,
        order: 1,
        framing: '大全景或中景建立空间、人物站位与关键物件。',
        visible_action: `人物进入${scene.location || scene.title}并建立行动方向。`,
        expression: scene.dramatic_function,
        dialogue_bubble: undefined,
        reaction_panel: false,
        asset_ids: assetIds,
      }, {
        panel_id: `panel-${scene.scene_id}-2`,
        scene_id: scene.scene_id,
        order: 2,
        framing: scene.camera_suggestion || '中近景推进到手部与关键动作。',
        visible_action: scene.key_action || scene.plot,
        expression: scene.conflict || scene.dramatic_function,
        dialogue_bubble: shortText(scene.dialogue_or_narration || scene.plot, 24),
        reaction_panel: false,
        asset_ids: assetIds,
      }, {
        panel_id: `panel-${scene.scene_id}-3`,
        scene_id: scene.scene_id,
        order: 3,
        framing: '反打近景或道具特写承接动作结果。',
        visible_action: `动作结果在人物表情、身体方向或关键物件上留下可见变化。`,
        expression: context.sceneTurns[String(scene.scene_id)],
        dialogue_bubble: undefined,
        reaction_panel: true,
        asset_ids: assetIds,
      }];
    }),
    asset_bible: [
      ...characters.map(name => ({
        asset_id: `character-${safeId(name)}`,
        asset_type: 'character' as const,
        label: name,
        continuity_rule: '脸型、发式、服饰主色、随身物与身份特征跨格稳定。',
      })),
      ...locationAssets.map(location => ({
        asset_id: `location-${safeId(location)}`,
        asset_type: 'location' as const,
        label: location,
        continuity_rule: '空间方位、入口、光线方向和关键陈设保持可追踪。',
      })),
    ],
    max_bubble_characters: 24,
    scene_turns: context.sceneTurns,
  };
}

function culturePromoEvidence(context: ResolutionContext): CulturePromoProfessionalEvidence {
  const symbols = uniqueStrings([
    ...(context.story.visual_symbols ?? []),
    ...context.scenes.map(scene => scene.location),
  ]).slice(0, Math.max(2, context.scenes.length));
  const proofClaims = context.research.evidence_items.filter(item => item.status === 'verified_fact');
  const proofs = (proofClaims.length >= 3 ? proofClaims : context.research.evidence_items).slice(0, Math.max(3, proofClaims.length));
  return {
    communication_proposition: context.story.core_message || context.story.logline,
    audience_takeaway: context.story.theme,
    visual_symbols: symbols.map((label, index) => ({
      symbol_id: `symbol-${index + 1}`,
      label,
      meaning: context.scenes[index]?.dramatic_function || context.story.theme,
      scene_ids: uniqueNumbers([
        context.scenes[index % Math.max(1, context.scenes.length)]?.scene_id,
        context.scenes[(index + 1) % Math.max(1, context.scenes.length)]?.scene_id,
      ]),
    })),
    proof_points: proofs.map((item, index) => ({
      proof_id: `proof-${index + 1}`,
      claim: item.claim,
      evidence_ids: [item.evidence_id],
      visible_expression: context.scenes[index % Math.max(1, context.scenes.length)]?.key_action || context.story.logline,
    })),
    information_curve: context.scenes.map(scene => ({
      scene_id: scene.scene_id,
      new_information: scene.factual_basis || scene.plot,
      audience_effect: scene.dramatic_function,
    })),
    voiceover_visual_division: ['旁白只补画面看不见的事实、关系和时间信息。', '画面承担对象、动作、材料、空间与当代使用场景。'],
    modern_connection: context.story.modern_connection || context.scenes.at(-2)?.plot || context.story.theme,
    call_to_action: context.story.communication_goal || '沿着片中的具体对象继续了解、到访或支持其当代传承。',
    slogan_or_key_sentence: context.story.slogan_or_key_sentence || shortText(context.story.theme, 28),
    scene_turns: context.sceneTurns,
  };
}

function heritageEvidence(context: ResolutionContext): HeritagePromoProfessionalEvidence {
  const processScenes = context.scenes.slice(0, Math.max(3, context.scenes.length));
  const symbols = context.story.visual_symbols ?? [];
  return {
    materials: uniqueStrings([symbols[0], context.story.craft_or_ritual_process, context.scenes[0]?.visual_prompt]).slice(0, 3),
    tools: uniqueStrings([symbols[1], context.scenes[0]?.location, context.scenes[1]?.visual_prompt]).slice(0, 3),
    process_steps: processScenes.map((scene, index) => ({
      step_id: `heritage-step-${index + 1}`,
      order: index + 1,
      action: scene.key_action || scene.plot,
      material_or_tool: symbols[index % Math.max(1, symbols.length)] || scene.location || context.story.source_entry,
      evidence_ids: evidenceIds(context),
      safety_note: context.story.cultural_constraints[index] || '动作仅作画面组织，真实工序、工具与危险等级须另行核验。',
    })),
    practitioner: context.protagonist,
    hand_action_scene_ids: context.scenes.slice(0, 2).map(scene => scene.scene_id),
    transmission_relationship: `${context.protagonist}与学习者、协作者或社区共同完成可见过程。`,
    transmission_pressure: context.scenes.find(scene => scene.conflict)?.conflict || '真实材料、时间与传承环境形成现实压力。',
    modern_connection: context.story.modern_connection || context.story.theme,
    consent_and_authorization_notes: ['人物肖像、场地与社区叙述需逐项确认授权。', '曲目、图案、档案和第三方影像需记录来源及使用范围。'],
    hazard_boundaries: ['刀具、火源、设备或药材等步骤不得写成可模仿教程。', '禁忌、仪式与限制操作只按已核验范围呈现。'],
    scene_turns: context.sceneTurns,
  };
}

function cityEvidence(context: ResolutionContext): CityBrandPromoEvidence {
  return {
    city_proposition: context.story.core_message || context.story.logline,
    viewpoint_person: context.protagonist,
    viewpoint_goal: context.scenes[0]?.key_action || '沿真实空间路线寻找城市主张的生活证据。',
    route_stops: context.scenes.map((scene, index) => ({
      stop_id: `city-stop-${scene.scene_id}`,
      order: index + 1,
      place: scene.location || scene.title,
      visible_action: scene.key_action || scene.plot,
      city_evidence: scene.factual_basis || scene.plot,
      evidence_ids: evidenceIds(context),
      transition_to_next: context.scenes[index + 1]
        ? `人物从${scene.location || scene.title}移动到${context.scenes[index + 1].location || context.scenes[index + 1].title}。`
        : '路线在可执行行动召唤中收束。',
    })),
    daily_life_evidence: context.scenes.slice(0, 3).map(scene => scene.key_action || scene.plot),
    brand_landing: context.story.slogan_or_key_sentence || context.story.theme,
    call_to_action: context.story.communication_goal || '按片中路线进入真实城市空间并核对开放信息。',
    geographic_boundary_notes: ['地点、行政区划、现实功能和开放状态以拍摄时正式信息为准。', '不得用异地素材或通用城市空镜冒充目标城市。'],
    scene_turns: context.sceneTurns,
  };
}

function socialEvidence(context: ResolutionContext): SocialShortEvidence {
  const duration = Math.max(30, context.story.story_blueprint?.target_duration === '30秒' ? 30 : 60);
  const beatScenes = minimumSceneSequence(context.scenes, 5);
  const tailBeatDuration = (duration - 3) / Math.max(1, beatScenes.length - 1);
  return {
    target_duration_sec: duration,
    hook_0_3s: shortText(context.scenes[0]?.dialogue_or_narration || context.story.logline, 50),
    hook_fact_evidence_ids: evidenceIds(context),
    core_message: context.story.core_message || context.story.theme,
    beat_plan: beatScenes.map((scene, index) => {
      const startSec = index === 0 ? 0 : Math.round(3 + (index - 1) * tailBeatDuration);
      const endSec = index === 0
        ? 3
        : index === beatScenes.length - 1
          ? duration
          : Math.round(3 + index * tailBeatDuration);
      return {
      beat_id: `social-beat-${index + 1}`,
      order: index + 1,
      start_sec: startSec,
      end_sec: endSec,
      new_information: `信息${index + 1}：${scene.factual_basis || scene.plot}`,
      vertical_visual: scene.key_action || scene.visual_prompt,
      caption: shortText(scene.dialogue_or_narration || scene.plot, 24),
      voiceover_or_dialogue: `旁白补充：${scene.dialogue_or_narration || scene.plot}`,
      evidence_ids: evidenceIds(context),
      contrast_or_turn: context.sceneTurns[String(scene.scene_id)],
    };
    }),
    central_contrast: context.scenes.find(scene => scene.conflict)?.conflict || context.story.logline,
    shareable_line: context.story.slogan_or_key_sentence || shortText(context.story.theme, 28),
    interaction_question: `${context.story.story_blueprint?.central_question || context.story.logline}？`,
    platform_safety_notes: ['前三秒钩子不得牺牲事实、身份、地域或机构口径。', '竖屏字幕避开人物脸、关键物件和平台交互区。'],
    scene_turns: context.sceneTurns,
  };
}

function documentaryEvidence(context: ResolutionContext): DocumentaryShortEvidence {
  const steps = minimumSceneSequence(context.scenes, 4);
  const interviewTask = existingProfessionalTask(
    context.story,
    'professional_documentary_interview_consent',
  );
  const confirmedInterview = interviewTask?.status === 'resolved';
  const interviewFields = interviewTask?.supplement_field_values;
  return {
    core_question: context.story.story_blueprint?.central_question || context.story.logline,
    present_day_observer: '当代观察者（不冒充亲历者或权威机构）',
    real_sites: context.scenes.slice(0, Math.max(1, context.scenes.length)).map(scene => ({
      site_id: `site-${scene.scene_id}`,
      place: scene.location || context.story.source_entry,
      present_evidence: scene.factual_basis || '该地点或实物是否今天可见，需在拍摄前核验。',
      shootable_action: scene.key_action || scene.plot,
      evidence_ids: evidenceIds(context),
    })),
    interview_roles: [{
      role_id: 'interview-role-pending',
      role_description: interviewFields?.interview_role || '馆员、研究者、实践者或当地知情人（待确认）',
      confirmed: confirmedInterview,
      consent_status: confirmedInterview ? 'confirmed' : 'pending',
      allowed_topics: interviewFields?.allowed_topics
        ? splitFieldList(interviewFields.allowed_topics)
        : ['来源、现实现场、实物线索和当代痕迹'],
      evidence_ids: evidenceIds(context),
    }],
    source_clues: context.research.evidence_items.slice(0, Math.max(2, context.research.evidence_items.length)).map((item, index) => ({
      clue_id: `source-clue-${index + 1}`,
      source_label: item.source,
      claim: item.claim,
      visual_handling: '只展示可授权的来源标识、实物或转述卡，不虚构文献原件。',
      evidence_ids: [item.evidence_id],
    })),
    discovery_chain: steps.map((scene, index) => ({
      order: index + 1,
      question_or_discovery: scene.factual_basis || scene.plot,
      evidence_ids: evidenceIds(context),
      leads_to: steps[index + 1]?.key_action || context.story.theme,
    })),
    b_roll_plan: steps.map((scene, index) => ({
      shot_id: `broll-${index + 1}`,
      visible_action: scene.key_action || scene.visual_prompt || scene.plot,
      evidence_ids: evidenceIds(context),
    })),
    reenactment_boundaries: ['历史再现必须显式标为重构或示意，不冒充同期影像。', '未经来源支持的对白、动作和人物关系不得写成真实记录。'],
    restrained_narration_rules: ['旁白提出问题和连接证据，不替证据宣布结论。', '现场声、实物、地点和来源线索优先于情绪性评价。'],
    scene_turns: context.sceneTurns,
  };
}

function explainerEvidence(context: ResolutionContext): ExplainerVideoEvidence {
  const units = minimumSceneSequence(context.scenes, 3);
  return {
    core_question: context.story.story_blueprint?.central_question || context.story.logline,
    audience_prior_knowledge: context.story.target_audience || '不预设专业知识；术语需要先定义再举例。',
    concept_units: units.map((scene, index) => ({
      concept_id: `concept-${index + 1}`,
      order: index + 1,
      concept: context.story.argument_points?.[index] || scene.title,
      definition: scene.factual_basis || scene.plot,
      one_core_concept: true,
      evidence_ids: evidenceIds(context),
    })),
    examples: units.slice(0, 2).map((scene, index) => ({
      example_id: `example-${index + 1}`,
      mapped_concept_id: `concept-${index + 1}`,
      description: scene.key_action || scene.plot,
      what_it_proves: scene.dramatic_function,
      evidence_ids: evidenceIds(context),
    })),
    visual_explanations: units.map((scene, index) => ({
      visual_id: `visual-${index + 1}`,
      mapped_concept_id: `concept-${index + 1}`,
      visual_mechanism: scene.visual_prompt || scene.key_action,
      causal_mapping: `画面中的${scene.key_action || scene.title}对应概念的可见变化。`,
      limitation_or_non_equivalence: '图示和类比只解释关系，不替代真实尺度、年代、材料或科学机制。',
    })),
    misconceptions: [{
      misconception: `把「${context.story.theme}」简化为单一口号或装饰画面。`,
      correction: '按来源证据、概念定义、例子和适用边界分层解释。',
      evidence_ids: evidenceIds(context),
    }],
    summary_points: units.map(scene => scene.dramatic_function || scene.title).slice(0, 3),
    transfer_check_question: `换一个具体对象，你能否用同样的证据—概念—例子方法解释${context.story.theme}？`,
    scene_turns: context.sceneTurns,
  };
}

function lectureEvidence(context: ResolutionContext): LectureVideoEvidence {
  const units = minimumSceneSequence(context.scenes, 3);
  const cases = units.slice(0, 2).map((scene, index) => ({
    case_id: `lecture-case-${index + 1}`,
    title: scene.title,
    factual_summary: scene.factual_basis || scene.plot,
    what_it_supports: context.story.argument_points?.[index] || scene.dramatic_function,
    evidence_ids: evidenceIds(context),
  }));
  return {
    thesis: context.story.theme,
    audience_tension: context.story.story_blueprint?.central_question || context.story.logline,
    arguments: units.map((scene, index) => ({
      argument_id: `lecture-argument-${index + 1}`,
      order: index + 1,
      claim: context.story.argument_points?.[index] || scene.dramatic_function,
      reasoning: scene.plot,
      evidence_ids: evidenceIds(context),
      case_ids: [cases[index % cases.length]?.case_id].filter((id): id is string => Boolean(id)),
    })),
    cases,
    counterarguments: [{
      counterargument_id: 'lecture-counterargument-1',
      position: '传统材料离当代观众很远，未必能指导现实行动。',
      why_reasonable: '来源语境、事实边界和当代条件不同，直接套用会造成误解。',
      response: '只提炼由证据支持的方法与选择，并明确适用边界和不可类比之处。',
      evidence_ids: evidenceIds(context),
    }],
    rhetorical_transitions: ['先界定问题，再进入证据。', '从证据推进到案例，不用口号跳步。', '回应合理反方后，再提出可执行行动。'],
    action_conclusion: {
      audience_action: context.story.communication_goal || '用一条可核验来源和一个具体行动复述核心论点。',
      feasibility_boundary: '行动建议不替代机构政策、专业判断或正式历史结论。',
      institutional_wording_status: 'not_applicable',
    },
    value_boundary_notes: ['事实、论证、价值判断和行动建议必须分层。', '不得冒充机构立场或把历史语句无限套用于当代。'],
    scene_turns: context.sceneTurns,
  };
}

function trainingEvidence(context: ResolutionContext): EducationTrainingEvidence {
  const units = minimumSceneSequence(context.scenes, 3);
  const objectives = units.slice(0, 2).map((scene, index) => ({
    objective_id: `objective-${index + 1}`,
    observable_action: `学习者能够用自己的话说明${scene.title}并指出一个证据边界。`,
    success_criteria: '表述包含对象、动作或关系，以及至少一个来源/待核提醒。',
    evidence_ids: evidenceIds(context),
  }));
  return {
    learner_profile: context.story.target_audience || '文化入门学习者；不预设专业史学、工艺或民俗知识。',
    learning_objectives: objectives,
    knowledge_steps: units.map((scene, index) => ({
      step_id: `training-step-${index + 1}`,
      order: index + 1,
      title: scene.title,
      instruction: scene.plot,
      demonstration_action: scene.key_action || scene.visual_prompt,
      objective_ids: [objectives[index % objectives.length]?.objective_id].filter((id): id is string => Boolean(id)),
      evidence_ids: evidenceIds(context),
      safety_notes: ['示范只使用已核验事实和安全动作，未知内容明确标为待核。'],
    })),
    case_study: {
      title: context.story.title,
      scenario: context.story.logline,
      evidence_ids: evidenceIds(context),
      debrief: context.story.theme,
    },
    practice_tasks: objectives.map((objective, index) => ({
      task_id: `practice-${index + 1}`,
      instruction: `根据一个具体场景完成与「${objective.observable_action}」对应的练习。`,
      objective_ids: [objective.objective_id],
      expected_output: '一段包含事实、可见行动和边界说明的简短答案。',
      hints: ['先指出对象，再描述行动，最后标注来源或待核点。'],
    })),
    assessments: objectives.map((objective, index) => ({
      assessment_id: `assessment-${index + 1}`,
      objective_ids: [objective.objective_id],
      prompt: `提交能证明已完成目标 ${objective.objective_id} 的结果。`,
      rubric: ['对象与行动具体。', '事实和创作边界清楚。', '能够迁移到新案例。'],
      pass_condition: '三项标准至少满足两项，且不得把待核内容写成确证事实。',
    })),
    feedback_rules: ['先指出证据和行动是否对应，再给修正建议。', '事实错误优先修复，表达润色不得掩盖边界问题。'],
    recap_checklist: ['我能说明核心对象。', '我能指出可见行动或关系。', '我能区分已确认事实、创作处理和待核内容。'],
    institutional_accuracy_notes: ['课程不冒充学校、机构或专家认证。', '涉及年代、身份、级别和规范操作时必须引用正式来源。'],
    scene_turns: context.sceneTurns,
  };
}

function sceneShortEvidence(context: ResolutionContext): SceneShortEvidence {
  return {
    spatial_identity: context.story.spatial_identity || context.story.source_entry,
    route_purpose: context.story.story_blueprint?.central_question || context.story.logline,
    space_is_protagonist: true,
    route_nodes: context.scenes.map((scene, index) => ({
      node_id: `route-node-${scene.scene_id}`,
      order: index + 1,
      space: scene.location || scene.title,
      entry_action: index === 0 ? '进入空间并建立方位。' : `承接上一节点进入${scene.location || scene.title}。`,
      trigger: scene.key_action || scene.plot,
      discovery_or_change: scene.conflict || scene.dramatic_function,
      time_layer: scene.time_of_day || `时间层${index + 1}`,
      sound_cue: scene.dialogue_or_narration || `${scene.location || '空间'}现场声`,
      shot_action: scene.camera_suggestion || scene.key_action,
      evidence_ids: evidenceIds(context),
      transition_to_next: context.scenes[index + 1] ? '用人物移动、声音、光线或物件承接下一空间。' : '以现场声和空间余味收束。',
    })),
    person_or_event_trigger: context.scenes[0]?.key_action || context.story.logline,
    ending_atmosphere: context.story.atmosphere || context.scenes.at(-1)?.plot || context.story.theme,
    geographic_boundary_notes: ['地点功能、开放状态和拍摄范围以现实核验为准。', '时间叠印、人物路线和声音连接属于创作组织，不冒充同期记录。'],
    scene_turns: context.sceneTurns,
  };
}

function landscapeEvidence(context: ResolutionContext): LandscapeMoodEvidence {
  const phases = context.scenes.map((scene, index) => ({
    phase_id: `landscape-phase-${scene.scene_id}`,
    order: index + 1,
    time_state: scene.time_of_day || `时间阶段${index + 1}`,
    space_anchor: scene.location || context.story.source_entry,
    composition: scene.camera_suggestion || scene.visual_prompt,
    natural_motion: scene.key_action || '风、云、水、雾、草木或光影发生可见变化。',
    light_or_weather: `${scene.time_of_day || `阶段${index + 1}`}的光线与天气状态`,
    natural_sound: `${scene.location || '山水空间'}的风、水、鸟鸣或环境底噪`,
    narration: index < 2 ? shortText(scene.dialogue_or_narration || '', 20) : '',
    shot_duration_sec: Math.max(6, scene.duration_sec),
    evidence_ids: evidenceIds(context),
    transition_to_next: context.scenes[index + 1] ? '以光、风、水、云、声音或构图变化过渡。' : '留出自然声和静默。',
  }));
  return {
    emotional_premise: context.story.atmosphere || context.story.theme,
    visual_phases: phases,
    without_narration_readable: true,
    natural_sound_arc: phases.slice(0, 3).map(phase => phase.natural_sound),
    minimal_text_lines: uniqueStrings([
      shortText(context.story.theme, 18),
      shortText(context.story.slogan_or_key_sentence || '', 18),
    ]).slice(0, 2),
    ending_silence_sec: 3,
    human_trace_notes: ['人物只作为尺度、路径或生活痕迹，不压过空间与自然变化。'],
    geographic_boundary_notes: ['真实地点、季节、天气和拍摄范围需在执行前核验。', '替代素材必须标注，不得冒充目标地点同期实拍。'],
    scene_turns: context.sceneTurns,
  };
}

function evidenceIds(context: ResolutionContext): string[] {
  return context.verifiedEvidenceIds.length > 0 ? context.verifiedEvidenceIds : context.evidenceIds;
}

function existingProfessionalTask(
  story: StoryGenerateResult,
  needId: string,
): KnowledgeSupplementTask | undefined {
  return story.supplement_tasks?.find(task =>
    task.source === 'professional_evidence_missing' && task.need_id === needId
  );
}

function splitFieldList(value: string): string[] {
  return uniqueStrings(value.split(/[\n,，;；]+/));
}

function minimumSceneSequence(scenes: StoryScene[], minimum: number): StoryScene[] {
  if (scenes.length === 0) return [];
  return Array.from({ length: Math.max(minimum, scenes.length) }, (_, index) => scenes[index % scenes.length]);
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return values
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value, index, all) => all.indexOf(value) === index);
}

function uniqueNumbers(values: Array<number | undefined>): number[] {
  return values
    .filter((value): value is number => typeof value === 'number')
    .filter((value, index, all) => all.indexOf(value) === index);
}

function safeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

function shortText(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(1, maxLength - 1))}…`;
}
