import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  ApiResponse,
  StoryAgentImageGenerationResult,
  StoryAgentImageRun,
  StoryAgentGenerationRun,
  StoryAgentProjectRun,
  StoryAgentRun,
  StoryAgentRunExportResponse,
  StoryAgentRunGenerateRequest,
  StoryAgentRunGenerationAttempt,
  StoryAgentRunGenerationProvenance,
  StoryAgentRunImageImportResponse,
  StoryAgentRunKind,
  StoryAgentRunListItem,
  StoryAgentRunListQuery,
  StoryAgentRunListResponse,
  StoryAgentRunStageResult,
  StoryAgentRunStartRequest,
  StoryAgentRunWorkflowCheckpoint,
  StoryAgentRunWorkflowCheckpointKey,
  StoryAgentSeedancePreproductionPackage,
  StoryGenerateResult,
  VideoType,
} from '@shared/types.js';
import { ErrorCodes, fail, success } from '@shared/types.js';
import type {
  ProductAccessContext,
  ProductResourceOwnership,
} from '@shared/product-access.js';
import {
  ArtifactStoreConflictError,
  FileArtifactStore,
} from '../repositories/artifact-store.js';
import { storyAgentDomainRegistry } from '../platform/domain-registry.js';
import { storyGeneratedRoot } from '../platform/story-storage-root.js';
import { resolveStoryVideoType } from '../platform/story-generation-policy.js';
import { runWithStoryGenerationAttemptAudit } from './story-generation-attempt-audit-service.js';
import {
  exportStoryAgentImageGenerationRequest,
  importStoryAgentImageGenerationResult,
} from './story-agent-image-run-service.js';
import { exportStoryAgentSeedancePreproductionPackage } from './story-agent-preproduction-package-service.js';
import {
  getProject,
  rebuildProjectDerivedState,
} from './project-service.js';
import {
  actorCanAccessProductResource,
  resolveProductResourceBinding,
} from './product-resource-access-service.js';

const STORY_AGENT_RUN_SCHEMA_VERSION = 'story-agent-run/v1' as const;
const STORY_AGENT_RUN_INPUT_SCHEMA_VERSION = 'story-agent-run-input/v1' as const;
const STORY_AGENT_GENERATION_RUN_SCHEMA_VERSION = 'story-agent-run/v2' as const;
const STORY_AGENT_GENERATION_RUN_INPUT_SCHEMA_VERSION = 'story-agent-run-input/v2' as const;
const STORY_AGENT_GENERATION_CHECKPOINT_SCHEMA_VERSION =
  'story-agent-run-generation-checkpoint/v1' as const;
const STORY_AGENT_RUN_ROOT_DIRECTORY = 'story-agent-runs';
const STORY_AGENT_RUN_LIST_MAX_SCANNED_LEDGERS = 250 as const;
const STORY_AGENT_RUN_ID_PATTERN = /^story-agent-run-[a-f0-9]{24}$/;
const generationRunQueues = new Map<string, Promise<ApiResponse<StoryAgentRun>>>();

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]),
  );
}

function canonicalSha256(value: unknown): string {
  return sha256(JSON.stringify(canonicalize(value)));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeErrorCode(code?: string): typeof ErrorCodes[keyof typeof ErrorCodes] {
  return Object.values(ErrorCodes).includes(code as typeof ErrorCodes[keyof typeof ErrorCodes])
    ? code as typeof ErrorCodes[keyof typeof ErrorCodes]
    : ErrorCodes.INTERNAL_ERROR;
}

function sourceRequest(request: StoryAgentRunStartRequest): StoryAgentRunStartRequest {
  return request.project_id
    ? { project_id: request.project_id }
    : { series_project_id: request.series_project_id };
}

function sourceIdentity(request: StoryAgentRunStartRequest): {
  kind: 'story_project' | 'ai_comic_series_project';
  sourceId: string;
} {
  return request.project_id
    ? { kind: 'story_project', sourceId: request.project_id }
    : { kind: 'ai_comic_series_project', sourceId: request.series_project_id! };
}

function runIdFor(request: StoryAgentRunStartRequest): string {
  const identity = sourceIdentity(request);
  return `story-agent-run-${sha256(JSON.stringify({
    schema_version: STORY_AGENT_RUN_INPUT_SCHEMA_VERSION,
    source_kind: identity.kind,
    source_id: identity.sourceId,
  })).slice(0, 24)}`;
}

export function storyAgentGenerationRunId(
  idempotencyKey: string,
  accessControl?: ProductResourceOwnership,
): string {
  return `story-agent-run-${sha256(JSON.stringify({
    schema_version: STORY_AGENT_GENERATION_RUN_INPUT_SCHEMA_VERSION,
    kind: 'generation_request',
    idempotency_scope: accessControl
      ? `${accessControl.organization_id}:${accessControl.owner_actor_id}`
      : 'access-disabled',
    idempotency_key: idempotencyKey,
  })).slice(0, 24)}`;
}

function runsRoot(): string {
  return resolve(storyGeneratedRoot(), STORY_AGENT_RUN_ROOT_DIRECTORY);
}

function runDirectory(runId: string): string {
  return resolve(runsRoot(), runId);
}

function runFilePath(runId: string): string {
  return resolve(runDirectory(runId), 'run.json');
}

function runFilePathFromRoot(root: string, runId: string): string {
  return resolve(root, runId, 'run.json');
}

function generationCheckpointFilePath(runId: string): string {
  return resolve(runDirectory(runId), 'generation-checkpoint.json');
}

async function readRun(runId: string): Promise<StoryAgentRun | undefined> {
  try {
    const parsed = JSON.parse(await readFile(runFilePath(runId), 'utf8')) as StoryAgentRun;
    return (
      parsed.schema_version === STORY_AGENT_RUN_SCHEMA_VERSION
      || parsed.schema_version === STORY_AGENT_GENERATION_RUN_SCHEMA_VERSION
    )
      && parsed.run_id === runId
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

async function readRunFromRoot(root: string, runId: string): Promise<StoryAgentRun | undefined> {
  try {
    const parsed = JSON.parse(await readFile(runFilePathFromRoot(root, runId), 'utf8')) as StoryAgentRun;
    return (
      parsed.schema_version === STORY_AGENT_RUN_SCHEMA_VERSION
      || parsed.schema_version === STORY_AGENT_GENERATION_RUN_SCHEMA_VERSION
    )
      && parsed.run_id === runId
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

function runKind(run: StoryAgentRun): StoryAgentRunKind {
  if (run.schema_version === STORY_AGENT_GENERATION_RUN_SCHEMA_VERSION) {
    return 'generation_request';
  }
  return run.source.kind === 'ai_comic_series_project'
    ? 'existing_series'
    : 'existing_project';
}

function encodeRunListCursor(runId: string): string {
  return Buffer.from(JSON.stringify({
    schema_version: 'story-agent-run-list-cursor/v1',
    after_run_id: runId,
  })).toString('base64url');
}

function decodeRunListCursor(cursor: string): string | undefined {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      schema_version?: unknown;
      after_run_id?: unknown;
    };
    return parsed.schema_version === 'story-agent-run-list-cursor/v1'
      && typeof parsed.after_run_id === 'string'
      && STORY_AGENT_RUN_ID_PATTERN.test(parsed.after_run_id)
      ? parsed.after_run_id
      : undefined;
  } catch {
    return undefined;
  }
}

function summarizeRun(run: StoryAgentRun): StoryAgentRunListItem {
  const generationRequest = run.schema_version === STORY_AGENT_GENERATION_RUN_SCHEMA_VERSION
    ? run.input_contract.generation_request
    : undefined;
  const manifest = run.image_request_manifest;
  return {
    run_id: run.run_id,
    schema_version: run.schema_version,
    kind: runKind(run),
    source: run.source,
    ...(generationRequest
      ? {
          generation_request: {
            ...(generationRequest.entry_name ? { entry_name: generationRequest.entry_name } : {}),
            ...(generationRequest.video_type ? { video_type: generationRequest.video_type } : {}),
          },
        }
      : {}),
    video_types: run.video_types,
    status: run.status,
    current_stage: run.current_stage,
    blocker_count: run.blockers.length,
    retryable_failure_count: run.retryable_failures.length,
    ...(run.blockers[0] ? { primary_blocker: run.blockers[0] } : {}),
    ...(manifest
      ? {
          image_tasks: {
            total: manifest.task_count,
            pending: manifest.pending_task_count,
            verified: manifest.verified_task_count,
            failed_retryable: manifest.failed_retryable_task_count,
            blocked: manifest.blocked_task_count,
          },
        }
      : {}),
    resume_count: run.resume_count,
    created_at: run.created_at,
    updated_at: run.updated_at,
  };
}

async function actorCanAccessRun(
  run: StoryAgentRun,
  access: ProductAccessContext | undefined,
): Promise<boolean> {
  if (!access || access.mode !== 'required') return true;
  if (!access.actor) return false;
  if (
    run.schema_version === STORY_AGENT_GENERATION_RUN_SCHEMA_VERSION
    && run.access_control
  ) {
    return actorCanAccessProductResource(access.actor, {
      ...run.access_control,
      resource_type: run.source?.kind === 'ai_comic_series_project'
        ? 'series_project'
        : 'story_project',
      resource_id: run.source?.source_id ?? run.run_id,
    });
  }
  if (!run.source) return false;
  const resourceType = run.source.kind === 'ai_comic_series_project'
    ? 'series_project'
    : 'story_project';
  const resolution = await resolveProductResourceBinding(resourceType, run.source.source_id);
  return Boolean(
    resolution.binding
    && actorCanAccessProductResource(access.actor, resolution.binding),
  );
}

function runMatchesFilters(run: StoryAgentRun, query: StoryAgentRunListQuery): boolean {
  return (!query.status || run.status === query.status)
    && (!query.kind || runKind(run) === query.kind)
    && (!query.source_kind || run.source?.kind === query.source_kind);
}

export interface ListStoryAgentRunsOptions {
  runs_root?: string;
}

export async function listStoryAgentRuns(
  query: StoryAgentRunListQuery,
  access?: ProductAccessContext,
  options: ListStoryAgentRunsOptions = {},
): Promise<ApiResponse<StoryAgentRunListResponse>> {
  const root = options.runs_root ?? runsRoot();
  const afterRunId = query.cursor ? decodeRunListCursor(query.cursor) : undefined;
  if (query.cursor && !afterRunId) {
    return fail(ErrorCodes.VALIDATION_ERROR, 'Story Agent run list cursor is invalid');
  }

  let runIds: string[];
  try {
    runIds = (await readdir(root, { withFileTypes: true }))
      .filter(entry => entry.isDirectory() && STORY_AGENT_RUN_ID_PATTERN.test(entry.name))
      .map(entry => entry.name)
      .sort((left, right) => right.localeCompare(left));
  } catch {
    runIds = [];
  }
  const startIndex = afterRunId
    ? runIds.findIndex(runId => runId.localeCompare(afterRunId) < 0)
    : 0;
  const effectiveStartIndex = startIndex < 0 ? runIds.length : startIndex;
  const items: StoryAgentRunListItem[] = [];
  let scannedCount = 0;

  for (
    let index = effectiveStartIndex;
    index < runIds.length
      && scannedCount < STORY_AGENT_RUN_LIST_MAX_SCANNED_LEDGERS
      && items.length < query.limit;
    index += 1
  ) {
    const run = await readRunFromRoot(root, runIds[index]);
    scannedCount += 1;
    if (!run) continue;
    try {
      if (
        runMatchesFilters(run, query)
        && await actorCanAccessRun(run, access)
      ) {
        items.push(summarizeRun(run));
      }
    } catch {
      // One malformed or unresolved durable ledger must not break the bounded page.
    }
  }

  const nextIndex = effectiveStartIndex + scannedCount;
  const hasMore = nextIndex < runIds.length;
  const lastScannedRunId = scannedCount > 0 ? runIds[nextIndex - 1] : undefined;
  return success({
    schema_version: 'story-agent-run-list/v1',
    items,
    page: {
      limit: query.limit,
      scanned_count: scannedCount,
      has_more: hasMore,
      ...(hasMore && lastScannedRunId
        ? { next_cursor: encodeRunListCursor(lastScannedRunId) }
        : {}),
    },
    filters: {
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.source_kind ? { source_kind: query.source_kind } : {}),
    },
    boundary: {
      full_ledgers_omitted: true,
      max_scanned_ledgers: STORY_AGENT_RUN_LIST_MAX_SCANNED_LEDGERS,
    },
  });
}

async function persistRun(run: StoryAgentRun): Promise<void> {
  const store = new FileArtifactStore(runDirectory(run.run_id));
  await store.writeText('run.json', `${JSON.stringify(run, null, 2)}\n`, {
    overwrite: 'replace',
  });
}

async function persistNewRun(run: StoryAgentRun): Promise<boolean> {
  const store = new FileArtifactStore(runDirectory(run.run_id));
  try {
    await store.writeText('run.json', `${JSON.stringify(run, null, 2)}\n`);
    return true;
  } catch (error) {
    if (error instanceof ArtifactStoreConflictError) return false;
    throw error;
  }
}

interface StoryAgentRunGenerationCheckpointFile {
  schema_version: typeof STORY_AGENT_GENERATION_CHECKPOINT_SCHEMA_VERSION;
  run_id: string;
  request_sha256: string;
  story: StoryGenerateResult;
  persisted_at: string;
}

async function persistGenerationCheckpoint(input: {
  run: StoryAgentGenerationRun;
  story: StoryGenerateResult;
  persistedAt: string;
}): Promise<void> {
  const checkpoint: StoryAgentRunGenerationCheckpointFile = {
    schema_version: STORY_AGENT_GENERATION_CHECKPOINT_SCHEMA_VERSION,
    run_id: input.run.run_id,
    request_sha256: input.run.generation_checkpoint.request_sha256,
    story: input.story,
    persisted_at: input.persistedAt,
  };
  const store = new FileArtifactStore(runDirectory(input.run.run_id));
  await store.writeText(
    'generation-checkpoint.json',
    `${JSON.stringify(checkpoint, null, 2)}\n`,
    { overwrite: 'replace' },
  );
}

async function readGenerationCheckpoint(
  run: StoryAgentGenerationRun,
): Promise<StoryAgentRunGenerationCheckpointFile | undefined> {
  try {
    const checkpoint = JSON.parse(
      await readFile(generationCheckpointFilePath(run.run_id), 'utf8'),
    ) as StoryAgentRunGenerationCheckpointFile;
    return checkpoint.schema_version === STORY_AGENT_GENERATION_CHECKPOINT_SCHEMA_VERSION
      && checkpoint.run_id === run.run_id
      && checkpoint.request_sha256 === run.generation_checkpoint.request_sha256
      && checkpoint.story.project_id
      ? checkpoint
      : undefined;
  } catch {
    return undefined;
  }
}

function videoTypes(
  preproduction: StoryAgentSeedancePreproductionPackage,
): VideoType[] {
  return unique(preproduction.story_units.flatMap(unit => (
    unit.professional_text_package?.video_type
      ? [unit.professional_text_package.video_type]
      : []
  ))) as VideoType[];
}

function stageResults(input: {
  preproduction: StoryAgentSeedancePreproductionPackage;
  imageRun?: StoryAgentImageRun;
  imageFailure?: string;
}): StoryAgentRunStageResult[] {
  const acceptance = input.preproduction.acceptance;
  const professionalReady = acceptance.expected_story_unit_count > 0
    && acceptance.professional_script_count === acceptance.expected_story_unit_count;
  const seedanceReady = acceptance.script_shot_count > 0
    && acceptance.seedance_prompt_shot_count === acceptance.script_shot_count;
  const imageRetryableFailures = input.imageRun?.tasks
    .filter(task => task.status === 'failed_retryable')
    .map(task => task.last_error ?? `image_task_retryable:${task.task_id}`)
    ?? (input.imageFailure ? [input.imageFailure] : []);
  const imageBlockers = input.imageRun?.tasks
    .filter(task => task.status === 'blocked')
    .map(task => task.last_error ?? `image_task_blocked:${task.task_id}`)
    ?? [];
  let imageStatus: StoryAgentRunStageResult['status'];
  if (!input.imageRun) imageStatus = 'failed_retryable';
  else if (input.imageRun.status === 'complete') imageStatus = 'ready';
  else if (input.imageRun.status === 'blocked') imageStatus = 'blocked';
  else if (imageRetryableFailures.length) imageStatus = 'failed_retryable';
  else imageStatus = 'awaiting_external_action';

  return [
    {
      stage: 'source',
      status: 'ready',
      evidence_refs: [
        `${input.preproduction.source.kind}:${input.preproduction.source.source_id}`,
        ...input.preproduction.source.story_ids.map(storyId => `story:${storyId}`),
      ],
      blockers: [],
      retryable_failures: [],
    },
    {
      stage: 'professional_script',
      status: professionalReady ? 'ready' : 'blocked',
      evidence_refs: input.preproduction.story_units.flatMap(unit => (
        unit.professional_text_package
          ? [`professional_text_package:${unit.professional_text_package.package_id}`]
          : []
      )),
      blockers: professionalReady
        ? []
        : [`professional_script_count:${acceptance.professional_script_count}/${acceptance.expected_story_unit_count}`],
      retryable_failures: [],
    },
    {
      stage: 'seedance_prompt',
      status: seedanceReady ? 'ready' : 'blocked',
      evidence_refs: input.preproduction.story_units.map(
        unit => `seedance_prompt_package:${unit.seedance_prompt_package.storyId}`,
      ),
      blockers: seedanceReady
        ? []
        : [`seedance_prompt_shot_count:${acceptance.seedance_prompt_shot_count}/${acceptance.script_shot_count}`],
      retryable_failures: [],
    },
    {
      stage: 'image_assets',
      status: imageStatus,
      evidence_refs: input.imageRun
        ? [
            `story_agent_image_run:${input.imageRun.run_id}`,
            `image_generation_request:${input.imageRun.request.request_sha256}`,
          ]
        : [],
      blockers: imageBlockers,
      retryable_failures: imageRetryableFailures,
    },
    {
      stage: 'preproduction_package',
      status: acceptance.status === 'ready'
        ? 'ready'
        : professionalReady && seedanceReady && imageStatus !== 'blocked'
          ? 'pending'
          : 'blocked',
      evidence_refs: [
        `preproduction_package:${input.preproduction.source.kind}:${input.preproduction.source.source_id}`,
        `preproduction_exported_at:${input.preproduction.exported_at}`,
      ],
      blockers: acceptance.blockers,
      retryable_failures: [],
    },
  ];
}

const WORKFLOW_CHECKPOINT_KEYS: StoryAgentRunWorkflowCheckpointKey[] = [
  'evidence_supplement',
  'professional_package',
  'canonical_repair',
  'derived_state_rebuild',
];

function pendingWorkflowCheckpoints(): StoryAgentRunWorkflowCheckpoint[] {
  return WORKFLOW_CHECKPOINT_KEYS.map(checkpoint => ({
    checkpoint,
    status: 'pending',
    attempt_count: 0,
    attempts: [],
    evidence_refs: [],
    blockers: [],
    retryable_failures: [],
    action: workflowCheckpointAction(checkpoint),
  }));
}

function workflowCheckpointAction(
  checkpoint: StoryAgentRunWorkflowCheckpointKey,
): StoryAgentRunWorkflowCheckpoint['action'] {
  switch (checkpoint) {
    case 'evidence_supplement':
      return {
        executor: 'project_operator',
        operation: 'update_project_supplement_task',
        endpoint: '/api/projects/:projectId/supplement-tasks/:taskId',
        automatic_on_run_resume: false,
      };
    case 'professional_package':
      return {
        executor: 'project_operator',
        operation: 'review_professional_text_package',
        automatic_on_run_resume: false,
      };
    case 'canonical_repair':
      return {
        executor: 'canonical_project_service',
        operation: 'repair_project_quality',
        endpoint: '/api/projects/:projectId/repair-quality',
        automatic_on_run_resume: false,
      };
    case 'derived_state_rebuild':
      return {
        executor: 'canonical_project_service',
        operation: 'rebuild_project_derived_state',
        automatic_on_run_resume: true,
      };
  }
}

interface WorkflowCheckpointObservation {
  status: StoryAgentRunWorkflowCheckpoint['status'];
  evidence_refs: string[];
  blockers: string[];
  retryable_failures: string[];
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function observeWorkflowCheckpoints(input: {
  preproduction: StoryAgentSeedancePreproductionPackage;
  story?: StoryGenerateResult;
  derivedRebuildError?: WorkflowCheckpointObservation['error'];
}): Record<StoryAgentRunWorkflowCheckpointKey, WorkflowCheckpointObservation> {
  const openEvidenceTasks = input.story?.supplement_tasks?.filter(task => (
    task.status === 'open' && task.source === 'professional_evidence_missing'
  )) ?? [];
  const packages = input.preproduction.story_units.flatMap(unit => (
    unit.professional_text_package ? [unit.professional_text_package] : []
  ));
  const missingPackageCount = input.preproduction.story_units.length - packages.length;
  const professionalBlockers = unique(packages.flatMap(pkg => [
    ...(pkg.status === 'revision_required'
      ? [`professional_package_revision_required:${pkg.package_id}`]
      : []),
    ...pkg.quality_report.hard_gate_failures.map(
      failure => `professional_hard_gate:${pkg.package_id}:${failure}`,
    ),
    ...(['revise', 'rebuild'].includes(pkg.coverage_report.verdict)
      ? [`professional_coverage_${pkg.coverage_report.verdict}:${pkg.package_id}`]
      : []),
  ]));
  const professionalFailures = missingPackageCount > 0
    ? [`professional_package_missing:${missingPackageCount}`]
    : [];
  const qualityReport = input.story?.quality_report;
  const repairActions = qualityReport && 'repair_actions' in qualityReport
    ? qualityReport.repair_actions ?? []
    : [];
  const repairNeeded = qualityReport?.passed === false
    || professionalBlockers.length > 0;
  const derivedFailures = unique([
    ...input.preproduction.story_units.flatMap(unit => {
      const pkg = unit.professional_text_package;
      if (!pkg) return [`derived_professional_package_missing:${unit.story_id}`];
      const expected = unit.story.scene_breakdown.length;
      return [
        ...(pkg.scene_breakdown.length === expected
          ? []
          : [`derived_professional_scene_count:${unit.story_id}:${pkg.scene_breakdown.length}/${expected}`]),
        ...(pkg.delivery_text_package.scene_units.length === expected
          ? []
          : [`derived_delivery_scene_count:${unit.story_id}:${pkg.delivery_text_package.scene_units.length}/${expected}`]),
      ];
    }),
    ...(input.story && !input.story.gears_delivery
      ? [`derived_gears_delivery_missing:${input.story.storyId}`]
      : []),
  ]);
  const derivedError = input.derivedRebuildError;

  return {
    evidence_supplement: {
      status: openEvidenceTasks.length > 0 ? 'awaiting_external_action' : 'ready',
      evidence_refs: openEvidenceTasks.map(task => `supplement_task:${task.task_id}`),
      blockers: openEvidenceTasks.map(task => `${task.task_id}:${task.label}`),
      retryable_failures: [],
    },
    professional_package: {
      status: professionalBlockers.length > 0
        ? 'blocked'
        : professionalFailures.length > 0
          ? 'failed_retryable'
          : 'ready',
      evidence_refs: packages.map(pkg => `professional_text_package:${pkg.package_id}`),
      blockers: professionalBlockers,
      retryable_failures: professionalFailures,
    },
    canonical_repair: {
      status: repairNeeded ? 'awaiting_external_action' : 'ready',
      evidence_refs: [
        ...(qualityReport ? [`story_quality:${qualityReport.passed ? 'passed' : 'failed'}`] : []),
        ...packages.map(pkg => `professional_quality:${pkg.package_id}:${pkg.quality_report.status}`),
      ],
      blockers: repairNeeded
        ? unique([
            ...repairActions,
            ...professionalBlockers,
            ...(!qualityReport ? ['story_quality_report_missing'] : []),
          ])
        : [],
      retryable_failures: [],
    },
    derived_state_rebuild: {
      status: derivedError || derivedFailures.length > 0 ? 'failed_retryable' : 'ready',
      evidence_refs: [
        ...input.preproduction.story_units.map(unit => `derived_story_unit:${unit.story_id}`),
        ...(input.story?.gears_delivery
          ? [`gears_delivery:${input.story.gears_delivery.storyId}`]
          : []),
      ],
      blockers: [],
      retryable_failures: derivedError
        ? [derivedError.message]
        : derivedFailures,
      error: derivedError,
    },
  };
}

function buildWorkflowCheckpoints(input: {
  preproduction: StoryAgentSeedancePreproductionPackage;
  story?: StoryGenerateResult;
  previous?: StoryAgentRunWorkflowCheckpoint[];
  now: string;
  derivedRebuildError?: WorkflowCheckpointObservation['error'];
}): StoryAgentRunWorkflowCheckpoint[] {
  const observations = observeWorkflowCheckpoints(input);
  return WORKFLOW_CHECKPOINT_KEYS.map(checkpoint => {
    const observation = observations[checkpoint];
    const previous = input.previous?.find(item => item.checkpoint === checkpoint);
    const attempts = [
      ...(previous?.attempts ?? []),
      {
        attempt_number: (previous?.attempt_count ?? 0) + 1,
        status: observation.status,
        started_at: input.now,
        completed_at: input.now,
        evidence_refs: observation.evidence_refs,
        ...(observation.error ? { error: observation.error } : {}),
      },
    ];
    return {
      checkpoint,
      status: observation.status,
      attempt_count: attempts.length,
      attempts,
      evidence_refs: observation.evidence_refs,
      blockers: observation.blockers,
      retryable_failures: observation.retryable_failures,
      action: workflowCheckpointAction(checkpoint),
    };
  });
}

function runStatus(
  stages: StoryAgentRunStageResult[],
): {
  status: StoryAgentRun['status'];
  current_stage: StoryAgentRun['current_stage'];
} {
  const current = stages.find(stage => stage.status !== 'ready');
  if (!current) return { status: 'ready', current_stage: 'complete' };
  if (stages.some(stage => stage.status === 'blocked')) {
    return { status: 'blocked', current_stage: current.stage };
  }
  if (stages.some(stage => stage.status === 'failed_retryable')) {
    return { status: 'failed_retryable', current_stage: current.stage };
  }
  if (stages.some(stage => stage.status === 'awaiting_external_action')) {
    return { status: 'awaiting_external_action', current_stage: current.stage };
  }
  return { status: 'in_progress', current_stage: current.stage };
}

function buildRun(input: {
  request: StoryAgentRunStartRequest;
  preproduction: StoryAgentSeedancePreproductionPackage;
  imageRun?: StoryAgentImageRun;
  imageFailure?: string;
  existing?: StoryAgentProjectRun;
  story?: StoryGenerateResult;
  previousWorkflowCheckpoints?: StoryAgentRunWorkflowCheckpoint[];
  derivedRebuildError?: WorkflowCheckpointObservation['error'];
  now: string;
}): StoryAgentProjectRun {
  const request = sourceRequest(input.request);
  const runId = runIdFor(request);
  const stages = stageResults(input);
  const state = runStatus(stages);
  return {
    schema_version: STORY_AGENT_RUN_SCHEMA_VERSION,
    run_id: runId,
    input_contract: {
      schema_version: STORY_AGENT_RUN_INPUT_SCHEMA_VERSION,
      ...request,
    },
    input_sha256: sha256(JSON.stringify({
      schema_version: STORY_AGENT_RUN_INPUT_SCHEMA_VERSION,
      ...request,
    })),
    source: input.preproduction.source,
    video_types: videoTypes(input.preproduction),
    ...state,
    stage_results: stages,
    workflow_checkpoints: buildWorkflowCheckpoints({
      preproduction: input.preproduction,
      story: input.story,
      previous: input.previousWorkflowCheckpoints ?? input.existing?.workflow_checkpoints,
      now: input.now,
      derivedRebuildError: input.derivedRebuildError,
    }),
    blockers: unique(stages.flatMap(stage => stage.blockers)),
    retryable_failures: unique(stages.flatMap(stage => stage.retryable_failures)),
    image_request_manifest: input.imageRun
      ? {
          image_run_id: input.imageRun.run_id,
          image_run_status: input.imageRun.status,
          request_sha256: input.imageRun.request.request_sha256,
          request_path: input.imageRun.request_path,
          request: input.imageRun.request,
          provider_invoked: false,
          executor: 'codex_imagegen',
          task_count: input.imageRun.summary.task_count,
          pending_task_count: input.imageRun.summary.awaiting_imagegen_count,
          verified_task_count: input.imageRun.summary.verified_count,
          failed_retryable_task_count: input.imageRun.summary.failed_retryable_count,
          blocked_task_count: input.imageRun.summary.blocked_count,
        }
      : undefined,
    preproduction_package: input.preproduction,
    boundary: {
      canonical_services_reused: true,
      image_provider_invoked_by_server: false,
      video_generation_performed: false,
      human_review_credit_granted: false,
    },
    resume_count: input.existing?.resume_count ?? 0,
    created_at: input.existing?.created_at ?? input.now,
    updated_at: input.now,
  };
}

async function refreshRun(input: {
  request: StoryAgentRunStartRequest;
  existing?: StoryAgentProjectRun;
  incrementResume: boolean;
}): Promise<ApiResponse<StoryAgentProjectRun>> {
  let story: StoryGenerateResult | undefined;
  let derivedRebuildError: WorkflowCheckpointObservation['error'];
  if (input.request.project_id) {
    if (input.incrementResume) {
      try {
        const rebuilt = await rebuildProjectDerivedState(input.request.project_id);
        if (rebuilt.ok && rebuilt.data) {
          story = rebuilt.data.current_story;
        } else {
          derivedRebuildError = {
            code: rebuilt.error?.code ?? ErrorCodes.INTERNAL_ERROR,
            message: rebuilt.error?.message ?? 'Canonical derived-state rebuild failed',
            details: rebuilt.error?.details,
          };
        }
      } catch (error) {
        derivedRebuildError = {
          code: ErrorCodes.INTERNAL_ERROR,
          message: error instanceof Error
            ? error.message
            : 'Canonical derived-state rebuild failed',
        };
      }
    }
    if (!story) {
      const detail = await getProject(input.request.project_id);
      if (detail.ok && detail.data) story = detail.data.current_story;
    }
  }
  const preproductionResult = await exportStoryAgentSeedancePreproductionPackage(
    sourceRequest(input.request),
  );
  if (!preproductionResult.ok || !preproductionResult.data) {
    return fail(
      normalizeErrorCode(preproductionResult.error?.code),
      preproductionResult.error?.message ?? 'Story Agent preproduction package export failed',
    );
  }
  const imageResult = await exportStoryAgentImageGenerationRequest(sourceRequest(input.request));
  const now = new Date().toISOString();
  const run = buildRun({
    request: input.request,
    preproduction: preproductionResult.data,
    imageRun: imageResult.data ?? undefined,
    imageFailure: imageResult.ok
      ? undefined
      : imageResult.error?.message ?? 'Story Agent image request export failed',
    existing: input.existing,
    story,
    derivedRebuildError,
    now,
  });
  if (input.incrementResume) run.resume_count += 1;
  await persistRun(run);
  return success(run);
}

function pendingGenerationStages(
  generationStatus: StoryAgentRunGenerationAttempt['status'],
  errorMessage?: string,
): StoryAgentRunStageResult[] {
  const retryable = generationStatus === 'failed_retryable' && errorMessage
    ? [errorMessage]
    : [];
  const blockers = generationStatus === 'blocked' && errorMessage
    ? [errorMessage]
    : [];
  return [
    {
      stage: 'generation',
      status: generationStatus === 'succeeded'
        ? 'ready'
        : generationStatus === 'failed_retryable'
          ? 'failed_retryable'
          : generationStatus === 'blocked'
            ? 'blocked'
            : 'pending',
      evidence_refs: [],
      blockers,
      retryable_failures: retryable,
    },
    {
      stage: 'story_project',
      status: 'pending',
      evidence_refs: [],
      blockers: [],
      retryable_failures: [],
    },
    ...(['professional_script', 'seedance_prompt', 'image_assets', 'preproduction_package'] as const)
      .map(stage => ({
        stage,
        status: 'pending' as const,
        evidence_refs: [],
        blockers: [],
        retryable_failures: [],
      })),
  ];
}

function notObservedProvenance(
  request: StoryAgentRunGenerateRequest,
): StoryAgentRunGenerationProvenance {
  return {
    mode: 'not_observed',
    requested_model_profile_id: request.generation_request.model_profile_id,
    external_model_call_performed: null,
    generation_used_fallback: null,
  };
}

function provenanceForStory(story: StoryGenerateResult): StoryAgentRunGenerationProvenance {
  const mode: StoryAgentRunGenerationProvenance['mode'] =
    story.model_execution_evidence === 'record_replay_fixture'
      ? 'record_replay_fixture'
      : story.external_model_call_performed
        ? 'live_external'
        : story.generation_mode === 'local_fallback'
          ? 'local_fallback'
          : 'local_only';
  return {
    mode,
    requested_model_profile_id: story.requested_model_profile_id,
    effective_model_profile_id: story.model_profile_id,
    external_model_call_performed: story.external_model_call_performed ?? false,
    generation_used_fallback: story.generation_used_fallback ?? false,
  };
}

function buildInitialGenerationRun(input: {
  request: StoryAgentRunGenerateRequest;
  accessControl?: ProductResourceOwnership;
  now: string;
}): StoryAgentGenerationRun {
  const requestSha256 = canonicalSha256(input.request.generation_request);
  const runId = storyAgentGenerationRunId(
    input.request.idempotency_key,
    input.accessControl,
  );
  const provenance = notObservedProvenance(input.request);
  const attempt: StoryAgentRunGenerationAttempt = {
    attempt_number: 1,
    status: 'in_progress',
    started_at: input.now,
    provenance,
  };
  const stages = pendingGenerationStages('in_progress');
  return {
    schema_version: STORY_AGENT_GENERATION_RUN_SCHEMA_VERSION,
    run_id: runId,
    input_contract: {
      schema_version: STORY_AGENT_GENERATION_RUN_INPUT_SCHEMA_VERSION,
      kind: 'generation_request',
      idempotency_key: input.request.idempotency_key,
      generation_request: input.request.generation_request,
    },
    input_sha256: canonicalSha256({
      schema_version: STORY_AGENT_GENERATION_RUN_INPUT_SCHEMA_VERSION,
      kind: 'generation_request',
      idempotency_key: input.request.idempotency_key,
      generation_request: input.request.generation_request,
    }),
    source: null,
    video_types: [resolveStoryVideoType(input.request.generation_request)],
    status: 'in_progress',
    current_stage: 'generation',
    stage_results: stages,
    workflow_checkpoints: pendingWorkflowCheckpoints(),
    blockers: [],
    retryable_failures: [],
    generation_checkpoint: {
      status: 'in_progress',
      request_sha256: requestSha256,
      attempt_count: 1,
      attempts: [attempt],
      provenance,
    },
    access_control: input.accessControl,
    boundary: {
      canonical_services_reused: true,
      image_provider_invoked_by_server: false,
      video_generation_performed: false,
      human_review_credit_granted: false,
    },
    resume_count: 0,
    created_at: input.now,
    updated_at: input.now,
  };
}

function generationFailureIsRetryable(error: {
  code?: string;
  details?: unknown;
}): boolean {
  const details = error.details && typeof error.details === 'object'
    ? error.details as { schema_version?: unknown }
    : undefined;
  return error.code === ErrorCodes.INTERNAL_ERROR
    || error.code === ErrorCodes.STORY_GENERATION_FAILED
    || error.code === ErrorCodes.STORY_GENERATION_AUDIT_UNAVAILABLE
    || error.code === ErrorCodes.ARTIFACT_STORAGE_UNAVAILABLE
    || details?.schema_version === 'story-generation-fallback-gate/v1';
}

async function persistGenerationFailure(input: {
  run: StoryAgentGenerationRun;
  code?: string;
  message: string;
  details?: unknown;
}): Promise<ApiResponse<StoryAgentRun>> {
  const now = new Date().toISOString();
  const status = generationFailureIsRetryable(input)
    ? 'failed_retryable' as const
    : 'blocked' as const;
  const lastError = {
    code: input.code ?? ErrorCodes.INTERNAL_ERROR,
    message: input.message,
    details: input.details,
  };
  const attempts = input.run.generation_checkpoint.attempts.map((attempt, index, values) => (
    index === values.length - 1
      ? {
          ...attempt,
          status,
          completed_at: now,
          last_error: lastError,
          provenance: notObservedProvenance({
            idempotency_key: input.run.input_contract.idempotency_key,
            generation_request: input.run.input_contract.generation_request,
          }),
        }
      : attempt
  ));
  const stages = pendingGenerationStages(status, input.message);
  const run: StoryAgentGenerationRun = {
    ...input.run,
    status,
    current_stage: 'generation',
    stage_results: stages,
    blockers: status === 'blocked' ? [input.message] : [],
    retryable_failures: status === 'failed_retryable' ? [input.message] : [],
    generation_checkpoint: {
      ...input.run.generation_checkpoint,
      status,
      attempts,
      last_error: lastError,
      provenance: attempts.at(-1)!.provenance,
    },
    updated_at: now,
  };
  await persistRun(run);
  return success(run);
}

function generationSuccessAttempt(input: {
  run: StoryAgentGenerationRun;
  story: StoryGenerateResult;
  completedAt: string;
}): StoryAgentRunGenerationAttempt[] {
  const provenance = provenanceForStory(input.story);
  return input.run.generation_checkpoint.attempts.map((attempt, index, values) => (
    index === values.length - 1
      ? {
          ...attempt,
          status: 'succeeded',
          completed_at: input.completedAt,
          story_id: input.story.storyId,
          project_id: input.story.project_id,
          provenance,
        }
      : attempt
  ));
}

async function persistPostGenerationFailure(input: {
  run: StoryAgentGenerationRun;
  story: StoryGenerateResult;
  message: string;
}): Promise<ApiResponse<StoryAgentRun>> {
  const now = new Date().toISOString();
  const provenance = provenanceForStory(input.story);
  const attempts = generationSuccessAttempt({
    run: input.run,
    story: input.story,
    completedAt: now,
  });
  const stages: StoryAgentRunStageResult[] = [
    {
      stage: 'generation',
      status: 'ready',
      evidence_refs: [
        `story:${input.story.storyId}`,
        `generation_provenance:${provenance.mode}`,
      ],
      blockers: [],
      retryable_failures: [],
    },
    {
      stage: 'story_project',
      status: 'ready',
      evidence_refs: [
        `story:${input.story.storyId}`,
        `story_project:${input.story.project_id}`,
      ],
      blockers: [],
      retryable_failures: [],
    },
    {
      stage: 'professional_script',
      status: 'failed_retryable',
      evidence_refs: [],
      blockers: [],
      retryable_failures: [input.message],
    },
    ...(['seedance_prompt', 'image_assets', 'preproduction_package'] as const).map(stage => ({
      stage,
      status: 'pending' as const,
      evidence_refs: [],
      blockers: [],
      retryable_failures: [],
    })),
  ];
  const run: StoryAgentGenerationRun = {
    ...input.run,
    source: {
      kind: 'story_project',
      source_id: input.story.project_id!,
      title: input.story.title,
      story_ids: [input.story.storyId],
    },
    status: 'failed_retryable',
    current_stage: 'professional_script',
    stage_results: stages,
    blockers: [],
    retryable_failures: [input.message],
    generation_checkpoint: {
      ...input.run.generation_checkpoint,
      status: 'succeeded',
      attempt_count: attempts.length,
      story_id: input.story.storyId,
      project_id: input.story.project_id,
      attempts,
      last_error: undefined,
      provenance,
    },
    updated_at: now,
  };
  await persistRun(run);
  return success(run);
}

async function refreshGenerationRun(input: {
  run: StoryAgentGenerationRun;
  story: StoryGenerateResult;
  incrementResume: boolean;
}): Promise<ApiResponse<StoryAgentRun>> {
  if (!input.story.project_id) {
    return persistGenerationFailure({
      run: input.run,
      code: ErrorCodes.INTERNAL_ERROR,
      message: 'Canonical story generation succeeded without a durable project_id',
    });
  }
  const request = { project_id: input.story.project_id };
  let currentStory = input.story;
  let derivedRebuildError: WorkflowCheckpointObservation['error'];
  if (input.incrementResume) {
    try {
      const rebuilt = await rebuildProjectDerivedState(input.story.project_id);
      if (rebuilt.ok && rebuilt.data) {
        currentStory = rebuilt.data.current_story;
      } else {
        derivedRebuildError = {
          code: rebuilt.error?.code ?? ErrorCodes.INTERNAL_ERROR,
          message: rebuilt.error?.message ?? 'Canonical derived-state rebuild failed',
          details: rebuilt.error?.details,
        };
      }
    } catch (error) {
      derivedRebuildError = {
        code: ErrorCodes.INTERNAL_ERROR,
        message: error instanceof Error
          ? error.message
          : 'Canonical derived-state rebuild failed',
      };
    }
    if (derivedRebuildError) {
      const detail = await getProject(input.story.project_id);
      if (detail.ok && detail.data) currentStory = detail.data.current_story;
    }
  } else {
    const detail = await getProject(input.story.project_id);
    if (detail.ok && detail.data) currentStory = detail.data.current_story;
  }
  const preproductionResult = await exportStoryAgentSeedancePreproductionPackage(request);
  if (!preproductionResult.ok || !preproductionResult.data) {
    return persistPostGenerationFailure({
      run: input.run,
      story: input.story,
      message: preproductionResult.error?.message
        ?? 'Story Agent preproduction package export failed after generation',
    });
  }
  const imageResult = await exportStoryAgentImageGenerationRequest(request);
  const now = new Date().toISOString();
  const derived = buildRun({
    request,
    preproduction: preproductionResult.data,
    imageRun: imageResult.data ?? undefined,
    imageFailure: imageResult.ok
      ? undefined
      : imageResult.error?.message ?? 'Story Agent image request export failed',
    story: currentStory,
    previousWorkflowCheckpoints: input.run.workflow_checkpoints,
    derivedRebuildError,
    now,
  });
  const provenance = provenanceForStory(input.story);
  const attempts = generationSuccessAttempt({
    run: input.run,
    story: input.story,
    completedAt: now,
  });
  const stages: StoryAgentRunStageResult[] = [
    {
      stage: 'generation',
      status: 'ready',
      evidence_refs: [
        `story:${input.story.storyId}`,
        `generation_provenance:${provenance.mode}`,
      ],
      blockers: [],
      retryable_failures: [],
    },
    {
      stage: 'story_project',
      status: 'ready',
      evidence_refs: [
        `story:${input.story.storyId}`,
        `story_project:${input.story.project_id}`,
      ],
      blockers: [],
      retryable_failures: [],
    },
    ...derived.stage_results.filter(stage => stage.stage !== 'source'),
  ];
  const state = runStatus(stages);
  const run: StoryAgentGenerationRun = {
    ...input.run,
    source: derived.source,
    video_types: derived.video_types,
    ...state,
    stage_results: stages,
    workflow_checkpoints: derived.workflow_checkpoints,
    blockers: unique(stages.flatMap(stage => stage.blockers)),
    retryable_failures: unique(stages.flatMap(stage => stage.retryable_failures)),
    generation_checkpoint: {
      ...input.run.generation_checkpoint,
      status: 'succeeded',
      attempt_count: attempts.length,
      story_id: input.story.storyId,
      project_id: input.story.project_id,
      attempts,
      last_error: undefined,
      provenance,
    },
    image_request_manifest: derived.image_request_manifest,
    preproduction_package: derived.preproduction_package,
    resume_count: input.run.resume_count + (input.incrementResume ? 1 : 0),
    updated_at: now,
  };
  await persistRun(run);
  return success(run);
}

async function executeGenerationRun(
  run: StoryAgentGenerationRun,
): Promise<ApiResponse<StoryAgentRun>> {
  const checkpoint = await readGenerationCheckpoint(run);
  if (checkpoint) {
    return refreshGenerationRun({
      run,
      story: checkpoint.story,
      incrementResume: false,
    });
  }

  const { domain = 'china_culture', ...storyRequest } =
    run.input_contract.generation_request;
  let generated: ApiResponse<StoryGenerateResult>;
  try {
    generated = await runWithStoryGenerationAttemptAudit({
      sourceDomain: domain,
      videoType: resolveStoryVideoType(storyRequest),
    }, () => storyAgentDomainRegistry.require(domain).generateStory(
      storyRequest,
      { access_control: run.access_control },
    ));
  } catch (error) {
    return persistGenerationFailure({
      run,
      code: typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: unknown }).code)
        : ErrorCodes.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  if (!generated.ok || !generated.data) {
    return persistGenerationFailure({
      run,
      code: generated.error?.code,
      message: generated.error?.message ?? 'Canonical story generation failed',
      details: generated.error?.details,
    });
  }

  const persistedAt = new Date().toISOString();
  try {
    await persistGenerationCheckpoint({
      run,
      story: generated.data,
      persistedAt,
    });
  } catch (error) {
    return persistGenerationFailure({
      run,
      code: ErrorCodes.ARTIFACT_STORAGE_UNAVAILABLE,
      message: error instanceof Error
        ? `Generated story persisted, but the run checkpoint could not be saved: ${error.message}`
        : 'Generated story persisted, but the run checkpoint could not be saved',
    });
  }
  return refreshGenerationRun({
    run,
    story: generated.data,
    incrementResume: false,
  });
}

function generationRequestConflict(
  existing: StoryAgentRun,
  request: StoryAgentRunGenerateRequest,
): ApiResponse<StoryAgentRun> | undefined {
  if (existing.schema_version !== STORY_AGENT_GENERATION_RUN_SCHEMA_VERSION) {
    return fail(
      ErrorCodes.STORY_AGENT_RUN_INPUT_CONFLICT,
      'The idempotency key resolves to an incompatible existing Story Agent run',
    );
  }
  const requestSha256 = canonicalSha256(request.generation_request);
  if (existing.generation_checkpoint.request_sha256 !== requestSha256) {
    return fail(
      ErrorCodes.STORY_AGENT_RUN_INPUT_CONFLICT,
      'The idempotency_key is already bound to a different canonical generation request',
      {
        run_id: existing.run_id,
        expected_request_sha256: existing.generation_checkpoint.request_sha256,
        received_request_sha256: requestSha256,
      },
    );
  }
  return undefined;
}

async function serializeGenerationRun(
  runId: string,
  operation: () => Promise<ApiResponse<StoryAgentRun>>,
): Promise<ApiResponse<StoryAgentRun>> {
  const previous = generationRunQueues.get(runId);
  if (previous) await previous.catch(() => undefined);
  const current = operation();
  generationRunQueues.set(runId, current);
  try {
    return await current;
  } finally {
    if (generationRunQueues.get(runId) === current) generationRunQueues.delete(runId);
  }
}

export async function generateStoryAgentRun(
  request: StoryAgentRunGenerateRequest,
  options: { accessControl?: ProductResourceOwnership } = {},
): Promise<ApiResponse<StoryAgentRun>> {
  const runId = storyAgentGenerationRunId(request.idempotency_key, options.accessControl);
  return serializeGenerationRun(runId, async () => {
    const existing = await readRun(runId);
    if (existing) {
      const conflict = generationRequestConflict(existing, request);
      return conflict ?? success(existing);
    }

    const initial = buildInitialGenerationRun({
      request,
      accessControl: options.accessControl,
      now: new Date().toISOString(),
    });
    const created = await persistNewRun(initial);
    if (!created) {
      const concurrent = await readRun(runId);
      if (!concurrent) {
        return fail(
          ErrorCodes.ARTIFACT_STORAGE_UNAVAILABLE,
          'Concurrent Story Agent run creation completed without a readable ledger',
        );
      }
      const conflict = generationRequestConflict(concurrent, request);
      return conflict ?? success(concurrent);
    }
    return executeGenerationRun(initial);
  });
}

export async function startStoryAgentRun(
  request: StoryAgentRunStartRequest,
): Promise<ApiResponse<StoryAgentRun>> {
  const existing = await readRun(runIdFor(request));
  if (existing) {
    return existing.schema_version === STORY_AGENT_RUN_SCHEMA_VERSION
      ? success(existing)
      : fail(
          ErrorCodes.STORY_AGENT_RUN_INPUT_CONFLICT,
          'The project source resolves to an incompatible existing Story Agent run',
        );
  }
  return refreshRun({ request, incrementResume: false });
}

export async function getStoryAgentRun(
  runId: string,
): Promise<ApiResponse<StoryAgentRun>> {
  const run = await readRun(runId);
  return run
    ? success(run)
    : fail(ErrorCodes.STORY_NOT_FOUND, `Story Agent run "${runId}" not found`);
}

export async function resumeStoryAgentRun(
  runId: string,
): Promise<ApiResponse<StoryAgentRun>> {
  const existing = await readRun(runId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Story Agent run "${runId}" not found`);
  }
  if (existing.schema_version === STORY_AGENT_RUN_SCHEMA_VERSION) {
    return refreshRun({
      request: {
        project_id: existing.input_contract.project_id,
        series_project_id: existing.input_contract.series_project_id,
      },
      existing,
      incrementResume: true,
    });
  }

  return serializeGenerationRun(runId, async () => {
    const current = await readRun(runId);
    if (!current || current.schema_version !== STORY_AGENT_GENERATION_RUN_SCHEMA_VERSION) {
      return fail(ErrorCodes.STORY_NOT_FOUND, `Story Agent run "${runId}" not found`);
    }
    const checkpoint = await readGenerationCheckpoint(current);
    if (checkpoint) {
      return refreshGenerationRun({
        run: current,
        story: checkpoint.story,
        incrementResume: true,
      });
    }
    if (current.generation_checkpoint.status === 'blocked') return success(current);

    const now = new Date().toISOString();
    const provenance = notObservedProvenance({
      idempotency_key: current.input_contract.idempotency_key,
      generation_request: current.input_contract.generation_request,
    });
    const attempts = [
      ...current.generation_checkpoint.attempts,
      {
        attempt_number: current.generation_checkpoint.attempt_count + 1,
        status: 'in_progress' as const,
        started_at: now,
        provenance,
      },
    ];
    const retrying: StoryAgentGenerationRun = {
      ...current,
      status: 'in_progress',
      current_stage: 'generation',
      stage_results: pendingGenerationStages('in_progress'),
      blockers: [],
      retryable_failures: [],
      generation_checkpoint: {
        ...current.generation_checkpoint,
        status: 'in_progress',
        attempt_count: attempts.length,
        attempts,
        last_error: undefined,
        provenance,
      },
      resume_count: current.resume_count + 1,
      updated_at: now,
    };
    await persistRun(retrying);
    return executeGenerationRun(retrying);
  });
}

export async function importStoryAgentRunImages(
  runId: string,
  result: StoryAgentImageGenerationResult,
): Promise<ApiResponse<StoryAgentRunImageImportResponse>> {
  const existing = await readRun(runId);
  if (!existing) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Story Agent run "${runId}" not found`);
  }
  const imageRunId = existing.image_request_manifest?.image_run_id;
  if (!imageRunId) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'Story Agent run has no persisted image request manifest',
    );
  }
  if (result.run_id !== imageRunId) {
    return fail(
      ErrorCodes.VALIDATION_ERROR,
      'Image result run_id must match the Story Agent run image_request_manifest',
    );
  }
  const imported = await importStoryAgentImageGenerationResult(imageRunId, result);
  if (!imported.ok || !imported.data) {
    return fail(
      normalizeErrorCode(imported.error?.code),
      imported.error?.message ?? 'Story Agent image result import failed',
    );
  }
  const resumed = await resumeStoryAgentRun(runId);
  if (!resumed.ok || !resumed.data) {
    return fail(
      normalizeErrorCode(resumed.error?.code),
      resumed.error?.message ?? 'Story Agent run refresh failed after image import',
    );
  }
  return success({
    schema_version: 'story-agent-run-image-import/v1',
    imported_at: new Date().toISOString(),
    image_import: imported.data,
    run: resumed.data,
  });
}

export async function exportStoryAgentRun(
  runId: string,
): Promise<ApiResponse<StoryAgentRunExportResponse>> {
  const run = await readRun(runId);
  if (!run) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Story Agent run "${runId}" not found`);
  }
  return success({
    schema_version: run.schema_version === STORY_AGENT_GENERATION_RUN_SCHEMA_VERSION
      ? 'story-agent-run-export/v2'
      : 'story-agent-run-export/v1',
    run_id: run.run_id,
    run_status: run.status,
    exported_at: new Date().toISOString(),
    video_generation_performed: false,
    preproduction_package: run.preproduction_package ?? null,
  });
}
