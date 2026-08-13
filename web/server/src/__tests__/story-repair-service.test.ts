import { describe, expect, it } from 'vitest';
import type { StoryBlueprint, StoryGenerateResult, StoryQualityReport } from '@shared/types.js';
import { buildStoryRepairPromptPackage, shouldAttemptStoryRepair } from '../services/story-repair-service.js';
import { validateStoryFamilyBaseQuality } from '../services/story-family-quality-service.js';
import type { StoryGenerationPromptPackage } from '../services/story-generation-prompt.js';

function makeQualityReport(score: number, passed = false): StoryQualityReport {
  return {
    hasCentralEvent: true,
    hasConflict: true,
    hasProtagonistChoice: true,
    hasSceneAction: true,
    hasClimax: true,
    hasEndingTheme: true,
    isNotBiographySummary: true,
    passed,
    issues: ['类型字段缺失：craft_or_ritual_process'],
    genre_score: score,
    repair_actions: ['补齐类型字段：craft_or_ritual_process', '补充具体步骤'],
  };
}

function makeStory(): StoryGenerateResult {
  const materialSufficiency = {
    schema_version: 'material-sufficiency/v1' as const,
    stage: 'script_ready' as const,
    active_stage: 'minimum_viable_story' as const,
    score: 64,
    can_generate: true,
    can_generate_with_risks: true,
    blocked: false,
    needs_verification: true,
    generation_posture: 'draft_needs_verification' as const,
    next_stage: 'script_ready' as const,
    missing_items: [{
      item_id: 'institution-position',
      label: '机构审定口径',
      reason: '宣传片需要确认机构口径和禁用表述。',
      blocking_level: 'risk' as const,
      affects: ['script', 'truth_boundary'],
      recommended_question: '请补充机构可公开使用的审定口径。',
    }],
    optional_items: [],
    token_risk: 'low' as const,
    recommended_next_questions: ['是否已有机构审定文案？'],
  };
  return {
    storyId: 'story-1',
    title: '缺少工艺流程的非遗片',
    generation_type: 'culture_promo',
    video_type: 'heritage_promo',
    presentation_style: 'documentary',
    source_entry: '测试非遗',
    logline: '一门技艺正在寻找新的传承方式。',
    theme: '非遗传承',
    full_text: '匠人走进作坊，讲述这门技艺的精神，但文本尚未写出清楚流程。',
    scene_breakdown: [{
      scene_id: 1,
      title: '匠人登场',
      duration_sec: 60,
      location: '作坊',
      time_of_day: '清晨',
      dramatic_function: '匠人登场',
      plot: '匠人走进作坊，抚摸工具，准备开始工作。',
      key_action: '准备制作',
      characters: ['匠人'],
      visual_prompt: '作坊、工具、手部动作',
      camera_suggestion: '中景',
      cultural_note: '非遗传承语境',
    }],
    gears_segments: [],
    gears_segments_url: '/api/stories/story-1/gears-segments',
    cultural_constraints: [],
    credibility_note: '测试',
    story_structure: 'object_clue_journey',
    material_sufficiency: materialSufficiency,
    creation_contract: {
      schema_version: 'creation-contract/v1',
      creation_use_case: 'institutional_promo',
      truth_mode: 'institutional_verified',
      client_type: '文旅机构',
      target_audience: '研学团队',
      communication_goal: '稳妥呈现非遗传承价值',
      video_type: 'heritage_promo',
      presentation_style: 'documentary',
      story_structure: 'object_clue_journey',
      narrative_pattern_ids: [],
      allowed_fiction: ['允许镜头调度和转场设计'],
      must_verify: ['传承人姓名、荣誉和机构数据'],
      forbidden_moves: ['不得虚构非遗传承人获奖数据'],
      required_disclaimers: ['未核实信息以创作性表达标注'],
      material_sufficiency: materialSufficiency,
      delivery_expectation: ['可进入剧本草案，不进入生产实产'],
    },
  };
}

function makeBasePackage(): StoryGenerationPromptPackage {
  return {
    prompt_version: 'story-generation/v1',
    context: {
      entry_name: '测试非遗',
      entry_type: '非遗',
      entry_region: '湖南',
      entry_keywords: ['工艺'],
      video_type: 'heritage_promo',
      presentation_style: 'documentary',
      story_structure: 'object_clue_journey',
      target_duration: '1分钟',
      tone: '',
    },
    entry_summary: '测试摘要',
    entry_story: '测试故事',
    entry_cultural_significance: '测试意义',
    output_contract: {
      must_provide: ['title'],
      should_respect: ['保持非遗宣传片质感'],
      return_json_fields: ['title'],
    },
    system_prompt: '系统提示',
    user_prompt: '用户提示',
  };
}

function makeBlueprint(): StoryBlueprint {
  return {
    schema_version: 'story-blueprint/v1',
    entry_name: '测试非遗',
    source_entry: '测试非遗',
    video_type: 'heritage_promo',
    presentation_style: 'documentary',
    story_structure: 'object_clue_journey',
    target_duration: '1分钟',
    central_question: '这门技艺如何通过动作和流程体现传承？',
    protagonist: '匠人',
    genre_beats: [{
      beat_id: 'beat-1',
      order: 1,
      function_label: '工艺全程',
      function_description: '完整工艺流程展示',
      content_requirement: '展示从原料到成品的关键步骤。',
      evidence_boundary_ids: ['source-entry'],
    }],
    character_arcs: [],
    evidence_boundaries: [{
      boundary_id: 'source-entry',
      label: '主条目事实边界',
      type: 'verified',
      source: '测试非遗',
      note: '保留条目边界。',
    }],
    type_specific_requirements: ['完整流程'],
    domain_pack_context: {
      schema_version: 'story-domain-pack-context/v1',
      selected_packs: [{
        entry_name: '非遗流程生产包——材料工具、工序动作与授权边界',
        knowledge_domain: 'production_process',
        entry_role: 'asset_pack',
        production_prompts: ['把材料、工具和工序动作拆成可拍步骤。'],
        review_boundaries: ['通用流程包不能替代具体项目、地区和传承人的工序核验。'],
      }],
      production_prompt_count: 1,
      review_boundary_count: 1,
      machine_validation_only: true,
      human_review_complete: false,
      real_credit_granted: false,
    },
  };
}

describe('story-repair-service', () => {
  it('uses strictness and score to decide whether to attempt repair', () => {
    expect(shouldAttemptStoryRepair({
      autoRepair: true,
      qualityReport: makeQualityReport(82, true),
      strictness: 'strict',
    })).toBe(true);
    expect(shouldAttemptStoryRepair({
      autoRepair: true,
      qualityReport: makeQualityReport(82, true),
      strictness: 'balanced',
    })).toBe(false);
    expect(shouldAttemptStoryRepair({
      autoRepair: false,
      qualityReport: makeQualityReport(20),
    })).toBe(false);
  });

  it('does not rewrite story text when only the legacy production aggregate fails', () => {
    const report = makeQualityReport(82, false);
    report.pattern_quality_report = { pattern_score: 90 } as StoryQualityReport['pattern_quality_report'];
    report.gears_readiness_report = { readiness_score: 100 } as StoryQualityReport['gears_readiness_report'];
    report.quality_gates = {
      story_publishable: true,
    } as StoryQualityReport['quality_gates'];

    expect(shouldAttemptStoryRepair({
      autoRepair: true,
      qualityReport: report,
      strictness: 'balanced',
    })).toBe(false);

    report.pattern_quality_report = { pattern_score: 69 } as StoryQualityReport['pattern_quality_report'];
    expect(shouldAttemptStoryRepair({
      autoRepair: true,
      qualityReport: report,
      strictness: 'balanced',
    })).toBe(true);
  });

  it('builds a focused repair package with quality issues and blueprint beats', () => {
    const story = makeStory();
    const familyQuality = validateStoryFamilyBaseQuality(story);
    const pkg = buildStoryRepairPromptPackage({
      basePackage: makeBasePackage(),
      story,
      qualityReport: {
        ...makeQualityReport(48),
        family_quality_report: familyQuality.family_quality_report,
      },
      blueprint: makeBlueprint(),
      strictness: 'balanced',
    });

    expect(pkg.system_prompt).toContain('完整故事重写');
    expect(pkg.user_prompt).toContain('类型质量问题');
    expect(pkg.user_prompt).toContain('类型字段缺失：craft_or_ritual_process');
    expect(pkg.user_prompt).toContain('工艺全程');
    expect(pkg.user_prompt).toContain('创作合同与素材边界');
    expect(pkg.user_prompt).toContain('真实度模式：institutional_verified');
    expect(pkg.user_prompt).toContain('禁止表达：不得虚构非遗传承人获奖数据');
    expect(pkg.user_prompt).toContain('素材目标阶段：script_ready');
    expect(pkg.user_prompt).toContain('待核验边界');
    expect(pkg.output_contract.return_json_fields).toContain('craft_or_ritual_process');
    expect(pkg.output_contract.should_respect.join('\n')).toContain('institutional_verified');
    expect(pkg.output_contract.should_respect.join('\n')).toContain('素材 Gate');
    expect(pkg.system_prompt).toContain('宣传传播修订编剧');
    expect(pkg.system_prompt).not.toContain('AI 漫剧生产编剧');
    expect(pkg.user_prompt).toContain('宣传传播家族门禁');
    expect(pkg.output_contract.should_respect.join('\n')).toContain('价值主张');
    expect(pkg.user_prompt).toContain('Domain Pack 修复边界');
    expect(pkg.user_prompt).toContain('把材料、工具和工序动作拆成可拍步骤');
    expect(pkg.user_prompt).toContain('通用流程包不能替代具体项目');
    expect(pkg.output_contract.should_respect.join('\n')).toContain('Domain Pack 审稿边界');
  });
});
