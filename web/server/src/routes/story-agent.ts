import { Router, type Request } from 'express';
import type {
  StoryAgentImageGenerationResult,
  StoryAgentImageRunExportRequest,
  StoryAgentRunGenerateRequest,
  StoryAgentRunListQuery,
  StoryAgentRunStartRequest,
  StoryAgentSeedancePreproductionExportRequest,
} from '@shared/types.js';
import { ErrorCodes, fail } from '@shared/types.js';
import type { ProductAccessContext } from '@shared/product-access.js';
import {
  StoryAgentImageGenerationResultSchema,
  StoryAgentImageRunExportRequestSchema,
  StoryAgentImageRunIdParamSchema,
  StoryAgentRunIdParamSchema,
  StoryAgentRunGenerateRequestSchema,
  StoryAgentRunStartRequestSchema,
  StoryAgentRunListQuerySchema,
  StoryAgentSeedancePreproductionExportRequestSchema,
} from '@shared/schemas.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { requireProductAccess } from '../middleware/product-access.js';
import { exportStoryAgentSeedancePreproductionPackage } from '../services/story-agent-preproduction-package-service.js';
import {
  exportStoryAgentImageGenerationRequest,
  getStoryAgentImageRun,
  importStoryAgentImageGenerationResult,
} from '../services/story-agent-image-run-service.js';
import {
  exportStoryAgentRun,
  generateStoryAgentRun,
  getStoryAgentRun,
  importStoryAgentRunImages,
  listStoryAgentRuns,
  resumeStoryAgentRun,
  startStoryAgentRun,
} from '../services/story-agent-run-service.js';
import { productResourceOwnershipForActor } from '../services/product-resource-access-service.js';

export const storyAgentRouter = Router();

function routeParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const requireUnscopedProjectRead = requireProductAccess('project:read');
const requireUnscopedProductionWrite = requireProductAccess('production:write');
const requireStoryCreate = requireProductAccess('story:create');
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
const requireStoryAgentRunProjectWrite = requireProductAccess('production:write', {
  resource: {
    type: 'story_project',
    ids: req => {
      const projectId = (req.body as StoryAgentRunStartRequest).project_id;
      return projectId ? [projectId] : [];
    },
  },
});
const requireStoryAgentRunSeriesWrite = requireProductAccess('production:write', {
  resource: {
    type: 'series_project',
    ids: req => {
      const seriesProjectId = (req.body as StoryAgentRunStartRequest).series_project_id;
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

function requireStoryAgentRunSourceWrite(
  req: Request,
  res: Parameters<typeof requireStoryAgentRunProjectWrite>[1],
  next: Parameters<typeof requireStoryAgentRunProjectWrite>[2],
): void {
  const body = req.body as StoryAgentRunStartRequest;
  if (body.project_id) {
    requireStoryAgentRunProjectWrite(req, res, next);
    return;
  }
  requireStoryAgentRunSeriesWrite(req, res, next);
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

async function requirePersistedStoryAgentRunAccess(
  permission: 'project:read' | 'production:write',
  req: Request,
  res: Parameters<typeof requireStoryProjectRead>[1],
  next: Parameters<typeof requireStoryProjectRead>[2],
): Promise<void> {
  const result = await getStoryAgentRun(routeParam(req.params.runId));
  if (!result.ok || !result.data) {
    next();
    return;
  }
  const source = result.data.source;
  if (!source) {
    const access = res.locals.productAccess as ProductAccessContext | undefined;
    const ownership = result.data.schema_version === 'story-agent-run/v2'
      ? result.data.access_control
      : undefined;
    const actor = access?.actor;
    const actorAllowed = access?.mode !== 'required'
      || Boolean(
        actor
        && ownership
        && actor.organization_id === ownership.organization_id
        && (
          actor.role === 'administrator'
          || actor.actor_id === ownership.owner_actor_id
          || ownership.member_actor_ids.includes(actor.actor_id)
        ),
      );
    if (!actorAllowed) {
      res.status(403).json(fail(
        ErrorCodes.ACCESS_RESOURCE_FORBIDDEN,
        'The authenticated actor is not allowed to access this pre-project Story Agent run',
      ));
      return;
    }
    next();
    return;
  }
  const middleware = requireProductAccess(permission, {
    resource: {
      type: source.kind === 'ai_comic_series_project' ? 'series_project' : 'story_project',
      ids: () => [source.source_id],
    },
  });
  await middleware(req, res, next);
}

// POST /api/story-agent/runs/generate
// Persists a v2 run before invoking canonical story generation.
storyAgentRouter.post(
  '/runs/generate',
  requireStoryCreate,
  requireUnscopedProductionWrite,
  validateBody(StoryAgentRunGenerateRequestSchema),
  async (req, res, next) => {
    try {
      const access = res.locals.productAccess as ProductAccessContext | undefined;
      const accessControl = access?.mode === 'required' && access.actor
        ? productResourceOwnershipForActor(access.actor)
        : undefined;
      const result = await generateStoryAgentRun(
        req.body as StoryAgentRunGenerateRequest,
        { accessControl },
      );
      res.status(
        result.ok
          ? 200
          : result.error?.code === ErrorCodes.STORY_AGENT_RUN_INPUT_CONFLICT
            ? 409
            : 400,
      ).json(result);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/story-agent/runs
// Creates one stable provider-free orchestration ledger for a persisted project.
storyAgentRouter.post(
  '/runs',
  requireUnscopedProductionWrite,
  validateBody(StoryAgentRunStartRequestSchema),
  requireStoryAgentRunSourceWrite,
  async (req, res, next) => {
    try {
      const result = await startStoryAgentRun(req.body as StoryAgentRunStartRequest);
      res.status(result.ok ? 200 : result.error?.code === ErrorCodes.STORY_NOT_FOUND ? 404 : 400)
        .json(result);
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/story-agent/runs
// Lists summaries through a stable cursor while bounding ledger reads per request.
storyAgentRouter.get(
  '/runs',
  requireUnscopedProjectRead,
  validateQuery(StoryAgentRunListQuerySchema),
  async (req, res, next) => {
    try {
      const access = res.locals.productAccess as ProductAccessContext | undefined;
      const result = await listStoryAgentRuns(
        req.query as unknown as StoryAgentRunListQuery,
        access,
      );
      res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/story-agent/runs/:runId/export
storyAgentRouter.get(
  '/runs/:runId/export',
  requireUnscopedProjectRead,
  validateParams(StoryAgentRunIdParamSchema),
  (req, res, next) => {
    void requirePersistedStoryAgentRunAccess('project:read', req, res, next).catch(next);
  },
  async (req, res, next) => {
    try {
      const result = await exportStoryAgentRun(routeParam(req.params.runId));
      res.status(result.ok ? 200 : 404).json(result);
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/story-agent/runs/:runId
storyAgentRouter.get(
  '/runs/:runId',
  requireUnscopedProjectRead,
  validateParams(StoryAgentRunIdParamSchema),
  (req, res, next) => {
    void requirePersistedStoryAgentRunAccess('project:read', req, res, next).catch(next);
  },
  async (req, res, next) => {
    try {
      const result = await getStoryAgentRun(routeParam(req.params.runId));
      res.status(result.ok ? 200 : 404).json(result);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/story-agent/runs/:runId/resume
storyAgentRouter.post(
  '/runs/:runId/resume',
  requireUnscopedProductionWrite,
  validateParams(StoryAgentRunIdParamSchema),
  (req, res, next) => {
    void requirePersistedStoryAgentRunAccess('production:write', req, res, next).catch(next);
  },
  async (req, res, next) => {
    try {
      const result = await resumeStoryAgentRun(routeParam(req.params.runId));
      res.status(result.ok ? 200 : 404).json(result);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/story-agent/runs/:runId/import-images
storyAgentRouter.post(
  '/runs/:runId/import-images',
  requireUnscopedProductionWrite,
  validateParams(StoryAgentRunIdParamSchema),
  validateBody(StoryAgentImageGenerationResultSchema),
  (req, res, next) => {
    void requirePersistedStoryAgentRunAccess('production:write', req, res, next).catch(next);
  },
  async (req, res, next) => {
    try {
      const result = await importStoryAgentRunImages(
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
