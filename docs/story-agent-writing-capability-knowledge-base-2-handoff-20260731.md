# Story Agent 创作增强与知识库 2.0 开发计划暨新对话交接（2026-07-31）

> 2026-08-03 起，新对话优先阅读精简快照：`docs/story-agent-writing-capability-kb2-handoff-20260803.md`。本文件继续保留完整规划和历史切片记录。

## 1. 交接摘要

本文件用于在新的 Codex 对话中继续开发 Story Agent“创作增强与知识库 2.0”专项。它是新增专项的执行入口；既有 Story Agent 的完整状态、测试基线、运行遗留项仍以 [Story Agent 开发交接（2026-07-29）](./story-agent-development-handoff-20260729.md) 为准。

### 1.1 当前仓库基线

- 工作目录：`/Users/wuyu/Desktop/china-culture-kb`
- 当前分支：`codex/story-agent-manifest-integrity-20260718`
- 编写本文时 HEAD：`5f6261e2`（`feat(story-agent): audit stale image runs`）
- 既有 Story Agent MVP 总进度：**99%**
- “创作增强与知识库 2.0”专项总进度：**67.25%**
- 当前专项阶段：M0、M1 已完成，M2 工程实现完成 99%，M3 工程实施 50%；15 类生产素材包和基础制作字段运行时指导已接入

开始开发前必须重新核对分支、HEAD、工作区和报告基线，不得假设它们仍与本文一致。

### 1.2 专项目标

在不削弱事实、文化、安全和可追溯边界的前提下，为现有 15 种作品类型引入经过筛选的创作方法，并把知识库升级为能够同时支持：

1. 事实检索与证据约束；
2. 人物、事件、冲突和场景的创作推演；
3. 分镜、GEARS、Seedance 等下游制作交付；
4. 机器评测、人工复核、修复和灰度发布。

外部 skill 只作为“方法来源”，不得整包盲装、不得以巨型提示词取代当前架构，也不得绕过知识证据和类型规则。

## 2. 不可破坏的现有契约

生成主链保持为：

```text
知识库 / 用户素材
  -> StoryBlueprint
  -> full_text
  -> scene_breakdown
  -> gears_segments
  -> quality validation
  -> repair
  -> project / version persistence
```

必须遵守：

- `GenreStoryProfile` 继续作为类型规则的单一事实来源。
- 新能力通过类型化 profile、blueprint、质量规则和修复指导接入，不得把规则散落到路由或多个提示词中。
- 生成内容不得自动回写 `data/provinces/*.md`。
- 缺少关键事实或制作素材时必须暴露缺口或创建补充任务，不得静默编造。
- 机器校验通过不等于人工复核通过。
- 发布、法律、版权、肖像、社区与在世传承人许可等真实责任仍由人类承担。
- 本专项不能阻塞既有 99% MVP 的收尾和运行健康审计。

## 3. 当前 15 种作品类型

### 3.1 叙事类

1. `character_story`
2. `historical_drama`
3. `legend_story`
4. `ai_comic_drama`
5. `children_story`

### 3.2 宣传类

6. `culture_promo`
7. `heritage_promo`
8. `city_brand_promo`
9. `social_short`

### 3.3 教育类

10. `documentary_short`
11. `explainer_video`
12. `lecture_video`
13. `education_training`

### 3.4 空间与氛围类

14. `scene_short`
15. `landscape_mood`

项目已有 `china-culture-screenwriting`、`shanyin-screenwriting-master`、`toonflow-production-workflow`、GEARS 与 Seedance 交付能力。外部方法是增强层，不是重建基础。

## 4. 外部创作方法引入策略

### 4.1 优先研究并适配

#### `danjdewhurst/story-skills`

- 仓库：<https://github.com/danjdewhurst/story-skills>
- 重点吸收：story bible、人物/物件/知识状态、连续性、承诺与兑现。
- 主要服务：长叙事、多场景人物故事、历史剧、传说、AI 漫剧。

#### `haowjy/creative-writing-skills`

- 仓库：<https://github.com/haowjy/creative-writing-skills>
- 重点吸收：`story-review`、`llm-writing`、`reader-sim` 等可评估方法。
- 主要服务：草稿生成后的读者体验检查、去模板化、修订建议。

#### `worldwonderer/drama-skills`

- 仓库：<https://github.com/worldwonderer/drama-skills>
- 重点吸收：短剧 develop / write / review 的结构化流程。
- 主要服务：`ai_comic_drama`、`social_short` 及短篇叙事。

### 4.2 选择性借鉴

#### `worldwonderer/oh-story-claudecode`

- 仓库：<https://github.com/worldwonderer/oh-story-claudecode>
- 仅考虑商业节奏、钩子和短剧密度等局部配方。
- 只允许对 `ai_comic_drama`、`social_short` 进行受控实验，不得成为所有类型的默认规则。

### 4.3 后续研究池

- <https://github.com/leenbj/novel-creator-skill>
- <https://github.com/PenglongHuang/chinese-novelist-skill>

它们更偏长篇小说工作流，待连续性、长篇项目管理或小说类型进入正式范围后再评估。

### 4.4 引入前审计

每个外部来源都必须记录：

- 仓库 URL、固定 commit、许可证和作者；
- 采用的具体方法与未采用部分；
- 脚本、依赖、网络访问、文件写入和命令执行能力；
- 提示注入、越权、数据外传和供应链风险；
- 与中国文化事实边界、版权和现有架构的冲突；
- 内部改写后的来源说明和版本。

默认不执行第三方脚本，不自动安装第三方依赖，不把第三方整仓复制进产品运行链。

## 5. 外部 Skill 与产品 Agent 的关系

把一个 `SKILL.md` 安装到 Codex，只会影响 Codex 在交互开发或写作任务中的工作方式，**不会自动增强 Web Story Agent API、MCP 工具或线上生成服务**。

若要让 `kb_story_agent_generate` 等产品能力真正受益，必须将筛选后的方法适配进规范化主链：

```text
WritingCapabilityProfile
  -> GenreStoryProfile
  -> StoryBlueprint
  -> generation prompt / deterministic fallback
  -> quality rules
  -> repair guidance
  -> project/version provenance
```

建议新增 `writing-capability-profile/v1`，至少包含：

```ts
interface WritingCapabilityProfileV1 {
  schema_version: "writing-capability-profile/v1";
  capability_id: string;
  display_name: string;
  source_repository: string;
  source_commit: string;
  license: string;
  adapted_rules: string[];
  allowed_video_types: VideoType[];
  forbidden_video_types: VideoType[];
  blueprint_requirements: string[];
  scene_rules: string[];
  quality_rules: string[];
  repair_guidance: string[];
  provenance: Record<string, unknown>;
  enabled: boolean;
}
```

首批 profile 必须默认 `enabled: false`，先完成目录、验证、评测，再分类型灰度启用。

## 6. 知识库当前基线

以下数据来自现有报告，开始开发前必须重新运行审计确认：

- 34 个省级/地区 Markdown 文件；
- 262 个正式条目；
- 960 个来源，平均每条 3.66 个；
- 来源、地点、核验方法的结构性缺失为 0；
- 262 个条目都至少含有一个“待核验点”，不等于 262 个条目整体不可信；
- 可信度分布：
  - 基础可靠：222
  - 混合：28
  - 待核验：9
  - 可靠：3
- 按完整 15 片型模板口径，高优先级条目为 262；这表示片型专属素材仍需补齐，不表示 262 条基础事实均不可信；
- 262 个条目已有机器元数据和 `asset_split`；
- 湖南 124 条，占 47.33%，地域分布明显失衡；
- 34 个地区都至少有 2 条，但只有 14 个地区达到 5 条；
- 23 个 M1 新条目仍待人工复核；
- 70 个 M2 新条目仍待人工复核；
- M1 尾部报告曾记录 184 个基础制作字段缺口；按 2026-08-03 当前审计口径，源 Markdown 原始缺口为 212 个，运行时机器指导覆盖 212 个，有效运行缺口为 0；
- M2 正式目标为 289 条，尚缺 27 条；
- 增补 27 条可使所有地区至少达到 5 条：
  - 13 个当前 4 条的地区各补 1 条；
  - 7 个当前 3 条的地区各补 2 条；
  - 达到 289 条后湖南占比约为 42.9%。

相关报告：

- `data/reports/knowledge-base-production-audit.json`
- `data/reports/knowledge-base-content-supply-progress.json`
- `data/production-packs/video-type-material-supplement-packs.json`
- `data/domain-packs/china-culture.json`
- `data/domain-packs/china-culture-production-expansion-candidates.json`

### 6.1 作品类型生产补充包现状

已覆盖 15/15。2026-08-03 完成的 M3 第一切片新增：

- `character_story`
- `historical_drama`
- `legend_story`
- `culture_promo`
- `city_brand_promo`
- `scene_short`
- `landscape_mood`

当前 15 包共有 184 个 required field、100 个样本；每类至少 5 个样本、10 个字段和 4 层 prompt。新增 7 包各有至少 4 个地域锚点，每条样本均带 `failure_pattern` 和 `repair_strategy`。`lecture_video`、`education_training` 已分别由 2 条扩至 5 条。

2026-08-03 完成 M3 第二切片：生产审计现对 262 个条目逐条检查全部 15 种片型模板；源 Markdown 中 212 个基础制作字段原始缺口全部由确定性运行时指导覆盖，有效运行缺口为 0。指导只从条目类型、已有资产、地点和待核点派生对白口吻、可戏剧化空间、视觉锚点和禁用表达，不新增文化事实，也不回写省级 Markdown。原始 212 个缺口仍保留为源素材治理任务。

机器基线：`data/reports/story-agent-writing-capability-m3-production-material-baseline.json`。

## 7. 知识库 2.0 目标架构

`data/provinces/*.md` 继续作为人类可读的事实来源，不要求一次性重写全部 Markdown。通过解析、适配和派生数据形成三层知识。

### 7.1 A 层：事实与证据

建议字段：

- `claim_id`
- 主体、事件、时间、地点、对象；
- `source_refs`
- 来源等级；
- 确定性；
- 异说、争议与未知项；
- 适用范围；
- 最后核验时间；
- 人工复核状态和复核人。

建议来源等级：

- A：政府、档案馆、博物馆、正式原始材料；
- B：学术出版物、高校、权威专业出版社；
- C：地方志、专业机构、可信行业资料；
- D：媒体、口述、商业页面，仅用于背景或线索。

关键历史、人物、仪式和身份主张至少需要一个 A/B 来源。来源数量不能替代来源质量与 claim 级映射。

### 7.2 B 层：创作可供性

每个知识条目应尽量提供：

- 人物目标、压力、选择和后果；
- 可见事件和场景锚点；
- 关系、冲突和价值张力；
- 仪式、制度、职业、地域如何形成故事压力；
- 可戏剧化空间与禁止虚构项；
- 传说或异说的版本谱系；
- 对白语体、叙述语体和禁用表达；
- 儿童、纪录、宣传等类型的改编边界。

### 7.3 C 层：制作素材

每个知识条目应按需提供：

- 人物、服装、发型、道具；
- 建筑、空间路线和场面调度；
- 材料、工具、流程和手部动作；
- 光线、季节、天气、环境声；
- 仪式、群演和人群关系；
- 采访、B-roll、档案与情景再现建议；
- 在世传承人、社区、作品、场所的权利与许可提示；
- 按 `video_type` 计算的 production readiness 与缺口。

### 7.4 派生 `KnowledgePack`

生成阶段应消费可验证、可追溯的派生包，而不是无边界拼接原文：

```ts
interface KnowledgePack {
  facts: unknown[];
  disputed_or_unknown: unknown[];
  dramatization_space: unknown[];
  forbidden_claims: unknown[];
  character_and_event_material: unknown[];
  visual_and_sound_material: unknown[];
  type_specific_material: unknown[];
  source_refs: unknown[];
  missing_material: unknown[];
}
```

`missing_material` 非空时，系统应显式降级、提示补充或生成补充任务，不能用语言模型臆造填平。

## 8. 不同类型的知识重点

### 8.1 叙事类 5 种

重点：人物、事件、目标、选择、冲突、因果、版本谱系、连续性、承诺与兑现。

### 8.2 宣传类 4 种

重点：真实流程、地点、视觉证据、当代价值、受众行动、版权与拍摄许可，避免空泛赞美。

### 8.3 教育类 4 种

重点：概念层级、例子、常见误解、练习、复盘、学习目标和认知负荷。

### 8.4 空间与氛围类 2 种

重点：空间路线、季节、时间、光线、声音、气候和低文本密度，不强行套人物冲突模板。

## 9. 开发里程碑

专项进度权重：

| 阶段 | 内容 | 权重 | 预计工期 |
| --- | --- | ---: | ---: |
| M0 | 基线、规范与外部来源审计 | 10% | 2–3 天 |
| M1 | 知识库 2.0 合同与适配层 | 20% | 5–7 天 |
| M2 | 创作能力 profile、路由与修复接入 | 25% | 7–10 天 |
| M3 | 15 类型知识与生产素材补齐 | 25% | 2–4 周 |
| M4 | 机器评测与人工盲评 | 15% | 5–7 天 |
| M5 | 灰度发布、观测与回滚 | 5% | 3–5 天 |

工程实现预计 4–6 周；知识核验和人工复核可能更长，应单独报告，不能用工程完成掩盖内容未完成。

### 9.1 M0：基线与规范

任务：

- 编写正式 spec / ADR / task list；
- 固定并审计外部仓库 commit、许可证与安全边界；
- 冻结 15 类型 × 3 个样本的生成基线，以及 token、延迟和成本；
- 重跑知识库健康、生产字段和地域分布报告；
- 明确所有新 schema、API、MCP 和持久化契约。

验收：

- 基线可复现；
- 未改变现有生成结果；
- 未执行第三方代码；
- 评测输入、参数、模型和结果可追溯。

### 9.2 M1：知识库 2.0 合同

任务：

- 在共享 types/schemas 中定义 claim、证据、创作可供性、制作素材和 `KnowledgePack`；
- 建立兼容现有 Markdown 的解析与适配层；
- 建立 fail-closed 的证据和缺口处理；
- 增加版本、来源、人工复核与迁移兼容测试。

验收：

- 旧知识库无需一次性重写即可被新适配层读取；
- 关键事实无 A/B 来源时不会被包装为确定事实；
- 缺失制作素材会进入 `missing_material`；
- 现有生成链无回归。

### 9.3 M2：创作能力适配

任务：

- 新增 capability registry 和 type-aware router；
- 首批适配连续性、读者模拟/审稿、短剧开发/写作/复核三类能力；
- 接入 `GenreStoryProfile`、`StoryBlueprint`、质量检测和 repair；
- 加入 feature flag、deterministic fallback 和来源追踪；
- 项目版本中保存 capability/profile 版本。

验收：

- profile 通过 schema 验证；
- 不适用类型会被拒绝；
- 关闭 feature flag 时与旧行为一致；
- 外部服务失败时确定性降级；
- 不执行外部仓库代码。

### 9.4 M3：知识与生产素材补齐

任务：

- 新增 7 个缺失类型生产包；
- `lecture_video`、`education_training` 各扩至至少 5 个样本；
- 23 个 M1 和 70 个 M2 条目的人工复核按当前指令移出工程前置，不阻塞产品能力开发；
- 修复当前审计识别的 212 个基础制作字段缺口：运行时有效缺口已归零，源 Markdown 原始缺口继续进入治理积压；
- 增补 27 个正式条目，使全部 34 地区至少 5 条；
- 建立时代服饰、仪式礼俗、建筑空间、语言语体、自然环境等跨条目 domain pack。

验收：

- 15/15 类型都有生产补充包；
- 每包有字段模板、跨地域样本、失败/修复样本和测试；
- 人工状态真实可审计；
- 地域均衡和制作完整度报告达到阶段目标。

### 9.5 M4：评测

任务：

- 使用 15 类型 × 3 个固定样本，共 45 组同输入、同模型、同参数对照；
- 45 组全部机器评测；
- 至少人工盲评 15 组，每类型至少 1 组；
- 邀请编剧/编辑、文化事实审核、导演/制片三个角色复核；
- 对比修复次数、token、延迟和成本。

发布门槛：

- 事实与文化准确性不得下降；
- 目标指标相对基线至少提升 10%；
- 不相关类型不得出现显著回归；
- 每个类型至少有一份人工盲评；
- 未人工复核的结果只能标记为 `machine_validated`。

### 9.6 M5：灰度发布

任务：

- 按类型设置 feature flag；
- 从内部/10% 流量开始灰度；
- 观测质量、降级、错误、延迟、成本和 repair；
- 保留一键回退旧链路；
- 形成上线签收、运行手册和后续积压。

验收：

- 灰度期间关键指标不低于发布门槛；
- 回滚演练通过；
- capability 与知识包版本可在项目结果中追踪。

## 10. 知识内容推进批次

### 10.1 P0：可信度与人工状态

优先处理：

- 28 个“混合”和 9 个“待核验”条目；
- 23 个 M1、70 个 M2 新条目的人工复核；
- claim 级来源映射和证据等级；
- 争议版本、未知项和适用范围。

任何机器报告都不得自动把条目标记为人工通过。

### 10.2 P1：制作字段

围绕当前 212 个源字段缺口和高优先级条目，分批补充；运行时已用“不新增事实”的确定性指导兜底：

- 可戏剧化空间与禁止表达；
- 对白与旁白语体；
- 工艺流程、工具、材料、手部动作；
- 采访与 B-roll；
- 时代、服饰、器物；
- 场景、光线、声音锚点；
- 肖像、社区、场所、作品和拍摄许可提示。

### 10.3 P2：地域与题材平衡

先补 27 条，使所有地区至少达到 5 条。选题优先级：

- 神话、传说与民间故事；
- 历史人物与事件；
- 建筑、自然与空间文化；
- 饮食、节俗与生活方式；
- 儿童友好的文化母题；
- 能直接服务缺失 7 种类型的条目。

完成最低线后继续降低湖南集中度，中期目标低于 35%，同时避免为了配额引入低质量条目。

## 11. 七个缺失类型生产包

每个生产包至少需要：

- 1 套字段模板；
- 5 个跨地域样本；
- 3 个正向样本和 2 个失败/修复样本；
- 1 组检索测试；
- 1 组事实边界测试；
- 1 组 blueprint / quality 规则测试。

具体重点：

- `character_story`：人物目标、关系、关键选择、代价、成长与事实边界；
- `historical_drama`：年代、制度、人物关系、史实锚点、虚构空间、服饰器物；
- `legend_story`：版本谱系、超自然规则、口述差异、文化意义、不得伪装成史实；
- `culture_promo`：文化证据、受众、当代价值、视觉证明和行动召唤；
- `city_brand_promo`：城市空间、群体生活、产业与文化关系、避免口号堆砌；
- `scene_short`：地点、动作、调度、光线、声场、短时段内的变化；
- `landscape_mood`：季节、天气、地貌、时间、环境声和低文本表达。

## 12. 评测维度

机器评测至少覆盖：

- 事实与文化准确性；
- 类型符合度；
- 人物目标、因果和选择；
- 场景可执行性；
- 对白、旁白和语体；
- 连续性、伏笔和兑现；
- 空泛表达、模板化和常见 LLM 痕迹；
- 制作交付完整度；
- repair 次数与成功率；
- token、延迟、成本和失败降级。

复用现有配方对比、人工复核、版本持久化和 Story Agent 质量服务，不另建互相冲突的评测体系。

## 13. 预期代码与数据落点

可能涉及但不限于：

- `web/shared/types.ts`
- `web/shared/schemas.ts`
- `genre-story-profiles.ts`
- `story-blueprint-service.ts`
- `story-generation-prompt.ts`
- `genre-quality-service.ts`
- `story-repair-service.ts`
- project/version persistence
- Story Studio、Result、Projects 客户端
- Story Agent generate / blueprint / validate / context / status MCP 工具
- `data/domain-packs/`
- `data/production-packs/`
- `data/reports/`
- 知识库审计、补充、迁移和评测脚本

实际路径必须先通过 `rg --files` 与现有引用核对，不得根据本文文件名猜测后直接新建重复实现。

## 14. 安全、版权与文化边界

- 不把第三方脚本、自动命令或网络调用直接接入运行时。
- 不自动将生成故事写回省级知识库。
- 不虚构人工复核、生产署名、权利许可或法律结论。
- 保存外部方法和知识证据的 provenance。
- 对受版权保护的作品只抽象方法，不复制剧情、对白或在世作者的可辨识风格。
- 外部 capability 不得覆盖文化证据边界和禁用规则。
- 对传说、异说、推测、戏剧化内容明确标记其性质。
- 真实发布、播出、投放和授权必须经过人类签收。

## 15. 已完成的 M0 首个开发切片

M0 已建立可审计、默认关闭的能力目录，没有改变提示词或生成效果。

### 15.1 已实现内容

1. 编写正式技术 spec / ADR，确认现有真实文件与调用链。
2. 新增 `WritingCapabilityProfileV1` schema/type。
3. 新增 capability registry，登记三类首批能力，但全部默认关闭。
4. 添加验证测试：
   - provenance 必填；
   - allowed / forbidden 类型冲突；
   - 重复 `capability_id`；
   - 未固定 commit 或许可证缺失；
   - 不允许声明或触发外部执行。
5. 新增只读的能力目录/状态报告，必要时再通过 API 或 MCP 暴露。
6. 证明关闭能力时现有生成输出和 fallback 不变。

### 15.2 首切片验收

- 三个 capability catalog 条目存在且默认禁用；
- schema 和 registry 有针对性测试；
- 状态报告能够解释来源、版本、适用类型和启用状态；
- 不执行第三方代码；
- 不改变生成 prompt、项目数据或 API 兼容性；
- 相关 server、MCP、Web 检查通过；
- `git diff --check` 通过。

机器基线：

- `data/reports/story-agent-writing-capability-m0-baseline.json`

技术规格与 ADR：

- `docs/story-agent-writing-capability-m0-architecture-20260731.md`

### 15.3 已完成：M1 知识合同骨架

已完成不改变现有 Markdown 和生成行为的共享知识合同：

1. 核对现有 `KnowledgePack`、`MaterialPack`、知识条目解析和补充任务合同；
2. 定义 claim、source grade、certainty、variant/dispute、creative affordance、
   production material 和 `missing_material` 的最小 v1 类型/schema；
3. 编写兼容适配器的失败测试，证明旧知识条目可以无损映射；
4. 对关键事实缺少 A/B 来源、争议内容和制作素材缺口采用 fail-closed；
5. 先提供只读 assembly/report，不接入生成 prompt；
6. 通过定向测试和 Web build 后再评估接入 preparation service。

实现与证据：

- `web/server/src/domains/china-culture/story-knowledge-contract-service.ts`
- `web/server/src/domains/china-culture/story-knowledge-contract-audit-service.ts`
- `web/server/src/__tests__/china-culture-story-knowledge-contract.test.ts`
- `data/reports/story-agent-knowledge-contract-v1-audit.json`
- `docs/story-agent-knowledge-contract-m1-architecture-20260731.md`

全库只读审计：262/262 条目有效，960 个旧来源保持 `ungraded`，1093 个待核 claim
保持 blocked，自动放行关键事实为 0。

### 15.4 已完成：M1 人工证据 Overlay

1. 定义 source-grade / claim-mapping overlay schema；
2. 要求稳定条目、claim 和 source 引用；
3. 人工签收前不得把机器映射升级为关键事实；
4. 无效引用、重复映射、证据缺失必须 fail closed；
5. 把缺口只读投影到现有补充任务；
6. 保持 preparation、prompt、fallback 和持久化行为不变。

实现与验证落点：

- `web/shared/types.ts`
- `web/shared/schemas.ts`
- `web/server/src/domains/china-culture/story-knowledge-evidence-overlay-service.ts`
- `web/server/src/__tests__/china-culture-story-knowledge-evidence-overlay.test.ts`
- `web/client/src/views/SupplementTasks.vue`

边界：

- pending / rejected Overlay 不能声明 `human_verified` 或把 claim 升级为 `fact`；
- 关键事实必须显式映射到人工核验的 A/B 来源；
- assembly 和补充任务投影均深冻结且不修改输入；
- 任务投影 `persistence_allowed: false`，不接入现有项目任务存储；
- 前端只补穷举显示名称，API 来源过滤和持久化仍保持原行为；
- preparation、prompt、fallback、document persistence 均未导入 Overlay 服务。

### 15.5 已完成：M1 收口与 preparation 旁路

1. 冻结 approved / pending 的单条 Overlay fixture 与只读 assembly report；
2. 明确 Overlay 的内容维护位置、版本与人工审核责任；
3. 定义缺失、pending、rejected 和不兼容 Overlay 的降级合同；
4. 先证明关闭状态无生成差异，再决定是否加入 preparation 的可选字段；
5. 不在同一切片接入 prompt、quality、repair 或持久化。

实现与证据：

- `StoryKnowledgePreparationV1` type/schema；
- `story-knowledge-preparation-service.ts`；
- preparation 内部第二参数的显式只读开关；
- 默认未启用时 preparation 返回形状完全不变；
- 五种状态：base-only、pending、approved-read-only、rejected、incompatible；
- rejected / incompatible 退回未修改的基础合同；
- pending / approved 都不改变 StoryBlueprint；
- `data/fixtures/story-knowledge-evidence-overlay-v1-fixtures.json`；
- `data/reports/story-agent-knowledge-overlay-m1-fixture-report.json`；
- `npm run audit:story-knowledge-overlay-fixtures`。

合成 fixture 只验证合同路径，固定声明
`real_human_review_credit_granted: false`，不代表任何真实条目已完成人工复核。

### 15.6 已完成：M2 type-aware capability router

1. 在三个默认关闭的 capability profile 上建立确定性的 type-aware 路由；
2. 默认关闭时决策结果必须为空且现有 blueprint / prompt / fallback 输出不变；
3. 不适用类型必须明确拒绝，不允许静默扩散；
4. 输出只读、可追溯的路由决策报告，记录 profile 版本与拒绝原因；
5. 本切片仍不启用能力，不接入第三方代码，不修改 prompt、quality、repair 或持久化；
6. router 稳定后再按单一能力、单一类型进入后续灰度切片。

实现与证据：

- `WritingCapabilityRoutingRequestV1` / `WritingCapabilityRoutingReportV1`；
- `writing-capability-router.ts`；
- 未登记、类型禁止、类型未允许、profile 关闭四类原因；
- 类型拒绝优先于 enabled 状态；
- canonical registry 只要出现已启用 profile，v1 router 整体 fail closed；
- 15 类型 × 3 profile 共 45 条稳定决策；
- 20 条类型适用但关闭，25 条类型明确禁止，激活数为 0；
- `data/reports/story-agent-writing-capability-m2-routing-baseline.json`；
- `docs/story-agent-writing-capability-m2-routing-architecture-20260731.md`。

矩阵 SHA-256：

`6d59efae036581f08ca61e0429436e5327ec0ffa12d2a1cfbe868df1e118d432`

### 15.7 已完成：M2 rollout policy 与单能力 shadow preparation plan

1. 定义默认关闭、按 capability + `VideoType` 精确授权的 rollout policy；
2. 保存 profile schema、固定 commit、内部适配版本和回滚标识；
3. 首个候选只允许单能力、单类型，不提供全局开关；
4. 先输出不被生成消费的 preparation plan 和关闭状态对照；
5. 保持公开 API/MCP、prompt、fallback、quality、repair 和持久化不变；
6. plan 与回滚合同通过后，再决定首个灰度能力和类型。

首个 shadow candidate 已固定为：

- `short_drama_develop_write_review`
- `ai_comic_drama`
- `short-drama-adapter/v1`
- `disable-short-drama-ai-comic-shadow-v1`

实现与证据：

- `WritingCapabilityRolloutPolicyV1`；
- `WritingCapabilityShadowPreparationPlanV1`；
- `writing-capability-rollout-service.ts`；
- preparation 内部显式 shadow 旁路，默认返回形状不变；
- policy disabled、candidate mismatch、commit drift、routing rejection 全部 fail closed；
- `shadow_ready` 时底层 profile 仍 disabled，四类规则投影仍为空；
- 15 类型中 1 条 shadow-ready、14 条 candidate mismatch；
- 激活 capability 0，投影规则 0；
- `data/reports/story-agent-writing-capability-m2-shadow-plan-baseline.json`。

Shadow 矩阵 SHA-256：

`0d98d1e96a7507e9099b7bb3b6c2bbb01e9126f90f472735c9a05b56c1fde177`

### 15.8 已完成：首个静态 adapter 与冲突预检

1. 已定义 `short_drama_develop_write_review × ai_comic_drama` 内部静态 adapter；
2. 7 条规则分为 blueprint 1、scene 2、quality 2、repair 2，只输出 preview；
3. 预检核对 `GenreStoryProfile`、知识证据、文化安全、权利许可和回滚身份 guardrail；
4. 重复规则、类型/commit/适配版本/来源索引漂移、事实边界削弱和回滚不匹配均 fail closed；
5. 无 adapter 的关闭态结构保持不变；显式 preview 通过时 `projected_rules` 仍全空；
6. 真实 blueprint、prompt、fallback、quality、repair、持久化、公开 API/MCP 均未修改。

实现与证据：

- `WritingCapabilityAdapterV1` 与 `WritingCapabilityAdapterPreflightReportV1`；
- `writing-capability-adapter-service.ts`；
- rollout 的可选 `adapter_preview` 与 `adapter_blocked` 状态；
- 8 个负向样本全部 blocked 且不输出 preview rules；
- 激活 capability 0，运行时投影规则 0；
- `data/reports/story-agent-writing-capability-m2-adapter-preflight-baseline.json`。

Adapter baseline SHA-256：

`95bdb8a4128d47e86f09a8fe5f6be8b4c51ce9357f044f316335bcef1c7163ef`

2026-08-02 收尾验证：

- M0 / M1 / M2 定向回归：7 个测试文件、50 个测试通过；
- Adapter / rollout 契约收口：2 个测试文件、16 个测试通过；
- Server 全量：199 个测试文件通过、1 个跳过；1641 个测试通过、2 个跳过；
- Web workspace lint、Server/Client production build：通过；
- Visible copy audit：9 个文件、17 项检查通过；
- routing、shadow-plan、adapter-preflight 三份机器审计：通过；
- capability 激活数与运行时规则投影数仍为 0。

### 15.9 已完成：离线 shadow evaluation 与准入阈值

1. 已建立 13 个明确标记为 fictional fixture 的 AI 漫剧固定样本；
2. closed state 建议为 0，shadow preview observation 为 18，两侧故事改写均为 0；
3. 评测行动推进、因果链、钩子兑现、事实、文化、权利和复核分层 7 个维度；
4. 基线保留 1 个误报和 1 个漏报，precision / recall 均为 0.9375；
5. 事实/文化/权利 boundary recall 与 7 条 adapter rule coverage 均为 1.0；
6. 机器门槛通过仍只得到 `human_review_required`，六项人工清单全部 pending；
7. 三个负向探针全部 blocked，capability/profile 仍 disabled，未进入真实生成链。

实现与证据：

- `writing-capability-shadow-evaluation-service.ts`；
- `writing-capability-shadow-evaluation-dataset/v1`；
- `writing-capability-shadow-evaluation-policy/v1`；
- `writing-capability-shadow-evaluation-report/v1`；
- `data/fixtures/story-agent-writing-capability-m2-shadow-evaluation-fixtures.json`；
- `data/reports/story-agent-writing-capability-m2-shadow-evaluation-baseline.json`。

Shadow evaluation baseline SHA-256：

`11bb22166e2f652b2f311abb8bfc9ca05c15d86a66b570f85acca0f5c396365f`

2026-08-02 第四切片验证：

- M0 / M1 / M2 定向回归：8 个测试文件、58 个测试通过；
- Server 全量：200 个测试文件通过、1 个跳过；1649 个测试通过、2 个跳过；
- Web workspace lint、Server/Client production build：通过；
- Visible copy audit：9 个文件、17 项检查通过；
- routing、shadow-plan、adapter-preflight、shadow-evaluation 四份机器审计：通过；
- capability 激活数、运行时投影数、故事改写数仍为 0。

### 15.10 已完成：人工复核证据 intake 与 Canary Decision Package

1. 已定义 13×6=78 条逐样本 judgment、reviewer 声明和时间戳合同；
2. 已绑定 dataset、evaluation、adapter、preflight、两类 policy、baseline 与 rollback 哈希；
3. 机器自签、合同 fixture、缺失覆盖、失败 judgment、过期和身份漂移全部 fail closed；
4. 只读 eligible 仍固定不启用、不执行 canary、不授予生产权；
5. 审计中的 eligible 是合成合同探针，`counts_as_real_human_review:false`。

报告：`data/reports/story-agent-writing-capability-m2-canary-decision-baseline.json`

Baseline SHA-256：`3c2f03a8df3ac58bac69cce1331e0dbc86f1788f7b924a6124c223155272902a`

验证：定向 9 个文件、65 项通过；Server 全量 201 个文件通过、1 个跳过，1656 项通过、
2 项跳过；Web lint/build、Visible copy audit 与 canary-decision 机器审计通过。

### 15.11 已完成：默认关闭的 Dormant Integration

1. 新增独立的 `writing-capability-runtime-activation/v1`、runtime context 与 fail-closed resolution；
2. `short_drama_develop_write_review × ai_comic_drama` 已接入 StoryBlueprint、生成合同、确定性质量诊断、局部修复提示和故事持久化；
3. 默认调用不产生 runtime 字段，关闭态蓝图保持兼容；片型、activation、adapter 或来源身份漂移时不抛错、不注入规则，确定性回到原蓝图；
4. 运行时只投影静态改写规则，不执行第三方代码，GenreStoryProfile、知识证据、文化安全和权利边界继续优先；
5. capability registry 中 profile 仍保持 `enabled:false`，真实运行只允许调用方显式传入完整内部 activation 合同。

验证：runtime integration 定向 6 项通过；受影响能力/蓝图/质量/修复回归 7 个文件、42 项通过；Server 全量 1663 项中 1661 项通过、2 项跳过、0 失败；Server lint、Web lint/build、9 文件 17 项可见文案审计和 `git diff --check` 通过。

### 15.12 当前优先级调整与 M2 剩余

按 2026-08-02 最新开发指令，先完成产品能力，不把人工评审、真人流程或用户注册作为工程完成前置。既有人工证据合同保留为审计记录，但不阻塞内部能力接线，也不据此虚构人工信用。

### 15.13 已完成：连续性 Ledger 与机器读者诊断

1. `continuity_state_tracking × ai_comic_drama` 已具备独立 adapter、policy 和 runtime activation；
2. 连续性质量报告生成角色出场、物件状态与承诺兑现 ledger，可定位“丢失/毁坏后未经找回或修复再次使用”、悬空承诺和未标记过去时线；
3. `reader_simulation_review × ai_comic_drama` 已具备独立 adapter、policy 和 runtime activation；
4. 机器读者诊断覆盖开场观看承诺、信息清晰度、情绪推进、模板化表达和结尾兑现，所有失败项绑定具体 `scene_id`；
5. 报告固定 `evaluation_kind: machine_reader_simulation` 与 `human_feedback_claimed:false`，修复提示明确“机器读者模拟，不是真人反馈”；
6. 三类 capability/profile 均继续默认关闭，只允许单能力、单片型、完整身份绑定的内部 activation；错误片型或身份漂移均回到默认蓝图。

新增回归与受影响回归共 8 个文件、47 项通过；Server 全量 1667 项中 1665 项通过、2 项跳过、0 失败；Server lint、Web build、9 文件 17 项可见文案审计和 `git diff --check` 通过。

M2 仅剩机器报告固化：runtime integration 审计脚本已扩展为同时核验三类初始 profile，但本地沙箱仍拒绝 `tsx` IPC socket，未生成的报告和哈希不计完成证据。该环境限制不影响产品运行链、测试或类型检查。

### 15.14 已完成：M3 全片型 ProductionMaterialPack 第一切片

1. 新增 `character_story`、`historical_drama`、`legend_story`、`culture_promo`、`city_brand_promo`、`scene_short`、`landscape_mood` 7 个生产包，覆盖从 8/15 提升到 15/15；
2. 新增人物弧、历史因果与戏剧补足、传说版本与神异规则、文化传播证据、城市空间路线、场景轴线连续、山水景深与声景等专属 readiness 字段；
3. 15 包 required field 总量达到 184；健康服务默认要求完整 15 类、每个非核心高频包至少 5 个唯一样本；
4. 新增 7 包各包含 5 个样本、至少 4 个地域锚点，并为每条样本固化 `failure_pattern` 与 `repair_strategy`；
5. `lecture_video`、`education_training` 从 2 条扩至 5 条；全库生产样本达到 100 条；
6. 新增纯 Node 审计 `npm run audit:production-material-m3`，不依赖 `tsx` IPC；基线状态 `passed`、issues 0、源文件 SHA-256 为 `f84dad4a52c74374030862a68b85b619d5b16157a17dc6c00eb3a503d0d617ac`；
7. 新包会真实进入生成 prompt、readiness、质量与顶层 workflow checkpoint；原先因缺包而绕过检查的 `character_story` 现在会在素材不足时正确进入 `awaiting_external_action`。

本切片未改写 `data/provinces/*.md`，未授予人工复核信用，未引入用户注册或真人流程依赖。

验证：受影响链路 5 个测试文件、57 项通过；Server 全量 203 个文件通过、1 个跳过，1667 项通过、2 项跳过；Server lint、Server/Client production build、9 文件 17 项 Visible copy audit、M3 baseline `--check` 和 `git diff --check` 通过。

### 15.15 已完成：M3 基础制作字段运行时指导第二切片

1. 新增纯确定性 `machine-production-field-guidance/v1`：按历史/人物、工艺/非遗、传说/民俗、表演、饮食和通用类型生成对白口吻、可戏剧化空间与禁用表达；仅在已有资产或地点存在时生成视觉锚点；
2. 输出固定声明 `facts_added:false`、`source_markdown_writeback_allowed:false`，待核点只进入审稿边界，不被补写成事实；
3. 单条目全文知识包与多条目 outline 匹配知识包均注入 `production_prompts` 和 `review_boundaries`，现有生成 prompt 会真实消费这些字段；
4. 生产审计保留 `missing_production_fields` 作为源缺口，同时新增 `machine_guidance_fields` 与 `effective_missing_production_fields`，避免把运行时兜底误报成源知识已补齐；
5. 当前 262 条、34 省级文件审计结果：原始基础制作字段缺口 212，机器指导覆盖 212，有效运行缺口 0，共 140 个条目获得兜底；缺口分布为对白口吻 95、可戏剧化空间 75、禁用表达 35、视觉符号 7；
6. 生产审计从旧 8 片型扩为完整 15 片型，每个条目均生成 15 份模板 readiness 审计；M3 基线将“262 条 × 15 类型审计”和“有效运行缺口 0”纳入 gate。

本切片没有改写 `data/provinces/*.md`，没有声称原始 212 个源字段已经人工补齐，也没有引入人工、真人或用户注册依赖。

验证：MCP 定向指导/审计 2 个文件、3 项通过，健康检查 16 项通过并完成 `tsc` build；MCP 排除沙箱不允许监听本地端口的自动化桥接文件后，108 个文件、550 项全量通过，该桥接文件的 3 项失败均为 `listen EPERM 127.0.0.1`，不是本切片逻辑失败。Server 受影响 5 个文件、61 项通过，lint 与 production build 通过；全库 `npm run kb:production-audit` 成功生成报告；M3 baseline `--write`、`--check` 和 `git diff --check` 通过。

## 16. 测试与验证原则

测试范围应与改动风险成比例：

1. 先运行新增/修改模块的定向测试；
2. 再运行受影响包的 lint/typecheck/build；
3. 触及 MCP 合同时运行 MCP 定向与全量测试；
4. 触及共享类型或客户端时运行 Web build/copy audit；
5. 触及生成或持久化时补回归、fallback 和 round-trip；
6. 最后执行 `git diff --check` 并核对工作区。

M0 完成时的全量基线仅供比对，必须以新对话实测为准：

- Server：193 个测试文件通过、1 个跳过；1600 个测试通过、2 个跳过；
- MCP：107 个测试文件、551 个测试通过；
- Web：build、类型和 copy audit 通过。

## 17. 进度汇报规则

每次推进后必须分别报告，不能混成一个模糊百分比：

1. **当前阶段进度**：例如 M0 40%；
2. **新增专项总进度**：按 M0–M5 权重计算；
3. **既有 Story Agent MVP 总进度**：当前为 99%，除非真实完成其遗留项；
4. **真实运行健康**：测试、服务、外部 worker、长期任务和人工审核状态。

专项权重固定为：

```text
M0 10% + M1 20% + M2 25% + M3 25% + M4 15% + M5 5% = 100%
```

当前值：

- 当前阶段（规划与交接）：100%
- M0 实施：100%
- M1 实施：100%
- M2 工程实施：99%
- M3 工程实施：50%
- 新专项总进度：67.25%
- 既有 Story Agent MVP 总进度：99%

## 18. 新对话启动指令

将下列内容作为新对话的第一条消息：

```text
请阅读：
/Users/wuyu/Desktop/china-culture-kb/docs/story-agent-writing-capability-knowledge-base-2-handoff-20260731.md
以及：
/Users/wuyu/Desktop/china-culture-kb/docs/story-agent-development-handoff-20260729.md

继续开发 Story Agent“创作增强与知识库2.0”专项。

先核对当前分支、HEAD、工作区、现有代码调用链和知识库报告基线，不要假设交接文档中的状态仍然完全一致。先验证第 15.14–15.15 节的 15/15 ProductionMaterialPack、184 个模板字段、100 个样本、262 条 × 15 片型模板审计，以及“原始缺口 212 / 机器覆盖 212 / 有效运行缺口 0”的 M3 机器基线，再继续 M3：优先增补 27 个正式条目并扩展跨条目 Domain Pack，同时保留源字段治理积压。按当前指令，人工评审、真人流程和用户注册不作为工程前置；不得虚构人工信用，也不得自动改写省级 Markdown。

开发必须遵守现有 Story Agent 主链、GenreStoryProfile 单一事实来源、知识证据边界和生成内容不回写 data/provinces/*.md 的约束。先定向验证，再按影响范围运行测试/build，并检查 git diff。

每次推进后分别汇报：
- 当前阶段进度；
- “创作增强与知识库2.0”专项总进度；
- 既有 Story Agent MVP 总进度；
- 真实运行健康、外部依赖和人工审核状态。
```

## 19. 交接完成定义

新对话在满足以下条件后，才算接住本专项：

- 已读本文件和既有主交接；
- 已核对实际仓库状态与报告数据；
- 已确认 M0 首切片的现有代码落点；
- 已说明不会整包盲装外部 skill；
- 已验证 M0 基线、完成 M1，并完成 M2 默认关闭路由与 shadow rollout，开始 adapter 预检；
- 已按四类进度口径汇报。
