import { createHash } from 'node:crypto'
import type {
  AiComicContinuityLedger,
  AiComicSeedanceAssetLibrary,
  AiComicSeriesPlan,
  AiComicSeriesVisualBible,
  AiComicSeriesVisualIdentity,
  AiComicSeriesVisualIdentityKind,
  AiComicSeriesVisualPilotBinding,
  AiComicSeriesVisualWorldRule,
  AiComicSeriesVisualWorldRulePilotBinding,
  AiComicSeriesVisualWorldRulePilotTargetType,
} from '@shared/types.js'

const VISUAL_DEFINITION_FIELDS: Record<AiComicSeriesVisualIdentityKind, Array<{
  field_id: string
  label: string
}>> = {
  character: [
    { field_id: 'age_range', label: '年龄区间' },
    { field_id: 'body_type', label: '体态' },
    { field_id: 'facial_features', label: '脸部特征' },
    { field_id: 'hairstyle', label: '发型' },
    { field_id: 'gender_pronouns', label: '性别/代词' },
  ],
  costume: [
    { field_id: 'garment_details', label: '主服装细节' },
    { field_id: 'color_palette', label: '色彩方案' },
    { field_id: 'phase_changes', label: '阶段服装变化' },
  ],
  location: [
    { field_id: 'spatial_architecture', label: '建筑/空间结构' },
    { field_id: 'primary_lighting', label: '主光源' },
    { field_id: 'materials_palette', label: '材质与色彩' },
  ],
  prop: [
    { field_id: 'form_dimensions', label: '形制/尺寸' },
    { field_id: 'materials_colors', label: '材质与颜色' },
    { field_id: 'ownership_state_changes', label: '归属与状态变化' },
  ],
}

const WORLD_RULE_DEFINITION_FIELDS = [
  { field_id: 'visual_symbol', label: '视觉符号' },
  { field_id: 'trigger_condition', label: '触发条件' },
] as const

const GENERIC_VISUAL_CHARACTER_LABELS = new Set([
  '主角',
  '配角',
  '反派',
  '少年',
  '百姓',
  '关键见证者',
  '对照角色',
  '同行者',
])

export function isAiComicSeriesGenericVisualCharacterLabel(label: string): boolean {
  return GENERIC_VISUAL_CHARACTER_LABELS.has(label.trim())
}

export function aiComicSeriesVisualIdentityId(
  kind: AiComicSeriesVisualIdentityKind,
  label: string,
): string {
  const normalized = normalizeLabel(label)
  const digest = createHash('sha256').update(`${kind}:${normalized}`, 'utf8').digest('hex').slice(0, 12)
  return `series-${kind}-${digest}`
}

export function buildAiComicSeriesVisualBible(input: {
  plan: AiComicSeriesPlan
  ledger: AiComicContinuityLedger
  generatedEpisodeStoryIds: Record<string, string>
  assetLibrary?: AiComicSeedanceAssetLibrary
  previousVisualBible?: AiComicSeriesVisualBible
  generatedAt?: string
}): AiComicSeriesVisualBible {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const episodeCount = Number.isInteger(input.plan.episode_count) && input.plan.episode_count > 0
    ? input.plan.episode_count
    : Math.max(input.plan.episodes?.length ?? 0, 1)
  const recurringMotifs = input.plan.recurring_motifs ?? []
  const pilotEpisodeNos = resolvePilotEpisodeNos(episodeCount)
  const requiredCharacterNames = new Set(
    (input.plan.premise_contract?.locked_characters ?? [])
      .filter(item => item.required)
      .map(item => item.name.trim()),
  )
  const allEpisodeNos = Array.from({ length: episodeCount }, (_, index) => index + 1)
  const identities: AiComicSeriesVisualIdentity[] = []
  const previousIdentities = new Map(
    (input.previousVisualBible?.identities ?? []).map(identity => [identity.identity_id, identity]),
  )
  const previousWorldRules = new Map(
    (input.previousVisualBible?.world_rules ?? []).map(rule => [rule.rule_id, rule]),
  )

  const mainCharacters = input.plan.main_characters ?? []
  const productionCharacters = requiredCharacterNames.size > 0
    ? mainCharacters.filter(character => requiredCharacterNames.has(character.name.trim()))
    : mainCharacters
  for (const character of productionCharacters) {
    appendCharacterAndCostumeIdentities({
      identities,
      previousIdentities,
      characterName: character.name,
      canonicalDescription: `${character.role}；${character.visual_signature}`,
      costumeDescription: character.visual_signature,
      source: 'plan_character',
      allEpisodeNos,
      pilotEpisodeNos,
      forbiddenSubstitutions: input.plan.premise_contract?.forbidden_substitutions ?? [],
      assetLibrary: input.assetLibrary,
    })
  }

  const productionCharacterNames = new Set(productionCharacters.map(character => character.name.trim()))
  for (const antagonist of input.plan.premise_contract?.antagonistic_forces ?? []) {
    const label = antagonist.label.trim()
    if (!antagonist.required || !label || productionCharacterNames.has(label)) continue
    appendCharacterAndCostumeIdentities({
      identities,
      previousIdentities,
      characterName: label,
      canonicalDescription: `锁定对抗力量；${antagonist.function}`,
      costumeDescription: `${label}的主服装尚待真人定义`,
      source: 'premise_antagonist',
      allEpisodeNos,
      pilotEpisodeNos,
      forbiddenSubstitutions: input.plan.premise_contract?.forbidden_substitutions ?? [],
      assetLibrary: input.assetLibrary,
    })
  }

  const memory = input.ledger.series_memory
  for (const character of memory?.characters ?? []) {
    const label = character.label.trim()
    const relatedEpisodeNos = sortedEpisodeNos(character.related_episode_nos)
    if (
      !label
      || isAiComicSeriesGenericVisualCharacterLabel(label)
      || productionCharacterNames.has(label)
      || relatedEpisodeNos.length < 1
    ) {
      continue
    }
    appendCharacterAndCostumeIdentities({
      identities,
      previousIdentities,
      characterName: label,
      canonicalDescription: character.visual_anchor?.trim()
        || character.status.trim()
        || `${label}是跨集连续出现的视觉主体`,
      costumeDescription: character.visual_anchor?.trim()
        || `${label}的主服装需与其跨集状态保持一致`,
      source: 'series_memory',
      allEpisodeNos: relatedEpisodeNos,
      pilotEpisodeNos: intersectEpisodes(relatedEpisodeNos, pilotEpisodeNos),
      forbiddenSubstitutions: input.plan.premise_contract?.forbidden_substitutions ?? [],
      assetLibrary: input.assetLibrary,
    })
    productionCharacterNames.add(label)
  }

  for (const location of meaningfulLocations(memory?.locations ?? [])) {
    const locationIdentityId = aiComicSeriesVisualIdentityId('location', location.label)
    identities.push(finalizeIdentity({
      identity_id: locationIdentityId,
      kind: 'location',
      label: location.label.trim(),
      canonical_description: location.visual_anchor?.trim() || location.status.trim(),
      source: 'series_memory',
      source_episode_nos: sortedEpisodeNos(location.related_episode_nos),
      pilot_episode_nos: intersectEpisodes(location.related_episode_nos, pilotEpisodeNos),
      continuity_constraints: uniqueStrings(location.continuity_notes),
      negative_constraints: ['不得改变固定空间结构、灯位、出入口方向和时代语境'],
      production_credit: false,
    }, previousIdentities.get(locationIdentityId), input.assetLibrary))
  }

  for (const prop of meaningfulProps(memory?.props ?? [])) {
    const propLabel = extractPropLabel(prop.label)
    const propIdentityId = aiComicSeriesVisualIdentityId('prop', propLabel)
    identities.push(finalizeIdentity({
      identity_id: propIdentityId,
      kind: 'prop',
      label: propLabel,
      canonical_description: prop.visual_anchor?.trim() || prop.status.trim(),
      source: 'series_memory',
      source_episode_nos: sortedEpisodeNos(prop.related_episode_nos),
      pilot_episode_nos: intersectEpisodes(prop.related_episode_nos, pilotEpisodeNos),
      continuity_constraints: uniqueStrings(prop.continuity_notes),
      negative_constraints: ['不得改变道具形制、归属、左右手关系或已记录的损耗状态'],
      production_credit: false,
    }, previousIdentities.get(propIdentityId), input.assetLibrary))
  }

  const dedupedIdentities = dedupeIdentities(identities)
  const pilotStoryIds = Object.fromEntries(
    pilotEpisodeNos.map(episodeNo => [String(episodeNo), input.generatedEpisodeStoryIds[String(episodeNo)] ?? '']),
  )
  const worldRules = (input.plan.premise_contract?.world_rules ?? []).map(rule => finalizeWorldRule({
    rule_id: rule.rule_id,
    statement: rule.statement,
    consequence: rule.consequence,
    source_story_ids: pilotStoryIds,
    pilot_episode_nos: pilotEpisodeNos,
  }, previousWorldRules.get(rule.rule_id)))
  const pilotEpisodeBindings = pilotEpisodeNos.map(episodeNo => buildPilotBinding({
    episodeNo,
    generatedStoryId: input.generatedEpisodeStoryIds[String(episodeNo)],
    identities: dedupedIdentities,
    worldRules,
  }))
  const issues = buildIssues(dedupedIdentities, worldRules, pilotEpisodeBindings)
  const period = inferPeriod(input.plan)
  const locations = dedupedIdentities.filter(item => item.kind === 'location')

  return {
    schema_version: 'ai-comic-series-visual-bible/v1',
    generated_at: generatedAt,
    source_fingerprint: sourceFingerprint(input),
    pilot_episode_nos: pilotEpisodeNos,
    world: {
      period,
      region: '待定义',
      architectural_language: locations.map(item => item.label),
      lighting_and_color_rules: uniqueStrings(recurringMotifs.filter(item => /灯|光|影|色/.test(item))),
      material_rules: uniqueStrings(recurringMotifs.filter(item => /木|纸|皮|布|金属|石/.test(item))),
    },
    world_rules: worldRules,
    cultural_boundaries: [...input.plan.premise_contract?.cultural_boundaries ?? []],
    identities: dedupedIdentities,
    pilot_episode_bindings: pilotEpisodeBindings,
    ready_identity_count: dedupedIdentities.filter(item => item.definition_status === 'ready').length,
    needs_definition_identity_count: dedupedIdentities.filter(item => item.definition_status === 'needs_definition').length,
    approved_identity_count: dedupedIdentities.filter(item => item.approval.status === 'approved').length,
    needs_approval_identity_count: dedupedIdentities.filter(item => (
      item.definition_status === 'ready' && item.approval.status !== 'approved'
    )).length,
    production_credit_identity_count: dedupedIdentities.filter(item => item.production_credit).length,
    ready_world_rule_count: worldRules.filter(item => item.definition_status === 'ready').length,
    needs_definition_world_rule_count: worldRules.filter(item => item.definition_status === 'needs_definition').length,
    approved_world_rule_count: worldRules.filter(item => item.approval.status === 'approved').length,
    needs_approval_world_rule_count: worldRules.filter(item => (
      item.definition_status === 'ready' && item.approval.status !== 'approved'
    )).length,
    blocker_count: (
      pilotEpisodeBindings.filter(item => (
        !item.generated_story_id
        || item.missing_identity_kinds.length > 0
        || item.missing_world_rule_ids.length > 0
      )).length
      + worldRules.filter(item => item.definition_status !== 'ready' || item.approval.status !== 'approved').length
    ),
    warning_count: issues.length,
    issues,
  }
}

type AiComicSeriesVisualIdentityBase = Omit<AiComicSeriesVisualIdentity,
  | 'source_fingerprint'
  | 'definition_fingerprint'
  | 'definition_fields'
  | 'definition_notes'
  | 'approval'
  | 'missing_definition_fields'
  | 'definition_status'
>

type AiComicSeriesVisualWorldRuleBase = Pick<AiComicSeriesVisualWorldRule,
  'rule_id'
  | 'statement'
  | 'consequence'
  | 'source_story_ids'
> & {
  pilot_episode_nos: number[]
}

function finalizeWorldRule(
  base: AiComicSeriesVisualWorldRuleBase,
  previous?: AiComicSeriesVisualWorldRule,
): AiComicSeriesVisualWorldRule {
  const sourceFingerprint = worldRuleSourceFingerprint(base)
  const previousValues = new Map(
    (previous?.definition_fields ?? []).map(field => [field.field_id, field.value.trim()]),
  )
  const definitionFields = WORLD_RULE_DEFINITION_FIELDS.map(field => ({
    ...field,
    value: previousValues.get(field.field_id) ?? '',
    required: true,
  }))
  const missingDefinitionFields = definitionFields
    .filter(field => field.required && !field.value)
    .map(field => field.label)
  const pilotBindings = (previous?.pilot_bindings ?? [])
    .filter(binding => (
      base.pilot_episode_nos.includes(binding.episode_no)
      && isVisualWorldRulePilotTargetType(binding.target_type)
      && Boolean(binding.target_id?.trim())
      && base.source_story_ids[String(binding.episode_no)] === binding.story_id
    ))
    .map(binding => ({
      episode_no: binding.episode_no,
      target_type: binding.target_type,
      target_id: binding.target_id.trim(),
      story_id: binding.story_id,
    }))
  const missingPilotEpisodeNos = base.pilot_episode_nos.filter(episodeNo => (
    !pilotBindings.some(binding => binding.episode_no === episodeNo)
  ))
  const missingVisualMapping = missingDefinitionFields.length > 0 || missingPilotEpisodeNos.length > 0
  const previousApproval = previous?.approval
  const approvalIsStale = previousApproval?.status === 'approved' && (
    previousApproval.source_fingerprint !== sourceFingerprint
    || missingVisualMapping
  )
  const approval = previousApproval
    ? {
        ...previousApproval,
        status: approvalIsStale ? 'stale' as const : previousApproval.status,
      }
    : {
        status: 'pending' as const,
        human_confirmed: false,
      }
  const visualSymbol = definitionFields.find(field => field.field_id === 'visual_symbol')?.value || undefined
  const triggerCondition = definitionFields.find(field => field.field_id === 'trigger_condition')?.value || undefined
  return {
    rule_id: base.rule_id,
    statement: base.statement,
    consequence: base.consequence,
    visual_symbol: visualSymbol,
    trigger_condition: triggerCondition,
    source_story_ids: { ...base.source_story_ids },
    source_fingerprint: sourceFingerprint,
    definition_fields: definitionFields,
    definition_notes: previous?.definition_notes?.trim() ?? '',
    approval,
    missing_definition_fields: missingDefinitionFields,
    definition_status: missingVisualMapping ? 'needs_definition' : 'ready',
    pilot_bindings: pilotBindings,
    missing_pilot_episode_nos: missingPilotEpisodeNos,
    missing_visual_mapping: missingVisualMapping,
  }
}

function appendCharacterAndCostumeIdentities(input: {
  identities: AiComicSeriesVisualIdentity[]
  previousIdentities: Map<string, AiComicSeriesVisualIdentity>
  characterName: string
  canonicalDescription: string
  costumeDescription: string
  source: Extract<AiComicSeriesVisualIdentity['source'], 'plan_character' | 'premise_antagonist' | 'series_memory'>
  allEpisodeNos: number[]
  pilotEpisodeNos: number[]
  forbiddenSubstitutions: string[]
  assetLibrary?: AiComicSeedanceAssetLibrary
}) {
  const characterName = input.characterName.trim()
  const characterIdentityId = aiComicSeriesVisualIdentityId('character', characterName)
  input.identities.push(finalizeIdentity({
    identity_id: characterIdentityId,
    kind: 'character',
    label: characterName,
    canonical_description: input.canonicalDescription,
    source: input.source,
    source_episode_nos: input.allEpisodeNos,
    pilot_episode_nos: input.pilotEpisodeNos,
    continuity_constraints: uniqueStrings([
      input.canonicalDescription,
      `角色名“${characterName}”与其身份、年龄状态、性别表达不得跨镜头漂移`,
    ]),
    negative_constraints: uniqueStrings([
      ...input.forbiddenSubstitutions,
      `不得把“${characterName}”替换为未定义的通用人物`,
    ]),
    production_credit: false,
  }, input.previousIdentities.get(characterIdentityId), input.assetLibrary))

  const costumeLabel = `${characterName}主服装`
  const costumeIdentityId = aiComicSeriesVisualIdentityId('costume', costumeLabel)
  input.identities.push(finalizeIdentity({
    identity_id: costumeIdentityId,
    kind: 'costume',
    label: costumeLabel,
    canonical_description: input.costumeDescription,
    parent_identity_id: characterIdentityId,
    source: 'derived_costume',
    source_episode_nos: input.allEpisodeNos,
    pilot_episode_nos: input.pilotEpisodeNos,
    continuity_constraints: [`服装必须绑定角色“${characterName}”，阶段变化须显式记录后再使用`],
    negative_constraints: ['不得在相邻镜头无剧情依据地改变服装版型、颜色或磨损状态'],
    production_credit: false,
  }, input.previousIdentities.get(costumeIdentityId), input.assetLibrary))
}

function finalizeIdentity(
  base: AiComicSeriesVisualIdentityBase,
  previous?: AiComicSeriesVisualIdentity,
  assetLibrary?: AiComicSeedanceAssetLibrary,
): AiComicSeriesVisualIdentity {
  const sourceFingerprint = identitySourceFingerprint(base)
  const previousValues = new Map(
    (previous?.definition_fields ?? []).map(field => [field.field_id, field.value.trim()]),
  )
  const definitionFields = VISUAL_DEFINITION_FIELDS[base.kind].map(field => ({
    ...field,
    value: previousValues.get(field.field_id) ?? '',
    required: true,
  }))
  const missingDefinitionFields = definitionFields
    .filter(field => field.required && !field.value)
    .map(field => field.label)
  const previousApproval = previous?.approval
  const approvalIsStale = previousApproval?.status === 'approved' && (
    previousApproval.source_fingerprint !== sourceFingerprint
    || missingDefinitionFields.length > 0
  )
  const approval = previousApproval
    ? {
        ...previousApproval,
        status: approvalIsStale ? 'stale' as const : previousApproval.status,
      }
    : {
        status: 'pending' as const,
        human_confirmed: false,
      }
  const definitionNotes = previous?.definition_notes?.trim() ?? ''
  const definitionFingerprint = identityDefinitionFingerprint({
    source_fingerprint: sourceFingerprint,
    definition_fields: definitionFields,
    definition_notes: definitionNotes,
  })
  const identity = {
    ...base,
    production_credit: false,
    source_fingerprint: sourceFingerprint,
    definition_fingerprint: definitionFingerprint,
    definition_fields: definitionFields,
    definition_notes: definitionNotes,
    approval,
    missing_definition_fields: missingDefinitionFields,
    definition_status: missingDefinitionFields.length ? 'needs_definition' as const : 'ready' as const,
  }
  return {
    ...identity,
    production_credit: approval.status === 'approved' && hasProductionCredit(assetLibrary, identity),
  }
}

function identitySourceFingerprint(identity: AiComicSeriesVisualIdentityBase): string {
  const payload = {
    identity_id: identity.identity_id,
    kind: identity.kind,
    label: identity.label,
    canonical_description: identity.canonical_description,
    parent_identity_id: identity.parent_identity_id,
    continuity_constraints: identity.continuity_constraints,
    negative_constraints: identity.negative_constraints,
  }
  return `sha256:${createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex')}`
}

function identityDefinitionFingerprint(input: Pick<
  AiComicSeriesVisualIdentity,
  'source_fingerprint' | 'definition_fields' | 'definition_notes'
>): string {
  const payload = {
    source_fingerprint: input.source_fingerprint,
    definition_fields: input.definition_fields.map(field => [field.field_id, field.value.trim()]),
    definition_notes: input.definition_notes.trim(),
  }
  return `sha256:${createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex')}`
}

function worldRuleSourceFingerprint(rule: AiComicSeriesVisualWorldRuleBase): string {
  const payload = {
    rule_id: rule.rule_id,
    statement: rule.statement,
    consequence: rule.consequence,
    source_story_ids: Object.entries(rule.source_story_ids)
      .sort(([a], [b]) => Number(a) - Number(b)),
  }
  return `sha256:${createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex')}`
}

function resolvePilotEpisodeNos(episodeCount: number): number[] {
  return [...new Set([1, Math.ceil(episodeCount / 2), episodeCount])]
    .filter(episodeNo => episodeNo >= 1 && episodeNo <= episodeCount)
    .sort((a, b) => a - b)
}

function meaningfulLocations(items: NonNullable<AiComicContinuityLedger['series_memory']>['locations']) {
  return items.filter(item => {
    const label = item.label.trim()
    if (!label || label.length > 80) return false
    return item.status.includes('Seedance镜头')
      || item.continuity_notes.some(note => /成稿场景|来源场景|空间结构|镜头/.test(note))
  })
}

function meaningfulProps(items: NonNullable<AiComicContinuityLedger['series_memory']>['props']) {
  return items.filter(item => {
    const label = item.label.trim()
    return /^道具「[^」]{1,40}」外观参考$/.test(label)
      || /^(?:广播控制台|航行记录终端|记忆录音带|醒狮绣屏|木制绣架|劈丝线板|竹编药篮|草药辨识牌|洗药木盆|案卷|灯|判词|文书)$/.test(label)
  })
}

function extractPropLabel(label: string): string {
  return /^道具「([^」]+)」外观参考$/.exec(label.trim())?.[1]?.trim() || label.trim()
}

function buildPilotBinding(input: {
  episodeNo: number
  generatedStoryId?: string
  identities: AiComicSeriesVisualIdentity[]
  worldRules: AiComicSeriesVisualWorldRule[]
}): AiComicSeriesVisualPilotBinding {
  const relevant = input.identities.filter(item => item.pilot_episode_nos.includes(input.episodeNo))
  const byKind = (kind: AiComicSeriesVisualIdentityKind) => relevant
    .filter(item => item.kind === kind)
    .map(item => item.identity_id)
  const characterIdentityIds = byKind('character')
  const costumeIdentityIds = byKind('costume')
  const locationIdentityIds = byKind('location')
  const propIdentityIds = byKind('prop')
  const requiredIdentityIds = uniqueStrings([
    ...characterIdentityIds,
    ...costumeIdentityIds,
    ...locationIdentityIds,
    ...propIdentityIds,
  ])
  const productionCreditIdentityIds = relevant
    .filter(item => item.production_credit)
    .map(item => item.identity_id)
  const requiredKinds: AiComicSeriesVisualIdentityKind[] = ['character', 'costume', 'location', 'prop']
  const missingIdentityKinds = requiredKinds.filter(kind => byKind(kind).length === 0)
  const worldRuleIds = input.worldRules
    .filter(rule => rule.pilot_bindings.some(binding => binding.episode_no === input.episodeNo))
    .map(rule => rule.rule_id)
  const missingWorldRuleIds = input.worldRules
    .filter(rule => !worldRuleIds.includes(rule.rule_id))
    .map(rule => rule.rule_id)
  return {
    episode_no: input.episodeNo,
    generated_story_id: input.generatedStoryId,
    character_identity_ids: characterIdentityIds,
    costume_identity_ids: costumeIdentityIds,
    location_identity_ids: locationIdentityIds,
    prop_identity_ids: propIdentityIds,
    required_identity_ids: requiredIdentityIds,
    production_credit_identity_ids: productionCreditIdentityIds,
    identity_coverage_percent: Math.round(((requiredKinds.length - missingIdentityKinds.length) / requiredKinds.length) * 100),
    production_credit_coverage_percent: requiredIdentityIds.length
      ? Math.round((productionCreditIdentityIds.length / requiredIdentityIds.length) * 100)
      : 0,
    missing_identity_kinds: missingIdentityKinds,
    world_rule_ids: worldRuleIds,
    missing_world_rule_ids: missingWorldRuleIds,
    world_rule_coverage_percent: input.worldRules.length
      ? Math.round((worldRuleIds.length / input.worldRules.length) * 100)
      : 100,
  }
}

function buildIssues(
  identities: AiComicSeriesVisualIdentity[],
  worldRules: AiComicSeriesVisualWorldRule[],
  bindings: AiComicSeriesVisualPilotBinding[],
): string[] {
  const issues: string[] = []
  if (identities.some(item => item.kind === 'character' && item.missing_definition_fields.length > 0)) {
    issues.push('角色视觉定义仍缺年龄区间、体态、脸部特征、发型或性别/代词字段')
  }
  if (identities.some(item => item.kind === 'costume' && item.missing_definition_fields.length > 0)) {
    issues.push('服装视觉定义仍缺主服装细节、色彩方案或阶段变化字段')
  }
  const needsApprovalCount = identities.filter(item => (
    item.definition_status === 'ready' && item.approval.status !== 'approved'
  )).length
  if (needsApprovalCount > 0) {
    issues.push(`有 ${needsApprovalCount} 个完整视觉定义仍待真人审批`)
  }
  const staleApprovalCount = identities.filter(item => item.approval.status === 'stale').length
  if (staleApprovalCount > 0) {
    issues.push(`有 ${staleApprovalCount} 个视觉审批因源设定变化已失效，必须重新复核`)
  }
  if (worldRules.some(rule => rule.missing_definition_fields.length > 0)) {
    issues.push('原创世界规则仍需补充逐条视觉符号与触发条件')
  }
  const missingRuleBindingCount = worldRules.filter(rule => rule.missing_pilot_episode_nos.length > 0).length
  if (missingRuleBindingCount > 0) {
    issues.push(`有 ${missingRuleBindingCount} 条原创世界规则尚未绑定 E1/E10/E20 的真实代表镜头或 GEARS 段`)
  }
  const needsRuleApprovalCount = worldRules.filter(rule => (
    rule.definition_status === 'ready' && rule.approval.status !== 'approved'
  )).length
  if (needsRuleApprovalCount > 0) {
    issues.push(`有 ${needsRuleApprovalCount} 条完整世界规则视觉映射仍待真人审批`)
  }
  const staleRuleApprovalCount = worldRules.filter(rule => rule.approval.status === 'stale').length
  if (staleRuleApprovalCount > 0) {
    issues.push(`有 ${staleRuleApprovalCount} 条世界规则视觉审批因来源或代表内容变化已失效，必须重新复核`)
  }
  for (const binding of bindings) {
    if (!binding.generated_story_id) issues.push(`E${binding.episode_no} 尚无已生成故事快照`)
    if (binding.missing_identity_kinds.length) {
      issues.push(`E${binding.episode_no} 缺少 ${binding.missing_identity_kinds.join('、')} 稳定身份`)
    }
    if (binding.missing_world_rule_ids.length) {
      issues.push(`E${binding.episode_no} 缺少世界规则视觉绑定：${binding.missing_world_rule_ids.join('、')}`)
    }
  }
  if (!identities.some(item => item.production_credit)) {
    issues.push('尚无同时满足视觉定义批准、文件校验、版权授权与真人媒体审核的真实图片资产；production credit 保持 0')
  }
  return uniqueStrings(issues)
}

function isVisualWorldRulePilotTargetType(
  value: unknown,
): value is AiComicSeriesVisualWorldRulePilotTargetType {
  return value === 'seedance_shot' || value === 'gears_segment'
}

function hasProductionCredit(
  library: AiComicSeedanceAssetLibrary | undefined,
  identity: Pick<AiComicSeriesVisualIdentity,
    'identity_id' | 'kind' | 'source_fingerprint' | 'definition_fingerprint'>,
): boolean {
  return Boolean(library?.items.some(item => (
    item.kind === identity.kind
    && item.provider === 'local_upload'
    && Boolean(item.local_path)
    && /^[a-f0-9]{64}$/.test(item.content_sha256 ?? '')
    && item.rights_status === 'authorized'
    && item.human_review_status === 'approved'
    && Boolean(item.reviewer_id?.trim())
    && item.identity_binding?.series_identity_id === identity.identity_id
    && item.identity_binding.source_fingerprint === identity.source_fingerprint
    && item.identity_binding.visual_definition_fingerprint === identity.definition_fingerprint
    && item.identity_binding.status === 'approved'
    && item.identity_binding.human_confirmed === true
    && Boolean(item.identity_binding.reviewer_id?.trim())
  )))
}

function sourceFingerprint(input: {
  plan: AiComicSeriesPlan
  ledger: AiComicContinuityLedger
  generatedEpisodeStoryIds: Record<string, string>
  assetLibrary?: AiComicSeedanceAssetLibrary
}): string {
  const memory = input.ledger.series_memory
  const payload = {
    characters: (input.plan.main_characters ?? []).map(item => [item.name, item.role, item.visual_signature]),
    premise_contract: input.plan.premise_contract,
    recurring_motifs: input.plan.recurring_motifs,
    locations: meaningfulLocations(memory?.locations ?? []).map(item => [item.label, item.related_episode_nos, item.visual_anchor]),
    props: meaningfulProps(memory?.props ?? []).map(item => [item.label, item.related_episode_nos, item.visual_anchor]),
    generated_episode_story_ids: Object.entries(input.generatedEpisodeStoryIds).sort(([a], [b]) => Number(a) - Number(b)),
    asset_credit: (input.assetLibrary?.items ?? []).map(item => [
      item.asset_id,
      item.content_sha256,
      item.rights_status,
      item.human_review_status,
      item.reviewer_id,
      item.identity_binding?.series_identity_id,
      item.identity_binding?.source_fingerprint,
      item.identity_binding?.visual_definition_fingerprint,
      item.identity_binding?.status,
    ]).sort(([a], [b]) => String(a).localeCompare(String(b))),
  }
  return `sha256:${createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex')}`
}

function inferPeriod(plan: AiComicSeriesPlan): string {
  const labels = uniqueStrings((plan.episodes ?? []).flatMap(episode => episode.knowledge_focus ?? []))
  return labels.find(label => /当代|现代|近代|古代|汉代|唐代|宋代|元代|明代|清代|民国/.test(label)) ?? '待定义'
}

function dedupeIdentities(items: AiComicSeriesVisualIdentity[]): AiComicSeriesVisualIdentity[] {
  const byId = new Map<string, AiComicSeriesVisualIdentity>()
  for (const item of items) {
    const existing = byId.get(item.identity_id)
    if (!existing) {
      byId.set(item.identity_id, item)
      continue
    }
    byId.set(item.identity_id, {
      ...existing,
      source_episode_nos: sortedEpisodeNos([...existing.source_episode_nos, ...item.source_episode_nos]),
      pilot_episode_nos: sortedEpisodeNos([...existing.pilot_episode_nos, ...item.pilot_episode_nos]),
      continuity_constraints: uniqueStrings([...existing.continuity_constraints, ...item.continuity_constraints]),
      negative_constraints: uniqueStrings([...existing.negative_constraints, ...item.negative_constraints]),
      production_credit: existing.production_credit || item.production_credit,
    })
  }
  const kindOrder: Record<AiComicSeriesVisualIdentityKind, number> = {
    character: 0,
    costume: 1,
    location: 2,
    prop: 3,
  }
  return [...byId.values()].sort((a, b) => (
    kindOrder[a.kind] - kindOrder[b.kind]
    || a.label.localeCompare(b.label, 'zh-CN')
  ))
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

function sortedEpisodeNos(values: number[]): number[] {
  return [...new Set(values.filter(Number.isInteger))].sort((a, b) => a - b)
}

function intersectEpisodes(values: number[], pilotEpisodeNos: number[]): number[] {
  const pilots = new Set(pilotEpisodeNos)
  return sortedEpisodeNos(values).filter(episodeNo => pilots.has(episodeNo))
}
