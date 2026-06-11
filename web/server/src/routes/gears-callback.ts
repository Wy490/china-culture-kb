import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { GearsVideoReadyCallbackRequestSchema } from '@shared/schemas.js';
import { updateGearsVideoReady } from '../services/story-service.js';

export const gearsCallbackRouter = Router();

gearsCallbackRouter.post(
  '/video-ready',
  validateBody(GearsVideoReadyCallbackRequestSchema),
  async (req, res, next) => {
    try {
      const result = await updateGearsVideoReady(req.body);
      res.status(result.ok ? 200 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);
