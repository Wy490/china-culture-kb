<template>
  <section class="baseline-workbench">
    <header class="baseline-workbench__heading">
      <div>
        <p>Machine-only comparison</p>
        <h2>Reference-free Baseline 对照</h2>
      </div>
      <span>
        {{ baselineCandidates.length }} candidates ·
        {{ completedComparisons.length }} completed
      </span>
    </header>

    <div class="baseline-workbench__boundary">
      这里读取已持久化故事的机器质量报告。Baseline 必须未注入参考规则；
      assisted 生成前服务端会再次校验同来源输入、类型、表现、结构、模型、中心事件与时长。
      Delta 只代表机器指标差值，固定不授予真人评审或生产信用。
    </div>

    <p v-if="loading" class="baseline-workbench__state">正在读取最近故事与比较报告…</p>
    <p v-else-if="error" class="baseline-workbench__state baseline-workbench__state--error" role="alert">
      {{ error }}
    </p>

    <template v-else>
      <div class="baseline-workbench__summary">
        <article>
          <span>已检查故事</span>
          <strong>{{ inspectedCount }}</strong>
        </article>
        <article>
          <span>Reference-free 候选</span>
          <strong>{{ baselineCandidates.length }}</strong>
        </article>
        <article>
          <span>完成机器对照</span>
          <strong>{{ completedComparisons.length }}</strong>
        </article>
      </div>

      <p v-if="truncated" class="baseline-workbench__notice">
        为保持页面有界，仅检查最新 {{ storyLimit }} 条可访问故事。
      </p>
      <p v-if="warning" class="baseline-workbench__notice">{{ warning }}</p>

      <div class="baseline-workbench__columns">
        <article class="baseline-workbench__panel">
          <h3>可用 Baseline</h3>
          <p>仅列出有机器质量报告、且未发生 reference prompt injection 的故事。</p>
          <div v-if="baselineCandidates.length" class="baseline-workbench__list">
            <section v-for="story in baselineCandidates" :key="story.storyId">
              <div>
                <strong>{{ story.title }}</strong>
                <small>{{ story.storyId }}</small>
                <span>
                  {{ videoTypeLabel(story.video_type) }}
                  · {{ story.presentation_style }}
                  · {{ story.model_profile_id }}
                </span>
              </div>
              <div class="baseline-workbench__actions">
                <RouterLink :to="`/story/${story.storyId}`">查看</RouterLink>
                <RouterLink
                  v-if="canCreateStory"
                  :to="{
                    path: '/story/new',
                    query: { reference_baseline_story_id: story.storyId },
                  }"
                >
                  创建同输入对照
                </RouterLink>
                <span v-else>当前角色仅审阅</span>
              </div>
            </section>
          </div>
          <p v-else class="baseline-workbench__empty">暂无可用 reference-free baseline。</p>
        </article>

        <article class="baseline-workbench__panel">
          <h3>已完成对照</h3>
          <p>展示服务端已经验证 same-input 的机器质量 delta。</p>
          <div v-if="completedComparisons.length" class="baseline-workbench__list">
            <section v-for="item in completedComparisons" :key="item.story.storyId">
              <div>
                <strong>{{ item.story.title }}</strong>
                <small>
                  {{ item.comparison.baseline_story_id }}
                  → {{ item.comparison.reference_assisted_story_id }}
                </small>
                <span>
                  {{ formatScore(item.comparison.quality_delta!.baseline_machine_score) }}
                  → {{ formatScore(item.comparison.quality_delta!.reference_assisted_machine_score) }}
                  <b :class="deltaClass(item.comparison.quality_delta!.aggregate_delta)">
                    {{ formatDelta(item.comparison.quality_delta!.aggregate_delta) }}
                  </b>
                </span>
              </div>
              <details>
                <summary>查看维度</summary>
                <dl>
                  <div
                    v-for="dimension in item.comparison.quality_delta!.dimensions"
                    :key="dimension.dimension"
                  >
                    <dt>{{ dimensionLabel(dimension.dimension) }}</dt>
                    <dd>
                      {{ formatScore(dimension.baseline_score) }}
                      → {{ formatScore(dimension.reference_assisted_score) }}
                      · {{ formatDelta(dimension.delta) }}
                    </dd>
                  </div>
                </dl>
              </details>
              <div class="baseline-workbench__actions">
                <RouterLink :to="`/story/${item.story.storyId}`">查看 assisted 故事</RouterLink>
                <span>comparison_credit_granted = false</span>
              </div>
            </section>
          </div>
          <p v-else class="baseline-workbench__empty">暂无已完成 baseline comparison。</p>
        </article>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  VIDEO_TYPE_CONFIG,
  type StoryGenerateResult,
  type StoryReferenceBaselineComparison,
  type StoryReferenceBaselineQualityDimension,
} from '@shared/types'
import { getStory, listStories } from '@/api/stories'

const props = defineProps<{
  canCreateStory: boolean
  refreshKey: number
}>()

const storyLimit = 40
const stories = ref<StoryGenerateResult[]>([])
const inspectedCount = ref(0)
const truncated = ref(false)
const loading = ref(false)
const error = ref('')
const warning = ref('')

const baselineCandidates = computed(() => stories.value.filter(story => (
  Boolean(story.quality_report)
  && Boolean(story.model_profile_id)
  && Boolean(story.story_structure)
  && Boolean(story.story_blueprint?.central_event)
  && !story.reference_safety_report?.application.applied_to_generation
  && !story.reference_trace?.some(trace => trace.application_status === 'external_prompt_injected')
)))

const completedComparisons = computed<Array<{
  story: StoryGenerateResult
  comparison: StoryReferenceBaselineComparison & {
    status: 'completed'
    quality_delta: NonNullable<StoryReferenceBaselineComparison['quality_delta']>
  }
}>>(() => stories.value.flatMap(story => {
  const comparison = story.reference_safety_report?.baseline_comparison
  if (comparison?.status !== 'completed' || !comparison.quality_delta) return []
  return [{
    story,
    comparison: comparison as StoryReferenceBaselineComparison & {
      status: 'completed'
      quality_delta: NonNullable<StoryReferenceBaselineComparison['quality_delta']>
    },
  }]
}))

async function loadBaselineLedger(): Promise<void> {
  loading.value = true
  error.value = ''
  warning.value = ''
  const listResponse = await listStories()
  if (!listResponse.ok || !listResponse.data) {
    loading.value = false
    error.value = listResponse.error?.message ?? '读取故事列表失败'
    return
  }
  truncated.value = listResponse.data.length > storyLimit
  const candidates = listResponse.data.slice(0, storyLimit)
  const details = await Promise.all(candidates.map(item => getStory(item.storyId)))
  stories.value = details.flatMap(response => response.ok && response.data ? [response.data] : [])
  inspectedCount.value = stories.value.length
  loading.value = false
  const failedCount = details.length - stories.value.length
  if (failedCount > 0) {
    warning.value = `${failedCount} 条故事详情因权限或存储状态无法读取。`
  }
}

function videoTypeLabel(videoType: StoryGenerateResult['video_type']): string {
  return VIDEO_TYPE_CONFIG[videoType]?.label ?? videoType
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2)
}

function formatDelta(value: number): string {
  return `${value > 0 ? '+' : ''}${formatScore(value)}`
}

function deltaClass(value: number): string {
  if (value > 0) return 'baseline-workbench__positive'
  if (value < 0) return 'baseline-workbench__negative'
  return ''
}

function dimensionLabel(
  dimension: StoryReferenceBaselineQualityDimension['dimension'],
): string {
  return {
    core_story_checks: '核心故事检查',
    genre_score: '类型质量',
    pattern_score: '叙事模式',
    outline_coverage: '大纲覆盖',
    family_quality_checks: '类型族检查',
    story_publishable: '故事可发布',
  }[dimension]
}

watch(
  () => props.refreshKey,
  () => void loadBaselineLedger(),
  { immediate: true },
)
</script>

<style scoped>
.baseline-workbench {
  margin: 16px 0;
  padding: 20px;
  border: 1px solid #35332e;
  border-radius: 16px;
  background: #171918;
  color: #e7e2d7;
}

.baseline-workbench__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.baseline-workbench__heading p {
  margin: 0 0 7px;
  color: #77bba8;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.baseline-workbench h2,
.baseline-workbench h3 {
  margin: 0;
}

.baseline-workbench__heading > span {
  color: #8d948e;
  font: 11px/1.5 ui-monospace, monospace;
  text-align: right;
}

.baseline-workbench__boundary {
  margin: 14px 0;
  padding: 11px 13px;
  border-left: 3px solid #77bba8;
  background: rgba(83, 157, 137, 0.1);
  color: #b7c1bb;
  font-size: 12px;
  line-height: 1.65;
}

.baseline-workbench__summary,
.baseline-workbench__columns {
  display: grid;
  gap: 10px;
}

.baseline-workbench__summary {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.baseline-workbench__summary article {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid #303732;
  border-radius: 10px;
  background: #202522;
}

.baseline-workbench__summary span,
.baseline-workbench__panel > p,
.baseline-workbench__state,
.baseline-workbench__notice,
.baseline-workbench__empty {
  color: #929b95;
  font-size: 11px;
}

.baseline-workbench__summary strong {
  color: #8ed3bf;
  font-size: 24px;
}

.baseline-workbench__columns {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 12px;
}

.baseline-workbench__panel {
  min-width: 0;
  padding: 15px;
  border: 1px solid #303732;
  border-radius: 12px;
  background: #202522;
}

.baseline-workbench__list {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.baseline-workbench__list > section {
  display: grid;
  gap: 9px;
  padding: 11px;
  border: 1px solid #343c37;
  border-radius: 9px;
  background: #171a18;
}

.baseline-workbench__list > section > div:first-child {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.baseline-workbench__list small {
  overflow-wrap: anywhere;
  color: #747d77;
  font: 10px/1.5 ui-monospace, monospace;
}

.baseline-workbench__list span,
.baseline-workbench__list dd,
.baseline-workbench__list dt {
  color: #9ca69f;
  font-size: 11px;
}

.baseline-workbench__list b {
  margin-left: 5px;
}

.baseline-workbench__positive {
  color: #77d6aa !important;
}

.baseline-workbench__negative,
.baseline-workbench__state--error {
  color: #ff9d8e !important;
}

.baseline-workbench__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.baseline-workbench__actions a {
  padding: 6px 9px;
  border-radius: 7px;
  background: #315d51;
  color: #dff7ef;
  font-size: 11px;
  text-decoration: none;
}

.baseline-workbench details summary {
  cursor: pointer;
  color: #87bcae;
  font-size: 11px;
}

.baseline-workbench dl {
  display: grid;
  gap: 4px;
}

.baseline-workbench dl div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.baseline-workbench dd {
  margin: 0;
  text-align: right;
}

@media (max-width: 980px) {
  .baseline-workbench__columns {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .baseline-workbench__heading {
    flex-direction: column;
  }

  .baseline-workbench__summary {
    grid-template-columns: 1fr;
  }
}
</style>
