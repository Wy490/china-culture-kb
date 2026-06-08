<template>
  <div class="story-studio">
    <!-- Left panel: controls -->
    <aside class="story-studio__left">
      <h2 class="story-studio__page-title">视频方案工坊</h2>

      <!-- Entry search + match -->
      <div class="story-studio__field">
        <label class="story-studio__label" for="entry-search">创作主题 / 词条搜索</label>
        <div class="story-studio__search-row">
          <input
            id="entry-search"
            v-model="entrySearchQuery"
            class="story-studio__input"
            placeholder="输入创作主题或词条关键词，如 周敦颐拒签冤案故事、湖南非遗宣传片、岳阳楼场景短片"
            @input="handleEntrySearchDebounced"
          />
          <button class="btn btn--search" @click="handleAutoMatch" :disabled="!entrySearchQuery.trim() || matching">
            {{ matching ? '匹配中…' : '自动匹配' }}
          </button>
        </div>

        <!-- Selected entry display -->
        <div v-if="selectedEntry" class="story-studio__selected-entry">
          <div v-if="autoMatchLabel" class="story-studio__auto-match-label">{{ autoMatchLabel }}</div>
          <div class="story-studio__selected-header">
            <span class="story-studio__selected-badge">{{ selectedEntry.type }}</span>
            <strong class="story-studio__selected-name">{{ selectedEntry.name }}</strong>
            <button class="story-studio__clear-btn" @click="clearSelectedEntry" title="取消选择">✕</button>
          </div>
          <p class="story-studio__selected-meta">{{ selectedEntry.province }} · {{ selectedEntry.region }}</p>
          <p class="story-studio__selected-summary">{{ selectedEntry.summary }}</p>
        </div>

        <!-- Match results (from POST /api/entries/match) -->
        <div v-if="matchResult && !selectedEntry" class="story-studio__search-results">
          <p class="story-studio__search-hint">
            {{ matchResult.matches.length > 0
              ? `为"${matchResult.query}"找到 ${matchResult.matches.length} 个相关词条：`
              : matchResult.fallback_message || '未找到相关词条' }}
          </p>
          <div
            v-for="m in matchResult.matches"
            :key="m.entry_name"
            class="story-studio__search-item"
            :class="{ 'story-studio__search-item--best': m.usable_for_story }"
            @click="handleSelectMatch(m)"
          >
            <div class="story-studio__search-item-header">
              <span class="story-studio__search-type">{{ m.type }}</span>
              <span class="story-studio__match-score">{{ (m.score * 100).toFixed(0) }}%匹配</span>
            </div>
            <strong class="story-studio__search-name">{{ m.entry_name }}</strong>
            <p class="story-studio__search-meta">{{ m.province }} · 匹配原因：{{ m.match_reason }}</p>
            <button
              class="btn btn--select-entry"
              :class="{ 'btn--select-entry--best': m.usable_for_story }"
            >
              {{ m.usable_for_story ? '✅ 选择此词条（推荐）' : '⭕ 选择此词条' }}
            </button>
          </div>
        </div>

        <!-- Fallback message when no good match -->
        <div v-if="matchResult && matchResult.matches.length === 0 && matchResult.fallback_message && !selectedEntry" class="story-studio__search-empty">
          <p>{{ matchResult.fallback_message }}</p>
        </div>

        <!-- Hint when no entry selected -->
        <div v-if="!selectedEntry && !matchResult && !matching && !entrySearchLoading" class="story-studio__entry-hint">
          <p>输入创作主题或词条关键词，点击"自动匹配"找到知识库中最相关的词条。</p>
        </div>
      </div>

      <!-- Preview button -->
      <button
        class="btn btn--primary"
        @click="handlePlan"
        :disabled="!selectedEntry || planning"
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

      <!-- Video type selector (grouped) — always visible -->
      <section class="story-studio__field">
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

      <!-- Presentation style selector — visible once video type selected -->
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
          <option value="8分钟">8分钟</option>
          <option value="10分钟">10分钟</option>
          <option value="15分钟">15分钟</option>
          <option value="20分钟">20分钟</option>
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

      <div v-if="!canGenerate && selectedVideoType && !selectedEntry" class="story-studio__generate-hint">
        请先从知识库搜索结果中选择一个词条，才能生成视频方案。
      </div>

      <div v-if="generateError" class="story-studio__error">{{ generateError }}</div>
    </aside>

    <!-- Right panel: result -->
    <main class="story-studio__right">
      <div v-if="generating" class="story-studio__loading">
        <div class="story-studio__spinner" />
        <p class="story-studio__loading-text">正在生成视频方案，请稍候…</p>
      </div>

      <div v-else-if="generateError && !generateResult" class="story-studio__result-error">
        <h3>生成失败</h3>
        <p>{{ generateError }}</p>
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storyPlan, storyGenerate } from '@/api/stories'
import { searchEntries, matchEntries } from '@/api/entries'
import type {
  EntrySearchResult,
  EntryMatchResult,
  EntryMatchItem,
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
const entrySearchQuery = ref('')
const selectedEntry = ref<EntrySearchResult | null>(null)
const originalUserQuery = ref('')
const entrySearchResults = ref<EntrySearchResult[]>([])
const entrySearchLoading = ref(false)
const entrySearchNoResults = ref(false)
const matching = ref(false)
const matchResult = ref<EntryMatchResult | null>(null)
const autoMatchLabel = ref('')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

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
  return selectedEntry.value && (selectedVideoType.value || selectedType.value)
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

// --- Entry search handlers ---
function handleEntrySearchDebounced() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    if (entrySearchQuery.value.trim()) {
      handleEntrySearch()
    } else {
      entrySearchResults.value = []
      entrySearchNoResults.value = false
    }
  }, 400)
}

async function handleEntrySearch() {
  const query = entrySearchQuery.value.trim()
  if (!query) return

  entrySearchLoading.value = true
  entrySearchNoResults.value = false
  entrySearchResults.value = []

  const res = await searchEntries({ keywords: query })
  if (res.ok && res.data) {
    entrySearchResults.value = res.data
    entrySearchNoResults.value = res.data.length === 0
  } else {
    entrySearchResults.value = []
    entrySearchNoResults.value = true
  }
  entrySearchLoading.value = false
}

function handleSelectEntry(entry: EntrySearchResult) {
  selectedEntry.value = entry
  originalUserQuery.value = ''
  autoMatchLabel.value = ''
  entrySearchResults.value = []
  entrySearchNoResults.value = false
  // Clear previous plan/generate state
  planResult.value = null
  planError.value = ''
  generateResult.value = null
  generateError.value = ''
}

function handleSelectMatch(m: EntryMatchItem) {
  // Convert match item to EntrySearchResult for the selected entry display
  // We need to search for the full entry to get summary etc
  selectedEntry.value = {
    name: m.entry_name,
    province: m.province,
    region: '',  // Will be filled when plan loads
    type: m.type,
    summary: m.match_reason,
    keywords: [],
    credibility: '',
  }
  originalUserQuery.value = entrySearchQuery.value.trim()
  if (m.usable_for_story) {
    autoMatchLabel.value = `已自动匹配到：${m.entry_name}（匹配度 ${(m.score * 100).toFixed(0)}%）`
  } else {
    autoMatchLabel.value = `已选择：${m.entry_name}（匹配度 ${(m.score * 100).toFixed(0)}%，请确认是否适合创作）`
  }
  matchResult.value = null
  // Clear previous plan/generate state
  planResult.value = null
  planError.value = ''
  generateResult.value = null
  generateError.value = ''
}

async function handleAutoMatch() {
  const query = entrySearchQuery.value.trim()
  if (!query) return

  matching.value = true
  matchResult.value = null
  entrySearchResults.value = []
  entrySearchNoResults.value = false

  const res = await matchEntries({
    query,
    limit: 5,
  })
  if (res.ok && res.data) {
    matchResult.value = res.data
    // Auto-select best_match if score >= 0.75
    if (res.data.best_match && res.data.best_match.score >= 0.75) {
      handleSelectMatch(res.data.best_match)
    }
  } else {
    planError.value = res.error?.message ?? '自动匹配失败'
  }
  matching.value = false
}

function clearSelectedEntry() {
  selectedEntry.value = null
  originalUserQuery.value = ''
  autoMatchLabel.value = ''
  planResult.value = null
  planError.value = ''
  generateResult.value = null
  generateError.value = ''
}

// --- Init from route query ---
onMounted(async () => {
  const entry = route.query.entry as string | undefined

  if (entry) {
    // Try to load the entry from the knowledge base
    entrySearchQuery.value = entry
    const res = await searchEntries({ keywords: entry })
    if (res.ok && res.data) {
      // Find exact match or first result
      const exactMatch = res.data.find(e => e.name === entry)
      if (exactMatch) {
        selectedEntry.value = exactMatch
      } else if (res.data.length > 0) {
        // If no exact match, use first result (user from detail page probably typed partial name)
        selectedEntry.value = res.data[0]
      } else {
        planError.value = '知识库中没有找到该词条，请先搜索并选择已有词条。'
      }
    } else {
      planError.value = '知识库中没有找到该词条，请先搜索并选择已有词条。'
    }
  }

  const type = route.query.type as string | undefined
  if (type && Object.keys(VIDEO_TYPE_CONFIG).includes(type)) {
    selectedVideoType.value = type as VideoType
    selectedPresentationStyle.value = VIDEO_TYPE_CONFIG[type as VideoType].default_presentation_style
  } else if (type && ['character_story', 'culture_promo', 'scene_short'].includes(type)) {
    selectedType.value = type as GenerationType
    selectedVideoType.value = type as VideoType
  }

  const vt = route.query.video_type as string | undefined
  if (vt && Object.keys(VIDEO_TYPE_CONFIG).includes(vt)) {
    selectedVideoType.value = vt as VideoType
    selectedPresentationStyle.value = VIDEO_TYPE_CONFIG[vt as VideoType].default_presentation_style
  }
})

// --- Handlers ---
async function handlePlan() {
  if (!selectedEntry.value) {
    planError.value = '请先从知识库搜索结果中选择一个词条。'
    return
  }
  planning.value = true
  planError.value = ''
  planResult.value = null

  const res = await storyPlan(selectedEntry.value.name, originalUserQuery.value || undefined)
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
    // Translate ENTRY_NOT_FOUND to user-friendly Chinese message
    const errorCode = res.error?.code
    if (errorCode === 'ENTRY_NOT_FOUND') {
      planError.value = '知识库中没有找到该词条，请先搜索并选择已有词条。'
    } else {
      planError.value = res.error?.message ?? '预览推荐失败'
    }
  }
  planning.value = false
}

function handleSelectType(type: GenerationType) {
  selectedType.value = type
  selectedVideoType.value = GENERATION_TO_VIDEO_TYPE[type] ?? type as VideoType
}

function handleSelectVideoType(vt: VideoType) {
  selectedVideoType.value = vt
  selectedPresentationStyle.value = VIDEO_TYPE_CONFIG[vt].default_presentation_style
}

function handleSelectEvent(event: string) {
  selectedEvent.value = event
}

async function handleGenerate() {
  if (!canGenerate.value) return
  if (!selectedEntry.value) {
    generateError.value = '请先从知识库搜索结果中选择一个词条。'
    return
  }
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
    entry_name: selectedEntry.value.name,
    original_user_query: originalUserQuery.value || undefined,
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
    // Translate ENTRY_NOT_FOUND to user-friendly Chinese message
    const errorCode = res.error?.code
    if (errorCode === 'ENTRY_NOT_FOUND') {
      generateError.value = '知识库中没有找到该词条，请先搜索并选择已有词条。'
    } else {
      generateError.value = res.error?.message ?? '视频方案生成失败'
    }
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

/* Auto-match label */
.story-studio__auto-match-label {
  margin-bottom: 6px;
  padding: 4px 10px;
  background: #d5f5e3;
  color: #27ae60;
  border-radius: 3px;
  font-size: 13px;
  font-weight: 600;
}

/* Search row */
.story-studio__search-row {
  display: flex;
  gap: 8px;
}
.story-studio__search-row .story-studio__input {
  flex: 1;
}

.btn--search {
  padding: 8px 16px;
  border: 1px solid #3498db;
  border-radius: 4px;
  background: #3498db;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}
.btn--search:hover:not(:disabled) { background: #2980b9; }
.btn--search:disabled { opacity: 0.5; cursor: not-allowed; }

/* Selected entry display */
.story-studio__selected-entry {
  margin-top: 10px;
  padding: 12px 14px;
  border: 2px solid #27ae60;
  border-radius: 6px;
  background: #eafaf1;
}
.story-studio__selected-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.story-studio__selected-badge {
  padding: 2px 8px;
  background: #d5f5e3;
  color: #27ae60;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
}
.story-studio__selected-name {
  font-size: 15px;
  color: #2c3e50;
}
.story-studio__clear-btn {
  margin-left: auto;
  padding: 2px 6px;
  border: none;
  background: transparent;
  color: #c0392b;
  font-size: 16px;
  cursor: pointer;
  border-radius: 3px;
}
.story-studio__clear-btn:hover { background: #fdecea; }
.story-studio__selected-meta {
  margin: 0;
  font-size: 13px;
  color: #7f8c8d;
}
.story-studio__selected-summary {
  margin: 4px 0 0 0;
  font-size: 14px;
  color: #34495e;
  line-height: 1.4;
}

/* Search results list */
.story-studio__search-results {
  margin-top: 10px;
}
.story-studio__search-hint {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #7f8c8d;
}
.story-studio__search-item {
  padding: 10px 14px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.story-studio__search-item:hover {
  border-color: #3498db;
  background: #eaf2f8;
}
.story-studio__search-item--best {
  border-color: #27ae60;
  background: #eafaf1;
}
.story-studio__search-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.story-studio__match-score {
  padding: 2px 6px;
  background: #d5f5e3;
  color: #27ae60;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
}
.story-studio__search-type {
  display: inline-block;
  padding: 2px 8px;
  background: #eaf2f8;
  color: #2980b9;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
}
.story-studio__search-name {
  display: block;
  font-size: 15px;
  color: #2c3e50;
  margin-bottom: 2px;
}
.story-studio__search-meta {
  margin: 0;
  font-size: 12px;
  color: #7f8c8d;
}
.story-studio__search-summary {
  margin: 4px 0 0 0;
  font-size: 13px;
  color: #34495e;
  line-height: 1.4;
}
.btn--select-entry {
  margin-top: 6px;
  padding: 6px 12px;
  border: 1px solid #27ae60;
  border-radius: 4px;
  background: transparent;
  color: #27ae60;
  font-size: 13px;
  cursor: pointer;
  font-weight: 600;
}
.btn--select-entry:hover {
  background: #27ae60;
  color: #fff;
}
.btn--select-entry--best {
  border-color: #27ae60;
  color: #27ae60;
  background: #eafaf1;
}

/* Search no results */
.story-studio__search-empty {
  margin-top: 10px;
  padding: 10px 14px;
  background: #fef9e7;
  color: #f39c12;
  border-radius: 4px;
  font-size: 14px;
}

/* Entry hint */
.story-studio__entry-hint {
  margin-top: 10px;
  padding: 8px 12px;
  background: #f8f9fa;
  color: #7f8c8d;
  border-radius: 4px;
  font-size: 13px;
}

/* Generate hint */
.story-studio__generate-hint {
  margin-top: 8px;
  padding: 8px 12px;
  background: #fef9e7;
  color: #f39c12;
  border-radius: 4px;
  font-size: 13px;
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

/* Result error in right panel */
.story-studio__result-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  padding: 30px;
  text-align: center;
}
.story-studio__result-error h3 { margin: 0 0 8px 0; color: #c0392b; font-size: 18px; }
.story-studio__result-error p { margin: 0; color: #7f8c8d; font-size: 14px; }

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