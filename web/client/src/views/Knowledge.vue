<template>
  <div class="knowledge-page">
    <header class="knowledge-page__header">
      <div>
        <h1 class="knowledge-page__title">中国文化知识库</h1>
        <p class="knowledge-page__desc">按省份浏览中国传统文化条目，查看人物、掌故、非遗、名胜与民俗资料。</p>
      </div>
      <RouterLink class="knowledge-page__search-link" to="/search">搜索条目</RouterLink>
    </header>

    <div v-if="loadingProvinces" class="knowledge-page__loading">
      <div class="knowledge-page__spinner" />
      <p>正在加载知识库…</p>
    </div>

    <div v-else-if="provinceError" class="knowledge-page__error">{{ provinceError }}</div>

    <div v-else class="knowledge-page__layout">
      <aside class="knowledge-page__province-menu" aria-label="省份二级菜单">
        <RouterLink class="knowledge-page__province-link" to="/knowledge">全部省份</RouterLink>
        <RouterLink
          v-for="province in provinces"
          :key="province.name"
          class="knowledge-page__province-link"
          :to="{ name: 'KnowledgeProvince', params: { province: province.name } }"
        >
          <span>{{ province.name }}</span>
          <span class="knowledge-page__province-count">{{ province.entry_count }}</span>
        </RouterLink>
      </aside>

      <main class="knowledge-page__content">
        <section v-if="!selectedProvince" class="knowledge-page__overview">
          <div class="knowledge-page__summary">
            <div class="knowledge-page__summary-item">
              <strong>{{ totalEntries }}</strong>
              <span>总条目</span>
            </div>
            <div class="knowledge-page__summary-item">
              <strong>{{ provinces.length }}</strong>
              <span>省份</span>
            </div>
          </div>

          <h2 class="knowledge-page__section-title">省份目录</h2>
          <ProvinceGrid :provinces="provinces" />
        </section>

        <section v-else class="knowledge-page__entries">
          <header class="knowledge-page__entries-header">
            <div>
              <h2 class="knowledge-page__section-title">{{ selectedProvince }}</h2>
              <p class="knowledge-page__entry-count">共 {{ entries.length }} 条知识库条目</p>
            </div>
          </header>

          <div v-if="loadingEntries" class="knowledge-page__loading knowledge-page__loading--inline">
            <div class="knowledge-page__spinner" />
            <p>正在加载{{ selectedProvince }}条目…</p>
          </div>

          <div v-else-if="entryError" class="knowledge-page__error">{{ entryError }}</div>

          <template v-else>
            <section v-for="group in groupedEntries" :key="group.type" class="knowledge-page__group">
              <h3 class="knowledge-page__group-title">{{ group.type }}（{{ group.entries.length }}）</h3>
              <div class="knowledge-page__cards">
                <EntryCard
                  v-for="entry in group.entries"
                  :key="entry.name"
                  :entry="entry"
                  @click="goEntry"
                />
              </div>
            </section>

            <div v-if="entries.length === 0" class="knowledge-page__empty">
              <p>该省份暂无知识库条目。</p>
            </div>
          </template>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getProvinces } from '@/api/system'
import { searchEntries } from '@/api/entries'
import EntryCard from '@/components/EntryCard.vue'
import ProvinceGrid from '@/components/ProvinceGrid.vue'
import type { EntrySearchResult, ProvinceInfo } from '@shared/types'

const route = useRoute()
const router = useRouter()

const provinces = ref<ProvinceInfo[]>([])
const entries = ref<EntrySearchResult[]>([])
const loadingProvinces = ref(false)
const loadingEntries = ref(false)
const provinceError = ref('')
const entryError = ref('')

const selectedProvince = computed(() => {
  const value = route.params.province
  return typeof value === 'string' ? value : ''
})

const totalEntries = computed(() => provinces.value.reduce((sum, p) => sum + p.entry_count, 0))

const groupedEntries = computed(() => {
  const map = new Map<string, EntrySearchResult[]>()
  for (const entry of entries.value) {
    const list = map.get(entry.type) ?? []
    list.push(entry)
    map.set(entry.type, list)
  }
  return Array.from(map.entries())
    .map(([type, entries]) => ({ type, entries }))
    .sort((a, b) => a.type.localeCompare(b.type, 'zh-CN'))
})

function goEntry(entry: EntrySearchResult) {
  router.push({ path: '/entry', query: { name: entry.name } })
}

async function loadProvinces() {
  loadingProvinces.value = true
  provinceError.value = ''

  const res = await getProvinces()
  if (res.ok && res.data) {
    provinces.value = res.data
  } else {
    provinceError.value = res.error?.message ?? '加载省份目录失败'
  }

  loadingProvinces.value = false
}

async function loadEntries(province: string) {
  entries.value = []
  entryError.value = ''
  if (!province) return

  loadingEntries.value = true
  const res = await searchEntries({ province })
  if (res.ok && res.data) {
    entries.value = res.data
  } else {
    entryError.value = res.error?.message ?? '加载省份条目失败'
  }
  loadingEntries.value = false
}

onMounted(async () => {
  await loadProvinces()
  if (selectedProvince.value) {
    await loadEntries(selectedProvince.value)
  }
})

watch(selectedProvince, (province) => {
  loadEntries(province)
})
</script>

<style scoped>
.knowledge-page {
  max-width: 1180px;
  margin: 0 auto;
}

.knowledge-page__header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  margin-bottom: 20px;
}

.knowledge-page__title {
  margin: 0 0 6px 0;
  font-size: 28px;
  color: #22313f;
}

.knowledge-page__desc {
  margin: 0;
  color: #66727f;
  line-height: 1.6;
}

.knowledge-page__search-link {
  flex: 0 0 auto;
  padding: 9px 14px;
  border-radius: 4px;
  background: #2980b9;
  color: #fff;
  text-decoration: none;
  font-size: 14px;
}

.knowledge-page__layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 22px;
  align-items: start;
}

.knowledge-page__province-menu {
  position: sticky;
  top: 16px;
  display: grid;
  gap: 6px;
  max-height: calc(100vh - 32px);
  overflow: auto;
  padding: 10px;
  border: 1px solid #dde3e8;
  border-radius: 8px;
  background: #fff;
}

.knowledge-page__province-link {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  border-radius: 5px;
  color: #2c3e50;
  text-decoration: none;
  font-size: 14px;
}

.knowledge-page__province-link:hover,
.knowledge-page__province-link.router-link-active {
  background: #eaf2f8;
  color: #1f6f9d;
}

.knowledge-page__province-count {
  color: #7f8c8d;
  font-size: 12px;
}

.knowledge-page__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 22px;
}

.knowledge-page__summary-item {
  padding: 16px;
  border: 1px solid #dde3e8;
  border-radius: 8px;
  background: #f8fafb;
}

.knowledge-page__summary-item strong {
  display: block;
  color: #2980b9;
  font-size: 28px;
  line-height: 1;
  margin-bottom: 6px;
}

.knowledge-page__summary-item span {
  color: #66727f;
  font-size: 14px;
}

.knowledge-page__section-title {
  margin: 0 0 12px 0;
  color: #22313f;
  font-size: 22px;
}

.knowledge-page__entries-header {
  margin-bottom: 16px;
}

.knowledge-page__entry-count {
  margin: 0;
  color: #66727f;
  font-size: 14px;
}

.knowledge-page__group {
  margin-bottom: 24px;
}

.knowledge-page__group-title {
  margin: 0 0 12px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid #e8edf1;
  color: #22313f;
  font-size: 18px;
}

.knowledge-page__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

.knowledge-page__empty,
.knowledge-page__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 36px 20px;
  color: #7f8c8d;
}

.knowledge-page__loading--inline {
  padding: 24px 20px;
}

.knowledge-page__spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #ecf0f1;
  border-top: 3px solid #2980b9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.knowledge-page__error {
  padding: 10px 14px;
  background: #fdecea;
  color: #c0392b;
  border-radius: 4px;
  font-size: 14px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 900px) {
  .knowledge-page__layout {
    grid-template-columns: 1fr;
  }

  .knowledge-page__province-menu {
    position: static;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    max-height: none;
  }
}

@media (max-width: 640px) {
  .knowledge-page__header {
    flex-direction: column;
  }

  .knowledge-page__search-link {
    width: 100%;
    text-align: center;
  }
}
</style>
