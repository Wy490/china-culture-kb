import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  ProductionMaterialPack,
  ProductionMaterialSampleEntry,
  ProductionMaterialTemplate,
  VideoType,
} from '@shared/types.js';
import { VIDEO_TYPE_CONFIG } from '@shared/types.js';

interface ProductionMaterialPackFile {
  schema_version: 'video-type-material-supplement-packs/v1';
  packs: ProductionMaterialPack[];
}

type UnknownRecord = Record<string, unknown>;

let cachedProductionMaterialPacks: ProductionMaterialPack[] | null = null;

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
