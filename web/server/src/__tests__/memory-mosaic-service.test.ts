// web/server/src/__tests__/memory-mosaic-service.test.ts — Memory Mosaic service tests
// Tests: seed building, content generation, quality validation

import { describe, it, expect } from 'vitest';
import {
  buildMemoryMosaicSeed,
  generateMemoryMosaicContent,
  validateMemoryMosaicStory,
  recommendStoryStructures,
} from '../services/memory-mosaic-service.js';
import { validateReferenceSafety, combineQualityReports } from '../services/reference-quality-service.js';
import type { EntryDetail, MemoryMosaicStorySeed, WitnessMemory } from '@shared/types.js';

// ---------------------------------------------------------------------------
// Test fixtures — synthetic entry data
// ---------------------------------------------------------------------------

const ZHOUDUNYI_ENTRY: EntryDetail = {
  name: '周敦颐——理学开山鼻祖',
  province: '湖南',
  region: '湖南→永州→道县',
  type: '历史人物',
  summary: '北宋理学开山，提出太极图说，著有《爱莲说》',
  story: `**南安拒签冤案**——周敦颐任南安军司理参军时，发现囚犯依法不该死但上官坚持判死。他翻阅案卷发现疑点，与上官争辩，拒绝签字。上官威胁：你签还是不签？周敦颐说：吾不为也。宁可丢官获罪，也要守住良知。**最终囚犯免死，周敦颐虽丢官但守住公正**。

**爱莲说**——周敦颐晚年在莲花峰下写下千古名篇《爱莲说》。"出淤泥而不染，濯清涟而不妖"——这不仅是写莲花，更是写他自己的人生选择。

**知军王逵**——王逵是周敦颐的上官，坚持判囚犯死刑。周敦颐查案卷发现疑点，与王逵争辩。王逵说：你不过是个小官，签字就行了。周敦颐拒绝：人命关天，吾不为也。

**同年好友**——周敦颐有几位同窗挚友，他们见证了他的选择和代价。有人敬佩，有人觉得他太固执，有人说他不该为囚犯丢官。`,
  culturalSignificance: '周敦颐的拒签冤案照见了公正与良知的精神——不畏权势、坚守正道。他的《爱莲说》则是这种精神的文学凝练：出淤泥而不染。',
  relatedLocations: [{ name: '道县', description: '周敦颐故里' }, { name: '南安军', description: '拒签冤案之地' }, { name: '莲花峰', description: '写爱莲说之地' }],
  keywords: ['理学', '拒签冤案', '爱莲说', '公正', '良知', '太极图说', '廉洁'],
  sources: ['[S2]《史记》', '地方志'],
  credibility: '基本可靠',
  verificationMethod: 'A级《宋史》+B级地方志交叉佐证',
  unverifiedPoints: ['与上官争辩的具体对话内容待核实', '囚犯最终命运史料不详'],
};

// ---------------------------------------------------------------------------
// Tests: buildMemoryMosaicSeed
// ---------------------------------------------------------------------------

describe('buildMemoryMosaicSeed', () => {
  it('builds seed from a 历史人物 entry', () => {
    const seed = buildMemoryMosaicSeed(ZHOUDUNYI_ENTRY, '南安拒签冤案');

    expect(seed.subject).toBe('周敦颐');
    expect(seed.present_day_seeker).toBeTruthy();
    expect(seed.seeker_goal).toBeTruthy();
    expect(seed.trigger_object).toBeTruthy();
    expect(seed.central_question).toBeTruthy();
    expect(seed.witnesses.length).toBeGreaterThanOrEqual(3);
    expect(seed.final_reveal).toBeTruthy();
    expect(seed.ending_image).toBeTruthy();
  });

  it('has at least 4 witnesses for 历史人物', () => {
    const seed = buildMemoryMosaicSeed(ZHOUDUNYI_ENTRY, '南安拒签冤案');
    expect(seed.witnesses.length).toBeGreaterThanOrEqual(3);
  });

  it('at least one witness has complex emotion (not pure admiration)', () => {
    const seed = buildMemoryMosaicSeed(ZHOUDUNYI_ENTRY, '南安拒签冤案');
    const complexEmotions = seed.witnesses.filter(w =>
      w.emotional_bias === 'conflict' || w.emotional_bias === 'misunderstanding' || w.emotional_bias === 'regret'
    );
    expect(complexEmotions.length).toBeGreaterThanOrEqual(1);
  });

  it('trigger_object exists and is meaningful', () => {
    const seed = buildMemoryMosaicSeed(ZHOUDUNYI_ENTRY, '南安拒签冤案');
    expect(seed.trigger_object).toBeTruthy();
    expect(seed.trigger_object.length).toBeGreaterThan(5);
  });

  it('central_question is a real question about the protagonist', () => {
    const seed = buildMemoryMosaicSeed(ZHOUDUNYI_ENTRY, '南安拒签冤案');
    expect(seed.central_question).toBeTruthy();
    expect(seed.central_question).toContain('周敦颐');
  });

  it('ending_image echoes the trigger_object', () => {
    const seed = buildMemoryMosaicSeed(ZHOUDUNYI_ENTRY, '南安拒签冤案');
    expect(seed.ending_image).toContain(seed.trigger_object.substring(0, 4));
  });

  it('each witness has subject_choice', () => {
    const seed = buildMemoryMosaicSeed(ZHOUDUNYI_ENTRY, '南安拒签冤案');
    for (const w of seed.witnesses) {
      expect(w.subject_choice).toBeTruthy();
      expect(w.subject_choice.length).toBeGreaterThan(5);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: generateMemoryMosaicContent
// ---------------------------------------------------------------------------

describe('generateMemoryMosaicContent', () => {
  it('generates full_text, scene_breakdown, and gears_segments', () => {
    const seed = buildMemoryMosaicSeed(ZHOUDUNYI_ENTRY, '南安拒签冤案');
    const result = generateMemoryMosaicContent({
      entry: ZHOUDUNYI_ENTRY,
      centralEvent: '南安拒签冤案',
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      targetDuration: '3分钟',
      tone: '',
      memorySeed: seed,
    });

    expect(result.title).toBeTruthy();
    expect(result.logline).toBeTruthy();
    expect(result.theme).toBeTruthy();
    expect(result.full_text).toBeTruthy();
    expect(result.full_text.length).toBeGreaterThan(200);
    expect(result.scene_breakdown.length).toBeGreaterThanOrEqual(6);
    expect(result.gears_segments.length).toBe(result.scene_breakdown.length);
    expect(result.cultural_constraints.length).toBeGreaterThan(0);
    expect(result.credibility_note).toBeTruthy();
    expect(result.characters.length).toBeGreaterThan(0);
    expect(result.act_structure.length).toBeGreaterThan(0);
  });

  it('3-min version has 6 scenes (MOSAIC_3MIN)', () => {
    const seed = buildMemoryMosaicSeed(ZHOUDUNYI_ENTRY, '南安拒签冤案');
    const result = generateMemoryMosaicContent({
      entry: ZHOUDUNYI_ENTRY,
      centralEvent: '南安拒签冤案',
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      targetDuration: '3分钟',
      tone: '',
      memorySeed: seed,
    });
    expect(result.scene_breakdown.length).toBe(6);
  });

  it('5-min version has 9 scenes (MOSAIC_5MIN)', () => {
    const seed = buildMemoryMosaicSeed(ZHOUDUNYI_ENTRY, '南安拒签冤案');
    const result = generateMemoryMosaicContent({
      entry: ZHOUDUNYI_ENTRY,
      centralEvent: '南安拒签冤案',
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      targetDuration: '5分钟',
      tone: '',
      memorySeed: seed,
    });
    expect(result.scene_breakdown.length).toBe(9);
  });

  it('full_text does not contain biography-style phrases', () => {
    const seed = buildMemoryMosaicSeed(ZHOUDUNYI_ENTRY, '南安拒签冤案');
    const result = generateMemoryMosaicContent({
      entry: ZHOUDUNYI_ENTRY,
      centralEvent: '南安拒签冤案',
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      targetDuration: '3分钟',
      tone: '',
      memorySeed: seed,
    });

    const forbiddenPhrases = ['他的一生', '生平事迹', '年谱式', '一生充满传奇', '传奇人生'];
    for (const phrase of forbiddenPhrases) {
      expect(result.full_text).not.toContain(phrase);
    }
  });

  it('gears_segments contain segment_prompt_hint with story_structure info', () => {
    const seed = buildMemoryMosaicSeed(ZHOUDUNYI_ENTRY, '南安拒签冤案');
    const result = generateMemoryMosaicContent({
      entry: ZHOUDUNYI_ENTRY,
      centralEvent: '南安拒签冤案',
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      targetDuration: '3分钟',
      tone: '',
      memorySeed: seed,
    });

    for (const seg of result.gears_segments) {
      expect(seg.segment_prompt_hint).toBeTruthy();
      // Should mention memory_mosaic structure or 现实线/回忆线
      expect(seg.segment_prompt_hint).toContain('回忆拼图');
    }
  });

  it('scene_breakdown has both reality-line and memory-line scenes', () => {
    const seed = buildMemoryMosaicSeed(ZHOUDUNYI_ENTRY, '南安拒签冤案');
    const result = generateMemoryMosaicContent({
      entry: ZHOUDUNYI_ENTRY,
      centralEvent: '南安拒签冤案',
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      targetDuration: '3分钟',
      tone: '',
      memorySeed: seed,
    });

    // Check that there are scenes with the追寻者 (reality line) and scenes without (memory line)
    const realityLineScenes = result.scene_breakdown.filter(s =>
      s.dramatic_function === '现实钩子' || s.dramatic_function === '结尾画面'
    );
    const memoryLineScenes = result.scene_breakdown.filter(s =>
      s.dramatic_function === '见证人回忆'
    );

    expect(realityLineScenes.length).toBeGreaterThanOrEqual(2);
    expect(memoryLineScenes.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Tests: validateMemoryMosaicStory
// ---------------------------------------------------------------------------

describe('validateMemoryMosaicStory', () => {
  it('passes for a well-structured memory mosaic story', () => {
    const seed = buildMemoryMosaicSeed(ZHOUDUNYI_ENTRY, '南安拒签冤案');
    const result = generateMemoryMosaicContent({
      entry: ZHOUDUNYI_ENTRY,
      centralEvent: '南安拒签冤案',
      videoType: 'character_story',
      presentationStyle: 'cinematic',
      targetDuration: '3分钟',
      tone: '',
      memorySeed: seed,
    });

    const quality = validateMemoryMosaicStory({
      full_text: result.full_text,
      scene_breakdown: result.scene_breakdown,
      memory_seed: seed,
    });

    expect(quality.passed).toBe(true);
    expect(quality.issues.length).toBe(0);
  });

  it('fails when memory_seed is missing', () => {
    const quality = validateMemoryMosaicStory({
      full_text: '一些文本',
      scene_breakdown: [],
      memory_seed: undefined,
    });

    expect(quality.passed).toBe(false);
    expect(quality.issues.length).toBeGreaterThan(0);
    expect(quality.issues.some(i => i.includes('现实追寻者'))).toBe(true);
  });

  it('flags biography-style year listings', () => {
    const seed: MemoryMosaicStorySeed = {
      subject: '周敦颐',
      present_day_seeker: '年轻策展人',
      seeker_goal: '为什么周敦颐敢拒绝？',
      trigger_object: '一卷残缺案牍',
      central_question: '为什么周敦颐敢拒绝？',
      witnesses: [
        {
          witness_name: '知军王逵',
          relationship_to_subject: '上级官员',
          remembered_event: '南安拒签冤案',
          subject_choice: '周敦颐选择了坚守',
          emotional_bias: 'conflict',
          object_or_phrase: '案牍',
          scene_location: '南安军',
          scene_time: '当年',
          present_day_effect: '追寻者理解了周敦颐',
          factual_basis: '基于知识库',
          fictionalized_elements: [],
        },
        {
          witness_name: '同窗',
          relationship_to_subject: '挚友',
          remembered_event: '爱莲说',
          subject_choice: '周敦颐坚守清廉',
          emotional_bias: 'admiration',
          object_or_phrase: '莲',
          scene_location: '莲花峰',
          scene_time: '晚年',
          present_day_effect: '追寻者理解',
          factual_basis: '基于知识库',
          fictionalized_elements: [],
        },
        {
          witness_name: '误解者',
          relationship_to_subject: '旁观者',
          remembered_event: '丢官',
          subject_choice: '周敦颐宁可丢官',
          emotional_bias: 'misunderstanding',
          object_or_phrase: '官印',
          scene_location: '南安军',
          scene_time: '当年',
          present_day_effect: '追寻者理解了误解',
          factual_basis: '基于知识库',
          fictionalized_elements: [],
        },
      ],
      final_reveal: '周敦颐守护的是良知和公正',
      ending_image: '案牍回到当下，追寻者理解了它',
    };

    // Text with 3+ year listings
    const badText = '1017年，周敦颐出生。1046年，任南安军司理参军。1072年，去世。他的一生充满传奇色彩。';

    const quality = validateMemoryMosaicStory({
      full_text: badText,
      scene_breakdown: [],
      memory_seed: seed,
    });

    expect(quality.passed).toBe(false);
    expect(quality.issues.some(i => i.includes('年表式传记'))).toBe(true);
    expect(quality.issues.some(i => i.includes('传记腔'))).toBe(true);
  });

  it('flags when all witnesses are pure admiration (no complex emotion)', () => {
    const allAdmirationSeed: MemoryMosaicStorySeed = {
      subject: '周敦颐',
      present_day_seeker: '年轻策展人',
      seeker_goal: '为什么周敦颐敢拒绝？',
      trigger_object: '一卷残缺案牍',
      central_question: '为什么周敦颐敢拒绝？',
      witnesses: [
        {
          witness_name: '同窗A',
          relationship_to_subject: '挚友',
          remembered_event: '南安拒签',
          subject_choice: '周敦颐选择了坚守',
          emotional_bias: 'admiration',
          object_or_phrase: '案牍',
          scene_location: '南安军',
          scene_time: '当年',
          present_day_effect: '敬佩',
          factual_basis: '基于知识库',
          fictionalized_elements: [],
        },
        {
          witness_name: '同窗B',
          relationship_to_subject: '挚友',
          remembered_event: '爱莲说',
          subject_choice: '周敦颐坚守清廉',
          emotional_bias: 'admiration',
          object_or_phrase: '莲',
          scene_location: '莲花峰',
          scene_time: '晚年',
          present_day_effect: '敬佩',
          factual_basis: '基于知识库',
          fictionalized_elements: [],
        },
        {
          witness_name: '同窗C',
          relationship_to_subject: '挚友',
          remembered_event: '丢官',
          subject_choice: '周敦颐宁可丢官',
          emotional_bias: 'admiration',
          object_or_phrase: '官印',
          scene_location: '南安军',
          scene_time: '当年',
          present_day_effect: '敬佩',
          factual_basis: '基于知识库',
          fictionalized_elements: [],
        },
      ],
      final_reveal: '周敦颐守护的是良知',
      ending_image: '案牍回到当下',
    };

    const quality = validateMemoryMosaicStory({
      full_text: '一些不含传记腔的文本',
      scene_breakdown: [
        { scene_id: 1, title: '现实钩子', duration_sec: 30, location: '道县', time_of_day: '白天', dramatic_function: '现实钩子', plot: '发现案牍', key_action: '追问', characters: ['策展人'], visual_prompt: '道县', camera_suggestion: '实景', cultural_note: '' },
        { scene_id: 2, title: '结尾', duration_sec: 30, location: '道县', time_of_day: '黄昏', dramatic_function: '结尾画面', plot: '案牍回到当下，追寻者理解了它承载的意义', key_action: '理解完成', characters: ['策展人'], visual_prompt: '道县', camera_suggestion: '远景', cultural_note: '' },
      ],
      memory_seed: allAdmirationSeed,
    });

    expect(quality.passed).toBe(false);
    expect(quality.issues.some(i => i.includes('正面') || i.includes('复杂'))).toBe(true);
  });

  it('flags when ending does not echo trigger object', () => {
    const seed: MemoryMosaicStorySeed = {
      subject: '周敦颐',
      present_day_seeker: '年轻策展人',
      seeker_goal: '为什么周敦颐敢拒绝？',
      trigger_object: '一卷残缺案牍',
      central_question: '为什么周敦颐敢拒绝？',
      witnesses: [
        {
          witness_name: '知军王逵',
          relationship_to_subject: '上级',
          remembered_event: '南安拒签',
          subject_choice: '周敦颐选择了坚守',
          emotional_bias: 'conflict',
          object_or_phrase: '案牍',
          scene_location: '南安军',
          scene_time: '当年',
          present_day_effect: '理解',
          factual_basis: '基于知识库',
          fictionalized_elements: [],
        },
      ],
      final_reveal: '周敦颐守护的是良知',
      ending_image: '完全不同的结尾画面',
    };

    const quality = validateMemoryMosaicStory({
      full_text: '文本',
      scene_breakdown: [
        { scene_id: 1, title: '结尾', duration_sec: 30, location: '道县', time_of_day: '黄昏', dramatic_function: '结尾画面', plot: '完全不同的结尾', key_action: '结尾', characters: ['策展人'], visual_prompt: '道县', camera_suggestion: '远景', cultural_note: '' },
      ],
      memory_seed: seed,
    });

    expect(quality.issues.some(i => i.includes('触发物件') || i.includes('物件'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: validateReferenceSafety
// ---------------------------------------------------------------------------

describe('validateReferenceSafety', () => {
  it('passes for clean generated text with no references', () => {
    const report = validateReferenceSafety({
      generated_text: '这是一个原创故事，没有复制任何参考样本。',
    });
    expect(report.safe).toBe(true);
    expect(report.issues.length).toBe(0);
  });

  it('flags unknown-rights references used with strong strength', () => {
    const report = validateReferenceSafety({
      generated_text: '一些文本',
      reference_rights: ['unknown', 'public_domain'],
      reference_strength: 'strong',
    });
    expect(report.safe).toBe(false);
    expect(report.issues.some(i => i.includes('unknown'))).toBe(true);
  });

  it('flags "改编自" claims without authorization', () => {
    const report = validateReferenceSafety({
      generated_text: '本故事改编自某某著名小说。',
      claimed_authorization: false,
    });
    expect(report.safe).toBe(false);
    expect(report.issues.some(i => i.includes('改编自'))).toBe(true);
  });

  it('passes "改编自" with claimed authorization', () => {
    const report = validateReferenceSafety({
      generated_text: '本故事改编自某某著名小说。',
      claimed_authorization: true,
    });
    expect(report.safe).toBe(true);
  });

  it('flags long-sentence copying from reference samples', () => {
    const report = validateReferenceSafety({
      generated_text: '周敦颐翻阅案卷发现疑点，与上官争辩，拒绝签字。上官威胁：你签还是不签？',
      reference_original_sentences: ['周敦颐翻阅案卷发现疑点，与上官争辩，拒绝签字。上官威胁：你签还是不签？'],
    });
    expect(report.safe).toBe(false);
    expect(report.issues.some(i => i.includes('复刻') || i.includes('原句'))).toBe(true);
  });

  it('does not flag short common phrases', () => {
    const report = validateReferenceSafety({
      generated_text: '周敦颐做出了一个重要的选择。',
      reference_original_sentences: ['做出了一个重要的选择'], // 10 chars, below 15 threshold
    });
    expect(report.safe).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: combineQualityReports
// ---------------------------------------------------------------------------

describe('combineQualityReports', () => {
  it('combines dramatic + reference issues', () => {
    const dramaticQuality = {
      hasCentralEvent: true,
      hasConflict: true,
      hasProtagonistChoice: true,
      hasSceneAction: true,
      hasClimax: true,
      hasEndingTheme: true,
      isNotBiographySummary: true,
      passed: true,
      issues: ['dramatic issue 1'],
    };

    const refSafety = {
      safe: false,
      issues: ['参考安全：unknown rights with strong'],
      warnings: ['疑似近似复刻'],
      blocked_references: [],
    };

    const combined = combineQualityReports(dramaticQuality, refSafety);

    expect(combined.passed).toBe(false);
    expect(combined.issues.length).toBe(3); // dramatic + safety + warning
  });

  it('passes when both dramatic and reference pass', () => {
    const dramaticQuality = {
      hasCentralEvent: true,
      hasConflict: true,
      hasProtagonistChoice: true,
      hasSceneAction: true,
      hasClimax: true,
      hasEndingTheme: true,
      isNotBiographySummary: true,
      passed: true,
      issues: [],
    };

    const refSafety = {
      safe: true,
      issues: [],
      warnings: [],
      blocked_references: [],
    };

    const combined = combineQualityReports(dramaticQuality, refSafety);
    expect(combined.passed).toBe(true);
    expect(combined.issues.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: recommendStoryStructures
// ---------------------------------------------------------------------------

describe('recommendStoryStructures', () => {
  it('recommends memory_mosaic_biography for 历史人物 + character_story', () => {
    const recs = recommendStoryStructures('历史人物', 'character_story');
    const mosaic = recs.find(r => r.story_structure === 'memory_mosaic_biography');
    expect(mosaic).toBeDefined();
  });

  it('does not recommend memory_mosaic_biography for incompatible video types', () => {
    const recs = recommendStoryStructures('历史人物', 'culture_promo');
    const mosaic = recs.find(r => r.story_structure === 'memory_mosaic_biography');
    // culture_promo is not compatible with memory_mosaic_biography
    expect(mosaic).toBeUndefined();
  });

  it('recommends object_clue_journey for 名胜古迹', () => {
    const recs = recommendStoryStructures('名胜古迹', 'scene_short');
    const object = recs.find(r => r.story_structure === 'object_clue_journey');
    expect(object).toBeDefined();
  });

  it('falls back to single_event_drama when no compatible structures', () => {
    const recs = recommendStoryStructures('饮食文化', 'lecture_video');
    // lecture_video only compatible with lecture_argument structure for 饮食文化
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].story_structure).toBeDefined();
  });
});