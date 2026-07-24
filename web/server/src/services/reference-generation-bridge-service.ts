import type {
  PresentationStyle,
  ReferenceStylePackRecord,
  ReferenceTrace,
  StoryStructureType,
  VideoType,
} from '@shared/types.js';
import {
  getBenchmarkCard,
  getReferenceAnalysis,
  getReferenceSource,
  getReferenceStylePack,
} from './reference-library-service.js';

export interface ReferenceGenerationStylePackContext {
  style_pack_id: string;
  name: string;
  source_reference_ids: string[];
  source_analysis_ids: string[];
  source_benchmark_ids: string[];
  abstract_rules: string[];
  avoid_copying: string[];
  approved_by: string;
  approved_at: string;
}

export interface ReferenceGenerationContext {
  schema_version: 'reference-generation-context/v1';
  style_pack_ids: string[];
  style_packs: ReferenceGenerationStylePackContext[];
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
    | 'style_pack_provenance_invalid';
  style_pack_id?: string;
  requested_style_pack_ids: string[];
  incompatible_dimensions?: Array<
    'video_type' | 'presentation_style' | 'story_structure'
  >;
  reason: string;
}

export type ReferenceGenerationContextResolution =
  | { ok: true; context?: ReferenceGenerationContext }
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
}): Promise<string | undefined> {
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
    return 'style pack source_reference_ids do not match its approved benchmark cards';
  }
  if (!sameMembers(pack.source_analysis_ids, benchmarkAnalysisIds)) {
    return 'style pack source_analysis_ids do not match its approved benchmark cards';
  }

  const analyses = await Promise.all(
    pack.source_analysis_ids.map(analysisId =>
      getReferenceAnalysis({ repoRoot, analysisId })),
  );
  if (analyses.some(analysis => analysis.approval.status !== 'approved')) {
    return 'every source analysis must remain approved at generation time';
  }
  if (analyses.some(
    analysis => !pack.source_reference_ids.includes(analysis.reference_id),
  )) {
    return 'a source analysis points outside the style pack reference set';
  }
  await Promise.all(
    pack.source_reference_ids.map(referenceId =>
      getReferenceSource({ repoRoot, referenceId })),
  );
  return undefined;
}

export async function resolveReferenceGenerationContext(input: {
  repoRoot: string;
  stylePackIds?: string[];
  videoType: VideoType;
  presentationStyle: PresentationStyle;
  storyStructure: StoryStructureType;
}): Promise<ReferenceGenerationContextResolution> {
  const requestedStylePackIds = (input.stylePackIds ?? [])
    .map(stylePackId => stylePackId.trim());
  if (requestedStylePackIds.length === 0) return { ok: true };
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
      const provenanceIssue = await verifyStylePackProvenance({
        repoRoot: input.repoRoot,
        pack,
      });
      if (provenanceIssue) {
        return blocked(
          requestedStylePackIds,
          'style_pack_provenance_invalid',
          provenanceIssue,
          { style_pack_id: stylePackId },
        );
      }
    } catch (error) {
      return blocked(
        requestedStylePackIds,
        'style_pack_provenance_invalid',
        error instanceof Error ? error.message : String(error),
        { style_pack_id: stylePackId },
      );
    }

    resolvedPacks.push({
      style_pack_id: pack.id,
      name: pack.name,
      source_reference_ids: [...pack.source_reference_ids],
      source_analysis_ids: [...pack.source_analysis_ids],
      source_benchmark_ids: [...pack.source_benchmark_ids],
      abstract_rules: abstractRules(pack),
      avoid_copying: copyingBoundaries(pack),
      approved_by: pack.approval.approved_by,
      approved_at: pack.approval.approved_at,
    });
  }

  return {
    ok: true,
    context: {
      schema_version: 'reference-generation-context/v1',
      style_pack_ids: resolvedPacks.map(pack => pack.style_pack_id),
      style_packs: resolvedPacks,
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
  const injected = input.applicationStatus === 'external_prompt_injected';
  return input.context.style_packs.map(pack => ({
    style_pack_id: pack.style_pack_id,
    application_status: input.applicationStatus,
    applied_rules: injected ? [...pack.abstract_rules] : [],
    requested_rules: [...pack.abstract_rules],
    avoid_copying_rules: [...pack.avoid_copying],
    source_reference_ids: [...pack.source_reference_ids],
    source_analysis_ids: [...pack.source_analysis_ids],
    source_benchmark_ids: [...pack.source_benchmark_ids],
    source_story_structure: input.storyStructure,
  }));
}
