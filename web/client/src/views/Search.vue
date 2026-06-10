<template>
  <div class="search-page">
    <h1 class="search-page__title">搜索知识库</h1>

    <!-- Search form -->
    <form class="search-page__form" @submit.prevent="handleSearch">
      <input
        v-model="keywords"
        class="search-page__input"
        placeholder="输入词条名称、关键词、地区…"
      />
      <select v-model="typeFilter" class="search-page__select">
        <option value="">全部类型</option>
        <option v-for="t in types" :key="t.name" :value="t.name">{{ t.name }}</option>
      </select>
      <select v-model="provinceFilter" class="search-page__select">
        <option value="">全部省份</option>
        <option v-for="p in provinces" :key="p.name" :value="p.name">{{ p.name }}</option>
      </select>
      <select v-model="regionFilter" class="search-page__select" :disabled="!provinceFilter">
        <option value="">全部地区</option>
        <option v-for="r in regions" :key="r" :value="r">{{ r }}</option>
      </select>
      <button class="btn btn--primary" type="submit" :disabled="searching">
        {{ searching ? '搜索中…' : '搜索' }}
      </button>
    </form>

    <!-- Results -->
    <section v-if="results.length > 0" class="search-page__results">
      <p class="search-page__count">找到 {{ results.length }} 条结果</p>
      <div class="search-page__cards">
        <EntryCard
          v-for="entry in results"
          :key="entry.name"
          :entry="entry"
          :source-query="keywords.trim()"
          @click="goEntry"
        />
      </div>
    </section>

    <!-- No results -->
    <div v-if="searched && results.length === 0" class="search-page__empty">
      <p>未找到匹配条目，请尝试不同关键词。</p>
    </div>

    <!-- Loading -->
    <div v-if="searching" class="search-page__loading">
      <div class="search-page__spinner" />
      <p>正在搜索…</p>
    </div>

    <!-- Error -->
    <div v-if="error" class="search-page__error">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { searchEntries } from '@/api/entries'
import { getProvinces, getTypes, getRegions } from '@/api/system'
import type { EntrySearchResult, ProvinceInfo, TypeInfo } from '@shared/types'
import EntryCard from '@/components/EntryCard.vue'

const route = useRoute()
const router = useRouter()

const keywords = ref('')
const typeFilter = ref('')
const provinceFilter = ref('')
const regionFilter = ref('')
const regions = ref<string[]>([])
const results = ref<EntrySearchResult[]>([])
const provinces = ref<ProvinceInfo[]>([])
const types = ref<TypeInfo[]>([])
const searching = ref(false)
const searched = ref(false)
const error = ref('')

function goEntry(entry: EntrySearchResult) {
  router.push({ path: '/entry', query: { name: entry.name } })
}

async function handleSearch() {
  if (!keywords.value.trim() && !typeFilter.value && !provinceFilter.value) return
  searching.value = true
  searched.value = false
  error.value = ''
  results.value = []

  const res = await searchEntries({
    keywords: keywords.value.trim() || undefined,
    type: typeFilter.value || undefined,
    province: provinceFilter.value || undefined,
    region: regionFilter.value || undefined,
  })

  if (res.ok && res.data) {
    results.value = res.data
  } else {
    error.value = res.error?.message ?? '搜索失败'
  }
  searching.value = false
  searched.value = true
}

// Load regions when province changes
watch(provinceFilter, async (newProvince) => {
  regionFilter.value = ''
  regions.value = []
  if (newProvince) {
    const res = await getRegions(newProvince)
    if (res.ok && res.data) {
      regions.value = res.data
    }
  }
})

onMounted(async () => {
  // Read initial query from URL
  const q = route.query.q as string | undefined
  if (q) keywords.value = q

  // Load filter options
  const [provRes, typeRes] = await Promise.all([
    getProvinces(),
    getTypes(),
  ])
  if (provRes.ok && provRes.data) provinces.value = provRes.data
  if (typeRes.ok && typeRes.data) types.value = typeRes.data

  // Auto-search if query provided
  if (q) {
    handleSearch()
  }
})
</script>

<style scoped>
.search-page {
  max-width: 960px;
  margin: 0 auto;
}

.search-page__title {
  margin: 0 0 20px 0;
  font-size: 22px;
  color: #2c3e50;
}

/* Form */
.search-page__form {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 20px;
}

.search-page__input {
  flex: 2;
  padding: 10px 14px;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
  font-size: 15px;
}

.search-page__input:focus {
  border-color: #3498db;
  outline: none;
}

.search-page__select {
  padding: 10px 12px;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
  font-size: 14px;
  background: #fff;
}

/* Count */
.search-page__count {
  margin: 0 0 14px 0;
  font-size: 14px;
  color: #7f8c8d;
}

/* Cards */
.search-page__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

/* Empty */
.search-page__empty {
  text-align: center;
  padding: 40px 20px;
  color: #95a5a6;
  font-size: 16px;
}

/* Loading */
.search-page__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px;
  color: #7f8c8d;
}

.search-page__spinner {
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
.search-page__error {
  padding: 10px 14px;
  background: #fdecea;
  color: #c0392b;
  border-radius: 4px;
  font-size: 14px;
  margin-top: 12px;
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

/* ===== Mobile Responsive ===== */
@media (max-width: 768px) {
  .search-page__form {
    flex-direction: column;
    gap: 8px;
  }
  .search-page__input {
    flex: 1;
    width: 100%;
  }
  .search-page__select {
    width: 100%;
  }
}
</style>
