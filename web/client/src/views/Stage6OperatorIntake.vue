<template>
  <section class="intake-page">
    <header class="hero">
      <div>
        <p class="eyebrow">STORY AGENT · STAGE 6 · OPERATOR</p>
        <h2>真实输入接入与 Readiness</h2>
        <p>导入 operator JSON，逐项目核验真实 ID、初始包、授权、预算、实名评审与桌读排期。</p>
      </div>
      <RouterLink class="workspace-link" to="/story/stage6-revisions">进入修订工作台</RouterLink>
    </header>

    <div class="truth-banner">
      <strong>Dry-run 边界</strong>
      <span>本页不保存输入、不启动修订、不调用模型；ready 也不等于真实修订或专业通过。</span>
    </div>

    <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>

    <div v-if="validation" class="metrics-grid">
      <article><span>项目</span><strong>{{ validation.report.summary.project_count }}</strong></article>
      <article class="ready"><span>Ready</span><strong>{{ validation.report.summary.ready_project_count }}</strong></article>
      <article class="blocked"><span>Blocked</span><strong>{{ validation.report.summary.blocked_project_count }}</strong></article>
      <article class="locked"><span>专业通过</span><strong>{{ validation.report.summary.professional_pass_count }}</strong></article>
    </div>

    <div class="layout">
      <section class="editor-panel">
        <div class="panel-heading">
          <div><p class="eyebrow">OPERATOR JSON</p><h3>输入草稿</h3></div>
          <span>仅内存 dry-run</span>
        </div>
        <div class="toolbar">
          <button :disabled="loading" @click="resetTemplate">恢复模板</button>
          <button :disabled="!editorText" @click="copyJson">复制 JSON</button>
          <label class="file-button">导入 JSON<input type="file" accept=".json,application/json" @change="importFile" /></label>
          <button class="primary" :disabled="loading || !editorText" @click="validateEditor">{{ loading ? '验证中…' : 'Dry-run 验证' }}</button>
        </div>
        <textarea v-model="editorText" spellcheck="false" aria-label="Stage 6 operator JSON" />
        <div class="editor-foot">
          <span>{{ editorText.length.toLocaleString() }} 字符</span>
          <span v-if="copyMessage">{{ copyMessage }}</span>
          <strong :class="validation?.schema_valid ? 'ok' : 'warn'">Schema：{{ validation?.schema_valid ? '合法' : '待修复' }}</strong>
        </div>
      </section>

      <section class="result-panel">
        <div class="panel-heading">
          <div><p class="eyebrow">READINESS REPORT</p><h3>逐项目阻断</h3></div>
          <span v-if="validation">{{ shortHash(validation.source_intake_canonical_sha256) }}</span>
        </div>

        <div v-if="validation?.report.global_errors.length" class="global-errors">
          <strong>全局错误 {{ validation.report.global_errors.length }} 项</strong>
          <p v-for="item in validation.report.global_errors" :key="`${item.code}-${item.path}`">
            <b>{{ item.code }}</b><span>{{ item.path || 'root' }}</span>{{ item.message }}
          </p>
        </div>

        <div class="filters">
          <button v-for="item in filters" :key="item.id" :class="{ active: filter === item.id }" @click="filter = item.id">{{ item.label }}</button>
        </div>

        <div class="project-list">
          <article v-for="project in filteredProjects" :key="project.benchmark_id" class="project-card" :class="project.status">
            <header>
              <div><span>{{ videoTypeLabel(project.video_type) }}</span><h4>{{ project.source_entry }}</h4></div>
              <b>{{ project.status.toUpperCase() }}</b>
            </header>
            <p class="project-id">{{ project.real_project_id || '尚未填写真实项目 ID' }}</p>
            <div class="check-grid">
              <span v-for="(passed, key) in project.checks" :key="key" :class="passed ? 'check-ok' : 'check-fail'">{{ passed ? '✓' : '×' }} {{ checkLabel(key) }}</span>
            </div>
            <details :open="project.status === 'blocked'">
              <summary>阻断 {{ project.blockers.length }} 项</summary>
              <ul><li v-for="blocker in project.blockers" :key="`${blocker.code}-${blocker.path}`"><b>{{ blocker.code }}</b><span>{{ blocker.path }}</span>{{ blocker.message }}</li></ul>
            </details>
            <footer><span>真实修订 {{ project.completed_verified_round_count }}</span><strong>专业通过：否</strong></footer>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Stage6OperatorIntakeValidationResult, Stage6OperatorIntakeWorkspace, VideoType } from '@shared/types'
import { getStage6OperatorIntakeWorkspace, validateStage6OperatorIntake } from '../api/stage6-revisions'

const workspace = ref<Stage6OperatorIntakeWorkspace | null>(null)
const validation = ref<Stage6OperatorIntakeValidationResult | null>(null)
const editorText = ref('')
const loading = ref(false)
const errorMessage = ref('')
const copyMessage = ref('')
const filter = ref<'all' | 'ready' | 'blocked'>('all')
const filters = [
  { id: 'all' as const, label: '全部 15 项' },
  { id: 'ready' as const, label: 'Ready' },
  { id: 'blocked' as const, label: 'Blocked' },
]

const filteredProjects = computed(() => (validation.value?.report.projects ?? []).filter(project => (
  filter.value === 'all' || project.status === filter.value
)))

onMounted(loadWorkspace)

async function loadWorkspace() {
  loading.value = true
  errorMessage.value = ''
  const response = await getStage6OperatorIntakeWorkspace()
  loading.value = false
  if (!response.ok || !response.data) {
    errorMessage.value = response.error?.message ?? 'Stage 6 operator intake 加载失败'
    return
  }
  workspace.value = response.data
  validation.value = response.data.template_validation
  editorText.value = JSON.stringify(response.data.template, null, 2)
}

function resetTemplate() {
  if (!workspace.value) return
  editorText.value = JSON.stringify(workspace.value.template, null, 2)
  validation.value = workspace.value.template_validation
  errorMessage.value = ''
}

async function validateEditor() {
  errorMessage.value = ''
  let parsed: unknown
  try {
    parsed = JSON.parse(editorText.value)
  } catch (error) {
    errorMessage.value = `JSON 解析失败：${(error as Error).message}`
    return
  }
  loading.value = true
  const response = await validateStage6OperatorIntake(parsed)
  loading.value = false
  if (!response.ok || !response.data) {
    errorMessage.value = response.error?.message ?? 'Readiness 验证失败'
    return
  }
  validation.value = response.data
}

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    JSON.parse(text)
    editorText.value = text
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = `导入失败：${(error as Error).message}`
  } finally {
    input.value = ''
  }
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(editorText.value)
    copyMessage.value = '已复制'
  } catch {
    copyMessage.value = '浏览器未允许复制'
  }
  window.setTimeout(() => { copyMessage.value = '' }, 1600)
}

function shortHash(value: string) {
  return value ? `${value.slice(0, 10)}…${value.slice(-6)}` : '—'
}

const VIDEO_TYPE_LABELS: Record<VideoType, string> = {
  character_story: '人物故事', historical_drama: '历史剧情', legend_story: '传说故事', children_story: '儿童故事', ai_comic_drama: 'AI 漫剧',
  culture_promo: '文化宣传', heritage_promo: '非遗宣传', city_brand_promo: '城市品牌', social_short: '社交短视频', documentary_short: '纪录短片',
  explainer_video: '解释视频', lecture_video: '讲授视频', education_training: '教育培训', scene_short: '场景短片', landscape_mood: '山水意境',
}
function videoTypeLabel(value: VideoType) { return VIDEO_TYPE_LABELS[value] }

const CHECK_LABELS: Record<string, string> = {
  intake_schema_valid: 'Schema', registry_binding_valid: '项目绑定', real_provenance_verified: '真实来源', real_project_id_valid: '真实 ID',
  initial_package_file_valid: '初始包文件', initial_package_schema_valid: '初始包 Schema', initial_package_binding_valid: '初始包绑定', initial_package_sha256_valid: 'SHA-256',
  creator_authorization_verified: '创作授权', revision_budget_verified: '两轮预算', reviewer_assignments_verified: '三类评审', table_read_verified: '桌读排期',
}
function checkLabel(value: string) { return CHECK_LABELS[value] ?? value }
</script>

<style scoped>
.intake-page { min-height: 100%; padding: 28px; color: #e8edf5; background: radial-gradient(circle at 15% 0%, #263853 0, #111a29 36%, #0a101a 100%); }
.hero { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; max-width: 1500px; margin: 0 auto 18px; }
.hero h2 { margin: 4px 0 8px; font-size: clamp(28px, 4vw, 46px); letter-spacing: -.04em; }
.hero p { margin: 0; color: #aebbd0; }
.eyebrow { color: #65d5c0 !important; font-size: 12px; font-weight: 800; letter-spacing: .16em; }
.workspace-link, button, .file-button { border: 1px solid #40526c; border-radius: 10px; padding: 10px 14px; color: #dce8f7; background: #172338; cursor: pointer; text-decoration: none; font: inherit; }
button:hover, .file-button:hover, .workspace-link:hover { border-color: #65d5c0; }
button:disabled { opacity: .5; cursor: not-allowed; }
.truth-banner { max-width: 1500px; margin: 0 auto 18px; display: flex; gap: 14px; padding: 13px 16px; border: 1px solid #80652f; background: #302817; border-radius: 12px; color: #eedca6; }
.truth-banner span { color: #cdbf92; }
.error-banner { max-width: 1500px; margin: 0 auto 16px; padding: 12px; border-radius: 10px; background: #431f2a; color: #ffb7c4; }
.metrics-grid { max-width: 1500px; margin: 0 auto 18px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.metrics-grid article { padding: 15px 18px; border: 1px solid #2e4059; border-radius: 14px; background: #121d2e; }
.metrics-grid span { display: block; color: #8393ab; font-size: 12px; text-transform: uppercase; }
.metrics-grid strong { font-size: 28px; }
.metrics-grid .ready strong { color: #65d5c0; }.metrics-grid .blocked strong, .metrics-grid .locked strong { color: #ff8e9d; }
.layout { max-width: 1500px; margin: 0 auto; display: grid; grid-template-columns: minmax(390px, .8fr) minmax(560px, 1.2fr); gap: 18px; align-items: start; }
.editor-panel, .result-panel { min-width: 0; border: 1px solid #2b3c54; border-radius: 16px; background: rgba(13, 22, 36, .92); overflow: hidden; }
.editor-panel { position: sticky; top: 18px; }
.panel-heading { display: flex; align-items: center; justify-content: space-between; padding: 18px; border-bottom: 1px solid #27364c; }
.panel-heading h3 { margin: 3px 0 0; }.panel-heading span { color: #70829c; font-family: ui-monospace, monospace; font-size: 12px; }
.toolbar { display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 16px; }.toolbar .primary { background: #156b64; border-color: #3ec5b1; }.file-button input { display: none; }
textarea { width: 100%; min-height: 620px; padding: 18px; resize: vertical; border: 0; border-top: 1px solid #223148; border-bottom: 1px solid #223148; outline: none; background: #09111d; color: #cfe0f3; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; box-sizing: border-box; }
.editor-foot { display: flex; justify-content: space-between; gap: 12px; padding: 12px 16px; color: #7587a1; font-size: 12px; }.editor-foot .ok { color: #65d5c0; }.editor-foot .warn { color: #ffad71; }
.global-errors { margin: 16px; padding: 14px; border: 1px solid #724254; border-radius: 12px; background: #2a1821; }.global-errors strong { color: #ff9fb0; }.global-errors p { display: grid; grid-template-columns: minmax(160px, .6fr) minmax(130px, .5fr) 1fr; gap: 8px; margin: 10px 0 0; color: #c9aab3; font-size: 12px; }.global-errors b { color: #ffbdc8; }.global-errors span { color: #8c7180; font-family: ui-monospace, monospace; }
.filters { display: flex; gap: 8px; padding: 14px 16px; }.filters button.active { color: #071510; background: #65d5c0; border-color: #65d5c0; }
.project-list { padding: 0 16px 18px; display: grid; gap: 12px; }
.project-card { padding: 16px; border: 1px solid #31445f; border-radius: 14px; background: #111c2d; }.project-card.ready { border-color: #367e71; }.project-card.blocked { border-color: #59384a; }
.project-card header { display: flex; justify-content: space-between; gap: 16px; }.project-card header span { color: #65d5c0; font-size: 11px; }.project-card h4 { margin: 3px 0; font-size: 16px; }.project-card header b { color: #ff8e9d; font-size: 11px; }.project-card.ready header b { color: #65d5c0; }
.project-id { color: #8294ad; font-family: ui-monospace, monospace; font-size: 12px; }
.check-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin: 12px 0; }.check-grid span { padding: 5px 7px; border-radius: 6px; font-size: 11px; }.check-ok { color: #81e1cd; background: #15342f; }.check-fail { color: #d899a8; background: #311d26; }
details { border-top: 1px solid #26364b; padding-top: 10px; }summary { cursor: pointer; color: #b8c5d8; }ul { padding-left: 20px; }li { margin: 7px 0; color: #aeb9ca; font-size: 12px; }li b { margin-right: 8px; color: #f0a5b4; }li span { margin-right: 8px; color: #6f8099; font-family: ui-monospace, monospace; }
.project-card footer { display: flex; justify-content: space-between; margin-top: 12px; color: #7f90a8; font-size: 12px; }.project-card footer strong { color: #ff8e9d; }
@media (max-width: 1050px) { .layout { grid-template-columns: 1fr; }.editor-panel { position: static; }textarea { min-height: 420px; } }
@media (max-width: 700px) { .intake-page { padding: 18px 12px; }.hero, .truth-banner { flex-direction: column; align-items: flex-start; }.metrics-grid { grid-template-columns: repeat(2, 1fr); }.check-grid { grid-template-columns: repeat(2, 1fr); }.global-errors p { grid-template-columns: 1fr; } }
</style>
