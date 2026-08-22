import { createHash } from 'node:crypto';
import { z } from 'zod';
import { collectChinaCultureSearchableEntries } from './entry-knowledge-service.js';
import { matchChinaCultureEntries } from './entry-match-service.js';

const RelevanceJudgmentSchema = z.object({
  entry_name: z.string().min(1),
  grade: z.number().int().min(1).max(3),
}).strict();

const EvaluationCaseSchema = z.object({
  case_id: z.string().min(1),
  query: z.string().min(1),
  preferred_province: z.string().min(1).optional(),
  preferred_type: z.string().min(1).optional(),
  relevance: z.array(RelevanceJudgmentSchema),
  must_not_return: z.array(z.string().min(1)),
}).strict().superRefine((value, context) => {
  const relevantNames = value.relevance.map(item => item.entry_name);
  if (new Set(relevantNames).size !== relevantNames.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['relevance'],
      message: 'relevance entry names must be unique',
    });
  }
  const overlap = value.must_not_return.filter(name => relevantNames.includes(name));
  if (overlap.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['must_not_return'],
      message: `relevant entries cannot also be forbidden: ${overlap.join(', ')}`,
    });
  }
});

const EvaluationPolicySchema = z.object({
  max_rank: z.number().int().min(5).max(50),
  min_macro_recall_at_1: z.number().min(0).max(1),
  min_macro_recall_at_3: z.number().min(0).max(1),
  min_macro_recall_at_5: z.number().min(0).max(1),
  min_mrr_at_10: z.number().min(0).max(1),
  min_macro_ndcg_at_5: z.number().min(0).max(1),
  max_forbidden_return_count: z.number().int().min(0),
  max_unanswerable_candidate_count: z.number().int().min(0),
  max_unanswerable_usable_false_positive_count: z.number().int().min(0),
}).strict();

export const StoryRetrievalEvaluationDatasetSchema = z.object({
  schema_version: z.literal('story-agent-rag-retrieval-evaluation-dataset/v1'),
  benchmark_id: z.string().min(1),
  description: z.string().min(1),
  policy: EvaluationPolicySchema,
  cases: z.array(EvaluationCaseSchema).min(1).superRefine((cases, context) => {
    const caseIds = cases.map(item => item.case_id);
    if (new Set(caseIds).size !== caseIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'case_id values must be unique',
      });
    }
    if (!cases.some(item => item.relevance.length > 0)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'at least one answerable case is required' });
    }
    if (!cases.some(item => item.relevance.length === 0)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'at least one unanswerable case is required' });
    }
  }),
  boundary: z.object({
    machine_authored_fixture: z.literal(true),
    human_relevance_review_complete: z.literal(false),
    external_model_evaluation_complete: z.literal(false),
    production_credit_granted: z.literal(false),
  }).strict(),
}).strict();

export type StoryRetrievalEvaluationDataset = z.infer<typeof StoryRetrievalEvaluationDatasetSchema>;
export type StoryRetrievalEvaluationCase = StoryRetrievalEvaluationDataset['cases'][number];

export interface StoryRetrievalRankedItem {
  entry_name: string;
  score: number;
  usable_for_story: boolean;
}

export interface StoryRetrievalEvaluationCaseReport {
  case_id: string;
  query: string;
  answerable: boolean;
  returned: StoryRetrievalRankedItem[];
  relevant_ranks: Array<{ entry_name: string; grade: number; rank: number | null }>;
  recall_at_1: number;
  recall_at_3: number;
  recall_at_5: number;
  reciprocal_rank_at_10: number;
  ndcg_at_5: number;
  usable_relevant_returned: boolean;
  forbidden_return_hits: string[];
  issues: string[];
}

export interface StoryRetrievalEvaluationReport {
  schema_version: 'story-agent-rag-retrieval-evaluation/v1';
  benchmark_id: string;
  dataset_sha256: string;
  corpus_sha256: string;
  status: 'passed' | 'needs_action';
  policy: StoryRetrievalEvaluationDataset['policy'];
  metrics: {
    case_count: number;
    answerable_case_count: number;
    unanswerable_case_count: number;
    macro_recall_at_1: number;
    macro_recall_at_3: number;
    macro_recall_at_5: number;
    mrr_at_10: number;
    macro_ndcg_at_5: number;
    answerable_usable_relevant_case_rate: number;
    forbidden_return_count: number;
    unanswerable_candidate_count: number;
    unanswerable_usable_false_positive_count: number;
  };
  gate_checks: Record<string, boolean>;
  cases: StoryRetrievalEvaluationCaseReport[];
  boundary: {
    machine_evaluation_only: true;
    human_relevance_review_complete: false;
    external_model_evaluation_complete: false;
    production_credit_granted: false;
  };
}

type Retriever = (
  item: StoryRetrievalEvaluationCase,
) => Promise<StoryRetrievalRankedItem[]>;

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function mean(values: number[]): number {
  return values.length > 0 ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function recallAt(relevantNames: Set<string>, returnedNames: string[], rank: number): number {
  if (relevantNames.size === 0) return 0;
  const hits = returnedNames.slice(0, rank).filter(name => relevantNames.has(name)).length;
  return round(hits / relevantNames.size);
}

function reciprocalRankAt(relevantNames: Set<string>, returnedNames: string[], rank: number): number {
  const firstRelevantIndex = returnedNames.slice(0, rank).findIndex(name => relevantNames.has(name));
  return firstRelevantIndex >= 0 ? round(1 / (firstRelevantIndex + 1)) : 0;
}

function discountedCumulativeGain(grades: number[]): number {
  return grades.reduce((sum, grade, index) => (
    sum + ((2 ** grade) - 1) / Math.log2(index + 2)
  ), 0);
}

function ndcgAt(
  relevanceByName: Map<string, number>,
  returnedNames: string[],
  rank: number,
): number {
  const actualGrades = returnedNames.slice(0, rank).map(name => relevanceByName.get(name) ?? 0);
  const idealGrades = [...relevanceByName.values()].sort((left, right) => right - left).slice(0, rank);
  const ideal = discountedCumulativeGain(idealGrades);
  return ideal > 0 ? round(discountedCumulativeGain(actualGrades) / ideal) : 0;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function evaluateStoryRetrievalDataset(
  rawDataset: StoryRetrievalEvaluationDataset,
  retrieve: Retriever,
  input: { corpus_sha256: string },
): Promise<StoryRetrievalEvaluationReport> {
  const dataset = StoryRetrievalEvaluationDatasetSchema.parse(rawDataset);
  const caseReports: StoryRetrievalEvaluationCaseReport[] = [];

  for (const item of dataset.cases) {
    const returned = (await retrieve(item)).slice(0, dataset.policy.max_rank);
    const returnedNames = returned.map(result => result.entry_name);
    const relevanceByName = new Map(item.relevance.map(result => [result.entry_name, result.grade]));
    const relevantNames = new Set(relevanceByName.keys());
    const answerable = relevantNames.size > 0;
    const forbiddenReturnHits = item.must_not_return.filter(name => returnedNames.includes(name));
    const recallAt1 = recallAt(relevantNames, returnedNames, 1);
    const recallAt3 = recallAt(relevantNames, returnedNames, 3);
    const recallAt5 = recallAt(relevantNames, returnedNames, 5);
    const issues = forbiddenReturnHits.map(name => `forbidden_entry_returned:${name}`);
    if (answerable && recallAt5 < 1) issues.push('relevant_entries_missing_at_5');
    if (!answerable && returned.length > 0) {
      issues.push(`unanswerable_query_returned_${returned.length}_candidates`);
    }
    const usableFalsePositiveCount = answerable
      ? 0
      : returned.filter(result => result.usable_for_story).length;
    if (usableFalsePositiveCount > 0) {
      issues.push(`unanswerable_query_returned_${usableFalsePositiveCount}_usable_candidates`);
    }

    caseReports.push({
      case_id: item.case_id,
      query: item.query,
      answerable,
      returned,
      relevant_ranks: item.relevance.map(result => {
        const rank = returnedNames.indexOf(result.entry_name);
        return { ...result, rank: rank >= 0 ? rank + 1 : null };
      }),
      recall_at_1: recallAt1,
      recall_at_3: recallAt3,
      recall_at_5: recallAt5,
      reciprocal_rank_at_10: reciprocalRankAt(relevantNames, returnedNames, 10),
      ndcg_at_5: ndcgAt(relevanceByName, returnedNames, 5),
      usable_relevant_returned: returned.some(result => (
        result.usable_for_story && relevantNames.has(result.entry_name)
      )),
      forbidden_return_hits: forbiddenReturnHits,
      issues,
    });
  }

  const answerableCases = caseReports.filter(item => item.answerable);
  const unanswerableCases = caseReports.filter(item => !item.answerable);
  const metrics = {
    case_count: caseReports.length,
    answerable_case_count: answerableCases.length,
    unanswerable_case_count: unanswerableCases.length,
    macro_recall_at_1: mean(answerableCases.map(item => item.recall_at_1)),
    macro_recall_at_3: mean(answerableCases.map(item => item.recall_at_3)),
    macro_recall_at_5: mean(answerableCases.map(item => item.recall_at_5)),
    mrr_at_10: mean(answerableCases.map(item => item.reciprocal_rank_at_10)),
    macro_ndcg_at_5: mean(answerableCases.map(item => item.ndcg_at_5)),
    answerable_usable_relevant_case_rate: mean(answerableCases.map(
      item => Number(item.usable_relevant_returned),
    )),
    forbidden_return_count: caseReports.reduce((sum, item) => sum + item.forbidden_return_hits.length, 0),
    unanswerable_candidate_count: unanswerableCases.reduce((sum, item) => sum + item.returned.length, 0),
    unanswerable_usable_false_positive_count: unanswerableCases.reduce(
      (sum, item) => sum + item.returned.filter(result => result.usable_for_story).length,
      0,
    ),
  };
  const gateChecks = {
    macro_recall_at_1: metrics.macro_recall_at_1 >= dataset.policy.min_macro_recall_at_1,
    macro_recall_at_3: metrics.macro_recall_at_3 >= dataset.policy.min_macro_recall_at_3,
    macro_recall_at_5: metrics.macro_recall_at_5 >= dataset.policy.min_macro_recall_at_5,
    mrr_at_10: metrics.mrr_at_10 >= dataset.policy.min_mrr_at_10,
    macro_ndcg_at_5: metrics.macro_ndcg_at_5 >= dataset.policy.min_macro_ndcg_at_5,
    forbidden_return_count: metrics.forbidden_return_count <= dataset.policy.max_forbidden_return_count,
    unanswerable_candidate_count: metrics.unanswerable_candidate_count <= dataset.policy.max_unanswerable_candidate_count,
    unanswerable_usable_false_positive_count: metrics.unanswerable_usable_false_positive_count
      <= dataset.policy.max_unanswerable_usable_false_positive_count,
  };

  return {
    schema_version: 'story-agent-rag-retrieval-evaluation/v1',
    benchmark_id: dataset.benchmark_id,
    dataset_sha256: sha256(JSON.stringify(dataset)),
    corpus_sha256: input.corpus_sha256,
    status: Object.values(gateChecks).every(Boolean) ? 'passed' : 'needs_action',
    policy: dataset.policy,
    metrics,
    gate_checks: gateChecks,
    cases: caseReports,
    boundary: {
      machine_evaluation_only: true,
      human_relevance_review_complete: false,
      external_model_evaluation_complete: false,
      production_credit_granted: false,
    },
  };
}

export async function buildChinaCultureStoryRetrievalEvaluationReport(
  rawDataset: StoryRetrievalEvaluationDataset,
): Promise<StoryRetrievalEvaluationReport> {
  const dataset = StoryRetrievalEvaluationDatasetSchema.parse(rawDataset);
  const corpus = await collectChinaCultureSearchableEntries();
  const corpusSha256 = sha256(JSON.stringify(
    corpus
      .map(entry => ({
        name: entry.name,
        province: entry.province,
        region: entry.region,
        type: entry.type,
        summary: entry.summary,
        keywords: entry.keywords,
        story: entry.story,
        cultural_significance: entry.culturalSignificance,
        related_locations: entry.relatedLocationText,
        local_creative_relations: entry.localCreativeRelationText,
      }))
      .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0)),
  ));

  return evaluateStoryRetrievalDataset(dataset, async item => {
    const response = await matchChinaCultureEntries({
      query: item.query,
      limit: dataset.policy.max_rank,
      preferred_province: item.preferred_province,
      preferred_type: item.preferred_type,
    });
    if (!response.ok || !response.data) {
      throw new Error(`Retrieval benchmark case failed: ${item.case_id}`);
    }
    return response.data.matches.map(match => ({
      entry_name: match.entry_name,
      score: match.score,
      usable_for_story: match.usable_for_story,
    }));
  }, { corpus_sha256: corpusSha256 });
}
