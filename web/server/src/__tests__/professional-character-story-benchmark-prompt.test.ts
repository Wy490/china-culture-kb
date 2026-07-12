import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CharacterStoryBenchmarkExecutionPackage } from '../services/professional-benchmark-service.js';
import {
  buildCharacterStoryProfessionalBenchmarkPrompt,
  CHARACTER_STORY_EVIDENCE_OUTPUT_CONTRACT,
  CHARACTER_STORY_SCENE_OUTPUT_CONTRACT,
} from '../services/professional-benchmark-prompt-service.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const executionManifest = JSON.parse(fs.readFileSync(path.join(
  repoRoot,
  'data',
  'professional-benchmarks',
  'character-story-iteration3-execution-manifest.json',
), 'utf8')) as { packages: CharacterStoryBenchmarkExecutionPackage[] };

function firstExecutionPackage(): CharacterStoryBenchmarkExecutionPackage {
  return structuredClone(executionManifest.packages[0]);
}

describe('character_story professional benchmark prompt', () => {
  it('builds a deterministic Story Agent prompt with strict character evidence and frozen provenance', () => {
    const executionPackage = firstExecutionPackage();
    const result = buildCharacterStoryProfessionalBenchmarkPrompt(executionPackage);
    const repeated = buildCharacterStoryProfessionalBenchmarkPrompt(executionPackage);

    expect(result).toEqual(repeated);
    expect(result).toMatchObject({
      schema_version: 'character-story-professional-benchmark-prompt/v2',
      benchmark_id: executionPackage.benchmark_id,
      video_type: 'character_story',
      benchmark_prompt_version: executionPackage.execution_contract.benchmark_prompt_version,
      story_generation_prompt_version: executionPackage.execution_contract.story_generation_prompt_version,
      source_snapshot_sha256: executionPackage.source_snapshot.snapshot_sha256,
      professional_passed: false,
    });
    expect(result.prompt_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.benchmark_instruction_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.base_story_prompt_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.story_blueprint).toMatchObject({
      schema_version: 'story-blueprint/v1',
      source_entry: executionPackage.source_snapshot.source_entry,
      video_type: 'character_story',
      story_structure: 'single_event_drama',
      target_duration: executionPackage.creative_contract.target_duration,
      central_event: executionPackage.creative_contract.central_event,
    });
    expect(result.story_generation_prompt.prompt_version).toBe('story-generation/v1');
    expect(result.story_generation_prompt.context).toMatchObject({
      entry_name: executionPackage.source_snapshot.source_entry,
      entry_type: executionPackage.source_snapshot.source_type,
      entry_region: executionPackage.source_snapshot.source_region,
      video_type: 'character_story',
    });
    expect(result.story_generation_prompt.output_contract.return_json_fields)
      .toContain('character_evidence');
    expect(result.story_scene_output_contract).toEqual(CHARACTER_STORY_SCENE_OUTPUT_CONTRACT);
    expect(result.story_scene_output_contract.required_fields).toEqual(expect.arrayContaining([
      'duration_sec',
      'location',
      'time_of_day',
      'dramatic_function',
      'characters',
      'visual_prompt',
      'camera_suggestion',
      'cultural_note',
      'conflict',
      'dialogue_or_narration',
      'source_entries',
      'factual_basis',
      'fictionalized_elements',
    ]));
    expect(result.story_generation_prompt.output_contract.must_provide.join('\n'))
      .toContain('完整返回全部 StoryScene 必填字段');
    expect(result.story_generation_prompt.system_prompt).toContain('COMPLETE STORY_SCENE OUTPUT CONTRACT');
    expect(result.story_generation_prompt.user_prompt).toContain('coordinator 不得猜测、默认或补写');
    expect(result.story_generation_prompt.user_prompt).toContain('factual_basis');
    expect(result.story_generation_prompt.user_prompt).toContain('fictionalized_elements');
    expect(result.story_generation_prompt.system_prompt).toContain('CHARACTER_EVIDENCE OUTPUT CONTRACT');
    expect(result.story_generation_prompt.user_prompt).toContain('scene_turns');
    expect(result.character_evidence_output_contract)
      .toEqual(CHARACTER_STORY_EVIDENCE_OUTPUT_CONTRACT);
    expect(result.character_evidence_output_contract.required_fields).toEqual(expect.arrayContaining([
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
    ]));
  });

  it('rejects source content drift instead of silently building a new prompt under the frozen hash', () => {
    const executionPackage = firstExecutionPackage();
    executionPackage.source_snapshot.story = `${executionPackage.source_snapshot.story}\n未经签署的漂移内容`;

    expect(() => buildCharacterStoryProfessionalBenchmarkPrompt(executionPackage))
      .toThrow(/source snapshot hash mismatch/i);
  });

  it('rejects benchmark or story prompt version drift', () => {
    const benchmarkVersionDrift = firstExecutionPackage() as unknown as Record<string, any>;
    benchmarkVersionDrift.execution_contract.benchmark_prompt_version = 'character-story-professional-benchmark/v1';
    expect(() => buildCharacterStoryProfessionalBenchmarkPrompt(
      benchmarkVersionDrift as unknown as CharacterStoryBenchmarkExecutionPackage,
    )).toThrow(/benchmark prompt version/i);

    const storyVersionDrift = firstExecutionPackage() as unknown as Record<string, any>;
    storyVersionDrift.execution_contract.story_generation_prompt_version = 'story-generation/v2';
    expect(() => buildCharacterStoryProfessionalBenchmarkPrompt(
      storyVersionDrift as unknown as CharacterStoryBenchmarkExecutionPackage,
    )).toThrow(/story generation prompt version/i);
  });
});
