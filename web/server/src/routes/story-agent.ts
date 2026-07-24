import { Router, type Request } from 'express';
import type {
  StoryAgentImageGenerationResult,
  StoryAgentImageRunExportRequest,
  StoryAgentSeedancePreproductionExportRequest,
} from '@shared/types.js';
import { ErrorCodes } from '@shared/types.js';
import {
  StoryAgentImageGenerationResultSchema,
  StoryAgentImageRunExportRequestSchema,
  StoryAgentImageRunIdParamSchema,
  StoryAgentSeedancePreproductionExportRequestSchema,
} from '@shared/schemas.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { requireProductAccess } from '../middleware/product-access.js';
import { exportStoryAgentSeedancePreproductionPackage } from '../services/story-agent-preproduction-package-service.js';
import {
  exportStoryAgentImageGenerationRequest,
  getStoryAgentImageRun,
  importStoryAgentImageGenerationResult,
} from '../services/story-agent-image-run-service.js';

export const storyAgentRouter = Router();

function routeParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const requireUnscopedProjectRead = requireProductAccess('project:read');
const requireStoryProjectRead = requireProductAccess('project:read', {
  resource: {
    type: 'story_project',
    ids: req => {
      const projectId = (req.body as StoryAgentSeedancePreproductionExportRequest).project_id;
      return projectId ? [projectId] : [];
    },
  },
});
const requireSeriesProjectRead = requireProductAccess('project:read', {
  resource: {
    type: 'series_project',
    ids: req => {
      const seriesProjectId = (req.body as StoryAgentSeedancePreproductionExportRequest).series_project_id;
      return seriesProjectId ? [seriesProjectId] : [];
    },
  },
});
const requireStoryProjectProductionWrite = requireProductAccess('production:write', {
  resource: {
    type: 'story_project',
    ids: req => {
      const projectId = (req.body as StoryAgentImageRunExportRequest).project_id;
      return projectId ? [projectId] : [];
    },
  },
});
const requireSeriesProjectProductionWrite = requireProductAccess('production:write', {
  resource: {
    type: 'series_project',
    ids: req => {
      const seriesProjectId = (req.body as StoryAgentImageRunExportRequest).series_project_id;
      return seriesProjectId ? [seriesProjectId] : [];
    },
  },
});

function requirePreproductionSourceRead(req: Request, res: Parameters<typeof requireStoryProjectRead>[1], next: Parameters<typeof requireStoryProjectRead>[2]): void {
  const body = req.body as StoryAgentSeedancePreproductionExportRequest;
  if (body.project_id) {
    requireStoryProjectRead(req, res, next);
    return;
  }
  if (body.series_project_id) {
    requireSeriesProjectRead(req, res, next);
    return;
  }
  requireUnscopedProjectRead(req, res, next);
}

function requireImageRunSourceWrite(
  req: Request,
  res: Parameters<typeof requireStoryProjectProductionWrite>[1],
  next: Parameters<typeof requireStoryProjectProductionWrite>[2],
): void {
  const body = req.body as StoryAgentImageRunExportRequest;
  if (body.project_id) {
    requireStoryProjectProductionWrite(req, res, next);
    return;
  }
  requireSeriesProjectProductionWrite(req, res, next);
}

async function requirePersistedImageRunAccess(
  permission: 'project:read' | 'production:write',
  req: Request,
  res: Parameters<typeof requireStoryProjectRead>[1],
  next: Parameters<typeof requireStoryProjectRead>[2],
): Promise<void> {
  const result = await getStoryAgentImageRun(routeParam(req.params.runId));
  if (!result.ok || !result.data) {
    next();
    return;
  }
  const source = result.data.source;
  const middleware = requireProductAccess(permission, {
    resource: {
      type: source.kind === 'ai_comic_series_project' ? 'series_project' : 'story_project',
      ids: () => [source.source_id],
    },
  });
  await middleware(req, res, next);
}

// POST /api/story-agent/preproduction/export
// Canonical Story Agent boundary export shared by stories, ordinary projects and series.
storyAgentRouter.post(
  '/preproduction/export',
  validateBody(StoryAgentSeedancePreproductionExportRequestSchema),
  requirePreproductionSourceRead,
  async (req, res, next) => {
    try {
      const result = await exportStoryAgentSeedancePreproductionPackage(
        req.body as StoryAgentSeedancePreproductionExportRequest,
      );
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400)
        .json(result);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/story-agent/image-runs/export-request
// Persists a provider-free request manifest for Codex imagegen execution.
storyAgentRouter.post(
  '/image-runs/export-request',
  validateBody(StoryAgentImageRunExportRequestSchema),
  requireImageRunSourceWrite,
  async (req, res, next) => {
    try {
      const result = await exportStoryAgentImageGenerationRequest(
        req.body as StoryAgentImageRunExportRequest,
      );
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400)
        .json(result);
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/story-agent/image-runs/:runId
storyAgentRouter.get(
  '/image-runs/:runId',
  validateParams(StoryAgentImageRunIdParamSchema),
  (req, res, next) => {
    void requirePersistedImageRunAccess('project:read', req, res, next).catch(next);
  },
  async (req, res, next) => {
    try {
      const result = await getStoryAgentImageRun(routeParam(req.params.runId));
      res.status(result.ok ? 200 : 404).json(result);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/story-agent/image-runs/:runId/import-result
storyAgentRouter.post(
  '/image-runs/:runId/import-result',
  validateParams(StoryAgentImageRunIdParamSchema),
  validateBody(StoryAgentImageGenerationResultSchema),
  (req, res, next) => {
    void requirePersistedImageRunAccess('production:write', req, res, next).catch(next);
  },
  async (req, res, next) => {
    try {
      const result = await importStoryAgentImageGenerationResult(
        routeParam(req.params.runId),
        req.body as StoryAgentImageGenerationResult,
      );
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400)
        .json(result);
    } catch (error) {
      next(error);
    }
  },
);
