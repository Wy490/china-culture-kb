import { afterEach, describe, expect, it } from 'vitest'
import { chmod, mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { inspectStoryGenerationActivity } from '../services/story-generation-activity-service.js'
import {
  beginStoryGenerationAttempt,
  failStoryGenerationAttempt,
  succeedStoryGenerationAttempt,
} from '../services/story-generation-attempt-audit-service.js'

const workspaces: string[] = []

async function workspace() {
  const root = await mkdtemp(join(tmpdir(), 'story-generation-activity-'))
  workspaces.push(root)
  return {
    root,
    generatedRoot: resolve(root, 'web', 'generated'),
    legacyGeneratedRoot: resolve(root, 'web', 'web', 'generated'),
    kbRoot: resolve(root, 'data'),
  }
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(resolve(filePath, '..'), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = []
  async function visit(directory: string) {
    let entries = []
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const target = resolve(directory, entry.name)
      if (entry.isDirectory()) await visit(target)
      else if (entry.isFile()) files.push(relative(root, target))
    }
  }
  await visit(root)
  return files.sort()
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('inspectStoryGenerationActivity', () => {
  it('reports post-generation revisions without inventing a failed or missing request conclusion', async () => {
    const paths = await workspace()
    const storyId = '20260711-story-latest'
    const projectId = `${storyId}--character_story`
    await writeJson(resolve(paths.generatedRoot, 'stories', 'character_story', `${storyId}.json`), {
      storyId,
      _request_meta: { created_at: '2026-07-11T03:49:30.655Z' },
    })
    await writeJson(resolve(paths.generatedRoot, 'projects', projectId, 'project.json'), {
      project_id: projectId,
      current_version_id: `${projectId}-v2`,
      created_at: '2026-07-11T03:49:30.655Z',
      updated_at: '2026-07-17T18:54:57.750Z',
      version_count: 2,
    })
    await writeJson(resolve(paths.generatedRoot, 'projects', projectId, 'versions', `${projectId}-v1.json`), {
      project_id: projectId,
      version_id: `${projectId}-v1`,
      created_at: '2026-07-11T03:49:30.655Z',
      change_type: 'initial_generation',
    })
    await writeJson(resolve(paths.generatedRoot, 'projects', projectId, 'versions', `${projectId}-v2.json`), {
      project_id: projectId,
      version_id: `${projectId}-v2`,
      created_at: '2026-07-17T18:54:57.750Z',
      change_type: 'quality_repair',
    })
    await mkdir(resolve(paths.generatedRoot, 'projects', projectId, '.transactions'), { recursive: true })
    await writeJson(resolve(paths.kbRoot, 'reports', 'latest-report.json'), {
      generated_at: '2026-07-18T06:05:17.328Z',
    })
    await writeJson(resolve(paths.legacyGeneratedRoot, 'projects', 'legacy-project', 'project.json'), {
      project_id: 'legacy-project',
      updated_at: '2026-06-16T00:00:00.000Z',
    })
    const before = await listFiles(paths.root)

    const activity = await inspectStoryGenerationActivity({
      ...paths,
      now: new Date('2026-07-18T06:10:00.000Z'),
    })

    expect(activity).toMatchObject({
      schema_version: 'story-agent-generation-activity/v1',
      generated_at: '2026-07-18T06:10:00.000Z',
      diagnosis: 'attempt_history_unavailable',
      latest_persisted_activity_kind: 'project_revision',
      latest_story: {
        story_id: storyId,
        created_at: '2026-07-11T03:49:30.655Z',
      },
      latest_project_version: {
        project_id: projectId,
        version_id: `${projectId}-v2`,
        created_at: '2026-07-17T18:54:57.750Z',
        change_type: 'quality_repair',
      },
      latest_report: {
        report_file: 'latest-report.json',
        generated_at: '2026-07-18T06:05:17.328Z',
      },
      summary: {
        story_count: 1,
        project_count: 1,
        version_count: 2,
        report_count: 1,
        project_revision_after_latest_story_count: 1,
        report_after_latest_story_count: 1,
        pending_transaction_count: 0,
        legacy_story_count: 0,
        legacy_project_count: 1,
      },
      signals: {
        durable_generation_attempt_history_available: false,
        generation_attempt_audit_ready_for_next_request: true,
        no_generation_request_confirmed: false,
        generation_pipeline_failure_confirmed: false,
        storage_root_switch_detected: false,
        report_only_activity_detected: false,
        project_revision_only_activity_detected: true,
      },
      safety: {
        read_only: true,
        generated_files_modified: false,
        model_invoked: false,
      },
      attempt_audit_readiness: {
        schema_version: 'story-generation-attempt-audit-readiness/v1',
        status: 'uninitialized',
        history_integrity: 'unavailable',
        ready_for_next_attempt: true,
        blockers: [],
      },
    })
    expect(activity.unresolved_possibilities).toEqual([
      'no_generation_request_submitted',
      'generation_request_failed_before_persistence',
    ])
    expect(await listFiles(paths.root)).toEqual(before)
  })

  it('detects a newer story under the known legacy root without merging it', async () => {
    const paths = await workspace()
    await writeJson(resolve(paths.generatedRoot, 'stories', 'character_story', 'active-story.json'), {
      storyId: 'active-story',
      _request_meta: { created_at: '2026-07-11T00:00:00.000Z' },
    })
    await writeJson(resolve(paths.legacyGeneratedRoot, 'stories', 'character_story', 'legacy-story.json'), {
      storyId: 'legacy-story',
      _request_meta: { created_at: '2026-07-12T00:00:00.000Z' },
    })

    const activity = await inspectStoryGenerationActivity(paths)

    expect(activity.diagnosis).toBe('storage_root_mismatch_detected')
    expect(activity.signals.storage_root_switch_detected).toBe(true)
    expect(activity.summary.legacy_story_count).toBe(1)
    expect(activity.legacy_latest_story?.story_id).toBe('legacy-story')
    expect(activity.safety.generated_files_modified).toBe(false)
  })

  it('surfaces pending repository transactions before request-history uncertainty', async () => {
    const paths = await workspace()
    await writeJson(resolve(
      paths.generatedRoot,
      'projects',
      'pending-project',
      '.transactions',
      '11111111-1111-4111-8111-111111111111.intent.json',
    ), { schema_version: 'story-agent-project-repository-transaction/v1' })

    const activity = await inspectStoryGenerationActivity(paths)

    expect(activity.diagnosis).toBe('pending_transaction_detected')
    expect(activity.summary.pending_transaction_count).toBe(1)
    expect(activity.safety.read_only).toBe(true)
  })

  it('confirms no newer request when the latest durable attempt succeeded with the latest story', async () => {
    const paths = await workspace()
    await writeJson(resolve(paths.generatedRoot, 'stories', 'character_story', 'audited-story.json'), {
      storyId: 'audited-story',
      _request_meta: { created_at: '2026-07-18T07:00:00.000Z' },
    })
    const timestamps = [
      new Date('2026-07-18T06:59:59.000Z'),
      new Date('2026-07-18T07:00:01.000Z'),
    ]
    const auditOptions = {
      generatedRoot: paths.generatedRoot,
      attemptId: () => '33333333-3333-4333-8333-333333333333',
      now: () => timestamps.shift() ?? new Date('2026-07-18T07:00:02.000Z'),
    }
    const attempt = await beginStoryGenerationAttempt({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, auditOptions)
    await succeedStoryGenerationAttempt(attempt, auditOptions)

    const activity = await inspectStoryGenerationActivity({
      ...paths,
      now: new Date('2026-07-18T08:00:00.000Z'),
    })

    expect(activity).toMatchObject({
      diagnosis: 'no_generation_request_since_latest_success',
      latest_generation_attempt: {
        attempt_id: attempt.attempt_id,
        status: 'succeeded',
        started_at: '2026-07-18T06:59:59.000Z',
        terminal_at: '2026-07-18T07:00:01.000Z',
        source_domain: 'china_culture',
        video_type: 'character_story',
      },
      summary: {
        generation_attempt_count: 1,
        generation_attempt_succeeded_count: 1,
        generation_attempt_failed_count: 0,
        generation_attempt_incomplete_count: 0,
        generation_attempt_invalid_event_count: 0,
      },
      signals: {
        durable_generation_attempt_history_available: true,
        no_generation_request_confirmed: true,
        generation_pipeline_failure_confirmed: false,
        generation_attempt_incomplete_detected: false,
      },
    })
    expect(activity.unresolved_possibilities).toEqual([])
  })

  it('confirms a pre-persistence failure from the latest failed attempt', async () => {
    const paths = await workspace()
    await writeJson(resolve(paths.generatedRoot, 'stories', 'character_story', 'older-story.json'), {
      storyId: 'older-story',
      _request_meta: { created_at: '2026-07-18T06:00:00.000Z' },
    })
    const timestamps = [
      new Date('2026-07-18T07:10:00.000Z'),
      new Date('2026-07-18T07:10:01.000Z'),
    ]
    const auditOptions = {
      generatedRoot: paths.generatedRoot,
      attemptId: () => '44444444-4444-4444-8444-444444444444',
      now: () => timestamps.shift() ?? new Date('2026-07-18T07:10:02.000Z'),
    }
    const attempt = await beginStoryGenerationAttempt({
      sourceDomain: 'china_culture',
      videoType: 'culture_promo',
    }, auditOptions)
    await failStoryGenerationAttempt(attempt, 'ENTRY_NOT_FOUND', auditOptions)

    const activity = await inspectStoryGenerationActivity({ ...paths })

    expect(activity.diagnosis).toBe('generation_pipeline_failure_detected')
    expect(activity.latest_generation_attempt).toMatchObject({
      attempt_id: attempt.attempt_id,
      status: 'failed',
      error_code: 'ENTRY_NOT_FOUND',
    })
    expect(activity.signals).toMatchObject({
      durable_generation_attempt_history_available: true,
      no_generation_request_confirmed: false,
      generation_pipeline_failure_confirmed: true,
      generation_attempt_incomplete_detected: false,
    })
    expect(activity.unresolved_possibilities).toEqual([])
  })

  it('surfaces a durable started event without misclassifying an active or interrupted attempt', async () => {
    const paths = await workspace()
    await beginStoryGenerationAttempt({
      sourceDomain: 'original_fiction',
      videoType: 'ai_comic_drama',
    }, {
      generatedRoot: paths.generatedRoot,
      attemptId: () => '55555555-5555-4555-8555-555555555555',
      now: () => new Date('2026-07-18T07:20:00.000Z'),
    })

    const activity = await inspectStoryGenerationActivity({ ...paths })

    expect(activity.diagnosis).toBe('generation_attempt_incomplete')
    expect(activity.signals).toMatchObject({
      durable_generation_attempt_history_available: true,
      no_generation_request_confirmed: false,
      generation_pipeline_failure_confirmed: false,
      generation_attempt_incomplete_detected: true,
    })
    expect(activity.unresolved_possibilities).toEqual([
      'generation_request_in_progress_or_interrupted',
    ])
  })

  it('fails history conclusions closed and blocks readiness when the ledger is malformed', async () => {
    const paths = await workspace()
    await mkdir(resolve(paths.generatedRoot, 'system'), { recursive: true, mode: 0o700 })
    await chmod(resolve(paths.generatedRoot, 'system'), 0o700)
    await writeFile(
      resolve(paths.generatedRoot, 'system', 'story-generation-attempts.jsonl'),
      '{malformed audit event}\n',
      { encoding: 'utf8', mode: 0o600 },
    )

    const activity = await inspectStoryGenerationActivity(paths)

    expect(activity.diagnosis).toBe('attempt_history_unavailable')
    expect(activity.signals).toMatchObject({
      durable_generation_attempt_history_available: false,
      generation_attempt_audit_ready_for_next_request: false,
      no_generation_request_confirmed: false,
      generation_pipeline_failure_confirmed: false,
    })
    expect(activity.attempt_audit_readiness).toMatchObject({
      status: 'blocked',
      history_integrity: 'invalid',
      invalid_event_count: 1,
      ready_for_next_attempt: false,
      blockers: ['ledger_history_invalid'],
      absolute_path_exposed: false,
    })
  })

  it('rejects otherwise valid conclusions when retained archives exceed policy', async () => {
    const paths = await workspace()
    const auditOptions = {
      generatedRoot: paths.generatedRoot,
      attemptId: () => '77777777-7777-4777-8777-777777777777',
      now: (() => {
        const timestamps = [
          new Date('2026-07-18T09:00:00.000Z'),
          new Date('2026-07-18T09:00:01.000Z'),
        ]
        return () => timestamps.shift() ?? new Date('2026-07-18T09:00:02.000Z')
      })(),
    }
    const attempt = await beginStoryGenerationAttempt({
      sourceDomain: 'china_culture',
      videoType: 'character_story',
    }, auditOptions)
    await failStoryGenerationAttempt(attempt, 'ENTRY_NOT_FOUND', auditOptions)
    await writeFile(
      resolve(paths.generatedRoot, 'system', 'story-generation-attempts.jsonl.5'),
      `${JSON.stringify({ ignored: 'out-of-policy archive' })}\n`,
      { encoding: 'utf8', mode: 0o600 },
    )

    const activity = await inspectStoryGenerationActivity(paths)

    expect(activity.diagnosis).toBe('attempt_history_unavailable')
    expect(activity.signals).toMatchObject({
      durable_generation_attempt_history_available: false,
      generation_attempt_audit_ready_for_next_request: false,
      generation_pipeline_failure_confirmed: false,
    })
    expect(activity.attempt_audit_readiness).toMatchObject({
      status: 'blocked',
      history_integrity: 'invalid',
      blockers: ['archive_retention_exceeded'],
    })
  })
})
