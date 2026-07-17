import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getDomainPackExpansionCandidateReport,
  getDomainPackExpansionCandidateToolResult,
  getDomainPackExpansionWritebackDraftToolResult,
  getDomainPackProductionHealthReport,
  getDomainPackProductionHealthToolResult,
  getKnowledgeWritebackQueueExportToolResult,
  PRODUCTION_HEALTH_SUPPORTED_VIDEO_TYPES,
  getProductionMaterialPackHealthReport,
  getProductionMaterialPackHealthToolResult,
  getStorySupplementCandidatePackageToolResult,
  updateDomainPackExpansionReviewStateBulkToolResult,
  updateDomainPackExpansionReviewStateToolResult,
} from './production-health-reports.js';

let tmpRoot = '';
let dataRoot = '';
const previousKbRoot = process.env.KB_ROOT;
const previousGeneratedRoot = process.env.WEB_GENERATED_ROOT;

interface ProductionHealthConformanceCase {
  case_id: string;
  health_policy?: unknown;
  loaded_video_types: string[];
  sample_entries_by_video_type?: Record<string, unknown[]>;
  expected: {
    domain_sample_policy_valid: boolean;
    policy_issue_type: 'missing_domain_sample_policy' | 'invalid_domain_sample_policy' | null;
    duplicate_sample_entry_ids_by_video_type?: Record<string, string[]>;
  };
}

interface ProductionPackStructureConformanceCase {
  case_id: string;
  omit_top_level_fields?: string[];
  top_level_overrides?: Record<string, unknown>;
  omit_material_template_fields?: string[];
  material_template_overrides?: Record<string, unknown>;
  sample_entries?: unknown[];
  expected: {
    loaded_pack_count: number;
    domain_sample_policy_valid: boolean;
  };
}

interface ProductionPackRejectionDiagnostic {
  pack_index: number;
  code: string;
  path: string;
}

interface ProductionPackFileDiagnostic {
  code: string;
  path: string;
}

interface ProductionPackFileStructureConformanceCase {
  case_id: string;
  root_value?: unknown;
  omit_fields?: string[];
  overrides?: Record<string, unknown>;
  expected: {
    pack_file_valid: boolean;
    loaded_pack_count: number;
    diagnostic: ProductionPackFileDiagnostic | null;
  };
}

interface ProductionPackCollectionConformanceCase {
  case_id: string;
  video_type: string;
  first_label: string;
  duplicate_label: string;
  expected: {
    loaded_pack_count: number;
    selected_label: string;
    diagnostic: ProductionPackRejectionDiagnostic;
  };
}

interface ProductionHealthConformanceFixture {
  schema_version: 'production-material-pack-health-conformance/v1';
  supported_video_types: string[];
  valid_domain_minimums: Record<string, number>;
  standard_pack: Record<string, unknown>;
  pack_file_structure_cases: ProductionPackFileStructureConformanceCase[];
  pack_collection_cases: ProductionPackCollectionConformanceCase[];
  pack_structure_cases: ProductionPackStructureConformanceCase[];
  pack_structure_diagnostic_expectations: Record<string, ProductionPackRejectionDiagnostic | null>;
  cases: ProductionHealthConformanceCase[];
}

const productionHealthConformance = JSON.parse(fs.readFileSync(path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'data',
  'production-packs',
  'production-material-pack-health-conformance.json',
), 'utf8')) as ProductionHealthConformanceFixture;

function makeConformancePack(videoType: string, sampleEntries?: unknown[]): Record<string, unknown> {
  return {
    ...productionHealthConformance.standard_pack,
    video_type: videoType,
    sample_entries: sampleEntries ?? Object.keys(productionHealthConformance.valid_domain_minimums)
      .map(sourceDomain => ({
        sample_id: `${videoType}-${sourceDomain}`,
        entry_name: `${videoType} ${sourceDomain}`,
        applicable_source_domains: [sourceDomain],
      })),
  };
}

function makePackStructureConformancePack(
  testCase: ProductionPackStructureConformanceCase,
): Record<string, unknown> {
  const pack: Record<string, unknown> = {
    ...productionHealthConformance.standard_pack,
    video_type: 'children_story',
    material_template: {
      ...(productionHealthConformance.standard_pack.material_template as Record<string, unknown>),
    },
    sample_entries: testCase.sample_entries ?? Object.keys(productionHealthConformance.valid_domain_minimums)
      .map(sourceDomain => ({
        sample_id: `children_story-${sourceDomain}`,
        entry_name: `children_story ${sourceDomain}`,
        applicable_source_domains: [sourceDomain],
      })),
  };
  const template = pack.material_template as Record<string, unknown>;
  for (const field of testCase.omit_material_template_fields ?? []) delete template[field];
  Object.assign(template, testCase.material_template_overrides ?? {});
  for (const field of testCase.omit_top_level_fields ?? []) delete pack[field];
  Object.assign(pack, testCase.top_level_overrides ?? {});
  return pack;
}

function makePackFileStructureConformanceValue(
  testCase: ProductionPackFileStructureConformanceCase,
): unknown {
  if ('root_value' in testCase) return testCase.root_value;
  const value: Record<string, unknown> = {
    schema_version: 'video-type-material-supplement-packs/v1',
    health_policy: {
      required_domain_sample_video_types: ['children_story'],
      domain_sample_minimums: {
        children_story: productionHealthConformance.valid_domain_minimums,
      },
    },
    packs: [makeConformancePack('children_story')],
  };
  for (const field of testCase.omit_fields ?? []) delete value[field];
  Object.assign(value, testCase.overrides ?? {});
  return value;
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-production-health-reports-'));
  dataRoot = path.join(tmpRoot, 'data');
  process.env.KB_ROOT = dataRoot;
  process.env.WEB_GENERATED_ROOT = path.join(tmpRoot, 'web-generated');
  fs.mkdirSync(path.join(dataRoot, 'provinces'), { recursive: true });
});

afterEach(() => {
  if (previousKbRoot === undefined) delete process.env.KB_ROOT;
  else process.env.KB_ROOT = previousKbRoot;
  if (previousGeneratedRoot === undefined) delete process.env.WEB_GENERATED_ROOT;
  else process.env.WEB_GENERATED_ROOT = previousGeneratedRoot;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('production health reports', () => {
  it('matches the shared production health conformance matrix', () => {
    expect(productionHealthConformance.schema_version)
      .toBe('production-material-pack-health-conformance/v1');
    expect([...PRODUCTION_HEALTH_SUPPORTED_VIDEO_TYPES].sort())
      .toEqual([...productionHealthConformance.supported_video_types].sort());

    for (const videoType of productionHealthConformance.supported_video_types) {
      fs.mkdirSync(path.join(dataRoot, 'production-packs'), { recursive: true });
      fs.writeFileSync(
        path.join(dataRoot, 'production-packs', 'video-type-material-supplement-packs.json'),
        JSON.stringify({
          schema_version: 'video-type-material-supplement-packs/v1',
          health_policy: {
            required_domain_sample_video_types: [videoType],
            domain_sample_minimums: {
              [videoType]: productionHealthConformance.valid_domain_minimums,
            },
          },
          packs: [makeConformancePack(videoType)],
        }, null, 2),
        'utf8',
      );
      expect(getProductionMaterialPackHealthReport().domain_sample_policy_valid, videoType).toBe(true);
    }

    for (const testCase of productionHealthConformance.cases) {
      fs.mkdirSync(path.join(dataRoot, 'production-packs'), { recursive: true });
      const packFile: Record<string, unknown> = {
        schema_version: 'video-type-material-supplement-packs/v1',
        packs: testCase.loaded_video_types.map(videoType => makeConformancePack(
          videoType,
          testCase.sample_entries_by_video_type?.[videoType],
        )),
      };
      if ('health_policy' in testCase) packFile.health_policy = testCase.health_policy;
      fs.writeFileSync(
        path.join(dataRoot, 'production-packs', 'video-type-material-supplement-packs.json'),
        JSON.stringify(packFile, null, 2),
        'utf8',
      );

      const report = getProductionMaterialPackHealthReport();
      const policyIssue = report.issues.find(issue =>
        issue.issue_type === 'missing_domain_sample_policy'
        || issue.issue_type === 'invalid_domain_sample_policy');
      expect(report.domain_sample_policy_valid, testCase.case_id)
        .toBe(testCase.expected.domain_sample_policy_valid);
      expect(policyIssue?.issue_type ?? null, testCase.case_id)
        .toBe(testCase.expected.policy_issue_type);
      for (const [videoType, duplicateIds] of Object.entries(
        testCase.expected.duplicate_sample_entry_ids_by_video_type ?? {},
      )) {
        expect(
          report.packs.find(pack => pack.video_type === videoType)?.duplicate_sample_entry_ids,
          testCase.case_id,
        ).toEqual(duplicateIds);
      }
    }
  });

  it('filters malformed file packs using the shared structure matrix', () => {
    const packsDir = path.join(dataRoot, 'production-packs');
    fs.mkdirSync(packsDir, { recursive: true });

    for (const testCase of productionHealthConformance.pack_structure_cases) {
      fs.writeFileSync(
        path.join(packsDir, 'video-type-material-supplement-packs.json'),
        JSON.stringify({
          schema_version: 'video-type-material-supplement-packs/v1',
          health_policy: {
            required_domain_sample_video_types: ['children_story'],
            domain_sample_minimums: {
              children_story: productionHealthConformance.valid_domain_minimums,
            },
          },
          packs: [makePackStructureConformancePack(testCase)],
        }, null, 2),
        'utf8',
      );

      const report = getProductionMaterialPackHealthReport();
      expect(report.pack_count, testCase.case_id).toBe(testCase.expected.loaded_pack_count);
      expect(report.domain_sample_policy_valid, testCase.case_id)
        .toBe(testCase.expected.domain_sample_policy_valid);
      const expectedDiagnostic = productionHealthConformance
        .pack_structure_diagnostic_expectations[testCase.case_id];
      expect(report.rejected_pack_count, testCase.case_id).toBe(expectedDiagnostic ? 1 : 0);
      expect(report.rejected_pack_diagnostics, testCase.case_id)
        .toEqual(expectedDiagnostic ? [expectedDiagnostic] : []);

      if (testCase.case_id === 'label_must_be_non_blank') {
        const toolResult = getProductionMaterialPackHealthToolResult();
        expect(toolResult.markdown).toContain('- rejected_pack_count: 1');
        expect(toolResult.markdown).toContain(
          'pack_index=0 code=required_non_blank_string path=packs[0].label',
        );
      }
    }
  });

  it('fails closed with shared diagnostics for malformed pack file roots', () => {
    const packsDir = path.join(dataRoot, 'production-packs');
    fs.mkdirSync(packsDir, { recursive: true });

    for (const testCase of productionHealthConformance.pack_file_structure_cases) {
      fs.writeFileSync(
        path.join(packsDir, 'video-type-material-supplement-packs.json'),
        JSON.stringify(makePackFileStructureConformanceValue(testCase), null, 2),
        'utf8',
      );
      const report = getProductionMaterialPackHealthReport();
      expect(report.pack_file_valid, testCase.case_id)
        .toBe(testCase.expected.pack_file_valid);
      expect(report.pack_file_diagnostics, testCase.case_id)
        .toEqual(testCase.expected.diagnostic ? [testCase.expected.diagnostic] : []);
      expect(report.pack_count, testCase.case_id).toBe(testCase.expected.loaded_pack_count);
      expect(
        report.issues.some(issue => issue.issue_type === 'invalid_pack_file_structure'),
        testCase.case_id,
      ).toBe(!testCase.expected.pack_file_valid);
      if (!testCase.expected.pack_file_valid) {
        expect(report.covered_required_video_types, testCase.case_id).toEqual([]);
        expect(report.domain_sample_policy_valid, testCase.case_id).toBe(false);
      }
      if (testCase.case_id === 'pack_file_schema_version_must_be_supported') {
        const markdown = getProductionMaterialPackHealthToolResult().markdown;
        expect(markdown).toContain('code=unsupported_schema_version path=schema_version');
        expect(markdown).not.toContain('v2-sensitive-value');
      }
    }
  });

  it('keeps the first pack and rejects later duplicate video types', () => {
    const packsDir = path.join(dataRoot, 'production-packs');
    fs.mkdirSync(packsDir, { recursive: true });

    for (const testCase of productionHealthConformance.pack_collection_cases) {
      fs.writeFileSync(
        path.join(packsDir, 'video-type-material-supplement-packs.json'),
        JSON.stringify({
          schema_version: 'video-type-material-supplement-packs/v1',
          health_policy: {
            required_domain_sample_video_types: [testCase.video_type],
            domain_sample_minimums: {
              [testCase.video_type]: productionHealthConformance.valid_domain_minimums,
            },
          },
          packs: [
            { ...makeConformancePack(testCase.video_type), label: testCase.first_label },
            { ...makeConformancePack(testCase.video_type), label: testCase.duplicate_label },
          ],
        }, null, 2),
        'utf8',
      );

      const report = getProductionMaterialPackHealthReport();
      expect(report.pack_count, testCase.case_id).toBe(testCase.expected.loaded_pack_count);
      expect(report.rejected_pack_count, testCase.case_id).toBe(1);
      expect(report.rejected_pack_diagnostics, testCase.case_id)
        .toEqual([testCase.expected.diagnostic]);
      expect(report.packs.map(pack => pack.label), testCase.case_id)
        .toEqual([testCase.expected.selected_label]);
      expect(report.domain_sample_policy_valid, testCase.case_id).toBe(true);
      expect(report.covered_required_video_types, testCase.case_id)
        .toContain(testCase.video_type);
      expect(report.issues, testCase.case_id).toEqual(expect.arrayContaining([
        expect.objectContaining({ issue_type: 'duplicate_pack_video_type' }),
      ]));

      const markdown = getProductionMaterialPackHealthToolResult().markdown;
      expect(markdown).toContain(
        'pack_index=1 code=duplicate_video_type path=packs[1].video_type',
      );
      expect(markdown).not.toContain(testCase.duplicate_label);
    }
  });

  it('fails closed when production pack and Domain Pack files are missing', () => {
    const productionMaterialPackHealth = getProductionMaterialPackHealthReport();
    const domainPackHealth = getDomainPackProductionHealthReport();
    const domainPackExpansionCandidates = getDomainPackExpansionCandidateReport();

    expect(productionMaterialPackHealth).toMatchObject({
      schema_version: 'production-material-pack-health/v1',
      status: 'failed',
      pack_file_valid: false,
      pack_file_diagnostics: [{ code: 'source_unavailable', path: '$' }],
      pack_count: 0,
      covered_required_video_types: [],
      production_ready_core_video_types: [],
    });
    expect(productionMaterialPackHealth.required_video_types).toHaveLength(8);
    expect(productionMaterialPackHealth.missing_required_video_types).toEqual(productionMaterialPackHealth.required_video_types);
    expect(productionMaterialPackHealth.domain_sample_policy_valid).toBe(false);
    expect(productionMaterialPackHealth.issues).toHaveLength(10);
    expect(productionMaterialPackHealth.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        issue_type: 'invalid_pack_file_structure',
      }),
      expect.objectContaining({
        severity: 'error',
        issue_type: 'missing_domain_sample_policy',
      }),
      expect.objectContaining({
        severity: 'error',
        issue_type: 'missing_required_video_type',
        video_type: 'heritage_promo',
      }),
      expect.objectContaining({
        severity: 'error',
        issue_type: 'missing_required_video_type',
        video_type: 'explainer_video',
      }),
    ]));

    expect(domainPackHealth).toMatchObject({
      schema_version: 'domain-pack-production-health/v1',
      status: 'failed',
      domain_id: 'china_culture',
      version: 'unknown',
      pack_count: 0,
      production_pack_count: 0,
      covered_required_pack_ids: [],
      production_ready_pack_ids: [],
    });
    expect(domainPackHealth.required_pack_ids).toHaveLength(8);
    expect(domainPackHealth.missing_required_pack_ids).toEqual(domainPackHealth.required_pack_ids);
    expect(domainPackHealth.issues).toHaveLength(8);
    expect(domainPackHealth.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        issue_type: 'missing_required_pack',
        pack_id: 'heritage_process_pack',
      }),
      expect.objectContaining({
        severity: 'error',
        issue_type: 'missing_required_pack',
        pack_id: 'explainer_knowledge_structure_pack',
      }),
    ]));

    expect(domainPackExpansionCandidates).toMatchObject({
      schema_version: 'domain-pack-expansion-candidates-report/v1',
      status: 'failed',
      source_schema_version: 'missing',
      batch_count: 0,
      seed_target_count: 0,
      candidate_field_count: 0,
      pipeline_progress_percent: 0,
      pipeline_stage: 'candidate_setup',
      video_type_coverage_count: 0,
      coverage_by_video_type: [],
      covered_required_pack_ids: [],
      review_packet: {
        schema_version: 'domain-pack-expansion-review-packet/v1',
        status: 'failed',
        batch_count: 0,
        review_item_count: 0,
        candidate_field_count: 0,
      },
    });
    expect(domainPackExpansionCandidates.required_pack_ids).toHaveLength(8);
    expect(domainPackExpansionCandidates.missing_required_pack_ids).toEqual(domainPackExpansionCandidates.required_pack_ids);
    expect(domainPackExpansionCandidates.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        issue_type: 'missing_candidate_file',
      }),
    ]));
  });

  it('fails closed when the canonical domain sample policy is invalid', () => {
    const packsDir = path.join(dataRoot, 'production-packs');
    fs.mkdirSync(packsDir, { recursive: true });
    fs.writeFileSync(
      path.join(packsDir, 'video-type-material-supplement-packs.json'),
      JSON.stringify({
        schema_version: 'video-type-material-supplement-packs/v1',
        health_policy: {
          required_domain_sample_video_types: ['children_story'],
          domain_sample_minimums: {
            children_story: { china_culture: 0, original_fiction: 2 },
          },
        },
        packs: [],
      }, null, 2),
      'utf8',
    );

    const report = getProductionMaterialPackHealthReport();

    expect(report.domain_sample_policy_valid).toBe(false);
    expect(report.status).toBe('failed');
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        issue_type: 'invalid_domain_sample_policy',
      }),
    ]));
  });

  it('fails closed when the domain sample policy references a pack that was not loaded', () => {
    const packsDir = path.join(dataRoot, 'production-packs');
    fs.mkdirSync(packsDir, { recursive: true });
    fs.writeFileSync(
      path.join(packsDir, 'video-type-material-supplement-packs.json'),
      JSON.stringify({
        schema_version: 'video-type-material-supplement-packs/v1',
        health_policy: {
          required_domain_sample_video_types: ['children_story'],
          domain_sample_minimums: {
            children_story: { china_culture: 2, original_fiction: 2 },
          },
        },
        packs: [],
      }, null, 2),
      'utf8',
    );

    const report = getProductionMaterialPackHealthReport();

    expect(report.domain_sample_policy_valid).toBe(false);
    expect(report.status).toBe('failed');
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        issue_type: 'invalid_domain_sample_policy',
        details: expect.arrayContaining([
          'policy video_type=children_story has no loaded ProductionMaterialPack',
        ]),
      }),
    ]));
  });

  it('renders markdown for standalone MCP health tool results by default', () => {
    const productionMaterialPackHealth = getProductionMaterialPackHealthToolResult();
    const domainPackHealth = getDomainPackProductionHealthToolResult();
    const domainPackExpansionCandidates = getDomainPackExpansionCandidateToolResult();

    expect(productionMaterialPackHealth.status).toBe('failed');
    expect(productionMaterialPackHealth.markdown).toContain('Production Material Pack Health');
    expect(productionMaterialPackHealth.markdown).toContain('missing_required_video_types');
    expect(productionMaterialPackHealth.markdown).toContain('heritage_promo');

    expect(domainPackHealth.status).toBe('failed');
    expect(domainPackHealth.markdown).toContain('Domain Pack Production Health');
    expect(domainPackHealth.markdown).toContain('missing_required_pack_ids');
    expect(domainPackHealth.markdown).toContain('heritage_process_pack');

    expect(getProductionMaterialPackHealthToolResult({ include_markdown: false }).markdown).toBeUndefined();
    expect(getDomainPackProductionHealthToolResult({ include_markdown: false }).markdown).toBeUndefined();

    expect(domainPackExpansionCandidates.status).toBe('failed');
    expect(domainPackExpansionCandidates.markdown).toContain('Domain Pack Expansion Candidates');
    expect(domainPackExpansionCandidates.markdown).toContain('missing_candidate_file');
    expect(domainPackExpansionCandidates.markdown).toContain('review_packet_item_count');
    expect(domainPackExpansionCandidates.markdown).toContain('video_type_coverage_count');
    expect(domainPackExpansionCandidates.markdown).toContain('Writeback Handoff');
    expect(domainPackExpansionCandidates.markdown).toContain('writeback_handoff_queue_path: /knowledge-writeback-queue');
    expect(domainPackExpansionCandidates.review_packet.markdown).toContain('Domain Pack Expansion Review Packet');
    expect(domainPackExpansionCandidates.review_packet.markdown).toContain('direct_writeback_to_province_markdown: true');
    expect(getDomainPackExpansionCandidateToolResult({ include_markdown: false }).markdown).toBeUndefined();
    expect(getDomainPackExpansionCandidateToolResult({ include_markdown: false }).review_packet.markdown).toBeUndefined();
    expect(getDomainPackExpansionWritebackDraftToolResult().markdown).toContain('Domain Pack Expansion Writeback Draft');
    expect(getDomainPackExpansionWritebackDraftToolResult({ include_markdown: false }).markdown).toBeUndefined();
  });

  it('reports domain sample coverage and keeps legacy samples out of original coverage', () => {
    const packsDir = path.join(dataRoot, 'production-packs');
    fs.mkdirSync(packsDir, { recursive: true });
    fs.writeFileSync(
      path.join(packsDir, 'video-type-material-supplement-packs.json'),
      JSON.stringify({
        schema_version: 'video-type-material-supplement-packs/v1',
        health_policy: {
          required_domain_sample_video_types: ['children_story'],
          domain_sample_minimums: {
            children_story: { china_culture: 2, original_fiction: 2 },
          },
        },
        packs: [{
          video_type: 'children_story',
          label: 'legacy children pack',
          goal: 'test domain coverage',
          material_template: {
            required_fields: [],
            prompt_layers: ['one', 'two', 'three', 'four'],
            minimum_viable_story_gate: ['one', 'two', 'three'],
            script_ready_gate: ['one', 'two', 'three'],
            production_ready_gate: ['one', 'two', 'three'],
            supplement_questions: ['one', 'two', 'three', 'four'],
          },
          sample_entries: [
            { sample_id: 'legacy-1', entry_name: 'legacy china sample' },
            {
              sample_id: 'original-1',
              entry_name: 'explicit original sample',
              applicable_source_domains: ['original_fiction'],
            },
            {
              sample_id: 'original-1',
              entry_name: 'duplicate original sample',
              applicable_source_domains: ['original_fiction'],
            },
          ],
        }],
      }, null, 2),
      'utf8',
    );

    const report = getProductionMaterialPackHealthToolResult();
    const summary = report.packs.find(pack => pack.video_type === 'children_story');
    expect(summary?.sample_entry_count_by_source_domain).toEqual({
      china_culture: 1,
      original_fiction: 1,
    });
    expect(summary?.sample_entry_count).toBe(3);
    expect(summary?.unique_sample_entry_count).toBe(2);
    expect(summary?.duplicate_sample_entry_ids).toEqual(['original-1']);
    expect(summary?.legacy_sample_entry_count).toBe(1);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        issue_type: 'duplicate_sample_entry',
        video_type: 'children_story',
      }),
      expect.objectContaining({
        issue_type: 'underfilled_domain_sample_entries',
        video_type: 'children_story',
        source_domain: 'original_fiction',
      }),
    ]));
    expect(report.markdown).toContain('original_fiction=1/2');
  });

  it('keeps canonical Web and MCP domain sample thresholds aligned', () => {
    process.env.KB_ROOT = path.resolve(process.cwd(), '..', 'data');
    const report = getProductionMaterialPackHealthReport();

    expect(report.status).toBe('passed');
    expect(report.domain_sample_policy_valid).toBe(true);
    expect(report.pack_file_valid).toBe(true);
    expect(report.pack_file_diagnostics).toEqual([]);
    expect(report.rejected_pack_count).toBe(0);
    expect(report.rejected_pack_diagnostics).toEqual([]);
    expect(report.domain_sample_policy_video_types).toEqual([
      'ai_comic_drama',
      'children_story',
      'social_short',
    ]);
    for (const videoType of ['children_story', 'social_short', 'ai_comic_drama']) {
      const summary = report.packs.find(pack => pack.video_type === videoType);
      expect(summary?.minimum_sample_entry_count_by_source_domain, videoType).toEqual({
        china_culture: 2,
        original_fiction: 2,
      });
      expect(summary?.sample_entry_count_by_source_domain.china_culture, videoType).toBeGreaterThanOrEqual(2);
      expect(summary?.sample_entry_count_by_source_domain.original_fiction, videoType).toBeGreaterThanOrEqual(2);
      expect(summary?.legacy_sample_entry_count, videoType).toBe(0);
    }
  });

  it('reports review-gated Domain Pack expansion candidates', () => {
    fs.mkdirSync(path.join(dataRoot, 'domain-packs'), { recursive: true });
    fs.writeFileSync(
      path.join(dataRoot, 'domain-packs', 'china-culture-production-expansion-candidates.json'),
      JSON.stringify({
        schema_version: 'domain-pack-expansion-candidates/v1',
        updated_at: '2026-07-07',
        domain_id: 'china_culture',
        review_policy: {
          direct_writeback_to_province_markdown: false,
          requires_candidate_markdown: true,
          requires_human_review: true,
          requires_source_level: true,
        },
        batches: [
          'heritage_process_pack',
          'documentary_source_pack',
          'ai_comic_storyboard_pack',
          'era_and_costume_pack',
          'explainer_knowledge_structure_pack',
          'children_adaptation_safety_pack',
          'short_video_hook_pack',
          'education_training_structure_pack',
        ].map(packId => ({
          batch_id: `${packId}_batch`,
          pack_id: packId,
          entry_name: `${packId} entry`,
          priority: 'P0',
          status: 'candidate_review',
          target_video_types: ['explainer_video'],
          field_groups: [{
            group_id: 'core',
            candidate_fields: ['core_question'],
            review_questions: ['是否进入候选稿审稿？'],
          }],
          seed_targets: [{
            entry_name: `${packId} target`,
            province: '湖南',
            recommended_fields: ['core_question'],
            candidate_status: 'candidate_review',
            forbidden_direct_claims: ['未经审稿不得写回正式知识库'],
            field_supplement_candidates: [{
              field_id: 'core_question',
              candidate_value: `${packId} 的核心讲解问题候选`,
              evidence_level: 'test_fixture',
              source_refs: ['data/provinces/湖南.md#测试条目'],
              writeback_hint: '仅用于 MCP 字段工作台测试。',
              verification_note: '测试样板不写入省份 Markdown。',
            }],
          }],
        })),
      }),
    );
    fs.mkdirSync(path.join(process.env.WEB_GENERATED_ROOT!, 'domain-pack-expansion'), { recursive: true });
    fs.writeFileSync(
      path.join(process.env.WEB_GENERATED_ROOT!, 'domain-pack-expansion', 'review-state.json'),
      JSON.stringify({
        schema_version: 'domain-pack-expansion-review-state/v1',
        updated_at: '2026-07-07T09:00:00.000Z',
        direct_writeback_to_province_markdown: false,
        items: [{
          review_item_id: 'heritage_process_pack_batch::target_01',
          review_status: 'approved',
          review_note: 'MCP 审稿通过，进入人工补源清单。',
          reviewed_at: '2026-07-07T09:00:00.000Z',
          reviewer_name: 'MCP复核人',
          reviewed_by: 'MCP复核人',
          writeback_status: 'queued',
          writeback_note: '先排入湖南非遗流程补录批次。',
          writeback_updated_at: '2026-07-07T09:00:00.000Z',
        }],
      }),
    );

    const report = getDomainPackExpansionCandidateReport();

    expect(report).toMatchObject({
      schema_version: 'domain-pack-expansion-candidates-report/v1',
      source_schema_version: 'domain-pack-expansion-candidates/v1',
      domain_id: 'china_culture',
      status: 'passed',
      missing_required_pack_ids: [],
      batch_count: 8,
      seed_target_count: 8,
      candidate_field_count: 8,
      pipeline_progress_percent: 78,
      pipeline_stage: 'human_review',
      field_workbench_item_count: 8,
      field_supplement_candidate_count: 8,
      field_missing_candidate_count: 0,
      field_candidate_completion_percent: 100,
      field_review_ready_count: 8,
      field_review_blocker_count: 0,
      field_review_ready_percent: 100,
      review_ready_item_count: 8,
      review_blocked_item_count: 0,
      field_supplement_priority_target_count: 0,
      field_supplement_priority_targets: [],
      review_ready_priority_target_count: 7,
      review_ready_priority_targets: expect.arrayContaining([
        expect.objectContaining({
          review_status: 'candidate_review',
          field_review_blocker_count: 0,
          field_review_ready_percent: 100,
          recommended_action: expect.stringContaining('人工审阅'),
        }),
      ]),
      video_type_coverage_count: 1,
      coverage_by_video_type: [
        expect.objectContaining({
          video_type: 'explainer_video',
          batch_count: 8,
          seed_target_count: 8,
          candidate_field_count: 1,
          field_workbench_item_count: 8,
          field_supplement_candidate_count: 8,
          field_missing_candidate_count: 0,
          field_candidate_completion_percent: 100,
          field_review_ready_count: 8,
          field_review_blocker_count: 0,
          field_review_ready_percent: 100,
          pack_ids: expect.arrayContaining([
            'heritage_process_pack',
            'explainer_knowledge_structure_pack',
          ]),
          provinces: ['湖南'],
          review_status_counts: {
            candidate_review: 7,
            approved: 1,
            rejected: 0,
            needs_revision: 0,
          },
          approved_writeback_draft_count: 1,
          writeback_status_counts: expect.objectContaining({
            queued: 1,
          }),
        }),
      ],
      issues: [],
      review_packet: {
        schema_version: 'domain-pack-expansion-review-packet/v1',
        status: 'passed',
        batch_count: 8,
        review_item_count: 8,
        candidate_field_count: 8,
        field_workbench_item_count: 8,
        field_supplement_candidate_count: 8,
        field_missing_candidate_count: 0,
        field_candidate_completion_percent: 100,
        field_review_ready_count: 8,
        field_review_blocker_count: 0,
        field_review_ready_percent: 100,
        review_ready_item_count: 8,
        review_blocked_item_count: 0,
        review_status_counts: {
          candidate_review: 7,
          approved: 1,
          rejected: 0,
          needs_revision: 0,
        },
        approved_writeback_draft_count: 1,
      },
      review_policy: {
        direct_writeback_to_province_markdown: false,
        requires_candidate_markdown: true,
        requires_human_review: true,
        requires_source_level: true,
      },
      writeback_handoff: {
        schema_version: 'domain-pack-expansion-writeback-handoff-summary/v1',
        ready_for_unified_export: true,
        target_file_count: 1,
        target_files: ['data/provinces/湖南.md'],
        approved_draft_count: 1,
        signoff_batch_count: 0,
        ready_for_signoff_count: 0,
        blocked_for_signoff_count: 8,
        source_ref_count: expect.any(Number),
        direct_writeback_to_province_markdown: false,
        province_markdown_written: false,
        writeback_queue_path: '/knowledge-writeback-queue',
      },
    });
    expect(report.batches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pack_id: 'heritage_process_pack',
        provinces: ['湖南'],
      }),
    ]));
    expect(report.review_packet.batches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pack_id: 'heritage_process_pack',
        review_items: expect.arrayContaining([
          expect.objectContaining({
            entry_name: 'heritage_process_pack target',
            review_status: 'approved',
            writeback_status: 'queued',
            review_state_source: 'runtime',
            review_state_overrides_seed: false,
            review_state_runtime_status: 'approved',
            field_supplement_candidate_count: 1,
            field_missing_candidate_count: 0,
            field_candidate_completion_percent: 100,
            field_review_ready_count: 1,
            field_review_blocker_count: 0,
            field_review_ready_percent: 100,
            review_ready: true,
            field_workbench: expect.arrayContaining([
              expect.objectContaining({
                field_id: 'core_question',
                supplement_status: 'candidate_draft',
                review_ready: true,
                review_ready_missing: [],
                candidate_value: 'heritage_process_pack 的核心讲解问题候选',
              }),
            ]),
            writeback_draft_markdown: expect.stringContaining('扩库候选审稿草案'),
            candidate_markdown: expect.stringContaining('review_state_source: runtime'),
          }),
        ]),
      }),
    ]));
    const toolResult = getDomainPackExpansionCandidateToolResult();
    expect(toolResult.markdown).toContain('## Video Type Coverage');
    expect(toolResult.markdown).toContain('explainer_video: batches=8');
    expect(toolResult.markdown).toContain('field_supplement_candidate_count: 8');
    expect(toolResult.markdown).toContain('field_missing_candidate_count: 0');
    expect(toolResult.markdown).toContain('field_candidate_completion_percent: 100');
    expect(toolResult.markdown).toContain('pipeline_progress_percent: 78');
    expect(toolResult.markdown).toContain('pipeline_stage: human_review');
    expect(toolResult.markdown).toContain('progress_percent: 99');
    expect(toolResult.markdown).toContain('progress_note: 扩库审稿页和统一写回队列已有 pack/video/province/status/source/handoff 筛选');
    expect(toolResult.markdown).toContain('field_review_ready_count: 8');
    expect(toolResult.markdown).toContain('field_review_blocker_count: 0');
    expect(toolResult.markdown).toContain('field_supplement_priority_target_count: 0');
    expect(toolResult.markdown).toContain('review_ready_priority_target_count: 7');
    expect(toolResult.markdown).toContain('Next Field Supplement Targets');
    expect(toolResult.markdown).toContain('Next Review Ready Targets');
    expect(toolResult.review_packet.markdown).toContain('Domain Pack Expansion Review Packet');
    expect(toolResult.review_packet.markdown).toContain('heritage_process_pack target');
    expect(toolResult.review_packet.markdown).toContain('Field supplement workbench');
    expect(toolResult.review_packet.markdown).toContain('review_ready: true');
    expect(toolResult.review_packet.markdown).toContain('review_state_source: runtime');
    expect(toolResult.review_packet.markdown).toContain('review_state_overrides_seed: false');
    expect(toolResult.review_packet.markdown).toContain('approved_writeback_draft_count: 1');

    const writebackDraft = getDomainPackExpansionWritebackDraftToolResult();
    expect(writebackDraft).toMatchObject({
      schema_version: 'domain-pack-expansion-writeback-draft/v1',
      domain_id: 'china_culture',
      approved_count: 1,
      target_files: ['data/provinces/湖南.md'],
      status_counts: expect.objectContaining({
        queued: 1,
      }),
    });
    expect(writebackDraft.items[0]).toMatchObject({
      review_item_id: 'heritage_process_pack_batch::target_01',
      suggested_file_path: 'data/provinces/湖南.md',
      writeback_status: 'queued',
      review_state_source: 'runtime',
      review_state_overrides_seed: false,
      review_state_runtime_status: 'approved',
      field_supplement_candidate_count: 1,
      field_missing_candidate_count: 0,
      field_candidate_completion_percent: 100,
      field_review_ready_count: 1,
      field_review_blocker_count: 0,
      field_review_ready_percent: 100,
      review_ready: true,
    });
    expect(writebackDraft.markdown).toContain('#### 字段候选值');
    expect(writebackDraft.markdown).toContain('review_state_source: runtime');
    expect(writebackDraft.markdown).toContain('heritage_process_pack 的核心讲解问题候选');
    expect(writebackDraft.markdown).toContain('本草案只作为人工补库采集清单');
  });

  it('updates expansion review state for MCP callers without writing province markdown', () => {
    fs.mkdirSync(path.join(dataRoot, 'domain-packs'), { recursive: true });
    fs.writeFileSync(
      path.join(dataRoot, 'domain-packs', 'china-culture-production-expansion-candidates.json'),
      JSON.stringify({
        schema_version: 'domain-pack-expansion-candidates/v1',
        updated_at: '2026-07-07',
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
          entry_name: 'heritage_process_pack entry',
          priority: 'P0',
          status: 'candidate_review',
          target_video_types: ['heritage_promo'],
          field_groups: [{
            group_id: 'core',
            candidate_fields: ['process_steps'],
            review_questions: ['是否已进入人工审稿？'],
          }],
          seed_targets: [{
            entry_name: 'heritage_process_pack target',
            province: '湖南',
            recommended_fields: ['process_steps'],
            candidate_status: 'candidate_review',
            forbidden_direct_claims: ['未经审稿不得写回正式知识库'],
            field_supplement_candidates: [{
              field_id: 'process_steps',
              candidate_value: '刻版→上色→套印→开脸，作为候选流程样板。',
              evidence_level: 'fixture_source',
              source_refs: ['data/provinces/湖南.md#测试流程'],
              writeback_hint: '只作为 MCP 审稿夹具写回草案，不直接改省份 Markdown。',
              verification_note: '测试夹具已补齐来源、证据层级和核实备注。',
            }],
          }],
        }],
      }),
    );

    const update = updateDomainPackExpansionReviewStateToolResult({
      review_item_id: 'heritage_process_pack_batch::target_01',
      review_status: 'approved',
      review_note: 'MCP 工具确认进入人工补源队列。',
      reviewer_name: 'MCP复核人',
      reviewed_by: 'MCP复核人',
      signoff_batch_id: 'mcp-signoff-batch-001',
      signoff_batch_note: 'MCP 单条审签批次归档测试。',
      writeback_status: 'queued',
      writeback_note: '先排入湖南非遗流程补录批次。',
      include_markdown: false,
    }, {
      updated_at: '2026-07-07T11:00:00.000Z',
    });

    expect(update).toMatchObject({
      schema_version: 'domain-pack-expansion-review-state-update/v1',
      updated_at: '2026-07-07T11:00:00.000Z',
      ok: true,
      review_item_id: 'heritage_process_pack_batch::target_01',
      review_status: 'approved',
      writeback_status: 'queued',
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
      report: {
        review_packet: {
          review_status_counts: expect.objectContaining({
            approved: 1,
          }),
          approved_writeback_draft_count: 1,
        },
      },
      writeback_draft: {
        approved_count: 1,
        target_files: ['data/provinces/湖南.md'],
      },
    });
    expect(update.report?.markdown).toBeUndefined();
    expect(update.writeback_draft?.markdown).toBeUndefined();
    expect(fs.existsSync(path.join(dataRoot, 'provinces', '湖南.md'))).toBe(false);

    const state = JSON.parse(
      fs.readFileSync(path.join(process.env.WEB_GENERATED_ROOT!, 'domain-pack-expansion', 'review-state.json'), 'utf8'),
    );
    expect(state).toMatchObject({
      schema_version: 'domain-pack-expansion-review-state/v1',
      direct_writeback_to_province_markdown: false,
      items: [expect.objectContaining({
        review_item_id: 'heritage_process_pack_batch::target_01',
        review_status: 'approved',
        signoff_batch_id: 'mcp-signoff-batch-001',
        signoff_batch_note: 'MCP 单条审签批次归档测试。',
        writeback_status: 'queued',
      })],
    });

    const revision = updateDomainPackExpansionReviewStateToolResult({
      review_item_id: 'heritage_process_pack_batch::target_01',
      review_status: 'needs_revision',
      review_note: '来源级证据不足，退回补充。',
      include_markdown: false,
    }, {
      updated_at: '2026-07-07T11:30:00.000Z',
    });

    expect(revision.ok).toBe(true);
    expect(revision.writeback_status).toBeUndefined();
    expect(revision.writeback_draft).toBeUndefined();
    expect(revision.report?.review_packet.review_status_counts).toMatchObject({
      needs_revision: 1,
      approved: 0,
    });
  });

  it('blocks MCP approval when expansion fields are not review ready', () => {
    fs.mkdirSync(path.join(dataRoot, 'domain-packs'), { recursive: true });
    fs.writeFileSync(
      path.join(dataRoot, 'domain-packs', 'china-culture-production-expansion-candidates.json'),
      JSON.stringify({
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
          batch_id: 'heritage_process_pack_blocked_batch',
          pack_id: 'heritage_process_pack',
          entry_name: 'blocked entry',
          priority: 'P0',
          status: 'candidate_review',
          target_video_types: ['explainer_video'],
          field_groups: [{
            group_id: 'source_gate',
            candidate_fields: ['core_question'],
            review_questions: ['是否补齐来源级证据？'],
          }],
          seed_targets: [{
            entry_name: 'blocked target',
            province: '湖南',
            recommended_fields: ['core_question'],
            candidate_status: 'candidate_review',
            forbidden_direct_claims: ['未经审稿不得写回正式知识库'],
            field_supplement_candidates: [{
              field_id: 'core_question',
              candidate_value: '缺少来源级证据的候选问题。',
            }],
          }],
        }],
      }),
    );

    const report = getDomainPackExpansionCandidateReport();
    const reviewItem = report.review_packet.batches.flatMap(batch => batch.review_items)[0];
    expect(reviewItem).toMatchObject({
      review_ready: false,
      field_review_blocker_count: 1,
      field_workbench: [expect.objectContaining({
        review_ready: false,
        review_ready_missing: expect.arrayContaining([
          'evidence_level',
          'source_refs',
          'writeback_hint',
          'verification_note',
        ]),
      })],
    });

    const update = updateDomainPackExpansionReviewStateToolResult({
      review_item_id: 'heritage_process_pack_blocked_batch::target_01',
      review_status: 'approved',
      writeback_status: 'queued',
      include_markdown: false,
    }, {
      updated_at: '2026-07-08T02:00:00.000Z',
    });
    expect(update).toMatchObject({
      schema_version: 'domain-pack-expansion-review-state-update/v1',
      ok: false,
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
      message: expect.stringContaining('字段审稿阻断'),
    });
    expect(update.message).toContain('evidence_level/source_refs/writeback_hint/verification_note');

    const bulkUpdate = updateDomainPackExpansionReviewStateBulkToolResult({
      review_item_ids: ['heritage_process_pack_blocked_batch::target_01'],
      review_status: 'approved',
      writeback_status: 'queued',
      include_markdown: false,
    }, {
      updated_at: '2026-07-08T02:05:00.000Z',
    });
    expect(bulkUpdate).toMatchObject({
      schema_version: 'domain-pack-expansion-review-state-bulk-update/v1',
      ok: false,
      updated_count: 0,
      province_markdown_written: false,
      message: expect.stringContaining('字段审稿阻断'),
    });
  });

  it('bulk updates expansion review state for MCP callers without writing province markdown', () => {
    fs.mkdirSync(path.join(dataRoot, 'domain-packs'), { recursive: true });
    fs.writeFileSync(
      path.join(dataRoot, 'domain-packs', 'china-culture-production-expansion-candidates.json'),
      JSON.stringify({
        schema_version: 'domain-pack-expansion-candidates/v1',
        updated_at: '2026-07-07',
        domain_id: 'china_culture',
        review_policy: {
          direct_writeback_to_province_markdown: false,
          requires_candidate_markdown: true,
          requires_human_review: true,
          requires_source_level: true,
        },
        batches: [{
          batch_id: 'short_video_hook_pack_batch',
          pack_id: 'short_video_hook_pack',
          entry_name: 'short_video_hook_pack entry',
          priority: 'P0',
          status: 'candidate_review',
          target_video_types: ['social_short', 'explainer_video'],
          field_groups: [{
            group_id: 'hook_structure',
            candidate_fields: ['opening_hook', 'fact_boundary_card'],
            review_questions: ['是否已确认只进入批量审稿队列？'],
          }],
          seed_targets: [
            {
              entry_name: 'short_video_hook_pack target 1',
              province: '湖南',
              recommended_fields: ['opening_hook'],
              candidate_status: 'candidate_review',
              forbidden_direct_claims: ['未经审稿不得写回正式知识库'],
              field_supplement_candidates: [{
                field_id: 'opening_hook',
                candidate_value: '一个反差问题开场，引导观众进入事实边界。',
                evidence_level: 'fixture_source',
                source_refs: ['data/provinces/湖南.md#测试钩子1'],
                writeback_hint: '只作为批量审稿夹具，不直接写回。',
                verification_note: '测试夹具已补齐审稿字段。',
              }],
            },
            {
              entry_name: 'short_video_hook_pack target 2',
              province: '湖南',
              recommended_fields: ['fact_boundary_card'],
              candidate_status: 'candidate_review',
              forbidden_direct_claims: ['不得把候选钩子当成已核实事实'],
              field_supplement_candidates: [{
                field_id: 'fact_boundary_card',
                candidate_value: '本片只说明可核实事实，传说和推测必须标注。',
                evidence_level: 'fixture_source',
                source_refs: ['data/provinces/湖南.md#测试钩子2'],
                writeback_hint: '只作为批量审稿夹具，不直接写回。',
                verification_note: '测试夹具已补齐审稿字段。',
              }],
            },
          ],
        }],
      }),
    );

    const update = updateDomainPackExpansionReviewStateBulkToolResult({
      review_item_ids: [
        'short_video_hook_pack_batch::target_01',
        'short_video_hook_pack_batch::target_02',
        'short_video_hook_pack_batch::target_02',
      ],
      review_status: 'approved',
      review_note: 'MCP 批量审稿通过，仍需补足来源级证据。',
      writeback_status: 'queued',
      writeback_note: '批量进入短视频钩子包写回队列。',
      include_markdown: false,
    }, {
      updated_at: '2026-07-07T12:00:00.000Z',
    });

    expect(update).toMatchObject({
      schema_version: 'domain-pack-expansion-review-state-bulk-update/v1',
      updated_at: '2026-07-07T12:00:00.000Z',
      ok: true,
      updated_count: 2,
      missing_review_item_ids: [],
      review_status: 'approved',
      writeback_status: 'queued',
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
      report: {
        review_packet: {
          review_status_counts: expect.objectContaining({
            approved: 2,
          }),
          approved_writeback_draft_count: 2,
        },
      },
      writeback_draft: {
        approved_count: 2,
        target_files: ['data/provinces/湖南.md'],
        status_counts: expect.objectContaining({
          queued: 2,
        }),
      },
    });
    expect(update.report?.markdown).toBeUndefined();
    expect(update.writeback_draft?.markdown).toBeUndefined();
    expect(fs.existsSync(path.join(dataRoot, 'provinces', '湖南.md'))).toBe(false);

    const scopedDraft = getDomainPackExpansionWritebackDraftToolResult({
      include_markdown: false,
      pack_ids: ['short_video_hook_pack'],
      video_types: ['social_short'],
      provinces: ['湖南'],
      writeback_statuses: ['queued'],
    });
    expect(scopedDraft).toMatchObject({
      approved_count: 2,
      target_files: ['data/provinces/湖南.md'],
      direct_writeback_to_province_markdown: false,
      filters: {
        pack_ids: ['short_video_hook_pack'],
        video_types: ['social_short'],
        provinces: ['湖南'],
        writeback_statuses: ['queued'],
      },
      status_counts: expect.objectContaining({
        queued: 2,
      }),
    });
    expect(scopedDraft.items).toHaveLength(2);

    const emptyDraft = getDomainPackExpansionWritebackDraftToolResult({
      include_markdown: false,
      pack_ids: ['short_video_hook_pack'],
      writeback_statuses: ['draft_ready'],
    });
    expect(emptyDraft).toMatchObject({
      approved_count: 0,
      target_files: [],
      filters: {
        pack_ids: ['short_video_hook_pack'],
        writeback_statuses: ['draft_ready'],
      },
    });

    const state = JSON.parse(
      fs.readFileSync(path.join(process.env.WEB_GENERATED_ROOT!, 'domain-pack-expansion', 'review-state.json'), 'utf8'),
    );
    expect(state).toMatchObject({
      schema_version: 'domain-pack-expansion-review-state/v1',
      direct_writeback_to_province_markdown: false,
      items: [
        expect.objectContaining({
          review_item_id: 'short_video_hook_pack_batch::target_01',
          review_status: 'approved',
          writeback_status: 'queued',
        }),
        expect.objectContaining({
          review_item_id: 'short_video_hook_pack_batch::target_02',
          review_status: 'approved',
          writeback_status: 'queued',
        }),
      ],
    });

    const missing = updateDomainPackExpansionReviewStateBulkToolResult({
      review_item_ids: ['short_video_hook_pack_batch::missing'],
      review_status: 'approved',
      include_markdown: false,
    }, {
      updated_at: '2026-07-07T12:30:00.000Z',
    });

    expect(missing).toMatchObject({
      schema_version: 'domain-pack-expansion-review-state-bulk-update/v1',
      ok: false,
      updated_count: 0,
      missing_review_item_ids: ['short_video_hook_pack_batch::missing'],
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
    });
    expect(fs.existsSync(path.join(dataRoot, 'provinces', '湖南.md'))).toBe(false);
  });

  it('exports unified project and expansion writeback drafts for MCP callers without writing province markdown', () => {
    fs.mkdirSync(path.join(dataRoot, 'domain-packs'), { recursive: true });
    fs.writeFileSync(
      path.join(dataRoot, 'domain-packs', 'china-culture-production-expansion-candidates.json'),
      JSON.stringify({
        schema_version: 'domain-pack-expansion-candidates/v1',
        updated_at: '2026-07-07',
        domain_id: 'china_culture',
        review_policy: {
          direct_writeback_to_province_markdown: false,
          requires_candidate_markdown: true,
          requires_human_review: true,
          requires_source_level: true,
        },
        batches: [{
          batch_id: 'short_video_hook_pack_batch',
          pack_id: 'short_video_hook_pack',
          entry_name: 'short_video_hook_pack entry',
          priority: 'P0',
          status: 'candidate_review',
          target_video_types: ['social_short'],
          field_groups: [{
            group_id: 'hook_structure',
            candidate_fields: ['opening_hook', 'fact_boundary_card'],
            review_questions: ['是否已确认只进入批量审稿队列？'],
          }],
          seed_targets: [{
            entry_name: 'short_video_hook_pack target',
            province: '湖南',
            recommended_fields: ['opening_hook'],
            candidate_status: 'candidate_review',
            forbidden_direct_claims: ['未经审稿不得写回正式知识库'],
          }],
        }],
      }),
    );
    fs.mkdirSync(path.join(process.env.WEB_GENERATED_ROOT!, 'domain-pack-expansion'), { recursive: true });
    fs.writeFileSync(
      path.join(process.env.WEB_GENERATED_ROOT!, 'domain-pack-expansion', 'review-state.json'),
      JSON.stringify({
        schema_version: 'domain-pack-expansion-review-state/v1',
        updated_at: '2026-07-07T13:00:00.000Z',
        direct_writeback_to_province_markdown: false,
        items: [{
          review_item_id: 'short_video_hook_pack_batch::target_01',
          review_status: 'approved',
          review_note: 'MCP 审稿通过，进入统一写回导出。',
          reviewed_at: '2026-07-07T13:00:00.000Z',
          reviewer_name: 'MCP统一导出复核人',
          reviewed_by: 'MCP统一导出复核人',
          signoff_batch_id: 'mcp-unified-signoff-001',
          signoff_batch_note: 'MCP 统一写回导出审签批次归档测试。',
          writeback_status: 'queued',
          writeback_note: '扩库入队。',
          writeback_updated_at: '2026-07-07T13:00:00.000Z',
        }],
      }),
    );

    const projectId = '20260707-story-writeback--ai_comic_drama';
    const versionId = `${projectId}-v1`;
    const projectDir = path.join(process.env.WEB_GENERATED_ROOT!, 'projects', projectId);
    fs.mkdirSync(path.join(projectDir, 'versions'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'project.json'),
      JSON.stringify({
        project_id: projectId,
        current_story_id: 'story-writeback',
        title: '青石巷追问',
        source_entry: '青石巷',
        video_type: 'ai_comic_drama',
        current_version_id: versionId,
        updated_at: '2026-07-07T13:10:00.000Z',
      }),
    );
    fs.writeFileSync(
      path.join(projectDir, 'versions', `${versionId}.json`),
      JSON.stringify({
        project_id: projectId,
        version_id: versionId,
        story: {
          title: '青石巷追问',
          source_entry: '青石巷',
          video_type: 'ai_comic_drama',
          knowledge_pack: {
            primary_entries: [{
              entry_name: '青石巷',
              province: '湖南',
            }],
          },
          supplement_tasks: [{
            task_id: 'task-reference-frame',
            label: '补录参考图或关键帧',
            description: '补齐 AI 漫剧参考图。',
            recommended_fields: ['reference_images_or_keyframes'],
            knowledge_candidate_review_status: 'approved',
            knowledge_candidate_review_note: '项目候选稿已通过。',
            knowledge_writeback_draft_markdown: '### 正式知识库写入草案\n\n- 核实方法：人工补源后写入。\n- 待核实点：参考图版权与来源。',
            knowledge_writeback_status: 'queued',
            knowledge_writeback_note: '项目草案入队。',
          }],
        },
      }),
    );

    const unified = getKnowledgeWritebackQueueExportToolResult({
      province: '湖南',
      knowledge_writeback_status: 'queued',
    });

    expect(unified).toMatchObject({
      schema_version: 'knowledge-writeback-queue-export/v1',
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
      filters: {
        province: '湖南',
        knowledge_writeback_status: 'queued',
      },
      approved_count: 2,
      project_approved_count: 1,
      expansion_approved_count: 1,
      project_count: 1,
      target_files: ['data/provinces/湖南.md'],
      status_counts: {
        project: expect.objectContaining({ queued: 1 }),
        expansion: expect.objectContaining({ queued: 1 }),
        total: expect.objectContaining({ queued: 2 }),
      },
      preflight: {
        schema_version: 'knowledge-writeback-queue-export-preflight/v1',
        direct_writeback_to_province_markdown: false,
        province_markdown_written: false,
        target_file_count: 1,
        target_files: ['data/provinces/湖南.md'],
        total_draft_count: 2,
        project_draft_count: 1,
        expansion_draft_count: 1,
        expansion_candidate_field_count: 0,
        expansion_field_missing_count: 1,
        manual_review_required_count: 2,
        blocked_direct_writeback_count: 2,
        ready_for_manual_export: false,
        source_ref_quality: expect.objectContaining({
          schema_version: 'knowledge-writeback-source-ref-quality/v1',
          blocker_item_count: expect.any(Number),
          warning_item_count: expect.any(Number),
          missing_source_ref_field_count: expect.any(Number),
        }),
        target_file_preflight: [expect.objectContaining({
          target_file: 'data/provinces/湖南.md',
          project_draft_count: 1,
          expansion_draft_count: 1,
          expansion_candidate_field_count: 0,
          expansion_field_missing_count: 1,
          source_ref_coverage_percent: expect.any(Number),
          source_ref_quality_level: expect.stringMatching(/pass|warning|blocker/),
          source_ref_blocker_count: expect.any(Number),
          source_ref_warning_count: expect.any(Number),
          direct_writeback_to_province_markdown: false,
        })],
        review_handoff: expect.objectContaining({
          schema_version: 'knowledge-writeback-queue-review-handoff/v1',
          signoff_manifest: expect.objectContaining({
            schema_version: 'knowledge-writeback-queue-signoff-manifest/v1',
            manifest_id: expect.stringMatching(/^kwb-signoff-/),
            sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
            item_count: 2,
            target_file_count: 1,
            requires_manual_signoff_count: 2,
            signoff_batch_ids: ['mcp-unified-signoff-001'],
            direct_writeback_to_province_markdown: false,
            province_markdown_written: false,
          }),
          total_handoff_count: 2,
          project_handoff_count: 1,
          expansion_handoff_count: 1,
          requires_manual_signoff_count: 2,
          reviewer_identity_count: 1,
          missing_reviewer_identity_count: 1,
          signoff_batch_count: 1,
          missing_signoff_batch_count: 1,
          signoff_batch_ids: ['mcp-unified-signoff-001'],
          signoff_batch_summaries: expect.arrayContaining([
            expect.objectContaining({
              signoff_batch_id: 'mcp-unified-signoff-001',
              signoff_batch_note: 'MCP 统一写回导出审签批次归档测试。',
              item_count: 1,
              expansion_handoff_count: 1,
              ready_for_signoff_count: 0,
              blocked_for_signoff_count: 1,
              status_counts: expect.objectContaining({
                queued: 1,
              }),
            }),
            expect.objectContaining({
              signoff_batch_id: 'unassigned_signoff_batch',
              item_count: 1,
              project_handoff_count: 1,
              ready_for_signoff_count: 0,
              blocked_for_signoff_count: 1,
            }),
          ]),
          items: expect.arrayContaining([
            expect.objectContaining({
              source_kind: 'project',
              writeback_status: 'queued',
            }),
            expect.objectContaining({
              source_kind: 'domain_pack_expansion',
              writeback_status: 'queued',
              reviewed_by: 'MCP统一导出复核人',
              signoff_batch_id: 'mcp-unified-signoff-001',
            }),
          ]),
        }),
      },
      signoff_package: expect.objectContaining({
        schema_version: 'knowledge-writeback-queue-signoff-package/v1',
        handoff_item_count: 2,
        direct_writeback_to_province_markdown: false,
        province_markdown_written: false,
        signoff_manifest: expect.objectContaining({
          manifest_id: expect.stringMatching(/^kwb-signoff-/),
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          signoff_batch_ids: ['mcp-unified-signoff-001'],
        }),
        signoff_batch_summaries: expect.arrayContaining([
          expect.objectContaining({
            signoff_batch_id: 'mcp-unified-signoff-001',
            blocked_for_signoff_count: 1,
          }),
          expect.objectContaining({
            signoff_batch_id: 'unassigned_signoff_batch',
            blocked_for_signoff_count: 1,
          }),
        ]),
      }),
      manual_patch_package: expect.objectContaining({
        schema_version: 'knowledge-writeback-manual-patch-package/v1',
        direct_writeback_to_province_markdown: false,
        province_markdown_written: false,
        patch_applyable: false,
        manual_apply_only: true,
        ready_for_manual_apply: false,
        target_file_count: 1,
        target_files: ['data/provinces/湖南.md'],
        ready_target_file_count: 0,
        blocked_target_file_count: 1,
        total_patch_count: 2,
        project_patch_count: 1,
        expansion_patch_count: 1,
        candidate_field_count: 0,
        source_ref_quality: expect.objectContaining({
          schema_version: 'knowledge-writeback-source-ref-quality/v1',
          blocker_item_count: expect.any(Number),
          warning_item_count: expect.any(Number),
          source_ref_check_warning_count: expect.any(Number),
          source_ref_check_blocker_count: expect.any(Number),
        }),
        manual_patch_manifest: expect.objectContaining({
          schema_version: 'knowledge-writeback-manual-patch-manifest/v1',
          manifest_id: expect.stringMatching(/^kwb-manual-patch-/),
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          target_file_count: 1,
          ready_target_file_count: 0,
          blocked_target_file_count: 1,
          patch_applyable: false,
          manual_apply_only: true,
        }),
        manual_patch_closure_certificate: expect.objectContaining({
          schema_version: 'knowledge-writeback-manual-patch-closure-certificate/v1',
          certificate_id: expect.stringMatching(/^kwb-manual-closure-/),
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          status: 'blocked',
          ready_for_operator_apply: false,
          target_file_count: 1,
          ready_target_file_count: 0,
          blocked_target_file_count: 1,
          patch_applyable: false,
          manual_apply_only: true,
          operator_required_actions: expect.any(Array),
        }),
        target_patches: [expect.objectContaining({
          target_file: 'data/provinces/湖南.md',
          patch_applyable: false,
          manual_apply_only: true,
          ready_for_manual_apply: false,
          total_patch_count: 2,
          project_patch_count: 1,
          expansion_patch_count: 1,
          source_ref_quality_level: expect.stringMatching(/warning|blocker/),
          blocker_reasons: expect.any(Array),
          warning_reasons: expect.any(Array),
          diff_preview_lines: expect.arrayContaining([
            expect.stringContaining('@@ manual_append_review_only @@'),
          ]),
          append_markdown: expect.stringContaining('short_video_hook_pack_batch::target_01'),
          review_diff: expect.stringContaining('@@ manual_append_review_only @@'),
          safety_checks: expect.arrayContaining([
            'direct_writeback_to_province_markdown=false',
            'province_markdown_written=false',
            'patch_applyable=false',
            'manual_apply_only=true',
          ]),
        })],
      }),
      project_patch: {
        schema_version: 'project-knowledge-writeback-patch/v1',
        approved_count: 1,
        project_count: 1,
        status_counts: expect.objectContaining({ queued: 1 }),
      },
      expansion_draft: {
        schema_version: 'domain-pack-expansion-writeback-draft/v1',
        approved_count: 1,
        status_counts: expect.objectContaining({ queued: 1 }),
      },
    });
    expect(unified.project_patch.items[0]).toMatchObject({
      task_key: `${projectId}::task-reference-frame`,
      project_id: projectId,
      video_type: 'ai_comic_drama',
      target_province: '湖南',
      writeback_status: 'queued',
    });
    expect(unified.expansion_draft.items[0]).toMatchObject({
      review_item_id: 'short_video_hook_pack_batch::target_01',
      province: '湖南',
      writeback_status: 'queued',
    });
    expect(unified.preflight.source_ref_quality.blocker_item_count).toBeGreaterThanOrEqual(1);
    expect(unified.manual_patch_package.blocker_reasons).toEqual(expect.arrayContaining([
      expect.stringContaining('source_ref_quality_blockers='),
    ]));
    expect(unified.markdown).toContain('Knowledge Writeback Queue Export');
    expect(unified.markdown).toContain('province_markdown_written: false');
    expect(unified.markdown).toContain('Export Preflight');
    expect(unified.markdown).toContain('Review Handoff');
    expect(unified.markdown).toContain('Signoff Package');
    expect(unified.markdown).toContain('Manual Writeback Patch Package');
    expect(unified.markdown).toContain('knowledge-writeback-manual-patch-package/v1');
    expect(unified.markdown).toContain('knowledge-writeback-manual-patch-closure-certificate/v1');
    expect(unified.markdown).toContain('closure_certificate_ready: false');
    expect(unified.markdown).toContain('manual_patch_ready: false');
    expect(unified.markdown).toContain('patch_applyable: false');
    expect(unified.markdown).toContain('@@ manual_append_review_only @@');
    expect(unified.markdown).toContain('Signoff Batch Summaries');
    expect(unified.markdown).toContain('signoff_batch_summary_count: 2');
    expect(unified.markdown).toContain('signoff_manifest_id: kwb-signoff-');
    expect(unified.markdown).toContain('expansion_field_diff');
    expect(unified.markdown).toContain('项目草案来源');
    expect(fs.existsSync(path.join(dataRoot, 'provinces', '湖南.md'))).toBe(false);

    const jsonOnly = getKnowledgeWritebackQueueExportToolResult({
      include_markdown: false,
      project_id: projectId,
      project_task_keys: [`${projectId}::task-reference-frame`],
    });
    expect(jsonOnly.markdown).toBeUndefined();
    expect(jsonOnly.project_approved_count).toBe(1);
    expect(jsonOnly.expansion_approved_count).toBe(0);
    expect(jsonOnly.expansion_draft.items).toHaveLength(0);
    expect(jsonOnly.filters).toMatchObject({
      project_id: projectId,
      project_task_key_count: 1,
    });
    expect(fs.existsSync(path.join(dataRoot, 'provinces', '湖南.md'))).toBe(false);
  });

  it('exports Story Agent supplement candidate packages without writing province markdown', () => {
    const projectId = '20260708-story-supplement--documentary_short';
    const versionId = `${projectId}-v1`;
    const projectDir = path.join(process.env.WEB_GENERATED_ROOT!, 'projects', projectId);
    fs.mkdirSync(path.join(projectDir, 'versions'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'project.json'),
      JSON.stringify({
        project_id: projectId,
        current_story_id: 'story-supplement',
        title: '侗寨鼓楼的夜谈',
        source_entry: '侗寨鼓楼',
        video_type: 'documentary_short',
        current_version_id: versionId,
        updated_at: '2026-07-08T10:00:00.000Z',
      }),
    );
    fs.writeFileSync(
      path.join(projectDir, 'versions', `${versionId}.json`),
      JSON.stringify({
        project_id: projectId,
        version_id: versionId,
        story: {
          story_id: 'story-supplement',
          title: '侗寨鼓楼的夜谈',
          source_entry: '侗寨鼓楼',
          video_type: 'documentary_short',
          knowledge_pack: {
            primary_entries: [{
              entry_name: '侗寨鼓楼',
              province: '贵州',
            }],
          },
          supplement_tasks: [
            {
              task_id: 'task-source-refs',
              label: '补齐口述来源与拍摄许可',
              description: '纪录短片需要补齐口述对象、引用出处和拍摄许可边界。',
              category: 'source_grounding',
              stage: 'production_ready',
              blocking_level: 'blocking',
              affects: ['source_refs', 'release_boundary'],
              recommended_question: '是否有可公开引用的访谈对象、出版物或地方志来源？',
              recommended_fields: ['source_refs', 'permission_boundary'],
              intake_prompt: '补充访谈对象、引用来源、许可边界和待核实点。',
              status: 'open',
              source: 'production_material_missing_field',
              updated_at: '2026-07-08T10:10:00.000Z',
              supplement_note: '已收集一条地方志线索，仍需人工核验。',
              supplement_field_values: {
                source_refs: '县志条目待人工核对；访谈对象待确认授权。',
                permission_boundary: '不可直接使用人物肖像，需另取授权。',
              },
              knowledge_candidate_markdown: '### 候选补库稿\n\n- 来源：县志与访谈授权待核。',
              knowledge_candidate_review_status: 'candidate_review',
              knowledge_candidate_review_note: '需要补齐正式页码或访谈记录。',
              knowledge_writeback_draft_markdown: '### 正式知识库写入草案\n\n- 待核实点：来源页码、授权记录。',
              knowledge_writeback_status: 'needs_revision',
              knowledge_writeback_note: '来源未达写回标准。',
            },
            {
              task_id: 'task-resolved-context',
              label: '已解决背景补充',
              description: '已补齐背景信息。',
              status: 'resolved',
              source: 'knowledge_pack_missing_need',
              blocking_level: 'optional',
            },
          ],
        },
      }),
    );

    const candidatePackage = getStorySupplementCandidatePackageToolResult({
      province: '贵州',
      status: 'open',
      stage: 'production_ready',
      blocking_level: 'blocking',
      source: 'production_material_missing_field',
      search_query: '拍摄许可',
      project_task_keys: [`${projectId}::task-source-refs`],
    });

    expect(candidatePackage).toMatchObject({
      schema_version: 'project-supplement-candidate-package/v1',
      direct_writeback_to_province_markdown: false,
      province_markdown_written: false,
      filters: {
        province: '贵州',
        status: 'open',
        stage: 'production_ready',
        blocking_level: 'blocking',
        source: 'production_material_missing_field',
        search_query: '拍摄许可',
        task_key_count: 1,
      },
      task_count: 1,
      open_task_count: 1,
      blocking_open_count: 1,
      risk_open_count: 0,
      optional_open_count: 0,
      project_count: 1,
      target_files: ['data/provinces/贵州.md'],
    });
    expect(candidatePackage.items[0]).toMatchObject({
      task_key: `${projectId}::task-source-refs`,
      project_id: projectId,
      current_story_id: 'story-supplement',
      project_title: '侗寨鼓楼的夜谈',
      source_entry: '侗寨鼓楼',
      video_type: 'documentary_short',
      target_province: '贵州',
      suggested_file_path: 'data/provinces/贵州.md',
      task: expect.objectContaining({
        task_id: 'task-source-refs',
        status: 'open',
        stage: 'production_ready',
        blocking_level: 'blocking',
        source: 'production_material_missing_field',
        recommended_fields: ['source_refs', 'permission_boundary'],
        knowledge_writeback_status: 'needs_revision',
      }),
    });
    expect(candidatePackage.markdown).toContain('Story Agent 素材补库候选包');
    expect(candidatePackage.markdown).toContain('不直接修改 data/provinces/*.md');
    expect(candidatePackage.markdown).toContain('source_refs: 县志条目待人工核对；访谈对象待确认授权。');
    expect(candidatePackage.markdown).toContain('candidate_review_status: candidate_review');
    expect(fs.existsSync(path.join(dataRoot, 'provinces', '贵州.md'))).toBe(false);

    const jsonOnly = getStorySupplementCandidatePackageToolResult({
      include_markdown: false,
      project_id: projectId,
      status: 'resolved',
    });
    expect(jsonOnly.markdown).toBeUndefined();
    expect(jsonOnly.task_count).toBe(1);
    expect(jsonOnly.open_task_count).toBe(0);
    expect(jsonOnly.items[0].task.task_id).toBe('task-resolved-context');
    expect(fs.existsSync(path.join(dataRoot, 'provinces', '贵州.md'))).toBe(false);
  });
});
