import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Router } from 'express';
import { success } from '@shared/types.js';
import {
  getStage8BlindReviewWorkspace,
  inspectStage8BlindReviewIntake,
} from '../services/stage8-blind-review-intake-service.js';
import { getStage8BlindReviewEvaluatorReadiness } from '../services/stage8-blind-review-evaluator-service.js';
import { getStage8BlindReviewSignatureWorkspace, inspectStage8BlindReviewSignature } from '../services/stage8-blind-review-signature-service.js';
import { getStage8FinalizationPreflightWorkspace, inspectStage8FinalizationPreflight } from '../services/stage8-finalization-preflight-service.js';
import { getStage8DurableReleaseWorkspace, inspectStage8DurableRelease } from '../services/stage8-durable-release-service.js';
import { getStage8Operations } from '../services/stage8-operations-service.js';

function resolveDefaultRepoRoot(): string {
  const candidates = [process.cwd(), resolve(process.cwd(), '..', '..'), resolve(import.meta.dirname, '..', '..', '..', '..')];
  return candidates.find(candidate => existsSync(resolve(candidate, 'data/professional-benchmarks/character-story-iteration3-benchmark-specs.json')))
    ?? candidates[0];
}

export function createStage8BlindReviewRouter(repoRoot = resolveDefaultRepoRoot()): Router {
  const router = Router();
  router.get('/intake', async (_req, res, next) => {
    try {
      res.json(success(await getStage8BlindReviewWorkspace({ repoRoot })));
    } catch (error) {
      next(error);
    }
  });
  router.post('/intake/validate', async (req, res, next) => {
    try {
      res.json(success(await inspectStage8BlindReviewIntake({ repoRoot, request: req.body })));
    } catch (error) {
      next(error);
    }
  });
  router.get('/evaluator', async (_req, res, next) => {
    try {
      res.json(success(await getStage8BlindReviewEvaluatorReadiness({ repoRoot })));
    } catch (error) {
      next(error);
    }
  });
  router.get('/signature', async (req, res, next) => {
    try { res.json(success(await getStage8BlindReviewSignatureWorkspace({ repoRoot, benchmarkId: req.query.benchmark_id }))); } catch (error) { next(error); }
  });
  router.post('/signature/validate', async (req, res, next) => {
    try { res.json(success(await inspectStage8BlindReviewSignature({ repoRoot, request: req.body }))); } catch (error) { next(error); }
  });
  router.get('/finalization', async (req, res, next) => {
    try { res.json(success(await getStage8FinalizationPreflightWorkspace({ repoRoot, benchmarkId: req.query.benchmark_id }))); } catch (error) { next(error); }
  });
  router.post('/finalization/validate', async (req, res, next) => {
    try { res.json(success(await inspectStage8FinalizationPreflight({ repoRoot, request: req.body }))); } catch (error) { next(error); }
  });
  router.get('/durable-release', async (req, res, next) => {
    try { res.json(success(await getStage8DurableReleaseWorkspace({ repoRoot, benchmarkId: req.query.benchmark_id }))); } catch (error) { next(error); }
  });
  router.post('/durable-release/validate', async (req, res, next) => {
    try { res.json(success(await inspectStage8DurableRelease({ repoRoot, request: req.body }))); } catch (error) { next(error); }
  });
  router.get('/operations', async (_req, res, next) => {
    try { res.json(success(await getStage8Operations({ repoRoot }))); } catch (error) { next(error); }
  });
  return router;
}

export const stage8BlindReviewRouter = createStage8BlindReviewRouter();
