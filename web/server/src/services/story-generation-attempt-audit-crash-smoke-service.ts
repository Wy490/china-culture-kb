import { spawn } from 'node:child_process'
import { constants } from 'node:fs'
import {
  access,
  lstat,
  mkdir,
  realpath,
  utimes,
} from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'
import { success } from '@shared/types.js'
import { storyGeneratedRoot } from '../platform/story-storage-root.js'
import {
  inspectStoryGenerationAttemptAuditReadiness,
  readStoryGenerationAttemptAudit,
  runWithStoryGenerationAttemptAudit,
  storyGenerationAttemptAuditPath,
} from './story-generation-attempt-audit-service.js'

const WORK_DIR_NAME_PATTERN = /^story-agent-audit-crash-smoke-[a-z0-9][a-z0-9-]{0,63}$/

export type StoryGenerationAttemptAuditCrashSmokeErrorCode =
  | 'target_path_not_absolute'
  | 'target_name_invalid'
  | 'target_already_exists'
  | 'target_parent_not_canonical'
  | 'target_parent_not_writable'
  | 'target_within_active_generated_root'
  | 'target_creation_failed'
  | 'crash_process_failed'
  | 'smoke_case_failed'

export class StoryGenerationAttemptAuditCrashSmokeError extends Error {
  constructor(readonly code: StoryGenerationAttemptAuditCrashSmokeErrorCode) {
    super('Story generation attempt audit crash smoke failed')
    this.name = 'StoryGenerationAttemptAuditCrashSmokeError'
  }
}

export interface StoryGenerationAttemptAuditCrashSmokeCase {
  phase: 'file_sync_before_directory_sync' | 'rotation_rename_before_next_append'
  process_terminated_by_sigkill: true
  fresh_lock_failed_closed: true
  retained_history_valid: true
  invalid_line_count: 0
  recovered_after_explicit_expiry: true
}

export interface StoryGenerationAttemptAuditCrashSmokeReport {
  schema_version: 'story-generation-attempt-audit-crash-smoke/v1'
  status: 'passed'
  process_signal: 'SIGKILL'
  case_count: 2
  passed_case_count: 2
  platform: NodeJS.Platform
  architecture: string
  node_version: string
  filesystem_type_reported: false
  power_loss_simulated: false
  remote_filesystem_validated: false
  real_generated_root_touched: false
  existing_target_accepted: false
  automatic_repair_invoked: false
  destructive_action_invoked: false
  report_payload_absolute_path_exposed: false
  shell_invocation_arguments_in_scope: false
  recommended_npm_silent_invocation: true
  ledger_content_exposed: false
  lock_owner_exposed: false
  cases: [
    StoryGenerationAttemptAuditCrashSmokeCase,
    StoryGenerationAttemptAuditCrashSmokeCase,
  ]
}

export interface StoryGenerationAttemptAuditCrashSmokeOptions {
  workDir: string
  activeGeneratedRoot?: string
}

function isWithin(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target)
  return pathFromRoot === '' || (!pathFromRoot.startsWith('..') && !isAbsolute(pathFromRoot))
}

async function canonicalExistingPath(filePath: string): Promise<string> {
  try {
    return await realpath(filePath)
  } catch {
    return resolve(filePath)
  }
}

async function createValidatedWorkDir(options: StoryGenerationAttemptAuditCrashSmokeOptions): Promise<string> {
  if (!isAbsolute(options.workDir)) {
    throw new StoryGenerationAttemptAuditCrashSmokeError('target_path_not_absolute')
  }
  const workDir = resolve(options.workDir)
  if (!WORK_DIR_NAME_PATTERN.test(basename(workDir))) {
    throw new StoryGenerationAttemptAuditCrashSmokeError('target_name_invalid')
  }
  try {
    await lstat(workDir)
    throw new StoryGenerationAttemptAuditCrashSmokeError('target_already_exists')
  } catch (error) {
    if (error instanceof StoryGenerationAttemptAuditCrashSmokeError) throw error
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new StoryGenerationAttemptAuditCrashSmokeError('target_creation_failed')
    }
  }

  const parent = dirname(workDir)
  let canonicalParent: string
  try {
    const parentTarget = await lstat(parent)
    if (!parentTarget.isDirectory() || parentTarget.isSymbolicLink()) {
      throw new StoryGenerationAttemptAuditCrashSmokeError('target_parent_not_canonical')
    }
    canonicalParent = await realpath(parent)
    await access(parent, constants.W_OK)
  } catch (error) {
    if (error instanceof StoryGenerationAttemptAuditCrashSmokeError) throw error
    throw new StoryGenerationAttemptAuditCrashSmokeError('target_parent_not_writable')
  }

  const activeGeneratedRoot = await canonicalExistingPath(
    options.activeGeneratedRoot ?? storyGeneratedRoot(),
  )
  const canonicalWorkDir = resolve(canonicalParent, basename(workDir))
  if (isWithin(activeGeneratedRoot, canonicalWorkDir)) {
    throw new StoryGenerationAttemptAuditCrashSmokeError('target_within_active_generated_root')
  }

  try {
    await mkdir(workDir, { recursive: false, mode: 0o700 })
    const target = await lstat(workDir)
    if (!target.isDirectory() || target.isSymbolicLink() || (target.mode & 0o077) !== 0) {
      throw new Error('unsafe target mode')
    }
  } catch {
    throw new StoryGenerationAttemptAuditCrashSmokeError('target_creation_failed')
  }
  return workDir
}

type CrashPoint = 'before_directory_sync' | 'after_rotation'

async function terminateChildAtCrashPoint(caseRoot: string, crashPoint: CrashPoint): Promise<void> {
  const loaderPath = new URL('../../../node_modules/tsx/dist/loader.mjs', import.meta.url)
  const serviceUrl = new URL('./story-generation-attempt-audit-service.ts', import.meta.url)
  const tsconfigPath = resolve(import.meta.dirname, '..', '..', 'tsconfig.json')
  const hook = `async descriptor => {
    process.stdout.write('crash-point\\n')
    await new Promise(() => undefined)
    await descriptor?.sync()
  }`
  const crashOption = crashPoint === 'before_directory_sync'
    ? `auditDirectorySync: ${hook}`
    : `afterLedgerRotation: ${hook}`
  const script = `
    import(${JSON.stringify(serviceUrl.href)}).then(async service => {
      await service.beginStoryGenerationAttempt(
        { sourceDomain: 'china_culture', videoType: 'character_story' },
        {
          generatedRoot: ${JSON.stringify(caseRoot)},
          maxBytes: ${crashPoint === 'after_rotation' ? 256 : 8192},
          maxArchives: 4,
          lockTimeoutMs: 10000,
          lockStaleMs: 60000,
          ${crashOption},
        },
      )
    }).catch(() => { process.exitCode = 1 })
  `
  const child = spawn(process.execPath, ['--import', loaderPath.pathname, '-e', script], {
    cwd: resolve(import.meta.dirname, '..', '..', '..', '..'),
    env: { ...process.env, TSX_TSCONFIG_PATH: tsconfigPath },
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  try {
    await new Promise<void>((resolvePromise, reject) => {
      const timeout = setTimeout(
        () => reject(new StoryGenerationAttemptAuditCrashSmokeError('crash_process_failed')),
        10_000,
      )
      child.stdout.on('data', chunk => {
        if (!String(chunk).includes('crash-point')) return
        clearTimeout(timeout)
        resolvePromise()
      })
      child.once('error', () => {
        clearTimeout(timeout)
        reject(new StoryGenerationAttemptAuditCrashSmokeError('crash_process_failed'))
      })
      child.once('close', () => {
        clearTimeout(timeout)
        reject(new StoryGenerationAttemptAuditCrashSmokeError('crash_process_failed'))
      })
    })
    const closed = new Promise<void>((resolvePromise, reject) => {
      child.once('error', () => reject(new StoryGenerationAttemptAuditCrashSmokeError('crash_process_failed')))
      child.once('close', (_code, signal) => {
        if (signal === 'SIGKILL') resolvePromise()
        else reject(new StoryGenerationAttemptAuditCrashSmokeError('crash_process_failed'))
      })
    })
    child.kill('SIGKILL')
    await closed
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }
}

function caseReport(
  phase: StoryGenerationAttemptAuditCrashSmokeCase['phase'],
): StoryGenerationAttemptAuditCrashSmokeCase {
  return {
    phase,
    process_terminated_by_sigkill: true,
    fresh_lock_failed_closed: true,
    retained_history_valid: true,
    invalid_line_count: 0,
    recovered_after_explicit_expiry: true,
  }
}

async function expireLockAndRecover(caseRoot: string, maxBytes: number): Promise<void> {
  const lockPath = `${storyGenerationAttemptAuditPath(caseRoot)}.lock`
  const expired = new Date(Date.now() - 120_000)
  await utimes(lockPath, expired, expired)
  const result = await runWithStoryGenerationAttemptAudit({
    sourceDomain: 'china_culture',
    videoType: 'character_story',
  }, async () => success({ recovered: true }), {
    generatedRoot: caseRoot,
    maxBytes,
    maxArchives: 4,
    lockStaleMs: 10,
    lockRetryMs: 1,
    lockTimeoutMs: 500,
  })
  if (!result.ok) throw new StoryGenerationAttemptAuditCrashSmokeError('smoke_case_failed')
}

async function fileSyncBoundaryCase(workDir: string): Promise<StoryGenerationAttemptAuditCrashSmokeCase> {
  const caseRoot = resolve(workDir, 'file-sync-before-directory-sync')
  await mkdir(caseRoot, { mode: 0o700 })
  await terminateChildAtCrashPoint(caseRoot, 'before_directory_sync')
  const [audit, readiness] = await Promise.all([
    readStoryGenerationAttemptAudit({ generatedRoot: caseRoot, maxArchives: 4 }),
    inspectStoryGenerationAttemptAuditReadiness({
      generatedRoot: caseRoot,
      maxArchives: 4,
      lockStaleMs: 60_000,
    }),
  ])
  if (!audit.available
    || audit.valid_event_count !== 1
    || audit.invalid_line_count !== 0
    || audit.attempts.length !== 1
    || audit.attempts[0]?.status !== 'started'
    || readiness.status !== 'blocked'
    || readiness.lock_status !== 'active'
    || readiness.history_integrity !== 'valid'
    || readiness.ready_for_next_attempt) {
    throw new StoryGenerationAttemptAuditCrashSmokeError('smoke_case_failed')
  }
  await expireLockAndRecover(caseRoot, 8192)
  const recovered = await readStoryGenerationAttemptAudit({ generatedRoot: caseRoot, maxArchives: 4 })
  if (recovered.invalid_line_count !== 0
    || recovered.attempts.length !== 2
    || recovered.attempts[0]?.status !== 'started'
    || recovered.attempts[1]?.status !== 'succeeded') {
    throw new StoryGenerationAttemptAuditCrashSmokeError('smoke_case_failed')
  }
  return caseReport('file_sync_before_directory_sync')
}

async function rotationBoundaryCase(workDir: string): Promise<StoryGenerationAttemptAuditCrashSmokeCase> {
  const caseRoot = resolve(workDir, 'rotation-rename-before-next-append')
  await mkdir(caseRoot, { mode: 0o700 })
  await runWithStoryGenerationAttemptAudit({
    sourceDomain: 'china_culture',
    videoType: 'character_story',
  }, async () => success({ seeded: true }), {
    generatedRoot: caseRoot,
    maxBytes: 8192,
    maxArchives: 4,
  })
  await terminateChildAtCrashPoint(caseRoot, 'after_rotation')
  const [audit, readiness] = await Promise.all([
    readStoryGenerationAttemptAudit({ generatedRoot: caseRoot, maxArchives: 4 }),
    inspectStoryGenerationAttemptAuditReadiness({
      generatedRoot: caseRoot,
      maxArchives: 4,
      lockStaleMs: 60_000,
    }),
  ])
  if (!audit.available
    || audit.valid_event_count !== 2
    || audit.invalid_line_count !== 0
    || audit.rotated_file_count !== 1
    || audit.attempts.length !== 1
    || audit.attempts[0]?.status !== 'succeeded'
    || readiness.status !== 'blocked'
    || readiness.ledger_present
    || readiness.archive_count !== 1
    || readiness.lock_status !== 'active'
    || readiness.history_integrity !== 'valid'
    || readiness.ready_for_next_attempt) {
    throw new StoryGenerationAttemptAuditCrashSmokeError('smoke_case_failed')
  }
  await expireLockAndRecover(caseRoot, 256)
  const recovered = await readStoryGenerationAttemptAudit({ generatedRoot: caseRoot, maxArchives: 4 })
  if (recovered.invalid_line_count !== 0
    || recovered.attempts.length !== 2
    || !recovered.attempts.every(attempt => attempt.status === 'succeeded')) {
    throw new StoryGenerationAttemptAuditCrashSmokeError('smoke_case_failed')
  }
  return caseReport('rotation_rename_before_next_append')
}

export async function runStoryGenerationAttemptAuditCrashSmoke(
  options: StoryGenerationAttemptAuditCrashSmokeOptions,
): Promise<StoryGenerationAttemptAuditCrashSmokeReport> {
  const workDir = await createValidatedWorkDir(options)
  const fileSyncCase = await fileSyncBoundaryCase(workDir)
  const rotationCase = await rotationBoundaryCase(workDir)
  return {
    schema_version: 'story-generation-attempt-audit-crash-smoke/v1',
    status: 'passed',
    process_signal: 'SIGKILL',
    case_count: 2,
    passed_case_count: 2,
    platform: process.platform,
    architecture: process.arch,
    node_version: process.version,
    filesystem_type_reported: false,
    power_loss_simulated: false,
    remote_filesystem_validated: false,
    real_generated_root_touched: false,
    existing_target_accepted: false,
    automatic_repair_invoked: false,
    destructive_action_invoked: false,
    report_payload_absolute_path_exposed: false,
    shell_invocation_arguments_in_scope: false,
    recommended_npm_silent_invocation: true,
    ledger_content_exposed: false,
    lock_owner_exposed: false,
    cases: [fileSyncCase, rotationCase],
  }
}
