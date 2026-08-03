import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VideoTypeSchema } from '../../shared/schemas.js';
import {
  CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
  buildWritingCapabilityShadowPreparationPlan,
} from '../src/services/writing-capability-rollout-service.js';

const repositoryRoot = resolve(import.meta.dirname, '..', '..', '..');
const reportPath = resolve(
  repositoryRoot,
  'data',
  'reports',
  'story-agent-writing-capability-m2-shadow-plan-baseline.json',
);
const capabilityId = CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY.candidate.capability_id;
const matrix = VideoTypeSchema.options.map(videoType => (
  buildWritingCapabilityShadowPreparationPlan({
    videoType,
    requestedCapabilityIds: [capabilityId],
    rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
  })
));
const statusCounts = Object.fromEntries([
  'not_requested',
  'policy_disabled',
  'shadow_ready',
  'policy_incompatible',
  'candidate_mismatch',
  'routing_rejected',
].map(status => [status, matrix.filter(item => item.status === status).length]));
const matrixFingerprint = createHash('sha256')
  .update(JSON.stringify(matrix))
  .digest('hex');
const invariants = {
  covers_all_15_video_types: matrix.length === 15,
  exactly_one_shadow_ready: statusCounts.shadow_ready === 1,
  only_ai_comic_is_shadow_ready: matrix.every(item => (
    item.video_type === 'ai_comic_drama'
      ? item.status === 'shadow_ready'
      : item.status === 'candidate_mismatch'
  )),
  all_routes_remain_inactive: matrix.every(
    item => item.routing_report.active_capability_ids.length === 0,
  ),
  all_projected_rule_lists_empty: matrix.every(item => (
    item.projected_rules.blueprint_requirements.length === 0
    && item.projected_rules.scene_rules.length === 0
    && item.projected_rules.quality_rules.length === 0
    && item.projected_rules.repair_guidance.length === 0
  )),
  no_generation_effect: matrix.every(item => !item.boundary.affects_generation),
  no_runtime_activation: matrix.every(item => !item.boundary.runtime_activation_allowed),
  no_global_enablement: matrix.every(item => !item.boundary.global_enablement_allowed),
  no_persistence: matrix.every(item => !item.boundary.persistence_allowed),
};
const status = Object.values(invariants).every(Boolean) ? 'passed' : 'failed';
const report = {
  schema_version: 'writing-capability-shadow-plan-baseline/v1',
  generated_at: '2026-08-01T00:45:00+08:00',
  status,
  policy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
  video_type_count: matrix.length,
  shadow_ready_count: statusCounts.shadow_ready,
  active_capability_count: 0,
  projected_rule_count: 0,
  status_counts: statusCounts,
  matrix_sha256: matrixFingerprint,
  invariants,
  boundary: {
    report_only: true,
    shadow_only: true,
    affects_generation: false,
    runtime_activation_allowed: false,
    global_enablement_allowed: false,
    persistence_allowed: false,
    public_api_exposed: false,
    third_party_code_executed: false,
  },
  matrix,
};

await mkdir(resolve(repositoryRoot, 'data', 'reports'), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  schema_version: report.schema_version,
  status: report.status,
  report_path: reportPath,
  video_type_count: report.video_type_count,
  shadow_ready_count: report.shadow_ready_count,
  active_capability_count: report.active_capability_count,
  projected_rule_count: report.projected_rule_count,
  status_counts: report.status_counts,
  matrix_sha256: report.matrix_sha256,
  invariants: report.invariants,
  boundary: report.boundary,
}, null, 2));
if (status === 'failed') process.exitCode = 1;
