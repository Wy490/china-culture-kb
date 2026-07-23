# Story Agent 影视 × 文字标杆研究与新对话开发交接

> 日期：2026-07-23
> 仓库：`/Users/wuyu/Desktop/china-culture-kb`
> 当前分支：`codex/story-agent-manifest-integrity-20260718`
> 当前项目：`20260720-series-ujl3atax`《皮影诡戏：守灯人》
> 本文用途：在新 Codex 对话中继续开发，不需要重新调查本轮资料。

## 0. 一句话结论

当前系统已经是一套较强的“文化知识 → 结构化故事 → 连续分集 → 分镜与 GEARS/Seedance 交付契约”的前期生产 Agent，但还不是完整的 AI 漫剧生产工厂。

真正需要补齐的是两层：

1. **上游参考理解层**：把影视、剧本、小说和宣传片资料变成有来源、有版权状态、有时间码/文本证据、可复用但不照抄的分析卡。
2. **下游真实制作层**：真实图片 Provider、角色与场景一致性、关键帧真人审核、视频 Provider、配音/口型/音乐/剪辑和成片质检。

工程优先级不能倒置：

1. 先完成 **4 个核心人物真实资产 → 14/14 production credit → 真实 Provider 试产 E1**；
2. 同时把本轮研究固化为 **Reference Intelligence / 参考理解层 v1**；
3. 再升级长文本改编、导演引擎、视听后期和投放反馈闭环。

## 1. 本轮研究范围、方法与证据边界

### 1.1 实际查看范围

- 使用用户已登录的 Bilibili 会话，读取私人收藏夹 `ai漫剧（7）`。
- 打开并抽样检查：
  - 长篇 AI 影视成片；
  - 1–2 分钟 AI 短片；
  - 6 分钟连续剧第一集；
  - 58 分钟 AI 真人电影工作流教程。
- 补充检索 Bilibili、知乎和中文制作教程，寻找 AI 漫剧生产流程、小说改短剧、人物一致性和分镜方法。
- 使用 Academy、Writers Guild Foundation、Sundance、BBC、Cannes Lions 等专业资料校准剧本、分集和宣传片标准。
- 对照仓库中的 Story Agent、专业 AI 漫剧流水线、改编分析、视觉圣经、GEARS/Seedance 交付和当前项目账本。

### 1.2 证据等级

| 等级 | 来源 | 本文使用方式 |
|---|---|---|
| A | 官方机构、行业组织、项目内实际代码与账本 | 可作为设计与验收依据 |
| B | 研究论文、创作者的完整成片和公开制作记录 | 可作为案例和方法参考 |
| C | Bilibili/知乎教程、个人经验文章 | 只提取可验证流程，不接受收益或效果承诺 |
| D | 引流课、营销号、无来源“高分/爆款/收入”声明 | 仅用于识别市场话术，不进入质量标准 |

### 1.3 版权和隐私边界

- 本轮只记录标题、链接、公开元数据、观察结论和少量结构信息，不保存受版权保护的完整视频、小说或剧本正文。
- 收藏夹是私人上下文，本文不记录用户账号名、UID、Cookie 或其他认证信息。
- “参考”必须变成抽象原则和分析卡，不能把某个作品的角色、台词、镜头序列或独特表达直接拷贝到生成结果。
- 任何小说、剧本或成片进入生产前，都必须填写权利状态；“网上能看到”不等于“可以改编”。

## 2. 用户 Bilibili `ai漫剧（7）` 收藏夹盘点

以下数据为 2026-07-23 页面快照；播放量和互动量会继续变化。

| # | 收藏内容 | 作者 | 时长 | 当时页面播放量 | 类型与研究价值 |
|---|---|---|---:|---:|---|
| 1 | [一口气看完《末日山宿》4K 超清完整版，爆肝千小时耗资上万！](https://www.bilibili.com/video/BV1mwMc6uEdX/) | 关渐帧 | 47:59 | 573.3 万 | 长篇完整成片；适合研究长时长故事维持、写实视觉、连续危机与合集形态 |
| 2 | [朝廷当我死了 我却活成了神仙](https://www.bilibili.com/video/BV1G4Jg6PEub/) | 我是红果大王 | 07:45 | 94.1 万 | 网文式高概念漫剧；适合研究标题承诺、身份反差和单集爽点 |
| 3 | [大明14444：体修打法修，你押注谁赢？](https://www.bilibili.com/video/BV1YdMp6kEzZ/) | 星海大明锦衣卫AIGC | 01:45 | 49.3 万 | 极短剧情片；适合研究 90 秒级冲突、视觉角色吸引力和系列角色记忆 |
| 4 | [志怪版《武松打虎》AI 真人电影工作流](https://www.bilibili.com/video/BV1NZKm6hEim/) | AI视频制作课程_ | 58:14 | 32.3 万 | 方法教程；适合研究构图、打光、调度、分镜、运镜、角度、人物与视频真实感 |
| 5 | [《天师李淑芬》第一集](https://www.bilibili.com/video/BV1o9MP6cEUm/) | AIGC异想天开的老李 | 06:19 | 约 28 万 | 原创都市玄幻连续剧；适合研究第一集设定、角色职业、悬念和 6 分钟分集结构 |
| 6 | [《乡村猎艳记》抢先版](https://www.bilibili.com/video/BV1GMNC6sED3/) | 沙雕放映厅 | 11:45 | 36.4 万 | 长一点的网文漫剧形态；标题“高分”是上传者声明，不能当第三方评分证据 |
| 7 | [《我有一间魔法便利店》——八](https://www.bilibili.com/video/BV16QKN6eEij/) | 冰冻西瓜快乐水 | 01:21 | 36.6 万 | 连载短集；适合研究固定世界、单集奇观和快速结尾钩子 |

### 2.1 抽样观察

#### 《末日山宿》

- 页面标记“含 AI 生成内容”，是 47:59 的完整长篇，说明 AI 影视产品不必局限于几十秒样片。
- 打开的画面采用写实、宽银幕、近景人物和成片字幕，目标明显是“电影感成片”，不是静态漫画翻页。
- 长篇真正的门槛不只是生成更多镜头，而是角色、服装、空间、光线、叙事目标和声音在几十分钟内持续稳定。
- 对当前 Agent 的启示：已有长线线索账本是优势，但还缺跨镜头视觉连续性、音频连续性和长时长成片 QC。

#### 《大明14444》

- 时长 1:45，页面标记“含 AI 生成内容”。
- 打开的画面是写实人物、明显服装设计、对白字幕和冲突场景，评论区会直接讨论角色、战力和更新。
- 这种内容的核心不是每集解释完整世界，而是让观众已经记住角色，并在极短时间内看到一个具体对抗。
- 对当前 Agent 的启示：20 集规划、角色身份与结尾钩子已经匹配该形态；缺口在真实角色资产、动作可信度、表演和声音。

#### 《天师李淑芬》第一集

- 6:19 的第一集，简介为“咸鱼天师李淑芬的打工日记”，页面明确“原创”“未经作者授权，禁止转载”。
- 开场画面使用动物/环境奇观和时间信息快速建立异常，再进入人物与都市玄幻设定。
- 页面显示已有第二集，说明单集需要同时完成本集体验和下一集追看动力。
- 对当前 Agent 的启示：现有 `opening_hook`、`ending_hook`、分集连续性和世界规则结构方向正确；还要加入首集“角色职业承诺”“系列日常引擎”和下一集可生产承接。

#### 《武松打虎》AI 真人电影工作流

页面可见 8 个章节：

1. 构图；
2. 打光；
3. 调度；
4. 分镜思维；
5. 电影运镜；
6. 镜头角度；
7. AI 人物真实感；
8. AI 视频真实感。

视频简介另外声称包含脚本、角色设计、片段生产、配音配乐和剪辑。作为个人教程，这些声明只能算 C 级经验；但章节结构揭示了一个重要事实：**生成提示词不是导演工作本身**。当前 Agent 的 `visual_prompt`、shot ID 和 GEARS 分段还需要进一步承载构图、灯光、调度、轴线、视线、动作连续和表演目标。

### 2.2 收藏夹反映的真实产品谱系

这 7 条并不是同一种产品，而是至少四种：

1. **1–2 分钟高密度短集**：冲突快、视觉角色强、结尾立即拉下一集。
2. **6–12 分钟连续漫剧**：需要角色关系、单集弧线和稳定更新。
3. **40 分钟以上合集/长篇**：需要大量镜头、一致性、声音和长线节奏控制。
4. **制作教程/工作流**：重点是如何把文字变成可控视听资产。

因此 Story Agent 不能只有一个笼统的 `ai_comic_drama` 模式。至少应按时长和发行形态区分：

- `micro_episode_60_120s`
- `serial_episode_5_12m`
- `compilation_or_feature_30m_plus`
- `promo_or_trailer_15_180s`

它们需要不同的段落密度、镜头数、场景数、声音预算、结尾策略和成本上限。

## 3. 影视侧：应当吸收的标准

### 3.1 AI 漫剧稳定生产流程

本轮案例与多份制作资料的共同结构是：

1. 题材、受众、时长和节奏目标；
2. 故事/分集剧本；
3. 分场、分镜和镜头清单；
4. 角色、服装、道具、场景和世界规则资产；
5. 角色参考图、三视图/表情/服装状态和接触表；
6. 关键帧生成与真人审核；
7. 通过审核的关键帧进入图生视频；
8. 配音、对白时长、口型、音乐、环境音和音效；
9. 剪辑、字幕、调色、画幅与多版本输出；
10. 成片连续性、技术、版权和发行 QC；
11. 归档生成参数、模型、成本、版本和反馈。

**关键门禁：先审核关键帧，再花钱生成视频。**
这是当前项目“14/14 production credit”必须完成后再试产 E1 的直接理由。

### 3.2 高分电影不能只学“风格”

平台评分只能用于筛选候选，不能直接转成生成提示词。真正可学习的是具体、可证据化的机制：

- 开场在多少秒建立异常或承诺；
- 主角在每场想要什么；
- 阻力如何升级；
- 场景发生了什么可见状态变化；
- 信息反转如何被先前镜头铺垫；
- 空间、构图和光线如何服务冲突；
- 声音何时提前、延迟或与画面反差；
- 结尾留下什么具体问题或情绪余波。

建议建立 5 张人工批准的电影基准卡，而不是抓取“豆瓣 Top 250”后自动模仿。可先从以下候选中按项目目标选择，**这里不声明或固化实时评分**：

- 《寄生虫》：空间与阶层冲突、设置与回收；
- 《寻梦环游记》：文化元素、家庭情感与世界规则；
- 《疯狂动物城》：角色识别、世界一致性和合家欢信息清晰度；
- 《看不见的客人》：证词、信息重排与连续反转；
- 《流浪地球》系列：大设定、团队行动和中国情感命题。

每张卡只保留分析结果、时间码和合法来源，不保存整部影片。

### 3.3 宣传片/品牌片标准

Cannes Lions Film 的公开标准强调：

- 面向屏幕的品牌叙事；
- 核心判断是 **idea / execution / impact**；
- 适配 TV、影院、在线、活动屏幕、微电影和新技术形态；
- 字幕高度推荐；
- 文化语境需要对应明确受众。

因此当前 Agent 的宣传片类能力还需要：

- 明确传播对象、业务目标和 CTA；
- 把产品/文化事实转译为人物能感受到的结果；
- 同时交付 15 秒、30 秒、60 秒和主片版本；
- 画幅、字幕安全区、首尾品牌露出和平台适配；
- 可记录的影响指标，而不是只打“故事质量分”。

## 4. 文字侧：小说、剧本和分集写作应当吸收的标准

### 4.1 小说改编不是“摘要 + 改对白”

小说到漫剧至少要经过：

1. 权利确认与版本指纹；
2. 章节/事件地图；
3. 角色、关系、秘密和状态账本；
4. `must_keep / may_compress / may_merge / may_invent` 决策；
5. 内心活动转成可见行动、道具、空间选择和反应镜头；
6. 叙述信息转成场景目标、阻力、转折与后果；
7. 长线支线重排和分集钩子；
8. 每个改编决定回链到原作事件 ID。

当前 `web/server/src/services/adaptation-analysis-service.ts` 可以给出摘要、核心角色、情节、必须保留、可压缩、视觉场面和风险，但主要是规则/正则启发式，无法证明自己理解了长篇小说的语义、伏笔、人物弧和叙述视角。

### 4.2 专业场景单元

Sundance 的公开课程把以下内容列为剧本核心：

- 人物通过行为、场景描述和对白显现；
- 场景要有潜台词；
- 每场都应推动故事；
- 目标、冲突、反转、因果和情感代价需要持续发展；
- 设置必须获得回收。

对 Story Agent，应把每个场景升级为至少包含：

```text
scene_objective
opposition
visible_action
turn
state_before
state_after
character_choice
reaction_beat
subtext
setup_ids
payoff_ids
source_event_ids
```

现有 `StoryScene` 已有地点、时间、戏剧功能、关键动作、冲突、对白、文化说明和事实/虚构边界，是很好的基础；还缺上述“场景状态变化与原作回链”的强约束。

### 4.3 剧本资料来源不能等同于改编授权

- Academy 的馆藏覆盖 15,000 多部已制作影片，包含梗概、处理稿、不同草稿、终稿和剪辑连续稿；这些资料主要用于研究。
- Writers Guild Foundation 明确提醒，网上找到的有时只是 transcript，不一定是真正的 screenplay。
- WGF 馆藏剧本仅限现场研究，剧本知识产权通常由相应制片方/工作室控制。
- WGA 对版权的说明包含复制、发行、表演、公开展示和制作衍生作品等权利。

因此系统必须把以下概念拆开：

- `accessible_for_research`
- `public_domain`
- `licensed_for_adaptation`
- `user_owned`
- `unknown_or_restricted`

只有后三种中的明确可生产状态，才能进入改编和发布；“研究可读”不能自动变成“可用于训练或改编”。

## 5. 影视 × 文字统一目标工作流

```mermaid
flowchart LR
  A["输入与权利确认"] --> B["参考资料分析卡"]
  B --> C["StoryBlueprint / 改编决策"]
  C --> D["系列规划与分集"]
  D --> E["场景 / 分镜 / 镜头计划"]
  E --> F["视觉圣经与资产清单"]
  F --> G["真实图片资产"]
  G --> H["关键帧真人门禁"]
  H --> I["GEARS / 视频 Provider"]
  I --> J["配音 / 口型 / 音乐 / 剪辑"]
  J --> K["成片 QC 与发行版本"]
  K --> L["平台反馈与迭代"]
```

分工必须保持清楚：

- **China Culture KB**：事实、文化边界、证据与可用知识。
- **Story Agent**：故事结构、改编、分集、场景、连续性、质量门和生产意图。
- **Reference Intelligence**：从影视/文本参考中提取可复用原则与证据。
- **GEARS**：把已批准的生产意图送进真实图片/视频执行链。
- **真人审核**：权利、文化、角色身份、关键帧、成片与发布决策。

GEARS 不应承担上游剧本理解；Story Agent 也不能把“生成了 prompt”当成完成了真实制作。

## 6. 当前能力矩阵

| 环节 | 标杆要求 | 当前证据 | 状态 | 主要缺口 |
|---|---|---|---|---|
| 文化知识与事实边界 | 事实、来源、虚构边界可追踪 | KB 检索、`factual_basis`、`fictionalized_elements`、文化边界 | ✅ 较强 | 参考影视不能未经审核写回知识库 |
| 故事与系列规划 | premise、人物、世界规则、分集、长线 | StoryBlueprint、20 集计划、thread/continuity ledger | ✅ 较强 | 当前只生成 E1/E10/E20 |
| 专业文本包 | brief、研究、结构、分场、对白、导演文本 | `web/server/src/services/professional-ai-comic-drama-pipeline-service.ts` | ✅ 合同齐全 | 需要真实模型输出和更多真人评审证明 |
| 文本质量门 | 钩子、人物选择、场景动作、对白、反转、文化边界 | 专业质量服务、商业质量门、盲审 | ✅/🟡 | 机器不能判定原创或真正电影感 |
| 小说改编 | 长篇语义、事件回链、保真与重排 | `web/server/src/services/adaptation-analysis-service.ts` | 🟡 部分 | 当前主要是启发式，不足以处理长篇复杂小说 |
| 参考资料库 | URL、版权、分析卡、证据和防照抄 | `CreativeReference` / `ReferenceAnalysis` / `StylePack` 类型 | 🟡 原型 | 服务只读取本地 JSON；无 CRUD、无 UI、无媒体分析 |
| 影视多模态理解 | 字幕、镜头、关键帧、声音、时间码 | 无完整流水线 | 🔴 缺失 | 不能自动分析收藏视频或电影 |
| 视觉圣经 | 稳定人物/场景/道具/规则身份 | 14 identity + 2 world rules，16/16 真人批准 | ✅ 前期完成 | 仍是文字定义，未获得真实 production credit |
| 图片资产 | 真实 Provider、来源、hash、权利、真人审核 | 4 个 `gears_local_test` PNG | 🟡 测试闭环 | 0/14 真实资产，4 个测试件权利与审核均 pending |
| 导演与分镜 | 构图、调度、轴线、视线、动作、灯光、表演 | scene breakdown、GEARS segments、shot IDs | 🟡 部分 | 还不是完整导演引擎，缺接触表和视觉 QC |
| 视频生成 | 已批准关键帧 → Provider → 回调 → 成片 | GEARS/Seedance 契约和账本 | 🟡 合同层 | 真实 GEARS jobs = 0，production items = 0 |
| 声音与后期 | 配音、对白时长、口型、音乐、音效、混音、字幕 | 有部分交付字段/规划 | 🔴 未闭环 | 无真实音频和最终剪辑成片 |
| 宣传片适配 | 目标、CTA、多时长、多画幅、影响指标 | 有不同专业流水线服务 | 🟡 部分 | 无完整多版本成片与效果反馈 |
| 发布反馈 | 播放、完播、留存、评论、A/B | 无平台分析闭环 | 🔴 缺失 | 无“表现 → 改写/再生成”数据循环 |

## 7. 当前项目的真实状态

以 `web/generated/ai-comic-series-projects/20260720-series-ujl3atax/project.json` 为准：

| 指标 | 当前值 |
|---|---:|
| 规划集数 | 20 |
| 已生成完整故事 | 3（E1 / E10 / E20） |
| 未生成 | 17 |
| 已生成集机器质量通过率 | 100% |
| 系列质量 | 54，未通过 |
| 主要系列问题 | 17 集缺失；1 条情绪线超过计划回收点 |
| 商业机器质量门 | 100，通过 |
| 真人盲审 | 1 人；7 维均 4/5；通过 |
| 视觉 identity | 14/14 ready；14/14 approved |
| 世界规则 | 2/2 ready；2/2 approved |
| 真人批准合计 | 16/16 |
| 图片资产库 | 4 个 PNG，全部是 `gears_local_test` |
| 真实图片资产 | 0/14 |
| production credit | 0/14 |
| Seedance production items | 0 |
| GEARS jobs | 0 |
| 真实 Provider 视频 | 0 |

四个本地测试人物为：沈砚、林灯、开发商、盗谱者。它们只证明了文件上传、SHA、provider 元数据、身份绑定和历史账本可以闭环；不是可用于正式生产的角色资产。

## 8. 现在能做到什么

### 可以稳定做

- 从文化知识和用户需求生成结构化 StoryBlueprint。
- 生成题材/类型配置、premise contract、人物、世界规则、分集计划和长线线索。
- 输出 `full_text`、`scene_breakdown`、`gears_segments`、视觉提示和 Seedance/GEARS 交付包。
- 对钩子、冲突、可见动作、人物选择、反转、结尾追问、文化边界和连续性做机器检查。
- 生成视觉圣经文字定义并由真人批准。
- 记录项目版本、指纹、审计、上传历史、成本/Provider 字段和 production readiness。
- 在不调用外部 API 时跑通本地测试闭环。

### 只能部分做到

- 用户小说改编：能做规则化的摘要与改编建议，不能证明深度理解长篇。
- 专业导演计划：能输出镜头意图和稳定 shot ID，但缺完整的空间/动作/灯光/表演控制。
- 参考风格：已有类型和一个本地 style pack，但不能从收藏夹自动形成可靠分析。
- 商业质量：机器门能检查结构，不等于市场表现、原创性或成片质量。

### 目前做不到

- 合法、自动地读取并理解整个 Bilibili 收藏夹、电影、小说和剧本内容。
- 自动完成视频转录、关键帧、镜头边界、运镜、声音和时间码分析。
- 把高分作品“学成风格”且同时证明没有抄袭。
- 生成并批准 14 个真实图片资产。
- 真实调用视频 Provider 并产出 E1。
- 自动完成稳定表演、口型、配音、音乐、剪辑、混音、字幕和发行母版。
- 用真实完播率/留存率/评论数据自动改进下一轮故事。

## 9. 开发路线

### P0：真实生产证明，不能被参考研究延误

### P0-A：4 个核心人物真实图片试产

1. 在 GEARS 配置一个真实图片 Provider、模型、密钥、预算和失败重试策略。
2. 以已批准的四个 identity 指纹生成首轮人物资产。
3. 每人至少交付：
   - 主标准图；
   - 正面/侧面或必要身份视图；
   - 表情/动作测试；
   - 服装和永久识别锚点说明；
   - prompt、negative prompt、seed/model/provider、cost、hash。
4. 真人逐个检查身份一致、文化/时代、可生产性、权利和禁用特征。
5. 只有真实文件、真实 Provider 元数据、权利通过和真人通过后，才允许 `production_credit=true`。

### P0-B：扩展到 14/14

- 先冻结四个核心人物风格与制作参数，再扩展其他人物、场景、道具和规则表现。
- 使用接触表检查同一人物跨角度、跨表情、跨服装的身份稳定。
- 任意资产修改后，必须使旧批准/旧绑定失效或进入新版本，不能保留错误 credit。

### P0-C：真实 Provider 试产 E1

1. 只选 E1 的少量代表镜头，不直接生成整集。
2. 使用已获 credit 的角色/场景资产生成关键帧。
3. 真人关键帧门禁通过后才送入视频 Provider。
4. 回调写入真实 provider job、输出文件、成本、时长和 SHA。
5. 检查：
   - 人物脸和服装；
   - 空间和轴线；
   - 动作连续；
   - 皮影灯幕与原创记忆抹除信号；
   - 违规动作、规则和后果是否同一因果链；
   - 字幕/对白时长；
   - 无随机新增文化事实。

### P0 验收

- `real_image_assets = 14/14`
- `production_credit = 14/14`
- `rights_status = approved/cleared`
- `human_review_status = approved`
- 至少 1 个真实 GEARS job 完成
- 至少 1 个 E1 Provider 视频文件通过人工试产审查
- 本地测试件继续保留测试标签，绝不冒充真实产物

### P1：Reference Intelligence / 参考理解层 v1

第一版不要做自动爬站和大规模下载，只做**人工录入 + 结构化分析 + 来源/权利审计**。

### 新数据结构

```ts
interface ReferenceSourceRecord {
  reference_id: string;
  title: string;
  media_type: 'film' | 'episode' | 'promo' | 'novel' | 'screenplay' | 'tutorial';
  source_url?: string;
  platform?: string;
  creator?: string;
  accessed_at: string;
  rights_status: 'user_owned' | 'licensed' | 'public_domain' | 'research_only' | 'unknown';
  access_scope: 'metadata_only' | 'excerpt' | 'full_user_supplied';
  content_fingerprint?: string;
  user_reason: string;
}

interface FilmReferenceAnalysis {
  hook_timecode?: string;
  central_question?: string;
  sequence_beats: Array<{ start: string; end: string; function: string }>;
  shot_observations: Array<{
    timecode: string;
    framing?: string;
    camera_motion?: string;
    blocking?: string;
    lighting?: string;
    audio_function?: string;
    evidence_note: string;
  }>;
  continuity_methods: string[];
  reusable_principles: string[];
  avoid_copying: string[];
}

interface TextReferenceAnalysis {
  source_units: Array<{ source_unit_id: string; summary: string }>;
  character_wants: string[];
  scene_patterns: Array<{
    objective: string;
    opposition: string;
    turn: string;
    visible_action: string;
    subtext?: string;
  }>;
  must_keep: string[];
  compression_options: string[];
  adaptation_risks: string[];
  reusable_principles: string[];
  avoid_copying: string[];
}

interface BenchmarkCard {
  benchmark_id: string;
  reference_ids: string[];
  target_video_type: string;
  target_dimension: 'hook' | 'character' | 'scene' | 'visual' | 'audio' | 'promo';
  principle: string;
  evidence_refs: string[];
  approved_by?: string;
  approved_at?: string;
}
```

### 推荐修改位置

- `web/shared/types.ts`
- `web/shared/schemas.ts`
- 新建 `web/server/src/services/reference-library-service.ts`
- 新建 `web/server/src/services/reference-analysis-service.ts`
- 新建或扩展 reference API route
- AI 漫剧工作台新增“参考资料”区域
- 新增 service、schema、route 和审计测试

### P1 验收

1. 可录入 URL、标题、类型、权利状态和“为什么收藏”。
2. 可创建手工影视分析卡和文字分析卡。
3. 只存分析、证据时间码和内容指纹，不存未经授权的完整正文/视频。
4. 两条以上参考可组合成 benchmark/style pack。
5. 生成结果必须携带 `reusable_principles` 和 `avoid_copying`。
6. reference 不自动写入文化 KB，也不自动获得 production credit。
7. 每个分析结论都能追溯来源和人工批准人。

### P2：长文本语义改编

- 文档分块、章节地图和事件 ID；
- 角色/关系/秘密/物件账本；
- source event → scene → episode 映射；
- must keep / compress / merge / invent 决策；
- 叙述视角、内心活动到可见行动的转译；
- 支线、伏笔、回收和人物弧一致性；
- 权利与版本指纹贯穿到最终脚本。

### P3：导演引擎与视觉 QC

- 构图、景别、角度、焦段意图；
- 场面调度、视线、轴线、出入画方向；
- 动作分解、起止姿态和相邻镜头连续；
- 灯光、色彩和场景状态；
- 人物表演目标、微表情和反应镜头；
- 3×3 接触表/故事板；
- 关键帧 approval gate；
- 模型运动预算与禁止随机动作；
- 视觉差异检测和人工复核队列。

### P4：声音、后期和发布反馈

- 角色声线与 voice identity；
- 对白时长、呼吸、口型和情绪；
- 音乐主题、环境音、音效和响度；
- 剪辑、字幕、画幅、色彩和多版本输出；
- 平台播放、3 秒留存、完播、跳出、评论意图；
- 指标回链到 hook、scene、shot 和 asset 版本。

## 10. 新对话第一轮应该怎么推进

建议新对话不要重新研究，直接执行以下顺序：

1. 读取本文和上一份交接：
   - `docs/story-agent-film-text-benchmark-development-handoff-20260723.md`
   - `docs/story-agent-new-conversation-development-handoff-20260721-v2.md`
2. 读取项目账本：
   - `web/generated/ai-comic-series-projects/20260720-series-ujl3atax/project.json`
3. 首先检查真实图片 Provider 的配置、预算、回调和证据条件。
4. 如果真实 Provider 已具备，立即做四个核心人物试产，不先扩写更多 reference 功能。
5. 如果 Provider 仍缺密钥/账户等外部条件，则实现 P1 的最小切片：
   - schema/types；
   - 本地持久化；
   - 手工新增/列表/查看；
   - 权利状态；
   - 一张影视卡 + 一张文字卡；
   - 测试。
6. 不得修改 `production_credit` 的严格语义，不得让本地测试件计入 14/14。

### 可直接复制到新对话的启动提示

```text
请先完整读取：
1. docs/story-agent-film-text-benchmark-development-handoff-20260723.md
2. docs/story-agent-new-conversation-development-handoff-20260721-v2.md
3. web/generated/ai-comic-series-projects/20260720-series-ujl3atax/project.json

目标有两条，但优先级固定：
A. 生产证明：4 个核心人物真实资产 → 14/14 production credit → 真实 Provider 试产 E1。
B. 产品能力：实现 Reference Intelligence v1，把影视/小说/剧本/宣传片参考变成有来源、权利、证据和 avoid-copying 的分析卡。

先核对真实 Provider 是否已具备。若具备，直接推进 A；若仍被外部凭证阻塞，完成 B 的最小可测切片，不要把 local_test 冒充真实资产。所有结论必须以代码、测试和项目账本为证据。完成后更新交接文档，按当前相关分支 commit 并 push。
```

## 11. 资料索引

### 用户收藏与 Bilibili 样本

- [《末日山宿》完整长篇](https://www.bilibili.com/video/BV1mwMc6uEdX/)
- [朝廷当我死了 我却活成了神仙](https://www.bilibili.com/video/BV1G4Jg6PEub/)
- [大明14444](https://www.bilibili.com/video/BV1YdMp6kEzZ/)
- [志怪版《武松打虎》AI 真人电影工作流](https://www.bilibili.com/video/BV1NZKm6hEim/)
- [《天师李淑芬》第一集](https://www.bilibili.com/video/BV1o9MP6cEUm/)
- [《乡村猎艳记》抢先版](https://www.bilibili.com/video/BV1GMNC6sED3/)
- [《我有一间魔法便利店》——八](https://www.bilibili.com/video/BV16QKN6eEij/)
- [AI 漫剧进阶教程：Image2 故事板与完整制作流程](https://www.bilibili.com/video/BV1QNVP6aEx8/)
- [8 部分 AI 漫剧工作流教程](https://www.bilibili.com/video/BV1J1PszYEvY/)
- [角色三视图与一致性制作](https://www.bilibili.com/video/BV1A6osBHEqa/)
- [3×3 接触表与镜头推进示例](https://www.bilibili.com/opus/1159572214271442968)

### 剧本、分集与版权

- [Academy Margaret Herrick Library — Scripts](https://www.oscars.org/margaret-herrick-library/collections/scripts)（A）
- [Writers Guild Foundation — Where to Read Film and TV Scripts Online](https://www.wgfoundation.org/web-resources-where-to-find-scripts-online)（A）
- [Writers Guild Foundation FAQ](https://www.wgfoundation.org/frequently-asked-questions)（A）
- [Sundance — Six Rules for Writing a Compelling TV Episode](https://www.sundance.org/blogs/six-rules-for-writing-a-compelling-tv-episode/)（A）
- [Sundance — From Outline to First Draft](https://collab.sundance.org/catalog/Screenwriting-From-Outline-to-First-Draft-of-Your-Screenplay)（A）
- [BBC TV Screenplay Format](https://downloads.bbc.co.uk/writersroom/scripts/screenplaytv.pdf)（A）
- [WGA — Creative Rights for Writers](https://www.wga.org/contracts/know-your-rights/creative-rights-for-writers)（A）
- [Project Gutenberg — Journey to the West](https://www.gutenberg.org/ebooks/23962)（可用于研究公版文本，但仍须按目标发行地区复核权利）
- [Chinese Text Project FAQ](https://ctext.org/faq)（古籍文本与翻译版权需分别判断）

### 宣传片

- [Cannes Lions — Film](https://www.canneslions.com/awards/lions/film)（A）
- [Frontiers — Branded short films research](https://www.frontiersin.org/journals/communication/articles/10.3389/fcomm.2025.1627473/full)（B）

### 中文经验资料：只作 C/D 级参考

- [知乎：AI 漫剧制作流程示例](https://www.zhihu.com/articles/2060669906920662498)
- [知乎：小说改短剧经验](https://zhuanlan.zhihu.com/p/1933310836325188244)
- [知乎：剧本写作方法讨论](https://www.zhihu.com/tardis/bd/ans/1568159363)
- [AI 动画制作流程文章](https://www.80aj.com/2026/03/07/ai-animation-production-pipeline/)
- [AI 漫剧生产流程课程页](https://www.circler.cn/course_info/166/)

以上 C/D 级来源存在营销、夸大收益、缺少样本或无第三方验证的风险。不得把其“爆款”“高分”“月入”等声明写入产品事实。

## 12. 2026-07-23 继续开发：Reference Intelligence 最小服务闭环

### 12.1 分流结论

接管后先核对了正式项目、真实图片入口和环境配置：

- 当前仓库只有 `generation_mode=local_test` 的四人物图片 bootstrap；
- 没有真实图片 Provider 模式、Provider 凭证配置文件、预算授权或外呼授权；
- 因此没有发起任何外部调用或付费任务，P0 原子计数保持不变；
- 按本文第 10 节约定，转而完成 P1 的第一个本地可测切片。

### 12.2 已实现

新增 Reference Intelligence v1 的服务端最小闭环：

1. 新增共享类型和严格 Zod 合同：
   - `ReferenceSourceRecord`
   - `FilmReferenceAnalysis`
   - `TextReferenceAnalysis`
   - `ReferenceAnalysisRecord`
   - `BenchmarkCard` 基础类型
2. 来源记录支持：
   - 标题、URL、媒介类型、平台、创作者；
   - 访问时间、权利状态、访问范围；
   - 内容指纹和“为什么收藏”。
3. 本地持久化使用原子 JSON 写入：
   - `references/creative/library/references/*.json`
   - `references/creative/library/analyses/*.json`
4. 新增 API：
   - `POST /api/reference-library/references`
   - `GET /api/reference-library/references`
   - `GET /api/reference-library/references/:referenceId`
   - `POST /api/reference-library/references/:referenceId/film-analyses`
   - `POST /api/reference-library/references/:referenceId/text-analyses`
5. 路由使用 `material:review` 产品权限。
6. 分析卡记录分析人、分析时间和人工批准状态；批准时记录批准人和批准时间。
7. 严格请求合同拒绝 `content`、`full_text` 等未声明字段，不接收或保存完整影视/文本正文。
8. 影视卡只允许绑定 `film / episode / promo / tutorial`；文字卡只允许绑定 `novel / screenplay`，类型错配失败关闭。
9. 本切片只写参考资料目录，不写文化 KB、不修改系列项目、不授予 production credit。

直接改动文件：

- `web/shared/types.ts`
- `web/shared/schemas.ts`
- `web/server/src/services/reference-library-service.ts`
- `web/server/src/routes/reference-library.ts`
- `web/server/src/index.ts`
- `web/server/src/__tests__/reference-library.test.ts`

### 12.3 测试证据

先添加路由合同测试并观察到缺少 `reference-library` 路由的失败，再实现最小功能。

```text
聚焦 Reference Library：1 file / 3 tests passed
服务端全量：161 files passed，1 skipped；1401 tests passed，2 skipped
全仓 check：visible copy 9 files / 17 checks、server tsc、client vue-tsc 全部通过
生产构建：server tsup、client vue-tsc / Vite 通过，171 modules transformed
git diff --check：通过
```

测试覆盖：

- 人工新增、列表和查看；
- 原子 JSON 落盘；
- 一张影视分析卡和一张文字分析卡；
- `reusable_principles`、`avoid_copying`、来源 ID 和人工批准审计；
- 拒绝夹带完整正文；
- 拒绝影视/文字媒介类型错配；
- 缺失 reference 返回 404。

### 12.4 正式项目影响与下一步

《皮影诡戏：守灯人》正式项目 JSON 未被修改，原子计数仍为：

- 规划 20 集，已生成 E1 / E10 / E20 共 3 集；
- identity 14/14 approved；
- world rule 2/2 approved；
- `gears_local_test` 图片 4 张；
- 真实图片资产 0/14；
- production credit 0/14；
- Seedance production items 0；
- GEARS jobs 0；
- 真实 Provider 视频 0。

本切片完成度 100%；Reference Intelligence v1 仍未完成的下一边界是：

1. **已完成**：benchmark card / style pack 的创建、组合和审计持久化；
2. AI 漫剧工作台“参考资料”录入与分析卡 UI；
3. 将已批准的 `reusable_principles` 与 `avoid_copying` 接入生成包和质量报告；
4. 保持 reference 不自动写入文化 KB、不自动获得 production credit；
5. 一旦真实图片 Provider、凭证、预算和外呼授权齐备，立即恢复 P0 四人物真实资产试产。

### 12.5 2026-07-23 继续开发：benchmark card / style pack 组合闭环

在上一小节的来源与分析卡基础上，已完成“两条以上参考 → benchmark card → audited style pack”的服务端闭环。

新增共享合同：

- `BenchmarkCardCreateRequestSchema`
- `BenchmarkCardSchema`
- `ReferenceStylePackCreateRequestSchema`
- `ReferenceStylePackRecordSchema`
- `ReferenceGovernanceBoundary`
- `ReferenceApprovedAudit`
- `ReferenceStylePackRecord`

新增 API：

- `POST /api/reference-library/benchmark-cards`
- `GET /api/reference-library/benchmark-cards`
- `GET /api/reference-library/benchmark-cards/:benchmarkId`
- `POST /api/reference-library/style-packs`
- `GET /api/reference-library/style-packs`
- `GET /api/reference-library/style-packs/:stylePackId`

组合门禁：

1. benchmark 必须绑定至少两个唯一 analysis ID 和两个不同 reference 来源；
2. 所有 analysis 必须先获得人工批准，pending 分析不能进入 benchmark；
3. `evidence_refs` 必须解析到已选 analysis，并覆盖每一个来源；
4. benchmark 保存目标片型、目标维度、抽象原则、创建人与批准人；
5. style pack 只能由已持久化 benchmark 组合；
6. `compatible_video_types` 必须覆盖所有 benchmark 的目标片型；
7. style pack 自动继承来源 ID、analysis ID、benchmark ID、抽象原则和所有 `avoid_copying`；
8. 所有组合记录固定：
   - `knowledge_writeback_allowed=false`
   - `production_credit_eligible=false`
9. audited style pack 独立保存到 `references/creative/library/style-packs/*.json`，不会覆盖旧静态 style pack。

测试先观察到三个组合端点 404/缺失门禁失败，再完成实现。最终证据：

```text
Reference Library 聚焦回归：2 files / 6 tests passed
服务端全量：162 files passed，1 skipped；1404 tests passed，2 skipped
全仓 check：visible copy 9 files / 17 checks、server tsc、client vue-tsc 全部通过
生产构建：server tsup、client vue-tsc / Vite 通过，171 modules transformed
git diff --check：通过
```

新增测试覆盖：

- 两条已批准影视分析成功组合 benchmark；
- benchmark 成功组合 audited style pack；
- 来源、analysis、benchmark、原则和 `avoid_copying` 可回溯；
- style pack 原子 JSON 落盘、列表与详情读取；
- pending 分析被 409 门禁阻断；
- 重复 analysis 不能冒充两个来源；
- 片型兼容范围遗漏时失败关闭。

本切片完成度 100%。正式《皮影诡戏：守灯人》项目仍未修改，production credit 仍为 0/14。下一工程边界是把**已批准 audited style pack**接入生成 prompt package、`reference_trace` 和 reference quality report；在此之前，创建 style pack 不会自动影响任何故事生成。

## 13. 最终判断

本轮研究没有改变此前的生产结论，反而强化了它：

- **16/16 真人批准**说明前期定义已经足够进入真实资产生产；
- **4 个 local_test PNG**只说明通路，不说明成片能力；
- **14/14 production credit**是从“Agent 会规划”跨到“系统能制作”的关键门；
- **E1 真实 Provider 试产**是验证 Story Agent 与 GEARS 是否真正结合的第一份硬证据；
- **Reference Intelligence v1**是让系统以后能系统吸收影视、小说、剧本和宣传片方法，而不是依赖一次性人工调研的关键产品层。

不要继续堆抽象“专业能力”字段来回避真实生产，也不要用一次真实 Provider 调用来掩盖上游参考理解的缺失。正确路线是：**一条生产证据链 + 一条参考理解链，最终在 E1 汇合。**
