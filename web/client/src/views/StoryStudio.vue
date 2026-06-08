<template>
  <div class="story-studio">
    <!-- Left panel: controls -->
    <aside class="story-studio__left">
      <h2 class="story-studio__page-title">视频方案工坊</h2>

      <!-- Entry name input -->
      <div class="story-studio__field">
        <label class="story-studio__label" for="entry-name">词条名称</label>
        <input
          id="entry-name"
          v-model="entryName"
          class="story-studio__input"
          placeholder="输入词条名称，如 周敦颐——理学开山鼻祖"
        />
      </div>

      <!-- Preview button -->
      <button
        class="btn btn--primary"
        @click="handlePlan"
        :disabled="!entryName.trim() || planning"
      >
        {{ planning ? '正在预览…' : '预览推荐' }}
      </button>

      <!-- Plan result -->
      <StoryPlan
        v-if="planResult"
        :plan="planResult"
        :selected-type="selectedType"
        :selected-event="selectedEvent"
        :selected-video-type="selectedVideoType"
        @select-type="handleSelectType"
        @select-event="handleSelectEvent"
        @select-video-type="handleSelectVideoType"
      />

      <div v-if="planError" class="story-studio__error">{{ planError }}</div>

      <!-- Video type selector (grouped) -->
      <section v-if="planResult" class="story-studio__field">
        <label class="story-studio__label">成片类型</label>
        <div v-for="group in videoTypeGroups" :key="group.name" class="story-studio__vt-group">
          <h5 class="story-studio__vt-group-name">{{ group.name }}</h5>
          <div class="story-studio__vt-cards">
            <div
              v-for="vt in group.types"
              :key="vt.id"
              class="story-studio__vt-card"
              :class="{
                'story-studio__vt-card--selected': selectedVideoType === vt.id,
                'story-studio__vt-card--recommended': isRecommendedVideoType(vt.id),
              }"
              @click="handleSelectVideoType(vt.id)"
            >
              <span class="story-studio__vt-badge">{{ isRecommendedVideoType(vt.id) ? '✅ 推荐' : '⭕ 可选' }}</span>
              <span class="story-studio__vt-name">{{ vt.label }}</span>
              <span class="story-studio__vt-desc">{{ vt.description }}</span>
              <span class="story-studio__vt-duration">{{ vt.default_duration }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Presentation style selector -->
      <section v-if="selectedVideoType" class="story-studio__field">
        <label class="story-studio__label" for="presentation-style">表现形式</label>
        <select id="presentation-style" v-model="selectedPresentationStyle" class="story-studio__select">
          <option
            v-for="ps in presentationStyleOptions"
            :key="ps.id"
            :value="ps.id"
          >
            {{ ps.label }} — {{ ps.description }}
          </option>
        </select>
      </section>

      <!-- Duration select -->
      <div class="story-studio__field">
        <label class="story-studio__label" for="duration">目标时长</label>
        <select id="duration" v-model="targetDuration" class="story-studio__select">
          <option value="30秒">30秒</option>
          <option value="1分钟">1分钟</option>
          <option value="3分钟">3分钟</option>
          <option value="5分钟">5分钟</option>
        </select>
      </div>

      <!-- Tone input -->
      <div class="story-studio__field">
        <label class="story-studio__label" for="tone">叙事风格</label>
        <input
          id="tone"
          v-model="tone"
          class="story-studio__input"
          placeholder="如：庄重、抒情、诙谐（可选）"
        />
      </div>

      <!-- Generate button -->
      <button
        class="btn btn--primary btn--generate"
        @click="handleGenerate"
        :disabled="!canGenerate || generating"
      >
        {{ generating ? '正在生成…' : '生成视频方案' }}
      </button>

      <div v-if="generateError" class="story-studio__error">{{ generateError }}</div>
    </aside>

    <!-- Right panel: result -->
    <main class="story-studio__right">
      <div v-if="generating" class="story-studio__loading">
        <div class="story-studio__spinner" />
        <p class="story-studio__loading-text">正在生成视频方案，请稍候…</p>
      </div>

      <div v-else-if="generateResult">
        <StoryResult :result="generateResult" />
      </div>

      <div v-else class="story-studio__empty">
        <p>选择词条、预览推荐，然后生成视频方案。</p>
        <p class="story-studio__hint">结果将在此处展示。</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { storyPlan, storyGenerate } from '@/api/stories'
import type {
  StoryPlanResult,
  StoryGenerateResult,
  GenerationType,
  VideoType,
  PresentationStyle,
  SupportedDuration,
  VideoTypeGroup,
  VideoTypeMeta,
  PresentationStyleMeta,
} from '@shared/types'
import { VIDEO_TYPE_CONFIG, PRESENTATION_STYLE_CONFIG, GENERATION_TO_VIDEO_TYPE } from '@shared/types'
import StoryPlan from '@/components/StoryPlan.vue'
import StoryResult from '@/components/StoryResult.vue'

const route = useRoute()

// --- State ---
const entryName = ref('')
const selectedType = ref<GenerationType | null>(null)
const selectedVideoType = ref<VideoType | null>(null)
const selectedPresentationStyle = ref<PresentationStyle | null>(null)
const selectedEvent = ref<string | null>(null)
const targetDuration = ref<SupportedDuration>('3分钟')
const tone = ref('')
const planning = ref(false)
const generating = ref(false)
const planResult = ref<StoryPlanResult | null>(null)
const generateResult = ref<StoryGenerateResult | null>(null)
const planError = ref('')
const generateError = ref('')

const canGenerate = computed(() => {
  return entryName.value.trim() && (selectedVideoType.value || selectedType.value)
})

// --- VideoType group computed ---
const videoTypeGroups = computed(() => {
  const groups: { name: VideoTypeGroup; types: VideoTypeMeta[] }[] = []
  const seen = new Set<VideoTypeGroup>()
  for (const vt of Object.values(VIDEO_TYPE_CONFIG)) {
    if (!seen.has(vt.group)) {
      seen.add(vt.group)
      groups.push({ name: vt.group, types: [] })
    }
    groups.find(g => g.name === vt.group)?.types.push(vt)
  }
  return groups
})

const presentationStyleOptions = computed(() => {
  return Object.values(PRESENTATION_STYLE_CONFIG)
})

function isRecommendedVideoType(vtId: VideoType): boolean {
  if (!planResult.value) return false
  const recommended = planResult.value.recommended_video_types
  if (recommended.length === 0) return false
  return recommended[0].video_type === vtId
}

// --- Init from route query ---
onMounted(() => {
  const entry = route.query.entry as string | undefined
  if (entry) entryName.value = entry

  const type = route.query.type as string | undefined
  if (type && ['character_story', 'culture_promo', 'scene_short'].includes(type)) {
    selectedType.value = type as GenerationType
    selectedVideoType.value = type as VideoType
  }

  const vt = route.query.video_type as string | undefined
  if (vt && Object.keys(VIDEO_TYPE_CONFIG).includes(vt)) {
    selectedVideoType.value = vt as VideoType
  }
})

// --- Handlers ---
async function handlePlan() {
  if (!entryName.value.trim()) return
  planning.value = true
  planError.value = ''
  planResult.value = null

  const res = await storyPlan(entryName.value.trim())
  if (res.ok && res.data) {
    planResult.value = res.data
    // Auto-select the top recommended type (backward compat)
    if (!selectedType.value && res.data.recommended_types.length > 0) {
      selectedType.value = res.data.recommended_types[0].generation_type
    }
    // Auto-select the top recommended video type
    if (!selectedVideoType.value && res.data.recommended_video_types.length > 0) {
      selectedVideoType.value = res.data.recommended_video_types[0].video_type
    }
    // Auto-select recommended presentation style
    if (!selectedPresentationStyle.value && res.data.recommended_presentation_styles.length > 0) {
      selectedPresentationStyle.value = res.data.recommended_presentation_styles[0].presentation_style
    }
    // Auto-select recommended_duration
    targetDuration.value = res.data.recommended_duration
  } else {
    planError.value = res.error?.message ?? '预览推荐失败'
  }
  planning.value = false
}

function handleSelectType(type: GenerationType) {
  selectedType.value = type
  // Also update video_type for backward compat
  selectedVideoType.value = GENERATION_TO_VIDEO_TYPE[type] ?? type as VideoType
}

function handleSelectVideoType(vt: VideoType) {
  selectedVideoType.value = vt
  // Update presentation_style to default for this video type
  selectedPresentationStyle.value = VIDEO_TYPE_CONFIG[vt].default_presentation_style
}

function handleSelectEvent(event: string) {
  selectedEvent.value = event
}

async function handleGenerate() {
  if (!canGenerate.value) return
  generating.value = true
  generateError.value = ''
  generateResult.value = null

  // Resolve video_type: prefer selectedVideoType, fall back to selectedType mapping
  const videoTypeToSend = selectedVideoType.value ?? selectedType.value ?? 'character_story'
  const generationTypeToSend = selectedType.value ?? (
    videoTypeToSend === 'character_story' ? 'character_story'
    : videoTypeToSend === 'culture_promo' || videoTypeToSend === 'heritage_promo' || videoTypeToSend === 'city_brand_promo' ? 'culture_promo'
    : 'scene_short'
  )
  const presentationStyleToSend = selectedPresentationStyle.value ?? VIDEO_TYPE_CONFIG[videoTypeToSend as VideoType]?.default_presentation_style ?? 'cinematic'

  const res = await storyGenerate({
    entry_name: entryName.value.trim(),
    generation_type: generationTypeToSend as GenerationType,
    video_type: videoTypeToSend as VideoType,
    selected_event: selectedEvent.value ?? undefined,
    target_video_duration: targetDuration.value,
    tone: tone.value || undefined,
    presentation_style: presentationStyleToSend as PresentationStyle,
    output_gears_segments: true,
  })

  if (res.ok && res.data) {
    generateResult.value = res.data
  } else {
    generateError.value = res.error?.message ?? '视频方案生成失败'
  }
  generating.value = false
}
</script>

<style scoped>
.story-studio {
  display: flex;
  gap: 24px;
  min-height: calc(100vh - 80px);
}

.story-studio__left {
  width: 40%;
  min-width: 320px;
  padding-right: 16px;
  border-right: 1px solid #ecf0f1;
  overflow-y: auto;
}

.story-studio__right {
  width: 60%;
  flex: 1;
  overflow-y: auto;
}

.story-studio__page-title {
  margin: 0 0 20px 0;
  font-size: 22px;
  color: #2c3e50;
}

/* Fields */
.story-studio__field {
  margin-bottom: 14px;
}

.story-studio__label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
}

.story-studio__input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
  font-size: 15px;
  box-sizing: border-box;
}

.story-studio__input:focus {
  border-color: #3498db;
  outline: none;
}

.story-studio__select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
  font-size: 15px;
  background: #fff;
  box-sizing: border-box;
}

/* Buttons */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 15px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn:hover:not(:disabled) {
  opacity: 0.85;
}

.btn--primary {
  background: #2980b9;
  color: #fff;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--generate {
  margin-top: 16px;
  width: 100%;
  padding: 12px 20px;
  font-size: 16px;
  font-weight: 700;
}

/* Error */
.story-studio__error {
  margin-top: 10px;
  padding: 8px 12px;
  background: #fdecea;
  color: #c0392b;
  border-radius: 4px;
  font-size: 14px;
}

/* Loading */
.story-studio__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
}

.story-studio__spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #ecf0f1;
  border-top: 4px solid #2980b9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.story-studio__loading-text {
  margin-top: 16px;
  font-size: 16px;
  color: #7f8c8d;
}

/* Empty state */
.story-studio__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #95a5a6;
}

.story-studio__empty p {
  font-size: 16px;
  margin: 0;
}

.story-studio__hint {
  margin-top: 8px;
  font-size: 14px;
}

/* Video type groups */
.story-studio__vt-group { margin-bottom: 12px; }
.story-studio__vt-group-name { margin: 0 0 6px 0; font-size: 14px; color: #34495e; font-weight: 600; }
.story-studio__vt-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
.story-studio__vt-card { padding: 10px 14px; border: 2px solid #bdc3c7; border-radius: 6px; background: #fff; cursor: pointer; transition: border-color 0.2s, background 0.2s; }
.story-studio__vt-card:hover { border-color: #3498db; }
.story-studio__vt-card--selected { border-color: #2980b9; background: #eaf2f8; }
.story-studio__vt-card--recommended { border-color: #27ae60; }
.story-studio__vt-badge { display: inline-block; font-size: 13px; margin-bottom: 2px; }
.story-studio__vt-name { display: block; font-size: 15px; font-weight: 700; color: #2c3e50; margin-bottom: 2px; }
.story-studio__vt-desc { display: block; font-size: 12px; color: #7f8c8d; }
.story-studio__vt-duration { display: block; font-size: 12px; color: #3498db; margin-top: 2px; }
</style>