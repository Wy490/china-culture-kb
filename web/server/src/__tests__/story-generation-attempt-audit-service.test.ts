import { afterEach, describe, expect, it, vi } from 'vitest'
import { spawn } from 'node:child_process'
import {
  appendFile,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { ErrorCodes, fail, success } from '@shared/types.js'
import {
  StoryGenerationAttemptAuditUnavailableError,
  beginStoryGenerationAttempt,
  inspectStoryGenerationAttemptAuditReadiness,
  readStoryGenerationAttemptAudit,
  runWithStoryGenerationAttemptAudit,
  storyGenerationAttemptAuditPath,
} from '../services/story-generation-attempt-audit-service.js'

const roots: string[] = []
const crashChildren = new Set<ReturnType<typeof spawn>>()

async function workspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'story-generation-attempt-audit-'))
  roots.push(root)
  return root
}

async function lines(root: string): Promise<Array<Record<string, unknown>>> {
  const content = await readFile(storyGenerationAttemptAuditPath(root), 'utf8')
  return content.trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>)
}

async function blockLedgerWrites(root: string): Promise<void> {
  const ledgerPath = storyGenerationAttemptAuditPath(root)
  await rename(ledgerPath, `${ledgerPath}.preserved`)
  await mkdir(ledgerPath)
}

async function runAuditWriterProcess(root: string, attemptCount: number): Promise<void> {
  const loaderPath = new URL('../../../node_modules/tsx/dist/loader.mjs', import.meta.url)
  const serviceUrl = new URL('../services/story-generation-attempt-audit-service.ts', import.meta.url)
  const tsconfigPath = resolve(import.meta.dirname, '..', '..', 'tsconfig.json')
  const script = `
    import(${JSON.stringify(serviceUrl.href)}).then(async service => {
      for (let index = 0; index < ${attemptCount}; index += 1) {
        await service.runWithStoryGenerationAttemptAudit(
          { sourceDomain: 'china_culture', videoType: 'character_story' },
          async () => ({ ok: true, data: { index }, error: null }),
          {
            generatedRoot: ${JSON.stringify(root)},
            maxBytes: 4096,
            maxArchives: 32,
            lockTimeoutMs: 10000,
          },
        )
      }
    }).catch(error => {
      console.error(error?.name ?? 'audit-writer-failed')
      process.exitCode = 1
    })
  `
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(process.execPath, ['--import', loaderPath.pathname, '-e', script], {
      cwd: resolve(import.meta.dirname, '..', '..', '..', '..'),
      env: { ...process.env, TSX_TSCONFIG_PATH: tsconfigPath },
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) resolvePromise()
      else reject(new Error(`audit writer exited ${code}: ${stderr}`))
    })
  })
}

async function spawnAuditProcessAtCrashPoint(
  root: string,
  crashPoint: 'before_directory_sync' | 'after_rotation',
): Promise<ReturnType<typeof spawn>> {
  const loaderPath = new URL('../../../node_modules/tsx/dist/loader.mjs', import.meta.url)
  const serviceUrl = new URL('../services/story-generation-attempt-audit-service.ts', import.meta.url)
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
          generatedRoot: ${JSON.stringify(root)},
          maxBytes: ${crashPoint === 'after_rotation' ? 256 : 8192},
          maxArchives: 4,
          lockTimeoutMs: 10000,
          lockStaleMs: 60000,
          ${crashOption},
        },
      )
    }).catch(error => {
      console.error(error?.name ?? 'audit-crash-writer-failed')
      process.exitCode = 1
    })
  `
  const child = spawn(process.execPath, ['--import', loaderPath.pathname, '-e', script], {
    cwd: resolve(import.meta.dirname, '..', '..', '..', '..'),
    env: { ...process.env, TSX_TSCONFIG_PATH: tsconfigPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  crashChildren.add(child)
  child.once('close', () => crashChildren.delete(child))
  await new Promise<void>((resolvePromise, reject) => {
    let stderr = ''
    const timeout = setTimeout(() => reject(new Error(`crash point timed out: ${stderr}`)), 10_000)
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.stdout.on('data', chunk => {
      if (!String(chunk).includes('crash-point')) return
      clearTimeout(timeout)
      resolvePromise()
    })
    child.once('error', error => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('close', code => {
      clearTimeout(timeout)
      reject(new Error(`audit crash writer exited ${code} before marker: ${stderr}`))
    })
  })
  return child
}

async function killAuditProcess(child: ReturnType<typeof spawn>): Promise<void> {
  const closed = new Promise<void>((resolvePromise, reject) => {
    child.once('error', reject)
    child.once('close', (_code, signal) => {
      if (signal === 'SIGKILL') resolvePromise()
      else reject(new Error(`audit crash writer closed without SIGKILL: ${signal ?? 'none'}`))
    })
  })
  child.kill('SIGKILL')
  await closed
}

afterEach(async () => {
  vi.restoreAllMocks()
  for (const child of crashChildren) child.kill('SIGKILL')
  crashChildren.clear()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('story generation attempt audit', () => {
  it('records only privacy-safe started and succeeded events in timestamp order', async () => {
    const generatedRoot = await workspace()
    const timestamps = [
      new Date('2026-07-18T07:00:00.000Z'),
      new Date('2026-07-18T07:00:01.000Z'),
    ]

    const result = await runWithStoryGenerationAttemptAudit({
      sourceDomain: 'original_fiction',
      videoType: 'ai_comic_drama',
    }, async () => success({
      prompt: 'PRIVATE USER PROMPT',
      output: 'PRIVATE MODEL OUTPUT',
    }), {
      generatedRoot,
      attemptId: () => '11111111-1111-4111-8111-111111111111',
      now: () => timestamps.shift() ?? new Date('2026-07-18T07:00:02.000Z'),
    })

    expect(result.ok).toBe(true)
    const events = await lines(generatedRoot)
    expect(events).toEqual([
      {
        schema_version: 'story-generation-attempt-event/v1',
        attempt_id: '11111111-1111-4111-8111-111111111111',
        occurred_at: '2026-07-18T07:00:00.000Z',
        entrypoint: 'web_api_stories_generate',
        source_domain: 'original_fiction',
        video_type: 'ai_comic_drama',
        status: 'started',
      },
      {
        schema_version: 'story-generation-attempt-event/v1',
        attempt_id: '11111111-1111-4111-8111-111111111111',
        occurred_at: '2026-07-18T07:00:01.000Z',
        entrypoint: 'web_api_stories_generate',
        source_domain: 'original_fiction',
        video_type: 'ai_comic_drama',
        status: 'succeeded',
      },
    ])
    const raw = await readFile(storyGenerationAttemptAuditPath(generatedRoot), 'utf8')
    expect(raw).not.toContain('PRIVATE USER PROMPT')
    expect(raw).not.toContain('PRIVATE MODEL OUTPUT')
    expect(raw).not.toContain(generatedRoot)
  })

  it('records a stable result error code without recording response content', async () => {
    const generatedRoot = await workspace()

    const result = await runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, async () => fail(ErrorCodes.ENTRY_NOT_FOUND, 'PRIVATE ENTRY NAME'), { generatedRoot })

    expect(result).toEqual(fail(ErrorCodes.ENTRY_NOT_FOUND, 'PRIVATE ENTRY NAME'))
    const events = await lines(generatedRoot)
    expect(events.map(event => event.status)).toEqual(['started', 'failed'])
    expect(events[1]?.error_code).toBe(ErrorCodes.ENTRY_NOT_FOUND)
    expect(JSON.stringify(events)).not.toContain('PRIVATE ENTRY NAME')
  })

  it('maps thrown errors to a stable enum and rethrows the original error', async () => {
    const generatedRoot = await workspace()
    const original = new Error(`PRIVATE FAILURE at ${generatedRoot}`)

    await expect(runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'culture_promo',
    }, async () => { throw original }, { generatedRoot })).rejects.toBe(original)

    const events = await lines(generatedRoot)
    expect(events[1]).toMatchObject({
      status: 'failed',
      error_code: 'UNHANDLED_GENERATION_ERROR',
    })
    expect(JSON.stringify(events)).not.toContain('PRIVATE FAILURE')
    expect(JSON.stringify(events)).not.toContain(generatedRoot)
  })

  it('serializes concurrent appends and gives every request a unique attempt id', async () => {
    const generatedRoot = await workspace()

    await Promise.all(Array.from({ length: 24 }, () => runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'scene_short',
    }, async () => success({ ok: true }), { generatedRoot })))

    const events = await lines(generatedRoot)
    expect(events).toHaveLength(48)
    const started = events.filter(event => event.status === 'started')
    expect(new Set(started.map(event => event.attempt_id)).size).toBe(24)
    for (const attempt of started) {
      const matching = events.filter(event => event.attempt_id === attempt.attempt_id)
      expect(matching.map(event => event.status)).toEqual(['started', 'succeeded'])
      expect(Date.parse(String(matching[1]?.occurred_at)))
        .toBeGreaterThanOrEqual(Date.parse(String(matching[0]?.occurred_at)))
    }
  })

  it('keeps an interrupted started attempt durably visible', async () => {
    const generatedRoot = await workspace()

    const attempt = await beginStoryGenerationAttempt({
      sourceDomain: 'china_culture',
      videoType: 'documentary_short',
    }, {
      generatedRoot,
      attemptId: () => '22222222-2222-4222-8222-222222222222',
      now: () => new Date('2026-07-18T07:10:00.000Z'),
    })

    expect(attempt.attempt_id).toBe('22222222-2222-4222-8222-222222222222')
    const audit = await readStoryGenerationAttemptAudit({ generatedRoot })
    expect(audit.available).toBe(true)
    expect(audit.attempts).toEqual([expect.objectContaining({
      attempt_id: attempt.attempt_id,
      status: 'started',
      started_at: '2026-07-18T07:10:00.000Z',
    })])
  })

  it('rotates to a bounded number of project-scoped JSONL files', async () => {
    const generatedRoot = await workspace()

    for (let index = 0; index < 20; index += 1) {
      await runWithStoryGenerationAttemptAudit({
        sourceDomain: 'china_culture',
        videoType: 'character_story',
      }, async () => success({ index }), {
        generatedRoot,
        maxBytes: 520,
        maxArchives: 2,
      })
    }

    const files = (await readdir(resolve(generatedRoot, 'system')))
      .filter(file => file.startsWith('story-generation-attempts.jsonl'))
      .sort()
    expect(files).toEqual([
      'story-generation-attempts.jsonl',
      'story-generation-attempts.jsonl.1',
      'story-generation-attempts.jsonl.2',
    ])
    for (const file of files) {
      const raw = await readFile(resolve(generatedRoot, 'system', file), 'utf8')
      for (const line of raw.trim().split('\n').filter(Boolean)) expect(() => JSON.parse(line)).not.toThrow()
    }
  })

  it('fails closed before generation when the started event cannot be written', async () => {
    const generatedRoot = await workspace()
    await mkdir(generatedRoot, { recursive: true })
    await mkdir(resolve(generatedRoot, 'system'), { recursive: true })
    await mkdir(storyGenerationAttemptAuditPath(generatedRoot))
    const generate = vi.fn(async () => success({ should_not_run: true }))

    await expect(runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, generate, { generatedRoot })).rejects.toBeInstanceOf(StoryGenerationAttemptAuditUnavailableError)
    expect(generate).not.toHaveBeenCalled()
  })

  it('fails closed before generation when the started event file sync fails', async () => {
    const generatedRoot = await workspace()
    const generate = vi.fn(async () => success({ should_not_run: true }))
    let syncCount = 0

    await expect(runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, generate, {
      generatedRoot,
      eventFileSync: async (_descriptor: FileHandle) => {
        syncCount += 1
        throw new Error('PRIVATE STARTED SYNC FAILURE')
      },
    })).rejects.toBeInstanceOf(StoryGenerationAttemptAuditUnavailableError)

    expect(syncCount).toBe(1)
    expect(generate).not.toHaveBeenCalled()
  })

  it('does not report generation success when the terminal event file sync fails', async () => {
    const generatedRoot = await workspace()
    const generate = vi.fn(async () => success({ generated: true }))
    let syncCount = 0

    await expect(runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, generate, {
      generatedRoot,
      eventFileSync: async (descriptor: FileHandle) => {
        syncCount += 1
        if (syncCount === 2) throw new Error('PRIVATE TERMINAL SYNC FAILURE')
        await descriptor.sync()
      },
    })).rejects.toBeInstanceOf(StoryGenerationAttemptAuditUnavailableError)

    expect(syncCount).toBe(2)
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('fails closed before generation when the started event directory sync fails', async () => {
    const generatedRoot = await workspace()
    const generate = vi.fn(async () => success({ should_not_run: true }))
    let directorySyncCount = 0

    await expect(runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, generate, {
      generatedRoot,
      auditDirectorySync: async (_descriptor: FileHandle) => {
        directorySyncCount += 1
        throw new Error('PRIVATE STARTED DIRECTORY SYNC FAILURE')
      },
    })).rejects.toBeInstanceOf(StoryGenerationAttemptAuditUnavailableError)

    expect(directorySyncCount).toBe(1)
    expect(generate).not.toHaveBeenCalled()
  })

  it('does not report generation success when the terminal event directory sync fails', async () => {
    const generatedRoot = await workspace()
    const generate = vi.fn(async () => success({ generated: true }))
    let directorySyncCount = 0

    await expect(runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, generate, {
      generatedRoot,
      auditDirectorySync: async (descriptor: FileHandle) => {
        directorySyncCount += 1
        if (directorySyncCount === 2) throw new Error('PRIVATE TERMINAL DIRECTORY SYNC FAILURE')
        await descriptor.sync()
      },
    })).rejects.toBeInstanceOf(StoryGenerationAttemptAuditUnavailableError)

    expect(directorySyncCount).toBe(2)
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('does not report success when the succeeded event cannot be written', async () => {
    const generatedRoot = await workspace()

    await expect(runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, async () => {
      await blockLedgerWrites(generatedRoot)
      return success({ persisted: true })
    }, { generatedRoot })).rejects.toBeInstanceOf(StoryGenerationAttemptAuditUnavailableError)
  })

  it('does not swallow the original generation failure when the failed event cannot be written', async () => {
    const generatedRoot = await workspace()
    const original = new Error('ORIGINAL GENERATION FAILURE')

    await expect(runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, async () => {
      await blockLedgerWrites(generatedRoot)
      throw original
    }, { generatedRoot })).rejects.toBe(original)
  })

  it('preserves every attempt while independent processes append and rotate the same ledger', async () => {
    const generatedRoot = await workspace()
    const processCount = 4
    const attemptsPerProcess = 40

    await Promise.all(Array.from(
      { length: processCount },
      () => runAuditWriterProcess(generatedRoot, attemptsPerProcess),
    ))

    const audit = await readStoryGenerationAttemptAudit({ generatedRoot, maxArchives: 32 })
    expect(audit.available).toBe(true)
    expect(audit.invalid_line_count).toBe(0)
    expect(audit.valid_event_count).toBe(processCount * attemptsPerProcess * 2)
    expect(audit.attempts).toHaveLength(processCount * attemptsPerProcess)
    expect(audit.attempts.every(attempt => attempt.status === 'succeeded')).toBe(true)
  }, 30_000)

  it('fails closed on a fresh lock after SIGKILL between file and directory sync, then recovers only after expiry', async () => {
    const generatedRoot = await workspace()
    const child = await spawnAuditProcessAtCrashPoint(generatedRoot, 'before_directory_sync')

    await killAuditProcess(child)

    const interrupted = await readStoryGenerationAttemptAudit({ generatedRoot })
    expect(interrupted).toMatchObject({
      available: true,
      valid_event_count: 1,
      invalid_line_count: 0,
    })
    expect(interrupted.attempts).toEqual([
      expect.objectContaining({ status: 'started' }),
    ])
    const active = await inspectStoryGenerationAttemptAuditReadiness({
      generatedRoot,
      lockStaleMs: 60_000,
    })
    expect(active).toMatchObject({
      status: 'blocked',
      lock_status: 'active',
      history_integrity: 'valid',
      blockers: ['ledger_lock_active'],
      operator_actions: ['wait_for_active_writer_and_reinspect'],
      ready_for_next_attempt: false,
    })

    const lockPath = `${storyGenerationAttemptAuditPath(generatedRoot)}.lock`
    const expired = new Date(Date.now() - 120_000)
    await utimes(lockPath, expired, expired)
    const recovery = await runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, async () => success({ recovered: true }), {
      generatedRoot,
      lockStaleMs: 10,
      lockRetryMs: 1,
      lockTimeoutMs: 500,
    })

    expect(recovery.ok).toBe(true)
    const recovered = await readStoryGenerationAttemptAudit({ generatedRoot })
    expect(recovered.invalid_line_count).toBe(0)
    expect(recovered.attempts.map(attempt => attempt.status)).toEqual(['started', 'succeeded'])
  }, 20_000)

  it('keeps rotated history complete when SIGKILL lands after rename and before the next append', async () => {
    const generatedRoot = await workspace()
    await runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, async () => success({ seeded: true }), {
      generatedRoot,
      maxBytes: 8192,
      maxArchives: 4,
    })
    const child = await spawnAuditProcessAtCrashPoint(generatedRoot, 'after_rotation')

    await killAuditProcess(child)

    const interrupted = await readStoryGenerationAttemptAudit({ generatedRoot, maxArchives: 4 })
    expect(interrupted).toMatchObject({
      available: true,
      valid_event_count: 2,
      invalid_line_count: 0,
      rotated_file_count: 1,
    })
    expect(interrupted.attempts).toEqual([
      expect.objectContaining({ status: 'succeeded' }),
    ])
    const active = await inspectStoryGenerationAttemptAuditReadiness({
      generatedRoot,
      maxArchives: 4,
      lockStaleMs: 60_000,
    })
    expect(active).toMatchObject({
      status: 'blocked',
      ledger_present: false,
      archive_count: 1,
      lock_status: 'active',
      history_integrity: 'valid',
      blockers: ['ledger_lock_active'],
      ready_for_next_attempt: false,
    })

    const lockPath = `${storyGenerationAttemptAuditPath(generatedRoot)}.lock`
    const expired = new Date(Date.now() - 120_000)
    await utimes(lockPath, expired, expired)
    const recovery = await runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, async () => success({ recovered: true }), {
      generatedRoot,
      maxBytes: 256,
      maxArchives: 4,
      lockStaleMs: 10,
      lockRetryMs: 1,
      lockTimeoutMs: 500,
    })

    expect(recovery.ok).toBe(true)
    const recovered = await readStoryGenerationAttemptAudit({ generatedRoot, maxArchives: 4 })
    expect(recovered.invalid_line_count).toBe(0)
    expect(recovered.attempts).toHaveLength(2)
    expect(recovered.attempts.every(attempt => attempt.status === 'succeeded')).toBe(true)
  }, 20_000)

  it('fails closed before generation when another process owns a fresh ledger lock', async () => {
    const generatedRoot = await workspace()
    const ledgerPath = storyGenerationAttemptAuditPath(generatedRoot)
    await mkdir(resolve(ledgerPath, '..'), { recursive: true, mode: 0o700 })
    await chmod(resolve(ledgerPath, '..'), 0o700)
    await writeFile(`${ledgerPath}.lock`, JSON.stringify({
      schema_version: 'story-generation-attempt-lock/v1',
      owner_id: '77777777-7777-4777-8777-777777777777',
      created_at: new Date().toISOString(),
    }), { mode: 0o600 })
    const generate = vi.fn(async () => success({ should_not_run: true }))

    const readiness = await inspectStoryGenerationAttemptAuditReadiness({
      generatedRoot,
      lockStaleMs: 60_000,
    })
    expect(readiness).toMatchObject({
      status: 'blocked',
      lock_status: 'active',
      blockers: ['ledger_lock_active'],
      operator_actions: ['wait_for_active_writer_and_reinspect'],
      automatic_repair_allowed: false,
      destructive_action_performed: false,
    })

    await expect(runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, generate, {
      generatedRoot,
      lockTimeoutMs: 40,
      lockRetryMs: 5,
      lockStaleMs: 60_000,
    })).rejects.toBeInstanceOf(StoryGenerationAttemptAuditUnavailableError)
    expect(generate).not.toHaveBeenCalled()
  })

  it('recovers an expired regular lock before appending and removes only its own lock', async () => {
    const generatedRoot = await workspace()
    const ledgerPath = storyGenerationAttemptAuditPath(generatedRoot)
    const lockPath = `${ledgerPath}.lock`
    await mkdir(resolve(ledgerPath, '..'), { recursive: true, mode: 0o700 })
    await chmod(resolve(ledgerPath, '..'), 0o700)
    await writeFile(lockPath, JSON.stringify({
      schema_version: 'story-generation-attempt-lock/v1',
      owner_id: '88888888-8888-4888-8888-888888888888',
      created_at: '2026-07-18T00:00:00.000Z',
    }), { mode: 0o600 })
    const expired = new Date(Date.now() - 120_000)
    await utimes(lockPath, expired, expired)

    const readiness = await inspectStoryGenerationAttemptAuditReadiness({
      generatedRoot,
      lockStaleMs: 50,
    })
    expect(readiness).toMatchObject({
      status: 'ready',
      lock_status: 'expired_recoverable',
      blockers: [],
      operator_actions: ['reinspect_expired_lock_on_next_canonical_request'],
      automatic_repair_allowed: false,
      destructive_action_performed: false,
    })

    const result = await runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, async () => success({ recovered: true }), {
      generatedRoot,
      lockTimeoutMs: 500,
      lockRetryMs: 5,
      lockStaleMs: 50,
    })

    expect(result.ok).toBe(true)
    await expect(readFile(lockPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await lines(generatedRoot)).map(event => event.status)).toEqual(['started', 'succeeded'])
  })

  it('reports an absent ledger as ready for the first request without creating files', async () => {
    const generatedRoot = await workspace()

    const readiness = await inspectStoryGenerationAttemptAuditReadiness({
      generatedRoot,
      maxBytes: 8192,
      maxArchives: 3,
      lockTimeoutMs: 1200,
      lockRetryMs: 15,
      lockStaleMs: 45_000,
    })

    expect(readiness).toMatchObject({
      schema_version: 'story-generation-attempt-audit-readiness/v1',
      status: 'uninitialized',
      storage_initialized: false,
      ledger_present: false,
      archive_count: 0,
      current_file_bytes: 0,
      configured_max_bytes: 8192,
      configured_max_archives: 3,
      configured_lock_timeout_ms: 1200,
      configured_lock_retry_ms: 15,
      configured_lock_stale_ms: 45_000,
      lock_status: 'absent',
      history_integrity: 'unavailable',
      ready_for_next_attempt: true,
      blockers: [],
      operator_actions: ['no_action_required'],
      automatic_repair_allowed: false,
      destructive_action_performed: false,
      request_content_recorded: false,
      model_output_recorded: false,
      raw_exception_recorded: false,
      absolute_path_exposed: false,
    })
    expect(await readdir(generatedRoot)).toEqual([])
  })

  it('reports validated lock policy environment overrides without initializing storage', async () => {
    const generatedRoot = await workspace()
    const names = {
      timeout: 'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_TIMEOUT_MS',
      retry: 'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_RETRY_MS',
      stale: 'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_STALE_MS',
    } as const
    const previous = Object.fromEntries(Object.values(names).map(name => [name, process.env[name]]))
    try {
      process.env[names.timeout] = '4200'
      process.env[names.retry] = '17'
      process.env[names.stale] = '61000'

      const readiness = await inspectStoryGenerationAttemptAuditReadiness({ generatedRoot })

      expect(readiness).toMatchObject({
        configured_lock_timeout_ms: 4200,
        configured_lock_retry_ms: 17,
        configured_lock_stale_ms: 61000,
        status: 'uninitialized',
        ready_for_next_attempt: true,
      configuration_valid: true,
      configuration_warnings: [],
      permission_policy: 'owner_only',
      permission_policy_satisfied: true,
      event_file_sync_required: true,
      no_follow_open_required: true,
      directory_entry_sync_guaranteed: true,
      })
      expect(await readdir(generatedRoot)).toEqual([])
    } finally {
      for (const name of Object.values(names)) {
        if (previous[name] === undefined) delete process.env[name]
        else process.env[name] = previous[name]
      }
    }
  })

  it('falls back from invalid lock policy environment values with stable warnings', async () => {
    const generatedRoot = await workspace()
    const names = {
      timeout: 'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_TIMEOUT_MS',
      retry: 'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_RETRY_MS',
      stale: 'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_STALE_MS',
    } as const
    const previous = Object.fromEntries(Object.values(names).map(name => [name, process.env[name]]))
    try {
      process.env[names.timeout] = 'PRIVATE_TIMEOUT_VALUE'
      process.env[names.retry] = '0'
      process.env[names.stale] = '9'

      const readiness = await inspectStoryGenerationAttemptAuditReadiness({ generatedRoot })

      expect(readiness).toMatchObject({
        configured_lock_timeout_ms: 5000,
        configured_lock_retry_ms: 10,
        configured_lock_stale_ms: 30000,
        configuration_valid: false,
        configuration_warnings: [
          'invalid_lock_timeout_configuration_fell_back_to_default',
          'invalid_lock_retry_configuration_fell_back_to_default',
          'invalid_lock_stale_configuration_fell_back_to_default',
        ],
        ready_for_next_attempt: true,
      })
      expect(JSON.stringify(readiness)).not.toContain('PRIVATE_TIMEOUT_VALUE')
    } finally {
      for (const name of Object.values(names)) {
        if (previous[name] === undefined) delete process.env[name]
        else process.env[name] = previous[name]
      }
    }
  })

  it('reports a healthy initialized ledger with bounded lifecycle evidence', async () => {
    const generatedRoot = await workspace()
    await runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, async () => success({ ready: true }), {
      generatedRoot,
      maxBytes: 8192,
      maxArchives: 3,
    })

    const readiness = await inspectStoryGenerationAttemptAuditReadiness({
      generatedRoot,
      maxBytes: 8192,
      maxArchives: 3,
    })

    expect(readiness).toMatchObject({
      status: 'ready',
      storage_initialized: true,
      ledger_present: true,
      archive_count: 0,
      configured_max_bytes: 8192,
      configured_max_archives: 3,
      lock_status: 'absent',
      history_integrity: 'valid',
      valid_event_count: 2,
      invalid_event_count: 0,
      ready_for_next_attempt: true,
      blockers: [],
      operator_actions: ['no_action_required'],
      permission_policy: 'owner_only',
      permission_policy_satisfied: true,
    })
    expect(readiness.current_file_bytes).toBeGreaterThan(0)
  })

  it('blocks a symlinked audit directory without writing outside the generated root', async () => {
    const generatedRoot = await workspace()
    const outsideRoot = await workspace()
    await symlink(outsideRoot, resolve(generatedRoot, 'system'), 'dir')
    const generate = vi.fn(async () => success({ should_not_run: true }))

    const readiness = await inspectStoryGenerationAttemptAuditReadiness({ generatedRoot })

    expect(readiness).toMatchObject({
      status: 'blocked',
      ready_for_next_attempt: false,
      blockers: ['audit_directory_unsafe'],
      operator_actions: ['review_audit_directory_safety_after_backup'],
      absolute_path_exposed: false,
    })
    await expect(runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, generate, { generatedRoot })).rejects.toBeInstanceOf(StoryGenerationAttemptAuditUnavailableError)
    expect(generate).not.toHaveBeenCalled()
    expect(await readdir(outsideRoot)).toEqual([])
  })

  it('blocks a symlinked ledger before it can modify an external file', async () => {
    const generatedRoot = await workspace()
    const outsideRoot = await workspace()
    const outsideFile = resolve(outsideRoot, 'external-ledger.jsonl')
    const ledgerPath = storyGenerationAttemptAuditPath(generatedRoot)
    await mkdir(resolve(ledgerPath, '..'), { recursive: true, mode: 0o700 })
    await chmod(resolve(ledgerPath, '..'), 0o700)
    const externalContent = `${JSON.stringify({
      schema_version: 'story-generation-attempt-event/v1',
      attempt_id: '99999999-9999-4999-8999-999999999999',
      occurred_at: '2026-07-19T01:00:00.000Z',
      entrypoint: 'web_api_stories_generate',
      source_domain: 'china_culture',
      video_type: 'character_story',
      status: 'started',
    })}\n`
    await writeFile(outsideFile, externalContent)
    await symlink(outsideFile, ledgerPath, 'file')
    const generate = vi.fn(async () => success({ should_not_run: true }))

    const readiness = await inspectStoryGenerationAttemptAuditReadiness({ generatedRoot })
    expect(readiness).toMatchObject({
      status: 'blocked',
      blockers: ['ledger_target_unsafe'],
      operator_actions: ['review_ledger_target_safety_after_backup'],
    })
    await expect(runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, generate, { generatedRoot })).rejects.toBeInstanceOf(StoryGenerationAttemptAuditUnavailableError)
    expect(generate).not.toHaveBeenCalled()
    expect(await readFile(outsideFile, 'utf8')).toBe(externalContent)
  })

  it('blocks a symlinked archive even when its external content is a valid event', async () => {
    const generatedRoot = await workspace()
    const outsideRoot = await workspace()
    const outsideFile = resolve(outsideRoot, 'external-archive.jsonl')
    const ledgerPath = storyGenerationAttemptAuditPath(generatedRoot)
    await mkdir(resolve(ledgerPath, '..'), { recursive: true, mode: 0o700 })
    await chmod(resolve(ledgerPath, '..'), 0o700)
    const externalContent = `${JSON.stringify({
      schema_version: 'story-generation-attempt-event/v1',
      attempt_id: '99999999-9999-4999-8999-999999999999',
      occurred_at: '2026-07-19T01:00:00.000Z',
      entrypoint: 'web_api_stories_generate',
      source_domain: 'china_culture',
      video_type: 'character_story',
      status: 'started',
    })}\n`
    await writeFile(outsideFile, externalContent)
    await symlink(outsideFile, `${ledgerPath}.1`, 'file')
    const generate = vi.fn(async () => success({ should_not_run: true }))

    const readiness = await inspectStoryGenerationAttemptAuditReadiness({ generatedRoot })
    expect(readiness).toMatchObject({
      status: 'blocked',
      blockers: ['archive_target_unsafe'],
      operator_actions: ['review_archive_target_safety_after_backup'],
    })
    await expect(runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, generate, { generatedRoot })).rejects.toBeInstanceOf(StoryGenerationAttemptAuditUnavailableError)
    expect(generate).not.toHaveBeenCalled()
    expect(await readFile(outsideFile, 'utf8')).toBe(externalContent)
    await expect(readFile(ledgerPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('blocks an audit directory that grants group or other permissions', async () => {
    const generatedRoot = await workspace()
    const auditDirectory = resolve(generatedRoot, 'system')
    await mkdir(auditDirectory, { mode: 0o755 })
    await chmod(auditDirectory, 0o755)
    const generate = vi.fn(async () => success({ should_not_run: true }))

    const readiness = await inspectStoryGenerationAttemptAuditReadiness({ generatedRoot })

    expect(readiness).toMatchObject({
      status: 'blocked',
      permission_policy: 'owner_only',
      permission_policy_satisfied: false,
      blockers: ['audit_directory_permissions_unsafe'],
      operator_actions: ['review_audit_directory_permissions_after_backup'],
    })
    await expect(runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, generate, { generatedRoot })).rejects.toBeInstanceOf(StoryGenerationAttemptAuditUnavailableError)
    expect(generate).not.toHaveBeenCalled()
  })

  it('blocks a valid ledger that grants group or other permissions', async () => {
    const generatedRoot = await workspace()
    await runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, async () => success({ initialized: true }), { generatedRoot })
    await chmod(storyGenerationAttemptAuditPath(generatedRoot), 0o644)
    const generate = vi.fn(async () => success({ should_not_run: true }))

    const readiness = await inspectStoryGenerationAttemptAuditReadiness({ generatedRoot })

    expect(readiness).toMatchObject({
      status: 'blocked',
      permission_policy: 'owner_only',
      permission_policy_satisfied: false,
      blockers: ['ledger_permissions_unsafe'],
      operator_actions: ['review_ledger_permissions_after_backup'],
    })
    await expect(runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, generate, { generatedRoot })).rejects.toBeInstanceOf(StoryGenerationAttemptAuditUnavailableError)
    expect(generate).not.toHaveBeenCalled()
  })

  it('blocks a valid archive that grants group or other permissions', async () => {
    const generatedRoot = await workspace()
    const ledgerPath = storyGenerationAttemptAuditPath(generatedRoot)
    await mkdir(resolve(ledgerPath, '..'), { recursive: true, mode: 0o700 })
    await chmod(resolve(ledgerPath, '..'), 0o700)
    const archivePath = `${ledgerPath}.1`
    await writeFile(archivePath, `${JSON.stringify({
      schema_version: 'story-generation-attempt-event/v1',
      attempt_id: '99999999-9999-4999-8999-999999999999',
      occurred_at: '2026-07-19T01:00:00.000Z',
      entrypoint: 'web_api_stories_generate',
      source_domain: 'china_culture',
      video_type: 'character_story',
      status: 'started',
    })}\n`, { mode: 0o644 })
    await chmod(archivePath, 0o644)
    const generate = vi.fn(async () => success({ should_not_run: true }))

    const readiness = await inspectStoryGenerationAttemptAuditReadiness({ generatedRoot })

    expect(readiness).toMatchObject({
      status: 'blocked',
      permission_policy: 'owner_only',
      permission_policy_satisfied: false,
      blockers: ['archive_permissions_unsafe'],
      operator_actions: ['review_archive_permissions_after_backup'],
    })
    await expect(runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, generate, { generatedRoot })).rejects.toBeInstanceOf(StoryGenerationAttemptAuditUnavailableError)
    expect(generate).not.toHaveBeenCalled()
  })

  it('blocks future generation when a ledger contains a malformed event', async () => {
    const generatedRoot = await workspace()
    await runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, async () => success({ ready: true }), { generatedRoot })
    await appendFile(storyGenerationAttemptAuditPath(generatedRoot), '{PRIVATE CORRUPTED CONTENT}\n')
    const generate = vi.fn(async () => success({ should_not_run: true }))

    const readiness = await inspectStoryGenerationAttemptAuditReadiness({ generatedRoot })

    expect(readiness).toMatchObject({
      status: 'blocked',
      history_integrity: 'invalid',
      valid_event_count: 2,
      invalid_event_count: 1,
      ready_for_next_attempt: false,
      blockers: ['ledger_history_invalid'],
      operator_actions: ['review_invalid_history_after_backup'],
      raw_exception_recorded: false,
      absolute_path_exposed: false,
    })
    await expect(runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, generate, { generatedRoot })).rejects.toBeInstanceOf(StoryGenerationAttemptAuditUnavailableError)
    expect(generate).not.toHaveBeenCalled()
  })

  it('blocks out-of-policy archives instead of silently ignoring retained audit evidence', async () => {
    const generatedRoot = await workspace()
    const ledgerPath = storyGenerationAttemptAuditPath(generatedRoot)
    await mkdir(resolve(ledgerPath, '..'), { recursive: true, mode: 0o700 })
    await chmod(resolve(ledgerPath, '..'), 0o700)
    await writeFile(`${ledgerPath}.3`, `${JSON.stringify({
      schema_version: 'story-generation-attempt-event/v1',
      attempt_id: '99999999-9999-4999-8999-999999999999',
      occurred_at: '2026-07-19T01:00:00.000Z',
      entrypoint: 'web_api_stories_generate',
      source_domain: 'china_culture',
      video_type: 'character_story',
      status: 'started',
    })}\n`, { mode: 0o600 })
    const generate = vi.fn(async () => success({ should_not_run: true }))

    const readiness = await inspectStoryGenerationAttemptAuditReadiness({
      generatedRoot,
      maxArchives: 2,
    })

    expect(readiness).toMatchObject({
      status: 'blocked',
      archive_count: 1,
      configured_max_archives: 2,
      ready_for_next_attempt: false,
      blockers: ['archive_retention_exceeded'],
      operator_actions: ['review_archive_retention_after_backup'],
    })
    await expect(runWithStoryGenerationAttemptAudit({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, generate, {
      generatedRoot,
      maxArchives: 2,
    })).rejects.toBeInstanceOf(StoryGenerationAttemptAuditUnavailableError)
    expect(generate).not.toHaveBeenCalled()
  })
})
