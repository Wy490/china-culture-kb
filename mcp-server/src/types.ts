export type EntryType =
  | '神话传说'
  | '民间故事'
  | '非遗'
  | '节庆习俗'
  | '地方戏曲'
  | '饮食文化'
  | '传统工艺'
  | '历史人物'
  | '地方掌故'
  | '名胜古迹'
  | '宗教信仰'
  | '民俗活动';

export type CredibilityLevel = '可靠' | '基本可靠' | '待核实' | '存疑' | '混合';

export type SourceType = 'bilibili' | 'article' | 'book' | 'oral';

export type KnowledgeDomain =
  | 'core_china_culture'
  | 'era_setting'
  | 'regional_culture'
  | 'folklore_zhiyi'
  | 'gears_asset'
  | 'narrative_pattern'
  | 'character_archetype'
  | 'conflict_pattern'
  | 'visual_style_pack'
  | 'safety_rule'
  | 'source_pack';

export type KnowledgeEntryRole =
  | 'core_entry'
  | 'setting_pack'
  | 'motif_pack'
  | 'asset_pack'
  | 'regional_pack'
  | 'pattern_pack'
  | 'archetype_pack'
  | 'conflict_pack'
  | 'style_pack'
  | 'rule_pack'
  | 'source_pack';

export type KnowledgeAssetUsage =
  | 'character_clothing'
  | 'character_props'
  | 'scene_space'
  | 'scene_props'
  | 'story_motif'
  | 'dialogue_tone'
  | 'credibility_boundary'
  | 'gears_delivery'
  | 'plot_structure'
  | 'character_arc'
  | 'conflict_engine'
  | 'visual_style'
  | 'safety_boundary'
  | 'source_grounding';

export interface KnowledgeAssetSplit {
  characters: string[];
  scenes: string[];
  character_props: string[];
  scene_props: string[];
}

export interface CultureEntry {
  name: string;
  province: string;
  region: string;
  type: EntryType;
  summary: string;
  story: string;
  culturalSignificance: string;
  relatedLocations: Array<{ name: string; description: string }>;
  keywords: string[];
  sources: string[];
  credibility: CredibilityLevel;
  verificationMethod?: string;
  unverifiedPoints: string[];
  knowledge_domain?: KnowledgeDomain;
  entry_role?: KnowledgeEntryRole;
  era?: string;
  asset_usage?: KnowledgeAssetUsage[];
  asset_split?: KnowledgeAssetSplit;
}

export interface VideoSource {
  bvId: string;
  url: string;
  title: string;
  upOwner: string;
  publishDate: string;
  topic: string;
  status: string;
}

export interface ArticleSource {
  url: string;
  title: string;
  author: string;
  platform: string;
  publishDate: string;
  content?: string;
}

export interface OralSource {
  narrator: string;
  narratorInfo: string;
  location: string;
  date: string;
  scene: string;
  recorder: string;
  storyName: string;
  storyContent: string;
}

export interface SearchResult {
  name: string;
  province: string;
  region: string;
  type: EntryType;
  summary: string;
  keywords: string[];
  credibility: CredibilityLevel;
  knowledge_domain?: KnowledgeDomain;
  entry_role?: KnowledgeEntryRole;
  era?: string;
  asset_usage?: KnowledgeAssetUsage[];
  asset_split?: KnowledgeAssetSplit;
}

export type LocalRelationType =
  | 'direct_region'
  | 'related_location'
  | 'cultural_influence'
  | 'contemporary_adaptation'
  | 'do_not_write_as'
  | 'same_province'
  | 'keyword_context';

export interface LocalCreativeRelation {
  relation_type: LocalRelationType;
  target: string;
  description: string;
}

export interface LocalizedSupplementItem {
  entry: SearchResult;
  relation_type: LocalRelationType;
  score: number;
  match_reason: string;
  evidence: string[];
}

export interface MatchedEntry extends SearchResult {
  score: number;
  match_reason: string;
  evidence: string[];
  relation_type?: LocalRelationType;
  usable_for_story: boolean;
}

export interface MatchResult {
  entries: SearchResult[];
  matchedEntries: MatchedEntry[];
  provinceHints: string[];
  totalEntriesRead: number;
}

export interface SupplementResult {
  versionDifferences: SearchResult[];
  sameRegionType: SearchResult[];
  relatedNetwork: SearchResult[];
  localizedFocus: LocalizedSupplementItem[];
  supplementStrategy: string[];
}

export interface VerifyResult {
  credibility: CredibilityLevel;
  verificationMethod: string;
  details: string;
  unverifiedPoints: string[];
  internalEvidenceCount: number;
}

export type ScriptType = '纪录片' | '短剧' | '动画' | '文化解说';

export type VideoType =
  | 'character_story'
  | 'historical_drama'
  | 'legend_story'
  | 'culture_promo'
  | 'heritage_promo'
  | 'city_brand_promo'
  | 'scene_short'
  | 'landscape_mood'
  | 'documentary_short'
  | 'explainer_video'
  | 'lecture_video'
  | 'education_training'
  | 'children_story'
  | 'social_short'
  | 'ai_comic_drama';

export type PresentationStyle =
  | 'cinematic'
  | 'documentary'
  | 'host_narration'
  | 'voiceover_montage'
  | 'vertical_drama'
  | 'ai_comic'
  | 'animation_2d'
  | 'ink_style'
  | 'children_animation'
  | 'museum_exhibit'
  | 'social_media_fastcut';

export type StoryStructureType =
  | 'single_event_drama'
  | 'three_act_drama'
  | 'case_reconstruction'
  | 'memory_mosaic_biography'
  | 'object_clue_journey'
  | 'craft_process'
  | 'spatial_walkthrough'
  | 'problem_solution_explainer';

export type CreationUseCase =
  | 'original_ai_comic'
  | 'adapted_ai_comic'
  | 'institutional_promo'
  | 'documentary_short'
  | 'brand_commercial'
  | 'education_training'
  | 'public_service';

export type TruthMode =
  | 'fictional_original'
  | 'inspired_by_material'
  | 'source_adaptation'
  | 'factual_reconstruction'
  | 'institutional_verified';

export type MaterialSufficiencyStage =
  | 'minimum_viable_story'
  | 'script_ready'
  | 'production_ready';

export type MaterialBlockingLevel = 'blocking' | 'risk' | 'optional';
export type MaterialTokenRisk = 'low' | 'medium' | 'high';
export type MaterialSufficiencyStageStatus = 'ready' | 'needs_input' | 'blocked';
export type MaterialGenerationPosture =
  | 'ready'
  | 'draft_needs_verification'
  | 'script_ready_production_pending'
  | 'blocked_until_input';

export interface MaterialSufficiencyMissingItem {
  item_id: string;
  label: string;
  reason: string;
  blocking_level: MaterialBlockingLevel;
  affects: string[];
  recommended_question: string;
}

export interface MaterialSufficiencyStageReport {
  stage: MaterialSufficiencyStage;
  status: MaterialSufficiencyStageStatus;
  score: number;
  can_proceed: boolean;
  required_items: string[];
  available_outputs: string[];
  missing_items: MaterialSufficiencyMissingItem[];
  optional_items: MaterialSufficiencyMissingItem[];
  notes: string[];
}

export interface MaterialSufficiencyReport {
  schema_version: 'material-sufficiency/v1';
  stage: MaterialSufficiencyStage;
  active_stage?: MaterialSufficiencyStage;
  score: number;
  can_generate: boolean;
  can_generate_with_risks: boolean;
  blocked: boolean;
  needs_verification?: boolean;
  generation_posture?: MaterialGenerationPosture;
  next_stage?: MaterialSufficiencyStage;
  downgrade_reason?: string;
  stage_reports?: MaterialSufficiencyStageReport[];
  missing_items: MaterialSufficiencyMissingItem[];
  optional_items: MaterialSufficiencyMissingItem[];
  token_risk: MaterialTokenRisk;
  recommended_next_questions: string[];
}

export interface CreationContract {
  schema_version: 'creation-contract/v1';
  creation_use_case: CreationUseCase;
  truth_mode: TruthMode;
  client_type?: string;
  target_audience?: string;
  communication_goal?: string;
  video_type: VideoType;
  presentation_style: PresentationStyle;
  story_structure: StoryStructureType;
  narrative_pattern_ids: string[];
  allowed_fiction: string[];
  must_verify: string[];
  forbidden_moves: string[];
  required_disclaimers: string[];
  material_sufficiency: MaterialSufficiencyReport;
  delivery_expectation: string[];
}

export interface FullEntryDetail extends SearchResult {
  story: string;
  culturalSignificance: string;
  sources: string[];
  relatedLocations: Array<{ name: string; description: string }>;
  localCreativeRelations: LocalCreativeRelation[];
  unverifiedPoints: string[];
  verificationMethod?: string;
}

export interface StoryMaterial {
  storyCore: string;
  mainCharacter: string;
  conflict: string;
  turningPoint: string;
  ending: string;
  culturalElements: string[];
  mustNotMiswrite: string[];
  credibilityBoundary: {
    historicalFact: string[];
    legend: string[];
    fictionable: string[];
  };
  sourceEntries: string[];
}

export interface GenerateStoryResult {
  filePath: string;
  title: string;
  scriptType: ScriptType;
  entryNames: string[];
  storyText: string;
  creation_contract?: CreationContract;
  material_sufficiency?: MaterialSufficiencyReport;
}

export interface GenerateScriptResult {
  filePath: string;
  title: string;
  scriptType: ScriptType;
  entriesUsed: string[];
  sceneCount: number;
  targetDuration: string;
  creation_contract?: CreationContract;
  material_sufficiency?: MaterialSufficiencyReport;
}

export interface QueryIndexResult {
  queryType: 'by_type' | 'by_keyword' | 'by_region';
  filter: string;
  entries: SearchResult[];
  count: number;
  provincesInvolved: string[];
}

export interface AddRegionEntryResult {
  province: string;
  regionPrefix: string | null;
  entryName: string;
  grouped: boolean;
  filePath: string;
}

export interface IngestVideoResult {
  sourceFile: string;
  entryFile: string;
  videoInfo: VideoSource;
  entryInfo: {
    name: string;
    province: string;
    regionPrefix: string | null;
    grouped: boolean;
  };
}

export interface CollectResult {
  sourceFile: string;
  entryFile: string;
  entryInfo: {
    name: string;
    province: string;
    regionPrefix: string | null;
    grouped: boolean;
  };
}
