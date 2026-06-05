<template>
  <div v-if="plan" class="story-plan">
    <h3 class="story-plan__title">推荐方案 — {{ plan.entry_name }}（{{ plan.entry_type }}）</h3>

    <!-- Type cards -->
    <section class="story-plan__section">
      <h4 class="story-plan__section-title">推荐类型</h4>
      <div class="story-plan__types">
        <div
          v-for="rt in plan.recommended_types"
          :key="rt.generation_type"
          class="story-plan__type-card"
          :class="{
            'story-plan__type-card--selected': selectedType === rt.generation_type,
            'story-plan__type-card--recommended': rt.priority === 1,
          }"
          @click="$emit('select-type', rt.generation_type)"
        >
          <span class="story-plan__type-badge">
            {{ rt.priority === 1 ? '✅ 推荐' : '⭕ 可选' }}
          </span>
          <span class="story-plan__type-name">{{ typeLabel(rt.generation_type) }}</span>
          <span class="story-plan__type-reason">{{ rt.reason }}</span>
        </div>
      </div>
    </section>

    <!-- Events -->
    <section class="story-plan__section">
      <h4 class="story-plan__section-title">可选核心事件</h4>
      <ul class="story-plan__events">
        <li
          v-for="ev in plan.available_events"
          :key="ev.event"
          class="story-plan__event-item"
          :class="{ 'story-plan__event-item--selected': selectedEvent === ev.event }"
          @click="$emit('select-event', ev.event)"
        >
          <span class="story-plan__event-name">{{ ev.event }}</span>
          <span class="story-plan__event-meta">
            冲突 {{ ev.conflict_score }}/10 · 推荐 {{ typeLabel(ev.recommended_type) }} · {{ ev.recommended_duration }}
          </span>
        </li>
      </ul>
    </section>

    <!-- Cultural risks -->
    <section v-if="plan.cultural_risks.length > 0" class="story-plan__section">
      <h4 class="story-plan__section-title">文化风险提示</h4>
      <ul class="story-plan__risks">
        <li v-for="risk in plan.cultural_risks" :key="risk">{{ risk }}</li>
      </ul>
    </section>

    <p class="story-plan__duration">推荐时长: {{ plan.recommended_duration }}</p>
  </div>
</template>

<script setup lang="ts">
import type { StoryPlanResult, GenerationType } from '@shared/types'

const props = defineProps<{
  plan: StoryPlanResult | null
  selectedType: GenerationType | null
  selectedEvent: string | null
}>()

defineEmits<{
  'select-type': [type: GenerationType]
  'select-event': [event: string]
}>()

function typeLabel(type: GenerationType): string {
  const map: Record<GenerationType, string> = {
    character_story: '人物故事',
    culture_promo: '文化宣传片',
    scene_short: '场景短片',
  }
  return map[type] ?? type
}
</script>

<style scoped>
.story-plan {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px 20px;
  margin-top: 16px;
}

.story-plan__title {
  margin: 0 0 16px 0;
  font-size: 17px;
  color: #2c3e50;
}

.story-plan__section {
  margin-bottom: 16px;
}

.story-plan__section-title {
  margin: 0 0 8px 0;
  font-size: 15px;
  color: #34495e;
  font-weight: 600;
}

/* Type cards */
.story-plan__types {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.story-plan__type-card {
  flex: 1;
  min-width: 180px;
  padding: 12px 16px;
  border: 2px solid #bdc3c7;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.story-plan__type-card:hover {
  border-color: #3498db;
}

.story-plan__type-card--selected {
  border-color: #2980b9;
  background: #eaf2f8;
}

.story-plan__type-card--recommended {
  border-color: #27ae60;
}

.story-plan__type-badge {
  display: inline-block;
  font-size: 13px;
  margin-bottom: 4px;
}

.story-plan__type-name {
  display: block;
  font-size: 16px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 4px;
}

.story-plan__type-reason {
  display: block;
  font-size: 13px;
  color: #7f8c8d;
}

/* Events */
.story-plan__events {
  list-style: none;
  padding: 0;
  margin: 0;
}

.story-plan__event-item {
  padding: 10px 14px;
  border: 1px solid #ecf0f1;
  border-radius: 4px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  background: #fff;
}

.story-plan__event-item:hover {
  border-color: #3498db;
  background: #f0f8ff;
}

.story-plan__event-item--selected {
  border-color: #2980b9;
  background: #eaf2f8;
}

.story-plan__event-name {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: #2c3e50;
}

.story-plan__event-meta {
  display: block;
  font-size: 13px;
  color: #7f8c8d;
  margin-top: 2px;
}

/* Risks */
.story-plan__risks {
  padding-left: 20px;
  margin: 0;
}

.story-plan__risks li {
  font-size: 14px;
  color: #c0392b;
  margin-bottom: 4px;
}

.story-plan__duration {
  font-size: 14px;
  color: #7f8c8d;
  margin: 8px 0 0 0;
}
</style>