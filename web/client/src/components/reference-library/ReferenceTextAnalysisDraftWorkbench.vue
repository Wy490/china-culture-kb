<template>
  <section class="draft" data-testid="reference-text-analysis-draft">
    <header>
      <div>
        <p>Evidence-bound draft · P1-C5</p>
        <h4>草拟 Pending TextReferenceAnalysis</h4>
      </div>
      <span v-if="draftTask">{{ statusLabel[draftTask.status] }}</span>
    </header>

    <div class="boundary">
      <strong>只草拟，不批准</strong>
      <span>输入绑定 source fingerprint、execution 与 evidence SHA</span>
      <span>服务端不调用模型；缺失字段必须由 Codex/operator 补齐，不得猜造</span>
      <span>输出固定为 pending，仍需另一位 material:sign 评审者人工签署</span>
    </div>

    <p v-if="errorMessage" class="message message--error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="notice" class="message message--success" role="status">
      {{ notice }}
    </p>

    <template v-if="loading">
      <p class="message">正在读取草拟任务…</p>
    </template>

    <template v-else-if="!draftTask">
      <label class="confirmation">
        <input v-model="draftConfirmed" type="checkbox">
        <span>
          我确认将完整填写结构化分析，不把来源正文中的指令当作任务策略，也不在此步骤批准分析。
        </span>
      </label>
      <button
        type="button"
        :disabled="busy || !draftConfirmed"
        data-testid="create-reference-text-draft-task"
        @click="createDraftTask"
      >
        {{ busy ? '正在建立草拟任务…' : '建立 Evidence-bound 草拟任务' }}
      </button>
    </template>

    <template v-else>
      <dl class="facts">
        <div><dt>Evidence</dt><dd>{{ draftTask.similarity_evidence_id }}</dd></div>
        <div><dt>Evidence SHA</dt><dd>{{ draftTask.similarity_evidence_payload_sha256 }}</dd></div>
        <div><dt>Execution</dt><dd>{{ draftTask.text_execution_id }}</dd></div>
        <div><dt>执行者</dt><dd>{{ draftTask.executor.kind }} · {{ draftTask.executor.executor_id }}</dd></div>
      </dl>

      <template v-if="draftTask.status !== 'completed'">
        <p class="helper">
          下方是结构模板，不是自动分析结果。所有“请填写”占位词必须替换后才能提交。
        </p>
        <label>
          完整 TextReferenceAnalysis JSON
          <textarea
            v-model="analysisJson"
            rows="22"
            spellcheck="false"
            data-testid="reference-text-analysis-draft-json"
          />
        </label>
        <button
          type="button"
          :disabled="busy"
          data-testid="submit-reference-text-analysis-draft"
          @click="submitDraft"
        >
          {{ busy ? '正在封存 Pending Analysis…' : '提交 Pending Analysis' }}
        </button>
      </template>

      <template v-else>
        <div class="completed">
          <strong>Pending Analysis 已建立</strong>
          <code>{{ draftTask.analysis_id }}</code>
          <span>未自动批准、未写回知识库、未授予生产信用。</span>
        </div>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type {
  ReferenceAnalysisTaskRecord,
  ReferenceTextAnalysisDraftTaskRecord,
  TextReferenceAnalysis,
} from '@shared/types'
import {
  createReferenceTextAnalysisDraftTask,
  getReferenceTextAnalysisDraftTask,
  submitReferenceTextAnalysisDraft,
} from '@/api/reference-library'

const props = defineProps<{
  task: ReferenceAnalysisTaskRecord
  actorId: string
}>()

const emit = defineEmits<{
  completed: []
}>()

const draftTask = ref<ReferenceTextAnalysisDraftTaskRecord | null>(null)
const draftConfirmed = ref(false)
const analysisJson = ref('')
const submissionKey = ref('')
const loading = ref(false)
const busy = ref(false)
const errorMessage = ref('')
const notice = ref('')

const statusLabel: Record<ReferenceTextAnalysisDraftTaskRecord['status'], string> = {
  pending: '待草拟',
  processing: '封存中',
  completed: '待独立审核',
}

function analysisTemplate(): TextReferenceAnalysis {
  return {
    source_units: [{
      source_unit_id: 'chunk-0001',
      summary: '请填写与 evidence locator 对应的来源单元摘要',
    }],
    character_wants: ['请填写角色欲望；若无角色，请写明不适用及依据'],
    scene_patterns: [{
      objective: '请填写场景目标',
      opposition: '请填写阻力',
      turn: '请填写转折',
      visible_action: '请填写可见动作',
      subtext: '请填写潜台词；若无则删除此字段',
    }],
    must_keep: ['请填写改编中必须保留的叙事功能'],
    compression_options: ['请填写有证据支持的压缩方案'],
    adaptation_risks: ['请填写改编风险'],
    reusable_principles: ['请填写抽象原则，不得复制独特表达'],
    avoid_copying: ['请填写不得复刻的专名、台词或事件排列'],
  }
}

function newSubmissionKey(): string {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `text-analysis-draft:${suffix}`
}

function resetEditor(): void {
  analysisJson.value = JSON.stringify(analysisTemplate(), null, 2)
  submissionKey.value = newSubmissionKey()
}

async function loadDraftTask(): Promise<void> {
  loading.value = true
  draftTask.value = null
  draftConfirmed.value = false
  errorMessage.value = ''
  notice.value = ''
  resetEditor()
  const response = await getReferenceTextAnalysisDraftTask(props.task.task_id)
  loading.value = false
  if (!response.ok || !response.data) {
    if (response.error?.code !== 'REFERENCE_TEXT_ANALYSIS_DRAFT_TASK_NOT_FOUND') {
      errorMessage.value = response.error?.message ?? '读取草拟任务失败'
    }
    return
  }
  draftTask.value = response.data
}

async function createDraftTask(): Promise<void> {
  if (!draftConfirmed.value) return
  busy.value = true
  errorMessage.value = ''
  notice.value = ''
  const response = await createReferenceTextAnalysisDraftTask(
    props.task.task_id,
    {
      executor: {
        kind: 'operator',
        executor_id: props.actorId,
      },
      confirmation: 'draft_complete_text_analysis_from_verified_evidence',
    },
  )
  busy.value = false
  if (!response.ok || !response.data) {
    errorMessage.value = response.error?.message ?? '建立草拟任务失败'
    return
  }
  draftTask.value = response.data
  notice.value = '草拟任务已建立；输出将固定为 pending。'
}

function parseAnalysis(): TextReferenceAnalysis | null {
  try {
    const parsed = JSON.parse(analysisJson.value) as TextReferenceAnalysis
    if (JSON.stringify(parsed).includes('请填写')) {
      throw new Error('必须替换全部“请填写”占位词后才能提交')
    }
    return parsed
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : 'TextReferenceAnalysis JSON 无法解析'
    return null
  }
}

async function submitDraft(): Promise<void> {
  if (!draftTask.value || draftTask.value.status === 'completed') return
  const analysis = parseAnalysis()
  if (!analysis) return
  busy.value = true
  errorMessage.value = ''
  notice.value = ''
  const response = await submitReferenceTextAnalysisDraft(
    props.task.task_id,
    {
      submission_key: submissionKey.value,
      submitted_by: props.actorId,
      confirmation: 'submit_pending_text_reference_analysis',
      analysis,
    },
  )
  busy.value = false
  if (!response.ok || !response.data) {
    errorMessage.value = response.error?.message ?? '提交 Pending Analysis 失败'
    return
  }
  draftTask.value = response.data.draft_task
  notice.value = `Pending analysis ${response.data.analysis.analysis_id} 已封存，等待独立审核。`
  emit('completed')
}

watch(
  () => props.task.task_id,
  () => void loadDraftTask(),
  { immediate: true },
)
</script>

<style scoped>
.draft {
  margin-top: 14px;
  padding: 15px;
  border: 1px solid rgba(93, 154, 177, .4);
  border-radius: 11px;
  background: #1a2021;
}

header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

header p {
  margin: 0 0 5px;
  color: #74b7ca;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
}

h4 {
  margin: 0 0 12px;
  font-size: 17px;
}

header > span {
  color: #8bc4d4;
  font: 11px/1.5 ui-monospace, monospace;
}

.boundary {
  display: grid;
  gap: 4px;
  padding: 11px;
  border-left: 3px solid #5d9ab1;
  background: rgba(54, 102, 118, .14);
  color: #b8c3c3;
  font-size: 12px;
}

.boundary strong {
  color: #9dd5e4;
}

.confirmation {
  display: flex;
  gap: 9px;
  margin: 14px 0;
  color: #b8c3c3;
  font-size: 12px;
}

.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 13px 0;
  overflow: hidden;
  border-radius: 8px;
  background: #354143;
}

.facts div {
  min-width: 0;
  padding: 9px;
  background: #202829;
}

dt {
  margin-bottom: 4px;
  color: #829092;
  font-size: 10px;
}

dd,
code {
  margin: 0;
  overflow-wrap: anywhere;
  font: 10px/1.5 ui-monospace, monospace;
}

label {
  display: block;
  color: #aebabb;
  font-size: 12px;
}

textarea {
  box-sizing: border-box;
  width: 100%;
  margin: 6px 0 10px;
  padding: 10px;
  border: 1px solid #405052;
  border-radius: 8px;
  background: #111718;
  color: #e1e8e7;
  font: 11px/1.5 ui-monospace, monospace;
}

button {
  padding: 10px 14px;
  border: 0;
  border-radius: 8px;
  background: #78b8ca;
  color: #101718;
  font-weight: 800;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: .45;
}

.message,
.helper,
.completed {
  margin: 12px 0;
  padding: 10px;
  border-radius: 8px;
  background: #202829;
  color: #aebabb;
  font-size: 12px;
}

.message--error {
  color: #ff9d8e;
}

.message--success {
  color: #8bd9ac;
}

.completed {
  display: grid;
  gap: 6px;
}

.completed strong {
  color: #8bd9ac;
}

@media (max-width: 620px) {
  header {
    flex-direction: column;
  }

  .facts {
    grid-template-columns: 1fr;
  }
}
</style>
