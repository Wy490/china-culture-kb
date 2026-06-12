import { FullEntryDetail, LocalRelationType, SearchResult } from '../types.js';

interface LocalRelevanceInput {
  entry: SearchResult;
  detail?: FullEntryDetail | null;
  targetRegion?: string;
  province?: string;
  queryTerms?: string[];
  storyText?: string;
}

export interface LocalRelevanceResult {
  relation_type: LocalRelationType;
  score: number;
  match_reason: string;
  evidence: string[];
}

const CULTURAL_INFLUENCE_TERMS = [
  '思想',
  '文化',
  '影响',
  '传播',
  '传承',
  '学脉',
  '书院',
  '教育',
  '精神',
  '理学',
  '哲学',
  '文化意义',
  '当代',
];

export function normalizeForMatch(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

export function splitQueryTerms(raw: string | undefined): string[] {
  if (!raw) return [];
  return unique(raw.split(/[,，、\s;；:：·——\-–_]+/).filter(part => part.trim().length >= 2));
}

export function unique(items: string[]): string[] {
  return [...new Set(items.map(item => item.trim()).filter(Boolean))];
}

export function scoreLocalRelevance(input: LocalRelevanceInput): LocalRelevanceResult | null {
  const targetRegion = input.targetRegion?.trim();
  const province = input.province?.trim();
  const terms = unique([
    ...(input.queryTerms ?? []),
    ...splitQueryTerms(input.storyText),
  ]);
  const evidence: string[] = [];
  let score = 0;
  let relationType: LocalRelationType | null = null;

  if (targetRegion) {
    const regionHit = contains(input.entry.region, targetRegion);
    const locationHit = findRelatedLocationHit(input.detail, targetRegion);
    const localRelationHit = findLocalCreativeRelationHit(input.detail, targetRegion);
    const contentHit = findContentHit(input.detail, targetRegion);

    if (regionHit) {
      score += 4;
      relationType = 'direct_region';
      evidence.push(`地区字段包含「${targetRegion}」`);
    }
    if (locationHit) {
      score += 3.2;
      relationType = relationType ?? 'related_location';
      evidence.push(locationHit);
    }
    if (localRelationHit) {
      score += localRelationHit.relation_type === 'do_not_write_as' ? 0.6 : 3.5;
      relationType = localRelationHit.relation_type === 'do_not_write_as'
        ? relationType ?? 'cultural_influence'
        : localRelationHit.relation_type;
      evidence.push(localRelationHit.evidence);
    }
    if (contentHit) {
      score += 2;
      relationType = relationType ?? 'cultural_influence';
      evidence.push(contentHit);
    }
  }

  if (province && contains(input.entry.province, province)) {
    score += relationType ? 0.8 : 1.5;
    relationType = relationType ?? 'same_province';
    evidence.push(`省份匹配「${province}」`);
  }

  const culturalInfluenceHit = findCulturalInfluenceHit(input.entry, input.detail, terms);
  if (culturalInfluenceHit) {
    score += relationType === 'direct_region' ? 0.8 : 2.4;
    relationType = relationType ?? 'cultural_influence';
    evidence.push(culturalInfluenceHit);
  }

  const keywordHits = terms.filter(term => term.length >= 2 && entryCorpus(input.entry, input.detail).includes(normalizeForMatch(term)));
  if (keywordHits.length > 0) {
    score += Math.min(2.5, keywordHits.length * 0.45);
    relationType = relationType ?? 'keyword_context';
    evidence.push(`关键词命中：${keywordHits.slice(0, 5).join('、')}`);
  }

  if (!relationType || score <= 0) return null;

  const roundedScore = Math.round(score * 100) / 100;
  return {
    relation_type: relationType,
    score: roundedScore,
    match_reason: buildRelationReason(relationType, roundedScore),
    evidence: unique(evidence).slice(0, 6),
  };
}

function contains(text: string | undefined, term: string): boolean {
  if (!text || !term) return false;
  return normalizeForMatch(text).includes(normalizeForMatch(term));
}

function findRelatedLocationHit(detail: FullEntryDetail | null | undefined, targetRegion: string): string | null {
  if (!detail) return null;
  const hit = detail.relatedLocations.find(location =>
    contains(location.name, targetRegion) || contains(location.description, targetRegion)
  );
  if (!hit) return null;
  return `相关地点提到「${hit.name}」${hit.description ? `：${hit.description}` : ''}`;
}

function findLocalCreativeRelationHit(
  detail: FullEntryDetail | null | undefined,
  targetRegion: string,
): { relation_type: LocalRelationType; evidence: string } | null {
  if (!detail) return null;
  const hit = detail.localCreativeRelations.find(relation =>
    contains(relation.target, targetRegion) || contains(relation.description, targetRegion)
  );
  if (!hit) return null;
  return {
    relation_type: hit.relation_type,
    evidence: `地方化创作关系：${hit.target}｜${hit.description}`,
  };
}

function findContentHit(detail: FullEntryDetail | null | undefined, targetRegion: string): string | null {
  if (!detail) return null;
  if (contains(detail.story, targetRegion)) return `故事梗概提到「${targetRegion}」`;
  if (contains(detail.culturalSignificance, targetRegion)) return `文化意义提到「${targetRegion}」`;
  if (contains(detail.verificationMethod, targetRegion)) return `核实信息提到「${targetRegion}」`;
  return null;
}

function findCulturalInfluenceHit(entry: SearchResult, detail: FullEntryDetail | null | undefined, terms: string[]): string | null {
  const corpus = [
    entry.summary,
    entry.keywords.join('、'),
    detail?.culturalSignificance ?? '',
    detail?.story ?? '',
  ].join(' ');
  const normalizedCorpus = normalizeForMatch(corpus);
  const requestedInfluence = terms.some(term => CULTURAL_INFLUENCE_TERMS.includes(term) || CULTURAL_INFLUENCE_TERMS.some(seed => term.includes(seed)));
  const contentInfluence = CULTURAL_INFLUENCE_TERMS.find(term => normalizedCorpus.includes(normalizeForMatch(term)));
  if (requestedInfluence && contentInfluence) {
    return `可作为思想文化影响线索：${contentInfluence}`;
  }
  return null;
}

function entryCorpus(entry: SearchResult, detail: FullEntryDetail | null | undefined): string {
  return normalizeForMatch([
    entry.name,
    entry.province,
    entry.region,
    entry.type,
    entry.summary,
    entry.keywords.join('、'),
    detail?.story ?? '',
    detail?.culturalSignificance ?? '',
    detail?.relatedLocations.map(location => `${location.name}${location.description}`).join(' ') ?? '',
    detail?.localCreativeRelations.map(relation => `${relation.target}${relation.description}`).join(' ') ?? '',
  ].join(' '));
}

function buildRelationReason(relationType: LocalRelationType, score: number): string {
  const label: Record<LocalRelationType, string> = {
    direct_region: '直接地区关联',
    related_location: '相关地点关联',
    cultural_influence: '思想文化影响关联',
    contemporary_adaptation: '当代转化关联',
    do_not_write_as: '创作禁写边界',
    same_province: '同省背景关联',
    keyword_context: '关键词语境关联',
  };
  return `${label[relationType]}，地方化相关度 ${score}`;
}
