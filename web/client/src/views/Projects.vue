<template>
  <div class="projects-page">
    <header class="projects-page__header">
      <div>
        <h1 class="projects-page__title">项目工作台</h1>
        <p class="projects-page__desc">管理单片短片、漫剧系列、素材 gate 和最近更新时间。</p>
      </div>
      <div class="projects-page__header-actions">
        <RouterLink class="projects-page__cta projects-page__cta--secondary" to="/domain-pack-expansion-queue">扩库审稿队列</RouterLink>
        <RouterLink class="projects-page__cta projects-page__cta--secondary" to="/supplement-tasks">素材补充任务</RouterLink>
        <RouterLink class="projects-page__cta projects-page__cta--secondary" to="/knowledge-writeback-queue">知识库写回队列</RouterLink>
        <RouterLink class="projects-page__cta projects-page__cta--secondary" to="/ai-comic-series/new">新建漫剧系列</RouterLink>
        <RouterLink class="projects-page__cta" to="/story/new">新建单片短片</RouterLink>
      </div>
    </header>

    <section class="projects-page__toolbar">
      <input
        v-model="searchQuery"
        class="projects-page__search"
        placeholder="搜索标题、来源条目、系列 ID…"
      />
      <select v-model="projectKindFilter" class="projects-page__select">
        <option value="">全部项目</option>
        <option value="story">单片短片</option>
        <option value="series">漫剧系列</option>
      </select>
      <details class="projects-page__filters">
        <summary class="projects-page__filters-summary">
          筛选
          <span v-if="activeFilterCount > 0" class="projects-page__filters-count">{{ activeFilterCount }}</span>
        </summary>
        <div class="projects-page__filters-body">
          <select v-model="statusFilter" class="projects-page__select">
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="edited">已编辑</option>
            <option value="exported">已导出</option>
            <option value="finalized">已定稿</option>
          </select>
          <select v-model="videoStatusFilter" class="projects-page__select">
            <option value="">全部成片</option>
            <option value="none">未回传</option>
            <option value="processing">制作中</option>
            <option value="ready">已就绪</option>
            <option value="failed">未完成</option>
          </select>
          <select v-model="creationUseCaseFilter" class="projects-page__select">
            <option value="">全部创作用途</option>
            <option value="original_ai_comic">原创开发</option>
            <option value="adapted_ai_comic">资料改编</option>
            <option value="institutional_promo">机构影像</option>
            <option value="documentary_short">纪录短片</option>
            <option value="brand_commercial">品牌商业</option>
            <option value="education_training">教育培训</option>
            <option value="public_service">公益宣传</option>
          </select>
          <select v-model="materialGateFilter" class="projects-page__select">
            <option value="">全部素材 gate</option>
            <option value="ready">素材可用</option>
            <option value="risk">可生成但需核验</option>
            <option value="blocked">素材阻断</option>
            <option value="unknown">未标注</option>
          </select>
          <label class="projects-page__toggle">
            <input v-model="supplementFilter" type="checkbox" />
            <span>仅看待补素材</span>
          </label>
          <label class="projects-page__toggle">
            <input v-model="qualityFilter" type="checkbox" />
            <span>仅看质量问题</span>
          </label>
          <label class="projects-page__toggle">
            <input v-model="showArchivedSeries" type="checkbox" @change="loadProjects" />
            <span>显示归档系列</span>
          </label>
          <button
            class="projects-page__muted-btn projects-page__filter-reset"
            :disabled="activeFilterCount === 0"
            @click="resetFilters"
          >
            重置筛选
          </button>
        </div>
      </details>
    </section>

    <section v-if="storyAgentMvpStatus" class="projects-page__portfolio projects-page__mvp-status">
      <div class="projects-page__portfolio-head">
        <div>
          <h2>Story Agent MVP 状态</h2>
          <p>
            {{ productionStatusLabel(storyAgentMvpStatus.status) }}
            · 健康分 {{ storyAgentMvpStatus.score }}/100
            · 治理 {{ storyAgentMvpProgressPercent('generated_governance') }}%
            · MCP {{ storyAgentMvpProgressPercent('mcp_story_agent_loop') }}%
            · 指挥层 {{ storyAgentMvpProgressPercent('content_command_layer') }}%
            · 交付 {{ storyAgentMvpProgressPercent('production_delivery_contract') }}%
            · GEARS 验收 {{ storyAgentMvpProgressPercent('gears_end_to_end_acceptance') }}%
            · generated {{ storyAgentMvpStatus.summary.generated_ready_count }}/{{ storyAgentMvpStatus.summary.generated_target_count }}
            · readiness {{ storyAgentMvpStatus.summary.readiness_ready_count }}/{{ storyAgentMvpStatus.summary.readiness_target_count }}
          </p>
        </div>
        <div class="projects-page__portfolio-head-actions">
          <button class="projects-page__muted-btn" :disabled="!storyAgentMvpStatus.markdown" @click="exportStoryAgentMvpStatusMarkdown">
            导出 MD
          </button>
          <button class="projects-page__muted-btn" @click="exportStoryAgentMvpStatusJson">
            导出 JSON
          </button>
          <button class="projects-page__muted-btn" :disabled="loadingMvpStatus" @click="loadStoryAgentMvpStatus">
            {{ loadingMvpStatus ? '刷新中…' : '刷新状态' }}
          </button>
        </div>
      </div>
      <div class="projects-page__portfolio-metrics">
        <span>planned {{ storyAgentMvpStatus.summary.generated_planned_count }}</span>
        <span>production gap {{ storyAgentMvpStatus.summary.generated_production_gap_count }}</span>
        <span>interrupted {{ storyAgentMvpStatus.summary.generated_interrupted_count }}</span>
        <span>阻断目标 {{ storyAgentMvpStatus.summary.readiness_blocked_count }}</span>
        <span>安全自动化 {{ storyAgentMvpStatus.summary.ready_automation_step_count }}</span>
        <span>GEARS/人工 {{ storyAgentMvpStatus.summary.external_or_manual_step_count }}</span>
        <RouterLink class="projects-page__metric-link" :to="{ name: 'SupplementTasks', query: { status: 'open' } }">
          素材补充 {{ storyAgentMvpStatus.summary.story_supplement_open_count }} 待补 · 阻断 {{ storyAgentMvpStatus.summary.story_supplement_blocking_open_count }} · 风险 {{ storyAgentMvpStatus.summary.story_supplement_risk_open_count }} · 生产前 {{ storyAgentMvpStatus.summary.story_supplement_optional_open_count }} · 候选包 {{ storyAgentMvpStatus.summary.story_supplement_candidate_package_task_count }} 条/{{ storyAgentMvpStatus.summary.story_supplement_candidate_package_target_file_count }} 文件 · 质量 {{ storyAgentMvpStatus.summary.story_quality_passed_count }}/{{ storyAgentMvpStatus.summary.story_quality_failed_count }}
        </RouterLink>
        <span>模板 {{ storyAgentMvpStatus.summary.production_material_pack_status }} {{ storyAgentMvpStatus.summary.production_material_pack_core_ready_count }}/{{ storyAgentMvpStatus.summary.production_material_pack_core_total_count }}</span>
        <span>Domain Pack {{ storyAgentMvpStatus.summary.domain_pack_status }} {{ storyAgentMvpStatus.summary.production_domain_pack_ready_count }}/{{ storyAgentMvpStatus.summary.production_domain_pack_required_count }}</span>
        <RouterLink class="projects-page__metric-link" to="/domain-pack-expansion-queue">
          扩库候选 {{ storyAgentMvpStatus.summary.domain_pack_expansion_status }} {{ storyAgentMvpStatus.summary.domain_pack_expansion_batch_count }} 批 · 进度 {{ storyAgentMvpStatus.summary.domain_pack_expansion_pipeline_progress_percent }}% · 阶段 {{ domainPackExpansionStageLabel(storyAgentMvpStatus.summary.domain_pack_expansion_pipeline_stage) }} · 字段样板 {{ storyAgentMvpStatus.summary.domain_pack_expansion_field_supplement_candidate_count }} · 送审 {{ storyAgentMvpStatus.summary.domain_pack_expansion_field_review_ready_count }} · 阻断 {{ storyAgentMvpStatus.summary.domain_pack_expansion_field_review_blocker_count }} · 补库目标 {{ storyAgentMvpStatus.summary.domain_pack_expansion_field_supplement_priority_target_count }} · 审稿目标 {{ storyAgentMvpStatus.summary.domain_pack_expansion_review_ready_priority_target_count }} · 完整度 {{ storyAgentMvpStatus.summary.domain_pack_expansion_field_candidate_completion_percent }}% · 已通过 {{ storyAgentMvpStatus.summary.domain_pack_expansion_review_approved_count }} · 草案 {{ storyAgentMvpStatus.summary.domain_pack_expansion_approved_writeback_draft_count }}
        </RouterLink>
      </div>
      <div class="projects-page__mvp-progress">
        <article
          v-for="slice in storyAgentMvpStatus.progress"
          :key="slice.key"
          :class="['projects-page__mvp-progress-card', `projects-page__mvp-progress-card--${slice.key}`]"
        >
          <div class="projects-page__mvp-progress-head">
            <span :class="['projects-page__readiness-badge', `projects-page__readiness-badge--${slice.status}`]">
              {{ productionStatusLabel(slice.status) }}
            </span>
            <strong>{{ slice.percent }}%</strong>
          </div>
          <h3>{{ storyAgentMvpProgressLabel(slice.key) }}</h3>
          <p>{{ slice.detail }}</p>
          <small v-if="slice.blocker">阻断：{{ slice.blocker }}</small>
        </article>
      </div>
      <div class="projects-page__mvp-lanes">
        <article
          v-for="lane in storyAgentMvpStatus.lanes"
          :key="lane.key"
          class="projects-page__mvp-lane"
        >
          <div class="projects-page__mvp-lane-head">
            <span :class="['projects-page__readiness-badge', `projects-page__readiness-badge--${lane.status}`]">
              {{ productionStatusLabel(lane.status) }}
            </span>
            <strong>{{ lane.score }}/100</strong>
          </div>
          <h3>{{ storyAgentMvpLaneLabel(lane.key) }}</h3>
          <p>{{ lane.detail }}</p>
          <small v-if="lane.next_action">{{ lane.next_action }}</small>
        </article>
      </div>
      <div class="projects-page__mvp-columns">
        <div v-if="storyAgentMvpStatus.next_actions.length" class="projects-page__mvp-column">
          <h3>下一步</h3>
          <ol>
            <li v-for="action in storyAgentMvpStatus.next_actions.slice(0, 5)" :key="action">
              {{ action }}
            </li>
          </ol>
        </div>
        <div v-if="storyAgentMvpStatus.priority_targets.length" class="projects-page__mvp-column">
          <h3>优先目标</h3>
          <ol>
            <li
              v-for="target in storyAgentMvpStatus.priority_targets.slice(0, 5)"
              :key="`${target.scope}:${target.project_id}:${target.priority_score}`"
            >
              <RouterLink :to="storyAgentMvpTargetLink(target)">
                P{{ target.priority_score }} · {{ target.title || target.project_id }}
              </RouterLink>
              <span>{{ target.primary_action || target.status }}</span>
            </li>
          </ol>
        </div>
      </div>
    </section>

    <section v-if="storyAgentBacklogHandoff" class="projects-page__portfolio projects-page__backlog-handoff">
      <div class="projects-page__portfolio-head">
        <div>
          <h2>Story Agent Backlog Handoff</h2>
          <p>
            {{ storyAgentBacklogHandoff.summary.total_item_count }} 个交接项
            · P0 {{ storyAgentBacklogHandoff.summary.p0_count }}
            · P1 {{ storyAgentBacklogHandoff.summary.p1_count }}
            · generated {{ storyAgentBacklogHandoff.summary.generated_health_item_count }}
            · 素材补库 {{ storyAgentBacklogHandoff.summary.supplement_candidate_item_count }}
            · 省份写回 {{ writebackFlagLabel(storyAgentBacklogHandoff.province_markdown_written) }}
          </p>
        </div>
        <div class="projects-page__portfolio-head-actions">
          <button class="projects-page__muted-btn" :disabled="!storyAgentBacklogHandoff.markdown" @click="exportStoryAgentBacklogHandoffMarkdown">
            导出 MD
          </button>
          <button class="projects-page__muted-btn" @click="exportStoryAgentBacklogHandoffJson">
            导出 JSON
          </button>
          <button class="projects-page__muted-btn" :disabled="loadingBacklogHandoff" @click="loadStoryAgentBacklogHandoff">
            {{ loadingBacklogHandoff ? '刷新中…' : '刷新交接' }}
          </button>
        </div>
      </div>
      <div class="projects-page__portfolio-metrics">
        <span>production gap {{ storyAgentBacklogHandoff.summary.production_gap_count }}</span>
        <span>interrupted {{ storyAgentBacklogHandoff.summary.interrupted_count }}</span>
        <span>质量失败 {{ storyAgentBacklogHandoff.summary.quality_failed_count }}</span>
        <span>素材阻断 {{ storyAgentBacklogHandoff.summary.material_blocked_count }}</span>
        <RouterLink class="projects-page__metric-link" :to="{ name: 'SupplementTasks', query: { status: 'open' } }">
          open supplement {{ storyAgentBacklogHandoff.summary.open_supplement_candidate_count }}
          · blocking {{ storyAgentBacklogHandoff.summary.supplement_blocking_open_count }}
          · risk {{ storyAgentBacklogHandoff.summary.supplement_risk_open_count }}
          · optional {{ storyAgentBacklogHandoff.summary.supplement_optional_open_count }}
        </RouterLink>
        <span>direct writeback {{ writebackFlagLabel(storyAgentBacklogHandoff.direct_writeback_to_province_markdown) }}</span>
      </div>
      <div class="projects-page__portfolio-grid projects-page__backlog-grid">
        <article
          v-for="item in storyAgentBacklogHandoff.items.slice(0, 8)"
          :key="item.backlog_id"
          class="projects-page__portfolio-item projects-page__backlog-item"
        >
          <div class="projects-page__portfolio-item-head">
            <span :class="['projects-page__priority-badge', `projects-page__priority-badge--${item.priority.toLowerCase()}`]">
              {{ item.priority }}
            </span>
            <strong>{{ backlogActionLabel(item.action_type) }}</strong>
          </div>
          <RouterLink class="projects-page__portfolio-title" :to="storyAgentBacklogItemLink(item)">
            {{ item.title || item.project_id }}
          </RouterLink>
          <p>{{ backlogSourceLabel(item.source_kind) }} · {{ item.project_id }}</p>
          <p v-if="item.target_file">目标：{{ item.target_file }}</p>
          <p v-if="item.missing_contracts.length">缺口：{{ item.missing_contracts.slice(0, 3).join(' / ') }}</p>
          <p>下一步：{{ item.recommended_action }}</p>
          <small>{{ item.reason }}</small>
        </article>
      </div>
    </section>

    <section v-if="productionPortfolio" class="projects-page__portfolio">
      <div class="projects-page__portfolio-head">
        <div>
          <h2>生产指挥总览</h2>
          <p>
            {{ productionPortfolio.summary.total_target_count }} 个目标
            · blocked {{ productionPortfolio.summary.blocked_count }}
            · needs action {{ productionPortfolio.summary.needs_action_count }}
            · ready automation {{ productionPortfolio.summary.ready_automation_step_count }}
          </p>
        </div>
        <div class="projects-page__portfolio-head-actions">
          <button
            class="projects-page__muted-btn"
            :disabled="runningPortfolioAutomation || loadingPortfolio"
            @click="runPortfolioAutomation"
          >
            {{ runningPortfolioAutomation ? '自动化中…' : '运行队列安全自动化' }}
          </button>
          <button
            class="projects-page__muted-btn"
            :disabled="Boolean(gearsExternalQueueCopyMode)"
            @click="copyGearsExternalCallbackQueue('markdown')"
          >
            {{ gearsExternalQueueCopyMode === 'markdown' ? '复制中…' : '复制回片队列 MD' }}
          </button>
          <button
            class="projects-page__muted-btn"
            :disabled="Boolean(gearsExternalQueueCopyMode)"
            @click="copyGearsExternalCallbackQueue('payload')"
          >
            {{ gearsExternalQueueCopyMode === 'payload' ? '复制中…' : '复制 Payload JSON' }}
          </button>
          <button
            class="projects-page__muted-btn"
            :disabled="Boolean(gearsExternalQueueCopyMode)"
            @click="copyGearsExternalCallbackQueue('commands')"
          >
            {{ gearsExternalQueueCopyMode === 'commands' ? '复制中…' : '复制 Preflight 命令' }}
          </button>
          <button class="projects-page__muted-btn" :disabled="loadingPortfolio" @click="loadProductionPortfolio">
            {{ loadingPortfolio ? '刷新中…' : '刷新总览' }}
          </button>
        </div>
      </div>
      <div class="projects-page__portfolio-metrics">
        <span>故事 {{ productionPortfolio.summary.story_project_count }}</span>
        <span>系列 {{ productionPortfolio.summary.ai_comic_series_count }}</span>
        <span>阻断项 {{ productionPortfolio.summary.blocker_count }}</span>
        <span v-if="productionPortfolio.summary.ready_without_external_gears_artifact_count > 0">
          待外部回片 {{ productionPortfolio.summary.ready_without_external_gears_artifact_count }}
        </span>
        <span v-if="productionPortfolio.summary.seedance_placeholder_asset_count > 0">
          Seedance 占位 {{ productionPortfolio.summary.seedance_placeholder_asset_count }}
        </span>
        <span>正式素材 ready {{ productionPortfolio.summary.seedance_production_asset_ready_count }}</span>
        <span>GEARS/人工外部步骤 {{ productionPortfolio.summary.external_automation_step_count + productionPortfolio.summary.manual_automation_step_count }}</span>
        <span>已有自动化记录 {{ productionPortfolio.summary.latest_automation_run_count }}</span>
        <span>队列运行 {{ productionPortfolio.summary.portfolio_automation_run_count }}</span>
        <span v-if="productionPortfolio.latest_portfolio_automation_run">
          最近队列 {{ formatDate(productionPortfolio.latest_portfolio_automation_run.completed_at) }}
          · 执行 {{ productionPortfolio.latest_portfolio_automation_run.executed_target_count }}
          · 失败 {{ productionPortfolio.latest_portfolio_automation_run.failed_target_count }}
        </span>
      </div>
      <div class="projects-page__portfolio-grid">
        <article
          v-for="item in productionPortfolio.items.slice(0, 5)"
          :key="`${item.scope}:${item.project_id}`"
          class="projects-page__portfolio-item"
        >
          <div class="projects-page__portfolio-item-head">
            <span :class="['projects-page__readiness-badge', `projects-page__readiness-badge--${item.status}`]">
              {{ productionStatusLabel(item.status) }}
            </span>
            <strong>P{{ item.priority_score }}</strong>
          </div>
          <RouterLink class="projects-page__portfolio-title" :to="portfolioItemLink(item)">
            {{ item.title }}
          </RouterLink>
          <p>{{ item.scope === 'story_project' ? '单片短片' : '漫剧系列' }} · {{ item.score }}/100</p>
          <p v-if="item.ready_without_external_gears_artifact_count > 0">
            待外部回片 {{ item.ready_without_external_gears_artifact_count }} · 外部 ready {{ item.external_ready_gears_job_count }} · 本地验收 {{ item.local_acceptance_ready_gears_job_count }}
          </p>
          <p v-if="item.seedance_placeholder_asset_count > 0">
            Seedance 占位 {{ item.seedance_placeholder_asset_count }} · 正式素材 ready {{ item.seedance_production_asset_ready_count }}
          </p>
          <p v-if="item.primary_issue_label">阻断：{{ item.primary_issue_label }}</p>
          <p v-if="item.primary_action_label">下一步：{{ item.primary_action_label }}</p>
          <small v-if="item.latest_automation_run">
            最近自动化 {{ formatDate(item.latest_automation_run.completed_at) }} · executed {{ item.latest_automation_run.executed_step_count }}
          </small>
        </article>
      </div>
      <div v-if="productionPortfolio.action_buckets.length" class="projects-page__portfolio-actions">
        <span
          v-for="bucket in productionPortfolio.action_buckets.slice(0, 6)"
          :key="bucket.action_key"
        >
          {{ bucket.label }} · {{ bucket.count }}
        </span>
      </div>
    </section>

    <section v-if="generatedGovernancePlan" class="projects-page__portfolio projects-page__generated-governance">
      <div class="projects-page__portfolio-head">
        <div>
          <h2>Generated 治理计划</h2>
          <p>
            {{ productionStatusLabel(generatedGovernancePlan.status) }}
            · relink {{ generatedGovernancePlan.summary.series_relink_candidate_count }}
            · archive/rebuild {{ generatedGovernancePlan.summary.series_archive_or_rebuild_candidate_count }}
            · story refs {{ generatedGovernancePlan.summary.story_ref_repair_candidate_count }}
            · GEARS 候选 {{ generatedGovernancePlan.summary.ready_gears_signoff_candidate_count }}
          </p>
        </div>
        <div class="projects-page__portfolio-head-actions">
          <button class="projects-page__muted-btn" :disabled="!generatedGovernancePlan.markdown" @click="exportGeneratedGovernanceMarkdown">
            导出 MD
          </button>
          <button class="projects-page__muted-btn" @click="exportGeneratedGovernanceJson">
            导出 JSON
          </button>
          <button class="projects-page__muted-btn" :disabled="runningGeneratedGovernance" @click="runGeneratedGovernanceDryRun">
            {{ runningGeneratedGovernance ? '生成中…' : '生成 dry-run 清单' }}
          </button>
          <button class="projects-page__muted-btn" :disabled="loadingGeneratedGovernance" @click="loadGeneratedGovernancePlan">
            {{ loadingGeneratedGovernance ? '刷新中…' : '刷新计划' }}
          </button>
        </div>
      </div>
      <div class="projects-page__portfolio-metrics">
        <span>总目标 {{ generatedGovernancePlan.summary.source_total_target_count }}</span>
        <span>系列治理 {{ generatedGovernancePlan.summary.series_governance_attention_count }}</span>
        <span>缺分集引用项目 {{ generatedGovernancePlan.summary.series_missing_story_ref_project_count }}</span>
        <span>planned {{ generatedGovernancePlan.summary.series_planned_only_count }}</span>
        <span>补合同 {{ generatedGovernancePlan.summary.series_contract_repair_candidate_count }}</span>
        <span>ready {{ generatedGovernancePlan.summary.ready_target_count }}</span>
      </div>
      <div v-if="generatedGovernanceRun" class="projects-page__portfolio-actions">
        <span>manifest {{ generatedGovernanceRun.manifest.manifest_id }}</span>
        <span>planned {{ generatedGovernanceRun.planned_target_count }}</span>
        <span>blocked {{ generatedGovernanceRun.blocked_target_count }}</span>
        <span>skipped {{ generatedGovernanceRun.skipped_target_count }}</span>
        <button class="projects-page__muted-btn" :disabled="!generatedGovernanceRun.markdown" @click="exportGeneratedGovernanceRunMarkdown">
          导出清单 MD
        </button>
        <button class="projects-page__muted-btn" @click="exportGeneratedGovernanceRunJson">
          导出清单 JSON
        </button>
      </div>
      <div class="projects-page__portfolio-grid">
        <article
          v-for="action in generatedGovernancePlan.actions.slice(0, 6)"
          :key="action.action_key"
          class="projects-page__portfolio-item"
        >
          <div class="projects-page__portfolio-item-head">
            <span class="projects-page__readiness-badge projects-page__readiness-badge--needs_action">
              {{ action.priority }}
            </span>
            <strong>{{ action.target_count }}</strong>
          </div>
          <h3 class="projects-page__portfolio-title">{{ generatedGovernanceActionLabel(action.action_key) }}</h3>
          <p>{{ action.runner }} · auto {{ action.can_auto_apply ? 'yes' : 'no' }}</p>
          <p>{{ action.next_step }}</p>
          <small v-if="action.sample_targets.length">
            样本 {{ action.sample_targets.slice(0, 2).map(target => target.project_id).join(' / ') }}
          </small>
        </article>
      </div>
    </section>

    <section v-if="generatedHealth" class="projects-page__portfolio projects-page__generated-health">
      <div class="projects-page__portfolio-head">
        <div>
          <h2>生成项目体检</h2>
          <p>
            {{ generatedHealth.summary.total_target_count }} 个目标
            · interrupted {{ generatedHealth.summary.interrupted_count }}
            · production gap {{ generatedHealth.summary.production_gap_count }}
            · planned {{ generatedHealth.summary.planned_count }}
          </p>
        </div>
        <div class="projects-page__portfolio-head-actions">
          <button class="projects-page__muted-btn" :disabled="loadingGeneratedHealth" @click="loadGeneratedHealth">
            {{ loadingGeneratedHealth ? '刷新中…' : '刷新体检' }}
          </button>
        </div>
      </div>
      <div class="projects-page__portfolio-metrics">
        <span>故事 {{ generatedHealth.summary.scanned_story_project_count }}</span>
        <span>系列 {{ generatedHealth.summary.scanned_series_project_count }}</span>
        <span>缺当前故事 {{ generatedHealth.summary.missing_current_story_count }}</span>
        <span>缺分镜 {{ generatedHealth.summary.missing_scene_breakdown_count }}</span>
        <span>缺 GEARS 段 {{ generatedHealth.summary.missing_gears_segments_count }}</span>
        <span>缺分集引用 {{ generatedHealth.summary.missing_episode_story_id_count }}</span>
        <span>系列缺交付 {{ generatedHealth.summary.series_missing_delivery_count }}</span>
        <span>系列缺后期指令 {{ generatedHealth.summary.series_missing_postproduction_count }}</span>
      </div>
      <div class="projects-page__portfolio-grid">
        <article
          v-for="item in generatedHealth.items.slice(0, 6)"
          :key="`${item.scope}:${item.project_id}`"
          class="projects-page__portfolio-item"
        >
          <div class="projects-page__portfolio-item-head">
            <span :class="['projects-page__readiness-badge', `projects-page__readiness-badge--${item.status}`]">
              {{ generatedHealthStatusLabel(item.status) }}
            </span>
            <strong>P{{ item.risk_score }}</strong>
          </div>
          <RouterLink class="projects-page__portfolio-title" :to="generatedHealthItemLink(item)">
            {{ item.title || item.project_id }}
          </RouterLink>
          <p>{{ item.scope === 'story_project' ? '单片短片' : '漫剧系列' }} · {{ item.project_id }}</p>
          <p v-if="item.missing_contracts.length">缺口：{{ item.missing_contracts.slice(0, 3).join(' / ') }}</p>
          <p v-if="item.recommended_actions[0]">下一步：{{ item.recommended_actions[0] }}</p>
          <small v-if="item.updated_at">更新 {{ formatDate(item.updated_at) }}</small>
        </article>
      </div>
    </section>

    <section
      v-if="showStoryProjects && projects.length > 0"
      class="projects-page__bulkbar"
      :class="{ 'projects-page__bulkbar--active': selectedProjectIds.length > 0 }"
    >
      <label class="projects-page__bulk-check">
        <input
          type="checkbox"
          :checked="allFilteredSelected"
          :indeterminate.prop="someFilteredSelected && !allFilteredSelected"
          :disabled="filteredProjects.length === 0 || batchDeleting || deletingProjectId !== ''"
          :aria-label="allFilteredSelected ? '取消选择当前结果' : '全选当前结果'"
          @change="toggleSelectFiltered"
        />
        <span>全选当前结果</span>
      </label>
      <p class="projects-page__bulk-summary">
        当前已选 {{ selectedVisibleProjectIds.length }} 个，当前结果 {{ filteredProjects.length }} 个
        <span v-if="selectedProjectPreview" class="projects-page__bulk-preview">{{ selectedProjectPreview }}</span>
        <span v-if="selectedHiddenProjectCount > 0" class="projects-page__bulk-warning">
          筛选外仍有 {{ selectedHiddenProjectCount }} 个已选
        </span>
      </p>
      <div class="projects-page__bulk-actions">
        <button class="projects-page__muted-btn" :disabled="selectedProjectIds.length === 0 || batchDeleting" @click="clearSelection">
          清空选择
        </button>
        <button
          v-if="selectedHiddenProjectCount > 0"
          class="projects-page__muted-btn"
          :disabled="batchDeleting"
          @click="clearHiddenSelection"
        >
          清除筛选外选择
        </button>
        <details class="projects-page__cleanup-actions">
          <summary class="projects-page__cleanup-summary">清理操作</summary>
          <div class="projects-page__cleanup-body">
            <button
              class="projects-page__muted-btn"
              :disabled="projects.length <= RETAIN_RECENT_COUNT || retainingRecent || batchDeleting || deletingProjectId !== ''"
              @click="handleRetainRecentProjects"
            >
              {{ retainingRecent ? '清理中…' : `仅保留最近 ${RETAIN_RECENT_COUNT} 个` }}
            </button>
          </div>
        </details>
        <button
          class="projects-page__danger-btn"
          :disabled="selectedVisibleProjectIds.length === 0 || batchDeleting || deletingProjectId !== ''"
          @click="handleBatchDeleteProjects"
        >
          {{ batchDeleting ? '批量删除中…' : `删除当前所选 ${selectedVisibleProjectIds.length} 个` }}
        </button>
      </div>
    </section>

    <div v-if="loading" class="projects-page__loading">
      <div class="projects-page__spinner" />
      <p>正在加载项目…</p>
    </div>

    <div v-if="!loading && error" class="projects-page__error">{{ error }}</div>
    <div v-if="!loading && !error && projectMessage" class="projects-page__message">{{ projectMessage }}</div>

    <section v-if="!loading" class="projects-page__content">
      <section v-if="showSeriesProjects" class="projects-page__section">
        <div class="projects-page__section-head">
          <div>
            <h2>漫剧系列</h2>
            <p>{{ filteredSeriesProjects.length }} 个系列项目</p>
          </div>
          <RouterLink class="projects-page__text-link" to="/ai-comic-series/new">打开漫剧系列</RouterLink>
        </div>
        <div v-if="filteredSeriesProjects.length > 0" class="projects-page__grid">
          <article
            v-for="series in filteredSeriesProjects"
            :key="series.series_project_id"
            :class="['projects-page__card', 'projects-page__card--series', series.archived_at ? 'projects-page__card--archived' : '']"
          >
            <RouterLink class="projects-page__card-link" :to="seriesProjectLink(series.series_project_id)">
              <div class="projects-page__card-top">
                <span class="projects-page__status-badge" data-status="series">漫剧系列</span>
                <span v-if="series.archived_at" class="projects-page__video-type">已归档</span>
                <span v-else class="projects-page__video-type">制作中</span>
              </div>
              <h2 class="projects-page__card-title">{{ series.title }}</h2>
              <p class="projects-page__source">系列 ID：{{ series.series_project_id }}</p>
              <p v-if="series.logline" class="projects-page__logline">{{ series.logline }}</p>
              <div class="projects-page__meta">
                <span>{{ formatDate(series.updated_at) }}</span>
                <span>{{ series.generated_episode_count }} / {{ series.episode_count }} 集已生成</span>
                <span v-if="series.regeneration_episode_count">需重生成 {{ series.regeneration_episode_count }} 集</span>
                <span>{{ series.episode_duration_range_sec.min }}-{{ series.episode_duration_range_sec.max }} 秒/集</span>
                <span>{{ pacingProfileLabel(series.pacing_profile) }}</span>
              </div>
            </RouterLink>
            <div class="projects-page__card-actions">
              <div class="projects-page__card-primary-actions">
                <RouterLink
                  class="projects-page__muted-link"
                  :to="seriesContinueLink(series)"
                >
                  {{ seriesPrimaryActionLabel(series) }}
                </RouterLink>
                <button
                  class="projects-page__muted-btn"
                  :disabled="managingSeriesProjectId === series.series_project_id"
                  @click="handleArchiveSeriesProject(series)"
                >
                  {{ series.archived_at ? '恢复' : '归档' }}
                </button>
                <button
                  class="projects-page__delete-btn"
                  :disabled="managingSeriesProjectId === series.series_project_id"
                  @click="handleDeleteSeriesProject(series)"
                >
                  {{ managingSeriesProjectId === series.series_project_id ? '处理中…' : '删除' }}
                </button>
              </div>
              <details class="projects-page__series-actions">
                <summary class="projects-page__series-actions-summary">制作操作</summary>
                <div class="projects-page__series-actions-body">
                  <button
                    class="projects-page__muted-btn"
                    :disabled="exportingSeriesProjectId === series.series_project_id"
                    @click="handleExportSeriesBible(series)"
                  >
                    {{ exportingSeriesProjectId === series.series_project_id ? '导出中…' : '导出 Bible' }}
                  </button>
                  <button
                    class="projects-page__muted-btn"
                    :disabled="exportingSeriesSeedanceProjectId === series.series_project_id"
                    @click="handleExportSeriesSeedance(series)"
                  >
                    {{ exportingSeriesSeedanceProjectId === series.series_project_id ? '导出中…' : 'Seedance' }}
                  </button>
                  <button
                    class="projects-page__muted-btn"
                    :disabled="exportingSeriesCutProjectId === series.series_project_id"
                    @click="handleExportSeriesCutPackage(series)"
                  >
                    {{ exportingSeriesCutProjectId === series.series_project_id ? '导出中…' : '剪辑包' }}
                  </button>
                  <button
                    class="projects-page__muted-btn"
                    :disabled="assemblingSeriesCutProjectId === series.series_project_id"
                    @click="handleAssembleSeriesCut(series, 'copy')"
                  >
                    {{ assemblingSeriesCutProjectId === series.series_project_id ? '装配中…' : '装配成片' }}
                  </button>
                  <button
                    class="projects-page__muted-btn"
                    :disabled="assemblingSeriesCutProjectId === series.series_project_id"
                    @click="handleAssembleSeriesCut(series, 'transcode')"
                  >
                    转码成片
                  </button>
                  <button
                    class="projects-page__muted-btn"
                    :disabled="exportingSeriesRetryProjectId === series.series_project_id"
                    @click="handleExportSeriesRetryPackage(series)"
                  >
                    {{ exportingSeriesRetryProjectId === series.series_project_id ? '导出中…' : '重试包' }}
                  </button>
                  <button
                    class="projects-page__muted-btn"
                    :disabled="exportingSeriesVersionComparisonProjectId === series.series_project_id"
                    @click="handleExportSeriesVersionComparison(series)"
                  >
                    {{ exportingSeriesVersionComparisonProjectId === series.series_project_id ? '导出中…' : '版本对比' }}
                  </button>
                  <button
                    class="projects-page__muted-btn"
                    :disabled="exportingSeriesThumbnailPlanProjectId === series.series_project_id"
                    @click="handleExportSeriesThumbnailPlan(series)"
                  >
                    {{ exportingSeriesThumbnailPlanProjectId === series.series_project_id ? '导出中…' : '缩略图计划' }}
                  </button>
                  <button
                    class="projects-page__muted-btn"
                    :disabled="exportingSeriesFinishingPlanProjectId === series.series_project_id"
                    @click="handleExportSeriesFinishingPlan(series)"
                  >
                    {{ exportingSeriesFinishingPlanProjectId === series.series_project_id ? '导出中…' : '精修计划' }}
                  </button>
                  <button
                    class="projects-page__muted-btn"
                    :disabled="capturingSeriesThumbnailsProjectId === series.series_project_id"
                    @click="handleCaptureSeriesThumbnails(series)"
                  >
                    {{ capturingSeriesThumbnailsProjectId === series.series_project_id ? '抽帧中…' : '生成缩略图' }}
                  </button>
                </div>
              </details>
            </div>
          </article>
        </div>
        <div v-else class="projects-page__empty projects-page__empty--section">
          <p>还没有匹配到漫剧系列，可以从系列工作台创建一个长线项目。</p>
        </div>
      </section>

      <section v-if="showStoryProjects" class="projects-page__section">
        <div class="projects-page__section-head">
          <div>
            <h2>单片短片</h2>
            <p>{{ filteredProjects.length }} 个单片故事/剧本草稿</p>
          </div>
          <RouterLink class="projects-page__text-link" to="/story/new">打开单片短片</RouterLink>
        </div>
        <div v-if="filteredProjects.length > 0" class="projects-page__story-table-wrap">
          <table class="projects-page__story-table">
            <thead>
              <tr>
                <th class="projects-page__select-col">
                  <label class="projects-page__table-select-all">
                    <input
                      type="checkbox"
                      :checked="allFilteredSelected"
                      :indeterminate.prop="someFilteredSelected && !allFilteredSelected"
                      :disabled="batchDeleting || deletingProjectId !== ''"
                      :aria-label="allFilteredSelected ? '取消选择当前单片短片' : '全选当前单片短片'"
                      @change="toggleSelectFiltered"
                    />
                    <span>全选</span>
                  </label>
                </th>
                <th>故事</th>
                <th>类型 / 状态</th>
                <th>质量 / 素材</th>
                <th>更新时间</th>
                <th class="projects-page__actions-col">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="project in filteredProjects"
                :key="project.project_id"
                :class="{ 'projects-page__story-row--selected': selectedProjectIds.includes(project.project_id) }"
              >
                <td class="projects-page__select-col">
                  <label class="projects-page__row-check" :aria-label="`选择 ${project.title}`">
                    <input
                      v-model="selectedProjectIds"
                      type="checkbox"
                      :value="project.project_id"
                      :disabled="batchDeleting || deletingProjectId !== ''"
                    />
                    <span>{{ selectedProjectIds.includes(project.project_id) ? '已选' : '选择' }}</span>
                  </label>
                </td>
                <td>
                  <RouterLink class="projects-page__story-title" :to="`/projects/${project.project_id}`">
                    {{ project.title }}
                  </RouterLink>
                  <p class="projects-page__story-subtitle">素材：{{ project.source_entry }}</p>
                  <p v-if="project.logline" class="projects-page__story-logline">{{ project.logline }}</p>
                </td>
                <td>
                  <div class="projects-page__cell-stack">
                    <span class="projects-page__status-badge" :data-status="project.status">{{ statusLabel(project.status) }}</span>
                    <span class="projects-page__video-type">{{ typeLabel(project.video_type) }}</span>
                    <span class="projects-page__contract-chip">{{ creationUseCaseLabel(project.creation_use_case) }}</span>
                    <span class="projects-page__contract-chip projects-page__contract-chip--truth">{{ truthModeLabel(project.truth_mode) }}</span>
                    <span>{{ project.scene_count }} 场景</span>
                  </div>
                </td>
                <td>
                  <div class="projects-page__cell-stack">
                    <span :class="['projects-page__material-gate', `projects-page__material-gate--${materialGateStatus(project)}`]">
                      {{ materialGateLabel(materialGateStatus(project), project.material_sufficiency?.score) }}
                    </span>
                    <span
                      v-if="typeof project.genre_score === 'number'"
                      :class="['projects-page__meta-quality', project.quality_passed ? 'projects-page__meta-quality--pass' : 'projects-page__meta-quality--warn']"
                    >
                      类型分 {{ project.genre_score }}
                    </span>
                    <span v-else>未评分</span>
                    <span v-if="(project.quality_issue_count ?? 0) > 0" class="projects-page__meta-warning">
                      质量问题 {{ project.quality_issue_count }}
                    </span>
                    <span v-if="(project.open_supplement_task_count ?? 0) > 0" class="projects-page__meta-warning">
                      待补素材 {{ project.open_supplement_task_count }}
                    </span>
                    <span v-if="project.gears_video_status" :class="['projects-page__meta-video', `projects-page__meta-video--${project.gears_video_status}`]">
                      {{ gearsVideoStatusLabel(project.gears_video_status) }}
                    </span>
                  </div>
                </td>
                <td class="projects-page__date-cell">{{ formatDate(project.updated_at) }}</td>
                <td class="projects-page__actions-col">
                  <div class="projects-page__row-actions">
                    <RouterLink class="projects-page__muted-link" :to="`/projects/${project.project_id}`">打开</RouterLink>
                    <button
                      class="projects-page__delete-btn"
                      :disabled="deletingProjectId === project.project_id"
                      @click="handleDeleteProject(project)"
                    >
                      {{ deletingProjectId === project.project_id ? '删除中…' : '删除' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="projects-page__empty projects-page__empty--section">
          <p>还没有匹配到单片短片，可以先去单片短片生成一个初稿。</p>
        </div>
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { deleteProject, deleteProjects, listProjects, retainRecentProjects } from '@/api/projects'
import {
  getGearsExternalCallbackHandoffQueue,
  getProductionReadinessPortfolio,
  getStoryAgentBacklogHandoff,
  getStoryAgentGeneratedGovernancePlan,
  getStoryAgentGeneratedHealth,
  getStoryAgentMvpStatus,
  runProductionReadinessPortfolioAutomation,
  runStoryAgentGeneratedGovernance,
} from '@/api/system'
import {
  archiveAiComicSeriesProject,
  assembleAiComicSeriesSeedanceCut,
  captureAiComicSeriesSeedanceThumbnails,
  deleteAiComicSeriesProject,
  exportAiComicSeriesBible,
  exportAiComicSeriesSeedanceCutPackage,
  exportAiComicSeriesSeedanceFinishingPlanPackage,
  exportAiComicSeriesSeedancePrompts,
  exportAiComicSeriesSeedanceRetryPackage,
  exportAiComicSeriesSeedanceThumbnailPlanPackage,
  exportAiComicSeriesSeedanceVersionComparisonPackage,
  listAiComicSeriesProjects,
} from '@/api/stories'
import type {
  AiComicPacingProfile,
  AiComicSeriesProjectMeta,
  GearsVideoStatus,
  ProductionReadinessPortfolioItem,
  ProductionReadinessPortfolioReport,
  ProductionReadinessStatus,
  StoryAgentBacklogHandoffItem,
  StoryAgentBacklogHandoffPackage,
  StoryAgentGeneratedGovernanceActionKey,
  StoryAgentGeneratedGovernancePlan,
  StoryAgentGeneratedGovernanceRunResult,
  StoryAgentGeneratedHealthItem,
  StoryAgentGeneratedHealthReport,
  StoryAgentGeneratedHealthStatus,
  StoryAgentMvpStatusReport,
  GearsExternalCallbackHandoffQueuePackage,
  StoryProjectDeleteResult,
  StoryProjectListItem,
  StoryProjectStatus,
  CreationUseCase,
  TruthMode,
} from '@shared/types'

const RETAIN_RECENT_COUNT = 10

type MaterialGateStatus = 'ready' | 'risk' | 'blocked' | 'unknown'

const projects = ref<StoryProjectListItem[]>([])
const seriesProjects = ref<AiComicSeriesProjectMeta[]>([])
const storyAgentMvpStatus = ref<StoryAgentMvpStatusReport | null>(null)
const storyAgentBacklogHandoff = ref<StoryAgentBacklogHandoffPackage | null>(null)
const productionPortfolio = ref<ProductionReadinessPortfolioReport | null>(null)
const generatedGovernancePlan = ref<StoryAgentGeneratedGovernancePlan | null>(null)
const generatedGovernanceRun = ref<StoryAgentGeneratedGovernanceRunResult | null>(null)
const generatedHealth = ref<StoryAgentGeneratedHealthReport | null>(null)
const loading = ref(false)
const loadingMvpStatus = ref(false)
const loadingBacklogHandoff = ref(false)
const loadingPortfolio = ref(false)
const loadingGeneratedGovernance = ref(false)
const runningGeneratedGovernance = ref(false)
const loadingGeneratedHealth = ref(false)
const runningPortfolioAutomation = ref(false)
type GearsExternalQueueCopyMode = 'markdown' | 'payload' | 'commands'
const gearsExternalQueueCopyMode = ref<GearsExternalQueueCopyMode | ''>('')
const error = ref('')
const projectMessage = ref('')
const searchQuery = ref('')
const projectKindFilter = ref('story')
const statusFilter = ref('')
const videoStatusFilter = ref('')
const creationUseCaseFilter = ref<CreationUseCase | ''>('')
const materialGateFilter = ref<MaterialGateStatus | ''>('')
const supplementFilter = ref(false)
const qualityFilter = ref(false)
const showArchivedSeries = ref(false)
const deletingProjectId = ref('')
const managingSeriesProjectId = ref('')
const exportingSeriesProjectId = ref('')
const exportingSeriesSeedanceProjectId = ref('')
const exportingSeriesCutProjectId = ref('')
const exportingSeriesRetryProjectId = ref('')
const exportingSeriesVersionComparisonProjectId = ref('')
const exportingSeriesThumbnailPlanProjectId = ref('')
const exportingSeriesFinishingPlanProjectId = ref('')
const capturingSeriesThumbnailsProjectId = ref('')
const assemblingSeriesCutProjectId = ref('')
const selectedProjectIds = ref<string[]>([])
const batchDeleting = ref(false)
const retainingRecent = ref(false)

const showStoryProjects = computed(() => projectKindFilter.value !== 'series')
const showSeriesProjects = computed(() => projectKindFilter.value !== 'story')

const filteredProjects = computed(() => {
  if (!showStoryProjects.value) return []
  const query = searchQuery.value.trim().toLowerCase()
  return projects.value.filter(project => {
    const matchesStatus = !statusFilter.value || project.status === statusFilter.value
    const matchesVideoStatus = !videoStatusFilter.value
      || (videoStatusFilter.value === 'none' && !project.gears_video_status)
      || project.gears_video_status === videoStatusFilter.value
    const matchesCreationUseCase = !creationUseCaseFilter.value
      || project.creation_use_case === creationUseCaseFilter.value
    const matchesMaterialGate = !materialGateFilter.value
      || materialGateStatus(project) === materialGateFilter.value
    const matchesSupplement = !supplementFilter.value || (project.open_supplement_task_count ?? 0) > 0
    const matchesQuality = !qualityFilter.value || project.quality_passed === false || (project.quality_issue_count ?? 0) > 0
    const matchesQuery = !query
      || project.title.toLowerCase().includes(query)
      || project.source_entry.toLowerCase().includes(query)
    return matchesStatus && matchesVideoStatus && matchesCreationUseCase && matchesMaterialGate && matchesSupplement && matchesQuality && matchesQuery
  })
})

const filteredSeriesProjects = computed(() => {
  if (!showSeriesProjects.value) return []
  if (statusFilter.value || videoStatusFilter.value || supplementFilter.value || qualityFilter.value) return []
  const query = searchQuery.value.trim().toLowerCase()
  return seriesProjects.value.filter(project => {
    return !query
      || project.title.toLowerCase().includes(query)
      || project.logline.toLowerCase().includes(query)
      || project.series_project_id.toLowerCase().includes(query)
  })
})

const allFilteredSelected = computed(() => {
  return filteredProjects.value.length > 0
    && filteredProjects.value.every(project => selectedProjectIds.value.includes(project.project_id))
})

const someFilteredSelected = computed(() => {
  return filteredProjects.value.some(project => selectedProjectIds.value.includes(project.project_id))
})

const selectedVisibleProjects = computed(() => {
  const selected = new Set(selectedProjectIds.value)
  return filteredProjects.value.filter(project => selected.has(project.project_id))
})

const selectedVisibleProjectIds = computed(() => {
  return selectedVisibleProjects.value.map(project => project.project_id)
})

const selectedHiddenProjectCount = computed(() => {
  return Math.max(0, selectedProjectIds.value.length - selectedVisibleProjectIds.value.length)
})

const selectedProjectPreview = computed(() => {
  if (selectedVisibleProjects.value.length === 0) return ''
  const titles = selectedVisibleProjects.value.slice(0, 2).map(project => `《${project.title}》`)
  const extraCount = selectedVisibleProjects.value.length - titles.length
  return `${titles.join('、')}${extraCount > 0 ? ` 等 ${selectedVisibleProjects.value.length} 个` : ''}`
})

const activeFilterCount = computed(() => {
  return [
    statusFilter.value,
    videoStatusFilter.value,
    creationUseCaseFilter.value,
    materialGateFilter.value,
    supplementFilter.value,
    qualityFilter.value,
    showArchivedSeries.value,
  ].filter(Boolean).length
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

function pacingProfileLabel(profile: AiComicPacingProfile): string {
  const map: Record<AiComicPacingProfile, string> = {
    fast_hook: '强钩子快节奏',
    balanced_drama: '均衡剧情推进',
    slow_burn: '慢热铺陈',
    mystery_cliffhanger: '悬念钩子',
  }
  return map[profile]
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

function creationUseCaseLabel(useCase?: CreationUseCase): string {
  if (!useCase) return '未标注用途'
  const map: Record<CreationUseCase, string> = {
    original_ai_comic: '原创开发',
    adapted_ai_comic: '资料改编',
    institutional_promo: '机构影像',
    documentary_short: '纪录短片',
    brand_commercial: '品牌商业',
    education_training: '教育培训',
    public_service: '公益宣传',
  }
  return map[useCase] ?? useCase
}

function truthModeLabel(mode?: TruthMode): string {
  if (!mode) return '未标注真实度'
  const map: Record<TruthMode, string> = {
    fictional_original: '原创虚构',
    inspired_by_material: '素材启发',
    source_adaptation: '原作改编',
    factual_reconstruction: '事实重构',
    institutional_verified: '机构审定',
  }
  return map[mode] ?? mode
}

function materialGateStatus(project: StoryProjectListItem): MaterialGateStatus {
  const report = project.material_sufficiency
  if (!report) return 'unknown'
  if (report.blocked) return 'blocked'
  if (report.needs_verification || report.generation_posture === 'draft_needs_verification') return 'risk'
  if (report.can_generate_with_risks && !report.can_generate) return 'risk'
  if (report.can_generate && report.score >= 70) return 'ready'
  if (report.can_generate || report.can_generate_with_risks) return 'risk'
  return 'unknown'
}

function materialGateLabel(status: MaterialGateStatus, score?: number): string {
  const suffix = typeof score === 'number' ? ` ${score}` : ''
  if (status === 'ready') return `素材可用${suffix}`
  if (status === 'risk') return `需核验${suffix}`
  if (status === 'blocked') return `素材阻断${suffix}`
  return '未标注素材'
}

function gearsVideoStatusLabel(status: GearsVideoStatus): string {
  const map: Record<GearsVideoStatus, string> = {
    processing: '成片制作中',
    ready: '成片已就绪',
    failed: '成片未完成',
  }
  return map[status]
}

function productionStatusLabel(status: ProductionReadinessStatus): string {
  if (status === 'ready') return '可生产'
  if (status === 'blocked') return '阻断'
  return '待处理'
}

function generatedHealthStatusLabel(status: StoryAgentGeneratedHealthStatus): string {
  if (status === 'ready') return '完整'
  if (status === 'planned') return '计划'
  if (status === 'interrupted') return '中断'
  return '缺生产合同'
}

function writebackFlagLabel(value: boolean): string {
  return value ? 'yes' : 'no'
}

function backlogActionLabel(action: StoryAgentBacklogHandoffItem['action_type']): string {
  const map: Record<StoryAgentBacklogHandoffItem['action_type'], string> = {
    repair_story_project_refs: '修复项目引用',
    repair_quality: '修复质量',
    repair_delivery_contract: '补交付合同',
    resolve_material_gate: '解除素材门禁',
    complete_supplement_task: '补素材任务',
    restore_series_story_refs: '恢复分集引用',
    continue_series_generation: '继续系列生成',
    repair_series_delivery: '补系列交付',
  }
  return map[action]
}

function backlogSourceLabel(source: StoryAgentBacklogHandoffItem['source_kind']): string {
  if (source === 'generated_health') return 'generated health'
  return '素材补库候选'
}

function generatedGovernanceActionLabel(key: StoryAgentGeneratedGovernanceActionKey): string {
  const map: Record<StoryAgentGeneratedGovernanceActionKey, string> = {
    restore_or_relink_series_story_refs: '恢复/重连分集故事',
    archive_or_rebuild_series_fixtures: '归档或重建历史样本',
    generate_first_series_episode: '生成首集',
    repair_series_command_contracts: '补系列指挥合同',
    repair_story_project_refs: '修单片项目引用',
    promote_ready_targets_for_gears_signoff: '进入 GEARS 签收候选',
  }
  return map[key]
}

function storyAgentMvpLaneLabel(key: StoryAgentMvpStatusReport['lanes'][number]['key']): string {
  const map: Record<StoryAgentMvpStatusReport['lanes'][number]['key'], string> = {
    generated_artifacts: '生成物',
    generated_governance: 'Generated 治理',
    production_material_packs: '生产素材模板',
    domain_packs: 'Domain Pack',
    domain_pack_expansion: '扩库候选',
    knowledge_writeback: '写回队列',
    story_quality: '故事质量',
    repair_loop: '修复闭环',
    delivery_contract: 'GEARS 交付合同',
    production_command: '生产指挥',
  }
  return map[key]
}

function storyAgentMvpProgressLabel(key: StoryAgentMvpStatusReport['progress'][number]['key']): string {
  const map: Record<StoryAgentMvpStatusReport['progress'][number]['key'], string> = {
    generated_governance: 'Generated 治理',
    mcp_story_agent_loop: 'MCP Story Agent',
    content_command_layer: '内容/生产指挥层',
    production_delivery_contract: '生产板/交付合同',
    gears_end_to_end_acceptance: 'GEARS 真实验收',
  }
  return map[key]
}

function storyAgentMvpProgressPercent(key: StoryAgentMvpStatusReport['progress'][number]['key']): number {
  return storyAgentMvpStatus.value?.progress.find(slice => slice.key === key)?.percent ?? storyAgentMvpStatus.value?.score ?? 0
}

function domainPackExpansionStageLabel(stage: string): string {
  const map: Record<string, string> = {
    candidate_setup: '候选建档',
    field_supplement: '字段补库',
    review_readiness: '送审校验',
    human_review: '人工审稿',
    writeback_queue: '写回草案',
    complete: '扩库完成',
  }
  return map[stage] ?? stage
}

function formatDate(iso: string): string {
  if (!iso) return '未记录'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function removedStoryFileCount(results: StoryProjectDeleteResult[]): number {
  return results.reduce((sum, item) => sum + (item.removed_story_file_count ?? 0), 0)
}

function deletionSummary(results: StoryProjectDeleteResult[]): string {
  return `清理 ${removedStoryFileCount(results)} 个关联故事文件`
}

function seriesProjectLink(seriesProjectId: string) {
  return {
    path: '/ai-comic-series/new',
    query: { seriesProjectId },
  }
}

function portfolioItemLink(item: ProductionReadinessPortfolioItem) {
  if (item.scope === 'story_project') return `/projects/${item.project_id}`
  return {
    path: '/ai-comic-series/new',
    query: { seriesProjectId: item.project_id },
  }
}

function generatedHealthItemLink(item: StoryAgentGeneratedHealthItem) {
  if (item.scope === 'story_project') return `/projects/${item.project_id}`
  return {
    path: '/ai-comic-series/new',
    query: { seriesProjectId: item.project_id },
  }
}

function storyAgentMvpTargetLink(target: StoryAgentMvpStatusReport['priority_targets'][number]) {
  if (target.scope === 'story_project') return `/projects/${target.project_id}`
  return {
    path: '/ai-comic-series/new',
    query: { seriesProjectId: target.project_id },
  }
}

function storyAgentBacklogItemLink(item: StoryAgentBacklogHandoffItem) {
  if (item.source_kind === 'supplement_candidate') {
    return {
      name: 'SupplementTasks',
      query: { status: 'open', project_id: item.project_id },
    }
  }
  if (item.scope === 'story_project') return `/projects/${item.project_id}`
  return {
    path: '/ai-comic-series/new',
    query: { seriesProjectId: item.project_id },
  }
}

function nextSeriesEpisodeNo(project: AiComicSeriesProjectMeta): number | null {
  if (project.generated_episode_count >= project.episode_count) return null
  return project.generated_episode_count + 1
}

function nextSeriesRegenerationEpisodeNo(project: AiComicSeriesProjectMeta): number | null {
  return project.next_regeneration_episode_no ?? null
}

function seriesPrimaryActionLabel(project: AiComicSeriesProjectMeta): string {
  const regenerationEpisodeNo = nextSeriesRegenerationEpisodeNo(project)
  if (regenerationEpisodeNo) return `重生成第 ${regenerationEpisodeNo} 集`
  const nextEpisodeNo = nextSeriesEpisodeNo(project)
  return nextEpisodeNo ? `继续第 ${nextEpisodeNo} 集` : '查看全集'
}

function seriesContinueLink(project: AiComicSeriesProjectMeta) {
  const regenerationEpisodeNo = nextSeriesRegenerationEpisodeNo(project)
  if (regenerationEpisodeNo) {
    return {
      path: '/ai-comic-series/new',
      query: {
        seriesProjectId: project.series_project_id,
        episodeNo: String(regenerationEpisodeNo),
        focus: 'regenerate',
      },
    }
  }
  const nextEpisodeNo = nextSeriesEpisodeNo(project)
  return {
    path: '/ai-comic-series/new',
    query: nextEpisodeNo
      ? { seriesProjectId: project.series_project_id, episodeNo: String(nextEpisodeNo) }
      : { seriesProjectId: project.series_project_id },
  }
}

async function handleDeleteProject(project: StoryProjectListItem) {
  const confirmed = window.confirm(`确定删除《${project.title}》吗？这会删除生成故事文件和项目版本记录。`)
  if (!confirmed) return

  deletingProjectId.value = project.project_id
  error.value = ''
  projectMessage.value = ''
  const res = await deleteProject(project.project_id)
  if (res.ok && res.data) {
    projects.value = projects.value.filter(item => item.project_id !== project.project_id)
    selectedProjectIds.value = selectedProjectIds.value.filter(id => id !== project.project_id)
    projectMessage.value = `单片项目已删除，${deletionSummary([res.data])}`
  } else {
    error.value = res.error?.message ?? '删除单片项目失败'
  }
  deletingProjectId.value = ''
}

async function handleArchiveSeriesProject(project: AiComicSeriesProjectMeta) {
  managingSeriesProjectId.value = project.series_project_id
  error.value = ''
  projectMessage.value = ''
  const archived = !project.archived_at
  const res = await archiveAiComicSeriesProject(project.series_project_id, { archived })
  if (res.ok && res.data) {
    const updated = res.data.project
    if (!showArchivedSeries.value && updated.archived_at) {
      seriesProjects.value = seriesProjects.value.filter(item => item.series_project_id !== project.series_project_id)
    } else {
      seriesProjects.value = seriesProjects.value.map(item =>
        item.series_project_id === project.series_project_id ? updated : item,
      )
    }
    projectMessage.value = archived ? '漫剧系列已归档' : '漫剧系列已恢复'
  } else {
    error.value = res.error?.message ?? '更新漫剧系列状态失败'
  }
  managingSeriesProjectId.value = ''
}

async function handleExportSeriesBible(project: AiComicSeriesProjectMeta) {
  exportingSeriesProjectId.value = project.series_project_id
  error.value = ''
  projectMessage.value = ''
  const res = await exportAiComicSeriesBible(project.series_project_id)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-series-bible.md`,
      res.data.markdown,
      'text/markdown;charset=utf-8',
    )
    projectMessage.value = `系列 Bible 已导出：${project.title}`
  } else {
    error.value = res.error?.message ?? '导出系列 Bible 失败'
  }
  exportingSeriesProjectId.value = ''
}

async function handleExportSeriesSeedance(project: AiComicSeriesProjectMeta) {
  exportingSeriesSeedanceProjectId.value = project.series_project_id
  error.value = ''
  projectMessage.value = ''
  const res = await exportAiComicSeriesSeedancePrompts(project.series_project_id)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-prompts.md`,
      res.data.markdown,
      'text/markdown;charset=utf-8',
    )
    projectMessage.value = `Seedance 提示词已导出：${project.title} · ${res.data.total_shot_count} 个镜头`
  } else {
    error.value = res.error?.message ?? '导出 Seedance 提示词失败'
  }
  exportingSeriesSeedanceProjectId.value = ''
}

async function handleExportSeriesCutPackage(project: AiComicSeriesProjectMeta) {
  exportingSeriesCutProjectId.value = project.series_project_id
  error.value = ''
  projectMessage.value = ''
  const res = await exportAiComicSeriesSeedanceCutPackage(project.series_project_id)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-cut-package.md`,
      res.data.markdown,
      'text/markdown;charset=utf-8',
    )
    projectMessage.value = `剪辑包已导出：${project.title} · 可剪 ${res.data.total_ready_shot_count} 个镜头`
  } else {
    error.value = res.error?.message ?? '导出剪辑包失败'
  }
  exportingSeriesCutProjectId.value = ''
}

async function handleAssembleSeriesCut(project: AiComicSeriesProjectMeta, mode: 'copy' | 'transcode') {
  assemblingSeriesCutProjectId.value = project.series_project_id
  error.value = ''
  projectMessage.value = ''
  const res = await assembleAiComicSeriesSeedanceCut(project.series_project_id, {
    dry_run: false,
    overwrite: false,
    assembly_mode: mode,
    output_profile: mode === 'transcode' ? 'mp4_h264_1080p' : 'source_copy',
  })
  if (res.ok && res.data) {
    seriesProjects.value = seriesProjects.value.map(item =>
      item.series_project_id === project.series_project_id ? res.data!.project : item,
    )
    projectMessage.value = `${mode === 'transcode' ? '转码装配' : '剪辑装配'}完成：${project.title} · ${res.data.source_shot_count} 个镜头 · ${res.data.output_path}`
  } else {
    error.value = res.error?.message ?? '装配剪辑成片失败'
  }
  assemblingSeriesCutProjectId.value = ''
}

async function handleExportSeriesRetryPackage(project: AiComicSeriesProjectMeta) {
  exportingSeriesRetryProjectId.value = project.series_project_id
  error.value = ''
  projectMessage.value = ''
  const res = await exportAiComicSeriesSeedanceRetryPackage(project.series_project_id)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-retry-package.md`,
      res.data.markdown,
      'text/markdown;charset=utf-8',
    )
    projectMessage.value = `重试包已导出：${project.title} · ${res.data.total_retry_shot_count} 个镜头`
  } else {
    error.value = res.error?.message ?? '导出重试包失败'
  }
  exportingSeriesRetryProjectId.value = ''
}

async function handleExportSeriesVersionComparison(project: AiComicSeriesProjectMeta) {
  exportingSeriesVersionComparisonProjectId.value = project.series_project_id
  error.value = ''
  projectMessage.value = ''
  const res = await exportAiComicSeriesSeedanceVersionComparisonPackage(project.series_project_id)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-version-comparison.md`,
      res.data.markdown,
      'text/markdown;charset=utf-8',
    )
    projectMessage.value = `版本对比已导出：${project.title} · ${res.data.comparable_shot_count} 个多版本镜头`
  } else {
    error.value = res.error?.message ?? '导出版本对比失败'
  }
  exportingSeriesVersionComparisonProjectId.value = ''
}

async function handleExportSeriesThumbnailPlan(project: AiComicSeriesProjectMeta) {
  exportingSeriesThumbnailPlanProjectId.value = project.series_project_id
  error.value = ''
  projectMessage.value = ''
  const res = await exportAiComicSeriesSeedanceThumbnailPlanPackage(project.series_project_id)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-thumbnail-plan.md`,
      res.data.markdown,
      'text/markdown;charset=utf-8',
    )
    projectMessage.value = `缩略图计划已导出：${project.title} · ${res.data.total_ready_shot_count} 个镜头`
  } else {
    error.value = res.error?.message ?? '导出缩略图计划失败'
  }
  exportingSeriesThumbnailPlanProjectId.value = ''
}

async function handleExportSeriesFinishingPlan(project: AiComicSeriesProjectMeta) {
  exportingSeriesFinishingPlanProjectId.value = project.series_project_id
  error.value = ''
  projectMessage.value = ''
  const res = await exportAiComicSeriesSeedanceFinishingPlanPackage(project.series_project_id)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.series_project_id}-seedance-finishing-plan.md`,
      res.data.markdown,
      'text/markdown;charset=utf-8',
    )
    projectMessage.value = `成片精修计划已导出：${project.title} · ${res.data.subtitle_cues.length} 条字幕 cue`
  } else {
    error.value = res.error?.message ?? '导出成片精修计划失败'
  }
  exportingSeriesFinishingPlanProjectId.value = ''
}

async function handleCaptureSeriesThumbnails(project: AiComicSeriesProjectMeta) {
  capturingSeriesThumbnailsProjectId.value = project.series_project_id
  error.value = ''
  projectMessage.value = ''
  const res = await captureAiComicSeriesSeedanceThumbnails(project.series_project_id, {
    dry_run: false,
    overwrite: false,
  })
  if (res.ok && res.data) {
    seriesProjects.value = seriesProjects.value.map(item =>
      item.series_project_id === project.series_project_id ? res.data!.project : item,
    )
    projectMessage.value = `缩略图抽帧完成：${project.title} · 生成 ${res.data.captured_count} 个，跳过 ${res.data.skipped_count} 个，失败 ${res.data.failed_count} 个`
  } else {
    error.value = res.error?.message ?? '生成缩略图失败'
  }
  capturingSeriesThumbnailsProjectId.value = ''
}

async function handleDeleteSeriesProject(project: AiComicSeriesProjectMeta) {
  const confirmed = window.confirm(`确定删除漫剧系列《${project.title}》吗？这会删除系列规划、连续性账本和导出记录。`)
  if (!confirmed) return

  managingSeriesProjectId.value = project.series_project_id
  error.value = ''
  projectMessage.value = ''
  const res = await deleteAiComicSeriesProject(project.series_project_id)
  if (res.ok) {
    seriesProjects.value = seriesProjects.value.filter(item => item.series_project_id !== project.series_project_id)
    projectMessage.value = '漫剧系列已删除'
  } else {
    error.value = res.error?.message ?? '删除漫剧系列失败'
  }
  managingSeriesProjectId.value = ''
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

function exportStoryAgentMvpStatusMarkdown() {
  if (!storyAgentMvpStatus.value?.markdown) return
  downloadText(
    'story-agent-mvp-status.md',
    storyAgentMvpStatus.value.markdown,
    'text/markdown;charset=utf-8',
  )
}

function exportStoryAgentMvpStatusJson() {
  if (!storyAgentMvpStatus.value) return
  downloadText(
    'story-agent-mvp-status.json',
    JSON.stringify(storyAgentMvpStatus.value, null, 2),
    'application/json;charset=utf-8',
  )
}

function exportStoryAgentBacklogHandoffMarkdown() {
  if (!storyAgentBacklogHandoff.value?.markdown) return
  downloadText(
    'story-agent-backlog-handoff.md',
    storyAgentBacklogHandoff.value.markdown,
    'text/markdown;charset=utf-8',
  )
}

function exportStoryAgentBacklogHandoffJson() {
  if (!storyAgentBacklogHandoff.value) return
  downloadText(
    'story-agent-backlog-handoff.json',
    JSON.stringify(storyAgentBacklogHandoff.value, null, 2),
    'application/json;charset=utf-8',
  )
}

function exportGeneratedGovernanceMarkdown() {
  if (!generatedGovernancePlan.value?.markdown) return
  downloadText(
    'story-agent-generated-governance-plan.md',
    generatedGovernancePlan.value.markdown,
    'text/markdown;charset=utf-8',
  )
}

function exportGeneratedGovernanceJson() {
  if (!generatedGovernancePlan.value) return
  downloadText(
    'story-agent-generated-governance-plan.json',
    JSON.stringify(generatedGovernancePlan.value, null, 2),
    'application/json;charset=utf-8',
  )
}

function exportGeneratedGovernanceRunMarkdown() {
  if (!generatedGovernanceRun.value?.markdown) return
  downloadText(
    'story-agent-generated-governance-run.md',
    generatedGovernanceRun.value.markdown,
    'text/markdown;charset=utf-8',
  )
}

function exportGeneratedGovernanceRunJson() {
  if (!generatedGovernanceRun.value) return
  downloadText(
    'story-agent-generated-governance-run.json',
    JSON.stringify(generatedGovernanceRun.value, null, 2),
    'application/json;charset=utf-8',
  )
}

function toggleSelectFiltered() {
  const filteredIds = filteredProjects.value.map(project => project.project_id)
  if (allFilteredSelected.value) {
    const removeIds = new Set(filteredIds)
    selectedProjectIds.value = selectedProjectIds.value.filter(id => !removeIds.has(id))
    return
  }

  selectedProjectIds.value = [...new Set([...selectedProjectIds.value, ...filteredIds])]
}

function clearSelection() {
  selectedProjectIds.value = []
}

function clearHiddenSelection() {
  const visibleIds = new Set(filteredProjects.value.map(project => project.project_id))
  selectedProjectIds.value = selectedProjectIds.value.filter(id => visibleIds.has(id))
}

function resetFilters() {
  statusFilter.value = ''
  videoStatusFilter.value = ''
  creationUseCaseFilter.value = ''
  materialGateFilter.value = ''
  supplementFilter.value = false
  qualityFilter.value = false
  if (showArchivedSeries.value) {
    showArchivedSeries.value = false
    void loadProjects()
  }
}

async function handleBatchDeleteProjects() {
  if (selectedVisibleProjectIds.value.length === 0) return
  const selectedTitles = selectedVisibleProjects.value.slice(0, 3).map(project => `《${project.title}》`).join('、')
  const extraCount = Math.max(0, selectedVisibleProjects.value.length - 3)
  const titlePreview = `${selectedTitles}${extraCount > 0 ? ` 等 ${selectedVisibleProjects.value.length} 个项目` : ''}`
  const hiddenSelectionNote = selectedHiddenProjectCount.value > 0
    ? `\n\n筛选外还有 ${selectedHiddenProjectCount.value} 个已选故事，本次不会删除。`
    : ''
  const confirmed = window.confirm(`确定批量删除 ${titlePreview} 吗？这会删除对应生成故事文件和项目版本记录。${hiddenSelectionNote}`)
  if (!confirmed) return

  batchDeleting.value = true
  error.value = ''
  projectMessage.value = ''
  const idsToDelete = [...selectedVisibleProjectIds.value]
  const res = await deleteProjects(idsToDelete)
  if (res.ok && res.data) {
    const deletedIds = new Set(res.data.deleted.map(item => item.project_id))
    projects.value = projects.value.filter(item => !deletedIds.has(item.project_id))
    selectedProjectIds.value = selectedProjectIds.value.filter(id => !deletedIds.has(id))
    if (res.data.failed.length > 0) {
      error.value = `已删除 ${res.data.deleted.length} 个，${deletionSummary(res.data.deleted)}；${res.data.failed.length} 个删除失败：${res.data.failed[0].error}`
    } else {
      projectMessage.value = `已删除 ${res.data.deleted.length} 个单片项目，${deletionSummary(res.data.deleted)}`
    }
  } else {
    error.value = res.error?.message ?? '批量删除单片项目失败'
  }
  batchDeleting.value = false
}

async function handleRetainRecentProjects() {
  if (projects.value.length <= RETAIN_RECENT_COUNT) return
  const confirmed = window.confirm(`确定按生成故事时间只保留最近 ${RETAIN_RECENT_COUNT} 个吗？较早项目、孤立项目及对应生成故事文件会被删除。`)
  if (!confirmed) return

  retainingRecent.value = true
  error.value = ''
  projectMessage.value = ''
  const res = await retainRecentProjects(RETAIN_RECENT_COUNT)
  if (res.ok && res.data) {
    projects.value = res.data.kept
    selectedProjectIds.value = selectedProjectIds.value.filter(id => projects.value.some(project => project.project_id === id))
    projectMessage.value = `已按生成时间保留最近 ${res.data.keep_recent} 个，删除 ${res.data.deleted.length} 个单片项目，${deletionSummary(res.data.deleted)}`
    if (res.data.failed.length > 0) {
      await loadProjects()
      error.value = `有 ${res.data.failed.length} 个项目未删除：${res.data.failed[0].error}`
    }
  } else {
    error.value = res.error?.message ?? '清理单片项目失败'
  }
  retainingRecent.value = false
}

async function loadProjects() {
  loading.value = true
  error.value = ''
  projectMessage.value = ''
  const [storyRes, seriesRes, mvpStatusRes, backlogHandoffRes, portfolioRes, generatedGovernanceRes, generatedHealthRes] = await Promise.all([
    listProjects(),
    listAiComicSeriesProjects(showArchivedSeries.value),
    getStoryAgentMvpStatus({ includeArchivedSeries: showArchivedSeries.value, generatedLimit: 12, portfolioLimit: 12 }),
    getStoryAgentBacklogHandoff({ limit: 12 }),
    getProductionReadinessPortfolio({ includeArchivedSeries: showArchivedSeries.value, limit: 12 }),
    getStoryAgentGeneratedGovernancePlan({ limit: 12 }),
    getStoryAgentGeneratedHealth({ limit: 12 }),
  ])
  if (storyRes.ok && storyRes.data) projects.value = storyRes.data
  if (seriesRes.ok && seriesRes.data) seriesProjects.value = seriesRes.data
  if (mvpStatusRes.ok && mvpStatusRes.data) storyAgentMvpStatus.value = mvpStatusRes.data
  if (backlogHandoffRes.ok && backlogHandoffRes.data) storyAgentBacklogHandoff.value = backlogHandoffRes.data
  if (portfolioRes.ok && portfolioRes.data) productionPortfolio.value = portfolioRes.data
  if (generatedGovernanceRes.ok && generatedGovernanceRes.data) generatedGovernancePlan.value = generatedGovernanceRes.data
  if (generatedHealthRes.ok && generatedHealthRes.data) generatedHealth.value = generatedHealthRes.data
  if (!storyRes.ok) error.value = storyRes.error?.message ?? '加载单片项目失败'
  if (!seriesRes.ok) error.value = seriesRes.error?.message ?? '加载漫剧系列失败'
  if (!mvpStatusRes.ok) error.value = mvpStatusRes.error?.message ?? '加载 Story Agent MVP 状态失败'
  if (!backlogHandoffRes.ok) error.value = backlogHandoffRes.error?.message ?? '加载 Story Agent backlog handoff 失败'
  if (!portfolioRes.ok) error.value = portfolioRes.error?.message ?? '加载生产指挥总览失败'
  if (!generatedGovernanceRes.ok) error.value = generatedGovernanceRes.error?.message ?? '加载 generated 治理计划失败'
  if (!generatedHealthRes.ok) error.value = generatedHealthRes.error?.message ?? '加载生成项目体检失败'
  loading.value = false
}

async function loadStoryAgentMvpStatus() {
  loadingMvpStatus.value = true
  const res = await getStoryAgentMvpStatus({ includeArchivedSeries: showArchivedSeries.value, generatedLimit: 12, portfolioLimit: 12 })
  if (res.ok && res.data) {
    storyAgentMvpStatus.value = res.data
  } else {
    error.value = res.error?.message ?? '刷新 Story Agent MVP 状态失败'
  }
  loadingMvpStatus.value = false
}

async function loadStoryAgentBacklogHandoff() {
  loadingBacklogHandoff.value = true
  const res = await getStoryAgentBacklogHandoff({ limit: 12 })
  if (res.ok && res.data) {
    storyAgentBacklogHandoff.value = res.data
  } else {
    error.value = res.error?.message ?? '刷新 Story Agent backlog handoff 失败'
  }
  loadingBacklogHandoff.value = false
}

async function loadProductionPortfolio() {
  loadingPortfolio.value = true
  const res = await getProductionReadinessPortfolio({ includeArchivedSeries: showArchivedSeries.value, limit: 12 })
  if (res.ok && res.data) {
    productionPortfolio.value = res.data
  } else {
    error.value = res.error?.message ?? '刷新生产指挥总览失败'
  }
  loadingPortfolio.value = false
}

async function copyGearsExternalCallbackQueue(mode: GearsExternalQueueCopyMode) {
  gearsExternalQueueCopyMode.value = mode
  error.value = ''
  projectMessage.value = ''
  try {
    const res = await getGearsExternalCallbackHandoffQueue({ limit: 30 })
    if (res.ok && res.data) {
      const clipboardText = gearsExternalQueueClipboardText(res.data, mode)
      await navigator.clipboard.writeText(clipboardText)
      const label = mode === 'markdown'
        ? 'Markdown 队列'
        : mode === 'payload'
          ? 'callback payload JSON'
          : 'system preflight/import 命令'
      const sampleStatus = mode === 'payload' || mode === 'commands'
        ? ` · sample ready ${res.data.callback_sample_ready_for_import_count}/${res.data.callback_sample_count} · placeholder ${res.data.callback_sample_placeholder_output_url_count}`
        : ''
      projectMessage.value = res.data.pending_external_artifact_count > 0
        ? `已复制 ${label}：${res.data.project_count} 个项目、${res.data.pending_external_artifact_count} 个待外部 artifact 的 GEARS 回片${sampleStatus}。`
        : `当前没有待外部回片的 GEARS job，已复制空队列 ${label}${sampleStatus}。`
    } else {
      error.value = res.error?.message ?? '导出 GEARS 外部回片队列失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '复制 GEARS 外部回片队列失败'
  } finally {
    gearsExternalQueueCopyMode.value = ''
  }
}

function gearsExternalQueueClipboardText(
  queue: GearsExternalCallbackHandoffQueuePackage,
  mode: GearsExternalQueueCopyMode,
): string {
  if (mode === 'markdown') return queue.markdown
  if (mode === 'payload') return JSON.stringify(queue.callback_batch_sample, null, 2)
  return [
    '# GEARS/Seedance system external callback preflight/import',
    '# 1. Replace every placeholder outputUrl with a real public http(s) external provider artifact URL.',
    '# 2. Do not import local_acceptance, localhost/private network, file, or gears.example URLs.',
    '# 3. Run preflight first. Run import only after blocked=false and blocking_count=0.',
    '',
    'cat > /tmp/gears-system-external-callbacks.json <<\'JSON\'',
    JSON.stringify(queue.callback_batch_sample, null, 2),
    'JSON',
    '',
    queue.system_preflight_curl.replace(
      '--data-binary @gears-system-external-callbacks.json',
      '--data-binary @/tmp/gears-system-external-callbacks.json',
    ),
    '',
    '# Import only after preflight passes with blocked=false.',
    queue.system_safe_import_curl.replace(
      '--data-binary @gears-system-external-callbacks.json',
      '--data-binary @/tmp/gears-system-external-callbacks.json',
    ),
  ].join('\n')
}

async function loadGeneratedGovernancePlan() {
  loadingGeneratedGovernance.value = true
  const res = await getStoryAgentGeneratedGovernancePlan({ limit: 12 })
  if (res.ok && res.data) {
    generatedGovernancePlan.value = res.data
  } else {
    error.value = res.error?.message ?? '刷新 generated 治理计划失败'
  }
  loadingGeneratedGovernance.value = false
}

async function runGeneratedGovernanceDryRun() {
  runningGeneratedGovernance.value = true
  const res = await runStoryAgentGeneratedGovernance({
    dry_run: true,
    max_targets: 20,
    action_keys: [
      'restore_or_relink_series_story_refs',
      'archive_or_rebuild_series_fixtures',
      'repair_story_project_refs',
    ],
  })
  if (res.ok && res.data) {
    generatedGovernanceRun.value = res.data
    projectMessage.value = `Generated dry-run 清单已生成：planned ${res.data.planned_target_count}，blocked ${res.data.blocked_target_count}`
  } else {
    error.value = res.error?.message ?? '生成 generated dry-run 清单失败'
  }
  runningGeneratedGovernance.value = false
}

async function loadGeneratedHealth() {
  loadingGeneratedHealth.value = true
  const res = await getStoryAgentGeneratedHealth({ limit: 12 })
  if (res.ok && res.data) {
    generatedHealth.value = res.data
  } else {
    error.value = res.error?.message ?? '刷新生成项目体检失败'
  }
  loadingGeneratedHealth.value = false
}

async function runPortfolioAutomation() {
  runningPortfolioAutomation.value = true
  error.value = ''
  projectMessage.value = ''
  const res = await runProductionReadinessPortfolioAutomation({
    dry_run: false,
    include_archived_series: showArchivedSeries.value,
    max_targets: 5,
    per_target_max_steps: 4,
    stop_on_error: false,
  })
  if (res.ok && res.data) {
    await loadProjects()
    productionPortfolio.value = res.data.after_portfolio
    projectMessage.value = `队列自动化完成：执行 ${res.data.executed_target_count} 个，跳过 ${res.data.skipped_target_count} 个，失败 ${res.data.failed_target_count} 个`
  } else {
    error.value = res.error?.message ?? '运行队列安全自动化失败'
  }
  runningPortfolioAutomation.value = false
}

onMounted(async () => {
  await loadProjects()
})
</script>

<style scoped>
.projects-page {
  max-width: 1180px;
  margin: 0 auto;
}

.projects-page__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 20px;
}

.projects-page__header-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

.projects-page__title {
  margin: 0 0 6px 0;
  font-size: 28px;
  color: #22313f;
}

.projects-page__desc {
  margin: 0;
  color: #66727f;
  line-height: 1.6;
}

.projects-page__cta {
  flex: 0 0 auto;
  padding: 10px 14px;
  border-radius: 4px;
  background: #2980b9;
  color: #fff;
  text-decoration: none;
  font-size: 14px;
}

.projects-page__cta--secondary {
  border: 1px solid #2980b9;
  background: #fff;
  color: #2980b9;
}

.projects-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 20px;
}

.projects-page__portfolio {
  margin-bottom: 18px;
  padding: 14px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #fbfcfd;
}

.projects-page__portfolio-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.projects-page__portfolio-head-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  align-items: center;
}

.projects-page__portfolio-head h2 {
  margin: 0 0 4px 0;
  color: #22313f;
  font-size: 17px;
}

.projects-page__portfolio-head p {
  margin: 0;
  color: #66727f;
  font-size: 13px;
}

.projects-page__portfolio-metrics,
.projects-page__portfolio-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.projects-page__portfolio-metrics span,
.projects-page__metric-link,
.projects-page__portfolio-actions span {
  padding: 5px 8px;
  border: 1px solid #d7dee5;
  border-radius: 4px;
  background: #fff;
  color: #33475b;
  font-size: 12px;
  font-weight: 700;
}

.projects-page__metric-link {
  text-decoration: none;
}

.projects-page__mvp-lanes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.projects-page__mvp-progress {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.projects-page__mvp-progress-card {
  min-height: 132px;
  padding: 10px 10px 10px 12px;
  border: 1px solid #d7dee5;
  border-left: 4px solid #6fb3d2;
  border-radius: 4px;
  background: #fff;
}

.projects-page__mvp-progress-card--gears_end_to_end_acceptance {
  border-left-color: #f0b34f;
}

.projects-page__mvp-progress-card--generated_governance {
  border-left-color: #43a782;
}

.projects-page__mvp-progress-card--mcp_story_agent_loop {
  border-left-color: #5f7ed8;
}

.projects-page__mvp-progress-card--production_delivery_contract {
  border-left-color: #b56bb7;
}

.projects-page__mvp-progress-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.projects-page__mvp-progress-head strong {
  color: #22313f;
  font-size: 17px;
}

.projects-page__mvp-progress-card h3 {
  margin: 0 0 6px 0;
  color: #22313f;
  font-size: 14px;
}

.projects-page__mvp-progress-card p,
.projects-page__mvp-progress-card small {
  color: #52616f;
  font-size: 12px;
  line-height: 1.45;
}

.projects-page__mvp-progress-card p {
  margin: 0 0 6px 0;
}

.projects-page__mvp-progress-card small {
  display: block;
  color: #8a5b00;
  font-weight: 700;
}

.projects-page__mvp-lane {
  min-height: 142px;
  padding: 10px 10px 10px 12px;
  border-left: 4px solid #9cc8e6;
  border-radius: 4px;
  background: #fff;
}

.projects-page__mvp-lane-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.projects-page__mvp-lane-head strong {
  color: #33475b;
  font-size: 12px;
}

.projects-page__mvp-lane h3,
.projects-page__mvp-column h3 {
  margin: 0 0 6px 0;
  color: #22313f;
  font-size: 14px;
}

.projects-page__mvp-lane p,
.projects-page__mvp-lane small {
  color: #52616f;
  font-size: 12px;
  line-height: 1.45;
}

.projects-page__mvp-lane p {
  margin: 0 0 6px 0;
}

.projects-page__mvp-lane small {
  display: block;
}

.projects-page__mvp-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}

.projects-page__mvp-column {
  padding-top: 10px;
  border-top: 1px solid #d7dee5;
}

.projects-page__mvp-column ol {
  display: grid;
  gap: 7px;
  margin: 0;
  padding-left: 20px;
}

.projects-page__mvp-column li {
  color: #52616f;
  font-size: 12px;
  line-height: 1.45;
}

.projects-page__mvp-column a {
  color: #22313f;
  font-weight: 800;
  text-decoration: none;
}

.projects-page__mvp-column a:hover {
  color: #2980b9;
}

.projects-page__mvp-column span {
  display: block;
  margin-top: 2px;
  color: #66727f;
}

.projects-page__portfolio-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.projects-page__portfolio-item {
  min-height: 156px;
  padding: 11px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #fff;
}

.projects-page__portfolio-item-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.projects-page__portfolio-item-head strong {
  color: #33475b;
  font-size: 13px;
}

.projects-page__portfolio-title {
  display: block;
  margin-bottom: 7px;
  color: #22313f;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.35;
  text-decoration: none;
}

.projects-page__portfolio-title:hover {
  color: #2980b9;
}

.projects-page__portfolio-item p {
  margin: 4px 0;
  color: #52616f;
  font-size: 12px;
  line-height: 1.45;
}

.projects-page__portfolio-item small {
  display: block;
  margin-top: 7px;
  color: #66727f;
  font-size: 11px;
}

.projects-page__readiness-badge {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 3px 7px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 800;
}

.projects-page__readiness-badge--ready {
  background: #eaf7ef;
  color: #1e7e45;
}

.projects-page__readiness-badge--needs_action {
  background: #fff7e6;
  color: #9a6700;
}

.projects-page__readiness-badge--blocked {
  background: #fdecec;
  color: #b42318;
}

.projects-page__readiness-badge--planned {
  background: #eef2f6;
  color: #425466;
}

.projects-page__readiness-badge--production_gap {
  background: #fff7e6;
  color: #9a6700;
}

.projects-page__readiness-badge--interrupted {
  background: #fdecec;
  color: #b42318;
}

.projects-page__priority-badge {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 3px 7px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 900;
}

.projects-page__priority-badge--p0 {
  background: #fdecec;
  color: #b42318;
}

.projects-page__priority-badge--p1 {
  background: #fff7e6;
  color: #9a6700;
}

.projects-page__priority-badge--p2 {
  background: #eaf4fb;
  color: #236192;
}

.projects-page__priority-badge--p3 {
  background: #eaf7ef;
  color: #1e7e45;
}

.projects-page__bulkbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  min-height: 44px;
  margin-bottom: 18px;
  padding: 9px 12px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #f8fafb;
}

.projects-page__bulkbar--active {
  border-color: #9cc8e6;
  background: #f2f8fd;
  box-shadow: 0 6px 18px rgba(41, 128, 185, 0.08);
}

.projects-page__bulk-check {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  color: #33475b;
  font-size: 14px;
  font-weight: 700;
}

.projects-page__bulk-check input,
.projects-page__row-check input,
.projects-page__story-table th input {
  width: 18px;
  height: 18px;
}

.projects-page__bulk-summary {
  margin: 0;
  color: #66727f;
  font-size: 13px;
}

.projects-page__bulk-preview {
  display: block;
  margin-top: 3px;
  color: #33475b;
  font-weight: 600;
}

.projects-page__bulk-warning {
  display: block;
  margin-top: 3px;
  color: #a05f00;
  font-weight: 700;
}

.projects-page__bulk-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.projects-page__cleanup-actions {
  position: relative;
}

.projects-page__cleanup-summary {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 7px 10px;
  border: 1px solid #d7dee5;
  border-radius: 4px;
  background: #fff;
  color: #51606d;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  list-style: none;
}

.projects-page__cleanup-summary::-webkit-details-marker {
  display: none;
}

.projects-page__cleanup-summary::after {
  content: '▾';
  margin-left: 6px;
  color: #7c8894;
  font-size: 11px;
}

.projects-page__cleanup-actions[open] .projects-page__cleanup-summary::after {
  content: '▴';
}

.projects-page__cleanup-body {
  position: absolute;
  right: 0;
  z-index: 5;
  min-width: 170px;
  margin-top: 6px;
  padding: 8px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(31, 45, 61, 0.12);
}

.projects-page__muted-btn,
.projects-page__danger-btn {
  min-height: 34px;
  padding: 7px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.projects-page__muted-btn {
  border: 1px solid #d7dee5;
  background: #fff;
  color: #33475b;
}

.projects-page__muted-link {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 7px 10px;
  border: 1px solid #d7dee5;
  border-radius: 4px;
  background: #fff;
  color: #33475b;
  font-size: 13px;
  text-decoration: none;
}

.projects-page__danger-btn {
  border: 1px solid #d4473b;
  background: #d4473b;
  color: #fff;
}

.projects-page__muted-btn:disabled,
.projects-page__danger-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.projects-page__search,
.projects-page__select {
  padding: 10px 12px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  font-size: 14px;
}

.projects-page__search {
  flex: 1;
}

.projects-page__filters {
  flex: 0 0 auto;
}

.projects-page__filters[open] {
  flex-basis: 100%;
}

.projects-page__filters-summary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #fff;
  color: #33475b;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  list-style: none;
}

.projects-page__filters-summary::-webkit-details-marker {
  display: none;
}

.projects-page__filters-summary::after {
  content: '▾';
  color: #7c8894;
  font-size: 12px;
}

.projects-page__filters[open] .projects-page__filters-summary::after {
  content: '▴';
}

.projects-page__filters-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: #2980b9;
  color: #fff;
  font-size: 12px;
  line-height: 1;
}

.projects-page__filters-body {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  padding: 10px;
  border: 1px solid #edf1f5;
  border-radius: 6px;
  background: #f8fafb;
}

.projects-page__filter-reset {
  min-height: 40px;
}

.projects-page__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 10px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  color: #33475b;
  font-size: 14px;
  white-space: nowrap;
}

.projects-page__toggle input {
  width: 15px;
  height: 15px;
}

.projects-page__content {
  display: grid;
  gap: 26px;
}

.projects-page__section {
  display: grid;
  gap: 12px;
}

.projects-page__section-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-end;
}

.projects-page__section-head h2 {
  margin: 0 0 4px 0;
  color: #22313f;
  font-size: 20px;
}

.projects-page__section-head p {
  margin: 0;
  color: #7c8894;
  font-size: 13px;
}

.projects-page__text-link {
  color: #2980b9;
  font-size: 14px;
  text-decoration: none;
  white-space: nowrap;
}

.projects-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.projects-page__story-table-wrap {
  overflow-x: auto;
  border: 1px solid #d9e2ea;
  border-radius: 8px;
  background: #fff;
}

.projects-page__story-table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
}

.projects-page__story-table th,
.projects-page__story-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #edf1f5;
  color: #34495e;
  font-size: 14px;
  text-align: left;
  vertical-align: top;
}

.projects-page__story-table th {
  background: #f8fafb;
  color: #51606d;
  font-size: 12px;
  font-weight: 700;
}

.projects-page__story-table tbody tr:last-child td {
  border-bottom: 0;
}

.projects-page__story-row--selected td {
  background: #f4f9fd;
}

.projects-page__select-col {
  position: sticky;
  left: 0;
  z-index: 2;
  width: 70px;
  min-width: 70px;
  background: #fff;
  text-align: center !important;
}

.projects-page__story-table th.projects-page__select-col {
  z-index: 3;
  background: #f8fafb;
}

.projects-page__story-row--selected .projects-page__select-col {
  background: #f4f9fd;
}

.projects-page__actions-col {
  width: 138px;
  text-align: right !important;
}

.projects-page__table-select-all,
.projects-page__row-check {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 44px;
  min-height: 34px;
  cursor: pointer;
  color: #51606d;
  font-size: 11px;
  font-weight: 700;
}

.projects-page__table-select-all input,
.projects-page__row-check input {
  margin: 0;
}

.projects-page__story-row--selected .projects-page__row-check {
  color: #2b78b7;
}

.projects-page__story-title {
  color: #22313f;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.35;
  text-decoration: none;
}

.projects-page__story-title:hover {
  color: #2980b9;
}

.projects-page__story-subtitle,
.projects-page__story-logline {
  margin: 5px 0 0;
  color: #6b7884;
  line-height: 1.45;
}

.projects-page__story-logline {
  max-width: 460px;
  color: #40566c;
}

.projects-page__cell-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.projects-page__date-cell {
  white-space: nowrap;
}

.projects-page__row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  align-items: center;
}

.projects-page__card {
  position: relative;
  display: block;
  padding: 16px 16px 16px 44px;
  border-radius: 8px;
  border: 1px solid #d9e2ea;
  background: #fff;
  text-decoration: none;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}

.projects-page__card--series {
  padding-left: 16px;
}

.projects-page__card--archived {
  background: #fafbfc;
}

.projects-page__card--selected {
  border-color: #2980b9;
  background: #f6fbff;
}

.projects-page__card-select {
  position: absolute;
  top: 18px;
  left: 16px;
  display: inline-flex;
  align-items: center;
}

.projects-page__card:hover {
  border-color: #2980b9;
  box-shadow: 0 8px 24px rgba(41, 128, 185, 0.08);
  transform: translateY(-1px);
}

.projects-page__card-link {
  display: block;
  color: inherit;
  text-decoration: none;
}

.projects-page__card-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.projects-page__status-badge,
.projects-page__video-type,
.projects-page__contract-chip,
.projects-page__material-gate {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.projects-page__status-badge {
  background: #eef3f7;
  color: #51606d;
}

.projects-page__status-badge[data-status='draft'] {
  background: #eef6ff;
  color: #2b78b7;
}

.projects-page__status-badge[data-status='series'] {
  background: #eaf7ef;
  color: #1f7a44;
}

.projects-page__video-type {
  background: #f7f3eb;
  color: #8d5b10;
}

.projects-page__contract-chip {
  background: #eef6ff;
  color: #2b6f9e;
}

.projects-page__contract-chip--truth {
  background: #f3f6f8;
  color: #52616f;
}

.projects-page__material-gate {
  font-weight: 700;
}

.projects-page__material-gate--ready {
  background: #eaf7ef;
  color: #1f7a44;
}

.projects-page__material-gate--risk {
  background: #fff7e8;
  color: #9a6100;
}

.projects-page__material-gate--blocked {
  background: #fdecea;
  color: #b13b2e;
}

.projects-page__material-gate--unknown {
  background: #eef3f7;
  color: #667887;
}

.projects-page__card-title {
  margin: 0 0 8px 0;
  color: #22313f;
  font-size: 22px;
  line-height: 1.25;
}

.projects-page__source {
  margin: 0 0 8px 0;
  color: #6b7884;
  font-size: 14px;
}

.projects-page__logline {
  margin: 0 0 12px 0;
  color: #2f4358;
  font-size: 15px;
  line-height: 1.6;
}

.projects-page__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: #7c8894;
  font-size: 13px;
}

.projects-page__meta-warning {
  color: #a05f00;
  font-weight: 700;
}

.projects-page__meta-quality {
  font-weight: 700;
}

.projects-page__meta-quality--pass {
  color: #1b7f4a;
}

.projects-page__meta-quality--warn {
  color: #b13b2e;
}

.projects-page__meta-video {
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 700;
}

.projects-page__meta-video--ready {
  background: #d5f5e3;
  color: #1b7f4a;
}

.projects-page__meta-video--processing {
  background: #eaf2f8;
  color: #2b78b7;
}

.projects-page__meta-video--failed {
  background: #fdecea;
  color: #b13b2e;
}

.projects-page__card-actions {
  display: grid;
  gap: 8px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #edf1f5;
}

.projects-page__card-primary-actions,
.projects-page__series-actions-body {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.projects-page__series-actions {
  text-align: right;
}

.projects-page__series-actions-summary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 6px 9px;
  border: 1px solid transparent;
  border-radius: 4px;
  color: #5c6b78;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  list-style: none;
}

.projects-page__series-actions-summary::-webkit-details-marker {
  display: none;
}

.projects-page__series-actions-summary::after {
  content: '▾';
  font-size: 11px;
}

.projects-page__series-actions[open] .projects-page__series-actions-summary {
  border-color: #d7dee5;
  background: #f8fafc;
  color: #33475b;
}

.projects-page__series-actions[open] .projects-page__series-actions-summary::after {
  content: '▴';
}

.projects-page__series-actions-body {
  margin-top: 8px;
}

.projects-page__series-actions:not([open]) .projects-page__series-actions-body {
  display: none;
}

.projects-page__delete-btn {
  padding: 7px 10px;
  border: 1px solid #f0c4bd;
  border-radius: 4px;
  background: #fff;
  color: #b13b2e;
  cursor: pointer;
  font-size: 13px;
}

.projects-page__delete-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.projects-page__loading,
.projects-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: #7f8c8d;
}

.projects-page__spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #ecf0f1;
  border-top: 3px solid #2980b9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.projects-page__error {
  padding: 10px 14px;
  background: #fdecea;
  color: #c0392b;
  border-radius: 4px;
  font-size: 14px;
  margin-bottom: 16px;
}

.projects-page__message {
  padding: 10px 14px;
  background: #eaf7ef;
  color: #1f7a44;
  border-radius: 4px;
  font-size: 14px;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 720px) {
  .projects-page__header,
  .projects-page__toolbar,
  .projects-page__bulkbar {
    flex-direction: column;
    align-items: stretch;
  }

  .projects-page__cta,
  .projects-page__header-actions,
  .projects-page__search,
  .projects-page__select,
  .projects-page__filters,
  .projects-page__filters-summary,
  .projects-page__toggle,
  .projects-page__bulk-actions,
  .projects-page__muted-btn,
  .projects-page__danger-btn {
    width: 100%;
  }

  .projects-page__bulk-actions {
    flex-direction: column;
  }

  .projects-page__cleanup-actions,
  .projects-page__cleanup-summary,
  .projects-page__cleanup-body {
    width: 100%;
  }

  .projects-page__cleanup-body {
    position: static;
    box-shadow: none;
  }

  .projects-page__filters-body {
    display: grid;
    grid-template-columns: 1fr;
  }

  .projects-page__bulk-summary {
    order: -1;
  }

  .projects-page__card-actions,
  .projects-page__card-primary-actions,
  .projects-page__series-actions-body {
    align-items: stretch;
    flex-direction: column;
  }

  .projects-page__card-primary-actions .projects-page__muted-link,
  .projects-page__card-primary-actions .projects-page__muted-btn,
  .projects-page__card-primary-actions .projects-page__delete-btn,
  .projects-page__series-actions-summary {
    justify-content: center;
    width: 100%;
  }

  .projects-page__series-actions {
    text-align: left;
  }

  .projects-page__header-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .projects-page__section-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
