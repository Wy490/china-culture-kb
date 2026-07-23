import { existsSync } from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { success } from '@shared/types.js';
import { requireProductAccess } from '../middleware/product-access.js';
import {
  createFilmReferenceAnalysis,
  createReferenceSource,
  createTextReferenceAnalysis,
  getReferenceLibraryDetail,
  listReferenceSources,
} from '../services/reference-library-service.js';

function resolveDefaultRepoRoot(): string {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd(), '..', '..'),
    path.resolve(import.meta.dirname, '..', '..', '..', '..'),
  ];
  return candidates.find(candidate => existsSync(path.join(candidate, 'references/creative')))
    ?? candidates[0];
}

export function createReferenceLibraryRouter(repoRoot = resolveDefaultRepoRoot()): Router {
  const router = Router();
  router.use(requireProductAccess('material:review'));

  router.get('/references', async (_req, res, next) => {
    try {
      res.json(success(await listReferenceSources({ repoRoot })));
    } catch (error) {
      next(error);
    }
  });

  router.post('/references', async (req, res, next) => {
    try {
      const record = await createReferenceSource({ repoRoot, request: req.body });
      res.status(201).json(success(record));
    } catch (error) {
      next(error);
    }
  });

  router.get('/references/:referenceId', async (req, res, next) => {
    try {
      res.json(success(await getReferenceLibraryDetail({
        repoRoot,
        referenceId: req.params.referenceId,
      })));
    } catch (error) {
      next(error);
    }
  });

  router.post('/references/:referenceId/film-analyses', async (req, res, next) => {
    try {
      const record = await createFilmReferenceAnalysis({
        repoRoot,
        referenceId: req.params.referenceId,
        request: req.body,
      });
      res.status(201).json(success(record));
    } catch (error) {
      next(error);
    }
  });

  router.post('/references/:referenceId/text-analyses', async (req, res, next) => {
    try {
      const record = await createTextReferenceAnalysis({
        repoRoot,
        referenceId: req.params.referenceId,
        request: req.body,
      });
      res.status(201).json(success(record));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const referenceLibraryRouter = createReferenceLibraryRouter();
