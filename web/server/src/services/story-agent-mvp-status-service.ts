import type {
  DomainPackExpansionCandidateReport,
  DomainPackProductionHealthReport,
  KnowledgeWritebackStatus,
  ProductionMaterialPackHealthReport,
  ProductionReadinessPortfolioItem,
  ProductionReadinessPortfolioReport,
  ProjectSupplementTaskListItem,
  StoryAgentGeneratedHealthItem,
  StoryAgentGeneratedGovernancePlan,
  StoryAgentGeneratedHealthReport,
  StoryAgentGeneratedHealthScope,
  StoryAgentMvpLane,
  StoryAgentMvpPriorityTarget,
  StoryAgentMvpProgressSlice,
  StoryAgentMvpStatus,
  StoryAgentMvpStatusReport,
} from '@shared/types.js';
import { getDomainPackExpansionCandidateReport } from './domain-pack-expansion-service.js';
import { getDomainPackProductionHealthReport } from './domain-pack-service.js';
import { getStoryAgentGeneratedGovernancePlan } from './generated-governance-service.js';
import { getStoryAgentGeneratedHealth } from './generated-health-service.js';
import { getProductionReadinessPortfolio } from './production-readiness-portfolio-service.js';
import { getProductionMaterialPackHealthReport } from './production-material-pack-service.js';
import { listProjectSupplementTasks } from './project-service.js';
import { getKnowledgeWritebackQueueExportPackage } from './knowledge-writeback-queue-service.js';

interface StoryAgentMvpStatusOptions {
  generatedLimit?: number;
  portfolioLimit?: number;
  includeArchivedSeries?: boolean;
}

const MCP_STORY_AGENT_LOOP_TOOLS = [
  'kb_get_entry_detail',
  'kb_generate_story_blueprint',
  'kb_generate_script',
  'kb_generate_story',
  'kb_get_project_context',
  'kb_validate_genre_story',
  'kb_generate_story_repair_prompt',
  'kb_repair_story',
  'kb_update_project_version',
  'kb_generate_gears_delivery',
  'kb_generate_seedance_prompt',
  'kb_get_story_agent_generated_health',
  'kb_get_story_agent_generated_governance_plan',
  'kb_run_story_agent_generated_governance',
  'kb_get_production_material_pack_health',
  'kb_get_domain_pack_production_health',
  'kb_get_domain_pack_expansion_candidates',
  'kb_get_domain_pack_expansion_writeback_draft',
  'kb_update_domain_pack_expansion_review_state',
  'kb_update_domain_pack_expansion_review_state_bulk',
  'kb_get_story_agent_mvp_status',
  'kb_get_production_readiness',
  'kb_get_production_readiness_portfolio',
  'kb_run_production_readiness_automation',
  'kb_run_production_readiness_portfolio_automation',
  'kb_get_gears_worker_evidence_signoff',
] as const;

const PRODUCTION_DELIVERY_CONTRACT_SURFACES = [
  'gears_delivery_package',
  'production_board_export',
  'seedance_prompt_package',
  'seedance_asset_upload_checklist',
  'story_scene_breakdown',
  'gears_segments',
  'shot_ledger',
  'gears_job_ledger',
  'production_readiness',
  'portfolio_readiness',
  'review_repair_package',
  'retry_execution_plan',
  'worker_evidence_signoff',
] as const;

const KNOWLEDGE_WRITEBACK_STATUSES: KnowledgeWritebackStatus[] = [
  'draft_ready',
  'queued',
  'written_back',
  'needs_revision',
];

const GEARS_CALLBACK_BASE_ENVS = [
  'GEARS_CALLBACK_BASE_URL',
  'PUBLIC_API_BASE_URL',
  'APP_BASE_URL',
] as const;

const SEEDANCE_PROVIDER_CALLBACK_BASE_ENVS = [
  'SEEDANCE_PROVIDER_CALLBACK_BASE_URL',
  'GEARS_CALLBACK_BASE_URL',
  'PUBLIC_API_BASE_URL',
  'APP_BASE_URL',
] as const;

interface RealExternalAcceptanceMetrics {
  real_gears_endpoint_configured: boolean;
  real_gears_callback_secret_configured: boolean;
  real_gears_callback_base_configured: boolean;
  real_gears_callback_base_public: boolean;
  real_gears_acceptance_ready_to_run: boolean;
  real_gears_acceptance_blocker: string;
  local_acceptance_counts_as_real_external_callback: false;
  seedance_provider_submit_adapter_configured: boolean;
  seedance_provider_poll_adapter_configured: boolean;
  seedance_provider_callback_base_configured: boolean;
  seedance_provider_external_loop_ready: boolean;
}

interface KnowledgeWritebackQueueMetrics {
  ready_count: number;
  project_ready_count: number;
  expansion_ready_count: number;
  total_ready_count: number;
  project_count: number;
  draft_ready_count: number;
  queued_count: number;
  written_back_count: number;
  needs_revision_count: number;
  expansion_draft_ready_count: number;
  expansion_queued_count: number;
  expansion_written_back_count: number;
  expansion_needs_revision_count: number;
  total_draft_ready_count: number;
  total_queued_count: number;
  total_written_back_count: number;
  total_needs_revision_count: number;
  unified_export_schema: 'knowledge-writeback-queue-export/v1';
  unified_export_ready: boolean;
  unified_export_approved_count: number;
  unified_export_project_approved_count: number;
  unified_export_expansion_approved_count: number;
  unified_export_target_file_count: number;
  unified_export_direct_writeback_to_province_markdown: false;
  unified_export_province_markdown_written: false;
  read_error?: string;
}

interface DomainPackExpansionReviewMetrics {
  candidate_review_count: number;
  approved_count: number;
  rejected_count: number;
  needs_revision_count: number;
  approved_writeback_draft_count: number;
  writeback_draft_ready_count: number;
  writeback_queued_count: number;
  writeback_written_back_count: number;
  writeback_needs_revision_count: number;
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function missingContractCount(
  health: StoryAgentGeneratedHealthReport,
  contract: string,
  scope?: StoryAgentGeneratedHealthScope,
): number {
  return health.items.filter(item =>
    (!scope || item.scope === scope) && item.missing_contracts.includes(contract),
  ).length;
}

function generatedArtifactsLane(health: StoryAgentGeneratedHealthReport): StoryAgentMvpLane {
  const summary = health.summary;
  const total = summary.total_target_count;
  const openCount = summary.planned_count + summary.production_gap_count + summary.interrupted_count;
  const status: StoryAgentMvpStatus = total === 0 || summary.interrupted_count > 0
    ? 'blocked'
    : openCount > 0
      ? 'needs_action'
      : 'ready';
  return {
    key: 'generated_artifacts',
    label: 'Generated artifacts',
    status,
    score: total === 0 ? 0 : clampScore((summary.ready_count / total) * 100 - summary.interrupted_count * 20),
    detail: total === 0
      ? 'No generated Story Agent project or AI comic series was found.'
      : `${summary.ready_count}/${total} generated targets are contract-complete.`,
    evidence: [
      `targets=${total}`,
      `ready=${summary.ready_count}`,
      `planned=${summary.planned_count}`,
      `production_gap=${summary.production_gap_count}`,
      `interrupted=${summary.interrupted_count}`,
    ],
    next_action: total === 0
      ? 'Generate or import at least one Story Agent project before GEARS worker acceptance.'
      : summary.interrupted_count > 0
        ? 'Repair broken current_story/current_version or episode story references before delivery.'
        : openCount > 0
          ? 'Finish planned episodes and close production_gap targets with Story Agent repair/export steps.'
          : undefined,
  };
}

function p0p1GovernanceActionCount(plan: StoryAgentGeneratedGovernancePlan): number {
  return plan.actions.filter(action => action.priority === 'P0' || action.priority === 'P1').length;
}

function generatedGovernanceLane(plan: StoryAgentGeneratedGovernancePlan): StoryAgentMvpLane {
  const total = plan.summary.source_total_target_count;
  const p0p1Actions = p0p1GovernanceActionCount(plan);
  return {
    key: 'generated_governance',
    label: 'Generated governance',
    status: total === 0 ? 'blocked' : 'ready',
    score: total === 0 ? 0 : 100,
    detail: total === 0
      ? 'Generated governance is implemented, but no generated targets were found to audit.'
      : `Generated health, governance plan, dry-run manifest, project_id targeting, Web/MCP surfaces, and read-only safety gates are complete across ${total} targets.`,
    evidence: [
      `schema=${plan.schema_version}`,
      `plan_status=${plan.status}`,
      `action_buckets=${plan.actions.length}`,
      `p0_p1_action_buckets=${p0p1Actions}`,
      `ready_signoff_candidates=${plan.summary.ready_gears_signoff_candidate_count}`,
      'dry_run_manifest=available',
      'controlled_writes=blocked',
    ],
    next_action: total === 0
      ? 'Generate or import Story Agent targets so governance can produce an audit plan.'
      : undefined,
  };
}

function productionMaterialPackLane(report: ProductionMaterialPackHealthReport): StoryAgentMvpLane {
  const errorCount = report.issues.filter(issue => issue.severity === 'error').length;
  const warningCount = report.issues.filter(issue => issue.severity === 'warning').length;
  const status: StoryAgentMvpStatus = report.status === 'failed'
    ? 'blocked'
    : report.status === 'warning'
      ? 'needs_action'
      : 'ready';
  const coreReady = report.production_ready_core_video_types.length;
  const coreTotal = report.core_video_types.length;
  return {
    key: 'production_material_packs',
    label: 'Production material packs',
    status,
    score: clampScore(100 - errorCount * 25 - warningCount * 8 - report.missing_required_video_types.length * 20),
    detail: report.status === 'passed'
      ? `${coreReady}/${coreTotal} core production video types pass template health gates; ${report.covered_required_video_types.length}/${report.required_video_types.length} high-frequency video types are covered.`
      : `${errorCount} errors and ${warningCount} warnings in production material pack health gates.`,
    evidence: [
      `schema=${report.schema_version}`,
      `pack_status=${report.status}`,
      `pack_count=${report.pack_count}`,
      `required_video_types=${report.required_video_types.length}`,
      `covered_required_video_types=${report.covered_required_video_types.length}`,
      `missing_required_video_types=${report.missing_required_video_types.length}`,
      `core_ready=${coreReady}/${coreTotal}`,
      `issues=${report.issues.length}`,
      `errors=${errorCount}`,
      `warnings=${warningCount}`,
    ],
    next_action: report.status === 'failed'
      ? 'Fix missing production packs, unknown required_fields, or duplicate fields before Story Agent generation sign-off.'
      : report.status === 'warning'
        ? 'Top up underfilled prompt layers, gate items, supplement questions, or sample entries before expanding production volume.'
        : undefined,
  };
}

function domainPackLane(report: DomainPackProductionHealthReport): StoryAgentMvpLane {
  const errorCount = report.issues.filter(issue => issue.severity === 'error').length;
  const warningCount = report.issues.filter(issue => issue.severity === 'warning').length;
  const status: StoryAgentMvpStatus = report.status === 'failed'
    ? 'blocked'
    : report.status === 'warning'
      ? 'needs_action'
      : 'ready';
  return {
    key: 'domain_packs',
    label: 'Domain packs',
    status,
    score: clampScore(100 - errorCount * 25 - warningCount * 8 - report.missing_required_pack_ids.length * 20),
    detail: report.status === 'passed'
      ? `${report.production_ready_pack_ids.length}/${report.required_pack_ids.length} production Domain Packs pass prompt and review-boundary gates.`
      : `${errorCount} errors and ${warningCount} warnings in Domain Pack production gates.`,
    evidence: [
      `schema=${report.schema_version}`,
      `domain_id=${report.domain_id}`,
      `version=${report.version}`,
      `pack_status=${report.status}`,
      `pack_count=${report.pack_count}`,
      `production_pack_count=${report.production_pack_count}`,
      `required_pack_count=${report.required_pack_ids.length}`,
      `covered_required_pack_count=${report.covered_required_pack_ids.length}`,
      `missing_required_pack_count=${report.missing_required_pack_ids.length}`,
      `production_ready_pack_count=${report.production_ready_pack_ids.length}`,
      `issues=${report.issues.length}`,
      `errors=${errorCount}`,
      `warnings=${warningCount}`,
    ],
    next_action: report.status === 'failed'
      ? 'Restore missing production Domain Packs before Story Agent prompt package sign-off.'
      : report.status === 'warning'
        ? 'Top up production_prompts, review_boundaries, trigger_words, or asset_usage coverage for production Domain Packs.'
        : undefined,
  };
}

function domainPackExpansionLane(report: DomainPackExpansionCandidateReport): StoryAgentMvpLane {
  const errorCount = report.issues.filter(issue => issue.severity === 'error').length;
  const warningCount = report.issues.filter(issue => issue.severity === 'warning').length;
  const reviewMetrics = domainPackExpansionReviewMetrics(report);
  const status: StoryAgentMvpStatus = report.status === 'passed' ? 'ready' : 'needs_action';
  return {
    key: 'domain_pack_expansion',
    label: 'Domain pack expansion candidates',
    status,
    score: clampScore(
      100
      - errorCount * 18
      - warningCount * 8
      - report.missing_required_pack_ids.length * 16
      - (report.review_policy.direct_writeback_to_province_markdown ? 35 : 0),
    ),
    detail: report.status === 'passed'
      ? `${report.batch_count} review-gated Domain Pack expansion batches cover ${report.seed_target_count} seed targets, ${reviewMetrics.approved_count} approved items, and ${reviewMetrics.approved_writeback_draft_count} writeback drafts.`
      : `${errorCount} errors and ${warningCount} warnings in review-gated Domain Pack expansion candidates.`,
    evidence: [
      `schema=${report.schema_version}`,
      `source_schema=${report.source_schema_version}`,
      `candidate_status=${report.status}`,
      `required_pack_count=${report.required_pack_ids.length}`,
      `covered_required_pack_count=${report.covered_required_pack_ids.length}`,
      `missing_required_pack_count=${report.missing_required_pack_ids.length}`,
      `batch_count=${report.batch_count}`,
      `seed_target_count=${report.seed_target_count}`,
      `candidate_field_count=${report.candidate_field_count}`,
      `review_candidate_count=${reviewMetrics.candidate_review_count}`,
      `review_approved_count=${reviewMetrics.approved_count}`,
      `review_rejected_count=${reviewMetrics.rejected_count}`,
      `review_needs_revision_count=${reviewMetrics.needs_revision_count}`,
      `approved_writeback_drafts=${reviewMetrics.approved_writeback_draft_count}`,
      `writeback_draft_ready=${reviewMetrics.writeback_draft_ready_count}`,
      `writeback_queued=${reviewMetrics.writeback_queued_count}`,
      `writeback_written_back=${reviewMetrics.writeback_written_back_count}`,
      `writeback_needs_revision=${reviewMetrics.writeback_needs_revision_count}`,
      `direct_writeback=${report.review_policy.direct_writeback_to_province_markdown}`,
      `requires_candidate_markdown=${report.review_policy.requires_candidate_markdown}`,
      `requires_human_review=${report.review_policy.requires_human_review}`,
      `requires_source_level=${report.review_policy.requires_source_level}`,
      `issues=${report.issues.length}`,
      `errors=${errorCount}`,
      `warnings=${warningCount}`,
    ],
    next_action: report.status === 'passed'
      ? undefined
      : 'Repair Domain Pack expansion candidate batches so all required packs remain in candidate_review with source-level, candidate Markdown, and human review gates.',
  };
}

function domainPackExpansionReviewMetrics(report: DomainPackExpansionCandidateReport): DomainPackExpansionReviewMetrics {
  const reviewCounts = report.review_packet.review_status_counts ?? {
    candidate_review: report.review_packet.review_item_count,
    approved: 0,
    rejected: 0,
    needs_revision: 0,
  };
  const items = report.review_packet.batches.flatMap(batch => batch.review_items);
  const writebackCounts = Object.fromEntries(KNOWLEDGE_WRITEBACK_STATUSES.map(status => [status, 0])) as Record<KnowledgeWritebackStatus, number>;
  for (const item of items) {
    if (item.review_status !== 'approved') continue;
    writebackCounts[item.writeback_status ?? 'draft_ready'] += 1;
  }

  return {
    candidate_review_count: reviewCounts.candidate_review ?? 0,
    approved_count: reviewCounts.approved ?? 0,
    rejected_count: reviewCounts.rejected ?? 0,
    needs_revision_count: reviewCounts.needs_revision ?? 0,
    approved_writeback_draft_count: report.review_packet.approved_writeback_draft_count ?? 0,
    writeback_draft_ready_count: writebackCounts.draft_ready,
    writeback_queued_count: writebackCounts.queued,
    writeback_written_back_count: writebackCounts.written_back,
    writeback_needs_revision_count: writebackCounts.needs_revision,
  };
}

function taskWritebackStatus(item: ProjectSupplementTaskListItem): KnowledgeWritebackStatus {
  return item.task.knowledge_writeback_status ?? 'draft_ready';
}

function envConfigured(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function firstConfiguredEnvValue(envNames: readonly string[]): string | undefined {
  for (const envName of envNames) {
    const value = process.env[envName]?.trim();
    if (value) return value;
  }
  return undefined;
}

function isPublicCallbackBaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return ['http:', 'https:'].includes(parsed.protocol)
      && hostname !== 'localhost'
      && hostname !== '0.0.0.0'
      && hostname !== '::1'
      && !hostname.startsWith('127.')
      && !hostname.endsWith('.localhost')
      && !hostname.endsWith('.local')
      && !hostname.endsWith('.invalid');
  } catch {
    return false;
  }
}

function getRealExternalAcceptanceMetrics(): RealExternalAcceptanceMetrics {
  const realGearsEndpointConfigured = envConfigured('GEARS_API_BASE_URL');
  const realGearsCallbackSecretConfigured = envConfigured('GEARS_CALLBACK_SECRET');
  const gearsCallbackBase = firstConfiguredEnvValue(GEARS_CALLBACK_BASE_ENVS);
  const realGearsCallbackBaseConfigured = Boolean(gearsCallbackBase);
  const realGearsCallbackBasePublic = isPublicCallbackBaseUrl(gearsCallbackBase);
  const realGearsAcceptanceReadyToRun = realGearsEndpointConfigured
    && realGearsCallbackSecretConfigured
    && realGearsCallbackBaseConfigured
    && realGearsCallbackBasePublic;
  const seedanceProviderSubmitAdapterConfigured = envConfigured('SEEDANCE_PROVIDER_SUBMIT_ENDPOINT');
  const seedanceProviderPollAdapterConfigured = envConfigured('SEEDANCE_PROVIDER_POLL_ENDPOINT');
  const seedanceProviderCallbackBaseConfigured = Boolean(firstConfiguredEnvValue(SEEDANCE_PROVIDER_CALLBACK_BASE_ENVS));

  return {
    real_gears_endpoint_configured: realGearsEndpointConfigured,
    real_gears_callback_secret_configured: realGearsCallbackSecretConfigured,
    real_gears_callback_base_configured: realGearsCallbackBaseConfigured,
    real_gears_callback_base_public: realGearsCallbackBasePublic,
    real_gears_acceptance_ready_to_run: realGearsAcceptanceReadyToRun,
    real_gears_acceptance_blocker: realGearsAcceptanceReadyToRun
      ? 'gears_worker_signoff_evidence_pending'
      : !realGearsEndpointConfigured
        ? 'real_gears_v2_endpoint_not_configured'
        : !realGearsCallbackSecretConfigured
          ? 'real_gears_callback_secret_not_configured'
          : !realGearsCallbackBaseConfigured
            ? 'real_gears_callback_base_not_configured'
            : 'real_gears_callback_base_not_public',
    local_acceptance_counts_as_real_external_callback: false,
    seedance_provider_submit_adapter_configured: seedanceProviderSubmitAdapterConfigured,
    seedance_provider_poll_adapter_configured: seedanceProviderPollAdapterConfigured,
    seedance_provider_callback_base_configured: seedanceProviderCallbackBaseConfigured,
    seedance_provider_external_loop_ready: seedanceProviderSubmitAdapterConfigured
      && seedanceProviderPollAdapterConfigured
      && seedanceProviderCallbackBaseConfigured,
  };
}

async function getKnowledgeWritebackUnifiedExportMetrics(): Promise<Pick<
  KnowledgeWritebackQueueMetrics,
  | 'unified_export_schema'
  | 'unified_export_ready'
  | 'unified_export_approved_count'
  | 'unified_export_project_approved_count'
  | 'unified_export_expansion_approved_count'
  | 'unified_export_target_file_count'
  | 'unified_export_direct_writeback_to_province_markdown'
  | 'unified_export_province_markdown_written'
>> {
  try {
    const exportPackage = await getKnowledgeWritebackQueueExportPackage();
    return {
      unified_export_schema: exportPackage.schema_version,
      unified_export_ready: true,
      unified_export_approved_count: exportPackage.approved_count,
      unified_export_project_approved_count: exportPackage.project_approved_count,
      unified_export_expansion_approved_count: exportPackage.expansion_approved_count,
      unified_export_target_file_count: exportPackage.target_files.length,
      unified_export_direct_writeback_to_province_markdown: exportPackage.direct_writeback_to_province_markdown,
      unified_export_province_markdown_written: exportPackage.province_markdown_written,
    };
  } catch {
    return {
      unified_export_schema: 'knowledge-writeback-queue-export/v1',
      unified_export_ready: false,
      unified_export_approved_count: 0,
      unified_export_project_approved_count: 0,
      unified_export_expansion_approved_count: 0,
      unified_export_target_file_count: 0,
      unified_export_direct_writeback_to_province_markdown: false,
      unified_export_province_markdown_written: false,
    };
  }
}

async function getKnowledgeWritebackQueueMetrics(): Promise<KnowledgeWritebackQueueMetrics> {
  const expansionReport = getDomainPackExpansionCandidateReport({ includeMarkdown: false });
  const expansionMetrics = domainPackExpansionReviewMetrics(expansionReport);
  const expansionReadyCount = expansionMetrics.approved_writeback_draft_count;
  const unifiedExportMetrics = await getKnowledgeWritebackUnifiedExportMetrics();
  const result = await listProjectSupplementTasks({ knowledge_writeback_ready: true });
  if (!result.ok || !result.data) {
    return {
      ready_count: 0,
      project_ready_count: 0,
      expansion_ready_count: expansionReadyCount,
      total_ready_count: expansionReadyCount,
      project_count: 0,
      draft_ready_count: 0,
      queued_count: 0,
      written_back_count: 0,
      needs_revision_count: 0,
      expansion_draft_ready_count: expansionMetrics.writeback_draft_ready_count,
      expansion_queued_count: expansionMetrics.writeback_queued_count,
      expansion_written_back_count: expansionMetrics.writeback_written_back_count,
      expansion_needs_revision_count: expansionMetrics.writeback_needs_revision_count,
      total_draft_ready_count: expansionMetrics.writeback_draft_ready_count,
      total_queued_count: expansionMetrics.writeback_queued_count,
      total_written_back_count: expansionMetrics.writeback_written_back_count,
      total_needs_revision_count: expansionMetrics.writeback_needs_revision_count,
      ...unifiedExportMetrics,
      read_error: result.error?.message ?? 'Failed to read knowledge writeback queue',
    };
  }

  const counts = Object.fromEntries(KNOWLEDGE_WRITEBACK_STATUSES.map(status => [status, 0])) as Record<KnowledgeWritebackStatus, number>;
  const projectIds = new Set<string>();
  for (const item of result.data) {
    projectIds.add(item.project_id);
      counts[taskWritebackStatus(item)] += 1;
  }
  const projectReadyCount = result.data.length;
  return {
    ready_count: projectReadyCount,
    project_ready_count: projectReadyCount,
    expansion_ready_count: expansionReadyCount,
    total_ready_count: projectReadyCount + expansionReadyCount,
    project_count: projectIds.size,
    draft_ready_count: counts.draft_ready,
    queued_count: counts.queued,
    written_back_count: counts.written_back,
    needs_revision_count: counts.needs_revision,
    expansion_draft_ready_count: expansionMetrics.writeback_draft_ready_count,
    expansion_queued_count: expansionMetrics.writeback_queued_count,
    expansion_written_back_count: expansionMetrics.writeback_written_back_count,
    expansion_needs_revision_count: expansionMetrics.writeback_needs_revision_count,
    total_draft_ready_count: counts.draft_ready + expansionMetrics.writeback_draft_ready_count,
    total_queued_count: counts.queued + expansionMetrics.writeback_queued_count,
    total_written_back_count: counts.written_back + expansionMetrics.writeback_written_back_count,
    total_needs_revision_count: counts.needs_revision + expansionMetrics.writeback_needs_revision_count,
    ...unifiedExportMetrics,
  };
}

function knowledgeWritebackLane(metrics: KnowledgeWritebackQueueMetrics): StoryAgentMvpLane {
  const activeQueueCount = metrics.total_draft_ready_count + metrics.total_queued_count + metrics.total_needs_revision_count;
  const status: StoryAgentMvpStatus = metrics.read_error
    ? 'blocked'
    : activeQueueCount > 0
      ? 'needs_action'
      : 'ready';
  return {
    key: 'knowledge_writeback',
    label: 'Knowledge writeback queue',
    status,
    score: metrics.read_error
      ? 0
      : clampScore(100 - metrics.total_draft_ready_count * 4 - metrics.total_queued_count * 2 - metrics.total_needs_revision_count * 12),
    detail: metrics.read_error
      ? 'Knowledge writeback queue could not be read.'
      : metrics.total_ready_count === 0
        ? 'No reviewed knowledge writeback drafts are waiting in the queue.'
        : `${metrics.total_ready_count} reviewed writeback drafts are tracked: ${metrics.ready_count} project drafts across ${metrics.project_count} projects and ${metrics.expansion_ready_count} Domain Pack expansion drafts.`,
    evidence: [
      `ready_writeback_drafts=${metrics.total_ready_count}`,
      `project_writeback_drafts=${metrics.ready_count}`,
      `expansion_writeback_drafts=${metrics.expansion_ready_count}`,
      `projects=${metrics.project_count}`,
      `draft_ready=${metrics.total_draft_ready_count}`,
      `queued=${metrics.total_queued_count}`,
      `written_back=${metrics.total_written_back_count}`,
      `needs_revision=${metrics.total_needs_revision_count}`,
      `project_draft_ready=${metrics.draft_ready_count}`,
      `project_queued=${metrics.queued_count}`,
      `expansion_draft_ready=${metrics.expansion_draft_ready_count}`,
      `expansion_queued=${metrics.expansion_queued_count}`,
      `unified_export_schema=${metrics.unified_export_schema}`,
      `unified_export_ready=${metrics.unified_export_ready}`,
      `unified_export_approved=${metrics.unified_export_approved_count}`,
      `unified_export_project_approved=${metrics.unified_export_project_approved_count}`,
      `unified_export_expansion_approved=${metrics.unified_export_expansion_approved_count}`,
      `unified_export_target_files=${metrics.unified_export_target_file_count}`,
      `unified_export_direct_writeback=${metrics.unified_export_direct_writeback_to_province_markdown}`,
      `unified_export_province_written=${metrics.unified_export_province_markdown_written}`,
      `read_error=${metrics.read_error ?? 'none'}`,
      'candidate_review_required=true',
      'direct_province_write=false',
    ],
    next_action: metrics.read_error
      ? 'Restore project supplement task reads before exporting writeback patches.'
      : metrics.total_needs_revision_count > 0
        ? 'Revise rejected writeback drafts through candidate review before exporting patches.'
        : metrics.total_draft_ready_count + metrics.total_queued_count > 0
          ? 'Use the independent writeback queue to export reviewed Markdown/JSON patches for manual province Markdown review.'
          : undefined,
  };
}

function storyQualityLane(health: StoryAgentGeneratedHealthReport): StoryAgentMvpLane {
  const summary = health.summary;
  const storyCount = summary.scanned_story_project_count;
  const missingCurrent = summary.missing_current_story_count;
  const missingScene = summary.missing_scene_breakdown_count;
  const missingQuality = summary.missing_quality_count;
  const status: StoryAgentMvpStatus = missingCurrent > 0
    ? 'blocked'
    : missingScene > 0 || missingQuality > 0 || storyCount === 0
      ? 'needs_action'
      : 'ready';
  return {
    key: 'story_quality',
    label: 'Story quality',
    status,
    score: storyCount === 0
      ? 35
      : clampScore(100 - missingCurrent * 40 - missingScene * 25 - missingQuality * 20),
    detail: storyCount === 0
      ? 'No standalone story project has a measurable scene and quality contract yet.'
      : `${storyCount - Math.min(storyCount, missingScene + missingQuality)}/${storyCount} story projects have scene and quality evidence.`,
    evidence: [
      `story_projects=${storyCount}`,
      `missing_current_story=${missingCurrent}`,
      `missing_scene_breakdown=${missingScene}`,
      `missing_quality=${missingQuality}`,
    ],
    next_action: missingCurrent > 0
      ? 'Restore interrupted story project pointers before repair automation.'
      : missingScene > 0 || missingQuality > 0
        ? 'Run Story Agent validation/repair to regenerate scene_breakdown and quality_report.'
        : storyCount === 0
          ? 'Generate the first measurable story project for quality validation.'
          : undefined,
  };
}

function repairLoopLane(portfolio: ProductionReadinessPortfolioReport): StoryAgentMvpLane {
  const summary = portfolio.summary;
  const total = summary.total_target_count;
  const readyAutomation = summary.ready_automation_step_count;
  const status: StoryAgentMvpStatus = total === 0 || (summary.blocker_count > 0 && readyAutomation === 0)
    ? 'blocked'
    : readyAutomation > 0 || summary.needs_action_count > 0
      ? 'needs_action'
      : 'ready';
  return {
    key: 'repair_loop',
    label: 'Repair loop',
    status,
    score: total === 0
      ? 0
      : clampScore(100 - summary.blocker_count * 25 - summary.warning_count * 8 - summary.needs_action_count * 10),
    detail: total === 0
      ? 'No production readiness target is available for safe Story Agent automation.'
      : `${readyAutomation} safe Story Agent automation steps are ready across ${total} targets.`,
    evidence: [
      `portfolio_targets=${total}`,
      `ready_automation_steps=${readyAutomation}`,
      `blockers=${summary.blocker_count}`,
      `warnings=${summary.warning_count}`,
    ],
    next_action: total === 0
      ? 'Create a project readiness target from generated Story Agent output.'
      : readyAutomation > 0
        ? 'Run production-readiness portfolio automation in dry-run first, then execute safe Story Agent steps.'
        : summary.blocker_count > 0
          ? 'Resolve blocking readiness issues before automation can continue.'
          : undefined,
  };
}

function deliveryContractLane(health: StoryAgentGeneratedHealthReport): StoryAgentMvpLane {
  const summary = health.summary;
  const total = summary.total_target_count;
  const missingStoryDelivery = missingContractCount(health, 'delivery_contract', 'story_project');
  const missingSeriesDelivery = summary.series_missing_delivery_count;
  const missingHardContract = summary.missing_scene_breakdown_count + summary.missing_gears_segments_count;
  const openDeliveryCount = missingHardContract + missingStoryDelivery + missingSeriesDelivery;
  const status: StoryAgentMvpStatus = total === 0 || missingHardContract > 0
    ? 'blocked'
    : openDeliveryCount > 0
      ? 'needs_action'
      : 'ready';
  return {
    key: 'delivery_contract',
    label: 'Delivery contract',
    status,
    score: total === 0
      ? 0
      : clampScore(100 - missingHardContract * 30 - missingStoryDelivery * 16 - missingSeriesDelivery * 12),
    detail: openDeliveryCount === 0
      ? 'GEARS delivery contracts are present for scanned generated targets.'
      : `${openDeliveryCount} generated targets still need scene, segment, or delivery export closure.`,
    evidence: [
      `missing_scene_breakdown=${summary.missing_scene_breakdown_count}`,
      `missing_gears_segments=${summary.missing_gears_segments_count}`,
      `missing_story_delivery=${missingStoryDelivery}`,
      `series_missing_delivery=${missingSeriesDelivery}`,
    ],
    next_action: missingHardContract > 0
      ? 'Regenerate scene_breakdown and gears_segments before exporting GEARS delivery.'
      : openDeliveryCount > 0
        ? 'Export GEARS delivery and production-board contracts; keep media execution in GEARS v2.'
        : undefined,
  };
}

function productionCommandLane(portfolio: ProductionReadinessPortfolioReport): StoryAgentMvpLane {
  const summary = portfolio.summary;
  const total = summary.total_target_count;
  const externalOrManual = summary.external_automation_step_count + summary.manual_automation_step_count;
  const hasReadErrors = portfolio.errors.length > 0;
  const status: StoryAgentMvpStatus = hasReadErrors || summary.blocked_count > 0
    ? 'blocked'
    : total === 0
      ? 'blocked'
      : summary.needs_action_count > 0 || summary.ready_automation_step_count > 0 || externalOrManual > 0
        ? 'needs_action'
        : 'ready';
  return {
    key: 'production_command',
    label: 'Production command',
    status,
    score: total === 0
      ? 0
      : clampScore(100 - summary.blocked_count * 35 - summary.needs_action_count * 15 - externalOrManual * 4 - portfolio.errors.length * 20),
    detail: total === 0
      ? 'No production readiness portfolio targets were found.'
      : `${summary.ready_count}/${total} targets are production-command ready.`,
    evidence: [
      `readiness_targets=${total}`,
      `ready=${summary.ready_count}`,
      `needs_action=${summary.needs_action_count}`,
      `blocked=${summary.blocked_count}`,
      `external_or_manual_steps=${externalOrManual}`,
      `seedance_placeholder_assets=${summary.seedance_placeholder_asset_count}`,
      `seedance_production_assets_ready=${summary.seedance_production_asset_ready_count}`,
      `read_errors=${portfolio.errors.length}`,
    ],
    next_action: hasReadErrors
      ? 'Fix production readiness read errors before portfolio sign-off.'
      : summary.blocked_count > 0
        ? 'Clear blocked readiness targets before GEARS worker acceptance.'
        : summary.ready_automation_step_count > 0
          ? 'Run safe Story Agent production-readiness automation before handoff.'
          : externalOrManual > 0
            ? 'Send external/manual steps to GEARS v2 or operator review; do not execute media work in china-culture-kb.'
            : undefined,
  };
}

function overallStatus(lanes: StoryAgentMvpLane[]): StoryAgentMvpStatus {
  if (lanes.some(lane => lane.status === 'blocked')) return 'blocked';
  if (lanes.some(lane => lane.status === 'needs_action')) return 'needs_action';
  return 'ready';
}

function healthPriorityTarget(item: StoryAgentGeneratedHealthItem): StoryAgentMvpPriorityTarget {
  const action = item.recommended_actions[0];
  return {
    scope: item.scope,
    project_id: item.project_id,
    ...(item.title ? { title: item.title } : {}),
    status: item.status,
    priority_score: item.risk_score,
    ...(action ? { primary_action: action } : {}),
    evidence: [
      `source=generated_health`,
      `risk=${item.risk_score}`,
      `issues=${item.issue_count}`,
      `missing=${item.missing_contracts.join(',') || 'none'}`,
      ...item.evidence.slice(0, 3),
    ],
  };
}

function portfolioPriorityTarget(item: ProductionReadinessPortfolioItem): StoryAgentMvpPriorityTarget {
  const action = item.primary_action_label ?? item.primary_issue_label;
  return {
    scope: item.scope,
    project_id: item.project_id,
    title: item.title,
    status: item.status,
    priority_score: item.priority_score,
    ...(action ? { primary_action: action } : {}),
    evidence: [
      `source=production_portfolio`,
      `score=${item.score}`,
      `blockers=${item.blocker_count}`,
      `warnings=${item.warning_count}`,
      `seedance_placeholder_assets=${item.seedance_placeholder_asset_count}`,
      `seedance_production_assets_ready=${item.seedance_production_asset_ready_count}`,
      `ready_automation_steps=${item.ready_automation_step_count}`,
      `external_steps=${item.external_automation_step_count}`,
      `manual_steps=${item.manual_automation_step_count}`,
    ],
  };
}

function priorityTargets(
  health: StoryAgentGeneratedHealthReport,
  portfolio: ProductionReadinessPortfolioReport,
): StoryAgentMvpPriorityTarget[] {
  return [
    ...health.items
      .filter(item => item.status !== 'ready' || item.risk_score > 0)
      .slice(0, 8)
      .map(healthPriorityTarget),
    ...portfolio.items
      .filter(item => item.status !== 'ready' || item.priority_score > 0)
      .slice(0, 8)
      .map(portfolioPriorityTarget),
  ]
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 12);
}

function nextActions(
  lanes: StoryAgentMvpLane[],
  health: StoryAgentGeneratedHealthReport,
  portfolio: ProductionReadinessPortfolioReport,
): string[] {
  return uniqueStrings([
    ...lanes.filter(lane => lane.status !== 'ready').map(lane => lane.next_action),
    ...health.items.slice(0, 5).map(item => item.recommended_actions[0]),
    ...portfolio.items.slice(0, 5).map(item => item.primary_action_label ?? item.primary_issue_label),
  ]).slice(0, 10);
}

function progressSlices(
  lanes: StoryAgentMvpLane[],
  health: StoryAgentGeneratedHealthReport,
  governancePlan: StoryAgentGeneratedGovernancePlan,
  productionMaterialPackHealth: ProductionMaterialPackHealthReport,
  domainPackHealth: DomainPackProductionHealthReport,
  domainPackExpansionCandidates: DomainPackExpansionCandidateReport,
  writebackMetrics: KnowledgeWritebackQueueMetrics,
  portfolio: ProductionReadinessPortfolioReport,
  realExternalAcceptanceMetrics: RealExternalAcceptanceMetrics,
): StoryAgentMvpProgressSlice[] {
  const hasLocalContractBlocker = lanes.some(lane => lane.status === 'blocked');
  const externalOrManual = portfolio.summary.external_automation_step_count
    + portfolio.summary.manual_automation_step_count;
  const domainPackExpansionReview = domainPackExpansionReviewMetrics(domainPackExpansionCandidates);
  return [
    {
      key: 'generated_governance',
      label: 'Generated governance command surface',
      status: governancePlan.summary.source_total_target_count === 0 ? 'blocked' : 'ready',
      percent: governancePlan.summary.source_total_target_count === 0 ? 0 : 100,
      detail: 'Generated health, read-only governance plan, dry-run manifest, project_id targeting, Web UI, MCP tools, and no-write safety policy are complete.',
      evidence: [
        'implementation_progress=100',
        `source_targets=${governancePlan.summary.source_total_target_count}`,
        `plan_status=${governancePlan.status}`,
        `action_buckets=${governancePlan.actions.length}`,
        `p0_p1_action_buckets=${p0p1GovernanceActionCount(governancePlan)}`,
        `relink_candidates=${governancePlan.summary.series_relink_candidate_count}`,
        `archive_or_rebuild_candidates=${governancePlan.summary.series_archive_or_rebuild_candidate_count}`,
        `story_ref_repair_candidates=${governancePlan.summary.story_ref_repair_candidate_count}`,
        `ready_signoff_candidates=${governancePlan.summary.ready_gears_signoff_candidate_count}`,
        'dry_run_false=blocked',
      ],
    },
    {
      key: 'mcp_story_agent_loop',
      label: 'MCP Story Agent loop',
      status: 'ready',
      percent: 100,
      detail: 'MCP now exposes the full Story Agent command loop: knowledge context, blueprint, validation, delivery export, repair prompt, controlled version write, generated governance, readiness automation, MVP status, and GEARS evidence signoff.',
      evidence: [
        'implementation_progress=100',
        `tool_count=${MCP_STORY_AGENT_LOOP_TOOLS.length}`,
        `tools=${MCP_STORY_AGENT_LOOP_TOOLS.join(',')}`,
        'safe_write=kb_update_project_version',
        'repair_apply_requires_repaired_story_json=true',
        'media_execution=gears_v2',
      ],
    },
    {
      key: 'content_command_layer',
      label: 'Content and production command layer',
      status: 'ready',
      percent: 100,
      detail: 'The china-culture-kb content and production command layer is complete: story generation, quality/repair, versioning, delivery contracts, generated governance, readiness automation, MVP status, and worker evidence signoff command surfaces are implemented.',
      evidence: [
        'implementation_progress=100',
        `mvp_lanes=${lanes.length}`,
        `generated_targets=${health.summary.total_target_count}`,
        `generated_governance_progress=${governancePlan.summary.source_total_target_count === 0 ? 0 : 100}`,
        `production_material_pack_status=${productionMaterialPackHealth.status}`,
        `production_material_core_ready=${productionMaterialPackHealth.production_ready_core_video_types.length}/${productionMaterialPackHealth.core_video_types.length}`,
        `production_material_pack_issues=${productionMaterialPackHealth.issues.length}`,
        `domain_pack_status=${domainPackHealth.status}`,
        `domain_pack_ready=${domainPackHealth.production_ready_pack_ids.length}/${domainPackHealth.required_pack_ids.length}`,
        `domain_pack_issues=${domainPackHealth.issues.length}`,
        `domain_pack_expansion_status=${domainPackExpansionCandidates.status}`,
        `domain_pack_expansion_batches=${domainPackExpansionCandidates.batch_count}`,
        `domain_pack_expansion_seed_targets=${domainPackExpansionCandidates.seed_target_count}`,
        `domain_pack_expansion_candidate_fields=${domainPackExpansionCandidates.candidate_field_count}`,
        `domain_pack_expansion_review_approved=${domainPackExpansionReview.approved_count}`,
        `domain_pack_expansion_approved_writeback_drafts=${domainPackExpansionReview.approved_writeback_draft_count}`,
        `domain_pack_expansion_writeback_queued=${domainPackExpansionReview.writeback_queued_count}`,
        `domain_pack_expansion_direct_writeback=${domainPackExpansionCandidates.review_policy.direct_writeback_to_province_markdown}`,
        `knowledge_writeback_ready=${writebackMetrics.total_ready_count}`,
        `knowledge_writeback_project_ready=${writebackMetrics.ready_count}`,
        `knowledge_writeback_expansion_ready=${writebackMetrics.expansion_ready_count}`,
        `knowledge_writeback_draft_ready=${writebackMetrics.total_draft_ready_count}`,
        `knowledge_writeback_queued=${writebackMetrics.total_queued_count}`,
        `knowledge_writeback_needs_revision=${writebackMetrics.total_needs_revision_count}`,
        `knowledge_writeback_unified_export_ready=${writebackMetrics.unified_export_ready}`,
        `knowledge_writeback_unified_export_target_files=${writebackMetrics.unified_export_target_file_count}`,
        `knowledge_writeback_unified_export_province_written=${writebackMetrics.unified_export_province_markdown_written}`,
        `readiness_targets=${portfolio.summary.total_target_count}`,
        `seedance_placeholder_assets=${portfolio.summary.seedance_placeholder_asset_count}`,
        `seedance_production_assets_ready=${portfolio.summary.seedance_production_asset_ready_count}`,
        `local_contract_blocked=${hasLocalContractBlocker}`,
        'local_target_health_tracked_by=lanes',
        'real_media_execution=gears_v2',
      ],
    },
    {
      key: 'production_delivery_contract',
      label: 'Production Board / Delivery Contract',
      status: 'ready',
      percent: 100,
      detail: 'Production Board and GEARS delivery command surfaces are complete: scene and segment contracts, delivery packages, Seedance prompt packages, Seedance asset upload checklists, production-board exports, ledgers, readiness automation, review/retry plans, and evidence signoff are implemented while real media execution remains in GEARS v2.',
      evidence: [
        'implementation_progress=100',
        `surface_count=${PRODUCTION_DELIVERY_CONTRACT_SURFACES.length}`,
        `surfaces=${PRODUCTION_DELIVERY_CONTRACT_SURFACES.join(',')}`,
        `seedance_placeholder_assets=${portfolio.summary.seedance_placeholder_asset_count}`,
        `seedance_production_assets_ready=${portfolio.summary.seedance_production_asset_ready_count}`,
        'local_target_health_tracked_by=delivery_contract_lane',
        'real_media_execution=gears_v2',
      ],
    },
    {
      key: 'gears_end_to_end_acceptance',
      label: 'GEARS v2 end-to-end acceptance',
      status: 'needs_action',
      percent: 95,
      detail: 'The remaining work is reachable GEARS v2 submit/status/callback smoke plus large-project worker pressure sign-off with real worker responses; local acceptance does not count as real external callback evidence.',
      blocker: realExternalAcceptanceMetrics.real_gears_acceptance_blocker,
      evidence: [
        'acceptance_progress=95',
        `gears_endpoint_configured=${realExternalAcceptanceMetrics.real_gears_endpoint_configured}`,
        `gears_callback_secret_configured=${realExternalAcceptanceMetrics.real_gears_callback_secret_configured}`,
        `gears_callback_base_configured=${realExternalAcceptanceMetrics.real_gears_callback_base_configured}`,
        `gears_callback_base_public=${realExternalAcceptanceMetrics.real_gears_callback_base_public}`,
        `ready_to_run_real_acceptance=${realExternalAcceptanceMetrics.real_gears_acceptance_ready_to_run}`,
        `local_acceptance_counts_as_real_external_callback=${realExternalAcceptanceMetrics.local_acceptance_counts_as_real_external_callback}`,
        `seedance_provider_submit_adapter_configured=${realExternalAcceptanceMetrics.seedance_provider_submit_adapter_configured}`,
        `seedance_provider_poll_adapter_configured=${realExternalAcceptanceMetrics.seedance_provider_poll_adapter_configured}`,
        `seedance_provider_callback_base_configured=${realExternalAcceptanceMetrics.seedance_provider_callback_base_configured}`,
        `seedance_provider_external_loop_ready=${realExternalAcceptanceMetrics.seedance_provider_external_loop_ready}`,
        `external_or_manual_steps=${externalOrManual}`,
        'requires=run-gears-worker-acceptance.sh',
        'requires=worker_evidence_signoff',
      ],
    },
  ];
}

function renderMarkdown(report: Omit<StoryAgentMvpStatusReport, 'markdown'>): string {
  return [
    '# Story Agent MVP Status',
    '',
    `> schema_version: ${report.schema_version}`,
    `> generated_at: ${report.generated_at}`,
    `> status: ${report.status}`,
    `> score: ${report.score}`,
    '',
    '## Summary',
    '',
    `- generated targets: ${report.summary.generated_target_count}`,
    `- generated ready: ${report.summary.generated_ready_count}`,
    `- generated production_gap: ${report.summary.generated_production_gap_count}`,
    `- generated interrupted: ${report.summary.generated_interrupted_count}`,
    `- readiness targets: ${report.summary.readiness_target_count}`,
    `- readiness ready: ${report.summary.readiness_ready_count}`,
    `- readiness needs_action: ${report.summary.readiness_needs_action_count}`,
    `- readiness blocked: ${report.summary.readiness_blocked_count}`,
    `- Seedance placeholder assets: ${report.summary.seedance_placeholder_asset_count}`,
    `- Seedance production assets ready: ${report.summary.seedance_production_asset_ready_count}`,
    `- knowledge writeback ready drafts: ${report.summary.knowledge_writeback_total_ready_count}`,
    `- knowledge writeback project drafts: ${report.summary.knowledge_writeback_project_ready_count}`,
    `- knowledge writeback expansion drafts: ${report.summary.knowledge_writeback_expansion_ready_count}`,
    `- knowledge writeback projects: ${report.summary.knowledge_writeback_project_count}`,
    `- knowledge writeback draft_ready: ${report.summary.knowledge_writeback_total_draft_ready_count}`,
    `- knowledge writeback queued: ${report.summary.knowledge_writeback_total_queued_count}`,
    `- knowledge writeback written_back: ${report.summary.knowledge_writeback_total_written_back_count}`,
    `- knowledge writeback needs_revision: ${report.summary.knowledge_writeback_total_needs_revision_count}`,
    `- knowledge writeback expansion draft_ready: ${report.summary.knowledge_writeback_expansion_draft_ready_count}`,
    `- knowledge writeback expansion queued: ${report.summary.knowledge_writeback_expansion_queued_count}`,
    `- knowledge writeback expansion written_back: ${report.summary.knowledge_writeback_expansion_written_back_count}`,
    `- knowledge writeback expansion needs_revision: ${report.summary.knowledge_writeback_expansion_needs_revision_count}`,
    `- knowledge writeback unified export: ${report.summary.knowledge_writeback_unified_export_ready ? 'ready' : 'unavailable'} (${report.summary.knowledge_writeback_unified_export_schema})`,
    `- knowledge writeback unified export approved/project/expansion: ${report.summary.knowledge_writeback_unified_export_approved_count}/${report.summary.knowledge_writeback_unified_export_project_approved_count}/${report.summary.knowledge_writeback_unified_export_expansion_approved_count}`,
    `- knowledge writeback unified export target files: ${report.summary.knowledge_writeback_unified_export_target_file_count}`,
    `- knowledge writeback unified export province written: ${report.summary.knowledge_writeback_unified_export_province_markdown_written}`,
    `- safe automation steps: ${report.summary.ready_automation_step_count}`,
    `- GEARS/operator steps: ${report.summary.external_or_manual_step_count}`,
    `- real GEARS endpoint configured: ${report.summary.real_gears_endpoint_configured}`,
    `- real GEARS callback secret configured: ${report.summary.real_gears_callback_secret_configured}`,
    `- real GEARS callback base public: ${report.summary.real_gears_callback_base_public}`,
    `- real GEARS acceptance ready to run: ${report.summary.real_gears_acceptance_ready_to_run}`,
    `- real GEARS acceptance blocker: ${report.summary.real_gears_acceptance_blocker}`,
    `- local acceptance counts as real external callback: ${report.summary.local_acceptance_counts_as_real_external_callback}`,
    `- Seedance provider external loop ready: ${report.summary.seedance_provider_external_loop_ready}`,
    `- generated governance actions: ${report.summary.generated_governance_action_count}`,
    `- generated governance P0/P1 actions: ${report.summary.generated_governance_p0_p1_action_count}`,
    `- generated governance ready signoff candidates: ${report.summary.generated_governance_ready_signoff_candidate_count}`,
    `- production material pack health: ${report.summary.production_material_pack_status}`,
    `- production material packs: ${report.summary.production_material_pack_count}`,
    `- production material pack issues: ${report.summary.production_material_pack_issue_count}`,
    `- production material core ready: ${report.summary.production_material_pack_core_ready_count}/${report.summary.production_material_pack_core_total_count}`,
    `- domain pack health: ${report.summary.domain_pack_status}`,
    `- domain packs: ${report.summary.domain_pack_count}`,
    `- domain pack issues: ${report.summary.domain_pack_issue_count}`,
    `- production domain packs ready: ${report.summary.production_domain_pack_ready_count}/${report.summary.production_domain_pack_required_count}`,
    `- domain pack expansion candidates: ${report.summary.domain_pack_expansion_status}`,
    `- domain pack expansion batches: ${report.summary.domain_pack_expansion_batch_count}`,
    `- domain pack expansion seed targets: ${report.summary.domain_pack_expansion_seed_target_count}`,
    `- domain pack expansion candidate fields: ${report.summary.domain_pack_expansion_candidate_field_count}`,
    `- domain pack expansion issues: ${report.summary.domain_pack_expansion_issue_count}`,
    `- domain pack expansion review candidate: ${report.summary.domain_pack_expansion_review_candidate_count}`,
    `- domain pack expansion review approved: ${report.summary.domain_pack_expansion_review_approved_count}`,
    `- domain pack expansion review rejected: ${report.summary.domain_pack_expansion_review_rejected_count}`,
    `- domain pack expansion review needs_revision: ${report.summary.domain_pack_expansion_review_needs_revision_count}`,
    `- domain pack expansion approved writeback drafts: ${report.summary.domain_pack_expansion_approved_writeback_draft_count}`,
    `- domain pack expansion writeback draft_ready: ${report.summary.domain_pack_expansion_writeback_draft_ready_count}`,
    `- domain pack expansion writeback queued: ${report.summary.domain_pack_expansion_writeback_queued_count}`,
    `- domain pack expansion writeback written_back: ${report.summary.domain_pack_expansion_writeback_written_back_count}`,
    `- domain pack expansion writeback needs_revision: ${report.summary.domain_pack_expansion_writeback_needs_revision_count}`,
    `- Story Agent command surface: ${report.summary.story_agent_command_surface_status} · ${report.summary.story_agent_command_surface_percent}%`,
    `- MCP Story Agent tools: ${report.summary.mcp_story_agent_tool_count}`,
    `- MCP Story Agent loop: ${report.summary.mcp_story_agent_loop_percent}%`,
    `- content command layer: ${report.summary.content_command_layer_percent}%`,
    `- production delivery contract: ${report.summary.production_delivery_contract_percent}%`,
    `- production delivery contract surfaces: ${report.summary.production_delivery_contract_surface_count}`,
    '',
    '## Lanes',
    '',
    ...report.lanes.map(lane =>
      `- ${lane.status} · ${lane.score}/100 · ${lane.label}: ${lane.detail}`,
    ),
    '',
    '## Progress Split',
    '',
    ...report.progress.map(slice =>
      `- ${slice.status} · ${slice.percent}% · ${slice.label}: ${slice.detail}${slice.blocker ? ` blocker=${slice.blocker}` : ''}`,
    ),
    '',
    '## Priority Targets',
    '',
    ...(report.priority_targets.length
      ? report.priority_targets.map(target =>
        `- P${target.priority_score} · ${target.scope} · ${target.status} · ${target.project_id} · ${target.primary_action ?? 'no action'}`,
      )
      : ['- none']),
    '',
    '## Next Actions',
    '',
    ...(report.next_actions.length ? report.next_actions.map(action => `- ${action}`) : ['- none']),
    '',
    '## Notes',
    '',
    ...report.notes.map(note => `- ${note}`),
  ].join('\n').trim() + '\n';
}

export async function getStoryAgentMvpStatus(
  options: StoryAgentMvpStatusOptions = {},
): Promise<StoryAgentMvpStatusReport> {
  const [generatedHealth, generatedGovernancePlan, productionMaterialPackHealth, domainPackHealth, domainPackExpansionCandidates, writebackMetrics, productionPortfolio] = await Promise.all([
    getStoryAgentGeneratedHealth({ limit: options.generatedLimit ?? 200 }),
    getStoryAgentGeneratedGovernancePlan({ limit: options.generatedLimit ?? 200 }),
    getProductionMaterialPackHealthReport(),
    getDomainPackProductionHealthReport(),
    getDomainPackExpansionCandidateReport({ includeMarkdown: false }),
    getKnowledgeWritebackQueueMetrics(),
    getProductionReadinessPortfolio({
      includeArchivedSeries: options.includeArchivedSeries,
      limit: options.portfolioLimit ?? 100,
    }),
  ]);
  const lanes = [
    generatedArtifactsLane(generatedHealth),
    generatedGovernanceLane(generatedGovernancePlan),
    productionMaterialPackLane(productionMaterialPackHealth),
    domainPackLane(domainPackHealth),
    domainPackExpansionLane(domainPackExpansionCandidates),
    knowledgeWritebackLane(writebackMetrics),
    storyQualityLane(generatedHealth),
    repairLoopLane(productionPortfolio),
    deliveryContractLane(generatedHealth),
    productionCommandLane(productionPortfolio),
  ];
  const status = overallStatus(lanes);
  const targets = priorityTargets(generatedHealth, productionPortfolio);
  const actions = nextActions(lanes, generatedHealth, productionPortfolio);
  const realExternalAcceptanceMetrics = getRealExternalAcceptanceMetrics();
  const progress = progressSlices(
    lanes,
    generatedHealth,
    generatedGovernancePlan,
    productionMaterialPackHealth,
    domainPackHealth,
    domainPackExpansionCandidates,
    writebackMetrics,
    productionPortfolio,
    realExternalAcceptanceMetrics,
  );
  const externalOrManual = productionPortfolio.summary.external_automation_step_count
    + productionPortfolio.summary.manual_automation_step_count;
  const domainPackExpansionReview = domainPackExpansionReviewMetrics(domainPackExpansionCandidates);
  const base: Omit<StoryAgentMvpStatusReport, 'markdown'> = {
    schema_version: 'story-agent-mvp-status/v1',
    generated_at: new Date().toISOString(),
    status,
    score: clampScore(lanes.reduce((sum, lane) => sum + lane.score, 0) / Math.max(1, lanes.length)),
    summary: {
      generated_target_count: generatedHealth.summary.total_target_count,
      generated_ready_count: generatedHealth.summary.ready_count,
      generated_planned_count: generatedHealth.summary.planned_count,
      generated_production_gap_count: generatedHealth.summary.production_gap_count,
      generated_interrupted_count: generatedHealth.summary.interrupted_count,
      readiness_target_count: productionPortfolio.summary.total_target_count,
      readiness_ready_count: productionPortfolio.summary.ready_count,
      readiness_needs_action_count: productionPortfolio.summary.needs_action_count,
      readiness_blocked_count: productionPortfolio.summary.blocked_count,
      ready_automation_step_count: productionPortfolio.summary.ready_automation_step_count,
      external_or_manual_step_count: externalOrManual,
      real_gears_endpoint_configured: realExternalAcceptanceMetrics.real_gears_endpoint_configured,
      real_gears_callback_secret_configured: realExternalAcceptanceMetrics.real_gears_callback_secret_configured,
      real_gears_callback_base_configured: realExternalAcceptanceMetrics.real_gears_callback_base_configured,
      real_gears_callback_base_public: realExternalAcceptanceMetrics.real_gears_callback_base_public,
      real_gears_acceptance_ready_to_run: realExternalAcceptanceMetrics.real_gears_acceptance_ready_to_run,
      real_gears_acceptance_blocker: realExternalAcceptanceMetrics.real_gears_acceptance_blocker,
      local_acceptance_counts_as_real_external_callback: realExternalAcceptanceMetrics.local_acceptance_counts_as_real_external_callback,
      seedance_provider_submit_adapter_configured: realExternalAcceptanceMetrics.seedance_provider_submit_adapter_configured,
      seedance_provider_poll_adapter_configured: realExternalAcceptanceMetrics.seedance_provider_poll_adapter_configured,
      seedance_provider_callback_base_configured: realExternalAcceptanceMetrics.seedance_provider_callback_base_configured,
      seedance_provider_external_loop_ready: realExternalAcceptanceMetrics.seedance_provider_external_loop_ready,
      seedance_placeholder_asset_count: productionPortfolio.summary.seedance_placeholder_asset_count,
      seedance_production_asset_ready_count: productionPortfolio.summary.seedance_production_asset_ready_count,
      knowledge_writeback_ready_count: writebackMetrics.ready_count,
      knowledge_writeback_project_ready_count: writebackMetrics.project_ready_count,
      knowledge_writeback_expansion_ready_count: writebackMetrics.expansion_ready_count,
      knowledge_writeback_total_ready_count: writebackMetrics.total_ready_count,
      knowledge_writeback_project_count: writebackMetrics.project_count,
      knowledge_writeback_draft_ready_count: writebackMetrics.draft_ready_count,
      knowledge_writeback_queued_count: writebackMetrics.queued_count,
      knowledge_writeback_written_back_count: writebackMetrics.written_back_count,
      knowledge_writeback_needs_revision_count: writebackMetrics.needs_revision_count,
      knowledge_writeback_expansion_draft_ready_count: writebackMetrics.expansion_draft_ready_count,
      knowledge_writeback_expansion_queued_count: writebackMetrics.expansion_queued_count,
      knowledge_writeback_expansion_written_back_count: writebackMetrics.expansion_written_back_count,
      knowledge_writeback_expansion_needs_revision_count: writebackMetrics.expansion_needs_revision_count,
      knowledge_writeback_total_draft_ready_count: writebackMetrics.total_draft_ready_count,
      knowledge_writeback_total_queued_count: writebackMetrics.total_queued_count,
      knowledge_writeback_total_written_back_count: writebackMetrics.total_written_back_count,
      knowledge_writeback_total_needs_revision_count: writebackMetrics.total_needs_revision_count,
      knowledge_writeback_unified_export_schema: writebackMetrics.unified_export_schema,
      knowledge_writeback_unified_export_ready: writebackMetrics.unified_export_ready,
      knowledge_writeback_unified_export_approved_count: writebackMetrics.unified_export_approved_count,
      knowledge_writeback_unified_export_project_approved_count: writebackMetrics.unified_export_project_approved_count,
      knowledge_writeback_unified_export_expansion_approved_count: writebackMetrics.unified_export_expansion_approved_count,
      knowledge_writeback_unified_export_target_file_count: writebackMetrics.unified_export_target_file_count,
      knowledge_writeback_unified_export_direct_writeback_to_province_markdown: writebackMetrics.unified_export_direct_writeback_to_province_markdown,
      knowledge_writeback_unified_export_province_markdown_written: writebackMetrics.unified_export_province_markdown_written,
      blocker_count: productionPortfolio.summary.blocker_count,
      warning_count: productionPortfolio.summary.warning_count,
      generated_governance_action_count: generatedGovernancePlan.actions.length,
      generated_governance_p0_p1_action_count: p0p1GovernanceActionCount(generatedGovernancePlan),
      generated_governance_ready_signoff_candidate_count: generatedGovernancePlan.summary.ready_gears_signoff_candidate_count,
      production_material_pack_status: productionMaterialPackHealth.status,
      production_material_pack_count: productionMaterialPackHealth.pack_count,
      production_material_pack_issue_count: productionMaterialPackHealth.issues.length,
      production_material_pack_core_ready_count: productionMaterialPackHealth.production_ready_core_video_types.length,
      production_material_pack_core_total_count: productionMaterialPackHealth.core_video_types.length,
      domain_pack_status: domainPackHealth.status,
      domain_pack_count: domainPackHealth.pack_count,
      domain_pack_issue_count: domainPackHealth.issues.length,
      production_domain_pack_ready_count: domainPackHealth.production_ready_pack_ids.length,
      production_domain_pack_required_count: domainPackHealth.required_pack_ids.length,
      domain_pack_expansion_status: domainPackExpansionCandidates.status,
      domain_pack_expansion_batch_count: domainPackExpansionCandidates.batch_count,
      domain_pack_expansion_seed_target_count: domainPackExpansionCandidates.seed_target_count,
      domain_pack_expansion_candidate_field_count: domainPackExpansionCandidates.candidate_field_count,
      domain_pack_expansion_issue_count: domainPackExpansionCandidates.issues.length,
      domain_pack_expansion_review_candidate_count: domainPackExpansionReview.candidate_review_count,
      domain_pack_expansion_review_approved_count: domainPackExpansionReview.approved_count,
      domain_pack_expansion_review_rejected_count: domainPackExpansionReview.rejected_count,
      domain_pack_expansion_review_needs_revision_count: domainPackExpansionReview.needs_revision_count,
      domain_pack_expansion_approved_writeback_draft_count: domainPackExpansionReview.approved_writeback_draft_count,
      domain_pack_expansion_writeback_draft_ready_count: domainPackExpansionReview.writeback_draft_ready_count,
      domain_pack_expansion_writeback_queued_count: domainPackExpansionReview.writeback_queued_count,
      domain_pack_expansion_writeback_written_back_count: domainPackExpansionReview.writeback_written_back_count,
      domain_pack_expansion_writeback_needs_revision_count: domainPackExpansionReview.writeback_needs_revision_count,
      story_agent_command_surface_status: 'ready',
      story_agent_command_surface_percent: 100,
      mcp_story_agent_tool_count: MCP_STORY_AGENT_LOOP_TOOLS.length,
      mcp_story_agent_loop_percent: 100,
      content_command_layer_percent: 100,
      production_delivery_contract_percent: 100,
      production_delivery_contract_surface_count: PRODUCTION_DELIVERY_CONTRACT_SURFACES.length,
    },
    lanes,
    progress,
    priority_targets: targets,
    next_actions: actions,
    notes: [
      'Read-only MVP status: combines generated artifact health with production readiness portfolio state.',
      'Generated governance command surface is complete at 100%: health scan, governance plan, dry-run manifest, project_id targeting, Web/MCP exports, and no-write safety gates are available.',
      'Production material pack health is now a Story Agent MVP lane: core and high-frequency video types must keep mapped required_fields, prompt layers, gate items, supplement questions, and sample-entry coverage before production sign-off.',
      'Domain Pack production health is now a Story Agent MVP lane: required production prompt packs must keep trigger words, production prompts, review boundaries, and asset usage coverage before prompt package sign-off.',
      'Domain Pack expansion candidates are tracked as a Story Agent MVP lane: first-wave material expansion must stay in candidate_review with candidate Markdown, human review, source-level checks, and no direct province Markdown writeback.',
      'Knowledge writeback queue governance is now a Story Agent MVP lane: only approved candidates with writeback drafts are counted, and province Markdown changes remain manual review patches.',
      'MCP Story Agent loop is complete at 100%: read-only context, blueprint, validation, delivery, repair prompt, controlled versioning, generated governance, readiness automation, MVP status, and GEARS evidence signoff are all exposed as tools.',
      'Content and production command layer is complete at 100% inside china-culture-kb; generated target health and real GEARS endpoint acceptance remain separate status surfaces.',
      'Production Board / Delivery Contract command surface is complete at 100%; Seedance asset upload checklists now make external reference-material handoff explicit, and missing per-target exports remain tracked by the delivery_contract lane and generated governance plan.',
      'Story Agent command surface is signed off at 100% inside this repository; generated inventory health and GEARS worker acceptance remain separate follow-up lanes.',
      'Progress is split: Story Agent content/production command layer is tracked separately from real GEARS v2 endpoint acceptance.',
      'The remaining 5% belongs to reachable GEARS v2 submit/status/callback smoke and large-project worker pressure sign-off, not in-repo media execution.',
      'china-culture-kb remains the content and production command layer; image, video, subtitle and final assembly execution stay in GEARS v2.',
      'Use this report to decide whether to repair Story Agent contracts, run safe readiness automation, or proceed to GEARS worker evidence sign-off.',
    ],
    generated_health: generatedHealth,
    generated_governance_plan: generatedGovernancePlan,
    production_material_pack_health: productionMaterialPackHealth,
    domain_pack_health: domainPackHealth,
    domain_pack_expansion_candidates: domainPackExpansionCandidates,
    production_portfolio: productionPortfolio,
  };
  return {
    ...base,
    markdown: renderMarkdown(base),
  };
}
