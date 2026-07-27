import type {
  PresentationStyle,
  ReferenceGenerationSourceTrace,
  ReferenceSimilarityDimension,
  ReferenceSimilarityEvidenceRecord,
  ReferenceSimilarityEvidenceTrace,
  ReferenceStylePackRecord,
  ReferenceSupplementProvenanceTrace,
  ReferenceTrace,
  StoryStructureType,
  VideoType,
} from '@shared/types.js';
import {
  getBenchmarkCard,
  getReferenceAnalysis,
  getReferenceSource,
  getReferenceSimilarityEvidence,
  getReferenceStylePack,
} from './reference-library-service.js';
import {
  verifyReferenceTextAnalysisCompositionProvenance,
} from './reference-text-analysis-draft-task-service.js';

export interface ReferenceGenerationStylePackContext {
  style_pack_id: string;
  name: string;
  source_reference_ids: string[];
  source_analysis_ids: string[];
  source_benchmark_ids: string[];
  source_references: ReferenceGenerationSourceTrace[];
  supplement_provenance_refs: ReferenceSupplementProvenanceTrace[];
  abstract_rules: string[];
  avoid_copying: string[];
  approved_by: string;
  approved_at: string;
}

export interface ReferenceGenerationContext {
  schema_version: 'reference-generation-context/v1';
  style_pack_ids: string[];
  style_packs: ReferenceGenerationStylePackContext[];
  source_references: ReferenceGenerationSourceTrace[];
  similarity_evidence_refs: ReferenceSimilarityEvidenceTrace[];
  reusable_principles: string[];
  avoid_copying: string[];
  knowledge_writeback_allowed: false;
  production_credit_eligible: false;
}

export interface ReferenceGenerationGateDetails {
  schema_version: 'story-reference-style-pack-gate/v1';
  status: 'blocked';
  issue_code:
    | 'invalid_style_pack_request'
    | 'duplicate_style_pack_id'
    | 'style_pack_unavailable'
    | 'incompatible_style_pack'
    | 'style_pack_provenance_invalid'
    | 'invalid_similarity_evidence_request'
    | 'similarity_evidence_unavailable'
    | 'similarity_evidence_incompatible';
  style_pack_id?: string;
  similarity_evidence_id?: string;
  requested_style_pack_ids: string[];
  requested_similarity_evidence_ids?: string[];
  incompatible_dimensions?: Array<
    'video_type' | 'presentation_style' | 'story_structure'
  >;
  reason: string;
}

export type ReferenceGenerationContextResolution =
  | {
      ok: true;
      context?: ReferenceGenerationContext;
      similarityEvidence: ReferenceSimilarityEvidenceRecord[];
    }
  | {
      ok: false;
      message: string;
      details: ReferenceGenerationGateDetails;
    };

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function sameMembers(left: string[], right: string[]): boolean {
  return left.length === right.length
    && left.every(value => right.includes(value));
}

function abstractRules(pack: ReferenceStylePackRecord): string[] {
  return unique([
    ...pack.reusable_principles,
    ...pack.structure_rules,
    ...pack.rhythm_rules,
    ...pack.scene_rules,
    ...pack.narration_rules,
    ...pack.dialogue_rules,
    ...pack.visual_rules,
    ...pack.ending_rules,
  ]);
}

function copyingBoundaries(pack: ReferenceStylePackRecord): string[] {
  return unique([
    ...pack.avoid_copying,
    ...pack.forbidden_patterns,
  ]);
}

function blocked(
  requestedStylePackIds: string[],
  issueCode: ReferenceGenerationGateDetails['issue_code'],
  reason: string,
  extra: Pick<
    ReferenceGenerationGateDetails,
    'style_pack_id' | 'incompatible_dimensions'
    | 'similarity_evidence_id' | 'requested_similarity_evidence_ids'
  > = {},
): ReferenceGenerationContextResolution {
  return {
    ok: false,
    message: 'Reference style pack cannot be applied to this generation request',
    details: {
      schema_version: 'story-reference-style-pack-gate/v1',
      status: 'blocked',
      issue_code: issueCode,
      requested_style_pack_ids: requestedStylePackIds,
      reason,
      ...extra,
    },
  };
}

async function verifyStylePackProvenance(input: {
  repoRoot: string;
  pack: ReferenceStylePackRecord;
}): Promise<{
  issue?: string;
  supplementProvenanceRefs: ReferenceSupplementProvenanceTrace[];
}> {
  const { repoRoot, pack } = input;
  const benchmarks = await Promise.all(
    pack.source_benchmark_ids.map(benchmarkId =>
      getBenchmarkCard({ repoRoot, benchmarkId })),
  );
  const benchmarkReferenceIds = unique(
    benchmarks.flatMap(benchmark => benchmark.reference_ids),
  );
  const benchmarkAnalysisIds = unique(
    benchmarks.flatMap(benchmark => benchmark.analysis_ids),
  );
  if (!sameMembers(pack.source_reference_ids, benchmarkReferenceIds)) {
    return {
      issue: 'style pack source_reference_ids do not match its approved benchmark cards',
      supplementProvenanceRefs: [],
    };
  }
  if (!sameMembers(pack.source_analysis_ids, benchmarkAnalysisIds)) {
    return {
      issue: 'style pack source_analysis_ids do not match its approved benchmark cards',
      supplementProvenanceRefs: [],
    };
  }

  const analyses = await Promise.all(
    pack.source_analysis_ids.map(analysisId =>
      getReferenceAnalysis({ repoRoot, analysisId })),
  );
  if (analyses.some(analysis => analysis.approval.status !== 'approved')) {
    return {
      issue: 'every source analysis must remain approved at generation time',
      supplementProvenanceRefs: [],
    };
  }
  if (analyses.some(
    analysis => !pack.source_reference_ids.includes(analysis.reference_id),
  )) {
    return {
      issue: 'a source analysis points outside the style pack reference set',
      supplementProvenanceRefs: [],
    };
  }
  const provenance = await Promise.all(
    analyses
      .filter(analysis => (
        analysis.analysis_type === 'text'
        && analysis.schema_version === 'reference-analysis-record/v2'
      ))
      .map(analysis => verifyReferenceTextAnalysisCompositionProvenance({
        repoRoot,
        analysisId: analysis.analysis_id,
      })),
  );
  await Promise.all(
    pack.source_reference_ids.map(referenceId =>
      getReferenceSource({ repoRoot, referenceId })),
  );
  return {
    supplementProvenanceRefs: provenance.flatMap(item =>
      item.supplement_provenance ? [item.supplement_provenance] : []),
  };
}

export async function resolveReferenceGenerationContext(input: {
  repoRoot: string;
  stylePackIds?: string[];
  similarityEvidenceIds?: string[];
  videoType: VideoType;
  presentationStyle: PresentationStyle;
  storyStructure: StoryStructureType;
}): Promise<ReferenceGenerationContextResolution> {
  const requestedStylePackIds = (input.stylePackIds ?? [])
    .map(stylePackId => stylePackId.trim());
  const requestedSimilarityEvidenceIds = (input.similarityEvidenceIds ?? [])
    .map(evidenceId => evidenceId.trim());
  if (
    requestedSimilarityEvidenceIds.length > 20
    || requestedSimilarityEvidenceIds.some(evidenceId => evidenceId.length === 0)
    || unique(requestedSimilarityEvidenceIds).length
      !== requestedSimilarityEvidenceIds.length
    || (
      requestedSimilarityEvidenceIds.length > 0
      && requestedStylePackIds.length === 0
    )
  ) {
    return blocked(
      requestedStylePackIds,
      'invalid_similarity_evidence_request',
      'reference_similarity_evidence_ids must be unique, contain at most 20 IDs, and require at least one style_pack_id',
      { requested_similarity_evidence_ids: requestedSimilarityEvidenceIds },
    );
  }
  if (requestedStylePackIds.length === 0) {
    return { ok: true, similarityEvidence: [] };
  }
  if (
    requestedStylePackIds.length > 20
    || requestedStylePackIds.some(stylePackId => stylePackId.length === 0)
  ) {
    return blocked(
      requestedStylePackIds,
      'invalid_style_pack_request',
      'style_pack_ids must contain 1 to 20 non-empty IDs',
    );
  }
  if (unique(requestedStylePackIds).length !== requestedStylePackIds.length) {
    return blocked(
      requestedStylePackIds,
      'duplicate_style_pack_id',
      'style_pack_ids must be unique',
    );
  }

  const resolvedPacks: ReferenceGenerationStylePackContext[] = [];
  for (const stylePackId of requestedStylePackIds) {
    let pack: ReferenceStylePackRecord;
    try {
      pack = await getReferenceStylePack({
        repoRoot: input.repoRoot,
        stylePackId,
      });
    } catch (error) {
      return blocked(
        requestedStylePackIds,
        'style_pack_unavailable',
        error instanceof Error ? error.message : String(error),
        { style_pack_id: stylePackId },
      );
    }

    const incompatibleDimensions: NonNullable<
      ReferenceGenerationGateDetails['incompatible_dimensions']
    > = [];
    if (!pack.compatible_video_types.includes(input.videoType)) {
      incompatibleDimensions.push('video_type');
    }
    if (!pack.compatible_presentation_styles.includes(input.presentationStyle)) {
      incompatibleDimensions.push('presentation_style');
    }
    if (!pack.compatible_story_structures.includes(input.storyStructure)) {
      incompatibleDimensions.push('story_structure');
    }
    if (incompatibleDimensions.length > 0) {
      return blocked(
        requestedStylePackIds,
        'incompatible_style_pack',
        `style pack is incompatible with ${incompatibleDimensions.join(', ')}`,
        {
          style_pack_id: stylePackId,
          incompatible_dimensions: incompatibleDimensions,
        },
      );
    }

    try {
      const provenance = await verifyStylePackProvenance({
        repoRoot: input.repoRoot,
        pack,
      });
      if (provenance.issue) {
        return blocked(
          requestedStylePackIds,
          'style_pack_provenance_invalid',
          provenance.issue,
          { style_pack_id: stylePackId },
        );
      }
      const sourceReferences = await Promise.all(
        pack.source_reference_ids.map(async (referenceId) => {
          const source = await getReferenceSource({
            repoRoot: input.repoRoot,
            referenceId,
          });
          return {
            reference_id: source.reference_id,
            rights_status: source.rights_status,
            access_scope: source.access_scope,
            ...(source.content_fingerprint
              ? { content_fingerprint: source.content_fingerprint }
              : {}),
          } satisfies ReferenceGenerationSourceTrace;
        }),
      );
      resolvedPacks.push({
        style_pack_id: pack.id,
        name: pack.name,
        source_reference_ids: [...pack.source_reference_ids],
        source_analysis_ids: [...pack.source_analysis_ids],
        source_benchmark_ids: [...pack.source_benchmark_ids],
        source_references: sourceReferences,
        supplement_provenance_refs: provenance.supplementProvenanceRefs,
        abstract_rules: abstractRules(pack),
        avoid_copying: copyingBoundaries(pack),
        approved_by: pack.approval.approved_by,
        approved_at: pack.approval.approved_at,
      });
    } catch (error) {
      return blocked(
        requestedStylePackIds,
        'style_pack_provenance_invalid',
        error instanceof Error ? error.message : String(error),
        { style_pack_id: stylePackId },
      );
    }
  }

  const allowedReferenceIds = unique(
    resolvedPacks.flatMap(pack => pack.source_reference_ids),
  );
  const similarityEvidence: ReferenceSimilarityEvidenceRecord[] = [];
  for (const evidenceId of requestedSimilarityEvidenceIds) {
    let evidence: ReferenceSimilarityEvidenceRecord;
    try {
      evidence = await getReferenceSimilarityEvidence({
        repoRoot: input.repoRoot,
        evidenceId,
      });
    } catch (error) {
      return blocked(
        requestedStylePackIds,
        'similarity_evidence_unavailable',
        error instanceof Error ? error.message : String(error),
        {
          similarity_evidence_id: evidenceId,
          requested_similarity_evidence_ids: requestedSimilarityEvidenceIds,
        },
      );
    }
    const source = resolvedPacks
      .flatMap(pack => pack.source_references)
      .find(candidate => candidate.reference_id === evidence.reference_id);
    if (
      !allowedReferenceIds.includes(evidence.reference_id)
      || !source
      || source.content_fingerprint !== evidence.source_content_fingerprint
    ) {
      return blocked(
        requestedStylePackIds,
        'similarity_evidence_incompatible',
        'Similarity evidence must belong to a style-pack source and match its content fingerprint',
        {
          similarity_evidence_id: evidenceId,
          requested_similarity_evidence_ids: requestedSimilarityEvidenceIds,
        },
      );
    }
    similarityEvidence.push(evidence);
  }
  const similarityEvidenceRefs = similarityEvidence.map(
    similarityEvidenceTrace,
  );
  return {
    ok: true,
    similarityEvidence,
    context: {
      schema_version: 'reference-generation-context/v1',
      style_pack_ids: resolvedPacks.map(pack => pack.style_pack_id),
      style_packs: resolvedPacks,
      source_references: uniqueByReferenceId(
        resolvedPacks.flatMap(pack => pack.source_references),
      ),
      similarity_evidence_refs: similarityEvidenceRefs,
      reusable_principles: unique(
        resolvedPacks.flatMap(pack => pack.abstract_rules),
      ),
      avoid_copying: unique(
        resolvedPacks.flatMap(pack => pack.avoid_copying),
      ),
      knowledge_writeback_allowed: false,
      production_credit_eligible: false,
    },
  };
}

export function buildReferenceGenerationTrace(input: {
  context: ReferenceGenerationContext | undefined;
  storyStructure: StoryStructureType;
  applicationStatus: NonNullable<ReferenceTrace['application_status']>;
}): ReferenceTrace[] {
  if (!input.context) return [];
  const context = input.context;
  const injected = input.applicationStatus === 'external_prompt_injected';
  return context.style_packs.map(pack => ({
    style_pack_id: pack.style_pack_id,
    application_status: input.applicationStatus,
    applied_rules: injected ? [...pack.abstract_rules] : [],
    requested_rules: [...pack.abstract_rules],
    avoid_copying_rules: [...pack.avoid_copying],
    source_reference_ids: [...pack.source_reference_ids],
    source_analysis_ids: [...pack.source_analysis_ids],
    source_benchmark_ids: [...pack.source_benchmark_ids],
    source_references: pack.source_references.map(source => ({ ...source })),
    similarity_evidence_refs: context.similarity_evidence_refs
      .filter(reference => pack.source_reference_ids.includes(reference.reference_id))
      .map(reference => ({
        ...reference,
        dimensions: [...reference.dimensions],
      })),
    supplement_provenance_refs: pack.supplement_provenance_refs.map(
      reference => ({ ...reference }),
    ),
    source_story_structure: input.storyStructure,
  }));
}

export async function loadReferenceSimilarityEvidenceForTrace(input: {
  repoRoot: string;
  referenceTrace?: ReferenceTrace[];
}): Promise<ReferenceSimilarityEvidenceRecord[]> {
  const evidenceIds = unique(
    (input.referenceTrace ?? []).flatMap(trace =>
      trace.similarity_evidence_refs?.map(reference => reference.evidence_id) ?? []),
  );
  const settled = await Promise.allSettled(evidenceIds.map(evidenceId =>
    getReferenceSimilarityEvidence({
      repoRoot: input.repoRoot,
      evidenceId,
    })));
  return settled.flatMap(result =>
    result.status === 'fulfilled' ? [result.value] : []);
}

function similarityEvidenceTrace(
  evidence: ReferenceSimilarityEvidenceRecord,
): ReferenceSimilarityEvidenceTrace {
  const dimensions: ReferenceSimilarityDimension[] = [];
  if (evidence.observations.excerpts.length > 0) dimensions.push('excerpt');
  if (evidence.observations.character_profiles.length > 0) {
    dimensions.push('character_design');
  }
  if (evidence.observations.plot_beats.length > 0) {
    dimensions.push('plot_structure');
  }
  if (evidence.observations.shot_sequence.length > 0) {
    dimensions.push('shot_sequence');
  }
  return {
    evidence_id: evidence.evidence_id,
    reference_id: evidence.reference_id,
    payload_sha256: evidence.payload_sha256,
    input_provenance: evidence.input_provenance,
    dimensions,
  };
}

function uniqueByReferenceId(
  sources: ReferenceGenerationSourceTrace[],
): ReferenceGenerationSourceTrace[] {
  const byId = new Map<string, ReferenceGenerationSourceTrace>();
  for (const source of sources) byId.set(source.reference_id, source);
  return [...byId.values()];
}
