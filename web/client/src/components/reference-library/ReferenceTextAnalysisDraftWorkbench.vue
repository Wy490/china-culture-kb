<template>
  <section class="draft" data-testid="reference-text-analysis-draft">
    <header>
      <div>
        <p>Evidence-bound draft · P1-C6</p>
        <h4>草拟 Pending TextReferenceAnalysis</h4>
      </div>
      <span v-if="draftTask">{{ statusLabel[draftTask.status] }}</span>
    </header>

    <div class="boundary">
      <strong>只草拟，不批准</strong>
      <span>输入绑定 source fingerprint、execution 与 evidence SHA</span>
      <span>服务端不调用模型；缺失字段必须由 Codex/operator 补齐，不得猜造</span>
      <span>证据不足时先登记结构化补充需求；补充响应不允许复制来源原文</span>
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

      <template v-if="draftTask.status === 'pending'">
        <div
          v-if="draftTask.supplement_request && draftTask.supplement_id"
          class="supplement-bound"
          data-testid="reference-text-analysis-supplement-bound"
        >
          <strong>补充证据已绑定</strong>
          <span>{{ draftTask.supplement_id }}</span>
          <span>最终 analysis provenance 将同时锁定需求 SHA 与响应 SHA。</span>
        </div>
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

        <div v-if="!draftTask.supplement_request" class="supplement-panel">
          <strong>现有 Evidence 不足？</strong>
          <p>
            只声明缺失字段、原因和现有 observation ID；这里不提交猜测值，也不复制来源正文。
          </p>
          <label>
            结构化补充需求 JSON
            <textarea
              v-model="supplementRequestJson"
              rows="14"
              spellcheck="false"
              data-testid="reference-text-analysis-supplement-request-json"
            />
          </label>
          <button
            type="button"
            class="secondary-button"
            :disabled="busy"
            data-testid="request-reference-text-analysis-supplement"
            @click="declareSupplement"
          >
            {{ busy ? '正在登记需求…' : '登记 needs_supplement' }}
          </button>
        </div>
      </template>

      <template v-else-if="draftTask.status === 'needs_supplement'">
        <div class="supplement-panel supplement-panel--active">
          <strong>等待有界补充</strong>
          <p>
            必须逐项覆盖下列字段；只能提交 locator、摘要和限制，不得粘贴来源原文。
          </p>
          <ul>
            <li
              v-for="need in draftTask.supplement_request?.needs ?? []"
              :key="need.field"
            >
              {{ need.field }} · {{ need.reason }}
            </li>
          </ul>
          <label>
            有界补充 JSON
            <textarea
              v-model="supplementJson"
              rows="18"
              spellcheck="false"
              data-testid="reference-text-analysis-supplement-json"
            />
          </label>
          <button
            type="button"
            :disabled="busy"
            data-testid="submit-reference-text-analysis-supplement"
            @click="submitSupplement"
          >
            {{ busy ? '正在封存补充…' : '提交补充并恢复草拟' }}
          </button>
        </div>
      </template>

      <template v-else-if="draftTask.status === 'processing'">
        <p class="message">分析正在封存；使用原提交 key 重试可恢复完成态。</p>
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
  ReferenceTextAnalysisDraftSupplementItem,
  ReferenceTextAnalysisDraftTaskRecord,
  ReferenceTextAnalysisSupplementNeed,
  TextReferenceAnalysis,
} from '@shared/types'
import {
  createReferenceTextAnalysisDraftTask,
  getReferenceTextAnalysisDraftTask,
  requestReferenceTextAnalysisSupplement,
  submitReferenceTextAnalysisDraft,
  submitReferenceTextAnalysisSupplement,
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
const supplementRequestJson = ref('')
const supplementRequestKey = ref('')
const supplementJson = ref('')
const supplementSubmissionKey = ref('')
const loading = ref(false)
const busy = ref(false)
const errorMessage = ref('')
const notice = ref('')

const statusLabel: Record<ReferenceTextAnalysisDraftTaskRecord['status'], string> = {
  pending: '待草拟',
  needs_supplement: '待补充',
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

function newSubmissionKey(prefix = 'text-analysis-draft'): string {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}:${suffix}`
}

function supplementRequestTemplate(
  evidenceId: string,
): { needs: ReferenceTextAnalysisSupplementNeed[] } {
  return {
    needs: [{
      field: 'scene_patterns',
      reason: 'insufficient_source_coverage',
      evidence_id: evidenceId,
      evidence_observation_ids: [],
      required_input: 'bounded_source_observations',
    }],
  }
}

function supplementTemplate(
  needs: ReferenceTextAnalysisSupplementNeed[],
): { items: ReferenceTextAnalysisDraftSupplementItem[] } {
  return {
    items: needs.map(need => ({
      field: need.field,
      source_locators: ['请替换为 sealed material locator'],
      observation_summary: '请填写不含来源原文的有界观察摘要',
      limitations: ['请填写该补充仍不能证明或复刻的内容'],
    })),
  }
}

function resetEditor(): void {
  analysisJson.value = JSON.stringify(analysisTemplate(), null, 2)
  submissionKey.value = newSubmissionKey()
  supplementRequestKey.value = newSubmissionKey('text-analysis-supplement-request')
  supplementSubmissionKey.value = newSubmissionKey('text-analysis-supplement')
  supplementRequestJson.value = ''
  supplementJson.value = ''
}

function resetSupplementEditors(
  task: ReferenceTextAnalysisDraftTaskRecord,
): void {
  supplementRequestJson.value = JSON.stringify(
    supplementRequestTemplate(task.similarity_evidence_id),
    null,
    2,
  )
  supplementJson.value = JSON.stringify(
    supplementTemplate(task.supplement_request?.needs ?? []),
    null,
    2,
  )
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
  resetSupplementEditors(response.data)
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
  resetSupplementEditors(response.data)
  notice.value = '草拟任务已建立；输出将固定为 pending。'
}

function parseSupplementNeeds(): ReferenceTextAnalysisSupplementNeed[] | null {
  try {
    const parsed = JSON.parse(supplementRequestJson.value) as {
      needs?: ReferenceTextAnalysisSupplementNeed[]
    }
    if (!Array.isArray(parsed.needs) || parsed.needs.length === 0) {
      throw new Error('补充需求必须包含非空 needs 数组')
    }
    return parsed.needs
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : '补充需求 JSON 无法解析'
    return null
  }
}

async function declareSupplement(): Promise<void> {
  if (!draftTask.value || draftTask.value.status !== 'pending') return
  const needs = parseSupplementNeeds()
  if (!needs) return
  busy.value = true
  errorMessage.value = ''
  notice.value = ''
  const response = await requestReferenceTextAnalysisSupplement(
    props.task.task_id,
    {
      submission_key: supplementRequestKey.value,
      requested_by: props.actorId,
      confirmation: 'declare_text_analysis_evidence_insufficient',
      needs,
    },
  )
  busy.value = false
  if (!response.ok || !response.data) {
    errorMessage.value = response.error?.message ?? '登记补充需求失败'
    return
  }
  draftTask.value = response.data
  resetSupplementEditors(response.data)
  notice.value = '补充需求已锁定；补充前不会生成 analysis。'
}

function parseSupplementItems():
  ReferenceTextAnalysisDraftSupplementItem[] | null {
  try {
    const parsed = JSON.parse(supplementJson.value) as {
      items?: ReferenceTextAnalysisDraftSupplementItem[]
    }
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      throw new Error('补充响应必须包含非空 items 数组')
    }
    if (JSON.stringify(parsed.items).includes('请填写')
      || JSON.stringify(parsed.items).includes('请替换')) {
      throw new Error('必须替换全部补充模板占位词后才能提交')
    }
    return parsed.items
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : '补充响应 JSON 无法解析'
    return null
  }
}

async function submitSupplement(): Promise<void> {
  if (!draftTask.value || draftTask.value.status !== 'needs_supplement') return
  const items = parseSupplementItems()
  if (!items) return
  busy.value = true
  errorMessage.value = ''
  notice.value = ''
  const response = await submitReferenceTextAnalysisSupplement(
    props.task.task_id,
    {
      submission_key: supplementSubmissionKey.value,
      submitted_by: props.actorId,
      confirmation: 'submit_bounded_supplement_without_source_excerpts',
      items,
    },
  )
  busy.value = false
  if (!response.ok || !response.data) {
    errorMessage.value = response.error?.message ?? '提交补充失败'
    return
  }
  draftTask.value = response.data.draft_task
  notice.value = `补充 ${response.data.supplement.supplement_id} 已封存；草拟任务已恢复。`
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

.secondary-button {
  border: 1px solid #5d9ab1;
  background: transparent;
  color: #9dd5e4;
}

.supplement-panel,
.supplement-bound {
  display: grid;
  gap: 8px;
  margin-top: 14px;
  padding: 12px;
  border: 1px solid rgba(214, 166, 89, .42);
  border-radius: 9px;
  background: rgba(106, 76, 30, .14);
  color: #c9c1b1;
  font-size: 12px;
}

.supplement-panel--active {
  border-color: rgba(120, 184, 202, .55);
  background: rgba(54, 102, 118, .12);
}

.supplement-panel p,
.supplement-panel ul {
  margin: 0;
}

.supplement-panel ul {
  padding-left: 18px;
}

.supplement-bound {
  border-color: rgba(94, 182, 126, .4);
  background: rgba(51, 112, 73, .12);
}

.supplement-bound strong {
  color: #8bd9ac;
}

.supplement-bound span {
  overflow-wrap: anywhere;
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
