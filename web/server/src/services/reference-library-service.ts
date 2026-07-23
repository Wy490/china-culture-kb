import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';
import {
  FilmReferenceAnalysisCreateRequestSchema,
  ReferenceAnalysisRecordSchema,
  ReferenceSourceCreateRequestSchema,
  ReferenceSourceRecordSchema,
  TextReferenceAnalysisCreateRequestSchema,
} from '@shared/schemas.js';
import type {
  FilmReferenceAnalysisRecord,
  ReferenceAnalysisRecord,
  ReferenceLibraryDetail,
  ReferenceSourceMediaType,
  ReferenceSourceRecord,
  TextReferenceAnalysisRecord,
} from '@shared/types.js';

const REFERENCE_ID_PATTERN = /^reference-[a-f0-9-]+$/;
const FILM_MEDIA_TYPES: ReadonlySet<ReferenceSourceMediaType> = new Set([
  'film',
  'episode',
  'promo',
  'tutorial',
]);
const TEXT_MEDIA_TYPES: ReadonlySet<ReferenceSourceMediaType> = new Set([
  'novel',
  'screenplay',
]);

type FilmAnalysisCreateRequest = z.infer<typeof FilmReferenceAnalysisCreateRequestSchema>;
type TextAnalysisCreateRequest = z.infer<typeof TextReferenceAnalysisCreateRequestSchema>;

class ReferenceLibraryError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ReferenceLibraryError';
    this.code = code;
  }
}

function libraryRoot(repoRoot: string): string {
  return path.resolve(repoRoot, 'references/creative/library');
}

function referencesDirectory(repoRoot: string): string {
  return path.join(libraryRoot(repoRoot), 'references');
}

function analysesDirectory(repoRoot: string): string {
  return path.join(libraryRoot(repoRoot), 'analyses');
}

function validateReferenceId(referenceId: string): string {
  if (!REFERENCE_ID_PATTERN.test(referenceId)) {
    throw new ReferenceLibraryError('REFERENCE_NOT_FOUND', `Reference not found: ${referenceId}`);
  }
  return referenceId;
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  await rename(temporaryPath, filePath);
}

async function readSourceFile(filePath: string): Promise<ReferenceSourceRecord> {
  const raw = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  return ReferenceSourceRecordSchema.parse(raw) as ReferenceSourceRecord;
}

async function readAnalysisFile(filePath: string): Promise<ReferenceAnalysisRecord> {
  const raw = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  return ReferenceAnalysisRecordSchema.parse(raw) as ReferenceAnalysisRecord;
}

async function readJsonFiles<T>(
  directory: string,
  reader: (filePath: string) => Promise<T>,
): Promise<T[]> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return Promise.all(
    names
      .filter(name => name.endsWith('.json'))
      .sort()
      .map(name => reader(path.join(directory, name))),
  );
}

export async function createReferenceSource(input: {
  repoRoot: string;
  request: unknown;
  now?: string;
}): Promise<ReferenceSourceRecord> {
  const request = ReferenceSourceCreateRequestSchema.parse(input.request);
  const now = input.now ?? new Date().toISOString();
  const record = ReferenceSourceRecordSchema.parse({
    schema_version: 'reference-source-record/v1',
    reference_id: `reference-${randomUUID()}`,
    ...request,
    created_at: now,
    updated_at: now,
  }) as ReferenceSourceRecord;

  await atomicWriteJson(
    path.join(referencesDirectory(input.repoRoot), `${record.reference_id}.json`),
    record,
  );
  return record;
}

export async function listReferenceSources(input: {
  repoRoot: string;
}): Promise<ReferenceSourceRecord[]> {
  const records = await readJsonFiles(referencesDirectory(input.repoRoot), readSourceFile);
  return records.sort((left, right) =>
    right.created_at.localeCompare(left.created_at)
    || left.reference_id.localeCompare(right.reference_id));
}

export async function getReferenceSource(input: {
  repoRoot: string;
  referenceId: string;
}): Promise<ReferenceSourceRecord> {
  const referenceId = validateReferenceId(input.referenceId);
  try {
    return await readSourceFile(path.join(referencesDirectory(input.repoRoot), `${referenceId}.json`));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ReferenceLibraryError('REFERENCE_NOT_FOUND', `Reference not found: ${referenceId}`);
    }
    throw error;
  }
}

export async function listReferenceAnalyses(input: {
  repoRoot: string;
  referenceId: string;
}): Promise<ReferenceAnalysisRecord[]> {
  const referenceId = validateReferenceId(input.referenceId);
  const analyses = await readJsonFiles(analysesDirectory(input.repoRoot), readAnalysisFile);
  return analyses
    .filter(analysis => analysis.reference_id === referenceId)
    .sort((left, right) =>
      left.analyzed_at.localeCompare(right.analyzed_at)
      || left.analysis_id.localeCompare(right.analysis_id));
}

export async function getReferenceLibraryDetail(input: {
  repoRoot: string;
  referenceId: string;
}): Promise<ReferenceLibraryDetail> {
  const source = await getReferenceSource(input);
  const analyses = await listReferenceAnalyses(input);
  return { source, analyses };
}

function approvalFromRequest(
  approval: FilmAnalysisCreateRequest['approval'] | TextAnalysisCreateRequest['approval'],
): ReferenceAnalysisRecord['approval'] {
  return approval
    ? {
        status: 'approved',
        approved_by: approval.approved_by,
        approved_at: approval.approved_at,
      }
    : { status: 'pending' };
}

async function persistAnalysis(
  repoRoot: string,
  record: ReferenceAnalysisRecord,
): Promise<ReferenceAnalysisRecord> {
  const parsed = ReferenceAnalysisRecordSchema.parse(record) as ReferenceAnalysisRecord;
  await atomicWriteJson(
    path.join(analysesDirectory(repoRoot), `${parsed.analysis_id}.json`),
    parsed,
  );
  return parsed;
}

export async function createFilmReferenceAnalysis(input: {
  repoRoot: string;
  referenceId: string;
  request: unknown;
  now?: string;
}): Promise<FilmReferenceAnalysisRecord> {
  const source = await getReferenceSource(input);
  if (!FILM_MEDIA_TYPES.has(source.media_type)) {
    throw new ReferenceLibraryError(
      'REFERENCE_MEDIA_TYPE_INVALID',
      `Film analysis is not valid for media_type=${source.media_type}`,
    );
  }
  const request = FilmReferenceAnalysisCreateRequestSchema.parse(input.request);
  const record: FilmReferenceAnalysisRecord = {
    schema_version: 'reference-analysis-record/v1',
    analysis_id: `analysis-${randomUUID()}`,
    reference_id: source.reference_id,
    analysis_type: 'film',
    analysis: request.analysis,
    analyzed_by: request.analyzed_by,
    analyzed_at: input.now ?? new Date().toISOString(),
    approval: approvalFromRequest(request.approval),
  };
  return await persistAnalysis(input.repoRoot, record) as FilmReferenceAnalysisRecord;
}

export async function createTextReferenceAnalysis(input: {
  repoRoot: string;
  referenceId: string;
  request: unknown;
  now?: string;
}): Promise<TextReferenceAnalysisRecord> {
  const source = await getReferenceSource(input);
  if (!TEXT_MEDIA_TYPES.has(source.media_type)) {
    throw new ReferenceLibraryError(
      'REFERENCE_MEDIA_TYPE_INVALID',
      `Text analysis is not valid for media_type=${source.media_type}`,
    );
  }
  const request = TextReferenceAnalysisCreateRequestSchema.parse(input.request);
  const record: TextReferenceAnalysisRecord = {
    schema_version: 'reference-analysis-record/v1',
    analysis_id: `analysis-${randomUUID()}`,
    reference_id: source.reference_id,
    analysis_type: 'text',
    analysis: request.analysis,
    analyzed_by: request.analyzed_by,
    analyzed_at: input.now ?? new Date().toISOString(),
    approval: approvalFromRequest(request.approval),
  };
  return await persistAnalysis(input.repoRoot, record) as TextReferenceAnalysisRecord;
}
