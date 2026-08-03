import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  MaterialSufficiencyStage,
  ProductionMaterialPack,
  ProductionMaterialPackFileDiagnostic,
  ProductionMaterialPackFileDiagnosticCode,
  ProductionMaterialPackHealthIssue,
  ProductionMaterialPackHealthReport,
  ProductionMaterialPackHealthStatus,
  ProductionMaterialPackHealthSummary,
  ProductionMaterialPackRejectionCode,
  ProductionMaterialPackRejectionDiagnostic,
  ProductionMaterialSampleEntry,
  VideoType,
} from '@shared/types.js';
import { VIDEO_TYPE_CONFIG } from '@shared/types.js';
import { listProductionMaterialFieldIds } from './production-material-readiness-service.js';

interface ProductionMaterialPackFile {
  schema_version: 'video-type-material-supplement-packs/v1';
  pack_file_valid: boolean;
  pack_file_diagnostics: ProductionMaterialPackFileDiagnostic[];
  health_policy?: unknown;
  packs: ProductionMaterialPack[];
  rejected_pack_diagnostics: ProductionMaterialPackRejectionDiagnostic[];
}

interface ParsedDomainSamplePolicy {
  valid: boolean;
  videoTypes: VideoType[];
  minimums: Partial<Record<VideoType, Record<string, number>>>;
  issue?: ProductionMaterialPackHealthIssue;
}

type UnknownRecord = Record<string, unknown>;

let cachedProductionMaterialPacks: ProductionMaterialPack[] | null = null;

const CORE_PRODUCTION_READY_VIDEO_TYPES: VideoType[] = [
  'heritage_promo',
  'documentary_short',
  'ai_comic_drama',
  'explainer_video',
];

const HIGH_FREQUENCY_PRODUCTION_VIDEO_TYPES: VideoType[] = [
  'character_story',
  'historical_drama',
  'legend_story',
  'culture_promo',
  'heritage_promo',
  'city_brand_promo',
  'scene_short',
  'landscape_mood',
  'documentary_short',
  'explainer_video',
  'lecture_video',
  'education_training',
  'children_story',
  'social_short',
  'ai_comic_drama',
];

const PACK_HEALTH_GATE_STAGES: MaterialSufficiencyStage[] = [
  'minimum_viable_story',
  'script_ready',
  'production_ready',
];

const LEGACY_SAMPLE_SOURCE_DOMAIN = 'china_culture';

export function getProductionMaterialPack(
  videoType: VideoType,
  input: { sourceDomain?: string } = {},
): ProductionMaterialPack | undefined {
  const pack = getProductionMaterialPacks().find(item => item.video_type === videoType);
  return pack && input.sourceDomain
    ? scopeProductionMaterialPackToSourceDomain(pack, input.sourceDomain)
    : pack;
}

export function scopeProductionMaterialPackToSourceDomain(
  pack: ProductionMaterialPack,
  sourceDomain: string,
): ProductionMaterialPack {
  const sampleEntries = deduplicateProductionSampleEntries(
    pack.sample_entries.filter(entry => {
      const domains = entry.applicable_source_domains;
      // Legacy samples predate multi-domain support and were authored for china_culture.
      // Keep them available there, but fail closed instead of leaking them into a new domain.
      return domains?.length
        ? domains.includes(sourceDomain)
        : sourceDomain === 'china_culture';
    }),
  );
  return sampleEntries.length === pack.sample_entries.length
    ? pack
    : { ...pack, sample_entries: sampleEntries };
}

export function getProductionMaterialPacks(): ProductionMaterialPack[] {
  if (cachedProductionMaterialPacks) return cachedProductionMaterialPacks;
  cachedProductionMaterialPacks = loadProductionMaterialPacks();
  return cachedProductionMaterialPacks;
}

function loadProductionMaterialPacks(): ProductionMaterialPack[] {
  return loadProductionMaterialPackFile().packs;
}

function loadProductionMaterialPackFile(): ProductionMaterialPackFile {
  try {
    const filePath = resolve(kbRoot(), 'production-packs', 'video-type-material-supplement-packs.json');
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    return parseProductionMaterialPackFile(parsed);
  } catch {
    return invalidProductionMaterialPackFile({ code: 'source_unavailable', path: '$' });
  }
}

export function getProductionMaterialPackHealthReport(input: {
  productionMaterialPackFile?: unknown;
  productionMaterialPacks?: ProductionMaterialPack[];
  domainSamplePolicy?: unknown;
  requiredVideoTypes?: VideoType[];
  coreVideoTypes?: VideoType[];
  highFrequencyVideoTypes?: VideoType[];
  coreMinimumSampleEntries?: number;
  highFrequencyMinimumSampleEntries?: number;
  minimumPromptLayers?: number;
  minimumSupplementQuestions?: number;
  minimumGateItemsPerStage?: number;
  generatedAt?: string;
} = {}): ProductionMaterialPackHealthReport {
  const requiredVideoTypes = input.requiredVideoTypes ?? HIGH_FREQUENCY_PRODUCTION_VIDEO_TYPES;
  const coreVideoTypes = input.coreVideoTypes ?? CORE_PRODUCTION_READY_VIDEO_TYPES;
  const highFrequencyVideoTypes = input.highFrequencyVideoTypes ?? HIGH_FREQUENCY_PRODUCTION_VIDEO_TYPES;
  const coreMinimumSampleEntries = input.coreMinimumSampleEntries ?? 10;
  const highFrequencyMinimumSampleEntries = input.highFrequencyMinimumSampleEntries ?? 5;
  const minimumPromptLayers = input.minimumPromptLayers ?? 4;
  const minimumSupplementQuestions = input.minimumSupplementQuestions ?? 4;
  const minimumGateItemsPerStage = input.minimumGateItemsPerStage ?? 3;
  const usesInjectedPackFile = Object.prototype.hasOwnProperty.call(
    input,
    'productionMaterialPackFile',
  );
  const usesInjectedPacks = !usesInjectedPackFile && input.productionMaterialPacks !== undefined;
  const packFile = usesInjectedPackFile
    ? parseProductionMaterialPackFile(input.productionMaterialPackFile)
    : usesInjectedPacks
      ? undefined
      : loadProductionMaterialPackFile();
  const parsedPacks = usesInjectedPacks
    ? parseProductionMaterialPackCandidates(input.productionMaterialPacks ?? [])
    : {
        packs: packFile?.packs ?? [],
        rejectedPackDiagnostics: packFile?.rejected_pack_diagnostics ?? [],
      };
  const packFileValid = usesInjectedPacks ? true : Boolean(packFile?.pack_file_valid);
  const packFileDiagnostics = usesInjectedPacks ? [] : packFile?.pack_file_diagnostics ?? [];
  const packs = parsedPacks.packs;
  const domainSamplePolicy = parseDomainSamplePolicy(
    input.domainSamplePolicy ?? (usesInjectedPacks ? undefined : packFile?.health_policy),
    new Set(packs.map(pack => pack.video_type)),
  );
  const packsByType = new Map(packs.map(pack => [pack.video_type, pack]));
  const knownFieldIds = new Set(listProductionMaterialFieldIds());
  const duplicateVideoTypeDiagnostics = parsedPacks.rejectedPackDiagnostics.filter(
    diagnostic => diagnostic.code === 'duplicate_video_type',
  );
  const invalidStructureDiagnostics = parsedPacks.rejectedPackDiagnostics.filter(
    diagnostic => diagnostic.code !== 'duplicate_video_type',
  );
  const issues: ProductionMaterialPackHealthIssue[] = [
    ...(packFileDiagnostics.length > 0
      ? [{
          severity: 'error' as const,
          issue_type: 'invalid_pack_file_structure' as const,
          message: 'ProductionMaterialPack 源文件根合同非法，健康检查已 fail closed。',
          details: packFileDiagnostics.map(diagnostic =>
            `code=${diagnostic.code} path=${diagnostic.path}`),
        }]
      : []),
    ...(invalidStructureDiagnostics.length > 0
      ? [{
          severity: 'error' as const,
          issue_type: 'invalid_pack_structure' as const,
          message: `${invalidStructureDiagnostics.length} 个 ProductionMaterialPack 因结构非法被拒绝。`,
          details: invalidStructureDiagnostics.map(diagnostic =>
            `pack_index=${diagnostic.pack_index} code=${diagnostic.code} path=${diagnostic.path}`),
        }]
      : []),
    ...(duplicateVideoTypeDiagnostics.length > 0
      ? [{
          severity: 'error' as const,
          issue_type: 'duplicate_pack_video_type' as const,
          message: `${duplicateVideoTypeDiagnostics.length} 个 ProductionMaterialPack 因 video_type 重复被拒绝。`,
          details: duplicateVideoTypeDiagnostics.map(diagnostic =>
            `pack_index=${diagnostic.pack_index} code=${diagnostic.code} path=${diagnostic.path}`),
        }]
      : []),
    ...(domainSamplePolicy.issue ? [domainSamplePolicy.issue] : []),
  ];

  for (const videoType of requiredVideoTypes) {
    if (!packsByType.has(videoType)) {
      issues.push({
        severity: 'error',
        issue_type: 'missing_required_video_type',
        video_type: videoType,
        message: `缺少 ${videoType} 的 ProductionMaterialPack。`,
      });
    }
  }

  const summaries = packs
    .map(pack => buildPackHealthSummary({
      pack,
      knownFieldIds,
      coreVideoTypes,
      highFrequencyVideoTypes,
      coreMinimumSampleEntries,
      highFrequencyMinimumSampleEntries,
      minimumPromptLayers,
      minimumSupplementQuestions,
      minimumGateItemsPerStage,
      domainSampleMinimums: domainSamplePolicy.minimums,
      issues,
    }))
    .sort((a, b) => a.video_type.localeCompare(b.video_type));

  const coveredRequiredVideoTypes = requiredVideoTypes.filter(videoType => packsByType.has(videoType));
  const missingRequiredVideoTypes = requiredVideoTypes.filter(videoType => !packsByType.has(videoType));
  const productionReadyCoreVideoTypes = domainSamplePolicy.valid
    ? coreVideoTypes.filter(videoType =>
        summaries.some(summary => summary.video_type === videoType && summary.status === 'passed'),
      )
    : [];

  return {
    schema_version: 'production-material-pack-health/v1',
    generated_at: input.generatedAt ?? new Date().toISOString(),
    status: healthStatusFromIssues(issues),
    domain_sample_policy_valid: domainSamplePolicy.valid,
    domain_sample_policy_video_types: domainSamplePolicy.videoTypes,
    pack_file_valid: packFileValid,
    pack_file_diagnostics: packFileDiagnostics,
    pack_count: packs.length,
    rejected_pack_count: parsedPacks.rejectedPackDiagnostics.length,
    rejected_pack_diagnostics: parsedPacks.rejectedPackDiagnostics,
    required_video_types: requiredVideoTypes,
    covered_required_video_types: coveredRequiredVideoTypes,
    missing_required_video_types: missingRequiredVideoTypes,
    core_video_types: coreVideoTypes,
    production_ready_core_video_types: productionReadyCoreVideoTypes,
    high_frequency_video_types: highFrequencyVideoTypes,
    packs: summaries,
    issues,
  };
}

function buildPackHealthSummary(input: {
  pack: ProductionMaterialPack;
  knownFieldIds: Set<string>;
  coreVideoTypes: VideoType[];
  highFrequencyVideoTypes: VideoType[];
  coreMinimumSampleEntries: number;
  highFrequencyMinimumSampleEntries: number;
  minimumPromptLayers: number;
  minimumSupplementQuestions: number;
  minimumGateItemsPerStage: number;
  domainSampleMinimums: Partial<Record<VideoType, Record<string, number>>>;
  issues: ProductionMaterialPackHealthIssue[];
}): ProductionMaterialPackHealthSummary {
  const { pack } = input;
  const fields = pack.material_template.required_fields;
  const unknownRequiredFields = fields.filter(fieldId => !input.knownFieldIds.has(fieldId));
  const duplicateRequiredFields = duplicateStrings(fields);
  const promptLayerCount = pack.material_template.prompt_layers?.length ?? 0;
  const sampleEntryCount = pack.sample_entries.length;
  const duplicateSampleEntryIds = duplicateStrings(
    pack.sample_entries.map(entry => entry.sample_id.trim()).filter(Boolean),
  );
  const uniqueSampleEntries = deduplicateProductionSampleEntries(pack.sample_entries);
  const uniqueSampleEntryCount = uniqueSampleEntries.length;
  const domainSampleCoverage = summarizeSampleDomainCoverage(
    uniqueSampleEntries,
    pack.video_type,
    input.domainSampleMinimums,
  );
  const supplementQuestionCount = pack.material_template.supplement_questions.length;
  const gateItemCounts: Record<MaterialSufficiencyStage, number> = {
    minimum_viable_story: pack.material_template.minimum_viable_story_gate.length,
    script_ready: pack.material_template.script_ready_gate.length,
    production_ready: pack.material_template.production_ready_gate.length,
  };
  const beforeIssueCount = input.issues.length;

  if (unknownRequiredFields.length > 0) {
    input.issues.push({
      severity: 'error',
      issue_type: 'unknown_required_field',
      video_type: pack.video_type,
      message: `${pack.video_type} 包含 readiness 未识别的 required_fields。`,
      details: unknownRequiredFields,
    });
  }
  if (duplicateRequiredFields.length > 0) {
    input.issues.push({
      severity: 'error',
      issue_type: 'duplicate_required_field',
      video_type: pack.video_type,
      message: `${pack.video_type} 包含重复 required_fields。`,
      details: duplicateRequiredFields,
    });
  }
  if (duplicateSampleEntryIds.length > 0) {
    input.issues.push({
      severity: 'error',
      issue_type: 'duplicate_sample_entry',
      video_type: pack.video_type,
      message: `${pack.video_type} 包含重复 sample_id，样例门禁只按唯一 ID 计数。`,
      details: duplicateSampleEntryIds,
    });
  }
  if (promptLayerCount < input.minimumPromptLayers) {
    input.issues.push({
      severity: 'warning',
      issue_type: 'underfilled_prompt_layers',
      video_type: pack.video_type,
      message: `${pack.video_type} prompt layers 低于 ${input.minimumPromptLayers} 层。`,
      details: [`current=${promptLayerCount}`],
    });
  }
  if (supplementQuestionCount < input.minimumSupplementQuestions) {
    input.issues.push({
      severity: 'warning',
      issue_type: 'underfilled_supplement_questions',
      video_type: pack.video_type,
      message: `${pack.video_type} 补充问题低于 ${input.minimumSupplementQuestions} 条。`,
      details: [`current=${supplementQuestionCount}`],
    });
  }

  const minimumSampleEntries = input.coreVideoTypes.includes(pack.video_type)
    ? input.coreMinimumSampleEntries
    : input.highFrequencyVideoTypes.includes(pack.video_type)
      ? input.highFrequencyMinimumSampleEntries
      : 1;
  if (uniqueSampleEntryCount < minimumSampleEntries) {
    input.issues.push({
      severity: 'warning',
      issue_type: 'underfilled_sample_entries',
      video_type: pack.video_type,
      message: `${pack.video_type} 样板条目低于 ${minimumSampleEntries} 条。`,
      details: [`current=${uniqueSampleEntryCount}`, `raw=${sampleEntryCount}`],
    });
  }

  for (const [sourceDomain, minimumCount] of Object.entries(domainSampleCoverage.minimums)) {
    const currentCount = domainSampleCoverage.counts[sourceDomain] ?? 0;
    if (currentCount < minimumCount) {
      input.issues.push({
        severity: 'warning',
        issue_type: 'underfilled_domain_sample_entries',
        video_type: pack.video_type,
        source_domain: sourceDomain,
        message: `${pack.video_type} 的 ${sourceDomain} 样板条目低于 ${minimumCount} 条。`,
        details: [`current=${currentCount}`, `minimum=${minimumCount}`],
      });
    }
  }

  for (const stage of PACK_HEALTH_GATE_STAGES) {
    if (gateItemCounts[stage] < input.minimumGateItemsPerStage) {
      input.issues.push({
        severity: 'warning',
        issue_type: 'underfilled_gate_items',
        video_type: pack.video_type,
        message: `${pack.video_type} ${stage} gate 低于 ${input.minimumGateItemsPerStage} 条。`,
        details: [`current=${gateItemCounts[stage]}`],
      });
    }
  }

  const packIssues = input.issues.slice(beforeIssueCount);

  return {
    video_type: pack.video_type,
    label: pack.label,
    required_field_count: fields.length,
    prompt_layer_count: promptLayerCount,
    sample_entry_count: sampleEntryCount,
    unique_sample_entry_count: uniqueSampleEntryCount,
    duplicate_sample_entry_ids: duplicateSampleEntryIds,
    sample_entry_count_by_source_domain: domainSampleCoverage.counts,
    minimum_sample_entry_count_by_source_domain: domainSampleCoverage.minimums,
    legacy_sample_entry_count: domainSampleCoverage.legacyCount,
    supplement_question_count: supplementQuestionCount,
    gate_item_counts: gateItemCounts,
    unknown_required_fields: unknownRequiredFields,
    duplicate_required_fields: duplicateRequiredFields,
    status: healthStatusFromIssues(packIssues),
  };
}

function summarizeSampleDomainCoverage(
  sampleEntries: ProductionMaterialSampleEntry[],
  videoType: VideoType,
  domainSampleMinimums: Partial<Record<VideoType, Record<string, number>>>,
): {
  counts: Record<string, number>;
  minimums: Record<string, number>;
  legacyCount: number;
} {
  const minimums = { ...(domainSampleMinimums[videoType] ?? {}) };
  const counts: Record<string, number> = Object.fromEntries(
    Object.keys(minimums).map(sourceDomain => [sourceDomain, 0]),
  );
  let legacyCount = 0;
  for (const entry of sampleEntries) {
    const explicitDomains = [...new Set(
      (entry.applicable_source_domains ?? []).map(item => item.trim()).filter(Boolean),
    )];
    const sourceDomains = explicitDomains.length > 0
      ? explicitDomains
      : [LEGACY_SAMPLE_SOURCE_DOMAIN];
    if (explicitDomains.length === 0) legacyCount += 1;
    for (const sourceDomain of sourceDomains) {
      counts[sourceDomain] = (counts[sourceDomain] ?? 0) + 1;
    }
  }
  return { counts, minimums, legacyCount };
}

function deduplicateProductionSampleEntries(
  sampleEntries: ProductionMaterialSampleEntry[],
): ProductionMaterialSampleEntry[] {
  const seen = new Set<string>();
  return sampleEntries.filter(entry => {
    const sampleId = entry.sample_id.trim();
    if (!sampleId) return true;
    if (seen.has(sampleId)) return false;
    seen.add(sampleId);
    return true;
  });
}

function parseDomainSamplePolicy(
  value: unknown,
  loadedVideoTypes: ReadonlySet<VideoType>,
): ParsedDomainSamplePolicy {
  if (value === undefined) {
    return {
      valid: false,
      videoTypes: [],
      minimums: {},
      issue: {
        severity: 'error',
        issue_type: 'missing_domain_sample_policy',
        message: 'ProductionMaterialPack 缺少 health_policy 领域样例最低要求，健康检查已 fail closed。',
      },
    };
  }

  const details: string[] = [];
  if (!isRecord(value)) {
    details.push('health_policy must be an object');
  }
  const requiredValue = isRecord(value) ? value.required_domain_sample_video_types : undefined;
  const minimumsValue = isRecord(value) ? value.domain_sample_minimums : undefined;
  const requiredVideoTypes = isStringArray(requiredValue)
    ? requiredValue.map(item => item.trim()).filter(Boolean)
    : [];

  if (!isStringArray(requiredValue) || requiredVideoTypes.length === 0) {
    details.push('required_domain_sample_video_types must be a non-empty string array');
  }
  if (isStringArray(requiredValue) && requiredValue.some(item => !item.trim())) {
    details.push('required_domain_sample_video_types contains blank values');
  }
  if (new Set(requiredVideoTypes).size !== requiredVideoTypes.length) {
    details.push('required_domain_sample_video_types contains duplicates');
  }
  for (const videoType of requiredVideoTypes) {
    if (!(videoType in VIDEO_TYPE_CONFIG)) {
      details.push(`unknown video_type=${videoType}`);
    } else if (!loadedVideoTypes.has(videoType as VideoType)) {
      details.push(`policy video_type=${videoType} has no loaded ProductionMaterialPack`);
    }
  }
  if (!isRecord(minimumsValue)) {
    details.push('domain_sample_minimums must be an object');
  }

  const declaredKeys = [...new Set(requiredVideoTypes)].sort((a, b) => a.localeCompare(b));
  const minimumKeys = isRecord(minimumsValue)
    ? Object.keys(minimumsValue).sort((a, b) => a.localeCompare(b))
    : [];
  for (const missingVideoType of declaredKeys.filter(videoType => !minimumKeys.includes(videoType))) {
    details.push(`missing domain minimums for video_type=${missingVideoType}`);
  }
  for (const unexpectedVideoType of minimumKeys.filter(videoType => !declaredKeys.includes(videoType))) {
    details.push(`undeclared domain minimums for video_type=${unexpectedVideoType}`);
  }

  const minimums: Partial<Record<VideoType, Record<string, number>>> = {};
  if (isRecord(minimumsValue)) {
    for (const videoType of minimumKeys) {
      const domainMinimums = minimumsValue[videoType];
      if (!isRecord(domainMinimums) || Object.keys(domainMinimums).length === 0) {
        details.push(`domain minimums for video_type=${videoType} must be a non-empty object`);
        continue;
      }
      const parsedMinimums: Record<string, number> = {};
      for (const [rawSourceDomain, minimumCount] of Object.entries(domainMinimums)) {
        const sourceDomain = rawSourceDomain.trim();
        if (!sourceDomain) {
          details.push(`video_type=${videoType} contains an empty source_domain`);
          continue;
        }
        if (!Number.isInteger(minimumCount) || (minimumCount as number) <= 0) {
          details.push(`video_type=${videoType} source_domain=${sourceDomain} minimum must be a positive integer`);
          continue;
        }
        parsedMinimums[sourceDomain] = minimumCount as number;
      }
      if (videoType in VIDEO_TYPE_CONFIG) {
        minimums[videoType as VideoType] = parsedMinimums;
      }
    }
  }

  const videoTypes = declaredKeys.filter(videoType => videoType in VIDEO_TYPE_CONFIG) as VideoType[];
  if (details.length > 0) {
    return {
      valid: false,
      videoTypes,
      minimums: {},
      issue: {
        severity: 'error',
        issue_type: 'invalid_domain_sample_policy',
        message: 'ProductionMaterialPack health_policy 非法，领域样例健康检查已 fail closed。',
        details,
      },
    };
  }
  return { valid: true, videoTypes, minimums };
}

function duplicateStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort((a, b) => a.localeCompare(b));
}

function healthStatusFromIssues(issues: ProductionMaterialPackHealthIssue[]): ProductionMaterialPackHealthStatus {
  if (issues.some(issue => issue.severity === 'error')) return 'failed';
  if (issues.length > 0) return 'warning';
  return 'passed';
}

function kbRoot(): string {
  return process.env.KB_ROOT || resolve(import.meta.dirname, '..', '..', '..', '..', 'data');
}

function parseProductionMaterialPackCandidates(candidates: unknown[]): {
  packs: ProductionMaterialPack[];
  rejectedPackDiagnostics: ProductionMaterialPackRejectionDiagnostic[];
} {
  const packs: ProductionMaterialPack[] = [];
  const rejectedPackDiagnostics: ProductionMaterialPackRejectionDiagnostic[] = [];
  const acceptedVideoTypes = new Set<VideoType>();
  candidates.forEach((candidate, packIndex) => {
    const diagnostic = diagnoseProductionMaterialPack(candidate, packIndex);
    if (diagnostic) rejectedPackDiagnostics.push(diagnostic);
    else {
      const pack = candidate as ProductionMaterialPack;
      if (acceptedVideoTypes.has(pack.video_type)) {
        rejectedPackDiagnostics.push({
          pack_index: packIndex,
          code: 'duplicate_video_type',
          path: `packs[${packIndex}].video_type`,
        });
      } else {
        acceptedVideoTypes.add(pack.video_type);
        packs.push(pack);
      }
    }
  });
  return { packs, rejectedPackDiagnostics };
}

function parseProductionMaterialPackFile(value: unknown): ProductionMaterialPackFile {
  const diagnostic = diagnoseProductionMaterialPackFile(value);
  if (diagnostic) return invalidProductionMaterialPackFile(diagnostic);
  const file = value as UnknownRecord;
  const parsedPacks = parseProductionMaterialPackCandidates(file.packs as unknown[]);
  return {
    schema_version: 'video-type-material-supplement-packs/v1',
    pack_file_valid: true,
    pack_file_diagnostics: [],
    health_policy: file.health_policy,
    packs: parsedPacks.packs,
    rejected_pack_diagnostics: parsedPacks.rejectedPackDiagnostics,
  };
}

function diagnoseProductionMaterialPackFile(
  value: unknown,
): ProductionMaterialPackFileDiagnostic | undefined {
  const reject = (
    code: ProductionMaterialPackFileDiagnosticCode,
    path: string,
  ): ProductionMaterialPackFileDiagnostic => ({ code, path });
  if (!isRecord(value)) return reject('required_object', '$');
  if (!isNonBlankString(value.schema_version)) {
    return reject('required_non_blank_string', 'schema_version');
  }
  if (value.schema_version !== 'video-type-material-supplement-packs/v1') {
    return reject('unsupported_schema_version', 'schema_version');
  }
  if (!Array.isArray(value.packs)) return reject('required_array', 'packs');
  return undefined;
}

function invalidProductionMaterialPackFile(
  diagnostic: ProductionMaterialPackFileDiagnostic,
): ProductionMaterialPackFile {
  return {
    schema_version: 'video-type-material-supplement-packs/v1',
    pack_file_valid: false,
    pack_file_diagnostics: [diagnostic],
    packs: [],
    rejected_pack_diagnostics: [],
  };
}

function diagnoseProductionMaterialPack(
  pack: unknown,
  packIndex: number,
): ProductionMaterialPackRejectionDiagnostic | undefined {
  const root = `packs[${packIndex}]`;
  const reject = (
    code: ProductionMaterialPackRejectionCode,
    path: string,
  ): ProductionMaterialPackRejectionDiagnostic => ({ pack_index: packIndex, code, path });
  if (!isRecord(pack)) return reject('required_object', root);
  if (!isNonBlankString(pack.video_type)) return reject('required_non_blank_string', `${root}.video_type`);
  if (!(pack.video_type in VIDEO_TYPE_CONFIG)) return reject('unsupported_video_type', `${root}.video_type`);
  if (!isNonBlankString(pack.label)) return reject('required_non_blank_string', `${root}.label`);
  if (!isNonBlankString(pack.goal)) return reject('required_non_blank_string', `${root}.goal`);
  const template = pack.material_template;
  if (!isRecord(template)) return reject('required_object', `${root}.material_template`);
  if (!isNonBlankStringArray(template.required_fields)) {
    return reject('required_non_blank_string_array', `${root}.material_template.required_fields`);
  }
  if ('prompt_layers' in template && !isNonBlankStringArray(template.prompt_layers)) {
    return reject('optional_non_blank_string_array', `${root}.material_template.prompt_layers`);
  }
  for (const field of [
    'minimum_viable_story_gate',
    'script_ready_gate',
    'production_ready_gate',
    'supplement_questions',
  ] as const) {
    if (!isNonBlankStringArray(template[field])) {
      return reject('required_non_blank_string_array', `${root}.material_template.${field}`);
    }
  }
  if (!Array.isArray(pack.sample_entries)) return reject('required_array', `${root}.sample_entries`);
  for (let sampleIndex = 0; sampleIndex < pack.sample_entries.length; sampleIndex += 1) {
    const entry = pack.sample_entries[sampleIndex];
    const sampleRoot = `${root}.sample_entries[${sampleIndex}]`;
    if (!isRecord(entry)) return reject('required_object', sampleRoot);
    if (!isNonBlankString(entry.sample_id)) {
      return reject('required_non_blank_string', `${sampleRoot}.sample_id`);
    }
    if (!isNonBlankString(entry.entry_name)) {
      return reject('required_non_blank_string', `${sampleRoot}.entry_name`);
    }
    if ('applicable_source_domains' in entry
      && !isNonEmptyUniqueNonBlankStringArray(entry.applicable_source_domains)) {
      return reject(
        'optional_non_empty_unique_non_blank_string_array',
        `${sampleRoot}.applicable_source_domains`,
      );
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonBlankStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonBlankString);
}

function isNonEmptyUniqueNonBlankStringArray(value: unknown): value is string[] {
  if (!isNonBlankStringArray(value) || value.length === 0) return false;
  const normalizedValues = value.map(item => item.trim());
  return new Set(normalizedValues).size === normalizedValues.length;
}
