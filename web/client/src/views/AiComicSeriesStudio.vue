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

      <section v-if="availableNarrativePatterns.length > 0" class="series-studio__field">
        <span class="series-studio__label">叙事流派强化</span>
        <p class="series-studio__field-hint">AI 漫剧默认使用这些流派机制；勾选后会在系列规划和单集生成中加强。</p>
        <div class="series-studio__pattern-list">
          <label
            v-for="pattern in availableNarrativePatterns"
            :key="pattern.pattern_id"
            class="series-studio__pattern-card"
            :class="{ 'series-studio__pattern-card--selected': selectedNarrativePatternIds.includes(pattern.pattern_id) }"
          >
            <input
              v-model="selectedNarrativePatternIds"
              type="checkbox"
              :value="pattern.pattern_id"
            />
            <span>
              <strong>{{ pattern.label }}</strong>
              <small>{{ pattern.user_facing_summary || pattern.narrative_engine }}</small>
              <small v-if="pattern.subgenre_tags?.length" class="series-studio__pattern-tags">
                <em v-for="tag in pattern.subgenre_tags.slice(0, 4)" :key="tag">{{ tag }}</em>
              </small>
              <small v-if="pattern.style_axes?.length" class="series-studio__pattern-axes">
                <em v-for="axis in pattern.style_axes.slice(0, 3)" :key="axis.axis_id">
                  {{ axis.label }} {{ styleAxisValueLabel(axis.value) }}
                </em>
              </small>
            </span>
          </label>
        </div>
      </section>

      <label class="series-studio__checkbox-row">
        <input v-model="autoRepairEpisode" type="checkbox" />
        <span>生成本集后自动调整类型质量问题</span>
      </label>

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
          <div class="series-studio__saved-head-actions">
            <label class="series-studio__saved-toggle">
              <input v-model="showArchivedProjects" type="checkbox" @change="loadSavedProjects" />
              <span>显示归档</span>
            </label>
            <button class="series-studio__ghost-button" :disabled="loadingSavedProjects" @click="loadSavedProjects">
              {{ loadingSavedProjects ? '刷新中...' : '刷新' }}
            </button>
          </div>
        </div>
        <p v-if="savedProjectsError" class="series-studio__message series-studio__message--error">
          {{ savedProjectsError }}
        </p>
        <div v-else-if="savedProjects.length > 0" class="series-studio__saved-list">
          <article
            v-for="project in savedProjects"
            :key="project.series_project_id"
            class="series-studio__saved-item"
            :class="{
              'series-studio__saved-item--active': project.series_project_id === seriesProjectId,
              'series-studio__saved-item--archived': Boolean(project.archived_at),
            }"
          >
            <button class="series-studio__saved-open" @click="openSavedProject(project.series_project_id)">
              <strong>{{ project.title }}</strong>
              <span>
                {{ project.episode_count }} 集 · {{ project.generated_episode_count }} 集已生成
                <template v-if="project.archived_at"> · 已归档</template>
              </span>
              <small>{{ formatDate(project.updated_at) }}</small>
            </button>
            <div class="series-studio__saved-actions">
              <button
                class="series-studio__ghost-button"
                :disabled="managingProjectId === project.series_project_id"
                @click="handleCopyProject(project.series_project_id)"
              >
                复制
              </button>
              <button
                class="series-studio__ghost-button"
                :disabled="managingProjectId === project.series_project_id"
                @click="handleArchiveProject(project.series_project_id, !project.archived_at)"
              >
                {{ project.archived_at ? '恢复' : '归档' }}
              </button>
              <button
                class="series-studio__ghost-button series-studio__ghost-button--danger"
                :disabled="managingProjectId === project.series_project_id"
                @click="handleDeleteProject(project.series_project_id)"
              >
                删除
              </button>
            </div>
          </article>
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
            <div
              class="series-studio__save-status"
              :data-status="saveStatus"
            >
              <span>{{ saveStatusLabel }}</span>
              <strong v-if="lastSavedAt">{{ formatDate(lastSavedAt) }}</strong>
              <em v-if="affectedEpisodeText">{{ affectedEpisodeText }}</em>
              <em v-if="saveErrorMessage">{{ saveErrorMessage }}</em>
            </div>
            <p v-if="saveMessage" class="series-studio__save-note">{{ saveMessage }}</p>
            <div class="series-studio__summary-actions">
              <button
                class="series-studio__ghost-button"
                :disabled="saveStatus === 'saving' || exportingBible"
                @click="handleManualSave"
              >
                {{ saveStatus === 'saving' ? '保存中...' : '手动保存' }}
              </button>
              <details v-if="seriesProjectId" class="series-studio__delivery-actions">
                <summary class="series-studio__delivery-summary">导出与制作</summary>
                <div class="series-studio__delivery-actions-body">
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingBible || exportingSeedance || saveStatus === 'saving'"
                    @click="exportSeriesBibleMarkdown"
                  >
                    {{ exportingBible ? '导出中...' : '导出系列 Bible Markdown' }}
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingBible || exportingSeedance || saveStatus === 'saving'"
                    @click="exportSeriesBibleJson"
                  >
                    导出系列 Bible JSON
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceMarkdown"
                  >
                    {{ exportingSeedance ? '导出中...' : '导出 Seedance Markdown' }}
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceJson"
                  >
                    导出 Seedance JSON
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceCutMarkdown"
                  >
                    导出剪辑包 Markdown
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceCutJson"
                  >
                    导出剪辑包 JSON
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceRetryMarkdown"
                  >
                    导出重试包 Markdown
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceRetryJson"
                  >
                    导出重试包 JSON
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceVersionComparisonMarkdown"
                  >
                    导出版本对比 Markdown
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceVersionComparisonJson"
                  >
                    导出版本对比 JSON
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceAssetReportMarkdown"
                  >
                    导出素材报告 Markdown
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceAssetReportJson"
                  >
                    导出素材报告 JSON
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceEditAssetMarkdown"
                  >
                    导出剪辑台资产包 Markdown
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceEditAssetJson"
                  >
                    导出剪辑台资产包 JSON
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceThumbnailPlanMarkdown"
                  >
                    导出缩略图计划 Markdown
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceThumbnailPlanJson"
                  >
                    导出缩略图计划 JSON
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceFinishingPlanMarkdown"
                  >
                    导出成片精修计划 Markdown
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceFinishingPlanJson"
                  >
                    导出成片精修计划 JSON
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceSrt"
                  >
                    导出 SRT 字幕
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceAudioPlanMarkdown"
                  >
                    导出音频计划 Markdown
                  </button>
                  <button
                    class="series-studio__ghost-button"
                    :disabled="exportingSeedance || exportingBible || saveStatus === 'saving'"
                    @click="exportSeriesSeedanceAudioPlanJson"
                  >
                    导出音频计划 JSON
                  </button>
                </div>
              </details>
            </div>
            <div v-if="nextRecommendedEpisode" class="series-studio__next-action">
              <div>
                <span>推荐下一集</span>
                <strong>第{{ nextRecommendedEpisode.episode_no }}集：{{ nextRecommendedEpisode.title }}</strong>
                <p>{{ nextRecommendedEpisode.main_conflict }}</p>
              </div>
              <button
                class="series-studio__submit series-studio__submit--compact"
                :disabled="generatingEpisodeNo !== null || previewingEpisodeNo !== null || editingEpisodeNo !== null"
                @click="handleGenerateEpisode(nextRecommendedEpisode.episode_no)"
              >
                {{ generatingEpisodeNo === nextRecommendedEpisode.episode_no ? '生成中...' : '生成推荐集' }}
              </button>
            </div>
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
              <strong>{{ activeNarrativePatternLabels.length }}</strong>
              <span>流派机制</span>
            </div>
            <div class="series-studio__metric">
              <strong>{{ generatedEpisodeCount }}</strong>
              <span>已生成分镜</span>
            </div>
          </div>
        </section>

        <section v-if="seriesQualityAudit" class="series-studio__section series-studio__quality">
          <div class="series-studio__section-header">
            <h2>系列质量审计</h2>
            <span>{{ seriesQualityAudit.passed ? '通过' : '需处理' }} · {{ seriesQualityAudit.score }}/100</span>
          </div>
          <div v-if="earliestLedgerRebuildEpisode" class="series-studio__quality-actions">
            <p>第 {{ earliestLedgerRebuildEpisode }} 集之后的连续性账本需要按当前分集卡片重建。</p>
            <button
              class="series-studio__ghost-button"
              :disabled="rebuildingLedger"
              @click="handleRebuildLedger"
            >
              {{ rebuildingLedger ? '重建中...' : `从第${earliestLedgerRebuildEpisode}集重建账本` }}
            </button>
          </div>
          <div class="series-studio__quality-grid">
            <article>
              <strong>{{ seriesQualityAudit.generated_episode_count }}/{{ seriesQualityAudit.total_episode_count }}</strong>
              <span>已生成集数</span>
            </article>
            <article>
              <strong>{{ Math.round(seriesQualityAudit.checks.known_episode_quality_pass_rate * 100) }}%</strong>
              <span>已知单集通过率</span>
            </article>
            <article>
              <strong>{{ seriesQualityAudit.episodes_need_attention.length }}</strong>
              <span>待处理集数</span>
            </article>
          </div>
          <ul v-if="seriesQualityAudit.issues.length > 0" class="series-studio__quality-issues">
            <li v-for="issue in seriesQualityAudit.issues.slice(0, 6)" :key="issue">{{ issue }}</li>
          </ul>
          <div v-if="seriesQualityAudit.thread_closure_report" class="series-studio__thread-closure">
            <div class="series-studio__thread-closure-head">
              <strong>线索闭环</strong>
              <span>
                {{ seriesQualityAudit.thread_closure_report.paid_off_thread_count }}/{{ seriesQualityAudit.thread_closure_report.total_thread_count }} 已回收
              </span>
            </div>
            <div class="series-studio__thread-closure-grid">
              <article>
                <strong>{{ seriesQualityAudit.thread_closure_report.overdue_thread_count }}</strong>
                <span>超期未回收</span>
              </article>
              <article>
                <strong>{{ seriesQualityAudit.thread_closure_report.orphaned_thread_count }}</strong>
                <span>未绑定伏笔</span>
              </article>
              <article>
                <strong>{{ seriesQualityAudit.thread_closure_report.duplicate_thread_count }}</strong>
                <span>重复伏笔</span>
              </article>
            </div>
            <div v-if="priorityThreadClosureItems.length > 0" class="series-studio__thread-closure-list">
              <article
                v-for="item in priorityThreadClosureItems"
                :key="item.thread_id"
                :class="['series-studio__thread-closure-item', `series-studio__thread-closure-item--${item.status}`]"
              >
                <div>
                  <strong>{{ item.title }}</strong>
                  <span>{{ threadClosureStatusLabel(item.status) }} · 第{{ item.related_episodes.join('、') }}集</span>
                </div>
                <p>{{ item.issues[0] || item.repair_suggestions[0] || '按计划继续推进线索。' }}</p>
                <small v-if="item.repair_suggestions.length > 0">{{ item.repair_suggestions[0] }}</small>
              </article>
            </div>
          </div>
          <div v-if="seriesQualityAudit.memory_conflict_report" class="series-studio__thread-closure">
            <div class="series-studio__thread-closure-head">
              <strong>记忆冲突</strong>
              <span>
                {{ seriesQualityAudit.memory_conflict_report.total_conflict_count }} 条 ·
                阻断 {{ seriesQualityAudit.memory_conflict_report.blocking_count }} ·
                警告 {{ seriesQualityAudit.memory_conflict_report.warning_count }}
              </span>
            </div>
            <div v-if="priorityMemoryConflictItems.length > 0" class="series-studio__thread-closure-list">
              <article
                v-for="item in priorityMemoryConflictItems"
                :key="item.conflict_id"
                :class="['series-studio__thread-closure-item', `series-studio__thread-closure-item--${item.severity}`]"
              >
                <div>
                  <strong>{{ item.title }}</strong>
                  <span>{{ memoryConflictSeverityLabel(item.severity) }} · 第{{ item.related_episode_nos.join('、') || '全系列' }}集</span>
                </div>
                <p>{{ item.description }}</p>
                <small v-if="item.repair_suggestions.length > 0">{{ item.repair_suggestions[0] }}</small>
              </article>
            </div>
          </div>
          <div class="series-studio__episode-audit-list">
            <span
              v-for="report in seriesQualityAudit.episode_reports"
              :key="report.episode_no"
              :class="['series-studio__episode-audit', `series-studio__episode-audit--${report.status}`]"
            >
              第{{ report.episode_no }}集 · {{ episodeAuditLabel(report.status) }}
              <template v-if="typeof report.score === 'number'"> · {{ report.score }}</template>
              <template v-if="report.needs_episode_regeneration"> · 需重新生成</template>
            </span>
          </div>
        </section>

        <section v-if="seedanceProduction?.items.length" class="series-studio__section series-studio__quality">
          <div class="series-studio__section-header">
            <h2>Seedance 生产状态</h2>
            <span>{{ seedanceProduction.items.length }} 个镜头 · {{ seedanceProduction.updated_at ? formatDate(seedanceProduction.updated_at) : '未更新' }}</span>
          </div>
          <div class="series-studio__quality-grid">
            <article>
              <strong>{{ seedanceProductionStats.prompt_exported }}</strong>
              <span>已导出提示词</span>
            </article>
            <article>
              <strong>{{ seedanceProductionStats.submitted + seedanceProductionStats.processing }}</strong>
              <span>制作中</span>
            </article>
            <article>
              <strong>{{ seedanceProductionStats.ready }}</strong>
              <span>已完成</span>
            </article>
            <article>
              <strong>{{ seedanceProductionStats.failed }}</strong>
              <span>失败</span>
            </article>
            <article>
              <strong>{{ seedanceThumbnailStats.ready }}</strong>
              <span>缩略图已生成</span>
            </article>
            <article>
              <strong>{{ seedanceCutAssembly ? seedanceCutAssemblyStatusLabel(seedanceCutAssembly.status) : '未开始' }}</strong>
              <span>剪辑装配</span>
            </article>
          </div>
          <details class="series-studio__seedance-ops">
            <summary class="series-studio__seedance-ops-summary">生产操作</summary>
            <div class="series-studio__seedance-ops-body">
              <p>批量流转会更新当前账本中符合上一状态的镜头；视频回传导入支持 JSON 数组或包含 updates 字段的对象。</p>
              <div class="series-studio__memory-actions">
                <button
                  class="series-studio__ghost-button"
                  :disabled="batchUpdatingSeedance || seedanceProductionStats.prompt_exported === 0"
                  @click="batchMarkSeedanceProduction('prompt_exported', 'submitted')"
                >
                  批量已提交
                </button>
                <button
                  class="series-studio__ghost-button"
                  :disabled="batchUpdatingSeedance || seedanceProductionStats.submitted === 0"
                  @click="batchMarkSeedanceProduction('submitted', 'processing')"
                >
                  批量处理中
                </button>
                <button
                  class="series-studio__ghost-button"
                  :disabled="batchUpdatingSeedance || seedanceProductionStats.processing === 0"
                  @click="batchMarkSeedanceProduction('processing', 'ready')"
                >
                  批量完成
                </button>
                <button
                  class="series-studio__ghost-button"
                  :disabled="batchUpdatingSeedance || seedanceReadyVersionCount === 0"
                  @click="autoSelectSeedanceProductionVersions"
                >
                  自动择优剪辑版
                </button>
                <button
                  class="series-studio__ghost-button"
                  :disabled="assemblingSeedanceCut || seedanceProductionStats.ready === 0"
                  @click="assembleSeedanceCut('copy')"
                >
                  {{ assemblingSeedanceCut ? '装配中...' : '装配剪辑成片' }}
                </button>
                <button
                  class="series-studio__ghost-button"
                  :disabled="assemblingSeedanceCut || seedanceProductionStats.ready === 0"
                  @click="assembleSeedanceCut('transcode')"
                >
                  转码装配
                </button>
                <button
                  class="series-studio__ghost-button"
                  :disabled="loadingSeedanceVersionComparison"
                  @click="toggleSeedanceVersionComparison"
                >
                  {{ loadingSeedanceVersionComparison ? '加载中...' : showSeedanceVersionComparison ? '收起版本对比' : '查看版本对比' }}
                </button>
                <button
                  class="series-studio__ghost-button"
                  :disabled="capturingSeedanceThumbnails || seedanceProductionStats.ready === 0"
                  @click="captureSeedanceThumbnails"
                >
                  {{ capturingSeedanceThumbnails ? '抽帧中...' : '生成缩略图' }}
                </button>
                <button
                  class="series-studio__ghost-button"
                  :disabled="renderingSeedanceSubtitles || seedanceProductionStats.ready === 0"
                  @click="renderSeedanceSubtitles('sidecar')"
                >
                  {{ renderingSeedanceSubtitles ? '处理中...' : '生成字幕文件' }}
                </button>
                <button
                  class="series-studio__ghost-button"
                  :disabled="renderingSeedanceSubtitles || !seedanceCutAssembly?.output_path"
                  @click="renderSeedanceSubtitles('burn_in')"
                >
                  烧录字幕成片
                </button>
                <button
                  class="series-studio__ghost-button"
                  :disabled="mixingSeedanceAudio || !seedanceCutAssembly?.output_path"
                  @click="mixSeedanceAudioDryRun"
                >
                  {{ mixingSeedanceAudio ? '规划中...' : '混音 dry-run' }}
                </button>
                <button
                  class="series-studio__ghost-button"
                  :disabled="batchUpdatingSeedance"
                  @click="seedanceReturnImportInput?.click()"
                >
                  导入视频回传
                </button>
                <button
                  class="series-studio__ghost-button"
                  :disabled="batchUpdatingSeedance"
                  @click="seedanceAssetImportInput?.click()"
                >
                  导入素材绑定
                </button>
                <button
                  class="series-studio__ghost-button"
                  :disabled="batchUpdatingSeedance"
                  @click="seedanceAudioImportInput?.click()"
                >
                  导入音频素材
                </button>
                <input
                  ref="seedanceReturnImportInput"
                  class="series-studio__file-input"
                  type="file"
                  accept="application/json,.json"
                  @change="importSeedanceReturnJson"
                >
                <input
                  ref="seedanceAssetImportInput"
                  class="series-studio__file-input"
                  type="file"
                  accept="application/json,.json"
                  @change="importSeedanceAssetLibraryJson"
                >
                <input
                  ref="seedanceAudioImportInput"
                  class="series-studio__file-input"
                  type="file"
                  accept="application/json,.json"
                  @change="importSeedanceAudioLibraryJson"
                >
              </div>
            </div>
          </details>
          <div v-if="seedanceCutAssembly" class="series-studio__thread-closure">
            <div class="series-studio__thread-closure-head">
              <strong>剪辑装配</strong>
              <span>{{ seedanceCutAssembly.source_shot_count }} 个镜头 · {{ seedanceCutAssembly.updated_at ? formatDate(seedanceCutAssembly.updated_at) : '未更新' }}</span>
            </div>
            <p>
              {{ seedanceCutAssemblyStatusLabel(seedanceCutAssembly.status) }}
              <template v-if="seedanceCutAssembly.output_path"> · {{ seedanceCutAssembly.output_path }}</template>
              <template v-if="seedanceCutAssembly.failure_reason"> · {{ seedanceCutAssembly.failure_reason }}</template>
            </p>
          </div>
          <div v-if="seedanceSubtitleRender" class="series-studio__thread-closure">
            <div class="series-studio__thread-closure-head">
              <strong>字幕渲染</strong>
              <span>{{ seedanceSubtitleRender.cue_count }} 条 cue · {{ seedanceSubtitleRender.updated_at ? formatDate(seedanceSubtitleRender.updated_at) : '未更新' }}</span>
            </div>
            <p>
              {{ seedanceSubtitleRenderStatusLabel(seedanceSubtitleRender.status) }}
              · {{ seedanceSubtitleRender.mode === 'burn_in' ? '烧录字幕' : '侧挂 SRT' }}
              <template v-if="seedanceSubtitleRender.output_path"> · {{ seedanceSubtitleRender.output_path }}</template>
              <template v-if="seedanceSubtitleRender.failure_reason"> · {{ seedanceSubtitleRender.failure_reason }}</template>
            </p>
          </div>
          <div v-if="seedanceAudioMix" class="series-studio__thread-closure">
            <div class="series-studio__thread-closure-head">
              <strong>音频混音</strong>
              <span>{{ seedanceAudioMix.source_audio_count }} 个音频 · 缺 {{ seedanceAudioMix.missing_audio_count }} · {{ seedanceAudioMix.updated_at ? formatDate(seedanceAudioMix.updated_at) : '未更新' }}</span>
            </div>
            <p>
              {{ seedanceAudioMixStatusLabel(seedanceAudioMix.status) }}
              · {{ seedanceAudioMixProfileLabel(seedanceAudioMix.audio_profile) }}
              <template v-if="seedanceAudioMix.output_path"> · {{ seedanceAudioMix.output_path }}</template>
              <template v-if="seedanceAudioMix.failure_reason"> · {{ seedanceAudioMix.failure_reason }}</template>
            </p>
          </div>
          <div v-if="showSeedanceVersionComparison" class="series-studio__seedance-comparison">
            <div class="series-studio__thread-closure-head">
              <strong>版本对比</strong>
              <span v-if="seedanceVersionComparison">
                {{ seedanceVersionComparison.comparable_shot_count }} 个多版本镜头 ·
                {{ seedanceVersionComparison.selected_shot_count }} 个已选
              </span>
              <span v-else>{{ loadingSeedanceVersionComparison ? '加载中' : '暂无数据' }}</span>
            </div>
            <div class="series-studio__memory-actions">
              <button
                class="series-studio__memory-action"
                :disabled="loadingSeedanceVersionComparison"
                @click="loadSeedanceVersionComparison"
              >
                刷新对比
              </button>
              <button
                class="series-studio__memory-action"
                @click="showSeedanceVersionComparison = false"
              >
                收起
              </button>
            </div>
            <div v-if="loadingSeedanceVersionComparison" class="series-studio__seedance-comparison-empty">
              正在加载版本对比...
            </div>
            <div v-else-if="seedanceVersionComparisonShots.length" class="series-studio__seedance-comparison-list">
              <article
                v-for="shot in seedanceVersionComparisonShots"
                :key="shot.production_id"
                class="series-studio__seedance-comparison-shot"
              >
                <div class="series-studio__seedance-comparison-head">
                  <div>
                    <strong>第{{ shot.episode_no }}集 · {{ shot.shot_id }}</strong>
                    <span>{{ shot.episode_title }} · 场景 {{ shot.source_scene_id ?? '未记录' }}</span>
                  </div>
                  <div class="series-studio__seedance-comparison-tags">
                    <b>{{ shot.ready_version_count }} 可用</b>
                    <b v-if="shot.failed_version_count > 0">{{ shot.failed_version_count }} 失败</b>
                    <b v-if="shot.selected_version_id">剪辑版 {{ shot.selected_version_id }}</b>
                    <b v-if="shot.auto_best_version_id">推荐 {{ shot.auto_best_version_id }}</b>
                  </div>
                </div>
                <div class="series-studio__seedance-comparison-versions">
                  <div
                    v-for="version in shot.versions"
                    :key="version.version_id"
                    :class="[
                      'series-studio__seedance-comparison-version',
                      version.is_selected ? 'series-studio__seedance-comparison-version--selected' : '',
                      version.is_auto_best ? 'series-studio__seedance-comparison-version--best' : '',
                    ]"
                  >
                    <div class="series-studio__seedance-comparison-meta">
                      <div>
                        <strong>#{{ version.rank }} · {{ version.version_id }}</strong>
                        <span>
                          {{ seedanceProductionStatusLabel(version.status) }} · {{ formatDate(version.created_at) }}
                          <template v-if="typeof version.quality_score === 'number'"> · 质量 {{ version.quality_score }}</template>
                        </span>
                      </div>
                      <div class="series-studio__seedance-comparison-tags">
                        <b v-if="version.is_selected">当前剪辑版</b>
                        <b v-if="version.is_auto_best">自动推荐</b>
                      </div>
                    </div>
                    <video
                      v-if="version.video_url"
                      class="series-studio__seedance-comparison-video"
                      :src="version.video_url"
                      controls
                      preload="metadata"
                    />
                    <p>{{ version.review_note || version.note || version.failure_reason || version.decision_reason }}</p>
                    <div class="series-studio__memory-actions">
                      <a
                        v-if="version.video_url"
                        class="series-studio__memory-action"
                        :href="version.video_url"
                        target="_blank"
                        rel="noreferrer"
                      >
                        打开视频
                      </a>
                      <button
                        class="series-studio__memory-action"
                        :disabled="
                          updatingSeedanceProductionId === shot.production_id
                          || version.status !== 'ready'
                          || !version.video_url
                          || version.is_selected
                        "
                        @click="selectSeedanceComparisonVersion(shot, version.version_id)"
                      >
                        设为剪辑版
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            </div>
            <div v-else class="series-studio__seedance-comparison-empty">
              暂无可对比的视频版本。
            </div>
          </div>
          <div class="series-studio__thread-closure-list">
            <article
              v-for="item in seedanceProductionItems"
              :key="item.production_id"
              class="series-studio__thread-closure-item"
            >
              <div>
                <strong>第{{ item.episode_no }}集 · {{ item.shot_id }}</strong>
                <span>{{ seedanceProductionStatusLabel(item.status) }} · {{ formatDate(item.updated_at) }}</span>
              </div>
              <p>{{ item.episode_title }} · {{ item.provider_job_id || item.video_url || item.failure_reason || item.notes[item.notes.length - 1] || '等待生产状态更新' }}</p>
              <p v-if="item.thumbnail">
                缩略图：{{ seedanceThumbnailStatusLabel(item.thumbnail.status) }}
                <template v-if="item.thumbnail.output_path"> · {{ item.thumbnail.output_path }}</template>
                <template v-if="item.thumbnail.failure_reason"> · {{ item.thumbnail.failure_reason }}</template>
              </p>
              <div v-if="item.versions.length" class="series-studio__seedance-version-list">
                <div
                  v-for="version in item.versions.slice(-4).reverse()"
                  :key="version.version_id"
                  class="series-studio__seedance-version"
                >
                  <span>
                    {{ version.version_id }}
                    · {{ seedanceProductionStatusLabel(version.status) }}
                    · {{ formatDate(version.created_at) }}
                    <template v-if="typeof version.quality_score === 'number'"> · 质量 {{ version.quality_score }}</template>
                    <template v-if="version.review_note"> · {{ version.review_note }}</template>
                    <b v-if="item.selected_version_id === version.version_id">剪辑版</b>
                  </span>
                  <button
                    class="series-studio__memory-action"
                    :disabled="
                      updatingSeedanceProductionId === item.production_id
                      || version.status !== 'ready'
                      || !version.video_url
                      || item.selected_version_id === version.version_id
                    "
                    @click="selectSeedanceProductionVersion(item, version.version_id)"
                  >
                    设为剪辑版
                  </button>
                </div>
              </div>
              <details class="series-studio__shot-actions">
                <summary class="series-studio__shot-actions-summary">更新状态</summary>
                <div class="series-studio__shot-actions-body">
                  <button
                    class="series-studio__memory-action"
                    :disabled="updatingSeedanceProductionId === item.production_id"
                    @click="markSeedanceProduction(item, 'submitted')"
                  >
                    已提交
                  </button>
                  <button
                    class="series-studio__memory-action"
                    :disabled="updatingSeedanceProductionId === item.production_id"
                    @click="markSeedanceProduction(item, 'processing')"
                  >
                    处理中
                  </button>
                  <button
                    class="series-studio__memory-action"
                    :disabled="updatingSeedanceProductionId === item.production_id"
                    @click="markSeedanceProduction(item, 'ready')"
                  >
                    完成
                  </button>
                  <button
                    class="series-studio__memory-action"
                    :disabled="updatingSeedanceProductionId === item.production_id"
                    @click="markSeedanceProduction(item, 'failed')"
                  >
                    失败
                  </button>
                </div>
              </details>
            </article>
          </div>
        </section>

        <section v-if="plan.series_spine?.length" class="series-studio__section">
          <div class="series-studio__section-header">
            <h2>主线剧情骨架</h2>
            <span>{{ plan.series_spine.length }} 个节点</span>
          </div>
          <div class="series-studio__spine-list">
            <article v-for="beat in plan.series_spine" :key="beat.beat_id" class="series-studio__spine">
              <span class="series-studio__phase-range">第 {{ beat.episode_range[0] }}-{{ beat.episode_range[1] }} 集</span>
              <strong>{{ beat.story_function }}</strong>
              <p>{{ beat.central_question }}</p>
              <small>{{ beat.required_turn }} · {{ beat.payoff_target }}</small>
            </article>
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
          <div class="series-studio__blueprint-board">
            <div class="series-studio__timeline">
              <button
                v-for="item in blueprintTimelineItems"
                :key="item.episode.episode_no"
                class="series-studio__timeline-node"
                :data-status="item.status"
                :class="{ 'series-studio__timeline-node--editing': isEditingEpisode(item.episode.episode_no) }"
                :disabled="savingEpisodeEdit || generatingEpisodeNo !== null || previewingEpisodeNo !== null"
                @click="startEditEpisode(item.episode)"
              >
                <span>第 {{ item.episode.episode_no }} 集</span>
                <strong>{{ item.episode.title }}</strong>
                <small>{{ item.episode.story_phase }}</small>
                <p>{{ item.opening }} → {{ item.midpoint }} → {{ item.ending }}</p>
                <em>{{ item.threadAction }}</em>
                <b>{{ item.statusLabel }}</b>
              </button>
            </div>
            <div class="series-studio__character-state-board">
              <article
                v-for="row in characterStateRows"
                :key="row.name"
                class="series-studio__character-state-row"
              >
                <div>
                  <strong>{{ row.name }}</strong>
                  <span>{{ row.currentState }}</span>
                </div>
                <p>{{ row.turningPoints.join('；') || row.longArc }}</p>
              </article>
            </div>
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
                    :disabled="generatingEpisodeNo !== null || previewingEpisodeNo !== null"
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
                    :disabled="generatingEpisodeNo !== null || previewingEpisodeNo !== null || isEditingEpisode(episode.episode_no)"
                    @click="handlePreviewEpisodeContext(episode.episode_no)"
                  >
                    {{ previewingEpisodeNo === episode.episode_no ? '预览中...' : '预览生成上下文' }}
                  </button>
                  <button
                    class="series-studio__episode-action"
                    :disabled="generatingEpisodeNo !== null || previewingEpisodeNo !== null || isEditingEpisode(episode.episode_no)"
                    @click="handleGenerateEpisode(episode.episode_no)"
                  >
                    {{ generatingEpisodeNo === episode.episode_no ? '生成中...' : generatedEpisodeStoryIds[String(episode.episode_no)] ? '重新生成本集分镜' : '生成本集分镜' }}
                  </button>
                  <RouterLink
                    v-if="episodeStoryId(episode.episode_no)"
                    class="series-studio__episode-link"
                    :to="episodeProjectPath(episode.episode_no)"
                  >
                    打开故事项目
                  </RouterLink>
                </div>
              </header>
              <div v-if="isEditingEpisode(episode.episode_no) && episodeEditDraft" class="series-studio__episode-editor">
                <p
                  v-if="episodeStoryId(episode.episode_no)"
                  class="series-studio__message series-studio__message--warning series-studio__episode-edit-warning"
                >
                  本集已生成分镜。保存卡片修改后，建议重新生成本集分镜，让故事项目与最新分集规划一致。
                </p>
                <label>
                  <span>主冲突</span>
                  <textarea v-model="episodeEditDraft.main_conflict" rows="2" />
                </label>
                <div class="series-studio__episode-editor-grid">
                  <label>
                    <span>开场钩子</span>
                    <textarea v-model="episodeEditDraft.opening_hook" rows="2" />
                  </label>
                  <label>
                    <span>中段转折</span>
                    <textarea v-model="episodeEditDraft.midpoint_turn" rows="2" />
                  </label>
                </div>
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
                    <span>结尾钩子类型</span>
                    <select v-model="episodeEditDraft.ending_hook_type">
                      <option value="choice">选择钩子</option>
                      <option value="reveal">揭示钩子</option>
                      <option value="danger">代价钩子</option>
                      <option value="emotional_question">情绪疑问钩子</option>
                      <option value="quiet_aftertaste">余味钩子</option>
                      <option value="final_echo">终局回声</option>
                    </select>
                  </label>
                  <label>
                    <span>线索开合动作</span>
                    <input v-model="episodeEditDraft.thread_action" />
                  </label>
                </div>
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
                <label>
                  <span>角色状态变化</span>
                  <textarea v-model="episodeEditDraft.character_state_change" rows="2" />
                </label>
                <p v-if="episodeEditError" class="series-studio__message series-studio__message--error">
                  {{ episodeEditError }}
                </p>
              </div>
              <p v-else class="series-studio__conflict">{{ episode.main_conflict }}</p>
              <div v-if="!isEditingEpisode(episode.episode_no)" class="series-studio__episode-columns">
                <div>
                  <strong>开场/转折</strong>
                  <p>{{ episode.opening_hook || '按承接关系开场' }}；{{ episode.midpoint_turn || '中段推动判断变化' }}</p>
                </div>
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
                <div>
                  <strong>状态/线索</strong>
                  <p>{{ episode.character_state_change || episode.continuity_state_after[0] }}；{{ episode.thread_action || '按阶段目标推进线索' }}</p>
                </div>
              </div>
              <footer class="series-studio__episode-footer">
                <span>{{ episode.key_characters.join('、') }}</span>
                <span>{{ hookTypeLabel(episode.ending_hook_type) }}</span>
                <span
                  v-if="generatedEpisodeStoryIds[String(episode.episode_no)]"
                  class="series-studio__episode-generated"
                >
                  已生成分镜
                </span>
                <RouterLink
                  v-if="episodeStoryId(episode.episode_no)"
                  class="series-studio__episode-detail-link"
                  :to="`/story/${episodeStoryId(episode.episode_no)}`"
                >
                  查看详情
                </RouterLink>
                <span>{{ episode.ending_hook }}</span>
              </footer>
            </article>
          </div>
        </section>

        <section
          v-if="previewingEpisodeNo || contextPreviewError || contextPreview"
          class="series-studio__section series-studio__context-preview"
        >
          <div class="series-studio__section-header">
            <h2>生成上下文预览</h2>
            <span v-if="contextPreview">第 {{ contextPreview.episode_no }} 集</span>
            <span v-else-if="previewingEpisodeNo">第 {{ previewingEpisodeNo }} 集</span>
          </div>
          <div v-if="previewingEpisodeNo" class="series-studio__loading series-studio__loading--inline">
            <div class="spinner" />
            <p>正在整理生成上下文...</p>
          </div>
          <p v-else-if="contextPreviewError" class="series-studio__message series-studio__message--error">
            {{ contextPreviewError }}
          </p>
          <div v-else-if="contextPreview" class="series-studio__context-grid">
            <article class="series-studio__context-card series-studio__context-card--wide">
              <strong>{{ contextPreview.title }}</strong>
              <p>
                {{ contextPreview.used_saved_ledger ? '已使用保存项目的连续性账本' : '使用当前规划生成初始连续性账本' }}
              </p>
            </article>
            <article class="series-studio__context-card">
              <strong>本集蓝图</strong>
              <p>{{ contextPreview.blueprint.opening_hook }}</p>
              <p>{{ contextPreview.blueprint.midpoint_turn }}</p>
              <p>{{ hookTypeLabel(contextPreview.blueprint.ending_hook_type) }} · {{ contextPreview.blueprint.thread_action }}</p>
            </article>
            <article class="series-studio__context-card">
              <strong>叙事流派机制</strong>
              <p>{{ contextPreview.narrative_patterns.join('；') || '使用默认 AI 漫剧机制' }}</p>
            </article>
            <article class="series-studio__context-card">
              <strong>连续性摘要</strong>
              <p>上一条生成：{{ contextPreview.ledger_summary.last_generated_episode_no ?? '暂无' }}</p>
              <p>{{ contextPreview.ledger_summary.character_state_current.join('；') || '暂无角色状态' }}</p>
              <p>{{ contextPreview.ledger_summary.open_threads.join('；') || '暂无未回收线索' }}</p>
            </article>
            <article
              v-if="contextPreview.ledger_summary.production_constraints"
              class="series-studio__context-card"
            >
              <strong>制作约束</strong>
              <p>
                生效 {{ contextPreview.ledger_summary.production_constraints.active_count }} 条 ·
                必须 {{ contextPreview.ledger_summary.production_constraints.must_count }} 条 ·
                待复核 {{ contextPreview.ledger_summary.production_constraints.needs_review_count }} 条
              </p>
              <p>{{ contextPreview.ledger_summary.production_constraints.recent.join('；') || '暂无近期约束' }}</p>
            </article>
            <article
              v-if="contextPreview.ledger_summary.memory_conflicts"
              class="series-studio__context-card"
            >
              <strong>记忆冲突</strong>
              <p>
                总计 {{ contextPreview.ledger_summary.memory_conflicts.total_conflict_count }} 条 ·
                阻断 {{ contextPreview.ledger_summary.memory_conflicts.blocking_count }} 条 ·
                警告 {{ contextPreview.ledger_summary.memory_conflicts.warning_count }} 条
              </p>
              <p>{{ contextPreview.ledger_summary.memory_conflicts.recent.join('；') || '暂无结构化冲突' }}</p>
            </article>
            <article
              v-if="contextPreview.ledger_summary.episodic_memory"
              class="series-studio__context-card"
            >
              <strong>情景记忆索引</strong>
              <p>已沉淀 {{ contextPreview.ledger_summary.episodic_memory.total_count }} 条场景/对白/镜头片段</p>
              <p>{{ contextPreview.ledger_summary.episodic_memory.recent.join('；') || '暂无情景记忆' }}</p>
            </article>
            <article class="series-studio__context-card">
              <strong>上一集记忆</strong>
              <p>{{ contextPreview.previous_episode_memory.join('；') || '暂无上一集记忆' }}</p>
            </article>
            <article class="series-studio__context-card">
              <strong>下一集承接要求</strong>
              <p>{{ contextPreview.next_episode_requirement || '这是当前规划的最后一集' }}</p>
            </article>
            <article
              v-if="contextPreview.focused_memory_recall?.items.length"
              class="series-studio__context-card series-studio__context-card--wide"
            >
              <strong>系列记忆精准召回</strong>
              <div class="series-studio__memory-recall-toolbar">
                <select v-model="memoryRecallCategoryFilter" class="series-studio__select series-studio__select--compact">
                  <option value="all">全部类型</option>
                  <option value="character">角色</option>
                  <option value="relationship">关系</option>
                  <option value="prop">道具</option>
                  <option value="location">地点</option>
                  <option value="visual_asset">视觉资产</option>
                  <option value="knowledge_boundary">知识边界</option>
                  <option value="story_event">关键事件</option>
                </select>
                <select v-model="memoryRecallStatusFilter" class="series-studio__select series-studio__select--compact">
                  <option value="all">全部状态</option>
                  <option value="locked">已锁定</option>
                  <option value="excluded">已排除</option>
                </select>
                <input
                  v-model="memoryRecallEntityFilter"
                  class="series-studio__input series-studio__input--compact"
                  placeholder="按角色/道具/地点筛选"
                >
                <button class="series-studio__ghost-button" :disabled="filteredMemoryRecallItems.length === 0" @click="lockFilteredMemoryItems">
                  锁定筛选
                </button>
                <button class="series-studio__ghost-button" :disabled="filteredMemoryRecallItems.length === 0" @click="excludeFilteredMemoryItems">
                  排除筛选
                </button>
                <button class="series-studio__ghost-button" :disabled="filteredMemoryRecallItems.length === 0" @click="clearFilteredMemoryPreferences">
                  清空筛选偏好
                </button>
                <button class="series-studio__ghost-button" @click="clearActiveMemoryLocks">
                  清空锁定
                </button>
                <button class="series-studio__ghost-button" @click="clearActiveMemoryExclusions">
                  清空排除
                </button>
                <button class="series-studio__ghost-button" @click="exportMemoryRecallPreferences">
                  导出偏好
                </button>
                <button class="series-studio__ghost-button" @click="triggerMemoryRecallPreferenceImport">
                  导入偏好
                </button>
                <input
                  ref="memoryPreferenceImportInput"
                  class="series-studio__file-input"
                  type="file"
                  accept="application/json,.json"
                  @change="handleMemoryRecallPreferenceImport"
                >
              </div>
              <div class="series-studio__memory-recall-list">
                <div
                  v-for="item in filteredMemoryRecallItems"
                  :key="item.memory_id"
                  class="series-studio__memory-recall-item"
                  :class="{
                    'series-studio__memory-recall-item--locked': lockedMemoryIds.includes(item.memory_id),
                    'series-studio__memory-recall-item--excluded': excludedMemoryIds.includes(item.memory_id),
                  }"
                >
                  <div>
                    <b>{{ memoryCategoryLabel(item.category) }} · {{ item.label }}</b>
                    <p>{{ item.status }}</p>
                    <small>{{ item.score }} 分 · {{ item.reasons.join('、') }}</small>
                  </div>
                  <div class="series-studio__memory-recall-actions">
                    <button class="series-studio__ghost-button" @click="toggleLockedMemory(item.memory_id)">
                      {{ lockedMemoryIds.includes(item.memory_id) ? '取消锁定' : '锁定' }}
                    </button>
                    <button class="series-studio__ghost-button" @click="toggleExcludedMemory(item.memory_id)">
                      {{ excludedMemoryIds.includes(item.memory_id) ? '取消排除' : '排除' }}
                    </button>
                  </div>
                </div>
                <p v-if="filteredMemoryRecallItems.length === 0">当前筛选下没有召回记忆。</p>
              </div>
              <p v-if="contextPreview.focused_memory_recall.conflicts.length">
                待核冲突：{{ contextPreview.focused_memory_recall.conflicts.join('；') }}
              </p>
            </article>
            <article
              v-if="contextPreview.focused_episodic_memory_recall?.items.length"
              class="series-studio__context-card series-studio__context-card--wide"
            >
              <strong>长期情景记忆模糊召回</strong>
              <div class="series-studio__memory-recall-list">
                <div
                  v-for="item in contextPreview.focused_episodic_memory_recall.items"
                  :key="item.episodic_memory_id"
                  class="series-studio__memory-recall-item"
                >
                  <div>
                    <b>第{{ item.episode_no }}集 · {{ item.title }}</b>
                    <p>{{ item.text }}</p>
                    <small>{{ item.score }} 分 · {{ item.reasons.join('、') }} · {{ item.keywords.slice(0, 5).join('、') }}</small>
                  </div>
                </div>
              </div>
            </article>
            <article class="series-studio__context-card series-studio__context-card--wide">
              <strong>完整生成提纲</strong>
              <pre>{{ contextPreview.generation_outline }}</pre>
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
          <div v-else-if="episodeResult">
            <section
              v-if="episodeResult.ai_comic_episode_blueprint || episodeResult.ai_comic_episode_quality || episodeResult.continuity_audit"
              class="series-studio__episode-quality"
            >
              <article v-if="episodeResult.ai_comic_episode_blueprint">
                <strong>本集生成蓝图</strong>
                <p>
                  {{ episodeResult.ai_comic_episode_blueprint.opening_hook }}
                  · {{ episodeResult.ai_comic_episode_blueprint.midpoint_turn }}
                </p>
                <p>
                  {{ hookTypeLabel(episodeResult.ai_comic_episode_blueprint.ending_hook_type) }}
                  · {{ episodeResult.ai_comic_episode_blueprint.thread_action }}
                </p>
              </article>
              <article v-if="episodeResult.ai_comic_episode_quality">
                <strong>本集剧情质量</strong>
                <p>
                  {{ episodeResult.ai_comic_episode_quality.passed ? '通过' : '需调整' }}
                  · {{ episodeResult.ai_comic_episode_quality.score }}/100
                </p>
                <ul v-if="episodeResult.ai_comic_episode_quality.issues.length > 0">
                  <li v-for="issue in episodeResult.ai_comic_episode_quality.issues" :key="issue">{{ issue }}</li>
                </ul>
              </article>
              <article v-if="episodeResult.continuity_audit">
                <strong>连续性检查</strong>
                <p>{{ episodeResult.continuity_audit.passed ? '通过' : '需调整' }}</p>
                <ul v-if="episodeResult.continuity_audit.issues.length > 0">
                  <li v-for="issue in episodeResult.continuity_audit.issues" :key="issue">{{ issue }}</li>
                </ul>
              </article>
            </section>
            <StoryResult :result="episodeResult" />
          </div>
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
  aiComicEpisodeContextPreview,
  aiComicEpisodeGenerate,
  assembleAiComicSeriesSeedanceCut,
  archiveAiComicSeriesProject,
  autoSelectAiComicSeriesSeedanceProductionVersions,
  captureAiComicSeriesSeedanceThumbnails,
  copyAiComicSeriesProject,
  deleteAiComicSeriesProject,
  exportAiComicSeriesBible,
  exportAiComicSeriesSeedanceAssetReportPackage,
  exportAiComicSeriesSeedanceAudioPlanPackage,
  exportAiComicSeriesSeedanceCutPackage,
  exportAiComicSeriesSeedanceEditAssetPackage,
  exportAiComicSeriesSeedanceFinishingPlanPackage,
  exportAiComicSeriesSeedancePrompts,
  exportAiComicSeriesSeedanceRetryPackage,
  exportAiComicSeriesSeedanceSubtitlePackage,
  exportAiComicSeriesSeedanceThumbnailPlanPackage,
  exportAiComicSeriesSeedanceVersionComparisonPackage,
  aiComicSeriesPlan,
  getAiComicSeriesProject,
  listAiComicSeriesProjects,
  mixAiComicSeriesSeedanceAudio,
  rebuildAiComicSeriesLedger,
  renderAiComicSeriesSeedanceSubtitles,
  saveAiComicSeriesProject,
  selectAiComicSeriesSeedanceProductionVersion,
  updateAiComicSeriesSeedanceAssetLibrary,
  updateAiComicSeriesSeedanceAudioLibrary,
  updateAiComicSeriesSeedanceProductionStatus,
  updateAiComicSeriesSeedanceProductionStatuses,
} from '@/api/stories'
import { getNarrativePatternCatalog } from '@/api/system'
import StoryResult from '@/components/StoryResult.vue'
import type {
  AiComicContinuityLedger,
  AiComicEndingHookType,
  AiComicEpisodeContextPreview,
  AiComicEpisodePlan,
  AiComicMemoryConflictSeverity,
  AiComicPacingProfile,
  AiComicSeriesMemoryCategory,
  AiComicSeriesMemoryRecallControls,
  AiComicSeriesMemoryRecallPreferences,
  AiComicSeriesQualityAudit,
  AiComicSeriesProjectMeta,
  AiComicSeriesPlan,
  AiComicSeriesQualityEpisodeStatus,
  AiComicThreadClosureStatus,
  AiComicSeedanceProductionBatchUpdateRequest,
  AiComicSeedanceProductionLedger,
  AiComicSeedanceProductionStatus,
  AiComicSeedanceProductionStatusUpdateRequest,
  AiComicSeedanceAssetLibraryUpdateRequest,
  AiComicSeedanceAudioLibraryUpdateRequest,
  AiComicSeedanceAudioMixLedger,
  AiComicSeedanceCutAssemblyLedger,
  AiComicSeedanceShotProductionItem,
  AiComicSeedanceSubtitleRenderLedger,
  AiComicSeedanceVersionComparisonShot,
  AiComicSeriesSeedanceVersionComparisonPackage,
  NarrativePattern,
  NarrativePatternCatalog,
  NarrativePatternId,
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
const narrativePatternCatalog = ref<NarrativePatternCatalog | null>(null)
const selectedNarrativePatternIds = ref<NarrativePatternId[]>([])
const autoRepairEpisode = ref(false)
const planning = ref(false)
const errorMessage = ref('')
const plan = ref<AiComicSeriesPlan | null>(null)
const generatingEpisodeNo = ref<number | null>(null)
const generatedEpisodeNo = ref<number | null>(null)
const episodeResult = ref<StoryGenerateResult | null>(null)
const episodeErrorMessage = ref('')
const contextPreview = ref<AiComicEpisodeContextPreview | null>(null)
const previewingEpisodeNo = ref<number | null>(null)
const contextPreviewError = ref('')
const lockedMemoryIds = ref<string[]>([])
const excludedMemoryIds = ref<string[]>([])
const memoryRecallPreferences = ref<AiComicSeriesMemoryRecallPreferences>({})
const activeMemoryPreferenceEpisodeNo = ref<number | null>(null)
const memoryRecallCategoryFilter = ref<AiComicSeriesMemoryCategory | 'all'>('all')
const memoryRecallStatusFilter = ref<'all' | 'locked' | 'excluded'>('all')
const memoryRecallEntityFilter = ref('')
const memoryPreferenceImportInput = ref<HTMLInputElement | null>(null)
const seriesProjectId = ref('')
const saveMessage = ref('')
type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed'
const saveStatus = ref<SaveStatus>('idle')
const saveErrorMessage = ref('')
const lastSavedAt = ref('')
const affectedEpisodeNos = ref<number[]>([])
const generatedEpisodeStoryIds = ref<Record<string, string>>({})
const continuityLedger = ref<AiComicContinuityLedger | null>(null)
const seriesQualityAudit = ref<AiComicSeriesQualityAudit | null>(null)
const seedanceProduction = ref<AiComicSeedanceProductionLedger | null>(null)
const seedanceCutAssembly = ref<AiComicSeedanceCutAssemblyLedger | null>(null)
const seedanceSubtitleRender = ref<AiComicSeedanceSubtitleRenderLedger | null>(null)
const seedanceAudioMix = ref<AiComicSeedanceAudioMixLedger | null>(null)
const seedanceVersionComparison = ref<AiComicSeriesSeedanceVersionComparisonPackage | null>(null)
const showSeedanceVersionComparison = ref(false)
const loadingSeedanceVersionComparison = ref(false)
const updatingSeedanceProductionId = ref('')
const batchUpdatingSeedance = ref(false)
const capturingSeedanceThumbnails = ref(false)
const assemblingSeedanceCut = ref(false)
const renderingSeedanceSubtitles = ref(false)
const mixingSeedanceAudio = ref(false)
const seedanceReturnImportInput = ref<HTMLInputElement | null>(null)
const seedanceAssetImportInput = ref<HTMLInputElement | null>(null)
const seedanceAudioImportInput = ref<HTMLInputElement | null>(null)
const editingEpisodeNo = ref<number | null>(null)
const episodeEditDraft = ref<EpisodeEditDraft | null>(null)
const episodeEditError = ref('')
const savingEpisodeEdit = ref(false)
const rebuildingLedger = ref(false)
const exportingBible = ref(false)
const exportingSeedance = ref(false)
const savedProjects = ref<AiComicSeriesProjectMeta[]>([])
const loadingSavedProjects = ref(false)
const savedProjectsError = ref('')
const showArchivedProjects = ref(false)
const managingProjectId = ref('')

interface EpisodeEditDraft {
  episode_no: number
  title: string
  target_duration_sec: number
  target_panel_count: number
  opening_hook: string
  main_conflict: string
  midpoint_turn: string
  continuity_from_previous_text: string
  new_information_text: string
  foreshadowing_text: string
  payoff_text: string
  ending_hook: string
  ending_hook_type: AiComicEndingHookType
  character_state_change: string
  thread_action: string
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
const earliestLedgerRebuildEpisode = computed(() => {
  const reports = seriesQualityAudit.value?.episode_reports ?? []
  const episodes = reports
    .filter(report => report.needs_ledger_rebuild)
    .map(report => report.episode_no)
  return episodes.length > 0 ? Math.min(...episodes) : null
})
const priorityThreadClosureItems = computed(() => {
  const items = seriesQualityAudit.value?.thread_closure_report?.items ?? []
  const weight: Record<AiComicThreadClosureStatus, number> = {
    overdue: 0,
    orphaned: 1,
    duplicate: 2,
    opened: 3,
    in_progress: 4,
    planned: 5,
    paid_off: 6,
  }
  return [...items]
    .filter(item => item.issues.length > 0 || item.status !== 'paid_off')
    .sort((a, b) => {
      const statusDiff = weight[a.status] - weight[b.status]
      if (statusDiff !== 0) return statusDiff
      return (a.related_episodes[0] ?? 999) - (b.related_episodes[0] ?? 999)
    })
    .slice(0, 5)
})
const priorityMemoryConflictItems = computed(() => {
  const items = seriesQualityAudit.value?.memory_conflict_report?.items ?? []
  const weight: Record<AiComicMemoryConflictSeverity, number> = {
    blocking: 0,
    warning: 1,
    watch: 2,
  }
  return [...items]
    .sort((a, b) => {
      const severityDiff = weight[a.severity] - weight[b.severity]
      if (severityDiff !== 0) return severityDiff
      return (a.related_episode_nos[0] ?? 999) - (b.related_episode_nos[0] ?? 999)
    })
    .slice(0, 5)
})
const seedanceProductionStats = computed(() => {
  const stats: Record<AiComicSeedanceProductionStatus, number> = {
    not_started: 0,
    prompt_exported: 0,
    submitted: 0,
    processing: 0,
    ready: 0,
    failed: 0,
    skipped: 0,
  }
  for (const item of seedanceProduction.value?.items ?? []) {
    stats[item.status] += 1
  }
  return stats
})
const seedanceProductionItems = computed(() =>
  [...(seedanceProduction.value?.items ?? [])]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 12)
)
const seedanceReadyVersionCount = computed(() =>
  (seedanceProduction.value?.items ?? []).reduce((count, item) =>
    count + item.versions.filter(version => version.status === 'ready' && Boolean(version.video_url)).length,
  0)
)
const seedanceThumbnailStats = computed(() => {
  const stats = {
    planned: 0,
    ready: 0,
    failed: 0,
    skipped: 0,
  }
  for (const item of seedanceProduction.value?.items ?? []) {
    const status = item.thumbnail?.status
    if (status === 'planned') stats.planned += 1
    if (status === 'ready') stats.ready += 1
    if (status === 'failed') stats.failed += 1
    if (status === 'skipped') stats.skipped += 1
  }
  return stats
})
const seedanceVersionComparisonShots = computed(() => {
  const shots = seedanceVersionComparison.value?.shots ?? []
  return [...shots]
    .filter(shot => shot.versions.length > 0)
    .sort((a, b) => {
      const aNeedsReview = Number(
        a.versions.length > 1
        || (a.selected_version_id && a.auto_best_version_id && a.selected_version_id !== a.auto_best_version_id)
        || a.failed_version_count > 0,
      )
      const bNeedsReview = Number(
        b.versions.length > 1
        || (b.selected_version_id && b.auto_best_version_id && b.selected_version_id !== b.auto_best_version_id)
        || b.failed_version_count > 0,
      )
      if (aNeedsReview !== bNeedsReview) return bNeedsReview - aNeedsReview
      if (a.episode_no !== b.episode_no) return a.episode_no - b.episode_no
      return a.shot_id.localeCompare(b.shot_id, 'zh-CN', { numeric: true })
    })
})
const nextRecommendedEpisode = computed(() => {
  if (!plan.value || earliestLedgerRebuildEpisode.value) return null
  const generated = new Set(Object.keys(generatedEpisodeStoryIds.value).map(Number))
  const ungenerated = plan.value.episodes
    .filter(episode => !generated.has(episode.episode_no))
    .sort((a, b) => a.episode_no - b.episode_no)
  if (ungenerated.length === 0) return null
  const nextAfterLedger = (continuityLedger.value?.last_generated_episode_no ?? 0) + 1
  return ungenerated.find(episode => episode.episode_no === nextAfterLedger) ?? ungenerated[0]
})
const episodeAuditByNo = computed(() => {
  return new Map((seriesQualityAudit.value?.episode_reports ?? []).map(report => [report.episode_no, report]))
})
const blueprintTimelineItems = computed(() => {
  if (!plan.value) return []
  return plan.value.episodes.map(episode => {
    const audit = episodeAuditByNo.value.get(episode.episode_no)
    const generated = Boolean(generatedEpisodeStoryIds.value[String(episode.episode_no)])
    const status = audit?.needs_episode_regeneration || audit?.needs_ledger_rebuild
      ? 'attention'
      : generated
        ? 'generated'
        : 'planned'
    return {
      episode,
      opening: episode.opening_hook || '承接开场',
      midpoint: episode.midpoint_turn || '中段转折',
      ending: episode.ending_hook,
      threadAction: episode.thread_action || [...episode.foreshadowing, ...episode.payoff][0] || '按阶段推进线索',
      status,
      statusLabel: timelineStatusLabel(status, audit?.status),
    }
  })
})
const characterStateRows = computed(() => {
  if (!plan.value) return []
  const lastGeneratedEpisodeNo = continuityLedger.value?.last_generated_episode_no ?? 0
  return plan.value.main_characters.map(character => {
    const currentState = continuityLedger.value?.character_state_current.find(state => state.includes(character.name))
      ?? character.turning_points
        .filter(point => point.episode_no <= lastGeneratedEpisodeNo)
        .sort((a, b) => b.episode_no - a.episode_no)[0]?.change
      ?? character.starting_state
    return {
      name: character.name,
      longArc: character.long_arc,
      currentState,
      turningPoints: character.turning_points.map(point => `第${point.episode_no}集 ${point.change}`),
    }
  })
})
const availableNarrativePatterns = computed<NarrativePattern[]>(() => {
  if (!narrativePatternCatalog.value) return []
  const patternIds = narrativePatternCatalog.value.video_type_map.ai_comic_drama ?? []
  return patternIds
    .map(patternId => narrativePatternCatalog.value?.patterns.find(pattern => pattern.pattern_id === patternId))
    .filter((pattern): pattern is NarrativePattern => Boolean(pattern))
})
const activeNarrativePatternLabels = computed(() => {
  const selected = new Set(selectedNarrativePatternIds.value)
  return availableNarrativePatterns.value
    .filter(pattern => selected.size === 0 || selected.has(pattern.pattern_id))
    .map(pattern => pattern.label)
})
const saveStatusLabel = computed(() => {
  const map: Record<SaveStatus, string> = {
    idle: '尚未保存',
    saving: '保存中',
    saved: '已保存',
    failed: '保存失败',
  }
  return map[saveStatus.value]
})
const affectedEpisodeText = computed(() => {
  if (affectedEpisodeNos.value.length === 0) return ''
  return `已影响第 ${affectedEpisodeNos.value.join('、')} 集生成`
})
const filteredMemoryRecallItems = computed(() => {
  const items = contextPreview.value?.focused_memory_recall?.items ?? []
  const entityQuery = memoryRecallEntityFilter.value.trim().toLowerCase()
  return items.filter(item => {
    const categoryOk = memoryRecallCategoryFilter.value === 'all' || item.category === memoryRecallCategoryFilter.value
    const statusOk = memoryRecallStatusFilter.value === 'all'
      || (memoryRecallStatusFilter.value === 'locked' && lockedMemoryIds.value.includes(item.memory_id))
      || (memoryRecallStatusFilter.value === 'excluded' && excludedMemoryIds.value.includes(item.memory_id))
    const entityOk = !entityQuery || [
      item.label,
      item.status,
      ...item.continuity_notes,
      memoryCategoryLabel(item.category),
    ].some(value => value.toLowerCase().includes(entityQuery))
    return categoryOk && statusOk && entityOk
  })
})

function styleAxisValueLabel(value: 'low' | 'medium' | 'high') {
  if (value === 'high') return '高'
  if (value === 'low') return '低'
  return '中'
}

function timelineStatusLabel(
  status: 'planned' | 'generated' | 'attention',
  auditStatus?: AiComicSeriesQualityEpisodeStatus,
): string {
  if (status === 'attention') return '需处理'
  if (status === 'generated') {
    if (auditStatus === 'passed') return '已生成 · 通过'
    if (auditStatus === 'needs_attention') return '已生成 · 待看'
    return '已生成'
  }
  return '规划中'
}

onMounted(async () => {
  const patternRes = await getNarrativePatternCatalog()
  if (patternRes.ok && patternRes.data) {
    narrativePatternCatalog.value = patternRes.data
  }
  await loadSavedProjects()
  const id = typeof route.query.seriesProjectId === 'string' ? route.query.seriesProjectId : ''
  if (!id) return
  await loadSeriesProject(id)
  const episodeNo = routeEpisodeNo()
  if (episodeNo) {
    await previewRequestedEpisode(episodeNo)
  }
})

async function loadSeriesProject(id: string) {
  planning.value = true
  errorMessage.value = ''
  episodeResult.value = null
  episodeErrorMessage.value = ''
  generatedEpisodeNo.value = null
  clearContextPreview()
  cancelEditEpisode()
  const res = await getAiComicSeriesProject(id)
  if (res.ok && res.data) {
    seriesProjectId.value = res.data.project.series_project_id
    generatedEpisodeStoryIds.value = res.data.generated_episode_story_ids
    continuityLedger.value = res.data.continuity_ledger
    memoryRecallPreferences.value = normalizeMemoryRecallPreferences(res.data.memory_recall_preferences)
    applyMemoryPreferenceForEpisode(activeMemoryPreferenceEpisodeNo.value)
    seriesQualityAudit.value = res.data.series_quality_audit ?? null
    seedanceProduction.value = res.data.seedance_production ?? null
    seedanceCutAssembly.value = res.data.seedance_cut_assembly ?? null
    seedanceSubtitleRender.value = res.data.seedance_subtitle_render ?? null
    seedanceAudioMix.value = res.data.seedance_audio_mix ?? null
    seedanceVersionComparison.value = null
    showSeedanceVersionComparison.value = false
    applyPlan(res.data.plan)
    saveMessage.value = `已保存：${res.data.project.series_project_id} · ${formatDate(res.data.project.updated_at)}`
    saveStatus.value = 'saved'
    saveErrorMessage.value = ''
    lastSavedAt.value = res.data.project.updated_at
    affectedEpisodeNos.value = []
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
  clearContextPreview()
  seriesProjectId.value = ''
  saveMessage.value = ''
  saveStatus.value = 'idle'
  saveErrorMessage.value = ''
  lastSavedAt.value = ''
  affectedEpisodeNos.value = []
  generatedEpisodeStoryIds.value = {}
  lockedMemoryIds.value = []
  excludedMemoryIds.value = []
  memoryRecallPreferences.value = {}
  activeMemoryPreferenceEpisodeNo.value = null
  continuityLedger.value = null
  seriesQualityAudit.value = null
  seedanceProduction.value = null
  seedanceCutAssembly.value = null
  seedanceSubtitleRender.value = null
  seedanceAudioMix.value = null
  seedanceVersionComparison.value = null
  showSeedanceVersionComparison.value = false

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
    narrative_pattern_ids: selectedNarrativePatternIds.value.length > 0 ? selectedNarrativePatternIds.value : undefined,
  })

  if (res.ok && res.data) {
    applyPlan(res.data)
    await saveCurrentProject({ message: '系列规划已自动保存' })
    await loadSavedProjects()
  } else {
    errorMessage.value = res.error?.message ?? '系列规划生成失败'
  }
  planning.value = false
}

async function handleGenerateEpisode(episodeNo: number) {
  if (!plan.value || generatingEpisodeNo.value !== null) return
  applyMemoryPreferenceForEpisode(episodeNo)
  if (!seriesProjectId.value) {
    await saveCurrentProject()
  }
  generatingEpisodeNo.value = episodeNo
  generatedEpisodeNo.value = episodeNo
  episodeResult.value = null
  episodeErrorMessage.value = ''
  clearContextPreview()

  const res = await aiComicEpisodeGenerate({
    series_plan: plan.value,
    episode_no: episodeNo,
    series_project_id: seriesProjectId.value || undefined,
    output_gears_segments: true,
    auto_audit_continuity: true,
    auto_repair_episode: autoRepairEpisode.value,
    narrative_pattern_ids: selectedNarrativePatternIds.value.length > 0 ? selectedNarrativePatternIds.value : undefined,
    memory_recall_controls: buildMemoryRecallControls(),
  })

  if (res.ok && res.data) {
    episodeResult.value = res.data
    generatedEpisodeStoryIds.value = {
      ...generatedEpisodeStoryIds.value,
      [String(episodeNo)]: res.data.storyId,
    }
    await saveCurrentProject({ message: `第${episodeNo}集生成结果已自动保存`, affectedEpisodeNos: [episodeNo] })
    await loadSavedProjects()
  } else {
    episodeErrorMessage.value = res.error?.message ?? '本集分镜生成失败'
  }
  generatingEpisodeNo.value = null
}

async function handlePreviewEpisodeContext(episodeNo: number) {
  if (!plan.value || previewingEpisodeNo.value !== null) return
  applyMemoryPreferenceForEpisode(episodeNo)
  if (!seriesProjectId.value) {
    await saveCurrentProject({ message: '上下文预览前已自动保存' })
  }
  previewingEpisodeNo.value = episodeNo
  contextPreview.value = null
  contextPreviewError.value = ''

  const res = await aiComicEpisodeContextPreview({
    series_plan: plan.value,
    episode_no: episodeNo,
    series_project_id: seriesProjectId.value || undefined,
    narrative_pattern_ids: selectedNarrativePatternIds.value.length > 0 ? selectedNarrativePatternIds.value : undefined,
    memory_recall_controls: buildMemoryRecallControls(),
  })

  if (res.ok && res.data) {
    contextPreview.value = res.data
  } else {
    contextPreviewError.value = res.error?.message ?? '生成上下文预览失败'
  }
  previewingEpisodeNo.value = null
}

function routeEpisodeNo(): number | null {
  const value = typeof route.query.episodeNo === 'string' ? Number(route.query.episodeNo) : NaN
  if (!Number.isInteger(value) || value < 1) return null
  return value
}

async function previewRequestedEpisode(episodeNo: number) {
  if (!plan.value?.episodes.some(episode => episode.episode_no === episodeNo)) return
  await handlePreviewEpisodeContext(episodeNo)
  if (!contextPreviewError.value) {
    saveMessage.value = `已定位到第${episodeNo}集，可继续生成或先查看上下文预览。`
  }
}

function clearContextPreview() {
  contextPreview.value = null
  previewingEpisodeNo.value = null
  contextPreviewError.value = ''
}

function buildMemoryRecallControls(): AiComicSeriesMemoryRecallControls | undefined {
  if (lockedMemoryIds.value.length === 0 && excludedMemoryIds.value.length === 0) return undefined
  return {
    locked_memory_ids: lockedMemoryIds.value.length > 0 ? lockedMemoryIds.value : undefined,
    excluded_memory_ids: excludedMemoryIds.value.length > 0 ? excludedMemoryIds.value : undefined,
  }
}

function normalizeMemoryRecallPreferences(
  preferences?: AiComicSeriesMemoryRecallPreferences,
): AiComicSeriesMemoryRecallPreferences {
  return {
    locked_memory_ids: [...(preferences?.locked_memory_ids ?? [])],
    excluded_memory_ids: [...(preferences?.excluded_memory_ids ?? [])],
    per_episode: Object.fromEntries(
      Object.entries(preferences?.per_episode ?? {}).map(([episodeNo, controls]) => [episodeNo, {
        locked_memory_ids: [...(controls.locked_memory_ids ?? [])],
        excluded_memory_ids: [...(controls.excluded_memory_ids ?? [])],
      }]),
    ),
    updated_at: preferences?.updated_at,
  }
}

function applyMemoryPreferenceForEpisode(episodeNo: number | null) {
  activeMemoryPreferenceEpisodeNo.value = episodeNo
  const episodeControls = episodeNo ? memoryRecallPreferences.value.per_episode?.[String(episodeNo)] : undefined
  lockedMemoryIds.value = [...(episodeControls?.locked_memory_ids ?? memoryRecallPreferences.value.locked_memory_ids ?? [])]
  excludedMemoryIds.value = [...(episodeControls?.excluded_memory_ids ?? memoryRecallPreferences.value.excluded_memory_ids ?? [])]
}

function updateActiveEpisodeMemoryPreference() {
  const controls = buildMemoryRecallControls() ?? {}
  const episodeNo = activeMemoryPreferenceEpisodeNo.value
  memoryRecallPreferences.value = {
    ...memoryRecallPreferences.value,
    per_episode: episodeNo
      ? {
          ...(memoryRecallPreferences.value.per_episode ?? {}),
          [String(episodeNo)]: controls,
        }
      : memoryRecallPreferences.value.per_episode,
    locked_memory_ids: episodeNo ? memoryRecallPreferences.value.locked_memory_ids : controls.locked_memory_ids,
    excluded_memory_ids: episodeNo ? memoryRecallPreferences.value.excluded_memory_ids : controls.excluded_memory_ids,
    updated_at: new Date().toISOString(),
  }
}

function toggleLockedMemory(memoryId: string) {
  lockedMemoryIds.value = lockedMemoryIds.value.includes(memoryId)
    ? lockedMemoryIds.value.filter(id => id !== memoryId)
    : [...lockedMemoryIds.value, memoryId]
  if (lockedMemoryIds.value.includes(memoryId)) {
    excludedMemoryIds.value = excludedMemoryIds.value.filter(id => id !== memoryId)
  }
  updateActiveEpisodeMemoryPreference()
  void saveCurrentProject({ message: '记忆召回偏好已保存' })
}

function toggleExcludedMemory(memoryId: string) {
  excludedMemoryIds.value = excludedMemoryIds.value.includes(memoryId)
    ? excludedMemoryIds.value.filter(id => id !== memoryId)
    : [...excludedMemoryIds.value, memoryId]
  if (excludedMemoryIds.value.includes(memoryId)) {
    lockedMemoryIds.value = lockedMemoryIds.value.filter(id => id !== memoryId)
  }
  updateActiveEpisodeMemoryPreference()
  void saveCurrentProject({ message: '记忆召回偏好已保存' })
}

function lockFilteredMemoryItems() {
  const ids = filteredMemoryRecallItems.value.map(item => item.memory_id)
  if (ids.length === 0) return
  lockedMemoryIds.value = uniqueStrings([...lockedMemoryIds.value, ...ids])
  excludedMemoryIds.value = excludedMemoryIds.value.filter(id => !ids.includes(id))
  updateActiveEpisodeMemoryPreference()
  void saveCurrentProject({ message: `已锁定 ${ids.length} 条筛选记忆` })
}

function excludeFilteredMemoryItems() {
  const ids = filteredMemoryRecallItems.value.map(item => item.memory_id)
  if (ids.length === 0) return
  excludedMemoryIds.value = uniqueStrings([...excludedMemoryIds.value, ...ids])
  lockedMemoryIds.value = lockedMemoryIds.value.filter(id => !ids.includes(id))
  updateActiveEpisodeMemoryPreference()
  void saveCurrentProject({ message: `已排除 ${ids.length} 条筛选记忆` })
}

function clearFilteredMemoryPreferences() {
  const ids = filteredMemoryRecallItems.value.map(item => item.memory_id)
  if (ids.length === 0) return
  lockedMemoryIds.value = lockedMemoryIds.value.filter(id => !ids.includes(id))
  excludedMemoryIds.value = excludedMemoryIds.value.filter(id => !ids.includes(id))
  updateActiveEpisodeMemoryPreference()
  void saveCurrentProject({ message: `已清空 ${ids.length} 条筛选记忆偏好` })
}

function clearActiveMemoryLocks() {
  if (lockedMemoryIds.value.length === 0) return
  lockedMemoryIds.value = []
  updateActiveEpisodeMemoryPreference()
  void saveCurrentProject({ message: '记忆锁定已清空' })
}

function clearActiveMemoryExclusions() {
  if (excludedMemoryIds.value.length === 0) return
  excludedMemoryIds.value = []
  updateActiveEpisodeMemoryPreference()
  void saveCurrentProject({ message: '记忆排除已清空' })
}

function exportMemoryRecallPreferences() {
  const payload = {
    schema_version: 'ai-comic-series-memory-recall-preferences/v1',
    exported_at: new Date().toISOString(),
    series_project_id: seriesProjectId.value || undefined,
    series_title: plan.value?.series_title,
    memory_recall_preferences: {
      ...normalizeMemoryRecallPreferences(memoryRecallPreferences.value),
      updated_at: new Date().toISOString(),
    },
  }
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const safeTitle = (plan.value?.series_title || 'ai-comic-series').replace(/[^\u4e00-\u9fa5A-Za-z0-9_-]+/g, '-')
  link.href = url
  link.download = `${safeTitle}-memory-recall-preferences.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  saveMessage.value = '记忆召回偏好已导出'
}

function triggerMemoryRecallPreferenceImport() {
  memoryPreferenceImportInput.value?.click()
}

async function handleMemoryRecallPreferenceImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const raw = await file.text()
    const parsed = JSON.parse(raw) as ({
      memory_recall_preferences?: AiComicSeriesMemoryRecallPreferences;
    } | AiComicSeriesMemoryRecallPreferences | null)
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid memory recall preference file')
    }
    const parsedRecord = parsed as Record<string, unknown>
    const imported = parsedRecord.memory_recall_preferences && typeof parsedRecord.memory_recall_preferences === 'object'
      ? parsedRecord.memory_recall_preferences as AiComicSeriesMemoryRecallPreferences
      : parsed as AiComicSeriesMemoryRecallPreferences
    memoryRecallPreferences.value = normalizeMemoryRecallPreferences(imported)
    applyMemoryPreferenceForEpisode(activeMemoryPreferenceEpisodeNo.value)
    await saveCurrentProject({ message: '记忆召回偏好已导入' })
  } catch {
    saveStatus.value = 'failed'
    saveErrorMessage.value = '导入失败：请选择有效的记忆召回偏好 JSON 文件'
  }
}

function memoryCategoryLabel(category: AiComicSeriesMemoryCategory): string {
  const map: Record<AiComicSeriesMemoryCategory, string> = {
    character: '角色',
    relationship: '关系',
    prop: '道具',
    location: '地点',
    visual_asset: '视觉资产',
    knowledge_boundary: '知识边界',
    story_event: '关键事件',
  }
  return map[category]
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
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
    opening_hook: episode.opening_hook ?? '',
    main_conflict: episode.main_conflict,
    midpoint_turn: episode.midpoint_turn ?? '',
    continuity_from_previous_text: episode.continuity_from_previous.join('\n'),
    new_information_text: episode.new_information.join('\n'),
    foreshadowing_text: episode.foreshadowing.join('\n'),
    payoff_text: episode.payoff.join('\n'),
    ending_hook: episode.ending_hook,
    ending_hook_type: episode.ending_hook_type ?? 'reveal',
    character_state_change: episode.character_state_change ?? episode.continuity_state_after[0] ?? '',
    thread_action: episode.thread_action ?? '',
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
  const wasGenerated = Boolean(episodeStoryId(draft.episode_no))
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
      opening_hook: draft.opening_hook.trim() || undefined,
      main_conflict: mainConflict,
      midpoint_turn: draft.midpoint_turn.trim() || undefined,
      continuity_from_previous: parseListText(draft.continuity_from_previous_text),
      new_information: parseListText(draft.new_information_text),
      foreshadowing: parseListText(draft.foreshadowing_text),
      payoff: parseListText(draft.payoff_text),
      ending_hook: endingHook,
      ending_hook_type: draft.ending_hook_type,
      character_state_change: draft.character_state_change.trim() || undefined,
      thread_action: draft.thread_action.trim() || undefined,
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
  const saved = await saveCurrentProject({
    message: wasGenerated
      ? `已保存第${draft.episode_no}集卡片。该集已有分镜，建议重新生成本集。`
      : `已保存第${draft.episode_no}集卡片。`,
    affectedEpisodeNos: [draft.episode_no],
  })
  if (saved) {
    await loadSavedProjects()
  }
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
  selectedNarrativePatternIds.value = [...(nextPlan.narrative_pattern_ids ?? [])]
}

async function saveCurrentProject(options: {
  message?: string;
  affectedEpisodeNos?: number[];
} = {}): Promise<boolean> {
  if (!plan.value) return false
  saveStatus.value = 'saving'
  saveErrorMessage.value = ''
  if (options.affectedEpisodeNos) {
    affectedEpisodeNos.value = [...options.affectedEpisodeNos]
  } else if (options.message) {
    affectedEpisodeNos.value = []
  }
  const res = await saveAiComicSeriesProject({
    series_project_id: seriesProjectId.value || undefined,
    plan: plan.value,
    generated_episode_story_ids: generatedEpisodeStoryIds.value,
    memory_recall_preferences: {
      ...memoryRecallPreferences.value,
      updated_at: new Date().toISOString(),
    },
  })
  if (res.ok && res.data) {
    seriesProjectId.value = res.data.project.series_project_id
    generatedEpisodeStoryIds.value = res.data.generated_episode_story_ids
    continuityLedger.value = res.data.continuity_ledger
    memoryRecallPreferences.value = normalizeMemoryRecallPreferences(res.data.memory_recall_preferences)
    applyMemoryPreferenceForEpisode(activeMemoryPreferenceEpisodeNo.value)
    seriesQualityAudit.value = res.data.series_quality_audit ?? null
    seedanceProduction.value = res.data.seedance_production ?? null
    seedanceCutAssembly.value = res.data.seedance_cut_assembly ?? null
    seedanceSubtitleRender.value = res.data.seedance_subtitle_render ?? null
    seedanceAudioMix.value = res.data.seedance_audio_mix ?? null
    saveStatus.value = 'saved'
    lastSavedAt.value = res.data.project.updated_at
    saveMessage.value = options.message
      ? `${options.message} · ${res.data.project.series_project_id}`
      : `已保存：${res.data.project.series_project_id} · ${formatDate(res.data.project.updated_at)}`
    if (route.query.seriesProjectId !== seriesProjectId.value) {
      router.replace({
        path: route.path,
        query: {
          ...route.query,
          seriesProjectId: seriesProjectId.value,
        },
      })
    }
    return true
  } else {
    saveStatus.value = 'failed'
    saveErrorMessage.value = res.error?.message ?? '保存系列规划失败'
    errorMessage.value = saveErrorMessage.value
    return false
  }
}

async function handleManualSave() {
  const saved = await saveCurrentProject({ message: '已手动保存系列规划' })
  if (saved) await loadSavedProjects()
}

async function handleRebuildLedger() {
  if (!seriesProjectId.value || !earliestLedgerRebuildEpisode.value) return
  const fromEpisodeNo = earliestLedgerRebuildEpisode.value
  rebuildingLedger.value = true
  errorMessage.value = ''
  const res = await rebuildAiComicSeriesLedger(seriesProjectId.value, {
    from_episode_no: fromEpisodeNo,
  })
  if (res.ok && res.data) {
    generatedEpisodeStoryIds.value = res.data.generated_episode_story_ids
    continuityLedger.value = res.data.continuity_ledger
    seriesQualityAudit.value = res.data.series_quality_audit ?? null
    seedanceProduction.value = res.data.seedance_production ?? null
    seedanceCutAssembly.value = res.data.seedance_cut_assembly ?? null
    seedanceSubtitleRender.value = res.data.seedance_subtitle_render ?? null
    seedanceAudioMix.value = res.data.seedance_audio_mix ?? null
    applyPlan(res.data.plan)
    saveStatus.value = 'saved'
    saveErrorMessage.value = ''
    lastSavedAt.value = res.data.project.updated_at
    affectedEpisodeNos.value = []
    saveMessage.value = `已从第${fromEpisodeNo}集重建连续性账本 · ${formatDate(res.data.project.updated_at)}`
    await loadSavedProjects()
  } else {
    errorMessage.value = res.error?.message ?? '重建连续性账本失败'
  }
  rebuildingLedger.value = false
}

async function exportSeriesBibleMarkdown() {
  if (!seriesProjectId.value) return
  exportingBible.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesBible(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-series-bible.md`,
      res.data.markdown,
      'text/markdown;charset=utf-8',
    )
    saveMessage.value = `系列 Bible Markdown 已导出 · ${formatDate(res.data.exported_at)}`
  } else {
    errorMessage.value = res.error?.message ?? '导出系列 Bible 失败'
  }
  exportingBible.value = false
}

async function exportSeriesBibleJson() {
  if (!seriesProjectId.value) return
  exportingBible.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesBible(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-series-bible.json`,
      JSON.stringify(res.data, null, 2),
      'application/json;charset=utf-8',
    )
    saveMessage.value = `系列 Bible JSON 已导出 · ${formatDate(res.data.exported_at)}`
  } else {
    errorMessage.value = res.error?.message ?? '导出系列 Bible 失败'
  }
  exportingBible.value = false
}

async function exportSeriesSeedanceMarkdown() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedancePrompts(seriesProjectId.value)
  if (res.ok && res.data) {
    seedanceProduction.value = res.data.seedance_production ?? seedanceProduction.value
    downloadText(
      `${res.data.project.series_project_id}-seedance-prompts.md`,
      res.data.markdown,
      'text/markdown;charset=utf-8',
    )
    saveMessage.value = `Seedance Markdown 已导出 · ${res.data.total_shot_count} 个镜头`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance 提示词失败'
  }
  exportingSeedance.value = false
}

async function exportSeriesSeedanceJson() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedancePrompts(seriesProjectId.value)
  if (res.ok && res.data) {
    seedanceProduction.value = res.data.seedance_production ?? seedanceProduction.value
    downloadText(
      `${res.data.project.series_project_id}-seedance-prompts.json`,
      JSON.stringify(res.data, null, 2),
      'application/json;charset=utf-8',
    )
    saveMessage.value = `Seedance JSON 已导出 · ${res.data.generated_episode_count}/${res.data.total_episode_count} 集`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance 提示词失败'
  }
  exportingSeedance.value = false
}

async function exportSeriesSeedanceCutMarkdown() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedanceCutPackage(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-cut-package.md`,
      res.data.markdown,
      'text/markdown;charset=utf-8',
    )
    saveMessage.value = `Seedance 剪辑包 Markdown 已导出 · 可剪 ${res.data.total_ready_shot_count} 个镜头`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance 剪辑包失败'
  }
  exportingSeedance.value = false
}

async function exportSeriesSeedanceCutJson() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedanceCutPackage(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-cut-package.json`,
      JSON.stringify(res.data, null, 2),
      'application/json;charset=utf-8',
    )
    saveMessage.value = `Seedance 剪辑包 JSON 已导出 · 缺失 ${res.data.total_missing_shot_count} 个镜头`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance 剪辑包失败'
  }
  exportingSeedance.value = false
}

async function exportSeriesSeedanceRetryMarkdown() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedanceRetryPackage(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-retry-package.md`,
      res.data.markdown,
      'text/markdown;charset=utf-8',
    )
    saveMessage.value = `Seedance 重试包 Markdown 已导出 · ${res.data.total_retry_shot_count} 个镜头`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance 重试包失败'
  }
  exportingSeedance.value = false
}

async function exportSeriesSeedanceRetryJson() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedanceRetryPackage(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-retry-package.json`,
      JSON.stringify(res.data, null, 2),
      'application/json;charset=utf-8',
    )
    saveMessage.value = `Seedance 重试包 JSON 已导出 · ${res.data.total_retry_shot_count} 个镜头`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance 重试包失败'
  }
  exportingSeedance.value = false
}

async function exportSeriesSeedanceVersionComparisonMarkdown() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedanceVersionComparisonPackage(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-version-comparison.md`,
      res.data.markdown,
      'text/markdown;charset=utf-8',
    )
    saveMessage.value = `Seedance 版本对比 Markdown 已导出 · ${res.data.comparable_shot_count} 个多版本镜头`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance 版本对比失败'
  }
  exportingSeedance.value = false
}

async function exportSeriesSeedanceVersionComparisonJson() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedanceVersionComparisonPackage(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-version-comparison.json`,
      JSON.stringify(res.data, null, 2),
      'application/json;charset=utf-8',
    )
    saveMessage.value = `Seedance 版本对比 JSON 已导出 · 已选 ${res.data.selected_shot_count} 个镜头`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance 版本对比失败'
  }
  exportingSeedance.value = false
}

async function exportSeriesSeedanceAssetReportMarkdown() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedanceAssetReportPackage(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-asset-report.md`,
      res.data.markdown,
      'text/markdown;charset=utf-8',
    )
    saveMessage.value = `Seedance 素材报告 Markdown 已导出 · ${res.data.total_asset_count} 个素材项`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance 素材报告失败'
  }
  exportingSeedance.value = false
}

async function exportSeriesSeedanceAssetReportJson() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedanceAssetReportPackage(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-asset-report.json`,
      JSON.stringify(res.data, null, 2),
      'application/json;charset=utf-8',
    )
    saveMessage.value = `Seedance 素材报告 JSON 已导出 · ${res.data.unbound_shot_count} 个镜头需补引用`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance 素材报告失败'
  }
  exportingSeedance.value = false
}

async function exportSeriesSeedanceEditAssetMarkdown() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedanceEditAssetPackage(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-edit-asset-package.md`,
      res.data.markdown,
      'text/markdown;charset=utf-8',
    )
    saveMessage.value = `Seedance 剪辑台资产包 Markdown 已导出 · ${res.data.total_ready_shot_count} 个镜头`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance 剪辑台资产包失败'
  }
  exportingSeedance.value = false
}

async function exportSeriesSeedanceEditAssetJson() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedanceEditAssetPackage(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-edit-asset-package.json`,
      JSON.stringify(res.data, null, 2),
      'application/json;charset=utf-8',
    )
    saveMessage.value = `Seedance 剪辑台资产包 JSON 已导出 · 缺素材 ${res.data.total_missing_asset_count} 项`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance 剪辑台资产包失败'
  }
  exportingSeedance.value = false
}

async function exportSeriesSeedanceThumbnailPlanMarkdown() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedanceThumbnailPlanPackage(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-thumbnail-plan.md`,
      res.data.markdown,
      'text/markdown;charset=utf-8',
    )
    saveMessage.value = `Seedance 缩略图计划 Markdown 已导出 · ${res.data.total_ready_shot_count} 个镜头`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance 缩略图计划失败'
  }
  exportingSeedance.value = false
}

async function exportSeriesSeedanceThumbnailPlanJson() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedanceThumbnailPlanPackage(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-thumbnail-plan.json`,
      JSON.stringify(res.data, null, 2),
      'application/json;charset=utf-8',
    )
    saveMessage.value = `Seedance 缩略图计划 JSON 已导出 · 缺视频 ${res.data.total_missing_shot_count} 个镜头`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance 缩略图计划失败'
  }
  exportingSeedance.value = false
}

async function exportSeriesSeedanceFinishingPlanMarkdown() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedanceFinishingPlanPackage(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-finishing-plan.md`,
      res.data.markdown,
      'text/markdown;charset=utf-8',
    )
    saveMessage.value = `Seedance 成片精修计划 Markdown 已导出 · ${res.data.total_ready_shot_count} 个镜头`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance 成片精修计划失败'
  }
  exportingSeedance.value = false
}

async function exportSeriesSeedanceFinishingPlanJson() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedanceFinishingPlanPackage(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-finishing-plan.json`,
      JSON.stringify(res.data, null, 2),
      'application/json;charset=utf-8',
    )
    saveMessage.value = `Seedance 成片精修计划 JSON 已导出 · ${res.data.subtitle_cues.length} 条字幕 cue`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance 成片精修计划失败'
  }
  exportingSeedance.value = false
}

async function exportSeriesSeedanceSrt() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedanceSubtitlePackage(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      res.data.srt_filename,
      res.data.srt_content,
      'text/plain;charset=utf-8',
    )
    saveMessage.value = `Seedance SRT 字幕已导出 · ${res.data.cue_count} 条 cue`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance SRT 字幕失败'
  }
  exportingSeedance.value = false
}

async function exportSeriesSeedanceAudioPlanMarkdown() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedanceAudioPlanPackage(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-audio-plan.md`,
      res.data.markdown,
      'text/markdown;charset=utf-8',
    )
    saveMessage.value = `Seedance 音频计划 Markdown 已导出 · 缺素材 ${res.data.missing_audio_count} 项`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance 音频计划失败'
  }
  exportingSeedance.value = false
}

async function exportSeriesSeedanceAudioPlanJson() {
  if (!seriesProjectId.value) return
  exportingSeedance.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedanceAudioPlanPackage(seriesProjectId.value)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-audio-plan.json`,
      JSON.stringify(res.data, null, 2),
      'application/json;charset=utf-8',
    )
    saveMessage.value = `Seedance 音频计划 JSON 已导出 · ${res.data.total_audio_cue_count} 条 cue`
  } else {
    errorMessage.value = res.error?.message ?? '导出 Seedance 音频计划失败'
  }
  exportingSeedance.value = false
}

async function toggleSeedanceVersionComparison() {
  showSeedanceVersionComparison.value = !showSeedanceVersionComparison.value
  if (showSeedanceVersionComparison.value && !seedanceVersionComparison.value) {
    await loadSeedanceVersionComparison()
  }
}

async function loadSeedanceVersionComparison() {
  if (!seriesProjectId.value || loadingSeedanceVersionComparison.value) return
  loadingSeedanceVersionComparison.value = true
  errorMessage.value = ''
  const res = await exportAiComicSeriesSeedanceVersionComparisonPackage(seriesProjectId.value)
  if (res.ok && res.data) {
    seedanceVersionComparison.value = res.data
    saveMessage.value = `版本对比已加载 · ${res.data.comparable_shot_count} 个多版本镜头`
  } else {
    errorMessage.value = res.error?.message ?? '加载 Seedance 版本对比失败'
  }
  loadingSeedanceVersionComparison.value = false
}

async function refreshSeedanceVersionComparisonIfVisible() {
  if (!showSeedanceVersionComparison.value || !seedanceVersionComparison.value) return
  await loadSeedanceVersionComparison()
}

async function markSeedanceProduction(
  item: AiComicSeedanceShotProductionItem,
  status: AiComicSeedanceProductionStatus,
) {
  if (!seriesProjectId.value || updatingSeedanceProductionId.value) return
  updatingSeedanceProductionId.value = item.production_id
  errorMessage.value = ''
  const res = await updateAiComicSeriesSeedanceProductionStatus(seriesProjectId.value, {
    episode_no: item.episode_no,
    shot_id: item.shot_id,
    status,
    note: `前端快捷标记：${seedanceProductionStatusLabel(status)}`,
  })
  if (res.ok && res.data) {
    seedanceProduction.value = res.data.seedance_production ?? null
    lastSavedAt.value = res.data.project.updated_at
    saveMessage.value = `已更新 ${item.shot_id}：${seedanceProductionStatusLabel(status)}`
    await refreshSeedanceVersionComparisonIfVisible()
  } else {
    errorMessage.value = res.error?.message ?? '更新 Seedance 生产状态失败'
  }
  updatingSeedanceProductionId.value = ''
}

async function selectSeedanceProductionVersion(
  item: AiComicSeedanceShotProductionItem,
  versionId: string,
) {
  if (!seriesProjectId.value || updatingSeedanceProductionId.value) return
  updatingSeedanceProductionId.value = item.production_id
  errorMessage.value = ''
  const res = await selectAiComicSeriesSeedanceProductionVersion(seriesProjectId.value, {
    episode_no: item.episode_no,
    shot_id: item.shot_id,
    version_id: versionId,
    note: `前端选择剪辑版本：${versionId}`,
  })
  if (res.ok && res.data) {
    seedanceProduction.value = res.data.seedance_production ?? null
    lastSavedAt.value = res.data.project.updated_at
    saveMessage.value = `已选择 ${item.shot_id} 的剪辑版本：${versionId}`
    await refreshSeedanceVersionComparisonIfVisible()
  } else {
    errorMessage.value = res.error?.message ?? '选择 Seedance 剪辑版本失败'
  }
  updatingSeedanceProductionId.value = ''
}

async function selectSeedanceComparisonVersion(
  shot: AiComicSeedanceVersionComparisonShot,
  versionId: string,
) {
  if (!seriesProjectId.value || updatingSeedanceProductionId.value) return
  updatingSeedanceProductionId.value = shot.production_id
  errorMessage.value = ''
  const res = await selectAiComicSeriesSeedanceProductionVersion(seriesProjectId.value, {
    episode_no: shot.episode_no,
    shot_id: shot.shot_id,
    version_id: versionId,
    note: `前端版本对比选择剪辑版本：${versionId}`,
  })
  if (res.ok && res.data) {
    seedanceProduction.value = res.data.seedance_production ?? null
    lastSavedAt.value = res.data.project.updated_at
    saveMessage.value = `已选择 ${shot.shot_id} 的剪辑版本：${versionId}`
    await loadSeedanceVersionComparison()
  } else {
    errorMessage.value = res.error?.message ?? '选择 Seedance 剪辑版本失败'
  }
  updatingSeedanceProductionId.value = ''
}

async function autoSelectSeedanceProductionVersions() {
  if (!seriesProjectId.value || batchUpdatingSeedance.value) return
  batchUpdatingSeedance.value = true
  errorMessage.value = ''
  const res = await autoSelectAiComicSeriesSeedanceProductionVersions(seriesProjectId.value, {
    overwrite_manual: false,
    note: '前端自动择优剪辑版本',
  })
  if (res.ok && res.data) {
    seedanceProduction.value = res.data.seedance_production ?? null
    lastSavedAt.value = res.data.project.updated_at
    const selectedCount = (res.data.seedance_production?.items ?? []).filter(item => item.selected_version_id).length
    saveMessage.value = `已自动择优剪辑版 · 当前 ${selectedCount} 个镜头有剪辑版本`
    await refreshSeedanceVersionComparisonIfVisible()
  } else {
    errorMessage.value = res.error?.message ?? '自动择优 Seedance 剪辑版本失败'
  }
  batchUpdatingSeedance.value = false
}

async function captureSeedanceThumbnails() {
  if (!seriesProjectId.value || capturingSeedanceThumbnails.value) return
  capturingSeedanceThumbnails.value = true
  errorMessage.value = ''
  const res = await captureAiComicSeriesSeedanceThumbnails(seriesProjectId.value, {
    dry_run: false,
    overwrite: false,
  })
  if (res.ok && res.data) {
    seedanceProduction.value = res.data.seedance_production
    lastSavedAt.value = res.data.project.updated_at
    saveMessage.value = `缩略图抽帧完成 · 生成 ${res.data.captured_count} 个 · 跳过 ${res.data.skipped_count} 个 · 失败 ${res.data.failed_count} 个`
  } else {
    errorMessage.value = res.error?.message ?? '生成 Seedance 缩略图失败'
  }
  capturingSeedanceThumbnails.value = false
}

async function assembleSeedanceCut(mode: 'copy' | 'transcode') {
  if (!seriesProjectId.value || assemblingSeedanceCut.value) return
  assemblingSeedanceCut.value = true
  errorMessage.value = ''
  const res = await assembleAiComicSeriesSeedanceCut(seriesProjectId.value, {
    dry_run: false,
    overwrite: false,
    assembly_mode: mode,
    output_profile: mode === 'transcode' ? 'mp4_h264_1080p' : 'source_copy',
  })
  if (res.ok && res.data) {
    seedanceCutAssembly.value = res.data.seedance_cut_assembly
    lastSavedAt.value = res.data.project.updated_at
    saveMessage.value = `${mode === 'transcode' ? '转码装配' : '剪辑装配'}${res.data.status === 'assembled' ? '完成' : seedanceCutAssemblyStatusLabel(res.data.seedance_cut_assembly.status)} · ${res.data.source_shot_count} 个镜头`
  } else {
    errorMessage.value = res.error?.message ?? '装配 Seedance 剪辑成片失败'
  }
  assemblingSeedanceCut.value = false
}

async function renderSeedanceSubtitles(mode: 'sidecar' | 'burn_in') {
  if (!seriesProjectId.value || renderingSeedanceSubtitles.value) return
  renderingSeedanceSubtitles.value = true
  errorMessage.value = ''
  const res = await renderAiComicSeriesSeedanceSubtitles(seriesProjectId.value, {
    dry_run: false,
    overwrite: false,
    mode,
  })
  if (res.ok && res.data) {
    seedanceSubtitleRender.value = res.data.seedance_subtitle_render
    lastSavedAt.value = res.data.project.updated_at
    const action = mode === 'burn_in' ? '字幕烧录' : '字幕文件生成'
    saveMessage.value = `${action}${res.data.status === 'rendered' ? '完成' : seedanceSubtitleRenderStatusLabel(res.data.seedance_subtitle_render.status)} · ${res.data.cue_count} 条 cue`
  } else {
    errorMessage.value = res.error?.message ?? '处理 Seedance 字幕失败'
  }
  renderingSeedanceSubtitles.value = false
}

async function mixSeedanceAudioDryRun() {
  if (!seriesProjectId.value || mixingSeedanceAudio.value) return
  mixingSeedanceAudio.value = true
  errorMessage.value = ''
  const res = await mixAiComicSeriesSeedanceAudio(seriesProjectId.value, {
    dry_run: true,
    overwrite: false,
    audio_profile: 'balanced_dialogue',
  })
  if (res.ok && res.data) {
    seedanceAudioMix.value = res.data.seedance_audio_mix
    lastSavedAt.value = res.data.project.updated_at
    saveMessage.value = `混音 dry-run 已生成 · 绑定音频 ${res.data.source_audio_count} 个 · 缺 ${res.data.missing_audio_count} 项`
  } else {
    errorMessage.value = res.error?.message ?? '生成 Seedance 混音 dry-run 失败'
  }
  mixingSeedanceAudio.value = false
}

async function batchMarkSeedanceProduction(
  fromStatus: AiComicSeedanceProductionStatus,
  toStatus: AiComicSeedanceProductionStatus,
) {
  if (!seriesProjectId.value || batchUpdatingSeedance.value) return
  const updates = (seedanceProduction.value?.items ?? [])
    .filter(item => item.status === fromStatus)
    .map(item => ({
      episode_no: item.episode_no,
      shot_id: item.shot_id,
      status: toStatus,
      note: `前端批量标记：${seedanceProductionStatusLabel(fromStatus)} -> ${seedanceProductionStatusLabel(toStatus)}`,
    }))
  if (updates.length === 0) return
  await submitSeedanceProductionBatch({ updates }, `已批量更新 ${updates.length} 个镜头为${seedanceProductionStatusLabel(toStatus)}`)
}

async function importSeedanceReturnJson(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !seriesProjectId.value) return
  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as unknown
    const rawUpdates = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.updates)
        ? parsed.updates
        : []
    const updates = rawUpdates
      .map(parseSeedanceReturnUpdate)
      .filter((item): item is AiComicSeedanceProductionStatusUpdateRequest => Boolean(item))
    if (updates.length === 0) {
      errorMessage.value = '回传 JSON 没有可识别的镜头更新。'
      return
    }
    await submitSeedanceProductionBatch({ updates }, `已导入 ${updates.length} 条 Seedance 回传`)
  } catch {
    errorMessage.value = '回传 JSON 解析失败'
  } finally {
    input.value = ''
  }
}

async function importSeedanceAssetLibraryJson(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !seriesProjectId.value) return
  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as unknown
    const rawItems = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.items)
        ? parsed.items
        : []
    const items = rawItems
      .map(parseSeedanceAssetLibraryItem)
      .filter((item): item is AiComicSeedanceAssetLibraryUpdateRequest['items'][number] => Boolean(item))
    if (items.length === 0) {
      errorMessage.value = '素材绑定 JSON 没有可识别的素材项。'
      return
    }
    batchUpdatingSeedance.value = true
    errorMessage.value = ''
    const res = await updateAiComicSeriesSeedanceAssetLibrary(seriesProjectId.value, { items })
    if (res.ok && res.data) {
      lastSavedAt.value = res.data.project.updated_at
      saveMessage.value = `已导入 ${items.length} 条 Seedance 素材绑定`
    } else {
      errorMessage.value = res.error?.message ?? '导入 Seedance 素材绑定失败'
    }
  } catch {
    errorMessage.value = '素材绑定 JSON 解析失败'
  } finally {
    batchUpdatingSeedance.value = false
    input.value = ''
  }
}

async function importSeedanceAudioLibraryJson(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !seriesProjectId.value) return
  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as unknown
    const rawItems = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.items)
        ? parsed.items
        : []
    const items = rawItems
      .map(parseSeedanceAudioLibraryItem)
      .filter((item): item is AiComicSeedanceAudioLibraryUpdateRequest['items'][number] => Boolean(item))
    if (items.length === 0) {
      errorMessage.value = '音频素材 JSON 没有可识别的素材项。'
      return
    }
    batchUpdatingSeedance.value = true
    errorMessage.value = ''
    const res = await updateAiComicSeriesSeedanceAudioLibrary(seriesProjectId.value, { items })
    if (res.ok && res.data) {
      lastSavedAt.value = res.data.project.updated_at
      saveMessage.value = `已导入 ${items.length} 条 Seedance 音频素材`
    } else {
      errorMessage.value = res.error?.message ?? '导入 Seedance 音频素材失败'
    }
  } catch {
    errorMessage.value = '音频素材 JSON 解析失败'
  } finally {
    batchUpdatingSeedance.value = false
    input.value = ''
  }
}

async function submitSeedanceProductionBatch(
  body: AiComicSeedanceProductionBatchUpdateRequest,
  message: string,
) {
  if (!seriesProjectId.value || batchUpdatingSeedance.value) return
  batchUpdatingSeedance.value = true
  errorMessage.value = ''
  const res = await updateAiComicSeriesSeedanceProductionStatuses(seriesProjectId.value, body)
  if (res.ok && res.data) {
    seedanceProduction.value = res.data.seedance_production ?? null
    lastSavedAt.value = res.data.project.updated_at
    saveMessage.value = message
    await refreshSeedanceVersionComparisonIfVisible()
  } else {
    errorMessage.value = res.error?.message ?? '批量更新 Seedance 生产状态失败'
  }
  batchUpdatingSeedance.value = false
}

function parseSeedanceAssetLibraryItem(
  value: unknown,
): AiComicSeedanceAssetLibraryUpdateRequest['items'][number] | null {
  if (!isRecord(value)) return null
  const kind = String(value.kind ?? '').trim()
  const label = String(value.label ?? value.name ?? '').trim()
  if (!isSeedanceAssetKind(kind) || !label) return null
  return {
    asset_id: stringField(value.asset_id ?? value.assetId),
    kind,
    label,
    reference_slot: stringField(value.reference_slot ?? value.referenceSlot ?? value.slot),
    file_url: stringField(value.file_url ?? value.fileUrl ?? value.url),
    file_id: stringField(value.file_id ?? value.fileId),
    description: stringField(value.description ?? value.note),
  }
}

function parseSeedanceReturnUpdate(value: unknown): AiComicSeedanceProductionStatusUpdateRequest | null {
  if (!isRecord(value)) return null
  const episodeNo = Number(value.episode_no ?? value.episodeNo)
  const shotId = String(value.shot_id ?? value.shotId ?? '').trim()
  if (!Number.isInteger(episodeNo) || episodeNo < 1 || !shotId) return null
  const status = isSeedanceProductionStatus(value.status) ? value.status : 'ready'
  return {
    episode_no: episodeNo,
    shot_id: shotId,
    status,
    provider_job_id: stringField(value.provider_job_id ?? value.providerJobId ?? value.job_id ?? value.jobId),
    video_url: stringField(value.video_url ?? value.videoUrl ?? value.url),
    failure_reason: stringField(value.failure_reason ?? value.failureReason),
    note: stringField(value.note) ?? '视频回传导入',
    increment_retry: Boolean(value.increment_retry ?? value.incrementRetry),
  }
}

function parseSeedanceAudioLibraryItem(
  value: unknown,
): AiComicSeedanceAudioLibraryUpdateRequest['items'][number] | null {
  if (!isRecord(value)) return null
  const kind = String(value.kind ?? '').trim()
  const label = String(value.label ?? value.name ?? '').trim()
  if (!isSeedanceAudioKind(kind) || !label) return null
  return {
    asset_id: stringField(value.asset_id ?? value.assetId),
    kind,
    label,
    file_url: stringField(value.file_url ?? value.fileUrl ?? value.url),
    file_id: stringField(value.file_id ?? value.fileId),
    duration_sec: numberField(value.duration_sec ?? value.durationSec),
    license_note: stringField(value.license_note ?? value.licenseNote),
    loopable: booleanField(value.loopable),
    bpm: numberField(value.bpm),
    mood_tags: stringListField(value.mood_tags ?? value.moodTags ?? value.tags),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function numberField(value: unknown): number | undefined {
  const next = Number(value)
  return Number.isFinite(next) ? next : undefined
}

function booleanField(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function stringListField(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value.map(item => String(item).trim()).filter(Boolean)
    return items.length ? items : undefined
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[，,]/).map(item => item.trim()).filter(Boolean)
  }
  return undefined
}

function isSeedanceAssetKind(value: unknown): value is AiComicSeedanceAssetLibraryUpdateRequest['items'][number]['kind'] {
  return ['character', 'location', 'unknown'].includes(String(value))
}

function isSeedanceAudioKind(value: unknown): value is AiComicSeedanceAudioLibraryUpdateRequest['items'][number]['kind'] {
  return ['dialogue', 'narration', 'music', 'sound_effect', 'ambient'].includes(String(value))
}

function isSeedanceProductionStatus(value: unknown): value is AiComicSeedanceProductionStatus {
  return [
    'not_started',
    'prompt_exported',
    'submitted',
    'processing',
    'ready',
    'failed',
    'skipped',
  ].includes(String(value))
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

async function loadSavedProjects() {
  loadingSavedProjects.value = true
  savedProjectsError.value = ''
  const res = await listAiComicSeriesProjects(showArchivedProjects.value)
  if (res.ok && res.data) {
    savedProjects.value = res.data
  } else {
    savedProjectsError.value = res.error?.message ?? '加载保存系列失败'
  }
  loadingSavedProjects.value = false
}

async function handleCopyProject(id: string) {
  if (!id || managingProjectId.value) return
  managingProjectId.value = id
  savedProjectsError.value = ''
  const res = await copyAiComicSeriesProject(id)
  if (res.ok && res.data) {
    await loadSavedProjects()
    await openSavedProject(res.data.project.series_project_id)
    saveMessage.value = `已复制为：${res.data.project.series_project_id} · ${formatDate(res.data.project.updated_at)}`
  } else {
    savedProjectsError.value = res.error?.message ?? '复制系列失败'
  }
  managingProjectId.value = ''
}

async function handleArchiveProject(id: string, archived: boolean) {
  if (!id || managingProjectId.value) return
  managingProjectId.value = id
  savedProjectsError.value = ''
  const res = await archiveAiComicSeriesProject(id, { archived })
  if (res.ok && res.data) {
    if (id === seriesProjectId.value) {
      saveMessage.value = archived
        ? `已归档：${res.data.project.series_project_id}`
        : `已恢复：${res.data.project.series_project_id}`
    }
    await loadSavedProjects()
  } else {
    savedProjectsError.value = res.error?.message ?? (archived ? '归档系列失败' : '恢复系列失败')
  }
  managingProjectId.value = ''
}

async function handleDeleteProject(id: string) {
  if (!id || managingProjectId.value) return
  if (!window.confirm('确定删除这个保存系列？该操作会移除系列规划、账本和分集生成记录索引。')) return
  managingProjectId.value = id
  savedProjectsError.value = ''
  const res = await deleteAiComicSeriesProject(id)
  if (res.ok) {
    if (id === seriesProjectId.value) {
      clearCurrentProject()
    }
    await loadSavedProjects()
    saveMessage.value = `已删除保存系列：${id}`
  } else {
    savedProjectsError.value = res.error?.message ?? '删除系列失败'
  }
  managingProjectId.value = ''
}

function clearCurrentProject() {
  plan.value = null
  seriesProjectId.value = ''
  generatedEpisodeStoryIds.value = {}
  continuityLedger.value = null
  seriesQualityAudit.value = null
  seedanceProduction.value = null
  seedanceCutAssembly.value = null
  seedanceSubtitleRender.value = null
  seedanceAudioMix.value = null
  episodeResult.value = null
  episodeErrorMessage.value = ''
  generatedEpisodeNo.value = null
  clearContextPreview()
  cancelEditEpisode()
  router.replace({
    path: route.path,
    query: Object.fromEntries(
      Object.entries(route.query).filter(([key]) => key !== 'seriesProjectId'),
    ),
  })
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

function episodeAuditLabel(status: AiComicSeriesQualityEpisodeStatus): string {
  const map: Record<AiComicSeriesQualityEpisodeStatus, string> = {
    not_generated: '未生成',
    passed: '通过',
    needs_attention: '需处理',
    unknown: '待复核',
  }
  return map[status]
}

function threadClosureStatusLabel(status: AiComicThreadClosureStatus): string {
  const map: Record<AiComicThreadClosureStatus, string> = {
    planned: '待开启',
    opened: '已开启',
    in_progress: '推进中',
    paid_off: '已回收',
    overdue: '超期未回收',
    duplicate: '重复伏笔',
    orphaned: '未绑定伏笔',
  }
  return map[status]
}

function memoryConflictSeverityLabel(severity: AiComicMemoryConflictSeverity): string {
  const map: Record<AiComicMemoryConflictSeverity, string> = {
    blocking: '阻断',
    warning: '警告',
    watch: '观察',
  }
  return map[severity]
}

function seedanceProductionStatusLabel(status: AiComicSeedanceProductionStatus): string {
  const map: Record<AiComicSeedanceProductionStatus, string> = {
    not_started: '未开始',
    prompt_exported: '已导出提示词',
    submitted: '已提交',
    processing: '处理中',
    ready: '已完成',
    failed: '失败',
    skipped: '跳过',
  }
  return map[status]
}

function seedanceThumbnailStatusLabel(status: string): string {
  const map: Record<string, string> = {
    not_started: '未开始',
    planned: '已规划',
    capturing: '抽帧中',
    ready: '已生成',
    failed: '失败',
    skipped: '跳过',
  }
  return map[status] ?? status
}

function seedanceCutAssemblyStatusLabel(status: string): string {
  const map: Record<string, string> = {
    not_started: '未开始',
    planned: '已规划',
    assembling: '装配中',
    ready: '已生成',
    failed: '失败',
    skipped: '跳过',
  }
  return map[status] ?? status
}

function seedanceSubtitleRenderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    not_started: '未开始',
    planned: '已规划',
    rendering: '处理中',
    ready: '已生成',
    failed: '失败',
    skipped: '跳过',
  }
  return map[status] ?? status
}

function seedanceAudioMixStatusLabel(status: string): string {
  const map: Record<string, string> = {
    not_started: '未开始',
    planned: '已规划',
    mixing: '混音中',
    ready: '已生成',
    failed: '失败',
    skipped: '跳过',
  }
  return map[status] ?? status
}

function seedanceAudioMixProfileLabel(profile: string): string {
  const map: Record<string, string> = {
    balanced_dialogue: '对白优先',
    music_forward: '音乐前置',
    ambient_soft: '弱环境声',
  }
  return map[profile] ?? profile
}

function hookTypeLabel(type?: AiComicEndingHookType): string {
  if (!type) return '未标注钩子类型'
  const map: Record<AiComicEndingHookType, string> = {
    choice: '选择钩子',
    reveal: '揭示钩子',
    danger: '代价钩子',
    emotional_question: '情绪疑问钩子',
    quiet_aftertaste: '余味钩子',
    final_echo: '终局回声',
  }
  return map[type]
}

function episodeStoryId(episodeNo: number): string {
  return generatedEpisodeStoryIds.value[String(episodeNo)] ?? ''
}

function episodeProjectPath(episodeNo: number): string {
  const storyId = episodeStoryId(episodeNo)
  return storyId ? `/projects/${storyId}--ai_comic_drama` : '/projects'
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

.series-studio__field-hint {
  margin: 0 0 8px;
  color: #667786;
  font-size: 12px;
  line-height: 1.4;
}

.series-studio__pattern-list {
  display: grid;
  gap: 8px;
}

.series-studio__pattern-card {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 9px 10px;
  border: 1px solid #d7dde2;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
}

.series-studio__pattern-card--selected {
  border-color: #8e44ad;
  background: #f5eef8;
}

.series-studio__pattern-card input {
  margin-top: 2px;
}

.series-studio__pattern-card span {
  display: grid;
  gap: 3px;
}

.series-studio__pattern-card strong {
  color: #263746;
  font-size: 13px;
}

.series-studio__pattern-card small {
  color: #5d6d7e;
  font-size: 12px;
  line-height: 1.35;
}
.series-studio__pattern-tags,
.series-studio__pattern-axes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.series-studio__pattern-tags em,
.series-studio__pattern-axes em {
  font-style: normal;
  font-size: 11px;
  line-height: 1.2;
  padding: 2px 5px;
  border: 1px solid #d7dde2;
  border-radius: 4px;
  color: #455a64;
  background: #f8fafb;
}
.series-studio__pattern-axes em {
  color: #6c3483;
  background: #fbf6ff;
  border-color: #ead7f3;
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

.series-studio__select--compact {
  width: auto;
  min-height: 32px;
  padding: 5px 8px;
  font-size: 13px;
}

.series-studio__input--compact {
  width: min(220px, 100%);
  min-height: 32px;
  padding: 5px 8px;
  font-size: 13px;
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

.series-studio__checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 14px;
  color: #2c3e50;
  font-size: 14px;
  font-weight: 600;
}

.series-studio__checkbox-row input {
  width: 16px;
  height: 16px;
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

.series-studio__submit--compact {
  width: auto;
  min-width: 128px;
  padding: 0 14px;
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

.series-studio__saved-head-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
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

.series-studio__ghost-button--danger {
  border-color: #e3b3ae;
  color: #a53328;
}

.series-studio__ghost-button--danger:hover:not(:disabled) {
  background: #fff4f2;
}

.series-studio__ghost-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.series-studio__saved-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #5d7281;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.series-studio__saved-toggle input {
  width: 14px;
  height: 14px;
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
  gap: 8px;
  width: 100%;
  border: 1px solid #d5dee5;
  border-radius: 6px;
  background: #fff;
  color: inherit;
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

.series-studio__saved-item--archived {
  background: #f8f9fa;
  opacity: 0.86;
}

.series-studio__saved-open {
  display: grid;
  gap: 4px;
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0;
  text-align: left;
}

.series-studio__saved-open strong {
  color: #24313b;
  font-size: 14px;
}

.series-studio__saved-open span,
.series-studio__saved-open small,
.series-studio__saved-empty {
  color: #667986;
  font-size: 12px;
}

.series-studio__saved-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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

.series-studio__save-status {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
  padding: 6px 9px;
  border: 1px solid #d7dee5;
  border-radius: 4px;
  background: #f8fafb;
  color: #425766;
  font-size: 12px;
  font-weight: 700;
}

.series-studio__save-status strong,
.series-studio__save-status em {
  color: #60717f;
  font-style: normal;
  font-weight: 600;
}

.series-studio__save-status[data-status='saving'] {
  border-color: #c7dbef;
  background: #eef6ff;
  color: #2b78b7;
}

.series-studio__save-status[data-status='saved'] {
  border-color: #c8e6d2;
  background: #eefaf2;
  color: #28734b;
}

.series-studio__save-status[data-status='failed'] {
  border-color: #efc3bc;
  background: #fff1ef;
  color: #a53328;
}

.series-studio__summary-actions {
  display: grid;
  gap: 8px;
  justify-items: start;
  margin-top: 12px;
  max-width: 780px;
}

.series-studio__delivery-actions {
  width: 100%;
}

.series-studio__delivery-summary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 5px 9px;
  border: 1px solid #b9c4cc;
  border-radius: 4px;
  background: #fff;
  color: #425766;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  list-style: none;
}

.series-studio__delivery-summary::-webkit-details-marker {
  display: none;
}

.series-studio__delivery-summary::after {
  content: '▾';
  color: #71808c;
  font-size: 10px;
}

.series-studio__delivery-actions[open] .series-studio__delivery-summary {
  background: #f5f8fa;
}

.series-studio__delivery-actions[open] .series-studio__delivery-summary::after {
  content: '▴';
}

.series-studio__delivery-actions-body {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  padding: 10px;
  border: 1px solid #dde4ea;
  border-radius: 6px;
  background: #f8fafb;
}

.series-studio__delivery-actions:not([open]) .series-studio__delivery-actions-body {
  display: none;
}

.series-studio__next-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  max-width: 780px;
  margin-top: 14px;
  border: 1px solid #c8dce8;
  border-radius: 6px;
  background: #f5fafc;
  padding: 11px 12px;
}

.series-studio__next-action span {
  display: block;
  color: #5d7281;
  font-size: 12px;
  font-weight: 700;
}

.series-studio__next-action strong {
  display: block;
  margin-top: 2px;
  color: #1f2e38;
  font-size: 15px;
}

.series-studio__next-action p {
  margin: 5px 0 0;
  color: #455866;
  font-size: 13px;
  line-height: 1.45;
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

.series-studio__quality {
  border-bottom: 1px solid #dde4ea;
  padding-bottom: 18px;
}

.series-studio__quality-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.series-studio__quality-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  border: 1px solid #f0d7a2;
  border-radius: 6px;
  background: #fff8e8;
  padding: 9px 11px;
}

.series-studio__quality-actions p {
  margin: 0;
  color: #8a5b00;
  font-size: 13px;
  line-height: 1.45;
}

.series-studio__seedance-ops {
  margin-top: 10px;
}

.series-studio__seedance-ops-summary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 6px 10px;
  border: 1px solid #d5dee5;
  border-radius: 4px;
  background: #fff;
  color: #425766;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  list-style: none;
}

.series-studio__seedance-ops-summary::-webkit-details-marker {
  display: none;
}

.series-studio__seedance-ops-summary::after {
  content: '▾';
  color: #71808c;
  font-size: 11px;
}

.series-studio__seedance-ops[open] .series-studio__seedance-ops-summary {
  background: #f5f8fa;
}

.series-studio__seedance-ops[open] .series-studio__seedance-ops-summary::after {
  content: '▴';
}

.series-studio__seedance-ops-body {
  display: grid;
  gap: 10px;
  margin-top: 8px;
  padding: 10px;
  border: 1px solid #f0d7a2;
  border-radius: 6px;
  background: #fff8e8;
}

.series-studio__seedance-ops-body p {
  margin: 0;
  color: #8a5b00;
  font-size: 13px;
  line-height: 1.45;
}

.series-studio__seedance-ops-body .series-studio__memory-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.series-studio__seedance-ops:not([open]) .series-studio__seedance-ops-body {
  display: none;
}

.series-studio__quality-grid article {
  border: 1px solid #d5dee5;
  border-radius: 6px;
  background: #f8fafb;
  padding: 10px 12px;
}

.series-studio__quality-grid strong {
  display: block;
  color: #1f2e38;
  font-size: 18px;
}

.series-studio__quality-grid span {
  color: #667986;
  font-size: 12px;
}

.series-studio__quality-issues {
  display: grid;
  gap: 6px;
  margin: 12px 0 0;
  padding-left: 18px;
  color: #9a6300;
  font-size: 13px;
  line-height: 1.45;
}

.series-studio__thread-closure {
  display: grid;
  gap: 10px;
  margin-top: 12px;
  border: 1px solid #d5dee5;
  border-radius: 6px;
  background: #fff;
  padding: 12px;
}

.series-studio__thread-closure-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.series-studio__thread-closure-head strong {
  color: #24313b;
  font-size: 14px;
}

.series-studio__thread-closure-head span {
  color: #667986;
  font-size: 12px;
}

.series-studio__thread-closure-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.series-studio__thread-closure-grid article {
  border: 1px solid #e1e7ec;
  border-radius: 6px;
  background: #f8fafb;
  padding: 8px 10px;
}

.series-studio__thread-closure-grid strong {
  display: block;
  color: #24313b;
  font-size: 16px;
}

.series-studio__thread-closure-grid span {
  color: #667986;
  font-size: 12px;
}

.series-studio__thread-closure-list {
  display: grid;
  gap: 8px;
}

.series-studio__thread-closure-item {
  border-left: 3px solid #9fb1bf;
  border-radius: 6px;
  background: #f8fafb;
  padding: 9px 10px;
}

.series-studio__thread-closure-item--overdue,
.series-studio__thread-closure-item--orphaned,
.series-studio__thread-closure-item--duplicate,
.series-studio__thread-closure-item--blocking {
  border-left-color: #d46a45;
  background: #fff7f2;
}

.series-studio__thread-closure-item--warning {
  border-left-color: #d79b32;
  background: #fffaf0;
}

.series-studio__thread-closure-item--watch {
  border-left-color: #7aa0c4;
}

.series-studio__thread-closure-item--paid_off {
  border-left-color: #2e9b62;
}

.series-studio__thread-closure-item div {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.series-studio__thread-closure-item strong {
  color: #24313b;
  font-size: 13px;
}

.series-studio__thread-closure-item span,
.series-studio__thread-closure-item small {
  color: #667986;
  font-size: 12px;
  line-height: 1.4;
}

.series-studio__thread-closure-item p {
  margin: 5px 0 0;
  color: #536774;
  font-size: 13px;
  line-height: 1.45;
}

.series-studio__thread-closure-item small {
  display: block;
  margin-top: 4px;
  color: #9a6300;
}

.series-studio__shot-actions {
  margin-top: 8px;
}

.series-studio__shot-actions-summary {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  padding: 4px 8px;
  border: 1px solid #c8d4dc;
  border-radius: 4px;
  background: #fff;
  color: #425766;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  list-style: none;
}

.series-studio__shot-actions-summary::-webkit-details-marker {
  display: none;
}

.series-studio__shot-actions-summary::after {
  content: '▾';
  color: #71808c;
  font-size: 10px;
}

.series-studio__shot-actions[open] .series-studio__shot-actions-summary {
  background: #f5f8fa;
}

.series-studio__shot-actions[open] .series-studio__shot-actions-summary::after {
  content: '▴';
}

.series-studio__shot-actions-body {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.series-studio__shot-actions-body .series-studio__memory-action {
  min-height: 28px;
  padding: 4px 8px;
  border: 1px solid #c8d4dc;
  border-radius: 4px;
  background: #fff;
  color: #425766;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.series-studio__shot-actions-body .series-studio__memory-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.series-studio__shot-actions:not([open]) .series-studio__shot-actions-body {
  display: none;
}

.series-studio__seedance-version-list {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}

.series-studio__thread-closure-item .series-studio__seedance-version {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  border: 1px solid #dce5eb;
  border-radius: 6px;
  background: #ffffff;
  padding: 6px 8px;
}

.series-studio__seedance-version span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.series-studio__seedance-version b {
  color: #1f7a4d;
  font-size: 12px;
}

.series-studio__seedance-comparison {
  display: grid;
  gap: 10px;
  margin: 12px 0;
  border: 1px solid #d5dee5;
  border-radius: 6px;
  background: #ffffff;
  padding: 12px;
}

.series-studio__seedance-comparison-list {
  display: grid;
  gap: 12px;
  max-height: 720px;
  overflow: auto;
  padding-right: 2px;
}

.series-studio__seedance-comparison-shot {
  display: grid;
  gap: 10px;
  border: 1px solid #dce5eb;
  border-radius: 6px;
  background: #f8fafb;
  padding: 10px;
}

.series-studio__seedance-comparison-head,
.series-studio__seedance-comparison-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.series-studio__seedance-comparison-head strong,
.series-studio__seedance-comparison-meta strong {
  display: block;
  color: #24313b;
  font-size: 13px;
}

.series-studio__seedance-comparison-head span,
.series-studio__seedance-comparison-meta span {
  display: block;
  margin-top: 3px;
  color: #667986;
  font-size: 12px;
  line-height: 1.4;
}

.series-studio__seedance-comparison-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.series-studio__seedance-comparison-tags b {
  border: 1px solid #cddbe3;
  border-radius: 999px;
  background: #ffffff;
  color: #355064;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  padding: 5px 7px;
  white-space: nowrap;
}

.series-studio__seedance-comparison-versions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px;
}

.series-studio__seedance-comparison-version {
  display: grid;
  gap: 8px;
  border: 1px solid #dce5eb;
  border-radius: 6px;
  background: #ffffff;
  padding: 9px;
}

.series-studio__seedance-comparison-version--selected {
  border-color: #58a777;
  background: #f4fbf6;
}

.series-studio__seedance-comparison-version--best {
  box-shadow: inset 0 0 0 1px #9fc3dd;
}

.series-studio__seedance-comparison-video {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 6px;
  background: #101820;
  object-fit: contain;
}

.series-studio__seedance-comparison-version p,
.series-studio__seedance-comparison-empty {
  margin: 0;
  color: #536774;
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.series-studio__episode-audit-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.series-studio__episode-audit {
  border: 1px solid #d5dee5;
  border-radius: 999px;
  padding: 5px 9px;
  color: #516473;
  font-size: 12px;
  font-weight: 700;
}

.series-studio__episode-audit--passed {
  border-color: #b8dcc8;
  color: #1b7f4a;
}

.series-studio__episode-audit--needs_attention,
.series-studio__episode-audit--unknown {
  border-color: #f0c4b8;
  color: #b13b2e;
}

.series-studio__episode-audit--not_generated {
  color: #667986;
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
.series-studio__spine-list,
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
.series-studio__spine,
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
.series-studio__spine strong,
.series-studio__thread strong,
.series-studio__rule strong {
  display: block;
  color: #24313b;
  font-size: 15px;
}

.series-studio__phase p,
.series-studio__spine p,
.series-studio__thread p,
.series-studio__rule p,
.series-studio__character p {
  margin: 6px 0 0;
  color: #536774;
  font-size: 14px;
  line-height: 1.55;
}

.series-studio__spine small {
  display: block;
  margin-top: 6px;
  color: #667986;
  font-size: 12px;
  line-height: 1.45;
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

.series-studio__blueprint-board {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(260px, 0.8fr);
  gap: 12px;
  margin-bottom: 14px;
}

.series-studio__timeline {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(220px, 1fr);
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.series-studio__timeline-node {
  display: grid;
  gap: 6px;
  min-height: 172px;
  padding: 12px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #fff;
  color: #24313b;
  cursor: pointer;
  text-align: left;
}

.series-studio__timeline-node:hover:not(:disabled),
.series-studio__timeline-node--editing {
  border-color: #2f7fb8;
  background: #f6fbff;
}

.series-studio__timeline-node:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.series-studio__timeline-node span,
.series-studio__timeline-node small,
.series-studio__timeline-node b {
  font-size: 12px;
}

.series-studio__timeline-node span {
  color: #2f7fb8;
  font-weight: 800;
}

.series-studio__timeline-node strong {
  color: #24313b;
  font-size: 15px;
  line-height: 1.3;
}

.series-studio__timeline-node small {
  color: #66727f;
  line-height: 1.35;
}

.series-studio__timeline-node p {
  margin: 0;
  color: #425766;
  font-size: 13px;
  line-height: 1.45;
}

.series-studio__timeline-node em {
  color: #5d6d7e;
  font-size: 12px;
  font-style: normal;
  line-height: 1.35;
}

.series-studio__timeline-node b {
  align-self: end;
  width: fit-content;
  padding: 3px 7px;
  border-radius: 999px;
  background: #eef3f7;
  color: #51606d;
}

.series-studio__timeline-node[data-status='generated'] b {
  background: #eaf7ef;
  color: #28734b;
}

.series-studio__timeline-node[data-status='attention'] b {
  background: #fff1ef;
  color: #a53328;
}

.series-studio__character-state-board {
  display: grid;
  gap: 8px;
  align-content: start;
  max-height: 360px;
  overflow-y: auto;
  padding: 10px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #f8fafb;
}

.series-studio__character-state-row {
  display: grid;
  gap: 5px;
  padding: 9px;
  border: 1px solid #e2e8ee;
  border-radius: 5px;
  background: #fff;
}

.series-studio__character-state-row div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.series-studio__character-state-row strong {
  color: #263746;
  font-size: 13px;
}

.series-studio__character-state-row span {
  color: #28734b;
  font-size: 12px;
  font-weight: 700;
}

.series-studio__character-state-row p {
  margin: 0;
  color: #5d6d7e;
  font-size: 12px;
  line-height: 1.45;
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

.series-studio__episode-link,
.series-studio__episode-detail-link {
  min-height: 28px;
  border: 1px solid #28734b;
  border-radius: 4px;
  background: #fff;
  color: #28734b;
  cursor: pointer;
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}

.series-studio__episode-link:hover,
.series-studio__episode-detail-link:hover {
  background: #eef6f1;
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

.series-studio__episode-edit-warning {
  margin: 0;
}

.series-studio__episode-editor label {
  display: grid;
  gap: 5px;
  color: #24313b;
  font-size: 13px;
  font-weight: 700;
}

.series-studio__episode-editor textarea,
.series-studio__episode-editor input,
.series-studio__episode-editor select {
  width: 100%;
  border: 1px solid #b9c4cc;
  border-radius: 4px;
  background: #fff;
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
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

.series-studio__episode-quality {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.series-studio__episode-quality article {
  padding: 12px 14px;
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  background: #f8fafb;
}

.series-studio__episode-quality strong {
  display: block;
  margin-bottom: 6px;
  color: #213547;
}

.series-studio__episode-quality p {
  margin: 0 0 6px;
  color: #34495e;
}

.series-studio__episode-quality ul {
  margin: 0;
  padding-left: 18px;
  color: #a05f00;
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

.series-studio__context-preview {
  border-top: 1px solid #dde4ea;
  padding-top: 18px;
}

.series-studio__context-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.series-studio__context-card {
  min-width: 0;
  border: 1px solid #d9e2ea;
  border-radius: 6px;
  background: #f8fafb;
  padding: 12px 14px;
}

.series-studio__context-card--wide {
  grid-column: 1 / -1;
}

.series-studio__context-card strong {
  display: block;
  margin-bottom: 7px;
  color: #213547;
  font-size: 14px;
}

.series-studio__context-card p {
  margin: 0 0 6px;
  color: #455866;
  font-size: 13px;
  line-height: 1.55;
}

.series-studio__context-card pre {
  max-height: 360px;
  overflow: auto;
  margin: 0;
  border: 1px solid #d5dee5;
  border-radius: 4px;
  background: #fff;
  color: #24313b;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.series-studio__memory-recall-list {
  display: grid;
  gap: 8px;
}

.series-studio__memory-recall-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.series-studio__file-input {
  display: none;
}

.series-studio__memory-recall-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  border: 1px solid #d7e0e7;
  border-radius: 6px;
  background: #fff;
  padding: 10px;
}

.series-studio__memory-recall-item--locked {
  border-color: #6c9f7b;
  background: #f4faf6;
}

.series-studio__memory-recall-item--excluded {
  opacity: 0.62;
}

.series-studio__memory-recall-item b {
  display: block;
  color: #213547;
  font-size: 13px;
}

.series-studio__memory-recall-item small {
  display: block;
  color: #6a7b87;
  font-size: 12px;
}

.series-studio__memory-recall-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
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

  .series-studio__blueprint-board {
    grid-template-columns: 1fr;
  }

  .series-studio__metrics,
  .series-studio__ledger,
  .series-studio__episode-columns,
  .series-studio__episode-editor-grid {
    grid-template-columns: 1fr;
  }

  .series-studio__context-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .series-studio__grid {
    grid-template-columns: 1fr;
  }

  .series-studio__summary-actions,
  .series-studio__summary-actions > .series-studio__ghost-button,
  .series-studio__delivery-actions,
  .series-studio__delivery-summary,
  .series-studio__delivery-actions-body .series-studio__ghost-button,
  .series-studio__seedance-ops,
  .series-studio__seedance-ops-summary,
  .series-studio__seedance-ops-body .series-studio__ghost-button,
  .series-studio__shot-actions,
  .series-studio__shot-actions-summary,
  .series-studio__shot-actions-body .series-studio__memory-action {
    width: 100%;
  }

  .series-studio__summary-actions > .series-studio__ghost-button,
  .series-studio__delivery-summary,
  .series-studio__delivery-actions-body .series-studio__ghost-button,
  .series-studio__seedance-ops-summary,
  .series-studio__seedance-ops-body .series-studio__ghost-button,
  .series-studio__shot-actions-summary,
  .series-studio__shot-actions-body .series-studio__memory-action {
    justify-content: center;
    text-align: center;
  }

  .series-studio__delivery-actions-body {
    display: grid;
    grid-template-columns: 1fr;
  }

  .series-studio__seedance-ops-body .series-studio__memory-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .series-studio__shot-actions-body {
    display: grid;
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
