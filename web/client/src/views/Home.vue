<template>
  <div class="home">
    <!-- Hero section -->
    <section class="home__hero">
      <h1 class="home__hero-title">中国传统文化知识库</h1>
      <p class="home__hero-desc">浏览知识库、搜索条目、生成故事脚本</p>
      <RouterLink class="btn btn--primary btn--lg" to="/story/new">
        🎬 开始生成故事
      </RouterLink>
    </section>

    <!-- Quick search -->
    <section class="home__search">
      <form class="home__search-form" @submit.prevent="goSearch">
        <input
          v-model="searchQuery"
          class="home__search-input"
          placeholder="搜索词条名称、关键词、地区…"
        />
        <button class="btn btn--primary" type="submit">搜索</button>
      </form>
    </section>

    <!-- Stats -->
    <section v-if="provinces.length > 0" class="home__stats">
      <h2 class="home__section-title">知识库概览</h2>
      <div class="home__stats-grid">
        <div class="home__stat-card">
          <span class="home__stat-number">{{ totalEntries }}</span>
          <span class="home__stat-label">总条目数</span>
        </div>
        <div class="home__stat-card">
          <span class="home__stat-number">{{ provinces.length }}</span>
          <span class="home__stat-label">覆盖省份</span>
        </div>
        <div class="home__stat-card">
          <span class="home__stat-number">{{ recentStories.length }}</span>
          <span class="home__stat-label">已生成故事</span>
        </div>
      </div>
    </section>

    <!-- Recent stories -->
    <section v-if="recentStories.length > 0" class="home__recent">
      <h2 class="home__section-title">最近生成故事</h2>
      <div class="home__recent-list">
        <RouterLink
          v-for="story in recentStories"
          :key="story.storyId"
          class="home__story-card"
          :to="`/story/${story.storyId}`"
        >
          <span class="home__story-type-badge">{{ typeLabel(story.generation_type) }}</span>
          <h3 class="home__story-title">{{ story.title }}</h3>
          <p class="home__story-source">来源: {{ story.source_entry }}</p>
          <p v-if="story.logline" class="home__story-logline">{{ story.logline }}</p>
          <div class="home__story-meta-row">
            <span v-if="story.created_at" class="home__story-date">{{ formatDate(story.created_at) }}</span>
            <span v-if="story.has_gears_segments" class="home__story-gears-badge">✅ GEARS</span>
            <span v-else class="home__story-gears-badge--none">⭕ 无分段</span>
            <span class="home__story-scenes">{{ story.scene_count }} 场景</span>
          </div>
        </RouterLink>
      </div>
    </section>

    <!-- Province grid -->
    <section class="home__provinces">
      <h2 class="home__section-title">按省份浏览</h2>
      <ProvinceGrid :provinces="provinces" />
    </section>

    <!-- Loading / error -->
    <div v-if="loading" class="home__loading">
      <div class="home__spinner" />
      <p>正在加载知识库数据…</p>
    </div>
    <div v-if="error" class="home__error">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getProvinces } from '@/api/system'
import { listStories } from '@/api/stories'
import type { ProvinceInfo, StoryListItem, GenerationType } from '@shared/types'
import ProvinceGrid from '@/components/ProvinceGrid.vue'

const router = useRouter()

const searchQuery = ref('')
const provinces = ref<ProvinceInfo[]>([])
const recentStories = ref<StoryListItem[]>([])
const loading = ref(false)
const error = ref('')

const totalEntries = computed(() => provinces.value.reduce((sum, p) => sum + p.entry_count, 0))

function goSearch() {
  if (searchQuery.value.trim()) {
    router.push({ path: '/search', query: { q: searchQuery.value.trim() } })
  }
}

function typeLabel(type: GenerationType): string {
  const map: Record<GenerationType, string> = {
    character_story: '人物故事',
    culture_promo: '文化宣传',
    scene_short: '场景短片',
  }
  return map[type] ?? type
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

onMounted(async () => {
  loading.value = true
  error.value = ''

  try {
    const [provRes, storyRes] = await Promise.all([
      getProvinces(),
      listStories(),
    ])

    if (provRes.ok && provRes.data) {
      provinces.value = provRes.data
    } else {
      error.value = provRes.error?.message ?? '加载省份失败'
    }

    if (storyRes.ok && storyRes.data) {
      // Show at most 6 recent stories
      recentStories.value = storyRes.data.slice(0, 6)
    }
  } catch (e: any) {
    error.value = e.message ?? '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.home {
  max-width: 960px;
  margin: 0 auto;
}

/* Hero */
.home__hero {
  text-align: center;
  padding: 40px 20px 30px;
  background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
  color: #ecf0f1;
  border-radius: 8px;
  margin-bottom: 24px;
}

.home__hero-title {
  margin: 0 0 8px 0;
  font-size: 30px;
  font-weight: 700;
}

.home__hero-desc {
  margin: 0 0 20px 0;
  font-size: 16px;
  color: #bdc3c7;
}

/* Search */
.home__search {
  margin-bottom: 24px;
}

.home__search-form {
  display: flex;
  gap: 10px;
}

.home__search-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
  font-size: 15px;
}

.home__search-input:focus {
  border-color: #3498db;
  outline: none;
}

/* Section title */
.home__section-title {
  margin: 0 0 14px 0;
  font-size: 20px;
  color: #2c3e50;
  border-bottom: 1px solid #ecf0f1;
  padding-bottom: 4px;
}

/* Stats */
.home__stats {
  margin-bottom: 24px;
}

.home__stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.home__stat-card {
  text-align: center;
  padding: 14px 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.home__stat-number {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #2980b9;
}

.home__stat-label {
  display: block;
  font-size: 14px;
  color: #7f8c8d;
  margin-top: 4px;
}

/* Recent stories */
.home__recent {
  margin-bottom: 24px;
}

.home__recent-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.home__story-card {
  padding: 12px 16px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: #fff;
  text-decoration: none;
  transition: border-color 0.2s;
}

.home__story-card:hover {
  border-color: #3498db;
}

.home__story-type-badge {
  display: inline-block;
  padding: 2px 8px;
  background: #eaf2f8;
  color: #2980b9;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
}

.home__story-title {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 700;
  color: #2c3e50;
}

.home__story-source {
  margin: 0;
  font-size: 13px;
  color: #7f8c8d;
}

.home__story-logline {
  margin: 4px 0 0 0;
  font-size: 14px;
  color: #34495e;
  font-style: italic;
  line-height: 1.4;
}

.home__story-meta-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}

.home__story-date {
  font-size: 12px;
  color: #7f8c8d;
}

.home__story-gears-badge {
  padding: 2px 6px;
  background: #d5f5e3;
  color: #27ae60;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
}

.home__story-gears-badge--none {
  padding: 2px 6px;
  background: #f8f9fa;
  color: #7f8c8d;
  border-radius: 3px;
  font-size: 12px;
}

.home__story-scenes {
  font-size: 12px;
  color: #7f8c8d;
}

/* Provinces */
.home__provinces {
  margin-bottom: 24px;
}

/* Buttons */
.btn {
  padding: 10px 20px;
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

.btn--primary {
  background: #2980b9;
  color: #fff;
}

.btn--lg {
  padding: 14px 28px;
  font-size: 18px;
  font-weight: 700;
}

/* Loading & error */
.home__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px;
  color: #7f8c8d;
}

.home__spinner {
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

.home__error {
  padding: 10px 14px;
  background: #fdecea;
  color: #c0392b;
  border-radius: 4px;
  font-size: 14px;
  margin-top: 12px;
}
</style>