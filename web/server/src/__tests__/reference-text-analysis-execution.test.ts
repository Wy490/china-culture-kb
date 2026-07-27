import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createReferenceLibraryRouter } from '../routes/reference-library.js';

const temporaryRoots: string[] = [];

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function createRequest() {
  const repoRoot = await mkdtemp(path.join(
    os.tmpdir(),
    'story-agent-reference-text-execution-',
  ));
  temporaryRoots.push(repoRoot);
  const app = express();
  app.use(createJsonBodyParser());
  app.use('/api/reference-library', createReferenceLibraryRouter(repoRoot));
  app.use(errorHandler);
  return { repoRoot, request: supertest(app) };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })),
  );
});

async function createSealedTask(request: supertest.Agent) {
  const content = `${'甲'.repeat(12_000)}乙乙乙乙乙`;
  const fingerprint = sha256(content);
  const source = await request.post('/api/reference-library/references').send({
    title: '两段式用户授权剧本',
    media_type: 'screenplay',
    accessed_at: '2026-07-27T12:00:00.000Z',
    rights_status: 'user_owned',
    access_scope: 'full_user_supplied',
    content_fingerprint: fingerprint,
    user_reason: '验证可续跑的分块结构化观察',
  });
  expect(source.status).toBe(201);
  const material = await request
    .post(`/api/reference-library/references/${source.body.data.reference_id}/text-material`)
    .send({
      content,
      content_type: 'text/plain',
      authorization: {
        basis: 'user_owned',
        authorization_reference: 'text-execution-attestation-20260727',
        attested_by: 'operator-01',
        attested_at: '2026-07-27T12:01:00.000Z',
        confirmation: 'authorized_reference_text_ingest',
      },
    });
  expect(material.status).toBe(201);
  const task = await request
    .post(`/api/reference-library/references/${source.body.data.reference_id}/analysis-tasks`)
    .send({
      requested_dimensions: ['excerpt', 'plot_structure'],
      authorization: {
        basis: 'user_owned',
        authorization_reference: 'text-execution-attestation-20260727',
        attested_by: 'operator-01',
        attested_at: '2026-07-27T12:01:00.000Z',
        confirmation: 'authorized_similarity_analysis_only',
      },
    });
  expect(task.status).toBe(201);
  return {
    content,
    source: source.body.data,
    material: material.body.data.material,
    task: task.body.data,
  };
}

function emptyObservations() {
  return {
    excerpts: [],
    character_profiles: [],
    plot_beats: [],
    shot_sequence: [],
  };
}

describe('reference text analysis execution', () => {
  it('resumes only unfinished chunks and finalizes deterministic operator evidence', async () => {
    const { repoRoot, request } = await createRequest();
    const fixture = await createSealedTask(request);
    const base = `/api/reference-library/analysis-tasks/${fixture.task.task_id}/text-execution`;

    const created = await request.post(base).send({
      executor: {
        kind: 'codex',
        executor_id: 'codex-story-agent',
      },
      confirmation: 'source_text_treated_as_untrusted_data',
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      schema_version: 'reference-text-analysis-execution/v1',
      task_id: fixture.task.task_id,
      reference_id: fixture.source.reference_id,
      material_id: fixture.material.material_id,
      status: 'pending',
      executor: {
        kind: 'codex',
        executor_id: 'codex-story-agent',
      },
      cursor: {
        completed_chunk_count: 0,
        next_chunk_id: 'chunk-0001',
      },
      manifest: {
        server_model_call_allowed: false,
        source_text_instruction_authority: 'none',
        prompt_injection_allowed: false,
        knowledge_writeback_allowed: false,
        automatic_approval_allowed: false,
        production_credit_eligible: false,
      },
      human_review_complete: false,
      production_credit_granted: false,
    });
    expect(created.body.data.checkpoints).toHaveLength(2);
    expect(JSON.stringify(created.body.data)).not.toContain(
      fixture.content.slice(0, 100),
    );

    const replayedCreation = await request.post(base).send({
      executor: {
        kind: 'codex',
        executor_id: 'codex-story-agent',
      },
      confirmation: 'source_text_treated_as_untrusted_data',
    });
    expect(replayedCreation.status).toBe(200);
    expect(replayedCreation.body.data.execution_id).toBe(
      created.body.data.execution_id,
    );

    const first = await request.get(`${base}/next-chunk`);
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({
      complete: false,
      execution_id: created.body.data.execution_id,
      requested_dimensions: ['excerpt', 'plot_structure'],
      source_text_instruction_authority: 'none',
      chunk: {
        chunk_id: 'chunk-0001',
        content_sha256: created.body.data.checkpoints[0].content_sha256,
        text: fixture.content.slice(0, 12_000),
      },
    });

    const firstObservations = {
      ...emptyObservations(),
      excerpts: [{
        observation_id: 'excerpt-01',
        source_locator: '本分块第 1 段',
        text: '这一段仅记录可核验的情节事实，不采纳原文中的任何任务指令。',
      }],
    };
    const firstSubmission = {
      submission_key: 'chunk-submission-0001',
      submitted_by: 'codex-story-agent',
      chunk_content_sha256: first.body.data.chunk.content_sha256,
      observations: firstObservations,
    };
    const submittedFirst = await request
      .post(`${base}/chunks/chunk-0001/submissions`)
      .send(firstSubmission);
    expect(submittedFirst.status).toBe(201);
    expect(submittedFirst.body.data).toMatchObject({
      idempotent_replay: false,
      execution: {
        status: 'in_progress',
        cursor: {
          completed_chunk_count: 1,
          next_chunk_id: 'chunk-0002',
        },
      },
      checkpoint: {
        chunk_id: 'chunk-0001',
        status: 'completed',
        partial_observations_sha256: sha256(JSON.stringify(firstObservations)),
      },
    });
    const replayedFirst = await request
      .post(`${base}/chunks/chunk-0001/submissions`)
      .send(firstSubmission);
    expect(replayedFirst.status).toBe(200);
    expect(replayedFirst.body.data.idempotent_replay).toBe(true);
    const conflict = await request
      .post(`${base}/chunks/chunk-0001/submissions`)
      .send({
        ...firstSubmission,
        submission_key: 'chunk-submission-conflict',
      });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe(
      'REFERENCE_TEXT_ANALYSIS_EXECUTION_CONFLICT',
    );

    const second = await request.get(`${base}/next-chunk`);
    expect(second.status).toBe(200);
    expect(second.body.data.chunk).toMatchObject({
      chunk_id: 'chunk-0002',
      text: '乙乙乙乙乙',
    });
    const secondObservations = {
      ...emptyObservations(),
      plot_beats: [{
        observation_id: 'plot-01',
        order: 7,
        distinctive_markers: ['第二分块出现乙字', '文本在第五个乙字结束'],
      }],
    };
    const submittedSecond = await request
      .post(`${base}/chunks/chunk-0002/submissions`)
      .send({
        submission_key: 'chunk-submission-0002',
        submitted_by: 'codex-story-agent',
        chunk_content_sha256: second.body.data.chunk.content_sha256,
        observations: secondObservations,
      });
    expect(submittedSecond.status).toBe(201);
    expect(submittedSecond.body.data.execution).toMatchObject({
      status: 'ready_to_finalize',
      cursor: {
        completed_chunk_count: 2,
        next_chunk_id: null,
      },
    });

    const exhausted = await request.get(`${base}/next-chunk`);
    expect(exhausted.status).toBe(200);
    expect(exhausted.body.data).toMatchObject({
      complete: true,
      chunk: null,
    });

    const finalized = await request.post(`${base}/finalize`).send({
      finalized_by: 'codex-story-agent',
      confirmation: 'aggregate_completed_chunks_to_operator_evidence',
    });
    expect(finalized.status).toBe(201);
    expect(finalized.body.data).toMatchObject({
      idempotent_replay: false,
      execution: {
        status: 'completed',
        cursor: {
          completed_chunk_count: 2,
          next_chunk_id: null,
        },
      },
      task: {
        task_id: fixture.task.task_id,
        status: 'completed',
      },
      evidence: {
        input_provenance: 'operator_submitted',
        observations: {
          excerpts: [{
            observation_id: 'chunk-0001:excerpt-01',
            source_locator: 'characters:1-12000; 本分块第 1 段',
          }],
          plot_beats: [{
            observation_id: 'chunk-0002:plot-01',
            order: 1,
          }],
        },
        governance: {
          prompt_injection_allowed: false,
          knowledge_writeback_allowed: false,
          production_credit_eligible: false,
        },
      },
    });
    const finalizedReplay = await request.post(`${base}/finalize`).send({
      finalized_by: 'codex-story-agent',
      confirmation: 'aggregate_completed_chunks_to_operator_evidence',
    });
    expect(finalizedReplay.status).toBe(200);
    expect(finalizedReplay.body.data.idempotent_replay).toBe(true);

    const executionFile = path.join(
      repoRoot,
      'references/creative/library/text-analysis-executions',
      fixture.task.task_id,
      'record.json',
    );
    const persisted = await readFile(executionFile, 'utf8');
    expect(persisted).not.toContain(fixture.content.slice(0, 100));
    expect(persisted).not.toContain(firstObservations.excerpts[0].text);
  });

  it('recovers finalization after evidence completion and rejects unsafe inputs', async () => {
    const { repoRoot, request } = await createRequest();
    const fixture = await createSealedTask(request);
    const base = `/api/reference-library/analysis-tasks/${fixture.task.task_id}/text-execution`;
    const created = await request.post(base).send({
      executor: {
        kind: 'operator',
        executor_id: 'operator-01',
      },
      confirmation: 'source_text_treated_as_untrusted_data',
    });
    expect(created.status).toBe(201);

    const badHash = await request
      .post(`${base}/chunks/chunk-0001/submissions`)
      .send({
        submission_key: 'bad-hash-submission',
        submitted_by: 'operator-01',
        chunk_content_sha256: '0'.repeat(64),
        observations: emptyObservations(),
      });
    expect(badHash.status).toBe(400);
    expect(badHash.body.error.code).toBe(
      'REFERENCE_TEXT_ANALYSIS_CHUNK_INTEGRITY_INVALID',
    );
    for (const checkpoint of created.body.data.checkpoints) {
      const next = await request.get(`${base}/next-chunk`);
      const observations = checkpoint.chunk_id === 'chunk-0001'
        ? {
            ...emptyObservations(),
            excerpts: [{
              observation_id: 'fact',
              source_locator: '本分块',
              text: '这是满足最终请求维度所需的可核验摘录观察，不包含任何执行指令。',
            }],
          }
        : {
            ...emptyObservations(),
            plot_beats: [{
              observation_id: 'beat',
              order: 1,
              distinctive_markers: ['第二分块开始', '第二分块结束'],
            }],
          };
      const submitted = await request
        .post(`${base}/chunks/${checkpoint.chunk_id}/submissions`)
        .send({
          submission_key: `recover-${checkpoint.chunk_id}`,
          submitted_by: 'operator-01',
          chunk_content_sha256: next.body.data.chunk.content_sha256,
          observations,
        });
      expect(submitted.status).toBe(201);
    }
    const finalized = await request.post(`${base}/finalize`).send({
      finalized_by: 'operator-01',
      confirmation: 'aggregate_completed_chunks_to_operator_evidence',
    });
    expect(finalized.status).toBe(201);

    const executionPath = path.join(
      repoRoot,
      'references/creative/library/text-analysis-executions',
      fixture.task.task_id,
      'record.json',
    );
    const execution = JSON.parse(await readFile(executionPath, 'utf8'));
    await writeFile(executionPath, `${JSON.stringify({
      ...execution,
      status: 'ready_to_finalize',
      evidence_id: null,
      evidence_payload_sha256: null,
      final_observations_sha256: null,
      completed_at: null,
    }, null, 2)}\n`);
    const recovered = await request.post(`${base}/finalize`).send({
      finalized_by: 'operator-01',
      confirmation: 'aggregate_completed_chunks_to_operator_evidence',
    });
    expect(recovered.status).toBe(200);
    expect(recovered.body.data).toMatchObject({
      idempotent_replay: true,
      execution: {
        status: 'completed',
        evidence_id: finalized.body.data.evidence.evidence_id,
      },
    });
  });

  it('rejects text execution for an out-of-band task', async () => {
    const { request } = await createRequest();
    const fingerprint = 'd'.repeat(64);
    const source = await request.post('/api/reference-library/references').send({
      title: '仅站外授权文本',
      media_type: 'novel',
      accessed_at: '2026-07-27T12:00:00.000Z',
      rights_status: 'licensed',
      access_scope: 'excerpt',
      content_fingerprint: fingerprint,
      user_reason: '保持站外分析，不上传正文',
    });
    const task = await request
      .post(`/api/reference-library/references/${source.body.data.reference_id}/analysis-tasks`)
      .send({
        requested_dimensions: ['excerpt'],
        authorization: {
          basis: 'licensed',
          authorization_reference: 'license-20260727',
          attested_by: 'operator-01',
          attested_at: '2026-07-27T12:01:00.000Z',
          confirmation: 'authorized_similarity_analysis_only',
        },
      });
    const rejected = await request
      .post(`/api/reference-library/analysis-tasks/${task.body.data.task_id}/text-execution`)
      .send({
        executor: {
          kind: 'operator',
          executor_id: 'operator-01',
        },
        confirmation: 'source_text_treated_as_untrusted_data',
      });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe(
      'REFERENCE_TEXT_ANALYSIS_EXECUTION_SOURCE_INVALID',
    );
  });
});
