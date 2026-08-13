import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const EXPECTED_VIDEO_TYPE_COUNT = 15;
const EXPECTED_VARIANT_COUNT = 3;
const EXPECTED_CASE_COUNT = EXPECTED_VIDEO_TYPE_COUNT * EXPECTED_VARIANT_COUNT;
const reportPath = resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'data',
  'reports',
  'story-agent-writing-capability-m4-15x3-machine-evaluation.json',
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function count(cases, predicate) {
  return cases.filter(item => predicate(item.evaluation)).length;
}

function sum(cases, select) {
  return cases.reduce((total, item) => total + select(item.evaluation), 0);
}

function frequency(cases, select) {
  return Object.fromEntries(
    [...cases.flatMap(item => select(item.evaluation))
      .reduce((counts, value) => {
        counts.set(value, (counts.get(value) ?? 0) + 1);
        return counts;
      }, new Map()).entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
  );
}

const report = JSON.parse(await readFile(reportPath, 'utf8'));
assert(
  report.schema_version
    === 'story-agent-writing-capability-m4-machine-evaluation-baseline/v1',
  'Unexpected M4 baseline schema_version',
);
assert(report.boundary?.machine_validation_only === true, 'Machine-only boundary missing');
assert(report.boundary?.human_review_complete === false, 'Human review credit must remain false');
assert(
  report.boundary?.professional_credit_granted === false,
  'Professional credit must remain false',
);
assert(
  report.boundary?.external_model_path_covered === false,
  'External model coverage must remain false for the local matrix',
);
assert(Array.isArray(report.cases), 'cases must be an array');
assert(report.cases.length === EXPECTED_CASE_COUNT, 'Expected exactly 45 matrix cases');

const caseIds = new Set(report.cases.map(item => item.case_id));
const videoTypes = new Set(report.cases.map(item => item.video_type));
const variants = new Set(report.cases.map(item => item.variant_id));
assert(caseIds.size === EXPECTED_CASE_COUNT, 'Matrix case_id values must be unique');
assert(videoTypes.size === EXPECTED_VIDEO_TYPE_COUNT, 'Expected exactly 15 video types');
assert(variants.size === EXPECTED_VARIANT_COUNT, 'Expected exactly 3 input variants');
for (const videoType of videoTypes) {
  assert(
    report.cases.filter(item => item.video_type === videoType).length === EXPECTED_VARIANT_COUNT,
    `Video type "${videoType}" does not have three cases`,
  );
}

const machine = report.machine_evaluation;
assert(machine?.case_count === EXPECTED_CASE_COUNT, 'machine_evaluation.case_count drifted');
const recomputed = {
  quality_report_count: count(report.cases, item => item.quality_report_present),
  quality_passed_count: count(report.cases, item => item.quality_passed),
  story_quality_passed_count: count(report.cases, item => item.story_quality_passed),
  story_publishable_count: count(report.cases, item => item.story_publishable),
  production_material_ready_count: count(
    report.cases,
    item => item.production_material_ready,
  ),
  production_ready_count: count(report.cases, item => item.production_ready),
  factual_cultural_gate_passed_count: count(
    report.cases,
    item => item.factual_cultural_gate_passed,
  ),
  fact_boundary_ready_count: count(
    report.cases,
    item => item.scene_count > 0 && item.fact_boundary_scene_count === item.scene_count,
  ),
  cultural_boundary_ready_count: count(
    report.cases,
    item => item.scene_count > 0 && item.cultural_boundary_scene_count === item.scene_count,
  ),
  shootability_ready_count: count(
    report.cases,
    item => item.scene_count > 0 && item.shootable_scene_count === item.scene_count,
  ),
  repair_attempted_case_count: count(report.cases, item => item.repair_attempt_count > 0),
  repair_applied_case_count: count(report.cases, item => item.repair_applied_count > 0),
  total_repair_attempt_count: sum(report.cases, item => item.repair_attempt_count),
  total_repair_applied_count: sum(report.cases, item => item.repair_applied_count),
  total_open_repair_action_count: sum(report.cases, item => item.open_repair_action_count),
};
for (const [field, value] of Object.entries(recomputed)) {
  assert(machine[field] === value, `${field} drifted: expected ${value}, received ${machine[field]}`);
}

for (const { case_id: caseId, evaluation } of report.cases) {
  const expectedStoryQualityPassed = evaluation.story_publishable === true
    && evaluation.pattern_quality_score >= 70
    && evaluation.gears_readiness_score >= 70;
  assert(
    evaluation.story_quality_passed === expectedStoryQualityPassed,
    `story_quality_passed contract drifted for ${caseId}`,
  );
  assert(
    evaluation.production_material_ready
      === !evaluation.production_blocking_gate_ids.includes('production_material_gate'),
    `production_material_ready contract drifted for ${caseId}`,
  );
}

assert(
  machine.metric_contract?.quality_passed === 'legacy_quality_report_aggregate'
    && machine.metric_contract?.story_quality_passed
      === 'story_publishable_and_pattern_and_gears'
    && machine.metric_contract?.story_publishable === 'story_scope_quality_gates'
    && machine.metric_contract?.production_material_ready === 'production_material_gate'
    && machine.metric_contract?.production_ready === 'all_story_and_production_gates',
  'machine metric_contract drifted',
);

const expectedInvariants = {
  every_case_evaluated: recomputed.quality_report_count === EXPECTED_CASE_COUNT,
  every_story_quality_passed:
    recomputed.story_quality_passed_count === EXPECTED_CASE_COUNT,
  every_story_publishable: recomputed.story_publishable_count === EXPECTED_CASE_COUNT,
  every_factual_cultural_gate_passed:
    recomputed.factual_cultural_gate_passed_count === EXPECTED_CASE_COUNT,
  every_scene_fact_bound: recomputed.fact_boundary_ready_count === EXPECTED_CASE_COUNT,
  every_scene_cultural_bound:
    recomputed.cultural_boundary_ready_count === EXPECTED_CASE_COUNT,
  every_scene_shootable: recomputed.shootability_ready_count === EXPECTED_CASE_COUNT,
  repair_attempt_covers_story_quality_failures: report.cases.every(
    item => item.evaluation.story_quality_passed
      || item.evaluation.repair_attempt_count > 0,
  ),
};
assert(
  JSON.stringify(machine.invariants) === JSON.stringify(expectedInvariants),
  'machine invariants drifted from independently recomputed evidence',
);
assert(
  JSON.stringify(machine.failed_invariants)
    === JSON.stringify(Object.entries(expectedInvariants)
      .filter(([, passed]) => !passed)
      .map(([name]) => name)),
  'machine failed_invariants drifted',
);

function assertSlice(slice, cases, label) {
  assert(slice?.case_count === cases.length, `${label}.case_count drifted`);
  const sliceCounts = {
    quality_passed_count: count(cases, item => item.quality_passed),
    story_quality_passed_count: count(cases, item => item.story_quality_passed),
    story_publishable_count: count(cases, item => item.story_publishable),
    production_material_ready_count: count(cases, item => item.production_material_ready),
    production_ready_count: count(cases, item => item.production_ready),
  };
  for (const [field, value] of Object.entries(sliceCounts)) {
    assert(slice[field] === value, `${label}.${field} drifted`);
  }
}

for (const variant of variants) {
  assertSlice(
    machine.by_variant?.find(slice => slice.slice_id === variant),
    report.cases.filter(item => item.variant_id === variant),
    `by_variant.${variant}`,
  );
}
for (const videoType of videoTypes) {
  assertSlice(
    machine.by_video_type?.find(slice => slice.slice_id === videoType),
    report.cases.filter(item => item.video_type === videoType),
    `by_video_type.${videoType}`,
  );
}

const expectedStoryBlockingGateCounts = frequency(
  report.cases,
  item => item.story_blocking_gate_ids,
);
const expectedProductionBlockingGateCounts = frequency(
  report.cases,
  item => item.production_blocking_gate_ids,
);
const expectedOpenRepairTargetCounts = frequency(
  report.cases,
  item => item.open_repair_targets,
);
const expectedWeakPatternSignalCounts = frequency(
  report.cases,
  item => item.weak_pattern_signal_labels,
);
const expectedGearsIssueCounts = frequency(
  report.cases,
  item => item.gears_issues,
);
assert(
  JSON.stringify(machine.failure_clusters?.story_blocking_gate_counts)
    === JSON.stringify(expectedStoryBlockingGateCounts),
  'story_blocking_gate_counts drifted',
);
assert(
  JSON.stringify(machine.failure_clusters?.production_blocking_gate_counts)
    === JSON.stringify(expectedProductionBlockingGateCounts),
  'production_blocking_gate_counts drifted',
);
assert(
  JSON.stringify(machine.failure_clusters?.open_repair_target_counts)
    === JSON.stringify(expectedOpenRepairTargetCounts),
  'open_repair_target_counts drifted',
);
assert(
  JSON.stringify(machine.failure_clusters?.weak_pattern_signal_counts)
    === JSON.stringify(expectedWeakPatternSignalCounts),
  'weak_pattern_signal_counts drifted',
);
assert(
  JSON.stringify(machine.failure_clusters?.gears_issue_counts)
    === JSON.stringify(expectedGearsIssueCounts),
  'gears_issue_counts drifted',
);

assert(machine.machine_validation_only === true, 'Machine evaluation boundary missing');
assert(machine.human_review_complete === false, 'Machine evaluation inferred human review');
assert(machine.professional_credit_granted === false, 'Machine evaluation inferred professional credit');
assert(machine.invariants?.every_case_evaluated === true, 'Every case must have a quality report');
assert(
  machine.invariants?.every_factual_cultural_gate_passed === true,
  'Every case must pass the factual/cultural machine gate',
);
assert(machine.invariants?.every_scene_fact_bound === true, 'Every scene must be fact-bound');
assert(machine.invariants?.every_scene_cultural_bound === true, 'Every scene must be culture-bound');
assert(machine.invariants?.every_scene_shootable === true, 'Every scene must be machine-shootable');
assert(Array.isArray(machine.by_variant) && machine.by_variant.length === 3, 'by_variant drifted');
assert(Array.isArray(machine.by_video_type) && machine.by_video_type.length === 15, 'by_video_type drifted');

console.log(JSON.stringify({
  schema_version: 'story-agent-writing-capability-m4-machine-evaluation-audit/v1',
  status: 'passed',
  report_path: reportPath,
  case_count: report.cases.length,
  video_type_count: videoTypes.size,
  variant_count: variants.size,
  quality_passed_count: machine.quality_passed_count,
  story_quality_passed_count: machine.story_quality_passed_count,
  story_publishable_count: machine.story_publishable_count,
  production_material_ready_count: machine.production_material_ready_count,
  production_ready_count: machine.production_ready_count,
  factual_cultural_gate_passed_count: machine.factual_cultural_gate_passed_count,
  fact_boundary_ready_count: machine.fact_boundary_ready_count,
  cultural_boundary_ready_count: machine.cultural_boundary_ready_count,
  shootability_ready_count: machine.shootability_ready_count,
  repair_attempted_case_count: machine.repair_attempted_case_count,
  repair_applied_case_count: machine.repair_applied_case_count,
  total_open_repair_action_count: machine.total_open_repair_action_count,
  failure_clusters: machine.failure_clusters,
  machine_evaluation_status: machine.status,
  failed_quality_invariants: machine.failed_invariants,
  machine_validation_only: true,
  human_review_complete: false,
  professional_credit_granted: false,
}, null, 2));
