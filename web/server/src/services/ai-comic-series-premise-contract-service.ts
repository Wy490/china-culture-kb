import type {
  SeriesPremiseContract,
  SeriesPremiseContractAntagonisticForce,
  SeriesPremiseContractLockedCharacter,
  SeriesPremiseContractWorldRule,
  StoryDetectedCharacter,
} from '@shared/types.js';

const GENERIC_CHARACTER_LABELS = new Set([
  '主角',
  '配角',
  '人物',
  '少年',
  '少女',
  '青年',
  '见证者',
  '关键见证者',
  '对照角色',
]);

const ANTAGONISTIC_FORCE_LABELS = [
  '开发商',
  '盗谱者',
  '追杀者',
  '权臣',
  '财团',
  '敌对组织',
  '反派势力',
];

const NAMED_CHARACTER_ROLE_LABELS = [
  '记忆修理师',
  '青年绣娘',
  '少年药童',
  '非遗传承人',
  '司理参军',
  '巡检员',
  '调查记者',
  '修复师',
  '调查者',
  '守灯人',
  '传承人',
  '绣娘',
  '药童',
  '画师',
  '工匠',
  '学徒',
  '记者',
  '医生',
  '县令',
  '太守',
  '官员',
  '主角',
  '搭档',
  '同伴',
  '少年',
  '少女',
  '青年',
];

export function buildSeriesPremiseContract(input: {
  outline: string;
  detectedCharacters?: StoryDetectedCharacter[];
  explicitContract?: SeriesPremiseContract;
}): SeriesPremiseContract {
  if (input.explicitContract) {
    return normalizeSeriesPremiseContract(input.explicitContract);
  }

  const outline = input.outline.trim();
  const lockedCharacters = extractLockedCharacters(outline, input.detectedCharacters ?? []);
  const worldRules = extractWorldRules(outline);
  const antagonisticForces = extractAntagonisticForces(outline);
  const ruleMystery = isRuleMysteryPremise(outline);
  const coreStakes = unique([
    ...worldRules.map(rule => rule.consequence).filter((item): item is string => Boolean(item)),
    ...(ruleMystery && /记忆/.test(outline) ? ['违反规则会被抹去记忆'] : []),
    ...antagonisticForces.map(force => `${force.label}持续阻碍主角完成调查并保护皮影戏台与灯谱`),
  ]);
  const mustCoverBeats = unique([
    ...lockedCharacters.filter(character => character.required).map(character => `保留锁定人物${character.name}的行动与选择`),
    ...worldRules.filter(rule => rule.required).map(rule => rule.statement),
    ...antagonisticForces.filter(force => force.required).map(force => `${force.label}必须作为对抗力量进入剧情`),
  ]);
  const forbiddenSubstitutions = ruleMystery
    ? ['少女', '阿湘', ...(!/拆迁/.test(outline) ? ['拆迁'] : [])]
    : [];
  const culturalBoundaries = buildCulturalBoundaries(outline, ruleMystery);

  return {
    schema_version: 'series-premise-contract/v1',
    locked_characters: lockedCharacters,
    world_rules: worldRules,
    antagonistic_forces: antagonisticForces,
    core_stakes: coreStakes,
    must_cover_beats: mustCoverBeats,
    forbidden_substitutions: forbiddenSubstitutions,
    cultural_boundaries: culturalBoundaries,
  };
}

export function normalizeSeriesPremiseContract(contract: SeriesPremiseContract): SeriesPremiseContract {
  return {
    schema_version: 'series-premise-contract/v1',
    locked_characters: uniqueBy(
      contract.locked_characters
        .map(character => ({
          ...character,
          name: character.name.trim(),
          role: character.role?.trim() || undefined,
          evidence_span: character.evidence_span.trim(),
        }))
        .filter(character => Boolean(character.name && character.evidence_span)),
      character => character.name,
    ),
    world_rules: uniqueBy(
      contract.world_rules
        .map(rule => ({
          ...rule,
          rule_id: rule.rule_id.trim(),
          statement: rule.statement.trim(),
          consequence: rule.consequence?.trim() || undefined,
          evidence_span: rule.evidence_span.trim(),
        }))
        .filter(rule => Boolean(rule.rule_id && rule.statement && rule.evidence_span)),
      rule => rule.rule_id,
    ),
    antagonistic_forces: uniqueBy(
      contract.antagonistic_forces
        .map(force => ({
          ...force,
          label: force.label.trim(),
          function: force.function.trim(),
        }))
        .filter(force => Boolean(force.label && force.function)),
      force => force.label,
    ),
    core_stakes: unique(contract.core_stakes.map(item => item.trim()).filter(Boolean)),
    must_cover_beats: unique(contract.must_cover_beats.map(item => item.trim()).filter(Boolean)),
    forbidden_substitutions: unique(contract.forbidden_substitutions.map(item => item.trim()).filter(Boolean)),
    cultural_boundaries: uniqueBy(
      contract.cultural_boundaries
        .map(boundary => ({ ...boundary, statement: boundary.statement.trim() }))
        .filter(boundary => Boolean(boundary.statement)),
      boundary => `${boundary.truth_mode}:${boundary.statement}`,
    ),
  };
}

export function isRuleMysteryPremise(text: string): boolean {
  return /规则|禁忌/.test(text)
    && /午夜|子夜|入夜|开演/.test(text)
    && /记忆|抹去|遗忘|代价|惩罚/.test(text);
}

export function seriesPremiseAnchorLines(contract: SeriesPremiseContract | undefined): string[] {
  if (!contract) return [];
  return unique([
    ...contract.locked_characters.filter(character => character.required).map(character => `锁定人物：${character.name}${character.role ? `（${character.role}）` : ''}`),
    ...contract.world_rules.filter(rule => rule.required).map(rule => `世界规则：${rule.statement}${rule.consequence ? `；后果：${rule.consequence}` : ''}`),
    ...contract.antagonistic_forces.filter(force => force.required).map(force => `对抗力量：${force.label}；作用：${force.function}`),
    ...contract.core_stakes.map(stake => `核心代价：${stake}`),
    ...contract.cultural_boundaries.map(boundary => `文化边界[${boundary.truth_mode}]：${boundary.statement}`),
  ]);
}

export function requiredSeriesPremiseAnchorIds(contract: SeriesPremiseContract | undefined): string[] {
  if (!contract) return [];
  return unique([
    ...contract.locked_characters.filter(character => character.required).map(character => `character:${character.name}`),
    ...contract.world_rules.filter(rule => rule.required).map(rule => `world_rule:${rule.rule_id}`),
    ...contract.antagonistic_forces.filter(force => force.required).map(force => `antagonistic_force:${force.label}`),
    ...contract.core_stakes.map((_, index) => `core_stake:${index + 1}`),
  ]);
}

function extractLockedCharacters(
  outline: string,
  detectedCharacters: StoryDetectedCharacter[],
): SeriesPremiseContractLockedCharacter[] {
  const names: Array<{ name: string; role?: string; evidence: string }> = [];
  const add = (name: string | undefined, role?: string) => {
    const normalized = normalizeCharacterName(name ?? '');
    if (!normalized || GENERIC_CHARACTER_LABELS.has(normalized)) return;
    const evidence = sentenceContaining(outline, normalized) || normalized;
    names.push({ name: normalized, role, evidence });
  };

  for (const character of detectedCharacters) {
    if (outline.includes(character.name)) add(character.name, character.role_position);
  }

  const pairedPatterns = [
    /(?:主角|人物|调查者|守灯人)\s*[“"「『]?([\u4e00-\u9fff]{2,4})[”"」』]?\s*(?:与|和|、)\s*[“"「『]?([\u4e00-\u9fff]{2,4}?)[”"」』]?(?=共同|一起|联手|调查|寻找|守护|对抗|，|。|；|：|$)/g,
    /[“"「『]([\u4e00-\u9fff]{2,4})[”"」』]\s*[、与和]?\s*[“"「『]([\u4e00-\u9fff]{2,4})[”"」』]/g,
  ];
  for (const pattern of pairedPatterns) {
    for (const match of outline.matchAll(pattern)) {
      add(match[1], names.length === 0 ? '主角' : '核心人物');
      add(match[2], '核心人物');
    }
  }

  const singlePattern = new RegExp(
    `(?:${NAMED_CHARACTER_ROLE_LABELS.join('|')})\\s*[“"「『]?([\\u4e00-\\u9fff]{2,4}?)[”"」』]?(?=与|和|、|共同|一起|联手|必须|需要|面对|发现|试图|决定|正在|负责|带着|希望|寻找|阻止|拒绝|重新|继续|在|从|要|为|，|。|；|：|$)`,
    'g',
  );
  for (const match of outline.matchAll(singlePattern)) add(match[1], names.length === 0 ? '主角' : '核心人物');

  return uniqueBy(names, item => item.name)
    .sort((left, right) => outline.indexOf(left.name) - outline.indexOf(right.name))
    .map((item, index) => ({
      name: item.name,
      role: item.role ?? (index === 0 ? '主角' : '核心人物'),
      required: true,
      evidence_span: item.evidence,
    }));
}

function extractWorldRules(outline: string): SeriesPremiseContractWorldRule[] {
  const sentences = splitEvidenceSpans(outline);
  const ruleSpan = sentences.find(sentence => /规则|禁忌/.test(sentence));
  const midnightSpan = sentences.find(sentence => /午夜|子夜/.test(sentence) && /皮影|戏台|开演/.test(sentence));
  const consequenceSpan = sentences.find(sentence =>
    /违反|触犯|违背/.test(sentence) && /记忆|遗忘|抹去/.test(sentence)
  );
  const rules: SeriesPremiseContractWorldRule[] = [];

  if (ruleSpan) {
    const count = ruleSpan.match(/(?:二十|[一二三四五六七八九十百两\d]+)条规则/)?.[0] ?? '规则';
    rules.push({
      rule_id: 'midnight-shadow-play-rules',
      statement: `${midnightSpan ? '午夜皮影戏' : '皮影戏台'}必须遵守${count}`,
      required: true,
      evidence_span: unique([midnightSpan, ruleSpan].filter((item): item is string => Boolean(item))).join('；'),
    });
  }

  if (consequenceSpan || (/规则/.test(outline) && /记忆/.test(outline) && /抹去|遗忘/.test(outline))) {
    const evidence = consequenceSpan ?? sentenceContaining(outline, '记忆') ?? outline;
    rules.push({
      rule_id: 'memory-erasure-consequence',
      statement: '违反规则会被抹去记忆',
      required: true,
      consequence: '违反规则会被抹去记忆',
      evidence_span: evidence,
    });
  }

  return rules;
}

function extractAntagonisticForces(outline: string): SeriesPremiseContractAntagonisticForce[] {
  return ANTAGONISTIC_FORCE_LABELS
    .filter(label => outline.includes(label))
    .map(label => ({
      label,
      function: sentenceContaining(outline, label) || `${label}构成持续对抗力量`,
      required: true,
    }));
}

function buildCulturalBoundaries(
  outline: string,
  ruleMystery: boolean,
): SeriesPremiseContract['cultural_boundaries'] {
  const boundaries: SeriesPremiseContract['cultural_boundaries'] = [];
  if (/皮影|非遗|影偶|灯幕|操偶/.test(outline)) {
    boundaries.push({
      statement: '皮影制作、表演、灯幕与操偶技艺只按可核实的非遗事实呈现',
      truth_mode: 'verified_fact',
    });
  }
  if (ruleMystery) {
    boundaries.push({
      statement: '午夜皮影规则、记忆抹除与失传灯谱属于原创悬疑机制，不得写成真实非遗传承史',
      truth_mode: 'fictional_mechanism',
    });
  }
  return boundaries;
}

function normalizeCharacterName(value: string): string {
  return value
    .replace(/^[“"「『]+|[”"」』]+$/g, '')
    .replace(/^(?:主角|人物|搭档|同伴|少年|少女|青年|修复师)/, '')
    .trim();
}

function splitEvidenceSpans(text: string): string[] {
  return text.split(/[。！？!?；;\n]+/).map(item => item.trim()).filter(Boolean);
}

function sentenceContaining(text: string, needle: string): string | undefined {
  return splitEvidenceSpans(text).find(sentence => sentence.includes(needle));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
