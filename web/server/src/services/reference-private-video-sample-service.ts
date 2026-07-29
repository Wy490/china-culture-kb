import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  ReferencePrivateVideoSampleIngestRequestSchema,
  ReferencePrivateVideoSampleRecordSchema,
  ReferencePrivateVideoTranscriptSubmitRequestSchema,
} from '@shared/schemas.js';
import type {
  ReferencePrivateVideoDerivedArtifact,
  ReferencePrivateVideoProbeReport,
  ReferencePrivateVideoSampleIngestResult,
  ReferencePrivateVideoSampleRecord,
  ReferencePrivateVideoStreamSummary,
  ReferencePrivateVideoTranscriptSubmissionResult,
} from '@shared/types.js';

const SAMPLE_ID_PATTERN = /^reference-private-video-[a-f0-9]{24}$/;
const COMMAND_OUTPUT_LIMIT = 2_000_000;
const COMMAND_TIMEOUT_MS = 60_000;

type CommandName = 'ffprobe' | 'ffmpeg';

export interface PrivateVideoCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type PrivateVideoCommandRunner = (
  command: CommandName,
  args: string[],
) => Promise<PrivateVideoCommandResult>;

class ReferencePrivateVideoSampleError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ReferencePrivateVideoSampleError';
  }
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function hashFile(filePath: string): Promise<{
  content_sha256: string;
  byte_length: number;
}> {
  const hash = createHash('sha256');
  let byteLength = 0;
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', chunk => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      byteLength += buffer.length;
      hash.update(buffer);
    });
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return {
    content_sha256: hash.digest('hex'),
    byte_length: byteLength,
  };
}

function privateSamplesRoot(repoRoot: string): string {
  return path.resolve(repoRoot, 'references/creative/private-video-samples');
}

function sampleDirectory(repoRoot: string, sampleId: string): string {
  return path.join(privateSamplesRoot(repoRoot), sampleId);
}

function recordPath(repoRoot: string, sampleId: string): string {
  return path.join(sampleDirectory(repoRoot, sampleId), 'record.json');
}

function toPrivateRelativePath(repoRoot: string, filePath: string): string {
  return path.relative(path.resolve(repoRoot), filePath).split(path.sep).join('/');
}

function validateSampleId(sampleId: string): string {
  if (!SAMPLE_ID_PATTERN.test(sampleId)) {
    throw new ReferencePrivateVideoSampleError(
      'REFERENCE_PRIVATE_VIDEO_SAMPLE_NOT_FOUND',
      `Reference private video sample not found: ${sampleId}`,
    );
  }
  return sampleId;
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function validateSourcePath(input: {
  repoRoot: string;
  localVideoPath: string;
}): Promise<string> {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input.localVideoPath)) {
    throw new ReferencePrivateVideoSampleError(
      'REFERENCE_PRIVATE_VIDEO_SOURCE_PATH_INVALID',
      'Private video ingest only accepts a local filesystem path, not a URL or URI',
    );
  }
  if (!path.isAbsolute(input.localVideoPath)) {
    throw new ReferencePrivateVideoSampleError(
      'REFERENCE_PRIVATE_VIDEO_SOURCE_PATH_INVALID',
      'Private video ingest requires an absolute local filesystem path',
    );
  }
  const sourcePath = path.resolve(input.localVideoPath);
  if (isInside(input.repoRoot, sourcePath)) {
    throw new ReferencePrivateVideoSampleError(
      'REFERENCE_PRIVATE_VIDEO_SOURCE_PATH_INVALID',
      'Private video originals must be supplied from outside the Git worktree',
    );
  }
  let sourceStat;
  try {
    sourceStat = await stat(sourcePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ReferencePrivateVideoSampleError(
        'REFERENCE_PRIVATE_VIDEO_SOURCE_NOT_FOUND',
        `Private video source not found: ${sourcePath}`,
      );
    }
    throw error;
  }
  if (!sourceStat.isFile() || sourceStat.size <= 0) {
    throw new ReferencePrivateVideoSampleError(
      'REFERENCE_PRIVATE_VIDEO_SOURCE_PATH_INVALID',
      'Private video source must be a non-empty regular file',
    );
  }
  return sourcePath;
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  await rename(temporaryPath, filePath);
}

async function readSampleRecord(input: {
  repoRoot: string;
  sampleId: string;
}): Promise<ReferencePrivateVideoSampleRecord> {
  validateSampleId(input.sampleId);
  try {
    return ReferencePrivateVideoSampleRecordSchema.parse(
      JSON.parse(await readFile(recordPath(input.repoRoot, input.sampleId), 'utf8')) as unknown,
    ) as ReferencePrivateVideoSampleRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ReferencePrivateVideoSampleError(
        'REFERENCE_PRIVATE_VIDEO_SAMPLE_NOT_FOUND',
        `Reference private video sample not found: ${input.sampleId}`,
      );
    }
    throw error;
  }
}

function defaultCommandRunner(
  command: CommandName,
  args: string[],
): Promise<PrivateVideoCommandResult> {
  return new Promise(resolve => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result: PrivateVideoCommandResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    const append = (current: string, chunk: Buffer): string =>
      `${current}${chunk.toString('utf8')}`.slice(0, COMMAND_OUTPUT_LIMIT);
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      finish({
        exitCode: 124,
        stdout,
        stderr: stderr || `${command} timed out after ${COMMAND_TIMEOUT_MS}ms`,
      });
    }, COMMAND_TIMEOUT_MS);
    child.stdout.on('data', chunk => {
      stdout = append(stdout, chunk as Buffer);
    });
    child.stderr.on('data', chunk => {
      stderr = append(stderr, chunk as Buffer);
    });
    child.on('error', error => {
      finish({
        exitCode: 127,
        stdout,
        stderr: error.message,
      });
    });
    child.on('close', (code, signal) => {
      finish({
        exitCode: code ?? 1,
        stdout,
        stderr: signal ? `${stderr}\n${command} terminated by ${signal}`.trim() : stderr,
      });
    });
  });
}

function commandHint(command: CommandName, label: string): string {
  if (command === 'ffprobe') {
    return 'ffprobe -v error -print_format json -show_format -show_streams '
      + label;
  }
  return `ffmpeg ${label}`;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : undefined;
}

function parseInteger(value: unknown): number | undefined {
  const numeric = parseNumber(value);
  return numeric === undefined ? undefined : Math.trunc(numeric);
}

function streamSummary(stream: Record<string, unknown>): ReferencePrivateVideoStreamSummary | null {
  const codecType = stream.codec_type;
  if (codecType !== 'video' && codecType !== 'audio') return null;
  return {
    codec_type: codecType,
    codec_name: typeof stream.codec_name === 'string' && stream.codec_name.trim()
      ? stream.codec_name.trim()
      : undefined,
    width: parseInteger(stream.width),
    height: parseInteger(stream.height),
    sample_rate: parseInteger(stream.sample_rate),
    channels: parseInteger(stream.channels),
    duration_seconds: parseNumber(stream.duration),
    avg_frame_rate: typeof stream.avg_frame_rate === 'string'
      && stream.avg_frame_rate.trim()
      ? stream.avg_frame_rate.trim()
      : undefined,
  };
}

async function runFfprobe(input: {
  repoRoot: string;
  privateVideoPath: string;
  outputPath: string;
  runner: PrivateVideoCommandRunner;
}): Promise<ReferencePrivateVideoProbeReport> {
  const args = [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    input.privateVideoPath,
  ];
  const command = commandHint('ffprobe', '<private-original-video>');
  const result = await input.runner('ffprobe', args);
  if (result.exitCode !== 0 || !result.stdout.trim()) {
    return ReferencePrivateVideoSampleRecordSchema.shape.ffprobe.parse({
      status: 'blocked',
      command,
      blocked_reason: result.stderr.trim() || `ffprobe exited with code ${result.exitCode}`,
      video_streams: [],
      audio_streams: [],
    }) as ReferencePrivateVideoProbeReport;
  }
  let raw: {
    format?: Record<string, unknown>;
    streams?: Array<Record<string, unknown>>;
  };
  try {
    raw = JSON.parse(result.stdout) as {
      format?: Record<string, unknown>;
      streams?: Array<Record<string, unknown>>;
    };
  } catch {
    return ReferencePrivateVideoSampleRecordSchema.shape.ffprobe.parse({
      status: 'blocked',
      command,
      blocked_reason: 'ffprobe returned non-JSON output',
      video_streams: [],
      audio_streams: [],
    }) as ReferencePrivateVideoProbeReport;
  }
  await mkdir(path.dirname(input.outputPath), { recursive: true });
  await writeFile(input.outputPath, result.stdout, { encoding: 'utf8', flag: 'wx' });
  const streams = (raw.streams ?? [])
    .map(streamSummary)
    .filter((item): item is ReferencePrivateVideoStreamSummary => Boolean(item));
  return ReferencePrivateVideoSampleRecordSchema.shape.ffprobe.parse({
    status: 'ready',
    command,
    raw_json_private_relative_path: toPrivateRelativePath(input.repoRoot, input.outputPath),
    raw_json_sha256: sha256(result.stdout),
    format_name: typeof raw.format?.format_name === 'string'
      && raw.format.format_name.trim()
      ? raw.format.format_name.trim()
      : undefined,
    duration_seconds: parseNumber(raw.format?.duration),
    bit_rate: parseInteger(raw.format?.bit_rate),
    video_streams: streams.filter(stream => stream.codec_type === 'video'),
    audio_streams: streams.filter(stream => stream.codec_type === 'audio'),
  }) as ReferencePrivateVideoProbeReport;
}

async function runFfmpegArtifact(input: {
  repoRoot: string;
  kind: 'thumbnail_jpeg' | 'audio_wav_16khz_mono';
  commandLabel: string;
  args: string[];
  outputPath: string;
  runner: PrivateVideoCommandRunner;
}): Promise<ReferencePrivateVideoDerivedArtifact> {
  const command = commandHint('ffmpeg', input.commandLabel);
  const result = await input.runner('ffmpeg', input.args);
  if (result.exitCode !== 0) {
    return ReferencePrivateVideoSampleRecordSchema.shape.ffmpeg_derivatives.shape
      .thumbnail.parse({
        status: 'blocked',
        kind: input.kind,
        command,
        blocked_reason: result.stderr.trim() || `ffmpeg exited with code ${result.exitCode}`,
      }) as ReferencePrivateVideoDerivedArtifact;
  }
  let fileHash;
  try {
    fileHash = await hashFile(input.outputPath);
  } catch (error) {
    return ReferencePrivateVideoSampleRecordSchema.shape.ffmpeg_derivatives.shape
      .thumbnail.parse({
        status: 'blocked',
        kind: input.kind,
        command,
        blocked_reason:
          `ffmpeg did not produce ${path.basename(input.outputPath)}: ${
            (error as Error).message
          }`,
      }) as ReferencePrivateVideoDerivedArtifact;
  }
  return ReferencePrivateVideoSampleRecordSchema.shape.ffmpeg_derivatives.shape
    .thumbnail.parse({
      status: 'ready',
      kind: input.kind,
      command,
      private_relative_path: toPrivateRelativePath(input.repoRoot, input.outputPath),
      content_sha256: fileHash.content_sha256,
      byte_length: fileHash.byte_length,
    }) as ReferencePrivateVideoDerivedArtifact;
}

function sampleId(input: {
  title: string;
  contentSha256: string;
}): string {
  return `reference-private-video-${
    sha256(`${input.title}:${input.contentSha256}`).slice(0, 24)
  }`;
}

function transcriptId(input: {
  sampleId: string;
  contentSha256: string;
}): string {
  return `reference-private-video-transcript-${
    sha256(`${input.sampleId}:${input.contentSha256}`).slice(0, 24)
  }`;
}

function extensionFor(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : '.video';
}

function originalFilename(filePath: string): string {
  const basename = path.basename(filePath).replace(/[^\w. -]/g, '_').trim();
  return basename || `private-video${extensionFor(filePath)}`;
}

function withMachineBoundary(
  authorization: Omit<ReferencePrivateVideoSampleRecord['authorization'], 'machine_verified'>,
): ReferencePrivateVideoSampleRecord['authorization'] {
  return {
    ...authorization,
    machine_verified: false,
  };
}

function sameAuthorization(
  left: ReferencePrivateVideoSampleRecord['authorization'],
  right: ReferencePrivateVideoSampleRecord['authorization'],
): boolean {
  return left.basis === right.basis
    && left.authorization_reference === right.authorization_reference
    && left.attested_by === right.attested_by
    && left.attested_at === right.attested_at
    && left.confirmation === right.confirmation;
}

function sameIngestRequest(input: {
  existing: ReferencePrivateVideoSampleRecord;
  title: string;
  mediaType: ReferencePrivateVideoSampleRecord['media_type'];
  rightsStatus: ReferencePrivateVideoSampleRecord['rights_status'];
  accessScope: ReferencePrivateVideoSampleRecord['access_scope'];
  userReason: string;
  contentSha256: string;
  byteLength: number;
  authorization: ReferencePrivateVideoSampleRecord['authorization'];
}): boolean {
  return input.existing.title === input.title
    && input.existing.media_type === input.mediaType
    && input.existing.rights_status === input.rightsStatus
    && input.existing.access_scope === input.accessScope
    && input.existing.user_reason === input.userReason
    && input.existing.source_video.content_sha256 === input.contentSha256
    && input.existing.source_video.byte_length === input.byteLength
    && sameAuthorization(input.existing.authorization, input.authorization);
}

async function assertStoredOriginalMatches(input: {
  repoRoot: string;
  record: ReferencePrivateVideoSampleRecord;
}): Promise<void> {
  const storedPath = path.resolve(
    input.repoRoot,
    input.record.source_video.stored_private_relative_path,
  );
  if (!isInside(privateSamplesRoot(input.repoRoot), storedPath)) {
    throw new ReferencePrivateVideoSampleError(
      'REFERENCE_PRIVATE_VIDEO_SAMPLE_INTEGRITY_INVALID',
      `Private video sample path escaped private root: ${input.record.sample_id}`,
    );
  }
  const storedHash = await hashFile(storedPath);
  if (
    storedHash.content_sha256 !== input.record.source_video.content_sha256
    || storedHash.byte_length !== input.record.source_video.byte_length
  ) {
    throw new ReferencePrivateVideoSampleError(
      'REFERENCE_PRIVATE_VIDEO_SAMPLE_INTEGRITY_INVALID',
      `Private video sample integrity mismatch: ${input.record.sample_id}`,
    );
  }
}

export async function createReferencePrivateVideoSample(input: {
  repoRoot: string;
  request: unknown;
  now?: string;
  runner?: PrivateVideoCommandRunner;
}): Promise<ReferencePrivateVideoSampleIngestResult> {
  const request = ReferencePrivateVideoSampleIngestRequestSchema.parse(input.request);
  if (request.authorization.basis !== request.rights_status) {
    throw new ReferencePrivateVideoSampleError(
      'REFERENCE_PRIVATE_VIDEO_AUTHORIZATION_INVALID',
      'Private video authorization basis must match rights_status',
    );
  }
  const sourcePath = await validateSourcePath({
    repoRoot: input.repoRoot,
    localVideoPath: request.local_video_path,
  });
  const sourceHash = await hashFile(sourcePath);
  const id = sampleId({
    title: request.title,
    contentSha256: sourceHash.content_sha256,
  });
  const authorization = withMachineBoundary(request.authorization);
  try {
    const existing = await readSampleRecord({
      repoRoot: input.repoRoot,
      sampleId: id,
    });
    if (sameIngestRequest({
      existing,
      title: request.title,
      mediaType: request.media_type,
      rightsStatus: request.rights_status,
      accessScope: request.access_scope,
      userReason: request.user_reason,
      contentSha256: sourceHash.content_sha256,
      byteLength: sourceHash.byte_length,
      authorization,
    })) {
      await assertStoredOriginalMatches({ repoRoot: input.repoRoot, record: existing });
      return { sample: existing, idempotent_replay: true };
    }
    throw new ReferencePrivateVideoSampleError(
      'REFERENCE_PRIVATE_VIDEO_SAMPLE_CONFLICT',
      'Private video sample is already sealed with different metadata',
    );
  } catch (error) {
    if (
      !(error instanceof ReferencePrivateVideoSampleError)
      || error.code !== 'REFERENCE_PRIVATE_VIDEO_SAMPLE_NOT_FOUND'
    ) {
      throw error;
    }
  }

  const directory = sampleDirectory(input.repoRoot, id);
  const originalPath = path.join(
    directory,
    'original',
    `${sourceHash.content_sha256}${extensionFor(sourcePath)}`,
  );
  const derivativesDir = path.join(directory, 'derived');
  await mkdir(path.dirname(originalPath), { recursive: true });
  await mkdir(derivativesDir, { recursive: true });
  await copyFile(sourcePath, originalPath);
  const storedHash = await hashFile(originalPath);
  if (
    storedHash.content_sha256 !== sourceHash.content_sha256
    || storedHash.byte_length !== sourceHash.byte_length
  ) {
    throw new ReferencePrivateVideoSampleError(
      'REFERENCE_PRIVATE_VIDEO_SAMPLE_INTEGRITY_INVALID',
      'Private video copy hash does not match source hash',
    );
  }

  const runner = input.runner ?? defaultCommandRunner;
  const ffprobe = await runFfprobe({
    repoRoot: input.repoRoot,
    privateVideoPath: originalPath,
    outputPath: path.join(derivativesDir, 'ffprobe.json'),
    runner,
  });
  const thumbnail = request.extract_thumbnail === false
    ? {
      status: 'not_requested',
      kind: 'thumbnail_jpeg',
    } as ReferencePrivateVideoDerivedArtifact
    : await runFfmpegArtifact({
      repoRoot: input.repoRoot,
      kind: 'thumbnail_jpeg',
      commandLabel:
        '-y -hide_banner -loglevel error -ss <seconds> -i '
        + '<private-original-video> -frames:v 1 -vf scale=640:-1 '
        + '<private-thumbnail-jpeg>',
      args: [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-ss',
        String(request.thumbnail_time_seconds ?? 0),
        '-i',
        originalPath,
        '-frames:v',
        '1',
        '-vf',
        'scale=640:-1',
        path.join(derivativesDir, 'thumbnail.jpg'),
      ],
      outputPath: path.join(derivativesDir, 'thumbnail.jpg'),
      runner,
    });
  const audioWav = request.extract_audio_wav === false
    ? {
      status: 'not_requested',
      kind: 'audio_wav_16khz_mono',
    } as ReferencePrivateVideoDerivedArtifact
    : await runFfmpegArtifact({
      repoRoot: input.repoRoot,
      kind: 'audio_wav_16khz_mono',
      commandLabel:
        '-y -hide_banner -loglevel error -i <private-original-video> '
        + '-vn -ac 1 -ar 16000 <private-audio-wav>',
      args: [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        originalPath,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '16000',
        path.join(derivativesDir, 'audio-16khz-mono.wav'),
      ],
      outputPath: path.join(derivativesDir, 'audio-16khz-mono.wav'),
      runner,
    });
  const now = input.now ?? new Date().toISOString();
  const record = ReferencePrivateVideoSampleRecordSchema.parse({
    schema_version: 'reference-private-video-sample/v1',
    sample_id: id,
    title: request.title,
    media_type: request.media_type,
    rights_status: request.rights_status,
    access_scope: request.access_scope,
    user_reason: request.user_reason,
    source_video: {
      original_filename: originalFilename(sourcePath),
      stored_private_relative_path: toPrivateRelativePath(input.repoRoot, originalPath),
      content_sha256: sourceHash.content_sha256,
      byte_length: sourceHash.byte_length,
    },
    authorization,
    ffprobe,
    ffmpeg_derivatives: {
      thumbnail,
      audio_wav: audioWav,
    },
    transcript: {
      status: 'not_submitted',
    },
    governance: {
      local_private_mode: true,
      source_video_in_git: false,
      source_path_persisted: false,
      server_download_allowed: false,
      third_party_upload_allowed: false,
      external_model_call_performed: false,
      ffprobe_allowed: true,
      ffmpeg_allowed: true,
      local_transcription_allowed: true,
      prompt_injection_allowed: false,
      knowledge_writeback_allowed: false,
      production_credit_eligible: false,
      human_review_complete: false,
      production_credit_granted: false,
    },
    created_at: now,
    updated_at: now,
  }) as ReferencePrivateVideoSampleRecord;
  await atomicWriteJson(recordPath(input.repoRoot, id), record);
  return { sample: record, idempotent_replay: false };
}

export async function getReferencePrivateVideoSample(input: {
  repoRoot: string;
  sampleId: string;
}): Promise<ReferencePrivateVideoSampleRecord> {
  const record = await readSampleRecord(input);
  await assertStoredOriginalMatches({ repoRoot: input.repoRoot, record });
  return record;
}

function sameTranscript(
  transcript: ReferencePrivateVideoSampleRecord['transcript'],
  expected: Exclude<ReferencePrivateVideoSampleRecord['transcript'], { status: 'not_submitted' }>,
): boolean {
  return transcript.status === 'ready'
    && transcript.transcript_format === expected.transcript_format
    && transcript.content_sha256 === expected.content_sha256
    && transcript.byte_length === expected.byte_length
    && transcript.character_count === expected.character_count
    && transcript.line_count === expected.line_count
    && transcript.transcribed_by === expected.transcribed_by
    && transcript.transcribed_at === expected.transcribed_at
    && transcript.method === expected.method
    && transcript.tool_name === expected.tool_name
    && transcript.tool_version === expected.tool_version;
}

export async function submitReferencePrivateVideoTranscript(input: {
  repoRoot: string;
  sampleId: string;
  request: unknown;
  now?: string;
}): Promise<ReferencePrivateVideoTranscriptSubmissionResult> {
  const request = ReferencePrivateVideoTranscriptSubmitRequestSchema.parse(input.request);
  const record = await getReferencePrivateVideoSample({
    repoRoot: input.repoRoot,
    sampleId: input.sampleId,
  });
  const bytes = Buffer.from(request.transcript_text);
  const contentSha256 = sha256(bytes);
  const transcriptPath = path.join(
    sampleDirectory(input.repoRoot, record.sample_id),
    'transcript',
    request.transcript_format === 'text/plain'
      ? 'transcript.txt'
      : request.transcript_format === 'text/srt'
        ? 'transcript.srt'
        : 'transcript.vtt',
  );
  const transcript = ReferencePrivateVideoSampleRecordSchema.shape.transcript.parse({
    status: 'ready',
    transcript_id: transcriptId({
      sampleId: record.sample_id,
      contentSha256,
    }),
    transcript_format: request.transcript_format,
    content_sha256: contentSha256,
    byte_length: bytes.length,
    character_count: Array.from(request.transcript_text).length,
    line_count: request.transcript_text.split('\n').length,
    private_relative_path: toPrivateRelativePath(input.repoRoot, transcriptPath),
    transcribed_by: request.transcribed_by,
    transcribed_at: request.transcribed_at,
    method: request.method,
    tool_name: request.tool_name,
    tool_version: request.tool_version,
    local_transcription_performed: true,
    external_model_call_performed: false,
    third_party_upload_performed: false,
  }) as Exclude<
    ReferencePrivateVideoSampleRecord['transcript'],
    { status: 'not_submitted' }
  >;
  if (sameTranscript(record.transcript, transcript)) {
    const existing = await readFile(transcriptPath, 'utf8');
    if (existing !== request.transcript_text) {
      throw new ReferencePrivateVideoSampleError(
        'REFERENCE_PRIVATE_VIDEO_TRANSCRIPT_INTEGRITY_INVALID',
        `Private video transcript integrity mismatch: ${record.sample_id}`,
      );
    }
    return { sample: record, idempotent_replay: true };
  }
  if (record.transcript.status === 'ready') {
    throw new ReferencePrivateVideoSampleError(
      'REFERENCE_PRIVATE_VIDEO_TRANSCRIPT_CONFLICT',
      'Private video transcript is already sealed with different metadata or text',
    );
  }
  await mkdir(path.dirname(transcriptPath), { recursive: true });
  await writeFile(transcriptPath, bytes, { flag: 'wx' });
  const updated = ReferencePrivateVideoSampleRecordSchema.parse({
    ...record,
    transcript,
    updated_at: input.now ?? new Date().toISOString(),
  }) as ReferencePrivateVideoSampleRecord;
  await atomicWriteJson(recordPath(input.repoRoot, record.sample_id), updated);
  return { sample: updated, idempotent_replay: false };
}
