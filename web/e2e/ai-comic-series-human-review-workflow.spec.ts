import { readFile } from 'node:fs/promises'
import { expect, test } from 'playwright/test'
import { PLAYWRIGHT_ACCESS_TOKENS } from './product-access-fixtures'

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

test('真人盲评以三步向导区分双文件发送与单 JSON 导入', async ({ page }) => {
  test.setTimeout(90_000)
  const seriesProjectId = 'ui-review-fixture'
  await page.route(`**/api/story-outline/ai-comic-series-projects/${seriesProjectId}`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      error: null,
      data: {
        project: {
          series_project_id: seriesProjectId,
          title: '盲评向导测试系列',
          episode_count: 1,
          episode_duration_range_sec: { min: 60, max: 90 },
          pacing_profile: 'balanced_drama',
          logline: '测试三步真人盲评向导。',
          created_at: '2026-07-21T00:00:00.000Z',
          updated_at: '2026-07-21T00:00:00.000Z',
          generated_episode_count: 1,
        },
        plan: {
          schema_version: 'ai-comic-series-plan/v1',
          series_title: '盲评向导测试系列',
          episode_count: 1,
          episode_duration_range_sec: { min: 60, max: 90 },
          pacing_profile: 'balanced_drama',
          generation_scope: 'full_planning',
          premise: '一个只用于界面验收的匿名候选。',
          logline: '测试三步真人盲评向导。',
          core_theme: '职责分离',
          main_characters: [],
          plot_threads: [],
          phases: [],
          episodes: [{
            episode_no: 1,
            title: '代表集',
            target_duration_sec: 60,
            target_panel_count: 8,
            story_phase: 'opening',
            main_conflict: '完成盲评',
            key_characters: [],
            continuity_from_previous: [],
            new_information: [],
            foreshadowing: [],
            payoff: [],
            ending_hook: '等待真人回执',
            knowledge_focus: [],
            continuity_state_after: [],
          }],
          continuity_rules: [],
          recurring_motifs: [],
          production_notes: [],
        },
        generated_episode_story_ids: { 1: 'ui-review-story-fixture' },
        continuity_ledger: {
          schema_version: 'ai-comic-continuity-ledger/v1',
          character_state_current: [],
          open_threads: [],
          paid_off_threads: [],
          knowledge_used: [],
          episode_records: [],
        },
        seedance_production: {
          schema_version: 'ai-comic-seedance-production-ledger/v1',
          updated_at: '2026-07-21T00:10:00.000Z',
          items: [{
            production_id: 'seedance-e1-shot-1-fixture',
            episode_no: 1,
            episode_title: '代表集',
            story_id: 'ui-review-story-fixture',
            shot_id: 'shot-1',
            status: 'processing',
            submitted_at: '2026-07-21T00:10:00.000Z',
            updated_at: '2026-07-21T00:10:00.000Z',
            provider_job_id: 'fixture-provider-job-001',
            external_call_authorization: {
              authorized: true,
              authorization_reference: 'fixture://ui-seedance-authorization',
              max_cost_amount: 2,
              cost_currency: 'CNY',
              data_transfer_acknowledged: true,
              confirmed_at: '2026-07-21T00:09:00.000Z',
            },
            execution_cost: {
              actual_cost_amount: 1.25,
              cost_currency: 'CNY',
              provider_reported_at: '2026-07-21T00:11:00.000Z',
              reporting_channel: 'callback_or_poll',
              boundary_status: 'within_authorization',
              authorization_reference: 'fixture://ui-seedance-authorization',
              authorized_max_cost_amount: 2,
              authorization_total_actual_cost_amount: 1.25,
            },
            retry_count: 0,
            notes: [],
            versions: [{
              version_id: 'seedance-e1-shot-1-fixture-v1',
              status: 'processing',
              created_at: '2026-07-21T00:10:00.000Z',
              provider_job_id: 'fixture-provider-job-001',
              external_call_authorization: {
                authorized: true,
                authorization_reference: 'fixture://ui-seedance-authorization',
                max_cost_amount: 2,
                cost_currency: 'CNY',
                data_transfer_acknowledged: true,
                confirmed_at: '2026-07-21T00:09:00.000Z',
              },
              execution_cost: {
                actual_cost_amount: 1.25,
                cost_currency: 'CNY',
                provider_reported_at: '2026-07-21T00:11:00.000Z',
                reporting_channel: 'callback_or_poll',
                boundary_status: 'within_authorization',
                authorization_reference: 'fixture://ui-seedance-authorization',
                authorized_max_cost_amount: 2,
                authorization_total_actual_cost_amount: 1.25,
              },
            }],
          }],
        },
        memory_recall_preferences: {},
        premise_fidelity_audit: {
          schema_version: 'ai-comic-series-premise-fidelity-audit/v2',
          hard_gate_passed: true,
          premise_coverage_score: 100,
          named_character_coverage: 100,
          world_rule_coverage: 100,
          antagonistic_force_coverage: 100,
          core_stakes_coverage: 100,
          missing_required_anchor_ids: [],
          generic_substitution_issues: [],
          issues: [],
          evidence: [],
          episode_reports: [],
        },
        commercial_quality_audit: {
          schema_version: 'ai-comic-series-commercial-quality-audit/v1',
          machine_gate_passed: true,
          machine_score: 100,
          ready_for_human_review: true,
          required_human_review_episode_nos: [1],
          missing_human_review_episode_nos: [],
          review_content_fingerprint: 'sha256:fixture',
          issues: [],
          episodes_need_attention: [],
          episode_reports: [{
            episode_no: 1,
            machine_gate_passed: true,
            score: 100,
            evidence: [],
            issues: [],
          }],
          diversity_report: {
            schema_version: 'ai-comic-series-diversity-report/v1',
            passed: true,
            score: 100,
            thresholds: {
              max_adjacent_token_overlap: 0.72,
              max_dialogue_token_overlap: 0.7,
              max_hook_type_streak: 2,
              max_scene_sequence_repetitions: 4,
              max_signature_combo_streak: 1,
            },
            exact_opening_duplicate_groups: [],
            adjacent_pair_reports: [],
            repeated_scene_function_sequences: [],
            hook_type_streak_issues: [],
            signature_combo_streak_issues: [],
            issues: [],
          },
          human_review: {
            schema_version: 'ai-comic-series-human-review/v1',
            status: 'pending',
            blind_review_required: true,
            reviewer_count: 0,
            dimension_averages: {},
            scores: [],
            issues: [],
          },
        },
      },
    }),
  }))
  await page.route(
    `**/api/story-outline/ai-comic-series-projects/${seriesProjectId}/export-seedance-asset-report`,
    route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        error: null,
        data: {
          schema_version: 'ai-comic-series-seedance-asset-report/v1',
          project: { series_project_id: seriesProjectId },
          series_title: '盲评向导测试系列',
          exported_at: '2026-07-21T00:00:00.000Z',
          total_asset_count: 0,
          missing_reference_slot_count: 0,
          upload_required_count: 0,
          shot_binding_count: 0,
          unbound_shot_count: 0,
          assets: [],
          shots: [],
          markdown: '',
          visual_bible: {
            schema_version: 'ai-comic-series-visual-bible/v1',
            generated_at: '2026-07-21T00:00:00.000Z',
            source_fingerprint: `sha256:${'b'.repeat(64)}`,
            pilot_episode_nos: [1],
            world: {
              period: '当代',
              region: '待定义',
              architectural_language: ['午夜皮影戏台前场'],
              lighting_and_color_rules: ['灯与白幕'],
              material_rules: ['皮影'],
            },
            world_rules: [{
              rule_id: 'midnight-lamp-screen-rule',
              statement: '午夜灯幕熄灭后不得跨过白幕禁位',
              consequence: '违规者会失去共同记忆',
              source_story_ids: { 1: 'ui-review-story-fixture' },
              source_fingerprint: `sha256:${'d'.repeat(64)}`,
              definition_fields: [
                { field_id: 'visual_symbol', label: '视觉符号', value: '', required: true },
                { field_id: 'trigger_condition', label: '触发条件', value: '', required: true },
              ],
              definition_notes: '',
              approval: { status: 'pending', human_confirmed: false },
              missing_definition_fields: ['视觉符号', '触发条件'],
              definition_status: 'needs_definition',
              pilot_bindings: [],
              missing_pilot_episode_nos: [1],
              missing_visual_mapping: true,
            }],
            cultural_boundaries: [],
            identities: [{
              identity_id: 'series-character-123456789abc',
              kind: 'character',
              label: '沈砚',
              canonical_description: '主角；固定服饰与随身灯票',
              source: 'plan_character',
              source_episode_nos: [1],
              pilot_episode_nos: [1],
              continuity_constraints: ['跨镜头身份一致'],
              negative_constraints: ['不得替换为通用人物'],
              source_fingerprint: `sha256:${'c'.repeat(64)}`,
              definition_fields: [
                { field_id: 'age_range', label: '年龄区间', value: '', required: true },
                { field_id: 'body_type', label: '体态', value: '', required: true },
                { field_id: 'facial_features', label: '脸部特征', value: '', required: true },
                { field_id: 'hairstyle', label: '发型', value: '', required: true },
                { field_id: 'gender_pronouns', label: '性别/代词', value: '', required: true },
              ],
              definition_notes: '',
              approval: { status: 'pending', human_confirmed: false },
              missing_definition_fields: ['年龄区间', '体态', '脸部特征', '发型', '性别/代词'],
              definition_status: 'needs_definition',
              production_credit: false,
            }],
            pilot_episode_bindings: [{
              episode_no: 1,
              generated_story_id: 'ui-review-story-fixture',
              character_identity_ids: ['series-character-123456789abc'],
              costume_identity_ids: [],
              location_identity_ids: [],
              prop_identity_ids: [],
              required_identity_ids: ['series-character-123456789abc'],
              production_credit_identity_ids: [],
              identity_coverage_percent: 25,
              production_credit_coverage_percent: 0,
              missing_identity_kinds: ['costume', 'location', 'prop'],
              world_rule_ids: [],
              missing_world_rule_ids: ['midnight-lamp-screen-rule'],
              world_rule_coverage_percent: 0,
            }],
            ready_identity_count: 0,
            needs_definition_identity_count: 1,
            approved_identity_count: 0,
            needs_approval_identity_count: 0,
            production_credit_identity_count: 0,
            ready_world_rule_count: 0,
            needs_definition_world_rule_count: 1,
            approved_world_rule_count: 0,
            needs_approval_world_rule_count: 0,
            blocker_count: 2,
            warning_count: 2,
            issues: ['角色视觉定义仍缺字段', '原创世界规则仍需补充逐条视觉符号与触发条件'],
          },
        },
      }),
    }),
  )
  let identitySuggestionRequestCount = 0
  const identitySuggestionRoutePattern =
    `**/api/story-outline/ai-comic-series-projects/${seriesProjectId}/visual-identities/series-character-123456789abc/visual-identity-suggestion-draft`
  await page.route(
    identitySuggestionRoutePattern,
    route => {
      identitySuggestionRequestCount += 1
      expect(route.request().method()).toBe('POST')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          error: null,
          data: {
            schema_version: 'ai-comic-series-visual-suggestion-draft/v1',
            target_type: 'visual_identity',
            target_id: 'series-character-123456789abc',
            source_fingerprint: `sha256:${'c'.repeat(64)}`,
            input_fingerprint: `sha256:${'1'.repeat(64)}`,
            suggestion_source: 'deterministic_template',
            suggestion_version: 'visual-definition-suggestions/v1',
            generated_at: '2026-07-23T00:00:00.000Z',
            fields: {
              body_type: '服务端建议体态，不得覆盖本地人工输入',
              facial_features: '服务端建议：固定脸型与近景识别特征。',
              hairstyle: '服务端建议：固定发型轮廓。',
            },
            definition_notes: '【系统建议草稿，尚未人工批准】服务端身份建议备注。',
            suggested_field_ids: ['body_type', 'facial_features', 'hairstyle'],
            unresolved_field_ids: ['age_range', 'gender_pronouns'],
            persisted: false,
            auto_approved: false,
          },
        }),
      })
    },
  )
  let worldRuleSuggestionRequestCount = 0
  const worldRuleSuggestionRoutePattern =
    `**/api/story-outline/ai-comic-series-projects/${seriesProjectId}/visual-world-rules/midnight-lamp-screen-rule/visual-world-rule-suggestion-draft`
  await page.route(
    worldRuleSuggestionRoutePattern,
    route => {
      worldRuleSuggestionRequestCount += 1
      expect(route.request().method()).toBe('POST')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          error: null,
          data: {
            schema_version: 'ai-comic-series-visual-suggestion-draft/v1',
            target_type: 'visual_world_rule',
            target_id: 'midnight-lamp-screen-rule',
            source_fingerprint: `sha256:${'d'.repeat(64)}`,
            input_fingerprint: `sha256:${'2'.repeat(64)}`,
            suggestion_source: 'deterministic_template',
            suggestion_version: 'visual-definition-suggestions/v1',
            generated_at: '2026-07-23T00:00:00.000Z',
            fields: {
              visual_symbol: '服务端建议符号，不得覆盖本地人工输入',
              trigger_condition: '服务端建议：触发动作后按固定因果顺序呈现。',
            },
            definition_notes: '【系统建议草稿，尚未人工批准】服务端规则建议备注，不会创建真实镜头绑定。',
            suggested_field_ids: ['visual_symbol', 'trigger_condition'],
            unresolved_field_ids: [],
            persisted: false,
            auto_approved: false,
          },
        }),
      })
    },
  )
  await page.goto(`/ai-comic-series/new?seriesProjectId=${seriesProjectId}`)

  const workflow = page.getByTestId('commercial-human-review-workflow')
  await expect(workflow).toBeVisible({ timeout: 75_000 })
  await expect(workflow).toContainText('1. 导出并发送')
  await expect(workflow).toContainText('2. 只导入回执 JSON')
  await expect(workflow).toContainText('3. 复核并保存')
  await expect(workflow).toContainText('Markdown 不需要在这里选择')
  await expect(workflow.getByRole('button', { name: '导出盲评文件' })).toBeVisible()
  await expect(workflow.getByRole('button', { name: '选择回执 JSON（只选 1 个）' })).toBeVisible()
  await expect(workflow.getByTestId('commercial-human-review-review-panel')).toHaveCount(0)
  const visualBible = page.getByTestId('series-visual-bible')
  await expect(visualBible).toBeVisible()
  await expect(visualBible).toContainText('1 个稳定身份')
  await expect(visualBible).toContainText('稳定身份覆盖 25% · 世界规则覆盖 0% · 真实生产信用 0%')
  await expect(visualBible).toContainText('placeholder 永远不计入')
  await expect(visualBible).toContainText('0 / 1')
  const visualReadinessGuide = visualBible.getByTestId('visual-production-readiness-guide')
  await expect(visualReadinessGuide).toContainText('1. 填写并校验定义')
  await expect(visualReadinessGuide).toContainText('5. 生产就绪')
  const visualReviewNavigator = visualBible.getByTestId('visual-review-navigator')
  await expect(visualReviewNavigator).toContainText('待复核 2 项')
  await expect(visualReviewNavigator).toContainText('身份 1 · 世界规则 1')
  await expect(page.getByText('外部授权：fixture://ui-seedance-authorization')).toBeVisible()
  await expect(page.getByText(/预算 2 CNY/)).toBeVisible()
  await expect(page.getByText(/实际费用：1.25 CNY/)).toBeVisible()
  await expect(page.getByText(/同授权累计 1.25 CNY/)).toBeVisible()
  await visualReviewNavigator.getByRole('button', { name: '打开下一个待复核项' }).click()
  const visualDefinitionEditor = visualBible.getByTestId('visual-identity-definition-editor')
  await expect(visualDefinitionEditor).toContainText('系统建议只补空白')
  await expect(visualDefinitionEditor.getByLabel('年龄区间 *')).toBeVisible()
  await expect(visualDefinitionEditor.getByRole('button', { name: '批准此定义' })).toBeDisabled()
  const identityApprovalChecklist = visualDefinitionEditor.getByTestId('visual-identity-approval-checklist')
  await expect(identityApprovalChecklist).toContainText('批准前还需完成')
  await expect(identityApprovalChecklist).toContainText('填写年龄区间')
  await expect(identityApprovalChecklist).toContainText('填写 Reviewer ID')
  await expect(identityApprovalChecklist).toContainText('勾选真人逐项复核确认')
  await visualDefinitionEditor.getByLabel('体态 *').fill('人工已填写的瘦高体态')
  await visualDefinitionEditor.getByLabel('复核说明（批准时必填）').fill('旧复核说明必须在建议改变草稿后清除')
  await visualDefinitionEditor.getByLabel(/我确认已由真人逐项复核以上视觉定义/).check()
  await visualDefinitionEditor.getByRole('button', { name: '填入系统建议（不覆盖已填）' }).click()
  await expect(visualDefinitionEditor.getByLabel('体态 *')).toHaveValue('人工已填写的瘦高体态')
  await expect(visualDefinitionEditor.getByLabel('脸部特征 *')).toHaveValue('服务端建议：固定脸型与近景识别特征。')
  await expect(visualDefinitionEditor.getByLabel('年龄区间 *')).toHaveValue('')
  await expect(visualDefinitionEditor.getByLabel('定义备注（可选，跨集连续性）'))
    .toHaveValue('【系统建议草稿，尚未人工批准】服务端身份建议备注。')
  await expect(visualDefinitionEditor.getByLabel('复核说明（批准时必填）')).toHaveValue('')
  await expect(visualDefinitionEditor.getByLabel(/我确认已由真人逐项复核以上视觉定义/)).not.toBeChecked()
  await expect(visualDefinitionEditor).toContainText('服务端建议 visual-definition-suggestions/v1')
  await expect(identityApprovalChecklist).toContainText('填写年龄区间')
  await expect(identityApprovalChecklist).toContainText('填写性别/代词')
  await expect(identityApprovalChecklist).toContainText('填写复核说明')
  expect(identitySuggestionRequestCount).toBe(1)
  await visualReviewNavigator.getByRole('button', { name: '打开下一个待复核项' }).click()
  const worldRuleDefinitionEditor = visualBible.getByTestId('visual-world-rule-definition-editor')
  await expect(worldRuleDefinitionEditor).toContainText('每个代表集仍须选择真实 Seedance 镜头或 GEARS 段')
  await expect(worldRuleDefinitionEditor.getByLabel('视觉符号 *')).toBeVisible()
  await expect(worldRuleDefinitionEditor).toContainText('E1 代表目标 *')
  await expect(worldRuleDefinitionEditor.getByRole('button', { name: '批准此映射' })).toBeDisabled()
  const worldRuleApprovalChecklist = worldRuleDefinitionEditor.getByTestId('visual-world-rule-approval-checklist')
  await expect(worldRuleApprovalChecklist).toContainText('批准前还需完成')
  await expect(worldRuleApprovalChecklist).toContainText('绑定 E1 真实代表目标')
  await expect(worldRuleApprovalChecklist).toContainText('填写 Reviewer ID')
  await worldRuleDefinitionEditor.getByLabel('视觉符号 *').fill('人工已填写的白幕逆影符号')
  await worldRuleDefinitionEditor.getByLabel('复核说明（批准时必填）').fill('旧规则复核说明必须清除')
  await worldRuleDefinitionEditor.getByLabel(/我确认已由真人逐项复核规则文本/).check()
  await worldRuleDefinitionEditor.getByRole('button', { name: '填入系统建议（不覆盖已填）' }).click()
  await expect(worldRuleDefinitionEditor.getByLabel('视觉符号 *')).toHaveValue('人工已填写的白幕逆影符号')
  await expect(worldRuleDefinitionEditor.getByLabel('触发条件 *'))
    .toHaveValue('服务端建议：触发动作后按固定因果顺序呈现。')
  await expect(worldRuleDefinitionEditor.getByLabel('定义备注（可选，规则连续性）'))
    .toHaveValue('【系统建议草稿，尚未人工批准】服务端规则建议备注，不会创建真实镜头绑定。')
  await expect(worldRuleDefinitionEditor.getByLabel('复核说明（批准时必填）')).toHaveValue('')
  await expect(worldRuleDefinitionEditor.getByLabel(/我确认已由真人逐项复核规则文本/)).not.toBeChecked()
  await expect(worldRuleDefinitionEditor).toContainText('服务端建议 visual-definition-suggestions/v1')
  await expect(worldRuleApprovalChecklist).toContainText('绑定 E1 真实代表目标')
  await expect(worldRuleApprovalChecklist).toContainText('填写复核说明')
  expect(worldRuleSuggestionRequestCount).toBe(1)

  await page.unroute(identitySuggestionRoutePattern)
  let staleIdentitySuggestionRequestCount = 0
  await page.route(identitySuggestionRoutePattern, route => {
    staleIdentitySuggestionRequestCount += 1
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        error: null,
        data: {
          schema_version: 'ai-comic-series-visual-suggestion-draft/v1',
          target_type: 'visual_identity',
          target_id: 'series-character-123456789abc',
          source_fingerprint: `sha256:${'e'.repeat(64)}`,
          input_fingerprint: `sha256:${'3'.repeat(64)}`,
          suggestion_source: 'deterministic_template',
          suggestion_version: 'visual-definition-suggestions/v1',
          generated_at: '2026-07-23T00:01:00.000Z',
          fields: {
            body_type: '过期建议不得覆盖人工体态',
            facial_features: '过期建议不得写入空白脸部特征',
          },
          definition_notes: '过期建议备注不得写入',
          suggested_field_ids: ['body_type', 'facial_features'],
          unresolved_field_ids: [],
          persisted: false,
          auto_approved: false,
        },
      }),
    })
  })
  await visualReviewNavigator.getByRole('button', { name: '打开下一个待复核项' }).click()
  await expect(visualDefinitionEditor).toBeVisible()
  await visualDefinitionEditor.getByLabel('体态 *').fill('源变化前的本地人工体态')
  await visualDefinitionEditor.getByRole('button', { name: '填入系统建议（不覆盖已填）' }).click()
  await expect(visualDefinitionEditor.getByLabel('体态 *')).toHaveValue('源变化前的本地人工体态')
  await expect(visualDefinitionEditor.getByLabel('脸部特征 *')).toHaveValue('')
  await expect(visualDefinitionEditor.getByLabel('定义备注（可选，跨集连续性）')).toHaveValue('')
  await expect(visualDefinitionEditor).toContainText('视觉设定来源已经变化')
  expect(staleIdentitySuggestionRequestCount).toBe(1)

  await page.unroute(worldRuleSuggestionRoutePattern)
  let failedWorldRuleSuggestionRequestCount = 0
  await page.route(worldRuleSuggestionRoutePattern, route => {
    failedWorldRuleSuggestionRequestCount += 1
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: '视觉建议服务暂不可用',
        },
      }),
    })
  })
  await visualReviewNavigator.getByRole('button', { name: '打开下一个待复核项' }).click()
  await expect(worldRuleDefinitionEditor).toBeVisible()
  await worldRuleDefinitionEditor.getByLabel('视觉符号 *').fill('服务失败前的本地人工符号')
  await worldRuleDefinitionEditor.getByRole('button', { name: '填入系统建议（不覆盖已填）' }).click()
  await expect(worldRuleDefinitionEditor.getByLabel('视觉符号 *')).toHaveValue('服务失败前的本地人工符号')
  await expect(worldRuleDefinitionEditor.getByLabel('触发条件 *')).toHaveValue('')
  await expect(worldRuleDefinitionEditor.getByLabel('定义备注（可选，规则连续性）')).toHaveValue('')
  await expect(worldRuleDefinitionEditor).toContainText('视觉建议服务暂不可用')
  expect(failedWorldRuleSuggestionRequestCount).toBe(1)

  await workflow.locator('input[type="file"]').setInputFiles({
    name: '候选-ABC12345-评审回执.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      schema_version: 'ai-comic-series-blind-review-response/v1',
      candidate_label: '候选-ABC12345',
      reviewer_packet_sha256: `sha256:${'a'.repeat(64)}`,
      reviewer_id: '',
      blind: true,
      instructions: [],
      scores: [
        { dimension: 'hook', label: '钩子', score: null, note: '' },
        { dimension: 'character', label: '人物', score: null, note: '' },
        { dimension: 'dialogue', label: '对白', score: null, note: '' },
        { dimension: 'progression', label: '推进', score: null, note: '' },
        { dimension: 'turn', label: '反转', score: null, note: '' },
        { dimension: 'ending', label: '结尾', score: null, note: '' },
        { dimension: 'cultural_credibility', label: '文化可信度', score: null, note: '' },
      ],
      attestations: {
        human_reviewer: false,
        origin_and_machine_scores_hidden: false,
        independent_review: false,
      },
    })),
  })
  const blankGuidance = workflow.getByTestId('commercial-human-review-blank-guidance')
  await expect(blankGuidance).toBeVisible()
  await expect(blankGuidance).toContainText('这是尚未填写的空白回执模板')
  await expect(blankGuidance).toContainText('把匿名材料 Markdown 和这份 JSON 一起发给真实评审人')
  const reviewFormLink = blankGuidance.getByRole('link', { name: '打开匿名评审填写页' })
  await expect(reviewFormLink).toBeVisible()
  await expect(workflow).toContainText('当前还不能进入步骤 3')

  await reviewFormLink.click()
  await expect(page).toHaveURL('/ai-comic-series/blind-review-form')
  const responseForm = page.getByTestId('blind-review-response-form')
  await expect(responseForm).toBeVisible()
  await expect(responseForm).toContainText('候选-ABC12345')
  await expect(responseForm).not.toContainText('盲评向导测试系列')
  await expect(responseForm).not.toContainText('100 / 100')
  await page.getByLabel('Reviewer ID').fill('human-reviewer-web-form')
  await page.getByLabel('钩子评分').selectOption({ label: '3 分' })
  await page.getByLabel('钩子意见').fill('首场冲突需要更早出现。')
  for (const label of ['人物', '对白', '推进', '反转', '结尾', '文化可信度']) {
    await page.getByLabel(`${label}评分`).selectOption({ label: '4 分' })
  }
  await page.getByLabel('我是实际阅读匿名材料并作出评分的真人评审人。').check()
  await page.getByLabel('评审时未获知候选来源、项目身份和机器评分。').check()
  await page.getByLabel('本次评分由我独立完成，没有照抄或代填。').check()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载填写完成的回执 JSON' }).click()
  const completedResponseDownload = await downloadPromise
  expect(completedResponseDownload.suggestedFilename()).toBe('候选-ABC12345-评审回执.json')
  const completedResponsePath = await completedResponseDownload.path()
  expect(completedResponsePath).not.toBeNull()
  const completedResponse = JSON.parse(await readFile(completedResponsePath!, 'utf8'))
  expect(completedResponse.reviewer_id).toBe('human-reviewer-web-form')
  expect(completedResponse.scores).toHaveLength(7)
  expect(completedResponse.scores[0]).toMatchObject({
    dimension: 'hook',
    score: 3,
    note: '首场冲突需要更早出现。',
  })
  expect(completedResponse.attestations).toEqual({
    human_reviewer: true,
    origin_and_machine_scores_hidden: true,
    independent_review: true,
  })

  await page.goBack()
  await expect(page).toHaveURL(`/ai-comic-series/new?seriesProjectId=${seriesProjectId}`)
  await expect(workflow).toBeVisible({ timeout: 75_000 })

  await workflow.locator('input[type="file"]').setInputFiles({
    name: '候选-ABC12345-评审回执.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      schema_version: 'ai-comic-series-blind-review-response/v1',
      candidate_label: '候选-ABC12345',
      reviewer_packet_sha256: `sha256:${'a'.repeat(64)}`,
      reviewer_id: 'human-reviewer-fixture',
      blind: true,
      instructions: [],
      scores: [
        { dimension: 'hook', label: '钩子', score: 3, note: '首场冲突需要更早出现。' },
        { dimension: 'character', label: '人物', score: 4, note: '' },
        { dimension: 'dialogue', label: '对白', score: 4, note: '' },
        { dimension: 'progression', label: '推进', score: 4, note: '' },
        { dimension: 'turn', label: '反转', score: 4, note: '' },
        { dimension: 'ending', label: '结尾', score: 4, note: '' },
        { dimension: 'cultural_credibility', label: '文化可信度', score: 4, note: '' },
      ],
      attestations: {
        human_reviewer: true,
        origin_and_machine_scores_hidden: true,
        independent_review: true,
      },
    })),
  })

  const reviewPanel = workflow.getByTestId('commercial-human-review-review-panel')
  await expect(reviewPanel).toBeVisible()
  await expect(reviewPanel).toContainText('human-reviewer-fixture')
  await expect(reviewPanel).toContainText('首场冲突需要更早出现。')
  await expect(reviewPanel.getByRole('button', { name: '确认并保存这份真人评审' })).toBeDisabled()
})
