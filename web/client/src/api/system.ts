import { apiGet, apiPost } from './client'
import type {
  AIModelProfile,
  GearsExecutionAcceptanceReport,
  GearsExecutionConfigInfo,
  GearsExecutionContractInfo,
  GearsExecutionGeneratedProjectPressureReport,
  GearsExternalCallbackBatchImportResult,
  GearsExternalCallbackHandoffQueuePackage,
  GearsExecutionLiveSmokeRunReport,
  GearsExecutionLiveSmokeRunRequest,
  GearsExecutionPressureReport,
  GearsExecutionReadinessReport,
  GearsExecutionSmokePackage,
  GearsExecutionWorkerAcceptanceKit,
  GearsExecutionWorkerEvidenceBundle,
  GearsExecutionWorkerEvidenceSignoffReport,
  GearsJobCallbackRequest,
  DomainPackExpansionCandidateReport,
  NarrativePatternCatalog,
  ProductionReadinessPortfolioReport,
  ProductionReadinessPortfolioRunRequest,
  ProductionReadinessPortfolioRunResult,
  ProvinceInfo,
  SeedanceProviderAdapterContractInfo,
  SeedanceProviderAdapterConfigInfo,
  StoryAgentGeneratedGovernancePlan,
  StoryAgentGeneratedGovernanceRunRequest,
  StoryAgentGeneratedGovernanceRunResult,
  StoryAgentGeneratedHealthReport,
  StoryAgentMvpStatusReport,
  TypeInfo,
} from '@shared/types'

export function getProvinces() {
  return apiGet<ProvinceInfo[]>('/system/provinces')
}

export function getTypes() {
  return apiGet<TypeInfo[]>('/system/types')
}

export function getRegions(province: string) {
  return apiGet<string[]>(`/system/regions?province=${encodeURIComponent(province)}`)
}

export function getModelProfiles() {
  return apiGet<AIModelProfile[]>('/system/models')
}

export function getNarrativePatternCatalog() {
  return apiGet<NarrativePatternCatalog>('/system/narrative-patterns')
}

export function getProductionReadinessPortfolio(options: { includeArchivedSeries?: boolean; limit?: number } = {}) {
  const params = new URLSearchParams()
  if (options.includeArchivedSeries) params.set('includeArchivedSeries', '1')
  if (typeof options.limit === 'number') params.set('limit', String(options.limit))
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiGet<ProductionReadinessPortfolioReport>(`/system/production-readiness-portfolio${suffix}`)
}

export function runProductionReadinessPortfolioAutomation(req: ProductionReadinessPortfolioRunRequest = { dry_run: false }) {
  return apiPost<ProductionReadinessPortfolioRunResult>('/system/production-readiness-portfolio/run-automation', req)
}

export function getGearsExternalCallbackHandoffQueue(options: { limit?: number } = {}) {
  const params = new URLSearchParams()
  if (typeof options.limit === 'number') params.set('limit', String(options.limit))
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiGet<GearsExternalCallbackHandoffQueuePackage>(`/system/gears-external-callback-handoff-queue${suffix}`)
}

export function preflightGearsExternalCallbackBatch(req: GearsJobCallbackRequest) {
  return apiPost<GearsExternalCallbackBatchImportResult>('/system/gears-external-callbacks/preflight', req)
}

export function importGearsExternalCallbackBatch(req: GearsJobCallbackRequest) {
  return apiPost<GearsExternalCallbackBatchImportResult>('/system/gears-external-callbacks/import', req)
}

export function getStoryAgentGeneratedHealth(options: { limit?: number } = {}) {
  const params = new URLSearchParams()
  if (typeof options.limit === 'number') params.set('limit', String(options.limit))
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiGet<StoryAgentGeneratedHealthReport>(`/system/story-agent-generated-health${suffix}`)
}

export function getStoryAgentGeneratedGovernancePlan(options: { limit?: number } = {}) {
  const params = new URLSearchParams()
  if (typeof options.limit === 'number') params.set('limit', String(options.limit))
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiGet<StoryAgentGeneratedGovernancePlan>(`/system/story-agent-generated-governance-plan${suffix}`)
}

export function runStoryAgentGeneratedGovernance(req: StoryAgentGeneratedGovernanceRunRequest = { dry_run: true }) {
  return apiPost<StoryAgentGeneratedGovernanceRunResult>('/system/story-agent-generated-governance-plan/run', req)
}

export function getStoryAgentMvpStatus(options: {
  generatedLimit?: number
  portfolioLimit?: number
  includeArchivedSeries?: boolean
} = {}) {
  const params = new URLSearchParams()
  if (typeof options.generatedLimit === 'number') params.set('generatedLimit', String(options.generatedLimit))
  if (typeof options.portfolioLimit === 'number') params.set('portfolioLimit', String(options.portfolioLimit))
  if (options.includeArchivedSeries) params.set('includeArchivedSeries', '1')
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiGet<StoryAgentMvpStatusReport>(`/system/story-agent-mvp-status${suffix}`)
}

export function getDomainPackExpansionCandidates(options: { includeMarkdown?: boolean } = {}) {
  const params = new URLSearchParams()
  if (options.includeMarkdown === false) params.set('include_markdown', 'false')
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiGet<DomainPackExpansionCandidateReport>(`/system/domain-pack-expansion-candidates${suffix}`)
}

export function getGearsExecutionConfig() {
  return apiGet<GearsExecutionConfigInfo>('/system/gears-execution-config')
}

export function getGearsExecutionContract() {
  return apiGet<GearsExecutionContractInfo>('/system/gears-execution-contract')
}

export function getGearsExecutionReadiness() {
  return apiGet<GearsExecutionReadinessReport>('/system/gears-execution-readiness')
}

export function getGearsExecutionSmokePackage() {
  return apiGet<GearsExecutionSmokePackage>('/system/gears-execution-smoke-package')
}

export function getGearsExecutionPressureReport() {
  return apiGet<GearsExecutionPressureReport>('/system/gears-execution-pressure-report')
}

export function getGearsExecutionGeneratedProjectPressureReport() {
  return apiGet<GearsExecutionGeneratedProjectPressureReport>('/system/gears-execution-generated-project-pressure')
}

export function getGearsExecutionAcceptanceReport() {
  return apiGet<GearsExecutionAcceptanceReport>('/system/gears-execution-acceptance-report')
}

export function getGearsExecutionWorkerAcceptanceKit() {
  return apiGet<GearsExecutionWorkerAcceptanceKit>('/system/gears-execution-worker-acceptance-kit')
}

export function getGearsExecutionWorkerEvidenceBundle() {
  return apiGet<GearsExecutionWorkerEvidenceBundle>('/system/gears-execution-worker-evidence-bundle')
}

export function getGearsExecutionWorkerEvidenceSignoff(options: { evidenceDir?: string } = {}) {
  const params = new URLSearchParams()
  if (options.evidenceDir) params.set('evidence_dir', options.evidenceDir)
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiGet<GearsExecutionWorkerEvidenceSignoffReport>(`/system/gears-execution-worker-evidence-signoff${suffix}`)
}

export function runGearsExecutionLiveSmoke(req: GearsExecutionLiveSmokeRunRequest = {}) {
  return apiPost<GearsExecutionLiveSmokeRunReport>('/system/gears-execution-live-smoke-run', req)
}

export function getSeedanceProviderAdapterConfig() {
  return apiGet<SeedanceProviderAdapterConfigInfo>('/system/seedance-provider-config')
}

export function getSeedanceProviderAdapterContract() {
  return apiGet<SeedanceProviderAdapterContractInfo>('/system/seedance-provider-adapter-contract')
}
