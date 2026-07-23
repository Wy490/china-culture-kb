import { describe, expect, it } from 'vitest';
import { ProfessionalTextPackageSchema } from '@shared/schemas.js';
import {
  VIDEO_TYPE_CONFIG,
  type StoryGenerateResult,
  type StoryScene,
  type VideoType,
} from '@shared/types.js';
import { resolveProfessionalEvidenceForStory } from '../services/professional-evidence-resolver-service.js';
import { dispatchProfessionalTextPackageForStory } from '../services/professional-text-dispatch-service.js';

const videoTypes = Object.keys(VIDEO_TYPE_CONFIG) as VideoType[];

function scene(sceneId: number): StoryScene {
  return {
    scene_id: sceneId,
    title: `第${sceneId}场`,
    duration_sec: 12,
    location: `真实空间${sceneId}`,
    time_of_day: ['清晨', '上午', '午后', '黄昏', '夜晚'][sceneId - 1] ?? '日间',
    dramatic_function: `第${sceneId}场推进新的信息与选择`,
    plot: `人物在真实空间${sceneId}完成一项可见行动，获得新的证据或面对新的阻力，推动下一场。`,
    key_action: `人物拿起关键物件并完成第${sceneId}次可见选择`,
    characters: ['主人公', '见证者'],
    visual_prompt: `真实空间${sceneId}，人物、关键物件、环境光线和可见动作清楚。`,
    camera_suggestion: '中景建立空间后缓慢推进到手部与表情。',
    cultural_note: '事实、传说与创作处理必须分层。',
    conflict: `第${sceneId}场的现实阻力迫使人物调整行动`,
    dialogue_or_narration: `第${sceneId}场只补画面看不见的信息，人物用短句表达选择。`,
    source_entries: ['测试来源'],
    factual_basis: `测试来源支持第${sceneId}场的文化对象与空间背景。`,
    fictionalized_elements: ['人物路线与对白为创作组织'],
  };
}

function story(videoType: VideoType): StoryGenerateResult {
  const scenes = [1, 2, 3, 4, 5].map(scene);
  return {
    storyId: `dispatch-${videoType}`,
    sourceDomain: 'china_culture',
    title: `${videoType} 专业文本测试`,
    generation_type: videoType === 'character_story' ? 'character_story' : videoType === 'scene_short' ? 'scene_short' : 'culture_promo',
    video_type: videoType,
    presentation_style: 'cinematic',
    source_entry: '测试来源',
    logline: '主人公沿着一组真实文化线索作出选择，并让行动后果在镜头中可见。',
    theme: '文化价值只有进入具体行动、证据与选择，才能被当代观众理解。',
    full_text: '这是完整的观众文本。主人公进入真实空间，拿起关键物件，先核对来源，再面对阻力。见证者没有替事实下结论，而是指出可以继续核验的线索。主人公必须在保留旧做法与回应现实需要之间作出选择。每一次动作都带来新的信息，每一个镜头都承接前一场的结果。最终，人物用可见行动承担代价，也让文化对象在当代生活中获得具体而克制的连接。',
    scene_breakdown: scenes,
    gears_segments: [],
    gears_segments_url: `/api/stories/dispatch-${videoType}/gears-segments`,
    cultural_constraints: ['具体年代、人物身份、地点状态和机构口径必须按来源复核。'],
    credibility_note: '本测试只验证机器专业文本编排，不授予事实审核或生产信用。',
    truth_mode: 'inspired_by_material',
    target_audience: '中国文化入门观众',
    communication_goal: '让观众看懂文化对象、现实行动与事实边界。',
    material_pack: {
      schema_version: 'material-pack/v1',
      primary_materials: [{
        material_id: 'source-1',
        title: '测试来源',
        summary: '来源记录了文化对象、真实空间和当代使用背景。',
        source_type: 'manual_note',
        purpose: ['fact_basis'],
      }],
      supporting_materials: [],
      reference_materials: [],
      visual_assets: [],
      verified_facts: ['测试来源记录了文化对象、真实空间和当代使用背景。'],
      uncertain_claims: ['具体年代、身份、地点状态和机构口径仍需正式来源复核。'],
      creative_space: ['人物路线、选择、对白与镜头次序属于项目创作组织。'],
      missing_needs: [],
      overall_confidence: 0.8,
    },
    story_blueprint: {
      schema_version: 'story-blueprint/v1',
      storyId: `dispatch-${videoType}`,
      entry_name: '测试来源',
      source_entry: '测试来源',
      video_type: videoType,
      presentation_style: 'cinematic',
      story_structure: 'single_event_drama',
      target_duration: '3分钟',
      central_event: '主人公核对线索并作出选择',
      central_question: '文化对象如何通过真实行动与事实边界进入当代生活？',
      protagonist: '主人公',
      genre_beats: [],
      character_arcs: [],
      evidence_boundaries: [],
      type_specific_requirements: [],
    },
    characters: [
      { name: '主人公', role: '主角', description: '用行动连接文化线索与当代生活。' },
      { name: '见证者', role: '证据提供者', description: '只说明可核验范围。' },
    ],
    visual_symbols: ['关键物件', '真实空间', '手部动作'],
    modern_connection: '观众可以沿来源线索继续了解文化对象的当代使用。',
    core_message: '用真实行动和文化证据支撑传播主张。',
    slogan_or_key_sentence: '让证据进入画面，让选择留下余味。',
    craft_or_ritual_process: '材料、工具与动作按镜头顺序呈现。',
    spatial_identity: '由真实空间路线和时间变化建立的文化现场。',
    atmosphere: '克制、清晰，并保留自然声与现场余味。',
    argument_points: ['先界定对象与来源', '再解释行动与关系', '最后说明边界与迁移'],
    knowledge_outline: ['问题', '概念', '例子', '边界', '复盘'],
  };
}

describe('professional text dispatcher', () => {
  it('selects and schema-validates exactly one professional pipeline for every video type', () => {
    for (const videoType of videoTypes) {
      const sourceStory = story(videoType);
      const result = dispatchProfessionalTextPackageForStory(sourceStory);

      expect(result.evidence_resolution.payload.video_type).toBe(videoType);
      expect(result.package.video_type).toBe(videoType);
      expect(result.package.story_id).toBe(sourceStory.storyId);
      expect(result.package.scene_breakdown).toEqual(sourceStory.scene_breakdown);
      expect(result.package.full_text).toBe(sourceStory.full_text);
      expect(result.package.delivery_text_package.scene_units).toHaveLength(sourceStory.scene_breakdown.length);
      expect(ProfessionalTextPackageSchema.safeParse(result.package).success).toBe(true);
    }
  });

  it('returns an actionable supplement task instead of pretending an unverified source is factual', () => {
    const sourceStory = story('character_story');
    delete sourceStory.material_pack;
    delete sourceStory.knowledge_pack;

    const resolution = resolveProfessionalEvidenceForStory(sourceStory, {
      now: '2026-07-24T00:00:00.000Z',
    });

    expect(resolution.research.evidence_items.some(item => item.status === 'verified_fact')).toBe(false);
    expect(resolution.supplement_tasks).toContainEqual(expect.objectContaining({
      need_id: 'professional_verified_facts',
      source: 'professional_evidence_missing',
      status: 'open',
      blocking_level: 'blocking',
      affects: expect.arrayContaining(['professional_text_package']),
    }));
  });

  it('keeps documentary interview consent pending until a resolved supplement supplies it', () => {
    const sourceStory = story('documentary_short');
    const pending = resolveProfessionalEvidenceForStory(sourceStory, {
      now: '2026-07-24T00:00:00.000Z',
    });
    expect(pending.supplement_tasks).toContainEqual(expect.objectContaining({
      need_id: 'professional_documentary_interview_consent',
      status: 'open',
    }));

    sourceStory.supplement_tasks = [{
      task_id: `${sourceStory.storyId}--professional-evidence--documentary-interview`,
      need_id: 'professional_documentary_interview_consent',
      label: '纪录片采访与授权确认',
      description: '已由项目补充任务确认。',
      status: 'resolved',
      source: 'professional_evidence_missing',
      created_at: '2026-07-24T00:00:00.000Z',
      resolved_at: '2026-07-24T01:00:00.000Z',
      supplement_field_values: {
        interview_role: '已授权馆员',
        allowed_topics: '来源；现实现场；实物线索',
        consent_status: 'confirmed',
      },
    }];
    const resolved = resolveProfessionalEvidenceForStory(sourceStory, {
      now: '2026-07-24T01:00:00.000Z',
    });

    expect(resolved.supplement_tasks).not.toContainEqual(expect.objectContaining({
      need_id: 'professional_documentary_interview_consent',
      status: 'open',
    }));
    expect(resolved.payload.video_type).toBe('documentary_short');
    if (resolved.payload.video_type === 'documentary_short') {
      expect(resolved.payload.evidence.interview_roles[0]).toEqual(expect.objectContaining({
        role_description: '已授权馆员',
        confirmed: true,
        consent_status: 'confirmed',
      }));
    }
  });
});
