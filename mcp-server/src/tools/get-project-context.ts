import fs from 'node:fs/promises';
import path from 'node:path';
import { getKbRoot } from '../lib/provinces.js';

type StoryProjectChangeType = 'initial_generation' | 'scene_regeneration' | 'quality_repair';
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

export interface GetProjectContextInput {
  project_id: string;
  include_versions?: boolean;
  include_exports?: boolean;
}

export interface GetProjectContextResult {
  project: StoryProjectMeta;
  current_story: Record<string, unknown>;
  versions: StoryProjectVersionSummary[];
  version_snapshots?: StoryProjectVersionSnapshot[];
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
  try {
    const files = await fs.readdir(dirPath);
    return files.filter(file => file.endsWith('.json')).sort();
  } catch {
    return [];
  }
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

async function readVersionSnapshots(projectId: string): Promise<StoryProjectVersionSnapshot[]> {
  const versionsDir = path.join(projectDir(projectId), 'versions');
  const files = await listJsonFiles(versionsDir);
  const snapshots: StoryProjectVersionSnapshot[] = [];

  for (const file of files) {
    snapshots.push(await readJsonFile<StoryProjectVersionSnapshot>(path.join(versionsDir, file)));
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

  const versionSnapshots = await readVersionSnapshots(projectId);
  const currentVersion = versionSnapshots.find(version => version.version_id === project.current_version_id)
    ?? versionSnapshots[0];
  if (!currentVersion) {
    throw new Error(`项目缺少版本快照：${projectId}`);
  }

  const result: GetProjectContextResult = {
    project,
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
