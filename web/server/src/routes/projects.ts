import { Router } from 'express';
import type { Request } from 'express';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { requireCallbackSecret } from '../middleware/callback-auth.js';
import { requireProductAccess } from '../middleware/product-access.js';
import { fail, success, ErrorCodes } from '@shared/types.js';
import type {
  KnowledgeSupplementTaskSource,
  KnowledgeWritebackStatus,
  MaterialBlockingLevel,
  MaterialSufficiencyStage,
  ProjectSupplementTaskListFilters,
  VideoType,
} from '@shared/types.js';
import { VIDEO_TYPE_CONFIG } from '@shared/types.js';
import {
  KnowledgeSupplementTaskUpdateRequestSchema,
  GearsJobCallbackRequestSchema,
  GearsJobLocalAcceptanceRequestSchema,
  GearsJobStatusSyncRequestSchema,
  GearsJobSubmitRequestSchema,
  GearsWorkbenchProjectImportRequestSchema,
  ProjectMaterialPackAddMaterialRequestSchema,
  ProjectExternalEvidenceCandidateImportRequestSchema,
  ProjectExternalEvidenceUploadMetadataSchema,
  ProjectExternalEvidenceVerificationParamSchema,
  ProjectExternalEvidenceVerificationRequestSchema,
  ProjectBatchDeleteRequestSchema,
  ProjectIdParamSchema,
  MediaArtifactPreviewParamSchema,
  MediaAssetReviewParamSchema,
  MediaAssetReviewUpdateRequestSchema,
  ProductionReadinessAutomationRunRequestSchema,
  ProjectRetainRecentRequestSchema,
  SeedanceAssetBatchImportRequestSchema,
  SeedanceAssetLibraryUpdateRequestSchema,
  SeedanceAssetReuseRequestSchema,
  SeedanceShotAutoSelectRequestSchema,
  SeedanceShotCallbackImportRequestSchema,
  SeedanceShotProviderCallbackRequestSchema,
  SeedanceShotProviderPollRequestSchema,
  SeedanceShotProviderQueueOverviewRequestSchema,
  SeedanceShotProviderRetryPlanRequestSchema,
  SeedanceShotProviderRetrySubmitRequestSchema,
  SeedanceShotProviderRecoveryRequestSchema,
  SeedanceShotProviderSubmitRequestSchema,
  SeedanceShotStatusBatchUpdateRequestSchema,
  SeedanceShotStatusUpdateRequestSchema,
  SeedanceShotVersionSelectRequestSchema,
  StoryProductionBoardRepairRequestSchema,
  StoryQualityRepairApplyRequestSchema,
  StoryQualityRepairPromptRequestSchema,
  StoryQualityRepairRequestSchema,
  StorySceneRegenerateRequestSchema,
  SupplementTaskIdParamSchema,
  DomainPackQuerySchema,
  StoryRecipeEffectComparisonHistoryQuerySchema,
  StoryRecipeEffectHumanReviewLedgerQuerySchema,
  StoryRecipeEffectHumanReviewSubmitRequestSchema,
  StoryRecipeEffectMachineReportQuerySchema,
} from '@shared/schemas.js';
import {
  deleteProject,
  deleteProjects,
  addProjectMaterialPackMaterial,
  autoSelectProjectSeedanceShotVersions,
  draftProjectProductionMaterialFields,
  draftProjectSeedanceAssetPlaceholders,
  exportProjectCurrentVersion,
  exportProjectKnowledgeCandidates,
  exportProjectKnowledgeWritebackPatch,
  exportProjectKnowledgeWritebackQueuePatch,
  exportProjectSupplementCandidatePackage,
  exportProjectGearsExternalCallbackHandoff,
  exportProjectProductionBoard,
  exportProjectSeedanceRetryPackage,
  getProject,
  getProjectSeedanceProviderQueueOverview,
  getProjectSeedanceProviderRetryPlan,
  getProjectProductionReadiness,
  getProjectProductionBoard,
  acceptProjectLocalGearsArtifacts,
  applyProjectQualityRepairJson,
  generateProjectQualityRepairPrompt,
  listProjectSeedanceGlobalAssetLibrary,
  importProjectSeedanceAssetBatch,
  importProjectExternalEvidenceCandidate,
  importProjectGearsExternalCallbacks,
  importProjectGearsCallbacks,
  importProjectSeedanceProviderCallback,
  importProjectSeedanceShotCallbacks,
  listProjectSupplementTasks,
  listProjects,
  pollProjectSeedanceProviderQueue,
  preflightProjectGearsExternalCallbacks,
  recoverProjectSeedanceProviderQueue,
  repairAndExportProjectProductionBoard,
  repairProjectQuality,
  repairProjectProductionBoard,
  regenerateProjectScene,
  runProjectProductionReadinessAutomation,
  reuseProjectSeedanceAsset,
  retainRecentProjects,
  selectProjectSeedanceShotVersion,
  submitProjectGearsJobs,
  submitProjectSeedanceProviderRetryPlan,
  submitProjectSeedanceShotsToProvider,
  syncProjectGearsJobStatuses,
  uploadProjectSeedanceAssetFile,
  updateProjectSeedanceAssetLibrary,
  updateProjectMediaAssetReview,
  updateProjectSeedanceShotStatus,
  updateProjectSeedanceShotStatuses,
  updateProjectSupplementTask,
  verifyProjectExternalEvidenceCandidate,
  PROJECT_EXTERNAL_EVIDENCE_UPLOAD_MAX_BYTES,
  uploadProjectExternalEvidenceArtifact,
} from '../services/project-service.js';
import { importProjectToGearsWorkbench } from '../services/gears-workbench-connector.js';
import { getGearsWorkbenchImportAudit } from '../services/gears-workbench-audit-service.js';
import { filterProductResourcesForRequest } from '../services/product-resource-access-service.js';
import { storyAgentDomainRegistry } from '../platform/domain-registry.js';
import { readProjectMediaAssetPreview } from '../services/media-asset-preview-service.js';
import { getProductAccessContext } from '../services/product-access-service.js';
import { parseMultipartAssetUpload } from '../services/multipart-asset-upload-service.js';
import {
  buildStoryRecipeEffectComparisonHistory,
  buildStoryRecipeEffectMachineReport,
  collectStoryRecipeEffectComparisonHistoryRecords,
} from '../services/reference-recipe-effect-history-service.js';
import {
  buildStoryRecipeEffectHumanReviewLedger,
  collectStoryRecipeEffectHumanReviewEvents,
  submitStoryRecipeEffectHumanReview,
} from '../services/reference-recipe-human-review-ledger-service.js';

export const projectsRouter = Router();

const STORY_PROJECT_PATH_PATTERN = /^\/(\d{8}-story-[0-9a-z]+--[a-z_]+)(?:\/|$)/;

function projectResourceIdsFromRequest(req: Request): string[] {
  const ids: string[] = [];
  const pathProjectId = STORY_PROJECT_PATH_PATTERN.exec(req.path)?.[1];
  if (pathProjectId) ids.push(pathProjectId);
  if (typeof req.query.project_id === 'string' && req.query.project_id.trim()) {
    ids.push(req.query.project_id.trim());
  }
  if (Array.isArray(req.body?.project_ids)) {
    ids.push(...req.body.project_ids.filter((item: unknown): item is string => typeof item === 'string'));
  }
  if (typeof req.body?.project_id === 'string' && req.body.project_id.trim()) {
    ids.push(req.body.project_id.trim());
  }
  return [...new Set(ids)];
}

const storyProjectResource = {
  type: 'story_project' as const,
  ids: projectResourceIdsFromRequest,
};
const requireProjectRead = requireProductAccess('project:read', { resource: storyProjectResource });
const requireProjectWrite = requireProductAccess('project:write', { resource: storyProjectResource });
const requireProjectProductionWrite = requireProductAccess('production:write', { resource: storyProjectResource });
const requireProjectMediaReview = requireProductAccess('review:operate', { resource: storyProjectResource });
const requireScopedProjectRecipeReview = requireProductAccess('review:operate', {
  resource: { ...storyProjectResource, required: true },
});
const requireMaterialReview = requireProductAccess('material:review', { resource: storyProjectResource });
const requireScopedMaterialReview = requireProductAccess('material:review', {
  resource: { ...storyProjectResource, required: true },
});
const requireGlobalProjectMaintenance = requireProductAccess('system:operate', {
  feature_flag: 'internal_story_tools',
});
const validateSeedanceProviderCallbackSecret = requireCallbackSecret({
  envName: 'SEEDANCE_CALLBACK_SECRET',
  explicitHeaders: ['x-seedance-callback-secret', 'x-seedance-provider-secret'],
  label: 'Seedance provider callback',
});
const validateGearsCallbackSecret = requireCallbackSecret({
  envName: 'GEARS_CALLBACK_SECRET',
  explicitHeaders: ['x-gears-callback-secret'],
  label: 'GEARS callback',
});

projectsRouter.use((req, res, next) => {
  if (req.path.endsWith('/gears-callback') || req.path.endsWith('/provider-callback')) {
    next();
    return;
  }
  if (req.path === '/retain-recent') {
    requireGlobalProjectMaintenance(req, res, next);
    return;
  }
  if (req.path.startsWith('/supplement-tasks')) {
    (req.path.includes('/candidate-package/export') ? requireScopedMaterialReview : requireMaterialReview)(req, res, next);
    return;
  }
  if (req.path === '/knowledge-candidates/writeback-patch/export') {
    requireScopedMaterialReview(req, res, next);
    return;
  }
  if (req.path.includes('/production-readiness/external-evidence-candidates')) {
    requireMaterialReview(req, res, next);
    return;
  }
  if (req.path.includes('/production-board/media-assets/') && req.path.endsWith('/review')) {
    requireProjectMediaReview(req, res, next);
    return;
  }
  if (req.path === '/recipe-effect-human-reviews' && req.method === 'POST') {
    requireScopedProjectRecipeReview(req, res, next);
    return;
  }
  if (req.method === 'GET') {
    requireProjectRead(req, res, next);
    return;
  }
  const productionWrite = req.path.includes('/production-readiness')
    || req.path.includes('/production-board')
    || req.path.includes('/gears')
    || req.path.includes('/seedance');
  (productionWrite ? requireProjectProductionWrite : requireProjectWrite)(req, res, next);
});

const SEEDANCE_ASSET_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const SUPPLEMENT_TASK_STAGES: MaterialSufficiencyStage[] = ['minimum_viable_story', 'script_ready', 'production_ready'];
const SUPPLEMENT_TASK_BLOCKING_LEVELS: MaterialBlockingLevel[] = ['blocking', 'risk', 'optional'];
const SUPPLEMENT_TASK_SOURCES: KnowledgeSupplementTaskSource[] = [
  'knowledge_pack_missing_need',
  'material_sufficiency_missing_item',
  'production_material_missing_field',
  'professional_evidence_missing',
];
const SUPPLEMENT_TASK_WRITEBACK_STATUSES: KnowledgeWritebackStatus[] = [
  'draft_ready',
  'queued',
  'written_back',
  'needs_revision',
];
const SUPPLEMENT_TASK_VIDEO_TYPES = Object.keys(VIDEO_TYPE_CONFIG) as VideoType[];

function queryEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : undefined;
}

function queryStringList(value: unknown, maxItems = 500): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : [];
  return [...new Set(values.flatMap(item => (
    typeof item === 'string' ? item.split(',') : []
  ))
    .map(item => item.trim())
    .filter(Boolean))]
    .slice(0, maxItems);
}

function supplementTaskFiltersFromRequest(req: Request): ProjectSupplementTaskListFilters {
  const status = req.query.status === 'open' || req.query.status === 'resolved'
    ? req.query.status
    : undefined;
  const projectId = typeof req.query.project_id === 'string' && req.query.project_id.trim()
    ? req.query.project_id.trim()
    : undefined;
  const province = typeof req.query.province === 'string' && req.query.province.trim()
    ? req.query.province.trim()
    : undefined;
  const searchQuery = typeof req.query.search_query === 'string' && req.query.search_query.trim()
    ? req.query.search_query.trim()
    : undefined;
  return {
    project_id: projectId,
    video_type: queryEnum(req.query.video_type, SUPPLEMENT_TASK_VIDEO_TYPES),
    province,
    status,
    stage: queryEnum(req.query.stage, SUPPLEMENT_TASK_STAGES),
    blocking_level: queryEnum(req.query.blocking_level, SUPPLEMENT_TASK_BLOCKING_LEVELS),
    source: queryEnum(req.query.source, SUPPLEMENT_TASK_SOURCES),
    knowledge_writeback_status: queryEnum(
      req.query.knowledge_writeback_status,
      SUPPLEMENT_TASK_WRITEBACK_STATUSES,
    ),
    knowledge_writeback_ready: req.query.knowledge_writeback_ready === '1'
      || req.query.knowledge_writeback_ready === 'true',
    task_keys: queryStringList(req.query.task_keys),
    search_query: searchQuery,
  };
}

projectsRouter.get('/', validateQuery(DomainPackQuerySchema), async (req, res, next) => {
  try {
    const domain = req.query.domain as string | undefined;
    if (domain) storyAgentDomainRegistry.require(domain);
    const result = await listProjects(domain);
    const data = result.data
      ? await filterProductResourcesForRequest(req, 'story_project', result.data, item => item.project_id)
      : result.data;
    res.json({ ...result, data });
  } catch (err) {
    next(err);
  }
});

projectsRouter.get(
  '/recipe-effect-comparisons',
  validateQuery(StoryRecipeEffectComparisonHistoryQuerySchema),
  async (req, res, next) => {
    try {
      const filters = StoryRecipeEffectComparisonHistoryQuerySchema.parse(req.query);
      const records = await collectStoryRecipeEffectComparisonHistoryRecords();
      const accessibleRecords = await filterProductResourcesForRequest(
        req,
        'story_project',
        records,
        item => item.project_id,
      );
      res.json(success(buildStoryRecipeEffectComparisonHistory(accessibleRecords, filters)));
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.get(
  '/recipe-effect-comparison-report',
  validateQuery(StoryRecipeEffectMachineReportQuerySchema),
  async (req, res, next) => {
    try {
      const filters = StoryRecipeEffectMachineReportQuerySchema.parse(req.query);
      const records = await collectStoryRecipeEffectComparisonHistoryRecords();
      const accessibleRecords = await filterProductResourcesForRequest(
        req,
        'story_project',
        records,
        item => item.project_id,
      );
      res.json(success(buildStoryRecipeEffectMachineReport(
        accessibleRecords,
        filters,
      )));
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.get(
  '/recipe-effect-human-reviews',
  validateQuery(StoryRecipeEffectHumanReviewLedgerQuerySchema),
  async (req, res, next) => {
    try {
      const filters = StoryRecipeEffectHumanReviewLedgerQuerySchema.parse(req.query);
      const allEntries = await collectStoryRecipeEffectHumanReviewEvents();
      const accessibleEntries = await filterProductResourcesForRequest(
        req,
        'story_project',
        allEntries,
        item => item.project_id,
      );
      res.json(success(buildStoryRecipeEffectHumanReviewLedger(
        accessibleEntries,
        filters,
        accessibleEntries.at(-1)?.event_sha256 ?? null,
      )));
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/recipe-effect-human-reviews',
  validateBody(StoryRecipeEffectHumanReviewSubmitRequestSchema),
  async (req, res, next) => {
    try {
      res.json(success(await submitStoryRecipeEffectHumanReview(req.body)));
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.get('/supplement-tasks', async (req, res, next) => {
  try {
    const result = await listProjectSupplementTasks(supplementTaskFiltersFromRequest(req));
    const data = result.data
      ? await filterProductResourcesForRequest(req, 'story_project', result.data, item => item.project_id)
      : result.data;
    res.json({ ...result, data });
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/supplement-tasks/candidate-package/export', async (req, res, next) => {
  try {
    const result = await exportProjectSupplementCandidatePackage(supplementTaskFiltersFromRequest(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/knowledge-candidates/writeback-patch/export', async (req, res, next) => {
  try {
    const knowledgeWritebackStatus = queryEnum(
      req.query.knowledge_writeback_status,
      SUPPLEMENT_TASK_WRITEBACK_STATUSES,
    );
    const projectId = typeof req.query.project_id === 'string' && req.query.project_id.trim()
      ? req.query.project_id.trim()
      : undefined;
    const videoType = queryEnum(req.query.video_type, SUPPLEMENT_TASK_VIDEO_TYPES);
    const province = typeof req.query.province === 'string' && req.query.province.trim()
      ? req.query.province.trim()
      : undefined;
    const taskKeys = queryStringList(req.query.task_keys);
    const searchQuery = typeof req.query.search_query === 'string' && req.query.search_query.trim()
      ? req.query.search_query.trim()
      : undefined;
    const result = await exportProjectKnowledgeWritebackQueuePatch({
      project_id: projectId,
      video_type: videoType,
      province,
      knowledge_writeback_status: knowledgeWritebackStatus,
      task_keys: taskKeys,
      search_query: searchQuery,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/batch-delete', validateBody(ProjectBatchDeleteRequestSchema), async (req, res, next) => {
  try {
    const result = await deleteProjects(req.body.project_ids);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/retain-recent', validateBody(ProjectRetainRecentRequestSchema), async (req, res, next) => {
  try {
    const result = await retainRecentProjects(req.body.keep_recent);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/:projectId', validateParams(ProjectIdParamSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params as { projectId: string };
    const result = await getProject(projectId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.delete('/:projectId', validateParams(ProjectIdParamSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params as { projectId: string };
    const result = await deleteProject(projectId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/:projectId/export', validateParams(ProjectIdParamSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params as { projectId: string };
    const result = await exportProjectCurrentVersion(projectId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/:projectId/knowledge-candidates/export', validateParams(ProjectIdParamSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params as { projectId: string };
    const result = await exportProjectKnowledgeCandidates(projectId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/:projectId/knowledge-candidates/writeback-patch/export', validateParams(ProjectIdParamSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params as { projectId: string };
    const result = await exportProjectKnowledgeWritebackPatch(projectId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/:projectId/production-board', validateParams(ProjectIdParamSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params as { projectId: string };
    const result = await getProjectProductionBoard(projectId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.get(
  '/:projectId/production-board/media-assets/:artifactId/preview',
  validateParams(MediaArtifactPreviewParamSchema),
  async (req, res, next) => {
    try {
      const { projectId, artifactId } = req.params as { projectId: string; artifactId: string };
      const result = await readProjectMediaAssetPreview(projectId, artifactId);
      if (!result.ok) {
        res.status(result.status).json(fail(
          result.status === 404 ? ErrorCodes.STORY_NOT_FOUND : ErrorCodes.VALIDATION_ERROR,
          result.message,
        ));
        return;
      }
      res.setHeader('Content-Type', result.data.mime_type);
      res.setHeader('Content-Length', String(result.data.byte_size));
      res.setHeader('Content-Disposition', `inline; filename="${result.data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      res.setHeader('ETag', `"sha256-${result.data.content_sha256}"`);
      res.status(200).send(result.data.buffer);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/media-assets/:assetId/review',
  validateParams(MediaAssetReviewParamSchema),
  validateBody(MediaAssetReviewUpdateRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId, assetId } = req.params as { projectId: string; assetId: string };
      if (assetId !== req.body.asset_id) {
        res.status(400).json(fail(ErrorCodes.VALIDATION_ERROR, 'Path assetId must match body asset_id'));
        return;
      }
      const access = getProductAccessContext(req);
      if (!access.actor || access.authentication_method === 'local_bypass') {
        res.status(403).json(fail(
          ErrorCodes.ACCESS_FORBIDDEN,
          'A verified reviewer session is required to grant media rights or human visual review credit',
        ));
        return;
      }
      const result = await updateProjectMediaAssetReview(projectId, req.body, {
        actor_id: access.actor.actor_id,
        authentication_method: access.authentication_method,
      });
      res.status(
        result.ok
          ? 200
          : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400,
      ).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.get('/:projectId/production-readiness', validateParams(ProjectIdParamSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params as { projectId: string };
    const result = await getProjectProductionReadiness(projectId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.post(
  '/:projectId/production-readiness/external-evidence-candidates',
  validateParams(ProjectIdParamSchema),
  validateBody(ProjectExternalEvidenceCandidateImportRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await importProjectExternalEvidenceCandidate(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-readiness/external-evidence-candidates/upload',
  validateParams(ProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      let parsed: Awaited<ReturnType<typeof parseMultipartAssetUpload>>;
      try {
        parsed = await parseMultipartAssetUpload(req, {
          max_bytes: PROJECT_EXTERNAL_EVIDENCE_UPLOAD_MAX_BYTES,
          default_filename: 'external-evidence.bin',
        });
      } catch (err: any) {
        res.status(400).json(fail(ErrorCodes.VALIDATION_ERROR, err.message ?? 'Invalid external evidence upload'));
        return;
      }
      if (!parsed.file || parsed.file.field_name !== 'file') {
        res.status(400).json(fail(ErrorCodes.VALIDATION_ERROR, 'External evidence upload requires a file field'));
        return;
      }
      const metadata = ProjectExternalEvidenceUploadMetadataSchema.safeParse(parsed.fields);
      if (!metadata.success) {
        res.status(400).json(fail(
          ErrorCodes.VALIDATION_ERROR,
          'External evidence upload metadata validation failed',
          metadata.error.flatten(),
        ));
        return;
      }
      const result = await uploadProjectExternalEvidenceArtifact(projectId, {
        ...metadata.data,
        file: {
          original_filename: parsed.file.filename,
          mime_type: parsed.file.mime_type,
          buffer: parsed.file.buffer,
        },
      });
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-readiness/external-evidence-candidates/:evidenceId/verify',
  validateParams(ProjectExternalEvidenceVerificationParamSchema),
  validateBody(ProjectExternalEvidenceVerificationRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId, evidenceId } = req.params as { projectId: string; evidenceId: string };
      if (evidenceId !== req.body.evidence_id) {
        res.status(400).json(fail(ErrorCodes.VALIDATION_ERROR, 'Path evidenceId must match body evidence_id'));
        return;
      }
      const access = getProductAccessContext(req);
      if (!access.actor || access.authentication_method === 'local_bypass') {
        res.status(403).json(fail(
          ErrorCodes.ACCESS_FORBIDDEN,
          'A verified material reviewer session is required to grant or revoke external evidence credit',
        ));
        return;
      }
      const result = await verifyProjectExternalEvidenceCandidate(projectId, req.body, {
        actor_id: access.actor.actor_id,
        authentication_method: access.authentication_method,
      });
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-readiness/run-automation',
  validateParams(ProjectIdParamSchema),
  validateBody(ProductionReadinessAutomationRunRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await runProjectProductionReadinessAutomation(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post('/:projectId/production-board/export', validateParams(ProjectIdParamSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params as { projectId: string };
    const result = await exportProjectProductionBoard(projectId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.post(
  '/:projectId/production-board/seedance-assets/draft-placeholders',
  validateParams(ProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await draftProjectSeedanceAssetPlaceholders(projectId);
      res.status(result.ok ? 200 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-assets',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceAssetLibraryUpdateRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await updateProjectSeedanceAssetLibrary(projectId, req.body);
      res.status(result.ok ? 200 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.get(
  '/:projectId/production-board/seedance-assets/global',
  validateParams(ProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await listProjectSeedanceGlobalAssetLibrary(projectId);
      res.status(result.ok ? 200 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-assets/import',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceAssetBatchImportRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await importProjectSeedanceAssetBatch(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-assets/reuse',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceAssetReuseRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await reuseProjectSeedanceAsset(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-assets/upload',
  validateParams(ProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      let parsed: Awaited<ReturnType<typeof parseMultipartAssetUpload>>;
      try {
        parsed = await parseMultipartAssetUpload(req, {
          max_bytes: SEEDANCE_ASSET_UPLOAD_MAX_BYTES,
          default_filename: 'seedance-asset.bin',
        });
      } catch (err: any) {
        res.status(400).json(fail(ErrorCodes.VALIDATION_ERROR, err.message ?? 'Invalid Seedance asset upload'));
        return;
      }
      if (!parsed.file) {
        res.status(400).json(fail(ErrorCodes.VALIDATION_ERROR, 'Seedance asset upload requires a file field'));
        return;
      }
      const kind = parsed.fields.kind;
      const modality = parsed.fields.modality;
      const role = parsed.fields.role;
      const result = await uploadProjectSeedanceAssetFile(projectId, {
        asset_id: parsed.fields.asset_id,
        label: parsed.fields.label,
        kind: ['character', 'location', 'prop', 'camera', 'audio'].includes(kind) ? kind as any : undefined,
        modality: ['image', 'video', 'audio'].includes(modality) ? modality as any : undefined,
        role: [
          'character_reference',
          'location_reference',
          'prop_reference',
          'camera_reference',
          'music_reference',
          'sound_reference',
        ].includes(role) ? role as any : undefined,
        reference_slot: parsed.fields.reference_slot,
        description: parsed.fields.description,
        file: {
          original_filename: parsed.file.filename,
          mime_type: parsed.file.mime_type,
          buffer: parsed.file.buffer,
        },
      });
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/gears-workbench-import/dry-run',
  validateParams(ProjectIdParamSchema),
  validateBody(GearsWorkbenchProjectImportRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await importProjectToGearsWorkbench(projectId, req.body, 'dry_run');
      res.status(
        result.ok
          ? 200
          : result.error?.code === ErrorCodes.STORY_NOT_FOUND
            ? 404
            : result.error?.code === ErrorCodes.VALIDATION_ERROR
              ? 400
              : 502,
      ).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.get(
  '/:projectId/gears-workbench-import-audit',
  validateParams(ProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      res.json(success(await getGearsWorkbenchImportAudit(projectId)));
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/gears-workbench-import',
  validateParams(ProjectIdParamSchema),
  validateBody(GearsWorkbenchProjectImportRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await importProjectToGearsWorkbench(projectId, req.body, 'execute');
      res.status(
        result.ok
          ? 200
          : result.error?.code === ErrorCodes.STORY_NOT_FOUND
            ? 404
            : result.error?.code === ErrorCodes.VALIDATION_ERROR
              ? 400
              : 502,
      ).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/gears-jobs/submit',
  validateParams(ProjectIdParamSchema),
  validateBody(GearsJobSubmitRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await submitProjectGearsJobs(projectId, req.body);
      res.status(
        result.ok
          ? 200
          : result.error?.code === ErrorCodes.VALIDATION_ERROR
            ? 400
            : result.error?.code === ErrorCodes.INTERNAL_ERROR
              ? 502
              : 404,
      ).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/gears-jobs/sync',
  validateParams(ProjectIdParamSchema),
  validateBody(GearsJobStatusSyncRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await syncProjectGearsJobStatuses(projectId, req.body);
      res.status(
        result.ok
          ? 200
          : result.error?.code === ErrorCodes.VALIDATION_ERROR
            ? 400
            : result.error?.code === ErrorCodes.INTERNAL_ERROR
              ? 502
              : 404,
      ).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/gears-jobs/local-acceptance',
  validateParams(ProjectIdParamSchema),
  validateBody(GearsJobLocalAcceptanceRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await acceptProjectLocalGearsArtifacts(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.VALIDATION_ERROR ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/gears-jobs/export-external-callback-handoff',
  validateParams(ProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await exportProjectGearsExternalCallbackHandoff(projectId);
      res.status(result.ok ? 200 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/gears-jobs/preflight-external-callbacks',
  validateParams(ProjectIdParamSchema),
  validateBody(GearsJobCallbackRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await preflightProjectGearsExternalCallbacks(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.VALIDATION_ERROR ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/gears-jobs/import-external-callbacks',
  validateParams(ProjectIdParamSchema),
  validateBody(GearsJobCallbackRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await importProjectGearsExternalCallbacks(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.VALIDATION_ERROR ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/gears-callback',
  validateParams(ProjectIdParamSchema),
  validateGearsCallbackSecret,
  validateBody(GearsJobCallbackRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await importProjectGearsCallbacks(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.VALIDATION_ERROR ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotStatusUpdateRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await updateProjectSeedanceShotStatus(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/batch',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotStatusBatchUpdateRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await updateProjectSeedanceShotStatuses(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/submit-provider',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotProviderSubmitRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await submitProjectSeedanceShotsToProvider(projectId, req.body);
      res.status(
        result.ok
          ? 200
          : result.error?.code === ErrorCodes.VALIDATION_ERROR
            ? 400
            : result.error?.code === ErrorCodes.INTERNAL_ERROR
              ? 502
              : 404,
      ).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/recover-provider',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotProviderRecoveryRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await recoverProjectSeedanceProviderQueue(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/poll-provider',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotProviderPollRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await pollProjectSeedanceProviderQueue(projectId, req.body);
      res.status(
        result.ok
          ? 200
          : result.error?.code === ErrorCodes.VALIDATION_ERROR
            ? 400
            : result.error?.code === ErrorCodes.INTERNAL_ERROR
              ? 502
              : 404,
      ).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/provider-overview',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotProviderQueueOverviewRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await getProjectSeedanceProviderQueueOverview(projectId, req.body);
      res.status(result.ok ? 200 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/provider-retry-plan',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotProviderRetryPlanRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await getProjectSeedanceProviderRetryPlan(projectId, req.body);
      res.status(result.ok ? 200 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/provider-retry-submit',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotProviderRetrySubmitRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await submitProjectSeedanceProviderRetryPlan(projectId, req.body);
      res.status(
        result.ok
          ? 200
          : result.error?.code === ErrorCodes.VALIDATION_ERROR
            ? 400
            : result.error?.code === ErrorCodes.INTERNAL_ERROR
              ? 502
              : 404,
      ).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/import',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotCallbackImportRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await importProjectSeedanceShotCallbacks(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/provider-callback',
  validateParams(ProjectIdParamSchema),
  validateSeedanceProviderCallbackSecret,
  validateBody(SeedanceShotProviderCallbackRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await importProjectSeedanceProviderCallback(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/select-version',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotVersionSelectRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await selectProjectSeedanceShotVersion(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/auto-select',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotAutoSelectRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await autoSelectProjectSeedanceShotVersions(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/export-seedance-retry-package',
  validateParams(ProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await exportProjectSeedanceRetryPackage(projectId);
      res.status(result.ok ? 200 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/repair',
  validateParams(ProjectIdParamSchema),
  validateBody(StoryProductionBoardRepairRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await repairProjectProductionBoard(projectId, req.body);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/repair-export',
  validateParams(ProjectIdParamSchema),
  validateBody(StoryProductionBoardRepairRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await repairAndExportProjectProductionBoard(projectId, req.body);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/regenerate-scene',
  validateParams(ProjectIdParamSchema),
  validateBody(StorySceneRegenerateRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await regenerateProjectScene(projectId, req.body);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/repair-quality',
  validateParams(ProjectIdParamSchema),
  validateBody(StoryQualityRepairRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await repairProjectQuality(projectId, req.body);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/repair-quality/prompt',
  validateParams(ProjectIdParamSchema),
  validateBody(StoryQualityRepairPromptRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await generateProjectQualityRepairPrompt(projectId, req.body);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/repair-quality/apply',
  validateParams(ProjectIdParamSchema),
  validateBody(StoryQualityRepairApplyRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await applyProjectQualityRepairJson(projectId, req.body);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.patch(
  '/:projectId/supplement-tasks/:taskId',
  validateParams(SupplementTaskIdParamSchema),
  validateBody(KnowledgeSupplementTaskUpdateRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId, taskId } = req.params as { projectId: string; taskId: string };
      const result = await updateProjectSupplementTask(projectId, taskId, req.body);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/supplement-tasks/draft-production-material',
  validateParams(ProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await draftProjectProductionMaterialFields(projectId);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/material-pack/materials',
  validateParams(ProjectIdParamSchema),
  validateBody(ProjectMaterialPackAddMaterialRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await addProjectMaterialPackMaterial(projectId, req.body);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);
