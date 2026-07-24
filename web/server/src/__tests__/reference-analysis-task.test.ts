import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createReferenceLibraryRouter } from '../routes/reference-library.js';

const temporaryRoots: string[] = [];
const sourceFingerprint = 'e'.repeat(64);

async function createRequest() {
  const repoRoot = await mkdtemp(path.join(
    os.tmpdir(),
    'story-agent-reference-analysis-task-',
  ));
  temporaryRoots.push(repoRoot);
  const app = express();
  app.use(createJsonBodyParser());
  app.use('/api/reference-library', createReferenceLibraryRouter(repoRoot));
  app.use(errorHandler);
  return supertest(app);
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })),
  );
});

async function createOwnedSource(request: supertest.Agent) {
  return request.post('/api/reference-library/references').send({
    title: '用户授权分析的剧本',
    media_type: 'screenplay',
    accessed_at: '2026-07-25T09:00:00.000Z',
    rights_status: 'user_owned',
    access_scope: 'full_user_supplied',
    content_fingerprint: sourceFingerprint,
    user_reason: '创建 Codex/operator 结构化观察任务',
  });
}

function taskRequest() {
  return {
    requested_dimensions: [
      'excerpt',
      'character_design',
      'plot_structure',
      'shot_sequence',
    ],
    authorization: {
      basis: 'user_owned',
      authorization_reference: 'user-attestation-20260725',
      attested_by: 'operator-01',
      attested_at: '2026-07-25T09:05:00.000Z',
      confirmation: 'authorized_similarity_analysis_only',
    },
  };
}

function observations() {
  return {
    excerpts: [{
      observation_id: 'excerpt-01',
      source_locator: 'page-3',
      text: '他在风雨中放下钥匙，转身承认自己一直隐瞒着账本。',
    }],
    character_profiles: [{
      observation_id: 'character-01',
      label: '守门人',
      distinctive_markers: ['铜钥匙', '左手旧伤', '隐瞒账本'],
    }],
    plot_beats: [
      {
        observation_id: 'plot-01',
        order: 1,
        distinctive_markers: ['雨夜来信', '钟楼停摆'],
      },
      {
        observation_id: 'plot-02',
        order: 2,
        distinctive_markers: ['拒绝开门', '铜钥匙'],
      },
      {
        observation_id: 'plot-03',
        order: 3,
        distinctive_markers: ['承认隐瞒', '交出账本'],
      },
    ],
    shot_sequence: [
      {
        observation_id: 'shot-01',
        order: 1,
        distinctive_markers: ['俯拍雨水', '钟楼剪影'],
      },
      {
        observation_id: 'shot-02',
        order: 2,
        distinctive_markers: ['左手特写', '钥匙入画'],
      },
      {
        observation_id: 'shot-03',
        order: 3,
        distinctive_markers: ['环绕众人', '账本落桌'],
      },
    ],
  };
}

describe('reference analysis task manifest', () => {
  it('creates a source-bound operator manifest and completes it idempotently', async () => {
    const request = await createRequest();
    const source = await createOwnedSource(request);

    const created = await request
      .post(`/api/reference-library/references/${source.body.data.reference_id}/analysis-tasks`)
      .send(taskRequest());

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      schema_version: 'reference-analysis-task/v1',
      reference_id: source.body.data.reference_id,
      source_snapshot: {
        title: '用户授权分析的剧本',
        rights_status: 'user_owned',
        access_scope: 'full_user_supplied',
        content_fingerprint: sourceFingerprint,
      },
      requested_dimensions: taskRequest().requested_dimensions,
      status: 'pending',
      manifest: {
        executor: 'codex_or_operator',
        source_material_transport: 'out_of_band_user_authorized',
        server_download_allowed: false,
        input_provenance: 'operator_submitted',
        output_schema: 'reference-similarity-evidence/v1',
        prompt_injection_allowed: false,
      },
      human_review_complete: false,
      real_credit_granted: false,
    });
    expect(JSON.stringify(created.body.data)).not.toContain('source_body');
    const listed = await request.get(
      `/api/reference-library/references/${source.body.data.reference_id}/analysis-tasks`,
    );
    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual([
      expect.objectContaining({
        task_id: created.body.data.task_id,
        status: 'pending',
      }),
    ]);

    const submitted = await request
      .post(`/api/reference-library/analysis-tasks/${created.body.data.task_id}/submissions`)
      .send({
        submission_key: 'analysis-submission-01',
        observations: observations(),
      });

    expect(submitted.status).toBe(201);
    expect(submitted.body.data).toMatchObject({
      idempotent_replay: false,
      task: {
        task_id: created.body.data.task_id,
        status: 'completed',
      },
      evidence: {
        schema_version: 'reference-similarity-evidence/v1',
        analysis_task_id: created.body.data.task_id,
        reference_id: source.body.data.reference_id,
        input_provenance: 'operator_submitted',
        authorization: {
          machine_verified: false,
        },
      },
    });

    const replay = await request
      .post(`/api/reference-library/analysis-tasks/${created.body.data.task_id}/submissions`)
      .send({
        submission_key: 'analysis-submission-01',
        observations: observations(),
      });
    expect(replay.status).toBe(200);
    expect(replay.body.data).toMatchObject({
      idempotent_replay: true,
      evidence: {
        evidence_id: submitted.body.data.evidence.evidence_id,
        payload_sha256: submitted.body.data.evidence.payload_sha256,
      },
    });
    const conflictingReplay = await request
      .post(`/api/reference-library/analysis-tasks/${created.body.data.task_id}/submissions`)
      .send({
        submission_key: 'analysis-submission-02',
        observations: observations(),
      });
    expect(conflictingReplay.status).toBe(409);
    expect(conflictingReplay.body.error.code).toBe(
      'REFERENCE_ANALYSIS_TASK_CONFLICT',
    );

    const fetched = await request.get(
      `/api/reference-library/analysis-tasks/${created.body.data.task_id}`,
    );
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.status).toBe('completed');
    expect(JSON.stringify(fetched.body.data)).not.toContain(
      observations().excerpts[0].text,
    );
  });

  it('rejects unauthorized task sources and incomplete requested dimensions', async () => {
    const request = await createRequest();
    const researchOnly = await request
      .post('/api/reference-library/references')
      .send({
        title: '仅元数据参考',
        media_type: 'film',
        accessed_at: '2026-07-25T09:00:00.000Z',
        rights_status: 'research_only',
        access_scope: 'metadata_only',
        content_fingerprint: sourceFingerprint,
        user_reason: '仅研究登记',
      });
    const forbidden = await request
      .post(`/api/reference-library/references/${researchOnly.body.data.reference_id}/analysis-tasks`)
      .send({
        ...taskRequest(),
        authorization: {
          ...taskRequest().authorization,
          basis: 'public_domain',
        },
      });
    expect(forbidden.status).toBe(400);

    const owned = await createOwnedSource(request);
    const task = await request
      .post(`/api/reference-library/references/${owned.body.data.reference_id}/analysis-tasks`)
      .send(taskRequest());
    const incomplete = observations();
    incomplete.shot_sequence = [];
    const rejected = await request
      .post(`/api/reference-library/analysis-tasks/${task.body.data.task_id}/submissions`)
      .send({
        submission_key: 'analysis-submission-incomplete',
        observations: incomplete,
      });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe(
      'REFERENCE_ANALYSIS_TASK_DIMENSIONS_INVALID',
    );
  });
});
