// web/server/src/routes/system.ts — System info routes (provinces, types)

import { Router } from 'express';
import {
  parseChinaCultureEntries as mcpParseEntries,
  readAllChinaCultureProvinceFiles as mcpReadAllProvinceFiles,
} from '../domains/china-culture/knowledge-source-adapter.js';
import { ErrorCodes, fail, success, VIDEO_TYPE_CONFIG } from '@shared/types.js';
import {
  DomainPackExpansionReviewStateBulkUpdateRequestSchema,
  DomainPackExpansionReviewStateUpdateRequestSchema,
  DomainPackQuerySchema,
  GearsJobCallbackRequestSchema,
  GearsExecutionLiveSmokeRunRequestSchema,
  ProductionReadinessPortfolioRunRequestSchema,
  ProductResourceOwnershipMigrationRequestSchema,
  StoryDomainSafetyMigrationRequestSchema,
  StoryAgentFinalDeliveryManifestDispositionLedgerQuerySchema,
  StoryAgentFinalDeliveryManifestDispositionSubmitRequestSchema,
  StoryAgentFinalDeliveryManifestPreflightRequestSchema,
  StoryProjectFileToSqliteMigrationRequestSchema,
  StoryAgentGeneratedGovernanceRunRequestSchema,
} from '@shared/schemas.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { requireCallbackSecret } from '../middleware/callback-auth.js';
import { requireProductAccess } from '../middleware/product-access.js';
import type {
  AIModelProfile,
  KnowledgeWritebackStatus,
  ProvinceInfo,
  SeedanceProviderAdapterContractInfo,
  SeedanceProviderAdapterConfigInfo,
  VideoType,
  StoryDomainSafetyMigrationRequest,
  StoryProjectFileToSqliteMigrationRequest,
} from '@shared/types.js';
import type { ProductResourceOwnershipMigrationRequest } from '@shared/product-access.js';
import { listModelProfiles } from '../services/model-catalog.js';
import { getStoryGenerationCapabilities } from '../services/story-generation-capability-service.js';
import { getNarrativePatternCatalog } from '../services/narrative-pattern-library.js';
import {
  getGearsExecutionAcceptanceReport,
  getGearsExecutionConfigInfo,
  getGearsExecutionContractInfo,
  getGearsExecutionGeneratedProjectPressureReport,
  getGearsExecutionPressureReport,
  getGearsExecutionReadinessReport,
  getGearsExecutionSmokePackage,
  getGearsExecutionWorkerAcceptanceKit,
  getGearsExecutionWorkerCapabilities,
  getGearsExecutionWorkerEvidenceBundle,
  getGearsExecutionWorkerEvidenceSignoffReport,
  runGearsExecutionLiveSmoke,
} from '../services/gears-execution-service.js';
import {
  getGearsWorkbenchCapabilities,
  getGearsWorkbenchConfigInfo,
} from '../services/gears-workbench-connector.js';
import {
  getGearsExternalCallbackHandoffQueue,
  getProductionReadinessPortfolio,
  importGearsExternalCallbackBatch,
  preflightGearsExternalCallbackBatch,
  runProductionReadinessPortfolioAutomation,
} from '../services/production-readiness-portfolio-service.js';
import { getProductionMaterialPackHealthReport } from '../services/production-material-pack-service.js';
import {
  getDomainPackExpansionCandidateReport,
  getDomainPackExpansionWritebackDraftPackage,
  updateDomainPackExpansionReviewState,
  updateDomainPackExpansionReviewStateBulk,
} from '../services/domain-pack-expansion-service.js';
import { getChinaCultureDomainPackProductionHealthReport } from '../domains/china-culture/domain-pack-production-service.js';
import {
  getStoryAgentGeneratedGovernancePlan,
  runStoryAgentGeneratedGovernance,
} from '../services/generated-governance-service.js';
import {
  getStoryAgentBacklogHandoffPackage,
  getStoryAgentGeneratedHealth,
} from '../services/generated-health-service.js';
import { preflightStoryAgentFinalDeliveryManifest } from '../services/final-delivery-manifest-preflight-service.js';
import {
  readFinalDeliveryManifestDispositionLedger,
  submitFinalDeliveryManifestDisposition,
} from '../services/final-delivery-manifest-disposition-ledger-service.js';
import { getKnowledgeWritebackQueueExportPackage } from '../services/knowledge-writeback-queue-service.js';
import { getStoryAgentMvpStatus } from '../services/story-agent-mvp-status-service.js';
import { getStoryAgentVisualAssetPressureOpsStatus } from '../services/story-agent-visual-asset-pressure-ops-service.js';
import {
  getProductAccessContext,
  getProductAccessReadiness,
  getProductLoginHandoff,
  listProductAccessAuditEvents,
} from '../services/product-access-service.js';
import {
  getProductResourceOwnershipAuditReport,
  migrateProductResourceOwnership,
} from '../services/product-resource-access-service.js';
import { storyAgentDomainRegistry } from '../platform/domain-registry.js';
import { getStoryProjectRepositoryConfigInfo } from '../platform/project-repository-provider.js';
import { getStoryStorageRootConfigInfo } from '../platform/story-storage-root.js';
import { getStoryStorageLegacyDispositionPreflight } from '../services/story-storage-legacy-disposition-service.js';
import {
  getStoryDomainSafetyMigrationAuditReport,
  migrateStoryDomainSafety,
} from '../services/story-domain-safety-migration-service.js';
import {
  getStoryProjectFileToSqliteMigrationPreflight,
  migrateStoryProjectFileToSqlite,
} from '../services/story-project-file-to-sqlite-migration-service.js';

export const systemRouter = Router();

const validateSystemGearsCallbackSecret = requireCallbackSecret({
  envName: 'GEARS_CALLBACK_SECRET',
  explicitHeaders: ['x-gears-callback-secret'],
  label: 'GEARS callback',
});

systemRouter.get('/access-readiness', (_req, res) => {
  res.json(success(getProductAccessReadiness()));
});

systemRouter.get('/login-handoff', (req, res) => {
  res.json(success(getProductLoginHandoff(req.query.return_to)));
});

systemRouter.get('/access-context', requireProductAccess('project:read'), (req, res) => {
  res.json(success(getProductAccessContext(req)));
});

systemRouter.get(
  '/access-audit',
  requireProductAccess('access:audit:read', { feature_flag: 'internal_story_tools' }),
  (req, res) => {
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100;
    res.json(success(listProductAccessAuditEvents(Number.isFinite(limit) ? limit : 100)));
  },
);

systemRouter.post(
  '/resource-access-migrations',
  requireProductAccess('system:operate', { feature_flag: 'internal_story_tools' }),
  validateBody(ProductResourceOwnershipMigrationRequestSchema),
  async (req, res, next) => {
    try {
      const actor = getProductAccessContext(req).actor;
      if (!actor) {
        res.status(401).json(fail(ErrorCodes.ACCESS_UNAUTHENTICATED, 'Authenticated migration operator is required'));
        return;
      }
      const result = await migrateProductResourceOwnership({
        request: req.body as ProductResourceOwnershipMigrationRequest,
        actor,
      });
      if (!result.dry_run && result.blockers.length > 0) {
        res.status(409).json(fail(
          ErrorCodes.ACCESS_RESOURCE_MIGRATION_BLOCKED,
          'Resource ownership migration was not completed safely',
          result,
        ));
        return;
      }
      res.json(success(result));
    } catch (error) {
      next(error);
    }
  },
);

systemRouter.get(
  '/resource-access-readiness',
  requireProductAccess('access:audit:read', { feature_flag: 'internal_story_tools' }),
  async (_req, res, next) => {
    try {
      res.json(success(await getProductResourceOwnershipAuditReport()));
    } catch (error) {
      next(error);
    }
  },
);

systemRouter.get(
  '/story-domain-safety-migrations',
  requireProductAccess('access:audit:read', { feature_flag: 'internal_story_tools' }),
  async (_req, res, next) => {
    try {
      res.json(success(await getStoryDomainSafetyMigrationAuditReport()));
    } catch (error) {
      next(error);
    }
  },
);

systemRouter.post(
  '/story-domain-safety-migrations',
  requireProductAccess('system:operate', { feature_flag: 'internal_story_tools' }),
  validateBody(StoryDomainSafetyMigrationRequestSchema),
  async (req, res, next) => {
    try {
      const actor = getProductAccessContext(req).actor;
      if (!actor) {
        res.status(401).json(fail(ErrorCodes.ACCESS_UNAUTHENTICATED, 'Authenticated migration operator is required'));
        return;
      }
      const result = await migrateStoryDomainSafety({
        request: req.body as StoryDomainSafetyMigrationRequest,
        actor,
      });
      if (!result.dry_run && result.blockers.length > 0) {
        res.status(409).json(fail(
          ErrorCodes.DOMAIN_SAFETY_MIGRATION_BLOCKED,
          'Story domain safety migration was not completed safely',
          result,
        ));
        return;
      }
      res.json(success(result));
    } catch (error) {
      next(error);
    }
  },
);

systemRouter.get(
  '/story-project-file-to-sqlite-migration',
  requireProductAccess('access:audit:read', { feature_flag: 'internal_story_tools' }),
  async (_req, res, next) => {
    try {
      res.json(success(await getStoryProjectFileToSqliteMigrationPreflight()));
    } catch (error) {
      next(error);
    }
  },
);

systemRouter.post(
  '/story-project-file-to-sqlite-migration',
  requireProductAccess('system:operate', { feature_flag: 'internal_story_tools' }),
  validateBody(StoryProjectFileToSqliteMigrationRequestSchema),
  async (req, res, next) => {
    try {
      const actor = getProductAccessContext(req).actor;
      if (!actor) {
        res.status(401).json(fail(ErrorCodes.ACCESS_UNAUTHENTICATED, 'Authenticated migration operator is required'));
        return;
      }
      const result = await migrateStoryProjectFileToSqlite({
        request: req.body as StoryProjectFileToSqliteMigrationRequest,
        actor,
      });
      if (!result.dry_run && result.blockers.length > 0) {
        res.status(409).json(fail(
          ErrorCodes.PROJECT_REPOSITORY_MIGRATION_BLOCKED,
          'Story project file-to-SQLite migration was not completed safely',
          result,
        ));
        return;
      }
      res.json(success(result));
    } catch (error) {
      next(error);
    }
  },
);

const requireSystemOperation = requireProductAccess('system:operate', { feature_flag: 'internal_story_tools' });
const requireSystemProductionOperation = requireProductAccess('production:operate', { feature_flag: 'internal_story_tools' });
const requireSystemMaterialReview = requireProductAccess('material:review');

systemRouter.use((req, res, next) => {
  if (req.method === 'GET') {
    next();
    return;
  }
  if (req.path.includes('/domain-pack-expansion-candidates/')) {
    requireSystemMaterialReview(req, res, next);
    return;
  }
  if (
    req.path.includes('/production-readiness')
    || req.path.includes('/gears-')
    || req.path.includes('/seedance-')
    || req.path.includes('/final-delivery-manifest-')
  ) {
    requireSystemProductionOperation(req, res, next);
    return;
  }
  requireSystemOperation(req, res, next);
});

const SYSTEM_WRITEBACK_STATUSES: KnowledgeWritebackStatus[] = [
  'draft_ready',
  'queued',
  'written_back',
  'needs_revision',
];

function queryListValue(...values: unknown[]): string[] | undefined {
  const result = values.flatMap(value => {
    if (Array.isArray(value)) return value.flatMap(item => String(item).split(','));
    if (typeof value === 'string') return value.split(',');
    return [];
  }).map(value => value.trim()).filter(Boolean);
  return result.length ? [...new Set(result)] : undefined;
}

function queryEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : undefined;
}

// ---------------------------------------------------------------------------
// GET /api/system/provinces — list provinces with entry counts
// ---------------------------------------------------------------------------

systemRouter.get('/provinces', async (_req, res, next) => {
  try {
    const provinceFiles = await mcpReadAllProvinceFiles();
    const provinces: ProvinceInfo[] = [];

    for (const [provinceName, content] of provinceFiles) {
      const entries = mcpParseEntries(content, provinceName);
      provinces.push({ name: provinceName, entry_count: entries.length });
    }

    // Sort by name for consistent ordering
    provinces.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

    res.json(success(provinces));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/types — entry type → video type mapping table
// ---------------------------------------------------------------------------

systemRouter.get('/domain-packs', (_req, res) => {
  res.json(success(storyAgentDomainRegistry.describe()));
});

systemRouter.get('/story-project-repository-config', (_req, res) => {
  res.json(success(getStoryProjectRepositoryConfigInfo()));
});

systemRouter.get('/story-storage-root-config', async (_req, res, next) => {
  try {
    res.json(success(await getStoryStorageRootConfigInfo()));
  } catch (error) {
    next(error);
  }
});

systemRouter.get(
  '/story-storage-legacy-disposition-preflight',
  requireProductAccess('access:audit:read', { feature_flag: 'internal_story_tools' }),
  async (_req, res, next) => {
    try {
      res.json(success(await getStoryStorageLegacyDispositionPreflight()));
    } catch (error) {
      next(error);
    }
  },
);

systemRouter.get('/types', validateQuery(DomainPackQuerySchema), (req, res, next) => {
  try {
    const domain = (req.query as { domain?: string }).domain ?? 'china_culture';
    res.json(success(storyAgentDomainRegistry.require(domain).entryTypes));
  } catch (error) {
    next(error);
  }
});

systemRouter.get('/generation-types', validateQuery(DomainPackQuerySchema), (req, res, next) => {
  try {
    const domain = (req.query as { domain?: string }).domain ?? 'china_culture';
    res.json(success(storyAgentDomainRegistry.require(domain).generationTypes));
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/models — curated model options for users
// ---------------------------------------------------------------------------

systemRouter.get('/models', (_req, res) => {
  const models: AIModelProfile[] = listModelProfiles();
  res.json(success(models));
});

systemRouter.get('/story-generation-capabilities', (_req, res) => {
  res.json(success(getStoryGenerationCapabilities()));
});

// ---------------------------------------------------------------------------
// GET /api/system/narrative-patterns — reusable narrative pattern catalog
// ---------------------------------------------------------------------------

systemRouter.get('/narrative-patterns', (_req, res) => {
  res.json(success(getNarrativePatternCatalog()));
});

// ---------------------------------------------------------------------------
// GET /api/system/production-material-pack-health — template portfolio gate
// ---------------------------------------------------------------------------

systemRouter.get('/production-material-pack-health', (_req, res) => {
  res.json(success(getProductionMaterialPackHealthReport()));
});

// ---------------------------------------------------------------------------
// GET /api/system/domain-pack-production-health — production prompt pack gate
// ---------------------------------------------------------------------------

systemRouter.get('/domain-pack-production-health', (_req, res) => {
  res.json(success(getChinaCultureDomainPackProductionHealthReport()));
});

// ---------------------------------------------------------------------------
// GET /api/system/domain-pack-expansion-candidates — review-gated expansion queue
// ---------------------------------------------------------------------------

systemRouter.get('/domain-pack-expansion-candidates', (req, res) => {
  const includeMarkdown = req.query.include_markdown !== 'false' && req.query.include_markdown !== '0';
  res.json(success(getDomainPackExpansionCandidateReport({ includeMarkdown })));
});

systemRouter.patch(
  '/domain-pack-expansion-candidates/review-state',
  validateBody(DomainPackExpansionReviewStateUpdateRequestSchema),
  (req, res) => {
    const result = updateDomainPackExpansionReviewState(req.body);
    if (!result.ok || !result.report) {
      res.status(400).json(fail(
        ErrorCodes.VALIDATION_ERROR,
        result.message ?? 'Domain Pack expansion review state update failed',
      ));
      return;
    }
    res.json(success(result.report));
  },
);

systemRouter.patch(
  '/domain-pack-expansion-candidates/review-state/bulk',
  validateBody(DomainPackExpansionReviewStateBulkUpdateRequestSchema),
  (req, res) => {
    const result = updateDomainPackExpansionReviewStateBulk(req.body);
    if (!result.ok || !result.result) {
      res.status(400).json(fail(
        ErrorCodes.VALIDATION_ERROR,
        result.message ?? 'Domain Pack expansion review state bulk update failed',
      ));
      return;
    }
    res.json(success(result.result));
  },
);

// ---------------------------------------------------------------------------
// GET /api/system/domain-pack-expansion-writeback-draft — approved expansion drafts
// ---------------------------------------------------------------------------

systemRouter.get('/domain-pack-expansion-writeback-draft', (req, res) => {
  res.json(success(getDomainPackExpansionWritebackDraftPackage({
    reviewItemIds: queryListValue(req.query.review_item_id, req.query.review_item_ids),
    packIds: queryListValue(req.query.pack_id, req.query.pack_ids),
    videoTypes: queryListValue(req.query.video_type, req.query.video_types),
    provinces: queryListValue(req.query.province, req.query.provinces),
    writebackStatuses: queryListValue(
      req.query.writeback_status,
      req.query.writeback_statuses,
    ) as KnowledgeWritebackStatus[] | undefined,
  })));
});

// ---------------------------------------------------------------------------
// GET /api/system/knowledge-writeback-queue/export — unified reviewed writeback export
// ---------------------------------------------------------------------------

systemRouter.get('/knowledge-writeback-queue/export', async (req, res, next) => {
  try {
    const projectId = typeof req.query.project_id === 'string' && req.query.project_id.trim()
      ? req.query.project_id.trim()
      : undefined;
    const videoType = queryEnum(
      req.query.video_type,
      Object.keys(VIDEO_TYPE_CONFIG) as VideoType[],
    );
    const province = typeof req.query.province === 'string' && req.query.province.trim()
      ? req.query.province.trim()
      : undefined;
    const knowledgeWritebackStatus = queryEnum(
      req.query.knowledge_writeback_status ?? req.query.writeback_status,
      SYSTEM_WRITEBACK_STATUSES,
    );
    const searchQuery = typeof req.query.search_query === 'string' && req.query.search_query.trim()
      ? req.query.search_query.trim()
      : undefined;
    const projectTaskKeys = queryListValue(
      req.query.project_task_key,
      req.query.project_task_keys,
      req.query.task_key,
      req.query.task_keys,
    );
    const expansionReviewItemIds = queryListValue(
      req.query.expansion_review_item_id,
      req.query.expansion_review_item_ids,
      req.query.review_item_id,
      req.query.review_item_ids,
    );
    const result = await getKnowledgeWritebackQueueExportPackage({
      projectId,
      videoType,
      province,
      knowledgeWritebackStatus,
      searchQuery,
      projectTaskKeys,
      expansionReviewItemIds,
    });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/production-readiness-portfolio — cross-project production command queue
// ---------------------------------------------------------------------------

systemRouter.get('/production-readiness-portfolio', async (req, res, next) => {
  try {
    const includeArchivedSeries = req.query.includeArchivedSeries === 'true' || req.query.includeArchivedSeries === '1';
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    res.json(success(await getProductionReadinessPortfolio({ includeArchivedSeries, limit })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-external-callback-handoff-queue — cross-project external callback handoff
// ---------------------------------------------------------------------------

systemRouter.get('/gears-external-callback-handoff-queue', async (req, res, next) => {
  try {
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    res.json(success(await getGearsExternalCallbackHandoffQueue({ limit })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/system/gears-external-callbacks/preflight — cross-project external callback preflight
// ---------------------------------------------------------------------------

systemRouter.post(
  '/gears-external-callbacks/preflight',
  validateSystemGearsCallbackSecret,
  validateBody(GearsJobCallbackRequestSchema),
  async (req, res, next) => {
    try {
      res.json(success(await preflightGearsExternalCallbackBatch(req.body)));
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/system/gears-external-callbacks/import — cross-project safe external callback import
// ---------------------------------------------------------------------------

systemRouter.post(
  '/gears-external-callbacks/import',
  validateSystemGearsCallbackSecret,
  validateBody(GearsJobCallbackRequestSchema),
  async (req, res, next) => {
    try {
      res.json(success(await importGearsExternalCallbackBatch(req.body)));
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/system/production-readiness-portfolio/run-automation — run safe portfolio queue automation
// ---------------------------------------------------------------------------

systemRouter.post(
  '/production-readiness-portfolio/run-automation',
  validateBody(ProductionReadinessPortfolioRunRequestSchema),
  async (req, res, next) => {
    try {
      res.json(success(await runProductionReadinessPortfolioAutomation(req.body)));
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/system/story-agent-generated-health — read-only generated artifact health audit
// ---------------------------------------------------------------------------

systemRouter.get('/story-agent-generated-health', async (req, res, next) => {
  try {
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    res.json(success(await getStoryAgentGeneratedHealth({ limit })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/story-agent-backlog-handoff — generated/supplement backlog handoff package
// ---------------------------------------------------------------------------

systemRouter.get('/story-agent-backlog-handoff', async (req, res, next) => {
  try {
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    res.json(success(await getStoryAgentBacklogHandoffPackage({ limit })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/story-agent-generated-governance-plan — read-only generated cleanup plan
// ---------------------------------------------------------------------------

systemRouter.get('/story-agent-generated-governance-plan', async (req, res, next) => {
  try {
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    res.json(success(await getStoryAgentGeneratedGovernancePlan({ limit })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/system/story-agent-generated-governance-plan/run — dry-run manifest
// ---------------------------------------------------------------------------

systemRouter.post(
  '/story-agent-generated-governance-plan/run',
  validateBody(StoryAgentGeneratedGovernanceRunRequestSchema),
  async (req, res, next) => {
    try {
      res.json(success(await runStoryAgentGeneratedGovernance(req.body)));
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/system/story-agent-final-delivery-manifest-preflight — read-only operator preflight
// ---------------------------------------------------------------------------

systemRouter.post(
  '/story-agent-final-delivery-manifest-preflight',
  validateBody(StoryAgentFinalDeliveryManifestPreflightRequestSchema),
  async (req, res, next) => {
    try {
      res.json(success(await preflightStoryAgentFinalDeliveryManifest(req.body)));
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET/POST /api/system/story-agent-final-delivery-manifest-dispositions
// ---------------------------------------------------------------------------

systemRouter.get(
  '/story-agent-final-delivery-manifest-dispositions',
  requireSystemProductionOperation,
  validateQuery(StoryAgentFinalDeliveryManifestDispositionLedgerQuerySchema),
  async (req, res, next) => {
    try {
      const filters =
        StoryAgentFinalDeliveryManifestDispositionLedgerQuerySchema.parse(
          req.query,
        );
      res.json(success(
        await readFinalDeliveryManifestDispositionLedger({}, filters),
      ));
    } catch (err) {
      next(err);
    }
  },
);

systemRouter.post(
  '/story-agent-final-delivery-manifest-dispositions',
  validateBody(StoryAgentFinalDeliveryManifestDispositionSubmitRequestSchema),
  async (req, res, next) => {
    try {
      res.json(success(
        await submitFinalDeliveryManifestDisposition(req.body),
      ));
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/system/story-agent-visual-asset-pressure — bounded visual pressure summary
// ---------------------------------------------------------------------------

systemRouter.get('/story-agent-visual-asset-pressure', async (_req, res, next) => {
  try {
    res.json(success(await getStoryAgentVisualAssetPressureOpsStatus()));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/story-agent-mvp-status — Story Agent MVP command status
// ---------------------------------------------------------------------------

systemRouter.get('/story-agent-mvp-status', async (req, res, next) => {
  try {
    const generatedLimit = typeof req.query.generatedLimit === 'string'
      ? Number(req.query.generatedLimit)
      : typeof req.query.generated_limit === 'string'
        ? Number(req.query.generated_limit)
        : undefined;
    const portfolioLimit = typeof req.query.portfolioLimit === 'string'
      ? Number(req.query.portfolioLimit)
      : typeof req.query.portfolio_limit === 'string'
        ? Number(req.query.portfolio_limit)
        : undefined;
    const includeArchivedSeries = req.query.includeArchivedSeries === 'true' || req.query.includeArchivedSeries === '1';
    res.json(success(await getStoryAgentMvpStatus({ generatedLimit, portfolioLimit, includeArchivedSeries })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-config — safe GEARS v2 execution config
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-config', (_req, res) => {
  res.json(success(getGearsExecutionConfigInfo()));
});

systemRouter.get('/gears-execution-worker-capabilities', async (_req, res, next) => {
  try {
    const result = await getGearsExecutionWorkerCapabilities();
    res.status(result.ok ? 200 : result.error?.code === ErrorCodes.VALIDATION_ERROR ? 400 : 502)
      .json(result);
  } catch (err) {
    next(err);
  }
});

// Workbench is a separate authenticated data-import service. It never reuses
// execution-worker envs, /gears/jobs, callbacks, or real-delivery evidence.
systemRouter.get('/gears-workbench-config', (_req, res) => {
  res.json(success(getGearsWorkbenchConfigInfo()));
});

systemRouter.get('/gears-workbench-capabilities', async (_req, res, next) => {
  try {
    const result = await getGearsWorkbenchCapabilities();
    res.status(result.ok ? 200 : result.error?.code === ErrorCodes.VALIDATION_ERROR ? 400 : 502)
      .json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-contract — GEARS v2 job/callback contract
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-contract', (_req, res) => {
  res.json(success(getGearsExecutionContractInfo()));
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-readiness — local GEARS contract readiness
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-readiness', (_req, res) => {
  res.json(success(getGearsExecutionReadinessReport()));
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-smoke-package — handoff package for GEARS v2
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-smoke-package', (_req, res) => {
  res.json(success(getGearsExecutionSmokePackage()));
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-pressure-report — local GEARS boundary pressure
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-pressure-report', (_req, res) => {
  res.json(success(getGearsExecutionPressureReport()));
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-generated-project-pressure — generated ledger pressure audit
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-generated-project-pressure', async (_req, res, next) => {
  try {
    res.json(success(await getGearsExecutionGeneratedProjectPressureReport()));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-acceptance-report — GEARS v2 worker acceptance
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-acceptance-report', async (_req, res, next) => {
  try {
    res.json(success(await getGearsExecutionAcceptanceReport()));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-worker-acceptance-kit — executable GEARS worker runbook
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-worker-acceptance-kit', async (_req, res, next) => {
  try {
    res.json(success(await getGearsExecutionWorkerAcceptanceKit()));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-worker-evidence-bundle — GEARS worker evidence pack
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-worker-evidence-bundle', async (_req, res, next) => {
  try {
    res.json(success(await getGearsExecutionWorkerEvidenceBundle()));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/gears-execution-worker-evidence-signoff — read worker smoke evidence
// ---------------------------------------------------------------------------

systemRouter.get('/gears-execution-worker-evidence-signoff', async (req, res, next) => {
  try {
    const evidenceDir = typeof req.query.evidence_dir === 'string' ? req.query.evidence_dir : undefined;
    res.json(success(await getGearsExecutionWorkerEvidenceSignoffReport({ evidence_dir: evidenceDir })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/system/gears-execution-live-smoke-run — dry-run or execute GEARS v2 smoke
// ---------------------------------------------------------------------------

systemRouter.post(
  '/gears-execution-live-smoke-run',
  validateBody(GearsExecutionLiveSmokeRunRequestSchema),
  async (req, res, next) => {
    try {
      res.json(success(await runGearsExecutionLiveSmoke(req.body)));
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/system/seedance-provider-config — safe adapter config status
// ---------------------------------------------------------------------------

function envFlag(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function providerAuthHeader(kind: 'submit' | 'poll'): string {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER
    : process.env.SEEDANCE_PROVIDER_POLL_AUTH_HEADER;
  return specific?.trim()
    || process.env.SEEDANCE_PROVIDER_AUTH_HEADER?.trim()
    || 'authorization';
}

function providerAuthScheme(kind: 'submit' | 'poll'): string {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME
    : process.env.SEEDANCE_PROVIDER_POLL_AUTH_SCHEME;
  return specific?.trim()
    || process.env.SEEDANCE_PROVIDER_AUTH_SCHEME?.trim()
    || 'Bearer';
}

const SEEDANCE_PROVIDER_CALLBACK_BASE_ENVS = [
  'SEEDANCE_PROVIDER_CALLBACK_BASE_URL',
  'GEARS_CALLBACK_BASE_URL',
  'PUBLIC_API_BASE_URL',
  'APP_BASE_URL',
];

const SEEDANCE_PROVIDER_REQUEST_MODE_ENVS = [
  'SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE',
  'SEEDANCE_PROVIDER_POLL_REQUEST_MODE',
];

const SEEDANCE_PROVIDER_PAYLOAD_MODE_ENVS = [
  'SEEDANCE_PROVIDER_PAYLOAD_MODE',
  'SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE',
  'SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE',
];

const SEEDANCE_PROVIDER_SIGNATURE_ENVS = [
  'SEEDANCE_PROVIDER_SIGNATURE_SECRET',
  'SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET',
  'SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET',
];

const SEEDANCE_PROVIDER_SIGNATURE_HEADER_ENVS = [
  'SEEDANCE_PROVIDER_SIGNATURE_HEADER',
  'SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_HEADER',
  'SEEDANCE_PROVIDER_POLL_SIGNATURE_HEADER',
];

const SEEDANCE_PROVIDER_TIMESTAMP_HEADER_ENVS = [
  'SEEDANCE_PROVIDER_TIMESTAMP_HEADER',
  'SEEDANCE_PROVIDER_SUBMIT_TIMESTAMP_HEADER',
  'SEEDANCE_PROVIDER_POLL_TIMESTAMP_HEADER',
];

const SEEDANCE_PROVIDER_SUBMIT_PLATFORM_FIELD_ENVS = [
  'SEEDANCE_PROVIDER_SUBMIT_TASKS_FIELD',
  'SEEDANCE_PROVIDER_SUBMIT_PROMPT_FIELD',
  'SEEDANCE_PROVIDER_SUBMIT_DURATION_FIELD',
  'SEEDANCE_PROVIDER_SUBMIT_EXTERNAL_ID_FIELD',
  'SEEDANCE_PROVIDER_SUBMIT_CALLBACK_URL_FIELD',
  'SEEDANCE_PROVIDER_SUBMIT_POLL_URL_FIELD',
  'SEEDANCE_PROVIDER_SUBMIT_MODEL_FIELD',
  'SEEDANCE_PROVIDER_SUBMIT_ASSETS_FIELD',
  'SEEDANCE_PROVIDER_SUBMIT_NEGATIVE_PROMPT_FIELD',
  'SEEDANCE_PROVIDER_SUBMIT_METADATA_FIELD',
  'SEEDANCE_PROVIDER_MODEL',
  'SEEDANCE_PROVIDER_SUBMIT_MODEL',
];

const SEEDANCE_PROVIDER_POLL_PLATFORM_FIELD_ENVS = [
  'SEEDANCE_PROVIDER_POLL_TASK_ID_FIELD',
  'SEEDANCE_PROVIDER_POLL_TASK_IDS_FIELD',
  'SEEDANCE_PROVIDER_POLL_EXTERNAL_ID_FIELD',
  'SEEDANCE_PROVIDER_POLL_TARGETS_FIELD',
  'SEEDANCE_PROVIDER_POLL_METADATA_FIELD',
];

const SEEDANCE_PROVIDER_POLL_HTTP_METHOD_ENV = 'SEEDANCE_PROVIDER_POLL_HTTP_METHOD';

function submitRequestMode(): 'batch' | 'per_shot' {
  return process.env.SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE?.trim().toLowerCase() === 'per_shot'
    ? 'per_shot'
    : 'batch';
}

function pollRequestMode(): 'batch' | 'per_target' {
  return process.env.SEEDANCE_PROVIDER_POLL_REQUEST_MODE?.trim().toLowerCase() === 'per_target'
    ? 'per_target'
    : 'batch';
}

function pollHttpMethod(): 'POST' | 'GET' {
  return process.env.SEEDANCE_PROVIDER_POLL_HTTP_METHOD?.trim().toUpperCase() === 'GET'
    ? 'GET'
    : 'POST';
}

function providerPayloadMode(kind: 'submit' | 'poll'): 'story_agent' | 'platform' {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE
    : process.env.SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE;
  const value = specific?.trim() || process.env.SEEDANCE_PROVIDER_PAYLOAD_MODE?.trim();
  return value?.toLowerCase() === 'platform' ? 'platform' : 'story_agent';
}

function providerSignatureConfigured(kind: 'submit' | 'poll'): boolean {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET
    : process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET;
  return Boolean(specific?.trim() || process.env.SEEDANCE_PROVIDER_SIGNATURE_SECRET?.trim());
}

function providerSignatureHeader(kind: 'submit' | 'poll'): string {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_HEADER
    : process.env.SEEDANCE_PROVIDER_POLL_SIGNATURE_HEADER;
  return specific?.trim()
    || process.env.SEEDANCE_PROVIDER_SIGNATURE_HEADER?.trim()
    || 'X-Seedance-Signature';
}

function providerTimestampHeader(kind: 'submit' | 'poll'): string {
  const specific = kind === 'submit'
    ? process.env.SEEDANCE_PROVIDER_SUBMIT_TIMESTAMP_HEADER
    : process.env.SEEDANCE_PROVIDER_POLL_TIMESTAMP_HEADER;
  return specific?.trim()
    || process.env.SEEDANCE_PROVIDER_TIMESTAMP_HEADER?.trim()
    || 'X-Seedance-Timestamp';
}

systemRouter.get('/seedance-provider-config', (_req, res) => {
  const submitEndpointConfigured = envFlag('SEEDANCE_PROVIDER_SUBMIT_ENDPOINT');
  const pollEndpointConfigured = envFlag('SEEDANCE_PROVIDER_POLL_ENDPOINT');
  const submitTokenConfigured = envFlag('SEEDANCE_PROVIDER_SUBMIT_API_TOKEN');
  const sharedTokenConfigured = envFlag('SEEDANCE_PROVIDER_API_TOKEN');
  const callbackSecretConfigured = envFlag('SEEDANCE_CALLBACK_SECRET');
  const callbackBaseConfigured = SEEDANCE_PROVIDER_CALLBACK_BASE_ENVS.some(envFlag);
  const submitPayloadMode = providerPayloadMode('submit');
  const pollPayloadMode = providerPayloadMode('poll');
  const submitSignatureConfigured = providerSignatureConfigured('submit');
  const pollSignatureConfigured = providerSignatureConfigured('poll');
  const missingSubmitRequirements = submitEndpointConfigured ? [] : ['SEEDANCE_PROVIDER_SUBMIT_ENDPOINT'];
  const missingPollRequirements = pollEndpointConfigured ? [] : ['SEEDANCE_PROVIDER_POLL_ENDPOINT'];
  const configurationWarnings = [
    ...(!submitTokenConfigured && !sharedTokenConfigured
      ? ['submit adapter 未配置 bearer token；仅适用于不要求鉴权的外部 worker。']
      : []),
    ...(!sharedTokenConfigured
      ? ['poll adapter 未配置 SEEDANCE_PROVIDER_API_TOKEN；仅适用于不要求鉴权的外部 worker。']
      : []),
    ...(submitPayloadMode === 'platform' && !submitSignatureConfigured
      ? ['submit adapter 已启用 platform payload，但未配置签名密钥；仅适用于不要求请求签名的平台。']
      : []),
    ...(pollPayloadMode === 'platform' && !pollSignatureConfigured
      ? ['poll adapter 已启用 platform payload，但未配置签名密钥；仅适用于不要求请求签名的平台。']
      : []),
  ];
  const nextActions = [
    ...(submitEndpointConfigured ? [] : ['配置 SEEDANCE_PROVIDER_SUBMIT_ENDPOINT 以启用提交 adapter。']),
    ...(pollEndpointConfigured ? [] : ['配置 SEEDANCE_PROVIDER_POLL_ENDPOINT 以启用轮询 adapter。']),
    ...(submitEndpointConfigured && pollEndpointConfigured
      ? ['adapter endpoint 已就绪，可执行提交或轮询 smoke。']
      : []),
  ];
  const config: SeedanceProviderAdapterConfigInfo = {
    provider: 'seedance',
    submit_endpoint_configured: submitEndpointConfigured,
    poll_endpoint_configured: pollEndpointConfigured,
    submit_token_configured: submitTokenConfigured,
    poll_token_configured: sharedTokenConfigured,
    shared_token_configured: sharedTokenConfigured,
    submit_signature_configured: submitSignatureConfigured,
    poll_signature_configured: pollSignatureConfigured,
    callback_secret_configured: callbackSecretConfigured,
    callback_base_configured: callbackBaseConfigured,
    callback_base_envs: SEEDANCE_PROVIDER_CALLBACK_BASE_ENVS,
    submit_request_mode: submitRequestMode(),
    poll_request_mode: pollRequestMode(),
    request_mode_envs: SEEDANCE_PROVIDER_REQUEST_MODE_ENVS,
    submit_payload_mode: submitPayloadMode,
    poll_payload_mode: pollPayloadMode,
    payload_mode_envs: SEEDANCE_PROVIDER_PAYLOAD_MODE_ENVS,
    poll_http_method: pollHttpMethod(),
    poll_http_method_env: SEEDANCE_PROVIDER_POLL_HTTP_METHOD_ENV,
    submit_auth_header: providerAuthHeader('submit'),
    poll_auth_header: providerAuthHeader('poll'),
    submit_auth_scheme: providerAuthScheme('submit'),
    poll_auth_scheme: providerAuthScheme('poll'),
    submit_signature_header: providerSignatureHeader('submit'),
    poll_signature_header: providerSignatureHeader('poll'),
    submit_timestamp_header: providerTimestampHeader('submit'),
    poll_timestamp_header: providerTimestampHeader('poll'),
    submit_timeout_ms: envNumber('SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS', 30000),
    poll_timeout_ms: envNumber('SEEDANCE_PROVIDER_POLL_TIMEOUT_MS', 30000),
    ready_for_submit_adapter: submitEndpointConfigured,
    ready_for_poll_adapter: pollEndpointConfigured,
    missing_submit_requirements: missingSubmitRequirements,
    missing_poll_requirements: missingPollRequirements,
    configuration_warnings: configurationWarnings,
    next_actions: nextActions,
    generated_at: new Date().toISOString(),
  };
  res.json(success(config));
});

// ---------------------------------------------------------------------------
// GET /api/system/seedance-provider-adapter-contract — safe worker contract
// ---------------------------------------------------------------------------

systemRouter.get('/seedance-provider-adapter-contract', (_req, res) => {
  const contract: SeedanceProviderAdapterContractInfo = {
    provider: 'seedance',
    callback_auth_env: 'SEEDANCE_CALLBACK_SECRET',
    callback_auth_headers: [
      'Authorization: Bearer <SECRET>',
      'X-Seedance-Callback-Secret: <SECRET>',
    ],
    submit: {
      schema_version: 'seedance-provider-submit/v1',
      endpoint_env: 'SEEDANCE_PROVIDER_SUBMIT_ENDPOINT',
      auth_envs: ['SEEDANCE_PROVIDER_SUBMIT_API_TOKEN', 'SEEDANCE_PROVIDER_API_TOKEN'],
      auth_header_envs: ['SEEDANCE_PROVIDER_SUBMIT_AUTH_HEADER', 'SEEDANCE_PROVIDER_AUTH_HEADER'],
      auth_scheme_envs: ['SEEDANCE_PROVIDER_SUBMIT_AUTH_SCHEME', 'SEEDANCE_PROVIDER_AUTH_SCHEME'],
      default_auth_header: 'Authorization',
      default_auth_scheme: 'Bearer',
      timeout_env: 'SEEDANCE_PROVIDER_SUBMIT_TIMEOUT_MS',
      request_mode_env: 'SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE',
      request_modes: ['batch', 'per_shot'],
      payload_mode_env: 'SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE',
      payload_modes: ['story_agent', 'platform'],
      signature_envs: SEEDANCE_PROVIDER_SIGNATURE_ENVS,
      signature_header_envs: SEEDANCE_PROVIDER_SIGNATURE_HEADER_ENVS,
      timestamp_header_envs: SEEDANCE_PROVIDER_TIMESTAMP_HEADER_ENVS,
      default_signature_header: 'X-Seedance-Signature',
      default_timestamp_header: 'X-Seedance-Timestamp',
      signature_base: 'METHOD\\nURL\\nTIMESTAMP\\nJSON_BODY',
      platform_field_envs: SEEDANCE_PROVIDER_SUBMIT_PLATFORM_FIELD_ENVS,
      request_fields: [
        'schema_version',
        'request_mode',
        'project_id',
        'storyId',
        'title',
        'provider',
        'queue_id',
        'queue_priority',
        'provider_callback_path',
        'provider_poll_path',
        'provider_callback_url',
        'provider_poll_url',
        'note',
        'seedance_asset_library',
        'shot',
        'shots[]',
        'shots[].shot_id',
        'shots[].source_scene_id',
        'shots[].provider_job_id',
        'shots[].provider_queue_position',
        'shots[].duration_sec',
        'shots[].seedance_prompt',
        'shots[].seedance_asset_slots',
        'shots[].seedance_material_validation',
        'shots[].seedance_validation_notes',
        'shots[].negative_constraints',
        'platform mode: tasks[]',
        'platform mode: prompt',
        'platform mode: duration',
        'platform mode: external_id',
        'platform mode: callback_url',
        'platform mode: metadata',
      ],
      accepted_response_shapes: [
        'top-level array',
        '{ submitted_shots: [...] }',
        '{ provider_results: [...] }',
        '{ results: [...] }',
        '{ items: [...] }',
        '{ tasks: [...] }',
        '{ data: [...] }',
        '{ data: { tasks: [...] } }',
      ],
      normalized_result_fields: [
        'shot_id | external_id | externalId | custom_id | customId',
        'provider_job_id | job_id | jobId | task_id | taskId | request_id | requestId | id',
        'provider_queue_id | queue_id | queueId | batch_id | batchId',
        'provider_queue_position | queue_position | queuePosition | position',
        'status | task_status | taskStatus | state | phase',
      ],
      request_example: {
        schema_version: 'seedance-provider-submit/v1',
        request_mode: 'batch',
        project_id: '20260618-story-demo--ai_comic_drama',
        storyId: '20260618-story-demo',
        title: '示例故事',
        provider: 'seedance',
        queue_id: 'seedance-queue-demo-001',
        queue_priority: 'normal',
        provider_callback_path: '/api/projects/20260618-story-demo--ai_comic_drama/production-board/seedance-shots/provider-callback',
        provider_poll_path: '/api/projects/20260618-story-demo--ai_comic_drama/production-board/seedance-shots/poll-provider',
        provider_callback_url: '<PUBLIC_API_BASE_URL>/api/projects/20260618-story-demo--ai_comic_drama/production-board/seedance-shots/provider-callback',
        provider_poll_url: '<PUBLIC_API_BASE_URL>/api/projects/20260618-story-demo--ai_comic_drama/production-board/seedance-shots/poll-provider',
        note: 'adapter submit smoke',
        seedance_asset_library: {
          schema_version: 'seedance-asset-library/v1',
          items: [],
        },
        shots: [{
          shot_id: 'shot-1',
          source_scene_id: 1,
          provider_job_id: 'local-seedance-job-shot-1',
          provider_queue_position: 1,
          duration_sec: 12,
          seedance_prompt: '0-3秒：少年站在祠堂门口。3-7秒：风吹动族谱。7-12秒：他抬头望向光。风格：AI漫画短剧。',
          seedance_asset_slots: [],
          seedance_material_validation: {
            asset_count: 0,
            max_asset_count: 6,
            issues: [],
          },
          seedance_validation_notes: [],
          negative_constraints: ['不要现代服饰'],
        }],
      },
      response_examples: [{
        data: {
          tasks: [{
            shot_id: 'shot-1',
            taskId: 'real-seedance-job-001',
            batchId: 'real-seedance-queue-001',
            position: 1,
            taskStatus: 'queued',
          }],
        },
      }, {
        platform_payload_mode: {
          tasks: [{
            prompt: '0-3秒：少年站在祠堂门口。3-7秒：风吹动族谱。7-12秒：他抬头望向光。风格：AI漫画短剧。',
            duration: 12,
            external_id: 'shot-1',
            callback_url: '<PUBLIC_API_BASE_URL>/api/projects/20260618-story-demo--ai_comic_drama/production-board/seedance-shots/provider-callback',
            negative_prompt: '不要现代服饰',
            metadata: {
              project_id: '20260618-story-demo--ai_comic_drama',
              shot_id: 'shot-1',
              local_provider_job_id: 'local-seedance-job-shot-1',
            },
          }],
          metadata: {
            schema_version: 'seedance-provider-platform-submit/v1',
            project_id: '20260618-story-demo--ai_comic_drama',
          },
        },
      }],
      notes: [
        'Each accepted result must include a shot_id and provider job id.',
        'Returned queue id/position override local placeholders when present.',
        'When callback auth is configured, provider_callback_path requires one callback auth header.',
        'When a public callback base URL is configured, submit payload also includes provider_callback_url and provider_poll_url.',
        'Set SEEDANCE_PROVIDER_SUBMIT_REQUEST_MODE=per_shot when a platform endpoint accepts one shot/task per request.',
        'Set SEEDANCE_PROVIDER_SUBMIT_PAYLOAD_MODE=platform when the platform endpoint expects prompt/duration/external_id style fields instead of the Story Agent contract.',
        'Set SEEDANCE_PROVIDER_SIGNATURE_SECRET or SEEDANCE_PROVIDER_SUBMIT_SIGNATURE_SECRET to add HMAC request signature headers.',
        'Set auth scheme to raw/none/no_scheme when a worker expects the token without a prefix.',
      ],
    },
    poll: {
      schema_version: 'seedance-provider-poll/v1',
      endpoint_env: 'SEEDANCE_PROVIDER_POLL_ENDPOINT',
      auth_envs: ['SEEDANCE_PROVIDER_API_TOKEN'],
      auth_header_envs: ['SEEDANCE_PROVIDER_POLL_AUTH_HEADER', 'SEEDANCE_PROVIDER_AUTH_HEADER'],
      auth_scheme_envs: ['SEEDANCE_PROVIDER_POLL_AUTH_SCHEME', 'SEEDANCE_PROVIDER_AUTH_SCHEME'],
      default_auth_header: 'Authorization',
      default_auth_scheme: 'Bearer',
      timeout_env: 'SEEDANCE_PROVIDER_POLL_TIMEOUT_MS',
      request_mode_env: 'SEEDANCE_PROVIDER_POLL_REQUEST_MODE',
      request_modes: ['batch', 'per_target'],
      payload_mode_env: 'SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE',
      payload_modes: ['story_agent', 'platform'],
      signature_envs: SEEDANCE_PROVIDER_SIGNATURE_ENVS,
      signature_header_envs: SEEDANCE_PROVIDER_SIGNATURE_HEADER_ENVS,
      timestamp_header_envs: SEEDANCE_PROVIDER_TIMESTAMP_HEADER_ENVS,
      default_signature_header: 'X-Seedance-Signature',
      default_timestamp_header: 'X-Seedance-Timestamp',
      signature_base: 'METHOD\\nURL\\nTIMESTAMP\\nJSON_BODY',
      platform_field_envs: SEEDANCE_PROVIDER_POLL_PLATFORM_FIELD_ENVS,
      http_method_env: SEEDANCE_PROVIDER_POLL_HTTP_METHOD_ENV,
      http_methods: ['POST', 'GET'],
      endpoint_template_fields: [
        '{project_id}',
        '{projectId}',
        '{provider}',
        '{queue_id}',
        '{queueId}',
        '{shot_id}',
        '{shotId}',
        '{provider_job_id}',
        '{providerJobId}',
        '{job_id}',
        '{jobId}',
        '{provider_queue_id}',
        '{providerQueueId}',
      ],
      request_fields: [
        'schema_version',
        'request_mode',
        'project_id',
        'provider',
        'queue_id',
        'note',
        'target',
        'targets[]',
        'targets[].shot_id',
        'targets[].provider_job_id',
        'targets[].provider_queue_id',
        'targets[].provider_queue_position',
        'targets[].status',
        'targets[].seedance_prompt',
        'platform mode: task_id',
        'platform mode: task_ids',
        'platform mode: external_id',
        'platform mode: metadata',
      ],
      accepted_response_shapes: [
        'top-level array',
        '{ provider_results: [...] }',
        '{ results: [...] }',
        '{ items: [...] }',
        '{ tasks: [...] }',
        '{ data: [...] }',
        '{ data: { tasks: [...] } }',
      ],
      normalized_result_fields: [
        'shot_id | external_id | externalId | custom_id | customId',
        'provider_job_id | job_id | jobId | task_id | taskId | request_id | requestId | id',
        'provider_queue_id | queue_id | queueId | batch_id | batchId',
        'status | task_status | taskStatus | state | phase',
        'video_url | videoUrl | output_url | outputUrl | file_url | fileUrl | download_url | downloadUrl | result_url | resultUrl | url',
        'failure_reason | failureReason | error_message | errorMessage | reason | error | message | msg',
        'failure_category',
        'provider_error_code | providerErrorCode | error_code | errorCode | status_code | statusCode | code',
        'quality_score | qualityScore | score | quality',
        'review_note | reviewNote',
      ],
      request_example: {
        schema_version: 'seedance-provider-poll/v1',
        request_mode: 'batch',
        project_id: '20260618-story-demo--ai_comic_drama',
        provider: 'seedance',
        queue_id: 'real-seedance-queue-001',
        note: 'adapter poll smoke',
        targets: [{
          shot_id: 'shot-1',
          provider_job_id: 'real-seedance-job-001',
          provider_queue_id: 'real-seedance-queue-001',
          provider_queue_position: 1,
          status: 'submitted',
          seedance_prompt: '0-3秒：少年站在祠堂门口。3-7秒：风吹动族谱。7-12秒：他抬头望向光。风格：AI漫画短剧。',
        }],
      },
      response_examples: [{
        data: {
          tasks: [{
            taskId: 'real-seedance-job-001',
            state: 'SUCCEEDED',
            outputUrl: 'seedance-video-shot-1.mp4',
            score: 92,
            reviewNote: '画面可用',
          }, {
            taskId: 'real-seedance-job-002',
            state: 'FAILED',
            errorMessage: '内容审核未通过',
            code: 'RISK_CONTROL',
          }],
        },
      }, {
        platform_payload_mode: {
          task_ids: ['real-seedance-job-001', 'real-seedance-job-002'],
          targets: [{
            task_id: 'real-seedance-job-001',
            external_id: 'shot-1',
            metadata: {
              project_id: '20260618-story-demo--ai_comic_drama',
              shot_id: 'shot-1',
            },
          }],
          metadata: {
            schema_version: 'seedance-provider-platform-poll/v1',
            project_id: '20260618-story-demo--ai_comic_drama',
          },
        },
      }],
      notes: [
        'Poll results are normalized through the provider callback path.',
        'Failed results can carry failure_category/provider_error_code for retry planning.',
        'Set SEEDANCE_PROVIDER_POLL_REQUEST_MODE=per_target when a platform endpoint queries one provider job per request.',
        'When SEEDANCE_PROVIDER_POLL_HTTP_METHOD=GET, the endpoint can use template fields such as {provider_job_id} and no JSON body is sent.',
        'Set SEEDANCE_PROVIDER_POLL_PAYLOAD_MODE=platform when the platform query endpoint expects task_id/task_ids style fields instead of the Story Agent contract.',
        'Set SEEDANCE_PROVIDER_SIGNATURE_SECRET or SEEDANCE_PROVIDER_POLL_SIGNATURE_SECRET to add HMAC request signature headers.',
      ],
    },
    generated_at: new Date().toISOString(),
  };
  res.json(success(contract));
});

// ---------------------------------------------------------------------------
// GET /api/system/regions — list distinct regions for a province
// ---------------------------------------------------------------------------

systemRouter.get('/regions', async (req, res, next) => {
  try {
    const province = req.query.province as string | undefined;
    if (!province) {
      res.json(success([]));
      return;
    }

    const provinceFiles = await mcpReadAllProvinceFiles();
    const content = provinceFiles.get(province);
    if (!content) {
      res.json(success([]));
      return;
    }

    const entries = mcpParseEntries(content, province);
    const regions = new Set<string>();
    for (const entry of entries) {
      if (entry.region) regions.add(entry.region);
    }

    res.json(success([...regions].sort((a, b) => a.localeCompare(b, 'zh-CN'))));
  } catch (err) {
    next(err);
  }
});
