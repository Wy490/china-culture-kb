import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  getDomainPackExpansionCandidateReport,
  getDomainPackExpansionWritebackDraftPackage,
  updateDomainPackExpansionReviewState,
  updateDomainPackExpansionReviewStateBulk,
} from '../services/domain-pack-expansion-service.js';

const previousGeneratedRoot = process.env.WEB_GENERATED_ROOT;
let generatedRoot = '';

beforeAll(() => {
  if (!process.env.KB_ROOT) {
    process.env.KB_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
  }
});

beforeEach(() => {
  generatedRoot = mkdtempSync(resolve(tmpdir(), 'domain-pack-expansion-service-'));
  process.env.WEB_GENERATED_ROOT = generatedRoot;
});

afterEach(() => {
  if (previousGeneratedRoot === undefined) delete process.env.WEB_GENERATED_ROOT;
  else process.env.WEB_GENERATED_ROOT = previousGeneratedRoot;
  rmSync(generatedRoot, { recursive: true, force: true });
});

describe('domain-pack-expansion-service', () => {
  it('reports review-gated Domain Pack expansion candidate batches', () => {
    const report = getDomainPackExpansionCandidateReport({
      generatedAt: '2026-07-07T00:00:00.000Z',
    });

    expect(report).toMatchObject({
      schema_version: 'domain-pack-expansion-candidates-report/v1',
      generated_at: '2026-07-07T00:00:00.000Z',
      source_schema_version: 'domain-pack-expansion-candidates/v1',
      domain_id: 'china_culture',
      status: 'passed',
      missing_required_pack_ids: [],
      video_type_coverage_count: expect.any(Number),
      pipeline_progress_percent: 100,
      pipeline_stage: 'complete',
      review_policy: {
        direct_writeback_to_province_markdown: false,
        requires_candidate_markdown: true,
        requires_human_review: true,
        requires_source_level: true,
      },
      batch_count: 8,
      field_workbench_item_count: expect.any(Number),
      field_supplement_candidate_count: expect.any(Number),
      field_missing_candidate_count: expect.any(Number),
      field_candidate_completion_percent: expect.any(Number),
      field_review_ready_count: expect.any(Number),
      field_review_blocker_count: expect.any(Number),
      field_review_ready_percent: expect.any(Number),
      field_supplement_priority_target_count: expect.any(Number),
      review_ready_priority_target_count: expect.any(Number),
      issues: [],
    });
    expect(report.video_type_coverage_count).toBeGreaterThanOrEqual(10);
    const explainerCoverage = report.coverage_by_video_type.find(item => item.video_type === 'explainer_video');
    expect(explainerCoverage).toMatchObject({
      video_type: 'explainer_video',
      batch_count: expect.any(Number),
      seed_target_count: expect.any(Number),
      review_status_counts: expect.objectContaining({
        candidate_review: 0,
        approved: 51,
      }),
      approved_writeback_draft_count: 51,
      field_supplement_candidate_count: expect.any(Number),
      field_missing_candidate_count: expect.any(Number),
      field_candidate_completion_percent: expect.any(Number),
      field_review_ready_count: expect.any(Number),
      field_review_blocker_count: expect.any(Number),
      field_review_ready_percent: expect.any(Number),
      writeback_status_counts: expect.objectContaining({
        draft_ready: 51,
        queued: 0,
      }),
    });
    expect(explainerCoverage?.batch_count).toBeGreaterThanOrEqual(7);
    expect(explainerCoverage?.seed_target_count).toBeGreaterThanOrEqual(20);
    expect(explainerCoverage?.pack_ids).toEqual(expect.arrayContaining([
      'heritage_process_pack',
      'documentary_source_pack',
      'explainer_knowledge_structure_pack',
      'education_training_structure_pack',
    ]));
    expect(explainerCoverage?.provinces).toEqual(expect.arrayContaining(['湖南']));
    expect(report.required_pack_ids).toEqual([
      'heritage_process_pack',
      'documentary_source_pack',
      'ai_comic_storyboard_pack',
      'era_and_costume_pack',
      'explainer_knowledge_structure_pack',
      'children_adaptation_safety_pack',
      'short_video_hook_pack',
      'education_training_structure_pack',
    ]);
    expect(report.seed_target_count).toBeGreaterThanOrEqual(30);
    expect(report.candidate_field_count).toBeGreaterThanOrEqual(80);
    expect(report.field_workbench_item_count).toBeGreaterThanOrEqual(100);
    expect(report.field_supplement_candidate_count).toBeGreaterThanOrEqual(120);
    expect(report.field_missing_candidate_count).toBe(
      (report.field_workbench_item_count ?? 0) - (report.field_supplement_candidate_count ?? 0),
    );
    expect(report.field_supplement_priority_target_count).toBe(report.field_missing_candidate_count);
    expect(report.field_supplement_priority_target_count).toBe(0);
    expect(report.field_supplement_priority_targets).toEqual([]);
    expect(report.review_ready_priority_target_count).toBe(0);
    expect(report.review_ready_priority_targets).toEqual([]);
    expect(report.field_candidate_completion_percent).toBeGreaterThanOrEqual(100);
    expect(report.field_review_ready_count).toBe(report.field_workbench_item_count);
    expect(report.field_review_blocker_count).toBe(0);
    expect(report.field_review_ready_percent).toBe(100);
    expect(report.pipeline_progress_percent).toBe(100);
    expect(report.pipeline_stage).toBe('complete');
    expect(report.review_ready_item_count).toBe(report.seed_target_count);
    expect(report.review_blocked_item_count).toBe(0);
    expect(report.review_packet).toMatchObject({
      schema_version: 'domain-pack-expansion-review-packet/v1',
      source_schema_version: 'domain-pack-expansion-candidates/v1',
      domain_id: 'china_culture',
      status: 'passed',
      batch_count: 8,
      review_item_count: report.seed_target_count,
      candidate_field_count: report.candidate_field_count,
      field_workbench_item_count: report.field_workbench_item_count,
      field_supplement_candidate_count: report.field_supplement_candidate_count,
      field_missing_candidate_count: report.field_missing_candidate_count,
      field_candidate_completion_percent: report.field_candidate_completion_percent,
      field_review_ready_count: report.field_review_ready_count,
      field_review_blocker_count: report.field_review_blocker_count,
      field_review_ready_percent: report.field_review_ready_percent,
      review_ready_item_count: report.review_ready_item_count,
      review_blocked_item_count: report.review_blocked_item_count,
      review_policy: {
        direct_writeback_to_province_markdown: false,
        requires_candidate_markdown: true,
        requires_human_review: true,
        requires_source_level: true,
      },
    });
    expect(report.review_packet.review_status_counts?.candidate_review).toBe(0);
    expect(report.review_packet.review_status_counts?.approved).toBe(62);
    expect(report.review_packet.approved_writeback_draft_count).toBe(62);
    expect(report.writeback_preflight).toMatchObject({
      schema_version: 'domain-pack-expansion-writeback-preflight/v1',
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
      approved_draft_count: 62,
      draft_ready_count: 62,
      queued_count: 0,
      written_back_count: 0,
      needs_revision_count: 0,
      target_file_count: 3,
      target_files: expect.arrayContaining([
        'data/provinces/山西.md',
        'data/provinces/湖南.md',
        'data/provinces/辽宁.md',
      ]),
      manual_review_required_count: 62,
      blocked_direct_writeback_count: 0,
      ready_for_unified_export: true,
      safety_checks: expect.arrayContaining([
        'direct_writeback_to_province_markdown=false',
        'province_markdown_written=false',
        'approved_writeback_drafts=62',
        'requires_human_review_before_province_markdown=true',
      ]),
    });
    expect(report.next_development_tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        task_id: 'field_workbench_controls',
        status: 'in_progress',
        progress_percent: 97,
        progress_note: expect.stringContaining('统一写回队列'),
        related_plan_items: [1],
        direct_writeback_to_province_markdown: false,
      }),
      expect.objectContaining({
        task_id: 'manual_review_closure',
        status: 'ready',
        progress_percent: 94,
        related_plan_items: [2],
      }),
      expect.objectContaining({
        task_id: 'writeback_safety_export',
        status: 'in_progress',
        progress_percent: 99,
        related_plan_items: [3],
      }),
      expect.objectContaining({
        task_id: 'second_batch_real_candidates',
        status: 'ready',
        progress_percent: 96,
        related_plan_items: [4],
        target_video_types: expect.arrayContaining(['explainer_video', 'heritage_promo', 'documentary_short', 'ai_comic_drama']),
      }),
      expect.objectContaining({
        task_id: 'mvp_completion_surface',
        status: 'ready',
        progress_percent: 96,
        related_plan_items: [5],
      }),
    ]));
    expect(report.markdown).toContain('field_workbench_controls');
    expect(report.markdown).toContain('progress_percent: 97');
    const reviewItems = report.review_packet.batches.flatMap(batch => batch.review_items);
    expect(reviewItems.every(item => item.review_ready)).toBe(true);
    expect(reviewItems.every(item => item.review_state_source === 'seed')).toBe(true);
    expect(reviewItems.every(item => item.review_state_overrides_seed === false)).toBe(true);
    expect(reviewItems.every(item => item.review_state_seed_status === item.review_status)).toBe(true);
    expect(reviewItems.every(item => item.review_state_runtime_status === undefined)).toBe(true);
    expect(reviewItems.every(item => item.field_review_blocker_count === 0)).toBe(true);
    expect(reviewItems.flatMap(item => item.field_workbench).every(field =>
      field.review_ready && field.review_ready_missing.length === 0,
    )).toBe(true);
    expect(reviewItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entry_name: '长沙窑铜官陶瓷烧制技艺——海上丝绸之路的釉下彩开创',
        field_supplement_candidate_count: 4,
        field_missing_candidate_count: 0,
        field_candidate_completion_percent: 100,
        field_review_ready_count: 4,
        field_review_blocker_count: 0,
        field_review_ready_percent: 100,
        review_ready: true,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'process_steps',
            candidate_value: expect.stringContaining('拉坯→修坯'),
          }),
        ]),
      }),
      expect.objectContaining({
        entry_name: '新民学会——湖南共产党的前身',
        field_supplement_candidate_count: 4,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'timeline',
            candidate_value: expect.stringContaining('1918年4月14日'),
          }),
        ]),
      }),
      expect.objectContaining({
        entry_name: '狐仙报恩母题——湖南民间叙事与志异边界',
        field_supplement_candidate_count: 4,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'forbidden_tone',
            candidate_value: expect.stringContaining('避免恐怖猎奇'),
          }),
        ]),
      }),
      expect.objectContaining({
        entry_name: '岳麓书院——千年学府弦歌不绝',
        field_supplement_candidate_count: 4,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'knowledge_outline',
            candidate_value: expect.stringContaining('976年朱洞创建书院'),
          }),
        ]),
      }),
      expect.objectContaining({
        entry_name: '曾国藩——湘军创立者与洋务先驱',
        field_supplement_candidate_count: 4,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'source_trail',
            candidate_value: expect.stringContaining('曾国藩家书'),
          }),
        ]),
      }),
      expect.objectContaining({
        entry_name: '洞庭湖与娥皇女英——湘妃竹传说',
        field_supplement_candidate_count: 4,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'visual_symbols',
            candidate_value: expect.stringContaining('湘妃竹泪痕纹样'),
          }),
        ]),
      }),
      expect.objectContaining({
        entry_name: '常德会战与常德细菌战——湘北战场的血与疫',
        field_supplement_candidate_count: 4,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'core_question',
            candidate_value: expect.stringContaining('为什么讲常德抗战'),
          }),
        ]),
      }),
      expect.objectContaining({
        entry_name: '踏虎剪纸——凿刀下的苗族阴阳世界',
        field_supplement_candidate_count: 4,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'concept_definitions',
            candidate_value: expect.stringContaining('以凿刀代剪刀'),
          }),
        ]),
      }),
      expect.objectContaining({
        pack_id: 'heritage_process_pack',
        entry_name: '岳州扇——洞庭湖畔的文人雅扇',
        field_supplement_candidate_count: 4,
        field_missing_candidate_count: 0,
        field_candidate_completion_percent: 100,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'materials',
            candidate_value: expect.stringContaining('湘竹扇骨'),
          }),
        ]),
      }),
      expect.objectContaining({
        pack_id: 'heritage_process_pack',
        entry_name: '踏虎剪纸——凿刀下的苗族阴阳世界',
        field_supplement_candidate_count: 4,
        field_missing_candidate_count: 0,
        field_candidate_completion_percent: 100,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'community_or_practitioner_consent',
            candidate_value: expect.stringContaining('踏虎村传习点'),
          }),
        ]),
      }),
      expect.objectContaining({
        pack_id: 'documentary_source_pack',
        entry_name: '太行山八路军根据地——抗战的中流砥柱',
        field_supplement_candidate_count: 4,
        field_missing_candidate_count: 0,
        field_candidate_completion_percent: 100,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'present_day_trace',
            candidate_value: expect.stringContaining('王家峪旧址'),
          }),
        ]),
      }),
      expect.objectContaining({
        pack_id: 'education_training_structure_pack',
        entry_name: '新民学会——湖南共产党的前身',
        field_supplement_candidate_count: 4,
        field_missing_candidate_count: 0,
        field_candidate_completion_percent: 100,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'assessment_check',
            candidate_value: expect.stringContaining('所有成员都直接转入共产党'),
          }),
        ]),
      }),
      expect.objectContaining({
        pack_id: 'short_video_hook_pack',
        entry_name: '长沙窑铜官陶瓷烧制技艺——海上丝绸之路的釉下彩开创',
        field_supplement_candidate_count: 4,
        field_missing_candidate_count: 0,
        field_candidate_completion_percent: 100,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'opening_hook',
            candidate_value: expect.stringContaining('印度洋沉船'),
          }),
        ]),
      }),
      expect.objectContaining({
        pack_id: 'short_video_hook_pack',
        entry_name: '常德会战与常德细菌战——湘北战场的血与疫',
        field_supplement_candidate_count: 4,
        field_missing_candidate_count: 0,
        field_candidate_completion_percent: 100,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'production_risks',
            candidate_value: expect.stringContaining('灾难娱乐化'),
          }),
        ]),
      }),
      expect.objectContaining({
        pack_id: 'era_and_costume_pack',
        entry_name: '周敦颐月岩悟道——理学源头的山洞想象',
        field_supplement_candidate_count: 4,
        field_missing_candidate_count: 0,
        field_candidate_completion_percent: 100,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'era_layer',
            candidate_value: expect.stringContaining('地方传说/后世阐释层'),
          }),
        ]),
      }),
      expect.objectContaining({
        pack_id: 'era_and_costume_pack',
        entry_name: '岳麓书院——千年学府弦歌不绝',
        field_supplement_candidate_count: 4,
        field_missing_candidate_count: 0,
        field_candidate_completion_percent: 100,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'mixed_era_risk',
            candidate_value: expect.stringContaining('现代学生'),
          }),
        ]),
      }),
      expect.objectContaining({
        pack_id: 'era_and_costume_pack',
        entry_name: '曾国藩——湘军创立者与洋务先驱',
        field_supplement_candidate_count: 4,
        field_missing_candidate_count: 0,
        field_candidate_completion_percent: 100,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'forbidden_modern_objects',
            candidate_value: expect.stringContaining('现代军装'),
          }),
        ]),
      }),
      expect.objectContaining({
        pack_id: 'children_adaptation_safety_pack',
        entry_name: '柳毅传书——洞庭湖畔的书生与龙女',
        field_supplement_candidate_count: 4,
        field_missing_candidate_count: 0,
        field_candidate_completion_percent: 100,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'fact_boundary_card',
            candidate_value: expect.stringContaining('龙宫、龙女和水下通道属于故事想象'),
          }),
        ]),
      }),
      expect.objectContaining({
        pack_id: 'children_adaptation_safety_pack',
        entry_name: '滩头年画——湘西南木版年画的最后守望',
        field_supplement_candidate_count: 4,
        field_missing_candidate_count: 0,
        field_candidate_completion_percent: 100,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'assessment_check',
            candidate_value: expect.stringContaining('滩头年画有刻版、套印、开脸'),
          }),
        ]),
      }),
      expect.objectContaining({
        pack_id: 'education_training_structure_pack',
        entry_name: '周敦颐月岩悟道——理学源头的山洞想象',
        field_supplement_candidate_count: 4,
        field_missing_candidate_count: 0,
        field_candidate_completion_percent: 100,
        field_workbench: expect.arrayContaining([
          expect.objectContaining({
            field_id: 'practice_task',
            candidate_value: expect.stringContaining('月岩直接启发《太极图说》已被史料证明'),
          }),
        ]),
      }),
    ]));
    expect(report.review_packet.batches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pack_id: 'heritage_process_pack',
        review_items: expect.arrayContaining([
          expect.objectContaining({
            entry_name: '滩头年画——湘西南木版年画的最后守望',
            province: '湖南',
            candidate_status: 'candidate_review',
            review_state_source: 'seed',
            review_state_overrides_seed: false,
            field_supplement_candidate_count: 4,
            field_missing_candidate_count: 0,
            field_candidate_completion_percent: 100,
            field_workbench: expect.arrayContaining([
              expect.objectContaining({
                field_id: 'process_steps',
                supplement_status: 'candidate_draft',
                review_ready: true,
                review_ready_missing: [],
                candidate_value: expect.stringContaining('刻版→上色→套印→开脸'),
                source_refs: expect.arrayContaining(['data/provinces/湖南.md#滩头年画：工艺特色']),
              }),
            ]),
            candidate_markdown: expect.stringContaining('direct_writeback_to_province_markdown: false'),
          }),
        ]),
      }),
    ]));
    expect(report.review_packet.markdown).toContain('Domain Pack Expansion Review Packet');
    expect(report.review_packet.markdown).toContain('滩头年画');
    expect(report.review_packet.markdown).toContain('Field supplement workbench');
    expect(report.review_packet.markdown).toContain('field_review_ready_count');
    expect(report.review_packet.markdown).toContain('review_ready: true');
    expect(report.review_packet.markdown).toContain('review_state_source: seed');
    expect(report.review_packet.markdown).toContain('review_state_overrides_seed: false');
    expect(report.review_packet.markdown).toContain('刻版→上色→套印→开脸');
    expect(report.review_packet.markdown).toContain('候选稿只记录待补字段');
    expect(report.batches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pack_id: 'heritage_process_pack',
        priority: 'P0',
        seed_target_count: 12,
        provinces: expect.arrayContaining(['湖南']),
      }),
      expect.objectContaining({
        pack_id: 'documentary_source_pack',
        target_video_types: expect.arrayContaining(['documentary_short']),
      }),
      expect.objectContaining({
        pack_id: 'explainer_knowledge_structure_pack',
        target_video_types: expect.arrayContaining(['explainer_video']),
      }),
      expect.objectContaining({
        pack_id: 'children_adaptation_safety_pack',
        target_video_types: expect.arrayContaining(['children_story']),
      }),
      expect.objectContaining({
        pack_id: 'short_video_hook_pack',
        target_video_types: expect.arrayContaining(['social_short']),
      }),
      expect.objectContaining({
        pack_id: 'education_training_structure_pack',
        target_video_types: expect.arrayContaining(['education_training']),
      }),
    ]));
    expect(report.markdown).toContain('Domain Pack Expansion Candidates');
    expect(report.markdown).toContain('direct_writeback_to_province_markdown: false');
    expect(report.markdown).toContain('review_packet_item_count');
    expect(report.markdown).toContain('field_supplement_candidate_count');
    expect(report.markdown).toContain('field_missing_candidate_count');
    expect(report.markdown).toContain('field_candidate_completion_percent');
    expect(report.markdown).toContain('field_review_ready_count');
    expect(report.markdown).toContain('field_review_blocker_count');
    expect(report.markdown).toContain('pipeline_progress_percent: 100');
    expect(report.markdown).toContain('pipeline_stage: complete');
    expect(report.markdown).toContain('Writeback Safety Preflight');
    expect(report.markdown).toContain('approved_draft_count: 62');
    expect(report.markdown).toContain('Next Development Tasks');
    expect(report.markdown).toContain('field_workbench_controls');
    expect(report.markdown).toContain('second_batch_real_candidates');
    expect(report.markdown).toContain('field_supplement_priority_target_count');
    expect(report.markdown).toContain('review_ready_priority_target_count');
    expect(report.markdown).toContain('Next Field Supplement Targets');
    expect(report.markdown).toContain('Next Review Ready Targets');
    expect(report.markdown).toContain('## Video Type Coverage');
    expect(report.markdown).toContain('explainer_video');
  });

  it('can omit markdown for machine-only callers', () => {
    const report = getDomainPackExpansionCandidateReport({ includeMarkdown: false });

    expect(report.status).toBe('passed');
    expect(report.markdown).toBeUndefined();
    expect(report.review_packet.review_item_count).toBe(report.seed_target_count);
    expect(report.review_packet.markdown).toBeUndefined();
  });

  it('loads tracked review seeds and lets runtime review state override them', () => {
    const runtimeReviewDir = resolve(generatedRoot, 'domain-pack-expansion');
    mkdirSync(runtimeReviewDir, { recursive: true });
    writeFileSync(resolve(runtimeReviewDir, 'review-state.json'), `${JSON.stringify({
      schema_version: 'domain-pack-expansion-review-state/v1',
      updated_at: '2026-07-08T10:00:00.000+08:00',
      direct_writeback_to_province_markdown: false,
      items: [{
        review_item_id: 'heritage_process_pack_expansion_20260707::target_01',
        review_status: 'needs_revision',
        review_note: '运行态覆盖 seed：退回补充传承人口述授权确认。',
        reviewed_at: '2026-07-08T10:00:00.000+08:00',
      }],
    }, null, 2)}\n`);

    const report = getDomainPackExpansionCandidateReport({ includeMarkdown: false });
    const reviewItems = report.review_packet.batches.flatMap(batch => batch.review_items);
    const overridden = reviewItems.find(item =>
      item.review_item_id === 'heritage_process_pack_expansion_20260707::target_01',
    );

    expect(report.review_packet.review_status_counts).toMatchObject({
      candidate_review: 0,
      approved: 61,
      needs_revision: 1,
    });
    expect(report.review_packet.approved_writeback_draft_count).toBe(61);
    expect(overridden).toMatchObject({
      review_status: 'needs_revision',
      review_note: '运行态覆盖 seed：退回补充传承人口述授权确认。',
      review_state_source: 'runtime',
      review_state_overrides_seed: true,
      review_state_seed_status: 'approved',
      review_state_seed_writeback_status: 'draft_ready',
      review_state_runtime_status: 'needs_revision',
      review_state_runtime_writeback_status: undefined,
      writeback_status: undefined,
    });
  });

  it('blocks approval when field-level review readiness is incomplete', () => {
    const previousKbRoot = process.env.KB_ROOT;
    const tempKbRoot = mkdtempSync(resolve(tmpdir(), 'domain-pack-expansion-kb-'));
    try {
      process.env.KB_ROOT = tempKbRoot;
      mkdirSync(resolve(tempKbRoot, 'domain-packs'), { recursive: true });
      writeFileSync(resolve(tempKbRoot, 'domain-packs', 'china-culture-production-expansion-candidates.json'), `${JSON.stringify({
        schema_version: 'domain-pack-expansion-candidates/v1',
        updated_at: '2026-07-08',
        domain_id: 'china_culture',
        review_policy: {
          direct_writeback_to_province_markdown: false,
          requires_candidate_markdown: true,
          requires_human_review: true,
          requires_source_level: true,
        },
        batches: [{
          batch_id: 'heritage_process_pack_batch',
          pack_id: 'heritage_process_pack',
          entry_name: '审批保护测试包',
          priority: 'P0',
          status: 'candidate_review',
          target_video_types: ['explainer_video'],
          field_groups: [{
            group_id: 'source_gate',
            candidate_fields: ['core_question'],
            review_questions: ['是否补齐来源级证据？'],
          }],
          seed_targets: [{
            entry_name: '缺证据字段候选',
            province: '湖南',
            recommended_fields: ['core_question'],
            candidate_status: 'candidate_review',
            forbidden_direct_claims: ['未核实来源断言'],
            field_supplement_candidates: [{
              field_id: 'core_question',
              candidate_value: '为什么这个文化点需要先补来源再讲解？',
            }],
          }],
        }],
      }, null, 2)}\n`);

      const report = getDomainPackExpansionCandidateReport({ includeMarkdown: false });
      const reviewItem = report.review_packet.batches.flatMap(batch => batch.review_items)[0];
      expect(reviewItem).toMatchObject({
        review_item_id: 'heritage_process_pack_batch::target_01',
        review_ready: false,
        field_review_ready_count: 0,
        field_review_blocker_count: 1,
        field_workbench: [expect.objectContaining({
          field_id: 'core_question',
          review_ready: false,
          review_ready_missing: expect.arrayContaining([
            'evidence_level',
            'source_refs',
            'writeback_hint',
            'verification_note',
          ]),
        })],
      });

      const update = updateDomainPackExpansionReviewState({
        review_item_id: 'heritage_process_pack_batch::target_01',
        review_status: 'approved',
        writeback_status: 'queued',
      }, {
        updatedAt: '2026-07-08T01:00:00.000Z',
      });
      expect(update).toMatchObject({
        ok: false,
        message: expect.stringContaining('字段审稿阻断'),
      });
      expect(update.message).toContain('evidence_level/source_refs/writeback_hint/verification_note');

      const bulkUpdate = updateDomainPackExpansionReviewStateBulk({
        review_item_ids: ['heritage_process_pack_batch::target_01'],
        review_status: 'approved',
        writeback_status: 'queued',
      }, {
        updatedAt: '2026-07-08T01:05:00.000Z',
      });
      expect(bulkUpdate).toMatchObject({
        ok: false,
        message: expect.stringContaining('字段审稿阻断'),
      });
    } finally {
      if (previousKbRoot === undefined) delete process.env.KB_ROOT;
      else process.env.KB_ROOT = previousKbRoot;
      rmSync(tempKbRoot, { recursive: true, force: true });
    }
  });

  it('stores review state separately and exports approved writeback drafts', () => {
    const reviewItemId = 'heritage_process_pack_expansion_20260707::target_01';
    const update = updateDomainPackExpansionReviewState({
      review_item_id: reviewItemId,
      review_status: 'approved',
      review_note: '已确认可进入人工补源清单，仍需补来源级证据。',
      reviewer_name: '王复核',
      reviewed_by: '王复核',
      writeback_status: 'queued',
      writeback_note: '先排入湖南非遗流程补录批次。',
    }, {
      updatedAt: '2026-07-07T09:00:00.000Z',
    });

    expect(update.ok).toBe(true);
    const updatedItem = update.report?.review_packet.batches
      .flatMap(batch => batch.review_items)
      .find(item => item.review_item_id === reviewItemId);
    expect(updatedItem).toMatchObject({
      review_status: 'approved',
      review_note: '已确认可进入人工补源清单，仍需补来源级证据。',
      reviewer_name: '王复核',
      reviewed_by: '王复核',
      writeback_status: 'queued',
      writeback_note: '先排入湖南非遗流程补录批次。',
      writeback_draft_markdown: expect.stringContaining('扩库候选审稿草案'),
    });
    expect(updatedItem?.writeback_draft_markdown).toContain('direct_writeback_to_province_markdown: false');
    expect(updatedItem?.writeback_draft_markdown).toContain('reviewed_by: 王复核');
    expect(updatedItem?.writeback_draft_markdown).toContain('#### 字段候选值');
    expect(updatedItem?.writeback_draft_markdown).toContain('刻版→上色→套印→开脸');

    const draftPackage = getDomainPackExpansionWritebackDraftPackage({
      exportedAt: '2026-07-07T10:00:00.000Z',
    });
    expect(draftPackage).toMatchObject({
      schema_version: 'domain-pack-expansion-writeback-draft/v1',
      exported_at: '2026-07-07T10:00:00.000Z',
      direct_writeback_to_province_markdown: false,
      filters: {},
      approved_count: 62,
      target_files: [
        'data/provinces/山西.md',
        'data/provinces/湖南.md',
        'data/provinces/辽宁.md',
      ],
      status_counts: expect.objectContaining({
        queued: 1,
        draft_ready: 61,
      }),
    });
    const draftItem = draftPackage.items.find(item => item.review_item_id === reviewItemId);
    expect(draftItem).toMatchObject({
      review_item_id: reviewItemId,
      province: '湖南',
      suggested_file_path: 'data/provinces/湖南.md',
      writeback_status: 'queued',
      reviewer_name: '王复核',
      reviewed_by: '王复核',
      review_state_source: 'runtime',
      review_state_overrides_seed: true,
      review_state_seed_status: 'approved',
      review_state_runtime_status: 'approved',
      field_supplement_candidate_count: 4,
      field_missing_candidate_count: 0,
      field_candidate_completion_percent: 100,
      field_review_ready_count: 4,
      field_review_blocker_count: 0,
      field_review_ready_percent: 100,
      review_ready: true,
    });
    expect(draftItem?.field_workbench?.[0]).toMatchObject({
      field_id: 'process_steps',
      supplement_status: 'candidate_draft',
    });
    expect(draftPackage.markdown).toContain('Domain Pack Expansion Writeback Draft');
    expect(draftPackage.markdown).toContain('## Filters');
    expect(draftPackage.markdown).toContain('本草案只作为人工补库采集清单');
  });

  it('bulk updates filtered review candidates without writing province markdown', () => {
    const update = updateDomainPackExpansionReviewStateBulk({
      review_item_ids: [
        'children_adaptation_safety_pack_expansion_20260707::target_01',
        'children_adaptation_safety_pack_expansion_20260707::target_02',
      ],
      review_status: 'approved',
      review_note: '批量审稿通过，仍需人工补来源。',
      writeback_status: 'queued',
      writeback_note: '批量进入儿童改写安全补录队列。',
    }, {
      updatedAt: '2026-07-07T11:00:00.000Z',
    });

    expect(update.ok).toBe(true);
    expect(update.result).toMatchObject({
      schema_version: 'domain-pack-expansion-review-state-bulk-update/v1',
      updated_at: '2026-07-07T11:00:00.000Z',
      updated_count: 2,
      missing_review_item_ids: [],
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
      report: {
        review_packet: {
          approved_writeback_draft_count: 62,
        },
      },
    });
    expect(update.result?.report.review_packet.review_status_counts).toMatchObject({
      approved: 62,
    });
    expect(update.result?.report.review_packet.batches
      .flatMap(batch => batch.review_items)
      .filter(item => item.review_status === 'approved')).toHaveLength(62);

    const draftPackage = getDomainPackExpansionWritebackDraftPackage({
      exportedAt: '2026-07-07T11:10:00.000Z',
    });
    expect(draftPackage).toMatchObject({
      approved_count: 62,
      status_counts: expect.objectContaining({
        queued: 2,
        draft_ready: 60,
      }),
    });
    expect(draftPackage.items.filter(item => item.writeback_status === 'queued')).toHaveLength(2);
    expect(draftPackage.items.filter(item => item.writeback_status === 'draft_ready')).toHaveLength(60);

    const scopedPackage = getDomainPackExpansionWritebackDraftPackage({
      exportedAt: '2026-07-07T11:20:00.000Z',
      packIds: ['children_adaptation_safety_pack'],
      videoTypes: ['children_story'],
      provinces: ['湖南'],
      writebackStatuses: ['queued'],
    });
    expect(scopedPackage).toMatchObject({
      approved_count: 2,
      target_files: ['data/provinces/湖南.md'],
      filters: {
        pack_ids: ['children_adaptation_safety_pack'],
        video_types: ['children_story'],
        provinces: ['湖南'],
        writeback_statuses: ['queued'],
      },
      status_counts: expect.objectContaining({
        queued: 2,
      }),
    });
    expect(scopedPackage.markdown).toContain('pack_ids: children_adaptation_safety_pack');
    expect(scopedPackage.markdown).toContain('writeback_statuses: queued');

    const remainingDraftPackage = getDomainPackExpansionWritebackDraftPackage({
      exportedAt: '2026-07-07T11:30:00.000Z',
      packIds: ['children_adaptation_safety_pack'],
      writebackStatuses: ['draft_ready'],
    });
    expect(remainingDraftPackage).toMatchObject({
      approved_count: 2,
      target_files: ['data/provinces/湖南.md'],
      filters: {
        pack_ids: ['children_adaptation_safety_pack'],
        writeback_statuses: ['draft_ready'],
      },
      status_counts: expect.objectContaining({
        draft_ready: 2,
        queued: 0,
      }),
    });
  });

  it('rejects review updates for unknown candidate items', () => {
    const update = updateDomainPackExpansionReviewState({
      review_item_id: 'missing-review-item',
      review_status: 'approved',
    });

    expect(update.ok).toBe(false);
    expect(update.message).toContain('未找到扩库候选审稿项');
  });
});
