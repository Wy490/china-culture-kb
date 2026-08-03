import { StoryKnowledgeContractV1Schema } from '@shared/schemas.js';
import type {
  EntryDetail,
  LegacyEntryStoryKnowledgeContractAdapterResultV1,
  StoryKnowledgeClaimV1,
  StoryKnowledgeContractV1,
  StoryKnowledgeMissingMaterialV1,
  StoryKnowledgeProductionMaterialV1,
} from '@shared/types.js';

export function adaptLegacyChinaCultureEntryToStoryKnowledgeContract(
  entry: EntryDetail,
): LegacyEntryStoryKnowledgeContractAdapterResultV1 {
  const legacyEntrySnapshot = structuredClone(entry);
  const sourceCitations = uniqueText(entry.sources);
  const sources: StoryKnowledgeContractV1['sources'] = sourceCitations.map(
    (citation, index) => ({
      source_ref_id: `legacy-source-${index + 1}`,
      citation,
      grade: 'ungraded',
      verification_status: 'legacy_unmapped',
      note: '旧条目只有字符串来源，尚未完成 claim 级映射和 A-D 分级。',
    }),
  );
  const sourceRefIds = sources.map(source => source.source_ref_id);
  const entryId = safeIdentifier(entry.name);
  const claims: StoryKnowledgeClaimV1[] = [
    {
      claim_id: `${entryId}-summary`,
      claim_type: 'supporting_fact',
      text: entry.summary,
      subject: entry.name,
      ...(entry.era ? { time: entry.era } : {}),
      ...(entry.region ? { place: entry.region } : {}),
      source_ref_ids: sourceRefIds,
      certainty: sourceRefIds.length > 0 ? 'probable' : 'unverified',
      usage: 'bounded_context',
      scope: '旧条目摘要，只能作为受边界约束的创作背景，不能自动升级为关键事实。',
    },
    ...entry.unverifiedPoints
      .map((text, index): StoryKnowledgeClaimV1 => ({
        claim_id: `${entryId}-unverified-${index + 1}`,
        claim_type: 'disputed_or_unknown',
        text,
        subject: entry.name,
        source_ref_ids: [],
        certainty: 'unverified',
        usage: 'blocked',
        scope: '旧条目待核实点；补齐证据前不得写成确定事实。',
      })),
  ];
  const relations = entry.localCreativeRelations ?? [];
  const productionMaterial = buildLegacyProductionMaterial(entry);
  const missingMaterial = buildLegacyMissingMaterial({
    sources,
    productionMaterial,
    hasCreativeCore: relations.some(relation => (
      relation.relation_type === 'cultural_influence'
      || relation.relation_type === 'contemporary_adaptation'
    )),
  });
  const contract = StoryKnowledgeContractV1Schema.parse({
    schema_version: 'story-knowledge-contract/v1',
    source_entry: {
      name: entry.name,
      source_domain: entry.sourceDomain ?? 'china_culture',
      province: entry.province,
      region: entry.region,
      entry_type: entry.type,
      ...(entry.era ? { era: entry.era } : {}),
    },
    sources,
    claims,
    creative_affordance: {
      character_goals: [],
      pressures: [],
      choices: [],
      consequences: [],
      visible_events: [],
      relationships: uniqueText(relations
        .filter(relation => (
          relation.relation_type === 'direct_region'
          || relation.relation_type === 'cultural_influence'
        ))
        .map(relation => relation.description)),
      story_pressures: uniqueText(relations
        .filter(relation => relation.relation_type === 'cultural_influence')
        .map(relation => relation.description)),
      allowed_dramatization: uniqueText(relations
        .filter(relation => relation.relation_type === 'contemporary_adaptation')
        .map(relation => relation.description)),
      forbidden_dramatization: uniqueText([
        ...relations
          .filter(relation => relation.relation_type === 'do_not_write_as')
          .map(relation => relation.description),
        ...entry.unverifiedPoints.map(point => `不得将待核实内容写成确定事实：${point}`),
      ]),
      legend_variants: /神话|传说|民间故事/.test(entry.type)
        ? uniqueText(entry.unverifiedPoints)
        : [],
      dialogue_register: [],
      forbidden_language: [],
    },
    production_material: productionMaterial,
    missing_material: missingMaterial,
    boundary: {
      legacy_adapter: true,
      consumed_by_generation: false,
      generated_content_writeback_allowed: false,
      critical_facts_can_be_asserted: false,
      machine_validation_only: true,
      human_review_complete: false,
    },
  });
  const result: LegacyEntryStoryKnowledgeContractAdapterResultV1 = {
    schema_version: 'legacy-entry-story-knowledge-contract-adapter/v1',
    contract,
    legacy_entry_snapshot: legacyEntrySnapshot,
    mapping_report: {
      preserved_legacy_fields: Object.keys(legacyEntrySnapshot).sort(),
      source_count: contract.sources.length,
      ungraded_source_count: contract.sources.filter(source => source.grade === 'ungraded').length,
      claim_count: contract.claims.length,
      critical_fact_ready_count: 0,
      missing_material_count: contract.missing_material.length,
    },
  };
  return deepFreeze(result);
}

function buildLegacyProductionMaterial(
  entry: EntryDetail,
): StoryKnowledgeProductionMaterialV1 {
  const assetSplit = entry.asset_split;
  const locationDescriptions = entry.relatedLocations.map(
    location => `${location.name}：${location.description}`,
  );
  return {
    characters: uniqueText(assetSplit?.characters ?? []),
    costume_and_hair: [],
    props: uniqueText([
      ...(assetSplit?.character_props ?? []),
      ...(assetSplit?.scene_props ?? []),
    ]),
    architecture_and_spaces: uniqueText([
      ...(assetSplit?.scenes ?? []),
      ...locationDescriptions,
    ]),
    spaces_and_routes: uniqueText([
      ...(assetSplit?.scenes ?? []),
      ...locationDescriptions,
    ]),
    materials_tools_and_process: [],
    lighting_season_and_weather: [],
    ambient_sound: [],
    rituals_and_crowd: [],
    interviews_broll_and_archive: [],
    rights_clearance_notes: [],
  };
}

function buildLegacyMissingMaterial(input: {
  sources: StoryKnowledgeContractV1['sources'];
  productionMaterial: StoryKnowledgeProductionMaterialV1;
  hasCreativeCore: boolean;
}): StoryKnowledgeMissingMaterialV1[] {
  const missing: StoryKnowledgeMissingMaterialV1[] = [];
  if (input.sources.length === 0 || input.sources.some(source => source.grade === 'ungraded')) {
    missing.push({
      missing_id: 'legacy-claim-level-source-mapping',
      category: 'claim_level_source_mapping',
      label: 'Claim 级来源映射',
      reason: '旧条目来源尚未映射到具体 claim，不能据此断言关键事实。',
      blocking_level: 'blocking',
      affects: ['verified_facts', 'story_blueprint'],
    });
  }
  if (!input.sources.some(source => (
    source.verification_status === 'human_verified'
    && (source.grade === 'A' || source.grade === 'B')
  ))) {
    missing.push({
      missing_id: 'legacy-authoritative-source',
      category: 'authoritative_source',
      label: '权威来源',
      reason: '尚无经过人工核验的 A/B 级来源，关键事实必须保持关闭。',
      blocking_level: 'blocking',
      affects: ['verified_facts', 'factual_reconstruction'],
    });
  }
  if (!input.hasCreativeCore) {
    missing.push({
      missing_id: 'legacy-creative-affordance',
      category: 'creative_affordance',
      label: '创作可供性',
      reason: '旧条目尚未结构化人物目标、压力、选择、后果和可见事件。',
      blocking_level: 'risk',
      affects: ['story_blueprint', 'scene_breakdown'],
    });
  }
  if (
    input.productionMaterial.characters.length === 0
    || input.productionMaterial.spaces_and_routes.length === 0
    || input.productionMaterial.materials_tools_and_process.length === 0
    || input.productionMaterial.ambient_sound.length === 0
  ) {
    missing.push({
      missing_id: 'legacy-production-material',
      category: 'production_material',
      label: '制作素材',
      reason: '旧条目尚未完整覆盖人物、空间路线、材料流程和环境声音。',
      blocking_level: 'risk',
      affects: ['scene_breakdown', 'gears_segments', 'asset_handoff'],
    });
  }
  if (input.productionMaterial.rights_clearance_notes.length === 0) {
    missing.push({
      missing_id: 'legacy-rights-clearance',
      category: 'rights_clearance',
      label: '权利与许可',
      reason: '旧条目未提供人物、社区、场所、作品或拍摄许可说明。',
      blocking_level: 'risk',
      affects: ['production_readiness', 'release'],
    });
  }
  return missing;
}

function safeIdentifier(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized ? `legacy-${normalized}` : 'legacy-entry';
}

function uniqueText(values: readonly string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}
