# china-culture-kb 多成片类型视频方案生成系统开发文档

> 版本：v0.2（v0.1 已落地，v0.2 为第二阶段规划）
> 日期：2026-06-05（v0.1），2026-06-05 更新（v0.2）
> 面向执行者：Claude Code
> 目标项目：`D:/china-culture-kb`
> 下游项目：`D:/grears v2`
> 核心目标：将 Web 端从 v0.1 的 3 类型 `generation_type` 升级为 v0.2 的 15 类型 `video_type` + 11 表现形式 `presentation_style` 双层选择系统，让用户可以生成人物故事、历史剧情短片、AI 漫剧、宣讲片、讲解视频、纪录短片等多类文化视频方案，并输出增强版 `gears_segments` 给 `grears v2` 消费。

---

## 0. v0.1 已完成现状（checkpoint-2026-06-05-web-v0.1）

v0.1 已落地并推送到 GitHub（tag `checkpoint-2026-06-05-web-v0.1`）。以下功能已实现：

### 已实现功能

| 功能 | 实现内容 | 关键文件 |
|------|---------|----------|
| Monorepo scaffold | Express + Vue3 + shared types | `web/package.json`, tsconfigs |
| 3 类型故事生成 | `character_story` / `culture_promo` / `scene_short` | `story-service.ts` |
| 内容自动填充 | generate 时从 KB 条目填充 `logline` / `full_text` / `scene_breakdown` / `gears_segments` | `story-service.ts` |
| StoryScene 扩展字段 | `title`, `time_of_day`, `dramatic_function`, `plot`, `visual_prompt`, `camera_suggestion`, `cultural_note` | `shared/types.ts` |
| StoryListItem 列表丰富 | `source_entry`, `logline`, `created_at`, `has_gears_segments`, `scene_count`, `credibility_note` | `shared/types.ts`, `story-service.ts` |
| GearsActions 复制 | 复制完整 JSON + 复制单段 script_text + 复制单段 JSON + 导出文件 | `GearsActions.vue` |
| StoryResult 详细展示 | 场景卡片 7 新字段 + gears 逐段展开折叠 + 空内容友好提示 | `StoryResult.vue` |
| `_request_meta` 清除 | API 响应不暴露内部 `_request_meta` 字段 | `story-service.ts` |
| API 集成测试 | 26 个测试全通过 | `__tests__/api.test.ts` |
| CORS 跨域消费 | grears v2 可跨域消费 gears-segments 端点 | `cors.ts` |

### v0.1 的 3 类型路由表（当前 `TYPE_GENERATION_ROUTING`）

```ts
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
```

### v0.1 的 `RecommendedType`（当前 plan 返回结构）

```ts
interface RecommendedType {
  generation_type: GenerationType;  // 只有 3 值
  reason: string;
  priority: number;                  // 无 suitability 区分
}
```

### v0.1 未实现的关键差距

| 差距 | 说明 |
|------|------|
| 只有 3 种 `generation_type` | 无法覆盖宣传片、AI 漫剧、宣讲片等实际需求 |
| 无 `presentation_style` | 表现形式（电影感/纪录片/口播/漫剧等）完全缺失 |
| 无 `suitability` 区分 | 推荐只分优先级，不区分"推荐/可选/不推荐" |
| 无类型分组 UI | StoryPlan 展示为平铺卡片，无四大类分组 |
| gears_segments 无 `video_type` | 每段不含成片类型和表现形式信息 |
| 12 种新类型无输出结构 | `heritage_promo`, `ai_comic_drama` 等无专属字段 |

---

## 1. 问题背景

v0.1 的 StoryStudio 生成界面已有：

- 词条名称输入；
- 预览推荐（返回 3 类型推荐卡片 + 可选事件 + 文化风险）；
- 成片类型选择（仅 3 种 `generation_type`：人物故事 / 文化宣传 / 场景短片）；
- 目标时长；
- 叙事风格；
- 生成按钮。

但缺少的关键能力：

1. **成片类型太少** — 只有 3 种，无法覆盖宣传片、AI 漫剧、宣讲片等实际视频创作需求；
2. **无表现形式选择** — 同一个”人物故事”可以是电影感、纪录片感、口播宣讲、漫剧分镜，但用户无法指定；
3. **无推荐分级** — plan 返回的推荐只按 `priority` 排序，不区分”推荐 / 可选 / 不推荐”；
4. **无类型分组 UI** — 15 种类型平铺选择体验差，应按剧情/宣传/讲解/场景四大类分组。

这导致用户无法明确选择：

- 文化宣传片；
- 场景短片；
- AI 漫剧；
- 宣讲片；
- 讲解视频；
- 纪录短片；
- 竖屏短视频；
- 儿童故事片。

当前系统只有较粗的三类：

```text
character_story / culture_promo / scene_short
```

这不足以覆盖实际视频创作需求。

---

## 2. 设计原则

不要把“宣传片、宣讲片、AI 漫剧、场景短片”都塞进同一个 `generation_type`。

这些不是同一维度。

正确设计应拆成两层：

```text
成片类型 video_type
        +
表现形式 presentation_style
```

例如同一个条目“周敦颐——理学开山鼻祖”，可以生成：

- 人物故事；
- 历史剧情短片；
- AI 漫剧；
- 文化宣讲片；
- 微纪录片；
- 知识讲解视频。

同一个条目“湘绣——中国四大名绣之一”，可以生成：

- 非遗宣传片；
- 工艺讲解视频；
- 文化微纪录；
- 竖屏短视频；
- 儿童科普视频。

---

## 3. 新类型系统

### 3.1 新增 `VideoType`

在 `web/shared/types.ts` 中新增：

```ts
export type VideoType =
  | 'character_story'          // 人物故事
  | 'historical_drama'         // 历史剧情短片
  | 'legend_story'             // 神话/民间传说故事
  | 'culture_promo'            // 文化宣传片
  | 'heritage_promo'           // 非遗/工艺宣传片
  | 'city_brand_promo'         // 城市/地方文旅宣传片
  | 'scene_short'              // 场景短片
  | 'landscape_mood'           // 山水意境片
  | 'documentary_short'        // 微纪录片
  | 'explainer_video'          // 知识讲解视频
  | 'lecture_video'            // 宣讲片/观点阐释片
  | 'education_training'       // 教育/培训片
  | 'children_story'           // 儿童故事片
  | 'social_short'             // 竖屏短视频
  | 'ai_comic_drama';          // AI 漫剧
```

### 3.2 新增 `PresentationStyle`

```ts
export type PresentationStyle =
  | 'cinematic'                // 电影感
  | 'documentary'              // 纪录片感
  | 'host_narration'           // 主持人口播/宣讲
  | 'voiceover_montage'        // 旁白+画面蒙太奇
  | 'vertical_drama'           // 竖屏短剧
  | 'ai_comic'                 // AI 漫剧/漫画分镜
  | 'animation_2d'             // 2D 动画
  | 'ink_style'                // 水墨风
  | 'children_animation'       // 儿童动画
  | 'museum_exhibit'           // 展陈/博物馆讲解
  | 'social_media_fastcut';    // 短视频快剪
```

### 3.3 旧字段兼容

旧代码中如仍使用 `generation_type`，第一阶段做兼容：

```text
generation_type 临时映射为 video_type
```

规则：

- 如果请求里有 `video_type`，优先使用 `video_type`；
- 如果只有 `generation_type`，后端映射为 `video_type = generation_type`；
- 旧 story 如果只有 `generation_type`，前端显示时映射为 `video_type`；
- 不要让旧故事详情页崩溃。

---

## 4. 成片类型分类

### 4.1 剧情故事类

#### 1. 人物故事 `character_story`

适合：

- 历史人物；
- 文人学者；
- 民间英雄；
- 非遗传承人；
- 有关键人生选择的人物。

生成重点：

- 主角目标；
- 阻力；
- 抉择；
- 代价；
- 人物弧光；
- 结尾精神落点。

#### 2. 历史剧情短片 `historical_drama`

适合：

- 正史记载事件；
- 地方掌故；
- 历史人物关键时刻；
- 英雄事迹。

生成重点：

- 历史场景；
- 冲突递进；
- 事件因果；
- 史实锚点；
- 影视化细节边界。

#### 3. 神话/民间传说故事 `legend_story`

适合：

- 神话传说；
- 民间故事；
- 口述故事；
- 地方传说。

生成重点：

- 神异元素；
- 象征意象；
- 民间版本；
- 传说与史实边界。

#### 4. AI 漫剧 `ai_comic_drama`

适合：

- 人物冲突；
- 民间传说；
- 历史事件；
- 适合漫画分镜的故事。

生成重点：

- 漫画式分场；
- 人物对白；
- 表情情绪；
- 分镜构图；
- 结尾悬念或强情绪。

#### 5. 儿童故事片 `children_story`

适合：

- 神话传说；
- 民间故事；
- 工艺启蒙；
- 适合儿童理解的文化主题。

生成重点：

- 语言简单；
- 情节温和；
- 避免恐怖血腥；
- 有温暖结尾；
- 有道理但不说教。

### 4.2 宣传推广类

#### 6. 文化宣传片 `culture_promo`

适合：

- 地方文化；
- 节庆习俗；
- 城市文化名片；
- 综合性文化主题。

生成重点：

- 核心文化信息；
- 视觉符号；
- 情绪召唤；
- 当代延续；
- 结尾口号或意象。

#### 7. 非遗/工艺宣传片 `heritage_promo`

适合：

- 非遗；
- 传统工艺；
- 地方戏曲；
- 民俗技艺。

生成重点：

- 工艺流程；
- 手部动作；
- 材料与工具；
- 传承关系；
- 当代价值。

#### 8. 城市/地方文旅宣传片 `city_brand_promo`

适合：

- 名胜古迹；
- 城市文化；
- 区域文化；
- 文旅品牌。

生成重点：

- 地理识别；
- 城市气质；
- 标志场景；
- 古今连接；
- 旅游/文化吸引力。

#### 9. 竖屏短视频 `social_short`

适合：

- 短平台传播；
- 快节奏文化科普；
- 轻量宣传；
- 片段故事。

生成重点：

- 开头 3 秒钩子；
- 三个关键信息点；
- 快剪结构；
- 字幕提示；
- 结尾行动召唤。

### 4.3 讲解教育类

#### 10. 微纪录片 `documentary_short`

适合：

- 非遗；
- 历史人物；
- 文化空间；
- 地方现象。

生成重点：

- 事实；
- 证据；
- 来源；
- 现实连接；
- 采访建议。

#### 11. 知识讲解视频 `explainer_video`

适合：

- 知识科普；
- 概念讲解；
- 历史来龙去脉；
- 工艺原理。

生成重点：

- 核心问题；
- 解释结构；
- 关键词；
- 例子；
- 可视化讲解。

#### 12. 宣讲片/观点阐释片 `lecture_video`

适合：

- 人物精神；
- 文化价值；
- 地方精神；
- 展馆讲解；
- 课程宣讲。

生成重点：

- 中心观点；
- 开场问题；
- 论点；
- 例证；
- 结论升华。

#### 13. 教育/培训片 `education_training`

适合：

- 课堂内容；
- 文化教育；
- 工艺步骤培训；
- 安全/流程类讲解。

生成重点：

- 学习目标；
- 知识点；
- 步骤；
- 提问；
- 复盘。

### 4.4 场景空间类

#### 14. 场景短片 `scene_short`

适合：

- 名胜古迹；
- 书院祠堂；
- 古城街巷；
- 湖泊山岳；
- 遗址遗迹。

生成重点：

- 空间身份；
- 视觉路线；
- 历史记忆；
- 场景氛围；
- 结尾画面。

#### 15. 山水意境片 `landscape_mood`

适合：

- 山水景观；
- 湖泊；
- 古镇；
- 文人意象；
- 诗意空间。

生成重点：

- 氛围；
- 声音；
- 光影；
- 季节；
- 诗性旁白。

---

## 5. StoryStudio 前端改造

### 5.1 当前问题

当前界面缺少成片类型选择，用户无法指定要生成什么。

### 5.2 新交互结构

StoryStudio 左侧配置区调整为：

```text
1. 词条名称
2. 预览推荐
3. 成片类型 video_type
4. 表现形式 presentation_style
5. 目标时长
6. 叙事/表达风格 tone
7. 生成视频方案
```

### 5.3 成片类型选择区

使用卡片或分组按钮，不要只用普通下拉。

分组展示：

```text
A. 剧情故事类
  - 人物故事
  - 历史剧情短片
  - 神话/民间传说
  - AI 漫剧
  - 儿童故事

B. 宣传推广类
  - 文化宣传片
  - 非遗/工艺宣传片
  - 城市/地方文旅宣传片
  - 竖屏短视频

C. 讲解教育类
  - 微纪录片
  - 知识讲解视频
  - 宣讲片/观点阐释片
  - 教育/培训片

D. 场景空间类
  - 场景短片
  - 山水意境片
```

每个卡片显示：

- 中文名；
- 一句话说明；
- 推荐时长；
- 适合条目类型；
- 推荐状态：推荐 / 可选 / 不推荐。

### 5.4 表现形式选择

表现形式 `presentation_style` 根据成片类型自动推荐默认值，但允许用户改。

默认映射：

| video_type | 默认 presentation_style |
|---|---|
| `ai_comic_drama` | `ai_comic` |
| `culture_promo` | `voiceover_montage` |
| `heritage_promo` | `voiceover_montage` |
| `city_brand_promo` | `voiceover_montage` |
| `lecture_video` | `host_narration` |
| `explainer_video` | `host_narration` |
| `documentary_short` | `documentary` |
| `scene_short` | `cinematic` 或 `documentary` |
| `landscape_mood` | `cinematic` 或 `ink_style` |
| `children_story` | `children_animation` |
| `social_short` | `social_media_fastcut` |
| `historical_drama` | `cinematic` |
| `character_story` | `cinematic` |
| `legend_story` | `cinematic` / `animation_2d` / `ink_style` |

### 5.5 交互流程

```text
用户输入词条
        ↓
点击“预览推荐”
        ↓
右侧显示推荐成片类型、推荐表现形式、可改编事件、文化风险
        ↓
用户选择 video_type
        ↓
presentation_style 自动填默认值
        ↓
用户可手动调整时长和风格
        ↓
点击“生成视频方案”
        ↓
后端生成 full_text / scene_breakdown / gears_segments
```

注意：

- 用户可以手动选择不推荐类型；
- 推荐结果不能限制用户；
- 点击生成时必须把 `video_type` 和 `presentation_style` 一起传后端。

---

## 6. `/api/stories/plan` 调整

### 6.1 新响应结构

```ts
export interface StoryPlanResponse {
  entry_name: string;
  entry_type: string;
  recommended_video_types: RecommendedVideoType[];
  recommended_presentation_styles: RecommendedPresentationStyle[];
  available_events: AvailableEvent[];
  recommended_duration: string;
  cultural_risks: string[];
}
```

```ts
export interface RecommendedVideoType {
  video_type: VideoType;
  label: string;
  reason: string;
  priority: number;
  suitability: 'recommended' | 'optional' | 'not_recommended';
}

export interface RecommendedPresentationStyle {
  presentation_style: PresentationStyle;
  label: string;
  reason: string;
  priority: number;
}
```

### 6.2 条目类型推荐规则

#### 历史人物

推荐：

- `character_story`
- `historical_drama`

可选：

- `lecture_video`
- `documentary_short`
- `ai_comic_drama`

不推荐：

- `culture_promo`，除非人物作为文化精神宣传对象。

#### 非遗 / 传统工艺

推荐：

- `heritage_promo`
- `culture_promo`
- `explainer_video`

可选：

- `documentary_short`
- `social_short`

不推荐：

- `character_story`，除非条目有明确传承人或核心人物。

#### 名胜古迹

推荐：

- `scene_short`
- `landscape_mood`

可选：

- `city_brand_promo`
- `documentary_short`
- `explainer_video`

条件可选：

- `character_story`，仅当条目有明确人物事件。

#### 神话传说 / 民间故事

推荐：

- `legend_story`
- `ai_comic_drama`

可选：

- `children_story`
- `historical_drama`
- `scene_short`

#### 节庆习俗 / 民俗活动

推荐：

- `culture_promo`
- `documentary_short`

可选：

- `social_short`
- `explainer_video`

---

## 7. `/api/stories/generate` 调整

### 7.1 新输入结构

```json
{
  "entry_name": "周敦颐——理学开山鼻祖",
  "video_type": "ai_comic_drama",
  "presentation_style": "ai_comic",
  "selected_event": "南安拒签冤案",
  "target_video_duration": "3分钟",
  "tone": "庄重、紧张、克制",
  "output_gears_segments": true
}
```

### 7.2 旧字段兼容

如果输入：

```json
{
  "generation_type": "character_story"
}
```

后端应映射：

```text
video_type = generation_type
```

### 7.3 输出应包含

```json
{
  "storyId": "",
  "title": "",
  "video_type": "",
  "presentation_style": "",
  "source_entry": "",
  "target_video_duration": "",
  "logline": "",
  "theme": "",
  "full_text": "",
  "scene_breakdown": [],
  "gears_segments": [],
  "gears_segments_url": "",
  "cultural_constraints": [],
  "credibility_note": ""
}
```

---

## 8. 各 `video_type` 输出结构

### 8.1 `character_story` / `historical_drama`

输出：

- `logline`
- `theme`
- `characters`
- `act_structure`
- `protagonist_arc`
- `scene_breakdown`
- `full_text`
- `gears_segments`

重点：

- 主角目标；
- 冲突；
- 阻力；
- 抉择；
- 代价；
- 结尾。

### 8.2 `ai_comic_drama`

输出：

- `comic_title`
- `episode_hook`
- `characters`
- `panels_or_scenes`
- `dialogue_blocks`
- `cliffhanger_or_ending`
- `gears_segments`

每个场景要有：

- 漫画分镜感 `visual_prompt`；
- 人物对白 `dialogue`；
- 情绪表情 `emotion`；
- 镜头/构图 `camera_suggestion`。

### 8.3 `culture_promo` / `heritage_promo` / `city_brand_promo`

输出：

- `core_message`
- `slogan_or_key_sentence`
- `visual_symbols`
- `structure`
- `craft_process` 或 `culture_process`
- `modern_connection`
- `full_text`
- `gears_segments`

重点：

- 文化价值；
- 视觉符号；
- 工艺/仪式过程；
- 当代延续；
- 情绪召唤。

### 8.4 `scene_short` / `landscape_mood`

输出：

- `place_name`
- `spatial_identity`
- `visual_route`
- `time_layer`
- `atmosphere`
- `scene_breakdown`
- `full_text`
- `gears_segments`

重点：

- 空间进入路线；
- 标志性视角；
- 历史回声；
- 氛围结尾。

### 8.5 `documentary_short`

输出：

- `documentary_question`
- `factual_threads`
- `interview_suggestions`
- `visual_evidence`
- `narrative_structure`
- `full_text`
- `gears_segments`

重点：

- 事实；
- 证据；
- 来源；
- 现实连接；
- 少虚构。

### 8.6 `explainer_video`

输出：

- `key_question`
- `explanation_outline`
- `key_terms`
- `examples`
- `visual_explanations`
- `full_text`
- `gears_segments`

重点：

- 讲清楚概念；
- 适合知识科普；
- 结构清楚。

### 8.7 `lecture_video`

输出：

- `central_argument`
- `opening_question`
- `argument_points`
- `examples_from_entry`
- `conclusion`
- `full_text`
- `gears_segments`

重点：

- 观点清楚；
- 适合宣讲；
- 适合课堂；
- 适合文化价值阐释。

### 8.8 `education_training`

输出：

- `learning_objectives`
- `lesson_structure`
- `knowledge_points`
- `quiz_or_reflection`
- `full_text`
- `gears_segments`

重点：

- 教学目标；
- 知识点；
- 步骤化；
- 复盘。

### 8.9 `children_story`

输出：

- `child_friendly_theme`
- `simplified_characters`
- `conflict`
- `warm_resolution`
- `moral_takeaway`
- `full_text`
- `gears_segments`

重点：

- 简单；
- 温和；
- 不恐怖；
- 不血腥；
- 不过度说教。

### 8.10 `social_short`

输出：

- `hook`
- `three_key_points`
- `fastcut_structure`
- `captions`
- `call_to_action`
- `gears_segments`

重点：

- 开头 3 秒钩子；
- 节奏快；
- 字幕明确；
- 适合短视频平台。

---

## 9. GEARS segments 增强

当前 `GearsSegment` 需要增加 `video_type`、`presentation_style` 和 `segment_prompt_hint`。

```ts
export interface GearsSegment {
  segment_id: number;
  source_scene_id: number;
  duration_sec: number;
  panel_count: 4 | 6 | 8 | 9 | 10 | 12;
  script_text: string;
  purpose: string;
  visual_focus: string[];
  cultural_constraints: string[];
  video_type: VideoType;
  presentation_style: PresentationStyle;
  segment_prompt_hint?: string;
}
```

`segment_prompt_hint` 用于提示 GEARS 该段落应偏向：

- 漫画分镜；
- 宣传片视觉；
- 纪录片镜头；
- 宣讲口播；
- 场景氛围；
- 儿童动画；
- 短视频快剪。

---

## 10. 前端展示要求

### 10.1 StoryResult / StoryDetail 顶部

显示：

- 成片类型；
- 表现形式；
- 来源条目；
- 目标时长；
- 生成时间。

### 10.2 场景卡片

通用显示：

- `visual_prompt`
- `camera_suggestion`
- `cultural_note`

不同类型额外显示：

| video_type | 额外显示 |
---|---|
| `ai_comic_drama` | `dialogue` / `emotion` |
| `culture_promo` / `heritage_promo` | `visual_symbols` / `slogan_or_key_sentence` |
| `lecture_video` | `argument_points` |
| `scene_short` / `landscape_mood` | `visual_route` / `atmosphere` |
| `explainer_video` | `key_terms` / `visual_explanations` |
| `documentary_short` | `factual_threads` / `interview_suggestions` |

### 10.3 GEARS 操作区

继续保留：

- 复制完整 `segments JSON`；
- 复制单段 `script_text`；
- 复制单段 JSON；
- 导出 `gears_segments.json`；
- 显示 `gears_segments_url`。

---

## 11. Zod 校验

新增：

```ts
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

`/api/stories/generate` 校验：

- `entry_name` 必填；
- `video_type` 必填，或允许旧字段 `generation_type` 映射；
- `presentation_style` 可选，缺省时按映射自动填；
- `selected_event` 对人物故事/历史剧情/AI 漫剧推荐必填，对宣传片/场景短片可空；
- `target_video_duration` 保持原支持范围；
- `output_gears_segments` 默认 `true`。

---

## 12. 测试要求

### 12.1 `/api/stories/plan`

测试以下条目的推荐是否合理：

#### 周敦颐——理学开山鼻祖

应推荐：

- `character_story`
- `historical_drama`
- `ai_comic_drama`
- 可选 `lecture_video`

#### 湘绣——中国四大名绣之一

应推荐：

- `heritage_promo`
- `culture_promo`
- `explainer_video`
- 可选 `documentary_short`

#### 岳阳楼——先忧后乐的精神地标

应推荐：

- `scene_short`
- `city_brand_promo`
- `documentary_short`
- 可选 `explainer_video`

### 12.2 `/api/stories/generate`

至少测试：

- `video_type=ai_comic_drama`
- `video_type=culture_promo`
- `video_type=scene_short`
- `video_type=lecture_video`
- `video_type=explainer_video`

### 12.3 前端测试

必须验证：

- StoryStudio 页面出现成片类型选择区；
- 选择不同 `video_type` 后，请求 payload 包含 `video_type`；
- 请求 payload 包含 `presentation_style`；
- 右侧推荐结果能显示推荐类型；
- 用户可以手动选择不推荐类型；
- 生成结果能显示成片类型和表现形式。

### 12.4 GEARS segments 测试

每个 segment 必须包含：

- `script_text`
- `video_type`
- `presentation_style`
- `segment_prompt_hint`

---

## 13. 不做事项

第一阶段不要做：

- 不接真实视频生成；
- 不自动发送到 `grears v2` 创建 recipe；
- 不做用户认证；
- 不做数据库迁移；
- 不做商业级视频模板库；
- 不改写知识库事实条目。

先打通：

```text
Web 端类型选择
        ↓
API 字段
        ↓
生成结构
        ↓
前端展示
        ↓
测试
```

---

## 14. 分阶段执行计划

15 种 `VideoType` + 11 种 `PresentationStyle` 不可能一步到位。建议分 3 个阶段递进实现：

### Phase 2A：类型系统框架（优先级最高）

**目标**：把 v0.1 的 3 类型升级为 15 类型框架，不改输出结构。

| 工作项 | 说明 |
|--------|------|
| 新增 `VideoType` 和 `PresentationStyle` 类型 | `shared/types.ts` |
| 新增 Zod schemas | `shared/schemas.ts` |
| 旧字段兼容 | `generation_type` → `video_type` 映射，旧 story 不崩 |
| 扩展 `TYPE_GENERATION_ROUTING` | 11 条目类型 → 15 video_type + suitability |
| 更新 `/api/stories/plan` | 返回 `recommended_video_types` + `recommended_presentation_styles` |
| 更新 `/api/stories/generate` | 输入支持 `video_type` + `presentation_style` + 旧字段兼容 |
| StoryStudio 成片类型分组 UI | 4 组卡片 + `presentation_style` 选择 |
| StoryResult 顶部显示 `video_type` + `presentation_style` | 替代 `generation_type` |

**此阶段不做的**：不实现 12 种新类型的专属输出结构。新类型（如 `heritage_promo`）的 generate 输出沿用 `culture_promo` 结构，只是 `video_type` 字段值不同。

### Phase 2B：核心新类型专属输出

**目标**：实现 5 个最常用新类型的专属输出结构。

| video_type | 专属字段 |
|------------|---------|
| `ai_comic_drama` | `comic_title`, `episode_hook`, `dialogue_blocks`, `cliffhanger_or_ending` |
| `heritage_promo` | `core_message`, `slogan_or_key_sentence`, `craft_process` |
| `documentary_short` | `documentary_question`, `factual_threads`, `interview_suggestions` |
| `lecture_video` | `central_argument`, `opening_question`, `argument_points`, `conclusion` |
| `explainer_video` | `key_question`, `explanation_outline`, `key_terms`, `examples` |

每个类型还需：
- StoryResult 的类型专属渲染区块
- gears_segments 的 `segment_prompt_hint` 按类型区分

### Phase 2C：其余类型 + 优化

**目标**：补齐剩余 7 种类型 + 前端优化。

| video_type | 专属字段 |
|------------|---------|
| `historical_drama` | 沿用 `character_story` 结构 + 史实锚点字段 |
| `legend_story` | 沿用 `character_story` 结构 + 神异元素字段 |
| `children_story` | `child_friendly_theme`, `simplified_characters`, `warm_resolution`, `moral_takeaway` |
| `city_brand_promo` | 沿用 `culture_promo` 结构 + 地理识别字段 |
| `social_short` | `hook`, `three_key_points`, `fastcut_structure`, `call_to_action` |
| `landscape_mood` | 沿用 `scene_short` 结构 + `atmosphere` 字段 |
| `education_training` | `learning_objectives`, `lesson_structure`, `knowledge_points`, `quiz_or_reflection` |

---

## 15. Claude Code 执行命令

### Phase 2A 执行命令（类型系统框架）

```text
请根据 `开发文档/china-culture-kb_video_type_generation_system_dev_doc.md` Phase 2A 部分实现类型系统框架升级。

背景：v0.1 已实现 3 类型 generation_type 系统（character_story / culture_promo / scene_short），generate 时从 KB 条目自动填充 full_text / scene_breakdown / gears_segments。26 个 API 测试全通过。

Phase 2A 目标：把 3 类型升级为 15 类型 VideoType + 11 PresentationStyle 双层框架，不实现新类型专属输出结构。

执行要求：

1. web/shared/types.ts
   - 新增 VideoType（15 值）和 PresentationStyle（11 值）
   - 新增 RecommendedVideoType（含 video_type, label, suitability）
   - 新增 RecommendedPresentationStyle
   - 更新 StoryGenerateRequest：支持 video_type + presentation_style + 旧 generation_type 兼容
   - 更新 StoryGenerateResult：新增 video_type + presentation_style 字段
   - 更新 GearsSegment：新增 video_type + presentation_style + segment_prompt_hint
   - 更新 TypeInfo：recommended_generation_types 改为 recommended_video_types
   - 保留旧 GenerationType 和 RecommendedType 不删除（向后兼容）

2. web/shared/schemas.ts
   - 新增 VideoTypeSchema 和 PresentationStyleSchema
   - 更新 StoryGenerateRequestSchema：video_type 或 generation_type 二选一必填
   - presentation_style 可选缺省

3. web/server/src/services/story-service.ts
   - 扩展 TYPE_GENERATION_ROUTING 为 VIDEO_TYPE_ROUTING（11 条目类型 → 15 video_type + suitability）
   - planStory 返回 recommended_video_types + recommended_presentation_styles
   - generateAndStoreStory 输入支持 video_type + presentation_style + generation_type 兼容映射
   - 新类型沿用旧类型输出结构（heritage_promo → culture_promo 结构）
   - gears_segments 每段带 video_type + presentation_style + segment_prompt_hint
   - 新增 15 种目录扫描（listStories）

4. web/client/src/views/StoryStudio.vue
   - 成片类型分组选择区（4 组卡片：剧情故事 / 宣传推广 / 讲解教育 / 场景空间）
   - presentation_style 选择（自动默认 + 可手动调）
   - 生成按钮改为”生成视频方案”
   - payload 含 video_type + presentation_style

5. web/client/src/components/StoryPlan.vue
   - 展示 recommended_video_types（含 suitability 标签）
   - 展示 recommended_presentation_styles

6. web/client/src/components/StoryResult.vue
   - 顶部显示 video_type + presentation_style
   - gears_segments 展示 segment_prompt_hint

7. 旧数据兼容
   - 旧 story 只有 generation_type → 前端映射为 video_type 显示
   - 旧 story 详情页不崩溃

8. 测试
   - plan 测周敦颐、湘绣、岳阳楼推荐是否包含 15 类型
   - generate 测 video_type + presentation_style
   - 旧 generation_type 兼容
   - gears_segments 含 video_type + presentation_style + segment_prompt_hint

不要做：不实现新类型专属输出结构、不接视频生成、不改知识库条目
```

### Phase 2B / 2C 执行命令（后续阶段）

Phase 2B 和 2C 在 Phase 2A 完成后再执行，每次只做 3-5 个类型。命令结构同上，但 `执行要求` 只列对应阶段的新类型专属字段和前端渲染。

---

## 16. 最终结论

当前系统不能再只有一个“生成故事”按钮。

应改为：

```text
生成视频方案
```

因为系统未来要支持：

- 剧情故事；
- 宣传片；
- AI 漫剧；
- 宣讲片；
- 场景短片；
- 微纪录；
- 知识讲解；
- 竖屏短视频。

最终产品目标：

```text
文化知识库
  ↓
多类型文化视频方案生成
  ↓
GEARS 分段脚本与分镜生产
```

