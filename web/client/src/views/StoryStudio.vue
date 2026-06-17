<template>
  <div class="story-studio">
    <!-- Left panel: controls -->
    <aside class="story-studio__left">
      <h2 class="story-studio__page-title">视频方案工坊</h2>

      <!-- Input mode tabs -->
      <div class="story-studio__mode-tabs">
        <button
          class="story-studio__mode-tab"
          :class="{ 'story-studio__mode-tab--active': inputMode === 'entry' }"
          @click="switchMode('entry')"
        >词条模式</button>
        <button
          class="story-studio__mode-tab"
          :class="{ 'story-studio__mode-tab--active': inputMode === 'theme' }"
          @click="switchMode('theme')"
        >主题模式</button>
        <button
          class="story-studio__mode-tab"
          :class="{ 'story-studio__mode-tab--active': inputMode === 'outline' }"
          @click="switchMode('outline')"
        >故事大纲模式</button>
        <button
          class="story-studio__mode-tab"
          :class="{ 'story-studio__mode-tab--active': inputMode === 'novel' }"
          @click="switchMode('novel')"
        >小说改编模式</button>
      </div>

      <!-- ===== ENTRY MODE ===== -->
      <div v-if="inputMode === 'entry'" class="story-studio__field">
        <label class="story-studio__label" for="entry-search">创作主题 / 词条搜索</label>
        <div class="story-studio__search-row">
          <input
            id="entry-search"
            v-model="entrySearchQuery"
            class="story-studio__input"
            placeholder="输入创作主题或词条关键词，如 周敦颐拒签冤案故事、湖南非遗宣传片"
            @input="handleEntrySearchDebounced"
          />
          <button class="btn btn--search" @click="handleAutoMatch" :disabled="!entrySearchQuery.trim() || matching">
            {{ matching ? '匹配中…' : '自动匹配' }}
          </button>
        </div>

        <!-- Selected entry display -->
        <div v-if="selectedEntry" class="story-studio__selected-entry">
          <div v-if="autoMatchLabel" class="story-studio__auto-match-label">{{ autoMatchLabel }}</div>
          <div class="story-studio__selected-header">
            <span class="story-studio__selected-badge">{{ selectedEntry.type }}</span>
            <strong class="story-studio__selected-name">{{ selectedEntry.name }}</strong>
            <button class="story-studio__clear-btn" @click="clearSelectedEntry" title="取消选择">✕</button>
          </div>
          <p class="story-studio__selected-meta">{{ selectedEntry.province }} · {{ selectedEntry.region }}</p>
          <p class="story-studio__selected-summary">{{ selectedEntry.summary }}</p>
        </div>

        <!-- Match results -->
        <div v-if="matchResult && !selectedEntry" class="story-studio__search-results">
          <p class="story-studio__search-hint">
            {{ matchResult.matches.length > 0
              ? `为"${matchResult.query}"找到 ${matchResult.matches.length} 个相关词条：`
              : matchResult.fallback_message || '未找到相关词条' }}
          </p>
          <div
            v-for="m in matchResult.matches"
            :key="m.entry_name"
            class="story-studio__search-item"
            :class="{ 'story-studio__search-item--best': m.usable_for_story }"
            @click="handleSelectMatch(m)"
          >
            <div class="story-studio__search-item-header">
              <span class="story-studio__search-type">{{ m.type }}</span>
              <span class="story-studio__match-score">{{ (m.score * 100).toFixed(0) }}%匹配</span>
            </div>
            <strong class="story-studio__search-name">{{ m.entry_name }}</strong>
            <p class="story-studio__search-meta">{{ m.province }} · 匹配原因：{{ m.match_reason }}</p>
            <button
              class="btn btn--select-entry"
              :class="{ 'btn--select-entry--best': m.usable_for_story }"
            >
              {{ m.usable_for_story ? '✅ 选择此词条（推荐）' : '⭕ 选择此词条' }}
            </button>
          </div>
        </div>

        <div v-if="!selectedEntry && !matchResult && !matching" class="story-studio__entry-hint">
          <p>输入创作主题或词条关键词，点击"自动匹配"找到知识库中最相关的词条。</p>
        </div>
      </div>

      <div class="story-studio__field">
        <label class="story-studio__label" for="localized-target-region">甲方指定地域</label>
        <div class="story-studio__localization-grid">
          <input
            id="localized-target-region"
            v-model="localizedTargetRegion"
            class="story-studio__input"
            placeholder="如 长沙、岳麓、道县"
          />
          <select v-model="localizationMode" class="story-studio__select">
            <option value="allow_related_influence">可用思想影响</option>
            <option value="strict_direct_events">只要直接事件</option>
          </select>
        </div>
      </div>

      <!-- ===== THEME / OUTLINE MODE ===== -->
      <div v-if="inputMode === 'theme' || inputMode === 'outline' || inputMode === 'novel'" class="story-studio__field">
        <label class="story-studio__label" for="outline-input">
          {{ inputMode === 'novel' ? '小说原文 / 改编素材' : inputMode === 'outline' ? '故事大纲' : '创作主题' }}
        </label>
        <textarea
          id="outline-input"
          v-model="outlineText"
          class="story-studio__textarea"
          :rows="inputMode === 'novel' ? 10 : inputMode === 'outline' ? 6 : 3"
          :placeholder="inputMode === 'novel'
            ? '粘贴你已有小说、章节片段或完整故事。系统会保留原作主线，做视频化改编、分镜拆解和 GEARS 供稿，不会另写一篇新小说。'
            : inputMode === 'outline'
            ? '输入故事大纲，如：我想写一个毛泽东少年时期到革命觉醒的故事，重点表现湖南乡土、求学、新民学会、农民运动、理想形成。'
            : '输入创作主题，如：周敦颐南安拒签冤案故事'"
        />

        <div class="story-studio__outline-actions">
          <button
            class="btn btn--search"
            @click="handleAnalyzeOutline"
            :disabled="!outlineText.trim() || analyzingOutline"
          >
            {{ analyzingOutline ? '分析中…' : '分析大纲' }}
          </button>
          <button
            v-if="outlineAnalysis"
            class="btn btn--search"
            @click="handleMultiMatch"
            :disabled="matchingMulti || !outlineAnalysis"
          >
            {{ matchingMulti ? '匹配中…' : '匹配知识内容' }}
          </button>
        </div>
      </div>

      <!-- ===== OUTLINE ANALYSIS RESULTS ===== -->
      <div v-if="outlineAnalysis" class="story-studio__analysis">
        <h4 class="story-studio__analysis-title">大纲分析结果</h4>
        <div class="story-studio__analysis-items">
          <p v-if="outlineAnalysis.story_intent.main_character">
            <strong>主人公：</strong>{{ outlineAnalysis.story_intent.main_character }}
          </p>
          <p v-if="outlineAnalysis.story_intent.time_range">
            <strong>时代：</strong>{{ outlineAnalysis.story_intent.time_range }}
          </p>
          <p>
            <strong>核心主题：</strong>{{ outlineAnalysis.story_intent.core_theme }}
          </p>
          <p v-if="outlineAnalysis.story_intent.conflict_keywords.length > 0">
            <strong>冲突关键词：</strong>{{ outlineAnalysis.story_intent.conflict_keywords.join('、') }}
          </p>
          <p v-if="outlineAnalysis.story_intent.target_emotion.length > 0">
            <strong>目标情绪：</strong>{{ outlineAnalysis.story_intent.target_emotion.join('、') }}
          </p>
          <div v-if="outlineAnalysis.detected_characters?.length" class="story-studio__detected-characters">
            <strong>识别角色：</strong>
            <div class="story-studio__character-chips">
              <span
                v-for="character in outlineAnalysis.detected_characters"
                :key="`${character.character_kind}-${character.name}`"
                class="story-studio__character-chip"
              >
                {{ character.name }} · {{ character.role_position }} · {{ characterKindLabel(character.character_kind) }}
              </span>
            </div>
          </div>
          <div v-if="outlineAnalysis.knowledge_needs.length > 0" class="story-studio__knowledge-needs">
            <strong>知识需求：</strong>
            <ul>
              <li v-for="need in outlineAnalysis.knowledge_needs" :key="need.need_id">
                {{ need.label }}（{{ need.keywords.join('、') }}）{{ need.required ? '✅ 必需' : '⭕ 可选' }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- ===== KNOWLEDGE PACK DISPLAY ===== -->
      <div v-if="knowledgePack" class="story-studio__knowledge-pack">
        <h4 class="story-studio__kp-title">知识组合包</h4>

        <!-- Primary entries -->
        <div v-if="knowledgePack.primary_entries.length > 0" class="story-studio__kp-section">
          <h5 class="story-studio__kp-section-title story-studio__kp-section-title--primary">主依据条目</h5>
          <div
            v-for="entry in knowledgePack.primary_entries"
            :key="entry.entry_name"
            class="story-studio__kp-entry story-studio__kp-entry--primary"
          >
            <input
              type="checkbox"
              v-model="selectedPrimaryEntries"
              :value="entry.entry_name"
              class="story-studio__kp-checkbox"
            />
            <div class="story-studio__kp-entry-content">
              <span class="story-studio__kp-score">{{ (entry.score * 100).toFixed(0) }}%</span>
              <strong>{{ entry.entry_name }}</strong>
              <span class="story-studio__kp-type">{{ entry.type }}</span>
              <div class="story-studio__kp-tags">
                <span v-if="entry.knowledge_domain" class="story-studio__kp-tag">{{ knowledgeDomainLabel(entry.knowledge_domain) }}</span>
                <span v-if="entry.era" class="story-studio__kp-tag">{{ entry.era }}</span>
                <span v-for="usage in entry.asset_usage ?? []" :key="usage" class="story-studio__kp-tag">{{ assetUsageLabel(usage) }}</span>
              </div>
              <p class="story-studio__kp-region">{{ entry.province }} · {{ entry.region }}</p>
              <p class="story-studio__kp-reason">匹配原因：{{ entry.match_reason }}</p>
              <p v-if="entry.summary" class="story-studio__kp-summary">{{ entry.summary.substring(0, 60) }}…</p>
            </div>
          </div>
        </div>

        <!-- Supporting entries -->
        <div v-if="knowledgePack.supporting_entries.length > 0" class="story-studio__kp-section">
          <h5 class="story-studio__kp-section-title story-studio__kp-section-title--supporting">辅助条目</h5>
          <div
            v-for="entry in knowledgePack.supporting_entries"
            :key="entry.entry_name"
            class="story-studio__kp-entry story-studio__kp-entry--supporting"
          >
            <input
              type="checkbox"
              v-model="selectedSupportingEntries"
              :value="entry.entry_name"
              class="story-studio__kp-checkbox"
            />
            <div class="story-studio__kp-entry-content">
              <span class="story-studio__kp-score">{{ (entry.score * 100).toFixed(0) }}%</span>
              <strong>{{ entry.entry_name }}</strong>
              <span class="story-studio__kp-type">{{ entry.type }}</span>
              <div class="story-studio__kp-tags">
                <span v-if="entry.knowledge_domain" class="story-studio__kp-tag">{{ knowledgeDomainLabel(entry.knowledge_domain) }}</span>
                <span v-if="entry.era" class="story-studio__kp-tag">{{ entry.era }}</span>
                <span v-for="usage in entry.asset_usage ?? []" :key="usage" class="story-studio__kp-tag">{{ assetUsageLabel(usage) }}</span>
              </div>
              <p class="story-studio__kp-region">{{ entry.province }} · {{ entry.region }}</p>
              <p class="story-studio__kp-reason">匹配原因：{{ entry.match_reason }}</p>
            </div>
          </div>
        </div>

        <!-- Missing needs -->
        <div v-if="knowledgePack.missing_needs.length > 0" class="story-studio__kp-section">
          <h5 class="story-studio__kp-section-title story-studio__kp-section-title--missing">缺失资料</h5>
          <div v-for="missing in knowledgePack.missing_needs" :key="missing.need_id" class="story-studio__kp-missing">
            <p>⚠️ {{ missing.label }}：{{ missing.message }}</p>
          </div>
        </div>

        <p class="story-studio__kp-confidence">
          总体置信度：{{ (knowledgePack.overall_confidence * 100).toFixed(0) }}%
        </p>
      </div>

      <!-- Preview button (entry mode only) -->
      <button
        v-if="inputMode === 'entry'"
        class="btn btn--primary"
        @click="handlePlan"
        :disabled="!selectedEntry || planning"
      >
        {{ planning ? '正在预览…' : '预览推荐' }}
      </button>

      <!-- Plan result -->
      <StoryPlan
        v-if="planResult"
        :plan="planResult"
        :selected-type="selectedType"
        :selected-event="selectedEvent"
        :selected-video-type="selectedVideoType"
        @select-type="handleSelectType"
        @select-event="handleSelectEvent"
        @select-video-type="handleSelectVideoType"
      />

      <div v-if="planError" class="story-studio__error">{{ planError }}</div>

      <!-- Video type selector (grouped) — always visible -->
      <section class="story-studio__field">
        <label class="story-studio__label">成片类型</label>
        <div class="story-studio__vt-cards story-studio__vt-cards--common">
          <div
            v-for="vt in commonVideoTypes"
            :key="vt.id"
            class="story-studio__vt-card"
            :class="{
              'story-studio__vt-card--selected': selectedVideoType === vt.id,
              'story-studio__vt-card--recommended': isRecommendedVideoType(vt.id),
            }"
            @click="handleSelectVideoType(vt.id)"
          >
            <span class="story-studio__vt-badge">{{ isRecommendedVideoType(vt.id) ? '推荐' : '常用' }}</span>
            <span class="story-studio__vt-name">{{ vt.label }}</span>
            <span class="story-studio__vt-desc">{{ vt.description }}</span>
            <span class="story-studio__vt-duration">{{ vt.default_duration }}</span>
          </div>
        </div>

        <details class="story-studio__more-types">
          <summary class="story-studio__more-types-summary">更多成片类型</summary>
          <div v-for="group in additionalVideoTypeGroups" :key="group.name" class="story-studio__vt-group">
            <h5 class="story-studio__vt-group-name">{{ group.name }}</h5>
            <div class="story-studio__vt-cards">
              <div
                v-for="vt in group.types"
                :key="vt.id"
                class="story-studio__vt-card"
                :class="{
                  'story-studio__vt-card--selected': selectedVideoType === vt.id,
                  'story-studio__vt-card--recommended': isRecommendedVideoType(vt.id),
                }"
                @click="handleSelectVideoType(vt.id)"
              >
                <span class="story-studio__vt-badge">{{ isRecommendedVideoType(vt.id) ? '推荐' : '可选' }}</span>
                <span class="story-studio__vt-name">{{ vt.label }}</span>
                <span class="story-studio__vt-desc">{{ vt.description }}</span>
                <span class="story-studio__vt-duration">{{ vt.default_duration }}</span>
              </div>
            </div>
          </div>
        </details>
      </section>

      <details class="story-studio__advanced-panel">
        <summary class="story-studio__advanced-summary">生成设置</summary>

        <section v-if="selectedVideoType && availableNarrativePatterns.length > 0" class="story-studio__field">
          <label class="story-studio__label">叙事流派强化</label>
          <p class="story-studio__field-hint">默认会使用该成片类型的流派机制；勾选后会在生成中加强对应叙事引擎。</p>
          <div class="story-studio__pattern-list">
            <label
              v-for="pattern in availableNarrativePatterns"
              :key="pattern.pattern_id"
              class="story-studio__pattern-card"
              :class="{ 'story-studio__pattern-card--selected': selectedNarrativePatternIds.includes(pattern.pattern_id) }"
            >
              <input
                v-model="selectedNarrativePatternIds"
                type="checkbox"
                :value="pattern.pattern_id"
              />
              <span class="story-studio__pattern-main">
                <strong>{{ pattern.label }}</strong>
                <span>{{ pattern.user_facing_summary || pattern.narrative_engine }}</span>
                <span v-if="pattern.subgenre_tags?.length" class="story-studio__pattern-tags">
                  <em v-for="tag in pattern.subgenre_tags.slice(0, 4)" :key="tag">{{ tag }}</em>
                </span>
                <span v-if="pattern.style_axes?.length" class="story-studio__pattern-axes">
                  <em v-for="axis in pattern.style_axes.slice(0, 3)" :key="axis.axis_id">
                    {{ axis.label }} {{ styleAxisValueLabel(axis.value) }}
                  </em>
                </span>
              </span>
            </label>
          </div>
        </section>

        <!-- Presentation style selector -->
        <section v-if="selectedVideoType" class="story-studio__field">
          <label class="story-studio__label" for="presentation-style">表现形式</label>
          <select id="presentation-style" v-model="selectedPresentationStyle" class="story-studio__select">
            <option
              v-for="ps in presentationStyleOptions"
              :key="ps.id"
              :value="ps.id"
            >
              {{ ps.label }} — {{ ps.description }}
            </option>
          </select>
        </section>

        <section class="story-studio__field">
          <label class="story-studio__label" for="model-profile">创作模型</label>
          <select id="model-profile" v-model="selectedModelProfileId" class="story-studio__select">
            <option v-for="profile in modelProfiles" :key="profile.id" :value="profile.id">
              {{ profile.label }}{{ profile.recommended ? '（推荐）' : '' }}
            </option>
          </select>
          <p v-if="selectedModelProfile" class="story-studio__field-hint">{{ selectedModelProfile.description }}</p>
        </section>

        <!-- Duration select -->
        <div class="story-studio__field">
          <label class="story-studio__label" for="duration">目标时长</label>
          <select id="duration" v-model="targetDuration" class="story-studio__select">
            <option value="30秒">30秒</option>
            <option value="1分钟">1分钟</option>
            <option value="3分钟">3分钟</option>
            <option value="5分钟">5分钟</option>
            <option value="8分钟">8分钟</option>
            <option value="10分钟">10分钟</option>
            <option value="15分钟">15分钟</option>
            <option value="20分钟">20分钟</option>
          </select>
        </div>

        <!-- Tone input -->
        <div class="story-studio__field">
          <label class="story-studio__label" for="tone">叙事风格</label>
          <input
            id="tone"
            v-model="tone"
            class="story-studio__input"
            placeholder="如：庄重、抒情、诙谐（可选）"
          />
        </div>

        <section class="story-studio__field story-studio__advanced">
          <label class="story-studio__label" for="genre-strictness">类型结构强度</label>
          <select id="genre-strictness" v-model="genreStrictness" class="story-studio__select">
            <option value="balanced">均衡</option>
            <option value="strict">严格</option>
            <option value="loose">宽松</option>
          </select>
          <label class="story-studio__label" for="story-priority">生成优先级</label>
          <select id="story-priority" v-model="storyPriority" class="story-studio__select">
            <option value="balanced">剧情与资料均衡</option>
            <option value="plot_first">优先剧情完整</option>
            <option value="knowledge_first">优先资料完整</option>
          </select>
          <label class="story-studio__checkbox-row">
            <input v-model="autoRepair" type="checkbox" />
            <span>生成后自动修复类型质量问题</span>
          </label>
        </section>
      </details>

      <!-- Generate button -->
      <button
        class="btn btn--primary btn--generate"
        @click="handleGenerate"
        :disabled="!canGenerate || generating"
      >
        {{ generating ? '正在生成…' : '生成剧情方案' }}
      </button>

      <div v-if="!canGenerate && selectedVideoType && !hasAnyEntrySource" class="story-studio__generate-hint">
        {{ inputMode === 'entry' ? '请先从知识库搜索结果中选择一个词条。' : '请先分析大纲并匹配知识内容，至少选择1个主依据条目。' }}
      </div>

      <div v-if="generateError" class="story-studio__error">{{ generateError }}</div>
    </aside>

    <!-- Right panel: result -->
    <main class="story-studio__right">
      <div v-if="generating" class="story-studio__loading">
        <div class="story-studio__spinner" />
        <p class="story-studio__loading-text">正在生成剧情方案，请稍候…</p>
      </div>

      <div v-else-if="generateError && !generateResult" class="story-studio__result-error">
        <h3>生成失败</h3>
        <p>{{ generateError }}</p>
      </div>

      <div v-else-if="generateResult">
        <div v-if="generateResult.project_id" class="story-studio__result-actions">
          <RouterLink class="story-studio__result-link" :to="`/projects/${generateResult.project_id}`">
            打开当前故事
          </RouterLink>
          <RouterLink class="story-studio__result-link story-studio__result-link--secondary" to="/projects">
            管理故事
          </RouterLink>
        </div>
        <StoryResult :result="generateResult" />
      </div>

      <div v-else class="story-studio__empty">
        <div class="story-studio__empty-copy">
          <p>选择词条、输入大纲，然后生成剧情方案。</p>
          <p class="story-studio__hint">结果将在此处展示。</p>
        </div>

        <section class="story-studio__recent" aria-labelledby="recent-story-projects-title">
          <div class="story-studio__recent-head">
            <div>
              <h3 id="recent-story-projects-title">最近故事</h3>
              <p>{{ recentStoryProjects.length }} 个故事草稿</p>
            </div>
            <RouterLink class="story-studio__recent-manage" to="/projects">选择 / 删除</RouterLink>
          </div>

          <div v-if="recentStoryProjectsLoading" class="story-studio__recent-state">正在加载…</div>
          <div v-else-if="recentStoryProjectsError" class="story-studio__recent-state story-studio__recent-state--error">
            {{ recentStoryProjectsError }}
          </div>
          <template v-else>
            <div v-if="recentStoryProjectsMessage" class="story-studio__recent-state story-studio__recent-state--success">
              {{ recentStoryProjectsMessage }}
            </div>
            <div v-if="recentStoryPreview.length > 0" class="story-studio__recent-list">
              <article
                v-for="project in recentStoryPreview"
                :key="project.project_id"
                class="story-studio__recent-item"
              >
                <RouterLink class="story-studio__recent-link" :to="`/projects/${project.project_id}`">
                  <span class="story-studio__recent-title">{{ project.title }}</span>
                  <span class="story-studio__recent-meta">
                    {{ videoTypeLabel(project.video_type) }} · {{ formatStoryProjectDate(project.updated_at) }}
                  </span>
                </RouterLink>
                <button
                  class="story-studio__recent-delete"
                  :disabled="deletingRecentProjectId === project.project_id"
                  @click="handleDeleteRecentStory(project)"
                >
                  {{ deletingRecentProjectId === project.project_id ? '删除中…' : '删除' }}
                </button>
              </article>
            </div>
            <div v-else class="story-studio__recent-state">暂无故事草稿</div>
          </template>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storyPlan, storyGenerate, storyOutlineAnalyze } from '@/api/stories'
import { searchEntries, matchEntries, entriesMultiMatch } from '@/api/entries'
import { getModelProfiles, getNarrativePatternCatalog } from '@/api/system'
import { deleteProject, listProjects } from '@/api/projects'
import type {
  AIModelProfile,
  EntrySearchResult,
  EntryMatchResult,
  EntryMatchItem,
  StoryPlanResult,
  StoryGenerateResult,
  GenerationType,
  VideoType,
  PresentationStyle,
  SupportedDuration,
  VideoTypeGroup,
  VideoTypeMeta,
  PresentationStyleMeta,
  StoryOutlineAnalysis,
  KnowledgePack,
  KnowledgeNeed,
  KnowledgePackEntry,
  KnowledgeDomain,
  KnowledgeAssetUsage,
  NarrativePattern,
  NarrativePatternCatalog,
  NarrativePatternId,
  StoryDetectedCharacterKind,
  GenreStrictness,
  StoryGenerationPriority,
  LocalizationMode,
  StoryProjectListItem,
} from '@shared/types'
import { VIDEO_TYPE_CONFIG, PRESENTATION_STYLE_CONFIG, GENERATION_TO_VIDEO_TYPE } from '@shared/types'
import StoryPlan from '@/components/StoryPlan.vue'
import StoryResult from '@/components/StoryResult.vue'

const route = useRoute()
const MODEL_PROFILE_STORAGE_KEY = 'story-agent.model-profile-id'

const KNOWLEDGE_DOMAIN_LABELS: Record<KnowledgeDomain, string> = {
  core_china_culture: '主库',
  era_setting: '朝代设定',
  regional_culture: '地域文化',
  folklore_zhiyi: '志异传说',
  gears_asset: 'GEARS资产',
  narrative_pattern: '叙事模式',
  character_archetype: '人物原型',
  conflict_pattern: '冲突模式',
  visual_style_pack: '视觉风格',
  safety_rule: '安全规则',
  source_pack: '来源包',
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
  plot_structure: '剧情结构',
  character_arc: '人物弧线',
  conflict_engine: '冲突机制',
  visual_style: '视觉风格',
  safety_boundary: '安全边界',
  source_grounding: '来源依据',
}

const CHARACTER_KIND_LABELS: Record<StoryDetectedCharacterKind, string> = {
  named_person: '具名人物',
  identity_role: '身份角色',
  group_role: '群体角色',
  supernatural_role: '志异异类',
}

const COMMON_VIDEO_TYPE_IDS: VideoType[] = [
  'ai_comic_drama',
  'character_story',
  'culture_promo',
  'documentary_short',
  'scene_short',
]

function knowledgeDomainLabel(domain: KnowledgeDomain) {
  return KNOWLEDGE_DOMAIN_LABELS[domain] ?? domain
}

function assetUsageLabel(usage: KnowledgeAssetUsage) {
  return ASSET_USAGE_LABELS[usage] ?? usage
}

function characterKindLabel(kind: StoryDetectedCharacterKind) {
  return CHARACTER_KIND_LABELS[kind] ?? kind
}

// --- Input mode ---
type InputMode = 'entry' | 'theme' | 'outline' | 'novel'
const inputMode = ref<InputMode>('entry')

function switchMode(mode: InputMode) {
  inputMode.value = mode
  // Clear state on mode switch
  if (mode === 'entry') {
    outlineText.value = ''
    outlineAnalysis.value = null
    knowledgePack.value = null
    selectedPrimaryEntries.value = []
    selectedSupportingEntries.value = []
  } else {
    selectedEntry.value = null
    matchResult.value = null
    autoMatchLabel.value = ''
    planResult.value = null
  }
  generateResult.value = null
  generateError.value = ''
}

// --- Entry mode state ---
const entrySearchQuery = ref('')
const selectedEntry = ref<EntrySearchResult | null>(null)
const originalUserQuery = ref('')
const entrySearchResults = ref<EntrySearchResult[]>([])
const entrySearchLoading = ref(false)
const entrySearchNoResults = ref(false)
const matching = ref(false)
const matchResult = ref<EntryMatchResult | null>(null)
const autoMatchLabel = ref('')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// --- Outline mode state ---
const outlineText = ref('')
const analyzingOutline = ref(false)
const outlineAnalysis = ref<StoryOutlineAnalysis | null>(null)
const matchingMulti = ref(false)
const knowledgePack = ref<KnowledgePack | null>(null)
const selectedPrimaryEntries = ref<string[]>([])
const selectedSupportingEntries = ref<string[]>([])

// --- Common state ---
const selectedType = ref<GenerationType | null>(null)
const selectedVideoType = ref<VideoType | null>(null)
const selectedPresentationStyle = ref<PresentationStyle | null>(null)
const modelProfiles = ref<AIModelProfile[]>([])
const narrativePatternCatalog = ref<NarrativePatternCatalog | null>(null)
const selectedNarrativePatternIds = ref<NarrativePatternId[]>([])
const selectedModelProfileId = ref('')
const selectedEvent = ref<string | null>(null)
const targetDuration = ref<SupportedDuration>('3分钟')
const tone = ref('')
const genreStrictness = ref<GenreStrictness>('balanced')
const storyPriority = ref<StoryGenerationPriority>('balanced')
const localizedTargetRegion = ref('')
const localizationMode = ref<LocalizationMode>('allow_related_influence')
const autoRepair = ref(false)
const planning = ref(false)
const generating = ref(false)
const planResult = ref<StoryPlanResult | null>(null)
const generateResult = ref<StoryGenerateResult | null>(null)
const planError = ref('')
const generateError = ref('')
const recentStoryProjects = ref<StoryProjectListItem[]>([])
const recentStoryProjectsLoading = ref(false)
const recentStoryProjectsError = ref('')
const recentStoryProjectsMessage = ref('')
const deletingRecentProjectId = ref('')

const hasAnyEntrySource = computed(() => {
  if (inputMode.value === 'entry') return !!selectedEntry.value
  if (inputMode.value === 'novel') return !!outlineText.value.trim()
  return selectedPrimaryEntries.value.length > 0
})

const canGenerate = computed(() => {
  if (inputMode.value === 'entry') {
    return selectedEntry.value && (selectedVideoType.value || selectedType.value)
  }
  if (inputMode.value === 'novel') {
    return outlineText.value.trim().length > 0 && (selectedVideoType.value || selectedType.value)
  }
  return selectedPrimaryEntries.value.length > 0 && (selectedVideoType.value || selectedType.value)
})

function groupVideoTypes(types: VideoTypeMeta[]) {
  const groups: { name: VideoTypeGroup; types: VideoTypeMeta[] }[] = []
  const seen = new Set<VideoTypeGroup>()
  for (const vt of types) {
    if (!seen.has(vt.group)) {
      seen.add(vt.group)
      groups.push({ name: vt.group, types: [] })
    }
    groups.find(g => g.name === vt.group)?.types.push(vt)
  }
  return groups
}

const commonVideoTypes = computed(() => {
  return COMMON_VIDEO_TYPE_IDS
    .map(id => VIDEO_TYPE_CONFIG[id])
    .filter((meta): meta is VideoTypeMeta => Boolean(meta))
})

// --- VideoType group computed ---
const additionalVideoTypeGroups = computed(() => {
  const commonIds = new Set(COMMON_VIDEO_TYPE_IDS)
  return groupVideoTypes(Object.values(VIDEO_TYPE_CONFIG).filter(vt => !commonIds.has(vt.id)))
})

const presentationStyleOptions = computed(() => {
  return Object.values(PRESENTATION_STYLE_CONFIG)
})

const selectedModelProfile = computed(() => {
  return modelProfiles.value.find(profile => profile.id === selectedModelProfileId.value) ?? null
})

const availableNarrativePatterns = computed<NarrativePattern[]>(() => {
  if (!selectedVideoType.value || !narrativePatternCatalog.value) return []
  const patternIds = narrativePatternCatalog.value.video_type_map[selectedVideoType.value] ?? []
  return patternIds
    .map(patternId => narrativePatternCatalog.value?.patterns.find(pattern => pattern.pattern_id === patternId))
    .filter((pattern): pattern is NarrativePattern => Boolean(pattern))
})

const recentStoryPreview = computed(() => recentStoryProjects.value.slice(0, 5))

function styleAxisValueLabel(value: 'low' | 'medium' | 'high') {
  if (value === 'high') return '高'
  if (value === 'low') return '低'
  return '中'
}

function isRecommendedVideoType(vtId: VideoType): boolean {
  if (!planResult.value) return false
  const recommended = planResult.value.recommended_video_types
  if (recommended.length === 0) return false
  return recommended[0].video_type === vtId
}

function videoTypeLabel(type: VideoType): string {
  return VIDEO_TYPE_CONFIG[type]?.label ?? type
}

function formatStoryProjectDate(iso: string): string {
  if (!iso) return '未记录'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '未记录'
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function storyProjectTime(project: StoryProjectListItem): number {
  const time = Date.parse(project.updated_at)
  return Number.isNaN(time) ? 0 : time
}

async function loadRecentStoryProjects() {
  recentStoryProjectsLoading.value = true
  recentStoryProjectsError.value = ''
  recentStoryProjectsMessage.value = ''
  const res = await listProjects()
  if (res.ok && res.data) {
    recentStoryProjects.value = [...res.data].sort((a, b) => {
      return storyProjectTime(b) - storyProjectTime(a)
    })
  } else {
    recentStoryProjectsError.value = res.error?.message ?? '加载最近故事失败'
  }
  recentStoryProjectsLoading.value = false
}

async function handleDeleteRecentStory(project: StoryProjectListItem) {
  const confirmed = window.confirm(`确定删除《${project.title}》吗？这会删除生成故事文件和项目版本记录。`)
  if (!confirmed) return

  deletingRecentProjectId.value = project.project_id
  recentStoryProjectsError.value = ''
  recentStoryProjectsMessage.value = ''
  const res = await deleteProject(project.project_id)
  if (res.ok && res.data) {
    recentStoryProjects.value = recentStoryProjects.value.filter(item => item.project_id !== project.project_id)
    recentStoryProjectsMessage.value = `已删除《${project.title}》，清理 ${res.data.removed_story_file_count ?? 0} 个关联故事文件`
  } else {
    recentStoryProjectsError.value = res.error?.message ?? '删除最近故事失败'
  }
  deletingRecentProjectId.value = ''
}

// --- Entry search handlers ---
function handleEntrySearchDebounced() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    if (entrySearchQuery.value.trim()) {
      handleEntrySearch()
    } else {
      entrySearchResults.value = []
      entrySearchNoResults.value = false
    }
  }, 400)
}

async function handleEntrySearch() {
  const query = entrySearchQuery.value.trim()
  if (!query) return
  entrySearchLoading.value = true
  entrySearchNoResults.value = false
  entrySearchResults.value = []
  const res = await searchEntries({ keywords: query })
  if (res.ok && res.data) {
    entrySearchResults.value = res.data
    entrySearchNoResults.value = res.data.length === 0
  } else {
    entrySearchResults.value = []
    entrySearchNoResults.value = true
  }
  entrySearchLoading.value = false
}

function handleSelectMatch(m: EntryMatchItem) {
  selectedEntry.value = {
    name: m.entry_name,
    province: m.province,
    region: '',
    type: m.type,
    summary: m.match_reason,
    keywords: [],
    credibility: '',
  }
  originalUserQuery.value = entrySearchQuery.value.trim()
  autoMatchLabel.value = m.usable_for_story
    ? `已自动匹配到：${m.entry_name}（匹配度 ${(m.score * 100).toFixed(0)}%）`
    : `已选择：${m.entry_name}（匹配度 ${(m.score * 100).toFixed(0)}%，请确认）`
  matchResult.value = null
  planResult.value = null
  planError.value = ''
  generateResult.value = null
  generateError.value = ''
}

async function handleAutoMatch() {
  const query = entrySearchQuery.value.trim()
  if (!query) return
  matching.value = true
  matchResult.value = null
  const res = await matchEntries({ query, limit: 5 })
  if (res.ok && res.data) {
    matchResult.value = res.data
    if (res.data.best_match && res.data.best_match.score >= 0.75) {
      handleSelectMatch(res.data.best_match)
    }
  } else {
    planError.value = res.error?.message ?? '自动匹配失败'
  }
  matching.value = false
}

function clearSelectedEntry() {
  selectedEntry.value = null
  originalUserQuery.value = ''
  autoMatchLabel.value = ''
  planResult.value = null
  planError.value = ''
  generateResult.value = null
  generateError.value = ''
}

// --- Outline mode handlers ---
async function handleAnalyzeOutline() {
  const text = outlineText.value.trim()
  if (!text) return
  analyzingOutline.value = true
  planError.value = ''
  const res = await storyOutlineAnalyze({
    outline: text,
    preferred_video_types: selectedVideoType.value ? [selectedVideoType.value] : undefined,
    target_video_duration: targetDuration.value,
    localized_target_region: localizedTargetRegion.value.trim() || undefined,
  })
  if (res.ok && res.data) {
    outlineAnalysis.value = res.data
    knowledgePack.value = null
    selectedPrimaryEntries.value = []
    selectedSupportingEntries.value = []
  } else {
    planError.value = res.error?.message ?? '大纲分析失败'
  }
  analyzingOutline.value = false
}

async function handleMultiMatch() {
  if (!outlineAnalysis.value) return
  matchingMulti.value = true
  planError.value = ''
  const res = await entriesMultiMatch({
    outline: outlineText.value.trim(),
    knowledge_needs: outlineAnalysis.value.knowledge_needs,
    limit_per_need: 5,
    localized_target_region: localizedTargetRegion.value.trim() || undefined,
    localization_mode: localizationMode.value,
  })
  if (res.ok && res.data) {
    knowledgePack.value = res.data.matched_knowledge_pack
    // Auto-select all primary entries
    selectedPrimaryEntries.value = res.data.matched_knowledge_pack.primary_entries.map(e => e.entry_name)
    // Auto-select all supporting entries
    selectedSupportingEntries.value = res.data.matched_knowledge_pack.supporting_entries.map(e => e.entry_name)
  } else {
    planError.value = res.error?.message ?? '知识匹配失败'
  }
  matchingMulti.value = false
}

// --- Init from route query ---
onMounted(async () => {
  void loadRecentStoryProjects()

  const modelRes = await getModelProfiles()
  if (modelRes.ok && modelRes.data && modelRes.data.length > 0) {
    modelProfiles.value = modelRes.data
    const storedModelId = localStorage.getItem(MODEL_PROFILE_STORAGE_KEY)
    const initialModel = modelRes.data.find(profile => profile.id === storedModelId)
      ?? modelRes.data.find(profile => profile.recommended)
      ?? modelRes.data[0]
    selectedModelProfileId.value = initialModel.id
  }

  const patternRes = await getNarrativePatternCatalog()
  if (patternRes.ok && patternRes.data) {
    narrativePatternCatalog.value = patternRes.data
  }

  const query = route.query.original_user_query as string | undefined
  if (query) {
    originalUserQuery.value = query
  }

  const entry = route.query.entry as string | undefined
  if (entry) {
    inputMode.value = 'entry'
    entrySearchQuery.value = entry
    const res = await searchEntries({ keywords: entry })
    if (res.ok && res.data) {
      const exactMatch = res.data.find(e => e.name === entry)
      if (exactMatch) selectedEntry.value = exactMatch
      else if (res.data.length > 0) selectedEntry.value = res.data[0]
      else planError.value = '知识库中没有找到该词条'
    }
  }

  const type = route.query.type as string | undefined
  if (type && Object.keys(VIDEO_TYPE_CONFIG).includes(type)) {
    selectedVideoType.value = type as VideoType
    selectedPresentationStyle.value = VIDEO_TYPE_CONFIG[type as VideoType].default_presentation_style
  }

  const vt = route.query.video_type as string | undefined
  if (vt && Object.keys(VIDEO_TYPE_CONFIG).includes(vt)) {
    selectedVideoType.value = vt as VideoType
    selectedPresentationStyle.value = VIDEO_TYPE_CONFIG[vt as VideoType].default_presentation_style
  }
})

watch(selectedModelProfileId, (value) => {
  if (value) {
    localStorage.setItem(MODEL_PROFILE_STORAGE_KEY, value)
  }
})

watch(selectedVideoType, () => {
  selectedNarrativePatternIds.value = []
})

// --- Handlers ---
async function handlePlan() {
  if (!selectedEntry.value) {
    planError.value = '请先从知识库搜索结果中选择一个词条。'
    return
  }
  planning.value = true
  planError.value = ''
  planResult.value = null
  const res = await storyPlan(selectedEntry.value.name, originalUserQuery.value || undefined)
  if (res.ok && res.data) {
    planResult.value = res.data
    if (!selectedType.value && res.data.recommended_types.length > 0) {
      selectedType.value = res.data.recommended_types[0].generation_type
    }
    if (!selectedVideoType.value && res.data.recommended_video_types.length > 0) {
      selectedVideoType.value = res.data.recommended_video_types[0].video_type
    }
    if (!selectedPresentationStyle.value && res.data.recommended_presentation_styles.length > 0) {
      selectedPresentationStyle.value = res.data.recommended_presentation_styles[0].presentation_style
    }
    targetDuration.value = res.data.recommended_duration
  } else {
    planError.value = res.error?.code === 'ENTRY_NOT_FOUND'
      ? '知识库中没有找到该词条'
      : res.error?.message ?? '预览推荐失败'
  }
  planning.value = false
}

function handleSelectType(type: GenerationType) {
  selectedType.value = type
  selectedVideoType.value = GENERATION_TO_VIDEO_TYPE[type] ?? type as VideoType
}

function handleSelectVideoType(vt: VideoType) {
  selectedVideoType.value = vt
  selectedPresentationStyle.value = VIDEO_TYPE_CONFIG[vt].default_presentation_style
}

function handleSelectEvent(event: string) {
  selectedEvent.value = event
}

async function handleGenerate() {
  if (!canGenerate.value) return
  generating.value = true
  generateError.value = ''
  generateResult.value = null

  const videoTypeToSend = selectedVideoType.value ?? selectedType.value ?? 'character_story'
  const generationTypeToSend = selectedType.value ?? (
    ['character_story', 'historical_drama', 'legend_story', 'ai_comic_drama', 'children_story'].includes(videoTypeToSend) ? 'character_story'
    : ['culture_promo', 'heritage_promo', 'city_brand_promo', 'social_short', 'documentary_short', 'explainer_video', 'lecture_video', 'education_training'].includes(videoTypeToSend) ? 'culture_promo'
    : 'scene_short'
  )
  const presentationStyleToSend = selectedPresentationStyle.value ?? VIDEO_TYPE_CONFIG[videoTypeToSend as VideoType]?.default_presentation_style ?? 'cinematic'

  if (inputMode.value === 'entry' && selectedEntry.value) {
    // Entry mode: single entry generation
    const res = await storyGenerate({
      entry_name: selectedEntry.value.name,
      original_user_query: originalUserQuery.value || undefined,
      generation_type: generationTypeToSend as GenerationType,
      video_type: videoTypeToSend as VideoType,
      model_profile_id: selectedModelProfileId.value || undefined,
      selected_event: selectedEvent.value ?? undefined,
      target_video_duration: targetDuration.value,
      tone: tone.value || undefined,
      presentation_style: presentationStyleToSend as PresentationStyle,
      output_gears_segments: true,
      genre_strictness: genreStrictness.value,
      story_priority: storyPriority.value,
      auto_repair: autoRepair.value,
      narrative_pattern_ids: selectedNarrativePatternIds.value.length > 0 ? selectedNarrativePatternIds.value : undefined,
      localized_target_region: localizedTargetRegion.value.trim() || undefined,
      localization_mode: localizationMode.value,
    })
    if (res.ok && res.data) {
      generateResult.value = res.data
      void loadRecentStoryProjects()
    } else {
      generateError.value = res.error?.code === 'ENTRY_NOT_FOUND'
        ? '知识库中没有找到该词条'
        : res.error?.message ?? '剧情方案生成失败'
    }
  } else if (inputMode.value === 'novel') {
    const filteredPack: KnowledgePack | undefined = knowledgePack.value
      ? {
          primary_entries: knowledgePack.value.primary_entries.filter(e => selectedPrimaryEntries.value.includes(e.entry_name)),
          supporting_entries: knowledgePack.value.supporting_entries.filter(e => selectedSupportingEntries.value.includes(e.entry_name)),
          missing_needs: knowledgePack.value.missing_needs,
          overall_confidence: knowledgePack.value.overall_confidence,
        }
      : undefined
    const primaryEntryName = filteredPack?.primary_entries[0]?.entry_name

    const res = await storyGenerate({
      entry_name: primaryEntryName,
      original_user_query: outlineText.value || undefined,
      generation_type: generationTypeToSend as GenerationType,
      video_type: videoTypeToSend as VideoType,
      model_profile_id: selectedModelProfileId.value || undefined,
      target_video_duration: targetDuration.value,
      tone: tone.value || undefined,
      presentation_style: presentationStyleToSend as PresentationStyle,
      output_gears_segments: true,
      outline: outlineText.value,
      knowledge_pack: filteredPack,
      character_hints: outlineAnalysis.value?.detected_characters ?? undefined,
      genre_strictness: genreStrictness.value,
      story_priority: storyPriority.value,
      auto_repair: autoRepair.value,
      source_material_mode: 'adapt_user_novel',
      localized_target_region: localizedTargetRegion.value.trim() || undefined,
      localization_mode: localizationMode.value,
      narrative_pattern_ids: selectedNarrativePatternIds.value.length > 0
        ? selectedNarrativePatternIds.value
        : ['source_fidelity_adaptation', 'chapter_slice_adaptation', 'novel_scene_compression', 'character_arc_adaptation'],
    })
    if (res.ok && res.data) {
      generateResult.value = res.data
      void loadRecentStoryProjects()
    } else {
      generateError.value = res.error?.message ?? '小说改编方案生成失败'
    }
  } else if ((inputMode.value === 'theme' || inputMode.value === 'outline') && knowledgePack.value) {
    // Outline/theme mode: multi-entry generation with knowledge pack
    // Build filtered knowledge pack from user selections
    const filteredPack: KnowledgePack = {
      primary_entries: knowledgePack.value.primary_entries.filter(e => selectedPrimaryEntries.value.includes(e.entry_name)),
      supporting_entries: knowledgePack.value.supporting_entries.filter(e => selectedSupportingEntries.value.includes(e.entry_name)),
      missing_needs: knowledgePack.value.missing_needs,
      overall_confidence: knowledgePack.value.overall_confidence,
    }

    const primaryEntryName = filteredPack.primary_entries.length > 0
      ? filteredPack.primary_entries[0].entry_name
      : ''

    const res = await storyGenerate({
      entry_name: primaryEntryName,
      original_user_query: outlineText.value || undefined,
      generation_type: generationTypeToSend as GenerationType,
      video_type: videoTypeToSend as VideoType,
      model_profile_id: selectedModelProfileId.value || undefined,
      target_video_duration: targetDuration.value,
      tone: tone.value || undefined,
      presentation_style: presentationStyleToSend as PresentationStyle,
      output_gears_segments: true,
      outline: outlineText.value,
      knowledge_pack: filteredPack,
      character_hints: outlineAnalysis.value?.detected_characters ?? undefined,
      genre_strictness: genreStrictness.value,
      story_priority: storyPriority.value,
      auto_repair: autoRepair.value,
      narrative_pattern_ids: selectedNarrativePatternIds.value.length > 0 ? selectedNarrativePatternIds.value : undefined,
      localized_target_region: localizedTargetRegion.value.trim() || undefined,
      localization_mode: localizationMode.value,
    })
    if (res.ok && res.data) {
      generateResult.value = res.data
      void loadRecentStoryProjects()
    } else {
      generateError.value = res.error?.message ?? '剧情方案生成失败'
    }
  }

  generating.value = false
}
</script>

<style scoped>
.story-studio {
  display: flex;
  gap: 24px;
  min-height: calc(100vh - 80px);
}

.story-studio__left {
  width: 40%;
  min-width: 320px;
  padding-right: 16px;
  border-right: 1px solid #ecf0f1;
  overflow-y: auto;
}

.story-studio__right {
  width: 60%;
  flex: 1;
  overflow-y: auto;
}

.story-studio__page-title {
  margin: 0 0 16px 0;
  font-size: 22px;
  color: #2c3e50;
}

/* Mode tabs */
.story-studio__mode-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
}
.story-studio__mode-tab {
  padding: 6px 14px;
  border: 2px solid #bdc3c7;
  border-radius: 4px;
  background: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.story-studio__mode-tab--active {
  border-color: #2980b9;
  background: #eaf2f8;
  color: #2980b9;
  font-weight: 600;
}
.story-studio__mode-tab:hover:not(.story-studio__mode-tab--active) { border-color: #3498db; }

/* Textarea */
.story-studio__textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
  font-size: 15px;
  line-height: 1.5;
  box-sizing: border-box;
  resize: vertical;
}
.story-studio__textarea:focus { border-color: #3498db; outline: none; }

/* Outline actions */
.story-studio__outline-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

/* Analysis results */
.story-studio__analysis {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid #bdc3c7;
  border-radius: 6px;
  background: #f8f9fa;
}
.story-studio__analysis-title {
  margin: 0 0 8px 0;
  font-size: 15px;
  color: #2c3e50;
}
.story-studio__analysis-items p {
  margin: 4px 0;
  font-size: 14px;
  color: #34495e;
  line-height: 1.4;
}
.story-studio__knowledge-needs ul {
  padding-left: 18px;
  margin: 4px 0;
}
.story-studio__knowledge-needs li {
  font-size: 13px;
  color: #34495e;
  margin-bottom: 3px;
}
.story-studio__detected-characters {
  margin-top: 8px;
}
.story-studio__character-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 5px;
}
.story-studio__character-chip {
  padding: 3px 7px;
  border-radius: 4px;
  border: 1px solid #d7dde2;
  background: #fff;
  color: #34495e;
  font-size: 12px;
}

.story-studio__pattern-list {
  display: grid;
  gap: 8px;
}

.story-studio__pattern-card {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 9px 10px;
  border: 1px solid #d7dde2;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
}

.story-studio__pattern-card--selected {
  border-color: #8e44ad;
  background: #f5eef8;
}

.story-studio__pattern-card input {
  margin-top: 2px;
}

.story-studio__pattern-main {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.story-studio__pattern-main strong {
  font-size: 13px;
  color: #2c3e50;
}

.story-studio__pattern-main span {
  font-size: 12px;
  line-height: 1.35;
  color: #5d6d7e;
}
.story-studio__pattern-tags,
.story-studio__pattern-axes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.story-studio__pattern-tags em,
.story-studio__pattern-axes em {
  font-style: normal;
  font-size: 11px;
  line-height: 1.2;
  padding: 2px 5px;
  border: 1px solid #d7dde2;
  border-radius: 4px;
  color: #455a64;
  background: #f8fafb;
}
.story-studio__pattern-axes em {
  color: #6c3483;
  background: #fbf6ff;
  border-color: #ead7f3;
}

/* Knowledge pack */
.story-studio__knowledge-pack {
  margin-top: 12px;
}
.story-studio__kp-title {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #2c3e50;
}
.story-studio__kp-section {
  margin-bottom: 10px;
}
.story-studio__kp-section-title {
  margin: 0 0 6px 0;
  font-size: 14px;
  font-weight: 600;
}
.story-studio__kp-section-title--primary { color: #27ae60; }
.story-studio__kp-section-title--supporting { color: #2980b9; }
.story-studio__kp-section-title--missing { color: #f39c12; }

.story-studio__kp-entry {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  margin-bottom: 6px;
  align-items: flex-start;
}
.story-studio__kp-entry--primary { background: #eafaf1; border: 1px solid #27ae60; }
.story-studio__kp-entry--supporting { background: #eaf2f8; border: 1px solid #2980b9; }
.story-studio__kp-checkbox {
  margin-top: 2px;
  width: 16px;
  height: 16px;
}
.story-studio__kp-entry-content {
  flex: 1;
}
.story-studio__kp-score {
  padding: 2px 6px;
  background: #d5f5e3;
  color: #27ae60;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
  margin-right: 6px;
}
.story-studio__kp-type {
  padding: 2px 8px;
  background: #eaf2f8;
  color: #2980b9;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
}
.story-studio__kp-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.story-studio__kp-tag {
  padding: 2px 6px;
  border: 1px solid #ccd6dd;
  border-radius: 3px;
  color: #455a64;
  background: #ffffff;
  font-size: 12px;
  line-height: 1.2;
}
.story-studio__kp-region {
  margin: 2px 0;
  font-size: 13px;
  color: #7f8c8d;
}
.story-studio__kp-reason {
  margin: 2px 0;
  font-size: 13px;
  color: #34495e;
}
.story-studio__kp-summary {
  margin: 2px 0;
  font-size: 13px;
  color: #7f8c8d;
  line-height: 1.4;
}

.story-studio__kp-missing {
  padding: 8px 12px;
  background: #fef9e7;
  border-radius: 4px;
  margin-bottom: 6px;
}
.story-studio__kp-missing p {
  margin: 0;
  font-size: 13px;
  color: #f39c12;
}
.story-studio__kp-confidence {
  margin: 8px 0 0;
  font-size: 14px;
  color: #2c3e50;
  font-weight: 600;
}

/* Fields */
.story-studio__field { margin-bottom: 14px; }
.story-studio__label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
}
.story-studio__field-hint {
  margin: 6px 0 0;
  font-size: 13px;
  color: #6b7884;
  line-height: 1.5;
}
.story-studio__advanced-panel {
  margin: 14px 0;
  border-top: 1px solid #ecf0f1;
  border-bottom: 1px solid #ecf0f1;
}
.story-studio__advanced-summary {
  padding: 12px 0;
  color: #34495e;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  list-style-position: outside;
}
.story-studio__advanced-panel[open] .story-studio__advanced-summary {
  margin-bottom: 10px;
}
.story-studio__advanced {
  padding: 10px 12px;
  border: 1px solid #d7dde2;
  border-radius: 6px;
  background: #f8fafb;
}
.story-studio__advanced .story-studio__label:not(:first-child) {
  margin-top: 10px;
}
.story-studio__checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  color: #34495e;
  font-size: 14px;
}
.story-studio__checkbox-row input {
  width: 16px;
  height: 16px;
}
.story-studio__input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
  font-size: 15px;
  box-sizing: border-box;
}
.story-studio__input:focus { border-color: #3498db; outline: none; }
.story-studio__select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
  font-size: 15px;
  background: #fff;
  box-sizing: border-box;
}
.story-studio__localization-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 132px;
  gap: 8px;
}

/* Auto-match label */
.story-studio__auto-match-label {
  margin-bottom: 6px;
  padding: 4px 10px;
  background: #d5f5e3;
  color: #27ae60;
  border-radius: 3px;
  font-size: 13px;
  font-weight: 600;
}

/* Search row */
.story-studio__search-row { display: flex; gap: 8px; }
.story-studio__search-row .story-studio__input { flex: 1; }

.btn--search {
  padding: 8px 16px;
  border: 1px solid #3498db;
  border-radius: 4px;
  background: #3498db;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}
.btn--search:hover:not(:disabled) { background: #2980b9; }
.btn--search:disabled { opacity: 0.5; cursor: not-allowed; }

/* Selected entry */
.story-studio__selected-entry {
  margin-top: 10px;
  padding: 12px 14px;
  border: 2px solid #27ae60;
  border-radius: 6px;
  background: #eafaf1;
}
.story-studio__selected-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.story-studio__selected-badge {
  padding: 2px 8px;
  background: #d5f5e3;
  color: #27ae60;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
}
.story-studio__selected-name { font-size: 15px; color: #2c3e50; }
.story-studio__clear-btn {
  margin-left: auto;
  padding: 2px 6px;
  border: none;
  background: transparent;
  color: #c0392b;
  font-size: 16px;
  cursor: pointer;
  border-radius: 3px;
}
.story-studio__clear-btn:hover { background: #fdecea; }
.story-studio__selected-meta { margin: 0; font-size: 13px; color: #7f8c8d; }
.story-studio__selected-summary { margin: 4px 0 0; font-size: 14px; color: #34495e; line-height: 1.4; }

/* Search results */
.story-studio__search-results { margin-top: 10px; }
.story-studio__search-hint { margin: 0 0 8px; font-size: 13px; color: #7f8c8d; }
.story-studio__search-item {
  padding: 10px 14px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.story-studio__search-item:hover { border-color: #3498db; background: #eaf2f8; }
.story-studio__search-item--best { border-color: #27ae60; background: #eafaf1; }
.story-studio__search-item-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.story-studio__match-score {
  padding: 2px 6px;
  background: #d5f5e3;
  color: #27ae60;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
}
.story-studio__search-type {
  padding: 2px 8px;
  background: #eaf2f8;
  color: #2980b9;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
}
.story-studio__search-name { display: block; font-size: 15px; color: #2c3e50; margin-bottom: 2px; }
.story-studio__search-meta { margin: 0; font-size: 12px; color: #7f8c8d; }
.btn--select-entry {
  margin-top: 6px;
  padding: 6px 12px;
  border: 1px solid #27ae60;
  border-radius: 4px;
  background: transparent;
  color: #27ae60;
  font-size: 13px;
  cursor: pointer;
  font-weight: 600;
}
.btn--select-entry:hover { background: #27ae60; color: #fff; }

/* Entry hint */
.story-studio__entry-hint {
  margin-top: 10px;
  padding: 8px 12px;
  background: #f8f9fa;
  color: #7f8c8d;
  border-radius: 4px;
  font-size: 13px;
}
.story-studio__generate-hint {
  margin-top: 8px;
  padding: 8px 12px;
  background: #fef9e7;
  color: #f39c12;
  border-radius: 4px;
  font-size: 13px;
}

/* Buttons */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 15px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn:hover:not(:disabled) { opacity: 0.85; }
.btn--primary { background: #2980b9; color: #fff; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn--generate {
  margin-top: 16px;
  width: 100%;
  padding: 12px 20px;
  font-size: 16px;
  font-weight: 700;
}

/* Error */
.story-studio__error {
  margin-top: 10px;
  padding: 8px 12px;
  background: #fdecea;
  color: #c0392b;
  border-radius: 4px;
  font-size: 14px;
}

/* Loading */
.story-studio__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
}
.story-studio__spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #ecf0f1;
  border-top: 4px solid #2980b9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.story-studio__loading-text { margin-top: 16px; font-size: 16px; color: #7f8c8d; }

/* Result error */
.story-studio__result-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  padding: 30px;
  text-align: center;
}
.story-studio__result-error h3 { margin: 0 0 8px 0; color: #c0392b; font-size: 18px; }
.story-studio__result-error p { margin: 0; color: #7f8c8d; font-size: 14px; }
.story-studio__result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}
.story-studio__result-link {
  display: inline-flex;
  align-items: center;
  padding: 10px 14px;
  border-radius: 6px;
  background: #eef6ff;
  color: #2b78b7;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
}
.story-studio__result-link--secondary {
  background: #f4f7f9;
  color: #52616f;
}

/* Empty state */
.story-studio__empty {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  min-height: 300px;
  color: #95a5a6;
  gap: 22px;
}
.story-studio__empty-copy {
  text-align: center;
}
.story-studio__empty p { font-size: 16px; margin: 0; }
.story-studio__hint { margin-top: 8px; font-size: 14px; }
.story-studio__recent {
  width: min(100%, 620px);
  margin: 0 auto;
  padding-top: 16px;
  border-top: 1px solid #ecf0f1;
}
.story-studio__recent-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 10px;
}
.story-studio__recent-head h3 {
  margin: 0 0 4px 0;
  color: #2c3e50;
  font-size: 16px;
}
.story-studio__recent-head p {
  margin: 0;
  color: #7f8c8d;
  font-size: 13px;
}
.story-studio__recent-manage {
  flex: 0 0 auto;
  padding: 8px 12px;
  border-radius: 6px;
  background: #eef6ff;
  color: #2b78b7;
  text-decoration: none;
  font-size: 13px;
  font-weight: 700;
}
.story-studio__recent-list {
  display: grid;
  gap: 8px;
}
.story-studio__recent-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid #edf1f3;
}
.story-studio__recent-link {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  min-width: 0;
}
.story-studio__recent-title {
  overflow: hidden;
  color: #2c3e50;
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.story-studio__recent-meta {
  color: #7f8c8d;
  font-size: 12px;
  white-space: nowrap;
}
.story-studio__recent-delete {
  min-height: 30px;
  padding: 5px 9px;
  border: 1px solid #f0c4bd;
  border-radius: 4px;
  background: #fff;
  color: #b13b2e;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}
.story-studio__recent-delete:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.story-studio__recent-state {
  padding: 12px 0;
  color: #7f8c8d;
  font-size: 14px;
}
.story-studio__recent-state--error {
  color: #c0392b;
}
.story-studio__recent-state--success {
  color: #1f7a44;
}

/* Video type groups */
.story-studio__vt-group { margin-bottom: 12px; }
.story-studio__vt-group-name { margin: 0 0 6px 0; font-size: 14px; color: #34495e; font-weight: 600; }
.story-studio__vt-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
.story-studio__vt-cards--common {
  margin-bottom: 10px;
}
.story-studio__vt-card {
  padding: 10px 14px;
  border: 2px solid #bdc3c7;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.story-studio__vt-card:hover { border-color: #3498db; }
.story-studio__vt-card--selected { border-color: #2980b9; background: #eaf2f8; }
.story-studio__vt-card--recommended { border-color: #27ae60; }
.story-studio__vt-badge { display: inline-block; font-size: 13px; margin-bottom: 2px; }
.story-studio__vt-name { display: block; font-size: 15px; font-weight: 700; color: #2c3e50; margin-bottom: 2px; }
.story-studio__vt-desc { display: block; font-size: 12px; color: #7f8c8d; }
.story-studio__vt-duration { display: block; font-size: 12px; color: #3498db; margin-top: 2px; }
.story-studio__more-types {
  border-top: 1px solid #ecf0f1;
}
.story-studio__more-types-summary {
  padding: 10px 0;
  color: #34495e;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  list-style-position: outside;
}
.story-studio__more-types[open] .story-studio__more-types-summary {
  margin-bottom: 6px;
}

/* ===== Mobile Responsive ===== */
@media (max-width: 768px) {
  .story-studio {
    flex-direction: column;
    gap: 16px;
  }
  .story-studio__left {
    width: 100%;
    min-width: 0;
    padding-right: 0;
    border-right: none;
    border-bottom: 1px solid #ecf0f1;
  }
  .story-studio__right {
    width: 100%;
  }
  .story-studio__recent-head,
  .story-studio__recent-item,
  .story-studio__recent-link {
    align-items: flex-start;
    grid-template-columns: 1fr;
  }
  .story-studio__recent-head {
    flex-direction: column;
  }
  .story-studio__recent-manage {
    width: 100%;
    text-align: center;
  }
  .story-studio__recent-delete {
    width: 100%;
  }
  .story-studio__recent-meta {
    white-space: normal;
  }
  .story-studio__mode-tabs {
    flex-wrap: wrap;
  }
  .story-studio__vt-cards {
    grid-template-columns: 1fr;
  }
}
</style>
