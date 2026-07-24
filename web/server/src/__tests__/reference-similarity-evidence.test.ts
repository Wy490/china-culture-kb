import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  ReferenceSimilarityEvidenceRecord,
  StoryGenerateResult,
} from '@shared/types.js';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createReferenceLibraryRouter } from '../routes/reference-library.js';
import {
  evaluateReferenceGenerationSafety,
} from '../services/reference-quality-service.js';

const temporaryRoots: string[] = [];
const sourceFingerprint = 'a'.repeat(64);

async function createRequest() {
  const repoRoot = await mkdtemp(path.join(
    os.tmpdir(),
    'story-agent-reference-similarity-',
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

function evidenceRequest(inputProvenance: 'operator_submitted' | 'fixture' = 'fixture') {
  return {
    source_content_fingerprint: sourceFingerprint,
    input_provenance: inputProvenance,
    authorization: {
      basis: 'user_owned',
      authorization_reference: 'user-owned-source-attestation-20260724',
      attested_by: 'operator-01',
      attested_at: '2026-07-24T15:00:00.000Z',
      confirmation: 'authorized_similarity_analysis_only',
    },
    observations: {
      excerpts: [{
        observation_id: 'excerpt-01',
        source_locator: 'chapter-1:paragraph-3',
        text: '他把铜钥匙压在账本上，当众承认自己隐瞒了那封信。',
      }],
      character_profiles: [{
        observation_id: 'character-01',
        label: '守门人',
        distinctive_markers: ['铜钥匙', '烧伤左手', '拒绝开门', '隐瞒旧信'],
      }],
      plot_beats: [
        {
          observation_id: 'plot-01',
          order: 1,
          distinctive_markers: ['雨夜钟响', '收到旧信'],
        },
        {
          observation_id: 'plot-02',
          order: 2,
          distinctive_markers: ['铜钥匙', '拒绝开门'],
        },
        {
          observation_id: 'plot-03',
          order: 3,
          distinctive_markers: ['当众承认', '交出账本'],
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
          distinctive_markers: ['左手特写', '铜钥匙入画'],
        },
        {
          observation_id: 'shot-03',
          order: 3,
          distinctive_markers: ['环绕众人', '账本落桌'],
        },
      ],
    },
  };
}

async function createOwnedSource(request: supertest.Agent) {
  return request.post('/api/reference-library/references').send({
    title: '用户自有完整参考',
    media_type: 'screenplay',
    accessed_at: '2026-07-24T14:00:00.000Z',
    rights_status: 'user_owned',
    access_scope: 'full_user_supplied',
    content_fingerprint: sourceFingerprint,
    user_reason: '只用于授权后的相似度安全检查',
  });
}

function generatedStory(): Pick<
  StoryGenerateResult,
  'full_text' | 'logline' | 'theme' | 'scene_breakdown'
> {
  return {
    full_text: [
      '雨夜钟响后，他收到旧信。',
      '守门人用烧伤左手握住铜钥匙，拒绝开门，并继续隐瞒旧信。',
      '最后他把铜钥匙压在账本上，当众承认自己隐瞒了那封信，并交出账本。',
    ].join('\n'),
    logline: '守门人在旧信与职责之间作出选择。',
    theme: '承认比隐瞒更需要勇气。',
    scene_breakdown: [
      {
        scene_id: 1,
        title: '钟楼雨夜',
        duration_sec: 10,
        location: '钟楼',
        time_of_day: '夜晚',
        dramatic_function: '开场',
        plot: '雨夜钟响，守门人收到旧信。',
        key_action: '收到旧信',
        characters: ['守门人'],
        visual_prompt: '俯拍雨水，钟楼剪影。',
        camera_suggestion: '缓慢推进。',
        cultural_note: '',
      },
      {
        scene_id: 2,
        title: '门前拒绝',
        duration_sec: 10,
        location: '门前',
        time_of_day: '夜晚',
        dramatic_function: '对抗',
        plot: '他握住铜钥匙，拒绝开门。',
        key_action: '拒绝开门',
        characters: ['守门人'],
        visual_prompt: '烧伤左手特写，铜钥匙入画。',
        camera_suggestion: '手部特写。',
        cultural_note: '',
      },
      {
        scene_id: 3,
        title: '交出账本',
        duration_sec: 10,
        location: '堂内',
        time_of_day: '夜晚',
        dramatic_function: '选择',
        plot: '他当众承认隐瞒并交出账本。',
        key_action: '账本落桌',
        characters: ['守门人', '众人'],
        visual_prompt: '环绕众人，账本落桌。',
        camera_suggestion: '环绕后定格。',
        cultural_note: '',
      },
    ],
  };
}

describe('reference similarity evidence', () => {
  it('persists immutable authorized observations bound to the source fingerprint', async () => {
    const { repoRoot, request } = await createRequest();
    const source = await createOwnedSource(request);
    expect(source.status).toBe(201);

    const created = await request
      .post(`/api/reference-library/references/${source.body.data.reference_id}/similarity-evidence`)
      .send(evidenceRequest('operator_submitted'));

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      schema_version: 'reference-similarity-evidence/v1',
      reference_id: source.body.data.reference_id,
      source_content_fingerprint: sourceFingerprint,
      input_provenance: 'operator_submitted',
      authorization: {
        basis: 'user_owned',
        confirmation: 'authorized_similarity_analysis_only',
        machine_verified: false,
      },
      governance: {
        prompt_injection_allowed: false,
        knowledge_writeback_allowed: false,
        production_credit_eligible: false,
      },
    });
    expect(created.body.data.evidence_id).toMatch(
      /^reference-similarity-evidence-[a-f0-9-]+$/,
    );
    expect(created.body.data.payload_sha256).toMatch(/^[a-f0-9]{64}$/);

    const persisted = JSON.parse(await readFile(path.join(
      repoRoot,
      'references/creative/library/similarity-evidence',
      `${created.body.data.evidence_id}.json`,
    ), 'utf8'));
    expect(persisted).toEqual(created.body.data);

    const fetched = await request.get(
      `/api/reference-library/similarity-evidence/${created.body.data.evidence_id}`,
    );
    expect(fetched.status).toBe(200);
    expect(fetched.body.data).toEqual(created.body.data);

    persisted.observations.excerpts[0].text = '篡改后的观察文本不应通过完整性校验。';
    await writeFile(path.join(
      repoRoot,
      'references/creative/library/similarity-evidence',
      `${created.body.data.evidence_id}.json`,
    ), `${JSON.stringify(persisted, null, 2)}\n`);
    const tampered = await request.get(
      `/api/reference-library/similarity-evidence/${created.body.data.evidence_id}`,
    );
    expect(tampered.status).toBe(400);
    expect(tampered.body.error.code).toBe(
      'REFERENCE_SIMILARITY_EVIDENCE_INTEGRITY_INVALID',
    );
  });

  it('rejects research-only sources and fingerprint drift', async () => {
    const { request } = await createRequest();
    const researchOnly = await request.post('/api/reference-library/references').send({
      title: '仅研究元数据',
      media_type: 'film',
      accessed_at: '2026-07-24T14:00:00.000Z',
      rights_status: 'research_only',
      access_scope: 'metadata_only',
      content_fingerprint: sourceFingerprint,
      user_reason: '仅登记',
    });
    const forbidden = await request
      .post(`/api/reference-library/references/${researchOnly.body.data.reference_id}/similarity-evidence`)
      .send(evidenceRequest());
    expect(forbidden.status).toBe(400);
    expect(forbidden.body.error.code).toBe(
      'REFERENCE_SIMILARITY_EVIDENCE_RIGHTS_INVALID',
    );

    const owned = await createOwnedSource(request);
    const drifted = evidenceRequest();
    drifted.source_content_fingerprint = 'b'.repeat(64);
    const mismatch = await request
      .post(`/api/reference-library/references/${owned.body.data.reference_id}/similarity-evidence`)
      .send(drifted);
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.code).toBe(
      'REFERENCE_SIMILARITY_EVIDENCE_FINGERPRINT_INVALID',
    );

    const duplicateOrder = evidenceRequest();
    duplicateOrder.observations.plot_beats[1].order = 1;
    const invalidSequence = await request
      .post(`/api/reference-library/references/${owned.body.data.reference_id}/similarity-evidence`)
      .send(duplicateOrder);
    expect(invalidSequence.status).toBe(400);
  });

  it('runs all similarity dimensions without granting human or production credit', () => {
    const evidence: ReferenceSimilarityEvidenceRecord = {
      schema_version: 'reference-similarity-evidence/v1',
      evidence_id: 'reference-similarity-evidence-fixture',
      reference_id: 'reference-fixture',
      source_content_fingerprint: sourceFingerprint,
      input_provenance: 'fixture',
      authorization: {
        basis: 'user_owned',
        authorization_reference: 'fixture-only-not-real-authorization',
        attested_by: 'fixture',
        attested_at: '2026-07-24T15:00:00.000Z',
        confirmation: 'authorized_similarity_analysis_only',
        machine_verified: false,
      },
      observations: evidenceRequest().observations,
      payload_sha256: 'c'.repeat(64),
      created_at: '2026-07-24T15:00:00.000Z',
      governance: {
        prompt_injection_allowed: false,
        knowledge_writeback_allowed: false,
        production_credit_eligible: false,
      },
    };
    const report = evaluateReferenceGenerationSafety({
      generated_text: generatedStory().full_text,
      generated_story: generatedStory(),
      reference_trace: [{
        style_pack_id: 'reference-style-pack-fixture',
        application_status: 'external_prompt_injected',
        applied_rules: ['只应用抽象原则'],
        requested_rules: ['只应用抽象原则'],
        avoid_copying_rules: ['不得复制角色、情节或镜头顺序'],
        source_reference_ids: ['reference-fixture'],
        source_analysis_ids: ['analysis-fixture'],
        source_benchmark_ids: ['benchmark-fixture'],
        source_references: [{
          reference_id: 'reference-fixture',
          rights_status: 'user_owned',
          access_scope: 'full_user_supplied',
          content_fingerprint: sourceFingerprint,
        }],
        similarity_evidence_refs: [{
          evidence_id: evidence.evidence_id,
          reference_id: evidence.reference_id,
          payload_sha256: evidence.payload_sha256,
          input_provenance: 'fixture',
          dimensions: [
            'excerpt',
            'character_design',
            'plot_structure',
            'shot_sequence',
          ],
        }],
        source_story_structure: 'single_event_drama',
      }],
      similarity_evidence: [evidence],
    });

    expect(report).toMatchObject({
      status: 'blocked',
      passed: false,
      similarity: {
        status: 'completed',
        exact_long_sentence: { status: 'completed', match_count: 0 },
        near_character_overlap: { status: 'completed', match_count: 1 },
        character_design: { status: 'completed', match_count: 1 },
        plot_structure: { status: 'completed', match_count: 1 },
        shot_sequence: { status: 'completed', match_count: 1 },
        similarity_pass_credit_granted: false,
      },
      real_similarity_check_completed: false,
      real_credit_granted: false,
    });
    expect(report.issues.map(issue => issue.issue_code)).toEqual(
      expect.arrayContaining([
        'near_character_overlap',
        'character_design_similarity',
        'plot_structure_similarity',
        'shot_sequence_similarity',
      ]),
    );
  });

  it('marks only a completed operator-submitted computation as real without granting credit', () => {
    const evidence: ReferenceSimilarityEvidenceRecord = {
      schema_version: 'reference-similarity-evidence/v1',
      evidence_id: 'reference-similarity-evidence-operator-clean',
      reference_id: 'reference-operator-clean',
      source_content_fingerprint: sourceFingerprint,
      input_provenance: 'operator_submitted',
      authorization: {
        basis: 'user_owned',
        authorization_reference: 'operator-attestation-only',
        attested_by: 'operator-01',
        attested_at: '2026-07-24T15:00:00.000Z',
        confirmation: 'authorized_similarity_analysis_only',
        machine_verified: false,
      },
      observations: {
        excerpts: [{
          observation_id: 'excerpt-clean',
          source_locator: 'chapter-9',
          text: '星舰越过冰环后关闭主引擎，机械师独自修复导航阵列。',
        }],
        character_profiles: [{
          observation_id: 'character-clean',
          label: '机械师',
          distinctive_markers: ['银色义眼', '导航阵列', '失重扳手', '冰环星舰'],
        }],
        plot_beats: [1, 2, 3].map(order => ({
          observation_id: `plot-clean-${order}`,
          order,
          distinctive_markers: [`星舰阶段${order}`, `导航故障${order}`],
        })),
        shot_sequence: [1, 2, 3].map(order => ({
          observation_id: `shot-clean-${order}`,
          order,
          distinctive_markers: [`失重镜头${order}`, `冰环构图${order}`],
        })),
      },
      payload_sha256: 'd'.repeat(64),
      created_at: '2026-07-24T15:00:00.000Z',
      governance: {
        prompt_injection_allowed: false,
        knowledge_writeback_allowed: false,
        production_credit_eligible: false,
      },
    };
    const report = evaluateReferenceGenerationSafety({
      generated_text: generatedStory().full_text,
      generated_story: generatedStory(),
      reference_trace: [{
        style_pack_id: 'reference-style-pack-operator-clean',
        application_status: 'external_prompt_injected',
        applied_rules: ['只应用抽象原则'],
        avoid_copying_rules: ['不得复制角色、情节或镜头顺序'],
        source_reference_ids: [evidence.reference_id],
        source_analysis_ids: ['analysis-operator-clean'],
        source_benchmark_ids: ['benchmark-operator-clean'],
        source_references: [{
          reference_id: evidence.reference_id,
          rights_status: 'user_owned',
          access_scope: 'full_user_supplied',
          content_fingerprint: sourceFingerprint,
        }],
        similarity_evidence_refs: [{
          evidence_id: evidence.evidence_id,
          reference_id: evidence.reference_id,
          payload_sha256: evidence.payload_sha256,
          input_provenance: 'operator_submitted',
          dimensions: [
            'excerpt',
            'character_design',
            'plot_structure',
            'shot_sequence',
          ],
        }],
        source_story_structure: 'single_event_drama',
      }],
      similarity_evidence: [evidence],
    });

    expect(report).toMatchObject({
      status: 'passed_with_limits',
      passed: true,
      similarity: {
        status: 'completed',
        exact_long_sentence: { status: 'completed', match_count: 0 },
        near_character_overlap: { status: 'completed', match_count: 0 },
        character_design: { status: 'completed', match_count: 0 },
        plot_structure: { status: 'completed', match_count: 0 },
        shot_sequence: { status: 'completed', match_count: 0 },
        similarity_pass_credit_granted: false,
      },
      real_similarity_check_completed: true,
      human_review_complete: false,
      real_credit_granted: false,
    });
  });
});
