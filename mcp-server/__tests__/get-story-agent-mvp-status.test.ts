import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getStoryAgentMvpStatus } from '../src/tools/get-story-agent-mvp-status.js';
import {
  getDomainPackProductionHealthReport,
  getProductionMaterialPackHealthReport,
} from '../src/tools/production-health-reports.js';

const tmpRoot = path.join(os.tmpdir(), 'kb-story-agent-mvp-status-test-' + Date.now());
const dataRoot = path.join(tmpRoot, 'data');
const previousKbRoot = process.env.KB_ROOT;
const projectId = '20260623-story-mvp-mcp--ai_comic_drama';
const productionVideoTypes = [
  'heritage_promo',
  'documentary_short',
  'ai_comic_drama',
  'explainer_video',
  'children_story',
  'social_short',
  'lecture_video',
  'education_training',
];
const coreProductionVideoTypes = new Set(['heritage_promo', 'documentary_short', 'ai_comic_drama', 'explainer_video']);
const requiredDomainPackEntries = [
  {
    pack_id: 'heritage_process_pack',
    entry_name: '非遗流程生产包——材料工具、工序动作与授权边界',
    asset_usage: ['plot_structure', 'source_grounding', 'credibility_boundary'],
  },
  {
    pack_id: 'documentary_source_pack',
    entry_name: '纪录片来源包——现实现场、来源线索与再现边界',
    asset_usage: ['source_grounding', 'credibility_boundary', 'scene_space'],
  },
  {
    pack_id: 'ai_comic_storyboard_pack',
    entry_name: 'AI漫剧分镜包——关键帧、表情节拍与连续性验收',
    asset_usage: ['plot_structure', 'visual_style', 'gears_delivery'],
  },
  {
    pack_id: 'era_and_costume_pack',
    entry_name: '朝代服饰与器物包——时代称谓、服装道具和事实边界',
    asset_usage: ['character_clothing', 'character_props', 'credibility_boundary'],
  },
  {
    pack_id: 'explainer_knowledge_structure_pack',
    entry_name: '讲解知识结构包——核心问题、层级例子与图示字幕',
    asset_usage: ['plot_structure', 'source_grounding', 'visual_style'],
  },
  {
    pack_id: 'children_adaptation_safety_pack',
    entry_name: '儿童改写规则包——年龄分层、善意张力与事实边界',
    asset_usage: ['plot_structure', 'safety_boundary', 'credibility_boundary'],
  },
  {
    pack_id: 'short_video_hook_pack',
    entry_name: '短视频钩子包——三秒问题、对比反转与平台节奏',
    asset_usage: ['plot_structure', 'visual_style', 'credibility_boundary'],
  },
  {
    pack_id: 'education_training_structure_pack',
    entry_name: '宣讲培训结构包——论点案例、练习复盘与行动转化',
    asset_usage: ['source_grounding', 'safety_boundary', 'visual_style'],
  },
];

function makeProductionPacks() {
  return productionVideoTypes.map(videoType => ({
    video_type: videoType,
    label: `${videoType} 测试生产模板`,
    goal: '测试 MCP MVP 状态的生产素材包健康门禁。',
    material_template: {
      required_fields: requiredFieldsForVideoType(videoType),
      prompt_layers: ['事实边界', '素材资产', '镜头抓手', '审稿约束'],
      minimum_viable_story_gate: ['主体明确', '来源明确', '画面明确'],
      script_ready_gate: ['结构明确', '动作明确', '边界明确'],
      production_ready_gate: ['资产明确', '镜头明确', '验收明确'],
      supplement_questions: ['问题一？', '问题二？', '问题三？', '问题四？'],
    },
    sample_entries: Array.from(
      { length: coreProductionVideoTypes.has(videoType) ? 10 : 2 },
      (_, index) => ({
        sample_id: `${videoType}-${index + 1}`,
        entry_name: `${videoType} 样板 ${index + 1}`,
      }),
    ),
  }));
}

function requiredFieldsForVideoType(videoType: string): string[] {
  if (videoType === 'heritage_promo') return ['project_name', 'heritage_or_craft_type', 'process_steps'];
  if (videoType === 'documentary_short') return ['documentary_question', 'real_world_site_or_object', 'source_quotes_or_source_cues'];
  if (videoType === 'ai_comic_drama') return ['episode_hook', 'world_and_truth_mode', 'protagonist_goal'];
  if (videoType === 'explainer_video') return ['core_question', 'audience_level', 'argument_points'];
  if (videoType === 'children_story') return ['audience_age_band', 'child_safe_conflict', 'protagonist_choice'];
  if (videoType === 'social_short') return ['opening_hook', 'platform_context', 'share_trigger'];
  if (videoType === 'lecture_video') return ['speaker_position', 'communication_goal', 'case_examples'];
  return ['learning_objective', 'learner_profile', 'practice_task'];
}

function makeDomainPackEntries() {
  return requiredDomainPackEntries.map((entry, index) => ({
    entry_name: entry.entry_name,
    domain: 'narrative_pattern',
    role: 'pattern_pack',
    type: 'Domain Pack',
    region: '通用',
    summary: `用于 ${entry.pack_id} 的测试生产提示包。`,
    keywords: [entry.pack_id, '测试', '生产提示包'],
    asset_usage: entry.asset_usage,
    production_prompts: ['生产提示一', '生产提示二', '生产提示三'],
    review_boundaries: ['审稿边界一', '审稿边界二', '审稿边界三'],
    trigger_words: Array.from({ length: 8 }, (_, triggerIndex) => `${entry.pack_id}_${index}_${triggerIndex}`),
  }));
}

function makeDomainPackExpansionCandidateBatches() {
  return [
    'heritage_process_pack',
    'documentary_source_pack',
    'ai_comic_storyboard_pack',
    'era_and_costume_pack',
    'explainer_knowledge_structure_pack',
    'children_adaptation_safety_pack',
    'short_video_hook_pack',
    'education_training_structure_pack',
  ].map(packId => ({
    batch_id: `${packId}_candidate_batch`,
    pack_id: packId,
    entry_name: `${packId} 扩库候选批次`,
    priority: 'P0',
    status: 'candidate_review',
    target_video_types: ['explainer_video'],
    field_groups: [{
      group_id: 'core',
      candidate_fields: ['core_question'],
      review_questions: ['是否保持候选稿和人工审稿？'],
    }],
    seed_targets: [{
      entry_name: `${packId} 种子条目`,
      province: '湖南',
      recommended_fields: ['core_question'],
      candidate_status: 'candidate_review',
      forbidden_direct_claims: ['未经审稿不得写回正式知识库'],
    }],
  }));
}

beforeEach(() => {
  process.env.KB_ROOT = dataRoot;
  fs.mkdirSync(path.join(dataRoot, 'provinces'), { recursive: true });
  fs.mkdirSync(path.join(dataRoot, 'production-packs'), { recursive: true });
  fs.mkdirSync(path.join(dataRoot, 'domain-packs'), { recursive: true });
  fs.writeFileSync(path.join(dataRoot, 'production-packs', 'video-type-material-supplement-packs.json'), JSON.stringify({
    schema_version: 'video-type-material-supplement-packs/v1',
    packs: makeProductionPacks(),
  }, null, 2));
  fs.writeFileSync(path.join(dataRoot, 'domain-packs', 'china-culture.json'), JSON.stringify({
    domain_id: 'china_culture',
    version: 'test',
    entries: makeDomainPackEntries(),
  }, null, 2));
  fs.writeFileSync(path.join(dataRoot, 'domain-packs', 'china-culture-production-expansion-candidates.json'), JSON.stringify({
    schema_version: 'domain-pack-expansion-candidates/v1',
    updated_at: '2026-07-07',
    domain_id: 'china_culture',
    review_policy: {
      direct_writeback_to_province_markdown: false,
      requires_candidate_markdown: true,
      requires_human_review: true,
      requires_source_level: true,
    },
    batches: makeDomainPackExpansionCandidateBatches(),
  }, null, 2));

  const projectRoot = path.join(tmpRoot, 'web', 'generated', 'projects', projectId);
  fs.mkdirSync(path.join(projectRoot, 'versions'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({
    project_id: projectId,
    current_story_id: '20260623-story-mvp-mcp',
    current_version_id: `${projectId}-v1`,
    title: 'MCP Story Agent MVP 状态测试',
    source_domain: 'china_culture',
    source_entry: '周敦颐——理学开山鼻祖',
    video_type: 'ai_comic_drama',
    presentation_style: 'ai_comic',
    status: 'draft',
    created_at: '2026-06-23T09:00:00.000Z',
    updated_at: '2026-06-23T09:01:00.000Z',
    version_count: 1,
    scene_count: 2,
    has_gears_segments: true,
    quality_passed: true,
    genre_score: 91,
  }, null, 2));
  fs.writeFileSync(path.join(projectRoot, 'versions', `${projectId}-v1.json`), JSON.stringify({
    project_id: projectId,
    version_id: `${projectId}-v1`,
    created_at: '2026-06-23T09:01:00.000Z',
    change_type: 'initial_generation',
    scene_ids_changed: [],
    quality_report: {
      passed: true,
      genre_score: 91,
      issues: [],
    },
    production_board_export: {
      exported_at: '2026-06-23T09:02:00.000Z',
      export_dir: 'exports/production-board',
      file_count: 4,
      delivery_stage: 'ready',
    },
    story: {
      storyId: '20260623-story-mvp-mcp',
      title: 'MCP Story Agent MVP 状态测试',
      full_text: '这是一个用于 MVP 状态测试的故事。',
      quality_report: {
        passed: true,
        genre_score: 91,
        issues: [],
      },
      scene_breakdown: [
        { scene_id: 1, title: '开场' },
        { scene_id: 2, title: '选择' },
      ],
      gears_segments: [
        { segment_id: 1, script_text: '开场文本' },
        { segment_id: 2, script_text: '选择文本' },
      ],
      supplement_tasks: [{
        task_id: 'mvp-writeback-task-1',
        need_id: 'mvp-writeback-need-1',
        label: 'MVP 写回队列测试草案',
        description: '验证 MCP MVP 状态能看到已审稿写回草案。',
        status: 'resolved',
        source: 'production_material_missing_field',
        created_at: '2026-06-23T09:01:00.000Z',
        updated_at: '2026-06-23T09:03:00.000Z',
        knowledge_candidate_review_status: 'approved',
        knowledge_candidate_review_note: '已通过测试审稿。',
        knowledge_writeback_draft_markdown: '## 正式知识库写入草案\n\n- 核实方法：人工复核后写入。',
        knowledge_writeback_status: 'queued',
      }],
    },
  }, null, 2));
  fs.mkdirSync(path.join(projectRoot, 'production-board'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'production-board', 'seedance-asset-report.json'), JSON.stringify({
    schema_version: 'seedance-asset-report/v1',
    placeholder_asset_count: 2,
    production_asset_ready_count: 1,
    assets: [],
  }, null, 2));
});

afterEach(() => {
  if (previousKbRoot === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = previousKbRoot;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('kb_get_story_agent_mvp_status', () => {
  it('combines generated health and production readiness into MVP lanes', async () => {
    const result = await getStoryAgentMvpStatus({ generated_limit: 10, portfolio_limit: 10 });

    expect(result.schema_version).toBe('mcp-story-agent-mvp-status/v1');
    expect(result.status).toMatch(/ready|needs_action|blocked/);
    expect(result.summary.generated_target_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.readiness_target_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.seedance_placeholder_asset_count).toBe(2);
    expect(result.summary.seedance_production_asset_ready_count).toBe(1);
    expect(typeof result.summary.real_gears_endpoint_configured).toBe('boolean');
    expect(typeof result.summary.real_gears_callback_secret_configured).toBe('boolean');
    expect(typeof result.summary.real_gears_callback_base_configured).toBe('boolean');
    expect(typeof result.summary.real_gears_callback_base_public).toBe('boolean');
    expect(typeof result.summary.real_gears_acceptance_ready_to_run).toBe('boolean');
    expect(typeof result.summary.real_gears_acceptance_blocker).toBe('string');
    expect(result.summary.local_acceptance_counts_as_real_external_callback).toBe(false);
    expect(typeof result.summary.seedance_provider_submit_adapter_configured).toBe('boolean');
    expect(typeof result.summary.seedance_provider_poll_adapter_configured).toBe('boolean');
    expect(typeof result.summary.seedance_provider_callback_base_configured).toBe('boolean');
    expect(typeof result.summary.seedance_provider_external_loop_ready).toBe('boolean');
    expect(result.summary.knowledge_writeback_ready_count).toBe(1);
    expect(result.summary.knowledge_writeback_project_ready_count).toBe(1);
    expect(result.summary.knowledge_writeback_expansion_ready_count).toBe(0);
    expect(result.summary.knowledge_writeback_total_ready_count).toBe(1);
    expect(result.summary.knowledge_writeback_project_count).toBe(1);
    expect(result.summary.knowledge_writeback_draft_ready_count).toBe(0);
    expect(result.summary.knowledge_writeback_queued_count).toBe(1);
    expect(result.summary.knowledge_writeback_written_back_count).toBe(0);
    expect(result.summary.knowledge_writeback_needs_revision_count).toBe(0);
    expect(result.summary.knowledge_writeback_expansion_draft_ready_count).toBe(0);
    expect(result.summary.knowledge_writeback_expansion_queued_count).toBe(0);
    expect(result.summary.knowledge_writeback_expansion_written_back_count).toBe(0);
    expect(result.summary.knowledge_writeback_expansion_needs_revision_count).toBe(0);
    expect(result.summary.knowledge_writeback_total_draft_ready_count).toBe(0);
    expect(result.summary.knowledge_writeback_total_queued_count).toBe(1);
    expect(result.summary.knowledge_writeback_total_written_back_count).toBe(0);
    expect(result.summary.knowledge_writeback_total_needs_revision_count).toBe(0);
    expect(result.summary.knowledge_writeback_unified_export_schema).toBe('knowledge-writeback-queue-export/v1');
    expect(result.summary.knowledge_writeback_unified_export_ready).toBe(true);
    expect(result.summary.knowledge_writeback_unified_export_approved_count).toBe(1);
    expect(result.summary.knowledge_writeback_unified_export_project_approved_count).toBe(1);
    expect(result.summary.knowledge_writeback_unified_export_expansion_approved_count).toBe(0);
    expect(result.summary.knowledge_writeback_unified_export_target_file_count).toBe(1);
    expect(result.summary.knowledge_writeback_unified_export_direct_writeback_to_province_markdown).toBe(false);
    expect(result.summary.knowledge_writeback_unified_export_province_markdown_written).toBe(false);
    expect(result.summary.generated_governance_action_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.generated_governance_ready_signoff_candidate_count).toBeGreaterThanOrEqual(1);
    expect(result.summary.production_material_pack_status).toBe('passed');
    expect(result.summary.production_material_pack_count).toBe(8);
    expect(result.summary.production_material_pack_issue_count).toBe(0);
    expect(result.summary.production_material_pack_core_ready_count).toBe(4);
    expect(result.summary.production_material_pack_core_total_count).toBe(4);
    expect(result.summary.domain_pack_status).toBe('passed');
    expect(result.summary.domain_pack_count).toBe(8);
    expect(result.summary.domain_pack_issue_count).toBe(0);
    expect(result.summary.production_domain_pack_ready_count).toBe(8);
    expect(result.summary.production_domain_pack_required_count).toBe(8);
    expect(result.summary.domain_pack_expansion_status).toBe('passed');
    expect(result.summary.domain_pack_expansion_batch_count).toBe(8);
    expect(result.summary.domain_pack_expansion_seed_target_count).toBe(8);
    expect(result.summary.domain_pack_expansion_candidate_field_count).toBe(8);
    expect(result.summary.domain_pack_expansion_issue_count).toBe(0);
    expect(result.summary.domain_pack_expansion_review_candidate_count).toBe(8);
    expect(result.summary.domain_pack_expansion_review_approved_count).toBe(0);
    expect(result.summary.domain_pack_expansion_review_rejected_count).toBe(0);
    expect(result.summary.domain_pack_expansion_review_needs_revision_count).toBe(0);
    expect(result.summary.domain_pack_expansion_approved_writeback_draft_count).toBe(0);
    expect(result.summary.domain_pack_expansion_writeback_draft_ready_count).toBe(0);
    expect(result.summary.domain_pack_expansion_writeback_queued_count).toBe(0);
    expect(result.summary.domain_pack_expansion_writeback_written_back_count).toBe(0);
    expect(result.summary.domain_pack_expansion_writeback_needs_revision_count).toBe(0);
    expect(result.summary.story_agent_command_surface_status).toBe('ready');
    expect(result.summary.story_agent_command_surface_percent).toBe(100);
    expect(result.summary.mcp_story_agent_tool_count).toBe(26);
    expect(result.summary.mcp_story_agent_loop_percent).toBe(100);
    expect(result.summary.content_command_layer_percent).toBe(100);
    expect(result.summary.production_delivery_contract_percent).toBe(100);
    expect(result.summary.production_delivery_contract_surface_count).toBe(13);
    expect(result.lanes.map(lane => lane.key)).toContain('knowledge_writeback');
    expect(result.lanes.find(lane => lane.key === 'knowledge_writeback')?.evidence).toContain('queued=1');
    expect(result.lanes.find(lane => lane.key === 'knowledge_writeback')?.evidence).toContain('project_writeback_drafts=1');
    expect(result.lanes.find(lane => lane.key === 'knowledge_writeback')?.evidence).toContain('expansion_writeback_drafts=0');
    expect(result.lanes.find(lane => lane.key === 'knowledge_writeback')?.evidence).toContain('unified_export_ready=true');
    expect(result.generated_health.schema_version).toBe('mcp-story-agent-generated-health/v1');
    expect(result.generated_governance_plan.schema_version).toBe('mcp-story-agent-generated-governance-plan/v1');
    expect(result.production_material_pack_health.schema_version).toBe('production-material-pack-health/v1');
    expect(result.domain_pack_health.schema_version).toBe('domain-pack-production-health/v1');
    expect(result.domain_pack_expansion_candidates.schema_version).toBe('domain-pack-expansion-candidates-report/v1');
    expect(result.domain_pack_expansion_candidates.status).toBe('passed');
    expect(result.production_portfolio.schema_version).toBe('mcp-production-readiness-portfolio/v1');
    expect(result.production_portfolio.summary.seedance_placeholder_asset_count).toBe(2);
    expect(result.production_portfolio.summary.seedance_production_asset_ready_count).toBe(1);
    expect(result.lanes.map(lane => lane.key)).toEqual(expect.arrayContaining([
      'generated_artifacts',
      'generated_governance',
      'production_material_packs',
      'domain_packs',
      'domain_pack_expansion',
      'story_quality',
      'repair_loop',
      'delivery_contract',
      'production_command',
    ]));
    expect(result.progress).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'generated_governance',
        percent: 100,
        status: 'ready',
      }),
      expect.objectContaining({
        key: 'mcp_story_agent_loop',
        percent: 100,
        status: 'ready',
      }),
      expect.objectContaining({
        key: 'content_command_layer',
        percent: 100,
        status: 'ready',
      }),
      expect.objectContaining({
        key: 'production_delivery_contract',
        percent: 100,
        status: 'ready',
      }),
      expect.objectContaining({
        key: 'gears_end_to_end_acceptance',
        percent: 95,
        blocker: expect.any(String),
      }),
    ]));
    expect(result.progress.find(slice => slice.key === 'mcp_story_agent_loop')?.evidence).toEqual(expect.arrayContaining([
      'implementation_progress=100',
      expect.stringContaining('tool_count=26'),
      expect.stringContaining('kb_get_production_material_pack_health'),
      expect.stringContaining('kb_get_domain_pack_production_health'),
      expect.stringContaining('kb_get_domain_pack_expansion_candidates'),
      expect.stringContaining('kb_get_domain_pack_expansion_writeback_draft'),
      expect.stringContaining('kb_update_domain_pack_expansion_review_state'),
      expect.stringContaining('kb_update_domain_pack_expansion_review_state_bulk'),
      expect.stringContaining('kb_generate_story_repair_prompt'),
      'media_execution=gears_v2',
    ]));
    expect(result.progress.find(slice => slice.key === 'content_command_layer')?.evidence).toEqual(expect.arrayContaining([
      'implementation_progress=100',
      'production_material_pack_status=passed',
      'production_material_core_ready=4/4',
      'production_material_pack_issues=0',
      'domain_pack_status=passed',
      'domain_pack_ready=8/8',
      'domain_pack_issues=0',
      'domain_pack_expansion_status=passed',
      'domain_pack_expansion_batches=8',
      'domain_pack_expansion_seed_targets=8',
      'domain_pack_expansion_candidate_fields=8',
      'domain_pack_expansion_review_approved=0',
      'domain_pack_expansion_approved_writeback_drafts=0',
      'domain_pack_expansion_writeback_queued=0',
      'domain_pack_expansion_direct_writeback=false',
      'knowledge_writeback_unified_export_ready=true',
      'knowledge_writeback_unified_export_target_files=1',
      'knowledge_writeback_unified_export_province_written=false',
      'seedance_placeholder_assets=2',
      'seedance_production_assets_ready=1',
      'local_target_health_tracked_by=lanes',
      'real_media_execution=gears_v2',
    ]));
    expect(result.progress.find(slice => slice.key === 'production_delivery_contract')?.evidence).toEqual(expect.arrayContaining([
      'implementation_progress=100',
      'surface_count=13',
      expect.stringContaining('production_board_export'),
      expect.stringContaining('seedance_asset_upload_checklist'),
      expect.stringContaining('worker_evidence_signoff'),
      'seedance_placeholder_assets=2',
      'seedance_production_assets_ready=1',
      'local_target_health_tracked_by=delivery_contract_lane',
      'real_media_execution=gears_v2',
    ]));
    expect(result.progress.find(slice => slice.key === 'gears_end_to_end_acceptance')?.evidence).toEqual(expect.arrayContaining([
      'acceptance_progress=95',
      expect.stringContaining('gears_endpoint_configured='),
      expect.stringContaining('gears_callback_secret_configured='),
      expect.stringContaining('gears_callback_base_configured='),
      expect.stringContaining('gears_callback_base_public='),
      expect.stringContaining('ready_to_run_real_acceptance='),
      'local_acceptance_counts_as_real_external_callback=false',
      expect.stringContaining('seedance_provider_external_loop_ready='),
      expect.stringContaining('external_or_manual_steps='),
      'requires=run-gears-worker-acceptance.sh',
      'requires=worker_evidence_signoff',
    ]));
    expect(result.lanes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'generated_governance',
        score: 100,
        status: 'ready',
      }),
      expect.objectContaining({
        key: 'domain_pack_expansion',
        status: 'ready',
        evidence: expect.arrayContaining([
          'review_candidate_count=8',
          'review_approved_count=0',
          'approved_writeback_drafts=0',
          'writeback_queued=0',
          'direct_writeback=false',
        ]),
      }),
    ]));
    expect(result.priority_targets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scope: 'story_project',
        project_id: projectId,
        priority_score: expect.any(Number),
      }),
    ]));
    expect(result.notes.join('\n')).toContain('Generated governance command surface is complete at 100%');
    expect(result.notes.join('\n')).toContain('Production material pack health is now a MCP Story Agent MVP lane');
    expect(result.notes.join('\n')).toContain('Domain Pack production health is now a MCP Story Agent MVP lane');
    expect(result.notes.join('\n')).toContain('Domain Pack expansion candidates are tracked as a MCP Story Agent MVP lane');
    expect(result.notes.join('\n')).toContain('Domain Pack expansion writeback drafts are read-only MCP exports');
    expect(result.notes.join('\n')).toContain('MCP Story Agent loop is complete at 100%');
    expect(result.notes.join('\n')).toContain('Content and production command layer is complete at 100%');
    expect(result.notes.join('\n')).toContain('Production Board / Delivery Contract command surface is complete at 100%');
    expect(result.notes.join('\n')).toContain('Story Agent command surface is signed off at 100%');
    expect(result.notes.join('\n')).toContain('content and production command layer');
    expect(result.notes.join('\n')).toContain('remaining 5%');
    expect(result.markdown).toContain('MCP Story Agent MVP Status');
    expect(result.markdown).toContain('Progress Split');
    expect(result.markdown).toContain('production material pack health: passed');
    expect(result.markdown).toContain('domain pack health: passed');
    expect(result.markdown).toContain('domain pack expansion candidates: passed');
    expect(result.markdown).toContain('domain pack expansion review approved: 0');
    expect(result.markdown).toContain('domain pack expansion approved writeback drafts: 0');
    expect(result.markdown).toContain('Seedance placeholder assets: 2');
    expect(result.markdown).toContain('local acceptance counts as real external callback: false');
    expect(result.markdown).toContain('knowledge writeback queued: 1');
    expect(result.markdown).toContain('knowledge writeback unified export: ready');
    expect(result.markdown).toContain('knowledge writeback unified export target files: 1');
    expect(result.markdown).toContain('production delivery contract: 100%');
    expect(result.markdown).toContain('Story Agent command surface: ready · 100%');
  });

  it('does not count local callback URLs as real external GEARS callback readiness', async () => {
    const previous = {
      apiBaseUrl: process.env.GEARS_API_BASE_URL,
      callbackSecret: process.env.GEARS_CALLBACK_SECRET,
      callbackBaseUrl: process.env.GEARS_CALLBACK_BASE_URL,
      publicApiBaseUrl: process.env.PUBLIC_API_BASE_URL,
      appBaseUrl: process.env.APP_BASE_URL,
    };
    try {
      process.env.GEARS_API_BASE_URL = 'https://gears.example.test/api-root';
      process.env.GEARS_CALLBACK_SECRET = 'private-callback-token';
      process.env.GEARS_CALLBACK_BASE_URL = 'http://127.0.0.1:3002';
      delete process.env.PUBLIC_API_BASE_URL;
      delete process.env.APP_BASE_URL;

      const result = await getStoryAgentMvpStatus({ generated_limit: 10, portfolio_limit: 10 });

      expect(result.summary.real_gears_endpoint_configured).toBe(true);
      expect(result.summary.real_gears_callback_secret_configured).toBe(true);
      expect(result.summary.real_gears_callback_base_configured).toBe(true);
      expect(result.summary.real_gears_callback_base_public).toBe(false);
      expect(result.summary.real_gears_acceptance_ready_to_run).toBe(false);
      expect(result.summary.real_gears_acceptance_blocker).toBe('real_gears_callback_base_not_public');
      expect(result.summary.local_acceptance_counts_as_real_external_callback).toBe(false);
      const gearsAcceptance = result.progress.find(slice => slice.key === 'gears_end_to_end_acceptance');
      expect(gearsAcceptance).toMatchObject({
        blocker: 'real_gears_callback_base_not_public',
      });
      expect(gearsAcceptance?.evidence).toEqual(expect.arrayContaining([
        'gears_endpoint_configured=true',
        'gears_callback_secret_configured=true',
        'gears_callback_base_configured=true',
        'gears_callback_base_public=false',
        'ready_to_run_real_acceptance=false',
        'local_acceptance_counts_as_real_external_callback=false',
      ]));
    } finally {
      if (previous.apiBaseUrl === undefined) delete process.env.GEARS_API_BASE_URL;
      else process.env.GEARS_API_BASE_URL = previous.apiBaseUrl;
      if (previous.callbackSecret === undefined) delete process.env.GEARS_CALLBACK_SECRET;
      else process.env.GEARS_CALLBACK_SECRET = previous.callbackSecret;
      if (previous.callbackBaseUrl === undefined) delete process.env.GEARS_CALLBACK_BASE_URL;
      else process.env.GEARS_CALLBACK_BASE_URL = previous.callbackBaseUrl;
      if (previous.publicApiBaseUrl === undefined) delete process.env.PUBLIC_API_BASE_URL;
      else process.env.PUBLIC_API_BASE_URL = previous.publicApiBaseUrl;
      if (previous.appBaseUrl === undefined) delete process.env.APP_BASE_URL;
      else process.env.APP_BASE_URL = previous.appBaseUrl;
    }
  });

  it('can omit markdown for compact agent reads', async () => {
    const result = await getStoryAgentMvpStatus({ include_markdown: false });

    expect(result.schema_version).toBe('mcp-story-agent-mvp-status/v1');
    expect(result.markdown).toBeUndefined();
  });

  it('exposes standalone read-only pack health reports for MCP tools', () => {
    const productionMaterialPackHealth = getProductionMaterialPackHealthReport();
    const domainPackHealth = getDomainPackProductionHealthReport();

    expect(productionMaterialPackHealth).toMatchObject({
      schema_version: 'production-material-pack-health/v1',
      status: 'passed',
      pack_count: 8,
      production_ready_core_video_types: ['heritage_promo', 'documentary_short', 'ai_comic_drama', 'explainer_video'],
      issues: [],
    });
    expect(domainPackHealth).toMatchObject({
      schema_version: 'domain-pack-production-health/v1',
      status: 'passed',
      pack_count: 8,
      production_ready_pack_ids: [
        'heritage_process_pack',
        'documentary_source_pack',
        'ai_comic_storyboard_pack',
        'era_and_costume_pack',
        'explainer_knowledge_structure_pack',
        'children_adaptation_safety_pack',
        'short_video_hook_pack',
        'education_training_structure_pack',
      ],
      issues: [],
    });
  });
});
