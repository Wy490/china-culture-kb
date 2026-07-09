import {
  getStoryAgentGeneratedHealth,
  type StoryAgentGeneratedHealthItem,
  type StoryAgentGeneratedHealthReport,
} from './get-generated-health.js';
import {
  getStorySupplementCandidatePackageToolResult,
  type StorySupplementCandidatePackageToolResult,
} from './production-health-reports.js';

export interface GetStoryAgentBacklogHandoffInput {
  limit?: number;
  include_markdown?: boolean;
}

type BacklogPriority = 'P0' | 'P1' | 'P2' | 'P3';
type BacklogActionType =
  | 'repair_story_project_refs'
  | 'repair_delivery_contract'
  | 'complete_supplement_task'
  | 'restore_series_story_refs'
  | 'continue_series_generation'
  | 'repair_series_delivery';
type SupplementCandidateItem = StorySupplementCandidatePackageToolResult['items'][number];

interface StoryAgentBacklogHandoffItem {
  backlog_id: string;
  source_kind: 'generated_health' | 'supplement_candidate';
  priority: BacklogPriority;
  action_type: BacklogActionType;
  project_id: string;
  title?: string;
  status?: string;
  risk_score: number;
  reason: string;
  recommended_action: string;
  target_file?: string;
  task_key?: string;
  task_id?: string;
  video_type?: string;
  source_entry?: string;
  missing_contracts: string[];
  evidence: string[];
}

export interface StoryAgentBacklogHandoffReport {
  schema_version: 'mcp-story-agent-backlog-handoff/v1';
  generated_at: string;
  source_health_schema: 'mcp-story-agent-generated-health/v1';
  source_supplement_candidate_schema: 'project-supplement-candidate-package/v1' | '';
  direct_writeback_to_province_markdown: false;
  province_markdown_written: false;
  summary: {
    total_item_count: number;
    generated_health_item_count: number;
    supplement_candidate_item_count: number;
    interrupted_count: number;
    production_gap_count: number;
    missing_quality_count: number;
    open_supplement_candidate_count: number;
    supplement_blocking_open_count: number;
    supplement_risk_open_count: number;
    supplement_optional_open_count: number;
    p0_count: number;
    p1_count: number;
    p2_count: number;
    p3_count: number;
  };
  items: StoryAgentBacklogHandoffItem[];
  notes: string[];
  markdown?: string;
}

function boundedLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 30;
  return Math.max(1, Math.min(Math.floor(limit ?? 30), 100));
}

function priorityRank(priority: BacklogPriority): number {
  if (priority === 'P0') return 0;
  if (priority === 'P1') return 1;
  if (priority === 'P2') return 2;
  return 3;
}

function generatedAction(item: StoryAgentGeneratedHealthItem): BacklogActionType {
  if (item.scope === 'ai_comic_series_project') {
    if (item.missing_contracts.includes('generated_episode_story_refs')) return 'restore_series_story_refs';
    if (item.status === 'planned' || item.missing_contracts.includes('remaining_episodes')) return 'continue_series_generation';
    return 'repair_series_delivery';
  }
  if (item.missing_contracts.includes('current_story') || item.missing_contracts.includes('current_version')) {
    return 'repair_story_project_refs';
  }
  if (item.missing_contracts.length > 0) return 'repair_delivery_contract';
  return 'complete_supplement_task';
}

function generatedPriority(item: StoryAgentGeneratedHealthItem): BacklogPriority {
  if (
    item.status === 'interrupted'
    || item.missing_contracts.includes('current_story')
    || item.missing_contracts.includes('current_version')
  ) {
    return 'P0';
  }
  if (item.status === 'production_gap') return 'P1';
  if (item.status === 'planned') return 'P2';
  return 'P3';
}

function generatedReason(item: StoryAgentGeneratedHealthItem): string {
  if (item.status === 'interrupted') return 'Generated project refs or linked story artifacts are interrupted.';
  if (item.status === 'production_gap') return 'Generated artifact is missing command-layer delivery contracts.';
  if (item.status === 'planned') return 'Series target is planned but has no generated episode story artifacts yet.';
  return 'Generated target needs follow-up before final sign-off.';
}

function generatedNeedsBacklog(item: StoryAgentGeneratedHealthItem): boolean {
  return item.status !== 'ready' || item.missing_contracts.length > 0;
}

function generatedBacklogItem(item: StoryAgentGeneratedHealthItem): StoryAgentBacklogHandoffItem {
  return {
    backlog_id: `generated-health::${item.scope}::${item.project_id}`,
    source_kind: 'generated_health',
    priority: generatedPriority(item),
    action_type: generatedAction(item),
    project_id: item.project_id,
    title: item.title,
    status: item.status,
    risk_score: item.risk_score,
    reason: generatedReason(item),
    recommended_action: item.recommended_actions[0] ?? 'Review generated health evidence and repair the command-layer contract.',
    missing_contracts: item.missing_contracts,
    evidence: [
      ...item.evidence,
      `direct_writeback_to_province_markdown=false`,
      `province_markdown_written=false`,
    ],
  };
}

function supplementPriority(item: SupplementCandidateItem): BacklogPriority {
  if (item.task.blocking_level === 'blocking') return 'P0';
  if (item.task.blocking_level === 'risk') return 'P1';
  return 'P2';
}

function supplementRisk(priority: BacklogPriority): number {
  if (priority === 'P0') return 95;
  if (priority === 'P1') return 72;
  if (priority === 'P2') return 45;
  return 18;
}

function supplementBacklogItem(item: SupplementCandidateItem): StoryAgentBacklogHandoffItem {
  const priority = supplementPriority(item);
  return {
    backlog_id: `supplement-candidate::${item.task_key}`,
    source_kind: 'supplement_candidate',
    priority,
    action_type: 'complete_supplement_task',
    project_id: item.project_id,
    title: item.task.label || item.project_title,
    status: item.task.status,
    risk_score: supplementRisk(priority),
    reason: `${item.task.blocking_level} supplement gap from ${item.task.source}.`,
    recommended_action: item.task.intake_prompt
      ?? item.task.recommended_question
      ?? '补齐素材缺口并重新导出候选包。',
    target_file: item.suggested_file_path,
    task_key: item.task_key,
    task_id: item.task.task_id,
    video_type: item.video_type,
    source_entry: item.source_entry,
    missing_contracts: [],
    evidence: [
      `project_title=${item.project_title}`,
      `stage=${item.task.stage ?? 'unknown'}`,
      `blocking_level=${item.task.blocking_level}`,
      `source=${item.task.source}`,
      `recommended_fields=${item.task.recommended_fields?.join(',') || 'none'}`,
      `direct_writeback_to_province_markdown=false`,
      `province_markdown_written=false`,
    ],
  };
}

function summarize(
  items: StoryAgentBacklogHandoffItem[],
  health: StoryAgentGeneratedHealthReport,
  supplement: StorySupplementCandidatePackageToolResult,
): StoryAgentBacklogHandoffReport['summary'] {
  return {
    total_item_count: items.length,
    generated_health_item_count: items.filter(item => item.source_kind === 'generated_health').length,
    supplement_candidate_item_count: items.filter(item => item.source_kind === 'supplement_candidate').length,
    interrupted_count: health.summary.interrupted_count,
    production_gap_count: health.summary.production_gap_count,
    missing_quality_count: health.summary.missing_quality_count,
    open_supplement_candidate_count: supplement.open_task_count,
    supplement_blocking_open_count: supplement.blocking_open_count,
    supplement_risk_open_count: supplement.risk_open_count,
    supplement_optional_open_count: supplement.optional_open_count,
    p0_count: items.filter(item => item.priority === 'P0').length,
    p1_count: items.filter(item => item.priority === 'P1').length,
    p2_count: items.filter(item => item.priority === 'P2').length,
    p3_count: items.filter(item => item.priority === 'P3').length,
  };
}

function renderMarkdown(report: Omit<StoryAgentBacklogHandoffReport, 'markdown'>): string {
  return [
    '# MCP Story Agent Backlog Handoff',
    '',
    `> schema_version: ${report.schema_version}`,
    `> generated_at: ${report.generated_at}`,
    `> source_health_schema: ${report.source_health_schema}`,
    `> source_supplement_candidate_schema: ${report.source_supplement_candidate_schema || 'unavailable'}`,
    `> direct_writeback_to_province_markdown: ${report.direct_writeback_to_province_markdown}`,
    `> province_markdown_written: ${report.province_markdown_written}`,
    '',
    '## Summary',
    '',
    `- total_item_count: ${report.summary.total_item_count}`,
    `- generated_health_item_count: ${report.summary.generated_health_item_count}`,
    `- supplement_candidate_item_count: ${report.summary.supplement_candidate_item_count}`,
    `- interrupted_count: ${report.summary.interrupted_count}`,
    `- production_gap_count: ${report.summary.production_gap_count}`,
    `- missing_quality_count: ${report.summary.missing_quality_count}`,
    `- open_supplement_candidate_count: ${report.summary.open_supplement_candidate_count}`,
    `- supplement_open_by_level: blocking ${report.summary.supplement_blocking_open_count} / risk ${report.summary.supplement_risk_open_count} / optional ${report.summary.supplement_optional_open_count}`,
    `- priority: P0 ${report.summary.p0_count} / P1 ${report.summary.p1_count} / P2 ${report.summary.p2_count} / P3 ${report.summary.p3_count}`,
    '',
    '## Handoff Items',
    '',
    ...(report.items.length
      ? report.items.map(item => [
        `- ${item.priority} · ${item.source_kind} · ${item.action_type} · ${item.project_id}`,
        `  - title: ${item.title ?? 'untitled'}`,
        `  - reason: ${item.reason}`,
        `  - next: ${item.recommended_action}`,
      ].join('\n'))
      : ['- none']),
    '',
    '## Notes',
    '',
    ...report.notes.map(note => `- ${note}`),
  ].join('\n');
}

export async function getStoryAgentBacklogHandoff(
  input: GetStoryAgentBacklogHandoffInput = {},
): Promise<StoryAgentBacklogHandoffReport> {
  const [health, supplement] = await Promise.all([
    getStoryAgentGeneratedHealth({ limit: 100, include_markdown: false }),
    Promise.resolve(getStorySupplementCandidatePackageToolResult({ status: 'open', include_markdown: false })),
  ]);
  const items = [
    ...health.items.filter(generatedNeedsBacklog).map(generatedBacklogItem),
    ...supplement.items.map(supplementBacklogItem),
  ].sort((a, b) => (
    priorityRank(a.priority) - priorityRank(b.priority)
    || b.risk_score - a.risk_score
    || a.project_id.localeCompare(b.project_id)
  ));
  const limit = boundedLimit(input.limit);
  const visibleItems = items.slice(0, limit);
  const report: Omit<StoryAgentBacklogHandoffReport, 'markdown'> = {
    schema_version: 'mcp-story-agent-backlog-handoff/v1',
    generated_at: new Date().toISOString(),
    source_health_schema: health.schema_version,
    source_supplement_candidate_schema: supplement.schema_version,
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    summary: summarize(items, health, supplement),
    items: visibleItems,
    notes: [
      'Read-only handoff: joins MCP generated health and project supplement candidate packages.',
      'No data/provinces/*.md files are written; province markdown writeback remains manual-only.',
      visibleItems.length < items.length ? `items limited to ${visibleItems.length} of ${items.length}; summary covers the full handoff set.` : '',
    ].filter(Boolean),
  };
  return input.include_markdown === false ? report : { ...report, markdown: renderMarkdown(report) };
}
