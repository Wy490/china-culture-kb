import { expect, test } from 'playwright/test'
import { PLAYWRIGHT_ACCESS_TOKENS } from './product-access-fixtures'

const projectId = '20260730-story-review1--character_story'
const storyId = '20260730-story-review1'
const cohortId = 'recipe-effect-cohort-aabbccddeeff'
const membershipSha256 = 'a'.repeat(64)
const eventSha256 = 'b'.repeat(64)

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([{
    name: 'story_agent_session',
    value: PLAYWRIGHT_ACCESS_TOKENS.creator,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }])
})

test('项目工作台只接收显式真人声明并显示可复核账本事件', async ({ page }) => {
  test.setTimeout(90_000)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  let submittedBody: Record<string, unknown> | null = null
  let reviewRecorded = false
  const recordedEvent = {
    schema_version: 'story-recipe-effect-human-review-event/v1',
    event_id: 'recipe-human-review-aabbccddeeff001122334455',
    sequence: 1,
    previous_event_sha256: null,
    event_sha256: eventSha256,
    request_sha256: 'd'.repeat(64),
    idempotency_key: 'ui-human-review-0001',
    recorded_at: '2026-07-30T09:00:00.000Z',
    project_id: projectId,
    project_title: '真人评审 UI 测试',
    story_id: storyId,
    comparison: {
      comparison_payload_sha256: 'e'.repeat(64),
      baseline_story_id: '20260730-story-baseline1',
      recipe_assisted_story_id: storyId,
      recipe_id: 'feature_long_goal_payoff',
      recipe_version: '1.0.0',
      recipe_payload_sha256: 'c'.repeat(64),
    },
    cohort: {
      cohort_id: cohortId,
      membership_sha256: membershipSha256,
      report_filters: { min_comparisons_per_recipe: 1, limit: 100 },
    },
    reviewer: {
      reviewer_id: 'reviewer-ui-001',
      display_name: 'UI Reviewer',
      identity_reference: 'operator-directory:reviewer-ui-001',
    },
    review: {
      decision: 'recipe_preferred',
      rationale: '两版均已完整观看，配方版的人物目标和因果推进更清楚。',
      evidence_references: ['review-note:scene-2'],
      method: 'blind_to_machine_verdict',
    },
    attestation: {
      human_reviewer: true,
      compared_both_outputs: true,
      independent_judgment: true,
    },
    boundary: {
      human_review_recorded: true,
      aggregate_human_preference_claimed: false,
      causal_effect_proven: false,
      legal_conclusion_reached: false,
      production_credit_granted: false,
    },
  }

  await page.route('**/api/projects/recipe-effect-comparisons*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      error: null,
      data: {
        schema_version: 'story-recipe-effect-comparison-history/v1',
        filters: { recipe_id: null, video_type: null, machine_verdict: null, limit: 12 },
        summary: {
          matched_comparison_count: 1,
          returned_comparison_count: 1,
          skipped_invalid_comparison_count: 0,
          average_aggregate_delta: 12,
          verdict_counts: {
            improved: 1,
            mixed: 0,
            no_material_change: 0,
            regressed: 0,
          },
        },
        trends: [],
        items: [{
          schema_version: 'story-recipe-effect-comparison-history-item/v1',
          project_id: projectId,
          project_title: '真人评审 UI 测试',
          story_id: storyId,
          source_entry: '测试条目',
          video_type: 'character_story',
          presentation_style: 'cinematic',
          updated_at: '2026-07-30T08:00:00.000Z',
          comparison: {
            schema_version: 'story-recipe-effect-comparison/v1',
            status: 'completed',
            baseline_story_id: '20260730-story-baseline1',
            recipe_assisted_story_id: storyId,
            recipe: {
              recipe_id: 'feature_long_goal_payoff',
              recipe_version: '1.0.0',
              payload_sha256: 'c'.repeat(64),
            },
            baseline_machine_score: 60,
            recipe_assisted_machine_score: 72,
            aggregate_delta: 12,
            dimensions: [],
            machine_verdict: 'improved',
            boundary: {
              same_input_verified: true,
              machine_comparison_only: true,
              human_preference_measured: false,
              legal_conclusion_reached: false,
              production_credit_granted: false,
            },
          },
        }],
        boundary: {
          source_snapshot: 'current_project_versions',
          machine_comparison_only: true,
          human_preference_measured: false,
          causal_effect_proven: false,
          legal_conclusion_reached: false,
          production_credit_granted: false,
        },
      },
    }),
  }))

  await page.route('**/api/projects/recipe-effect-comparison-report*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      error: null,
      data: {
        schema_version: 'story-recipe-effect-machine-report/v1',
        generated_at: '2026-07-30T08:30:00.000Z',
        cohort: {
          cohort_id: cohortId,
          membership_sha256: membershipSha256,
          source_snapshot: 'current_project_versions',
          recipe_id: null,
          video_type: null,
          machine_verdict: null,
          from_updated_at: null,
          to_updated_at: null,
          min_comparisons_per_recipe: 1,
          item_limit: 100,
          source_matched_comparison_count: 1,
          candidate_comparison_count: 1,
          included_comparison_count: 1,
          excluded_below_minimum_sample_count: 0,
          source_match_truncated: false,
        },
        history: {
          filters: { recipe_id: null, video_type: null, machine_verdict: null, limit: 100 },
          summary: { matched_comparison_count: 1, returned_comparison_count: 1 },
          trends: [],
          items: [{
            project_id: projectId,
            project_title: '真人评审 UI 测试',
            story_id: storyId,
            comparison: {
              baseline_story_id: '20260730-story-baseline1',
              recipe_assisted_story_id: storyId,
              recipe: {
                recipe_id: 'feature_long_goal_payoff',
                recipe_version: '1.0.0',
                payload_sha256: 'c'.repeat(64),
              },
            },
          }],
        },
        boundary: {
          machine_comparison_only: true,
          human_preference_measured: false,
          causal_effect_proven: false,
          legal_conclusion_reached: false,
          production_credit_granted: false,
        },
        markdown: '# fixture',
      },
    }),
  }))

  await page.route('**/api/projects/recipe-effect-human-reviews*', async route => {
    if (route.request().method() === 'POST') {
      submittedBody = route.request().postDataJSON() as Record<string, unknown>
      reviewRecorded = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          error: null,
          data: {
            schema_version: 'story-recipe-effect-human-review-submit-result/v1',
            idempotent_replay: false,
            event: recordedEvent,
          },
        }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        error: null,
        data: {
          schema_version: 'story-recipe-effect-human-review-ledger/v1',
          filters: {
            project_id: null,
            story_id: null,
            reviewer_id: null,
            decision: null,
            limit: 20,
          },
          summary: {
            recorded_review_count: reviewRecorded ? 1 : 0,
            returned_review_count: reviewRecorded ? 1 : 0,
            human_reviews_recorded: reviewRecorded,
            decision_counts: {
              baseline_preferred: 0,
              recipe_preferred: reviewRecorded ? 1 : 0,
              no_preference: 0,
              insufficient_evidence: 0,
            },
          },
          entries: reviewRecorded ? [recordedEvent] : [],
          integrity: {
            chain_valid: true,
            invalid_event_count: 0,
            ledger_head_sha256: reviewRecorded ? eventSha256 : null,
          },
          boundary: {
            source: 'operator_submitted_human_reviews',
            machine_scores_inferred_as_human_judgment: false,
            aggregate_human_preference_claimed: false,
            causal_effect_proven: false,
            legal_conclusion_reached: false,
            production_credit_granted: false,
          },
        },
      }),
    })
  })

  await page.goto('/projects')
  await expect(page.getByRole('heading', { name: '创作配方真人评审账本' })).toBeVisible()
  await expect(page.getByText('尚未录入真实操作员评审')).toBeVisible()

  await page.getByRole('button', { name: '准备真人评审 cohort' }).click()
  await expect(page.getByText(cohortId, { exact: true })).toBeVisible()
  await page.getByLabel('评审对象').selectOption(`${projectId}:${storyId}`)
  await page.getByLabel('Reviewer ID', { exact: true }).fill('reviewer-ui-001')
  await page.getByLabel('Reviewer 显示名').fill('UI Reviewer')
  await page.getByLabel('Reviewer 身份记录').fill('operator-directory:reviewer-ui-001')
  await page.getByLabel('真人评审决定', { exact: true }).selectOption('recipe_preferred')
  await page.getByLabel('真人评审理由').fill(
    '两版均已完整观看，配方版的人物目标和因果推进更清楚。',
  )
  await page.getByLabel('证据引用').fill('review-note:scene-2')
  await page.getByLabel('我是真实完成评审的人类审核者').check()
  await page.getByLabel('我已完整比较基线版与配方版').check()
  await page.getByLabel('该决定来自我的独立判断').check()
  await page.getByRole('button', { name: '提交真人评审' }).click()

  await expect.poll(() => submittedBody).not.toBeNull()
  expect(submittedBody).toMatchObject({
    project_id: projectId,
    story_id: storyId,
    cohort: {
      cohort_id: cohortId,
      membership_sha256: membershipSha256,
    },
    reviewer: {
      reviewer_id: 'reviewer-ui-001',
      display_name: 'UI Reviewer',
      identity_reference: 'operator-directory:reviewer-ui-001',
    },
    review: {
      decision: 'recipe_preferred',
      method: 'blind_to_machine_verdict',
    },
    attestation: {
      human_reviewer: true,
      compared_both_outputs: true,
      independent_judgment: true,
    },
  })
  await expect(page.getByText('真人评审已写入审核账本')).toBeVisible()
  await expect(page.locator('.projects-page__human-review-event code')).toHaveText(eventSha256)
  await page.getByRole('button', { name: '复制事件哈希' }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(eventSha256)
})
