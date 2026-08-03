import {
  StoryKnowledgeEvidenceOverlayV1Schema,
  StoryKnowledgePreparationV1Schema,
} from '@shared/schemas.js';
import type {
  EntryDetail,
  StoryKnowledgeContractV1,
  StoryKnowledgePreparationStatusV1,
  StoryKnowledgePreparationV1,
} from '@shared/types.js';
import {
  adaptLegacyChinaCultureEntryToStoryKnowledgeContract,
} from './story-knowledge-contract-service.js';
import {
  assembleStoryKnowledgeContractWithEvidenceOverlay,
} from './story-knowledge-evidence-overlay-service.js';

export function resolveStoryKnowledgePreparation(
  entry: EntryDetail,
  evidenceOverlay?: unknown,
): StoryKnowledgePreparationV1 {
  const baseContract = adaptLegacyChinaCultureEntryToStoryKnowledgeContract(entry).contract;
  if (evidenceOverlay === undefined) {
    return buildPreparation(
      'base_contract_only',
      baseContract,
      ['evidence overlay was not provided'],
    );
  }

  const overlayResult = StoryKnowledgeEvidenceOverlayV1Schema.safeParse(evidenceOverlay);
  if (!overlayResult.success) {
    return buildPreparation(
      'overlay_incompatible',
      baseContract,
      uniqueText(overlayResult.error.issues.map(issue => {
        const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
        return `${path}${issue.message}`;
      })),
      extractOverlayId(evidenceOverlay),
    );
  }
  const overlay = overlayResult.data;
  if (overlay.signoff.status === 'rejected') {
    return buildPreparation(
      'overlay_rejected',
      baseContract,
      [overlay.signoff.reason],
      overlay.overlay_id,
    );
  }

  try {
    const assembly = assembleStoryKnowledgeContractWithEvidenceOverlay(
      baseContract,
      overlay,
    );
    return buildPreparation(
      overlay.signoff.status === 'approved'
        ? 'overlay_approved_read_only'
        : 'overlay_pending',
      assembly.contract,
      [],
      overlay.overlay_id,
    );
  } catch (error) {
    return buildPreparation(
      'overlay_incompatible',
      baseContract,
      [error instanceof Error ? error.message : String(error)],
      overlay.overlay_id,
    );
  }
}

function buildPreparation(
  status: StoryKnowledgePreparationStatusV1,
  contract: StoryKnowledgeContractV1,
  issues: string[],
  overlayId?: string,
): StoryKnowledgePreparationV1 {
  const result = StoryKnowledgePreparationV1Schema.parse({
    schema_version: 'story-knowledge-preparation/v1',
    status,
    entry_name: contract.source_entry.name,
    ...(overlayId ? { overlay_id: overlayId } : {}),
    contract,
    issues: uniqueText(issues),
    report: {
      source_count: contract.sources.length,
      claim_count: contract.claims.length,
      human_verified_source_count: contract.sources.filter(
        source => source.verification_status === 'human_verified',
      ).length,
      critical_fact_ready_count: countCriticalFactReady(contract),
      missing_material_count: contract.missing_material.length,
    },
    boundary: {
      read_only_preparation: true,
      consumed_by_blueprint: false,
      consumed_by_prompt: false,
      consumed_by_fallback: false,
      persistence_allowed: false,
      generation_output_changed: false,
      machine_validation_only: true,
      real_human_review_credit_granted: false,
    },
  });
  return deepFreeze(result);
}

function countCriticalFactReady(contract: StoryKnowledgeContractV1): number {
  const sourceById = new Map(contract.sources.map(source => [source.source_ref_id, source]));
  return contract.claims.filter(claim => (
    claim.claim_type === 'critical_fact'
    && claim.certainty === 'verified'
    && claim.usage === 'fact'
    && claim.source_ref_ids.some(sourceRefId => {
      const source = sourceById.get(sourceRefId);
      return source?.verification_status === 'human_verified'
        && (source.grade === 'A' || source.grade === 'B');
    })
  )).length;
}

function extractOverlayId(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const overlayId = (input as { overlay_id?: unknown }).overlay_id;
  return typeof overlayId === 'string' && /^[a-z][a-z0-9_-]{2,127}$/.test(overlayId)
    ? overlayId
    : undefined;
}

function uniqueText(values: readonly string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}
