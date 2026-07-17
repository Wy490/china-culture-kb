import {
  ErrorCodes,
  type ApiResponse,
  type EntryDetail,
  type EntryMatchResult,
  type EntrySearchResult,
  type StoryGenerateRequest,
  type StoryGenerateResult,
  type GearsSegment,
  type StoryDomainSafetyReport,
  type StoryDomainSafetyValidationInput,
  type StoryPlanResult,
} from '@shared/types.js';
import type { ProductResourceOwnership } from '@shared/product-access.js';
import type {
  DomainEntryTypeDescriptor,
  DomainGenerationTypeDescriptor,
} from './types.js';

const DOMAIN_ID_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
const GENERATION_TYPE_ID_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export interface DomainEntrySearchParams {
  keywords?: string;
  type?: string;
  [field: string]: unknown;
}

export interface DomainEntryMatchParams {
  query: string;
  limit: number;
  [field: string]: unknown;
}

export interface DomainStoryPlanParams {
  entry_name: string;
  original_user_query?: string;
}

export interface DomainStoryGenerateOptions {
  access_control?: ProductResourceOwnership;
  transform_story_before_validation_and_persistence?: (
    story: StoryGenerateResult,
  ) => StoryGenerateResult | Promise<StoryGenerateResult>;
}

export interface DomainGearsConstraintInput {
  story: StoryGenerateResult;
  segment: GearsSegment;
}

export interface DomainStoryRevisionGuidance {
  readonly schema_version: 'story-domain-revision-guidance/v1';
  readonly writer_role: string;
  readonly source_boundary_rules: readonly string[];
  readonly human_review_requirement: string;
}

export interface DomainStorySupplementGuidance {
  readonly schema_version: 'story-domain-supplement-guidance/v1';
  readonly candidate_kind: 'domain_knowledge_candidate' | 'project_material_candidate';
  readonly candidate_heading: string;
  readonly writeback_draft_heading?: string;
  readonly review_rules: readonly string[];
  readonly human_review_requirement: string;
}

export interface DomainProductionMaterialGuidance {
  readonly schema_version: 'story-domain-production-material-guidance/v1';
  readonly audience_level_default: string;
  readonly audience_level_comprehension_note: string;
  readonly learner_profile_default: string;
  readonly learner_profile_foundation_note: string;
  readonly heritage_or_craft_type_label: string;
  readonly heritage_or_craft_type_category: string;
  readonly heritage_or_craft_type_review_note: string;
  readonly speaker_position_role: string;
  readonly speaker_position_boundary_note: string;
  readonly speaker_position_expression_note: string;
  readonly project_name_review_note: string;
  readonly forbidden_claims_rule: string;
  readonly forbidden_claims_default_boundary: string;
  readonly documentation_assets_intro: string;
  readonly documentation_assets_missing_source_note: string;
  readonly documentation_assets_rights_note: string;
  readonly source_cues_review_note: string;
  readonly source_cues_missing_source_note: string;
  readonly witness_or_expert_roles: string;
  readonly witness_or_expert_role_note: string;
  readonly what_must_not_be_claimed_rule: string;
  readonly shot_prompt_style_boundary: string;
  readonly parent_teacher_extension_question: string;
  readonly single_shot_acceptance_boundary: string;
  readonly knowledge_outline_progression: string;
  readonly fact_boundary_card_rule: string;
  readonly fact_boundary_card_fallback: string;
  readonly source_cues_entry_label: string;
  readonly source_cues_confirmed_label: string;
  readonly source_cues_unverified_label: string;
  readonly source_cues_default_review_scope: string;
  readonly parent_teacher_review_boundary: string;
  readonly share_trigger_frame: string;
  readonly share_trigger_reason: string;
  readonly diagram_or_caption_boundary: string;
  readonly comment_prompt_focus: string;
  readonly comment_prompt_boundary: string;
  readonly misconception_boundary_rule: string;
  readonly misconception_boundary_fallback: string;
}

export interface DomainKnowledgeWritebackPlan {
  readonly schema_version: 'story-domain-knowledge-writeback-plan/v1';
  readonly domain_id: string;
  readonly target_kind: 'domain_document' | 'none';
  readonly eligible: boolean;
  readonly target_region?: string;
  readonly suggested_file_path?: string;
  readonly suggested_section_heading?: string;
  readonly blockers: readonly string[];
  readonly requires_human_review: true;
  readonly direct_writeback_allowed: false;
  readonly writeback_performed: false;
  readonly real_credit_granted: false;
}

export type DomainPackCapability =
  | 'entry_search'
  | 'entry_detail'
  | 'entry_match'
  | 'story_plan'
  | 'story_generate'
  | 'type_catalog'
  | 'story_safety'
  | 'story_revision'
  | 'story_supplement'
  | 'production_material_draft'
  | 'knowledge_writeback'
  | 'gears_mapping';

export interface DomainPackMeta {
  readonly schema_version: 'story-agent-domain-pack/v1';
  readonly domain_id: string;
  readonly display_name: string;
  readonly description: string;
  readonly version: string;
  readonly capabilities: readonly DomainPackCapability[];
}

export interface DomainPack {
  readonly meta: DomainPackMeta;
  readonly entryTypes: readonly DomainEntryTypeDescriptor[];
  readonly generationTypes: readonly DomainGenerationTypeDescriptor[];
  readonly revisionGuidance: DomainStoryRevisionGuidance;
  readonly supplementGuidance: DomainStorySupplementGuidance;
  readonly productionMaterialGuidance: DomainProductionMaterialGuidance;
  searchEntries(params: DomainEntrySearchParams): Promise<ApiResponse<EntrySearchResult[]>>;
  getEntryDetail(name: string): Promise<ApiResponse<EntryDetail>>;
  matchEntries(params: DomainEntryMatchParams): Promise<ApiResponse<EntryMatchResult>>;
  planStory(params: DomainStoryPlanParams): Promise<ApiResponse<StoryPlanResult>>;
  generateStory(
    request: StoryGenerateRequest,
    options?: DomainStoryGenerateOptions,
  ): Promise<ApiResponse<StoryGenerateResult>>;
  validateStoryContent(input: StoryDomainSafetyValidationInput): StoryDomainSafetyReport;
  planKnowledgeWriteback(story: StoryGenerateResult): DomainKnowledgeWritebackPlan;
  mapGearsConstraints(input: DomainGearsConstraintInput): string[];
}

export class DomainPackNotFoundError extends Error {
  readonly code = ErrorCodes.DOMAIN_PACK_NOT_FOUND;

  constructor(domain: string) {
    super(`Domain pack \"${domain}\" is not registered`);
    this.name = 'DomainPackNotFoundError';
  }
}

export class DomainPackRegistrationError extends Error {
  readonly code = ErrorCodes.DOMAIN_PACK_REGISTRY_INVALID;

  constructor(message: string) {
    super(message);
    this.name = 'DomainPackRegistrationError';
  }
}

export class DomainPackRegistry {
  private readonly packs = new Map<string, DomainPack>();

  register(pack: DomainPack): void {
    if (!pack || typeof pack !== 'object' || !pack.meta || typeof pack.meta !== 'object') {
      throw new DomainPackRegistrationError('Domain pack metadata is required');
    }
    const {
      schema_version: schemaVersion,
      domain_id: domainId,
      display_name: displayName,
      description,
      version,
      capabilities,
    } = pack.meta;
    if (schemaVersion !== 'story-agent-domain-pack/v1') {
      throw new DomainPackRegistrationError(`Domain pack "${String(domainId)}" has an unsupported schema version`);
    }
    if (typeof domainId !== 'string') {
      throw new DomainPackRegistrationError('Domain pack identifier must be a string');
    }
    if (!DOMAIN_ID_PATTERN.test(domainId)) {
      throw new DomainPackRegistrationError(`Invalid domain pack identifier: \"${domainId}\"`);
    }
    if (
      typeof displayName !== 'string'
      || typeof description !== 'string'
      || typeof version !== 'string'
      || !displayName.trim()
      || !description.trim()
      || !/^\d+\.\d+\.\d+$/.test(version)
    ) {
      throw new DomainPackRegistrationError(`Domain pack \"${domainId}\" has invalid metadata`);
    }
    if (!Array.isArray(capabilities)) {
      throw new DomainPackRegistrationError(`Domain pack \"${domainId}\" capabilities must be an array`);
    }
    const capabilitySet = new Set(capabilities);
    if (
      capabilitySet.size !== capabilities.length
      || capabilitySet.size !== 12
      || !capabilitySet.has('entry_search')
      || !capabilitySet.has('entry_detail')
      || !capabilitySet.has('entry_match')
      || !capabilitySet.has('story_plan')
      || !capabilitySet.has('story_generate')
      || !capabilitySet.has('type_catalog')
      || !capabilitySet.has('story_safety')
      || !capabilitySet.has('story_revision')
      || !capabilitySet.has('story_supplement')
      || !capabilitySet.has('production_material_draft')
      || !capabilitySet.has('knowledge_writeback')
      || !capabilitySet.has('gears_mapping')
    ) {
      throw new DomainPackRegistrationError(`Domain pack \"${domainId}\" has an invalid capability contract`);
    }
    const requiredMethods: ReadonlyArray<keyof DomainPack> = [
      'searchEntries',
      'getEntryDetail',
      'matchEntries',
      'planStory',
      'generateStory',
      'validateStoryContent',
      'planKnowledgeWriteback',
      'mapGearsConstraints',
    ];
    if (requiredMethods.some(method => typeof pack[method] !== 'function')) {
      throw new DomainPackRegistrationError(`Domain pack \"${domainId}\" does not implement every declared capability`);
    }
    if (!Array.isArray(pack.entryTypes) || !Array.isArray(pack.generationTypes)) {
      throw new DomainPackRegistrationError(`Domain pack \"${domainId}\" type catalogs must be arrays`);
    }
    if (
      !pack.revisionGuidance
      || pack.revisionGuidance.schema_version !== 'story-domain-revision-guidance/v1'
      || typeof pack.revisionGuidance.writer_role !== 'string'
      || !pack.revisionGuidance.writer_role.trim()
      || !Array.isArray(pack.revisionGuidance.source_boundary_rules)
      || pack.revisionGuidance.source_boundary_rules.length === 0
      || pack.revisionGuidance.source_boundary_rules.some(rule => typeof rule !== 'string' || !rule.trim())
      || typeof pack.revisionGuidance.human_review_requirement !== 'string'
      || !pack.revisionGuidance.human_review_requirement.trim()
    ) {
      throw new DomainPackRegistrationError(`Domain pack \"${domainId}\" has invalid story revision guidance`);
    }
    const supplementGuidance = pack.supplementGuidance;
    if (
      !supplementGuidance
      || supplementGuidance.schema_version !== 'story-domain-supplement-guidance/v1'
      || !['domain_knowledge_candidate', 'project_material_candidate'].includes(supplementGuidance.candidate_kind)
      || typeof supplementGuidance.candidate_heading !== 'string'
      || !supplementGuidance.candidate_heading.trim()
      || !Array.isArray(supplementGuidance.review_rules)
      || supplementGuidance.review_rules.length === 0
      || supplementGuidance.review_rules.some(rule => typeof rule !== 'string' || !rule.trim())
      || typeof supplementGuidance.human_review_requirement !== 'string'
      || !supplementGuidance.human_review_requirement.trim()
      || (
        supplementGuidance.candidate_kind === 'domain_knowledge_candidate'
        && (
          typeof supplementGuidance.writeback_draft_heading !== 'string'
          || !supplementGuidance.writeback_draft_heading.trim()
        )
      )
      || (
        supplementGuidance.candidate_kind === 'project_material_candidate'
        && supplementGuidance.writeback_draft_heading !== undefined
      )
    ) {
      throw new DomainPackRegistrationError(`Domain pack \"${domainId}\" has invalid story supplement guidance`);
    }
    const productionMaterialGuidance = pack.productionMaterialGuidance;
    if (
      !productionMaterialGuidance
      || productionMaterialGuidance.schema_version !== 'story-domain-production-material-guidance/v1'
      || typeof productionMaterialGuidance.audience_level_default !== 'string'
      || !productionMaterialGuidance.audience_level_default.trim()
      || typeof productionMaterialGuidance.audience_level_comprehension_note !== 'string'
      || !productionMaterialGuidance.audience_level_comprehension_note.trim()
      || typeof productionMaterialGuidance.learner_profile_default !== 'string'
      || !productionMaterialGuidance.learner_profile_default.trim()
      || typeof productionMaterialGuidance.learner_profile_foundation_note !== 'string'
      || !productionMaterialGuidance.learner_profile_foundation_note.trim()
      || typeof productionMaterialGuidance.heritage_or_craft_type_label !== 'string'
      || !productionMaterialGuidance.heritage_or_craft_type_label.trim()
      || typeof productionMaterialGuidance.heritage_or_craft_type_category !== 'string'
      || !productionMaterialGuidance.heritage_or_craft_type_category.trim()
      || typeof productionMaterialGuidance.heritage_or_craft_type_review_note !== 'string'
      || !productionMaterialGuidance.heritage_or_craft_type_review_note.trim()
      || typeof productionMaterialGuidance.speaker_position_role !== 'string'
      || !productionMaterialGuidance.speaker_position_role.trim()
      || typeof productionMaterialGuidance.speaker_position_boundary_note !== 'string'
      || !productionMaterialGuidance.speaker_position_boundary_note.trim()
      || typeof productionMaterialGuidance.speaker_position_expression_note !== 'string'
      || !productionMaterialGuidance.speaker_position_expression_note.trim()
      || typeof productionMaterialGuidance.project_name_review_note !== 'string'
      || !productionMaterialGuidance.project_name_review_note.trim()
      || typeof productionMaterialGuidance.forbidden_claims_rule !== 'string'
      || !productionMaterialGuidance.forbidden_claims_rule.trim()
      || typeof productionMaterialGuidance.forbidden_claims_default_boundary !== 'string'
      || !productionMaterialGuidance.forbidden_claims_default_boundary.trim()
      || typeof productionMaterialGuidance.documentation_assets_intro !== 'string'
      || !productionMaterialGuidance.documentation_assets_intro.trim()
      || typeof productionMaterialGuidance.documentation_assets_missing_source_note !== 'string'
      || !productionMaterialGuidance.documentation_assets_missing_source_note.trim()
      || typeof productionMaterialGuidance.documentation_assets_rights_note !== 'string'
      || !productionMaterialGuidance.documentation_assets_rights_note.trim()
      || typeof productionMaterialGuidance.source_cues_review_note !== 'string'
      || !productionMaterialGuidance.source_cues_review_note.trim()
      || typeof productionMaterialGuidance.source_cues_missing_source_note !== 'string'
      || !productionMaterialGuidance.source_cues_missing_source_note.trim()
      || typeof productionMaterialGuidance.witness_or_expert_roles !== 'string'
      || !productionMaterialGuidance.witness_or_expert_roles.trim()
      || typeof productionMaterialGuidance.witness_or_expert_role_note !== 'string'
      || !productionMaterialGuidance.witness_or_expert_role_note.trim()
      || typeof productionMaterialGuidance.what_must_not_be_claimed_rule !== 'string'
      || !productionMaterialGuidance.what_must_not_be_claimed_rule.trim()
      || typeof productionMaterialGuidance.shot_prompt_style_boundary !== 'string'
      || !productionMaterialGuidance.shot_prompt_style_boundary.trim()
      || typeof productionMaterialGuidance.parent_teacher_extension_question !== 'string'
      || !productionMaterialGuidance.parent_teacher_extension_question.trim()
      || typeof productionMaterialGuidance.single_shot_acceptance_boundary !== 'string'
      || !productionMaterialGuidance.single_shot_acceptance_boundary.trim()
      || typeof productionMaterialGuidance.knowledge_outline_progression !== 'string'
      || !productionMaterialGuidance.knowledge_outline_progression.trim()
      || typeof productionMaterialGuidance.fact_boundary_card_rule !== 'string'
      || !productionMaterialGuidance.fact_boundary_card_rule.trim()
      || typeof productionMaterialGuidance.fact_boundary_card_fallback !== 'string'
      || !productionMaterialGuidance.fact_boundary_card_fallback.trim()
      || typeof productionMaterialGuidance.source_cues_entry_label !== 'string'
      || !productionMaterialGuidance.source_cues_entry_label.trim()
      || typeof productionMaterialGuidance.source_cues_confirmed_label !== 'string'
      || !productionMaterialGuidance.source_cues_confirmed_label.trim()
      || typeof productionMaterialGuidance.source_cues_unverified_label !== 'string'
      || !productionMaterialGuidance.source_cues_unverified_label.trim()
      || typeof productionMaterialGuidance.source_cues_default_review_scope !== 'string'
      || !productionMaterialGuidance.source_cues_default_review_scope.trim()
      || typeof productionMaterialGuidance.parent_teacher_review_boundary !== 'string'
      || !productionMaterialGuidance.parent_teacher_review_boundary.trim()
      || typeof productionMaterialGuidance.share_trigger_frame !== 'string'
      || !productionMaterialGuidance.share_trigger_frame.trim()
      || typeof productionMaterialGuidance.share_trigger_reason !== 'string'
      || !productionMaterialGuidance.share_trigger_reason.trim()
      || typeof productionMaterialGuidance.diagram_or_caption_boundary !== 'string'
      || !productionMaterialGuidance.diagram_or_caption_boundary.trim()
      || typeof productionMaterialGuidance.comment_prompt_focus !== 'string'
      || !productionMaterialGuidance.comment_prompt_focus.trim()
      || typeof productionMaterialGuidance.comment_prompt_boundary !== 'string'
      || !productionMaterialGuidance.comment_prompt_boundary.trim()
      || typeof productionMaterialGuidance.misconception_boundary_rule !== 'string'
      || !productionMaterialGuidance.misconception_boundary_rule.trim()
      || typeof productionMaterialGuidance.misconception_boundary_fallback !== 'string'
      || !productionMaterialGuidance.misconception_boundary_fallback.trim()
    ) {
      throw new DomainPackRegistrationError(`Domain pack \"${domainId}\" has invalid production material guidance`);
    }
    if (
      pack.entryTypes.length === 0
      || pack.entryTypes.some(type => (
        !type
        || typeof type.name !== 'string'
        || typeof type.description !== 'string'
        || !type.name.trim()
        || !type.description.trim()
        || !Array.isArray(type.recommended_video_types)
        || !Array.isArray(type.recommended_generation_types)
        || !Array.isArray(type.recommended_presentation_styles)
        || type.recommended_video_types.some((id: unknown) => typeof id !== 'string' || !id.trim())
        || type.recommended_generation_types.some((id: unknown) => typeof id !== 'string' || !id.trim())
        || type.recommended_presentation_styles.some((id: unknown) => typeof id !== 'string' || !id.trim())
      ))
      || new Set(pack.entryTypes.map(type => type.name.trim())).size !== pack.entryTypes.length
      || pack.generationTypes.length === 0
      || pack.generationTypes.some(type => (
        !type
        || typeof type.id !== 'string'
        || typeof type.group !== 'string'
        || typeof type.label !== 'string'
        || typeof type.description !== 'string'
        || typeof type.default_presentation_style !== 'string'
        || !GENERATION_TYPE_ID_PATTERN.test(type.id)
        || !type.group.trim()
        || !type.label.trim()
        || !type.description.trim()
        || !type.default_presentation_style.trim()
        || (typeof type.default_duration !== 'string' && typeof type.default_duration !== 'number')
        || (typeof type.default_duration === 'number' && type.default_duration <= 0)
        || (typeof type.default_duration === 'string' && !type.default_duration.trim())
        || !Array.isArray(type.compatible_entry_types)
        || type.compatible_entry_types.some((name: unknown) => typeof name !== 'string' || !name.trim())
      ))
      || new Set(pack.generationTypes.map(type => type.id.trim())).size !== pack.generationTypes.length
    ) {
      throw new DomainPackRegistrationError(`Domain pack \"${domainId}\" has an invalid type catalog`);
    }
    if (this.packs.has(domainId)) {
      throw new DomainPackRegistrationError(`Domain pack \"${domainId}\" is already registered`);
    }
    this.packs.set(domainId, pack);
  }

  require(domain: string): DomainPack {
    const pack = this.packs.get(domain);
    if (!pack) {
      throw new DomainPackNotFoundError(domain);
    }
    return pack;
  }

  list(): readonly string[] {
    return [...this.packs.keys()].sort();
  }

  describe(): readonly DomainPackDescriptor[] {
    return [...this.packs.values()]
      .map(pack => ({
        meta: { ...pack.meta, capabilities: [...pack.meta.capabilities] },
        entry_type_count: pack.entryTypes.length,
        generation_type_count: pack.generationTypes.length,
      }))
      .sort((left, right) => left.meta.domain_id.localeCompare(right.meta.domain_id));
  }
}

export interface DomainPackDescriptor {
  meta: DomainPackMeta;
  entry_type_count: number;
  generation_type_count: number;
}
