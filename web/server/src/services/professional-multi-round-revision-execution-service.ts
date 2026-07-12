import type { ProfessionalCoverageCategory } from './professional-multi-round-revision-service.js';
import type { ProfessionalTextPackageField, VideoType } from '@shared/types.js';

export interface MultiRoundRevisionProjectSpec {
  benchmark_id: string;
  video_type: VideoType;
  source_entry: string;
  status: string;
  verified_revision_round_count: number;
  professional_passed: false;
}

export interface MultiRoundRevisionSpecRegistry {
  schema_version: 'all-format-professional-multi-round-revision-specs/v1';
  projects: MultiRoundRevisionProjectSpec[];
}

export interface MultiRoundRevisionExecutionReadiness {
  real_project_ids: Partial<Record<string, string>>;
  initial_package_paths: Partial<Record<string, string>>;
  real_model_or_human_author_authorization_reference: string;
  revision_budget_reference: string;
  writer_editor_id: string;
  director_id: string;
  fact_culture_reviewer_id: string;
  table_read_schedule_reference: string;
}

export interface MultiRoundRevisionPlannedRound {
  round_number: 1 | 2;
  primary_categories: ProfessionalCoverageCategory[];
  required_inputs: string[];
  required_outputs: string[];
  mandatory_rebuild_sections: ProfessionalTextPackageField[];
}

export interface MultiRoundRevisionExecutionProject {
  benchmark_id: string;
  video_type: VideoType;
  source_entry: string;
  real_project_id: string;
  initial_package_path: string;
  planned_rounds: MultiRoundRevisionPlannedRound[];
  table_read_roles: Array<{
    role: 'writer_editor' | 'director' | 'fact_culture_reviewer';
    reviewer_id: string;
    required: true;
  }>;
  blockers: string[];
  status: 'blocked' | 'ready_for_round_1';
  completed_verified_round_count: 0;
  professional_passed: false;
}

export interface MultiRoundRevisionExecutionManifest {
  schema_version: 'professional-multi-round-revision-execution-manifest/v1';
  generated_at: string;
  source_registry_schema_version: string;
  policy: {
    required_round_count_per_project: 2;
    fixture_or_simulation_counts_as_execution: false;
    prepared_or_ready_counts_as_completed_revision: false;
    signed_human_review_required_for_professional_pass: true;
  };
  summary: {
    project_spec_count: number;
    covered_video_type_count: number;
    planned_revision_round_count: number;
    blocked_project_count: number;
    ready_for_round_1_project_count: number;
    completed_two_round_verified_project_count: 0;
    recorded_verified_revision_round_count: 0;
    professional_pass_count: 0;
  };
  execution_requirements: {
    real_model_or_human_author_authorization_reference: string;
    revision_budget_reference: string;
    table_read_schedule_reference: string;
  };
  projects: MultiRoundRevisionExecutionProject[];
}

const FOCUS: Record<VideoType, [ProfessionalCoverageCategory[], ProfessionalCoverageCategory[]]> = {
  character_story: [['structure', 'character_or_information'], ['scene', 'dialogue_or_narration', 'fact_and_culture']],
  historical_drama: [['structure', 'fact_and_culture'], ['character_or_information', 'scene', 'dialogue_or_narration']],
  legend_story: [['structure', 'character_or_information'], ['dialogue_or_narration', 'pacing', 'fact_and_culture']],
  children_story: [['character_or_information', 'scene'], ['dialogue_or_narration', 'pacing', 'fact_and_culture']],
  ai_comic_drama: [['structure', 'scene'], ['character_or_information', 'dialogue_or_narration', 'pacing']],
  culture_promo: [['structure', 'fact_and_culture'], ['scene', 'dialogue_or_narration', 'pacing']],
  heritage_promo: [['scene', 'fact_and_culture'], ['character_or_information', 'pacing', 'dialogue_or_narration']],
  city_brand_promo: [['structure', 'scene'], ['character_or_information', 'pacing', 'fact_and_culture']],
  social_short: [['structure', 'pacing'], ['scene', 'dialogue_or_narration', 'fact_and_culture']],
  documentary_short: [['fact_and_culture', 'structure'], ['character_or_information', 'scene', 'dialogue_or_narration']],
  explainer_video: [['structure', 'character_or_information'], ['scene', 'dialogue_or_narration', 'fact_and_culture']],
  lecture_video: [['structure', 'fact_and_culture'], ['character_or_information', 'dialogue_or_narration', 'pacing']],
  education_training: [['structure', 'character_or_information'], ['scene', 'pacing', 'fact_and_culture']],
  scene_short: [['structure', 'scene'], ['pacing', 'dialogue_or_narration', 'fact_and_culture']],
  landscape_mood: [['scene', 'pacing'], ['dialogue_or_narration', 'fact_and_culture']],
};

const ROUND_INPUTS = [
  'schema_valid_professional_text_package',
  'automatic_coverage_action_set',
  'open_table_read_feedback',
  'verified_evidence_dossier',
  'authorized_model_or_human_author',
];

const ROUND_OUTPUTS = [
  'revised_professional_text_package',
  'before_after_package_sha256',
  'quality_dimension_delta',
  'resolved_new_and_remaining_issue_ids',
  'table_read_feedback_resolution',
  'revision_provenance_and_cost_record',
];

const REBUILD_SECTIONS: ProfessionalTextPackageField[] = [
  'sequence_beats',
  'scene_breakdown',
  'director_text_plan',
  'delivery_text_package',
];

function nonEmpty(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function blockersForProject(
  spec: MultiRoundRevisionProjectSpec,
  readiness: MultiRoundRevisionExecutionReadiness,
): string[] {
  const blockers = [
    nonEmpty(readiness.real_project_ids[spec.benchmark_id]) ? '' : 'real_project_id_missing',
    nonEmpty(readiness.initial_package_paths[spec.benchmark_id]) ? '' : 'initial_professional_text_package_missing',
    nonEmpty(readiness.real_model_or_human_author_authorization_reference) ? '' : 'model_or_human_author_authorization_missing',
    nonEmpty(readiness.revision_budget_reference) ? '' : 'revision_budget_missing',
    nonEmpty(readiness.writer_editor_id) ? '' : 'writer_editor_assignment_missing',
    nonEmpty(readiness.director_id) ? '' : 'director_assignment_missing',
    nonEmpty(readiness.fact_culture_reviewer_id) ? '' : 'fact_culture_reviewer_assignment_missing',
    nonEmpty(readiness.table_read_schedule_reference) ? '' : 'table_read_schedule_missing',
  ].filter(Boolean);
  return blockers;
}

export function buildMultiRoundRevisionExecutionManifest(input: {
  registry: MultiRoundRevisionSpecRegistry;
  readiness?: Partial<MultiRoundRevisionExecutionReadiness>;
  now?: string;
}): MultiRoundRevisionExecutionManifest {
  if (input.registry.schema_version !== 'all-format-professional-multi-round-revision-specs/v1') {
    throw new Error('multi_round_revision_registry_schema_invalid');
  }
  if (input.registry.projects.length !== 15
    || new Set(input.registry.projects.map(project => project.video_type)).size !== 15) {
    throw new Error('multi_round_revision_registry_requires_all_15_video_types');
  }
  const readiness: MultiRoundRevisionExecutionReadiness = {
    real_project_ids: input.readiness?.real_project_ids ?? {},
    initial_package_paths: input.readiness?.initial_package_paths ?? {},
    real_model_or_human_author_authorization_reference: input.readiness?.real_model_or_human_author_authorization_reference ?? '',
    revision_budget_reference: input.readiness?.revision_budget_reference ?? '',
    writer_editor_id: input.readiness?.writer_editor_id ?? '',
    director_id: input.readiness?.director_id ?? '',
    fact_culture_reviewer_id: input.readiness?.fact_culture_reviewer_id ?? '',
    table_read_schedule_reference: input.readiness?.table_read_schedule_reference ?? '',
  };
  const projects = input.registry.projects.map(spec => {
    const blockers = blockersForProject(spec, readiness);
    const focus = FOCUS[spec.video_type];
    const plannedRounds: MultiRoundRevisionPlannedRound[] = [1, 2].map(roundNumber => ({
      round_number: roundNumber as 1 | 2,
      primary_categories: focus[roundNumber - 1],
      required_inputs: [...ROUND_INPUTS],
      required_outputs: [...ROUND_OUTPUTS],
      mandatory_rebuild_sections: [...REBUILD_SECTIONS],
    }));
    return {
      benchmark_id: spec.benchmark_id,
      video_type: spec.video_type,
      source_entry: spec.source_entry,
      real_project_id: readiness.real_project_ids[spec.benchmark_id] ?? '',
      initial_package_path: readiness.initial_package_paths[spec.benchmark_id] ?? '',
      planned_rounds: plannedRounds,
      table_read_roles: [
        { role: 'writer_editor' as const, reviewer_id: readiness.writer_editor_id, required: true as const },
        { role: 'director' as const, reviewer_id: readiness.director_id, required: true as const },
        { role: 'fact_culture_reviewer' as const, reviewer_id: readiness.fact_culture_reviewer_id, required: true as const },
      ],
      blockers,
      status: blockers.length > 0 ? 'blocked' as const : 'ready_for_round_1' as const,
      completed_verified_round_count: 0 as const,
      professional_passed: false as const,
    };
  });
  return {
    schema_version: 'professional-multi-round-revision-execution-manifest/v1',
    generated_at: input.now ?? new Date().toISOString(),
    source_registry_schema_version: input.registry.schema_version,
    policy: {
      required_round_count_per_project: 2,
      fixture_or_simulation_counts_as_execution: false,
      prepared_or_ready_counts_as_completed_revision: false,
      signed_human_review_required_for_professional_pass: true,
    },
    summary: {
      project_spec_count: projects.length,
      covered_video_type_count: new Set(projects.map(project => project.video_type)).size,
      planned_revision_round_count: projects.length * 2,
      blocked_project_count: projects.filter(project => project.status === 'blocked').length,
      ready_for_round_1_project_count: projects.filter(project => project.status === 'ready_for_round_1').length,
      completed_two_round_verified_project_count: 0,
      recorded_verified_revision_round_count: 0,
      professional_pass_count: 0,
    },
    execution_requirements: {
      real_model_or_human_author_authorization_reference: readiness.real_model_or_human_author_authorization_reference,
      revision_budget_reference: readiness.revision_budget_reference,
      table_read_schedule_reference: readiness.table_read_schedule_reference,
    },
    projects,
  };
}

export function validateMultiRoundRevisionExecutionManifest(
  manifest: MultiRoundRevisionExecutionManifest,
): string[] {
  const errors: string[] = [];
  if (manifest.schema_version !== 'professional-multi-round-revision-execution-manifest/v1') errors.push('schema_version_invalid');
  if (manifest.projects.length !== 15 || new Set(manifest.projects.map(project => project.video_type)).size !== 15) errors.push('video_type_coverage_invalid');
  if (manifest.projects.some(project => project.planned_rounds.length !== 2)) errors.push('two_round_plan_missing');
  if (manifest.projects.some(project => project.status === 'ready_for_round_1' && project.blockers.length > 0)) errors.push('ready_project_has_blockers');
  if (manifest.projects.some(project => project.status === 'blocked' && project.blockers.length === 0)) errors.push('blocked_project_without_blocker');
  if (manifest.projects.some(project => project.professional_passed !== false || project.completed_verified_round_count !== 0)) errors.push('prepared_project_false_credit');
  if (manifest.summary.completed_two_round_verified_project_count !== 0
    || manifest.summary.recorded_verified_revision_round_count !== 0
    || manifest.summary.professional_pass_count !== 0) errors.push('manifest_false_completion_credit');
  if (manifest.summary.planned_revision_round_count !== manifest.projects.length * 2) errors.push('planned_round_count_mismatch');
  return errors;
}
