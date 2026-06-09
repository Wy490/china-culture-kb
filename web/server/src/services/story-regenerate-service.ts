import type {
  GearsSegment,
  ReferenceTrace,
  StoryGenerateResult,
  StoryScene,
  StorySceneRegenerateRequest,
  StorySceneRegenerateIntent,
  WitnessMemory,
} from '@shared/types.js';
import {
  PRESENTATION_STYLE_CONFIG,
  STORY_STRUCTURE_CONFIG,
  VIDEO_TYPE_CONFIG,
} from '@shared/types.js';
import { buildSceneRegenerationPromptPackage } from './scene-regeneration-prompt.js';
import { generateScenePatchWithAdapter } from './scene-regeneration-model.js';
import { validateDramaticStory } from './dramatic-story.js';
import { validateMemoryMosaicStory } from './memory-mosaic-service.js';
import { combineQualityReports, validateReferenceSafety } from './reference-quality-service.js';
import { resolveModelProfile } from './model-catalog.js';

const REALITY_LINE_FUNCTIONS = new Set([
  '现实钩子',
  '物件线索',
  '现实线反应',
  '最终揭示',
  '结尾画面',
]);

const INTENT_LABELS: Record<StorySceneRegenerateIntent, string> = {
  tighten_conflict: '强化冲突',
  rewrite_narration: '重写旁白',
  shift_emotion: '调整情绪',
  clarify_visuals: '强化画面',
  custom: '自定义修改',
};

interface SceneRewriteContext {
  current: StoryScene;
  previous?: StoryScene;
  next?: StoryScene;
  story: StoryGenerateResult;
}

function cleanText(value: string | undefined): string {
  return (value ?? '').trim();
}

function sceneLeadCharacter(scene: StoryScene): string {
  return scene.characters[0] || '主角';
}

function deriveIntentTail(request: StorySceneRegenerateRequest): string {
  return request.user_note?.trim()
    ? `本次修改重点：${request.user_note.trim()}。`
    : '';
}

function deriveTension(scene: StoryScene): string {
  return cleanText(scene.conflict)
    || `${sceneLeadCharacter(scene)}被迫在这一刻作出更难回头的选择`;
}

function buildNarration(scene: StoryScene, intent: StorySceneRegenerateIntent, note?: string): string {
  const lead = sceneLeadCharacter(scene);
  if (intent === 'tighten_conflict') {
    return `旁白：${lead}知道，只要再往前一步，代价就会立刻落到自己身上。${note ? ` ${note}` : ''}`.trim();
  }
  if (intent === 'rewrite_narration') {
    return note ? `旁白：${note}` : `旁白：这一刻，${lead}不再只是旁观，而是在沉默里完成了判断。`;
  }
  if (intent === 'shift_emotion') {
    return note
      ? `${lead}的情绪被推向${note}。`
      : `旁白：${lead}表面仍然克制，内里却已经掀起更明显的情绪波动。`;
  }
  if (intent === 'clarify_visuals') {
    return scene.dialogue_or_narration ?? `旁白：镜头把${lead}的动作和视线停顿都交代得更具体。`;
  }
  return note
    ? `补充说明：${note}`
    : (scene.dialogue_or_narration ?? `旁白：${lead}在这里的表达已按新的要求调整。`);
}

function rewriteDramaticScene(context: SceneRewriteContext, request: StorySceneRegenerateRequest): StoryScene {
  const { current, previous, next } = context;
  const noteTail = deriveIntentTail(request);
  const previousBridge = previous ? `承接上一场“${previous.title}”后的余波，` : '';
  const nextBridge = next ? ` 这一场的结尾也把故事推向“${next.title}”所代表的下一步。` : '';
  const lead = sceneLeadCharacter(current);
  const tension = deriveTension(current);

  const basePlotByIntent: Record<StorySceneRegenerateIntent, string> = {
    tighten_conflict: `${previousBridge}${lead}在${current.location}清楚意识到：${tension}。他不再只是被动承受，而是必须把${current.key_action}变成一次真正冒险的动作。${nextBridge}`,
    rewrite_narration: `${previousBridge}${current.plot} 这一场不再平铺信息，而是把视角更贴近${lead}当下的判断与停顿。${nextBridge}`,
    shift_emotion: `${previousBridge}${current.plot} 这一次重点不只在事件本身，而在${lead}如何把犹豫、压抑、决心逐步显露出来。${nextBridge}`,
    clarify_visuals: `${previousBridge}${current.plot} 画面上会更清楚地交代人物动作、道具位置和空间关系，让这一场的冲突更可见。${nextBridge}`,
    custom: `${previousBridge}${current.plot} 这一场按新的要求重写，让动作、情绪和信息落点更集中。${nextBridge}`,
  };

  const nextKeyAction = request.intent === 'tighten_conflict'
    ? `直面${tension}`
    : request.intent === 'shift_emotion'
      ? `显露${lead}的内心变化`
      : request.intent === 'clarify_visuals'
        ? `把${current.key_action}拍得更具体`
        : current.key_action;

  const nextVisualPrompt = request.intent === 'clarify_visuals'
    ? `${current.visual_prompt}；补充呈现人物手部动作、关键道具与视线焦点${request.user_note ? `，重点：${request.user_note}` : ''}`
    : current.visual_prompt;

  const nextCamera = request.intent === 'clarify_visuals'
    ? `${current.camera_suggestion}，并增加一个交代动作结果的特写`
    : current.camera_suggestion;

  const nextConflict = request.intent === 'tighten_conflict'
    ? `${tension}${request.user_note ? `；局部重写要求：${request.user_note}` : '；这一次把后果说得更直接'}`
    : current.conflict;

  return {
    ...current,
    plot: `${basePlotByIntent[request.intent]} ${noteTail}`.trim(),
    key_action: nextKeyAction,
    conflict: nextConflict,
    dialogue_or_narration: buildNarration(current, request.intent, request.user_note),
    visual_prompt: nextVisualPrompt,
    camera_suggestion: nextCamera,
  };
}

function getWitnessForScene(story: StoryGenerateResult, sceneId: number): WitnessMemory | undefined {
  const seed = story.memory_mosaic_seed;
  if (!seed || seed.witnesses.length === 0) return undefined;

  const memoryScenes = story.scene_breakdown.filter(scene => !REALITY_LINE_FUNCTIONS.has(scene.dramatic_function));
  const witnessIndex = memoryScenes.findIndex(scene => scene.scene_id === sceneId);
  if (witnessIndex === -1) return undefined;
  return seed.witnesses[witnessIndex % seed.witnesses.length];
}

function rewriteMemoryMosaicScene(context: SceneRewriteContext, request: StorySceneRegenerateRequest): StoryScene {
  const { current, previous, next, story } = context;
  const seed = story.memory_mosaic_seed;
  const noteTail = deriveIntentTail(request);
  const isRealityLine = REALITY_LINE_FUNCTIONS.has(current.dramatic_function);

  if (!seed) {
    return rewriteDramaticScene(context, request);
  }

  if (isRealityLine) {
    const seeker = seed.present_day_seeker;
    const object = seed.trigger_object;
    const centralQuestion = seed.central_question;
    const nextReality = next ? ` 这一场也把追问继续推向“${next.title}”。` : '';

    const plotByIntent: Record<StorySceneRegenerateIntent, string> = {
      tighten_conflict: `${seeker}在${current.location}重新看向${object}，意识到自己不是单纯在寻找旧物，而是在逼近“${centralQuestion}”背后的代价。现实线的张力被拉高：如果他继续追下去，就必须面对更不舒服的真相。${nextReality}`,
      rewrite_narration: `${seeker}没有急着解释来龙去脉，而是让${object}自己先开口。镜头跟着他的停顿、触碰和回望，让问题在沉默里慢慢浮现：${centralQuestion}。${nextReality}`,
      shift_emotion: `${seeker}面对${object}时的情绪不再只是好奇，而是带出更明显的迟疑、被触动和逐步理解。现实线因此更像一场被旧物反过来逼问的追寻。${nextReality}`,
      clarify_visuals: `镜头更明确地交代${object}的质感、缺口、字迹和它所在的空间位置；${seeker}的动作也被拆得更清楚，让现实线的追问真正落到可见的细节上。${nextReality}`,
      custom: `${seeker}围绕${object}再次推进追问，把这一场改得更贴近现实线的悬念推进和认知变化。${nextReality}`,
    };

    return {
      ...current,
      plot: `${plotByIntent[request.intent]} ${noteTail}`.trim(),
      key_action: request.intent === 'clarify_visuals' ? `重新检视${object}` : `继续追问${object}背后的真相`,
      conflict: request.intent === 'tighten_conflict'
        ? `现实中的追寻者越接近真相，越不得不面对主角真实选择带来的复杂后果${request.user_note ? `；${request.user_note}` : ''}`
        : current.conflict,
      dialogue_or_narration: request.intent === 'rewrite_narration'
        ? `旁白：${seeker}终于明白，自己追问的不是一件旧物，而是一个人为什么会作出那样的选择。${request.user_note ? ` ${request.user_note}` : ''}`.trim()
        : buildNarration(current, request.intent, request.user_note),
      visual_prompt: request.intent === 'clarify_visuals'
        ? `${object}的局部特写、手部触碰、空间空镜与${seeker}的停顿反应并置${request.user_note ? `；重点：${request.user_note}` : ''}`
        : current.visual_prompt,
      camera_suggestion: request.intent === 'clarify_visuals'
        ? '物件特写与追寻者近景交替，补一个停顿后的缓推镜头'
        : current.camera_suggestion,
    };
  }

  const witness = getWitnessForScene(story, current.scene_id);
  const witnessName = witness?.witness_name || current.characters[1] || '见证人';
  const subject = seed.subject;
  const rememberedEvent = witness?.remembered_event || current.title;
  const subjectChoice = witness?.subject_choice || current.key_action;
  const emotionalBias = witness?.emotional_bias || 'admiration';
  const previousHint = previous ? `接在“${previous.title}”之后，` : '';
  const nextHint = next ? ` 这一段回忆也顺势把故事推向“${next.title}”。` : '';

  const plotByIntent: Record<StorySceneRegenerateIntent, string> = {
    tighten_conflict: `${previousHint}${witnessName}回忆起“${rememberedEvent}”时，不再只讲发生了什么，而是把${subject}当时真正要付出的代价讲得更尖锐。${subject}做出的选择是“${subjectChoice}”，而这恰恰让${witnessName}至今仍带着${emotionalBias}的情绪记住他。${nextHint}`,
    rewrite_narration: `${previousHint}${witnessName}不是替${subject}下结论，而是用自己的见闻慢慢逼近那个时刻：${rememberedEvent}。他的口吻里既有距离，也有没说完的话，让回忆更像口述而不是总结。${nextHint}`,
    shift_emotion: `${previousHint}${witnessName}这一段回忆被改得更贴近“${emotionalBias}”的情绪纹理。他说起${subject}时，不只是复述事件，而是在迟疑、心软、亏欠或不解里重新看见那次选择。${nextHint}`,
    clarify_visuals: `${previousHint}这段回忆会更明确地交代${witnessName}所处的位置、他看见的动作、道具和人物关系，让“${rememberedEvent}”真正变成一幕可以看见的回忆片段。${nextHint}`,
    custom: `${previousHint}${witnessName}围绕“${rememberedEvent}”重新讲述${subject}，让这段回忆更集中地服务于用户这次指定的修改目标。${nextHint}`,
  };

  return {
    ...current,
    plot: `${plotByIntent[request.intent]} ${noteTail}`.trim(),
    key_action: request.intent === 'tighten_conflict' ? `在回忆里看见${subject}如何承担代价` : subjectChoice,
    conflict: request.intent === 'tighten_conflict'
      ? `${subject}的选择让${witnessName}至今仍无法轻易放下这段记忆${request.user_note ? `；${request.user_note}` : ''}`
      : current.conflict,
    dialogue_or_narration: request.intent === 'rewrite_narration'
      ? `${witnessName}说：${request.user_note?.trim() || `${subject}那时并没有把自己说得多高尚，他只是照着心里的那把尺走下去。`}`
      : request.intent === 'shift_emotion'
        ? `${witnessName}说：我后来才知道，他当时不是不怕，只是比起自己，更怕那件事就这样错下去。${request.user_note ? ` ${request.user_note}` : ''}`.trim()
        : buildNarration(current, request.intent, request.user_note),
    visual_prompt: request.intent === 'clarify_visuals'
      ? `${witnessName}的口述特写、${subject}行动时的回忆画面、关键道具“${witness?.object_or_phrase || seed.trigger_object}”的插入镜头${request.user_note ? `；重点：${request.user_note}` : ''}`
      : current.visual_prompt,
    camera_suggestion: request.intent === 'clarify_visuals'
      ? '见证人口述中景与回忆画面特写交叉，补一个道具反应镜头'
      : current.camera_suggestion,
    source_entries: current.source_entries ?? [story.source_entry],
    factual_basis: current.factual_basis ?? witness?.factual_basis,
    fictionalized_elements: current.fictionalized_elements ?? witness?.fictionalized_elements,
  };
}

function renderSceneParagraph(scene: StoryScene, story: StoryGenerateResult): string {
  if (story.story_structure === 'memory_mosaic_biography') {
    const prefix = REALITY_LINE_FUNCTIONS.has(scene.dramatic_function) ? '【现实】' : '【回忆】';
    return [prefix + scene.plot, scene.dialogue_or_narration].filter(Boolean).join(' ');
  }
  return [scene.plot, scene.dialogue_or_narration].filter(Boolean).join(' ');
}

function rebuildFullTextFromScenes(story: StoryGenerateResult, scenes: StoryScene[]): string {
  return scenes.map(scene => renderSceneParagraph(scene, story)).join('\n\n');
}

function buildSegmentFromScene(scene: StoryScene, story: StoryGenerateResult, existing?: GearsSegment): GearsSegment {
  const visualFocus = [
    scene.location,
    ...scene.visual_prompt
      .split(/[，、。；]/)
      .map(part => part.trim())
      .filter(part => part.length > 1 && part.length < 12)
      .slice(0, 2),
  ].slice(0, 3);

  const vtMeta = VIDEO_TYPE_CONFIG[story.video_type];
  const psMeta = PRESENTATION_STYLE_CONFIG[story.presentation_style];
  const ssMeta = story.story_structure ? STORY_STRUCTURE_CONFIG[story.story_structure] : undefined;
  const isMemoryMosaic = story.story_structure === 'memory_mosaic_biography';
  const lineType = isMemoryMosaic
    ? (REALITY_LINE_FUNCTIONS.has(scene.dramatic_function) ? '现实线' : '回忆线')
    : '';

  const promptHintParts = [
    vtMeta?.label,
    psMeta?.label,
    ssMeta?.label,
  ].filter(Boolean);

  const scriptPrefix = isMemoryMosaic
    ? `【${scene.dramatic_function}·${lineType}】`
    : `【${scene.dramatic_function}】`;

  return {
    segment_id: existing?.segment_id ?? scene.scene_id,
    source_scene_id: scene.scene_id,
    duration_sec: existing?.duration_sec ?? scene.duration_sec,
    panel_count: existing?.panel_count ?? 6,
    script_text: `${scriptPrefix}${scene.location}，${scene.time_of_day}。${scene.plot}${scene.dialogue_or_narration ? ` ${scene.dialogue_or_narration}` : ''} [分镜${scene.scene_id}: ${scene.camera_suggestion}]`,
    purpose: isMemoryMosaic ? `${scene.dramatic_function}（${lineType}）` : scene.dramatic_function,
    visual_focus: visualFocus,
    cultural_constraints: scene.cultural_note ? [scene.cultural_note] : [],
    video_type: story.video_type,
    presentation_style: story.presentation_style,
    segment_prompt_hint: `${promptHintParts.join('/')}风格提示: ${psMeta?.description || ''}，场景${scene.scene_id}聚焦${scene.key_action}${lineType ? `（${lineType}）` : ''}`,
    source_entries: scene.source_entries ?? existing?.source_entries,
  };
}

function syncDerivedFields(story: StoryGenerateResult, scenes: StoryScene[]): Partial<StoryGenerateResult> {
  const patch: Partial<StoryGenerateResult> = {};

  if (story.video_type === 'ai_comic_drama') {
    patch.dialogue = scenes.map(scene => ({
      scene_id: scene.scene_id,
      lines: (scene.characters.length > 0 ? scene.characters : ['旁白']).map(character => ({
        character,
        text: scene.dialogue_or_narration ?? scene.key_action,
        emotion: scene.dramatic_function.includes('高潮')
          ? '激烈'
          : scene.dramatic_function.includes('钩子')
            ? '紧张'
            : '克制',
      })),
    }));
  }

  if (story.video_type === 'scene_short' || story.video_type === 'landscape_mood') {
    patch.visual_route = scenes.map(scene => `${scene.title}：${scene.visual_prompt}`);
  }

  if (story.video_type === 'explainer_video' || story.video_type === 'lecture_video') {
    patch.argument_points = scenes.slice(0, 4).map(scene => scene.key_action);
    patch.knowledge_outline = scenes.map(scene => `${scene.scene_id}. ${scene.title}：${scene.plot.substring(0, 40)}`);
  }

  return patch;
}

function applyScenePatch(baseScene: StoryScene, patch: {
  plot: string;
  key_action: string;
  dialogue_or_narration: string;
  conflict?: string;
  visual_prompt: string;
  camera_suggestion: string;
}): StoryScene {
  return {
    ...baseScene,
    plot: patch.plot,
    key_action: patch.key_action,
    dialogue_or_narration: patch.dialogue_or_narration,
    conflict: patch.conflict ?? baseScene.conflict,
    visual_prompt: patch.visual_prompt,
    camera_suggestion: patch.camera_suggestion,
  };
}

export async function regenerateSceneInStory(
  story: StoryGenerateResult,
  request: StorySceneRegenerateRequest,
): Promise<StoryGenerateResult> {
  const selectedModelProfile = resolveModelProfile(request.model_profile_id ?? story.model_profile_id);
  const sceneIndex = story.scene_breakdown.findIndex(scene => scene.scene_id === request.scene_id);
  if (sceneIndex === -1) return story;

  const context: SceneRewriteContext = {
    current: story.scene_breakdown[sceneIndex],
    previous: story.scene_breakdown[sceneIndex - 1],
    next: story.scene_breakdown[sceneIndex + 1],
    story,
  };

  const rewrittenScene = story.story_structure === 'memory_mosaic_biography'
    ? rewriteMemoryMosaicScene(context, request)
    : rewriteDramaticScene(context, request);

  const promptPackage = buildSceneRegenerationPromptPackage({
    story,
    request,
    current: context.current,
    previous: context.previous,
    next: context.next,
  });

  const modelResult = await generateScenePatchWithAdapter({
    pkg: promptPackage,
    current: rewrittenScene,
    modelProfileId: selectedModelProfile.id,
  });

  const finalScene = modelResult.patch
    ? applyScenePatch(rewrittenScene, modelResult.patch)
    : rewrittenScene;

  const updatedScenes = story.scene_breakdown.map(scene =>
    scene.scene_id === request.scene_id ? finalScene : scene,
  );

  const updatedSegments = story.gears_segments.some(segment => segment.source_scene_id === request.scene_id)
    ? story.gears_segments.map(segment =>
        segment.source_scene_id === request.scene_id
          ? buildSegmentFromScene(finalScene, story, segment)
          : segment,
      )
    : [...story.gears_segments, buildSegmentFromScene(finalScene, story)];

  const updatedStory: StoryGenerateResult = {
    ...story,
    model_profile_id: selectedModelProfile.id,
    // generation_source, generation_mode, generation_used_fallback:
    // These describe the ORIGINAL full-generation source and must NOT be overwritten
    // by scene-regeneration. Scene-regeneration info goes into reference_trace only.
    // If the user cares about which model was used for the scene rewrite,
    // they can check reference_trace for "provider:..." and "fallback:..." markers.
    scene_breakdown: updatedScenes,
    gears_segments: updatedSegments,
    full_text: rebuildFullTextFromScenes(story, updatedScenes),
  };

  const regenerationTrace: ReferenceTrace = {
    applied_rules: [
      `scene_regeneration:${request.intent}`,
      story.story_structure === 'memory_mosaic_biography'
        ? (REALITY_LINE_FUNCTIONS.has(finalScene.dramatic_function) ? '现实线局部重写' : '回忆线局部重写')
        : `按${finalScene.dramatic_function}场景功能重写`,
      `provider:${modelResult.provider}`,
      ...(modelResult.used_fallback ? [`fallback:${modelResult.reason || 'model unavailable'}`] : ['provider_output_applied']),
      ...(request.user_note?.trim() ? [`用户要求:${request.user_note.trim()}`] : []),
    ],
    source_story_structure: story.story_structure ?? 'single_event_drama',
  };

  const structuralQuality = story.story_structure === 'memory_mosaic_biography'
    ? validateMemoryMosaicStory({
        full_text: updatedStory.full_text,
        scene_breakdown: updatedScenes,
        memory_seed: updatedStory.memory_mosaic_seed,
      })
    : validateDramaticStory({
        full_text: updatedStory.full_text,
        scene_breakdown: updatedScenes,
        title: updatedStory.title,
        selectedEvent: updatedStory.title,
      });

  const referenceSafety = validateReferenceSafety({
    generated_text: updatedStory.full_text,
    reference_trace: [...(updatedStory.reference_trace ?? []), regenerationTrace],
  });

  return {
    ...updatedStory,
    reference_trace: [...(updatedStory.reference_trace ?? []), regenerationTrace],
    quality_report: combineQualityReports(structuralQuality, referenceSafety),
    ...syncDerivedFields(updatedStory, updatedScenes),
  };
}

export function buildRegenerationNote(request: StorySceneRegenerateRequest): string {
  const intentLabel = INTENT_LABELS[request.intent];
  return request.user_note?.trim()
    ? `${intentLabel}：${request.user_note.trim()}`
    : intentLabel;
}
