<template>
  <div class="supplement-page">
    <header class="supplement-page__header">
      <div>
        <h1 class="supplement-page__title">素材补充任务</h1>
        <p class="supplement-page__desc">按创作阶段、阻断等级和项目来源集中处理 Story Agent 的素材缺口。</p>
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
      <select v-model="stageFilter" class="supplement-page__select">
        <option value="">全部阶段</option>
        <option value="minimum_viable_story">最小故事</option>
        <option value="script_ready">剧本就绪</option>
        <option value="production_ready">生产就绪</option>
      </select>
      <select v-model="blockingFilter" class="supplement-page__select">
        <option value="">全部等级</option>
        <option value="blocking">当前阻断</option>
        <option value="risk">需核验</option>
        <option value="optional">生产前补充</option>
      </select>
      <select v-model="sourceFilter" class="supplement-page__select">
        <option value="">全部来源</option>
        <option value="knowledge_pack_missing_need">旧项目素材包缺口</option>
        <option value="material_sufficiency_missing_item">素材 Gate 缺口</option>
        <option value="production_material_missing_field">生产素材模板缺口</option>
      </select>
      <select v-model="writebackFilter" class="supplement-page__select">
        <option value="">全部写回状态</option>
        <option value="draft_ready">草案就绪</option>
        <option value="queued">已入队</option>
        <option value="written_back">已入库</option>
        <option value="needs_revision">需重审</option>
      </select>
      <button
        type="button"
        class="supplement-page__toolbar-action"
        :disabled="exportingWritebackPatch"
        @click="copyWritebackQueuePatch"
      >
        {{ exportingWritebackPatch ? '复制中…' : '复制写回队列 Patch' }}
      </button>
      <button
        type="button"
        class="supplement-page__toolbar-action supplement-page__toolbar-action--secondary"
        :disabled="exportingCandidatePackage || candidateExportItems.length === 0"
        @click="copySupplementCandidatePackage"
      >
        {{ exportingCandidatePackage ? '复制中…' : '复制补库候选包' }}
      </button>
      <button
        type="button"
        class="supplement-page__toolbar-action supplement-page__toolbar-action--secondary"
        :disabled="exportingCandidatePackage || candidateExportItems.length === 0"
        @click="downloadSupplementCandidatePackage"
      >
        {{ exportingCandidatePackage ? '导出中…' : '下载补库候选包' }}
      </button>
    </section>

    <div v-if="copyMessage" class="supplement-page__copy-message">{{ copyMessage }}</div>

    <div v-if="projectFilter" class="supplement-page__active-filter">
      <span>当前项目：{{ projectFilter }}</span>
      <button type="button" @click="clearProjectFilter">查看全部项目</button>
    </div>

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
      <div>
        <span>当前阻断</span>
        <strong>{{ blockingOpenCount }}</strong>
      </div>
      <div>
        <span>需核验</span>
        <strong>{{ riskOpenCount }}</strong>
      </div>
      <div>
        <span>生产前补充</span>
        <strong>{{ optionalOpenCount }}</strong>
      </div>
      <div>
        <span>生产阶段缺口</span>
        <strong>{{ productionReadyOpenCount }}</strong>
      </div>
      <div>
        <span>候选稿</span>
        <strong>{{ candidateDraftCount }}</strong>
      </div>
      <div>
        <span>写回草案</span>
        <strong>{{ writebackDraftCount }}</strong>
      </div>
      <div>
        <span>入库队列</span>
        <strong>{{ writebackQueuedCount }}</strong>
      </div>
      <div>
        <span>已入库</span>
        <strong>{{ writebackWrittenCount }}</strong>
      </div>
    </section>

    <div v-if="loading" class="supplement-page__state">正在加载素材补充任务…</div>
    <div v-else-if="error" class="supplement-page__error">{{ error }}</div>

    <section v-else class="supplement-page__list">
      <article v-for="item in filteredTasks" :key="item.task.task_id" class="supplement-page__task">
        <div class="supplement-page__task-main">
          <div class="supplement-page__task-top">
            <span :class="['supplement-page__status', item.task.status === 'open' ? 'supplement-page__status--open' : 'supplement-page__status--resolved']">
              {{ item.task.status === 'open' ? '待补' : '已完成' }}
            </span>
            <span v-if="item.task.stage" class="supplement-page__stage">{{ stageLabel(item.task.stage) }}</span>
            <span v-if="item.task.blocking_level" :class="['supplement-page__blocking', `supplement-page__blocking--${item.task.blocking_level}`]">
              {{ blockingLabel(item.task.blocking_level) }}
            </span>
            <span class="supplement-page__source">{{ sourceLabel(item.task.source) }}</span>
            <span v-if="item.task.category" class="supplement-page__category">{{ categoryLabel(item.task.category) }}</span>
          </div>
          <h2>{{ item.task.label }}</h2>
          <p>{{ item.task.description }}</p>
          <p v-if="item.task.supplement_note" class="supplement-page__note">
            <strong>素材补充说明：</strong>{{ item.task.supplement_note }}
          </p>
          <div v-if="item.task.knowledge_candidate_markdown" class="supplement-page__candidate">
            <div class="supplement-page__candidate-head">
              <strong>知识库候选稿</strong>
              <span :class="['supplement-page__review', `supplement-page__review--${item.task.knowledge_candidate_review_status ?? 'pending_review'}`]">
                {{ reviewStatusLabel(item.task.knowledge_candidate_review_status) }}
              </span>
            </div>
            <pre>{{ item.task.knowledge_candidate_markdown }}</pre>
            <template v-if="item.task.knowledge_writeback_draft_markdown">
              <div class="supplement-page__candidate-head supplement-page__candidate-head--sub">
                <strong class="supplement-page__candidate-subtitle">正式写入草案</strong>
                <span :class="['supplement-page__review', `supplement-page__review--${item.task.knowledge_writeback_status ?? 'draft_ready'}`]">
                  {{ writebackStatusLabel(item.task.knowledge_writeback_status) }}
                </span>
              </div>
              <pre>{{ item.task.knowledge_writeback_draft_markdown }}</pre>
            </template>
          </div>
          <div v-if="item.task.recommended_fields?.length" class="supplement-page__fields">
            <span v-for="field in item.task.recommended_fields" :key="field">{{ field }}</span>
          </div>
          <div v-if="item.task.affects?.length" class="supplement-page__fields supplement-page__fields--affects">
            <span v-for="affect in item.task.affects" :key="affect">影响：{{ affect }}</span>
          </div>
          <p v-if="item.task.intake_prompt" class="supplement-page__prompt">{{ item.task.intake_prompt }}</p>
          <div v-if="item.task.status === 'open'" class="supplement-page__editor">
            <div v-if="item.task.recommended_fields?.length" class="supplement-page__field-editor">
              <label v-for="field in item.task.recommended_fields" :key="field">
                <span>{{ fieldLabel(field) }}</span>
                <textarea
                  class="supplement-page__field-textarea"
                  :value="fieldDraftValue(item, field)"
                  :placeholder="`补充 ${fieldLabel(field)} 的事实、来源、画面或生产边界`"
                  @input="updateFieldDraft(item.task.task_id, field, $event)"
                />
              </label>
            </div>
            <textarea
              class="supplement-page__textarea"
              :value="drafts[item.task.task_id] ?? item.task.supplement_note ?? ''"
              placeholder="记录本次补充的事实、来源、可用于故事、剧本或画面的细节。"
              @input="updateDraft(item.task.task_id, $event)"
            />
            <button
              class="supplement-page__task-action"
              :disabled="updatingTaskId === item.task.task_id"
              @click="updateTask(item, 'resolved')"
            >
              {{ updatingTaskId === item.task.task_id ? '保存中…' : '保存并完成' }}
            </button>
          </div>
        </div>
        <aside class="supplement-page__project">
          <strong>{{ item.project_title }}</strong>
          <span>{{ item.source_entry }}</span>
          <span>{{ typeLabel(item.video_type) }} · {{ formatDate(item.updated_at) }}</span>
          <RouterLink class="supplement-page__project-link" :to="`/projects/${item.project_id}`">打开项目</RouterLink>
          <button
            v-if="item.task.status === 'resolved'"
            class="supplement-page__task-action supplement-page__task-action--secondary"
            :disabled="updatingTaskId === item.task.task_id"
            @click="updateTask(item, 'open')"
          >
            {{ updatingTaskId === item.task.task_id ? '更新中…' : '重新打开' }}
          </button>
          <button
            v-if="item.task.status === 'open' && item.task.source === 'production_material_missing_field'"
            class="supplement-page__task-action supplement-page__task-action--secondary"
            :disabled="draftingProjectId === item.project_id"
            @click="draftProductionFieldsForTask(item)"
          >
            {{ draftingProjectId === item.project_id ? '草拟中…' : '草拟本项目生产字段' }}
          </button>
        </aside>
      </article>

      <div v-if="filteredTasks.length === 0" class="supplement-page__state">没有匹配的素材补充任务。</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  draftProjectProductionMaterialFields,
  exportKnowledgeWritebackQueuePatch,
  exportSupplementCandidatePackage,
  listSupplementTasks,
  updateProjectSupplementTask,
} from '@/api/projects'
import type {
  KnowledgeCandidateReviewStatus,
  KnowledgeSupplementTaskCategory,
  KnowledgeSupplementTaskSource,
  KnowledgeSupplementTaskStatus,
  KnowledgeWritebackStatus,
  MaterialBlockingLevel,
  MaterialSufficiencyStage,
  ProjectSupplementTaskListItem,
  VideoType,
} from '@shared/types'

const route = useRoute()
const STATUS_FILTERS: KnowledgeSupplementTaskStatus[] = ['open', 'resolved']
const STAGE_FILTERS: MaterialSufficiencyStage[] = ['minimum_viable_story', 'script_ready', 'production_ready']
const BLOCKING_FILTERS: MaterialBlockingLevel[] = ['blocking', 'risk', 'optional']
const SOURCE_FILTERS: KnowledgeSupplementTaskSource[] = [
  'knowledge_pack_missing_need',
  'material_sufficiency_missing_item',
  'production_material_missing_field',
]
const WRITEBACK_FILTERS: KnowledgeWritebackStatus[] = ['draft_ready', 'queued', 'written_back', 'needs_revision']

const tasks = ref<ProjectSupplementTaskListItem[]>([])
const loading = ref(false)
const error = ref('')
const searchQuery = ref('')
const statusFilter = ref<KnowledgeSupplementTaskStatus | ''>(queryEnum(route.query.status, STATUS_FILTERS))
const stageFilter = ref<MaterialSufficiencyStage | ''>(queryEnum(route.query.stage, STAGE_FILTERS))
const blockingFilter = ref<MaterialBlockingLevel | ''>(queryEnum(route.query.blocking_level, BLOCKING_FILTERS))
const sourceFilter = ref<KnowledgeSupplementTaskSource | ''>(queryEnum(route.query.source, SOURCE_FILTERS))
const writebackFilter = ref<KnowledgeWritebackStatus | ''>(queryEnum(route.query.knowledge_writeback_status, WRITEBACK_FILTERS))
const projectFilter = ref(queryString(route.query.project_id))
const updatingTaskId = ref('')
const draftingProjectId = ref('')
const exportingWritebackPatch = ref(false)
const exportingCandidatePackage = ref(false)
const copyMessage = ref('')
const drafts = reactive<Record<string, string>>({})
const fieldDrafts = reactive<Record<string, Record<string, string>>>({})

const filteredTasks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return tasks.value.filter(item => {
    const matchesStatus = !statusFilter.value || item.task.status === statusFilter.value
    const matchesStage = !stageFilter.value || item.task.stage === stageFilter.value
    const matchesBlocking = !blockingFilter.value || item.task.blocking_level === blockingFilter.value
    const matchesSource = !sourceFilter.value || item.task.source === sourceFilter.value
    const matchesWriteback = !writebackFilter.value || taskWritebackStatus(item.task) === writebackFilter.value
    const matchesProject = !projectFilter.value || item.project_id === projectFilter.value
    const text = [
      item.project_id,
      item.project_title,
      item.source_entry,
      item.task.label,
      item.task.description,
      item.task.supplement_note ?? '',
      item.task.knowledge_candidate_markdown ?? '',
      item.task.knowledge_writeback_draft_markdown ?? '',
      item.task.knowledge_candidate_review_note ?? '',
      item.task.knowledge_writeback_note ?? '',
      taskWritebackStatus(item.task) ? writebackStatusLabel(taskWritebackStatus(item.task) || undefined) : '',
      item.task.intake_prompt ?? '',
      item.task.stage ? stageLabel(item.task.stage) : '',
      item.task.blocking_level ? blockingLabel(item.task.blocking_level) : '',
      sourceLabel(item.task.source),
      ...(item.task.affects ?? []),
      ...(item.task.recommended_fields ?? []),
      ...Object.values(item.task.supplement_field_values ?? {}),
    ].join(' ').toLowerCase()
    return matchesStatus && matchesStage && matchesBlocking && matchesSource && matchesWriteback && matchesProject && (!query || text.includes(query))
  })
})

const openCount = computed(() => tasks.value.filter(item => item.task.status === 'open').length)
const resolvedCount = computed(() => tasks.value.filter(item => item.task.status === 'resolved').length)
const blockingOpenCount = computed(() => tasks.value.filter(item => item.task.status === 'open' && item.task.blocking_level === 'blocking').length)
const riskOpenCount = computed(() => tasks.value.filter(item => item.task.status === 'open' && item.task.blocking_level === 'risk').length)
const optionalOpenCount = computed(() => tasks.value.filter(item => item.task.status === 'open' && item.task.blocking_level === 'optional').length)
const productionReadyOpenCount = computed(() => tasks.value.filter(item => item.task.status === 'open' && item.task.stage === 'production_ready').length)
const candidateDraftCount = computed(() => tasks.value.filter(item => Boolean(item.task.knowledge_candidate_markdown)).length)
const writebackDraftCount = computed(() => tasks.value.filter(item => taskWritebackStatus(item.task) === 'draft_ready').length)
const writebackQueuedCount = computed(() => tasks.value.filter(item => taskWritebackStatus(item.task) === 'queued').length)
const writebackWrittenCount = computed(() => tasks.value.filter(item => taskWritebackStatus(item.task) === 'written_back').length)
const candidateExportItems = computed(() => filteredTasks.value.filter(item => item.task.status === 'open'))

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

function stageLabel(stage: MaterialSufficiencyStage): string {
  const map: Record<MaterialSufficiencyStage, string> = {
    minimum_viable_story: '最小故事',
    script_ready: '剧本就绪',
    production_ready: '生产就绪',
  }
  return map[stage]
}

function blockingLabel(level: MaterialBlockingLevel): string {
  const map: Record<MaterialBlockingLevel, string> = {
    blocking: '当前阻断',
    risk: '需核验',
    optional: '生产前补充',
  }
  return map[level]
}

function sourceLabel(source: KnowledgeSupplementTaskSource): string {
  const map: Record<KnowledgeSupplementTaskSource, string> = {
    knowledge_pack_missing_need: '旧项目素材包缺口',
    material_sufficiency_missing_item: '素材 Gate 缺口',
    production_material_missing_field: '生产素材模板缺口',
  }
  return map[source]
}

function reviewStatusLabel(status?: KnowledgeCandidateReviewStatus): string {
  if (status === 'approved') return '已通过'
  if (status === 'rejected') return '已驳回'
  return '待审稿'
}

function writebackStatusLabel(status?: KnowledgeWritebackStatus): string {
  if (status === 'queued') return '已入队'
  if (status === 'written_back') return '已入库'
  if (status === 'needs_revision') return '需重审'
  return '草案就绪'
}

function taskWritebackStatus(task: ProjectSupplementTaskListItem['task']): KnowledgeWritebackStatus | '' {
  return task.knowledge_writeback_status ?? (task.knowledge_writeback_draft_markdown ? 'draft_ready' : '')
}

function queryString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function queryEnum<T extends string>(value: unknown, allowed: T[]): T | '' {
  const text = queryString(value)
  return allowed.includes(text as T) ? text as T : ''
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

function updateDraft(taskId: string, event: Event) {
  drafts[taskId] = (event.target as HTMLTextAreaElement).value
}

function updateFieldDraft(taskId: string, field: string, event: Event) {
  if (!fieldDrafts[taskId]) fieldDrafts[taskId] = {}
  fieldDrafts[taskId][field] = (event.target as HTMLTextAreaElement).value
}

function fieldDraftValue(item: ProjectSupplementTaskListItem, field: string): string {
  return fieldDrafts[item.task.task_id]?.[field] ?? item.task.supplement_field_values?.[field] ?? ''
}

function fieldLabel(field: string): string {
  return field
    .split('_')
    .filter(Boolean)
    .join(' ')
}

function normalizedFieldDrafts(taskId: string): Record<string, string> | undefined {
  const values = fieldDrafts[taskId]
  if (!values) return undefined
  const normalized = Object.fromEntries(
    Object.entries(values)
      .map(([field, value]) => [field, value.trim()] as const)
      .filter(([, value]) => value.length > 0),
  )
  return Object.keys(normalized).length > 0 ? normalized : undefined
}

async function loadTasks() {
  loading.value = true
  error.value = ''
  const res = await listSupplementTasks(projectFilter.value ? { project_id: projectFilter.value } : {})
  if (res.ok && res.data) {
    tasks.value = res.data
  } else {
    error.value = res.error?.message ?? '加载素材补充任务失败'
  }
  loading.value = false
}

async function clearProjectFilter() {
  projectFilter.value = ''
  await loadTasks()
}

async function copyWritebackQueuePatch() {
  exportingWritebackPatch.value = true
  copyMessage.value = ''
  error.value = ''
  try {
    const res = await exportKnowledgeWritebackQueuePatch({
      ...(projectFilter.value ? { project_id: projectFilter.value } : {}),
      ...(writebackFilter.value ? { knowledge_writeback_status: writebackFilter.value } : {}),
    })
    if (res.ok && res.data) {
      await navigator.clipboard.writeText(res.data.markdown)
      copyMessage.value = `已复制 ${res.data.approved_count} 条写回候选，目标文件 ${res.data.target_files.length} 个。`
    } else {
      error.value = res.error?.message ?? '导出写回队列 Patch 失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '复制写回队列 Patch 失败'
  } finally {
    exportingWritebackPatch.value = false
  }
}

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function candidatePackageFilters() {
  return {
    ...(projectFilter.value ? { project_id: projectFilter.value } : {}),
    status: 'open' as const,
    ...(stageFilter.value ? { stage: stageFilter.value } : {}),
    ...(blockingFilter.value ? { blocking_level: blockingFilter.value } : {}),
    ...(sourceFilter.value ? { source: sourceFilter.value } : {}),
    ...(writebackFilter.value ? { knowledge_writeback_status: writebackFilter.value } : {}),
    ...(searchQuery.value.trim() ? { search_query: searchQuery.value.trim() } : {}),
  }
}

async function copySupplementCandidatePackage() {
  const items = candidateExportItems.value
  if (items.length === 0) return
  error.value = ''
  exportingCandidatePackage.value = true
  try {
    const res = await exportSupplementCandidatePackage(candidatePackageFilters())
    if (res.ok && res.data) {
      await navigator.clipboard.writeText(res.data.markdown)
      copyMessage.value = `已复制 ${res.data.task_count} 条素材补库候选任务。`
    } else {
      error.value = res.error?.message ?? '导出补库候选包失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '复制补库候选包失败'
  } finally {
    exportingCandidatePackage.value = false
  }
}

async function downloadSupplementCandidatePackage() {
  const items = candidateExportItems.value
  if (items.length === 0) return
  error.value = ''
  exportingCandidatePackage.value = true
  try {
    const res = await exportSupplementCandidatePackage(candidatePackageFilters())
    if (res.ok && res.data) {
      downloadText(
        `knowledge-supplement-candidates-${new Date().toISOString().slice(0, 10)}.md`,
        res.data.markdown,
        'text/markdown;charset=utf-8',
      )
      copyMessage.value = `已下载 ${res.data.task_count} 条素材补库候选任务。`
    } else {
      error.value = res.error?.message ?? '导出补库候选包失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '下载补库候选包失败'
  } finally {
    exportingCandidatePackage.value = false
  }
}

async function draftProductionFieldsForTask(item: ProjectSupplementTaskListItem) {
  draftingProjectId.value = item.project_id
  error.value = ''
  copyMessage.value = ''
  try {
    const res = await draftProjectProductionMaterialFields(item.project_id)
    if (res.ok && res.data) {
      copyMessage.value = `已为《${item.project_title}》草拟 ${res.data.drafted_field_count} 个生产素材字段。`
      await loadTasks()
    } else {
      error.value = res.error?.message ?? '草拟生产素材字段失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '草拟生产素材字段失败'
  } finally {
    draftingProjectId.value = ''
  }
}

async function updateTask(item: ProjectSupplementTaskListItem, status: KnowledgeSupplementTaskStatus) {
  updatingTaskId.value = item.task.task_id
  error.value = ''
  const note = drafts[item.task.task_id]?.trim()
  const supplementFieldValues = normalizedFieldDrafts(item.task.task_id)
  const body = {
    status,
    ...(note ? { supplement_note: note } : {}),
    ...(supplementFieldValues ? { supplement_field_values: supplementFieldValues } : {}),
  }
  const res = await updateProjectSupplementTask(item.project_id, item.task.task_id, body)
  if (res.ok) {
    delete drafts[item.task.task_id]
    delete fieldDrafts[item.task.task_id]
    await loadTasks()
  } else {
    error.value = res.error?.message ?? '更新素材补充任务失败'
  }
  updatingTaskId.value = ''
}

onMounted(async () => {
  await loadTasks()
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
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.supplement-page__active-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  border: 1px solid #c7d8e8;
  border-radius: 6px;
  padding: 8px 10px;
  background: #f4f8fb;
  color: #455866;
  font-size: 13px;
}

.supplement-page__active-filter button {
  border: 1px solid #c7d8e8;
  border-radius: 4px;
  background: #fff;
  color: #2b6f9f;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.supplement-page__search,
.supplement-page__select {
  padding: 10px 12px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  font-size: 14px;
}

.supplement-page__search {
  flex: 1 1 260px;
}

.supplement-page__select {
  min-width: 150px;
}

.supplement-page__toolbar-action {
  border: 1px solid #2980b9;
  border-radius: 6px;
  padding: 10px 12px;
  background: #2980b9;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.supplement-page__toolbar-action:disabled {
  cursor: not-allowed;
  opacity: 0.68;
}

.supplement-page__toolbar-action--secondary {
  border-color: #c7d3dd;
  background: #fff;
  color: #33475b;
}

.supplement-page__copy-message {
  margin: -2px 0 14px;
  border: 1px solid #badbcc;
  border-radius: 6px;
  padding: 8px 10px;
  background: #f0f8f4;
  color: #216e44;
  font-size: 13px;
}

.supplement-page__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
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
.supplement-page__stage,
.supplement-page__blocking,
.supplement-page__source,
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

.supplement-page__stage {
  background: #e9f2ff;
  color: #24527a;
}

.supplement-page__source {
  background: #f4efff;
  color: #5a3b7a;
}

.supplement-page__blocking--blocking {
  background: #fdecea;
  color: #a93226;
}

.supplement-page__blocking--risk {
  background: #fff4d6;
  color: #9a6500;
}

.supplement-page__blocking--optional {
  background: #edf7ee;
  color: #2e7d32;
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

.supplement-page__candidate {
  margin-bottom: 8px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  padding: 10px;
  background: #f8fafb;
}

.supplement-page__candidate-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.supplement-page__candidate-head--sub {
  margin-top: 10px;
}

.supplement-page__candidate strong {
  color: #22313f;
  font-size: 13px;
}

.supplement-page__candidate-subtitle {
  display: block;
}

.supplement-page__review {
  border: 1px solid #d7dee5;
  border-radius: 999px;
  padding: 3px 8px;
  color: #455866;
  font-size: 11px;
  font-weight: 800;
}

.supplement-page__review--approved {
  border-color: #b8dbc8;
  color: #247447;
}

.supplement-page__review--rejected {
  border-color: #f0b8b0;
  color: #a83224;
}

.supplement-page__review--pending_review {
  border-color: #efcf8a;
  color: #8a5a00;
}

.supplement-page__review--draft_ready {
  border-color: #c7d8e8;
  color: #2b6f9f;
}

.supplement-page__review--queued {
  border-color: #b9c9f0;
  color: #3a56a0;
}

.supplement-page__review--written_back {
  border-color: #b8dbc8;
  color: #247447;
}

.supplement-page__review--needs_revision {
  border-color: #f0b8b0;
  color: #a83224;
}

.supplement-page__candidate pre {
  max-height: 220px;
  margin: 8px 0 0;
  overflow: auto;
  white-space: pre-wrap;
  color: #4c5e6f;
  font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.supplement-page__prompt {
  padding: 8px 10px;
  border-left: 3px solid #7aa6d8;
  background: #f6f9fc;
  color: #34495e !important;
  font-size: 13px;
}

.supplement-page__editor {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.supplement-page__field-editor {
  display: grid;
  gap: 8px;
}

.supplement-page__field-editor label {
  display: grid;
  gap: 5px;
}

.supplement-page__field-editor span {
  color: #455866;
  font-size: 12px;
  font-weight: 700;
}

.supplement-page__textarea,
.supplement-page__field-textarea {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  resize: vertical;
  color: #2f4358;
  font: inherit;
  font-size: 14px;
  line-height: 1.5;
}

.supplement-page__textarea {
  min-height: 90px;
}

.supplement-page__field-textarea {
  min-height: 70px;
}

.supplement-page__task-action {
  justify-self: start;
  padding: 7px 10px;
  border: 1px solid #2980b9;
  border-radius: 4px;
  background: #2980b9;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}

.supplement-page__task-action--secondary {
  border-color: #c7d3dd;
  background: #fff;
  color: #33475b;
}

.supplement-page__task-action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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
