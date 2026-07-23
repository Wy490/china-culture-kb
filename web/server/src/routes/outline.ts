// web/server/src/routes/outline.ts — Story outline analysis route

import { Router, type Request } from 'express';
import { requireCallbackSecret } from '../middleware/callback-auth.js';
import { requireProductAccess } from '../middleware/product-access.js';
import { ErrorCodes, fail } from '@shared/types.js';
import type { ProductAccessContext } from '@shared/product-access.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
  AiComicEpisodeContextPreviewRequestSchema,
  AiComicEpisodeGenerateRequestSchema,
  AiComicSeedanceAudioLibraryUpdateRequestSchema,
  AiComicSeedanceAudioMixRequestSchema,
  AiComicSeedanceAssetLibraryUpdateRequestSchema,
  AiComicSeedanceFinalDeliveryRequestSchema,
  AiComicSeedanceFinalDeliveryRollbackRequestSchema,
  AiComicSeedanceProductionAutoSelectRequestSchema,
  AiComicSeedanceProductionBatchUpdateRequestSchema,
  AiComicSeedanceProductionCallbackRequestSchema,
  AiComicSeedanceProviderRecoveryRequestSchema,
  AiComicSeedanceRetrySubmitRequestSchema,
  AiComicSeedanceProductionStatusUpdateRequestSchema,
  AiComicSeedanceProductionVersionSelectRequestSchema,
  AiComicSeedanceReviewAddRequestSchema,
  AiComicSeedanceReviewResolveRequestSchema,
  AiComicSeedanceCutAssemblyRequestSchema,
  AiComicSeedanceSubtitleExportRequestSchema,
  AiComicSeedanceSubtitleRenderRequestSchema,
  AiComicSeedanceThumbnailCaptureRequestSchema,
  AiComicSeedanceTitleCardRenderRequestSchema,
  AiComicSeriesLedgerRebuildRequestSchema,
  AiComicSeriesHumanReviewSubmitRequestSchema,
  AiComicSeriesMediaArtifactPreviewParamSchema,
  AiComicSeriesMediaAssetReviewParamSchema,
  AiComicSeriesProjectArchiveRequestSchema,
  AiComicSeriesProjectCopyRequestSchema,
  AiComicSeriesProjectIdParamSchema,
  AiComicSeriesProjectSaveRequestSchema,
  AiComicSeriesPlanRequestSchema,
  AiComicSeriesVisualIdentityDefinitionParamSchema,
  AiComicSeriesVisualIdentityDefinitionUpdateRequestSchema,
  AiComicSeriesVisualWorldRuleDefinitionParamSchema,
  AiComicSeriesVisualWorldRuleDefinitionUpdateRequestSchema,
  GearsJobCallbackRequestSchema,
  GearsJobStatusSyncRequestSchema,
  GearsJobSubmitRequestSchema,
  MediaAssetReviewUpdateRequestSchema,
  ProductionReadinessAutomationRunRequestSchema,
  StoryOutlineAnalyzeRequestSchema,
} from '@shared/schemas.js';
import { analyzeOutline } from '../services/outline-service.js';
import {
  addAiComicSeriesSeedanceReview,
  archiveAiComicSeriesProject,
  applyAiComicSeriesSeedanceProductionCallback,
  assembleAiComicSeriesSeedanceCut,
  assembleAiComicSeriesSeedanceFinalDelivery,
  autoSelectAiComicSeriesSeedanceProductionVersions,
  captureAiComicSeriesSeedanceThumbnails,
  copyAiComicSeriesProject,
  deleteAiComicSeriesProject,
  exportAiComicSeriesBible,
  exportAiComicSeriesCommercialBlindReviewPackage,
  exportAiComicSeriesSeedanceAssetReportPackage,
  exportAiComicSeriesSeedanceAudioPlanPackage,
  exportAiComicSeriesSeedanceCutPackage,
  exportAiComicSeriesSeedanceEditAssetPackage,
  exportAiComicSeriesSeedanceEditingPlatformPackage,
  exportAiComicSeriesSeedanceFinishingPlanPackage,
  exportAiComicSeriesSeedancePrompts,
  exportAiComicSeriesSeedanceRetryExecutionPlan,
  exportAiComicSeriesSeedanceRetryPackage,
  exportAiComicSeriesSeedanceReviewRepairPackage,
  exportAiComicSeriesSeedanceSubtitlePackage,
  exportAiComicSeriesSeedanceThumbnailPlanPackage,
  exportAiComicSeriesSeedanceTitleCardPlanPackage,
  exportAiComicSeriesSeedanceVersionComparisonPackage,
  previewAiComicEpisodeContext,
  readAiComicSeriesMediaAssetPreview,
  generateAiComicEpisodeFromPlan,
  generateAiComicSeriesPlan,
  generateAiComicSeriesVisualIdentitySuggestionDraft,
  generateAiComicSeriesVisualWorldRuleSuggestionDraft,
  getAiComicSeriesProductionReadiness,
  getAiComicSeriesProject,
  getAiComicSeriesSeedanceProductionDashboard,
  importAiComicSeriesGearsCallbacks,
  listAiComicSeriesProjects,
  mixAiComicSeriesSeedanceAudio,
  recoverAiComicSeriesSeedanceProviderTimeouts,
  rebuildAiComicSeriesContinuityLedger,
  rebuildAiComicSeriesVisualBible,
  repairAiComicSeriesCommercialQualityProject,
  rollbackAiComicSeriesSeedanceFinalDelivery,
  renderAiComicSeriesSeedanceSubtitles,
  renderAiComicSeriesSeedanceTitleCards,
  resolveAiComicSeriesSeedanceReview,
  runAiComicSeriesProductionReadinessAutomation,
  saveAiComicSeriesProject,
  submitAiComicSeriesCommercialHumanReview,
  selectAiComicSeriesSeedanceProductionVersion,
  submitAiComicSeriesGearsJobs,
  submitAiComicSeriesSeedanceRetryExecutionPlan,
  syncAiComicSeriesGearsJobStatuses,
  uploadAiComicSeriesSeedanceAssetFile,
  updateAiComicSeriesSeedanceAssetLibrary,
  updateAiComicSeriesSeedanceAudioLibrary,
  updateAiComicSeriesMediaAssetReview,
  updateAiComicSeriesVisualIdentityDefinition,
  updateAiComicSeriesVisualWorldRuleDefinition,
  updateAiComicSeriesSeedanceProductionStatus,
  updateAiComicSeriesSeedanceProductionStatuses,
} from '../services/ai-comic-series-service.js';
import { runAiComicSeriesGearsCharacterAssetLocalTest } from '../services/ai-comic-series-gears-character-assets-service.js';
import { parseMultipartAssetUpload } from '../services/multipart-asset-upload-service.js';
import {
  filterProductResourcesForRequest,
  productResourceOwnershipForActor,
} from '../services/product-resource-access-service.js';

export const outlineRouter = Router();

const SERIES_PROJECT_PATH_PATTERN = /^\/ai-comic-series-projects\/(\d{8}-series-[0-9a-z]+)(?:\/|$)/;

function seriesProjectResourceIdsFromRequest(req: Request): string[] {
  const ids: string[] = [];
  const pathProjectId = SERIES_PROJECT_PATH_PATTERN.exec(req.path)?.[1];
  if (pathProjectId) ids.push(pathProjectId);
  for (const value of [req.body?.series_project_id, req.body?.seriesProjectId]) {
    if (typeof value === 'string' && value.trim()) ids.push(value.trim());
  }
  return [...new Set(ids)];
}

const validateSeedanceCallbackSecret = requireCallbackSecret({
  envName: 'SEEDANCE_CALLBACK_SECRET',
  explicitHeaders: ['x-seedance-callback-secret'],
  label: 'Seedance callback',
});
const validateGearsCallbackSecret = requireCallbackSecret({
  envName: 'GEARS_CALLBACK_SECRET',
  explicitHeaders: ['x-gears-callback-secret'],
  label: 'GEARS callback',
});

const seriesProjectResource = {
  type: 'series_project' as const,
  ids: seriesProjectResourceIdsFromRequest,
};
const requireSeriesRead = requireProductAccess('project:read', { resource: seriesProjectResource });
const requireStoryCreate = requireProductAccess('story:create', { resource: seriesProjectResource });
const requireSeriesProductionWrite = requireProductAccess('production:write', { resource: seriesProjectResource });
const requireSeriesMediaReview = requireProductAccess('review:operate', { resource: seriesProjectResource });

const SERIES_ASSET_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

outlineRouter.use((req, res, next) => {
  if (req.path.endsWith('/gears-callback') || req.path.endsWith('/seedance-production-callback')) {
    next();
    return;
  }
  if (req.method === 'GET') {
    if (req.path.startsWith('/ai-comic-series-projects')) {
      requireSeriesRead(req, res, next);
      return;
    }
    next();
    return;
  }
  if (
    (req.path.includes('/media-assets/') && req.path.endsWith('/review'))
    || req.path.endsWith('/commercial-quality-human-review')
    || req.path.endsWith('/export-commercial-blind-review-package')
    || req.path.endsWith('/visual-identity-definition')
    || req.path.endsWith('/visual-world-rule-definition')
  ) {
    requireSeriesMediaReview(req, res, next);
    return;
  }
  const productionWrite = req.path.includes('/production-readiness')
    || req.path.includes('/gears-jobs')
    || req.path.includes('/seedance');
  (productionWrite ? requireSeriesProductionWrite : requireStoryCreate)(req, res, next);
});

// POST /api/story-outline/analyze — analyze story outline for subject extraction
outlineRouter.post('/analyze', validateBody(StoryOutlineAnalyzeRequestSchema), async (req, res, next) => {
  try {
    const result = await analyzeOutline(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/story-outline/ai-comic-series-plan — plan a long-form AI comic drama series
outlineRouter.post('/ai-comic-series-plan', validateBody(AiComicSeriesPlanRequestSchema), async (req, res, next) => {
  try {
    const result = await generateAiComicSeriesPlan(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/story-outline/ai-comic-series-projects — list saved AI comic series projects
outlineRouter.get('/ai-comic-series-projects', async (req, res, next) => {
  try {
    const result = await listAiComicSeriesProjects({
      includeArchived: req.query.include_archived === '1' || req.query.include_archived === 'true',
    });
    const data = result.data
      ? await filterProductResourcesForRequest(req, 'series_project', result.data, item => item.series_project_id)
      : result.data;
    res.json({ ...result, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/story-outline/ai-comic-series-projects — save an AI comic series plan
outlineRouter.post('/ai-comic-series-projects', validateBody(AiComicSeriesProjectSaveRequestSchema), async (req, res, next) => {
  try {
    const access = res.locals.productAccess as ProductAccessContext | undefined;
    const accessControl = access?.mode === 'required' && access.actor
      ? productResourceOwnershipForActor(access.actor)
      : undefined;
    const result = await saveAiComicSeriesProject(req.body, { access_control: accessControl });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/copy — copy a saved project
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/copy',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeriesProjectCopyRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const access = res.locals.productAccess as ProductAccessContext | undefined;
      const accessControl = access?.mode === 'required' && access.actor
        ? productResourceOwnershipForActor(access.actor)
        : undefined;
      const result = await copyAiComicSeriesProject(seriesProjectId, req.body, { access_control: accessControl });
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/archive — archive or restore a saved project
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/archive',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeriesProjectArchiveRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await archiveAiComicSeriesProject(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/story-outline/ai-comic-series-projects/:seriesProjectId — remove a saved project
outlineRouter.delete(
  '/ai-comic-series-projects/:seriesProjectId',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await deleteAiComicSeriesProject(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/story-outline/ai-comic-series-projects/:seriesProjectId — load a saved AI comic series project
outlineRouter.get(
  '/ai-comic-series-projects/:seriesProjectId',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await getAiComicSeriesProject(seriesProjectId);
      res.status(result.ok ? 200 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/story-outline/ai-comic-series-projects/:seriesProjectId/production-readiness — production command readiness
outlineRouter.get(
  '/ai-comic-series-projects/:seriesProjectId/production-readiness',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await getAiComicSeriesProductionReadiness(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/production-readiness/run-automation — run safe Story Agent automation steps
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/production-readiness/run-automation',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(ProductionReadinessAutomationRunRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await runAiComicSeriesProductionReadinessAutomation(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-bible — export series bible
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/export-bible',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await exportAiComicSeriesBible(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/rebuild-visual-bible — persist stable series visual identities
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/rebuild-visual-bible',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await rebuildAiComicSeriesVisualBible(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/visual-identities/:visualIdentityId/visual-identity-definition — save or review one stable visual definition
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/visual-identities/:visualIdentityId/visual-identity-definition',
  validateParams(AiComicSeriesVisualIdentityDefinitionParamSchema),
  validateBody(AiComicSeriesVisualIdentityDefinitionUpdateRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId, visualIdentityId } = req.params as {
        seriesProjectId: string;
        visualIdentityId: string;
      };
      const result = await updateAiComicSeriesVisualIdentityDefinition(
        seriesProjectId,
        visualIdentityId,
        req.body,
      );
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST .../visual-identity-suggestion-draft — generate a read-only, non-approving patch for blank fields
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/visual-identities/:visualIdentityId/visual-identity-suggestion-draft',
  validateParams(AiComicSeriesVisualIdentityDefinitionParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId, visualIdentityId } = req.params as {
        seriesProjectId: string;
        visualIdentityId: string;
      };
      const result = await generateAiComicSeriesVisualIdentitySuggestionDraft(
        seriesProjectId,
        visualIdentityId,
      );
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/visual-world-rules/:worldRuleId/visual-world-rule-definition — save or review one world-rule visual mapping
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/visual-world-rules/:worldRuleId/visual-world-rule-definition',
  validateParams(AiComicSeriesVisualWorldRuleDefinitionParamSchema),
  validateBody(AiComicSeriesVisualWorldRuleDefinitionUpdateRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId, worldRuleId } = req.params as {
        seriesProjectId: string;
        worldRuleId: string;
      };
      const result = await updateAiComicSeriesVisualWorldRuleDefinition(
        seriesProjectId,
        worldRuleId,
        req.body,
      );
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST .../visual-world-rule-suggestion-draft — generate a read-only patch without creating pilot bindings
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/visual-world-rules/:worldRuleId/visual-world-rule-suggestion-draft',
  validateParams(AiComicSeriesVisualWorldRuleDefinitionParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId, worldRuleId } = req.params as {
        seriesProjectId: string;
        worldRuleId: string;
      };
      const result = await generateAiComicSeriesVisualWorldRuleSuggestionDraft(
        seriesProjectId,
        worldRuleId,
      );
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/rebuild-ledger — rebuild continuity ledger
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/rebuild-ledger',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeriesLedgerRebuildRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await rebuildAiComicSeriesContinuityLedger(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/repair-commercial-quality — repair only failed commercial beat dimensions
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/repair-commercial-quality',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await repairAiComicSeriesCommercialQualityProject(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/commercial-quality-human-review — persist one complete blind reviewer scorecard
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/commercial-quality-human-review',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeriesHumanReviewSubmitRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await submitAiComicSeriesCommercialHumanReview(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-commercial-blind-review-package — export reviewer-safe and operator-only files
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/export-commercial-blind-review-package',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await exportAiComicSeriesCommercialBlindReviewPackage(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-prompts — export series-level Seedance prompts
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/export-seedance-prompts',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await exportAiComicSeriesSeedancePrompts(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-cut-package — export ready videos for editing
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/export-seedance-cut-package',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await exportAiComicSeriesSeedanceCutPackage(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-cut/assemble — run or dry-run ffmpeg cut assembly
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-cut/assemble',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeedanceCutAssemblyRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await assembleAiComicSeriesSeedanceCut(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-retry-package — export shots that need resubmission
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/export-seedance-retry-package',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await exportAiComicSeriesSeedanceRetryPackage(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-retry-execution-plan — export actionable retry execution plan
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/export-seedance-retry-execution-plan',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await exportAiComicSeriesSeedanceRetryExecutionPlan(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-retry/submit — submit actionable retry execution candidates
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-retry/submit',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeedanceRetrySubmitRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await submitAiComicSeriesSeedanceRetryExecutionPlan(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/gears-jobs/submit — submit retry shots to GEARS
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/gears-jobs/submit',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(GearsJobSubmitRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await submitAiComicSeriesGearsJobs(seriesProjectId, req.body);
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

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/gears-jobs/sync — poll GEARS status and write ledgers
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/gears-jobs/sync',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(GearsJobStatusSyncRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await syncAiComicSeriesGearsJobStatuses(seriesProjectId, req.body);
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

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/gears-callback — accept GEARS job callbacks
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/gears-callback',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateGearsCallbackSecret,
  validateBody(GearsJobCallbackRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await importAiComicSeriesGearsCallbacks(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.VALIDATION_ERROR ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-version-comparison — export video version review report
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/export-seedance-version-comparison',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await exportAiComicSeriesSeedanceVersionComparisonPackage(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-asset-report — export shot asset reference integrity report
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/export-seedance-asset-report',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await exportAiComicSeriesSeedanceAssetReportPackage(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-edit-asset-package — export ready videos with bound assets for editing
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/export-seedance-edit-asset-package',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await exportAiComicSeriesSeedanceEditAssetPackage(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-thumbnail-plan — export thumbnail capture plan
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/export-seedance-thumbnail-plan',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await exportAiComicSeriesSeedanceThumbnailPlanPackage(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-finishing-plan — export finishing plan for subtitles/audio/title cards
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/export-seedance-finishing-plan',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await exportAiComicSeriesSeedanceFinishingPlanPackage(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-subtitles — export SRT subtitle package
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/export-seedance-subtitles',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeedanceSubtitleExportRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await exportAiComicSeriesSeedanceSubtitlePackage(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-subtitles/render — write sidecar SRT or burn subtitles into a cut
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-subtitles/render',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeedanceSubtitleRenderRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await renderAiComicSeriesSeedanceSubtitles(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-audio-plan — export audio asset and mix plan
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/export-seedance-audio-plan',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await exportAiComicSeriesSeedanceAudioPlanPackage(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-audio/mix — dry-run or run audio mix
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-audio/mix',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeedanceAudioMixRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await mixAiComicSeriesSeedanceAudio(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-production-dashboard — summarize Seedance production blockers and next actions
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-production-dashboard',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await getAiComicSeriesSeedanceProductionDashboard(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-editing-platform-package — export external editing platform package
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/export-seedance-editing-platform-package',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await exportAiComicSeriesSeedanceEditingPlatformPackage(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-title-card-plan — export title card plan
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/export-seedance-title-card-plan',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await exportAiComicSeriesSeedanceTitleCardPlanPackage(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-title-cards/render — dry-run or render title cards
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-title-cards/render',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeedanceTitleCardRenderRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await renderAiComicSeriesSeedanceTitleCards(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-final/assemble — dry-run or assemble final delivery
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-final/assemble',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeedanceFinalDeliveryRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await assembleAiComicSeriesSeedanceFinalDelivery(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-final/rollback — restore an immutable local release
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-final/rollback',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeedanceFinalDeliveryRollbackRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const access = res.locals.productAccess as ProductAccessContext | undefined;
      if (!access?.actor || access.authentication_method === 'local_bypass') {
        res.status(403).json(fail(
          ErrorCodes.ACCESS_FORBIDDEN,
          'A verified production operator session is required to roll back final delivery',
        ));
        return;
      }
      const result = await rollbackAiComicSeriesSeedanceFinalDelivery(seriesProjectId, req.body, {
        actor_id: access.actor.actor_id,
        authentication_method: access.authentication_method,
      });
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : result.error?.code === ErrorCodes.ACCESS_FORBIDDEN ? 403 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-reviews — add a review issue
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-reviews',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeedanceReviewAddRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await addAiComicSeriesSeedanceReview(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-reviews/resolve — resolve a review issue
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-reviews/resolve',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeedanceReviewResolveRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await resolveAiComicSeriesSeedanceReview(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/export-seedance-review-repair-package — export review repair package
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/export-seedance-review-repair-package',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await exportAiComicSeriesSeedanceReviewRepairPackage(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-thumbnails/capture — run or dry-run thumbnail capture worker
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-thumbnails/capture',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeedanceThumbnailCaptureRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await captureAiComicSeriesSeedanceThumbnails(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-asset-library — save Seedance asset file bindings
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-asset-library',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeedanceAssetLibraryUpdateRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await updateAiComicSeriesSeedanceAssetLibrary(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST .../gears-character-assets/local-test — Visual Bible → GEARS → immutable test assets
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/gears-character-assets/local-test',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await runAiComicSeriesGearsCharacterAssetLocalTest(seriesProjectId);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-assets/upload — ingest immutable image bytes
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-assets/upload',
  validateParams(AiComicSeriesProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      let parsed: Awaited<ReturnType<typeof parseMultipartAssetUpload>>;
      try {
        parsed = await parseMultipartAssetUpload(req, {
          max_bytes: SERIES_ASSET_UPLOAD_MAX_BYTES,
          default_filename: 'series-seedance-asset.bin',
        });
      } catch (err: any) {
        res.status(400).json(fail(ErrorCodes.VALIDATION_ERROR, err.message ?? 'Invalid series asset upload'));
        return;
      }
      if (!parsed.file) {
        res.status(400).json(fail(ErrorCodes.VALIDATION_ERROR, 'Series asset upload requires a file field'));
        return;
      }
      const kind = parsed.fields.kind;
      const result = await uploadAiComicSeriesSeedanceAssetFile(seriesProjectId, {
        asset_id: parsed.fields.asset_id,
        label: parsed.fields.label,
        kind: ['character', 'costume', 'location', 'prop', 'unknown'].includes(kind) ? kind as any : undefined,
        reference_slot: parsed.fields.reference_slot,
        description: parsed.fields.description,
        series_identity_id: parsed.fields.series_identity_id,
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

// GET /api/story-outline/ai-comic-series-projects/:seriesProjectId/media-assets/:artifactId/preview — authenticated immutable preview
outlineRouter.get(
  '/ai-comic-series-projects/:seriesProjectId/media-assets/:artifactId/preview',
  validateParams(AiComicSeriesMediaArtifactPreviewParamSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId, artifactId } = req.params as { seriesProjectId: string; artifactId: string };
      const result = await readAiComicSeriesMediaAssetPreview(seriesProjectId, artifactId);
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

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/media-assets/:assetId/review — verified rights and visual review
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/media-assets/:assetId/review',
  validateParams(AiComicSeriesMediaAssetReviewParamSchema),
  validateBody(MediaAssetReviewUpdateRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId, assetId } = req.params as { seriesProjectId: string; assetId: string };
      if (assetId !== req.body.asset_id) {
        res.status(400).json(fail(ErrorCodes.VALIDATION_ERROR, 'Path assetId must match body asset_id'));
        return;
      }
      const access = res.locals.productAccess as ProductAccessContext | undefined;
      if (!access?.actor || access.authentication_method === 'local_bypass') {
        res.status(403).json(fail(
          ErrorCodes.ACCESS_FORBIDDEN,
          'A verified reviewer session is required to grant series media rights or human visual review credit',
        ));
        return;
      }
      const result = await updateAiComicSeriesMediaAssetReview(seriesProjectId, req.body, {
        actor_id: access.actor.actor_id,
        authentication_method: access.authentication_method,
      });
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-audio-library — save Seedance audio asset bindings
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-audio-library',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeedanceAudioLibraryUpdateRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await updateAiComicSeriesSeedanceAudioLibrary(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-production-callback — accept external platform shot callbacks
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-production-callback',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateSeedanceCallbackSecret,
  validateBody(AiComicSeedanceProductionCallbackRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await applyAiComicSeriesSeedanceProductionCallback(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-provider/recover-timeouts — dry-run or mark timed out provider tasks failed
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-provider/recover-timeouts',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeedanceProviderRecoveryRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await recoverAiComicSeriesSeedanceProviderTimeouts(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-production-status — update one shot production status
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-production-status',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeedanceProductionStatusUpdateRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await updateAiComicSeriesSeedanceProductionStatus(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-production-version — select the preferred ready video version for cutting
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-production-version',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeedanceProductionVersionSelectRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await selectAiComicSeriesSeedanceProductionVersion(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-production-version/auto — auto-select preferred ready video versions
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-production-version/auto',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeedanceProductionAutoSelectRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await autoSelectAiComicSeriesSeedanceProductionVersions(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-series-projects/:seriesProjectId/seedance-production-status/batch — batch update shot production statuses
outlineRouter.post(
  '/ai-comic-series-projects/:seriesProjectId/seedance-production-status/batch',
  validateParams(AiComicSeriesProjectIdParamSchema),
  validateBody(AiComicSeedanceProductionBatchUpdateRequestSchema),
  async (req, res, next) => {
    try {
      const { seriesProjectId } = req.params as { seriesProjectId: string };
      const result = await updateAiComicSeriesSeedanceProductionStatuses(seriesProjectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-episode-context-preview — preview generation context before creating one episode
outlineRouter.post(
  '/ai-comic-episode-context-preview',
  validateBody(AiComicEpisodeContextPreviewRequestSchema),
  async (req, res, next) => {
    try {
      const result = await previewAiComicEpisodeContext(req.body);
      const status = result.ok
        ? 200
        : result.error?.code === ErrorCodes.STORY_NOT_FOUND
          ? 404
          : 400;
      res.status(status).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/story-outline/ai-comic-episode — generate one full episode from a series plan
outlineRouter.post('/ai-comic-episode', validateBody(AiComicEpisodeGenerateRequestSchema), async (req, res, next) => {
  try {
    const access = res.locals.productAccess as ProductAccessContext | undefined;
    const accessControl = access?.mode === 'required' && access.actor
      ? productResourceOwnershipForActor(access.actor)
      : undefined;
    const result = await generateAiComicEpisodeFromPlan(req.body, { access_control: accessControl });
    const status = result.ok
      ? 200
      : result.error?.code === ErrorCodes.DOMAIN_SAFETY_VALIDATION_FAILED
        ? 422
      : result.error?.code === ErrorCodes.STORY_NOT_FOUND
        ? 404
        : 400;
    res.status(status).json(result);
  } catch (err) {
    next(err);
  }
});
