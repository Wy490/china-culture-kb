<template>
  <section class="review-page">
    <header class="hero">
      <div><p class="eyebrow">STORY AGENT · STAGE 8 · BLIND REVIEW INTAKE</p><h2>专业盲评接入面</h2><p>统一校验 15 片型、75 个固定项目的终稿、授权基准、匿名随机化、三角色独立评审和排期证据。</p></div>
      <RouterLink to="/story/stage7-operations">返回 Stage 7 总控</RouterLink>
    </header>
    <div class="truth-lock"><strong>Readiness ≠ 真人盲评通过</strong><span>模板、fixture、simulation、fallback、机器阈值和自报字段均不授予真人盲评或专业通过。</span></div>
    <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>

    <template v-if="workspace && report">
      <section class="summary-grid">
        <article><span>固定项目</span><strong>{{ report.summary.project_count }}/75</strong></article>
        <article><span>覆盖片型</span><strong>{{ report.summary.target_video_type_count }}/15</strong></article>
        <article><span>接入 Ready</span><strong>{{ report.summary.ready_for_external_blind_review_count }}/75</strong></article>
        <article><span>Blocked</span><strong>{{ report.summary.blocked_project_count }}</strong></article>
        <article><span>三角色 Ready</span><strong>{{ report.summary.reviewer_assignment_ready_project_count }}</strong></article>
        <article class="zero"><span>真人通过 / 专业通过</span><strong>0 / 0</strong></article>
      </section>

      <section class="threshold-strip">
        <span>加权均分 ≥ <b>{{ workspace.thresholds.minimum_weighted_average_score }}</b></span>
        <span>单维 ≥ <b>{{ workspace.thresholds.minimum_dimension_score }}</b></span>
        <span>非劣差距 ≤ <b>{{ workspace.thresholds.maximum_baseline_gap }}</b></span>
        <span>制作推进票 ≥ <b>{{ workspace.thresholds.minimum_production_advance_vote_ratio }}</b></span>
        <span>三角色 <b>{{ workspace.thresholds.required_role_count }}</b></span>
        <span>硬门槛 <b>{{ workspace.thresholds.hard_gate_failure_count_required }}</b></span>
      </section>
      <div v-if="evaluator" class="evaluator-lock"><strong>V2 权重合同 {{ evaluator.summary.weight_contract_ready_count }}/15</strong><span>15片型均使用独立合同SHA-256；score threshold只做机器阈值判断，真人盲评和专业通过信用仍为0。</span><code>{{ evaluator.summary.blind_review_decision_schema_version }}</code></div>

      <section class="main-grid">
        <article class="intake-card">
          <header><div><p class="eyebrow">OPERATOR JSON · DRY RUN</p><h3>导入验证器</h3></div><div class="actions"><label>选择 JSON<input type="file" accept="application/json,.json" @change="loadFile"></label><button @click="copyTemplate">{{ copyMessage || '复制模板' }}</button><button class="primary" :disabled="validating" @click="validateJson">{{ validating ? '校验中' : '仅校验' }}</button></div></header>
          <textarea v-model="rawJson" aria-label="Stage 8 blind review intake JSON" spellcheck="false" />
          <footer><span>输入落盘 <b>否</b></span><span>评审执行 <b>否</b></span><span>评审记录落盘 <b>否</b></span><span>专业通过 <b>否</b></span></footer>
        </article>

        <article class="portfolio-card">
          <header><div><p class="eyebrow">75-PROJECT READINESS</p><h3>逐项目状态</h3></div><div class="filters"><select v-model="typeFilter"><option value="all">全部片型</option><option v-for="item in report.video_types" :key="item.video_type" :value="item.video_type">{{ item.label }}</option></select><select v-model="statusFilter"><option value="all">全部状态</option><option value="blocked">Blocked</option><option value="ready_for_external_blind_review">Ready</option></select></div></header>
          <div class="project-list"><article v-for="project in filteredProjects" :key="project.benchmark_id"><div><span>{{ typeLabel(project.video_type) }}</span><b :class="project.status">{{ project.status === 'blocked' ? 'BLOCKED' : 'READY' }}</b></div><code>{{ project.benchmark_id }}</code><p>{{ project.source_entry }}</p><small>{{ project.blockers[0]?.message || '外部盲评接入材料完整；仍未产生真人评审结果。' }}</small></article></div>
        </article>
      </section>

      <section class="type-grid"><article v-for="item in report.video_types" :key="item.video_type"><header><span>{{ item.label }}</span><b>{{ item.ready_project_count }}/5</b></header><div><i :style="{ width: `${item.ready_project_count / 5 * 100}%` }" /></div><small>{{ item.blocked_project_count }} blocked · 真人通过 0</small><p v-if="evaluatorType(item.video_type)">{{ evaluatorType(item.video_type)?.top_weight_dimensions.map(weight => `${dimensionLabel(weight.dimension_id)} ${weight.weight}`).join(' · ') }}</p><code v-if="evaluatorType(item.video_type)">{{ evaluatorType(item.video_type)?.weight_contract_sha256.slice(0, 16) }}…</code></article></section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ProfessionalQualityDimensionId, Stage8BlindReviewEvaluatorReadinessReport, Stage8BlindReviewReadinessReport, Stage8BlindReviewWorkspace, VideoType } from '@shared/types'
import { getStage8BlindReviewEvaluatorReadiness, getStage8BlindReviewWorkspace, validateStage8BlindReviewIntake } from '../api/stage8-blind-review'

const workspace = ref<Stage8BlindReviewWorkspace | null>(null)
const evaluator = ref<Stage8BlindReviewEvaluatorReadinessReport | null>(null)
const report = ref<Stage8BlindReviewReadinessReport | null>(null)
const rawJson = ref('')
const errorMessage = ref('')
const copyMessage = ref('')
const validating = ref(false)
const typeFilter = ref('all')
const statusFilter = ref('all')
const filteredProjects = computed(() => report.value?.projects.filter(project =>
  (typeFilter.value === 'all' || project.video_type === typeFilter.value)
  && (statusFilter.value === 'all' || project.status === statusFilter.value)) ?? [])

onMounted(async () => {
  const [response, evaluatorResponse] = await Promise.all([getStage8BlindReviewWorkspace(), getStage8BlindReviewEvaluatorReadiness()])
  if (!response.ok || !response.data) { errorMessage.value = response.error?.message ?? 'Stage 8 盲评接入面加载失败'; return }
  if (!evaluatorResponse.ok || !evaluatorResponse.data) { errorMessage.value = evaluatorResponse.error?.message ?? 'Stage 8 权重合同加载失败'; return }
  workspace.value = response.data
  evaluator.value = evaluatorResponse.data
  report.value = response.data.template_validation.report
  rawJson.value = response.data.template_raw_json
})

async function validateJson() {
  errorMessage.value = ''
  let parsed: unknown
  try { parsed = JSON.parse(rawJson.value) } catch { errorMessage.value = 'JSON 解析失败，请修正格式后重试。'; return }
  validating.value = true
  try {
    const response = await validateStage8BlindReviewIntake(parsed)
    if (!response.ok || !response.data) { errorMessage.value = response.error?.message ?? '盲评接入校验失败'; return }
    report.value = response.data.report
  } finally { validating.value = false }
}

async function loadFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) rawJson.value = await file.text()
}

async function copyTemplate() {
  try { await navigator.clipboard.writeText(workspace.value?.template_raw_json ?? ''); copyMessage.value = '已复制' }
  catch { copyMessage.value = '复制未授权' }
  window.setTimeout(() => { copyMessage.value = '' }, 1600)
}

function typeLabel(videoType: VideoType) { return report.value?.video_types.find(item => item.video_type === videoType)?.label ?? videoType }
function evaluatorType(videoType: VideoType) { return evaluator.value?.video_types.find(item => item.video_type === videoType) }
const dimensionLabels: Record<ProfessionalQualityDimensionId, string> = { creative_brief_and_audience_promise: '简报', premise_and_theme_unity: '命题', structure_causality_and_pacing: '结构', character_agency_and_relationship_change: '人物', scene_function_visible_action_and_blocking: '场景', dialogue_narration_and_subtext: '台词', emotional_curve_and_aftertaste: '情绪', cultural_fact_and_adaptation_boundary: '事实', production_executability: '制作', originality_and_distinctiveness: '原创' }
function dimensionLabel(dimension: ProfessionalQualityDimensionId) { return dimensionLabels[dimension] }
</script>

<style scoped>
.review-page{min-height:100%;padding:28px;color:#f1eee8;background:radial-gradient(circle at 84% 0%,#523f58,#241e2a 38%,#0d0a10 100%)}.hero{max-width:1540px;margin:0 auto 16px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px}.hero h2{margin:4px 0 8px;font-size:clamp(30px,4vw,48px);letter-spacing:-.04em}.hero p{max-width:980px;margin:0;color:#b8aebd}.hero a,.actions button,.actions label{padding:9px 13px;border:1px solid #735d78;border-radius:9px;color:#f1eaf3;background:#3a2e3e;text-decoration:none;cursor:pointer;font:inherit}.eyebrow{color:#d6a6df!important;font-size:11px;font-weight:800;letter-spacing:.16em}.truth-lock{max-width:1540px;margin:0 auto 14px;padding:14px 16px;display:flex;gap:14px;border:1px solid #8d663c;border-radius:12px;color:#f4d49c;background:#372718}.truth-lock span{color:#c9ad7d}.error-banner{max-width:1540px;margin:0 auto 13px;padding:11px;border-radius:9px;color:#ffb5ba;background:#461f25}.summary-grid{max-width:1540px;margin:0 auto 10px;display:grid;grid-template-columns:repeat(6,1fr);gap:7px}.summary-grid article{padding:11px;border:1px solid #5e4c64;border-radius:9px;background:#261f2a}.summary-grid span{display:block;color:#a99dac;font-size:9px}.summary-grid strong{font-size:20px}.summary-grid .zero strong{color:#ff9da6}.threshold-strip{max-width:1540px;margin:0 auto 8px;display:grid;grid-template-columns:repeat(6,1fr);gap:6px}.threshold-strip span{padding:8px;border-radius:7px;color:#b7aebe;background:#1e1822;font-size:9px}.threshold-strip b{float:right;color:#dfc5e6}.evaluator-lock{max-width:1540px;margin:0 auto 13px;padding:10px 12px;box-sizing:border-box;display:flex;gap:12px;align-items:center;border:1px solid #67516f;border-radius:9px;color:#d8c3dd;background:#281f2c;font-size:9px}.evaluator-lock strong{color:#edcff4}.evaluator-lock span{flex:1}.evaluator-lock code{color:#a995ad}.main-grid{max-width:1540px;margin:auto;display:grid;grid-template-columns:.9fr 1.1fr;gap:14px;align-items:start}.intake-card,.portfolio-card{overflow:hidden;border:1px solid #5e4b63;border-radius:12px;background:rgba(31,25,34,.97)}.intake-card>header,.portfolio-card>header{padding:13px;display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid #493b4d}.intake-card h3,.portfolio-card h3{margin:3px 0}.actions,.filters{display:flex;gap:6px}.actions input{display:none}.actions .primary{border-color:#ad7fba;background:#6a4374}.actions button:disabled{opacity:.55;cursor:wait}.intake-card textarea{width:100%;min-height:590px;padding:14px;box-sizing:border-box;resize:vertical;border:0;border-bottom:1px solid #493b4d;outline:0;color:#e3dbe5;background:#0b080d;font:9px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.intake-card footer{padding:10px;display:grid;grid-template-columns:repeat(2,1fr);gap:5px}.intake-card footer span{padding:7px;border-radius:6px;color:#a99ead;background:#28212c;font-size:8px}.intake-card footer b{float:right;color:#ff9ca5}.filters select{padding:7px;border:1px solid #67556c;border-radius:7px;color:#eee5f0;background:#17121a;font-size:9px}.project-list{max-height:680px;padding:10px;display:grid;grid-template-columns:repeat(2,1fr);gap:7px;overflow:auto}.project-list>article{padding:10px;border-radius:8px;background:#2b2230}.project-list article>div{display:flex;justify-content:space-between;gap:8px}.project-list span{color:#c6b2cc;font-size:8px}.project-list b{padding:3px 5px;border-radius:4px;font-size:7px}.project-list .blocked{color:#ffb5b9;background:#5a282f}.project-list .ready_for_external_blind_review{color:#b8e0a5;background:#294a2d}.project-list code{display:block;margin-top:7px;color:#ddcbe1;font-size:8px;overflow-wrap:anywhere}.project-list p{margin:5px 0;color:#aaa0ad;font-size:8px}.project-list small{color:#8e8491;font-size:7px}.type-grid{max-width:1540px;margin:14px auto 0;display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.type-grid article{padding:10px;border:1px solid #534458;border-radius:8px;background:#211b25}.type-grid header{display:flex;justify-content:space-between;font-size:9px}.type-grid header b{color:#d9bee0}.type-grid article>div{height:4px;margin:8px 0;border-radius:3px;background:#413548}.type-grid i{display:block;height:100%;border-radius:3px;background:#b77fc3}.type-grid small{color:#918795;font-size:7px}.type-grid p{margin:7px 0 4px;color:#c8b1ce;font-size:7px}.type-grid code{color:#786d7c;font-size:6px}
@media(max-width:1100px){.summary-grid,.threshold-strip{grid-template-columns:repeat(3,1fr)}.main-grid{grid-template-columns:1fr}.type-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:700px){.review-page{padding:18px 12px}.hero,.truth-lock,.intake-card>header,.portfolio-card>header{align-items:flex-start;flex-direction:column}.summary-grid,.threshold-strip,.project-list,.type-grid{grid-template-columns:1fr}.actions,.filters{flex-wrap:wrap}}
</style>
