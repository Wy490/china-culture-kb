import {
  getStoryAgentGeneratedGovernancePlan,
  type StoryAgentGeneratedGovernancePlan,
} from './get-generated-governance-plan.js';
import {
  getStoryAgentGeneratedHealth,
  type StoryAgentGeneratedHealthItem,
  type StoryAgentGeneratedHealthReport,
} from './get-generated-health.js';
import {
  getProductionReadinessPortfolio,
  type ProductionReadinessPortfolioReport,
} from './get-production-readiness-portfolio.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getKbRoot } from '../lib/provinces.js';

type MvpStatus = 'ready' | 'needs_action' | 'blocked';
type PackHealthStatus = 'passed' | 'warning' | 'failed';
type IssueSeverity = 'warning' | 'error';
type MaterialSufficiencyStage = 'minimum_viable_story' | 'script_ready' | 'production_ready';
type JsonRecord = Record<string, unknown>;
type MvpLaneKey =
  | 'generated_artifacts'
  | 'generated_governance'
  | 'production_material_packs'
  | 'domain_packs'
  | 'story_quality'
  | 'repair_loop'
  | 'delivery_contract'
  | 'production_command';
type MvpProgressKey =
  | 'generated_governance'
  | 'mcp_story_agent_loop'
  | 'content_command_layer'
  | 'production_delivery_contract'
  | 'gears_end_to_end_acceptance';

type PortfolioItem = ProductionReadinessPortfolioReport['items'][number];
type HealthScope = StoryAgentGeneratedHealthItem['scope'];

export interface GetStoryAgentMvpStatusInput {
  generated_limit?: number;
  portfolio_limit?: number;
  include_markdown?: boolean;
}

export interface StoryAgentMvpLane {
  key: MvpLaneKey;
  label: string;
  status: MvpStatus;
  score: number;
  detail: string;
  evidence: string[];
  next_action?: string;
}

export interface StoryAgentMvpPriorityTarget {
  scope: PortfolioItem['scope'] | HealthScope;
  project_id: string;
  title?: string;
  status: string;
  priority_score: number;
  primary_action?: string;
  evidence: string[];
}

export interface StoryAgentMvpProgressSlice {
  key: MvpProgressKey;
  label: string;
  status: MvpStatus;
  percent: number;
  detail: string;
  blocker?: string;
  evidence: string[];
}

export interface StoryAgentMvpStatusReport {
  schema_version: 'mcp-story-agent-mvp-status/v1';
  generated_at: string;
  status: MvpStatus;
  score: number;
  summary: {
    generated_target_count: number;
    generated_ready_count: number;
    generated_planned_count: number;
    generated_production_gap_count: number;
    generated_interrupted_count: number;
    readiness_target_count: number;
    readiness_ready_count: number;
    readiness_needs_action_count: number;
    readiness_blocked_count: number;
    ready_automation_step_count: number;
    external_or_manual_step_count: number;
    blocker_count: number;
    warning_count: number;
    generated_governance_action_count: number;
    generated_governance_p0_p1_action_count: number;
    generated_governance_ready_signoff_candidate_count: number;
    production_material_pack_status: PackHealthStatus;
    production_material_pack_count: number;
    production_material_pack_issue_count: number;
    production_material_pack_core_ready_count: number;
    production_material_pack_core_total_count: number;
    domain_pack_status: PackHealthStatus;
    domain_pack_count: number;
    domain_pack_issue_count: number;
    production_domain_pack_ready_count: number;
    production_domain_pack_required_count: number;
    story_agent_command_surface_status: MvpStatus;
    story_agent_command_surface_percent: number;
    mcp_story_agent_tool_count: number;
    mcp_story_agent_loop_percent: number;
    content_command_layer_percent: number;
    production_delivery_contract_percent: number;
    production_delivery_contract_surface_count: number;
  };
  lanes: StoryAgentMvpLane[];
  progress: StoryAgentMvpProgressSlice[];
  priority_targets: StoryAgentMvpPriorityTarget[];
  next_actions: string[];
  notes: string[];
  generated_health: StoryAgentGeneratedHealthReport;
  generated_governance_plan: StoryAgentGeneratedGovernancePlan;
  production_material_pack_health: ProductionMaterialPackHealthReport;
  domain_pack_health: DomainPackProductionHealthReport;
  production_portfolio: ProductionReadinessPortfolioReport;
  markdown?: string;
}

interface ProductionMaterialPack {
  video_type: string;
  label: string;
  goal?: string;
  material_template: {
    required_fields: string[];
    prompt_layers?: string[];
    minimum_viable_story_gate: string[];
    script_ready_gate: string[];
    production_ready_gate: string[];
    supplement_questions: string[];
  };
  sample_entries: unknown[];
}

interface ProductionMaterialPackHealthIssue {
  severity: IssueSeverity;
  issue_type:
    | 'missing_required_video_type'
    | 'unknown_required_field'
    | 'duplicate_required_field'
    | 'underfilled_prompt_layers'
    | 'underfilled_sample_entries'
    | 'underfilled_supplement_questions'
    | 'underfilled_gate_items';
  video_type?: string;
  message: string;
  details?: string[];
}

interface ProductionMaterialPackHealthSummary {
  video_type: string;
  label: string;
  required_field_count: number;
  prompt_layer_count: number;
  sample_entry_count: number;
  supplement_question_count: number;
  gate_item_counts: Record<MaterialSufficiencyStage, number>;
  unknown_required_fields: string[];
  duplicate_required_fields: string[];
  status: PackHealthStatus;
}

interface ProductionMaterialPackHealthReport {
  schema_version: 'production-material-pack-health/v1';
  generated_at: string;
  status: PackHealthStatus;
  pack_count: number;
  required_video_types: string[];
  covered_required_video_types: string[];
  missing_required_video_types: string[];
  core_video_types: string[];
  production_ready_core_video_types: string[];
  high_frequency_video_types: string[];
  packs: ProductionMaterialPackHealthSummary[];
  issues: ProductionMaterialPackHealthIssue[];
}

interface DomainPackSeed {
  entry_name: string;
  domain: string;
  role: string;
  type?: string;
  region?: string;
  summary?: string;
  keywords?: string[];
  asset_usage: string[];
  trigger_words: string[];
  production_prompts?: string[];
  review_boundaries?: string[];
}

interface DomainPackFile {
  domain_id?: string;
  version?: string;
  entries?: unknown[];
}

interface RequiredProductionDomainPack {
  pack_id: string;
  entry_name: string;
  expected_asset_usage: string[];
}

interface DomainPackProductionHealthIssue {
  severity: IssueSeverity;
  issue_type:
    | 'missing_required_pack'
    | 'duplicate_entry_name'
    | 'underfilled_trigger_words'
    | 'underfilled_production_prompts'
    | 'underfilled_review_boundaries'
    | 'missing_expected_asset_usage';
  pack_id?: string;
  entry_name?: string;
  message: string;
  details?: string[];
}

interface DomainPackProductionHealthSummary {
  pack_id: string;
  entry_name: string;
  domain: string;
  role: string;
  trigger_word_count: number;
  production_prompt_count: number;
  review_boundary_count: number;
  asset_usage: string[];
  status: PackHealthStatus;
}

interface DomainPackProductionHealthReport {
  schema_version: 'domain-pack-production-health/v1';
  generated_at: string;
  domain_id: string;
  version: string;
  status: PackHealthStatus;
  pack_count: number;
  production_pack_count: number;
  required_pack_ids: string[];
  covered_required_pack_ids: string[];
  missing_required_pack_ids: string[];
  production_ready_pack_ids: string[];
  packs: DomainPackProductionHealthSummary[];
  issues: DomainPackProductionHealthIssue[];
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

const MCP_STORY_AGENT_LOOP_TOOLS = [
  'kb_get_entry_detail',
  'kb_generate_story_blueprint',
  'kb_generate_script',
  'kb_generate_story',
  'kb_get_project_context',
  'kb_validate_genre_story',
  'kb_generate_story_repair_prompt',
  'kb_repair_story',
  'kb_update_project_version',
  'kb_generate_gears_delivery',
  'kb_generate_seedance_prompt',
  'kb_get_story_agent_generated_health',
  'kb_get_story_agent_generated_governance_plan',
  'kb_run_story_agent_generated_governance',
  'kb_get_story_agent_mvp_status',
  'kb_get_production_readiness',
  'kb_get_production_readiness_portfolio',
  'kb_run_production_readiness_automation',
  'kb_run_production_readiness_portfolio_automation',
  'kb_get_gears_worker_evidence_signoff',
] as const;

const PRODUCTION_DELIVERY_CONTRACT_SURFACES = [
  'gears_delivery_package',
  'production_board_export',
  'seedance_prompt_package',
  'seedance_asset_upload_checklist',
  'story_scene_breakdown',
  'gears_segments',
  'shot_ledger',
  'gears_job_ledger',
  'production_readiness',
  'portfolio_readiness',
  'review_repair_package',
  'retry_execution_plan',
  'worker_evidence_signoff',
] as const;

const CORE_PRODUCTION_READY_VIDEO_TYPES = [
  'heritage_promo',
  'documentary_short',
  'ai_comic_drama',
  'explainer_video',
] as const;

const HIGH_FREQUENCY_PRODUCTION_VIDEO_TYPES = [
  ...CORE_PRODUCTION_READY_VIDEO_TYPES,
  'children_story',
  'social_short',
  'lecture_video',
  'education_training',
] as const;

const PACK_HEALTH_GATE_STAGES: MaterialSufficiencyStage[] = [
  'minimum_viable_story',
  'script_ready',
  'production_ready',
];

const KNOWN_PRODUCTION_MATERIAL_FIELD_IDS = new Set([
  'ambient_sound',
  'analogy_or_visual_metaphor',
  'argument_points',
  'assessment_check',
  'audience_age_band',
  'audience_level',
  'audience_takeaway',
  'b_roll_plan',
  'beat_interval',
  'case_examples',
  'character_stability_tags',
  'child_safe_conflict',
  'comment_prompt',
  'communication_goal',
  'community_or_practitioner_consent',
  'concept_definitions',
  'concrete_examples',
  'confirmed_status_and_sources',
  'core_question',
  'diagram_or_caption_plan',
  'dialogue_bubbles',
  'documentary_question',
  'documentation_assets',
  'emotion_beats',
  'emotional_resolution',
  'ending_hook',
  'episode_hook',
  'fact_boundary_card',
  'field_notes',
  'forbidden_claims',
  'hand_actions',
  'heritage_or_craft_type',
  'identity_motion_consistency_plan',
  'interview_clip_selection',
  'knowledge_outline',
  'knowledge_steps',
  'learner_profile',
  'learning_objective',
  'materials',
  'misconception_or_boundary',
  'modern_connection',
  'multi_shot_continuity',
  'official_catalog_or_resource_links',
  'opening_hook',
  'opponent_or_pressure',
  'parent_teacher_note',
  'platform_context',
  'practice_task',
  'practitioner_or_transmission_line',
  'present_day_trace',
  'process_steps',
  'production_risks',
  'project_name',
  'protagonist_choice',
  'protagonist_goal',
  'real_world_site_or_object',
  'recap_sentence',
  'reconstruction_boundary',
  'reference_images_or_keyframes',
  'relationship_collision',
  'scene_anchor',
  'share_trigger',
  'shot_prompt_layers',
  'single_shot_test',
  'slide_or_board_assets',
  'sound_or_texture_details',
  'source_cues',
  'source_quotes_or_source_cues',
  'speaker_position',
  'step_sequence',
  'timeline',
  'tools',
  'transition_plan',
  'vertical_shot_plan',
  'visual_symbols',
  'what_must_not_be_claimed',
  'witness_or_expert_roles',
  'wonder_or_cultural_symbol',
  'world_and_truth_mode',
]);

const REQUIRED_PRODUCTION_DOMAIN_PACKS: RequiredProductionDomainPack[] = [
  {
    pack_id: 'heritage_process_pack',
    entry_name: '非遗流程生产包——材料工具、工序动作与授权边界',
    expected_asset_usage: ['source_grounding', 'credibility_boundary'],
  },
  {
    pack_id: 'documentary_source_pack',
    entry_name: '纪录片来源包——现实现场、来源线索与再现边界',
    expected_asset_usage: ['source_grounding', 'credibility_boundary'],
  },
  {
    pack_id: 'ai_comic_storyboard_pack',
    entry_name: 'AI漫剧分镜包——关键帧、表情节拍与连续性验收',
    expected_asset_usage: ['visual_style', 'gears_delivery'],
  },
  {
    pack_id: 'era_and_costume_pack',
    entry_name: '朝代服饰与器物包——时代称谓、服装道具和事实边界',
    expected_asset_usage: ['character_clothing', 'credibility_boundary'],
  },
  {
    pack_id: 'explainer_knowledge_structure_pack',
    entry_name: '讲解知识结构包——核心问题、层级例子与图示字幕',
    expected_asset_usage: ['source_grounding', 'visual_style'],
  },
  {
    pack_id: 'children_adaptation_safety_pack',
    entry_name: '儿童改写规则包——年龄分层、善意张力与事实边界',
    expected_asset_usage: ['safety_boundary', 'credibility_boundary'],
  },
  {
    pack_id: 'short_video_hook_pack',
    entry_name: '短视频钩子包——三秒问题、对比反转与平台节奏',
    expected_asset_usage: ['visual_style', 'credibility_boundary'],
  },
  {
    pack_id: 'education_training_structure_pack',
    entry_name: '宣讲培训结构包——论点案例、练习复盘与行动转化',
    expected_asset_usage: ['source_grounding', 'safety_boundary'],
  },
];

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function duplicateStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort((a, b) => a.localeCompare(b));
}

function healthStatusFromIssues(issues: Array<{ severity: IssueSeverity }>): PackHealthStatus {
  if (issues.some(issue => issue.severity === 'error')) return 'failed';
  if (issues.length > 0) return 'warning';
  return 'passed';
}

function readDataJsonRecord(...segments: string[]): JsonRecord | undefined {
  try {
    const parsed = JSON.parse(readFileSync(path.join(getKbRoot(), ...segments), 'utf8')) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isProductionMaterialPack(value: unknown): value is ProductionMaterialPack {
  if (!isRecord(value)) return false;
  const template = value.material_template;
  return Boolean(
    typeof value.video_type === 'string'
    && typeof value.label === 'string'
    && isRecord(template)
    && isStringArray(template.required_fields)
    && (!('prompt_layers' in template) || isStringArray(template.prompt_layers))
    && isStringArray(template.minimum_viable_story_gate)
    && isStringArray(template.script_ready_gate)
    && isStringArray(template.production_ready_gate)
    && isStringArray(template.supplement_questions)
    && Array.isArray(value.sample_entries),
  );
}

function loadProductionMaterialPacks(): ProductionMaterialPack[] {
  const file = readDataJsonRecord('production-packs', 'video-type-material-supplement-packs.json');
  return Array.isArray(file?.packs)
    ? file.packs.filter(isProductionMaterialPack)
    : [];
}

function gateItemsForStage(pack: ProductionMaterialPack, stage: MaterialSufficiencyStage): string[] {
  if (stage === 'minimum_viable_story') return pack.material_template.minimum_viable_story_gate;
  if (stage === 'script_ready') return pack.material_template.script_ready_gate;
  return pack.material_template.production_ready_gate;
}

function getProductionMaterialPackHealthReport(): ProductionMaterialPackHealthReport {
  const requiredVideoTypes = [...HIGH_FREQUENCY_PRODUCTION_VIDEO_TYPES];
  const coreVideoTypes = [...CORE_PRODUCTION_READY_VIDEO_TYPES];
  const packs = loadProductionMaterialPacks();
  const packsByType = new Map(packs.map(pack => [pack.video_type, pack]));
  const issues: ProductionMaterialPackHealthIssue[] = [];

  for (const videoType of requiredVideoTypes) {
    if (!packsByType.has(videoType)) {
      issues.push({
        severity: 'error',
        issue_type: 'missing_required_video_type',
        video_type: videoType,
        message: `缺少 ${videoType} 的 ProductionMaterialPack。`,
      });
    }
  }

  const summaries = packs
    .map((pack): ProductionMaterialPackHealthSummary => {
      const fields = pack.material_template.required_fields;
      const unknownRequiredFields = fields.filter(fieldId => !KNOWN_PRODUCTION_MATERIAL_FIELD_IDS.has(fieldId));
      const duplicateRequiredFields = duplicateStrings(fields);
      const promptLayerCount = pack.material_template.prompt_layers?.length ?? 0;
      const sampleEntryCount = pack.sample_entries.length;
      const supplementQuestionCount = pack.material_template.supplement_questions.length;
      const gateItemCounts: Record<MaterialSufficiencyStage, number> = {
        minimum_viable_story: pack.material_template.minimum_viable_story_gate.length,
        script_ready: pack.material_template.script_ready_gate.length,
        production_ready: pack.material_template.production_ready_gate.length,
      };
      const beforeIssueCount = issues.length;

      if (unknownRequiredFields.length > 0) {
        issues.push({
          severity: 'error',
          issue_type: 'unknown_required_field',
          video_type: pack.video_type,
          message: `${pack.video_type} 包含 readiness 未识别的 required_fields。`,
          details: unknownRequiredFields,
        });
      }
      if (duplicateRequiredFields.length > 0) {
        issues.push({
          severity: 'error',
          issue_type: 'duplicate_required_field',
          video_type: pack.video_type,
          message: `${pack.video_type} 包含重复 required_fields。`,
          details: duplicateRequiredFields,
        });
      }
      if (promptLayerCount < 4) {
        issues.push({
          severity: 'warning',
          issue_type: 'underfilled_prompt_layers',
          video_type: pack.video_type,
          message: `${pack.video_type} prompt layers 低于 4 层。`,
          details: [`current=${promptLayerCount}`],
        });
      }
      if (supplementQuestionCount < 4) {
        issues.push({
          severity: 'warning',
          issue_type: 'underfilled_supplement_questions',
          video_type: pack.video_type,
          message: `${pack.video_type} 补充问题低于 4 条。`,
          details: [`current=${supplementQuestionCount}`],
        });
      }

      const minimumSampleEntries = coreVideoTypes.includes(pack.video_type as typeof CORE_PRODUCTION_READY_VIDEO_TYPES[number])
        ? 10
        : requiredVideoTypes.includes(pack.video_type as typeof HIGH_FREQUENCY_PRODUCTION_VIDEO_TYPES[number])
          ? 2
          : 1;
      if (sampleEntryCount < minimumSampleEntries) {
        issues.push({
          severity: 'warning',
          issue_type: 'underfilled_sample_entries',
          video_type: pack.video_type,
          message: `${pack.video_type} 样板条目低于 ${minimumSampleEntries} 条。`,
          details: [`current=${sampleEntryCount}`],
        });
      }

      for (const stage of PACK_HEALTH_GATE_STAGES) {
        const gateItemCount = gateItemsForStage(pack, stage).length;
        if (gateItemCount < 3) {
          issues.push({
            severity: 'warning',
            issue_type: 'underfilled_gate_items',
            video_type: pack.video_type,
            message: `${pack.video_type} ${stage} gate 低于 3 条。`,
            details: [`current=${gateItemCount}`],
          });
        }
      }

      return {
        video_type: pack.video_type,
        label: pack.label,
        required_field_count: fields.length,
        prompt_layer_count: promptLayerCount,
        sample_entry_count: sampleEntryCount,
        supplement_question_count: supplementQuestionCount,
        gate_item_counts: gateItemCounts,
        unknown_required_fields: unknownRequiredFields,
        duplicate_required_fields: duplicateRequiredFields,
        status: healthStatusFromIssues(issues.slice(beforeIssueCount)),
      };
    })
    .sort((a, b) => a.video_type.localeCompare(b.video_type));

  return {
    schema_version: 'production-material-pack-health/v1',
    generated_at: new Date().toISOString(),
    status: healthStatusFromIssues(issues),
    pack_count: packs.length,
    required_video_types: requiredVideoTypes,
    covered_required_video_types: requiredVideoTypes.filter(videoType => packsByType.has(videoType)),
    missing_required_video_types: requiredVideoTypes.filter(videoType => !packsByType.has(videoType)),
    core_video_types: coreVideoTypes,
    production_ready_core_video_types: coreVideoTypes.filter(videoType =>
      summaries.some(summary => summary.video_type === videoType && summary.status === 'passed'),
    ),
    high_frequency_video_types: [...HIGH_FREQUENCY_PRODUCTION_VIDEO_TYPES],
    packs: summaries,
    issues,
  };
}

function isDomainPackSeed(value: unknown): value is DomainPackSeed {
  if (!isRecord(value)) return false;
  return Boolean(
    typeof value.entry_name === 'string'
    && typeof value.domain === 'string'
    && typeof value.role === 'string'
    && isStringArray(value.asset_usage)
    && isStringArray(value.trigger_words)
    && (!('production_prompts' in value) || isStringArray(value.production_prompts))
    && (!('review_boundaries' in value) || isStringArray(value.review_boundaries)),
  );
}

function loadDomainPackFile(): { domain_id: string; version: string; seeds: DomainPackSeed[] } {
  const file = readDataJsonRecord('domain-packs', 'china-culture.json') as DomainPackFile | undefined;
  return {
    domain_id: typeof file?.domain_id === 'string' ? file.domain_id : 'china_culture',
    version: typeof file?.version === 'string' ? file.version : 'unknown',
    seeds: Array.isArray(file?.entries) ? file.entries.filter(isDomainPackSeed) : [],
  };
}

function getDomainPackProductionHealthReport(): DomainPackProductionHealthReport {
  const file = loadDomainPackFile();
  const seedByName = new Map(file.seeds.map(seed => [seed.entry_name, seed]));
  const issues: DomainPackProductionHealthIssue[] = [];
  const duplicateNames = duplicateStrings(file.seeds.map(seed => seed.entry_name));

  for (const entryName of duplicateNames) {
    issues.push({
      severity: 'error',
      issue_type: 'duplicate_entry_name',
      entry_name: entryName,
      message: `Domain Pack 存在重复 entry_name：${entryName}。`,
    });
  }

  const summaries: DomainPackProductionHealthSummary[] = [];
  for (const contract of REQUIRED_PRODUCTION_DOMAIN_PACKS) {
    const seed = seedByName.get(contract.entry_name);
    if (!seed) {
      issues.push({
        severity: 'error',
        issue_type: 'missing_required_pack',
        pack_id: contract.pack_id,
        entry_name: contract.entry_name,
        message: `缺少生产提示 Domain Pack：${contract.entry_name}。`,
      });
      continue;
    }

    const beforeIssueCount = issues.length;
    const triggerWordCount = seed.trigger_words.length;
    const productionPromptCount = seed.production_prompts?.filter(item => item.trim()).length ?? 0;
    const reviewBoundaryCount = seed.review_boundaries?.filter(item => item.trim()).length ?? 0;
    const missingAssetUsage = contract.expected_asset_usage.filter(usage => !seed.asset_usage.includes(usage));

    if (triggerWordCount < 8) {
      issues.push({
        severity: 'warning',
        issue_type: 'underfilled_trigger_words',
        pack_id: contract.pack_id,
        entry_name: seed.entry_name,
        message: `${seed.entry_name} trigger_words 低于 8 个。`,
        details: [`current=${triggerWordCount}`],
      });
    }
    if (productionPromptCount < 3) {
      issues.push({
        severity: 'warning',
        issue_type: 'underfilled_production_prompts',
        pack_id: contract.pack_id,
        entry_name: seed.entry_name,
        message: `${seed.entry_name} production_prompts 低于 3 条。`,
        details: [`current=${productionPromptCount}`],
      });
    }
    if (reviewBoundaryCount < 3) {
      issues.push({
        severity: 'warning',
        issue_type: 'underfilled_review_boundaries',
        pack_id: contract.pack_id,
        entry_name: seed.entry_name,
        message: `${seed.entry_name} review_boundaries 低于 3 条。`,
        details: [`current=${reviewBoundaryCount}`],
      });
    }
    if (missingAssetUsage.length > 0) {
      issues.push({
        severity: 'warning',
        issue_type: 'missing_expected_asset_usage',
        pack_id: contract.pack_id,
        entry_name: seed.entry_name,
        message: `${seed.entry_name} 缺少预期 asset_usage 标记。`,
        details: missingAssetUsage,
      });
    }

    summaries.push({
      pack_id: contract.pack_id,
      entry_name: seed.entry_name,
      domain: seed.domain,
      role: seed.role,
      trigger_word_count: triggerWordCount,
      production_prompt_count: productionPromptCount,
      review_boundary_count: reviewBoundaryCount,
      asset_usage: seed.asset_usage,
      status: healthStatusFromIssues(issues.slice(beforeIssueCount)),
    });
  }

  const coveredRequiredPackIds = summaries.map(summary => summary.pack_id);
  const missingRequiredPackIds = REQUIRED_PRODUCTION_DOMAIN_PACKS
    .filter(contract => !coveredRequiredPackIds.includes(contract.pack_id))
    .map(contract => contract.pack_id);
  const productionReadyPackIds = summaries
    .filter(summary => summary.status === 'passed')
    .map(summary => summary.pack_id);

  return {
    schema_version: 'domain-pack-production-health/v1',
    generated_at: new Date().toISOString(),
    domain_id: file.domain_id,
    version: file.version,
    status: healthStatusFromIssues(issues),
    pack_count: file.seeds.length,
    production_pack_count: file.seeds.filter(seed =>
      Boolean(seed.production_prompts?.some(item => item.trim()))
      || Boolean(seed.review_boundaries?.some(item => item.trim())),
    ).length,
    required_pack_ids: REQUIRED_PRODUCTION_DOMAIN_PACKS.map(contract => contract.pack_id),
    covered_required_pack_ids: coveredRequiredPackIds,
    missing_required_pack_ids: missingRequiredPackIds,
    production_ready_pack_ids: productionReadyPackIds,
    packs: summaries,
    issues,
  };
}

function missingContractCount(health: StoryAgentGeneratedHealthReport, contract: string, scope?: HealthScope): number {
  return health.items.filter(item =>
    (!scope || item.scope === scope) && item.missing_contracts.includes(contract),
  ).length;
}

function generatedArtifactsLane(health: StoryAgentGeneratedHealthReport): StoryAgentMvpLane {
  const summary = health.summary;
  const total = summary.total_target_count;
  const openCount = summary.planned_count + summary.production_gap_count + summary.interrupted_count;
  const status: MvpStatus = total === 0 || summary.interrupted_count > 0
    ? 'blocked'
    : openCount > 0
      ? 'needs_action'
      : 'ready';
  return {
    key: 'generated_artifacts',
    label: 'Generated artifacts',
    status,
    score: total === 0 ? 0 : clampScore((summary.ready_count / total) * 100 - summary.interrupted_count * 20),
    detail: total === 0 ? 'No generated Story Agent targets were found.' : `${summary.ready_count}/${total} generated targets are ready.`,
    evidence: [
      `targets=${total}`,
      `ready=${summary.ready_count}`,
      `planned=${summary.planned_count}`,
      `production_gap=${summary.production_gap_count}`,
      `interrupted=${summary.interrupted_count}`,
    ],
    next_action: total === 0
      ? 'Generate or import at least one Story Agent target.'
      : summary.interrupted_count > 0
        ? 'Repair interrupted current story/version or episode references.'
        : openCount > 0
          ? 'Finish planned or production_gap targets before GEARS signoff.'
          : undefined,
  };
}

function p0p1GovernanceActionCount(plan: StoryAgentGeneratedGovernancePlan): number {
  return plan.actions.filter(action => action.priority === 'P0' || action.priority === 'P1').length;
}

function generatedGovernanceLane(plan: StoryAgentGeneratedGovernancePlan): StoryAgentMvpLane {
  const total = plan.summary.source_total_target_count;
  const p0p1Actions = p0p1GovernanceActionCount(plan);
  return {
    key: 'generated_governance',
    label: 'Generated governance',
    status: total === 0 ? 'blocked' : 'ready',
    score: total === 0 ? 0 : 100,
    detail: total === 0
      ? 'Generated governance is implemented, but no generated targets were found to audit.'
      : `Generated health, governance plan, dry-run manifest, project_id targeting, Web/MCP surfaces, and read-only safety gates are complete across ${total} targets.`,
    evidence: [
      `schema=${plan.schema_version}`,
      `plan_status=${plan.status}`,
      `action_buckets=${plan.actions.length}`,
      `p0_p1_action_buckets=${p0p1Actions}`,
      `ready_signoff_candidates=${plan.summary.ready_gears_signoff_candidate_count}`,
      'dry_run_manifest=available',
      'controlled_writes=blocked',
    ],
    next_action: total === 0
      ? 'Generate or import Story Agent targets so governance can produce an audit plan.'
      : undefined,
  };
}

function productionMaterialPackLane(report: ProductionMaterialPackHealthReport): StoryAgentMvpLane {
  const errorCount = report.issues.filter(issue => issue.severity === 'error').length;
  const warningCount = report.issues.filter(issue => issue.severity === 'warning').length;
  const status: MvpStatus = report.status === 'failed'
    ? 'blocked'
    : report.status === 'warning'
      ? 'needs_action'
      : 'ready';
  const coreReady = report.production_ready_core_video_types.length;
  const coreTotal = report.core_video_types.length;
  return {
    key: 'production_material_packs',
    label: 'Production material packs',
    status,
    score: clampScore(100 - errorCount * 25 - warningCount * 8 - report.missing_required_video_types.length * 20),
    detail: report.status === 'passed'
      ? `${coreReady}/${coreTotal} core production video types pass template health gates; ${report.covered_required_video_types.length}/${report.required_video_types.length} high-frequency video types are covered.`
      : `${errorCount} errors and ${warningCount} warnings in production material pack health gates.`,
    evidence: [
      `schema=${report.schema_version}`,
      `pack_status=${report.status}`,
      `pack_count=${report.pack_count}`,
      `required_video_types=${report.required_video_types.length}`,
      `covered_required_video_types=${report.covered_required_video_types.length}`,
      `missing_required_video_types=${report.missing_required_video_types.length}`,
      `core_ready=${coreReady}/${coreTotal}`,
      `issues=${report.issues.length}`,
      `errors=${errorCount}`,
      `warnings=${warningCount}`,
    ],
    next_action: report.status === 'failed'
      ? 'Fix missing production packs, unknown required_fields, or duplicate fields before Story Agent generation sign-off.'
      : report.status === 'warning'
        ? 'Top up underfilled prompt layers, gate items, supplement questions, or sample entries before expanding production volume.'
        : undefined,
  };
}

function domainPackLane(report: DomainPackProductionHealthReport): StoryAgentMvpLane {
  const errorCount = report.issues.filter(issue => issue.severity === 'error').length;
  const warningCount = report.issues.filter(issue => issue.severity === 'warning').length;
  const status: MvpStatus = report.status === 'failed'
    ? 'blocked'
    : report.status === 'warning'
      ? 'needs_action'
      : 'ready';
  return {
    key: 'domain_packs',
    label: 'Domain packs',
    status,
    score: clampScore(100 - errorCount * 25 - warningCount * 8 - report.missing_required_pack_ids.length * 20),
    detail: report.status === 'passed'
      ? `${report.production_ready_pack_ids.length}/${report.required_pack_ids.length} production Domain Packs pass prompt and review-boundary gates.`
      : `${errorCount} errors and ${warningCount} warnings in Domain Pack production gates.`,
    evidence: [
      `schema=${report.schema_version}`,
      `domain_id=${report.domain_id}`,
      `version=${report.version}`,
      `pack_status=${report.status}`,
      `pack_count=${report.pack_count}`,
      `production_pack_count=${report.production_pack_count}`,
      `required_pack_count=${report.required_pack_ids.length}`,
      `covered_required_pack_count=${report.covered_required_pack_ids.length}`,
      `missing_required_pack_count=${report.missing_required_pack_ids.length}`,
      `production_ready_pack_count=${report.production_ready_pack_ids.length}`,
      `issues=${report.issues.length}`,
      `errors=${errorCount}`,
      `warnings=${warningCount}`,
    ],
    next_action: report.status === 'failed'
      ? 'Restore missing production Domain Packs before Story Agent prompt package sign-off.'
      : report.status === 'warning'
        ? 'Top up production_prompts, review_boundaries, trigger_words, or asset_usage coverage for production Domain Packs.'
        : undefined,
  };
}

function storyQualityLane(health: StoryAgentGeneratedHealthReport): StoryAgentMvpLane {
  const summary = health.summary;
  const storyCount = summary.scanned_story_project_count;
  const missingCurrent = summary.missing_current_story_count;
  const missingScene = summary.missing_scene_breakdown_count;
  const missingQuality = summary.missing_quality_count;
  const status: MvpStatus = missingCurrent > 0
    ? 'blocked'
    : missingScene > 0 || missingQuality > 0 || storyCount === 0
      ? 'needs_action'
      : 'ready';
  return {
    key: 'story_quality',
    label: 'Story quality',
    status,
    score: storyCount === 0 ? 35 : clampScore(100 - missingCurrent * 40 - missingScene * 25 - missingQuality * 20),
    detail: storyCount === 0
      ? 'No standalone story project has measurable scene and quality evidence.'
      : `${storyCount - Math.min(storyCount, missingScene + missingQuality)}/${storyCount} story projects have quality evidence.`,
    evidence: [
      `story_projects=${storyCount}`,
      `missing_current_story=${missingCurrent}`,
      `missing_scene_breakdown=${missingScene}`,
      `missing_quality=${missingQuality}`,
    ],
    next_action: missingCurrent > 0
      ? 'Restore interrupted story pointers before repair automation.'
      : missingScene > 0 || missingQuality > 0
        ? 'Run Story Agent validation/repair to regenerate scene_breakdown and quality_report.'
        : storyCount === 0
          ? 'Generate a story project for quality validation.'
          : undefined,
  };
}

function repairLoopLane(portfolio: ProductionReadinessPortfolioReport): StoryAgentMvpLane {
  const summary = portfolio.summary;
  const total = summary.total_target_count;
  const readyAutomation = summary.ready_automation_step_count;
  const status: MvpStatus = total === 0 || (summary.blocker_count > 0 && readyAutomation === 0)
    ? 'blocked'
    : readyAutomation > 0 || summary.needs_action_count > 0
      ? 'needs_action'
      : 'ready';
  return {
    key: 'repair_loop',
    label: 'Repair loop',
    status,
    score: total === 0
      ? 0
      : clampScore(100 - summary.blocker_count * 25 - summary.warning_count * 8 - summary.needs_action_count * 10),
    detail: total === 0
      ? 'No readiness target is available for safe Story Agent automation.'
      : `${readyAutomation} safe Story Agent automation steps are ready.`,
    evidence: [
      `portfolio_targets=${total}`,
      `ready_automation_steps=${readyAutomation}`,
      `blockers=${summary.blocker_count}`,
      `warnings=${summary.warning_count}`,
    ],
    next_action: total === 0
      ? 'Create a readiness target from generated output.'
      : readyAutomation > 0
        ? 'Run production readiness automation in dry-run before execution.'
        : summary.blocker_count > 0
          ? 'Resolve blocking readiness issues before automation.'
          : undefined,
  };
}

function deliveryContractLane(health: StoryAgentGeneratedHealthReport): StoryAgentMvpLane {
  const summary = health.summary;
  const total = summary.total_target_count;
  const missingStoryDelivery = missingContractCount(health, 'delivery_contract', 'story_project');
  const missingSeriesDelivery = summary.series_missing_delivery_count;
  const missingHardContract = summary.missing_scene_breakdown_count + summary.missing_gears_segments_count;
  const openDeliveryCount = missingHardContract + missingStoryDelivery + missingSeriesDelivery;
  const status: MvpStatus = total === 0 || missingHardContract > 0
    ? 'blocked'
    : openDeliveryCount > 0
      ? 'needs_action'
      : 'ready';
  return {
    key: 'delivery_contract',
    label: 'Delivery contract',
    status,
    score: total === 0
      ? 0
      : clampScore(100 - missingHardContract * 30 - missingStoryDelivery * 16 - missingSeriesDelivery * 12),
    detail: openDeliveryCount === 0
      ? 'GEARS delivery contracts are present for scanned targets.'
      : `${openDeliveryCount} targets still need delivery closure.`,
    evidence: [
      `missing_scene_breakdown=${summary.missing_scene_breakdown_count}`,
      `missing_gears_segments=${summary.missing_gears_segments_count}`,
      `missing_story_delivery=${missingStoryDelivery}`,
      `series_missing_delivery=${missingSeriesDelivery}`,
    ],
    next_action: missingHardContract > 0
      ? 'Regenerate scene_breakdown and gears_segments before GEARS export.'
      : openDeliveryCount > 0
        ? 'Export GEARS delivery and production-board contracts.'
        : undefined,
  };
}

function productionCommandLane(portfolio: ProductionReadinessPortfolioReport): StoryAgentMvpLane {
  const summary = portfolio.summary;
  const total = summary.total_target_count;
  const externalOrManual = summary.external_automation_step_count + summary.manual_automation_step_count;
  const status: MvpStatus = portfolio.errors.length > 0 || summary.blocked_count > 0
    ? 'blocked'
    : total === 0
      ? 'blocked'
      : summary.needs_action_count > 0 || summary.ready_automation_step_count > 0 || externalOrManual > 0
        ? 'needs_action'
        : 'ready';
  return {
    key: 'production_command',
    label: 'Production command',
    status,
    score: total === 0
      ? 0
      : clampScore(100 - summary.blocked_count * 35 - summary.needs_action_count * 15 - externalOrManual * 4 - portfolio.errors.length * 20),
    detail: total === 0 ? 'No production readiness targets were found.' : `${summary.ready_count}/${total} targets are production-command ready.`,
    evidence: [
      `readiness_targets=${total}`,
      `ready=${summary.ready_count}`,
      `needs_action=${summary.needs_action_count}`,
      `blocked=${summary.blocked_count}`,
      `external_or_manual_steps=${externalOrManual}`,
      `read_errors=${portfolio.errors.length}`,
    ],
    next_action: portfolio.errors.length > 0
      ? 'Fix readiness read errors before signoff.'
      : summary.blocked_count > 0
        ? 'Clear blocked readiness targets before GEARS worker acceptance.'
        : summary.ready_automation_step_count > 0
          ? 'Run safe Story Agent readiness automation.'
          : externalOrManual > 0
            ? 'Send external/manual steps to GEARS v2 or operator review.'
            : undefined,
  };
}

function overallStatus(lanes: StoryAgentMvpLane[]): MvpStatus {
  if (lanes.some(lane => lane.status === 'blocked')) return 'blocked';
  if (lanes.some(lane => lane.status === 'needs_action')) return 'needs_action';
  return 'ready';
}

function priorityTargets(
  health: StoryAgentGeneratedHealthReport,
  portfolio: ProductionReadinessPortfolioReport,
): StoryAgentMvpPriorityTarget[] {
  return [
    ...health.items.slice(0, 8).map((item): StoryAgentMvpPriorityTarget => ({
      scope: item.scope,
      project_id: item.project_id,
      title: item.title,
      status: item.status,
      priority_score: item.risk_score,
      primary_action: item.recommended_actions[0],
      evidence: [
        'source=generated_health',
        `risk=${item.risk_score}`,
        `issues=${item.issue_count}`,
        `missing=${item.missing_contracts.join(',') || 'none'}`,
        ...item.evidence.slice(0, 3),
      ],
    })),
    ...portfolio.items.slice(0, 8).map((item): StoryAgentMvpPriorityTarget => ({
      scope: item.scope,
      project_id: item.project_id,
      title: item.title,
      status: item.status,
      priority_score: item.priority_score,
      primary_action: item.primary_action_label,
      evidence: [
        'source=production_portfolio',
        `score=${item.score}`,
        `blockers=${item.blocker_count}`,
        `warnings=${item.warning_count}`,
        `ready_automation_steps=${item.ready_automation_step_count}`,
      ],
    })),
  ]
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 12);
}

function progressSlices(
  lanes: StoryAgentMvpLane[],
  health: StoryAgentGeneratedHealthReport,
  governancePlan: StoryAgentGeneratedGovernancePlan,
  productionMaterialPackHealth: ProductionMaterialPackHealthReport,
  domainPackHealth: DomainPackProductionHealthReport,
  portfolio: ProductionReadinessPortfolioReport,
): StoryAgentMvpProgressSlice[] {
  const endpointConfigured = Boolean(process.env.GEARS_API_BASE_URL?.trim());
  const hasLocalContractBlocker = lanes.some(lane => lane.status === 'blocked');
  const externalOrManual = portfolio.summary.external_automation_step_count
    + portfolio.summary.manual_automation_step_count;
  return [
    {
      key: 'generated_governance',
      label: 'Generated governance command surface',
      status: governancePlan.summary.source_total_target_count === 0 ? 'blocked' : 'ready',
      percent: governancePlan.summary.source_total_target_count === 0 ? 0 : 100,
      detail: 'Generated health, read-only governance plan, dry-run manifest, project_id targeting, Web UI, MCP tools, and no-write safety policy are complete.',
      evidence: [
        'implementation_progress=100',
        `source_targets=${governancePlan.summary.source_total_target_count}`,
        `plan_status=${governancePlan.status}`,
        `action_buckets=${governancePlan.actions.length}`,
        `p0_p1_action_buckets=${p0p1GovernanceActionCount(governancePlan)}`,
        `relink_candidates=${governancePlan.summary.series_relink_candidate_count}`,
        `archive_or_rebuild_candidates=${governancePlan.summary.series_archive_or_rebuild_candidate_count}`,
        `story_ref_repair_candidates=${governancePlan.summary.story_ref_repair_candidate_count}`,
        `ready_signoff_candidates=${governancePlan.summary.ready_gears_signoff_candidate_count}`,
        'dry_run_false=blocked',
      ],
    },
    {
      key: 'mcp_story_agent_loop',
      label: 'MCP Story Agent loop',
      status: 'ready',
      percent: 100,
      detail: 'MCP now exposes the full Story Agent command loop: knowledge context, blueprint, validation, delivery export, repair prompt, controlled version write, generated governance, readiness automation, MVP status, and GEARS evidence signoff.',
      evidence: [
        'implementation_progress=100',
        `tool_count=${MCP_STORY_AGENT_LOOP_TOOLS.length}`,
        `tools=${MCP_STORY_AGENT_LOOP_TOOLS.join(',')}`,
        'safe_write=kb_update_project_version',
        'repair_apply_requires_repaired_story_json=true',
        'media_execution=gears_v2',
      ],
    },
    {
      key: 'content_command_layer',
      label: 'Content and production command layer',
      status: 'ready',
      percent: 100,
      detail: 'The china-culture-kb content and production command layer is complete: story generation, quality/repair, versioning, delivery contracts, generated governance, readiness automation, MVP status, and worker evidence signoff command surfaces are implemented.',
      evidence: [
        'implementation_progress=100',
        `mvp_lanes=${lanes.length}`,
        `generated_targets=${health.summary.total_target_count}`,
        `generated_governance_progress=${governancePlan.summary.source_total_target_count === 0 ? 0 : 100}`,
        `production_material_pack_status=${productionMaterialPackHealth.status}`,
        `production_material_core_ready=${productionMaterialPackHealth.production_ready_core_video_types.length}/${productionMaterialPackHealth.core_video_types.length}`,
        `production_material_pack_issues=${productionMaterialPackHealth.issues.length}`,
        `domain_pack_status=${domainPackHealth.status}`,
        `domain_pack_ready=${domainPackHealth.production_ready_pack_ids.length}/${domainPackHealth.required_pack_ids.length}`,
        `domain_pack_issues=${domainPackHealth.issues.length}`,
        `readiness_targets=${portfolio.summary.total_target_count}`,
        `local_contract_blocked=${hasLocalContractBlocker}`,
        'local_target_health_tracked_by=lanes',
        'real_media_execution=gears_v2',
      ],
    },
    {
      key: 'production_delivery_contract',
      label: 'Production Board / Delivery Contract',
      status: 'ready',
      percent: 100,
      detail: 'Production Board and GEARS delivery command surfaces are complete: scene and segment contracts, delivery packages, Seedance prompt packages, Seedance asset upload checklists, production-board exports, ledgers, readiness automation, review/retry plans, and evidence signoff are implemented while real media execution remains in GEARS v2.',
      evidence: [
        'implementation_progress=100',
        `surface_count=${PRODUCTION_DELIVERY_CONTRACT_SURFACES.length}`,
        `surfaces=${PRODUCTION_DELIVERY_CONTRACT_SURFACES.join(',')}`,
        'local_target_health_tracked_by=delivery_contract_lane',
        'real_media_execution=gears_v2',
      ],
    },
    {
      key: 'gears_end_to_end_acceptance',
      label: 'GEARS v2 end-to-end acceptance',
      status: 'needs_action',
      percent: 95,
      detail: 'The remaining work is reachable GEARS v2 submit/status/callback smoke plus large-project worker pressure sign-off with real worker responses.',
      blocker: endpointConfigured ? 'gears_worker_signoff_evidence_pending' : 'real_gears_v2_endpoint_not_configured',
      evidence: [
        'acceptance_progress=95',
        `gears_endpoint_configured=${endpointConfigured}`,
        `external_or_manual_steps=${externalOrManual}`,
        'requires=run-gears-worker-acceptance.sh',
        'requires=worker_evidence_signoff',
      ],
    },
  ];
}

function buildMarkdown(report: Omit<StoryAgentMvpStatusReport, 'markdown'>): string {
  return [
    '# MCP Story Agent MVP Status',
    '',
    `> generatedAt: ${report.generated_at}`,
    `> status: ${report.status}`,
    `> score: ${report.score}`,
    '',
    '## Summary',
    '',
    `- generated targets: ${report.summary.generated_target_count}`,
    `- readiness targets: ${report.summary.readiness_target_count}`,
    `- safe automation steps: ${report.summary.ready_automation_step_count}`,
    `- GEARS/operator steps: ${report.summary.external_or_manual_step_count}`,
    `- generated governance actions: ${report.summary.generated_governance_action_count}`,
    `- generated governance P0/P1 actions: ${report.summary.generated_governance_p0_p1_action_count}`,
    `- generated governance ready signoff candidates: ${report.summary.generated_governance_ready_signoff_candidate_count}`,
    `- production material pack health: ${report.summary.production_material_pack_status}`,
    `- production material packs: ${report.summary.production_material_pack_count}`,
    `- production material pack issues: ${report.summary.production_material_pack_issue_count}`,
    `- production material core ready: ${report.summary.production_material_pack_core_ready_count}/${report.summary.production_material_pack_core_total_count}`,
    `- domain pack health: ${report.summary.domain_pack_status}`,
    `- domain packs: ${report.summary.domain_pack_count}`,
    `- domain pack issues: ${report.summary.domain_pack_issue_count}`,
    `- production domain packs ready: ${report.summary.production_domain_pack_ready_count}/${report.summary.production_domain_pack_required_count}`,
    `- Story Agent command surface: ${report.summary.story_agent_command_surface_status} · ${report.summary.story_agent_command_surface_percent}%`,
    `- MCP Story Agent tools: ${report.summary.mcp_story_agent_tool_count}`,
    `- MCP Story Agent loop: ${report.summary.mcp_story_agent_loop_percent}%`,
    `- content command layer: ${report.summary.content_command_layer_percent}%`,
    `- production delivery contract: ${report.summary.production_delivery_contract_percent}%`,
    `- production delivery contract surfaces: ${report.summary.production_delivery_contract_surface_count}`,
    '',
    '## Lanes',
    '',
    ...report.lanes.map(lane => `- ${lane.status} · ${lane.score}/100 · ${lane.label}: ${lane.detail}`),
    '',
    '## Progress Split',
    '',
    ...report.progress.map(slice =>
      `- ${slice.status} · ${slice.percent}% · ${slice.label}: ${slice.detail}${slice.blocker ? ` blocker=${slice.blocker}` : ''}`,
    ),
    '',
    '## Priority Targets',
    '',
    ...(report.priority_targets.length
      ? report.priority_targets.map(target =>
        `- P${target.priority_score} · ${target.scope} · ${target.status} · ${target.project_id} · ${target.primary_action ?? 'no action'}`,
      )
      : ['- none']),
    '',
    '## Next Actions',
    '',
    ...(report.next_actions.length ? report.next_actions.map(action => `- ${action}`) : ['- none']),
    '',
    '## Notes',
    '',
    ...report.notes.map(note => `- ${note}`),
  ].join('\n');
}

export async function getStoryAgentMvpStatus(
  input: GetStoryAgentMvpStatusInput = {},
): Promise<StoryAgentMvpStatusReport> {
  const [generatedHealth, generatedGovernancePlan, productionMaterialPackHealth, domainPackHealth, productionPortfolio] = await Promise.all([
    getStoryAgentGeneratedHealth({ limit: input.generated_limit ?? 100, include_markdown: false }),
    getStoryAgentGeneratedGovernancePlan({ limit: input.generated_limit ?? 100, include_markdown: false }),
    Promise.resolve(getProductionMaterialPackHealthReport()),
    Promise.resolve(getDomainPackProductionHealthReport()),
    getProductionReadinessPortfolio({ limit: input.portfolio_limit ?? 100, include_markdown: false }),
  ]);
  const lanes = [
    generatedArtifactsLane(generatedHealth),
    generatedGovernanceLane(generatedGovernancePlan),
    productionMaterialPackLane(productionMaterialPackHealth),
    domainPackLane(domainPackHealth),
    storyQualityLane(generatedHealth),
    repairLoopLane(productionPortfolio),
    deliveryContractLane(generatedHealth),
    productionCommandLane(productionPortfolio),
  ];
  const status = overallStatus(lanes);
  const externalOrManual = productionPortfolio.summary.external_automation_step_count
    + productionPortfolio.summary.manual_automation_step_count;
  const progress = progressSlices(
    lanes,
    generatedHealth,
    generatedGovernancePlan,
    productionMaterialPackHealth,
    domainPackHealth,
    productionPortfolio,
  );
  const base: Omit<StoryAgentMvpStatusReport, 'markdown'> = {
    schema_version: 'mcp-story-agent-mvp-status/v1',
    generated_at: new Date().toISOString(),
    status,
    score: clampScore(lanes.reduce((sum, lane) => sum + lane.score, 0) / Math.max(1, lanes.length)),
    summary: {
      generated_target_count: generatedHealth.summary.total_target_count,
      generated_ready_count: generatedHealth.summary.ready_count,
      generated_planned_count: generatedHealth.summary.planned_count,
      generated_production_gap_count: generatedHealth.summary.production_gap_count,
      generated_interrupted_count: generatedHealth.summary.interrupted_count,
      readiness_target_count: productionPortfolio.summary.total_target_count,
      readiness_ready_count: productionPortfolio.summary.ready_count,
      readiness_needs_action_count: productionPortfolio.summary.needs_action_count,
      readiness_blocked_count: productionPortfolio.summary.blocked_count,
      ready_automation_step_count: productionPortfolio.summary.ready_automation_step_count,
      external_or_manual_step_count: externalOrManual,
      blocker_count: productionPortfolio.summary.blocker_count,
      warning_count: productionPortfolio.summary.warning_count,
      generated_governance_action_count: generatedGovernancePlan.actions.length,
      generated_governance_p0_p1_action_count: p0p1GovernanceActionCount(generatedGovernancePlan),
      generated_governance_ready_signoff_candidate_count: generatedGovernancePlan.summary.ready_gears_signoff_candidate_count,
      production_material_pack_status: productionMaterialPackHealth.status,
      production_material_pack_count: productionMaterialPackHealth.pack_count,
      production_material_pack_issue_count: productionMaterialPackHealth.issues.length,
      production_material_pack_core_ready_count: productionMaterialPackHealth.production_ready_core_video_types.length,
      production_material_pack_core_total_count: productionMaterialPackHealth.core_video_types.length,
      domain_pack_status: domainPackHealth.status,
      domain_pack_count: domainPackHealth.pack_count,
      domain_pack_issue_count: domainPackHealth.issues.length,
      production_domain_pack_ready_count: domainPackHealth.production_ready_pack_ids.length,
      production_domain_pack_required_count: domainPackHealth.required_pack_ids.length,
      story_agent_command_surface_status: 'ready',
      story_agent_command_surface_percent: 100,
      mcp_story_agent_tool_count: MCP_STORY_AGENT_LOOP_TOOLS.length,
      mcp_story_agent_loop_percent: 100,
      content_command_layer_percent: 100,
      production_delivery_contract_percent: 100,
      production_delivery_contract_surface_count: PRODUCTION_DELIVERY_CONTRACT_SURFACES.length,
    },
    lanes,
    progress,
    priority_targets: priorityTargets(generatedHealth, productionPortfolio),
    next_actions: uniqueStrings([
      ...lanes.filter(lane => lane.status !== 'ready').map(lane => lane.next_action),
      ...generatedHealth.items.slice(0, 5).map(item => item.recommended_actions[0]),
      ...productionPortfolio.items.slice(0, 5).map(item => item.primary_action_label),
    ]).slice(0, 10),
    notes: [
      'MCP MVP status is read-only and combines local generated health with production readiness portfolio.',
      'Generated governance command surface is complete at 100%: health scan, governance plan, dry-run manifest, project_id targeting, Web/MCP exports, and no-write safety gates are available.',
      'Production material pack health is now a MCP Story Agent MVP lane: core and high-frequency video types must keep mapped required_fields, prompt layers, gate items, supplement questions, and sample-entry coverage before production sign-off.',
      'Domain Pack production health is now a MCP Story Agent MVP lane: required production prompt packs must keep trigger words, production prompts, review boundaries, and asset usage coverage before prompt package sign-off.',
      'MCP Story Agent loop is complete at 100%: read-only context, blueprint, validation, delivery, repair prompt, controlled versioning, generated governance, readiness automation, MVP status, and GEARS evidence signoff are all exposed as tools.',
      'Content and production command layer is complete at 100% inside china-culture-kb; generated target health and real GEARS endpoint acceptance remain separate status surfaces.',
      'Production Board / Delivery Contract command surface is complete at 100%; Seedance asset upload checklists now make external reference-material handoff explicit, and missing per-target exports remain tracked by the delivery_contract lane and generated governance plan.',
      'Story Agent command surface is signed off at 100% inside this repository; generated inventory health and GEARS worker acceptance remain separate follow-up lanes.',
      'Progress is split: Story Agent content/production command layer is tracked separately from real GEARS v2 endpoint acceptance.',
      'The remaining 5% belongs to reachable GEARS v2 submit/status/callback smoke and large-project worker pressure sign-off, not in-repo media execution.',
      'Use this before GEARS worker evidence signoff to decide whether Story Agent contracts need repair.',
      'china-culture-kb remains the content and production command layer; media execution stays in GEARS v2.',
    ],
    generated_health: generatedHealth,
    generated_governance_plan: generatedGovernancePlan,
    production_material_pack_health: productionMaterialPackHealth,
    domain_pack_health: domainPackHealth,
    production_portfolio: productionPortfolio,
  };
  return input.include_markdown === false ? base : { ...base, markdown: buildMarkdown(base) };
}
