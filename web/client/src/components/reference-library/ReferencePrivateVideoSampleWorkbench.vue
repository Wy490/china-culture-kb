<template>
  <section class="private-video" data-testid="reference-private-video-sample-workbench">
    <button
      type="button"
      class="private-video__toggle"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span>
        <small>Private video samples</small>
        <strong>本地私有视频样本</strong>
      </span>
      <span>{{ expanded ? '收起' : '打开工作台' }}</span>
    </button>

    <div v-if="expanded" class="private-video__body">
      <div class="private-video__boundary">
        只接收本机绝对路径；服务端复制到 ignored 私有目录后运行 ffprobe/ffmpeg。
        不上传第三方，不保存用户源路径，不授予真人评审或生产信用。
      </div>

      <p v-if="!canSign" class="private-video__notice private-video__notice--warning">
        当前角色没有 <code>material:sign</code> 权限；只能读取已封存样本，不能新增样本或提交本地转写。
      </p>

      <div class="private-video__columns">
        <form class="private-video__panel" @submit.prevent="ingestSample">
          <header class="private-video__heading">
            <div>
              <p>Local ingest</p>
              <h2>封存本地样本</h2>
            </div>
            <span>local_private_mode = true</span>
          </header>

          <div class="private-video__grid">
            <label>
              样本标题
              <input v-model.trim="title" maxlength="200" :disabled="submitting || !canSign">
            </label>
            <label>
              媒体类型
              <select v-model="mediaType" :disabled="submitting || !canSign">
                <option value="film">电影</option>
                <option value="episode">剧集</option>
                <option value="promo">宣传片</option>
                <option value="tutorial">教程</option>
              </select>
            </label>
            <label>
              权利状态
              <select v-model="rightsStatus" :disabled="submitting || !canSign">
                <option value="user_owned">用户自有</option>
                <option value="licensed">已授权</option>
                <option value="public_domain">公版</option>
              </select>
            </label>
            <label>
              访问范围
              <select v-model="accessScope" :disabled="submitting || !canSign">
                <option value="excerpt">摘录</option>
                <option value="full_user_supplied">用户完整提供</option>
              </select>
            </label>
            <label class="private-video__wide">
              本机视频绝对路径
              <input
                v-model.trim="localVideoPath"
                maxlength="2000"
                spellcheck="false"
                :disabled="submitting || !canSign"
                placeholder="/Users/.../authorized-sample.mp4"
                data-testid="reference-private-video-path"
              >
            </label>
            <label class="private-video__wide">
              使用理由
              <textarea
                v-model.trim="userReason"
                rows="3"
                maxlength="1000"
                :disabled="submitting || !canSign"
              />
            </label>
            <label class="private-video__wide">
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
              <input :value="actorId" disabled>
            </label>
            <label>
              声明时间（ISO 8601）
              <input v-model.trim="attestedAt" :disabled="submitting || !canSign">
            </label>
            <label>
              缩略图时间（秒）
              <input
                v-model.number="thumbnailTimeSeconds"
                type="number"
                min="0"
                max="36000"
                step="0.1"
                :disabled="submitting || !canSign || !extractThumbnail"
              >
            </label>
            <fieldset class="private-video__checks" :disabled="submitting || !canSign">
              <legend>本地派生物</legend>
              <label>
                <input v-model="extractThumbnail" type="checkbox">
                <span>生成 JPEG 缩略图</span>
              </label>
              <label>
                <input v-model="extractAudioWav" type="checkbox">
                <span>提取 16kHz 单声道 wav</span>
              </label>
            </fieldset>
          </div>

          <label class="private-video__confirmation">
            <input
              v-model="confirmed"
              type="checkbox"
              :disabled="submitting || !canSign"
              data-testid="reference-private-video-confirmation"
            >
            <span>
              我确认该本机视频可在私有模式下封存与本地分析；原视频不会进入 Git，也不会上传第三方。
            </span>
          </label>

          <button
            type="submit"
            class="private-video__submit"
            :disabled="!canIngest"
            data-testid="ingest-reference-private-video"
          >
            {{ submitting ? '正在封存…' : '封存本地视频样本' }}
          </button>
        </form>

        <aside class="private-video__panel private-video__panel--lookup">
          <header class="private-video__heading">
            <div>
              <p>Lookup</p>
              <h2>读取样本状态</h2>
            </div>
            <span>record.json</span>
          </header>

          <label>
            Sample ID
            <input
              v-model.trim="lookupSampleId"
              spellcheck="false"
              placeholder="reference-private-video-..."
              :disabled="loading"
            >
          </label>
          <button
            type="button"
            class="private-video__secondary"
            :disabled="!canLookup"
            data-testid="load-reference-private-video"
            @click="loadSample"
          >
            {{ loading ? '正在读取…' : '读取样本' }}
          </button>
        </aside>
      </div>

      <p v-if="error" class="private-video__notice private-video__notice--error" role="alert">
        {{ error }}
      </p>
      <p v-if="notice" class="private-video__notice private-video__notice--success" role="status">
        {{ notice }}
      </p>

      <article v-if="sample" class="private-video__summary" data-testid="reference-private-video-summary">
        <header class="private-video__heading">
          <div>
            <p>Sealed sample</p>
            <h2>{{ sample.title }}</h2>
          </div>
          <span>{{ sample.sample_id }}</span>
        </header>

        <dl class="private-video__facts">
          <div><dt>媒体类型</dt><dd>{{ mediaTypeLabel[sample.media_type] }}</dd></div>
          <div><dt>权利 / 访问</dt><dd>{{ rightsLabel[sample.rights_status] }} · {{ accessLabel[sample.access_scope] }}</dd></div>
          <div><dt>原始文件名</dt><dd>{{ sample.source_video.original_filename }}</dd></div>
          <div><dt>私有相对路径</dt><dd class="private-video__hash">{{ sample.source_video.stored_private_relative_path }}</dd></div>
          <div><dt>视频 SHA-256</dt><dd class="private-video__hash">{{ sample.source_video.content_sha256 }}</dd></div>
          <div><dt>视频字节数</dt><dd>{{ formatNumber(sample.source_video.byte_length) }}</dd></div>
          <div><dt>ffprobe</dt><dd>{{ probeSummary(sample.ffprobe) }}</dd></div>
          <div><dt>转写状态</dt><dd>{{ transcriptSummary(sample.transcript) }}</dd></div>
          <div><dt>机器核验授权</dt><dd class="private-video__false">false</dd></div>
          <div><dt>真人评审 / 生产信用</dt><dd class="private-video__false">false / false</dd></div>
        </dl>

        <div class="private-video__artifact-grid">
          <section :class="artifactClass(sample.ffmpeg_derivatives.thumbnail)">
            <strong>JPEG 缩略图</strong>
            <span>{{ artifactSummary(sample.ffmpeg_derivatives.thumbnail) }}</span>
            <code v-if="sample.ffmpeg_derivatives.thumbnail.status === 'ready'">
              {{ sample.ffmpeg_derivatives.thumbnail.private_relative_path }}
            </code>
            <code v-else-if="sample.ffmpeg_derivatives.thumbnail.status === 'blocked'">
              {{ sample.ffmpeg_derivatives.thumbnail.blocked_reason }}
            </code>
          </section>
          <section :class="artifactClass(sample.ffmpeg_derivatives.audio_wav)">
            <strong>16kHz mono wav</strong>
            <span>{{ artifactSummary(sample.ffmpeg_derivatives.audio_wav) }}</span>
            <code v-if="sample.ffmpeg_derivatives.audio_wav.status === 'ready'">
              {{ sample.ffmpeg_derivatives.audio_wav.private_relative_path }}
            </code>
            <code v-else-if="sample.ffmpeg_derivatives.audio_wav.status === 'blocked'">
              {{ sample.ffmpeg_derivatives.audio_wav.blocked_reason }}
            </code>
          </section>
          <section :class="sample.transcript.status === 'ready' ? 'private-video__artifact private-video__artifact--ready' : 'private-video__artifact'">
            <strong>本地转写</strong>
            <span>{{ transcriptSummary(sample.transcript) }}</span>
            <code v-if="sample.transcript.status === 'ready'">
              {{ sample.transcript.private_relative_path }}
            </code>
          </section>
        </div>

        <dl class="private-video__governance">
          <div><dt>source_video_in_git</dt><dd class="private-video__false">{{ sample.governance.source_video_in_git }}</dd></div>
          <div><dt>source_path_persisted</dt><dd class="private-video__false">{{ sample.governance.source_path_persisted }}</dd></div>
          <div><dt>server_download_allowed</dt><dd class="private-video__false">{{ sample.governance.server_download_allowed }}</dd></div>
          <div><dt>third_party_upload_allowed</dt><dd class="private-video__false">{{ sample.governance.third_party_upload_allowed }}</dd></div>
          <div><dt>external_model_call_performed</dt><dd class="private-video__false">{{ sample.governance.external_model_call_performed }}</dd></div>
          <div><dt>production_credit_granted</dt><dd class="private-video__false">{{ sample.governance.production_credit_granted }}</dd></div>
        </dl>
      </article>

      <form
        v-if="sample && sample.transcript.status === 'not_submitted'"
        class="private-video__transcript"
        data-testid="reference-private-video-transcript-form"
        @submit.prevent="submitTranscript"
      >
        <header class="private-video__heading">
          <div>
            <p>Local transcript</p>
            <h2>封存本地转写</h2>
          </div>
          <span>{{ transcriptStats }}</span>
        </header>

        <div class="private-video__grid">
          <label>
            转写格式
            <select v-model="transcriptFormat" :disabled="transcriptSubmitting || !canSign">
              <option value="text/plain">text/plain</option>
              <option value="text/srt">text/srt</option>
              <option value="text/vtt">text/vtt</option>
            </select>
          </label>
          <label>
            转写方式
            <select v-model="transcriptMethod" :disabled="transcriptSubmitting || !canSign">
              <option value="local_manual">local_manual</option>
              <option value="local_model">local_model</option>
            </select>
          </label>
          <label>
            转写人（当前登录 actor）
            <input :value="actorId" disabled>
          </label>
          <label>
            转写时间（ISO 8601）
            <input v-model.trim="transcribedAt" :disabled="transcriptSubmitting || !canSign">
          </label>
          <label>
            本地工具名（可选）
            <input v-model.trim="toolName" maxlength="120" :disabled="transcriptSubmitting || !canSign">
          </label>
          <label>
            本地工具版本（可选）
            <input v-model.trim="toolVersion" maxlength="120" :disabled="transcriptSubmitting || !canSign">
          </label>
          <label class="private-video__wide">
            本地转写文本
            <textarea
              v-model="transcriptText"
              rows="10"
              maxlength="500000"
              spellcheck="false"
              :disabled="transcriptSubmitting || !canSign"
              data-testid="reference-private-video-transcript-text"
            />
          </label>
        </div>

        <label class="private-video__confirmation">
          <input
            v-model="transcriptConfirmed"
            type="checkbox"
            :disabled="transcriptSubmitting || !canSign"
          >
          <span>我确认转写只在本地完成，未调用外部模型，也未上传到第三方。</span>
        </label>

        <button
          type="submit"
          class="private-video__submit"
          :disabled="!canSubmitTranscript"
          data-testid="submit-reference-private-video-transcript"
        >
          {{ transcriptSubmitting ? '正在封存…' : '封存本地转写' }}
        </button>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  ReferencePrivateVideoAuthorization,
  ReferencePrivateVideoDerivedArtifact,
  ReferencePrivateVideoMediaType,
  ReferencePrivateVideoProbeReport,
  ReferencePrivateVideoSampleRecord,
  ReferencePrivateVideoTranscriptStatus,
} from '@shared/types'
import {
  createReferencePrivateVideoSample,
  getReferencePrivateVideoSample,
  submitReferencePrivateVideoTranscript,
} from '@/api/reference-library'

const props = defineProps<{
  canSign: boolean
  actorId: string
}>()
const emit = defineEmits<{
  created: [sample: ReferencePrivateVideoSampleRecord]
}>()

type AuthorizedRights = ReferencePrivateVideoAuthorization['basis']
type PrivateAccessScope = ReferencePrivateVideoSampleRecord['access_scope']
type TranscriptFormat = Exclude<
  ReferencePrivateVideoTranscriptStatus,
  { status: 'not_submitted' }
>['transcript_format']
type TranscriptMethod = Exclude<
  ReferencePrivateVideoTranscriptStatus,
  { status: 'not_submitted' }
>['method']

const mediaTypeLabel: Record<ReferencePrivateVideoMediaType, string> = {
  film: '电影',
  episode: '剧集',
  promo: '宣传片',
  tutorial: '教程',
}
const rightsLabel: Record<AuthorizedRights, string> = {
  user_owned: '用户自有',
  licensed: '已授权',
  public_domain: '公版',
}
const accessLabel: Record<PrivateAccessScope, string> = {
  excerpt: '摘录',
  full_user_supplied: '用户完整提供',
}

const expanded = ref(true)
const submitting = ref(false)
const loading = ref(false)
const transcriptSubmitting = ref(false)
const error = ref('')
const notice = ref('')
const sample = ref<ReferencePrivateVideoSampleRecord | null>(null)

const title = ref('')
const mediaType = ref<ReferencePrivateVideoMediaType>('film')
const rightsStatus = ref<AuthorizedRights>('user_owned')
const accessScope = ref<PrivateAccessScope>('excerpt')
const localVideoPath = ref('')
const userReason = ref('')
const authorizationReference = ref('')
const attestedAt = ref(new Date().toISOString())
const thumbnailTimeSeconds = ref(0)
const extractThumbnail = ref(true)
const extractAudioWav = ref(true)
const confirmed = ref(false)

const lookupSampleId = ref('')

const transcriptText = ref('')
const transcriptFormat = ref<TranscriptFormat>('text/plain')
const transcriptMethod = ref<TranscriptMethod>('local_manual')
const transcribedAt = ref(new Date().toISOString())
const toolName = ref('')
const toolVersion = ref('')
const transcriptConfirmed = ref(false)

const localPathValid = computed(() => (
  localVideoPath.value.startsWith('/')
  && !/^[a-z][a-z0-9+.-]*:/i.test(localVideoPath.value)
))
const thumbnailSecondsValid = computed(() => {
  const value = Number(thumbnailTimeSeconds.value)
  return Number.isFinite(value) && value >= 0 && value <= 36_000
})
const canIngest = computed(() => Boolean(
  props.canSign
  && title.value
  && localPathValid.value
  && userReason.value
  && authorizationReference.value
  && props.actorId
  && isIsoTimestamp(attestedAt.value)
  && (!extractThumbnail.value || thumbnailSecondsValid.value)
  && confirmed.value
  && !submitting.value,
))
const canLookup = computed(() => (
  /^reference-private-video-[a-f0-9]{24}$/.test(lookupSampleId.value)
  && !loading.value
))
const transcriptCharacterCount = computed(() => Array.from(transcriptText.value).length)
const transcriptByteLength = computed(() => new TextEncoder().encode(transcriptText.value).byteLength)
const transcriptStats = computed(() => (
  `${formatNumber(transcriptCharacterCount.value)} 字符 · ${formatNumber(transcriptByteLength.value)} bytes`
))
const canSubmitTranscript = computed(() => Boolean(
  props.canSign
  && sample.value
  && sample.value.transcript.status === 'not_submitted'
  && transcriptText.value.trim()
  && transcriptCharacterCount.value <= 500_000
  && props.actorId
  && isIsoTimestamp(transcribedAt.value)
  && transcriptConfirmed.value
  && !transcriptSubmitting.value,
))

function isIsoTimestamp(value: string): boolean {
  return value.length > 0 && !Number.isNaN(Date.parse(value))
}

function optional(value: string): string | undefined {
  return value.trim() || undefined
}

function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN')
}

function resetIngestForm(): void {
  title.value = ''
  localVideoPath.value = ''
  userReason.value = ''
  authorizationReference.value = ''
  attestedAt.value = new Date().toISOString()
  thumbnailTimeSeconds.value = 0
  confirmed.value = false
}

function resetTranscriptForm(): void {
  transcriptText.value = ''
  transcribedAt.value = new Date().toISOString()
  toolName.value = ''
  toolVersion.value = ''
  transcriptConfirmed.value = false
}

function probeSummary(report: ReferencePrivateVideoProbeReport): string {
  if (report.status === 'blocked') return `blocked: ${report.blocked_reason}`
  const duration = typeof report.duration_seconds === 'number'
    ? `${report.duration_seconds.toFixed(2)}s`
    : 'duration unknown'
  return `ready · ${duration} · ${report.video_streams.length} video / ${report.audio_streams.length} audio`
}

function artifactSummary(artifact: ReferencePrivateVideoDerivedArtifact): string {
  if (artifact.status === 'not_requested') return 'not_requested'
  if (artifact.status === 'blocked') return `blocked · ${artifact.kind}`
  return `ready · ${formatNumber(artifact.byte_length)} bytes`
}

function artifactClass(artifact: ReferencePrivateVideoDerivedArtifact): string {
  return `private-video__artifact private-video__artifact--${artifact.status}`
}

function transcriptSummary(transcript: ReferencePrivateVideoTranscriptStatus): string {
  if (transcript.status === 'not_submitted') return 'not_submitted'
  return `ready · ${transcript.transcript_format} · ${formatNumber(transcript.byte_length)} bytes`
}

async function ingestSample(): Promise<void> {
  if (!canIngest.value) {
    error.value = localPathValid.value
      ? '请填写必填字段并确认本地私有封存边界'
      : '本机视频路径必须是绝对路径，且不能是 URL 或 file: URI'
    return
  }
  submitting.value = true
  error.value = ''
  notice.value = ''
  const response = await createReferencePrivateVideoSample({
    title: title.value,
    media_type: mediaType.value,
    local_video_path: localVideoPath.value,
    rights_status: rightsStatus.value,
    access_scope: accessScope.value,
    user_reason: userReason.value,
    authorization: {
      basis: rightsStatus.value,
      authorization_reference: authorizationReference.value,
      attested_by: props.actorId,
      attested_at: new Date(attestedAt.value).toISOString(),
      confirmation: 'authorized_private_video_ingest',
    },
    thumbnail_time_seconds: extractThumbnail.value
      ? Number(thumbnailTimeSeconds.value)
      : undefined,
    extract_thumbnail: extractThumbnail.value,
    extract_audio_wav: extractAudioWav.value,
  })
  submitting.value = false
  if (!response.ok || !response.data) {
    error.value = response.error?.message ?? '封存本地视频样本失败'
    return
  }
  sample.value = response.data.sample
  lookupSampleId.value = response.data.sample.sample_id
  notice.value = response.data.idempotent_replay
    ? `样本 ${response.data.sample.sample_id} 已幂等重放。`
    : `样本 ${response.data.sample.sample_id} 已封存到本地私有目录。`
  resetIngestForm()
  resetTranscriptForm()
  emit('created', response.data.sample)
}

async function loadSample(): Promise<void> {
  if (!canLookup.value) return
  loading.value = true
  error.value = ''
  notice.value = ''
  const response = await getReferencePrivateVideoSample(lookupSampleId.value)
  loading.value = false
  if (!response.ok || !response.data) {
    error.value = response.error?.message ?? '读取本地私有视频样本失败'
    return
  }
  sample.value = response.data
  resetTranscriptForm()
}

async function submitTranscript(): Promise<void> {
  if (!sample.value || !canSubmitTranscript.value) {
    error.value = '请提供本地转写文本，并确认未调用外部模型或第三方上传'
    return
  }
  transcriptSubmitting.value = true
  error.value = ''
  notice.value = ''
  const response = await submitReferencePrivateVideoTranscript(sample.value.sample_id, {
    transcript_text: transcriptText.value,
    transcript_format: transcriptFormat.value,
    transcribed_by: props.actorId,
    transcribed_at: new Date(transcribedAt.value).toISOString(),
    method: transcriptMethod.value,
    tool_name: optional(toolName.value),
    tool_version: optional(toolVersion.value),
    confirmation: 'local_private_transcription_only',
  })
  transcriptSubmitting.value = false
  if (!response.ok || !response.data) {
    error.value = response.error?.message ?? '封存本地转写失败'
    return
  }
  sample.value = response.data.sample
  resetTranscriptForm()
  notice.value = response.data.idempotent_replay
    ? `转写 ${response.data.sample.transcript.status === 'ready' ? response.data.sample.transcript.transcript_id : ''} 已幂等重放。`
    : '本地转写已封存；页面不会回显 transcript 正文。'
}
</script>

<style scoped>
.private-video {
  margin: 16px 0;
  overflow: hidden;
  border: 1px solid #3c3932;
  border-radius: 14px;
  background: #1c1c19;
  color: #e7e2d7;
}

.private-video__toggle {
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

.private-video__toggle span:first-child {
  display: grid;
  gap: 3px;
}

.private-video__toggle small,
.private-video__heading p {
  margin: 0;
  color: #d7a75d;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.private-video__toggle span:last-child {
  color: #9e978c;
  font-size: 12px;
}

.private-video__body {
  padding: 0 20px 20px;
  border-top: 1px solid #34322d;
}

.private-video__boundary {
  margin: 16px 0;
  padding: 12px;
  border-left: 3px solid #d7a75d;
  background: rgba(215, 167, 93, 0.08);
  color: #b6aea2;
  font-size: 12px;
  line-height: 1.6;
}

.private-video__columns {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.65fr);
  gap: 12px;
}

.private-video__panel,
.private-video__summary,
.private-video__transcript {
  min-width: 0;
  padding: 16px;
  border: 1px solid #38362f;
  border-radius: 10px;
  background: #23221e;
}

.private-video__panel--lookup {
  align-self: start;
}

.private-video__summary,
.private-video__transcript {
  margin-top: 12px;
}

.private-video__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 14px;
}

.private-video__heading div {
  min-width: 0;
}

.private-video__heading h2 {
  margin: 6px 0 0;
  font-size: 20px;
}

.private-video__heading > span {
  max-width: 48%;
  overflow-wrap: anywhere;
  color: #847f76;
  font: 11px/1.5 ui-monospace, monospace;
  text-align: right;
}

.private-video__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.private-video__wide {
  grid-column: 1 / -1;
}

.private-video label,
.private-video legend {
  color: #aaa397;
  font-size: 12px;
  line-height: 1.5;
}

.private-video input:not([type='checkbox']),
.private-video select,
.private-video textarea {
  box-sizing: border-box;
  width: 100%;
  margin-top: 6px;
  padding: 10px 12px;
  border: 1px solid #444137;
  border-radius: 8px;
  outline: none;
  background: #161614;
  color: #e7e2d7;
}

.private-video input:focus,
.private-video select:focus,
.private-video textarea:focus {
  border-color: #c09151;
  box-shadow: 0 0 0 3px rgba(192, 145, 81, 0.12);
}

.private-video input:disabled,
.private-video select:disabled,
.private-video textarea:disabled {
  color: #918a80;
}

.private-video textarea {
  resize: vertical;
  font: 12px/1.55 ui-monospace, monospace;
}

.private-video__checks {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  border: 0;
}

.private-video__checks label,
.private-video__confirmation {
  display: flex;
  align-items: flex-start;
  gap: 9px;
}

.private-video__confirmation {
  margin: 14px 0;
}

.private-video__submit,
.private-video__secondary {
  padding: 10px 15px;
  border: 0;
  border-radius: 8px;
  background: #d6a85e;
  color: #191713;
  font-weight: 800;
  cursor: pointer;
}

.private-video__secondary {
  margin-top: 12px;
  background: #4a4336;
  color: #e7e2d7;
}

.private-video__submit:disabled,
.private-video__secondary:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.private-video__notice {
  padding: 12px;
  border: 1px solid #3b3933;
  border-radius: 10px;
  color: #bcb5a9;
}

.private-video__notice--error {
  border-color: rgba(211, 78, 62, 0.55);
  color: #ff9d8e;
}

.private-video__notice--success {
  border-color: rgba(73, 160, 106, 0.55);
  color: #8bd9ac;
}

.private-video__notice--warning {
  border-color: rgba(202, 153, 68, 0.5);
  color: #dfbf7d;
}

.private-video__facts,
.private-video__governance {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  overflow: hidden;
  border-radius: 8px;
  background: #34312a;
}

.private-video__facts div,
.private-video__governance div {
  min-width: 0;
  padding: 12px;
  background: #1c1c19;
}

.private-video dt {
  margin-bottom: 5px;
  color: #8f897f;
  font-size: 11px;
}

.private-video dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.private-video__hash,
.private-video code {
  font: 11px/1.6 ui-monospace, monospace;
  overflow-wrap: anywhere;
}

.private-video__false {
  color: #ff9f81;
  font-weight: 700;
}

.private-video__artifact-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 12px 0;
}

.private-video__artifact {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 12px;
  border: 1px solid rgba(202, 153, 68, 0.45);
  border-radius: 8px;
  background: #1c1c19;
}

.private-video__artifact span {
  color: #aaa397;
  font-size: 12px;
}

.private-video__artifact--ready {
  border-color: rgba(73, 160, 106, 0.55);
}

.private-video__artifact--blocked {
  border-color: rgba(211, 78, 62, 0.55);
}

.private-video__artifact--not_requested {
  border-color: #3f3b32;
}

@media (max-width: 900px) {
  .private-video__columns,
  .private-video__artifact-grid {
    grid-template-columns: 1fr;
  }

  .private-video__heading {
    flex-direction: column;
  }

  .private-video__heading > span {
    max-width: none;
    text-align: left;
  }
}

@media (max-width: 620px) {
  .private-video__grid,
  .private-video__facts,
  .private-video__governance {
    grid-template-columns: 1fr;
  }

  .private-video__wide {
    grid-column: auto;
  }
}
</style>
