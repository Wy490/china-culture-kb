<template>
  <section class="audit-page">
    <header class="hero">
      <div>
        <p class="eyebrow">STORY AGENT · STAGE 6 · EXIT AUDIT</p>
        <h2>真实修订退出审计</h2>
        <p>重新核验 P0、两轮 provenance、不可变 artifact DAG、哈希连续、预算、桌读关闭、派生重建与质量增量。</p>
      </div>
      <nav>
        <RouterLink to="/story/stage6-preflight">批次预检</RouterLink>
        <RouterLink to="/story/stage6-revisions">修订工作台</RouterLink>
        <button :disabled="loading" @click="loadAudit">{{ loading ? '审计中…' : '刷新只读审计' }}</button>
      </nav>
    </header>

    <div class="truth-lock">
      <strong>只读审计锁</strong>
      <span>退出候选只表示可进入人工复核；不等于专业通过。本页不执行修订、不写 artifact、不关闭桌读意见。</span>
    </div>
    <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>

    <template v-if="report">
      <section class="metrics">
        <article><span>项目</span><strong>{{ report.summary.project_count }}</strong></article>
        <article class="blocked"><span>Blocked</span><strong>{{ report.summary.blocked_project_count }}</strong></article>
        <article class="candidate"><span>退出复核候选</span><strong>{{ report.summary.eligible_for_stage6_exit_review_project_count }}</strong></article>
        <article><span>真实修订轮次</span><strong>{{ report.summary.verified_real_revision_round_count }}</strong></article>
        <article class="locked"><span>专业通过</span><strong>{{ report.summary.professional_pass_count }}</strong></article>
      </section>

      <section class="source-strip">
        <div><span>Readiness</span><code>{{ shortHash(report.source_readiness_canonical_sha256) }}</code></div>
        <div><span>Intake</span><code>{{ shortHash(report.source_intake_canonical_sha256) }}</code></div>
        <div><span>Registry</span><code>{{ shortHash(report.source_registry_canonical_sha256) }}</code></div>
        <div><span>生成时间</span><code>{{ formatTime(report.generated_at) }}</code></div>
      </section>

      <section class="controls">
        <div class="filters">
          <button v-for="item in filters" :key="item.id" :class="{ active: filter === item.id }" @click="filter = item.id">{{ item.label }}</button>
        </div>
        <p>要求每项目 {{ report.policy.required_real_revision_round_count }} 轮真实修订；simulation / fixture / fallback / prepared / recovered 信用均为 0。</p>
      </section>

      <section class="project-list">
        <article v-for="project in filteredProjects" :key="project.benchmark_id" class="project-card" :class="project.status">
          <header>
            <div><span>{{ videoTypeLabel(project.video_type) }}</span><h3>{{ project.source_entry }}</h3></div>
            <b>{{ project.status === 'blocked' ? 'BLOCKED' : 'EXIT REVIEW' }}</b>
          </header>
          <p class="identity"><code>{{ project.benchmark_id }}</code><span>{{ project.real_project_id || '未绑定真实项目 ID' }}</span></p>
          <div class="round-facts">
            <span>记录轮次 <b>{{ project.recorded_round_count }}/2</b></span>
            <span>真实轮次 <b>{{ project.verified_real_revision_round_count }}/2</b></span>
            <span>开放意见 <b>{{ project.effective_open_feedback_count }}</b></span>
            <span>成本 <b>{{ costLabel(project.total_cost_amount, project.cost_currency) }}</b></span>
          </div>
          <div class="check-grid">
            <span v-for="(passed, key) in project.checks" :key="key" :class="passed ? 'check-ok' : 'check-fail'">
              {{ passed ? '✓' : '×' }} {{ checkLabel(key) }}
            </span>
          </div>
          <details :open="project.status === 'blocked'">
            <summary>阻断 {{ project.blockers.length }} 项</summary>
            <ul>
              <li v-for="(blocker, index) in project.blockers" :key="`${blocker.code}-${index}`">
                <b>{{ blocker.code }}</b><span>{{ blocker.detail }}</span>
              </li>
            </ul>
          </details>
          <footer>
            <span>退出候选：{{ project.stage6_exit_candidate ? '是' : '否' }}</span>
            <strong>专业通过：否</strong>
          </footer>
        </article>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Stage6RealRevisionExitAuditReport, VideoType } from '@shared/types'
import { getStage6RealRevisionExitAudit } from '../api/stage6-revisions'

const report = ref<Stage6RealRevisionExitAuditReport | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const filter = ref<'all' | 'blocked' | 'eligible_for_stage6_exit_review'>('all')
const filters = [
  { id: 'all' as const, label: '全部 15 项' },
  { id: 'blocked' as const, label: 'Blocked' },
  { id: 'eligible_for_stage6_exit_review' as const, label: '退出复核候选' },
]

const filteredProjects = computed(() => (report.value?.projects ?? []).filter(project => (
  filter.value === 'all' || project.status === filter.value
)))

onMounted(loadAudit)

async function loadAudit() {
  loading.value = true
  errorMessage.value = ''
  const response = await getStage6RealRevisionExitAudit()
  loading.value = false
  if (!response.ok || !response.data) {
    errorMessage.value = response.error?.message ?? 'Stage 6 退出审计加载失败'
    return
  }
  report.value = response.data
}

const VIDEO_TYPE_LABELS: Record<VideoType, string> = {
  character_story: '人物故事', historical_drama: '历史剧情', legend_story: '传说故事', children_story: '儿童故事', ai_comic_drama: 'AI 漫剧',
  culture_promo: '文化宣传', heritage_promo: '非遗宣传', city_brand_promo: '城市品牌', social_short: '社交短视频', documentary_short: '纪录短片',
  explainer_video: '科普讲解', lecture_video: '演讲视频', education_training: '教育培训', scene_short: '场景短片', landscape_mood: '风景意境',
}

const CHECK_LABELS: Record<string, string> = {
  p0_readiness_reverified: 'P0 readiness 重验',
  two_rounds_completed: '两轮记录完整',
  two_rounds_real_provenance_verified: '两轮真实 provenance',
  immutable_artifact_dag_valid: '不可变 artifact DAG',
  package_hash_chain_valid: 'Round 0→1→2 哈希链',
  revision_budget_valid: '预算与币种',
  three_role_table_read_valid: '三角色桌读',
  all_feedback_effectively_closed: '桌读意见有效关闭',
  derived_rebuilds_complete: '派生文本重建',
  quality_improvement_traceable: '质量增量可追溯',
}

function videoTypeLabel(value: VideoType) { return VIDEO_TYPE_LABELS[value] }
function checkLabel(value: string) { return CHECK_LABELS[value] ?? value }
function shortHash(value: string) { return `${value.slice(0, 10)}…${value.slice(-6)}` }
function formatTime(value: string) { return new Date(value).toLocaleString('zh-CN', { hour12: false }) }
function costLabel(amount: number, currency: string) { return currency ? `${amount.toFixed(2)} ${currency}` : '—' }
</script>

<style scoped>
.audit-page { min-height: 100%; padding: 28px; color: #e7f0ef; background: radial-gradient(circle at 90% 0%, #193c3e, #101b24 40%, #071015 100%); }
.hero { max-width: 1440px; margin: 0 auto 18px; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }.hero h2 { margin: 4px 0 8px; font-size: clamp(30px,4vw,48px); letter-spacing: -.04em; }.hero p { max-width: 900px; margin: 0; color: #9db0b1; }.hero nav { display: flex; flex-wrap: wrap; gap: 8px; }.hero a,.hero button,.filters button { padding: 9px 13px; border: 1px solid #376165; border-radius: 9px; color: #d9e8e7; background: #12282c; text-decoration: none; cursor: pointer; font: inherit; }.hero a:hover,.hero button:hover,.filters button:hover,.filters button.active { border-color: #6fc7be; background: #18383b; }.hero button:disabled { opacity: .5; }
.eyebrow { color: #70d2c5 !important; font-size: 11px; font-weight: 800; letter-spacing: .17em; }.truth-lock { max-width: 1440px; margin: 0 auto 18px; padding: 14px 16px; display: flex; gap: 15px; border: 1px solid #826331; border-radius: 12px; color: #f0d49b; background: #2f2514; }.truth-lock span { color: #c4aa7a; }.error-banner { max-width: 1440px; margin: 0 auto 16px; padding: 12px; border-radius: 10px; color: #ffb1bd; background: #451b27; }
.metrics { max-width: 1440px; margin: 0 auto 14px; display: grid; grid-template-columns: repeat(5,1fr); gap: 10px; }.metrics article { padding: 15px 17px; border: 1px solid #29464b; border-radius: 13px; background: #0e2025; }.metrics span { display: block; color: #81999b; font-size: 12px; }.metrics strong { font-size: 28px; }.metrics .blocked strong,.metrics .locked strong { color: #ff90a0; }.metrics .candidate strong { color: #73d4c5; }
.source-strip { max-width: 1440px; margin: 0 auto 14px; display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }.source-strip div { padding: 11px 13px; border: 1px solid #233d42; border-radius: 9px; background: #0b1a1f; }.source-strip span { display: block; margin-bottom: 4px; color: #70888b; font-size: 10px; text-transform: uppercase; }.source-strip code { color: #afd2ce; font-size: 11px; }
.controls { max-width: 1440px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: space-between; gap: 18px; }.filters { display: flex; gap: 8px; }.controls p { margin: 0; color: #819698; font-size: 12px; text-align: right; }
.project-list { max-width: 1440px; margin: auto; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 13px; }.project-card { overflow: hidden; border: 1px solid #30464a; border-radius: 14px; background: rgba(12,27,32,.96); }.project-card>header { padding: 15px 17px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #233a3e; }.project-card header span { color: #6fc9bd; font-size: 11px; font-weight: 700; }.project-card h3 { margin: 3px 0 0; font-size: 18px; }.project-card header>b { color: #ff91a1; font-size: 11px; letter-spacing: .1em; }.project-card.eligible_for_stage6_exit_review { border-color: #498f84; }.project-card.eligible_for_stage6_exit_review header>b { color: #70d8c6; }
.identity { margin: 12px 17px; display: flex; justify-content: space-between; gap: 12px; color: #778f91; font-size: 11px; }.identity code { color: #9fc1be; overflow-wrap: anywhere; }.round-facts { margin: 0 17px 12px; display: grid; grid-template-columns: repeat(4,1fr); gap: 7px; }.round-facts span { padding: 8px; border-radius: 7px; color: #708588; background: #0a181c; font-size: 10px; }.round-facts b { display: block; margin-top: 2px; color: #d1e1df; font-size: 13px; }
.check-grid { margin: 0 17px 13px; display: grid; grid-template-columns: repeat(2,1fr); gap: 6px; }.check-grid span { padding: 7px 9px; border-radius: 7px; font-size: 11px; }.check-ok { color: #75d7c7; background: #12352f; }.check-fail { color: #ef9aa6; background: #321a22; }
details { margin: 0 17px 14px; border: 1px solid #3d3338; border-radius: 9px; background: #18171b; }summary { padding: 10px 12px; color: #d2a0a7; cursor: pointer; }details ul { max-height: 210px; margin: 0; padding: 0 12px 12px; overflow: auto; list-style: none; }details li { padding: 7px 0; border-top: 1px solid #30272b; }details b { display: block; color: #e49aa5; font: 10px ui-monospace,monospace; }details span { color: #a99ba0; font-size: 11px; overflow-wrap: anywhere; }
.project-card footer { padding: 11px 17px; display: flex; justify-content: space-between; border-top: 1px solid #25393d; color: #789092; font-size: 11px; }.project-card footer strong { color: #ff91a1; }
@media(max-width:1050px){.metrics{grid-template-columns:repeat(3,1fr)}.source-strip{grid-template-columns:repeat(2,1fr)}.project-list{grid-template-columns:1fr}}@media(max-width:700px){.audit-page{padding:18px 12px}.hero,.truth-lock,.controls{align-items:flex-start;flex-direction:column}.metrics{grid-template-columns:repeat(2,1fr)}.source-strip{grid-template-columns:1fr}.controls p{text-align:left}.round-facts{grid-template-columns:repeat(2,1fr)}.check-grid{grid-template-columns:1fr}.identity{flex-direction:column}}
</style>
