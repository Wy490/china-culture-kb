<template>
  <section class="composition">
    <header class="composition__heading">
      <div>
        <p>Benchmark composition</p>
        <h2>Benchmark 与 Style Pack 组合</h2>
      </div>
      <span>
        {{ approvedAnalyses.length }} approved analyses ·
        {{ benchmarks.length }} benchmarks · {{ stylePacks.length }} style packs
      </span>
    </header>

    <div class="composition__boundary">
      组合记录创建即代表签署批准，因此公共 API 只接受 <code>material:sign</code> 角色，
      且 <code>created_by</code> 与 <code>approved_by</code> 必须匹配认证 actor。
      组合只提炼抽象原则和 avoid-copying 边界，不保存来源正文。
    </div>

    <p v-if="loadError" class="composition__notice composition__notice--error" role="alert">
      {{ loadError }}
    </p>
    <p v-if="loading" class="composition__empty">正在读取跨来源组合账本…</p>

    <template v-else>
      <div class="composition__ledger">
        <article>
          <strong>可组合分析</strong>
          <span>{{ approvedAnalyses.length }}</span>
          <small>必须覆盖至少两个不同来源</small>
        </article>
        <article>
          <strong>Benchmark</strong>
          <span>{{ benchmarks.length }}</span>
          <small>单一目标类型与质量维度</small>
        </article>
        <article>
          <strong>Style Pack</strong>
          <span>{{ stylePacks.length }}</span>
          <small>兼容范围完整后才能进入生成桥</small>
        </article>
      </div>

      <p v-if="!canCompose" class="composition__readonly">
        当前角色可读取组合账本，但没有 <code>material:sign</code> 权限，不能创建已批准记录。
      </p>

      <div class="composition__forms">
        <article class="composition__card">
          <p class="composition__kicker">Step 1</p>
          <h3>创建 Approved Benchmark</h3>
          <p class="composition__helper">
            请选择来自至少两个不同来源的已批准 analysis。Evidence refs 与所选 analyses 保持一致。
          </p>

          <div class="composition__choices" aria-label="已批准 analysis">
            <label v-for="item in approvedAnalyses" :key="item.analysis.analysis_id">
              <input
                v-model="selectedAnalysisIds"
                name="benchmark_analysis_ids"
                type="checkbox"
                :value="item.analysis.analysis_id"
                :disabled="!canCompose"
              >
              <span>
                <strong>{{ item.source.title }}</strong>
                <small>
                  {{ item.analysis.analysis_type === 'film' ? '影视' : '文本' }}
                  · {{ item.analysis.analysis_id }}
                </small>
              </span>
            </label>
            <p v-if="approvedAnalyses.length === 0">暂无已批准 analysis。</p>
          </div>

          <div class="composition__grid">
            <label>
              目标成片类型
              <select v-model="targetVideoType" name="benchmark_target_video_type" :disabled="!canCompose">
                <option v-for="option in videoTypeOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
            <label>
              提炼维度
              <select v-model="targetDimension" name="benchmark_target_dimension" :disabled="!canCompose">
                <option value="hook">钩子</option>
                <option value="character">人物</option>
                <option value="scene">场景</option>
                <option value="visual">视觉</option>
                <option value="audio">声音</option>
                <option value="promo">宣传</option>
              </select>
            </label>
          </div>
          <label>
            抽象可复用原则
            <textarea
              v-model.trim="principle"
              name="benchmark_principle"
              rows="3"
              maxlength="1000"
              :disabled="!canCompose"
            />
          </label>
          <dl class="composition__preflight">
            <div><dt>选中 analyses</dt><dd>{{ selectedAnalysisIds.length }}</dd></div>
            <div><dt>不同来源</dt><dd>{{ selectedReferenceCount }}</dd></div>
            <div><dt>签署 actor</dt><dd>{{ actorId }}</dd></div>
          </dl>
          <label class="composition__confirmation">
            <input
              v-model="benchmarkConfirmed"
              name="benchmark_human_confirmation"
              type="checkbox"
              :disabled="!canCompose"
            >
            <span>我已人工审核所选 analyses，并批准将该抽象原则写入 benchmark。</span>
          </label>
          <button type="button" :disabled="!canCreateBenchmark" @click="createBenchmark">
            {{ creatingBenchmark ? '正在组合…' : '创建 Approved Benchmark' }}
          </button>
        </article>

        <article class="composition__card">
          <p class="composition__kicker">Step 2</p>
          <h3>创建 Audited Style Pack</h3>
          <p class="composition__helper">
            Style Pack 只从已批准 benchmark 聚合原则；兼容类型必须覆盖所选 benchmark 的目标类型。
          </p>

          <div class="composition__choices" aria-label="已批准 benchmark">
            <label v-for="benchmark in benchmarks" :key="benchmark.benchmark_id">
              <input
                v-model="selectedBenchmarkIds"
                name="style_pack_benchmark_ids"
                type="checkbox"
                :value="benchmark.benchmark_id"
                :disabled="!canCompose"
              >
              <span>
                <strong>{{ videoTypeLabel(benchmark.target_video_type) }} · {{ benchmark.target_dimension }}</strong>
                <small>{{ benchmark.principle }}</small>
              </span>
            </label>
            <p v-if="benchmarks.length === 0">暂无 approved benchmark。</p>
          </div>

          <div class="composition__grid">
            <label>
              Style Pack 名称
              <input v-model.trim="stylePackName" name="style_pack_name" maxlength="200" :disabled="!canCompose">
            </label>
            <label>
              创建 / 批准 actor
              <input :value="actorId" name="style_pack_actor" disabled>
            </label>
          </div>
          <label>
            说明
            <textarea
              v-model.trim="stylePackDescription"
              name="style_pack_description"
              rows="3"
              maxlength="1000"
              :disabled="!canCompose"
            />
          </label>
          <div class="composition__grid composition__grid--three">
            <label>
              兼容成片类型
              <select
                v-model="compatibleVideoTypes"
                name="style_pack_video_types"
                multiple
                size="6"
                :disabled="!canCompose"
              >
                <option v-for="option in videoTypeOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
            <label>
              兼容表现形式
              <select
                v-model="compatiblePresentationStyles"
                name="style_pack_presentation_styles"
                multiple
                size="6"
                :disabled="!canCompose"
              >
                <option v-for="option in presentationStyleOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
            <label>
              兼容叙事结构
              <select
                v-model="compatibleStoryStructures"
                name="style_pack_story_structures"
                multiple
                size="6"
                :disabled="!canCompose"
              >
                <option v-for="option in storyStructureOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
          </div>
          <p v-if="missingTargetTypes.length" class="composition__warning">
            兼容成片类型还缺少：{{ missingTargetTypes.map(videoTypeLabel).join('、') }}
          </p>
          <label class="composition__confirmation">
            <input
              v-model="stylePackConfirmed"
              name="style_pack_human_confirmation"
              type="checkbox"
              :disabled="!canCompose"
            >
            <span>我已人工检查组合原则、兼容范围与 avoid-copying 边界，并批准创建 style pack。</span>
          </label>
          <button type="button" :disabled="!canCreateStylePack" @click="createStylePack">
            {{ creatingStylePack ? '正在组合…' : '创建 Audited Style Pack' }}
          </button>
        </article>
      </div>

      <p v-if="actionError" class="composition__notice composition__notice--error" role="alert">
        {{ actionError }}
      </p>
      <p v-if="notice" class="composition__notice" role="status">{{ notice }}</p>

      <details v-if="benchmarks.length || stylePacks.length" class="composition__records">
        <summary>查看已批准组合账本</summary>
        <div>
          <article v-for="benchmark in benchmarks" :key="benchmark.benchmark_id">
            <span>Benchmark</span>
            <strong>{{ benchmark.principle }}</strong>
            <small>{{ benchmark.benchmark_id }} · {{ benchmark.approval.approved_by }}</small>
          </article>
          <article v-for="stylePack in stylePacks" :key="stylePack.id">
            <span>Style Pack</span>
            <strong>{{ stylePack.name }}</strong>
            <small>{{ stylePack.id }} · {{ stylePack.source_benchmark_ids.length }} benchmark(s)</small>
          </article>
        </div>
      </details>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  PRESENTATION_STYLE_CONFIG,
  STORY_STRUCTURE_CONFIG,
  VIDEO_TYPE_CONFIG,
  type BenchmarkCard,
  type PresentationStyle,
  type ReferenceAnalysisRecord,
  type ReferenceSourceRecord,
  type ReferenceStylePackRecord,
  type StoryStructureType,
  type VideoType,
} from '@shared/types'
import {
  createReferenceBenchmarkCard,
  createReferenceStylePack,
  getReferenceLibraryDetail,
  listReferenceBenchmarkCards,
  listReferenceStylePacks,
} from '@/api/reference-library'

const props = defineProps<{
  sources: ReferenceSourceRecord[]
  canCompose: boolean
  actorId: string
  refreshKey: number
}>()

type ApprovedAnalysis = {
  source: ReferenceSourceRecord
  analysis: ReferenceAnalysisRecord & {
    approval: { status: 'approved'; approved_by: string; approved_at: string }
  }
}

const videoTypeOptions = Object.values(VIDEO_TYPE_CONFIG).map(item => ({
  value: item.id,
  label: item.label,
}))
const presentationStyleOptions = Object.values(PRESENTATION_STYLE_CONFIG).map(item => ({
  value: item.id,
  label: item.label,
}))
const storyStructureOptions = Object.values(STORY_STRUCTURE_CONFIG).map(item => ({
  value: item.id,
  label: item.label,
}))

const approvedAnalyses = ref<ApprovedAnalysis[]>([])
const benchmarks = ref<BenchmarkCard[]>([])
const stylePacks = ref<ReferenceStylePackRecord[]>([])
const selectedAnalysisIds = ref<string[]>([])
const selectedBenchmarkIds = ref<string[]>([])
const targetVideoType = ref<VideoType>('ai_comic_drama')
const targetDimension = ref<BenchmarkCard['target_dimension']>('hook')
const principle = ref('')
const benchmarkConfirmed = ref(false)
const stylePackName = ref('')
const stylePackDescription = ref('')
const compatibleVideoTypes = ref<VideoType[]>(['ai_comic_drama'])
const compatiblePresentationStyles = ref<PresentationStyle[]>(['ai_comic'])
const compatibleStoryStructures = ref<StoryStructureType[]>(['three_act_drama'])
const stylePackConfirmed = ref(false)
const loading = ref(false)
const creatingBenchmark = ref(false)
const creatingStylePack = ref(false)
const loadError = ref('')
const actionError = ref('')
const notice = ref('')

const selectedApprovedAnalyses = computed(() => (
  approvedAnalyses.value.filter(item => selectedAnalysisIds.value.includes(item.analysis.analysis_id))
))
const selectedReferenceCount = computed(() => (
  new Set(selectedApprovedAnalyses.value.map(item => item.source.reference_id)).size
))
const selectedBenchmarks = computed(() => (
  benchmarks.value.filter(item => selectedBenchmarkIds.value.includes(item.benchmark_id))
))
const requiredTargetTypes = computed(() => (
  [...new Set(selectedBenchmarks.value.map(item => item.target_video_type))]
))
const missingTargetTypes = computed(() => (
  requiredTargetTypes.value.filter(item => !compatibleVideoTypes.value.includes(item))
))
const canCreateBenchmark = computed(() => Boolean(
  props.canCompose
  && selectedAnalysisIds.value.length >= 2
  && selectedReferenceCount.value >= 2
  && principle.value
  && benchmarkConfirmed.value
  && !creatingBenchmark.value,
))
const canCreateStylePack = computed(() => Boolean(
  props.canCompose
  && selectedBenchmarkIds.value.length
  && stylePackName.value
  && stylePackDescription.value
  && compatibleVideoTypes.value.length
  && compatiblePresentationStyles.value.length
  && compatibleStoryStructures.value.length
  && missingTargetTypes.value.length === 0
  && stylePackConfirmed.value
  && !creatingStylePack.value,
))

function videoTypeLabel(videoType: VideoType): string {
  return VIDEO_TYPE_CONFIG[videoType].label
}

function retainAvailableSelections(): void {
  const analysisIds = new Set(approvedAnalyses.value.map(item => item.analysis.analysis_id))
  selectedAnalysisIds.value = selectedAnalysisIds.value.filter(id => analysisIds.has(id))
  const benchmarkIds = new Set(benchmarks.value.map(item => item.benchmark_id))
  selectedBenchmarkIds.value = selectedBenchmarkIds.value.filter(id => benchmarkIds.has(id))
}

async function loadCompositionLedger(): Promise<void> {
  loading.value = true
  loadError.value = ''
  const [benchmarkResponse, stylePackResponse, ...detailResponses] = await Promise.all([
    listReferenceBenchmarkCards(),
    listReferenceStylePacks(),
    ...props.sources.map(source => getReferenceLibraryDetail(source.reference_id)),
  ])
  loading.value = false
  const failedDetail = detailResponses.find(response => !response.ok || !response.data)
  if (
    !benchmarkResponse.ok
    || !benchmarkResponse.data
    || !stylePackResponse.ok
    || !stylePackResponse.data
    || failedDetail
  ) {
    loadError.value = (
      benchmarkResponse.error?.message
      ?? stylePackResponse.error?.message
      ?? failedDetail?.error?.message
      ?? '读取 Reference Library 组合账本失败'
    )
    return
  }
  benchmarks.value = benchmarkResponse.data
  stylePacks.value = stylePackResponse.data
  approvedAnalyses.value = detailResponses.flatMap(response => {
    if (!response.data) return []
    return response.data.analyses
      .filter((analysis): analysis is ApprovedAnalysis['analysis'] => (
        analysis.approval.status === 'approved'
      ))
      .map(analysis => ({ source: response.data!.source, analysis }))
  })
  retainAvailableSelections()
}

async function createBenchmark(): Promise<void> {
  if (!canCreateBenchmark.value) return
  actionError.value = ''
  notice.value = ''
  creatingBenchmark.value = true
  const response = await createReferenceBenchmarkCard({
    analysis_ids: [...selectedAnalysisIds.value],
    target_video_type: targetVideoType.value,
    target_dimension: targetDimension.value,
    principle: principle.value,
    evidence_refs: [...selectedAnalysisIds.value],
    created_by: props.actorId,
    approval: {
      approved_by: props.actorId,
      approved_at: new Date().toISOString(),
    },
  })
  creatingBenchmark.value = false
  if (!response.ok || !response.data) {
    actionError.value = response.error?.message ?? '创建 benchmark 失败'
    return
  }
  notice.value = `已创建 approved benchmark ${response.data.benchmark_id}。`
  selectedBenchmarkIds.value = [response.data.benchmark_id]
  compatibleVideoTypes.value = [
    ...new Set([...compatibleVideoTypes.value, response.data.target_video_type]),
  ]
  principle.value = ''
  benchmarkConfirmed.value = false
  await loadCompositionLedger()
}

async function createStylePack(): Promise<void> {
  if (!canCreateStylePack.value) return
  actionError.value = ''
  notice.value = ''
  creatingStylePack.value = true
  const response = await createReferenceStylePack({
    name: stylePackName.value,
    description: stylePackDescription.value,
    benchmark_card_ids: [...selectedBenchmarkIds.value],
    compatible_video_types: [...compatibleVideoTypes.value],
    compatible_presentation_styles: [...compatiblePresentationStyles.value],
    compatible_story_structures: [...compatibleStoryStructures.value],
    created_by: props.actorId,
    approval: {
      approved_by: props.actorId,
      approved_at: new Date().toISOString(),
    },
  })
  creatingStylePack.value = false
  if (!response.ok || !response.data) {
    actionError.value = response.error?.message ?? '创建 style pack 失败'
    return
  }
  notice.value = `已创建 audited style pack ${response.data.id}。`
  stylePackName.value = ''
  stylePackDescription.value = ''
  stylePackConfirmed.value = false
  await loadCompositionLedger()
}

watch(
  () => [
    props.refreshKey,
    props.sources.map(source => source.reference_id).join('|'),
  ],
  () => void loadCompositionLedger(),
  { immediate: true },
)

watch(requiredTargetTypes, values => {
  compatibleVideoTypes.value = [...new Set([...compatibleVideoTypes.value, ...values])]
})
</script>

<style scoped>
.composition {
  margin: 16px 0;
  padding: 20px;
  border: 1px solid #35332e;
  border-radius: 16px;
  background: #1c1c19;
  color: #e7e2d7;
}

.composition__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.composition__heading p,
.composition__kicker {
  margin: 0 0 7px;
  color: #d7a75d;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.composition h2,
.composition h3 {
  margin: 0;
}

.composition__heading > span {
  color: #847f76;
  font: 11px/1.5 ui-monospace, monospace;
  text-align: right;
}

.composition__boundary,
.composition__readonly {
  margin: 14px 0;
  padding: 11px 13px;
  border-left: 3px solid #d7a75d;
  background: rgba(215, 167, 93, 0.08);
  color: #b9b1a5;
  font-size: 12px;
  line-height: 1.6;
}

.composition__readonly {
  border-left-color: #6f91bd;
  background: rgba(83, 119, 164, 0.1);
}

.composition__ledger {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 14px 0;
}

.composition__ledger article {
  display: grid;
  gap: 5px;
  padding: 13px;
  border: 1px solid #38362f;
  border-radius: 10px;
  background: #23221e;
}

.composition__ledger span {
  color: #d7a75d;
  font-size: 24px;
  font-weight: 800;
}

.composition__ledger small,
.composition__helper,
.composition__choices small,
.composition__empty {
  color: #918a80;
  font-size: 11px;
  line-height: 1.55;
}

.composition__forms {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.composition__card {
  min-width: 0;
  padding: 16px;
  border: 1px solid #38362f;
  border-radius: 12px;
  background: #23221e;
}

.composition__choices {
  display: grid;
  max-height: 220px;
  gap: 7px;
  margin: 12px 0;
  overflow: auto;
}

.composition__choices label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 9px;
  border: 1px solid #3b3933;
  border-radius: 8px;
  background: #1c1c19;
}

.composition__choices label span {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.composition__choices small {
  overflow-wrap: anywhere;
}

.composition__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.composition__grid--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.composition label {
  display: block;
  margin: 10px 0;
  color: #aaa397;
  font-size: 12px;
}

.composition input:not([type='checkbox']),
.composition select,
.composition textarea {
  box-sizing: border-box;
  width: 100%;
  margin-top: 6px;
  padding: 9px 11px;
  border: 1px solid #444137;
  border-radius: 8px;
  background: #161614;
  color: #e7e2d7;
}

.composition select[multiple] {
  min-height: 130px;
}

.composition__preflight {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border-radius: 8px;
  background: #39362f;
}

.composition__preflight div {
  padding: 9px;
  background: #1c1c19;
}

.composition__preflight dt {
  color: #837e75;
  font-size: 10px;
}

.composition__preflight dd {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
  font-size: 11px;
}

.composition__confirmation {
  display: flex !important;
  align-items: flex-start;
  gap: 8px;
  margin: 13px 0 !important;
}

.composition button {
  padding: 10px 15px;
  border: 0;
  border-radius: 9px;
  background: #d6a85e;
  color: #191713;
  font-weight: 800;
  cursor: pointer;
}

.composition button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.composition__warning {
  color: #e4bd73;
  font-size: 12px;
}

.composition__notice {
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(73, 160, 106, 0.55);
  border-radius: 9px;
  color: #8bd9ac;
}

.composition__notice--error {
  border-color: rgba(211, 78, 62, 0.55);
  color: #ff9d8e;
}

.composition__records {
  margin-top: 14px;
  padding: 12px;
  border: 1px solid #39362f;
  border-radius: 10px;
}

.composition__records summary {
  cursor: pointer;
}

.composition__records > div {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.composition__records article {
  display: grid;
  gap: 5px;
  padding: 10px;
  border-radius: 8px;
  background: #23221e;
}

.composition__records span,
.composition__records small {
  color: #8f897f;
  font-size: 10px;
}

@media (max-width: 980px) {
  .composition__forms,
  .composition__grid--three {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .composition__heading {
    flex-direction: column;
  }

  .composition__heading > span {
    text-align: left;
  }

  .composition__ledger,
  .composition__grid,
  .composition__preflight,
  .composition__records > div {
    grid-template-columns: 1fr;
  }
}
</style>
