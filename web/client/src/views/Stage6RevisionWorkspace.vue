<template>
  <section class="stage6-page">
    <header class="hero">
      <div>
        <p class="eyebrow">STORY AGENT · STAGE 6</p>
        <h2>桌读与版本修订工作台</h2>
        <p>把 Coverage、真人意见、版本变化与证据来源放在同一条可审计时间线上。</p>
      </div>
      <button class="refresh-button" :disabled="loading" @click="loadPortfolio">{{ loading ? '刷新中…' : '刷新状态' }}</button>
    </header>

    <div class="truth-banner">
      <strong>真实性边界</strong>
      <span>机器候选、准备态、simulation、fixture 与恢复状态均不等于真实修订或专业通过。</span>
    </div>

    <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>

    <div v-if="portfolio" class="metrics-grid">
      <article><span>项目</span><strong>{{ portfolio.summary.project_count }}</strong></article>
      <article><span>外部阻断</span><strong>{{ portfolio.summary.blocked_project_count }}</strong></article>
      <article><span>真实修订轮次</span><strong>{{ portfolio.summary.verified_real_revision_round_count }}</strong></article>
      <article class="metric-zero"><span>专业通过</span><strong>{{ portfolio.summary.professional_pass_count }}</strong></article>
    </div>

    <div class="workspace-grid">
      <aside class="project-rail">
        <div class="rail-title">
          <h3>15 类执行位</h3>
          <span>{{ filteredProjects.length }} 项</span>
        </div>
        <label class="filter-field">
          <span>筛选</span>
          <select v-model="projectFilter">
            <option value="all">全部</option>
            <option value="blocked">仅阻断</option>
            <option value="active">有修订记录</option>
          </select>
        </label>
        <button
          v-for="project in filteredProjects"
          :key="project.benchmark_id"
          class="project-card"
          :class="{ selected: project.benchmark_id === selectedBenchmarkId }"
          @click="selectProject(project.benchmark_id)"
        >
          <span class="project-card__type">{{ videoTypeLabel(project.video_type) }}</span>
          <strong>{{ project.source_entry }}</strong>
          <span class="project-card__meta">{{ executionLabel(project.execution_status) }}</span>
          <span class="evidence-badge" :class="`badge-${project.evidence_badge}`">{{ badgeLabel(project.evidence_badge) }}</span>
        </button>
      </aside>

      <main class="detail-panel">
        <div v-if="detailLoading" class="empty-state">正在读取版本证据链…</div>
        <div v-else-if="!detail" class="empty-state">请选择一个 Stage 6 项目。</div>
        <template v-else>
          <header class="detail-header">
            <div>
              <p class="eyebrow">{{ videoTypeLabel(detail.project.video_type) }}</p>
              <h3>{{ detail.project.source_entry }}</h3>
              <p>{{ detail.project.real_project_id || '尚未接入真实项目 ID' }}</p>
            </div>
            <div class="header-badges">
              <span class="evidence-badge" :class="`badge-${detail.project.evidence_badge}`">{{ badgeLabel(detail.project.evidence_badge) }}</span>
              <span class="professional-lock">专业通过：否</span>
            </div>
          </header>

          <div v-if="detail.project.blockers.length" class="blocker-box">
            <strong>当前阻断 {{ detail.project.blockers.length }} 项</strong>
            <div class="blocker-chips">
              <span v-for="blocker in detail.project.blockers" :key="blocker">{{ blockerLabel(blocker) }}</span>
            </div>
          </div>

          <nav class="detail-tabs" aria-label="Stage 6 工作台分区">
            <button v-for="tab in tabs" :key="tab.id" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">{{ tab.label }}</button>
          </nav>

          <section v-if="activeTab === 'coverage'" class="tab-section">
            <div class="section-heading">
              <div><p class="eyebrow">六类 Coverage</p><h4>修订问题地图</h4></div>
              <span>只展示当前包证据</span>
            </div>
            <div class="coverage-grid">
              <article v-for="item in detail.coverage" :key="item.category" class="coverage-card">
                <div><span class="coverage-index">{{ coverageIndex(item.category) }}</span><h5>{{ item.label }}</h5></div>
                <template v-if="item.notes.length || item.action_items.length || item.issue_ids.length">
                  <p v-for="note in item.notes" :key="note">{{ note }}</p>
                  <ul><li v-for="action in item.action_items" :key="action">{{ action }}</li></ul>
                  <span v-for="issue in item.issue_ids" :key="issue" class="issue-chip">{{ issue }}</span>
                </template>
                <p v-else class="muted">尚无可验证版本，不能生成虚构 Coverage。</p>
              </article>
            </div>
          </section>

          <section v-else-if="activeTab === 'versions'" class="tab-section">
            <div class="section-heading">
              <div><p class="eyebrow">ROUND 0 / 1 / 2</p><h4>文本与十维质量变化</h4></div>
              <span>机器分数不授予专业通过</span>
            </div>
            <div class="version-grid">
              <article v-for="version in detail.versions" :key="version.round_number" class="version-card" :class="{ unavailable: !version.available }">
                <div class="version-card__head">
                  <div><span>R{{ version.round_number }}</span><h5>{{ version.label }}</h5></div>
                  <span class="evidence-badge" :class="`badge-${version.evidence_badge}`">{{ badgeLabel(version.evidence_badge) }}</span>
                </div>
                <template v-if="version.available">
                  <div class="score-line"><strong>{{ version.total_score ?? '—' }}</strong><span>机器候选分</span><b>{{ version.scene_count }} 场</b></div>
                  <div class="dimension-list">
                    <div v-for="dimension in version.quality_dimensions" :key="dimension.dimension_id">
                      <span>{{ dimension.label }}</span><strong>{{ dimension.score ?? '—' }}</strong>
                      <em v-if="dimension.delta_from_previous !== undefined" :class="{ positive: dimension.delta_from_previous > 0 }">{{ signed(dimension.delta_from_previous) }}</em>
                    </div>
                  </div>
                  <details><summary>查看正文</summary><pre>{{ version.full_text }}</pre></details>
                </template>
                <p v-else class="muted">该轮尚无不可变文本 artifact。</p>
              </article>
            </div>
          </section>

          <section v-else-if="activeTab === 'diff'" class="tab-section">
            <div class="section-heading"><div><p class="eyebrow">VERSION DIFF</p><h4>逐行文本变化</h4></div></div>
            <article v-for="diff in detail.text_diffs" :key="`${diff.from_round}-${diff.to_round}`" class="diff-card">
              <header><strong>Round {{ diff.from_round }} → Round {{ diff.to_round }}</strong><span v-if="diff.available">+{{ diff.added_line_count }} / −{{ diff.removed_line_count }}</span></header>
              <div v-if="diff.available" class="diff-lines">
                <div v-for="(hunk, index) in diff.hunks" :key="index" :class="`diff-${hunk.type}`"><span>{{ hunk.type === 'added' ? '+' : hunk.type === 'removed' ? '−' : ' ' }}</span>{{ hunk.text }}</div>
              </div>
              <p v-else class="muted">相邻两轮尚未同时形成，不能展示伪差异。</p>
            </article>
            <div class="derived-list">
              <h4>派生文本重建</h4>
              <p v-if="!detail.derived_rebuilds.length" class="muted">尚无修订轮次。</p>
              <article v-for="item in detail.derived_rebuilds" :key="item.round_number">
                <strong>Round {{ item.round_number }}</strong>
                <span :class="item.complete ? 'rebuild-ok' : 'rebuild-fail'">{{ item.complete ? '重建完整' : '存在陈旧派生文本' }}</span>
                <small>{{ item.rebuilt_sections.join('、') || '无重建证据' }}</small>
              </article>
            </div>
          </section>

          <section v-else class="tab-section">
            <div class="section-heading">
              <div><p class="eyebrow">TABLE READ</p><h4>反馈录入、分配、关闭与重开</h4></div>
              <span>状态版本 {{ detail.review_state_revision }}</span>
            </div>
            <div class="operator-fields">
              <label><span>操作人 ID</span><input v-model.trim="actorId" placeholder="必须实名" /></label>
              <label><span>操作人姓名</span><input v-model.trim="actorName" placeholder="必须实名" /></label>
            </div>

            <div class="draft-form">
              <div><strong>录入桌读意见草稿</strong><span>准备态草稿，不计真人桌读</span></div>
              <div class="draft-grid">
                <label><span>轮次</span><select v-model.number="draft.round_number"><option :value="1">Round 1</option><option :value="2">Round 2</option></select></label>
                <label><span>实名评审者</span><select v-model="draft.reviewer_id"><option value="">请选择</option><option v-for="reviewer in verifiedReviewers" :key="reviewer.reviewer_id" :value="reviewer.reviewer_id">{{ reviewer.display_name }} · {{ reviewer.role }}</option></select></label>
                <label><span>类别</span><select v-model="draft.category"><option v-for="item in detail.coverage" :key="item.category" :value="item.category">{{ item.label }}</option></select></label>
                <label><span>问题 ID</span><input v-model.trim="draft.issue_id" placeholder="例如 structure-opening" /></label>
                <label class="wide"><span>反馈内容</span><textarea v-model.trim="draft.note" rows="3" placeholder="记录可执行、可关闭的具体意见" /></label>
                <label><span>目标区段</span><select v-model="draft.target_section"><option value="full_text">正文</option><option value="scene_breakdown">分场</option><option value="dialogue_or_narration_pass">对白/旁白</option><option value="truth_and_adaptation_contract">事实边界</option></select></label>
              </div>
              <button class="primary-button" :disabled="!canCreateDraft || feedbackSaving" @click="submitDraft">保存准备态草稿</button>
              <p v-if="!verifiedReviewers.length" class="muted">P0 尚无已核验实名评审者，反馈录入保持关闭。</p>
            </div>

            <div v-if="detail.feedback_drafts.length" class="draft-list">
              <article v-for="item in detail.feedback_drafts" :key="item.draft_id">
                <span>准备态</span><strong>{{ item.note }}</strong><small>R{{ item.round_number }} · {{ item.reviewer_id }} · 不计真人桌读</small>
              </article>
            </div>

            <div class="feedback-list">
              <p v-if="!detail.feedback.length" class="muted">尚无不可变桌读 feedback artifact。</p>
              <article v-for="item in detail.feedback" :key="`${item.round_number}-${item.feedback_id}`" class="feedback-card">
                <header><span>R{{ item.round_number }} · {{ item.source }}</span><b :class="item.effective_status === 'closed' ? 'feedback-closed' : 'feedback-open'">{{ item.effective_status === 'closed' ? '已关闭' : '待处理' }}</b></header>
                <h5>{{ item.note }}</h5><p>{{ item.issue_id }} · {{ item.category }}</p>
                <label><span>分配给</span><select v-model="assignees[feedbackKey(item)]"><option value="">请选择实名评审者</option><option v-for="reviewer in verifiedReviewers" :key="reviewer.reviewer_id" :value="reviewer.reviewer_id">{{ reviewer.display_name }}</option></select></label>
                <button :disabled="!canOperate || feedbackSaving || !assignees[feedbackKey(item)]" @click="applyFeedback(item, 'assign')">分配</button>
                <template v-if="item.effective_status === 'open'">
                  <input v-model.trim="resolutions[feedbackKey(item)]" placeholder="关闭说明（必填）" />
                  <button class="primary-button" :disabled="!canOperate || feedbackSaving || !resolutions[feedbackKey(item)]" @click="applyFeedback(item, 'close')">关闭</button>
                </template>
                <button v-else class="danger-button" :disabled="!canOperate || feedbackSaving" @click="applyFeedback(item, 'reopen')">重开</button>
              </article>
            </div>
          </section>
        </template>
      </main>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type {
  Stage6EvidenceBadge,
  ProfessionalTextPackageField,
  Stage6RevisionWorkspaceDetail,
  Stage6RevisionWorkspaceFeedbackItem,
  Stage6RevisionWorkspacePortfolio,
  VideoType,
} from '@shared/types'
import {
  createStage6FeedbackDraft,
  getStage6RevisionDetail,
  getStage6RevisionPortfolio,
  updateStage6Feedback,
} from '../api/stage6-revisions'

const portfolio = ref<Stage6RevisionWorkspacePortfolio | null>(null)
const detail = ref<Stage6RevisionWorkspaceDetail | null>(null)
const selectedBenchmarkId = ref('')
const loading = ref(false)
const detailLoading = ref(false)
const feedbackSaving = ref(false)
const errorMessage = ref('')
const projectFilter = ref<'all' | 'blocked' | 'active'>('all')
const activeTab = ref<'coverage' | 'versions' | 'diff' | 'feedback'>('coverage')
const actorId = ref('')
const actorName = ref('')
const resolutions = reactive<Record<string, string>>({})
const assignees = reactive<Record<string, string>>({})
const draft = reactive({ round_number: 1 as 1 | 2, reviewer_id: '', category: 'structure' as Stage6RevisionWorkspaceFeedbackItem['category'], issue_id: '', note: '', target_section: 'full_text' as ProfessionalTextPackageField })

const tabs = [
  { id: 'coverage' as const, label: 'Coverage' },
  { id: 'versions' as const, label: '版本与评分' },
  { id: 'diff' as const, label: '文本差异' },
  { id: 'feedback' as const, label: '桌读反馈' },
]

const filteredProjects = computed(() => (portfolio.value?.projects ?? []).filter(project => {
  if (projectFilter.value === 'blocked') return project.readiness_status === 'blocked'
  if (projectFilter.value === 'active') return project.completed_round_count > 0
  return true
}))
const verifiedReviewers = computed(() => detail.value?.reviewers.filter(item => item.identity_verified && item.reviewer_id) ?? [])
const canOperate = computed(() => Boolean(actorId.value && actorName.value))
const canCreateDraft = computed(() => canOperate.value && Boolean(draft.reviewer_id && draft.issue_id && draft.note && draft.target_section))

onMounted(loadPortfolio)

async function loadPortfolio() {
  loading.value = true
  errorMessage.value = ''
  const response = await getStage6RevisionPortfolio()
  loading.value = false
  if (!response.ok || !response.data) {
    errorMessage.value = response.error?.message ?? 'Stage 6 状态加载失败'
    return
  }
  portfolio.value = response.data
  const next = selectedBenchmarkId.value || response.data.projects[0]?.benchmark_id
  if (next) await selectProject(next)
}

async function selectProject(benchmarkId: string) {
  selectedBenchmarkId.value = benchmarkId
  detailLoading.value = true
  errorMessage.value = ''
  const response = await getStage6RevisionDetail(benchmarkId)
  detailLoading.value = false
  if (!response.ok || !response.data) {
    errorMessage.value = response.error?.message ?? '项目详情加载失败'
    return
  }
  detail.value = response.data
}

async function applyFeedback(item: Stage6RevisionWorkspaceFeedbackItem, action: 'assign' | 'close' | 'reopen') {
  if (!detail.value || !canOperate.value) return
  feedbackSaving.value = true
  const key = feedbackKey(item)
  const response = await updateStage6Feedback(detail.value.project.benchmark_id, item.round_number, item.feedback_id, {
    schema_version: 'story-agent-stage6-feedback-review-update/v1',
    action,
    expected_state_revision: detail.value.review_state_revision,
    actor_id: actorId.value,
    actor_name: actorName.value,
    assigned_reviewer_id: action === 'assign' ? assignees[key] : undefined,
    resolution_note: action === 'close' ? resolutions[key] : undefined,
  })
  feedbackSaving.value = false
  if (!response.ok || !response.data) {
    errorMessage.value = response.error?.message ?? '反馈状态更新失败'
    return
  }
  detail.value = response.data
}

async function submitDraft() {
  if (!detail.value || !canCreateDraft.value) return
  feedbackSaving.value = true
  const response = await createStage6FeedbackDraft(detail.value.project.benchmark_id, {
    schema_version: 'story-agent-stage6-feedback-draft-create/v1',
    round_number: draft.round_number,
    reviewer_id: draft.reviewer_id,
    category: draft.category,
    note: draft.note,
    issue_id: draft.issue_id,
    target_sections: [draft.target_section],
    evidence_required: draft.category === 'fact_and_culture',
    actor_id: actorId.value,
    actor_name: actorName.value,
  })
  feedbackSaving.value = false
  if (!response.ok || !response.data) {
    errorMessage.value = response.error?.message ?? '桌读草稿保存失败'
    return
  }
  detail.value = response.data
  draft.note = ''
  draft.issue_id = ''
}

function feedbackKey(item: Stage6RevisionWorkspaceFeedbackItem) { return `${item.round_number}:${item.feedback_id}` }
function signed(value: number) { return value > 0 ? `+${value}` : String(value) }
function coverageIndex(category: string) { return ['structure', 'character_or_information', 'scene', 'dialogue_or_narration', 'pacing', 'fact_and_culture'].indexOf(category) + 1 }
function badgeLabel(badge: Stage6EvidenceBadge) { return ({ real_model_verified: '真实模型已核验', human_authored_verified: '人工创作已核验', simulation: 'SIMULATION', fixture: 'FIXTURE', prepared: '准备态', blocked: '外部阻断' } as const)[badge] }
function executionLabel(status: string) { return ({ blocked: '等待外部输入', awaiting_round_1: '等待 Round 1', round_1_completed: 'Round 1 已记录', two_rounds_completed: '两轮已记录' } as Record<string, string>)[status] ?? status }
function blockerLabel(code: string) {
  return ({
    operator_identity_missing: '操作人身份缺失',
    operator_contact_reference_missing: '操作人联系引用缺失',
    real_input_provenance_required: '缺少真实输入来源',
    real_project_id_missing: '真实项目 ID 缺失',
    initial_package_path_missing: '初始专业文本包缺失',
    creator_authorization_unverified: '创作者授权未核验',
    revision_budget_unverified: '修订预算未核验',
    anonymous_reviewer_not_allowed: '存在匿名评审者',
    reviewer_identity_unverified: '评审者身份未核验',
    table_read_schedule_unverified: '桌读排期未核验',
  } as Record<string, string>)[code] ?? code.replaceAll('_', ' ')
}
function videoTypeLabel(type: VideoType) { return ({ character_story: '人物故事', historical_drama: '历史剧情', legend_story: '传说故事', culture_promo: '文化宣传', heritage_promo: '非遗宣传', city_brand_promo: '城市品牌', scene_short: '场景短片', landscape_mood: '山水意境', documentary_short: '微纪录片', explainer_video: '知识讲解', lecture_video: '宣讲视频', education_training: '教育培训', children_story: '儿童故事', social_short: '社交短视频', ai_comic_drama: 'AI 漫剧' } as Record<VideoType, string>)[type] }
</script>

<style scoped>
.stage6-page { max-width: 1500px; margin: 0 auto; color: #172238; }
.hero { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; padding: 30px; border-radius: 22px; color: white; background: radial-gradient(circle at 84% 20%, rgba(82, 203, 184, .35), transparent 28%), linear-gradient(130deg, #101c34, #183b50 60%, #12645e); box-shadow: 0 20px 50px rgba(17, 38, 62, .18); }
.hero h2 { margin: 4px 0 8px; font-size: clamp(28px, 4vw, 44px); letter-spacing: -.03em; }.hero p { margin: 0; color: #cfe5e5; }.eyebrow { margin: 0; color: #31867c; font-weight: 800; font-size: 12px; letter-spacing: .13em; }.hero .eyebrow { color: #81d8ca; }
.refresh-button, .primary-button { border: 0; border-radius: 10px; padding: 10px 16px; color: white; background: #16766d; cursor: pointer; font-weight: 700; }.refresh-button { background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.28); white-space: nowrap; }
button:disabled { opacity: .45; cursor: not-allowed; }.truth-banner, .error-banner { margin-top: 16px; padding: 13px 16px; border-radius: 12px; display: flex; gap: 12px; align-items: center; }.truth-banner { background: #fff8df; border: 1px solid #ead58a; color: #6f5412; }.error-banner { background: #fff0ee; border: 1px solid #efb4ae; color: #9d2b21; }
.metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }.metrics-grid article { border: 1px solid #dce4e8; border-radius: 14px; padding: 15px 18px; background: white; display: flex; justify-content: space-between; align-items: center; }.metrics-grid span { color: #637080; }.metrics-grid strong { font-size: 26px; }.metric-zero strong { color: #a23a30; }
.workspace-grid { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 16px; align-items: start; }.project-rail, .detail-panel { background: #fff; border: 1px solid #dce4e8; border-radius: 18px; }.project-rail { padding: 14px; position: sticky; top: 16px; max-height: calc(100vh - 32px); overflow: auto; }.rail-title { display: flex; justify-content: space-between; align-items: center; }.rail-title h3 { margin: 4px 0 12px; }.rail-title span { color: #71808e; font-size: 13px; }.filter-field { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }.filter-field span { font-size: 12px; color: #71808e; }.filter-field select { flex: 1; }
.project-card { width: 100%; border: 1px solid transparent; border-radius: 12px; background: #f6f8f9; padding: 12px; text-align: left; display: grid; gap: 5px; margin: 7px 0; cursor: pointer; color: inherit; }.project-card:hover, .project-card.selected { border-color: #3a9589; background: #eef8f6; }.project-card__type { color: #247c72; font-size: 12px; font-weight: 800; }.project-card strong { font-size: 13px; line-height: 1.4; }.project-card__meta { color: #778491; font-size: 12px; }
.detail-panel { min-height: 720px; padding: 22px; }.empty-state { min-height: 500px; display: grid; place-items: center; color: #778491; }.detail-header { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; border-bottom: 1px solid #e4eaed; padding-bottom: 18px; }.detail-header h3 { font-size: 25px; margin: 4px 0; }.detail-header p { margin: 0; color: #71808e; }.header-badges { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }.professional-lock { padding: 6px 10px; border-radius: 999px; color: #9b352d; background: #ffefed; font-size: 12px; font-weight: 800; }
.evidence-badge { justify-self: start; display: inline-block; border-radius: 999px; padding: 4px 8px; font-size: 10px; font-weight: 900; letter-spacing: .03em; }.badge-blocked { color: #8a4b13; background: #fff0d7; }.badge-prepared { color: #53616f; background: #edf1f3; }.badge-simulation, .badge-fixture { color: #7e2e70; background: #faeafa; }.badge-real_model_verified, .badge-human_authored_verified { color: #146b52; background: #dff5ed; }
.blocker-box { margin: 16px 0; padding: 13px; border: 1px solid #eed7ae; border-radius: 12px; background: #fffaf0; }.blocker-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 9px; }.blocker-chips span, .issue-chip { padding: 4px 7px; border-radius: 7px; background: #f4e7ce; color: #6b5127; font-size: 11px; }
.detail-tabs { display: flex; gap: 6px; border-bottom: 1px solid #e4eaed; margin-top: 10px; overflow-x: auto; }.detail-tabs button { border: 0; border-bottom: 3px solid transparent; padding: 13px 15px 10px; background: none; color: #657382; cursor: pointer; white-space: nowrap; }.detail-tabs button.active { color: #136b63; border-color: #1b8b80; font-weight: 800; }.tab-section { padding-top: 20px; }.section-heading { display: flex; justify-content: space-between; align-items: end; margin-bottom: 14px; }.section-heading h4 { margin: 4px 0 0; font-size: 20px; }.section-heading > span { color: #7a8793; font-size: 12px; }
.coverage-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }.coverage-card { border: 1px solid #dde5e8; border-radius: 13px; padding: 14px; min-height: 155px; background: linear-gradient(145deg, #fff, #f8fafb); }.coverage-card > div { display: flex; gap: 9px; align-items: center; }.coverage-card h5 { margin: 0; font-size: 15px; }.coverage-index { width: 25px; height: 25px; border-radius: 8px; background: #dff2ef; color: #17776d; display: grid; place-items: center; font-weight: 900; }.coverage-card p, .coverage-card li { font-size: 12px; line-height: 1.55; }.muted { color: #8a959f !important; font-size: 13px; }
.version-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }.version-card { border: 1px solid #d9e3e6; border-radius: 14px; padding: 14px; min-width: 0; }.version-card.unavailable { border-style: dashed; background: #fafbfb; }.version-card__head { display: flex; justify-content: space-between; gap: 8px; }.version-card__head > div > span { color: #1b8076; font-weight: 900; font-size: 11px; }.version-card h5 { margin: 3px 0 12px; }.score-line { display: flex; align-items: baseline; gap: 7px; border-radius: 10px; background: #f2f7f7; padding: 10px; }.score-line strong { font-size: 26px; }.score-line span { color: #71808e; font-size: 11px; }.score-line b { margin-left: auto; font-size: 12px; }.dimension-list { margin: 10px 0; }.dimension-list > div { display: grid; grid-template-columns: 1fr auto auto; gap: 7px; padding: 5px 0; border-bottom: 1px solid #edf1f2; font-size: 11px; }.dimension-list em { color: #8a959f; font-style: normal; }.dimension-list em.positive { color: #14815d; }details summary { cursor: pointer; color: #1b746c; font-size: 12px; }pre { white-space: pre-wrap; max-height: 300px; overflow: auto; font-family: inherit; font-size: 12px; line-height: 1.7; }
.diff-card { border: 1px solid #dce4e8; border-radius: 13px; margin-bottom: 12px; overflow: hidden; }.diff-card header { display: flex; justify-content: space-between; padding: 11px 14px; background: #f4f7f8; }.diff-card > p { padding: 12px; }.diff-lines { max-height: 360px; overflow: auto; font: 12px/1.6 ui-monospace, monospace; }.diff-lines div { display: grid; grid-template-columns: 24px 1fr; padding: 3px 10px; white-space: pre-wrap; }.diff-added { background: #e8f7ed; color: #165c38; }.diff-removed { background: #fff0ef; color: #8f3028; }.diff-same { color: #75818b; }.derived-list { border-top: 1px solid #e5eaed; padding-top: 12px; }.derived-list article { display: grid; grid-template-columns: 90px 100px 1fr; gap: 10px; padding: 9px 0; }.rebuild-ok { color: #14745c; }.rebuild-fail { color: #a2342b; }
.operator-fields, .draft-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }.operator-fields { padding: 13px; background: #f4f8f8; border-radius: 12px; }.operator-fields label, .draft-grid label, .feedback-card label { display: grid; gap: 4px; }.operator-fields span, .draft-grid span, .feedback-card label span { color: #6f7c89; font-size: 11px; }input, select, textarea { border: 1px solid #ccd7db; border-radius: 8px; padding: 9px; background: white; color: inherit; font: inherit; }.draft-form { border: 1px solid #dbe5e7; border-radius: 14px; padding: 14px; margin: 12px 0; }.draft-form > div:first-child { display: flex; justify-content: space-between; margin-bottom: 10px; }.draft-form > div:first-child span { color: #a06319; font-size: 12px; }.draft-grid .wide { grid-column: 1 / -1; }.draft-form button { margin-top: 10px; }.draft-list article { display: grid; gap: 3px; padding: 10px; border-left: 3px solid #c7903d; background: #fff9ee; margin: 6px 0; }.draft-list span { color: #915f16; font-size: 10px; font-weight: 900; }.draft-list small { color: #7b8791; }
.feedback-card { border: 1px solid #dce4e8; border-radius: 13px; padding: 14px; margin: 10px 0; display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: end; }.feedback-card header, .feedback-card h5, .feedback-card p { grid-column: 1 / -1; margin: 0; }.feedback-card header { display: flex; justify-content: space-between; color: #667581; font-size: 12px; }.feedback-card button { border: 0; border-radius: 8px; padding: 9px 12px; cursor: pointer; }.feedback-open { color: #9a5c0e; }.feedback-closed { color: #18735d; }.danger-button { color: #a3342b; background: #ffedeb; }
@media (max-width: 1050px) { .workspace-grid { grid-template-columns: 1fr; }.project-rail { position: static; max-height: 340px; }.coverage-grid, .version-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 700px) { .hero, .detail-header, .section-heading { align-items: flex-start; flex-direction: column; }.metrics-grid { grid-template-columns: 1fr 1fr; }.coverage-grid, .version-grid, .operator-fields, .draft-grid { grid-template-columns: 1fr; }.detail-panel { padding: 14px; }.feedback-card { grid-template-columns: 1fr; }.draft-grid .wide { grid-column: auto; } }
</style>
