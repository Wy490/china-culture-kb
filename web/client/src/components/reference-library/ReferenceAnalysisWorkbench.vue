<template>
  <section class="analysis-workbench">
    <header class="analysis-workbench__heading">
      <div>
        <p>Analysis review</p>
        <h2>结构化分析与独立审核</h2>
      </div>
      <span>{{ analyses.length }} 份 · {{ approvedCount }} 已批准</span>
    </header>

    <div class="analysis-workbench__boundary">
      研究编辑提交的分析默认是 pending。只有具有 <code>material:sign</code> 的评审者完成人工检查后才能批准。
    </div>

    <div class="analysis-workbench__layout">
      <div class="analysis-workbench__list">
        <button
          v-for="analysis in analyses"
          :key="analysis.analysis_id"
          type="button"
          :class="{ active: analysis.analysis_id === selectedAnalysisId }"
          @click="selectedAnalysisId = analysis.analysis_id"
        >
          <span :class="`status status--${analysis.approval.status}`">
            {{ analysis.approval.status === 'approved' ? '已批准' : '待审核' }}
          </span>
          <strong>{{ analysis.analysis_type === 'film' ? '影视分析' : '文本分析' }}</strong>
          <small>{{ analysis.analysis_id }}</small>
          <small>{{ analysis.analyzed_by }} · {{ formatTime(analysis.analyzed_at) }}</small>
        </button>
        <p v-if="analyses.length === 0" class="analysis-workbench__empty">尚无结构化分析。</p>
      </div>

      <article class="analysis-workbench__editor">
        <template v-if="selectedAnalysis">
          <header class="analysis-workbench__selected">
            <div>
              <p>Selected analysis</p>
              <h3>{{ selectedAnalysis.analysis_id }}</h3>
            </div>
            <span :class="`status status--${selectedAnalysis.approval.status}`">
              {{ selectedAnalysis.approval.status === 'approved' ? '已批准' : '待审核' }}
            </span>
          </header>
          <pre>{{ JSON.stringify(selectedAnalysis.analysis, null, 2) }}</pre>
          <dl>
            <div><dt>分析人</dt><dd>{{ selectedAnalysis.analyzed_by }}</dd></div>
            <div><dt>批准人</dt><dd>{{ approvedBy(selectedAnalysis) }}</dd></div>
          </dl>

          <div v-if="selectedAnalysis.approval.status === 'pending'" class="approval-box">
            <template v-if="canApprove">
              <label>
                人工审核人
                <input v-model.trim="approvedByInput" name="analysis_approved_by" maxlength="120">
              </label>
              <label>
                批准时间（ISO 8601）
                <input v-model.trim="approvedAt" name="analysis_approved_at">
              </label>
              <label class="approval-box__confirmation">
                <input v-model="reviewConfirmed" name="analysis_review_confirmation" type="checkbox">
                <span>我已人工阅读并审核这份结构化分析，确认其可进入 benchmark 组合。</span>
              </label>
              <button
                type="button"
                :disabled="!canSubmitApproval"
                data-testid="approve-reference-analysis"
                @click="approveSelected"
              >
                {{ approving ? '正在批准…' : '批准 Analysis' }}
              </button>
            </template>
            <p v-else>
              当前角色没有 <code>material:sign</code> 权限；请交由文化事实评审或管理员审核。
            </p>
          </div>
        </template>

        <template v-else>
          <p class="analysis-workbench__kicker">New pending analysis</p>
          <h3>提交{{ analysisType === 'film' ? '影视' : '文本' }}结构化分析</h3>
          <p class="analysis-workbench__helper">
            本编辑器只接收结构化观察，不接收原始视频、小说或剧本正文。新记录固定为 pending。
          </p>
          <label>
            分析人
            <input v-model.trim="analyzedBy" name="analysis_analyzed_by" maxlength="120">
          </label>
          <label>
            analysis JSON
            <textarea v-model="analysisJson" name="analysis_json" rows="22" spellcheck="false" />
          </label>
          <button
            type="button"
            :disabled="creating || !analyzedBy"
            data-testid="create-reference-analysis"
            @click="createPendingAnalysis"
          >
            {{ creating ? '正在提交…' : '提交 Pending Analysis' }}
          </button>
        </template>

        <p v-if="error" class="analysis-workbench__notice analysis-workbench__notice--error" role="alert">
          {{ error }}
        </p>
        <p v-if="notice" class="analysis-workbench__notice" role="status">{{ notice }}</p>
      </article>
    </div>

    <button
      v-if="selectedAnalysis"
      type="button"
      class="analysis-workbench__new"
      @click="selectedAnalysisId = ''"
    >
      + 提交新的 pending analysis
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  FilmReferenceAnalysis,
  ReferenceAnalysisRecord,
  ReferenceSourceRecord,
  TextReferenceAnalysis,
} from '@shared/types'
import {
  approveReferenceAnalysis,
  createFilmReferenceAnalysis,
  createTextReferenceAnalysis,
} from '@/api/reference-library'

const props = defineProps<{
  source: ReferenceSourceRecord
  analyses: ReferenceAnalysisRecord[]
  canApprove: boolean
  actorId: string
}>()
const emit = defineEmits<{
  changed: []
}>()

const FILM_MEDIA = new Set(['film', 'episode', 'promo', 'tutorial'])
const selectedAnalysisId = ref('')
const analyzedBy = ref(props.actorId)
const analysisJson = ref('')
const approvedByInput = ref(props.actorId)
const approvedAt = ref(new Date().toISOString())
const reviewConfirmed = ref(false)
const creating = ref(false)
const approving = ref(false)
const error = ref('')
const notice = ref('')

const analysisType = computed<'film' | 'text'>(() => (
  FILM_MEDIA.has(props.source.media_type) ? 'film' : 'text'
))
const approvedCount = computed(() => (
  props.analyses.filter(item => item.approval.status === 'approved').length
))
const selectedAnalysis = computed(() => (
  props.analyses.find(item => item.analysis_id === selectedAnalysisId.value) ?? null
))
const canSubmitApproval = computed(() => Boolean(
  props.canApprove
  && selectedAnalysis.value?.approval.status === 'pending'
  && approvedByInput.value
  && !Number.isNaN(Date.parse(approvedAt.value))
  && reviewConfirmed.value
  && !approving.value,
))

function filmTemplate(): FilmReferenceAnalysis {
  return {
    hook_timecode: '00:00:08',
    central_question: '请填写中心问题',
    sequence_beats: [{
      start: '00:00:00',
      end: '00:00:20',
      function: '请填写这一段的叙事功能',
    }],
    shot_observations: [{
      timecode: '00:00:08',
      framing: '请填写景别',
      evidence_note: '请填写可核对的镜头观察',
    }],
    continuity_methods: ['请填写连续性方法'],
    reusable_principles: ['请填写抽象、可复用的原则'],
    avoid_copying: ['请填写不得复刻的独特表达'],
  }
}

function textTemplate(): TextReferenceAnalysis {
  return {
    source_units: [{ source_unit_id: 'unit-01', summary: '请填写来源单元摘要' }],
    character_wants: ['请填写角色欲望'],
    scene_patterns: [{
      objective: '请填写场景目标',
      opposition: '请填写阻力',
      turn: '请填写转折',
      visible_action: '请填写可见动作',
    }],
    must_keep: ['请填写必须保留的叙事功能'],
    compression_options: ['请填写压缩方案'],
    adaptation_risks: ['请填写改编风险'],
    reusable_principles: ['请填写抽象、可复用的原则'],
    avoid_copying: ['请填写不得复刻的独特表达'],
  }
}

function resetEditor(): void {
  analyzedBy.value = props.actorId
  analysisJson.value = JSON.stringify(
    analysisType.value === 'film' ? filmTemplate() : textTemplate(),
    null,
    2,
  )
  approvedByInput.value = props.actorId
  approvedAt.value = new Date().toISOString()
  reviewConfirmed.value = false
  error.value = ''
  notice.value = ''
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

function approvedBy(analysis: ReferenceAnalysisRecord): string {
  return analysis.approval.status === 'approved'
    ? `${analysis.approval.approved_by} · ${formatTime(analysis.approval.approved_at)}`
    : '尚未批准'
}

async function createPendingAnalysis(): Promise<void> {
  if (!analyzedBy.value) return
  error.value = ''
  notice.value = ''
  let parsed: unknown
  try {
    parsed = JSON.parse(analysisJson.value)
  } catch {
    error.value = 'analysis JSON 无法解析'
    return
  }
  creating.value = true
  const response = analysisType.value === 'film'
    ? await createFilmReferenceAnalysis(props.source.reference_id, {
        analyzed_by: analyzedBy.value,
        analysis: parsed as FilmReferenceAnalysis,
      })
    : await createTextReferenceAnalysis(props.source.reference_id, {
        analyzed_by: analyzedBy.value,
        analysis: parsed as TextReferenceAnalysis,
      })
  creating.value = false
  if (!response.ok || !response.data) {
    error.value = response.error?.message ?? '提交结构化分析失败'
    return
  }
  notice.value = `已创建 pending analysis ${response.data.analysis_id}。`
  selectedAnalysisId.value = response.data.analysis_id
  emit('changed')
}

async function approveSelected(): Promise<void> {
  const analysis = selectedAnalysis.value
  if (!analysis || !canSubmitApproval.value) return
  error.value = ''
  notice.value = ''
  approving.value = true
  const response = await approveReferenceAnalysis(analysis.analysis_id, {
    approved_by: approvedByInput.value,
    approved_at: new Date(approvedAt.value).toISOString(),
    confirmation: 'human_reviewed_reference_analysis',
  })
  approving.value = false
  if (!response.ok || !response.data) {
    error.value = response.error?.message ?? '批准分析失败'
    return
  }
  notice.value = response.data.idempotent_replay
    ? `审核动作已幂等重放：${analysis.analysis_id}`
    : `分析已由 ${response.data.analysis.approval.status === 'approved'
        ? response.data.analysis.approval.approved_by
        : approvedByInput.value} 批准。`
  reviewConfirmed.value = false
  emit('changed')
}

watch(
  () => [props.source.reference_id, props.actorId, analysisType.value],
  () => {
    selectedAnalysisId.value = ''
    resetEditor()
  },
  { immediate: true },
)

watch(
  () => props.analyses,
  analyses => {
    if (
      selectedAnalysisId.value
      && !analyses.some(item => item.analysis_id === selectedAnalysisId.value)
    ) {
      selectedAnalysisId.value = ''
    }
  },
)
</script>

<style scoped>
.analysis-workbench {
  padding: 20px;
  border: 1px solid #35332e;
  border-radius: 16px;
  background: #1c1c19;
  color: #e7e2d7;
}

.analysis-workbench__heading,
.analysis-workbench__selected {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.analysis-workbench__heading p,
.analysis-workbench__selected p,
.analysis-workbench__kicker {
  margin: 0 0 7px;
  color: #d7a75d;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.analysis-workbench h2,
.analysis-workbench h3 {
  margin: 0;
}

.analysis-workbench__heading > span {
  color: #847f76;
  font: 11px/1.5 ui-monospace, monospace;
}

.analysis-workbench__boundary {
  margin: 14px 0;
  padding: 11px 13px;
  border-left: 3px solid #d7a75d;
  background: rgba(215, 167, 93, 0.08);
  color: #b9b1a5;
  font-size: 12px;
  line-height: 1.6;
}

.analysis-workbench__layout {
  display: grid;
  grid-template-columns: 245px minmax(0, 1fr);
  gap: 12px;
}

.analysis-workbench__list {
  max-height: 680px;
  overflow: auto;
}

.analysis-workbench__list button {
  display: grid;
  width: 100%;
  gap: 6px;
  margin-bottom: 9px;
  padding: 12px;
  border: 1px solid #38362f;
  border-radius: 10px;
  background: #23221e;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.analysis-workbench__list button.active,
.analysis-workbench__list button:hover {
  border-color: #b88545;
}

.analysis-workbench__list small {
  overflow-wrap: anywhere;
  color: #858076;
  font-size: 10px;
}

.status {
  justify-self: start;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
}

.status--approved {
  background: rgba(57, 150, 102, 0.17);
  color: #83d4a8;
}

.status--pending {
  background: rgba(204, 166, 79, 0.16);
  color: #e3c073;
}

.analysis-workbench__editor {
  min-width: 0;
  padding: 16px;
  border: 1px solid #38362f;
  border-radius: 12px;
  background: #23221e;
}

.analysis-workbench__editor label {
  display: block;
  margin: 12px 0;
  color: #aaa397;
  font-size: 12px;
}

.analysis-workbench__editor input:not([type='checkbox']),
.analysis-workbench__editor textarea {
  box-sizing: border-box;
  width: 100%;
  margin-top: 6px;
  padding: 10px 12px;
  border: 1px solid #444137;
  border-radius: 9px;
  background: #161614;
  color: #e7e2d7;
}

.analysis-workbench__editor textarea,
.analysis-workbench__editor pre {
  font: 11px/1.55 ui-monospace, monospace;
}

.analysis-workbench__editor pre {
  max-height: 420px;
  overflow: auto;
  padding: 12px;
  border-radius: 9px;
  background: #161614;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.analysis-workbench__editor button,
.analysis-workbench__new {
  padding: 10px 15px;
  border: 0;
  border-radius: 9px;
  background: #d6a85e;
  color: #191713;
  font-weight: 800;
  cursor: pointer;
}

.analysis-workbench__editor button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.analysis-workbench__helper,
.approval-box p,
.analysis-workbench__empty {
  color: #918a80;
  font-size: 12px;
  line-height: 1.6;
}

.analysis-workbench dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border-radius: 9px;
  background: #3a3730;
}

.analysis-workbench dl div {
  padding: 10px;
  background: #1c1c19;
}

.analysis-workbench dt {
  color: #858076;
  font-size: 10px;
}

.analysis-workbench dd {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
  font-size: 12px;
}

.approval-box {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #3b3933;
}

.approval-box__confirmation {
  display: flex !important;
  align-items: flex-start;
  gap: 8px;
}

.analysis-workbench__notice {
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(73, 160, 106, 0.55);
  border-radius: 9px;
  color: #8bd9ac;
}

.analysis-workbench__notice--error {
  border-color: rgba(211, 78, 62, 0.55);
  color: #ff9d8e;
}

.analysis-workbench__new {
  margin-top: 12px;
  border: 1px solid #4a443a;
  background: transparent;
  color: #d7a75d;
}

@media (max-width: 800px) {
  .analysis-workbench__layout {
    grid-template-columns: 1fr;
  }
}
</style>
