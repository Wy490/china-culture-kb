import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { Router } from 'express';
import { ErrorCodes, fail, success } from '@shared/types.js';
import {
  Stage6FeedbackDraftCreateRequestSchema,
  Stage6FeedbackReviewUpdateRequestSchema,
} from '@shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { requireProductAccess } from '../middleware/product-access.js';
import {
  getStage6RevisionWorkspaceDetail,
  getStage6RevisionWorkspacePortfolio,
  createStage6FeedbackDraft,
  updateStage6FeedbackReview,
} from '../services/stage6-revision-workspace-service.js';
import { buildStage6RealRevisionExitAudit } from '../services/stage6-real-revision-exit-audit-service.js';
import {
  getStage6OperatorIntakeWorkspace,
  validateStage6OperatorIntake,
} from '../services/stage6-operator-intake-service.js';
import {
  getStage6OperatorRevisionPreflightWorkspace,
  preflightStage6OperatorRevision,
} from '../services/stage6-operator-revision-preflight-service.js';
import {
  getStage6ProfessionalPackageInspectorWorkspace,
  inspectStage6ProfessionalPackage,
} from '../services/stage6-professional-package-inspector-service.js';
import { getStage6OperatorControlTower } from '../services/stage6-operator-control-tower-service.js';
import {
  getStage6TableReadEvidenceInspectorWorkspace,
  inspectStage6TableReadEvidence,
} from '../services/stage6-table-read-evidence-inspector-service.js';
import {
  getStage6ExitReviewSignatureInspectorWorkspace,
  inspectStage6ExitReviewSignature,
} from '../services/stage6-exit-review-signature-inspector-service.js';

function resolveDefaultRepoRoot(): string {
  const candidates = [
    process.cwd(),
    resolve(process.cwd(), '..', '..'),
    resolve(import.meta.dirname, '..', '..', '..', '..'),
  ];
  return candidates.find(candidate => existsSync(pathForRegistry(candidate))) ?? candidates[0];
}

function pathForRegistry(repoRoot: string): string {
  return resolve(repoRoot, 'data/professional-benchmarks/all-format-stage6-iteration1-multi-round-revision-specs.json');
}

function paramString(value: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? '' : value;
}

export function createStage6RevisionsRouter(repoRoot = resolveDefaultRepoRoot()): Router {
  const router = Router();
  const internalTool = { feature_flag: 'internal_story_tools' } as const;

  router.get('/', requireProductAccess('production:read'), async (_req, res, next) => {
    try {
      res.json(success(await getStage6RevisionWorkspacePortfolio({ repoRoot })));
    } catch (error) {
      next(error);
    }
  });

  router.get('/exit-audit', requireProductAccess('production:operate', internalTool), async (_req, res, next) => {
    try {
      res.json(success(await buildStage6RealRevisionExitAudit({ repoRoot })));
    } catch (error) {
      next(error);
    }
  });

  router.get('/intake', requireProductAccess('production:operate', internalTool), async (_req, res, next) => {
    try {
      res.json(success(await getStage6OperatorIntakeWorkspace({ repoRoot })));
    } catch (error) {
      next(error);
    }
  });

  router.post('/intake/validate', requireProductAccess('production:operate', internalTool), async (req, res, next) => {
    try {
      res.json(success(await validateStage6OperatorIntake({ repoRoot, intake: req.body })));
    } catch (error) {
      next(error);
    }
  });

  router.get('/preflight', requireProductAccess('production:operate', internalTool), async (_req, res, next) => {
    try {
      res.json(success(await getStage6OperatorRevisionPreflightWorkspace({ repoRoot })));
    } catch (error) {
      next(error);
    }
  });

  router.post('/preflight/validate', requireProductAccess('production:operate', internalTool), async (req, res, next) => {
    try {
      res.json(success(await preflightStage6OperatorRevision({ repoRoot, command: req.body })));
    } catch (error) {
      next(error);
    }
  });

  router.get('/package-inspector', requireProductAccess('production:operate', internalTool), async (req, res, next) => {
    try {
      res.json(success(getStage6ProfessionalPackageInspectorWorkspace({
        videoType: req.query.video_type,
      })));
    } catch (error) {
      next(error);
    }
  });

  router.post('/package-inspector/validate', requireProductAccess('production:operate', internalTool), async (req, res, next) => {
    try {
      res.json(success(inspectStage6ProfessionalPackage({ request: req.body })));
    } catch (error) {
      next(error);
    }
  });

  router.get('/operations', requireProductAccess('production:operate', internalTool), async (_req, res, next) => {
    try {
      res.json(success(await getStage6OperatorControlTower({ repoRoot })));
    } catch (error) {
      next(error);
    }
  });

  router.get('/table-read-inspector', requireProductAccess('production:operate', internalTool), async (req, res, next) => {
    try {
      res.json(success(await getStage6TableReadEvidenceInspectorWorkspace({
        repoRoot,
        benchmarkId: req.query.benchmark_id,
        roundNumber: req.query.round_number,
      })));
    } catch (error) {
      next(error);
    }
  });

  router.post('/table-read-inspector/validate', requireProductAccess('production:operate', internalTool), async (req, res, next) => {
    try {
      res.json(success(await inspectStage6TableReadEvidence({ repoRoot, request: req.body })));
    } catch (error) {
      next(error);
    }
  });

  router.get('/exit-review-signature', requireProductAccess('production:operate', internalTool), async (req, res, next) => {
    try {
      res.json(success(await getStage6ExitReviewSignatureInspectorWorkspace({
        repoRoot,
        benchmarkId: req.query.benchmark_id,
      })));
    } catch (error) {
      next(error);
    }
  });

  router.post('/exit-review-signature/validate', requireProductAccess('production:operate', internalTool), async (req, res, next) => {
    try {
      res.json(success(await inspectStage6ExitReviewSignature({ repoRoot, request: req.body })));
    } catch (error) {
      next(error);
    }
  });

  router.get('/:benchmarkId', requireProductAccess('production:read'), async (req, res, next) => {
    try {
      res.json(success(await getStage6RevisionWorkspaceDetail({
        repoRoot,
        benchmarkId: paramString(req.params.benchmarkId),
      })));
    } catch (error) {
      if ((error as Error).message === 'stage6_workspace_project_not_found') {
        res.status(404).json(fail(ErrorCodes.VALIDATION_ERROR, 'Stage 6 revision project not found'));
        return;
      }
      next(error);
    }
  });

  router.patch(
    '/:benchmarkId/rounds/:roundNumber/feedback/:feedbackId',
    requireProductAccess('production:write'),
    validateBody(Stage6FeedbackReviewUpdateRequestSchema),
    async (req, res, next) => {
      const roundNumber = Number(paramString(req.params.roundNumber));
      if (roundNumber !== 1 && roundNumber !== 2) {
        res.status(400).json(fail(ErrorCodes.VALIDATION_ERROR, 'roundNumber must be 1 or 2'));
        return;
      }
      try {
        res.json(success(await updateStage6FeedbackReview({
          repoRoot,
          benchmarkId: paramString(req.params.benchmarkId),
          roundNumber,
          feedbackId: paramString(req.params.feedbackId),
          request: req.body,
        })));
      } catch (error) {
        const message = (error as Error).message;
        if (message === 'stage6_feedback_state_revision_conflict') {
          res.status(409).json(fail(ErrorCodes.VALIDATION_ERROR, message));
          return;
        }
        if (message === 'stage6_feedback_not_found' || message === 'stage6_feedback_project_has_no_revision_ledger') {
          res.status(404).json(fail(ErrorCodes.VALIDATION_ERROR, message));
          return;
        }
        if (message === 'stage6_feedback_assignee_not_verified_reviewer' || message === 'stage6_feedback_resolution_required') {
          res.status(400).json(fail(ErrorCodes.VALIDATION_ERROR, message));
          return;
        }
        next(error);
      }
    },
  );

  router.post(
    '/:benchmarkId/feedback-drafts',
    requireProductAccess('production:write'),
    validateBody(Stage6FeedbackDraftCreateRequestSchema),
    async (req, res, next) => {
      try {
        res.json(success(await createStage6FeedbackDraft({
          repoRoot,
          benchmarkId: paramString(req.params.benchmarkId),
          request: req.body,
        })));
      } catch (error) {
        if ((error as Error).message === 'stage6_feedback_draft_reviewer_not_verified') {
          res.status(400).json(fail(ErrorCodes.VALIDATION_ERROR, (error as Error).message));
          return;
        }
        next(error);
      }
    },
  );

  return router;
}

export const stage6RevisionsRouter = createStage6RevisionsRouter();
