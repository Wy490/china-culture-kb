<template>
  <div class="gears-actions">
    <h3 class="gears-actions__title">GEARS 操作</h3>

    <div class="gears-actions__url">
      <span class="gears-actions__label">Segments URL:</span>
      <code class="gears-actions__code">{{ gearsSegmentsUrl }}</code>
    </div>
    <div v-if="deliveryPackage" class="gears-actions__url">
      <span class="gears-actions__label">供稿包:</span>
      <code class="gears-actions__code">
        {{ deliveryPackage.character_assets.length }} 个人物资产 ·
        性别 {{ genderSummaryText }} ·
        {{ deliveryPackage.scene_assets.length }} 个场景资产 ·
        {{ deliveryPackage.units.length }} 个剧本单元
      </code>
    </div>
    <section v-if="characterGenderRows.length > 0" class="gears-actions__asset-genders">
      <div class="gears-actions__asset-genders-head">
        <strong>人物资产性别</strong>
        <span>{{ genderSummaryText }}</span>
      </div>
      <div class="gears-actions__asset-gender-grid">
        <div
          v-for="character in characterGenderRows"
          :key="character.name"
          class="gears-actions__asset-gender-row"
        >
          <span class="gears-actions__asset-name">{{ character.name }}</span>
          <span class="gears-actions__gender-pill" :class="genderPillClass(character.gender)">
            {{ character.gender }}
          </span>
        </div>
      </div>
    </section>
    <div v-if="validationNotes.length > 0" class="gears-actions__notice">
      <div class="gears-actions__notice-head">
        <strong>资料待补:</strong>
        <span>{{ validationNotes.length }} 项</span>
      </div>
      <ul>
        <li v-for="note in visibleValidationNotes" :key="note">{{ note }}</li>
      </ul>
      <p v-if="hiddenValidationCount > 0" class="gears-actions__notice-more">
        另有 {{ hiddenValidationCount }} 项，请展开供稿编辑查看
      </p>
    </div>

    <div class="gears-actions__buttons">
      <button
        v-if="deliveryPackage"
        class="btn btn--blue"
        @click="copyDeliveryMarkdown"
        :disabled="copyingDelivery"
      >
        📋 {{ copyingDelivery ? '已复制!' : '复制当前供稿 Markdown' }}
      </button>

      <button v-if="deliveryPackage" class="btn btn--blue" @click="exportDeliveryMarkdown">
        📥 导出当前供稿 Markdown
      </button>

      <button
        v-if="deliveryPackage"
        class="btn btn--blue"
        @click="copyDeliveryJson"
        :disabled="copyingDeliveryJson"
      >
        📋 {{ copyingDeliveryJson ? '已复制!' : '复制供稿包 JSON' }}
      </button>

      <button v-if="deliveryPackage" class="btn btn--blue" @click="exportDeliveryJson">
        📥 导出供稿包 JSON
      </button>

      <button v-if="deliveryPackage" class="btn btn--blue" @click="toggleDeliveryEditor">
        {{ showDeliveryEditor ? '收起供稿编辑' : '预览/编辑供稿包' }}
      </button>

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

      <button class="btn btn--blue" @click="copyGearsPullConfig" :disabled="copyingGearsPull">
        🚀 {{ copyingGearsPull ? '已复制!' : '复制 GEARS 拉取配置' }}
      </button>
    </div>

    <section v-if="deliveryPackage && showDeliveryEditor" class="gears-actions__editor">
      <div class="gears-actions__editor-head">
        <div>
          <h4 class="gears-actions__editor-title">GEARS 供稿 Markdown</h4>
          <p class="gears-actions__editor-state">{{ isDeliveryDirty ? '已修改，复制/导出将使用当前编辑稿' : '当前为自动生成稿' }}</p>
        </div>
        <button
          class="btn btn--sm btn--ghost"
          @click="resetDeliveryMarkdown"
          :disabled="!isDeliveryDirty"
        >
          恢复自动生成稿
        </button>
        <button
          class="btn btn--sm btn--blue"
          @click="saveDeliveryMarkdown"
          :disabled="!isDeliveryDirty || savingDelivery"
        >
          {{ savingDelivery ? '保存中…' : '保存编辑稿' }}
        </button>
      </div>
      <textarea
        v-model="editableDeliveryMarkdown"
        class="gears-actions__textarea"
        spellcheck="false"
      />
      <div v-if="validationNotes.length > 0" class="gears-actions__validation">
        <strong>校验提示:</strong>
        <ul>
          <li v-for="note in validationNotes" :key="note">{{ note }}</li>
        </ul>
      </div>
    </section>

    <div v-if="message" class="gears-actions__message">{{ message }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { GearsDeliveryPackage, GearsSegment } from '@shared/types'
import { updateGearsDeliveryMarkdown } from '@/api/stories'

const props = defineProps<{
  segments: GearsSegment[]
  gearsSegmentsUrl: string
  deliveryPackage?: GearsDeliveryPackage
  storyId: string
}>()

const selectedSegmentId = ref<number | string>('')
const copyingFull = ref(false)
const copyingSegment = ref(false)
const copyingDelivery = ref(false)
const copyingDeliveryJson = ref(false)
const copyingGearsPull = ref(false)
const savingDelivery = ref(false)
const showDeliveryEditor = ref(false)
const editableDeliveryMarkdown = ref(props.deliveryPackage?.markdown ?? '')
const savedDeliveryMarkdown = ref(props.deliveryPackage?.markdown ?? '')
const message = ref('')

const isDeliveryDirty = computed(() => {
  return Boolean(props.deliveryPackage && editableDeliveryMarkdown.value !== savedDeliveryMarkdown.value)
})
const validationNotes = computed(() => props.deliveryPackage?.validation_notes ?? [])
const visibleValidationNotes = computed(() => validationNotes.value.slice(0, 3))
const hiddenValidationCount = computed(() => Math.max(0, validationNotes.value.length - visibleValidationNotes.value.length))
const genderSummaryText = computed(() => {
  const summary = props.deliveryPackage?.character_gender_summary
  if (!summary) return '未统计'
  return [
    summary.male > 0 ? `男${summary.male}` : '',
    summary.female > 0 ? `女${summary.female}` : '',
    summary.other > 0 ? `其他${summary.other}` : '',
    summary.unspecified > 0 ? `未指定${summary.unspecified}` : '',
    summary.not_applicable > 0 ? `不适用${summary.not_applicable}` : '',
  ].filter(Boolean).join(' / ') || '无人物'
})
const characterGenderRows = computed(() => props.deliveryPackage?.character_assets.map(character => ({
  name: character.name,
  gender: character.gender,
})) ?? [])

function genderPillClass(gender: string) {
  return {
    'gears-actions__gender-pill--male': gender === '男',
    'gears-actions__gender-pill--female': gender === '女',
    'gears-actions__gender-pill--other': gender === '其他',
    'gears-actions__gender-pill--unspecified': gender === '未指定',
    'gears-actions__gender-pill--na': gender === '不适用',
  }
}

watch(
  () => props.deliveryPackage?.markdown,
  markdown => {
    editableDeliveryMarkdown.value = markdown ?? ''
    savedDeliveryMarkdown.value = markdown ?? ''
  },
)

function toggleDeliveryEditor() {
  showDeliveryEditor.value = !showDeliveryEditor.value
}

function currentDeliveryMarkdown() {
  return editableDeliveryMarkdown.value || props.deliveryPackage?.markdown || ''
}

function currentDeliveryPackageJson() {
  if (!props.deliveryPackage) return ''
  return JSON.stringify({
    ...props.deliveryPackage,
    markdown: currentDeliveryMarkdown(),
  }, null, 2)
}

function resetDeliveryMarkdown() {
  editableDeliveryMarkdown.value = savedDeliveryMarkdown.value || props.deliveryPackage?.markdown || ''
  message.value = '已恢复自动生成稿'
  setTimeout(() => { message.value = '' }, 3000)
}

async function saveDeliveryMarkdown() {
  if (!props.deliveryPackage || !isDeliveryDirty.value) return
  savingDelivery.value = true
  message.value = ''
  const res = await updateGearsDeliveryMarkdown(props.storyId, currentDeliveryMarkdown())
  if (res.ok && res.data) {
    savedDeliveryMarkdown.value = res.data.markdown
    editableDeliveryMarkdown.value = res.data.markdown
    message.value = '供稿编辑稿已保存'
  } else {
    message.value = res.error?.message ?? '保存失败'
  }
  savingDelivery.value = false
  setTimeout(() => { message.value = '' }, 3000)
}

async function copyDeliveryMarkdown() {
  if (!props.deliveryPackage) return
  copyingDelivery.value = true
  message.value = ''
  try {
    await navigator.clipboard.writeText(currentDeliveryMarkdown())
    message.value = 'GEARS 供稿 Markdown 已复制到剪贴板'
  } catch {
    message.value = '复制失败，请手动复制'
  } finally {
    copyingDelivery.value = false
    setTimeout(() => { message.value = '' }, 3000)
  }
}

function exportDeliveryMarkdown() {
  if (!props.deliveryPackage) return
  downloadText(`${props.storyId}-gears-delivery.md`, currentDeliveryMarkdown(), 'text/markdown;charset=utf-8')
  message.value = '供稿 Markdown 已下载'
  setTimeout(() => { message.value = '' }, 3000)
}

async function copyDeliveryJson() {
  if (!props.deliveryPackage) return
  copyingDeliveryJson.value = true
  message.value = ''
  try {
    await navigator.clipboard.writeText(currentDeliveryPackageJson())
    message.value = 'GEARS 供稿包 JSON 已复制到剪贴板'
  } catch {
    message.value = '复制失败，请手动复制'
  } finally {
    copyingDeliveryJson.value = false
    setTimeout(() => { message.value = '' }, 3000)
  }
}

async function copyGearsPullConfig() {
  copyingGearsPull.value = true
  message.value = ''
  const segmentsUrl = absoluteApiUrl(props.gearsSegmentsUrl)
  const deliveryUrl = absoluteApiUrl(`/api/stories/${props.storyId}/gears-delivery`)
  const videoCallbackUrl = absoluteApiUrl('/api/gears-callback/video-ready')
  const config = [
    '# GEARS v2 拉取配置',
    `segments_url: ${segmentsUrl}`,
    `delivery_url: ${deliveryUrl}`,
    `video_callback_url: ${videoCallbackUrl}`,
    '',
    '推荐流程:',
    '1. 拉取 delivery_url 获取人物资产、场景资产、剧本单元和供稿 Markdown。',
    '2. 拉取 segments_url 获取兼容旧流程的分段 JSON。',
    '3. 成片完成后向 video_callback_url 回传 storyId、status、video_url 和 thumbnail_url。',
    '4. 优先使用已编辑保存的供稿 Markdown；若 validation_notes 非空，先完成资料补录。',
  ].join('\n')
  try {
    await navigator.clipboard.writeText(config)
    message.value = 'GEARS 拉取配置已复制到剪贴板'
  } catch {
    message.value = '复制失败，请手动复制 Segments URL 和供稿包 URL'
  } finally {
    copyingGearsPull.value = false
    setTimeout(() => { message.value = '' }, 3000)
  }
}

function absoluteApiUrl(path: string) {
  return new URL(path, getApiPullOrigin()).toString()
}

function getApiPullOrigin() {
  const current = new URL(window.location.origin)
  const isLocalDevFrontend = current.port === '5173'
    && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(current.hostname)
  if (isLocalDevFrontend) {
    current.port = '3000'
  }
  return current.origin
}

function exportDeliveryJson() {
  if (!props.deliveryPackage) return
  downloadText(`${props.storyId}-gears-delivery.json`, currentDeliveryPackageJson(), 'application/json')
  message.value = '供稿包 JSON 已下载'
  setTimeout(() => { message.value = '' }, 3000)
}

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
  downloadText(`${props.storyId}-gears-segments.json`, json, 'application/json')
  message.value = '文件已下载'
  setTimeout(() => { message.value = '' }, 3000)
}

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
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

.gears-actions__asset-genders {
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid #9fbad0;
  border-radius: 6px;
  background: #f8fbfd;
}

.gears-actions__asset-genders-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  color: #2c3e50;
  font-size: 13px;
}

.gears-actions__asset-genders-head span {
  color: #566573;
  text-align: right;
}

.gears-actions__asset-gender-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 6px;
}

.gears-actions__asset-gender-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid #d6e4ee;
  border-radius: 4px;
  background: #fff;
}

.gears-actions__asset-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #2c3e50;
  font-size: 13px;
}

.gears-actions__gender-pill {
  flex: 0 0 auto;
  min-width: 44px;
  padding: 2px 7px;
  border-radius: 999px;
  background: #edf1f5;
  color: #34495e;
  font-size: 12px;
  text-align: center;
}

.gears-actions__gender-pill--male {
  background: #e8f3ff;
  color: #1b5f9e;
}

.gears-actions__gender-pill--female {
  background: #fff0f5;
  color: #a23b66;
}

.gears-actions__gender-pill--other {
  background: #f3efff;
  color: #6c4bb2;
}

.gears-actions__gender-pill--unspecified {
  background: #f4f6f7;
  color: #6f7f8d;
}

.gears-actions__gender-pill--na {
  background: #eef8ef;
  color: #287a3e;
}

.gears-actions__buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gears-actions__single-copy {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.gears-actions__select {
  flex: 1;
  min-width: 180px;
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

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn--blue {
  background: #2980b9;
  color: #fff;
}

.btn--ghost {
  background: #fff;
  color: #2c3e50;
  border: 1px solid #bdc3c7;
}

.btn--sm {
  padding: 6px 12px;
  font-size: 13px;
}

.gears-actions__editor {
  margin-top: 14px;
  padding: 12px;
  border: 1px solid #bdc3c7;
  border-radius: 6px;
  background: #fff;
}

.gears-actions__editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.gears-actions__editor-title {
  margin: 0;
  font-size: 15px;
  color: #2c3e50;
}

.gears-actions__editor-state {
  margin: 3px 0 0;
  font-size: 12px;
  color: #7f8c8d;
}

.gears-actions__textarea {
  width: 100%;
  min-height: 360px;
  max-height: 560px;
  resize: vertical;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #2c3e50;
  background: #fbfcfd;
}

.gears-actions__validation {
  margin-top: 10px;
  padding: 8px 10px;
  border: 1px solid #f39c12;
  border-radius: 4px;
  background: #fef9e7;
  color: #7d6608;
  font-size: 13px;
}

.gears-actions__validation ul {
  margin: 6px 0 0;
  padding-left: 18px;
}

.gears-actions__notice {
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid #f39c12;
  border-radius: 4px;
  background: #fff8df;
  color: #6f5600;
  font-size: 13px;
}

.gears-actions__notice-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.gears-actions__notice ul {
  margin: 6px 0 0;
  padding-left: 18px;
}

.gears-actions__notice-more {
  margin: 6px 0 0;
  color: #7d6608;
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
