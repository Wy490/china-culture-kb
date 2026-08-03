import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MaterialPack, ProductionMaterialPack } from '@shared/types.js';
import { VIDEO_TYPE_CONFIG } from '@shared/types.js';
import {
  getProductionMaterialPack,
  getProductionMaterialPackHealthReport,
  getProductionMaterialPacks,
  scopeProductionMaterialPackToSourceDomain,
} from '../services/production-material-pack-service.js';
import {
  buildProductionMaterialReadinessReport,
  getProductionMaterialFieldSpec,
} from '../services/production-material-readiness-service.js';

function makeMaterialPack(summary: string): MaterialPack {
  return {
    schema_version: 'material-pack/v1',
    primary_materials: [{
      material_id: 'primary-1',
      title: '测试素材',
      summary,
      source_type: 'knowledge_entry',
      purpose: ['fact_basis'],
      confidence: 0.75,
      tags: ['测试'],
    }],
    supporting_materials: [],
    reference_materials: [],
    visual_assets: [],
    verified_facts: [summary],
    uncertain_claims: ['部分生产素材待核实。'],
    creative_space: [],
    missing_needs: [],
    overall_confidence: 0.75,
  };
}

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

const productionHealthConformance = JSON.parse(readFileSync(resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'data',
  'production-packs',
  'production-material-pack-health-conformance.json',
), 'utf8')) as ProductionHealthConformanceFixture;

function makeConformancePack(
  videoType: string,
  sampleEntries?: unknown[],
): ProductionMaterialPack {
  return {
    ...productionHealthConformance.standard_pack,
    video_type: videoType,
    sample_entries: sampleEntries ?? Object.keys(productionHealthConformance.valid_domain_minimums)
      .map(sourceDomain => ({
        sample_id: `${videoType}-${sourceDomain}`,
        entry_name: `${videoType} ${sourceDomain}`,
        applicable_source_domains: [sourceDomain],
      })),
  } as unknown as ProductionMaterialPack;
}

function makePackStructureConformancePack(
  testCase: ProductionPackStructureConformanceCase,
): ProductionMaterialPack {
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
  return pack as unknown as ProductionMaterialPack;
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

describe('production-material-readiness-service', () => {
  it('matches the shared production health conformance matrix', () => {
    expect(productionHealthConformance.schema_version)
      .toBe('production-material-pack-health-conformance/v1');
    expect([...productionHealthConformance.supported_video_types].sort())
      .toEqual(Object.keys(VIDEO_TYPE_CONFIG).sort());

    for (const testCase of productionHealthConformance.cases) {
      const packs = testCase.loaded_video_types.map(videoType => makeConformancePack(
        videoType,
        testCase.sample_entries_by_video_type?.[videoType],
      ));
      const report = getProductionMaterialPackHealthReport({
        generatedAt: '2026-07-17T00:00:00.000Z',
        productionMaterialPacks: packs,
        requiredVideoTypes: [],
        coreVideoTypes: [],
        highFrequencyVideoTypes: [],
        domainSamplePolicy: testCase.health_policy,
      });
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

  it('filters malformed injected packs using the shared structure matrix', () => {
    for (const testCase of productionHealthConformance.pack_structure_cases) {
      const report = getProductionMaterialPackHealthReport({
        generatedAt: '2026-07-17T00:00:00.000Z',
        productionMaterialPacks: [makePackStructureConformancePack(testCase)],
        requiredVideoTypes: [],
        coreVideoTypes: [],
        highFrequencyVideoTypes: [],
        domainSamplePolicy: {
          required_domain_sample_video_types: ['children_story'],
          domain_sample_minimums: {
            children_story: productionHealthConformance.valid_domain_minimums,
          },
        },
      });

      expect(report.pack_count, testCase.case_id).toBe(testCase.expected.loaded_pack_count);
      expect(report.domain_sample_policy_valid, testCase.case_id)
        .toBe(testCase.expected.domain_sample_policy_valid);
      const expectedDiagnostic = productionHealthConformance
        .pack_structure_diagnostic_expectations[testCase.case_id];
      expect(report.rejected_pack_count, testCase.case_id).toBe(expectedDiagnostic ? 1 : 0);
      expect(report.rejected_pack_diagnostics, testCase.case_id)
        .toEqual(expectedDiagnostic ? [expectedDiagnostic] : []);
    }
  });

  it('fails closed with shared diagnostics for malformed pack file roots', () => {
    for (const testCase of productionHealthConformance.pack_file_structure_cases) {
      const report = getProductionMaterialPackHealthReport({
        productionMaterialPackFile: makePackFileStructureConformanceValue(testCase),
        requiredVideoTypes: ['children_story'],
        coreVideoTypes: [],
        highFrequencyVideoTypes: [],
      });
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
    }
  });

  it('keeps the first pack and rejects later duplicate video types', () => {
    for (const testCase of productionHealthConformance.pack_collection_cases) {
      const firstPack = {
        ...makeConformancePack(testCase.video_type),
        label: testCase.first_label,
      } as ProductionMaterialPack;
      const duplicatePack = {
        ...makeConformancePack(testCase.video_type),
        label: testCase.duplicate_label,
      } as ProductionMaterialPack;
      const report = getProductionMaterialPackHealthReport({
        productionMaterialPacks: [firstPack, duplicatePack],
        domainSamplePolicy: {
          required_domain_sample_video_types: [testCase.video_type],
          domain_sample_minimums: {
            [testCase.video_type]: productionHealthConformance.valid_domain_minimums,
          },
        },
        requiredVideoTypes: [testCase.video_type as keyof typeof VIDEO_TYPE_CONFIG],
        coreVideoTypes: [],
        highFrequencyVideoTypes: [],
      });

      expect(report.pack_count, testCase.case_id).toBe(testCase.expected.loaded_pack_count);
      expect(report.rejected_pack_count, testCase.case_id).toBe(1);
      expect(report.rejected_pack_diagnostics, testCase.case_id)
        .toEqual([testCase.expected.diagnostic]);
      expect(report.packs.map(pack => pack.label), testCase.case_id)
        .toEqual([testCase.expected.selected_label]);
      expect(report.domain_sample_policy_valid, testCase.case_id).toBe(true);
      expect(report.covered_required_video_types, testCase.case_id)
        .toEqual([testCase.video_type]);
      expect(report.issues, testCase.case_id).toEqual(expect.arrayContaining([
        expect.objectContaining({ issue_type: 'duplicate_pack_video_type' }),
      ]));
    }
  });

  it('keeps production material packs mapped to readiness field specs', () => {
    const packs = getProductionMaterialPacks();
    const report = getProductionMaterialPackHealthReport({ generatedAt: '2026-07-06T00:00:00.000Z' });

    expect(report.schema_version).toBe('production-material-pack-health/v1');
    expect(report.status).toBe('passed');
    expect(report.domain_sample_policy_valid).toBe(true);
    expect(report.domain_sample_policy_video_types).toEqual([
      'ai_comic_drama',
      'children_story',
      'social_short',
    ]);
    expect(report.pack_file_valid).toBe(true);
    expect(report.pack_file_diagnostics).toEqual([]);
    expect(report.pack_count).toBe(packs.length);
    expect(report.rejected_pack_count).toBe(0);
    expect(report.rejected_pack_diagnostics).toEqual([]);
    expect(report.missing_required_video_types).toHaveLength(0);
    expect(report.issues).toHaveLength(0);

    for (const pack of packs) {
      for (const fieldId of pack.material_template.required_fields) {
        expect(getProductionMaterialFieldSpec(fieldId), `${pack.video_type}:${fieldId}`).toBeTruthy();
      }
    }
  });

  it('covers all 15 video types with production-depth templates and sample floors', () => {
    const packs = getProductionMaterialPacks();
    const configuredVideoTypes = Object.keys(VIDEO_TYPE_CONFIG).sort();
    const packedVideoTypes = packs.map(pack => pack.video_type).sort();
    const totalRequiredFieldCount = packs.reduce(
      (total, pack) => total + pack.material_template.required_fields.length,
      0,
    );

    expect(packedVideoTypes).toEqual(configuredVideoTypes);
    expect(packs).toHaveLength(15);
    expect(totalRequiredFieldCount).toBeGreaterThanOrEqual(184);

    for (const pack of packs) {
      expect(pack.sample_entries.length, `${pack.video_type}:samples`).toBeGreaterThanOrEqual(5);
      expect(pack.material_template.required_fields.length, `${pack.video_type}:fields`)
        .toBeGreaterThanOrEqual(10);
      expect(pack.material_template.prompt_layers?.length, `${pack.video_type}:prompt_layers`)
        .toBeGreaterThanOrEqual(4);
      expect(pack.material_template.supplement_questions.length, `${pack.video_type}:questions`)
        .toBeGreaterThanOrEqual(4);
    }
  });

  it('ships cross-regional failure-and-repair samples for every M3 expansion pack', () => {
    const expansionVideoTypes = [
      'character_story',
      'historical_drama',
      'legend_story',
      'culture_promo',
      'city_brand_promo',
      'scene_short',
      'landscape_mood',
    ] as const;

    for (const videoType of expansionVideoTypes) {
      const pack = getProductionMaterialPack(videoType);
      const regionalAnchors = new Set(pack?.sample_entries.map(sample => sample.regional_anchor));

      expect(pack, videoType).toBeTruthy();
      expect(regionalAnchors.size, `${videoType}:regions`).toBeGreaterThanOrEqual(4);
      expect(pack?.sample_entries.every(sample => Boolean(sample.failure_pattern)), `${videoType}:failures`)
        .toBe(true);
      expect(pack?.sample_entries.every(sample => Boolean(sample.repair_strategy)), `${videoType}:repairs`)
        .toBe(true);
    }
  });

  it('fails closed when an injected production pack set omits its domain sample policy', () => {
    const report = getProductionMaterialPackHealthReport({
      generatedAt: '2026-07-17T00:00:00.000Z',
      productionMaterialPacks: [],
      requiredVideoTypes: [],
      coreVideoTypes: [],
      highFrequencyVideoTypes: [],
    });

    expect(report.domain_sample_policy_valid).toBe(false);
    expect(report.status).toBe('failed');
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        issue_type: 'missing_domain_sample_policy',
      }),
    ]));
  });

  it('fails closed when an injected domain sample policy contains a non-positive minimum', () => {
    const report = getProductionMaterialPackHealthReport({
      generatedAt: '2026-07-17T00:00:00.000Z',
      productionMaterialPacks: [],
      requiredVideoTypes: [],
      coreVideoTypes: [],
      highFrequencyVideoTypes: [],
      domainSamplePolicy: {
        required_domain_sample_video_types: ['children_story'],
        domain_sample_minimums: {
          children_story: { china_culture: 0, original_fiction: 2 },
        },
      },
    });

    expect(report.domain_sample_policy_valid).toBe(false);
    expect(report.status).toBe('failed');
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        issue_type: 'invalid_domain_sample_policy',
      }),
    ]));
  });

  it('fails closed when a domain sample policy references a pack that was not loaded', () => {
    const report = getProductionMaterialPackHealthReport({
      generatedAt: '2026-07-17T00:00:00.000Z',
      productionMaterialPacks: [],
      requiredVideoTypes: [],
      coreVideoTypes: [],
      highFrequencyVideoTypes: [],
      domainSamplePolicy: {
        required_domain_sample_video_types: ['children_story'],
        domain_sample_minimums: {
          children_story: { china_culture: 2, original_fiction: 2 },
        },
      },
    });

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

  it('holds core production-ready video types to sample and prompt coverage gates', () => {
    const report = getProductionMaterialPackHealthReport({ generatedAt: '2026-07-06T00:00:00.000Z' });

    expect(report.production_ready_core_video_types).toEqual(expect.arrayContaining([
      'heritage_promo',
      'documentary_short',
      'ai_comic_drama',
      'explainer_video',
    ]));

    for (const videoType of report.core_video_types) {
      const summary = report.packs.find(pack => pack.video_type === videoType);
      expect(summary, videoType).toBeTruthy();
      expect(summary?.status).toBe('passed');
      expect(summary?.sample_entry_count).toBeGreaterThanOrEqual(10);
      expect(summary?.prompt_layer_count).toBeGreaterThanOrEqual(4);
      expect(summary?.supplement_question_count).toBeGreaterThanOrEqual(4);
      expect(summary?.gate_item_counts.minimum_viable_story).toBeGreaterThanOrEqual(3);
      expect(summary?.gate_item_counts.script_ready).toBeGreaterThanOrEqual(3);
      expect(summary?.gate_item_counts.production_ready).toBeGreaterThanOrEqual(3);
    }
  });

  it('reports source-domain sample coverage for every cross-domain production pack', () => {
    const report = getProductionMaterialPackHealthReport({ generatedAt: '2026-07-17T00:00:00.000Z' });

    for (const videoType of ['children_story', 'social_short', 'ai_comic_drama'] as const) {
      const summary = report.packs.find(pack => pack.video_type === videoType);
      expect(summary, videoType).toBeTruthy();
      expect(summary?.sample_entry_count_by_source_domain.china_culture, videoType).toBeGreaterThanOrEqual(2);
      expect(summary?.sample_entry_count_by_source_domain.original_fiction, videoType).toBeGreaterThanOrEqual(2);
      expect(summary?.minimum_sample_entry_count_by_source_domain).toEqual({
        china_culture: 2,
        original_fiction: 2,
      });
      expect(summary?.legacy_sample_entry_count).toBe(0);
    }
    expect(report.issues).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ issue_type: 'underfilled_domain_sample_entries' }),
    ]));
  });

  it('counts legacy samples only for china_culture and warns when original coverage is thin', () => {
    const legacyPack: ProductionMaterialPack = {
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
    };
    const report = getProductionMaterialPackHealthReport({
      generatedAt: '2026-07-17T00:00:00.000Z',
      productionMaterialPacks: [legacyPack],
      requiredVideoTypes: ['children_story'],
      coreVideoTypes: [],
      highFrequencyVideoTypes: ['children_story'],
      highFrequencyMinimumSampleEntries: 2,
      domainSamplePolicy: {
        required_domain_sample_video_types: ['children_story'],
        domain_sample_minimums: {
          children_story: { china_culture: 2, original_fiction: 2 },
        },
      },
    });
    const summary = report.packs[0];

    expect(summary.sample_entry_count_by_source_domain).toEqual({
      china_culture: 1,
      original_fiction: 1,
    });
    expect(summary.sample_entry_count).toBe(3);
    expect(summary.unique_sample_entry_count).toBe(2);
    expect(summary.duplicate_sample_entry_ids).toEqual(['original-1']);
    expect(summary.legacy_sample_entry_count).toBe(1);
    expect(scopeProductionMaterialPackToSourceDomain(legacyPack, 'original_fiction').sample_entries)
      .toEqual([expect.objectContaining({ sample_id: 'original-1' })]);
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
  });

  it('keeps original-fiction supported production templates free from china-culture-only defaults', () => {
    const crossDomainPacks = ['children_story', 'social_short', 'ai_comic_drama']
      .map(videoType => getProductionMaterialPack(videoType as 'children_story' | 'social_short' | 'ai_comic_drama'));

    for (const pack of crossDomainPacks) {
      expect(pack).toBeTruthy();
      const activeTemplateText = JSON.stringify({
        goal: pack!.goal,
        material_template: pack!.material_template,
      });
      expect(activeTemplateText, pack!.video_type).not.toMatch(
        /把文化(?:素材|材料)|文化符号|解释文化知识|保护文化的意义|真实人物\/机构\/历史素材的虚构边界/,
      );
    }
  });

  it('builds type-specific missing field reports for AI comic drama', () => {
    const pack = getProductionMaterialPack('ai_comic_drama');
    const materialPack = makeMaterialPack('第一格钩子：少年在书院门口发现旧书。主角目标是查清误会，对手压力来自同窗质疑。场景锚点是岳麓书院夜色，真实度为原创虚构。');

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
    });

    expect(report?.schema_version).toBe('production-material-readiness/v1');
    expect(report?.video_type).toBe('ai_comic_drama');
    expect(report?.available_fields).toEqual(expect.arrayContaining(['episode_hook', 'protagonist_goal', 'scene_anchor']));
    expect(report?.missing_fields.map(field => field.field_id)).toContain('reference_images_or_keyframes');
    expect(report?.missing_fields.map(field => field.field_id)).toContain('identity_motion_consistency_plan');
    expect(report?.recommended_next_questions.length).toBeGreaterThan(0);
  });

  it('does not count missing needs as production material evidence', () => {
    const pack = getProductionMaterialPack('ai_comic_drama');
    const materialPack = {
      ...makeMaterialPack('第一格钩子：少年在书院门口发现旧书。主角目标是查清误会。'),
      missing_needs: [{
        need_id: 'production_template_reference_images_or_keyframes',
        label: '参考图或关键帧',
        message: '参考图或关键帧待补。',
      }],
    };

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
    });

    expect(report?.available_fields).not.toContain('reference_images_or_keyframes');
    expect(report?.missing_fields.map(field => field.field_id)).toContain('reference_images_or_keyframes');
  });

  it('does not use AI comic fields for heritage production readiness', () => {
    const pack = getProductionMaterialPack('heritage_promo');
    const materialPack = makeMaterialPack('非遗工艺素材：以纸张、颜料和刻刀为核心，记录刻版、刷色、套印、晾晒等制作流程。');

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
    });

    expect(report?.video_type).toBe('heritage_promo');
    expect(report?.missing_fields.map(field => field.field_id)).toContain('official_catalog_or_resource_links');
    expect(report?.missing_fields.map(field => field.field_id)).not.toContain('single_shot_test');
    expect(report?.gate_reports.some(gate => gate.stage === 'production_ready')).toBe(true);
  });

  it('builds explainer video readiness from knowledge structure evidence', () => {
    const pack = getProductionMaterialPack('explainer_video');
    const materialPack = makeMaterialPack('核心问题：为什么非遗素材不能只写匠心？受众是研学入门观众。知识大纲分为材料、工具、步骤、来源边界；论点是每个知识层级都要有例子、图示字幕和总结记忆点。');

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
    });

    expect(report?.video_type).toBe('explainer_video');
    expect(report?.available_fields).toEqual(expect.arrayContaining([
      'core_question',
      'audience_level',
      'argument_points',
      'knowledge_outline',
      'concrete_examples',
      'diagram_or_caption_plan',
      'recap_sentence',
    ]));
    expect(report?.missing_fields.map(field => field.field_id)).toContain('concept_definitions');
    expect(report?.missing_fields.map(field => field.field_id)).not.toContain('single_shot_test');
  });

  it('builds children story readiness from age band and safe conflict evidence', () => {
    const pack = getProductionMaterialPack('children_story');
    const materialPack = makeMaterialPack('目标儿童为7-9岁。核心问题：为什么端午要听龙舟鼓点？具体例子是孩子跟着鼓点学会配合。主角选择先听同伴再敲鼓，温和阻力来自节奏误会；文化符号是小鼓、粽叶和江面队形。结尾有情绪安放和家长复盘，事实边界提示屈原传说与地方竞渡习俗分层，不得写成单一事实。');

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
    });

    expect(report?.video_type).toBe('children_story');
    expect(report?.available_fields).toEqual(expect.arrayContaining([
      'audience_age_band',
      'core_question',
      'child_safe_conflict',
      'protagonist_choice',
      'wonder_or_cultural_symbol',
      'emotional_resolution',
      'parent_teacher_note',
      'misconception_or_boundary',
      'forbidden_claims',
    ]));
  });

  it('uses original-fiction story markers and project-rights labels for children readiness', () => {
    const pack = getProductionMaterialPack('children_story');
    const materialPack = makeMaterialPack('目标儿童为7-9岁。核心问题是小满是否愿意把旧伞还给朋友；主角选择先道歉再一起修伞，温和阻力来自误会。故事标志物是会随心情变色的旧伞，结尾完成情绪安放；家长提示孩子讨论选择，项目设定与权利边界不得混同现实授权。');

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
      sourceDomain: 'original_fiction',
    });

    expect(report?.available_fields).toContain('wonder_or_cultural_symbol');
    expect(getProductionMaterialFieldSpec('wonder_or_cultural_symbol', 'original_fiction')).toMatchObject({
      label: '奇观或故事标志物',
      keywords: expect.arrayContaining(['故事标志物', '关键物件', '视觉意象']),
    });
  });

  it('recognizes original-fiction social material and rights cues without culture-source wording', () => {
    const pack = getProductionMaterialPack('social_short');
    const materialPack = makeMaterialPack('前三秒开场提出问题，9:16竖屏短视频每10秒推进一次剧情。人物选择形成讨论焦点，评论互动邀请观众判断另一种选择；项目素材入口为原创大纲 v3 和角色设定稿，项目/权利边界卡标出创作者确认与授权待核。');

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
      sourceDomain: 'original_fiction',
    });

    expect(report?.available_fields).toEqual(expect.arrayContaining([
      'share_trigger',
      'source_cues',
      'fact_boundary_card',
    ]));
    expect(getProductionMaterialFieldSpec('source_cues', 'original_fiction')?.label)
      .toBe('项目素材/权利线索');
    expect(getProductionMaterialFieldSpec('fact_boundary_card', 'original_fiction')?.label)
      .toBe('项目/权利边界卡');
  });

  it('recognizes an original-fiction AI comic world rule as truth-mode evidence', () => {
    const pack = getProductionMaterialPack('ai_comic_drama');
    const materialPack = {
      ...makeMaterialPack('第一格钩子是雨停在半空。原创设定采用架空都市，世界规则是角色说谎时影子会消失；主角目标是找回妹妹，对手压力来自追踪者，场景锚点是废弃车站。'),
      uncertain_claims: [],
    };

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
      sourceDomain: 'original_fiction',
    });

    expect(report?.available_fields).toContain('world_and_truth_mode');
  });

  it('does not treat a generic pending-verification note as world-and-truth-mode evidence', () => {
    const pack = getProductionMaterialPack('ai_comic_drama');
    const materialPack = makeMaterialPack('第一格钩子是少年打开一封信，主角目标是找到寄信人；对手压力来自追踪者，场景锚点是旧车站。');

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
      sourceDomain: 'original_fiction',
    });

    expect(report?.available_fields).not.toContain('world_and_truth_mode');
    expect(report?.missing_fields.map(field => field.field_id)).toContain('world_and_truth_mode');
  });

  it('builds social short readiness from hook and vertical rhythm evidence', () => {
    const pack = getProductionMaterialPack('social_short');
    const materialPack = makeMaterialPack('前三秒开场钩子：这句名文常被误解。平台语境是9:16竖屏短视频，核心问题是作者是否亲临岳阳楼。每10秒有字幕转折和事实边界卡，分享触发点是原来如此的反转，评论提示是你还听过哪些误解；来源线索来自文本和展陈。');

    const report = buildProductionMaterialReadinessReport({
      productionMaterialPack: pack,
      materialPack,
    });

    expect(report?.video_type).toBe('social_short');
    expect(report?.available_fields).toEqual(expect.arrayContaining([
      'opening_hook',
      'platform_context',
      'core_question',
      'share_trigger',
      'beat_interval',
      'vertical_shot_plan',
      'comment_prompt',
      'source_cues',
      'fact_boundary_card',
    ]));
  });

  it('builds lecture and training readiness from teaching structure evidence', () => {
    const lecturePack = getProductionMaterialPack('lecture_video');
    const trainingPack = getProductionMaterialPack('education_training');
    const materialPack = makeMaterialPack('主讲人是老师，传播目标是让观众理解书院既是建筑也是教育空间。论点包括空间、制度和当代研学，案例来自岳麓书院；知识大纲、概念定义、板书、图示和字幕资产已列出，来源线索来自馆方展陈，误区边界是不把后世影响写成本人亲历。学习目标是学会拆分空间功能，学习者为中学生，步骤序列为先看门额、再看讲堂、最后复盘；练习任务是给一个旧址列三类画面，掌握检查用判断题，受众带走点是事实分层。');

    const lectureReport = buildProductionMaterialReadinessReport({
      productionMaterialPack: lecturePack,
      materialPack,
    });
    const trainingReport = buildProductionMaterialReadinessReport({
      productionMaterialPack: trainingPack,
      materialPack,
    });

    expect(lectureReport?.video_type).toBe('lecture_video');
    expect(lectureReport?.available_fields).toEqual(expect.arrayContaining([
      'speaker_position',
      'communication_goal',
      'argument_points',
      'case_examples',
      'knowledge_outline',
      'slide_or_board_assets',
      'source_cues',
      'audience_takeaway',
      'misconception_or_boundary',
    ]));
    expect(trainingReport?.video_type).toBe('education_training');
    expect(trainingReport?.available_fields).toEqual(expect.arrayContaining([
      'learning_objective',
      'learner_profile',
      'knowledge_outline',
      'concept_definitions',
      'step_sequence',
      'case_examples',
      'practice_task',
      'assessment_check',
      'slide_or_board_assets',
      'audience_takeaway',
      'source_cues',
      'misconception_or_boundary',
    ]));
  });
});
