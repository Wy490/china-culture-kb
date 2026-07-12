<template>
  <section class="inspector-page">
    <header class="hero">
      <div>
        <p class="eyebrow">STORY AGENT · STAGE 6 · PACKAGE INSPECTOR</p>
        <h2>初始 ProfessionalTextPackage 检查</h2>
        <p>在 P0 intake 前检查原文件 SHA-256、schema、项目绑定、可修订正文、Beat、场景和交付文本。</p>
      </div>
      <nav><RouterLink to="/story/stage6-intake">输入接入</RouterLink><RouterLink to="/story/stage6-preflight">批次预检</RouterLink></nav>
    </header>

    <div class="truth-lock">
      <strong>检查器不授信</strong>
      <span>结果只在内存中生成；通过包门禁不等于 P0 ready、真实修订或专业通过，包内自报 professional_passed 也不会获得信用。</span>
    </div>
    <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>

    <section class="binding-bar">
      <label>预期真实项目 ID<input v-model="expectedProjectId" placeholder="例如 project-2026-001" /></label>
      <label>预期片型<select v-model="expectedVideoType"><option v-for="item in videoTypes" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
      <button :disabled="loading" @click="loadTemplate">生成该片型 Skeleton</button>
      <button class="primary" :disabled="loading || !editorText" @click="inspectPackage">{{ loading ? '检查中…' : '运行只读检查' }}</button>
    </section>

    <section class="workspace-grid">
      <article class="editor-card">
        <header><div><p class="eyebrow">SOURCE JSON</p><h3>初始包原文</h3></div><span>UTF-8 原文哈希</span></header>
        <div class="toolbar">
          <label class="file-button">导入 JSON<input type="file" accept=".json,application/json" @change="importFile" /></label>
          <button @click="copyJson">复制 JSON</button>
          <span>{{ copyMessage }}</span>
        </div>
        <textarea v-model="editorText" aria-label="ProfessionalTextPackage JSON" spellcheck="false" />
        <footer><span>{{ editorText.length.toLocaleString() }} 字符</span><b>不落盘 · 不执行</b></footer>
      </article>

      <article class="result-card">
        <header><div><p class="eyebrow">INSPECTION RESULT</p><h3>包门禁与结构摘要</h3></div><b :class="inspection?.p0_package_gate_passed ? 'pass' : 'blocked'">{{ inspection?.p0_package_gate_passed ? 'PACKAGE GATE PASS' : 'BLOCKED' }}</b></header>
        <div v-if="inspection" class="metrics">
          <div><span>Schema</span><strong>{{ inspection.schema_valid ? '合法' : '失败' }}</strong></div>
          <div><span>场景</span><strong>{{ inspection.package_summary.scene_count }}</strong></div>
          <div><span>Beat</span><strong>{{ inspection.package_summary.sequence_beat_count }}</strong></div>
          <div><span>专业信用</span><strong>0</strong></div>
        </div>

        <div v-if="inspection" class="hash-panel">
          <div><span>P0 应填写：原 JSON 文件 SHA-256</span><code>{{ inspection.source_file_sha256 || '—' }}</code></div>
          <div><span>内部链路：Canonical package SHA-256</span><code>{{ inspection.canonical_package_sha256 || 'Schema 合法后生成' }}</code></div>
          <p>两种哈希用途不同，canonical hash 不能代替 P0 的原文件 SHA-256。</p>
        </div>

        <div v-if="inspection" class="summary-grid">
          <span>Package ID <b>{{ inspection.package_summary.package_id || '—' }}</b></span>
          <span>Project ID <b>{{ inspection.package_summary.project_id || '—' }}</b></span>
          <span>Video Type <b>{{ inspection.package_summary.video_type || '—' }}</b></span>
          <span>Status <b>{{ inspection.package_summary.status || '—' }}</b></span>
          <span>正文字符 <b>{{ inspection.package_summary.full_text_character_count }}</b></span>
          <span>交付场景 <b>{{ inspection.package_summary.delivery_scene_count }}</b></span>
          <span>证据条目 <b>{{ inspection.package_summary.evidence_item_count }}</b></span>
          <span>修订记录 <b>{{ inspection.package_summary.revision_trace_count }}</b></span>
        </div>

        <section v-if="inspection" class="checks">
          <h4>P0 初始包检查</h4>
          <div class="check-grid">
            <span v-for="(passed, key) in inspection.checks" :key="key" :class="passed ? 'ok' : 'fail'">{{ passed ? '✓' : '×' }} {{ checkLabel(key) }}</span>
          </div>
        </section>

        <section v-if="inspection?.issues.length" class="issues">
          <h4>问题 {{ inspection.issues.length }} 项</h4>
          <article v-for="(item, index) in inspection.issues" :key="`${item.code}-${index}`" :class="item.blocking ? 'blocking' : 'warning'">
            <header><b>{{ item.gate.toUpperCase() }}</b><code>{{ item.code }}</code></header>
            <span>{{ item.path || 'root' }}</span><p>{{ item.message }}</p>
          </article>
        </section>

        <div class="safety-grid"><span>Input persisted <b>否</b></span><span>P0 readiness granted <b>否</b></span><span>Execution started <b>否</b></span><span>Professional passed <b>否</b></span></div>
      </article>
    </section>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Stage6ProfessionalPackageInspectionResult, VideoType } from '@shared/types'
import { getStage6ProfessionalPackageInspector, inspectStage6ProfessionalPackage } from '../api/stage6-revisions'

const expectedProjectId = ref('')
const expectedVideoType = ref<VideoType>('character_story')
const editorText = ref('')
const inspection = ref<Stage6ProfessionalPackageInspectionResult | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const copyMessage = ref('')

const videoTypes: Array<{ id: VideoType; label: string }> = [
  { id: 'character_story', label: '人物故事' }, { id: 'historical_drama', label: '历史剧情' }, { id: 'legend_story', label: '传说故事' },
  { id: 'children_story', label: '儿童故事' }, { id: 'ai_comic_drama', label: 'AI 漫剧' }, { id: 'culture_promo', label: '文化宣传' },
  { id: 'heritage_promo', label: '非遗宣传' }, { id: 'city_brand_promo', label: '城市品牌' }, { id: 'social_short', label: '社交短视频' },
  { id: 'documentary_short', label: '纪录短片' }, { id: 'explainer_video', label: '科普讲解' }, { id: 'lecture_video', label: '演讲视频' },
  { id: 'education_training', label: '教育培训' }, { id: 'scene_short', label: '场景短片' }, { id: 'landscape_mood', label: '风景意境' },
]

const CHECK_LABELS: Record<string, string> = {
  request_valid: '检查请求合法', json_valid: 'JSON 可解析', package_schema_valid: 'ProfessionalTextPackage schema',
  project_id_present: 'Project ID 已填写', expected_project_binding_valid: 'Project ID 绑定', expected_video_type_binding_valid: '片型绑定',
  non_skeleton_status: '非 Skeleton', full_text_present: '正文存在', sequence_beats_present: 'Beat 存在', scene_breakdown_present: '场景存在',
  delivery_script_present: '交付脚本存在', scene_ids_unique: 'Scene ID 唯一', delivery_scene_ids_bound: '交付场景绑定',
}

onMounted(loadTemplate)

async function loadTemplate() {
  loading.value = true
  errorMessage.value = ''
  const response = await getStage6ProfessionalPackageInspector(expectedVideoType.value)
  loading.value = false
  if (!response.ok || !response.data) { errorMessage.value = response.error?.message ?? '初始包模板加载失败'; return }
  editorText.value = `${JSON.stringify(response.data.template, null, 2)}\n`
  inspection.value = response.data.template_inspection
}

async function inspectPackage() {
  loading.value = true
  errorMessage.value = ''
  const response = await inspectStage6ProfessionalPackage({
    raw_json: editorText.value,
    expected_project_id: expectedProjectId.value,
    expected_video_type: expectedVideoType.value,
  })
  loading.value = false
  if (!response.ok || !response.data) { errorMessage.value = response.error?.message ?? '初始包检查失败'; return }
  inspection.value = response.data
}

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try { editorText.value = await file.text(); errorMessage.value = '' } catch (error) { errorMessage.value = `导入失败：${(error as Error).message}` } finally { input.value = '' }
}

async function copyJson() {
  try { await navigator.clipboard.writeText(editorText.value); copyMessage.value = '已复制' } catch { copyMessage.value = '复制未获授权' }
  window.setTimeout(() => { copyMessage.value = '' }, 1600)
}

function checkLabel(value: string) { return CHECK_LABELS[value] ?? value }
</script>

<style scoped>
.inspector-page{min-height:100%;padding:28px;color:#eceaf4;background:radial-gradient(circle at 88% 0%,#36305b,#17172a 40%,#0a0c15 100%)}.hero{max-width:1440px;margin:0 auto 18px;display:flex;align-items:flex-end;justify-content:space-between;gap:24px}.hero h2{margin:4px 0 8px;font-size:clamp(30px,4vw,48px);letter-spacing:-.04em}.hero p{margin:0;max-width:900px;color:#aaa9bb}.hero nav{display:flex;gap:8px}.hero a,.binding-bar button,.toolbar button,.file-button{padding:9px 13px;border:1px solid #59517e;border-radius:9px;color:#e5e1ef;background:#25223a;text-decoration:none;cursor:pointer;font:inherit}.hero a:hover,.binding-bar button:hover,.toolbar button:hover,.file-button:hover{border-color:#aaa0ed}.eyebrow{color:#a89ef1!important;font-size:11px;font-weight:800;letter-spacing:.17em}.truth-lock{max-width:1440px;margin:0 auto 17px;padding:14px 16px;display:flex;gap:15px;border:1px solid #7a6135;border-radius:12px;color:#f0d49d;background:#302515}.truth-lock span{color:#c7ae7f}.error-banner{max-width:1440px;margin:0 auto 14px;padding:12px;border-radius:10px;color:#ffb0be;background:#481d2a}
.binding-bar{max-width:1440px;margin:0 auto 16px;padding:13px;display:flex;align-items:flex-end;gap:10px;border:1px solid #3d3859;border-radius:12px;background:#141426}.binding-bar label{flex:1;color:#88859b;font-size:11px}.binding-bar input,.binding-bar select{width:100%;margin-top:5px;padding:9px;box-sizing:border-box;border:1px solid #484262;border-radius:7px;color:#e2dfeb;background:#0e0f1a}.binding-bar .primary{background:#4e477e;border-color:#9b90e6}.binding-bar button:disabled{opacity:.5}
.workspace-grid{max-width:1440px;margin:auto;display:grid;grid-template-columns:minmax(420px,.88fr) minmax(560px,1.12fr);gap:16px;align-items:start}.editor-card,.result-card{overflow:hidden;border:1px solid #3d3855;border-radius:14px;background:rgba(17,17,31,.96)}.editor-card{position:sticky;top:15px}.editor-card>header,.result-card>header{padding:16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #302d43}.editor-card h3,.result-card h3{margin:3px 0 0}.editor-card header span{color:#807c92;font:11px ui-monospace,monospace}.result-card header>b{font-size:11px;letter-spacing:.08em}.pass{color:#78dac4}.blocked{color:#ff93aa}.toolbar{padding:11px 14px;display:flex;align-items:center;gap:8px}.file-button input{display:none}.toolbar span{color:#918ca0;font-size:11px}textarea{width:100%;min-height:680px;padding:17px;box-sizing:border-box;resize:vertical;border:0;border-block:1px solid #2c293d;outline:0;color:#d7d3e5;background:#0b0c14;font:11px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}.editor-card footer{padding:10px 14px;display:flex;justify-content:space-between;color:#817d90;font-size:11px}.editor-card footer b{color:#b2a7ee}
.metrics{margin:15px;display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.metrics div{padding:10px;border-radius:8px;background:#1c1a2b}.metrics span{display:block;color:#817d91;font-size:10px}.metrics strong{color:#e3e0ea}.metrics div:last-child strong{color:#ff91aa}.hash-panel{margin:0 15px 14px;padding:12px;border:1px solid #454064;border-radius:10px;background:#11101e}.hash-panel div+div{margin-top:9px}.hash-panel span{display:block;margin-bottom:4px;color:#908ba0;font-size:10px}.hash-panel code{display:block;color:#beb5ef;overflow-wrap:anywhere;font-size:11px}.hash-panel p{margin:10px 0 0;color:#d0ab70;font-size:11px}.summary-grid{margin:0 15px 14px;display:grid;grid-template-columns:repeat(2,1fr);gap:6px}.summary-grid span{padding:8px;border-radius:7px;color:#817c91;background:#191726;font-size:10px}.summary-grid b{float:right;max-width:65%;color:#d6d2df;overflow-wrap:anywhere}.checks,.issues{margin:0 15px 15px}.checks h4,.issues h4{margin:0 0 8px}.check-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:5px}.check-grid span{padding:7px 9px;border-radius:7px;font-size:10px}.ok{color:#77d8c3;background:#14362f}.fail{color:#ef96a8;background:#351a24}.issues>article{margin:6px 0;padding:9px;border:1px solid #493840;border-radius:8px;background:#21181d}.issues>article.warning{border-color:#65522f;background:#261f14}.issues article header{display:flex;gap:8px}.issues article b{color:#e998aa;font-size:9px}.issues .warning b{color:#e2bd70}.issues article code{color:#c9bdc2;font-size:10px}.issues article>span{display:block;margin-top:4px;color:#81767b;font-size:10px}.issues article p{margin:3px 0 0;color:#bfb2b7;font-size:11px}.safety-grid{margin:15px;display:grid;grid-template-columns:repeat(2,1fr);gap:6px}.safety-grid span{padding:8px;border-radius:7px;color:#898398;background:#1a1828;font-size:10px}.safety-grid b{float:right;color:#ff92a9}
@media(max-width:1050px){.workspace-grid{grid-template-columns:1fr}.editor-card{position:static}textarea{min-height:480px}}@media(max-width:720px){.inspector-page{padding:18px 12px}.hero,.truth-lock,.binding-bar{align-items:flex-start;flex-direction:column}.binding-bar label{width:100%}.metrics{grid-template-columns:repeat(2,1fr)}.check-grid,.summary-grid,.safety-grid{grid-template-columns:1fr}}
</style>
