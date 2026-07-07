<template>
  <div class="expansion-page">
    <header class="expansion-page__header">
      <div>
        <h1 class="expansion-page__title">扩库审稿队列</h1>
        <p class="expansion-page__desc">集中查看 Domain Pack 扩库候选项，只导出候选审稿包，不写入正式省份 Markdown。</p>
      </div>
      <div class="expansion-page__header-actions">
        <RouterLink class="expansion-page__back" to="/knowledge-writeback-queue">知识库写回队列</RouterLink>
        <RouterLink class="expansion-page__back expansion-page__back--secondary" to="/projects">项目工作台</RouterLink>
      </div>
    </header>

    <section class="expansion-page__toolbar">
      <input
        v-model="searchQuery"
        class="expansion-page__search"
        placeholder="搜索条目、包、字段、禁写断言…"
      />
      <select v-model="packFilter" class="expansion-page__select">
        <option value="">全部扩库包</option>
        <option v-for="pack in packOptions" :key="pack.pack_id" :value="pack.pack_id">
          {{ pack.entry_name }}
        </option>
      </select>
      <select v-model="videoTypeFilter" class="expansion-page__select">
        <option value="">全部片型</option>
        <option v-for="type in videoTypeOptions" :key="type" :value="type">{{ typeLabel(type) }}</option>
      </select>
      <select v-model="provinceFilter" class="expansion-page__select">
        <option value="">全部省份</option>
        <option v-for="province in provinceOptions" :key="province" :value="province">{{ province }}</option>
      </select>
      <select v-model="statusFilter" class="expansion-page__select">
        <option value="">全部审稿状态</option>
        <option v-for="status in statusOptions" :key="status" :value="status">{{ statusLabel(status) }}</option>
      </select>
      <button
        type="button"
        class="expansion-page__action expansion-page__action--secondary"
        :disabled="Boolean(bulkUpdatingKey) || filteredItems.length === 0"
        @click="bulkUpdateFiltered('approved', 'draft_ready')"
      >
        {{ bulkUpdatingKey === 'approved:draft_ready' ? '更新中…' : '筛选通过' }}
      </button>
      <button
        type="button"
        class="expansion-page__action expansion-page__action--secondary"
        :disabled="Boolean(bulkUpdatingKey) || filteredItems.length === 0"
        @click="bulkUpdateFiltered('approved', 'queued')"
      >
        {{ bulkUpdatingKey === 'approved:queued' ? '更新中…' : '筛选入队' }}
      </button>
      <button
        type="button"
        class="expansion-page__action expansion-page__action--secondary"
        :disabled="Boolean(bulkUpdatingKey) || filteredItems.length === 0"
        @click="bulkUpdateFiltered('needs_revision')"
      >
        {{ bulkUpdatingKey === 'needs_revision' ? '更新中…' : '筛选重审' }}
      </button>
      <button
        type="button"
        class="expansion-page__action"
        :disabled="Boolean(copyingFormat)"
        @click="copyReviewPacket('markdown')"
      >
        {{ copyingFormat === 'markdown' ? '复制中…' : '复制候选 MD' }}
      </button>
      <button
        type="button"
        class="expansion-page__action expansion-page__action--secondary"
        :disabled="Boolean(copyingFormat)"
        @click="copyReviewPacket('json')"
      >
        {{ copyingFormat === 'json' ? '复制中…' : '复制候选 JSON' }}
      </button>
      <button
        type="button"
        class="expansion-page__action expansion-page__action--secondary"
        :disabled="Boolean(copyingFormat)"
        @click="copyApprovedWritebackDraft"
      >
        {{ copyingFormat === 'writeback' ? '复制中…' : '复制筛选草案' }}
      </button>
      <button
        type="button"
        class="expansion-page__action expansion-page__action--secondary"
        :disabled="Boolean(copyingFormat) || coverageItems.length === 0"
        @click="copyCoverageMatrix"
      >
        {{ copyingFormat === 'coverage' ? '复制中…' : '复制覆盖矩阵' }}
      </button>
      <button
        type="button"
        class="expansion-page__action expansion-page__action--ghost"
        :disabled="loading"
        @click="loadQueue"
      >
        {{ loading ? '刷新中…' : '刷新' }}
      </button>
    </section>

    <div v-if="copyMessage" class="expansion-page__notice">{{ copyMessage }}</div>

    <section v-if="report" class="expansion-page__summary">
      <div>
        <span>状态</span>
        <strong>{{ statusLabel(report.status) }}</strong>
      </div>
      <div>
        <span>候选批次</span>
        <strong>{{ report.review_packet.batch_count }}</strong>
      </div>
      <div>
        <span>候选条目</span>
        <strong>{{ report.review_packet.review_item_count }}</strong>
      </div>
      <div>
        <span>当前筛选</span>
        <strong>{{ filteredItems.length }}</strong>
      </div>
      <div>
        <span>候选字段</span>
        <strong>{{ report.review_packet.candidate_field_count }}</strong>
      </div>
      <div>
        <span>片型覆盖</span>
        <strong>{{ report.video_type_coverage_count }}</strong>
      </div>
      <div>
        <span>已通过草案</span>
        <strong>{{ report.review_packet.approved_writeback_draft_count ?? 0 }}</strong>
      </div>
      <div>
        <span>直接写回</span>
        <strong>{{ report.review_policy.direct_writeback_to_province_markdown ? '阻断' : '关闭' }}</strong>
      </div>
    </section>

    <div v-if="loading" class="expansion-page__state">正在加载扩库候选…</div>
    <div v-else-if="error" class="expansion-page__error">{{ error }}</div>

    <section v-else class="expansion-page__list">
      <section v-if="coverageItems.length > 0" class="expansion-page__coverage">
        <header class="expansion-page__coverage-head">
          <h2>片型覆盖矩阵</h2>
          <span>{{ coverageItems.length }} 个片型 · {{ coverageTotals.seedTargets }} 条候选 · {{ coverageTotals.approvedDrafts }} 条草案</span>
        </header>
        <div class="expansion-page__coverage-grid">
          <button
            v-for="item in coverageItems"
            :key="item.video_type"
            type="button"
            :class="['expansion-page__coverage-item', { 'expansion-page__coverage-item--active': videoTypeFilter === item.video_type }]"
            @click="selectCoverageVideoType(item.video_type)"
          >
            <span>{{ typeLabel(item.video_type) }}</span>
            <strong>{{ item.seed_target_count }}</strong>
            <small>{{ item.batch_count }} 批 · {{ item.candidate_field_count }} 字段</small>
            <small>通过 {{ item.review_status_counts.approved }} · 草案 {{ item.approved_writeback_draft_count }} · 入队 {{ item.writeback_status_counts.queued }}</small>
            <em>{{ item.pack_ids.map(packShortLabel).join(' / ') }}</em>
            <em>{{ item.provinces.join('、') || '待确认省份' }}</em>
          </button>
        </div>
      </section>

      <article v-for="item in filteredItems" :key="item.review_item_id" class="expansion-page__item">
        <div class="expansion-page__main">
          <div class="expansion-page__badges">
            <span :class="['expansion-page__status', `expansion-page__status--${effectiveReviewStatus(item)}`]">
              {{ statusLabel(effectiveReviewStatus(item)) }}
            </span>
            <span v-if="item.writeback_status">{{ writebackStatusLabel(item.writeback_status) }}</span>
            <span>{{ item.province }}</span>
            <span>{{ packShortLabel(item.pack_id) }}</span>
            <span v-for="type in item.target_video_types" :key="`${item.review_item_id}:${type}`">
              {{ typeLabel(type) }}
            </span>
          </div>
          <h2>{{ item.entry_name }}</h2>
          <p>{{ item.batch_entry_name }} · {{ item.review_item_id }}</p>

          <div class="expansion-page__columns">
            <div>
              <h3>推荐补字段</h3>
              <ul>
                <li v-for="field in item.recommended_fields" :key="`${item.review_item_id}:field:${field}`">
                  {{ field }}
                </li>
              </ul>
            </div>
            <div>
              <h3>禁写断言</h3>
              <ul>
                <li v-for="claim in item.forbidden_direct_claims" :key="`${item.review_item_id}:claim:${claim}`">
                  {{ claim }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <aside class="expansion-page__side">
          <strong>{{ item.pack_id }}</strong>
          <span>优先级 {{ item.priority }}</span>
          <span>{{ item.target_video_types.length }} 个目标片型</span>
          <textarea
            :value="reviewNoteDraft(item)"
            placeholder="审稿备注"
            @input="updateReviewNoteDraft(item.review_item_id, $event)"
          />
          <div class="expansion-page__status-actions">
            <button type="button" :disabled="updatingItemId === item.review_item_id" @click="setReviewStatus(item, 'approved')">通过</button>
            <button type="button" :disabled="updatingItemId === item.review_item_id" @click="setReviewStatus(item, 'needs_revision')">重审</button>
            <button type="button" :disabled="updatingItemId === item.review_item_id" @click="setReviewStatus(item, 'rejected')">驳回</button>
            <button type="button" :disabled="updatingItemId === item.review_item_id" @click="setReviewStatus(item, 'candidate_review')">待审</button>
          </div>
          <div v-if="effectiveReviewStatus(item) === 'approved'" class="expansion-page__status-actions">
            <button type="button" :disabled="updatingItemId === item.review_item_id" @click="setWritebackStatus(item, 'draft_ready')">草案</button>
            <button type="button" :disabled="updatingItemId === item.review_item_id" @click="setWritebackStatus(item, 'queued')">入队</button>
            <button type="button" :disabled="updatingItemId === item.review_item_id" @click="setWritebackStatus(item, 'written_back')">入库</button>
            <button type="button" :disabled="updatingItemId === item.review_item_id" @click="setWritebackStatus(item, 'needs_revision')">退修</button>
          </div>
          <button type="button" @click="copySingleCandidate(item)">复制单条候选</button>
        </aside>

        <pre>{{ item.candidate_markdown }}</pre>
      </article>

      <div v-if="!loading && filteredItems.length === 0" class="expansion-page__state">没有匹配的扩库候选。</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  getDomainPackExpansionCandidates,
  getDomainPackExpansionWritebackDraft,
  updateDomainPackExpansionReviewState,
  updateDomainPackExpansionReviewStateBulk,
} from '@/api/system'
import type {
  DomainPackExpansionCandidateReport,
  DomainPackExpansionReviewBatch,
  DomainPackExpansionReviewItem,
  DomainPackExpansionReviewStatus,
  DomainPackProductionHealthStatus,
  KnowledgeWritebackStatus,
  VideoType,
} from '@shared/types'

interface ReviewQueueItem extends DomainPackExpansionReviewItem {
  batch_entry_name: string
  batch_status: string
  field_groups: DomainPackExpansionReviewBatch['field_groups']
}

const report = ref<DomainPackExpansionCandidateReport | null>(null)
const loading = ref(false)
const error = ref('')
const copyMessage = ref('')
const copyingFormat = ref<'markdown' | 'json' | 'writeback' | 'coverage' | ''>('')
const updatingItemId = ref('')
const bulkUpdatingKey = ref('')
const searchQuery = ref('')
const packFilter = ref('')
const videoTypeFilter = ref<VideoType | ''>('')
const provinceFilter = ref('')
const statusFilter = ref('')
const reviewNoteDrafts = reactive<Record<string, string>>({})

const batches = computed(() => report.value?.review_packet.batches ?? [])
const coverageItems = computed(() => [...(report.value?.coverage_by_video_type ?? [])]
  .sort((a, b) => b.seed_target_count - a.seed_target_count || typeLabel(a.video_type).localeCompare(typeLabel(b.video_type), 'zh-Hans-CN')))
const coverageTotals = computed(() => coverageItems.value.reduce((totals, item) => ({
  seedTargets: totals.seedTargets + item.seed_target_count,
  approvedDrafts: totals.approvedDrafts + item.approved_writeback_draft_count,
}), { seedTargets: 0, approvedDrafts: 0 }))

const allItems = computed<ReviewQueueItem[]>(() => batches.value.flatMap(batch =>
  batch.review_items.map(item => ({
    ...item,
    batch_entry_name: batch.entry_name,
    batch_status: batch.status,
    field_groups: batch.field_groups,
  })),
))

const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return allItems.value.filter(item => {
    const text = [
      item.review_item_id,
      item.batch_id,
      item.pack_id,
      item.batch_entry_name,
      item.entry_name,
      item.province,
      effectiveReviewStatus(item),
      item.review_note ?? '',
      item.writeback_status ?? '',
      item.writeback_note ?? '',
      ...item.target_video_types,
      ...item.recommended_fields,
      ...item.forbidden_direct_claims,
      item.candidate_markdown,
    ].join(' ').toLowerCase()

    return (!packFilter.value || item.pack_id === packFilter.value)
      && (!videoTypeFilter.value || item.target_video_types.includes(videoTypeFilter.value))
      && (!provinceFilter.value || item.province === provinceFilter.value)
      && (!statusFilter.value || effectiveReviewStatus(item) === statusFilter.value)
      && (!query || text.includes(query))
  })
})

const packOptions = computed(() => batches.value
  .map(batch => ({ pack_id: batch.pack_id, entry_name: batch.entry_name }))
  .sort((a, b) => a.entry_name.localeCompare(b.entry_name, 'zh-Hans-CN')))

const videoTypeOptions = computed(() => [...new Set(allItems.value.flatMap(item => item.target_video_types))]
  .sort((a, b) => typeLabel(a).localeCompare(typeLabel(b), 'zh-Hans-CN')))

const provinceOptions = computed(() => [...new Set(allItems.value.map(item => item.province))]
  .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')))

const statusOptions = computed(() => [...new Set(allItems.value.map(item => effectiveReviewStatus(item)))]
  .sort((a, b) => statusLabel(a).localeCompare(statusLabel(b), 'zh-Hans-CN')))

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    heritage_promo: '非遗宣传',
    documentary_short: '微纪录',
    ai_comic_drama: 'AI漫剧',
    explainer_video: '知识讲解',
    lecture_video: '宣讲片',
    education_training: '教育培训',
    social_short: '竖屏短视频',
    children_story: '儿童故事',
    historical_drama: '历史剧情',
  }
  return map[type] ?? type
}

function statusLabel(status: string | DomainPackProductionHealthStatus): string {
  if (status === 'candidate_review') return '候选审稿'
  if (status === 'approved') return '已通过'
  if (status === 'rejected') return '已驳回'
  if (status === 'needs_revision') return '需重审'
  if (status === 'passed') return '通过'
  if (status === 'warning') return '需关注'
  if (status === 'failed') return '阻断'
  return status || '未记录'
}

function writebackStatusLabel(status: KnowledgeWritebackStatus): string {
  if (status === 'queued') return '已入队'
  if (status === 'written_back') return '已入库'
  if (status === 'needs_revision') return '退修'
  return '草案就绪'
}

function effectiveReviewStatus(item: DomainPackExpansionReviewItem): DomainPackExpansionReviewStatus {
  return item.review_status ?? 'candidate_review'
}

function packShortLabel(packId: string): string {
  const map: Record<string, string> = {
    heritage_process_pack: '非遗流程',
    documentary_source_pack: '纪录来源',
    ai_comic_storyboard_pack: '漫剧分镜',
    era_and_costume_pack: '服饰器物',
    explainer_knowledge_structure_pack: '讲解结构',
    children_adaptation_safety_pack: '儿童安全',
    short_video_hook_pack: '短视频钩子',
    education_training_structure_pack: '宣讲培训',
  }
  return map[packId] ?? packId
}

function selectCoverageVideoType(videoType: string) {
  videoTypeFilter.value = videoTypeFilter.value === videoType ? '' : videoType as VideoType
}

async function loadQueue() {
  loading.value = true
  error.value = ''
  copyMessage.value = ''
  const res = await getDomainPackExpansionCandidates()
  if (res.ok && res.data) {
    report.value = res.data
  } else {
    error.value = res.error?.message ?? '加载扩库候选失败'
  }
  loading.value = false
}

async function copyReviewPacket(format: 'markdown' | 'json') {
  if (!report.value || filteredItems.value.length === 0) {
    copyMessage.value = ''
    error.value = '当前筛选没有可导出的扩库候选'
    return
  }

  copyingFormat.value = format
  error.value = ''
  copyMessage.value = ''
  try {
    const exportPackage = buildFilteredExportPackage()
    const clipboardText = format === 'json'
      ? JSON.stringify(exportPackage, null, 2)
      : renderFilteredExportMarkdown(exportPackage)
    await navigator.clipboard.writeText(clipboardText)
    copyMessage.value = `已复制 ${format === 'json' ? 'JSON 包' : 'Markdown 审稿包'}：${exportPackage.review_item_count} 条候选，${exportPackage.batch_count} 个批次。`
  } catch (err) {
    error.value = err instanceof Error ? err.message : '复制扩库候选失败'
  } finally {
    copyingFormat.value = ''
  }
}

async function copyApprovedWritebackDraft() {
  const items = filteredItems.value
  if (items.length === 0) {
    copyMessage.value = ''
    error.value = '当前筛选没有可导出的扩库候选'
    return
  }

  copyingFormat.value = 'writeback'
  error.value = ''
  copyMessage.value = ''
  try {
    const res = await getDomainPackExpansionWritebackDraft({
      review_item_ids: items.map(item => item.review_item_id),
    })
    if (res.ok && res.data) {
      if (res.data.approved_count === 0) {
        error.value = '当前筛选还没有已通过的扩库写回草案'
      } else {
        await navigator.clipboard.writeText(res.data.markdown)
        copyMessage.value = `已复制筛选草案：${res.data.approved_count} 条，目标文件 ${res.data.target_files.length} 个。`
      }
    } else {
      error.value = res.error?.message ?? '导出已通过扩库草案失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '复制已通过扩库草案失败'
  } finally {
    copyingFormat.value = ''
  }
}

async function copyCoverageMatrix() {
  if (!report.value || coverageItems.value.length === 0) {
    copyMessage.value = ''
    error.value = '当前没有可复制的片型覆盖矩阵'
    return
  }

  copyingFormat.value = 'coverage'
  error.value = ''
  copyMessage.value = ''
  try {
    const payload = {
      schema_version: 'domain-pack-expansion-video-type-coverage-export/v1',
      exported_at: new Date().toISOString(),
      source_schema_version: report.value.source_schema_version,
      domain_id: report.value.domain_id,
      direct_writeback_to_province_markdown: false,
      video_type_coverage_count: report.value.video_type_coverage_count,
      coverage_by_video_type: coverageItems.value,
    }
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    copyMessage.value = `已复制片型覆盖矩阵：${payload.video_type_coverage_count} 个片型，${coverageTotals.value.seedTargets} 条候选。`
  } catch (err) {
    error.value = err instanceof Error ? err.message : '复制片型覆盖矩阵失败'
  } finally {
    copyingFormat.value = ''
  }
}

async function copySingleCandidate(item: ReviewQueueItem) {
  error.value = ''
  copyMessage.value = ''
  try {
    await navigator.clipboard.writeText(item.candidate_markdown)
    copyMessage.value = `已复制候选稿：${item.entry_name}`
  } catch (err) {
    error.value = err instanceof Error ? err.message : '复制单条候选失败'
  }
}

function reviewNoteDraft(item: ReviewQueueItem): string {
  return reviewNoteDrafts[item.review_item_id] ?? item.review_note ?? ''
}

function updateReviewNoteDraft(reviewItemId: string, event: Event) {
  reviewNoteDrafts[reviewItemId] = (event.target as HTMLTextAreaElement).value
}

async function setReviewStatus(item: ReviewQueueItem, reviewStatus: DomainPackExpansionReviewStatus) {
  updatingItemId.value = item.review_item_id
  error.value = ''
  copyMessage.value = ''
  try {
    const res = await updateDomainPackExpansionReviewState({
      review_item_id: item.review_item_id,
      review_status: reviewStatus,
      review_note: reviewNoteDraft(item).trim() || undefined,
      writeback_status: reviewStatus === 'approved' ? (item.writeback_status ?? 'draft_ready') : undefined,
      writeback_note: reviewStatus === 'approved' ? item.writeback_note : undefined,
    })
    if (res.ok && res.data) {
      report.value = res.data
      delete reviewNoteDrafts[item.review_item_id]
      copyMessage.value = `已更新审稿状态：${item.entry_name} · ${statusLabel(reviewStatus)}`
    } else {
      error.value = res.error?.message ?? '更新扩库审稿状态失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '更新扩库审稿状态失败'
  } finally {
    updatingItemId.value = ''
  }
}

async function setWritebackStatus(item: ReviewQueueItem, status: KnowledgeWritebackStatus) {
  updatingItemId.value = item.review_item_id
  error.value = ''
  copyMessage.value = ''
  try {
    const res = await updateDomainPackExpansionReviewState({
      review_item_id: item.review_item_id,
      review_status: 'approved',
      review_note: reviewNoteDraft(item).trim() || item.review_note,
      writeback_status: status,
      writeback_note: item.writeback_note,
    })
    if (res.ok && res.data) {
      report.value = res.data
      copyMessage.value = `已更新写回状态：${item.entry_name} · ${writebackStatusLabel(status)}`
    } else {
      error.value = res.error?.message ?? '更新扩库写回状态失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '更新扩库写回状态失败'
  } finally {
    updatingItemId.value = ''
  }
}

async function bulkUpdateFiltered(
  reviewStatus: DomainPackExpansionReviewStatus,
  writebackStatus?: KnowledgeWritebackStatus,
) {
  const items = filteredItems.value
  if (items.length === 0) return
  const actionLabel = writebackStatus === 'queued'
    ? '标记为已入队'
    : reviewStatus === 'approved'
      ? '标记为已通过'
      : '标记为需重审'
  const confirmed = window.confirm(`${actionLabel}当前筛选的 ${items.length} 条扩库候选？`)
  if (!confirmed) return

  bulkUpdatingKey.value = writebackStatus ? `${reviewStatus}:${writebackStatus}` : reviewStatus
  error.value = ''
  copyMessage.value = ''
  try {
    const res = await updateDomainPackExpansionReviewStateBulk({
      review_item_ids: items.map(item => item.review_item_id),
      review_status: reviewStatus,
      review_note: `批量操作：${actionLabel}`,
      writeback_status: reviewStatus === 'approved' ? writebackStatus : undefined,
      writeback_note: writebackStatus ? `批量操作：${writebackStatusLabel(writebackStatus)}` : undefined,
    })
    if (res.ok && res.data) {
      report.value = res.data.report
      copyMessage.value = `已批量更新 ${res.data.updated_count} 条扩库候选：${actionLabel}。`
    } else {
      error.value = res.error?.message ?? '批量更新扩库审稿状态失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '批量更新扩库审稿状态失败'
  } finally {
    bulkUpdatingKey.value = ''
  }
}

function buildFilteredExportPackage() {
  const items = filteredItems.value
  const batchIds = [...new Set(items.map(item => item.batch_id))]
  return {
    schema_version: 'domain-pack-expansion-review-filtered-export/v1',
    exported_at: new Date().toISOString(),
    source_schema_version: report.value?.source_schema_version ?? 'unknown',
    source_review_packet_schema_version: report.value?.review_packet.schema_version ?? 'unknown',
    domain_id: report.value?.domain_id ?? 'china_culture',
    direct_writeback_to_province_markdown: false,
    filters: {
      pack_id: packFilter.value || undefined,
      video_type: videoTypeFilter.value || undefined,
      province: provinceFilter.value || undefined,
      candidate_status: statusFilter.value || undefined,
      search_query: searchQuery.value.trim() || undefined,
    },
    batch_count: batchIds.length,
    review_item_count: items.length,
    batches: batchIds.map(batchId => {
      const batch = batches.value.find(item => item.batch_id === batchId)
      const reviewItems = items.filter(item => item.batch_id === batchId)
      return {
        batch_id: batchId,
        pack_id: batch?.pack_id ?? reviewItems[0]?.pack_id ?? 'unknown',
        entry_name: batch?.entry_name ?? reviewItems[0]?.batch_entry_name ?? 'unknown',
        status: batch?.status ?? reviewItems[0]?.batch_status ?? 'unknown',
        target_video_types: batch?.target_video_types ?? [],
        review_item_count: reviewItems.length,
        review_items: reviewItems,
      }
    }),
  }
}

function renderFilteredExportMarkdown(exportPackage: ReturnType<typeof buildFilteredExportPackage>): string {
  const filterLines = Object.entries(exportPackage.filters)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `- ${key}: ${value}`)
  const batchSections = exportPackage.batches.flatMap(batch => [
    `## ${batch.pack_id} · ${batch.batch_id}`,
    '',
    `- entry_name: ${batch.entry_name}`,
    `- status: ${batch.status}`,
    `- review_item_count: ${batch.review_item_count}`,
    '',
    ...batch.review_items.flatMap(item => [item.candidate_markdown, '']),
  ])

  return [
    '# Domain Pack Expansion Filtered Review Export',
    '',
    `> schema_version: ${exportPackage.schema_version}`,
    `> exported_at: ${exportPackage.exported_at}`,
    `> source_schema_version: ${exportPackage.source_schema_version}`,
    `> source_review_packet_schema_version: ${exportPackage.source_review_packet_schema_version}`,
    `> direct_writeback_to_province_markdown: ${exportPackage.direct_writeback_to_province_markdown}`,
    '',
    '## Filters',
    '',
    ...(filterLines.length ? filterLines : ['- none']),
    '',
    '## Counts',
    '',
    `- batch_count: ${exportPackage.batch_count}`,
    `- review_item_count: ${exportPackage.review_item_count}`,
    '',
    ...batchSections,
  ].join('\n').trim() + '\n'
}

onMounted(async () => {
  await loadQueue()
})
</script>

<style scoped>
.expansion-page {
  max-width: 1180px;
  margin: 0 auto;
}

.expansion-page__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.expansion-page__header-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  align-items: center;
}

.expansion-page__title {
  margin: 0 0 6px;
  color: #22313f;
  font-size: 28px;
}

.expansion-page__desc {
  margin: 0;
  color: #66727f;
  line-height: 1.6;
}

.expansion-page__back {
  flex: 0 0 auto;
  border-radius: 4px;
  background: #2980b9;
  color: #fff;
  padding: 10px 14px;
  text-decoration: none;
  font-size: 14px;
}

.expansion-page__back--secondary {
  border: 1px solid #2980b9;
  background: #fff;
  color: #2980b9;
}

.expansion-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.expansion-page__search,
.expansion-page__select {
  padding: 10px 12px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  font-size: 14px;
}

.expansion-page__search {
  flex: 1 1 260px;
}

.expansion-page__select {
  min-width: 150px;
}

.expansion-page__action,
.expansion-page__side button {
  border: 1px solid #2980b9;
  border-radius: 6px;
  padding: 10px 12px;
  background: #2980b9;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.expansion-page__action--secondary {
  border-color: #7d8b99;
  background: #fff;
  color: #2f3f4f;
}

.expansion-page__action--ghost {
  border-color: #c7d3dd;
  background: #fff;
  color: #33475b;
}

.expansion-page__action:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.expansion-page__notice {
  margin: -2px 0 14px;
  border: 1px solid #badbcc;
  border-radius: 6px;
  padding: 8px 10px;
  background: #f0f8f4;
  color: #216e44;
  font-size: 13px;
}

.expansion-page__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.expansion-page__summary div,
.expansion-page__item {
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  background: #fff;
}

.expansion-page__summary div {
  padding: 12px;
}

.expansion-page__summary span {
  display: block;
  margin-bottom: 4px;
  color: #66727f;
  font-size: 13px;
}

.expansion-page__summary strong {
  color: #22313f;
  font-size: 22px;
}

.expansion-page__coverage {
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  background: #fff;
  padding: 16px;
}

.expansion-page__coverage-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
  margin-bottom: 12px;
}

.expansion-page__coverage-head h2 {
  margin: 0;
  color: #22313f;
  font-size: 18px;
}

.expansion-page__coverage-head span {
  color: #66727f;
  font-size: 13px;
}

.expansion-page__coverage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 10px;
}

.expansion-page__coverage-item {
  display: grid;
  gap: 5px;
  min-height: 158px;
  padding: 12px;
  border: 1px solid #d7dee5;
  border-radius: 8px;
  background: #f8fbfd;
  color: #33475b;
  text-align: left;
  cursor: pointer;
}

.expansion-page__coverage-item--active {
  border-color: #2980b9;
  background: #edf7fd;
}

.expansion-page__coverage-item span {
  color: #22313f;
  font-size: 15px;
  font-weight: 700;
}

.expansion-page__coverage-item strong {
  color: #1f618d;
  font-size: 24px;
}

.expansion-page__coverage-item small,
.expansion-page__coverage-item em {
  color: #5b6b7a;
  font-size: 12px;
  font-style: normal;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.expansion-page__list {
  display: grid;
  gap: 12px;
}

.expansion-page__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 14px;
  padding: 16px;
}

.expansion-page__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.expansion-page__badges span {
  padding: 3px 7px;
  border-radius: 4px;
  background: #eef3f7;
  color: #465767;
  font-size: 12px;
}

.expansion-page__status--candidate_review {
  background: #fff4de !important;
  color: #7b4f00 !important;
}

.expansion-page__main h2 {
  margin: 8px 0 6px;
  color: #22313f;
  font-size: 18px;
}

.expansion-page__main p {
  margin: 0 0 10px;
  color: #465767;
  line-height: 1.6;
}

.expansion-page__columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.expansion-page__columns h3 {
  margin: 0 0 6px;
  color: #33475b;
  font-size: 14px;
}

.expansion-page__columns ul {
  margin: 0;
  padding-left: 18px;
  color: #4c5e6f;
  line-height: 1.6;
}

.expansion-page__side {
  display: grid;
  align-content: start;
  gap: 8px;
  color: #66727f;
  font-size: 13px;
}

.expansion-page__side strong {
  color: #22313f;
  overflow-wrap: anywhere;
}

.expansion-page__side textarea {
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

.expansion-page__status-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.expansion-page__side button {
  padding: 8px 10px;
  font-size: 13px;
}

.expansion-page__item pre {
  grid-column: 1 / -1;
  max-height: 260px;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  color: #4c5e6f;
  font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.expansion-page__state,
.expansion-page__error {
  padding: 24px;
  border-radius: 6px;
  background: #fff;
  color: #66727f;
  text-align: center;
}

.expansion-page__error {
  background: #fdecea;
  color: #c0392b;
}

@media (max-width: 760px) {
  .expansion-page__header,
  .expansion-page__coverage-head,
  .expansion-page__toolbar,
  .expansion-page__item,
  .expansion-page__columns {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .expansion-page__header-actions,
  .expansion-page__back,
  .expansion-page__search,
  .expansion-page__select {
    width: 100%;
  }
}
</style>
