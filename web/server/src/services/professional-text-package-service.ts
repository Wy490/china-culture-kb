import type {
  ProfessionalTextPackage,
  SupportedDuration,
  TruthMode,
  VideoType,
} from '@shared/types.js';
import { getGenreStoryProfile } from './genre-story-profiles.js';

export interface CreateProfessionalTextPackageSkeletonInput {
  video_type: VideoType;
  package_id?: string;
  story_id?: string;
  project_id?: string;
  target_duration?: SupportedDuration;
  target_audience?: string;
  platform?: string;
  communication_goal?: string;
  truth_mode?: TruthMode;
  now?: string;
}

export function createProfessionalTextPackageSkeleton(
  input: CreateProfessionalTextPackageSkeletonInput,
): ProfessionalTextPackage {
  const profile = getGenreStoryProfile(input.video_type);
  const contract = profile.professional_text_contract;
  const now = input.now ?? new Date().toISOString();
  const identity = input.story_id ?? input.project_id ?? `${input.video_type}-${now.replace(/[:.]/g, '-')}`;

  return {
    schema_version: 'professional-text-package/v1',
    package_id: input.package_id ?? `${identity}--professional-text`,
    story_id: input.story_id,
    project_id: input.project_id,
    video_type: input.video_type,
    status: 'skeleton',
    created_at: now,
    updated_at: now,
    contract_version: contract.schema_version,
    creative_brief: {
      target_audience: input.target_audience ?? '',
      platform: input.platform ?? '',
      target_duration: input.target_duration ?? '3分钟',
      communication_goal: input.communication_goal ?? '',
      production_goal: '',
      budget_assumptions: [],
      delivery_constraints: [],
    },
    research_and_evidence_dossier: {
      source_summary: '',
      evidence_items: [],
      unknowns: [],
      authorization_notes: [],
    },
    audience_promise: '',
    premise_or_core_question: '',
    theme_statement: '',
    truth_and_adaptation_contract: {
      truth_mode: input.truth_mode ?? profile.default_truth_mode,
      verified_facts: [],
      plausible_dramatizations: [],
      fictional_additions: [],
      unknown_or_forbidden_claims: [],
      required_disclaimers: [],
    },
    relationship_or_information_architecture: {
      mode: contract.architecture_mode,
      nodes: [],
      links: [],
    },
    structure_outline: {
      structure_name: '',
      opening: '',
      development: [],
      climax_or_key_turn: '',
      ending: '',
    },
    sequence_beats: [],
    scene_breakdown: [],
    full_text: '',
    dialogue_or_narration_pass: {
      mode: contract.architecture_mode === 'visual_mood' ? 'minimal_text' : 'mixed',
      voice_rules: [],
      polished_text: '',
      unresolved_issues: [],
    },
    director_text_plan: {
      visual_strategy: '',
      sound_strategy: '',
      rhythm_strategy: '',
      sequences: [],
    },
    continuity_ledger: {
      items: [],
      unresolved_conflicts: [],
    },
    quality_report: {
      status: 'not_evaluated',
      dimensions: Object.entries(contract.quality_dimension_weights).map(([dimensionId, weight]) => ({
        dimension_id: dimensionId as keyof typeof contract.quality_dimension_weights,
        weight,
        evidence: [],
        issues: [],
      })),
      hard_gate_failures: [],
      professional_passed: false,
      evaluator_notes: ['结构合法不等于专业质量通过；需完成真实文本、硬门槛、固定项目和真人评审。'],
    },
    coverage_report: {
      verdict: 'not_evaluated',
      strengths: [],
      structure_notes: [],
      character_or_information_notes: [],
      scene_notes: [],
      dialogue_or_narration_notes: [],
      pacing_notes: [],
      fact_and_culture_notes: [],
      production_notes: [],
      action_items: contract.required_deliverables.map(item => `待完成片型必交文本：${item}`),
    },
    revision_trace: [],
    delivery_text_package: {
      script_text: '',
      scene_units: [],
      gears_handoff_notes: [],
      seedance_handoff_notes: [],
      validation_notes: ['skeleton_only_not_professional_pass'],
    },
  };
}
