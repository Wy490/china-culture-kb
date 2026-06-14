<template>
  <div v-if="result" class="story-result">
    <!-- Title & logline -->
    <header class="story-result__header">
      <h2 class="story-result__title">{{ result.title }}</h2>
      <p v-if="result.logline" class="story-result__logline">{{ result.logline }}</p>
      <p class="story-result__meta">
        成片: {{ videoTypeLabel }} · 表现: {{ presentationStyleLabel }} · 来源: {{ result.source_entry }}
        <span v-if="result.generation_source" :class="generationModelClass"> · 模型: {{ result.generation_source }}</span>
        <span v-else-if="result.model_profile_id" class="story-result__model-normal"> · 模型: {{ result.model_profile_id }}</span>
        <span v-if="result.credibility_note"> · 可信度: {{ result.credibility_note }}</span>
      </p>
      <GearsWebhookStatus v-if="showGearsWebhookStatus" :status="result.gears_webhook" />
      <GearsVideoStatus v-if="showGearsVideoStatus" :video="result.gears_video" />
    </header>

    <!-- Full text -->
    <section class="story-result__section">
      <h3 class="story-result__section-title">完整故事文本</h3>
      <div v-if="result.full_text && result.full_text.trim()" class="story-result__full-text">
        <p v-for="(para, i) in fullTextParagraphs" :key="i" v-html="para" />
      </div>
      <div v-else class="story-result__empty-warning">
        <p>⚠️ 该故事缺少完整正文，请重新生成</p>
      </div>
    </section>

    <!-- Knowledge source (new) -->
    <section v-if="result.knowledge_pack" class="story-result__section">
      <h3 class="story-result__section-title">知识来源</h3>
      <div v-if="result.knowledge_pack.primary_entries.length > 0" class="story-result__source-group">
        <h4 class="story-result__source-label story-result__source-label--primary">主依据条目</h4>
        <div v-for="e in result.knowledge_pack.primary_entries" :key="e.entry_name" class="story-result__source-item">
          <strong>{{ e.entry_name }}</strong>
          <span class="story-result__source-type">{{ e.type }}</span>
          <span class="story-result__source-score">{{ (e.score * 100).toFixed(0) }}%</span>
          <span v-if="e.knowledge_domain" class="story-result__source-tag">{{ knowledgeDomainLabel(e.knowledge_domain) }}</span>
          <span v-if="e.era" class="story-result__source-tag">{{ e.era }}</span>
        </div>
      </div>
      <div v-if="result.knowledge_pack.supporting_entries.length > 0" class="story-result__source-group">
        <h4 class="story-result__source-label story-result__source-label--supporting">辅助条目</h4>
        <div v-for="e in result.knowledge_pack.supporting_entries" :key="e.entry_name" class="story-result__source-item">
          <strong>{{ e.entry_name }}</strong>
          <span class="story-result__source-type">{{ e.type }}</span>
          <span class="story-result__source-score">{{ (e.score * 100).toFixed(0) }}%</span>
          <span v-if="e.knowledge_domain" class="story-result__source-tag">{{ knowledgeDomainLabel(e.knowledge_domain) }}</span>
          <span v-if="e.era" class="story-result__source-tag">{{ e.era }}</span>
          <span v-for="usage in e.asset_usage ?? []" :key="usage" class="story-result__source-tag">{{ assetUsageLabel(usage) }}</span>
        </div>
      </div>
      <div v-if="result.knowledge_pack.missing_needs.length > 0" class="story-result__source-group">
        <h4 class="story-result__source-label story-result__source-label--missing">缺失资料（创作方向）</h4>
        <p v-for="m in result.knowledge_pack.missing_needs" :key="m.need_id" class="story-result__source-missing">
          ⚠️ {{ m.label }}：{{ m.message }}
        </p>
      </div>
    </section>

    <section v-if="result.supplement_tasks && result.supplement_tasks.length > 0" class="story-result__section">
      <h3 class="story-result__section-title">资料补充任务</h3>
      <div class="story-result__supplement-list">
        <div v-for="task in result.supplement_tasks" :key="task.task_id" class="story-result__supplement-task">
          <span class="story-result__supplement-status">{{ task.status === 'open' ? '待补' : '已完成' }}</span>
          <div>
            <strong>{{ task.label }}</strong>
            <div v-if="task.category || task.recommended_fields?.length" class="story-result__supplement-meta">
              <span v-if="task.category">{{ supplementCategoryLabel(task.category) }}</span>
              <span v-if="task.recommended_fields?.length">建议字段：{{ task.recommended_fields.join('、') }}</span>
            </div>
            <p>{{ task.description }}</p>
            <p v-if="task.intake_prompt" class="story-result__supplement-prompt">{{ task.intake_prompt }}</p>
            <textarea
              v-if="editableProject && task.status === 'open'"
              class="story-result__supplement-textarea"
              :value="supplementDrafts[task.task_id] ?? task.supplement_note ?? ''"
              placeholder="记录本次补录的事实、来源、可用于故事或画面的细节。"
              @input="updateSupplementDraft(task.task_id, $event)"
            />
            <p v-else-if="task.supplement_note" class="story-result__supplement-note">
              <strong>补录说明：</strong>{{ task.supplement_note }}
            </p>
          </div>
          <button
            v-if="editableProject"
            class="btn btn--sm btn--outline story-result__supplement-action"
            :disabled="updatingSupplementTaskId === task.task_id"
            @click="emitSupplementTaskUpdate(task.task_id, task.status === 'open' ? 'resolved' : 'open')"
          >
            {{ updatingSupplementTaskId === task.task_id ? '更新中…' : task.status === 'open' ? '保存并完成' : '重新打开' }}
          </button>
        </div>
      </div>
    </section>

    <section v-if="result.story_blueprint" class="story-result__section">
      <h3 class="story-result__section-title">类型故事蓝图</h3>
      <div class="story-result__blueprint">
        <p><strong>中心问题:</strong> {{ result.story_blueprint.central_question }}</p>
        <p v-if="result.story_blueprint.protagonist"><strong>主角:</strong> {{ result.story_blueprint.protagonist }}</p>
        <div v-if="result.story_blueprint.genre_beats.length > 0" class="story-result__field-list">
          <strong>类型节拍</strong>
          <ol>
            <li v-for="beat in result.story_blueprint.genre_beats" :key="beat.beat_id">
              {{ beat.scene_id ? `场景 ${beat.scene_id} · ` : '' }}{{ beat.function_label }}：{{ beat.content_requirement }}
            </li>
          </ol>
        </div>
        <div v-if="result.story_blueprint.evidence_boundaries.length > 0" class="story-result__field-list">
          <strong>可信度边界</strong>
          <ul>
            <li v-for="boundary in result.story_blueprint.evidence_boundaries" :key="boundary.boundary_id">
              {{ boundary.label }}：{{ boundary.note }}
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Quality report (new) -->
    <section v-if="result.quality_report" class="story-result__section">
      <h3 class="story-result__section-title">故事质量校验</h3>
      <div :class="['story-result__quality', result.quality_report.passed ? 'story-result__quality--pass' : 'story-result__quality--fail']">
        <div class="story-result__quality-summary">
          <article>
            <span>状态</span>
            <strong>{{ result.quality_report.passed ? '通过' : '需调整' }}</strong>
          </article>
          <article>
            <span>类型匹配度</span>
            <strong>{{ typeof result.quality_report.genre_score === 'number' ? `${result.quality_report.genre_score}/100` : '未记录' }}</strong>
          </article>
          <article>
            <span>质量问题</span>
            <strong>{{ result.quality_report.issues.length }}</strong>
          </article>
          <article>
            <span>节拍问题</span>
            <strong>{{ qualityBeatIssues.length }}</strong>
          </article>
        </div>
        <ul v-if="result.quality_report.issues.length > 0" class="story-result__quality-issues">
          <li v-for="issue in result.quality_report.issues" :key="issue">{{ issue }}</li>
        </ul>
        <div v-if="result.quality_report.missing_required_elements?.length" class="story-result__quality-actions">
          <strong>缺少的类型要素</strong>
          <ul>
            <li v-for="item in result.quality_report.missing_required_elements" :key="item">{{ item }}</li>
          </ul>
        </div>
        <div v-if="qualityBeatIssues.length > 0" class="story-result__quality-actions">
          <strong>节拍定位</strong>
          <ul>
            <li v-for="item in qualityBeatIssues" :key="item.issue">
              <button
                v-if="item.scene_id"
                class="story-result__inline-scene-btn"
                type="button"
                @click="scrollToScene(item.scene_id)"
              >
                场景 {{ item.scene_id }}
              </button>
              <span v-else>未匹配场景</span>
              {{ item.function_label ? ` · ${item.function_label}` : '' }}：{{ item.issue }}
            </li>
          </ul>
        </div>
        <div v-if="result.quality_report.repair_actions && result.quality_report.repair_actions.length > 0" class="story-result__quality-actions">
          <strong>建议调整</strong>
          <ul>
            <li v-for="action in result.quality_report.repair_actions" :key="action">{{ action }}</li>
          </ul>
        </div>
      </div>
    </section>

    <section v-if="result.repair_trace && result.repair_trace.length > 0" class="story-result__section">
      <h3 class="story-result__section-title">修复记录</h3>
      <div class="story-result__field-list">
        <ul>
          <li v-for="trace in result.repair_trace" :key="trace.trace_id">
            {{ trace.applied ? '已应用' : '未应用' }}：{{ trace.reason }}
            <span v-if="typeof trace.before_genre_score === 'number' || typeof trace.after_genre_score === 'number'">
              （{{ trace.before_genre_score ?? '-' }} → {{ trace.after_genre_score ?? '-' }}）
            </span>
          </li>
        </ul>
      </div>
    </section>

    <!-- Scene breakdown — detailed -->
    <section class="story-result__section">
      <h3 class="story-result__section-title">场景分解</h3>
      <p v-if="sceneFilterIds && sceneFilterIds.length > 0" class="story-result__filter-note">
        当前仅显示质量报告关联场景。
      </p>
      <div v-if="displayedScenes.length > 0" class="story-result__scenes">
        <div
          v-for="scene in displayedScenes"
          :key="scene.scene_id"
          :id="`story-scene-${scene.scene_id}`"
          :class="['story-result__scene-card', sceneQualityNotes(scene.scene_id).length > 0 ? 'story-result__scene-card--quality' : '']"
        >
          <h4 class="story-result__scene-title">
            场景 {{ scene.scene_id }} — {{ scene.title || scene.location }}
          </h4>
          <ul v-if="sceneQualityNotes(scene.scene_id).length > 0" class="story-result__scene-quality-notes">
            <li v-for="note in sceneQualityNotes(scene.scene_id)" :key="note">{{ note }}</li>
          </ul>
          <div class="story-result__scene-details">
            <p class="story-result__scene-meta-row">
              <span class="story-result__scene-tag">{{ scene.dramatic_function }}</span>
              <span>{{ scene.duration_sec }}秒</span>
              <span>{{ scene.location }}</span>
              <span v-if="scene.time_of_day">{{ scene.time_of_day }}</span>
            </p>
            <p v-if="scene.plot" class="story-result__scene-plot">{{ scene.plot }}</p>
            <p v-if="scene.conflict" class="story-result__scene-conflict">
              <strong>冲突:</strong> {{ scene.conflict }}
            </p>
            <p v-if="scene.key_action" class="story-result__scene-action">
              <strong>关键动作:</strong> {{ scene.key_action }}
            </p>
            <p v-if="scene.dialogue_or_narration" class="story-result__scene-dialogue">
              <strong>对白/旁白:</strong> {{ scene.dialogue_or_narration }}
            </p>
            <p v-if="scene.characters && scene.characters.length > 0" class="story-result__scene-characters">
              <strong>角色:</strong> {{ scene.characters.join(', ') }}
            </p>
            <p v-if="scene.visual_prompt" class="story-result__scene-visual">
              <strong>画面提示:</strong> {{ scene.visual_prompt }}
            </p>
            <p v-if="scene.camera_suggestion" class="story-result__scene-camera">
              <strong>镜头建议:</strong> {{ scene.camera_suggestion }}
            </p>
            <p v-if="scene.cultural_note" class="story-result__scene-cultural">
              <strong>文化标注:</strong> {{ scene.cultural_note }}
            </p>
            <p v-if="scene.factual_basis" class="story-result__scene-factual">
              <strong>史实依据:</strong> {{ scene.factual_basis }}
            </p>
            <p v-if="scene.fictionalized_elements && scene.fictionalized_elements.length > 0" class="story-result__scene-fictionalized">
              <strong>影视化创作:</strong> {{ scene.fictionalized_elements.join('；') }}
            </p>
            <p v-if="scene.source_entries && scene.source_entries.length > 0" class="story-result__scene-source">
              <strong>来源条目:</strong> {{ scene.source_entries.join('、') }}
            </p>
          </div>
          <div v-if="editableProject" class="story-result__scene-actions">
            <button
              class="btn btn--sm btn--blue"
              :disabled="regeneratingSceneId === scene.scene_id"
              @click="emit('rewrite-scene', scene.scene_id)"
            >
              {{ regeneratingSceneId === scene.scene_id ? '正在重写…' : '重写这一场' }}
            </button>
          </div>
        </div>
      </div>
      <div v-else class="story-result__empty-warning">
        <p>{{ sceneFilterIds && sceneFilterIds.length > 0 ? '没有匹配到质量报告关联场景。' : '⚠️ 该故事缺少场景分解数据，请重新生成' }}</p>
      </div>
    </section>

    <!-- GEARS segments — detailed expandable -->
    <section v-if="result.gears_segments.length > 0" class="story-result__section">
      <h3 class="story-result__section-title">GEARS 分段脚本</h3>
      <div class="story-result__segments">
        <div v-for="seg in result.gears_segments" :key="seg.segment_id" class="story-result__segment-card">
          <div class="story-result__segment-header" @click="toggleSegment(seg.segment_id)">
            <h4 class="story-result__segment-title">
              段落 {{ seg.segment_id }} — {{ seg.purpose }}（{{ seg.duration_sec }}秒 · {{ seg.panel_count }}格）
            </h4>
            <span class="story-result__segment-toggle">{{ expandedSegments[seg.segment_id] ? '▼' : '▶' }}</span>
          </div>
          <div v-if="expandedSegments[seg.segment_id]" class="story-result__segment-body">
            <p class="story-result__segment-script">{{ seg.script_text }}</p>
            <p class="story-result__segment-focus">
              <strong>视觉焦点:</strong> {{ seg.visual_focus.join('、') }}
            </p>
            <p v-if="seg.cultural_constraints.length > 0" class="story-result__segment-constraints">
              <strong>文化约束:</strong> {{ seg.cultural_constraints.join('；') }}
            </p>
            <p v-if="seg.segment_prompt_hint" class="story-result__segment-hint">
              <strong>风格提示:</strong> {{ seg.segment_prompt_hint }}
            </p>
            <div class="story-result__segment-actions">
              <button class="btn btn--sm btn--blue" @click="copySegmentScript(seg)">📋 复制脚本文本</button>
              <button class="btn btn--sm btn--blue" @click="copySegmentJson(seg)">📋 复制单段 JSON</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- GearsActions (full JSON copy / export / URL display) -->
    <GearsActions
      v-if="result.gears_segments.length > 0"
      :segments="result.gears_segments"
      :gears-segments-url="result.gears_segments_url"
      :delivery-package="result.gears_delivery"
      :story-id="result.storyId"
    />

    <!-- AI comic dialogue -->
    <section v-if="result.dialogue && result.dialogue.length > 0" class="story-result__section">
      <h3 class="story-result__section-title">漫剧对白</h3>
      <div v-for="d in result.dialogue" :key="d.scene_id" class="story-result__dialogue-scene">
        <h4>场景 {{ d.scene_id }}</h4>
        <p v-for="line in d.lines" :key="line.character" class="story-result__dialogue-line">
          <strong>{{ line.character }}</strong>（{{ line.emotion }}）: {{ line.text }}
        </p>
      </div>
    </section>

    <!-- Promo fields -->
    <section v-if="result.visual_symbols && result.visual_symbols.length > 0" class="story-result__section">
      <h3 class="story-result__section-title">视觉符号</h3>
      <p>{{ result.visual_symbols.join('、') }}</p>
      <p v-if="result.craft_or_ritual_process"><strong>工艺/仪式流程:</strong> {{ result.craft_or_ritual_process }}</p>
      <p v-if="result.modern_connection"><strong>当代连接:</strong> {{ result.modern_connection }}</p>
      <p v-if="result.core_message"><strong>核心信息:</strong> {{ result.core_message }}</p>
      <p v-if="result.slogan_or_key_sentence"><strong>标语:</strong> {{ result.slogan_or_key_sentence }}</p>
    </section>

    <!-- Scene/landscape fields -->
    <section v-if="hasSpatialFields" class="story-result__section">
      <h3 class="story-result__section-title">空间与视觉路线</h3>
      <p v-if="result.spatial_identity"><strong>空间身份:</strong> {{ result.spatial_identity }}</p>
      <p v-if="result.time_layer"><strong>时间层:</strong> {{ result.time_layer }}</p>
      <p v-if="result.atmosphere"><strong>氛围:</strong> {{ result.atmosphere }}</p>
      <div v-if="result.visual_route && result.visual_route.length > 0" class="story-result__field-list">
        <strong>视觉路线</strong>
        <ol>
          <li v-for="route in result.visual_route" :key="route">{{ route }}</li>
        </ol>
      </div>
    </section>

    <!-- Lecture/explainer fields -->
    <section v-if="hasKnowledgeFields" class="story-result__section">
      <h3 class="story-result__section-title">论点标注</h3>
      <ul v-if="result.argument_points && result.argument_points.length > 0">
        <li v-for="pt in result.argument_points" :key="pt">{{ pt }}</li>
      </ul>
      <div v-if="result.knowledge_outline && result.knowledge_outline.length > 0" class="story-result__field-list">
        <strong>知识大纲</strong>
        <ol>
          <li v-for="item in result.knowledge_outline" :key="item">{{ item }}</li>
        </ol>
      </div>
    </section>

    <!-- Documentary fields -->
    <section v-if="hasDocumentaryFields" class="story-result__section">
      <h3 class="story-result__section-title">史料引用</h3>
      <ul v-if="result.source_quotes && result.source_quotes.length > 0">
        <li v-for="sq in result.source_quotes" :key="sq">{{ sq }}</li>
      </ul>
      <div v-if="result.field_notes && result.field_notes.length > 0" class="story-result__field-list">
        <strong>现场素材</strong>
        <ul>
          <li v-for="note in result.field_notes" :key="note">{{ note }}</li>
        </ul>
      </div>
    </section>

    <!-- Cultural constraints -->
    <section v-if="result.cultural_constraints.length > 0" class="story-result__section">
      <h3 class="story-result__section-title">文化约束</h3>
      <ul class="story-result__constraints">
        <li v-for="c in result.cultural_constraints" :key="c">{{ c }}</li>
      </ul>
    </section>

    <!-- Credibility note -->
    <section class="story-result__section">
      <h3 class="story-result__section-title">可信度说明</h3>
      <p class="story-result__credibility">{{ result.credibility_note }}</p>
    </section>

    <!-- Copy feedback -->
    <div v-if="copyMessage" class="story-result__copy-msg">{{ copyMessage }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import type {
  KnowledgeSupplementTaskCategory,
  KnowledgeSupplementTaskStatus,
  StoryGenerateResult,
  VideoType,
  PresentationStyle,
  GearsSegment,
  KnowledgeDomain,
  KnowledgeAssetUsage,
} from '@shared/types'
import { VIDEO_TYPE_CONFIG, PRESENTATION_STYLE_CONFIG } from '@shared/types'
import GearsActions from './GearsActions.vue'
import GearsWebhookStatus from './GearsWebhookStatus.vue'
import GearsVideoStatus from './GearsVideoStatus.vue'

const props = withDefaults(defineProps<{
  result: StoryGenerateResult | null
  editableProject?: boolean
  regeneratingSceneId?: number | null
  updatingSupplementTaskId?: string
  showGearsWebhookStatus?: boolean
  showGearsVideoStatus?: boolean
  sceneFilterIds?: number[]
}>(), {
  editableProject: false,
  regeneratingSceneId: null,
  updatingSupplementTaskId: '',
  showGearsWebhookStatus: true,
  showGearsVideoStatus: true,
  sceneFilterIds: undefined,
})
const emit = defineEmits<{
  (e: 'rewrite-scene', sceneId: number): void
  (e: 'update-supplement-task', taskId: string, status: KnowledgeSupplementTaskStatus, supplementNote?: string): void
}>()

const expandedSegments = reactive<Record<number, boolean>>({})
const supplementDrafts = reactive<Record<string, string>>({})
const copyMessage = ref('')

const KNOWLEDGE_DOMAIN_LABELS: Record<KnowledgeDomain, string> = {
  core_china_culture: '主库',
  era_setting: '朝代设定',
  regional_culture: '地域文化',
  folklore_zhiyi: '志异传说',
  gears_asset: 'GEARS资产',
}

const ASSET_USAGE_LABELS: Record<KnowledgeAssetUsage, string> = {
  character_clothing: '服装',
  character_props: '随身道具',
  scene_space: '场景',
  scene_props: '场景陈设',
  story_motif: '母题',
  dialogue_tone: '语气',
  credibility_boundary: '可信度',
  gears_delivery: '供稿',
}

function knowledgeDomainLabel(domain: KnowledgeDomain) {
  return KNOWLEDGE_DOMAIN_LABELS[domain] ?? domain
}

function assetUsageLabel(usage: KnowledgeAssetUsage) {
  return ASSET_USAGE_LABELS[usage] ?? usage
}

const videoTypeLabel = computed(() => {
  if (!props.result) return ''
  return VIDEO_TYPE_CONFIG[props.result.video_type]?.label ?? props.result.video_type
})

const presentationStyleLabel = computed(() => {
  if (!props.result) return ''
  return PRESENTATION_STYLE_CONFIG[props.result.presentation_style]?.label ?? props.result.presentation_style
})

const isFallbackGeneration = computed(() => {
  // Use the structured boolean field — no fragile Chinese string matching
  return props.result?.generation_used_fallback === true
})

const generationModelClass = computed(() => {
  if (isFallbackGeneration.value) return 'story-result__model-fallback'
  // local_only (no adapter configured) shows neutral grey, external_model shows green
  // undefined generation_mode (old stories) treated as local_only → grey
  const mode = props.result?.generation_mode ?? 'local_only'
  if (mode === 'local_only') return 'story-result__model-neutral'
  return 'story-result__model-normal'
})

const fullTextParagraphs = computed(() => {
  if (!props.result?.full_text) return []
  return props.result.full_text
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => renderSimpleMarkdown(p.trim()))
})

const hasSpatialFields = computed(() => {
  const result = props.result
  return Boolean(
    result?.spatial_identity
      || result?.time_layer
      || result?.atmosphere
      || (result?.visual_route && result.visual_route.length > 0),
  )
})

const hasKnowledgeFields = computed(() => {
  const result = props.result
  return Boolean(
    (result?.argument_points && result.argument_points.length > 0)
      || (result?.knowledge_outline && result.knowledge_outline.length > 0),
  )
})

const hasDocumentaryFields = computed(() => {
  const result = props.result
  return Boolean(
    (result?.source_quotes && result.source_quotes.length > 0)
      || (result?.field_notes && result.field_notes.length > 0),
  )
})

const displayedScenes = computed(() => {
  const scenes = props.result?.scene_breakdown ?? []
  if (!props.sceneFilterIds || props.sceneFilterIds.length === 0) return scenes
  const ids = new Set(props.sceneFilterIds)
  return scenes.filter(scene => ids.has(scene.scene_id))
})

const qualityBeatIssues = computed(() => {
  const report = props.result?.quality_report
  const beats = props.result?.story_blueprint?.genre_beats ?? []
  if (!report?.weak_beats?.length || beats.length === 0) return []
  return report.weak_beats.map(issue => {
    const order = Number(issue.match(/^(\d+)\./)?.[1])
    const beat = Number.isFinite(order) ? beats.find(item => item.order === order) : undefined
    return {
      issue,
      scene_id: beat?.scene_id,
      function_label: beat?.function_label,
    }
  })
})

const qualityNotesByScene = computed(() => {
  const map = new Map<number, string[]>()
  for (const item of qualityBeatIssues.value) {
    if (!item.scene_id) continue
    const notes = map.get(item.scene_id) ?? []
    notes.push(item.function_label ? `${item.function_label}：${item.issue}` : item.issue)
    map.set(item.scene_id, notes)
  }
  return map
})

function renderSimpleMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function sceneQualityNotes(sceneId: number): string[] {
  return qualityNotesByScene.value.get(sceneId) ?? []
}

function scrollToScene(sceneId: number) {
  document.getElementById(`story-scene-${sceneId}`)?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })
}

function toggleSegment(id: number) {
  expandedSegments[id] = !expandedSegments[id]
}

function supplementCategoryLabel(category?: KnowledgeSupplementTaskCategory): string {
  const map: Record<KnowledgeSupplementTaskCategory, string> = {
    person_experience: '人物经历',
    architecture_detail: '建筑细节',
    event_process: '事件过程',
    regional_context: '地域背景',
    cultural_background: '文化背景',
    supporting_character: '配角人物',
    general: '通用资料',
  }
  return category ? map[category] : '通用资料'
}

function updateSupplementDraft(taskId: string, event: Event) {
  supplementDrafts[taskId] = (event.target as HTMLTextAreaElement).value
}

function emitSupplementTaskUpdate(taskId: string, status: KnowledgeSupplementTaskStatus) {
  const note = supplementDrafts[taskId]?.trim()
  emit('update-supplement-task', taskId, status, note || undefined)
}

async function copySegmentScript(seg: GearsSegment) {
  try {
    await navigator.clipboard.writeText(seg.script_text)
    showCopyMessage(`段落 #${seg.segment_id} 脚本文本已复制`)
  } catch {
    showCopyMessage('复制失败')
  }
}

async function copySegmentJson(seg: GearsSegment) {
  try {
    await navigator.clipboard.writeText(JSON.stringify(seg, null, 2))
    showCopyMessage(`段落 #${seg.segment_id} JSON 已复制`)
  } catch {
    showCopyMessage('复制失败')
  }
}

function showCopyMessage(msg: string) {
  copyMessage.value = msg
  setTimeout(() => { copyMessage.value = '' }, 3000)
}
</script>

<style scoped>
.story-result { max-width: 100%; }
.story-result__header { margin-bottom: 24px; }
.story-result__title { margin: 0 0 8px 0; font-size: 24px; color: #2c3e50; }
.story-result__logline { margin: 0 0 4px 0; font-size: 16px; color: #34495e; font-style: italic; }
.story-result__meta { margin: 0; font-size: 14px; color: #7f8c8d; }
.story-result__model-normal { color: #27ae60; }
.story-result__model-fallback { color: #f39c12; }
.story-result__model-neutral { color: #7f8c8d; }
.story-result__section { margin-bottom: 24px; }
.story-result__section-title { margin: 0 0 10px 0; font-size: 18px; color: #2c3e50; border-bottom: 1px solid #ecf0f1; padding-bottom: 4px; }

/* Full text */
.story-result__full-text p { margin: 0 0 12px 0; font-size: 15px; line-height: 1.7; color: #34495e; }
.story-result__empty-warning { padding: 12px 16px; background: #fef9e7; border: 1px solid #f39c12; border-radius: 6px; color: #e67e22; font-size: 14px; }
.story-result__filter-note {
  margin: 0 0 8px;
  color: #6b7884;
  font-size: 13px;
}

/* Scene cards */
.story-result__scenes { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
.story-result__scene-card { padding: 14px 18px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; }
.story-result__scene-card--quality {
  border-color: #f0c36b;
  background: #fffaf0;
}
.story-result__scene-title { margin: 0 0 8px 0; font-size: 16px; color: #2c3e50; }
.story-result__scene-quality-notes {
  margin: 0 0 8px;
  padding-left: 18px;
  color: #8a5b00;
  font-size: 13px;
  line-height: 1.45;
}
.story-result__scene-details { display: flex; flex-direction: column; gap: 6px; }
.story-result__scene-meta-row { display: flex; gap: 8px; align-items: center; font-size: 13px; color: #7f8c8d; }
.story-result__scene-tag { padding: 2px 8px; background: #eaf2f8; color: #2980b9; border-radius: 3px; font-size: 12px; font-weight: 600; }
.story-result__scene-plot { margin: 0; font-size: 14px; line-height: 1.5; color: #34495e; }
.story-result__scene-action { margin: 0; font-size: 14px; color: #2c3e50; }
.story-result__scene-conflict { margin: 0; font-size: 14px; color: #c0392b; background: #fdecea; padding: 4px 8px; border-radius: 4px; }
.story-result__scene-dialogue { margin: 0; font-size: 14px; color: #2c3e50; background: #f5eef8; padding: 4px 8px; border-radius: 4px; }
.story-result__scene-characters { margin: 0; font-size: 13px; color: #7f8c8d; }
.story-result__scene-visual { margin: 0; font-size: 14px; color: #34495e; background: #eaf2f8; padding: 4px 8px; border-radius: 4px; }
.story-result__scene-camera { margin: 0; font-size: 14px; color: #34495e; background: #f0f8ff; padding: 4px 8px; border-radius: 4px; }
.story-result__scene-cultural { margin: 0; font-size: 13px; color: #f39c12; }
.story-result__scene-factual { margin: 0; font-size: 13px; color: #27ae60; background: #d5f5e3; padding: 4px 8px; border-radius: 4px; }
.story-result__scene-fictionalized { margin: 0; font-size: 13px; color: #8e44ad; background: #f5eef8; padding: 4px 8px; border-radius: 4px; }
.story-result__scene-source { margin: 0; font-size: 13px; color: #7f8c8d; }
.story-result__scene-actions { margin-top: 12px; display: flex; justify-content: flex-end; }

/* GEARS segments */
.story-result__segments { display: flex; flex-direction: column; gap: 8px; }
.story-result__segment-card { border: 1px solid #dee2e6; border-radius: 6px; background: #fff; }
.story-result__segment-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; cursor: pointer; transition: background 0.2s; }
.story-result__segment-header:hover { background: #f0f8ff; }
.story-result__segment-title { margin: 0; font-size: 15px; color: #2c3e50; }
.story-result__segment-toggle { font-size: 14px; color: #7f8c8d; }
.story-result__segment-body { padding: 12px 14px; border-top: 1px solid #ecf0f1; }
.story-result__segment-script { margin: 0 0 8px 0; font-size: 14px; line-height: 1.6; color: #34495e; }
.story-result__segment-focus { margin: 0 0 6px 0; font-size: 14px; color: #3498db; }
.story-result__segment-constraints { margin: 0 0 8px 0; font-size: 13px; color: #e67e22; }
.story-result__segment-hint { margin: 0 0 8px 0; font-size: 13px; color: #8e44ad; background: #f5eef8; padding: 4px 8px; border-radius: 4px; }
.story-result__segment-actions { display: flex; gap: 8px; }
.btn { padding: 6px 12px; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; transition: opacity 0.2s; }
.btn:hover:not(:disabled) { opacity: 0.85; }
.btn--blue { background: #2980b9; color: #fff; }
.btn--sm { padding: 6px 12px; font-size: 13px; }

/* Dialogue */
.story-result__dialogue-scene { margin-bottom: 8px; }
.story-result__dialogue-line { margin: 0 0 4px 0; font-size: 14px; color: #34495e; }
.story-result__field-list {
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid #d7dde2;
  border-radius: 6px;
  background: #f8fafb;
}
.story-result__field-list strong {
  display: block;
  margin-bottom: 6px;
  color: #2c3e50;
  font-size: 14px;
}
.story-result__field-list ol,
.story-result__field-list ul {
  margin: 0;
  padding-left: 18px;
}
.story-result__field-list li {
  margin-bottom: 4px;
  color: #34495e;
  font-size: 14px;
  line-height: 1.5;
}

/* Constraints */
.story-result__constraints { padding-left: 20px; margin: 0; }
.story-result__constraints li { font-size: 14px; color: #e67e22; margin-bottom: 4px; }
.story-result__credibility { font-size: 14px; color: #34495e; background: #fef9e7; padding: 8px 12px; border-radius: 4px; margin: 0; }
.story-result__copy-msg { margin-top: 10px; padding: 6px 10px; background: #d5f5e3; border-radius: 4px; font-size: 13px; color: #27ae60; }

/* Knowledge source section */
.story-result__source-group { margin-bottom: 8px; }
.story-result__source-label { margin: 0 0 4px; font-size: 14px; }
.story-result__source-label--primary { color: #27ae60; }
.story-result__source-label--supporting { color: #2980b9; }
.story-result__source-label--missing { color: #f39c12; }
.story-result__source-item {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  padding: 4px 0;
  font-size: 14px;
  color: #34495e;
}
.story-result__source-type {
  padding: 2px 6px;
  background: #eaf2f8;
  color: #2980b9;
  border-radius: 3px;
  font-size: 12px;
}
.story-result__source-score {
  padding: 2px 6px;
  background: #d5f5e3;
  color: #27ae60;
  border-radius: 3px;
  font-size: 12px;
}
.story-result__source-tag {
  padding: 2px 6px;
  border: 1px solid #d7dde2;
  color: #455a64;
  background: #fff;
  border-radius: 3px;
  font-size: 12px;
}
.story-result__source-missing {
  font-size: 13px;
  color: #f39c12;
  margin: 4px 0;
}
.story-result__supplement-list {
  display: grid;
  gap: 8px;
}
.story-result__supplement-task {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: flex-start;
  padding: 10px;
  border: 1px solid #f0d8a8;
  border-radius: 6px;
  background: #fffaf0;
}
.story-result__supplement-task strong {
  display: block;
  margin-bottom: 4px;
  color: #6f4b00;
  font-size: 14px;
}
.story-result__supplement-task > div {
  min-width: 0;
}
.story-result__supplement-task p {
  margin: 0;
  color: #705c2d;
  font-size: 13px;
  line-height: 1.5;
}
.story-result__supplement-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 5px;
}
.story-result__supplement-meta span {
  padding: 2px 6px;
  border-radius: 4px;
  background: #f7e8c4;
  color: #72510c;
  font-size: 12px;
}
.story-result__supplement-prompt {
  margin-top: 4px !important;
}
.story-result__supplement-textarea {
  width: 100%;
  min-height: 82px;
  margin-top: 8px;
  padding: 8px;
  border: 1px solid #e6c982;
  border-radius: 5px;
  resize: vertical;
  color: #3f3420;
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
}
.story-result__supplement-note {
  margin-top: 6px !important;
  padding: 7px 8px;
  border-radius: 5px;
  background: #fff5d6;
}
.story-result__supplement-status {
  padding: 3px 7px;
  border-radius: 4px;
  background: #f0c36b;
  color: #4e3600;
  font-size: 12px;
  font-weight: 700;
}
.story-result__supplement-action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* Quality report */
.story-result__blueprint p {
  margin: 0 0 8px;
  color: #34495e;
  font-size: 14px;
  line-height: 1.5;
}
.story-result__quality {
  padding: 10px 14px;
  border-radius: 6px;
  margin: 0;
}
.story-result__quality--pass { background: #d5f5e3; border: 1px solid #27ae60; }
.story-result__quality--fail { background: #fef9e7; border: 1px solid #f39c12; }
.story-result__quality p { margin: 0; font-size: 14px; }
.story-result__quality-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.story-result__quality-summary article {
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.65);
  padding: 8px 10px;
}
.story-result__quality-summary span {
  display: block;
  color: #6b7884;
  font-size: 12px;
}
.story-result__quality-summary strong {
  display: block;
  margin-top: 3px;
  color: #2c3e50;
  font-size: 16px;
}
.story-result__quality-score {
  margin-top: 6px !important;
  color: #2c3e50;
  font-weight: 600;
}
.story-result__quality-issues {
  padding-left: 18px;
  margin: 6px 0 0;
  font-size: 13px;
  color: #c0392b;
}
.story-result__quality-actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  color: #6f4b00;
  font-size: 13px;
}
.story-result__quality-actions ul {
  margin: 4px 0 0;
  padding-left: 18px;
}
.story-result__inline-scene-btn {
  border: 1px solid #d7dee5;
  border-radius: 4px;
  background: #fff;
  color: #2f6f9f;
  cursor: pointer;
  padding: 2px 6px;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
}
.story-result__inline-scene-btn:hover {
  background: #eef6fb;
}

@media (max-width: 760px) {
  .story-result__quality-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
