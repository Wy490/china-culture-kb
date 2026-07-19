import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { storyGeneratedRoot } from '../platform/story-storage-root.js';
import { buildStoryProductionBoard } from './production-board-service.js';
import { getProject } from './project-service.js';

export interface MediaAssetPreviewFile {
  buffer: Buffer;
  mime_type: string;
  byte_size: number;
  content_sha256: string;
  filename: string;
}

export type MediaAssetPreviewResult =
  | { ok: true; data: MediaAssetPreviewFile }
  | { ok: false; status: 400 | 404 | 409; message: string };

const PREVIEW_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'video/mp4',
  'audio/mpeg',
  'audio/wav',
]);

export async function readProjectMediaAssetPreview(
  projectId: string,
  artifactId: string,
): Promise<MediaAssetPreviewResult> {
  const detail = await getProject(projectId);
  if (!detail.ok || !detail.data) return { ok: false, status: 404, message: 'project not found' };
  const board = buildStoryProductionBoard(detail.data.current_story, {
    seedanceAssetLibrary: detail.data.project.seedance_asset_library,
    seedanceShotLedger: detail.data.project.seedance_shot_ledger,
    sourceVersionId: detail.data.project.current_version_id,
  });
  const artifact = board.media_asset_library.artifacts.find(item => item.artifact_id === artifactId);
  if (!artifact) return { ok: false, status: 404, message: 'media artifact not found' };
  if (artifact.integrity_status !== 'verified' || !artifact.content_sha256) {
    return { ok: false, status: 409, message: 'media artifact integrity is not verified' };
  }
  if (artifact.storage.kind !== 'local_immutable' || !artifact.storage.local_path) {
    return { ok: false, status: 409, message: 'media artifact is not available from authenticated local preview' };
  }
  if (!artifact.mime_type || !PREVIEW_MIME_TYPES.has(artifact.mime_type)) {
    return { ok: false, status: 409, message: 'media artifact MIME is not previewable' };
  }

  const generatedRoot = resolve(storyGeneratedRoot());
  const target = resolve(generatedRoot, artifact.storage.local_path);
  const relation = relative(generatedRoot, target);
  const expectedPrefix = `projects/${projectId}/media/originals/`;
  if (isAbsolute(relation) || relation.startsWith('..') || !artifact.storage.local_path.startsWith(expectedPrefix)) {
    return { ok: false, status: 400, message: 'media artifact path is outside the project immutable store' };
  }
  let fileStat;
  try {
    fileStat = await lstat(target);
  } catch {
    return { ok: false, status: 404, message: 'media artifact file not found' };
  }
  if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
    return { ok: false, status: 400, message: 'media artifact target is not a regular file' };
  }
  const buffer = await readFile(target);
  const digest = createHash('sha256').update(buffer).digest('hex');
  if (digest !== artifact.content_sha256 || buffer.length !== artifact.size_bytes) {
    return { ok: false, status: 409, message: 'media artifact integrity changed after ingest' };
  }
  return {
    ok: true,
    data: {
      buffer,
      mime_type: artifact.mime_type,
      byte_size: buffer.length,
      content_sha256: digest,
      filename: basename(target),
    },
  };
}
