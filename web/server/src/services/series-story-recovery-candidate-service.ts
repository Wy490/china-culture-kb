import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { VideoTypeSchema } from '@shared/schemas.js';
import type {
  StoryAgentGeneratedHealthReport,
  StoryAgentSeriesStoryRecoveryCandidateItem,
  StoryAgentSeriesStoryRecoveryCandidateReport,
  StoryAgentSeriesStoryRecoveryCandidateStatus,
  StoryAgentSeriesStoryRecoveryCandidateStory,
} from '@shared/types.js';
import { storyGeneratedRoot } from '../platform/story-storage-root.js';
import { getStoryAgentGeneratedHealth } from './generated-health-service.js';

interface SeriesStoryRecoveryCandidateOptions {
  generatedRoot?: string;
  healthReport?: StoryAgentGeneratedHealthReport;
  limit?: number;
  now?: () => Date;
}

interface StoryEvidenceRecord {
  story_id: string;
  story_id_suffix: string;
  relative_path: string;
  sha256: string;
  title?: string;
  video_type?: StoryAgentSeriesStoryRecoveryCandidateStory['video_type'];
  source_entry?: string;
}

interface JsonFile {
  raw: string;
  record: Record<string, unknown>;
}

const SAFE_PROJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function portableRelativePath(root: string, filePath: string): string {
  return relative(root, filePath).split(sep).join('/');
}

function storyIdSuffix(storyId: string): string | undefined {
  const marker = '-story-';
  const markerIndex = storyId.lastIndexOf(marker);
  if (markerIndex < 0) return undefined;
  const suffix = storyId.slice(markerIndex + marker.length).trim();
  return suffix || undefined;
}

async function readJsonFile(filePath: string): Promise<JsonFile | undefined> {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!isObjectRecord(parsed)) return undefined;
    return { raw, record: parsed };
  } catch {
    return undefined;
  }
}

async function collectJsonPaths(directory: string): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const paths: string[] = [];
  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...await collectJsonPaths(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      paths.push(entryPath);
    }
  }
  return paths;
}

async function collectStoryEvidence(
  generatedRoot: string,
): Promise<{
  exactIds: Set<string>;
  bySuffix: Map<string, StoryEvidenceRecord[]>;
}> {
  const storyRoot = resolve(generatedRoot, 'stories');
  const exactIds = new Set<string>();
  const bySuffix = new Map<string, StoryEvidenceRecord[]>();
  for (const filePath of await collectJsonPaths(storyRoot)) {
    const json = await readJsonFile(filePath);
    if (!json) continue;
    const filenameStoryId = filePath.split(sep).at(-1)?.replace(/\.json$/, '');
    const storyId = stringField(json.record.storyId ?? json.record.story_id)
      ?? filenameStoryId;
    if (!storyId) continue;
    const suffix = storyIdSuffix(storyId);
    if (!suffix) continue;
    exactIds.add(storyId);
    const parsedVideoType = VideoTypeSchema.safeParse(json.record.video_type);
    const evidence: StoryEvidenceRecord = {
      story_id: storyId,
      story_id_suffix: suffix,
      relative_path: portableRelativePath(generatedRoot, filePath),
      sha256: sha256(json.raw),
      title: stringField(json.record.title),
      video_type: parsedVideoType.success ? parsedVideoType.data : undefined,
      source_entry: stringField(json.record.source_entry),
    };
    bySuffix.set(suffix, [...(bySuffix.get(suffix) ?? []), evidence]);
  }
  for (const candidates of bySuffix.values()) {
    candidates.sort((left, right) =>
      left.story_id.localeCompare(right.story_id));
  }
  return { exactIds, bySuffix };
}

function generatedEpisodeStoryIds(
  record: Record<string, unknown>,
): Array<{ episode_no: number; story_id: string }> {
  if (!isObjectRecord(record.generated_episode_story_ids)) return [];
  return Object.entries(record.generated_episode_story_ids)
    .map(([episodeNo, storyId]) => ({
      episode_no: Number(episodeNo),
      story_id: stringField(storyId),
    }))
    .filter((item): item is { episode_no: number; story_id: string } =>
      Number.isInteger(item.episode_no)
      && item.episode_no > 0
      && Boolean(item.story_id))
    .sort((left, right) => left.episode_no - right.episode_no);
}

function seriesProjectRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  return isObjectRecord(record.project) ? record.project : record;
}

function seriesPlanRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  return isObjectRecord(record.plan) ? record.plan : {};
}

function episodeTitle(
  record: Record<string, unknown>,
  episodeNo: number,
): string | undefined {
  const rawEpisodes = seriesPlanRecord(record).episodes;
  const episodes: unknown[] = Array.isArray(rawEpisodes)
    ? rawEpisodes
    : [];
  for (const episode of episodes) {
    if (!isObjectRecord(episode)) continue;
    if (Number(episode.episode_no) !== episodeNo) continue;
    return stringField(episode.title);
  }
  return undefined;
}

function contractEvidence(
  healthItem: StoryAgentGeneratedHealthReport['items'][number],
): string[] {
  const marker = healthItem.evidence.find(item =>
    item.startsWith('contract_evidence='));
  if (!marker) return [];
  const value = marker.slice('contract_evidence='.length);
  return value === 'none'
    ? []
    : value.split(',').map(item => item.trim()).filter(Boolean);
}

function candidateStatus(
  candidates: StoryEvidenceRecord[],
): StoryAgentSeriesStoryRecoveryCandidateStatus {
  if (candidates.length === 1) return 'unique_legacy_suffix_candidate';
  if (candidates.length > 1) return 'ambiguous_legacy_suffix_candidates';
  return 'no_candidate';
}

function recommendedAction(
  status: StoryAgentSeriesStoryRecoveryCandidateStatus,
): string {
  if (status === 'unique_legacy_suffix_candidate') {
    return '人工逐字段核对候选故事与系列分集合同；只有进入 operator whitelist 后，才能另行执行受控 relink。';
  }
  if (status === 'ambiguous_legacy_suffix_candidates') {
    return '多个故事共享旧 ID 后缀，禁止自动选择；恢复原快照或由操作员提供可审计的唯一映射证据。';
  }
  return '当前 generated stories 中没有同后缀候选；从可信历史恢复原 story JSON，或按当前合同重建新分集。';
}

function boundedLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 200;
  return Math.max(1, Math.min(Math.floor(limit ?? 200), 500));
}

function renderMarkdown(
  report: Omit<StoryAgentSeriesStoryRecoveryCandidateReport, 'markdown'>,
): string {
  return [
    '# Story Agent Series Story Recovery Candidates',
    '',
    `> schema_version: ${report.schema_version}`,
    `> generated_at: ${report.generated_at}`,
    `> read_only: ${report.boundary.read_only}`,
    `> operator_whitelist_required: ${report.boundary.operator_whitelist_required}`,
    `> automatic_relink_allowed: ${report.boundary.automatic_relink_allowed}`,
    `> project_files_modified: ${report.boundary.project_files_modified}`,
    `> story_files_written: ${report.boundary.story_files_written}`,
    `> publishable_delivery_credit_granted: ${report.boundary.publishable_delivery_credit_granted}`,
    '',
    '## Summary',
    '',
    `- active_relink_projects: ${report.summary.active_relink_project_count}`,
    `- missing_references: ${report.summary.missing_reference_count}`,
    `- returned_references: ${report.summary.returned_reference_count}`,
    `- unique_legacy_suffix_candidates: ${report.summary.unique_legacy_suffix_candidate_count}`,
    `- ambiguous_legacy_suffix_candidates: ${report.summary.ambiguous_legacy_suffix_candidate_count}`,
    `- no_candidate: ${report.summary.no_candidate_count}`,
    `- operator_whitelisted: ${report.summary.operator_whitelisted_count}`,
    `- auto_relink_eligible: ${report.summary.auto_relink_eligible_count}`,
    '',
    '## Candidates',
    '',
    ...(report.items.length
      ? report.items.map(item => [
          `- ${item.candidate_status} · ${item.series_project_id} · episode ${item.episode_no}`,
          `  - missing_story_id: ${item.missing_story_id}`,
          `  - suffix_candidates: ${item.candidate_stories.map(candidate => candidate.story_id).join(', ') || 'none'}`,
          `  - whitelist: ${item.operator_whitelist_status}`,
          `  - automatic_relink_eligible: ${item.automatic_relink_eligible}`,
          `  - next: ${item.recommended_action}`,
        ].join('\n'))
      : ['- none']),
    '',
    '## Notes',
    '',
    ...report.notes.map(note => `- ${note}`),
  ].join('\n').trim() + '\n';
}

export async function getStoryAgentSeriesStoryRecoveryCandidates(
  options: SeriesStoryRecoveryCandidateOptions = {},
): Promise<StoryAgentSeriesStoryRecoveryCandidateReport> {
  const generatedRoot = options.generatedRoot ?? storyGeneratedRoot();
  const healthReport = options.healthReport
    ?? await getStoryAgentGeneratedHealth();
  const relinkItems = healthReport.items.filter(item =>
    item.scope === 'ai_comic_series_project'
    && item.status === 'interrupted'
    && item.relink_candidate === true
    && item.signoff_eligible !== false);
  const stories = await collectStoryEvidence(generatedRoot);
  const items: StoryAgentSeriesStoryRecoveryCandidateItem[] = [];

  for (const healthItem of relinkItems) {
    if (!SAFE_PROJECT_ID.test(healthItem.project_id)) continue;
    const projectPath = resolve(
      generatedRoot,
      'ai-comic-series-projects',
      healthItem.project_id,
      'project.json',
    );
    const projectJson = await readJsonFile(projectPath);
    if (!projectJson) continue;
    const project = seriesProjectRecord(projectJson.record);
    for (const reference of generatedEpisodeStoryIds(projectJson.record)) {
      if (stories.exactIds.has(reference.story_id)) continue;
      const suffix = storyIdSuffix(reference.story_id);
      if (!suffix) continue;
      const candidates = stories.bySuffix.get(suffix) ?? [];
      const status = candidateStatus(candidates);
      items.push({
        series_project_id: healthItem.project_id,
        series_title: healthItem.title
          ?? stringField(project.title),
        episode_no: reference.episode_no,
        episode_title: episodeTitle(
          projectJson.record,
          reference.episode_no,
        ),
        missing_story_id: reference.story_id,
        missing_story_id_suffix: suffix,
        project_relative_path: portableRelativePath(
          generatedRoot,
          projectPath,
        ),
        project_sha256: sha256(projectJson.raw),
        contract_evidence: contractEvidence(healthItem),
        candidate_status: status,
        candidate_stories: candidates.map(candidate => ({
          story_id: candidate.story_id,
          relative_path: candidate.relative_path,
          sha256: candidate.sha256,
          title: candidate.title,
          video_type: candidate.video_type,
          source_entry: candidate.source_entry,
          match_basis: 'legacy_story_id_suffix',
          compatibility_confirmed: false,
        })),
        operator_whitelist_status: 'not_whitelisted',
        operator_whitelist_required: true,
        automatic_relink_eligible: false,
        recommended_action: recommendedAction(status),
      });
    }
  }

  items.sort((left, right) =>
    left.series_project_id.localeCompare(right.series_project_id)
    || left.episode_no - right.episode_no);
  const limitedItems = items.slice(0, boundedLimit(options.limit));
  const report: Omit<
    StoryAgentSeriesStoryRecoveryCandidateReport,
    'markdown'
  > = {
    schema_version:
      'story-agent-series-story-recovery-candidate-report/v1',
    generated_at: (options.now ?? (() => new Date()))().toISOString(),
    source_health_schema: healthReport.schema_version,
    summary: {
      active_relink_project_count: relinkItems.length,
      missing_reference_count: items.length,
      returned_reference_count: limitedItems.length,
      unique_legacy_suffix_candidate_count: items.filter(item =>
        item.candidate_status ===
        'unique_legacy_suffix_candidate').length,
      ambiguous_legacy_suffix_candidate_count: items.filter(item =>
        item.candidate_status ===
        'ambiguous_legacy_suffix_candidates').length,
      no_candidate_count: items.filter(item =>
        item.candidate_status === 'no_candidate').length,
      operator_whitelisted_count: 0,
      auto_relink_eligible_count: 0,
    },
    items: limitedItems,
    boundary: {
      read_only: true,
      operator_whitelist_required: true,
      automatic_relink_allowed: false,
      project_files_modified: false,
      story_files_written: false,
      signoff_portfolio_modified: false,
      publishable_delivery_credit_granted: false,
    },
    notes: [
      'A matching legacy story-ID suffix is only recovery evidence; it does not prove episode or series compatibility.',
      'No candidate is automatically relinked, including a unique suffix match.',
      'A future controlled writer must rerun canonical preflight, verify project/story hashes, and require an explicit human operator whitelist event.',
      'This report does not modify generated projects, stories, the signoff portfolio, or publishable-delivery credit.',
    ],
  };
  return {
    ...report,
    markdown: renderMarkdown(report),
  };
}
