<template>
  <div class="series-studio">
    <aside class="series-studio__panel">
      <h2 class="series-studio__title">漫剧系列规划</h2>

      <section class="series-studio__field">
        <label class="series-studio__label" for="series-title">系列名</label>
        <input
          id="series-title"
          v-model="seriesTitle"
          class="series-studio__input"
          placeholder="如：濂溪少年志"
        />
      </section>

      <section class="series-studio__field">
        <label class="series-studio__label" for="series-outline">故事梗概</label>
        <textarea
          id="series-outline"
          v-model="outline"
          class="series-studio__textarea"
          rows="9"
          placeholder="输入漫剧的总故事方向、主角、关键关系、文化主题、主要矛盾。"
        />
      </section>

      <section class="series-studio__grid">
        <label class="series-studio__field">
          <span class="series-studio__label">总集数</span>
          <input
            v-model.number="episodeCount"
            class="series-studio__input"
            type="number"
            min="1"
            max="120"
          />
        </label>

        <label class="series-studio__field">
          <span class="series-studio__label">单集最短秒数</span>
          <input
            v-model.number="durationMin"
            class="series-studio__input"
            type="number"
            min="30"
            max="1200"
            step="5"
          />
        </label>

        <label class="series-studio__field">
          <span class="series-studio__label">单集最长秒数</span>
          <input
            v-model.number="durationMax"
            class="series-studio__input"
            type="number"
            min="30"
            max="1200"
            step="5"
          />
        </label>

        <label class="series-studio__field">
          <span class="series-studio__label">节奏</span>
          <select v-model="pacingProfile" class="series-studio__select">
            <option value="balanced_drama">均衡剧情</option>
            <option value="fast_hook">强钩子快节奏</option>
            <option value="slow_burn">慢热铺陈</option>
            <option value="mystery_cliffhanger">悬念钩子</option>
          </select>
        </label>
      </section>

      <button
        class="series-studio__submit"
        :disabled="!canSubmit || planning"
        @click="handlePlan"
      >
        {{ planning ? '生成中...' : '生成系列规划' }}
      </button>

      <p v-if="validationMessage" class="series-studio__message series-studio__message--warning">
        {{ validationMessage }}
      </p>
      <p v-if="errorMessage" class="series-studio__message series-studio__message--error">
        {{ errorMessage }}
      </p>

      <section class="series-studio__saved">
        <div class="series-studio__saved-head">
          <h3>已保存系列</h3>
          <button class="series-studio__ghost-button" :disabled="loadingSavedProjects" @click="loadSavedProjects">
            {{ loadingSavedProjects ? '刷新中...' : '刷新' }}
          </button>
        </div>
        <p v-if="savedProjectsError" class="series-studio__message series-studio__message--error">
          {{ savedProjectsError }}
        </p>
        <div v-else-if="savedProjects.length > 0" class="series-studio__saved-list">
          <button
            v-for="project in savedProjects"
            :key="project.series_project_id"
            class="series-studio__saved-item"
            :class="{ 'series-studio__saved-item--active': project.series_project_id === seriesProjectId }"
            @click="openSavedProject(project.series_project_id)"
          >
            <strong>{{ project.title }}</strong>
            <span>{{ project.episode_count }} 集 · {{ project.generated_episode_count }} 集已生成</span>
            <small>{{ formatDate(project.updated_at) }}</small>
          </button>
        </div>
        <p v-else class="series-studio__saved-empty">
          暂无保存系列。
        </p>
      </section>
    </aside>

    <main class="series-studio__result">
      <div v-if="planning" class="series-studio__loading">
        <div class="spinner spinner--lg" />
        <p>正在生成系列规划...</p>
      </div>

      <template v-else-if="plan">
        <section class="series-studio__summary">
          <div>
            <p class="series-studio__eyebrow">系列蓝图</p>
            <h1 class="series-studio__plan-title">{{ plan.series_title }}</h1>
            <p class="series-studio__logline">{{ plan.logline }}</p>
            <p v-if="saveMessage" class="series-studio__save-note">{{ saveMessage }}</p>
          </div>
          <div class="series-studio__metrics">
            <div class="series-studio__metric">
              <strong>{{ plan.episode_count }}</strong>
              <span>集</span>
            </div>
            <div class="series-studio__metric">
              <strong>{{ plan.episode_duration_range_sec.min }}-{{ plan.episode_duration_range_sec.max }}</strong>
              <span>秒/集</span>
            </div>
            <div class="series-studio__metric">
              <strong>{{ pacingLabel(plan.pacing_profile) }}</strong>
              <span>节奏</span>
            </div>
            <div class="series-studio__metric">
              <strong>{{ generatedEpisodeCount }}</strong>
              <span>已生成分镜</span>
            </div>
          </div>
        </section>

        <section v-if="continuityLedger" class="series-studio__section">
          <div class="series-studio__section-header">
            <h2>连续性账本</h2>
            <span>{{ continuityLedger.episode_records.length }} 条生成记录</span>
          </div>
          <div class="series-studio__ledger">
            <article class="series-studio__ledger-card">
              <strong>当前角色状态</strong>
              <p>{{ continuityLedger.character_state_current.join('；') || '尚未生成单集' }}</p>
            </article>
            <article class="series-studio__ledger-card">
              <strong>未回收线索</strong>
              <p>{{ continuityLedger.open_threads.join('；') || '暂无未回收线索' }}</p>
            </article>
            <article class="series-studio__ledger-card">
              <strong>已回收线索</strong>
              <p>{{ continuityLedger.paid_off_threads.join('；') || '暂无已回收线索' }}</p>
            </article>
            <article class="series-studio__ledger-card">
              <strong>知识使用</strong>
              <p>{{ continuityLedger.knowledge_used.slice(0, 8).join('；') || '尚未记录知识使用' }}</p>
            </article>
          </div>
          <div v-if="continuityLedger.episode_records.length > 0" class="series-studio__ledger-records">
            <article
              v-for="record in continuityLedger.episode_records"
              :key="`${record.episode_no}-${record.story_id}`"
              class="series-studio__ledger-record"
            >
              <div>
                <strong>第{{ record.episode_no }}集：{{ record.title }}</strong>
                <span>{{ record.story_id }}</span>
              </div>
              <p>{{ record.next_episode_memory.join('；') }}</p>
            </article>
          </div>
        </section>

        <section class="series-studio__section">
          <div class="series-studio__section-header">
            <h2>阶段结构</h2>
          </div>
          <div class="series-studio__phase-list">
            <article v-for="phase in plan.phases" :key="phase.phase_id" class="series-studio__phase">
              <span class="series-studio__phase-range">第 {{ phase.episode_range[0] }}-{{ phase.episode_range[1] }} 集</span>
              <strong>{{ phase.purpose }}</strong>
              <p>{{ phase.turning_point }}</p>
            </article>
          </div>
        </section>

        <section class="series-studio__section">
          <div class="series-studio__section-header">
            <h2>角色弧线</h2>
          </div>
          <div class="series-studio__character-grid">
            <article
              v-for="character in plan.main_characters"
              :key="character.name"
              class="series-studio__character"
            >
              <div class="series-studio__character-head">
                <strong>{{ character.name }}</strong>
                <span>{{ character.role }}</span>
              </div>
              <p>{{ character.long_arc }}</p>
              <div class="series-studio__turning-points">
                <span
                  v-for="point in character.turning_points"
                  :key="`${character.name}-${point.episode_no}`"
                >
                  第{{ point.episode_no }}集：{{ point.change }}
                </span>
              </div>
            </article>
          </div>
        </section>

        <section class="series-studio__section">
          <div class="series-studio__section-header">
            <h2>长期线索</h2>
          </div>
          <div class="series-studio__thread-list">
            <article v-for="thread in plan.plot_threads" :key="thread.thread_id" class="series-studio__thread">
              <div class="series-studio__thread-head">
                <strong>{{ thread.title }}</strong>
                <span>第{{ thread.setup_episode }}集 - 第{{ thread.payoff_episode }}集</span>
              </div>
              <p>{{ thread.description }}</p>
            </article>
          </div>
        </section>

        <section class="series-studio__section">
          <div class="series-studio__section-header">
            <h2>分集卡片</h2>
            <span>{{ plan.episodes.length }} 集</span>
          </div>
          <div class="series-studio__episode-list">
            <article v-for="episode in plan.episodes" :key="episode.episode_no" class="series-studio__episode">
              <header class="series-studio__episode-head">
                <div>
                  <span class="series-studio__episode-no">第 {{ episode.episode_no }} 集</span>
                  <input
                    v-if="isEditingEpisode(episode.episode_no) && episodeEditDraft"
                    v-model="episodeEditDraft.title"
                    class="series-studio__episode-title-input"
                  />
                  <h3 v-else>{{ episode.title }}</h3>
                </div>
                <div class="series-studio__episode-meta">
                  <label v-if="isEditingEpisode(episode.episode_no) && episodeEditDraft" class="series-studio__mini-field">
                    <span>秒</span>
                    <input v-model.number="episodeEditDraft.target_duration_sec" type="number" min="30" max="1200" />
                  </label>
                  <span v-else>{{ episode.target_duration_sec }} 秒</span>
                  <label v-if="isEditingEpisode(episode.episode_no) && episodeEditDraft" class="series-studio__mini-field">
                    <span>格</span>
                    <input v-model.number="episodeEditDraft.target_panel_count" type="number" min="1" max="240" />
                  </label>
                  <span v-else>{{ episode.target_panel_count }} 格</span>
                  <button
                    v-if="!isEditingEpisode(episode.episode_no)"
                    class="series-studio__episode-edit"
                    :disabled="generatingEpisodeNo !== null"
                    @click="startEditEpisode(episode)"
                  >
                    编辑
                  </button>
                  <button
                    v-if="isEditingEpisode(episode.episode_no)"
                    class="series-studio__episode-edit"
                    :disabled="savingEpisodeEdit"
                    @click="cancelEditEpisode"
                  >
                    取消
                  </button>
                  <button
                    v-if="isEditingEpisode(episode.episode_no)"
                    class="series-studio__episode-action"
                    :disabled="savingEpisodeEdit"
                    @click="saveEpisodeEdit"
                  >
                    {{ savingEpisodeEdit ? '保存中...' : '保存卡片' }}
                  </button>
                  <button
                    class="series-studio__episode-action"
                    :disabled="generatingEpisodeNo !== null || isEditingEpisode(episode.episode_no)"
                    @click="handleGenerateEpisode(episode.episode_no)"
                  >
                    {{ generatingEpisodeNo === episode.episode_no ? '生成中...' : generatedEpisodeStoryIds[String(episode.episode_no)] ? '重新生成本集分镜' : '生成本集分镜' }}
                  </button>
                </div>
              </header>
              <div v-if="isEditingEpisode(episode.episode_no) && episodeEditDraft" class="series-studio__episode-editor">
                <label>
                  <span>主冲突</span>
                  <textarea v-model="episodeEditDraft.main_conflict" rows="2" />
                </label>
                <div class="series-studio__episode-editor-grid">
                  <label>
                    <span>承接</span>
                    <textarea v-model="episodeEditDraft.continuity_from_previous_text" rows="3" />
                  </label>
                  <label>
                    <span>新增信息</span>
                    <textarea v-model="episodeEditDraft.new_information_text" rows="3" />
                  </label>
                  <label>
                    <span>伏笔</span>
                    <textarea v-model="episodeEditDraft.foreshadowing_text" rows="3" />
                  </label>
                  <label>
                    <span>回收</span>
                    <textarea v-model="episodeEditDraft.payoff_text" rows="3" />
                  </label>
                </div>
                <label>
                  <span>结尾钩子</span>
                  <textarea v-model="episodeEditDraft.ending_hook" rows="2" />
                </label>
                <div class="series-studio__episode-editor-grid">
                  <label>
                    <span>关键角色</span>
                    <input v-model="episodeEditDraft.key_characters_text" />
                  </label>
                  <label>
                    <span>知识焦点</span>
                    <input v-model="episodeEditDraft.knowledge_focus_text" />
                  </label>
                </div>
                <label>
                  <span>本集后连续性状态</span>
                  <textarea v-model="episodeEditDraft.continuity_state_after_text" rows="3" />
                </label>
                <p v-if="episodeEditError" class="series-studio__message series-studio__message--error">
                  {{ episodeEditError }}
                </p>
              </div>
              <p v-else class="series-studio__conflict">{{ episode.main_conflict }}</p>
              <div v-if="!isEditingEpisode(episode.episode_no)" class="series-studio__episode-columns">
                <div>
                  <strong>承接</strong>
                  <p>{{ episode.continuity_from_previous.join('；') }}</p>
                </div>
                <div>
                  <strong>新增</strong>
                  <p>{{ episode.new_information.join('；') }}</p>
                </div>
                <div>
                  <strong>伏笔/回收</strong>
                  <p>{{ [...episode.foreshadowing, ...episode.payoff].join('；') || '本集不新增回收点' }}</p>
                </div>
              </div>
              <footer class="series-studio__episode-footer">
                <span>{{ episode.key_characters.join('、') }}</span>
                <span
                  v-if="generatedEpisodeStoryIds[String(episode.episode_no)]"
                  class="series-studio__episode-generated"
                >
                  已生成分镜
                </span>
                <span>{{ episode.ending_hook }}</span>
              </footer>
            </article>
          </div>
        </section>

        <section
          v-if="generatingEpisodeNo || episodeErrorMessage || episodeResult"
          class="series-studio__section series-studio__generated"
        >
          <div class="series-studio__section-header">
            <h2>本集完整分镜</h2>
            <span v-if="episodeResult">第 {{ generatedEpisodeNo }} 集</span>
            <span v-else-if="generatingEpisodeNo">第 {{ generatingEpisodeNo }} 集</span>
          </div>
          <div v-if="generatingEpisodeNo" class="series-studio__loading series-studio__loading--inline">
            <div class="spinner" />
            <p>正在生成本集分镜...</p>
          </div>
          <p v-else-if="episodeErrorMessage" class="series-studio__message series-studio__message--error">
            {{ episodeErrorMessage }}
          </p>
          <StoryResult v-else :result="episodeResult" />
        </section>

        <section class="series-studio__section">
          <div class="series-studio__section-header">
            <h2>连续性规则</h2>
          </div>
          <div class="series-studio__rule-list">
            <article v-for="rule in plan.continuity_rules" :key="rule.rule_id" class="series-studio__rule">
              <strong>{{ rule.label }}</strong>
              <p>{{ rule.description }}</p>
            </article>
          </div>
        </section>
      </template>

      <div v-else class="series-studio__empty">
        <p>输入系列梗概后生成规划。</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  aiComicEpisodeGenerate,
  aiComicSeriesPlan,
  getAiComicSeriesProject,
  listAiComicSeriesProjects,
  saveAiComicSeriesProject,
} from '@/api/stories'
import StoryResult from '@/components/StoryResult.vue'
import type {
  AiComicContinuityLedger,
  AiComicEpisodePlan,
  AiComicPacingProfile,
  AiComicSeriesProjectMeta,
  AiComicSeriesPlan,
  StoryGenerateResult,
} from '@shared/types'

const route = useRoute()
const router = useRouter()

const seriesTitle = ref('')
const outline = ref('')
const episodeCount = ref(60)
const durationMin = ref(60)
const durationMax = ref(120)
const pacingProfile = ref<AiComicPacingProfile>('balanced_drama')
const planning = ref(false)
const errorMessage = ref('')
const plan = ref<AiComicSeriesPlan | null>(null)
const generatingEpisodeNo = ref<number | null>(null)
const generatedEpisodeNo = ref<number | null>(null)
const episodeResult = ref<StoryGenerateResult | null>(null)
const episodeErrorMessage = ref('')
const seriesProjectId = ref('')
const saveMessage = ref('')
const generatedEpisodeStoryIds = ref<Record<string, string>>({})
const continuityLedger = ref<AiComicContinuityLedger | null>(null)
const editingEpisodeNo = ref<number | null>(null)
const episodeEditDraft = ref<EpisodeEditDraft | null>(null)
const episodeEditError = ref('')
const savingEpisodeEdit = ref(false)
const savedProjects = ref<AiComicSeriesProjectMeta[]>([])
const loadingSavedProjects = ref(false)
const savedProjectsError = ref('')

interface EpisodeEditDraft {
  episode_no: number
  title: string
  target_duration_sec: number
  target_panel_count: number
  main_conflict: string
  continuity_from_previous_text: string
  new_information_text: string
  foreshadowing_text: string
  payoff_text: string
  ending_hook: string
  key_characters_text: string
  knowledge_focus_text: string
  continuity_state_after_text: string
}

const validationMessage = computed(() => {
  if (!outline.value.trim()) return '请先输入故事梗概。'
  if (!Number.isInteger(episodeCount.value) || episodeCount.value < 1 || episodeCount.value > 120) {
    return '总集数需要在 1 到 120 之间。'
  }
  if (!Number.isInteger(durationMin.value) || !Number.isInteger(durationMax.value)) {
    return '时长需要填写整数秒数。'
  }
  if (durationMin.value < 30 || durationMax.value > 1200) {
    return '单集时长范围需要在 30 到 1200 秒之间。'
  }
  if (durationMin.value > durationMax.value) {
    return '单集最短秒数不能大于最长秒数。'
  }
  return ''
})

const canSubmit = computed(() => !validationMessage.value)
const generatedEpisodeCount = computed(() => Object.keys(generatedEpisodeStoryIds.value).length)

onMounted(async () => {
  await loadSavedProjects()
  const id = typeof route.query.seriesProjectId === 'string' ? route.query.seriesProjectId : ''
  if (!id) return
  await loadSeriesProject(id)
})

async function loadSeriesProject(id: string) {
  planning.value = true
  errorMessage.value = ''
  episodeResult.value = null
  episodeErrorMessage.value = ''
  generatedEpisodeNo.value = null
  cancelEditEpisode()
  const res = await getAiComicSeriesProject(id)
  if (res.ok && res.data) {
    seriesProjectId.value = res.data.project.series_project_id
    generatedEpisodeStoryIds.value = res.data.generated_episode_story_ids
    continuityLedger.value = res.data.continuity_ledger
    applyPlan(res.data.plan)
    saveMessage.value = `已保存：${res.data.project.series_project_id} · ${formatDate(res.data.project.updated_at)}`
  } else {
    errorMessage.value = res.error?.message ?? '加载系列规划失败'
  }
  planning.value = false
}

async function handlePlan() {
  if (!canSubmit.value) return
  planning.value = true
  errorMessage.value = ''
  plan.value = null
  episodeResult.value = null
  episodeErrorMessage.value = ''
  generatedEpisodeNo.value = null
  seriesProjectId.value = ''
  saveMessage.value = ''
  generatedEpisodeStoryIds.value = {}
  continuityLedger.value = null

  const res = await aiComicSeriesPlan({
    outline: outline.value.trim(),
    series_title: seriesTitle.value.trim() || undefined,
    episode_count: episodeCount.value,
    episode_duration_range_sec: {
      min: durationMin.value,
      max: durationMax.value,
    },
    pacing_profile: pacingProfile.value,
    generation_scope: 'full_planning',
  })

  if (res.ok && res.data) {
    applyPlan(res.data)
    await saveCurrentProject()
    await loadSavedProjects()
  } else {
    errorMessage.value = res.error?.message ?? '系列规划生成失败'
  }
  planning.value = false
}

async function handleGenerateEpisode(episodeNo: number) {
  if (!plan.value || generatingEpisodeNo.value !== null) return
  if (!seriesProjectId.value) {
    await saveCurrentProject()
  }
  generatingEpisodeNo.value = episodeNo
  generatedEpisodeNo.value = episodeNo
  episodeResult.value = null
  episodeErrorMessage.value = ''

  const res = await aiComicEpisodeGenerate({
    series_plan: plan.value,
    episode_no: episodeNo,
    series_project_id: seriesProjectId.value || undefined,
    output_gears_segments: true,
  })

  if (res.ok && res.data) {
    episodeResult.value = res.data
    generatedEpisodeStoryIds.value = {
      ...generatedEpisodeStoryIds.value,
      [String(episodeNo)]: res.data.storyId,
    }
    await saveCurrentProject()
    await loadSavedProjects()
  } else {
    episodeErrorMessage.value = res.error?.message ?? '本集分镜生成失败'
  }
  generatingEpisodeNo.value = null
}

function isEditingEpisode(episodeNo: number): boolean {
  return editingEpisodeNo.value === episodeNo
}

function startEditEpisode(episode: AiComicEpisodePlan) {
  editingEpisodeNo.value = episode.episode_no
  episodeEditError.value = ''
  episodeEditDraft.value = {
    episode_no: episode.episode_no,
    title: episode.title,
    target_duration_sec: episode.target_duration_sec,
    target_panel_count: episode.target_panel_count,
    main_conflict: episode.main_conflict,
    continuity_from_previous_text: episode.continuity_from_previous.join('\n'),
    new_information_text: episode.new_information.join('\n'),
    foreshadowing_text: episode.foreshadowing.join('\n'),
    payoff_text: episode.payoff.join('\n'),
    ending_hook: episode.ending_hook,
    key_characters_text: episode.key_characters.join('、'),
    knowledge_focus_text: episode.knowledge_focus.join('、'),
    continuity_state_after_text: episode.continuity_state_after.join('\n'),
  }
}

function cancelEditEpisode() {
  editingEpisodeNo.value = null
  episodeEditDraft.value = null
  episodeEditError.value = ''
}

async function saveEpisodeEdit() {
  if (!plan.value || !episodeEditDraft.value) return
  const draft = episodeEditDraft.value
  const title = draft.title.trim()
  const mainConflict = draft.main_conflict.trim()
  const endingHook = draft.ending_hook.trim()

  if (!title) {
    episodeEditError.value = '标题不能为空。'
    return
  }
  if (!Number.isInteger(draft.target_duration_sec) || draft.target_duration_sec < 30 || draft.target_duration_sec > 1200) {
    episodeEditError.value = '目标秒数需要在 30 到 1200 之间。'
    return
  }
  if (!Number.isInteger(draft.target_panel_count) || draft.target_panel_count < 1 || draft.target_panel_count > 240) {
    episodeEditError.value = '目标格数需要在 1 到 240 之间。'
    return
  }
  if (!mainConflict) {
    episodeEditError.value = '主冲突不能为空。'
    return
  }
  if (!endingHook) {
    episodeEditError.value = '结尾钩子不能为空。'
    return
  }

  const updatedEpisodes = plan.value.episodes.map(episode => {
    if (episode.episode_no !== draft.episode_no) return episode
    return {
      ...episode,
      title,
      target_duration_sec: draft.target_duration_sec,
      target_panel_count: draft.target_panel_count,
      main_conflict: mainConflict,
      continuity_from_previous: parseListText(draft.continuity_from_previous_text),
      new_information: parseListText(draft.new_information_text),
      foreshadowing: parseListText(draft.foreshadowing_text),
      payoff: parseListText(draft.payoff_text),
      ending_hook: endingHook,
      key_characters: parseListText(draft.key_characters_text),
      knowledge_focus: parseListText(draft.knowledge_focus_text),
      continuity_state_after: parseListText(draft.continuity_state_after_text),
    }
  })

  savingEpisodeEdit.value = true
  plan.value = {
    ...plan.value,
    episodes: updatedEpisodes,
  }
  await saveCurrentProject()
  await loadSavedProjects()
  savingEpisodeEdit.value = false
  cancelEditEpisode()
}

function parseListText(text: string): string[] {
  return text
    .split(/[\n；;、]+/)
    .map(item => item.trim())
    .filter(Boolean)
}

function applyPlan(nextPlan: AiComicSeriesPlan) {
  plan.value = nextPlan
  seriesTitle.value = nextPlan.series_title
  outline.value = nextPlan.premise
  episodeCount.value = nextPlan.episode_count
  durationMin.value = nextPlan.episode_duration_range_sec.min
  durationMax.value = nextPlan.episode_duration_range_sec.max
  pacingProfile.value = nextPlan.pacing_profile
}

async function saveCurrentProject() {
  if (!plan.value) return
  const res = await saveAiComicSeriesProject({
    series_project_id: seriesProjectId.value || undefined,
    plan: plan.value,
    generated_episode_story_ids: generatedEpisodeStoryIds.value,
  })
  if (res.ok && res.data) {
    seriesProjectId.value = res.data.project.series_project_id
    generatedEpisodeStoryIds.value = res.data.generated_episode_story_ids
    continuityLedger.value = res.data.continuity_ledger
    saveMessage.value = `已保存：${res.data.project.series_project_id} · ${formatDate(res.data.project.updated_at)}`
    if (route.query.seriesProjectId !== seriesProjectId.value) {
      router.replace({
        path: route.path,
        query: {
          ...route.query,
          seriesProjectId: seriesProjectId.value,
        },
      })
    }
  } else {
    errorMessage.value = res.error?.message ?? '保存系列规划失败'
  }
}

async function loadSavedProjects() {
  loadingSavedProjects.value = true
  savedProjectsError.value = ''
  const res = await listAiComicSeriesProjects()
  if (res.ok && res.data) {
    savedProjects.value = res.data
  } else {
    savedProjectsError.value = res.error?.message ?? '加载保存系列失败'
  }
  loadingSavedProjects.value = false
}

async function openSavedProject(id: string) {
  if (!id || id === seriesProjectId.value) return
  await router.replace({
    path: route.path,
    query: {
      ...route.query,
      seriesProjectId: id,
    },
  })
  await loadSeriesProject(id)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function pacingLabel(profile: AiComicPacingProfile): string {
  const map: Record<AiComicPacingProfile, string> = {
    fast_hook: '强钩子',
    balanced_drama: '均衡',
    slow_burn: '慢热',
    mystery_cliffhanger: '悬念',
  }
  return map[profile]
}
</script>

<style scoped>
.series-studio {
  display: grid;
  grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
  gap: 24px;
  min-height: calc(100vh - 110px);
}

.series-studio__panel {
  border-right: 1px solid #dde4ea;
  padding-right: 20px;
}

.series-studio__title {
  margin: 0 0 18px;
  color: #23313d;
  font-size: 22px;
}

.series-studio__field {
  display: block;
  margin-bottom: 14px;
}

.series-studio__label {
  display: block;
  margin-bottom: 5px;
  color: #2c3e50;
  font-size: 14px;
  font-weight: 600;
}

.series-studio__input,
.series-studio__select,
.series-studio__textarea {
  width: 100%;
  border: 1px solid #b9c4cc;
  border-radius: 4px;
  background: #fff;
  color: #24313b;
  font-size: 15px;
}

.series-studio__input,
.series-studio__select {
  min-height: 38px;
  padding: 8px 10px;
}

.series-studio__textarea {
  padding: 10px 12px;
  line-height: 1.55;
  resize: vertical;
}

.series-studio__input:focus,
.series-studio__select:focus,
.series-studio__textarea:focus {
  border-color: #2f7fb8;
  outline: none;
}

.series-studio__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.series-studio__submit {
  width: 100%;
  min-height: 42px;
  border: none;
  border-radius: 4px;
  background: #2f7fb8;
  color: #fff;
  cursor: pointer;
  font-size: 15px;
  font-weight: 700;
}

.series-studio__submit:hover:not(:disabled) {
  background: #256d9f;
}

.series-studio__submit:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.series-studio__message {
  margin: 12px 0 0;
  border-radius: 4px;
  padding: 9px 11px;
  font-size: 13px;
  line-height: 1.45;
}

.series-studio__message--warning {
  background: #fff7e6;
  color: #9a6300;
}

.series-studio__message--error {
  background: #fdecea;
  color: #b83224;
}

.series-studio__saved {
  margin-top: 22px;
  border-top: 1px solid #dde4ea;
  padding-top: 16px;
}

.series-studio__saved-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.series-studio__saved-head h3 {
  margin: 0;
  color: #24313b;
  font-size: 16px;
}

.series-studio__ghost-button {
  min-height: 28px;
  border: 1px solid #b9c4cc;
  border-radius: 4px;
  background: #fff;
  color: #425766;
  cursor: pointer;
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 700;
}

.series-studio__ghost-button:hover:not(:disabled) {
  background: #f5f8fa;
}

.series-studio__ghost-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.series-studio__saved-list {
  display: grid;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 2px;
}

.series-studio__saved-item {
  display: grid;
  gap: 4px;
  width: 100%;
  border: 1px solid #d5dee5;
  border-radius: 6px;
  background: #fff;
  color: inherit;
  cursor: pointer;
  padding: 10px 11px;
  text-align: left;
}

.series-studio__saved-item:hover {
  border-color: #9fc3da;
  background: #f6fafc;
}

.series-studio__saved-item--active {
  border-color: #2f7fb8;
  background: #eef6fb;
}

.series-studio__saved-item strong {
  color: #24313b;
  font-size: 14px;
}

.series-studio__saved-item span,
.series-studio__saved-item small,
.series-studio__saved-empty {
  color: #667986;
  font-size: 12px;
}

.series-studio__saved-empty {
  margin: 0;
}

.series-studio__result {
  min-width: 0;
  overflow-y: auto;
}

.series-studio__loading,
.series-studio__empty {
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #71808c;
}

.series-studio__summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: start;
  margin-bottom: 22px;
  padding-bottom: 18px;
  border-bottom: 1px solid #dde4ea;
}

.series-studio__eyebrow {
  margin: 0 0 6px;
  color: #5d7281;
  font-size: 13px;
  font-weight: 700;
}

.series-studio__plan-title {
  margin: 0;
  color: #1f2e38;
  font-size: 28px;
  line-height: 1.25;
}

.series-studio__logline {
  max-width: 780px;
  margin: 10px 0 0;
  color: #455866;
  font-size: 15px;
  line-height: 1.65;
}

.series-studio__save-note {
  margin: 8px 0 0;
  color: #28734b;
  font-size: 13px;
  font-weight: 600;
}

.series-studio__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(86px, 1fr));
  gap: 10px;
}

.series-studio__metric {
  min-width: 92px;
  border: 1px solid #d5dee5;
  border-radius: 6px;
  padding: 10px 12px;
  background: #f8fafb;
}

.series-studio__metric strong {
  display: block;
  color: #1f2e38;
  font-size: 18px;
}

.series-studio__metric span {
  color: #667986;
  font-size: 12px;
}

.series-studio__section {
  margin-bottom: 22px;
}

.series-studio__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.series-studio__section-header h2 {
  margin: 0;
  color: #24313b;
  font-size: 18px;
}

.series-studio__section-header span {
  color: #667986;
  font-size: 13px;
}

.series-studio__phase-list,
.series-studio__thread-list,
.series-studio__rule-list {
  display: grid;
  gap: 10px;
}

.series-studio__ledger {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.series-studio__ledger-card,
.series-studio__ledger-record {
  border: 1px solid #d5dee5;
  border-radius: 6px;
  background: #fff;
  padding: 12px 14px;
}

.series-studio__ledger-card strong,
.series-studio__ledger-record strong {
  display: block;
  color: #24313b;
  font-size: 14px;
}

.series-studio__ledger-card p,
.series-studio__ledger-record p {
  margin: 6px 0 0;
  color: #536774;
  font-size: 13px;
  line-height: 1.55;
}

.series-studio__ledger-records {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.series-studio__ledger-record div {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.series-studio__ledger-record span {
  color: #667986;
  font-size: 12px;
  white-space: nowrap;
}

.series-studio__phase,
.series-studio__thread,
.series-studio__rule,
.series-studio__character,
.series-studio__episode {
  border: 1px solid #d5dee5;
  border-radius: 6px;
  background: #fff;
  padding: 12px 14px;
}

.series-studio__phase-range {
  display: inline-flex;
  margin-bottom: 6px;
  border-radius: 4px;
  background: #eef6f1;
  color: #28734b;
  padding: 3px 7px;
  font-size: 12px;
  font-weight: 700;
}

.series-studio__phase strong,
.series-studio__thread strong,
.series-studio__rule strong {
  display: block;
  color: #24313b;
  font-size: 15px;
}

.series-studio__phase p,
.series-studio__thread p,
.series-studio__rule p,
.series-studio__character p {
  margin: 6px 0 0;
  color: #536774;
  font-size: 14px;
  line-height: 1.55;
}

.series-studio__character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px;
}

.series-studio__character-head,
.series-studio__thread-head,
.series-studio__episode-head,
.series-studio__episode-footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.series-studio__character-head strong,
.series-studio__thread-head strong {
  color: #24313b;
}

.series-studio__character-head span,
.series-studio__thread-head span {
  color: #7b6a36;
  font-size: 13px;
  white-space: nowrap;
}

.series-studio__turning-points {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.series-studio__turning-points span {
  border: 1px solid #e0d3a9;
  border-radius: 4px;
  background: #fffaf0;
  color: #6f5b22;
  padding: 3px 6px;
  font-size: 12px;
}

.series-studio__episode-list {
  display: grid;
  gap: 12px;
}

.series-studio__episode-no {
  display: inline-block;
  margin-bottom: 4px;
  color: #2f7fb8;
  font-size: 12px;
  font-weight: 700;
}

.series-studio__episode h3 {
  margin: 0;
  color: #1f2e38;
  font-size: 17px;
}

.series-studio__episode-title-input {
  width: min(460px, 100%);
  border: 1px solid #b9c4cc;
  border-radius: 4px;
  color: #1f2e38;
  font-size: 16px;
  font-weight: 700;
  padding: 6px 8px;
}

.series-studio__episode-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.series-studio__episode-meta span {
  border-radius: 4px;
  background: #eef4f8;
  color: #3d647d;
  padding: 4px 7px;
  font-size: 12px;
  font-weight: 700;
}

.series-studio__episode-action {
  min-height: 28px;
  border: 1px solid #2f7fb8;
  border-radius: 4px;
  background: #fff;
  color: #2f6f9f;
  cursor: pointer;
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.series-studio__episode-action:hover:not(:disabled) {
  background: #eef6fb;
}

.series-studio__episode-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.series-studio__episode-edit {
  min-height: 28px;
  border: 1px solid #b9c4cc;
  border-radius: 4px;
  background: #fff;
  color: #425766;
  cursor: pointer;
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.series-studio__episode-edit:hover:not(:disabled) {
  background: #f5f8fa;
}

.series-studio__episode-edit:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.series-studio__mini-field {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 4px;
  background: #eef4f8;
  color: #3d647d;
  padding: 3px 5px;
  font-size: 12px;
  font-weight: 700;
}

.series-studio__mini-field input {
  width: 64px;
  border: 1px solid #b9c4cc;
  border-radius: 4px;
  color: #24313b;
  padding: 3px 5px;
}

.series-studio__conflict {
  margin: 10px 0;
  color: #344955;
  line-height: 1.55;
}

.series-studio__episode-editor {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.series-studio__episode-editor label {
  display: grid;
  gap: 5px;
  color: #24313b;
  font-size: 13px;
  font-weight: 700;
}

.series-studio__episode-editor textarea,
.series-studio__episode-editor input {
  width: 100%;
  border: 1px solid #b9c4cc;
  border-radius: 4px;
  color: #24313b;
  font-size: 13px;
  line-height: 1.5;
  padding: 7px 8px;
}

.series-studio__episode-editor textarea {
  resize: vertical;
}

.series-studio__episode-editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.series-studio__episode-columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.series-studio__episode-columns div {
  border-left: 3px solid #d5dee5;
  padding-left: 9px;
}

.series-studio__episode-columns strong {
  display: block;
  color: #24313b;
  font-size: 13px;
}

.series-studio__episode-columns p {
  margin: 4px 0 0;
  color: #5b6f7d;
  font-size: 13px;
  line-height: 1.5;
}

.series-studio__episode-footer {
  margin-top: 10px;
  border-top: 1px solid #eef1f4;
  padding-top: 9px;
  color: #667986;
  font-size: 13px;
}

.series-studio__episode-generated {
  border-radius: 4px;
  background: #eef6f1;
  color: #28734b;
  padding: 3px 7px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.series-studio__generated {
  border-top: 1px solid #dde4ea;
  padding-top: 18px;
}

.series-studio__loading--inline {
  min-height: 160px;
  border: 1px solid #d5dee5;
  border-radius: 6px;
  background: #f8fafb;
}

@media (max-width: 900px) {
  .series-studio {
    grid-template-columns: 1fr;
  }

  .series-studio__panel {
    border-right: none;
    border-bottom: 1px solid #dde4ea;
    padding-right: 0;
    padding-bottom: 18px;
  }

  .series-studio__summary {
    grid-template-columns: 1fr;
  }

  .series-studio__metrics,
  .series-studio__ledger,
  .series-studio__episode-columns,
  .series-studio__episode-editor-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .series-studio__grid {
    grid-template-columns: 1fr;
  }

  .series-studio__character-head,
  .series-studio__thread-head,
  .series-studio__episode-head,
  .series-studio__episode-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .series-studio__episode-meta {
    justify-content: flex-start;
  }
}
</style>
