// web/server/src/routes/stories.ts — Story plan, generate, list, detail, gears-segments routes

import { Router, type Request } from 'express';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
  GearsDeliveryUpdateRequestSchema,
  StoryPlanRequestSchema,
  StoryGenerateRequestSchema,
  StoryIdParamSchema,
} from '@shared/schemas.js';
import {
  listStories,
  getStory,
  getGearsSegments,
  getGearsDeliveryPackage,
  getSeedancePromptPackage,
  updateGearsDeliveryMarkdown,
} from '../services/story-service.js';
import type { StoryGenerateRequest, VideoType } from '@shared/types.js';
import { ErrorCodes } from '@shared/types.js';
import type { ProductAccessContext } from '@shared/product-access.js';
import { requireProductAccess } from '../middleware/product-access.js';
import {
  filterProductResourcesForRequest,
  productResourceOwnershipForActor,
  storyProjectResourceIdsForStoryId,
} from '../services/product-resource-access-service.js';
import { storyAgentDomainRegistry } from '../platform/domain-registry.js';

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
    const result = await storyAgentDomainRegistry.require(domain).generateStory(
      storyRequest,
      { access_control: accessControl },
    );
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

// GET /api/stories — list stories (optional query params: generation_type, video_type)
storiesRouter.get('/', requireProductAccess('project:read'), async (req, res, next) => {
  try {
    const generationType = req.query.generation_type as string | undefined;
    const videoType = req.query.video_type as VideoType | undefined;
    const result = await listStories(generationType, videoType);
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
