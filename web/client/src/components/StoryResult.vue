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
      <p v-if="result.effective_engine" class="story-result__meta">
        请求模型：{{ result.requested_model_profile_id ?? '未指定（安全默认本地）' }}
        · 实际引擎：{{ effectiveEngineLabel }}
        · 外部模型调用：{{ result.external_model_call_performed ? '是' : '否' }}
        <span v-if="result.generation_reason"> · 原因：{{ result.generation_reason }}</span>
      </p>
      <GearsWebhookStatus v-if="showGearsWebhookStatus" :status="result.gears_webhook" />
      <GearsVideoStatus v-if="showGearsVideoStatus" :video="result.gears_video" />
    </header>

    <section v-if="result.reference_generation_recipe" class="story-result__section">
      <h3 class="story-result__section-title">创作配方 Provenance</h3>
      <div class="story-result__contract">
        <div class="story-result__contract-summary">
          <article>
            <span>配方</span>
            <strong>{{ referenceRecipeLabel }}</strong>
          </article>
          <article>
            <span>版本</span>
            <strong>{{ result.reference_generation_recipe.recipe_version }}</strong>
          </article>
          <article>
            <span>Payload SHA-256</span>
            <strong>{{ result.reference_generation_recipe.payload_sha256.slice(0, 12) }}…</strong>
          </article>
        </div>
        <div class="story-result__field-list">
          <strong>使用的抽象机制</strong>
          <ul>
            <li
              v-for="mechanism in result.reference_generation_recipe.reusable_mechanisms"
              :key="mechanism"
            >
              {{ mechanism }}
            </li>
          </ul>
        </div>
        <div class="story-result__field-list">
          <strong>明确禁止复制</strong>
          <ul>
            <li
              v-for="boundary in result.reference_generation_recipe.avoid_copying"
              :key="boundary"
            >
              {{ boundary }}
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section v-if="result.reference_safety_report" class="story-result__section">
      <h3 class="story-result__section-title">Reference 安全与 Baseline 对照</h3>
      <div class="story-result__reference-audit">
        <div class="story-result__reference-summary">
          <article>
            <span>引用安全</span>
            <strong>{{ result.reference_safety_report.status }}</strong>
          </article>
          <article>
            <span>应用到生成</span>
            <strong>{{ result.reference_safety_report.application.applied_to_generation ? '是' : '否' }}</strong>
          </article>
          <article>
            <span>Style Packs</span>
            <strong>{{ result.reference_safety_report.style_pack_ids.length }}</strong>
          </article>
          <article>
            <span>真实信用</span>
            <strong>未授予</strong>
          </article>
        </div>

        <div
          v-if="baselineComparison?.status === 'completed' && baselineComparison.quality_delta"
          class="story-result__baseline-comparison"
        >
          <div class="story-result__baseline-score">
            <article>
              <span>Baseline 机器分</span>
              <strong>{{ formatReferenceScore(baselineComparison.quality_delta.baseline_machine_score) }}</strong>
            </article>
            <article>
              <span>Assisted 机器分</span>
              <strong>{{ formatReferenceScore(baselineComparison.quality_delta.reference_assisted_machine_score) }}</strong>
            </article>
            <article>
              <span>Aggregate Delta</span>
              <strong :class="referenceDeltaClass(baselineComparison.quality_delta.aggregate_delta)">
                {{ formatReferenceDelta(baselineComparison.quality_delta.aggregate_delta) }}
              </strong>
            </article>
          </div>
          <p>
            {{ baselineComparison.baseline_story_id }}
            → {{ baselineComparison.reference_assisted_story_id }}
          </p>
          <dl>
            <div
              v-for="dimension in baselineComparison.quality_delta.dimensions"
              :key="dimension.dimension"
            >
              <dt>{{ referenceDimensionLabel(dimension.dimension) }}</dt>
              <dd>
                {{ formatReferenceScore(dimension.baseline_score) }}
                → {{ formatReferenceScore(dimension.reference_assisted_score) }}
                · {{ formatReferenceDelta(dimension.delta) }}
              </dd>
            </div>
          </dl>
          <p class="story-result__reference-boundary">
            same_input_verified = true · machine_comparison_only = true ·
            comparison_credit_granted = false
          </p>
        </div>
        <p v-else class="story-result__reference-boundary">
          Baseline comparison 未运行；单次机器生成不会自动获得对照或人工信用。
        </p>
      </div>
    </section>

    <section v-if="result.creation_contract || result.material_sufficiency" class="story-result__section">
      <h3 class="story-result__section-title">创作合同与素材 gate</h3>
      <div class="story-result__contract">
        <div v-if="result.creation_contract" class="story-result__contract-summary">
          <article>
            <span>创作用途</span>
            <strong>{{ creationUseCaseLabel(result.creation_contract.creation_use_case) }}</strong>
          </article>
          <article>
            <span>真实模式</span>
            <strong>{{ truthModeLabel(result.creation_contract.truth_mode) }}</strong>
          </article>
          <article v-if="result.creation_contract.client_type">
            <span>客户/机构</span>
            <strong>{{ result.creation_contract.client_type }}</strong>
          </article>
          <article v-if="result.creation_contract.target_audience">
            <span>目标受众</span>
            <strong>{{ result.creation_contract.target_audience }}</strong>
          </article>
        </div>
        <p v-if="result.creation_contract?.communication_goal" class="story-result__contract-goal">
          {{ result.creation_contract.communication_goal }}
        </p>
        <div v-if="result.material_sufficiency" class="story-result__sufficiency">
          <div class="story-result__sufficiency-head">
            <article>
              <span>输入目标</span>
              <strong>{{ sufficiencyStageLabel(result.material_sufficiency.stage) }}</strong>
            </article>
            <article>
              <span>输入可推进</span>
              <strong>{{ result.material_sufficiency.active_stage ? sufficiencyStageLabel(result.material_sufficiency.active_stage) : '未记录' }}</strong>
            </article>
            <article>
              <span>输入素材</span>
              <strong>{{ result.material_sufficiency.score }}/100</strong>
            </article>
            <article>
              <span>初始姿态</span>
              <strong>{{ generationPostureLabel(result.material_sufficiency.generation_posture) }}</strong>
            </article>
            <article v-if="result.production_material_readiness">
              <span>生产素材</span>
              <strong>
                {{ productionMaterialStatusLabel(result.production_material_readiness.status) }}
                · {{ result.production_material_readiness.score }}/100
              </strong>
            </article>
          </div>
          <p v-if="result.material_sufficiency.needs_verification" class="story-result__sufficiency-note">
            当前素材允许先生成草案，但事实、数据、机构口径或原作边界需要继续核验。
          </p>
          <div v-if="result.material_sufficiency.stage_reports?.length" class="story-result__stage-grid">
            <article
              v-for="stage in result.material_sufficiency.stage_reports"
              :key="stage.stage"
              class="story-result__stage-card"
              :class="`story-result__stage-card--${stage.status}`"
            >
              <div class="story-result__stage-card-head">
                <strong>{{ sufficiencyStageLabel(stage.stage) }}</strong>
                <span>{{ stageStatusLabel(stage.status) }} · {{ stage.score }}/100</span>
              </div>
              <p>{{ stage.available_outputs.length ? stage.available_outputs.join('、') : '需补素材后推进' }}</p>
              <ul v-if="stage.missing_items.length">
                <li v-for="item in stage.missing_items.slice(0, 3)" :key="item.item_id">
                  {{ item.label }}：{{ item.reason }}
                </li>
              </ul>
            </article>
          </div>
          <div v-if="result.material_sufficiency.recommended_next_questions.length" class="story-result__field-list">
            <strong>建议补充</strong>
            <ul>
              <li v-for="question in result.material_sufficiency.recommended_next_questions.slice(0, 5)" :key="question">
                {{ question }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

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

    <section v-if="result.material_pack" class="story-result__section">
      <h3 class="story-result__section-title">项目素材包</h3>
      <div class="story-result__material-summary">
        <article>
          <span>主素材</span>
          <strong>{{ result.material_pack.primary_materials.length }}</strong>
        </article>
        <article>
          <span>支撑素材</span>
          <strong>{{ result.material_pack.supporting_materials.length }}</strong>
        </article>
        <article>
          <span>参考素材</span>
          <strong>{{ result.material_pack.reference_materials.length }}</strong>
        </article>
        <article>
          <span>缺口</span>
          <strong>{{ result.material_pack.missing_needs.length }}</strong>
        </article>
      </div>
      <div
        v-for="group in materialGroups"
        :key="group.key"
        class="story-result__source-group"
      >
        <h4 v-if="group.items.length > 0" class="story-result__source-label">{{ group.label }}</h4>
        <div v-for="material in group.items" :key="material.material_id" class="story-result__material-item">
          <strong>{{ material.title }}</strong>
          <p>{{ material.summary }}</p>
          <div class="story-result__tag-row">
            <span class="story-result__source-tag">{{ materialSourceTypeLabel(material.source_type) }}</span>
            <span v-for="purpose in material.purpose" :key="purpose" class="story-result__source-tag">
              {{ materialPurposeLabel(purpose) }}
            </span>
            <span v-if="typeof material.confidence === 'number'" class="story-result__source-score">
              {{ (material.confidence * 100).toFixed(0) }}%
            </span>
          </div>
        </div>
      </div>
      <div v-if="result.material_pack.verified_facts.length > 0" class="story-result__field-list">
        <strong>已确认事实/素材说明</strong>
        <ul>
          <li v-for="fact in result.material_pack.verified_facts.slice(0, 6)" :key="fact">{{ fact }}</li>
        </ul>
      </div>
    </section>

    <!-- Knowledge source (compatibility) -->
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

    <section v-if="result.adaptation_analysis" class="story-result__section">
      <h3 class="story-result__section-title">原作改编分析</h3>
      <div class="story-result__adaptation">
        <p><strong>原作概括:</strong> {{ result.adaptation_analysis.source_summary }}</p>
        <p><strong>原作长度:</strong> {{ result.adaptation_analysis.source_length }} 字</p>
        <div v-if="result.adaptation_analysis.core_characters.length > 0" class="story-result__field-list">
          <strong>核心人物/称谓</strong>
          <div class="story-result__tag-row">
            <span v-for="item in result.adaptation_analysis.core_characters" :key="item" class="story-result__source-tag">{{ item }}</span>
          </div>
        </div>
        <div v-if="result.adaptation_analysis.plot_beats.length > 0" class="story-result__field-list">
          <strong>原作主线节拍</strong>
          <ol>
            <li v-for="item in result.adaptation_analysis.plot_beats" :key="item">{{ item }}</li>
          </ol>
        </div>
        <div v-if="result.adaptation_analysis.must_keep.length > 0" class="story-result__field-list">
          <strong>必须保留</strong>
          <ul>
            <li v-for="item in result.adaptation_analysis.must_keep" :key="item">{{ item }}</li>
          </ul>
        </div>
        <div v-if="result.adaptation_analysis.visual_setpieces.length > 0" class="story-result__field-list">
          <strong>优先转成镜头的场面</strong>
          <ul>
            <li v-for="item in result.adaptation_analysis.visual_setpieces" :key="item">{{ item }}</li>
          </ul>
        </div>
        <div v-if="result.adaptation_analysis.compressible_parts.length > 0" class="story-result__field-list">
          <strong>可压缩/合并</strong>
          <ul>
            <li v-for="item in result.adaptation_analysis.compressible_parts" :key="item">{{ item }}</li>
          </ul>
        </div>
        <div v-if="result.adaptation_analysis.adaptation_risks.length > 0" class="story-result__field-list story-result__field-list--warning">
          <strong>改编风险</strong>
          <ul>
            <li v-for="item in result.adaptation_analysis.adaptation_risks" :key="item">{{ item }}</li>
          </ul>
        </div>
      </div>
    </section>

    <section v-if="result.supplement_tasks && result.supplement_tasks.length > 0" class="story-result__section">
      <h3 class="story-result__section-title">素材补充任务</h3>
      <div class="story-result__supplement-list">
        <div v-for="task in result.supplement_tasks" :key="task.task_id" class="story-result__supplement-task">
          <span class="story-result__supplement-status">{{ task.status === 'open' ? '待补' : '已完成' }}</span>
          <div>
            <strong>{{ task.label }}</strong>
            <div v-if="task.stage || task.blocking_level || task.affects?.length" class="story-result__supplement-meta">
              <span v-if="task.stage">{{ sufficiencyStageLabel(task.stage) }}</span>
              <span v-if="task.blocking_level">{{ supplementBlockingLabel(task.blocking_level) }}</span>
              <span v-if="task.affects?.length">影响：{{ task.affects.join('、') }}</span>
            </div>
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
              placeholder="记录本次补充的事实、来源、可用于故事、剧本或画面的细节。"
              @input="updateSupplementDraft(task.task_id, $event)"
            />
            <p v-else-if="task.supplement_note" class="story-result__supplement-note">
              <strong>素材补充说明：</strong>{{ task.supplement_note }}
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

    <!-- Story publication and production readiness are independent gates. -->
    <section v-if="result.quality_report" class="story-result__section">
      <h3 class="story-result__section-title">故事发布与生产状态</h3>
      <div :class="['story-result__quality', storyPublishable ? 'story-result__quality--pass' : 'story-result__quality--fail']">
        <div class="story-result__quality-summary">
          <article>
            <span>故事发布</span>
            <strong>{{ storyPublishable ? '可发布' : '需修订' }}</strong>
          </article>
          <article>
            <span>生产交付</span>
            <strong>{{ productionReadinessLabel }}</strong>
          </article>
          <article>
            <span>类型匹配度</span>
            <strong>{{ typeof result.quality_report.genre_score === 'number' ? `${result.quality_report.genre_score}/100` : '未记录' }}</strong>
          </article>
          <article>
            <span>故事 / 生产阻断</span>
            <strong>{{ storyGateIssues.length }} / {{ productionGateIssues.length }}</strong>
          </article>
        </div>
        <div v-if="qualityGateItems.length > 0" class="story-result__gate-grid">
          <article
            v-for="gate in qualityGateItems"
            :key="gate.gate_id"
            :class="['story-result__gate-card', `story-result__gate-card--${gate.status}`]"
          >
            <span>{{ qualityGateLabel(gate.gate_id) }}</span>
            <strong>{{ qualityGateStatusLabel(gate.status) }}</strong>
            <small>{{ gate.summary }}</small>
          </article>
        </div>
        <div v-if="storyGateIssues.length > 0" class="story-result__quality-actions story-result__quality-actions--story">
          <strong>故事发布阻断</strong>
          <ul>
            <li v-for="issue in storyGateIssues" :key="issue">{{ issue }}</li>
          </ul>
        </div>
        <div v-if="productionGateIssues.length > 0" class="story-result__quality-actions story-result__quality-actions--production">
          <strong>生产就绪缺口（不影响故事本身判定）</strong>
          <ul>
            <li v-for="issue in productionGateIssues" :key="issue">{{ issue }}</li>
          </ul>
        </div>
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
        <div v-if="result.quality_report.repair_preview" class="story-result__quality-preview">
          {{ result.quality_report.repair_preview }}
        </div>
      </div>
    </section>

    <section
      v-if="result.quality_report?.family_quality_report || result.quality_report?.outline_coverage_report || result.quality_report?.pattern_quality_report || result.quality_report?.gears_readiness_report || result.quality_report?.production_material_readiness_report || result.quality_report?.audience_text_report || result.quality_report?.human_review_alignment"
      class="story-result__section"
    >
      <h3 class="story-result__section-title">可修复质量报告</h3>
      <div class="story-result__report-grid">
        <article v-if="result.quality_report.family_quality_report" class="story-result__report-card">
          <span>片型家族</span>
          <strong>{{ result.quality_report.family_quality_report.passed ? '通过' : '需修订' }}</strong>
          <p>{{ result.quality_report.family_quality_report.family_label }}</p>
          <ul v-if="result.quality_report.family_quality_report.blocking_check_ids.length > 0">
            <li
              v-for="check in result.quality_report.family_quality_report.checks.filter(item => item.status === 'failed').slice(0, 4)"
              :key="check.check_id"
            >
              {{ check.label }}：{{ check.summary }}
            </li>
          </ul>
        </article>

        <article v-if="result.quality_report.outline_coverage_report" class="story-result__report-card">
          <span>Outline Coverage</span>
          <strong>{{ result.quality_report.outline_coverage_report.coverage_score }}/100</strong>
          <p>{{ result.quality_report.outline_coverage_report.preview }}</p>
          <ul v-if="result.quality_report.outline_coverage_report.nodes.some(node => node.status !== 'covered')">
            <li
              v-for="node in result.quality_report.outline_coverage_report.nodes.filter(item => item.status !== 'covered').slice(0, 4)"
              :key="node.node_id"
            >
              {{ node.order }}. {{ node.repair_hint }}
            </li>
          </ul>
        </article>

        <article v-if="result.quality_report.pattern_quality_report" class="story-result__report-card">
          <span>Pattern Quality</span>
          <strong>{{ result.quality_report.pattern_quality_report.pattern_score }}/100</strong>
          <p>{{ result.quality_report.pattern_quality_report.preview }}</p>
          <ul v-if="result.quality_report.pattern_quality_report.weak_signals.length > 0">
            <li
              v-for="signal in result.quality_report.pattern_quality_report.weak_signals.slice(0, 4)"
              :key="signal.signal_id"
            >
              {{ signal.label }}：{{ signal.repair_hint }}
              <small v-if="signal.evidence_scene_ids?.length">
                证据场景：{{ signal.evidence_scene_ids.join('、') }}；置信度 {{ Math.round(signal.confidence * 100) }}%
              </small>
              <small v-else-if="signal.counter_evidence?.length">
                {{ signal.counter_evidence[0] }}；置信度 {{ Math.round(signal.confidence * 100) }}%
              </small>
            </li>
          </ul>
        </article>

        <article v-if="result.quality_report.gears_readiness_report" class="story-result__report-card">
          <span>GEARS Readiness</span>
          <strong>{{ result.quality_report.gears_readiness_report.readiness_score }}/100</strong>
          <p>{{ result.quality_report.gears_readiness_report.preview }}</p>
          <ul v-if="result.quality_report.gears_readiness_report.issue_items.length > 0">
            <li
              v-for="item in result.quality_report.gears_readiness_report.issue_items.slice(0, 4)"
              :key="item"
            >
              {{ item }}
            </li>
          </ul>
        </article>

        <article v-if="result.quality_report.production_material_readiness_report" class="story-result__report-card">
          <span>Production Material</span>
          <strong>{{ result.quality_report.production_material_readiness_report.score }}/100</strong>
          <p>
            {{ productionMaterialStatusLabel(result.quality_report.production_material_readiness_report.status) }}
            · {{ result.quality_report.production_material_readiness_report.preview }}
          </p>
          <ul
            v-if="result.quality_report.production_material_readiness_report.missing_blocking_fields.length > 0 || result.quality_report.production_material_readiness_report.missing_risk_fields.length > 0"
          >
            <li
              v-for="item in [
                ...result.quality_report.production_material_readiness_report.missing_blocking_fields,
                ...result.quality_report.production_material_readiness_report.missing_risk_fields,
              ].slice(0, 4)"
              :key="item.field_id"
            >
              {{ item.label }}：{{ item.reason }}
            </li>
          </ul>
        </article>

        <article v-if="result.quality_report.audience_text_report" class="story-result__report-card">
          <span>Audience Text</span>
          <strong>{{ result.quality_report.audience_text_report.clean ? 100 : Math.max(0, 100 - result.quality_report.audience_text_report.issue_count * 12) }}/100</strong>
          <p>{{ result.quality_report.audience_text_report.preview }}</p>
          <ul v-if="result.quality_report.audience_text_report.issue_items.length > 0">
            <li
              v-for="item in result.quality_report.audience_text_report.issue_items.slice(0, 4)"
              :key="item.issue_id"
            >
              {{ item.label }}：{{ item.matched_terms.join('、') }}
            </li>
          </ul>
        </article>
      </div>

      <div v-if="result.quality_report.repair_action_items?.length" class="story-result__quality-actions">
        <strong>一键修复动作</strong>
        <ul>
          <li v-for="action in result.quality_report.repair_action_items" :key="action.action_id">
            {{ action.label }}：{{ action.expected_effect }}
          </li>
        </ul>
      </div>

      <div v-if="result.quality_report.human_review_alignment" class="story-result__human-review">
        <header>
          <div>
            <span>HUMAN REVIEW ALIGNMENT</span>
            <strong>三角色真人评审表 · {{ result.quality_report.human_review_alignment.family_label }}</strong>
          </div>
          <b>待真人评审</b>
        </header>
        <p class="story-result__human-review-boundary">
          {{ result.quality_report.human_review_alignment.credit_boundary }}
        </p>
        <div class="story-result__human-review-grid">
          <article
            v-for="section in result.quality_report.human_review_alignment.sections"
            :key="section.role"
          >
            <h4>{{ section.role_label }}</h4>
            <p>真人结论：未评审 · 真人信用：0</p>
            <ul>
              <li
                v-for="criterion in section.criteria"
                :key="criterion.criterion_id"
                :class="`story-result__human-review-item--${criterion.machine_status}`"
              >
                <div>
                  <strong>{{ criterion.dimension_label }}</strong>
                  <span>权重 {{ criterion.weight }}%</span>
                </div>
                <small>{{ machineReviewStatusLabel(criterion.machine_status) }} · 真人分数 —</small>
                <small v-if="criterion.machine_counter_evidence.length > 0">
                  待核：{{ criterion.machine_counter_evidence[0] }}
                </small>
                <small v-else-if="criterion.machine_evidence.length > 0">
                  机器证据：{{ criterion.machine_evidence[0] }}
                </small>
                <small v-if="criterion.evidence_scene_ids.length > 0">
                  场景 {{ criterion.evidence_scene_ids.join('、') }}
                </small>
              </li>
            </ul>
          </article>
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
  CreationUseCase,
  TruthMode,
  MaterialSufficiencyStage,
  MaterialSufficiencyStageStatus,
  MaterialGenerationPosture,
  MaterialBlockingLevel,
  MaterialPurpose,
  MaterialSourceType,
  StoryQualityGateId,
  StoryQualityGateStatus,
  StoryMachineReviewStatus,
  StoryReferenceBaselineQualityDimension,
} from '@shared/types'
import { VIDEO_TYPE_CONFIG, PRESENTATION_STYLE_CONFIG } from '@shared/types'
import { REFERENCE_GENERATION_RECIPES } from '@shared/reference-generation-recipes'
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

const CREATION_USE_CASE_LABELS: Record<CreationUseCase, string> = {
  original_ai_comic: '单片原创 AI 漫剧',
  adapted_ai_comic: '单片资料改编',
  institutional_promo: '机构宣传片',
  documentary_short: '纪录短片',
  brand_commercial: '品牌商业片',
  education_training: '教育/培训片',
  public_service: '公益宣传片',
}

const TRUTH_MODE_LABELS: Record<TruthMode, string> = {
  fictional_original: '原创虚构',
  inspired_by_material: '素材启发',
  source_adaptation: '原作改编',
  factual_reconstruction: '事实重构',
  institutional_verified: '机构审定',
}

const SUFFICIENCY_STAGE_LABELS: Record<MaterialSufficiencyStage, string> = {
  minimum_viable_story: '最小可行故事',
  script_ready: '剧本可用',
  production_ready: '生产可用',
}

const STAGE_STATUS_LABELS: Record<MaterialSufficiencyStageStatus, string> = {
  ready: '已就绪',
  needs_input: '需补充',
  blocked: '阻断',
}

const GENERATION_POSTURE_LABELS: Record<MaterialGenerationPosture, string> = {
  ready: '可进入生产',
  draft_needs_verification: '草案待核验',
  script_ready_production_pending: '剧本可写，生产待补',
  blocked_until_input: '补材后再生成',
}

const MATERIAL_SOURCE_TYPE_LABELS: Record<MaterialSourceType, string> = {
  knowledge_entry: '来源条目',
  user_outline: '用户大纲',
  user_source_text: '用户原文',
  brand_profile: '品牌资料',
  institution_profile: '机构资料',
  visual_asset: '视觉资产',
  reference_style: '参考风格',
  manual_note: '人工补充',
}

const MATERIAL_PURPOSE_LABELS: Record<MaterialPurpose, string> = {
  fact_basis: '事实依据',
  character_source: '角色来源',
  visual_asset: '视觉资产',
  era_context: '时代背景',
  regional_context: '地域语境',
  cultural_background: '文化背景',
  brand_info: '品牌信息',
  institutional_position: '机构口径',
  source_work: '原作材料',
  reference_style: '参考风格',
  creative_boundary: '创作边界',
}

function knowledgeDomainLabel(domain: KnowledgeDomain) {
  return KNOWLEDGE_DOMAIN_LABELS[domain] ?? domain
}

function assetUsageLabel(usage: KnowledgeAssetUsage) {
  return ASSET_USAGE_LABELS[usage] ?? usage
}

function materialSourceTypeLabel(sourceType: MaterialSourceType) {
  return MATERIAL_SOURCE_TYPE_LABELS[sourceType] ?? sourceType
}

function materialPurposeLabel(purpose: MaterialPurpose) {
  return MATERIAL_PURPOSE_LABELS[purpose] ?? purpose
}

function creationUseCaseLabel(useCase: CreationUseCase) {
  return CREATION_USE_CASE_LABELS[useCase] ?? useCase
}

function truthModeLabel(truthMode: TruthMode) {
  return TRUTH_MODE_LABELS[truthMode] ?? truthMode
}

function sufficiencyStageLabel(stage: MaterialSufficiencyStage) {
  return SUFFICIENCY_STAGE_LABELS[stage] ?? stage
}

function stageStatusLabel(status: MaterialSufficiencyStageStatus) {
  return STAGE_STATUS_LABELS[status] ?? status
}

function generationPostureLabel(posture?: MaterialGenerationPosture) {
  return posture ? GENERATION_POSTURE_LABELS[posture] ?? posture : '未记录'
}

function productionMaterialStatusLabel(status: string) {
  if (status === 'ready') return '可生产'
  if (status === 'blocked') return '阻断'
  return '待补素材'
}

function machineReviewStatusLabel(status: StoryMachineReviewStatus) {
  if (status === 'supporting_evidence') return '机器证据可供核验'
  if (status === 'attention_required') return '机器标记待重点核验'
  return '机器未评估'
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

const effectiveEngineLabel = computed(() => {
  if (props.result?.effective_engine === 'external_model') return '外部模型 adapter'
  if (props.result?.effective_engine === 'local_fallback') return '本地回退引擎'
  return '本地故事引擎'
})

const referenceRecipeLabel = computed(() => {
  const recipeId = props.result?.reference_generation_recipe?.recipe_id
  if (!recipeId) return ''
  return REFERENCE_GENERATION_RECIPES.find(recipe => recipe.id === recipeId)?.label
    ?? recipeId
})

const baselineComparison = computed(() => (
  props.result?.reference_safety_report?.baseline_comparison ?? null
))

function formatReferenceScore(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2)
}

function formatReferenceDelta(value: number): string {
  return `${value > 0 ? '+' : ''}${formatReferenceScore(value)}`
}

function referenceDeltaClass(value: number): string {
  if (value > 0) return 'story-result__reference-positive'
  if (value < 0) return 'story-result__reference-negative'
  return ''
}

function referenceDimensionLabel(
  dimension: StoryReferenceBaselineQualityDimension['dimension'],
): string {
  return {
    core_story_checks: '核心故事检查',
    genre_score: '类型质量',
    pattern_score: '叙事模式',
    outline_coverage: '大纲覆盖',
    family_quality_checks: '类型族检查',
    story_publishable: '故事可发布',
  }[dimension]
}

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

const materialGroups = computed(() => {
  const pack = props.result?.material_pack
  if (!pack) return []
  return [
    { key: 'primary', label: '主素材', items: pack.primary_materials },
    { key: 'supporting', label: '支撑素材', items: pack.supporting_materials },
    { key: 'reference', label: '参考素材', items: pack.reference_materials },
  ].filter(group => group.items.length > 0)
})

const qualityGates = computed(() => props.result?.quality_report?.quality_gates ?? null)

const storyPublishable = computed(() => (
  qualityGates.value?.story_publishable
    ?? props.result?.quality_report?.passed
    ?? false
))

const productionReadinessLabel = computed(() => {
  if (!qualityGates.value) return '未评估'
  return qualityGates.value.production_ready ? '可交付' : '未就绪'
})

const qualityGateItems = computed(() => {
  const gates = qualityGates.value
  if (!gates) return []
  return [
    gates.narrative_gate,
    gates.factual_cultural_gate,
    gates.outline_gate,
    gates.audience_text_gate,
    gates.production_material_gate,
    gates.gears_contract_gate,
    gates.asset_gate,
    gates.external_provider_gate,
  ]
})

const storyGateIssues = computed(() => {
  const gates = qualityGates.value
  if (!gates) return props.result?.quality_report?.issues ?? []
  return uniqueQualityIssues([
    gates.narrative_gate,
    gates.factual_cultural_gate,
    gates.outline_gate,
    gates.audience_text_gate,
  ].flatMap(gate => gate.passed ? [] : gate.issues.length > 0 ? gate.issues : [gate.summary]))
})

const productionGateIssues = computed(() => {
  const gates = qualityGates.value
  if (!gates || gates.production_ready) return []
  return uniqueQualityIssues([
    gates.production_material_gate,
    gates.gears_contract_gate,
    gates.asset_gate,
    gates.external_provider_gate,
  ].flatMap(gate => gate.passed ? [] : gate.issues.length > 0 ? gate.issues : [gate.summary]))
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

function uniqueQualityIssues(items: string[]): string[] {
  return items.filter((item, index, all) => item && all.indexOf(item) === index)
}

function qualityGateLabel(gateId: StoryQualityGateId): string {
  const labels: Record<StoryQualityGateId, string> = {
    narrative_gate: '叙事',
    factual_cultural_gate: '事实文化',
    outline_gate: '大纲',
    audience_text_gate: '观众文本',
    production_material_gate: '生产素材',
    gears_contract_gate: 'GEARS 合同',
    asset_gate: '真实资产',
    external_provider_gate: '外部 Provider',
  }
  return labels[gateId]
}

function qualityGateStatusLabel(status: StoryQualityGateStatus): string {
  if (status === 'passed') return '通过'
  if (status === 'failed') return '阻断'
  return '待评估'
}

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

function supplementBlockingLabel(level: MaterialBlockingLevel): string {
  const map: Record<MaterialBlockingLevel, string> = {
    blocking: '当前阻断',
    risk: '需核验',
    optional: '生产前补充',
  }
  return map[level]
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

.story-result__reference-audit {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid #a8cdc2;
  border-radius: 7px;
  background: #f2f9f7;
}
.story-result__reference-summary,
.story-result__baseline-score {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 8px;
}
.story-result__reference-summary article,
.story-result__baseline-score article {
  padding: 8px 10px;
  border: 1px solid #d4e6e0;
  border-radius: 6px;
  background: #fff;
}
.story-result__reference-summary span,
.story-result__baseline-score span {
  display: block;
  margin-bottom: 3px;
  color: #69847b;
  font-size: 11px;
}
.story-result__reference-summary strong,
.story-result__baseline-score strong {
  color: #254d41;
  font-size: 15px;
}
.story-result__baseline-comparison > p {
  overflow-wrap: anywhere;
  color: #667a73;
  font: 11px/1.55 ui-monospace, monospace;
}
.story-result__baseline-comparison dl {
  display: grid;
  gap: 5px;
}
.story-result__baseline-comparison dl div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 5px;
  border-bottom: 1px solid #dce9e5;
}
.story-result__baseline-comparison dt,
.story-result__baseline-comparison dd {
  color: #4d655d;
  font-size: 12px;
}
.story-result__baseline-comparison dd {
  margin: 0;
  text-align: right;
}
.story-result__reference-boundary {
  margin: 0;
  color: #788a84;
  font-size: 11px;
  line-height: 1.55;
}
.story-result__reference-positive {
  color: #16845f !important;
}
.story-result__reference-negative {
  color: #c13d2f !important;
}

.story-result__contract {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid #d7dde2;
  border-radius: 6px;
  background: #f8fafb;
}
.story-result__contract-summary,
.story-result__sufficiency-head {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
}
.story-result__contract-summary article,
.story-result__sufficiency-head article {
  padding: 8px 10px;
  border: 1px solid #e2e7eb;
  border-radius: 6px;
  background: #fff;
}
.story-result__contract-summary span,
.story-result__sufficiency-head span {
  display: block;
  margin-bottom: 3px;
  color: #6b7884;
  font-size: 12px;
}
.story-result__contract-summary strong,
.story-result__sufficiency-head strong {
  color: #2c3e50;
  font-size: 14px;
}
.story-result__contract-goal,
.story-result__sufficiency-note {
  margin: 0;
  color: #34495e;
  font-size: 14px;
  line-height: 1.6;
}
.story-result__sufficiency {
  display: grid;
  gap: 10px;
}
.story-result__stage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}
.story-result__stage-card {
  padding: 10px;
  border: 1px solid #d7dde2;
  border-left-width: 4px;
  border-radius: 6px;
  background: #fff;
}
.story-result__stage-card--ready { border-left-color: #27ae60; }
.story-result__stage-card--needs_input { border-left-color: #f39c12; }
.story-result__stage-card--blocked { border-left-color: #c0392b; }
.story-result__stage-card-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: baseline;
}
.story-result__stage-card-head strong {
  color: #2c3e50;
  font-size: 14px;
}
.story-result__stage-card-head span {
  color: #6b7884;
  font-size: 12px;
}
.story-result__stage-card p {
  margin: 8px 0 0;
  color: #34495e;
  font-size: 13px;
  line-height: 1.5;
}
.story-result__stage-card ul {
  margin: 8px 0 0;
  padding-left: 18px;
}
.story-result__stage-card li {
  margin-bottom: 4px;
  color: #6b4b16;
  font-size: 13px;
  line-height: 1.45;
}

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
.story-result__field-list--warning {
  border-color: #f1c40f;
  background: #fffaf0;
}
.story-result__adaptation {
  display: grid;
  gap: 8px;
}
.story-result__adaptation p {
  margin: 0;
  color: #34495e;
  font-size: 14px;
  line-height: 1.6;
}
.story-result__tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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
.story-result__material-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}
.story-result__material-summary article {
  padding: 8px 10px;
  border: 1px solid #d7dde2;
  border-radius: 6px;
  background: #f8fafb;
}
.story-result__material-summary span {
  display: block;
  color: #6b7884;
  font-size: 12px;
}
.story-result__material-summary strong {
  display: block;
  margin-top: 3px;
  color: #2c3e50;
  font-size: 18px;
}
.story-result__material-item {
  padding: 8px 10px;
  border: 1px solid #e2e8ee;
  border-radius: 6px;
  background: #fff;
  margin-bottom: 6px;
}
.story-result__material-item p {
  margin: 4px 0 6px;
  color: #465767;
  font-size: 13px;
  line-height: 1.45;
}
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
.story-result__gate-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}
.story-result__gate-card {
  display: grid;
  gap: 3px;
  padding: 8px 10px;
  border: 1px solid #d7dde2;
  border-left-width: 4px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.72);
}
.story-result__gate-card--passed { border-left-color: #27ae60; }
.story-result__gate-card--failed { border-left-color: #c0392b; }
.story-result__gate-card--not_evaluated { border-left-color: #95a5a6; }
.story-result__gate-card span,
.story-result__gate-card small {
  color: #65737e;
  font-size: 12px;
}
.story-result__gate-card strong {
  color: #2c3e50;
  font-size: 14px;
}
.story-result__gate-card small { line-height: 1.35; }
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
.story-result__quality-actions--story { color: #9f2f25; }
.story-result__quality-actions--production { color: #8a5a00; }
.story-result__quality-preview {
  margin-top: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.62);
  border-radius: 6px;
  color: #2c3e50;
  font-size: 14px;
  line-height: 1.55;
}
.story-result__report-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.story-result__report-card {
  padding: 14px;
  border: 1px solid #d8e3ea;
  border-radius: 6px;
  background: #f8fbfd;
}
.story-result__report-card span {
  display: block;
  color: #5d6d7e;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}
.story-result__report-card strong {
  display: block;
  margin-top: 4px;
  color: #1f3a4a;
  font-size: 22px;
}
.story-result__report-card p {
  margin: 8px 0 0;
  color: #34495e;
  font-size: 14px;
  line-height: 1.5;
}
.story-result__report-card ul {
  margin: 10px 0 0;
  padding-left: 18px;
  color: #52616b;
  font-size: 13px;
  line-height: 1.5;
}
.story-result__report-card li small {
  display: block;
  margin-top: 2px;
  color: #6b7780;
  font-size: 12px;
}
.story-result__human-review {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid #d6c6a5;
  border-radius: 7px;
  background: #fffdf7;
}
.story-result__human-review > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.story-result__human-review > header span {
  display: block;
  color: #8a6d3b;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.story-result__human-review > header strong {
  display: block;
  margin-top: 3px;
  color: #3f3423;
  font-size: 17px;
}
.story-result__human-review > header b {
  flex: 0 0 auto;
  padding: 4px 8px;
  border-radius: 999px;
  background: #f4e4b8;
  color: #76561c;
  font-size: 12px;
}
.story-result__human-review-boundary {
  margin: 10px 0 12px;
  color: #725f3c;
  font-size: 13px;
  line-height: 1.5;
}
.story-result__human-review-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.story-result__human-review-grid > article {
  padding: 10px;
  border: 1px solid #e5ddcc;
  border-radius: 6px;
  background: #fff;
}
.story-result__human-review-grid h4 {
  margin: 0;
  color: #3d4b55;
  font-size: 14px;
}
.story-result__human-review-grid article > p {
  margin: 4px 0 8px;
  color: #7b8790;
  font-size: 12px;
}
.story-result__human-review-grid ul {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.story-result__human-review-grid li {
  padding: 7px 8px;
  border-left: 3px solid #95a5a6;
  background: #f7f9fa;
}
.story-result__human-review-grid li.story-result__human-review-item--supporting_evidence { border-left-color: #27ae60; }
.story-result__human-review-grid li.story-result__human-review-item--attention_required { border-left-color: #d68910; }
.story-result__human-review-grid li > div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.story-result__human-review-grid li strong {
  color: #34495e;
  font-size: 12px;
}
.story-result__human-review-grid li span,
.story-result__human-review-grid li small {
  color: #71808a;
  font-size: 11px;
}
.story-result__human-review-grid li small {
  display: block;
  margin-top: 3px;
  line-height: 1.35;
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
  .story-result__gate-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .story-result__report-grid {
    grid-template-columns: 1fr;
  }
  .story-result__human-review-grid {
    grid-template-columns: 1fr;
  }
}
</style>
