import { readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import {
  createReferencePrivateVideoSample,
  submitReferencePrivateVideoTranscript,
} from '../src/services/reference-private-video-sample-service.js'

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function requireArgument(name: string): string {
  const value = argumentValue(name)
  if (!value) throw new Error(`${name} is required`)
  return value
}

function optionalNumber(name: string): number | undefined {
  const value = argumentValue(name)
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`)
  return parsed
}

function assertOutsideRepo(repoRoot: string, filePath: string, label: string): void {
  if (!isAbsolute(filePath)) throw new Error(`${label} must be an absolute local path`)
  const relativePath = relative(repoRoot, filePath)
  if (
    relativePath === ''
    || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
  ) {
    throw new Error(`${label} must stay outside the Git worktree`)
  }
}

const webRoot = resolve(import.meta.dirname, '..', '..')
const repoRoot = resolve(webRoot, '..')
const videoPath = resolve(requireArgument('--video'))
assertOutsideRepo(repoRoot, videoPath, '--video')

const ingestResult = await createReferencePrivateVideoSample({
  repoRoot,
  request: {
    title: requireArgument('--title'),
    media_type: requireArgument('--media-type'),
    local_video_path: videoPath,
    rights_status: requireArgument('--rights-status'),
    access_scope: requireArgument('--access-scope'),
    user_reason: requireArgument('--user-reason'),
    authorization: {
      basis: requireArgument('--rights-status'),
      authorization_reference: requireArgument('--authorization-reference'),
      attested_by: requireArgument('--attested-by'),
      attested_at: requireArgument('--attested-at'),
      confirmation: 'authorized_private_video_ingest',
    },
    thumbnail_time_seconds: optionalNumber('--thumbnail-time'),
    extract_thumbnail: hasFlag('--no-thumbnail') ? false : undefined,
    extract_audio_wav: hasFlag('--no-audio') ? false : undefined,
  },
})

let transcriptResult:
  | Awaited<ReturnType<typeof submitReferencePrivateVideoTranscript>>
  | null = null
const transcriptPath = argumentValue('--transcript')
if (transcriptPath) {
  const resolvedTranscriptPath = resolve(transcriptPath)
  assertOutsideRepo(repoRoot, resolvedTranscriptPath, '--transcript')
  transcriptResult = await submitReferencePrivateVideoTranscript({
    repoRoot,
    sampleId: ingestResult.sample.sample_id,
    request: {
      transcript_text: await readFile(resolvedTranscriptPath, 'utf8'),
      transcript_format: argumentValue('--transcript-format') ?? 'text/plain',
      transcribed_by: requireArgument('--transcribed-by'),
      transcribed_at: requireArgument('--transcribed-at'),
      method: argumentValue('--transcript-method') ?? 'local_model',
      tool_name: argumentValue('--tool-name'),
      tool_version: argumentValue('--tool-version'),
      confirmation: 'local_private_transcription_only',
    },
  })
}

const sample = transcriptResult?.sample ?? ingestResult.sample
const report = {
  schema_version: 'reference-private-video-sample-local-intake-report/v1',
  created_at: new Date().toISOString(),
  sample_id: sample.sample_id,
  ingest_idempotent_replay: ingestResult.idempotent_replay,
  transcript_idempotent_replay: transcriptResult?.idempotent_replay ?? null,
  ffprobe_status: sample.ffprobe.status,
  thumbnail_status: sample.ffmpeg_derivatives.thumbnail.status,
  audio_wav_status: sample.ffmpeg_derivatives.audio_wav.status,
  transcript_status: sample.transcript.status,
  private_paths: {
    source_video:
      sample.source_video.stored_private_relative_path,
    ffprobe_json:
      sample.ffprobe.status === 'ready'
        ? sample.ffprobe.raw_json_private_relative_path
        : null,
    thumbnail:
      sample.ffmpeg_derivatives.thumbnail.status === 'ready'
        ? sample.ffmpeg_derivatives.thumbnail.private_relative_path
        : null,
    audio_wav:
      sample.ffmpeg_derivatives.audio_wav.status === 'ready'
        ? sample.ffmpeg_derivatives.audio_wav.private_relative_path
        : null,
    transcript:
      sample.transcript.status === 'ready'
        ? sample.transcript.private_relative_path
        : null,
  },
  boundary: sample.governance,
  source_path_persisted: false,
  transcript_text_included: false,
}

const outputPath = argumentValue('--output')
if (outputPath) {
  await writeFile(resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`)
} else {
  console.log(JSON.stringify(report, null, 2))
}
