<template>
  <div class="project-detail-page">
    <div v-if="loading" class="project-detail-page__loading">
      <div class="project-detail-page__spinner" />
      <p>正在加载故事项目…</p>
    </div>

    <div v-else-if="error" class="project-detail-page__error">{{ error }}</div>

    <div v-else-if="detail">
      <header class="project-detail-page__header">
        <div>
          <p class="project-detail-page__eyebrow">故事项目</p>
          <h1 class="project-detail-page__title">{{ detail.project.title }}</h1>
          <p class="project-detail-page__meta">
            来源：{{ detail.project.source_entry }} · {{ typeLabel(detail.project.video_type) }} · {{ statusLabel(detail.project.status) }}
          </p>
        </div>
        <div class="project-detail-page__header-actions">
          <button class="project-detail-page__action-btn project-detail-page__action-btn--primary" @click="exportCurrentStoryMarkdown">
            导出 Markdown
          </button>
          <button class="project-detail-page__action-btn" @click="exportCurrentStoryJson">
            导出 JSON
          </button>
          <button
            class="project-detail-page__action-btn"
            :disabled="loadingProductionBoard"
            @click="loadProductionBoard"
          >
            {{ loadingProductionBoard ? '生成中…' : 'Production Board' }}
          </button>
          <button
            class="project-detail-page__action-btn project-detail-page__action-btn--danger"
            :disabled="deleting"
            @click="deleteCurrentProject"
          >
            {{ deleting ? '删除中…' : '删除项目' }}
          </button>
          <RouterLink class="project-detail-page__action-btn" to="/projects">返回项目列表</RouterLink>
          <RouterLink class="project-detail-page__action-btn" to="/story/new">继续生成</RouterLink>
        </div>
      </header>

      <section class="project-detail-page__summary">
        <div class="project-detail-page__summary-card">
          <span class="project-detail-page__summary-label">当前版本</span>
          <strong>{{ detail.project.current_version_id }}</strong>
        </div>
        <div class="project-detail-page__summary-card">
          <span class="project-detail-page__summary-label">更新时间</span>
          <strong>{{ formatDate(detail.project.updated_at) }}</strong>
        </div>
        <div class="project-detail-page__summary-card">
          <span class="project-detail-page__summary-label">版本数</span>
          <strong>{{ detail.project.version_count }}</strong>
        </div>
        <div class="project-detail-page__summary-card">
          <span class="project-detail-page__summary-label">待补资料</span>
          <strong>{{ detail.project.open_supplement_task_count ?? 0 }}</strong>
        </div>
      </section>

      <GearsWebhookStatus :status="detail.current_story.gears_webhook" />
      <GearsVideoStatus :video="detail.current_story.gears_video" />

      <section v-if="productionBoard" class="project-detail-page__production">
        <div class="project-detail-page__production-head">
          <div>
            <h2 class="project-detail-page__section-title">Production Board</h2>
            <p>
              交付 {{ productionBoard.delivery_manifest.stage_label }}
              · 可用 {{ productionBoard.delivery_manifest.ready_artifact_count }}/{{ productionBoard.delivery_manifest.artifacts.length }}
              ·
              QA {{ productionBoard.qa_report.passed ? '通过' : '需处理' }}
              · {{ productionBoard.qa_report.score }}/100
              · 监督 {{ productionBoard.supervision_report.passed ? '通过' : '需处理' }}
              · {{ productionBoard.supervision_report.score }}/100
              · 镜头 {{ productionBoard.shot_units.length }}
              · 角色资产 {{ productionBoard.character_assets.length }}
              · 场景资产 {{ productionBoard.location_assets.length }}
            </p>
          </div>
          <div class="project-detail-page__production-actions">
            <button
              class="project-detail-page__action-btn project-detail-page__action-btn--primary"
              :disabled="productionBoardRepairBusy"
              @click="submitProductionBoardRepair(true)"
            >
              {{ repairingProductionBoard ? '修复中…' : '执行生产修复' }}
            </button>
            <button
              class="project-detail-page__action-btn"
              :disabled="productionBoardRepairBusy"
              @click="submitProductionBoardRepair(false)"
            >
              修复 P0
            </button>
            <button
              class="project-detail-page__action-btn project-detail-page__action-btn--primary"
              :disabled="exportingProductionBoard"
              @click="saveProductionBoardPackage"
            >
              {{ exportingProductionBoard ? '落盘中…' : '一键落盘交付包' }}
            </button>
            <button class="project-detail-page__action-btn" @click="exportProductionBoardMarkdown">导出 Board Markdown</button>
            <button class="project-detail-page__action-btn" @click="exportProductionBoardJson">导出 Board JSON</button>
          </div>
        </div>
        <div
          class="project-detail-page__delivery-manifest"
          :class="`project-detail-page__delivery-manifest--${productionBoard.delivery_manifest.stage}`"
        >
          <div>
            <strong>{{ productionBoard.delivery_manifest.stage_label }}</strong>
            <p>{{ productionBoard.delivery_manifest.next_action }}</p>
          </div>
          <div class="project-detail-page__delivery-artifacts">
            <span
              v-for="artifact in productionBoard.delivery_manifest.artifacts"
              :key="artifact.artifact_id"
              :class="`project-detail-page__delivery-artifact--${artifact.status}`"
            >
              {{ artifact.label }}
            </span>
          </div>
        </div>
        <div v-if="productionBoardExport" class="project-detail-page__export-package">
          <div>
            <strong>交付包已写入项目目录</strong>
            <p>{{ productionBoardExport.export_dir }}</p>
          </div>
          <div class="project-detail-page__export-files">
            <span v-for="file in productionBoardExport.files" :key="file.file_id">
              {{ file.label }} · {{ file.relative_path }}
            </span>
          </div>
        </div>
        <div v-if="productionRepairTrace" class="project-detail-page__production-repair-result">
          <strong>{{ productionRepairTrace.applied ? '生产修复已生成新版本' : '生产修复未产生变化' }}</strong>
          <p>{{ productionRepairTrace.note }}</p>
          <span class="project-detail-page__production-repair-summary">
            {{ productionRepairTrace.applied_task_ids.length }} 个任务已应用
            · 阻断 {{ productionRepairTrace.before_blockers }} → {{ productionRepairTrace.after_blockers }}
            · {{ productionRepairTrace.before_stage }} → {{ productionRepairTrace.after_stage }}
          </span>
          <div v-if="productionRepairDiffRows.length" class="project-detail-page__production-repair-diff">
            <article
              v-for="row in productionRepairDiffRows"
              :key="row.label"
              :class="row.changed ? 'project-detail-page__production-repair-diff-item--changed' : ''"
            >
              <span>{{ row.label }}</span>
              <strong>{{ row.before }} → {{ row.after }}</strong>
            </article>
          </div>
          <p v-if="productionRepairChangedSceneText" class="project-detail-page__production-repair-scenes">
            变更场景：{{ productionRepairChangedSceneText }}
          </p>
        </div>
        <div class="project-detail-page__production-grid">
          <article>
            <strong>角色资产</strong>
            <p>{{ productionBoard.character_assets.map(asset => `${asset.name}：${asset.clothing}`).join('；') || '无' }}</p>
          </article>
          <article>
            <strong>场景资产</strong>
            <p>{{ productionBoard.location_assets.map(asset => `${asset.name}：${asset.atmosphere}`).join('；') || '无' }}</p>
          </article>
          <article>
            <strong>道具资产</strong>
            <p>{{ productionBoard.prop_assets.map(asset => `${asset.label}（场景 ${asset.source_scene_ids.join('、')}）`).join('；') || '未自动识别' }}</p>
          </article>
          <article>
            <strong>监督问题</strong>
            <p>
              {{ productionBoard.supervision_report.blockers }} 个阻断
              · {{ productionBoard.supervision_report.warnings }} 个警告
              · {{ productionBoard.supervision_report.issue_count }} 个总问题
            </p>
          </article>
        </div>
        <div v-if="productionBoard.supervision_report.issues.length" class="project-detail-page__supervision">
          <div class="project-detail-page__supervision-head">
            <strong>Supervision Agent</strong>
            <span>优先修复 {{ productionBoard.supervision_report.priority_fixes.length }}</span>
          </div>
          <div class="project-detail-page__supervision-list">
            <article
              v-for="issue in productionBoard.supervision_report.issues.slice(0, 6)"
              :key="issue.issue_id"
              :class="['project-detail-page__supervision-issue', `project-detail-page__supervision-issue--${issue.severity}`]"
            >
              <div>
                <span>{{ severityLabel(issue.severity) }}</span>
                <span>{{ categoryLabel(issue.category) }}</span>
                <span v-if="issue.source_shot_id">{{ issue.source_shot_id }}</span>
              </div>
              <strong>{{ issue.title }}</strong>
              <p>{{ issue.detail }}</p>
              <small>{{ issue.fix_hint }}</small>
            </article>
          </div>
        </div>
        <div v-if="productionBoard.repair_plan.tasks.length" class="project-detail-page__repair-plan">
          <div class="project-detail-page__supervision-head">
            <strong>生产修复包</strong>
            <span>{{ productionBoard.repair_plan.blocker_task_count }} 个 P0 · {{ productionBoard.repair_plan.task_count }} 个任务</span>
          </div>
          <div class="project-detail-page__repair-plan-list">
            <article
              v-for="task in productionBoard.repair_plan.tasks.slice(0, 5)"
              :key="task.task_id"
              class="project-detail-page__repair-task"
            >
              <div>
                <span>{{ task.priority }}</span>
                <span>{{ repairActionLabel(task.action) }}</span>
                <span v-if="task.target_shot_ids.length">{{ task.target_shot_ids.join('、') }}</span>
              </div>
              <strong>{{ task.title }}</strong>
              <p>{{ task.instruction }}</p>
              <small>{{ task.expected_output }}</small>
              <div class="project-detail-page__repair-task-actions">
                <button
                  class="project-detail-page__repair-task-btn"
                  :disabled="productionBoardRepairBusy"
                  @click="submitProductionBoardTaskRepair(task)"
                >
                  {{ repairingProductionBoardTaskId === task.task_id ? '修复中…' : '修复此项' }}
                </button>
              </div>
            </article>
          </div>
        </div>
        <div class="project-detail-page__shot-list">
          <article v-for="shot in productionBoard.shot_units.slice(0, 6)" :key="shot.shot_id" class="project-detail-page__shot">
            <div>
              <strong>{{ shot.shot_id }} · 场景 {{ shot.source_scene_id }}</strong>
              <span>{{ shot.duration_sec }} 秒 · Seedance {{ shot.seedance_duration_sec }} 秒 · {{ shot.panel_count }} 格 · {{ shot.location }}</span>
            </div>
            <p>{{ shot.production_prompt }}</p>
            <details class="project-detail-page__seedance-prompt">
              <summary>Seedance 提示词</summary>
              <pre>{{ shot.seedance_prompt }}</pre>
              <small v-if="shot.seedance_validation_notes.length">{{ shot.seedance_validation_notes.join('；') }}</small>
            </details>
            <small v-if="shot.qa_flags.length > 0">{{ shot.qa_flags.join('；') }}</small>
          </article>
        </div>
      </section>

      <section v-if="currentQuality" class="project-detail-page__quality-tools">
        <div class="project-detail-page__quality-main">
          <div>
            <h2 class="project-detail-page__section-title">当前版本质量</h2>
            <p>
              {{ currentQuality.passed ? '通过' : '需调整' }}
              <template v-if="typeof currentQuality.genre_score === 'number'"> · 类型分 {{ currentQuality.genre_score }}/100</template>
              · 问题 {{ currentQuality.issues.length }}
            </p>
          </div>
          <div class="project-detail-page__quality-mini">
            <span>缺少要素 {{ currentQuality.missing_required_elements?.length ?? 0 }}</span>
            <span>节拍问题 {{ currentQuality.weak_beats?.length ?? 0 }}</span>
            <span>关联场景 {{ qualitySceneIds.length }}</span>
          </div>
          <ul v-if="currentQuality.issues.length > 0" class="project-detail-page__quality-list">
            <li v-for="issue in currentQuality.issues.slice(0, 4)" :key="issue">{{ issue }}</li>
          </ul>
          <div v-if="qualityReportCards.length > 0" class="project-detail-page__report-strip">
            <article
              v-for="card in qualityReportCards"
              :key="card.key"
              :class="['project-detail-page__report-pill', card.score >= 70 ? 'project-detail-page__report-pill--pass' : 'project-detail-page__report-pill--warn']"
            >
              <span>{{ card.label }}</span>
              <strong>{{ card.score }}/100</strong>
              <p>{{ card.preview }}</p>
            </article>
          </div>
          <div v-if="currentQuality.repair_action_items?.length" class="project-detail-page__repair-actions">
            <button
              v-for="action in currentQuality.repair_action_items"
              :key="action.action_id"
              class="project-detail-page__repair-btn"
              :class="action.target_report === 'combined' ? 'project-detail-page__repair-btn--primary' : ''"
              :disabled="repairingQuality"
              type="button"
              @click="submitQualityRepair(action)"
            >
              <span>{{ action.label }}</span>
              <small>{{ action.expected_effect }}</small>
            </button>
          </div>
        </div>
        <button
          class="project-detail-page__action-btn"
          :disabled="qualitySceneIds.length === 0"
          @click="showQualityScenesOnly = !showQualityScenesOnly"
        >
          {{ showQualityScenesOnly ? '显示全部场景' : '仅看质量问题场景' }}
        </button>
        <button
          class="project-detail-page__action-btn project-detail-page__action-btn--primary"
          :disabled="repairingQuality || !currentQuality.repair_action_items?.length"
          @click="submitQualityRepair()"
        >
          {{ repairingQuality ? '正在修复…' : '一键修复' }}
        </button>
      </section>

      <section class="project-detail-page__editor">
        <div class="project-detail-page__editor-header">
          <div>
            <h2 class="project-detail-page__editor-title">局部重写</h2>
            <p class="project-detail-page__editor-desc">先在下方场景卡片里选择“重写这一场”，再提交局部修改要求。</p>
          </div>
          <span v-if="successMessage" class="project-detail-page__success">{{ successMessage }}</span>
        </div>

        <div v-if="selectedSceneId" class="project-detail-page__editor-form">
          <div class="project-detail-page__editor-row">
            <div class="project-detail-page__editor-chip">场景 {{ selectedSceneId }}</div>
            <select v-model="selectedIntent" class="project-detail-page__select">
              <option value="tighten_conflict">强化冲突</option>
              <option value="rewrite_narration">重写旁白</option>
              <option value="shift_emotion">调整情绪</option>
              <option value="clarify_visuals">强化画面</option>
              <option value="custom">自定义修改</option>
            </select>
          </div>
          <div class="project-detail-page__editor-row">
            <select v-model="selectedModelProfileId" class="project-detail-page__select">
              <option v-for="profile in modelProfiles" :key="profile.id" :value="profile.id">
                {{ profile.label }}{{ profile.recommended ? '（推荐）' : '' }}
              </option>
            </select>
          </div>
          <p v-if="selectedModelProfile" class="project-detail-page__model-hint">{{ selectedModelProfile.description }}</p>
          <textarea
            v-model="userNote"
            class="project-detail-page__textarea"
            placeholder="补充你想修改的重点，例如：把这场写得更克制，突出人物犹豫和桌上的文书细节。"
          />
          <div class="project-detail-page__editor-actions">
            <button
              class="project-detail-page__action-btn project-detail-page__action-btn--primary"
              :disabled="submitting"
              @click="submitSceneRewrite"
            >
              {{ submitting ? '正在重写…' : '提交局部重写' }}
            </button>
            <button class="project-detail-page__action-btn" :disabled="submitting" @click="clearEditor">取消</button>
          </div>
        </div>

        <div v-else class="project-detail-page__editor-empty">
          从下方场景中选择要重写的一场。
        </div>
      </section>

      <section class="project-detail-page__versions">
        <h2 class="project-detail-page__section-title">版本记录</h2>
        <div class="project-detail-page__version-list">
          <div v-for="version in detail.versions" :key="version.version_id" class="project-detail-page__version-card">
            <strong>{{ version.version_id }}</strong>
            <span>{{ formatDate(version.created_at) }}</span>
            <span>{{ versionLabel(version.change_type) }}</span>
            <span v-if="version.scene_ids_changed.length > 0">场景 {{ version.scene_ids_changed.join(', ') }}</span>
            <span
              v-if="typeof version.genre_score === 'number'"
              :class="['project-detail-page__version-quality', version.quality_passed ? 'project-detail-page__version-quality--pass' : 'project-detail-page__version-quality--warn']"
            >
              类型分 {{ version.genre_score }}
            </span>
            <span v-if="(version.quality_issue_count ?? 0) > 0" class="project-detail-page__version-warning">
              质量问题 {{ version.quality_issue_count }}
            </span>
            <span v-if="version.note">{{ version.note }}</span>
          </div>
        </div>
      </section>

      <StoryResult
        :result="detail.current_story"
        :editable-project="true"
        :show-gears-webhook-status="false"
        :show-gears-video-status="false"
        :regenerating-scene-id="submitting ? selectedSceneId : null"
        :updating-supplement-task-id="updatingSupplementTaskId"
        :scene-filter-ids="showQualityScenesOnly ? qualitySceneIds : undefined"
        @rewrite-scene="openSceneEditor"
        @update-supplement-task="handleSupplementTaskUpdate"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  deleteProject,
  exportProjectCurrentVersion,
  exportProjectProductionBoard,
  getProject,
  getProjectProductionBoard,
  repairProjectQuality,
  repairProjectProductionBoard,
  regenerateProjectScene,
  updateProjectSupplementTask,
} from '@/api/projects'
import { getModelProfiles } from '@/api/system'
import StoryResult from '@/components/StoryResult.vue'
import GearsWebhookStatus from '@/components/GearsWebhookStatus.vue'
import GearsVideoStatus from '@/components/GearsVideoStatus.vue'
import type {
  AIModelProfile,
  KnowledgeSupplementTaskStatus,
  StoryProjectDetail,
  StoryProjectStatus,
  StoryProjectVersionChangeType,
  StoryProductionBoard,
  StoryProductionBoardExportPackage,
  StoryProductionBoardRepairResult,
  StoryProductionBoardRepairTask,
  StoryProductionBoardRepairTrace,
  QualityRepairAction,
} from '@shared/types'

const route = useRoute()
const router = useRouter()
const MODEL_PROFILE_STORAGE_KEY = 'story-agent.model-profile-id'

const detail = ref<StoryProjectDetail | null>(null)
const loading = ref(false)
const error = ref('')
const modelProfiles = ref<AIModelProfile[]>([])
const selectedModelProfileId = ref('')
const selectedSceneId = ref<number | null>(null)
const selectedIntent = ref<'tighten_conflict' | 'rewrite_narration' | 'shift_emotion' | 'clarify_visuals' | 'custom'>('tighten_conflict')
const userNote = ref('')
const submitting = ref(false)
const repairingQuality = ref(false)
const deleting = ref(false)
const updatingSupplementTaskId = ref('')
const successMessage = ref('')
const showQualityScenesOnly = ref(false)
const productionBoard = ref<StoryProductionBoard | null>(null)
const productionBoardExport = ref<StoryProductionBoardExportPackage | null>(null)
const productionRepairResult = ref<StoryProductionBoardRepairResult | null>(null)
const productionRepairTrace = ref<StoryProductionBoardRepairTrace | null>(null)
const loadingProductionBoard = ref(false)
const exportingProductionBoard = ref(false)
const repairingProductionBoard = ref(false)
const repairingProductionBoardTaskId = ref('')

const selectedModelProfile = computed(() => {
  return modelProfiles.value.find(profile => profile.id === selectedModelProfileId.value) ?? null
})

const currentQuality = computed(() => detail.value?.current_story.quality_report ?? null)

const qualityReportCards = computed(() => {
  const quality = currentQuality.value
  if (!quality) return []
  const cards: Array<{ key: string; label: string; score: number; preview: string }> = []
  if (quality.outline_coverage_report) {
    cards.push({
      key: 'outline',
      label: 'Outline Coverage',
      score: quality.outline_coverage_report.coverage_score,
      preview: quality.outline_coverage_report.preview,
    })
  }
  if (quality.pattern_quality_report) {
    cards.push({
      key: 'pattern',
      label: 'Pattern Quality',
      score: quality.pattern_quality_report.pattern_score,
      preview: quality.pattern_quality_report.preview,
    })
  }
  if (quality.gears_readiness_report) {
    cards.push({
      key: 'gears',
      label: 'GEARS Readiness',
      score: quality.gears_readiness_report.readiness_score,
      preview: quality.gears_readiness_report.preview,
    })
  }
  return cards
})

const qualitySceneIds = computed(() => {
  const story = detail.value?.current_story
  const ids = new Set<number>()
  for (const action of story?.quality_report?.repair_action_items ?? []) {
    for (const sceneId of action.scene_ids) ids.add(sceneId)
  }
  if (ids.size === 0 && story?.quality_report?.weak_beats?.length && story.story_blueprint?.genre_beats.length) {
    for (const weakBeat of story.quality_report.weak_beats) {
      const order = Number(weakBeat.match(/^(\d+)\./)?.[1])
      if (!Number.isFinite(order)) continue
      const beat = story.story_blueprint.genre_beats.find(item => item.order === order)
      if (beat?.scene_id) ids.add(beat.scene_id)
    }
  }
  return [...ids].sort((a, b) => a - b)
})

const productionBoardRepairBusy = computed(() => {
  return repairingProductionBoard.value || repairingProductionBoardTaskId.value !== ''
})

const productionRepairDiffRows = computed(() => {
  const result = productionRepairResult.value
  if (!result) return []

  const rows = [
    {
      label: '交付阶段',
      before: result.before_board.delivery_manifest.stage_label,
      after: result.after_board.delivery_manifest.stage_label,
    },
    {
      label: '阻断项',
      before: `${result.before_board.supervision_report.blockers} 个`,
      after: `${result.after_board.supervision_report.blockers} 个`,
    },
    {
      label: '监督分',
      before: `${result.before_board.supervision_report.score}/100`,
      after: `${result.after_board.supervision_report.score}/100`,
    },
    {
      label: 'QA 分',
      before: `${result.before_board.qa_report.score}/100`,
      after: `${result.after_board.qa_report.score}/100`,
    },
    {
      label: '修复任务',
      before: `${result.before_board.repair_plan.task_count} 个`,
      after: `${result.after_board.repair_plan.task_count} 个`,
    },
  ]

  return rows.map(row => ({
    ...row,
    changed: row.before !== row.after,
  }))
})

const productionRepairChangedSceneText = computed(() => {
  const ids = productionRepairTrace.value?.changed_scene_ids ?? []
  return ids.length ? ids.map(sceneId => `场景 ${sceneId}`).join('、') : ''
})

function statusLabel(status: StoryProjectStatus): string {
  const map: Record<StoryProjectStatus, string> = {
    draft: '草稿',
    edited: '已编辑',
    exported: '已导出',
    finalized: '已定稿',
  }
  return map[status]
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    character_story: '人物故事',
    culture_promo: '文化宣传',
    scene_short: '场景短片',
    historical_drama: '历史剧情',
    legend_story: '传说故事',
    heritage_promo: '非遗宣传',
    city_brand_promo: '城市文旅',
    documentary_short: '微纪录',
    explainer_video: '知识讲解',
    lecture_video: '宣讲片',
    education_training: '教育培训',
    children_story: '儿童故事',
    social_short: '竖屏短视频',
    ai_comic_drama: 'AI漫剧',
    landscape_mood: '山水意境',
  }
  return map[type] ?? type
}

function severityLabel(severity: string): string {
  const map: Record<string, string> = {
    blocker: '阻断',
    warn: '警告',
    info: '提示',
  }
  return map[severity] ?? severity
}

function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    asset: '资产',
    prompt: '提示词',
    filmability: '可拍性',
    continuity: '连续性',
    period: '时代',
    duration: '时长',
  }
  return map[category] ?? category
}

function repairActionLabel(action: string): string {
  const map: Record<string, string> = {
    normalize_period_costumes: '服饰校准',
    register_asset: '资产补齐',
    clean_prompt: '提示清理',
    strengthen_filmability: '可拍性',
    add_continuity: '连续性',
    split_duration: '时长拆分',
  }
  return map[action] ?? action
}

function versionLabel(type: StoryProjectVersionChangeType): string {
  if (type === 'initial_generation') return '初次生成'
  if (type === 'quality_repair') return '质量修复'
  if (type === 'production_board_repair') return '生产修复'
  return '局部重写'
}

function formatDate(iso: string): string {
  if (!iso) return '未记录'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function loadProject(projectId: string) {
  if (!projectId) return
  loading.value = true
  error.value = ''
  const res = await getProject(projectId)
  if (res.ok && res.data) {
    detail.value = res.data
    productionBoard.value = null
    productionBoardExport.value = null
    productionRepairResult.value = null
    productionRepairTrace.value = null
    showQualityScenesOnly.value = false
    if (!selectedModelProfileId.value && res.data.current_story.model_profile_id) {
      selectedModelProfileId.value = res.data.current_story.model_profile_id
    }
  } else {
    error.value = res.error?.message ?? '加载故事项目失败'
  }
  loading.value = false
}

async function loadProductionBoard() {
  if (!detail.value) return
  loadingProductionBoard.value = true
  error.value = ''
  successMessage.value = ''
  const res = await getProjectProductionBoard(detail.value.project.project_id)
  if (res.ok && res.data) {
    productionBoard.value = res.data
    productionBoardExport.value = null
    productionRepairResult.value = null
    productionRepairTrace.value = null
    successMessage.value = `Production Board 已生成：${res.data.shot_units.length} 个镜头单元`
  } else {
    error.value = res.error?.message ?? '生成 Production Board 失败'
  }
  loadingProductionBoard.value = false
}

function openSceneEditor(sceneId: number) {
  selectedSceneId.value = sceneId
  successMessage.value = ''
}

function clearEditor() {
  selectedSceneId.value = null
  userNote.value = ''
  selectedIntent.value = 'tighten_conflict'
}

async function submitSceneRewrite() {
  if (!detail.value || !selectedSceneId.value) return
  submitting.value = true
  successMessage.value = ''

  const res = await regenerateProjectScene(detail.value.project.project_id, {
    scene_id: selectedSceneId.value,
    intent: selectedIntent.value,
    user_note: userNote.value.trim() || undefined,
    model_profile_id: selectedModelProfileId.value || undefined,
  })

  if (res.ok && res.data) {
    detail.value = res.data
    productionBoard.value = null
    productionBoardExport.value = null
    productionRepairResult.value = null
    productionRepairTrace.value = null
    const quality = res.data.current_story.quality_report
    const qualityTail = quality
      ? `，已重新复核：${quality.passed ? '通过' : '需调整'}${typeof quality.genre_score === 'number' ? `，类型分 ${quality.genre_score}` : ''}`
      : ''
    successMessage.value = `场景 ${selectedSceneId.value} 已生成新版本${qualityTail}`
    clearEditor()
  } else {
    error.value = res.error?.message ?? '局部重写失败'
  }
  submitting.value = false
}

async function submitQualityRepair(action?: QualityRepairAction) {
  if (!detail.value) return
  repairingQuality.value = true
  error.value = ''
  successMessage.value = ''
  const res = await repairProjectQuality(detail.value.project.project_id, {
    model_profile_id: selectedModelProfileId.value || undefined,
    genre_strictness: 'balanced',
    target_report: action?.target_report,
    repair_action_id: action?.action_id,
  })
  if (res.ok && res.data) {
    detail.value = res.data
    productionBoard.value = null
    productionBoardExport.value = null
    productionRepairResult.value = null
    productionRepairTrace.value = null
    const trace = res.data.current_story.repair_trace?.[res.data.current_story.repair_trace.length - 1]
    const quality = res.data.current_story.quality_report
    const scoreTail = quality && typeof quality.genre_score === 'number' ? `，类型分 ${quality.genre_score}` : ''
    const actionLabel = action ? `「${action.label}」` : '质量修复'
    successMessage.value = trace?.applied
      ? `已生成${actionLabel}版本${scoreTail}`
      : `已记录${actionLabel}尝试：${trace?.reason ?? '未应用'}${scoreTail}`
  } else {
    error.value = res.error?.message ?? '一键修复失败'
  }
  repairingQuality.value = false
}

async function handleSupplementTaskUpdate(taskId: string, status: KnowledgeSupplementTaskStatus, supplementNote?: string) {
  if (!detail.value) return
  updatingSupplementTaskId.value = taskId
  error.value = ''
  successMessage.value = ''
  const body = supplementNote ? { status, supplement_note: supplementNote } : { status }
  const res = await updateProjectSupplementTask(detail.value.project.project_id, taskId, body)
  if (res.ok && res.data) {
    detail.value = res.data
    successMessage.value = status === 'resolved' ? '资料补充任务已标记完成' : '资料补充任务已重新打开'
  } else {
    error.value = res.error?.message ?? '更新资料补充任务失败'
  }
  updatingSupplementTaskId.value = ''
}

async function exportCurrentStoryJson() {
  if (!detail.value) return
  const res = await exportProjectCurrentVersion(detail.value.project.project_id)
  if (!res.ok || !res.data) {
    error.value = res.error?.message ?? '导出 JSON 失败'
    return
  }
  detail.value = {
    ...detail.value,
    project: res.data.project,
  }
  downloadText(
    `${res.data.project.project_id}-${res.data.project.current_version_id}.json`,
    JSON.stringify(res.data, null, 2),
    'application/json;charset=utf-8',
  )
  successMessage.value = '当前版本 JSON 已导出到本地'
}

async function exportCurrentStoryMarkdown() {
  if (!detail.value) return
  const res = await exportProjectCurrentVersion(detail.value.project.project_id)
  if (!res.ok || !res.data) {
    error.value = res.error?.message ?? '导出 Markdown 失败'
    return
  }
  detail.value = {
    ...detail.value,
    project: res.data.project,
  }
  downloadText(
    `${res.data.project.project_id}-${res.data.project.current_version_id}.md`,
    res.data.markdown,
    'text/markdown;charset=utf-8',
  )
  successMessage.value = '当前版本 Markdown 已导出到本地'
}

async function exportProductionBoardJson() {
  if (!productionBoard.value) await loadProductionBoard()
  if (!productionBoard.value) return
  downloadText(
    `${productionBoard.value.project_id ?? productionBoard.value.storyId}-production-board.json`,
    JSON.stringify(productionBoard.value, null, 2),
    'application/json;charset=utf-8',
  )
  successMessage.value = 'Production Board JSON 已导出到本地'
}

async function exportProductionBoardMarkdown() {
  if (!productionBoard.value) await loadProductionBoard()
  if (!productionBoard.value) return
  downloadText(
    `${productionBoard.value.project_id ?? productionBoard.value.storyId}-production-board.md`,
    productionBoard.value.markdown,
    'text/markdown;charset=utf-8',
  )
  successMessage.value = 'Production Board Markdown 已导出到本地'
}

async function saveProductionBoardPackage() {
  if (!detail.value) return
  exportingProductionBoard.value = true
  error.value = ''
  successMessage.value = ''
  const res = await exportProjectProductionBoard(detail.value.project.project_id)
  if (res.ok && res.data) {
    productionBoardExport.value = res.data
    productionBoard.value = res.data.board
    detail.value = {
      ...detail.value,
      project: {
        ...detail.value.project,
        status: detail.value.project.status === 'finalized' ? 'finalized' : 'exported',
        updated_at: res.data.exported_at,
      },
    }
    successMessage.value = `Production Board 交付包已落盘：${res.data.files.length} 个文件`
  } else {
    error.value = res.error?.message ?? 'Production Board 交付包落盘失败'
  }
  exportingProductionBoard.value = false
}

async function submitProductionBoardRepair(applyAll: boolean) {
  if (!detail.value) return
  if (productionBoardRepairBusy.value) return
  repairingProductionBoard.value = true
  error.value = ''
  successMessage.value = ''
  const res = await repairProjectProductionBoard(detail.value.project.project_id, applyAll
    ? { apply_all: true }
    : { priorities: ['P0'] })
  if (res.ok && res.data) {
    detail.value = res.data.detail
    productionBoard.value = res.data.after_board
    productionBoardExport.value = null
    productionRepairResult.value = res.data
    productionRepairTrace.value = res.data.trace
    successMessage.value = res.data.trace.applied
      ? `生产修复已生成新版本：${res.data.trace.applied_task_ids.length} 个任务`
      : `生产修复未产生变化：${res.data.trace.reason}`
  } else {
    error.value = res.error?.message ?? '生产修复失败'
  }
  repairingProductionBoard.value = false
}

async function submitProductionBoardTaskRepair(task: StoryProductionBoardRepairTask) {
  if (!detail.value) return
  if (productionBoardRepairBusy.value) return
  repairingProductionBoardTaskId.value = task.task_id
  error.value = ''
  successMessage.value = ''
  const res = await repairProjectProductionBoard(detail.value.project.project_id, {
    task_ids: [task.task_id],
  })
  if (res.ok && res.data) {
    detail.value = res.data.detail
    productionBoard.value = res.data.after_board
    productionBoardExport.value = null
    productionRepairResult.value = res.data
    productionRepairTrace.value = res.data.trace
    successMessage.value = res.data.trace.applied
      ? `已修复「${task.title}」并生成新版本`
      : `「${task.title}」未产生变化：${res.data.trace.reason}`
  } else {
    error.value = res.error?.message ?? '单项生产修复失败'
  }
  repairingProductionBoardTaskId.value = ''
}

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function deleteCurrentProject() {
  if (!detail.value) return
  const confirmed = window.confirm(`确定删除《${detail.value.project.title}》吗？这会删除生成故事文件和项目版本记录。`)
  if (!confirmed) return

  deleting.value = true
  error.value = ''
  const res = await deleteProject(detail.value.project.project_id)
  if (res.ok) {
    await router.push('/projects')
  } else {
    error.value = res.error?.message ?? '删除故事项目失败'
  }
  deleting.value = false
}

onMounted(() => {
  getModelProfiles().then((res) => {
    if (res.ok && res.data && res.data.length > 0) {
      modelProfiles.value = res.data
      const storedModelId = localStorage.getItem(MODEL_PROFILE_STORAGE_KEY)
      const initialModel = res.data.find(profile => profile.id === storedModelId)
        ?? res.data.find(profile => profile.recommended)
        ?? res.data[0]
      if (!selectedModelProfileId.value) {
        selectedModelProfileId.value = initialModel.id
      }
    }
  })

  const projectId = route.params.projectId as string | undefined
  if (projectId) loadProject(projectId)
})

watch(selectedModelProfileId, (value) => {
  if (value) {
    localStorage.setItem(MODEL_PROFILE_STORAGE_KEY, value)
  }
})
</script>

<style scoped>
.project-detail-page {
  max-width: 980px;
  margin: 0 auto;
}

.project-detail-page__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: #7f8c8d;
}

.project-detail-page__spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #ecf0f1;
  border-top: 3px solid #2980b9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.project-detail-page__error {
  padding: 10px 14px;
  background: #fdecea;
  color: #c0392b;
  border-radius: 4px;
  font-size: 14px;
}

.project-detail-page__header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.project-detail-page__eyebrow {
  margin: 0 0 6px 0;
  color: #8a5a18;
  font-size: 12px;
  font-weight: 700;
}

.project-detail-page__title {
  margin: 0 0 8px 0;
  font-size: 30px;
  color: #22313f;
}

.project-detail-page__meta {
  margin: 0;
  color: #647380;
  line-height: 1.6;
}

.project-detail-page__header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.project-detail-page__action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 14px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #fff;
  color: #2f4358;
  text-decoration: none;
  cursor: pointer;
  font-size: 14px;
}

.project-detail-page__action-btn--primary {
  background: #2980b9;
  border-color: #2980b9;
  color: #fff;
}

.project-detail-page__action-btn--danger {
  border-color: #f0c4bd;
  color: #b13b2e;
}

.project-detail-page__action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.project-detail-page__summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.project-detail-page__summary-card,
.project-detail-page__editor,
.project-detail-page__versions {
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  background: #fff;
}

.project-detail-page__summary-card {
  padding: 14px 16px;
}

.project-detail-page__quality-tools {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 18px;
  padding: 12px 14px;
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  background: #f8fafb;
}

.project-detail-page__production {
  margin-bottom: 18px;
  padding: 12px 14px;
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  background: #f8fafb;
}

.project-detail-page__production-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.project-detail-page__production-head p {
  margin: 5px 0 0;
  color: #647380;
  font-size: 14px;
}

.project-detail-page__production-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.project-detail-page__delivery-manifest {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid #d7dee5;
  border-left-width: 4px;
  border-radius: 6px;
  background: #fff;
}

.project-detail-page__delivery-manifest--ready {
  border-left-color: #1b7f4a;
}

.project-detail-page__delivery-manifest--needs_repair {
  border-left-color: #d68910;
}

.project-detail-page__delivery-manifest--blocked {
  border-left-color: #c0392b;
}

.project-detail-page__delivery-manifest strong {
  color: #22313f;
}

.project-detail-page__delivery-manifest p {
  margin: 4px 0 0;
  color: #526575;
  font-size: 13px;
  line-height: 1.45;
}

.project-detail-page__delivery-artifacts {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.project-detail-page__delivery-artifacts span {
  border: 1px solid #d7dee5;
  border-radius: 4px;
  padding: 3px 6px;
  background: #f8fafb;
  color: #455866;
  font-size: 11px;
  font-weight: 700;
}

.project-detail-page__delivery-artifact--ready {
  border-color: #b8dbc8 !important;
  color: #1b7f4a !important;
}

.project-detail-page__delivery-artifact--needs_repair {
  border-color: #efcf8a !important;
  color: #9a6300 !important;
}

.project-detail-page__delivery-artifact--blocked {
  border-color: #f0c4bd !important;
  color: #b13b2e !important;
}

.project-detail-page__export-package {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid #c9d8e5;
  border-radius: 6px;
  background: #f4f9fc;
}

.project-detail-page__export-package strong {
  color: #22313f;
}

.project-detail-page__export-package p {
  margin: 4px 0 0;
  color: #526575;
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.project-detail-page__export-files {
  display: flex;
  max-width: 420px;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.project-detail-page__export-files span {
  border: 1px solid #d7dee5;
  border-radius: 4px;
  padding: 3px 6px;
  background: #fff;
  color: #455866;
  font-size: 11px;
  font-weight: 700;
}

.project-detail-page__production-repair-result {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid #c8dfd2;
  border-left: 4px solid #1b7f4a;
  border-radius: 6px;
  background: #f5fbf7;
}

.project-detail-page__production-repair-result strong {
  color: #22313f;
}

.project-detail-page__production-repair-result p {
  margin: 4px 0;
  color: #526575;
  font-size: 13px;
  line-height: 1.45;
}

.project-detail-page__production-repair-summary {
  display: block;
  color: #1b7f4a;
  font-size: 12px;
  font-weight: 700;
}

.project-detail-page__production-repair-diff {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
  margin-top: 10px;
}

.project-detail-page__production-repair-diff article {
  min-width: 0;
  border: 1px solid #d6e5dc;
  border-radius: 4px;
  background: #fff;
  padding: 7px 8px;
}

.project-detail-page__production-repair-diff-item--changed {
  border-color: #9ecfb4 !important;
  background: #f3fbf6 !important;
}

.project-detail-page__production-repair-diff span {
  display: block;
  color: #63756d;
  font-size: 11px;
  font-weight: 700;
}

.project-detail-page__production-repair-diff strong {
  display: block;
  margin-top: 3px;
  color: #22313f;
  font-size: 12px;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.project-detail-page__production-repair-scenes {
  margin-top: 8px !important;
  color: #526575 !important;
  font-size: 12px !important;
}

.project-detail-page__production-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.project-detail-page__production-grid article,
.project-detail-page__shot {
  border: 1px solid #d9e2ea;
  border-radius: 6px;
  background: #fff;
  padding: 10px 12px;
}

.project-detail-page__production-grid strong,
.project-detail-page__shot strong {
  color: #22313f;
}

.project-detail-page__production-grid p,
.project-detail-page__shot p {
  margin: 6px 0 0;
  color: #455866;
  font-size: 13px;
  line-height: 1.5;
}

.project-detail-page__shot-list {
  display: grid;
  gap: 8px;
}

.project-detail-page__supervision {
  margin-bottom: 12px;
  border: 1px solid #d9e2ea;
  border-radius: 6px;
  background: #fff;
  padding: 10px 12px;
}

.project-detail-page__repair-plan {
  margin-bottom: 12px;
  border: 1px solid #d9e2ea;
  border-radius: 6px;
  background: #f8fafb;
  padding: 10px 12px;
}

.project-detail-page__supervision-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.project-detail-page__supervision-head strong {
  color: #22313f;
}

.project-detail-page__supervision-head span {
  color: #647380;
  font-size: 12px;
  font-weight: 700;
}

.project-detail-page__supervision-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.project-detail-page__repair-plan-list {
  display: grid;
  gap: 8px;
}

.project-detail-page__supervision-issue {
  min-width: 0;
  border: 1px solid #d7dee5;
  border-left-width: 4px;
  border-radius: 6px;
  padding: 9px 10px;
  background: #fff;
}

.project-detail-page__repair-task {
  min-width: 0;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #fff;
  padding: 9px 10px;
}

.project-detail-page__supervision-issue--blocker {
  border-left-color: #c0392b;
}

.project-detail-page__supervision-issue--warn {
  border-left-color: #d68910;
}

.project-detail-page__supervision-issue--info {
  border-left-color: #2980b9;
}

.project-detail-page__supervision-issue div,
.project-detail-page__repair-task div {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 5px;
}

.project-detail-page__supervision-issue div span,
.project-detail-page__repair-task div span {
  border: 1px solid #d7dee5;
  border-radius: 4px;
  padding: 2px 5px;
  color: #5d6d7e;
  font-size: 11px;
  font-weight: 700;
}

.project-detail-page__supervision-issue strong,
.project-detail-page__repair-task strong {
  display: block;
  color: #22313f;
  font-size: 13px;
}

.project-detail-page__supervision-issue p,
.project-detail-page__supervision-issue small,
.project-detail-page__repair-task p,
.project-detail-page__repair-task small {
  display: block;
  margin-top: 5px;
  color: #526575;
  font-size: 12px;
  line-height: 1.45;
}

.project-detail-page__supervision-issue small,
.project-detail-page__repair-task small {
  color: #8a5a18;
}

.project-detail-page__repair-task-actions {
  justify-content: flex-end !important;
  margin-top: 8px;
  margin-bottom: 0 !important;
}

.project-detail-page__repair-task-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 5px 10px;
  border: 1px solid #2980b9;
  border-radius: 4px;
  background: #fff;
  color: #2471a3;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.project-detail-page__repair-task-btn:hover:not(:disabled) {
  background: #f3f8fc;
}

.project-detail-page__repair-task-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.project-detail-page__shot div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.project-detail-page__shot span,
.project-detail-page__shot small {
  color: #7c8894;
  font-size: 12px;
}

.project-detail-page__seedance-prompt {
  margin-top: 8px;
  border: 1px solid #e0e6ec;
  border-radius: 6px;
  background: #f8fafb;
  padding: 7px 9px;
}

.project-detail-page__seedance-prompt summary {
  cursor: pointer;
  color: #2f4358;
  font-size: 12px;
  font-weight: 700;
}

.project-detail-page__seedance-prompt pre {
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 8px 0 0;
  color: #34495e;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
}

.project-detail-page__shot small {
  display: block;
  margin-top: 6px;
  color: #a05f00;
  line-height: 1.4;
}

.project-detail-page__quality-main {
  min-width: 0;
}

.project-detail-page__quality-tools p {
  margin: 4px 0 0;
  color: #5c6a76;
  font-size: 14px;
}

.project-detail-page__quality-mini {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 9px;
}

.project-detail-page__quality-mini span {
  border: 1px solid #d7dee5;
  border-radius: 4px;
  background: #fff;
  color: #455866;
  padding: 3px 7px;
  font-size: 12px;
  font-weight: 700;
}

.project-detail-page__quality-list {
  margin: 9px 0 0;
  padding-left: 18px;
  color: #9a6300;
  font-size: 13px;
  line-height: 1.45;
}

.project-detail-page__report-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.project-detail-page__report-pill {
  padding: 10px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #fff;
}

.project-detail-page__report-pill--pass {
  border-color: #b8dbc8;
}

.project-detail-page__report-pill--warn {
  border-color: #efcf8a;
  background: #fffaf0;
}

.project-detail-page__report-pill span {
  display: block;
  color: #5e6d78;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.project-detail-page__report-pill strong {
  display: block;
  margin-top: 3px;
  color: #22313f;
  font-size: 18px;
}

.project-detail-page__report-pill p {
  margin-top: 5px;
  line-height: 1.45;
}

.project-detail-page__repair-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.project-detail-page__repair-btn {
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #fff;
  color: #2f4358;
  cursor: pointer;
  text-align: left;
}

.project-detail-page__repair-btn--primary {
  border-color: #2980b9;
  background: #eef7fd;
}

.project-detail-page__repair-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.project-detail-page__repair-btn span {
  display: block;
  font-size: 13px;
  font-weight: 800;
}

.project-detail-page__repair-btn small {
  display: block;
  margin-top: 4px;
  color: #647380;
  font-size: 12px;
  line-height: 1.35;
}

.project-detail-page__summary-label {
  display: block;
  margin-bottom: 6px;
  color: #6a7884;
  font-size: 13px;
}

.project-detail-page__editor,
.project-detail-page__versions {
  padding: 16px;
  margin-bottom: 18px;
}

.project-detail-page__editor-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.project-detail-page__editor-title,
.project-detail-page__section-title {
  margin: 0 0 6px 0;
  color: #22313f;
  font-size: 20px;
}

.project-detail-page__editor-desc {
  margin: 0;
  color: #6a7884;
  line-height: 1.6;
}

.project-detail-page__success {
  color: #1b7f4a;
  font-size: 13px;
}

.project-detail-page__editor-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-detail-page__editor-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.project-detail-page__editor-chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef6ff;
  color: #2b78b7;
  font-size: 13px;
  font-weight: 600;
}

.project-detail-page__select,
.project-detail-page__textarea {
  border: 1px solid #d7dee5;
  border-radius: 6px;
  font-size: 14px;
}

.project-detail-page__select {
  padding: 10px 12px;
}

.project-detail-page__textarea {
  min-height: 108px;
  padding: 12px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.6;
}

.project-detail-page__editor-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.project-detail-page__editor-empty {
  color: #7f8c8d;
  font-size: 14px;
}

.project-detail-page__model-hint {
  margin: 0;
  color: #6b7884;
  font-size: 13px;
  line-height: 1.5;
}

.project-detail-page__version-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-detail-page__version-card {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 6px;
  background: #f8fafc;
  color: #314252;
  font-size: 14px;
}

.project-detail-page__version-quality {
  font-weight: 700;
}

.project-detail-page__version-quality--pass {
  color: #1b7f4a;
}

.project-detail-page__version-quality--warn,
.project-detail-page__version-warning {
  color: #b13b2e;
  font-weight: 700;
}

@media (max-width: 820px) {
  .project-detail-page__header {
    flex-direction: column;
  }

  .project-detail-page__header-actions {
    justify-content: flex-start;
  }

  .project-detail-page__quality-tools {
    flex-direction: column;
  }

  .project-detail-page__delivery-manifest,
  .project-detail-page__export-package {
    grid-template-columns: 1fr;
  }

  .project-detail-page__delivery-artifacts,
  .project-detail-page__export-files {
    justify-content: flex-start;
  }

  .project-detail-page__summary {
    grid-template-columns: 1fr;
  }

  .project-detail-page__report-strip,
  .project-detail-page__repair-actions,
  .project-detail-page__production-repair-diff,
  .project-detail-page__supervision-list {
    grid-template-columns: 1fr;
  }

  .project-detail-page__repair-task-actions,
  .project-detail-page__repair-task-btn {
    width: 100%;
  }

  .project-detail-page__repair-task-btn {
    justify-content: center;
  }
}
</style>
