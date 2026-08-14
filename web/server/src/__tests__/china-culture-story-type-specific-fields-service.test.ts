import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { EntryDetail, StoryGenerateResult } from '@shared/types.js';
import type { StoryAssembly } from '../platform/story-model-output-merge.js';
import {
  applyChinaCultureStoryAssemblyToStoryData,
  deriveChinaCultureTypeSpecificStoryFields,
} from '../domains/china-culture/story-type-specific-fields-service.js';

const entry: EntryDetail = {
  name: '云锦——经纬成章',
  province: '江苏',
  region: '南京',
  type: '传统技艺',
  summary: '云锦技艺概要',
  story: '匠人说：“寸锦寸金。”\n\n织造工艺先设计纹样，再逐步挑花结本。',
  culturalSignificance: '传统织造连接当代设计与城市文化。',
  relatedLocations: [{ name: '江宁织造府', description: '相关遗址' }],
  keywords: ['云锦', '织造', '云海'],
  sources: ['测试来源'],
  credibility: '待核验',
  unverifiedPoints: ['需实地考察遗迹保存状态'],
};

const story: StoryAssembly = {
  title: '经纬成章',
  logline: '一根丝线连接古今。',
  theme: '传承',
  full_text: '故事正文',
  scene_breakdown: [{
    scene_id: 1,
    title: '挑花结本',
    duration_sec: 30,
    location: '织造坊',
    time_of_day: '清晨',
    dramatic_function: '高潮',
    plot: '匠人完成关键工序。',
    key_action: '丝线穿梭',
    characters: ['匠人'],
    dialogue_or_narration: '经纬之间见功夫。',
    visual_prompt: '丝线与木机特写',
    camera_suggestion: '微距推进',
    cultural_note: '工序细节待传承人复核',
  }],
  gears_segments: [],
  cultural_constraints: ['工序细节待复核'],
  credibility_note: '待核验',
  characters: [],
  act_structure: [],
  protagonist_arc: [],
};

describe('china_culture type-specific story fields', () => {
  it('derives promo symbols, process, modern connection, message and source quote', () => {
    expect(deriveChinaCultureTypeSpecificStoryFields({
      videoType: 'heritage_promo',
      storyResult: story,
      entry,
    })).toMatchObject({
      visual_symbols: ['江宁织造府', '云锦', '织造', '云海'],
      craft_or_ritual_process: expect.stringContaining('织造工艺'),
      modern_connection: '传统织造连接当代设计与城市文化。',
      core_message: '一根丝线连接古今。',
      slogan_or_key_sentence: '传统技艺之光——云锦',
    });
  });

  it('derives scene, comic, explainer and documentary fields without changing story structure', () => {
    expect(deriveChinaCultureTypeSpecificStoryFields({
      videoType: 'landscape_mood', storyResult: story, entry,
    })).toMatchObject({
      spatial_identity: '南京·江宁织造府',
      visual_route: ['挑花结本：丝线与木机特写'],
      atmosphere: '云锦、云海',
    });
    expect(deriveChinaCultureTypeSpecificStoryFields({
      videoType: 'ai_comic_drama', storyResult: story, entry,
    }).dialogue?.[0]?.lines[0]).toMatchObject({
      character: '匠人', text: '经纬之间见功夫。', emotion: '激烈',
    });
    expect(deriveChinaCultureTypeSpecificStoryFields({
      videoType: 'explainer_video', storyResult: story, entry,
    })).toMatchObject({
      argument_points: ['丝线穿梭'],
      knowledge_outline: ['1. 挑花结本：匠人完成关键工序。'],
    });
    expect(deriveChinaCultureTypeSpecificStoryFields({
      videoType: 'documentary_short', storyResult: story, entry,
    })).toMatchObject({
      source_quotes: [],
      field_notes: ['江宁织造府待实地核验清单', '需实地考察遗迹保存状态'],
    });
  });

  it('reapplies a repaired assembly and type fields while honoring disabled GEARS output', () => {
    const storyData = {} as StoryGenerateResult;
    applyChinaCultureStoryAssemblyToStoryData({
      storyData,
      storyResult: story,
      entry,
      videoType: 'ai_comic_drama',
      outputGearsSegments: false,
    });

    expect(storyData).toMatchObject({
      title: '经纬成章',
      full_text: '故事正文',
      scene_breakdown: story.scene_breakdown,
      gears_segments: [],
      cultural_constraints: ['工序细节待复核'],
    });
    expect(storyData.dialogue?.[0]?.lines[0]?.character).toBe('匠人');
  });

  it('keeps the story orchestrator free of culture-specific field derivation rules', async () => {
    const source = await readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf8');

    expect(source).toContain("from './story-type-specific-fields-service.js'");
    expect(source).not.toContain('function extractProcessFromStory');
    expect(source).not.toContain('function deriveTypeSpecificStoryFields');
    expect(source).not.toContain('function applyStoryAssemblyToStoryData');
    expect(source).not.toContain("'制作', '制造', '工序'");
  });
});
