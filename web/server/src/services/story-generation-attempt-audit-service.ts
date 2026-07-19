import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import {
  access,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  unlink,
} from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  ErrorCodes,
  type ApiResponse,
  type ErrorCode,
  type StoryGenerationAttemptAuditReadiness,
  type StoryGenerationAttemptAuditReadinessBlocker,
  type StoryGenerationAttemptAuditOperatorAction,
  type StoryGenerationAttemptAuditConfigurationWarning,
  type VideoType,
} from '@shared/types.js'
import { storyGeneratedRoot } from '../platform/story-storage-root.js'

export const STORY_GENERATION_ATTEMPT_AUDIT_SCHEMA = 'story-generation-attempt-event/v1' as const
export const STORY_GENERATION_ATTEMPT_AUDIT_ENTRYPOINT = 'web_api_stories_generate' as const
const LEDGER_RELATIVE_PATH = ['system', 'story-generation-attempts.jsonl'] as const
const DEFAULT_MAX_BYTES = 1_048_576
const DEFAULT_MAX_ARCHIVES = 4
const MIN_MAX_BYTES = 256
const MAX_MAX_BYTES = 1_073_741_824
const MAX_ARCHIVES_LIMIT = 32
const DEFAULT_LOCK_TIMEOUT_MS = 5_000
const DEFAULT_LOCK_RETRY_MS = 10
const DEFAULT_LOCK_STALE_MS = 30_000
const ATTEMPT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DOMAIN_ID_PATTERN = /^[a-z][a-z0-9_]{1,63}$/
const VIDEO_TYPES = new Set<VideoType>([
  'character_story',
  'historical_drama',
  'legend_story',
  'culture_promo',
  'heritage_promo',
  'city_brand_promo',
  'scene_short',
  'landscape_mood',
  'documentary_short',
  'explainer_video',
  'lecture_video',
  'education_training',
  'children_story',
  'social_short',
  'ai_comic_drama',
])
const STABLE_ERROR_CODES = new Set<string>(Object.values(ErrorCodes))
const writeQueues = new Map<string, Promise<void>>()

export type StoryGenerationAttemptStatus = 'started' | 'succeeded' | 'failed'
export type StoryGenerationAttemptErrorCode = ErrorCode | 'UNHANDLED_GENERATION_ERROR'

export interface StoryGenerationAttemptEvent {
  schema_version: typeof STORY_GENERATION_ATTEMPT_AUDIT_SCHEMA
  attempt_id: string
  occurred_at: string
  entrypoint: typeof STORY_GENERATION_ATTEMPT_AUDIT_ENTRYPOINT
  source_domain: string
  video_type: VideoType
  status: StoryGenerationAttemptStatus
  error_code?: StoryGenerationAttemptErrorCode
}

export interface StoryGenerationAttempt {
  attempt_id: string
  entrypoint: typeof STORY_GENERATION_ATTEMPT_AUDIT_ENTRYPOINT
  source_domain: string
  video_type: VideoType
  started_at: string
}

export interface StoryGenerationAttemptAuditRecord extends StoryGenerationAttempt {
  status: StoryGenerationAttemptStatus
  started_at: string
  terminal_at?: string
  error_code?: StoryGenerationAttemptErrorCode
}

export interface StoryGenerationAttemptAuditInspection {
  available: boolean
  attempts: StoryGenerationAttemptAuditRecord[]
  valid_event_count: number
  invalid_line_count: number
  rotated_file_count: number
}

export interface StoryGenerationAttemptAuditOptions {
  generatedRoot?: string
  now?: () => Date
  attemptId?: () => string
  maxBytes?: number
  maxArchives?: number
  lockTimeoutMs?: number
  lockRetryMs?: number
  lockStaleMs?: number
  eventFileSync?: (descriptor: FileHandle) => Promise<void>
  auditDirectorySync?: (descriptor: FileHandle) => Promise<void>
  afterLedgerRotation?: () => Promise<void>
}

export class StoryGenerationAttemptAuditUnavailableError extends Error {
  readonly code = ErrorCodes.STORY_GENERATION_AUDIT_UNAVAILABLE

  constructor() {
    super('Durable story generation attempt audit is unavailable')
    this.name = 'StoryGenerationAttemptAuditUnavailableError'
  }
}

function integerOption(
  explicit: number | undefined,
  environmentName: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = explicit ?? Number(process.env[environmentName]?.trim())
  return Number.isSafeInteger(raw) && raw >= minimum && raw <= maximum ? raw : fallback
}

function integerOptionInvalid(
  explicit: number | undefined,
  environmentName: string,
  minimum: number,
  maximum: number,
): boolean {
  if (explicit !== undefined) {
    return !Number.isSafeInteger(explicit) || explicit < minimum || explicit > maximum
  }
  const environmentValue = process.env[environmentName]
  if (environmentValue === undefined) return false
  const parsed = Number(environmentValue.trim())
  return !Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum
}

function ownerOnlyPermissions(mode: number): boolean {
  return (mode & 0o077) === 0
}

function maxBytes(options: StoryGenerationAttemptAuditOptions): number {
  return integerOption(
    options.maxBytes,
    'STORY_GENERATION_ATTEMPT_AUDIT_MAX_BYTES',
    DEFAULT_MAX_BYTES,
    MIN_MAX_BYTES,
    MAX_MAX_BYTES,
  )
}

function maxArchives(options: StoryGenerationAttemptAuditOptions): number {
  return integerOption(
    options.maxArchives,
    'STORY_GENERATION_ATTEMPT_AUDIT_MAX_ARCHIVES',
    DEFAULT_MAX_ARCHIVES,
    1,
    MAX_ARCHIVES_LIMIT,
  )
}

function lockTimeoutMs(options: StoryGenerationAttemptAuditOptions): number {
  return integerOption(
    options.lockTimeoutMs,
    'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_TIMEOUT_MS',
    DEFAULT_LOCK_TIMEOUT_MS,
    10,
    60_000,
  )
}

function lockRetryMs(options: StoryGenerationAttemptAuditOptions): number {
  return integerOption(
    options.lockRetryMs,
    'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_RETRY_MS',
    DEFAULT_LOCK_RETRY_MS,
    1,
    1_000,
  )
}

function lockStaleMs(options: StoryGenerationAttemptAuditOptions): number {
  return integerOption(
    options.lockStaleMs,
    'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_STALE_MS',
    DEFAULT_LOCK_STALE_MS,
    10,
    3_600_000,
  )
}

export function storyGenerationAttemptAuditPath(generatedRoot = storyGeneratedRoot()): string {
  return resolve(generatedRoot, ...LEDGER_RELATIVE_PATH)
}

async function existingFileSize(filePath: string): Promise<number> {
  try {
    const target = await lstat(filePath)
    if (!target.isFile() || target.isSymbolicLink()) throw new Error('ledger target must be a regular file')
    return target.size
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0
    throw error
  }
}

async function moveIfPresent(source: string, destination: string): Promise<void> {
  try {
    await rename(source, destination)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

async function unlinkIfPresent(filePath: string): Promise<void> {
  try {
    await unlink(filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

async function rotateLedger(filePath: string, archiveLimit: number): Promise<void> {
  await unlinkIfPresent(`${filePath}.${archiveLimit}`)
  for (let index = archiveLimit - 1; index >= 1; index -= 1) {
    await moveIfPresent(`${filePath}.${index}`, `${filePath}.${index + 1}`)
  }
  await moveIfPresent(filePath, `${filePath}.1`)
}

async function archiveIndexes(auditDirectory: string): Promise<number[]> {
  try {
    return (await readdir(auditDirectory))
      .map(name => name.match(/^story-generation-attempts\.jsonl\.(\d+)$/)?.[1])
      .filter((value): value is string => Boolean(value))
      .map(Number)
      .filter(value => Number.isSafeInteger(value) && value >= 1)
      .filter((value, index, values) => values.indexOf(value) === index)
      .sort((left, right) => left - right)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function serializeWrite(filePath: string, operation: () => Promise<void>): Promise<void> {
  const previous = writeQueues.get(filePath) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(operation)
  writeQueues.set(filePath, next)
  try {
    await next
  } finally {
    if (writeQueues.get(filePath) === next) writeQueues.delete(filePath)
  }
}

interface StoryGenerationAttemptLockRecord {
  schema_version: 'story-generation-attempt-lock/v1'
  owner_id: string
  created_at: string
}

interface StoryGenerationAttemptLock {
  lockPath: string
  ownerId: string
}

function lockRecord(value: unknown): StoryGenerationAttemptLockRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const candidate = value as Partial<StoryGenerationAttemptLockRecord>
  return candidate.schema_version === 'story-generation-attempt-lock/v1'
    && typeof candidate.owner_id === 'string'
    && ATTEMPT_ID_PATTERN.test(candidate.owner_id)
    && typeof candidate.created_at === 'string'
    && Number.isFinite(Date.parse(candidate.created_at))
    ? candidate as StoryGenerationAttemptLockRecord
    : undefined
}

async function readLockRecord(lockPath: string): Promise<StoryGenerationAttemptLockRecord | undefined> {
  try {
    const target = await lstat(lockPath)
    if (!target.isFile() || target.isSymbolicLink() || !ownerOnlyPermissions(target.mode)) return undefined
    return lockRecord(JSON.parse(await readFile(lockPath, 'utf8')) as unknown)
  } catch {
    return undefined
  }
}

async function recoverExpiredLock(lockPath: string, staleMs: number): Promise<boolean> {
  let target
  try {
    target = await lstat(lockPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true
    throw error
  }
  if (!target.isFile() || target.isSymbolicLink()) throw new Error('ledger lock target is unsafe')
  if (Date.now() - target.mtimeMs < staleMs) return false
  const before = await readLockRecord(lockPath)
  if (!before) throw new Error('expired ledger lock record is invalid')
  const confirmed = await readLockRecord(lockPath)
  if (!confirmed || confirmed.owner_id !== before.owner_id) return false
  try {
    await unlink(lockPath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true
    throw error
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds))
}

async function acquireLedgerLock(
  filePath: string,
  options: StoryGenerationAttemptAuditOptions,
): Promise<StoryGenerationAttemptLock> {
  const lockPath = `${filePath}.lock`
  const ownerId = randomUUID()
  const startedAt = Date.now()
  while (true) {
    try {
      const descriptor = await open(lockPath, 'wx', 0o600)
      try {
        const record: StoryGenerationAttemptLockRecord = {
          schema_version: 'story-generation-attempt-lock/v1',
          owner_id: ownerId,
          created_at: new Date().toISOString(),
        }
        await descriptor.writeFile(`${JSON.stringify(record)}\n`, 'utf8')
        await descriptor.sync()
      } catch (error) {
        await descriptor.close().catch(() => undefined)
        await unlinkIfPresent(lockPath).catch(() => undefined)
        throw error
      }
      await descriptor.close()
      return { lockPath, ownerId }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      if (await recoverExpiredLock(lockPath, lockStaleMs(options))) continue
      if (Date.now() - startedAt >= lockTimeoutMs(options)) {
        throw new Error('ledger lock acquisition timed out')
      }
      await wait(lockRetryMs(options))
    }
  }
}

async function releaseLedgerLock(lock: StoryGenerationAttemptLock): Promise<void> {
  const current = await readLockRecord(lock.lockPath)
  if (current?.owner_id !== lock.ownerId) return
  await unlinkIfPresent(lock.lockPath)
}

async function appendEventLineAndSync(
  filePath: string,
  line: string,
  options: StoryGenerationAttemptAuditOptions,
): Promise<void> {
  const flags = constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW
  const descriptor = await open(filePath, flags, 0o600)
  try {
    const target = await descriptor.stat()
    if (!target.isFile()) throw new Error('ledger append target is unsafe')
    await descriptor.writeFile(line, 'utf8')
    await (options.eventFileSync ?? (handle => handle.sync()))(descriptor)
  } finally {
    await descriptor.close()
  }
}

async function syncAuditDirectory(
  auditDirectory: string,
  options: StoryGenerationAttemptAuditOptions,
): Promise<void> {
  const descriptor = await open(auditDirectory, constants.O_RDONLY)
  try {
    const target = await descriptor.stat()
    if (!target.isDirectory()) throw new Error('ledger directory is unsafe')
    await (options.auditDirectorySync ?? (handle => handle.sync()))(descriptor)
  } finally {
    await descriptor.close()
  }
}

async function appendEvent(
  event: StoryGenerationAttemptEvent,
  options: StoryGenerationAttemptAuditOptions,
): Promise<void> {
  const generatedRoot = options.generatedRoot ?? storyGeneratedRoot()
  const filePath = storyGenerationAttemptAuditPath(generatedRoot)
  const line = `${JSON.stringify(event)}\n`
  try {
    await serializeWrite(filePath, async () => {
      const auditDirectory = resolve(generatedRoot, 'system')
      await mkdir(auditDirectory, { recursive: true, mode: 0o700 })
      const directoryTarget = await lstat(auditDirectory)
      if (!directoryTarget.isDirectory()
        || directoryTarget.isSymbolicLink()
        || !ownerOnlyPermissions(directoryTarget.mode)) {
        throw new Error('ledger directory is unsafe')
      }
      const lock = await acquireLedgerLock(filePath, options)
      try {
        const retainedArchiveIndexes = await archiveIndexes(auditDirectory)
        if (retainedArchiveIndexes.some(index => index > maxArchives(options))) {
          throw new Error('ledger archive retention exceeds configured limit')
        }
        const currentAudit = await readStoryGenerationAttemptAudit({
          generatedRoot,
          maxArchives: options.maxArchives,
        })
        if (currentAudit.invalid_line_count > 0) throw new Error('ledger history is invalid')
        const currentSize = await existingFileSize(filePath)
        if (currentSize > 0 && currentSize + Buffer.byteLength(line, 'utf8') > maxBytes(options)) {
          await rotateLedger(filePath, maxArchives(options))
          await options.afterLedgerRotation?.()
        }
        await appendEventLineAndSync(filePath, line, options)
        const target = await lstat(filePath)
        if (!target.isFile() || target.isSymbolicLink()) throw new Error('ledger append target is unsafe')
        await syncAuditDirectory(auditDirectory, options)
      } finally {
        await releaseLedgerLock(lock)
      }
    })
  } catch {
    throw new StoryGenerationAttemptAuditUnavailableError()
  }
}

function eventFor(
  attempt: StoryGenerationAttempt,
  status: StoryGenerationAttemptStatus,
  options: StoryGenerationAttemptAuditOptions,
  errorCode?: StoryGenerationAttemptErrorCode,
): StoryGenerationAttemptEvent {
  const candidateTimestamp = status === 'started'
    ? attempt.started_at
    : (options.now?.() ?? new Date()).toISOString()
  return {
    schema_version: STORY_GENERATION_ATTEMPT_AUDIT_SCHEMA,
    attempt_id: attempt.attempt_id,
    occurred_at: candidateTimestamp < attempt.started_at ? attempt.started_at : candidateTimestamp,
    entrypoint: attempt.entrypoint,
    source_domain: attempt.source_domain,
    video_type: attempt.video_type,
    status,
    ...(errorCode ? { error_code: errorCode } : {}),
  }
}

export async function beginStoryGenerationAttempt(
  input: { sourceDomain: string; videoType: VideoType },
  options: StoryGenerationAttemptAuditOptions = {},
): Promise<StoryGenerationAttempt> {
  const attempt: StoryGenerationAttempt = {
    attempt_id: options.attemptId?.() ?? randomUUID(),
    entrypoint: STORY_GENERATION_ATTEMPT_AUDIT_ENTRYPOINT,
    source_domain: input.sourceDomain,
    video_type: input.videoType,
    started_at: (options.now?.() ?? new Date()).toISOString(),
  }
  if (!ATTEMPT_ID_PATTERN.test(attempt.attempt_id) || !DOMAIN_ID_PATTERN.test(attempt.source_domain)) {
    throw new StoryGenerationAttemptAuditUnavailableError()
  }
  await appendEvent(eventFor(attempt, 'started', options), options)
  return attempt
}

export async function succeedStoryGenerationAttempt(
  attempt: StoryGenerationAttempt,
  options: StoryGenerationAttemptAuditOptions = {},
): Promise<void> {
  await appendEvent(eventFor(attempt, 'succeeded', options), options)
}

export async function failStoryGenerationAttempt(
  attempt: StoryGenerationAttempt,
  errorCode: StoryGenerationAttemptErrorCode,
  options: StoryGenerationAttemptAuditOptions = {},
): Promise<void> {
  await appendEvent(eventFor(attempt, 'failed', options, errorCode), options)
}

function stableErrorCode(value: unknown): StoryGenerationAttemptErrorCode {
  const code = value && typeof value === 'object' && 'code' in value
    ? (value as { code?: unknown }).code
    : value
  return typeof code === 'string' && STABLE_ERROR_CODES.has(code)
    ? code as ErrorCode
    : 'UNHANDLED_GENERATION_ERROR'
}

export async function runWithStoryGenerationAttemptAudit<T>(
  input: { sourceDomain: string; videoType: VideoType },
  generate: () => Promise<ApiResponse<T>>,
  options: StoryGenerationAttemptAuditOptions = {},
): Promise<ApiResponse<T>> {
  const attempt = await beginStoryGenerationAttempt(input, options)
  let result: ApiResponse<T>
  try {
    result = await generate()
  } catch (error) {
    try {
      await failStoryGenerationAttempt(attempt, stableErrorCode(error), options)
    } catch {
      // Preserve the original generation failure even if its terminal audit cannot be written.
    }
    throw error
  }

  if (!result.ok) {
    try {
      await failStoryGenerationAttempt(attempt, stableErrorCode(result.error?.code), options)
    } catch {
      // The generation already failed; the original domain failure remains the caller contract.
    }
    return result
  }

  await succeedStoryGenerationAttempt(attempt, options)
  return result
}

function isEvent(value: unknown): value is StoryGenerationAttemptEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const event = value as Partial<StoryGenerationAttemptEvent>
  return event.schema_version === STORY_GENERATION_ATTEMPT_AUDIT_SCHEMA
    && typeof event.attempt_id === 'string'
    && ATTEMPT_ID_PATTERN.test(event.attempt_id)
    && typeof event.occurred_at === 'string'
    && Number.isFinite(Date.parse(event.occurred_at))
    && event.entrypoint === STORY_GENERATION_ATTEMPT_AUDIT_ENTRYPOINT
    && typeof event.source_domain === 'string'
    && DOMAIN_ID_PATTERN.test(event.source_domain)
    && typeof event.video_type === 'string'
    && VIDEO_TYPES.has(event.video_type as VideoType)
    && (event.status === 'started' || event.status === 'succeeded' || event.status === 'failed')
    && (event.status === 'failed'
      ? typeof event.error_code === 'string'
        && (STABLE_ERROR_CODES.has(event.error_code) || event.error_code === 'UNHANDLED_GENERATION_ERROR')
      : event.error_code === undefined)
}

async function readEvents(filePath: string): Promise<{
  events: StoryGenerationAttemptEvent[]
  invalidLineCount: number
  exists: boolean
}> {
  let raw: string
  try {
    const target = await lstat(filePath)
    if (!target.isFile() || target.isSymbolicLink() || !ownerOnlyPermissions(target.mode)) {
      return { events: [], invalidLineCount: 1, exists: true }
    }
    raw = await readFile(filePath, 'utf8')
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT'
      ? { events: [], invalidLineCount: 0, exists: false }
      : { events: [], invalidLineCount: 1, exists: true }
  }
  const events: StoryGenerationAttemptEvent[] = []
  let invalidLineCount = 0
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      const value = JSON.parse(line) as unknown
      if (isEvent(value)) events.push(value)
      else invalidLineCount += 1
    } catch {
      invalidLineCount += 1
    }
  }
  return { events, invalidLineCount, exists: true }
}

export async function readStoryGenerationAttemptAudit(
  options: Pick<StoryGenerationAttemptAuditOptions, 'generatedRoot' | 'maxArchives'> = {},
): Promise<StoryGenerationAttemptAuditInspection> {
  const filePath = storyGenerationAttemptAuditPath(options.generatedRoot ?? storyGeneratedRoot())
  const archiveLimit = maxArchives(options)
  const paths = Array.from({ length: archiveLimit }, (_, index) => `${filePath}.${archiveLimit - index}`)
    .concat(filePath)
  const files = await Promise.all(paths.map(readEvents))
  const events = files.flatMap(file => file.events)
  const attempts = new Map<string, StoryGenerationAttemptAuditRecord>()
  for (const event of events) {
    const existing = attempts.get(event.attempt_id)
    if (event.status === 'started') {
      if (!existing) {
        attempts.set(event.attempt_id, {
          attempt_id: event.attempt_id,
          entrypoint: event.entrypoint,
          source_domain: event.source_domain,
          video_type: event.video_type,
          started_at: event.occurred_at,
          status: 'started',
        })
      }
      continue
    }
    if (!existing || existing.status !== 'started' || event.occurred_at < existing.started_at) continue
    existing.status = event.status
    existing.terminal_at = event.occurred_at
    if (event.status === 'failed') existing.error_code = event.error_code
  }
  return {
    available: events.length > 0 && files.every(file => file.invalidLineCount === 0),
    attempts: [...attempts.values()].sort((left, right) => left.started_at.localeCompare(right.started_at)),
    valid_event_count: events.length,
    invalid_line_count: files.reduce((sum, file) => sum + file.invalidLineCount, 0),
    rotated_file_count: files.filter((file, index) => index < files.length - 1 && file.exists).length,
  }
}

async function nearestWritableAncestor(targetPath: string): Promise<boolean> {
  let candidate = targetPath
  while (true) {
    try {
      const target = await lstat(candidate)
      if (target.isSymbolicLink() || !target.isDirectory()) return false
      await access(candidate, constants.W_OK)
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return false
      const parent = dirname(candidate)
      if (parent === candidate) return false
      candidate = parent
    }
  }
}

const OPERATOR_ACTION_BY_BLOCKER: Record<
  StoryGenerationAttemptAuditReadinessBlocker,
  StoryGenerationAttemptAuditOperatorAction
> = {
  audit_parent_not_writable: 'review_audit_parent_permissions_after_backup',
  audit_directory_unsafe: 'review_audit_directory_safety_after_backup',
  audit_directory_not_writable: 'review_audit_directory_permissions_after_backup',
  audit_directory_permissions_unsafe: 'review_audit_directory_permissions_after_backup',
  ledger_target_unsafe: 'review_ledger_target_safety_after_backup',
  ledger_permissions_unsafe: 'review_ledger_permissions_after_backup',
  archive_target_unsafe: 'review_archive_target_safety_after_backup',
  archive_permissions_unsafe: 'review_archive_permissions_after_backup',
  archive_retention_exceeded: 'review_archive_retention_after_backup',
  ledger_history_invalid: 'review_invalid_history_after_backup',
  ledger_lock_active: 'wait_for_active_writer_and_reinspect',
  ledger_lock_permissions_unsafe: 'review_lock_permissions_after_backup',
  ledger_lock_invalid: 'review_invalid_lock_after_backup',
}

function operatorActions(
  blockers: StoryGenerationAttemptAuditReadinessBlocker[],
  lockStatus: StoryGenerationAttemptAuditReadiness['lock_status'],
): StoryGenerationAttemptAuditOperatorAction[] {
  const actions = [...new Set(blockers.map(blocker => OPERATOR_ACTION_BY_BLOCKER[blocker]))]
  if (lockStatus === 'expired_recoverable') {
    actions.push('reinspect_expired_lock_on_next_canonical_request')
  }
  return actions.length > 0 ? actions : ['no_action_required']
}

export async function inspectStoryGenerationAttemptAuditReadiness(
  options: StoryGenerationAttemptAuditOptions = {},
): Promise<StoryGenerationAttemptAuditReadiness> {
  const generatedRoot = options.generatedRoot ?? storyGeneratedRoot()
  const auditDirectory = resolve(generatedRoot, 'system')
  const ledgerPath = storyGenerationAttemptAuditPath(generatedRoot)
  const archiveLimit = maxArchives(options)
  const blockers: StoryGenerationAttemptAuditReadinessBlocker[] = []
  const warnings: string[] = []
  const configurationWarnings: StoryGenerationAttemptAuditConfigurationWarning[] = []
  if (integerOptionInvalid(options.maxBytes, 'STORY_GENERATION_ATTEMPT_AUDIT_MAX_BYTES', MIN_MAX_BYTES, MAX_MAX_BYTES)) {
    configurationWarnings.push('invalid_max_bytes_configuration_fell_back_to_default')
  }
  if (integerOptionInvalid(options.maxArchives, 'STORY_GENERATION_ATTEMPT_AUDIT_MAX_ARCHIVES', 1, MAX_ARCHIVES_LIMIT)) {
    configurationWarnings.push('invalid_max_archives_configuration_fell_back_to_default')
  }
  if (integerOptionInvalid(options.lockTimeoutMs, 'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_TIMEOUT_MS', 10, 60_000)) {
    configurationWarnings.push('invalid_lock_timeout_configuration_fell_back_to_default')
  }
  if (integerOptionInvalid(options.lockRetryMs, 'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_RETRY_MS', 1, 1_000)) {
    configurationWarnings.push('invalid_lock_retry_configuration_fell_back_to_default')
  }
  if (integerOptionInvalid(options.lockStaleMs, 'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_STALE_MS', 10, 3_600_000)) {
    configurationWarnings.push('invalid_lock_stale_configuration_fell_back_to_default')
  }
  let storageInitialized = false
  let directorySafe = true
  let permissionPolicySatisfied = true

  try {
    const target = await lstat(auditDirectory)
    storageInitialized = true
    if (!target.isDirectory() || target.isSymbolicLink()) {
      directorySafe = false
      blockers.push('audit_directory_unsafe')
    } else {
      if (!ownerOnlyPermissions(target.mode)) {
        permissionPolicySatisfied = false
        blockers.push('audit_directory_permissions_unsafe')
      }
      try {
        await access(auditDirectory, constants.W_OK)
      } catch {
        blockers.push('audit_directory_not_writable')
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      directorySafe = false
      blockers.push('audit_directory_unsafe')
    } else if (!await nearestWritableAncestor(auditDirectory)) {
      blockers.push('audit_parent_not_writable')
    }
  }

  let ledgerPresent = false
  let currentFileBytes = 0
  let archiveCount = 0
  let unsafeLedgerTarget = false
  if (directorySafe) {
    try {
      const target = await lstat(ledgerPath)
      ledgerPresent = true
      if (!target.isFile() || target.isSymbolicLink()) {
        unsafeLedgerTarget = true
        blockers.push('ledger_target_unsafe')
      } else {
        currentFileBytes = target.size
        if (!ownerOnlyPermissions(target.mode)) {
          permissionPolicySatisfied = false
          blockers.push('ledger_permissions_unsafe')
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        unsafeLedgerTarget = true
        blockers.push('ledger_target_unsafe')
      }
    }
    const retainedArchiveIndexes = await archiveIndexes(auditDirectory)
    archiveCount = retainedArchiveIndexes.length
    if (retainedArchiveIndexes.some(index => index > archiveLimit)) {
      blockers.push('archive_retention_exceeded')
    }
    for (const index of retainedArchiveIndexes) {
      try {
        const target = await lstat(`${ledgerPath}.${index}`)
        if (!target.isFile() || target.isSymbolicLink()) {
          unsafeLedgerTarget = true
          if (!blockers.includes('archive_target_unsafe')) blockers.push('archive_target_unsafe')
        } else if (!ownerOnlyPermissions(target.mode)) {
          permissionPolicySatisfied = false
          if (!blockers.includes('archive_permissions_unsafe')) blockers.push('archive_permissions_unsafe')
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          unsafeLedgerTarget = true
          if (!blockers.includes('archive_target_unsafe')) blockers.push('archive_target_unsafe')
        }
      }
    }
  }

  let lockStatus: StoryGenerationAttemptAuditReadiness['lock_status'] = 'absent'
  if (directorySafe && storageInitialized) {
    const lockPath = `${ledgerPath}.lock`
    try {
      const target = await lstat(lockPath)
      const record = await readLockRecord(lockPath)
      if (!target.isFile() || target.isSymbolicLink() || !record) {
        lockStatus = 'invalid'
        blockers.push('ledger_lock_invalid')
      } else if (!ownerOnlyPermissions(target.mode)) {
        permissionPolicySatisfied = false
        lockStatus = 'invalid'
        blockers.push('ledger_lock_permissions_unsafe')
      } else if (Date.now() - target.mtimeMs >= lockStaleMs(options)) {
        lockStatus = 'expired_recoverable'
        warnings.push('expired_lock_will_be_recovered_on_next_attempt')
      } else {
        lockStatus = 'active'
        blockers.push('ledger_lock_active')
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        lockStatus = 'invalid'
        blockers.push('ledger_lock_invalid')
      }
    }
  }

  const audit = directorySafe && !unsafeLedgerTarget
    ? await readStoryGenerationAttemptAudit({ generatedRoot, maxArchives: archiveLimit })
    : {
      available: false,
      attempts: [],
      valid_event_count: 0,
      invalid_line_count: unsafeLedgerTarget ? 1 : 0,
      rotated_file_count: 0,
    }
  const permissionTargetUnsafe = blockers.includes('ledger_permissions_unsafe')
    || blockers.includes('archive_permissions_unsafe')
  if (audit.invalid_line_count > 0 && !unsafeLedgerTarget && !permissionTargetUnsafe) {
    blockers.push('ledger_history_invalid')
  }
  const historyIntegrity: StoryGenerationAttemptAuditReadiness['history_integrity'] = unsafeLedgerTarget
    || blockers.includes('archive_retention_exceeded')
    || audit.invalid_line_count > 0
    ? 'invalid'
    : ledgerPresent || archiveCount > 0
      ? 'valid'
      : 'unavailable'
  if (historyIntegrity === 'unavailable') warnings.push('history_starts_with_first_valid_canonical_request')
  const readyForNextAttempt = blockers.length === 0

  return {
    schema_version: 'story-generation-attempt-audit-readiness/v1',
    status: readyForNextAttempt
      ? storageInitialized || ledgerPresent || archiveCount > 0
        ? 'ready'
        : 'uninitialized'
      : 'blocked',
    storage_initialized: storageInitialized,
    ledger_present: ledgerPresent,
    archive_count: archiveCount,
    current_file_bytes: currentFileBytes,
    configured_max_bytes: maxBytes(options),
    configured_max_archives: archiveLimit,
    configured_lock_timeout_ms: lockTimeoutMs(options),
    configured_lock_retry_ms: lockRetryMs(options),
    configured_lock_stale_ms: lockStaleMs(options),
    configuration_valid: configurationWarnings.length === 0,
    configuration_warnings: configurationWarnings,
    permission_policy: 'owner_only',
    permission_policy_satisfied: permissionPolicySatisfied,
    event_file_sync_required: true,
    no_follow_open_required: true,
    directory_entry_sync_guaranteed: true,
    lock_status: lockStatus,
    history_integrity: historyIntegrity,
    valid_event_count: audit.valid_event_count,
    invalid_event_count: audit.invalid_line_count,
    ready_for_next_attempt: readyForNextAttempt,
    blockers,
    warnings,
    operator_actions: operatorActions(blockers, lockStatus),
    automatic_repair_allowed: false,
    destructive_action_performed: false,
    request_content_recorded: false,
    model_output_recorded: false,
    raw_exception_recorded: false,
    absolute_path_exposed: false,
  }
}
