import { readFile } from 'node:fs/promises'
import { expect, test, type Download } from 'playwright/test'
import { PLAYWRIGHT_ACCESS_TOKENS } from './product-access-fixtures'

async function readDownload(download: Download): Promise<string> {
  const downloadPath = await download.path()
  if (!downloadPath) throw new Error('download path unavailable')
  return readFile(downloadPath, 'utf8')
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

test('manifest operator queue 只读预检会清空旧结果并保持零发布信用', async ({ page }) => {
  test.setTimeout(60_000)
  const targetId = '20260619-series-0so7mqbg'
  let preflightFailure = false
  await page.route('**/api/system/story-agent-generated-governance-plan/run', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      error: null,
      data: {
        schema_version: 'story-agent-generated-governance-run/v1',
        generated_at: '2026-07-18T04:00:00.000Z',
        status: 'needs_action',
        dry_run: true,
        selected_action_count: 1,
        selected_target_count: 1,
        planned_target_count: 1,
        blocked_target_count: 0,
        skipped_target_count: 0,
        requested_action_keys: ['review_final_delivery_manifest_gaps'],
        manifest: {
          schema_version: 'story-agent-generated-governance-run-manifest/v1',
          manifest_id: 'manifest-preflight-browser-fixture',
          generated_at: '2026-07-18T04:00:00.000Z',
          dry_run: true,
          items: [{
            action_key: 'review_final_delivery_manifest_gaps',
            scope: 'ai_comic_series_project',
            project_id: targetId,
            title: '濂溪少年志',
            status: 'planned',
            planned_operation: 'operator disposition preflight',
            expected_file_changes: [],
            requires_operator_review: true,
            operator_disposition_status: 'awaiting_operator_decision',
            publishable_delivery_credit_granted: false,
            evidence: ['final_delivery_manifest_missing=true'],
          }],
        },
        before_plan_summary: {},
        notes: ['read-only browser fixture'],
        markdown: '# fixture',
      },
    }),
  }))
  await page.route('**/api/system/story-agent-final-delivery-manifest-preflight', async route => {
    if (preflightFailure) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          data: null,
          error: { code: 'INTERNAL_ERROR', message: 'fixture preflight unavailable' },
        }),
      })
      return
    }
    const request = route.request().postDataJSON() as { disposition: string }
    const preserve = request.disposition === 'preserve_fixture_exclude_from_publishable_delivery'
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        error: null,
        data: {
          schema_version: 'story-agent-final-delivery-manifest-preflight/v1',
          generated_at: '2026-07-18T04:00:01.000Z',
          series_project_id: targetId,
          disposition: request.disposition,
          status: preserve ? 'ready' : 'blocked',
          eligible_for_selected_disposition: preserve,
          operator_review_required: true,
          publishable_delivery_credit_granted: false,
          generated_files_modified: false,
          final_assemble_invoked: false,
          manifest_written: false,
          project_json_written: false,
          checks: [{
            key: 'authorized_media_inputs',
            status: preserve ? 'not_applicable' : 'failed',
            required: !preserve,
            evidence: [preserve ? 'fixture preservation' : 'placeholder_media_reference_detected=true'],
          }],
          missing_dependencies: preserve ? [] : ['authorized_media_inputs'],
          unsafe_paths: [],
          recommended_action: preserve
            ? 'Record an operator-approved signoff exclusion without publishable-delivery credit.'
            : 'Keep re-export blocked.',
          notes: ['read-only browser fixture'],
          markdown: '# fixture',
        },
      }),
    })
  })
  await page.goto('/projects')
  const activityDiagnostic = page.getByTestId('generation-activity-diagnostic')
  await expect(activityDiagnostic).toBeVisible({ timeout: 30_000 })
  const activityText = await activityDiagnostic.innerText()
  if (activityText.includes('尝试账本 uninitialized')) {
    expect(activityText).toContain('生成尝试历史不可观测')
    expect(activityText).toContain('不能确认未发起')
    expect(activityText).toContain('不能确认链路故障')
  } else {
    expect(activityText).toContain('尝试账本 ready')
    expect(activityText).toContain('历史完整性 valid')
    expect(activityText).toContain('最近请求 succeeded')
    expect(activityText).toContain('未发起确认 true')
    expect(activityText).toContain('链路故障确认 false')
  }
  await expect(activityDiagnostic).toContainText('operator 建议 no_action_required')
  await expect(activityDiagnostic).toContainText('等待 5000ms')
  await expect(activityDiagnostic).toContainText('重试 10ms')
  await expect(activityDiagnostic).toContainText('陈旧 30000ms')
  await expect(activityDiagnostic).toContainText('配置 true')
  await expect(activityDiagnostic).toContainText('权限 owner_only true')
  await expect(activityDiagnostic).toContainText('durability：file sync true')
  await expect(activityDiagnostic).toContainText('no-follow true')
  await expect(activityDiagnostic).toContainText('directory sync true')
  await expect(activityDiagnostic).toContainText('下次请求就绪 true')
  await expect(activityDiagnostic).toContainText('写入 false')
  await expect(activityDiagnostic).toContainText('模型调用 false')
  const [auditJsonDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('generation-attempt-audit-export-json').click(),
  ])
  expect(auditJsonDownload.suggestedFilename()).toBe('story-generation-attempt-audit-diagnostic.json')
  const auditJson = JSON.parse(await readDownload(auditJsonDownload)) as Record<string, unknown>
  expect(auditJson).toMatchObject({
    schema_version: 'story-generation-attempt-audit-diagnostic/v1',
    browser_memory_only: true,
    server_state_modified: false,
    automatic_repair_invoked: false,
    destructive_action_invoked: false,
    readiness: {
      configured_lock_timeout_ms: 5000,
      configured_lock_retry_ms: 10,
      configured_lock_stale_ms: 30000,
      permission_policy: 'owner_only',
      permission_policy_satisfied: true,
      event_file_sync_required: true,
      no_follow_open_required: true,
      directory_entry_sync_guaranteed: true,
    },
  })
  expect(JSON.stringify(auditJson)).not.toContain('/Users/')
  const [auditMarkdownDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('generation-attempt-audit-export-markdown').click(),
  ])
  expect(auditMarkdownDownload.suggestedFilename()).toBe('story-generation-attempt-audit-diagnostic.md')
  const auditMarkdown = await readDownload(auditMarkdownDownload)
  expect(auditMarkdown).toContain('operator_actions: no_action_required')
  expect(auditMarkdown).toContain('configured_lock_timeout_ms: 5000')
  expect(auditMarkdown).toContain('configured_lock_retry_ms: 10')
  expect(auditMarkdown).toContain('configured_lock_stale_ms: 30000')
  expect(auditMarkdown).toContain('configuration_valid: true')
  expect(auditMarkdown).toContain('configuration_warnings: none')
  expect(auditMarkdown).toContain('permission_policy: owner_only')
  expect(auditMarkdown).toContain('permission_policy_satisfied: true')
  expect(auditMarkdown).toContain('event_file_sync_required: true')
  expect(auditMarkdown).toContain('no_follow_open_required: true')
  expect(auditMarkdown).toContain('directory_entry_sync_guaranteed: true')
  expect(auditMarkdown).toContain('automatic_repair_invoked: false')
  expect(auditMarkdown).not.toContain('/Users/')
  await page.getByRole('button', { name: '生成 dry-run 清单' }).click()

  const inspector = page.getByTestId('final-delivery-manifest-preflight')
  await expect(inspector).toBeVisible({ timeout: 30_000 })
  const target = page.getByTestId('manifest-preflight-target')
  const disposition = page.getByTestId('manifest-preflight-disposition')
  const attestation = page.getByTestId('manifest-preflight-attestation')
  const runButton = page.getByTestId('manifest-preflight-run')

  await expect(target).not.toHaveValue('')
  await expect(disposition).toHaveValue('preserve_fixture_exclude_from_publishable_delivery')
  await expect(attestation).not.toBeChecked()
  await expect(attestation).toBeDisabled()

  await runButton.click()
  const result = page.getByTestId('manifest-preflight-result')
  await expect(result).toContainText('保留排除建议可复核')
  await expect(result).toContainText('发布信用 false')
  await expect(result).toContainText('final assemble false')
  await expect(result).not.toContainText('已可发布')

  const addToReview = page.getByTestId('manifest-preflight-review-add')
  await addToReview.click()
  await addToReview.click()
  const reviewPackage = page.getByTestId('manifest-preflight-review-package')
  await expect(reviewPackage).toContainText('1 项')
  await expect(reviewPackage).toContainText('preserve 1')
  await expect(reviewPackage).toContainText('ready 1')
  await expect(reviewPackage).toContainText('draft_only true')
  await expect(reviewPackage).toContainText('operator signature false')
  await expect(reviewPackage).toContainText('发布信用 false')
  await expect(reviewPackage.getByRole('button', { name: /批准|执行/ })).toHaveCount(0)

  const [jsonDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('manifest-preflight-review-export-json').click(),
  ])
  expect(jsonDownload.suggestedFilename()).toBe('story-agent-final-delivery-manifest-review-draft.json')
  const jsonDraft = JSON.parse(await readDownload(jsonDownload))
  expect(jsonDraft).toMatchObject({
    schema_version: 'story-agent-final-delivery-manifest-review-draft/v1',
    draft_only: true,
    operator_signature_present: false,
    operator_disposition_persisted: false,
    publishable_delivery_credit_granted: false,
    generated_files_modified: false,
    final_assemble_invoked: false,
    manifest_written: false,
    project_json_written: false,
    real_gears_seedance_credit_granted: false,
    summary: {
      item_count: 1,
      preserve_count: 1,
      reexport_count: 0,
      ready_count: 1,
      blocked_count: 0,
    },
  })
  expect(jsonDraft.items).toHaveLength(1)
  expect(jsonDraft.items[0]).toMatchObject({
    series_project_id: targetId,
    disposition: 'preserve_fixture_exclude_from_publishable_delivery',
    status: 'ready',
  })

  const [markdownDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('manifest-preflight-review-export-markdown').click(),
  ])
  expect(markdownDownload.suggestedFilename()).toBe('story-agent-final-delivery-manifest-review-draft.md')
  const markdownDraft = await readDownload(markdownDownload)
  expect(markdownDraft).toContain('draft_only: true')
  expect(markdownDraft).toContain('operator_signature_present: false')
  expect(markdownDraft).toContain(targetId)

  await disposition.selectOption('reexport_after_authorized_dependencies')
  await expect(result).toHaveCount(0)
  await expect(attestation).toBeEnabled()
  await attestation.check()
  await runButton.click()
  await expect(result).toContainText('预检阻断')
  await expect(result).toContainText('媒体输入授权')
  await expect(result).toContainText('failed')
  await expect(result).toContainText('generated 写入 false')
  await expect(result).toContainText('manifest 写入 false')
  await expect(result).toContainText('project.json 写入 false')
  await expect(result).not.toContainText('已可发布')
  await page.getByTestId('manifest-preflight-review-add').click()
  await expect(reviewPackage).toContainText('2 项')
  await expect(reviewPackage).toContainText('preserve 1')
  await expect(reviewPackage).toContainText('reexport 1')
  await expect(reviewPackage).toContainText('ready 1')
  await expect(reviewPackage).toContainText('blocked 1')

  await disposition.selectOption('preserve_fixture_exclude_from_publishable_delivery')
  await expect(result).toHaveCount(0)
  await expect(attestation).not.toBeChecked()

  preflightFailure = true
  await runButton.click()
  await expect(page.getByTestId('manifest-preflight-error')).toContainText('预检失败，未授予任何处置资格')
  await expect(inspector).toBeVisible()
  await expect(result).toHaveCount(0)
  await expect(page.getByTestId('manifest-preflight-review-add')).toHaveCount(0)
  await expect(reviewPackage).toContainText('2 项')

  await page.getByTestId('manifest-preflight-review-clear').click()
  await expect(reviewPackage).toHaveCount(0)

  preflightFailure = false
  await runButton.click()
  await page.getByTestId('manifest-preflight-review-add').click()
  await expect(page.getByTestId('manifest-preflight-review-package')).toContainText('1 项')
  await page.reload()
  await expect(page.getByTestId('manifest-preflight-review-package')).toHaveCount(0)
})
