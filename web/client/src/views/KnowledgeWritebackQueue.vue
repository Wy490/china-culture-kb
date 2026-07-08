<template>
  <div class="writeback-page">
    <header class="writeback-page__header">
      <div>
        <h1 class="writeback-page__title">知识库写回队列</h1>
        <p class="writeback-page__desc">集中处理已通过审稿的项目候选稿和扩库候选稿，只导出人工核实后的省份 Markdown 写入草案。</p>
      </div>
      <div class="writeback-page__header-actions">
        <RouterLink class="writeback-page__back writeback-page__back--secondary" to="/domain-pack-expansion-queue">扩库审稿队列</RouterLink>
        <RouterLink class="writeback-page__back" to="/supplement-tasks">素材补充任务</RouterLink>
      </div>
    </header>

    <section class="writeback-page__toolbar">
      <input
        v-model="searchQuery"
        class="writeback-page__search"
        placeholder="搜索项目、来源条目、草案内容…"
      />
      <select v-model="projectFilter" class="writeback-page__select">
        <option value="">全部项目</option>
        <option v-for="project in projectOptions" :key="project.project_id" :value="project.project_id">
          {{ project.project_title }}
        </option>
      </select>
      <select v-model="packFilter" class="writeback-page__select">
        <option value="">全部扩库 Pack</option>
        <option v-for="pack in packOptions" :key="pack" :value="pack">{{ packShortLabel(pack) }}</option>
      </select>
      <select v-model="videoTypeFilter" class="writeback-page__select">
        <option value="">全部片型</option>
        <option value="character_story">人物故事</option>
        <option value="historical_drama">历史剧情</option>
        <option value="legend_story">传说故事</option>
        <option value="culture_promo">文化宣传</option>
        <option value="heritage_promo">非遗宣传</option>
        <option value="city_brand_promo">城市文旅</option>
        <option value="scene_short">场景短片</option>
        <option value="landscape_mood">山水意境</option>
        <option value="documentary_short">微纪录</option>
        <option value="explainer_video">知识讲解</option>
        <option value="lecture_video">宣讲片</option>
        <option value="education_training">教育培训</option>
        <option value="children_story">儿童故事</option>
        <option value="social_short">竖屏短视频</option>
        <option value="ai_comic_drama">AI漫剧</option>
      </select>
      <select v-model="provinceFilter" class="writeback-page__select">
        <option value="">全部省份</option>
        <option v-for="province in provinceOptions" :key="province" :value="province">{{ province }}</option>
      </select>
      <select v-model="writebackFilter" class="writeback-page__select">
        <option value="">全部写回状态</option>
        <option value="draft_ready">草案就绪</option>
        <option value="queued">已入队</option>
        <option value="written_back">已入库</option>
        <option value="needs_revision">需重审</option>
      </select>
      <select v-model="reviewSourceFilter" class="writeback-page__select">
        <option value="">全部复核来源</option>
        <option value="seed">Seed 审稿</option>
        <option value="runtime">运行态审稿</option>
        <option value="overrides_seed">运行态覆盖 Seed</option>
      </select>
      <select v-model="handoffFilter" class="writeback-page__select">
        <option value="">全部交接状态</option>
        <option value="requires_signoff">待人工签收</option>
        <option value="missing_review_note">缺复核备注</option>
        <option value="ready_to_queue">可入队草案</option>
        <option value="queued_for_writeback">已入队待写回</option>
        <option value="needs_revision_handoff">退回补证</option>
        <option value="runtime_override">运行态覆盖</option>
      </select>
      <button
        type="button"
        class="writeback-page__action"
        :disabled="Boolean(exportingFormat)"
        @click="copyUnifiedExport('markdown')"
      >
        {{ exportingFormat === 'unified-markdown' ? '复制中…' : '复制统一 MD' }}
      </button>
      <button
        type="button"
        class="writeback-page__action writeback-page__action--secondary"
        :disabled="Boolean(exportingFormat)"
        @click="copyUnifiedExport('json')"
      >
        {{ exportingFormat === 'unified-json' ? '复制中…' : '复制统一 JSON' }}
      </button>
      <button
        type="button"
        class="writeback-page__action writeback-page__action--secondary"
        :disabled="Boolean(exportingFormat)"
        @click="downloadUnifiedExport('markdown')"
      >
        {{ exportingFormat === 'download-unified-markdown' ? '下载中…' : '下载统一 MD' }}
      </button>
      <button
        type="button"
        class="writeback-page__action writeback-page__action--secondary"
        :disabled="Boolean(exportingFormat)"
        @click="downloadUnifiedExport('json')"
      >
        {{ exportingFormat === 'download-unified-json' ? '下载中…' : '下载统一 JSON' }}
      </button>
      <button
        type="button"
        class="writeback-page__action writeback-page__action--secondary"
        :disabled="Boolean(exportingFormat)"
        @click="copyReviewHandoffChecklist"
      >
        {{ exportingFormat === 'handoff-markdown' ? '复制中…' : '复制签收清单' }}
      </button>
      <button
        type="button"
        class="writeback-page__action writeback-page__action--secondary"
        :disabled="Boolean(exportingFormat)"
        @click="copySignoffManifestPackage"
      >
        {{ exportingFormat === 'signoff-json' ? '复制中…' : '复制签收 Manifest' }}
      </button>
      <button
        type="button"
        class="writeback-page__action writeback-page__action--secondary"
        :disabled="Boolean(exportingFormat)"
        @click="downloadSignoffManifestPackage"
      >
        {{ exportingFormat === 'download-signoff-json' ? '下载中…' : '下载签收包' }}
      </button>
      <button
        type="button"
        class="writeback-page__action writeback-page__action--secondary"
        :disabled="Boolean(exportingFormat)"
        @click="copyManualPatchPackage"
      >
        {{ exportingFormat === 'manual-patch-json' ? '复制中…' : '复制人工 Patch' }}
      </button>
      <button
        type="button"
        class="writeback-page__action writeback-page__action--secondary"
        :disabled="Boolean(exportingFormat)"
        @click="downloadManualPatchPackage"
      >
        {{ exportingFormat === 'download-manual-patch-json' ? '下载中…' : '下载人工 Patch' }}
      </button>
      <button
        type="button"
        class="writeback-page__action writeback-page__action--secondary"
        :disabled="Boolean(exportingFormat)"
        @click="copyManualPatchDiffBundle"
      >
        {{ exportingFormat === 'manual-patch-diff' ? '复制中…' : '复制 Patch Diff' }}
      </button>
      <button
        type="button"
        class="writeback-page__action writeback-page__action--secondary"
        :disabled="Boolean(exportingFormat)"
        @click="downloadManualPatchDiffBundle"
      >
        {{ exportingFormat === 'download-manual-patch-diff' ? '下载中…' : '下载 Patch Diff' }}
      </button>
      <button
        type="button"
        class="writeback-page__action writeback-page__action--secondary"
        :disabled="Boolean(exportingFormat)"
        @click="copyPatch('markdown')"
      >
        {{ exportingFormat === 'markdown' ? '复制中…' : '复制项目 Patch' }}
      </button>
      <button
        type="button"
        class="writeback-page__action writeback-page__action--secondary"
        :disabled="Boolean(exportingFormat)"
        @click="copyPatch('json')"
      >
        {{ exportingFormat === 'json' ? '复制中…' : '复制 JSON 包' }}
      </button>
      <button
        type="button"
        class="writeback-page__action writeback-page__action--secondary"
        :disabled="Boolean(exportingFormat)"
        @click="copyExpansionDraft('markdown')"
      >
        {{ exportingFormat === 'expansion-markdown' ? '复制中…' : '复制扩库草案' }}
      </button>
      <button
        type="button"
        class="writeback-page__action writeback-page__action--secondary"
        :disabled="Boolean(exportingFormat)"
        @click="copyExpansionDraft('json')"
      >
        {{ exportingFormat === 'expansion-json' ? '复制中…' : '复制扩库 JSON' }}
      </button>
    </section>

    <div v-if="copyMessage" class="writeback-page__notice">{{ copyMessage }}</div>

    <section v-if="filteredExpansionItems.length" class="writeback-page__bulk">
      <label>
        <input
          type="checkbox"
          :checked="allFilteredExpansionSelected"
          @change="toggleAllFilteredExpansion($event)"
        />
        选择当前扩库草案 {{ selectedExpansionItems.length }}/{{ filteredExpansionItems.length }}
      </label>
      <select class="writeback-page__select" @change="applyBulkRevisionTemplate($event)">
        <option value="">退回原因模板</option>
        <option v-for="template in revisionTemplates" :key="template.id" :value="template.note">
          {{ template.label }}
        </option>
      </select>
      <textarea
        v-model="bulkExpansionNote"
        placeholder="批量备注；需重审时会写入 runtime review-state"
      />
      <button
        type="button"
        class="writeback-page__action writeback-page__action--secondary"
        :disabled="Boolean(bulkUpdatingKey) || selectedExpansionItems.length === 0"
        @click="bulkSetExpansionWritebackStatus('queued')"
      >
        {{ bulkUpdatingKey === 'queued' ? '更新中…' : '批量入队' }}
      </button>
      <button
        type="button"
        class="writeback-page__action writeback-page__action--secondary"
        :disabled="Boolean(bulkUpdatingKey) || selectedExpansionItems.length === 0"
        @click="bulkSetExpansionWritebackStatus('written_back')"
      >
        {{ bulkUpdatingKey === 'written_back' ? '更新中…' : '批量已入库' }}
      </button>
      <button
        type="button"
        class="writeback-page__action writeback-page__action--danger"
        :disabled="Boolean(bulkUpdatingKey) || selectedExpansionItems.length === 0"
        @click="bulkSetExpansionWritebackStatus('needs_revision')"
      >
        {{ bulkUpdatingKey === 'needs_revision' ? '更新中…' : '批量需重审' }}
      </button>
    </section>

    <section v-if="expansionReviewNoteSamples.length" class="writeback-page__review-summary">
      <strong>扩库复核备注汇总</strong>
      <span>备注 {{ expansionReviewNoteCount }} 条 · 运行态覆盖 {{ expansionRuntimeOverrideCount }} 条 · 当前筛选 {{ filteredExpansionItems.length }} 条</span>
      <ul>
        <li v-for="sample in expansionReviewNoteSamples" :key="sample">{{ sample }}</li>
      </ul>
    </section>

    <section v-if="filteredTotalCount" class="writeback-page__handoff">
      <div>
        <strong>人工复核交接</strong>
        <span>
          待签收 {{ reviewHandoffSummary.requiresManualSignoffCount }} 条 ·
          运行态覆盖 {{ reviewHandoffSummary.runtimeOverrideCount }} 条 ·
          缺复核备注 {{ reviewHandoffSummary.missingReviewNoteCount }} 条 ·
          审签批次 {{ reviewHandoffSummary.signoffBatchIds.length }} 个 ·
          缺批次 {{ reviewHandoffSummary.missingSignoffBatchCount }} 条 ·
          来源引用 {{ reviewHandoffSummary.sourceRefCount }} 条 ·
          清单 {{ reviewHandoffManifest.manifestId }}
        </span>
      </div>
      <div v-if="reviewHandoffBatchSummaries.length" class="writeback-page__handoff-batches">
        <article v-for="batch in reviewHandoffBatchSummaries" :key="batch.signoff_batch_id">
          <strong>{{ signoffBatchLabel(batch.signoff_batch_id) }}</strong>
          <span v-if="batch.signoff_batch_note">{{ batch.signoff_batch_note }}</span>
          <span>条目 {{ batch.item_count }} 条 · 扩库 {{ batch.expansion_handoff_count }} · 项目 {{ batch.project_handoff_count }}</span>
          <span>签收就绪 {{ batch.ready_for_signoff_count }} · 阻塞 {{ batch.blocked_for_signoff_count }} · 待签收 {{ batch.requires_manual_signoff_count }}</span>
          <span>缺备注 {{ batch.missing_review_note_count }} · 缺复核人 {{ batch.missing_reviewer_identity_count }} · 来源 {{ batch.source_ref_count }} 条</span>
          <span>
            草案 {{ batch.status_counts.draft_ready }} · 入队 {{ batch.status_counts.queued }} · 已入库 {{ batch.status_counts.written_back }} · 重审 {{ batch.status_counts.needs_revision }}
          </span>
        </article>
      </div>
      <div class="writeback-page__handoff-grid">
        <article v-for="item in reviewHandoffSamples" :key="item.handoff_id">
          <strong>{{ item.title }}</strong>
          <span>{{ item.source_label }} · {{ writebackStatusLabel(item.writeback_status) }} · {{ item.target_file }}</span>
          <span>审签批次 {{ item.signoff_batch_id || '待归档' }}</span>
          <span>字段 {{ item.candidate_field_count }} 个 · 来源 {{ item.source_ref_count }} 条</span>
          <span>{{ item.required_action }}</span>
        </article>
      </div>
    </section>

    <section v-if="filteredTotalCount" class="writeback-page__export-preflight">
      <div>
        <strong>统一导出预检</strong>
        <span>
          目标文件 {{ unifiedPreflightSummary.targetFileCount }} 个 · 当前草案 {{ unifiedPreflightSummary.totalDraftCount }} 条 ·
          扩库字段候选 {{ unifiedPreflightSummary.expansionCandidateFieldCount }} 个 · 来源引用 {{ unifiedPreflightSummary.expansionSourceRefCount }} 条 ·
          来源覆盖 {{ unifiedPreflightSummary.sourceRefCoveragePercent }}%
        </span>
      </div>
      <div class="writeback-page__export-preflight-grid">
        <article v-for="item in unifiedTargetFilePreflight" :key="item.target_file">
          <strong>{{ item.target_file }}</strong>
          <span>草案 {{ item.total_draft_count }} 条（项目 {{ item.project_draft_count }} / 扩库 {{ item.expansion_draft_count }}）</span>
          <span>字段差异：候选 {{ item.expansion_candidate_field_count }} 个，缺口 {{ item.expansion_field_missing_count }} 个</span>
          <span>来源引用：{{ item.expansion_source_ref_count }} 条</span>
          <span>来源覆盖：{{ item.source_ref_coverage_percent }}% · {{ sourceQualityLabel(item.source_ref_quality_level) }}</span>
          <span>缺源阻塞 {{ item.source_ref_blocker_count }} · 核验警告 {{ item.source_ref_warning_count }}</span>
          <span>直写省份 Markdown：关闭</span>
        </article>
      </div>
    </section>

    <section v-if="filteredTotalCount" class="writeback-page__manual-preview">
      <div>
        <strong>人工 Patch 预览</strong>
        <span>
          目标文件 {{ manualPatchPreviewSummary.targetFileCount }} 个 · patch {{ manualPatchPreviewSummary.totalPatchCount }} 条 ·
          来源覆盖 {{ manualPatchPreviewSummary.sourceRefCoveragePercent }}% · 本地引用 {{ manualPatchPreviewSummary.localSourceRefCount }} ·
          ready {{ manualPatchPreviewSummary.readyTargetFileCount }} · blocked {{ manualPatchPreviewSummary.blockedTargetFileCount }} ·
          闭环 {{ manualPatchPreviewSummary.localClosureCertificateId }}（{{ manualPatchPreviewSummary.localClosureReady ? 'ready' : 'blocked' }}）·
          锚点待核验 {{ manualPatchPreviewSummary.anchorReviewCount }} · 阻塞 {{ manualPatchPreviewSummary.blockerCount }} · 警告 {{ manualPatchPreviewSummary.warningCount }}
        </span>
      </div>
      <div class="writeback-page__manual-preview-grid">
        <article v-for="target in manualPatchPreviewTargets" :key="target.target_file">
          <header>
            <strong>{{ target.target_file }}</strong>
            <span :class="['writeback-page__quality', `writeback-page__quality--${target.source_ref_quality_level}`]">
              {{ sourceQualityLabel(target.source_ref_quality_level) }}
            </span>
          </header>
          <span>人工执行：{{ target.ready_for_manual_apply ? 'ready' : 'blocked' }}</span>
          <span>patch {{ target.total_patch_count }} 条 · 项目 {{ target.project_patch_count }} · 扩库 {{ target.expansion_patch_count }}</span>
          <span>字段 {{ target.candidate_field_count }} 个 · 来源 {{ target.source_ref_count }} 条 · 覆盖 {{ target.source_ref_coverage_percent }}%</span>
          <span>本地引用 {{ target.local_source_ref_count }} 条 · 带锚点 {{ target.anchored_source_ref_count }} 条 · 待导出核验 {{ target.source_ref_anchor_review_count }} 条</span>
          <span v-if="target.blocker_reasons.length">阻塞：{{ target.blocker_reasons.join('；') }}</span>
          <span v-if="target.warning_reasons.length">警告：{{ target.warning_reasons.join('；') }}</span>
          <details>
            <summary>目标文件 diff 预览</summary>
            <pre>{{ target.diff_preview_lines.join('\n') }}{{ target.diff_preview_truncated ? '\n# diff 预览已截断，导出包内含完整 review_diff' : '' }}</pre>
          </details>
        </article>
      </div>
    </section>

    <section class="writeback-page__summary">
      <div>
        <span>草案总数</span>
        <strong>{{ totalQueueCount }}</strong>
      </div>
      <div>
        <span>当前筛选</span>
        <strong>{{ filteredTotalCount }}</strong>
      </div>
      <div>
        <span>项目草案</span>
        <strong>{{ queueItems.length }}</strong>
      </div>
      <div>
        <span>扩库草案</span>
        <strong>{{ expansionItems.length }}</strong>
      </div>
      <div>
        <span>扩库字段候选</span>
        <strong>{{ expansionFieldCandidateCount }}</strong>
      </div>
      <div>
        <span>扩库字段缺口</span>
        <strong>{{ expansionFieldMissingCount }}</strong>
      </div>
      <div>
        <span>扩库送审字段</span>
        <strong>{{ expansionFieldReviewReadyCount }}</strong>
      </div>
      <div>
        <span>扩库审稿阻断</span>
        <strong>{{ expansionFieldReviewBlockerCount }}</strong>
      </div>
      <div>
        <span>运行态覆盖</span>
        <strong>{{ expansionRuntimeOverrideCount }}</strong>
      </div>
      <div>
        <span>复核备注</span>
        <strong>{{ expansionReviewNoteCount }}</strong>
      </div>
      <div>
        <span>来源引用</span>
        <strong>{{ expansionSourceRefTotalCount }}</strong>
      </div>
      <div>
        <span>来源覆盖率</span>
        <strong>{{ manualPatchPreviewSummary.sourceRefCoveragePercent }}%</strong>
      </div>
      <div>
        <span>缺来源字段</span>
        <strong>{{ manualPatchPreviewSummary.missingSourceFieldCount }}</strong>
      </div>
      <div>
        <span>Patch 阻塞</span>
        <strong>{{ manualPatchPreviewSummary.blockerCount }}</strong>
      </div>
      <div>
        <span>锚点待核验</span>
        <strong>{{ manualPatchPreviewSummary.anchorReviewCount }}</strong>
      </div>
      <div>
        <span>草案就绪</span>
        <strong>{{ countByStatus('draft_ready') }}</strong>
      </div>
      <div>
        <span>已入队</span>
        <strong>{{ countByStatus('queued') }}</strong>
      </div>
      <div>
        <span>已入库</span>
        <strong>{{ countByStatus('written_back') }}</strong>
      </div>
      <div>
        <span>需重审</span>
        <strong>{{ countByStatus('needs_revision') }}</strong>
      </div>
    </section>

    <div v-if="loading" class="writeback-page__state">正在加载写回队列…</div>
    <div v-else-if="error" class="writeback-page__error">{{ error }}</div>

    <section v-else class="writeback-page__list">
      <article v-for="item in filteredItems" :key="item.task.task_id" class="writeback-page__item">
        <div class="writeback-page__main">
          <div class="writeback-page__badges">
            <span :class="['writeback-page__status', `writeback-page__status--${taskWritebackStatus(item)}`]">
              {{ writebackStatusLabel(taskWritebackStatus(item)) }}
            </span>
            <span>{{ typeLabel(item.video_type) }}</span>
            <span>{{ item.target_province || '待确认省份' }}</span>
            <span>{{ item.task.source === 'production_material_missing_field' ? '生产素材' : '素材补充' }}</span>
          </div>
          <h2>{{ item.task.label }}</h2>
          <p>{{ item.project_title }} · {{ item.source_entry }}</p>
          <p v-if="item.task.knowledge_candidate_review_note" class="writeback-page__note">
            审稿备注：{{ item.task.knowledge_candidate_review_note }}
          </p>
          <pre>{{ item.task.knowledge_writeback_draft_markdown }}</pre>
        </div>

        <aside class="writeback-page__side">
          <strong>{{ item.suggested_file_path || 'data/provinces/待确认.md' }}</strong>
          <span>{{ formatDate(item.task.knowledge_writeback_updated_at ?? item.task.updated_at ?? item.updated_at) }}</span>
          <RouterLink :to="`/projects/${item.project_id}`">打开项目</RouterLink>
          <textarea
            :value="noteDraft(item)"
            placeholder="入库备注"
            @input="updateNoteDraft(item.task.task_id, $event)"
          />
          <div class="writeback-page__status-actions">
            <button type="button" :disabled="updatingTaskId === item.task.task_id" @click="setWritebackStatus(item, 'draft_ready')">草案</button>
            <button type="button" :disabled="updatingTaskId === item.task.task_id" @click="setWritebackStatus(item, 'queued')">入队</button>
            <button type="button" :disabled="updatingTaskId === item.task.task_id" @click="setWritebackStatus(item, 'written_back')">入库</button>
            <button type="button" :disabled="updatingTaskId === item.task.task_id" @click="setWritebackStatus(item, 'needs_revision')">重审</button>
          </div>
        </aside>
      </article>

      <article v-for="item in filteredExpansionItems" :key="item.review_item_id" class="writeback-page__item writeback-page__item--expansion">
        <div class="writeback-page__main">
          <label class="writeback-page__select-row">
            <input
              type="checkbox"
              :checked="selectedExpansionIds.includes(item.review_item_id)"
              @change="toggleExpansionSelection(item, $event)"
            />
            纳入批量操作
          </label>
          <div class="writeback-page__badges">
            <span :class="['writeback-page__status', `writeback-page__status--${expansionWritebackStatus(item)}`]">
              {{ writebackStatusLabel(expansionWritebackStatus(item)) }}
            </span>
            <span>扩库候选</span>
            <span>{{ reviewStateSourceLabel(item.review_state_source) }}{{ item.review_state_overrides_seed ? '覆盖' : '' }}</span>
            <span>{{ item.province || '待确认省份' }}</span>
            <span>{{ packShortLabel(item.pack_id) }}</span>
            <span>字段候选 {{ item.field_supplement_candidate_count ?? 0 }}</span>
            <span>缺口 {{ item.field_missing_candidate_count ?? 0 }}</span>
            <span>完整度 {{ item.field_candidate_completion_percent ?? 100 }}%</span>
            <span>送审 {{ item.field_review_ready_count ?? 0 }}</span>
            <span>阻断 {{ item.field_review_blocker_count ?? 0 }}</span>
            <span v-if="item.signoff_batch_id">审签 {{ item.signoff_batch_id }}</span>
            <span v-for="type in item.target_video_types" :key="`${item.review_item_id}:${type}`">
              {{ typeLabel(type) }}
            </span>
          </div>
          <h2>{{ item.entry_name }}</h2>
          <p>{{ item.pack_id }} · {{ item.review_item_id }}</p>
          <p v-if="item.review_note" class="writeback-page__note">审稿备注：{{ item.review_note }}</p>
          <div class="writeback-page__preflight-panel">
            <span>目标文件：{{ item.suggested_file_path }}</span>
            <span>字段差异：候选 {{ item.field_supplement_candidate_count ?? candidateFields(item).length }} 个，缺口 {{ item.field_missing_candidate_count ?? 0 }} 个</span>
            <span>来源引用：{{ itemSourceRefCount(item) }} 条</span>
            <span>审签批次：{{ item.signoff_batch_id || '待归档' }}</span>
            <span v-if="item.signoff_batch_note">批次备注：{{ item.signoff_batch_note }}</span>
            <span>直写省份 Markdown：关闭</span>
          </div>
          <details class="writeback-page__field-preview">
            <summary>字段级草案预览 · {{ candidateFields(item).length }} 个字段</summary>
            <div v-for="field in candidateFields(item)" :key="`${item.review_item_id}:${field.field_id}`">
              <strong>{{ field.field_id }}</strong>
              <p>{{ field.candidate_value || '待补候选值' }}</p>
              <small>来源：{{ field.source_refs.join('；') || '待补' }}</small>
              <small>核实：{{ field.verification_note || '待补' }}</small>
              <small>写回提示：{{ field.writeback_hint || '待补' }}</small>
            </div>
          </details>
          <pre>{{ item.writeback_draft_markdown }}</pre>
        </div>

        <aside class="writeback-page__side">
          <strong>{{ item.suggested_file_path }}</strong>
          <span>{{ item.writeback_note || '未填写入库备注' }}</span>
          <RouterLink to="/domain-pack-expansion-queue">打开扩库队列</RouterLink>
          <textarea
            :value="expansionNoteDraft(item)"
            placeholder="入库备注"
            @input="updateExpansionNoteDraft(item.review_item_id, $event)"
          />
          <select class="writeback-page__select" @change="applyExpansionRevisionTemplate(item, $event)">
            <option value="">退回原因模板</option>
            <option v-for="template in revisionTemplates" :key="`${item.review_item_id}:${template.id}`" :value="template.note">
              {{ template.label }}
            </option>
          </select>
          <div class="writeback-page__status-actions">
            <button type="button" :disabled="updatingTaskId === item.review_item_id" @click="setExpansionWritebackStatus(item, 'draft_ready')">草案</button>
            <button type="button" :disabled="updatingTaskId === item.review_item_id" @click="setExpansionWritebackStatus(item, 'queued')">入队</button>
            <button type="button" :disabled="updatingTaskId === item.review_item_id" @click="setExpansionWritebackStatus(item, 'written_back')">入库</button>
            <button type="button" :disabled="updatingTaskId === item.review_item_id" @click="setExpansionWritebackStatus(item, 'needs_revision')">重审</button>
          </div>
        </aside>
      </article>

      <div v-if="filteredTotalCount === 0" class="writeback-page__state">没有匹配的写回草案。</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { exportKnowledgeWritebackQueuePatch, listSupplementTasks, updateProjectSupplementTask } from '@/api/projects'
import {
  exportKnowledgeWritebackQueuePackage,
  getDomainPackExpansionWritebackDraft,
  updateDomainPackExpansionReviewState,
  updateDomainPackExpansionReviewStateBulk,
} from '@/api/system'
import type {
  DomainPackExpansionFieldWorkbenchItem,
  DomainPackExpansionWritebackDraftItem,
  DomainPackExpansionWritebackDraftPackage,
  DomainPackExpansionReviewStateSource,
  KnowledgeWritebackQueueExportPackage,
  KnowledgeWritebackQueueExportTargetFilePreflight,
  KnowledgeWritebackStatus,
  ProjectSupplementTaskListItem,
  VideoType,
} from '@shared/types'

const tasks = ref<ProjectSupplementTaskListItem[]>([])
const expansionDraft = ref<DomainPackExpansionWritebackDraftPackage | null>(null)
const loading = ref(false)
const error = ref('')
const copyMessage = ref('')
const exportingFormat = ref<'markdown' | 'json' | 'expansion-markdown' | 'expansion-json' | 'unified-markdown' | 'unified-json' | 'download-unified-markdown' | 'download-unified-json' | 'handoff-markdown' | 'signoff-json' | 'download-signoff-json' | 'manual-patch-json' | 'download-manual-patch-json' | 'manual-patch-diff' | 'download-manual-patch-diff' | ''>('')
const updatingTaskId = ref('')
const searchQuery = ref('')
const projectFilter = ref('')
const packFilter = ref('')
const videoTypeFilter = ref<VideoType | ''>('')
const provinceFilter = ref('')
const writebackFilter = ref<KnowledgeWritebackStatus | ''>('')
const reviewSourceFilter = ref<DomainPackExpansionReviewStateSource | 'overrides_seed' | ''>('')
const handoffFilter = ref<'requires_signoff' | 'missing_review_note' | 'ready_to_queue' | 'queued_for_writeback' | 'needs_revision_handoff' | 'runtime_override' | ''>('')
const bulkUpdatingKey = ref('')
const bulkExpansionNote = ref('')
const selectedExpansionIds = ref<string[]>([])
const noteDrafts = reactive<Record<string, string>>({})
const expansionNoteDrafts = reactive<Record<string, string>>({})

interface ReviewHandoffPreviewItem {
  handoff_id: string;
  source_label: string;
  title: string;
  target_file: string;
  writeback_status: KnowledgeWritebackStatus;
  candidate_field_count: number;
  source_ref_count: number;
  has_review_note: boolean;
  has_reviewer_identity: boolean;
  review_state_source?: DomainPackExpansionReviewStateSource;
  review_state_overrides_seed?: boolean;
  signoff_batch_id?: string;
  signoff_batch_note?: string;
  required_action: string;
}

interface ReviewHandoffSignoffBatchSummary {
  signoff_batch_id: string;
  signoff_batch_note?: string;
  item_count: number;
  project_handoff_count: number;
  expansion_handoff_count: number;
  requires_manual_signoff_count: number;
  review_note_count: number;
  missing_review_note_count: number;
  reviewer_identity_count: number;
  missing_reviewer_identity_count: number;
  source_ref_count: number;
  candidate_field_count: number;
  status_counts: Record<KnowledgeWritebackStatus, number>;
  ready_for_signoff_count: number;
  blocked_for_signoff_count: number;
}

type SourceRefQualityLevel = 'pass' | 'warning' | 'blocker'

interface ManualPatchPreviewTarget {
  target_file: string;
  project_patch_count: number;
  expansion_patch_count: number;
  total_patch_count: number;
  ready_for_manual_apply: boolean;
  candidate_field_count: number;
  checked_field_count: number;
  covered_field_count: number;
  source_ref_count: number;
  local_source_ref_count: number;
  anchored_source_ref_count: number;
  source_ref_anchor_review_count: number;
  missing_source_ref_field_count: number;
  missing_verification_note_field_count: number;
  missing_writeback_hint_field_count: number;
  source_ref_coverage_percent: number;
  source_ref_quality_level: SourceRefQualityLevel;
  blocker_reasons: string[];
  warning_reasons: string[];
  diff_preview_lines: string[];
  diff_preview_truncated: boolean;
}

const UNASSIGNED_SIGNOFF_BATCH_ID = 'unassigned_signoff_batch'
const DIFF_PREVIEW_LINE_LIMIT = 32

const revisionTemplates = [
  {
    id: 'missing_source',
    label: '来源不足',
    note: '退回补充：来源引用不足，需补齐可核验出处、页码/展陈/采访记录或公开资料链接后再进入写回。',
  },
  {
    id: 'boundary_unclear',
    label: '边界不清',
    note: '退回补充：事实、传说、口述和创作改编边界不够清晰，需重写核实备注和禁写断言。',
  },
  {
    id: 'writeback_scope',
    label: '写回范围',
    note: '退回补充：建议写回字段范围过宽，需拆成更小字段并标明只作为人工补库草案。',
  },
]

const queueItems = computed(() => tasks.value.filter(item =>
  item.task.knowledge_candidate_review_status === 'approved'
  && Boolean(item.task.knowledge_writeback_draft_markdown),
))

const expansionItems = computed(() => expansionDraft.value?.items ?? [])

const totalQueueCount = computed(() => queueItems.value.length + expansionItems.value.length)
const filteredTotalCount = computed(() => filteredItems.value.length + filteredExpansionItems.value.length)
const expansionFieldCandidateCount = computed(() =>
  expansionItems.value.reduce((sum, item) => sum + (item.field_supplement_candidate_count ?? 0), 0),
)
const expansionFieldMissingCount = computed(() =>
  expansionItems.value.reduce((sum, item) => sum + (item.field_missing_candidate_count ?? 0), 0),
)
const expansionFieldReviewReadyCount = computed(() =>
  expansionItems.value.reduce((sum, item) => sum + (item.field_review_ready_count ?? 0), 0),
)
const expansionFieldReviewBlockerCount = computed(() =>
  expansionItems.value.reduce((sum, item) => sum + (item.field_review_blocker_count ?? 0), 0),
)
const expansionRuntimeOverrideCount = computed(() =>
  expansionItems.value.filter(item => item.review_state_source === 'runtime' || item.review_state_overrides_seed).length,
)
const expansionReviewNoteCount = computed(() =>
  expansionItems.value.filter(item => Boolean(item.review_note?.trim())).length,
)
const expansionReviewNoteSamples = computed(() =>
  filteredExpansionItems.value
    .filter(item => Boolean(item.review_note?.trim()))
    .slice(0, 5)
    .map(item => `${item.entry_name}：${item.review_note}`),
)
const expansionSourceRefTotalCount = computed(() =>
  expansionItems.value.reduce((sum, item) => sum + itemSourceRefCount(item), 0),
)
const unifiedTargetFilePreflight = computed<KnowledgeWritebackQueueExportTargetFilePreflight[]>(() => {
  const rows = new Map<string, KnowledgeWritebackQueueExportTargetFilePreflight & {
    sourceRefSet: Set<string>;
    checkedFieldCount: number;
    coveredFieldCount: number;
    missingSourceRefFieldCount: number;
    missingVerificationNoteFieldCount: number;
    missingWritebackHintFieldCount: number;
    projectWarningCount: number;
  }>()
  const ensureRow = (targetFile: string) => {
    const current = rows.get(targetFile)
    if (current) return current
    const next: KnowledgeWritebackQueueExportTargetFilePreflight & {
      sourceRefSet: Set<string>;
      checkedFieldCount: number;
      coveredFieldCount: number;
      missingSourceRefFieldCount: number;
      missingVerificationNoteFieldCount: number;
      missingWritebackHintFieldCount: number;
      projectWarningCount: number;
    } = {
      target_file: targetFile,
      project_draft_count: 0,
      expansion_draft_count: 0,
      total_draft_count: 0,
      expansion_candidate_field_count: 0,
      expansion_field_missing_count: 0,
      expansion_source_ref_count: 0,
      source_ref_coverage_percent: 100,
      source_ref_quality_level: 'pass',
      source_ref_blocker_count: 0,
      source_ref_warning_count: 0,
      writeback_status_counts: {
        draft_ready: 0,
        queued: 0,
        written_back: 0,
        needs_revision: 0,
      },
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
      safety_note: '仅导出人工写回草案和字段差异，不直接修改省份 Markdown。',
      sourceRefSet: new Set<string>(),
      checkedFieldCount: 0,
      coveredFieldCount: 0,
      missingSourceRefFieldCount: 0,
      missingVerificationNoteFieldCount: 0,
      missingWritebackHintFieldCount: 0,
      projectWarningCount: 0,
    }
    rows.set(targetFile, next)
    return next
  }

  for (const item of filteredItems.value) {
    const targetFile = item.suggested_file_path || `data/provinces/${item.target_province || '待确认'}.md`
    const row = ensureRow(targetFile)
    row.project_draft_count += 1
    row.total_draft_count += 1
    row.writeback_status_counts[taskWritebackStatus(item)] += 1
    row.projectWarningCount += 1
  }

  for (const item of filteredExpansionItems.value) {
    const row = ensureRow(item.suggested_file_path)
    const quality = expansionItemSourceQuality(item)
    row.expansion_draft_count += 1
    row.total_draft_count += 1
    row.expansion_candidate_field_count += item.field_supplement_candidate_count ?? 0
    row.expansion_field_missing_count += item.field_missing_candidate_count ?? 0
    row.writeback_status_counts[expansionWritebackStatus(item)] += 1
    row.checkedFieldCount += quality.checkedFieldCount
    row.coveredFieldCount += quality.coveredFieldCount
    row.missingSourceRefFieldCount += quality.missingSourceRefFieldCount
    row.missingVerificationNoteFieldCount += quality.missingVerificationNoteFieldCount
    row.missingWritebackHintFieldCount += quality.missingWritebackHintFieldCount
    for (const sourceRef of (item.field_workbench ?? []).flatMap(field => field.source_refs)) {
      row.sourceRefSet.add(sourceRef)
    }
  }

  return [...rows.values()]
    .map(({
      sourceRefSet,
      checkedFieldCount,
      coveredFieldCount,
      missingSourceRefFieldCount,
      missingVerificationNoteFieldCount,
      missingWritebackHintFieldCount,
      projectWarningCount,
      ...item
    }) => {
      const sourceRefQualityLevel: SourceRefQualityLevel = missingSourceRefFieldCount > 0
        ? 'blocker'
        : (projectWarningCount + missingVerificationNoteFieldCount + missingWritebackHintFieldCount) > 0
          ? 'warning'
          : 'pass'
      return {
        ...item,
        expansion_source_ref_count: sourceRefSet.size,
        source_ref_coverage_percent: completionPercent(coveredFieldCount, checkedFieldCount),
        source_ref_quality_level: sourceRefQualityLevel,
        source_ref_blocker_count: missingSourceRefFieldCount > 0 ? 1 : 0,
        source_ref_warning_count: projectWarningCount + missingVerificationNoteFieldCount + missingWritebackHintFieldCount,
      }
    })
    .sort((a, b) => a.target_file.localeCompare(b.target_file, 'zh-Hans-CN'))
})
const unifiedPreflightSummary = computed(() => ({
  targetFileCount: unifiedTargetFilePreflight.value.length,
  totalDraftCount: unifiedTargetFilePreflight.value.reduce((sum, item) => sum + item.total_draft_count, 0),
  expansionCandidateFieldCount: unifiedTargetFilePreflight.value
    .reduce((sum, item) => sum + item.expansion_candidate_field_count, 0),
  expansionFieldMissingCount: unifiedTargetFilePreflight.value
    .reduce((sum, item) => sum + item.expansion_field_missing_count, 0),
  expansionSourceRefCount: unifiedTargetFilePreflight.value
    .reduce((sum, item) => sum + item.expansion_source_ref_count, 0),
  sourceRefCoveragePercent: completionPercent(
    manualPatchPreviewTargets.value.reduce((sum, item) => sum + item.covered_field_count, 0),
    manualPatchPreviewTargets.value.reduce((sum, item) => sum + item.checked_field_count, 0),
  ),
}))
const reviewHandoffItems = computed<ReviewHandoffPreviewItem[]>(() => [
  ...filteredItems.value.map(item => {
    const status = taskWritebackStatus(item)
    const hasReviewNote = Boolean(item.task.knowledge_candidate_review_note?.trim())
    return {
      handoff_id: writebackItemKey(item),
      source_label: '项目草案',
      title: item.task.label,
      target_file: item.suggested_file_path || `data/provinces/${item.target_province || '待确认'}.md`,
      writeback_status: status,
      candidate_field_count: 0,
      source_ref_count: 0,
      has_review_note: hasReviewNote,
      has_reviewer_identity: false,
      required_action: reviewHandoffRequiredAction(status, hasReviewNote, 0),
    }
  }),
  ...filteredExpansionItems.value.map(item => {
    const status = expansionWritebackStatus(item)
    const sourceRefCount = itemSourceRefCount(item)
    const hasReviewNote = Boolean(item.review_note?.trim())
    return {
      handoff_id: item.review_item_id,
      source_label: reviewStateSourceLabel(item.review_state_source),
      title: item.entry_name,
      target_file: item.suggested_file_path,
      writeback_status: status,
      candidate_field_count: item.field_supplement_candidate_count ?? candidateFields(item).length,
      source_ref_count: sourceRefCount,
      has_review_note: hasReviewNote,
      has_reviewer_identity: hasExpansionReviewerIdentity(item),
      review_state_source: item.review_state_source,
      review_state_overrides_seed: item.review_state_overrides_seed,
      signoff_batch_id: item.signoff_batch_id,
      signoff_batch_note: item.signoff_batch_note,
      required_action: reviewHandoffRequiredAction(status, hasReviewNote, sourceRefCount),
    }
  }),
])
const reviewHandoffSummary = computed(() => ({
  requiresManualSignoffCount: reviewHandoffItems.value.filter(item => item.writeback_status !== 'written_back').length,
  runtimeOverrideCount: reviewHandoffItems.value.filter(item =>
    item.review_state_source === 'runtime' || item.review_state_overrides_seed,
  ).length,
  missingReviewNoteCount: reviewHandoffItems.value.filter(item => !item.has_review_note).length,
  missingSignoffBatchCount: reviewHandoffItems.value.filter(item => !item.signoff_batch_id?.trim()).length,
  signoffBatchIds: [...new Set(reviewHandoffItems.value.map(item => item.signoff_batch_id?.trim()).filter((id): id is string => Boolean(id)))].sort((a, b) => a.localeCompare(b)),
  sourceRefCount: reviewHandoffItems.value.reduce((sum, item) => sum + item.source_ref_count, 0),
}))
const reviewHandoffBatchSummaries = computed<ReviewHandoffSignoffBatchSummary[]>(() => {
  const summaries = new Map<string, ReviewHandoffSignoffBatchSummary>()
  const ensureSummary = (item: ReviewHandoffPreviewItem) => {
    const signoffBatchId = item.signoff_batch_id?.trim() || UNASSIGNED_SIGNOFF_BATCH_ID
    const signoffBatchNote = item.signoff_batch_note?.trim()
    const current = summaries.get(signoffBatchId)
    if (current) {
      if (!current.signoff_batch_note && signoffBatchNote) current.signoff_batch_note = signoffBatchNote
      return current
    }
    const next: ReviewHandoffSignoffBatchSummary = {
      signoff_batch_id: signoffBatchId,
      ...(signoffBatchNote ? { signoff_batch_note: signoffBatchNote } : {}),
      item_count: 0,
      project_handoff_count: 0,
      expansion_handoff_count: 0,
      requires_manual_signoff_count: 0,
      review_note_count: 0,
      missing_review_note_count: 0,
      reviewer_identity_count: 0,
      missing_reviewer_identity_count: 0,
      source_ref_count: 0,
      candidate_field_count: 0,
      status_counts: {
        draft_ready: 0,
        queued: 0,
        written_back: 0,
        needs_revision: 0,
      },
      ready_for_signoff_count: 0,
      blocked_for_signoff_count: 0,
    }
    summaries.set(signoffBatchId, next)
    return next
  }

  for (const item of reviewHandoffItems.value) {
    const summary = ensureSummary(item)
    summary.item_count += 1
    if (item.source_label === '项目草案') summary.project_handoff_count += 1
    else summary.expansion_handoff_count += 1
    if (item.writeback_status !== 'written_back') summary.requires_manual_signoff_count += 1
    if (item.has_review_note) summary.review_note_count += 1
    else summary.missing_review_note_count += 1
    if (item.has_reviewer_identity) summary.reviewer_identity_count += 1
    else summary.missing_reviewer_identity_count += 1
    summary.source_ref_count += item.source_ref_count
    summary.candidate_field_count += item.candidate_field_count
    summary.status_counts[item.writeback_status] += 1
    if (isReviewHandoffItemReadyForSignoff(item)) summary.ready_for_signoff_count += 1
    else summary.blocked_for_signoff_count += 1
  }

  return [...summaries.values()].sort((a, b) => {
    if (a.signoff_batch_id === UNASSIGNED_SIGNOFF_BATCH_ID) return 1
    if (b.signoff_batch_id === UNASSIGNED_SIGNOFF_BATCH_ID) return -1
    return a.signoff_batch_id.localeCompare(b.signoff_batch_id, 'zh-Hans-CN')
  })
})
const reviewHandoffManifest = computed(() => {
  const payload = JSON.stringify(reviewHandoffItems.value.map(item => ({
    handoff_id: item.handoff_id,
    source_label: item.source_label,
    target_file: item.target_file,
    writeback_status: item.writeback_status,
    candidate_field_count: item.candidate_field_count,
    source_ref_count: item.source_ref_count,
    review_state_source: item.review_state_source,
    review_state_overrides_seed: item.review_state_overrides_seed,
    signoff_batch_id: item.signoff_batch_id,
  })))
  const fingerprint = localManifestFingerprint(payload)
  return {
    manifestId: `kwb-local-${fingerprint.slice(0, 10)}`,
    fingerprint,
  }
})
const reviewHandoffSamples = computed(() => reviewHandoffItems.value.slice(0, 6))

const manualPatchPreviewTargets = computed<ManualPatchPreviewTarget[]>(() => {
  const rows = new Map<string, {
    target_file: string;
    projectItems: ProjectSupplementTaskListItem[];
    expansionItems: DomainPackExpansionWritebackDraftItem[];
  }>()
  const ensureRow = (targetFile: string) => {
    const current = rows.get(targetFile)
    if (current) return current
    const next = { target_file: targetFile, projectItems: [], expansionItems: [] }
    rows.set(targetFile, next)
    return next
  }

  for (const item of filteredItems.value) {
    ensureRow(item.suggested_file_path || `data/provinces/${item.target_province || '待确认'}.md`).projectItems.push(item)
  }
  for (const item of filteredExpansionItems.value) {
    ensureRow(item.suggested_file_path).expansionItems.push(item)
  }

  return [...rows.values()].map(row => {
    const quality = combinedSourceQuality(row.projectItems, row.expansionItems)
    const diffLines = renderLocalManualReviewDiff(row.target_file, row.projectItems, row.expansionItems)
    const blockerReasons = [
      row.projectItems.length + row.expansionItems.length === 0 ? `no_patch_items_for_target=${row.target_file}` : '',
      quality.missingSourceRefFieldCount > 0 ? `missing_source_refs=${quality.missingSourceRefFieldCount}` : '',
    ].filter((reason): reason is string => Boolean(reason))
    const warningReasons = [
      row.projectItems.length > 0 ? `project_writeback_structured_source_refs_pending=${row.projectItems.length}` : '',
      quality.missingVerificationNoteFieldCount > 0 ? `missing_verification_notes=${quality.missingVerificationNoteFieldCount}` : '',
      quality.missingWritebackHintFieldCount > 0 ? `missing_writeback_hints=${quality.missingWritebackHintFieldCount}` : '',
    ].filter((reason): reason is string => Boolean(reason))
    const sourceRefQualityLevel: SourceRefQualityLevel = blockerReasons.length > 0
      ? 'blocker'
      : warningReasons.length > 0
        ? 'warning'
        : 'pass'
    const readyForManualApply = blockerReasons.length === 0
    return {
      target_file: row.target_file,
      project_patch_count: row.projectItems.length,
      expansion_patch_count: row.expansionItems.length,
      total_patch_count: row.projectItems.length + row.expansionItems.length,
      ready_for_manual_apply: readyForManualApply,
      candidate_field_count: quality.candidateFieldCount,
      checked_field_count: quality.checkedFieldCount,
      covered_field_count: quality.coveredFieldCount,
      source_ref_count: quality.sourceRefCount,
      local_source_ref_count: quality.localSourceRefCount,
      anchored_source_ref_count: quality.anchoredSourceRefCount,
      source_ref_anchor_review_count: quality.anchorReviewCount,
      missing_source_ref_field_count: quality.missingSourceRefFieldCount,
      missing_verification_note_field_count: quality.missingVerificationNoteFieldCount,
      missing_writeback_hint_field_count: quality.missingWritebackHintFieldCount,
      source_ref_coverage_percent: completionPercent(quality.coveredFieldCount, quality.checkedFieldCount),
      source_ref_quality_level: sourceRefQualityLevel,
      blocker_reasons: blockerReasons,
      warning_reasons: warningReasons,
      diff_preview_lines: diffLines.slice(0, DIFF_PREVIEW_LINE_LIMIT),
      diff_preview_truncated: diffLines.length > DIFF_PREVIEW_LINE_LIMIT,
    }
  }).sort((a, b) => a.target_file.localeCompare(b.target_file, 'zh-Hans-CN'))
})

const manualPatchPreviewSummary = computed(() => {
  const targets = manualPatchPreviewTargets.value
  const checkedFieldCount = manualPatchPreviewTargets.value.reduce((sum, item) => sum + item.checked_field_count, 0)
  const coveredFieldCount = manualPatchPreviewTargets.value.reduce((sum, item) => sum + item.covered_field_count, 0)
  const readyTargetFileCount = targets.filter(item => item.ready_for_manual_apply).length
  const blockedTargetFileCount = targets.length - readyTargetFileCount
  const closurePayload = JSON.stringify({
    target_files: targets.map(item => item.target_file),
    ready_target_file_count: readyTargetFileCount,
    blocked_target_file_count: blockedTargetFileCount,
    total_patch_count: targets.reduce((sum, item) => sum + item.total_patch_count, 0),
    blocker_reason_count: targets.reduce((sum, item) => sum + item.blocker_reasons.length, 0),
    warning_reason_count: targets.reduce((sum, item) => sum + item.warning_reasons.length, 0),
    direct_writeback_to_province_markdown: false,
    province_markdown_written: false,
    patch_applyable: false,
    manual_apply_only: true,
  })
  const closureFingerprint = localManifestFingerprint(closurePayload)
  return {
    targetFileCount: targets.length,
    totalPatchCount: targets.reduce((sum, item) => sum + item.total_patch_count, 0),
    readyTargetFileCount,
    blockedTargetFileCount,
    localClosureCertificateId: `kwb-local-closure-${closureFingerprint.slice(0, 10)}`,
    localClosureReady: targets.length > 0 && blockedTargetFileCount === 0,
    blockerCount: targets.reduce((sum, item) => sum + item.blocker_reasons.length, 0),
    warningCount: targets.reduce((sum, item) => sum + item.warning_reasons.length, 0),
    sourceRefCoveragePercent: completionPercent(coveredFieldCount, checkedFieldCount),
    localSourceRefCount: targets
      .reduce((sum, item) => sum + item.local_source_ref_count, 0),
    anchorReviewCount: targets
      .reduce((sum, item) => sum + item.source_ref_anchor_review_count, 0),
    missingSourceFieldCount: targets
      .reduce((sum, item) => sum + item.missing_source_ref_field_count, 0),
  }
})

const projectOptions = computed(() => {
  const seen = new Set<string>()
  return queueItems.value
    .filter(item => {
      if (seen.has(item.project_id)) return false
      seen.add(item.project_id)
      return true
    })
    .map(item => ({ project_id: item.project_id, project_title: item.project_title }))
    .sort((a, b) => a.project_title.localeCompare(b.project_title, 'zh-Hans-CN'))
})

const provinceOptions = computed(() => [...new Set(queueItems.value.map(item => item.target_province).filter((item): item is string => Boolean(item)))]
  .concat([...new Set(expansionItems.value.map(item => item.province).filter(Boolean))])
  .filter((province, index, list) => list.indexOf(province) === index)
  .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')))

const packOptions = computed(() => [...new Set(expansionItems.value.map(item => item.pack_id))]
  .sort((a, b) => packShortLabel(a).localeCompare(packShortLabel(b), 'zh-Hans-CN')))

const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return queueItems.value.filter(item => {
    const status = taskWritebackStatus(item)
    const text = [
      item.project_id,
      item.project_title,
      item.source_entry,
      item.video_type,
      item.target_province ?? '',
      item.suggested_file_path ?? '',
      item.task.label,
      item.task.description,
      item.task.knowledge_candidate_review_note ?? '',
      item.task.knowledge_writeback_note ?? '',
      item.task.knowledge_writeback_draft_markdown ?? '',
      ...(item.task.recommended_fields ?? []),
    ].join(' ').toLowerCase()
    return !packFilter.value
      && (!projectFilter.value || item.project_id === projectFilter.value)
      && (!videoTypeFilter.value || item.video_type === videoTypeFilter.value)
      && (!provinceFilter.value || item.target_province === provinceFilter.value)
      && (!writebackFilter.value || status === writebackFilter.value)
      && !reviewSourceFilter.value
      && matchesHandoffFilter(status, Boolean(item.task.knowledge_candidate_review_note?.trim()), 0)
      && (!query || text.includes(query))
  })
})

const filteredExpansionItems = computed(() => {
  if (projectFilter.value) return []
  const query = searchQuery.value.trim().toLowerCase()
  return expansionItems.value.filter(item => {
    const status = expansionWritebackStatus(item)
    const text = [
      item.review_item_id,
      item.batch_id,
      item.pack_id,
      item.entry_name,
      item.province,
      item.suggested_file_path,
      item.review_note ?? '',
      item.writeback_note ?? '',
      item.signoff_batch_id ?? '',
      item.signoff_batch_note ?? '',
      item.writeback_draft_markdown,
      item.append_markdown,
      ...item.target_video_types,
      ...(item.field_workbench ?? []).flatMap(field => [
        field.field_id,
        field.supplement_status,
        field.review_ready ? 'review_ready 审稿就绪' : 'review_blocked 审稿阻断',
        field.candidate_value ?? '',
        field.evidence_level ?? '',
        field.writeback_hint ?? '',
        field.verification_note ?? '',
        ...field.review_ready_missing,
        ...field.source_refs,
        ...field.review_questions,
      ]),
    ].join(' ').toLowerCase()
    return (!packFilter.value || item.pack_id === packFilter.value)
      && (!videoTypeFilter.value || item.target_video_types.includes(videoTypeFilter.value))
      && (!provinceFilter.value || item.province === provinceFilter.value)
      && (!writebackFilter.value || status === writebackFilter.value)
      && matchesReviewSourceFilter(item)
      && matchesHandoffFilter(
        status,
        Boolean(item.review_note?.trim()),
        itemSourceRefCount(item),
        item.review_state_source,
        item.review_state_overrides_seed,
      )
      && (!query || text.includes(query))
  })
})

const selectedExpansionItems = computed(() => {
  const selected = new Set(selectedExpansionIds.value)
  return filteredExpansionItems.value.filter(item => selected.has(item.review_item_id))
})

const allFilteredExpansionSelected = computed(() =>
  filteredExpansionItems.value.length > 0
  && filteredExpansionItems.value.every(item => selectedExpansionIds.value.includes(item.review_item_id)),
)

function taskWritebackStatus(item: ProjectSupplementTaskListItem): KnowledgeWritebackStatus {
  return item.task.knowledge_writeback_status ?? 'draft_ready'
}

function expansionWritebackStatus(item: DomainPackExpansionWritebackDraftItem): KnowledgeWritebackStatus {
  return item.writeback_status ?? 'draft_ready'
}

function countByStatus(status: KnowledgeWritebackStatus): number {
  return queueItems.value.filter(item => taskWritebackStatus(item) === status).length
    + expansionItems.value.filter(item => expansionWritebackStatus(item) === status).length
}

function writebackStatusLabel(status: KnowledgeWritebackStatus): string {
  if (status === 'queued') return '已入队'
  if (status === 'written_back') return '已入库'
  if (status === 'needs_revision') return '需重审'
  return '草案就绪'
}

function signoffBatchLabel(signoffBatchId: string): string {
  return signoffBatchId === UNASSIGNED_SIGNOFF_BATCH_ID ? '未归档审签批次' : signoffBatchId
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    heritage_promo: '非遗宣传',
    documentary_short: '微纪录',
    ai_comic_drama: 'AI漫剧',
    explainer_video: '知识讲解',
    culture_promo: '文化宣传',
    social_short: '竖屏短视频',
    character_story: '人物故事',
    historical_drama: '历史剧情',
    legend_story: '传说故事',
    city_brand_promo: '城市文旅',
    scene_short: '场景短片',
    landscape_mood: '山水意境',
    lecture_video: '宣讲片',
    education_training: '教育培训',
    children_story: '儿童故事',
  }
  return map[type] ?? type
}

function packShortLabel(packId: string): string {
  const map: Record<string, string> = {
    heritage_process_pack: '非遗流程',
    documentary_source_pack: '纪录来源',
    ai_comic_storyboard_pack: '漫剧分镜',
    era_and_costume_pack: '服饰器物',
    explainer_knowledge_structure_pack: '讲解结构',
    children_adaptation_safety_pack: '儿童改写',
    short_video_hook_pack: '短视频钩子',
    education_training_structure_pack: '宣讲培训',
  }
  return map[packId] ?? packId
}

function formatDate(iso?: string): string {
  if (!iso) return '未记录'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function noteDraft(item: ProjectSupplementTaskListItem): string {
  return noteDrafts[item.task.task_id] ?? item.task.knowledge_writeback_note ?? ''
}

function updateNoteDraft(taskId: string, event: Event) {
  noteDrafts[taskId] = (event.target as HTMLTextAreaElement).value
}

function expansionNoteDraft(item: DomainPackExpansionWritebackDraftItem): string {
  return expansionNoteDrafts[item.review_item_id] ?? item.writeback_note ?? ''
}

function updateExpansionNoteDraft(reviewItemId: string, event: Event) {
  expansionNoteDrafts[reviewItemId] = (event.target as HTMLTextAreaElement).value
}

function candidateFields(item: DomainPackExpansionWritebackDraftItem): DomainPackExpansionFieldWorkbenchItem[] {
  return (item.field_workbench ?? []).filter(field => field.supplement_status === 'candidate_draft')
}

function itemSourceRefCount(item: DomainPackExpansionWritebackDraftItem): number {
  return new Set((item.field_workbench ?? []).flatMap(field => field.source_refs)).size
}

function expansionItemSourceQuality(item: DomainPackExpansionWritebackDraftItem) {
  const fields = candidateFields(item)
  return {
    candidateFieldCount: item.field_supplement_candidate_count ?? fields.length,
    checkedFieldCount: fields.length,
    coveredFieldCount: fields.filter(field => field.source_refs.length > 0).length,
    sourceRefCount: new Set(fields.flatMap(field => field.source_refs)).size,
    missingSourceRefFieldCount: fields.filter(field => field.source_refs.length === 0).length,
    missingVerificationNoteFieldCount: fields.filter(field => !field.verification_note?.trim()).length,
    missingWritebackHintFieldCount: fields.filter(field => !field.writeback_hint?.trim()).length,
  }
}

function combinedSourceQuality(
  projectItems: ProjectSupplementTaskListItem[],
  expansionItems: DomainPackExpansionWritebackDraftItem[],
) {
  const sourceRefs = new Set<string>()
  let candidateFieldCount = 0
  let checkedFieldCount = 0
  let coveredFieldCount = 0
  let localSourceRefCount = 0
  let anchoredSourceRefCount = 0
  let missingSourceRefFieldCount = 0
  let missingVerificationNoteFieldCount = 0
  let missingWritebackHintFieldCount = 0

  for (const item of expansionItems) {
    const quality = expansionItemSourceQuality(item)
    candidateFieldCount += quality.candidateFieldCount
    checkedFieldCount += quality.checkedFieldCount
    coveredFieldCount += quality.coveredFieldCount
    missingSourceRefFieldCount += quality.missingSourceRefFieldCount
    missingVerificationNoteFieldCount += quality.missingVerificationNoteFieldCount
    missingWritebackHintFieldCount += quality.missingWritebackHintFieldCount
    for (const ref of (item.field_workbench ?? []).flatMap(field => field.source_refs)) {
      sourceRefs.add(ref)
      if (isLocalSourceRef(ref)) localSourceRefCount += 1
      if (hasSourceRefAnchor(ref)) anchoredSourceRefCount += 1
    }
  }

  for (const item of projectItems) {
    for (const line of (item.task.knowledge_writeback_draft_markdown ?? '')
      .split('\n')
      .filter(line => /source_refs?|来源|参考|出处/i.test(line))) {
      sourceRefs.add(line.trim())
    }
  }

  return {
    candidateFieldCount,
    checkedFieldCount,
    coveredFieldCount,
    sourceRefCount: sourceRefs.size,
    localSourceRefCount,
    anchoredSourceRefCount,
    anchorReviewCount: anchoredSourceRefCount,
    missingSourceRefFieldCount,
    missingVerificationNoteFieldCount,
    missingWritebackHintFieldCount,
  }
}

function isLocalSourceRef(sourceRef: string): boolean {
  return sourceRef.startsWith('data/')
}

function hasSourceRefAnchor(sourceRef: string): boolean {
  return sourceRef.includes('#') && sourceRef.split('#')[1]?.trim().length > 0
}

function renderLocalManualReviewDiff(
  targetFile: string,
  projectItems: ProjectSupplementTaskListItem[],
  expansionItems: DomainPackExpansionWritebackDraftItem[],
): string[] {
  const appendLines = [
    `<!-- knowledge_writeback_manual_patch target_file="${targetFile}" direct_writeback_to_province_markdown="false" -->`,
    ...projectItems.flatMap(item => [
      '',
      `<!-- project_writeback task="${writebackItemKey(item)}" status="${taskWritebackStatus(item)}" -->`,
      (item.task.knowledge_writeback_draft_markdown ?? '').trim(),
    ]),
    ...expansionItems.flatMap(item => [
      '',
      `<!-- domain_pack_expansion_writeback review_item_id="${item.review_item_id}" status="${expansionWritebackStatus(item)}" -->`,
      (item.append_markdown || item.writeback_draft_markdown).trim(),
    ]),
  ].join('\n').trim().split('\n')
  return [
    `diff --git a/${targetFile} b/${targetFile}`,
    `--- a/${targetFile}`,
    `+++ b/${targetFile}`,
    '@@ manual_append_review_only @@',
    ...appendLines.map(line => `+${line}`),
  ]
}

function sourceQualityLabel(level: SourceRefQualityLevel): string {
  if (level === 'blocker') return '来源阻塞'
  if (level === 'warning') return '需人工核对'
  return '来源就绪'
}

function completionPercent(completedCount: number, totalCount: number): number {
  if (totalCount <= 0) return 100
  return Math.round((completedCount / totalCount) * 100)
}

function hasExpansionReviewerIdentity(item: DomainPackExpansionWritebackDraftItem): boolean {
  return Boolean(item.reviewed_by?.trim() || item.reviewer_name?.trim() || item.reviewer_id?.trim())
}

function isReviewHandoffItemReadyForSignoff(item: ReviewHandoffPreviewItem): boolean {
  return Boolean(item.signoff_batch_id?.trim())
    && item.writeback_status !== 'needs_revision'
    && item.has_review_note
    && item.has_reviewer_identity
    && (item.source_label === '项目草案' || item.source_ref_count > 0)
}

function reviewStateSourceLabel(source: DomainPackExpansionReviewStateSource): string {
  if (source === 'runtime') return '运行态'
  if (source === 'seed') return 'Seed'
  return '未记录'
}

function matchesReviewSourceFilter(item: DomainPackExpansionWritebackDraftItem): boolean {
  if (!reviewSourceFilter.value) return true
  if (reviewSourceFilter.value === 'overrides_seed') return item.review_state_overrides_seed
  return item.review_state_source === reviewSourceFilter.value
}

function matchesHandoffFilter(
  status: KnowledgeWritebackStatus,
  hasReviewNote: boolean,
  sourceRefCount: number,
  reviewStateSource?: DomainPackExpansionReviewStateSource,
  reviewStateOverridesSeed?: boolean,
): boolean {
  if (!handoffFilter.value) return true
  if (handoffFilter.value === 'requires_signoff') return status !== 'written_back'
  if (handoffFilter.value === 'missing_review_note') return !hasReviewNote
  if (handoffFilter.value === 'ready_to_queue') return status === 'draft_ready' && hasReviewNote && sourceRefCount > 0
  if (handoffFilter.value === 'queued_for_writeback') return status === 'queued'
  if (handoffFilter.value === 'needs_revision_handoff') return status === 'needs_revision'
  if (handoffFilter.value === 'runtime_override') {
    return reviewStateSource === 'runtime' || Boolean(reviewStateOverridesSeed)
  }
  return true
}

function reviewHandoffRequiredAction(
  status: KnowledgeWritebackStatus,
  hasReviewNote: boolean,
  sourceRefCount: number,
): string {
  if (status === 'written_back') return '已标记写回，仍需核对省份 Markdown diff'
  if (status === 'needs_revision') return '按退回原因补来源、边界或写回范围'
  if (!hasReviewNote) return '补充复核备注后再签收'
  if (sourceRefCount === 0) return '补充来源引用或人工证据链接后再签收'
  if (status === 'queued') return '已入队，等待人工核对字段差异'
  return '草案就绪，等待人工签收或批量入队'
}

function toggleExpansionSelection(item: DomainPackExpansionWritebackDraftItem, event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  const selected = new Set(selectedExpansionIds.value)
  if (checked) selected.add(item.review_item_id)
  else selected.delete(item.review_item_id)
  selectedExpansionIds.value = [...selected]
}

function toggleAllFilteredExpansion(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  const selected = new Set(selectedExpansionIds.value)
  for (const item of filteredExpansionItems.value) {
    if (checked) selected.add(item.review_item_id)
    else selected.delete(item.review_item_id)
  }
  selectedExpansionIds.value = [...selected]
}

function applyExpansionRevisionTemplate(item: DomainPackExpansionWritebackDraftItem, event: Event) {
  const target = event.target as HTMLSelectElement
  const value = target.value
  if (value) expansionNoteDrafts[item.review_item_id] = value
  target.value = ''
}

function applyBulkRevisionTemplate(event: Event) {
  const target = event.target as HTMLSelectElement
  const value = target.value
  if (value) bulkExpansionNote.value = value
  target.value = ''
}

async function loadTasks() {
  loading.value = true
  error.value = ''
  const [res, expansionRes] = await Promise.all([
    listSupplementTasks({ knowledge_writeback_ready: true }),
    getDomainPackExpansionWritebackDraft(),
  ])
  if (res.ok && res.data) {
    tasks.value = res.data
  } else {
    error.value = res.error?.message ?? '加载写回队列失败'
  }
  if (expansionRes.ok && expansionRes.data) {
    expansionDraft.value = expansionRes.data
  } else if (!error.value) {
    error.value = expansionRes.error?.message ?? '加载扩库写回草案失败'
  }
  loading.value = false
}

async function copyPatch(format: 'markdown' | 'json') {
  const visibleItems = filteredItems.value
  if (visibleItems.length === 0) {
    copyMessage.value = ''
    error.value = '当前筛选没有可导出的写回草案'
    return
  }

  exportingFormat.value = format
  error.value = ''
  copyMessage.value = ''
  try {
    const res = await exportKnowledgeWritebackQueuePatch({
      ...(projectFilter.value ? { project_id: projectFilter.value } : {}),
      ...(videoTypeFilter.value ? { video_type: videoTypeFilter.value } : {}),
      ...(provinceFilter.value ? { province: provinceFilter.value } : {}),
      ...(writebackFilter.value ? { knowledge_writeback_status: writebackFilter.value } : {}),
      ...(searchQuery.value.trim() ? { search_query: searchQuery.value.trim() } : {}),
      task_keys: visibleItems.map(writebackItemKey),
    })
    if (res.ok && res.data) {
      const clipboardText = format === 'json'
        ? JSON.stringify(res.data, null, 2)
        : res.data.markdown
      await navigator.clipboard.writeText(clipboardText)
      const exportLabel = format === 'json' ? 'JSON 导出包' : 'Markdown Patch'
      const statusText = res.data.status_counts ? `；${statusCountSummary(res.data.status_counts)}` : ''
      copyMessage.value = `已复制 ${exportLabel}：${res.data.approved_count}/${visibleItems.length} 条当前可见草案，目标文件 ${res.data.target_files.length} 个${statusText}。`
    } else {
      error.value = res.error?.message ?? '导出写回队列失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '复制写回队列失败'
  } finally {
    exportingFormat.value = ''
  }
}

async function copyUnifiedExport(format: 'markdown' | 'json') {
  const visibleProjectItems = filteredItems.value
  const visibleExpansionItems = filteredExpansionItems.value
  if (visibleProjectItems.length + visibleExpansionItems.length === 0) {
    copyMessage.value = ''
    error.value = '当前筛选没有可导出的写回草案'
    return
  }

  exportingFormat.value = format === 'json' ? 'unified-json' : 'unified-markdown'
  error.value = ''
  copyMessage.value = ''
  try {
    const res = await exportKnowledgeWritebackQueuePackage({
      ...(projectFilter.value ? { project_id: projectFilter.value } : {}),
      ...(videoTypeFilter.value ? { video_type: videoTypeFilter.value } : {}),
      ...(provinceFilter.value ? { province: provinceFilter.value } : {}),
      ...(writebackFilter.value ? { knowledge_writeback_status: writebackFilter.value } : {}),
      ...(searchQuery.value.trim() ? { search_query: searchQuery.value.trim() } : {}),
      project_task_keys: visibleProjectItems.map(writebackItemKey),
      expansion_review_item_ids: visibleExpansionItems.map(item => item.review_item_id),
    })
    if (res.ok && res.data) {
      const clipboardText = format === 'json'
        ? JSON.stringify(res.data, null, 2)
        : res.data.markdown
      await navigator.clipboard.writeText(clipboardText)
      const exportLabel = format === 'json' ? '统一 JSON 导出包' : '统一 Markdown 导出包'
      copyMessage.value = `已复制 ${exportLabel}：项目 ${res.data.project_approved_count} 条，扩库 ${res.data.expansion_approved_count} 条，目标文件 ${res.data.preflight.target_file_count} 个，字段候选 ${res.data.preflight.expansion_candidate_field_count} 个，来源引用 ${res.data.preflight.expansion_source_ref_count} 条，待人工签收 ${res.data.preflight.review_handoff.requires_manual_signoff_count} 条；省份 Markdown 未写入。`
    } else {
      error.value = res.error?.message ?? '导出统一写回队列失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '复制统一写回队列失败'
  } finally {
    exportingFormat.value = ''
  }
}

async function downloadUnifiedExport(format: 'markdown' | 'json') {
  const visibleProjectItems = filteredItems.value
  const visibleExpansionItems = filteredExpansionItems.value
  if (visibleProjectItems.length + visibleExpansionItems.length === 0) {
    copyMessage.value = ''
    error.value = '当前筛选没有可下载归档的写回草案'
    return
  }

  exportingFormat.value = format === 'json' ? 'download-unified-json' : 'download-unified-markdown'
  error.value = ''
  copyMessage.value = ''
  try {
    const res = await exportKnowledgeWritebackQueuePackage({
      ...(projectFilter.value ? { project_id: projectFilter.value } : {}),
      ...(videoTypeFilter.value ? { video_type: videoTypeFilter.value } : {}),
      ...(provinceFilter.value ? { province: provinceFilter.value } : {}),
      ...(writebackFilter.value ? { knowledge_writeback_status: writebackFilter.value } : {}),
      ...(searchQuery.value.trim() ? { search_query: searchQuery.value.trim() } : {}),
      project_task_keys: visibleProjectItems.map(writebackItemKey),
      expansion_review_item_ids: visibleExpansionItems.map(item => item.review_item_id),
    })
    if (res.ok && res.data) {
      const manifest = res.data.signoff_package.signoff_manifest
      const baseName = safeDownloadName(`knowledge-writeback-${manifest.manifest_id}-${manifest.sha256.slice(0, 12)}`)
      const content = format === 'json'
        ? JSON.stringify(res.data, null, 2)
        : res.data.markdown
      const extension = format === 'json' ? 'json' : 'md'
      const mime = format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8'
      downloadTextFile(`${baseName}.${extension}`, content, mime)
      const exportLabel = format === 'json' ? '统一 JSON 归档' : '统一 Markdown 归档'
      copyMessage.value = `已下载 ${exportLabel}：${manifest.manifest_id}，项目 ${res.data.project_approved_count} 条，扩库 ${res.data.expansion_approved_count} 条，待人工签收 ${res.data.preflight.review_handoff.requires_manual_signoff_count} 条；省份 Markdown 未写入。`
    } else {
      error.value = res.error?.message ?? '下载统一写回归档失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '下载统一写回归档失败'
  } finally {
    exportingFormat.value = ''
  }
}

async function copyReviewHandoffChecklist() {
  if (reviewHandoffItems.value.length === 0) {
    copyMessage.value = ''
    error.value = '当前筛选没有可复制的复核交接项'
    return
  }

  exportingFormat.value = 'handoff-markdown'
  error.value = ''
  copyMessage.value = ''
  try {
    await navigator.clipboard.writeText(renderReviewHandoffChecklist())
    copyMessage.value = `已复制复核签收清单：${reviewHandoffItems.value.length} 条，待签收 ${reviewHandoffSummary.value.requiresManualSignoffCount} 条；省份 Markdown 未写入。`
  } catch (err) {
    error.value = err instanceof Error ? err.message : '复制复核签收清单失败'
  } finally {
    exportingFormat.value = ''
  }
}

async function copySignoffManifestPackage() {
  const visibleProjectItems = filteredItems.value
  const visibleExpansionItems = filteredExpansionItems.value
  if (visibleProjectItems.length + visibleExpansionItems.length === 0) {
    copyMessage.value = ''
    error.value = '当前筛选没有可复制的签收 Manifest'
    return
  }

  exportingFormat.value = 'signoff-json'
  error.value = ''
  copyMessage.value = ''
  try {
    const res = await exportKnowledgeWritebackQueuePackage({
      ...(projectFilter.value ? { project_id: projectFilter.value } : {}),
      ...(videoTypeFilter.value ? { video_type: videoTypeFilter.value } : {}),
      ...(provinceFilter.value ? { province: provinceFilter.value } : {}),
      ...(writebackFilter.value ? { knowledge_writeback_status: writebackFilter.value } : {}),
      ...(searchQuery.value.trim() ? { search_query: searchQuery.value.trim() } : {}),
      project_task_keys: visibleProjectItems.map(writebackItemKey),
      expansion_review_item_ids: visibleExpansionItems.map(item => item.review_item_id),
    })
    if (res.ok && res.data) {
      const signoffPackage = res.data.signoff_package
      await navigator.clipboard.writeText(JSON.stringify(signoffPackage, null, 2))
      copyMessage.value = `已复制签收 Manifest：${signoffPackage.signoff_manifest.manifest_id}，${signoffPackage.handoff_item_count} 条交接项，sha256 ${signoffPackage.signoff_manifest.sha256.slice(0, 12)}…；省份 Markdown 未写入。`
    } else {
      error.value = res.error?.message ?? '导出签收 Manifest 失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '复制签收 Manifest 失败'
  } finally {
    exportingFormat.value = ''
  }
}

async function downloadSignoffManifestPackage() {
  const visibleProjectItems = filteredItems.value
  const visibleExpansionItems = filteredExpansionItems.value
  if (visibleProjectItems.length + visibleExpansionItems.length === 0) {
    copyMessage.value = ''
    error.value = '当前筛选没有可下载归档的签收包'
    return
  }

  exportingFormat.value = 'download-signoff-json'
  error.value = ''
  copyMessage.value = ''
  try {
    const res = await exportKnowledgeWritebackQueuePackage({
      ...(projectFilter.value ? { project_id: projectFilter.value } : {}),
      ...(videoTypeFilter.value ? { video_type: videoTypeFilter.value } : {}),
      ...(provinceFilter.value ? { province: provinceFilter.value } : {}),
      ...(writebackFilter.value ? { knowledge_writeback_status: writebackFilter.value } : {}),
      ...(searchQuery.value.trim() ? { search_query: searchQuery.value.trim() } : {}),
      project_task_keys: visibleProjectItems.map(writebackItemKey),
      expansion_review_item_ids: visibleExpansionItems.map(item => item.review_item_id),
    })
    if (res.ok && res.data) {
      const signoffPackage = res.data.signoff_package
      const manifest = signoffPackage.signoff_manifest
      const filename = `${safeDownloadName(`knowledge-signoff-package-${manifest.manifest_id}-${manifest.sha256.slice(0, 12)}`)}.json`
      downloadTextFile(filename, JSON.stringify(signoffPackage, null, 2), 'application/json;charset=utf-8')
      copyMessage.value = `已下载签收包：${manifest.manifest_id}，${signoffPackage.handoff_item_count} 条交接项，批次 ${signoffPackage.signoff_batch_summaries.length} 个；省份 Markdown 未写入。`
    } else {
      error.value = res.error?.message ?? '下载签收包失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '下载签收包失败'
  } finally {
    exportingFormat.value = ''
  }
}

async function copyManualPatchPackage() {
  const visibleProjectItems = filteredItems.value
  const visibleExpansionItems = filteredExpansionItems.value
  if (visibleProjectItems.length + visibleExpansionItems.length === 0) {
    copyMessage.value = ''
    error.value = '当前筛选没有可复制的人工 patch 包'
    return
  }

  exportingFormat.value = 'manual-patch-json'
  error.value = ''
  copyMessage.value = ''
  try {
    const res = await exportKnowledgeWritebackQueuePackage({
      ...(projectFilter.value ? { project_id: projectFilter.value } : {}),
      ...(videoTypeFilter.value ? { video_type: videoTypeFilter.value } : {}),
      ...(provinceFilter.value ? { province: provinceFilter.value } : {}),
      ...(writebackFilter.value ? { knowledge_writeback_status: writebackFilter.value } : {}),
      ...(searchQuery.value.trim() ? { search_query: searchQuery.value.trim() } : {}),
      project_task_keys: visibleProjectItems.map(writebackItemKey),
      expansion_review_item_ids: visibleExpansionItems.map(item => item.review_item_id),
    })
    if (res.ok && res.data) {
      const patchPackage = res.data.manual_patch_package
      await navigator.clipboard.writeText(JSON.stringify(patchPackage, null, 2))
      copyMessage.value = `已复制人工 patch 包：目标文件 ${patchPackage.target_file_count} 个，patch ${patchPackage.total_patch_count} 条，closure ${patchPackage.manual_patch_closure_certificate.certificate_id}，ready ${patchPackage.ready_for_manual_apply ? 'yes' : 'no'}；省份 Markdown 未写入。`
    } else {
      error.value = res.error?.message ?? '导出人工 patch 包失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '复制人工 patch 包失败'
  } finally {
    exportingFormat.value = ''
  }
}

async function downloadManualPatchPackage() {
  const visibleProjectItems = filteredItems.value
  const visibleExpansionItems = filteredExpansionItems.value
  if (visibleProjectItems.length + visibleExpansionItems.length === 0) {
    copyMessage.value = ''
    error.value = '当前筛选没有可下载的人工 patch 包'
    return
  }

  exportingFormat.value = 'download-manual-patch-json'
  error.value = ''
  copyMessage.value = ''
  try {
    const res = await exportKnowledgeWritebackQueuePackage({
      ...(projectFilter.value ? { project_id: projectFilter.value } : {}),
      ...(videoTypeFilter.value ? { video_type: videoTypeFilter.value } : {}),
      ...(provinceFilter.value ? { province: provinceFilter.value } : {}),
      ...(writebackFilter.value ? { knowledge_writeback_status: writebackFilter.value } : {}),
      ...(searchQuery.value.trim() ? { search_query: searchQuery.value.trim() } : {}),
      project_task_keys: visibleProjectItems.map(writebackItemKey),
      expansion_review_item_ids: visibleExpansionItems.map(item => item.review_item_id),
    })
    if (res.ok && res.data) {
      const patchPackage = res.data.manual_patch_package
      const manifest = res.data.signoff_package.signoff_manifest
      const filename = `${safeDownloadName(`knowledge-manual-patch-${manifest.manifest_id}-${manifest.sha256.slice(0, 12)}`)}.json`
      downloadTextFile(filename, JSON.stringify(patchPackage, null, 2), 'application/json;charset=utf-8')
      copyMessage.value = `已下载人工 patch 包：${patchPackage.target_file_count} 个目标文件，${patchPackage.total_patch_count} 条 patch，closure ${patchPackage.manual_patch_closure_certificate.certificate_id}；patch_applyable=false。`
    } else {
      error.value = res.error?.message ?? '下载人工 patch 包失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '下载人工 patch 包失败'
  } finally {
    exportingFormat.value = ''
  }
}

async function copyManualPatchDiffBundle() {
  const visibleProjectItems = filteredItems.value
  const visibleExpansionItems = filteredExpansionItems.value
  if (visibleProjectItems.length + visibleExpansionItems.length === 0) {
    copyMessage.value = ''
    error.value = '当前筛选没有可复制的人工 patch diff'
    return
  }

  exportingFormat.value = 'manual-patch-diff'
  error.value = ''
  copyMessage.value = ''
  try {
    const res = await exportKnowledgeWritebackQueuePackage({
      ...(projectFilter.value ? { project_id: projectFilter.value } : {}),
      ...(videoTypeFilter.value ? { video_type: videoTypeFilter.value } : {}),
      ...(provinceFilter.value ? { province: provinceFilter.value } : {}),
      ...(writebackFilter.value ? { knowledge_writeback_status: writebackFilter.value } : {}),
      ...(searchQuery.value.trim() ? { search_query: searchQuery.value.trim() } : {}),
      project_task_keys: visibleProjectItems.map(writebackItemKey),
      expansion_review_item_ids: visibleExpansionItems.map(item => item.review_item_id),
    })
    if (res.ok && res.data) {
      const bundle = renderManualPatchDiffBundle(res.data)
      await navigator.clipboard.writeText(bundle)
      const patchPackage = res.data.manual_patch_package
      copyMessage.value = `已复制人工 patch diff：目标文件 ${patchPackage.target_file_count} 个，patch ${patchPackage.total_patch_count} 条，closure ${patchPackage.manual_patch_closure_certificate.certificate_id}，来源覆盖 ${patchPackage.source_ref_quality.coverage_percent}%。`
    } else {
      error.value = res.error?.message ?? '导出人工 patch diff 失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '复制人工 patch diff 失败'
  } finally {
    exportingFormat.value = ''
  }
}

async function downloadManualPatchDiffBundle() {
  const visibleProjectItems = filteredItems.value
  const visibleExpansionItems = filteredExpansionItems.value
  if (visibleProjectItems.length + visibleExpansionItems.length === 0) {
    copyMessage.value = ''
    error.value = '当前筛选没有可下载的人工 patch diff'
    return
  }

  exportingFormat.value = 'download-manual-patch-diff'
  error.value = ''
  copyMessage.value = ''
  try {
    const res = await exportKnowledgeWritebackQueuePackage({
      ...(projectFilter.value ? { project_id: projectFilter.value } : {}),
      ...(videoTypeFilter.value ? { video_type: videoTypeFilter.value } : {}),
      ...(provinceFilter.value ? { province: provinceFilter.value } : {}),
      ...(writebackFilter.value ? { knowledge_writeback_status: writebackFilter.value } : {}),
      ...(searchQuery.value.trim() ? { search_query: searchQuery.value.trim() } : {}),
      project_task_keys: visibleProjectItems.map(writebackItemKey),
      expansion_review_item_ids: visibleExpansionItems.map(item => item.review_item_id),
    })
    if (res.ok && res.data) {
      const manifest = res.data.signoff_package.signoff_manifest
      const filename = `${safeDownloadName(`knowledge-manual-patch-diff-${manifest.manifest_id}-${manifest.sha256.slice(0, 12)}`)}.diff`
      downloadTextFile(filename, renderManualPatchDiffBundle(res.data), 'text/x-diff;charset=utf-8')
      copyMessage.value = `已下载人工 patch diff：${res.data.manual_patch_package.target_file_count} 个目标文件，closure ${res.data.manual_patch_package.manual_patch_closure_certificate.certificate_id}；patch_applyable=false。`
    } else {
      error.value = res.error?.message ?? '下载人工 patch diff 失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '下载人工 patch diff 失败'
  } finally {
    exportingFormat.value = ''
  }
}

function renderReviewHandoffChecklist(): string {
  const statusText = statusCountSummary(reviewHandoffItems.value.reduce((counts, item) => {
    counts[item.writeback_status] += 1
    return counts
  }, {
    draft_ready: 0,
    queued: 0,
    written_back: 0,
    needs_revision: 0,
  } as Record<KnowledgeWritebackStatus, number>))

  return [
    '# Knowledge Writeback Review Handoff',
    '',
    '- direct_writeback_to_province_markdown: false',
    '- province_markdown_written: false',
    `- local_signoff_manifest_id: ${reviewHandoffManifest.value.manifestId}`,
    `- local_signoff_manifest_fingerprint: ${reviewHandoffManifest.value.fingerprint}`,
    `- visible_handoff_count: ${reviewHandoffItems.value.length}`,
    `- requires_manual_signoff_count: ${reviewHandoffSummary.value.requiresManualSignoffCount}`,
    `- runtime_override_count: ${reviewHandoffSummary.value.runtimeOverrideCount}`,
    `- missing_review_note_count: ${reviewHandoffSummary.value.missingReviewNoteCount}`,
    `- source_ref_count: ${reviewHandoffSummary.value.sourceRefCount}`,
    `- writeback_status_counts: ${statusText}`,
    '',
    '## Operator Checklist',
    '',
    '- 核对 target_file 是否匹配省份条目。',
    '- 核对 review_note、writeback_note、source_refs 和字段差异。',
    '- runtime 覆盖 seed 时优先确认退回原因和复核备注。',
    '- 本清单只用于人工写回签收，不直接修改 data/provinces/*.md。',
    '',
    '## Handoff Items',
    '',
    ...reviewHandoffItems.value.flatMap(item => [
      `- [ ] ${item.handoff_id}｜${item.title}`,
      `  - source: ${item.source_label}`,
      `  - target_file: ${item.target_file}`,
      `  - writeback_status: ${item.writeback_status}`,
      `  - candidate_fields: ${item.candidate_field_count}`,
      `  - source_refs: ${item.source_ref_count}`,
      `  - action: ${item.required_action}`,
    ]),
  ].join('\n')
}

function renderManualPatchDiffBundle(pkg: KnowledgeWritebackQueueExportPackage): string {
  const manualPatch = pkg.manual_patch_package
  const closureCertificate = manualPatch.manual_patch_closure_certificate
  return [
    '# Knowledge Manual Patch Diff Bundle',
    '',
    `# schema_version: ${manualPatch.schema_version}`,
    `# exported_at: ${manualPatch.exported_at}`,
    `# patch_applyable: ${manualPatch.patch_applyable}`,
    `# manual_apply_only: ${manualPatch.manual_apply_only}`,
    `# ready_for_manual_apply: ${manualPatch.ready_for_manual_apply}`,
    `# manual_patch_manifest_id: ${manualPatch.manual_patch_manifest.manifest_id}`,
    `# manual_patch_manifest_sha256: ${manualPatch.manual_patch_manifest.sha256}`,
    `# closure_certificate_id: ${closureCertificate.certificate_id}`,
    `# closure_certificate_sha256: ${closureCertificate.sha256}`,
    `# closure_certificate_status: ${closureCertificate.status}`,
    `# closure_certificate_ready: ${closureCertificate.ready_for_operator_apply}`,
    `# closure_certificate_signoff_manifest_id: ${closureCertificate.signoff_manifest_id}`,
    `# closure_certificate_manual_patch_manifest_id: ${closureCertificate.manual_patch_manifest_id}`,
    `# target_file_count: ${manualPatch.target_file_count}`,
    `# ready_target_file_count: ${manualPatch.ready_target_file_count}`,
    `# blocked_target_file_count: ${manualPatch.blocked_target_file_count}`,
    `# total_patch_count: ${manualPatch.total_patch_count}`,
    `# source_ref_coverage_percent: ${manualPatch.source_ref_quality.coverage_percent}`,
    `# source_ref_check_warning_count: ${manualPatch.source_ref_quality.source_ref_check_warning_count}`,
    `# source_ref_check_blocker_count: ${manualPatch.source_ref_quality.source_ref_check_blocker_count}`,
    `# file_missing_source_ref_count: ${manualPatch.source_ref_quality.file_missing_source_ref_count}`,
    `# anchor_missing_source_ref_count: ${manualPatch.source_ref_quality.anchor_missing_source_ref_count}`,
    ...manualPatch.ready_reasons.map(reason => `# ready_reason: ${reason}`),
    ...manualPatch.blocker_reasons.map(reason => `# blocker_reason: ${reason}`),
    ...manualPatch.warning_reasons.map(reason => `# warning_reason: ${reason}`),
    ...closureCertificate.operator_required_actions.map(action => `# closure_action: ${action}`),
    '',
    ...manualPatch.target_patches.flatMap(target => [
      `# target_file: ${target.target_file}`,
      `# ready_for_manual_apply: ${target.ready_for_manual_apply}`,
      `# source_ref_quality: ${target.source_ref_quality_level}; coverage=${target.source_ref_coverage_percent}%`,
      ...target.blocker_reasons.map(reason => `# target_blocker_reason: ${reason}`),
      ...target.warning_reasons.map(reason => `# target_warning_reason: ${reason}`),
      target.review_diff.trimEnd(),
      '',
    ]),
  ].join('\n').trim() + '\n'
}

function safeDownloadName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'knowledge-writeback-export'
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function localManifestFingerprint(input: string): string {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

async function copyExpansionDraft(format: 'markdown' | 'json') {
  const visibleItems = filteredExpansionItems.value
  if (visibleItems.length === 0) {
    copyMessage.value = ''
    error.value = '当前筛选没有可导出的扩库写回草案'
    return
  }

  exportingFormat.value = format === 'json' ? 'expansion-json' : 'expansion-markdown'
  error.value = ''
  copyMessage.value = ''
  try {
    const res = await getDomainPackExpansionWritebackDraft({
      review_item_ids: visibleItems.map(item => item.review_item_id),
    })
    if (res.ok && res.data) {
      const clipboardText = format === 'json'
        ? JSON.stringify(res.data, null, 2)
        : res.data.markdown
      await navigator.clipboard.writeText(clipboardText)
      const exportLabel = format === 'json' ? '扩库 JSON 导出包' : '扩库 Markdown 草案'
      const fieldCandidateCount = res.data.items.reduce((sum, item) => sum + (item.field_supplement_candidate_count ?? 0), 0)
      const fieldMissingCount = res.data.items.reduce((sum, item) => sum + (item.field_missing_candidate_count ?? 0), 0)
      copyMessage.value = `已复制 ${exportLabel}：${res.data.approved_count}/${visibleItems.length} 条当前可见扩库草案，字段候选 ${fieldCandidateCount} 个，缺口 ${fieldMissingCount} 个，目标文件 ${res.data.target_files.length} 个。`
    } else {
      error.value = res.error?.message ?? '导出扩库写回草案失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '复制扩库写回草案失败'
  } finally {
    exportingFormat.value = ''
  }
}

async function setWritebackStatus(item: ProjectSupplementTaskListItem, status: KnowledgeWritebackStatus) {
  updatingTaskId.value = item.task.task_id
  error.value = ''
  const res = await updateProjectSupplementTask(item.project_id, item.task.task_id, {
    status: item.task.status,
    knowledge_writeback_status: status,
    knowledge_writeback_note: noteDraft(item).trim() || writebackStatusLabel(status),
  })
  if (res.ok) {
    delete noteDrafts[item.task.task_id]
    await loadTasks()
  } else {
    error.value = res.error?.message ?? '更新写回状态失败'
  }
  updatingTaskId.value = ''
}

async function setExpansionWritebackStatus(
  item: DomainPackExpansionWritebackDraftItem,
  status: KnowledgeWritebackStatus,
) {
  updatingTaskId.value = item.review_item_id
  error.value = ''
  const res = await updateDomainPackExpansionReviewState({
    review_item_id: item.review_item_id,
    review_status: status === 'needs_revision' ? 'needs_revision' : 'approved',
    review_note: status === 'needs_revision'
      ? (expansionNoteDraft(item).trim() || '退回补充：需补充来源证据、边界说明或写回范围后再审。')
      : item.review_note,
    writeback_status: status === 'needs_revision' ? undefined : status,
    writeback_note: status === 'needs_revision'
      ? undefined
      : (expansionNoteDraft(item).trim() || writebackStatusLabel(status)),
  })
  if (res.ok) {
    delete expansionNoteDrafts[item.review_item_id]
    await loadTasks()
  } else {
    error.value = res.error?.message ?? '更新扩库写回状态失败'
  }
  updatingTaskId.value = ''
}

async function bulkSetExpansionWritebackStatus(status: KnowledgeWritebackStatus) {
  const items = selectedExpansionItems.value
  if (items.length === 0) return
  const actionLabel = writebackStatusLabel(status)
  const note = bulkExpansionNote.value.trim()
  const confirmed = window.confirm(`将当前选择的 ${items.length} 条扩库草案批量标记为${actionLabel}？`)
  if (!confirmed) return

  bulkUpdatingKey.value = status
  error.value = ''
  copyMessage.value = ''
  try {
    const res = await updateDomainPackExpansionReviewStateBulk({
      review_item_ids: items.map(item => item.review_item_id),
      review_status: status === 'needs_revision' ? 'needs_revision' : 'approved',
      review_note: status === 'needs_revision'
        ? (note || '批量退回：需补充来源证据、边界说明或写回范围后再审。')
        : undefined,
      writeback_status: status === 'needs_revision' ? undefined : status,
      writeback_note: status === 'needs_revision' ? undefined : (note || `批量标记：${actionLabel}`),
    })
    if (res.ok && res.data) {
      selectedExpansionIds.value = selectedExpansionIds.value
        .filter(id => !items.some(item => item.review_item_id === id))
      bulkExpansionNote.value = ''
      await loadTasks()
      copyMessage.value = `已批量更新 ${res.data.updated_count} 条扩库草案为${actionLabel}；省份 Markdown 未写入。`
    } else {
      error.value = res.error?.message ?? '批量更新扩库写回状态失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '批量更新扩库写回状态失败'
  } finally {
    bulkUpdatingKey.value = ''
  }
}

function writebackItemKey(item: ProjectSupplementTaskListItem): string {
  return `${item.project_id}::${item.task.task_id}`
}

function statusCountSummary(counts: Record<KnowledgeWritebackStatus, number>): string {
  return [
    `草案 ${counts.draft_ready ?? 0}`,
    `入队 ${counts.queued ?? 0}`,
    `已入库 ${counts.written_back ?? 0}`,
    `重审 ${counts.needs_revision ?? 0}`,
  ].join(' / ')
}

onMounted(async () => {
  await loadTasks()
})
</script>

<style scoped>
.writeback-page {
  max-width: 1180px;
  margin: 0 auto;
}

.writeback-page__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.writeback-page__header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.writeback-page__title {
  margin: 0 0 6px;
  color: #22313f;
  font-size: 28px;
}

.writeback-page__desc {
  margin: 0;
  color: #66727f;
  line-height: 1.6;
}

.writeback-page__back,
.writeback-page__item a {
  border-radius: 4px;
  background: #2980b9;
  color: #fff;
  text-decoration: none;
  font-size: 14px;
}

.writeback-page__back {
  flex: 0 0 auto;
  padding: 10px 14px;
}

.writeback-page__back--secondary {
  background: #506274;
}

.writeback-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.writeback-page__search,
.writeback-page__select {
  padding: 10px 12px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  font-size: 14px;
}

.writeback-page__search {
  flex: 1 1 260px;
}

.writeback-page__select {
  min-width: 150px;
}

.writeback-page__action {
  border: 1px solid #2980b9;
  border-radius: 6px;
  padding: 10px 12px;
  background: #2980b9;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.writeback-page__action--secondary {
  border-color: #7d8b99;
  background: #fff;
  color: #2f3f4f;
}

.writeback-page__action--danger {
  border-color: #c0392b;
  background: #fff;
  color: #a93226;
}

.writeback-page__action:disabled,
.writeback-page__status-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.writeback-page__notice {
  margin: -2px 0 14px;
  border: 1px solid #badbcc;
  border-radius: 6px;
  padding: 8px 10px;
  background: #f0f8f4;
  color: #216e44;
  font-size: 13px;
}

.writeback-page__bulk {
  display: grid;
  grid-template-columns: minmax(180px, auto) minmax(150px, auto) minmax(220px, 1fr) repeat(3, auto);
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  padding: 10px;
  background: #f8fbfd;
}

.writeback-page__bulk label {
  color: #33475b;
  font-size: 13px;
}

.writeback-page__bulk textarea {
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  resize: vertical;
  color: #2f4358;
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
}

.writeback-page__review-summary {
  margin-bottom: 14px;
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  padding: 10px 12px;
  background: #fff;
  color: #465767;
}

.writeback-page__review-summary strong,
.writeback-page__review-summary span {
  display: block;
}

.writeback-page__review-summary strong {
  color: #22313f;
  font-size: 14px;
}

.writeback-page__review-summary span,
.writeback-page__review-summary li {
  font-size: 12px;
  line-height: 1.5;
}

.writeback-page__review-summary ul {
  margin: 6px 0 0;
  padding-left: 18px;
}

.writeback-page__handoff,
.writeback-page__manual-preview {
  display: grid;
  gap: 10px;
  margin-bottom: 14px;
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  padding: 12px;
  background: #fff;
  color: #465767;
}

.writeback-page__manual-preview {
  background: #fbfcfe;
}

.writeback-page__handoff > div:first-child strong,
.writeback-page__handoff > div:first-child span,
.writeback-page__manual-preview > div:first-child strong,
.writeback-page__manual-preview > div:first-child span {
  display: block;
}

.writeback-page__handoff > div:first-child strong,
.writeback-page__manual-preview > div:first-child strong {
  color: #22313f;
  font-size: 14px;
}

.writeback-page__handoff > div:first-child span,
.writeback-page__handoff-grid span,
.writeback-page__manual-preview > div:first-child span {
  font-size: 12px;
  line-height: 1.5;
}

.writeback-page__handoff-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 8px;
}

.writeback-page__manual-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 8px;
}

.writeback-page__manual-preview-grid article {
  display: grid;
  gap: 6px;
  border: 1px solid #e1e8ef;
  border-radius: 6px;
  padding: 9px;
  background: #fff;
  color: #465767;
  font-size: 12px;
  line-height: 1.45;
}

.writeback-page__manual-preview-grid header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.writeback-page__manual-preview-grid strong {
  min-width: 0;
  color: #22313f;
  overflow-wrap: anywhere;
}

.writeback-page__manual-preview-grid details {
  min-width: 0;
}

.writeback-page__manual-preview-grid summary {
  cursor: pointer;
  color: #22313f;
  font-weight: 700;
}

.writeback-page__manual-preview-grid pre {
  max-height: 220px;
  margin: 6px 0 0;
  overflow: auto;
  white-space: pre;
  color: #405468;
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.writeback-page__quality {
  flex: 0 0 auto;
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 12px;
  font-weight: 700;
}

.writeback-page__quality--pass {
  background: #e2f5e9;
  color: #1e7d43;
}

.writeback-page__quality--warning {
  background: #fff4d8;
  color: #8a5a00;
}

.writeback-page__quality--blocker {
  background: #fdecea;
  color: #a93226;
}

.writeback-page__handoff-batches {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
}

.writeback-page__handoff-batches article {
  display: grid;
  gap: 3px;
  border: 1px solid #d8e6e0;
  border-radius: 6px;
  padding: 8px;
  background: #f6fbf7;
}

.writeback-page__handoff-batches strong {
  color: #22313f;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.writeback-page__handoff-batches span {
  color: #536273;
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.writeback-page__handoff-grid article {
  display: grid;
  gap: 3px;
  border: 1px solid #e4eaf0;
  border-radius: 6px;
  padding: 8px;
  background: #f8fbfd;
}

.writeback-page__handoff-grid strong {
  color: #22313f;
  font-size: 13px;
}

.writeback-page__export-preflight {
  display: grid;
  gap: 10px;
  margin-bottom: 14px;
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  padding: 12px;
  background: #f8fbfd;
}

.writeback-page__export-preflight > div:first-child strong,
.writeback-page__export-preflight > div:first-child span {
  display: block;
}

.writeback-page__export-preflight > div:first-child strong {
  color: #22313f;
  font-size: 14px;
}

.writeback-page__export-preflight > div:first-child span {
  color: #465767;
  font-size: 12px;
  line-height: 1.5;
}

.writeback-page__export-preflight-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
}

.writeback-page__export-preflight-grid article {
  display: grid;
  gap: 4px;
  border: 1px solid #e4ebf1;
  border-radius: 6px;
  padding: 8px;
  background: #fff;
  color: #465767;
  font-size: 12px;
  line-height: 1.45;
}

.writeback-page__export-preflight-grid strong {
  color: #22313f;
  overflow-wrap: anywhere;
}

.writeback-page__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.writeback-page__summary div,
.writeback-page__item {
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  background: #fff;
}

.writeback-page__summary div {
  padding: 12px;
}

.writeback-page__summary span {
  display: block;
  margin-bottom: 4px;
  color: #66727f;
  font-size: 13px;
}

.writeback-page__summary strong {
  color: #22313f;
  font-size: 22px;
}

.writeback-page__list {
  display: grid;
  gap: 12px;
}

.writeback-page__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 16px;
  padding: 16px;
}

.writeback-page__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.writeback-page__select-row {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  width: fit-content;
  color: #465767;
  font-size: 13px;
}

.writeback-page__badges span {
  padding: 3px 7px;
  border-radius: 4px;
  background: #eef3f7;
  color: #465767;
  font-size: 12px;
}

.writeback-page__status--draft_ready {
  background: #e9f2ff !important;
  color: #24527a !important;
}

.writeback-page__status--queued {
  background: #f0f2ff !important;
  color: #3a56a0 !important;
}

.writeback-page__status--written_back {
  background: #e2f5e9 !important;
  color: #1e7d43 !important;
}

.writeback-page__status--needs_revision {
  background: #fdecea !important;
  color: #a93226 !important;
}

.writeback-page__main h2 {
  margin: 8px 0 6px;
  color: #22313f;
  font-size: 18px;
}

.writeback-page__main p {
  margin: 0 0 8px;
  color: #465767;
  line-height: 1.6;
}

.writeback-page__note {
  padding: 8px 10px;
  border-radius: 6px;
  background: #fffaf0;
}

.writeback-page__preflight-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 6px;
  margin: 8px 0;
  border: 1px solid #e4ebf1;
  border-radius: 6px;
  padding: 8px;
  background: #f8fbfd;
  color: #465767;
  font-size: 12px;
  line-height: 1.45;
}

.writeback-page__field-preview {
  margin: 8px 0;
  border: 1px solid #e4ebf1;
  border-radius: 6px;
  padding: 8px 10px;
  background: #fff;
  color: #465767;
  font-size: 13px;
}

.writeback-page__field-preview summary {
  cursor: pointer;
  color: #22313f;
  font-weight: 700;
}

.writeback-page__field-preview div {
  margin-top: 8px;
  border-top: 1px solid #edf1f5;
  padding-top: 8px;
}

.writeback-page__field-preview p {
  margin: 4px 0;
}

.writeback-page__field-preview small {
  display: block;
  overflow-wrap: anywhere;
  color: #66727f;
  line-height: 1.45;
}

.writeback-page__main pre {
  max-height: 260px;
  margin: 8px 0 0;
  overflow: auto;
  white-space: pre-wrap;
  color: #4c5e6f;
  font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.writeback-page__side {
  display: grid;
  align-content: start;
  gap: 8px;
  color: #66727f;
  font-size: 13px;
}

.writeback-page__side strong {
  color: #22313f;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.writeback-page__side a {
  justify-self: start;
  padding: 7px 10px;
}

.writeback-page__side textarea {
  min-height: 72px;
  padding: 9px 10px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  resize: vertical;
  color: #2f4358;
  font: inherit;
  font-size: 14px;
  line-height: 1.5;
}

.writeback-page__status-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.writeback-page__status-actions button {
  border: 1px solid #c7d3dd;
  border-radius: 4px;
  padding: 7px 8px;
  background: #fff;
  color: #33475b;
  cursor: pointer;
  font-size: 13px;
}

.writeback-page__state,
.writeback-page__error {
  padding: 24px;
  border-radius: 6px;
  background: #fff;
  color: #66727f;
  text-align: center;
}

.writeback-page__error {
  background: #fdecea;
  color: #c0392b;
}

@media (max-width: 760px) {
  .writeback-page__header,
  .writeback-page__toolbar,
  .writeback-page__bulk,
  .writeback-page__item {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .writeback-page__back,
  .writeback-page__search,
  .writeback-page__select {
    width: 100%;
  }
}
</style>
