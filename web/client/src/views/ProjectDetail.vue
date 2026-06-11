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
          <button class="project-detail-page__action-btn project-detail-page__action-btn--primary" @click="exportCurrentStory">
            导出当前版本
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
        @rewrite-scene="openSceneEditor"
        @update-supplement-task="handleSupplementTaskUpdate"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { deleteProject, getProject, regenerateProjectScene, updateProjectSupplementTask } from '@/api/projects'
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
const deleting = ref(false)
const updatingSupplementTaskId = ref('')
const successMessage = ref('')

const selectedModelProfile = computed(() => {
  return modelProfiles.value.find(profile => profile.id === selectedModelProfileId.value) ?? null
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

function versionLabel(type: StoryProjectVersionChangeType): string {
  return type === 'initial_generation' ? '初次生成' : '局部重写'
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
    if (!selectedModelProfileId.value && res.data.current_story.model_profile_id) {
      selectedModelProfileId.value = res.data.current_story.model_profile_id
    }
  } else {
    error.value = res.error?.message ?? '加载故事项目失败'
  }
  loading.value = false
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
    successMessage.value = `场景 ${selectedSceneId.value} 已生成新版本`
    clearEditor()
  } else {
    error.value = res.error?.message ?? '局部重写失败'
  }
  submitting.value = false
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

function exportCurrentStory() {
  if (!detail.value) return
  const fileName = `${detail.value.project.project_id}-${detail.value.project.current_version_id}.json`
  const blob = new Blob([JSON.stringify(detail.value.current_story, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
  successMessage.value = '当前版本已导出到本地'
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

@media (max-width: 820px) {
  .project-detail-page__header {
    flex-direction: column;
  }

  .project-detail-page__header-actions {
    justify-content: flex-start;
  }

  .project-detail-page__summary {
    grid-template-columns: 1fr;
  }
}
</style>
