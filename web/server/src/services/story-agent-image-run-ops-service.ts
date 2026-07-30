import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import type {
  StoryAgentImageRun,
  StoryAgentImageRunOpsItem,
  StoryAgentImageRunOpsRecommendedAction,
  StoryAgentImageRunOpsReport,
} from '@shared/types.js';
import { storyGeneratedRoot } from '../platform/story-storage-root.js';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 250;
const DEFAULT_STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const IMAGE_RUN_SCHEMA = 'story-agent-image-run/v1';
const STORY_RUN_SCHEMAS = new Set([
  'story-agent-run/v1',
  'story-agent-run/v2',
]);

interface StoryAgentImageRunOpsOptions {
  generatedRoot?: string;
  limit?: number;
  staleAfterMs?: number;
  now?: () => Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function portableRelativePath(root: string, path: string): string {
  return relative(root, path).split(sep).join('/');
}

async function directoryEntries(path: string): Promise<Dirent[]> {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function readRecord(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function safeLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(value as number)));
}

function safeStaleAfterMs(value: number | undefined): number {
  if (!Number.isFinite(value) || (value as number) <= 0) {
    return DEFAULT_STALE_AFTER_MS;
  }
  return Math.trunc(value as number);
}

function runIsOpen(run: StoryAgentImageRun): boolean {
  return run.status !== 'complete';
}

function countTasks(
  run: StoryAgentImageRun,
  statuses: Set<StoryAgentImageRun['tasks'][number]['status']>,
): number {
  return run.tasks.filter(task => statuses.has(task.status)).length;
}

function recommendedAction(input: {
  run: StoryAgentImageRun;
  linkedStoryRunIds: string[];
}): StoryAgentImageRunOpsRecommendedAction {
  if (input.run.status === 'complete') return 'no_action_required';
  if (input.run.status === 'blocked') return 'inspect_blocked_image_run';
  if (input.linkedStoryRunIds.length > 0) {
    return 'resume_image_generation_after_operator_confirmation';
  }
  return 'operator_review_resume_or_cancel';
}

async function storyRunLinks(
  generatedRoot: string,
): Promise<Map<string, string[]>> {
  const links = new Map<string, string[]>();
  const root = resolve(generatedRoot, 'story-agent-runs');
  for (const entry of await directoryEntries(root)) {
    if (!entry.isDirectory()) continue;
    const record = await readRecord(resolve(root, entry.name, 'run.json'));
    if (
      !record
      || !STORY_RUN_SCHEMAS.has(String(record.schema_version))
      || typeof record.run_id !== 'string'
      || !isRecord(record.image_request_manifest)
      || typeof record.image_request_manifest.image_run_id !== 'string'
    ) {
      continue;
    }
    const imageRunId = record.image_request_manifest.image_run_id;
    links.set(imageRunId, [
      ...(links.get(imageRunId) ?? []),
      record.run_id,
    ]);
  }
  for (const runIds of links.values()) runIds.sort();
  return links;
}

function sortRank(item: StoryAgentImageRunOpsItem): number {
  if (item.status === 'blocked') return 0;
  if (item.stale && item.linked_story_agent_run_ids.length === 0) return 1;
  if (item.stale) return 2;
  if (item.status !== 'complete') return 3;
  return 4;
}

function markdownFor(report: Omit<StoryAgentImageRunOpsReport, 'markdown'>): string {
  const lines = [
    '# Story Agent Image Run Ops Report',
    '',
    `- Generated at: ${report.generated_at}`,
    `- Scanned runs: ${report.summary.scanned_run_count}`,
    `- Open / stale runs: ${report.summary.open_run_count} / ${report.summary.stale_run_count}`,
    `- Awaiting tasks: ${report.summary.awaiting_task_count}`,
    `- Linked Story Agent runs: ${report.summary.linked_story_agent_run_count}`,
    `- Unlinked open runs: ${report.summary.unlinked_open_run_count}`,
    '',
    'This report is read-only. Resume or cancellation requires an explicit operator decision.',
  ];
  return `${lines.join('\n')}\n`;
}

export async function getStoryAgentImageRunOpsReport(
  options: StoryAgentImageRunOpsOptions = {},
): Promise<StoryAgentImageRunOpsReport> {
  const generatedRoot = resolve(options.generatedRoot ?? storyGeneratedRoot());
  const now = options.now?.() ?? new Date();
  const nowMs = now.getTime();
  const staleAfterMs = safeStaleAfterMs(options.staleAfterMs);
  const links = await storyRunLinks(generatedRoot);
  const runRoot = resolve(generatedRoot, 'story-agent-image-runs');
  const allItems: StoryAgentImageRunOpsItem[] = [];
  let malformedRunCount = 0;

  for (const entry of await directoryEntries(runRoot)) {
    if (!entry.isDirectory()) continue;
    const path = resolve(runRoot, entry.name, 'run.json');
    const record = await readRecord(path);
    if (
      !record
      || record.schema_version !== IMAGE_RUN_SCHEMA
      || record.run_id !== entry.name
      || !Array.isArray(record.tasks)
      || !isRecord(record.request)
    ) {
      malformedRunCount += 1;
      continue;
    }
    const run = record as unknown as StoryAgentImageRun;
    const updatedMs = Date.parse(run.updated_at);
    const ageMs = Number.isFinite(updatedMs)
      ? Math.max(0, nowMs - updatedMs)
      : 0;
    const linkedStoryRunIds = links.get(run.run_id) ?? [];
    const open = runIsOpen(run);
    allItems.push({
      run_id: run.run_id,
      source: run.source,
      status: run.status,
      relative_path: portableRelativePath(generatedRoot, path),
      created_at: run.created_at,
      updated_at: run.updated_at,
      age_ms: ageMs,
      stale: open && ageMs >= staleAfterMs,
      task_count: run.tasks.length,
      awaiting_task_count: countTasks(run, new Set(['planned', 'awaiting_imagegen'])),
      verified_task_count: countTasks(run, new Set(['verified'])),
      failed_retryable_task_count: countTasks(run, new Set(['failed_retryable'])),
      blocked_task_count: countTasks(run, new Set(['blocked'])),
      provider_invoked: (record.request as Record<string, unknown>)
        .provider_invoked === true,
      linked_story_agent_run_ids: linkedStoryRunIds,
      recommended_action: recommendedAction({
        run,
        linkedStoryRunIds,
      }),
      automatic_close_eligible: false,
    });
  }

  allItems.sort((left, right) => (
    sortRank(left) - sortRank(right)
    || left.updated_at.localeCompare(right.updated_at)
    || left.run_id.localeCompare(right.run_id)
  ));
  const items = allItems.slice(0, safeLimit(options.limit));
  const openItems = allItems.filter(item => item.status !== 'complete');
  const reportWithoutMarkdown: Omit<StoryAgentImageRunOpsReport, 'markdown'> = {
    schema_version: 'story-agent-image-run-ops-report/v1',
    generated_at: now.toISOString(),
    stale_after_ms: staleAfterMs,
    summary: {
      scanned_run_count: allItems.length,
      returned_run_count: items.length,
      malformed_run_count: malformedRunCount,
      open_run_count: openItems.length,
      stale_run_count: allItems.filter(item => item.stale).length,
      blocked_run_count: allItems.filter(item => item.status === 'blocked').length,
      complete_run_count: allItems.filter(item => item.status === 'complete').length,
      awaiting_task_count: allItems.reduce(
        (total, item) => total + item.awaiting_task_count,
        0,
      ),
      failed_retryable_task_count: allItems.reduce(
        (total, item) => total + item.failed_retryable_task_count,
        0,
      ),
      blocked_task_count: allItems.reduce(
        (total, item) => total + item.blocked_task_count,
        0,
      ),
      linked_story_agent_run_count: allItems.filter(
        item => item.linked_story_agent_run_ids.length > 0,
      ).length,
      unlinked_open_run_count: openItems.filter(
        item => item.linked_story_agent_run_ids.length === 0,
      ).length,
      provider_invoked_run_count: allItems.filter(
        item => item.provider_invoked,
      ).length,
      automatic_close_eligible_count: 0,
    },
    items,
    boundary: {
      read_only: true,
      provider_invoked: false,
      image_run_files_modified: false,
      story_agent_run_files_modified: false,
      automatic_close_allowed: false,
      publishable_delivery_credit_granted: false,
    },
    notes: [
      'Stale means an open image run has not changed within the configured threshold.',
      'A linked Story Agent run should be resumed only after an operator confirms image generation.',
      'Unlinked runs require an operator resume-or-cancel decision; this report never closes them automatically.',
    ],
  };
  return {
    ...reportWithoutMarkdown,
    markdown: markdownFor(reportWithoutMarkdown),
  };
}
