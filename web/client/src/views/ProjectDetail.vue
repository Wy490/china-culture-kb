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
              · 待上传素材 {{ productionBoard.seedance_asset_report.upload_required_count }}
              · Seedance 完成 {{ seedanceShotStats.ready }}/{{ seedanceShotStats.total }}
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
              :disabled="productionBoardRepairBusy || exportingProductionBoard"
              @click="submitProductionBoardRepairAndExport"
            >
              {{ repairingAndExportingProductionBoard ? '修复落盘中…' : '修复并落盘' }}
            </button>
            <button
              class="project-detail-page__action-btn project-detail-page__action-btn--primary"
              :disabled="productionBoardRepairBusy || exportingProductionBoard"
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
        <div class="project-detail-page__seedance-shot-ledger">
          <div>
            <strong>Seedance Shot Ledger</strong>
            <p>
              {{ seedanceShotStats.total }} 个镜头
              · 已提交 {{ seedanceShotStats.submitted }}
              · 处理中 {{ seedanceShotStats.processing }}
              · 已完成 {{ seedanceShotStats.ready }}
              · 失败 {{ seedanceShotStats.failed }}
            </p>
          </div>
          <div class="project-detail-page__seedance-shot-ledger-stats">
            <span>待提交 {{ seedanceShotStats.prompt_exported }}</span>
            <span>跳过 {{ seedanceShotStats.skipped }}</span>
          </div>
          <div class="project-detail-page__seedance-provider-config">
            <span v-if="loadingSeedanceProviderAdapterConfig">adapter 配置读取中</span>
            <span v-else-if="seedanceProviderAdapterConfigError">
              adapter 配置读取失败
            </span>
            <template v-else-if="seedanceProviderAdapterConfig">
              <span :class="{ 'project-detail-page__seedance-provider-chip--ready': seedanceProviderAdapterConfig.ready_for_submit_adapter }">
                submit adapter {{ seedanceProviderAdapterConfig.ready_for_submit_adapter ? '已配置' : '未配置' }}
              </span>
              <span :class="{ 'project-detail-page__seedance-provider-chip--ready': seedanceProviderAdapterConfig.ready_for_poll_adapter }">
                poll adapter {{ seedanceProviderAdapterConfig.ready_for_poll_adapter ? '已配置' : '未配置' }}
              </span>
              <span>submit timeout {{ seedanceProviderAdapterConfig.submit_timeout_ms }}ms</span>
              <span>poll timeout {{ seedanceProviderAdapterConfig.poll_timeout_ms }}ms</span>
              <span>
                token {{
                  seedanceProviderAdapterConfig.submit_token_configured || seedanceProviderAdapterConfig.shared_token_configured
                    ? '已配置'
                    : '未配置'
                }}
              </span>
            </template>
          </div>
          <div v-if="latestSeedanceProviderQueueBatch" class="project-detail-page__seedance-provider-queue">
            <span>队列 {{ latestSeedanceProviderQueueBatch.queue_id }}</span>
            <span>{{ latestSeedanceProviderQueueBatch.provider }}</span>
            <span>{{ seedanceQueuePriorityLabel(latestSeedanceProviderQueueBatch.priority) }}</span>
            <span>{{ latestSeedanceProviderQueueBatch.submitted_count }} 个任务</span>
            <span>{{ formatDate(latestSeedanceProviderQueueBatch.updated_at) }}</span>
          </div>
          <div v-if="seedanceProviderOverview" class="project-detail-page__seedance-provider-overview">
            <div class="project-detail-page__seedance-provider-overview-head">
              <strong>Provider 队列健康</strong>
              <button
                class="project-detail-page__repair-task-btn"
                :disabled="loadingSeedanceProviderOverview"
                @click="loadSeedanceProviderOverview(true)"
              >
                {{ loadingSeedanceProviderOverview ? '刷新中…' : '刷新' }}
              </button>
            </div>
            <div class="project-detail-page__seedance-provider-overview-metrics">
              <span>批次 {{ seedanceProviderOverview.batch_count }}</span>
              <span>活跃 {{ seedanceProviderOverview.active_count }}</span>
              <span>完成 {{ seedanceProviderOverview.ready_count }}</span>
              <span>失败 {{ seedanceProviderOverview.failed_count }}</span>
              <span>可重试 {{ seedanceProviderOverview.retryable_count }}</span>
              <span>超时 {{ seedanceProviderOverview.timed_out_count }}</span>
              <span>注意项 {{ seedanceProviderOverview.attention_count }}</span>
            </div>
            <div
              v-if="seedanceProviderOverview.attention_items.length"
              class="project-detail-page__seedance-provider-attention"
            >
              <small
                v-for="item in seedanceProviderOverview.attention_items.slice(0, 3)"
                :key="`${item.shot_id}-${item.status}-${item.updated_at}`"
                :title="item.suggested_action"
              >
                {{ seedanceProviderAttentionText(item) }}
              </small>
            </div>
            <details
              v-if="seedanceProviderRetryPlan"
              class="project-detail-page__seedance-provider-retry-plan"
            >
              <summary>
                人工重试策略 · 候选 {{ seedanceProviderRetryPlan.candidate_count }}
                · 可重提 {{ seedanceProviderRetryPlan.resubmittable_count }}
                · 需先处理 {{ seedanceProviderRetryPlan.blocked_count }}
              </summary>
              <div class="project-detail-page__seedance-ledger-action-row">
                <button
                  class="project-detail-page__repair-task-btn"
                  :disabled="loadingSeedanceProviderRetryPlan"
                  @click="loadSeedanceProviderRetryPlan(true)"
                >
                  {{ loadingSeedanceProviderRetryPlan ? '刷新中…' : '刷新策略' }}
                </button>
                <button
                  class="project-detail-page__repair-task-btn"
                  :disabled="!seedanceProviderRetryPlan.candidate_count"
                  @click="exportSeedanceProviderRetryPlanMarkdown"
                >
                  导出策略 MD
                </button>
                <button
                  class="project-detail-page__repair-task-btn"
                  :disabled="submittingSeedanceProviderRetryPlan || seedanceProviderRetryPlan.resubmittable_count === 0"
                  @click="submitSeedanceProviderRetryPlan"
                >
                  {{ submittingSeedanceProviderRetryPlan ? '提交中…' : '提交可重提' }}
                </button>
              </div>
              <div class="project-detail-page__seedance-provider-overview-metrics">
                <span>高优先 {{ seedanceProviderRetryPlan.high_priority_count }}</span>
                <span>失败 {{ seedanceProviderRetryPlan.reason_counts.failed }}</span>
                <span>超时 {{ seedanceProviderRetryPlan.reason_counts.timed_out }}</span>
                <span>缺视频 {{ seedanceProviderRetryPlan.reason_counts.ready_missing_video }}</span>
              </div>
              <div
                v-if="seedanceProviderRetryPlan.candidates.length"
                class="project-detail-page__seedance-provider-attention"
              >
                <small
                  v-for="item in seedanceProviderRetryPlan.candidates.slice(0, 4)"
                  :key="`${item.shot_id}-${item.retry_reason}-${item.updated_at}`"
                  :title="item.block_reason ?? item.suggested_action"
                >
                  {{ seedanceProviderRetryCandidateText(item) }}
                </small>
              </div>
            </details>
          </div>
          <details class="project-detail-page__seedance-shot-ledger-actions">
            <summary>回传与重试</summary>
            <textarea
              v-model="seedanceCallbackImportText"
              class="project-detail-page__seedance-callback-input"
              rows="5"
              placeholder="JSON callbacks"
            />
            <div class="project-detail-page__seedance-ledger-action-row">
              <button
                class="project-detail-page__repair-task-btn"
                :disabled="importingSeedanceCallbacks"
                @click="importSeedanceCallbacks"
              >
                {{ importingSeedanceCallbacks ? '导入中…' : '导入回传' }}
              </button>
              <button
                class="project-detail-page__repair-task-btn"
                :disabled="batchingSeedanceShots"
                @click="markPendingSeedanceShotsSubmitted"
              >
                {{ batchingSeedanceShots ? '流转中…' : '待提交→已提交' }}
              </button>
              <button
                class="project-detail-page__repair-task-btn"
                :disabled="submittingSeedanceProvider || submittingSeedanceProviderAdapter"
                @click="submitSeedanceProviderJobs(false)"
              >
                {{ submittingSeedanceProvider ? '提交中…' : '提交到 Seedance' }}
              </button>
              <button
                class="project-detail-page__repair-task-btn"
                :disabled="submittingSeedanceProvider || submittingSeedanceProviderAdapter || !seedanceProviderAdapterConfig?.ready_for_submit_adapter"
                @click="submitSeedanceProviderJobs(true)"
              >
                {{ submittingSeedanceProviderAdapter ? '提交中…' : '提交 adapter' }}
              </button>
              <button
                class="project-detail-page__repair-task-btn"
                :disabled="pollingSeedanceProvider || !seedanceProviderAdapterConfig?.ready_for_poll_adapter"
                @click="pollSeedanceProviderJobs"
              >
                {{ pollingSeedanceProvider ? '轮询中…' : '轮询 provider' }}
              </button>
              <button
                class="project-detail-page__repair-task-btn"
                :disabled="recoveringSeedanceProvider"
                @click="recoverSeedanceProviderTimeouts"
              >
                {{ recoveringSeedanceProvider ? '检查中…' : '标记超时失败' }}
              </button>
              <button
                class="project-detail-page__repair-task-btn"
                :disabled="autoSelectingSeedanceShots"
                @click="autoSelectSeedanceShotVersions"
              >
                {{ autoSelectingSeedanceShots ? '择优中…' : '自动择优' }}
              </button>
              <button
                class="project-detail-page__repair-task-btn"
                :disabled="exportingSeedanceRetryPackage"
                @click="exportSeedanceRetryPackageMarkdown"
              >
                重试包 MD
              </button>
              <button
                class="project-detail-page__repair-task-btn"
                :disabled="exportingSeedanceRetryPackage"
                @click="exportSeedanceRetryPackageJson"
              >
                重试包 JSON
              </button>
            </div>
          </details>
        </div>
        <div class="project-detail-page__seedance-asset-report">
          <div>
            <strong>Seedance 素材缺口</strong>
            <p>
              {{ productionBoard.seedance_asset_report.total_asset_count }} 个素材
              · 待上传 {{ productionBoard.seedance_asset_report.upload_required_count }}
              · 缺槽位 {{ productionBoard.seedance_asset_report.missing_reference_slot_count }}
              · 受影响镜头 {{ productionBoard.seedance_asset_report.unbound_shot_count }}/{{ productionBoard.seedance_asset_report.shot_binding_count }}
            </p>
            <details class="project-detail-page__seedance-asset-import">
              <summary>批量导入素材</summary>
              <textarea
                v-model="seedanceAssetBatchImportText"
                class="project-detail-page__seedance-asset-import-textarea"
                rows="4"
                placeholder='[{"asset_id":"seedance-asset-character-xxx","file_id":"seedance-file-001","upload_status":"uploaded"}]'
              />
              <div class="project-detail-page__seedance-ledger-action-row">
                <button
                  class="project-detail-page__repair-task-btn"
                  :disabled="importingSeedanceAssets"
                  @click="importSeedanceAssetBatchFromText"
                >
                  {{ importingSeedanceAssets ? '导入中…' : '导入素材清单' }}
                </button>
              </div>
            </details>
            <details class="project-detail-page__seedance-asset-import">
              <summary>跨项目素材库</summary>
              <div class="project-detail-page__seedance-global-assets">
                <span>
                  {{ loadingSeedanceGlobalAssets ? '加载中…' : `${seedanceGlobalAssets.length} 个可复用素材` }}
                </span>
                <button
                  class="project-detail-page__repair-task-btn"
                  :disabled="loadingSeedanceGlobalAssets"
                  @click="loadSeedanceGlobalAssets(true)"
                >
                  刷新
                </button>
              </div>
              <div
                v-if="seedanceGlobalAssets.length"
                class="project-detail-page__seedance-global-preview"
              >
                <small
                  v-for="source in seedanceGlobalAssets.slice(0, 6)"
                  :key="source.global_asset_id"
                >
                  {{ source.kind }} · {{ source.label }} · {{ source.source_project_title }}
                </small>
              </div>
            </details>
          </div>
          <div class="project-detail-page__seedance-asset-items">
            <article
              v-for="asset in productionBoard.seedance_asset_report.assets.slice(0, 8)"
              :key="asset.asset_id"
              :class="`project-detail-page__seedance-asset-item--${asset.status}`"
            >
              <span>{{ asset.reference_slot ?? '未分配槽位' }} · {{ asset.label }} · {{ seedanceAssetStatusLabel(asset.status) }}</span>
              <small v-if="asset.is_bound">{{ seedanceAssetBindingValue(asset) }}</small>
              <template v-else>
                <input
                  v-model="seedanceAssetFileInputs[asset.asset_id]"
                  class="project-detail-page__seedance-asset-input"
                  placeholder="URL / file ID"
                >
                <button
                  class="project-detail-page__repair-task-btn"
                  :disabled="bindingSeedanceAssetId === asset.asset_id"
                  @click="bindSeedanceAsset(asset)"
                >
                  {{ bindingSeedanceAssetId === asset.asset_id ? '绑定中…' : '绑定' }}
                </button>
                <label class="project-detail-page__seedance-asset-upload">
                  <span>{{ uploadingSeedanceAssetId === asset.asset_id ? '上传中…' : '上传文件' }}</span>
                  <input
                    type="file"
                    :accept="seedanceAssetFileAccept(asset)"
                    :disabled="uploadingSeedanceAssetId === asset.asset_id"
                    @change="uploadSeedanceAssetFile(asset, $event)"
                  >
                </label>
                <div
                  v-if="matchingGlobalSeedanceAssets(asset).length"
                  class="project-detail-page__seedance-asset-source-list"
                >
                  <button
                    v-for="source in matchingGlobalSeedanceAssets(asset)"
                    :key="source.global_asset_id"
                    class="project-detail-page__seedance-asset-source-btn"
                    :disabled="reusingSeedanceAssetId === seedanceAssetReuseKey(asset, source)"
                    :title="seedanceGlobalAssetValue(source)"
                    @click="reuseGlobalSeedanceAsset(asset, source)"
                  >
                    {{ reusingSeedanceAssetId === seedanceAssetReuseKey(asset, source) ? '复用中…' : `复用 ${source.source_project_title}` }}
                  </button>
                </div>
              </template>
              <details
                v-if="seedanceAssetHistory(asset).length"
                class="project-detail-page__seedance-asset-history"
              >
                <summary>上传历史 {{ seedanceAssetHistory(asset).length }}</summary>
                <small
                  v-for="event in seedanceAssetHistory(asset)"
                  :key="event.event_id"
                >
                  {{ formatDate(event.created_at) }} · {{ seedanceAssetHistoryTypeLabel(event.event_type) }} · {{ seedanceAssetHistoryValue(event) }}
                </small>
              </details>
            </article>
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
          <details
            v-if="productionRepairSceneDiffs.length"
            class="project-detail-page__production-scene-diffs"
          >
            <summary>逐场景 diff · {{ productionRepairSceneDiffs.length }} 个场景</summary>
            <div class="project-detail-page__production-scene-diff-list">
              <section
                v-for="sceneDiff in productionRepairSceneDiffs"
                :key="sceneDiff.scene_id"
                class="project-detail-page__production-scene-diff"
              >
                <div class="project-detail-page__production-scene-diff-head">
                  <strong>场景 {{ sceneDiff.scene_id }} · {{ sceneDiff.title }}</strong>
                  <span>{{ sceneDiff.changed_fields.length }} 个字段</span>
                </div>
                <dl>
                  <div v-for="field in sceneDiff.changed_fields" :key="field.field">
                    <dt>{{ field.label }}</dt>
                    <dd>
                      <span>修复前</span>
                      <p>{{ field.before }}</p>
                    </dd>
                    <dd>
                      <span>修复后</span>
                      <p>{{ field.after }}</p>
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </details>
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
              <div class="project-detail-page__inline-repair-actions">
                <button
                  class="project-detail-page__repair-task-btn"
                  :disabled="productionBoardRepairBusy || exportingProductionBoard"
                  @click="submitProductionBoardCategoryRepair(issue)"
                >
                  {{ repairingProductionBoardScope === productionCategoryRepairKey(issue.category) ? '修复中…' : '修复此类' }}
                </button>
              </div>
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
            <div
              v-if="seedanceShotItem(shot.shot_id)"
              class="project-detail-page__seedance-shot-status"
              :class="`project-detail-page__seedance-shot-status--${seedanceShotItem(shot.shot_id)?.status}`"
            >
              <span>
                {{ seedanceShotStatusLabel(seedanceShotItem(shot.shot_id)?.status ?? 'not_started') }}
                · {{ formatDate(seedanceShotItem(shot.shot_id)?.updated_at ?? '') }}
              </span>
              <small v-if="seedanceShotItem(shot.shot_id)?.provider_job_id">
                job {{ seedanceShotItem(shot.shot_id)?.provider_job_id }}
              </small>
              <small v-if="seedanceShotItem(shot.shot_id)?.provider_queue_id">
                queue {{ seedanceShotItem(shot.shot_id)?.provider_queue_id }}
                <template v-if="seedanceShotItem(shot.shot_id)?.provider_queue_position">
                  #{{ seedanceShotItem(shot.shot_id)?.provider_queue_position }}
                </template>
              </small>
              <small v-if="seedanceShotItem(shot.shot_id)?.video_url">
                {{ seedanceShotItem(shot.shot_id)?.video_url }}
              </small>
              <small v-if="seedanceShotItem(shot.shot_id)?.versions.length">
                版本 {{ seedanceShotItem(shot.shot_id)?.versions.length }}
                <template v-if="seedanceShotItem(shot.shot_id)?.selected_version_id">
                  · 剪辑版 {{ seedanceShotItem(shot.shot_id)?.selected_version_id }}
                </template>
              </small>
              <details class="project-detail-page__seedance-shot-actions">
                <summary>更新状态</summary>
                <div class="project-detail-page__seedance-shot-action-row">
                  <input
                    v-model="seedanceShotJobInputs[shot.shot_id]"
                    class="project-detail-page__seedance-shot-input"
                    placeholder="job id"
                  >
                  <input
                    v-model="seedanceShotVideoInputs[shot.shot_id]"
                    class="project-detail-page__seedance-shot-input"
                    placeholder="video URL"
                  >
                  <button
                    class="project-detail-page__repair-task-btn"
                    :disabled="updatingSeedanceShotId === shot.shot_id"
                    @click="markSeedanceShot(shot, 'submitted')"
                  >
                    已提交
                  </button>
                  <button
                    class="project-detail-page__repair-task-btn"
                    :disabled="updatingSeedanceShotId === shot.shot_id"
                    @click="markSeedanceShot(shot, 'processing')"
                  >
                    处理中
                  </button>
                  <button
                    class="project-detail-page__repair-task-btn"
                    :disabled="updatingSeedanceShotId === shot.shot_id"
                    @click="markSeedanceShot(shot, 'ready')"
                  >
                    完成
                  </button>
                  <button
                    class="project-detail-page__repair-task-btn"
                    :disabled="updatingSeedanceShotId === shot.shot_id"
                    @click="markSeedanceShot(shot, 'failed')"
                  >
                    失败
                  </button>
                </div>
                <div
                  v-if="readySeedanceShotVersions(shot.shot_id).length"
                  class="project-detail-page__seedance-version-action-row"
                >
                  <button
                    v-for="version in readySeedanceShotVersions(shot.shot_id)"
                    :key="version.version_id"
                    class="project-detail-page__repair-task-btn"
                    :class="seedanceShotItem(shot.shot_id)?.selected_version_id === version.version_id ? 'project-detail-page__repair-task-btn--active' : ''"
                    :disabled="selectingSeedanceVersionId === `${shot.shot_id}:${version.version_id}`"
                    @click="selectSeedanceShotVersion(shot, version)"
                  >
                    {{ seedanceShotItem(shot.shot_id)?.selected_version_id === version.version_id ? '当前剪辑版' : '设为剪辑版' }}
                    · {{ version.version_id }}
                    <template v-if="typeof version.quality_score === 'number'">
                      · {{ version.quality_score }}分
                    </template>
                  </button>
                </div>
              </details>
            </div>
            <p>{{ shot.production_prompt }}</p>
            <details class="project-detail-page__seedance-prompt">
              <summary>Seedance 提示词</summary>
              <small v-if="shot.seedance_asset_slots.length">
                素材 slot：{{ shot.seedance_asset_slots.map(slot => `${slot.reference_slot}=${slot.label}`).join('；') }}
              </small>
              <small>
                素材校验：{{ shot.seedance_material_validation.total_file_count }}/{{ shot.seedance_material_validation.max_total_files }} 个文件
                · 复杂度 {{ shot.seedance_material_validation.prompt_complexity_score }}/100
                · {{ seedanceDurationRiskLabel(shot.seedance_material_validation.duration_risk) }}
              </small>
              <pre>{{ shot.seedance_prompt }}</pre>
              <small v-if="shot.seedance_validation_notes.length">{{ shot.seedance_validation_notes.join('；') }}</small>
            </details>
            <small v-if="shot.qa_flags.length > 0">{{ shot.qa_flags.join('；') }}</small>
            <div class="project-detail-page__inline-repair-actions">
              <button
                class="project-detail-page__repair-task-btn"
                :disabled="productionBoardRepairBusy || exportingProductionBoard"
                @click="submitProductionBoardShotRepair(shot)"
              >
                {{ repairingProductionBoardScope === productionShotRepairKey(shot.shot_id) ? '修复中…' : '修复此镜头' }}
              </button>
            </div>
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
          <div
            v-if="qualityFeedbackGroups.length > 0 || qualityActionSceneSummaries.length > 0"
            class="project-detail-page__quality-feedback"
          >
            <article
              v-for="group in qualityFeedbackGroups"
              :key="group.key"
              class="project-detail-page__quality-feedback-card"
            >
              <div>
                <strong>{{ group.label }}</strong>
                <span>{{ group.items.length }}</span>
              </div>
              <ul>
                <li v-for="item in group.items.slice(0, 3)" :key="item">{{ item }}</li>
              </ul>
            </article>
            <article
              v-if="qualityActionSceneSummaries.length > 0"
              class="project-detail-page__quality-feedback-card"
            >
              <div>
                <strong>修复场景</strong>
                <span>{{ qualityActionSceneSummaries.length }}</span>
              </div>
              <ul>
                <li v-for="item in qualityActionSceneSummaries.slice(0, 3)" :key="item.action_id">
                  {{ item.label }}：{{ item.scene_text }}
                </li>
              </ul>
            </article>
          </div>
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
        <div v-if="productionRepairHistory.length" class="project-detail-page__repair-history">
          <div class="project-detail-page__repair-history-head">
            <strong>Production Repair History</strong>
            <span>{{ productionRepairHistory.length }} 次生产修复</span>
          </div>
          <article
            v-for="version in productionRepairHistory"
            :key="version.version_id"
            class="project-detail-page__repair-history-item"
          >
            <div class="project-detail-page__repair-history-title">
              <strong>{{ version.version_id }}</strong>
              <span>{{ formatDate(version.created_at) }}</span>
            </div>
            <div class="project-detail-page__repair-history-metrics">
              <span>
                {{ version.production_board_repair_trace?.applied ? '已应用' : '未变化' }}
              </span>
              <span>
                阻断 {{ version.production_board_repair_trace?.before_blockers ?? 0 }} → {{ version.production_board_repair_trace?.after_blockers ?? 0 }}
              </span>
              <span>
                {{ productionStageLabel(version.production_board_repair_trace?.before_stage) }}
                →
                {{ productionStageLabel(version.production_board_repair_trace?.after_stage) }}
              </span>
              <span v-if="version.production_board_export">
                已落盘 {{ version.production_board_export.file_count }} 个文件
              </span>
              <span v-else>未记录交付包</span>
            </div>
            <div
              v-if="version.production_board_repair_trace?.applied_actions.length"
              class="project-detail-page__repair-history-actions"
            >
              <span
                v-for="action in version.production_board_repair_trace.applied_actions"
                :key="`${version.version_id}-${action}`"
              >
                {{ repairActionLabel(action) }}
              </span>
            </div>
            <p v-if="version.note">{{ version.note }}</p>
            <small v-if="version.production_board_export">
              交付时间 {{ formatDate(version.production_board_export.exported_at) }}
            </small>
          </article>
        </div>
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
  autoSelectProjectSeedanceShotVersions,
  exportProjectCurrentVersion,
  exportProjectProductionBoard,
  exportProjectSeedanceRetryPackage,
  getProjectSeedanceGlobalAssetLibrary,
  getProjectSeedanceProviderQueueOverview,
  getProjectSeedanceProviderRetryPlan,
  getProject,
  getProjectProductionBoard,
  importProjectSeedanceAssetBatch,
  importProjectSeedanceShotCallbacks,
  pollProjectSeedanceProviderQueue,
  recoverProjectSeedanceProviderQueue,
  repairAndExportProjectProductionBoard,
  repairProjectQuality,
  repairProjectProductionBoard,
  regenerateProjectScene,
  reuseProjectSeedanceAsset,
  selectProjectSeedanceShotVersion,
  submitProjectSeedanceProviderRetryPlan,
  submitProjectSeedanceShotsToProvider,
  updateProjectSeedanceAssetLibrary,
  updateProjectSeedanceShotStatus,
  updateProjectSeedanceShotStatuses,
  updateProjectSupplementTask,
  uploadProjectSeedanceAssetFile,
} from '@/api/projects'
import { getModelProfiles, getSeedanceProviderAdapterConfig } from '@/api/system'
import StoryResult from '@/components/StoryResult.vue'
import GearsWebhookStatus from '@/components/GearsWebhookStatus.vue'
import GearsVideoStatus from '@/components/GearsVideoStatus.vue'
import type {
  AIModelProfile,
  KnowledgeSupplementTaskStatus,
  SeedanceProviderAdapterConfigInfo,
  SeedanceAssetBatchImportRequest,
  SeedanceAssetBindingItem,
  SeedanceAssetHistoryEvent,
  SeedanceAssetLibraryItem,
  SeedanceGlobalAssetLibraryItem,
  SeedanceShotCallbackImportRequest,
  SeedanceShotLedgerItem,
  SeedanceShotProviderQueueOverviewResult,
  SeedanceShotProviderRetryPlanResult,
  SeedanceShotProductionStatus,
  SeedanceShotVideoVersion,
  StoryProjectDetail,
  StoryProjectStatus,
  StoryProjectVersionChangeType,
  StoryProjectVersionSummary,
  StoryProductionBoard,
  StoryProductionBoardExportPackage,
  StoryProductionBoardRepairResult,
  StoryProductionBoardRepairTask,
  StoryProductionBoardRepairTrace,
  StoryProductionBoardShotUnit,
  StoryProductionBoardSupervisionCategory,
  StoryProductionBoardSupervisionIssue,
  QualityRepairAction,
} from '@shared/types'

const route = useRoute()
const router = useRouter()
const MODEL_PROFILE_STORAGE_KEY = 'story-agent.model-profile-id'

type ProductionRepairHistoryItem = StoryProjectVersionSummary & {
  production_board_repair_trace: StoryProductionBoardRepairTrace
}

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
const repairingAndExportingProductionBoard = ref(false)
const repairingProductionBoardTaskId = ref('')
const repairingProductionBoardScope = ref('')
const seedanceAssetFileInputs = ref<Record<string, string>>({})
const bindingSeedanceAssetId = ref('')
const seedanceAssetBatchImportText = ref('')
const importingSeedanceAssets = ref(false)
const uploadingSeedanceAssetId = ref('')
const seedanceGlobalAssets = ref<SeedanceGlobalAssetLibraryItem[]>([])
const loadingSeedanceGlobalAssets = ref(false)
const reusingSeedanceAssetId = ref('')
const seedanceShotJobInputs = ref<Record<string, string>>({})
const seedanceShotVideoInputs = ref<Record<string, string>>({})
const updatingSeedanceShotId = ref('')
const seedanceCallbackImportText = ref('')
const importingSeedanceCallbacks = ref(false)
const exportingSeedanceRetryPackage = ref(false)
const batchingSeedanceShots = ref(false)
const autoSelectingSeedanceShots = ref(false)
const submittingSeedanceProvider = ref(false)
const submittingSeedanceProviderAdapter = ref(false)
const pollingSeedanceProvider = ref(false)
const recoveringSeedanceProvider = ref(false)
const loadingSeedanceProviderAdapterConfig = ref(false)
const seedanceProviderAdapterConfig = ref<SeedanceProviderAdapterConfigInfo | null>(null)
const seedanceProviderAdapterConfigError = ref('')
const loadingSeedanceProviderOverview = ref(false)
const seedanceProviderOverview = ref<SeedanceShotProviderQueueOverviewResult | null>(null)
const loadingSeedanceProviderRetryPlan = ref(false)
const seedanceProviderRetryPlan = ref<SeedanceShotProviderRetryPlanResult | null>(null)
const submittingSeedanceProviderRetryPlan = ref(false)
const selectingSeedanceVersionId = ref('')

const selectedModelProfile = computed(() => {
  return modelProfiles.value.find(profile => profile.id === selectedModelProfileId.value) ?? null
})

const currentQuality = computed(() => detail.value?.current_story.quality_report ?? null)

type QualityFeedbackGroup = {
  key: string
  label: string
  items: string[]
}

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

const qualityFeedbackGroups = computed<QualityFeedbackGroup[]>(() => {
  const quality = currentQuality.value
  if (!quality) return []
  return [
    {
      key: 'missing',
      label: '缺失要素',
      items: quality.missing_required_elements ?? [],
    },
    {
      key: 'weak-beats',
      label: '弱节拍',
      items: quality.weak_beats ?? [],
    },
    {
      key: 'forbidden',
      label: '不适配表达',
      items: quality.forbidden_patterns_found ?? [],
    },
    {
      key: 'repair',
      label: '修复建议',
      items: quality.repair_actions ?? [],
    },
  ].filter(group => group.items.length > 0)
})

const sceneTitleById = computed(() => {
  const scenes = detail.value?.current_story.scene_breakdown ?? []
  return new Map(scenes.map(scene => [scene.scene_id, scene.title]))
})

const qualityActionSceneSummaries = computed(() => {
  const actions = currentQuality.value?.repair_action_items ?? []
  return actions
    .filter(action => action.scene_ids.length > 0)
    .map(action => ({
      action_id: action.action_id,
      label: action.label,
      scene_text: action.scene_ids
        .map(sceneId => {
          const title = sceneTitleById.value.get(sceneId)
          return title ? `${sceneId} ${title}` : `${sceneId}`
        })
        .join('、'),
    }))
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
  return repairingProductionBoard.value
    || repairingAndExportingProductionBoard.value
    || repairingProductionBoardTaskId.value !== ''
    || repairingProductionBoardScope.value !== ''
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

const productionRepairSceneDiffs = computed(() => productionRepairTrace.value?.scene_diffs ?? [])

const productionRepairHistory = computed<ProductionRepairHistoryItem[]>(() => {
  return (detail.value?.versions ?? []).filter((version): version is ProductionRepairHistoryItem => {
    return version.change_type === 'production_board_repair' && Boolean(version.production_board_repair_trace)
  })
})

const seedanceShotById = computed(() => {
  return new Map((productionBoard.value?.seedance_shot_ledger.items ?? []).map(item => [item.shot_id, item]))
})

const seedanceShotStats = computed(() => {
  const stats: Record<SeedanceShotProductionStatus | 'total', number> = {
    total: 0,
    not_started: 0,
    prompt_exported: 0,
    submitted: 0,
    processing: 0,
    ready: 0,
    failed: 0,
    skipped: 0,
  }
  for (const item of productionBoard.value?.seedance_shot_ledger.items ?? []) {
    stats.total += 1
    stats[item.status] += 1
  }
  return stats
})

const latestSeedanceProviderQueueBatch = computed(() => {
  const queue = detail.value?.project.seedance_provider_queue
  if (!queue?.batches.length) return null
  return queue.batches.find(batch => batch.queue_id === queue.latest_queue_id) ?? queue.batches[queue.batches.length - 1]
})

const seedanceAssetLibraryById = computed(() => {
  return new Map((detail.value?.project.seedance_asset_library?.items ?? []).map(item => [item.asset_id, item]))
})

function seedanceShotItem(shotId: string): SeedanceShotLedgerItem | null {
  return seedanceShotById.value.get(shotId) ?? null
}

function readySeedanceShotVersions(shotId: string): SeedanceShotVideoVersion[] {
  return (seedanceShotItem(shotId)?.versions ?? [])
    .filter(version => version.status === 'ready' && Boolean(version.video_url))
    .sort((a, b) => {
      const aScore = typeof a.quality_score === 'number' ? a.quality_score : -1
      const bScore = typeof b.quality_score === 'number' ? b.quality_score : -1
      if (aScore !== bScore) return bScore - aScore
      return b.created_at.localeCompare(a.created_at)
    })
}

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

function productionStageLabel(stage?: string): string {
  const map: Record<string, string> = {
    blocked: '阻断',
    needs_repair: '需修复',
    ready: 'Ready',
  }
  return stage ? (map[stage] ?? stage) : '未记录'
}

function seedanceDurationRiskLabel(risk: string): string {
  const map: Record<string, string> = {
    ok: '节奏可控',
    dense: '信息偏密',
    overloaded: '时长过载',
  }
  return map[risk] ?? risk
}

function seedanceAssetStatusLabel(status: string): string {
  const map: Record<string, string> = {
    bound: '已绑定',
    missing_file: '缺文件',
    missing_reference_slot: '缺槽位',
  }
  return map[status] ?? status
}

function seedanceAssetBindingValue(asset: SeedanceAssetBindingItem): string {
  return asset.file_url
    ?? asset.file_id
    ?? asset.provider_asset_id
    ?? asset.local_path
    ?? asset.upload_status
    ?? '已绑定'
}

function seedanceAssetFileAccept(asset: SeedanceAssetBindingItem): string {
  if (asset.modality === 'video') return 'video/*'
  if (asset.modality === 'audio') return 'audio/*'
  return 'image/*'
}

function seedanceAssetReuseKey(asset: SeedanceAssetBindingItem, source: SeedanceGlobalAssetLibraryItem): string {
  return `${asset.asset_id}:${source.global_asset_id}`
}

function seedanceGlobalAssetValue(asset: SeedanceGlobalAssetLibraryItem): string {
  return asset.file_url
    ?? asset.file_id
    ?? asset.provider_asset_id
    ?? asset.local_path
    ?? asset.upload_status
    ?? '可复用'
}

function seedanceAssetLibraryItem(asset: SeedanceAssetBindingItem): SeedanceAssetLibraryItem | null {
  return seedanceAssetLibraryById.value.get(asset.asset_id) ?? null
}

function seedanceAssetHistory(asset: SeedanceAssetBindingItem): SeedanceAssetHistoryEvent[] {
  return [...(seedanceAssetLibraryItem(asset)?.history ?? [])]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 4)
}

function seedanceAssetHistoryTypeLabel(type: SeedanceAssetHistoryEvent['event_type']): string {
  const map: Record<SeedanceAssetHistoryEvent['event_type'], string> = {
    manual_bind: '手动绑定',
    batch_import: '批量导入',
    file_upload: '文件上传',
    cross_project_reuse: '跨项目复用',
  }
  return map[type]
}

function seedanceAssetHistoryValue(event: SeedanceAssetHistoryEvent): string {
  const value = event.file_url
    ?? event.file_id
    ?? event.provider_asset_id
    ?? event.local_path
    ?? event.upload_status
  const source = event.source_project_title ? ` · ${event.source_project_title}` : ''
  return `${value ?? '状态更新'}${source}`
}

function matchingGlobalSeedanceAssets(asset: SeedanceAssetBindingItem): SeedanceGlobalAssetLibraryItem[] {
  return seedanceGlobalAssets.value
    .filter(source => source.kind === asset.kind && source.label === asset.label)
    .slice(0, 3)
}

function seedanceQueuePriorityLabel(priority: string): string {
  const map: Record<string, string> = {
    low: '低优先',
    normal: '常规',
    high: '高优先',
  }
  return map[priority] ?? priority
}

function seedanceShotStatusLabel(status: SeedanceShotProductionStatus): string {
  const map: Record<SeedanceShotProductionStatus, string> = {
    not_started: '未开始',
    prompt_exported: '待提交',
    submitted: '已提交',
    processing: '处理中',
    ready: '已完成',
    failed: '失败',
    skipped: '跳过',
  }
  return map[status]
}

function seedanceFailureCategoryLabel(category?: string): string {
  const map: Record<string, string> = {
    asset_missing: '素材缺失',
    prompt_invalid: '提示词非法',
    content_policy: '内容审核',
    provider_timeout: '平台超时',
    provider_quota: '额度不足',
    provider_auth: '鉴权失败',
    provider_rate_limit: '平台限流',
    provider_server_error: '平台异常',
    network_error: '网络错误',
    unknown: '未知失败',
  }
  return category ? (map[category] ?? category) : '待复核'
}

function seedanceProviderAttentionText(item: SeedanceShotProviderQueueOverviewResult['attention_items'][number]): string {
  const queueText = item.provider_queue_position ? `#${item.provider_queue_position}` : ''
  const waitText = item.minutes_waiting > 0 ? ` · 等待 ${item.minutes_waiting} 分钟` : ''
  const failureText = item.status === 'failed'
    ? ` · ${seedanceFailureCategoryLabel(item.failure_category)}`
    : item.timed_out
      ? ' · 已超时'
      : ''
  return `${item.shot_id}${queueText ? ` ${queueText}` : ''} · ${seedanceShotStatusLabel(item.status)}${failureText}${waitText}`
}

function seedanceRetryReasonLabel(reason: SeedanceShotProviderRetryPlanResult['candidates'][number]['retry_reason']): string {
  const map: Record<SeedanceShotProviderRetryPlanResult['candidates'][number]['retry_reason'], string> = {
    failed: '失败回片',
    timed_out: '等待超时',
    ready_missing_video: '缺视频',
    unsubmitted: '未提交',
  }
  return map[reason]
}

function seedanceProviderRetryCandidateText(item: SeedanceShotProviderRetryPlanResult['candidates'][number]): string {
  const resubmitText = item.can_resubmit ? '可重提' : '先处理'
  const queueText = item.provider_queue_position ? ` #${item.provider_queue_position}` : ''
  const failureText = item.failure_category ? ` · ${seedanceFailureCategoryLabel(item.failure_category)}` : ''
  return `${item.shot_id}${queueText} · ${seedanceRetryReasonLabel(item.retry_reason)} · ${resubmitText}${failureText}`
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
    seedanceProviderOverview.value = null
    seedanceProviderRetryPlan.value = null
    seedanceGlobalAssets.value = []
    showQualityScenesOnly.value = false
    if (!selectedModelProfileId.value && res.data.current_story.model_profile_id) {
      selectedModelProfileId.value = res.data.current_story.model_profile_id
    }
  } else {
    error.value = res.error?.message ?? '加载故事项目失败'
  }
  loading.value = false
}

async function loadSeedanceGlobalAssets(showMessage = false) {
  if (!detail.value) return
  loadingSeedanceGlobalAssets.value = true
  if (showMessage) {
    error.value = ''
    successMessage.value = ''
  }
  const res = await getProjectSeedanceGlobalAssetLibrary(detail.value.project.project_id)
  if (res.ok && res.data) {
    seedanceGlobalAssets.value = res.data.items
    if (showMessage) {
      successMessage.value = `跨项目素材库已刷新：${res.data.reusable_asset_count} 个可复用素材`
    }
  } else if (showMessage) {
    error.value = res.error?.message ?? '刷新跨项目素材库失败'
  }
  loadingSeedanceGlobalAssets.value = false
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
    await loadSeedanceGlobalAssets()
    await loadSeedanceProviderOverview()
    await loadSeedanceProviderRetryPlan()
    successMessage.value = `Production Board 已生成：${res.data.shot_units.length} 个镜头单元`
  } else {
    error.value = res.error?.message ?? '生成 Production Board 失败'
  }
  loadingProductionBoard.value = false
}

async function loadSeedanceProviderOverview(showMessage = false) {
  if (!detail.value || loadingSeedanceProviderOverview.value) return
  loadingSeedanceProviderOverview.value = true
  if (showMessage) {
    error.value = ''
    successMessage.value = ''
  }
  const latestBatch = latestSeedanceProviderQueueBatch.value
  const res = await getProjectSeedanceProviderQueueOverview(detail.value.project.project_id, {
    provider: latestBatch?.provider,
    queue_id: latestBatch?.queue_id,
    timeout_minutes: 120,
  })
  if (res.ok && res.data) {
    seedanceProviderOverview.value = res.data
    if (showMessage) {
      successMessage.value = `Seedance provider 队列已刷新：注意项 ${res.data.attention_count} 条`
    }
  } else if (showMessage) {
    error.value = res.error?.message ?? '刷新 Seedance provider 队列失败'
  }
  loadingSeedanceProviderOverview.value = false
}

async function loadSeedanceProviderAdapterConfig() {
  if (loadingSeedanceProviderAdapterConfig.value) return
  loadingSeedanceProviderAdapterConfig.value = true
  seedanceProviderAdapterConfigError.value = ''
  const res = await getSeedanceProviderAdapterConfig()
  if (res.ok && res.data) {
    seedanceProviderAdapterConfig.value = res.data
  } else {
    seedanceProviderAdapterConfig.value = null
    seedanceProviderAdapterConfigError.value = res.error?.message ?? '读取 Seedance provider adapter 配置失败'
  }
  loadingSeedanceProviderAdapterConfig.value = false
}

async function loadSeedanceProviderRetryPlan(showMessage = false) {
  if (!detail.value || loadingSeedanceProviderRetryPlan.value) return
  loadingSeedanceProviderRetryPlan.value = true
  if (showMessage) {
    error.value = ''
    successMessage.value = ''
  }
  const latestBatch = latestSeedanceProviderQueueBatch.value
  const res = await getProjectSeedanceProviderRetryPlan(detail.value.project.project_id, {
    provider: latestBatch?.provider,
    queue_id: latestBatch?.queue_id,
    timeout_minutes: 120,
    max_retry_count: 3,
  })
  if (res.ok && res.data) {
    seedanceProviderRetryPlan.value = res.data
    if (showMessage) {
      successMessage.value = `Seedance provider 重试策略已刷新：候选 ${res.data.candidate_count} 条`
    }
  } else if (showMessage) {
    error.value = res.error?.message ?? '刷新 Seedance provider 重试策略失败'
  }
  loadingSeedanceProviderRetryPlan.value = false
}

async function bindSeedanceAsset(asset: SeedanceAssetBindingItem) {
  if (!detail.value) return
  const rawValue = (seedanceAssetFileInputs.value[asset.asset_id] ?? '').trim()
  if (!rawValue) {
    error.value = '请填写素材 URL 或 file ID'
    return
  }
  bindingSeedanceAssetId.value = asset.asset_id
  error.value = ''
  successMessage.value = ''
  const isUrl = /^https?:\/\//i.test(rawValue)
  const res = await updateProjectSeedanceAssetLibrary(detail.value.project.project_id, {
    items: [{
      asset_id: asset.asset_id,
      kind: asset.kind,
      label: asset.label,
      modality: asset.modality,
      role: asset.role,
      reference_slot: asset.reference_slot,
      file_url: isUrl ? rawValue : undefined,
      file_id: isUrl ? undefined : rawValue,
      description: asset.prompt_usage,
    }],
  })
  if (res.ok && res.data) {
    detail.value = res.data
    seedanceAssetFileInputs.value = {
      ...seedanceAssetFileInputs.value,
      [asset.asset_id]: '',
    }
    await loadProductionBoard()
    successMessage.value = `已绑定 Seedance 素材：${asset.label}`
  } else {
    error.value = res.error?.message ?? '绑定 Seedance 素材失败'
  }
  bindingSeedanceAssetId.value = ''
}

async function uploadSeedanceAssetFile(asset: SeedanceAssetBindingItem, event: Event) {
  if (!detail.value || uploadingSeedanceAssetId.value) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadingSeedanceAssetId.value = asset.asset_id
  error.value = ''
  successMessage.value = ''
  const form = new FormData()
  form.append('file', file)
  form.append('asset_id', asset.asset_id)
  form.append('kind', asset.kind)
  form.append('label', asset.label)
  form.append('modality', asset.modality)
  form.append('role', asset.role)
  if (asset.reference_slot) form.append('reference_slot', asset.reference_slot)
  if (asset.prompt_usage) form.append('description', asset.prompt_usage)
  const res = await uploadProjectSeedanceAssetFile(detail.value.project.project_id, form)
  if (res.ok && res.data) {
    detail.value = res.data.detail
    await loadProductionBoard()
    successMessage.value = `Seedance 素材已上传：${asset.label}`
  } else {
    error.value = res.error?.message ?? '上传 Seedance 素材失败'
  }
  input.value = ''
  uploadingSeedanceAssetId.value = ''
}

async function reuseGlobalSeedanceAsset(asset: SeedanceAssetBindingItem, source: SeedanceGlobalAssetLibraryItem) {
  if (!detail.value || reusingSeedanceAssetId.value) return
  reusingSeedanceAssetId.value = seedanceAssetReuseKey(asset, source)
  error.value = ''
  successMessage.value = ''
  const res = await reuseProjectSeedanceAsset(detail.value.project.project_id, {
    source_project_id: source.source_project_id,
    source_asset_id: source.source_asset_id,
    target_asset_id: asset.asset_id,
    target_label: asset.label,
    target_kind: asset.kind,
    reference_slot: asset.reference_slot,
    description: asset.prompt_usage,
  })
  if (res.ok && res.data) {
    detail.value = res.data.detail
    await loadProductionBoard()
    successMessage.value = `已复用跨项目素材：${source.source_project_title} · ${asset.label}`
  } else {
    error.value = res.error?.message ?? '复用跨项目素材失败'
  }
  reusingSeedanceAssetId.value = ''
}

function normalizeSeedanceAssetBatchImportPayload(): SeedanceAssetBatchImportRequest | null {
  const raw = seedanceAssetBatchImportText.value.trim()
  if (!raw) {
    error.value = '请粘贴 Seedance 素材清单 JSON'
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    error.value = 'Seedance 素材清单 JSON 解析失败'
    return null
  }
  const record = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null
  const items = Array.isArray(parsed)
    ? parsed
    : Array.isArray(record?.items)
      ? record.items
      : Array.isArray(record?.assets)
        ? record.assets
        : []
  if (!items.length) {
    error.value = 'Seedance 素材清单中没有可导入记录'
    return null
  }
  return {
    source_note: '前端批量导入素材清单',
    items: items as SeedanceAssetBatchImportRequest['items'],
  }
}

async function importSeedanceAssetBatchFromText() {
  if (!detail.value || importingSeedanceAssets.value) return
  const body = normalizeSeedanceAssetBatchImportPayload()
  if (!body) return
  importingSeedanceAssets.value = true
  error.value = ''
  successMessage.value = ''
  const res = await importProjectSeedanceAssetBatch(detail.value.project.project_id, body)
  if (res.ok && res.data) {
    detail.value = res.data.detail
    seedanceAssetBatchImportText.value = ''
    await loadProductionBoard()
    successMessage.value = `Seedance 素材已导入：${res.data.imported_count} 条，跳过 ${res.data.skipped_count} 条`
    if (res.data.skipped_items.length) {
      error.value = res.data.skipped_items.map(item => `#${item.index + 1} ${item.reason}`).join('；')
    }
  } else {
    error.value = res.error?.message ?? '导入 Seedance 素材清单失败'
  }
  importingSeedanceAssets.value = false
}

async function markSeedanceShot(shot: StoryProductionBoardShotUnit, status: SeedanceShotProductionStatus) {
  if (!detail.value || updatingSeedanceShotId.value) return
  updatingSeedanceShotId.value = shot.shot_id
  error.value = ''
  successMessage.value = ''
  const jobId = (seedanceShotJobInputs.value[shot.shot_id] ?? '').trim()
  const videoUrl = (seedanceShotVideoInputs.value[shot.shot_id] ?? '').trim()
  const res = await updateProjectSeedanceShotStatus(detail.value.project.project_id, {
    shot_id: shot.shot_id,
    status,
    provider_job_id: jobId || undefined,
    video_url: /^https?:\/\//i.test(videoUrl) ? videoUrl : undefined,
    note: `前端快捷标记：${seedanceShotStatusLabel(status)}`,
  })
  if (res.ok && res.data) {
    detail.value = res.data
    await loadProductionBoard()
    successMessage.value = `已更新 ${shot.shot_id}：${seedanceShotStatusLabel(status)}`
  } else {
    error.value = res.error?.message ?? '更新 Seedance 镜头状态失败'
  }
  updatingSeedanceShotId.value = ''
}

function normalizeSeedanceCallbackImportPayload(): SeedanceShotCallbackImportRequest | null {
  const raw = seedanceCallbackImportText.value.trim()
  if (!raw) {
    error.value = '请粘贴 Seedance 回传 JSON'
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    error.value = 'Seedance 回传 JSON 解析失败'
    return null
  }
  const record = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null
  const callbacks = Array.isArray(parsed)
    ? parsed
    : Array.isArray(record?.callbacks)
      ? record.callbacks
      : Array.isArray(record?.results)
        ? record.results
        : Array.isArray(record?.updates)
          ? record.updates
          : parsed
            ? [parsed]
            : []
  if (!callbacks.length) {
    error.value = 'Seedance 回传 JSON 中没有可导入记录'
    return null
  }
  return { callbacks: callbacks as SeedanceShotCallbackImportRequest['callbacks'] }
}

async function importSeedanceCallbacks() {
  if (!detail.value || importingSeedanceCallbacks.value) return
  const body = normalizeSeedanceCallbackImportPayload()
  if (!body) return
  importingSeedanceCallbacks.value = true
  error.value = ''
  successMessage.value = ''
  const res = await importProjectSeedanceShotCallbacks(detail.value.project.project_id, body)
  if (res.ok && res.data) {
    detail.value = {
      ...detail.value,
      project: res.data.project,
    }
    seedanceCallbackImportText.value = ''
    await loadProductionBoard()
    successMessage.value = `Seedance 回传已导入：${res.data.updated_count} 条，失败 ${res.data.failed_count} 条`
    if (res.data.failures.length) {
      error.value = res.data.failures.map(item => `#${item.index + 1} ${item.message}`).join('；')
    }
  } else {
    error.value = res.error?.message ?? '导入 Seedance 回传失败'
  }
  importingSeedanceCallbacks.value = false
}

async function markPendingSeedanceShotsSubmitted() {
  if (!detail.value || batchingSeedanceShots.value) return
  const pendingItems = (productionBoard.value?.seedance_shot_ledger.items ?? [])
    .filter(item => item.status === 'not_started' || item.status === 'prompt_exported')
  if (!pendingItems.length) {
    error.value = '没有待提交的 Seedance 镜头'
    return
  }
  batchingSeedanceShots.value = true
  error.value = ''
  successMessage.value = ''
  const res = await updateProjectSeedanceShotStatuses(detail.value.project.project_id, {
    updates: pendingItems.map(item => ({
      shot_id: item.shot_id,
      status: 'submitted',
      note: '批量流转：已提交到 Seedance',
    })),
  })
  if (res.ok && res.data) {
    detail.value = {
      ...detail.value,
      project: res.data.project,
    }
    await loadProductionBoard()
    successMessage.value = `Seedance 批量流转完成：${res.data.updated_count} 条，失败 ${res.data.failed_count} 条`
    if (res.data.failures.length) {
      error.value = res.data.failures.map(item => `#${item.index + 1} ${item.message}`).join('；')
    }
  } else {
    error.value = res.error?.message ?? '批量流转 Seedance 镜头失败'
  }
  batchingSeedanceShots.value = false
}

async function submitSeedanceProviderJobs(useProviderAdapter = false) {
  if (!detail.value || submittingSeedanceProvider.value || submittingSeedanceProviderAdapter.value) return
  if (useProviderAdapter) {
    submittingSeedanceProviderAdapter.value = true
  } else {
    submittingSeedanceProvider.value = true
  }
  error.value = ''
  successMessage.value = ''
  const res = await submitProjectSeedanceShotsToProvider(detail.value.project.project_id, {
    provider: 'seedance',
    queue_priority: 'normal',
    use_provider_adapter: useProviderAdapter,
    note: useProviderAdapter
      ? '前端通过 Seedance provider adapter 提交任务队列'
      : '前端提交到 Seedance provider 任务队列',
  })
  if (res.ok && res.data) {
    detail.value = {
      ...detail.value,
      project: res.data.project,
    }
    await loadProductionBoard()
    const adapterText = res.data.provider_adapter
      ? `，adapter 接收 ${res.data.provider_adapter.accepted_count} 条`
      : ''
    successMessage.value = `Seedance provider 提交完成：${res.data.submitted_count} 条，跳过 ${res.data.skipped_count} 条，失败 ${res.data.failed_count} 条${adapterText}`
    if (res.data.failures.length) {
      error.value = res.data.failures.map(item => `${item.shot_id ?? `#${item.index + 1}`} ${item.message}`).join('；')
    }
  } else {
    error.value = res.error?.message ?? '提交 Seedance provider 任务失败'
  }
  if (useProviderAdapter) {
    submittingSeedanceProviderAdapter.value = false
  } else {
    submittingSeedanceProvider.value = false
  }
}

async function pollSeedanceProviderJobs() {
  if (!detail.value || pollingSeedanceProvider.value) return
  pollingSeedanceProvider.value = true
  error.value = ''
  successMessage.value = ''
  const latestBatch = latestSeedanceProviderQueueBatch.value
  const res = await pollProjectSeedanceProviderQueue(detail.value.project.project_id, {
    provider: latestBatch?.provider ?? 'seedance',
    queue_id: latestBatch?.queue_id,
    include_prompt: true,
    use_provider_adapter: true,
    note: '前端轮询 Seedance provider 状态',
  })
  if (res.ok && res.data) {
    detail.value = {
      ...detail.value,
      project: res.data.project,
    }
    await loadProductionBoard()
    const adapterText = res.data.provider_adapter
      ? `，adapter 返回 ${res.data.provider_adapter.returned_count} 条`
      : ''
    successMessage.value = `Seedance provider 轮询完成：更新 ${res.data.updated_count} 条，待轮询 ${res.data.pollable_count} 条${adapterText}`
    if (res.data.failures.length) {
      error.value = res.data.failures.map(item => `${item.shot_id ?? `#${item.index + 1}`} ${item.message}`).join('；')
    }
  } else {
    error.value = res.error?.message ?? '轮询 Seedance provider 状态失败'
  }
  pollingSeedanceProvider.value = false
}

async function recoverSeedanceProviderTimeouts() {
  if (!detail.value || recoveringSeedanceProvider.value) return
  recoveringSeedanceProvider.value = true
  error.value = ''
  successMessage.value = ''
  const res = await recoverProjectSeedanceProviderQueue(detail.value.project.project_id, {
    timeout_minutes: 120,
    mark_timed_out_failed: true,
    note: '前端标记 Seedance provider 超时失败',
  })
  if (res.ok && res.data) {
    detail.value = {
      ...detail.value,
      project: res.data.project,
    }
    await loadProductionBoard()
    successMessage.value = `Seedance provider 超时检查完成：检查 ${res.data.checked_count} 条，超时 ${res.data.timed_out_count} 条，标记失败 ${res.data.updated_count} 条`
  } else {
    error.value = res.error?.message ?? '检查 Seedance provider 超时失败'
  }
  recoveringSeedanceProvider.value = false
}

async function autoSelectSeedanceShotVersions() {
  if (!detail.value || autoSelectingSeedanceShots.value) return
  autoSelectingSeedanceShots.value = true
  error.value = ''
  successMessage.value = ''
  const res = await autoSelectProjectSeedanceShotVersions(detail.value.project.project_id, {
    overwrite_manual: true,
    note: '前端自动择优剪辑版',
  })
  if (res.ok && res.data) {
    detail.value = res.data
    await loadProductionBoard()
    const selectedCount = productionBoard.value?.seedance_shot_ledger.items.filter(item =>
      Boolean(item.selected_version_id)
    ).length ?? 0
    successMessage.value = `Seedance 自动择优完成：当前 ${selectedCount} 个镜头已选剪辑版`
  } else {
    error.value = res.error?.message ?? 'Seedance 自动择优失败'
  }
  autoSelectingSeedanceShots.value = false
}

async function selectSeedanceShotVersion(
  shot: StoryProductionBoardShotUnit,
  version: SeedanceShotVideoVersion,
) {
  if (!detail.value || selectingSeedanceVersionId.value) return
  selectingSeedanceVersionId.value = `${shot.shot_id}:${version.version_id}`
  error.value = ''
  successMessage.value = ''
  const res = await selectProjectSeedanceShotVersion(detail.value.project.project_id, {
    shot_id: shot.shot_id,
    version_id: version.version_id,
    note: `前端选择剪辑版：${version.version_id}`,
  })
  if (res.ok && res.data) {
    detail.value = res.data
    await loadProductionBoard()
    successMessage.value = `已选择 ${shot.shot_id} 剪辑版：${version.version_id}`
  } else {
    error.value = res.error?.message ?? '选择 Seedance 剪辑版失败'
  }
  selectingSeedanceVersionId.value = ''
}

async function exportSeedanceRetryPackageMarkdown() {
  if (!detail.value || exportingSeedanceRetryPackage.value) return
  exportingSeedanceRetryPackage.value = true
  error.value = ''
  const res = await exportProjectSeedanceRetryPackage(detail.value.project.project_id)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.project_id}-seedance-retry-package.md`,
      res.data.markdown,
      'text/markdown;charset=utf-8',
    )
    successMessage.value = `Seedance 重试包 Markdown 已导出 · ${res.data.total_retry_shot_count} 个镜头`
  } else {
    error.value = res.error?.message ?? '导出 Seedance 重试包失败'
  }
  exportingSeedanceRetryPackage.value = false
}

async function exportSeedanceRetryPackageJson() {
  if (!detail.value || exportingSeedanceRetryPackage.value) return
  exportingSeedanceRetryPackage.value = true
  error.value = ''
  const res = await exportProjectSeedanceRetryPackage(detail.value.project.project_id)
  if (res.ok && res.data) {
    downloadText(
      `${res.data.project.project_id}-seedance-retry-package.json`,
      JSON.stringify(res.data, null, 2),
      'application/json;charset=utf-8',
    )
    successMessage.value = `Seedance 重试包 JSON 已导出 · ${res.data.total_retry_shot_count} 个镜头`
  } else {
    error.value = res.error?.message ?? '导出 Seedance 重试包失败'
  }
  exportingSeedanceRetryPackage.value = false
}

async function exportSeedanceProviderRetryPlanMarkdown() {
  if (!detail.value) return
  if (!seedanceProviderRetryPlan.value) {
    await loadSeedanceProviderRetryPlan()
  }
  if (!seedanceProviderRetryPlan.value) return
  downloadText(
    `${detail.value.project.project_id}-seedance-provider-retry-plan.md`,
    seedanceProviderRetryPlan.value.markdown,
    'text/markdown;charset=utf-8',
  )
  successMessage.value = `Seedance provider 重试策略已导出 · ${seedanceProviderRetryPlan.value.candidate_count} 个候选`
}

async function submitSeedanceProviderRetryPlan() {
  if (!detail.value || submittingSeedanceProviderRetryPlan.value) return
  if (!seedanceProviderRetryPlan.value?.resubmittable_count) {
    error.value = '当前没有可直接重提的 Seedance provider 镜头'
    return
  }
  submittingSeedanceProviderRetryPlan.value = true
  error.value = ''
  successMessage.value = ''
  const latestBatch = latestSeedanceProviderQueueBatch.value
  const res = await submitProjectSeedanceProviderRetryPlan(detail.value.project.project_id, {
    provider: latestBatch?.provider ?? 'seedance',
    queue_id: latestBatch?.queue_id,
    timeout_minutes: 120,
    max_retry_count: 3,
    queue_priority: 'high',
    note: '前端执行 Seedance provider 人工重试策略',
  })
  if (res.ok && res.data) {
    detail.value = {
      ...detail.value,
      project: res.data.project,
    }
    await loadProductionBoard()
    successMessage.value = `Seedance provider 重试提交完成：提交 ${res.data.submitted_count} 条，阻断 ${res.data.skipped_blocked_count} 条`
    if (res.data.failures.length) {
      error.value = res.data.failures.map(item => `${item.shot_id ?? `#${item.index + 1}`} ${item.message}`).join('；')
    }
  } else {
    error.value = res.error?.message ?? '执行 Seedance provider 重试策略失败'
  }
  submittingSeedanceProviderRetryPlan.value = false
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
  if (productionBoardRepairBusy.value || exportingProductionBoard.value) return
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
  if (productionBoardRepairBusy.value || exportingProductionBoard.value) return
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

async function submitProductionBoardRepairAndExport() {
  if (!detail.value) return
  if (productionBoardRepairBusy.value || exportingProductionBoard.value) return
  repairingAndExportingProductionBoard.value = true
  error.value = ''
  successMessage.value = ''
  const res = await repairAndExportProjectProductionBoard(detail.value.project.project_id, {
    apply_all: true,
  })
  if (res.ok && res.data) {
    detail.value = res.data.detail
    productionBoard.value = res.data.export_package.board
    productionBoardExport.value = res.data.export_package
    productionRepairResult.value = res.data.repair
    productionRepairTrace.value = res.data.repair.trace
    successMessage.value = res.data.repair.trace.applied
      ? `生产修复已生成新版本并落盘：${res.data.export_package.files.length} 个文件`
      : `生产修复未产生变化，已落盘当前交付包：${res.data.export_package.files.length} 个文件`
  } else {
    error.value = res.error?.message ?? '生产修复并落盘失败'
  }
  repairingAndExportingProductionBoard.value = false
}

async function submitProductionBoardTaskRepair(task: StoryProductionBoardRepairTask) {
  if (!detail.value) return
  if (productionBoardRepairBusy.value || exportingProductionBoard.value) return
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

function productionCategoryRepairKey(category: StoryProductionBoardSupervisionCategory): string {
  return `category:${category}`
}

function productionShotRepairKey(shotId: string): string {
  return `shot:${shotId}`
}

async function submitProductionBoardCategoryRepair(issue: StoryProductionBoardSupervisionIssue) {
  if (!detail.value) return
  if (productionBoardRepairBusy.value || exportingProductionBoard.value) return
  repairingProductionBoardScope.value = productionCategoryRepairKey(issue.category)
  error.value = ''
  successMessage.value = ''
  const res = await repairProjectProductionBoard(detail.value.project.project_id, {
    categories: [issue.category],
  })
  if (res.ok && res.data) {
    detail.value = res.data.detail
    productionBoard.value = res.data.after_board
    productionBoardExport.value = null
    productionRepairResult.value = res.data
    productionRepairTrace.value = res.data.trace
    const category = categoryLabel(issue.category)
    successMessage.value = res.data.trace.applied
      ? `已修复「${category}」类问题并生成新版本`
      : `「${category}」类问题未产生变化：${res.data.trace.reason}`
  } else {
    error.value = res.error?.message ?? '按问题类别生产修复失败'
  }
  repairingProductionBoardScope.value = ''
}

async function submitProductionBoardShotRepair(shot: StoryProductionBoardShotUnit) {
  if (!detail.value) return
  if (productionBoardRepairBusy.value || exportingProductionBoard.value) return
  repairingProductionBoardScope.value = productionShotRepairKey(shot.shot_id)
  error.value = ''
  successMessage.value = ''
  const res = await repairProjectProductionBoard(detail.value.project.project_id, {
    shot_ids: [shot.shot_id],
    scene_ids: [shot.source_scene_id],
  })
  if (res.ok && res.data) {
    detail.value = res.data.detail
    productionBoard.value = res.data.after_board
    productionBoardExport.value = null
    productionRepairResult.value = res.data
    productionRepairTrace.value = res.data.trace
    successMessage.value = res.data.trace.applied
      ? `已修复镜头「${shot.shot_id}」并生成新版本`
      : `镜头「${shot.shot_id}」未产生变化：${res.data.trace.reason}`
  } else {
    error.value = res.error?.message ?? '按镜头生产修复失败'
  }
  repairingProductionBoardScope.value = ''
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
  loadSeedanceProviderAdapterConfig()

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

.project-detail-page__seedance-asset-report {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #fff;
}

.project-detail-page__seedance-asset-report strong {
  color: #22313f;
}

.project-detail-page__seedance-asset-report p {
  margin: 4px 0 0;
  color: #526575;
  font-size: 13px;
  line-height: 1.45;
}

.project-detail-page__seedance-asset-import {
  margin-top: 8px;
}

.project-detail-page__seedance-asset-import summary {
  width: fit-content;
  cursor: pointer;
  color: #526575;
  font-size: 12px;
  font-weight: 800;
}

.project-detail-page__seedance-asset-import-textarea {
  display: block;
  width: min(520px, 100%);
  min-width: 0;
  margin-top: 6px;
  border: 1px solid #ccd6dd;
  border-radius: 4px;
  padding: 8px;
  color: #22313f;
  font-size: 12px;
  line-height: 1.45;
  resize: vertical;
}

.project-detail-page__seedance-global-assets {
  display: flex;
  width: min(520px, 100%);
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}

.project-detail-page__seedance-global-assets span {
  color: #526575;
  font-size: 12px;
  font-weight: 800;
}

.project-detail-page__seedance-global-preview {
  display: flex;
  width: min(520px, 100%);
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.project-detail-page__seedance-global-preview small {
  max-width: 180px;
  overflow-wrap: anywhere;
  border: 1px solid #dbe4ea;
  border-radius: 4px;
  padding: 3px 5px;
  background: #f8fafb;
  color: #526575;
  font-size: 11px;
  font-weight: 700;
}

.project-detail-page__seedance-asset-items {
  display: flex;
  max-width: 520px;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.project-detail-page__seedance-asset-items article {
  display: flex;
  max-width: 260px;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  border: 1px solid #d7dee5;
  border-radius: 4px;
  padding: 3px 6px;
  background: #f8fafb;
  color: #455866;
}

.project-detail-page__seedance-asset-items span,
.project-detail-page__seedance-asset-items small {
  font-size: 11px;
  font-weight: 700;
}

.project-detail-page__seedance-asset-items small {
  max-width: 230px;
  overflow-wrap: anywhere;
  color: #647380;
}

.project-detail-page__seedance-asset-input {
  width: 120px;
  min-width: 0;
  border: 1px solid #ccd6dd;
  border-radius: 4px;
  padding: 4px 6px;
  color: #22313f;
  font-size: 12px;
}

.project-detail-page__seedance-asset-upload {
  display: inline-flex;
  cursor: pointer;
  align-items: center;
  border: 1px solid #cbd7e1;
  border-radius: 4px;
  padding: 4px 6px;
  background: #fff;
  color: #2f5f7f;
  font-size: 11px;
  font-weight: 800;
}

.project-detail-page__seedance-asset-upload input {
  display: none;
}

.project-detail-page__seedance-asset-source-list {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  gap: 4px;
}

.project-detail-page__seedance-asset-source-btn {
  max-width: 100%;
  overflow-wrap: anywhere;
  border: 1px solid #cbd7e1;
  border-radius: 4px;
  padding: 4px 6px;
  background: #fff;
  color: #2f5f7f;
  cursor: pointer;
  font-size: 11px;
  font-weight: 800;
}

.project-detail-page__seedance-asset-source-btn:disabled {
  cursor: wait;
  opacity: 0.55;
}

.project-detail-page__seedance-asset-history {
  width: 100%;
}

.project-detail-page__seedance-asset-history summary {
  width: fit-content;
  cursor: pointer;
  color: #526575;
  font-size: 11px;
  font-weight: 800;
}

.project-detail-page__seedance-asset-history small {
  display: block;
  max-width: 240px;
  margin-top: 3px;
  overflow-wrap: anywhere;
  color: #647380;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.35;
}

.project-detail-page__seedance-asset-item--bound {
  border-color: #b8dbc8 !important;
  color: #1b7f4a !important;
}

.project-detail-page__seedance-asset-item--missing_file {
  border-color: #efcf8a !important;
  color: #9a6300 !important;
}

.project-detail-page__seedance-asset-item--missing_reference_slot {
  border-color: #f0c4bd !important;
  color: #b13b2e !important;
}

.project-detail-page__seedance-shot-ledger {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #fff;
}

.project-detail-page__seedance-shot-ledger strong {
  color: #22313f;
}

.project-detail-page__seedance-shot-ledger p {
  margin: 4px 0 0;
  color: #526575;
  font-size: 13px;
  line-height: 1.45;
}

.project-detail-page__seedance-shot-ledger-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.project-detail-page__seedance-provider-config,
.project-detail-page__seedance-provider-queue {
  display: flex;
  grid-column: 1 / -1;
  flex-wrap: wrap;
  gap: 6px;
}

.project-detail-page__seedance-provider-config span,
.project-detail-page__seedance-provider-queue span {
  max-width: 240px;
  overflow-wrap: anywhere;
}

.project-detail-page__seedance-provider-chip--ready {
  border-color: #b8d8c5 !important;
  background: #f3fbf6 !important;
  color: #247142 !important;
}

.project-detail-page__seedance-provider-overview {
  display: grid;
  grid-column: 1 / -1;
  gap: 8px;
  border-top: 1px solid #edf1f4;
  padding-top: 8px;
}

.project-detail-page__seedance-provider-overview-head,
.project-detail-page__seedance-provider-overview-metrics,
.project-detail-page__seedance-provider-attention {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.project-detail-page__seedance-provider-overview-head {
  justify-content: space-between;
}

.project-detail-page__seedance-provider-attention small {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.project-detail-page__seedance-provider-retry-plan {
  border-top: 1px solid #edf1f4;
  padding-top: 8px;
}

.project-detail-page__seedance-provider-retry-plan summary {
  cursor: pointer;
  color: #34495e;
  font-size: 13px;
  font-weight: 700;
}

.project-detail-page__seedance-shot-ledger-actions {
  grid-column: 1 / -1;
  border-top: 1px solid #edf1f4;
  padding-top: 8px;
}

.project-detail-page__seedance-shot-ledger-actions summary {
  cursor: pointer;
  color: #34495e;
  font-size: 13px;
  font-weight: 700;
}

.project-detail-page__seedance-callback-input {
  display: block;
  width: 100%;
  min-height: 112px;
  margin-top: 8px;
  border: 1px solid #ccd6dd;
  border-radius: 4px;
  padding: 8px;
  color: #22313f;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.45;
  resize: vertical;
}

.project-detail-page__seedance-ledger-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.project-detail-page__seedance-shot-ledger-stats span,
.project-detail-page__seedance-provider-config span,
.project-detail-page__seedance-provider-queue span,
.project-detail-page__seedance-provider-overview-metrics span,
.project-detail-page__seedance-provider-attention small,
.project-detail-page__seedance-shot-status span,
.project-detail-page__seedance-shot-status small {
  border: 1px solid #d7dee5;
  border-radius: 4px;
  padding: 3px 6px;
  background: #f8fafb;
  color: #455866;
  font-size: 11px;
  font-weight: 700;
}

.project-detail-page__seedance-shot-status {
  display: flex !important;
  flex-wrap: wrap;
  justify-content: flex-start !important;
  gap: 6px;
  margin-top: 8px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #f8fafb;
  padding: 7px;
}

.project-detail-page__seedance-shot-status small {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.project-detail-page__seedance-shot-status--ready {
  border-color: #b8dbc8;
  background: #f4fbf6;
}

.project-detail-page__seedance-shot-status--processing,
.project-detail-page__seedance-shot-status--submitted {
  border-color: #c7dff0;
  background: #f4f9fc;
}

.project-detail-page__seedance-shot-status--failed {
  border-color: #f0c4bd;
  background: #fff7f6;
}

.project-detail-page__seedance-shot-actions {
  flex-basis: 100%;
}

.project-detail-page__seedance-shot-actions summary {
  cursor: pointer;
  color: #2f4358;
  font-size: 12px;
  font-weight: 700;
}

.project-detail-page__seedance-shot-action-row {
  display: flex !important;
  flex-wrap: wrap;
  justify-content: flex-start !important;
  gap: 6px;
  margin-top: 7px;
}

.project-detail-page__seedance-version-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  border-top: 1px solid #e3e9ee;
  padding-top: 8px;
}

.project-detail-page__seedance-shot-input {
  width: 140px;
  min-width: 0;
  border: 1px solid #ccd6dd;
  border-radius: 4px;
  padding: 5px 6px;
  color: #22313f;
  font-size: 12px;
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

.project-detail-page__production-scene-diffs {
  margin-top: 10px;
  border-top: 1px solid #d6e5dc;
  padding-top: 8px;
}

.project-detail-page__production-scene-diffs summary {
  cursor: pointer;
  color: #22313f;
  font-size: 12px;
  font-weight: 800;
}

.project-detail-page__production-scene-diff-list {
  display: grid;
  gap: 8px;
  margin-top: 8px;
}

.project-detail-page__production-scene-diff {
  border: 1px solid #d6e5dc;
  border-radius: 6px;
  background: #fff;
  padding: 9px;
}

.project-detail-page__production-scene-diff-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  margin-bottom: 8px;
}

.project-detail-page__production-scene-diff-head strong {
  min-width: 0;
  color: #22313f;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.project-detail-page__production-scene-diff-head span {
  flex-shrink: 0;
  color: #63756d;
  font-size: 11px;
  font-weight: 700;
}

.project-detail-page__production-scene-diff dl {
  display: grid;
  gap: 7px;
  margin: 0;
}

.project-detail-page__production-scene-diff dl > div {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  border-top: 1px solid #edf2ee;
  padding-top: 7px;
}

.project-detail-page__production-scene-diff dt {
  color: #22313f;
  font-size: 12px;
  font-weight: 800;
}

.project-detail-page__production-scene-diff dd {
  margin: 0;
  min-width: 0;
}

.project-detail-page__production-scene-diff dd span {
  display: block;
  color: #63756d;
  font-size: 11px;
  font-weight: 700;
}

.project-detail-page__production-scene-diff dd p {
  margin: 2px 0 0;
  color: #394a57;
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
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

.project-detail-page__inline-repair-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
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

.project-detail-page__repair-task-btn--active {
  border-color: #1f6f9f;
  background: #edf6fc;
  color: #1f5f8b;
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

.project-detail-page__seedance-shot-status small {
  display: inline-flex;
  margin-top: 0;
  color: #455866;
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

.project-detail-page__quality-feedback {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.project-detail-page__quality-feedback-card {
  min-width: 0;
  padding: 10px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #fff;
}

.project-detail-page__quality-feedback-card div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.project-detail-page__quality-feedback-card strong {
  color: #22313f;
  font-size: 13px;
}

.project-detail-page__quality-feedback-card span {
  border: 1px solid #d7dee5;
  border-radius: 999px;
  padding: 1px 7px;
  color: #5e6d78;
  font-size: 11px;
  font-weight: 800;
}

.project-detail-page__quality-feedback-card ul {
  margin: 8px 0 0;
  padding-left: 17px;
  color: #4c5e6f;
  font-size: 12px;
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

.project-detail-page__repair-history {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.project-detail-page__repair-history-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: #314252;
  font-size: 13px;
}

.project-detail-page__repair-history-head span {
  color: #647380;
  font-weight: 700;
}

.project-detail-page__repair-history-item {
  border: 1px solid #d9e2ea;
  border-radius: 6px;
  background: #fff;
  padding: 10px 12px;
}

.project-detail-page__repair-history-title,
.project-detail-page__repair-history-metrics,
.project-detail-page__repair-history-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.project-detail-page__repair-history-title {
  justify-content: space-between;
  color: #22313f;
  font-size: 13px;
}

.project-detail-page__repair-history-title span,
.project-detail-page__repair-history-item small {
  color: #647380;
}

.project-detail-page__repair-history-metrics {
  margin-top: 8px;
}

.project-detail-page__repair-history-metrics span,
.project-detail-page__repair-history-actions span {
  border: 1px solid #d7dee5;
  border-radius: 4px;
  background: #f8fafb;
  padding: 3px 6px;
  color: #455866;
  font-size: 11px;
  font-weight: 700;
}

.project-detail-page__repair-history-actions {
  margin-top: 8px;
}

.project-detail-page__repair-history-actions span {
  border-color: #b8dbc8;
  color: #1b7f4a;
}

.project-detail-page__repair-history-item p {
  margin: 8px 0 0;
  color: #526575;
  font-size: 12px;
  line-height: 1.45;
}

.project-detail-page__repair-history-item small {
  display: block;
  margin-top: 6px;
  font-size: 11px;
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
  .project-detail-page__seedance-asset-report,
  .project-detail-page__seedance-shot-ledger,
  .project-detail-page__export-package {
    grid-template-columns: 1fr;
  }

  .project-detail-page__delivery-artifacts,
  .project-detail-page__seedance-asset-items,
  .project-detail-page__seedance-shot-ledger-stats,
  .project-detail-page__export-files {
    justify-content: flex-start;
  }

  .project-detail-page__summary {
    grid-template-columns: 1fr;
  }

  .project-detail-page__report-strip,
  .project-detail-page__quality-feedback,
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

  .project-detail-page__production-scene-diff-head,
  .project-detail-page__production-scene-diff dl > div {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
