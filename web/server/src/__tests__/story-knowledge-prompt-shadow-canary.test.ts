import express from 'express';
import supertest from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type {
  StoryGenerateRequest,
  StoryKnowledgeEvidenceOverlayV1,
} from '@shared/types.js';
import { systemRouter } from '../routes/system.js';
import { errorHandler } from '../middleware/error-handler.js';
import { prepareChinaCultureStoryGeneration } from '../domains/china-culture/story-generation-preparation-service.js';
import { adaptLegacyChinaCultureEntryToStoryKnowledgeContract } from '../domains/china-culture/story-knowledge-contract-service.js';

process.env.KB_ROOT ??= resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
const ORIGINAL_ACCESS_MODE = process.env.STORY_AGENT_ACCESS_MODE;
const ORIGINAL_ACCESS_REGISTRY = process.env.STORY_AGENT_ACCESS_REGISTRY_JSON;

afterEach(() => {
  if (ORIGINAL_ACCESS_MODE === undefined) delete process.env.STORY_AGENT_ACCESS_MODE;
  else process.env.STORY_AGENT_ACCESS_MODE = ORIGINAL_ACCESS_MODE;
  if (ORIGINAL_ACCESS_REGISTRY === undefined) delete process.env.STORY_AGENT_ACCESS_REGISTRY_JSON;
  else process.env.STORY_AGENT_ACCESS_REGISTRY_JSON = ORIGINAL_ACCESS_REGISTRY;
});

const GENERATION_REQUEST: StoryGenerateRequest = {
  entry_name: '岳阳楼——先忧后乐的精神地标',
  video_type: 'ai_comic_drama',
  presentation_style: 'ai_comic',
  creation_use_case: 'original_ai_comic',
  truth_mode: 'fictional_original',
  original_user_query: '以岳阳楼的建筑变迁与忧乐精神为依据，创作一则守护文化记忆的故事。',
};

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/system', systemRouter);
  instance.use(errorHandler);
  return instance;
}

function requireOperatorAccess(): void {
  process.env.STORY_AGENT_ACCESS_MODE = 'required';
  process.env.STORY_AGENT_ACCESS_REGISTRY_JSON = JSON.stringify({
    schema_version: 'story-agent-product-access-registry/v1',
    actors: [
      {
        actor_id: 'admin-no-flag',
        display_name: 'admin-no-flag',
        organization_id: 'test-organization',
        role: 'administrator',
        token_sha256: createHash('sha256').update('admin-no-flag-token').digest('hex'),
        status: 'active',
        enabled_feature_flags: [],
      },
      {
        actor_id: 'admin-with-flag',
        display_name: 'admin-with-flag',
        organization_id: 'test-organization',
        role: 'administrator',
        token_sha256: createHash('sha256').update('admin-with-flag-token').digest('hex'),
        status: 'active',
        enabled_feature_flags: ['internal_story_tools'],
      },
    ],
    resource_bindings: [],
  });
}

async function approvedFixtureOverlay(): Promise<StoryKnowledgeEvidenceOverlayV1> {
  const preparation = await prepareChinaCultureStoryGeneration(GENERATION_REQUEST);
  expect(preparation.ok).toBe(true);
  if (!preparation.ok) throw new Error(preparation.message);
  const contract = adaptLegacyChinaCultureEntryToStoryKnowledgeContract(
    preparation.entry,
  ).contract;
  expect(contract.sources.length).toBeGreaterThanOrEqual(2);
  return {
    schema_version: 'story-knowledge-evidence-overlay/v1',
    overlay_id: 'fixture-restricted-canary-20260824',
    entry_name: contract.source_entry.name,
    source_reviews: contract.sources.slice(0, 2).map((source, index) => ({
      source_ref_id: source.source_ref_id,
      grade: index === 0 ? 'A' : 'B',
      verification_status: 'human_verified',
      verified_at: '2026-08-24T12:00:00+08:00',
      note: '合成 fixture 仅验证受限 canary，不授予真实人工审核信用。',
    })),
    claim_mappings: [{
      claim_id: contract.claims[0]!.claim_id,
      source_ref_ids: contract.sources.slice(0, 2).map(source => source.source_ref_id),
      claim_type: 'critical_fact',
      certainty: 'verified',
      usage: 'fact',
      scope: '合成 fixture 事实候选仅进入未执行 shadow prompt。',
    }],
    signoff: {
      status: 'approved',
      reviewed_by: 'fixture-reviewer-not-real',
      reviewer_role: 'fact_culture_reviewer',
      reviewed_at: '2026-08-24T12:00:00+08:00',
      confirmation: 'human_reviewed_story_knowledge_evidence_overlay',
    },
    boundary: {
      read_only_overlay: true,
      source_markdown_writeback_allowed: false,
      generation_consumption_allowed: false,
      existing_supplement_tasks_mutable: false,
    },
  };
}

describe('story knowledge prompt shadow canary API', () => {
  it('validates the restricted read-only canary request contract', async () => {
    const response = await supertest(app())
      .post('/api/system/story-knowledge-prompt-shadow-canary')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
      },
    });
  });

  it('requires system operation permission and the internal tools feature flag', async () => {
    requireOperatorAccess();
    const instance = app();
    const unauthenticated = await supertest(instance)
      .post('/api/system/story-knowledge-prompt-shadow-canary')
      .send({});
    expect(unauthenticated.status).toBe(401);

    const missingFlag = await supertest(instance)
      .post('/api/system/story-knowledge-prompt-shadow-canary')
      .set('authorization', 'Bearer admin-no-flag-token')
      .send({});
    expect(missingFlag.status).toBe(403);
    expect(missingFlag.body.error.details.required_feature_flag)
      .toBe('internal_story_tools');

    const admittedToValidation = await supertest(instance)
      .post('/api/system/story-knowledge-prompt-shadow-canary')
      .set('authorization', 'Bearer admin-with-flag-token')
      .send({});
    expect(admittedToValidation.status).toBe(400);
    expect(admittedToValidation.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns only hashes and an operator-review decision for a safe candidate', async () => {
    const response = await supertest(app())
      .post('/api/system/story-knowledge-prompt-shadow-canary')
      .send({
        schema_version: 'story-knowledge-prompt-shadow-canary-request/v1',
        operator_intent: 'read_only_shadow_canary',
        generation_request: GENERATION_REQUEST,
        evidence_overlay: await approvedFixtureOverlay(),
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      schema_version: 'story-knowledge-prompt-shadow-canary/v1',
      canary_status: 'evaluated',
      entry_name: GENERATION_REQUEST.entry_name,
      prompt_shadow_comparison: {
        status: 'candidate_ready',
        boundary: {
          shadow_prompt_executed: false,
          shadow_prompt_persisted: false,
          generation_output_changed: false,
        },
      },
      migration_decision: {
        decision: 'eligible_for_operator_review',
        formal_consumption_blockers: [
          'real_human_review_attestation_unavailable',
          'independent_migration_approval_unavailable',
          'production_canary_not_executed',
        ],
        boundary: {
          operator_review_only: true,
          formal_consumption_allowed: false,
          activation_performed: false,
          persistence_allowed: false,
        },
      },
      boundary: {
        restricted_operator_entry: true,
        read_only: true,
        adapter_invoked: false,
        external_model_called: false,
        local_generation_computed_in_memory: true,
        local_generation_output_discarded: true,
        local_story_result_returned: false,
        prompt_text_returned: false,
        story_persisted: false,
        project_persisted: false,
        source_markdown_written: false,
        formal_generation_consumption_allowed: false,
      },
    });
    expect(response.body.data.request_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(response.body.data).not.toHaveProperty('active_prompt_package');
    expect(response.body.data).not.toHaveProperty('shadow_prompt_package');
    expect(response.body.data).not.toHaveProperty('story_result');
  });

  it('keeps missing evidence in shadow and never turns it into an activation decision', async () => {
    const response = await supertest(app())
      .post('/api/system/story-knowledge-prompt-shadow-canary')
      .send({
        schema_version: 'story-knowledge-prompt-shadow-canary-request/v1',
        operator_intent: 'read_only_shadow_canary',
        generation_request: GENERATION_REQUEST,
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      generation_shadow: { status: 'safe_no_fact_candidates' },
      prompt_shadow_comparison: { status: 'safe_no_candidate' },
      migration_decision: {
        decision: 'remain_shadow',
        boundary: {
          formal_consumption_allowed: false,
          activation_performed: false,
        },
      },
    });
    expect(response.body.data.migration_decision.formal_consumption_blockers)
      .toContain('prompt_shadow_candidate_not_ready');
  });

  it('keeps the route behind the system operation gate and the service free of execution writes', async () => {
    const [routeSource, serviceSource, executionSource] = await Promise.all([
      readFile(new URL('../routes/system.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-knowledge-prompt-shadow-canary-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../domains/china-culture/story-generation-execution-service.ts', import.meta.url), 'utf8'),
    ]);
    expect(routeSource.indexOf("systemRouter.post(\n  '/story-knowledge-prompt-shadow-canary'"))
      .toBeGreaterThan(routeSource.indexOf('systemRouter.use((req, res, next) =>'));
    expect(serviceSource).not.toContain('generateStoryWithAdapter');
    expect(serviceSource).not.toContain('generateAndStoreChinaCultureStory');
    expect(serviceSource).not.toContain('persistGeneratedStoryAndNotifyGears');
    expect(serviceSource).not.toContain('writeFile');
    expect(executionSource).toContain('pkg: promptPackage');
    expect(executionSource).not.toContain('pkg: shadowPromptPackage');
  });
});
