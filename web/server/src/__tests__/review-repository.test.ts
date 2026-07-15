import { hostname, tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  FileReviewRepository,
  ReviewRepositoryConflictError,
  ReviewRepositoryPathError,
  ReviewRepositoryStateError,
} from '../repositories/review-repository.js';

interface TestReviewItem {
  review_id: string;
  status: 'open' | 'resolved';
  note?: string;
}

function normalizeTestReviewItem(value: unknown): TestReviewItem | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.review_id !== 'string'
    || (record.status !== 'open' && record.status !== 'resolved')
  ) return undefined;
  return {
    review_id: record.review_id,
    status: record.status,
    note: typeof record.note === 'string' ? record.note : undefined,
  };
}

function repository(
  root: string,
  faultInjector?: (point: 'after_temp_fsync') => void,
): FileReviewRepository<TestReviewItem> {
  return new FileReviewRepository(root, 'review-state.json', {
    schema_version: 'test-review-state/v1',
    normalize_item: normalizeTestReviewItem,
    item_id: item => item.review_id,
    fault_injector: faultInjector,
  });
}

describe('FileReviewRepository', () => {
  it('reads a missing repository without creating runtime state', async () => {
    const parent = await mkdtemp(resolve(tmpdir(), 'story-agent-review-missing-'));
    const root = resolve(parent, 'not-created');
    try {
      expect(repository(root).read()).toEqual({ revision: null, items: [] });
      expect(await readdir(parent)).toEqual([]);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it('atomically writes sorted review state and returns an exact-byte revision', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-review-write-'));
    try {
      const store = repository(root);
      const written = store.replace([
        { review_id: 'review-b', status: 'open' },
        { review_id: 'review-a', status: 'resolved', note: 'done' },
      ], {
        expected_revision: null,
        updated_at: '2026-07-15T06:00:00.000Z',
        static_fields: { human_review_credit_granted: false },
      });

      expect(written.items.map(item => item.review_id)).toEqual(['review-a', 'review-b']);
      expect(written.revision).toMatch(/^[a-f0-9]{64}$/);
      expect(store.read()).toEqual(written);
      const document = JSON.parse(await readFile(resolve(root, 'review-state.json'), 'utf8'));
      expect(document).toMatchObject({
        schema_version: 'test-review-state/v1',
        updated_at: '2026-07-15T06:00:00.000Z',
        human_review_credit_granted: false,
      });
      expect((await readdir(root)).some(name => name.includes('.tmp') || name.endsWith('.lock'))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects a stale revision so the winning reviewer state is preserved', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-review-cas-'));
    try {
      const store = repository(root);
      const initial = store.replace([{ review_id: 'review-a', status: 'open' }], {
        expected_revision: null,
        updated_at: '2026-07-15T06:01:00.000Z',
      });
      const winner = store.replace([{ review_id: 'review-a', status: 'resolved', note: 'winner' }], {
        expected_revision: initial.revision,
        updated_at: '2026-07-15T06:02:00.000Z',
      });

      expect(() => store.replace([{ review_id: 'review-a', status: 'open', note: 'stale' }], {
        expected_revision: initial.revision,
        updated_at: '2026-07-15T06:03:00.000Z',
      })).toThrow(ReviewRepositoryConflictError);
      expect(store.read()).toEqual(winner);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('preserves the prior document if publication stops after temp-file fsync', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-review-atomic-'));
    try {
      const stable = repository(root);
      const initial = stable.replace([{ review_id: 'review-a', status: 'open' }], {
        expected_revision: null,
        updated_at: '2026-07-15T06:04:00.000Z',
      });
      const failing = repository(root, () => {
        throw new Error('injected-after-temp-fsync');
      });
      expect(() => failing.replace([{ review_id: 'review-a', status: 'resolved' }], {
        expected_revision: initial.revision,
        updated_at: '2026-07-15T06:05:00.000Z',
      })).toThrow('injected-after-temp-fsync');
      expect(stable.read()).toEqual(initial);
      expect((await readdir(root)).some(name => name.includes('.tmp') || name.endsWith('.lock'))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails closed on symlink roots and state targets without changing outside files', async () => {
    const parent = await mkdtemp(resolve(tmpdir(), 'story-agent-review-path-'));
    const outside = await mkdtemp(resolve(tmpdir(), 'story-agent-review-outside-'));
    try {
      const outsideFile = resolve(outside, 'outside.json');
      await writeFile(outsideFile, 'preserve-me');
      const linkedRoot = resolve(parent, 'linked-root');
      await symlink(outside, linkedRoot);
      expect(() => repository(linkedRoot).read()).toThrow(ReviewRepositoryPathError);

      const root = resolve(parent, 'regular-root');
      const store = repository(root);
      store.replace([], { expected_revision: null, updated_at: '2026-07-15T06:06:00.000Z' });
      await rm(resolve(root, 'review-state.json'));
      await symlink(outsideFile, resolve(root, 'review-state.json'));
      expect(() => store.read()).toThrow(ReviewRepositoryPathError);
      expect(await readFile(outsideFile, 'utf8')).toBe('preserve-me');
    } finally {
      await rm(parent, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('rejects malformed documents and duplicate item ids instead of dropping evidence', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-review-invalid-'));
    try {
      const store = repository(root);
      await writeFile(resolve(root, 'review-state.json'), '{broken-json');
      expect(() => store.read()).toThrow(ReviewRepositoryStateError);
      await writeFile(resolve(root, 'review-state.json'), JSON.stringify({
        schema_version: 'test-review-state/v1',
        items: [{ review_id: 'bad', status: 'unknown' }],
      }));
      expect(() => store.read()).toThrow(ReviewRepositoryStateError);
      await rm(resolve(root, 'review-state.json'));
      expect(() => store.replace([
        { review_id: 'duplicate', status: 'open' },
        { review_id: 'duplicate', status: 'resolved' },
      ], { expected_revision: null, updated_at: '2026-07-15T06:07:00.000Z' }))
        .toThrow(ReviewRepositoryStateError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('preserves an external lock and archives only a definitely dead same-host owner', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-agent-review-lock-'));
    try {
      const store = repository(root);
      const initial = store.replace([], {
        expected_revision: null,
        updated_at: '2026-07-15T06:08:00.000Z',
      });
      const lockPath = resolve(root, '.review-state.json.review-repository.lock');
      await writeFile(lockPath, 'external-reviewer-lock');
      expect(() => store.replace([], {
        expected_revision: initial.revision,
        updated_at: '2026-07-15T06:09:00.000Z',
      })).toThrow(ReviewRepositoryConflictError);
      expect(await readFile(lockPath, 'utf8')).toBe('external-reviewer-lock');

      await writeFile(lockPath, JSON.stringify({
        schema_version: 'story-agent-review-repository-lock/v1',
        owner_pid: 2_147_483_647,
        owner_host: hostname(),
        acquired_at: '2026-07-15T06:09:30.000Z',
        nonce: 'dead-owner',
      }));
      const recovered = store.replace([], {
        expected_revision: initial.revision,
        updated_at: '2026-07-15T06:10:00.000Z',
      });
      expect(recovered.updated_at).toBe('2026-07-15T06:10:00.000Z');
      expect((await readdir(root)).some(name => name.includes('.stale-owner-') && name.endsWith('.archive')))
        .toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
