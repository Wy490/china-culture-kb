import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const clientRoot = dirname(dirname(fileURLToPath(import.meta.url)))

const visibleFiles = [
  'index.html',
  'src/App.vue',
  '../shared/product-navigation.ts',
  'src/views/Home.vue',
  'src/views/StoryStudio.vue',
  'src/views/AiComicSeriesStudio.vue',
  'src/views/Projects.vue',
  'src/views/ProjectDetail.vue',
  'src/views/StoryDetail.vue',
]

const blockedTerms = [
  '中国传统文化知识库',
  '传统文化知识库',
  '文化知识库',
  '系列漫剧',
  '多集系列漫剧',
  '新建系列漫剧',
  '打开系列工作台',
  '单片创作',
]

const requiredCopyChecks = [
  {
    file: 'index.html',
    label: 'browser title',
    pattern: /<title>AI影视工作台<\/title>/,
  },
  {
    file: 'src/App.vue',
    label: 'app title',
    pattern: /<RouterLink class="app-title" to="\/">AI影视工作台<\/RouterLink>/,
  },
  {
    file: '../shared/product-navigation.ts',
    label: 'single-video nav label',
    pattern: /label: '单片短片',[\s\S]*?to: '\/story\/new'/,
  },
  {
    file: '../shared/product-navigation.ts',
    label: 'series nav label',
    pattern: /label: '漫剧系列',[\s\S]*?to: '\/ai-comic-series\/new'/,
  },
  {
    file: 'src/views/Home.vue',
    label: 'single-video home entry',
    pattern: /<h2>单片短片<\/h2>/,
  },
  {
    file: 'src/views/Home.vue',
    label: 'series home entry',
    pattern: /<h2>漫剧系列<\/h2>/,
  },
  {
    file: 'src/views/StoryStudio.vue',
    label: 'single-video studio heading',
    pattern: /<h2 class="story-studio__page-title">单片短片创作<\/h2>/,
  },
  {
    file: 'src/views/StoryStudio.vue',
    label: 'single-to-series switch',
    pattern: /<RouterLink class="story-studio__switch-link" to="\/ai-comic-series\/new">漫剧系列<\/RouterLink>/,
  },
  {
    file: 'src/views/AiComicSeriesStudio.vue',
    label: 'series studio heading',
    pattern: /<h2 class="series-studio__title">漫剧系列规划<\/h2>/,
  },
  {
    file: 'src/views/AiComicSeriesStudio.vue',
    label: 'series-to-single switch',
    pattern: /<RouterLink class="series-studio__switch-link" to="\/story\/new">单片短片<\/RouterLink>/,
  },
  {
    file: 'src/views/AiComicSeriesStudio.vue',
    label: 'visual definition review workflow',
    pattern: /系统建议草稿 → 人工复核 → 真人批准/,
  },
  {
    file: 'src/views/AiComicSeriesStudio.vue',
    label: 'visual identity definition notes',
    pattern: /定义备注（可选，跨集连续性）/,
  },
  {
    file: 'src/views/AiComicSeriesStudio.vue',
    label: 'world rule definition notes',
    pattern: /定义备注（可选，规则连续性）/,
  },
  {
    file: 'src/views/AiComicSeriesStudio.vue',
    label: 'non-destructive system suggestion action',
    pattern: /填入系统建议（不覆盖已填）/,
  },
]

function readVisibleFile(relativePath) {
  return readFileSync(join(clientRoot, relativePath), 'utf8')
}

const findings = []

for (const relativePath of visibleFiles) {
  const content = readVisibleFile(relativePath)
  for (const term of blockedTerms) {
    const index = content.indexOf(term)
    if (index >= 0) {
      const line = content.slice(0, index).split('\n').length
      findings.push(`${relativePath}:${line} contains legacy visible copy "${term}"`)
    }
  }
}

for (const check of requiredCopyChecks) {
  const content = readVisibleFile(check.file)
  if (!check.pattern.test(content)) {
    findings.push(`${check.file} is missing required ${check.label}`)
  }
}

if (findings.length > 0) {
  console.error('Visible copy audit failed:')
  for (const finding of findings) {
    console.error(`- ${finding}`)
  }
  process.exit(1)
}

console.log(`Visible copy audit passed: ${visibleFiles.length} files, ${requiredCopyChecks.length} required checks.`)
