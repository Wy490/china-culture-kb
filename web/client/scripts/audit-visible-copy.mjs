import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const clientRoot = dirname(dirname(fileURLToPath(import.meta.url)))

const visibleFiles = [
  'index.html',
  'src/App.vue',
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
    pattern: /<h1 class="app-title">AI影视工作台<\/h1>/,
  },
  {
    file: 'src/App.vue',
    label: 'single-video nav label',
    pattern: /<RouterLink to="\/story\/new">单片短片<\/RouterLink>/,
  },
  {
    file: 'src/App.vue',
    label: 'series nav label',
    pattern: /<RouterLink to="\/ai-comic-series\/new">漫剧系列<\/RouterLink>/,
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
