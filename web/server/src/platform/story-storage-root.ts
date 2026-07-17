import { lstat, readdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import type {
  StoryStorageRootConfigInfo,
  StoryStorageRootInventory,
} from '@shared/types.js';

const KB_ROOT_ENV = 'KB_ROOT' as const;
const GENERATED_ROOT_ENV = 'WEB_GENERATED_ROOT' as const;
const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const DEFAULT_KB_ROOT = resolve(REPO_ROOT, 'data');
const DEFAULT_GENERATED_ROOT = resolve(REPO_ROOT, 'web', 'generated');
const LEGACY_MISRESOLVED_GENERATED_ROOT = resolve(REPO_ROOT, 'web', 'web', 'generated');

let initializedKbRootDefault: string | undefined;
let initializedGeneratedRootDefault: string | undefined;

interface ResolvedStoryStorageRootConfiguration {
  runtimeEnvironment: string;
  kbRoot: string;
  generatedRoot: string;
  kbRootSource: 'explicit_env' | 'default_derived';
  generatedRootSource: 'explicit_env' | 'default_derived';
  pathsAbsolute: boolean;
  rootsDisjoint: boolean;
  activeMatchesLegacyMisresolvedRoot: boolean;
  productionExplicitConfigRequired: boolean;
  productionExplicitConfigSatisfied: boolean;
  configurationValid: boolean;
  blockers: string[];
  warnings: string[];
}

function configuredValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value || undefined;
}

function isSameOrNested(left: string, right: string): boolean {
  const relation = relative(left, right);
  return relation === ''
    || (relation !== '..' && !relation.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(relation));
}

function isProcessInitializedDefault(
  env: NodeJS.ProcessEnv,
  name: typeof KB_ROOT_ENV | typeof GENERATED_ROOT_ENV,
  value: string | undefined,
): boolean {
  if (env !== process.env || value === undefined) return false;
  return name === KB_ROOT_ENV
    ? value === initializedKbRootDefault
    : value === initializedGeneratedRootDefault;
}

function resolveConfiguration(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedStoryStorageRootConfiguration {
  const configuredKbRoot = configuredValue(env, KB_ROOT_ENV);
  const configuredGeneratedRoot = configuredValue(env, GENERATED_ROOT_ENV);
  const kbRootWasInitialized = isProcessInitializedDefault(env, KB_ROOT_ENV, configuredKbRoot);
  const generatedRootWasInitialized = isProcessInitializedDefault(
    env,
    GENERATED_ROOT_ENV,
    configuredGeneratedRoot,
  );
  const kbRootSource = configuredKbRoot && !kbRootWasInitialized
    ? 'explicit_env'
    : 'default_derived';
  const generatedRootSource = configuredGeneratedRoot && !generatedRootWasInitialized
    ? 'explicit_env'
    : 'default_derived';
  const kbRoot = configuredKbRoot && isAbsolute(configuredKbRoot)
    ? resolve(configuredKbRoot)
    : configuredKbRoot ?? DEFAULT_KB_ROOT;
  const generatedRoot = configuredGeneratedRoot && isAbsolute(configuredGeneratedRoot)
    ? resolve(configuredGeneratedRoot)
    : configuredGeneratedRoot
      ?? (configuredKbRoot && isAbsolute(configuredKbRoot)
        ? resolve(configuredKbRoot, '..', 'web', 'generated')
        : DEFAULT_GENERATED_ROOT);
  const pathsAbsolute = isAbsolute(kbRoot) && isAbsolute(generatedRoot);
  const rootsDisjoint = pathsAbsolute
    && !isSameOrNested(kbRoot, generatedRoot)
    && !isSameOrNested(generatedRoot, kbRoot);
  const runtimeEnvironment = env.NODE_ENV?.trim() || 'development';
  const productionExplicitConfigRequired = runtimeEnvironment === 'production';
  const productionExplicitConfigSatisfied = !productionExplicitConfigRequired
    || (kbRootSource === 'explicit_env' && generatedRootSource === 'explicit_env');
  const blockers = [
    ...(configuredKbRoot && !isAbsolute(configuredKbRoot)
      ? [`${KB_ROOT_ENV} must be an absolute path`]
      : []),
    ...(configuredGeneratedRoot && !isAbsolute(configuredGeneratedRoot)
      ? [`${GENERATED_ROOT_ENV} must be an absolute path`]
      : []),
    ...(pathsAbsolute && !rootsDisjoint
      ? ['KB_ROOT and WEB_GENERATED_ROOT must be disjoint paths']
      : []),
    ...(!productionExplicitConfigSatisfied
      ? ['production requires explicit absolute KB_ROOT and WEB_GENERATED_ROOT values']
      : []),
  ];
  const activeMatchesLegacyMisresolvedRoot = pathsAbsolute
    && generatedRoot === LEGACY_MISRESOLVED_GENERATED_ROOT;

  return {
    runtimeEnvironment,
    kbRoot,
    generatedRoot,
    kbRootSource,
    generatedRootSource,
    pathsAbsolute,
    rootsDisjoint,
    activeMatchesLegacyMisresolvedRoot,
    productionExplicitConfigRequired,
    productionExplicitConfigSatisfied,
    configurationValid: blockers.length === 0,
    blockers,
    warnings: [
      ...(activeMatchesLegacyMisresolvedRoot
        ? ['WEB_GENERATED_ROOT explicitly selects the known legacy misresolved root; active writes will use that operator-selected path without automatic merge or migration.']
        : []),
      'The legacy misresolved generated root is inspection-only and is never merged into active read/write roots.',
      'Local storage inspection and readiness evidence do not count as real GEARS/Seedance delivery.',
    ],
  };
}

function assertStructurallyValid(config: ResolvedStoryStorageRootConfiguration): void {
  const structuralBlockers = config.blockers.filter(
    blocker => !blocker.startsWith('production requires'),
  );
  if (structuralBlockers.length > 0) {
    throw new StoryStorageRootConfigurationError(structuralBlockers);
  }
}

export class StoryStorageRootConfigurationError extends Error {
  readonly blockers: string[];

  constructor(blockers: string[]) {
    super(`Invalid Story storage root configuration: ${blockers.join('; ')}`);
    this.name = 'StoryStorageRootConfigurationError';
    this.blockers = [...blockers];
  }
}

export function storyRepositoryRoot(): string {
  return REPO_ROOT;
}

export function storyDefaultKbRoot(): string {
  return DEFAULT_KB_ROOT;
}

export function storyDefaultGeneratedRoot(): string {
  return DEFAULT_GENERATED_ROOT;
}

export function storyLegacyMisresolvedGeneratedRoot(): string {
  return LEGACY_MISRESOLVED_GENERATED_ROOT;
}

export function storyKbRoot(): string {
  const config = resolveConfiguration();
  assertStructurallyValid(config);
  return config.kbRoot;
}

export function storyGeneratedRoot(): string {
  const config = resolveConfiguration();
  assertStructurallyValid(config);
  return config.generatedRoot;
}

export function assertStoryStorageRootConfiguration(): void {
  const config = resolveConfiguration();
  if (!config.configurationValid) {
    throw new StoryStorageRootConfigurationError(config.blockers);
  }
}

export function initializeStoryStorageRootEnvironment(): void {
  const config = resolveConfiguration();
  if (!config.configurationValid) {
    throw new StoryStorageRootConfigurationError(config.blockers);
  }
  if (!configuredValue(process.env, KB_ROOT_ENV)) {
    initializedKbRootDefault = config.kbRoot;
    process.env[KB_ROOT_ENV] = config.kbRoot;
  }
  if (!configuredValue(process.env, GENERATED_ROOT_ENV)) {
    initializedGeneratedRootDefault = config.generatedRoot;
    process.env[GENERATED_ROOT_ENV] = config.generatedRoot;
  }
}

async function listDirectoryNames(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
}

async function countProjectVersions(projectsRoot: string, projectNames: string[]): Promise<number> {
  const counts = await Promise.all(projectNames.map(async projectName => {
    try {
      const entries = await readdir(resolve(projectsRoot, projectName, 'versions'), {
        withFileTypes: true,
      });
      return entries.filter(entry => entry.isFile() && entry.name.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }));
  return counts.reduce((sum, count) => sum + count, 0);
}

async function inspectRoot(
  role: StoryStorageRootInventory['role'],
  root: string,
): Promise<StoryStorageRootInventory> {
  try {
    const rootStat = await lstat(root);
    if (!rootStat.isDirectory() && !rootStat.isSymbolicLink()) {
      return {
        role,
        root,
        exists: true,
        readable: false,
        symbolic_link: rootStat.isSymbolicLink(),
        project_count: 0,
        project_version_count: 0,
        story_count: 0,
        ai_comic_series_project_count: 0,
        inspection_error: 'root is not a directory',
        read_only_inspection: true,
      };
    }
    const [projectNames, storyNames, seriesProjectNames] = await Promise.all([
      listDirectoryNames(resolve(root, 'projects')).catch(() => []),
      readdir(resolve(root, 'stories'), { withFileTypes: true })
        .then(entries => entries.filter(entry => entry.isFile() && entry.name.endsWith('.json')).map(entry => entry.name))
        .catch(() => []),
      listDirectoryNames(resolve(root, 'ai-comic-series-projects')).catch(() => []),
    ]);
    return {
      role,
      root,
      exists: true,
      readable: true,
      symbolic_link: rootStat.isSymbolicLink(),
      project_count: projectNames.length,
      project_version_count: await countProjectVersions(resolve(root, 'projects'), projectNames),
      story_count: storyNames.length,
      ai_comic_series_project_count: seriesProjectNames.length,
      inspection_error: null,
      read_only_inspection: true,
    };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : undefined;
    return {
      role,
      root,
      exists: code !== 'ENOENT',
      readable: false,
      symbolic_link: false,
      project_count: 0,
      project_version_count: 0,
      story_count: 0,
      ai_comic_series_project_count: 0,
      inspection_error: code === 'ENOENT'
        ? null
        : error instanceof Error ? error.message : String(error),
      read_only_inspection: true,
    };
  }
}

export async function getStoryStorageRootConfigInfo(): Promise<StoryStorageRootConfigInfo> {
  const config = resolveConfiguration();
  const [active, legacy] = await Promise.all([
    inspectRoot('active', config.generatedRoot),
    inspectRoot('legacy_misresolved', LEGACY_MISRESOLVED_GENERATED_ROOT),
  ]);
  return {
    schema_version: 'story-storage-root-config/v1',
    kb_root_env: KB_ROOT_ENV,
    generated_root_env: GENERATED_ROOT_ENV,
    runtime_environment: config.runtimeEnvironment,
    kb_root: config.kbRoot,
    generated_root: config.generatedRoot,
    kb_root_source: config.kbRootSource,
    generated_root_source: config.generatedRootSource,
    default_kb_root: DEFAULT_KB_ROOT,
    default_generated_root: DEFAULT_GENERATED_ROOT,
    legacy_misresolved_generated_root: LEGACY_MISRESOLVED_GENERATED_ROOT,
    paths_absolute: config.pathsAbsolute,
    roots_disjoint: config.rootsDisjoint,
    active_matches_legacy_misresolved_root: config.activeMatchesLegacyMisresolvedRoot,
    production_explicit_config_required: config.productionExplicitConfigRequired,
    production_explicit_config_satisfied: config.productionExplicitConfigSatisfied,
    configuration_valid: config.configurationValid,
    blockers: config.blockers,
    warnings: config.warnings,
    inventory: {
      active,
      legacy_misresolved: legacy,
    },
    legacy_policy: {
      discovery_only: true,
      included_in_active_read_roots: false,
      automatic_migration_allowed: false,
      automatic_merge_allowed: false,
      automatic_delete_allowed: false,
      automatic_writeback_allowed: false,
    },
    data_moved: false,
    data_deleted: false,
    data_overwritten: false,
    provider_switched: false,
    real_gears_seedance_delivery_credit_count: 0,
    counts_as_real_gears_seedance_delivery: false,
    generated_at: new Date().toISOString(),
  };
}
