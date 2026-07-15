import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { MaterialPack } from '@shared/types.js';
import { resolveChinaCultureStorySource } from '../domains/china-culture/story-source-service.js';

function materialPack(overrides: Partial<MaterialPack> = {}): MaterialPack {
  return {
    schema_version: 'material-pack/v1',
    primary_materials: [{
      material_id: 'material-1',
      title: '授权小说第一章',
      summary: '少年在山门前发现一封改变命运的旧信。',
      source_type: 'user_source_text',
      purpose: ['source_work'],
      tags: ['少年', '旧信'],
    }],
    supporting_materials: [],
    reference_materials: [],
    visual_assets: [],
    verified_facts: [],
    uncertain_claims: ['旧信年代未确认'],
    creative_space: [],
    missing_needs: [],
    overall_confidence: 0.6,
    ...overrides,
  };
}

describe('china_culture story source service', () => {
  it('builds the original-user-material EntryDetail without changing truth boundaries', async () => {
    const result = await resolveChinaCultureStorySource({
      outline: '少女在古桥边找到一枚旧印章。她决定追查它的来历。',
      creation_use_case: 'original_ai_comic',
      truth_mode: 'fictional_original',
    });

    expect(result).toMatchObject({
      ok: true,
      entry: {
        province: '用户素材',
        region: '用户素材',
        type: '用户原创',
        credibility: '用户提供',
        sources: ['用户提供素材'],
        unverifiedPoints: [],
      },
    });
    if (result.ok) {
      expect(result.primaryEntryName).toBe(result.entry.name);
      expect(result.entry.verificationMethod).toContain('不把故事设定写成历史事实');
    }
  });

  it('builds a material-pack EntryDetail with text keywords, uncertainty and confidence semantics intact', async () => {
    const result = await resolveChinaCultureStorySource({ material_pack: materialPack() });

    expect(result).toMatchObject({
      ok: true,
      primaryEntryName: '授权小说第一章——项目素材',
      entry: {
        type: '项目素材',
        story: '少年在山门前发现一封改变命运的旧信。',
        credibility: '待核实',
        unverifiedPoints: ['旧信年代未确认'],
        keywords: expect.arrayContaining(['少年']),
      },
    });
  });

  it('preserves the distinct missing-primary and missing-explicit-entry errors', async () => {
    const missingPrimary = await resolveChinaCultureStorySource({
      knowledge_pack: {
        primary_entries: [{
          entry_name: '绝不存在的主条目',
          province: '测试',
          region: '测试',
          type: '测试',
          summary: '测试',
          score: 1,
          role_in_story: 'primary_entry',
          match_reason: '测试',
          keywords: [],
        }],
        supporting_entries: [],
        missing_needs: [],
        overall_confidence: 1,
      },
    });
    const missingExplicit = await resolveChinaCultureStorySource({ entry_name: '绝不存在的显式条目' });

    expect(missingPrimary).toEqual({
      ok: false,
      code: 'ENTRY_NOT_FOUND',
      message: 'Primary entry "绝不存在的主条目" not found',
    });
    expect(missingExplicit).toEqual({
      ok: false,
      code: 'ENTRY_NOT_FOUND',
      message: 'Entry "绝不存在的显式条目" not found',
    });
  });

  it('fails closed with the existing validation error when no source mode is usable', async () => {
    await expect(resolveChinaCultureStorySource({})).resolves.toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Either entry_name, knowledge_pack with primary_entries, material_pack, or user material outline must be provided',
    });
  });

  it('keeps knowledge-source reading and EntryDetail synthesis out of the story orchestrator', async () => {
    const [storySource, preparationSource, sourceService] = await Promise.all([
      readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/story-generation-preparation-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/story-source-service.ts', import.meta.url), 'utf-8'),
    ]);

    expect(storySource).toContain("from './story-generation-preparation-service.js'");
    expect(storySource).not.toContain("from './story-source-service.js'");
    expect(storySource).not.toContain('getChinaCultureFullEntryDetail');
    expect(storySource).not.toContain('convertChinaCultureFullEntryDetail');
    expect(storySource).not.toContain('function buildUserMaterialEntry');
    expect(storySource).not.toContain('function buildMaterialPackEntry');
    expect(preparationSource).toContain("from './story-source-service.js'");
    expect(preparationSource).toContain('resolveChinaCultureStorySource(request)');
    expect(sourceService).toContain("from './knowledge-source-adapter.js'");
    expect(sourceService).toContain('function buildChinaCultureUserMaterialEntry');
    expect(sourceService).toContain('function buildChinaCultureMaterialPackEntry');
  });
});
