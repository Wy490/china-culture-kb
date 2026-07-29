// web/server/src/routes/stories.ts — Story plan, generate, list, detail, gears-segments routes

import { Router, type Request } from 'express';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import {
  GearsDeliveryUpdateRequestSchema,
  ReferenceBaselineReplayDraftRequestSchema,
  ReferenceGenerationRecipeRecommendationRequestSchema,
  ReferenceRecipeComparisonDraftRequestSchema,
  StoryPlanRequestSchema,
  StoryGenerateRequestSchema,
  StoryIdParamSchema,
  StoryListQuerySchema,
} from '@shared/schemas.js';
import {
  listStories,
  getStory,
  getGearsSegments,
  getGearsDeliveryPackage,
  getSeedancePromptPackage,
  updateGearsDeliveryMarkdown,
} from '../services/story-service.js';
import type {
  ReferenceBaselineReplayDraftRequest,
  ReferenceGenerationRecipeRecommendationRequest,
  ReferenceRecipeComparisonDraftRequest,
  StoryGenerateRequest,
  VideoType,
} from '@shared/types.js';
import { ErrorCodes, success } from '@shared/types.js';
import type { ProductAccessContext } from '@shared/product-access.js';
import { requireProductAccess } from '../middleware/product-access.js';
import {
  filterProductResourcesForRequest,
  productResourceOwnershipForActor,
  storyProjectResourceIdsForStoryId,
} from '../services/product-resource-access-service.js';
import { storyAgentDomainRegistry } from '../platform/domain-registry.js';
import { resolveStoryVideoType } from '../platform/story-generation-policy.js';
import { runWithStoryGenerationAttemptAudit } from '../services/story-generation-attempt-audit-service.js';
import { listReferenceStylePacks } from '../services/reference-library-service.js';
import {
  createReferenceBaselineReplayDraft,
  createReferenceRecipeComparisonDraft,
} from '../services/reference-baseline-replay-service.js';
import { recommendReferenceGenerationRecipes } from '../services/reference-generation-recipe-recommendation-service.js';
import { storyRepositoryRoot } from '../platform/story-storage-root.js';

export const storiesRouter = Router();

const requireStoryCreate = requireProductAccess('story:create');
const storyProjectResource = {
  type: 'story_project' as const,
  ids: (req: Request) => typeof req.params.storyId === 'string'
    ? storyProjectResourceIdsForStoryId(req.params.storyId)
    : [],
  required: true,
};
const requireStoryRead = requireProductAccess('project:read', { resource: storyProjectResource });
const baselineStoryResource = {
  type: 'story_project' as const,
  ids: (req: Request) => typeof req.body?.baseline_story_id === 'string'
    ? storyProjectResourceIdsForStoryId(req.body.baseline_story_id)
    : [],
  required: true,
};
const requireBaselineStoryRead = requireProductAccess('project:read', {
  resource: baselineStoryResource,
});
const requireStoryProductionWrite = requireProductAccess('production:write', { resource: storyProjectResource });

// POST /api/stories/plan — preview recommendation for an entry
storiesRouter.post('/plan', requireStoryCreate, validateBody(StoryPlanRequestSchema), async (req, res, next) => {
  try {
    const { domain = 'china_culture', entry_name, original_user_query } = req.body as {
      domain?: string;
      entry_name: string;
      original_user_query?: string;
    };
    const result = await storyAgentDomainRegistry.require(domain).planStory({ entry_name, original_user_query });
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/stories/generate — create video proposal and store JSON file
storiesRouter.post(
  '/generate',
  requireStoryCreate,
  validateBody(StoryGenerateRequestSchema),
  async (req, res, next) => {
  try {
    const access = res.locals.productAccess as ProductAccessContext | undefined;
    const accessControl = access?.mode === 'required' && access.actor
      ? productResourceOwnershipForActor(access.actor)
      : undefined;
    const { domain = 'china_culture', ...storyRequest } = req.body as StoryGenerateRequest & {
      domain?: string;
    };
    const result = await runWithStoryGenerationAttemptAudit({
      sourceDomain: domain,
      videoType: resolveStoryVideoType(storyRequest),
    }, () => storyAgentDomainRegistry.require(domain).generateStory(
      storyRequest,
      { access_control: accessControl },
    ));
    const status = result.ok
      ? 200
      : result.error?.code === ErrorCodes.DOMAIN_SAFETY_VALIDATION_FAILED
        ? 422
        : result.error?.code === ErrorCodes.VALIDATION_ERROR
          ? 400
          : 404;
    res.status(status).json(result);
  } catch (err) {
    next(err);
  }
  },
);

storiesRouter.get('/reference-style-pack-catalog', requireStoryCreate, async (_req, res, next) => {
  try {
    const stylePacks = await listReferenceStylePacks({
      repoRoot: storyRepositoryRoot(),
    });
    res.json(success(stylePacks.map(pack => ({
      id: pack.id,
      name: pack.name,
      description: pack.description,
      compatible_video_types: pack.compatible_video_types,
      compatible_presentation_styles: pack.compatible_presentation_styles,
      compatible_story_structures: pack.compatible_story_structures,
      reusable_principles: pack.reusable_principles,
      avoid_copying: pack.avoid_copying,
      source_reference_count: pack.source_reference_ids.length,
      source_analysis_count: pack.source_analysis_ids.length,
      source_benchmark_count: pack.source_benchmark_ids.length,
      approval: pack.approval,
      governance: pack.governance,
    }))));
  } catch (error) {
    next(error);
  }
});

storiesRouter.post(
  '/reference-baseline-replay-drafts',
  requireStoryCreate,
  validateBody(ReferenceBaselineReplayDraftRequestSchema),
  requireBaselineStoryRead,
  async (req, res, next) => {
    try {
      const request = req.body as ReferenceBaselineReplayDraftRequest;
      res.json(success(await createReferenceBaselineReplayDraft({
        repoRoot: storyRepositoryRoot(),
        baselineStoryId: request.baseline_story_id,
        stylePackIds: request.style_pack_ids,
      })));
    } catch (error) {
      next(error);
    }
  },
);

storiesRouter.post(
  '/reference-generation-recipe-recommendations',
  requireStoryCreate,
  validateBody(ReferenceGenerationRecipeRecommendationRequestSchema),
  (req, res, next) => {
    try {
      const request = req.body as ReferenceGenerationRecipeRecommendationRequest;
      res.json(success(recommendReferenceGenerationRecipes(request)));
    } catch (error) {
      next(error);
    }
  },
);

storiesRouter.post(
  '/reference-generation-recipe-comparison-drafts',
  requireStoryCreate,
  validateBody(ReferenceRecipeComparisonDraftRequestSchema),
  async (req, res, next) => {
    try {
      const request = req.body as ReferenceRecipeComparisonDraftRequest;
      res.json(success(await createReferenceRecipeComparisonDraft({
        baselineStoryId: request.baseline_story_id,
        recipeId: request.recipe_id,
      })));
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/stories — list stories (optional query params: generation_type, video_type)
storiesRouter.get('/', requireProductAccess('project:read'), validateQuery(StoryListQuerySchema), async (req, res, next) => {
  try {
    const generationType = req.query.generation_type as string | undefined;
    const videoType = req.query.video_type as VideoType | undefined;
    const domain = req.query.domain as string | undefined;
    if (domain) storyAgentDomainRegistry.require(domain);
    const result = await listStories(generationType, videoType, domain);
    const data = result.data
      ? await filterProductResourcesForRequest(
        req,
        'story_project',
        result.data,
        item => `${item.storyId}--${item.video_type}`,
      )
      : result.data;
    res.json({ ...result, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/stories/:storyId — get story detail by storyId
storiesRouter.get('/:storyId', validateParams(StoryIdParamSchema), requireStoryRead, async (req, res, next) => {
  try {
    const { storyId } = req.params as { storyId: string };
    const result = await getStory(storyId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/stories/:storyId/gears-segments — get GEARS segments for a story
storiesRouter.get('/:storyId/gears-segments', validateParams(StoryIdParamSchema), requireStoryRead, async (req, res, next) => {
  try {
    const { storyId } = req.params as { storyId: string };
    const result = await getGearsSegments(storyId, {
      resolve_domain_pack: domain => storyAgentDomainRegistry.require(domain),
    });
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/stories/:storyId/gears-delivery — get GEARS supply package markdown + assets + units
storiesRouter.get('/:storyId/gears-delivery', validateParams(StoryIdParamSchema), requireStoryRead, async (req, res, next) => {
  try {
    const { storyId } = req.params as { storyId: string };
    const result = await getGearsDeliveryPackage(storyId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/stories/:storyId/seedance-prompts — get shot-level Seedance 2.0 prompts
storiesRouter.get('/:storyId/seedance-prompts', validateParams(StoryIdParamSchema), requireStoryRead, async (req, res, next) => {
  try {
    const { storyId } = req.params as { storyId: string };
    const result = await getSeedancePromptPackage(storyId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/stories/:storyId/gears-delivery — persist edited GEARS delivery markdown
storiesRouter.patch(
  '/:storyId/gears-delivery',
  validateParams(StoryIdParamSchema),
  requireStoryProductionWrite,
  validateBody(GearsDeliveryUpdateRequestSchema),
  async (req, res, next) => {
    try {
      const { storyId } = req.params as { storyId: string };
      const { markdown } = req.body as { markdown: string };
      const result = await updateGearsDeliveryMarkdown(storyId, markdown);
      res.status(result.ok ? 200 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);
