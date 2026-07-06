import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  MaterialSufficiencyStage,
  ProductionMaterialPack,
  ProductionMaterialPackHealthIssue,
  ProductionMaterialPackHealthReport,
  ProductionMaterialPackHealthStatus,
  ProductionMaterialPackHealthSummary,
  ProductionMaterialSampleEntry,
  ProductionMaterialTemplate,
  VideoType,
} from '@shared/types.js';
import { VIDEO_TYPE_CONFIG } from '@shared/types.js';
import { listProductionMaterialFieldIds } from './production-material-readiness-service.js';

interface ProductionMaterialPackFile {
  schema_version: 'video-type-material-supplement-packs/v1';
  packs: ProductionMaterialPack[];
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
  ...CORE_PRODUCTION_READY_VIDEO_TYPES,
  'children_story',
  'social_short',
  'lecture_video',
  'education_training',
];

const PACK_HEALTH_GATE_STAGES: MaterialSufficiencyStage[] = [
  'minimum_viable_story',
  'script_ready',
  'production_ready',
];

export function getProductionMaterialPack(videoType: VideoType): ProductionMaterialPack | undefined {
  return getProductionMaterialPacks().find(pack => pack.video_type === videoType);
}

export function getProductionMaterialPacks(): ProductionMaterialPack[] {
  if (cachedProductionMaterialPacks) return cachedProductionMaterialPacks;
  cachedProductionMaterialPacks = loadProductionMaterialPacks();
  return cachedProductionMaterialPacks;
}

function loadProductionMaterialPacks(): ProductionMaterialPack[] {
  try {
    const filePath = resolve(kbRoot(), 'production-packs', 'video-type-material-supplement-packs.json');
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as ProductionMaterialPackFile;
    return Array.isArray(parsed.packs)
      ? parsed.packs.filter(isValidProductionMaterialPack)
      : [];
  } catch {
    return [];
  }
}

export function getProductionMaterialPackHealthReport(input: {
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
  const highFrequencyMinimumSampleEntries = input.highFrequencyMinimumSampleEntries ?? 2;
  const minimumPromptLayers = input.minimumPromptLayers ?? 4;
  const minimumSupplementQuestions = input.minimumSupplementQuestions ?? 4;
  const minimumGateItemsPerStage = input.minimumGateItemsPerStage ?? 3;
  const packs = getProductionMaterialPacks();
  const packsByType = new Map(packs.map(pack => [pack.video_type, pack]));
  const knownFieldIds = new Set(listProductionMaterialFieldIds());
  const issues: ProductionMaterialPackHealthIssue[] = [];

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
      issues,
    }))
    .sort((a, b) => a.video_type.localeCompare(b.video_type));

  const coveredRequiredVideoTypes = requiredVideoTypes.filter(videoType => packsByType.has(videoType));
  const missingRequiredVideoTypes = requiredVideoTypes.filter(videoType => !packsByType.has(videoType));
  const productionReadyCoreVideoTypes = coreVideoTypes.filter(videoType =>
    summaries.some(summary => summary.video_type === videoType && summary.status === 'passed'),
  );

  return {
    schema_version: 'production-material-pack-health/v1',
    generated_at: input.generatedAt ?? new Date().toISOString(),
    status: healthStatusFromIssues(issues),
    pack_count: packs.length,
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
  issues: ProductionMaterialPackHealthIssue[];
}): ProductionMaterialPackHealthSummary {
  const { pack } = input;
  const fields = pack.material_template.required_fields;
  const unknownRequiredFields = fields.filter(fieldId => !input.knownFieldIds.has(fieldId));
  const duplicateRequiredFields = duplicateStrings(fields);
  const promptLayerCount = pack.material_template.prompt_layers?.length ?? 0;
  const sampleEntryCount = pack.sample_entries.length;
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
  if (sampleEntryCount < minimumSampleEntries) {
    input.issues.push({
      severity: 'warning',
      issue_type: 'underfilled_sample_entries',
      video_type: pack.video_type,
      message: `${pack.video_type} 样板条目低于 ${minimumSampleEntries} 条。`,
      details: [`current=${sampleEntryCount}`],
    });
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
    supplement_question_count: supplementQuestionCount,
    gate_item_counts: gateItemCounts,
    unknown_required_fields: unknownRequiredFields,
    duplicate_required_fields: duplicateRequiredFields,
    status: healthStatusFromIssues(packIssues),
  };
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

function isValidProductionMaterialPack(pack: unknown): pack is ProductionMaterialPack {
  if (!isRecord(pack)) return false;
  return Boolean(
    typeof pack.video_type === 'string'
    && pack.video_type in VIDEO_TYPE_CONFIG
    && typeof pack.label === 'string'
    && typeof pack.goal === 'string'
    && isValidProductionMaterialTemplate(pack.material_template)
    && Array.isArray(pack.sample_entries)
    && pack.sample_entries.every(isValidProductionMaterialSampleEntry),
  );
}

function isValidProductionMaterialTemplate(template: unknown): template is ProductionMaterialTemplate {
  if (!isRecord(template)) return false;
  return Boolean(
    isStringArray(template.required_fields)
    && (!('prompt_layers' in template) || isStringArray(template.prompt_layers))
    && isStringArray(template.minimum_viable_story_gate)
    && isStringArray(template.script_ready_gate)
    && isStringArray(template.production_ready_gate)
    && isStringArray(template.supplement_questions),
  );
}

function isValidProductionMaterialSampleEntry(entry: unknown): entry is ProductionMaterialSampleEntry {
  if (!isRecord(entry)) return false;
  return Boolean(
    typeof entry.sample_id === 'string'
    && typeof entry.entry_name === 'string',
  );
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}
