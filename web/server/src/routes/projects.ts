import { Router } from 'express';
import { validateBody, validateParams } from '../middleware/validate.js';
import { ProjectIdParamSchema, StorySceneRegenerateRequestSchema } from '@shared/schemas.js';
import { deleteProject, getProject, listProjects, regenerateProjectScene } from '../services/project-service.js';

export const projectsRouter = Router();

projectsRouter.get('/', async (_req, res, next) => {
  try {
    const result = await listProjects();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/:projectId', validateParams(ProjectIdParamSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params as { projectId: string };
    const result = await getProject(projectId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.delete('/:projectId', validateParams(ProjectIdParamSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params as { projectId: string };
    const result = await deleteProject(projectId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.post(
  '/:projectId/regenerate-scene',
  validateParams(ProjectIdParamSchema),
  validateBody(StorySceneRegenerateRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await regenerateProjectScene(projectId, req.body);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);
