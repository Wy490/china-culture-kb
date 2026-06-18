import { Router } from 'express';
import type { Request } from 'express';
import { validateBody, validateParams } from '../middleware/validate.js';
import { fail, ErrorCodes } from '@shared/types.js';
import {
  KnowledgeSupplementTaskUpdateRequestSchema,
  ProjectBatchDeleteRequestSchema,
  ProjectIdParamSchema,
  ProjectRetainRecentRequestSchema,
  SeedanceAssetBatchImportRequestSchema,
  SeedanceAssetLibraryUpdateRequestSchema,
  SeedanceAssetReuseRequestSchema,
  SeedanceShotAutoSelectRequestSchema,
  SeedanceShotCallbackImportRequestSchema,
  SeedanceShotProviderCallbackRequestSchema,
  SeedanceShotProviderPollRequestSchema,
  SeedanceShotProviderRecoveryRequestSchema,
  SeedanceShotProviderSubmitRequestSchema,
  SeedanceShotStatusBatchUpdateRequestSchema,
  SeedanceShotStatusUpdateRequestSchema,
  SeedanceShotVersionSelectRequestSchema,
  StoryProductionBoardRepairRequestSchema,
  StoryQualityRepairRequestSchema,
  StorySceneRegenerateRequestSchema,
  SupplementTaskIdParamSchema,
} from '@shared/schemas.js';
import {
  deleteProject,
  deleteProjects,
  autoSelectProjectSeedanceShotVersions,
  exportProjectCurrentVersion,
  exportProjectProductionBoard,
  exportProjectSeedanceRetryPackage,
  getProject,
  getProjectProductionBoard,
  listProjectSeedanceGlobalAssetLibrary,
  importProjectSeedanceAssetBatch,
  importProjectSeedanceProviderCallback,
  importProjectSeedanceShotCallbacks,
  listProjectSupplementTasks,
  listProjects,
  pollProjectSeedanceProviderQueue,
  recoverProjectSeedanceProviderQueue,
  repairAndExportProjectProductionBoard,
  repairProjectQuality,
  repairProjectProductionBoard,
  regenerateProjectScene,
  reuseProjectSeedanceAsset,
  retainRecentProjects,
  selectProjectSeedanceShotVersion,
  submitProjectSeedanceShotsToProvider,
  uploadProjectSeedanceAssetFile,
  updateProjectSeedanceAssetLibrary,
  updateProjectSeedanceShotStatus,
  updateProjectSeedanceShotStatuses,
  updateProjectSupplementTask,
} from '../services/project-service.js';

export const projectsRouter = Router();

const SEEDANCE_ASSET_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

type MultipartFile = {
  field_name: string;
  filename: string;
  mime_type: string;
  buffer: Buffer;
};

async function readRequestBody(req: Request, maxBytes: number): Promise<Buffer> {
  return await new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error(`request body exceeds ${maxBytes} bytes`));
        req.destroy();
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on('end', () => resolvePromise(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function multipartBoundary(contentType: string | undefined): string | undefined {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? '');
  return (match?.[1] ?? match?.[2])?.trim();
}

function multipartDispositionValue(disposition: string, key: string): string | undefined {
  const match = new RegExp(`${key}="([^"]*)"`).exec(disposition);
  return match?.[1];
}

async function parseSeedanceAssetUpload(req: Request): Promise<{ fields: Record<string, string>; file?: MultipartFile }> {
  const boundary = multipartBoundary(req.headers['content-type']);
  if (!boundary) {
    throw new Error('multipart/form-data boundary is required');
  }
  const body = await readRequestBody(req, SEEDANCE_ASSET_UPLOAD_MAX_BYTES);
  const raw = body.toString('latin1');
  const parts = raw.split(`--${boundary}`).slice(1, -1);
  const fields: Record<string, string> = {};
  let file: MultipartFile | undefined;

  for (const part of parts) {
    const normalized = part.replace(/^\r\n/, '').replace(/\r\n$/, '');
    const headerEnd = normalized.indexOf('\r\n\r\n');
    if (headerEnd < 0) continue;
    const headerText = normalized.slice(0, headerEnd);
    const content = normalized.slice(headerEnd + 4);
    const headers = Object.fromEntries(headerText.split('\r\n').map((line) => {
      const [name, ...rest] = line.split(':');
      return [name.trim().toLowerCase(), rest.join(':').trim()];
    }));
    const disposition = headers['content-disposition'] ?? '';
    const fieldName = multipartDispositionValue(disposition, 'name');
    if (!fieldName) continue;
    const filename = multipartDispositionValue(disposition, 'filename');
    const contentBuffer = Buffer.from(content, 'latin1');
    if (filename !== undefined) {
      file = {
        field_name: fieldName,
        filename: filename.split(/[\\/]/).pop() || 'seedance-asset.bin',
        mime_type: headers['content-type'] || 'application/octet-stream',
        buffer: contentBuffer,
      };
    } else {
      fields[fieldName] = contentBuffer.toString('utf8').trim();
    }
  }

  return { fields, file };
}

projectsRouter.get('/', async (_req, res, next) => {
  try {
    const result = await listProjects();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/supplement-tasks', async (req, res, next) => {
  try {
    const status = req.query.status === 'open' || req.query.status === 'resolved'
      ? req.query.status
      : undefined;
    const result = await listProjectSupplementTasks(status);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/batch-delete', validateBody(ProjectBatchDeleteRequestSchema), async (req, res, next) => {
  try {
    const result = await deleteProjects(req.body.project_ids);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/retain-recent', validateBody(ProjectRetainRecentRequestSchema), async (req, res, next) => {
  try {
    const result = await retainRecentProjects(req.body.keep_recent);
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

projectsRouter.post('/:projectId/export', validateParams(ProjectIdParamSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params as { projectId: string };
    const result = await exportProjectCurrentVersion(projectId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/:projectId/production-board', validateParams(ProjectIdParamSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params as { projectId: string };
    const result = await getProjectProductionBoard(projectId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/:projectId/production-board/export', validateParams(ProjectIdParamSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params as { projectId: string };
    const result = await exportProjectProductionBoard(projectId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

projectsRouter.post(
  '/:projectId/production-board/seedance-assets',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceAssetLibraryUpdateRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await updateProjectSeedanceAssetLibrary(projectId, req.body);
      res.status(result.ok ? 200 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.get(
  '/:projectId/production-board/seedance-assets/global',
  validateParams(ProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await listProjectSeedanceGlobalAssetLibrary(projectId);
      res.status(result.ok ? 200 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-assets/import',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceAssetBatchImportRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await importProjectSeedanceAssetBatch(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-assets/reuse',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceAssetReuseRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await reuseProjectSeedanceAsset(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-assets/upload',
  validateParams(ProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      let parsed: Awaited<ReturnType<typeof parseSeedanceAssetUpload>>;
      try {
        parsed = await parseSeedanceAssetUpload(req);
      } catch (err: any) {
        res.status(400).json(fail(ErrorCodes.VALIDATION_ERROR, err.message ?? 'Invalid Seedance asset upload'));
        return;
      }
      if (!parsed.file) {
        res.status(400).json(fail(ErrorCodes.VALIDATION_ERROR, 'Seedance asset upload requires a file field'));
        return;
      }
      const kind = parsed.fields.kind;
      const modality = parsed.fields.modality;
      const role = parsed.fields.role;
      const result = await uploadProjectSeedanceAssetFile(projectId, {
        asset_id: parsed.fields.asset_id,
        label: parsed.fields.label,
        kind: ['character', 'location', 'prop', 'camera', 'audio'].includes(kind) ? kind as any : undefined,
        modality: ['image', 'video', 'audio'].includes(modality) ? modality as any : undefined,
        role: [
          'character_reference',
          'location_reference',
          'prop_reference',
          'camera_reference',
          'music_reference',
          'sound_reference',
        ].includes(role) ? role as any : undefined,
        reference_slot: parsed.fields.reference_slot,
        description: parsed.fields.description,
        file: {
          original_filename: parsed.file.filename,
          mime_type: parsed.file.mime_type,
          buffer: parsed.file.buffer,
        },
      });
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotStatusUpdateRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await updateProjectSeedanceShotStatus(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/batch',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotStatusBatchUpdateRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await updateProjectSeedanceShotStatuses(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/submit-provider',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotProviderSubmitRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await submitProjectSeedanceShotsToProvider(projectId, req.body);
      res.status(
        result.ok
          ? 200
          : result.error?.code === ErrorCodes.VALIDATION_ERROR
            ? 400
            : result.error?.code === ErrorCodes.INTERNAL_ERROR
              ? 502
              : 404,
      ).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/recover-provider',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotProviderRecoveryRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await recoverProjectSeedanceProviderQueue(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/poll-provider',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotProviderPollRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await pollProjectSeedanceProviderQueue(projectId, req.body);
      res.status(
        result.ok
          ? 200
          : result.error?.code === ErrorCodes.VALIDATION_ERROR
            ? 400
            : result.error?.code === ErrorCodes.INTERNAL_ERROR
              ? 502
              : 404,
      ).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/import',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotCallbackImportRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await importProjectSeedanceShotCallbacks(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/provider-callback',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotProviderCallbackRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await importProjectSeedanceProviderCallback(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/select-version',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotVersionSelectRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await selectProjectSeedanceShotVersion(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/seedance-shots/auto-select',
  validateParams(ProjectIdParamSchema),
  validateBody(SeedanceShotAutoSelectRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await autoSelectProjectSeedanceShotVersions(projectId, req.body);
      res.status(result.ok ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/export-seedance-retry-package',
  validateParams(ProjectIdParamSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await exportProjectSeedanceRetryPackage(projectId);
      res.status(result.ok ? 200 : 404).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/repair',
  validateParams(ProjectIdParamSchema),
  validateBody(StoryProductionBoardRepairRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await repairProjectProductionBoard(projectId, req.body);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/production-board/repair-export',
  validateParams(ProjectIdParamSchema),
  validateBody(StoryProductionBoardRepairRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await repairAndExportProjectProductionBoard(projectId, req.body);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

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

projectsRouter.post(
  '/:projectId/repair-quality',
  validateParams(ProjectIdParamSchema),
  validateBody(StoryQualityRepairRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params as { projectId: string };
      const result = await repairProjectQuality(projectId, req.body);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.patch(
  '/:projectId/supplement-tasks/:taskId',
  validateParams(SupplementTaskIdParamSchema),
  validateBody(KnowledgeSupplementTaskUpdateRequestSchema),
  async (req, res, next) => {
    try {
      const { projectId, taskId } = req.params as { projectId: string; taskId: string };
      const result = await updateProjectSupplementTask(projectId, taskId, req.body);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      next(err);
    }
  },
);
