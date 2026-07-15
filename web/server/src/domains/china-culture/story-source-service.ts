import { ErrorCodes } from '@shared/types.js';
import type { EntryDetail, ErrorCode, MaterialPack, StoryGenerateRequest } from '@shared/types.js';
import {
  convertChinaCultureFullEntryDetail,
  getChinaCultureFullEntryDetail,
} from './knowledge-source-adapter.js';
import { extractChinaCultureKeywords } from './entry-language-helpers.js';

export type ChinaCultureStorySourceResolution =
  | {
      ok: true;
      primaryEntryName: string;
      entry: EntryDetail;
    }
  | {
      ok: false;
      code: ErrorCode;
      message: string;
    };

export async function resolveChinaCultureStorySource(
  request: StoryGenerateRequest,
): Promise<ChinaCultureStorySourceResolution> {
  const primaryKnowledgeEntry = request.knowledge_pack?.primary_entries[0];
  if (primaryKnowledgeEntry) {
    const primaryEntryName = primaryKnowledgeEntry.entry_name;
    const detail = await getChinaCultureFullEntryDetail(primaryEntryName);
    if (!detail) {
      return {
        ok: false,
        code: ErrorCodes.ENTRY_NOT_FOUND,
        message: `Primary entry "${primaryEntryName}" not found`,
      };
    }
    return {
      ok: true,
      primaryEntryName,
      entry: convertChinaCultureFullEntryDetail(detail),
    };
  }

  if (request.entry_name) {
    const primaryEntryName = request.entry_name;
    const detail = await getChinaCultureFullEntryDetail(primaryEntryName);
    if (!detail) {
      return {
        ok: false,
        code: ErrorCodes.ENTRY_NOT_FOUND,
        message: `Entry "${primaryEntryName}" not found`,
      };
    }
    return {
      ok: true,
      primaryEntryName,
      entry: convertChinaCultureFullEntryDetail(detail),
    };
  }

  if (
    (request.source_material_mode === 'adapt_user_novel'
      || request.creation_use_case === 'original_ai_comic'
      || request.truth_mode === 'fictional_original')
    && (request.outline || request.original_user_query)
  ) {
    const entry = buildChinaCultureUserMaterialEntry(request);
    return { ok: true, primaryEntryName: entry.name, entry };
  }

  if (hasMaterialPackContent(request.material_pack)) {
    const entry = buildChinaCultureMaterialPackEntry(request.material_pack, request);
    return { ok: true, primaryEntryName: entry.name, entry };
  }

  return {
    ok: false,
    code: ErrorCodes.VALIDATION_ERROR,
    message: 'Either entry_name, knowledge_pack with primary_entries, material_pack, or user material outline must be provided',
  };
}

function buildChinaCultureUserMaterialEntry(request: StoryGenerateRequest): EntryDetail {
  const sourceText = request.outline ?? request.original_user_query ?? '用户提供的创作素材';
  const isOriginal = request.creation_use_case === 'original_ai_comic'
    || request.truth_mode === 'fictional_original';
  const title = sourceText
    .split(/[\n。！？!?]/)
    .map(part => part.trim())
    .find(Boolean)
    ?.substring(0, 24) || (isOriginal ? '用户原创故事种子' : '用户小说改编素材');
  return {
    name: `${title}——${isOriginal ? '用户原创故事种子' : '用户小说改编素材'}`,
    province: '用户素材',
    region: '用户素材',
    type: isOriginal ? '用户原创' : '用户小说',
    summary: sourceText.substring(0, 180),
    story: sourceText,
    culturalSignificance: isOriginal
      ? '用户提供的原创故事种子，系统可扩展为影视前期创作方案与剧本结构。'
      : '用户提供的原创或授权故事文本，系统仅做视频化改编与制作拆解。',
    relatedLocations: [],
    keywords: extractChinaCultureKeywords(sourceText).slice(0, 12),
    sources: ['用户提供素材'],
    credibility: '用户提供',
    verificationMethod: isOriginal
      ? '原创虚构模式下不把故事设定写成历史事实；如涉及真实机构、地域或人物需另行核验。'
      : '用户素材主导，素材库仅作时代、地域和资产校准',
    unverifiedPoints: [],
  };
}

function hasMaterialPackContent(materialPack: MaterialPack | undefined): materialPack is MaterialPack {
  return Boolean(materialPack && (
    materialPack.primary_materials.length > 0
    || materialPack.reference_materials.length > 0
    || materialPack.supporting_materials.length > 0
  ));
}

function buildChinaCultureMaterialPackEntry(
  materialPack: MaterialPack,
  request: StoryGenerateRequest,
): EntryDetail {
  const primary = materialPack.primary_materials[0]
    ?? materialPack.reference_materials[0]
    ?? materialPack.supporting_materials[0];
  const sourceText = [
    request.outline,
    request.original_user_query,
    ...materialPack.primary_materials.map(item => item.summary),
    ...materialPack.reference_materials.map(item => item.summary),
  ].filter(Boolean).join('\n\n');
  const title = primary?.title?.trim() || '项目素材包';
  const summary = primary?.summary || sourceText || '用户提供的项目素材包';
  return {
    name: `${title}——项目素材`,
    province: '项目素材',
    region: '项目素材',
    type: '项目素材',
    summary: summary.substring(0, 180),
    story: sourceText || summary,
    culturalSignificance: '用户提供的项目素材包，系统按创作合同转化为剧本、场景和生产指挥材料。',
    relatedLocations: [],
    keywords: [
      ...extractChinaCultureKeywords(sourceText || summary),
      ...(primary?.tags ?? []),
    ].filter((item): item is string => Boolean(item))
      .filter((item, index, items) => items.indexOf(item) === index)
      .slice(0, 12),
    sources: materialPack.primary_materials.map(item => item.title),
    credibility: materialPack.overall_confidence >= 0.7 ? '用户提供' : '待核实',
    verificationMethod: '项目素材包提供，需按 truth_mode 区分已确认事实、待核实信息和创作补足',
    unverifiedPoints: materialPack.uncertain_claims,
  };
}
