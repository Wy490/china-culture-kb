<template>
  <div class="projects-page">
    <header class="projects-page__header">
      <div>
        <h1 class="projects-page__title">故事项目</h1>
        <p class="projects-page__desc">管理已生成的故事草稿，查看来源条目、状态和最近更新时间。</p>
      </div>
      <div class="projects-page__header-actions">
        <button
          class="projects-page__muted-btn"
          :disabled="projects.length <= RETAIN_RECENT_COUNT || retainingRecent || batchDeleting || deletingProjectId !== ''"
          @click="handleRetainRecentProjects"
        >
          {{ retainingRecent ? '清理中…' : `按生成时间保留最近 ${RETAIN_RECENT_COUNT} 个` }}
        </button>
        <RouterLink class="projects-page__cta" to="/story/new">新建故事</RouterLink>
      </div>
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
      <select v-model="videoStatusFilter" class="projects-page__select">
        <option value="">全部成片</option>
        <option value="none">未回传</option>
        <option value="processing">制作中</option>
        <option value="ready">已就绪</option>
        <option value="failed">未完成</option>
      </select>
      <label class="projects-page__toggle">
        <input v-model="supplementFilter" type="checkbox" />
        <span>仅看待补资料</span>
      </label>
      <label class="projects-page__toggle">
        <input v-model="qualityFilter" type="checkbox" />
        <span>仅看质量问题</span>
      </label>
    </section>

    <section v-if="filteredProjects.length > 0" class="projects-page__bulkbar">
      <label class="projects-page__bulk-check">
        <input
          type="checkbox"
          :checked="allFilteredSelected"
          :disabled="batchDeleting || deletingProjectId !== ''"
          @change="toggleSelectFiltered"
        />
        <span>已选 {{ selectedProjectIds.length }} / 当前筛选 {{ filteredProjects.length }}</span>
      </label>
      <div class="projects-page__bulk-actions">
        <button class="projects-page__muted-btn" :disabled="selectedProjectIds.length === 0 || batchDeleting" @click="clearSelection">
          清空选择
        </button>
        <button
          class="projects-page__danger-btn"
          :disabled="selectedProjectIds.length === 0 || batchDeleting || deletingProjectId !== ''"
          @click="handleBatchDeleteProjects"
        >
          {{ batchDeleting ? '批量删除中…' : `删除所选 ${selectedProjectIds.length} 个` }}
        </button>
      </div>
    </section>

    <div v-if="loading" class="projects-page__loading">
      <div class="projects-page__spinner" />
      <p>正在加载故事项目…</p>
    </div>

    <div v-else-if="error" class="projects-page__error">{{ error }}</div>
    <div v-if="!loading && !error && projectMessage" class="projects-page__message">{{ projectMessage }}</div>

    <section v-if="!loading && !error" class="projects-page__grid">
      <article
        v-for="project in filteredProjects"
        :key="project.project_id"
        :class="['projects-page__card', selectedProjectIds.includes(project.project_id) ? 'projects-page__card--selected' : '']"
      >
        <label class="projects-page__card-select" :aria-label="`选择 ${project.title}`">
          <input
            v-model="selectedProjectIds"
            type="checkbox"
            :value="project.project_id"
            :disabled="batchDeleting || deletingProjectId !== ''"
          />
        </label>
        <RouterLink class="projects-page__card-link" :to="`/projects/${project.project_id}`">
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
            <span
              v-if="project.gears_video_status"
              :class="['projects-page__meta-video', `projects-page__meta-video--${project.gears_video_status}`]"
            >
              {{ gearsVideoStatusLabel(project.gears_video_status) }}
            </span>
            <span v-if="(project.open_supplement_task_count ?? 0) > 0" class="projects-page__meta-warning">
              待补资料 {{ project.open_supplement_task_count }}
            </span>
            <span
              v-if="typeof project.genre_score === 'number'"
              :class="['projects-page__meta-quality', project.quality_passed ? 'projects-page__meta-quality--pass' : 'projects-page__meta-quality--warn']"
            >
              类型分 {{ project.genre_score }}
            </span>
            <span v-if="(project.quality_issue_count ?? 0) > 0" class="projects-page__meta-warning">
              质量问题 {{ project.quality_issue_count }}
            </span>
          </div>
        </RouterLink>
        <div class="projects-page__card-actions">
          <button
            class="projects-page__delete-btn"
            :disabled="deletingProjectId === project.project_id"
            @click="handleDeleteProject(project)"
          >
            {{ deletingProjectId === project.project_id ? '删除中…' : '删除' }}
          </button>
        </div>
      </article>

      <div v-if="filteredProjects.length === 0" class="projects-page__empty">
        <p>还没有匹配到故事项目，可以先去故事工坊生成一个初稿。</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { deleteProject, deleteProjects, listProjects, retainRecentProjects } from '@/api/projects'
import type { GearsVideoStatus, StoryProjectListItem, StoryProjectStatus } from '@shared/types'

const RETAIN_RECENT_COUNT = 10

const projects = ref<StoryProjectListItem[]>([])
const loading = ref(false)
const error = ref('')
const projectMessage = ref('')
const searchQuery = ref('')
const statusFilter = ref('')
const videoStatusFilter = ref('')
const supplementFilter = ref(false)
const qualityFilter = ref(false)
const deletingProjectId = ref('')
const selectedProjectIds = ref<string[]>([])
const batchDeleting = ref(false)
const retainingRecent = ref(false)

const filteredProjects = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return projects.value.filter(project => {
    const matchesStatus = !statusFilter.value || project.status === statusFilter.value
    const matchesVideoStatus = !videoStatusFilter.value
      || (videoStatusFilter.value === 'none' && !project.gears_video_status)
      || project.gears_video_status === videoStatusFilter.value
    const matchesSupplement = !supplementFilter.value || (project.open_supplement_task_count ?? 0) > 0
    const matchesQuality = !qualityFilter.value || project.quality_passed === false || (project.quality_issue_count ?? 0) > 0
    const matchesQuery = !query
      || project.title.toLowerCase().includes(query)
      || project.source_entry.toLowerCase().includes(query)
    return matchesStatus && matchesVideoStatus && matchesSupplement && matchesQuality && matchesQuery
  })
})

const allFilteredSelected = computed(() => {
  return filteredProjects.value.length > 0
    && filteredProjects.value.every(project => selectedProjectIds.value.includes(project.project_id))
})

const selectedProjects = computed(() => {
  const selected = new Set(selectedProjectIds.value)
  return projects.value.filter(project => selected.has(project.project_id))
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

function gearsVideoStatusLabel(status: GearsVideoStatus): string {
  const map: Record<GearsVideoStatus, string> = {
    processing: '成片制作中',
    ready: '成片已就绪',
    failed: '成片未完成',
  }
  return map[status]
}

function formatDate(iso: string): string {
  if (!iso) return '未记录'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function handleDeleteProject(project: StoryProjectListItem) {
  const confirmed = window.confirm(`确定删除《${project.title}》吗？这会删除生成故事文件和项目版本记录。`)
  if (!confirmed) return

  deletingProjectId.value = project.project_id
  error.value = ''
  projectMessage.value = ''
  const res = await deleteProject(project.project_id)
  if (res.ok) {
    projects.value = projects.value.filter(item => item.project_id !== project.project_id)
    selectedProjectIds.value = selectedProjectIds.value.filter(id => id !== project.project_id)
    projectMessage.value = '故事项目已删除'
  } else {
    error.value = res.error?.message ?? '删除故事项目失败'
  }
  deletingProjectId.value = ''
}

function toggleSelectFiltered() {
  const filteredIds = filteredProjects.value.map(project => project.project_id)
  if (allFilteredSelected.value) {
    const removeIds = new Set(filteredIds)
    selectedProjectIds.value = selectedProjectIds.value.filter(id => !removeIds.has(id))
    return
  }

  selectedProjectIds.value = [...new Set([...selectedProjectIds.value, ...filteredIds])]
}

function clearSelection() {
  selectedProjectIds.value = []
}

async function handleBatchDeleteProjects() {
  if (selectedProjectIds.value.length === 0) return
  const selectedTitles = selectedProjects.value.slice(0, 3).map(project => `《${project.title}》`).join('、')
  const extraCount = Math.max(0, selectedProjectIds.value.length - 3)
  const titlePreview = `${selectedTitles}${extraCount > 0 ? ` 等 ${selectedProjectIds.value.length} 个项目` : ''}`
  const confirmed = window.confirm(`确定批量删除 ${titlePreview} 吗？这会删除对应生成故事文件和项目版本记录。`)
  if (!confirmed) return

  batchDeleting.value = true
  error.value = ''
  projectMessage.value = ''
  const idsToDelete = [...selectedProjectIds.value]
  const res = await deleteProjects(idsToDelete)
  if (res.ok && res.data) {
    const deletedIds = new Set(res.data.deleted.map(item => item.project_id))
    projects.value = projects.value.filter(item => !deletedIds.has(item.project_id))
    selectedProjectIds.value = selectedProjectIds.value.filter(id => !deletedIds.has(id))
    if (res.data.failed.length > 0) {
      error.value = `已删除 ${res.data.deleted.length} 个，${res.data.failed.length} 个删除失败：${res.data.failed[0].error}`
    } else {
      projectMessage.value = `已删除 ${res.data.deleted.length} 个故事项目`
    }
  } else {
    error.value = res.error?.message ?? '批量删除故事项目失败'
  }
  batchDeleting.value = false
}

async function handleRetainRecentProjects() {
  if (projects.value.length <= RETAIN_RECENT_COUNT) return
  const confirmed = window.confirm(`确定按生成故事时间只保留最近 ${RETAIN_RECENT_COUNT} 个吗？较早项目、孤立项目及对应生成故事文件会被删除。`)
  if (!confirmed) return

  retainingRecent.value = true
  error.value = ''
  projectMessage.value = ''
  const res = await retainRecentProjects(RETAIN_RECENT_COUNT)
  if (res.ok && res.data) {
    projects.value = res.data.kept
    selectedProjectIds.value = selectedProjectIds.value.filter(id => projects.value.some(project => project.project_id === id))
    projectMessage.value = `已按生成时间保留最近 ${res.data.keep_recent} 个，删除 ${res.data.deleted.length} 个故事项目`
    if (res.data.failed.length > 0) {
      await loadProjects()
      error.value = `有 ${res.data.failed.length} 个项目未删除：${res.data.failed[0].error}`
    }
  } else {
    error.value = res.error?.message ?? '清理故事项目失败'
  }
  retainingRecent.value = false
}

async function loadProjects() {
  loading.value = true
  error.value = ''
  projectMessage.value = ''
  const res = await listProjects()
  if (res.ok && res.data) {
    projects.value = res.data
  } else {
    error.value = res.error?.message ?? '加载故事项目失败'
  }
  loading.value = false
}

onMounted(async () => {
  await loadProjects()
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

.projects-page__header-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  align-items: center;
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
  align-items: center;
  margin-bottom: 20px;
}

.projects-page__bulkbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  min-height: 44px;
  margin-bottom: 18px;
  padding: 9px 12px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #f8fafb;
}

.projects-page__bulk-check {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  color: #33475b;
  font-size: 14px;
}

.projects-page__bulk-check input,
.projects-page__card-select input {
  width: 16px;
  height: 16px;
}

.projects-page__bulk-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.projects-page__muted-btn,
.projects-page__danger-btn {
  min-height: 34px;
  padding: 7px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.projects-page__muted-btn {
  border: 1px solid #d7dee5;
  background: #fff;
  color: #33475b;
}

.projects-page__danger-btn {
  border: 1px solid #d4473b;
  background: #d4473b;
  color: #fff;
}

.projects-page__muted-btn:disabled,
.projects-page__danger-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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

.projects-page__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 10px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  color: #33475b;
  font-size: 14px;
  white-space: nowrap;
}

.projects-page__toggle input {
  width: 15px;
  height: 15px;
}

.projects-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.projects-page__card {
  position: relative;
  display: block;
  padding: 16px 16px 16px 44px;
  border-radius: 8px;
  border: 1px solid #d9e2ea;
  background: #fff;
  text-decoration: none;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}

.projects-page__card--selected {
  border-color: #2980b9;
  background: #f6fbff;
}

.projects-page__card-select {
  position: absolute;
  top: 18px;
  left: 16px;
  display: inline-flex;
  align-items: center;
}

.projects-page__card:hover {
  border-color: #2980b9;
  box-shadow: 0 8px 24px rgba(41, 128, 185, 0.08);
  transform: translateY(-1px);
}

.projects-page__card-link {
  display: block;
  color: inherit;
  text-decoration: none;
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

.projects-page__meta-warning {
  color: #a05f00;
  font-weight: 700;
}

.projects-page__meta-quality {
  font-weight: 700;
}

.projects-page__meta-quality--pass {
  color: #1b7f4a;
}

.projects-page__meta-quality--warn {
  color: #b13b2e;
}

.projects-page__meta-video {
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 700;
}

.projects-page__meta-video--ready {
  background: #d5f5e3;
  color: #1b7f4a;
}

.projects-page__meta-video--processing {
  background: #eaf2f8;
  color: #2b78b7;
}

.projects-page__meta-video--failed {
  background: #fdecea;
  color: #b13b2e;
}

.projects-page__card-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #edf1f5;
}

.projects-page__delete-btn {
  padding: 7px 10px;
  border: 1px solid #f0c4bd;
  border-radius: 4px;
  background: #fff;
  color: #b13b2e;
  cursor: pointer;
  font-size: 13px;
}

.projects-page__delete-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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
  margin-bottom: 16px;
}

.projects-page__message {
  padding: 10px 14px;
  background: #eaf7ef;
  color: #1f7a44;
  border-radius: 4px;
  font-size: 14px;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 720px) {
  .projects-page__header,
  .projects-page__toolbar,
  .projects-page__bulkbar {
    flex-direction: column;
    align-items: stretch;
  }

  .projects-page__cta,
  .projects-page__header-actions,
  .projects-page__search,
  .projects-page__select,
  .projects-page__toggle,
  .projects-page__bulk-actions,
  .projects-page__muted-btn,
  .projects-page__danger-btn {
    width: 100%;
  }

  .projects-page__bulk-actions {
    flex-direction: column;
  }

  .projects-page__header-actions {
    align-items: stretch;
  }
}
</style>
