<template>
  <div class="entry-card" @click="$emit('click', entry)">
    <div class="entry-card__header">
      <span class="entry-card__type-badge">{{ entry.type }}</span>
      <span class="entry-card__province-tag">{{ entry.province }}</span>
    </div>

    <h3 class="entry-card__name">{{ entry.name }}</h3>

    <p class="entry-card__region">{{ entry.region }}</p>

    <p class="entry-card__summary">{{ entry.summary }}</p>

    <div v-if="entry.keywords.length > 0" class="entry-card__keywords">
      <span v-for="kw in entry.keywords.slice(0, 4)" :key="kw" class="entry-card__keyword">{{ kw }}</span>
    </div>

    <span class="entry-card__credibility" :class="credibilityClass">{{ entry.credibility }}</span>

    <!-- Generate story shortcut buttons -->
    <div class="entry-card__actions">
      <RouterLink
        class="btn btn--blue btn--sm"
        :to="`/story/new?entry=${encodeURIComponent(entry.name)}&type=character_story`"
      >
        ✅ 人物故事
      </RouterLink>
      <RouterLink
        class="btn btn--sm btn--outline"
        :to="`/story/new?entry=${encodeURIComponent(entry.name)}&type=culture_promo`"
      >
        ⭕ 文化宣传
      </RouterLink>
      <RouterLink
        class="btn btn--sm btn--outline"
        :to="`/story/new?entry=${encodeURIComponent(entry.name)}&type=scene_short`"
      >
        ⭕ 场景短片
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EntrySearchResult } from '@shared/types'

defineProps<{
  entry: EntrySearchResult
}>()

defineEmits<{
  click: [entry: EntrySearchResult]
}>()

const credibilityClass = (credibility: string) => {
  const map: Record<string, string> = {
    '可靠': 'entry-card__credibility--reliable',
    '基本可靠': 'entry-card__credibility--mostly',
    '待核实': 'entry-card__credibility--pending',
    '存疑': 'entry-card__credibility--doubt',
    '混合': 'entry-card__credibility--mixed',
  }
  return map[credibility] ?? ''
}
</script>

<style scoped>
.entry-card {
  padding: 14px 18px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.entry-card:hover {
  border-color: #3498db;
  box-shadow: 0 2px 8px rgba(52, 152, 219, 0.15);
}

.entry-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.entry-card__type-badge {
  display: inline-block;
  padding: 2px 8px;
  background: #eaf2f8;
  color: #2980b9;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
}

.entry-card__province-tag {
  font-size: 13px;
  color: #7f8c8d;
}

.entry-card__name {
  margin: 0 0 4px 0;
  font-size: 17px;
  font-weight: 700;
  color: #2c3e50;
  line-height: 1.4;
}

.entry-card__region {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #7f8c8d;
}

.entry-card__summary {
  margin: 0 0 10px 0;
  font-size: 14px;
  line-height: 1.5;
  color: #34495e;
}

.entry-card__keywords {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.entry-card__keyword {
  padding: 2px 6px;
  background: #f8f9fa;
  border-radius: 3px;
  font-size: 12px;
  color: #6c757d;
}

.entry-card__credibility {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 10px;
}

.entry-card__credibility--reliable {
  background: #d5f5e3;
  color: #27ae60;
}

.entry-card__credibility--mostly {
  background: #d6eaf8;
  color: #2980b9;
}

.entry-card__credibility--pending {
  background: #fef9e7;
  color: #f39c12;
}

.entry-card__credibility--doubt {
  background: #fdecea;
  color: #c0392b;
}

.entry-card__credibility--mixed {
  background: #f5eef8;
  color: #8e44ad;
}

.entry-card__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.2s;
  display: inline-flex;
  align-items: center;
}

.btn:hover:not(:disabled) {
  opacity: 0.85;
}

.btn--blue {
  background: #2980b9;
  color: #fff;
}

.btn--sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn--outline {
  background: transparent;
  border: 1px solid #bdc3c7;
  color: #7f8c8d;
}

.btn--outline:hover {
  border-color: #3498db;
  color: #3498db;
}
</style>