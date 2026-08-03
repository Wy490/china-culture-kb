import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VideoTypeSchema } from '../../shared/schemas.js';
import {
  WRITING_CAPABILITY_PROFILES,
} from '../src/services/writing-capability-registry.js';
import {
  routeWritingCapabilities,
} from '../src/services/writing-capability-router.js';

const repositoryRoot = resolve(import.meta.dirname, '..', '..', '..');
const reportPath = resolve(
  repositoryRoot,
  'data',
  'reports',
  'story-agent-writing-capability-m2-routing-baseline.json',
);
const capabilityIds = WRITING_CAPABILITY_PROFILES
  .map(profile => profile.capability_id)
  .sort((left, right) => left.localeCompare(right));
const matrix = VideoTypeSchema.options.map(videoType => routeWritingCapabilities({
  schema_version: 'writing-capability-routing-request/v1',
  video_type: videoType,
  requested_capability_ids: capabilityIds,
}));
const decisions = matrix.flatMap(item => item.decisions);
const reasonCounts = {
  unknown_capability: decisions.filter(
    decision => decision.reason_code === 'unknown_capability',
  ).length,
  video_type_forbidden: decisions.filter(
    decision => decision.reason_code === 'video_type_forbidden',
  ).length,
  video_type_not_allowed: decisions.filter(
    decision => decision.reason_code === 'video_type_not_allowed',
  ).length,
  profile_disabled: decisions.filter(
    decision => decision.reason_code === 'profile_disabled',
  ).length,
};
const matrixFingerprint = createHash('sha256')
  .update(JSON.stringify(matrix))
  .digest('hex');
const invariants = {
  covers_all_15_video_types: matrix.length === 15,
  covers_all_3_profiles_per_type: matrix.every(item => item.decisions.length === 3),
  every_profile_default_disabled: WRITING_CAPABILITY_PROFILES.every(
    profile => profile.enabled === false,
  ),
  active_capability_count_is_zero: matrix.every(
    item => item.active_capability_ids.length === 0,
  ),
  applicable_routes_are_explicitly_disabled: reasonCounts.profile_disabled === 20,
  incompatible_routes_are_explicitly_forbidden: reasonCounts.video_type_forbidden === 25,
  no_profile_rules_injected: matrix.every(item => !item.boundary.profile_rules_injected),
  no_generation_effect: matrix.every(item => !item.boundary.affects_generation),
};
const status = Object.values(invariants).every(Boolean) ? 'passed' : 'failed';
const report = {
  schema_version: 'writing-capability-routing-baseline/v1',
  generated_at: '2026-07-31T17:00:00+08:00',
  status,
  profile_schema_version: 'writing-capability-profile/v1',
  routing_schema_version: 'writing-capability-routing-report/v1',
  video_type_count: matrix.length,
  profile_count: capabilityIds.length,
  decision_count: decisions.length,
  active_capability_count: 0,
  reason_counts: reasonCounts,
  matrix_sha256: matrixFingerprint,
  invariants,
  boundary: {
    report_only: true,
    affects_generation: false,
    runtime_enablement_supported: false,
    third_party_code_executed: false,
    external_execution_allowed: false,
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
  profile_count: report.profile_count,
  decision_count: report.decision_count,
  active_capability_count: report.active_capability_count,
  reason_counts: report.reason_counts,
  matrix_sha256: report.matrix_sha256,
  invariants: report.invariants,
  boundary: report.boundary,
}, null, 2));
if (status === 'failed') process.exitCode = 1;
