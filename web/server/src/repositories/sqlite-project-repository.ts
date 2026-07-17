import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type {
  StoryProjectMeta,
  StoryProjectVersionSnapshot,
} from '@shared/types.js';
import {
  canonicalProjectRepositoryLogicalState,
  InvalidProjectRepositoryIdentifierError,
  projectRepositoryLogicalSha256,
  ProjectRepositoryConflictError,
  type ProjectMetaExpectation,
  type ProjectRepository,
  type ProjectRepositoryLogicalState,
} from './project-repository.js';

const SCHEMA_VERSION = 'story-agent-sqlite-project-repository/v1';
const PROJECT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,240}$/;
const VERSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,280}$/;
const require = createRequire(import.meta.url);

type NodeSqliteModule = typeof import('node:sqlite');
let cachedNodeSqliteModule: NodeSqliteModule | undefined;

function loadNodeSqliteModule(): NodeSqliteModule {
  if (cachedNodeSqliteModule) return cachedNodeSqliteModule;
  try {
    cachedNodeSqliteModule = require('node:sqlite') as NodeSqliteModule;
    return cachedNodeSqliteModule;
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : '';
    throw new SqliteProjectRepositoryRuntimeError(
      `The sqlite Story project repository requires a Node runtime with node:sqlite support${detail}`,
    );
  }
}

export function isNodeSqliteRuntimeAvailable(): boolean {
  try {
    loadNodeSqliteModule();
    return true;
  } catch {
    return false;
  }
}

export class SqliteProjectRepositoryRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SqliteProjectRepositoryRuntimeError';
  }
}

interface StoredJsonRow {
  body: string;
  body_sha256: string;
}

interface StoredProjectMetaRow extends StoredJsonRow {
  project_id: string;
  current_version_id: string;
  version_count: number;
  updated_at: string;
}

interface StoredProjectVersionRow extends StoredJsonRow {
  project_id: string;
  version_id: string;
  created_at: string;
}

export interface SqliteProjectRepositoryInspection {
  schema_version: 'story-agent-sqlite-project-repository-inspection/v1';
  repository_schema_version: typeof SCHEMA_VERSION;
  integrity_check: 'ok';
  foreign_key_violation_count: 0;
  project_count: number;
  version_count: number;
  logical_sha256: string;
}

export interface SqliteProjectRepositoryBackupManifest {
  schema_version: 'story-agent-sqlite-project-repository-backup/v1';
  created_at: string;
  backup_sha256: string;
  project_count: number;
  version_count: number;
  logical_sha256: string;
  integrity_check: 'ok';
  foreign_key_violation_count: 0;
  source_unchanged: true;
  production_recovery_credit: false;
}

function validProjectId(projectId: string): boolean {
  return PROJECT_ID_PATTERN.test(projectId);
}

function validVersionId(projectId: string, versionId: string): boolean {
  return VERSION_ID_PATTERN.test(versionId) && versionId.startsWith(`${projectId}-v`);
}

function jsonSha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function bytesSha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseStoredJson<T>(row: StoredJsonRow, label: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.body);
  } catch {
    throw new ProjectRepositoryConflictError(`${label} contains invalid JSON`);
  }
  if (jsonSha256(parsed) !== row.body_sha256) {
    throw new ProjectRepositoryConflictError(`${label} failed its SHA-256 integrity check`);
  }
  return parsed as T;
}

function asMetaRow(value: unknown): StoredProjectMetaRow | undefined {
  return value as StoredProjectMetaRow | undefined;
}

function asVersionRow(value: unknown): StoredProjectVersionRow | undefined {
  return value as StoredProjectVersionRow | undefined;
}

export class SqliteProjectRepository implements ProjectRepository {
  readonly databasePath: string;

  constructor(databasePath: string) {
    if (!databasePath.trim() || databasePath === ':memory:') {
      throw new InvalidProjectRepositoryIdentifierError(
        'SQLite project repository requires a durable file path',
      );
    }
    this.databasePath = resolve(databasePath);
    mkdirSync(dirname(this.databasePath), { recursive: true });
    this.withDatabase(() => undefined);
  }

  async listProjectIds(): Promise<string[]> {
    return this.withDatabase(database => (
      database.prepare('SELECT project_id FROM project_meta ORDER BY project_id ASC')
        .all()
        .map(row => String((row as { project_id: unknown }).project_id))
    ));
  }

  async inspectCurrentStateReadOnly(projectId: string) {
    if (!validProjectId(projectId)) return { meta: null, snapshot: null };
    return this.withDatabase(database => {
      const metaRow = asMetaRow(database.prepare(`
        SELECT project_id, current_version_id, version_count, updated_at, body, body_sha256
        FROM project_meta
        WHERE project_id = ?
      `).get(projectId));
      if (!metaRow) return { meta: null, snapshot: null };
      const meta = parseStoredJson<StoryProjectMeta>(metaRow, `Project metadata "${projectId}"`);
      this.assertMetaIdentity(metaRow, meta);
      const versionRow = asVersionRow(database.prepare(`
        SELECT project_id, version_id, created_at, body, body_sha256
        FROM project_versions
        WHERE project_id = ? AND version_id = ?
      `).get(projectId, meta.current_version_id));
      if (!versionRow) return { meta, snapshot: null };
      const snapshot = parseStoredJson<StoryProjectVersionSnapshot>(
        versionRow,
        `Project version "${meta.current_version_id}"`,
      );
      this.assertSnapshotIdentity(projectId, meta.current_version_id, versionRow, snapshot);
      return { meta, snapshot };
    });
  }

  async readMeta(projectId: string): Promise<StoryProjectMeta | null> {
    if (!validProjectId(projectId)) return null;
    return this.withDatabase(database => {
      const row = asMetaRow(database.prepare(`
        SELECT project_id, current_version_id, version_count, updated_at, body, body_sha256
        FROM project_meta
        WHERE project_id = ?
      `).get(projectId));
      if (!row) return null;
      const meta = parseStoredJson<StoryProjectMeta>(row, `Project metadata "${projectId}"`);
      this.assertMetaIdentity(row, meta);
      return meta;
    });
  }

  async readVersion(
    projectId: string,
    versionId: string,
  ): Promise<StoryProjectVersionSnapshot | null> {
    if (!validProjectId(projectId) || !validVersionId(projectId, versionId)) return null;
    return this.withDatabase(database => {
      const row = asVersionRow(database.prepare(`
        SELECT project_id, version_id, created_at, body, body_sha256
        FROM project_versions
        WHERE project_id = ? AND version_id = ?
      `).get(projectId, versionId));
      if (!row) return null;
      const snapshot = parseStoredJson<StoryProjectVersionSnapshot>(
        row,
        `Project version "${versionId}"`,
      );
      this.assertSnapshotIdentity(projectId, versionId, row, snapshot);
      return snapshot;
    });
  }

  async readVersionSnapshots(projectId: string): Promise<StoryProjectVersionSnapshot[]> {
    if (!validProjectId(projectId)) return [];
    return this.withDatabase(database => {
      const rows = database.prepare(`
        SELECT project_id, version_id, created_at, body, body_sha256
        FROM project_versions
        WHERE project_id = ?
        ORDER BY created_at DESC, version_id ASC
      `).all(projectId) as unknown as StoredProjectVersionRow[];
      return rows.map(row => {
        const snapshot = parseStoredJson<StoryProjectVersionSnapshot>(
          row,
          `Project version "${row.version_id}"`,
        );
        this.assertSnapshotIdentity(projectId, row.version_id, row, snapshot);
        return snapshot;
      });
    });
  }

  async createInitial(
    meta: StoryProjectMeta,
    snapshot: StoryProjectVersionSnapshot,
  ): Promise<'created' | 'exists'> {
    this.assertMetaAndSnapshot(meta, snapshot);
    return this.withWriteTransaction(database => {
      const existing = database.prepare('SELECT 1 FROM project_meta WHERE project_id = ?')
        .get(meta.project_id);
      if (existing) return 'exists';

      this.insertMeta(database, meta);
      this.insertVersion(database, snapshot);
      return 'created';
    });
  }

  async commitVersion(
    meta: StoryProjectMeta,
    snapshot: StoryProjectVersionSnapshot,
    expected: ProjectMetaExpectation,
  ): Promise<void> {
    this.assertMetaAndSnapshot(meta, snapshot);
    this.assertUpdatedAtAdvance(meta, expected, 'version commit');
    this.withWriteTransaction(database => {
      this.assertExpectation(database, meta.project_id, expected, 'version commit');
      if (database.prepare(`
        SELECT 1 FROM project_versions WHERE project_id = ? AND version_id = ?
      `).get(meta.project_id, snapshot.version_id)) {
        throw new ProjectRepositoryConflictError(
          `Project version "${snapshot.version_id}" already exists`,
        );
      }
      this.insertVersion(database, snapshot);
      this.updateMeta(database, meta, expected);
    });
  }

  async writeMeta(meta: StoryProjectMeta, expected: ProjectMetaExpectation): Promise<void> {
    this.assertProjectId(meta.project_id);
    this.assertUpdatedAtAdvance(meta, expected, 'metadata write');
    this.withWriteTransaction(database => {
      this.assertExpectation(database, meta.project_id, expected, 'metadata write');
      this.updateMeta(database, meta, expected);
    });
  }

  async writeCurrentState(
    meta: StoryProjectMeta,
    snapshot: StoryProjectVersionSnapshot,
    expected: ProjectMetaExpectation,
  ): Promise<void> {
    this.assertMetaAndSnapshot(meta, snapshot);
    this.assertUpdatedAtAdvance(meta, expected, 'current-state write');
    this.withWriteTransaction(database => {
      this.assertExpectation(database, meta.project_id, expected, 'current-state write');
      const storedVersion = database.prepare(`
        SELECT 1 FROM project_versions WHERE project_id = ? AND version_id = ?
      `).get(meta.project_id, snapshot.version_id);
      if (!storedVersion) {
        throw new ProjectRepositoryConflictError(
          `Project "${meta.project_id}" current state is incomplete`,
        );
      }
      const body = JSON.stringify(snapshot);
      database.prepare(`
        UPDATE project_versions
        SET created_at = ?, body = ?, body_sha256 = ?
        WHERE project_id = ? AND version_id = ?
      `).run(
        snapshot.created_at,
        body,
        jsonSha256(snapshot),
        meta.project_id,
        snapshot.version_id,
      );
      this.updateMeta(database, meta, expected);
    });
  }

  async inspect(): Promise<SqliteProjectRepositoryInspection> {
    return this.withDatabase(database => this.inspectDatabase(database));
  }

  async createVerifiedBackup(
    destinationPath: string,
  ): Promise<SqliteProjectRepositoryBackupManifest> {
    const destination = resolve(destinationPath);
    if (destination === this.databasePath) {
      throw new ProjectRepositoryConflictError('SQLite backup destination must differ from its source');
    }
    if (existsSync(destination)) {
      throw new ProjectRepositoryConflictError(
        `SQLite backup destination "${destination}" already exists`,
      );
    }
    mkdirSync(dirname(destination), { recursive: true });

    const sourceInspection = await this.inspect();
    const source = this.openDatabase();
    try {
      source.exec('PRAGMA wal_checkpoint(FULL)');
      await loadNodeSqliteModule().backup(source, destination);
    } finally {
      source.close();
    }

    const restored = new SqliteProjectRepository(destination);
    const restoredInspection = await restored.inspect();
    if (
      restoredInspection.logical_sha256 !== sourceInspection.logical_sha256
      || restoredInspection.project_count !== sourceInspection.project_count
      || restoredInspection.version_count !== sourceInspection.version_count
    ) {
      throw new ProjectRepositoryConflictError(
        'SQLite backup verification did not reproduce the source repository',
      );
    }

    return {
      schema_version: 'story-agent-sqlite-project-repository-backup/v1',
      created_at: new Date().toISOString(),
      backup_sha256: bytesSha256(await readFile(destination)),
      project_count: restoredInspection.project_count,
      version_count: restoredInspection.version_count,
      logical_sha256: restoredInspection.logical_sha256,
      integrity_check: 'ok',
      foreign_key_violation_count: 0,
      source_unchanged: true,
      production_recovery_credit: false,
    };
  }

  async importLogicalStateIntoEmpty(
    input: ProjectRepositoryLogicalState,
  ): Promise<SqliteProjectRepositoryInspection> {
    const state = canonicalProjectRepositoryLogicalState(input);
    if (state.meta.length === 0 || state.versions.length === 0) {
      throw new ProjectRepositoryConflictError('SQLite migration source logical state cannot be empty');
    }
    const metaByProject = new Map(state.meta.map(meta => [meta.project_id, meta]));
    if (metaByProject.size !== state.meta.length) {
      throw new ProjectRepositoryConflictError('SQLite migration source contains duplicate project metadata');
    }
    const versionKeys = new Set<string>();
    for (const snapshot of state.versions) {
      const key = `${snapshot.project_id}\u0000${snapshot.version_id}`;
      if (versionKeys.has(key)) {
        throw new ProjectRepositoryConflictError('SQLite migration source contains duplicate project versions');
      }
      versionKeys.add(key);
      const meta = metaByProject.get(snapshot.project_id);
      if (!meta) {
        throw new ProjectRepositoryConflictError(
          `SQLite migration version "${snapshot.version_id}" has no project metadata`,
        );
      }
      this.assertSnapshotIdentity(snapshot.project_id, snapshot.version_id, {
        project_id: snapshot.project_id,
        version_id: snapshot.version_id,
        created_at: snapshot.created_at,
        body: JSON.stringify(snapshot),
        body_sha256: jsonSha256(snapshot),
      }, snapshot);
    }
    for (const meta of state.meta) {
      const versions = state.versions.filter(version => version.project_id === meta.project_id);
      if (
        versions.length !== meta.version_count
        || !versions.some(version => version.version_id === meta.current_version_id)
      ) {
        throw new ProjectRepositoryConflictError(
          `SQLite migration project "${meta.project_id}" history does not match its metadata`,
        );
      }
    }
    this.withWriteTransaction(database => {
      const counts = database.prepare(`
        SELECT
          (SELECT COUNT(*) FROM project_meta) AS project_count,
          (SELECT COUNT(*) FROM project_versions) AS version_count
      `).get() as { project_count: number; version_count: number };
      if (counts.project_count !== 0 || counts.version_count !== 0) {
        throw new ProjectRepositoryConflictError('SQLite migration destination must be empty');
      }
      for (const meta of state.meta) this.insertMeta(database, meta);
      for (const snapshot of state.versions) this.insertVersion(database, snapshot);
    });
    const inspection = await this.inspect();
    const sourceSha256 = projectRepositoryLogicalSha256(state);
    if (
      inspection.project_count !== state.meta.length
      || inspection.version_count !== state.versions.length
      || inspection.logical_sha256 !== sourceSha256
    ) {
      throw new ProjectRepositoryConflictError(
        'SQLite migration destination is not logically equivalent to its source',
      );
    }
    return inspection;
  }

  private withDatabase<T>(operation: (database: DatabaseSync) => T): T {
    const database = this.openDatabase();
    try {
      return operation(database);
    } finally {
      database.close();
    }
  }

  private withWriteTransaction<T>(operation: (database: DatabaseSync) => T): T {
    return this.withDatabase(database => {
      database.exec('BEGIN IMMEDIATE');
      try {
        const result = operation(database);
        database.exec('COMMIT');
        return result;
      } catch (error) {
        try {
          database.exec('ROLLBACK');
        } catch {
          // Preserve the original write error; closing the handle releases locks.
        }
        throw error;
      }
    });
  }

  private openDatabase(): DatabaseSync {
    const { DatabaseSync } = loadNodeSqliteModule();
    const database = new DatabaseSync(this.databasePath);
    database.exec('PRAGMA foreign_keys = ON');
    database.exec('PRAGMA journal_mode = WAL');
    database.exec('PRAGMA synchronous = FULL');
    database.exec('PRAGMA busy_timeout = 5000');
    database.exec(`
      CREATE TABLE IF NOT EXISTS repository_metadata (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        schema_version TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS project_meta (
        project_id TEXT PRIMARY KEY,
        current_version_id TEXT NOT NULL,
        version_count INTEGER NOT NULL CHECK (version_count >= 1),
        updated_at TEXT NOT NULL,
        body TEXT NOT NULL,
        body_sha256 TEXT NOT NULL CHECK (length(body_sha256) = 64)
      );
      CREATE TABLE IF NOT EXISTS project_versions (
        project_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        body TEXT NOT NULL,
        body_sha256 TEXT NOT NULL CHECK (length(body_sha256) = 64),
        PRIMARY KEY (project_id, version_id),
        FOREIGN KEY (project_id) REFERENCES project_meta(project_id) ON DELETE RESTRICT
      );
      CREATE INDEX IF NOT EXISTS project_versions_created_at
        ON project_versions(project_id, created_at DESC, version_id ASC);
    `);
    const schemaRow = database.prepare(
      'SELECT schema_version FROM repository_metadata WHERE singleton = 1',
    ).get() as { schema_version?: unknown } | undefined;
    if (!schemaRow) {
      database.prepare(`
        INSERT INTO repository_metadata(singleton, schema_version) VALUES (1, ?)
      `).run(SCHEMA_VERSION);
    } else if (schemaRow.schema_version !== SCHEMA_VERSION) {
      database.close();
      throw new ProjectRepositoryConflictError(
        `Unsupported SQLite project repository schema "${String(schemaRow.schema_version)}"`,
      );
    }
    return database;
  }

  private insertMeta(database: DatabaseSync, meta: StoryProjectMeta): void {
    const body = JSON.stringify(meta);
    database.prepare(`
      INSERT INTO project_meta(
        project_id, current_version_id, version_count, updated_at, body, body_sha256
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      meta.project_id,
      meta.current_version_id,
      meta.version_count,
      meta.updated_at,
      body,
      jsonSha256(meta),
    );
  }

  private insertVersion(database: DatabaseSync, snapshot: StoryProjectVersionSnapshot): void {
    const body = JSON.stringify(snapshot);
    database.prepare(`
      INSERT INTO project_versions(
        project_id, version_id, created_at, body, body_sha256
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      snapshot.project_id,
      snapshot.version_id,
      snapshot.created_at,
      body,
      jsonSha256(snapshot),
    );
  }

  private updateMeta(
    database: DatabaseSync,
    meta: StoryProjectMeta,
    expected: ProjectMetaExpectation,
  ): void {
    const body = JSON.stringify(meta);
    const result = database.prepare(`
      UPDATE project_meta
      SET current_version_id = ?, version_count = ?, updated_at = ?, body = ?, body_sha256 = ?
      WHERE project_id = ?
        AND current_version_id = ?
        AND version_count = ?
        AND updated_at = ?
    `).run(
      meta.current_version_id,
      meta.version_count,
      meta.updated_at,
      body,
      jsonSha256(meta),
      meta.project_id,
      expected.current_version_id,
      expected.version_count,
      expected.updated_at,
    );
    if (result.changes !== 1) {
      throw new ProjectRepositoryConflictError(
        `Project "${meta.project_id}" changed before repository write`,
      );
    }
  }

  private assertExpectation(
    database: DatabaseSync,
    projectId: string,
    expected: ProjectMetaExpectation,
    operation: string,
  ): void {
    const row = asMetaRow(database.prepare(`
      SELECT project_id, current_version_id, version_count, updated_at, body, body_sha256
      FROM project_meta WHERE project_id = ?
    `).get(projectId));
    if (!row) {
      throw new ProjectRepositoryConflictError(
        `Project "${projectId}" is missing before ${operation}`,
      );
    }
    const meta = parseStoredJson<StoryProjectMeta>(row, `Project metadata "${projectId}"`);
    this.assertMetaIdentity(row, meta);
    if (
      row.current_version_id !== expected.current_version_id
      || row.version_count !== expected.version_count
      || row.updated_at !== expected.updated_at
    ) {
      throw new ProjectRepositoryConflictError(
        `Project "${projectId}" changed before ${operation}`,
      );
    }
  }

  private assertMetaIdentity(row: StoredProjectMetaRow, meta: StoryProjectMeta): void {
    this.assertProjectId(row.project_id);
    if (
      meta.project_id !== row.project_id
      || meta.current_version_id !== row.current_version_id
      || meta.version_count !== row.version_count
      || meta.updated_at !== row.updated_at
      || !validVersionId(meta.project_id, meta.current_version_id)
    ) {
      throw new InvalidProjectRepositoryIdentifierError(
        'SQLite project metadata identity does not match its indexed columns',
      );
    }
  }

  private assertMetaAndSnapshot(
    meta: StoryProjectMeta,
    snapshot: StoryProjectVersionSnapshot,
  ): void {
    this.assertVersion(meta.project_id, snapshot.version_id);
    if (
      snapshot.project_id !== meta.project_id
      || meta.current_version_id !== snapshot.version_id
    ) {
      throw new InvalidProjectRepositoryIdentifierError(
        'Project metadata and snapshot identifiers do not match',
      );
    }
    this.assertSnapshotStoryIdentity(meta.project_id, snapshot.version_id, snapshot);
  }

  private assertSnapshotIdentity(
    projectId: string,
    versionId: string,
    row: StoredProjectVersionRow,
    snapshot: StoryProjectVersionSnapshot,
  ): void {
    this.assertVersion(projectId, versionId);
    if (
      row.project_id !== projectId
      || row.version_id !== versionId
      || snapshot.project_id !== projectId
      || snapshot.version_id !== versionId
      || snapshot.created_at !== row.created_at
    ) {
      throw new InvalidProjectRepositoryIdentifierError(
        'SQLite project version identity does not match its indexed columns',
      );
    }
    this.assertSnapshotStoryIdentity(projectId, versionId, snapshot);
  }

  private assertSnapshotStoryIdentity(
    projectId: string,
    versionId: string,
    snapshot: StoryProjectVersionSnapshot,
  ): void {
    if (!snapshot.story || typeof snapshot.story !== 'object' || Array.isArray(snapshot.story)) {
      throw new InvalidProjectRepositoryIdentifierError('Project version snapshot story is invalid');
    }
    if (
      (snapshot.story.project_id !== undefined && snapshot.story.project_id !== projectId)
      || (snapshot.story.current_version_id !== undefined
        && snapshot.story.current_version_id !== versionId)
    ) {
      throw new InvalidProjectRepositoryIdentifierError(
        'Project version snapshot story identifiers do not match their indexed columns',
      );
    }
  }

  private assertProjectId(projectId: string): void {
    if (!validProjectId(projectId)) {
      throw new InvalidProjectRepositoryIdentifierError(`Invalid project id "${projectId}"`);
    }
  }

  private assertVersion(projectId: string, versionId: string): void {
    this.assertProjectId(projectId);
    if (!validVersionId(projectId, versionId)) {
      throw new InvalidProjectRepositoryIdentifierError(`Invalid project version id "${versionId}"`);
    }
  }

  private assertUpdatedAtAdvance(
    meta: StoryProjectMeta,
    expected: ProjectMetaExpectation,
    operation: string,
  ): void {
    const next = Date.parse(meta.updated_at);
    const previous = Date.parse(expected.updated_at);
    if (!Number.isFinite(next) || !Number.isFinite(previous) || next <= previous) {
      throw new ProjectRepositoryConflictError(
        `Project "${meta.project_id}" ${operation} must advance updated_at`,
      );
    }
  }

  private inspectDatabase(database: DatabaseSync): SqliteProjectRepositoryInspection {
    const integrityRows = database.prepare('PRAGMA integrity_check').all() as Array<{
      integrity_check?: unknown;
    }>;
    if (integrityRows.length !== 1 || integrityRows[0]?.integrity_check !== 'ok') {
      throw new ProjectRepositoryConflictError('SQLite project repository integrity_check failed');
    }
    const foreignKeyRows = database.prepare('PRAGMA foreign_key_check').all();
    if (foreignKeyRows.length !== 0) {
      throw new ProjectRepositoryConflictError('SQLite project repository has foreign-key violations');
    }
    const metaRows = database.prepare(`
      SELECT project_id, current_version_id, version_count, updated_at, body, body_sha256
      FROM project_meta ORDER BY project_id ASC
    `).all() as unknown as StoredProjectMetaRow[];
    const versionRows = database.prepare(`
      SELECT project_id, version_id, created_at, body, body_sha256
      FROM project_versions ORDER BY project_id ASC, version_id ASC
    `).all() as unknown as StoredProjectVersionRow[];
    const logicalState = {
      meta: metaRows.map(row => {
        const meta = parseStoredJson<StoryProjectMeta>(row, `Project metadata "${row.project_id}"`);
        this.assertMetaIdentity(row, meta);
        return meta;
      }),
      versions: versionRows.map(row => {
        const snapshot = parseStoredJson<StoryProjectVersionSnapshot>(
          row,
          `Project version "${row.version_id}"`,
        );
        this.assertSnapshotIdentity(row.project_id, row.version_id, row, snapshot);
        return snapshot;
      }),
    };
    return {
      schema_version: 'story-agent-sqlite-project-repository-inspection/v1',
      repository_schema_version: SCHEMA_VERSION,
      integrity_check: 'ok',
      foreign_key_violation_count: 0,
      project_count: metaRows.length,
      version_count: versionRows.length,
      logical_sha256: projectRepositoryLogicalSha256(logicalState),
    };
  }
}
