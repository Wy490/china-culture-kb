import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { defineConfig, devices } from 'playwright/test'
import { PLAYWRIGHT_ACCESS_REGISTRY_JSON } from './e2e/product-access-fixtures'

function resolvePort(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const port = Number(raw)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535`)
  }
  return port
}

const clientPort = resolvePort('STORY_AGENT_E2E_CLIENT_PORT', 5173)
const serverPort = resolvePort('STORY_AGENT_E2E_SERVER_PORT', 3000)
const baseURL = `http://localhost:${clientPort}`
const accessAuditPath = resolve(
  tmpdir(),
  `story-agent-track-a-access-audit-${process.pid}.jsonl`,
)

export default defineConfig({
  testDir: './e2e',
  outputDir: '../output/playwright/track-a',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['json', { outputFile: '../output/playwright/track-a-results.json' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      STORY_AGENT_CI: '1',
      PORT: String(serverPort),
      VITE_DEV_PORT: String(clientPort),
      VITE_API_PROXY_TARGET: `http://localhost:${serverPort}`,
      STORY_GEN_LOCAL_ONLY: '1',
      STORY_AGENT_ACCESS_MODE: 'required',
      STORY_AGENT_ACCESS_REGISTRY_JSON: PLAYWRIGHT_ACCESS_REGISTRY_JSON,
      STORY_AGENT_ACCESS_AUDIT_REQUIRED: 'true',
      STORY_AGENT_ACCESS_AUDIT_JSONL: accessAuditPath,
      STORY_AGENT_ACCESS_AUDIT_ROTATION_MODE: 'size_external_retention',
      STORY_AGENT_ACCESS_AUDIT_MAX_BYTES: '10485760',
      STORY_AGENT_ACCESS_AUDIT_RETENTION_DAYS: '30',
      STORY_AGENT_LOGIN_URL: '/auth/login',
      VITE_ENABLE_ROLE_PREVIEW: 'true',
      VITE_ENABLE_INTERNAL_STORY_TOOLS: 'true',
      VITE_STORY_AGENT_ROLE: 'creator',
    },
  },
})
