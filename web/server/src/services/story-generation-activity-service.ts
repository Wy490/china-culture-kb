import type { Dirent } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import type {
  StoryAgentGenerationActivityEvidence,
  StoryAgentGenerationActivityAttemptEvidence,
  StoryAgentGenerationActivityReportEvidence,
  StoryAgentGenerationActivityStoryEvidence,
  StoryAgentGenerationActivityVersionEvidence,
  StoryAgentLatestPersistedActivityKind,
} from '@shared/types.js'
import {
  inspectStoryGenerationAttemptAuditReadiness,
  readStoryGenerationAttemptAudit,
} from './story-generation-attempt-audit-service.js'
import {
  storyGeneratedRoot,
  storyKbRoot,
} from '../platform/story-storage-root.js'

interface StoryGenerationActivityOptions {
  generatedRoot?: string
  kbRoot?: string
  legacyGeneratedRoot?: string
  now?: Date
}

interface ProjectInventory {
  project_count: number
  versions: StoryAgentGenerationActivityVersionEvidence[]
  pending_transaction_count: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function validTimestamp(value: unknown): string | undefined {
  const timestamp = stringValue(value)
  return timestamp && Number.isFinite(Date.parse(timestamp)) ? timestamp : undefined
}

async function readRecord(filePath: string): Promise<Record<string, unknown> | undefined> {
  try {
    const value = JSON.parse(await readFile(filePath, 'utf8')) as unknown
    return isRecord(value) ? value : undefined
  } catch {
    return undefined
  }
}

async function directoryEntries(directory: string): Promise<Dirent[]> {
  try {
    return await readdir(directory, { withFileTypes: true })
  } catch {
    return []
  }
}

function latestByTimestamp<T>(items: T[], timestamp: (item: T) => string): T | undefined {
  return [...items].sort((left, right) => timestamp(right).localeCompare(timestamp(left)))[0]
}

async function readStoryInventory(root: string): Promise<StoryAgentGenerationActivityStoryEvidence[]> {
  const storiesRoot = resolve(root, 'stories')
  const stories: StoryAgentGenerationActivityStoryEvidence[] = []
  for (const entry of await directoryEntries(storiesRoot)) {
    const candidates = entry.isDirectory()
      ? (await directoryEntries(resolve(storiesRoot, entry.name)))
        .filter(file => file.isFile() && file.name.endsWith('.json'))
        .map(file => resolve(storiesRoot, entry.name, file.name))
      : entry.isFile() && entry.name.endsWith('.json')
        ? [resolve(storiesRoot, entry.name)]
        : []
    for (const filePath of candidates) {
      const record = await readRecord(filePath)
      if (!record) continue
      const requestMeta = isRecord(record._request_meta) ? record._request_meta : {}
      const createdAt = validTimestamp(requestMeta.created_at ?? record.created_at)
      if (!createdAt) continue
      stories.push({
        story_id: stringValue(record.storyId ?? record.story_id) ?? basename(filePath, '.json'),
        created_at: createdAt,
      })
    }
  }
  return stories
}

async function readProjectInventory(root: string): Promise<ProjectInventory> {
  const projectsRoot = resolve(root, 'projects')
  let projectCount = 0
  let pendingTransactionCount = 0
  const versions: StoryAgentGenerationActivityVersionEvidence[] = []
  for (const projectEntry of await directoryEntries(projectsRoot)) {
    if (!projectEntry.isDirectory()) continue
    const projectDirectory = resolve(projectsRoot, projectEntry.name)
    const project = await readRecord(resolve(projectDirectory, 'project.json'))
    if (project) projectCount += 1
    for (const transaction of await directoryEntries(resolve(projectDirectory, '.transactions'))) {
      if (transaction.isFile() && transaction.name.endsWith('.intent.json')) {
        pendingTransactionCount += 1
      }
    }
    for (const versionEntry of await directoryEntries(resolve(projectDirectory, 'versions'))) {
      if (!versionEntry.isFile() || !versionEntry.name.endsWith('.json')) continue
      const version = await readRecord(resolve(projectDirectory, 'versions', versionEntry.name))
      if (!version) continue
      const createdAt = validTimestamp(version.created_at)
      if (!createdAt) continue
      versions.push({
        project_id: stringValue(version.project_id ?? project?.project_id) ?? projectEntry.name,
        version_id: stringValue(version.version_id) ?? basename(versionEntry.name, '.json'),
        created_at: createdAt,
        change_type: stringValue(version.change_type),
      })
    }
  }
  return {
    project_count: projectCount,
    versions,
    pending_transaction_count: pendingTransactionCount,
  }
}

async function readReportInventory(root: string): Promise<StoryAgentGenerationActivityReportEvidence[]> {
  const reports: StoryAgentGenerationActivityReportEvidence[] = []
  for (const entry of await directoryEntries(resolve(root, 'reports'))) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const record = await readRecord(resolve(root, 'reports', entry.name))
    const generatedAt = validTimestamp(record?.generated_at ?? record?.updated_at)
    if (!generatedAt) continue
    reports.push({ report_file: entry.name, generated_at: generatedAt })
  }
  return reports
}

export async function inspectStoryGenerationActivity(
  options: StoryGenerationActivityOptions = {},
): Promise<StoryAgentGenerationActivityEvidence> {
  const activeRoot = options.generatedRoot ?? storyGeneratedRoot()
  const activeKbRoot = options.kbRoot ?? storyKbRoot()
  const legacyRoot = options.legacyGeneratedRoot ?? resolve(activeRoot, '..', 'web', 'generated')
  const [
    stories,
    projects,
    reports,
    legacyStories,
    legacyProjects,
    attemptAudit,
    attemptAuditReadiness,
  ] = await Promise.all([
    readStoryInventory(activeRoot),
    readProjectInventory(activeRoot),
    readReportInventory(activeKbRoot),
    readStoryInventory(legacyRoot),
    readProjectInventory(legacyRoot),
    readStoryGenerationAttemptAudit({ generatedRoot: activeRoot }),
    inspectStoryGenerationAttemptAuditReadiness({ generatedRoot: activeRoot }),
  ])
  const latestStory = latestByTimestamp(stories, item => item.created_at)
  const latestProjectVersion = latestByTimestamp(projects.versions, item => item.created_at)
  const latestReport = latestByTimestamp(reports, item => item.generated_at)
  const legacyLatestStory = latestByTimestamp(legacyStories, item => item.created_at)
  const latestGenerationAttempt = latestByTimestamp(
    attemptAudit.attempts,
    item => item.started_at,
  ) as StoryAgentGenerationActivityAttemptEvidence | undefined
  const revisionsAfterLatestStory = latestStory
    ? projects.versions.filter(version =>
      version.change_type !== 'initial_generation' && version.created_at > latestStory.created_at,
    )
    : []
  const reportsAfterLatestStory = latestStory
    ? reports.filter(report => report.generated_at > latestStory.created_at)
    : []
  const storageRootSwitchDetected = Boolean(
    legacyLatestStory
      && (!latestStory || legacyLatestStory.created_at > latestStory.created_at),
  )
  const projectRevisionOnlyActivityDetected = revisionsAfterLatestStory.length > 0
  const reportOnlyActivityDetected = reportsAfterLatestStory.length > 0
    && !projectRevisionOnlyActivityDetected
  const latestPersistedActivityKind: StoryAgentLatestPersistedActivityKind = projectRevisionOnlyActivityDetected
    ? 'project_revision'
    : reportOnlyActivityDetected
      ? 'report_only'
      : latestStory
        ? 'story_generation'
        : 'none'
  const successfulAttemptMatchesLatestStory = Boolean(
    latestGenerationAttempt?.status === 'succeeded'
      && latestGenerationAttempt.terminal_at
      && latestStory
      && latestGenerationAttempt.started_at <= latestStory.created_at
      && latestStory.created_at <= latestGenerationAttempt.terminal_at,
  )
  const durableAttemptHistoryAvailable = attemptAudit.available
    && attemptAuditReadiness.history_integrity === 'valid'
    && attemptAuditReadiness.lock_status !== 'active'
    && attemptAuditReadiness.lock_status !== 'invalid'
  const noGenerationRequestConfirmed = durableAttemptHistoryAvailable && successfulAttemptMatchesLatestStory
  const generationPipelineFailureConfirmed = durableAttemptHistoryAvailable
    && latestGenerationAttempt?.status === 'failed'
  const generationAttemptIncompleteDetected = durableAttemptHistoryAvailable
    && latestGenerationAttempt?.status === 'started'
  const diagnosis = projects.pending_transaction_count > 0
    ? 'pending_transaction_detected' as const
    : storageRootSwitchDetected
      ? 'storage_root_mismatch_detected' as const
      : !durableAttemptHistoryAvailable
        ? 'attempt_history_unavailable' as const
        : generationAttemptIncompleteDetected
          ? 'generation_attempt_incomplete' as const
          : generationPipelineFailureConfirmed
            ? 'generation_pipeline_failure_detected' as const
            : noGenerationRequestConfirmed
              ? 'no_generation_request_since_latest_success' as const
              : 'attempt_history_unavailable' as const
  const unresolvedPossibilities = generationAttemptIncompleteDetected
    ? ['generation_request_in_progress_or_interrupted'] as const
    : durableAttemptHistoryAvailable && (generationPipelineFailureConfirmed || noGenerationRequestConfirmed)
      ? []
      : [
        'no_generation_request_submitted',
        'generation_request_failed_before_persistence',
      ] as const

  return {
    schema_version: 'story-agent-generation-activity/v1',
    generated_at: (options.now ?? new Date()).toISOString(),
    diagnosis,
    latest_persisted_activity_kind: latestPersistedActivityKind,
    latest_story: latestStory,
    latest_project_version: latestProjectVersion,
    latest_report: latestReport,
    legacy_latest_story: legacyLatestStory,
    latest_generation_attempt: latestGenerationAttempt,
    attempt_audit_readiness: attemptAuditReadiness,
    summary: {
      story_count: stories.length,
      project_count: projects.project_count,
      version_count: projects.versions.length,
      report_count: reports.length,
      project_revision_after_latest_story_count: revisionsAfterLatestStory.length,
      report_after_latest_story_count: reportsAfterLatestStory.length,
      pending_transaction_count: projects.pending_transaction_count,
      legacy_story_count: legacyStories.length,
      legacy_project_count: legacyProjects.project_count,
      generation_attempt_count: attemptAudit.attempts.length,
      generation_attempt_succeeded_count: attemptAudit.attempts.filter(attempt => attempt.status === 'succeeded').length,
      generation_attempt_failed_count: attemptAudit.attempts.filter(attempt => attempt.status === 'failed').length,
      generation_attempt_incomplete_count: attemptAudit.attempts.filter(attempt => attempt.status === 'started').length,
      generation_attempt_invalid_event_count: attemptAudit.invalid_line_count,
    },
    signals: {
      durable_generation_attempt_history_available: durableAttemptHistoryAvailable,
      generation_attempt_audit_ready_for_next_request: attemptAuditReadiness.ready_for_next_attempt,
      no_generation_request_confirmed: noGenerationRequestConfirmed,
      generation_pipeline_failure_confirmed: generationPipelineFailureConfirmed,
      generation_attempt_incomplete_detected: generationAttemptIncompleteDetected,
      storage_root_switch_detected: storageRootSwitchDetected,
      report_only_activity_detected: reportOnlyActivityDetected,
      project_revision_only_activity_detected: projectRevisionOnlyActivityDetected,
    },
    unresolved_possibilities: [...unresolvedPossibilities],
    safety: {
      read_only: true,
      generated_files_modified: false,
      model_invoked: false,
    },
    notes: [
      'Successful story generation is observable from story _request_meta.created_at; project revisions and reports are tracked separately.',
      durableAttemptHistoryAvailable
        ? 'The durable Web generation-attempt ledger distinguishes the latest successful, failed, or incomplete canonical request without storing request or output content.'
        : 'No valid durable generation-attempt history exists, so no new request and a failure before persistence remain intentionally unresolved.',
      'The known legacy misresolved root is inspection-only and is never merged, copied, recovered, or selected by this diagnostic.',
      'This diagnostic performs no model invocation and writes no generated files.',
    ],
  }
}
