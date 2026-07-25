import { createHash } from 'node:crypto';
import type { StoryAgentImageGenerationRequestTask } from '@shared/types.js';

const REQUIRED_SCENARIOS = [
  'missing_file_rejected',
  'invalid_image_rejected',
  'content_sha256_mismatch_rejected',
  'partial_import_preserved',
  'failed_task_retry_recovered',
  'identity_replacement_staled',
] as const;

const PROMPT_POLLUTION_PATTERNS = [
  '质量报告',
  '分析结论',
  '来源显示',
  'TODO',
  '应该',
] as const;

export type StoryAgentVisualAssetPressureScenario =
  typeof REQUIRED_SCENARIOS[number];

export interface StoryAgentVisualAssetPressureScenarioResult {
  scenario: StoryAgentVisualAssetPressureScenario;
  status: 'passed' | 'failed' | 'not_run';
  evidence_refs: string[];
  details?: string;
}

export interface StoryAgentVisualAssetPressureAsset {
  asset_id: string;
  label: string;
  kind: StoryAgentImageGenerationRequestTask['kind'];
  prompt: string;
  prompt_sha256: string;
  content_sha256: string;
  required_visual_anchors: string[];
  forbidden_visual_anchors: string[];
  semantic_context: string[];
  source_content_sha256_verified: boolean;
  media_signature_verified: boolean;
  immutable_preview_verified: boolean;
  identity_mapping_current: boolean;
}

export interface StoryAgentVisualAssetPressureCase {
  case_id: string;
  source_id: string;
  title: string;
  style_family: string;
  character_labels: string[];
  location_labels: string[];
  assets: StoryAgentVisualAssetPressureAsset[];
}

interface StoryAgentVisualAssetPressureCaseResult {
  case_id: string;
  source_id: string;
  title: string;
  style_family: string;
  asset_count: number;
  unique_content_sha256_count: number;
  semantic_gate_passed: boolean;
  blockers: string[];
}

export interface StoryAgentVisualAssetPressureReport {
  schema_version: 'story-agent-visual-asset-pressure-report/v1';
  status: 'ready' | 'blocked';
  generated_at: string;
  coverage: {
    case_count: number;
    unique_source_id_count: number;
    unique_style_family_count: number;
    unique_character_label_count: number;
    unique_location_label_count: number;
    unique_content_sha256_count: number;
    cross_case_content_reuse_count: number;
    semantic_gate_passed_case_count: number;
    source_content_sha256_verified_asset_count: number;
    media_signature_verified_asset_count: number;
    immutable_preview_verified_asset_count: number;
    identity_mapping_current_asset_count: number;
  };
  scenario_summary: {
    required_count: number;
    passed_count: number;
    failed_count: number;
    not_run_count: number;
  };
  scenario_results: StoryAgentVisualAssetPressureScenarioResult[];
  cases: StoryAgentVisualAssetPressureCaseResult[];
  blockers: string[];
  warnings: string[];
  machine_validation_only: true;
  image_provider_invoked_by_server: false;
  video_generation_performed: false;
  production_credit_granted: false;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

export function resolveStoryAgentVisualAssetPressureStyleFamilies(
  caseIds: string[],
  styleFamilies: Record<string, string>,
): Record<string, string> {
  const uniqueCaseIds = [...new Set(caseIds)].sort();
  const resolved = Object.fromEntries(uniqueCaseIds.map(caseId => [
    caseId,
    styleFamilies[caseId]?.trim() ?? '',
  ]));
  const missing = uniqueCaseIds.filter(caseId => !resolved[caseId]);
  if (missing.length > 0) {
    throw new Error(`Missing visual asset pressure style families: ${missing.join(', ')}`);
  }
  return resolved;
}

function assetBlockers(
  item: StoryAgentVisualAssetPressureAsset,
): string[] {
  const semanticText = item.semantic_context.join('\n');
  return [
    ...(!item.label.trim()
      ? [`asset_label_missing:${item.asset_id}`]
      : []),
    ...(sha256(item.prompt) !== item.prompt_sha256
      ? [`prompt_sha256_mismatch:${item.asset_id}`]
      : []),
    ...(!isSha256(item.content_sha256)
      ? [`content_sha256_invalid:${item.asset_id}`]
      : []),
    ...PROMPT_POLLUTION_PATTERNS
      .filter(pattern => item.prompt.includes(pattern))
      .map(pattern => `prompt_pollution:${item.asset_id}:${pattern}`),
    ...item.required_visual_anchors
      .filter(anchor => !semanticText.includes(anchor))
      .map(anchor => `required_visual_anchor_missing:${item.asset_id}:${anchor}`),
    ...item.forbidden_visual_anchors
      .filter(anchor => semanticText.includes(anchor))
      .map(anchor => `forbidden_visual_anchor_present:${item.asset_id}:${anchor}`),
    ...(!item.source_content_sha256_verified
      ? [`source_content_sha256_mismatch:${item.asset_id}`]
      : []),
    ...(!item.media_signature_verified
      ? [`media_signature_unverified:${item.asset_id}`]
      : []),
    ...(!item.immutable_preview_verified
      ? [`immutable_preview_unverified:${item.asset_id}`]
      : []),
    ...(!item.identity_mapping_current
      ? [`identity_mapping_not_current:${item.asset_id}`]
      : []),
  ];
}

function scenarioResults(
  supplied: StoryAgentVisualAssetPressureScenarioResult[],
): StoryAgentVisualAssetPressureScenarioResult[] {
  const byScenario = new Map(supplied.map(item => [item.scenario, item]));
  return REQUIRED_SCENARIOS.map(scenario => byScenario.get(scenario) ?? {
    scenario,
    status: 'not_run',
    evidence_refs: [],
  });
}

export function buildStoryAgentVisualAssetPressureReport(input: {
  cases: StoryAgentVisualAssetPressureCase[];
  scenario_results: StoryAgentVisualAssetPressureScenarioResult[];
  generated_at?: string;
}): StoryAgentVisualAssetPressureReport {
  const caseResults = input.cases.map(item => {
    const blockers = unique([
      ...(item.character_labels.length > 0
        ? []
        : [`character_coverage_missing:${item.case_id}`]),
      ...(item.location_labels.length > 0
        ? []
        : [`location_coverage_missing:${item.case_id}`]),
      ...item.assets.flatMap(assetBlockers),
    ]);
    return {
      case_id: item.case_id,
      source_id: item.source_id,
      title: item.title,
      style_family: item.style_family,
      asset_count: item.assets.length,
      unique_content_sha256_count: new Set(
        item.assets.map(asset => asset.content_sha256),
      ).size,
      semantic_gate_passed: blockers.length === 0,
      blockers,
    };
  });
  const contentHashCases = new Map<string, Set<string>>();
  for (const item of input.cases) {
    for (const hash of new Set(item.assets.map(asset => asset.content_sha256))) {
      const cases = contentHashCases.get(hash) ?? new Set<string>();
      cases.add(item.case_id);
      contentHashCases.set(hash, cases);
    }
  }
  const reusedAcrossCases = [...contentHashCases.entries()]
    .filter(([, cases]) => cases.size > 1);
  const scenarios = scenarioResults(input.scenario_results);
  const totalAssetCount = input.cases.reduce(
    (total, item) => total + item.assets.length,
    0,
  );
  const uniqueContentHashCount = contentHashCases.size;
  const coverage = {
    case_count: input.cases.length,
    unique_source_id_count: new Set(
      input.cases.map(item => item.source_id).filter(Boolean),
    ).size,
    unique_style_family_count: new Set(
      input.cases.map(item => item.style_family).filter(Boolean),
    ).size,
    unique_character_label_count: new Set(
      input.cases.flatMap(item => item.character_labels),
    ).size,
    unique_location_label_count: new Set(
      input.cases.flatMap(item => item.location_labels),
    ).size,
    unique_content_sha256_count: uniqueContentHashCount,
    cross_case_content_reuse_count: reusedAcrossCases.length,
    semantic_gate_passed_case_count: caseResults.filter(
      item => item.semantic_gate_passed,
    ).length,
    source_content_sha256_verified_asset_count: input.cases.flatMap(
      item => item.assets,
    ).filter(asset => asset.source_content_sha256_verified).length,
    media_signature_verified_asset_count: input.cases.flatMap(
      item => item.assets,
    ).filter(asset => asset.media_signature_verified).length,
    immutable_preview_verified_asset_count: input.cases.flatMap(
      item => item.assets,
    ).filter(asset => asset.immutable_preview_verified).length,
    identity_mapping_current_asset_count: input.cases.flatMap(
      item => item.assets,
    ).filter(asset => asset.identity_mapping_current).length,
  };
  const blockers = unique([
    ...(coverage.case_count >= 4
      ? []
      : [`visual_case_coverage:${coverage.case_count}/4`]),
    ...(coverage.unique_source_id_count >= 4
      ? []
      : [`visual_source_coverage:${coverage.unique_source_id_count}/4`]),
    ...(coverage.unique_style_family_count >= 4
      ? []
      : [`style_family_coverage:${coverage.unique_style_family_count}/4`]),
    ...(coverage.unique_character_label_count >= 4
      ? []
      : [`character_diversity_coverage:${coverage.unique_character_label_count}/4`]),
    ...(coverage.unique_location_label_count >= 4
      ? []
      : [`location_diversity_coverage:${coverage.unique_location_label_count}/4`]),
    ...(uniqueContentHashCount >= input.cases.length * 2
      ? []
      : [`content_hash_diversity:${uniqueContentHashCount}/${input.cases.length * 2}`]),
    ...reusedAcrossCases.map(([hash, cases]) => (
      `cross_case_content_reuse:${hash}:${[...cases].sort().join(',')}`
    )),
    ...caseResults.flatMap(item => item.blockers),
    ...scenarios
      .filter(item => item.status !== 'passed')
      .map(item => `${item.scenario}:${item.status}`),
    ...scenarios
      .filter(item => item.status === 'passed' && item.evidence_refs.length === 0)
      .map(item => `${item.scenario}:evidence_missing`),
  ]);
  const warnings = unique([
    ...(totalAssetCount === uniqueContentHashCount
      ? []
      : [`within_case_composite_asset_reuse:${totalAssetCount - uniqueContentHashCount}`]),
  ]);

  return {
    schema_version: 'story-agent-visual-asset-pressure-report/v1',
    status: blockers.length === 0 ? 'ready' : 'blocked',
    generated_at: input.generated_at ?? new Date().toISOString(),
    coverage,
    scenario_summary: {
      required_count: REQUIRED_SCENARIOS.length,
      passed_count: scenarios.filter(item => item.status === 'passed').length,
      failed_count: scenarios.filter(item => item.status === 'failed').length,
      not_run_count: scenarios.filter(item => item.status === 'not_run').length,
    },
    scenario_results: scenarios,
    cases: caseResults,
    blockers,
    warnings,
    machine_validation_only: true,
    image_provider_invoked_by_server: false,
    video_generation_performed: false,
    production_credit_granted: false,
  };
}
