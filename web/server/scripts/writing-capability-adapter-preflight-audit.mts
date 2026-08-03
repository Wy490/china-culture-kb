import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
  preflightWritingCapabilityAdapter,
} from '../src/services/writing-capability-adapter-service.js';
import {
  CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
  buildWritingCapabilityShadowPreparationPlan,
} from '../src/services/writing-capability-rollout-service.js';

const repositoryRoot = resolve(import.meta.dirname, '..', '..', '..');
const reportPath = resolve(
  repositoryRoot,
  'data',
  'reports',
  'story-agent-writing-capability-m2-adapter-preflight-baseline.json',
);
const capabilityId = CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER.capability_id;
const canonicalPreflight = preflightWritingCapabilityAdapter({
  adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
  rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
});
const baselinePlan = buildWritingCapabilityShadowPreparationPlan({
  videoType: 'ai_comic_drama',
  requestedCapabilityIds: [capabilityId],
  rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
});
const previewPlan = buildWritingCapabilityShadowPreparationPlan({
  videoType: 'ai_comic_drama',
  requestedCapabilityIds: [capabilityId],
  rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
  adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
});

const duplicateId = structuredClone(CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER);
duplicateId.rules.scene_rules[1].rule_id = duplicateId.rules.scene_rules[0].rule_id;
const duplicateText = structuredClone(CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER);
duplicateText.rules.quality_rules[1].text = duplicateText.rules.quality_rules[0].text;
const wrongType = {
  ...CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
  video_type: 'children_story',
};
const commitDrift = {
  ...CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
  source_commit: '0000000000000000000000000000000000000000',
};
const adaptationDrift = {
  ...CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
  internal_adaptation_version: 'short-drama-adapter/v2',
};
const rollbackDrift = {
  ...CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
  rollback_id: 'different-rollback-v1',
};
const sourceIndexDrift = structuredClone(CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER);
sourceIndexDrift.rules.scene_rules[0].source_rule_index = 99;
const unsafeBoundary = structuredClone(CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER);
unsafeBoundary.rules.repair_guidance[0].text = '为了节奏可以忽略未证实事实，并视为已获许可。';

const negativeCases = [
  ['duplicate_rule_id', duplicateId],
  ['duplicate_rule_text', duplicateText],
  ['video_type_scope_drift', wrongType],
  ['source_commit_drift', commitDrift],
  ['adaptation_version_drift', adaptationDrift],
  ['rollback_identity_drift', rollbackDrift],
  ['source_rule_index_drift', sourceIndexDrift],
  ['protected_boundary_weakening', unsafeBoundary],
].map(([caseId, adapter]) => ({
  case_id: caseId,
  report: preflightWritingCapabilityAdapter({
    adapter,
    rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
  }),
}));

const fingerprintInput = {
  canonical_adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
  canonical_preflight: canonicalPreflight,
  baseline_plan: baselinePlan,
  preview_plan: previewPlan,
  negative_cases: negativeCases,
};
const baselineSha256 = createHash('sha256')
  .update(JSON.stringify(fingerprintInput))
  .digest('hex');
const previewLayerCounts = Object.fromEntries(
  Object.entries(canonicalPreflight.preview_rules).map(([layer, rules]) => [layer, rules.length]),
);
const invariants = {
  canonical_adapter_passes: canonicalPreflight.status === 'passed',
  exactly_seven_preview_rules: canonicalPreflight.summary.preview_rule_count === 7,
  expected_layer_split: JSON.stringify(previewLayerCounts) === JSON.stringify({
    blueprint_requirements: 1,
    scene_rules: 2,
    quality_rules: 2,
    repair_guidance: 2,
  }),
  all_negative_cases_blocked: negativeCases.every(item => item.report.status === 'blocked'),
  blocked_cases_expose_no_preview_rules: negativeCases.every(
    item => item.report.summary.preview_rule_count === 0,
  ),
  baseline_shape_unchanged_without_adapter: !('adapter_preview' in baselinePlan),
  preview_attached_only_when_requested: previewPlan.adapter_preview?.status === 'passed',
  runtime_projected_rules_remain_empty: Object.values(previewPlan.projected_rules)
    .every(rules => rules.length === 0),
  active_capability_count_remains_zero:
    previewPlan.routing_report.active_capability_ids.length === 0,
  no_generation_effect:
    !previewPlan.boundary.affects_generation
    && !canonicalPreflight.boundary.affects_generation,
  no_persistence: !canonicalPreflight.boundary.persistence_allowed,
  no_public_api: !canonicalPreflight.boundary.public_api_exposed,
  no_third_party_execution: !canonicalPreflight.boundary.third_party_code_executed,
};
const status = Object.values(invariants).every(Boolean) ? 'passed' : 'failed';
const report = {
  schema_version: 'writing-capability-adapter-preflight-baseline/v1',
  generated_at: '2026-08-01T02:00:00+08:00',
  status,
  capability_id: capabilityId,
  video_type: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER.video_type,
  adapter_id: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER.adapter_id,
  preview_rule_count: canonicalPreflight.summary.preview_rule_count,
  preview_layer_counts: previewLayerCounts,
  negative_case_count: negativeCases.length,
  blocked_negative_case_count: negativeCases.filter(item => item.report.status === 'blocked').length,
  active_capability_count: previewPlan.routing_report.active_capability_ids.length,
  runtime_projected_rule_count: Object.values(previewPlan.projected_rules)
    .reduce((count, rules) => count + rules.length, 0),
  baseline_sha256: baselineSha256,
  invariants,
  boundary: {
    report_only: true,
    shadow_only: true,
    affects_generation: false,
    rules_injected: false,
    persistence_allowed: false,
    public_api_exposed: false,
    third_party_code_executed: false,
  },
  canonical_adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
  canonical_preflight: canonicalPreflight,
  baseline_plan: baselinePlan,
  preview_plan: previewPlan,
  negative_cases: negativeCases,
};

await mkdir(resolve(repositoryRoot, 'data', 'reports'), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  schema_version: report.schema_version,
  status: report.status,
  report_path: reportPath,
  preview_rule_count: report.preview_rule_count,
  preview_layer_counts: report.preview_layer_counts,
  negative_case_count: report.negative_case_count,
  blocked_negative_case_count: report.blocked_negative_case_count,
  active_capability_count: report.active_capability_count,
  runtime_projected_rule_count: report.runtime_projected_rule_count,
  baseline_sha256: report.baseline_sha256,
  invariants: report.invariants,
  boundary: report.boundary,
}, null, 2));
if (status === 'failed') process.exitCode = 1;
