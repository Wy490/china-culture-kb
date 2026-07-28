<template>
  <div class="home">
    <section class="home__hero">
      <div class="home__hero-grain" aria-hidden="true" />
      <div class="home__hero-copy">
        <div class="home__eyebrow">
          <span class="home__eyebrow-mark" aria-hidden="true">文</span>
          <span>STORY AGENT · 文化影像前置制作</span>
        </div>
        <h1>
          把文化素材，
          <span>推到可交付的镜头之前。</span>
        </h1>
        <p class="home__hero-lead">
          从可信素材、故事蓝图和专业剧本出发，生成可追踪的场景、分镜、GEARS 分段与 Seedance
          制作提示。让创意不只停在文字里。
        </p>
        <div class="home__hero-actions">
          <RouterLink class="home__button home__button--primary" to="/story/new">
            <span>开始一个新故事</span>
            <span aria-hidden="true">↗</span>
          </RouterLink>
          <RouterLink class="home__button home__button--ghost" to="/projects">
            进入项目指挥台
          </RouterLink>
        </div>
        <p class="home__boundary">
          <span aria-hidden="true">◉</span>
          交付止点：完整前置制作包，不虚构成片结果
        </p>
      </div>

      <div class="home__pipeline" aria-label="Story Agent 生产流程">
        <div class="home__pipeline-head">
          <div>
            <span>ACTIVE PIPELINE</span>
            <strong>故事生产链</strong>
          </div>
          <span class="home__pipeline-state">
            <i aria-hidden="true" />
            READY
          </span>
        </div>
        <ol class="home__pipeline-list">
          <li v-for="(stage, index) in pipelineStages" :key="stage.title">
            <span class="home__pipeline-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <strong>{{ stage.title }}</strong>
              <span>{{ stage.detail }}</span>
            </div>
            <span class="home__pipeline-status" aria-hidden="true">{{ stage.status }}</span>
          </li>
        </ol>
        <div class="home__pipeline-output">
          <span>OUTPUT</span>
          <strong>可审阅 · 可恢复 · 可继续制作</strong>
        </div>
      </div>
    </section>

    <section class="home__metrics" aria-label="工作台概览">
      <div class="home__metric">
        <strong>15</strong>
        <span>种影视创作类型</span>
      </div>
      <div class="home__metric">
        <strong>{{ displayMetric(provinces.length) }}</strong>
        <span>个省份素材入口</span>
      </div>
      <div class="home__metric">
        <strong>{{ displayMetric(totalEntries) }}</strong>
        <span>条文化素材</span>
      </div>
      <div class="home__metric">
        <strong>{{ displayMetric(projectCount) }}</strong>
        <span>个在库项目</span>
      </div>
    </section>

    <section class="home__section home__section--workflow">
      <div class="home__section-intro">
        <div>
          <p class="home__section-kicker">FROM SOURCE TO SCREEN</p>
          <h2>同一条链路，承接创意与生产</h2>
        </div>
        <p>
          Story Agent 不只生成一篇故事。每一步都保留结构、依据和版本，让编剧、导演与制作人员拿到同一份可继续工作的上下文。
        </p>
      </div>

      <div class="home__capability-grid">
        <article
          v-for="(capability, index) in capabilities"
          :key="capability.title"
          class="home__capability"
        >
          <div class="home__capability-top">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <i aria-hidden="true">{{ capability.glyph }}</i>
          </div>
          <h3>{{ capability.title }}</h3>
          <p>{{ capability.description }}</p>
          <ul>
            <li v-for="item in capability.items" :key="item">{{ item }}</li>
          </ul>
        </article>
      </div>
    </section>

    <section class="home__section">
      <div class="home__section-intro home__section-intro--compact">
        <div>
          <p class="home__section-kicker">WORKSPACES</p>
          <h2>从这里进入工作</h2>
        </div>
        <RouterLink class="home__text-link" to="/story-agent/runs">
          查看 Agent 运行记录
          <span aria-hidden="true">→</span>
        </RouterLink>
      </div>

      <div class="home__workbench">
        <RouterLink class="home__workbench-card home__workbench-card--featured" to="/story/new">
          <span class="home__workbench-number">01</span>
          <div>
            <span class="home__workbench-kicker">独立项目</span>
            <h2>单片短片</h2>
            <p>从一个文化主题出发，选择类型、用途与真实度边界，进入蓝图、剧本、场景、图片资产和 Seedance 交付链。</p>
          </div>
          <span class="home__workbench-arrow" aria-hidden="true">↗</span>
        </RouterLink>

        <RouterLink class="home__workbench-card" to="/projects">
          <span class="home__workbench-number">02</span>
          <div>
            <span class="home__workbench-kicker">项目指挥</span>
            <h3>继续已有项目</h3>
            <p>版本管理、局部重写、质量修复与交付检查都在项目上下文中发生。</p>
            <span class="home__workbench-data">{{ projectCount }} 个项目在库</span>
          </div>
          <span class="home__workbench-arrow" aria-hidden="true">→</span>
        </RouterLink>

        <RouterLink class="home__workbench-card" to="/knowledge">
          <span class="home__workbench-number">03</span>
          <div>
            <span class="home__workbench-kicker">文化素材</span>
            <h3>查找可信创作起点</h3>
            <p>按省份、主题与类型探索文化资料，让事实、传说与艺术虚构各守边界。</p>
            <span class="home__workbench-data">{{ totalEntries }} 条素材可检索</span>
          </div>
          <span class="home__workbench-arrow" aria-hidden="true">→</span>
        </RouterLink>

        <RouterLink class="home__workbench-card" to="/ai-comic-series/new">
          <span class="home__workbench-number">04</span>
          <div>
            <span class="home__workbench-kicker">多集项目</span>
            <h2>漫剧系列</h2>
            <p>先规划主线、人物弧和连续性账本，再逐集生成可生产的故事包。</p>
            <span class="home__workbench-data">分集生产 · 跨集记忆</span>
          </div>
          <span class="home__workbench-arrow" aria-hidden="true">→</span>
        </RouterLink>
      </div>
    </section>

    <section class="home__principles">
      <div class="home__principles-copy">
        <p class="home__section-kicker">PRODUCTION DISCIPLINE</p>
        <h2>速度之外，还要有可控性。</h2>
      </div>
      <div class="home__principle-list">
        <article v-for="principle in principles" :key="principle.title">
          <span aria-hidden="true">{{ principle.mark }}</span>
          <div>
            <h3>{{ principle.title }}</h3>
            <p>{{ principle.description }}</p>
          </div>
        </article>
      </div>
    </section>

    <section class="home__section home__recent">
      <div class="home__section-intro home__section-intro--compact">
        <div>
          <p class="home__section-kicker">RECENT PROJECTS</p>
          <h2>最近推进的项目</h2>
        </div>
        <RouterLink class="home__text-link" to="/projects">
          查看全部项目
          <span aria-hidden="true">→</span>
        </RouterLink>
      </div>

      <div v-if="recentStories.length > 0" class="home__recent-list">
        <RouterLink
          v-for="story in recentStories"
          :key="story.project_id"
          class="home__story-card"
          :to="`/projects/${story.project_id}`"
        >
          <div class="home__story-head">
            <span>{{ typeLabel(story.video_type) }}</span>
            <time v-if="story.updated_at" :datetime="story.updated_at">
              {{ formatDate(story.updated_at) }}
            </time>
          </div>
          <h3>{{ story.title }}</h3>
          <p v-if="story.logline" class="home__story-logline">{{ story.logline }}</p>
          <p v-else class="home__story-logline home__story-logline--muted">
            来源：{{ story.source_entry }}
          </p>
          <div class="home__story-foot">
            <span>{{ story.scene_count }} 个场景</span>
            <span :class="{ 'home__story-ready': story.has_gears_segments }">
              {{ story.has_gears_segments ? 'GEARS 已就绪' : '等待生产分段' }}
            </span>
            <span aria-hidden="true">↗</span>
          </div>
        </RouterLink>
      </div>

      <div v-else-if="loading" class="home__empty">
        <span class="home__loader" aria-hidden="true" />
        <p>正在读取最近项目…</p>
      </div>
      <div v-else class="home__empty">
        <span aria-hidden="true">◇</span>
        <div>
          <strong>{{ storyError ? '项目暂时无法读取' : '还没有单片项目' }}</strong>
          <p>{{ storyError || '从一个文化主题开始，第一份项目会出现在这里。' }}</p>
        </div>
        <RouterLink v-if="!storyError" to="/story/new">创建项目</RouterLink>
      </div>
    </section>

    <p v-if="provinceError" class="home__data-notice">
      素材库统计暂不可用：{{ provinceError }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getProvinces } from '@/api/system'
import { listProjects } from '@/api/projects'
import type { ProvinceInfo, StoryProjectListItem } from '@shared/types'

const pipelineStages = [
  { title: '可信素材', detail: '文化条目 · 用户材料 · 证据边界', status: '✓' },
  { title: 'Story Blueprint', detail: '主题 · 人物 · 冲突 · 结构', status: '✓' },
  { title: '专业剧本', detail: '场次 · 动作 · 对白 · 节奏', status: '✓' },
  { title: '场景与 GEARS', detail: '镜头意图 · 时长 · 连续性', status: '✓' },
  { title: '视觉资产', detail: '角色 · 场景 · 关键帧', status: '✓' },
  { title: 'Seedance 交付', detail: '分段提示 · 素材映射 · 清单', status: '→' },
]

const capabilities = [
  {
    glyph: '策',
    title: '先建立故事骨架',
    description: '从用途、受众和真实度边界出发，先完成可检查的 Story Blueprint，再进入文风生成。',
    items: ['15 种类型画像', '结构与人物弧', '事实 / 传说 / 虚构分层'],
  },
  {
    glyph: '镜',
    title: '把剧本拆到镜头之前',
    description: '将故事转换为场景、视觉意图与生产分段，确保每一段都能被导演和生成工具继续使用。',
    items: ['专业剧本格式', 'Scene Breakdown', 'GEARS / Seedance 提示'],
  },
  {
    glyph: '审',
    title: '让质量问题可以修复',
    description: '不是一次生成后结束，而是保存运行、验证结果与修复记录，在失败处恢复而不是从头再来。',
    items: ['质量门禁', '局部重写', '版本与运行账本'],
  },
]

const principles = [
  {
    mark: '壹',
    title: '结构先于文风',
    description: '先确认主题、人物、冲突与场景职责，再追求语言表现。',
  },
  {
    mark: '贰',
    title: '证据边界清晰',
    description: '事实有依据，传说有标注，艺术虚构不伪装成历史结论。',
  },
  {
    mark: '叁',
    title: '执行过程可恢复',
    description: '分阶段保存产物与问题，重试只处理真正失败的部分。',
  },
]

const provinces = ref<ProvinceInfo[]>([])
const recentStories = ref<StoryProjectListItem[]>([])
const loading = ref(false)
const provinceError = ref('')
const storyError = ref('')
const totalProjectCount = ref(0)

const totalEntries = computed(() => provinces.value.reduce((sum, province) => sum + province.entry_count, 0))
const projectCount = computed(() => totalProjectCount.value)

function displayMetric(value: number): string {
  if (loading.value && value === 0) return '—'
  return new Intl.NumberFormat('zh-CN').format(value)
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    character_story: '人物故事',
    culture_promo: '文化宣传',
    scene_short: '场景短片',
    historical_drama: '历史剧情',
    legend_story: '传说故事',
    heritage_promo: '非遗宣传',
    city_brand_promo: '城市文旅',
    documentary_short: '微纪录',
    explainer_video: '知识讲解',
    lecture_video: '宣讲片',
    education_training: '教育培训',
    children_story: '儿童故事',
    social_short: '竖屏短视频',
    ai_comic_drama: 'AI 漫剧',
    landscape_mood: '山水意境',
  }
  return map[type] ?? type
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

onMounted(async () => {
  loading.value = true
  provinceError.value = ''
  storyError.value = ''

  const [provinceResponse, projectResponse] = await Promise.allSettled([
    getProvinces(),
    listProjects(),
  ])

  if (provinceResponse.status === 'fulfilled' && provinceResponse.value.ok && provinceResponse.value.data) {
    provinces.value = provinceResponse.value.data
  } else if (provinceResponse.status === 'fulfilled') {
    provinceError.value = provinceResponse.value.error?.message ?? '加载省份失败'
  } else {
    provinceError.value = provinceResponse.reason?.message ?? '加载省份失败'
  }

  if (projectResponse.status === 'fulfilled' && projectResponse.value.ok && projectResponse.value.data) {
    totalProjectCount.value = projectResponse.value.data.length
    recentStories.value = projectResponse.value.data.slice(0, 3)
  } else if (projectResponse.status === 'fulfilled') {
    storyError.value = projectResponse.value.error?.message ?? '加载最近项目失败'
  } else {
    storyError.value = projectResponse.reason?.message ?? '加载最近项目失败'
  }

  loading.value = false
})
</script>

<style scoped>
.home {
  --ink: #17211d;
  --ink-soft: #46534c;
  --paper: #f5f1e8;
  --paper-deep: #ece5d8;
  --red: #c4472f;
  --red-dark: #9f3423;
  --jade: #2f6758;
  --line: rgba(31, 46, 39, 0.14);
  max-width: 1240px;
  margin: 0 auto;
  color: var(--ink);
}

.home__hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.85fr);
  gap: clamp(36px, 6vw, 76px);
  min-height: 610px;
  padding: clamp(42px, 6vw, 76px);
  overflow: hidden;
  border-radius: 3px 3px 40px 3px;
  background:
    radial-gradient(circle at 8% 90%, rgba(196, 71, 47, 0.14), transparent 28%),
    linear-gradient(125deg, #f8f5ed 0%, #eee7da 100%);
  box-shadow: inset 0 0 0 1px rgba(70, 54, 38, 0.09);
}

.home__hero::before {
  position: absolute;
  top: -150px;
  right: 33%;
  width: 290px;
  height: 290px;
  border: 1px solid rgba(196, 71, 47, 0.13);
  border-radius: 50%;
  content: '';
}

.home__hero-grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.45;
  background-image:
    linear-gradient(rgba(75, 58, 40, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(75, 58, 40, 0.025) 1px, transparent 1px);
  background-size: 24px 24px;
}

.home__hero-copy,
.home__pipeline {
  position: relative;
  z-index: 1;
}

.home__hero-copy {
  align-self: center;
}

.home__eyebrow {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
  color: var(--red-dark);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.home__eyebrow-mark {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--red);
  color: var(--red);
  font-family: 'Songti SC', STSong, serif;
  font-size: 18px;
  letter-spacing: 0;
  transform: rotate(-4deg);
}

.home__hero h1 {
  max-width: 690px;
  margin: 0;
  font-family: 'Songti SC', STSong, 'Noto Serif CJK SC', serif;
  font-size: clamp(42px, 5vw, 70px);
  font-weight: 700;
  letter-spacing: -0.045em;
  line-height: 1.14;
}

.home__hero h1 span {
  display: block;
  color: var(--red-dark);
}

.home__hero-lead {
  max-width: 650px;
  margin: 28px 0 0;
  color: var(--ink-soft);
  font-size: 17px;
  line-height: 1.9;
}

.home__hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 36px;
}

.home__button {
  display: inline-flex;
  min-height: 52px;
  align-items: center;
  justify-content: center;
  gap: 34px;
  padding: 0 22px;
  border: 1px solid var(--ink);
  color: var(--ink);
  font-size: 14px;
  font-weight: 750;
  text-decoration: none;
  transition: transform 180ms ease, background 180ms ease, color 180ms ease;
}

.home__button:hover {
  color: inherit;
  transform: translateY(-2px);
}

.home__button--primary {
  border-color: var(--red);
  background: var(--red);
  color: #fffaf1;
}

.home__button--primary:hover {
  background: var(--red-dark);
  color: #fff;
}

.home__button--ghost:hover {
  background: var(--ink);
  color: #fff;
}

.home__boundary {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 23px 0 0;
  color: #737b73;
  font-size: 12px;
}

.home__boundary span {
  color: var(--jade);
  font-size: 10px;
}

.home__pipeline {
  align-self: center;
  padding: 26px 25px 22px;
  border: 1px solid rgba(236, 229, 216, 0.16);
  background:
    linear-gradient(155deg, rgba(255, 255, 255, 0.07), transparent 42%),
    #19251f;
  color: #f4efe4;
  box-shadow: 20px 24px 0 rgba(47, 103, 88, 0.13);
}

.home__pipeline-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 21px;
  border-bottom: 1px solid rgba(244, 239, 228, 0.16);
}

.home__pipeline-head div {
  display: grid;
  gap: 5px;
}

.home__pipeline-head div span,
.home__pipeline-output span {
  color: #b8b8a8;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
}

.home__pipeline-head strong {
  font-family: 'Songti SC', STSong, serif;
  font-size: 22px;
}

.home__pipeline-state {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #c7d9c8;
  font-size: 10px;
  letter-spacing: 0.12em;
}

.home__pipeline-state i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #7fb18c;
  box-shadow: 0 0 0 4px rgba(127, 177, 140, 0.12);
}

.home__pipeline-list {
  margin: 0;
  padding: 11px 0;
  list-style: none;
}

.home__pipeline-list li {
  display: grid;
  grid-template-columns: 30px 1fr auto;
  gap: 10px;
  align-items: center;
  min-height: 57px;
  border-bottom: 1px solid rgba(244, 239, 228, 0.1);
}

.home__pipeline-index {
  color: #8b958e;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
}

.home__pipeline-list div {
  display: grid;
  gap: 4px;
}

.home__pipeline-list strong {
  font-size: 14px;
  font-weight: 700;
}

.home__pipeline-list div span {
  color: #9fa89f;
  font-size: 11px;
}

.home__pipeline-status {
  display: grid;
  width: 23px;
  height: 23px;
  place-items: center;
  border: 1px solid rgba(197, 217, 198, 0.3);
  border-radius: 50%;
  color: #a9c7ad;
  font-size: 11px;
}

.home__pipeline-output {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding-top: 11px;
}

.home__pipeline-output strong {
  color: #d7c8aa;
  font-size: 11px;
  font-weight: 600;
}

.home__metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  border-left: 1px solid var(--line);
  background: #fff;
}

.home__metric {
  display: flex;
  min-height: 116px;
  flex-direction: column;
  justify-content: center;
  padding: 20px clamp(18px, 3vw, 34px);
  border-right: 1px solid var(--line);
}

.home__metric:last-child {
  border-right: 0;
}

.home__metric strong {
  font-family: 'Songti SC', STSong, serif;
  font-size: 32px;
  line-height: 1;
}

.home__metric span {
  margin-top: 11px;
  color: #6d786f;
  font-size: 12px;
}

.home__section {
  padding: 96px 0 0;
}

.home__section-intro {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(320px, 0.7fr);
  gap: 70px;
  align-items: end;
  margin-bottom: 35px;
}

.home__section-intro--compact {
  grid-template-columns: 1fr auto;
}

.home__section-kicker {
  margin: 0 0 12px;
  color: var(--red-dark);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0.2em;
}

.home__section-intro h2,
.home__principles h2 {
  margin: 0;
  font-family: 'Songti SC', STSong, serif;
  font-size: clamp(30px, 3.7vw, 46px);
  letter-spacing: -0.035em;
  line-height: 1.2;
}

.home__section-intro > p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 15px;
  line-height: 1.9;
}

.home__text-link {
  display: inline-flex;
  align-items: center;
  gap: 24px;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--ink);
  color: var(--ink);
  font-size: 13px;
  font-weight: 700;
}

.home__text-link:hover {
  color: var(--red-dark);
  border-color: var(--red-dark);
}

.home__capability-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid var(--line);
  border-left: 1px solid var(--line);
}

.home__capability {
  min-height: 390px;
  padding: clamp(25px, 3vw, 40px);
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  background: #fff;
}

.home__capability:nth-child(2) {
  background: var(--paper);
}

.home__capability-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 54px;
}

.home__capability-top > span {
  color: #929b94;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}

.home__capability-top i {
  display: grid;
  width: 47px;
  height: 47px;
  place-items: center;
  border: 1px solid rgba(196, 71, 47, 0.36);
  color: var(--red);
  font-family: 'Songti SC', STSong, serif;
  font-size: 21px;
  font-style: normal;
  transform: rotate(3deg);
}

.home__capability h3 {
  margin: 0 0 16px;
  font-family: 'Songti SC', STSong, serif;
  font-size: 25px;
}

.home__capability > p {
  min-height: 78px;
  margin: 0;
  color: var(--ink-soft);
  font-size: 14px;
  line-height: 1.75;
}

.home__capability ul {
  display: grid;
  gap: 9px;
  margin: 24px 0 0;
  padding: 18px 0 0;
  border-top: 1px solid var(--line);
  list-style: none;
}

.home__capability li {
  position: relative;
  padding-left: 15px;
  color: #59665f;
  font-size: 12px;
}

.home__capability li::before {
  position: absolute;
  top: 0.55em;
  left: 0;
  width: 5px;
  height: 5px;
  background: var(--jade);
  content: '';
  transform: rotate(45deg);
}

.home__workbench {
  display: grid;
  grid-template-columns: 1.25fr 0.75fr;
  gap: 14px;
}

.home__workbench-card {
  position: relative;
  display: grid;
  grid-template-columns: 44px 1fr auto;
  gap: 20px;
  min-height: 230px;
  padding: 30px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  text-decoration: none;
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.home__workbench-card:hover {
  color: var(--ink);
  border-color: rgba(196, 71, 47, 0.65);
  box-shadow: 0 18px 45px rgba(33, 42, 36, 0.08);
  transform: translateY(-3px);
}

.home__workbench-card--featured {
  grid-row: span 2;
  min-height: 474px;
  align-content: end;
  overflow: hidden;
  background:
    radial-gradient(circle at 78% 18%, rgba(196, 71, 47, 0.25) 0 3%, transparent 3.3%),
    radial-gradient(circle at 78% 18%, transparent 0 18%, rgba(196, 71, 47, 0.11) 18.2% 18.5%, transparent 18.7%),
    radial-gradient(circle at 78% 18%, transparent 0 29%, rgba(196, 71, 47, 0.07) 29.2% 29.5%, transparent 29.7%),
    var(--paper);
}

.home__workbench-number {
  color: #8a948c;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}

.home__workbench-kicker {
  color: var(--red-dark);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.home__workbench-card h2,
.home__workbench-card h3 {
  max-width: 520px;
  margin: 14px 0 12px;
  font-family: 'Songti SC', STSong, serif;
  font-size: 25px;
  line-height: 1.35;
}

.home__workbench-card--featured h2 {
  font-size: clamp(29px, 3vw, 39px);
}

.home__workbench-card p {
  max-width: 540px;
  margin: 0;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.75;
}

.home__workbench-data {
  display: inline-block;
  margin-top: 20px;
  color: #728078;
  font-size: 11px;
}

.home__workbench-arrow {
  align-self: start;
  color: var(--red);
  font-size: 20px;
}

.home__principles {
  display: grid;
  grid-template-columns: 0.8fr 1.2fr;
  gap: 85px;
  margin-top: 96px;
  padding: clamp(42px, 6vw, 70px);
  background: var(--jade);
  color: #f6f1e8;
}

.home__principles .home__section-kicker {
  color: #d9c6a5;
}

.home__principle-list {
  display: grid;
}

.home__principle-list article {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 20px;
  padding: 23px 0;
  border-bottom: 1px solid rgba(246, 241, 232, 0.2);
}

.home__principle-list article:first-child {
  padding-top: 0;
}

.home__principle-list article:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.home__principle-list > article > span {
  color: #d9c6a5;
  font-family: 'Songti SC', STSong, serif;
}

.home__principle-list h3 {
  margin: 0 0 6px;
  font-size: 15px;
}

.home__principle-list p {
  margin: 0;
  color: rgba(246, 241, 232, 0.72);
  font-size: 12px;
  line-height: 1.7;
}

.home__recent {
  padding-bottom: 70px;
}

.home__recent-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.home__story-card {
  display: flex;
  min-height: 260px;
  flex-direction: column;
  padding: 25px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  text-decoration: none;
  transition: border-color 180ms ease, transform 180ms ease;
}

.home__story-card:hover {
  color: var(--ink);
  border-color: var(--red);
  transform: translateY(-3px);
}

.home__story-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.home__story-head > span {
  color: var(--red-dark);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.home__story-head time {
  color: #8a948d;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
}

.home__story-card h3 {
  margin: 33px 0 12px;
  font-family: 'Songti SC', STSong, serif;
  font-size: 23px;
  line-height: 1.35;
}

.home__story-logline {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.home__story-logline--muted {
  color: #7f8982;
}

.home__story-foot {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: auto;
  padding-top: 22px;
  border-top: 1px solid var(--line);
  color: #7c867f;
  font-size: 10px;
}

.home__story-foot span:last-child {
  margin-left: auto;
  color: var(--red);
  font-size: 16px;
}

.home__story-ready {
  color: var(--jade);
  font-weight: 700;
}

.home__empty {
  display: flex;
  min-height: 145px;
  align-items: center;
  gap: 20px;
  padding: 28px;
  border: 1px dashed rgba(31, 46, 39, 0.25);
  background: #faf8f2;
}

.home__empty > span:not(.home__loader) {
  color: var(--red);
  font-size: 30px;
}

.home__empty strong {
  font-family: 'Songti SC', STSong, serif;
  font-size: 18px;
}

.home__empty p {
  margin: 6px 0 0;
  color: #778079;
  font-size: 12px;
}

.home__empty a {
  margin-left: auto;
  color: var(--red-dark);
  font-size: 12px;
  font-weight: 700;
}

.home__loader {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(47, 103, 88, 0.2);
  border-top-color: var(--jade);
  border-radius: 50%;
  animation: home-spin 800ms linear infinite;
}

.home__data-notice {
  margin: -45px 0 55px;
  color: #8a5a18;
  font-size: 11px;
  text-align: center;
}

@keyframes home-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 980px) {
  .home__hero {
    grid-template-columns: 1fr;
  }

  .home__pipeline {
    width: 100%;
    max-width: 620px;
  }

  .home__section-intro,
  .home__principles {
    grid-template-columns: 1fr;
    gap: 30px;
  }

  .home__capability-grid,
  .home__recent-list {
    grid-template-columns: 1fr;
  }

  .home__capability {
    min-height: auto;
  }

  .home__capability > p {
    min-height: 0;
  }
}

@media (max-width: 720px) {
  .home__hero {
    min-height: auto;
    padding: 34px 20px 46px;
    border-radius: 2px 2px 24px 2px;
  }

  .home__hero h1 {
    font-size: clamp(38px, 12vw, 54px);
  }

  .home__hero-lead {
    font-size: 15px;
  }

  .home__button {
    width: 100%;
  }

  .home__pipeline {
    padding: 22px 18px 18px;
    box-shadow: 10px 12px 0 rgba(47, 103, 88, 0.13);
  }

  .home__pipeline-list li {
    grid-template-columns: 26px 1fr auto;
  }

  .home__metrics {
    grid-template-columns: repeat(2, 1fr);
  }

  .home__metric:nth-child(2) {
    border-right: 0;
  }

  .home__metric:nth-child(-n + 2) {
    border-bottom: 1px solid var(--line);
  }

  .home__section {
    padding-top: 70px;
  }

  .home__section-intro,
  .home__section-intro--compact {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .home__text-link {
    justify-self: start;
  }

  .home__workbench {
    grid-template-columns: 1fr;
  }

  .home__workbench-card,
  .home__workbench-card--featured {
    grid-row: auto;
    min-height: 290px;
    padding: 24px 20px;
  }

  .home__workbench-card {
    grid-template-columns: 30px 1fr auto;
    gap: 12px;
  }

  .home__principles {
    margin-top: 70px;
    padding: 42px 24px;
  }

  .home__recent {
    padding-bottom: 45px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home__button,
  .home__workbench-card,
  .home__story-card {
    transition: none;
  }

  .home__loader {
    animation: none;
  }
}
</style>
