<template>
  <div class="story-studio">
    <!-- Left panel: controls -->
    <aside class="story-studio__left">
      <h2 class="story-studio__page-title">故事生成工坊</h2>

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
        @select-type="handleSelectType"
        @select-event="handleSelectEvent"
      />

      <div v-if="planError" class="story-studio__error">{{ planError }}</div>

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
        {{ generating ? '正在生成…' : '生成故事' }}
      </button>

      <div v-if="generateError" class="story-studio__error">{{ generateError }}</div>
    </aside>

    <!-- Right panel: result -->
    <main class="story-studio__right">
      <div v-if="generating" class="story-studio__loading">
        <div class="story-studio__spinner" />
        <p class="story-studio__loading-text">正在生成故事，请稍候…</p>
      </div>

      <div v-else-if="generateResult">
        <StoryResult :result="generateResult" />
      </div>

      <div v-else class="story-studio__empty">
        <p>选择词条、预览推荐，然后生成故事。</p>
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
  SupportedDuration,
} from '@shared/types'
import StoryPlan from '@/components/StoryPlan.vue'
import StoryResult from '@/components/StoryResult.vue'

const route = useRoute()

// --- State ---
const entryName = ref('')
const selectedType = ref<GenerationType | null>(null)
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
  return entryName.value.trim() && selectedType.value
})

// --- Init from route query ---
onMounted(() => {
  const entry = route.query.entry as string | undefined
  if (entry) entryName.value = entry

  const type = route.query.type as string | undefined
  if (type && ['character_story', 'culture_promo', 'scene_short'].includes(type)) {
    selectedType.value = type as GenerationType
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
    // Auto-select the top recommended type
    if (!selectedType.value && res.data.recommended_types.length > 0) {
      selectedType.value = res.data.recommended_types[0].generation_type
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
}

function handleSelectEvent(event: string) {
  selectedEvent.value = event
}

async function handleGenerate() {
  if (!canGenerate.value) return
  generating.value = true
  generateError.value = ''
  generateResult.value = null

  const res = await storyGenerate({
    entry_name: entryName.value.trim(),
    generation_type: selectedType.value!,
    selected_event: selectedEvent.value ?? undefined,
    target_video_duration: targetDuration.value,
    tone: tone.value || undefined,
    output_gears_segments: true,
  })

  if (res.ok && res.data) {
    generateResult.value = res.data
  } else {
    generateError.value = res.error?.message ?? '故事生成失败'
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
</style>