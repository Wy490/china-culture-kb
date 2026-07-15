import { createHash } from 'node:crypto'

export const PLAYWRIGHT_ACCESS_TOKENS = {
  creator: 'playwright-fixture-creator-token',
  productionOperator: 'playwright-fixture-production-operator-token',
  productionOperatorWithoutFlag: 'playwright-fixture-production-operator-no-flag-token',
  culturalFactReviewer: 'playwright-fixture-cultural-fact-reviewer-token',
} as const

export const PLAYWRIGHT_OWNED_PROJECT_ID = '20260626-story-5xjg--ai_comic_drama'

function tokenSha256(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export const PLAYWRIGHT_ACCESS_REGISTRY_JSON = JSON.stringify({
  schema_version: 'story-agent-product-access-registry/v1',
  actors: [
    {
      actor_id: 'playwright-creator',
      display_name: 'Playwright Creator Fixture',
      organization_id: 'playwright-fixture',
      role: 'creator',
      token_sha256: tokenSha256(PLAYWRIGHT_ACCESS_TOKENS.creator),
      status: 'active',
      enabled_feature_flags: [],
    },
    {
      actor_id: 'playwright-production-operator',
      display_name: 'Playwright Production Operator Fixture',
      organization_id: 'playwright-fixture',
      role: 'production_operator',
      token_sha256: tokenSha256(PLAYWRIGHT_ACCESS_TOKENS.productionOperator),
      status: 'active',
      enabled_feature_flags: ['internal_story_tools'],
    },
    {
      actor_id: 'playwright-production-operator-no-flag',
      display_name: 'Playwright Production Operator No Flag Fixture',
      organization_id: 'playwright-fixture',
      role: 'production_operator',
      token_sha256: tokenSha256(PLAYWRIGHT_ACCESS_TOKENS.productionOperatorWithoutFlag),
      status: 'active',
      enabled_feature_flags: [],
    },
    {
      actor_id: 'playwright-cultural-fact-reviewer',
      display_name: 'Playwright Cultural Fact Reviewer Fixture',
      organization_id: 'playwright-fixture',
      role: 'cultural_fact_reviewer',
      token_sha256: tokenSha256(PLAYWRIGHT_ACCESS_TOKENS.culturalFactReviewer),
      status: 'active',
      enabled_feature_flags: ['internal_story_tools'],
    },
  ],
  resource_bindings: [
    {
      schema_version: 'story-agent-product-resource-ownership/v1',
      resource_type: 'story_project',
      resource_id: PLAYWRIGHT_OWNED_PROJECT_ID,
      organization_id: 'playwright-fixture',
      owner_actor_id: 'playwright-creator',
      member_actor_ids: ['playwright-production-operator'],
    },
  ],
})
