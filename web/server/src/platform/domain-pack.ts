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
}

export interface DomainGearsConstraintInput {
  story: StoryGenerateResult;
  segment: GearsSegment;
}

export type DomainPackCapability =
  | 'entry_search'
  | 'entry_detail'
  | 'entry_match'
  | 'story_plan'
  | 'story_generate'
  | 'type_catalog'
  | 'story_safety'
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
  searchEntries(params: DomainEntrySearchParams): Promise<ApiResponse<EntrySearchResult[]>>;
  getEntryDetail(name: string): Promise<ApiResponse<EntryDetail>>;
  matchEntries(params: DomainEntryMatchParams): Promise<ApiResponse<EntryMatchResult>>;
  planStory(params: DomainStoryPlanParams): Promise<ApiResponse<StoryPlanResult>>;
  generateStory(
    request: StoryGenerateRequest,
    options?: DomainStoryGenerateOptions,
  ): Promise<ApiResponse<StoryGenerateResult>>;
  validateStoryContent(input: StoryDomainSafetyValidationInput): StoryDomainSafetyReport;
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
      || capabilitySet.size !== 8
      || !capabilitySet.has('entry_search')
      || !capabilitySet.has('entry_detail')
      || !capabilitySet.has('entry_match')
      || !capabilitySet.has('story_plan')
      || !capabilitySet.has('story_generate')
      || !capabilitySet.has('type_catalog')
      || !capabilitySet.has('story_safety')
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
      'mapGearsConstraints',
    ];
    if (requiredMethods.some(method => typeof pack[method] !== 'function')) {
      throw new DomainPackRegistrationError(`Domain pack \"${domainId}\" does not implement every declared capability`);
    }
    if (!Array.isArray(pack.entryTypes) || !Array.isArray(pack.generationTypes)) {
      throw new DomainPackRegistrationError(`Domain pack \"${domainId}\" type catalogs must be arrays`);
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
