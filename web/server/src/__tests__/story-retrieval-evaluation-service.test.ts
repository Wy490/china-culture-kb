import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  StoryRetrievalEvaluationDatasetSchema,
  buildChinaCultureStoryRetrievalEvaluationReport,
  evaluateStoryRetrievalDataset,
} from '../domains/china-culture/story-retrieval-evaluation-service.js';
import {
  computeChinaCultureMatchScore,
  isChinaCultureEntryUsableForStory,
} from '../domains/china-culture/entry-match-service.js';
import { extractChinaCultureKeywords } from '../domains/china-culture/entry-language-helpers.js';
import type { SearchableEntry } from '../domains/china-culture/entry-knowledge-service.js';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const fixturePath = resolve(
  repositoryRoot,
  'data/fixtures/story-agent-rag-retrieval-evaluation-v1.json',
);

async function readDataset() {
  return StoryRetrievalEvaluationDatasetSchema.parse(
    JSON.parse(await readFile(fixturePath, 'utf8')),
  );
}

describe('story RAG retrieval evaluation', () => {
  it('separates calibrated relevance from credibility-bounded story usability', () => {
    const query = '铜胎掐丝点蓝烧蓝';
    const queryKeywords = extractChinaCultureKeywords(query);
    const entry: SearchableEntry = {
      name: '景泰蓝制作技艺——铜胎、掐丝与珐琅釉的多工序协作',
      province: '北京',
      region: '北京',
      type: '传统工艺',
      summary: '铜胎经掐丝、点蓝和烧蓝等工序形成景泰蓝器物。',
      keywords: ['景泰蓝', '铜胎', '掐丝', '点蓝', '烧蓝'],
      credibility: '基本可靠',
      story: '工匠先制铜胎，再掐丝、点蓝并分次烧蓝。',
    };
    const score = computeChinaCultureMatchScore(query, queryKeywords, entry, null);

    expect(score).toBeGreaterThan(0.62);
    expect(isChinaCultureEntryUsableForStory(query, queryKeywords, entry, score)).toBe(true);
    expect(isChinaCultureEntryUsableForStory(
      query,
      queryKeywords,
      { ...entry, credibility: '存疑' },
      score,
    )).toBe(false);
    expect(isChinaCultureEntryUsableForStory(
      entry.name,
      extractChinaCultureKeywords(entry.name),
      { ...entry, credibility: '待核实' },
      1,
    )).toBe(true);
  });

  it('computes ranked relevance and rejection metrics without granting human credit', async () => {
    const dataset = StoryRetrievalEvaluationDatasetSchema.parse({
      schema_version: 'story-agent-rag-retrieval-evaluation-dataset/v1',
      benchmark_id: 'synthetic-metric-contract',
      description: 'metric contract fixture',
      policy: {
        max_rank: 10,
        min_macro_recall_at_1: 1,
        min_macro_recall_at_3: 1,
        min_macro_recall_at_5: 1,
        min_mrr_at_10: 1,
        min_macro_ndcg_at_5: 1,
        min_top_grade_relevant_at_1_rate: 1,
        min_answerable_usable_relevant_case_rate: 1,
        max_forbidden_return_count: 0,
        max_unanswerable_candidate_count: 0,
        max_unanswerable_usable_false_positive_count: 0,
      },
      cases: [
        {
          case_id: 'ranked',
          query: 'ranked query',
          relevance: [
            { entry_name: 'A', grade: 3 },
            { entry_name: 'B', grade: 1 },
          ],
          must_not_return: [],
        },
        {
          case_id: 'off-domain',
          query: 'off-domain query',
          relevance: [],
          must_not_return: ['X'],
        },
      ],
      boundary: {
        machine_authored_fixture: true,
        human_relevance_review_complete: false,
        external_model_evaluation_complete: false,
        production_credit_granted: false,
      },
    });

    const report = await evaluateStoryRetrievalDataset(dataset, async item => (
      item.case_id === 'ranked'
        ? [
            { entry_name: 'B', score: 0.8, usable_for_story: true },
            { entry_name: 'A', score: 0.7, usable_for_story: false },
          ]
        : [{ entry_name: 'X', score: 0.8, usable_for_story: true }]
    ), { corpus_sha256: 'a'.repeat(64) });

    expect(report.metrics).toMatchObject({
      answerable_case_count: 1,
      unanswerable_case_count: 1,
      macro_recall_at_1: 0.5,
      macro_recall_at_3: 1,
      macro_recall_at_5: 1,
      mrr_at_10: 1,
      top_grade_relevant_at_1_rate: 0,
      answerable_usable_relevant_case_rate: 1,
      forbidden_return_count: 1,
      unanswerable_candidate_count: 1,
      unanswerable_usable_false_positive_count: 1,
    });
    expect(report.metrics.macro_ndcg_at_5).toBeLessThan(1);
    expect(report.status).toBe('needs_action');
    expect(report.cases.find(item => item.case_id === 'off-domain')?.issues)
      .toEqual(expect.arrayContaining([
        'forbidden_entry_returned:X',
        'unanswerable_query_returned_1_candidates',
        'unanswerable_query_returned_1_usable_candidates',
      ]));
    expect(report.boundary).toEqual({
      machine_evaluation_only: true,
      human_relevance_review_complete: false,
      external_model_evaluation_complete: false,
      production_credit_granted: false,
    });
  });

  it('binds the real fixture and corpus while rejecting off-domain lexical leakage', async () => {
    const originalKbRoot = process.env.KB_ROOT;
    process.env.KB_ROOT = resolve(repositoryRoot, 'data');
    try {
      const report = await buildChinaCultureStoryRetrievalEvaluationReport(await readDataset());

      expect(report.schema_version).toBe('story-agent-rag-retrieval-evaluation/v1');
      expect(report.dataset_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(report.corpus_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(report.metrics).toMatchObject({
        case_count: 19,
        answerable_case_count: 15,
        unanswerable_case_count: 4,
        macro_recall_at_3: 1,
        macro_recall_at_5: 1,
        mrr_at_10: 1,
        top_grade_relevant_at_1_rate: 1,
        answerable_usable_relevant_case_rate: 1,
        forbidden_return_count: 0,
        unanswerable_candidate_count: 0,
        unanswerable_usable_false_positive_count: 0,
      });
      expect(report.status).toBe('passed');
      expect(report.cases.find(item => item.case_id === 'off-domain-mars-ritual')).toMatchObject({
        returned: [],
        issues: [],
      });
    } finally {
      if (originalKbRoot === undefined) delete process.env.KB_ROOT;
      else process.env.KB_ROOT = originalKbRoot;
    }
  });
});
