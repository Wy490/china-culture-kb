import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import supertest from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createJsonBodyParser } from '../middleware/json-body.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createReferenceLibraryRouter } from '../routes/reference-library.js';

const temporaryRoots: string[] = [];
const approvedAt = '2026-07-23T10:00:00.000Z';

async function createRequest() {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'story-agent-reference-benchmark-'));
  temporaryRoots.push(repoRoot);
  const app = express();
  app.use(createJsonBodyParser());
  app.use('/api/reference-library', createReferenceLibraryRouter(repoRoot));
  app.use(errorHandler);
  return { repoRoot, request: supertest(app) };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

async function createApprovedFilmAnalysis(request: supertest.Agent, suffix: string) {
  const source = await request.post('/api/reference-library/references').send({
    title: `影视参考 ${suffix}`,
    media_type: 'film',
    source_url: `https://example.com/film-${suffix}`,
    accessed_at: '2026-07-23T08:00:00.000Z',
    rights_status: 'research_only',
    access_scope: 'metadata_only',
    user_reason: '组合抽象叙事原则',
  });
  const analysis = await request
    .post(`/api/reference-library/references/${source.body.data.reference_id}/film-analyses`)
    .send({
      analyzed_by: `researcher-${suffix}`,
      analysis: {
        sequence_beats: [{ start: '00:00:00', end: '00:00:10', function: `建立承诺 ${suffix}` }],
        shot_observations: [{ timecode: '00:00:05', evidence_note: `可见证据 ${suffix}` }],
        continuity_methods: [`连续方法 ${suffix}`],
        reusable_principles: [`抽象原则 ${suffix}`],
        avoid_copying: [`不复制角色与镜头 ${suffix}`],
      },
    });
  const approval = await request
    .post(`/api/reference-library/analyses/${analysis.body.data.analysis_id}/approval`)
    .send({
      approved_by: `editor-${suffix}`,
      approved_at: approvedAt,
      confirmation: 'human_reviewed_reference_analysis',
    });
  return { source: source.body.data, analysis: approval.body.data.analysis };
}

describe('Reference benchmark and style-pack composition', () => {
  it('combines two approved references into traceable benchmark and style-pack records', async () => {
    const { repoRoot, request } = await createRequest();
    const first = await createApprovedFilmAnalysis(request, 'a');
    const second = await createApprovedFilmAnalysis(request, 'b');

    const benchmark = await request.post('/api/reference-library/benchmark-cards').send({
      analysis_ids: [first.analysis.analysis_id, second.analysis.analysis_id],
      target_video_type: 'ai_comic_drama',
      target_dimension: 'hook',
      principle: '先用可见异常兑现类型承诺，再延迟解释规则',
      evidence_refs: [first.analysis.analysis_id, second.analysis.analysis_id],
      created_by: 'benchmark-editor',
      approval: {
        approved_by: 'chief-editor',
        approved_at: approvedAt,
      },
    });

    expect(benchmark.status).toBe(201);
    expect(benchmark.body.data).toMatchObject({
      schema_version: 'reference-benchmark-card/v1',
      target_video_type: 'ai_comic_drama',
      target_dimension: 'hook',
      approval: { status: 'approved', approved_by: 'chief-editor' },
      governance: {
        knowledge_writeback_allowed: false,
        production_credit_eligible: false,
      },
    });
    expect(benchmark.body.data.reference_ids).toEqual([
      first.source.reference_id,
      second.source.reference_id,
    ]);

    const stylePack = await request.post('/api/reference-library/style-packs').send({
      name: '异常开场连续漫剧包',
      description: '融合两个已批准参考的抽象开场方法，不复用具体表达。',
      benchmark_card_ids: [benchmark.body.data.benchmark_id],
      compatible_video_types: ['ai_comic_drama'],
      compatible_presentation_styles: ['ai_comic'],
      compatible_story_structures: ['three_act_drama'],
      created_by: 'style-editor',
      approval: {
        approved_by: 'chief-editor',
        approved_at: approvedAt,
      },
    });

    expect(stylePack.status).toBe(201);
    expect(stylePack.body.data).toMatchObject({
      schema_version: 'reference-style-pack/v1',
      source_reference_ids: [
        first.source.reference_id,
        second.source.reference_id,
      ],
      source_analysis_ids: [
        first.analysis.analysis_id,
        second.analysis.analysis_id,
      ],
      source_benchmark_ids: [benchmark.body.data.benchmark_id],
      reusable_principles: ['先用可见异常兑现类型承诺，再延迟解释规则'],
      approval: { status: 'approved' },
      governance: {
        knowledge_writeback_allowed: false,
        production_credit_eligible: false,
      },
    });
    expect(stylePack.body.data.avoid_copying).toEqual(expect.arrayContaining([
      '不复制角色与镜头 a',
      '不复制角色与镜头 b',
    ]));

    const persisted = JSON.parse(await readFile(path.join(
      repoRoot,
      'references/creative/library/style-packs',
      `${stylePack.body.data.id}.json`,
    ), 'utf8'));
    expect(persisted).toEqual(stylePack.body.data);

    const benchmarkList = await request.get('/api/reference-library/benchmark-cards');
    const stylePackDetail = await request.get(`/api/reference-library/style-packs/${stylePack.body.data.id}`);
    expect(benchmarkList.body.data).toHaveLength(1);
    expect(stylePackDetail.body.data.id).toBe(stylePack.body.data.id);
  });

  it('rejects benchmark cards backed by pending analyses or only one distinct source', async () => {
    const { request } = await createRequest();
    const approved = await createApprovedFilmAnalysis(request, 'approved');
    const source = await request.post('/api/reference-library/references').send({
      title: '待批准参考',
      media_type: 'film',
      accessed_at: '2026-07-23T08:00:00.000Z',
      rights_status: 'unknown',
      access_scope: 'metadata_only',
      user_reason: '等待人工分析批准',
    });
    const pending = await request
      .post(`/api/reference-library/references/${source.body.data.reference_id}/film-analyses`)
      .send({
        analyzed_by: 'researcher-pending',
        analysis: {
          sequence_beats: [{ start: '00:00:00', end: '00:00:10', function: '建立承诺' }],
          shot_observations: [{ timecode: '00:00:05', evidence_note: '可见证据' }],
          continuity_methods: [],
          reusable_principles: ['待批准原则'],
          avoid_copying: ['禁止复刻'],
        },
      });

    const pendingResult = await request.post('/api/reference-library/benchmark-cards').send({
      analysis_ids: [approved.analysis.analysis_id, pending.body.data.analysis_id],
      target_video_type: 'ai_comic_drama',
      target_dimension: 'hook',
      principle: '不能提前组合待批准分析',
      evidence_refs: [approved.analysis.analysis_id, pending.body.data.analysis_id],
      created_by: 'benchmark-editor',
      approval: { approved_by: 'chief-editor', approved_at: approvedAt },
    });
    expect(pendingResult.status).toBe(409);
    expect(pendingResult.body.error.code).toBe('REFERENCE_ANALYSIS_APPROVAL_CONFLICT');

    const oneSourceResult = await request.post('/api/reference-library/benchmark-cards').send({
      analysis_ids: [approved.analysis.analysis_id, approved.analysis.analysis_id],
      target_video_type: 'ai_comic_drama',
      target_dimension: 'hook',
      principle: '不能用重复 ID 冒充两个来源',
      evidence_refs: [approved.analysis.analysis_id],
      created_by: 'benchmark-editor',
      approval: { approved_by: 'chief-editor', approved_at: approvedAt },
    });
    expect(oneSourceResult.status).toBe(400);
  });

  it('rejects style packs whose compatibility omits a benchmark target type', async () => {
    const { request } = await createRequest();
    const first = await createApprovedFilmAnalysis(request, 'first');
    const second = await createApprovedFilmAnalysis(request, 'second');
    const benchmark = await request.post('/api/reference-library/benchmark-cards').send({
      analysis_ids: [first.analysis.analysis_id, second.analysis.analysis_id],
      target_video_type: 'ai_comic_drama',
      target_dimension: 'scene',
      principle: '让每场发生可见状态变化',
      evidence_refs: [first.analysis.analysis_id, second.analysis.analysis_id],
      created_by: 'benchmark-editor',
      approval: { approved_by: 'chief-editor', approved_at: approvedAt },
    });

    const mismatch = await request.post('/api/reference-library/style-packs').send({
      name: '错误兼容范围',
      description: '不应成功',
      benchmark_card_ids: [benchmark.body.data.benchmark_id],
      compatible_video_types: ['documentary_short'],
      compatible_presentation_styles: ['documentary'],
      compatible_story_structures: ['single_event_drama'],
      created_by: 'style-editor',
      approval: { approved_by: 'chief-editor', approved_at: approvedAt },
    });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.code).toBe('REFERENCE_STYLE_PACK_COMPATIBILITY_INVALID');
  });
});
