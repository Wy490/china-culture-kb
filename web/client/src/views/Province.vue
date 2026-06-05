<template>
  <div class="province-page">
    <div v-if="loading" class="province-page__loading">
      <div class="province-page__spinner" />
      <p>正在加载…</p>
    </div>

    <div v-else-if="error" class="province-page__error">{{ error }}</div>

    <div v-else-if="provinceName">
      <!-- Province header -->
      <header class="province-page__header">
        <h1 class="province-page__title">{{ provinceName }}</h1>
        <p class="province-page__count">共 {{ entries.length }} 条目</p>
      </header>

      <!-- Entries grouped by type -->
      <section v-for="group in groupedEntries" :key="group.type" class="province-page__group">
        <h2 class="province-page__group-title">{{ group.type }}（{{ group.entries.length }}）</h2>
        <div class="province-page__cards">
          <EntryCard
            v-for="entry in group.entries"
            :key="entry.name"
            :entry="entry"
            @click="goEntry"
          />
        </div>
      </section>

      <!-- Empty -->
      <div v-if="entries.length === 0" class="province-page__empty">
        <p>该省份暂无知识库条目。</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { searchEntries } from '@/api/entries'
import type { EntrySearchResult } from '@shared/types'
import EntryCard from '@/components/EntryCard.vue'

const route = useRoute()
const router = useRouter()

const provinceName = ref('')
const entries = ref<EntrySearchResult[]>([])
const loading = ref(false)
const error = ref('')

const groupedEntries = computed(() => {
  const map = new Map<string, EntrySearchResult[]>()
  for (const e of entries.value) {
    const list = map.get(e.type) ?? []
    list.push(e)
    map.set(e.type, list)
  }
  return Array.from(map.entries())
    .map(([type, entries]) => ({ type, entries }))
    .sort((a, b) => a.type.localeCompare(b.type, 'zh-CN'))
})

function goEntry(entry: EntrySearchResult) {
  router.push({ path: '/entry', query: { name: entry.name } })
}

async function loadProvince(name: string) {
  if (!name) return
  provinceName.value = name
  loading.value = true
  error.value = ''
  entries.value = []

  const res = await searchEntries({ province: name })
  if (res.ok && res.data) {
    entries.value = res.data
  } else {
    error.value = res.error?.message ?? '加载省份条目失败'
  }
  loading.value = false
}

onMounted(() => {
  const name = route.params.name as string
  if (name) loadProvince(name)
})

watch(() => route.params.name, (newName) => {
  if (newName && typeof newName === 'string') {
    loadProvince(newName)
  }
})
</script>

<style scoped>
.province-page {
  max-width: 960px;
  margin: 0 auto;
}

.province-page__header {
  margin-bottom: 24px;
}

.province-page__title {
  margin: 0 0 4px 0;
  font-size: 26px;
  color: #2c3e50;
}

.province-page__count {
  margin: 0;
  font-size: 14px;
  color: #7f8c8d;
}

/* Group */
.province-page__group {
  margin-bottom: 24px;
}

.province-page__group-title {
  margin: 0 0 12px 0;
  font-size: 18px;
  color: #2c3e50;
  border-bottom: 1px solid #ecf0f1;
  padding-bottom: 4px;
}

/* Cards */
.province-page__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

/* Empty */
.province-page__empty {
  text-align: center;
  padding: 40px 20px;
  color: #95a5a6;
  font-size: 16px;
}

/* Loading */
.province-page__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px;
  color: #7f8c8d;
}

.province-page__spinner {
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
.province-page__error {
  padding: 10px 14px;
  background: #fdecea;
  color: #c0392b;
  border-radius: 4px;
  font-size: 14px;
}
</style>