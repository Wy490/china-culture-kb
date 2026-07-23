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

async function createRequest() {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'story-agent-reference-library-'));
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
        approval: {
          approved_by: 'editor-01',
          approved_at: '2026-07-23T09:00:00.000Z',
        },
      });
    expect(filmAnalysis.status).toBe(201);
    expect(filmAnalysis.body.data).toMatchObject({
      schema_version: 'reference-analysis-record/v1',
      reference_id: filmSource.body.data.reference_id,
      analysis_type: 'film',
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
});
