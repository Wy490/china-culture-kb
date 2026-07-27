<template>
  <section class="text-material" data-testid="reference-text-material-workbench">
    <header class="text-material__heading">
      <div>
        <p>Authorized text material</p>
        <h2>授权文字材料</h2>
      </div>
      <span :class="material ? 'status status--sealed' : 'status'">
        {{ loading ? '检查中' : material ? '已封存' : '未封存' }}
      </span>
    </header>

    <div class="text-material__boundary">
      只接收用户自有、已授权或公版的小说/剧本文字。服务端不会下载来源 URL；
      原文按不可信数据处理，不能注入 prompt、自动写回知识库、授予人工通过或生产信用。
    </div>

    <p v-if="!eligible" class="notice notice--warning">
      该入口要求小说或剧本来源、合法权利状态、摘录或用户完整提供范围，以及预先登记的精确 SHA-256。
    </p>

    <template v-else-if="material">
      <dl class="text-material__facts" data-testid="reference-text-material-summary">
        <div><dt>Material ID</dt><dd class="hash">{{ material.material_id }}</dd></div>
        <div><dt>内容类型</dt><dd>{{ material.content_type }}</dd></div>
        <div><dt>SHA-256</dt><dd class="hash">{{ material.content_sha256 }}</dd></div>
        <div><dt>精确字节</dt><dd>{{ material.byte_length.toLocaleString() }}</dd></div>
        <div><dt>Unicode 字符</dt><dd>{{ material.character_count.toLocaleString() }}</dd></div>
        <div><dt>行数</dt><dd>{{ material.line_count.toLocaleString() }}</dd></div>
        <div><dt>服务端下载</dt><dd class="truth-false">false</dd></div>
        <div><dt>真人评审 / 生产信用</dt><dd class="truth-false">false / false</dd></div>
      </dl>

      <div v-if="manifest" class="text-material__manifest" data-testid="reference-text-material-manifest">
        <div class="text-material__manifest-heading">
          <div>
            <strong>确定性分块清单</strong>
            <small>仅显示 locator、长度和哈希；不在此处回显来源正文。</small>
          </div>
          <span>{{ manifest.chunk_count }} 块 · 每块最多 {{ manifest.chunk_character_limit.toLocaleString() }} 字符</span>
        </div>
        <code>{{ manifest.chunk_endpoint_template }}</code>
        <details>
          <summary>查看 {{ manifest.chunk_count }} 个 chunk 描述符</summary>
          <ol>
            <li v-for="chunk in manifest.chunks" :key="chunk.chunk_id">
              <strong>{{ chunk.chunk_id }}</strong>
              <span>{{ chunk.locator }} · {{ chunk.byte_length.toLocaleString() }} bytes</span>
              <code>{{ chunk.content_sha256 }}</code>
            </li>
          </ol>
        </details>
      </div>
    </template>

    <form v-else class="text-material__form" @submit.prevent="sealMaterial">
      <p v-if="!canSign" class="notice notice--warning">
        当前角色没有 <code>material:sign</code> 权限；只能查看状态，不能封存授权材料。
      </p>

      <label class="file-picker">
        选择 UTF-8 文本文件（.txt / .md，可选）
        <input
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          :disabled="submitting || !canSign"
          data-testid="reference-text-material-file"
          @change="readSelectedFile"
        >
      </label>

      <div class="text-material__grid">
        <label>
          内容类型
          <select v-model="contentType" :disabled="submitting || !canSign">
            <option value="text/plain">text/plain</option>
            <option value="text/markdown">text/markdown</option>
          </select>
        </label>
        <label>
          权利依据
          <input :value="rightsLabel" disabled>
        </label>
        <label class="text-material__wide">
          来源文字（最多 500,000 字符 / 1,500,000 UTF-8 bytes）
          <textarea
            v-model="content"
            rows="12"
            spellcheck="false"
            :disabled="submitting || !canSign"
            data-testid="reference-text-material-content"
            @input="digest = ''"
          />
        </label>
      </div>

      <div class="fingerprint-check" :class="fingerprintMatches ? 'fingerprint-check--match' : ''">
        <div>
          <span>登记指纹</span>
          <code>{{ source.content_fingerprint }}</code>
        </div>
        <div>
          <span>当前文字</span>
          <code>{{ digest || '尚未校验' }}</code>
        </div>
        <small>
          {{ contentStats }}
          <template v-if="digest"> · {{ fingerprintMatches ? '精确匹配' : '不匹配，禁止封存' }}</template>
        </small>
        <button
          type="button"
          :disabled="!content || hashing || submitting || !canSign"
          data-testid="validate-reference-text-fingerprint"
          @click="validateFingerprint"
        >
          {{ hashing ? '正在计算…' : '计算并校验 SHA-256' }}
        </button>
      </div>

      <div class="text-material__grid">
        <label class="text-material__wide">
          授权依据编号 / 文件引用
          <input
            v-model.trim="authorizationReference"
            maxlength="500"
            :disabled="submitting || !canSign"
            placeholder="例如：license-contract-2026-07"
          >
        </label>
        <label>
          声明人（当前登录 actor）
          <input :value="actorId" disabled data-testid="reference-text-material-attested-by">
        </label>
        <label>
          声明时间（ISO 8601）
          <input v-model.trim="attestedAt" :disabled="submitting || !canSign">
        </label>
      </div>

      <label class="text-material__confirmation">
        <input
          v-model="confirmed"
          type="checkbox"
          :disabled="submitting || !canSign"
          data-testid="reference-text-material-confirmation"
        >
        <span>
          我确认有权提交此文字；本次封存不代表机器核验授权真伪，也不构成人工分析通过或生产授权。
        </span>
      </label>

      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
      <p v-if="notice" class="notice notice--success" role="status">{{ notice }}</p>

      <button
        type="submit"
        class="text-material__submit"
        :disabled="!canSubmit"
        data-testid="seal-reference-text-material"
      >
        {{ submitting ? '正在封存…' : '封存授权文字材料' }}
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  ReferenceRightsStatus,
  ReferenceSourceRecord,
  ReferenceTextMaterialContentType,
  ReferenceTextMaterialManifest,
  ReferenceTextMaterialRecord,
} from '@shared/types'
import {
  createReferenceTextMaterial,
  getReferenceTextMaterialManifest,
  getReferenceTextMaterialStatus,
} from '@/api/reference-library'

const props = defineProps<{
  source: ReferenceSourceRecord
  canSign: boolean
  actorId: string
}>()
const emit = defineEmits<{
  sealed: [material: ReferenceTextMaterialRecord]
}>()

const MAX_CHARACTERS = 500_000
const MAX_BYTES = 1_500_000
const AUTHORIZED_RIGHTS = new Set<ReferenceRightsStatus>([
  'user_owned',
  'licensed',
  'public_domain',
])
const rightsLabels: Record<ReferenceRightsStatus, string> = {
  user_owned: '用户自有',
  licensed: '已授权',
  public_domain: '公版',
  research_only: '仅研究',
  unknown: '未知',
}

const loading = ref(false)
const submitting = ref(false)
const hashing = ref(false)
const material = ref<ReferenceTextMaterialRecord | null>(null)
const manifest = ref<ReferenceTextMaterialManifest | null>(null)
const content = ref('')
const contentType = ref<ReferenceTextMaterialContentType>('text/plain')
const digest = ref('')
const authorizationReference = ref('')
const attestedAt = ref(new Date().toISOString())
const confirmed = ref(false)
const error = ref('')
const notice = ref('')
let sourceGeneration = 0

const eligible = computed(() => Boolean(
  ['novel', 'screenplay'].includes(props.source.media_type)
  && AUTHORIZED_RIGHTS.has(props.source.rights_status)
  && ['excerpt', 'full_user_supplied'].includes(props.source.access_scope)
  && props.source.content_fingerprint,
))
const rightsLabel = computed(() => rightsLabels[props.source.rights_status])
const byteLength = computed(() => new TextEncoder().encode(content.value).byteLength)
const characterCount = computed(() => Array.from(content.value).length)
const contentWithinLimits = computed(() => (
  characterCount.value > 0
  && characterCount.value <= MAX_CHARACTERS
  && byteLength.value <= MAX_BYTES
))
const contentStats = computed(() => (
  `${characterCount.value.toLocaleString()} 字符 · ${byteLength.value.toLocaleString()} bytes`
))
const fingerprintMatches = computed(() => Boolean(
  digest.value
  && digest.value === props.source.content_fingerprint,
))
const canSubmit = computed(() => Boolean(
  props.canSign
  && eligible.value
  && contentWithinLimits.value
  && fingerprintMatches.value
  && authorizationReference.value
  && props.actorId
  && !Number.isNaN(Date.parse(attestedAt.value))
  && confirmed.value
  && !submitting.value
  && !hashing.value,
))

async function sha256(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('当前浏览器不支持 Web Crypto，无法进行精确 SHA-256 校验')
  }
  const result = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return Array.from(new Uint8Array(result))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function validateFingerprint(): Promise<boolean> {
  error.value = ''
  notice.value = ''
  if (!contentWithinLimits.value) {
    error.value = content.value
      ? '文字超过 500,000 字符或 1,500,000 UTF-8 bytes 上限'
      : '请先提供来源文字'
    digest.value = ''
    return false
  }
  const generation = sourceGeneration
  const input = content.value
  hashing.value = true
  try {
    const computedDigest = await sha256(input)
    if (generation !== sourceGeneration || input !== content.value) return false
    digest.value = computedDigest
  } catch (cause) {
    if (generation !== sourceGeneration) return false
    error.value = cause instanceof Error ? cause.message : '无法计算 SHA-256'
    digest.value = ''
  } finally {
    if (generation === sourceGeneration) hashing.value = false
  }
  if (!fingerprintMatches.value && digest.value) {
    error.value = '当前文字 SHA-256 与来源登记指纹不匹配，禁止封存'
  }
  return fingerprintMatches.value
}

async function readSelectedFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  error.value = ''
  notice.value = ''
  if (file.size > MAX_BYTES) {
    error.value = '文件超过 1,500,000 UTF-8 bytes 上限'
    input.value = ''
    return
  }
  try {
    content.value = await file.text()
    contentType.value = file.name.toLowerCase().endsWith('.md')
      ? 'text/markdown'
      : 'text/plain'
    digest.value = ''
    await validateFingerprint()
  } catch {
    error.value = '无法按 UTF-8 读取所选文本文件'
  }
}

async function loadMaterial(generation: number): Promise<void> {
  const referenceId = props.source.reference_id
  material.value = null
  manifest.value = null
  error.value = ''
  notice.value = ''
  if (!eligible.value) return
  loading.value = true
  const response = await getReferenceTextMaterialStatus(
    referenceId,
  )
  if (
    generation !== sourceGeneration
    || referenceId !== props.source.reference_id
  ) return
  loading.value = false
  if (!response.ok || !response.data) {
    error.value = response.error?.message ?? '读取授权文字材料状态失败'
    return
  }
  if (!response.data.available) return
  material.value = response.data.material
  const manifestResponse = await getReferenceTextMaterialManifest(
    referenceId,
  )
  if (
    generation !== sourceGeneration
    || referenceId !== props.source.reference_id
  ) return
  if (!manifestResponse.ok || !manifestResponse.data) {
    error.value = manifestResponse.error?.message ?? '读取文字分块清单失败'
    return
  }
  manifest.value = manifestResponse.data
}

async function sealMaterial(): Promise<void> {
  if (!await validateFingerprint() || !canSubmit.value) return
  if (!AUTHORIZED_RIGHTS.has(props.source.rights_status)) return
  const generation = sourceGeneration
  const referenceId = props.source.reference_id
  const rightsStatus = props.source.rights_status
  submitting.value = true
  error.value = ''
  notice.value = ''
  const response = await createReferenceTextMaterial(
    referenceId,
    {
      content: content.value,
      content_type: contentType.value,
      authorization: {
        basis: rightsStatus as 'user_owned' | 'licensed' | 'public_domain',
        authorization_reference: authorizationReference.value,
        attested_by: props.actorId,
        attested_at: new Date(attestedAt.value).toISOString(),
        confirmation: 'authorized_reference_text_ingest',
      },
    },
  )
  if (
    generation !== sourceGeneration
    || referenceId !== props.source.reference_id
  ) return
  submitting.value = false
  if (!response.ok || !response.data) {
    error.value = response.error?.message ?? '封存授权文字材料失败'
    return
  }
  material.value = response.data.material
  content.value = ''
  digest.value = ''
  confirmed.value = false
  notice.value = response.data.idempotent_replay
    ? `材料 ${response.data.material.material_id} 已幂等重放。`
    : `材料 ${response.data.material.material_id} 已按精确字节封存。`
  emit('sealed', response.data.material)
  const manifestResponse = await getReferenceTextMaterialManifest(
    referenceId,
  )
  if (
    generation !== sourceGeneration
    || referenceId !== props.source.reference_id
  ) return
  if (!manifestResponse.ok || !manifestResponse.data) {
    error.value = manifestResponse.error?.message ?? '材料已封存，但读取分块清单失败'
    return
  }
  manifest.value = manifestResponse.data
}

watch(
  () => props.source.reference_id,
  () => {
    sourceGeneration += 1
    content.value = ''
    digest.value = ''
    authorizationReference.value = ''
    attestedAt.value = new Date().toISOString()
    confirmed.value = false
    submitting.value = false
    hashing.value = false
    void loadMaterial(sourceGeneration)
  },
  { immediate: true },
)
</script>

<style scoped>
.text-material {
  padding: 20px;
  border: 1px solid #35332e;
  border-radius: 16px;
  background: #1c1c19;
  color: #e7e2d7;
}

.text-material__heading,
.text-material__manifest-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.text-material__heading p {
  margin: 0 0 7px;
  color: #d7a75d;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.text-material h2 {
  margin: 0;
}

.status {
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(204, 166, 79, 0.16);
  color: #e3c073;
  font-size: 10px;
  font-weight: 700;
}

.status--sealed {
  background: rgba(57, 150, 102, 0.17);
  color: #83d4a8;
}

.text-material__boundary {
  margin: 14px 0;
  padding: 11px 13px;
  border-left: 3px solid #d7a75d;
  background: rgba(215, 167, 93, 0.08);
  color: #b9b1a5;
  font-size: 12px;
  line-height: 1.6;
}

.text-material__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  overflow: hidden;
  border-radius: 10px;
  background: #34312a;
}

.text-material__facts div {
  min-width: 0;
  padding: 12px;
  background: #23221e;
}

.text-material dt {
  margin-bottom: 5px;
  color: #8f897f;
  font-size: 11px;
}

.text-material dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.hash,
.text-material code {
  font: 11px/1.6 ui-monospace, monospace;
  overflow-wrap: anywhere;
}

.truth-false {
  color: #ff9f81;
  font-weight: 700;
}

.text-material__manifest {
  margin-top: 12px;
  padding: 13px;
  border: 1px solid #38362f;
  border-radius: 10px;
  background: #23221e;
}

.text-material__manifest-heading div {
  display: grid;
  gap: 4px;
}

.text-material__manifest-heading small,
.text-material__manifest-heading > span {
  color: #8e887f;
  font-size: 11px;
}

.text-material__manifest > code {
  display: block;
  margin: 12px 0;
  padding: 8px 10px;
  border-radius: 7px;
  background: #161614;
}

.text-material__manifest summary {
  color: #d7a75d;
  cursor: pointer;
}

.text-material__manifest ol {
  max-height: 360px;
  overflow: auto;
  padding-left: 26px;
}

.text-material__manifest li {
  display: grid;
  gap: 3px;
  margin-bottom: 10px;
  color: #aaa397;
  font-size: 11px;
}

.text-material__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.text-material label {
  color: #aaa397;
  font-size: 12px;
  line-height: 1.5;
}

.text-material input:not([type='checkbox']),
.text-material select,
.text-material textarea {
  box-sizing: border-box;
  width: 100%;
  margin-top: 6px;
  padding: 10px 12px;
  border: 1px solid #444137;
  border-radius: 9px;
  background: #161614;
  color: #e7e2d7;
}

.text-material input:disabled {
  color: #918a80;
}

.text-material__wide {
  grid-column: 1 / -1;
}

.file-picker {
  display: block;
  margin-bottom: 12px;
}

.fingerprint-check {
  display: grid;
  gap: 8px;
  margin: 13px 0;
  padding: 13px;
  border: 1px solid rgba(202, 153, 68, 0.5);
  border-radius: 10px;
}

.fingerprint-check--match {
  border-color: rgba(73, 160, 106, 0.55);
}

.fingerprint-check div {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 8px;
}

.fingerprint-check span,
.fingerprint-check small {
  color: #8e887f;
  font-size: 11px;
}

.fingerprint-check button,
.text-material__submit {
  justify-self: start;
  padding: 10px 15px;
  border: 0;
  border-radius: 9px;
  background: #d6a85e;
  color: #191713;
  font-weight: 800;
  cursor: pointer;
}

.fingerprint-check button:disabled,
.text-material__submit:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.text-material__confirmation {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin: 14px 0;
}

.notice {
  padding: 12px;
  border: 1px solid #3b3933;
  border-radius: 10px;
  color: #bcb5a9;
}

.notice--error {
  border-color: rgba(211, 78, 62, 0.55);
  color: #ff9d8e;
}

.notice--success {
  border-color: rgba(73, 160, 106, 0.55);
  color: #8bd9ac;
}

.notice--warning {
  border-color: rgba(202, 153, 68, 0.5);
  color: #dfbf7d;
}

@media (max-width: 700px) {
  .text-material__heading,
  .text-material__manifest-heading {
    flex-direction: column;
  }

  .text-material__facts,
  .text-material__grid {
    grid-template-columns: 1fr;
  }

  .text-material__wide {
    grid-column: auto;
  }
}
</style>
