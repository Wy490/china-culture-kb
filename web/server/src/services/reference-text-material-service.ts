import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ReferenceTextMaterialChunkSchema,
  ReferenceTextMaterialCreateRequestSchema,
  ReferenceTextMaterialManifestSchema,
  ReferenceTextMaterialRecordSchema,
  ReferenceTextMaterialStatusSchema,
} from '@shared/schemas.js';
import type {
  ReferenceTextMaterialAuthorization,
  ReferenceTextMaterialChunk,
  ReferenceTextMaterialChunkDescriptor,
  ReferenceTextMaterialManifest,
  ReferenceTextMaterialRecord,
  ReferenceTextMaterialStatus,
} from '@shared/types.js';
import { getReferenceSource } from './reference-library-service.js';

const TEXT_MEDIA_TYPES = new Set(['novel', 'screenplay']);
const AUTHORIZED_RIGHTS = new Set(['user_owned', 'licensed', 'public_domain']);
const AUTHORIZED_ACCESS = new Set(['excerpt', 'full_user_supplied']);
const MAX_CONTENT_BYTES = 1_500_000;
const CHUNK_CHARACTER_LIMIT = 12_000 as const;
const CHUNK_ID_PATTERN = /^chunk-\d{4}$/;

class ReferenceTextMaterialError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ReferenceTextMaterialError';
  }
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function materialDirectory(repoRoot: string, referenceId: string): string {
  return path.resolve(
    repoRoot,
    'references/creative/library/text-material',
    referenceId,
  );
}

function recordPath(repoRoot: string, referenceId: string): string {
  return path.join(materialDirectory(repoRoot, referenceId), 'record.json');
}

function contentPath(
  repoRoot: string,
  referenceId: string,
  contentType: ReferenceTextMaterialRecord['content_type'],
): string {
  return path.join(
    materialDirectory(repoRoot, referenceId),
    contentType === 'text/markdown' ? 'content.md' : 'content.txt',
  );
}

async function writeJsonExclusive(
  filePath: string,
  value: unknown,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

function authorizationWithBoundary(
  value: Omit<ReferenceTextMaterialAuthorization, 'machine_verified'>,
): ReferenceTextMaterialAuthorization {
  return {
    ...value,
    machine_verified: false,
  };
}

function materialId(referenceId: string, fingerprint: string): string {
  return `reference-text-material-${
    sha256(`${referenceId}:${fingerprint}`).slice(0, 32)}`;
}

function sameAuthorization(
  left: ReferenceTextMaterialAuthorization,
  right: ReferenceTextMaterialAuthorization,
): boolean {
  return left.basis === right.basis
    && left.authorization_reference === right.authorization_reference
    && left.attested_by === right.attested_by
    && left.attested_at === right.attested_at
    && left.confirmation === right.confirmation;
}

async function readStoredMaterial(input: {
  repoRoot: string;
  referenceId: string;
}): Promise<{
  record: ReferenceTextMaterialRecord;
  content: string;
}> {
  let record: ReferenceTextMaterialRecord;
  try {
    record = ReferenceTextMaterialRecordSchema.parse(
      JSON.parse(await readFile(
        recordPath(input.repoRoot, input.referenceId),
        'utf8',
      )) as unknown,
    ) as ReferenceTextMaterialRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ReferenceTextMaterialError(
        'REFERENCE_TEXT_MATERIAL_NOT_FOUND',
        `Reference text material not found: ${input.referenceId}`,
      );
    }
    throw error;
  }
  let content: string;
  try {
    content = await readFile(
      contentPath(input.repoRoot, input.referenceId, record.content_type),
      'utf8',
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ReferenceTextMaterialError(
        'REFERENCE_TEXT_MATERIAL_INTEGRITY_INVALID',
        `Reference text material content is missing: ${input.referenceId}`,
      );
    }
    throw error;
  }
  const bytes = Buffer.from(content);
  if (
    record.reference_id !== input.referenceId
    || record.content_sha256 !== sha256(bytes)
    || record.source_content_fingerprint !== record.content_sha256
    || record.byte_length !== bytes.length
    || record.character_count !== Array.from(content).length
    || record.line_count !== content.split('\n').length
  ) {
    throw new ReferenceTextMaterialError(
      'REFERENCE_TEXT_MATERIAL_INTEGRITY_INVALID',
      `Reference text material integrity mismatch: ${input.referenceId}`,
    );
  }
  return { record, content };
}

export async function createReferenceTextMaterial(input: {
  repoRoot: string;
  referenceId: string;
  request: unknown;
  now?: string;
}): Promise<{
  material: ReferenceTextMaterialRecord;
  idempotent_replay: boolean;
}> {
  const request = ReferenceTextMaterialCreateRequestSchema.parse(input.request);
  const source = await getReferenceSource({
    repoRoot: input.repoRoot,
    referenceId: input.referenceId,
  });
  if (
    !TEXT_MEDIA_TYPES.has(source.media_type)
    || !AUTHORIZED_RIGHTS.has(source.rights_status)
    || !AUTHORIZED_ACCESS.has(source.access_scope)
    || !source.content_fingerprint
  ) {
    throw new ReferenceTextMaterialError(
      'REFERENCE_TEXT_MATERIAL_SOURCE_INVALID',
      'Text material requires an authorized novel or screenplay source with excerpt or full-user-supplied access and an exact fingerprint',
    );
  }
  if (request.authorization.basis !== source.rights_status) {
    throw new ReferenceTextMaterialError(
      'REFERENCE_TEXT_MATERIAL_AUTHORIZATION_INVALID',
      'Text material authorization basis must match the reference source rights status',
    );
  }
  const bytes = Buffer.from(request.content);
  if (bytes.length > MAX_CONTENT_BYTES) {
    throw new ReferenceTextMaterialError(
      'REFERENCE_TEXT_MATERIAL_SIZE_INVALID',
      `Reference text material exceeds ${MAX_CONTENT_BYTES} UTF-8 bytes`,
    );
  }
  const contentSha256 = sha256(bytes);
  if (contentSha256 !== source.content_fingerprint) {
    throw new ReferenceTextMaterialError(
      'REFERENCE_TEXT_MATERIAL_FINGERPRINT_INVALID',
      'Text material exact bytes do not match the immutable reference source fingerprint',
    );
  }
  const authorization = authorizationWithBoundary(request.authorization);
  try {
    const existing = await readStoredMaterial(input);
    if (
      existing.content === request.content
      && existing.record.content_type === request.content_type
      && sameAuthorization(existing.record.authorization, authorization)
    ) {
      return { material: existing.record, idempotent_replay: true };
    }
    throw new ReferenceTextMaterialError(
      'REFERENCE_TEXT_MATERIAL_CONFLICT',
      'Reference text material is already sealed with different metadata',
    );
  } catch (error) {
    if (
      !(error instanceof ReferenceTextMaterialError)
      || error.code !== 'REFERENCE_TEXT_MATERIAL_NOT_FOUND'
    ) {
      throw error;
    }
  }

  const record = ReferenceTextMaterialRecordSchema.parse({
    schema_version: 'reference-text-material/v1',
    material_id: materialId(source.reference_id, contentSha256),
    reference_id: source.reference_id,
    source_content_fingerprint: source.content_fingerprint,
    content_sha256: contentSha256,
    content_type: request.content_type,
    byte_length: bytes.length,
    character_count: Array.from(request.content).length,
    line_count: request.content.split('\n').length,
    authorization,
    created_at: input.now ?? new Date().toISOString(),
    governance: {
      source_material_transport: 'stored_user_supplied',
      server_download_allowed: false,
      prompt_injection_allowed: false,
      knowledge_writeback_allowed: false,
      production_credit_eligible: false,
    },
    human_review_complete: false,
    production_credit_granted: false,
  }) as ReferenceTextMaterialRecord;
  const directory = materialDirectory(input.repoRoot, source.reference_id);
  await mkdir(directory, { recursive: true });
  try {
    await writeFile(
      contentPath(input.repoRoot, source.reference_id, request.content_type),
      bytes,
      { flag: 'wx' },
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const existingBytes = await readFile(
      contentPath(input.repoRoot, source.reference_id, request.content_type),
    );
    if (!existingBytes.equals(bytes)) {
      throw new ReferenceTextMaterialError(
        'REFERENCE_TEXT_MATERIAL_CONFLICT',
        'Reference text material content already exists with different bytes',
      );
    }
  }
  try {
    await writeJsonExclusive(
      recordPath(input.repoRoot, source.reference_id),
      record,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const existing = await readStoredMaterial(input);
    if (
      existing.content !== request.content
      || existing.record.content_type !== request.content_type
      || !sameAuthorization(existing.record.authorization, authorization)
    ) {
      throw new ReferenceTextMaterialError(
        'REFERENCE_TEXT_MATERIAL_CONFLICT',
        'Reference text material was concurrently sealed differently',
      );
    }
    return { material: existing.record, idempotent_replay: true };
  }
  return { material: record, idempotent_replay: false };
}

export async function getReferenceTextMaterial(input: {
  repoRoot: string;
  referenceId: string;
}): Promise<ReferenceTextMaterialRecord> {
  const source = await getReferenceSource(input);
  const stored = await readStoredMaterial(input);
  if (stored.record.source_content_fingerprint !== source.content_fingerprint) {
    throw new ReferenceTextMaterialError(
      'REFERENCE_TEXT_MATERIAL_INTEGRITY_INVALID',
      'Reference source fingerprint has drifted from the sealed text material',
    );
  }
  return stored.record;
}

export async function getReferenceTextMaterialStatus(input: {
  repoRoot: string;
  referenceId: string;
}): Promise<ReferenceTextMaterialStatus> {
  try {
    return ReferenceTextMaterialStatusSchema.parse({
      available: true,
      material: await getReferenceTextMaterial(input),
    }) as ReferenceTextMaterialStatus;
  } catch (error) {
    if (
      error instanceof ReferenceTextMaterialError
      && error.code === 'REFERENCE_TEXT_MATERIAL_NOT_FOUND'
    ) {
      return ReferenceTextMaterialStatusSchema.parse({
        available: false,
        material: null,
      }) as ReferenceTextMaterialStatus;
    }
    throw error;
  }
}

function buildChunks(
  content: string,
): Array<ReferenceTextMaterialChunkDescriptor & { text: string }> {
  const characters = Array.from(content);
  const chunks: Array<ReferenceTextMaterialChunkDescriptor & { text: string }> =
    [];
  for (
    let start = 0, index = 1;
    start < characters.length;
    start += CHUNK_CHARACTER_LIMIT, index += 1
  ) {
    const text = characters
      .slice(start, start + CHUNK_CHARACTER_LIMIT)
      .join('');
    const end = start + Array.from(text).length;
    chunks.push({
      chunk_id: `chunk-${String(index).padStart(4, '0')}`,
      index,
      locator: `characters:${start + 1}-${end}`,
      start_character: start + 1,
      end_character: end,
      character_count: end - start,
      byte_length: Buffer.byteLength(text),
      content_sha256: sha256(text),
      text,
    });
  }
  return chunks;
}

export async function getReferenceTextMaterialManifest(input: {
  repoRoot: string;
  referenceId: string;
}): Promise<ReferenceTextMaterialManifest> {
  await getReferenceTextMaterial(input);
  const { record, content } = await readStoredMaterial(input);
  const chunks = buildChunks(content).map(({ text: _text, ...chunk }) => chunk);
  return ReferenceTextMaterialManifestSchema.parse({
    schema_version: 'reference-text-material-manifest/v1',
    material_id: record.material_id,
    reference_id: record.reference_id,
    source_content_fingerprint: record.source_content_fingerprint,
    content_type: record.content_type,
    byte_length: record.byte_length,
    character_count: record.character_count,
    line_count: record.line_count,
    chunk_character_limit: CHUNK_CHARACTER_LIMIT,
    chunk_count: chunks.length,
    chunks,
    chunk_endpoint_template:
      `/api/reference-library/references/${record.reference_id}`
      + '/text-material/chunks/{chunk_id}',
    content_included: false,
    prompt_injection_allowed: false,
    knowledge_writeback_allowed: false,
    human_review_complete: false,
    production_credit_granted: false,
  }) as ReferenceTextMaterialManifest;
}

export async function getReferenceTextMaterialChunk(input: {
  repoRoot: string;
  referenceId: string;
  chunkId: string;
}): Promise<ReferenceTextMaterialChunk> {
  if (!CHUNK_ID_PATTERN.test(input.chunkId)) {
    throw new ReferenceTextMaterialError(
      'REFERENCE_TEXT_MATERIAL_CHUNK_NOT_FOUND',
      `Reference text material chunk not found: ${input.chunkId}`,
    );
  }
  await getReferenceTextMaterial(input);
  const { record, content } = await readStoredMaterial(input);
  const chunk = buildChunks(content).find(item => item.chunk_id === input.chunkId);
  if (!chunk) {
    throw new ReferenceTextMaterialError(
      'REFERENCE_TEXT_MATERIAL_CHUNK_NOT_FOUND',
      `Reference text material chunk not found: ${input.chunkId}`,
    );
  }
  return ReferenceTextMaterialChunkSchema.parse({
    schema_version: 'reference-text-material-chunk/v1',
    material_id: record.material_id,
    reference_id: record.reference_id,
    source_content_fingerprint: record.source_content_fingerprint,
    ...chunk,
    prompt_injection_allowed: false,
    knowledge_writeback_allowed: false,
    human_review_complete: false,
    production_credit_granted: false,
  }) as ReferenceTextMaterialChunk;
}
