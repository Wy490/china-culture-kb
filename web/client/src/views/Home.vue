<template>
  <div class="home">
    <section class="home__hero">
      <div class="home__hero-copy">
        <p class="home__hero-eyebrow">Story Agent 工作台</p>
        <h1 class="home__hero-title">从知识库到故事项目的创作主控台</h1>
        <p class="home__hero-desc">浏览知识库、生成初稿、管理故事项目，并逐步进入局部重写与导出流程。</p>
      </div>
    </section>

    <section class="home__workbench">
      <RouterLink class="home__workbench-card home__workbench-card--library" to="/knowledge">
        <span class="home__workbench-kicker">知识库</span>
        <h2>中国文化知识库</h2>
        <p>省份、类型和主题条目从统一入口进入，首页不再铺开全部目录。</p>
        <div class="home__workbench-meta">
          <span>{{ provinces.length }} 个省份</span>
          <span>{{ totalEntries }} 条条目</span>
        </div>
      </RouterLink>

      <RouterLink class="home__workbench-card home__workbench-card--projects" to="/projects">
        <span class="home__workbench-kicker">项目</span>
        <h2>故事项目</h2>
        <p>查看最近生成结果，后续在这里承接局部修改、版本管理和导出。</p>
        <div class="home__workbench-meta">
          <span>{{ projectCount }} 个项目</span>
          <span>{{ recentStories.length }} 个最近更新</span>
        </div>
      </RouterLink>

      <RouterLink class="home__workbench-card home__workbench-card--studio" to="/story/new">
        <span class="home__workbench-kicker">生成</span>
        <h2>故事工坊</h2>
        <p>从词条、主题或大纲出发生成故事方案，并为后续编辑保留结构化结果。</p>
        <div class="home__workbench-meta">
          <span>支持多成片类型</span>
          <span>输出 GEARS segments</span>
        </div>
      </RouterLink>
    </section>

    <section v-if="provinces.length > 0" class="home__stats">
      <h2 class="home__section-title">工作台概览</h2>
      <div class="home__stats-grid">
        <div class="home__stat-card">
          <span class="home__stat-number">{{ totalEntries }}</span>
          <span class="home__stat-label">总条目数</span>
        </div>
        <div class="home__stat-card">
          <span class="home__stat-number">{{ provinces.length }}</span>
          <span class="home__stat-label">覆盖省份</span>
        </div>
        <div class="home__stat-card">
          <span class="home__stat-number">{{ projectCount }}</span>
          <span class="home__stat-label">故事项目</span>
        </div>
      </div>
    </section>

    <section v-if="recentStories.length > 0" class="home__recent">
      <div class="home__section-header">
        <h2 class="home__section-title">最近生成故事</h2>
        <RouterLink class="home__section-link" to="/projects">查看全部故事</RouterLink>
      </div>
      <div class="home__recent-list">
        <RouterLink
          v-for="story in recentStories"
          :key="story.project_id"
          class="home__story-card"
          :to="`/projects/${story.project_id}`"
        >
          <span class="home__story-type-badge">{{ typeLabel(story.video_type) }}</span>
          <h3 class="home__story-title">{{ story.title }}</h3>
          <p class="home__story-source">来源: {{ story.source_entry }}</p>
          <p v-if="story.logline" class="home__story-logline">{{ story.logline }}</p>
          <div class="home__story-meta-row">
            <span v-if="story.updated_at" class="home__story-date">{{ formatDate(story.updated_at) }}</span>
            <span v-if="story.has_gears_segments" class="home__story-gears-badge">✅ GEARS</span>
            <span v-else class="home__story-gears-badge--none">⭕ 无分段</span>
            <span
              v-if="story.gears_video_status"
              :class="['home__story-video-badge', `home__story-video-badge--${story.gears_video_status}`]"
            >
              {{ gearsVideoStatusLabel(story.gears_video_status) }}
            </span>
            <span class="home__story-scenes">{{ story.scene_count }} 场景</span>
          </div>
        </RouterLink>
      </div>
    </section>
    <div v-else-if="storyError" class="home__notice">
      最近生成故事暂不可用：{{ storyError }}
    </div>

    <div v-if="loading" class="home__loading">
      <div class="home__spinner" />
      <p>正在加载知识库数据…</p>
    </div>
    <div v-else-if="provinceError" class="home__error">{{ provinceError }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getProvinces } from '@/api/system'
import { listProjects } from '@/api/projects'
import type { GearsVideoStatus, ProvinceInfo, StoryProjectListItem } from '@shared/types'
const provinces = ref<ProvinceInfo[]>([])
const recentStories = ref<StoryProjectListItem[]>([])
const loading = ref(false)
const provinceError = ref('')
const storyError = ref('')
const totalProjectCount = ref(0)

const totalEntries = computed(() => provinces.value.reduce((sum, p) => sum + p.entry_count, 0))
const projectCount = computed(() => totalProjectCount.value)

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
    ai_comic_drama: 'AI漫剧',
    landscape_mood: '山水意境',
  }
  return map[type] ?? type
}

function gearsVideoStatusLabel(status: GearsVideoStatus): string {
  const map: Record<GearsVideoStatus, string> = {
    processing: '成片中',
    ready: '成片',
    failed: '未完成',
  }
  return map[status]
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

onMounted(async () => {
  loading.value = true
  provinceError.value = ''
  storyError.value = ''

  const [provRes, storyRes] = await Promise.allSettled([
    getProvinces(),
    listProjects(),
  ])

  if (provRes.status === 'fulfilled' && provRes.value.ok && provRes.value.data) {
    provinces.value = provRes.value.data
  } else if (provRes.status === 'fulfilled') {
    provinceError.value = provRes.value.error?.message ?? '加载省份失败'
  } else {
    provinceError.value = provRes.reason?.message ?? '加载省份失败'
  }

  if (storyRes.status === 'fulfilled' && storyRes.value.ok && storyRes.value.data) {
    totalProjectCount.value = storyRes.value.data.length
    recentStories.value = storyRes.value.data.slice(0, 3)
  } else if (storyRes.status === 'fulfilled') {
    storyError.value = storyRes.value.error?.message ?? '加载最近故事失败'
  } else {
    storyError.value = storyRes.reason?.message ?? '加载最近故事失败'
  }

  loading.value = false
})
</script>

<style scoped>
.home {
  max-width: 1120px;
  margin: 0 auto;
}

.home__hero {
  margin-bottom: 22px;
  padding: 38px 32px;
  border-radius: 12px;
  background:
    radial-gradient(circle at top right, rgba(252, 214, 93, 0.28), transparent 28%),
    linear-gradient(135deg, #17324d 0%, #1f6fa4 62%, #f2eee6 160%);
  color: #eff5f8;
}

.home__hero-title {
  max-width: 720px;
  margin: 0;
  font-size: 38px;
  font-weight: 700;
  line-height: 1.18;
}

.home__hero-desc {
  max-width: 680px;
  margin: 12px 0 0 0;
  font-size: 17px;
  line-height: 1.7;
  color: rgba(239, 245, 248, 0.88);
}

.home__hero-eyebrow {
  margin: 0 0 10px 0;
  color: rgba(255, 247, 230, 0.88);
  font-size: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.home__workbench {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 24px;
}

.home__workbench-card {
  display: block;
  min-height: 210px;
  padding: 18px;
  border-radius: 12px;
  text-decoration: none;
  border: 1px solid #d8e1e8;
  background: #fff;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}

.home__workbench-card:hover {
  transform: translateY(-2px);
  border-color: #2f83bd;
  box-shadow: 0 10px 24px rgba(31, 111, 164, 0.1);
}

.home__workbench-card h2 {
  margin: 8px 0 10px 0;
  color: #22313f;
  font-size: 24px;
}

.home__workbench-card p {
  margin: 0 0 18px 0;
  color: #5e6d79;
  line-height: 1.65;
}

.home__workbench-kicker {
  display: inline-flex;
  align-items: center;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.home__workbench-card--library .home__workbench-kicker {
  background: #f3ede3;
  color: #8a5a18;
}

.home__workbench-card--projects .home__workbench-kicker {
  background: #e9f3fb;
  color: #1f6fa4;
}

.home__workbench-card--studio .home__workbench-kicker {
  background: #edf5ef;
  color: #2f7a4a;
}

.home__workbench-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: #72808d;
  font-size: 13px;
}

.home__section-title {
  margin: 0 0 12px 0;
  font-size: 20px;
  color: #2c3e50;
  border-bottom: 1px solid #ecf0f1;
  padding-bottom: 4px;
}

.home__section-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  border-bottom: 1px solid #ecf0f1;
  margin-bottom: 8px;
}

.home__section-header .home__section-title {
  border-bottom: 0;
  margin-bottom: 0;
}

.home__section-link {
  color: #2980b9;
  text-decoration: none;
  font-size: 14px;
}

.home__section-link:hover {
  text-decoration: underline;
}

.home__section-desc {
  margin: 0 0 14px 0;
  color: #66727f;
  font-size: 14px;
}

.home__stats {
  margin-bottom: 24px;
}

.home__stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.home__stat-card {
  text-align: center;
  padding: 14px 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.home__stat-number {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #2980b9;
}

.home__stat-label {
  display: block;
  font-size: 14px;
  color: #7f8c8d;
  margin-top: 4px;
}

.home__recent {
  margin-bottom: 24px;
}

.home__notice {
  padding: 10px 14px;
  margin-bottom: 24px;
  background: #fff7e6;
  color: #8a5a00;
  border-radius: 4px;
  font-size: 14px;
}

.home__recent-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.home__story-card {
  padding: 12px 16px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: #fff;
  text-decoration: none;
  transition: border-color 0.2s;
}

.home__story-card:hover {
  border-color: #3498db;
}

.home__story-type-badge {
  display: inline-block;
  padding: 2px 8px;
  background: #eaf2f8;
  color: #2980b9;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
}

.home__story-title {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 700;
  color: #2c3e50;
}

.home__story-source {
  margin: 0;
  font-size: 13px;
  color: #7f8c8d;
}

.home__story-logline {
  margin: 4px 0 0 0;
  font-size: 14px;
  color: #34495e;
  font-style: italic;
  line-height: 1.4;
}

.home__story-meta-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}

.home__story-date {
  font-size: 12px;
  color: #7f8c8d;
}

.home__story-gears-badge {
  padding: 2px 6px;
  background: #d5f5e3;
  color: #27ae60;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
}

.home__story-gears-badge--none {
  padding: 2px 6px;
  background: #f8f9fa;
  color: #7f8c8d;
  border-radius: 3px;
  font-size: 12px;
}

.home__story-video-badge {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
}

.home__story-video-badge--ready {
  background: #d5f5e3;
  color: #1b7f4a;
}

.home__story-video-badge--processing {
  background: #eaf2f8;
  color: #2b78b7;
}

.home__story-video-badge--failed {
  background: #fdecea;
  color: #b13b2e;
}

.home__story-scenes {
  font-size: 12px;
  color: #7f8c8d;
}
.home__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px;
  color: #7f8c8d;
}

.home__spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #ecf0f1;
  border-top: 3px solid #2980b9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.home__error {
  padding: 10px 14px;
  background: #fdecea;
  color: #c0392b;
  border-radius: 4px;
  font-size: 14px;
  margin-top: 12px;
}

@media (max-width: 960px) {
  .home__workbench {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .home__hero {
    padding: 28px 20px;
  }

  .home__hero-title {
    font-size: 30px;
  }

  .home__stats-grid,
  .home__recent-list {
    grid-template-columns: 1fr;
  }
}
</style>
