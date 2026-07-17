import type {
  StoryProjectRepositoryConfigInfo,
} from '@shared/types.js';
import { resolve } from 'node:path';
import {
  FileProjectRepository,
  type ProjectRepository,
} from '../repositories/project-repository.js';
import {
  isNodeSqliteRuntimeAvailable,
  SqliteProjectRepository,
} from '../repositories/sqlite-project-repository.js';

const PROVIDER_ENV = 'STORY_PROJECT_REPOSITORY_PROVIDER';
const SQLITE_PATH_ENV = 'STORY_PROJECT_SQLITE_PATH';
const FILE_PROVIDER = 'file';
const SQLITE_PROVIDER = 'sqlite';

function configuredProvider(): string {
  return process.env[PROVIDER_ENV]?.trim().toLowerCase() || FILE_PROVIDER;
}

export class StoryProjectRepositoryProviderConfigurationError extends Error {
  constructor(provider: string) {
    super(`Unsupported Story project repository provider "${provider}"; supported providers: file, sqlite`);
    this.name = 'StoryProjectRepositoryProviderConfigurationError';
  }
}

export function getStoryProjectRepositoryConfigInfo(): StoryProjectRepositoryConfigInfo {
  const configured = configuredProvider();
  const known = configured === FILE_PROVIDER || configured === SQLITE_PROVIDER;
  const sqlite = configured === SQLITE_PROVIDER;
  const sqliteRuntimeAvailable = isNodeSqliteRuntimeAvailable();
  const valid = known && (!sqlite || sqliteRuntimeAvailable);
  return {
    env: PROVIDER_ENV,
    sqlite_path_env: SQLITE_PATH_ENV,
    configured_provider: configured,
    active_provider: valid ? configured : null,
    supported_providers: [FILE_PROVIDER, SQLITE_PROVIDER],
    configuration_valid: valid,
    database_kind: sqlite ? 'embedded_sqlite' : 'none',
    sqlite_runtime_available: sqliteRuntimeAvailable,
    sqlite_runtime_requirement: 'Node runtime with node:sqlite support; loaded only when sqlite is selected',
    external_database: false,
    object_storage: false,
    same_host_atomic_locking: true,
    transactional_multi_record_writes: true,
    optimistic_concurrency_control: true,
    content_integrity_hashes: sqlite && sqliteRuntimeAvailable,
    local_backup_verification_supported: sqlite && sqliteRuntimeAvailable,
    production_recovery_drill_completed: false,
    production_persistence_ready: false,
    warnings: [
      ...(configured === FILE_PROVIDER
        ? ['当前 Story project repository 为本机文件 provider；不代表外部数据库、对象存储或生产部署就绪。']
        : sqlite && sqliteRuntimeAvailable
          ? ['当前 Story project repository 为本机嵌入式 SQLite provider；本地事务与备份校验不代表外部数据库、对象存储、真实断电演练或生产部署就绪。']
          : sqlite
            ? ['当前 Node 运行时不提供 node:sqlite；SQLite provider 配置无效，项目读写将 fail closed。']
            : [`${PROVIDER_ENV}=${configured} 未实现；项目读写将 fail closed。`]),
    ],
    next_actions: [
      '生产部署前实现并验收外部数据库/对象存储 provider、迁移兼容、备份恢复和故障演练。',
    ],
    generated_at: new Date().toISOString(),
  };
}

export function createStoryProjectRepository(root: string): ProjectRepository {
  const provider = configuredProvider();
  if (provider === FILE_PROVIDER) {
    return new FileProjectRepository(root);
  }
  if (provider === SQLITE_PROVIDER) {
    if (!isNodeSqliteRuntimeAvailable()) {
      throw new StoryProjectRepositoryProviderConfigurationError(
        `${provider} (current Node runtime does not provide node:sqlite)`,
      );
    }
    const databasePath = process.env[SQLITE_PATH_ENV]?.trim()
      || resolve(root, '..', 'story-projects.sqlite3');
    return new SqliteProjectRepository(databasePath);
  }
  throw new StoryProjectRepositoryProviderConfigurationError(provider);
}
