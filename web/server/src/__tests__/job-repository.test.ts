import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FileJobRepository,
  JobRepositoryConflictError,
  JobRepositoryPathError,
  JobRepositoryStateError,
} from '../repositories/job-repository.js';

interface TestJobEvent {
  event_id: string;
  status: 'failed';
  message: string;
}

function normalizeTestJobEvent(value: unknown): TestJobEvent | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.event_id !== 'string'
    || record.status !== 'failed'
    || typeof record.message !== 'string'
  ) return undefined;
  return { event_id: record.event_id, status: 'failed', message: record.message };
}

function repository(
  root: string,
  options: {
    faultInjector?: (point: 'after_temp_fsync') => void;
    lockRetryDelaysMs?: readonly number[];
    maxBytes?: number;
  } = {},
): FileJobRepository<TestJobEvent> {
  return new FileJobRepository(root, 'failures.jsonl', {
    normalize_item: normalizeTestJobEvent,
    item_id: item => item.event_id,
    fault_injector: options.faultInjector,
    lock_retry_delays_ms: options.lockRetryDelaysMs,
    max_bytes: options.maxBytes,
  });
}

function event(eventId: string, message = eventId): TestJobEvent {
  return { event_id: eventId, status: 'failed', message };
}

describe('FileJobRepository', () => {
  it('reads a missing log without creating its runtime directory', async () => {
    const parent = await mkdtemp(resolve(tmpdir(), 'story-agent-job-missing-'));
    const root = resolve(parent, 'not-created');
    try {
      expect(await repository(root).read()).toEqual({ revision: null, byte_size: 0, items: [] });
      expect(await readdir(parent)).toEqual([]);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it('appends immutable JSONL events and returns duplicate for an exact idempotent replay', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-job-append-'));
    try {
      const store = repository(root);
      const first = await store.append(event('event-a'));
      const duplicate = await store.append(event('event-a'));
      expect(first.status).toBe('appended');
      expect(duplicate).toMatchObject({ status: 'duplicate', revision: first.revision, byte_size: first.byte_size });
      expect(await store.read()).toEqual({
        revision: first.revision,
        byte_size: first.byte_size,
        items: [event('event-a')],
      });
      expect((await readFile(resolve(root, 'failures.jsonl'), 'utf8')).split('\n').filter(Boolean)).toHaveLength(1);
      expect((await readdir(root)).some(name => name.includes('.tmp') || name.endsWith('.lock'))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('serializes concurrent distinct appends without losing an event', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-job-concurrent-'));
    try {
      const store = repository(root);
      const results = await Promise.all(['a', 'b', 'c', 'd'].map(id => store.append(event(`event-${id}`))));
      expect(results.every(result => result.status === 'appended')).toBe(true);
      expect((await store.read()).items.map(item => item.event_id).sort())
        .toEqual(['event-a', 'event-b', 'event-c', 'event-d']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects conflicting content that reuses an existing idempotency key', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-job-conflict-'));
    try {
      const store = repository(root);
      await store.append(event('event-a', 'winner'));
      await expect(store.append(event('event-a', 'conflicting replay')))
        .rejects.toBeInstanceOf(JobRepositoryConflictError);
      expect((await store.read()).items).toEqual([event('event-a', 'winner')]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('keeps the old log intact when publication stops after temp-file fsync', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-job-atomic-'));
    try {
      const stable = repository(root);
      const first = await stable.append(event('event-a'));
      const failing = repository(root, {
        faultInjector() {
          throw new Error('injected-after-temp-fsync');
        },
      });
      await expect(failing.append(event('event-b'))).rejects.toThrow('injected-after-temp-fsync');
      expect(await stable.read()).toEqual({
        revision: first.revision,
        byte_size: first.byte_size,
        items: [event('event-a')],
      });
      expect((await readdir(root)).some(name => name.includes('.tmp') || name.endsWith('.lock'))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails closed on partial JSONL, symlink roots and symlink log targets', async () => {
    const parent = await mkdtemp(resolve(tmpdir(), 'story-agent-job-path-'));
    const outside = await mkdtemp(resolve(tmpdir(), 'story-agent-job-outside-'));
    try {
      const root = resolve(parent, 'root');
      await writeFile(resolve(parent, 'partial-source'), '{"event_id":"partial"}');
      await symlink(outside, root);
      await expect(repository(root).read()).rejects.toBeInstanceOf(JobRepositoryPathError);
      await rm(root);
      const store = repository(root);
      await store.append(event('event-a'));
      await writeFile(resolve(root, 'failures.jsonl'), '{"event_id":"partial"}');
      await expect(store.read()).rejects.toBeInstanceOf(JobRepositoryStateError);

      const outsideFile = resolve(outside, 'preserve.log');
      await writeFile(outsideFile, 'preserve-me');
      await rm(resolve(root, 'failures.jsonl'));
      await symlink(outsideFile, resolve(root, 'failures.jsonl'));
      await expect(store.read()).rejects.toBeInstanceOf(JobRepositoryPathError);
      expect(await readFile(outsideFile, 'utf8')).toBe('preserve-me');
    } finally {
      await rm(parent, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('preserves an external writer lock and archives only a definitely dead same-host owner', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-job-lock-'));
    try {
      const store = repository(root, { lockRetryDelaysMs: [0] });
      await store.append(event('event-a'));
      const lockPath = resolve(root, '.failures.jsonl.job-repository.lock');
      await writeFile(lockPath, 'external-job-writer');
      await expect(store.append(event('event-b'))).rejects.toBeInstanceOf(JobRepositoryConflictError);
      expect(await readFile(lockPath, 'utf8')).toBe('external-job-writer');

      await writeFile(lockPath, JSON.stringify({
        schema_version: 'story-agent-job-repository-lock/v1',
        owner_pid: 2_147_483_647,
        owner_host: hostname(),
        acquired_at: '2026-07-15T06:20:00.000Z',
        nonce: 'dead-owner',
      }));
      expect((await store.append(event('event-b'))).status).toBe('appended');
      expect((await readdir(root)).some(name => name.includes('.stale-owner-') && name.endsWith('.archive')))
        .toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
