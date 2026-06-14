// web/server/src/routes/outline.ts — Story outline analysis route

import { Router } from 'express';
import { ErrorCodes } from '@shared/types.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
  AiComicEpisodeContextPreviewRequestSchema,
  AiComicEpisodeGenerateRequestSchema,
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
  copyAiComicSeriesProject,
  deleteAiComicSeriesProject,
  exportAiComicSeriesBible,
  previewAiComicEpisodeContext,
  generateAiComicEpisodeFromPlan,
  generateAiComicSeriesPlan,
  getAiComicSeriesProject,
  listAiComicSeriesProjects,
  rebuildAiComicSeriesContinuityLedger,
  saveAiComicSeriesProject,
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
