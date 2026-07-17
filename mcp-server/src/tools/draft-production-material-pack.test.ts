import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { draftProductionMaterialPack } from './draft-production-material-pack.js';

const previousKbRoot = process.env.KB_ROOT;

interface PackFileStructureCase {
  case_id: string;
  root_value?: unknown;
  omit_fields?: string[];
  overrides?: Record<string, unknown>;
}

interface PackStructureCase {
  case_id: string;
  omit_top_level_fields?: string[];
  top_level_overrides?: Record<string, unknown>;
  omit_material_template_fields?: string[];
  material_template_overrides?: Record<string, unknown>;
  sample_entries?: unknown[];
}

interface ProductionHealthConformanceFixture {
  supported_video_types: string[];
  standard_pack: Record<string, unknown>;
  pack_file_structure_cases: PackFileStructureCase[];
  pack_structure_cases: PackStructureCase[];
}

const productionHealthConformance = JSON.parse(readFileSync(path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'data',
  'production-packs',
  'production-material-pack-health-conformance.json',
), 'utf8')) as ProductionHealthConformanceFixture;

const DRAFT_ROOT_CASE_ERRORS: Record<string, string> = {
  pack_file_schema_version_must_be_supported:
    'schema_version must equal video-type-material-supplement-packs/v1',
  pack_file_packs_is_required: 'packs must be an array',
};

const DRAFT_PACK_CASE_ERRORS: Record<string, string> = {
  video_type_must_be_supported: 'packs[0].video_type must be a supported video type',
  label_must_be_non_blank: 'packs[0].label must be a non-blank string',
  goal_must_be_non_blank: 'packs[0].goal must be a non-blank string',
  required_fields_must_not_contain_blank_values:
    'packs[0].material_template.required_fields must not contain blank values',
  sample_id_is_required: 'packs[0].sample_entries[0].sample_id must be a non-blank string',
  entry_name_is_required: 'packs[0].sample_entries[0].entry_name must be a non-blank string',
  applicable_source_domains_must_be_non_empty_when_present:
    'packs[0].sample_entries[0].applicable_source_domains must be a non-empty array of unique non-blank strings',
  applicable_source_domains_must_not_contain_blank_values:
    'packs[0].sample_entries[0].applicable_source_domains must be a non-empty array of unique non-blank strings',
  applicable_source_domains_must_be_unique:
    'packs[0].sample_entries[0].applicable_source_domains must be a non-empty array of unique non-blank strings',
};

function makeExistingPack(
  label: string,
  goal: string,
  sampleId: string,
  entryName: string,
): Record<string, unknown> {
  return {
    video_type: 'children_story',
    label,
    goal,
    material_template: {
      required_fields: ['audience_profile'],
      prompt_layers: ['first-layer'],
      minimum_viable_story_gate: ['first-minimum-gate'],
      script_ready_gate: ['first-script-gate'],
      production_ready_gate: ['first-production-gate'],
      supplement_questions: ['first-question'],
    },
    sample_entries: [{
      sample_id: sampleId,
      entry_name: entryName,
      applicable_source_domains: ['original_fiction'],
    }],
  };
}

function makePackFileStructureConformanceValue(testCase: PackFileStructureCase): unknown {
  if ('root_value' in testCase) return testCase.root_value;
  const value: Record<string, unknown> = {
    schema_version: 'video-type-material-supplement-packs/v1',
    source_observations: [],
    packs: [],
  };
  for (const field of testCase.omit_fields ?? []) delete value[field];
  Object.assign(value, testCase.overrides ?? {});
  return value;
}

function makePackStructureConformanceValue(testCase: PackStructureCase): Record<string, unknown> {
  const pack: Record<string, unknown> = {
    ...productionHealthConformance.standard_pack,
    video_type: 'children_story',
    material_template: {
      ...(productionHealthConformance.standard_pack.material_template as Record<string, unknown>),
    },
    sample_entries: testCase.sample_entries ?? [{
      sample_id: 'draft-conformance-sample',
      entry_name: 'draft conformance sample',
      applicable_source_domains: ['original_fiction'],
    }],
  };
  const template = pack.material_template as Record<string, unknown>;
  for (const field of testCase.omit_material_template_fields ?? []) delete template[field];
  Object.assign(template, testCase.material_template_overrides ?? {});
  for (const field of testCase.omit_top_level_fields ?? []) delete pack[field];
  Object.assign(pack, testCase.top_level_overrides ?? {});
  return {
    schema_version: 'video-type-material-supplement-packs/v1',
    source_observations: [],
    packs: [pack],
  };
}

async function writeProductionPackFile(prefix: string, value: unknown): Promise<void> {
  const root = await fs.mkdtemp(path.join(tmpdir(), prefix));
  const packsDir = path.join(root, 'production-packs');
  await fs.mkdir(packsDir, { recursive: true });
  await fs.writeFile(
    path.join(packsDir, 'video-type-material-supplement-packs.json'),
    JSON.stringify(value, null, 2),
    'utf8',
  );
  process.env.KB_ROOT = root;
}

async function useEmptyKbRoot(prefix: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), prefix));
  process.env.KB_ROOT = root;
  return root;
}

async function writeProductionPackRaw(prefix: string, raw: string): Promise<void> {
  const root = await fs.mkdtemp(path.join(tmpdir(), prefix));
  const packsDir = path.join(root, 'production-packs');
  await fs.mkdir(packsDir, { recursive: true });
  await fs.writeFile(
    path.join(packsDir, 'video-type-material-supplement-packs.json'),
    raw,
    'utf8',
  );
  process.env.KB_ROOT = root;
}

afterEach(() => {
  process.env.KB_ROOT = previousKbRoot;
});

describe('draftProductionMaterialPack', () => {
  it('rejects an unsupported requested video type without echoing it', async () => {
    const unsupportedVideoType = 'experimental_story_sensitive';
    await writeProductionPackFile('kb-pack-draft-unsupported-request-', {
      schema_version: 'video-type-material-supplement-packs/v1',
      source_observations: [],
      packs: [],
    });

    const error = await draftProductionMaterialPack({ videoType: unsupportedVideoType })
      .then(() => undefined, reason => reason as Error);

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('videoType must be a supported video type');
    expect(error?.message).not.toContain(unsupportedVideoType);
  });

  it.each(productionHealthConformance.supported_video_types)(
    'accepts supported requested and pack video type %s',
    async videoType => {
      await writeProductionPackFile(
        'kb-pack-draft-supported-video-type-',
        makePackStructureConformanceValue({
          case_id: `supported-${videoType}`,
          top_level_overrides: { video_type: videoType },
        }),
      );

      const report = await draftProductionMaterialPack({ videoType });

      expect(report.video_type).toBe(videoType);
      expect(report.draft_pack.label).toBe(productionHealthConformance.standard_pack.label);
    },
  );

  it('sanitizes an unavailable production pack file error', async () => {
    const root = await useEmptyKbRoot('kb-pack-draft-unavailable-sensitive-');

    const error = await draftProductionMaterialPack({ videoType: 'children_story' })
      .then(() => undefined, reason => reason as Error);

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('production pack file is unavailable');
    expect(error?.message).not.toContain(root);
    expect(error?.message).not.toContain('ENOENT');
  });

  it('sanitizes an invalid production pack JSON error', async () => {
    const sensitivePayload = 'sensitive-invalid-production-pack-payload';
    await writeProductionPackRaw('kb-pack-draft-invalid-json-', `{\"${sensitivePayload}\":`);

    const error = await draftProductionMaterialPack({ videoType: 'children_story' })
      .then(() => undefined, reason => reason as Error);

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('production pack file must contain valid JSON');
    expect(error?.message).not.toContain(sensitivePayload);
    expect(error?.message).not.toContain('SyntaxError');
  });

  it.each(productionHealthConformance.pack_file_structure_cases.filter(
    testCase => testCase.case_id in DRAFT_ROOT_CASE_ERRORS,
  ))('fails closed for shared draft root case $case_id', async testCase => {
    await writeProductionPackFile(
      'kb-pack-draft-root-conformance-',
      makePackFileStructureConformanceValue(testCase),
    );

    const error = await draftProductionMaterialPack({ videoType: 'children_story' })
      .then(() => undefined, reason => reason as Error);
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe(DRAFT_ROOT_CASE_ERRORS[testCase.case_id]);
  });

  it.each(productionHealthConformance.pack_structure_cases.filter(
    testCase => testCase.case_id in DRAFT_PACK_CASE_ERRORS,
  ))('fails closed for shared draft pack case $case_id', async testCase => {
    await writeProductionPackFile(
      'kb-pack-draft-pack-conformance-',
      makePackStructureConformanceValue(testCase),
    );

    const error = await draftProductionMaterialPack({ videoType: 'children_story' })
      .then(() => undefined, reason => reason as Error);
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe(DRAFT_PACK_CASE_ERRORS[testCase.case_id]);
  });

  it('creates an editor-review draft from source observations for a new video type', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-pack-draft-'));
    const packsDir = path.join(root, 'production-packs');
    await fs.mkdir(packsDir, { recursive: true });
    await fs.writeFile(path.join(packsDir, 'video-type-material-supplement-packs.json'), JSON.stringify({
      schema_version: 'video-type-material-supplement-packs/v1',
      source_observations: [
        {
          source_id: 'explainer-source-1',
          source_type: 'course_reference',
          applies_to_video_types: ['explainer_video'],
          applies_to_source_domains: ['china_culture', 'original_fiction'],
          title: '分层讲解结构',
          usable_takeaways: ['讲解类视频需要学习目标、知识层级、步骤和复盘。'],
        },
        {
          source_id: 'explainer-source-2',
          source_type: 'video_reference',
          applies_to_video_types: ['explainer_video'],
          title: '例子与图示',
          usable_takeaways: ['知识讲解应提前准备例子、图示、字幕关键词和可视化资产。'],
        },
        {
          source_id: 'explainer-source-3',
          source_type: 'production_reference',
          applies_to_video_types: ['explainer_video'],
          title: '边界和验收',
          usable_takeaways: ['来源、核验和交付验收项需要写进模板，避免把观点当事实。'],
        },
      ],
      packs: [],
    }, null, 2), 'utf8');
    process.env.KB_ROOT = root;

    const report = await draftProductionMaterialPack({
      videoType: 'explainer_video',
      generatedAt: '2026-07-02T00:00:00.000Z',
    });

    expect(report.schema_version).toBe('production-material-pack-draft/v1');
    expect(report.status).toBe('ready_for_editor_review');
    expect(report.source_count).toBe(3);
    expect(report.draft_pack.video_type).toBe('explainer_video');
    expect(report.draft_pack.material_template.required_fields).toEqual(expect.arrayContaining([
      'learning_objective',
      'knowledge_layers',
      'step_sequence',
      'example_bank',
      'delivery_acceptance_checks',
    ]));
    expect(report.review_checklist.join('\n')).toContain('10 条高质量 sample_entries');
    expect(report.markdown).toContain('explainer_video 生产素材包草案');
    expect(report.markdown).toContain('适用领域：china_culture、original_fiction');
  });

  it('keeps existing packs as review context instead of overwriting them', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-pack-existing-'));
    const packsDir = path.join(root, 'production-packs');
    await fs.mkdir(packsDir, { recursive: true });
    await fs.writeFile(path.join(packsDir, 'video-type-material-supplement-packs.json'), JSON.stringify({
      schema_version: 'video-type-material-supplement-packs/v1',
      source_observations: [],
      packs: [{
        video_type: 'social_short',
        label: '社媒短视频',
        goal: '把文化素材改成平台短视频。',
        material_template: {
          required_fields: ['opening_hook'],
          prompt_layers: ['钩子', '观点', '行动'],
          minimum_viable_story_gate: ['有开场钩子'],
          script_ready_gate: ['脚本可分段'],
          production_ready_gate: ['竖屏镜头已列清'],
          supplement_questions: ['前三秒看到什么？'],
        },
        sample_entries: [{
          sample_id: 'social-original-01',
          entry_name: '同一封信的两个结局',
          applicable_source_domains: ['original_fiction'],
        }],
      }],
    }, null, 2), 'utf8');
    process.env.KB_ROOT = root;

    const report = await draftProductionMaterialPack({ videoType: 'social_short' });

    expect(report.status).toBe('needs_more_sources');
    expect(report.draft_pack.label).toBe('社媒短视频');
    expect(report.draft_pack.material_template.required_fields).toContain('opening_hook');
    expect(report.warnings).toContain('目标 video_type 已有正式 ProductionMaterialPack，建议走增量审稿。');
    expect(report.markdown).toContain('同一封信的两个结局（适用领域：original_fiction）');
  });

  it('uses the first pack when duplicate video types exist in review context', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-pack-duplicate-video-type-'));
    const packsDir = path.join(root, 'production-packs');
    await fs.mkdir(packsDir, { recursive: true });
    await fs.writeFile(path.join(packsDir, 'video-type-material-supplement-packs.json'), JSON.stringify({
      schema_version: 'video-type-material-supplement-packs/v1',
      source_observations: [],
      packs: [
        makeExistingPack(
          'first canonical collection pack',
          'first canonical goal',
          'first-sample',
          'first canonical sample',
        ),
        makeExistingPack(
          'sensitive duplicate collection pack',
          'sensitive duplicate goal',
          'sensitive-duplicate-sample',
          'sensitive duplicate sample',
        ),
      ],
    }, null, 2), 'utf8');
    process.env.KB_ROOT = root;

    const report = await draftProductionMaterialPack({
      videoType: 'children_story',
      sourceDomain: 'original_fiction',
    });

    expect(report.draft_pack.label).toBe('first canonical collection pack');
    expect(report.draft_pack.goal).toBe('first canonical goal');
    expect(report.draft_pack.sample_entries).toEqual([expect.objectContaining({
      sample_id: 'first-sample',
      entry_name: 'first canonical sample',
    })]);
    expect(report.markdown).not.toContain('sensitive duplicate');
  });

  it('filters observations and sample context by source domain without leaking legacy culture material', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-pack-domain-draft-'));
    const packsDir = path.join(root, 'production-packs');
    await fs.mkdir(packsDir, { recursive: true });
    await fs.writeFile(path.join(packsDir, 'video-type-material-supplement-packs.json'), JSON.stringify({
      schema_version: 'video-type-material-supplement-packs/v1',
      source_observations: [
        {
          source_id: 'original-source',
          applies_to_video_types: ['social_short'],
          applies_to_source_domains: ['original_fiction'],
          usable_takeaways: ['原创短剧需要角色身份一致性和结尾钩子。'],
        },
        {
          source_id: 'culture-source',
          applies_to_video_types: ['social_short'],
          applies_to_source_domains: ['china_culture'],
          usable_takeaways: ['文化工艺短片需要流程、工序、材料、工具和手部特写。'],
        },
        {
          source_id: 'legacy-culture-source',
          applies_to_video_types: ['social_short'],
          usable_takeaways: ['历史未标领域的来源只归入中国文化域。'],
        },
      ],
      packs: [{
        video_type: 'social_short',
        label: '社媒短视频',
        goal: '领域隔离测试。',
        material_template: {
          required_fields: ['opening_hook'],
          prompt_layers: ['钩子', '观点', '行动', '边界'],
          minimum_viable_story_gate: ['目标', '来源', '主体'],
          script_ready_gate: ['结构', '动作', '边界'],
          production_ready_gate: ['资产', '镜头', '验收'],
          supplement_questions: ['前三秒看到什么？'],
        },
        sample_entries: [
          {
            sample_id: 'original-sample',
            entry_name: '原创反转样例',
            applicable_source_domains: ['original_fiction'],
          },
          {
            sample_id: 'original-sample',
            entry_name: '重复原创反转样例',
            applicable_source_domains: ['original_fiction'],
          },
          {
            sample_id: 'culture-sample',
            entry_name: '文化工艺样例',
            applicable_source_domains: ['china_culture'],
          },
          { sample_id: 'legacy-culture-sample', entry_name: '历史文化样例' },
        ],
      }],
    }, null, 2), 'utf8');
    process.env.KB_ROOT = root;

    const report = await draftProductionMaterialPack({
      videoType: 'social_short',
      sourceDomain: 'original_fiction',
      generatedAt: '2026-07-17T00:00:00.000Z',
    });

    expect(report.source_domain).toBe('original_fiction');
    expect(report.source_ids).toEqual(['original-source']);
    expect(report.excluded_observation_count).toBe(2);
    expect(report.excluded_sample_entry_count).toBe(2);
    expect(report.duplicate_sample_entry_count).toBe(1);
    expect(report.draft_pack.sample_entries).toEqual([
      expect.objectContaining({ sample_id: 'original-sample' }),
    ]);
    expect(report.draft_pack.material_template.required_fields).toContain('character_stability');
    expect(report.draft_pack.material_template.required_fields).not.toEqual(expect.arrayContaining([
      'process_steps',
      'materials',
      'tools',
      'hand_actions',
    ]));
    expect(report.markdown).toContain('来源领域：original_fiction');
    expect(report.markdown).not.toContain('文化工艺样例');
    expect(report.markdown).not.toContain('重复原创反转样例');
    expect(report.markdown).not.toContain('legacy-culture-source');
    expect(report.markdown).toContain('重复样例数：1');
  });

  it('does not grant editor-review readiness for duplicate observations from one source', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-pack-duplicate-source-'));
    const packsDir = path.join(root, 'production-packs');
    await fs.mkdir(packsDir, { recursive: true });
    await fs.writeFile(path.join(packsDir, 'video-type-material-supplement-packs.json'), JSON.stringify({
      schema_version: 'video-type-material-supplement-packs/v1',
      source_observations: [
        {
          source_id: 'same-source',
          applies_to_video_types: ['explainer_video'],
          usable_takeaways: ['第一条观察。'],
        },
        {
          source_id: 'same-source',
          applies_to_video_types: ['explainer_video'],
          usable_takeaways: ['第二条重复观察。'],
        },
        {
          source_id: ' same-source ',
          applies_to_video_types: ['explainer_video'],
          usable_takeaways: ['第三条带空格的重复观察。'],
        },
      ],
      packs: [],
    }, null, 2), 'utf8');
    process.env.KB_ROOT = root;

    const report = await draftProductionMaterialPack({ videoType: 'explainer_video' });

    expect(report.status).toBe('needs_more_sources');
    expect(report.source_count).toBe(1);
    expect(report.source_ids).toEqual(['same-source']);
    expect(report.matched_observations).toHaveLength(1);
    expect(report.duplicate_source_observation_count).toBe(2);
    expect(report.warnings).toContain('已忽略 2 个重复 source_id 的来源观察，审稿就绪按唯一来源计数。');
    expect(report.markdown).toContain('重复来源观察数：2');
  });

  it('excludes blank source identifiers from source counts and review context', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-pack-blank-source-'));
    const packsDir = path.join(root, 'production-packs');
    await fs.mkdir(packsDir, { recursive: true });
    await fs.writeFile(path.join(packsDir, 'video-type-material-supplement-packs.json'), JSON.stringify({
      schema_version: 'video-type-material-supplement-packs/v1',
      source_observations: [
        {
          source_id: 'valid-source',
          applies_to_video_types: ['explainer_video'],
          usable_takeaways: ['有效来源。'],
        },
        {
          source_id: '   ',
          applies_to_video_types: ['explainer_video'],
          usable_takeaways: ['空来源标识不应进入草案。'],
        },
      ],
      packs: [],
    }, null, 2), 'utf8');
    process.env.KB_ROOT = root;

    const report = await draftProductionMaterialPack({ videoType: 'explainer_video' });

    expect(report.source_count).toBe(1);
    expect(report.source_ids).toEqual(['valid-source']);
    expect(report.matched_observations).toHaveLength(1);
    expect(report.invalid_source_observation_count).toBe(1);
    expect(report.warnings).toContain('已忽略 1 个缺少有效 source_id 的来源观察。');
    expect(report.markdown).toContain('非法来源观察数：1');
    expect(report.markdown).not.toContain('空来源标识不应进入草案');
  });

  it('rejects non-array additional observations with an actionable error', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-pack-invalid-additional-'));
    const packsDir = path.join(root, 'production-packs');
    await fs.mkdir(packsDir, { recursive: true });
    await fs.writeFile(path.join(packsDir, 'video-type-material-supplement-packs.json'), JSON.stringify({
      schema_version: 'video-type-material-supplement-packs/v1',
      source_observations: [],
      packs: [],
    }, null, 2), 'utf8');
    process.env.KB_ROOT = root;

    await expect(draftProductionMaterialPack({
      videoType: 'explainer_video',
      additionalObservations: {} as never,
    })).rejects.toThrow('additionalObservations must be an array');
  });

  it('rejects malformed observation domain tags before drafting', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-pack-invalid-domain-tags-'));
    const packsDir = path.join(root, 'production-packs');
    await fs.mkdir(packsDir, { recursive: true });
    await fs.writeFile(path.join(packsDir, 'video-type-material-supplement-packs.json'), JSON.stringify({
      schema_version: 'video-type-material-supplement-packs/v1',
      source_observations: [],
      packs: [],
    }, null, 2), 'utf8');
    process.env.KB_ROOT = root;

    await expect(draftProductionMaterialPack({
      videoType: 'explainer_video',
      additionalObservations: [{
        source_id: 'invalid-domain-tags',
        applies_to_video_types: ['explainer_video'],
        applies_to_source_domains: 'original_fiction',
      }] as never,
    })).rejects.toThrow('additionalObservations[0].applies_to_source_domains must be a string array');
  });

  it('rejects a non-array canonical pack collection with an actionable error', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-pack-invalid-packs-'));
    const packsDir = path.join(root, 'production-packs');
    await fs.mkdir(packsDir, { recursive: true });
    await fs.writeFile(path.join(packsDir, 'video-type-material-supplement-packs.json'), JSON.stringify({
      schema_version: 'video-type-material-supplement-packs/v1',
      source_observations: [],
      packs: {},
    }, null, 2), 'utf8');
    process.env.KB_ROOT = root;

    await expect(draftProductionMaterialPack({ videoType: 'explainer_video' }))
      .rejects.toThrow('packs must be an array');
  });

  it('rejects malformed sample domain tags before using existing pack context', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'kb-pack-invalid-sample-tags-'));
    const packsDir = path.join(root, 'production-packs');
    await fs.mkdir(packsDir, { recursive: true });
    await fs.writeFile(path.join(packsDir, 'video-type-material-supplement-packs.json'), JSON.stringify({
      schema_version: 'video-type-material-supplement-packs/v1',
      source_observations: [],
      packs: [{
        video_type: 'social_short',
        label: '社媒短视频',
        goal: '测试非法样例标签。',
        material_template: {
          required_fields: [],
          prompt_layers: [],
          minimum_viable_story_gate: [],
          script_ready_gate: [],
          production_ready_gate: [],
          supplement_questions: [],
        },
        sample_entries: [{
          sample_id: 'invalid-sample-tags',
          entry_name: '非法样例',
          applicable_source_domains: 'original_fiction',
        }],
      }],
    }, null, 2), 'utf8');
    process.env.KB_ROOT = root;

    await expect(draftProductionMaterialPack({ videoType: 'social_short' }))
      .rejects.toThrow('packs[0].sample_entries[0].applicable_source_domains must be a string array');
  });
});
