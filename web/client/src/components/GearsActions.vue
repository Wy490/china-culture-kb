<template>
  <div class="gears-actions">
    <h3 class="gears-actions__title">GEARS 操作</h3>

    <div class="gears-actions__url">
      <span class="gears-actions__label">Segments URL:</span>
      <code class="gears-actions__code">{{ gearsSegmentsUrl }}</code>
    </div>

    <div class="gears-actions__buttons">
      <button class="btn btn--blue" @click="copyFullJson" :disabled="copyingFull">
        📋 {{ copyingFull ? '已复制!' : '复制完整 Segments JSON' }}
      </button>

      <div class="gears-actions__single-copy">
        <label class="gears-actions__label" for="segment-select">复制单段:</label>
        <select id="segment-select" v-model="selectedSegmentId" class="gears-actions__select">
          <option value="" disabled>选择段落…</option>
          <option v-for="seg in segments" :key="seg.segment_id" :value="seg.segment_id">
            #{{ seg.segment_id }} — {{ seg.purpose }}（{{ seg.duration_sec }}s）
          </option>
        </select>
        <button
          class="btn btn--blue btn--sm"
          @click="copySegmentScript"
          :disabled="!selectedSegmentId || copyingSegment"
        >
          📋 {{ copyingSegment ? '已复制!' : '复制脚本文本' }}
        </button>
        <button
          class="btn btn--blue btn--sm"
          @click="copySegmentJson"
          :disabled="!selectedSegmentId"
        >
          📋 复制单段 JSON
        </button>
      </div>

      <button class="btn btn--blue" @click="exportJson">
        📥 导出 gears_segments.json
      </button>

      <button class="btn btn--disabled" disabled title="Phase 1 placeholder — 尚未实现">
        🚀 发送到 GEARS v2（暂未开放）
      </button>
    </div>

    <div v-if="message" class="gears-actions__message">{{ message }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { GearsSegment } from '@shared/types'

const props = defineProps<{
  segments: GearsSegment[]
  gearsSegmentsUrl: string
  storyId: string
}>()

const selectedSegmentId = ref<number | string>('')
const copyingFull = ref(false)
const copyingSegment = ref(false)
const message = ref('')

async function copyFullJson() {
  copyingFull.value = true
  message.value = ''
  try {
    const json = JSON.stringify(props.segments, null, 2)
    await navigator.clipboard.writeText(json)
    message.value = '完整 JSON 已复制到剪贴板'
  } catch {
    message.value = '复制失败，请手动复制'
  } finally {
    copyingFull.value = false
    setTimeout(() => { message.value = '' }, 3000)
  }
}

async function copySegmentScript() {
  if (!selectedSegmentId.value) return
  copyingSegment.value = true
  message.value = ''
  try {
    const seg = props.segments.find(s => s.segment_id === Number(selectedSegmentId.value))
    if (!seg) { message.value = '未找到该段落'; return }
    await navigator.clipboard.writeText(seg.script_text)
    message.value = `段落 #${seg.segment_id} 脚本文本已复制到剪贴板`
  } catch {
    message.value = '复制失败，请手动复制'
  } finally {
    copyingSegment.value = false
    setTimeout(() => { message.value = '' }, 3000)
  }
}

async function copySegmentJson() {
  if (!selectedSegmentId.value) return
  message.value = ''
  try {
    const seg = props.segments.find(s => s.segment_id === Number(selectedSegmentId.value))
    if (!seg) { message.value = '未找到该段落'; return }
    await navigator.clipboard.writeText(JSON.stringify(seg, null, 2))
    message.value = `段落 #${seg.segment_id} JSON 已复制到剪贴板`
  } catch {
    message.value = '复制失败，请手动复制'
  }
  setTimeout(() => { message.value = '' }, 3000)
}

function exportJson() {
  const json = JSON.stringify(props.segments, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'gears_segments.json'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  message.value = '文件已下载'
  setTimeout(() => { message.value = '' }, 3000)
}
</script>

<style scoped>
.gears-actions {
  border: 2px solid #2980b9;
  border-radius: 8px;
  padding: 16px 20px;
  margin-top: 20px;
  background: #eaf2f8;
}

.gears-actions__title {
  margin: 0 0 12px 0;
  font-size: 18px;
  color: #2c3e50;
}

.gears-actions__url {
  margin-bottom: 12px;
}

.gears-actions__label {
  font-weight: 600;
  font-size: 14px;
  color: #2c3e50;
}

.gears-actions__code {
  display: block;
  margin-top: 4px;
  padding: 6px 10px;
  background: #2c3e50;
  color: #ecf0f1;
  border-radius: 4px;
  font-size: 13px;
  word-break: break-all;
  white-space: pre-wrap;
}

.gears-actions__buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gears-actions__single-copy {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gears-actions__select {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
  font-size: 14px;
  background: #fff;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
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

.btn--disabled {
  background: #bdc3c7;
  color: #7f8c8d;
  cursor: not-allowed;
}

.gears-actions__message {
  margin-top: 10px;
  padding: 6px 10px;
  background: #d5f5e3;
  border-radius: 4px;
  font-size: 13px;
  color: #27ae60;
}
</style>