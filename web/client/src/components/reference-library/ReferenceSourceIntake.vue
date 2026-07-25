<template>
  <section class="source-intake">
    <button
      type="button"
      class="source-intake__toggle"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span>
        <small>Source intake</small>
        <strong>登记参考来源</strong>
      </span>
      <span>{{ expanded ? '收起' : '打开录入' }}</span>
    </button>

    <form v-if="expanded" class="source-intake__form" @submit.prevent="submit">
      <p class="source-intake__boundary">
        只登记来源元数据、使用理由与可选 SHA-256。本表单没有正文、文件上传或 URL 抓取能力。
      </p>
      <div class="source-intake__grid">
        <label>
          来源标题
          <input v-model.trim="title" name="reference_title" required maxlength="200">
        </label>
        <label>
          媒体类型
          <select v-model="mediaType" name="reference_media_type">
            <option value="film">电影</option>
            <option value="episode">剧集</option>
            <option value="promo">宣传片</option>
            <option value="tutorial">教程</option>
            <option value="novel">小说</option>
            <option value="screenplay">剧本</option>
          </select>
        </label>
        <label>
          权利状态
          <select v-model="rightsStatus" name="reference_rights_status">
            <option value="unknown">未知</option>
            <option value="research_only">仅研究</option>
            <option value="user_owned">用户自有</option>
            <option value="licensed">已授权</option>
            <option value="public_domain">公版</option>
          </select>
        </label>
        <label>
          访问范围
          <select v-model="accessScope" name="reference_access_scope">
            <option value="metadata_only">仅元数据</option>
            <option value="excerpt">摘录</option>
            <option value="full_user_supplied">用户完整提供</option>
          </select>
        </label>
        <label>
          来源 URL（可选，只保存不抓取）
          <input v-model.trim="sourceUrl" name="reference_source_url" type="url" maxlength="2000" placeholder="https://…">
        </label>
        <label>
          平台（可选）
          <input v-model.trim="platform" name="reference_platform" maxlength="120">
        </label>
        <label>
          创作者（可选）
          <input v-model.trim="creator" name="reference_creator" maxlength="200">
        </label>
        <label>
          访问时间（ISO 8601）
          <input v-model.trim="accessedAt" name="reference_accessed_at" required>
        </label>
        <label class="source-intake__wide">
          内容 SHA-256（可选；创建分析任务时必需）
          <input
            v-model.trim="contentFingerprint"
            name="reference_content_fingerprint"
            maxlength="64"
            spellcheck="false"
            placeholder="64 位小写十六进制"
          >
        </label>
        <label class="source-intake__wide">
          登记理由
          <textarea v-model.trim="userReason" name="reference_user_reason" required maxlength="1000" rows="3" />
        </label>
      </div>
      <label class="source-intake__confirmation">
        <input v-model="metadataOnlyConfirmed" name="reference_metadata_only_confirmation" type="checkbox">
        <span>我确认本次提交只含元数据和指纹，不含来源正文或文件内容。</span>
      </label>
      <p v-if="error" class="source-intake__notice source-intake__notice--error" role="alert">
        {{ error }}
      </p>
      <p v-if="notice" class="source-intake__notice" role="status">{{ notice }}</p>
      <button type="submit" class="source-intake__submit" :disabled="!canSubmit">
        {{ submitting ? '正在登记…' : '登记来源元数据' }}
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  ReferenceAccessScope,
  ReferenceRightsStatus,
  ReferenceSourceMediaType,
  ReferenceSourceRecord,
} from '@shared/types'
import { createReferenceSource } from '@/api/reference-library'

const emit = defineEmits<{
  created: [source: ReferenceSourceRecord]
}>()

const expanded = ref(false)
const submitting = ref(false)
const error = ref('')
const notice = ref('')
const title = ref('')
const mediaType = ref<ReferenceSourceMediaType>('film')
const rightsStatus = ref<ReferenceRightsStatus>('unknown')
const accessScope = ref<ReferenceAccessScope>('metadata_only')
const sourceUrl = ref('')
const platform = ref('')
const creator = ref('')
const accessedAt = ref(new Date().toISOString())
const contentFingerprint = ref('')
const userReason = ref('')
const metadataOnlyConfirmed = ref(false)

const fingerprintValid = computed(() => (
  !contentFingerprint.value || /^[a-f0-9]{64}$/.test(contentFingerprint.value)
))
const canSubmit = computed(() => Boolean(
  title.value
  && userReason.value
  && !Number.isNaN(Date.parse(accessedAt.value))
  && fingerprintValid.value
  && metadataOnlyConfirmed.value
  && !submitting.value,
))

function optional(value: string): string | undefined {
  return value || undefined
}

async function submit(): Promise<void> {
  if (!canSubmit.value) {
    error.value = fingerprintValid.value
      ? '请填写必填字段并确认本次不提交来源正文'
      : '内容指纹必须是 64 位小写十六进制 SHA-256'
    return
  }
  error.value = ''
  notice.value = ''
  submitting.value = true
  const response = await createReferenceSource({
    title: title.value,
    media_type: mediaType.value,
    source_url: optional(sourceUrl.value),
    platform: optional(platform.value),
    creator: optional(creator.value),
    accessed_at: new Date(accessedAt.value).toISOString(),
    rights_status: rightsStatus.value,
    access_scope: accessScope.value,
    content_fingerprint: optional(contentFingerprint.value),
    user_reason: userReason.value,
  })
  submitting.value = false
  if (!response.ok || !response.data) {
    error.value = response.error?.message ?? '登记参考来源失败'
    return
  }
  notice.value = `已登记 ${response.data.reference_id}；未保存任何来源正文。`
  emit('created', response.data)
  title.value = ''
  sourceUrl.value = ''
  platform.value = ''
  creator.value = ''
  contentFingerprint.value = ''
  userReason.value = ''
  metadataOnlyConfirmed.value = false
}
</script>

<style scoped>
.source-intake {
  margin: 16px 0;
  overflow: hidden;
  border: 1px solid #3c3932;
  border-radius: 14px;
  background: #1c1c19;
  color: #e7e2d7;
}

.source-intake__toggle {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 20px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.source-intake__toggle span:first-child {
  display: grid;
  gap: 3px;
}

.source-intake__toggle small {
  color: #d7a75d;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.source-intake__toggle span:last-child {
  color: #9e978c;
  font-size: 12px;
}

.source-intake__form {
  padding: 0 20px 20px;
  border-top: 1px solid #34322d;
}

.source-intake__boundary {
  margin: 16px 0;
  padding: 12px;
  border-left: 3px solid #d7a75d;
  background: rgba(215, 167, 93, 0.08);
  color: #b6aea2;
  font-size: 12px;
  line-height: 1.6;
}

.source-intake__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.source-intake label {
  color: #aaa397;
  font-size: 12px;
  line-height: 1.5;
}

.source-intake input:not([type='checkbox']),
.source-intake select,
.source-intake textarea {
  box-sizing: border-box;
  width: 100%;
  margin-top: 6px;
  padding: 10px 12px;
  border: 1px solid #444137;
  border-radius: 9px;
  background: #161614;
  color: #e7e2d7;
}

.source-intake__wide {
  grid-column: 1 / -1;
}

.source-intake__confirmation {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin: 14px 0;
}

.source-intake__submit {
  padding: 10px 16px;
  border: 0;
  border-radius: 9px;
  background: #d6a85e;
  color: #191713;
  font-weight: 800;
  cursor: pointer;
}

.source-intake__submit:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.source-intake__notice {
  padding: 10px 12px;
  border: 1px solid rgba(73, 160, 106, 0.55);
  border-radius: 9px;
  color: #8bd9ac;
}

.source-intake__notice--error {
  border-color: rgba(211, 78, 62, 0.55);
  color: #ff9d8e;
}

@media (max-width: 700px) {
  .source-intake__grid {
    grid-template-columns: 1fr;
  }

  .source-intake__wide {
    grid-column: auto;
  }
}
</style>
