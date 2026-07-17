import fs from 'node:fs/promises';
import path from 'node:path';
import { getKbRoot } from '../lib/provinces.js';
import { resolveStorySourceDomain } from '../lib/story-source-domain.js';
import { getProjectContext } from './get-project-context.js';

type ProjectVersionChangeType = 'scene_regeneration' | 'quality_repair' | 'production_board_repair';

interface StorySceneLike {
  scene_id?: number;
  plot?: string;
  key_action?: string;
  visual_prompt?: string;
  dialogue_or_narration?: string;
  [key: string]: unknown;
}

type StoryLike = Record<string, unknown> & {
  storyId?: string;
  project_id?: string;
  current_version_id?: string;
  sourceDomain?: string;
  title?: string;
  source_entry?: string;
  video_type?: string;
  presentation_style?: string;
  story_structure?: string;
  logline?: string;
  credibility_note?: string;
  scene_breakdown?: StorySceneLike[];
  gears_segments?: unknown[];
  supplement_tasks?: Array<{ status?: string }>;
  quality_report?: {
    passed?: boolean;
    genre_score?: number;
    issues?: unknown[];
  };
  gears_video?: {
    status?: string;
    video_url?: string;
    thumbnail_url?: string;
  };
};

type ProjectMetaLike = Record<string, unknown> & {
  project_id: string;
  current_story_id: string;
  title: string;
  source_domain: string;
  source_entry: string;
  video_type: string;
  presentation_style: string;
  story_structure?: string;
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
};

interface ProjectVersionSnapshotLike {
  project_id: string;
  version_id: string;
  created_at: string;
  change_type: ProjectVersionChangeType | 'initial_generation';
  scene_ids_changed: number[];
  note?: string;
  quality_report?: StoryLike['quality_report'];
  story: StoryLike;
}

export interface UpdateProjectVersionInput {
  project_id: string;
  change_type: ProjectVersionChangeType;
  change_target?: {
    scene_ids?: number[];
  };
  snapshot_json: string;
  user_instruction?: string;
}

export interface UpdateProjectVersionResult {
  project_id: string;
  previous_version_id: string;
  version_id: string;
  current_version_id: string;
  version_count: number;
  updated_at: string;
  change_type: ProjectVersionChangeType;
  scene_ids_changed: number[];
  snapshot_path: string;
  project_path: string;
  preserved_fields: string[];
  quality_summary: {
    quality_passed?: boolean;
    genre_score?: number;
    quality_issue_count?: number;
  };
  warnings: string[];
}

const CRITICAL_STORY_FIELDS = [
  'story_blueprint',
  'quality_report',
  'scene_breakdown',
  'gears_segments',
  'gears_delivery',
  'characters',
  'visual_symbols',
  'cultural_constraints',
  'supplement_tasks',
  'production_board_repair_trace',
  'seedance_asset_report',
  'seedance_shot_ledger',
];

function projectsRoot(): string {
  return path.resolve(getKbRoot(), '..', 'web', 'generated', 'projects');
}

function projectDir(projectId: string): string {
  return path.join(projectsRoot(), projectId);
}

function projectMetaPath(projectId: string): string {
  return path.join(projectDir(projectId), 'project.json');
}

function projectVersionsDir(projectId: string): string {
  return path.join(projectDir(projectId), 'versions');
}

function projectVersionPath(projectId: string, versionId: string): string {
  return path.join(projectVersionsDir(projectId), `${versionId}.json`);
}

function assertSafeId(id: string, label: string): void {
  if (!id || id.includes('/') || id.includes('\\') || id.includes('..')) {
    throw new Error(`非法${label}：${id}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function versionFileCount(projectId: string): Promise<number> {
  try {
    const files = await fs.readdir(projectVersionsDir(projectId));
    return files.filter(file => file.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

function parseSnapshotJson(snapshotJson: string): StoryLike {
  try {
    const parsed = JSON.parse(snapshotJson);
    if (!isRecord(parsed)) throw new Error('snapshot_json 必须是 JSON 对象');
    return parsed as StoryLike;
  } catch (error) {
    if (error instanceof Error && error.message === 'snapshot_json 必须是 JSON 对象') throw error;
    throw new Error(`snapshot_json 不是有效 JSON：${error instanceof Error ? error.message : String(error)}`);
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function sceneId(scene: StorySceneLike, index: number): number {
  return typeof scene.scene_id === 'number' && Number.isFinite(scene.scene_id) ? scene.scene_id : index + 1;
}

function normalizeSceneIds(sceneIds: unknown): number[] {
  if (!Array.isArray(sceneIds)) return [];
  return [...new Set(
    sceneIds
      .filter((sceneIdValue): sceneIdValue is number => typeof sceneIdValue === 'number' && Number.isFinite(sceneIdValue))
      .map(sceneIdValue => Math.trunc(sceneIdValue))
      .filter(sceneIdValue => sceneIdValue > 0),
  )].sort((a, b) => a - b);
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function inferChangedSceneIds(currentStory: StoryLike, updatedStory: StoryLike): number[] {
  const currentScenes = Array.isArray(currentStory.scene_breakdown) ? currentStory.scene_breakdown : [];
  const updatedScenes = Array.isArray(updatedStory.scene_breakdown) ? updatedStory.scene_breakdown : [];
  const currentById = new Map(currentScenes.map((scene, index) => [sceneId(scene, index), scene]));
  const updatedById = new Map(updatedScenes.map((scene, index) => [sceneId(scene, index), scene]));
  const ids = new Set([...currentById.keys(), ...updatedById.keys()]);
  const changed: number[] = [];

  for (const id of ids) {
    if (stableJson(currentById.get(id)) !== stableJson(updatedById.get(id))) {
      changed.push(id);
    }
  }
  return changed.sort((a, b) => a - b);
}

function qualitySummary(story: StoryLike): UpdateProjectVersionResult['quality_summary'] {
  const quality = story.quality_report;
  if (!quality) return {};
  return {
    quality_passed: quality.passed,
    genre_score: quality.genre_score,
    quality_issue_count: Array.isArray(quality.issues) ? quality.issues.length : undefined,
  };
}

function openSupplementTaskCount(story: StoryLike): number | undefined {
  if (!Array.isArray(story.supplement_tasks)) return undefined;
  return story.supplement_tasks.filter(task => task?.status === 'open').length;
}

function inferProjectStatus(versionCount: number, currentStatus: string): string {
  if (versionCount > 1) return 'edited';
  return currentStatus || 'draft';
}

function fillMissingSnapshotFields(params: {
  project: ProjectMetaLike;
  currentStory: StoryLike;
  parsedStory: StoryLike;
  nextVersionId: string;
}): { story: StoryLike; preservedFields: string[]; warnings: string[] } {
  const preservedFields: string[] = [];
  const warnings: string[] = [];
  const story: StoryLike = {
    ...params.currentStory,
    ...params.parsedStory,
  };
  const projectSourceDomain = resolveStorySourceDomain({
    sourceDomain: params.project.source_domain,
  });
  const currentSourceDomain = asString(params.currentStory.sourceDomain).trim();
  const parsedSourceDomain = asString(params.parsedStory.sourceDomain).trim();
  if (currentSourceDomain && currentSourceDomain !== projectSourceDomain) {
    throw new Error(
      `当前 Story sourceDomain（${currentSourceDomain}）与项目 source_domain（${projectSourceDomain}）不一致`,
    );
  }
  if (parsedSourceDomain && parsedSourceDomain !== projectSourceDomain) {
    throw new Error(
      `snapshot_json sourceDomain（${parsedSourceDomain}）与项目 source_domain（${projectSourceDomain}）不一致`,
    );
  }

  for (const field of CRITICAL_STORY_FIELDS) {
    if (params.parsedStory[field] === undefined && params.currentStory[field] !== undefined) {
      story[field] = params.currentStory[field];
      preservedFields.push(field);
    }
  }

  story.project_id = params.project.project_id;
  story.current_version_id = params.nextVersionId;
  story.sourceDomain = projectSourceDomain;
  story.storyId = asString(story.storyId) || asString(params.currentStory.storyId) || params.project.current_story_id;
  story.video_type = asString(story.video_type) || asString(params.currentStory.video_type) || params.project.video_type;
  story.presentation_style = asString(story.presentation_style)
    || asString(params.currentStory.presentation_style)
    || params.project.presentation_style;
  story.source_entry = asString(story.source_entry) || asString(params.currentStory.source_entry) || params.project.source_entry;
  story.title = asString(story.title) || asString(params.currentStory.title) || params.project.title;
  story.story_structure = asString(story.story_structure) || asString(params.currentStory.story_structure) || params.project.story_structure;

  if (!Array.isArray(story.scene_breakdown)) {
    story.scene_breakdown = Array.isArray(params.currentStory.scene_breakdown) ? params.currentStory.scene_breakdown : [];
    warnings.push('snapshot_json 缺少 scene_breakdown，已沿用当前版本场景。');
  }
  if (!Array.isArray(story.gears_segments)) {
    story.gears_segments = Array.isArray(params.currentStory.gears_segments) ? params.currentStory.gears_segments : [];
    if (params.currentStory.gears_segments !== undefined) {
      warnings.push('snapshot_json 缺少 gears_segments，已沿用当前版本 GEARS 分段。');
    }
  }
  if (!story.storyId) throw new Error('snapshot_json 缺少 storyId，且当前项目无法补全');
  if (!story.video_type) throw new Error('snapshot_json 缺少 video_type，且当前项目无法补全');
  if (!story.title) throw new Error('snapshot_json 缺少 title，且当前项目无法补全');

  return { story, preservedFields, warnings };
}

async function nextVersionId(projectId: string, projectVersionCount: number): Promise<{ versionId: string; versionCount: number }> {
  let nextCount = Math.max(projectVersionCount, await versionFileCount(projectId)) + 1;
  let versionId = `${projectId}-v${nextCount}`;
  while (await pathExists(projectVersionPath(projectId, versionId))) {
    nextCount += 1;
    versionId = `${projectId}-v${nextCount}`;
  }
  return { versionId, versionCount: nextCount };
}

function buildUpdatedMeta(params: {
  project: ProjectMetaLike;
  story: StoryLike;
  versionId: string;
  versionCount: number;
  updatedAt: string;
}): ProjectMetaLike {
  const sceneBreakdown = Array.isArray(params.story.scene_breakdown) ? params.story.scene_breakdown : [];
  const gearsSegments = Array.isArray(params.story.gears_segments) ? params.story.gears_segments : [];
  const supplementTaskCount = openSupplementTaskCount(params.story);
  return {
    ...params.project,
    current_story_id: params.story.storyId ?? params.project.current_story_id,
    current_version_id: params.versionId,
    version_count: params.versionCount,
    updated_at: params.updatedAt,
    status: inferProjectStatus(params.versionCount, params.project.status),
    scene_count: sceneBreakdown.length,
    has_gears_segments: gearsSegments.length > 0,
    title: params.story.title ?? params.project.title,
    logline: params.story.logline,
    credibility_note: params.story.credibility_note,
    story_structure: params.story.story_structure,
    model_profile_id: params.story.model_profile_id,
    generation_source: params.story.generation_source,
    generation_mode: params.story.generation_mode ?? 'local_only',
    generation_used_fallback: params.story.generation_used_fallback ?? false,
    ...qualitySummary(params.story),
    open_supplement_task_count: supplementTaskCount,
    gears_video_status: params.story.gears_video?.status,
    gears_video_url: params.story.gears_video?.video_url,
    gears_video_thumbnail_url: params.story.gears_video?.thumbnail_url,
  };
}

export async function updateProjectVersion(input: UpdateProjectVersionInput): Promise<UpdateProjectVersionResult | null> {
  const projectId = input.project_id.trim();
  assertSafeId(projectId, '项目 ID');
  const context = await getProjectContext({ project_id: projectId, include_versions: true });
  if (!context) return null;

  const project = context.project as ProjectMetaLike;
  const currentStory = context.current_story as StoryLike;
  const parsedStory = parseSnapshotJson(input.snapshot_json);
  const next = await nextVersionId(projectId, project.version_count);
  const filled = fillMissingSnapshotFields({
    project,
    currentStory,
    parsedStory,
    nextVersionId: next.versionId,
  });
  const changedSceneIds = normalizeSceneIds(input.change_target?.scene_ids);
  const sceneIdsChanged = changedSceneIds.length ? changedSceneIds : inferChangedSceneIds(currentStory, filled.story);
  const updatedAt = new Date().toISOString();
  const note = input.user_instruction?.trim();
  const snapshot: ProjectVersionSnapshotLike = {
    project_id: projectId,
    version_id: next.versionId,
    created_at: updatedAt,
    change_type: input.change_type,
    scene_ids_changed: sceneIdsChanged,
    note: note || undefined,
    quality_report: filled.story.quality_report,
    story: filled.story,
  };
  const updatedMeta = buildUpdatedMeta({
    project,
    story: filled.story,
    versionId: next.versionId,
    versionCount: next.versionCount,
    updatedAt,
  });

  const snapshotPath = projectVersionPath(projectId, next.versionId);
  const metaPath = projectMetaPath(projectId);
  await writeJsonFile(snapshotPath, snapshot);
  await writeJsonFile(metaPath, updatedMeta);

  return {
    project_id: projectId,
    previous_version_id: project.current_version_id,
    version_id: next.versionId,
    current_version_id: updatedMeta.current_version_id,
    version_count: updatedMeta.version_count,
    updated_at: updatedMeta.updated_at,
    change_type: input.change_type,
    scene_ids_changed: sceneIdsChanged,
    snapshot_path: snapshotPath,
    project_path: metaPath,
    preserved_fields: filled.preservedFields,
    quality_summary: qualitySummary(filled.story),
    warnings: filled.warnings,
  };
}
