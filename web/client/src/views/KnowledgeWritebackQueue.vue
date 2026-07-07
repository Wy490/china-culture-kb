<template>
  <div class="writeback-page">
    <header class="writeback-page__header">
      <div>
        <h1 class="writeback-page__title">知识库写回队列</h1>
        <p class="writeback-page__desc">集中处理已通过审稿的项目候选稿，只导出人工核实后的省份 Markdown 写入草案。</p>
      </div>
      <RouterLink class="writeback-page__back" to="/supplement-tasks">素材补充任务</RouterLink>
    </header>

    <section class="writeback-page__toolbar">
      <input
        v-model="searchQuery"
        class="writeback-page__search"
        placeholder="搜索项目、来源条目、草案内容…"
      />
      <select v-model="projectFilter" class="writeback-page__select">
        <option value="">全部项目</option>
        <option v-for="project in projectOptions" :key="project.project_id" :value="project.project_id">
          {{ project.project_title }}
        </option>
      </select>
      <select v-model="videoTypeFilter" class="writeback-page__select">
        <option value="">全部片型</option>
        <option value="character_story">人物故事</option>
        <option value="historical_drama">历史剧情</option>
        <option value="legend_story">传说故事</option>
        <option value="culture_promo">文化宣传</option>
        <option value="heritage_promo">非遗宣传</option>
        <option value="city_brand_promo">城市文旅</option>
        <option value="scene_short">场景短片</option>
        <option value="landscape_mood">山水意境</option>
        <option value="documentary_short">微纪录</option>
        <option value="explainer_video">知识讲解</option>
        <option value="lecture_video">宣讲片</option>
        <option value="education_training">教育培训</option>
        <option value="children_story">儿童故事</option>
        <option value="social_short">竖屏短视频</option>
        <option value="ai_comic_drama">AI漫剧</option>
      </select>
      <select v-model="provinceFilter" class="writeback-page__select">
        <option value="">全部省份</option>
        <option v-for="province in provinceOptions" :key="province" :value="province">{{ province }}</option>
      </select>
      <select v-model="writebackFilter" class="writeback-page__select">
        <option value="">全部写回状态</option>
        <option value="draft_ready">草案就绪</option>
        <option value="queued">已入队</option>
        <option value="written_back">已入库</option>
        <option value="needs_revision">需重审</option>
      </select>
      <button
        type="button"
        class="writeback-page__action"
        :disabled="Boolean(exportingFormat)"
        @click="copyPatch('markdown')"
      >
        {{ exportingFormat === 'markdown' ? '复制中…' : '复制 Markdown Patch' }}
      </button>
      <button
        type="button"
        class="writeback-page__action writeback-page__action--secondary"
        :disabled="Boolean(exportingFormat)"
        @click="copyPatch('json')"
      >
        {{ exportingFormat === 'json' ? '复制中…' : '复制 JSON 包' }}
      </button>
    </section>

    <div v-if="copyMessage" class="writeback-page__notice">{{ copyMessage }}</div>

    <section class="writeback-page__summary">
      <div>
        <span>草案总数</span>
        <strong>{{ queueItems.length }}</strong>
      </div>
      <div>
        <span>当前筛选</span>
        <strong>{{ filteredItems.length }}</strong>
      </div>
      <div>
        <span>草案就绪</span>
        <strong>{{ countByStatus('draft_ready') }}</strong>
      </div>
      <div>
        <span>已入队</span>
        <strong>{{ countByStatus('queued') }}</strong>
      </div>
      <div>
        <span>已入库</span>
        <strong>{{ countByStatus('written_back') }}</strong>
      </div>
      <div>
        <span>需重审</span>
        <strong>{{ countByStatus('needs_revision') }}</strong>
      </div>
    </section>

    <div v-if="loading" class="writeback-page__state">正在加载写回队列…</div>
    <div v-else-if="error" class="writeback-page__error">{{ error }}</div>

    <section v-else class="writeback-page__list">
      <article v-for="item in filteredItems" :key="item.task.task_id" class="writeback-page__item">
        <div class="writeback-page__main">
          <div class="writeback-page__badges">
            <span :class="['writeback-page__status', `writeback-page__status--${taskWritebackStatus(item)}`]">
              {{ writebackStatusLabel(taskWritebackStatus(item)) }}
            </span>
            <span>{{ typeLabel(item.video_type) }}</span>
            <span>{{ item.target_province || '待确认省份' }}</span>
            <span>{{ item.task.source === 'production_material_missing_field' ? '生产素材' : '素材补充' }}</span>
          </div>
          <h2>{{ item.task.label }}</h2>
          <p>{{ item.project_title }} · {{ item.source_entry }}</p>
          <p v-if="item.task.knowledge_candidate_review_note" class="writeback-page__note">
            审稿备注：{{ item.task.knowledge_candidate_review_note }}
          </p>
          <pre>{{ item.task.knowledge_writeback_draft_markdown }}</pre>
        </div>

        <aside class="writeback-page__side">
          <strong>{{ item.suggested_file_path || 'data/provinces/待确认.md' }}</strong>
          <span>{{ formatDate(item.task.knowledge_writeback_updated_at ?? item.task.updated_at ?? item.updated_at) }}</span>
          <RouterLink :to="`/projects/${item.project_id}`">打开项目</RouterLink>
          <textarea
            :value="noteDraft(item)"
            placeholder="入库备注"
            @input="updateNoteDraft(item.task.task_id, $event)"
          />
          <div class="writeback-page__status-actions">
            <button type="button" :disabled="updatingTaskId === item.task.task_id" @click="setWritebackStatus(item, 'draft_ready')">草案</button>
            <button type="button" :disabled="updatingTaskId === item.task.task_id" @click="setWritebackStatus(item, 'queued')">入队</button>
            <button type="button" :disabled="updatingTaskId === item.task.task_id" @click="setWritebackStatus(item, 'written_back')">入库</button>
            <button type="button" :disabled="updatingTaskId === item.task.task_id" @click="setWritebackStatus(item, 'needs_revision')">重审</button>
          </div>
        </aside>
      </article>

      <div v-if="filteredItems.length === 0" class="writeback-page__state">没有匹配的写回草案。</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { exportKnowledgeWritebackQueuePatch, listSupplementTasks, updateProjectSupplementTask } from '@/api/projects'
import type { KnowledgeWritebackStatus, ProjectSupplementTaskListItem, VideoType } from '@shared/types'

const tasks = ref<ProjectSupplementTaskListItem[]>([])
const loading = ref(false)
const error = ref('')
const copyMessage = ref('')
const exportingFormat = ref<'markdown' | 'json' | ''>('')
const updatingTaskId = ref('')
const searchQuery = ref('')
const projectFilter = ref('')
const videoTypeFilter = ref<VideoType | ''>('')
const provinceFilter = ref('')
const writebackFilter = ref<KnowledgeWritebackStatus | ''>('')
const noteDrafts = reactive<Record<string, string>>({})

const queueItems = computed(() => tasks.value.filter(item =>
  item.task.knowledge_candidate_review_status === 'approved'
  && Boolean(item.task.knowledge_writeback_draft_markdown),
))

const projectOptions = computed(() => {
  const seen = new Set<string>()
  return queueItems.value
    .filter(item => {
      if (seen.has(item.project_id)) return false
      seen.add(item.project_id)
      return true
    })
    .map(item => ({ project_id: item.project_id, project_title: item.project_title }))
    .sort((a, b) => a.project_title.localeCompare(b.project_title, 'zh-Hans-CN'))
})

const provinceOptions = computed(() => [...new Set(queueItems.value.map(item => item.target_province).filter((item): item is string => Boolean(item)))]
  .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')))

const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return queueItems.value.filter(item => {
    const status = taskWritebackStatus(item)
    const text = [
      item.project_id,
      item.project_title,
      item.source_entry,
      item.video_type,
      item.target_province ?? '',
      item.suggested_file_path ?? '',
      item.task.label,
      item.task.description,
      item.task.knowledge_candidate_review_note ?? '',
      item.task.knowledge_writeback_note ?? '',
      item.task.knowledge_writeback_draft_markdown ?? '',
      ...(item.task.recommended_fields ?? []),
    ].join(' ').toLowerCase()
    return (!projectFilter.value || item.project_id === projectFilter.value)
      && (!videoTypeFilter.value || item.video_type === videoTypeFilter.value)
      && (!provinceFilter.value || item.target_province === provinceFilter.value)
      && (!writebackFilter.value || status === writebackFilter.value)
      && (!query || text.includes(query))
  })
})

function taskWritebackStatus(item: ProjectSupplementTaskListItem): KnowledgeWritebackStatus {
  return item.task.knowledge_writeback_status ?? 'draft_ready'
}

function countByStatus(status: KnowledgeWritebackStatus): number {
  return queueItems.value.filter(item => taskWritebackStatus(item) === status).length
}

function writebackStatusLabel(status: KnowledgeWritebackStatus): string {
  if (status === 'queued') return '已入队'
  if (status === 'written_back') return '已入库'
  if (status === 'needs_revision') return '需重审'
  return '草案就绪'
}

function typeLabel(type: VideoType): string {
  const map: Record<string, string> = {
    heritage_promo: '非遗宣传',
    documentary_short: '微纪录',
    ai_comic_drama: 'AI漫剧',
    explainer_video: '知识讲解',
    culture_promo: '文化宣传',
    social_short: '竖屏短视频',
    character_story: '人物故事',
    historical_drama: '历史剧情',
    legend_story: '传说故事',
    city_brand_promo: '城市文旅',
    scene_short: '场景短片',
    landscape_mood: '山水意境',
    lecture_video: '宣讲片',
    education_training: '教育培训',
    children_story: '儿童故事',
  }
  return map[type] ?? type
}

function formatDate(iso?: string): string {
  if (!iso) return '未记录'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function noteDraft(item: ProjectSupplementTaskListItem): string {
  return noteDrafts[item.task.task_id] ?? item.task.knowledge_writeback_note ?? ''
}

function updateNoteDraft(taskId: string, event: Event) {
  noteDrafts[taskId] = (event.target as HTMLTextAreaElement).value
}

async function loadTasks() {
  loading.value = true
  error.value = ''
  const res = await listSupplementTasks({ knowledge_writeback_ready: true })
  if (res.ok && res.data) {
    tasks.value = res.data
  } else {
    error.value = res.error?.message ?? '加载写回队列失败'
  }
  loading.value = false
}

async function copyPatch(format: 'markdown' | 'json') {
  const visibleItems = filteredItems.value
  if (visibleItems.length === 0) {
    copyMessage.value = ''
    error.value = '当前筛选没有可导出的写回草案'
    return
  }

  exportingFormat.value = format
  error.value = ''
  copyMessage.value = ''
  try {
    const res = await exportKnowledgeWritebackQueuePatch({
      ...(projectFilter.value ? { project_id: projectFilter.value } : {}),
      ...(videoTypeFilter.value ? { video_type: videoTypeFilter.value } : {}),
      ...(provinceFilter.value ? { province: provinceFilter.value } : {}),
      ...(writebackFilter.value ? { knowledge_writeback_status: writebackFilter.value } : {}),
      ...(searchQuery.value.trim() ? { search_query: searchQuery.value.trim() } : {}),
      task_keys: visibleItems.map(writebackItemKey),
    })
    if (res.ok && res.data) {
      const clipboardText = format === 'json'
        ? JSON.stringify(res.data, null, 2)
        : res.data.markdown
      await navigator.clipboard.writeText(clipboardText)
      const exportLabel = format === 'json' ? 'JSON 导出包' : 'Markdown Patch'
      const statusText = res.data.status_counts ? `；${statusCountSummary(res.data.status_counts)}` : ''
      copyMessage.value = `已复制 ${exportLabel}：${res.data.approved_count}/${visibleItems.length} 条当前可见草案，目标文件 ${res.data.target_files.length} 个${statusText}。`
    } else {
      error.value = res.error?.message ?? '导出写回队列失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '复制写回队列失败'
  } finally {
    exportingFormat.value = ''
  }
}

async function setWritebackStatus(item: ProjectSupplementTaskListItem, status: KnowledgeWritebackStatus) {
  updatingTaskId.value = item.task.task_id
  error.value = ''
  const res = await updateProjectSupplementTask(item.project_id, item.task.task_id, {
    status: item.task.status,
    knowledge_writeback_status: status,
    knowledge_writeback_note: noteDraft(item).trim() || writebackStatusLabel(status),
  })
  if (res.ok) {
    delete noteDrafts[item.task.task_id]
    await loadTasks()
  } else {
    error.value = res.error?.message ?? '更新写回状态失败'
  }
  updatingTaskId.value = ''
}

function writebackItemKey(item: ProjectSupplementTaskListItem): string {
  return `${item.project_id}::${item.task.task_id}`
}

function statusCountSummary(counts: Record<KnowledgeWritebackStatus, number>): string {
  return [
    `草案 ${counts.draft_ready ?? 0}`,
    `入队 ${counts.queued ?? 0}`,
    `已入库 ${counts.written_back ?? 0}`,
    `重审 ${counts.needs_revision ?? 0}`,
  ].join(' / ')
}

onMounted(async () => {
  await loadTasks()
})
</script>

<style scoped>
.writeback-page {
  max-width: 1180px;
  margin: 0 auto;
}

.writeback-page__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.writeback-page__title {
  margin: 0 0 6px;
  color: #22313f;
  font-size: 28px;
}

.writeback-page__desc {
  margin: 0;
  color: #66727f;
  line-height: 1.6;
}

.writeback-page__back,
.writeback-page__item a {
  border-radius: 4px;
  background: #2980b9;
  color: #fff;
  text-decoration: none;
  font-size: 14px;
}

.writeback-page__back {
  flex: 0 0 auto;
  padding: 10px 14px;
}

.writeback-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.writeback-page__search,
.writeback-page__select {
  padding: 10px 12px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  font-size: 14px;
}

.writeback-page__search {
  flex: 1 1 260px;
}

.writeback-page__select {
  min-width: 150px;
}

.writeback-page__action {
  border: 1px solid #2980b9;
  border-radius: 6px;
  padding: 10px 12px;
  background: #2980b9;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.writeback-page__action--secondary {
  border-color: #7d8b99;
  background: #fff;
  color: #2f3f4f;
}

.writeback-page__action:disabled,
.writeback-page__status-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.writeback-page__notice {
  margin: -2px 0 14px;
  border: 1px solid #badbcc;
  border-radius: 6px;
  padding: 8px 10px;
  background: #f0f8f4;
  color: #216e44;
  font-size: 13px;
}

.writeback-page__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.writeback-page__summary div,
.writeback-page__item {
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  background: #fff;
}

.writeback-page__summary div {
  padding: 12px;
}

.writeback-page__summary span {
  display: block;
  margin-bottom: 4px;
  color: #66727f;
  font-size: 13px;
}

.writeback-page__summary strong {
  color: #22313f;
  font-size: 22px;
}

.writeback-page__list {
  display: grid;
  gap: 12px;
}

.writeback-page__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 16px;
  padding: 16px;
}

.writeback-page__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.writeback-page__badges span {
  padding: 3px 7px;
  border-radius: 4px;
  background: #eef3f7;
  color: #465767;
  font-size: 12px;
}

.writeback-page__status--draft_ready {
  background: #e9f2ff !important;
  color: #24527a !important;
}

.writeback-page__status--queued {
  background: #f0f2ff !important;
  color: #3a56a0 !important;
}

.writeback-page__status--written_back {
  background: #e2f5e9 !important;
  color: #1e7d43 !important;
}

.writeback-page__status--needs_revision {
  background: #fdecea !important;
  color: #a93226 !important;
}

.writeback-page__main h2 {
  margin: 8px 0 6px;
  color: #22313f;
  font-size: 18px;
}

.writeback-page__main p {
  margin: 0 0 8px;
  color: #465767;
  line-height: 1.6;
}

.writeback-page__note {
  padding: 8px 10px;
  border-radius: 6px;
  background: #fffaf0;
}

.writeback-page__main pre {
  max-height: 260px;
  margin: 8px 0 0;
  overflow: auto;
  white-space: pre-wrap;
  color: #4c5e6f;
  font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.writeback-page__side {
  display: grid;
  align-content: start;
  gap: 8px;
  color: #66727f;
  font-size: 13px;
}

.writeback-page__side strong {
  color: #22313f;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.writeback-page__side a {
  justify-self: start;
  padding: 7px 10px;
}

.writeback-page__side textarea {
  min-height: 72px;
  padding: 9px 10px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  resize: vertical;
  color: #2f4358;
  font: inherit;
  font-size: 14px;
  line-height: 1.5;
}

.writeback-page__status-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.writeback-page__status-actions button {
  border: 1px solid #c7d3dd;
  border-radius: 4px;
  padding: 7px 8px;
  background: #fff;
  color: #33475b;
  cursor: pointer;
  font-size: 13px;
}

.writeback-page__state,
.writeback-page__error {
  padding: 24px;
  border-radius: 6px;
  background: #fff;
  color: #66727f;
  text-align: center;
}

.writeback-page__error {
  background: #fdecea;
  color: #c0392b;
}

@media (max-width: 760px) {
  .writeback-page__header,
  .writeback-page__toolbar,
  .writeback-page__item {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .writeback-page__back,
  .writeback-page__search,
  .writeback-page__select {
    width: 100%;
  }
}
</style>
