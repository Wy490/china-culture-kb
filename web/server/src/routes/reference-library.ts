import { existsSync } from 'node:fs';
import path from 'node:path';
import { Router, type Request } from 'express';
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
import {
  createReferenceTextMaterial,
  getReferenceTextMaterial,
  getReferenceTextMaterialChunk,
  getReferenceTextMaterialManifest,
  getReferenceTextMaterialStatus,
} from '../services/reference-text-material-service.js';
import {
  createReferencePrivateVideoSample,
  getReferencePrivateVideoSample,
  submitReferencePrivateVideoTranscript,
  type PrivateVideoCommandRunner,
} from '../services/reference-private-video-sample-service.js';
import {
  createReferenceTextAnalysisExecution,
  finalizeReferenceTextAnalysisExecution,
  getReferenceTextAnalysisExecution,
  getReferenceTextAnalysisNextChunk,
  submitReferenceTextAnalysisChunk,
} from '../services/reference-text-analysis-execution-service.js';
import {
  createReferenceTextAnalysisDraftTask,
  getReferenceTextAnalysisSupplement,
  getReferenceTextAnalysisDraftTask,
  requestReferenceTextAnalysisSupplement,
  submitReferenceTextAnalysisDraft,
  submitReferenceTextAnalysisSupplement,
} from '../services/reference-text-analysis-draft-task-service.js';

function resolveDefaultRepoRoot(): string {
  const configuredRoot = process.env.REFERENCE_LIBRARY_REPO_ROOT?.trim();
  if (configuredRoot) return path.resolve(configuredRoot);
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

function requiredActorMatchesClaims(req: Request, claims: unknown[]): boolean {
  const access = getProductAccessContext(req);
  return access.mode !== 'required'
    || Boolean(
      access.actor
      && claims.every(claim => claim === access.actor?.actor_id),
    );
}

export function createReferenceLibraryRouter(
  repoRoot = resolveDefaultRepoRoot(),
  options: {
    privateVideoCommandRunner?: PrivateVideoCommandRunner;
  } = {},
): Router {
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

  router.post(
    '/private-video-samples',
    requireProductAccess('material:sign'),
    async (req, res, next) => {
      try {
        if (
          !requiredActorMatchesClaims(
            req,
            [req.body?.authorization?.attested_by],
          )
        ) {
          res.status(403).json(fail(
            ErrorCodes.ACCESS_FORBIDDEN,
            'Private video attested_by must match the authenticated material reviewer',
          ));
          return;
        }
        const result = await createReferencePrivateVideoSample({
          repoRoot,
          request: req.body,
          runner: options.privateVideoCommandRunner,
        });
        res.status(result.idempotent_replay ? 200 : 201).json(success(result));
      } catch (error) {
        next(error);
      }
    },
  );

  router.get('/private-video-samples/:sampleId', async (req, res, next) => {
    try {
      res.json(success(await getReferencePrivateVideoSample({
        repoRoot,
        sampleId: String(req.params.sampleId),
      })));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/private-video-samples/:sampleId/transcript',
    requireProductAccess('material:sign'),
    async (req, res, next) => {
      try {
        if (!requiredActorMatchesClaims(req, [req.body?.transcribed_by])) {
          res.status(403).json(fail(
            ErrorCodes.ACCESS_FORBIDDEN,
            'Private video transcript transcribed_by must match the authenticated material reviewer',
          ));
          return;
        }
        const result = await submitReferencePrivateVideoTranscript({
          repoRoot,
          sampleId: String(req.params.sampleId),
          request: req.body,
        });
        res.status(result.idempotent_replay ? 200 : 201).json(success(result));
      } catch (error) {
        next(error);
      }
    },
  );

  router.get('/benchmark-cards', async (_req, res, next) => {
    try {
      res.json(success(await listBenchmarkCards({ repoRoot })));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/benchmark-cards',
    requireProductAccess('material:sign'),
    async (req, res, next) => {
      try {
        if (!requiredActorMatchesClaims(req, [
          req.body?.created_by,
          req.body?.approval?.approved_by,
        ])) {
          res.status(403).json(fail(
            ErrorCodes.ACCESS_FORBIDDEN,
            'Benchmark created_by and approved_by must match the authenticated material signer',
          ));
          return;
        }
        const record = await createBenchmarkCard({ repoRoot, request: req.body });
        res.status(201).json(success(record));
      } catch (error) {
        next(error);
      }
    },
  );

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

  router.post(
    '/style-packs',
    requireProductAccess('material:sign'),
    async (req, res, next) => {
      try {
        if (!requiredActorMatchesClaims(req, [
          req.body?.created_by,
          req.body?.approval?.approved_by,
        ])) {
          res.status(403).json(fail(
            ErrorCodes.ACCESS_FORBIDDEN,
            'Style pack created_by and approved_by must match the authenticated material signer',
          ));
          return;
        }
        const record = await createReferenceStylePack({ repoRoot, request: req.body });
        res.status(201).json(success(record));
      } catch (error) {
        next(error);
      }
    },
  );

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
        if (
          !requiredActorMatchesClaims(req, [req.body?.approved_by])
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

  router.post('/analysis-tasks/:taskId/text-execution', async (req, res, next) => {
    try {
      if (
        !requiredActorMatchesClaims(req, [req.body?.executor?.executor_id])
      ) {
        res.status(403).json(fail(
          ErrorCodes.ACCESS_FORBIDDEN,
          'Text execution executor_id must match the authenticated material reviewer',
        ));
        return;
      }
      const result = await createReferenceTextAnalysisExecution({
        repoRoot,
        taskId: String(req.params.taskId),
        request: req.body,
      });
      res.status(result.idempotent_replay ? 200 : 201).json(
        success(result.execution),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get('/analysis-tasks/:taskId/text-execution', async (req, res, next) => {
    try {
      res.json(success(await getReferenceTextAnalysisExecution({
        repoRoot,
        taskId: String(req.params.taskId),
      })));
    } catch (error) {
      next(error);
    }
  });

  router.get(
    '/analysis-tasks/:taskId/text-execution/next-chunk',
    async (req, res, next) => {
      try {
        res.json(success(await getReferenceTextAnalysisNextChunk({
          repoRoot,
          taskId: String(req.params.taskId),
        })));
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/analysis-tasks/:taskId/text-execution/chunks/:chunkId/submissions',
    async (req, res, next) => {
      try {
        if (!requiredActorMatchesClaims(req, [req.body?.submitted_by])) {
          res.status(403).json(fail(
            ErrorCodes.ACCESS_FORBIDDEN,
            'Chunk submitted_by must match the authenticated material reviewer',
          ));
          return;
        }
        const result = await submitReferenceTextAnalysisChunk({
          repoRoot,
          taskId: String(req.params.taskId),
          chunkId: String(req.params.chunkId),
          request: req.body,
        });
        res.status(result.idempotent_replay ? 200 : 201).json(success(result));
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/analysis-tasks/:taskId/text-execution/finalize',
    async (req, res, next) => {
      try {
        if (!requiredActorMatchesClaims(req, [req.body?.finalized_by])) {
          res.status(403).json(fail(
            ErrorCodes.ACCESS_FORBIDDEN,
            'Text execution finalized_by must match the authenticated material reviewer',
          ));
          return;
        }
        const result = await finalizeReferenceTextAnalysisExecution({
          repoRoot,
          taskId: String(req.params.taskId),
          request: req.body,
        });
        res.status(result.idempotent_replay ? 200 : 201).json(success(result));
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/analysis-tasks/:taskId/text-analysis-draft-task',
    async (req, res, next) => {
      try {
        if (
          !requiredActorMatchesClaims(req, [req.body?.executor?.executor_id])
        ) {
          res.status(403).json(fail(
            ErrorCodes.ACCESS_FORBIDDEN,
            'Text analysis draft executor_id must match the authenticated material reviewer',
          ));
          return;
        }
        const result = await createReferenceTextAnalysisDraftTask({
          repoRoot,
          taskId: String(req.params.taskId),
          request: req.body,
        });
        res.status(result.idempotent_replay ? 200 : 201).json(
          success(result.draftTask),
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/analysis-tasks/:taskId/text-analysis-draft-task',
    async (req, res, next) => {
      try {
        res.json(success(await getReferenceTextAnalysisDraftTask({
          repoRoot,
          taskId: String(req.params.taskId),
        })));
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/analysis-tasks/:taskId/text-analysis-draft-task/supplement-request',
    async (req, res, next) => {
      try {
        if (!requiredActorMatchesClaims(req, [req.body?.requested_by])) {
          res.status(403).json(fail(
            ErrorCodes.ACCESS_FORBIDDEN,
            'Supplement requested_by must match the authenticated material reviewer',
          ));
          return;
        }
        const result = await requestReferenceTextAnalysisSupplement({
          repoRoot,
          taskId: String(req.params.taskId),
          request: req.body,
        });
        res.status(result.idempotent_replay ? 200 : 201).json(
          success(result.draftTask),
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/analysis-tasks/:taskId/text-analysis-draft-task/supplement-submissions',
    async (req, res, next) => {
      try {
        if (!requiredActorMatchesClaims(req, [req.body?.submitted_by])) {
          res.status(403).json(fail(
            ErrorCodes.ACCESS_FORBIDDEN,
            'Supplement submitted_by must match the authenticated material reviewer',
          ));
          return;
        }
        const result = await submitReferenceTextAnalysisSupplement({
          repoRoot,
          taskId: String(req.params.taskId),
          request: req.body,
        });
        res.status(result.idempotent_replay ? 200 : 201).json(success(result));
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/analysis-tasks/:taskId/text-analysis-draft-task/supplement',
    async (req, res, next) => {
      try {
        res.json(success(await getReferenceTextAnalysisSupplement({
          repoRoot,
          taskId: String(req.params.taskId),
        })));
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/analysis-tasks/:taskId/text-analysis-draft-task/submissions',
    async (req, res, next) => {
      try {
        if (!requiredActorMatchesClaims(req, [req.body?.submitted_by])) {
          res.status(403).json(fail(
            ErrorCodes.ACCESS_FORBIDDEN,
            'Text analysis draft submitted_by must match the authenticated material reviewer',
          ));
          return;
        }
        const result = await submitReferenceTextAnalysisDraft({
          repoRoot,
          taskId: String(req.params.taskId),
          request: req.body,
        });
        res.status(result.idempotent_replay ? 200 : 201).json(success(result));
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/references/:referenceId/text-material',
    requireProductAccess('material:sign'),
    async (req, res, next) => {
      try {
        if (
          !requiredActorMatchesClaims(
            req,
            [req.body?.authorization?.attested_by],
          )
        ) {
          res.status(403).json(fail(
            ErrorCodes.ACCESS_FORBIDDEN,
            'Text material attested_by must match the authenticated material reviewer',
          ));
          return;
        }
        const result = await createReferenceTextMaterial({
          repoRoot,
          referenceId: String(req.params.referenceId),
          request: req.body,
        });
        res.status(result.idempotent_replay ? 200 : 201).json(success(result));
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/references/:referenceId/text-material/status',
    async (req, res, next) => {
      try {
        res.json(success(await getReferenceTextMaterialStatus({
          repoRoot,
          referenceId: String(req.params.referenceId),
        })));
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/references/:referenceId/text-material',
    async (req, res, next) => {
      try {
        res.json(success(await getReferenceTextMaterial({
          repoRoot,
          referenceId: String(req.params.referenceId),
        })));
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/references/:referenceId/text-material/manifest',
    async (req, res, next) => {
      try {
        res.json(success(await getReferenceTextMaterialManifest({
          repoRoot,
          referenceId: String(req.params.referenceId),
        })));
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/references/:referenceId/text-material/chunks/:chunkId',
    async (req, res, next) => {
      try {
        res.json(success(await getReferenceTextMaterialChunk({
          repoRoot,
          referenceId: String(req.params.referenceId),
          chunkId: String(req.params.chunkId),
        })));
      } catch (error) {
        next(error);
      }
    },
  );

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
