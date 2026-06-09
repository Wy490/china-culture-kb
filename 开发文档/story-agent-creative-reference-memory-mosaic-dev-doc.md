# Story Agent 创作参考库与回忆拼图式人物故事开发文档

> 版本：v0.1  
> 日期：2026-06-09  
> 目标项目：`china-culture-kb`  
> 上游规划：`story_agent_platform_full_development_plan.md` 阶段 5「生成质量增强」  
> 当前产品基础：Web v1 故事生成工坊、15 种 `video_type`、11 种 `presentation_style`、剧情化故事引擎、GEARS segments 输出  
> 新增目标：让 Story Agent 能从优秀故事文本/视频中提炼创作方法，并支持“通过他人回忆或叙述展示主角生平”的回忆拼图式人物故事。

---

## 1. 背景与新需求

当前产品已经具备：

- 中国传统文化知识库浏览、搜索、条目详情；
- 故事生成工坊 `StoryStudio`；
- `/api/stories/plan` 推荐事件、成片类型、表现形式；
- `/api/stories/generate` 生成视频方案；
- `web/generated/stories/{video_type}/{storyId}.json` 存储生成结果；
- `gears_segments` 输出给 `grears v2`；
- `dramatic-story` 引擎用于避免百科腔、传记腔。

用户的新需求包含两部分：

1. **创作参考学习能力**
   - 用户希望收集自己认为优秀的故事文本或视频；
   - 让 Agent 学习、记住这些作品的创作方式；
   - 用于提升故事生成质量，而不是只根据知识条目机械生成。

2. **回忆拼图式人物生平故事**
   - 用户希望生成类似“通过他人的回忆、叙述、信件、物件来展示主角一生”的剧情；
   - 不是按出生、成长、成就、晚年的年表式传记；
   - 而是通过现实追寻线、多位见证人、关键物件、倒叙/插叙，逐步拼出主角的精神底色。

本开发文档将这两部分合并为阶段 5 的增强任务：

```text
生成质量增强
  ├─ Creative Reference Library 创作参考库
  ├─ Style Pack 创作风格包
  ├─ Memory Mosaic Biography 回忆拼图式人物故事
  └─ Reference-aware Quality Validation 参考感知质量校验
```

---

## 2. 核心原则

### 2.1 不做“原文背诵式学习”

错误方向：

```text
把好故事全文存起来，让 Agent 以后模仿它的文本。
```

问题：

- 容易侵犯版权；
- 容易生成近似原文、近似桥段、近似台词；
- 不利于跨领域迁移；
- 长文本无法稳定进入上下文；
- “记住原文”不等于“学会创作方法”。

正确方向：

```text
优秀样本
  → 清洗/转写
  → 结构分析
  → 提炼创作方法
  → 生成 Style Pack
  → 生成时检索相关方法
  → 质量校验和重写
```

### 2.2 学的是抽象创作方法，不是具体作品表达

Agent 应学习：

- 叙事结构；
- 情绪曲线；
- 冲突设置；
- 开头钩子；
- 物件线索；
- 场景推进；
- 对白比例；
- 镜头组织；
- 结尾落点；
- 不同 `video_type` 的结构差异。

Agent 不应学习：

- 具体作品的原句；
- 具体作者/博主/导演的可识别表达；
- 受版权保护作品的完整桥段；
- 明确要求“写得像某位在世作者/某个影视号”的风格复刻。

### 2.3 创作参考库与知识库分离

现有知识库 `data/provinces/*.md` 存事实条目。

新增创作参考库不应写入 `data/provinces`，推荐独立目录：

```text
references/
  creative/
    texts/
    videos/
    style-packs/
    analyses/
```

原因：

- 知识库负责事实；
- 创作参考库负责方法；
- 两者可信度、版权、用途不同；
- 后续扩展到警察故事、小说改编时不会污染中国文化知识条目。

---

## 3. 产品定位

### 3.1 新能力一句话

让 Story Agent 不只“根据知识条目生成故事”，而是能“参考用户认可的优秀创作样本，提炼创作方法，并按指定叙事结构生成更高级的视频故事方案”。

### 3.2 对当前产品链路的影响

当前链路：

```text
知识库条目
  → /stories/plan
  → 选择事件、video_type、presentation_style
  → /stories/generate
  → story JSON
  → GEARS segments
```

增强后链路：

```text
知识库条目 / 主题 / 大纲
  → /stories/plan
  → 选择事件、video_type、presentation_style
  → 选择 story_structure
  → 检索 creative references / style packs
  → /stories/generate
  → story JSON + reference_trace + structure_profile
  → GEARS segments
```

---

## 4. 新增概念

### 4.1 Creative Reference

`CreativeReference` 是用户认可的优秀故事文本、视频、脚本、影评分析、创作样本的结构化记录。

它不是知识事实来源，而是创作方法来源。

```ts
export type CreativeReferenceMediaType =
  | 'text'
  | 'video'
  | 'script'
  | 'article'
  | 'user_sample';

export type CreativeReferenceRights =
  | 'public_domain'
  | 'user_owned'
  | 'licensed'
  | 'summary_only'
  | 'unknown';

export interface CreativeReference {
  id: string;
  title: string;
  media_type: CreativeReferenceMediaType;
  source_url?: string;
  local_path?: string;
  rights: CreativeReferenceRights;
  domain_tags: string[];
  video_type_tags: VideoType[];
  presentation_style_tags: PresentationStyle[];
  story_structure_tags: StoryStructureType[];
  user_reason: string;
  summary: string;
  created_at: string;
}
```

### 4.2 Reference Analysis

`ReferenceAnalysis` 是对参考样本的结构拆解，不保存长篇原文。

```ts
export interface ReferenceAnalysis {
  reference_id: string;
  narrative_device: string;
  opening_hook: string;
  central_question: string;
  protagonist_mode: string;
  conflict_pattern: string;
  emotional_curve: string[];
  scene_pattern: string[];
  dialogue_density: 'low' | 'medium' | 'high';
  narration_mode: 'first_person' | 'third_person' | 'witness_voice' | 'host_voice' | 'mixed';
  visual_motifs: string[];
  ending_strategy: string;
  reusable_principles: string[];
  avoid_copying: string[];
}
```

### 4.3 Style Pack

`StylePack` 是多个参考样本共同沉淀出的可复用创作规则。

它用于生成时指导结构、节奏、镜头和语言，而不是提供原文。

```ts
export interface StylePack {
  id: string;
  name: string;
  description: string;
  source_reference_ids: string[];
  compatible_video_types: VideoType[];
  compatible_presentation_styles: PresentationStyle[];
  compatible_story_structures: StoryStructureType[];
  structure_rules: string[];
  rhythm_rules: string[];
  scene_rules: string[];
  narration_rules: string[];
  dialogue_rules: string[];
  visual_rules: string[];
  ending_rules: string[];
  forbidden_patterns: string[];
}
```

### 4.4 Story Structure Type

当前系统已经有 `video_type` 和 `presentation_style`。

新增 `story_structure`，用于描述“故事组织方式”。

```ts
export type StoryStructureType =
  | 'single_event_drama'
  | 'three_act_drama'
  | 'memory_mosaic_biography'
  | 'witness_testimony'
  | 'object_clue_journey'
  | 'before_after_transformation'
  | 'case_reconstruction'
  | 'lecture_argument';
```

三者关系：

```text
video_type           成片类型：历史剧情、人物故事、AI漫剧、微纪录
presentation_style   表现形式：影视叙事、纪实、主持讲述、AI漫剧
story_structure      叙事结构：单事件戏剧、回忆拼图、见证叙述、物件线索
```

示例：

```json
{
  "video_type": "character_story",
  "presentation_style": "cinematic",
  "story_structure": "memory_mosaic_biography"
}
```

---

## 5. 回忆拼图式人物故事

### 5.1 定义

`memory_mosaic_biography` 是一种人物故事结构：

```text
现实中的追寻者
  → 发现一个物件/问题/空白
  → 访问多个见证人
  → 每个见证人讲出主角一生的一个片段
  → 片段不按时间线罗列，而按情感和真相递进
  → 最后揭示主角真正的选择、亏欠、信念或精神底色
```

### 5.2 适用场景

适合：

- 历史人物；
- 家族记忆；
- 英雄人物；
- 地方名人；
- 警察/法治人物故事；
- 非遗传承人故事；
- 小说人物改编；
- 纪录片、微纪录、人物短片、AI 漫剧。

不适合：

- 只介绍一个地点的场景短片；
- 纯知识讲解；
- 30 秒以内极短社媒快切；
- 缺少人物关系和关键事件的条目。

### 5.3 必备结构

```ts
export interface MemoryMosaicStorySeed {
  subject: string;
  present_day_seeker: string;
  seeker_goal: string;
  trigger_object: string;
  central_question: string;
  witnesses: WitnessMemory[];
  final_reveal: string;
  ending_image: string;
}

export interface WitnessMemory {
  witness_name: string;
  relationship_to_subject: string;
  remembered_event: string;
  subject_choice: string;
  emotional_bias: 'admiration' | 'regret' | 'misunderstanding' | 'gratitude' | 'conflict' | 'nostalgia';
  object_or_phrase: string;
  scene_location: string;
  scene_time: string;
  present_day_effect: string;
  factual_basis: string;
  fictionalized_elements: string[];
}
```

### 5.4 叙事规则

必须做到：

- 不按人物一生年表写；
- 每段回忆只聚焦一个关键选择；
- 主角不通过自我介绍出现；
- 主角通过别人记忆里的行动、代价和影响被看见；
- 至少一个见证人对主角有误解或复杂情绪；
- 现实线人物必须因为回忆发生认知变化；
- 结尾必须有一个可视化物件或场景呼应开头。

禁止输出：

- “某某出生于……后来……最终……”；
- “他的一生充满传奇色彩”这类空泛传记腔；
- 多个年份段落堆砌；
- 只写赞美，没有冲突、亏欠、代价；
- 只有旁白，没有现实追寻动作；
- 只有资料概述，没有见证人声音。

---

## 6. 生成流程设计

### 6.1 通用创作参考生成流程

```text
用户选择/上传参考样本
  → ingestCreativeReference
  → analyzeCreativeReference
  → buildStylePack
  → generate 时按 video_type/presentation_style/story_structure 检索 StylePack
  → dramatic-story 引擎注入创作规则
  → validateReferenceAwareStory
  → 输出 story JSON
```

### 6.2 回忆拼图式人物故事生成流程

```text
EntryDetail / KnowledgePack
  → 提取人物、事件、关系、地点、物件
  → 判断是否适合 memory_mosaic_biography
  → 构造现实追寻者
  → 构造 trigger_object
  → 构造 4-6 个 WitnessMemory
  → 按情感递进排序
  → 生成 full_text
  → 生成 scene_breakdown
  → 生成 gears_segments
  → 质量校验
```

### 6.3 推荐的场景顺序

3 分钟版本：

```text
1. 现实线开场：追寻者发现物件和疑问
2. 第一位见证人：主角早期选择
3. 第二位见证人：主角面临误解/代价
4. 第三位见证人：主角最关键行动
5. 最终揭示：主角真正动机
6. 现实线结尾：物件回到当下，追寻者完成理解
```

5 分钟版本：

```text
1. 现实钩子
2. 物件线索
3. 见证人 A：温柔侧面
4. 见证人 B：冲突侧面
5. 见证人 C：亏欠或误解
6. 见证人 D：关键选择
7. 现实线反应
8. 最终揭示
9. 结尾画面
```

---

## 7. 类型与 Schema 改造

### 7.1 `web/shared/types.ts`

新增：

- `StoryStructureType`
- `STORY_STRUCTURE_CONFIG`
- `CreativeReference`
- `ReferenceAnalysis`
- `StylePack`
- `ReferenceTrace`
- `MemoryMosaicStorySeed`
- `WitnessMemory`

扩展：

```ts
export interface StoryGenerateRequest {
  // existing fields...
  story_structure?: StoryStructureType;
  creative_reference_ids?: string[];
  style_pack_ids?: string[];
  reference_strength?: 'light' | 'medium' | 'strong';
}

export interface StoryPlanResult {
  // existing fields...
  recommended_story_structures?: RecommendedStoryStructure[];
}

export interface StoryGenerateResult {
  // existing fields...
  story_structure?: StoryStructureType;
  reference_trace?: ReferenceTrace[];
  style_pack_ids?: string[];
  memory_mosaic_seed?: MemoryMosaicStorySeed;
}
```

推荐配置：

```ts
export const STORY_STRUCTURE_CONFIG: Record<StoryStructureType, StoryStructureMeta> = {
  single_event_drama: {
    id: 'single_event_drama',
    label: '单事件戏剧',
    description: '围绕一个核心事件展开目标、阻力、选择和结果',
    compatible_video_types: ['character_story', 'historical_drama', 'ai_comic_drama'],
  },
  memory_mosaic_biography: {
    id: 'memory_mosaic_biography',
    label: '回忆拼图式人物故事',
    description: '通过后人追寻、关键物件和多位见证人的回忆拼出主角生平',
    compatible_video_types: ['character_story', 'historical_drama', 'documentary_short', 'ai_comic_drama'],
  },
  witness_testimony: {
    id: 'witness_testimony',
    label: '见证人叙述',
    description: '以多个见证人的口述推动故事',
    compatible_video_types: ['documentary_short', 'lecture_video', 'historical_drama'],
  },
  object_clue_journey: {
    id: 'object_clue_journey',
    label: '物件线索追寻',
    description: '由一件物品串联地点、人物和历史片段',
    compatible_video_types: ['documentary_short', 'scene_short', 'culture_promo'],
  },
};
```

### 7.2 `web/shared/schemas.ts`

新增：

```ts
export const StoryStructureTypeSchema = z.enum([
  'single_event_drama',
  'three_act_drama',
  'memory_mosaic_biography',
  'witness_testimony',
  'object_clue_journey',
  'before_after_transformation',
  'case_reconstruction',
  'lecture_argument',
]);
```

扩展 `StoryGenerateRequestSchema`：

```ts
story_structure: StoryStructureTypeSchema.optional(),
creative_reference_ids: z.array(z.string()).optional(),
style_pack_ids: z.array(z.string()).optional(),
reference_strength: z.enum(['light', 'medium', 'strong']).optional(),
```

校验规则：

- `memory_mosaic_biography` 只允许搭配人物相关 `video_type`；
- `reference_strength = strong` 时必须提供 `style_pack_ids` 或可检索到匹配 StylePack；
- `creative_reference_ids` 对应 reference 权限不得为 `unknown` 且不得用于原文复刻。

---

## 8. 后端服务改造

### 8.1 新增服务

推荐新增文件：

```text
web/server/src/services/creative-reference-service.ts
web/server/src/services/style-pack-service.ts
web/server/src/services/memory-mosaic-service.ts
web/server/src/services/reference-quality-service.ts
```

职责：

| 文件 | 职责 |
|---|---|
| `creative-reference-service.ts` | 读取/写入参考样本元数据、分析结果 |
| `style-pack-service.ts` | 根据分析结果生成、读取、检索 StylePack |
| `memory-mosaic-service.ts` | 从 EntryDetail/KnowledgePack 构造 MemoryMosaicStorySeed |
| `reference-quality-service.ts` | 检查生成结果是否符合参考规则，避免过度模仿 |

### 8.2 `story-service.ts` 改造点

当前 `generateAndStoreStory` 流程为：

```text
resolve video_type
  → resolve entry
  → select central event
  → generateDramaticContent
  → validateDramaticStory
  → write story JSON
```

改造后：

```text
resolve video_type / presentation_style / story_structure
  → resolve entry / knowledge_pack
  → select central event
  → retrieveStylePacks
  → 如果 story_structure = memory_mosaic_biography:
       buildMemoryMosaicSeed
       generateMemoryMosaicContent
     否则:
       generateDramaticContent
  → validateDramaticStory
  → validateReferenceAwareStory
  → write story JSON
```

### 8.3 `dramatic-story.ts` 改造点

新增或拆分：

```ts
export function generateMemoryMosaicContent(input: {
  entry: EntryDetail;
  centralEvent: string;
  videoType: VideoType;
  presentationStyle: PresentationStyle;
  targetDuration: SupportedDuration;
  tone: string;
  memorySeed: MemoryMosaicStorySeed;
  stylePacks: StylePack[];
}): DramaticStoryResult
```

不要把所有新逻辑塞进已有 `generateDramaticContent`，否则文件会继续膨胀。

建议：

- `dramatic-story.ts` 保留通用剧情引擎；
- `memory-mosaic-service.ts` 负责 seed；
- `generateMemoryMosaicContent` 可以在新文件中实现，再被 `story-service.ts` 调用。

---

## 9. API 设计

### 9.1 扩展现有生成接口

继续使用：

```http
POST /api/stories/generate
```

请求示例：

```json
{
  "entry_name": "周敦颐——理学开山鼻祖",
  "video_type": "character_story",
  "presentation_style": "cinematic",
  "story_structure": "memory_mosaic_biography",
  "selected_event": "南安拒签冤案",
  "target_video_duration": "3分钟",
  "style_pack_ids": ["memory-mosaic-humanistic"],
  "reference_strength": "medium",
  "output_gears_segments": true
}
```

响应新增字段：

```json
{
  "story_structure": "memory_mosaic_biography",
  "style_pack_ids": ["memory-mosaic-humanistic"],
  "memory_mosaic_seed": {
    "subject": "周敦颐",
    "present_day_seeker": "年轻策展人",
    "trigger_object": "一卷残缺案牍",
    "central_question": "为什么一个小官敢为了囚犯拒绝签字"
  },
  "reference_trace": [
    {
      "style_pack_id": "memory-mosaic-humanistic",
      "applied_rules": ["用物件开场", "用见证人回忆推进", "结尾呼应物件"]
    }
  ]
}
```

### 9.2 新增参考库接口

推荐后续新增：

```http
POST /api/creative-references
GET  /api/creative-references
GET  /api/creative-references/:id
POST /api/creative-references/:id/analyze

POST /api/style-packs
GET  /api/style-packs
GET  /api/style-packs/:id
```

MVP 可以先不做前端上传，只支持本地 Markdown/JSON 文件。

---

## 10. 本地存储设计

### 10.1 目录结构

```text
references/
  creative/
    texts/
      {referenceId}.md
    videos/
      {referenceId}.md
    analyses/
      {referenceId}.json
    style-packs/
      {stylePackId}.json
```

### 10.2 文本参考 Markdown

```md
# 参考样本标题

> id: ref-20260609-001
> media_type: text
> rights: summary_only
> source_url:
> video_type_tags: character_story, documentary_short
> presentation_style_tags: cinematic, documentary
> story_structure_tags: memory_mosaic_biography

## 用户认为它好的原因

...

## 摘要

...

## 可学习的创作方法

...

## 禁止复刻

- 不复刻原文句子
- 不复刻具体桥段
- 不使用可识别人物设定
```

### 10.3 视频参考 Markdown

```md
# 视频参考样本标题

> id: ref-video-20260609-001
> media_type: video
> rights: summary_only
> source_url: https://...
> transcript_available: true

## 视频摘要

## 结构拆解

## 镜头/节奏观察

## 可学习方法

## 禁止复刻
```

---

## 11. 前端改造

### 11.1 StoryStudio

当前 `StoryStudio.vue` 已支持：

- 输入模式；
- 选择 `video_type`；
- 选择 `presentation_style`；
- 生成视频方案。

新增：

1. **叙事结构选择**
   - 单事件戏剧；
   - 回忆拼图式人物故事；
   - 见证人叙述；
   - 物件线索追寻。

2. **创作参考强度**
   - 轻度参考：只参考结构；
   - 中度参考：参考结构和节奏；
   - 强参考：严格套用 StylePack 规则，但禁止复刻表达。

3. **Style Pack 选择**
   - 默认自动推荐；
   - 高级模式可手动选择。

### 11.2 StoryPlan

新增展示：

- 推荐叙事结构；
- 为什么推荐 `memory_mosaic_biography`；
- 是否需要更多人物关系/物件线索。

### 11.3 StoryResult

新增展示：

- `story_structure`；
- 使用的 Style Pack；
- `memory_mosaic_seed`；
- `reference_trace`；
- 质量校验问题。

---

## 12. Prompt Profile 设计

### 12.1 回忆拼图式人物故事系统提示

```text
你是人物故事结构设计师。

你要生成的不是人物年表，也不是百科介绍。
你要使用“现实追寻 + 关键物件 + 多位见证人回忆 + 最终情感揭示”的结构，
通过他人对主角的记忆，拼出主角一生最重要的选择和精神底色。

必须遵守：
1. 不按出生、成长、成就、晚年顺序写。
2. 每段回忆只围绕一个具体场景和一个关键选择。
3. 主角不能自我介绍，必须通过他人眼中的行动被看见。
4. 至少一位见证人对主角有误解、遗憾或复杂情绪。
5. 现实线人物必须在结尾发生理解变化。
6. 开头物件必须在结尾回响。
7. 不照抄任何参考样本的句子、桥段和人物设定。
```

### 12.2 生成 full_text 的用户提示模板

```text
请根据以下资料生成回忆拼图式人物故事：

【主角】
{{subject}}

【知识库事实】
{{entry_summary}}

【核心事件】
{{central_event}}

【现实追寻者】
{{present_day_seeker}}

【触发物件】
{{trigger_object}}

【核心问题】
{{central_question}}

【见证人回忆】
{{witnesses}}

【Style Pack 规则】
{{style_pack_rules}}

输出要求：
- 标题
- logline
- full_text
- scene_breakdown
- gears_segments
- factual_basis / fictionalized_elements
```

---

## 13. 质量校验设计

### 13.1 新增校验函数

```ts
export function validateMemoryMosaicStory(result: {
  full_text: string;
  scene_breakdown: StoryScene[];
  memory_seed?: MemoryMosaicStorySeed;
}): StoryQualityReport
```

### 13.2 校验规则

必须通过：

- 有现实追寻者；
- 有触发物件；
- 至少 3 位见证人；
- 至少 3 个回忆场景；
- 至少 1 个复杂情绪见证人；
- 结尾呼应开头物件；
- `full_text` 不得出现 3 个以上年份开头段落；
- 不得出现“他的一生”“生平事迹”“年谱式”密集表达；
- 每个回忆场景必须有 `subject_choice`；
- `gears_segments.script_text` 不能只是知识讲解。

### 13.3 参考安全校验

```ts
export function validateReferenceSafety(input: {
  generated_text: string;
  references: CreativeReference[];
  analyses: ReferenceAnalysis[];
}): ReferenceSafetyReport
```

MVP 规则：

- 禁止输出参考样本中的长句；
- 禁止在 `rights = unknown` 的参考上使用 `reference_strength = strong`；
- 禁止要求“完全仿写某作品”；
- 禁止在结果中声称“改编自某作品”，除非用户拥有授权；
- `reference_trace` 只记录抽象规则，不记录原文段落。

---

## 14. GEARS Segments 输出规则

`memory_mosaic_biography` 的 `gears_segments` 应体现现实线和回忆线交错。

推荐字段策略：

```ts
segment_prompt_hint = `${video_type}/${presentation_style}/${story_structure}: 当前段落为${现实线或回忆线}，聚焦${witness 或 trigger_object}。`
```

`script_text` 规则：

- 现实线段落：突出追寻动作、物件、疑问；
- 回忆段落：突出见证人声音、主角行动、情绪偏差；
- 结尾段落：物件回响、现实线人物理解变化；
- 不输出百科式说明。

---

## 15. 与平台全量计划的关系

本能力属于 `story_agent_platform_full_development_plan.md` 的阶段 5「生成质量增强」。

它同时为后续阶段打基础：

| 后续阶段 | 本文档支撑 |
|---|---|
| 阶段 6 警察故事领域设计 | 可用见证人叙述、案例重构、物件线索 |
| 阶段 7 小说改编领域设计 | 可用 Style Pack 和 story_structure |
| 阶段 8 扩展 video_type | 可将 story_structure 与新领域组合 |
| 阶段 12 统一工作台产品化 | 前端可提供更专业的创作控制 |
| 阶段 13 内容管理、版本与审核 | 参考库需要版权、版本、审核状态 |

---

## 16. MVP 实施计划

### Task 1：类型与 Schema

修改：

- `web/shared/types.ts`
- `web/shared/schemas.ts`

新增：

- `StoryStructureType`
- `RecommendedStoryStructure`
- `MemoryMosaicStorySeed`
- `WitnessMemory`
- `ReferenceTrace`
- request/result 扩展字段。

验收：

- TypeScript 通过；
- `StoryGenerateRequestSchema` 支持 `story_structure`；
- 旧请求不受影响。

### Task 2：Memory Mosaic 服务

新增：

- `web/server/src/services/memory-mosaic-service.ts`

实现：

- `recommendStoryStructures(entry, videoType)`；
- `buildMemoryMosaicSeed(entry, centralEvent, knowledgePack?)`；
- `generateMemoryMosaicContent(...)`。

验收：

- 历史人物条目能生成 `memory_mosaic_seed`；
- 至少 4 个见证人或回忆片段；
- full_text 不再是年表传记。

### Task 3：接入 story-service

修改：

- `web/server/src/services/story-service.ts`

实现：

- resolve `story_structure`；
- plan 返回 `recommended_story_structures`；
- generate 根据 `story_structure` 路由到不同生成器；
- story JSON 写入新字段。

验收：

- 旧 `character_story` 仍可生成；
- 新 `memory_mosaic_biography` 可生成；
- `web/generated/stories/{video_type}/{storyId}.json` 包含新字段。

### Task 4：质量校验

新增或扩展：

- `validateMemoryMosaicStory`；
- `validateReferenceSafety`。

验收：

- 年表式输出会被标记；
- 缺少见证人会被标记；
- 缺少物件回响会被标记；
- `quality_report.issues` 能返回前端。

### Task 5：创作参考库 MVP

新增目录：

```text
references/creative/texts
references/creative/videos
references/creative/analyses
references/creative/style-packs
```

新增服务：

- `creative-reference-service.ts`
- `style-pack-service.ts`

MVP 只支持读取本地 JSON/Markdown，不做上传 UI。

验收：

- 可读取至少一个 Style Pack；
- generate 请求传入 `style_pack_ids` 后能进入 `reference_trace`；
- 不保存受版权保护长文本到生成上下文。

### Task 6：前端轻量接入

修改：

- `web/client/src/views/StoryStudio.vue`
- `web/client/src/components/StoryPlan.vue`
- `web/client/src/components/StoryResult.vue`

实现：

- 叙事结构选择；
- 推荐叙事结构展示；
- 结果页展示 `story_structure`、`memory_mosaic_seed`、`reference_trace`。

验收：

- 用户能选择“回忆拼图式人物故事”；
- 生成请求包含 `story_structure`；
- 结果页能看出使用了该结构。

---

## 17. 测试计划

### 17.1 API 测试

修改：

- `web/server/src/__tests__/api.test.ts`

新增测试：

1. `/stories/plan` 返回 `recommended_story_structures`；
2. `/stories/generate` 支持 `story_structure = memory_mosaic_biography`；
3. 生成结果包含 `memory_mosaic_seed`；
4. 生成结果包含 `story_structure`；
5. `gears_segments` 包含结构化提示；
6. 旧请求无 `story_structure` 时仍通过。

### 17.2 服务测试

新增：

```text
web/server/src/__tests__/memory-mosaic-service.test.ts
web/server/src/__tests__/style-pack-service.test.ts
```

测试：

- 能从历史人物条目构造 seed；
- seed 至少有 3 个见证人；
- 见证人情绪不全是赞美；
- 触发物件存在；
- 结尾画面存在；
- Style Pack 能被读取和过滤。

### 17.3 质量测试

测试失败样例：

- 年表式传记；
- 没有现实追寻者；
- 没有物件；
- 没有见证人；
- 只有旁白解说；
- 直接复刻参考样本原句。

---

## 18. 验收标准

功能验收：

- 用户可以选择“回忆拼图式人物故事”；
- 系统能通过别人回忆/叙述展示主角生平；
- 生成结果有现实线、物件线、见证人、最终揭示；
- 输出仍兼容现有 GEARS segments；
- 旧的 `video_type`、`presentation_style` 不退化。

质量验收：

- 不再输出年表式生平；
- 主角通过行动和他人记忆被呈现；
- 至少有一个复杂情绪或误解；
- 结尾有情感揭示；
- 参考样本只作为方法来源，不出现明显仿写。

工程验收：

- 类型、schema、后端、前端、测试一致；
- 生成 JSON schema 可向后兼容；
- 不把创作参考写入 `data/provinces`；
- 测试和构建通过。

---

## 19. 给 Claude Code 的执行指令

```text
现在开始实现 Story Agent 阶段 5 的新增强：
创作参考库 + 回忆拼图式人物故事结构。

请基于当前 china-culture-kb 产品结构开发，不要另起孤立系统。

目标：
1. 新增 story_structure 概念，先实现 memory_mosaic_biography。
2. 扩展 /stories/plan，返回 recommended_story_structures。
3. 扩展 /stories/generate，支持 story_structure。
4. 新增 memory-mosaic-service，从历史人物/人物故事条目生成 MemoryMosaicStorySeed。
5. 生成 full_text、scene_breakdown、gears_segments 时，使用“现实追寻 + 关键物件 + 多位见证人回忆 + 最终情感揭示”结构。
6. 增加质量校验，防止输出年表式传记。
7. 预留 Creative Reference Library 和 Style Pack 类型，但 MVP 可先只实现本地读取和 reference_trace。
8. 前端 StoryStudio 增加叙事结构选择，StoryResult 展示 story_structure 和 memory_mosaic_seed。

注意：
- 不要把创作参考样本写入 data/provinces。
- 不要让生成结果复刻具体参考作品的句子和桥段。
- 保持旧接口兼容。
- 每一步都补测试。

完成后输出：
- 修改文件列表
- 新增类型列表
- API 行为变化
- 测试结果
- 一个“周敦颐 + memory_mosaic_biography”的生成示例摘要
```

