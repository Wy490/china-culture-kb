import { mkdtemp, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertStoryStorageRootConfiguration,
  getStoryStorageRootConfigInfo,
  storyDefaultGeneratedRoot,
  storyDefaultKbRoot,
  storyGeneratedRoot,
  storyKbRoot,
  storyLegacyMisresolvedGeneratedRoot,
} from '../platform/story-storage-root.js';

const ORIGINAL_ENV = {
  KB_ROOT: process.env.KB_ROOT,
  WEB_GENERATED_ROOT: process.env.WEB_GENERATED_ROOT,
  NODE_ENV: process.env.NODE_ENV,
};

function restoreEnv(name: keyof typeof ORIGINAL_ENV): void {
  const value = ORIGINAL_ENV[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  vi.unstubAllEnvs();
  restoreEnv('KB_ROOT');
  restoreEnv('WEB_GENERATED_ROOT');
  restoreEnv('NODE_ENV');
});

describe('Story storage root configuration boundary', () => {
  it('resolves direct imports to repository /data and /web/generated defaults', () => {
    delete process.env.KB_ROOT;
    delete process.env.WEB_GENERATED_ROOT;
    process.env.NODE_ENV = 'test';

    expect(storyKbRoot()).toBe(storyDefaultKbRoot());
    expect(storyGeneratedRoot()).toBe(storyDefaultGeneratedRoot());
    expect(storyGeneratedRoot()).not.toBe(storyLegacyMisresolvedGeneratedRoot());
    expect(storyGeneratedRoot()).not.toContain('/web/web/generated');
  });

  it('honors explicit absolute, disjoint roots', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-storage-root-explicit-'));
    process.env.KB_ROOT = resolve(root, 'knowledge');
    process.env.WEB_GENERATED_ROOT = resolve(root, 'runtime', 'generated');
    process.env.NODE_ENV = 'production';

    expect(() => assertStoryStorageRootConfiguration()).not.toThrow();
    expect(storyKbRoot()).toBe(resolve(root, 'knowledge'));
    expect(storyGeneratedRoot()).toBe(resolve(root, 'runtime', 'generated'));
    const info = await getStoryStorageRootConfigInfo();
    expect(info).toMatchObject({
      schema_version: 'story-storage-root-config/v1',
      kb_root_source: 'explicit_env',
      generated_root_source: 'explicit_env',
      production_explicit_config_required: true,
      production_explicit_config_satisfied: true,
      configuration_valid: true,
      data_moved: false,
      data_deleted: false,
      data_overwritten: false,
      provider_switched: false,
      real_gears_seedance_delivery_credit_count: 0,
      counts_as_real_gears_seedance_delivery: false,
    });
  });

  it('rejects relative paths before any repository can use them', async () => {
    process.env.KB_ROOT = 'relative/data';
    process.env.WEB_GENERATED_ROOT = 'relative/generated';
    process.env.NODE_ENV = 'test';

    expect(() => storyKbRoot()).toThrow(/KB_ROOT must be an absolute path/);
    expect(() => storyGeneratedRoot()).toThrow(/absolute path/);
    const info = await getStoryStorageRootConfigInfo();
    expect(info.configuration_valid).toBe(false);
    expect(info.blockers).toEqual(expect.arrayContaining([
      'KB_ROOT must be an absolute path',
      'WEB_GENERATED_ROOT must be an absolute path',
    ]));
  });

  it.each([
    { kbRoot: storyDefaultKbRoot(), generatedRoot: undefined, missing: 'WEB_GENERATED_ROOT' },
    { kbRoot: undefined, generatedRoot: storyDefaultGeneratedRoot(), missing: 'KB_ROOT' },
  ])('fails production startup when $missing is only default-derived', ({ kbRoot, generatedRoot }) => {
    if (kbRoot === undefined) delete process.env.KB_ROOT;
    else process.env.KB_ROOT = kbRoot;
    if (generatedRoot === undefined) delete process.env.WEB_GENERATED_ROOT;
    else process.env.WEB_GENERATED_ROOT = generatedRoot;
    process.env.NODE_ENV = 'production';

    expect(() => assertStoryStorageRootConfiguration()).toThrow(
      /production requires explicit absolute KB_ROOT and WEB_GENERATED_ROOT/,
    );
  });

  it('rejects overlapping knowledge and generated roots', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-storage-root-overlap-'));
    process.env.KB_ROOT = root;
    process.env.WEB_GENERATED_ROOT = resolve(root, 'generated');
    process.env.NODE_ENV = 'test';

    expect(() => storyGeneratedRoot()).toThrow(/must be disjoint/);
    const info = await getStoryStorageRootConfigInfo();
    expect(info.roots_disjoint).toBe(false);
    expect(info.configuration_valid).toBe(false);
  });

  it('audits the legacy root without adding it to active reads or mutating it', async () => {
    const activeRoot = await mkdtemp(resolve(tmpdir(), 'story-storage-root-audit-'));
    const legacyRoot = storyLegacyMisresolvedGeneratedRoot();
    const beforeNames = await readdir(legacyRoot);
    const beforeMtime = (await stat(legacyRoot)).mtimeMs;
    process.env.KB_ROOT = storyDefaultKbRoot();
    process.env.WEB_GENERATED_ROOT = activeRoot;
    process.env.NODE_ENV = 'test';

    const info = await getStoryStorageRootConfigInfo();
    const afterNames = await readdir(legacyRoot);
    const afterMtime = (await stat(legacyRoot)).mtimeMs;

    expect(info.inventory.active.root).toBe(activeRoot);
    expect(info.inventory.legacy_misresolved.root).toBe(legacyRoot);
    expect(info.inventory.legacy_misresolved.exists).toBe(true);
    expect(info.inventory.legacy_misresolved.project_count).toBeGreaterThan(0);
    expect(info.legacy_policy).toEqual({
      discovery_only: true,
      included_in_active_read_roots: false,
      automatic_migration_allowed: false,
      automatic_merge_allowed: false,
      automatic_delete_allowed: false,
      automatic_writeback_allowed: false,
    });
    expect(afterNames.sort()).toEqual(beforeNames.sort());
    expect(afterMtime).toBe(beforeMtime);
  });
});
