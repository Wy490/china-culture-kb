import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Router } from 'express';
import { success } from '@shared/types.js';
import {
  getStage7GoldenCardReviewWorkspace,
  inspectStage7GoldenCardReview,
} from '../services/stage7-golden-card-review-service.js';
import {
  getStage7GoldenCardCandidateWorkspace,
  inspectStage7GoldenCardCandidate,
} from '../services/stage7-golden-card-candidate-service.js';
import {
  getStage7GoldenCardReviewSignatureWorkspace,
  inspectStage7GoldenCardReviewSignature,
} from '../services/stage7-golden-card-review-signature-service.js';
import { getStage7MaterialOperations } from '../services/stage7-material-operations-service.js';

function resolveDefaultRepoRoot(): string {
  const candidates = [
    process.cwd(),
    resolve(process.cwd(), '..', '..'),
    resolve(import.meta.dirname, '..', '..', '..', '..'),
  ];
  return candidates.find(candidate => existsSync(resolve(candidate, 'data/production-cards/golden-card-unified-index.json')))
    ?? candidates[0];
}

export function createStage7GoldenCardsRouter(repoRoot = resolveDefaultRepoRoot()): Router {
  const router = Router();
  router.get('/review-intake', async (req, res, next) => {
    try {
      res.json(success(await getStage7GoldenCardReviewWorkspace({ repoRoot, cardId: req.query.card_id })));
    } catch (error) {
      next(error);
    }
  });
  router.post('/review-intake/validate', async (req, res, next) => {
    try {
      res.json(success(await inspectStage7GoldenCardReview({ repoRoot, request: req.body })));
    } catch (error) {
      next(error);
    }
  });
  router.get('/candidate-expansion', async (req, res, next) => {
    try {
      res.json(success(await getStage7GoldenCardCandidateWorkspace({ repoRoot, slotId: req.query.slot_id })));
    } catch (error) {
      next(error);
    }
  });
  router.post('/candidate-expansion/validate', async (req, res, next) => {
    try {
      res.json(success(await inspectStage7GoldenCardCandidate({ repoRoot, request: req.body })));
    } catch (error) {
      next(error);
    }
  });
  router.get('/review-signature', async (req, res, next) => {
    try {
      res.json(success(await getStage7GoldenCardReviewSignatureWorkspace({ repoRoot, cardId: req.query.card_id })));
    } catch (error) {
      next(error);
    }
  });
  router.post('/review-signature/validate', async (req, res, next) => {
    try {
      res.json(success(await inspectStage7GoldenCardReviewSignature({ repoRoot, request: req.body })));
    } catch (error) {
      next(error);
    }
  });
  router.get('/operations', async (_req, res, next) => {
    try {
      res.json(success(await getStage7MaterialOperations({ repoRoot })));
    } catch (error) {
      next(error);
    }
  });
  return router;
}

export const stage7GoldenCardsRouter = createStage7GoldenCardsRouter();
