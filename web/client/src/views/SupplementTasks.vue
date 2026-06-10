<template>
  <div class="supplement-page">
    <header class="supplement-page__header">
      <div>
        <h1 class="supplement-page__title">补录任务</h1>
        <p class="supplement-page__desc">集中查看故事项目中的资料补录任务，优先处理仍待补的项目。</p>
      </div>
      <RouterLink class="supplement-page__back" to="/projects">返回项目列表</RouterLink>
    </header>

    <section class="supplement-page__toolbar">
      <input
        v-model="searchQuery"
        class="supplement-page__search"
        placeholder="搜索项目、来源条目、任务标签…"
      />
      <select v-model="statusFilter" class="supplement-page__select">
        <option value="">全部任务</option>
        <option value="open">待补</option>
        <option value="resolved">已完成</option>
      </select>
    </section>

    <section class="supplement-page__summary">
      <div>
        <span>全部</span>
        <strong>{{ tasks.length }}</strong>
      </div>
      <div>
        <span>待补</span>
        <strong>{{ openCount }}</strong>
      </div>
      <div>
        <span>已完成</span>
        <strong>{{ resolvedCount }}</strong>
      </div>
    </section>

    <div v-if="loading" class="supplement-page__state">正在加载补录任务…</div>
    <div v-else-if="error" class="supplement-page__error">{{ error }}</div>

    <section v-else class="supplement-page__list">
      <article v-for="item in filteredTasks" :key="item.task.task_id" class="supplement-page__task">
        <div class="supplement-page__task-main">
          <div class="supplement-page__task-top">
            <span :class="['supplement-page__status', item.task.status === 'open' ? 'supplement-page__status--open' : 'supplement-page__status--resolved']">
              {{ item.task.status === 'open' ? '待补' : '已完成' }}
            </span>
            <span v-if="item.task.category" class="supplement-page__category">{{ categoryLabel(item.task.category) }}</span>
          </div>
          <h2>{{ item.task.label }}</h2>
          <p>{{ item.task.description }}</p>
          <p v-if="item.task.supplement_note" class="supplement-page__note">
            <strong>补录说明：</strong>{{ item.task.supplement_note }}
          </p>
          <div v-if="item.task.recommended_fields?.length" class="supplement-page__fields">
            <span v-for="field in item.task.recommended_fields" :key="field">{{ field }}</span>
          </div>
        </div>
        <aside class="supplement-page__project">
          <strong>{{ item.project_title }}</strong>
          <span>{{ item.source_entry }}</span>
          <span>{{ typeLabel(item.video_type) }} · {{ formatDate(item.updated_at) }}</span>
          <RouterLink class="supplement-page__project-link" :to="`/projects/${item.project_id}`">打开项目</RouterLink>
        </aside>
      </article>

      <div v-if="filteredTasks.length === 0" class="supplement-page__state">没有匹配的补录任务。</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { listSupplementTasks } from '@/api/projects'
import type { KnowledgeSupplementTaskCategory, ProjectSupplementTaskListItem, VideoType } from '@shared/types'

const tasks = ref<ProjectSupplementTaskListItem[]>([])
const loading = ref(false)
const error = ref('')
const searchQuery = ref('')
const statusFilter = ref('')

const filteredTasks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return tasks.value.filter(item => {
    const matchesStatus = !statusFilter.value || item.task.status === statusFilter.value
    const text = [
      item.project_title,
      item.source_entry,
      item.task.label,
      item.task.description,
      item.task.supplement_note ?? '',
      ...(item.task.recommended_fields ?? []),
    ].join(' ').toLowerCase()
    return matchesStatus && (!query || text.includes(query))
  })
})

const openCount = computed(() => tasks.value.filter(item => item.task.status === 'open').length)
const resolvedCount = computed(() => tasks.value.filter(item => item.task.status === 'resolved').length)

function categoryLabel(category: KnowledgeSupplementTaskCategory): string {
  const map: Record<KnowledgeSupplementTaskCategory, string> = {
    person_experience: '人物经历',
    architecture_detail: '建筑细节',
    event_process: '事件过程',
    regional_context: '地域背景',
    cultural_background: '文化背景',
    supporting_character: '配角人物',
    general: '通用资料',
  }
  return map[category]
}

function typeLabel(type: VideoType): string {
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

onMounted(async () => {
  loading.value = true
  error.value = ''
  const res = await listSupplementTasks()
  if (res.ok && res.data) {
    tasks.value = res.data
  } else {
    error.value = res.error?.message ?? '加载补录任务失败'
  }
  loading.value = false
})
</script>

<style scoped>
.supplement-page {
  max-width: 1180px;
  margin: 0 auto;
}

.supplement-page__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.supplement-page__title {
  margin: 0 0 6px;
  color: #22313f;
  font-size: 28px;
}

.supplement-page__desc {
  margin: 0;
  color: #66727f;
  line-height: 1.6;
}

.supplement-page__back,
.supplement-page__project-link {
  border-radius: 4px;
  background: #2980b9;
  color: #fff;
  text-decoration: none;
  font-size: 14px;
}

.supplement-page__back {
  flex: 0 0 auto;
  padding: 10px 14px;
}

.supplement-page__toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
}

.supplement-page__search,
.supplement-page__select {
  padding: 10px 12px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  font-size: 14px;
}

.supplement-page__search {
  flex: 1;
}

.supplement-page__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.supplement-page__summary div {
  padding: 12px;
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  background: #fff;
}

.supplement-page__summary span {
  display: block;
  margin-bottom: 4px;
  color: #66727f;
  font-size: 13px;
}

.supplement-page__summary strong {
  color: #22313f;
  font-size: 22px;
}

.supplement-page__list {
  display: grid;
  gap: 12px;
}

.supplement-page__task {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 16px;
  padding: 16px;
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  background: #fff;
}

.supplement-page__task-top,
.supplement-page__fields {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.supplement-page__status,
.supplement-page__category,
.supplement-page__fields span {
  padding: 3px 7px;
  border-radius: 4px;
  font-size: 12px;
}

.supplement-page__status--open {
  background: #fff0d8;
  color: #a05f00;
}

.supplement-page__status--resolved {
  background: #e2f5e9;
  color: #1e7d43;
}

.supplement-page__category,
.supplement-page__fields span {
  background: #eef3f7;
  color: #465767;
}

.supplement-page__task h2 {
  margin: 8px 0 6px;
  color: #22313f;
  font-size: 18px;
}

.supplement-page__task p {
  margin: 0 0 8px;
  color: #465767;
  line-height: 1.6;
}

.supplement-page__note {
  padding: 8px 10px;
  border-radius: 6px;
  background: #fffaf0;
}

.supplement-page__project {
  display: grid;
  align-content: start;
  gap: 7px;
  min-width: 0;
  color: #66727f;
  font-size: 13px;
}

.supplement-page__project strong {
  color: #22313f;
  font-size: 15px;
}

.supplement-page__project-link {
  justify-self: start;
  padding: 7px 10px;
}

.supplement-page__state,
.supplement-page__error {
  padding: 24px;
  border-radius: 6px;
  background: #fff;
  color: #66727f;
  text-align: center;
}

.supplement-page__error {
  background: #fdecea;
  color: #c0392b;
}

@media (max-width: 760px) {
  .supplement-page__header,
  .supplement-page__toolbar,
  .supplement-page__task {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .supplement-page__back,
  .supplement-page__search,
  .supplement-page__select {
    width: 100%;
  }

  .supplement-page__summary {
    grid-template-columns: 1fr;
  }
}
</style>
