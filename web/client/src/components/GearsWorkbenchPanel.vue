<template>
  <section class="workbench" data-testid="gears-workbench-panel">
    <div class="workbench__head">
      <div>
        <p class="workbench__eyebrow">GEARS 导演工作台 · 仅数据导入</p>
        <h2>Workbench 映射与导入</h2>
        <p>
          将当前 Story Agent 版本映射为 GEARS 项目、角色、场景和分镜草稿。
          这里不提交 execution worker、不生成媒体，也不写入真实回片 ledger。
        </p>
      </div>
      <button class="workbench__button" :disabled="probing" @click="probeCapabilities">
        {{ probing ? '探测中…' : '探测能力' }}
      </button>
    </div>

    <div v-if="loadingConfig" class="workbench__notice">正在读取 workbench 配置…</div>
    <div v-else-if="config" class="workbench__config">
      <span :class="{ 'workbench__chip--ready': config.api_base_url_configured }">
        API {{ config.api_base_url_configured ? '已配置' : '未配置' }}
      </span>
      <span :class="{ 'workbench__chip--ready': config.api_token_configured }">
        Token {{ config.api_token_configured ? '已配置' : '未配置' }}
      </span>
      <span>execution worker 配置复用：否</span>
      <span>真实回片计分：0</span>
    </div>

    <div v-if="config?.missing_requirements.length" class="workbench__warning">
      缺少：{{ config.missing_requirements.join('、') }}
    </div>
    <div v-for="warning in config?.configuration_warnings ?? []" :key="warning" class="workbench__warning">
      {{ warning }}
    </div>
    <div v-if="error" class="workbench__error">{{ error }}</div>

    <template v-if="capabilities">
      <div class="workbench__capabilities">
        <span>契约 {{ capabilities.schema_version }}</span>
        <span>原子 execute</span>
        <span>幂等重放</span>
        <span>execution worker：不支持</span>
        <span v-if="capabilities.operator_recipe_promotion_supported">
          正式 Recipe：人工选择真实资产版本后升级
        </span>
        <span>升级调用 provider：{{ capabilities.promotion_invokes_provider ? '是' : '否' }}</span>
      </div>

      <div class="workbench__mapping">
        <label>
          角色风格包
          <select v-model="mapping.character_style_pack_id">
            <option v-for="id in capabilities.available_character_style_pack_ids" :key="id" :value="id">{{ id }}</option>
          </select>
        </label>
        <label>
          场景风格包
          <select v-model="mapping.scene_style_pack_id">
            <option v-for="id in capabilities.available_scene_style_pack_ids" :key="id" :value="id">{{ id }}</option>
          </select>
        </label>
        <label>
          调度包
          <select v-model="mapping.staging_pack_id">
            <option v-for="id in capabilities.available_staging_pack_ids" :key="id" :value="id">{{ id }}</option>
          </select>
        </label>
        <label>
          视觉包
          <select v-model="mapping.visual_pack_id">
            <option v-for="id in capabilities.available_visual_pack_ids" :key="id" :value="id">{{ id }}</option>
          </select>
        </label>
        <label class="workbench__idempotency">
          幂等键（留空使用当前项目版本默认键）
          <input v-model.trim="idempotencyKey" maxlength="200" placeholder="story-agent:project:story:version" />
        </label>
      </div>

      <div class="workbench__actions">
        <button class="workbench__button" :disabled="busy || !mappingComplete" @click="runDryRun">
          {{ dryRunning ? '校验中…' : 'Dry-run' }}
        </button>
        <button
          class="workbench__button workbench__button--primary"
          :disabled="busy || !canExecute"
          @click="runExecute"
        >
          {{ executing ? '导入中…' : '执行幂等导入' }}
        </button>
        <small>修改映射后必须重新 dry-run；execute 只写 GEARS 工作台数据。</small>
      </div>
    </template>

    <div v-if="result" class="workbench__result" :data-status="result.status">
      <div class="workbench__result-head">
        <strong>{{ result.mode === 'dry_run' ? 'Dry-run' : 'Execute' }} · {{ statusLabel(result.status) }}</strong>
        <span v-if="result.replayed">幂等重放</span>
        <span v-if="result.import_id">import {{ result.import_id }}</span>
      </div>
      <p>
        实体 {{ result.summary.entity_count }} · 新建 {{ result.summary.create_count }}
        · 更新 {{ result.summary.update_count }} · 复用 {{ result.summary.reuse_count }}
        · 阻断 {{ result.summary.blocked_count }} · 分镜草稿 {{ result.summary.storyboard_draft_count }}
      </p>
      <p class="workbench__zero-credit">
        provider {{ result.summary.provider_call_count }} · media {{ result.summary.media_artifact_count }}
        · real delivery credit {{ result.summary.real_delivery_credit_count }}
      </p>
      <p class="workbench__proof">
        已锁版本 {{ result.source.version_id }} · payload {{ result.payload_sha256.slice(0, 12) }}…
      </p>
      <div v-if="result.blockers.length" class="workbench__error">
        <p v-for="blocker in result.blockers" :key="blocker">{{ blocker }}</p>
      </div>
      <details v-if="result.entities.length">
        <summary>实体计划（{{ result.entities.length }}）</summary>
        <p v-for="entity in result.entities" :key="`${entity.entity_type}:${entity.source_key}`">
          {{ entity.entity_type }} · {{ entity.action }} · {{ entity.display_name }}
          <template v-if="entity.target_entity_id"> · {{ entity.target_entity_id }}</template>
        </p>
      </details>
    </div>

    <details v-if="audit?.ledger_event_count" class="workbench__audit">
      <summary>本地导入审计（{{ audit.ledger_event_count }}）</summary>
      <p class="workbench__zero-credit">独立于 execution worker ledger · real delivery credit 0</p>
      <p v-for="event in audit.items.slice(0, 5)" :key="event.audit_event_id">
        {{ new Date(event.recorded_at).toLocaleString('zh-CN') }} · {{ event.mode }}
        · {{ statusLabel(event.status) }} · entities {{ event.entity_count }}
        <template v-if="event.replayed"> · 幂等重放</template>
      </p>
    </details>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  dryRunProjectGearsWorkbenchImport,
  executeProjectGearsWorkbenchImport,
  getProjectGearsWorkbenchImportAudit,
} from '@/api/projects'
import {
  getGearsWorkbenchCapabilities,
  getGearsWorkbenchConfig,
} from '@/api/system'
import type {
  GearsWorkbenchCapabilities,
  GearsWorkbenchConfigInfo,
  GearsWorkbenchImportResult,
  GearsWorkbenchImportAuditLedger,
  GearsWorkbenchMappingOptions,
} from '@shared/types'

const props = defineProps<{ projectId: string }>()

const config = ref<GearsWorkbenchConfigInfo | null>(null)
const capabilities = ref<GearsWorkbenchCapabilities | null>(null)
const result = ref<GearsWorkbenchImportResult | null>(null)
const audit = ref<GearsWorkbenchImportAuditLedger | null>(null)
const loadingConfig = ref(false)
const probing = ref(false)
const dryRunning = ref(false)
const executing = ref(false)
const error = ref('')
const idempotencyKey = ref('')
const dryRunFingerprint = ref('')
const mapping = reactive<GearsWorkbenchMappingOptions>({
  character_style_pack_id: '',
  scene_style_pack_id: '',
  staging_pack_id: '',
  visual_pack_id: '',
})

const busy = computed(() => probing.value || dryRunning.value || executing.value)
const mappingComplete = computed(() => Object.values(mapping).every(value => value.length > 0))
const requestFingerprint = computed(() => JSON.stringify({ ...mapping, idempotency_key: idempotencyKey.value }))
const canExecute = computed(() => (
  result.value?.mode === 'dry_run'
  && result.value.status === 'planned'
  && result.value.blockers.length === 0
  && dryRunFingerprint.value === requestFingerprint.value
))

function first(values: string[]): string {
  return values[0] ?? ''
}

function applyCapabilityDefaults(value: GearsWorkbenchCapabilities) {
  mapping.character_style_pack_id ||= first(value.available_character_style_pack_ids)
  mapping.scene_style_pack_id ||= first(value.available_scene_style_pack_ids)
  mapping.staging_pack_id ||= first(value.available_staging_pack_ids)
  mapping.visual_pack_id ||= first(value.available_visual_pack_ids)
}

function requestBody(includeDryRunProof = false) {
  return {
    ...(idempotencyKey.value ? { idempotency_key: idempotencyKey.value } : {}),
    ...(includeDryRunProof && result.value?.mode === 'dry_run'
      ? {
          expected_source_version_id: result.value.source.version_id,
          expected_payload_sha256: result.value.payload_sha256,
        }
      : {}),
    mapping: { ...mapping },
  }
}

function statusLabel(status: GearsWorkbenchImportResult['status']) {
  return status === 'planned' ? '可执行' : status === 'applied' ? '已写入工作台' : '已阻断'
}

async function loadConfig() {
  loadingConfig.value = true
  error.value = ''
  const response = await getGearsWorkbenchConfig()
  config.value = response.ok ? response.data : null
  if (!response.ok) error.value = response.error?.message ?? '读取 GEARS workbench 配置失败'
  loadingConfig.value = false
  if (config.value?.ready_for_capability_probe) await probeCapabilities()
}

async function loadAudit() {
  const response = await getProjectGearsWorkbenchImportAudit(props.projectId)
  audit.value = response.ok ? response.data : null
}

async function probeCapabilities() {
  if (probing.value) return
  probing.value = true
  error.value = ''
  const response = await getGearsWorkbenchCapabilities()
  if (response.ok && response.data) {
    capabilities.value = response.data
    applyCapabilityDefaults(response.data)
  } else {
    capabilities.value = null
    error.value = response.error?.message ?? 'GEARS workbench 能力探测失败'
  }
  probing.value = false
}

async function runDryRun() {
  if (!mappingComplete.value) return
  dryRunning.value = true
  error.value = ''
  result.value = null
  const fingerprint = requestFingerprint.value
  const response = await dryRunProjectGearsWorkbenchImport(props.projectId, requestBody())
  if (response.ok && response.data) {
    result.value = response.data
    dryRunFingerprint.value = fingerprint
    await loadAudit()
  } else {
    dryRunFingerprint.value = ''
    error.value = response.error?.message ?? 'GEARS workbench dry-run 失败'
  }
  dryRunning.value = false
}

async function runExecute() {
  if (!canExecute.value) return
  const confirmed = window.confirm('确认将当前版本写入 GEARS 导演工作台？此操作不提交执行 worker，也不产生真实回片信用。')
  if (!confirmed) return
  executing.value = true
  error.value = ''
  const response = await executeProjectGearsWorkbenchImport(props.projectId, requestBody(true))
  if (response.ok && response.data) {
    result.value = response.data
    dryRunFingerprint.value = ''
    await loadAudit()
  } else {
    error.value = response.error?.message ?? 'GEARS workbench 导入失败'
  }
  executing.value = false
}

watch(requestFingerprint, () => {
  if (result.value?.mode === 'dry_run') dryRunFingerprint.value = ''
})

onMounted(() => {
  loadConfig()
  loadAudit()
})
</script>

<style scoped>
.workbench {
  margin: 20px 0;
  padding: 20px;
  border: 1px solid #d8cbb2;
  border-radius: 14px;
  background: #fffcf5;
  color: #332f29;
}

.workbench__head,
.workbench__result-head,
.workbench__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.workbench__head h2 {
  margin: 2px 0 6px;
}

.workbench__head p,
.workbench__result p {
  margin: 4px 0;
}

.workbench__eyebrow {
  color: #8a5a2b;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .08em;
}

.workbench__config,
.workbench__capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.workbench__config span,
.workbench__capabilities span {
  padding: 5px 9px;
  border-radius: 999px;
  background: #eee8dd;
  font-size: 12px;
}

.workbench__config .workbench__chip--ready {
  background: #dcecdc;
  color: #246136;
}

.workbench__mapping {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0;
}

.workbench__mapping label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}

.workbench__mapping select,
.workbench__mapping input {
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid #cfc4b2;
  border-radius: 8px;
  background: #fff;
}

.workbench__idempotency {
  grid-column: 1 / -1;
}

.workbench__actions {
  justify-content: flex-start;
  flex-wrap: wrap;
}

.workbench__button {
  padding: 8px 13px;
  border: 1px solid #9d7b53;
  border-radius: 8px;
  background: #fff;
  color: #5c3d20;
  cursor: pointer;
}

.workbench__button--primary {
  background: #6c4827;
  color: #fff;
}

.workbench__button:disabled {
  cursor: not-allowed;
  opacity: .5;
}

.workbench__notice,
.workbench__warning,
.workbench__error {
  margin-top: 12px;
  padding: 9px 11px;
  border-radius: 8px;
}

.workbench__notice,
.workbench__warning {
  background: #fff1cc;
  color: #73551b;
}

.workbench__error {
  background: #fde4df;
  color: #8c2d25;
}

.workbench__error p {
  margin: 2px 0;
}

.workbench__result {
  margin-top: 16px;
  padding: 14px;
  border: 1px solid #d5c8b5;
  border-radius: 10px;
  background: #fff;
}

.workbench__result[data-status='applied'] {
  border-color: #8bb58f;
}

.workbench__zero-credit {
  color: #246136;
  font-weight: 700;
}

.workbench__proof {
  color: #62594e;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.workbench__result details p {
  padding-left: 10px;
  color: #62594e;
  font-size: 13px;
}

.workbench__audit {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed #cfc4b2;
}

.workbench__audit p {
  margin: 5px 0;
  color: #62594e;
  font-size: 13px;
}

@media (max-width: 720px) {
  .workbench__head {
    align-items: flex-start;
    flex-direction: column;
  }

  .workbench__mapping {
    grid-template-columns: 1fr;
  }

  .workbench__idempotency {
    grid-column: auto;
  }
}
</style>
