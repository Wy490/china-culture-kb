import { createHash } from 'node:crypto';
import { VIDEO_TYPE_CONFIG } from '@shared/types.js';
import type {
  KnowledgePack,
  ProductionMaterialReadinessReport,
  StoryBlueprint,
  StoryGenerateRequest,
  VideoType,
} from '@shared/types.js';
import { prepareChinaCultureStoryGeneration } from '../domains/china-culture/story-generation-preparation-service.js';
import type { PreparedChinaCultureStoryGeneration } from '../domains/china-culture/story-generation-preparation-service.js';
import {
  buildStoryGenerationPromptPackage,
  type StoryGenerationPromptPackage,
} from './story-generation-prompt.js';

export interface StoryDomainPackComparisonCase {
  case_id: string;
  request: StoryGenerateRequest;
}

export interface StoryDomainPackComparisonItem {
  case_id: string;
  video_type: VideoType;
  status: 'passed' | 'failed';
  selected_pack_names: string[];
  expected_pack_names: string[];
  missing_expected_pack_names: string[];
  selected_pack_count: number;
  production_prompt_count: number;
  review_boundary_count: number;
  active_prompt_sha256: string;
  control_prompt_sha256: string;
  active_guidance_line_count: number;
  control_guidance_line_count: number;
  prompt_added_guidance_line_count: number;
  readiness_score_delta: number;
  issues: string[];
}

export interface StoryDomainPack15TypeComparisonReport {
  schema_version: 'story-domain-pack-15-type-comparison/v1';
  status: 'passed' | 'failed';
  mode: 'machine_pre_generation_counterfactual';
  selection_policy: 'cultural_safety_then_type_specific_then_production_ready_diversity/v1';
  generated_at: string;
  coverage: {
    type_count: number;
    trace_covered_type_count: number;
    prompt_delta_type_count: number;
    readiness_score_stable_type_count: number;
    expected_pack_matched_type_count: number;
  };
  invariants: {
    every_video_type_present: boolean;
    every_type_has_domain_pack_trace: boolean;
    every_type_has_expected_domain_pack: boolean;
    every_active_prompt_has_guidance: boolean;
    every_control_prompt_suppresses_guidance: boolean;
    every_readiness_score_is_stable: boolean;
  };
  failed_invariants: string[];
  boundary: {
    machine_comparison_only: true;
    external_model_invoked: false;
    story_output_quality_measured: false;
    human_review_complete: false;
    real_production_credit_granted: false;
  };
  items: StoryDomainPackComparisonItem[];
}

export const STORY_DOMAIN_PACK_EXPECTED_PACK_BY_VIDEO_TYPE: Record<VideoType, readonly string[]> = {
  character_story: ['朝代服饰与器物包——时代称谓、服装道具和事实边界'],
  historical_drama: ['朝代服饰与器物包——时代称谓、服装道具和事实边界'],
  legend_story: ['朝代服饰与器物包——时代称谓、服装道具和事实边界'],
  children_story: ['儿童改写规则包——年龄分层、善意张力与事实边界'],
  ai_comic_drama: ['AI漫剧分镜包——关键帧、表情节拍与连续性验收'],
  culture_promo: ['建筑空间与陈设包——空间层级、动线道具和时代边界'],
  heritage_promo: ['非遗流程生产包——材料工具、工序动作与授权边界'],
  city_brand_promo: ['建筑空间与陈设包——空间层级、动线道具和时代边界'],
  social_short: ['短视频钩子包——三秒问题、对比反转与平台节奏'],
  documentary_short: ['纪录片来源包——现实现场、来源线索与再现边界'],
  explainer_video: ['讲解知识结构包——核心问题、层级例子与图示字幕'],
  lecture_video: ['宣讲培训结构包——论点案例、练习复盘与行动转化'],
  education_training: ['宣讲培训结构包——论点案例、练习复盘与行动转化'],
  scene_short: ['建筑空间与陈设包——空间层级、动线道具和时代边界'],
  landscape_mood: ['自然环境与声景包——季节天气、地貌运动和环境声音'],
};

export async function buildStoryDomainPack15TypeComparison(input: {
  cases: readonly StoryDomainPackComparisonCase[];
  generatedAt?: string;
}): Promise<StoryDomainPack15TypeComparisonReport> {
  const items: StoryDomainPackComparisonItem[] = [];
  for (const comparisonCase of input.cases) {
    const preparation = await prepareChinaCultureStoryGeneration(comparisonCase.request);
    if (!preparation.ok) {
      items.push(failedItem(comparisonCase, preparation.message));
      continue;
    }
    items.push(buildComparisonItem(comparisonCase, preparation));
  }

  const expectedVideoTypes = Object.keys(VIDEO_TYPE_CONFIG) as VideoType[];
  const presentTypes = new Set(items.map(item => item.video_type));
  const invariants = {
    every_video_type_present: expectedVideoTypes.every(videoType => presentTypes.has(videoType))
      && presentTypes.size === expectedVideoTypes.length,
    every_type_has_domain_pack_trace: items.length > 0
      && items.every(item => item.selected_pack_count > 0),
    every_type_has_expected_domain_pack: items.length > 0
      && items.every(item => item.missing_expected_pack_names.length === 0),
    every_active_prompt_has_guidance: items.length > 0
      && items.every(item => item.active_guidance_line_count > 0),
    every_control_prompt_suppresses_guidance: items.length > 0
      && items.every(item => item.control_guidance_line_count === 0),
    every_readiness_score_is_stable: items.length > 0
      && items.every(item => item.readiness_score_delta === 0),
  };
  const failedInvariants = Object.entries(invariants)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  return {
    schema_version: 'story-domain-pack-15-type-comparison/v1',
    status: failedInvariants.length === 0 && items.every(item => item.status === 'passed')
      ? 'passed'
      : 'failed',
    mode: 'machine_pre_generation_counterfactual',
    selection_policy: 'cultural_safety_then_type_specific_then_production_ready_diversity/v1',
    generated_at: input.generatedAt ?? new Date().toISOString(),
    coverage: {
      type_count: presentTypes.size,
      trace_covered_type_count: items.filter(item => item.selected_pack_count > 0).length,
      prompt_delta_type_count: items.filter(item => item.prompt_added_guidance_line_count > 0).length,
      readiness_score_stable_type_count: items.filter(item => item.readiness_score_delta === 0).length,
      expected_pack_matched_type_count: items.filter(item => item.missing_expected_pack_names.length === 0).length,
    },
    invariants,
    failed_invariants: failedInvariants,
    boundary: {
      machine_comparison_only: true,
      external_model_invoked: false,
      story_output_quality_measured: false,
      human_review_complete: false,
      real_production_credit_granted: false,
    },
    items,
  };
}

function buildComparisonItem(
  comparisonCase: StoryDomainPackComparisonCase,
  preparation: PreparedChinaCultureStoryGeneration,
): StoryDomainPackComparisonItem {
  const context = preparation.preliminaryStoryBlueprint.domain_pack_context;
  const selectedNames = new Set(context?.selected_packs.map(pack => pack.entry_name) ?? []);
  const expectedPackNames = [...STORY_DOMAIN_PACK_EXPECTED_PACK_BY_VIDEO_TYPE[preparation.videoType]];
  const missingExpectedPackNames = expectedPackNames.filter(name => !selectedNames.has(name));
  const controlKnowledgePack = suppressSelectedDomainPacks(preparation.knowledgePackToUse, selectedNames);
  const controlBlueprint = suppressDomainPackBlueprint(preparation.preliminaryStoryBlueprint);
  const controlReadiness = suppressDomainPackReadiness(preparation.productionMaterialReadiness);
  const activePrompt = buildComparisonPrompt(comparisonCase.request, preparation, {
    knowledgePack: preparation.knowledgePackToUse,
    blueprint: preparation.preliminaryStoryBlueprint,
    readiness: preparation.productionMaterialReadiness,
  });
  const controlPrompt = buildComparisonPrompt(comparisonCase.request, preparation, {
    knowledgePack: controlKnowledgePack,
    blueprint: controlBlueprint,
    readiness: controlReadiness,
  });
  const activeGuidance = domainPackGuidanceLines(activePrompt);
  const controlGuidance = domainPackGuidanceLines(controlPrompt);
  const controlGuidanceSet = new Set(controlGuidance);
  const addedGuidance = activeGuidance.filter(line => !controlGuidanceSet.has(line));
  const readinessScoreDelta = (preparation.productionMaterialReadiness?.score ?? 0)
    - (controlReadiness?.score ?? 0);
  const issues = [
    ...(selectedNames.size > 0 ? [] : ['domain_pack_trace_missing']),
    ...(missingExpectedPackNames.length === 0
      ? []
      : [`expected_domain_pack_missing:${missingExpectedPackNames.join('|')}`]),
    ...(activeGuidance.length > 0 ? [] : ['active_prompt_guidance_missing']),
    ...(controlGuidance.length === 0 ? [] : ['control_prompt_guidance_not_suppressed']),
    ...(addedGuidance.length > 0 ? [] : ['prompt_guidance_delta_missing']),
    ...(readinessScoreDelta === 0 ? [] : ['readiness_score_changed']),
  ];

  return {
    case_id: comparisonCase.case_id,
    video_type: preparation.videoType,
    status: issues.length === 0 ? 'passed' : 'failed',
    selected_pack_names: [...selectedNames],
    expected_pack_names: expectedPackNames,
    missing_expected_pack_names: missingExpectedPackNames,
    selected_pack_count: selectedNames.size,
    production_prompt_count: context?.production_prompt_count ?? 0,
    review_boundary_count: context?.review_boundary_count ?? 0,
    active_prompt_sha256: sha256Prompt(activePrompt),
    control_prompt_sha256: sha256Prompt(controlPrompt),
    active_guidance_line_count: activeGuidance.length,
    control_guidance_line_count: controlGuidance.length,
    prompt_added_guidance_line_count: addedGuidance.length,
    readiness_score_delta: readinessScoreDelta,
    issues,
  };
}

function buildComparisonPrompt(
  request: StoryGenerateRequest,
  preparation: PreparedChinaCultureStoryGeneration,
  input: {
    knowledgePack: KnowledgePack;
    blueprint: StoryBlueprint;
    readiness?: ProductionMaterialReadinessReport;
  },
): StoryGenerationPromptPackage {
  return buildStoryGenerationPromptPackage({
    entry: preparation.entry,
    request: {
      ...request,
      narrative_pattern_ids: preparation.narrativePatternIds,
    },
    videoType: preparation.videoType,
    presentationStyle: preparation.presentationStyle,
    storyStructure: preparation.storyStructure,
    targetDuration: preparation.targetDuration,
    tone: preparation.toneWithPriority,
    selectedEvent: preparation.centralEvent,
    knowledgePack: input.knowledgePack,
    materialPack: preparation.materialPackToUse,
    materialSufficiency: preparation.materialSufficiency,
    productionMaterialPack: preparation.productionMaterialPack,
    productionMaterialReadiness: input.readiness,
    creationContract: preparation.creationContract,
    genreMatrix: preparation.genreMatrix,
    storyBlueprint: input.blueprint,
    adaptationAnalysis: preparation.adaptationAnalysis,
    referenceGenerationRecipe: preparation.referenceGenerationRecipe,
    referenceGenerationContext: preparation.referenceGenerationContext,
  });
}

function suppressSelectedDomainPacks(
  knowledgePack: KnowledgePack,
  selectedNames: ReadonlySet<string>,
): KnowledgePack {
  return {
    ...knowledgePack,
    supporting_entries: knowledgePack.supporting_entries
      .filter(entry => !selectedNames.has(entry.entry_name)),
  };
}

function suppressDomainPackBlueprint(blueprint: StoryBlueprint): StoryBlueprint {
  const { domain_pack_context: _context, ...rest } = blueprint;
  return {
    ...rest,
    type_specific_requirements: rest.type_specific_requirements.filter(line => (
      !line.startsWith('Domain Pack 生产提示')
      && !line.startsWith('Domain Pack 审稿边界')
    )),
  };
}

function suppressDomainPackReadiness(
  readiness: ProductionMaterialReadinessReport | undefined,
): ProductionMaterialReadinessReport | undefined {
  if (!readiness) return undefined;
  const { domain_pack_context: _context, ...rest } = readiness;
  return rest;
}

function domainPackGuidanceLines(prompt: StoryGenerationPromptPackage): string[] {
  return prompt.output_contract.should_respect.filter(line => (
    line.startsWith('Domain Pack 生产提示')
    || line.startsWith('Domain Pack 审稿边界')
  ));
}

function sha256Prompt(prompt: StoryGenerationPromptPackage): string {
  return createHash('sha256').update(JSON.stringify(prompt)).digest('hex');
}

function failedItem(
  comparisonCase: StoryDomainPackComparisonCase,
  issue: string,
): StoryDomainPackComparisonItem {
  return {
    case_id: comparisonCase.case_id,
    video_type: comparisonCase.request.video_type ?? 'character_story',
    status: 'failed',
    selected_pack_names: [],
    expected_pack_names: [
      ...STORY_DOMAIN_PACK_EXPECTED_PACK_BY_VIDEO_TYPE[comparisonCase.request.video_type ?? 'character_story'],
    ],
    missing_expected_pack_names: [
      ...STORY_DOMAIN_PACK_EXPECTED_PACK_BY_VIDEO_TYPE[comparisonCase.request.video_type ?? 'character_story'],
    ],
    selected_pack_count: 0,
    production_prompt_count: 0,
    review_boundary_count: 0,
    active_prompt_sha256: '',
    control_prompt_sha256: '',
    active_guidance_line_count: 0,
    control_guidance_line_count: 0,
    prompt_added_guidance_line_count: 0,
    readiness_score_delta: 0,
    issues: [issue],
  };
}
