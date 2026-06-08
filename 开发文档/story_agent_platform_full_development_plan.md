# Story Agent Platform 全量开发计划

> 版本：v0.1  
> 日期：2026-06-08  
> 面向执行者：Claude Code  
> 当前基础：`D:/china-culture-kb` Web v1  
> 下游系统：`D:/grears v2`  
> 目标：在保留现有 `china-culture-kb` 成果的基础上，升级为支持中国文化、警察/法治故事、小说改编等多领域的通用故事创作 Agent 平台，并补齐“多成片类型 + 表现形式”的视频方案生成系统。

---

## 1. 总体目标

当前项目已经完成 `china-culture-kb Web v1`：

- 知识库条目浏览；
- 条目搜索；
- 故事生成工作台；
- `/plan → /generate → /gears-segments`；
- 基础故事详情页；
- GEARS segments 输出；
- 初步支持人物故事、文化宣传片、场景短片。

新的目标是把它升级为：

```text
通用故事创作 Agent 平台
```

支持：

1. 中国文化故事；
2. 警察 / 法治 / 反诈 / 基层警务故事；
3. 小说改编成短剧、AI 漫剧、视频故事；
4. 宣传片、宣讲片、场景短片、微纪录、讲解视频、儿童故事、竖屏短视频等多种成片类型；
5. 统一输出给 `grears v2` 的 `gears_segments`。

---

## 2. 核心架构原则

### 2.1 不要继续把所有东西塞进 china-culture-kb

`china-culture-kb` 原本定位是中国传统文化知识库，不适合直接塞入：

- 警察故事；
- 反诈案例；
- 法治宣讲；
- 小说改编；
- 工业故事；
- 其他垂直题材。

否则会造成：

- 命名不准确；
- 数据结构混乱；
- 安全规则混乱；
- 版权规则混乱；
- prompt 互相污染；
- 后续难以维护。

### 2.2 不要做多个完全孤立的 Agent

也不建议拆成：

```text
china-culture-agent
police-agent
novel-agent
```

完全孤立会导致：

- 前端重复；
- GEARS 对接重复；
- 成片类型重复；
- 安全审查重复；
- segments schema 重复；
- 用户体验割裂。

### 2.3 推荐方案：统一平台 + Domain Pack

最佳方案：

```text
Story Agent Platform
  ├─ story-core
  ├─ video-type-core
  ├─ safety-core
  ├─ knowledge-core
  ├─ gears-exporter
  └─ domains/
      ├─ china-culture
      ├─ police-story
      └─ novel-adaptation
```

当前 `china-culture-kb` 是第一个领域模块，不废弃，只是逐步平台化。

---

## 3. 总体阶段规划

推荐阶段：

```text
阶段 0：冻结当前成果
阶段 1：平台级设计文档
阶段 2：多成片类型系统升级
阶段 3：平台抽象类型与 Domain Pack 边界
阶段 4：中国文化 Domain Pack 适配
阶段 5：生成质量增强
阶段 6：警察故事领域设计
阶段 7：小说改编领域设计
阶段 8：扩展平台 video_type 到警察/小说
阶段 9：警察故事 MVP
阶段 10：小说改编 MVP
阶段 11：grears v2 深度接入
阶段 12：统一故事 Agent 工作台产品化
阶段 13：内容管理、版本与审核
```

其中，**多成片类型系统升级必须前置到阶段 2**，因为它是所有后续领域共用的生成能力。

---

## 阶段 0：冻结当前成果

### 目标

保存当前 `china-culture-kb Web v1`，确保后续平台化改动可以回滚。

### 任务

- 检查 git 状态；
- 运行测试；
- 提交当前成果；
- push 到 GitHub；
- 打 checkpoint tag；
- 创建新分支。

### 给 Claude 的命令

```text
在进入平台化开发前，请先冻结当前 china-culture-kb Web v1 状态。

请执行：

1. git status
2. 检查是否有不应该提交的文件：
   - node_modules
   - dist
   - 临时日志
   - 大文件
   - .env
3. 运行现有测试和构建：
   - API tests
   - 前端 build
   - vue-tsc 类型检查
4. 如果没有问题，提交当前代码：

git add .
git commit -m "checkpoint: china-culture web v1 before story platform expansion"

5. 推送到 GitHub 当前分支。
6. 打 tag：

checkpoint-2026-06-08-china-culture-web-v1

7. 推送 tag。
8. 创建新分支：

story-platform-planning

9. 推送新分支。

完成后输出：
- 当前分支
- commit hash
- tag 名称
- 测试结果
- git status 是否干净

注意：如果发现 .env、node_modules、dist 或大文件要被提交，先停下来告诉我，不要提交。
```

### 验收标准

- GitHub 上有 checkpoint commit；
- GitHub 上有 tag；
- 新分支已创建；
- 工作区干净。

---

## 阶段 1：平台级设计文档

### 目标

先设计平台架构，不急着改业务代码。

### 输出

```text
docs/platform/story-agent-platform-roadmap.md
```

### 给 Claude 的命令

```text
现在项目目标升级：不再局限于 china-culture-kb 中国传统文化知识库，而是要扩展成一个通用故事创作 Agent 平台。

支持领域包括：
1. 中国文化故事
2. 警察/法治/反诈/基层警务故事
3. 小说改编成短剧、AI 漫剧、视频故事
4. 后续更多领域扩展

请不要改业务代码，先写平台级架构设计文档。

请创建文档：
docs/platform/story-agent-platform-roadmap.md

文档必须包含：

1. 当前 china-culture-kb Web v1 的现状总结
2. 为什么不能把警察故事、小说改编直接塞进 china-culture-kb
3. 为什么也不建议做多个完全孤立 agent
4. 推荐方案：统一平台 + Domain Pack 领域插件
5. 平台目录结构设计
6. 主控 Agent + 子 Agent 设计：
   - Story Orchestrator Agent
   - ChinaCulture Agent
   - PoliceStory Agent
   - NovelAdaptation Agent
   - VideoType Planner Agent
   - Safety Review Agent
   - GEARS Export Agent
7. 统一数据模型：
   - DomainPack
   - KnowledgeEntry
   - StorySource
   - AdaptationPlan
   - VideoType
   - PresentationStyle
   - GearsSegment
   - SafetyProfile
8. 三个首批 Domain Pack：
   - china_culture
   - police_story
   - novel_adaptation
9. 警察故事模块的数据结构和安全规则
10. 小说改编模块的数据结构和版权规则
11. 中国文化模块如何从现有 china-culture-kb 平滑迁移
12. 与 grears v2 的统一对接方式
13. 分阶段开发路线
14. 风险与回滚策略
15. 第一阶段禁止事项：不要大规模重构，不要迁移数据，不要破坏现有 Web v1

写完后先让我 review，不要继续实现。
```

### 验收标准

- 文档存在；
- 设计清楚说明“平台 + 领域插件”；
- 不发生代码重构。

---

## 阶段 2：多成片类型系统升级

### 目标

把当前“生成故事”升级为“生成视频方案”，支持多种成片类型和表现形式。

这是当前最重要的功能阶段。

### 2.1 新增核心概念

```text
video_type           成片类型
presentation_style   表现形式
```

不要继续只使用粗粒度 `generation_type`。

### 2.2 新增 VideoType

```ts
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
```

### 2.3 新增 PresentationStyle

```ts
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

### 2.4 成片类型分组

#### 剧情故事类

- 人物故事 `character_story`
- 历史剧情短片 `historical_drama`
- 神话/民间传说故事 `legend_story`
- AI 漫剧 `ai_comic_drama`
- 儿童故事片 `children_story`

#### 宣传推广类

- 文化宣传片 `culture_promo`
- 非遗/工艺宣传片 `heritage_promo`
- 城市/地方文旅宣传片 `city_brand_promo`
- 竖屏短视频 `social_short`

#### 讲解教育类

- 微纪录片 `documentary_short`
- 知识讲解视频 `explainer_video`
- 宣讲片/观点阐释片 `lecture_video`
- 教育/培训片 `education_training`

#### 场景空间类

- 场景短片 `scene_short`
- 山水意境片 `landscape_mood`

### 2.5 前端 StoryStudio 改造

左侧表单顺序改成：

```text
1. 词条名称
2. 预览推荐
3. 成片类型 video_type
4. 表现形式 presentation_style
5. 目标时长
6. 叙事/表达风格 tone
7. 生成视频方案
```

按钮名称从：

```text
生成故事
```

改为：

```text
生成视频方案
```

### 2.6 API 调整

`/api/stories/plan` 返回：

```ts
interface StoryPlanResponse {
  entry_name: string;
  entry_type: string;
  recommended_video_types: RecommendedVideoType[];
  recommended_presentation_styles: RecommendedPresentationStyle[];
  available_events: AvailableEvent[];
  recommended_duration: string;
  cultural_risks: string[];
}
```

`/api/stories/generate` 输入：

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

兼容旧字段：

```text
如果只有 generation_type，则映射为 video_type。
```

### 2.7 GEARS Segment 增强

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

### 给 Claude 的命令

```text
请根据 docs/platform/story-agent-platform-roadmap.md 和当前 Web v1，实现阶段 2：多成片类型视频方案生成系统。

核心目标：
当前生成界面缺少“成片类型”选择。请新增 video_type + presentation_style 两层选择，让用户可以选择人物故事、历史剧情短片、神话传说、文化宣传片、非遗宣传片、城市文旅宣传片、场景短片、山水意境片、微纪录片、知识讲解视频、宣讲片、教育培训片、儿童故事、竖屏短视频、AI 漫剧等类型。

执行要求：

1. 修改 web/shared/types.ts
   - 新增 VideoType
   - 新增 PresentationStyle
   - 更新 StoryGenerateRequest
   - 更新 GearsSegment，增加 video_type、presentation_style、segment_prompt_hint
   - 兼容旧 generation_type

2. 修改 web/shared/schemas.ts
   - 新增 VideoTypeSchema
   - 新增 PresentationStyleSchema
   - 更新 /api/stories/generate 的 Zod 校验

3. 修改 /api/stories/plan
   - 返回 recommended_video_types
   - 返回 recommended_presentation_styles
   - 按条目类型推荐不同 video_type
   - 旧 recommended_types 可保留兼容，但前端应使用 recommended_video_types

4. 修改 /api/stories/generate
   - 输入支持 video_type 和 presentation_style
   - 如果只有 generation_type，映射到 video_type
   - 如果 presentation_style 缺省，按 video_type 自动给默认值
   - 不同 video_type 输出不同结构
   - gears_segments 每段带 video_type、presentation_style、segment_prompt_hint

5. 修改 StoryStudio.vue
   - 在目标时长上方新增“成片类型”选择区
   - 按四组展示：剧情故事类、宣传推广类、讲解教育类、场景空间类
   - 每个类型用卡片展示中文名、说明、推荐时长、适合条目类型、推荐状态
   - 新增 presentation_style 选择
   - 点击生成时把 video_type 和 presentation_style 一起传后端
   - 主按钮改名为“生成视频方案”

6. 修改 StoryResult.vue / StoryDetail.vue
   - 顶部显示 video_type 和 presentation_style
   - 场景卡片显示 visual_prompt / camera_suggestion / cultural_note
   - AI 漫剧显示 dialogue / emotion
   - 宣传片显示 visual_symbols / slogan_or_key_sentence
   - 宣讲片显示 argument_points
   - 场景短片显示 visual_route / atmosphere
   - GEARS segments 展示 segment_prompt_hint

7. 测试
   - /api/stories/plan 测周敦颐、湘绣、岳阳楼
   - /api/stories/generate 测 ai_comic_drama、culture_promo、scene_short、lecture_video、explainer_video
   - 前端 StoryStudio 必须出现成片类型选择区
   - 请求 payload 必须包含 video_type 和 presentation_style
   - gears_segments 每段必须包含 video_type、presentation_style、segment_prompt_hint

8. 不要做
   - 不接真实视频生成
   - 不自动发送到 grears v2 创建 recipe
   - 不做数据库迁移
   - 不做用户认证

完成后请输出：
   - 修改文件列表
   - 测试结果
   - 前端验收方式
```

### 验收标准

- StoryStudio 有成片类型选择区；
- 支持 15 个 video_type；
- 支持 presentation_style；
- generate 请求包含 `video_type` 和 `presentation_style`；
- GEARS segments 包含 `segment_prompt_hint`；
- 旧数据不崩溃。

---

## 阶段 3：平台抽象类型与 Domain Pack 边界

### 目标

在不大规模重构的前提下，新增平台级类型，为后续警察和小说领域做准备。

### 输出

```text
web/shared/platform-types.ts
web/shared/domain-types.ts
docs/platform/domain-pack-spec.md
```

### 给 Claude 的命令

```text
现在开始阶段 3：平台抽象类型与 Domain Pack 边界。

注意：
不要移动现有目录。
不要重命名 china-culture-kb。
不要破坏现有 Web 功能。

请新增：

1. web/shared/platform-types.ts
2. web/shared/domain-types.ts
3. docs/platform/domain-pack-spec.md

定义以下类型：
- DomainPack
- DomainId
- StorySource
- KnowledgeEntryBase
- AdaptationPlan
- SafetyProfile
- SafetyRule
- DomainGenerationCapability
- DomainMaterialExtractor
- DomainPromptProfile

要求：
- 保持现有 video_type、presentation_style、gears_segments 类型兼容
- 当前 china_culture 作为第一个内置 DomainPack，先只在类型层表达
- 不搬迁 data/provinces
- 不改变现有 API 返回
- 所有新增类型必须通过 TypeScript 检查

运行：
- vue-tsc
- API tests
- frontend build

完成后输出：
- 新增文件列表
- 修改文件列表
- 类型设计说明
- 测试结果
```

### 验收标准

- 类型新增；
- 不破坏现有功能；
- 测试通过。

---

## 阶段 4：中国文化 Domain Pack 适配

### 目标

把当前中国文化生成能力包装成第一个领域插件。

### 输出目录

```text
web/server/domains/china-culture/
```

### 给 Claude 的命令

```text
现在开始阶段 4：把现有中国文化故事生成能力适配为第一个 Domain Pack。

请新增目录：
web/server/domains/china-culture/

实现：
- index.ts
- metadata.ts
- extractor.ts
- planner.ts
- prompts.ts
- safety.ts

china-culture DomainPack 需要声明：
- domain_id: china_culture
- 支持的 entry types
- 支持的 video_type
- 默认 presentation_style
- 文化风险规则
- 影视化素材提取逻辑

要求：
- 现有 /api/stories/plan 和 /api/stories/generate 继续工作
- 可以在内部逐步改为调用 china-culture domain pack
- 外部 API 返回不能变
- 不移动 data/provinces
- 不删除旧 service，必要时保留 adapter

测试：
- 周敦颐
- 湘绣
- 岳阳楼
- ai_comic_drama
- culture_promo
- scene_short

完成后输出：
- DomainPack 实现说明
- 哪些逻辑被迁移
- API 是否保持兼容
- 测试结果
```

### 验收标准

- 中国文化作为 DomainPack 可被内部调用；
- 外部 API 兼容；
- 现有功能不退化。

---

## 阶段 5：生成质量增强

### 目标

让每种 `video_type` 的输出更像对应成片类型，而不是泛泛而谈。

### 要做

- 每种 video_type 独立 prompt 模板；
- 每种类型独立结构校验；
- 防空内容；
- 防百科腔；
- 防宣传片只有口号；
- 防 AI 漫剧没有对白；
- 防场景短片没有空间路线；
- 支持重新生成某一段；
- 支持只重写 `gears_segments`；
- 支持调整风格后再生成。

### 给 Claude 的命令

```text
现在开始阶段 5：生成质量增强。

目标：
让不同 video_type 的输出明显不同，并且更符合成片需求。

请实现：

1. 为以下类型建立独立 prompt profile：
   - character_story
   - historical_drama
   - ai_comic_drama
   - culture_promo
   - heritage_promo
   - scene_short
   - documentary_short
   - explainer_video
   - lecture_video
   - social_short

2. 每种类型定义结构要求：
   - 必填字段
   - 禁止输出模式
   - 质量校验规则

3. 增加生成质量校验：
   - full_text 不为空
   - scene_breakdown 不为空
   - gears_segments 不为空
   - visual_prompt 不为空
   - camera_suggestion 不为空
   - ai_comic_drama 必须有 dialogue / emotion
   - culture_promo 必须有 visual_symbols / core_message
   - scene_short 必须有 visual_route / atmosphere
   - lecture_video 必须有 argument_points

4. 前端若生成质量不达标，显示错误提示或建议重新生成。

5. 增加重新生成能力设计：
   - 先实现“重新生成全部”
   - 文档预留“重新生成单段”

测试：
- 每个重点 video_type 至少一个测试
- 质量校验失败时返回 VALIDATION_ERROR

完成后输出：
- 新增 prompt profile 列表
- 质量规则列表
- 测试结果
```

### 验收标准

- 不同类型输出差异明显；
- 关键字段不空；
- 生成质量失败能提示。

---

## 阶段 6：警察故事领域设计

### 目标

先设计警察领域，不急着实现。

### 输出

```text
docs/domains/police-story-domain-design.md
```

### 给 Claude 的命令

```text
现在开始阶段 6：设计 police-story 警察故事领域。

请新增文档：
docs/domains/police-story-domain-design.md

文档必须包含：

1. 领域目标
   - 警察人物故事
   - 反诈短视频
   - 法治宣讲片
   - 基层警务故事
   - 案例警示片
   - 警民关系故事

2. 不做事项
   - 不指导犯罪
   - 不暴露侦查技术细节
   - 不复刻真实敏感案件
   - 不暴露个人隐私
   - 不渲染血腥暴力

3. 条目类型
   - 刑侦
   - 反诈
   - 禁毒
   - 交警
   - 基层派出所
   - 社区警务
   - 特警应急
   - 法治宣传
   - 警察人物

4. 数据结构
   - PoliceStoryEntry
   - PoliceCaseSource
   - PoliceSafetyProfile
   - LawPoint
   - PrivacyConstraint
   - AdaptationBoundary

5. 安全规则
   - 真实案例匿名化
   - 地点模糊化
   - 人物合成化
   - 程序合法性
   - 未成年人保护
   - 不提供违法规避方法
   - 不提供详细作案步骤

6. 支持的 video_type
   - police_case_drama
   - legal_awareness_video
   - anti_fraud_short
   - documentary_short
   - lecture_video
   - education_training
   - ai_comic_drama

7. 示例
   - 反诈短视频
   - 基层民警人物故事
   - 法治宣讲片

8. 与 Safety Review Agent 的关系
9. 与 GEARS segments 的输出格式
10. 第一阶段 police-story 只做虚构/脱敏案例，不接真实敏感案件

写完后等待我 review，不要实现代码。
```

### 验收标准

- 安全边界清楚；
- 不直接实现。

---

## 阶段 7：小说改编领域设计

### 目标

设计小说改编领域，先处理版权规则。

### 输出

```text
docs/domains/novel-adaptation-domain-design.md
```

### 给 Claude 的命令

```text
现在开始阶段 7：设计 novel-adaptation 小说改编领域。

请新增文档：
docs/domains/novel-adaptation-domain-design.md

文档必须包含：

1. 领域目标
   - 小说改短剧
   - 小说改 AI 漫剧
   - 章节改分镜
   - 小说大纲改 3分钟短片
   - 预告片/PV
   - 分集大纲

2. 支持来源
   - 用户原创
   - 已授权文本
   - 公版作品
   - 用户自写大纲
   - 未授权作品只能做有限摘要和结构分析

3. 版权规则
   - 不大段复刻原文
   - 不照搬商业 IP 原句
   - 不输出受版权保护文本的详细改写版本，除非用户声明有授权
   - 对未知版权状态做风险提示
   - 输出偏结构化改编，不输出侵权复刻

4. 类型结构
   - NovelSource
   - NovelChapter
   - NovelCharacter
   - NovelWorldbuilding
   - NovelAdaptationPlan
   - RightsProfile
   - AdaptationRisk

5. 支持 genre
   - 男频爽文
   - 女频情感
   - 悬疑推理
   - 刑侦悬疑
   - 都市现实
   - 玄幻修仙
   - 奇幻冒险
   - 科幻
   - 历史架空
   - 武侠
   - 校园青春
   - 儿童故事

6. 支持 video_type
   - novel_adaptation_drama
   - ai_comic_drama
   - episode_outline
   - trailer_pv
   - social_short
   - character_story

7. 输出结构
   - 改编定位
   - 人物关系
   - 分集结构
   - 场景拆分
   - 漫剧分镜
   - GEARS segments

8. Safety Review Agent 如何处理版权风险
9. 第一阶段只支持用户原创/用户粘贴大纲/公版作品，不处理未授权商业小说全文改编

写完后等待我 review，不要实现代码。
```

### 验收标准

- 版权边界清楚；
- 不直接实现。

---

## 阶段 8：扩展平台 video_type 到警察/小说

### 目标

先把警察和小说相关成片类型加入类型系统和 UI，但暂不实现生成。

### 新增 VideoType

```ts
| 'police_case_drama'
| 'legal_awareness_video'
| 'anti_fraud_short'
| 'novel_adaptation_drama'
| 'episode_outline'
| 'trailer_pv'
```

### 给 Claude 的命令

```text
现在开始阶段 8：扩展平台 video_type 到警察和小说领域，但只做类型和 UI 支持，不实现生成逻辑。

请修改：

1. web/shared/types.ts
新增：
- police_case_drama
- legal_awareness_video
- anti_fraud_short
- novel_adaptation_drama
- episode_outline
- trailer_pv

2. web/shared/schemas.ts
同步更新 Zod schema。

3. StoryStudio 成片类型选择区增加两个领域分组：

警察/法治类：
- 警察案件短剧 police_case_drama
- 反诈短视频 anti_fraud_short
- 法治宣讲片 legal_awareness_video

小说改编类：
- 小说改编短剧 novel_adaptation_drama
- AI 漫剧 ai_comic_drama
- 分集大纲 episode_outline
- 预告/PV trailer_pv

4. 新增类型第一阶段标记为“规划中”或 disabled，除非对应 domain 已启用。

5. 不破坏现有 china_culture 生成。

测试：
- StoryStudio 能显示新增类型
- disabled 状态正确
- 旧类型仍可生成
- Zod 校验通过

完成后输出修改文件和测试结果。
```

### 验收标准

- 新类型可见；
- 禁用状态正确；
- 旧功能不坏。

---

## 阶段 9：警察故事 MVP

### 目标

实现低风险警察故事 MVP。

首批只做：

- 反诈短视频；
- 法治宣讲片；
- 脱敏虚构案例短剧。

### 给 Claude 的命令

```text
现在开始阶段 9：实现 police-story MVP。

只做低风险类型：
1. anti_fraud_short 反诈短视频
2. legal_awareness_video 法治宣讲片
3. police_case_drama 脱敏虚构案例短剧

请实现：

1. 新增目录：
web/server/domains/police-story/

2. 实现：
- metadata.ts
- safety.ts
- planner.ts
- prompts.ts
- generator.ts
- index.ts

3. 新增 mock 数据目录：
web/sample-data/police-story/

至少放 3 个样例：
- 反诈案例
- 社区民警故事
- 法治宣讲主题

4. 所有样例必须是虚构/脱敏，不使用真实姓名、真实地址、真实警号。

5. 生成输出必须包含：
- safety_profile
- privacy_constraints
- law_points
- adaptation_boundary
- gears_segments

6. Safety 校验必须阻止：
- 详细作案步骤
- 规避执法方法
- 真实个人隐私
- 血腥暴力渲染

7. 前端 StoryStudio 支持选择 domain=police_story。
8. API 支持 police_story 输入来源。

测试：
- anti_fraud_short
- legal_awareness_video
- police_case_drama

完成后输出：
- 实现说明
- 样例说明
- 安全规则说明
- 测试结果
```

### 验收标准

- 不输出危险内容；
- 可生成低风险警察故事；
- GEARS segments 正常。

---

## 阶段 10：小说改编 MVP

### 目标

实现小说改编 MVP，只支持用户原创/授权/公版/大纲。

### 给 Claude 的命令

```text
现在开始阶段 10：实现 novel-adaptation MVP。

只支持用户原创文本或用户自写大纲，不处理未授权商业小说全文。

请实现：

1. 新增目录：
web/server/domains/novel-adaptation/

2. 实现：
- metadata.ts
- rights.ts
- planner.ts
- prompts.ts
- generator.ts
- index.ts

3. 前端 StoryStudio 新增输入方式：
- 知识库条目
- 警察案例
- 小说大纲/原创文本

4. novel 输入表单包含：
- title
- rights_status: 用户原创 / 已授权 / 公版 / 未知
- genre
- synopsis
- characters
- source_text 或 outline

5. 如果 rights_status=未知：
- 只能输出结构分析和原创化改编建议
- 不输出贴近原文的详细改写

6. 支持生成：
- novel_adaptation_drama
- ai_comic_drama
- episode_outline
- trailer_pv

7. 输出必须包含：
- rights_profile
- adaptation_plan
- character_map
- scene_breakdown
- gears_segments
- copyright_warning

8. 测试：
- 用户原创大纲 → AI 漫剧
- 用户原创短篇 → 3分钟短剧
- 未知版权 → 只输出结构分析和风险提示

完成后输出修改文件和测试结果。
```

### 验收标准

- 版权风险规则生效；
- 用户原创内容可改编；
- 未知版权不生成侵权式改写。

---

## 阶段 11：grears v2 深度接入

### 目标

让 GEARS 不只是复制 JSON，而是能直接拉取和消费。

### 输出

```text
docs/integrations/gears-v2-story-agent-integration.md
```

### 给 Claude 的命令

```text
现在开始阶段 11：设计 grears v2 深度接入第一版。

请先写对接文档：
docs/integrations/gears-v2-story-agent-integration.md

文档包含：

1. API 端点
2. gears_segments schema
3. story project schema
4. segment 到 GEARS recipe 的映射
5. character_suggestions
6. scene_suggestions
7. visual_focus 和 segment_prompt_hint 如何传给 GEARS
8. 错误处理
9. CORS / auth 预留
10. 手动导入和自动导入两种模式

文档写完后先让我 review，不要直接改 grears v2。
```

### 验收标准

- 接入文档清楚；
- 不直接改 GEARS。

---

## 阶段 12：统一故事 Agent 工作台产品化

### 目标

前端从“中国文化知识库”升级为“故事 Agent 工作台”。

### 输出

```text
docs/platform/story-agent-workspace-ui-design.md
```

### 给 Claude 的命令

```text
现在开始阶段 12：设计统一故事 Agent 工作台。

请写文档：
docs/platform/story-agent-workspace-ui-design.md

文档包含：

1. 首页改造：
   - 不再只叫中国传统文化知识库
   - 改为故事 Agent 工作台
   - 支持领域选择

2. 领域选择：
   - 中国文化
   - 警察故事
   - 小说改编

3. 输入方式：
   - 知识库条目
   - 案例素材
   - 小说大纲
   - 自定义主题

4. 成片类型：
   - 宣传片
   - 短剧
   - AI 漫剧
   - 宣讲片
   - 微纪录
   - 讲解视频
   - 场景短片

5. 输出区：
   - 完整故事
   - 分场结构
   - GEARS segments
   - 安全/版权/文化风险
   - 导出到 GEARS

6. 历史记录和项目管理

7. 第一阶段如何在不破坏现有 UI 的情况下逐步改造

写完后等我 review。
```

### 验收标准

- UI 平台化方向清楚；
- 不立即大改前端。

---

## 阶段 13：内容管理、版本与审核

### 目标

产品化管理生成内容。

### 要做

- 生成历史；
- 收藏；
- 编辑；
- 版本管理；
- 审核状态；
- 风险标记；
- 导出 Markdown / JSON；
- 导出给 GEARS；
- 项目级管理。

### 给 Claude 的命令

```text
现在设计内容管理、版本与审核阶段。

请写文档：
docs/platform/content-management-and-review-design.md

文档包含：

1. 生成历史
2. 故事项目
3. 版本管理
4. 审核状态
5. 文化风险 / 警务风险 / 版权风险标记
6. 人工编辑
7. 导出 Markdown / JSON / GEARS segments
8. 回滚机制
9. 未来数据库设计

先写文档，不实现代码。
```

### 验收标准

- 内容管理方向清楚；
- 不影响现有生成链路。

---

## 4. 当前最推荐执行顺序

你现在最应该做：

```text
阶段 0 → 阶段 1 → 阶段 2
```

也就是：

1. 冻结当前成果；
2. 写平台级 roadmap；
3. 实现多成片类型系统升级。

不要急着做警察和小说代码。

警察、小说属于新领域，需要先做设计和边界。

---

## 5. 当前给 Claude 的最优命令

如果你现在还没有冻结当前成果，先执行阶段 0。

如果已经冻结，直接执行：

```text
当前 china-culture-kb Web v1 和已有故事生成能力先暂停扩展。

请开始阶段 1：创建平台级规划文档。

输出文件：
docs/platform/story-agent-platform-roadmap.md

目标是把当前项目升级为通用故事创作 Agent 平台，支持：
1. 中国文化故事
2. 警察/法治/反诈/基层警务故事
3. 小说改编成短剧、AI 漫剧、视频故事
4. 后续更多领域扩展

请按以下要求写文档：
- 分析当前 china-culture-kb Web v1 现状
- 说明为什么不能把警察故事和小说改编直接塞进 china-culture-kb
- 说明为什么也不建议做多个完全孤立 agent
- 设计统一平台 + Domain Pack 插件化架构
- 设计主控 Agent + 领域子 Agent
- 设计统一数据模型
- 设计 china_culture / police_story / novel_adaptation 三个首批领域
- 设计警察故事安全规则
- 设计小说改编版权规则
- 设计和 grears v2 的统一对接
- 给出分阶段迁移路线
- 明确第一阶段不要大规模重构，只先做文档和抽象边界

写完后停止，等我 review，不要改业务代码。
```

---

## 6. 总结

新的计划核心是：

```text
先保存当前成果
再做平台设计
然后补多成片类型系统
再抽象 Domain Pack
最后逐步新增警察和小说领域
```

最重要的调整是：

**多成片类型系统必须前置。**

因为无论是中国文化、警察故事，还是小说改编，最终都要回答：

```text
用户到底要生成什么类型的视频？
用什么表现形式？
输出给 GEARS 的 segment 应该是什么结构？
```

所以后续所有领域都应共享：

```text
video_type + presentation_style + gears_segments
```

