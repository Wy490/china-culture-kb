import { describe, expect, it } from 'vitest';
import type { StoryGenerateResult } from '@shared/types.js';
import { buildSeedancePromptPackage } from '../services/seedance-prompt-service.js';

const DELIVERY_PROMPT_INTERNAL_PATTERN =
  /(质量信号|质量报告|来源说明|内部字段名|来源条目|来源显示|史实依据|影视化创作|史实边界|知识库|用户大纲|生成优先级|资料显示|具体细节请核实来源|确证史实|确证史源|分析|应该|注意|TODO|待补)/;

function makeStory(): StoryGenerateResult {
  return {
    storyId: '20260615-story-seedance',
    title: '书院雨夜',
    generation_type: 'character_story',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    source_entry: '测试条目',
    logline: '少年在雨夜进入书院，必须查清旧案。',
    theme: '选择与代价',
    full_text: '少年被师兄拦在书院门外，必须在天亮前找到旧案证据。',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '雨夜入局',
        duration_sec: 24,
        location: '书院门外',
        time_of_day: '夜晚',
        dramatic_function: '钩子开场',
        plot: '少年抱着书箱站在雨里，师兄挡住门，宣布天亮前找不到旧案证据就失去入门资格。',
        key_action: '少年抓紧书箱，抬头追问规则。',
        characters: ['少年', '师兄'],
        visual_prompt: '质量信号：书院门外，雨水，灯笼，少年与师兄对峙',
        camera_suggestion: '运镜参考：参考视频素材的横移节奏，建立镜头后慢推到少年近景',
        cultural_note: '本场景基于测试条目，具体细节请核实来源；生成优先级：剧情推进与资料完整保持均衡。',
        factual_basis: '史实依据：测试条目中的书院旧案。',
        fictionalized_elements: ['影视化创作：雨夜拦门动作'],
        conflict: '入门资格与旧案任务冲突',
        dialogue_or_narration: '师兄：天亮前，拿证据来。音乐参考：雨声下压，低鼓点推进紧张感。',
        source_entries: ['测试条目'],
      },
    ],
    gears_segments: [],
    gears_segments_url: '/api/stories/20260615-story-seedance/gears-segments',
    cultural_constraints: [],
    credibility_note: '测试',
    characters: [
      { name: '少年', role: 'protagonist', description: '背书箱的求学少年' },
      { name: '师兄', role: 'supporting', description: '守门的书院师兄' },
    ],
  };
}

describe('seedance-prompt-service', () => {
  it('builds shot-level Seedance prompts from story and GEARS delivery data', () => {
    const pkg = buildSeedancePromptPackage(makeStory());

    expect(pkg.schema_version).toBe('seedance-prompt-package/v1');
    expect(pkg.sourceDomain).toBe('china_culture');
    expect(pkg.target_platform).toBe('seedance_2_0');
    expect(pkg.shot_units.length).toBeGreaterThan(0);
    expect(pkg.asset_reference_plan.some(item => item.includes('@图片1'))).toBe(true);
    expect(pkg.asset_reference_plan.some(item => item.includes('@视频1') && item.includes('运镜和节奏'))).toBe(true);
    expect(pkg.asset_reference_plan.some(item => item.includes('@音频1') && item.includes('背景音乐或音效'))).toBe(true);
    expect(pkg.asset_references.some(item => item.kind === 'character' && item.reference_slot === '@图片1')).toBe(true);
    expect(pkg.asset_references.some(item => item.kind === 'camera' && item.modality === 'video' && item.reference_slot === '@视频1')).toBe(true);
    expect(pkg.asset_references.some(item => item.kind === 'audio' && item.modality === 'audio' && item.reference_slot === '@音频1')).toBe(true);
    expect(pkg.material_validation.image_count).toBeGreaterThan(0);
    expect(pkg.material_validation.video_count).toBe(1);
    expect(pkg.material_validation.audio_count).toBe(1);
    expect(pkg.material_validation.image_count).toBeLessThanOrEqual(pkg.material_validation.max_image_files);
    expect(pkg.markdown).toContain('Seedance 2.0 镜头提示词包');
    expect(pkg.markdown).toContain('> sourceDomain: china_culture');
    expect(pkg.markdown).toContain('素材 slot');

    for (const unit of pkg.shot_units) {
      expect(unit.duration_sec).toBeGreaterThanOrEqual(4);
      expect(unit.duration_sec).toBeLessThanOrEqual(15);
      expect(unit.asset_slots.length).toBeGreaterThan(0);
      expect(unit.material_validation.total_file_count).toBe(unit.asset_slots.length);
      expect(unit.material_validation.prompt_complexity_score).toBeGreaterThan(0);
      expect(unit.seedance_prompt).toContain('0-3秒');
      expect(unit.seedance_prompt).toContain('@图片');
      expect(unit.seedance_prompt).toContain('@视频1 作为运镜和节奏参考');
      expect(unit.seedance_prompt).toContain('@音频1 作为音乐或音效参考');
      expect(unit.seedance_prompt).toContain('风格：');
      expect(unit.seedance_prompt).toContain('连续性：');
      expect(unit.seedance_prompt).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
      expect(unit.continuity_notes.join('\n')).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
      expect(unit.negative_constraints.join('\n')).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
    }
    expect(pkg.markdown).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
  });

  it('prioritizes per-scene location slots within the Seedance image budget', () => {
    const story: StoryGenerateResult = {
      ...makeStory(),
      storyId: '20260625-story-location-budget',
      title: '橘洲问莲',
      full_text: '少年从道州出发，途经橘子洲，在泥水与莲叶之间确认自己的选择。',
      characters: [
        { name: '周敦颐', role: 'protagonist', description: '北宋少年读书人，随身书卷与布履' },
        { name: '垂钓老者', role: 'mentor', description: '灰衣老者，竹竿与鱼篓' },
        { name: '船夫', role: 'supporting', description: '撑篙催船的渡口船夫' },
        { name: '家人', role: 'supporting', description: '清晨送别少年的人' },
        { name: '渡口孩童', role: 'supporting', description: '雨中抱书篮的孩童' },
      ],
      scene_breakdown: [
        {
          scene_id: 1,
          title: '道州启程',
          duration_sec: 12,
          location: '道州濂溪畔',
          time_of_day: '清晨',
          dramatic_function: '钩子开场',
          plot: '清晨水雾压在濂溪上，少年周敦颐背起书卷准备远行。',
          key_action: '周敦颐系紧书袋，在溪边回望家门后踏上远行路。',
          characters: ['周敦颐', '家人'],
          visual_prompt: '北宋道州溪畔清晨，竹影，浅水，少年读书人，书袋，布履，远处村舍',
          camera_suggestion: '低机位跟拍布履踏过湿石，随后推向少年背影',
          cultural_note: '人物名称、地点名称和核心文化物件前后一致。',
          factual_basis: '周敦颐道州籍贯与少年读书形象。',
          fictionalized_elements: ['清晨送别动作'],
        },
        {
          scene_id: 2,
          title: '橘洲初遇',
          duration_sec: 12,
          location: '长沙橘子洲头',
          time_of_day: '午后',
          dramatic_function: '主角处境',
          plot: '湘江水声里，垂钓老者问少年远行是为求官还是求学。',
          key_action: '周敦颐停步，与垂钓老者隔着鱼篓对坐。',
          characters: ['周敦颐', '垂钓老者'],
          visual_prompt: '长沙橘子洲头午后，湘江水面，沙洲芦苇，旧木渡船，灰衣老者，竹鱼篓',
          camera_suggestion: '横移建立洲头空间，再用正反打呈现对坐',
          cultural_note: '人物名称、地点名称和核心文化物件前后一致。',
          factual_basis: '长沙橘子洲空间与周敦颐后世文化叙事。',
          fictionalized_elements: ['垂钓老者问答'],
        },
        {
          scene_id: 3,
          title: '浊水问莲',
          duration_sec: 12,
          location: '橘子洲洲边浅水',
          time_of_day: '黄昏',
          dramatic_function: '冲突升级',
          plot: '泥沙翻起，莲叶贴着浊浪摇晃。',
          key_action: '周敦颐蹲下扶起莲叶，把沾泥的手掌摊在书页边。',
          characters: ['周敦颐', '垂钓老者'],
          visual_prompt: '黄昏湘江浅水，泥沙，莲叶，少年蹲身扶莲，老者持竹竿，金色逆光',
          camera_suggestion: '莲叶特写切到手掌泥水，再缓推少年表情',
          cultural_note: '人物名称、地点名称和核心文化物件前后一致。',
          factual_basis: '莲意象与周敦颐后世作品精神相关。',
          fictionalized_elements: ['洲边问莲动作'],
        },
        {
          scene_id: 4,
          title: '泥水选择',
          duration_sec: 12,
          location: '橘子洲渡口',
          time_of_day: '傍晚',
          dramatic_function: '关键行动',
          plot: '骤雨落下，孩童的书篮滑进泥水，船夫催客上船。',
          key_action: '周敦颐错过渡船，踩进泥水捞起书篮。',
          characters: ['周敦颐', '垂钓老者', '渡口孩童', '船夫'],
          visual_prompt: '傍晚雨中渡口，旧木船，泥水，散落书页，少年挽衣入水，孩童抱篮',
          camera_suggestion: '雨线中手持跟拍入水动作，特写泥水溅上布履',
          cultural_note: '人物名称、地点名称和核心文化物件前后一致。',
          factual_basis: '选择情节服务人物品格表达。',
          fictionalized_elements: ['渡口孩童书篮落水'],
        },
        {
          scene_id: 5,
          title: '湘江夜渡',
          duration_sec: 12,
          location: '湘江夜渡',
          time_of_day: '夜晚',
          dramatic_function: '高潮',
          plot: '夜色降下，下一班渡船缓缓离岸。',
          key_action: '周敦颐在船头写下自省之句，并向老者长揖告别。',
          characters: ['周敦颐', '垂钓老者', '船夫'],
          visual_prompt: '湘江夜渡，木船灯火，少年坐在船头写旅札，泥痕布履，远处莲叶剪影',
          camera_suggestion: '从旅札字迹推到船头远景，最后拉远到湘江夜色',
          cultural_note: '人物名称、地点名称和核心文化物件前后一致。',
          factual_basis: '后世廉洁形象与莲意象收束。',
          fictionalized_elements: ['船头旅札告别'],
        },
      ],
      gears_segments: [],
    };

    const pkg = buildSeedancePromptPackage(story);

    expect(pkg.material_validation.image_count).toBeLessThanOrEqual(pkg.material_validation.max_image_files);
    expect(pkg.validation_notes.join('\n')).not.toContain('缺少必需素材引用槽位');
    expect(pkg.validation_notes.join('\n')).not.toContain('提示复杂度');
    for (const unit of pkg.shot_units) {
      expect(unit.asset_slots.some(slot =>
        slot.kind === 'location' && (unit.location.includes(slot.label) || slot.label.includes(unit.location))
      )).toBe(true);
      expect(unit.material_validation.missing_required_slots).toEqual([]);
      expect(unit.material_validation.duration_risk).toBe('ok');
    }
    expect(pkg.shot_units.find(unit => unit.location === '湘江夜渡')?.asset_slots.some(slot =>
      slot.kind === 'location' && slot.label === '湘江夜渡'
    )).toBe(true);
    expect(pkg.markdown).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
  });
});
