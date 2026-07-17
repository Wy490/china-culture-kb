import { createHash } from 'node:crypto';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  StoryStorageLegacySourceStatus,
} from '@shared/types.js';
import { getStoryStorageLegacyDispositionPreflight } from '../services/story-storage-legacy-disposition-service.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

async function tempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), prefix));
  roots.push(root);
  return root;
}

function ownership() {
  return {
    schema_version: 'story-agent-product-resource-ownership/v1',
    organization_id: 'org-1',
    owner_actor_id: 'owner-1',
    member_actor_ids: [],
  };
}

function metadata(params: {
  projectId: string;
  storyId?: string;
  sourceEntry?: string;
  title?: string;
  videoType?: string;
  accessControl?: unknown;
}) {
  return {
    project_id: params.projectId,
    current_story_id: params.storyId ?? `${params.projectId}-story`,
    title: params.title ?? 'Legacy project',
    source_domain: 'china_culture',
    source_entry: params.sourceEntry ?? 'Known entry',
    video_type: params.videoType ?? 'character_story',
    presentation_style: 'cinematic',
    story_structure: 'single_event_drama',
    status: 'draft',
    current_version_id: `${params.projectId}-v1`,
    version_count: 1,
    scene_count: 3,
    has_gears_segments: true,
    access_control: params.accessControl,
  };
}

async function writeProjectMetadata(
  generatedRoot: string,
  projectId: string,
  value: unknown,
): Promise<string> {
  const projectRoot = resolve(generatedRoot, 'projects', projectId);
  await mkdir(projectRoot, { recursive: true });
  await writeFile(resolve(projectRoot, 'project.json'), `${JSON.stringify(value, null, 2)}\n`);
  return projectRoot;
}

async function snapshotTree(root: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  async function visit(path: string, relativePath: string): Promise<void> {
    const entryStat = await lstat(path);
    if (entryStat.isSymbolicLink()) {
      rows.push({ path: relativePath, type: 'symlink', mtime_ms: entryStat.mtimeMs });
      return;
    }
    if (entryStat.isDirectory()) {
      rows.push({ path: relativePath, type: 'directory', mtime_ms: entryStat.mtimeMs });
      for (const name of (await readdir(path)).sort()) {
        await visit(resolve(path, name), relativePath ? `${relativePath}/${name}` : name);
      }
      return;
    }
    const bytes = await readFile(path);
    rows.push({
      path: relativePath,
      type: 'file',
      mtime_ms: entryStat.mtimeMs,
      size: entryStat.size,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  await visit(root, '');
  return rows;
}

const resolvedSource = async (): Promise<StoryStorageLegacySourceStatus> => 'resolved';

describe('legacy generated-root disposition preflight', () => {
  it('classifies each legacy directory, detects collisions, and performs zero writes', async () => {
    const root = await tempRoot('story-storage-disposition-');
    const activeRoot = resolve(root, 'active');
    const legacyRoot = resolve(root, 'legacy');
    await mkdir(resolve(activeRoot, 'projects'), { recursive: true });
    await mkdir(resolve(legacyRoot, 'projects', 'empty-project'), { recursive: true });

    await writeProjectMetadata(activeRoot, 'active-fingerprint', metadata({
      projectId: 'active-fingerprint',
      storyId: 'shared-story',
      title: 'Shared title',
      accessControl: ownership(),
    }));
    await writeProjectMetadata(activeRoot, 'active-id', metadata({
      projectId: 'active-id',
      storyId: 'active-id-story',
      sourceEntry: 'Other entry',
      title: 'Other title',
      videoType: 'ai_comic_drama',
      accessControl: ownership(),
    }));

    const equivalentA = metadata({
      projectId: 'legacy-a',
      storyId: 'shared-story',
      title: 'Shared title',
      accessControl: ownership(),
    });
    const equivalentB = metadata({
      projectId: 'legacy-b',
      storyId: 'shared-story',
      title: 'Shared title',
      accessControl: ownership(),
    });
    await writeProjectMetadata(legacyRoot, 'legacy-a', equivalentA);
    await writeProjectMetadata(legacyRoot, 'legacy-b', equivalentB);

    const completeRoot = await writeProjectMetadata(legacyRoot, 'active-id', metadata({
      projectId: 'active-id',
      storyId: 'legacy-complete-story',
      sourceEntry: 'Complete entry',
      title: 'Complete title',
      videoType: 'knowledge_explainer',
      accessControl: ownership(),
    }));
    await mkdir(resolve(completeRoot, 'versions'));
    await writeFile(resolve(completeRoot, 'versions', 'active-id-v1.json'), '{}\n');

    const invalidRoot = resolve(legacyRoot, 'projects', 'invalid-json');
    await mkdir(invalidRoot, { recursive: true });
    await writeFile(resolve(invalidRoot, 'project.json'), '{invalid');

    const before = await snapshotTree(root);
    const report = await getStoryStorageLegacyDispositionPreflight({
      activeGeneratedRoot: activeRoot,
      legacyGeneratedRoot: legacyRoot,
      resolveSource: resolvedSource,
    });
    const after = await snapshotTree(root);

    expect(after).toEqual(before);
    expect(report).toMatchObject({
      schema_version: 'story-storage-legacy-disposition-preflight/v1',
      read_only: true,
      preflight_complete: true,
      global_blockers: [],
      consistent_snapshot_guaranteed: false,
      recheck_required_before_any_action: true,
      legacy_directory_count: 5,
      empty_directory_count: 1,
      metadata_file_count: 4,
      valid_metadata_count: 3,
      invalid_metadata_count: 1,
      complete_history_count: 1,
      metadata_without_history_count: 2,
      active_project_id_collision_count: 1,
      active_story_id_collision_count: 2,
      active_metadata_fingerprint_collision_count: 2,
      active_same_source_title_candidate_count: 2,
      legacy_equivalent_metadata_item_count: 2,
      legacy_equivalent_metadata_group_count: 1,
      source_resolved_count: 3,
      ownership_valid_count: 3,
      blocked_item_count: 5,
      human_review_required_count: 5,
      automatic_action_count: 0,
      migration_performed: false,
      merge_performed: false,
      deletion_performed: false,
      overwrite_performed: false,
      writeback_performed: false,
      domain_safety_migration_performed: false,
      provider_switched: false,
      real_gears_seedance_delivery_credit_count: 0,
      counts_as_real_gears_seedance_delivery: false,
    });
    expect(report.inventory_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.items.every(item => (
      item.requires_human_review
      && !item.automatic_duplicate_inference
      && !item.automatic_action_allowed
      && !item.migration_planned
      && !item.merge_planned
      && !item.deletion_planned
      && !item.writeback_performed
      && !item.real_credit_granted
    ))).toBe(true);

    const complete = report.items.find(item => item.legacy_project_id === 'active-id');
    expect(complete).toMatchObject({
      structure_status: 'complete_history',
      active_project_id_collision: true,
      requires_human_review: true,
      automatic_action_allowed: false,
    });
    const legacyA = report.items.find(item => item.legacy_project_id === 'legacy-a');
    expect(legacyA?.active_story_id_collision_project_ids).toEqual(['active-fingerprint']);
    expect(legacyA?.active_metadata_fingerprint_collision_project_ids).toEqual(['active-fingerprint']);
    expect(legacyA?.active_same_source_title_candidate_project_ids).toEqual(['active-fingerprint']);
    expect(legacyA?.legacy_equivalent_metadata_project_ids).toEqual(['legacy-b']);
    expect(legacyA?.blockers).toEqual(expect.arrayContaining([
      'active_story_id_collision',
      'active_metadata_fingerprint_collision',
      'active_same_source_title_requires_human_comparison',
      'legacy_metadata_equivalent_group_requires_human_comparison',
      'versions_directory_missing',
      'current_version_snapshot_missing',
      'human_disposition_required',
    ]));
  });

  it('does not follow legacy project or metadata symlinks', async () => {
    const root = await tempRoot('story-storage-disposition-symlink-');
    const activeRoot = resolve(root, 'active');
    const legacyRoot = resolve(root, 'legacy');
    const outsideRoot = resolve(root, 'outside');
    await mkdir(resolve(activeRoot, 'projects'), { recursive: true });
    await mkdir(resolve(legacyRoot, 'projects'), { recursive: true });
    await mkdir(outsideRoot, { recursive: true });
    await writeFile(resolve(outsideRoot, 'project.json'), JSON.stringify(metadata({
      projectId: 'outside',
      accessControl: ownership(),
    })));
    await symlink(outsideRoot, resolve(activeRoot, 'projects', 'active-project-link'), 'dir');
    await symlink(outsideRoot, resolve(legacyRoot, 'projects', 'project-link'), 'dir');
    const metadataLinkRoot = resolve(legacyRoot, 'projects', 'metadata-link');
    await mkdir(metadataLinkRoot);
    await symlink(resolve(outsideRoot, 'project.json'), resolve(metadataLinkRoot, 'project.json'));

    const before = await snapshotTree(root);
    const report = await getStoryStorageLegacyDispositionPreflight({
      activeGeneratedRoot: activeRoot,
      legacyGeneratedRoot: legacyRoot,
      resolveSource: resolvedSource,
    });

    expect(await snapshotTree(root)).toEqual(before);
    expect(report.preflight_complete).toBe(false);
    expect(report.global_blockers).toContain('active_project_entry_unsupported');
    expect(report.items.find(item => item.legacy_project_id === 'project-link')).toMatchObject({
      structure_status: 'unsupported_directory',
      metadata_file_present: false,
      automatic_action_allowed: false,
    });
    expect(report.items.find(item => item.legacy_project_id === 'metadata-link')).toMatchObject({
      structure_status: 'invalid_metadata',
      metadata_file_present: true,
      metadata_file_regular: false,
      automatic_action_allowed: false,
    });
  });

  it('fails closed for relative, identical, overlapping, and unreadable active roots', async () => {
    const root = await tempRoot('story-storage-disposition-roots-');
    const legacyRoot = resolve(root, 'legacy');
    await mkdir(resolve(legacyRoot, 'projects'), { recursive: true });

    const relativeReport = await getStoryStorageLegacyDispositionPreflight({
      activeGeneratedRoot: 'relative-active',
      legacyGeneratedRoot: 'relative-legacy',
    });
    expect(relativeReport.preflight_complete).toBe(false);
    expect(relativeReport.global_blockers).toEqual(expect.arrayContaining([
      'active_root_not_absolute',
      'legacy_root_not_absolute',
    ]));

    const identicalReport = await getStoryStorageLegacyDispositionPreflight({
      activeGeneratedRoot: legacyRoot,
      legacyGeneratedRoot: legacyRoot,
    });
    expect(identicalReport.global_blockers).toContain('active_and_legacy_roots_identical');

    const overlapReport = await getStoryStorageLegacyDispositionPreflight({
      activeGeneratedRoot: root,
      legacyGeneratedRoot: legacyRoot,
    });
    expect(overlapReport.global_blockers).toContain('active_and_legacy_roots_overlap');

    const missingActiveReport = await getStoryStorageLegacyDispositionPreflight({
      activeGeneratedRoot: resolve(root, 'missing-active'),
      legacyGeneratedRoot: legacyRoot,
    });
    expect(missingActiveReport.preflight_complete).toBe(false);
    expect(missingActiveReport.global_blockers).toContain('active_projects_root_unreadable');
  });

  it('keeps source and ownership uncertainty explicit and inventory hashes deterministic', async () => {
    const root = await tempRoot('story-storage-disposition-source-');
    const activeRoot = resolve(root, 'active');
    const legacyRoot = resolve(root, 'legacy');
    await mkdir(resolve(activeRoot, 'projects'), { recursive: true });
    await writeProjectMetadata(legacyRoot, 'source-unavailable', metadata({
      projectId: 'source-unavailable',
      sourceEntry: 'Unavailable entry',
      accessControl: {},
    }));
    const resolveSource = async (): Promise<StoryStorageLegacySourceStatus> => 'unavailable';

    const first = await getStoryStorageLegacyDispositionPreflight({
      activeGeneratedRoot: activeRoot,
      legacyGeneratedRoot: legacyRoot,
      resolveSource,
    });
    const second = await getStoryStorageLegacyDispositionPreflight({
      activeGeneratedRoot: activeRoot,
      legacyGeneratedRoot: legacyRoot,
      resolveSource,
    });

    expect(first.inventory_sha256).toBe(second.inventory_sha256);
    expect(first.items[0]).toMatchObject({
      source_status: 'unavailable',
      ownership_status: 'invalid',
      requires_human_review: true,
      automatic_action_allowed: false,
    });
    expect(first.items[0]?.blockers).toEqual(expect.arrayContaining([
      'source_unavailable',
      'ownership_invalid',
    ]));
  });

  it('rejects unsafe current version identifiers without probing outside the versions directory', async () => {
    const root = await tempRoot('story-storage-disposition-version-path-');
    const activeRoot = resolve(root, 'active');
    const legacyRoot = resolve(root, 'legacy');
    await mkdir(resolve(activeRoot, 'projects'), { recursive: true });
    const projectRoot = await writeProjectMetadata(legacyRoot, 'unsafe-version', {
      ...metadata({ projectId: 'unsafe-version', accessControl: ownership() }),
      current_version_id: '../../escape-probe',
    });
    await mkdir(resolve(projectRoot, 'versions'));
    await writeFile(resolve(legacyRoot, 'projects', 'escape-probe.json'), '{}\n');

    const before = await snapshotTree(root);
    const report = await getStoryStorageLegacyDispositionPreflight({
      activeGeneratedRoot: activeRoot,
      legacyGeneratedRoot: legacyRoot,
      resolveSource: resolvedSource,
    });

    expect(await snapshotTree(root)).toEqual(before);
    expect(report.items[0]).toMatchObject({
      metadata_identity_valid: false,
      current_version_file_present: false,
      automatic_action_allowed: false,
    });
    expect(report.items[0]?.blockers).toContain('current_version_id_unsafe');
  });
});
