import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const clientRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const baseUrl = process.env.FRONTEND_ACCEPTANCE_BASE_URL?.trim()
const routeStrict = process.env.FRONTEND_ACCEPTANCE_ROUTE_STRICT === '1'

const sourceChecks = [
  {
    file: 'src/views/KnowledgeWritebackQueue.vue',
    label: 'manual patch preview panel',
    patterns: [
      /<strong>人工 Patch 预览<\/strong>/,
      /目标文件 diff 预览/,
      /复制人工 Patch/,
      /下载人工 Patch/,
      /复制 Patch Diff/,
      /下载 Patch Diff/,
      /manualPatchPreviewSummary/,
      /localClosureCertificateId/,
      /sourceRefCoveragePercent/,
      /direct_writeback_to_province_markdown: false/,
    ],
  },
  {
    file: 'src/views/SupplementTasks.vue',
    label: 'supplement candidate package controls',
    patterns: [
      /复制补库候选包/,
      /下载补库候选包/,
      /复制写回队列 Patch/,
      /candidatePackageFilters/,
      /status: 'open' as const/,
      /candidateExportItems/,
      /候选稿/,
      /写回草案/,
      /入库队列/,
    ],
  },
]

const routeChecks = [
  {
    path: '/knowledge-writeback-queue',
    label: 'Knowledge Writeback Queue route',
  },
  {
    path: '/supplement-tasks',
    label: 'Supplement Tasks route',
  },
]

function readClientFile(relativePath) {
  return readFileSync(join(clientRoot, relativePath), 'utf8')
}

function lineForIndex(content, index) {
  return content.slice(0, Math.max(0, index)).split('\n').length
}

function assertSourceChecks() {
  const findings = []
  for (const check of sourceChecks) {
    const content = readClientFile(check.file)
    for (const pattern of check.patterns) {
      if (!pattern.test(content)) {
        findings.push(`${check.file} missing ${check.label}: ${pattern}`)
      }
    }
    const unsafeIndex = content.indexOf('data/provinces/*.md 已写入')
    if (unsafeIndex >= 0) {
      findings.push(`${check.file}:${lineForIndex(content, unsafeIndex)} must not claim direct province Markdown writeback`)
    }
  }
  return findings
}

async function assertRouteChecks() {
  if (!baseUrl) return { findings: [], warnings: [] }
  const findings = []
  const warnings = []
  for (const check of routeChecks) {
    const url = new URL(check.path, baseUrl)
    let response
    try {
      response = await fetch(url)
    } catch (error) {
      warnings.push(`${check.label} could not fetch ${url.href}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    if (!response.ok) {
      findings.push(`${check.label} returned HTTP ${response.status} for ${url.href}`)
      continue
    }
    const html = await response.text()
    if (!html.includes('<div id="app"></div>')) {
      findings.push(`${check.label} did not return the Vite app shell for ${url.href}`)
    }
  }
  return {
    findings,
    warnings,
  }
}

const routeResult = await assertRouteChecks()
const findings = [
  ...assertSourceChecks(),
  ...routeResult.findings,
  ...(routeStrict ? routeResult.warnings : []),
]

if (findings.length > 0) {
  console.error('Writeback acceptance audit failed:')
  for (const finding of findings) {
    console.error(`- ${finding}`)
  }
  process.exit(1)
}

for (const warning of routeResult.warnings) {
  console.warn(`Writeback acceptance route warning: ${warning}`)
}

const routeSummary = baseUrl ? `, ${routeChecks.length} local routes checked at ${baseUrl}` : ', route smoke skipped'
console.log(`Writeback acceptance audit passed: ${sourceChecks.length} view files checked${routeSummary}.`)
