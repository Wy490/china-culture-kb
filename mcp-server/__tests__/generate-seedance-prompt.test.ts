import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateSeedancePrompt } from '../src/tools/generate-seedance-prompt.js';

const tmpDir = path.join(os.tmpdir(), 'kb-seedance-prompt-test-' + Date.now());
const dataRoot = path.join(tmpDir, 'data');
const projectId = '20260617-story-seedance--ai_comic_drama';
const storyId = '20260617-story-seedance';
const DELIVERY_PROMPT_INTERNAL_PATTERN =
  /(质量信号|质量报告|来源说明|内部字段名|来源条目|来源显示|史实依据|影视化创作|史实边界|知识库|用户大纲|生成优先级|资料显示|具体细节请核实来源|确证史实|确证史源|分析|应该|注意|TODO|待补|本场景基于)/;

function baseStory() {
  return {
    storyId,
    project_id: projectId,
    title: '雨夜拒签',
    generation_type: 'character_story',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    source_entry: '测试条目',
    logline: '少年在雨夜守住一份文书。',
    theme: '良知与选择',
    full_text: '雨夜里，少年被迫在退让和坚持之间做选择。',
    characters: [
      { name: '少年', role: 'protagonist', description: '背着书箱的求学少年', arc: '从犹豫到坚持' },
      { name: '师兄', role: 'supporting', description: '守门的书院师兄' },
    ],
    scene_breakdown: [
      {
        scene_id: 1,
        title: '门外拦阻',
        duration_sec: 12,
        location: '书院门外',
        time_of_day: '夜晚',
        dramatic_function: '钩子开场',
        plot: '雨夜里，少年抱着书箱站在门外，师兄挡住门，要求他天亮前交出证据。',
        key_action: '少年握紧文书，抬头追问规则。',
        characters: ['少年', '师兄'],
        visual_prompt: '质量信号：书院门外，雨水，灯笼，人物对峙',
        camera_suggestion: '运镜参考：参考视频素材的横移节奏，建立镜头后慢推到少年近景',
        cultural_note: '本场景基于测试条目，具体细节请核实来源；生成优先级：剧情推进与资料完整保持均衡。',
        dialogue_or_narration: '师兄：天亮前，拿证据来。音乐参考：雨声下压，低鼓点推进紧张感。',
        factual_basis: '史实依据：测试事实边界。',
        fictionalized_elements: ['影视化创作：雨夜拦门动作'],
        source_entries: ['测试条目'],
      },
      {
        scene_id: 2,
        title: '厅内拒签',
        duration_sec: 14,
        location: '书院正厅',
        time_of_day: '夜晚',
        dramatic_function: '冲突爆发',
        plot: '众人围在案前催促少年签字，少年把文书推回去，指出疑点。',
        key_action: '少年拒绝草率签字。',
        characters: ['少年'],
        visual_prompt: '正厅，案几，文书，灯影压低',
        camera_suggestion: '中近景交替，最后切文书特写',
        cultural_note: '体现责任。',
        dialogue_or_narration: '少年：我不能签。',
      },
    ],
    gears_segments: [
      {
        segment_id: 1,
        source_scene_id: 1,
        duration_sec: 12,
        panel_count: 6,
        script_text: '少年在雨夜被拦住，必须天亮前交出证据。',
      },
      {
        segment_id: 2,
        source_scene_id: 2,
        duration_sec: 14,
        panel_count: 8,
        script_text: '众人催促签字，少年把文书推回去，说自己不能签。',
      },
    ],
  };
}

beforeEach(() => {
  process.env.KB_ROOT = dataRoot;
  fs.mkdirSync(path.join(dataRoot, 'provinces'), { recursive: true });

  const projectRoot = path.join(tmpDir, 'web', 'generated', 'projects', projectId);
  fs.mkdirSync(path.join(projectRoot, 'versions'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({
    project_id: projectId,
    current_story_id: storyId,
    title: '雨夜拒签',
    source_domain: 'second_domain',
    source_entry: '测试条目',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    status: 'draft',
    created_at: '2026-06-17T01:00:00.000Z',
    updated_at: '2026-06-17T01:00:00.000Z',
    current_version_id: `${projectId}-v1`,
    version_count: 1,
    scene_count: 2,
    has_gears_segments: true,
  }, null, 2));
  fs.writeFileSync(path.join(projectRoot, 'versions', `${projectId}-v1.json`), JSON.stringify({
    project_id: projectId,
    version_id: `${projectId}-v1`,
    created_at: '2026-06-17T01:00:00.000Z',
    change_type: 'initial_generation',
    scene_ids_changed: [],
    story: baseStory(),
  }, null, 2));

  const storyRoot = path.join(tmpDir, 'web', 'generated', 'stories', 'ai_comic_drama');
  fs.mkdirSync(storyRoot, { recursive: true });
  fs.writeFileSync(path.join(storyRoot, `${storyId}.json`), JSON.stringify(baseStory(), null, 2));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.KB_ROOT;
});

describe('kb_generate_seedance_prompt', () => {
  it('generates a read-only Seedance prompt package from project_id', async () => {
    const result = await generateSeedancePrompt({ project_id: projectId, include_markdown: false });

    expect(result).not.toBeNull();
    expect(result!.source).toBe('project_id');
    expect(result!.package.schema_version).toBe('seedance-prompt-package/v1');
    expect(result!.package.sourceDomain).toBe('second_domain');
    expect(result!.package.shot_units).toHaveLength(2);
    expect(result!.package.asset_references.some(item => item.reference_slot === '@图片1')).toBe(true);
    expect(result!.package.asset_references.some(item => item.reference_slot === '@视频1' && item.kind === 'camera')).toBe(true);
    expect(result!.package.asset_references.some(item => item.reference_slot === '@音频1' && item.kind === 'audio')).toBe(true);
    expect(result!.package.material_validation.video_count).toBe(1);
    expect(result!.package.material_validation.audio_count).toBe(1);
    expect(result!.package.shot_units[0].seedance_prompt).toContain('@视频1 作为运镜和节奏参考');
    expect(result!.package.shot_units[0].seedance_prompt).toContain('@音频1 作为音乐或音效参考');
    expect(result!.package.shot_units[0].visual_prompt).not.toContain('质量信号');
    expect(result!.package.shot_units[0].seedance_prompt).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
    expect(result!.package.shot_units[0].continuity_notes.join('\n')).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
    expect(result!.package.shot_units[0].negative_constraints.join('\n')).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
    expect(result!.package.asset_reference_plan.join('\n')).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
    expect(result!.package.markdown).toBeUndefined();
  });

  it('accepts direct story_json and includes markdown by default', async () => {
    const result = await generateSeedancePrompt({
      story_json: JSON.stringify({ ...baseStory(), sourceDomain: 'second_domain' }),
    });

    expect(result!.source).toBe('story_json');
    expect(result!.package.sourceDomain).toBe('second_domain');
    expect(result!.package.markdown).toContain('Seedance 2.0 镜头提示词包');
    expect(result!.package.markdown).toContain('> sourceDomain: second_domain');
    expect(result!.validation_summary.shot_count).toBe(2);
    expect(result!.package.shot_units[0].seedance_prompt).toContain('0-3秒');
    expect(result!.package.shot_units[0].seedance_prompt).toContain('音效/音乐：');
    expect(result!.package.markdown).not.toMatch(DELIVERY_PROMPT_INTERNAL_PATTERN);
  });

  it('can resolve a story by story_id', async () => {
    const result = await generateSeedancePrompt({ story_id: storyId, include_markdown: false });

    expect(result!.source).toBe('story_id');
    expect(result!.story_id).toBe(storyId);
    expect(result!.package.sourceDomain).toBe('china_culture');
    expect(result!.validation_summary.asset_reference_count).toBeGreaterThan(0);
  });

  it('keeps per-scene location slots when image references hit the Seedance budget', async () => {
    const story = {
      ...baseStory(),
      storyId: '20260625-story-location-budget',
      title: '橘洲问莲',
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
          plot: '清晨水雾压在濂溪上，少年周敦颐背起书卷准备远行。',
          key_action: '周敦颐系紧书袋，在溪边回望家门后踏上远行路。',
          characters: ['周敦颐', '家人'],
          visual_prompt: '北宋道州溪畔清晨，竹影，浅水，少年读书人，书袋，布履，远处村舍',
          camera_suggestion: '低机位跟拍布履踏过湿石，随后推向少年背影',
        },
        {
          scene_id: 2,
          title: '橘洲初遇',
          duration_sec: 12,
          location: '长沙橘子洲头',
          plot: '湘江水声里，垂钓老者问少年远行是为求官还是求学。',
          key_action: '周敦颐停步，与垂钓老者隔着鱼篓对坐。',
          characters: ['周敦颐', '垂钓老者'],
          visual_prompt: '长沙橘子洲头午后，湘江水面，沙洲芦苇，旧木渡船，灰衣老者，竹鱼篓',
          camera_suggestion: '横移建立洲头空间，再用正反打呈现对坐',
        },
        {
          scene_id: 3,
          title: '浊水问莲',
          duration_sec: 12,
          location: '橘子洲洲边浅水',
          plot: '泥沙翻起，莲叶贴着浊浪摇晃。',
          key_action: '周敦颐蹲下扶起莲叶，把沾泥的手掌摊在书页边。',
          characters: ['周敦颐', '垂钓老者'],
          visual_prompt: '黄昏湘江浅水，泥沙，莲叶，少年蹲身扶莲，老者持竹竿，金色逆光',
          camera_suggestion: '莲叶特写切到手掌泥水，再缓推少年表情',
        },
        {
          scene_id: 4,
          title: '泥水选择',
          duration_sec: 12,
          location: '橘子洲渡口',
          plot: '骤雨落下，孩童的书篮滑进泥水，船夫催客上船。',
          key_action: '周敦颐错过渡船，踩进泥水捞起书篮。',
          characters: ['周敦颐', '垂钓老者', '渡口孩童', '船夫'],
          visual_prompt: '傍晚雨中渡口，旧木船，泥水，散落书页，少年挽衣入水，孩童抱篮',
          camera_suggestion: '雨线中手持跟拍入水动作，特写泥水溅上布履',
        },
        {
          scene_id: 5,
          title: '湘江夜渡',
          duration_sec: 12,
          location: '湘江夜渡',
          plot: '夜色降下，下一班渡船缓缓离岸。',
          key_action: '周敦颐在船头写下自省之句，并向老者长揖告别。',
          characters: ['周敦颐', '垂钓老者', '船夫'],
          visual_prompt: '湘江夜渡，木船灯火，少年坐在船头写旅札，泥痕布履，远处莲叶剪影',
          camera_suggestion: '从旅札字迹推到船头远景，最后拉远到湘江夜色',
        },
      ],
      gears_segments: [],
    };

    const result = await generateSeedancePrompt({ story_json: JSON.stringify(story), include_markdown: false });
    const pkg = result!.package;

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
  });

  it('returns null for missing projects and rejects unsafe ids', async () => {
    await expect(generateSeedancePrompt({ project_id: '../bad' })).rejects.toThrow('非法项目 ID');
    await expect(generateSeedancePrompt({ project_id: 'missing-project' })).resolves.toBeNull();
  });
});
