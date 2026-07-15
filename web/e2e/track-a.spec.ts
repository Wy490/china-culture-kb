import { expect, test, type APIRequestContext, type Page } from 'playwright/test'
import { PLAYWRIGHT_ACCESS_TOKENS } from './product-access-fixtures'

const PRIMARY_NAVIGATION = ['创作', '项目', '素材', '生产', '评审']
const runtimeFailures = new WeakMap<Page, string[]>()
const expectedApiFailures = new WeakMap<Page, Set<string>>()
const expectedConsoleErrors = new WeakMap<Page, Set<string>>()

type ProjectListItem = {
  project_id?: unknown
}

async function firstReadableProjectId(request: APIRequestContext, token: string): Promise<string> {
  const headers = { authorization: `Bearer ${token}` }
  const response = await request.get('/api/projects', { headers })
  expect(response.ok(), await response.text()).toBe(true)
  const envelope = await response.json() as { data?: ProjectListItem[] }
  const projectIds = (envelope.data ?? [])
    .map(item => item.project_id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)

  for (const projectId of projectIds.slice(0, 20)) {
    const readiness = await request.get(`/api/projects/${encodeURIComponent(projectId)}/production-readiness`, { headers })
    if (readiness.ok()) return projectId
  }

  throw new Error('No read-only project with a production-readiness report is available for Track A E2E.')
}

async function selectRole(page: Page, roleLabel: string): Promise<void> {
  await page.getByRole('combobox', { name: '角色视图' }).selectOption({ label: roleLabel })
}

async function setServerActorSession(page: Page, token: string): Promise<void> {
  await page.context().addCookies([{
    name: 'story_agent_session',
    value: token,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }])
}

test.beforeEach(async ({ page }) => {
  const failures: string[] = []
  const expectedFailures = new Set<string>()
  const expectedConsole = new Set<string>()
  runtimeFailures.set(page, failures)
  expectedApiFailures.set(page, expectedFailures)
  expectedConsoleErrors.set(page, expectedConsole)
  page.on('pageerror', error => failures.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() !== 'error') return
    if (expectedConsole.delete(message.text())) return
    failures.push(`console: ${message.text()}`)
  })
  page.on('response', response => {
    if (response.status() >= 400 && new URL(response.url()).pathname.startsWith('/api/')) {
      const path = new URL(response.url()).pathname
      const key = `${response.status()} ${response.request().method()} ${path}`
      if (expectedFailures.delete(key)) return
      failures.push(`api: ${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })
  await setServerActorSession(page, PLAYWRIGHT_ACCESS_TOKENS.creator)
})

test.afterEach(async ({ page }) => {
  expect(runtimeFailures.get(page) ?? [], '关键路径不应出现浏览器运行时或 API 错误').toEqual([])
  expect([...(expectedApiFailures.get(page) ?? [])], '声明的预期 API 失败必须实际发生').toEqual([])
  expect([...(expectedConsoleErrors.get(page) ?? [])], '声明的预期控制台错误必须实际发生').toEqual([])
})

test('1/6 一级导航严格收口为五个工作区', async ({ page }) => {
  await page.goto('/story/new')

  const primaryNavigation = page.getByRole('navigation', { name: '一级导航' })
  await expect(primaryNavigation.getByRole('link')).toHaveText(PRIMARY_NAVIGATION)
  await expect(primaryNavigation.getByRole('link')).toHaveCount(5)
  await expect(primaryNavigation).not.toContainText(/Stage\s*[6-8]|P[0-9]/i)
  await expect(page.getByRole('heading', { name: '单片短片创作' })).toBeVisible()

  const secondaryNavigation = page.getByRole('navigation', { name: '二级导航' })
  await expect(secondaryNavigation.getByRole('link')).toHaveText(['单片短片', '漫剧系列'])
})

test('2/6 单片与漫剧系列在创作工作区内切换', async ({ page }) => {
  await page.goto('/story/new')
  await page.getByRole('navigation', { name: '二级导航' }).getByRole('link', { name: '漫剧系列' }).click()

  await expect(page).toHaveURL(/\/ai-comic-series\/new$/)
  await expect(page.getByRole('heading', { name: '漫剧系列规划' })).toBeVisible()
  await expect(page.getByLabel('系列名')).toBeVisible()
  await expect(page.getByLabel('故事梗概')).toBeVisible()

  await page.getByRole('link', { name: '单片短片', exact: true }).first().click()
  await expect(page).toHaveURL(/\/story\/new$/)
  await expect(page.getByRole('heading', { name: '单片短片创作' })).toBeVisible()
})

test('3/6 项目详情只呈现一个主 NEXT，且不授予真实完成信用', async ({ page, request }) => {
  const projectId = await firstReadableProjectId(request, PLAYWRIGHT_ACCESS_TOKENS.creator)
  await page.goto(`/projects/${encodeURIComponent(projectId)}`)

  const workflow = page.getByTestId('project-workflow')
  await expect(workflow).toBeVisible({ timeout: 60_000 })
  await expect(workflow.getByRole('heading')).toContainText('NEXT ·')
  await expect(workflow.getByTestId('project-primary-next')).toHaveCount(1)
  await expect(workflow).toContainText('1 个主 NEXT')
  await expect(workflow).toContainText(/不授予真人通过或正式发布信用|counts_as_real_completion/i)
})

test('4/6 内部生产检查器同时受前后端角色与 feature flag 控制', async ({ page, request }) => {
  await page.goto('/story/stage6-intake')

  await expect(page).toHaveURL(/\/access-denied\?target=/)
  await expect(page.getByRole('heading', { name: '当前角色无权打开此任务' })).toBeVisible()
  await expect(page.getByTestId('product-role').locator('span')).toHaveText('创作者')

  await selectRole(page, '制片运营')
  await expect(page).toHaveURL(/\/workspace\/production$/)
  await expect(page.getByText('制片运营', { exact: true }).first()).toBeVisible()
  await expect(page.locator('.workspace-hub__internal > summary')).toHaveText('内部工具')

  const creatorDenied = await request.get('/api/stage6-revisions/intake', {
    headers: { authorization: `Bearer ${PLAYWRIGHT_ACCESS_TOKENS.creator}` },
  })
  expect(creatorDenied.status()).toBe(403)
  const missingFlagDenied = await request.get('/api/stage6-revisions/intake', {
    headers: { authorization: `Bearer ${PLAYWRIGHT_ACCESS_TOKENS.productionOperatorWithoutFlag}` },
  })
  expect(missingFlagDenied.status()).toBe(403)

  await setServerActorSession(page, PLAYWRIGHT_ACCESS_TOKENS.productionOperator)
  await page.goto('/story/stage6-intake')
  await expect(page).toHaveURL(/\/story\/stage6-intake$/)
  await expect(page.getByRole('heading', { name: '真实输入接入与 Readiness' })).toBeVisible()
  await expect(page.getByText('ready 也不等于真实修订或专业通过')).toBeVisible()
})

test('5/6 文化事实评审经服务端身份进入评审，人工通过仍为零', async ({ page, request }) => {
  await page.goto('/workspace/review')
  await expect(page.getByText('当前角色在此工作区没有可执行任务。')).toBeVisible()

  await selectRole(page, '文化事实评审')
  await expect(page).toHaveURL(/\/workspace\/review$/)

  const taskCards = page.locator('.workspace-hub > .workspace-hub__grid .workspace-hub__card')
  await expect(taskCards.filter({ hasText: '素材审稿' })).toHaveCount(1)
  await expect(taskCards.filter({ hasText: '终稿盲评' })).toHaveCount(1)
  await expect(taskCards.filter({ hasText: '发布验收' })).toHaveCount(0)

  const creatorDenied = await request.get('/api/stage7-golden-cards/review-intake', {
    headers: { authorization: `Bearer ${PLAYWRIGHT_ACCESS_TOKENS.creator}` },
  })
  expect(creatorDenied.status()).toBe(403)

  await setServerActorSession(page, PLAYWRIGHT_ACCESS_TOKENS.culturalFactReviewer)
  await taskCards.filter({ hasText: '素材审稿' }).click()
  await expect(page.getByRole('heading', { name: '黄金素材卡真人审稿接入' })).toBeVisible()
  await expect(page.locator('.truth-lock')).toContainText('预检 ready ≠ 人工通过')
  await expect(page.locator('.summary-grid .zero')).toContainText('人工通过')
  await expect(page.locator('.summary-grid .zero')).toContainText('0')
})

test('6/6 会话失效后进入受控登录 handoff，并安全返回原任务', async ({ page }) => {
  await page.goto('/workspace/production')
  await expect(page.getByRole('heading', { name: '生产', exact: true })).toBeVisible()

  await page.context().clearCookies()
  expectedApiFailures.get(page)?.add('401 GET /api/stage6-revisions')
  expectedConsoleErrors.get(page)?.add('Failed to load resource: the server responded with a status of 401 (Unauthorized)')
  await page.getByRole('navigation', { name: '二级导航' }).getByRole('link', { name: '修订与桌读' }).click()

  await expect(page).toHaveURL(/\/access-required\?return_to=/)
  await expect(page.getByRole('heading', { name: '需要重新登录' })).toBeVisible()
  const loginLink = page.getByTestId('login-handoff-link')
  await expect(loginLink).toHaveAttribute('href', '/auth/login?return_to=%2Fstory%2Fstage6-revisions')
  await expect(page.getByText('HttpOnly · SameSite=Lax · 生产环境 Secure')).toBeVisible()

  await setServerActorSession(page, PLAYWRIGHT_ACCESS_TOKENS.creator)
  await page.getByRole('button', { name: '我已登录，重新检测' }).click()
  await expect(page).toHaveURL(/\/story\/stage6-revisions$/)
  await expect(page.getByRole('heading', { name: '桌读与版本修订工作台' })).toBeVisible()
})
