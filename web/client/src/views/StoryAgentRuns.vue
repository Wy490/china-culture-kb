<template>
  <section class="run-console" data-testid="story-agent-run-console">
    <header class="run-console__hero">
      <div>
        <p class="run-console__eyebrow">PRODUCTION CONTROL</p>
        <h1>Story Agent 运行控制台</h1>
        <p>查看生成、专业文本、Seedance 提示、图片资产与预制作包的持久化状态。</p>
      </div>
      <div class="run-console__truth-lock">
        <strong>自动化边界</strong>
        <span>服务端不调用图片供应商，不生成视频，也不授予真人评审或正式发布信用。</span>
      </div>
    </header>

    <section
      v-if="visualAssetPressure"
      class="run-console__pressure"
      data-testid="story-agent-visual-asset-pressure"
    >
      <div>
        <p class="run-console__eyebrow">VISUAL ASSET PRESSURE</p>
        <h2>
          不同素材视觉压力
          <span :class="`status status--${visualAssetPressure.status}`">
            {{ pressureStatusLabel(visualAssetPressure.status) }}
          </span>
        </h2>
        <p>
          {{ visualAssetPressure.coverage.case_count }} 个题材 ·
          {{ visualAssetPressure.coverage.unique_style_family_count }} 种风格 ·
          {{ visualAssetPressure.coverage.unique_content_sha256_count }} 个唯一内容 SHA ·
          跨题材复用 {{ visualAssetPressure.coverage.cross_case_content_reuse_count }}
        </p>
        <small>
          恢复/拒绝场景
          {{ visualAssetPressure.scenario_summary.passed_count }}/{{ visualAssetPressure.scenario_summary.required_count }}
          · 详细证据 {{ visualAssetPressure.report.relative_path }}
        </small>
        <small>
          批次证据
          {{ pressureProvenanceStatusLabel(visualAssetPressure.composition_provenance.status) }}
          · {{ visualAssetPressure.composition_provenance.batch_count }} 批
          · 封存 {{ visualAssetPressure.composition_provenance.sealed_batch_count }}
          · 历史未封存 {{ visualAssetPressure.composition_provenance.legacy_unsealed_batch_count }}
          · 文件 {{ visualAssetPressure.composition_provenance.verified_file_count }}/{{ visualAssetPressure.composition_provenance.file_count }}
        </small>
        <ul v-if="visualAssetPressure.blockers.length">
          <li v-for="blocker in visualAssetPressure.blockers" :key="blocker">{{ blocker }}</li>
        </ul>
      </div>
      <button
        type="button"
        class="run-console__button--quiet"
        :disabled="pressureLoading"
        @click="loadVisualAssetPressure"
      >
        {{ pressureLoading ? '刷新中…' : '刷新审计' }}
      </button>
    </section>
    <p v-else-if="pressureLoading" class="run-console__pressure-loading">正在读取视觉压力审计…</p>
    <p v-else-if="pressureError" class="run-console__pressure-error">{{ pressureError }}</p>

    <form class="run-console__filters" @submit.prevent="applyFilters">
      <label>
        <span>运行状态</span>
        <select v-model="filters.status">
          <option value="">全部状态</option>
          <option value="in_progress">执行中</option>
          <option value="awaiting_external_action">等待外部动作</option>
          <option value="failed_retryable">可重试失败</option>
          <option value="ready">预制作就绪</option>
          <option value="blocked">已阻断</option>
        </select>
      </label>
      <label>
        <span>启动方式</span>
        <select v-model="filters.kind">
          <option value="">全部方式</option>
          <option value="generation_request">从生成请求启动</option>
          <option value="existing_project">已有单片项目</option>
          <option value="existing_series">已有漫剧系列</option>
        </select>
      </label>
      <label>
        <span>来源类型</span>
        <select v-model="filters.source_kind">
          <option value="">全部来源</option>
          <option value="story_project">单片项目</option>
          <option value="ai_comic_series_project">漫剧系列</option>
        </select>
      </label>
      <button type="submit" :disabled="listLoading">应用筛选</button>
      <button type="button" class="run-console__button--quiet" :disabled="listLoading" @click="refreshList">
        {{ listLoading ? '刷新中…' : '刷新' }}
      </button>
    </form>

    <p v-if="errorMessage" class="run-console__error" role="alert">{{ errorMessage }}</p>

    <div class="run-console__layout">
      <aside class="run-console__ledger" aria-label="运行列表">
        <div class="run-console__section-head">
          <div>
            <h2>运行 Ledger</h2>
            <small v-if="listData">
              本页 {{ listData.items.length }} 条 · 扫描 {{ listData.page.scanned_count }}/{{ listData.boundary.max_scanned_ledgers }}
            </small>
          </div>
        </div>

        <p v-if="listLoading && !listData" class="run-console__empty">正在读取运行摘要…</p>
        <p v-else-if="listData?.items.length === 0" class="run-console__empty">
          当前筛选下没有可访问的运行。若本页仍有下一游标，可继续翻页。
        </p>
        <button
          v-for="item in listData?.items ?? []"
          :key="item.run_id"
          type="button"
          :class="['run-card', { 'run-card--active': selectedRunId === item.run_id }]"
          @click="selectRun(item.run_id)"
        >
          <span class="run-card__topline">
            <b>{{ runKindLabel(item.kind) }}</b>
            <em :class="`status status--${item.status}`">{{ statusLabel(item.status) }}</em>
          </span>
          <strong>{{ item.generation_request?.entry_name || item.source?.source_id || item.run_id }}</strong>
          <code>{{ item.run_id }}</code>
          <span>当前：{{ stageLabel(item.current_stage) }} · {{ formatTime(item.updated_at) }}</span>
          <span v-if="item.primary_blocker" class="run-card__blocker">{{ item.primary_blocker }}</span>
        </button>

        <div class="run-console__pager">
          <button type="button" :disabled="cursorHistory.length === 0 || listLoading" @click="previousPage">
            上一页
          </button>
          <button
            type="button"
            :disabled="!listData?.page.has_more || !listData.page.next_cursor || listLoading"
            @click="nextPage"
          >
            下一页
          </button>
        </div>
      </aside>

      <main class="run-console__detail" aria-live="polite">
        <p v-if="detailLoading" class="run-console__empty">正在读取完整运行 Ledger…</p>
        <p v-else-if="!selectedRun" class="run-console__empty">选择一条运行查看阶段证据和操作。</p>
        <template v-else>
          <section class="run-console__summary">
            <div>
              <p class="run-console__eyebrow">{{ selectedRun.schema_version }}</p>
              <h2>{{ detailTitle }}</h2>
              <code>{{ selectedRun.run_id }}</code>
            </div>
            <div class="run-console__actions">
              <button type="button" :disabled="actionLoading !== ''" @click="resumeSelectedRun">
                {{ actionLoading === 'resume' ? '重试中…' : '重试 / 刷新运行' }}
              </button>
              <button
                type="button"
                class="run-console__button--quiet"
                :disabled="actionLoading !== ''"
                @click="downloadPreproductionExport"
              >
                {{ actionLoading === 'export' ? '导出中…' : '导出预制作 JSON' }}
              </button>
            </div>
          </section>

          <dl class="run-console__facts">
            <div>
              <dt>状态</dt>
              <dd><span :class="`status status--${selectedRun.status}`">{{ statusLabel(selectedRun.status) }}</span></dd>
            </div>
            <div>
              <dt>当前阶段</dt>
              <dd>{{ stageLabel(selectedRun.current_stage) }}</dd>
            </div>
            <div>
              <dt>重试次数</dt>
              <dd>{{ selectedRun.resume_count }}</dd>
            </div>
            <div>
              <dt>片型</dt>
              <dd>{{ selectedRun.video_types.join('、') || '待生成' }}</dd>
            </div>
          </dl>

          <section
            v-if="selectedReferenceGenerationRecipe"
            class="run-console__blockers"
            data-testid="story-agent-run-reference-generation-recipe"
          >
            <h3>创作配方 Provenance</h3>
            <p>
              {{ referenceGenerationRecipeLabel }}
              · v{{ selectedReferenceGenerationRecipe.recipe_version }}
              · SHA {{ selectedReferenceGenerationRecipe.payload_sha256.slice(0, 12) }}…
            </p>
            <strong>使用的抽象机制</strong>
            <ul>
              <li
                v-for="mechanism in selectedReferenceGenerationRecipe.reusable_mechanisms"
                :key="mechanism"
              >
                {{ mechanism }}
              </li>
            </ul>
            <strong>明确禁止复制</strong>
            <ul>
              <li
                v-for="boundary in selectedReferenceGenerationRecipe.avoid_copying"
                :key="boundary"
              >
                {{ boundary }}
              </li>
            </ul>
          </section>

          <section v-if="selectedRun.blockers.length || selectedRun.retryable_failures.length" class="run-console__blockers">
            <h3>当前阻塞</h3>
            <ul>
              <li v-for="blocker in selectedRun.blockers" :key="`blocker:${blocker}`">{{ blocker }}</li>
              <li v-for="failure in selectedRun.retryable_failures" :key="`retry:${failure}`">
                可重试：{{ failure }}
              </li>
            </ul>
          </section>

          <section class="run-console__stages" data-testid="story-agent-stage-timeline">
            <div class="run-console__section-head">
              <div>
                <h3>阶段时间线</h3>
                <small>{{ selectedRun.stage_results.length }} 个持久化阶段结果</small>
              </div>
            </div>
            <ol>
              <li
                v-for="(stage, index) in selectedRun.stage_results"
                :key="stage.stage"
                :class="`stage stage--${stage.status}`"
              >
                <span class="stage__index">{{ index + 1 }}</span>
                <div>
                  <strong>{{ stageLabel(stage.stage) }}</strong>
                  <em>{{ stageStatusLabel(stage.status) }}</em>
                  <small v-if="stage.blockers[0]">{{ stage.blockers[0] }}</small>
                  <small v-else-if="stage.retryable_failures[0]">{{ stage.retryable_failures[0] }}</small>
                  <small v-else>{{ stage.evidence_refs.length }} 条证据引用</small>
                </div>
              </li>
            </ol>
          </section>

          <section
            v-if="selectedRun.workflow_checkpoints?.length"
            class="run-console__checkpoints"
            data-testid="story-agent-workflow-checkpoints"
          >
            <div class="run-console__section-head">
              <div>
                <h3>可恢复 Checkpoint</h3>
                <small>补证、专业包、canonical repair 与派生重建各自保留尝试历史</small>
              </div>
            </div>
            <div class="checkpoint-grid">
              <article
                v-for="checkpoint in selectedRun.workflow_checkpoints"
                :key="checkpoint.checkpoint"
                :class="`checkpoint checkpoint--${checkpoint.status}`"
              >
                <header>
                  <strong>{{ workflowCheckpointLabel(checkpoint.checkpoint) }}</strong>
                  <span :class="`status status--${checkpoint.status}`">
                    {{ stageStatusLabel(checkpoint.status) }}
                  </span>
                </header>
                <p>
                  第 {{ checkpoint.attempt_count }} 次观察 ·
                  {{ workflowCheckpointActionLabel(checkpoint.action.operation) }}
                </p>
                <small v-if="checkpoint.blockers[0]">{{ checkpoint.blockers[0] }}</small>
                <small v-else-if="checkpoint.retryable_failures[0]">
                  可重试：{{ checkpoint.retryable_failures[0] }}
                </small>
                <small v-else>{{ checkpoint.evidence_refs.length }} 条证据引用</small>
                <code>{{ checkpoint.action.automatic_on_run_resume ? 'resume 自动执行' : '显式操作边界' }}</code>
              </article>
            </div>
          </section>

          <section v-if="selectedRun.image_request_manifest" class="run-console__images">
            <div class="run-console__section-head">
              <div>
                <h3>图片请求任务</h3>
                <small>
                  {{ selectedRun.image_request_manifest.task_count }} 项 ·
                  verified {{ selectedRun.image_request_manifest.verified_task_count }} ·
                  pending {{ selectedRun.image_request_manifest.pending_task_count }}
                </small>
              </div>
              <span class="run-console__provider-lock">provider_invoked = false</span>
            </div>
            <details
              v-for="task in selectedRun.image_request_manifest.request.tasks"
              :key="task.task_id"
              class="image-task"
            >
              <summary>
                <span>{{ task.label }}</span>
                <code>{{ task.action }}</code>
              </summary>
              <p>{{ task.prompt }}</p>
              <dl>
                <div><dt>task_id</dt><dd>{{ task.task_id }}</dd></div>
                <div><dt>预期输出</dt><dd>{{ task.expected_output_path }}</dd></div>
                <div><dt>目标资产</dt><dd>{{ task.target_asset_ids.join('、') || '—' }}</dd></div>
              </dl>
            </details>

            <label class="run-console__import">
              <span>图片生成结果 Manifest</span>
              <textarea
                v-model="imageResultJson"
                rows="9"
                placeholder='粘贴 image-generation-result/v1 JSON；导入后会自动刷新运行。'
              />
            </label>
            <button type="button" :disabled="actionLoading !== '' || !imageResultJson.trim()" @click="importImageResult">
              {{ actionLoading === 'import' ? '导入中…' : '校验并导入回片' }}
            </button>
          </section>

          <section class="run-console__boundary">
            <h3>信用与执行边界</h3>
            <ul>
              <li>复用 canonical services：{{ selectedRun.boundary.canonical_services_reused ? '是' : '否' }}</li>
              <li>服务端调用图片供应商：否</li>
              <li>执行视频生成：否</li>
              <li>授予真人评审信用：否</li>
            </ul>
          </section>
        </template>
      </main>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type {
  StoryAgentImageGenerationResult,
  StoryAgentRun,
  StoryAgentRunKind,
  StoryAgentRunListQuery,
  StoryAgentRunListResponse,
  StoryAgentRunStage,
  StoryAgentRunStageStatus,
  StoryAgentRunWorkflowCheckpoint,
  StoryAgentRunWorkflowCheckpointKey,
  StoryAgentVisualAssetPressureOpsStatus,
} from '@shared/types'
import {
  exportStoryAgentRun,
  getStoryAgentRun,
  importStoryAgentRunImageResult,
  listStoryAgentRuns,
  resumeStoryAgentRun,
} from '@/api/story-agent-runs'
import { getStoryAgentVisualAssetPressureOpsStatus } from '@/api/system'
import { REFERENCE_GENERATION_RECIPES } from '@shared/reference-generation-recipes'

const filters = reactive({
  status: '' as '' | NonNullable<StoryAgentRunListQuery['status']>,
  kind: '' as '' | NonNullable<StoryAgentRunListQuery['kind']>,
  source_kind: '' as '' | NonNullable<StoryAgentRunListQuery['source_kind']>,
})
const listData = ref<StoryAgentRunListResponse | null>(null)
const selectedRun = ref<StoryAgentRun | null>(null)
const selectedRunId = ref('')
const currentCursor = ref<string | undefined>()
const cursorHistory = ref<Array<string | undefined>>([])
const listLoading = ref(false)
const detailLoading = ref(false)
const actionLoading = ref<'' | 'resume' | 'export' | 'import'>('')
const errorMessage = ref('')
const imageResultJson = ref('')
const visualAssetPressure = ref<StoryAgentVisualAssetPressureOpsStatus | null>(null)
const pressureLoading = ref(false)
const pressureError = ref('')

const selectedReferenceGenerationRecipe = computed(() => (
  selectedRun.value?.schema_version === 'story-agent-run/v2'
    ? selectedRun.value.input_contract.generation_request.reference_generation_recipe
      ?? null
    : null
))

const referenceGenerationRecipeLabel = computed(() => {
  const recipeId = selectedReferenceGenerationRecipe.value?.recipe_id
  if (!recipeId) return ''
  return REFERENCE_GENERATION_RECIPES.find(recipe => recipe.id === recipeId)?.label
    ?? recipeId
})

const detailTitle = computed(() => {
  if (!selectedRun.value) return ''
  if (selectedRun.value.schema_version === 'story-agent-run/v2') {
    return selectedRun.value.input_contract.generation_request.entry_name || '生成请求运行'
  }
  return selectedRun.value.source.source_id
})

function statusLabel(status: StoryAgentRun['status']): string {
  return {
    in_progress: '执行中',
    awaiting_external_action: '等待外部动作',
    failed_retryable: '可重试失败',
    ready: '预制作就绪',
    blocked: '已阻断',
  }[status]
}

function pressureStatusLabel(
  status: StoryAgentVisualAssetPressureOpsStatus['status'],
): string {
  return {
    ready: '已通过',
    blocked: '已阻断',
    not_run: '未运行',
  }[status]
}

function pressureProvenanceStatusLabel(
  status: StoryAgentVisualAssetPressureOpsStatus['composition_provenance']['status'],
): string {
  return {
    verified: '已验证',
    blocked: '已阻断',
    not_run: '未运行',
  }[status]
}

function runKindLabel(kind: StoryAgentRunKind): string {
  return {
    generation_request: '生成请求',
    existing_project: '单片项目',
    existing_series: '漫剧系列',
  }[kind]
}

function stageLabel(stage: StoryAgentRunStage | 'complete'): string {
  return {
    generation: '故事生成',
    story_project: '项目落盘',
    source: '来源解析',
    professional_script: '专业文本',
    seedance_prompt: 'Seedance 提示',
    image_assets: '图片资产',
    preproduction_package: '预制作包',
    complete: '全部完成',
  }[stage]
}

function stageStatusLabel(status: StoryAgentRunStageStatus): string {
  return {
    pending: '待处理',
    ready: '就绪',
    awaiting_external_action: '等待外部动作',
    failed_retryable: '可重试失败',
    blocked: '已阻断',
  }[status]
}

function workflowCheckpointLabel(checkpoint: StoryAgentRunWorkflowCheckpointKey): string {
  return {
    evidence_supplement: '专业补证',
    professional_package: '专业文本包',
    canonical_repair: 'Canonical Repair',
    derived_state_rebuild: '派生状态重建',
  }[checkpoint]
}

function workflowCheckpointActionLabel(
  operation: StoryAgentRunWorkflowCheckpoint['action']['operation'],
): string {
  return {
    update_project_supplement_task: '补证任务写回',
    review_professional_text_package: '专业包审校',
    repair_project_quality: '质量修复服务',
    rebuild_project_derived_state: '确定性重建服务',
  }[operation]
}

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
}

async function loadRuns(cursor = currentCursor.value): Promise<void> {
  listLoading.value = true
  errorMessage.value = ''
  const result = await listStoryAgentRuns({
    limit: 20,
    ...(cursor ? { cursor } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(filters.source_kind ? { source_kind: filters.source_kind } : {}),
  })
  listLoading.value = false
  if (!result.ok || !result.data) {
    errorMessage.value = result.error?.message || '运行列表读取失败'
    return
  }
  listData.value = result.data
  currentCursor.value = cursor
  if (
    selectedRunId.value
    && result.data.items.some(item => item.run_id === selectedRunId.value)
  ) return
  const firstRunId = result.data.items[0]?.run_id
  if (firstRunId) await selectRun(firstRunId)
  else {
    selectedRunId.value = ''
    selectedRun.value = null
  }
}

async function loadVisualAssetPressure(): Promise<void> {
  pressureLoading.value = true
  pressureError.value = ''
  const result = await getStoryAgentVisualAssetPressureOpsStatus()
  pressureLoading.value = false
  if (!result.ok || !result.data) {
    pressureError.value = result.error?.message || '视觉压力审计读取失败'
    return
  }
  visualAssetPressure.value = result.data
}

async function selectRun(runId: string): Promise<void> {
  selectedRunId.value = runId
  detailLoading.value = true
  errorMessage.value = ''
  imageResultJson.value = ''
  const result = await getStoryAgentRun(runId)
  detailLoading.value = false
  if (!result.ok || !result.data) {
    errorMessage.value = result.error?.message || '完整运行 Ledger 读取失败'
    selectedRun.value = null
    return
  }
  selectedRun.value = result.data
}

async function applyFilters(): Promise<void> {
  cursorHistory.value = []
  currentCursor.value = undefined
  await loadRuns()
}

async function refreshList(): Promise<void> {
  await loadRuns()
  if (selectedRunId.value) await selectRun(selectedRunId.value)
}

async function nextPage(): Promise<void> {
  const nextCursor = listData.value?.page.next_cursor
  if (!nextCursor) return
  cursorHistory.value.push(currentCursor.value)
  await loadRuns(nextCursor)
}

async function previousPage(): Promise<void> {
  if (!cursorHistory.value.length) return
  const cursor = cursorHistory.value.pop()
  await loadRuns(cursor)
}

async function resumeSelectedRun(): Promise<void> {
  if (!selectedRun.value) return
  actionLoading.value = 'resume'
  errorMessage.value = ''
  const result = await resumeStoryAgentRun(selectedRun.value.run_id)
  actionLoading.value = ''
  if (!result.ok || !result.data) {
    errorMessage.value = result.error?.message || '运行重试失败'
    return
  }
  selectedRun.value = result.data
  await loadRuns()
}

async function downloadPreproductionExport(): Promise<void> {
  if (!selectedRun.value) return
  actionLoading.value = 'export'
  errorMessage.value = ''
  const result = await exportStoryAgentRun(selectedRun.value.run_id)
  actionLoading.value = ''
  if (!result.ok || !result.data) {
    errorMessage.value = result.error?.message || '预制作包导出失败'
    return
  }
  const blob = new Blob([`${JSON.stringify(result.data, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${result.data.run_id}-preproduction.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

async function importImageResult(): Promise<void> {
  if (!selectedRun.value) return
  let parsed: StoryAgentImageGenerationResult
  try {
    parsed = JSON.parse(imageResultJson.value) as StoryAgentImageGenerationResult
  } catch {
    errorMessage.value = '图片结果不是合法 JSON'
    return
  }
  actionLoading.value = 'import'
  errorMessage.value = ''
  const result = await importStoryAgentRunImageResult(selectedRun.value.run_id, parsed)
  actionLoading.value = ''
  if (!result.ok || !result.data) {
    errorMessage.value = result.error?.message || '图片结果导入失败'
    return
  }
  selectedRun.value = result.data.run
  imageResultJson.value = ''
  await loadRuns()
}

onMounted(() => {
  void loadRuns()
  void loadVisualAssetPressure()
})
</script>

<style scoped>
.run-console {
  max-width: 1500px;
  margin: 0 auto;
  color: #1a2932;
}

.run-console__hero {
  display: flex;
  justify-content: space-between;
  gap: 28px;
  padding: 30px 34px;
  border-radius: 24px;
  color: #f4fbfa;
  background: linear-gradient(125deg, #173a4e, #176961);
  box-shadow: 0 18px 44px rgba(23, 58, 78, 0.2);
}

.run-console__hero h1 {
  margin: 5px 0 8px;
  font-size: clamp(30px, 4vw, 48px);
}

.run-console__hero p {
  margin: 0;
  color: #d3e8e5;
}

.run-console__eyebrow {
  margin: 0;
  color: #82d7c6;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.18em;
}

.run-console__truth-lock {
  max-width: 410px;
  padding: 16px 18px;
  align-self: center;
  border: 1px solid rgba(255, 255, 255, 0.23);
  border-radius: 14px;
  background: rgba(4, 30, 34, 0.25);
}

.run-console__truth-lock strong,
.run-console__truth-lock span {
  display: block;
}

.run-console__truth-lock span {
  margin-top: 5px;
  color: #c4dfdc;
  font-size: 12px;
  line-height: 1.6;
}

.run-console__pressure {
  margin: 18px 0;
  padding: 16px 18px;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
  border: 1px solid #bdd8d2;
  border-radius: 15px;
  background: #f0f8f6;
}

.run-console__pressure h2 {
  margin: 4px 0 7px;
  display: flex;
  gap: 9px;
  align-items: center;
  font-size: 18px;
}

.run-console__pressure p,
.run-console__pressure small {
  margin: 0;
  color: #50686b;
}

.run-console__pressure small {
  display: block;
  margin-top: 5px;
}

.run-console__pressure ul {
  margin: 8px 0 0;
  color: #913930;
  font-size: 11px;
}

.run-console__pressure-loading,
.run-console__pressure-error {
  margin: 18px 0;
  padding: 14px 17px;
  border-radius: 12px;
}

.run-console__pressure-loading {
  color: #61747a;
  background: #f2f5f6;
}

.run-console__pressure-error {
  color: #8f2d24;
  background: #fff2f0;
}

.run-console__filters {
  display: flex;
  align-items: end;
  gap: 12px;
  margin: 18px 0;
  padding: 15px;
  border: 1px solid #d8e2e5;
  border-radius: 15px;
  background: #f8faf9;
}

.run-console__filters label {
  display: grid;
  gap: 5px;
  min-width: 160px;
  color: #65757b;
  font-size: 11px;
  font-weight: 800;
}

.run-console select,
.run-console textarea,
.run-console button {
  font: inherit;
}

.run-console select {
  padding: 9px 10px;
  border: 1px solid #bdcbd0;
  border-radius: 8px;
  color: #24373f;
  background: #fff;
}

.run-console button {
  padding: 10px 14px;
  border: 1px solid #176961;
  border-radius: 9px;
  color: #fff;
  background: #176961;
  cursor: pointer;
}

.run-console button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.run-console .run-console__button--quiet {
  color: #31515a;
  border-color: #b9c8cd;
  background: #fff;
}

.run-console__error {
  padding: 12px 15px;
  border: 1px solid #e3aaa3;
  border-radius: 10px;
  color: #8f2d24;
  background: #fff2f0;
}

.run-console__layout {
  display: grid;
  grid-template-columns: minmax(310px, 0.78fr) minmax(0, 1.8fr);
  gap: 18px;
  align-items: start;
}

.run-console__ledger,
.run-console__detail {
  border: 1px solid #d9e2e5;
  border-radius: 18px;
  background: #fff;
}

.run-console__ledger {
  padding: 16px;
}

.run-console__detail {
  min-height: 520px;
  padding: 22px;
}

.run-console__section-head,
.run-console__summary {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
}

.run-console__section-head h2,
.run-console__section-head h3,
.run-console__summary h2 {
  margin: 0;
}

.run-console__section-head small {
  color: #7a8b92;
}

.run-card {
  width: 100%;
  margin-top: 10px;
  padding: 13px;
  display: grid;
  gap: 6px;
  text-align: left;
  color: #263b43 !important;
  border-color: #d8e1e4 !important;
  background: #fff !important;
}

.run-card:hover,
.run-card--active {
  border-color: #2a8379 !important;
  box-shadow: inset 3px 0 #2a8379;
  background: #f2f8f7 !important;
}

.run-card__topline {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.run-card code,
.run-console__summary code {
  color: #728087;
  font-size: 10px;
  overflow-wrap: anywhere;
}

.run-card > span:not(.run-card__topline) {
  color: #718087;
  font-size: 11px;
}

.run-card .run-card__blocker {
  color: #9d4034 !important;
}

.status {
  padding: 4px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-style: normal;
  font-weight: 900;
  white-space: nowrap;
}

.status--ready {
  color: #176b44;
  background: #dff4e9;
}

.status--in_progress {
  color: #1b5e8c;
  background: #e1f0fa;
}

.status--awaiting_external_action,
.status--failed_retryable {
  color: #8a5510;
  background: #fff0ce;
}

.status--blocked {
  color: #9b332b;
  background: #fbe2df;
}

.status--not_run {
  color: #5f6870;
  background: #e8ecee;
}

.run-console__pager,
.run-console__actions {
  display: flex;
  gap: 9px;
}

.run-console__pager {
  margin-top: 14px;
  justify-content: flex-end;
}

.run-console__pager button {
  padding: 7px 10px;
  color: #31515a;
  border-color: #c5d1d5;
  background: #fff;
}

.run-console__empty {
  padding: 35px 20px;
  text-align: center;
  color: #76868d;
}

.run-console__facts {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 9px;
  margin: 20px 0;
}

.run-console__facts div {
  padding: 13px;
  border-radius: 10px;
  background: #f4f7f7;
}

.run-console__facts dt,
.image-task dt {
  color: #75858c;
  font-size: 10px;
  font-weight: 800;
}

.run-console__facts dd,
.image-task dd {
  margin: 5px 0 0;
}

.run-console__blockers,
.run-console__boundary {
  padding: 14px 17px;
  border-radius: 12px;
}

.run-console__blockers {
  color: #7f352e;
  border: 1px solid #efc4bf;
  background: #fff5f3;
}

.run-console__blockers h3,
.run-console__boundary h3 {
  margin: 0;
}

.run-console__blockers ul,
.run-console__boundary ul {
  margin-bottom: 0;
}

.run-console__stages,
.run-console__checkpoints,
.run-console__images,
.run-console__boundary {
  margin-top: 22px;
}

.run-console__stages ol {
  margin: 14px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(125px, 1fr));
  gap: 8px;
  list-style: none;
}

.stage {
  min-height: 135px;
  padding: 12px;
  border: 1px solid #d9e3e5;
  border-radius: 12px;
  background: #f9fbfb;
}

.stage__index {
  display: grid;
  width: 23px;
  height: 23px;
  place-items: center;
  margin-bottom: 10px;
  border-radius: 50%;
  color: #fff;
  background: #668087;
  font-size: 10px;
}

.stage div {
  display: grid;
  gap: 5px;
}

.stage em,
.stage small {
  color: #75858c;
  font-size: 10px;
  font-style: normal;
}

.stage--ready {
  border-color: #a9d8c2;
  background: #f2faf6;
}

.stage--ready .stage__index {
  background: #25835d;
}

.stage--blocked,
.stage--failed_retryable {
  border-color: #e7b8af;
  background: #fff6f4;
}

.checkpoint-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.checkpoint {
  padding: 13px;
  border: 1px solid #d9e3e5;
  border-radius: 12px;
  background: #f9fbfb;
}

.checkpoint header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.checkpoint p {
  margin: 9px 0 6px;
  color: #61747a;
  font-size: 11px;
}

.checkpoint > small,
.checkpoint > code {
  display: block;
  margin-top: 6px;
  color: #75858c;
  font-size: 10px;
  overflow-wrap: anywhere;
}

.checkpoint > code {
  width: fit-content;
  padding: 3px 6px;
  border-radius: 5px;
  color: #315b55;
  background: #e9f4f1;
}

.checkpoint--ready {
  border-color: #a9d8c2;
  background: #f2faf6;
}

.checkpoint--blocked,
.checkpoint--failed_retryable {
  border-color: #e7b8af;
  background: #fff6f4;
}

.run-console__provider-lock {
  padding: 6px 8px;
  border-radius: 7px;
  color: #356058;
  background: #e7f3ef;
  font-family: ui-monospace, monospace;
  font-size: 10px;
}

.image-task {
  margin-top: 8px;
  border: 1px solid #d9e2e5;
  border-radius: 10px;
}

.image-task summary {
  padding: 12px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.image-task > p,
.image-task > dl {
  margin: 0;
  padding: 0 12px 12px;
  color: #53676e;
  line-height: 1.6;
}

.image-task > dl {
  display: grid;
  gap: 8px;
}

.run-console__import {
  display: grid;
  gap: 7px;
  margin: 17px 0 9px;
  font-weight: 800;
}

.run-console__import textarea {
  width: 100%;
  padding: 12px;
  resize: vertical;
  border: 1px solid #bdcbd0;
  border-radius: 9px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}

.run-console__boundary {
  color: #495c64;
  background: #f2f5f6;
}

@media (max-width: 980px) {
  .run-console__hero,
  .run-console__pressure,
  .run-console__summary {
    align-items: stretch;
    flex-direction: column;
  }

  .run-console__filters {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .run-console__layout {
    grid-template-columns: 1fr;
  }

  .run-console__facts {
    grid-template-columns: repeat(2, 1fr);
  }

  .checkpoint-grid {
    grid-template-columns: 1fr;
  }
}
</style>
