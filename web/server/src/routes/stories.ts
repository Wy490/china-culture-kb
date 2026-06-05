// web/server/src/routes/stories.ts — Story plan, generate, list, detail, gears-segments routes

import { Router } from 'express';
import { validateBody, validateParams } from '../middleware/validate.js';
import { StoryPlanRequestSchema, StoryGenerateRequestSchema, StoryIdParamSchema } from '@shared/schemas.js';
import {
  planStory,
  generateAndStoreStory,
  listStories,
  getStory,
  getGearsSegments,
} from '../services/story-service.js';
import type { GenerationType } from '@shared/types.js';

export const storiesRouter = Router();

// POST /api/stories/plan — preview recommendation for an entry
storiesRouter.post('/plan', validateBody(StoryPlanRequestSchema), async (req, res, next) => {
  try {
    const { entry_name } = req.body as { entry_name: string };
    const result = await planStory(entry_name);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/stories/generate — create story skeleton and store JSON file
storiesRouter.post('/generate', validateBody(StoryGenerateRequestSchema), async (req, res, next) => {
  try {
    const result = await generateAndStoreStory(req.body);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/stories — list stories (optional query param generation_type)
storiesRouter.get('/', async (req, res, next) => {
  try {
    const generationType = req.query.generation_type as GenerationType | undefined;
    const result = await listStories(generationType);
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