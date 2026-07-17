import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { ProductAccessActor } from '@shared/product-access.js';
import type {
  StoryDomainSafetyMigrationRequest,
  StoryGenerateResult,
  StoryProjectVersionSnapshot,
} from '@shared/types.js';
import { afterEach, describe, expect, it } from 'vitest';
import { chinaCultureDomainPack } from '../domains/china-culture/domain-pack.js';
import {
  ORIGINAL_FICTION_ENTRY_NAME,
  originalFictionDomainPack,
} from '../domains/original-fiction/domain-pack.js';
import { createStoryProjectRepository } from '../platform/project-repository-provider.js';
import { FileProjectRepository } from '../repositories/project-repository.js';
import {
  getStoryDomainSafetyMigrationAuditReport,
  migrateStoryDomainSafety,
  storyDomainSafetyMigrationStorySha256,
} from '../services/story-domain-safety-migration-service.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const ENV_NAMES = [
  'KB_ROOT',
  'WEB_GENERATED_ROOT',
  'STORY_PROJECT_REPOSITORY_PROVIDER',
  'STORY_PROJECT_SQLITE_PATH',
  'STORY_AGENT_DOMAIN_SAFETY_MIGRATION_WRITE_ENABLED',
  'STORY_AGENT_DOMAIN_SAFETY_MIGRATION_AUDIT_JSONL',
] as const;
const ORIGINAL_ENV = Object.fromEntries(ENV_NAMES.map(name => [name, process.env[name]]));

const ADMIN: ProductAccessActor = {
  actor_id: 'migration-admin',
  display_name: 'Migration Admin',
  organization_id: 'migration-test',
  role: 'administrator',
  enabled_feature_flags: ['internal_story_tools'],
};

afterEach(() => {
  for (const name of ENV_NAMES) {
    const value = ORIGINAL_ENV[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

async function createLegacyProject(
  root: string,
  sourceEntry?: string,
  provider: 'file' | 'sqlite' = 'file',
  domain: 'china_culture' | 'original_fiction' = 'china_culture',
) {
  const sourceRoot = resolve(root, 'source');
  const targetRoot = resolve(root, 'target');
  process.env.KB_ROOT = resolve(REPO_ROOT, 'data');
  process.env.WEB_GENERATED_ROOT = sourceRoot;
  process.env.STORY_PROJECT_REPOSITORY_PROVIDER = 'file';
  const generated = domain === 'china_culture'
    ? await chinaCultureDomainPack.generateStory({
        entry_name: '周敦颐——理学开山鼻祖',
        video_type: 'character_story',
        presentation_style: 'cinematic',
        outline: '周敦颐在疑案前坚持核对案卷与证词，在服从命令和守住判断之间作出选择并承担后果。',
        original_user_query: '生成一个用于 legacy domain safety 迁移测试的文化人物故事。',
        output_gears_segments: true,
      })
    : await originalFictionDomainPack.generateStory({
        entry_name: ORIGINAL_FICTION_ENTRY_NAME,
        video_type: 'character_story',
        presentation_style: 'cinematic',
        truth_mode: 'fictional_original',
        outline: '林岚修复即将被收走的放映机。债主要求她当天交出工作室。她发现父亲留下的未完成胶片。她决定完成首映并承担债务。',
        original_user_query: '生成一个用于原创领域 legacy safety 迁移测试的故事。',
        output_gears_segments: true,
      });
  expect(generated.ok).toBe(true);
  const sourceStory = generated.data!;
  const sourceRepository = new FileProjectRepository(resolve(sourceRoot, 'projects'));
  const sourceMeta = await sourceRepository.readMeta(sourceStory.project_id!);
  const sourceSnapshot = await sourceRepository.readVersion(
    sourceStory.project_id!,
    sourceStory.current_version_id!,
  );
  expect(sourceMeta).not.toBeNull();
  expect(sourceSnapshot).not.toBeNull();

  const {
    domain_safety: _domainSafety,
    domain_safety_migration: _migration,
    sourceDomain: _sourceDomain,
    ...legacyFields
  } = sourceSnapshot!.story;
  const legacyStory: StoryGenerateResult = {
    ...legacyFields,
    source_entry: sourceEntry ?? legacyFields.source_entry,
  };
  const legacySnapshot: StoryProjectVersionSnapshot = {
    ...sourceSnapshot!,
    story: legacyStory,
  };
  process.env.WEB_GENERATED_ROOT = targetRoot;
  process.env.STORY_PROJECT_REPOSITORY_PROVIDER = provider;
  if (provider === 'sqlite') {
    process.env.STORY_PROJECT_SQLITE_PATH = resolve(targetRoot, 'story-projects.sqlite3');
  } else {
    delete process.env.STORY_PROJECT_SQLITE_PATH;
  }
  const targetRepository = createStoryProjectRepository(resolve(targetRoot, 'projects'));
  expect(await targetRepository.createInitial(sourceMeta!, legacySnapshot)).toBe('created');
  return {
    targetRoot,
    projectId: sourceMeta!.project_id,
    versionId: sourceMeta!.current_version_id,
    repository: targetRepository,
    legacyStory,
    sourceDomain: sourceMeta!.source_domain,
  };
}

function requestFor(input: {
  projectId: string;
  versionId: string;
  story: StoryGenerateResult;
  sourceDomain?: string;
  dryRun?: boolean;
}): StoryDomainSafetyMigrationRequest {
  return {
    schema_version: 'story-domain-safety-migration-request/v1',
    migration_id: 'domain-safety-migration-0001',
    project_id: input.projectId,
    expected_current_version_id: input.versionId,
    expected_story_sha256: storyDomainSafetyMigrationStorySha256(input.story),
    expected_source_domain: input.sourceDomain ?? 'china_culture',
    expected_source_entry: input.story.source_entry,
    review_reference: 'OPS-DOMAIN-SAFETY-MIGRATION-0001',
    operator_confirmation: 'migration_scope_reviewed',
    dry_run: input.dryRun ?? true,
  };
}

describe('story domain safety migration service', () => {
  it.each([
    { provider: 'file', domain: 'china_culture' },
    { provider: 'sqlite', domain: 'china_culture' },
    { provider: 'file', domain: 'original_fiction' },
  ] as const)('audits $domain legacy candidates and appends a non-overwriting version with $provider', async ({ provider, domain }) => {
    const root = await mkdtemp(resolve(tmpdir(), `story-domain-safety-migration-${domain}-${provider}-`));
    try {
      const fixture = await createLegacyProject(root, undefined, provider, domain);
      const audit = await getStoryDomainSafetyMigrationAuditReport();
      expect(audit).toMatchObject({
        read_only: true,
        repository_provider: provider,
        discovered_project_count: 1,
        migration_candidate_count: 1,
        writeback_performed: false,
        automatic_source_assignment: false,
        history_overwrite_performed: false,
        human_review_complete: false,
        real_credit_granted: false,
      });
      expect(audit.items[0]).toMatchObject({
        project_id: fixture.projectId,
        current_version_id: fixture.versionId,
        domain_resolution: 'project_metadata',
        source_domain: domain,
        status: 'migration_candidate',
        requires_explicit_apply: true,
        evaluated_safety: {
          domain,
          passed: true,
          machine_validation_only: true,
          human_review_complete: false,
          real_credit_granted: false,
        },
      });

      const request = requestFor({
        projectId: fixture.projectId,
        versionId: fixture.versionId,
        story: fixture.legacyStory,
        sourceDomain: fixture.sourceDomain,
      });
      const dryRun = await migrateStoryDomainSafety({ request, actor: ADMIN });
      expect(dryRun).toMatchObject({
        dry_run: true,
        write_enabled: false,
        status_before: 'migration_candidate',
        blockers: [],
        preflight_ready: true,
        applied: false,
        history_overwrite_performed: false,
        real_credit_granted: false,
      });
      expect(await fixture.repository.readVersionSnapshots(fixture.projectId)).toHaveLength(1);

      const hashConflict = await migrateStoryDomainSafety({
        request: { ...request, expected_story_sha256: '0'.repeat(64) },
        actor: ADMIN,
      });
      expect(hashConflict.blockers).toContain('story_sha256_conflict');
      expect(await fixture.repository.readVersionSnapshots(fixture.projectId)).toHaveLength(1);

      const writeDisabled = await migrateStoryDomainSafety({
        request: { ...request, dry_run: false },
        actor: ADMIN,
      });
      expect(writeDisabled.blockers).toContain('domain_safety_migration_write_disabled');
      expect(writeDisabled.applied).toBe(false);

      const auditDirectory = resolve(fixture.targetRoot, 'audit');
      await mkdir(auditDirectory, { recursive: true });
      const auditPath = resolve(auditDirectory, 'domain-safety-migrations.jsonl');
      process.env.STORY_AGENT_DOMAIN_SAFETY_MIGRATION_WRITE_ENABLED = 'true';
      process.env.STORY_AGENT_DOMAIN_SAFETY_MIGRATION_AUDIT_JSONL = auditPath;
      const applied = await migrateStoryDomainSafety({
        request: { ...request, dry_run: false },
        actor: ADMIN,
      });
      expect(applied).toMatchObject({
        blockers: [],
        preflight_ready: true,
        applied: true,
        idempotent_replay: false,
        durable_intent_written: true,
        durable_completion_written: true,
      });

      const versions = await fixture.repository.readVersionSnapshots(fixture.projectId);
      expect(versions).toHaveLength(2);
      expect(versions.map(version => version.change_type)).toEqual([
        'domain_safety_migration',
        'initial_generation',
      ]);
      const original = await fixture.repository.readVersion(fixture.projectId, fixture.versionId);
      expect(original?.story.domain_safety).toBeUndefined();
      const currentMeta = await fixture.repository.readMeta(fixture.projectId);
      const migrated = await fixture.repository.readVersion(fixture.projectId, currentMeta!.current_version_id);
      expect(migrated?.story).toMatchObject({
        sourceDomain: domain,
        domain_safety: {
          passed: true,
          machine_validation_only: true,
          human_review_complete: false,
          real_credit_granted: false,
        },
        domain_safety_migration: {
          migration_id: request.migration_id,
          previous_version_id: fixture.versionId,
          previous_story_sha256: request.expected_story_sha256,
          source_identity_confirmed_by_operator: true,
          history_overwrite_performed: false,
          human_review_complete: false,
          real_credit_granted: false,
        },
      });
      const events = (await readFile(auditPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
      expect(events.map(event => event.phase)).toEqual(['intent', 'applied']);
      expect(events.every(event => event.history_overwrite_performed === false)).toBe(true);
      expect(events.every(event => event.real_credit_granted === false)).toBe(true);

      const replay = await migrateStoryDomainSafety({
        request: { ...request, dry_run: false },
        actor: ADMIN,
      });
      expect(replay).toMatchObject({
        status_before: 'migrated',
        blockers: [],
        applied: false,
        idempotent_replay: true,
      });
      expect(await fixture.repository.readVersionSnapshots(fixture.projectId)).toHaveLength(2);
      expect((await readFile(auditPath, 'utf8')).trim().split('\n')).toHaveLength(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('keeps a legacy project blocked when its explicitly confirmed source cannot be loaded', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-domain-safety-source-block-'));
    try {
      const fixture = await createLegacyProject(root, '不存在的迁移来源条目');
      const audit = await getStoryDomainSafetyMigrationAuditReport();
      expect(audit).toMatchObject({
        discovered_project_count: 1,
        migration_candidate_count: 0,
        blocked_count: 1,
      });
      expect(audit.items[0]).toMatchObject({
        status: 'blocked',
        blockers: ['domain_safety:DOMAIN-REVISION-SOURCE-ENTRY'],
        evaluated_safety: {
          passed: false,
          machine_validation_only: true,
          human_review_complete: false,
          real_credit_granted: false,
        },
      });
      const result = await migrateStoryDomainSafety({
        request: requestFor({
          projectId: fixture.projectId,
          versionId: fixture.versionId,
          story: fixture.legacyStory,
        }),
        actor: ADMIN,
      });
      expect(result.preflight_ready).toBe(false);
      expect(result.applied).toBe(false);
      expect(await fixture.repository.readVersionSnapshots(fixture.projectId)).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not recover or rewrite a pending file-repository transaction during read-only inventory', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'story-domain-safety-read-only-'));
    try {
      const fixture = await createLegacyProject(root);
      const meta = await fixture.repository.readMeta(fixture.projectId);
      const snapshot = await fixture.repository.readVersion(fixture.projectId, fixture.versionId);
      const metaPath = resolve(fixture.targetRoot, 'projects', fixture.projectId, 'project.json');
      const metaBefore = await readFile(metaPath, 'utf8');
      const nextVersionId = `${fixture.projectId}-v2`;
      const nextCreatedAt = new Date(Date.parse(meta!.updated_at) + 1).toISOString();
      const faulty = new FileProjectRepository(resolve(fixture.targetRoot, 'projects'), {
        faultInjector(point) {
          if (point === 'after_snapshot') throw new Error('injected pending transaction');
        },
      });
      await expect(faulty.commitVersion({
        ...meta!,
        current_version_id: nextVersionId,
        version_count: 2,
        updated_at: nextCreatedAt,
      }, {
        ...snapshot!,
        version_id: nextVersionId,
        created_at: nextCreatedAt,
        change_type: 'quality_repair',
        story: { ...snapshot!.story, current_version_id: nextVersionId },
      }, {
        current_version_id: meta!.current_version_id,
        version_count: meta!.version_count,
        updated_at: meta!.updated_at,
      })).rejects.toThrow('injected pending transaction');

      const transactionsPath = resolve(
        fixture.targetRoot,
        'projects',
        fixture.projectId,
        '.transactions',
      );
      const transactionsBefore = await readdir(transactionsPath);
      expect(transactionsBefore.some(name => name.endsWith('.intent.json'))).toBe(true);

      const audit = await getStoryDomainSafetyMigrationAuditReport();
      expect(audit.items[0]).toMatchObject({
        current_version_id: fixture.versionId,
        status: 'migration_candidate',
      });
      expect(await readFile(metaPath, 'utf8')).toBe(metaBefore);
      expect(await readdir(transactionsPath)).toEqual(transactionsBefore);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
