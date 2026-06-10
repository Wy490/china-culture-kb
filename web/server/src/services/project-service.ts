import { dirname, resolve } from 'node:path';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { fail, success, ErrorCodes } from '@shared/types.js';
import type {
  ApiResponse,
  StoryGenerateResult,
  StoryProjectDetail,
  StoryProjectListItem,
  StoryProjectMeta,
  StoryProjectStatus,
  StoryProjectVersionSnapshot,
  StoryProjectVersionSummary,
  StoryProjectDeleteResult,
  ProjectSupplementTaskListItem,
  KnowledgeSupplementTaskUpdateRequest,
  KnowledgeSupplementTaskStatus,
  StorySceneRegenerateRequest,
  VideoType,
  GearsDeliveryPackage,
} from '@shared/types.js';
import { buildRegenerationNote, regenerateSceneInStory } from './story-regenerate-service.js';
import { buildGearsDeliveryPackage } from './gears-delivery-service.js';

const ALL_VIDEO_TYPES: VideoType[] = [
  'character_story', 'historical_drama', 'legend_story',
  'culture_promo', 'heritage_promo', 'city_brand_promo',
  'scene_short', 'landscape_mood',
  'documentary_short', 'explainer_video', 'lecture_video', 'education_training',
  'children_story', 'social_short', 'ai_comic_drama',
];

type StoredStoryFile = StoryGenerateResult & {
  _request_meta?: Record<string, unknown>;
};

function kbRoot(): string {
  return process.env.KB_ROOT || resolve(import.meta.dirname, '..', '..', '..', 'data');
}

function storiesRoot(): string {
  return resolve(kbRoot(), '..', 'web', 'generated', 'stories');
}

function projectsRoot(): string {
  return resolve(kbRoot(), '..', 'web', 'generated', 'projects');
}

function projectDir(projectId: string): string {
  return resolve(projectsRoot(), projectId);
}

function projectMetaPath(projectId: string): string {
  return resolve(projectDir(projectId), 'project.json');
}

function projectVersionsDir(projectId: string): string {
  return resolve(projectDir(projectId), 'versions');
}

function projectVersionPath(projectId: string, versionId: string): string {
  return resolve(projectVersionsDir(projectId), `${versionId}.json`);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf-8')) as T;
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function cleanStory(data: StoredStoryFile): StoryGenerateResult {
  const cleaned = { ...data } as Record<string, unknown>;
  delete cleaned._request_meta;
  return cleaned as unknown as StoryGenerateResult;
}

function storyCreatedAt(story: StoredStoryFile): string {
  return typeof story._request_meta?.created_at === 'string'
    ? story._request_meta.created_at
    : new Date().toISOString();
}

function inferProjectStatus(story: StoryGenerateResult, versionCount: number): StoryProjectStatus {
  if (versionCount > 1) return 'edited';
  if (!story.gears_segments || story.gears_segments.length === 0) return 'draft';
  return 'draft';
}

function countOpenSupplementTasks(story: StoryGenerateResult): number {
  return story.supplement_tasks?.filter(task => task.status === 'open').length ?? 0;
}

function storySourcePath(story: Pick<StoryGenerateResult, 'storyId' | 'video_type'>): string {
  return resolve(storiesRoot(), story.video_type, `${story.storyId}.json`);
}

export function buildProjectId(storyId: string, videoType: string): string {
  return `${storyId}--${videoType}`;
}

function buildVersionId(projectId: string, versionNumber: number): string {
  return `${projectId}-v${versionNumber}`;
}

function parseProjectId(projectId: string): { storyId: string; videoType: VideoType } | null {
  const marker = '--';
  const markerIndex = projectId.indexOf(marker);
  if (markerIndex === -1) return null;

  const storyId = projectId.slice(0, markerIndex);
  const videoType = projectId.slice(markerIndex + marker.length) as VideoType;
  if (!ALL_VIDEO_TYPES.includes(videoType)) return null;
  return { storyId, videoType };
}

function toVersionSummary(snapshot: StoryProjectVersionSnapshot): StoryProjectVersionSummary {
  return {
    version_id: snapshot.version_id,
    created_at: snapshot.created_at,
    change_type: snapshot.change_type,
    scene_ids_changed: snapshot.scene_ids_changed,
    note: snapshot.note,
  };
}

function buildProjectMeta(
  story: StoryGenerateResult,
  createdAt: string,
  currentVersionId: string,
  versionCount: number,
): StoryProjectMeta {
  return {
    project_id: story.project_id ?? buildProjectId(story.storyId, story.video_type),
    current_story_id: story.storyId,
    title: story.title,
    source_domain: 'china_culture',
    source_entry: story.source_entry,
    video_type: story.video_type,
    presentation_style: story.presentation_style,
    story_structure: story.story_structure,
    status: inferProjectStatus(story, versionCount),
    created_at: createdAt,
    updated_at: createdAt,
    current_version_id: currentVersionId,
    version_count: versionCount,
    scene_count: story.scene_breakdown?.length ?? 0,
    has_gears_segments: (story.gears_segments?.length ?? 0) > 0,
    credibility_note: story.credibility_note,
    logline: story.logline,
    model_profile_id: story.model_profile_id,
    generation_source: story.generation_source,
    generation_mode: story.generation_mode ?? 'local_only',
    generation_used_fallback: story.generation_used_fallback ?? false,
    open_supplement_task_count: countOpenSupplementTasks(story),
  };
}

async function readStoryFromSource(projectId: string): Promise<{ story: StoryGenerateResult; createdAt: string } | null> {
  const parsed = parseProjectId(projectId);
  if (!parsed) return null;

  const filePath = storySourcePath({ storyId: parsed.storyId, video_type: parsed.videoType });
  if (!(await pathExists(filePath))) return null;

  const raw = await readJsonFile<StoredStoryFile>(filePath);
  return { story: cleanStory(raw), createdAt: storyCreatedAt(raw) };
}

async function readAllStoriesForMigration(): Promise<Array<{ story: StoryGenerateResult; createdAt: string }>> {
  const results: Array<{ story: StoryGenerateResult; createdAt: string }> = [];

  for (const videoType of ALL_VIDEO_TYPES) {
    const dirPath = resolve(storiesRoot(), videoType);
    let files: string[];
    try {
      files = await readdir(dirPath);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await readJsonFile<StoredStoryFile>(resolve(dirPath, file));
        results.push({ story: cleanStory(raw), createdAt: storyCreatedAt(raw) });
      } catch {
        continue;
      }
    }
  }

  return results;
}

function buildInitialProjectSnapshot(
  story: StoryGenerateResult,
  createdAt: string,
): { meta: StoryProjectMeta; snapshot: StoryProjectVersionSnapshot } {
  const projectId = story.project_id ?? buildProjectId(story.storyId, story.video_type);
  const versionId = story.current_version_id ?? buildVersionId(projectId, 1);
  const storyWithProject = {
    ...story,
    project_id: projectId,
    current_version_id: versionId,
  };

  return {
    meta: buildProjectMeta(storyWithProject, createdAt, versionId, 1),
    snapshot: {
      project_id: projectId,
      version_id: versionId,
      created_at: createdAt,
      change_type: 'initial_generation',
      scene_ids_changed: [],
      story: storyWithProject,
    },
  };
}

async function ensureProjectFromStory(story: StoryGenerateResult, createdAt: string): Promise<StoryProjectMeta> {
  const { meta, snapshot } = buildInitialProjectSnapshot(story, createdAt);
  const metaFile = projectMetaPath(meta.project_id);
  if (await pathExists(metaFile)) {
    return readJsonFile<StoryProjectMeta>(metaFile);
  }

  await writeJsonFile(projectVersionPath(meta.project_id, snapshot.version_id), snapshot);
  await writeJsonFile(metaFile, meta);
  return meta;
}

async function ensureProjectsFromStories(): Promise<void> {
  const stories = await readAllStoriesForMigration();
  for (const item of stories) {
    await ensureProjectFromStory(item.story, item.createdAt);
  }
}

async function readProjectMeta(projectId: string): Promise<StoryProjectMeta | null> {
  const metaFile = projectMetaPath(projectId);
  if (!(await pathExists(metaFile))) return null;
  return readJsonFile<StoryProjectMeta>(metaFile);
}

async function readVersionSnapshots(projectId: string): Promise<StoryProjectVersionSnapshot[]> {
  const versionsDir = projectVersionsDir(projectId);
  let files: string[];
  try {
    files = await readdir(versionsDir);
  } catch {
    return [];
  }

  const snapshots: StoryProjectVersionSnapshot[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const snapshot = await readJsonFile<StoryProjectVersionSnapshot>(resolve(versionsDir, file));
      snapshots.push(snapshot);
    } catch {
      continue;
    }
  }

  snapshots.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return snapshots;
}

async function ensureProjectExists(projectId: string): Promise<StoryProjectMeta | null> {
  const existing = await readProjectMeta(projectId);
  if (existing) return existing;

  const sourceStory = await readStoryFromSource(projectId);
  if (!sourceStory) return null;
  return ensureProjectFromStory(sourceStory.story, sourceStory.createdAt);
}

async function persistProjectVersion(
  project: StoryProjectMeta,
  story: StoryGenerateResult,
  changeType: StoryProjectVersionSnapshot['change_type'],
  sceneIdsChanged: number[],
  note?: string,
): Promise<StoryProjectMeta> {
  const nextVersionNumber = project.version_count + 1;
  const createdAt = new Date().toISOString();
  const versionId = buildVersionId(project.project_id, nextVersionNumber);
  const updatedStory: StoryGenerateResult = {
    ...story,
    project_id: project.project_id,
    current_version_id: versionId,
  };

  const snapshot: StoryProjectVersionSnapshot = {
    project_id: project.project_id,
    version_id: versionId,
    created_at: createdAt,
    change_type: changeType,
    scene_ids_changed: sceneIdsChanged,
    note,
    story: updatedStory,
  };

  const updatedMeta: StoryProjectMeta = {
    ...project,
    current_story_id: updatedStory.storyId,
    current_version_id: versionId,
    version_count: nextVersionNumber,
    updated_at: createdAt,
    status: inferProjectStatus(updatedStory, nextVersionNumber),
    scene_count: updatedStory.scene_breakdown.length,
    has_gears_segments: updatedStory.gears_segments.length > 0,
    title: updatedStory.title,
    logline: updatedStory.logline,
    credibility_note: updatedStory.credibility_note,
    model_profile_id: updatedStory.model_profile_id,
    generation_source: updatedStory.generation_source,
    generation_mode: updatedStory.generation_mode ?? 'local_only',
    generation_used_fallback: updatedStory.generation_used_fallback ?? false,
    open_supplement_task_count: countOpenSupplementTasks(updatedStory),
  };

  await writeJsonFile(projectVersionPath(project.project_id, versionId), snapshot);
  await writeJsonFile(projectMetaPath(project.project_id), updatedMeta);
  return updatedMeta;
}

export async function createProjectFromGeneratedStory(
  story: StoryGenerateResult,
  createdAt: string,
): Promise<StoryGenerateResult> {
  const meta = await ensureProjectFromStory(story, createdAt);
  return {
    ...story,
    project_id: meta.project_id,
    current_version_id: meta.current_version_id,
  };
}

export async function listProjects(): Promise<ApiResponse<StoryProjectListItem[]>> {
  await ensureProjectsFromStories();

  let projectIds: string[];
  try {
    projectIds = await readdir(projectsRoot());
  } catch {
    return success([]);
  }

  const projects: StoryProjectListItem[] = [];
  for (const projectId of projectIds) {
    const meta = await readProjectMeta(projectId);
    if (!meta) continue;
    projects.push(meta);
  }

  projects.sort((a, b) => {
    if (!a.updated_at && !b.updated_at) return a.title.localeCompare(b.title, 'zh-CN');
    if (!a.updated_at) return 1;
    if (!b.updated_at) return -1;
    return b.updated_at.localeCompare(a.updated_at);
  });

  return success(projects);
}

export async function getProject(projectId: string): Promise<ApiResponse<StoryProjectDetail>> {
  const project = await ensureProjectExists(projectId);
  if (!project) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" not found`);
  }

  const versions = await readVersionSnapshots(projectId);
  const currentVersion = versions.find(version => version.version_id === project.current_version_id) ?? versions[0];
  if (!currentVersion) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" has no version snapshots`);
  }

  return success({
    project,
    current_story: normalizeStoryGenerationFields(currentVersion.story),
    versions: versions.map(toVersionSummary),
  });
}

export async function listProjectSupplementTasks(
  status?: KnowledgeSupplementTaskStatus,
): Promise<ApiResponse<ProjectSupplementTaskListItem[]>> {
  const projectsResult = await listProjects();
  if (!projectsResult.ok || !projectsResult.data) {
    return fail(
      ErrorCodes.INTERNAL_ERROR,
      projectsResult.error?.message ?? 'Failed to list projects',
    );
  }

  const items: ProjectSupplementTaskListItem[] = [];
  for (const project of projectsResult.data) {
    const detailResult = await getProject(project.project_id);
    if (!detailResult.ok || !detailResult.data) continue;
    for (const task of detailResult.data.current_story.supplement_tasks ?? []) {
      if (status && task.status !== status) continue;
      items.push({
        project_id: project.project_id,
        current_story_id: project.current_story_id,
        project_title: project.title,
        source_entry: project.source_entry,
        video_type: project.video_type,
        updated_at: project.updated_at,
        task,
      });
    }
  }

  items.sort((a, b) => {
    if (a.task.status !== b.task.status) return a.task.status === 'open' ? -1 : 1;
    const aTime = a.task.updated_at ?? a.task.resolved_at ?? a.updated_at;
    const bTime = b.task.updated_at ?? b.task.resolved_at ?? b.updated_at;
    return bTime.localeCompare(aTime);
  });
  return success(items);
}

export async function deleteProject(projectId: string): Promise<ApiResponse<StoryProjectDeleteResult>> {
  const project = await ensureProjectExists(projectId);
  if (!project) {
    return fail(ErrorCodes.STORY_NOT_FOUND, `Project "${projectId}" not found`);
  }

  const storyFile = storySourcePath({ storyId: project.current_story_id, video_type: project.video_type });
  await rm(storyFile, { force: true });
  await rm(projectDir(projectId), { recursive: true, force: true });

  return success({
    project_id: projectId,
    story_id: project.current_story_id,
    deleted: true,
  });
}

/** 旧故事 JSON 缺 generation_mode/generation_used_fallback → 填充默认值 */
function normalizeStoryGenerationFields(story: StoryGenerateResult): StoryGenerateResult {
  const normalized = {
    ...story,
    generation_mode: story.generation_mode ?? 'local_only',
    generation_used_fallback: story.generation_used_fallback ?? false,
  };
  normalized.gears_delivery = normalized.gears_delivery ?? buildGearsDeliveryPackage(normalized);
  return normalized;
}

export async function regenerateProjectScene(
  projectId: string,
  request: StorySceneRegenerateRequest,
): Promise<ApiResponse<StoryProjectDetail>> {
  const detailResult = await getProject(projectId);
  if (!detailResult.ok || !detailResult.data) {
    return detailResult;
  }

  const { project, current_story } = detailResult.data;
  const sceneIndex = current_story.scene_breakdown.findIndex(scene => scene.scene_id === request.scene_id);
  if (sceneIndex === -1) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Scene ${request.scene_id} not found in project "${projectId}"`);
  }

  const updatedStory = await regenerateSceneInStory(current_story, request);

  await persistProjectVersion(
    project,
    updatedStory,
    'scene_regeneration',
    [request.scene_id],
    buildRegenerationNote(request),
  );

  return getProject(projectId);
}

export async function updateProjectSupplementTask(
  projectId: string,
  taskId: string,
  request: KnowledgeSupplementTaskUpdateRequest,
): Promise<ApiResponse<StoryProjectDetail>> {
  const detailResult = await getProject(projectId);
  if (!detailResult.ok || !detailResult.data) {
    return detailResult;
  }

  const { project, current_story } = detailResult.data;
  const tasks = current_story.supplement_tasks ?? [];
  const taskIndex = tasks.findIndex(task => task.task_id === taskId);
  if (taskIndex === -1) {
    return fail(ErrorCodes.VALIDATION_ERROR, `Supplement task "${taskId}" not found in project "${projectId}"`);
  }

  const updatedAt = new Date().toISOString();
  const updatedTasks = tasks.map((task, index) => {
    if (index !== taskIndex) return task;
    const supplementNote = request.supplement_note?.trim();
    return {
      ...task,
      status: request.status,
      updated_at: updatedAt,
      resolved_at: request.status === 'resolved' ? updatedAt : undefined,
      supplement_note: supplementNote || task.supplement_note,
    };
  });
  const updatedStory: StoryGenerateResult = {
    ...current_story,
    supplement_tasks: updatedTasks,
  };
  const updatedMeta: StoryProjectMeta = {
    ...project,
    updated_at: updatedAt,
    open_supplement_task_count: countOpenSupplementTasks(updatedStory),
  };
  const currentPath = projectVersionPath(projectId, project.current_version_id);

  const snapshot = await readJsonFile<StoryProjectVersionSnapshot>(currentPath);
  await writeJsonFile(currentPath, {
    ...snapshot,
    story: updatedStory,
  });
  await writeJsonFile(projectMetaPath(projectId), updatedMeta);

  const sourcePath = storySourcePath(updatedStory);
  if (await pathExists(sourcePath)) {
    const raw = await readJsonFile<StoredStoryFile>(sourcePath);
    await writeJsonFile(sourcePath, {
      ...raw,
      supplement_tasks: updatedTasks,
      project_id: updatedStory.project_id,
      current_version_id: updatedStory.current_version_id,
    });
  }

  return getProject(projectId);
}

export async function updateProjectCurrentGearsDelivery(
  projectId: string | undefined,
  storyId: string,
  gearsDelivery: GearsDeliveryPackage,
): Promise<void> {
  if (!projectId) return;
  const project = await readProjectMeta(projectId);
  if (!project) return;

  const currentPath = projectVersionPath(projectId, project.current_version_id);
  if (!(await pathExists(currentPath))) return;

  const snapshot = await readJsonFile<StoryProjectVersionSnapshot>(currentPath);
  if (snapshot.story.storyId !== storyId) return;

  const updatedSnapshot: StoryProjectVersionSnapshot = {
    ...snapshot,
    story: {
      ...snapshot.story,
      gears_delivery: gearsDelivery,
    },
  };
  const updatedMeta: StoryProjectMeta = {
    ...project,
    updated_at: new Date().toISOString(),
  };

  await writeJsonFile(currentPath, updatedSnapshot);
  await writeJsonFile(projectMetaPath(projectId), updatedMeta);
}
