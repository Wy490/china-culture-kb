import { afterEach, describe, expect, it } from 'vitest'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  runStoryGenerationAttemptAuditCrashSmoke,
} from '../services/story-generation-attempt-audit-crash-smoke-service.js'

const roots: string[] = []

async function workspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'story-generation-audit-crash-smoke-test-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('story generation attempt audit crash smoke', () => {
  it('runs both SIGKILL boundaries only in a new directory and returns a sanitized report', async () => {
    const parent = await workspace()
    const activeGeneratedRoot = resolve(parent, 'active-generated')
    const workDir = resolve(parent, 'story-agent-audit-crash-smoke-valid')
    await mkdir(activeGeneratedRoot, { mode: 0o700 })

    const report = await runStoryGenerationAttemptAuditCrashSmoke({
      workDir,
      activeGeneratedRoot,
    })

    expect(report).toMatchObject({
      schema_version: 'story-generation-attempt-audit-crash-smoke/v1',
      status: 'passed',
      process_signal: 'SIGKILL',
      case_count: 2,
      passed_case_count: 2,
      real_generated_root_touched: false,
      existing_target_accepted: false,
      automatic_repair_invoked: false,
      destructive_action_invoked: false,
      power_loss_simulated: false,
      remote_filesystem_validated: false,
      cases: [
        expect.objectContaining({
          phase: 'file_sync_before_directory_sync',
          fresh_lock_failed_closed: true,
          retained_history_valid: true,
          recovered_after_explicit_expiry: true,
        }),
        expect.objectContaining({
          phase: 'rotation_rename_before_next_append',
          fresh_lock_failed_closed: true,
          retained_history_valid: true,
          recovered_after_explicit_expiry: true,
        }),
      ],
    })
    expect((await readdir(workDir)).sort()).toEqual([
      'file-sync-before-directory-sync',
      'rotation-rename-before-next-append',
    ])
    const serialized = JSON.stringify(report)
    expect(serialized).not.toContain(parent)
    expect(serialized).not.toContain(workDir)
    expect(serialized).not.toContain('owner_id')
    expect(serialized).not.toContain('attempt_id')
    expect(serialized).not.toContain('occurred_at')
  }, 20_000)

  it('rejects an existing target without changing its content', async () => {
    const parent = await workspace()
    const activeGeneratedRoot = resolve(parent, 'active-generated')
    const workDir = resolve(parent, 'story-agent-audit-crash-smoke-existing')
    await mkdir(activeGeneratedRoot, { mode: 0o700 })
    await mkdir(workDir, { mode: 0o700 })
    const sentinel = resolve(workDir, 'sentinel.txt')
    await writeFile(sentinel, 'PRIVATE EXISTING CONTENT')

    await expect(runStoryGenerationAttemptAuditCrashSmoke({
      workDir,
      activeGeneratedRoot,
    })).rejects.toMatchObject({
      code: 'target_already_exists',
    })
    expect(await readFile(sentinel, 'utf8')).toBe('PRIVATE EXISTING CONTENT')
  })

  it('rejects a new target inside the active generated root', async () => {
    const parent = await workspace()
    const activeGeneratedRoot = resolve(parent, 'active-generated')
    const workDir = resolve(activeGeneratedRoot, 'story-agent-audit-crash-smoke-unsafe')
    await mkdir(activeGeneratedRoot, { mode: 0o700 })

    await expect(runStoryGenerationAttemptAuditCrashSmoke({
      workDir,
      activeGeneratedRoot,
    })).rejects.toMatchObject({
      code: 'target_within_active_generated_root',
    })
    expect(await readdir(activeGeneratedRoot)).toEqual([])
  })

  it('rejects a target reached through a symlinked parent', async () => {
    const parent = await workspace()
    const activeGeneratedRoot = resolve(parent, 'active-generated')
    const realParent = resolve(parent, 'real-parent')
    const linkedParent = resolve(parent, 'linked-parent')
    await mkdir(activeGeneratedRoot, { mode: 0o700 })
    await mkdir(realParent, { mode: 0o700 })
    await symlink(realParent, linkedParent, 'dir')

    await expect(runStoryGenerationAttemptAuditCrashSmoke({
      workDir: resolve(linkedParent, 'story-agent-audit-crash-smoke-unsafe'),
      activeGeneratedRoot,
    })).rejects.toMatchObject({
      code: 'target_parent_not_canonical',
    })
    expect(await readdir(realParent)).toEqual([])
  })

  it('rejects relative paths and arbitrary target names', async () => {
    const parent = await workspace()
    const activeGeneratedRoot = resolve(parent, 'active-generated')
    await mkdir(activeGeneratedRoot, { mode: 0o700 })

    await expect(runStoryGenerationAttemptAuditCrashSmoke({
      workDir: 'story-agent-audit-crash-smoke-relative',
      activeGeneratedRoot,
    })).rejects.toMatchObject({
      code: 'target_path_not_absolute',
    })
    await expect(runStoryGenerationAttemptAuditCrashSmoke({
      workDir: resolve(parent, 'arbitrary-target'),
      activeGeneratedRoot,
    })).rejects.toMatchObject({
      code: 'target_name_invalid',
    })
  })
})
