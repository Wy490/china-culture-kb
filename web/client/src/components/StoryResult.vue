<template>
  <div v-if="result" class="story-result">
    <!-- Title & logline -->
    <header class="story-result__header">
      <h2 class="story-result__title">{{ result.title }}</h2>
      <p v-if="result.logline" class="story-result__logline">{{ result.logline }}</p>
      <p class="story-result__meta">
        成片: {{ videoTypeLabel }} · 表现: {{ presentationStyleLabel }} · 来源: {{ result.source_entry }}
        <span v-if="result.credibility_note"> · 可信度: {{ result.credibility_note }}</span>
      </p>
    </header>

    <!-- Full text -->
    <section class="story-result__section">
      <h3 class="story-result__section-title">完整故事文本</h3>
      <div v-if="result.full_text && result.full_text.trim()" class="story-result__full-text">
        <p v-for="(para, i) in fullTextParagraphs" :key="i" v-html="para" />
      </div>
      <div v-else class="story-result__empty-warning">
        <p>⚠️ 该故事缺少完整正文，请重新生成</p>
      </div>
    </section>

    <!-- Scene breakdown — detailed -->
    <section class="story-result__section">
      <h3 class="story-result__section-title">场景分解</h3>
      <div v-if="result.scene_breakdown.length > 0" class="story-result__scenes">
        <div v-for="scene in result.scene_breakdown" :key="scene.scene_id" class="story-result__scene-card">
          <h4 class="story-result__scene-title">
            场景 {{ scene.scene_id }} — {{ scene.title || scene.location }}
          </h4>
          <div class="story-result__scene-details">
            <p class="story-result__scene-meta-row">
              <span class="story-result__scene-tag">{{ scene.dramatic_function }}</span>
              <span>{{ scene.duration_sec }}秒</span>
              <span>{{ scene.location }}</span>
              <span v-if="scene.time_of_day">{{ scene.time_of_day }}</span>
            </p>
            <p v-if="scene.plot" class="story-result__scene-plot">{{ scene.plot }}</p>
            <p v-if="scene.key_action" class="story-result__scene-action">
              <strong>关键动作:</strong> {{ scene.key_action }}
            </p>
            <p v-if="scene.characters && scene.characters.length > 0" class="story-result__scene-characters">
              <strong>角色:</strong> {{ scene.characters.join(', ') }}
            </p>
            <p v-if="scene.visual_prompt" class="story-result__scene-visual">
              <strong>画面提示:</strong> {{ scene.visual_prompt }}
            </p>
            <p v-if="scene.camera_suggestion" class="story-result__scene-camera">
              <strong>镜头建议:</strong> {{ scene.camera_suggestion }}
            </p>
            <p v-if="scene.cultural_note" class="story-result__scene-cultural">
              <strong>文化标注:</strong> {{ scene.cultural_note }}
            </p>
          </div>
        </div>
      </div>
      <div v-else class="story-result__empty-warning">
        <p>⚠️ 该故事缺少场景分解数据，请重新生成</p>
      </div>
    </section>

    <!-- GEARS segments — detailed expandable -->
    <section v-if="result.gears_segments.length > 0" class="story-result__section">
      <h3 class="story-result__section-title">GEARS 分段脚本</h3>
      <div class="story-result__segments">
        <div v-for="seg in result.gears_segments" :key="seg.segment_id" class="story-result__segment-card">
          <div class="story-result__segment-header" @click="toggleSegment(seg.segment_id)">
            <h4 class="story-result__segment-title">
              段落 {{ seg.segment_id }} — {{ seg.purpose }}（{{ seg.duration_sec }}秒 · {{ seg.panel_count }}格）
            </h4>
            <span class="story-result__segment-toggle">{{ expandedSegments[seg.segment_id] ? '▼' : '▶' }}</span>
          </div>
          <div v-if="expandedSegments[seg.segment_id]" class="story-result__segment-body">
            <p class="story-result__segment-script">{{ seg.script_text }}</p>
            <p class="story-result__segment-focus">
              <strong>视觉焦点:</strong> {{ seg.visual_focus.join('、') }}
            </p>
            <p v-if="seg.cultural_constraints.length > 0" class="story-result__segment-constraints">
              <strong>文化约束:</strong> {{ seg.cultural_constraints.join('；') }}
            </p>
            <p v-if="seg.segment_prompt_hint" class="story-result__segment-hint">
              <strong>风格提示:</strong> {{ seg.segment_prompt_hint }}
            </p>
            <div class="story-result__segment-actions">
              <button class="btn btn--sm btn--blue" @click="copySegmentScript(seg)">📋 复制脚本文本</button>
              <button class="btn btn--sm btn--blue" @click="copySegmentJson(seg)">📋 复制单段 JSON</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- GearsActions (full JSON copy / export / URL display) -->
    <GearsActions
      v-if="result.gears_segments.length > 0"
      :segments="result.gears_segments"
      :gears-segments-url="result.gears_segments_url"
      :story-id="result.storyId"
    />

    <!-- AI comic dialogue -->
    <section v-if="result.dialogue && result.dialogue.length > 0" class="story-result__section">
      <h3 class="story-result__section-title">漫剧对白</h3>
      <div v-for="d in result.dialogue" :key="d.scene_id" class="story-result__dialogue-scene">
        <h4>场景 {{ d.scene_id }}</h4>
        <p v-for="line in d.lines" :key="line.character" class="story-result__dialogue-line">
          <strong>{{ line.character }}</strong>（{{ line.emotion }}）: {{ line.text }}
        </p>
      </div>
    </section>

    <!-- Promo fields -->
    <section v-if="result.visual_symbols && result.visual_symbols.length > 0" class="story-result__section">
      <h3 class="story-result__section-title">视觉符号</h3>
      <p>{{ result.visual_symbols.join('、') }}</p>
      <p v-if="result.core_message"><strong>核心信息:</strong> {{ result.core_message }}</p>
      <p v-if="result.slogan_or_key_sentence"><strong>标语:</strong> {{ result.slogan_or_key_sentence }}</p>
    </section>

    <!-- Lecture/explainer fields -->
    <section v-if="result.argument_points && result.argument_points.length > 0" class="story-result__section">
      <h3 class="story-result__section-title">论点标注</h3>
      <ul><li v-for="pt in result.argument_points" :key="pt">{{ pt }}</li></ul>
    </section>

    <!-- Documentary fields -->
    <section v-if="result.source_quotes && result.source_quotes.length > 0" class="story-result__section">
      <h3 class="story-result__section-title">史料引用</h3>
      <ul><li v-for="sq in result.source_quotes" :key="sq">{{ sq }}</li></ul>
    </section>

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

    <!-- Copy feedback -->
    <div v-if="copyMessage" class="story-result__copy-msg">{{ copyMessage }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import type { StoryGenerateResult, VideoType, PresentationStyle, GearsSegment } from '@shared/types'
import { VIDEO_TYPE_CONFIG, PRESENTATION_STYLE_CONFIG } from '@shared/types'
import GearsActions from './GearsActions.vue'

const props = defineProps<{
  result: StoryGenerateResult | null
}>()

const expandedSegments = reactive<Record<number, boolean>>({})
const copyMessage = ref('')

const videoTypeLabel = computed(() => {
  if (!props.result) return ''
  return VIDEO_TYPE_CONFIG[props.result.video_type]?.label ?? props.result.video_type
})

const presentationStyleLabel = computed(() => {
  if (!props.result) return ''
  return PRESENTATION_STYLE_CONFIG[props.result.presentation_style]?.label ?? props.result.presentation_style
})

const fullTextParagraphs = computed(() => {
  if (!props.result?.full_text) return []
  return props.result.full_text
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => renderSimpleMarkdown(p.trim()))
})

function renderSimpleMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function toggleSegment(id: number) {
  expandedSegments[id] = !expandedSegments[id]
}

async function copySegmentScript(seg: GearsSegment) {
  try {
    await navigator.clipboard.writeText(seg.script_text)
    showCopyMessage(`段落 #${seg.segment_id} 脚本文本已复制`)
  } catch {
    showCopyMessage('复制失败')
  }
}

async function copySegmentJson(seg: GearsSegment) {
  try {
    await navigator.clipboard.writeText(JSON.stringify(seg, null, 2))
    showCopyMessage(`段落 #${seg.segment_id} JSON 已复制`)
  } catch {
    showCopyMessage('复制失败')
  }
}

function showCopyMessage(msg: string) {
  copyMessage.value = msg
  setTimeout(() => { copyMessage.value = '' }, 3000)
}
</script>

<style scoped>
.story-result { max-width: 100%; }
.story-result__header { margin-bottom: 24px; }
.story-result__title { margin: 0 0 8px 0; font-size: 24px; color: #2c3e50; }
.story-result__logline { margin: 0 0 4px 0; font-size: 16px; color: #34495e; font-style: italic; }
.story-result__meta { margin: 0; font-size: 14px; color: #7f8c8d; }
.story-result__section { margin-bottom: 24px; }
.story-result__section-title { margin: 0 0 10px 0; font-size: 18px; color: #2c3e50; border-bottom: 1px solid #ecf0f1; padding-bottom: 4px; }

/* Full text */
.story-result__full-text p { margin: 0 0 12px 0; font-size: 15px; line-height: 1.7; color: #34495e; }
.story-result__empty-warning { padding: 12px 16px; background: #fef9e7; border: 1px solid #f39c12; border-radius: 6px; color: #e67e22; font-size: 14px; }

/* Scene cards */
.story-result__scenes { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
.story-result__scene-card { padding: 14px 18px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; }
.story-result__scene-title { margin: 0 0 8px 0; font-size: 16px; color: #2c3e50; }
.story-result__scene-details { display: flex; flex-direction: column; gap: 6px; }
.story-result__scene-meta-row { display: flex; gap: 8px; align-items: center; font-size: 13px; color: #7f8c8d; }
.story-result__scene-tag { padding: 2px 8px; background: #eaf2f8; color: #2980b9; border-radius: 3px; font-size: 12px; font-weight: 600; }
.story-result__scene-plot { margin: 0; font-size: 14px; line-height: 1.5; color: #34495e; }
.story-result__scene-action { margin: 0; font-size: 14px; color: #2c3e50; }
.story-result__scene-characters { margin: 0; font-size: 13px; color: #7f8c8d; }
.story-result__scene-visual { margin: 0; font-size: 14px; color: #34495e; background: #eaf2f8; padding: 4px 8px; border-radius: 4px; }
.story-result__scene-camera { margin: 0; font-size: 14px; color: #34495e; background: #f0f8ff; padding: 4px 8px; border-radius: 4px; }
.story-result__scene-cultural { margin: 0; font-size: 13px; color: #f39c12; }

/* GEARS segments */
.story-result__segments { display: flex; flex-direction: column; gap: 8px; }
.story-result__segment-card { border: 1px solid #dee2e6; border-radius: 6px; background: #fff; }
.story-result__segment-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; cursor: pointer; transition: background 0.2s; }
.story-result__segment-header:hover { background: #f0f8ff; }
.story-result__segment-title { margin: 0; font-size: 15px; color: #2c3e50; }
.story-result__segment-toggle { font-size: 14px; color: #7f8c8d; }
.story-result__segment-body { padding: 12px 14px; border-top: 1px solid #ecf0f1; }
.story-result__segment-script { margin: 0 0 8px 0; font-size: 14px; line-height: 1.6; color: #34495e; }
.story-result__segment-focus { margin: 0 0 6px 0; font-size: 14px; color: #3498db; }
.story-result__segment-constraints { margin: 0 0 8px 0; font-size: 13px; color: #e67e22; }
.story-result__segment-hint { margin: 0 0 8px 0; font-size: 13px; color: #8e44ad; background: #f5eef8; padding: 4px 8px; border-radius: 4px; }
.story-result__segment-actions { display: flex; gap: 8px; }
.btn { padding: 6px 12px; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; transition: opacity 0.2s; }
.btn:hover:not(:disabled) { opacity: 0.85; }
.btn--blue { background: #2980b9; color: #fff; }
.btn--sm { padding: 6px 12px; font-size: 13px; }

/* Dialogue */
.story-result__dialogue-scene { margin-bottom: 8px; }
.story-result__dialogue-line { margin: 0 0 4px 0; font-size: 14px; color: #34495e; }

/* Constraints */
.story-result__constraints { padding-left: 20px; margin: 0; }
.story-result__constraints li { font-size: 14px; color: #e67e22; margin-bottom: 4px; }
.story-result__credibility { font-size: 14px; color: #34495e; background: #fef9e7; padding: 8px 12px; border-radius: 4px; margin: 0; }
.story-result__copy-msg { margin-top: 10px; padding: 6px 10px; background: #d5f5e3; border-radius: 4px; font-size: 13px; color: #27ae60; }
</style>