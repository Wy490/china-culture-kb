import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createReferenceLibraryRouter } from '../routes/reference-library.js';
import type { PrivateVideoCommandRunner } from '../services/reference-private-video-sample-service.js';

const temporaryRoots: string[] = [];

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

async function createRequest(options: {
  privateVideoCommandRunner?: PrivateVideoCommandRunner;
} = {}) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'story-agent-reference-library-'));
  temporaryRoots.push(repoRoot);
  const app = express();
  app.use(createJsonBodyParser());
  app.use('/api/reference-library', createReferenceLibraryRouter(repoRoot, options));
  app.use(errorHandler);
  return { repoRoot, request: supertest(app) };
}

function fakePrivateVideoRunner(): PrivateVideoCommandRunner {
  return async (command, args) => {
    if (command === 'ffprobe') {
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          format: {
            format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
            duration: '12.500000',
            bit_rate: '1800000',
          },
          streams: [
            {
              codec_type: 'video',
              codec_name: 'h264',
              width: 1920,
              height: 1080,
              duration: '12.500000',
              avg_frame_rate: '24/1',
            },
            {
              codec_type: 'audio',
              codec_name: 'aac',
              sample_rate: '48000',
              channels: 2,
              duration: '12.480000',
            },
          ],
        }),
        stderr: '',
      };
    }
    const outputPath = args.at(-1);
    if (typeof outputPath === 'string') {
      await writeFile(
        outputPath,
        command === 'ffmpeg' && outputPath.endsWith('.wav')
          ? Buffer.from('local wav derivative')
          : Buffer.from('local jpeg derivative'),
      );
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe('Reference Intelligence library', () => {
  it('persists auditable metadata without accepting copyrighted source bodies', async () => {
    const { repoRoot, request } = await createRequest();
    const created = await request.post('/api/reference-library/references').send({
      title: '人工录入电影参考',
      media_type: 'film',
      source_url: 'https://example.com/film',
      platform: 'Example',
      creator: '示例创作者',
      accessed_at: '2026-07-23T08:00:00.000Z',
      rights_status: 'research_only',
      access_scope: 'metadata_only',
      user_reason: '研究开场异常如何转成可见行动',
    });

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      schema_version: 'reference-source-record/v1',
      media_type: 'film',
      rights_status: 'research_only',
      access_scope: 'metadata_only',
    });
    expect(created.body.data.reference_id).toMatch(/^reference-[a-f0-9-]+$/);
    expect(created.body.data).not.toHaveProperty('content');
    expect(created.body.data).not.toHaveProperty('full_text');

    const forbiddenBody = await request.post('/api/reference-library/references').send({
      title: '不应接收正文',
      media_type: 'novel',
      accessed_at: '2026-07-23T08:00:00.000Z',
      rights_status: 'unknown',
      access_scope: 'metadata_only',
      user_reason: '只登记元数据',
      content: '未经授权的完整正文',
    });
    expect(forbiddenBody.status).toBe(400);

    const persisted = JSON.parse(await readFile(path.join(
      repoRoot,
      'references/creative/library/references',
      `${created.body.data.reference_id}.json`,
    ), 'utf8'));
    expect(persisted).toEqual(created.body.data);
  });

  it('seals local private video samples without persisting source paths or granting credit', async () => {
    const sourceRoot = await mkdtemp(path.join(os.tmpdir(), 'story-agent-private-video-source-'));
    temporaryRoots.push(sourceRoot);
    const sourcePath = path.join(sourceRoot, 'authorized-sample.mp4');
    const videoBytes = Buffer.from('private video bytes from user supplied sample');
    await writeFile(sourcePath, videoBytes);
    const { repoRoot, request } = await createRequest({
      privateVideoCommandRunner: fakePrivateVideoRunner(),
    });

    const created = await request
      .post('/api/reference-library/private-video-samples')
      .send({
        title: '用户授权私有样片',
        media_type: 'episode',
        local_video_path: sourcePath,
        rights_status: 'user_owned',
        access_scope: 'full_user_supplied',
        user_reason: '在本地提取镜头节奏和转写，不上传第三方',
        authorization: {
          basis: 'user_owned',
          authorization_reference: 'private-video-attestation-20260729',
          attested_by: 'operator-01',
          attested_at: '2026-07-29T09:00:00.000Z',
          confirmation: 'authorized_private_video_ingest',
        },
      });

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      idempotent_replay: false,
      sample: {
        schema_version: 'reference-private-video-sample/v1',
        title: '用户授权私有样片',
        media_type: 'episode',
        source_video: {
          original_filename: 'authorized-sample.mp4',
          content_sha256: sha256(videoBytes),
          byte_length: videoBytes.length,
        },
        ffprobe: {
          status: 'ready',
          duration_seconds: 12.5,
          video_streams: [{
            codec_type: 'video',
            codec_name: 'h264',
            width: 1920,
            height: 1080,
          }],
          audio_streams: [{
            codec_type: 'audio',
            codec_name: 'aac',
            channels: 2,
          }],
        },
        ffmpeg_derivatives: {
          thumbnail: { status: 'ready', kind: 'thumbnail_jpeg' },
          audio_wav: { status: 'ready', kind: 'audio_wav_16khz_mono' },
        },
        transcript: { status: 'not_submitted' },
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
      },
    });
    const serialized = JSON.stringify(created.body.data);
    expect(serialized).not.toContain(sourcePath);
    expect(serialized).not.toContain('local_video_path');
    expect(serialized).not.toContain('sourceRoot');
    expect(serialized).not.toContain('/private-video-source-');

    const storedOriginalPath = path.join(
      repoRoot,
      created.body.data.sample.source_video.stored_private_relative_path,
    );
    expect(await readFile(storedOriginalPath)).toEqual(videoBytes);
    expect(created.body.data.sample.source_video.stored_private_relative_path)
      .toContain('references/creative/private-video-samples/');
    await expect(readFile(path.join(
      repoRoot,
      'references/creative/library/references',
      `${created.body.data.sample.sample_id}.json`,
    ), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });

    const replay = await request
      .post('/api/reference-library/private-video-samples')
      .send({
        title: '用户授权私有样片',
        media_type: 'episode',
        local_video_path: sourcePath,
        rights_status: 'user_owned',
        access_scope: 'full_user_supplied',
        user_reason: '在本地提取镜头节奏和转写，不上传第三方',
        authorization: {
          basis: 'user_owned',
          authorization_reference: 'private-video-attestation-20260729',
          attested_by: 'operator-01',
          attested_at: '2026-07-29T09:00:00.000Z',
          confirmation: 'authorized_private_video_ingest',
        },
      });
    expect(replay.status).toBe(200);
    expect(replay.body.data.idempotent_replay).toBe(true);

    const conflict = await request
      .post('/api/reference-library/private-video-samples')
      .send({
        title: '用户授权私有样片',
        media_type: 'episode',
        local_video_path: sourcePath,
        rights_status: 'user_owned',
        access_scope: 'full_user_supplied',
        user_reason: '在本地提取镜头节奏和转写，不上传第三方',
        authorization: {
          basis: 'user_owned',
          authorization_reference: 'different-attestation',
          attested_by: 'operator-01',
          attested_at: '2026-07-29T09:00:00.000Z',
          confirmation: 'authorized_private_video_ingest',
        },
      });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('REFERENCE_PRIVATE_VIDEO_SAMPLE_CONFLICT');
  });

  it('rejects unsafe private video source paths before copying originals', async () => {
    const { repoRoot, request } = await createRequest({
      privateVideoCommandRunner: fakePrivateVideoRunner(),
    });
    const inRepoPath = path.join(repoRoot, 'raw-user-video.mp4');
    await writeFile(inRepoPath, 'repo-local source must be rejected');

    const rejectedInRepo = await request
      .post('/api/reference-library/private-video-samples')
      .send({
        title: '仓库内原视频',
        media_type: 'film',
        local_video_path: inRepoPath,
        rights_status: 'licensed',
        access_scope: 'excerpt',
        user_reason: '不能把仓库路径当作私有原片来源',
        authorization: {
          basis: 'licensed',
          authorization_reference: 'license-20260729',
          attested_by: 'operator-01',
          attested_at: '2026-07-29T09:00:00.000Z',
          confirmation: 'authorized_private_video_ingest',
        },
      });
    expect(rejectedInRepo.status).toBe(400);
    expect(rejectedInRepo.body.error.code).toBe(
      'REFERENCE_PRIVATE_VIDEO_SOURCE_PATH_INVALID',
    );

    const rejectedUrl = await request
      .post('/api/reference-library/private-video-samples')
      .send({
        title: '远程 URL 原视频',
        media_type: 'film',
        local_video_path: 'https://example.com/private-video.mp4',
        rights_status: 'licensed',
        access_scope: 'excerpt',
        user_reason: '不得由服务端下载或上传第三方',
        authorization: {
          basis: 'licensed',
          authorization_reference: 'license-20260729',
          attested_by: 'operator-01',
          attested_at: '2026-07-29T09:00:00.000Z',
          confirmation: 'authorized_private_video_ingest',
        },
      });
    expect(rejectedUrl.status).toBe(400);
    expect(rejectedUrl.body.error.code).toBe(
      'REFERENCE_PRIVATE_VIDEO_SOURCE_PATH_INVALID',
    );
  });

  it('seals local private transcripts without returning transcript text', async () => {
    const sourceRoot = await mkdtemp(path.join(os.tmpdir(), 'story-agent-private-video-source-'));
    temporaryRoots.push(sourceRoot);
    const sourcePath = path.join(sourceRoot, 'authorized-dialogue.mp4');
    await writeFile(sourcePath, Buffer.from('private video bytes with dialogue'));
    const { repoRoot, request } = await createRequest({
      privateVideoCommandRunner: fakePrivateVideoRunner(),
    });
    const created = await request
      .post('/api/reference-library/private-video-samples')
      .send({
        title: '用户授权转写样片',
        media_type: 'tutorial',
        local_video_path: sourcePath,
        rights_status: 'user_owned',
        access_scope: 'excerpt',
        user_reason: '只在本地转写并生成分析证据',
        authorization: {
          basis: 'user_owned',
          authorization_reference: 'private-video-transcript-attestation',
          attested_by: 'operator-01',
          attested_at: '2026-07-29T09:00:00.000Z',
          confirmation: 'authorized_private_video_ingest',
        },
      });
    const transcriptText = [
      '00:00:00 讲述者先提出问题。',
      '00:00:04 画面切到操作步骤，说明本地流程。',
    ].join('\n');
    const submitted = await request
      .post(
        `/api/reference-library/private-video-samples/${
          created.body.data.sample.sample_id
        }/transcript`,
      )
      .send({
        transcript_text: transcriptText,
        transcript_format: 'text/plain',
        transcribed_by: 'operator-01',
        transcribed_at: '2026-07-29T09:10:00.000Z',
        method: 'local_model',
        tool_name: 'local-whisper',
        tool_version: 'offline-test',
        confirmation: 'local_private_transcription_only',
      });

    expect(submitted.status).toBe(201);
    expect(submitted.body.data.sample.transcript).toMatchObject({
      status: 'ready',
      transcript_format: 'text/plain',
      content_sha256: sha256(transcriptText),
      byte_length: Buffer.byteLength(transcriptText),
      character_count: Array.from(transcriptText).length,
      line_count: 2,
      method: 'local_model',
      tool_name: 'local-whisper',
      local_transcription_performed: true,
      external_model_call_performed: false,
      third_party_upload_performed: false,
    });
    expect(JSON.stringify(submitted.body.data)).not.toContain('讲述者先提出问题');
    const transcriptPath = path.join(
      repoRoot,
      submitted.body.data.sample.transcript.private_relative_path,
    );
    expect(await readFile(transcriptPath, 'utf8')).toBe(transcriptText);

    const replay = await request
      .post(
        `/api/reference-library/private-video-samples/${
          created.body.data.sample.sample_id
        }/transcript`,
      )
      .send({
        transcript_text: transcriptText,
        transcript_format: 'text/plain',
        transcribed_by: 'operator-01',
        transcribed_at: '2026-07-29T09:10:00.000Z',
        method: 'local_model',
        tool_name: 'local-whisper',
        tool_version: 'offline-test',
        confirmation: 'local_private_transcription_only',
      });
    expect(replay.status).toBe(200);
    expect(replay.body.data.idempotent_replay).toBe(true);

    const conflict = await request
      .post(
        `/api/reference-library/private-video-samples/${
          created.body.data.sample.sample_id
        }/transcript`,
      )
      .send({
        transcript_text: `${transcriptText}\n00:00:09 新增不同文本。`,
        transcript_format: 'text/plain',
        transcribed_by: 'operator-01',
        transcribed_at: '2026-07-29T09:10:00.000Z',
        method: 'local_model',
        tool_name: 'local-whisper',
        tool_version: 'offline-test',
        confirmation: 'local_private_transcription_only',
      });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe(
      'REFERENCE_PRIVATE_VIDEO_TRANSCRIPT_CONFLICT',
    );
  });

  it('seals authorized user-supplied text and exposes bounded deterministic chunks', async () => {
    const { repoRoot, request } = await createRequest();
    const content = [
      '第一场 雨夜门房',
      '守门人把铜钥匙压在账本上，拒绝为来客开门。',
      '来客没有争辩，只把旧信放到灯下。',
      ...Array.from(
        { length: 700 },
        (_, index) => `第${index + 1}行：角色以动作推进冲突，并保留来源边界。`,
      ),
    ].join('\n');
    const contentFingerprint = sha256(content);
    const source = await request.post('/api/reference-library/references').send({
      title: '用户自有长篇剧本',
      media_type: 'screenplay',
      accessed_at: '2026-07-27T10:00:00.000Z',
      rights_status: 'user_owned',
      access_scope: 'full_user_supplied',
      content_fingerprint: contentFingerprint,
      user_reason: '逐块读取并创建可复核的结构化观察',
    });

    const absentStatus = await request.get(
      `/api/reference-library/references/${source.body.data.reference_id}/text-material/status`,
    );
    expect(absentStatus.status).toBe(200);
    expect(absentStatus.body.data).toEqual({
      available: false,
      material: null,
    });

    const uploaded = await request
      .post(`/api/reference-library/references/${source.body.data.reference_id}/text-material`)
      .send({
        content,
        content_type: 'text/plain',
        authorization: {
          basis: 'user_owned',
          authorization_reference: 'user-upload-attestation-20260727',
          attested_by: 'operator-01',
          attested_at: '2026-07-27T10:01:00.000Z',
          confirmation: 'authorized_reference_text_ingest',
        },
      });

    expect(uploaded.status).toBe(201);
    expect(uploaded.body.data).toMatchObject({
      idempotent_replay: false,
      material: {
        schema_version: 'reference-text-material/v1',
        reference_id: source.body.data.reference_id,
        source_content_fingerprint: contentFingerprint,
        content_sha256: contentFingerprint,
        content_type: 'text/plain',
        character_count: Array.from(content).length,
        line_count: 703,
        authorization: {
          basis: 'user_owned',
          machine_verified: false,
        },
        governance: {
          source_material_transport: 'stored_user_supplied',
          server_download_allowed: false,
          prompt_injection_allowed: false,
          knowledge_writeback_allowed: false,
          production_credit_eligible: false,
        },
        human_review_complete: false,
        production_credit_granted: false,
      },
    });
    expect(uploaded.body.data.material).not.toHaveProperty('content');
    expect(JSON.stringify(uploaded.body.data.material)).not.toContain(
      '守门人把铜钥匙',
    );

    const availableStatus = await request.get(
      `/api/reference-library/references/${source.body.data.reference_id}/text-material/status`,
    );
    expect(availableStatus.status).toBe(200);
    expect(availableStatus.body.data).toMatchObject({
      available: true,
      material: {
        material_id: uploaded.body.data.material.material_id,
        content_sha256: contentFingerprint,
      },
    });
    expect(JSON.stringify(availableStatus.body.data)).not.toContain(
      '守门人把铜钥匙',
    );

    const manifest = await request.get(
      `/api/reference-library/references/${source.body.data.reference_id}/text-material/manifest`,
    );
    expect(manifest.status).toBe(200);
    expect(manifest.body.data).toMatchObject({
      schema_version: 'reference-text-material-manifest/v1',
      reference_id: source.body.data.reference_id,
      source_content_fingerprint: contentFingerprint,
      content_included: false,
      chunk_count: 2,
      prompt_injection_allowed: false,
      knowledge_writeback_allowed: false,
    });
    expect(manifest.body.data.chunks).toHaveLength(2);
    expect(manifest.body.data.chunks[0]).toMatchObject({
      chunk_id: 'chunk-0001',
      index: 1,
      start_character: 1,
      end_character: 12000,
      character_count: 12000,
    });
    expect(JSON.stringify(manifest.body.data)).not.toContain('守门人把铜钥匙');

    const firstChunk = await request.get(
      `/api/reference-library/references/${source.body.data.reference_id}`
      + '/text-material/chunks/chunk-0001',
    );
    const secondChunk = await request.get(
      `/api/reference-library/references/${source.body.data.reference_id}`
      + '/text-material/chunks/chunk-0002',
    );
    expect(firstChunk.status).toBe(200);
    expect(firstChunk.body.data).toMatchObject({
      schema_version: 'reference-text-material-chunk/v1',
      chunk_id: 'chunk-0001',
      source_content_fingerprint: contentFingerprint,
      prompt_injection_allowed: false,
      knowledge_writeback_allowed: false,
    });
    expect(
      firstChunk.body.data.text + secondChunk.body.data.text,
    ).toBe(content);
    expect(firstChunk.body.data.content_sha256).toBe(
      sha256(firstChunk.body.data.text),
    );

    const replay = await request
      .post(`/api/reference-library/references/${source.body.data.reference_id}/text-material`)
      .send({
        content,
        content_type: 'text/plain',
        authorization: {
          basis: 'user_owned',
          authorization_reference: 'user-upload-attestation-20260727',
          attested_by: 'operator-01',
          attested_at: '2026-07-27T10:01:00.000Z',
          confirmation: 'authorized_reference_text_ingest',
        },
      });
    expect(replay.status).toBe(200);
    expect(replay.body.data.idempotent_replay).toBe(true);

    const storedContentPath = path.join(
      repoRoot,
      'references/creative/library/text-material',
      source.body.data.reference_id,
      'content.txt',
    );
    const storedContent = await readFile(storedContentPath, 'utf8');
    expect(storedContent).toBe(content);

    const conflictingMetadata = await request
      .post(`/api/reference-library/references/${source.body.data.reference_id}/text-material`)
      .send({
        content,
        content_type: 'text/plain',
        authorization: {
          basis: 'user_owned',
          authorization_reference: 'different-attestation',
          attested_by: 'operator-01',
          attested_at: '2026-07-27T10:01:00.000Z',
          confirmation: 'authorized_reference_text_ingest',
        },
      });
    expect(conflictingMetadata.status).toBe(409);
    expect(conflictingMetadata.body.error.code).toBe(
      'REFERENCE_TEXT_MATERIAL_CONFLICT',
    );

    await writeFile(storedContentPath, `${content}\n`);
    const corrupted = await request.get(
      `/api/reference-library/references/${source.body.data.reference_id}`
      + '/text-material/manifest',
    );
    expect(corrupted.status).toBe(400);
    expect(corrupted.body.error.code).toBe(
      'REFERENCE_TEXT_MATERIAL_INTEGRITY_INVALID',
    );
  });

  it('rejects text material without matching rights, media type, or fingerprint', async () => {
    const { request } = await createRequest();
    const content = '用户提供的短篇节选，包含明确的场景目标、阻力和行动转折。';
    const fingerprint = sha256(content);
    const metadataOnly = await request
      .post('/api/reference-library/references')
      .send({
        title: '只登记元数据的小说',
        media_type: 'novel',
        accessed_at: '2026-07-27T10:00:00.000Z',
        rights_status: 'unknown',
        access_scope: 'metadata_only',
        user_reason: '不得上传正文',
      });
    const rejectedRights = await request
      .post(`/api/reference-library/references/${metadataOnly.body.data.reference_id}/text-material`)
      .send({
        content,
        content_type: 'text/plain',
        authorization: {
          basis: 'public_domain',
          authorization_reference: 'invalid-rights-claim',
          attested_by: 'operator-01',
          attested_at: '2026-07-27T10:01:00.000Z',
          confirmation: 'authorized_reference_text_ingest',
        },
      });
    expect(rejectedRights.status).toBe(400);
    expect(rejectedRights.body.error.code).toBe(
      'REFERENCE_TEXT_MATERIAL_SOURCE_INVALID',
    );

    const film = await request.post('/api/reference-library/references').send({
      title: '用户自有影片',
      media_type: 'film',
      accessed_at: '2026-07-27T10:00:00.000Z',
      rights_status: 'user_owned',
      access_scope: 'full_user_supplied',
      content_fingerprint: fingerprint,
      user_reason: '影片不应走文本材料入口',
    });
    const rejectedMedia = await request
      .post(`/api/reference-library/references/${film.body.data.reference_id}/text-material`)
      .send({
        content,
        content_type: 'text/plain',
        authorization: {
          basis: 'user_owned',
          authorization_reference: 'user-film-attestation',
          attested_by: 'operator-01',
          attested_at: '2026-07-27T10:01:00.000Z',
          confirmation: 'authorized_reference_text_ingest',
        },
      });
    expect(rejectedMedia.status).toBe(400);
    expect(rejectedMedia.body.error.code).toBe(
      'REFERENCE_TEXT_MATERIAL_SOURCE_INVALID',
    );

    const mismatched = await request
      .post('/api/reference-library/references')
      .send({
        title: '指纹不一致的剧本',
        media_type: 'screenplay',
        accessed_at: '2026-07-27T10:00:00.000Z',
        rights_status: 'licensed',
        access_scope: 'excerpt',
        content_fingerprint: 'f'.repeat(64),
        user_reason: '必须验证 exact bytes',
      });
    const rejectedFingerprint = await request
      .post(`/api/reference-library/references/${mismatched.body.data.reference_id}/text-material`)
      .send({
        content,
        content_type: 'text/markdown',
        authorization: {
          basis: 'licensed',
          authorization_reference: 'license-contract-20260727',
          attested_by: 'operator-01',
          attested_at: '2026-07-27T10:01:00.000Z',
          confirmation: 'authorized_reference_text_ingest',
        },
      });
    expect(rejectedFingerprint.status).toBe(400);
    expect(rejectedFingerprint.body.error.code).toBe(
      'REFERENCE_TEXT_MATERIAL_FINGERPRINT_INVALID',
    );
  });

  it('creates film and text analysis cards and returns them from reference detail', async () => {
    const { request } = await createRequest();
    const filmSource = await request.post('/api/reference-library/references').send({
      title: '影视样本',
      media_type: 'episode',
      source_url: 'https://example.com/episode',
      accessed_at: '2026-07-23T08:00:00.000Z',
      rights_status: 'research_only',
      access_scope: 'metadata_only',
      user_reason: '研究首集钩子与连续性',
    });
    const textSource = await request.post('/api/reference-library/references').send({
      title: '用户自有短篇',
      media_type: 'novel',
      accessed_at: '2026-07-23T08:00:00.000Z',
      rights_status: 'user_owned',
      access_scope: 'full_user_supplied',
      content_fingerprint: 'a'.repeat(64),
      user_reason: '研究内心活动的可见化改编',
    });

    const filmAnalysis = await request
      .post(`/api/reference-library/references/${filmSource.body.data.reference_id}/film-analyses`)
      .send({
        analyzed_by: 'researcher-01',
        analysis: {
          hook_timecode: '00:00:08',
          central_question: '异常为何只在熄灯后出现？',
          sequence_beats: [{ start: '00:00:00', end: '00:00:20', function: '用异常建立系列承诺' }],
          shot_observations: [{
            timecode: '00:00:08',
            framing: '近景',
            lighting: '单一侧逆光',
            evidence_note: '灯灭后人物反应先于解释出现',
          }],
          continuity_methods: ['用固定灯具作为跨场景视觉锚点'],
          reusable_principles: ['先展示可见异常，再延迟解释世界规则'],
          avoid_copying: ['不复刻原作角色、灯具造型或镜头顺序'],
        },
      });
    expect(filmAnalysis.status).toBe(201);
    const filmApproval = await request
      .post(`/api/reference-library/analyses/${filmAnalysis.body.data.analysis_id}/approval`)
      .send({
        approved_by: 'editor-01',
        approved_at: '2026-07-23T09:00:00.000Z',
        confirmation: 'human_reviewed_reference_analysis',
      });
    expect(filmApproval.status).toBe(201);
    expect(filmAnalysis.body.data).toMatchObject({
      schema_version: 'reference-analysis-record/v1',
      reference_id: filmSource.body.data.reference_id,
      analysis_type: 'film',
      approval: { status: 'pending' },
    });
    expect(filmApproval.body.data.analysis).toMatchObject({
      analysis_id: filmAnalysis.body.data.analysis_id,
      approval: { status: 'approved', approved_by: 'editor-01' },
    });

    const textAnalysis = await request
      .post(`/api/reference-library/references/${textSource.body.data.reference_id}/text-analyses`)
      .send({
        analyzed_by: 'researcher-02',
        analysis: {
          source_units: [{ source_unit_id: 'chapter-01', summary: '主角隐藏错误决定并回避同伴追问' }],
          character_wants: ['主角想维持自己可靠的形象'],
          scene_patterns: [{
            objective: '取回会暴露错误的账本',
            opposition: '同伴已经守在档案柜前',
            turn: '主角选择当面承认错误',
            visible_action: '主角把钥匙交给同伴',
            subtext: '交钥匙等于放弃控制',
          }],
          must_keep: ['主角主动承认错误的选择'],
          compression_options: ['合并两次重复回避'],
          adaptation_risks: ['不能把心理解释全部改成旁白'],
          reusable_principles: ['把内心转折落实为不可撤回的物件交接'],
          avoid_copying: ['不复用原文台词或独特人物关系'],
        },
      });
    expect(textAnalysis.status).toBe(201);
    expect(textAnalysis.body.data).toMatchObject({
      reference_id: textSource.body.data.reference_id,
      analysis_type: 'text',
      approval: { status: 'pending' },
    });

    const detail = await request.get(`/api/reference-library/references/${filmSource.body.data.reference_id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.source.reference_id).toBe(filmSource.body.data.reference_id);
    expect(detail.body.data.analyses).toHaveLength(1);
    expect(detail.body.data.analyses[0].analysis.reusable_principles).toEqual([
      '先展示可见异常，再延迟解释世界规则',
    ]);

    const list = await request.get('/api/reference-library/references');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(2);
  });

  it('rejects media-mismatched cards and missing references', async () => {
    const { request } = await createRequest();
    const textSource = await request.post('/api/reference-library/references').send({
      title: '剧本文本',
      media_type: 'screenplay',
      accessed_at: '2026-07-23T08:00:00.000Z',
      rights_status: 'licensed',
      access_scope: 'excerpt',
      user_reason: '分析场景目标与转折',
    });

    const mismatched = await request
      .post(`/api/reference-library/references/${textSource.body.data.reference_id}/film-analyses`)
      .send({
        analyzed_by: 'researcher-01',
        analysis: {
          sequence_beats: [{ start: '00:00:00', end: '00:00:10', function: '开场' }],
          shot_observations: [{ timecode: '00:00:01', evidence_note: '画面观察' }],
          continuity_methods: [],
          reusable_principles: ['原则'],
          avoid_copying: ['禁止复刻'],
        },
      });
    expect(mismatched.status).toBe(400);
    expect(mismatched.body.error.code).toBe('REFERENCE_MEDIA_TYPE_INVALID');

    const missing = await request.get('/api/reference-library/references/reference-does-not-exist');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('REFERENCE_NOT_FOUND');
  });

  it('rejects inline analysis approval on the public review endpoint', async () => {
    const { request } = await createRequest();
    const source = await request.post('/api/reference-library/references').send({
      title: '不得内联批准的剧本',
      media_type: 'screenplay',
      accessed_at: '2026-07-25T08:00:00.000Z',
      rights_status: 'research_only',
      access_scope: 'metadata_only',
      user_reason: '验证分析与批准职责分离',
    });
    const response = await request
      .post(`/api/reference-library/references/${source.body.data.reference_id}/text-analyses`)
      .send({
        analyzed_by: 'research-editor-01',
        analysis: {
          source_units: [{ source_unit_id: 'scene-01', summary: '结构摘要' }],
          character_wants: [],
          scene_patterns: [{
            objective: '目标',
            opposition: '阻力',
            turn: '转折',
            visible_action: '动作',
          }],
          must_keep: [],
          compression_options: [],
          adaptation_risks: [],
          reusable_principles: ['抽象原则'],
          avoid_copying: ['禁止复刻'],
        },
        approval: {
          approved_by: 'research-editor-01',
          approved_at: '2026-07-25T09:00:00.000Z',
        },
      });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('REFERENCE_ANALYSIS_APPROVAL_INVALID');
  });

  it('approves a pending analysis through a deliberate idempotent review action', async () => {
    const { request } = await createRequest();
    const source = await request.post('/api/reference-library/references').send({
      title: '待独立审核剧本分析',
      media_type: 'screenplay',
      accessed_at: '2026-07-25T08:00:00.000Z',
      rights_status: 'licensed',
      access_scope: 'excerpt',
      content_fingerprint: 'b'.repeat(64),
      user_reason: '验证分析提交与批准职责分离',
    });
    const pending = await request
      .post(`/api/reference-library/references/${source.body.data.reference_id}/text-analyses`)
      .send({
        analyzed_by: 'research-editor-01',
        analysis: {
          source_units: [{ source_unit_id: 'scene-01', summary: '角色用行动暴露真实选择' }],
          character_wants: ['角色想掩盖自己的错误'],
          scene_patterns: [{
            objective: '取回关键物件',
            opposition: '同伴要求当面解释',
            turn: '角色主动交出物件',
            visible_action: '角色把物件放到桌面中央',
          }],
          must_keep: ['主动承担后果的选择'],
          compression_options: ['合并重复解释'],
          adaptation_risks: ['不能用旁白替代可见行动'],
          reusable_principles: ['把内心变化转化为不可撤回的动作'],
          avoid_copying: ['不复用原文台词和独特人物关系'],
        },
      });
    expect(pending.status).toBe(201);
    expect(pending.body.data.approval).toEqual({ status: 'pending' });

    const approvalRequest = {
      approved_by: 'cultural-reviewer-01',
      approved_at: '2026-07-25T09:00:00.000Z',
      confirmation: 'human_reviewed_reference_analysis',
    };
    const approved = await request
      .post(`/api/reference-library/analyses/${pending.body.data.analysis_id}/approval`)
      .send(approvalRequest);
    expect(approved.status).toBe(201);
    expect(approved.body.data).toMatchObject({
      idempotent_replay: false,
      analysis: {
        analysis_id: pending.body.data.analysis_id,
        approval: {
          status: 'approved',
          approved_by: 'cultural-reviewer-01',
          approved_at: '2026-07-25T09:00:00.000Z',
        },
      },
    });

    const replay = await request
      .post(`/api/reference-library/analyses/${pending.body.data.analysis_id}/approval`)
      .send(approvalRequest);
    expect(replay.status).toBe(200);
    expect(replay.body.data.idempotent_replay).toBe(true);

    const conflict = await request
      .post(`/api/reference-library/analyses/${pending.body.data.analysis_id}/approval`)
      .send({
        ...approvalRequest,
        approved_by: 'different-reviewer',
      });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('REFERENCE_ANALYSIS_APPROVAL_CONFLICT');
  });
});
