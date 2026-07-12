import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PROFESSIONAL_BENCHMARK_PERSISTED_ARTIFACT_TAXONOMY,
  validateProfessionalBenchmarkArtifacts,
  type ProfessionalBenchmarkArtifactKind,
  type ProfessionalBenchmarkArtifactProducer,
  type ProfessionalBenchmarkArtifactReference,
} from '../services/professional-benchmark-artifact-service.js';

const tempRoots: string[] = [];
const benchmarkId = 'benchmark-001';
const runId = 'run-001';
const createdAt = '2026-07-11T03:00:00.000Z';

const payloadSchemaVersions: Record<ProfessionalBenchmarkArtifactKind, string> = {
  prompt_package: 'character-story-professional-benchmark-prompt/v2',
  provider_receipt: 'professional-benchmark-provider-receipt/v1',
  initial_story: 'professional-benchmark-initial-story/v2',
  character_evidence: 'character-story-professional-evidence/v1',
  initial_professional_package: 'professional-text-package/v1',
  quality_report: 'professional-text-quality-report/v1',
  revision_plan: 'professional-text-revision-plan/v1',
  revision_output: 'professional-benchmark-revision-output/v1',
  final_professional_package: 'professional-text-package/v1',
  final_quality_report: 'professional-benchmark-quality-snapshot/v1',
  usage_and_cost: 'professional-benchmark-usage-and-cost/v1',
  human_blind_review: 'professional-benchmark-blind-review/v2',
};

const defaultProducers: Record<ProfessionalBenchmarkArtifactKind, ProfessionalBenchmarkArtifactProducer> = {
  prompt_package: 'runner',
  provider_receipt: 'model',
  initial_story: 'model',
  character_evidence: 'model',
  initial_professional_package: 'agent',
  quality_report: 'agent',
  revision_plan: 'agent',
  revision_output: 'agent',
  final_professional_package: 'agent',
  final_quality_report: 'agent',
  usage_and_cost: 'runner',
  human_blind_review: 'human_reviewer',
};

afterEach(async () => {
  for (const root of tempRoots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function makeRunRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'professional-benchmark-artifacts-'));
  tempRoots.push(root);
  return root;
}

async function writeArtifact(input: {
  root: string;
  id: string;
  kind: ProfessionalBenchmarkArtifactKind;
  payload: unknown;
  parents?: ProfessionalBenchmarkArtifactReference[];
  producer?: ProfessionalBenchmarkArtifactProducer;
  relativePath?: string;
  payloadSchemaVersion?: string;
}): Promise<ProfessionalBenchmarkArtifactReference> {
  const relativePath = input.relativePath ?? `artifacts/${input.id}.json`;
  const filePath = path.join(input.root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  const parentHashes = (input.parents ?? []).map(parent => parent.sha256);
  const producer = input.producer ?? defaultProducers[input.kind];
  const payloadSchemaVersion = input.payloadSchemaVersion ?? payloadSchemaVersions[input.kind];
  const envelope = {
    schema_version: 'professional-benchmark-artifact-envelope/v1',
    artifact_id: input.id,
    benchmark_id: benchmarkId,
    run_id: runId,
    artifact_kind: input.kind,
    payload_schema_version: payloadSchemaVersion,
    created_at: createdAt,
    producer,
    parent_artifact_sha256: parentHashes,
    payload: input.payload,
  };
  const content = `${JSON.stringify(envelope, null, 2)}\n`;
  await writeFile(filePath, content, 'utf8');
  return {
    artifact_id: input.id,
    kind: input.kind,
    relative_path: relativePath,
    sha256: createHash('sha256').update(content).digest('hex'),
    byte_size: Buffer.byteLength(content),
    payload_schema_version: payloadSchemaVersion,
    created_at: createdAt,
    producer,
    parent_artifact_sha256: parentHashes,
  };
}

function promptPayload(): Record<string, unknown> {
  return {
    schema_version: 'character-story-professional-benchmark-prompt/v2',
    benchmark_id: benchmarkId,
    video_type: 'character_story',
    benchmark_prompt_version: 'character-story-professional-benchmark/v2',
    story_generation_prompt_version: 'story-generation/v1',
    source_snapshot_sha256: '1'.repeat(64),
    benchmark_instruction_sha256: '2'.repeat(64),
    base_story_prompt_sha256: '3'.repeat(64),
    story_blueprint: { blueprint_id: 'blueprint-001' },
    story_generation_prompt: {
      prompt_version: 'story-generation/v1',
      system_prompt: '系统提示',
      user_prompt: '用户提示',
      output_contract: {
        must_provide: ['完整故事'],
        should_respect: ['事实边界'],
        return_json_fields: ['full_text'],
      },
    },
    story_scene_output_contract: {
      schema_version: 'character-story-professional-scene/v1',
      root_field: 'story.scene_breakdown[]',
      required_fields: [
        'scene_id', 'title', 'duration_sec', 'location', 'time_of_day',
        'dramatic_function', 'plot', 'key_action', 'characters', 'visual_prompt',
        'camera_suggestion', 'cultural_note', 'conflict', 'dialogue_or_narration',
        'source_entries', 'factual_basis', 'fictionalized_elements',
      ],
      constraints: { coordinator_must_not_infer_or_backfill_missing_scene_fields: true },
      json_shape: { duration_sec: 'number > 0' },
    },
    character_evidence_output_contract: {
      schema_version: 'character-story-professional-evidence/v1',
      required_fields: [
        'protagonist', 'goal', 'resistance', 'choice', 'cost',
        'starting_relationship_state', 'ending_relationship_state', 'internal_change',
        'dialogue_voice_rules', 'subtext_strategy', 'scene_turns',
      ],
      constraints: { relationship_states_must_differ: true },
    },
    prompt_sha256: '4'.repeat(64),
    professional_passed: false,
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`
    ).join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('non_json_value');
  return encoded;
}

function canonicalSha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function withoutSchemaVersion(value: Record<string, unknown>): Record<string, unknown> {
  const { schema_version: _schemaVersion, ...content } = value;
  return content;
}

function providerReceiptPayload(reportedModelId = 'claude-opus-4-1-20250805'): Record<string, unknown> {
  return {
    schema_version: 'professional-benchmark-provider-receipt/v1',
    benchmark_id: benchmarkId,
    run_id: runId,
    provider: 'claude_cli',
    runtime: 'claude',
    requested_model_id: 'opus',
    reported_model_id: reportedModelId,
    prompt_sha256: '4'.repeat(64),
    provider_response_sha256: '5'.repeat(64),
    bridge_envelope_sha256: 'a'.repeat(64),
    story_sha256: 'b'.repeat(64),
    character_evidence_sha256: 'c'.repeat(64),
    used_fallback: false,
    provenance_complete: true,
    exit_code: 0,
    cli_realpath: '/usr/local/bin/claude',
    cli_sha256: '7'.repeat(64),
    cli_version: '1.0.0',
    operator_authorization: {
      reference_sha256: '8'.repeat(64),
      budget_cap: { amount: 5, currency: 'USD' },
    },
    started_at: '2026-07-11T03:00:00.000Z',
    finished_at: '2026-07-11T03:00:01.000Z',
  };
}

function storyPayload(): Record<string, unknown> {
  return {
    schema_version: 'professional-benchmark-initial-story/v2',
    title: '候选故事',
    logline: '一件信物迫使人物作出不可撤回的选择。',
    theme: '承担选择才会改变关系。',
    full_text: '人物在可见阻力中作出选择并承担代价。',
    scene_breakdown: [{
      scene_id: 1,
      title: '交出信物',
      duration_sec: 60,
      location: '院落',
      time_of_day: '清晨',
      dramatic_function: '以不可逆行动完成选择',
      plot: '族规逼迫主角在身份与承诺之间选择。',
      key_action: '主角交出信物',
      characters: ['主角', '族中长辈'],
      visual_prompt: '清晨院落，信物在两人之间交接。',
      camera_suggestion: '手部特写转双人中景。',
      cultural_note: '信物与礼仪须依来源复核。',
      conflict: '保住身份与履行承诺不可兼得。',
      dialogue_or_narration: '主角：东西留下，后果我担。',
      source_entries: ['benchmark-001-source-entry'],
      factual_basis: '人物与信物关系来自冻结来源。',
      fictionalized_elements: ['具体交接动作和对白为戏剧化补足。'],
    }],
    cultural_constraints: ['不得将影视对白表述为史料原话。'],
    credibility_note: '事实依据与戏剧化内容已逐场标注。',
  };
}

function evidencePayload(): Record<string, unknown> {
  return {
    schema_version: 'character-story-professional-evidence/v1',
    protagonist: '主角',
    goal: '保住信物',
    resistance: '族规阻拦',
    choice: '主动交出信物',
    cost: '失去继承资格',
    starting_relationship_state: '彼此戒备',
    ending_relationship_state: '建立有限信任',
    internal_change: '从逃避转为承担',
    dialogue_voice_rules: ['主角短句克制', '长辈使用规训式反问'],
    subtext_strategy: '表面争论信物，实际争夺承认。',
    scene_turns: { '1': '从僵持转为不可逆选择' },
  };
}

const qualityDimensionIds = [
  'creative_brief_and_audience_promise',
  'premise_and_theme_unity',
  'structure_causality_and_pacing',
  'character_agency_and_relationship_change',
  'scene_function_visible_action_and_blocking',
  'dialogue_narration_and_subtext',
  'emotional_curve_and_aftertaste',
  'cultural_fact_and_adaptation_boundary',
  'production_executability',
  'originality_and_distinctiveness',
] as const;

function professionalPackagePayload(packageId: string): Record<string, unknown> {
  return {
    schema_version: 'professional-text-package/v1',
    package_id: packageId,
    video_type: 'character_story',
    status: 'revision_required',
    created_at: createdAt,
    updated_at: createdAt,
    contract_version: 'professional-text-package/v1',
    creative_brief: {
      target_audience: '大众文化观众',
      platform: '短视频平台',
      target_duration: '5 分钟',
      communication_goal: '通过人物选择呈现文化价值',
    },
    truth_and_adaptation_contract: {
      truth_mode: 'fact_and_dramatization_separated',
      verified_facts: [],
      plausible_dramatizations: [],
      fictional_additions: [],
      unknown_or_forbidden_claims: [],
    },
    audience_promise: '观众将看到人物承担选择的代价。',
    premise_or_core_question: '人物是否愿意为承诺付出身份代价？',
    theme_statement: '承担选择才会改变关系。',
    scene_breakdown: [{ scene_id: 1, title: '交出信物', key_action: '主角交出信物' }],
    full_text: '人物在可见阻力中作出选择并承担代价。',
    quality_report: {
      status: 'failed',
      dimensions: [{ dimension_id: qualityDimensionIds[0], score: 70 }],
      hard_gate_failures: [],
      professional_passed: false,
    },
    delivery_text_package: {
      script_text: '人物在可见阻力中作出选择并承担代价。',
      scene_units: [{ scene_id: 1, script_text: '主角交出信物。' }],
      validation_notes: [],
    },
  };
}

function qualityReportPayload(): Record<string, unknown> {
  return {
    schema_version: 'professional-text-quality-report/v1',
    status: 'production_candidate',
    total_score: 80,
    dimensions: qualityDimensionIds.map(dimension_id => ({
      dimension_id,
      weight: 10,
      score: 80,
      evidence: ['机器初评证据'],
      issues: [],
    })),
    hard_gate_failures: [],
    evaluator_notes: ['仅作为修订输入，不授予专业通过。'],
    professional_passed: false,
  };
}

function revisionPlanPayload(): Record<string, unknown> {
  return {
    schema_version: 'professional-text-revision-plan/v1',
    package_id: 'initial-package',
    video_type: 'character_story',
    action_count: 1,
    deterministic_action_count: 0,
    model_rewrite_action_count: 1,
    human_evidence_action_count: 0,
    actions: [{
      action_id: 'rewrite-1',
      issue_id: 'dialogue-subtext',
      instruction: '强化对白潜台词。',
      target_sections: ['full_text'],
      repair_mode: 'model_rewrite_required',
      rebuild_derived_sections: ['scene_breakdown'],
    }],
    professional_passed: false,
  };
}

function finalQualityReportPayload(
  finalPackageSha256: string,
): Record<string, unknown> {
  return {
    schema_version: 'professional-benchmark-quality-snapshot/v1',
    package_sha256: finalPackageSha256,
    total_score: 86,
    dimension_scores: Object.fromEntries(qualityDimensionIds.map(dimensionId => [dimensionId, 86])),
    hard_gate_failures: [],
    evaluator_id: 'professional-text-quality-service',
    evaluator_version: 'v1',
    measured_at: createdAt,
  };
}

function usagePayload(providerReceiptSha256: string): Record<string, unknown> {
  return {
    schema_version: 'professional-benchmark-usage-and-cost/v1',
    benchmark_id: benchmarkId,
    run_id: runId,
    provider: 'claude_cli',
    runtime: 'claude',
    model_id: 'claude-opus-4-1-20250805',
    input_tokens: 1200,
    output_tokens: 800,
    cached_input_tokens: 0,
    cost_amount: 0.5,
    cost_currency: 'USD',
    usage_source: 'provider_reported',
    provider_receipt_sha256: providerReceiptSha256,
  };
}

function blindReviewPayload(finalPackageSha256: string): Record<string, unknown> {
  const dimensions = [
    'creative_brief_and_audience_promise', 'premise_and_theme_unity',
    'structure_causality_and_pacing', 'character_agency_and_relationship_change',
    'scene_function_visible_action_and_blocking', 'dialogue_narration_and_subtext',
    'emotional_curve_and_aftertaste', 'cultural_fact_and_adaptation_boundary',
    'production_executability', 'originality_and_distinctiveness',
  ];
  const roles = ['screenwriter_or_script_editor', 'genre_or_director_reviewer', 'fact_or_culture_reviewer'];
  return {
    schema_version: 'professional-benchmark-blind-review/v2',
    benchmark_id: benchmarkId,
    video_type: 'character_story',
    run_id: runId,
    final_package_sha256: finalPackageSha256,
    candidate_label: 'candidate-A',
    randomization_batch_id: 'batch-001',
    evaluator_did_not_know_origin: true,
    baseline: {
      baseline_id: 'baseline-001',
      artifact_sha256: '6'.repeat(64),
      rights: 'licensed',
      average_score: 85,
    },
    reviews: roles.map((role, index) => ({
      review_id: `review-${index + 1}`,
      reviewer_id: `human-${index + 1}`,
      role,
      candidate_label: 'candidate-A',
      blind_review_declared: true,
      independent_review_declared: true,
      conflict_of_interest_declared: false,
      scores: dimensions.map(dimension_id => ({ dimension_id, score: 86, note: '独立盲评记录' })),
      hard_gate_failures: [],
      fact_or_culture_issues: [],
      production_advance_vote: true,
      submitted_at: createdAt,
    })),
  };
}

async function buildInitialChain(root: string, input?: {
  promptPayload?: unknown;
  storyPayload?: unknown;
  evidencePayload?: unknown;
  bridgeStoryContent?: Record<string, unknown>;
  bridgeEvidenceContent?: Record<string, unknown>;
  reportedModelId?: string;
  receiptOverrides?: Record<string, unknown>;
  bridgeOverrides?: Record<string, unknown>;
  usageParent?: 'prompt' | 'receipt';
}): Promise<ProfessionalBenchmarkArtifactReference[]> {
  const persistedStory = (input?.storyPayload ?? storyPayload()) as Record<string, unknown>;
  const persistedEvidence = (input?.evidencePayload ?? evidencePayload()) as Record<string, unknown>;
  const bridgeStory = input?.bridgeStoryContent ?? withoutSchemaVersion(persistedStory);
  const bridgeEvidence = input?.bridgeEvidenceContent ?? withoutSchemaVersion(persistedEvidence);
  const storySha256 = canonicalSha256(bridgeStory);
  const characterEvidenceSha256 = canonicalSha256(bridgeEvidence);
  const bridgeEnvelope = {
    schema_version: 'professional-character-benchmark-bridge-output/v2',
    benchmark_id: benchmarkId,
    run_id: runId,
    story: bridgeStory,
    character_evidence: bridgeEvidence,
    provenance: {
      story_sha256: storySha256,
      character_evidence_sha256: characterEvidenceSha256,
    },
    ...input?.bridgeOverrides,
  };
  await writeFile(
    path.join(root, 'strict-bridge-envelope.json'),
    `${JSON.stringify(bridgeEnvelope, null, 2)}\n`,
    'utf8',
  );
  const prompt = await writeArtifact({
    root,
    id: 'prompt',
    kind: 'prompt_package',
    payload: input?.promptPayload ?? promptPayload(),
  });
  const receipt = await writeArtifact({
    root,
    id: 'receipt',
    kind: 'provider_receipt',
    payload: {
      ...providerReceiptPayload(input?.reportedModelId),
      bridge_envelope_sha256: canonicalSha256(bridgeEnvelope),
      story_sha256: storySha256,
      character_evidence_sha256: characterEvidenceSha256,
      ...input?.receiptOverrides,
    },
    parents: [prompt],
  });
  const story = await writeArtifact({
    root,
    id: 'story',
    kind: 'initial_story',
    payload: persistedStory,
    parents: [prompt, receipt],
  });
  const evidence = await writeArtifact({
    root,
    id: 'evidence',
    kind: 'character_evidence',
    payload: persistedEvidence,
    parents: [story],
  });
  const usage = await writeArtifact({
    root,
    id: 'usage',
    kind: 'usage_and_cost',
    payload: usagePayload(receipt.sha256),
    parents: [input?.usageParent === 'prompt' ? prompt : receipt],
  });
  return [prompt, receipt, story, evidence, usage];
}

async function buildCompletionChain(root: string): Promise<ProfessionalBenchmarkArtifactReference[]> {
  const initialArtifacts = await buildInitialChain(root);
  const story = initialArtifacts.find(artifact => artifact.kind === 'initial_story')!;
  const evidence = initialArtifacts.find(artifact => artifact.kind === 'character_evidence')!;
  const initialPackage = await writeArtifact({
    root,
    id: 'initial-package',
    kind: 'initial_professional_package',
    payload: professionalPackagePayload('initial-package'),
    parents: [story, evidence],
  });
  const quality = await writeArtifact({
    root,
    id: 'quality',
    kind: 'quality_report',
    payload: qualityReportPayload(),
    parents: [initialPackage, evidence],
  });
  const revisionPlan = await writeArtifact({
    root,
    id: 'revision-plan',
    kind: 'revision_plan',
    payload: revisionPlanPayload(),
    parents: [initialPackage, quality],
  });
  const revisionOutput = await writeArtifact({
    root,
    id: 'revision-output',
    kind: 'revision_output',
    payload: {
      schema_version: 'professional-benchmark-revision-output/v1',
      revision_id: 'revision-001',
      source_package_sha256: initialPackage.sha256,
      revision_plan_sha256: revisionPlan.sha256,
      applied_action_ids: ['rewrite-1'],
      unresolved_issue_ids: [],
      revised_package: professionalPackagePayload('final-package'),
      completed_at: createdAt,
      professional_passed: false,
    },
    parents: [initialPackage, revisionPlan],
  });
  const finalPackage = await writeArtifact({
    root,
    id: 'final-package',
    kind: 'final_professional_package',
    payload: professionalPackagePayload('final-package'),
    parents: [evidence, revisionOutput],
  });
  const finalQuality = await writeArtifact({
    root,
    id: 'final-quality',
    kind: 'final_quality_report',
    payload: finalQualityReportPayload(finalPackage.sha256),
    parents: [finalPackage, revisionOutput],
  });
  const blindReview = await writeArtifact({
    root,
    id: 'blind-review',
    kind: 'human_blind_review',
    payload: blindReviewPayload(finalPackage.sha256),
    parents: [finalPackage],
  });
  return [
    ...initialArtifacts,
    initialPackage,
    quality,
    revisionPlan,
    revisionOutput,
    finalPackage,
    finalQuality,
    blindReview,
  ];
}

function validationInput(root: string, artifacts: ProfessionalBenchmarkArtifactReference[]) {
  return {
    run_root: root,
    benchmark_id: benchmarkId,
    run_id: runId,
    artifacts,
    validation_profile: 'initial_run' as const,
  };
}

describe('professional benchmark artifact validation', () => {
  it('validates the fixed five-artifact initial chain without awarding professional credit', async () => {
    const root = await makeRunRoot();
    const artifacts = await buildInitialChain(root);

    await expect(validateProfessionalBenchmarkArtifacts(validationInput(root, artifacts))).resolves.toEqual({
      integrity_valid: true,
      contract_valid: true,
      professional_passed: false,
      verified_artifact_count: 5,
      blockers: [],
    });
  });

  it('validates the twelve-artifact completion chain while keeping professional credit false', async () => {
    const root = await makeRunRoot();
    const artifacts = await buildCompletionChain(root);

    await expect(validateProfessionalBenchmarkArtifacts({
      ...validationInput(root, artifacts),
      validation_profile: 'professional_completion',
    })).resolves.toEqual({
      integrity_valid: true,
      contract_valid: true,
      professional_passed: false,
      verified_artifact_count: 12,
      blockers: [],
    });
  });

  it.each(['bridge_envelope_sha256', 'story_sha256', 'character_evidence_sha256'] as const)(
    'requires provider receipt binding field %s',
    async field => {
      const root = await makeRunRoot();
      const artifacts = await buildInitialChain(root, { receiptOverrides: { [field]: undefined } });

      const result = await validateProfessionalBenchmarkArtifacts(validationInput(root, artifacts));
      expect(result.contract_valid).toBe(false);
      expect(result.blockers).toContain('artifact_payload_schema_invalid:receipt');
    },
  );

  it('binds provider receipt to the canonical persisted strict bridge envelope', async () => {
    const root = await makeRunRoot();
    const artifacts = await buildInitialChain(root);
    const bridgePath = path.join(root, 'strict-bridge-envelope.json');
    const bridge = JSON.parse(await readFile(bridgePath, 'utf8')) as Record<string, unknown>;
    await writeFile(bridgePath, `${JSON.stringify({ ...bridge, tampered: true }, null, 2)}\n`, 'utf8');

    const result = await validateProfessionalBenchmarkArtifacts(validationInput(root, artifacts));
    expect(result.contract_valid).toBe(false);
    expect(result.blockers).toContain('artifact_bridge_envelope_sha256_mismatch:receipt');
  });

  it('requires the strict bridge envelope evidence file to remain present', async () => {
    const root = await makeRunRoot();
    const artifacts = await buildInitialChain(root);
    await rm(path.join(root, 'strict-bridge-envelope.json'));

    const result = await validateProfessionalBenchmarkArtifacts(validationInput(root, artifacts));
    expect(result.integrity_valid).toBe(false);
    expect(result.blockers).toContain('artifact_bridge_envelope_missing_or_invalid:receipt');
  });

  it('cross-binds persisted initial story content to its provider receipt hash', async () => {
    const root = await makeRunRoot();
    const bridgeStory = withoutSchemaVersion(storyPayload());
    bridgeStory.full_text = '与持久化故事不同的桥接内容。';
    const artifacts = await buildInitialChain(root, { bridgeStoryContent: bridgeStory });

    const result = await validateProfessionalBenchmarkArtifacts(validationInput(root, artifacts));
    expect(result.contract_valid).toBe(false);
    expect(result.blockers).toContain('artifact_payload_receipt_hash_mismatch:story:story_sha256');
  });

  it('cross-binds persisted character evidence content to its provider receipt hash', async () => {
    const root = await makeRunRoot();
    const bridgeEvidence = withoutSchemaVersion(evidencePayload());
    bridgeEvidence.subtext_strategy = '与持久化证据不同的桥接内容。';
    const artifacts = await buildInitialChain(root, { bridgeEvidenceContent: bridgeEvidence });

    const result = await validateProfessionalBenchmarkArtifacts(validationInput(root, artifacts));
    expect(result.contract_valid).toBe(false);
    expect(result.blockers).toContain(
      'artifact_payload_receipt_hash_mismatch:evidence:character_evidence_sha256',
    );
  });

  it('requires the independent final quality report in professional completion', async () => {
    const root = await makeRunRoot();
    const artifacts = (await buildCompletionChain(root)).filter(
      artifact => artifact.kind !== 'final_quality_report',
    );

    const result = await validateProfessionalBenchmarkArtifacts({
      ...validationInput(root, artifacts),
      validation_profile: 'professional_completion',
    });
    expect(result.contract_valid).toBe(false);
    expect(result.blockers).toContain('required_artifact_missing:final_quality_report');
  });

  it('binds final quality payload to its final package while preserving the revision parent in the DAG', async () => {
    const root = await makeRunRoot();
    const artifacts = await buildCompletionChain(root);
    const index = artifacts.findIndex(artifact => artifact.kind === 'final_quality_report');
    const finalPackage = artifacts.find(artifact => artifact.kind === 'final_professional_package')!;
    const revisionOutput = artifacts.find(artifact => artifact.kind === 'revision_output')!;
    artifacts[index] = await writeArtifact({
      root,
      id: 'final-quality',
      kind: 'final_quality_report',
      payload: finalQualityReportPayload('f'.repeat(64)),
      parents: [finalPackage, revisionOutput],
    });

    const result = await validateProfessionalBenchmarkArtifacts({
      ...validationInput(root, artifacts),
      validation_profile: 'professional_completion',
    });
    expect(result.contract_valid).toBe(false);
    expect(result.blockers).toContain(
      'artifact_payload_parent_hash_mismatch:final-quality:final_professional_package',
    );
  });

  it.each([
    ['professional_passed', false],
    ['provider', 'local_fixture'],
    ['generation_mode', 'simulation'],
  ])('rejects reserved final quality field %s', async (field, value) => {
    const root = await makeRunRoot();
    const artifacts = await buildCompletionChain(root);
    const index = artifacts.findIndex(artifact => artifact.kind === 'final_quality_report');
    const finalPackage = artifacts.find(artifact => artifact.kind === 'final_professional_package')!;
    const revisionOutput = artifacts.find(artifact => artifact.kind === 'revision_output')!;
    artifacts[index] = await writeArtifact({
      root,
      id: 'final-quality',
      kind: 'final_quality_report',
      payload: {
        ...finalQualityReportPayload(finalPackage.sha256),
        [field]: value,
      },
      parents: [finalPackage, revisionOutput],
    });

    const result = await validateProfessionalBenchmarkArtifacts({
      ...validationInput(root, artifacts),
      validation_profile: 'professional_completion',
    });
    expect(result.contract_valid).toBe(false);
    expect(result.professional_passed).toBe(false);
    expect(result.blockers).toContain('artifact_payload_schema_invalid:final-quality');
  });

  it('requires exactly all ten named dimension scores in final quality evidence', async () => {
    const root = await makeRunRoot();
    const artifacts = await buildCompletionChain(root);
    const index = artifacts.findIndex(artifact => artifact.kind === 'final_quality_report');
    const finalPackage = artifacts.find(artifact => artifact.kind === 'final_professional_package')!;
    const revisionOutput = artifacts.find(artifact => artifact.kind === 'revision_output')!;
    const payload = finalQualityReportPayload(finalPackage.sha256);
    delete (payload.dimension_scores as Record<string, number>).originality_and_distinctiveness;
    artifacts[index] = await writeArtifact({
      root,
      id: 'final-quality',
      kind: 'final_quality_report',
      payload,
      parents: [finalPackage, revisionOutput],
    });

    const result = await validateProfessionalBenchmarkArtifacts({
      ...validationInput(root, artifacts),
      validation_profile: 'professional_completion',
    });
    expect(result.contract_valid).toBe(false);
    expect(result.blockers).toContain('artifact_payload_schema_invalid:final-quality');
  });

  it('keeps profiles fixed: initial requires five kinds and completion requires all twelve', async () => {
    const root = await makeRunRoot();
    const artifacts = await buildInitialChain(root);
    const empty = await validateProfessionalBenchmarkArtifacts(validationInput(root, []));
    expect(empty.contract_valid).toBe(false);
    expect(empty.blockers.filter(blocker => blocker.startsWith('required_artifact_missing:'))).toHaveLength(5);

    const completion = await validateProfessionalBenchmarkArtifacts({
      ...validationInput(root, artifacts),
      validation_profile: 'professional_completion',
    });
    expect(completion.contract_valid).toBe(false);
    expect(completion.blockers.filter(blocker => blocker.startsWith('required_artifact_missing:'))).toHaveLength(7);

    const invalidProfile = await validateProfessionalBenchmarkArtifacts({
      ...validationInput(root, artifacts),
      validation_profile: 'caller_selected_subset' as never,
    });
    expect(invalidProfile.blockers).toEqual(['validation_profile_invalid']);
  });

  it('rejects missing files and required artifacts', async () => {
    const root = await makeRunRoot();
    const artifacts = await buildInitialChain(root);
    const withoutEvidence = artifacts.filter(artifact => artifact.kind !== 'character_evidence');
    withoutEvidence[0] = { ...withoutEvidence[0], relative_path: 'artifacts/does-not-exist.json' };

    const result = await validateProfessionalBenchmarkArtifacts(validationInput(root, withoutEvidence));
    expect(result.integrity_valid).toBe(false);
    expect(result.contract_valid).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'required_artifact_missing:character_evidence',
      'artifact_file_missing:prompt',
    ]));
  });

  it('rejects content changed after its size and SHA were recorded', async () => {
    const root = await makeRunRoot();
    const artifacts = await buildInitialChain(root);
    const story = artifacts.find(artifact => artifact.kind === 'initial_story')!;
    await writeFile(path.join(root, story.relative_path), '{"tampered":true}\n', 'utf8');

    const result = await validateProfessionalBenchmarkArtifacts(validationInput(root, artifacts));
    expect(result.integrity_valid).toBe(false);
    expect(result.blockers.some(blocker =>
      blocker === 'artifact_size_mismatch:story' || blocker === 'artifact_sha256_mismatch:story'
    )).toBe(true);
  });

  it('rejects traversal and symlinks instead of trusting canonicalized paths', async () => {
    const root = await makeRunRoot();
    const outsideRoot = await makeRunRoot();
    const outsideFile = path.join(outsideRoot, 'outside.json');
    await writeFile(outsideFile, '{"outside":true}\n', 'utf8');
    await symlink(outsideFile, path.join(root, 'outside-link.json'));
    const artifacts = await buildInitialChain(root);
    const [prompt, receipt] = artifacts;
    artifacts[0] = { ...prompt, relative_path: '../outside.json' };
    artifacts[1] = { ...receipt, relative_path: 'outside-link.json' };

    const result = await validateProfessionalBenchmarkArtifacts(validationInput(root, artifacts));
    expect(result.integrity_valid).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'artifact_path_outside_run_root:prompt',
      'artifact_symlink_not_allowed:receipt',
    ]));
  });

  it('rejects cross-kind masquerading even when the referenced bytes are valid', async () => {
    const root = await makeRunRoot();
    const artifacts = await buildInitialChain(root);
    const storyIndex = artifacts.findIndex(artifact => artifact.kind === 'initial_story');
    artifacts[storyIndex] = { ...artifacts[storyIndex], kind: 'character_evidence' };

    const result = await validateProfessionalBenchmarkArtifacts(validationInput(root, artifacts));
    expect(result.integrity_valid).toBe(false);
    expect(result.blockers).toContain('artifact_reference_envelope_mismatch:story');
    expect(result.blockers).toContain('required_artifact_missing:initial_story');
  });

  it.each(Object.keys(payloadSchemaVersions) as ProfessionalBenchmarkArtifactKind[])(
    'rejects an empty %s payload through its kind-specific Zod contract',
    async kind => {
      const root = await makeRunRoot();
      const artifact = await writeArtifact({ root, id: `empty-${kind}`, kind, payload: {} });
      const result = await validateProfessionalBenchmarkArtifacts({
        ...validationInput(root, [artifact]),
        validation_profile: kind === 'prompt_package' ? 'initial_run' : 'professional_completion',
      });
      expect(result.contract_valid).toBe(false);
      expect(result.blockers).toContain(`artifact_payload_schema_invalid:empty-${kind}`);
    },
  );

  it('accepts only controlled provider model aliases and rejects misleading substrings', async () => {
    const acceptedRoot = await makeRunRoot();
    const accepted = await buildInitialChain(acceptedRoot, {
      reportedModelId: 'claude-opus-4-1-20250805',
    });
    expect((await validateProfessionalBenchmarkArtifacts(validationInput(acceptedRoot, accepted))).contract_valid)
      .toBe(true);

    const rejectedRoot = await makeRunRoot();
    const rejected = await buildInitialChain(rejectedRoot, {
      reportedModelId: 'not-opus-simulated',
    });
    const result = await validateProfessionalBenchmarkArtifacts(validationInput(rejectedRoot, rejected));
    expect(result.contract_valid).toBe(false);
    expect(result.blockers).toContain('artifact_payload_schema_invalid:receipt');
  });

  it('rejects pass or provenance claims embedded in a persisted story payload', async () => {
    const root = await makeRunRoot();
    const artifacts = await buildInitialChain(root, {
      storyPayload: { ...storyPayload(), professional_passed: true },
    });

    const result = await validateProfessionalBenchmarkArtifacts(validationInput(root, artifacts));
    expect(result.contract_valid).toBe(false);
    expect(result.professional_passed).toBe(false);
    expect(result.blockers).toContain('artifact_payload_schema_invalid:story');
  });

  it('rejects a legacy v1 prompt payload under the v2 artifact policy', async () => {
    const root = await makeRunRoot();
    const legacyPrompt = {
      ...promptPayload(),
      schema_version: 'character-story-professional-benchmark-prompt/v1',
      benchmark_prompt_version: 'character-story-professional-benchmark/v1',
    };
    const artifacts = await buildInitialChain(root, { promptPayload: legacyPrompt });

    const result = await validateProfessionalBenchmarkArtifacts(validationInput(root, artifacts));
    expect(result.contract_valid).toBe(false);
    expect(result.blockers).toContain('artifact_payload_schema_invalid:prompt');
  });

  it('rejects a legacy v1 initial-story payload under the v2 artifact policy', async () => {
    const root = await makeRunRoot();
    const legacyStory = {
      ...storyPayload(),
      schema_version: 'professional-benchmark-initial-story/v1',
    };
    const artifacts = await buildInitialChain(root, { storyPayload: legacyStory });

    const result = await validateProfessionalBenchmarkArtifacts(validationInput(root, artifacts));
    expect(result.contract_valid).toBe(false);
    expect(result.blockers).toContain('artifact_payload_schema_invalid:story');
  });

  it.each([
    ['missing factual basis', () => {
      const payload = storyPayload();
      delete (payload.scene_breakdown as Array<Record<string, unknown>>)[0].factual_basis;
      return payload;
    }],
    ['empty source entries', () => {
      const payload = storyPayload();
      (payload.scene_breakdown as Array<Record<string, unknown>>)[0].source_entries = [];
      return payload;
    }],
    ['non-positive duration', () => {
      const payload = storyPayload();
      (payload.scene_breakdown as Array<Record<string, unknown>>)[0].duration_sec = 0;
      return payload;
    }],
  ])('rejects incomplete initial story scene payload: %s', async (_label, makePayload) => {
    const root = await makeRunRoot();
    const artifacts = await buildInitialChain(root, { storyPayload: makePayload() });

    const result = await validateProfessionalBenchmarkArtifacts(validationInput(root, artifacts));
    expect(result.contract_valid).toBe(false);
    expect(result.blockers).toContain('artifact_payload_schema_invalid:story');
  });

  it('rejects an agent-produced artifact masquerading as a human blind review', async () => {
    const root = await makeRunRoot();
    const finalPackage = await writeArtifact({
      root,
      id: 'final',
      kind: 'final_professional_package',
      payload: {},
    });
    const review = await writeArtifact({
      root,
      id: 'review',
      kind: 'human_blind_review',
      producer: 'agent',
      parents: [finalPackage],
      payload: blindReviewPayload(finalPackage.sha256),
    });

    const result = await validateProfessionalBenchmarkArtifacts({
      ...validationInput(root, [finalPackage, review]),
      validation_profile: 'professional_completion',
    });
    expect(result.contract_valid).toBe(false);
    expect(result.blockers).toContain('artifact_producer_not_allowed:review');
  });

  it('binds human blind review payload directly to its final package parent hash', async () => {
    const root = await makeRunRoot();
    const finalPackage = await writeArtifact({
      root,
      id: 'final',
      kind: 'final_professional_package',
      payload: {},
    });
    const review = await writeArtifact({
      root,
      id: 'review',
      kind: 'human_blind_review',
      producer: 'human_reviewer',
      parents: [finalPackage],
      payload: blindReviewPayload('f'.repeat(64)),
    });

    const result = await validateProfessionalBenchmarkArtifacts({
      ...validationInput(root, [finalPackage, review]),
      validation_profile: 'professional_completion',
    });
    expect(result.contract_valid).toBe(false);
    expect(result.blockers).toContain(
      'artifact_payload_parent_hash_mismatch:review:final_professional_package',
    );
  });

  it('rejects self-reference and forward references in the immutable DAG', async () => {
    const root = await makeRunRoot();
    const artifacts = await buildInitialChain(root);
    const usageIndex = artifacts.findIndex(artifact => artifact.kind === 'usage_and_cost');
    artifacts[usageIndex] = {
      ...artifacts[usageIndex],
      parent_artifact_sha256: [artifacts[usageIndex].sha256],
    };
    const selfResult = await validateProfessionalBenchmarkArtifacts(validationInput(root, artifacts));
    expect(selfResult.integrity_valid).toBe(false);
    expect(selfResult.blockers).toContain('artifact_parent_dag_invalid:usage');

    const forwardRoot = await makeRunRoot();
    const [prompt, receipt, story, evidence, usage] = await buildInitialChain(forwardRoot);
    const forwardResult = await validateProfessionalBenchmarkArtifacts(
      validationInput(forwardRoot, [prompt, story, receipt, evidence, usage]),
    );
    expect(forwardResult.integrity_valid).toBe(false);
    expect(forwardResult.blockers).toContain('artifact_parent_dag_invalid:story');
  });

  it('rejects a cryptographically valid parent of the wrong artifact kind', async () => {
    const root = await makeRunRoot();
    const artifacts = await buildInitialChain(root, { usageParent: 'prompt' });

    const result = await validateProfessionalBenchmarkArtifacts(validationInput(root, artifacts));
    expect(result.integrity_valid).toBe(true);
    expect(result.contract_valid).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'artifact_required_parent_missing:usage:provider_receipt',
      'artifact_parent_kind_not_allowed:usage:prompt_package',
    ]));
  });

  it('requires unique ids, paths and hashes and documents internal-to-persistent taxonomy', async () => {
    const root = await makeRunRoot();
    const artifacts = await buildInitialChain(root);
    artifacts.push({ ...artifacts[0] });

    const result = await validateProfessionalBenchmarkArtifacts(validationInput(root, artifacts));
    expect(result.integrity_valid).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'duplicate_artifact_id:prompt',
      'duplicate_artifact_path:artifacts/prompt.json',
      `duplicate_artifact_sha256:${artifacts[0].sha256}`,
    ]));
    expect(PROFESSIONAL_BENCHMARK_PERSISTED_ARTIFACT_TAXONOMY).toEqual({
      adapter_envelope: 'provider_receipt',
      final_quality_evaluation: 'final_quality_report',
      model_usage_and_cost: 'usage_and_cost',
    });
  });
});
