<template>
  <div class="projects-page">
    <header class="projects-page__header">
      <div>
        <h1 class="projects-page__title">故事项目</h1>
        <p class="projects-page__desc">管理已生成的故事草稿，查看来源条目、状态和最近更新时间。</p>
      </div>
      <RouterLink class="projects-page__cta" to="/story/new">新建故事</RouterLink>
    </header>

    <section class="projects-page__toolbar">
      <input
        v-model="searchQuery"
        class="projects-page__search"
        placeholder="搜索标题、来源条目…"
      />
      <select v-model="statusFilter" class="projects-page__select">
        <option value="">全部状态</option>
        <option value="draft">草稿</option>
        <option value="edited">已编辑</option>
        <option value="exported">已导出</option>
        <option value="finalized">已定稿</option>
      </select>
    </section>

    <div v-if="loading" class="projects-page__loading">
      <div class="projects-page__spinner" />
      <p>正在加载故事项目…</p>
    </div>

    <div v-else-if="error" class="projects-page__error">{{ error }}</div>

    <section v-else class="projects-page__grid">
      <RouterLink
        v-for="project in filteredProjects"
        :key="project.project_id"
        class="projects-page__card"
        :to="`/projects/${project.project_id}`"
      >
        <div class="projects-page__card-top">
          <span class="projects-page__status-badge" :data-status="project.status">{{ statusLabel(project.status) }}</span>
          <span class="projects-page__video-type">{{ typeLabel(project.video_type) }}</span>
        </div>
        <h2 class="projects-page__card-title">{{ project.title }}</h2>
        <p class="projects-page__source">来源：{{ project.source_entry }}</p>
        <p v-if="project.logline" class="projects-page__logline">{{ project.logline }}</p>
        <div class="projects-page__meta">
          <span>{{ formatDate(project.updated_at) }}</span>
          <span>{{ project.scene_count }} 场景</span>
          <span v-if="project.has_gears_segments">GEARS 已生成</span>
          <span v-else>无 GEARS 分段</span>
        </div>
      </RouterLink>

      <div v-if="filteredProjects.length === 0" class="projects-page__empty">
        <p>还没有匹配到故事项目，可以先去故事工坊生成一个初稿。</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { listProjects } from '@/api/projects'
import type { StoryProjectListItem, StoryProjectStatus } from '@shared/types'

const projects = ref<StoryProjectListItem[]>([])
const loading = ref(false)
const error = ref('')
const searchQuery = ref('')
const statusFilter = ref('')

const filteredProjects = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return projects.value.filter(project => {
    const matchesStatus = !statusFilter.value || project.status === statusFilter.value
    const matchesQuery = !query
      || project.title.toLowerCase().includes(query)
      || project.source_entry.toLowerCase().includes(query)
    return matchesStatus && matchesQuery
  })
})

function statusLabel(status: StoryProjectStatus): string {
  const map: Record<StoryProjectStatus, string> = {
    draft: '草稿',
    edited: '已编辑',
    exported: '已导出',
    finalized: '已定稿',
  }
  return map[status]
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
    ai_comic_drama: 'AI漫剧',
    landscape_mood: '山水意境',
  }
  return map[type] ?? type
}

function formatDate(iso: string): string {
  if (!iso) return '未记录'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(async () => {
  loading.value = true
  error.value = ''
  const res = await listProjects()
  if (res.ok && res.data) {
    projects.value = res.data
  } else {
    error.value = res.error?.message ?? '加载故事项目失败'
  }
  loading.value = false
})
</script>

<style scoped>
.projects-page {
  max-width: 1180px;
  margin: 0 auto;
}

.projects-page__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 20px;
}

.projects-page__title {
  margin: 0 0 6px 0;
  font-size: 28px;
  color: #22313f;
}

.projects-page__desc {
  margin: 0;
  color: #66727f;
  line-height: 1.6;
}

.projects-page__cta {
  flex: 0 0 auto;
  padding: 10px 14px;
  border-radius: 4px;
  background: #2980b9;
  color: #fff;
  text-decoration: none;
  font-size: 14px;
}

.projects-page__toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.projects-page__search,
.projects-page__select {
  padding: 10px 12px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  font-size: 14px;
}

.projects-page__search {
  flex: 1;
}

.projects-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.projects-page__card {
  display: block;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid #d9e2ea;
  background: #fff;
  text-decoration: none;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}

.projects-page__card:hover {
  border-color: #2980b9;
  box-shadow: 0 8px 24px rgba(41, 128, 185, 0.08);
  transform: translateY(-1px);
}

.projects-page__card-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.projects-page__status-badge,
.projects-page__video-type {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.projects-page__status-badge {
  background: #eef3f7;
  color: #51606d;
}

.projects-page__status-badge[data-status='draft'] {
  background: #eef6ff;
  color: #2b78b7;
}

.projects-page__video-type {
  background: #f7f3eb;
  color: #8d5b10;
}

.projects-page__card-title {
  margin: 0 0 8px 0;
  color: #22313f;
  font-size: 22px;
  line-height: 1.25;
}

.projects-page__source {
  margin: 0 0 8px 0;
  color: #6b7884;
  font-size: 14px;
}

.projects-page__logline {
  margin: 0 0 12px 0;
  color: #2f4358;
  font-size: 15px;
  line-height: 1.6;
}

.projects-page__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: #7c8894;
  font-size: 13px;
}

.projects-page__loading,
.projects-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: #7f8c8d;
}

.projects-page__spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #ecf0f1;
  border-top: 3px solid #2980b9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.projects-page__error {
  padding: 10px 14px;
  background: #fdecea;
  color: #c0392b;
  border-radius: 4px;
  font-size: 14px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 720px) {
  .projects-page__header,
  .projects-page__toolbar {
    flex-direction: column;
  }

  .projects-page__cta,
  .projects-page__search,
  .projects-page__select {
    width: 100%;
  }
}
</style>
