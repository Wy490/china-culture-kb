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
    'story-agent-reference-text-draft-',
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

function textAnalysis() {
  return {
    source_units: [{
      source_unit_id: 'chunk-0001',
      summary: '守门人面对来客质询，最终选择公开账本并承担后果。',
    }],
    character_wants: ['守门人想保护账本背后的秘密，同时避免伤害共同体。'],
    scene_patterns: [{
      objective: '守门人要阻止来客进入钟楼。',
      opposition: '来客持有能够证明隐瞒事实的旧信。',
      turn: '守门人主动把钥匙放到桌上。',
      visible_action: '他打开门并把账本推向众人。',
      subtext: '保护秘密已经变成逃避责任。',
    }],
    must_keep: ['钥匙从阻挡工具转为公开承担的动作载体。'],
    compression_options: ['合并重复质询，只保留旧信、钥匙和账本三次升级。'],
    adaptation_risks: ['不要把责任选择改写成外力强迫。'],
    reusable_principles: ['用同一道具在冲突前后承担相反的叙事功能。'],
    avoid_copying: ['不得复刻原作独特台词、专名或完整事件排列。'],
  };
}

async function createCompletedExecution(request: supertest.Agent) {
  const content = [
    '守门人挡在钟楼门前。来客拿出旧信，他沉默片刻。',
    '他把钥匙放到桌上，打开门，并把账本交给众人。',
  ].join('\n');
  const fingerprint = sha256(content);
  const source = await request.post('/api/reference-library/references').send({
    title: '用户授权的钟楼剧本',
    media_type: 'screenplay',
    accessed_at: '2026-07-27T13:00:00.000Z',
    rights_status: 'user_owned',
    access_scope: 'full_user_supplied',
    content_fingerprint: fingerprint,
    user_reason: '验证 evidence-bound pending text analysis',
  });
  expect(source.status).toBe(201);
  const referenceId = source.body.data.reference_id as string;
  const material = await request
    .post(`/api/reference-library/references/${referenceId}/text-material`)
    .send({
      content,
      content_type: 'text/plain',
      authorization: {
        basis: 'user_owned',
        authorization_reference: 'draft-attestation-20260727',
        attested_by: 'operator-01',
        attested_at: '2026-07-27T13:01:00.000Z',
        confirmation: 'authorized_reference_text_ingest',
      },
    });
  expect(material.status).toBe(201);
  const task = await request
    .post(`/api/reference-library/references/${referenceId}/analysis-tasks`)
    .send({
      requested_dimensions: ['excerpt'],
      authorization: {
        basis: 'user_owned',
        authorization_reference: 'draft-attestation-20260727',
        attested_by: 'operator-01',
        attested_at: '2026-07-27T13:01:00.000Z',
        confirmation: 'authorized_similarity_analysis_only',
      },
    });
  expect(task.status).toBe(201);
  const taskId = task.body.data.task_id as string;
  const executionBase =
    `/api/reference-library/analysis-tasks/${taskId}/text-execution`;
  const execution = await request.post(executionBase).send({
    executor: {
      kind: 'operator',
      executor_id: 'operator-01',
    },
    confirmation: 'source_text_treated_as_untrusted_data',
  });
  expect(execution.status).toBe(201);
  const next = await request.get(`${executionBase}/next-chunk`);
  expect(next.status).toBe(200);
  const partial = await request
    .post(`${executionBase}/chunks/chunk-0001/submissions`)
    .send({
      submission_key: 'draft-partial-chunk-0001',
      submitted_by: 'operator-01',
      chunk_content_sha256: next.body.data.chunk.content_sha256,
      observations: {
        excerpts: [{
          observation_id: 'choice',
          source_locator: '第二行',
          text: '他把钥匙放到桌上，打开门，并把账本交给众人。',
        }],
        character_profiles: [],
        plot_beats: [],
        shot_sequence: [],
      },
    });
  expect(partial.status).toBe(201);
  const finalized = await request.post(`${executionBase}/finalize`).send({
    finalized_by: 'operator-01',
    confirmation: 'aggregate_completed_chunks_to_operator_evidence',
  });
  expect(finalized.status).toBe(201);
  return {
    content,
    source: source.body.data,
    task: finalized.body.data.task,
    execution: finalized.body.data.execution,
    evidence: finalized.body.data.evidence,
  };
}

describe('reference text analysis draft task', () => {
  it('creates an evidence-bound pending analysis and keeps signing independent', async () => {
    const { repoRoot, request } = await createRequest();
    const fixture = await createCompletedExecution(request);
    const base =
      `/api/reference-library/analysis-tasks/${fixture.task.task_id}`
      + '/text-analysis-draft-task';

    const created = await request.post(base).send({
      executor: {
        kind: 'operator',
        executor_id: 'operator-01',
      },
      confirmation: 'draft_complete_text_analysis_from_verified_evidence',
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      schema_version: 'reference-text-analysis-draft-task/v1',
      analysis_task_id: fixture.task.task_id,
      text_execution_id: fixture.execution.execution_id,
      reference_id: fixture.source.reference_id,
      source_content_fingerprint: fixture.source.content_fingerprint,
      similarity_evidence_id: fixture.evidence.evidence_id,
      similarity_evidence_payload_sha256: fixture.evidence.payload_sha256,
      final_observations_sha256:
        fixture.execution.final_observations_sha256,
      status: 'pending',
      executor: {
        kind: 'operator',
        executor_id: 'operator-01',
      },
      manifest: {
        server_model_call_allowed: false,
        source_text_instruction_authority: 'none',
        output_schema: 'reference-analysis-record/v2',
        output_approval_status: 'pending',
        automatic_approval_allowed: false,
        knowledge_writeback_allowed: false,
        production_credit_eligible: false,
      },
      human_review_complete: false,
      production_credit_granted: false,
    });
    expect(JSON.stringify(created.body.data)).not.toContain(
      fixture.content.slice(0, 20),
    );
    expect(JSON.stringify(created.body.data)).not.toContain(
      fixture.evidence.observations.excerpts[0].text,
    );

    const creationReplay = await request.post(base).send({
      executor: {
        kind: 'operator',
        executor_id: 'operator-01',
      },
      confirmation: 'draft_complete_text_analysis_from_verified_evidence',
    });
    expect(creationReplay.status).toBe(200);
    expect(creationReplay.body.data.draft_task_id).toBe(
      created.body.data.draft_task_id,
    );

    const submission = {
      submission_key: 'text-analysis-draft-submission-01',
      submitted_by: 'operator-01',
      confirmation: 'submit_pending_text_reference_analysis',
      analysis: textAnalysis(),
    };
    const submitted = await request
      .post(`${base}/submissions`)
      .send(submission);
    expect(submitted.status).toBe(201);
    expect(submitted.body.data).toMatchObject({
      idempotent_replay: false,
      draft_task: {
        draft_task_id: created.body.data.draft_task_id,
        status: 'completed',
      },
      analysis: {
        schema_version: 'reference-analysis-record/v2',
        reference_id: fixture.source.reference_id,
        analysis_type: 'text',
        analysis: textAnalysis(),
        analyzed_by: 'operator-01',
        approval: {
          status: 'pending',
        },
        provenance: {
          draft_task_id: created.body.data.draft_task_id,
          analysis_task_id: fixture.task.task_id,
          text_execution_id: fixture.execution.execution_id,
          similarity_evidence_id: fixture.evidence.evidence_id,
          similarity_evidence_payload_sha256:
            fixture.evidence.payload_sha256,
          final_observations_sha256:
            fixture.execution.final_observations_sha256,
          source_content_fingerprint: fixture.source.content_fingerprint,
          input_provenance: 'operator_submitted',
          machine_verified: false,
        },
        governance: {
          prompt_injection_allowed: false,
          knowledge_writeback_allowed: false,
          production_credit_eligible: false,
        },
      },
    });
    expect(submitted.body.data.analysis).not.toHaveProperty(
      'approval.approved_by',
    );

    const replay = await request.post(`${base}/submissions`).send(submission);
    expect(replay.status).toBe(200);
    expect(replay.body.data).toMatchObject({
      idempotent_replay: true,
      analysis: {
        analysis_id: submitted.body.data.analysis.analysis_id,
        approval: { status: 'pending' },
      },
    });
    const conflict = await request.post(`${base}/submissions`).send({
      ...submission,
      submission_key: 'text-analysis-draft-conflict',
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe(
      'REFERENCE_TEXT_ANALYSIS_DRAFT_TASK_CONFLICT',
    );

    const detail = await request.get(
      `/api/reference-library/references/${fixture.source.reference_id}`,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.data.analyses).toContainEqual(
      expect.objectContaining({
        analysis_id: submitted.body.data.analysis.analysis_id,
        schema_version: 'reference-analysis-record/v2',
        approval: { status: 'pending' },
      }),
    );

    const approved = await request
      .post(
        `/api/reference-library/analyses/`
        + `${submitted.body.data.analysis.analysis_id}/approval`,
      )
      .send({
        approved_by: 'reviewer-01',
        approved_at: '2026-07-27T13:30:00.000Z',
        confirmation: 'human_reviewed_reference_analysis',
      });
    expect(approved.status).toBe(201);
    expect(approved.body.data.analysis).toMatchObject({
      schema_version: 'reference-analysis-record/v2',
      approval: {
        status: 'approved',
        approved_by: 'reviewer-01',
      },
      provenance: submitted.body.data.analysis.provenance,
    });

    const persistedDraft = await readFile(path.join(
      repoRoot,
      'references/creative/library/analysis-draft-tasks',
      `${created.body.data.draft_task_id}.json`,
    ), 'utf8');
    expect(persistedDraft).not.toContain(fixture.content.slice(0, 20));
    expect(persistedDraft).not.toContain(
      fixture.evidence.observations.excerpts[0].text,
    );

    const analysisPath = path.join(
      repoRoot,
      'references/creative/library/analyses',
      `${submitted.body.data.analysis.analysis_id}.json`,
    );
    const persistedAnalysis = JSON.parse(await readFile(analysisPath, 'utf8'));
    persistedAnalysis.analysis.source_units[0].summary = '被篡改但仍符合 schema 的摘要。';
    await writeFile(
      analysisPath,
      `${JSON.stringify(persistedAnalysis, null, 2)}\n`,
    );
    const tampered = await request.get(base);
    expect(tampered.status).toBe(400);
    expect(tampered.body.error.code).toBe(
      'REFERENCE_TEXT_ANALYSIS_DRAFT_INTEGRITY_INVALID',
    );
  });

  it('recovers after analysis persistence and rejects forged executor or approval', async () => {
    const { repoRoot, request } = await createRequest();
    const fixture = await createCompletedExecution(request);
    const base =
      `/api/reference-library/analysis-tasks/${fixture.task.task_id}`
      + '/text-analysis-draft-task';
    const created = await request.post(base).send({
      executor: {
        kind: 'codex',
        executor_id: 'codex-story-agent',
      },
      confirmation: 'draft_complete_text_analysis_from_verified_evidence',
    });
    expect(created.status).toBe(201);

    const forgedExecutor = await request.post(`${base}/submissions`).send({
      submission_key: 'forged-executor-submission',
      submitted_by: 'operator-01',
      confirmation: 'submit_pending_text_reference_analysis',
      analysis: textAnalysis(),
    });
    expect(forgedExecutor.status).toBe(400);
    expect(forgedExecutor.body.error.code).toBe(
      'REFERENCE_TEXT_ANALYSIS_DRAFT_EXECUTOR_INVALID',
    );

    const forgedApproval = await request.post(`${base}/submissions`).send({
      submission_key: 'forged-approval-submission',
      submitted_by: 'codex-story-agent',
      confirmation: 'submit_pending_text_reference_analysis',
      analysis: textAnalysis(),
      approval: {
        status: 'approved',
        approved_by: 'codex-story-agent',
      },
    });
    expect(forgedApproval.status).toBe(400);
    expect(forgedApproval.body.error.code).toBe('VALIDATION_ERROR');

    const submission = {
      submission_key: 'crash-recovery-draft-submission',
      submitted_by: 'codex-story-agent',
      confirmation: 'submit_pending_text_reference_analysis',
      analysis: textAnalysis(),
    };
    const completed = await request.post(`${base}/submissions`).send(submission);
    expect(completed.status).toBe(201);
    const draftTaskPath = path.join(
      repoRoot,
      'references/creative/library/analysis-draft-tasks',
      `${created.body.data.draft_task_id}.json`,
    );
    const draftTask = JSON.parse(await readFile(draftTaskPath, 'utf8'));
    await writeFile(draftTaskPath, `${JSON.stringify({
      ...draftTask,
      status: 'processing',
      analysis_id: null,
      completed_at: null,
    }, null, 2)}\n`);
    const recovered = await request.post(`${base}/submissions`).send(submission);
    expect(recovered.status).toBe(200);
    expect(recovered.body.data).toMatchObject({
      idempotent_replay: true,
      draft_task: {
        status: 'completed',
        analysis_id: completed.body.data.analysis.analysis_id,
      },
      analysis: {
        analysis_id: completed.body.data.analysis.analysis_id,
      },
    });
  });

  it('rejects draft task creation before evidence execution is completed', async () => {
    const { request } = await createRequest();
    const content = '尚未执行的用户授权小说段落。';
    const source = await request.post('/api/reference-library/references').send({
      title: '未完成执行的小说',
      media_type: 'novel',
      accessed_at: '2026-07-27T13:00:00.000Z',
      rights_status: 'public_domain',
      access_scope: 'excerpt',
      content_fingerprint: sha256(content),
      user_reason: '验证 draft task 必须等待 evidence',
    });
    const referenceId = source.body.data.reference_id as string;
    await request
      .post(`/api/reference-library/references/${referenceId}/text-material`)
      .send({
        content,
        content_type: 'text/plain',
        authorization: {
          basis: 'public_domain',
          authorization_reference: 'public-domain-source-20260727',
          attested_by: 'operator-01',
          attested_at: '2026-07-27T13:01:00.000Z',
          confirmation: 'authorized_reference_text_ingest',
        },
      });
    const task = await request
      .post(`/api/reference-library/references/${referenceId}/analysis-tasks`)
      .send({
        requested_dimensions: ['excerpt'],
        authorization: {
          basis: 'public_domain',
          authorization_reference: 'public-domain-source-20260727',
          attested_by: 'operator-01',
          attested_at: '2026-07-27T13:01:00.000Z',
          confirmation: 'authorized_similarity_analysis_only',
        },
      });
    const rejected = await request
      .post(
        `/api/reference-library/analysis-tasks/${task.body.data.task_id}`
        + '/text-analysis-draft-task',
      )
      .send({
        executor: {
          kind: 'operator',
          executor_id: 'operator-01',
        },
        confirmation: 'draft_complete_text_analysis_from_verified_evidence',
      });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe(
      'REFERENCE_TEXT_ANALYSIS_DRAFT_SOURCE_INVALID',
    );
  });
});
