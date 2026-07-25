import { expect, test, type Page } from 'playwright/test'
import type { StoryAgentVisualAssetPressureOpsStatus } from '../shared/types'
import { PLAYWRIGHT_ACCESS_TOKENS } from './product-access-fixtures'

type PressureStateFixture = {
  status: StoryAgentVisualAssetPressureOpsStatus['status']
  label: string
  caseCount: number
  styleCount: number
  contentShaCount: number
  crossCaseReuseCount: number
  scenarioPassedCount: number
  blocker?: string
}

const PRESSURE_STATES: PressureStateFixture[] = [
  {
    status: 'ready',
    label: '已通过',
    caseCount: 8,
    styleCount: 8,
    contentShaCount: 16,
    crossCaseReuseCount: 0,
    scenarioPassedCount: 6,
  },
  {
    status: 'blocked',
    label: '已阻断',
    caseCount: 8,
    styleCount: 8,
    contentShaCount: 15,
    crossCaseReuseCount: 1,
    scenarioPassedCount: 5,
    blocker: 'cross_case_content_reuse_detected',
  },
  {
    status: 'not_run',
    label: '未运行',
    caseCount: 0,
    styleCount: 0,
    contentShaCount: 0,
    crossCaseReuseCount: 0,
    scenarioPassedCount: 0,
    blocker: 'visual_asset_pressure_report_missing',
  },
]

function pressureStatus(fixture: PressureStateFixture): StoryAgentVisualAssetPressureOpsStatus {
  const reportAvailable = fixture.status !== 'not_run'
  return {
    schema_version: 'story-agent-visual-asset-pressure-ops-status/v1',
    inspected_at: '2026-07-26T02:00:00.000Z',
    status: fixture.status,
    report: {
      relative_path: 'system/story-agent-visual-asset-pressure/report.json',
      file_exists: reportAvailable,
      schema_valid: reportAvailable,
      ...(reportAvailable ? { generated_at: '2026-07-26T01:59:00.000Z' } : {}),
    },
    coverage: {
      case_count: fixture.caseCount,
      unique_source_id_count: fixture.caseCount,
      unique_style_family_count: fixture.styleCount,
      unique_character_label_count: fixture.caseCount ? fixture.caseCount + 2 : 0,
      unique_location_label_count: fixture.caseCount,
      unique_content_sha256_count: fixture.contentShaCount,
      cross_case_content_reuse_count: fixture.crossCaseReuseCount,
      semantic_gate_passed_case_count: fixture.status === 'ready' ? fixture.caseCount : 0,
      source_content_sha256_verified_asset_count: fixture.status === 'ready' ? 31 : 0,
      media_signature_verified_asset_count: fixture.status === 'ready' ? 31 : 0,
      immutable_preview_verified_asset_count: fixture.status === 'ready' ? 31 : 0,
      identity_mapping_current_asset_count: fixture.status === 'ready' ? 31 : 0,
    },
    scenario_summary: {
      required_count: 6,
      passed_count: fixture.scenarioPassedCount,
      failed_count: fixture.status === 'blocked' ? 1 : 0,
      not_run_count: fixture.status === 'not_run' ? 6 : 0,
    },
    blockers: fixture.blocker ? [fixture.blocker] : [],
    warnings: [],
    machine_validation_only: true,
    image_provider_invoked_by_server: false,
    video_generation_performed: false,
    production_credit_granted: false,
  }
}

async function installFixtureRoutes(
  page: Page,
  fixture: PressureStateFixture,
): Promise<() => number> {
  let pressureRequestCount = 0
  await page.route(/\/api\/story-agent\/runs(?:\?.*)?$/, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      error: null,
      data: {
        schema_version: 'story-agent-run-list/v1',
        items: [],
        page: {
          limit: 20,
          scanned_count: 0,
          has_more: false,
        },
        filters: {},
        boundary: {
          full_ledgers_omitted: true,
          max_scanned_ledgers: 250,
        },
      },
    }),
  }))
  await page.route('**/api/system/story-agent-visual-asset-pressure', route => {
    pressureRequestCount += 1
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        error: null,
        data: pressureStatus(fixture),
      }),
    })
  })
  return () => pressureRequestCount
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }))
  expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(dimensions.innerWidth)
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.innerWidth)
}

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

for (const fixture of PRESSURE_STATES) {
  test(`视觉压力 ${fixture.status} 在桌面和移动端保持可读且可刷新`, async ({ page }) => {
    const runtimeErrors: string[] = []
    page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`))
    page.on('console', message => {
      if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`)
    })
    page.on('response', response => {
      if (
        response.status() >= 400
        && new URL(response.url()).pathname.startsWith('/api/')
      ) {
        runtimeErrors.push(
          `api: ${response.status()} ${response.request().method()} ${response.url()}`,
        )
      }
    })
    const pressureRequestCount = await installFixtureRoutes(page, fixture)

    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/story-agent/runs')

    const card = page.getByTestId('story-agent-visual-asset-pressure')
    await expect(card).toBeVisible()
    await expect(card.getByRole('heading', { name: `不同素材视觉压力 ${fixture.label}` }))
      .toBeVisible()
    await expect(card).toContainText(
      `${fixture.caseCount} 个题材 · ${fixture.styleCount} 种风格 · ${fixture.contentShaCount} 个唯一内容 SHA · 跨题材复用 ${fixture.crossCaseReuseCount}`,
    )
    await expect(card).toContainText(`恢复/拒绝场景 ${fixture.scenarioPassedCount}/6`)
    await expect(card).toContainText('system/story-agent-visual-asset-pressure/report.json')
    await expect(card.locator(`.status--${fixture.status}`)).toHaveText(fixture.label)
    if (fixture.blocker) {
      await expect(card.getByRole('listitem')).toHaveText(fixture.blocker)
    } else {
      await expect(card.getByRole('listitem')).toHaveCount(0)
    }
    await expect(page.locator('.run-console__truth-lock')).toContainText(
      '服务端不调用图片供应商，不生成视频，也不授予真人评审或正式发布信用。',
    )
    await expectNoHorizontalOverflow(page)

    await card.getByRole('button', { name: '刷新审计' }).click()
    await expect.poll(pressureRequestCount).toBe(2)
    await expect(card.locator(`.status--${fixture.status}`)).toHaveText(fixture.label)

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(card).toBeVisible()
    await expect(card.getByRole('button', { name: '刷新审计' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    const mobileCard = await card.boundingBox()
    expect(mobileCard).not.toBeNull()
    expect(mobileCard!.x).toBeGreaterThanOrEqual(0)
    expect(mobileCard!.width).toBeGreaterThanOrEqual(350)
    expect(mobileCard!.x + mobileCard!.width).toBeLessThanOrEqual(390)
    expect(runtimeErrors).toEqual([])
  })
}
