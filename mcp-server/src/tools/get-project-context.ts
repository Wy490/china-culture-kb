import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { getKbRoot } from '../lib/provinces.js';
import { resolveStorySourceDomain } from '../lib/story-source-domain.js';

type StoryProjectChangeType = 'initial_generation' | 'scene_regeneration' | 'quality_repair' | 'production_board_repair' | 'domain_safety_migration';
type CreationUseCase =
  | 'original_ai_comic'
  | 'adapted_ai_comic'
  | 'institutional_promo'
  | 'documentary_short'
  | 'brand_commercial'
  | 'education_training'
  | 'public_service';
type TruthMode =
  | 'fictional_original'
  | 'inspired_by_material'
  | 'source_adaptation'
  | 'factual_reconstruction'
  | 'institutional_verified';

interface MaterialSufficiencyReport {
  schema_version: 'material-sufficiency/v1';
  stage: 'minimum_viable_story' | 'script_ready' | 'production_ready';
  score: number;
  can_generate: boolean;
  can_generate_with_risks: boolean;
  blocked: boolean;
  missing_items: unknown[];
  optional_items: unknown[];
  token_risk: 'low' | 'medium' | 'high';
  recommended_next_questions: string[];
}

interface CreationContract {
  schema_version: 'creation-contract/v1';
  creation_use_case: CreationUseCase;
  truth_mode: TruthMode;
  client_type?: string;
  target_audience?: string;
  communication_goal?: string;
  video_type: string;
  presentation_style: string;
  story_structure: string;
  narrative_pattern_ids: string[];
  allowed_fiction: string[];
  must_verify: string[];
  forbidden_moves: string[];
  required_disclaimers: string[];
  material_sufficiency: MaterialSufficiencyReport;
  delivery_expectation: string[];
}

interface StoryProjectMeta {
  project_id: string;
  current_story_id: string;
  title: string;
  source_domain: string;
  source_entry: string;
  video_type: string;
  presentation_style: string;
  story_structure?: string;
  creation_use_case?: CreationUseCase;
  truth_mode?: TruthMode;
  material_sufficiency?: MaterialSufficiencyReport;
  creation_contract?: CreationContract;
  status: string;
  created_at: string;
  updated_at: string;
  current_version_id: string;
  version_count: number;
  scene_count: number;
  has_gears_segments: boolean;
  credibility_note?: string;
  logline?: string;
  quality_passed?: boolean;
  genre_score?: number;
  quality_issue_count?: number;
  open_supplement_task_count?: number;
}

interface StoryProjectVersionSnapshot {
  project_id: string;
  version_id: string;
  created_at: string;
  change_type: StoryProjectChangeType;
  scene_ids_changed: number[];
  note?: string;
  quality_report?: {
    passed?: boolean;
    genre_score?: number;
    issues?: string[];
  };
  story: Record<string, unknown>;
}

interface StoryProjectVersionSummary {
  version_id: string;
  created_at: string;
  change_type: StoryProjectChangeType;
  scene_ids_changed: number[];
  note?: string;
  quality_passed?: boolean;
  genre_score?: number;
  quality_issue_count?: number;
}

const VERSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,280}$/;

type HydratedStory = Record<string, unknown> & {
  sourceDomain: string;
};

type HydratedStoryProjectVersionSnapshot = Omit<StoryProjectVersionSnapshot, 'story'> & {
  story: HydratedStory;
};

export interface GetProjectContextInput {
  project_id: string;
  include_versions?: boolean;
  include_exports?: boolean;
}

export interface GetProjectContextResult {
  project: StoryProjectMeta;
  current_story: HydratedStory;
  versions: StoryProjectVersionSummary[];
  version_snapshots?: HydratedStoryProjectVersionSnapshot[];
  exports?: string[];
}

function projectsRoot(): string {
  return path.resolve(getKbRoot(), '..', 'web', 'generated', 'projects');
}

function projectDir(projectId: string): string {
  return path.resolve(projectsRoot(), projectId);
}

function assertSafeProjectId(projectId: string): void {
  if (!projectId || projectId.includes('/') || projectId.includes('\\') || projectId.includes('..')) {
    throw new Error(`非法项目 ID：${projectId}`);
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
}

async function listJsonFiles(dirPath: string): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
  const jsonEntries = entries.filter(entry => entry.name.endsWith('.json'));
  for (const entry of jsonEntries) {
    if (!entry.isFile()) {
      throw new Error(`版本快照不是普通文件：${entry.name}`);
    }
  }
  return jsonEntries.map(entry => entry.name).sort();
}

function validVersionId(projectId: string, versionId: string): boolean {
  return VERSION_ID_PATTERN.test(versionId) && versionId.startsWith(`${projectId}-v`);
}

function toVersionSummary(snapshot: StoryProjectVersionSnapshot): StoryProjectVersionSummary {
  const quality = snapshot.quality_report;
  return {
    version_id: snapshot.version_id,
    created_at: snapshot.created_at,
    change_type: snapshot.change_type,
    scene_ids_changed: snapshot.scene_ids_changed ?? [],
    note: snapshot.note,
    quality_passed: quality?.passed,
    genre_score: quality?.genre_score,
    quality_issue_count: quality?.issues?.length,
  };
}

function hydrateSnapshotSourceDomain(
  snapshot: StoryProjectVersionSnapshot,
  projectSourceDomain: string,
): HydratedStoryProjectVersionSnapshot {
  const rawSourceDomain = snapshot.story.sourceDomain;
  const storySourceDomain = typeof rawSourceDomain === 'string' ? rawSourceDomain.trim() : '';
  if (storySourceDomain && storySourceDomain !== projectSourceDomain) {
    throw new Error(
      `版本快照 ${snapshot.version_id} 的 Story sourceDomain（${storySourceDomain}）与项目 source_domain（${projectSourceDomain}）不一致`,
    );
  }
  return {
    ...snapshot,
    story: {
      ...snapshot.story,
      sourceDomain: projectSourceDomain,
    },
  };
}

async function readVersionSnapshots(projectId: string): Promise<StoryProjectVersionSnapshot[]> {
  const versionsDir = path.join(projectDir(projectId), 'versions');
  const files = await listJsonFiles(versionsDir);
  const snapshots: StoryProjectVersionSnapshot[] = [];
  const seenVersionIds = new Set<string>();

  for (const file of files) {
    const fileVersionId = file.slice(0, -'.json'.length);
    if (!validVersionId(projectId, fileVersionId)) {
      throw new Error(`非法版本快照文件名：${file}`);
    }
    const snapshot = await readJsonFile<StoryProjectVersionSnapshot>(path.join(versionsDir, file));
    if (snapshot.project_id !== projectId) {
      throw new Error(`版本快照 ${file} 的 project_id（${snapshot.project_id}）与项目（${projectId}）不一致`);
    }
    if (typeof snapshot.version_id !== 'string' || !validVersionId(projectId, snapshot.version_id)) {
      throw new Error(`版本快照 ${file} 包含非法 version_id：${String(snapshot.version_id)}`);
    }
    if (seenVersionIds.has(snapshot.version_id)) {
      throw new Error(`项目存在重复 version_id：${snapshot.version_id}`);
    }
    seenVersionIds.add(snapshot.version_id);
    if (snapshot.version_id !== fileVersionId) {
      throw new Error(`版本快照 ${file} 的 version_id（${snapshot.version_id}）与文件名不一致`);
    }
    snapshots.push(snapshot);
  }

  return snapshots.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

async function listExports(projectId: string): Promise<string[]> {
  const exportsDir = path.join(projectDir(projectId), 'exports');
  try {
    return (await fs.readdir(exportsDir)).sort();
  } catch {
    return [];
  }
}

export async function getProjectContext(input: GetProjectContextInput): Promise<GetProjectContextResult | null> {
  const projectId = input.project_id.trim();
  assertSafeProjectId(projectId);

  const metaPath = path.join(projectDir(projectId), 'project.json');
  let project: StoryProjectMeta;
  try {
    project = await readJsonFile<StoryProjectMeta>(metaPath);
  } catch {
    return null;
  }

  const projectSourceDomain = resolveStorySourceDomain({ sourceDomain: project.source_domain });
  const versionSnapshots = (await readVersionSnapshots(projectId))
    .map(snapshot => hydrateSnapshotSourceDomain(snapshot, projectSourceDomain));
  if (!versionSnapshots.length) {
    throw new Error(`项目缺少版本快照：${projectId}`);
  }
  const currentVersion = versionSnapshots.find(version => version.version_id === project.current_version_id);
  if (!currentVersion) {
    throw new Error(`项目当前版本快照缺失：${project.current_version_id}`);
  }

  const result: GetProjectContextResult = {
    project: {
      ...project,
      source_domain: projectSourceDomain,
    },
    current_story: currentVersion.story,
    versions: versionSnapshots.map(toVersionSummary),
  };

  if (input.include_versions) {
    result.version_snapshots = versionSnapshots;
  }

  if (input.include_exports) {
    result.exports = await listExports(projectId);
  }

  return result;
}
