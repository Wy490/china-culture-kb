<template>
  <main class="reference-workbench">
    <header class="hero">
      <div>
        <p class="eyebrow">Reference Library · P1-A2c</p>
        <h1>参考资料分析任务台</h1>
        <p class="hero__summary">
          为已登记、已指纹绑定的合法参考资料创建来源绑定任务，并接收结构化分析 evidence。
        </p>
      </div>
      <div class="hero__truth-lock" data-testid="reference-truth-lock">
        <strong>边界锁</strong>
        <span>服务端不下载原文</span>
        <span>机器不核验授权真伪</span>
        <span>不授予真人评审或生产信用</span>
      </div>
    </header>

    <section class="boundary-grid" aria-label="治理边界">
      <article>
        <span class="boundary-grid__icon">01</span>
        <div>
          <strong>原资料带外传输</strong>
          <p>Codex 或操作员仅处理用户合法提供的材料；本工作台不抓取 URL。</p>
        </div>
      </article>
      <article>
        <span class="boundary-grid__icon">02</span>
        <div>
          <strong>观察正文不进任务账本</strong>
          <p>任务只保留提交 key、观察和 evidence 的 SHA-256。</p>
        </div>
      </article>
      <article>
        <span class="boundary-grid__icon">03</span>
        <div>
          <strong>Evidence 不等于通过</strong>
          <p>结果不得直接写回知识库、注入生成 prompt 或计作人工通过。</p>
        </div>
      </article>
    </section>

    <p v-if="pageError" class="notice notice--error" role="alert">{{ pageError }}</p>
    <p v-if="notice" class="notice notice--success" role="status">{{ notice }}</p>

    <div v-if="loadingSources" class="empty-state">正在读取参考来源…</div>
    <div v-else-if="sources.length === 0" class="empty-state" data-testid="reference-empty-state">
      <h2>尚无已登记来源</h2>
      <p>
        请先通过受控 API 登记来源、权利状态、访问范围与内容指纹。这里不会代替用户提供或下载参考资料。
      </p>
    </div>

    <div v-else class="workbench-grid">
      <aside class="source-panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Source registry</p>
            <h2>来源</h2>
          </div>
          <span>{{ sources.length }}</span>
        </div>
        <button
          v-for="source in sources"
          :key="source.reference_id"
          type="button"
          class="source-card"
          :class="{ 'source-card--active': source.reference_id === selectedReferenceId }"
          :aria-pressed="source.reference_id === selectedReferenceId"
          @click="selectedReferenceId = source.reference_id"
        >
          <span class="source-card__type">{{ mediaTypeLabel[source.media_type] }}</span>
          <strong>{{ source.title }}</strong>
          <span>{{ rightsLabel[source.rights_status] }} · {{ accessLabel[source.access_scope] }}</span>
          <span
            class="eligibility"
            :class="isTaskEligible(source) ? 'eligibility--ready' : 'eligibility--blocked'"
          >
            {{ isTaskEligible(source) ? '可创建分析任务' : '缺少合法任务条件' }}
          </span>
        </button>
      </aside>

      <section class="workbench-main">
        <div v-if="loadingDetail" class="empty-state">正在读取来源账本…</div>
        <template v-else-if="selectedSource">
          <article class="source-detail">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Selected source</p>
                <h2>{{ selectedSource.title }}</h2>
              </div>
              <span>{{ selectedSource.reference_id }}</span>
            </div>
            <dl>
              <div><dt>权利状态</dt><dd>{{ rightsLabel[selectedSource.rights_status] }}</dd></div>
              <div><dt>访问范围</dt><dd>{{ accessLabel[selectedSource.access_scope] }}</dd></div>
              <div><dt>内容指纹</dt><dd class="hash">{{ selectedSource.content_fingerprint || '未登记' }}</dd></div>
              <div><dt>用途说明</dt><dd>{{ selectedSource.user_reason }}</dd></div>
            </dl>
          </article>

          <article class="form-card">
            <div class="section-heading">
              <div>
                <p class="eyebrow">New task</p>
                <h2>创建来源绑定任务</h2>
              </div>
              <span>authorization.machine_verified = false</span>
            </div>

            <p v-if="!isTaskEligible(selectedSource)" class="notice notice--warning">
              该来源必须是用户自有、已授权或公版资料，访问范围为摘录或用户完整提供，并带有内容指纹。
            </p>

            <fieldset :disabled="creatingTask || !isTaskEligible(selectedSource)">
              <legend>分析维度</legend>
              <label v-for="dimension in dimensionOptions" :key="dimension.value" class="check-row">
                <input v-model="requestedDimensions" type="checkbox" :value="dimension.value">
                <span><strong>{{ dimension.label }}</strong><small>{{ dimension.help }}</small></span>
              </label>
            </fieldset>

            <div class="form-grid">
              <label>
                授权依据编号 / 文件引用
                <input
                  v-model.trim="authorizationReference"
                  :disabled="creatingTask || !isTaskEligible(selectedSource)"
                  placeholder="例如：license-contract-2026-07"
                >
              </label>
              <label>
                声明人
                <input
                  v-model.trim="attestedBy"
                  :disabled="creatingTask || !isTaskEligible(selectedSource)"
                  placeholder="姓名或受控 actor id"
                >
              </label>
              <label class="form-grid__wide">
                声明时间（ISO 8601）
                <input
                  v-model.trim="attestedAt"
                  :disabled="creatingTask || !isTaskEligible(selectedSource)"
                  placeholder="2026-07-25T08:00:00.000Z"
                >
              </label>
            </div>
            <label class="attestation">
              <input
                v-model="authorizationConfirmed"
                type="checkbox"
                :disabled="creatingTask || !isTaskEligible(selectedSource)"
              >
              <span>
                我确认资料只用于已授权的相似度分析；该声明由人提供，机器不会验证其法律真实性。
              </span>
            </label>
            <button
              type="button"
              class="primary-button"
              :disabled="!canCreateTask"
              data-testid="create-reference-task"
              @click="handleCreateTask"
            >
              {{ creatingTask ? '正在创建…' : '创建分析任务' }}
            </button>
          </article>

          <section class="task-section">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Task ledger</p>
                <h2>任务与 Evidence</h2>
              </div>
              <span>{{ tasks.length }} 个任务 · {{ evidenceCount }} 份 evidence</span>
            </div>

            <div v-if="tasks.length === 0" class="empty-state empty-state--compact">
              该来源还没有分析任务。
            </div>
            <div v-else class="task-layout">
              <div class="task-list">
                <button
                  v-for="task in tasks"
                  :key="task.task_id"
                  type="button"
                  class="task-card"
                  :class="{ 'task-card--active': task.task_id === selectedTaskId }"
                  :aria-pressed="task.task_id === selectedTaskId"
                  @click="selectedTaskId = task.task_id"
                >
                  <span class="status-pill" :class="`status-pill--${task.status}`">
                    {{ statusLabel[task.status] }}
                  </span>
                  <strong>{{ task.requested_dimensions.map(item => dimensionLabel[item]).join(' · ') }}</strong>
                  <span class="task-card__id">{{ task.task_id }}</span>
                  <small>{{ formatTime(task.created_at) }}</small>
                </button>
              </div>

              <article v-if="selectedTask" class="submission-card">
                <div class="submission-card__header">
                  <div>
                    <p class="eyebrow">Structured submission</p>
                    <h3>{{ selectedTask.status === 'completed' ? 'Evidence 已封存' : '提交结构化观察' }}</h3>
                  </div>
                  <span class="status-pill" :class="`status-pill--${selectedTask.status}`">
                    {{ statusLabel[selectedTask.status] }}
                  </span>
                </div>

                <template v-if="selectedTask.status !== 'completed'">
                  <p class="helper">
                    JSON 必须且只能覆盖任务要求的维度。编辑区不会自动获取或保存参考原文。
                  </p>
                  <label>
                    幂等提交 key
                    <input v-model.trim="submissionKey" minlength="8" maxlength="200">
                  </label>
                  <label>
                    observations JSON
                    <textarea
                      v-model="submissionJson"
                      rows="18"
                      spellcheck="false"
                      data-testid="reference-observations-json"
                    />
                  </label>
                  <button
                    type="button"
                    class="primary-button"
                    :disabled="submittingEvidence"
                    data-testid="submit-reference-evidence"
                    @click="handleSubmitEvidence"
                  >
                    {{ submittingEvidence ? '正在校验并提交…' : '提交不可变 Evidence' }}
                  </button>
                </template>

                <dl v-else class="evidence-summary" data-testid="reference-evidence-summary">
                  <div><dt>Evidence ID</dt><dd class="hash">{{ selectedTask.evidence_id }}</dd></div>
                  <div><dt>Evidence SHA-256</dt><dd class="hash">{{ selectedTask.evidence_payload_sha256 }}</dd></div>
                  <div><dt>观察 SHA-256</dt><dd class="hash">{{ selectedTask.observations_sha256 }}</dd></div>
                  <div><dt>输入来源</dt><dd>operator_submitted</dd></div>
                  <div><dt>真人评审完成</dt><dd class="truth-false">false</dd></div>
                  <div><dt>真实信用</dt><dd class="truth-false">false</dd></div>
                </dl>
              </article>
            </div>
          </section>
        </template>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type {
  ReferenceAnalysisTaskRecord,
  ReferenceLibraryDetail,
  ReferenceSimilarityDimension,
  ReferenceSimilarityEvidenceObservations,
  ReferenceSourceMediaType,
  ReferenceSourceRecord,
  ReferenceRightsStatus,
} from '@shared/types'
import {
  createReferenceAnalysisTask,
  getReferenceLibraryDetail,
  listReferenceAnalysisTasks,
  listReferenceSources,
  submitReferenceAnalysisTask,
} from '@/api/reference-library'

const sources = ref<ReferenceSourceRecord[]>([])
const detail = ref<ReferenceLibraryDetail | null>(null)
const tasks = ref<ReferenceAnalysisTaskRecord[]>([])
const selectedReferenceId = ref('')
const selectedTaskId = ref('')
const loadingSources = ref(false)
const loadingDetail = ref(false)
const creatingTask = ref(false)
const submittingEvidence = ref(false)
const pageError = ref('')
const notice = ref('')
const requestedDimensions = ref<ReferenceSimilarityDimension[]>(['excerpt'])
const authorizationReference = ref('')
const attestedBy = ref('')
const attestedAt = ref(new Date().toISOString())
const authorizationConfirmed = ref(false)
const submissionKey = ref(createSubmissionKey())
const submissionJson = ref('')

const mediaTypeLabel: Record<ReferenceSourceMediaType, string> = {
  film: '电影',
  episode: '剧集',
  promo: '宣传片',
  novel: '小说',
  screenplay: '剧本',
  tutorial: '教程',
}
const rightsLabel: Record<ReferenceRightsStatus, string> = {
  user_owned: '用户自有',
  licensed: '已授权',
  public_domain: '公版',
  research_only: '仅研究',
  unknown: '未知',
}
const accessLabel: Record<ReferenceSourceRecord['access_scope'], string> = {
  metadata_only: '仅元数据',
  excerpt: '摘录',
  full_user_supplied: '用户完整提供',
}
const statusLabel: Record<ReferenceAnalysisTaskRecord['status'], string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成',
}
const dimensionLabel: Record<ReferenceSimilarityDimension, string> = {
  excerpt: '摘录',
  character_design: '角色设计',
  plot_structure: '情节结构',
  shot_sequence: '镜头序列',
}
const dimensionOptions: Array<{
  value: ReferenceSimilarityDimension
  label: string
  help: string
}> = [
  { value: 'excerpt', label: '摘录', help: '定位并记录短文本观察' },
  { value: 'character_design', label: '角色设计', help: '记录角色标签与显著标记' },
  { value: 'plot_structure', label: '情节结构', help: '按顺序记录情节节拍标记' },
  { value: 'shot_sequence', label: '镜头序列', help: '按顺序记录镜头设计标记' },
]

const selectedSource = computed(() => (
  sources.value.find(source => source.reference_id === selectedReferenceId.value) ?? null
))
const selectedTask = computed(() => (
  tasks.value.find(task => task.task_id === selectedTaskId.value) ?? null
))
const evidenceCount = computed(() => detail.value?.similarity_evidence.length ?? 0)
const canCreateTask = computed(() => Boolean(
  selectedSource.value
  && isTaskEligible(selectedSource.value)
  && requestedDimensions.value.length
  && authorizationReference.value
  && attestedBy.value
  && isIsoTimestamp(attestedAt.value)
  && authorizationConfirmed.value
  && !creatingTask.value,
))

function isTaskEligible(source: ReferenceSourceRecord): boolean {
  return (
    ['user_owned', 'licensed', 'public_domain'].includes(source.rights_status)
    && ['excerpt', 'full_user_supplied'].includes(source.access_scope)
    && Boolean(source.content_fingerprint)
  )
}

function createSubmissionKey(): string {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `reference-workbench-${suffix}`
}

function isIsoTimestamp(value: string): boolean {
  return value.length > 0 && !Number.isNaN(Date.parse(value))
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function createObservationTemplate(
  dimensions: ReferenceSimilarityDimension[],
): ReferenceSimilarityEvidenceObservations {
  const requested = new Set(dimensions)
  return {
    excerpts: requested.has('excerpt')
      ? [{ observation_id: 'excerpt-1', source_locator: '请填写来源定位', text: '请替换为至少十五个字符的合法来源摘录观察。' }]
      : [],
    character_profiles: requested.has('character_design')
      ? [{ observation_id: 'character-1', label: '请填写角色标签', distinctive_markers: ['显著标记一', '显著标记二'] }]
      : [],
    plot_beats: requested.has('plot_structure')
      ? [{ observation_id: 'plot-1', order: 1, distinctive_markers: ['结构标记一', '结构标记二'] }]
      : [],
    shot_sequence: requested.has('shot_sequence')
      ? [{ observation_id: 'shot-1', order: 1, distinctive_markers: ['镜头标记一', '镜头标记二'] }]
      : [],
  }
}

function resetSubmissionEditor(task: ReferenceAnalysisTaskRecord | null): void {
  submissionKey.value = createSubmissionKey()
  submissionJson.value = task
    ? JSON.stringify(createObservationTemplate(task.requested_dimensions), null, 2)
    : ''
}

async function loadSources(): Promise<void> {
  loadingSources.value = true
  pageError.value = ''
  const response = await listReferenceSources()
  loadingSources.value = false
  if (!response.ok || !response.data) {
    pageError.value = response.error?.message ?? '读取参考来源失败'
    return
  }
  sources.value = response.data
  if (!sources.value.some(source => source.reference_id === selectedReferenceId.value)) {
    selectedReferenceId.value = (
      sources.value.find(isTaskEligible) ?? sources.value[0]
    )?.reference_id ?? ''
  }
}

async function loadSelectedSource(): Promise<void> {
  if (!selectedReferenceId.value) {
    detail.value = null
    tasks.value = []
    return
  }
  loadingDetail.value = true
  pageError.value = ''
  const [detailResponse, tasksResponse] = await Promise.all([
    getReferenceLibraryDetail(selectedReferenceId.value),
    listReferenceAnalysisTasks(selectedReferenceId.value),
  ])
  loadingDetail.value = false
  if (!detailResponse.ok || !detailResponse.data) {
    pageError.value = detailResponse.error?.message ?? '读取来源详情失败'
    return
  }
  if (!tasksResponse.ok || !tasksResponse.data) {
    pageError.value = tasksResponse.error?.message ?? '读取分析任务失败'
    return
  }
  detail.value = detailResponse.data
  tasks.value = tasksResponse.data
  if (!tasks.value.some(task => task.task_id === selectedTaskId.value)) {
    selectedTaskId.value = (
      tasks.value.find(task => task.status !== 'completed') ?? tasks.value[0]
    )?.task_id ?? ''
  }
}

async function handleCreateTask(): Promise<void> {
  const source = selectedSource.value
  if (!source || !canCreateTask.value) return
  if (!['user_owned', 'licensed', 'public_domain'].includes(source.rights_status)) return
  creatingTask.value = true
  pageError.value = ''
  notice.value = ''
  const response = await createReferenceAnalysisTask(source.reference_id, {
    requested_dimensions: [...requestedDimensions.value],
    authorization: {
      basis: source.rights_status as 'user_owned' | 'licensed' | 'public_domain',
      authorization_reference: authorizationReference.value,
      attested_by: attestedBy.value,
      attested_at: new Date(attestedAt.value).toISOString(),
      confirmation: 'authorized_similarity_analysis_only',
    },
  })
  creatingTask.value = false
  if (!response.ok || !response.data) {
    pageError.value = response.error?.message ?? '创建分析任务失败'
    return
  }
  notice.value = `任务 ${response.data.task_id} 已创建；授权仍为人工声明、机器未核验。`
  selectedTaskId.value = response.data.task_id
  await loadSelectedSource()
}

function parseObservations(): ReferenceSimilarityEvidenceObservations | null {
  try {
    const value = JSON.parse(submissionJson.value) as Partial<ReferenceSimilarityEvidenceObservations>
    const keys = ['excerpts', 'character_profiles', 'plot_beats', 'shot_sequence'] as const
    if (
      !value
      || typeof value !== 'object'
      || keys.some(key => !Array.isArray(value[key]))
      || Object.keys(value).some(key => !keys.includes(key as typeof keys[number]))
    ) {
      throw new Error('observations 必须且只能包含四个数组字段')
    }
    return value as ReferenceSimilarityEvidenceObservations
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'observations JSON 无法解析'
    return null
  }
}

async function handleSubmitEvidence(): Promise<void> {
  const task = selectedTask.value
  if (!task || task.status === 'completed') return
  if (submissionKey.value.length < 8) {
    pageError.value = '幂等提交 key 至少需要 8 个字符'
    return
  }
  pageError.value = ''
  notice.value = ''
  const observations = parseObservations()
  if (!observations) return
  submittingEvidence.value = true
  const response = await submitReferenceAnalysisTask(task.task_id, {
    submission_key: submissionKey.value,
    observations,
  })
  submittingEvidence.value = false
  if (!response.ok || !response.data) {
    pageError.value = response.error?.message ?? '提交 evidence 失败'
    return
  }
  notice.value = response.data.idempotent_replay
    ? `Evidence ${response.data.evidence.evidence_id} 已幂等重放。`
    : `Evidence ${response.data.evidence.evidence_id} 已完成不可变封存。`
  await loadSelectedSource()
}

watch(selectedReferenceId, () => {
  selectedTaskId.value = ''
  notice.value = ''
  void loadSelectedSource()
})

watch(selectedTask, task => resetSubmissionEditor(task), { immediate: true })

onMounted(() => {
  void loadSources()
})
</script>

<style scoped>
.reference-workbench {
  max-width: 1220px;
  margin: 0 auto;
  color: #e7e2d7;
}

.hero,
.section-heading,
.submission-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.hero {
  padding: 30px;
  border: 1px solid rgba(214, 176, 105, 0.32);
  border-radius: 20px;
  background:
    radial-gradient(circle at 85% 10%, rgba(158, 70, 44, 0.28), transparent 34%),
    linear-gradient(135deg, #211f1c, #171715);
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  max-width: 720px;
  margin-bottom: 10px;
  font-size: clamp(30px, 5vw, 52px);
  line-height: 1.05;
  letter-spacing: -0.04em;
}

h2 {
  margin-bottom: 0;
  font-size: 22px;
}

.eyebrow {
  margin-bottom: 8px;
  color: #d7a75d;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hero__summary {
  max-width: 720px;
  margin-bottom: 0;
  color: #aaa397;
  line-height: 1.7;
}

.hero__truth-lock {
  display: grid;
  flex: 0 0 250px;
  gap: 7px;
  padding: 17px;
  border: 1px solid rgba(224, 115, 78, 0.45);
  border-radius: 14px;
  background: rgba(54, 24, 18, 0.58);
  color: #c7bcb0;
  font-size: 13px;
}

.hero__truth-lock strong {
  color: #ffb18f;
}

.boundary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin: 16px 0;
}

.boundary-grid article {
  display: flex;
  gap: 12px;
  padding: 16px;
  border: 1px solid #35332e;
  border-radius: 14px;
  background: #1c1c19;
}

.boundary-grid__icon {
  color: #d7a75d;
  font: 700 12px/1.4 ui-monospace, monospace;
}

.boundary-grid p {
  margin: 5px 0 0;
  color: #979188;
  font-size: 12px;
  line-height: 1.55;
}

.workbench-grid {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 16px;
}

.source-panel,
.source-detail,
.form-card,
.task-section {
  padding: 20px;
  border: 1px solid #35332e;
  border-radius: 16px;
  background: #1c1c19;
}

.source-panel {
  align-self: start;
}

.section-heading {
  margin-bottom: 16px;
}

.section-heading > span {
  max-width: 48%;
  overflow-wrap: anywhere;
  color: #847f76;
  font: 11px/1.5 ui-monospace, monospace;
  text-align: right;
}

.source-card,
.task-card {
  display: grid;
  width: 100%;
  gap: 7px;
  margin-top: 10px;
  padding: 14px;
  border: 1px solid #38362f;
  border-radius: 12px;
  background: #23221e;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.source-card:hover,
.task-card:hover,
.source-card--active,
.task-card--active {
  border-color: #b88545;
}

.source-card--active,
.task-card--active {
  background: #2c271f;
}

.source-card__type,
.task-card__id,
.source-card > span:not(.eligibility) {
  color: #918a7f;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.eligibility,
.status-pill {
  justify-self: start;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
}

.eligibility--ready,
.status-pill--completed {
  background: rgba(57, 150, 102, 0.17);
  color: #83d4a8;
}

.eligibility--blocked,
.status-pill--processing {
  background: rgba(204, 112, 68, 0.17);
  color: #e59b75;
}

.status-pill--pending {
  background: rgba(204, 166, 79, 0.16);
  color: #e3c073;
}

.workbench-main {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.source-detail dl,
.evidence-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  overflow: hidden;
  border-radius: 10px;
  background: #34312a;
}

.source-detail dl div,
.evidence-summary div {
  min-width: 0;
  padding: 12px;
  background: #23221e;
}

dt {
  margin-bottom: 5px;
  color: #8f897f;
  font-size: 11px;
}

dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.hash {
  font: 11px/1.6 ui-monospace, monospace;
}

fieldset {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 0 0 16px;
  padding: 0;
  border: 0;
}

legend {
  margin-bottom: 9px;
  color: #aaa397;
  font-size: 12px;
}

.check-row,
.attestation {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 11px;
  border: 1px solid #38362f;
  border-radius: 10px;
  background: #23221e;
}

.check-row span {
  display: grid;
  gap: 3px;
}

.check-row small,
.helper {
  color: #8e887f;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.form-grid__wide {
  grid-column: 1 / -1;
}

label {
  color: #aaa397;
  font-size: 12px;
  line-height: 1.5;
}

input:not([type='checkbox']),
textarea {
  box-sizing: border-box;
  width: 100%;
  margin-top: 6px;
  padding: 10px 12px;
  border: 1px solid #444137;
  border-radius: 9px;
  outline: none;
  background: #161614;
  color: #e7e2d7;
}

input:focus,
textarea:focus {
  border-color: #c09151;
  box-shadow: 0 0 0 3px rgba(192, 145, 81, 0.12);
}

textarea {
  resize: vertical;
  font: 12px/1.55 ui-monospace, monospace;
}

.attestation {
  margin: 14px 0;
}

.primary-button {
  padding: 10px 16px;
  border: 0;
  border-radius: 9px;
  background: #d6a85e;
  color: #191713;
  font-weight: 800;
  cursor: pointer;
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.task-layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 12px;
}

.task-list {
  max-height: 670px;
  overflow: auto;
}

.task-card small {
  color: #777168;
}

.submission-card {
  min-width: 0;
  padding: 16px;
  border: 1px solid #38362f;
  border-radius: 12px;
  background: #23221e;
}

.submission-card label {
  display: block;
  margin-bottom: 12px;
}

.truth-false {
  color: #ff9f81;
  font-weight: 700;
}

.notice,
.empty-state {
  padding: 16px;
  border: 1px solid #3b3933;
  border-radius: 12px;
  background: #1c1c19;
  color: #bcb5a9;
}

.notice {
  margin: 12px 0;
}

.notice--error {
  border-color: rgba(211, 78, 62, 0.55);
  color: #ff9d8e;
}

.notice--success {
  border-color: rgba(73, 160, 106, 0.55);
  color: #8bd9ac;
}

.notice--warning {
  border-color: rgba(202, 153, 68, 0.5);
  color: #dfbf7d;
}

.empty-state {
  text-align: center;
}

.empty-state--compact {
  padding: 28px 16px;
}

@media (max-width: 900px) {
  .hero,
  .section-heading,
  .submission-card__header {
    flex-direction: column;
  }

  .hero__truth-lock {
    width: 100%;
    box-sizing: border-box;
  }

  .boundary-grid,
  .workbench-grid,
  .task-layout {
    grid-template-columns: 1fr;
  }

  .section-heading > span {
    max-width: none;
    text-align: left;
  }
}

@media (max-width: 620px) {
  .boundary-grid,
  .form-grid,
  fieldset,
  .source-detail dl,
  .evidence-summary {
    grid-template-columns: 1fr;
  }
}
</style>
