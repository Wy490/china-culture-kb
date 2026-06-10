<template>
  <div class="province-grid">
    <RouterLink
      v-for="province in provinces"
      :key="province.name"
      class="province-grid__item"
      :to="{ name: 'KnowledgeProvince', params: { province: province.name } }"
    >
      <span class="province-grid__name">{{ province.name }}</span>
      <span class="province-grid__count">{{ province.entry_count }} 条</span>
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
import type { ProvinceInfo } from '@shared/types'

defineProps<{
  provinces: ProvinceInfo[]
}>()
</script>

<style scoped>
.province-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}

.province-grid__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 8px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: #fff;
  text-decoration: none;
  transition: border-color 0.2s, background 0.2s;
}

.province-grid__item:hover {
  border-color: #3498db;
  background: #eaf2f8;
}

.province-grid__name {
  font-size: 15px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
}

.province-grid__count {
  font-size: 12px;
  color: #7f8c8d;
}
</style>
