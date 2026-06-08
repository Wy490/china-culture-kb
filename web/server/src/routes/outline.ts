// web/server/src/routes/outline.ts — Story outline analysis route

import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { StoryOutlineAnalyzeRequestSchema, MultiMatchRequestSchema } from '@shared/schemas.js';
import { analyzeOutline, multiMatchEntries } from '../services/outline-service.js';

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