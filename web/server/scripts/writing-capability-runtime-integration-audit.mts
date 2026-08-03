import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { StoryGenerateRequest, StoryGenerateResult, StoryQualityReport } from '@shared/types.js';
import { prepareChinaCultureStoryGeneration } from '../src/domains/china-culture/story-generation-preparation-service.js';
import {
  CANONICAL_CONTINUITY_AI_COMIC_ADAPTER,
  CANONICAL_READER_SIMULATION_AI_COMIC_ADAPTER,
  CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
} from '../src/services/writing-capability-adapter-service.js';
import { validateGenreStoryQuality } from '../src/services/genre-quality-service.js';
import {
  CANONICAL_CONTINUITY_AI_COMIC_SHADOW_POLICY,
  CANONICAL_READER_SIMULATION_AI_COMIC_SHADOW_POLICY,
  CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
} from '../src/services/writing-capability-rollout-service.js';
import {
  CANONICAL_CONTINUITY_AI_COMIC_RUNTIME_ACTIVATION,
  CANONICAL_READER_SIMULATION_AI_COMIC_RUNTIME_ACTIVATION,
  CANONICAL_SHORT_DRAMA_AI_COMIC_RUNTIME_ACTIVATION,
  buildWritingCapabilityRuntimeResolution,
} from '../src/services/writing-capability-runtime-service.js';

const repositoryRoot = resolve(import.meta.dirname, '..', '..', '..');
const reportPath = resolve(repositoryRoot, 'data', 'reports',
  'story-agent-writing-capability-m2-runtime-integration-baseline.json');
const capabilityId = 'short_drama_develop_write_review';
const request: StoryGenerateRequest = {
  video_type: 'ai_comic_drama', presentation_style: 'ai_comic',
  creation_use_case: 'original_ai_comic', truth_mode: 'fictional_original',
  original_user_query: '少年发现古桥将被洪水冲毁，决定召集伙伴守桥。',
};
const activationInput = {
  videoType: 'ai_comic_drama' as const,
  requestedCapabilityIds: [capabilityId],
  activation: CANONICAL_SHORT_DRAMA_AI_COMIC_RUNTIME_ACTIVATION,
  adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
  rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
};
const activeResolution = buildWritingCapabilityRuntimeResolution(activationInput);
const additionalCandidateResolutions = [
  buildWritingCapabilityRuntimeResolution({
    videoType: 'ai_comic_drama', requestedCapabilityIds: ['continuity_state_tracking'],
    activation: CANONICAL_CONTINUITY_AI_COMIC_RUNTIME_ACTIVATION,
    adapter: CANONICAL_CONTINUITY_AI_COMIC_ADAPTER,
    rolloutPolicy: CANONICAL_CONTINUITY_AI_COMIC_SHADOW_POLICY,
  }),
  buildWritingCapabilityRuntimeResolution({
    videoType: 'ai_comic_drama', requestedCapabilityIds: ['reader_simulation_review'],
    activation: CANONICAL_READER_SIMULATION_AI_COMIC_RUNTIME_ACTIVATION,
    adapter: CANONICAL_READER_SIMULATION_AI_COMIC_ADAPTER,
    rolloutPolicy: CANONICAL_READER_SIMULATION_AI_COMIC_SHADOW_POLICY,
  }),
];
const driftedActivation = structuredClone(CANONICAL_SHORT_DRAMA_AI_COMIC_RUNTIME_ACTIVATION);
driftedActivation.candidate.adapter_revision = 2;
const driftedAdapter = structuredClone(CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER);
driftedAdapter.source_commit = '0'.repeat(40);
const fallbackProbes = [
  { probe_id: 'wrong_video_type', resolution: buildWritingCapabilityRuntimeResolution({ ...activationInput, videoType: 'children_story' }) },
  { probe_id: 'missing_capability', resolution: buildWritingCapabilityRuntimeResolution({ ...activationInput, requestedCapabilityIds: [] }) },
  { probe_id: 'activation_identity_drift', resolution: buildWritingCapabilityRuntimeResolution({ ...activationInput, activation: driftedActivation }) },
  { probe_id: 'adapter_identity_drift', resolution: buildWritingCapabilityRuntimeResolution({ ...activationInput, adapter: driftedAdapter }) },
];
const baselinePreparation = await prepareChinaCultureStoryGeneration(request);
const activePreparation = await prepareChinaCultureStoryGeneration(request, {
  writingCapability: {
    enabled: true, requestedCapabilityIds: [capabilityId],
    rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    adapter: CANONICAL_SHORT_DRAMA_AI_COMIC_ADAPTER,
    runtimeActivation: CANONICAL_SHORT_DRAMA_AI_COMIC_RUNTIME_ACTIVATION,
  },
});
const fallbackPreparation = await prepareChinaCultureStoryGeneration(request, {
  writingCapability: {
    enabled: true, requestedCapabilityIds: [capabilityId],
    rolloutPolicy: CANONICAL_WRITING_CAPABILITY_SHADOW_POLICY,
    adapter: driftedAdapter,
    runtimeActivation: CANONICAL_SHORT_DRAMA_AI_COMIC_RUNTIME_ACTIVATION,
  },
});
if (!baselinePreparation.ok || !activePreparation.ok || !fallbackPreparation.ok) {
  throw new Error('runtime audit preparation failed');
}

const scenes = [1, 2, 3, 4, 5].map(sceneId => ({
  scene_id: sceneId, title: `场景${sceneId}`, duration_sec: 20, location: '古桥', time_of_day: '雨夜',
  dramatic_function: ['钩子开场', '人物登场', '冲突爆发', '反转/觉醒', '高燃收束'][sceneId - 1],
  plot: '少年站在桥边想了想，众人看着他。', key_action: sceneId === 3 ? '走向桥头' : '',
  characters: ['少年'], visual_prompt: '雨夜古桥，少年近景表情', camera_suggestion: '近景', cultural_note: '虚构故事',
}));
const story: StoryGenerateResult = {
  storyId: 'runtime-audit', title: '守桥', generation_type: 'character_story',
  video_type: 'ai_comic_drama', presentation_style: 'ai_comic', source_entry: '测试条目',
  logline: '少年守桥。', theme: '担当', full_text: scenes.map(scene => scene.plot).join('\n'),
  scene_breakdown: scenes, gears_segments: [], gears_segments_url: '/runtime-audit/gears-segments',
  cultural_constraints: [], credibility_note: '虚构故事', story_structure: 'single_event_drama',
  story_blueprint: activePreparation.preliminaryStoryBlueprint,
};
const baseQuality: StoryQualityReport = {
  hasCentralEvent: true, hasConflict: true, hasProtagonistChoice: true,
  hasSceneAction: true, hasClimax: true, hasEndingTheme: true,
  isNotBiographySummary: true, passed: true, issues: [],
};
const quality = validateGenreStoryQuality({
  story, baseReport: baseQuality, blueprint: activePreparation.preliminaryStoryBlueprint,
});
const runtimeRuleCount = activeResolution.context
  ? Object.values(activeResolution.context.rules).reduce((count, rules) => count + rules.length, 0)
  : 0;
const fingerprint = {
  activation: CANONICAL_SHORT_DRAMA_AI_COMIC_RUNTIME_ACTIVATION,
  active_resolution: activeResolution,
  additional_candidate_resolutions: additionalCandidateResolutions,
  fallback_probes: fallbackProbes,
  active_blueprint_context: activePreparation.preliminaryStoryBlueprint.writing_capability_context,
  quality: quality.writing_capability_quality,
};
const baselineSha256 = createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex');
const invariants = {
  default_path_has_no_runtime_resolution: !('writingCapabilityRuntimeResolution' in baselinePreparation),
  default_blueprint_has_no_runtime_context: !('writing_capability_context' in baselinePreparation.preliminaryStoryBlueprint),
  exact_candidate_activates: activeResolution.status === 'active',
  all_three_initial_profiles_activate: additionalCandidateResolutions
    .every(resolution => resolution.status === 'active'),
  exactly_seven_runtime_rules: runtimeRuleCount === 7,
  generation_rules_enter_blueprint: activePreparation.preliminaryStoryBlueprint.type_specific_requirements
    .some(line => line.includes('sd-blueprint-causal-spine')),
  active_context_is_persistable: activePreparation.preliminaryStoryBlueprint.writing_capability_context?.boundary.persistence_allowed === true,
  deterministic_quality_is_active: quality.writing_capability_quality?.boundary.deterministic_machine_evaluation === true,
  quality_findings_are_scene_localized: quality.writing_capability_quality?.checks
    .filter(check => check.status === 'failed').every(check => check.scene_ids.length > 0) === true,
  repair_actions_receive_capability_findings: quality.repair_actions.some(action => action.includes('写作能力局部修复')),
  all_identity_and_scope_probes_fallback: fallbackProbes.every(probe => probe.resolution.status === 'fallback'),
  fallback_exposes_no_context: fallbackProbes.every(probe => !probe.resolution.context),
  fallback_blueprint_matches_baseline: JSON.stringify(fallbackPreparation.preliminaryStoryBlueprint)
    === JSON.stringify(baselinePreparation.preliminaryStoryBlueprint),
  no_public_api_exposure: activeResolution.context?.boundary.public_api_exposed === false,
  no_third_party_execution: activeResolution.context?.boundary.third_party_code_executed === false,
};
const status = Object.values(invariants).every(Boolean) ? 'passed' : 'failed';
const report = {
  schema_version: 'writing-capability-runtime-integration-baseline/v1',
  generated_at: '2026-08-02T18:00:00+08:00', status,
  capability_id: capabilityId, video_type: 'ai_comic_drama',
  active_profile_count: 1 + additionalCandidateResolutions
    .filter(resolution => resolution.status === 'active').length,
  runtime_rule_count: runtimeRuleCount,
  fallback_probe_count: fallbackProbes.length,
  passed_fallback_probe_count: fallbackProbes.filter(probe => probe.resolution.status === 'fallback').length,
  quality_check_count: quality.writing_capability_quality?.checks.length ?? 0,
  failed_quality_check_count: quality.writing_capability_quality?.failed_check_ids.length ?? 0,
  baseline_sha256: baselineSha256, invariants,
  boundary: {
    report_only: true, feature_flag_default_off: true, explicit_internal_opt_in: true,
    public_api_exposed: false, third_party_code_executed: false,
  },
  activation: CANONICAL_SHORT_DRAMA_AI_COMIC_RUNTIME_ACTIVATION,
  active_resolution: activeResolution, fallback_probes: fallbackProbes,
  additional_candidate_resolutions: additionalCandidateResolutions,
  quality_report: quality.writing_capability_quality,
};
await mkdir(resolve(repositoryRoot, 'data', 'reports'), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  schema_version: report.schema_version, status, report_path: reportPath,
  runtime_rule_count: runtimeRuleCount, fallback_probe_count: report.fallback_probe_count,
  passed_fallback_probe_count: report.passed_fallback_probe_count,
  quality_check_count: report.quality_check_count,
  failed_quality_check_count: report.failed_quality_check_count,
  baseline_sha256: baselineSha256, invariants, boundary: report.boundary,
}, null, 2));
if (status === 'failed') process.exitCode = 1;
