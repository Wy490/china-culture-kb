import { createHash } from 'node:crypto';
import { z } from 'zod';
import type {
  EntryDetail,
  StoryGenerateRequest,
  SupportedDuration,
} from '@shared/types.js';
import { getModelProfileById } from './model-catalog.js';

const SupportedDurationSchema = z.enum([
  '30秒',
  '1分钟',
  '3分钟',
  '5分钟',
  '8分钟',
  '10分钟',
  '15分钟',
  '20分钟',
]);

const BenchmarkProjectSpecSchema = z.object({
  benchmark_id: z.string().min(1),
  source_province: z.string().min(1),
  source_entry: z.string().min(1),
  central_event: z.string().min(1),
  dramatic_question: z.string().min(1),
  creative_brief: z.object({
    target_audience: z.string().min(1),
    platform: z.string().min(1),
    target_duration: SupportedDurationSchema,
    communication_goal: z.string().min(1),
    production_goal: z.string().min(1),
  }),
  audience_promise: z.string().min(1),
  required_evidence_focus: z.array(z.string().min(1)).min(1),
  status: z.literal('awaiting_real_model_run'),
  professional_passed: z.literal(false),
});

const BenchmarkRegistrySchema = z.object({
  schema_version: z.literal('character-story-professional-benchmark-specs/v1'),
  video_type: z.literal('character_story'),
  policy: z.object({
    real_model_output_required: z.literal(true),
    model_and_prompt_version_required: z.literal(true),
    initial_and_final_draft_required: z.literal(true),
    human_blind_review_required_for_professional_pass: z.literal(true),
    fixture_or_simulation_counts_as_professional_pass: z.literal(false),
  }),
  summary: z.object({
    fixed_project_spec_count: z.number().int().nonnegative(),
    fixed_real_model_project_count: z.number().int().nonnegative(),
    fixed_real_model_project_pass_count: z.number().int().nonnegative(),
    failure_fixture_count: z.number().int().nonnegative(),
    human_blind_review_pass_count: z.number().int().nonnegative(),
  }),
  projects: z.array(BenchmarkProjectSpecSchema).length(5),
  failure_fixtures: z.array(z.object({
    fixture_id: z.string().min(1),
    fixture_kind: z.literal('simulation_failure_fixture'),
    expected_hard_gate_ids: z.array(z.string().min(1)).min(1),
    professional_passed: z.literal(false),
  }).passthrough()).min(3),
}).passthrough();

export type CharacterStoryBenchmarkRegistry = z.infer<typeof BenchmarkRegistrySchema>;
export type CharacterStoryBenchmarkProjectSpec = z.infer<typeof BenchmarkProjectSpecSchema>;

export interface BenchmarkStrictReadiness {
  provider: 'dedicated_strict_bridge';
  model_profile_id: string;
  model_runtime: string;
  model_id: string;
  strict_bridge_manifest_path: string;
  strict_bridge_realpath: string | null;
  strict_bridge_sha256: string | null;
  strict_bridge_readable: boolean;
  selected_model_cli_manifest_path: string;
  selected_model_cli_realpath: string | null;
  selected_model_cli_sha256: string | null;
  selected_model_cli_executable: boolean;
  technical_ready: boolean;
  blockers: string[];
}

export interface BenchmarkRuntimeInventory {
  strict_bridge_manifest_path: string;
  strict_bridge_realpath: string | null;
  strict_bridge_sha256: string | null;
  strict_bridge_readable: boolean;
  selected_model_cli_manifest_path: string;
  selected_model_cli_realpath: string | null;
  selected_model_cli_sha256: string | null;
  selected_model_cli_executable: boolean;
}

export interface CharacterStoryBenchmarkExecutionPackage {
  schema_version: 'character-story-professional-benchmark-execution-package/v2';
  benchmark_id: string;
  video_type: 'character_story';
  status: 'source_package_ready';
  source_snapshot: {
    source_entry: string;
    source_province: string;
    source_region: string;
    source_type: string;
    source_era?: string;
    knowledge_base_credibility: string;
    summary: string;
    story: string;
    cultural_significance: string;
    sources: Array<{ source_id: string; citation: string; grade: string }>;
    unverified_points: string[];
    verification_method?: string;
    snapshot_sha256: string;
    claim_level_verification_complete: false;
  };
  creative_contract: {
    central_event: string;
    dramatic_question: string;
    target_audience: string;
    platform: string;
    target_duration: SupportedDuration;
    communication_goal: string;
    production_goal: string;
    audience_promise: string;
  };
  truth_boundary: {
    knowledge_base_claim_status: 'mixed_claims_require_source_level_review';
    required_evidence_focus: string[];
    plausible_dramatization_allowlist: string[];
    fictional_addition_policy: string;
    unknown_or_forbidden_claims: string[];
    required_disclaimers: string[];
  };
  story_generation_request: StoryGenerateRequest;
  execution_contract: {
    execution_kind: 'real_model';
    benchmark_prompt_version: 'character-story-professional-benchmark/v2';
    story_generation_prompt_version: 'story-generation/v1';
    professional_text_package_version: 'professional-text-package/v1';
    model_profile_id: string;
    model_runtime: string;
    model_id: string;
    fallback_allowed_for_benchmark_credit: false;
    fixture_allowed_for_benchmark_credit: false;
    required_artifacts: string[];
  };
  professional_passed: false;
}

export interface CharacterStoryBenchmarkExecutionManifest {
  schema_version: 'character-story-professional-benchmark-execution-manifest/v2';
  generated_at: string;
  video_type: 'character_story';
  strict_readiness: BenchmarkStrictReadiness;
  policy: {
    writes_generated_story: false;
    invokes_model: false;
    source_snapshot_is_professional_pass: false;
    fixture_or_simulation_counts_as_real_run: false;
  };
  summary: {
    fixed_project_spec_count: number;
    source_snapshot_ready_count: number;
    strict_bridge_anchor_ready_count: number;
    strict_cli_anchor_ready_count: number;
    strict_technical_ready_count: number;
    real_model_execution_ready_count: number;
    fixed_real_model_project_count: 0;
    fixed_real_model_project_pass_count: 0;
    human_blind_review_pass_count: 0;
    professional_pass_count: 0;
  };
  packages: CharacterStoryBenchmarkExecutionPackage[];
}

export interface RealModelBenchmarkRunEvidence {
  schema_version: 'professional-benchmark-real-model-run/v1';
  benchmark_id: string;
  run_id: string;
  execution_kind: string;
  generation_mode: string;
  provider: string;
  used_fallback: boolean;
  model_profile_id: string;
  model_id: string;
  benchmark_prompt_version: string;
  source_snapshot_sha256: string;
  initial_story_path: string;
  initial_professional_package_path: string;
  final_professional_package_path: string;
  revision_trace_path: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cost_amount: number;
    cost_currency: string;
  };
}

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sourceGrade(citation: string): string {
  return citation.match(/（([A-D])级/u)?.[1] ?? 'ungraded';
}

function buildBenchmarkInstruction(spec: CharacterStoryBenchmarkProjectSpec): string {
  return [
    `固定专业评测项目：${spec.benchmark_id}`,
    `中心事件：${spec.central_event}`,
    `戏剧问题：${spec.dramatic_question}`,
    `观众承诺：${spec.audience_promise}`,
    `创作目标：${spec.creative_brief.communication_goal}`,
    '必须围绕单一压力事件组织人物目标、阻力、选择、代价和关系变化，不得写成年表。',
    '每场必须有可见行动、冲突或发现、情绪转折以及继续存在的理由。',
    '对白必须区分角色声线并包含潜台词，不得把旁白资料拆成角色台词。',
    '知识库声明、合理戏剧化、明确虚构和未知项必须分层；不得伪造史料原话。',
    `重点核验：${spec.required_evidence_focus.join('；')}`,
  ].join('\n');
}

export function inspectBenchmarkStrictReadiness(input: {
  model_profile_id: string;
  runtime_inventory: BenchmarkRuntimeInventory;
}): BenchmarkStrictReadiness {
  const profile = getModelProfileById(input.model_profile_id);
  const inventory = input.runtime_inventory;
  const strictBridgeAnchorValid = inventory.strict_bridge_readable
    && Boolean(inventory.strict_bridge_realpath && inventory.strict_bridge_sha256)
    && Boolean(inventory.strict_bridge_realpath && /^\//.test(inventory.strict_bridge_realpath))
    && /^[a-f0-9]{64}$/.test(inventory.strict_bridge_sha256 ?? '')
    && inventory.strict_bridge_manifest_path.endsWith('professional-character-benchmark-bridge.mjs');
  const cliAnchorValid = inventory.selected_model_cli_executable
    && Boolean(inventory.selected_model_cli_realpath && inventory.selected_model_cli_sha256)
    && Boolean(inventory.selected_model_cli_realpath && /^\//.test(inventory.selected_model_cli_realpath))
    && /^[a-f0-9]{64}$/.test(inventory.selected_model_cli_sha256 ?? '');
  const blockers = [
    profile ? '' : `unknown_model_profile:${input.model_profile_id}`,
    profile?.runtime === 'claude' || profile?.runtime === 'codex'
      ? ''
      : `unsupported_strict_benchmark_runtime:${profile?.runtime ?? 'unknown'}`,
    strictBridgeAnchorValid ? '' : 'dedicated_strict_bridge_anchor_not_ready',
    cliAnchorValid ? '' : 'selected_model_cli_anchor_not_ready',
  ].filter(Boolean);
  return {
    provider: 'dedicated_strict_bridge',
    model_profile_id: input.model_profile_id,
    model_runtime: profile?.runtime ?? 'unknown',
    model_id: profile?.model ?? 'unknown',
    ...inventory,
    technical_ready: blockers.length === 0,
    blockers,
  };
}

export function buildCharacterStoryBenchmarkExecutionManifest(input: {
  registry: unknown;
  entries: Map<string, EntryDetail>;
  model_profile_id?: string;
  runtime_inventory?: BenchmarkRuntimeInventory;
  now?: string;
}): CharacterStoryBenchmarkExecutionManifest {
  const registry = BenchmarkRegistrySchema.parse(input.registry);
  const modelProfileId = input.model_profile_id ?? 'claude_opus';
  const runtimeInventory = input.runtime_inventory ?? {
    strict_bridge_manifest_path: '',
    strict_bridge_realpath: null,
    strict_bridge_sha256: null,
    strict_bridge_readable: false,
    selected_model_cli_manifest_path: '',
    selected_model_cli_realpath: null,
    selected_model_cli_sha256: null,
    selected_model_cli_executable: false,
  };
  const readiness = inspectBenchmarkStrictReadiness({
    model_profile_id: modelProfileId,
    runtime_inventory: runtimeInventory,
  });
  if (registry.summary.fixed_project_spec_count !== registry.projects.length) {
    throw new Error('Benchmark registry summary does not match project specs');
  }
  if (registry.summary.fixed_real_model_project_count !== 0
    || registry.summary.fixed_real_model_project_pass_count !== 0
    || registry.summary.human_blind_review_pass_count !== 0) {
    throw new Error('Execution preflight cannot import or promote existing benchmark pass claims');
  }

  const packages = registry.projects.map((spec): CharacterStoryBenchmarkExecutionPackage => {
    const entry = input.entries.get(spec.source_entry);
    if (!entry) throw new Error(`Missing knowledge entry for benchmark: ${spec.source_entry}`);
    if (entry.province !== spec.source_province) {
      throw new Error(`Benchmark province mismatch for ${spec.benchmark_id}`);
    }
    if (!entry.story.trim() || entry.sources.length === 0) {
      throw new Error(`Benchmark source is incomplete: ${spec.source_entry}`);
    }
    const sourceContent = {
      source_entry: entry.name,
      source_province: entry.province,
      source_region: entry.region,
      source_type: entry.type,
      source_era: entry.era,
      knowledge_base_credibility: entry.credibility,
      summary: entry.summary,
      story: entry.story,
      cultural_significance: entry.culturalSignificance,
      sources: entry.sources,
      unverified_points: entry.unverifiedPoints,
      verification_method: entry.verificationMethod,
    };
    const sourceSnapshotSha256 = sha256(sourceContent);
    const request: StoryGenerateRequest = {
      entry_name: entry.name,
      original_user_query: buildBenchmarkInstruction(spec),
      video_type: 'character_story',
      model_profile_id: modelProfileId,
      selected_event: spec.central_event,
      target_video_duration: spec.creative_brief.target_duration,
      target_audience: spec.creative_brief.target_audience,
      communication_goal: spec.creative_brief.communication_goal,
      presentation_style: 'cinematic',
      story_structure: 'single_event_drama',
      truth_mode: 'factual_reconstruction',
      source_material_mode: 'generate_from_knowledge',
      genre_strictness: 'strict',
      story_priority: 'balanced',
      auto_repair: true,
      output_gears_segments: false,
    };
    return {
      schema_version: 'character-story-professional-benchmark-execution-package/v2',
      benchmark_id: spec.benchmark_id,
      video_type: 'character_story',
      status: 'source_package_ready',
      source_snapshot: {
        ...sourceContent,
        sources: entry.sources.map((citation, index) => ({
          source_id: `source-${index + 1}`,
          citation,
          grade: sourceGrade(citation),
        })),
        snapshot_sha256: sourceSnapshotSha256,
        claim_level_verification_complete: false,
      },
      creative_contract: {
        central_event: spec.central_event,
        dramatic_question: spec.dramatic_question,
        target_audience: spec.creative_brief.target_audience,
        platform: spec.creative_brief.platform,
        target_duration: spec.creative_brief.target_duration,
        communication_goal: spec.creative_brief.communication_goal,
        production_goal: spec.creative_brief.production_goal,
        audience_promise: spec.audience_promise,
      },
      truth_boundary: {
        knowledge_base_claim_status: 'mixed_claims_require_source_level_review',
        required_evidence_focus: [...spec.required_evidence_focus],
        plausible_dramatization_allowlist: [
          '不改变可核验事件结果的动作、停顿、情绪和非引文对白',
          '符合时代与场景常识但不声称为个人专属史实的服饰、陈设和调度',
          '为呈现选择压力而设置的无名关系角色，必须标记为戏剧化合成人物',
        ],
        fictional_addition_policy: '新增人物、对白、关系和偶合必须显式记录，不得伪装成史料。',
        unknown_or_forbidden_claims: [
          ...entry.unverifiedPoints,
          '不得把知识库未逐条映射来源的叙述写成史料原文或唯一确定版本。',
        ],
        required_disclaimers: [
          '本项目为基于知识条目的影视化创作候选，戏剧化对白与场面不等同史料原文。',
          '进入专业通过前必须完成人工事实与文化审阅。',
        ],
      },
      story_generation_request: request,
      execution_contract: {
        execution_kind: 'real_model',
        benchmark_prompt_version: 'character-story-professional-benchmark/v2',
        story_generation_prompt_version: 'story-generation/v1',
        professional_text_package_version: 'professional-text-package/v1',
        model_profile_id: modelProfileId,
        model_runtime: readiness.model_runtime,
        model_id: readiness.model_id,
        fallback_allowed_for_benchmark_credit: false,
        fixture_allowed_for_benchmark_credit: false,
        required_artifacts: [
          'story-generation-prompt-package.json',
          'initial-story.json',
          'initial-professional-text-package.json',
          'revision-plan.json',
          'final-professional-text-package.json',
          'model-usage-and-cost.json',
          'human-blind-review.json',
        ],
      },
      professional_passed: false,
    };
  });

  return {
    schema_version: 'character-story-professional-benchmark-execution-manifest/v2',
    generated_at: input.now ?? new Date().toISOString(),
    video_type: 'character_story',
    strict_readiness: readiness,
    policy: {
      writes_generated_story: false,
      invokes_model: false,
      source_snapshot_is_professional_pass: false,
      fixture_or_simulation_counts_as_real_run: false,
    },
    summary: {
      fixed_project_spec_count: packages.length,
      source_snapshot_ready_count: packages.length,
      strict_bridge_anchor_ready_count: readiness.strict_bridge_readable ? packages.length : 0,
      strict_cli_anchor_ready_count: readiness.selected_model_cli_executable ? packages.length : 0,
      strict_technical_ready_count: readiness.technical_ready ? packages.length : 0,
      // Operator authorization is deliberately evaluated only by the execute gate.
      real_model_execution_ready_count: 0,
      fixed_real_model_project_count: 0,
      fixed_real_model_project_pass_count: 0,
      human_blind_review_pass_count: 0,
      professional_pass_count: 0,
    },
    packages,
  };
}

export function validateRealModelBenchmarkRunEvidence(input: {
  evidence: RealModelBenchmarkRunEvidence;
  execution_package: CharacterStoryBenchmarkExecutionPackage;
}): { valid: boolean; blockers: string[] } {
  const evidence = input.evidence;
  const executionPackage = input.execution_package;
  const blockers = [
    evidence.schema_version === 'professional-benchmark-real-model-run/v1' ? '' : 'invalid_schema_version',
    evidence.benchmark_id === executionPackage.benchmark_id ? '' : 'benchmark_id_mismatch',
    evidence.execution_kind === 'real_model' ? '' : 'execution_kind_not_real_model',
    evidence.generation_mode === 'external_model' ? '' : 'generation_mode_not_external_model',
    evidence.provider && !/local|fixture|simulation/i.test(evidence.provider) ? '' : 'provider_not_external',
    evidence.used_fallback === false ? '' : 'fallback_output_not_allowed',
    evidence.model_profile_id === executionPackage.execution_contract.model_profile_id ? '' : 'model_profile_mismatch',
    evidence.model_id === executionPackage.execution_contract.model_id ? '' : 'model_id_mismatch',
    evidence.benchmark_prompt_version === executionPackage.execution_contract.benchmark_prompt_version
      ? ''
      : 'benchmark_prompt_version_mismatch',
    evidence.source_snapshot_sha256 === executionPackage.source_snapshot.snapshot_sha256
      ? ''
      : 'source_snapshot_mismatch',
    evidence.initial_story_path.trim() ? '' : 'initial_story_missing',
    evidence.initial_professional_package_path.trim() ? '' : 'initial_professional_package_missing',
    evidence.final_professional_package_path.trim() ? '' : 'final_professional_package_missing',
    evidence.revision_trace_path.trim() ? '' : 'revision_trace_missing',
    evidence.usage.input_tokens >= 0 && evidence.usage.output_tokens > 0 ? '' : 'model_usage_missing',
    evidence.usage.cost_amount >= 0 && evidence.usage.cost_currency.trim() ? '' : 'model_cost_record_missing',
  ].filter(Boolean);
  return { valid: blockers.length === 0, blockers };
}
