import { createHash } from 'node:crypto';
import type {
  EntryDetail,
  StoryBlueprint,
} from '@shared/types.js';
import type { StoryGenerationPromptPackage } from './story-generation-prompt.js';
import { buildStoryGenerationPromptPackage } from './story-generation-prompt.js';
import { buildStoryBlueprint } from './story-blueprint-service.js';
import type { CharacterStoryBenchmarkExecutionPackage } from './professional-benchmark-service.js';

export const CHARACTER_STORY_EVIDENCE_OUTPUT_CONTRACT = {
  schema_version: 'character-story-professional-evidence/v1',
  root_field: 'character_evidence',
  required_fields: [
    'protagonist',
    'goal',
    'resistance',
    'choice',
    'cost',
    'starting_relationship_state',
    'ending_relationship_state',
    'internal_change',
    'dialogue_voice_rules',
    'subtext_strategy',
    'scene_turns',
  ],
  constraints: {
    scalar_fields_must_be_non_empty: true,
    dialogue_voice_rules_min_items: 2,
    relationship_states_must_differ: true,
    scene_turns_must_cover_every_scene_id: true,
    evidence_must_be_observable_in_returned_story: true,
    unknown_content_must_not_be_promoted_to_fact: true,
  },
  json_shape: {
    protagonist: 'string',
    goal: 'string',
    resistance: 'string',
    choice: 'string',
    cost: 'string',
    starting_relationship_state: 'string',
    ending_relationship_state: 'string',
    internal_change: 'string',
    dialogue_voice_rules: 'string[>=2]',
    subtext_strategy: 'string',
    scene_turns: 'Record<scene_id,string>',
  },
} as const;

export const CHARACTER_STORY_SCENE_OUTPUT_CONTRACT = {
  schema_version: 'character-story-professional-scene/v1',
  root_field: 'story.scene_breakdown[]',
  required_fields: [
    'scene_id',
    'title',
    'duration_sec',
    'location',
    'time_of_day',
    'dramatic_function',
    'plot',
    'key_action',
    'characters',
    'visual_prompt',
    'camera_suggestion',
    'cultural_note',
    'conflict',
    'dialogue_or_narration',
    'source_entries',
    'factual_basis',
    'fictionalized_elements',
  ],
  constraints: {
    duration_sec_must_be_positive: true,
    scalar_fields_must_be_non_empty: true,
    characters_min_items: 1,
    source_entries_min_items: 1,
    fictionalized_elements_min_items: 1,
    scene_ids_must_be_contiguous_and_ordered: true,
    facts_and_dramatization_must_be_declared_per_scene: true,
    coordinator_must_not_infer_or_backfill_missing_scene_fields: true,
  },
  json_shape: {
    scene_id: 'positive integer',
    title: 'non-empty string',
    duration_sec: 'number > 0',
    location: 'non-empty string',
    time_of_day: 'non-empty string',
    dramatic_function: 'non-empty string',
    plot: 'non-empty string',
    key_action: 'non-empty string',
    characters: 'non-empty string[>=1]',
    visual_prompt: 'non-empty string',
    camera_suggestion: 'non-empty string',
    cultural_note: 'non-empty string',
    conflict: 'non-empty string',
    dialogue_or_narration: 'non-empty string',
    source_entries: 'non-empty string[>=1]',
    factual_basis: 'non-empty string',
    fictionalized_elements: 'non-empty string[>=1]',
  },
} as const;

export interface CharacterStoryProfessionalBenchmarkPromptPackage {
  schema_version: 'character-story-professional-benchmark-prompt/v2';
  benchmark_id: string;
  video_type: 'character_story';
  benchmark_prompt_version: 'character-story-professional-benchmark/v2';
  story_generation_prompt_version: 'story-generation/v1';
  source_snapshot_sha256: string;
  benchmark_instruction_sha256: string;
  base_story_prompt_sha256: string;
  story_blueprint: StoryBlueprint;
  story_generation_prompt: StoryGenerationPromptPackage;
  story_scene_output_contract: typeof CHARACTER_STORY_SCENE_OUTPUT_CONTRACT;
  character_evidence_output_contract: typeof CHARACTER_STORY_EVIDENCE_OUTPUT_CONTRACT;
  prompt_sha256: string;
  professional_passed: false;
}

function sha256(value: unknown): string {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return createHash('sha256').update(serialized).digest('hex');
}

function sourceSnapshotHashInput(
  executionPackage: CharacterStoryBenchmarkExecutionPackage,
): Record<string, unknown> {
  const snapshot = executionPackage.source_snapshot;
  return {
    source_entry: snapshot.source_entry,
    source_province: snapshot.source_province,
    source_region: snapshot.source_region,
    source_type: snapshot.source_type,
    source_era: snapshot.source_era,
    knowledge_base_credibility: snapshot.knowledge_base_credibility,
    summary: snapshot.summary,
    story: snapshot.story,
    cultural_significance: snapshot.cultural_significance,
    sources: snapshot.sources.map(source => source.citation),
    unverified_points: snapshot.unverified_points,
    verification_method: snapshot.verification_method,
  };
}

function entryFromSourceSnapshot(
  executionPackage: CharacterStoryBenchmarkExecutionPackage,
): EntryDetail {
  const snapshot = executionPackage.source_snapshot;
  return {
    name: snapshot.source_entry,
    province: snapshot.source_province,
    region: snapshot.source_region,
    type: snapshot.source_type,
    era: snapshot.source_era,
    summary: snapshot.summary,
    story: snapshot.story,
    culturalSignificance: snapshot.cultural_significance,
    relatedLocations: [],
    keywords: [],
    sources: snapshot.sources.map(source => source.citation),
    credibility: snapshot.knowledge_base_credibility,
    verificationMethod: snapshot.verification_method,
    unverifiedPoints: [...snapshot.unverified_points],
  };
}

function evidenceContractInstruction(
  executionPackage: CharacterStoryBenchmarkExecutionPackage,
): string {
  const required = CHARACTER_STORY_EVIDENCE_OUTPUT_CONTRACT.required_fields.join(', ');
  return [
    'PROFESSIONAL BENCHMARK CHARACTER_EVIDENCE OUTPUT CONTRACT',
    '在根级 JSON 中额外返回 character_evidence 对象，不得只在正文中暗示这些字段。',
    `character_evidence 必填字段：${required}。`,
    'goal、resistance、choice、cost 必须对应当前单一中心事件中的可见行动和后果，不能用人物评价替代。',
    'starting_relationship_state 与 ending_relationship_state 必须不同，并能由具体场景证明。',
    'dialogue_voice_rules 至少两条；subtext_strategy 必须说明表层目标与真实意图。',
    'scene_turns 必须以每个 scene_breakdown.scene_id 的字符串形式为键，逐场说明前后变化，不得缺场。',
    '所有 character_evidence 必须可在本次返回的 full_text 或 scene_breakdown 中观察到；不得为通过质量检查而虚构标签。',
    `固定 source_snapshot_sha256：${executionPackage.source_snapshot.snapshot_sha256}。`,
    `未知或禁止主张：${executionPackage.truth_boundary.unknown_or_forbidden_claims.join('；')}`,
  ].join('\n');
}

function storySceneContractInstruction(
  executionPackage: CharacterStoryBenchmarkExecutionPackage,
): string {
  const required = CHARACTER_STORY_SCENE_OUTPUT_CONTRACT.required_fields.join(', ');
  return [
    'PROFESSIONAL BENCHMARK COMPLETE STORY_SCENE OUTPUT CONTRACT',
    'story.scene_breakdown 的每一场都必须由模型直接返回完整、可拍摄的 StoryScene；后续 coordinator 不得猜测、默认或补写缺失字段。',
    `每场必填字段：${required}。`,
    'duration_sec 必须大于 0；characters、source_entries、fictionalized_elements 都必须是至少含一个非空字符串的数组；其余文本字段不得为空白。',
    'dramatic_function、conflict、key_action 与 dialogue_or_narration 必须共同说明本场的戏剧任务、阻力、可见行动和可表演文本。',
    'visual_prompt 与 camera_suggestion 必须给出可执行画面和镜头建议；不得只写抽象情绪或“同上”。',
    'source_entries 必须逐场列出实际依赖的冻结知识库条目或来源；factual_basis 必须说明本场哪些内容有事实依据。',
    'fictionalized_elements 必须逐场明确列出戏剧化对白、动作、场面调度或其他虚构加工；即使无新增虚构，也必须用非空说明明确声明边界。',
    `本批冻结来源条目：${executionPackage.source_snapshot.source_entry}。`,
    `允许的合理戏剧化：${executionPackage.truth_boundary.plausible_dramatization_allowlist.join('；')}`,
    `禁止或未知主张：${executionPackage.truth_boundary.unknown_or_forbidden_claims.join('；')}`,
  ].join('\n');
}

function appendEvidenceContract(
  basePrompt: StoryGenerationPromptPackage,
  executionPackage: CharacterStoryBenchmarkExecutionPackage,
): StoryGenerationPromptPackage {
  const instruction = evidenceContractInstruction(executionPackage);
  const sceneInstruction = storySceneContractInstruction(executionPackage);
  const benchmarkInstruction = `${sceneInstruction}\n\n${instruction}`;
  return {
    ...basePrompt,
    output_contract: {
      must_provide: [
        ...basePrompt.output_contract.must_provide,
        'story.scene_breakdown 中逐场完整返回全部 StoryScene 必填字段，不得依赖后处理补齐',
        '根级 character_evidence 对象及其全部必填字段',
      ],
      should_respect: [
        ...basePrompt.output_contract.should_respect,
        '每场 source_entries、factual_basis 与 fictionalized_elements 必须明确区分事实依据和戏剧化加工',
        '每场 duration_sec 必须大于 0，characters、source_entries、fictionalized_elements 均不得为空',
        'character_evidence 必须逐项锚定实际正文或分场，不得用自报标签替代作品证据',
        'scene_turns 必须覆盖每个 scene_breakdown.scene_id',
      ],
      return_json_fields: [
        ...basePrompt.output_contract.return_json_fields.filter(field => field !== 'character_evidence'),
        'character_evidence',
      ],
    },
    system_prompt: `${basePrompt.system_prompt}\n\n${benchmarkInstruction}`,
    user_prompt: `${basePrompt.user_prompt}\n\n${benchmarkInstruction}`,
  };
}

export function buildCharacterStoryProfessionalBenchmarkPrompt(
  executionPackage: CharacterStoryBenchmarkExecutionPackage,
): CharacterStoryProfessionalBenchmarkPromptPackage {
  if (executionPackage.video_type !== 'character_story') {
    throw new Error('Professional character benchmark prompt requires character_story');
  }
  const recomputedSourceHash = sha256(sourceSnapshotHashInput(executionPackage));
  if (recomputedSourceHash !== executionPackage.source_snapshot.snapshot_sha256) {
    throw new Error(`Benchmark source snapshot hash mismatch: ${executionPackage.benchmark_id}`);
  }
  if (executionPackage.execution_contract.benchmark_prompt_version !== 'character-story-professional-benchmark/v2') {
    throw new Error('Unsupported character story benchmark prompt version');
  }
  if (executionPackage.execution_contract.story_generation_prompt_version !== 'story-generation/v1') {
    throw new Error('Unsupported story generation prompt version');
  }

  const request = executionPackage.story_generation_request;
  const entry = entryFromSourceSnapshot(executionPackage);
  const presentationStyle = request.presentation_style ?? 'cinematic';
  const storyStructure = request.story_structure ?? 'single_event_drama';
  const targetDuration = request.target_video_duration ?? executionPackage.creative_contract.target_duration;
  const storyBlueprint = buildStoryBlueprint({
    entry,
    videoType: 'character_story',
    presentationStyle,
    storyStructure,
    targetDuration,
    centralEvent: executionPackage.creative_contract.central_event,
  });
  const baseStoryPrompt = buildStoryGenerationPromptPackage({
    entry,
    request,
    videoType: 'character_story',
    presentationStyle,
    storyStructure,
    targetDuration,
    tone: request.tone ?? '克制、具体、由人物选择和代价驱动',
    selectedEvent: executionPackage.creative_contract.central_event,
    storyBlueprint,
  });
  if (baseStoryPrompt.prompt_version !== executionPackage.execution_contract.story_generation_prompt_version) {
    throw new Error('Built story prompt version does not match benchmark execution contract');
  }
  const storyGenerationPrompt = appendEvidenceContract(baseStoryPrompt, executionPackage);
  const benchmarkInstruction = request.original_user_query ?? '';
  if (!benchmarkInstruction.trim()) {
    throw new Error('Benchmark instruction is required');
  }

  const hashInput = {
    schema_version: 'character-story-professional-benchmark-prompt/v2',
    benchmark_id: executionPackage.benchmark_id,
    video_type: 'character_story',
    benchmark_prompt_version: executionPackage.execution_contract.benchmark_prompt_version,
    story_generation_prompt_version: executionPackage.execution_contract.story_generation_prompt_version,
    source_snapshot_sha256: executionPackage.source_snapshot.snapshot_sha256,
    benchmark_instruction_sha256: sha256(benchmarkInstruction),
    base_story_prompt_sha256: sha256(baseStoryPrompt),
    story_blueprint: storyBlueprint,
    story_generation_prompt: storyGenerationPrompt,
    story_scene_output_contract: CHARACTER_STORY_SCENE_OUTPUT_CONTRACT,
    character_evidence_output_contract: CHARACTER_STORY_EVIDENCE_OUTPUT_CONTRACT,
    professional_passed: false,
  } as const;

  return {
    ...hashInput,
    prompt_sha256: sha256(hashInput),
  };
}
