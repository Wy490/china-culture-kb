import type { DomainPack } from '../../platform/domain-pack.js';
import { getChinaCultureEntryDetailByName } from './entry-detail-service.js';
import { matchChinaCultureEntries } from './entry-match-service.js';
import type { ChinaCultureEntryMatchParams } from './entry-match-service.js';
import { searchChinaCultureEntries } from './entry-search-service.js';
import type { ChinaCultureEntrySearchParams } from './entry-search-service.js';
import { CHINA_CULTURE_ENTRY_TYPES, CHINA_CULTURE_GENERATION_TYPES } from './type-catalog.js';
import { validateChinaCultureStoryContent } from './story-safety.js';
import { planChinaCultureStory } from './story-planning-service.js';
import { generateAndStoreChinaCultureStory } from './story-generation-service.js';
import { planChinaCultureKnowledgeWriteback } from './knowledge-writeback-service.js';

export const chinaCultureDomainPack: DomainPack = {
  meta: {
    schema_version: 'story-agent-domain-pack/v1',
    domain_id: 'china_culture',
    display_name: '中国传统文化故事',
    description: '中国传统文化知识检索与故事生产领域包',
    version: '1.4.5',
    capabilities: ['entry_search', 'entry_detail', 'entry_match', 'story_plan', 'story_generate', 'type_catalog', 'story_safety', 'story_revision', 'story_supplement', 'production_material_draft', 'knowledge_writeback', 'gears_mapping'],
  },
  entryTypes: CHINA_CULTURE_ENTRY_TYPES,
  generationTypes: CHINA_CULTURE_GENERATION_TYPES,
  revisionGuidance: {
    schema_version: 'story-domain-revision-guidance/v1',
    writer_role: '中国传统文化故事修复写手',
    source_boundary_rules: [
      '不新增未经来源支持的硬事实；戏剧化内容必须保留在 fictionalized_elements、cultural_note 或 credibility_note 的明确边界中。',
      '必须保留 source_entry、credibility_note、cultural_constraints 和 scene_breakdown.source_entries 的来源、可信度与待核实约束。',
    ],
    human_review_requirement: '机器复验不能替代真人来源核验、文化审稿或发布批准。',
  },
  supplementGuidance: {
    schema_version: 'story-domain-supplement-guidance/v1',
    candidate_kind: 'domain_knowledge_candidate',
    candidate_heading: '知识库候选稿',
    writeback_draft_heading: '正式知识库写入草案',
    review_rules: [
      '不直接覆盖既有知识库事实。',
      '需要补来源、地点、核实方法和待核点后，才能转为正式条目字段。',
      '若内容只适用于当前项目，应保留在项目素材包，不进入领域知识库。',
    ],
    human_review_requirement: '待人工核实并通过 Domain Pack 写回计划后，才能进入正式知识库。',
  },
  productionMaterialGuidance: {
    schema_version: 'story-domain-production-material-guidance/v1',
    audience_level_default: '零基础文化入门观众/馆内观众/研学团',
    audience_level_comprehension_note: '不预设专业史学、工艺或民俗知识，术语需要先解释，再用地点、道具或动作举例。',
    learner_profile_default: '文化入门学习者/课堂学员',
    learner_profile_foundation_note: '不预设专业史学知识，用地点、人物、道具和动作建立理解。',
    heritage_or_craft_type_label: '非遗/工艺类型',
    heritage_or_craft_type_category: '相关技艺、民俗或传统工艺',
    heritage_or_craft_type_review_note: '国家/省/市级名录、传承人称谓和项目级别必须另补来源后确认。',
    speaker_position_role: '文化讲述者/课程主持人',
    speaker_position_boundary_note: '不冒充亲历者或权威机构。',
    speaker_position_expression_note: '先提出问题，再用来源线索、场景例子和当代关联推进。',
    project_name_review_note: '正式写入生产卡片前需确认该名称与官方目录、馆方说明或项目资料一致。',
    forbidden_claims_rule: '不得声称未经来源确认的年代、人物关系、官方身份、传承谱系或因果结论。',
    forbidden_claims_default_boundary: '所有补录内容需人工审稿并通过 Domain Pack 写回计划后，才能进入正式知识文件。',
    documentation_assets_intro: '文献/影像资产：先以项目来源、现有事实线索和分镜场景作为待补清单，不替代正式授权。',
    documentation_assets_missing_source_note: '待补官方目录、馆方说明、影音资源或出版物。',
    documentation_assets_rights_note: '图片、馆藏、曲目、歌词和传承人影像需确认授权或替代方案。',
    source_cues_review_note: '优先使用 source_quotes，其次使用 material_pack 已有事实线索；正式引用需补出处和授权。',
    source_cues_missing_source_note: '待补官方/馆方/出版物来源。',
    witness_or_expert_roles: '馆员/研究者/传承人/当地居民/后人/项目执行者',
    witness_or_expert_role_note: '一人解释来源，一人连接现场，一人补充当代痕迹；不要让演员口吻冒充真实证言。',
    what_must_not_be_claimed_rule: '未经来源确认的年代、数据、人物对白、亲历关系、官方级别、传承谱系、馆藏真伪和因果结论。',
    shot_prompt_style_boundary: '文化边界真实',
    parent_teacher_extension_question: '你看到哪个文化符号？角色做了什么选择？哪些内容还需要查来源？',
    single_shot_acceptance_boundary: '文化边界稳定',
    knowledge_outline_progression: '知识层级：从问题入口、概念定义、具体例子、事实边界到一句复盘递进。',
    fact_boundary_card_rule: '事实边界卡：已确认内容以项目来源和已确认素材线索为准；待核实内容只作线索，不作断言。',
    fact_boundary_card_fallback: '来源、年代、人物关系需人工复核。',
    source_cues_entry_label: '来源条目',
    source_cues_confirmed_label: '已确认事实线索',
    source_cues_unverified_label: '待核实线索',
    source_cues_default_review_scope: '来源、年代、人物关系和地点仍需人工复核。',
    parent_teacher_review_boundary: '再区分故事改写与事实边界。',
    share_trigger_frame: '“原来如此”的冷知识或反差发现',
    share_trigger_reason: '观众能用一句话讲给别人听，并愿意补充自己的地方经验或记忆。',
    diagram_or_caption_boundary: '重要事实旁标“来源/待核”。',
    comment_prompt_focus: '版本、地点或实物线索',
    comment_prompt_boundary: '鼓励补充来源，不引导观众把传说、戏剧化表达或未核信息当作定论。',
    misconception_boundary_rule: '不要把戏剧化、传说、类比或示意镜头写成已确认事实。',
    misconception_boundary_fallback: '存在待核实信息，正式入库前需补核实方法。',
  },
  searchEntries(params) {
    return searchChinaCultureEntries(params as ChinaCultureEntrySearchParams);
  },
  getEntryDetail: getChinaCultureEntryDetailByName,
  matchEntries(params) {
    return matchChinaCultureEntries(params as ChinaCultureEntryMatchParams);
  },
  planStory(params) {
    return planChinaCultureStory(params.entry_name, params.original_user_query);
  },
  generateStory(request, options) {
    return generateAndStoreChinaCultureStory(request, options);
  },
  validateStoryContent: validateChinaCultureStoryContent,
  planKnowledgeWriteback: planChinaCultureKnowledgeWriteback,
  mapGearsConstraints({ story, segment }) {
    return [...new Set([
      ...story.cultural_constraints,
      ...segment.cultural_constraints,
    ].map(item => item.trim()).filter(Boolean))];
  },
};
