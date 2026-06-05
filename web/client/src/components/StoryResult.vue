<template>
  <div v-if="result" class="story-result">
    <!-- Title & logline -->
    <header class="story-result__header">
      <h2 class="story-result__title">{{ result.title }}</h2>
      <p class="story-result__logline">{{ result.logline }}</p>
      <p class="story-result__meta">
        类型: {{ typeLabel(result.generation_type) }} · 来源: {{ result.source_entry }}
      </p>
    </header>

    <!-- Full text -->
    <section class="story-result__section">
      <h3 class="story-result__section-title">完整故事文本</h3>
      <div class="story-result__full-text">
        <p v-for="(para, i) in fullTextParagraphs" :key="i" v-html="para" />
      </div>
    </section>

    <!-- Scene breakdown -->
    <section v-if="result.scene_breakdown.length > 0" class="story-result__section">
      <h3 class="story-result__section-title">场景分解</h3>
      <div class="story-result__scenes">
        <div v-for="scene in result.scene_breakdown" :key="scene.scene_id" class="story-result__scene-card">
          <h4 class="story-result__scene-title">
            场景 {{ scene.scene_id }} — {{ scene.location }}
          </h4>
          <p class="story-result__scene-meta">时长: {{ scene.duration_sec }}秒</p>
          <p class="story-result__scene-desc">{{ scene.description }}</p>
          <p class="story-result__scene-action">
            <strong>关键动作:</strong> {{ scene.key_action }}
          </p>
          <p v-if="scene.characters.length > 0" class="story-result__scene-characters">
            <strong>角色:</strong> {{ scene.characters.join(', ') }}
          </p>
        </div>
      </div>
    </section>

    <!-- GearsActions -->
    <GearsActions
      v-if="result.gears_segments.length > 0"
      :segments="result.gears_segments"
      :gears-segments-url="result.gears_segments_url"
      :story-id="result.storyId"
    />

    <!-- Cultural constraints -->
    <section v-if="result.cultural_constraints.length > 0" class="story-result__section">
      <h3 class="story-result__section-title">文化约束</h3>
      <ul class="story-result__constraints">
        <li v-for="c in result.cultural_constraints" :key="c">{{ c }}</li>
      </ul>
    </section>

    <!-- Credibility note -->
    <section class="story-result__section">
      <h3 class="story-result__section-title">可信度说明</h3>
      <p class="story-result__credibility">{{ result.credibility_note }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { StoryGenerateResult, GenerationType } from '@shared/types'
import GearsActions from './GearsActions.vue'

const props = defineProps<{
  result: StoryGenerateResult | null
}>()

function typeLabel(type: GenerationType): string {
  const map: Record<GenerationType, string> = {
    character_story: '人物故事',
    culture_promo: '文化宣传片',
    scene_short: '场景短片',
  }
  return map[type] ?? type
}

const fullTextParagraphs = computed(() => {
  if (!props.result?.full_text) return []
  return props.result.full_text
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => renderSimpleMarkdown(p.trim()))
})

function renderSimpleMarkdown(text: string): string {
  // **bold** → <strong>
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}
</script>

<style scoped>
.story-result {
  max-width: 100%;
}

.story-result__header {
  margin-bottom: 24px;
}

.story-result__title {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: #2c3e50;
}

.story-result__logline {
  margin: 0 0 4px 0;
  font-size: 16px;
  color: #34495e;
  font-style: italic;
}

.story-result__meta {
  margin: 0;
  font-size: 14px;
  color: #7f8c8d;
}

.story-result__section {
  margin-bottom: 24px;
}

.story-result__section-title {
  margin: 0 0 10px 0;
  font-size: 18px;
  color: #2c3e50;
  border-bottom: 1px solid #ecf0f1;
  padding-bottom: 4px;
}

.story-result__full-text p {
  margin: 0 0 12px 0;
  font-size: 15px;
  line-height: 1.7;
  color: #34495e;
}

/* Scene cards */
.story-result__scenes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.story-result__scene-card {
  padding: 12px 16px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
}

.story-result__scene-title {
  margin: 0 0 6px 0;
  font-size: 15px;
  color: #2c3e50;
}

.story-result__scene-meta {
  margin: 0 0 6px 0;
  font-size: 13px;
  color: #7f8c8d;
}

.story-result__scene-desc {
  margin: 0 0 6px 0;
  font-size: 14px;
  line-height: 1.5;
  color: #34495e;
}

.story-result__scene-action {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: #2c3e50;
}

.story-result__scene-characters {
  margin: 0;
  font-size: 13px;
  color: #7f8c8d;
}

/* Constraints */
.story-result__constraints {
  padding-left: 20px;
  margin: 0;
}

.story-result__constraints li {
  font-size: 14px;
  color: #e67e22;
  margin-bottom: 4px;
}

.story-result__credibility {
  font-size: 14px;
  color: #34495e;
  background: #fef9e7;
  padding: 8px 12px;
  border-radius: 4px;
  margin: 0;
}
</style>