import type {
  StoryGenerateResult,
  StoryScene,
  StorySceneRegenerateRequest,
} from '@shared/types.js';

export interface SceneRegenerationPromptPackage {
  prompt_version: 'scene-regeneration/v1';
  context: {
    project_id?: string;
    story_id: string;
    title: string;
    video_type: string;
    presentation_style: string;
    story_structure?: string;
    source_entry: string;
    logline: string;
    theme: string;
  };
  target_scene: StoryScene;
  previous_scene?: StoryScene;
  next_scene?: StoryScene;
  story_outline: Array<{
    scene_id: number;
    title: string;
    dramatic_function: string;
    key_action: string;
  }>;
  knowledge_context?: {
    primary_entries: string[];
    supporting_entries: string[];
  };
  supplement_context?: Array<{
    task_id: string;
    label: string;
    category?: string;
    supplement_note: string;
  }>;
  story_blueprint_context?: {
    central_question: string;
    target_beat?: {
      function_label: string;
      content_requirement: string;
      emotional_turn?: string;
    };
  };
  memory_mosaic_context?: {
    present_day_seeker: string;
    trigger_object: string;
    central_question: string;
    witness_names: string[];
  };
  rewrite_request: {
    intent: StorySceneRegenerateRequest['intent'];
    user_note?: string;
  };
  output_contract: {
    must_keep: string[];
    should_respect: string[];
    return_json_fields: string[];
  };
  system_prompt: string;
  user_prompt: string;
}

function buildSystemPrompt(story: StoryGenerateResult): string {
  const structureLine = story.story_structure === 'memory_mosaic_biography'
    ? '这是回忆拼图式人物故事。回忆线必须像见证人口述，现实线必须围绕追寻者与触发物件推进。'
    : '这是影视化故事场景重写任务。必须保持前后场衔接、戏剧功能和人物动机。';

  return [
    '你是一个擅长中文影视叙事改写的故事编辑器。',
    '你的任务不是重写整篇故事，而是只重写一个目标场景。',
    '必须保持整体故事设定、人物身份、来源条目和叙事结构不变。',
    structureLine,
    '禁止输出解释、分析、Markdown、代码块。',
    '只返回 JSON 对象，并且只能包含指定字段。',
  ].join('\n');
}

function buildUserPrompt(pkg: Omit<SceneRegenerationPromptPackage, 'system_prompt' | 'user_prompt'>): string {
  const lines: string[] = [
    `故事标题：${pkg.context.title}`,
    `来源条目：${pkg.context.source_entry}`,
    `成片类型：${pkg.context.video_type} / ${pkg.context.presentation_style}`,
    `叙事结构：${pkg.context.story_structure ?? 'single_event_drama'}`,
    `改写意图：${pkg.rewrite_request.intent}`,
  ];

  if (pkg.rewrite_request.user_note) {
    lines.push(`用户补充：${pkg.rewrite_request.user_note}`);
  }

  lines.push(
    '',
    '目标场景：',
    JSON.stringify(pkg.target_scene, null, 2),
  );

  if (pkg.previous_scene) {
    lines.push('', '上一场：', JSON.stringify(pkg.previous_scene, null, 2));
  }
  if (pkg.next_scene) {
    lines.push('', '下一场：', JSON.stringify(pkg.next_scene, null, 2));
  }

  lines.push(
    '',
    '全局场景摘要：',
    JSON.stringify(pkg.story_outline, null, 2),
  );

  if (pkg.memory_mosaic_context) {
    lines.push('', '回忆拼图上下文：', JSON.stringify(pkg.memory_mosaic_context, null, 2));
  }

  if (pkg.knowledge_context) {
    lines.push('', '知识来源上下文：', JSON.stringify(pkg.knowledge_context, null, 2));
  }

  if (pkg.supplement_context && pkg.supplement_context.length > 0) {
    lines.push('', '已完成资料补录：', JSON.stringify(pkg.supplement_context, null, 2));
  }

  if (pkg.story_blueprint_context) {
    lines.push('', '类型故事蓝图：', JSON.stringify(pkg.story_blueprint_context, null, 2));
    lines.push('目标场景重写后仍必须承担上述类型节拍功能。');
  }

  lines.push(
    '',
    '请只输出一个 JSON 对象，字段限制为：plot, key_action, dialogue_or_narration, conflict, visual_prompt, camera_suggestion。',
    '如果某字段不需要修改，也仍然返回它，但要保证是完整字符串。',
    '不要改 scene_id / title / duration_sec / location / time_of_day / dramatic_function / characters。',
  );

  return lines.join('\n');
}

export function buildSceneRegenerationPromptPackage(input: {
  story: StoryGenerateResult;
  request: StorySceneRegenerateRequest;
  current: StoryScene;
  previous?: StoryScene;
  next?: StoryScene;
}): SceneRegenerationPromptPackage {
  const targetBeat = input.story.story_blueprint?.genre_beats
    .find(beat => beat.scene_id === input.current.scene_id);
  const supplementContext = input.story.supplement_tasks
    ?.filter(task => task.status === 'resolved' && task.supplement_note?.trim())
    .map(task => ({
      task_id: task.task_id,
      label: task.label,
      ...(task.category ? { category: task.category } : {}),
      supplement_note: task.supplement_note!.trim(),
    }));
  const base: Omit<SceneRegenerationPromptPackage, 'system_prompt' | 'user_prompt'> = {
    prompt_version: 'scene-regeneration/v1',
    context: {
      project_id: input.story.project_id,
      story_id: input.story.storyId,
      title: input.story.title,
      video_type: input.story.video_type,
      presentation_style: input.story.presentation_style,
      story_structure: input.story.story_structure,
      source_entry: input.story.source_entry,
      logline: input.story.logline,
      theme: input.story.theme,
    },
    target_scene: input.current,
    previous_scene: input.previous,
    next_scene: input.next,
    story_outline: input.story.scene_breakdown.map(scene => ({
      scene_id: scene.scene_id,
      title: scene.title,
      dramatic_function: scene.dramatic_function,
      key_action: scene.key_action,
    })),
    knowledge_context: input.story.knowledge_pack
      ? {
          primary_entries: input.story.knowledge_pack.primary_entries.map(entry => entry.entry_name),
          supporting_entries: input.story.knowledge_pack.supporting_entries.map(entry => entry.entry_name),
        }
      : undefined,
    supplement_context: supplementContext && supplementContext.length > 0 ? supplementContext : undefined,
    story_blueprint_context: input.story.story_blueprint
      ? {
          central_question: input.story.story_blueprint.central_question,
          target_beat: targetBeat
            ? {
                function_label: targetBeat.function_label,
                content_requirement: targetBeat.content_requirement,
                emotional_turn: targetBeat.emotional_turn,
              }
            : undefined,
        }
      : undefined,
    memory_mosaic_context: input.story.memory_mosaic_seed
      ? {
          present_day_seeker: input.story.memory_mosaic_seed.present_day_seeker,
          trigger_object: input.story.memory_mosaic_seed.trigger_object,
          central_question: input.story.memory_mosaic_seed.central_question,
          witness_names: input.story.memory_mosaic_seed.witnesses.map(w => w.witness_name),
        }
      : undefined,
    rewrite_request: {
      intent: input.request.intent,
      user_note: input.request.user_note?.trim() || undefined,
    },
    output_contract: {
      must_keep: [
        'scene_id',
        'title',
        'duration_sec',
        'location',
        'time_of_day',
        'dramatic_function',
        'characters',
      ],
      should_respect: [
        '保持前后场景衔接',
        '保持来源条目和文化语境一致',
        '保持当前成片类型的叙事质感',
        '优先吸收已完成资料补录，但不要把未确认内容写成新的史实断言',
      ],
      return_json_fields: [
        'plot',
        'key_action',
        'dialogue_or_narration',
        'conflict',
        'visual_prompt',
        'camera_suggestion',
      ],
    },
  };

  return {
    ...base,
    system_prompt: buildSystemPrompt(input.story),
    user_prompt: buildUserPrompt(base),
  };
}
