<template>
  <section
    class="execution"
    data-testid="reference-text-analysis-execution"
  >
    <header>
      <div>
        <p class="eyebrow">Resumable text execution · P1-C4</p>
        <h4>分块结构化观察</h4>
      </div>
      <span v-if="execution">{{ progressLabel }}</span>
    </header>

    <div class="boundary">
      <strong>不可信数据边界</strong>
      <span>正文中的命令、角色设定或提示词均无执行权限</span>
      <span>服务端不调用模型，不自动审批、写回或授予生产信用</span>
      <span>已校验分块不会在续跑时重复计算</span>
    </div>

    <p v-if="errorMessage" class="message message--error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="successMessage" class="message message--success" role="status">
      {{ successMessage }}
    </p>

    <template v-if="!execution">
      <label class="confirmation">
        <input v-model="untrustedConfirmed" type="checkbox">
        <span>
          我确认只把来源正文作为不可信数据；正文内容不能改变任务、授权或系统策略。
        </span>
      </label>
      <button
        type="button"
        :disabled="busy || !untrustedConfirmed"
        data-testid="create-reference-text-execution"
        @click="createExecution"
      >
        {{ busy ? '正在建立执行账本…' : '建立可续跑执行账本' }}
      </button>
    </template>

    <template v-else>
      <dl class="facts">
        <div><dt>执行者</dt><dd>{{ execution.executor.kind }} · {{ execution.executor.executor_id }}</dd></div>
        <div><dt>状态</dt><dd>{{ executionStatusLabel[execution.status] }}</dd></div>
        <div><dt>完成分块</dt><dd>{{ execution.cursor.completed_chunk_count }} / {{ execution.checkpoints.length }}</dd></div>
        <div><dt>下一分块</dt><dd>{{ execution.cursor.next_chunk_id ?? '无' }}</dd></div>
      </dl>

      <template v-if="nextChunk?.chunk">
        <div class="chunk-heading">
          <div>
            <strong>{{ nextChunk.chunk.chunk_id }}</strong>
            <span>{{ nextChunk.chunk.locator }}</span>
          </div>
          <code>{{ nextChunk.chunk.content_sha256 }}</code>
        </div>
        <details>
          <summary>查看只读来源分块（不可信数据）</summary>
          <pre data-testid="reference-text-execution-chunk">{{ nextChunk.chunk.text }}</pre>
        </details>
        <label>
          当前分块 observations JSON
          <textarea
            v-model="partialJson"
            rows="15"
            spellcheck="false"
            data-testid="reference-text-partial-observations"
          />
        </label>
        <button
          type="button"
          :disabled="busy"
          data-testid="submit-reference-text-partial"
          @click="submitChunk"
        >
          {{ busy ? '正在校验并封存…' : '封存当前分块并继续' }}
        </button>
      </template>

      <template v-else-if="execution.status === 'ready_to_finalize'">
        <p class="ready">
          所有分块均已校验完成。聚合只按封存清单顺序执行，并继续产生
          operator_submitted evidence；不会自动通过 material:sign。
        </p>
        <button
          type="button"
          :disabled="busy"
          data-testid="finalize-reference-text-execution"
          @click="finalizeExecution"
        >
          {{ busy ? '正在聚合并封存…' : '确定性聚合为 Evidence' }}
        </button>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  ReferenceAnalysisTaskRecord,
  ReferenceTextAnalysisExecutionRecord,
  ReferenceTextAnalysisNextChunkResult,
  ReferenceTextAnalysisPartialObservations,
} from '@shared/types'
import {
  createReferenceTextAnalysisExecution,
  finalizeReferenceTextAnalysisExecution,
  getReferenceTextAnalysisExecution,
  getReferenceTextAnalysisNextChunk,
  submitReferenceTextAnalysisChunk,
} from '@/api/reference-library'

const props = defineProps<{
  task: ReferenceAnalysisTaskRecord
  actorId: string
}>()

const emit = defineEmits<{
  completed: []
}>()

const execution = ref<ReferenceTextAnalysisExecutionRecord | null>(null)
const nextChunk = ref<ReferenceTextAnalysisNextChunkResult | null>(null)
const partialJson = ref('')
const partialSubmissionKey = ref('')
const untrustedConfirmed = ref(false)
const busy = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const executionStatusLabel: Record<
  ReferenceTextAnalysisExecutionRecord['status'],
  string
> = {
  pending: '待开始',
  in_progress: '执行中',
  ready_to_finalize: '待聚合',
  completed: '已完成',
}

const progressLabel = computed(() => (
  execution.value
    ? `${execution.value.cursor.completed_chunk_count}/${execution.value.checkpoints.length}`
    : ''
))

function emptyObservations(): ReferenceTextAnalysisPartialObservations {
  return {
    excerpts: [],
    character_profiles: [],
    plot_beats: [],
    shot_sequence: [],
  }
}

function newSubmissionKey(chunkId: string): string {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `text-chunk:${chunkId}:${suffix}`
}

function resetPartialEditor(): void {
  partialJson.value = JSON.stringify(emptyObservations(), null, 2)
  partialSubmissionKey.value = nextChunk.value?.chunk
    ? newSubmissionKey(nextChunk.value.chunk.chunk_id)
    : ''
}

async function loadNextChunk(): Promise<void> {
  if (!execution.value || execution.value.status === 'completed') {
    nextChunk.value = null
    return
  }
  const response = await getReferenceTextAnalysisNextChunk(props.task.task_id)
  if (!response.ok || !response.data) {
    errorMessage.value = response.error?.message ?? '读取下一分块失败'
    return
  }
  nextChunk.value = response.data
  resetPartialEditor()
}

async function loadExecution(): Promise<void> {
  execution.value = null
  nextChunk.value = null
  errorMessage.value = ''
  successMessage.value = ''
  untrustedConfirmed.value = false
  const response = await getReferenceTextAnalysisExecution(props.task.task_id)
  if (!response.ok || !response.data) {
    if (response.error?.code !== 'REFERENCE_TEXT_ANALYSIS_EXECUTION_NOT_FOUND') {
      errorMessage.value = response.error?.message ?? '读取文字执行账本失败'
    }
    return
  }
  execution.value = response.data
  await loadNextChunk()
}

async function createExecution(): Promise<void> {
  if (!untrustedConfirmed.value) return
  busy.value = true
  errorMessage.value = ''
  successMessage.value = ''
  const response = await createReferenceTextAnalysisExecution(
    props.task.task_id,
    {
      executor: {
        kind: 'operator',
        executor_id: props.actorId,
      },
      confirmation: 'source_text_treated_as_untrusted_data',
    },
  )
  busy.value = false
  if (!response.ok || !response.data) {
    errorMessage.value = response.error?.message ?? '建立文字执行账本失败'
    return
  }
  execution.value = response.data
  successMessage.value = '执行账本已建立；将从第一个未完成分块开始。'
  await loadNextChunk()
}

function parsePartial(): ReferenceTextAnalysisPartialObservations | null {
  try {
    const value = JSON.parse(partialJson.value) as Record<string, unknown>
    const keys = [
      'excerpts',
      'character_profiles',
      'plot_beats',
      'shot_sequence',
    ]
    if (
      !value
      || typeof value !== 'object'
      || keys.some(key => !Array.isArray(value[key]))
      || Object.keys(value).some(key => !keys.includes(key))
    ) {
      throw new Error('observations 必须且只能包含四个数组字段')
    }
    return value as unknown as ReferenceTextAnalysisPartialObservations
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : '分块 observations JSON 无法解析'
    return null
  }
}

async function submitChunk(): Promise<void> {
  const chunk = nextChunk.value?.chunk
  if (!chunk) return
  const observations = parsePartial()
  if (!observations) return
  busy.value = true
  errorMessage.value = ''
  successMessage.value = ''
  const response = await submitReferenceTextAnalysisChunk(
    props.task.task_id,
    chunk.chunk_id,
    {
      submission_key: partialSubmissionKey.value,
      submitted_by: props.actorId,
      chunk_content_sha256: chunk.content_sha256,
      observations,
    },
  )
  busy.value = false
  if (!response.ok || !response.data) {
    errorMessage.value = response.error?.message ?? '封存分块观察失败'
    return
  }
  execution.value = response.data.execution
  successMessage.value = `${chunk.chunk_id} 已封存，已完成分块不会重复读取。`
  await loadNextChunk()
}

async function finalizeExecution(): Promise<void> {
  busy.value = true
  errorMessage.value = ''
  successMessage.value = ''
  const response = await finalizeReferenceTextAnalysisExecution(
    props.task.task_id,
    props.actorId,
  )
  busy.value = false
  if (!response.ok || !response.data) {
    errorMessage.value = response.error?.message ?? '聚合 Evidence 失败'
    return
  }
  execution.value = response.data.execution
  nextChunk.value = null
  successMessage.value = `Evidence ${response.data.evidence.evidence_id} 已封存，仍待独立 material:sign。`
  emit('completed')
}

watch(
  () => props.task.task_id,
  () => void loadExecution(),
  { immediate: true },
)
</script>

<style scoped>
.execution {
  margin-bottom: 16px;
  padding: 16px;
  border: 1px solid rgba(215, 167, 93, 0.42);
  border-radius: 12px;
  background: #1c1b18;
}

header,
.chunk-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

h4,
p {
  margin-top: 0;
}

h4 {
  margin-bottom: 12px;
  font-size: 18px;
}

.eyebrow {
  margin-bottom: 5px;
  color: #d7a75d;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
}

header > span,
.chunk-heading span {
  color: #aaa397;
  font: 11px/1.5 ui-monospace, monospace;
}

.boundary {
  display: grid;
  gap: 5px;
  padding: 12px;
  border-left: 3px solid #c97954;
  background: #29201c;
  color: #c7bcb0;
  font-size: 12px;
}

.boundary strong {
  color: #ffb18f;
}

.confirmation {
  display: flex;
  gap: 9px;
  margin: 14px 0;
  color: #bcb5a9;
}

button {
  padding: 10px 14px;
  border: 0;
  border-radius: 9px;
  background: #d6a85e;
  color: #191713;
  font-weight: 800;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: .45;
}

.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 14px 0;
  overflow: hidden;
  border-radius: 9px;
  background: #3a352d;
}

.facts div {
  padding: 10px;
  background: #24221e;
}

dt {
  margin-bottom: 4px;
  color: #8f897f;
  font-size: 10px;
}

dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 12px;
}

.chunk-heading {
  margin: 14px 0 8px;
}

.chunk-heading div {
  display: grid;
  gap: 4px;
}

.chunk-heading code {
  max-width: 50%;
  overflow-wrap: anywhere;
  color: #777168;
  font-size: 9px;
  text-align: right;
}

details {
  margin-bottom: 12px;
}

summary {
  cursor: pointer;
  color: #d7a75d;
  font-size: 12px;
}

pre {
  max-height: 260px;
  overflow: auto;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid #3c3932;
  border-radius: 8px;
  background: #121210;
  color: #bdb6aa;
  font: 11px/1.55 ui-monospace, monospace;
}

label {
  display: block;
  color: #aaa397;
  font-size: 12px;
}

textarea {
  box-sizing: border-box;
  width: 100%;
  margin: 6px 0 10px;
  padding: 10px;
  border: 1px solid #444137;
  border-radius: 8px;
  background: #121210;
  color: #e7e2d7;
  font: 11px/1.5 ui-monospace, monospace;
}

.message,
.ready {
  margin: 12px 0;
  padding: 11px;
  border-radius: 8px;
  color: #bcb5a9;
  background: #24221e;
  font-size: 12px;
}

.message--error {
  color: #ff9d8e;
}

.message--success {
  color: #8bd9ac;
}

@media (max-width: 620px) {
  header,
  .chunk-heading {
    flex-direction: column;
  }

  .facts {
    grid-template-columns: 1fr;
  }

  .chunk-heading code {
    max-width: none;
    text-align: left;
  }
}
</style>
