import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { StoryGenerateRequest } from '@shared/types.js';
import { prepareChinaCultureStoryGeneration } from '../domains/china-culture/story-generation-preparation-service.js';

describe('china_culture story generation preparation service', () => {
  it('prepares source, material, policy, genre, readiness, model and blueprint as one domain-owned contract', async () => {
    const result = await prepareChinaCultureStoryGeneration({
      video_type: 'ai_comic_drama',
      presentation_style: 'ai_comic',
      story_structure: 'single_event_drama',
      narrative_pattern_ids: ['hero_choice'],
      selected_event: '少年决定守护山村古桥',
      creation_use_case: 'original_ai_comic',
      truth_mode: 'fictional_original',
      outline: '山村少年发现古桥即将被洪水冲毁。他必须召集伙伴，在暴雨前守住古桥。',
      tone: '克制写实',
      story_priority: 'plot_first',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.primaryEntryName).toContain('用户原创故事种子');
    expect(result.entry.name).toBe(result.primaryEntryName);
    expect(result.videoType).toBe('ai_comic_drama');
    expect(result.presentationStyle).toBe('ai_comic');
    expect(result.storyStructure).toBe('single_event_drama');
    expect(result.toneWithPriority).toContain('克制写实');
    expect(result.narrativePatternIds).toContain('hero_choice');
    expect(result.knowledgePackToUse.primary_entries[0]?.entry_name).toBe(result.primaryEntryName);
    expect(result.materialPackToUse.primary_materials.length).toBeGreaterThan(0);
    expect(result.creationContract.video_type).toBe('ai_comic_drama');
    expect(result.materialSufficiency.schema_version).toBe('material-sufficiency/v1');
    expect(result.productionMaterialReadiness).toBeDefined();
    expect(result.selectedModelProfile.id).toBeTruthy();
    expect(result.centralEvent).toBe('少年决定守护山村古桥');
    expect(result.preliminaryStoryBlueprint.source_entry).toBe(result.primaryEntryName);
  });

  it('keeps user-novel adaptation analysis inside preparation without treating it as verified source evidence', async () => {
    const request: StoryGenerateRequest = {
      video_type: 'ai_comic_drama',
      story_structure: 'single_event_drama',
      source_material_mode: 'adapt_user_novel',
      original_user_query: '少年在濂溪边读书，后来面对一份疑案。他必须在顺从权势与守住良知之间作出选择。',
    };
    const result = await prepareChinaCultureStoryGeneration(request);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.adaptationAnalysis?.source_mode).toBe('user_novel');
    expect(result.creationContract.truth_mode).toBe(result.truthMode);
    expect(result.entry.credibility).toBe('用户提供');
    expect(result.entry.verificationMethod).toContain('用户素材主导');
  });

  it('preserves source-resolution failure and keeps the legacy orchestrator free of preparation rules', async () => {
    const missing = await prepareChinaCultureStoryGeneration({
      video_type: 'ai_comic_drama',
    });
    expect(missing).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
    });

    const storyGenerationSource = await readFile(
      new URL('../domains/china-culture/story-generation-service.ts', import.meta.url),
      'utf8',
    );
    const preparationSource = await readFile(
      new URL('../domains/china-culture/story-generation-preparation-service.ts', import.meta.url),
      'utf8',
    );

    expect(storyGenerationSource).toContain("from './story-generation-preparation-service.js'");
    expect(storyGenerationSource).not.toContain("from '../../platform/story-generation-policy.js'");
    expect(storyGenerationSource).not.toContain("from '../../services/creation-contract-service.js'");
    expect(storyGenerationSource).not.toContain("from '../../services/genre-story-profiles.js'");
    expect(storyGenerationSource).not.toContain("from '../../services/model-catalog.js'");
    expect(storyGenerationSource).not.toContain('entry.type === \'历史人物\'');
    expect(storyGenerationSource).not.toContain('buildProductionMaterialReadinessReport({');
    expect(preparationSource).toContain('resolveChinaCultureStorySource(request)');
    expect(preparationSource).toContain("entry.type === '历史人物'");
    expect(preparationSource).toContain('buildStoryBlueprint({');
  });
});
