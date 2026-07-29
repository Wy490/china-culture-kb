# Story Agent 开发交接（2026-07-29）

> 工作目录：`/Users/wuyu/Desktop/china-culture-kb`
>
> 当前分支：`codex/story-agent-manifest-integrity-20260718`
>
> 功能基线：`34d6c1ad feat(story-agent): recommend generation recipes`
>
> 交接提交：以本地 `git log -1 --oneline` 为准
>
> 详细历史：`docs/story-agent-development-handoff-20260725.md`

## 1. 当前产品定位

Story Agent 是面向中国文化题材的 AI 影视前置创作系统。当前产品边界为：

```text
主题 / 大纲 / 授权原作
  → 中国文化知识检索
  → 故事蓝图与完整文本
  → 场景、分镜与生产段落
  → GEARS / Seedance 提示词与图片资产需求
  → Codex 图片资产
  → 前置制作交付包
  → 外部 AI 视频模型
```

系统当前不在内部生成最终视频，不把外部视频模型的成功冒充为本系统完成，也不把
fixture、record-replay、机器比较或 `not_run` 记作真人审核、法律确认或 production
credit。

## 2. 创作模型

用户的“类型－题材－风格”理解基本正确，完整模型是：

```text
创作路径
× 成片类型
× 题材与素材
× 叙事结构
× 表现风格
× 创作 / 生产约束
```

各层职责：

1. 创作路径：原创单片、资料/原作改编、机构命题、系列漫剧。
2. 成片类型：决定做成什么片。
3. 题材与素材：决定讲什么，包括主题、大纲、地域、中国文化知识和合法参考材料。
4. 叙事结构：决定故事如何展开。
5. 表现风格：决定如何视听呈现。
6. 创作约束：事实模式、文化准确性、受众、传播目标、时长、优先级、严格度和交付要求。

当前 15 种成片类型：

```text
剧情故事类
  人物故事 / 历史剧情短片 / 神话传说故事 / AI 漫剧单片 / 儿童故事片

宣传推广类
  文化宣传片 / 非遗工艺宣传片 / 城市文旅宣传片 / 竖屏短视频

讲解教育类
  微纪录片 / 知识讲解视频 / 宣讲片 / 教育培训片

场景空间类
  场景短片 / 山水意境片
```

当前 11 种表现形式：

```text
影视叙事 / 纪实风格 / 主持讲述 / 旁白蒙太奇 / 竖屏短剧
AI 漫剧 / 2D 动画 / 水墨风格 / 儿童动画 / 展陈风格 / 社媒快切
```

## 3. 文本层创作逻辑

文本层不是一次调用直接写完整剧本，而是逐层把文化素材变成可生产文本：

```text
输入解析
  → 创作合同
  → 知识检索与可信度约束
  → StoryBlueprint
  → full_text
  → scene_breakdown / StoryScene
  → GearsSegment
  → visual_prompt / segment_prompt_hint
```

### 3.1 输入与创作合同

系统先确定：

- 创作用途和创作路径；
- 成片类型、表现形式、叙事结构、时长；
- 题材、地域、时代、受众和传播目标；
- 原创虚构、素材启发、原作改编、事实重构或机构审定模式；
- 剧情/资料优先级与类型严格度。

创作合同用于限制后续生成，避免把历史资料、用户指令和创作虚构混为一体。

### 3.2 中国文化知识层

知识库可提供地域历史、人物事件、民俗礼仪、非遗技艺、服饰器物、建筑空间、
思想观念和文化符号。知识不是直接拼接成剧本，而是转成：

- 世界构建条件；
- 人物可执行动作；
- 场景和道具细节；
- 冲突成立的历史/礼俗原因；
- 需要核验或避免确定化表达的事实边界。

### 3.3 故事蓝图与完整文本

`StoryBlueprint` 先解决人物、目标、阻力、升级、选择、代价和文化行动，再生成：

- 故事梗概、人物小传；
- 分幕/分集大纲；
- 场景文本、动作、对白和旁白；
- 情绪变化、转场、节奏；
- 集尾悬念或宣传落点。

不同类型会调用不同叙事结构库，不应使用同一套三幕模板覆盖全部 15 种成片类型。

### 3.4 生产化拆解

`scene_breakdown` / `StoryScene` 把全文转成结构化场景，记录：

- 时间、地点、人物；
- 场景目标、冲突、转折和结果；
- 动作、对白、旁白；
- 文化事实和连续性要求；
- 人物、服装、道具、环境等资产需求；
- 景别、构图、运镜、声音建议；
- 与前后场景的衔接。

`GearsSegment` 再把场景拆成适合图片和视频模型执行的有界生产段落。

### 3.5 质量检查与修复

当前质量链关注：

- 类型结构是否成立；
- 人物目标和因果是否清楚；
- 文化事实、时代和地域是否准确；
- 场景是否可视觉化；
- 人物、道具、空间是否连续；
- 时长和平台要求是否满足；
- 是否过度接近参考作品；
- 输出合同是否完整。

修复应优先局部处理失败字段或场景，不应无条件全篇重写。

## 4. 图片层与 GEARS 创作逻辑

GEARS 不只是“图片生成器”，而是文本到视觉生产之间的资产组织和交付层：

```text
StoryScene / GearsSegment
  → 视觉实体提取
  → 角色与世界视觉圣经
  → 资产 manifest
  → 图片生成请求
  → 图片导入、哈希与 receipt
  → 一致性 / provenance 检查
  → 分镜故事板和视频模型交付包
```

### 4.1 视觉实体提取

从文本中提取并分配稳定 ID：

- 人物、年龄、身份、外形；
- 服装、妆发和状态变化；
- 关键道具；
- 建筑、自然环境、时间、天气；
- 礼仪、纹样和文化符号；
- 当前动作、情绪、景别、构图和光线。

### 4.2 视觉圣经

视觉圣经约束：

- 角色标准造型和多状态变化；
- 服装颜色、材质、年代；
- 标志性道具；
- 场景空间关系；
- 色彩、光线、镜头和美术方向；
- 禁止出现的时代错误和视觉污染。

同一实体必须跨场景复用稳定身份，避免人物、服装、道具和空间漂移。

### 4.3 图片资产层级

预期资产包括：

- 人物设定图、多视图、表情和动作；
- 服装状态和核心道具；
- 场景概念图与环境空镜；
- 关键剧情帧；
- 分镜故事板；
- 首帧、参考帧和连续性图片；
- 宣传视觉或海报资产。

系统应先建立母资产，再派生镜头资产，不能让每个镜头从零随机生成。

### 4.4 图片提示词

图片提示词由以下部分组合：

```text
稳定实体身份
+ 时代与地域
+ 服装道具
+ 场景空间
+ 动作与情绪
+ 景别、机位、构图
+ 光线和美术方向
+ 连续性锚点
+ 禁止项
```

文化知识约束服饰、器物、建筑和礼仪；文本场景提供动作、情绪和镜头功能。

### 4.5 Provenance 与交付

图片请求、导入和交付链使用 manifest、SHA-256、receipt、evidence bundle、
descriptor 和 preflight。它们证明“生成了什么、从哪里导入、字节是否一致”，但不自动
证明版权、真人审核或 production 可用性。

最终交付给 Seedance 等外部视频模型的是：

- 对应剧情和场景目标；
- 人物、场景、道具图片；
- 首帧或关键帧；
- 动作、运镜、时长；
- 台词、旁白和声音建议；
- 连续性约束；
- `visual_prompt` / `segment_prompt_hint`。

## 5. 本轮完成：本地私有视频样本 P1-D1～D6

最近三个提交：

```text
2c2ac5ea feat(story-agent): add private video sample intake
0d72e2f6 feat(story-agent): bridge private video samples to mcp
3140160f feat(story-agent): surface private video samples in reference library
```

已经完成：

- 本地绝对路径视频 ingest；
- `ffprobe` 元数据读取；
- `ffmpeg` 缩略图和 16kHz 单声道 wav 派生；
- 本地 transcript 封存，只返回哈希和元数据；
- CLI、Web API、MCP 三个 canonical 入口；
- Reference Library 浏览器工作台；
- no-credit、no-upload、no-prompt-injection 治理状态。

固定边界：

- 原视频复制到 `references/creative/private-video-samples/`；
- 该目录已被 `.gitignore` 忽略；
- 记录不保存用户原始绝对路径；
- 原视频、音频、缩略图和 transcript 正文不进入 Git；
- 不上传第三方；
- 只有用户自有、已授权或公版样本才能进入后续人工分析；
- 当前没有用户真实样本，不得用合成 fixture 冒充。

## 6. 本轮完成：公开候选与非复制创作配方

提交：

```text
183b122a feat(story-agent): add reference-inspired generation recipes
```

已登记 10 条 `research_only + metadata_only` 来源：

- 豆瓣前三：《肖申克的救赎》《霸王别姬》《阿甘正传》；
- IMDb 前三：《肖申克的救赎》《教父》《蝙蝠侠：黑暗骑士》；
- D&AD 宣传片：Apple《Welcome Home》、Metro Trains《Dumb Ways to Die》、
  Nike《You Can't Stop Us》；
- 央视经典剧：1994 版《三国演义》、1987 版《红楼梦》。

电影榜单交集去重后为 5 部，所以资料库总数是 5 部电影、3 部宣传片、2 部电视剧。

所有候选：

- 没有下载原视频；
- 没有内容指纹；
- 不能创建合法分析任务；
- 没有 approved analysis、benchmark 或 style pack；
- 不能注入生成 prompt；
- 只保存公开页面链接、标题和研究理由。

当前 8 个抽象创作配方：

```text
feature_long_goal_payoff       长线目标与延迟回收
feature_epoch_character_mosaic 人物命运与时代拼图
feature_moral_pressure         权力压力与道德两难
promo_space_emotion            空间变化与情绪品牌片
promo_mnemonic_reveal          记忆旋律与结尾揭示
promo_collective_montage       群像动作与主题蒙太奇
series_strategy_chapters       历史权谋章回连续剧
series_ritual_relationships    礼俗群像关系连续剧
```

Story Studio 已增加“创作配方”选择器。应用配方会同步：

- `video_type`；
- `presentation_style`；
- `narrative_pattern_ids`；
- `story_priority`；
- `genre_strictness`；
- tone；
- communication goal。

生成配置不包含候选作品标题、角色、对白、情节、镜头、美术或音乐。

### 6.1 本轮完成：P1-E1 一等生成合同

创作配方已经从前端参数组合器升级为可审计的一等生成合同：

- 共享 `StoryGenerateRequest` 增加可选
  `reference-generation-recipe/v1`；
- 合同固定保存 `recipe_id`、`recipe_version`、抽象机制快照、禁仿边界和
  `payload_sha256`；
- 服务端按 canonical 配方目录重新解析并复算 SHA-256，拒绝未知 ID、内容篡改、
  成片类型不兼容和表现形式不兼容；
- 生成 prompt 只注入 `reusable_mechanisms` 和 `avoid_copying`，不注入公开研究候选
  标题、角色、对白、情节、镜头、美术或音乐；
- 生成结果、项目初始版本和 `story-agent-run/v2` 输入账本保存同一份 canonical
  provenance；
- Story Studio、StoryResult、项目当前版本和 Story Agent Runs 控制台展示配方机制、
  禁仿边界、版本与 payload SHA；
- Web API 和 MCP canonical 入口均支持该合同；
- 旧请求和无配方项目继续兼容。

### 6.2 本轮完成：P1-E2 可解释的可选推荐

创作配方推荐已经成为独立 canonical 服务，不与生成或应用动作混在一起：

- 新增 `reference-generation-recipe-recommendation/v1` 请求/结果合同；
- 服务端按创作路径、成片类型、题材、叙事目标和结构化素材特征进行确定性排序；
- 只返回与目标 `video_type` 兼容的 canonical 配方合同，最多 3 个；
- 每项包含 rank、score、confidence、原因和命中信号；
- 没有兼容配方时保持无配方；不会为了凑数跨类型推荐；
- 事实重构/机构审定任务存在 `limited_or_unverified_material` 时返回零建议，并明确
  “先补齐和核验材料”；
- Story Studio 自动刷新建议，但不自动应用；用户可以采用、手动切换或明确拒绝；
- 拒绝后生成请求不携带配方合同；
- MCP 新增 `kb_recommend_story_generation_recipes`，只桥接 canonical Web API，
  明确 `generation_performed: false`、`recipe_applied: false`；
- 推荐输入、结果和 UI 均不包含公开研究候选作品标题或内容。

### 6.3 本轮完成：P1-E3 同输入配方效果对照

创作配方现在可以在不需要真实参考视频的前提下执行严格同输入机器对照：

- 以已持久化、带机器质量报告且无配方的故事作为 baseline；
- 服务端生成 `reference-recipe-comparison-draft/v1`，draft 阶段不调用模型；
- replay 请求只增加 canonical `reference-generation-recipe/v1` 和 baseline ID；
- 正式生成前复验来源输入、模型、成片类型、表现形式、叙事结构、中心事件、时长、
  创作合同和 baseline 无配方边界；
- style pack 与 recipe comparison 必须二选一，禁止混合处理污染因果；
- 生成后持久化 `story-recipe-effect-comparison/v1`；
- 固定比较结构、因果、可视化程度、连续性和合同完整度五类机器指标；
- 结果给出 baseline 分、recipe-assisted 分、delta、证据信号和机器 verdict；
- verdict 只表示机器指标变化，不测真人偏好，不下法律结论，不授予 production credit；
- Story Studio baseline 模式支持准备只读配方 replay draft；
- StoryResult / 项目当前版本展示五维机器对照；
- MCP 新增 `kb_prepare_story_recipe_comparison`，只准备 draft，不执行生成；
- 最终生成仍统一走 `kb_story_agent_generate` / Web canonical pipeline，因此项目版本和
  Story Agent run 继续保存请求与对照结果。

P1-E1 / E2 / E3 配方路线图已完成。真实参考样本、人工偏好和生产验收仍受既有权利与
人工证据边界约束。

### 6.4 本轮完成：配方效果历史索引与机器趋势

已把单次对照升级为当前项目版本上的只读历史与趋势层：

- 新增 `story-recipe-effect-comparison-history/v1` 共享合同；
- 历史直接派生自现有项目仓库和 current version，不新增旁路数据库；
- 只收录 story ID、canonical recipe 版本/hash、五维证据和边界全部一致的 completed
  comparison；不合法记录 fail closed 并计入 `skipped_invalid_comparison_count`；
- 支持按配方、成片类型、机器 verdict 筛选，历史项稳定按更新时间排序；
- 趋势在展示 limit 之前聚合，包含样本数、四类 verdict 计数、综合分和五维均值；
- `/api/projects/recipe-effect-comparisons` 在聚合前执行项目级访问过滤，避免不可见项目
  通过计数或均值泄漏；
- 项目工作台已提供筛选、趋势卡、最近对照入口和明确边界提示；
- MCP 新增 `kb_get_story_recipe_effect_history`，只作为 canonical Web API 薄桥接；
- 固定边界为 machine-only、非真人偏好、非因果证明、非法务结论、非生产交付信用。

### 6.5 本轮完成：受控 cohort 与机器报告导出

配方趋势现在可以导出为可复核的受控 cohort 报告：

- 新增 `story-recipe-effect-machine-report/v1`；
- cohort 定义包含配方、成片类型、机器 verdict、时间窗、每配方最小样本数和 item limit；
- 带时区的 ISO 时间窗先归一化为 UTC，等价时间不会产生不同 cohort ID；
- 同一 cohort 定义生成稳定 `recipe-effect-cohort-*` ID；
- cohort 成员按项目/故事/配方/hash 稳定排序后生成 `membership_sha256`；
- 最小样本门槛在最终趋势聚合前执行，报告同时记录 source matched、candidate、
  included、below-minimum exclusion 和 truncation；
- API 新增 `/api/projects/recipe-effect-comparison-report`，访问过滤在 cohort 聚合前执行；
- 项目工作台支持最小样本门槛以及 Markdown/JSON 下载，并显示最近 cohort ID；
- JSON 下载主动去除重复 Markdown 正文；
- MCP 新增 `kb_get_story_recipe_effect_report`，支持时间窗和全部 cohort 筛选；
- 空 cohort 是合法结果，不会伪造样本、人工偏好、因果结论或生产信用。

## 7. 关键代码位置

```text
创作页面
web/client/src/views/StoryStudio.vue

15 种类型和 11 种表现形式
web/shared/types.ts

8 个创作配方
web/shared/reference-generation-recipes.ts

叙事结构目录和类型兼容关系
web/server/src/services/narrative-pattern-library.ts

配方合同测试
web/server/src/__tests__/reference-generation-recipes.test.ts

配方推荐服务与测试
web/server/src/services/reference-generation-recipe-recommendation-service.ts
web/server/src/__tests__/reference-generation-recipe-recommendation.test.ts

配方推荐 MCP
mcp-server/src/tools/story-agent-recipe-recommendations.ts

配方同输入对照
web/server/src/services/reference-recipe-effect-comparison-service.ts
web/server/src/services/reference-baseline-replay-service.ts

配方对照历史与趋势
web/server/src/services/reference-recipe-effect-history-service.ts
web/client/src/views/Projects.vue

Reference Library 页面
web/client/src/views/ReferenceLibrary.vue

私有视频服务
web/server/src/services/reference-private-video-sample-service.ts

私有视频 API
web/server/src/routes/reference-library.ts

私有视频 MCP
mcp-server/src/tools/reference-private-video-samples.ts

公开研究元数据
references/creative/library/references/

详细历史交接
docs/story-agent-development-handoff-20260725.md
```

## 8. 当前验证状态

本轮已通过：

```text
reference generation recipes + narrative pattern library
  2 files / 12 tests passed

Web workspace lint
  server tsc + scripts tsc + client vue-tsc passed

Web production build
  server tsup + client vue-tsc/vite passed

Client visible-copy audit
  9 files / 17 checks passed

Browser smoke
  8 recipes rendered
  recipe application updated type/style/pattern/goal
  Reference Library rendered 10 research-only candidates

Repository audit
  10 candidate files are JSON only
  all research_only + metadata_only
  all without content fingerprint
  no local path or media extension leak
  git diff --check passed
```

浏览器控制台只有既有 `/favicon.ico` 404，不是本轮功能错误。

P1-E1 新增验证：

```text
recipe contract + recipe catalog + prompt + narrative patterns + API
  5 files / 263 tests passed

MCP canonical generation + run bridge
  2 files / 7 tests passed
  MCP TypeScript build passed

Web workspace lint
  server tsc + scripts tsc + client vue-tsc passed

Web production build
  server tsup + client vue-tsc/vite passed

Client visible-copy audit
  9 files / 17 checks passed

Browser smoke
  canonical recipe applied
  request carried reference-generation-recipe/v1 + SHA-256
  result provenance rendered
  generation request was intercepted; no smoke project was persisted

Repository audit
  git diff --check passed
```

P1-E2 新增验证：

```text
Server targeted recommendation / contract / API
  2 files / 9 passed, 233 unrelated API tests skipped

Server full regression
  186 files passed, 1 skipped
  1547 tests passed, 2 skipped

MCP targeted recommendation + generation bridge
  2 files / 6 tests passed

MCP full regression
  101 files / 523 tests passed
  TypeScript build passed

Web workspace lint / production build / visible-copy audit
  all passed

Browser smoke
  original character topic returned ranked reasons and high-confidence recommendation
  recommendation was not auto-applied
  explicit adoption updated the applied canonical recipe
  explicit decline cleared selection and applied contract
  institutional verified task without grounded material returned zero recommendations
  truth/material warnings rendered
  no story project was generated or persisted

Repository audit
  git diff --check passed
```

P1-E3 新增验证：

```text
Targeted comparison / baseline / API
  4 files / 11 tests passed, 236 unrelated API tests skipped

Server full regression
  187 files passed, 1 skipped
  1553 tests passed, 2 skipped

MCP full regression
  101 files / 525 tests passed
  TypeScript build passed

Web lint / production build / visible-copy audit
  all passed

Browser smoke
  existing recipe-free local-engine baseline loaded
  compatible recipe adoption enabled replay draft preparation
  draft returned no_generation_performed=true
  final generation became available only after draft validation
  final generation was not clicked
  story project count remained 321; no smoke project persisted

Repository audit
  git diff --check passed
```

配方历史与趋势新增验证：

```text
Server full regression
  188 files passed, 1 skipped
  1559 tests passed, 2 skipped

MCP full regression
  101 files / 529 tests passed
  TypeScript build passed

Web lint / production build / visible-copy audit
  all passed

Browser smoke
  project workbench rendered the recipe effect history panel
  empty state and recipe filter refresh behaved correctly
  machine-only / non-causal / non-production-credit boundary rendered
  only console error was the pre-existing /favicon.ico 404
```

受控 cohort 与机器报告新增验证：

```text
Server full regression
  188 files passed, 1 skipped
  1563 tests passed, 2 skipped

MCP full regression
  101 files / 533 tests passed
  TypeScript build passed

Web lint / production build / visible-copy audit
  all passed

Browser smoke
  minimum comparisons per recipe changed from 1 to 2
  JSON download completed as recipe-effect-cohort-074d6c6df771.json
  downloaded JSON contained stable cohort ID, membership SHA-256 and all false-credit boundaries
  downloaded JSON omitted duplicate markdown
  page rendered the latest exported cohort ID
```

## 9. Git 与运行状态

交接时状态：

```text
branch: codex/story-agent-manifest-integrity-20260718
functional baseline: 859007d5
handoff HEAD: run git log -1 --oneline
remote: expected ahead 10 after the recipe cohort report local commit
worktree: clean
push: not performed
```

研发实现总进度按 MVP 五个实现分项统计为约 99%（100/100/100/100/95）。
当前运行健康分为 30/100，主要因为历史 generated targets 未生产就绪且真实 GEARS v2
端点、callback secret/base 尚未配置；运行健康分不能冒充研发实现进度，研发完成也不能
冒充真实外部验收。

交接时浏览器冒烟使用过以下临时地址，验证后进程已停止：

```text
Story Studio
http://localhost:5173/story/new

API
http://localhost:3000
```

新对话不要假设旧进程仍存活。需要时启动：

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web
PORT=13006 \
VITE_DEV_PORT=15181 \
VITE_API_PROXY_TARGET=http://localhost:13006 \
VITE_STORY_AGENT_ROLE=administrator \
npm run dev
```

如果端口占用，先检查现有服务；不要未经确认杀死不明进程，也可以改用其他前端端口。

## 10. 下一开发优先级

P1-E1 / E2 / E3 和配方机器对照历史已完成。没有真实合法样本时，不继续伪造参考分析、真人偏好或生产
验收。下一轮可按产品需要选择：

- 为配方实验增加独立的真人评审录入与审核账本；没有真实操作员输入时保持空状态；
- 扩展更多成片类型的 canonical 配方；
- 继续 Story Agent 其他产品 backlog；
- 等待用户提供合法真实样本后进入人工分析链。

### 真实样本到位后

用户提供合法真实样本并亲自确认权利后，才执行：

```text
private ingest
→ ffprobe / ffmpeg
→ 本地转写
→ operator evidence
→ 独立人工 analysis approval
→ 跨来源 benchmark
→ audited style pack
→ same-input comparison
```

没有真实样本时不得伪造 timecode、逐镜头观察、授权、人工批准或生产验收。

## 11. 常用验证命令

```bash
cd /Users/wuyu/Desktop/china-culture-kb/web/server
npm test -- reference-generation-recipes.test.ts narrative-pattern-library.test.ts

cd /Users/wuyu/Desktop/china-culture-kb/web
npm run lint
npm run build
npm run audit:copy -w client

cd /Users/wuyu/Desktop/china-culture-kb
git diff --check
git status --short --branch
```

后续修改配方路线时，运行受影响的 recommendation、comparison、generation、
project persistence、API 与 MCP 测试；不要每次小改都重复整套全量 CI。

## 12. 可复制到下一对话的启动指令

```text
请阅读：
/Users/wuyu/Desktop/china-culture-kb/docs/story-agent-development-handoff-20260729.md

继续全力开发 china-culture-kb Story Agent。

当前分支应为 codex/story-agent-manifest-integrity-20260718，HEAD 应包含：
2c2ac5ea feat(story-agent): add private video sample intake
0d72e2f6 feat(story-agent): bridge private video samples to mcp
3140160f feat(story-agent): surface private video samples in reference library
183b122a feat(story-agent): add reference-inspired generation recipes
859007d5 feat(story-agent): persist generation recipe contracts

固定产品边界：
主题/大纲/授权原作 → 中国文化知识 → 故事蓝图与完整文本 → 场景/分镜/GearsSegment
→ GEARS/Seedance 提示词与图片需求 → Codex 图片资产 → 前置制作交付包。
外部 AI 视频模型负责最终运动画面，本系统当前不把视频生成冒充为已完成。

固定隐私和权利边界：
允许 ffmpeg/ffprobe 和本地转写；原视频、音频、缩略图和 transcript 正文不进入 Git、
不上传第三方；没有用户真实合法样本时，不得伪造授权、timecode、人工批准、benchmark、
style pack 或 production credit。

当前 10 条影视/宣传片/电视剧候选只是 research_only + metadata_only。
8 个创作配方已成为 reference-generation-recipe/v1 一等合同，只使用抽象机制，不得把
候选作品角色、对白、情节、镜头、美术或音乐注入生成。

P1-E1 已完成：服务端 canonical 解析、SHA-256 与防篡改、prompt 有界注入、
project version / story-agent-run / result provenance、Web/MCP 和旧项目兼容均已闭环。

P1-E2 已完成：服务端 canonical 确定性推荐、1～3 个兼容配方、解释原因、可拒绝与
手动切换、机构/事实型材料不足返回零建议、Story Studio 和 MCP bridge 均已闭环。

P1-E3 已完成：无配方 baseline、canonical 配方 replay draft、正式生成前 same-input
复验、五维机器 comparison、Story Studio / StoryResult / 项目持久化和 MCP draft
入口均已闭环；机器 verdict 不等于真人偏好、法律结论或 production credit。

配方效果历史与趋势已完成：current project version 派生索引、失效记录拒绝、组合筛选、
四类 verdict 与五维均值、项目权限过滤、项目工作台和
`kb_get_story_recipe_effect_history` 已闭环；趋势不证明因果，也不代表真人偏好。

受控 cohort 与机器报告已完成：稳定 cohort ID、成员 SHA-256、时间窗和最小样本门槛、
Markdown/JSON 导出、权限安全 API、项目工作台和
`kb_get_story_recipe_effect_report` 已闭环；空 cohort 不会被填充伪样本。

P1-E1 / E2 / E3 与机器趋势路线图完成。下一步必须根据新的产品优先级推进；没有用户真实合法
样本时，不得伪造后续 reference analysis、人工批准或生产验收。

完成后运行 targeted tests、Web lint/build/copy audit、git diff --check，更新本交接并创建
本地 commit。只有用户明确授权向 GitHub 传输仓库内容时才 push。
```
