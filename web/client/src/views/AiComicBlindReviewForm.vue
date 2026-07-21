<template>
  <div class="blind-review-form" data-testid="blind-review-response-form">
    <header class="blind-review-form__hero">
      <div>
        <span class="blind-review-form__eyebrow">匿名真人评审</span>
        <h1>填写七维评审回执</h1>
        <p>本页只处理匿名候选编号、回执校验值和评审内容，不显示项目名称、来源或机器评分。</p>
      </div>
      <button class="blind-review-form__back" type="button" @click="returnToPreviousPage">返回上一页</button>
    </header>

    <section class="blind-review-form__notice" aria-label="使用边界">
      <strong>请由真实评审人独立填写</strong>
      <p>下载回执不等于已计入真人评审。完成后请把 JSON 交回项目操作者，由对方在项目页复核并保存。</p>
    </section>

    <section v-if="!draft" class="blind-review-form__empty">
      <div>
        <span>第 1 步</span>
        <h2>载入空白回执 JSON</h2>
        <p>如果项目操作者已在同一浏览器打开本页，模板会自动带入；否则请手动选择收到的评审回执 JSON。</p>
      </div>
      <button class="blind-review-form__primary" type="button" @click="templateInput?.click()">
        选择空白回执 JSON
      </button>
      <input
        ref="templateInput"
        class="blind-review-form__file-input"
        type="file"
        accept="application/json,.json"
        @change="handleTemplateFile"
      >
      <p v-if="loadError" class="blind-review-form__error" role="alert">{{ loadError }}</p>
    </section>

    <form v-else class="blind-review-form__form" @submit.prevent="downloadCompletedResponse">
      <section class="blind-review-form__candidate" aria-label="匿名候选信息">
        <div>
          <span>匿名候选</span>
          <strong>{{ draft.candidate_label }}</strong>
        </div>
        <div>
          <span>评审包 SHA-256</span>
          <code>{{ draft.reviewer_packet_sha256 }}</code>
        </div>
        <button class="blind-review-form__text-button" type="button" @click="templateInput?.click()">
          更换回执 JSON
        </button>
        <input
          ref="templateInput"
          class="blind-review-form__file-input"
          type="file"
          accept="application/json,.json"
          @change="handleTemplateFile"
        >
      </section>

      <section class="blind-review-form__section">
        <div class="blind-review-form__section-head">
          <span>第 1 步</span>
          <div>
            <h2>填写评审人标识</h2>
            <p>可使用姓名、工号或约定代号；不能为空，最多 120 个字符。</p>
          </div>
        </div>
        <label class="blind-review-form__field">
          <span>Reviewer ID</span>
          <input
            v-model="draft.reviewer_id"
            maxlength="120"
            autocomplete="off"
            placeholder="例如：reviewer-01"
          >
        </label>
      </section>

      <section class="blind-review-form__section">
        <div class="blind-review-form__section-head">
          <span>第 2 步</span>
          <div>
            <h2>完成七维评分</h2>
            <p>每项选择 1–5 分；低于 4 分时必须写出可定位、可执行的修改意见。</p>
          </div>
        </div>
        <div class="blind-review-form__score-list">
          <article v-for="score in draft.scores" :key="score.dimension" class="blind-review-form__score-card">
            <div class="blind-review-form__score-row">
              <label>
                <span>{{ score.label }}评分</span>
                <select v-model="score.score" :aria-label="`${score.label}评分`">
                  <option :value="null">请选择</option>
                  <option v-for="value in SCORE_OPTIONS" :key="value" :value="value">{{ value }} 分</option>
                </select>
              </label>
              <span v-if="score.score !== null" class="blind-review-form__score-hint">
                {{ score.score < 4 ? '需要填写修改意见' : '可选填补充意见' }}
              </span>
            </div>
            <label>
              <span>{{ score.label }}意见<span v-if="score.score !== null && score.score < 4">（必填）</span></span>
              <textarea
                v-model="score.note"
                :aria-label="`${score.label}意见`"
                maxlength="1000"
                rows="3"
                :placeholder="score.score !== null && score.score < 4 ? '请说明具体问题、位置和修改建议' : '可选填'"
              />
            </label>
          </article>
        </div>
      </section>

      <section class="blind-review-form__section">
        <div class="blind-review-form__section-head">
          <span>第 3 步</span>
          <div>
            <h2>如实确认评审声明</h2>
            <p>三项均由当前评审人确认后，才能下载完成版回执。</p>
          </div>
        </div>
        <div class="blind-review-form__attestations">
          <label>
            <input v-model="draft.attestations.human_reviewer" type="checkbox">
            <span>我是实际阅读匿名材料并作出评分的真人评审人。</span>
          </label>
          <label>
            <input v-model="draft.attestations.origin_and_machine_scores_hidden" type="checkbox">
            <span>评审时未获知候选来源、项目身份和机器评分。</span>
          </label>
          <label>
            <input v-model="draft.attestations.independent_review" type="checkbox">
            <span>本次评分由我独立完成，没有照抄或代填。</span>
          </label>
        </div>
      </section>

      <section class="blind-review-form__download">
        <div>
          <strong>下载前检查</strong>
          <p>{{ completionMessage }}</p>
          <p v-if="downloadMessage" class="blind-review-form__success" role="status">{{ downloadMessage }}</p>
        </div>
        <button class="blind-review-form__primary" type="submit" :disabled="!canDownload">
          下载填写完成的回执 JSON
        </button>
      </section>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type {
  AiComicHumanReviewDimension,
  AiComicSeriesBlindReviewResponseFile,
} from '@shared/types'

const BLIND_REVIEW_TEMPLATE_STORAGE_KEY = 'story-agent-commercial-blind-review-template/v1'
const SCORE_OPTIONS = [1, 2, 3, 4, 5] as const
const HUMAN_REVIEW_DIMENSIONS: ReadonlyArray<{ key: AiComicHumanReviewDimension; label: string }> = [
  { key: 'hook', label: '钩子' },
  { key: 'character', label: '人物' },
  { key: 'dialogue', label: '对白' },
  { key: 'progression', label: '推进' },
  { key: 'turn', label: '反转' },
  { key: 'ending', label: '结尾' },
  { key: 'cultural_credibility', label: '文化可信度' },
]

const templateInput = ref<HTMLInputElement | null>(null)
const router = useRouter()
const draft = ref<AiComicSeriesBlindReviewResponseFile | null>(null)
const loadError = ref('')
const downloadMessage = ref('')

const incompleteScoreLabels = computed(() => (
  draft.value?.scores.filter(item => !isValidScore(item.score)).map(item => item.label) ?? []
))
const missingLowScoreNoteLabels = computed(() => (
  draft.value?.scores
    .filter(item => isValidScore(item.score) && item.score < 4 && !item.note.trim())
    .map(item => item.label) ?? []
))
const allAttestationsConfirmed = computed(() => Boolean(
  draft.value?.attestations.human_reviewer
  && draft.value.attestations.origin_and_machine_scores_hidden
  && draft.value.attestations.independent_review,
))
const canDownload = computed(() => Boolean(
  draft.value
  && draft.value.reviewer_id.trim().length >= 1
  && draft.value.reviewer_id.trim().length <= 120
  && incompleteScoreLabels.value.length === 0
  && missingLowScoreNoteLabels.value.length === 0
  && allAttestationsConfirmed.value,
))
const completionMessage = computed(() => {
  if (!draft.value?.reviewer_id.trim()) return '请先填写 Reviewer ID。'
  if (incompleteScoreLabels.value.length) return `待评分：${incompleteScoreLabels.value.join('、')}`
  if (missingLowScoreNoteLabels.value.length) return `待补充低分意见：${missingLowScoreNoteLabels.value.join('、')}`
  if (!allAttestationsConfirmed.value) return '请确认全部三项真人盲评声明。'
  return '已满足下载条件。请下载 JSON 并交回项目操作者。'
})

onMounted(() => {
  const storedTemplate = sessionStorage.getItem(BLIND_REVIEW_TEMPLATE_STORAGE_KEY)
  if (!storedTemplate) return
  try {
    loadTemplate(JSON.parse(storedTemplate))
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '浏览器中暂存的回执模板无效'
  }
})

async function handleTemplateFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  loadError.value = ''
  downloadMessage.value = ''
  try {
    if (file.size > 128 * 1024) {
      throw new Error('评审回执 JSON 不能超过 128 KB')
    }
    loadTemplate(JSON.parse(await file.text()))
  } catch (error) {
    draft.value = null
    loadError.value = error instanceof Error ? error.message : '评审回执 JSON 解析失败'
  } finally {
    input.value = ''
  }
}

function loadTemplate(value: unknown) {
  draft.value = parseTemplate(value)
  loadError.value = ''
  downloadMessage.value = ''
}

function parseTemplate(value: unknown): AiComicSeriesBlindReviewResponseFile {
  if (!isRecord(value) || value.schema_version !== 'ai-comic-series-blind-review-response/v1') {
    throw new Error('这不是 Story Agent 匿名评审回执 JSON')
  }
  const candidateLabel = typeof value.candidate_label === 'string' ? value.candidate_label.trim() : ''
  const reviewerPacketSha256 = typeof value.reviewer_packet_sha256 === 'string'
    ? value.reviewer_packet_sha256.trim()
    : ''
  const reviewerId = typeof value.reviewer_id === 'string' ? value.reviewer_id.trim() : ''
  if (!/^候选-[A-Z0-9]{8}$/.test(candidateLabel)) {
    throw new Error('匿名候选编号格式无效')
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(reviewerPacketSha256)) {
    throw new Error('评审包 SHA-256 格式无效')
  }
  if (reviewerId.length > 120) {
    throw new Error('Reviewer ID 不能超过 120 个字符')
  }
  if (value.blind !== true) {
    throw new Error('回执必须保留 blind=true')
  }
  if (!Array.isArray(value.scores) || value.scores.length !== HUMAN_REVIEW_DIMENSIONS.length) {
    throw new Error('回执必须包含完整七维评分')
  }
  const rawScores = new Map<AiComicHumanReviewDimension, Record<string, unknown>>()
  for (const item of value.scores) {
    if (!isRecord(item) || typeof item.dimension !== 'string') {
      throw new Error('回执包含无效评分维度')
    }
    const dimension = item.dimension as AiComicHumanReviewDimension
    if (!HUMAN_REVIEW_DIMENSIONS.some(row => row.key === dimension) || rawScores.has(dimension)) {
      throw new Error('回执包含未知或重复评分维度')
    }
    if (item.score !== null && !isValidScore(item.score)) {
      throw new Error(`维度 ${dimension} 只能填写 1–5 的整数分`)
    }
    if (typeof item.note !== 'string' || item.note.length > 1000) {
      throw new Error(`维度 ${dimension} 的意见格式无效或超过 1000 字符`)
    }
    rawScores.set(dimension, item)
  }
  if (rawScores.size !== HUMAN_REVIEW_DIMENSIONS.length) {
    throw new Error('回执缺少评分维度')
  }
  const attestations = isRecord(value.attestations) ? value.attestations : {}
  return {
    schema_version: 'ai-comic-series-blind-review-response/v1',
    candidate_label: candidateLabel,
    reviewer_packet_sha256: reviewerPacketSha256,
    reviewer_id: reviewerId,
    blind: true,
    instructions: Array.isArray(value.instructions)
      ? value.instructions.filter((item): item is string => typeof item === 'string')
      : [],
    scores: HUMAN_REVIEW_DIMENSIONS.map(({ key, label }) => {
      const item = rawScores.get(key)
      return {
        dimension: key,
        label,
        score: (item?.score ?? null) as null | 1 | 2 | 3 | 4 | 5,
        note: typeof item?.note === 'string' ? item.note : '',
      }
    }),
    attestations: {
      human_reviewer: attestations.human_reviewer === true,
      origin_and_machine_scores_hidden: attestations.origin_and_machine_scores_hidden === true,
      independent_review: attestations.independent_review === true,
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidScore(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
}

function downloadCompletedResponse() {
  if (!draft.value || !canDownload.value) return
  const completedResponse: AiComicSeriesBlindReviewResponseFile = {
    ...draft.value,
    reviewer_id: draft.value.reviewer_id.trim(),
    scores: draft.value.scores.map(item => ({
      ...item,
      score: item.score as 1 | 2 | 3 | 4 | 5,
      note: item.note.trim(),
    })),
  }
  const blob = new Blob([`${JSON.stringify(completedResponse, null, 2)}\n`], {
    type: 'application/json;charset=utf-8',
  })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = `${completedResponse.candidate_label}-评审回执.json`
  link.click()
  URL.revokeObjectURL(objectUrl)
  downloadMessage.value = '完成版回执已下载。请把 JSON 交回项目操作者，不要把它当作已自动提交。'
}

function returnToPreviousPage() {
  if (window.history.length > 1) {
    router.back()
    return
  }
  void router.push('/ai-comic-series/new')
}
</script>

<style scoped>
.blind-review-form {
  width: min(1120px, calc(100% - 32px));
  margin: 28px auto 64px;
  color: #263b47;
}

.blind-review-form__hero,
.blind-review-form__candidate,
.blind-review-form__download {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.blind-review-form__hero h1 {
  margin: 6px 0 8px;
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.15;
}

.blind-review-form__hero p,
.blind-review-form__notice p,
.blind-review-form__section-head p,
.blind-review-form__empty p,
.blind-review-form__download p {
  margin: 0;
  color: #637b88;
  line-height: 1.65;
}

.blind-review-form__eyebrow {
  color: #19766d;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.blind-review-form__back,
.blind-review-form__text-button {
  flex: 0 0 auto;
  border: 0;
  color: #176f68;
  background: transparent;
  font: inherit;
  font-weight: 750;
  text-decoration: none;
  cursor: pointer;
}

.blind-review-form__notice {
  margin: 24px 0;
  padding: 18px 20px;
  border: 1px solid #efbd5f;
  border-radius: 14px;
  background: #fff8e9;
  color: #7c4b00;
}

.blind-review-form__notice p {
  margin-top: 5px;
  color: #795720;
}

.blind-review-form__empty,
.blind-review-form__section,
.blind-review-form__candidate,
.blind-review-form__download {
  border: 1px solid #cfdee4;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(31, 68, 83, 0.07);
}

.blind-review-form__empty,
.blind-review-form__section {
  padding: 24px;
}

.blind-review-form__empty h2,
.blind-review-form__section h2 {
  margin: 5px 0;
}

.blind-review-form__candidate {
  margin-bottom: 18px;
  padding: 18px 22px;
}

.blind-review-form__candidate > div {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.blind-review-form__candidate span,
.blind-review-form__field > span,
.blind-review-form__score-card label > span {
  color: #647b87;
  font-size: 13px;
  font-weight: 750;
}

.blind-review-form__candidate code {
  overflow-wrap: anywhere;
  color: #355563;
  font-size: 12px;
}

.blind-review-form__section + .blind-review-form__section {
  margin-top: 18px;
}

.blind-review-form__section-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 20px;
}

.blind-review-form__section-head > span,
.blind-review-form__empty > div > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 62px;
  height: 30px;
  border-radius: 999px;
  color: #176f68;
  background: #e3f2f0;
  font-size: 13px;
  font-weight: 800;
}

.blind-review-form__field,
.blind-review-form__score-card label {
  display: grid;
  gap: 8px;
}

.blind-review-form input[type='text'],
.blind-review-form input:not([type]),
.blind-review-form select,
.blind-review-form textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #b9cbd3;
  border-radius: 10px;
  padding: 11px 12px;
  color: #263b47;
  background: #fff;
  font: inherit;
}

.blind-review-form input:focus,
.blind-review-form select:focus,
.blind-review-form textarea:focus {
  border-color: #278e84;
  outline: 3px solid rgba(39, 142, 132, 0.14);
}

.blind-review-form__score-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.blind-review-form__score-card {
  padding: 16px;
  border: 1px solid #dce7eb;
  border-radius: 13px;
  background: #f9fbfc;
}

.blind-review-form__score-row {
  display: grid;
  grid-template-columns: minmax(140px, 210px) 1fr;
  align-items: end;
  gap: 14px;
  margin-bottom: 14px;
}

.blind-review-form__score-hint {
  padding-bottom: 11px;
  color: #8b5b10;
  font-size: 12px;
}

.blind-review-form__attestations {
  display: grid;
  gap: 12px;
}

.blind-review-form__attestations label {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 13px 15px;
  border: 1px solid #d9e4e8;
  border-radius: 11px;
  background: #f9fbfc;
  line-height: 1.5;
}

.blind-review-form__attestations input {
  width: 18px;
  height: 18px;
  margin-top: 2px;
}

.blind-review-form__download {
  margin-top: 18px;
  padding: 20px 24px;
  border-color: #75bdb6;
}

.blind-review-form__primary {
  flex: 0 0 auto;
  border: 0;
  border-radius: 10px;
  padding: 12px 18px;
  color: #fff;
  background: #19766d;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.blind-review-form__primary:disabled {
  color: #82939b;
  background: #dce4e7;
  cursor: not-allowed;
}

.blind-review-form__file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.blind-review-form__error {
  margin-top: 14px;
  color: #bd332b;
}

.blind-review-form__success {
  margin-top: 5px !important;
  color: #19766d !important;
  font-weight: 750;
}

@media (max-width: 760px) {
  .blind-review-form__hero,
  .blind-review-form__candidate,
  .blind-review-form__download,
  .blind-review-form__score-row {
    align-items: stretch;
    flex-direction: column;
    grid-template-columns: 1fr;
  }

  .blind-review-form__score-list {
    grid-template-columns: 1fr;
  }

  .blind-review-form__primary {
    width: 100%;
  }
}
</style>
