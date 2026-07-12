<template>
  <section class="preflight-page">
    <header class="hero">
      <div>
        <p class="eyebrow">STORY AGENT · STAGE 6 · PREFLIGHT</p>
        <h2>修订批次执行前检查</h2>
        <p>校验 command、readiness、包哈希、授权、预算、桌读与 provenance，不执行任何修订。</p>
      </div>
      <nav><RouterLink to="/story/stage6-intake">输入接入</RouterLink><RouterLink to="/story/stage6-revisions">修订工作台</RouterLink></nav>
    </header>

    <div class="lock-banner">
      <strong>执行锁已启用</strong>
      <span>本页面没有 execute endpoint；Preflight ready 也不会写 artifact、获得真实修订信用或专业通过。</span>
    </div>
    <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>

    <div v-if="workspace" class="metrics">
      <article><span>计划轮次</span><strong>{{ workspace.current_batch_summary.planned_round_count }}</strong></article>
      <article><span>P0 Ready 项目</span><strong>{{ workspace.current_batch_summary.p0_ready_project_count }}</strong></article>
      <article><span>已核验真实轮次</span><strong>{{ workspace.current_batch_summary.completed_verified_revision_round_count }}</strong></article>
      <article class="locked"><span>专业通过</span><strong>{{ workspace.current_batch_summary.professional_pass_count }}</strong></article>
    </div>

    <div class="workspace-grid">
      <section class="editor-card">
        <header><div><p class="eyebrow">COMMAND JSON</p><h3>批次命令</h3></div><span>仅内存</span></header>
        <div class="toolbar">
          <button @click="resetTemplate">恢复模板</button>
          <label>导入 JSON<input type="file" accept=".json,application/json" @change="importFile" /></label>
          <button class="primary" :disabled="loading || !editorText" @click="runPreflight">{{ loading ? '检查中…' : '运行 Preflight' }}</button>
        </div>
        <textarea v-model="editorText" aria-label="Stage 6 revision command JSON" spellcheck="false" />
        <footer><span>{{ editorText.length.toLocaleString() }} 字符</span><b>不落盘 · 不执行</b></footer>
      </section>

      <section class="result-card">
        <header><div><p class="eyebrow">PREFLIGHT RESULT</p><h3>执行门禁</h3></div><span v-if="result">{{ shortHash(result.preflight.command_sha256) }}</span></header>
        <div v-if="result" class="status-card" :class="result.preflight.status">
          <div><span>状态</span><strong>{{ result.preflight.status.toUpperCase() }}</strong></div>
          <div><span>项目</span><strong>{{ result.preflight.benchmark_id || '未通过 Schema' }}</strong></div>
          <div><span>轮次 / 尝试</span><strong>R{{ result.preflight.round_number }} / {{ result.preflight.attempt_number }}</strong></div>
          <div><span>真实修订信用</span><strong>0</strong></div>
        </div>
        <div class="safety-grid">
          <span>Execute endpoint <b>无</b></span><span>Artifacts written <b>否</b></span><span>Execution started <b>否</b></span><span>专业通过 <b>否</b></span>
        </div>
        <div v-if="result?.preflight.blockers.length" class="blockers">
          <div class="blocker-title"><strong>阻断 {{ result.preflight.blockers.length }} 项</strong><button @click="blockerFilter = blockerFilter === 'all' ? 'schema' : 'all'">{{ blockerFilter === 'all' ? '仅 Schema' : '显示全部' }}</button></div>
          <article v-for="(blocker, index) in filteredBlockers" :key="`${blocker}-${index}`">
            <span>{{ blockerGroup(blocker) }}</span><code>{{ blocker }}</code>
          </article>
          <p v-if="!filteredBlockers.length" class="muted">当前没有 Schema 类 blocker。</p>
        </div>
        <div v-else-if="result" class="ready-note"><strong>Preflight 可执行</strong><p>仍必须由独立 operator 在 CLI 明确使用 `--execute`；本页不会执行。</p></div>
        <div class="required-list">
          <h4>成为 ready 必须同时满足</h4>
          <ol><li>命令 schema 与 opt-in 字段完整</li><li>P0 readiness 重新计算仍为 ready</li><li>Round 0/1 包及 SHA-256 连续</li><li>授权主体、provenance 与成本记录一致</li><li>三类实名桌读意见齐全</li><li>正文/分场变更与声明区段一致</li></ol>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Stage6OperatorRevisionPreflightResult, Stage6OperatorRevisionPreflightWorkspace } from '@shared/types'
import { getStage6OperatorRevisionPreflightWorkspace, preflightStage6OperatorRevision } from '../api/stage6-revisions'

const workspace = ref<Stage6OperatorRevisionPreflightWorkspace | null>(null)
const result = ref<Stage6OperatorRevisionPreflightResult | null>(null)
const editorText = ref('')
const loading = ref(false)
const errorMessage = ref('')
const blockerFilter = ref<'all' | 'schema'>('all')
const filteredBlockers = computed(() => (result.value?.preflight.blockers ?? []).filter(item => blockerFilter.value === 'all' || item.startsWith('command_schema_invalid')))

onMounted(loadWorkspace)

async function loadWorkspace() {
  loading.value = true
  const response = await getStage6OperatorRevisionPreflightWorkspace()
  loading.value = false
  if (!response.ok || !response.data) { errorMessage.value = response.error?.message ?? 'Preflight 工作台加载失败'; return }
  workspace.value = response.data
  result.value = response.data.template_preflight
  editorText.value = JSON.stringify(response.data.command_template, null, 2)
}

function resetTemplate() {
  if (!workspace.value) return
  editorText.value = JSON.stringify(workspace.value.command_template, null, 2)
  result.value = workspace.value.template_preflight
  errorMessage.value = ''
}

async function runPreflight() {
  errorMessage.value = ''
  let parsed: unknown
  try { parsed = JSON.parse(editorText.value) } catch (error) { errorMessage.value = `JSON 解析失败：${(error as Error).message}`; return }
  loading.value = true
  const response = await preflightStage6OperatorRevision(parsed)
  loading.value = false
  if (!response.ok || !response.data) { errorMessage.value = response.error?.message ?? 'Preflight 失败'; return }
  result.value = response.data
}

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try { const text = await file.text(); JSON.parse(text); editorText.value = text; errorMessage.value = '' } catch (error) { errorMessage.value = `导入失败：${(error as Error).message}` } finally { input.value = '' }
}

function shortHash(value: string) { return value ? `${value.slice(0, 10)}…${value.slice(-6)}` : '—' }
function blockerGroup(value: string) {
  if (value.startsWith('command_schema_invalid')) return 'COMMAND SCHEMA'
  if (value.includes('readiness')) return 'READINESS'
  if (value.includes('package') || value.includes('sha256') || value.includes('artifact')) return 'ARTIFACT'
  if (value.includes('table_read') || value.includes('reviewer')) return 'TABLE READ'
  if (value.includes('budget') || value.includes('cost')) return 'BUDGET'
  if (value.includes('provenance') || value.includes('authorized')) return 'PROVENANCE'
  return 'EXECUTION GATE'
}
</script>

<style scoped>
.preflight-page { min-height: 100%; padding: 28px; color: #e9eef6; background: radial-gradient(circle at 84% 0%, #342846, #151727 38%, #090d16 100%); }
.hero { max-width: 1400px; margin: 0 auto 18px; display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }.hero h2 { margin: 4px 0 8px; font-size: clamp(30px,4vw,48px); letter-spacing: -.04em; }.hero p { margin: 0; color: #aeb5ca; }.hero nav { display: flex; gap: 8px; }.hero a, button, .toolbar label { color: #e1e6f0; text-decoration: none; background: #201d31; border: 1px solid #554968; border-radius: 9px; padding: 9px 13px; cursor: pointer; font: inherit; }.hero a:hover, button:hover, .toolbar label:hover { border-color: #c99de9; }
.eyebrow { color: #d5a4f2 !important; font-size: 11px; font-weight: 800; letter-spacing: .17em; }.lock-banner { max-width: 1400px; margin: 0 auto 18px; padding: 14px 16px; display: flex; gap: 15px; border: 1px solid #795b37; border-radius: 12px; background: #302316; color: #f0d39d; }.lock-banner span { color: #c6aa7d; }.error-banner { max-width: 1400px; margin: 0 auto 15px; padding: 12px; background: #431f2b; border-radius: 10px; color: #ffb3c2; }
.metrics { max-width: 1400px; margin: 0 auto 18px; display: grid; grid-template-columns: repeat(4,1fr); gap: 11px; }.metrics article { padding: 15px 17px; border: 1px solid #3c354f; border-radius: 13px; background: #171522; }.metrics span { display: block; color: #898298; font-size: 12px; }.metrics strong { font-size: 28px; }.metrics .locked strong { color: #ff91aa; }
.workspace-grid { max-width: 1400px; margin: auto; display: grid; grid-template-columns: minmax(430px,.9fr) minmax(520px,1.1fr); gap: 18px; align-items: start; }.editor-card,.result-card { border: 1px solid #40374f; border-radius: 15px; background: rgba(18,17,29,.94); overflow: hidden; }.editor-card { position: sticky; top: 18px; }.editor-card>header,.result-card>header { display: flex; justify-content: space-between; align-items: center; padding: 17px; border-bottom: 1px solid #352e43; }.editor-card h3,.result-card h3 { margin: 3px 0 0; }.editor-card header span,.result-card header span { color: #81768e; font: 12px ui-monospace,monospace; }
.toolbar { padding: 12px 15px; display: flex; flex-wrap: wrap; gap: 8px; }.toolbar input { display: none; }.toolbar .primary { background: #673b84; border-color: #c18be3; }.toolbar button:disabled { opacity: .5; }
textarea { width: 100%; min-height: 590px; padding: 18px; box-sizing: border-box; resize: vertical; border: 0; border-block: 1px solid #302a3d; outline: 0; background: #0d0c16; color: #d9cce4; font: 12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace; }.editor-card footer { display: flex; justify-content: space-between; padding: 11px 15px; color: #80768b; font-size: 12px; }.editor-card footer b { color: #e4b6ff; }
.status-card { margin: 16px; padding: 14px; display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; border: 1px solid #664151; border-radius: 12px; background: #2c1922; }.status-card.ready { border-color: #3c7f71; background: #142d28; }.status-card div { padding: 8px; }.status-card span { display: block; color: #8e7f90; font-size: 11px; }.status-card strong { color: #ff9bb1; }.status-card.ready strong { color: #71ddc5; }
.safety-grid { margin: 0 16px 16px; display: grid; grid-template-columns: repeat(2,1fr); gap: 7px; }.safety-grid span { padding: 9px; border-radius: 8px; background: #211c2b; color: #94899f; font-size: 12px; }.safety-grid b { float: right; color: #ff9db1; }
.blockers { margin: 16px; }.blocker-title { display: flex; justify-content: space-between; align-items: center; margin-bottom: 9px; }.blocker-title button { padding: 6px 9px; }.blockers article { display: grid; grid-template-columns: 130px 1fr; gap: 9px; margin: 7px 0; padding: 10px; border: 1px solid #423447; border-radius: 9px; background: #1d1724; }.blockers span { color: #ce9be6; font-size: 10px; font-weight: 800; }.blockers code { color: #c9bccd; white-space: normal; overflow-wrap: anywhere; }.muted { color: #83798c; }
.ready-note { margin: 16px; padding: 15px; border: 1px solid #3a796d; border-radius: 11px; background: #142d28; color: #78ddc8; }.required-list { margin: 16px; padding: 15px; border-top: 1px solid #3a3147; }.required-list h4 { margin-top: 0; }.required-list li { margin: 7px 0; color: #a9a0b1; }.required-list code { color: #d6aaf0; }
@media(max-width:1000px){.workspace-grid{grid-template-columns:1fr}.editor-card{position:static}textarea{min-height:420px}}@media(max-width:700px){.preflight-page{padding:18px 12px}.hero,.lock-banner{align-items:flex-start;flex-direction:column}.metrics{grid-template-columns:repeat(2,1fr)}.status-card,.safety-grid{grid-template-columns:1fr}.blockers article{grid-template-columns:1fr}}
</style>
