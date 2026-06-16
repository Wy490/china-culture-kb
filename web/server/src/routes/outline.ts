// web/server/src/routes/outline.ts — Story outline analysis route

import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { ErrorCodes, fail } from '@shared/types.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
  AiComicEpisodeContextPreviewRequestSchema,
  AiComicEpisodeGenerateRequestSchema,
  AiComicSeedanceAssetLibraryUpdateRequestSchema,
  AiComicSeedanceProductionAutoSelectRequestSchema,
  AiComicSeedanceProductionBatchUpdateRequestSchema,
  AiComicSeedanceProductionCallbackRequestSchema,
  AiComicSeedanceProductionStatusUpdateRequestSchema,
  AiComicSeedanceProductionVersionSelectRequestSchema,
  AiComicSeedanceCutAssemblyRequestSchema,
  AiComicSeedanceThumbnailCaptureRequestSchema,
  AiComicSeriesLedgerRebuildRequestSchema,
  AiComicSeriesProjectArchiveRequestSchema,
  AiComicSeriesProjectCopyRequestSchema,
  AiComicSeriesProjectIdParamSchema,
  AiComicSeriesProjectSaveRequestSchema,
  AiComicSeriesPlanRequestSchema,
  StoryOutlineAnalyzeRequestSchema,
} from '@shared/schemas.js';
import { analyzeOutline } from '../services/outline-service.js';
import {
  archiveAiComicSeriesProject,
  applyAiComicSeriesSeedanceProductionCallback,
  assembleAiComicSeriesSeedanceCut,
  autoSelectAiComicSeriesSeedanceProductionVersions,
  captureAiComicSeriesSeedanceThumbnails,
  copyAiComicSeriesProject,
  deleteAiComicSeriesProject,
  exportAiComicSeriesBible,
  exportAiComicSeriesSeedanceAssetReportPackage,
  exportAiComicSeriesSeedanceCutPackage,
  exportAiComicSeriesSeedanceEditAssetPackage,
  exportAiComicSeriesSeedanceFinishingPlanPackage,
  exportAiComicSeriesSeedancePrompts,
  exportAiComicSeriesSeedanceRetryPackage,
  exportAiComicSeriesSeedanceThumbnailPlanPackage,
  exportAiComicSeriesSeedanceVersionComparisonPackage,
  previewAiComicEpisodeContext,
  generateAiComicEpisodeFromPlan,
  generateAiComicSeriesPlan,
  getAiComicSeriesProject,
  listAiComicSeriesProjects,
  rebuildAiComicSeriesContinuityLedger,
  saveAiComicSeriesProject,
  selectAiComicSeriesSeedanceProductionVersion,
  updateAiComicSeriesSeedanceAssetLibrary,
  updateAiComicSeriesSeedanceProductionStatus,
  updateAiComicSeriesSeedanceProductionStatuses,
} from '../services/ai-comic-series-service.js';

export const outlineRouter = Router();

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
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/story-outline/ai-comic-series-projects — save an AI comic series plan
outlineRouter.post('/ai-comic-series-projects', validateBody(AiComicSeriesProjectSaveRequestSchema), async (req, res, next) => {
  try {
    const result = await saveAiComicSeriesProject(req.body);
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
      const result = await copyAiComicSeriesProject(seriesProjectId, req.body);
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

function validateSeedanceCallbackSecret(req: Request, res: Response, next: NextFunction): void {
  const expectedSecret = process.env.SEEDANCE_CALLBACK_SECRET?.trim();
  if (!expectedSecret) {
    next();
    return;
  }
  const providedSecret = seedanceCallbackSecretFromRequest(req);
  if (providedSecret && safeEqualText(providedSecret, expectedSecret)) {
    next();
    return;
  }
  res.status(401).json(fail(
    ErrorCodes.VALIDATION_ERROR,
    'Seedance callback secret is missing or invalid',
  ));
}

function seedanceCallbackSecretFromRequest(req: Request): string | undefined {
  const explicit = req.header('x-seedance-callback-secret')?.trim();
  if (explicit) return explicit;
  const authorization = req.header('authorization')?.trim();
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function safeEqualText(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

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
    const result = await generateAiComicEpisodeFromPlan(req.body);
    const status = result.ok
      ? 200
      : result.error?.code === ErrorCodes.STORY_NOT_FOUND
        ? 404
        : 400;
    res.status(status).json(result);
  } catch (err) {
    next(err);
  }
});
