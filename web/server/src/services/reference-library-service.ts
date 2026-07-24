import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';
import {
  BenchmarkCardCreateRequestSchema,
  BenchmarkCardSchema,
  FilmReferenceAnalysisCreateRequestSchema,
  ReferenceAnalysisRecordSchema,
  ReferenceSourceCreateRequestSchema,
  ReferenceSourceRecordSchema,
  ReferenceSimilarityEvidenceCreateRequestSchema,
  ReferenceSimilarityEvidenceRecordSchema,
  ReferenceStylePackCreateRequestSchema,
  ReferenceStylePackRecordSchema,
  TextReferenceAnalysisCreateRequestSchema,
} from '@shared/schemas.js';
import type {
  BenchmarkCard,
  FilmReferenceAnalysisRecord,
  ReferenceAnalysisRecord,
  ReferenceLibraryDetail,
  ReferenceSourceMediaType,
  ReferenceSourceRecord,
  ReferenceSimilarityEvidenceRecord,
  ReferenceStylePackRecord,
  TextReferenceAnalysisRecord,
} from '@shared/types.js';

const REFERENCE_ID_PATTERN = /^reference-[a-f0-9-]+$/;
const ANALYSIS_ID_PATTERN = /^analysis-[a-f0-9-]+$/;
const BENCHMARK_ID_PATTERN = /^benchmark-[a-f0-9-]+$/;
const STYLE_PACK_ID_PATTERN = /^reference-style-pack-[a-f0-9-]+$/;
const SIMILARITY_EVIDENCE_ID_PATTERN =
  /^reference-similarity-evidence-[a-f0-9-]+$/;
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

function benchmarkCardsDirectory(repoRoot: string): string {
  return path.join(libraryRoot(repoRoot), 'benchmark-cards');
}

function referenceStylePacksDirectory(repoRoot: string): string {
  return path.join(libraryRoot(repoRoot), 'style-packs');
}

function similarityEvidenceDirectory(repoRoot: string): string {
  return path.join(libraryRoot(repoRoot), 'similarity-evidence');
}

function validateReferenceId(referenceId: string): string {
  if (!REFERENCE_ID_PATTERN.test(referenceId)) {
    throw new ReferenceLibraryError('REFERENCE_NOT_FOUND', `Reference not found: ${referenceId}`);
  }
  return referenceId;
}

function validateRecordId(input: {
  id: string;
  pattern: RegExp;
  code: string;
  label: string;
}): string {
  if (!input.pattern.test(input.id)) {
    throw new ReferenceLibraryError(input.code, `${input.label} not found: ${input.id}`);
  }
  return input.id;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
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

async function readBenchmarkCardFile(filePath: string): Promise<BenchmarkCard> {
  const raw = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  return BenchmarkCardSchema.parse(raw) as BenchmarkCard;
}

async function readReferenceStylePackFile(filePath: string): Promise<ReferenceStylePackRecord> {
  const raw = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  return ReferenceStylePackRecordSchema.parse(raw) as ReferenceStylePackRecord;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  if (value === undefined) return 'null';
  return JSON.stringify(value);
}

function similarityEvidencePayload(
  record: Omit<
    ReferenceSimilarityEvidenceRecord,
    'schema_version' | 'evidence_id' | 'payload_sha256' | 'created_at'
  >,
): unknown {
  return record;
}

function similarityEvidenceSha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

async function readSimilarityEvidenceFile(
  filePath: string,
): Promise<ReferenceSimilarityEvidenceRecord> {
  const raw = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  const record = ReferenceSimilarityEvidenceRecordSchema.parse(
    raw,
  ) as ReferenceSimilarityEvidenceRecord;
  const payload = similarityEvidencePayload({
    analysis_task_id: record.analysis_task_id,
    reference_id: record.reference_id,
    source_content_fingerprint: record.source_content_fingerprint,
    input_provenance: record.input_provenance,
    authorization: record.authorization,
    observations: record.observations,
    governance: record.governance,
  });
  if (similarityEvidenceSha256(payload) !== record.payload_sha256) {
    throw new ReferenceLibraryError(
      'REFERENCE_SIMILARITY_EVIDENCE_INTEGRITY_INVALID',
      `Reference similarity evidence integrity mismatch: ${record.evidence_id}`,
    );
  }
  return record;
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

export async function getReferenceAnalysis(input: {
  repoRoot: string;
  analysisId: string;
}): Promise<ReferenceAnalysisRecord> {
  const analysisId = validateRecordId({
    id: input.analysisId,
    pattern: ANALYSIS_ID_PATTERN,
    code: 'REFERENCE_ANALYSIS_NOT_FOUND',
    label: 'Reference analysis',
  });
  try {
    return await readAnalysisFile(path.join(analysesDirectory(input.repoRoot), `${analysisId}.json`));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ReferenceLibraryError(
        'REFERENCE_ANALYSIS_NOT_FOUND',
        `Reference analysis not found: ${analysisId}`,
      );
    }
    throw error;
  }
}

export async function getReferenceLibraryDetail(input: {
  repoRoot: string;
  referenceId: string;
}): Promise<ReferenceLibraryDetail> {
  const source = await getReferenceSource(input);
  const analyses = await listReferenceAnalyses(input);
  const similarityEvidence = await listReferenceSimilarityEvidence(input);
  return { source, analyses, similarity_evidence: similarityEvidence };
}

export async function createReferenceSimilarityEvidence(input: {
  repoRoot: string;
  referenceId: string;
  request: unknown;
  now?: string;
  analysisTaskId?: string;
  evidenceId?: string;
}): Promise<ReferenceSimilarityEvidenceRecord> {
  const source = await getReferenceSource(input);
  const request = ReferenceSimilarityEvidenceCreateRequestSchema.parse(
    input.request,
  );
  if (
    source.rights_status === 'research_only'
    || source.rights_status === 'unknown'
    || source.access_scope === 'metadata_only'
  ) {
    throw new ReferenceLibraryError(
      'REFERENCE_SIMILARITY_EVIDENCE_RIGHTS_INVALID',
      'Similarity evidence requires user-owned, licensed, or public-domain source material with excerpt or full-user-supplied access',
    );
  }
  if (request.authorization.basis !== source.rights_status) {
    throw new ReferenceLibraryError(
      'REFERENCE_SIMILARITY_EVIDENCE_RIGHTS_INVALID',
      'Similarity evidence authorization basis must match the source rights status',
    );
  }
  if (
    !source.content_fingerprint
    || request.source_content_fingerprint !== source.content_fingerprint
  ) {
    throw new ReferenceLibraryError(
      'REFERENCE_SIMILARITY_EVIDENCE_FINGERPRINT_INVALID',
      'Similarity evidence source fingerprint does not match the immutable reference source record',
    );
  }
  const payload = {
    ...(input.analysisTaskId
      ? { analysis_task_id: input.analysisTaskId }
      : {}),
    reference_id: source.reference_id,
    source_content_fingerprint: request.source_content_fingerprint,
    input_provenance: request.input_provenance,
    authorization: {
      ...request.authorization,
      machine_verified: false as const,
    },
    observations: request.observations,
    governance: {
      prompt_injection_allowed: false as const,
      knowledge_writeback_allowed: false as const,
      production_credit_eligible: false as const,
    },
  };
  const record = ReferenceSimilarityEvidenceRecordSchema.parse({
    schema_version: 'reference-similarity-evidence/v1',
    evidence_id: input.evidenceId
      ?? `reference-similarity-evidence-${randomUUID()}`,
    ...payload,
    payload_sha256: similarityEvidenceSha256(
      similarityEvidencePayload(payload),
    ),
    created_at: input.now ?? new Date().toISOString(),
  }) as ReferenceSimilarityEvidenceRecord;
  const filePath = path.join(
    similarityEvidenceDirectory(input.repoRoot),
    `${record.evidence_id}.json`,
  );
  try {
    const existing = await readSimilarityEvidenceFile(filePath);
    if (
      existing.payload_sha256 === record.payload_sha256
      && existing.reference_id === record.reference_id
      && existing.analysis_task_id === record.analysis_task_id
    ) {
      return existing;
    }
    throw new ReferenceLibraryError(
      'REFERENCE_SIMILARITY_EVIDENCE_CONFLICT',
      `Reference similarity evidence already exists with different content: ${record.evidence_id}`,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await atomicWriteJson(
    filePath,
    record,
  );
  return record;
}

export async function getReferenceSimilarityEvidence(input: {
  repoRoot: string;
  evidenceId: string;
}): Promise<ReferenceSimilarityEvidenceRecord> {
  const evidenceId = validateRecordId({
    id: input.evidenceId,
    pattern: SIMILARITY_EVIDENCE_ID_PATTERN,
    code: 'REFERENCE_SIMILARITY_EVIDENCE_NOT_FOUND',
    label: 'Reference similarity evidence',
  });
  try {
    return await readSimilarityEvidenceFile(path.join(
      similarityEvidenceDirectory(input.repoRoot),
      `${evidenceId}.json`,
    ));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ReferenceLibraryError(
        'REFERENCE_SIMILARITY_EVIDENCE_NOT_FOUND',
        `Reference similarity evidence not found: ${evidenceId}`,
      );
    }
    throw error;
  }
}

export async function listReferenceSimilarityEvidence(input: {
  repoRoot: string;
  referenceId: string;
}): Promise<ReferenceSimilarityEvidenceRecord[]> {
  const referenceId = validateReferenceId(input.referenceId);
  const records = await readJsonFiles(
    similarityEvidenceDirectory(input.repoRoot),
    readSimilarityEvidenceFile,
  );
  return records
    .filter(record => record.reference_id === referenceId)
    .sort((left, right) =>
      right.created_at.localeCompare(left.created_at)
      || left.evidence_id.localeCompare(right.evidence_id));
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

export async function createBenchmarkCard(input: {
  repoRoot: string;
  request: unknown;
  now?: string;
}): Promise<BenchmarkCard> {
  const request = BenchmarkCardCreateRequestSchema.parse(input.request);
  const analyses = await Promise.all(request.analysis_ids.map(analysisId =>
    getReferenceAnalysis({ repoRoot: input.repoRoot, analysisId })));
  if (analyses.some(analysis => analysis.approval.status !== 'approved')) {
    throw new ReferenceLibraryError(
      'REFERENCE_ANALYSIS_APPROVAL_CONFLICT',
      'Every analysis must be human-approved before benchmark composition',
    );
  }
  const referenceIds = unique(analyses.map(analysis => analysis.reference_id));
  if (referenceIds.length < 2) {
    throw new ReferenceLibraryError(
      'REFERENCE_BENCHMARK_SOURCE_INVALID',
      'A benchmark card requires at least two distinct reference sources',
    );
  }
  if (request.evidence_refs.some(analysisId => !request.analysis_ids.includes(analysisId))) {
    throw new ReferenceLibraryError(
      'REFERENCE_BENCHMARK_EVIDENCE_INVALID',
      'Every evidence_ref must resolve to one of the selected approved analyses',
    );
  }
  const evidenceReferenceIds = unique(analyses
    .filter(analysis => request.evidence_refs.includes(analysis.analysis_id))
    .map(analysis => analysis.reference_id));
  if (referenceIds.some(referenceId => !evidenceReferenceIds.includes(referenceId))) {
    throw new ReferenceLibraryError(
      'REFERENCE_BENCHMARK_EVIDENCE_INVALID',
      'evidence_refs must cover every selected reference source',
    );
  }
  const record = BenchmarkCardSchema.parse({
    schema_version: 'reference-benchmark-card/v1',
    benchmark_id: `benchmark-${randomUUID()}`,
    reference_ids: referenceIds,
    analysis_ids: request.analysis_ids,
    target_video_type: request.target_video_type,
    target_dimension: request.target_dimension,
    principle: request.principle,
    evidence_refs: request.evidence_refs,
    created_by: request.created_by,
    created_at: input.now ?? new Date().toISOString(),
    approval: {
      status: 'approved',
      approved_by: request.approval.approved_by,
      approved_at: request.approval.approved_at,
    },
    governance: {
      knowledge_writeback_allowed: false,
      production_credit_eligible: false,
    },
  }) as BenchmarkCard;
  await atomicWriteJson(
    path.join(benchmarkCardsDirectory(input.repoRoot), `${record.benchmark_id}.json`),
    record,
  );
  return record;
}

export async function getBenchmarkCard(input: {
  repoRoot: string;
  benchmarkId: string;
}): Promise<BenchmarkCard> {
  const benchmarkId = validateRecordId({
    id: input.benchmarkId,
    pattern: BENCHMARK_ID_PATTERN,
    code: 'REFERENCE_BENCHMARK_NOT_FOUND',
    label: 'Reference benchmark',
  });
  try {
    return await readBenchmarkCardFile(
      path.join(benchmarkCardsDirectory(input.repoRoot), `${benchmarkId}.json`),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ReferenceLibraryError(
        'REFERENCE_BENCHMARK_NOT_FOUND',
        `Reference benchmark not found: ${benchmarkId}`,
      );
    }
    throw error;
  }
}

export async function listBenchmarkCards(input: {
  repoRoot: string;
}): Promise<BenchmarkCard[]> {
  const cards = await readJsonFiles(benchmarkCardsDirectory(input.repoRoot), readBenchmarkCardFile);
  return cards.sort((left, right) =>
    right.created_at.localeCompare(left.created_at)
    || left.benchmark_id.localeCompare(right.benchmark_id));
}

export async function createReferenceStylePack(input: {
  repoRoot: string;
  request: unknown;
  now?: string;
}): Promise<ReferenceStylePackRecord> {
  const request = ReferenceStylePackCreateRequestSchema.parse(input.request);
  const benchmarkCards = await Promise.all(request.benchmark_card_ids.map(benchmarkId =>
    getBenchmarkCard({ repoRoot: input.repoRoot, benchmarkId })));
  const omittedTargetTypes = unique(benchmarkCards
    .map(card => card.target_video_type)
    .filter(videoType => !request.compatible_video_types.includes(videoType)));
  if (omittedTargetTypes.length > 0) {
    throw new ReferenceLibraryError(
      'REFERENCE_STYLE_PACK_COMPATIBILITY_INVALID',
      `compatible_video_types omits benchmark target types: ${omittedTargetTypes.join(', ')}`,
    );
  }

  const sourceReferenceIds = unique(benchmarkCards.flatMap(card => card.reference_ids));
  const sourceAnalysisIds = unique(benchmarkCards.flatMap(card => card.analysis_ids));
  const analyses = await Promise.all(sourceAnalysisIds.map(analysisId =>
    getReferenceAnalysis({ repoRoot: input.repoRoot, analysisId })));
  if (analyses.some(analysis => analysis.approval.status !== 'approved')) {
    throw new ReferenceLibraryError(
      'REFERENCE_ANALYSIS_APPROVAL_CONFLICT',
      'Every source analysis must remain human-approved for style-pack composition',
    );
  }
  const reusablePrinciples = unique(benchmarkCards.map(card => card.principle));
  const avoidCopying = unique(analyses.flatMap(analysis => analysis.analysis.avoid_copying));
  const record = ReferenceStylePackRecordSchema.parse({
    schema_version: 'reference-style-pack/v1',
    id: `reference-style-pack-${randomUUID()}`,
    name: request.name,
    description: request.description,
    source_reference_ids: sourceReferenceIds,
    source_analysis_ids: sourceAnalysisIds,
    source_benchmark_ids: request.benchmark_card_ids,
    compatible_video_types: request.compatible_video_types,
    compatible_presentation_styles: request.compatible_presentation_styles,
    compatible_story_structures: request.compatible_story_structures,
    structure_rules: reusablePrinciples,
    rhythm_rules: [],
    scene_rules: [],
    narration_rules: [],
    dialogue_rules: [],
    visual_rules: [],
    ending_rules: [],
    forbidden_patterns: avoidCopying,
    reusable_principles: reusablePrinciples,
    avoid_copying: avoidCopying,
    created_by: request.created_by,
    created_at: input.now ?? new Date().toISOString(),
    approval: {
      status: 'approved',
      approved_by: request.approval.approved_by,
      approved_at: request.approval.approved_at,
    },
    governance: {
      knowledge_writeback_allowed: false,
      production_credit_eligible: false,
    },
  }) as ReferenceStylePackRecord;
  await atomicWriteJson(
    path.join(referenceStylePacksDirectory(input.repoRoot), `${record.id}.json`),
    record,
  );
  return record;
}

export async function getReferenceStylePack(input: {
  repoRoot: string;
  stylePackId: string;
}): Promise<ReferenceStylePackRecord> {
  const stylePackId = validateRecordId({
    id: input.stylePackId,
    pattern: STYLE_PACK_ID_PATTERN,
    code: 'REFERENCE_STYLE_PACK_NOT_FOUND',
    label: 'Reference style pack',
  });
  try {
    return await readReferenceStylePackFile(
      path.join(referenceStylePacksDirectory(input.repoRoot), `${stylePackId}.json`),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ReferenceLibraryError(
        'REFERENCE_STYLE_PACK_NOT_FOUND',
        `Reference style pack not found: ${stylePackId}`,
      );
    }
    throw error;
  }
}

export async function listReferenceStylePacks(input: {
  repoRoot: string;
}): Promise<ReferenceStylePackRecord[]> {
  const records = await readJsonFiles(
    referenceStylePacksDirectory(input.repoRoot),
    readReferenceStylePackFile,
  );
  return records.sort((left, right) =>
    right.created_at.localeCompare(left.created_at)
    || left.id.localeCompare(right.id));
}
