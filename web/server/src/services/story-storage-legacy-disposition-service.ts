import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { ErrorCodes } from '@shared/types.js';
import type { ProductResourceOwnership } from '@shared/product-access.js';
import type {
  StoryStorageLegacyDispositionItem,
  StoryStorageLegacyDispositionPreflight,
  StoryStorageLegacyOwnershipStatus,
  StoryStorageLegacySourceStatus,
} from '@shared/types.js';
import { storyAgentDomainRegistry } from '../platform/domain-registry.js';
import {
  storyGeneratedRoot,
  storyLegacyMisresolvedGeneratedRoot,
} from '../platform/story-storage-root.js';

const MAX_METADATA_BYTES = 5 * 1024 * 1024;

type JsonRecord = Record<string, unknown>;

interface LegacyDispositionOptions {
  activeGeneratedRoot?: string;
  legacyGeneratedRoot?: string;
  resolveSource?: (domain: string, entry: string) => Promise<StoryStorageLegacySourceStatus>;
}

interface MetadataInspection {
  present: boolean;
  regular: boolean;
  sha256: string | null;
  record: JsonRecord | null;
  blocker?: string;
}

interface VersionInspection {
  directoryPresent: boolean;
  directoryUsable: boolean;
  fileCount: number;
  currentFilePresent: boolean;
  blockers: string[];
}

interface ActiveMetadataIndex {
  projectIds: Set<string>;
  storyIds: Map<string, string[]>;
  fingerprints: Map<string, string[]>;
  sourceTitles: Map<string, string[]>;
  unreadableCount: number;
  blockers: string[];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(record: JsonRecord | null, field: string): string | null {
  const value = record?.[field];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function integerField(record: JsonRecord | null, field: string): number | null {
  const value = record?.[field];
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function isSafePathSegment(value: string): boolean {
  return value !== '.'
    && value !== '..'
    && !value.includes('/')
    && !value.includes('\\')
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonicalize(value[key])]),
  );
}

function canonicalSha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function metadataSemanticFingerprint(record: JsonRecord | null): string | null {
  if (!record) return null;
  const fields = [
    'title',
    'source_domain',
    'source_entry',
    'video_type',
    'presentation_style',
    'story_structure',
    'status',
    'scene_count',
    'has_gears_segments',
    'credibility_note',
    'logline',
    'model_profile_id',
    'generation_source',
    'generation_mode',
    'generation_used_fallback',
    'quality_passed',
    'genre_score',
    'quality_issue_count',
    'open_supplement_task_count',
    'access_control',
  ];
  return canonicalSha256(Object.fromEntries(fields.map(field => [field, record[field] ?? null])));
}

function sourceTitleKey(record: JsonRecord | null): string | null {
  const domain = stringField(record, 'source_domain');
  const entry = stringField(record, 'source_entry');
  const title = stringField(record, 'title');
  return domain && entry && title ? `${domain}\u0000${entry}\u0000${title}` : null;
}

function addIndex(map: Map<string, string[]>, key: string | null, projectId: string): void {
  if (!key) return;
  const values = map.get(key) ?? [];
  values.push(projectId);
  map.set(key, values);
}

function isSameOrNested(parent: string, candidate: string): boolean {
  const relation = relative(parent, candidate);
  return relation === ''
    || (relation !== '..'
      && !relation.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
      && !isAbsolute(relation));
}

function ownershipStatus(value: unknown): StoryStorageLegacyOwnershipStatus {
  if (value === undefined || value === null) return 'missing';
  if (!isRecord(value)) return 'invalid';
  const candidate = value as Partial<ProductResourceOwnership>;
  return candidate.schema_version === 'story-agent-product-resource-ownership/v1'
    && typeof candidate.organization_id === 'string'
    && Boolean(candidate.organization_id.trim())
    && typeof candidate.owner_actor_id === 'string'
    && Boolean(candidate.owner_actor_id.trim())
    && Array.isArray(candidate.member_actor_ids)
    && candidate.member_actor_ids.every(item => typeof item === 'string' && item.trim())
    ? 'valid'
    : 'invalid';
}

async function inspectMetadata(projectRoot: string): Promise<MetadataInspection> {
  const filePath = resolve(projectRoot, 'project.json');
  try {
    const fileStat = await lstat(filePath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
      return {
        present: true,
        regular: false,
        sha256: null,
        record: null,
        blocker: 'project_metadata_not_regular_file',
      };
    }
    if (fileStat.size > MAX_METADATA_BYTES) {
      return {
        present: true,
        regular: true,
        sha256: null,
        record: null,
        blocker: 'project_metadata_size_limit_exceeded',
      };
    }
    const bytes = await readFile(filePath);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    let parsed: unknown;
    try {
      parsed = JSON.parse(bytes.toString('utf-8')) as unknown;
    } catch {
      return {
        present: true,
        regular: true,
        sha256,
        record: null,
        blocker: 'project_metadata_invalid_json',
      };
    }
    return isRecord(parsed)
      ? { present: true, regular: true, sha256, record: parsed }
      : {
        present: true,
        regular: true,
        sha256,
        record: null,
        blocker: 'project_metadata_not_object',
      };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : undefined;
    return code === 'ENOENT'
      ? { present: false, regular: false, sha256: null, record: null }
      : {
        present: true,
        regular: false,
        sha256: null,
        record: null,
        blocker: 'project_metadata_unreadable',
      };
  }
}

async function inspectVersions(
  projectRoot: string,
  currentVersionId: string | null,
): Promise<VersionInspection> {
  const versionsRoot = resolve(projectRoot, 'versions');
  try {
    const versionsStat = await lstat(versionsRoot);
    if (!versionsStat.isDirectory() || versionsStat.isSymbolicLink()) {
      return {
        directoryPresent: true,
        directoryUsable: false,
        fileCount: 0,
        currentFilePresent: false,
        blockers: ['versions_directory_not_regular_directory'],
      };
    }
    const entries = await readdir(versionsRoot, { withFileTypes: true });
    const fileCount = entries.filter(entry => entry.isFile() && entry.name.endsWith('.json')).length;
    let currentFilePresent = false;
    if (currentVersionId) {
      try {
        const currentStat = await lstat(resolve(versionsRoot, `${currentVersionId}.json`));
        currentFilePresent = currentStat.isFile() && !currentStat.isSymbolicLink();
      } catch {
        currentFilePresent = false;
      }
    }
    return {
      directoryPresent: true,
      directoryUsable: true,
      fileCount,
      currentFilePresent,
      blockers: [],
    };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : undefined;
    return {
      directoryPresent: code !== 'ENOENT',
      directoryUsable: false,
      fileCount: 0,
      currentFilePresent: false,
      blockers: code === 'ENOENT' ? [] : ['versions_directory_unreadable'],
    };
  }
}

async function defaultResolveSource(
  domain: string,
  entry: string,
): Promise<StoryStorageLegacySourceStatus> {
  let pack;
  try {
    pack = storyAgentDomainRegistry.require(domain);
  } catch {
    return 'domain_unregistered';
  }
  try {
    const result = await pack.getEntryDetail(entry);
    if (result.ok && result.data) return 'resolved';
    return result.error?.code === ErrorCodes.ENTRY_NOT_FOUND
      ? 'entry_not_found'
      : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

async function buildActiveIndex(activeProjectsRoot: string): Promise<ActiveMetadataIndex> {
  const result: ActiveMetadataIndex = {
    projectIds: new Set(),
    storyIds: new Map(),
    fingerprints: new Map(),
    sourceTitles: new Map(),
    unreadableCount: 0,
    blockers: [],
  };
  try {
    const rootStat = await lstat(activeProjectsRoot);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      result.blockers.push('active_projects_root_not_regular_directory');
      return result;
    }
  } catch {
    result.blockers.push('active_projects_root_unreadable');
    return result;
  }
  let entries;
  try {
    entries = await readdir(activeProjectsRoot, { withFileTypes: true });
  } catch {
    result.blockers.push('active_projects_root_unreadable');
    return result;
  }
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isSymbolicLink()) {
      result.blockers.push('active_project_entry_unsupported');
      continue;
    }
    if (!entry.isDirectory()) continue;
    const metadata = await inspectMetadata(resolve(activeProjectsRoot, entry.name));
    if (!metadata.record) {
      result.unreadableCount += 1;
      continue;
    }
    const declaredProjectId = stringField(metadata.record, 'project_id') ?? entry.name;
    result.projectIds.add(declaredProjectId);
    addIndex(result.storyIds, stringField(metadata.record, 'current_story_id'), declaredProjectId);
    addIndex(result.fingerprints, metadataSemanticFingerprint(metadata.record), declaredProjectId);
    addIndex(result.sourceTitles, sourceTitleKey(metadata.record), declaredProjectId);
  }
  return result;
}

async function inspectLegacyProject(params: {
  projectId: string;
  projectRoot: string;
  active: ActiveMetadataIndex;
  resolveSource: (domain: string, entry: string) => Promise<StoryStorageLegacySourceStatus>;
}): Promise<StoryStorageLegacyDispositionItem> {
  const blockers: string[] = [];
  let directoryEntryCount = 0;
  let directoryUsable = true;
  try {
    const projectStat = await lstat(params.projectRoot);
    if (!projectStat.isDirectory() || projectStat.isSymbolicLink()) {
      directoryUsable = false;
      blockers.push('legacy_project_directory_not_regular_directory');
    } else {
      directoryEntryCount = (await readdir(params.projectRoot)).length;
    }
  } catch {
    directoryUsable = false;
    blockers.push('legacy_project_directory_unreadable');
  }

  const metadata = directoryUsable
    ? await inspectMetadata(params.projectRoot)
    : { present: false, regular: false, sha256: null, record: null };
  if (metadata.blocker) blockers.push(metadata.blocker);
  if (!metadata.present) blockers.push('project_metadata_missing');

  const declaredProjectId = stringField(metadata.record, 'project_id');
  const declaredStoryId = stringField(metadata.record, 'current_story_id');
  const declaredCurrentVersionId = stringField(metadata.record, 'current_version_id');
  const currentVersionIdSafe = Boolean(
    declaredCurrentVersionId && isSafePathSegment(declaredCurrentVersionId),
  );
  const declaredVersionCount = integerField(metadata.record, 'version_count');
  const sourceDomain = stringField(metadata.record, 'source_domain');
  const sourceEntry = stringField(metadata.record, 'source_entry');
  const identityValid = Boolean(
    metadata.record
    && declaredProjectId === params.projectId
    && declaredStoryId
    && declaredCurrentVersionId
    && currentVersionIdSafe
    && declaredVersionCount !== null
    && declaredVersionCount > 0,
  );
  if (metadata.record && !identityValid) blockers.push('project_metadata_identity_invalid');
  if (declaredCurrentVersionId && !currentVersionIdSafe) {
    blockers.push('current_version_id_unsafe');
  }

  const versions: VersionInspection = directoryUsable
    ? await inspectVersions(
      params.projectRoot,
      currentVersionIdSafe ? declaredCurrentVersionId : null,
    )
    : {
      directoryPresent: false,
      directoryUsable: false,
      fileCount: 0,
      currentFilePresent: false,
      blockers: [],
    };
  blockers.push(...versions.blockers);
  if (!versions.directoryPresent) blockers.push('versions_directory_missing');
  if (declaredVersionCount !== null && versions.fileCount !== declaredVersionCount) {
    blockers.push('declared_version_count_mismatch');
  }
  if (declaredCurrentVersionId && currentVersionIdSafe && !versions.currentFilePresent) {
    blockers.push('current_version_snapshot_missing');
  }

  let sourceStatus: StoryStorageLegacySourceStatus = 'unavailable';
  if (!sourceDomain) blockers.push('source_domain_missing');
  if (!sourceEntry) blockers.push('source_entry_missing');
  if (sourceDomain && sourceEntry) {
    sourceStatus = await params.resolveSource(sourceDomain, sourceEntry);
    if (sourceStatus !== 'resolved') blockers.push(`source_${sourceStatus}`);
  }

  const ownership = ownershipStatus(metadata.record?.access_control);
  if (ownership === 'missing') blockers.push('ownership_missing');
  if (ownership === 'invalid') blockers.push('ownership_invalid');

  const fingerprint = metadataSemanticFingerprint(metadata.record);
  const activeProjectIdCollision = params.active.projectIds.has(params.projectId)
    || Boolean(declaredProjectId && params.active.projectIds.has(declaredProjectId));
  if (activeProjectIdCollision) blockers.push('active_project_id_collision');
  const activeStoryCollisions = declaredStoryId
    ? [...new Set(params.active.storyIds.get(declaredStoryId) ?? [])].sort()
    : [];
  if (activeStoryCollisions.length > 0) blockers.push('active_story_id_collision');
  const activeFingerprintCollisions = fingerprint
    ? [...new Set(params.active.fingerprints.get(fingerprint) ?? [])].sort()
    : [];
  if (activeFingerprintCollisions.length > 0) blockers.push('active_metadata_fingerprint_collision');
  const sameSourceTitleCandidates = metadata.record
    ? [...new Set(params.active.sourceTitles.get(sourceTitleKey(metadata.record) ?? '') ?? [])].sort()
    : [];
  if (sameSourceTitleCandidates.length > 0) blockers.push('active_same_source_title_requires_human_comparison');

  const completeHistory = Boolean(
    identityValid
    && versions.directoryUsable
    && declaredVersionCount === versions.fileCount
    && versions.currentFilePresent,
  );
  const structureStatus: StoryStorageLegacyDispositionItem['structure_status'] = !directoryUsable
    ? 'unsupported_directory'
    : directoryEntryCount === 0
      ? 'empty_directory'
      : !metadata.record
        ? metadata.present ? 'invalid_metadata' : 'unsupported_directory'
        : completeHistory ? 'complete_history' : 'metadata_without_history';
  if (structureStatus === 'empty_directory') blockers.push('empty_directory_requires_human_disposition');
  blockers.push('human_disposition_required');

  return {
    legacy_project_id: params.projectId,
    structure_status: structureStatus,
    directory_entry_count: directoryEntryCount,
    metadata_file_present: metadata.present,
    metadata_file_regular: metadata.regular,
    metadata_sha256: metadata.sha256,
    metadata_semantic_fingerprint_sha256: fingerprint,
    metadata_identity_valid: identityValid,
    declared_project_id: declaredProjectId,
    declared_story_id: declaredStoryId,
    declared_current_version_id: declaredCurrentVersionId,
    declared_version_count: declaredVersionCount,
    source_domain: sourceDomain,
    source_entry: sourceEntry,
    source_status: sourceStatus,
    ownership_status: ownership,
    versions_directory_present: versions.directoryPresent,
    version_file_count: versions.fileCount,
    current_version_file_present: versions.currentFilePresent,
    active_project_id_collision: activeProjectIdCollision,
    active_story_id_collision_project_ids: activeStoryCollisions,
    active_metadata_fingerprint_collision_project_ids: activeFingerprintCollisions,
    active_same_source_title_candidate_project_ids: sameSourceTitleCandidates,
    legacy_equivalent_metadata_project_ids: [],
    blockers: [...new Set(blockers)].sort(),
    requires_human_review: true,
    automatic_duplicate_inference: false,
    automatic_action_allowed: false,
    migration_planned: false,
    merge_planned: false,
    deletion_planned: false,
    writeback_performed: false,
    real_credit_granted: false,
  };
}

function emptyPreflight(params: {
  activeRoot: string;
  legacyRoot: string;
  blockers: string[];
}): StoryStorageLegacyDispositionPreflight {
  return {
    schema_version: 'story-storage-legacy-disposition-preflight/v1',
    generated_at: new Date().toISOString(),
    active_root: params.activeRoot,
    legacy_root: params.legacyRoot,
    read_only: true,
    preflight_complete: false,
    global_blockers: [...new Set(params.blockers)].sort(),
    consistent_snapshot_guaranteed: false,
    recheck_required_before_any_action: true,
    legacy_directory_count: 0,
    empty_directory_count: 0,
    metadata_file_count: 0,
    valid_metadata_count: 0,
    invalid_metadata_count: 0,
    complete_history_count: 0,
    metadata_without_history_count: 0,
    active_project_id_collision_count: 0,
    active_story_id_collision_count: 0,
    active_metadata_fingerprint_collision_count: 0,
    active_same_source_title_candidate_count: 0,
    legacy_equivalent_metadata_item_count: 0,
    legacy_equivalent_metadata_group_count: 0,
    source_resolved_count: 0,
    ownership_valid_count: 0,
    blocked_item_count: 0,
    human_review_required_count: 0,
    automatic_action_count: 0,
    inventory_sha256: canonicalSha256([]),
    items: [],
    migration_performed: false,
    merge_performed: false,
    deletion_performed: false,
    overwrite_performed: false,
    writeback_performed: false,
    domain_safety_migration_performed: false,
    provider_switched: false,
    real_gears_seedance_delivery_credit_count: 0,
    counts_as_real_gears_seedance_delivery: false,
  };
}

export async function getStoryStorageLegacyDispositionPreflight(
  options: LegacyDispositionOptions = {},
): Promise<StoryStorageLegacyDispositionPreflight> {
  const activeRoot = options.activeGeneratedRoot ?? storyGeneratedRoot();
  const legacyRoot = options.legacyGeneratedRoot ?? storyLegacyMisresolvedGeneratedRoot();
  const resolvedActiveRoot = isAbsolute(activeRoot) ? resolve(activeRoot) : activeRoot;
  const resolvedLegacyRoot = isAbsolute(legacyRoot) ? resolve(legacyRoot) : legacyRoot;
  const globalBlockers = [
    ...(!isAbsolute(activeRoot) ? ['active_root_not_absolute'] : []),
    ...(!isAbsolute(legacyRoot) ? ['legacy_root_not_absolute'] : []),
    ...(isAbsolute(activeRoot)
      && isAbsolute(legacyRoot)
      && resolvedActiveRoot === resolvedLegacyRoot
      ? ['active_and_legacy_roots_identical']
      : []),
    ...(isAbsolute(activeRoot)
      && isAbsolute(legacyRoot)
      && resolvedActiveRoot !== resolvedLegacyRoot
      && (isSameOrNested(resolvedActiveRoot, resolvedLegacyRoot)
        || isSameOrNested(resolvedLegacyRoot, resolvedActiveRoot))
      ? ['active_and_legacy_roots_overlap']
      : []),
  ];
  if (globalBlockers.length > 0) {
    return emptyPreflight({ activeRoot, legacyRoot, blockers: globalBlockers });
  }

  const active = await buildActiveIndex(resolve(activeRoot, 'projects'));
  globalBlockers.push(...active.blockers);
  if (active.unreadableCount > 0) globalBlockers.push('active_project_metadata_unreadable');
  let legacyEntries;
  try {
    legacyEntries = await readdir(resolve(legacyRoot, 'projects'), { withFileTypes: true });
  } catch {
    return emptyPreflight({
      activeRoot,
      legacyRoot,
      blockers: [...globalBlockers, 'legacy_projects_root_unreadable'],
    });
  }
  const projectNames = legacyEntries
    .filter(entry => entry.isDirectory() || entry.isSymbolicLink())
    .map(entry => entry.name)
    .sort();
  const resolveSource = options.resolveSource ?? defaultResolveSource;
  let items = await Promise.all(projectNames.map(projectId => inspectLegacyProject({
    projectId,
    projectRoot: resolve(legacyRoot, 'projects', projectId),
    active,
    resolveSource,
  })));

  const legacyFingerprints = new Map<string, string[]>();
  for (const item of items) {
    addIndex(legacyFingerprints, item.metadata_semantic_fingerprint_sha256, item.legacy_project_id);
  }
  items = items.map(item => {
    const equivalents = item.metadata_semantic_fingerprint_sha256
      ? (legacyFingerprints.get(item.metadata_semantic_fingerprint_sha256) ?? [])
        .filter(projectId => projectId !== item.legacy_project_id)
        .sort()
      : [];
    return equivalents.length === 0 ? item : {
      ...item,
      legacy_equivalent_metadata_project_ids: equivalents,
      blockers: [...new Set([
        ...item.blockers,
        'legacy_metadata_equivalent_group_requires_human_comparison',
      ])].sort(),
    };
  });

  const count = (predicate: (item: StoryStorageLegacyDispositionItem) => boolean) => (
    items.filter(predicate).length
  );
  const equivalentGroups = new Set(
    items
      .filter(item => item.legacy_equivalent_metadata_project_ids.length > 0)
      .map(item => item.metadata_semantic_fingerprint_sha256)
      .filter((value): value is string => Boolean(value)),
  );
  return {
    schema_version: 'story-storage-legacy-disposition-preflight/v1',
    generated_at: new Date().toISOString(),
    active_root: activeRoot,
    legacy_root: legacyRoot,
    read_only: true,
    preflight_complete: globalBlockers.length === 0,
    global_blockers: [...new Set(globalBlockers)].sort(),
    consistent_snapshot_guaranteed: false,
    recheck_required_before_any_action: true,
    legacy_directory_count: items.length,
    empty_directory_count: count(item => item.structure_status === 'empty_directory'),
    metadata_file_count: count(item => item.metadata_file_present),
    valid_metadata_count: count(item => item.metadata_identity_valid),
    invalid_metadata_count: count(item => item.metadata_file_present && !item.metadata_identity_valid),
    complete_history_count: count(item => item.structure_status === 'complete_history'),
    metadata_without_history_count: count(item => item.structure_status === 'metadata_without_history'),
    active_project_id_collision_count: count(item => item.active_project_id_collision),
    active_story_id_collision_count: count(item => item.active_story_id_collision_project_ids.length > 0),
    active_metadata_fingerprint_collision_count: count(
      item => item.active_metadata_fingerprint_collision_project_ids.length > 0,
    ),
    active_same_source_title_candidate_count: count(
      item => item.active_same_source_title_candidate_project_ids.length > 0,
    ),
    legacy_equivalent_metadata_item_count: count(
      item => item.legacy_equivalent_metadata_project_ids.length > 0,
    ),
    legacy_equivalent_metadata_group_count: equivalentGroups.size,
    source_resolved_count: count(item => item.source_status === 'resolved'),
    ownership_valid_count: count(item => item.ownership_status === 'valid'),
    blocked_item_count: count(item => item.blockers.length > 0),
    human_review_required_count: items.length,
    automatic_action_count: 0,
    inventory_sha256: canonicalSha256(items),
    items,
    migration_performed: false,
    merge_performed: false,
    deletion_performed: false,
    overwrite_performed: false,
    writeback_performed: false,
    domain_safety_migration_performed: false,
    provider_switched: false,
    real_gears_seedance_delivery_credit_count: 0,
    counts_as_real_gears_seedance_delivery: false,
  };
}
