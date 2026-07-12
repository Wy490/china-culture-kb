<template>
  <section class="tower-page">
    <header class="hero">
      <div>
        <p class="eyebrow">STORY AGENT · STAGE 6 · OPERATOR CONTROL TOWER</p>
        <h2>修订总控与外部输入交接</h2>
        <p>聚合初始包、P0 intake、两轮修订、桌读版本和退出审计，为每个项目确定唯一下一动作。</p>
      </div>
      <div class="hero-actions">
        <button :disabled="loading" @click="loadReport">{{ loading ? '刷新中…' : '刷新证据' }}</button>
        <button :disabled="!report" @click="copyHandoff">复制交接 JSON</button>
        <button class="primary" :disabled="!report" @click="downloadHandoff">下载交接 JSON</button>
      </div>
    </header>

    <div class="truth-lock">
      <strong>交接包不是证据本身</strong>
      <span>生成、复制或下载交接包均不表示外部输入完成；本页无 execute endpoint，不持久化交接包，也不授予真实修订或专业通过。</span>
    </div>
    <p v-if="copyMessage" class="copy-banner">{{ copyMessage }}</p>
    <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>

    <template v-if="report">
      <section class="metrics">
        <article><span>外部交接项目</span><strong>{{ report.summary.external_handoff_project_count }}</strong></article>
        <article><span>P0 Ready</span><strong>{{ report.summary.p0_ready_project_count }}</strong></article>
        <article><span>真实修订轮次</span><strong>{{ report.summary.verified_real_revision_round_count }}</strong></article>
        <article><span>退出复核候选</span><strong>{{ report.summary.exit_review_candidate_project_count }}</strong></article>
        <article class="locked"><span>专业通过</span><strong>{{ report.summary.professional_pass_count }}</strong></article>
      </section>

      <section class="lanes">
        <RouterLink v-for="lane in report.lanes" :key="lane.lane_id" :to="lane.route" :class="lane.status">
          <span>{{ lane.label }}</span><strong>{{ lane.completed_count }} / {{ lane.target_count }}</strong><small>{{ laneStatus(lane.status) }} · 信用 0</small>
        </RouterLink>
      </section>

      <section class="source-strip">
        <div><span>Handoff canonical</span><code>{{ shortHash(report.handoff_canonical_sha256) }}</code></div>
        <div><span>Readiness</span><code>{{ shortHash(report.source_readiness_canonical_sha256) }}</code></div>
        <div><span>Intake</span><code>{{ shortHash(report.source_intake_canonical_sha256) }}</code></div>
        <div><span>Registry</span><code>{{ shortHash(report.source_registry_canonical_sha256) }}</code></div>
      </section>

      <section class="controls">
        <div class="filters">
          <button v-for="item in phaseFilters" :key="item.id" :class="{ active: phaseFilter === item.id }" @click="phaseFilter = item.id">{{ item.label }}</button>
        </div>
        <label>缺失类型<select v-model="requirementFilter"><option value="all">全部</option><option v-for="item in requirementOptions" :key="item" :value="item">{{ requirementLabel(item) }}</option></select></label>
      </section>

      <section class="project-grid">
        <article v-for="project in filteredProjects" :key="project.benchmark_id" class="project-card">
          <header>
            <div><span>{{ videoTypeLabel(project.video_type) }}</span><h3>{{ project.source_entry }}</h3></div>
            <b>{{ phaseLabel(project.phase) }}</b>
          </header>
          <p class="identity"><code>{{ project.benchmark_id }}</code><span>{{ project.real_project_id || '未绑定真实项目 ID' }}</span></p>
          <div class="facts"><span>P0 <b>{{ project.readiness_status }}</b></span><span>执行 <b>{{ project.execution_status }}</b></span><span>真实轮次 <b>{{ project.verified_real_revision_round_count }}/2</b></span><span>开放意见 <b>{{ project.effective_open_feedback_count }}</b></span></div>
          <div class="requirements"><span v-for="item in project.requirement_categories" :key="item">{{ requirementLabel(item) }}</span></div>
          <RouterLink class="next-action" :to="project.next_action.route"><small>NEXT · {{ project.next_action.code }}</small><strong>{{ project.next_action.label }}</strong></RouterLink>
          <details><summary>查看 {{ project.blocker_codes.length }} 个 blocker 与证据路径</summary><div class="detail-grid"><section><h4>Blocker codes</h4><code v-for="code in project.blocker_codes" :key="code">{{ code }}</code></section><section><h4>Evidence paths / details</h4><code v-for="(path, index) in project.blocking_evidence_paths" :key="`${path}-${index}`">{{ path }}</code></section></div></details>
          <footer><span>外部输入：需要</span><strong>专业通过：否</strong></footer>
        </article>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Stage6OperatorControlTowerReport, Stage6OperatorPhase, Stage6OperatorRequirementCategory, VideoType } from '@shared/types'
import { getStage6OperatorControlTower } from '../api/stage6-revisions'

const report = ref<Stage6OperatorControlTowerReport | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const copyMessage = ref('')
const phaseFilter = ref<'all' | Stage6OperatorPhase>('all')
const requirementFilter = ref<'all' | Stage6OperatorRequirementCategory>('all')

const phaseFilters: Array<{ id: 'all' | Stage6OperatorPhase; label: string }> = [
  { id: 'all', label: '全部 15 项' }, { id: 'awaiting_real_input', label: '等待真实输入' }, { id: 'awaiting_round_1', label: '等待 R1' },
  { id: 'awaiting_round_2', label: '等待 R2' }, { id: 'awaiting_table_read_closure', label: '等待桌读关闭' },
  { id: 'awaiting_exit_evidence', label: '等待退出证据' }, { id: 'eligible_for_stage6_exit_review', label: '退出复核候选' },
]
const requirementOptions: Stage6OperatorRequirementCategory[] = ['operator_identity', 'real_project', 'initial_package', 'authorization', 'budget', 'reviewers', 'table_read', 'revision_execution', 'exit_evidence']
const filteredProjects = computed(() => (report.value?.projects ?? []).filter(project => (
  (phaseFilter.value === 'all' || project.phase === phaseFilter.value)
  && (requirementFilter.value === 'all' || project.requirement_categories.includes(requirementFilter.value))
)))

onMounted(loadReport)

async function loadReport() {
  loading.value = true
  errorMessage.value = ''
  const response = await getStage6OperatorControlTower()
  loading.value = false
  if (!response.ok || !response.data) { errorMessage.value = response.error?.message ?? 'Stage 6 总控加载失败'; return }
  report.value = response.data
}

async function copyHandoff() {
  if (!report.value) return
  try { await navigator.clipboard.writeText(`${JSON.stringify(report.value, null, 2)}\n`); copyMessage.value = '交接 JSON 已复制；复制不表示外部输入完成。' } catch { copyMessage.value = '浏览器未授权复制。' }
  window.setTimeout(() => { copyMessage.value = '' }, 2400)
}

function downloadHandoff() {
  if (!report.value) return
  const blob = new Blob([`${JSON.stringify(report.value, null, 2)}\n`], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'story-agent-stage6-operator-handoff.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

const VIDEO_LABELS: Record<VideoType, string> = { character_story:'人物故事',historical_drama:'历史剧情',legend_story:'传说故事',children_story:'儿童故事',ai_comic_drama:'AI 漫剧',culture_promo:'文化宣传',heritage_promo:'非遗宣传',city_brand_promo:'城市品牌',social_short:'社交短视频',documentary_short:'纪录短片',explainer_video:'科普讲解',lecture_video:'演讲视频',education_training:'教育培训',scene_short:'场景短片',landscape_mood:'风景意境' }
const REQUIREMENT_LABELS: Record<Stage6OperatorRequirementCategory,string> = { operator_identity:'Operator 身份',real_project:'真实项目 / provenance',initial_package:'初始包',authorization:'创作授权',budget:'预算 / 成本',reviewers:'实名评审',table_read:'桌读排期 / 意见',revision_execution:'修订执行',exit_evidence:'退出证据' }
const PHASE_LABELS: Record<Stage6OperatorPhase,string> = { awaiting_real_input:'等待真实输入',awaiting_round_1:'等待 Round 1',awaiting_round_2:'等待 Round 2',awaiting_table_read_closure:'等待桌读关闭',awaiting_exit_evidence:'等待退出证据',eligible_for_stage6_exit_review:'退出复核候选' }
function videoTypeLabel(value:VideoType){return VIDEO_LABELS[value]} function requirementLabel(value:Stage6OperatorRequirementCategory){return REQUIREMENT_LABELS[value]} function phaseLabel(value:Stage6OperatorPhase){return PHASE_LABELS[value]} function laneStatus(value:string){return value==='complete'?'完成':value==='ready_for_operator'?'可操作':'阻断'} function shortHash(value:string){return `${value.slice(0,10)}…${value.slice(-6)}`}
</script>

<style scoped>
.tower-page{min-height:100%;padding:28px;color:#e8edf2;background:radial-gradient(circle at 88% 0%,#33454b,#17232b 38%,#091016 100%)}.hero{max-width:1480px;margin:0 auto 18px;display:flex;align-items:flex-end;justify-content:space-between;gap:24px}.hero h2{margin:4px 0 8px;font-size:clamp(30px,4vw,48px);letter-spacing:-.04em}.hero p{max-width:900px;margin:0;color:#a7b2b8}.eyebrow{color:#8ed4d8!important;font-size:11px;font-weight:800;letter-spacing:.17em}.hero-actions{display:flex;flex-wrap:wrap;gap:8px}.hero button,.filters button{padding:9px 13px;border:1px solid #46626b;border-radius:9px;color:#e1ebed;background:#1c3037;cursor:pointer;font:inherit}.hero button:hover,.filters button:hover,.filters button.active{border-color:#86ccd1;background:#27434a}.hero .primary{background:#315c65}.hero button:disabled{opacity:.5}.truth-lock{max-width:1480px;margin:0 auto 16px;padding:14px 16px;display:flex;gap:14px;border:1px solid #816335;border-radius:12px;color:#efd39e;background:#302515}.truth-lock span{color:#c6ad7d}.copy-banner,.error-banner{max-width:1480px;margin:0 auto 14px;padding:11px;border-radius:9px}.copy-banner{color:#8cdecf;background:#14352f}.error-banner{color:#ffb0be;background:#481d2a}
.metrics{max-width:1480px;margin:0 auto 13px;display:grid;grid-template-columns:repeat(5,1fr);gap:9px}.metrics article{padding:14px 16px;border:1px solid #344b53;border-radius:12px;background:#112128}.metrics span{display:block;color:#819198;font-size:11px}.metrics strong{font-size:27px}.metrics .locked strong{color:#ff91a4}.lanes{max-width:1480px;margin:0 auto 13px;display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.lanes a{padding:12px;border:1px solid #374d55;border-radius:10px;color:#dbe6e8;background:#102027;text-decoration:none}.lanes a.blocked{border-color:#60404a;background:#291a20}.lanes span,.lanes small{display:block}.lanes span{color:#91a4aa;font-size:10px}.lanes strong{font-size:20px}.lanes small{margin-top:3px;color:#798b91;font-size:9px}.source-strip{max-width:1480px;margin:0 auto 13px;display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.source-strip div{padding:10px 12px;border:1px solid #2c4149;border-radius:8px;background:#0d1b21}.source-strip span{display:block;color:#71858c;font-size:9px}.source-strip code{color:#acd0d1;font-size:10px}.controls{max-width:1480px;margin:0 auto 14px;display:flex;align-items:center;justify-content:space-between;gap:12px}.filters{display:flex;flex-wrap:wrap;gap:6px}.filters button{padding:7px 10px;font-size:11px}.controls label{color:#87989e;font-size:11px}.controls select{margin-left:7px;padding:7px;border:1px solid #3a535b;border-radius:7px;color:#dbe5e7;background:#102127}
.project-grid{max-width:1480px;margin:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.project-card{overflow:hidden;border:1px solid #354c54;border-radius:13px;background:rgba(13,28,35,.96)}.project-card>header{padding:14px 16px;display:flex;justify-content:space-between;border-bottom:1px solid #293e46}.project-card header span{color:#7fd1d1;font-size:10px}.project-card h3{margin:3px 0 0;font-size:17px}.project-card header>b{color:#ff9bac;font-size:10px}.identity{margin:10px 16px;display:flex;justify-content:space-between;color:#788b91;font-size:10px}.identity code{color:#9cb9bd}.facts{margin:0 16px 10px;display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.facts span{padding:7px;border-radius:6px;color:#778990;background:#0a181e;font-size:9px}.facts b{display:block;margin-top:2px;color:#d0dcde;font-size:10px;overflow-wrap:anywhere}.requirements{margin:0 16px 10px;display:flex;flex-wrap:wrap;gap:5px}.requirements span{padding:4px 7px;border-radius:99px;color:#e4b8c0;background:#382029;font-size:9px}.next-action{margin:0 16px 11px;padding:11px;display:block;border:1px solid #3d656b;border-radius:9px;color:#dcebed;background:#173137;text-decoration:none}.next-action small,.next-action strong{display:block}.next-action small{color:#78bfc4;font-size:9px}.next-action strong{margin-top:3px;font-size:12px}details{margin:0 16px 12px;border:1px solid #35474d;border-radius:8px;background:#0d191e}summary{padding:9px 11px;color:#94a7ac;font-size:10px;cursor:pointer}.detail-grid{padding:0 11px 10px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.detail-grid h4{margin:5px 0;color:#76898f;font-size:9px}.detail-grid code{display:block;margin:3px 0;color:#b3c1c3;overflow-wrap:anywhere;font-size:9px}.project-card footer{padding:10px 16px;display:flex;justify-content:space-between;border-top:1px solid #293d44;color:#809298;font-size:10px}.project-card footer strong{color:#ff94a7}
@media(max-width:1050px){.metrics,.lanes{grid-template-columns:repeat(3,1fr)}.project-grid{grid-template-columns:1fr}}@media(max-width:720px){.tower-page{padding:18px 12px}.hero,.truth-lock,.controls{align-items:flex-start;flex-direction:column}.metrics,.lanes,.source-strip{grid-template-columns:repeat(2,1fr)}.facts{grid-template-columns:repeat(2,1fr)}.detail-grid{grid-template-columns:1fr}.identity{flex-direction:column;gap:5px}}
</style>
