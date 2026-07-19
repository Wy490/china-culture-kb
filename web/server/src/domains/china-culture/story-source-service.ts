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

  if (request.outline || request.original_user_query) {
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
  const isAdaptation = request.source_material_mode === 'adapt_user_novel'
    || request.creation_use_case === 'adapted_ai_comic'
    || request.truth_mode === 'source_adaptation';
  const materialLabel = isOriginal
    ? '用户原创故事种子'
    : isAdaptation
      ? '用户小说改编素材'
      : '用户项目素材';
  const title = deriveChinaCultureUserMaterialTitle(sourceText)
    || materialLabel;
  const contentText = stripChinaCultureUserMaterialTitleDirective(sourceText);
  return {
    name: `${title}——${materialLabel}`,
    province: '用户素材',
    region: '用户素材',
    type: isOriginal ? '用户原创' : isAdaptation ? '用户小说' : '用户素材',
    summary: contentText.substring(0, 180),
    story: contentText,
    culturalSignificance: isOriginal
      ? '用户提供的原创故事种子，系统可扩展为影视前期创作方案与剧本结构。'
      : isAdaptation
        ? '用户提供的原创或授权故事文本，系统仅做视频化改编与制作拆解。'
        : '用户提供的项目主题与事实线索，系统可据此生成制作草案，但不自动视为已核实事实。',
    relatedLocations: [],
    keywords: deriveChinaCultureUserMaterialKeywords(contentText, title),
    sources: ['用户提供素材'],
    credibility: '用户提供',
    verificationMethod: isOriginal
      ? '原创虚构模式下不把故事设定写成历史事实；如涉及真实机构、地域或人物需另行核验。'
      : isAdaptation
        ? '用户素材主导，素材库仅作时代、地域和资产校准'
        : '用户提供的事实、数据、机构口径和历史细节必须核验；生成内容只能作为待审制作草案。',
    unverifiedPoints: [],
  };
}

function stripChinaCultureUserMaterialTitleDirective(sourceText: string): string {
  const stripped = sourceText.replace(
    /^\s*(?:标题|片名|故事名)\s*[：:]\s*[^\n。！？!?；;]{2,24}[。！？!?；;]\s*/,
    '',
  ).trim();
  return stripped || sourceText.trim();
}

function deriveChinaCultureUserMaterialTitle(sourceText: string): string | undefined {
  const explicitTitle = sourceText.match(/(?:标题|片名|故事名)\s*[：:]\s*([^\n。！？!?；;]{2,24})/)
    ?? sourceText.match(/《([^》]{2,24})》/);
  if (explicitTitle?.[1]?.trim()) return explicitTitle[1].trim();

  const namedAction = matchChinaCultureNamedAction(sourceText);
  if (namedAction?.[0]) return namedAction[0].substring(0, 24);

  return sourceText
    .split(/[\n。！？!?]/)
    .map(part => part.trim())
    .find(Boolean)
    ?.substring(0, 24);
}

function matchChinaCultureNamedAction(sourceText: string): RegExpMatchArray | null {
  return sourceText.match(
    /([\u4e00-\u9fa5]{2,4})(拒绝(?:签押|签字|落笔|妥协|撤回|放弃)?|拒签|断案|投江|殉国|悟道|传书|起义|会师|抗战|修桥|护桥)/,
  );
}

function deriveChinaCultureUserMaterialKeywords(contentText: string, title: string): string[] {
  const namedAction = matchChinaCultureNamedAction(title) ?? matchChinaCultureNamedAction(contentText);
  const stopwords = new Set([
    '一个', '一种', '一名', '以及', '并且', '因为', '所以', '但是', '通过', '进行', '已经', '需要', '可以',
  ]);
  const segmentedWords = [...new Intl.Segmenter('zh-CN', { granularity: 'word' }).segment(contentText)]
    .filter(segment => segment.isWordLike)
    .map(segment => segment.segment.trim())
    .filter(word => word.length >= 2 && word.length <= 12 && !stopwords.has(word));
  const legacyFallback = extractChinaCultureKeywords(contentText)
    .filter(word => !/[的了在与和为把被对从中下上及或而并让使将这那其于里]/.test(word));
  const semanticKeywords = [
    title,
    namedAction?.[1],
    namedAction?.[2],
    ...segmentedWords,
  ]
    .filter((item): item is string => Boolean(item?.trim()))
    .map(item => item.trim())
    .filter((item, index, items) => items.indexOf(item) === index);
  const keywordCandidates = semanticKeywords.length >= 3
    ? semanticKeywords
    : [...semanticKeywords, ...legacyFallback];

  return keywordCandidates
    .filter((item, index, items) => items.indexOf(item) === index)
    .slice(0, 12);
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
