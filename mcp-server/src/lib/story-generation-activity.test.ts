import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inspectStoryGenerationActivity } from './story-generation-activity.js';

const roots: string[] = [];

async function workspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-story-generation-activity-'));
  roots.push(root);
  return {
    root,
    generatedRoot: path.join(root, 'web', 'generated'),
    kbRoot: path.join(root, 'data'),
  };
}

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

async function writeLedger(generatedRoot: string, events: unknown[]) {
  const filePath = path.join(generatedRoot, 'system', 'story-generation-attempts.jsonl');
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await fs.chmod(path.dirname(filePath), 0o700);
  await fs.writeFile(filePath, `${events.map(event => JSON.stringify(event)).join('\n')}\n`, { mode: 0o600 });
}

function event(overrides: Record<string, unknown>) {
  return {
    schema_version: 'story-generation-attempt-event/v1',
    attempt_id: '66666666-6666-4666-8666-666666666666',
    occurred_at: '2026-07-18T08:00:00.000Z',
    entrypoint: 'web_api_stories_generate',
    source_domain: 'china_culture',
    video_type: 'character_story',
    status: 'started',
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe('MCP story generation activity ledger parity', () => {
  it('reads the canonical Web ledger and confirms no request after the latest success', async () => {
    const paths = await workspace();
    await writeJson(path.join(paths.generatedRoot, 'stories', 'character_story', 'audited-story.json'), {
      storyId: 'audited-story',
      _request_meta: { created_at: '2026-07-18T08:00:01.000Z' },
    });
    await writeLedger(paths.generatedRoot, [
      event({ occurred_at: '2026-07-18T08:00:00.000Z' }),
      event({ occurred_at: '2026-07-18T08:00:02.000Z', status: 'succeeded' }),
    ]);

    const activity = await inspectStoryGenerationActivity(paths);

    expect(activity).toMatchObject({
      diagnosis: 'no_generation_request_since_latest_success',
      latest_generation_attempt: {
        attempt_id: '66666666-6666-4666-8666-666666666666',
        status: 'succeeded',
        terminal_at: '2026-07-18T08:00:02.000Z',
      },
      summary: {
        generation_attempt_count: 1,
        generation_attempt_succeeded_count: 1,
        generation_attempt_failed_count: 0,
        generation_attempt_incomplete_count: 0,
      },
      signals: {
        durable_generation_attempt_history_available: true,
        generation_attempt_audit_ready_for_next_request: true,
        no_generation_request_confirmed: true,
        generation_pipeline_failure_confirmed: false,
        generation_attempt_incomplete_detected: false,
      },
      unresolved_possibilities: [],
      attempt_audit_readiness: {
        schema_version: 'story-generation-attempt-audit-readiness/v1',
        status: 'ready',
        history_integrity: 'valid',
        ready_for_next_attempt: true,
        configured_lock_timeout_ms: 5000,
        configured_lock_retry_ms: 10,
        configured_lock_stale_ms: 30000,
        blockers: [],
        operator_actions: ['no_action_required'],
        automatic_repair_allowed: false,
        destructive_action_performed: false,
      },
    });
  });

  it('keeps an unfinished attempt unresolved instead of inventing a failure', async () => {
    const paths = await workspace();
    await writeLedger(paths.generatedRoot, [event({})]);

    const activity = await inspectStoryGenerationActivity(paths);

    expect(activity.diagnosis).toBe('generation_attempt_incomplete');
    expect(activity.signals.generation_pipeline_failure_confirmed).toBe(false);
    expect(activity.unresolved_possibilities).toEqual([
      'generation_request_in_progress_or_interrupted',
    ]);
  });

  it('reports malformed ledger readiness without exposing its path or content', async () => {
    const paths = await workspace();
    const ledgerPath = path.join(paths.generatedRoot, 'system', 'story-generation-attempts.jsonl');
    await fs.mkdir(path.dirname(ledgerPath), { recursive: true, mode: 0o700 });
    await fs.chmod(path.dirname(ledgerPath), 0o700);
    await fs.writeFile(ledgerPath, '{PRIVATE MALFORMED EVENT}\n', { mode: 0o600 });

    const activity = await inspectStoryGenerationActivity(paths);

    expect(activity.diagnosis).toBe('attempt_history_unavailable');
    expect(activity.signals.generation_attempt_audit_ready_for_next_request).toBe(false);
    expect(activity.attempt_audit_readiness).toMatchObject({
      status: 'blocked',
      history_integrity: 'invalid',
      invalid_event_count: 1,
      ready_for_next_attempt: false,
      blockers: ['ledger_history_invalid'],
      operator_actions: ['review_invalid_history_after_backup'],
      raw_exception_recorded: false,
      absolute_path_exposed: false,
    });
    expect(JSON.stringify(activity)).not.toContain('PRIVATE MALFORMED EVENT');
    expect(JSON.stringify(activity)).not.toContain(paths.generatedRoot);
  });

  it('reports archives beyond the configured retention window as blocked', async () => {
    const paths = await workspace();
    await writeLedger(paths.generatedRoot, [
      event({ occurred_at: '2026-07-18T08:00:00.000Z' }),
      event({ occurred_at: '2026-07-18T08:00:02.000Z', status: 'failed', error_code: 'ENTRY_NOT_FOUND' }),
    ]);
    const archivePath = path.join(
      paths.generatedRoot,
      'system',
      'story-generation-attempts.jsonl.5',
    );
    await fs.mkdir(path.dirname(archivePath), { recursive: true, mode: 0o700 });
    await fs.chmod(path.dirname(archivePath), 0o700);
    await fs.writeFile(archivePath, `${JSON.stringify(event({}))}\n`, { mode: 0o600 });

    const activity = await inspectStoryGenerationActivity(paths);

    expect(activity.diagnosis).toBe('attempt_history_unavailable');
    expect(activity.signals).toMatchObject({
      durable_generation_attempt_history_available: false,
      generation_attempt_audit_ready_for_next_request: false,
      generation_pipeline_failure_confirmed: false,
    });
    expect(activity.attempt_audit_readiness).toMatchObject({
      status: 'blocked',
      archive_count: 1,
      configured_max_archives: 4,
      history_integrity: 'invalid',
      ready_for_next_attempt: false,
      blockers: ['archive_retention_exceeded'],
      operator_actions: ['review_archive_retention_after_backup'],
    });
  });

  it('maps active and expired locks to read-only operator actions', async () => {
    const paths = await workspace();
    const lockPath = path.join(
      paths.generatedRoot,
      'system',
      'story-generation-attempts.jsonl.lock',
    );
    await fs.mkdir(path.dirname(lockPath), { recursive: true, mode: 0o700 });
    await fs.chmod(path.dirname(lockPath), 0o700);
    await fs.writeFile(lockPath, JSON.stringify({
      schema_version: 'story-generation-attempt-lock/v1',
      owner_id: '88888888-8888-4888-8888-888888888888',
      created_at: new Date().toISOString(),
    }), { mode: 0o600 });

    const active = await inspectStoryGenerationActivity(paths);
    expect(active.attempt_audit_readiness).toMatchObject({
      status: 'blocked',
      lock_status: 'active',
      blockers: ['ledger_lock_active'],
      operator_actions: ['wait_for_active_writer_and_reinspect'],
      automatic_repair_allowed: false,
      destructive_action_performed: false,
    });

    const expiredTime = new Date(Date.now() - 60_000);
    await fs.utimes(lockPath, expiredTime, expiredTime);
    const expired = await inspectStoryGenerationActivity(paths);
    expect(expired.attempt_audit_readiness).toMatchObject({
      status: 'ready',
      lock_status: 'expired_recoverable',
      blockers: [],
      operator_actions: ['reinspect_expired_lock_on_next_canonical_request'],
      automatic_repair_allowed: false,
      destructive_action_performed: false,
    });
  });

  it('reports the same validated lock policy environment overrides as Web', async () => {
    const paths = await workspace();
    const names = {
      timeout: 'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_TIMEOUT_MS',
      retry: 'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_RETRY_MS',
      stale: 'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_STALE_MS',
    } as const;
    const previous = Object.fromEntries(Object.values(names).map(name => [name, process.env[name]]));
    try {
      process.env[names.timeout] = '4200';
      process.env[names.retry] = '17';
      process.env[names.stale] = '61000';

      const activity = await inspectStoryGenerationActivity(paths);

      expect(activity.attempt_audit_readiness).toMatchObject({
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
      });
    } finally {
      for (const name of Object.values(names)) {
        if (previous[name] === undefined) delete process.env[name];
        else process.env[name] = previous[name];
      }
    }
  });

  it('uses safe defaults and stable warnings for invalid lock policy environment values', async () => {
    const paths = await workspace();
    const names = {
      timeout: 'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_TIMEOUT_MS',
      retry: 'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_RETRY_MS',
      stale: 'STORY_GENERATION_ATTEMPT_AUDIT_LOCK_STALE_MS',
    } as const;
    const previous = Object.fromEntries(Object.values(names).map(name => [name, process.env[name]]));
    try {
      process.env[names.timeout] = 'PRIVATE_TIMEOUT_VALUE';
      process.env[names.retry] = '0';
      process.env[names.stale] = '9';

      const activity = await inspectStoryGenerationActivity(paths);

      expect(activity.attempt_audit_readiness).toMatchObject({
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
      });
      expect(JSON.stringify(activity)).not.toContain('PRIVATE_TIMEOUT_VALUE');
    } finally {
      for (const name of Object.values(names)) {
        if (previous[name] === undefined) delete process.env[name];
        else process.env[name] = previous[name];
      }
    }
  });

  it('blocks permissive audit directory, ledger and archive modes with Web-parity actions', async () => {
    for (const target of ['directory', 'ledger', 'archive'] as const) {
      const paths = await workspace();
      const systemRoot = path.join(paths.generatedRoot, 'system');
      const ledgerPath = path.join(systemRoot, 'story-generation-attempts.jsonl');
      await fs.mkdir(systemRoot, { recursive: true, mode: 0o700 });
      await fs.chmod(systemRoot, target === 'directory' ? 0o755 : 0o700);
      if (target !== 'directory') {
        const targetPath = target === 'ledger' ? ledgerPath : `${ledgerPath}.1`;
        await fs.writeFile(targetPath, `${JSON.stringify(event({}))}\n`, { mode: 0o644 });
        await fs.chmod(targetPath, 0o644);
      }

      const activity = await inspectStoryGenerationActivity(paths);

      expect(activity.attempt_audit_readiness).toMatchObject({
        status: 'blocked',
        permission_policy: 'owner_only',
        permission_policy_satisfied: false,
        blockers: target === 'directory'
          ? ['audit_directory_permissions_unsafe']
          : target === 'ledger'
            ? ['ledger_permissions_unsafe']
            : ['archive_permissions_unsafe'],
        operator_actions: target === 'directory'
          ? ['review_audit_directory_permissions_after_backup']
          : target === 'ledger'
            ? ['review_ledger_permissions_after_backup']
            : ['review_archive_permissions_after_backup'],
      });
    }
  });
});
