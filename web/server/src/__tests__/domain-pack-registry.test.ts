import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { success } from '@shared/types.js';
import {
  DomainPackNotFoundError,
  DomainPackRegistrationError,
  DomainPackRegistry,
  type DomainPack,
} from '../platform/domain-pack.js';
import { createStoryAgentDomainRegistry } from '../platform/domain-registry.js';

function fakePack(domain: string): DomainPack {
  return {
    meta: {
      schema_version: 'story-agent-domain-pack/v1',
      domain_id: domain,
      display_name: domain,
      description: `${domain} test pack`,
      version: '1.0.0',
      capabilities: ['entry_search', 'entry_detail', 'entry_match', 'story_plan', 'story_generate', 'type_catalog', 'story_safety', 'story_revision', 'story_supplement', 'production_material_draft', 'knowledge_writeback', 'gears_mapping'],
    },
    entryTypes: [{
      name: 'test_entry',
      recommended_generation_types: [`${domain}_generation`],
      recommended_video_types: [`${domain}_story`],
      recommended_presentation_styles: [`${domain}_style`],
      description: 'test entry type',
    }],
    generationTypes: [{
      id: `${domain}_story`,
      group: 'test group',
      label: `${domain} story`,
      description: 'test generation type',
      default_presentation_style: `${domain}_style`,
      default_duration: 60,
      compatible_entry_types: ['test_entry'],
    }],
    revisionGuidance: {
      schema_version: 'story-domain-revision-guidance/v1',
      writer_role: `${domain} repair writer`,
      source_boundary_rules: ['keep source boundaries'],
      human_review_requirement: 'human review remains required',
    },
    supplementGuidance: {
      schema_version: 'story-domain-supplement-guidance/v1',
      candidate_kind: 'project_material_candidate',
      candidate_heading: `${domain} project material candidate`,
      review_rules: ['keep supplemental material inside the project boundary'],
      human_review_requirement: 'human review remains required',
    },
    productionMaterialGuidance: {
      schema_version: 'story-domain-production-material-guidance/v1',
      audience_level_default: `${domain} beginner audience`,
      audience_level_comprehension_note: `${domain} comprehension boundary`,
      learner_profile_default: `${domain} learner profile`,
      learner_profile_foundation_note: `${domain} learner foundation`,
      heritage_or_craft_type_label: `${domain} practice type`,
      heritage_or_craft_type_category: `${domain} practice category`,
      heritage_or_craft_type_review_note: `${domain} practice review boundary`,
      speaker_position_role: `${domain} speaker role`,
      speaker_position_boundary_note: `${domain} speaker boundary`,
      speaker_position_expression_note: `${domain} speaker expression`,
      project_name_review_note: `${domain} project name review`,
      forbidden_claims_rule: `${domain} forbidden claims`,
      forbidden_claims_default_boundary: `${domain} forbidden claims boundary`,
      documentation_assets_intro: `${domain} documentation intro`,
      documentation_assets_missing_source_note: `${domain} missing documentation source`,
      documentation_assets_rights_note: `${domain} documentation rights`,
      source_cues_review_note: `${domain} source cues review`,
      source_cues_missing_source_note: `${domain} missing source cues`,
      witness_or_expert_roles: `${domain} witness roles`,
      witness_or_expert_role_note: `${domain} witness role boundary`,
      what_must_not_be_claimed_rule: `${domain} prohibited claim rule`,
      shot_prompt_style_boundary: `${domain} shot prompt boundary`,
      parent_teacher_extension_question: `${domain} parent teacher question`,
      single_shot_acceptance_boundary: `${domain} single shot acceptance boundary`,
      knowledge_outline_progression: `${domain} knowledge outline progression`,
      fact_boundary_card_rule: `${domain} fact boundary card rule`,
      fact_boundary_card_fallback: `${domain} fact boundary card fallback`,
      source_cues_entry_label: `${domain} source cues entry label`,
      source_cues_confirmed_label: `${domain} source cues confirmed label`,
      source_cues_unverified_label: `${domain} source cues unverified label`,
      source_cues_default_review_scope: `${domain} source cues default review scope`,
      parent_teacher_review_boundary: `${domain} parent teacher review boundary`,
      share_trigger_frame: `${domain} share trigger frame`,
      share_trigger_reason: `${domain} share trigger reason`,
      diagram_or_caption_boundary: `${domain} diagram or caption boundary`,
      comment_prompt_focus: `${domain} comment prompt focus`,
      comment_prompt_boundary: `${domain} comment prompt boundary`,
      misconception_boundary_rule: `${domain} misconception boundary rule`,
      misconception_boundary_fallback: `${domain} misconception boundary fallback`,
    },
    async searchEntries() {
      return success([]);
    },
    async getEntryDetail() {
      throw new Error('not used by registry unit tests');
    },
    async matchEntries() {
      return success({ query: '', matches: [], best_match: null, fallback_message: null });
    },
    async planStory() {
      throw new Error('not used by registry unit tests');
    },
    async generateStory() {
      throw new Error('not used by registry unit tests');
    },
    validateStoryContent() {
      throw new Error('not used by registry unit tests');
    },
    planKnowledgeWriteback() {
      return {
        schema_version: 'story-domain-knowledge-writeback-plan/v1',
        domain_id: domain,
        target_kind: 'none',
        eligible: false,
        blockers: ['test_domain_does_not_support_writeback'],
        requires_human_review: true,
        direct_writeback_allowed: false,
        writeback_performed: false,
        real_credit_granted: false,
      };
    },
    mapGearsConstraints({ story, segment }) {
      return [...story.cultural_constraints, ...segment.cultural_constraints];
    },
  };
}

describe('DomainPackRegistry', () => {
  it('registers packs and exposes a deterministic domain list', () => {
    const registry = new DomainPackRegistry();
    registry.register(fakePack('second_domain'));
    registry.register(fakePack('first_domain'));

    expect(registry.list()).toEqual(['first_domain', 'second_domain']);
    expect(registry.require('first_domain').meta.domain_id).toBe('first_domain');
    expect(registry.require('first_domain').generationTypes[0]?.id).toBe('first_domain_story');
  });

  it('fails closed for an unknown domain', () => {
    const registry = new DomainPackRegistry();

    expect(() => registry.require('unknown_domain')).toThrow(DomainPackNotFoundError);
    try {
      registry.require('unknown_domain');
    } catch (error) {
      expect(error).toMatchObject({ code: 'DOMAIN_PACK_NOT_FOUND' });
    }
  });

  it('rejects invalid and duplicate registrations', () => {
    const registry = new DomainPackRegistry();
    registry.register(fakePack('china_culture'));

    expect(() => registry.register(fakePack('../unsafe'))).toThrow(DomainPackRegistrationError);
    expect(() => registry.register(fakePack('china_culture'))).toThrow(DomainPackRegistrationError);

    const baseIncompletePack = fakePack('incomplete_domain');
    const incompletePack: DomainPack = {
      ...baseIncompletePack,
      meta: { ...baseIncompletePack.meta, capabilities: ['entry_search'] },
    };
    expect(() => registry.register(incompletePack)).toThrow(DomainPackRegistrationError);
  });

  it('rejects malformed domain-owned type catalogs without restricting valid new identifiers', () => {
    const registry = new DomainPackRegistry();
    const malformedBase = fakePack('catalog_domain');
    const malformed: DomainPack = {
      ...malformedBase,
      generationTypes: [{
        ...malformedBase.generationTypes[0],
        id: 'Uppercase-Unsafe',
      }],
    };

    expect(() => registry.register(malformed)).toThrow(DomainPackRegistrationError);

    const valid = fakePack('police_story');
    registry.register(valid);
    expect(registry.require('police_story').generationTypes[0]?.id).toBe('police_story_story');
  });

  it('fails registration before traffic when runtime shape contradicts capability claims', () => {
    const missingMethod = {
      ...fakePack('missing_method'),
      mapGearsConstraints: undefined,
    } as unknown as DomainPack;
    const wrongSchemaBase = fakePack('wrong_schema');
    const wrongSchema = {
      ...wrongSchemaBase,
      meta: { ...wrongSchemaBase.meta, schema_version: 'story-agent-domain-pack/v99' },
    } as unknown as DomainPack;
    const wrongDurationBase = fakePack('wrong_duration');
    const wrongDuration = {
      ...wrongDurationBase,
      generationTypes: [{ ...wrongDurationBase.generationTypes[0], default_duration: false }],
    } as unknown as DomainPack;
    const missingRevisionGuidance = {
      ...fakePack('missing_revision'),
      revisionGuidance: undefined,
    } as unknown as DomainPack;
    const missingSupplementGuidance = {
      ...fakePack('missing_supplement'),
      supplementGuidance: undefined,
    } as unknown as DomainPack;
    const unsafeSupplementGuidanceBase = fakePack('unsafe_supplement');
    const unsafeSupplementGuidance = {
      ...unsafeSupplementGuidanceBase,
      supplementGuidance: {
        ...unsafeSupplementGuidanceBase.supplementGuidance,
        candidate_kind: 'project_material_candidate',
        writeback_draft_heading: 'must not exist for project-only material',
      },
    } as unknown as DomainPack;
    const missingKnowledgeWriteback = {
      ...fakePack('missing_writeback'),
      planKnowledgeWriteback: undefined,
    } as unknown as DomainPack;
    const invalidProductionGuidanceBase = fakePack('invalid_production_guidance');
    const invalidProductionGuidance = {
      ...invalidProductionGuidanceBase,
      productionMaterialGuidance: {
        ...invalidProductionGuidanceBase.productionMaterialGuidance,
        misconception_boundary_rule: '',
      },
    } as unknown as DomainPack;

    expect(() => new DomainPackRegistry().register(missingMethod)).toThrow(DomainPackRegistrationError);
    expect(() => new DomainPackRegistry().register(wrongSchema)).toThrow(DomainPackRegistrationError);
    expect(() => new DomainPackRegistry().register(wrongDuration)).toThrow(DomainPackRegistrationError);
    expect(() => new DomainPackRegistry().register(missingRevisionGuidance)).toThrow(DomainPackRegistrationError);
    expect(() => new DomainPackRegistry().register(missingSupplementGuidance)).toThrow(DomainPackRegistrationError);
    expect(() => new DomainPackRegistry().register(unsafeSupplementGuidance)).toThrow(DomainPackRegistrationError);
    expect(() => new DomainPackRegistry().register(missingKnowledgeWriteback)).toThrow(DomainPackRegistrationError);
    expect(() => new DomainPackRegistry().register(invalidProductionGuidance)).toThrow(DomainPackRegistrationError);
  });

  it('boots with china_culture and an independent original_fiction Domain Pack', () => {
    const registry = createStoryAgentDomainRegistry();

    expect(registry.list()).toEqual(['china_culture', 'original_fiction']);
    expect(registry.require('china_culture').meta).toMatchObject({
      domain_id: 'china_culture',
      version: '1.4.5',
      capabilities: ['entry_search', 'entry_detail', 'entry_match', 'story_plan', 'story_generate', 'type_catalog', 'story_safety', 'story_revision', 'story_supplement', 'production_material_draft', 'knowledge_writeback', 'gears_mapping'],
    });
    expect(registry.require('china_culture').searchEntries).toBeTypeOf('function');
    expect(registry.require('china_culture').planKnowledgeWriteback).toBeTypeOf('function');
    expect(registry.require('china_culture').mapGearsConstraints).toBeTypeOf('function');
    expect(registry.require('original_fiction').revisionGuidance.writer_role).toContain('原创');
    expect(registry.require('china_culture').supplementGuidance).toMatchObject({
      candidate_kind: 'domain_knowledge_candidate',
      writeback_draft_heading: '正式知识库写入草案',
    });
    expect(registry.require('original_fiction').supplementGuidance).toMatchObject({
      candidate_kind: 'project_material_candidate',
      candidate_heading: '项目素材候选稿',
    });
    expect(registry.require('original_fiction').productionMaterialGuidance).toMatchObject({
      audience_level_default: '故事与影视叙事初学观众',
      learner_profile_default: '原创故事学习者/创作小组',
      heritage_or_craft_type_category: '原创项目中的虚构职业、技能或行动系统',
      speaker_position_role: '创作讲述者/课程主持人',
      project_name_review_note: '正式写入生产卡片前需由创作者确认项目名称、作品权利和发布口径。',
      forbidden_claims_default_boundary: '所有补录内容只属于当前原创项目，需经创作者与权利审查确认。',
      documentation_assets_rights_note: '用户素材、参考图、音乐、真实品牌/场地/作品引用需确认权利或替代方案。',
      witness_or_expert_roles: '创作者/编剧/角色设计者/项目执行者/权利顾问',
      what_must_not_be_claimed_rule: '未经创作者或权利确认的人物原型、品牌、场地、作品归属、授权状态、现实经历和因果关系。',
      shot_prompt_style_boundary: '原创设定边界清晰',
      parent_teacher_extension_question: '你看到了哪些故事线索？角色做了什么选择？哪些设定还需要创作者或权利确认？',
      single_shot_acceptance_boundary: '原创设定与权利边界稳定',
      knowledge_outline_progression: '叙事知识层级：从人物目标、阻力、选择、行动结果到项目/权利边界递进。',
      fact_boundary_card_rule: '项目边界卡：已确认内容以用户原创素材、项目设定和权利记录为准；未确认内容只作创作候选，不作对外归属或授权断言。',
      fact_boundary_card_fallback: '人物设定、作品归属和授权状态需创作者或权利方复核。',
      source_cues_entry_label: '项目素材入口',
      source_cues_confirmed_label: '已确认项目素材线索',
      source_cues_unverified_label: '待确认创作/权利线索',
      source_cues_default_review_scope: '人物设定、作品归属、品牌/场地引用和授权状态仍需创作者或权利方复核。',
      parent_teacher_review_boundary: '再区分项目设定、戏剧化表达与现实/权利边界。',
      share_trigger_frame: '“原来如此”的人物选择或剧情反差',
      share_trigger_reason: '观众能用一句话讲清角色为何这样选择，并愿意讨论不同的叙事可能。',
      diagram_or_caption_boundary: '项目设定或现实引用旁标“创作者确认/权利待核”。',
      comment_prompt_focus: '人物选择、故事版本或创作设定',
      comment_prompt_boundary: '鼓励讨论叙事选择，不把未经创作者或权利确认的设定、现实引用或授权状态当作定论。',
      misconception_boundary_rule: '不要把项目设定、戏剧化表达、现实引用或授权状态混为已确认的外部事实或权利结论。',
      misconception_boundary_fallback: '存在待确认的设定或权利信息，对外发布前需由创作者或权利方复核。',
    });
    expect(registry.describe()).toEqual([
      expect.objectContaining({
        meta: expect.objectContaining({ domain_id: 'china_culture' }),
        entry_type_count: 12,
        generation_type_count: 15,
      }),
      expect.objectContaining({
        meta: expect.objectContaining({ domain_id: 'original_fiction' }),
        entry_type_count: 1,
        generation_type_count: 5,
      }),
    ]);
  });

  it('maps china_culture story and scene constraints to one deduplicated GEARS v2 boundary', () => {
    const pack = createStoryAgentDomainRegistry().require('china_culture');
    const constraints = pack.mapGearsConstraints({
      story: {
        cultural_constraints: ['全局史实边界', '重复边界'],
      },
      segment: {
        cultural_constraints: ['重复边界', '镜头虚构边界'],
      },
    } as Parameters<DomainPack['mapGearsConstraints']>[0]);

    expect(constraints).toEqual(['全局史实边界', '重复边界', '镜头虚构边界']);
  });

  it('keeps the platform entry route independent from the legacy entry service', async () => {
    const routeSource = await readFile(new URL('../routes/entries.ts', import.meta.url), 'utf-8');

    expect(routeSource).not.toContain("from '../services/entry-service.js'");
    expect(routeSource).toContain('storyAgentDomainRegistry.require(domain)');
  });

  it('keeps china_culture entry detail physically owned by the Domain Pack', async () => {
    const [packSource, legacyEntryServiceSource] = await Promise.all([
      readFile(new URL('../domains/china-culture/domain-pack.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../services/entry-service.ts', import.meta.url), 'utf-8'),
    ]);

    expect(packSource).toContain("from './entry-detail-service.js'");
    expect(packSource).toContain('getEntryDetail: getChinaCultureEntryDetailByName');
    expect(packSource).not.toContain('getEntryDetailByName, matchEntries, searchEntries');
    expect(legacyEntryServiceSource).not.toContain('export async function getEntryDetailByName');
  });

  it('keeps china_culture search dispatch and ranking rules inside the Domain Pack', async () => {
    const [packSource, searchSource, legacyEntryServiceSource] = await Promise.all([
      readFile(new URL('../domains/china-culture/domain-pack.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/entry-search-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../services/entry-service.ts', import.meta.url), 'utf-8'),
    ]);

    expect(packSource).toContain("from './entry-search-service.js'");
    expect(packSource).toContain('return searchChinaCultureEntries');
    expect(searchSource).toContain('function detectSearchIntent');
    expect(searchSource).toContain('function computeSearchRank');
    expect(legacyEntryServiceSource).not.toContain('export async function searchEntries');
    expect(legacyEntryServiceSource).not.toContain('function detectSearchIntent');
    expect(legacyEntryServiceSource).not.toContain('function computeSearchRank');
  });

  it('keeps china_culture match scoring and language rules inside the domain boundary', async () => {
    const [packSource, matchSource, languageSource, legacyEntryServiceSource] = await Promise.all([
      readFile(new URL('../domains/china-culture/domain-pack.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/entry-match-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/entry-language-helpers.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../services/entry-service.ts', import.meta.url), 'utf-8'),
    ]);

    expect(packSource).toContain("from './entry-match-service.js'");
    expect(packSource).toContain('return matchChinaCultureEntries');
    expect(matchSource).toContain('export function computeChinaCultureMatchScore');
    expect(languageSource).toContain('export function extractChinaCultureKeywords');
    expect(languageSource).toContain('export function detectChinaCultureProvince');
    expect(legacyEntryServiceSource).not.toContain('export async function matchEntries');
    expect(legacyEntryServiceSource).not.toContain('export function computeMatchScore');
    expect(legacyEntryServiceSource).not.toContain('TYPE_KEYWORD_HINTS');
  });

  it('keeps the legacy entry service as a logic-free compatibility facade', async () => {
    const [legacySource, knowledgeSource, searchSource, matchSource, storySource, storyPreparationSource, storyKnowledgeSource, outlineSource] = await Promise.all([
      readFile(new URL('../services/entry-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/entry-knowledge-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/entry-search-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/entry-match-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/story-generation-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/story-generation-preparation-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../domains/china-culture/story-knowledge-pack-service.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../services/outline-service.ts', import.meta.url), 'utf-8'),
    ]);

    expect(legacySource).toContain('Compatibility facade');
    expect(legacySource).not.toContain('function ');
    expect(legacySource).not.toContain('mcp-proxy');
    expect(knowledgeSource).toContain('export async function collectChinaCultureSearchableEntries');
    expect(searchSource).toContain("from './entry-knowledge-service.js'");
    expect(matchSource).toContain("from './entry-knowledge-service.js'");
    expect(storySource).toContain("from './story-generation-preparation-service.js'");
    expect(storyPreparationSource).toContain("from './story-knowledge-pack-service.js'");
    expect(storySource).not.toContain("from './entry-knowledge-service.js'");
    expect(storyKnowledgeSource).toContain("from './entry-knowledge-service.js'");
    expect(outlineSource).toContain("from '../domains/china-culture/entry-knowledge-service.js'");
  });

  it('keeps the China Culture MCP adapter in the domain and its legacy path logic-free', async () => {
    const [adapterSource, legacyProxySource, systemRouteSource] = await Promise.all([
      readFile(new URL('../domains/china-culture/knowledge-source-adapter.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../services/mcp-proxy.ts', import.meta.url), 'utf-8'),
      readFile(new URL('../routes/system.ts', import.meta.url), 'utf-8'),
    ]);

    expect(adapterSource).toContain("from '../../../../../mcp-server/src/tools/search.js'");
    expect(adapterSource).toContain('export function convertChinaCultureFullEntryDetail');
    expect(legacyProxySource).toContain('Compatibility facade');
    expect(legacyProxySource).not.toContain('function ');
    expect(legacyProxySource).not.toContain("from '../../../../mcp-server");
    expect(systemRouteSource).toContain("from '../domains/china-culture/knowledge-source-adapter.js'");
    expect(systemRouteSource).not.toContain("from '../services/mcp-proxy.js'");
  });

  it('keeps story plan and generate behind the Domain Pack boundary', async () => {
    const routeSource = await readFile(new URL('../routes/stories.ts', import.meta.url), 'utf-8');

    expect(routeSource).not.toContain('planStory,');
    expect(routeSource).not.toContain('generateAndStoreStory,');
    expect(routeSource).toContain('storyAgentDomainRegistry.require(domain).planStory');
    expect(routeSource).toContain('storyAgentDomainRegistry.require(domain).generateStory');
  });
});
