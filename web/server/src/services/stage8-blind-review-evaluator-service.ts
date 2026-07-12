import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import {
  VIDEO_TYPE_CONFIG,
  type ProfessionalQualityDimensionId,
  type Stage8BlindReviewEvaluatorReadinessReport,
  type VideoType,
} from '@shared/types.js';
import { getProfessionalTextTypeContract } from './professional-text-contracts.js';
import {
  PROFESSIONAL_BLIND_REVIEW_THRESHOLDS,
  professionalBlindReviewWeightContract,
} from './professional-benchmark-review-service.js';

const SOURCE_PATHS = [
  'web/server/src/services/professional-text-contracts.ts',
  'web/server/src/services/professional-benchmark-review-service.ts',
  'web/server/src/services/professional-benchmark-artifact-service.ts',
  'web/server/src/services/professional-benchmark-finalization-service.ts',
] as const;

async function sourceBinding(repoRoot: string, relativePath: string): Promise<{ path: string; sha256: string }> {
  const realRoot = await realpath(repoRoot);
  const resolved = await realpath(path.resolve(realRoot, relativePath));
  const relative = path.relative(realRoot, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('stage8_evaluator_source_outside_repository');
  return { path: relativePath, sha256: createHash('sha256').update(await readFile(resolved)).digest('hex') };
}

export async function getStage8BlindReviewEvaluatorReadiness(input: { repoRoot: string; now?: string }): Promise<Stage8BlindReviewEvaluatorReadinessReport> {
  const generatedAt = input.now ?? new Date().toISOString();
  const videoTypes = (Object.keys(VIDEO_TYPE_CONFIG) as VideoType[]).map(videoType => {
    const typeContract = getProfessionalTextTypeContract(videoType);
    const weightContract = professionalBlindReviewWeightContract(videoType);
    const entries = Object.entries(weightContract.dimension_weights) as Array<[ProfessionalQualityDimensionId, number]>;
    const weightSum = entries.reduce((sum, [, weight]) => sum + weight, 0);
    if (weightSum !== 100) throw new Error(`stage8_blind_review_weight_sum_invalid:${videoType}`);
    return {
      video_type: videoType,
      label: VIDEO_TYPE_CONFIG[videoType].label,
      line: typeContract.line,
      weight_contract_sha256: weightContract.sha256,
      dimension_weights: weightContract.dimension_weights,
      weight_sum: 100 as const,
      top_weight_dimensions: entries.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, 3)
        .map(([dimension_id, weight]) => ({ dimension_id, weight })),
      evaluator_ready: true as const,
      real_review_bundle_count: 0 as const,
      human_blind_review_pass_project_count: 0 as const,
      professional_pass_count: 0 as const,
    };
  });
  const hashes = new Set(videoTypes.map(item => item.weight_contract_sha256));
  if (videoTypes.length !== 15 || hashes.size !== 15) throw new Error('stage8_blind_review_weight_contract_identity_invalid');
  return {
    schema_version: 'story-agent-stage8-blind-review-evaluator-readiness/v1',
    generated_at: generatedAt,
    policy: {
      score_threshold_is_human_blind_review_pass: false,
      fixture_simulation_fallback_counts_as_real_review: false,
      evaluator_can_grant_professional_pass: false,
      external_signed_human_artifacts_required_for_finalization: true,
    },
    summary: {
      target_video_type_count: 15,
      weight_contract_ready_count: videoTypes.length,
      weight_sum_valid_count: videoTypes.filter(item => item.weight_sum === 100).length,
      unique_weight_contract_sha256_count: hashes.size,
      blind_review_bundle_schema_version: 'professional-benchmark-blind-review/v2',
      blind_review_decision_schema_version: 'professional-benchmark-blind-review-decision/v2',
      real_review_bundle_count: 0,
      human_blind_review_pass_project_count: 0,
      professional_pass_count: 0,
    },
    thresholds: PROFESSIONAL_BLIND_REVIEW_THRESHOLDS,
    source_bindings: (await Promise.all(SOURCE_PATHS.map(sourcePath => sourceBinding(input.repoRoot, sourcePath))))
      .sort((left, right) => left.path.localeCompare(right.path)),
    video_types: videoTypes,
  };
}
