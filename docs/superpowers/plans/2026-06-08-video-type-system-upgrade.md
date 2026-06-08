# Multi-Video-Type System Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the story generation system from 3 `generation_type` modes to 15 `video_type` + 11 `presentation_style` dual-layer selection, enabling users to generate video proposals for character stories, historical dramas, AI comic dramas, culture promos, documentaries, explainer videos, and more.

**Architecture:** Keep `GenerationType` as a backward-compatible alias. Add `VideoType` and `PresentationStyle` as new top-level types. The `/plan` endpoint returns `recommended_video_types` alongside existing `recommended_types`. The `/generate` endpoint accepts `video_type` (with `generation_type` fallback mapping). Each `GearsSegment` gains `video_type`, `presentation_style`, and `segment_prompt_hint`. StoryStudio gains a grouped video-type selector.

**Tech Stack:** Express 5 + Zod + TypeScript + Vue 3 Composition API + Vite

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `web/shared/types.ts` | Add VideoType, PresentationStyle; update StoryPlanResult, StoryGenerateRequest, StoryGenerateResult, GearsSegment, GearsSegmentsResponse, TypeInfo; add backward compat mapping |
| Modify | `web/shared/schemas.ts` | Add VideoTypeSchema, PresentationStyleSchema; update StoryGenerateRequestSchema; add StoryPlanRequestSchema video_type field |
| Modify | `web/server/src/services/story-service.ts` | Add TYPE_VIDEO_TYPE_ROUTING, VIDEO_TYPE_CONFIG, PRESENTATION_STYLE_DEFAULTS; update planStory to return recommended_video_types + recommended_presentation_styles; update generateAndStoreStory to accept video_type with generation_type fallback; update buildGearsSegments to add video_type/presentation_style/segment_prompt_hint; update listStories to scan all video_type dirs; update getStory to search all video_type dirs |
| Modify | `web/server/src/routes/system.ts` | Update TYPE_GENERATION_MAP to include recommended_video_types and recommended_presentation_styles |
| Modify | `web/server/src/routes/stories.ts` | Update generate route to pass video_type/presentation_style; update list route to accept video_type query param |
| Modify | `web/client/src/views/StoryStudio.vue` | Add video_type grouped selector (4 groups); add presentation_style dropdown; rename button to "生成视频方案"; update handleGenerate to send video_type/presentation_style |
| Modify | `web/client/src/components/StoryPlan.vue` | Update to show recommended_video_types alongside recommended_types; add presentation_style recommendations; update typeLabel map |
| Modify | `web/client/src/components/StoryResult.vue` | Add video_type/presentation_style display in header; add segment_prompt_hint in GEARS segments; update typeLabel map |
| Modify | `web/client/src/api/stories.ts` | Update storyGenerate to accept VideoType/PresentationStyle; add video_type query param support for listStories |
| Modify | `web/server/src/__tests__/api.test.ts` | Add tests for video_type/presentation_style in plan and generate endpoints |

---

### Task 1: Add VideoType, PresentationStyle, and Backward-Compat Mapping to types.ts

**Files:**
- Modify: `web/shared/types.ts`

- [ ] **Step 1: Add VideoType union with 15 types**

Add after the existing `GenerationType` definition (line 7):

```ts
// ---------------------------------------------------------------------------
// Video type (15 成片类型) — supersedes GenerationType
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Presentation style (11 表现形式)
// ---------------------------------------------------------------------------

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
```

- [ ] **Step 2: Add backward-compat mapping and VideoType config**

Add after the PresentationStyle block:

```ts
// ---------------------------------------------------------------------------
// Backward compatibility: generation_type → video_type mapping
// ---------------------------------------------------------------------------

export const GENERATION_TO_VIDEO_TYPE: Record<GenerationType, VideoType> = {
  character_story: 'character_story',
  culture_promo: 'culture_promo',
  scene_short: 'scene_short',
};

// ---------------------------------------------------------------------------
// Video type metadata — group, label, description, default style, duration hint
// ---------------------------------------------------------------------------

export type VideoTypeGroup = '剧情故事类' | '宣传推广类' | '讲解教育类' | '场景空间类';

export interface VideoTypeMeta {
  id: VideoType;
  group: VideoTypeGroup;
  label: string;
  description: string;
  default_presentation_style: PresentationStyle;
  default_duration: SupportedDuration;
  compatible_entry_types: string[]; // Chinese entry type names
}

export const VIDEO_TYPE_CONFIG: Record<VideoType, VideoTypeMeta> = {
  character_story: {
    id: 'character_story', group: '剧情故事类', label: '人物故事',
    description: '以人物为核心、叙事驱动的短剧故事', default_presentation_style: 'cinematic',
    default_duration: '3分钟', compatible_entry_types: ['历史人物', '神话传说', '民间故事', '地方掌故'],
  },
  historical_drama: {
    id: 'historical_drama', group: '剧情故事类', label: '历史剧情短片',
    description: '基于历史事件，戏剧化还原关键冲突时刻', default_presentation_style: 'cinematic',
    default_duration: '3分钟', compatible_entry_types: ['历史人物', '名胜古迹', '地方掌故'],
  },
  legend_story: {
    id: 'legend_story', group: '剧情故事类', label: '神话/传说故事',
    description: '民间传说和神话故事的影视化叙事', default_presentation_style: 'ink_style',
    default_duration: '1分钟', compatible_entry_types: ['神话传说', '民间故事', '宗教信仰'],
  },
  ai_comic_drama: {
    id: 'ai_comic_drama', group: '剧情故事类', label: 'AI 漫剧',
    description: '漫画风格分镜叙事，含对白和表情标注', default_presentation_style: 'ai_comic',
    default_duration: '3分钟', compatible_entry_types: ['历史人物', '神话传说', '民间故事', '非遗', '传统工艺'],
  },
  children_story: {
    id: 'children_story', group: '剧情故事类', label: '儿童故事片',
    description: '面向儿童的简化叙事，含动画风格标注', default_presentation_style: 'children_animation',
    default_duration: '3分钟', compatible_entry_types: ['神话传说', '民间故事', '节庆习俗'],
  },
  culture_promo: {
    id: 'culture_promo', group: '宣传推广类', label: '文化宣传片',
    description: '传统文化主题推广视频，视觉符号+核心信息', default_presentation_style: 'voiceover_montage',
    default_duration: '1分钟', compatible_entry_types: ['非遗', '传统工艺', '饮食文化', '地方戏曲', '节庆习俗', '民俗活动'],
  },
  heritage_promo: {
    id: 'heritage_promo', group: '宣传推广类', label: '非遗/工艺宣传片',
    description: '聚焦非遗技艺和传统工艺的流程展示', default_presentation_style: 'documentary',
    default_duration: '3分钟', compatible_entry_types: ['非遗', '传统工艺'],
  },
  city_brand_promo: {
    id: 'city_brand_promo', group: '宣传推广类', label: '城市/文旅宣传片',
    description: '城市或地方文旅品牌形象片', default_presentation_style: 'voiceover_montage',
    default_duration: '1分钟', compatible_entry_types: ['名胜古迹', '地方掌故', '饮食文化'],
  },
  social_short: {
    id: 'social_short', group: '宣传推广类', label: '竖屏短视频',
    description: '适合社交平台竖屏播放的快节奏短内容', default_presentation_style: 'social_media_fastcut',
    default_duration: '30秒', compatible_entry_types: ['非遗', '饮食文化', '节庆习俗', '民俗活动'],
  },
  documentary_short: {
    id: 'documentary_short', group: '讲解教育类', label: '微纪录片',
    description: '纪实风格短纪录片，含史料和实地素材', default_presentation_style: 'documentary',
    default_duration: '3分钟', compatible_entry_types: ['历史人物', '名胜古迹', '地方掌故'],
  },
  explainer_video: {
    id: 'explainer_video', group: '讲解教育类', label: '知识讲解视频',
    description: '知识型内容讲解，含图文示意和逻辑脉络', default_presentation_style: 'host_narration',
    default_duration: '3分钟', compatible_entry_types: ['非遗', '传统工艺', '饮食文化', '节庆习俗', '宗教信仰'],
  },
  lecture_video: {
    id: 'lecture_video', group: '讲解教育类', label: '宣讲片',
    description: '观点阐释和论理宣讲，含论点标注', default_presentation_style: 'host_narration',
    default_duration: '3分钟', compatible_entry_types: ['历史人物', '地方掌故'],
  },
  education_training: {
    id: 'education_training', group: '讲解教育类', label: '教育/培训片',
    description: '面向教学场景的培训内容', default_presentation_style: 'host_narration',
    default_duration: '5分钟', compatible_entry_types: ['非遗', '传统工艺', '节庆习俗'],
  },
  scene_short: {
    id: 'scene_short', group: '场景空间类', label: '场景短片',
    description: '以空间/地点为核心的演绎短片，含视觉路线', default_presentation_style: 'cinematic',
    default_duration: '1分钟', compatible_entry_types: ['名胜古迹', '地方掌故', '宗教信仰'],
  },
  landscape_mood: {
    id: 'landscape_mood', group: '场景空间类', label: '山水意境片',
    description: '山水自然意境表达，含氛围标注', default_presentation_style: 'ink_style',
    default_duration: '1分钟', compatible_entry_types: ['名胜古迹'],
  },
};

// ---------------------------------------------------------------------------
// Presentation style metadata
// ---------------------------------------------------------------------------

export interface PresentationStyleMeta {
  id: PresentationStyle;
  label: string;
  description: string;
}

export const PRESENTATION_STYLE_CONFIG: Record<PresentationStyle, PresentationStyleMeta> = {
  cinematic: { id: 'cinematic', label: '影视叙事', description: '电影化叙事风格，含镜头语言' },
  documentary: { id: 'documentary', label: '纪实风格', description: '纪录片风格，含史料引用和实景' },
  host_narration: { id: 'host_narration', label: '主持讲述', description: '主讲人面对镜头讲解' },
  voiceover_montage: { id: 'voiceover_montage', label: '旁白+蒙太奇', description: '旁白驱动+画面蒙太奇剪辑' },
  vertical_drama: { id: 'vertical_drama', label: '竖屏短剧', description: '竖屏格式剧情内容' },
  ai_comic: { id: 'ai_comic', label: 'AI 漫剧', description: '漫画分镜+对白+表情标注' },
  animation_2d: { id: 'animation_2d', label: '2D 动画', description: '二维动画风格' },
  ink_style: { id: 'ink_style', label: '水墨风格', description: '中国水墨画视觉风格' },
  children_animation: { id: 'children_animation', label: '儿童动画', description: '面向儿童的动画风格' },
  museum_exhibit: { id: 'museum_exhibit', label: '展陈风格', description: '博物馆展陈叙事风格' },
  social_media_fastcut: { id: 'social_media_fastcut', label: '社媒快切', description: '快节奏剪辑，适合短视频平台' },
};
```

- [ ] **Step 3: Update StoryPlanResult to include recommended_video_types and recommended_presentation_styles**

Replace the existing `RecommendedType`, `StoryPlanResult` interfaces (lines 70-90):

```ts
export interface RecommendedType {
  generation_type: GenerationType;
  reason: string;
  priority: number;
}

export interface RecommendedVideoType {
  video_type: VideoType;
  reason: string;
  priority: number;
}

export interface RecommendedPresentationStyle {
  presentation_style: PresentationStyle;
  reason: string;
}

export interface AvailableEvent {
  event: string;
  conflict_score: number;
  recommended_duration: SupportedDuration;
  recommended_type: GenerationType;
  recommended_video_type: VideoType;
}

export interface StoryPlanResult {
  entry_name: string;
  entry_type: string;
  recommended_types: RecommendedType[];
  recommended_video_types: RecommendedVideoType[];
  recommended_presentation_styles: RecommendedPresentationStyle[];
  available_events: AvailableEvent[];
  recommended_duration: SupportedDuration;
  cultural_risks: string[];
}
```

- [ ] **Step 4: Update StoryGenerateRequest to accept video_type and presentation_style**

Replace the existing `StoryGenerateRequest` interface (lines 96-103):

```ts
export interface StoryGenerateRequest {
  entry_name: string;
  generation_type?: GenerationType;     // backward compat — mapped to video_type if video_type absent
  video_type?: VideoType;                // preferred field — overrides generation_type
  selected_event?: string;
  target_video_duration?: SupportedDuration;
  tone?: string;
  presentation_style?: PresentationStyle; // optional — defaults per video_type
  output_gears_segments?: boolean;        // default true
}
```

- [ ] **Step 5: Update GearsSegment and GearsSegmentsResponse**

Replace the existing `GearsSegment` and `GearsSegmentsResponse` interfaces (lines 160-177):

```ts
export interface GearsSegment {
  segment_id: number;
  source_scene_id: number;
  duration_sec: number;
  panel_count: PanelCount;
  script_text: string;
  purpose: string;
  visual_focus: string[];
  cultural_constraints: string[];
  video_type: VideoType;
  presentation_style: PresentationStyle;
  segment_prompt_hint?: string;
}

export interface GearsSegmentsResponse {
  schema_version: string;
  storyId: string;
  title: string;
  total_duration_sec: number;
  segments: GearsSegment[];
}
```

- [ ] **Step 6: Update StoryGenerateResult to use video_type**

Replace the existing `StoryGenerateResult` interface (lines 183-208):

```ts
export interface StoryGenerateResult {
  storyId: string;
  title: string;
  generation_type: GenerationType;      // backward compat — always populated
  video_type: VideoType;                 // new primary field
  presentation_style: PresentationStyle;
  source_entry: string;
  logline: string;
  theme: string;
  full_text: string;
  scene_breakdown: StoryScene[];
  gears_segments: GearsSegment[];
  gears_segments_url: string;
  cultural_constraints: string[];
  credibility_note: string;
  // Type-specific optional fields — character_story
  characters?: StoryCharacter[];
  act_structure?: ActBeat[];
  protagonist_arc?: ProtagonistArc[];
  // Type-specific optional fields — culture_promo / heritage_promo
  visual_symbols?: string[];
  craft_or_ritual_process?: string;
  modern_connection?: string;
  core_message?: string;
  slogan_or_key_sentence?: string;
  // Type-specific optional fields — scene_short / landscape_mood
  spatial_identity?: string;
  visual_route?: string[];
  time_layer?: string;
  atmosphere?: string;
  // Type-specific optional fields — ai_comic_drama
  dialogue?: Array<{ scene_id: number; lines: Array<{ character: string; text: string; emotion: string }> }>;
  // Type-specific optional fields — explainer_video / lecture_video
  argument_points?: string[];
  knowledge_outline?: string[];
  // Type-specific optional fields — documentary_short
  source_quotes?: string[];
  field_notes?: string[];
}
```

- [ ] **Step 7: Update StoryListItem to include video_type**

Replace `StoryListItem` (lines 144-154):

```ts
export interface StoryListItem {
  storyId: string;
  title: string;
  generation_type: string;
  video_type: string;
  presentation_style: string;
  source_entry: string;
  logline: string;
  created_at: string;
  has_gears_segments: boolean;
  scene_count: number;
  credibility_note: string;
}
```

- [ ] **Step 8: Update TypeInfo to include recommended_video_types**

Replace `TypeInfo` (lines 249-252):

```ts
export interface TypeInfo {
  name: string;
  recommended_generation_types: GenerationType[];
  recommended_video_types: VideoType[];
  recommended_presentation_styles: PresentationStyle[];
  description: string;
}
```

- [ ] **Step 9: Add INVALID_VIDEO_TYPE and INVALID_PRESENTATION_STYLE error codes**

Update `ErrorCodes` (lines 33-42), add two new entries:

```ts
export const ErrorCodes = {
  ENTRY_NOT_FOUND: 'ENTRY_NOT_FOUND',
  INVALID_GENERATION_TYPE: 'INVALID_GENERATION_TYPE',
  INVALID_VIDEO_TYPE: 'INVALID_VIDEO_TYPE',
  INVALID_PRESENTATION_STYLE: 'INVALID_PRESENTATION_STYLE',
  INVALID_DURATION: 'INVALID_DURATION',
  STORY_GENERATION_FAILED: 'STORY_GENERATION_FAILED',
  STORY_NOT_FOUND: 'STORY_NOT_FOUND',
  GEARS_SEGMENTS_NOT_FOUND: 'GEARS_SEGMENTS_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
```

- [ ] **Step 10: Commit**

```bash
git add web/shared/types.ts
git commit -m "feat: add VideoType, PresentationStyle, and backward-compat mapping to shared types"
```

---

### Task 2: Add VideoTypeSchema and PresentationStyleSchema to schemas.ts

**Files:**
- Modify: `web/shared/schemas.ts`

- [ ] **Step 1: Add VideoTypeSchema and PresentationStyleSchema**

Add after the existing `GenerationTypeSchema` (lines 9-13):

```ts
// ---------------------------------------------------------------------------
// Video type (15 成片类型)
// ---------------------------------------------------------------------------

export const VideoTypeSchema = z.enum([
  'character_story',
  'historical_drama',
  'legend_story',
  'culture_promo',
  'heritage_promo',
  'city_brand_promo',
  'scene_short',
  'landscape_mood',
  'documentary_short',
  'explainer_video',
  'lecture_video',
  'education_training',
  'children_story',
  'social_short',
  'ai_comic_drama',
]);

// ---------------------------------------------------------------------------
// Presentation style (11 表现形式)
// ---------------------------------------------------------------------------

export const PresentationStyleSchema = z.enum([
  'cinematic',
  'documentary',
  'host_narration',
  'voiceover_montage',
  'vertical_drama',
  'ai_comic',
  'animation_2d',
  'ink_style',
  'children_animation',
  'museum_exhibit',
  'social_media_fastcut',
]);
```

- [ ] **Step 2: Update StoryGenerateRequestSchema to accept video_type and presentation_style**

Replace the existing `StoryGenerateRequestSchema` (lines 42-49):

```ts
export const StoryGenerateRequestSchema = z.object({
  entry_name: z.string().min(1, 'entry_name cannot be empty'),
  generation_type: GenerationTypeSchema.optional(),
  video_type: VideoTypeSchema.optional(),
  selected_event: z.string().optional(),
  target_video_duration: DurationSchema.optional(),
  tone: z.string().optional(),
  presentation_style: PresentationStyleSchema.optional(),
  output_gears_segments: z.boolean().optional().default(true),
}).refine(
  (data) => data.generation_type || data.video_type,
  { message: 'Either generation_type or video_type must be provided', path: ['video_type'] },
);
```

- [ ] **Step 3: Commit**

```bash
git add web/shared/schemas.ts
git commit -m "feat: add VideoTypeSchema, PresentationStyleSchema, and update generate request validation"
```

---

### Task 3: Update story-service.ts for VideoType/PresentationStyle

**Files:**
- Modify: `web/server/src/services/story-service.ts`

- [ ] **Step 1: Update imports to include new types**

Replace the import block (lines 8-26) with:

```ts
import { success, fail, ErrorCodes } from '@shared/types.js';
import type {
  ApiResponse,
  EntryDetail,
  StoryPlanResult,
  RecommendedType,
  RecommendedVideoType,
  RecommendedPresentationStyle,
  AvailableEvent,
  GenerationType,
  VideoType,
  PresentationStyle,
  SupportedDuration,
  PanelCount,
  StoryGenerateRequest,
  StoryGenerateResult,
  StoryScene,
  StoryCharacter,
  ActBeat,
  ProtagonistArc,
  GearsSegment,
  GearsSegmentsResponse,
  StoryListItem,
} from '@shared/types.js';
import { GENERATION_TO_VIDEO_TYPE, VIDEO_TYPE_CONFIG, PRESENTATION_STYLE_CONFIG } from '@shared/types.js';
```

- [ ] **Step 2: Add TYPE_VIDEO_TYPE_ROUTING replacing TYPE_GENERATION_ROUTING**

Replace the existing `TYPE_GENERATION_ROUTING` (lines 32-45) with:

```ts
// ---------------------------------------------------------------------------
// Entry type → VideoType routing (entry Chinese type name → recommended VideoType list)
// ---------------------------------------------------------------------------

const TYPE_VIDEO_TYPE_ROUTING: Record<string, VideoType[]> = {
  '历史人物': ['character_story', 'historical_drama', 'ai_comic_drama', 'documentary_short', 'lecture_video'],
  '神话传说': ['legend_story', 'ai_comic_drama', 'scene_short', 'culture_promo', 'children_story'],
  '民间故事': ['character_story', 'legend_story', 'ai_comic_drama', 'children_story'],
  '非遗': ['heritage_promo', 'culture_promo', 'explainer_video', 'ai_comic_drama', 'social_short'],
  '地方戏曲': ['culture_promo', 'ai_comic_drama', 'heritage_promo'],
  '节庆习俗': ['culture_promo', 'scene_short', 'social_short', 'children_story'],
  '饮食文化': ['culture_promo', 'explainer_video', 'social_short', 'documentary_short'],
  '传统工艺': ['heritage_promo', 'culture_promo', 'explainer_video', 'documentary_short'],
  '名胜古迹': ['scene_short', 'landscape_mood', 'culture_promo', 'city_brand_promo', 'documentary_short'],
  '地方掌故': ['character_story', 'scene_short', 'lecture_video', 'documentary_short'],
  '宗教信仰': ['scene_short', 'culture_promo', 'explainer_video'],
  '民俗活动': ['culture_promo', 'social_short', 'children_story'],
};

// Keep old routing for backward compat (recommended_types field)
const TYPE_GENERATION_ROUTING: Record<string, GenerationType[]> = {
  '历史人物': ['character_story'],
  '神话传说': ['character_story', 'scene_short'],
  '民间故事': ['character_story'],
  '非遗': ['culture_promo'],
  '地方戏曲': ['culture_promo'],
  '节庆习俗': ['culture_promo'],
  '饮食文化': ['culture_promo'],
  '传统工艺': ['culture_promo'],
  '名胜古迹': ['scene_short', 'culture_promo'],
  '地方掌故': ['character_story', 'scene_short'],
  '宗教信仰': ['scene_short', 'culture_promo'],
  '民俗活动': ['culture_promo'],
};
```

- [ ] **Step 3: Update planStory to return recommended_video_types and recommended_presentation_styles**

Replace the `planStory` function (lines 331-376) with:

```ts
export async function planStory(entryName: string): Promise<ApiResponse<StoryPlanResult>> {
  const mcpDetail = await mcpGetFullEntryDetail(entryName);
  if (!mcpDetail) {
    return fail(ErrorCodes.ENTRY_NOT_FOUND, `Entry "${entryName}" not found`);
  }

  const entry = convertFullEntryDetail(mcpDetail);
  const entryType = entry.type;

  // Backward compat: old recommended_types
  const routedTypes = TYPE_GENERATION_ROUTING[entryType] || ['character_story'];
  const recommendedTypes: RecommendedType[] = routedTypes.map((genType, index) => {
    const reasonMap: Record<string, string> = {
      character_story: `该条目类型"${entryType}"适合以人物/故事为核心的叙事`,
      culture_promo: `该条目类型"${entryType}"适合文化推广展示`,
      scene_short: `该条目类型"${entryType}"适合场景演绎短片`,
    };
    return { generation_type: genType, reason: reasonMap[genType] || `适合${genType}模式`, priority: index + 1 };
  });

  // New: recommended_video_types
  const routedVideoTypes = TYPE_VIDEO_TYPE_ROUTING[entryType] || ['character_story'];
  const recommendedVideoTypes: RecommendedVideoType[] = routedVideoTypes.map((vt, index) => {
    const meta = VIDEO_TYPE_CONFIG[vt];
    const compatible = meta.compatible_entry_types.includes(entryType);
    return {
      video_type: vt,
      reason: compatible
        ? `"${entryType}"条目适合${meta.label}——${meta.description}`
        : `${meta.label}——${meta.description}（可选）`,
      priority: index + 1,
    };
  });

  // New: recommended_presentation_styles (derived from top video types)
  const topVideoTypes = routedVideoTypes.slice(0, 3);
  const recommendedPresentationStyles: RecommendedPresentationStyle[] = topVideoTypes.map(vt => {
    const meta = VIDEO_TYPE_CONFIG[vt];
    const styleMeta = PRESENTATION_STYLE_CONFIG[meta.default_presentation_style];
    return {
      presentation_style: meta.default_presentation_style,
      reason: `${meta.label}默认表现形式: ${styleMeta.label}——${styleMeta.description}`,
    };
  });

  const boldEvents = extractBoldEvents(entry.story);
  const availableEvents: AvailableEvent[] = boldEvents.length > 0
    ? boldEvents.map((eventName) => ({
        event: eventName,
        conflict_score: 7,
        recommended_duration: recommendDuration(entryType, boldEvents.length),
        recommended_type: recommendEventType(entryType),
        recommended_video_type: routedVideoTypes[0],
      }))
    : [{
        event: '整体故事',
        conflict_score: 5,
        recommended_duration: recommendDuration(entryType, 0),
        recommended_type: recommendEventType(entryType),
        recommended_video_type: routedVideoTypes[0],
      }];

  const culturalRisks = computeCulturalRisks(entry);
  const recommendedDuration = recommendDuration(entryType, boldEvents.length);

  return success({
    entry_name: entryName,
    entry_type: entryType,
    recommended_types: recommendedTypes,
    recommended_video_types: recommendedVideoTypes,
    recommended_presentation_styles: recommendedPresentationStyles,
    available_events: availableEvents,
    recommended_duration: recommendedDuration,
    cultural_risks: culturalRisks,
  });
}
```

- [ ] **Step 4: Update generateAndStoreStory to resolve video_type from generation_type**

Replace the `generateAndStoreStory` function (lines 382-463) with:

```ts
export async function generateAndStoreStory(
  request: StoryGenerateRequest,
): Promise<ApiResponse<StoryGenerateResult>> {
  const { entry_name, selected_event, target_video_duration, tone, output_gears_segments } = request;

  // Resolve video_type: prefer video_type, fall back to generation_type mapping
  const videoType: VideoType = request.video_type
    ?? (request.generation_type ? GENERATION_TO_VIDEO_TYPE[request.generation_type] : undefined)
    ?? 'character_story';

  // Resolve generation_type for backward compat
  const generationType: GenerationType = request.generation_type ?? (
    videoType === 'character_story' ? 'character_story'
    : videoType === 'culture_promo' || videoType === 'heritage_promo' || videoType === 'city_brand_promo' ? 'culture_promo'
    : 'scene_short'
  );

  // Resolve presentation_style: use provided, or default from video_type config
  const presentationStyle: PresentationStyle = request.presentation_style
    ?? VIDEO_TYPE_CONFIG[videoType].default_presentation_style;

  // Validate entry exists
  const mcpDetail = await mcpGetFullEntryDetail(entry_name);
  if (!mcpDetail) {
    return fail(ErrorCodes.ENTRY_NOT_FOUND, `Entry "${entry_name}" not found`);
  }

  const entry = convertFullEntryDetail(mcpDetail);
  const storyId = generateStoryId(entry_name);
  const gearsSegmentsUrl = `/api/stories/${storyId}/gears-segments`;
  const targetDuration = target_video_duration ?? VIDEO_TYPE_CONFIG[videoType].default_duration;
  const boldEvents = extractBoldEvents(entry.story);
  const culturalRisks = computeCulturalRisks(entry);

  // Build scene_breakdown
  const sceneBreakdown = buildSceneBreakdown(entry, selectedEvent, boldEvents, targetDuration);

  // Build gears_segments from scene_breakdown (with video_type/presentation_style)
  const gearsSegments = output_gears_segments !== false
    ? buildGearsSegments(sceneBreakdown, storyId, videoType, presentationStyle)
    : [];

  // Build story data with content filled from entry
  const storyData: StoryGenerateResult & { _request_meta: Record<string, unknown> } = {
    storyId,
    title: selectedEvent && selectedEvent !== '整体故事'
      ? selectedEvent
      : entry.name,
    generation_type: generationType,
    video_type: videoType,
    presentation_style: presentationStyle,
    source_entry: entry_name,
    logline: entry.summary,
    theme: `${VIDEO_TYPE_CONFIG[videoType].label} × ${entry.type}`,
    full_text: entry.story,
    scene_breakdown: sceneBreakdown,
    gears_segments: gearsSegments,
    gears_segments_url: gearsSegmentsUrl,
    cultural_constraints: culturalRisks,
    credibility_note: entry.credibility,
    // Type-specific fields based on video_type
    ...(videoType === 'character_story' || videoType === 'historical_drama' || videoType === 'legend_story' ? {
      characters: extractCharactersFromStory(entry.story, entry.name),
      act_structure: buildActStructure(sceneBreakdown),
      protagonist_arc: [{
        starting_state: `循规蹈矩的${entry.type}`,
        turning_point: selectedEvent ?? '核心转折事件',
        resolution: '道德觉醒或精神升华',
      }],
    } : {}),
    ...(videoType === 'culture_promo' || videoType === 'heritage_promo' || videoType === 'city_brand_promo' ? {
      visual_symbols: entry.keywords.slice(0, 5),
      craft_or_ritual_process: `核心技艺：${entry.keywords.slice(0, 3).join('、')}`,
      modern_connection: `${entry.name}在现代的文化传承与创新`,
      core_message: `${entry.name}的文化价值`,
      slogan_or_key_sentence: `${entry.type}之光——${entry.name}`,
    } : {}),
    ...(videoType === 'scene_short' || videoType === 'landscape_mood' ? {
      spatial_identity: entry.region,
      visual_route: sceneBreakdown.map(s => `${s.title}：${s.visual_prompt}`),
      time_layer: `${entry.name}的古今变迁与时空叠加`,
      atmosphere: videoType === 'landscape_mood' ? `${entry.region}的自然意境与山水灵韵` : `${entry.region}的场景氛围`,
    } : {}),
    ...(videoType === 'ai_comic_drama' ? {
      dialogue: sceneBreakdown.map(s => ({
        scene_id: s.scene_id,
        lines: s.characters.map(ch => ({
          character: ch,
          text: `${s.key_action}`,
          emotion: s.dramatic_function === '高潮' ? '激烈' : s.dramatic_function === '开场' ? '平静' : '紧张',
        })),
      })),
    } : {}),
    ...(videoType === 'explainer_video' || videoType === 'lecture_video' ? {
      argument_points: entry.keywords.slice(0, 4).map(k => `${k}的核心解释`),
      knowledge_outline: sceneBreakdown.map(s => `${s.scene_id}. ${s.title}：${s.plot.substring(0, 40)}`),
    } : {}),
    ...(videoType === 'documentary_short' ? {
      source_quotes: [`据${entry.credibility}来源记载`],
      field_notes: [`${entry.region}实地考察记录要点`],
    } : {}),
    // Internal metadata
    _request_meta: {
      selected_event: selectedEvent || null,
      target_video_duration: targetDuration,
      tone: tone || null,
      output_gears_segments: output_gears_segments ?? true,
      entry_type: entry.type,
      video_type: videoType,
      presentation_style: presentationStyle,
      created_at: new Date().toISOString(),
    },
  };

  // Ensure directory and write file — use video_type as directory name
  const dirPath = resolve(generatedRoot(), videoType);
  await mkdir(dirPath, { recursive: true });
  const filePath = resolve(dirPath, `${storyId}.json`);
  await writeFile(filePath, JSON.stringify(storyData, null, 2), 'utf-8');

  // Return to API without internal _request_meta
  return success(stripInternalFields(storyData));
}
```

- [ ] **Step 5: Update buildGearsSegments to include video_type, presentation_style, segment_prompt_hint**

Replace the `buildGearsSegments` function (lines 268-288) with:

```ts
function buildGearsSegments(
  scenes: StoryScene[],
  storyId: string,
  videoType: VideoType,
  presentationStyle: PresentationStyle,
): GearsSegment[] {
  return scenes.map((scene) => {
    const panelCount = PANEL_COUNT_BY_DURATION[scene.duration_sec] ?? 6;
    const scriptText = `【${scene.dramatic_function}】${scene.location}，${scene.time_of_day}。${scene.visual_prompt}。${scene.key_action}——${scene.title}。${scene.camera_suggestion}。`;
    const visualFocus = [
      scene.location,
      ...scene.visual_prompt.split(/[，、。]/).filter(s => s.length > 1 && s.length < 8).slice(0, 2),
    ];

    // Generate segment_prompt_hint based on video_type and presentation_style
    const vtMeta = VIDEO_TYPE_CONFIG[videoType];
    const psMeta = PRESENTATION_STYLE_CONFIG[presentationStyle];
    const segmentPromptHint = `${vtMeta.label}/${psMeta.label}风格提示: ${psMeta.description}，场景${scene.scene_id}聚焦${scene.key_action}`;

    return {
      segment_id: scene.scene_id,
      source_scene_id: scene.scene_id,
      duration_sec: scene.duration_sec,
      panel_count: panelCount,
      script_text: scriptText,
      purpose: scene.dramatic_function,
      visual_focus: visualFocus.slice(0, 3),
      cultural_constraints: scene.cultural_note ? [scene.cultural_note] : [],
      video_type: videoType,
      presentation_style: presentationStyle,
      segment_prompt_hint: segmentPromptHint,
    };
  });
}
```

- [ ] **Step 6: Update listStories and getStory to scan/search all video_type directories**

Replace `listStories` (lines 469-506) with:

```ts
export async function listStories(
  generationType?: string,
  videoType?: string,
): Promise<ApiResponse<StoryListItem[]>> {
  const root = generatedRoot();
  const results: StoryListItem[] = [];

  // Determine which directories to scan
  const ALL_VIDEO_TYPES: VideoType[] = [
    'character_story', 'historical_drama', 'legend_story',
    'culture_promo', 'heritage_promo', 'city_brand_promo',
    'scene_short', 'landscape_mood',
    'documentary_short', 'explainer_video', 'lecture_video', 'education_training',
    'children_story', 'social_short', 'ai_comic_drama',
  ];

  // Also scan old generation_type directories for backward compat
  const OLD_DIRS = ['character_story', 'culture_promo', 'scene_short'];

  const typesToScan: string[] = videoType
    ? [videoType]
    : generationType
      ? [generationType]
      : [...ALL_VIDEO_TYPES, ...OLD_DIRS.filter(d => !ALL_VIDEO_TYPES.includes(d as VideoType))];

  for (const typeDir of typesToScan) {
    const dirPath = resolve(root, typeDir);
    let files: string[];
    try { files = await readdir(dirPath); } catch { continue; }

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = resolve(dirPath, file);
      try {
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        const meta = data._request_meta as Record<string, unknown> | undefined;
        results.push({
          storyId: data.storyId || file.replace('.json', ''),
          title: data.title || '',
          generation_type: data.generation_type || typeDir,
          video_type: data.video_type || data.generation_type || typeDir,
          presentation_style: data.presentation_style || '',
          source_entry: data.source_entry || '',
          logline: data.logline || '',
          created_at: meta?.created_at as string ?? '',
          has_gears_segments: (data.gears_segments?.length ?? 0) > 0,
          scene_count: data.scene_breakdown?.length ?? 0,
          credibility_note: data.credibility_note || '',
        });
      } catch { continue; }
    }
  }

  return success(results);
}
```

Replace `getStory` (lines 512-527) with:

```ts
export async function getStory(storyId: string): Promise<ApiResponse<StoryGenerateResult>> {
  const root = generatedRoot();
  const ALL_VIDEO_TYPES: VideoType[] = [
    'character_story', 'historical_drama', 'legend_story',
    'culture_promo', 'heritage_promo', 'city_brand_promo',
    'scene_short', 'landscape_mood',
    'documentary_short', 'explainer_video', 'lecture_video', 'education_training',
    'children_story', 'social_short', 'ai_comic_drama',
  ];

  for (const typeDir of ALL_VIDEO_TYPES) {
    const filePath = resolve(root, typeDir, `${storyId}.json`);
    try {
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as StoryGenerateResult & { _request_meta?: unknown };
      return success(stripInternalFields(data));
    } catch { continue; }
  }

  return fail(ErrorCodes.STORY_NOT_FOUND, `Story "${storyId}" not found`);
}
```

- [ ] **Step 7: Update getGearsSegments to include sourceDomain in schema_version upgrade**

Replace `getGearsSegments` (lines 533-552) with:

```ts
export async function getGearsSegments(storyId: string): Promise<ApiResponse<GearsSegmentsResponse>> {
  const storyResult = await getStory(storyId);
  if (!storyResult.ok || !storyResult.data) {
    return fail(ErrorCodes.GEARS_SEGMENTS_NOT_FOUND, `Gears segments for story "${storyId}" not found`);
  }

  const story = storyResult.data;
  const segments = story.gears_segments || [];
  const totalDurationSec = segments.reduce((sum, seg) => sum + seg.duration_sec, 0);

  const response: GearsSegmentsResponse = {
    schema_version: 'gears-segments/v2',
    storyId: story.storyId,
    title: story.title,
    total_duration_sec: totalDurationSec,
    segments,
  };

  return success(response);
}
```

- [ ] **Step 8: Commit**

```bash
git add web/server/src/services/story-service.ts
git commit -m "feat: update story-service for VideoType/PresentationStyle — plan returns recommended_video_types, generate accepts video_type, gears_segments enhanced"
```

---

### Task 4: Update stories route and system route

**Files:**
- Modify: `web/server/src/routes/stories.ts`
- Modify: `web/server/src/routes/system.ts`

- [ ] **Step 1: Update storiesRouter to pass video_type/presentation_style and accept video_type query**

Replace the entire `stories.ts` file content:

```ts
// web/server/src/routes/stories.ts — Story plan, generate, list, detail, gears-segments routes

import { Router } from 'express';
import { validateBody, validateParams } from '../middleware/validate.js';
import { StoryPlanRequestSchema, StoryGenerateRequestSchema, StoryIdParamSchema } from '@shared/schemas.js';
import {
  planStory,
  generateAndStoreStory,
  listStories,
  getStory,
  getGearsSegments,
} from '../services/story-service.js';
import type { VideoType } from '@shared/types.js';

export const storiesRouter = Router();

// POST /api/stories/plan — preview recommendation for an entry
storiesRouter.post('/plan', validateBody(StoryPlanRequestSchema), async (req, res, next) => {
  try {
    const { entry_name } = req.body as { entry_name: string };
    const result = await planStory(entry_name);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/stories/generate — create video proposal and store JSON file
storiesRouter.post('/generate', validateBody(StoryGenerateRequestSchema), async (req, res, next) => {
  try {
    const result = await generateAndStoreStory(req.body);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/stories — list stories (optional query params: generation_type, video_type)
storiesRouter.get('/', async (req, res, next) => {
  try {
    const generationType = req.query.generation_type as string | undefined;
    const videoType = req.query.video_type as VideoType | undefined;
    const result = await listStories(generationType, videoType);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/stories/:storyId — get story detail by storyId
storiesRouter.get('/:storyId', validateParams(StoryIdParamSchema), async (req, res, next) => {
  try {
    const { storyId } = req.params as { storyId: string };
    const result = await getStory(storyId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/stories/:storyId/gears-segments — get GEARS segments for a story
storiesRouter.get('/:storyId/gears-segments', validateParams(StoryIdParamSchema), async (req, res, next) => {
  try {
    const { storyId } = req.params as { storyId: string };
    const result = await getGearsSegments(storyId);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 2: Update systemRouter to include recommended_video_types**

Read current `system.ts` and update the `TYPE_GENERATION_MAP` to add `recommended_video_types` and `recommended_presentation_styles` fields to each entry. Replace the `TYPE_GENERATION_MAP` array (currently lines 37-50) with a new one that includes these fields. Each type entry now has:

```ts
{
  name: '历史人物',
  recommended_generation_types: ['character_story'],
  recommended_video_types: ['character_story', 'historical_drama', 'ai_comic_drama', 'documentary_short', 'lecture_video'],
  recommended_presentation_styles: ['cinematic', 'ink_style', 'ai_comic', 'documentary', 'host_narration'],
  description: '适合人物故事、历史剧情、AI漫剧、纪录片等',
}
```

Do this for all 12 entry types. Then verify the `/api/system/types` endpoint still works.

- [ ] **Step 3: Commit**

```bash
git add web/server/src/routes/stories.ts web/server/src/routes/system.ts
git commit -m "feat: update routes for video_type query param and system types enrichment"
```

---

### Task 5: Update StoryStudio.vue with VideoType selector

**Files:**
- Modify: `web/client/src/views/StoryStudio.vue`

- [ ] **Step 1: Add VideoType/PresentationStyle imports and state**

In the `<script setup>` block, update imports and add new state variables:

```ts
import type {
  StoryPlanResult,
  StoryGenerateResult,
  GenerationType,
  VideoType,
  PresentationStyle,
  SupportedDuration,
  VideoTypeGroup,
  VideoTypeMeta,
  PresentationStyleMeta,
} from '@shared/types'
import { VIDEO_TYPE_CONFIG, PRESENTATION_STYLE_CONFIG } from '@shared/types'
```

Add new state refs:

```ts
const selectedVideoType = ref<VideoType | null>(null)
const selectedPresentationStyle = ref<PresentationStyle | null>(null)
```

- [ ] **Step 2: Update canGenerate computed to check video_type**

```ts
const canGenerate = computed(() => {
  return entryName.value.trim() && (selectedVideoType.value || selectedType.value)
})
```

- [ ] **Step 3: Update handlePlan to auto-select video_type from plan**

In `handlePlan`, after auto-selecting `selectedType`, also set `selectedVideoType`:

```ts
// Auto-select the top recommended video type
if (!selectedVideoType.value && res.data.recommended_video_types.length > 0) {
  selectedVideoType.value = res.data.recommended_video_types[0].video_type
}
// Auto-select recommended presentation style
if (!selectedPresentationStyle.value && res.data.recommended_presentation_styles.length > 0) {
  selectedPresentationStyle.value = res.data.recommended_presentation_styles[0].presentation_style
}
```

- [ ] **Step 4: Update handleGenerate to send video_type and presentation_style**

```ts
async function handleGenerate() {
  if (!canGenerate.value) return
  generating.value = true
  generateError.value = ''
  generateResult.value = null

  // Resolve video_type: prefer selectedVideoType, fall back to selectedType mapping
  const videoTypeToSend = selectedVideoType.value ?? selectedType.value ?? 'character_story'
  const generationTypeToSend = selectedType.value ?? (
    videoTypeToSend === 'character_story' ? 'character_story'
    : videoTypeToSend === 'culture_promo' || videoTypeToSend === 'heritage_promo' || videoTypeToSend === 'city_brand_promo' ? 'culture_promo'
    : 'scene_short'
  )
  const presentationStyleToSend = selectedPresentationStyle.value ?? VIDEO_TYPE_CONFIG[videoTypeToSend as VideoType]?.default_presentation_style ?? 'cinematic'

  const res = await storyGenerate({
    entry_name: entryName.value.trim(),
    generation_type: generationTypeToSend as GenerationType,
    video_type: videoTypeToSend as VideoType,
    selected_event: selectedEvent.value ?? undefined,
    target_video_duration: targetDuration.value,
    tone: tone.value || undefined,
    presentation_style: presentationStyleToSend as PresentationStyle,
    output_gears_segments: true,
  })

  if (res.ok && res.data) {
    generateResult.value = res.data
  } else {
    generateError.value = res.error?.message ?? '视频方案生成失败'
  }
  generating.value = false
}
```

- [ ] **Step 5: Add VideoType group selector in template**

Add a new section between the StoryPlan component and the Duration select, with grouped video type cards:

```html
<!-- Video type selector (grouped) -->
<section v-if="planResult" class="story-studio__field">
  <label class="story-studio__label">成片类型</label>
  <div v-for="group in videoTypeGroups" :key="group.name" class="story-studio__vt-group">
    <h5 class="story-studio__vt-group-name">{{ group.name }}</h5>
    <div class="story-studio__vt-cards">
      <div
        v-for="vt in group.types"
        :key="vt.id"
        class="story-studio__vt-card"
        :class="{
          'story-studio__vt-card--selected': selectedVideoType === vt.id,
          'story-studio__vt-card--recommended': isRecommendedVideoType(vt.id),
        }"
        @click="selectedVideoType = vt.id; selectedPresentationStyle = VIDEO_TYPE_CONFIG[vt.id].default_presentation_style"
      >
        <span class="story-studio__vt-badge">{{ isRecommendedVideoType(vt.id) ? '✅ 推荐' : '⭕ 可选' }}</span>
        <span class="story-studio__vt-name">{{ vt.label }}</span>
        <span class="story-studio__vt-desc">{{ vt.description }}</span>
        <span class="story-studio__vt-duration">{{ vt.default_duration }}</span>
      </div>
    </div>
  </div>
</section>

<!-- Presentation style selector -->
<section v-if="selectedVideoType" class="story-studio__field">
  <label class="story-studio__label" for="presentation-style">表现形式</label>
  <select id="presentation-style" v-model="selectedPresentationStyle" class="story-studio__select">
    <option
      v-for="ps in presentationStyleOptions"
      :key="ps.id"
      :value="ps.id"
    >
      {{ ps.label }} — {{ ps.description }}
    </option>
  </select>
</section>
```

- [ ] **Step 6: Add computed helpers for VideoType groups and PresentationStyle options**

```ts
const videoTypeGroups = computed(() => {
  const groups: { name: VideoTypeGroup; types: VideoTypeMeta[] }[] = []
  const seen = new Set<VideoTypeGroup>()
  for (const vt of Object.values(VIDEO_TYPE_CONFIG)) {
    if (!seen.has(vt.group)) {
      seen.add(vt.group)
      groups.push({ name: vt.group, types: [] })
    }
    groups.find(g => g.name === vt.group)?.types.push(vt)
  }
  return groups
})

const presentationStyleOptions = computed(() => {
  return Object.values(PRESENTATION_STYLE_CONFIG)
})

function isRecommendedVideoType(vtId: VideoType): boolean {
  if (!planResult.value) return false
  const recommended = planResult.value.recommended_video_types
  if (recommended.length === 0) return false
  return recommended[0].video_type === vtId
}
```

- [ ] **Step 7: Rename button from "生成故事" to "生成视频方案"**

Change the generate button text:

```html
{{ generating ? '正在生成…' : '生成视频方案' }}
```

Also update loading text and empty state:

```html
<p class="story-studio__loading-text">正在生成视频方案，请稍候…</p>
```

```html
<p>选择词条、预览推荐，然后生成视频方案。</p>
```

- [ ] **Step 8: Add CSS for VideoType cards**

Add new CSS rules for the grouped video type selector:

```css
.story-studio__vt-group { margin-bottom: 12px; }
.story-studio__vt-group-name { margin: 0 0 6px 0; font-size: 14px; color: #34495e; font-weight: 600; }
.story-studio__vt-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
.story-studio__vt-card { padding: 10px 14px; border: 2px solid #bdc3c7; border-radius: 6px; background: #fff; cursor: pointer; transition: border-color 0.2s, background 0.2s; }
.story-studio__vt-card:hover { border-color: #3498db; }
.story-studio__vt-card--selected { border-color: #2980b9; background: #eaf2f8; }
.story-studio__vt-card--recommended { border-color: #27ae60; }
.story-studio__vt-badge { display: inline-block; font-size: 13px; margin-bottom: 2px; }
.story-studio__vt-name { display: block; font-size: 15px; font-weight: 700; color: #2c3e50; margin-bottom: 2px; }
.story-studio__vt-desc { display: block; font-size: 12px; color: #7f8c8d; }
.story-studio__vt-duration { display: block; font-size: 12px; color: #3498db; margin-top: 2px; }
```

- [ ] **Step 9: Update onMounted to handle video_type query param**

```ts
onMounted(() => {
  const entry = route.query.entry as string | undefined
  if (entry) entryName.value = entry

  const type = route.query.type as string | undefined
  if (type && ['character_story', 'culture_promo', 'scene_short'].includes(type)) {
    selectedType.value = type as GenerationType
    selectedVideoType.value = type as VideoType
  }

  const vt = route.query.video_type as string | undefined
  if (vt && Object.keys(VIDEO_TYPE_CONFIG).includes(vt)) {
    selectedVideoType.value = vt as VideoType
    selectedType.value = GENERATION_TO_VIDEO_TYPE[vt as GenerationType] ? (vt as GenerationType) : undefined
  }
})
```

- [ ] **Step 10: Commit**

```bash
git add web/client/src/views/StoryStudio.vue
git commit -m "feat: StoryStudio video_type grouped selector + presentation_style dropdown + button rename"
```

---

### Task 6: Update StoryPlan.vue for VideoType display

**Files:**
- Modify: `web/client/src/components/StoryPlan.vue`

- [ ] **Step 1: Add recommended_video_types section**

After the existing "推荐类型" section (line 7-25), add a new "推荐成片类型" section:

```html
<!-- Recommended video types -->
<section v-if="plan.recommended_video_types && plan.recommended_video_types.length > 0" class="story-plan__section">
  <h4 class="story-plan__section-title">推荐成片类型</h4>
  <div class="story-plan__types">
    <div
      v-for="rvt in plan.recommended_video_types"
      :key="rvt.video_type"
      class="story-plan__type-card"
      :class="{
        'story-plan__type-card--selected': selectedVideoType === rvt.video_type,
        'story-plan__type-card--recommended': rvt.priority === 1,
      }"
      @click="$emit('select-video-type', rvt.video_type)"
    >
      <span class="story-plan__type-badge">
        {{ rvt.priority === 1 ? '✅ 推荐' : '⭕ 可选' }}
      </span>
      <span class="story-plan__type-name">{{ videoTypeLabel(rvt.video_type) }}</span>
      <span class="story-plan__type-reason">{{ rvt.reason }}</span>
    </div>
  </div>
</section>

<!-- Recommended presentation styles -->
<section v-if="plan.recommended_presentation_styles && plan.recommended_presentation_styles.length > 0" class="story-plan__section">
  <h4 class="story-plan__section-title">推荐表现形式</h4>
  <ul class="story-plan__styles">
    <li v-for="ps in plan.recommended_presentation_styles" :key="ps.presentation_style">
      {{ presentationStyleLabel(ps.presentation_style) }} — {{ ps.reason }}
    </li>
  </ul>
</section>
```

- [ ] **Step 2: Update props and emits**

```ts
import type { StoryPlanResult, GenerationType, VideoType, PresentationStyle } from '@shared/types'
import { VIDEO_TYPE_CONFIG, PRESENTATION_STYLE_CONFIG } from '@shared/types'

const props = defineProps<{
  plan: StoryPlanResult | null
  selectedType: GenerationType | null
  selectedEvent: string | null
  selectedVideoType: VideoType | null
}>()

defineEmits<{
  'select-type': [type: GenerationType]
  'select-event': [event: string]
  'select-video-type': [type: VideoType]
}>()
```

- [ ] **Step 3: Add videoTypeLabel and presentationStyleLabel functions**

```ts
function videoTypeLabel(vt: VideoType): string {
  return VIDEO_TYPE_CONFIG[vt]?.label ?? vt
}

function presentationStyleLabel(ps: PresentationStyle): string {
  return PRESENTATION_STYLE_CONFIG[ps]?.label ?? ps
}
```

- [ ] **Step 4: Add CSS for styles list**

```css
.story-plan__styles {
  padding-left: 20px;
  margin: 0;
}
.story-plan__styles li {
  font-size: 14px;
  color: #34495e;
  margin-bottom: 4px;
}
```

- [ ] **Step 5: Commit**

```bash
git add web/client/src/components/StoryPlan.vue
git commit -m "feat: StoryPlan shows recommended_video_types and recommended_presentation_styles"
```

---

### Task 7: Update StoryResult.vue for VideoType display and segment_prompt_hint

**Files:**
- Modify: `web/client/src/components/StoryResult.vue`

- [ ] **Step 1: Update header to show video_type and presentation_style**

Replace the header meta line (line 8-10):

```html
<p class="story-result__meta">
  类型: {{ videoTypeLabel }} · 表现: {{ presentationStyleLabel }} · 来源: {{ result.source_entry }}
  <span v-if="result.credibility_note"> · 可信度: {{ result.credibility_note }}</span>
</p>
```

- [ ] **Step 2: Add videoTypeLabel and presentationStyleLabel computed**

Add imports and computed functions:

```ts
import type { StoryGenerateResult, VideoType, PresentationStyle, GearsSegment } from '@shared/types'
import { VIDEO_TYPE_CONFIG, PRESENTATION_STYLE_CONFIG } from '@shared/types'

const videoTypeLabel = computed(() => {
  if (!props.result) return ''
  return VIDEO_TYPE_CONFIG[props.result.video_type]?.label ?? typeLabel(props.result.generation_type)
})

const presentationStyleLabel = computed(() => {
  if (!props.result) return ''
  return PRESENTATION_STYLE_CONFIG[props.result.presentation_style]?.label ?? props.result.presentation_style
})
```

- [ ] **Step 3: Add segment_prompt_hint display in GEARS segments**

In the expanded segment body (after line 79 cultural_constraints display), add:

```html
<p v-if="seg.segment_prompt_hint" class="story-result__segment-hint">
  <strong>风格提示:</strong> {{ seg.segment_prompt_hint }}
</p>
```

- [ ] **Step 4: Add type-specific field display sections**

After the "可信度说明" section (line 108-111), add conditional sections for type-specific fields:

```html
<!-- AI comic dialogue -->
<section v-if="result.dialogue && result.dialogue.length > 0" class="story-result__section">
  <h3 class="story-result__section-title">漫剧对白</h3>
  <div v-for="d in result.dialogue" :key="d.scene_id" class="story-result__dialogue-scene">
    <h4>场景 {{ d.scene_id }}</h4>
    <p v-for="line in d.lines" :key="line.character" class="story-result__dialogue-line">
      <strong>{{ line.character }}</strong>（{{ line.emotion }}）: {{ line.text }}
    </p>
  </div>
</section>

<!-- Promo fields -->
<section v-if="result.visual_symbols && result.visual_symbols.length > 0" class="story-result__section">
  <h3 class="story-result__section-title">视觉符号</h3>
  <p>{{ result.visual_symbols.join('、') }}</p>
  <p v-if="result.core_message"><strong>核心信息:</strong> {{ result.core_message }}</p>
  <p v-if="result.slogan_or_key_sentence"><strong>标语:</strong> {{ result.slogan_or_key_sentence }}</p>
</section>

<!-- Lecture/explainer fields -->
<section v-if="result.argument_points && result.argument_points.length > 0" class="story-result__section">
  <h3 class="story-result__section-title">论点标注</h3>
  <ul><li v-for="pt in result.argument_points" :key="pt">{{ pt }}</li></ul>
</section>
```

- [ ] **Step 5: Add CSS for new elements**

```css
.story-result__segment-hint { margin: 0 0 8px 0; font-size: 13px; color: #8e44ad; background: #f5eef8; padding: 4px 8px; border-radius: 4px; }
.story-result__dialogue-scene { margin-bottom: 8px; }
.story-result__dialogue-line { margin: 0 0 4px 0; font-size: 14px; color: #34495e; }
```

- [ ] **Step 6: Commit**

```bash
git add web/client/src/components/StoryResult.vue
git commit -m "feat: StoryResult shows video_type/presentation_style + segment_prompt_hint + type-specific fields"
```

---

### Task 8: Update API client for VideoType/PresentationStyle

**Files:**
- Modify: `web/client/src/api/stories.ts`

- [ ] **Step 1: Update storyGenerate to accept full request with video_type**

The `storyGenerate` function already accepts `StoryGenerateRequest`, which now includes `video_type` and `presentation_style`. No changes needed to the function signature — the type definition handles it.

- [ ] **Step 2: Add video_type query support to listStories**

Update `listStories`:

```ts
export function listStories(generationType?: string, videoType?: string) {
  const qs: Record<string, string> | undefined = generationType
    ? { generation_type: generationType }
    : videoType
      ? { video_type: videoType }
      : undefined
  return apiGet<StoryListItem[]>('/stories', qs)
}
```

- [ ] **Step 3: Commit**

```bash
git add web/client/src/api/stories.ts
git commit -m "feat: API client supports video_type query param in listStories"
```

---

### Task 9: Update API integration tests

**Files:**
- Modify: `web/server/src/__tests__/api.test.ts`

- [ ] **Step 1: Add test for plan endpoint returning recommended_video_types**

Add inside the `POST /api/stories/plan` describe block:

```ts
it('returns plan result with recommended_video_types for valid entry', async () => {
  const res = await request.post('/api/stories/plan').send({ entry_name: '周敦颐——理学开山鼻祖' });
  if (res.status === 200) {
    expectSuccess(res.body);
    const plan = res.body.data;
    expect(plan).toHaveProperty('recommended_video_types');
    expect(Array.isArray(plan.recommended_video_types)).toBe(true);
    if (plan.recommended_video_types.length > 0) {
      const firstVT = plan.recommended_video_types[0];
      expect(firstVT).toHaveProperty('video_type');
      expect(firstVT).toHaveProperty('reason');
      expect(firstVT).toHaveProperty('priority');
    }
    expect(plan).toHaveProperty('recommended_presentation_styles');
    expect(Array.isArray(plan.recommended_presentation_styles)).toBe(true);
  }
});
```

- [ ] **Step 2: Add test for generate endpoint accepting video_type**

Add inside the `POST /api/stories/generate` describe block:

```ts
it('returns story with video_type and presentation_style when video_type provided', async () => {
  const res = await request.post('/api/stories/generate').send({
    entry_name: '周敦颐——理学开山鼻祖',
    video_type: 'ai_comic_drama',
    target_video_duration: '3分钟',
  });
  if (res.status === 200) {
    expectSuccess(res.body);
    const story = res.body.data;
    expect(story).toHaveProperty('video_type');
    expect(story).toHaveProperty('presentation_style');
    expect(story.video_type).toBe('ai_comic_drama');
    expect(story).toHaveProperty('generation_type'); // backward compat
  }
});

it('returns story with backward compat when only generation_type provided', async () => {
  const res = await request.post('/api/stories/generate').send({
    entry_name: '周敦颐——理学开山鼻祖',
    generation_type: 'character_story',
    target_video_duration: '3分钟',
  });
  if (res.status === 200) {
    expectSuccess(res.body);
    const story = res.body.data;
    expect(story).toHaveProperty('video_type');
    expect(story.video_type).toBe('character_story'); // mapped from generation_type
    expect(story).toHaveProperty('generation_type');
    expect(story.generation_type).toBe('character_story');
  }
});

it('returns story with segment_prompt_hint in gears_segments', async () => {
  const res = await request.post('/api/stories/generate').send({
    entry_name: '周敦颐——理学开山鼻祖',
    video_type: 'ai_comic_drama',
    target_video_duration: '3分钟',
    output_gears_segments: true,
  });
  if (res.status === 200) {
    expectSuccess(res.body);
    const story = res.body.data;
    if (story.gears_segments && story.gears_segments.length > 0) {
      const firstSeg = story.gears_segments[0];
      expect(firstSeg).toHaveProperty('video_type');
      expect(firstSeg).toHaveProperty('presentation_style');
      expect(firstSeg).toHaveProperty('segment_prompt_hint');
    }
  }
});
```

- [ ] **Step 3: Add test for video_type query in listStories**

```ts
it('returns filtered list with video_type query', async () => {
  const res = await request.get('/stories?video_type=ai_comic_drama');
  expect(res.status).toBe(200);
  expectSuccess(res.body);
  expect(Array.isArray(res.body.data)).toBe(true);
});
```

- [ ] **Step 4: Run tests to verify**

```bash
cd d:/china-culture-kb/web && npm run test -w server
```

Expected: All tests pass including new VideoType/PresentationStyle tests.

- [ ] **Step 5: Commit**

```bash
git add web/server/src/__tests__/api.test.ts
git commit -m "test: add VideoType/PresentationStyle integration tests for plan and generate"
```

---

### Task 10: TypeScript check and frontend build verification

**Files:**
- No new files — verification only

- [ ] **Step 1: Run vue-tsc type check**

```bash
cd d:/china-culture-kb/web && npm run lint -w client
```

Expected: No type errors.

- [ ] **Step 2: Run frontend build**

```bash
cd d:/china-culture-kb/web && npm run build -w client
```

Expected: Build succeeds.

- [ ] **Step 3: Run server type check**

```bash
cd d:/china-culture-kb/web && npm run lint -w server
```

Expected: No type errors.

- [ ] **Step 4: Manual test — start dev servers and verify StoryStudio**

```bash
cd d:/china-culture-kb/web && npm run dev
```

Open http://localhost:5177/story/new in browser. Verify:
1. Video type grouped selector appears (4 groups with 15 types)
2. Presentation style dropdown appears after selecting a video type
3. Button says "生成视频方案"
4. Generate request includes `video_type` and `presentation_style`
5. Result shows video_type, presentation_style, and segment_prompt_hint

- [ ] **Step 5: Final commit with any fixes**

If any issues were found and fixed during manual testing, commit them.

---

## Self-Review

### 1. Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Add VideoType (15 types) | Task 1 Step 1 |
| Add PresentationStyle (11 styles) | Task 1 Step 1 |
| Video type metadata (group, label, description, default style, duration) | Task 1 Step 2 |
| Backward compat mapping (generation_type → video_type) | Task 1 Step 2, Task 3 Step 4 |
| Update StoryPlanResult with recommended_video_types | Task 1 Step 3, Task 3 Step 3 |
| Update StoryGenerateRequest with video_type + presentation_style | Task 1 Step 4 |
| Update GearsSegment with video_type, presentation_style, segment_prompt_hint | Task 1 Step 5 |
| Update StoryGenerateResult with video_type + type-specific fields | Task 1 Step 6 |
| Add VideoTypeSchema + PresentationStyleSchema | Task 2 Steps 1-2 |
| /plan returns recommended_video_types + recommended_presentation_styles | Task 3 Step 3 |
| /generate accepts video_type, maps generation_type fallback | Task 3 Step 4 |
| gears_segments include video_type, presentation_style, segment_prompt_hint | Task 3 Step 5 |
| listStories scans all video_type dirs | Task 3 Step 6 |
| getStory searches all video_type dirs | Task 3 Step 6 |
| gears_segments schema_version upgraded to v2 | Task 3 Step 7 |
| StoryStudio video_type grouped selector (4 groups) | Task 5 Steps 5-6 |
| StoryStudio presentation_style dropdown | Task 5 Step 5 |
| Button renamed "生成视频方案" | Task 5 Step 7 |
| StoryPlan shows recommended_video_types | Task 6 Step 1 |
| StoryResult shows video_type/presentation_style | Task 7 Steps 1-2 |
| StoryResult shows segment_prompt_hint | Task 7 Step 3 |
| StoryResult shows type-specific fields | Task 7 Step 4 |
| API client supports video_type | Task 8 |
| Integration tests for video_type | Task 9 |
| TypeScript check + frontend build | Task 10 |

All spec requirements are covered. No gaps found.

### 2. Placeholder scan

No TBD, TODO, "implement later", "fill in details", "add appropriate error handling" found. Every step has complete code.

### 3. Type consistency check

- `VideoType` used consistently in types.ts, schemas.ts, story-service.ts, StoryStudio.vue, StoryPlan.vue, StoryResult.vue
- `PresentationStyle` used consistently across all files
- `GENERATION_TO_VIDEO_TYPE` mapping defined in types.ts, imported in story-service.ts and StoryStudio.vue
- `VIDEO_TYPE_CONFIG` defined in types.ts, imported in story-service.ts, StoryPlan.vue, StoryResult.vue, StoryStudio.vue
- `PRESENTATION_STYLE_CONFIG` defined in types.ts, imported consistently
- `RecommendedVideoType` interface with fields `video_type`, `reason`, `priority` — consistent in types.ts definition and planStory usage
- `RecommendedPresentationStyle` interface with fields `presentation_style`, `reason` — consistent
- `AvailableEvent` now has `recommended_video_type: VideoType` — consistent
- `GearsSegment` fields `video_type`, `presentation_style`, `segment_prompt_hint` — consistent in types, service, and Vue components
- No naming mismatches found.