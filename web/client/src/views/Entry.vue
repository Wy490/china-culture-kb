<template>
  <div class="entry-page">
    <div v-if="loading" class="entry-page__loading">
      <div class="entry-page__spinner" />
      <p>正在加载条目详情…</p>
    </div>

    <div v-else-if="error" class="entry-page__error">{{ error }}</div>

    <div v-else-if="entry">
      <!-- Header -->
      <header class="entry-page__header">
        <span class="entry-page__type-badge">{{ entry.type }}</span>
        <h1 class="entry-page__name">{{ entry.name }}</h1>
        <p class="entry-page__meta">
          {{ entry.province }} · {{ entry.region }}
        </p>
      </header>

      <!-- Credibility visualization -->
      <section class="entry-page__credibility-section">
        <span class="entry-page__credibility-badge" :class="credibilityClass">
          {{ entry.credibility }}
        </span>
        <span v-if="entry.verificationMethod" class="entry-page__verification">
          {{ entry.verificationMethod }}
        </span>
      </section>

      <!-- Summary -->
      <section class="entry-page__section">
        <h2 class="entry-page__section-title">简介</h2>
        <p class="entry-page__summary">{{ entry.summary }}</p>
      </section>

      <!-- Story -->
      <section class="entry-page__section">
        <h2 class="entry-page__section-title">故事梗概</h2>
        <div class="entry-page__story">
          <p v-for="(para, i) in storyParagraphs" :key="i" v-html="para" />
        </div>
      </section>

      <!-- Cultural significance -->
      <section class="entry-page__section">
        <h2 class="entry-page__section-title">文化意义</h2>
        <p class="entry-page__significance">{{ entry.culturalSignificance }}</p>
      </section>

      <!-- Related locations -->
      <section v-if="entry.relatedLocations.length > 0" class="entry-page__section">
        <h2 class="entry-page__section-title">相关地点</h2>
        <ul class="entry-page__locations">
          <li v-for="loc in entry.relatedLocations" :key="loc.name">
            <strong>{{ loc.name }}</strong> — {{ loc.description }}
          </li>
        </ul>
      </section>

      <!-- Keywords -->
      <section v-if="entry.keywords.length > 0" class="entry-page__section">
        <h2 class="entry-page__section-title">关键词</h2>
        <div class="entry-page__keywords">
          <span v-for="kw in entry.keywords" :key="kw" class="entry-page__keyword">{{ kw }}</span>
        </div>
      </section>

      <!-- Sources -->
      <section class="entry-page__section">
        <h2 class="entry-page__section-title">来源</h2>
        <ul class="entry-page__sources">
          <li v-for="src in entry.sources" :key="src">{{ src }}</li>
        </ul>
      </section>

      <!-- Unverified points -->
      <section v-if="entry.unverifiedPoints.length > 0" class="entry-page__section">
        <h2 class="entry-page__section-title">待核实点</h2>
        <ul class="entry-page__unverified">
          <li v-for="pt in entry.unverifiedPoints" :key="pt">{{ pt }}</li>
        </ul>
      </section>

      <!-- Generate story buttons -->
      <section class="entry-page__generate-section">
        <h2 class="entry-page__section-title">生成故事</h2>
        <div class="entry-page__generate-buttons">
          <RouterLink
            class="btn btn--generate btn--recommended"
            :to="`/story/new?entry=${encodeURIComponent(entry.name)}&type=character_story`"
          >
            ✅ 生成人物故事（推荐）
          </RouterLink>
          <RouterLink
            class="btn btn--generate btn--optional"
            :to="`/story/new?entry=${encodeURIComponent(entry.name)}&type=culture_promo`"
          >
            ⭕ 生成文化宣传片
          </RouterLink>
          <RouterLink
            class="btn btn--generate btn--optional"
            :to="`/story/new?entry=${encodeURIComponent(entry.name)}&type=scene_short`"
          >
            ⭕ 生成场景短片
          </RouterLink>
        </div>
      </section>
    </div>

    <!-- No entry name provided -->
    <div v-if="!entryName" class="entry-page__empty">
      <p>请从搜索结果或省份页面进入条目详情。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getEntryDetail } from '@/api/entries'
import type { EntryDetail } from '@shared/types'

const route = useRoute()

const entryName = ref('')
const entry = ref<EntryDetail | null>(null)
const loading = ref(false)
const error = ref('')

const credibilityClass = computed(() => {
  if (!entry.value) return ''
  const map: Record<string, string> = {
    '可靠': 'entry-page__credibility-badge--reliable',
    '基本可靠': 'entry-page__credibility-badge--mostly',
    '待核实': 'entry-page__credibility-badge--pending',
    '存疑': 'entry-page__credibility-badge--doubt',
    '混合': 'entry-page__credibility-badge--mixed',
  }
  // Check if credibility starts with "混合"
  const cred = entry.value.credibility
  if (cred.startsWith('混合')) return map['混合']
  return map[cred] ?? ''
})

const storyParagraphs = computed(() => {
  if (!entry.value?.story) return []
  return entry.value.story
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => renderSimpleMarkdown(p.trim()))
})

function renderSimpleMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

async function loadEntry(name: string) {
  if (!name) return
  entryName.value = name
  loading.value = true
  error.value = ''
  entry.value = null

  const res = await getEntryDetail(name)
  if (res.ok && res.data) {
    entry.value = res.data
  } else {
    error.value = res.error?.message ?? '加载条目失败'
  }
  loading.value = false
}

onMounted(() => {
  const name = route.query.name as string | undefined
  if (name) loadEntry(name)
})

watch(() => route.query.name, (newName) => {
  if (newName && typeof newName === 'string') {
    loadEntry(newName)
  }
})
</script>

<style scoped>
.entry-page {
  max-width: 800px;
  margin: 0 auto;
}

/* Header */
.entry-page__header {
  margin-bottom: 20px;
}

.entry-page__type-badge {
  display: inline-block;
  padding: 4px 10px;
  background: #eaf2f8;
  color: #2980b9;
  border-radius: 3px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}

.entry-page__name {
  margin: 0 0 4px 0;
  font-size: 26px;
  font-weight: 700;
  color: #2c3e50;
  line-height: 1.3;
}

.entry-page__meta {
  margin: 0;
  font-size: 14px;
  color: #7f8c8d;
}

/* Credibility */
.entry-page__credibility-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding: 10px 14px;
  background: #f8f9fa;
  border-radius: 6px;
}

.entry-page__credibility-badge {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
}

.entry-page__credibility-badge--reliable {
  background: #d5f5e3;
  color: #27ae60;
}

.entry-page__credibility-badge--mostly {
  background: #d6eaf8;
  color: #2980b9;
}

.entry-page__credibility-badge--pending {
  background: #fef9e7;
  color: #f39c12;
}

.entry-page__credibility-badge--doubt {
  background: #fdecea;
  color: #c0392b;
}

.entry-page__credibility-badge--mixed {
  background: #f5eef8;
  color: #8e44ad;
}

.entry-page__verification {
  font-size: 13px;
  color: #7f8c8d;
}

/* Sections */
.entry-page__section {
  margin-bottom: 20px;
}

.entry-page__section-title {
  margin: 0 0 10px 0;
  font-size: 18px;
  color: #2c3e50;
  border-bottom: 1px solid #ecf0f1;
  padding-bottom: 4px;
}

.entry-page__summary {
  font-size: 15px;
  line-height: 1.6;
  color: #34495e;
  margin: 0;
}

.entry-page__story p {
  margin: 0 0 12px 0;
  font-size: 15px;
  line-height: 1.7;
  color: #34495e;
}

.entry-page__significance {
  font-size: 15px;
  line-height: 1.6;
  color: #34495e;
  margin: 0;
}

/* Locations */
.entry-page__locations {
  padding-left: 20px;
  margin: 0;
}

.entry-page__locations li {
  font-size: 14px;
  line-height: 1.6;
  color: #34495e;
  margin-bottom: 6px;
}

/* Keywords */
.entry-page__keywords {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.entry-page__keyword {
  padding: 4px 10px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 3px;
  font-size: 13px;
  color: #6c757d;
}

/* Sources */
.entry-page__sources {
  padding-left: 20px;
  margin: 0;
}

.entry-page__sources li {
  font-size: 14px;
  color: #34495e;
  margin-bottom: 4px;
}

/* Unverified */
.entry-page__unverified {
  padding-left: 20px;
  margin: 0;
}

.entry-page__unverified li {
  font-size: 14px;
  color: #f39c12;
  margin-bottom: 4px;
}

/* Generate buttons */
.entry-page__generate-section {
  margin: 30px 0 20px 0;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 2px solid #ecf0f1;
}

.entry-page__generate-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  font-size: 15px;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.2s;
  display: inline-flex;
  align-items: center;
}

.btn:hover:not(:disabled) {
  opacity: 0.85;
}

.btn--generate {
  padding: 12px 20px;
  font-size: 16px;
  font-weight: 600;
}

.btn--recommended {
  background: #27ae60;
  color: #fff;
}

.btn--optional {
  background: #fff;
  border: 2px solid #bdc3c7;
  color: #7f8c8d;
}

.btn--optional:hover {
  border-color: #3498db;
  color: #3498db;
}

/* Loading */
.entry-page__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: #7f8c8d;
}

.entry-page__spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #ecf0f1;
  border-top: 3px solid #2980b9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Error */
.entry-page__error {
  padding: 10px 14px;
  background: #fdecea;
  color: #c0392b;
  border-radius: 4px;
  font-size: 14px;
}

/* Empty */
.entry-page__empty {
  text-align: center;
  padding: 40px 20px;
  color: #95a5a6;
  font-size: 16px;
}
</style>