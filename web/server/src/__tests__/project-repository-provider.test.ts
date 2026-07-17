import { afterEach, describe, expect, it } from 'vitest';
import {
  createStoryProjectRepository,
  getStoryProjectRepositoryConfigInfo,
  StoryProjectRepositoryProviderConfigurationError,
} from '../platform/project-repository-provider.js';
import { FileProjectRepository } from '../repositories/project-repository.js';
import {
  isNodeSqliteRuntimeAvailable,
  SqliteProjectRepository,
} from '../repositories/sqlite-project-repository.js';

const sqliteRuntimeAvailable = isNodeSqliteRuntimeAvailable();
const sqliteIt = sqliteRuntimeAvailable ? it : it.skip;

afterEach(() => {
  delete process.env.STORY_PROJECT_REPOSITORY_PROVIDER;
  delete process.env.STORY_PROJECT_SQLITE_PATH;
});

describe('story project repository provider boundary', () => {
  it('reports the default file provider without claiming production persistence', () => {
    const config = getStoryProjectRepositoryConfigInfo();

    expect(config).toMatchObject({
      configured_provider: 'file',
      active_provider: 'file',
      supported_providers: ['file', 'sqlite'],
      configuration_valid: true,
      database_kind: 'none',
      sqlite_runtime_available: sqliteRuntimeAvailable,
      external_database: false,
      object_storage: false,
      same_host_atomic_locking: true,
      transactional_multi_record_writes: true,
      optimistic_concurrency_control: true,
      content_integrity_hashes: false,
      local_backup_verification_supported: false,
      production_recovery_drill_completed: false,
      production_persistence_ready: false,
    });
    expect(config.warnings.join('\n')).toContain('不代表外部数据库');
    expect(createStoryProjectRepository('/private/tmp/story-project-provider-test')).toBeInstanceOf(
      FileProjectRepository,
    );
  });

  sqliteIt('selects the embedded SQLite provider without claiming external production storage', () => {
    process.env.STORY_PROJECT_REPOSITORY_PROVIDER = 'sqlite';
    process.env.STORY_PROJECT_SQLITE_PATH = '/private/tmp/story-project-provider-test.sqlite3';

    const config = getStoryProjectRepositoryConfigInfo();

    expect(config).toMatchObject({
      configured_provider: 'sqlite',
      active_provider: 'sqlite',
      supported_providers: ['file', 'sqlite'],
      configuration_valid: true,
      database_kind: 'embedded_sqlite',
      sqlite_runtime_available: true,
      sqlite_runtime_requirement: expect.stringContaining('loaded only when sqlite is selected'),
      external_database: false,
      object_storage: false,
      transactional_multi_record_writes: true,
      optimistic_concurrency_control: true,
      content_integrity_hashes: true,
      local_backup_verification_supported: true,
      production_recovery_drill_completed: false,
      production_persistence_ready: false,
    });
    expect(config.warnings.join('\n')).toContain('不代表外部数据库');
    expect(config.warnings.join('\n')).toContain('真实断电演练');
    expect(createStoryProjectRepository('/private/tmp/story-project-provider-root')).toBeInstanceOf(
      SqliteProjectRepository,
    );
  });

  it('fails closed for an unimplemented provider', () => {
    process.env.STORY_PROJECT_REPOSITORY_PROVIDER = 'postgres';

    const config = getStoryProjectRepositoryConfigInfo();

    expect(config).toMatchObject({
      configured_provider: 'postgres',
      active_provider: null,
      configuration_valid: false,
      production_persistence_ready: false,
    });
    expect(() => createStoryProjectRepository('/private/tmp/story-project-provider-test')).toThrow(
      StoryProjectRepositoryProviderConfigurationError,
    );
  });
});
