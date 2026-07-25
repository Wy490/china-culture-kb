import { existsSync } from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { ErrorCodes, fail, success } from '@shared/types.js';
import { requireProductAccess } from '../middleware/product-access.js';
import { getProductAccessContext } from '../services/product-access-service.js';
import {
  approveReferenceAnalysis,
  createBenchmarkCard,
  createFilmReferenceAnalysis,
  createReferenceSource,
  createReferenceSimilarityEvidence,
  createReferenceStylePack,
  createTextReferenceAnalysis,
  getBenchmarkCard,
  getReferenceLibraryDetail,
  getReferenceStylePack,
  getReferenceSimilarityEvidence,
  listBenchmarkCards,
  listReferenceSources,
  listReferenceStylePacks,
} from '../services/reference-library-service.js';
import {
  createReferenceAnalysisTask,
  getReferenceAnalysisTask,
  listReferenceAnalysisTasks,
  submitReferenceAnalysisTask,
} from '../services/reference-analysis-task-service.js';

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

function rejectInlineAnalysisApproval(request: unknown): void {
  if (
    request
    && typeof request === 'object'
    && Object.prototype.hasOwnProperty.call(request, 'approval')
  ) {
    const error = new Error(
      'Reference analysis must be created as pending and approved through the material:sign endpoint',
    ) as Error & { code: string };
    error.code = 'REFERENCE_ANALYSIS_APPROVAL_INVALID';
    throw error;
  }
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

  router.get('/benchmark-cards', async (_req, res, next) => {
    try {
      res.json(success(await listBenchmarkCards({ repoRoot })));
    } catch (error) {
      next(error);
    }
  });

  router.post('/benchmark-cards', async (req, res, next) => {
    try {
      const record = await createBenchmarkCard({ repoRoot, request: req.body });
      res.status(201).json(success(record));
    } catch (error) {
      next(error);
    }
  });

  router.get('/benchmark-cards/:benchmarkId', async (req, res, next) => {
    try {
      res.json(success(await getBenchmarkCard({
        repoRoot,
        benchmarkId: req.params.benchmarkId,
      })));
    } catch (error) {
      next(error);
    }
  });

  router.get('/style-packs', async (_req, res, next) => {
    try {
      res.json(success(await listReferenceStylePacks({ repoRoot })));
    } catch (error) {
      next(error);
    }
  });

  router.post('/style-packs', async (req, res, next) => {
    try {
      const record = await createReferenceStylePack({ repoRoot, request: req.body });
      res.status(201).json(success(record));
    } catch (error) {
      next(error);
    }
  });

  router.get('/style-packs/:stylePackId', async (req, res, next) => {
    try {
      res.json(success(await getReferenceStylePack({
        repoRoot,
        stylePackId: req.params.stylePackId,
      })));
    } catch (error) {
      next(error);
    }
  });

  router.get('/similarity-evidence/:evidenceId', async (req, res, next) => {
    try {
      res.json(success(await getReferenceSimilarityEvidence({
        repoRoot,
        evidenceId: req.params.evidenceId,
      })));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/analyses/:analysisId/approval',
    requireProductAccess('material:sign'),
    async (req, res, next) => {
      try {
        const access = getProductAccessContext(req);
        if (
          access.mode === 'required'
          && access.actor?.actor_id !== req.body?.approved_by
        ) {
          res.status(403).json(fail(
            ErrorCodes.ACCESS_FORBIDDEN,
            'Reference analysis approved_by must match the authenticated material signer',
          ));
          return;
        }
        const result = await approveReferenceAnalysis({
          repoRoot,
          analysisId: String(req.params.analysisId),
          request: req.body,
        });
        res.status(result.idempotent_replay ? 200 : 201).json(success(result));
      } catch (error) {
        next(error);
      }
    },
  );

  router.get('/analysis-tasks/:taskId', async (req, res, next) => {
    try {
      res.json(success(await getReferenceAnalysisTask({
        repoRoot,
        taskId: req.params.taskId,
      })));
    } catch (error) {
      next(error);
    }
  });

  router.post('/analysis-tasks/:taskId/submissions', async (req, res, next) => {
    try {
      const result = await submitReferenceAnalysisTask({
        repoRoot,
        taskId: req.params.taskId,
        request: req.body,
      });
      res.status(result.idempotent_replay ? 200 : 201).json(success(result));
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
      rejectInlineAnalysisApproval(req.body);
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
      rejectInlineAnalysisApproval(req.body);
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

  router.post('/references/:referenceId/similarity-evidence', async (req, res, next) => {
    try {
      const record = await createReferenceSimilarityEvidence({
        repoRoot,
        referenceId: req.params.referenceId,
        request: req.body,
      });
      res.status(201).json(success(record));
    } catch (error) {
      next(error);
    }
  });

  router.post('/references/:referenceId/analysis-tasks', async (req, res, next) => {
    try {
      const record = await createReferenceAnalysisTask({
        repoRoot,
        referenceId: req.params.referenceId,
        request: req.body,
      });
      res.status(201).json(success(record));
    } catch (error) {
      next(error);
    }
  });

  router.get('/references/:referenceId/analysis-tasks', async (req, res, next) => {
    try {
      res.json(success(await listReferenceAnalysisTasks({
        repoRoot,
        referenceId: req.params.referenceId,
      })));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const referenceLibraryRouter = createReferenceLibraryRouter();
