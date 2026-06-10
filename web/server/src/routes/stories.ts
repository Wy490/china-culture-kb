// web/server/src/routes/stories.ts — Story plan, generate, list, detail, gears-segments routes

import { Router } from 'express';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
  GearsDeliveryUpdateRequestSchema,
  StoryPlanRequestSchema,
  StoryGenerateRequestSchema,
  StoryIdParamSchema,
} from '@shared/schemas.js';
import {
  planStory,
  generateAndStoreStory,
  listStories,
  getStory,
  getGearsSegments,
  getGearsDeliveryPackage,
  updateGearsDeliveryMarkdown,
} from '../services/story-service.js';
import type { VideoType } from '@shared/types.js';

export const storiesRouter = Router();

// POST /api/stories/plan — preview recommendation for an entry
storiesRouter.post('/plan', validateBody(StoryPlanRequestSchema), async (req, res, next) => {
  try {
    const { entry_name, original_user_query } = req.body as { entry_name: string; original_user_query?: string };
    const result = await planStory(entry_name, original_user_query);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/stories/generate — create video proposal and store JSON file
storiesRouter.post('/generate', validateBody(StoryGenerateRequestSchema), async (req, res, next) => {
  try {
    const result = await generateAndStoreStory(req.body);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/stories — list stories (optional query params: generation_type, video_type)
storiesRouter.get('/', async (req, res, next) => {
  try {
    const generationType = req.query.generation_type as string | undefined;
    const videoType = req.query.video_type as VideoType | undefined;
    const result = await listStories(generationType, videoType);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/stories/:storyId — get story detail by storyId
storiesRouter.get('/:storyId', validateParams(StoryIdParamSchema), async (req, res, next) => {
  try {
    const { storyId } = req.params as { storyId: string };
    const result = await getStory(storyId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/stories/:storyId/gears-segments — get GEARS segments for a story
storiesRouter.get('/:storyId/gears-segments', validateParams(StoryIdParamSchema), async (req, res, next) => {
  try {
    const { storyId } = req.params as { storyId: string };
    const result = await getGearsSegments(storyId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/stories/:storyId/gears-delivery — get GEARS supply package markdown + assets + units
storiesRouter.get('/:storyId/gears-delivery', validateParams(StoryIdParamSchema), async (req, res, next) => {
  try {
    const { storyId } = req.params as { storyId: string };
    const result = await getGearsDeliveryPackage(storyId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/stories/:storyId/gears-delivery — persist edited GEARS delivery markdown
storiesRouter.patch(
  '/:storyId/gears-delivery',
  validateParams(StoryIdParamSchema),
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
