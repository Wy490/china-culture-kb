import { Router, type Request } from 'express';
import type { StoryAgentSeedancePreproductionExportRequest } from '@shared/types.js';
import { ErrorCodes } from '@shared/types.js';
import { StoryAgentSeedancePreproductionExportRequestSchema } from '@shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { requireProductAccess } from '../middleware/product-access.js';
import { exportStoryAgentSeedancePreproductionPackage } from '../services/story-agent-preproduction-package-service.js';

export const storyAgentRouter = Router();

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
