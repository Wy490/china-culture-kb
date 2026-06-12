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

export type CredibilityLevel = '可靠' | '基本可靠' | '待核实' | '存疑';

export type SourceType = 'bilibili' | 'article' | 'book' | 'oral';

export type KnowledgeDomain =
  | 'core_china_culture'
  | 'era_setting'
  | 'regional_culture'
  | 'folklore_zhiyi'
  | 'gears_asset';

export type KnowledgeEntryRole =
  | 'core_entry'
  | 'setting_pack'
  | 'motif_pack'
  | 'asset_pack'
  | 'regional_pack';

export type KnowledgeAssetUsage =
  | 'character_clothing'
  | 'character_props'
  | 'scene_space'
  | 'scene_props'
  | 'story_motif'
  | 'dialogue_tone'
  | 'credibility_boundary'
  | 'gears_delivery';

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
}

export interface GenerateScriptResult {
  filePath: string;
  title: string;
  scriptType: ScriptType;
  entriesUsed: string[];
  sceneCount: number;
  targetDuration: string;
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
